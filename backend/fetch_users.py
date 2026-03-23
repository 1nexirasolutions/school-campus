import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
mongo_url = os.environ['MONGO_URL']

async def main():
    print(f"Connecting to: {mongo_url}")
    client = AsyncIOMotorClient(mongo_url)
    db = client['schoolerp']
    users = await db.users.find({}, {"_id": 0, "email": 1, "role": 1, "name": 1}).to_list(100)
    print("\n--- Users in Database ---")
    if not users:
        print("No users found in database.")
    for u in users:
        print(f"Name: {u.get('name')} | Email: {u.get('email')} | Role: {u.get('role')}")
    print("-------------------------\n")

asyncio.run(main())
