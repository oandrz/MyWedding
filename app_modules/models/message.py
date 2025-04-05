# app_modules/models/message.py
"""
Message models for the wedding e-invitation application.
"""

from typing import Optional
from pydantic import BaseModel, Field


class InsertMessage(BaseModel):
    """
    Schema for creating a new message.
    
    Attributes:
        name: Name of the person leaving the message
        email: Email address of the person
        content: Content of the message
    """
    name: str = Field(..., description="Name of the person")
    email: str = Field(..., description="Email address of the person")
    content: str = Field(..., description="Content of the message")


class Message(BaseModel):
    """
    Complete message model including the ID and timestamp.
    
    Attributes:
        id: Unique identifier for the message
        name: Name of the person leaving the message
        email: Email address of the person
        content: Content of the message
        created_at: Timestamp when the message was created
    """
    id: int = Field(..., description="Unique identifier for the message")
    name: str = Field(..., description="Name of the person")
    email: str = Field(..., description="Email address of the person")
    content: str = Field(..., description="Content of the message")
    created_at: str = Field(..., description="Timestamp when the message was created")