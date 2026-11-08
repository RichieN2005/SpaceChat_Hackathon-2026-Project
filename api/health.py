from flask import Blueprint, jsonify, current_app
from api.database import get_db_connection

# Group all health-related endpoints under /api.
health_bp = Blueprint(
    "health",
    __name__,
    url_prefix="/api"
)


@health_bp.route("/health", methods=["GET"])
def health_check():
    """
    Verify that the Flask application is responding.

    Used by Render monitoring and GitHub Actions.
    Does not require a database connection.
    """
    return jsonify({
        "status": "ok",
        "message": "Flask is running"
    }), 200


@health_bp.route("/db-health", methods=["GET"])
def database_health():
    """
    Verify connectivity to TigerData PostgreSQL.

    Executes SELECT 1 to test database communication.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1;")
                result = cursor.fetchone()

        if result and result[0] == 1:
            return jsonify({
                "status": "connected",
                "database": "TigerData"
            }), 200

    except Exception:
        current_app.logger.exception(
            "Database health check failed"
        )

    return jsonify({
        "status": "error",
        "message": "Database unavailable"
    }), 503