"""PostgreSQL persistence and multi-worker-safe quota accounting for AstroBot."""
from __future__ import annotations

import hashlib
import hmac
import os
import time
from contextlib import contextmanager

BOT_EMAIL = "astrobot@spacechat.invalid"


class LimitReached(Exception):
    pass


@contextmanager
def connection():
    """One short database connection/transaction per operation (Psycopg 3)."""
    import psycopg
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not configured")
    with psycopg.connect(url, connect_timeout=5) as conn:
        yield conn


def public_client_key(request) -> str:
    """Avoid trusting user-supplied X-Forwarded-For headers by default.

    With Vercel-to-Render proxies, many clients may share a gateway IP. A trusted
    proxy config can be enabled after reviewing the actual ingress chain.
    """
    from flask import session
    uid = session.get("user_id")
    identifier = f"user:{uid}" if uid else f"ip:{request.remote_addr or 'unknown'}"
    secret = os.getenv("ASTROBOT_RATE_SECRET") or os.getenv("SECRET_KEY")
    if not secret:
        raise RuntimeError("SECRET_KEY must be configured for quota hashing")
    return hmac.new(secret.encode(), identifier.encode(), hashlib.sha256).hexdigest()


def enforce_quota(client_key: str, *, is_mention: bool = False) -> None:
    """Atomically claim one per-client and one global quota slot.

    This is stored in PostgreSQL rather than Python memory so Gunicorn's workers
    and deployed instances share the same counters. If the DB is unavailable,
    calls fail closed (no unlimited Gemini billing).
    """
    period = 900      # 15 minutes
    global_period = 86400
    now = int(time.time())
    if is_mention:
        client_limit = max(1, int(os.getenv("ASTROBOT_MENTION_LIMIT_15M", "8")))
        global_limit = max(1, int(os.getenv("ASTROBOT_MENTION_LIMIT_DAILY", "100")))
        prefix = "mention"
    else:
        client_limit = max(1, int(os.getenv("ASTROBOT_CHAT_LIMIT_15M", "10")))
        global_limit = max(1, int(os.getenv("ASTROBOT_CHAT_LIMIT_DAILY", "250")))
        prefix = "chat"
    limits = [
        (f"{prefix}:client:{client_key}", now // period, client_limit),
        (f"{prefix}:global", now // global_period, global_limit),
    ]
    with connection() as conn:
        with conn.cursor() as cur:
            for bucket_key, time_bucket, allowed in limits:
                cur.execute(
                    """INSERT INTO public.ai_rate_limit (bucket_key, time_bucket, request_count)
                       VALUES (%s, %s, 1)
                       ON CONFLICT (bucket_key, time_bucket)
                       DO UPDATE SET request_count = ai_rate_limit.request_count + 1
                       WHERE ai_rate_limit.request_count < %s
                       RETURNING request_count""",
                    (bucket_key, time_bucket, allowed),
                )
                if cur.fetchone() is None:
                    # Rolling back refunds the per-user slot if the global
                    # quota failed. No Gemini request has been sent.
                    conn.rollback()
                    raise LimitReached("AstroBot's request limit has been reached")


def reserve_mention(kind: str, source_id: int) -> bool:
    """Claim a mention exactly once across requests/Gunicorn workers."""
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO public.ai_mentions (source_kind, source_id, status)
                   VALUES (%s, %s, 'processing')
                   ON CONFLICT (source_kind, source_id) DO NOTHING
                   RETURNING source_id""",
                (kind, source_id),
            )
            return cur.fetchone() is not None


def complete_mention(kind: str, source_id: int, reply: str, *, post_id: int, parent_comment_id: int | None) -> int:
    """Save the bot comment and mark the trigger completed atomically."""
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id FROM public.users
                   WHERE username = 'AstroBot' AND email = %s AND is_bot = TRUE""",
                (BOT_EMAIL,),
            )
            bot = cur.fetchone()
            if bot is None:
                raise RuntimeError("AstroBot user missing; run the SQL migration")
            cur.execute(
                """INSERT INTO public.comments
                   (post_id, author_id, parent_comment_id, body)
                   VALUES (%s, %s, %s, %s) RETURNING id""",
                (post_id, bot[0], parent_comment_id, reply),
            )
            reply_id = cur.fetchone()[0]
            cur.execute(
                """UPDATE public.ai_mentions
                   SET status = 'completed', bot_comment_id = %s, updated_at = NOW()
                   WHERE source_kind = %s AND source_id = %s""",
                (reply_id, kind, source_id),
            )
            return reply_id


def fail_mention(kind: str, source_id: int, *, rate_limited: bool = False) -> None:
    """Use generic status only; never persist API credentials/error internals."""
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE public.ai_mentions SET status = %s, updated_at = NOW()
                   WHERE source_kind = %s AND source_id = %s""",
                ("rate_limited" if rate_limited else "failed", kind, source_id),
            )


def fetch_source(kind: str, source_id: int) -> dict | None:
    """Read the actual saved content so API callers cannot spoof a mention."""
    from psycopg.rows import dict_row
    with connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            if kind == "post":
                cur.execute(
                    """SELECT p.id, p.id AS post_id, p.title, p.body,
                              u.username AS author, u.is_bot
                       FROM public.posts p JOIN public.users u ON u.id = p.author_id
                       WHERE p.id = %s""",
                    (source_id,),
                )
            else:
                cur.execute(
                    """SELECT c.id, c.post_id, c.parent_comment_id, c.body,
                              p.title, p.body AS post_body,
                              u.username AS author, u.is_bot
                       FROM public.comments c
                       JOIN public.posts p ON p.id = c.post_id
                       JOIN public.users u ON u.id = c.author_id
                       WHERE c.id = %s""",
                    (source_id,),
                )
            row = cur.fetchone()
            if not row or row["is_bot"]:
                return None
            return dict(row)


def discussion_context(post_id: int) -> str:
    """Limited context: no user emails/private account fields go to Gemini."""
    from psycopg.rows import dict_row
    with connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """SELECT u.username, c.body
                   FROM public.comments c JOIN public.users u ON u.id = c.author_id
                   WHERE c.post_id = %s ORDER BY c.created_at DESC, c.id DESC
                   LIMIT 12""",
                (post_id,),
            )
            comments = list(reversed(cur.fetchall()))
    return "\n".join(f"{c['username']}: {c['body'][:450]}" for c in comments)[:5500]


def mention_status(kind: str, source_id: int):
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT status, bot_comment_id FROM public.ai_mentions
                   WHERE source_kind = %s AND source_id = %s""",
                (kind, source_id),
            )
            return cur.fetchone()
