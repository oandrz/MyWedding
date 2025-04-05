# app_modules/__init__.py
"""
Base module for the wedding e-invitation application.
"""

# Re-export models for easier imports
from app_modules.models import (
    Rsvp, InsertRsvp, 
    User, InsertUser,
    Message, InsertMessage
)

# Re-export route registration functions for easier imports
from app_modules.routes.rsvp_routes import register_rsvp_routes
from app_modules.routes.message_routes import register_message_routes
from app_modules.routes.static_routes import register_static_routes

# Re-export repositories for easier imports
from app_modules.repositories.memory_repositories import (
    MemoryRsvpRepository, 
    MemoryMessageRepository,
    MemoryUserRepository
)

# Re-export services for easier imports
from app_modules.services.rsvp_service import RsvpService
from app_modules.services.message_service import MessageService

# Create instances of repositories
rsvp_repository = MemoryRsvpRepository()
message_repository = MemoryMessageRepository()
user_repository = MemoryUserRepository()

# Create instances of services
rsvp_service = RsvpService(rsvp_repository)
message_service = MessageService(message_repository)