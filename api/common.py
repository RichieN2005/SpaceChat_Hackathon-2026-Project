from contextlib import contextmanager
from datetime import datetime
from functools import wraps

from flask import g, jsonify, request, session
from psycopg.rows import dict_row

from api.database import get_db_connection


@contextmanager
def database_cursor():
    with get_db_connection() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            yield cursor


def error(message, status):
    return jsonify(error=message), status


def json_object():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def text_field(value):
    return value.strip() if isinstance(value, str) else ""


def valid_id(value):
    return type(value) is int and 0 < value <= 2**63 - 1


def viewer_id():
    user_id = session.get("user_id")
    return user_id if valid_id(user_id) else None


def search_pattern(value):
    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def pagination(default=20, maximum=50):
    try:
        limit = int(request.args.get("limit", str(default)))
    except ValueError:
        return None, error("limit must be a positive integer", 400)
    if limit < 1:
        return None, error("limit must be a positive integer", 400)
    try:
        offset = int(request.args.get("offset", "0"))
    except ValueError:
        return None, error("offset must be an integer between 0 and 100000", 400)
    if not 0 <= offset <= 100000:
        return None, error("offset must be an integer between 0 and 100000", 400)
    return (min(limit, maximum), offset), None


def social_unavailable(feature):
    return jsonify(error=f"{feature} is temporarily unavailable", code="migration_required"), 503


def serialize(row):
    return {
        key: value.isoformat() if isinstance(value, datetime) else value
        for key, value in row.items()
    }


def login_required(route):
    @wraps(route)
    def authenticated(*args, **kwargs):
        user_id = session.get("user_id")
        if not valid_id(user_id):
            return error("Login required", 401)
        g.user_id = user_id
        return route(*args, **kwargs)

    return authenticated
