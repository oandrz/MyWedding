# app_modules/services/rsvp_service.py
"""
RSVP service for handling RSVP-related business logic.
"""

from typing import Dict, List, Any, Tuple

from app_modules.models import Rsvp, InsertRsvp
from app_modules.repositories.interfaces import IRsvpRepository


class RsvpService:
    """
    Service for managing RSVP operations.
    
    Attributes:
        repository: The RSVP repository interface implementation
    """
    
    def __init__(self, repository: IRsvpRepository):
        """Initialize the RSVP service with a repository."""
        self.repository = repository
    
    def submit_rsvp(self, rsvp_data: InsertRsvp) -> Tuple[Dict[str, Any], int]:
        """
        Submit a new RSVP or update an existing one.
        
        Args:
            rsvp_data: The RSVP data to submit
            
        Returns:
            A tuple containing the response data and HTTP status code
        """
        # Check if an RSVP with this email already exists
        existing_rsvp = self.repository.get_by_email(rsvp_data.email)
        
        if existing_rsvp:
            # Update existing RSVP
            rsvp = self.repository.update(existing_rsvp.id, rsvp_data)
            return {"message": "RSVP updated successfully", "rsvp": rsvp.dict()}, 200
        else:
            # Create new RSVP
            rsvp = self.repository.create(rsvp_data)
            return {"message": "RSVP submitted successfully", "rsvp": rsvp.dict()}, 201
    
    def get_all_rsvps(self) -> Tuple[Dict[str, Any], int]:
        """
        Get all RSVPs with statistics.
        
        Returns:
            A tuple containing the response data and HTTP status code
        """
        rsvps = self.repository.get_all()
        
        # Calculate statistics
        total_count = len(rsvps)
        attending_count = sum(1 for rsvp in rsvps if rsvp.attending)
        not_attending_count = total_count - attending_count
        
        # Count total guests (includes the RSVP person + any additional guests)
        guest_count = sum(
            1 + (rsvp.guestCount or 0) for rsvp in rsvps if rsvp.attending
        )
        
        # Format response
        response_data = {
            "rsvps": [rsvp.dict() for rsvp in rsvps],
            "stats": {
                "total": total_count,
                "attending": attending_count,
                "notAttending": not_attending_count,
                "guestCount": guest_count
            }
        }
        
        return response_data, 200
    
    def get_rsvp_by_email(self, email: str) -> Tuple[Dict[str, Any], int]:
        """
        Get an RSVP by email address.
        
        Args:
            email: The email address to search for
            
        Returns:
            A tuple containing the response data and HTTP status code
        """
        rsvp = self.repository.get_by_email(email)
        
        if rsvp:
            return {"rsvp": rsvp.dict()}, 200
        else:
            return {"message": "RSVP not found"}, 404