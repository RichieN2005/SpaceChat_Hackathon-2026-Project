from flask import Blueprint, g, jsonify

from api.common import database_cursor, error, json_object, login_required, pagination, serialize, valid_id

users = Blueprint("users", __name__, url_prefix="/api/users")


@users.get("/<int:user_id>")
def get_user(user_id):
    if not valid_id(user_id):
        return error("User not found", 404)

    with database_cursor() as cursor:
        cursor.execute(
            """
            SELECT u.id, u.username, u.bio, u.created_at, u.updated_at,
                   (SELECT COUNT(*) FROM public.posts AS p WHERE p.author_id = u.id) AS post_count,
                   (SELECT COUNT(*) FROM public.comments AS c
                    WHERE c.author_id = u.id AND c.body <> '[deleted]') AS comment_count
            FROM public.users AS u
            WHERE u.id = %s
            """,
            (user_id,),
        )
        user = cursor.fetchone()

    if user is None:
        return error("User not found", 404)
    return jsonify(serialize(user))


@users.put("/<int:user_id>")
@login_required
def update_user(user_id):
    if not valid_id(user_id):
        return error("User not found", 404)
    if g.user_id != user_id:
        return error("Forbidden", 403)

    data = json_object()
    bio = data.get("bio")
    if "bio" not in data or (bio is not None and not isinstance(bio, str)):
        return error("Bio must be a string or null", 400)
    if isinstance(bio, str) and len(bio) > 2000:
        return error("Bio must be at most 2000 characters", 400)

    with database_cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.users
            SET bio = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, username, bio, created_at, updated_at
            """,
            (bio, user_id),
        )
        user = cursor.fetchone()

    if user is None:
        return error("User not found", 404)
    return jsonify(serialize(user))


@users.get("/<int:user_id>/comments")
def list_user_comments(user_id):
    if not valid_id(user_id):
        return error("User not found", 404)
    page, page_error = pagination()
    if page_error:
        return page_error
    limit, offset = page
    with database_cursor() as cursor:
        cursor.execute("SELECT id FROM public.users WHERE id = %s", (user_id,))
        if cursor.fetchone() is None:
            return error("User not found", 404)
        cursor.execute(
            """SELECT c.id, c.post_id, c.author_id, c.parent_comment_id, c.body, c.created_at,
                      u.username AS author_username, p.title AS post_title,
                      p.subreddit_id, s.name AS subreddit_name
               FROM public.comments AS c
               LEFT JOIN public.users AS u ON u.id = c.author_id
               JOIN public.posts AS p ON p.id = c.post_id
               LEFT JOIN public.subreddits AS s ON s.id = p.subreddit_id
               WHERE c.author_id = %s AND c.body <> '[deleted]'
               ORDER BY c.created_at DESC, c.id DESC LIMIT %s OFFSET %s""",
            (user_id, limit, offset),
        )
        rows = cursor.fetchall()
    return jsonify([serialize(row) for row in rows])
