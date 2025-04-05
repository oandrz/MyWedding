# app_modules/models/__init__.py
"""
Models package for the wedding e-invitation application.
"""

# Re-export all model classes for easier imports
from app_modules.models.rsvp import Rsvp, InsertRsvp
from app_modules.models.user import User, InsertUser
from app_modules.models.message import Message, InsertMessage