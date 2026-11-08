from flask import Blueprint, g, jsonify, session
from psycopg.errors import CheckViolation, ForeignKeyViolation

from api.common import database_cursor, error, json_object, login_required, serialize, valid_id

comments = Blueprint("comments", __name__, url_prefix="/api")


@comments.get("/posts/<int:post_id>/comments")
def list_comments(post_id):
    if not valid_id(post_id):
        return error("Post not found", 404)

    with database_cursor() as cursor:
        cursor.execute("SELECT id FROM public.posts WHERE id = %s FOR KEY SHARE", (post_id,))
        if cursor.fetchone() is None:
            return error("Post not found", 404)
        cursor.execute(
            """
            SELECT c.*, u.username AS author,
                (SELECT count(*) FROM public.comment_votes WHERE comment_id=c.id AND value=1) AS upvotes,
                (SELECT count(*) FROM public.comment_votes WHERE comment_id=c.id AND value=-1) AS downvotes,
                COALESCE((SELECT value FROM public.comment_votes WHERE comment_id=c.id AND user_id=%s), 0) AS user_vote
            FROM public.comments c JOIN public.users u ON u.id=c.author_id
            WHERE c.post_id = %s
            ORDER BY upvotes DESC, c.created_at DESC, c.id DESC
            """,
            (session.get("user_id"), post_id),
        )
        rows = cursor.fetchall()

    return jsonify([serialize(row) for row in rows])


@comments.post("/posts/<int:post_id>/comments")
@login_required
def create_comment(post_id):
    if not valid_id(post_id):
        return error("Post not found", 404)

    data = json_object()
    body = data.get("body")
    parent_id = data.get("parent_comment_id")
    if not isinstance(body, str) or not body.strip():
        return error("Body is required", 400)
    if parent_id is not None and not valid_id(parent_id):
        return error("parent_comment_id must be a positive integer or null", 400)

    try:
        with database_cursor() as cursor:
            cursor.execute("SELECT id FROM public.posts WHERE id = %s FOR KEY SHARE", (post_id,))
            if cursor.fetchone() is None:
                return error("Post not found", 404)

            cursor.execute(
                """
                INSERT INTO public.comments (post_id, author_id, parent_comment_id, body)
                VALUES (%s, %s, %s, %s)
                RETURNING id, post_id, author_id, parent_comment_id, body, created_at
                """,
                (post_id, g.user_id, parent_id, body),
            )
            comment = cursor.fetchone()
    except ForeignKeyViolation as exc:
        if exc.diag.constraint_name == "comments_author_id_fkey":
            return error("Login required", 401)
        return error("Parent comment must belong to this post", 400)
    except CheckViolation:
        return error("A comment cannot reply to itself", 400)

    return jsonify(serialize(comment)), 201


@comments.delete("/comments/<int:comment_id>")
@login_required
def delete_comment(comment_id):
    if not valid_id(comment_id):
        return error("Comment not found", 404)

    try:
        with database_cursor() as cursor:
            cursor.execute(
                "SELECT author_id FROM public.comments WHERE id = %s FOR UPDATE",
                (comment_id,),
            )
            comment = cursor.fetchone()
            if comment is None:
                return error("Comment not found", 404)
            if comment["author_id"] != g.user_id:
                return error("Forbidden", 403)
            cursor.execute("DELETE FROM public.comments WHERE id = %s", (comment_id,))
    except ForeignKeyViolation:
        return error("Cannot delete a comment that still has replies", 409)

    return "", 204
