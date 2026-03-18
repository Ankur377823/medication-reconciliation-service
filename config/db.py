import os
from pymongo import MongoClient, ASCENDING
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")

if not MONGO_URL:
    raise ValueError("MONGO_URL environment variable is not set. Check your .env file.")

client = MongoClient(MONGO_URL)

db = client["med_service"]

patients = db["patients"]
snapshots = db["medication_snapshots"]
conflicts = db["conflicts"]


patients.create_index([("clinic_id", ASCENDING)])


snapshots.create_index([("patient_id", ASCENDING), ("version", ASCENDING)])


conflicts.create_index([("patient_id", ASCENDING), ("status", ASCENDING)])

conflicts.create_index([("created_at", ASCENDING)])
