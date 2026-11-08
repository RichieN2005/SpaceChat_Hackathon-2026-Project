import os
from flask import Flask
from dotenv import load_dotenv

# Import the Blueprints containing our API routes.
from api.health import health_bp

# Load environment variables for local development.
load_dotenv()

# Initialize Flask.
app = Flask(__name__)

# Configure Flask's secret key.
app.config["SECRET_KEY"] = os.environ["SECRET_KEY"]

# Register all API endpoints.
app.register_blueprint(health_bp)


if __name__ == "__main__":
    # Local development server only.
    # Render uses Gunicorn instead.
    app.run(debug=True)
