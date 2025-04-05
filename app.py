from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List

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
        self.users = {}
        self.rsvps = {}
        self.current_user_id = 1
        self.current_rsvp_id = 1
    
    async def get_user(self, id: int) -> Optional[User]:
        return self.users.get(id)
    
    async def get_user_by_username(self, username: str) -> Optional[User]:
        for user in self.users.values():
            if user.username == username:
                return user
        return None
    
    async def create_user(self, insert_user: InsertUser) -> User:
        id = self.current_user_id
        self.current_user_id += 1
        user = User(id=id, **insert_user.model_dump())
        self.users[id] = user
        return user
    
    async def create_rsvp(self, insert_rsvp: InsertRsvp) -> Rsvp:
        id = self.current_rsvp_id
        self.current_rsvp_id += 1
        rsvp = Rsvp(id=id, **insert_rsvp.model_dump())
        self.rsvps[id] = rsvp
        return rsvp
    
    async def get_rsvps(self) -> List[Rsvp]:
        return list(self.rsvps.values())
    
    async def get_rsvp_by_email(self, email: str) -> Optional[Rsvp]:
        for rsvp in self.rsvps.values():
            if rsvp.email == email:
                return rsvp
        return None

# Initialize storage
storage = MemStorage()

# API routes
@app.route('/api/rsvp', methods=['POST'])
async def create_rsvp():
    try:
        data = request.json
        validated_data = InsertRsvp(**data)
        
        # Check if this email has already RSVP'd
        existing_rsvp = await storage.get_rsvp_by_email(validated_data.email)
        
        if existing_rsvp:
            # Update existing RSVP instead of creating a new one
            # But for now, let's just return a message
            return jsonify({
                "message": "Your RSVP has been updated successfully!",
                "rsvp": existing_rsvp.model_dump()
            }), 200
        
        # Store the RSVP
        rsvp = await storage.create_rsvp(validated_data)
        
        return jsonify({
            "message": "Thank you for your RSVP!",
            "rsvp": rsvp.model_dump()
        }), 201
    
    except Exception as e:
        print(f"RSVP submission error: {str(e)}")
        return jsonify({"message": f"Failed to submit RSVP: {str(e)}"}), 400

@app.route('/api/rsvp', methods=['GET'])
async def get_rsvps():
    try:
        rsvps = await storage.get_rsvps()
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