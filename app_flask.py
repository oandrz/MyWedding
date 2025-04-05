# app_flask.py
"""
Main entry point for the wedding e-invitation Flask application.

This file initializes the Flask app and registers all routes.
"""

from flask import Flask
from flask_cors import CORS
from app_modules.routes import (
    register_rsvp_routes,
    register_message_routes,
    register_static_routes
)

def create_app() -> Flask:
    """
    Create and configure the Flask application.
    
    Returns:
        A configured Flask application instance
    """
    # Initialize Flask app
    app = Flask(__name__, static_folder='client/dist', static_url_path='/')
    
    # Configure CORS to allow requests from the frontend
    CORS(app)
    
    # Register route handlers
    register_rsvp_routes(app)
    register_message_routes(app)
    register_static_routes(app)
    
    return app


# Create the Flask app
app = create_app()


if __name__ == '__main__':
    # Run the app if executed directly
    app.run(host='0.0.0.0', port=5001, debug=True)