from flask import Blueprint, g, jsonify, request
from psycopg.errors import ForeignKeyViolation, UndefinedTable

from api.common import database_cursor, error, json_object, login_required, pagination, search_pattern, serialize, social_unavailable, text_field, valid_id, viewer_id

posts = Blueprint("posts", __name__, url_prefix="/api/posts")

SCORE_SELECT = "(SELECT COALESCE(SUM(pv.value), 0) FROM public.post_votes AS pv WHERE pv.post_id = p.id) AS score"
POST_READ_QUERY = """
    SELECT p.id, p.author_id, p.subreddit_id, p.title, p.body, p.created_at,
           u.username AS author_username, s.name AS subreddit_name,
           (SELECT COUNT(*) FROM public.comments AS pc WHERE pc.post_id = p.id) AS comment_count,
           """ + SCORE_SELECT + """
    FROM public.posts AS p
    LEFT JOIN public.users AS u ON u.id = p.author_id
    LEFT JOIN public.subreddits AS s ON s.id = p.subreddit_id
"""


@posts.after_request
def prevent_personalized_caching(response):
    response.headers["Cache-Control"] = "no-store"
    return response


def read_posts(query, parameters, single=False):
    def fetch(cursor):
        cursor.execute(query, parameters)
        if single:
            row = cursor.fetchone()
            return [row] if row is not None else []
        return cursor.fetchall()

    try:
        with database_cursor() as cursor:
            rows = fetch(cursor)
            for row in rows:
                row.setdefault("score", 0)
                row["user_vote"] = 0
            current_user = viewer_id()
            if current_user is not None and rows:
                cursor.execute(
                    "SELECT post_id, value FROM public.post_votes WHERE user_id = %s AND post_id = ANY(%s)",
                    (current_user, [row["id"] for row in rows]),
                )
                votes = {vote["post_id"]: vote["value"] for vote in cursor.fetchall()}
                for row in rows:
                    row["user_vote"] = votes.get(row["id"], 0)
    except UndefinedTable:
        # Keep existing public content available until the additive migration is applied.
        query = query.replace(SCORE_SELECT, "0::bigint AS score")
        with database_cursor() as cursor:
            rows = fetch(cursor)
        for row in rows:
            row.setdefault("score", 0)
            row["user_vote"] = 0
    return rows


@posts.get("")
def list_posts():
    subreddit_id = None
    if "subreddit_id" in request.args:
        subreddit_id = request.args.get("subreddit_id", type=int)
        if not valid_id(subreddit_id):
            return error("subreddit_id must be a positive integer", 400)

    author_id = None
    if "author_id" in request.args:
        author_id = request.args.get("author_id", type=int)
        if not valid_id(author_id):
            return error("author_id must be a positive integer", 400)

    page, page_error = pagination()
    if page_error:
        return page_error
    limit, offset = page

    search = request.args.get("q", "").strip()
    if len(search) > 200:
        return error("q must be at most 200 characters", 400)

    sort = request.args.get("sort", "new")
    orders = {
        "new": "p.created_at DESC, p.id DESC",
        "discussed": "comment_count DESC, p.created_at DESC, p.id DESC",
        "top": "score DESC, p.created_at DESC, p.id DESC",
    }
    if sort not in orders:
        return error("sort must be new, discussed, or top", 400)

    query = POST_READ_QUERY
    conditions = []
    params = []
    if subreddit_id is not None:
        conditions.append("p.subreddit_id = %s")
        params.append(subreddit_id)
    if author_id is not None:
        conditions.append("p.author_id = %s")
        params.append(author_id)
    if search:
        # Treat LIKE wildcards as ordinary search text, and bind all user input.
        pattern = search_pattern(search)
        conditions.append("(p.title ILIKE %s OR p.body ILIKE %s)")
        params.extend((pattern, pattern))
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += f" ORDER BY {orders[sort]} LIMIT %s OFFSET %s"
    params.extend((limit, offset))

    rows = read_posts(query, tuple(params))
    return jsonify([serialize(row) for row in rows])


