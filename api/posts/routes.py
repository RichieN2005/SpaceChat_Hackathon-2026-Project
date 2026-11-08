from flask import Blueprint, g, jsonify, request
from psycopg.errors import ForeignKeyViolation

from api.common import database_cursor, error, json_object, login_required, serialize, text_field, valid_id

posts = Blueprint("posts", __name__, url_prefix="/api/posts")


@posts.get("")
def list_posts():
    subreddit_id = None
    if "subreddit_id" in request.args:
        subreddit_id = request.args.get("subreddit_id", type=int)
        if not valid_id(subreddit_id):
            return error("subreddit_id must be a positive integer", 400)

    query = "SELECT id, author_id, subreddit_id, title, body, created_at FROM public.posts"
    params = ()
    if subreddit_id is not None:
        query += " WHERE subreddit_id = %s"
        params = (subreddit_id,)
    query += " ORDER BY created_at DESC, id DESC"

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
        cursor.execute(
            """
            SELECT id, author_id, subreddit_id, title, body, created_at
            FROM public.posts
            WHERE id = %s
            """,
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
