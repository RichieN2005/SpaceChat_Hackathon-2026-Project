from flask import Blueprint, jsonify, request
from psycopg.errors import UniqueViolation

from api.common import database_cursor, error, json_object, login_required, serialize, text_field, valid_id

subreddits = Blueprint("subreddits", __name__, url_prefix="/api/subreddits")


@subreddits.get("")
def list_subreddits():
    sort = request.args.get("sort", "id")
    if sort not in ("id", "popular"):
        return error("sort must be id or popular", 400)

    limit = 6 if sort == "popular" else None
    if "limit" in request.args:
        try:
            limit = int(request.args["limit"])
        except ValueError:
            return error("limit must be a positive integer", 400)
        if limit < 1:
            return error("limit must be a positive integer", 400)
        limit = min(limit, 20)

    if sort == "popular":
        query = """
            SELECT s.id, s.name, s.description, s.created_at,
                   (SELECT COUNT(*) FROM public.posts AS p WHERE p.subreddit_id = s.id) AS post_count
            FROM public.subreddits AS s
            ORDER BY post_count DESC, s.id ASC
        """
    else:
        query = "SELECT id, name, description, created_at FROM public.subreddits ORDER BY id"
    parameters = ()
    if limit is not None:
        query += " LIMIT %s"
        parameters = (limit,)

    with database_cursor() as cursor:
        cursor.execute(query, parameters)
        rows = cursor.fetchall()
    return jsonify([serialize(row) for row in rows])


@subreddits.post("")
@login_required
def create_subreddit():
    data = json_object()
    name = text_field(data.get("name"))
    description = data.get("description")

    if not name:
        return error("Subreddit name is required", 400)
    if description is not None and not isinstance(description, str):
        return error("Description must be a string or null", 400)

    try:
        with database_cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO public.subreddits (name, description)
                VALUES (%s, %s)
                RETURNING id, name, description, created_at
                """,
                (name, description),
            )
            subreddit = cursor.fetchone()
    except UniqueViolation:
        return error("Subreddit name already exists", 409)

    return jsonify(serialize(subreddit)), 201


@subreddits.get("/<int:subreddit_id>")
def get_subreddit(subreddit_id):
    if not valid_id(subreddit_id):
        return error("Subreddit not found", 404)

    with database_cursor() as cursor:
        cursor.execute(
            "SELECT id, name, description, created_at FROM public.subreddits WHERE id = %s",
            (subreddit_id,),
        )
        subreddit = cursor.fetchone()

    if subreddit is None:
        return error("Subreddit not found", 404)
    return jsonify(serialize(subreddit))
