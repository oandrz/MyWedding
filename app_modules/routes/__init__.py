# app_modules/routes/__init__.py
"""
Route handlers for the wedding e-invitation application.

These handlers process HTTP requests, interact with services,
and return appropriate HTTP responses.
"""

# Re-export route registration functions for easier imports
from app_modules.routes.rsvp_routes import register_rsvp_routes
from app_modules.routes.message_routes import register_message_routes
from app_modules.routes.static_routes import register_static_routes