# app_modules/repositories/__init__.py
"""
Repository interfaces and implementations for the wedding e-invitation application.
"""

# Re-export all repository interfaces and implementations for easier imports
from app_modules.repositories.interfaces import (
    IUserRepository,
    IRsvpRepository,
    IMessageRepository
)

from app_modules.repositories.memory_repositories import (
    MemoryUserRepository,
    MemoryRsvpRepository,
    MemoryMessageRepository
)