from flask import Blueprint, g, jsonify, session
from psycopg.errors import UniqueViolation
from werkzeug.security import check_password_hash, generate_password_hash

from api.common import database_cursor, error, json_object, login_required, serialize, text_field

auth = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth.after_request
def prevent_auth_response_caching(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@auth.post("/register")
def register():
    data = json_object()
    username = text_field(data.get("username"))
    email = text_field(data.get("email")).lower()
    password = data.get("password")

    if not username or "@" in username:
        return error("Username is required and cannot contain @", 400)

    local_part, separator, domain = email.partition("@")
    if not (local_part and separator and domain) or "@" in domain or any(
        character.isspace() for character in email
    ):
        return error("A valid email address is required", 400)

    if not isinstance(password, str) or len(password) < 8:
        return error("Password must be at least 8 characters", 400)

    password_hash = generate_password_hash(password)
    try:
        with database_cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO public.users (username, email, password_hash)
                VALUES (%s, %s, %s)
                RETURNING id, username, bio, created_at, updated_at
                """,
                (username, email, password_hash),
            )
            user = cursor.fetchone()
    except UniqueViolation:
        return error("Username or email already exists", 409)

    return jsonify(serialize(user)), 201


@auth.post("/login")
def login():
    data = json_object()
    identifier = text_field(data.get("identifier"))
    password = data.get("password")
    if not identifier or not isinstance(password, str) or not password:
        return error("Identifier and password are required", 400)

    with database_cursor() as cursor:
        cursor.execute(
            """
            SELECT id, username, bio, created_at, updated_at, password_hash
            FROM public.users
            WHERE username = %s OR email = %s
            """,
            (identifier, identifier.lower()),
        )
        matches = cursor.fetchmany(2)

    # Refuse an ambiguous match if an older username is another account's email.
    if len(matches) != 1:
        return error("Invalid credentials", 401)

    user = matches[0]
    if not check_password_hash(user.pop("password_hash"), password):
        return error("Invalid credentials", 401)

    session.clear()
    session["user_id"] = user["id"]
    return jsonify(user=serialize(user))


@auth.get("/me")
@login_required
def current_user():
    with database_cursor() as cursor:
        cursor.execute(
            """
            SELECT id, username, bio, created_at, updated_at
            FROM public.users
            WHERE id = %s
            """,
            (g.user_id,),
        )
        user = cursor.fetchone()

    if user is None:
        session.clear()
        return error("Login required", 401)

    return jsonify(user=serialize(user))


@auth.post("/logout")
def logout():
    session.clear()
    return jsonify(message="Logged out")
