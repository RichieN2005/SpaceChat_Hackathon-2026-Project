from flask import Blueprint, g, jsonify
from api.common import database_cursor, error, json_object, login_required, valid_id

votes = Blueprint("votes", __name__, url_prefix="/api")


def record_vote(kind, target_id):
    value = json_object().get("value")
    if type(value) is not int or value not in (-1, 0, 1):
        return error("value must be -1, 0, or 1", 400)
    if not valid_id(target_id):
        return error("Not found", 404)
    # Table and column names come only from the two fixed route handlers.
    table, column = ("post_votes", "post_id") if kind == "posts" else ("comment_votes", "comment_id")
    with database_cursor() as cursor:
        cursor.execute(f"SELECT id FROM public.{kind} WHERE id=%s FOR UPDATE", (target_id,))
        if cursor.fetchone() is None:
            return error("Not found", 404)
        if value == 0:
            cursor.execute(f"DELETE FROM public.{table} WHERE {column}=%s AND user_id=%s", (target_id, g.user_id))
        else:
            cursor.execute(f"""INSERT INTO public.{table} ({column}, user_id, value) VALUES (%s,%s,%s)
                ON CONFLICT ({column}, user_id) DO UPDATE SET value=EXCLUDED.value""", (target_id, g.user_id, value))
        cursor.execute(f"""SELECT count(*) FILTER (WHERE value=1) AS upvotes,
            count(*) FILTER (WHERE value=-1) AS downvotes, COALESCE(sum(value),0) AS score
            FROM public.{table} WHERE {column}=%s""", (target_id,))
        result = cursor.fetchone()
    return jsonify(**result, user_vote=value)


@votes.put("/posts/<int:target_id>/vote")
@login_required
def vote_post(target_id):
    return record_vote("posts", target_id)


@votes.put("/comments/<int:target_id>/vote")
@login_required
def vote_comment(target_id):
    return record_vote("comments", target_id)