@posts.post("")
@login_required
def create_post():
    data = json_object()
    subreddit_id = data.get("subreddit_id")
    title = text_field(data.get("title"))
    body = data.get("body")

    if not title:
        return error("Title is required", 400)
    if len(title) > 300:
        return error("Title must be at most 300 characters", 400)
    if not isinstance(body, str) or not body.strip():
        return error("Body is required", 400)
    if len(body) > 20000:
        return error("Body must be at most 20000 characters", 400)
    if not valid_id(subreddit_id):
        return error("subreddit_id must be a positive integer", 400)

    try:
        with database_cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO public.posts (author_id, subreddit_id, title, body)
                VALUES (%s, %s, %s, %s)
                RETURNING id, author_id, subreddit_id, title, body, created_at
                """,
                (g.user_id, subreddit_id, title, body),
            )
            post = cursor.fetchone()
    except ForeignKeyViolation as exc:
        if exc.diag.constraint_name == "posts_author_id_fkey":
            return error("Login required", 401)
        return error("Subreddit not found", 404)

    return jsonify(serialize(post)), 201


@posts.get("/<int:post_id>")
def get_post(post_id):
    if not valid_id(post_id):
        return error("Post not found", 404)

    rows = read_posts(POST_READ_QUERY + " WHERE p.id = %s", (post_id,), single=True)
    post = rows[0] if rows else None

    if post is None:
        return error("Post not found", 404)
    return jsonify(serialize(post))


@posts.patch("/<int:post_id>")
@login_required
def update_post(post_id):
    if not valid_id(post_id):
        return error("Post not found", 404)
    data = json_object()
    if "title" not in data and "body" not in data:
        return error("Provide a title or body to update", 400)
    title = text_field(data.get("title")) if "title" in data else None
    body = data.get("body")
    if "title" in data and (not title or len(title) > 300):
        return error("Title must contain 1 to 300 characters", 400)
    if "body" in data and (not isinstance(body, str) or not body.strip() or len(body) > 20000):
        return error("Body must contain 1 to 20000 characters", 400)

    with database_cursor() as cursor:
        cursor.execute("SELECT author_id, title, body FROM public.posts WHERE id = %s FOR UPDATE", (post_id,))
        existing = cursor.fetchone()
        if existing is None:
            return error("Post not found", 404)
        if existing["author_id"] != g.user_id:
            return error("Forbidden", 403)
        cursor.execute(
            """UPDATE public.posts SET title = %s, body = %s WHERE id = %s
               RETURNING id, author_id, subreddit_id, title, body, created_at""",
            (title if "title" in data else existing["title"], body if "body" in data else existing["body"], post_id),
        )
        post = cursor.fetchone()
    return jsonify(serialize(post))


@posts.put("/<int:post_id>/vote")
@login_required
def vote_post(post_id):
    if not valid_id(post_id):
        return error("Post not found", 404)
    value = json_object().get("value")
    if type(value) is not int or value not in (-1, 0, 1):
        return error("value must be -1, 0, or 1", 400)
    try:
        with database_cursor() as cursor:
            cursor.execute("SELECT id FROM public.posts WHERE id = %s FOR UPDATE", (post_id,))
            if cursor.fetchone() is None:
                return error("Post not found", 404)
            if value == 0:
                cursor.execute("DELETE FROM public.post_votes WHERE user_id = %s AND post_id = %s", (g.user_id, post_id))
            else:
                cursor.execute(
                    """INSERT INTO public.post_votes (user_id, post_id, value) VALUES (%s, %s, %s)
                       ON CONFLICT (user_id, post_id) DO UPDATE SET value = EXCLUDED.value""",
                    (g.user_id, post_id, value),
                )
            cursor.execute(
                """SELECT COALESCE(SUM(value), 0) AS score,
                          COALESCE(MAX(value) FILTER (WHERE user_id = %s), 0) AS user_vote
                   FROM public.post_votes WHERE post_id = %s""",
                (g.user_id, post_id),
            )
            result = cursor.fetchone()
    except UndefinedTable:
        return social_unavailable("Voting")
    except ForeignKeyViolation:
        return error("Login required", 401)
    return jsonify(score=result["score"], user_vote=result["user_vote"])


@posts.delete("/<int:post_id>")
@login_required
def delete_post(post_id):
    if not valid_id(post_id):
        return error("Post not found", 404)

    try:
        with database_cursor() as cursor:
            cursor.execute(
                "SELECT author_id FROM public.posts WHERE id = %s FOR UPDATE",
                (post_id,),
            )
            post = cursor.fetchone()
            if post is None:
                return error("Post not found", 404)
            if post["author_id"] != g.user_id:
                return error("Forbidden", 403)
            cursor.execute("DELETE FROM public.comments WHERE post_id = %s", (post_id,))
            cursor.execute("DELETE FROM public.posts WHERE id = %s", (post_id,))
    except ForeignKeyViolation:
        return error("Post is still referenced by another record", 409)

    return "", 204
