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
