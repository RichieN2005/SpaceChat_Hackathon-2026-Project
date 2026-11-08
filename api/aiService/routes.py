"""Authenticated AstroBot HTTP endpoint.

This is the ONLY AI chat route. Do not add a public /api/chat alias because
that would let unauthenticated visitors consume the project's Gemini quota.
"""

from flask import Blueprint, jsonify, request, current_app
from psycopg.errors import UndefinedTable

from api.common import login_required
from api.astrobot import storage
from api.aiService.ai_service import AstroBotError, ask_space_bot


ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")


@ai_bp.route("/chat", methods=["POST"])
@login_required
def ai_chat():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(error="JSON body must be an object"), 400
    message = data.get("message")
    if not isinstance(message, str) or not message.strip():
        return jsonify(error="Message is required"), 400
    user_message = message.strip()
    if len(user_message) > 2000:
        return jsonify(error="Message must be at most 2000 characters"), 400

    try:
        storage.enforce_quota(storage.public_client_key(request))
    except storage.LimitReached as exc:
        response = jsonify(error=exc.public_message, code="ai_usage_limit", retry_after=exc.retry_after)
        response.headers["Retry-After"] = str(exc.retry_after)
        return response, 429
    except UndefinedTable:
        current_app.logger.error("AstroBot request limiter failed: category=migration_required")
        return jsonify(error="AstroBot is not fully set up yet. Please try again after setup is complete.", code="migration_required"), 503
    except Exception:
        current_app.logger.error("AstroBot request limiter failed: category=ai_unavailable")
        return jsonify(error="AstroBot cannot check its request limits right now. Please try again shortly.", code="ai_unavailable"), 503

    try:
        bot_response = ask_space_bot(user_message)
    except AstroBotError as exc:
        payload = {"error": str(exc), "code": exc.code}
        response = jsonify(**payload, **({"retry_after": exc.retry_after} if exc.retry_after else {}))
        response.status_code = exc.status
        if exc.retry_after:
            response.headers["Retry-After"] = str(exc.retry_after)
        return response

    return jsonify(sender="AstroBot", response=bot_response)
