"""Authenticated AstroBot HTTP endpoint.

This is the ONLY AI chat route. Do not add a public /api/chat alias because
that would let unauthenticated visitors consume the project's Gemini quota.
"""

from flask import Blueprint, jsonify, request

from api.common import login_required
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
        bot_response = ask_space_bot(user_message)
    except AstroBotError as exc:
        return jsonify(error=str(exc), code=exc.code), exc.status

    return jsonify(sender="AstroBot", response=bot_response)
