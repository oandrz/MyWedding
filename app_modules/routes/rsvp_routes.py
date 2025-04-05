# app_modules/routes/rsvp_routes.py
"""
RSVP route handlers for the wedding e-invitation application.
"""

from flask import Blueprint, request, jsonify, Flask
from app_modules.models import InsertRsvp
from app_modules.services import rsvp_service


def register_rsvp_routes(app: Flask) -> None:
    """
    Register RSVP routes with the Flask app.
    
    Args:
        app: The Flask application instance
    """
    
    @app.route('/api/rsvp', methods=['POST'])
    def create_rsvp():
        """Handle RSVP submission."""
        try:
            data = request.json
            validated_data = InsertRsvp(**data)
            
            # Process the RSVP
            response_data, status_code = rsvp_service.submit_rsvp(validated_data)
            return jsonify(response_data), status_code
        
        except Exception as e:
            print(f"RSVP submission error: {str(e)}")
            return jsonify({"message": f"Failed to submit RSVP: {str(e)}"}), 400
    
    @app.route('/api/rsvp', methods=['GET'])
    def get_rsvps():
        """Get all RSVPs with statistics."""
        try:
            response_data, status_code = rsvp_service.get_all_rsvps()
            return jsonify(response_data), status_code
        
        except Exception as e:
            print(f"Error fetching RSVPs: {str(e)}")
            return jsonify({"message": f"Failed to fetch RSVPs: {str(e)}"}), 500
    
    @app.route('/api/rsvp/<email>', methods=['GET'])
    def get_rsvp_by_email(email):
        """Get an RSVP by email address."""
        try:
            response_data, status_code = rsvp_service.get_rsvp_by_email(email)
            return jsonify(response_data), status_code
        
        except Exception as e:
            print(f"Error fetching RSVP: {str(e)}")
            return jsonify({"message": f"Failed to fetch RSVP: {str(e)}"}), 500