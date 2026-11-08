from flask import Flask, jsonify
from database import get_db_connection

app = Flask(__name__)

@app.route("/api/health", methods=["GET"])
def health_check():
    """
    Check whether Flask is running.
    This endpoint is intended for local development."""
    return jsonify({
        "status": "ok",
        "message": "Flask is running"
    }), 200

@app.route("/api/db-health", methods=["GET"])
def database_health():
    """
    Check whether Flask can communicate with TigerData.

    This endpoint is intended for local development.
    """
    try:
        # Open a connection, run a query, then close
        # the connection automatically.
        with get_db_connection() as conn:
            with conn.cursor() as cursor:

                # Simple query to verify database access.
                cursor.execute("SELECT 1;")
                result = cursor.fetchone()

        if result[0] == 1:
            return jsonify({
                "status": "connected",
                "database": "TigerData"
            }), 200

    except Exception:
        # Avoid exposing database credentials or internal
        # connection details in API responses.
        app.logger.exception("Database health check failed")

        return jsonify({
            "status": "error",
            "message": "Database unavailable"
        }), 503


if __name__ == "__main__":
    app.run(debug=True)
