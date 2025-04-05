# app_modules/routes/message_routes.py
"""
Message route handlers for the wedding e-invitation application.
"""

from flask import Blueprint, request, jsonify, Flask
from app_modules.models import InsertMessage
from app_modules.services import message_service


def register_message_routes(app: Flask) -> None:
    """
    Register message routes with the Flask app.
    
    Args:
        app: The Flask application instance
    """
    
    @app.route('/api/messages', methods=['POST'])
    def create_message():
        """Handle message submission."""
        try:
            data = request.json
            validated_data = InsertMessage(**data)
            
            # Process the message
            response_data, status_code = message_service.submit_message(validated_data)
            return jsonify(response_data), status_code
        
        except Exception as e:
            print(f"Message submission error: {str(e)}")
            return jsonify({"message": f"Failed to submit message: {str(e)}"}), 400
    
    @app.route('/api/messages', methods=['GET'])
    def get_messages():
        """Get all messages from the message board."""
        try:
            response_data, status_code = message_service.get_all_messages()
            return jsonify(response_data), status_code
        
        except Exception as e:
            print(f"Error fetching messages: {str(e)}")
            return jsonify({"message": f"Failed to fetch messages: {str(e)}"}), 500