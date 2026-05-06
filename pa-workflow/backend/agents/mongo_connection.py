from dotenv import load_dotenv
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient


env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

print("DEBUG DB_NAME:", DB_NAME)  # temporary

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]

def get_db():
    return db