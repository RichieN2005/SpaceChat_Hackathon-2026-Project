"""AstroBot chat routes and opt-in public post/comment replies."""
from __future__ import annotations

import logging
import re

from flask import Blueprint, jsonify, request

from . import service, storage
from api.aiService.ai_service import AstroBotError

logger = logging.getLogger(__name__)
astrobot_bp = Blueprint("astrobot", __name__)
COMMENT_CREATE = re.compile(r"^/api/posts/(\d+)/comments/?$")


def error_json(message: str, status: int):
    response = jsonify({"error": message})
    response.status_code = status
    return response


def chat_request():
    """Rate-limited public POST /api/ai/chat endpoint."""
    if request.method != "POST":
        return error_json("Method not allowed", 405)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error_json("Expected a JSON request object", 400)
    message = data.get("message")
    if not isinstance(message, str) or not message.strip():
        return error_json("A non-empty message is required", 400)
    if len(message) > 1600:
        return error_json("Message must be at most 1600 characters", 400)
    try:
        storage.enforce_quota(storage.public_client_key(request))
    except storage.LimitReached as exc:
        response = error_json(exc.public_message, 429)
        response.headers["Retry-After"] = str(exc.retry_after)
        return response
    except Exception:
        logger.exception("AstroBot request limiter unavailable")
        return error_json("AstroBot is temporarily unavailable", 503)
    try:
        answer = service.generate_reply(message)
        return jsonify({"sender": "AstroBot", "is_ai": True, "response": answer})
    except AstroBotError as exc:
        response = jsonify(error=str(exc), code=exc.code)
        response.status_code = exc.status
        if exc.retry_after:
            response.headers["Retry-After"] = str(exc.retry_after)
        return response
    except RuntimeError as exc:
        if "not configured" in str(exc):
            logger.error("Gemini credentials are not configured")
            return error_json("AstroBot is not configured", 503)
        logger.exception("AstroBot generation failed")
        return error_json("AstroBot could not answer right now", 502)
    except Exception:
        logger.exception("AstroBot Gemini request failed")
        return error_json("AstroBot could not answer right now", 502)


@astrobot_bp.get("/api/ai/mentions/<kind>/<int:source_id>")
def get_mention_status(kind: str, source_id: int):
    if kind not in ("post", "comment"):
        return error_json("Unknown mention type", 404)
    try:
        status = storage.mention_status(kind, source_id)
    except Exception:
        logger.exception("Could not read bot mention status")
        return error_json("Status unavailable", 503)
    if status is None:
        return jsonify({"status": "not_triggered", "bot_comment_id": None})
    return jsonify({"status": status[0], "bot_comment_id": status[1]})


def _created_id(response_json: dict | None, kind: str):
    """Handle common API response shapes, without guessing DB row IDs."""
    if not isinstance(response_json, dict):
        return None
    key = "post" if kind == "post" else "comment"
    objects = [response_json]
    for nested_key in (key, "data"):
        nested = response_json.get(nested_key)
        if isinstance(nested, dict):
            objects.append(nested)
    keys = [f"{key}_id", "id"]
    for obj in objects:
        for name in keys:
            value = obj.get(name)
            if isinstance(value, int) and not isinstance(value, bool) and value > 0:
                return value
            if isinstance(value, str) and value.isdecimal() and int(value) > 0:
                return int(value)
    return None


def generate_mention(kind: str, source_id: int, client_key: str) -> str:
    """Synchronous MVP trigger. Failures never undo the human's saved content.

    For production scale, replace this with a reliable DB queue/worker; don't
    spawn a background thread in Gunicorn's request process.
    """
    original = storage.fetch_source(kind, source_id)
    if not original:
        return "skipped"
    mention_texts = (
        (original.get("title"), original.get("body"))
        if kind == "post" else (original.get("body"),)
    )
    if not service.is_mentioned(*mention_texts):
        return "skipped"
    if not storage.reserve_mention(kind, source_id):
        return "duplicate"
    try:
        storage.enforce_quota(client_key, is_mention=True)
    except storage.LimitReached:
        storage.fail_mention(kind, source_id, rate_limited=True)
        return "rate_limited"
    except Exception:
        logger.exception("AstroBot mention limiter unavailable")
        storage.fail_mention(kind, source_id)
        return "failed"
    try:
        post_id = original["post_id"]
        thread = storage.discussion_context(post_id)
        heading = f"Post title: {original['title']}\n"
        if kind == "comment":
            heading += f"Original post: {original['post_body'][:850]}\n"
        context = heading + f"Recent discussion:\n{thread}"
        message = f"{original['author']} says: {original['body']}"
        reply = "🤖 AstroBot (AI-generated): " + service.generate_reply(message, context=context)
        storage.complete_mention(
            kind, source_id, reply, post_id=post_id,
            parent_comment_id=(source_id if kind == "comment" else None),
        )
        return "completed"
    except Exception:
        logger.exception("AstroBot failed to respond to %s %s", kind, source_id)
        try:
            storage.fail_mention(kind, source_id)
        except Exception:
            logger.exception("Could not record AstroBot failure")
        return "failed"


def install_astrobot(app, *, register_chat=True):
    """Register AstroBot on the EXISTING Flask application (keeps app:app)."""
    if "astrobot" in app.blueprints:
        return
    app.register_blueprint(astrobot_bp)
    if register_chat:
        app.add_url_rule("/api/ai/chat", "astrobot_chat", chat_request, methods=["POST"])

    @app.after_request
    def astrobot_handle_created_mentions(response):
        if request.method != "POST" or not 200 <= response.status_code < 300:
            return response
        path = request.path.rstrip("/")
        kind = None
        if path == "/api/posts":
            kind = "post"
        elif COMMENT_CREATE.fullmatch(path):
            kind = "comment"
        if kind is None:
            return response
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return response
        # Only trigger for explicitly opted-in, human-authored content.
        if kind == "post":
            mentioning = service.is_mentioned(body.get("title"), body.get("body"))
        else:
            mentioning = service.is_mentioned(body.get("body"))
        if not mentioning:
            return response
        source_id = _created_id(response.get_json(silent=True), kind)
        if source_id is None:
            logger.warning("AstroBot mention not triggered: create-%s JSON has no ID", kind)
            response.headers["X-AstroBot-Status"] = "missing_id"
            return response
        try:
            result = generate_mention(kind, source_id, storage.public_client_key(request))
            response.headers["X-AstroBot-Status"] = result
        except Exception:
            logger.exception("AstroBot mention integration failed")
            response.headers["X-AstroBot-Status"] = "failed"
        return response
