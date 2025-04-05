# app_modules/services/__init__.py
"""
Service layer for the wedding e-invitation application.

The service layer contains business logic and orchestrates interactions
between repositories and the application's routes.
"""

# Re-export service classes for easier imports
from app_modules.services.rsvp_service import RsvpService
from app_modules.services.message_service import MessageService

# Import repository implementations
from app_modules.repositories.memory_repositories import (
    MemoryRsvpRepository,
    MemoryMessageRepository
)

# Create service instances for use throughout the application
rsvp_service = RsvpService(MemoryRsvpRepository())
message_service = MessageService(MemoryMessageRepository())