import asyncio
import os
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
mongo_url = os.environ['MONGO_URL']

async def seed_principal():
    client = AsyncIOMotorClient(mongo_url)
    db = client['schoolerp']
    
    email = "dwivedikrishna65@gmail.com"
    
    # Check if already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        print(f"User {email} already exists! Updating role to principal.")
        await db.users.update_one({"email": email}, {"$set": {"role": "principal"}})
    else:
        new_user = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": "Krishna Dwivedi",
            "picture": None,
            "role": "principal",
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(new_user)
        print(f"Successfully seeded principal user: {email}")

    # Verify
    user = await db.users.find_one({"email": email}, {"_id": 0})
    print("User record:", user)

if __name__ == "__main__":
    asyncio.run(seed_principal())
