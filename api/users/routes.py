from flask import Blueprint, g, jsonify

from api.common import database_cursor, error, json_object, login_required, serialize, valid_id

users = Blueprint("users", __name__, url_prefix="/api/users")


@users.get("/<int:user_id>")
def get_user(user_id):
    if not valid_id(user_id):
        return error("User not found", 404)

    with database_cursor() as cursor:
        cursor.execute(
            """
            SELECT id, username, bio, created_at, updated_at
            FROM public.users
            WHERE id = %s
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
    if g.user_id != user_id:
        return error("Forbidden", 403)

    data = json_object()
    bio = data.get("bio")
    if "bio" not in data or (bio is not None and not isinstance(bio, str)):
        return error("Bio must be a string or null", 400)

    with database_cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.users
            SET bio = %s
            WHERE id = %s
            RETURNING id, username, bio, created_at, updated_at
            """,
            (bio, user_id),
        )
        user = cursor.fetchone()

    if user is None:
        return error("User not found", 404)
    return jsonify(serialize(user))
