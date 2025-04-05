# app_modules/models/user.py
"""
User models for the wedding e-invitation application.
"""

from typing import Optional
from pydantic import BaseModel, Field


class InsertUser(BaseModel):
    """
    Schema for creating a new user.
    
    Attributes:
        username: Username for the user
        password: Password for the user
    """
    username: str = Field(..., description="Username for the user")
    password: str = Field(..., description="Password for the user")


class User(InsertUser):
    """
    Complete user model including the ID.
    
    Attributes:
        id: Unique identifier for the user
    """
    id: int = Field(..., description="Unique identifier for the user")