from flask import Blueprint, g, jsonify, request
from psycopg.errors import ForeignKeyViolation

from api.common import database_cursor, error, json_object, login_required, serialize, text_field, valid_id

posts = Blueprint("posts", __name__, url_prefix="/api/posts")

POST_READ_QUERY = """
    SELECT p.id, p.author_id, p.subreddit_id, p.title, p.body, p.created_at,
           u.username AS author_username, s.name AS subreddit_name,
           (SELECT COUNT(*) FROM public.comments AS pc WHERE pc.post_id = p.id) AS comment_count
    FROM public.posts AS p
    LEFT JOIN public.users AS u ON u.id = p.author_id
    LEFT JOIN public.subreddits AS s ON s.id = p.subreddit_id
"""


@posts.get("")
def list_posts():
    subreddit_id = None
    if "subreddit_id" in request.args:
        subreddit_id = request.args.get("subreddit_id", type=int)
        if not valid_id(subreddit_id):
            return error("subreddit_id must be a positive integer", 400)

    try:
        limit = int(request.args.get("limit", "20"))
    except ValueError:
        return error("limit must be a positive integer", 400)
    if limit < 1:
        return error("limit must be a positive integer", 400)
    limit = min(limit, 50)

    try:
        offset = int(request.args.get("offset", "0"))
    except ValueError:
        return error("offset must be an integer between 0 and 100000", 400)
    if not 0 <= offset <= 100000:
        return error("offset must be an integer between 0 and 100000", 400)

    search = request.args.get("q", "").strip()
    if len(search) > 200:
        return error("q must be at most 200 characters", 400)

    sort = request.args.get("sort", "new")
    orders = {
        "new": "p.created_at DESC, p.id DESC",
        "discussed": "comment_count DESC, p.created_at DESC, p.id DESC",
    }
    if sort not in orders:
        return error("sort must be new or discussed", 400)

    query = POST_READ_QUERY
    conditions = []
    params = []
    if subreddit_id is not None:
        conditions.append("p.subreddit_id = %s")
        params.append(subreddit_id)
    if search:
        # Treat LIKE wildcards as ordinary search text, and bind all user input.
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        conditions.append("(p.title ILIKE %s OR p.body ILIKE %s)")
        params.extend((pattern, pattern))
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += f" ORDER BY {orders[sort]} LIMIT %s OFFSET %s"
    params.extend((limit, offset))

    with database_cursor() as cursor:
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
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
    if not isinstance(body, str) or not body.strip():
        return error("Body is required", 400)
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

    with database_cursor() as cursor:
        cursor.execute(
            POST_READ_QUERY + " WHERE p.id = %s",
            (post_id,),
        )
        post = cursor.fetchone()

    if post is None:
        return error("Post not found", 404)
    return jsonify(serialize(post))


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
            cursor.execute("DELETE FROM public.posts WHERE id = %s", (post_id,))
    except ForeignKeyViolation:
        return error("Cannot delete a post that still has comments", 409)

    return "", 204
