# app_modules/repositories/interfaces.py
"""
Repository interfaces for the wedding e-invitation application.

These interfaces define the contract that any repository implementation
must fulfill to interact with the application's data models.
"""

from abc import ABC, abstractmethod
from typing import List, Optional

from app_modules.models import User, InsertUser, Rsvp, InsertRsvp, Message, InsertMessage


class IUserRepository(ABC):
    """Interface for user repository operations."""
    
    @abstractmethod
    def get_by_id(self, id: int) -> Optional[User]:
        """Get a user by ID."""
        pass
    
    @abstractmethod
    def get_by_username(self, username: str) -> Optional[User]:
        """Get a user by username."""
        pass
    
    @abstractmethod
    def create(self, insert_user: InsertUser) -> User:
        """Create a new user."""
        pass


class IRsvpRepository(ABC):
    """Interface for RSVP repository operations."""
    
    @abstractmethod
    def get_by_id(self, id: int) -> Optional[Rsvp]:
        """Get an RSVP by ID."""
        pass
    
    @abstractmethod
    def get_by_email(self, email: str) -> Optional[Rsvp]:
        """Get an RSVP by email."""
        pass
    
    @abstractmethod
    def get_all(self) -> List[Rsvp]:
        """Get all RSVPs."""
        pass
    
    @abstractmethod
    def create(self, insert_rsvp: InsertRsvp) -> Rsvp:
        """Create a new RSVP."""
        pass
    
    @abstractmethod
    def update(self, id: int, insert_rsvp: InsertRsvp) -> Rsvp:
        """Update an existing RSVP."""
        pass


class IMessageRepository(ABC):
    """Interface for message repository operations."""
    
    @abstractmethod
    def get_by_id(self, id: int) -> Optional[Message]:
        """Get a message by ID."""
        pass
    
    @abstractmethod
    def get_all(self) -> List[Message]:
        """Get all messages."""
        pass
    
    @abstractmethod
    def create(self, insert_message: InsertMessage) -> Message:
        """Create a new message."""
        pass