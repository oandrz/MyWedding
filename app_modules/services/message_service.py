# app_modules/services/message_service.py
"""
Message service for handling message board business logic.
"""

from typing import Dict, List, Any, Tuple

from app_modules.models import Message, InsertMessage
from app_modules.repositories.interfaces import IMessageRepository


class MessageService:
    """
    Service for managing message board operations.
    
    Attributes:
        repository: The message repository interface implementation
    """
    
    def __init__(self, repository: IMessageRepository):
        """Initialize the message service with a repository."""
        self.repository = repository
    
    def submit_message(self, message_data: InsertMessage) -> Tuple[Dict[str, Any], int]:
        """
        Submit a new message to the message board.
        
        Args:
            message_data: The message data to submit
            
        Returns:
            A tuple containing the response data and HTTP status code
        """
        message = self.repository.create(message_data)
        return {"message": "Message submitted successfully", "data": message.dict()}, 201
    
    def get_all_messages(self) -> Tuple[Dict[str, Any], int]:
        """
        Get all messages from the message board.
        
        Returns:
            A tuple containing the response data and HTTP status code
        """
        messages = self.repository.get_all()
        
        # Format response
        response_data = {
            "messages": [message.dict() for message in messages],
            "count": len(messages)
        }
        
        return response_data, 200