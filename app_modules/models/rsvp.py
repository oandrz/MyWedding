# app_modules/models/rsvp.py
"""
RSVP models for the wedding e-invitation application.
"""

from typing import Optional
from pydantic import BaseModel, Field


class InsertRsvp(BaseModel):
    """
    Schema for creating a new RSVP entry.
    
    Attributes:
        name: Full name of the guest
        email: Email address of the guest
        attending: Whether the guest is attending the wedding
        guestCount: Number of guests including themselves (optional)
    """
    name: str = Field(..., description="Full name of the guest")
    email: str = Field(..., description="Email address of the guest")
    attending: bool = Field(..., description="Whether the guest is attending")
    guestCount: Optional[int] = Field(None, description="Number of guests including themselves")


class Rsvp(InsertRsvp):
    """
    Complete RSVP model including the ID.
    
    Attributes:
        id: Unique identifier for the RSVP
    """
    id: int = Field(..., description="Unique identifier for the RSVP")