import os
from flask import Flask, jsonify
from dotenv import load_dotenv

from api.auth.routes import auth
from api.comments.routes import comments
from api.posts.routes import posts
from api.subreddits.routes import subreddits
from api.users.routes import users
from api.health import health_bp
from api.aiService.routes import ai_bp
from api.astrobot.routes import install_astrobot

# Load environment variables for local development.
load_dotenv()

# Initialize Flask.
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 128 * 1024

# Configure Flask's secret key.
app.config["SECRET_KEY"] = os.environ["SECRET_KEY"]


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify(error="Request body must be at most 128 KiB"), 413


# Register API modules. Keep the endpoint /api/ai/chat unchanged.
app.register_blueprint(health_bp)
app.register_blueprint(auth)
app.register_blueprint(users)
app.register_blueprint(subreddits)
app.register_blueprint(posts)
app.register_blueprint(comments)
app.register_blueprint(ai_bp)
install_astrobot(app, register_chat=False)


if __name__ == "__main__":
    # Local development server only. Render uses Gunicorn app:app.
    app.run(debug=True)
