import os
from functools import lru_cache
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from google import genai
from google.genai import types

from api.auth.routes import auth
from api.comments.routes import comments
from api.posts.routes import posts
from api.subreddits.routes import subreddits
from api.users.routes import users
from api.health import health_bp

# Load environment variables for local development.
load_dotenv()

# Initialize Flask.
app = Flask(__name__)

# Configure Flask's secret key.
app.config["SECRET_KEY"] = os.environ["SECRET_KEY"]

# Initialize AI only when it is used, so its configuration cannot block other routes.
@lru_cache(maxsize=1)
def get_ai_client():
    return genai.Client()

def ask_space_bot(user_message: str) -> str:
    """
    Sends a prompt to Gemini with system instructions to enforce a space theme.
    """
    system_instruction = (
        "You are 'AstroBot', an AI communications officer aboard an interstellar orbital station. "
        "You must respond to every prompt using space-themed terminology, cosmic metaphors, "
        "and sci-fi flair (e.g., addressing users as 'Earthling', referring to data as 'telemetry', "
        "and formatting your sign-offs like 'End transmission'). Keep the core answers accurate "
        "while maintaining this immersive persona."
    )

    try:
        response = get_ai_client().models.generate_content(
            model="gemini-2.5-flash",
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
            ),
        )
        return response.text
    except Exception as e:
        return f"Warning: Communications link failure to orbital array. Error: {str(e)}"

@app.route('/api/ai/chat', methods=['POST'])
def chat_with_spacebot():
    data = request.get_json() or {}
    user_message = data.get('message', '')
    
    if not user_message:
        return jsonify({"error": "No telemetry payload (message) provided."}), 400

    bot_response = ask_space_bot(user_message)
    
    return jsonify({
        "sender": "AstroBot",
        "response": bot_response
    })
# -----------------------

# Register all other API endpoints.
app.register_blueprint(health_bp)
app.register_blueprint(auth)
app.register_blueprint(users)
app.register_blueprint(subreddits)
app.register_blueprint(posts)
app.register_blueprint(comments)


if __name__ == "__main__":
    # Local development server only.
    # Render uses Gunicorn instead.
    app.run(debug=True)
