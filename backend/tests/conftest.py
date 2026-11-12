"""
conftest.py
-----------
Shared pytest fixtures for the Medication Reconciliation test suite.

Strategy:
  - We override the three MongoDB collection objects used by the routes
    (patients, snapshots, conflicts) with collections from a dedicated
    'med_service_test' database.
  - Each test gets a clean slate: all three collections are wiped in the
    'autouse' fixture before every test function.
  - The FastAPI app is mounted on a TestClient so we can hit endpoints
    without spinning up a real server.
"""

import sys
import os


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")


_test_client = MongoClient(MONGO_URL)
_test_db     = _test_client["med_service_test"]

test_patients  = _test_db["patients"]
test_snapshots = _test_db["medication_snapshots"]
test_conflicts = _test_db["conflicts"]



import config.db as db_module
db_module.patients  = test_patients
db_module.snapshots = test_snapshots
db_module.conflicts = test_conflicts


import routes.meds as meds_module
meds_module.patients  = test_patients
meds_module.snapshots = test_snapshots
meds_module.conflicts = test_conflicts

from main import app   


@pytest.fixture(autouse=True)
def clean_db():
    """Wipe all test collections before every single test."""
    test_patients.delete_many({})
    test_snapshots.delete_many({})
    test_conflicts.delete_many({})
    yield
   
    test_patients.delete_many({})
    test_snapshots.delete_many({})
    test_conflicts.delete_many({})


@pytest.fixture
def client():
    """FastAPI TestClient — reuse across tests."""
    return TestClient(app)




def ingest_payload(patient_id="p_test", source="clinic_emr", meds=None):
    """Return a valid /ingest JSON body."""
    if meds is None:
        meds = [{"name": "paracetamol", "dose": "500mg", "status": "active"}]
    return {"patient_id": patient_id, "source": source, "medications": meds}