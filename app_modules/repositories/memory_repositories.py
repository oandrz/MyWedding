# app_modules/repositories/memory_repositories.py
"""
In-memory implementations of the repository interfaces.

These implementations store data in memory for development and testing purposes.
"""

import datetime
from typing import Dict, List, Optional

from app_modules.models import User, InsertUser, Rsvp, InsertRsvp, Message, InsertMessage
from app_modules.repositories.interfaces import (
    IUserRepository, IRsvpRepository, IMessageRepository
)


class MemoryUserRepository(IUserRepository):
    """In-memory implementation of the user repository."""
    
    def __init__(self):
        """Initialize the repository with an empty dict."""
        self.users: Dict[int, User] = {}
        self.current_id = 1
    
    def get_by_id(self, id: int) -> Optional[User]:
        """Get a user by ID."""
        return self.users.get(id)
    
    def get_by_username(self, username: str) -> Optional[User]:
        """Get a user by username."""
        for user in self.users.values():
            if user.username == username:
                return user
        return None
    
    def create(self, insert_user: InsertUser) -> User:
        """Create a new user."""
        id = self.current_id
        self.current_id += 1
        
        user = User(id=id, **insert_user.dict())
        self.users[id] = user
        return user


class MemoryRsvpRepository(IRsvpRepository):
    """In-memory implementation of the RSVP repository."""
    
    def __init__(self):
        """Initialize the repository with an empty dict."""
        self.rsvps: Dict[int, Rsvp] = {}
        self.current_id = 1
    
    def get_by_id(self, id: int) -> Optional[Rsvp]:
        """Get an RSVP by ID."""
        return self.rsvps.get(id)
    
    def get_by_email(self, email: str) -> Optional[Rsvp]:
        """Get an RSVP by email."""
        for rsvp in self.rsvps.values():
            if rsvp.email.lower() == email.lower():
                return rsvp
        return None
    
    def get_all(self) -> List[Rsvp]:
        """Get all RSVPs."""
        return list(self.rsvps.values())
    
    def create(self, insert_rsvp: InsertRsvp) -> Rsvp:
        """Create a new RSVP."""
        id = self.current_id
        self.current_id += 1
        
        rsvp = Rsvp(id=id, **insert_rsvp.dict())
        self.rsvps[id] = rsvp
        return rsvp
    
    def update(self, id: int, insert_rsvp: InsertRsvp) -> Rsvp:
        """Update an existing RSVP."""
        if id not in self.rsvps:
            raise ValueError(f"RSVP with ID {id} not found")
        
        rsvp = Rsvp(id=id, **insert_rsvp.dict())
        self.rsvps[id] = rsvp
        return rsvp


class MemoryMessageRepository(IMessageRepository):
    """In-memory implementation of the message repository."""
    
    def __init__(self):
        """Initialize the repository with an empty dict."""
        self.messages: Dict[int, Message] = {}
        self.current_id = 1
    
    def get_by_id(self, id: int) -> Optional[Message]:
        """Get a message by ID."""
        return self.messages.get(id)
    
    def get_all(self) -> List[Message]:
        """Get all messages sorted by newest first."""
        # Sort by ID, assuming higher IDs are newer
        return sorted(self.messages.values(), key=lambda m: m.id, reverse=True)
    
    def create(self, insert_message: InsertMessage) -> Message:
        """Create a new message."""
        id = self.current_id
        self.current_id += 1
        
        # Generate a timestamp for the current time
        timestamp = datetime.datetime.now().isoformat()
        
        message = Message(
            id=id,
            created_at=timestamp,
            **insert_message.dict()
        )
        self.messages[id] = message
        return message