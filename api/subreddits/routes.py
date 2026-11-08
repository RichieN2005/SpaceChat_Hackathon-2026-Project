from flask import Blueprint, g, jsonify, request
from psycopg.errors import ForeignKeyViolation, UndefinedTable, UniqueViolation

from api.common import database_cursor, error, json_object, login_required, search_pattern, serialize, social_unavailable, text_field, valid_id, viewer_id

subreddits = Blueprint("subreddits", __name__, url_prefix="/api/subreddits")

MEMBER_SELECT = "(SELECT COUNT(*) FROM public.community_memberships AS cm WHERE cm.subreddit_id = s.id) AS member_count"
COMMUNITY_READ_QUERY = """
    SELECT s.id, s.name, s.description, s.created_at,
           (SELECT COUNT(*) FROM public.posts AS p WHERE p.subreddit_id = s.id) AS post_count,
           """ + MEMBER_SELECT + """
    FROM public.subreddits AS s
"""


@subreddits.after_request
def prevent_personalized_caching(response):
    response.headers["Cache-Control"] = "no-store"
    return response


def read_communities(query, parameters, single=False):
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
                row.setdefault("post_count", 0)
                row.setdefault("member_count", 0)
                row["is_member"] = False
            current_user = viewer_id()
            if current_user is not None and rows:
                cursor.execute(
                    "SELECT subreddit_id FROM public.community_memberships WHERE user_id = %s AND subreddit_id = ANY(%s)",
                    (current_user, [row["id"] for row in rows]),
                )
                joined = {row["subreddit_id"] for row in cursor.fetchall()}
                for row in rows:
                    row["is_member"] = row["id"] in joined
    except UndefinedTable:
        query = query.replace(MEMBER_SELECT, "0::bigint AS member_count")
        with database_cursor() as cursor:
            rows = fetch(cursor)
        for row in rows:
            row.setdefault("post_count", 0)
            row.setdefault("member_count", 0)
            row["is_member"] = False
    return rows


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

    search = request.args.get("q", "").strip()
    if len(search) > 200:
        return error("q must be at most 200 characters", 400)
    query = COMMUNITY_READ_QUERY
    parameters = []
    if search:
        query += " WHERE (s.name ILIKE %s OR s.description ILIKE %s)"
        pattern = search_pattern(search)
        parameters.extend((pattern, pattern))
    query += " ORDER BY " + ("post_count DESC, s.id ASC" if sort == "popular" else "s.id ASC")
    if limit is not None:
        query += " LIMIT %s"
        parameters.append(limit)
    rows = read_communities(query, tuple(parameters))
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

    rows = read_communities(COMMUNITY_READ_QUERY + " WHERE s.id = %s", (subreddit_id,), single=True)
    subreddit = rows[0] if rows else None

    if subreddit is None:
        return error("Subreddit not found", 404)
    return jsonify(serialize(subreddit))


@subreddits.put("/<int:subreddit_id>/membership")
@login_required
def update_membership(subreddit_id):
    if not valid_id(subreddit_id):
        return error("Subreddit not found", 404)
    joined = json_object().get("joined")
    if type(joined) is not bool:
        return error("joined must be a boolean", 400)
    try:
        with database_cursor() as cursor:
            cursor.execute("SELECT id FROM public.subreddits WHERE id = %s FOR UPDATE", (subreddit_id,))
            if cursor.fetchone() is None:
                return error("Subreddit not found", 404)
            if joined:
                cursor.execute(
                    """INSERT INTO public.community_memberships (user_id, subreddit_id) VALUES (%s, %s)
                       ON CONFLICT (user_id, subreddit_id) DO NOTHING""",
                    (g.user_id, subreddit_id),
                )
            else:
                cursor.execute(
                    "DELETE FROM public.community_memberships WHERE user_id = %s AND subreddit_id = %s",
                    (g.user_id, subreddit_id),
                )
            cursor.execute("SELECT COUNT(*) AS member_count FROM public.community_memberships WHERE subreddit_id = %s", (subreddit_id,))
            count = cursor.fetchone()["member_count"]
    except UndefinedTable:
        return social_unavailable("Community membership")
    except ForeignKeyViolation:
        return error("Login required", 401)
    return jsonify(joined=joined, member_count=count)
