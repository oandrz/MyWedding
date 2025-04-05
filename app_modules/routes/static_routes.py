# app_modules/routes/static_routes.py
"""
Static file route handlers for the wedding e-invitation application.
"""

import os
from flask import Flask, send_from_directory


def register_static_routes(app: Flask) -> None:
    """
    Register static file routes with the Flask app.
    
    Args:
        app: The Flask application instance
    """
    
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        """Serve static files and the frontend SPA."""
        if path != "" and os.path.exists(app.static_folder + '/' + path):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')