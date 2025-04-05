from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import asyncio
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

app = Flask(__name__, static_folder='client/dist', static_url_path='/')
CORS(app)

# Define schemas
class Rsvp(BaseModel):
    id: int
    firstName: str
    lastName: str
    email: str
    attending: bool
    guestCount: Optional[int] = None
    dietaryRestrictions: Optional[str] = None
    message: Optional[str] = None

class InsertRsvp(BaseModel):
    firstName: str
    lastName: str
    email: str
    attending: bool
    guestCount: Optional[int] = None
    dietaryRestrictions: Optional[str] = None
    message: Optional[str] = None

class User(BaseModel):
    id: int
    username: str
    password: str

class InsertUser(BaseModel):
    username: str
    password: str

# Memory storage implementation
class MemStorage:
    def __init__(self):
        self.users: Dict[int, User] = {}
        self.rsvps: Dict[int, Rsvp] = {}
        self.current_user_id = 1
        self.current_rsvp_id = 1
    
    def get_user(self, id: int) -> Optional[User]:
        return self.users.get(id)
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        for user in self.users.values():
            if user.username == username:
                return user
        return None
    
    def create_user(self, insert_user: InsertUser) -> User:
        id = self.current_user_id
        self.current_user_id += 1
        user = User(id=id, **insert_user.model_dump())
        self.users[id] = user
        return user
    
    def create_rsvp(self, insert_rsvp: InsertRsvp) -> Rsvp:
        id = self.current_rsvp_id
        self.current_rsvp_id += 1
        rsvp = Rsvp(id=id, **insert_rsvp.model_dump())
        self.rsvps[id] = rsvp
        return rsvp
    
    def update_rsvp(self, id: int, insert_rsvp: InsertRsvp) -> Rsvp:
        """Update an existing RSVP while keeping its ID"""
        rsvp = Rsvp(id=id, **insert_rsvp.model_dump())
        self.rsvps[id] = rsvp
        return rsvp
    
    def get_rsvps(self) -> List[Rsvp]:
        return list(self.rsvps.values())
    
    def get_rsvp_by_email(self, email: str) -> Optional[Rsvp]:
        for rsvp in self.rsvps.values():
            if rsvp.email.lower() == email.lower():
                return rsvp
        return None

# Initialize storage
storage = MemStorage()

# API routes
@app.route('/api/rsvp', methods=['POST'])
def create_rsvp():
    try:
        data = request.json
        validated_data = InsertRsvp(**data)
        
        # Check if this email has already RSVP'd
        existing_rsvp = storage.get_rsvp_by_email(validated_data.email)
        
        if existing_rsvp:
            # Update existing RSVP
            updated_rsvp = storage.update_rsvp(existing_rsvp.id, validated_data)
            return jsonify({
                "message": "Your RSVP has been updated successfully!",
                "rsvp": updated_rsvp.model_dump()
            }), 200
        
        # Store the RSVP
        rsvp = storage.create_rsvp(validated_data)
        
        return jsonify({
            "message": "Thank you for your RSVP!",
            "rsvp": rsvp.model_dump()
        }), 201
    
    except Exception as e:
        print(f"RSVP submission error: {str(e)}")
        return jsonify({"message": f"Failed to submit RSVP: {str(e)}"}), 400

@app.route('/api/rsvp', methods=['GET'])
def get_rsvps():
    try:
        rsvps = storage.get_rsvps()
        rsvps_dict = [rsvp.model_dump() for rsvp in rsvps]
        
        # Calculate attendance stats
        attending = len([rsvp for rsvp in rsvps if rsvp.attending])
        not_attending = len([rsvp for rsvp in rsvps if not rsvp.attending])
        
        # Calculate total guests
        total_guests = sum(rsvp.guestCount or 0 for rsvp in rsvps if rsvp.attending)
        
        return jsonify({
            "rsvps": rsvps_dict,
            "stats": {
                "total": len(rsvps),
                "attending": attending,
                "notAttending": not_attending,
                "totalGuests": total_guests
            }
        }), 200
    
    except Exception as e:
        print(f"Error fetching RSVPs: {str(e)}")
        return jsonify({"message": f"Failed to fetch RSVPs: {str(e)}"}), 500

@app.route('/api/rsvp/<email>', methods=['GET'])
def get_rsvp_by_email(email):
    try:
        rsvp = storage.get_rsvp_by_email(email)
        if rsvp:
            return jsonify({
                "rsvp": rsvp.model_dump()
            }), 200
        else:
            return jsonify({"message": "RSVP not found"}), 404
    
    except Exception as e:
        print(f"Error fetching RSVP: {str(e)}")
        return jsonify({"message": f"Failed to fetch RSVP: {str(e)}"}), 500

# Message board functionality
class Message(BaseModel):
    id: int
    name: str
    email: str
    content: str
    created_at: str

class InsertMessage(BaseModel):
    name: str
    email: str
    content: str

class MessageBoard:
    def __init__(self):
        self.messages: Dict[int, Message] = {}
        self.current_message_id = 1
    
    def add_message(self, insert_message: InsertMessage) -> Message:
        id = self.current_message_id
        self.current_message_id += 1
        created_at = datetime.now().isoformat()
        message = Message(
            id=id, 
            name=insert_message.name, 
            email=insert_message.email, 
            content=insert_message.content,
            created_at=created_at
        )
        self.messages[id] = message
        return message
    
    def get_messages(self) -> List[Message]:
        # Return messages sorted by newest first
        return sorted(
            list(self.messages.values()),
            key=lambda x: x.created_at,
            reverse=True
        )

# Initialize message board
message_board = MessageBoard()

# Message board routes
@app.route('/api/messages', methods=['POST'])
def create_message():
    try:
        data = request.json
        validated_data = InsertMessage(**data)
        message = message_board.add_message(validated_data)
        
        return jsonify({
            "message": "Thank you for your message!",
            "data": message.model_dump()
        }), 201
    
    except Exception as e:
        print(f"Message submission error: {str(e)}")
        return jsonify({"message": f"Failed to submit message: {str(e)}"}), 400

@app.route('/api/messages', methods=['GET'])
def get_messages():
    try:
        messages = message_board.get_messages()
        messages_dict = [message.model_dump() for message in messages]
        
        return jsonify({
            "messages": messages_dict
        }), 200
    
    except Exception as e:
        print(f"Error fetching messages: {str(e)}")
        return jsonify({"message": f"Failed to fetch messages: {str(e)}"}), 500

# Serve the frontend
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return app.send_static_file(path)
    else:
        return app.send_static_file('index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)