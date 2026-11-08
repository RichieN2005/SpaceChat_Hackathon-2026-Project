from flask import Blueprint, g, jsonify, request, session
from psycopg.errors import ForeignKeyViolation

from api.common import database_cursor, error, json_object, login_required, serialize, text_field, valid_id

posts = Blueprint("posts", __name__, url_prefix="/api/posts")



# Aggregate independently to avoid multiplying votes by the number of comments.
POST_SELECT = """
SELECT p.*, u.username AS author,
       (SELECT count(*) FROM public.post_votes WHERE post_id=p.id AND value=1) AS upvotes,
       (SELECT count(*) FROM public.post_votes WHERE post_id=p.id AND value=-1) AS downvotes,
       COALESCE((SELECT sum(value) FROM public.post_votes WHERE post_id=p.id), 0) AS score,
       COALESCE((SELECT value FROM public.post_votes WHERE post_id=p.id AND user_id=%s), 0) AS user_vote,
       (SELECT count(*) FROM public.comments WHERE post_id=p.id) AS comment_count
FROM public.posts p JOIN public.users u ON u.id=p.author_id
"""

@posts.get("")
def list_posts():
    subreddit_id = None
    if "subreddit_id" in request.args:
        subreddit_id = request.args.get("subreddit_id", type=int)
        if not valid_id(subreddit_id):
            return error("subreddit_id must be a positive integer", 400)

    sort = request.args.get("sort", "newest")
    ordering = {
        "newest": "p.created_at DESC, p.id DESC",
        "top": "score DESC, p.created_at DESC, p.id DESC",
        "discussed": "comment_count DESC, p.created_at DESC, p.id DESC",
    }
    if sort not in ordering:
        return error("sort must be newest, top, or discussed", 400)
    query = POST_SELECT
    params = (session.get("user_id"),)
    if subreddit_id is not None:
        query += " WHERE p.subreddit_id = %s"
        params += (subreddit_id,)
    query += " ORDER BY " + ordering[sort]

    with database_cursor() as cursor:
        cursor.execute(query, params)
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
        cursor.execute(POST_SELECT + " WHERE p.id = %s", (session.get("user_id"), post_id))
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
