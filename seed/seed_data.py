"""
seed_data.py
------------
Generates 15 synthetic patients across 3 clinics with varied medication
snapshots and conflicts.  Run directly:

    python seed/seed_data.py

The script wipes existing data first so it is safe to re-run.
"""

import random
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config.db import patients, snapshots, conflicts
from services.normalize import normalize_med
from services.conflict_engine import detect_conflicts



patients.delete_many({})
snapshots.delete_many({})
conflicts.delete_many({})
print("🗑️  Cleared existing data.")



drug_list   = ["paracetamol", "ibuprofen", "diclofenac", "aspirin", "warfarin", "metformin"]
doses       = ["100mg", "200mg", "500mg", "650mg", "1000mg"]
statuses    = ["active", "stopped"]
sources     = ["clinic_emr", "hospital_discharge", "patient_reported"]
clinic_ids  = ["clinic_1", "clinic_2", "clinic_3"]


CONFLICT_PAIRS = [
    ("ibuprofen", "diclofenac"),
    ("aspirin",   "warfarin"),
    ("ibuprofen", "aspirin"),
    ("warfarin",  "diclofenac"),
]





def random_med(name=None):
    return {
        "name":   name or random.choice(drug_list),
        "dose":   random.choice(doses),
        "status": random.choice(statuses),
    }

def random_past_date(days_back=30):
    return datetime.utcnow() - timedelta(days=random.randint(0, days_back))




num_patients = 15
conflict_total = 0

for i in range(1, num_patients + 1):
    patient_id = f"p{i}"
    clinic_id  = clinic_ids[(i - 1) % 3]   

    patients.insert_one({"_id": patient_id, "clinic_id": clinic_id})

    patient_snapshots = []
    num_snapshots = random.randint(2, 3)

    for v in range(1, num_snapshots + 1):
        meds = []

        
        for _ in range(random.randint(2, 4)):
            meds.append(normalize_med(random_med()))

        
        if i % 2 == 0 and v == 2:
            pair = random.choice(CONFLICT_PAIRS)
            meds.append(normalize_med(random_med(pair[0])))
            meds.append(normalize_med(random_med(pair[1])))

        
        if i % 3 == 0 and v == 2:
            meds.append(normalize_med({"name": "paracetamol", "dose": "1000mg", "status": "active"}))

        snapshot_doc = {
            "patient_id": patient_id,
            "source": sources[(v - 1) % len(sources)],
            "medications": meds,
            "version": v,
            "created_at": random_past_date(30),
        }
        snapshots.insert_one(snapshot_doc)
        patient_snapshots.append(meds)

   
    
   
    if len(patient_snapshots) > 1:
        new_meds  = patient_snapshots[-1]
        old_meds  = patient_snapshots[:-1]
        detected  = detect_conflicts(patient_id, new_meds, old_meds)

        for c in detected:
            
            existing = conflicts.find_one({
                "patient_id": c["patient_id"],
                "drug": c["drug"],
                "type": c["type"],
                "status": "unresolved",
            })
            if not existing:
                c["created_at"] = random_past_date(30)
                conflicts.insert_one(c)
                conflict_total += 1

print(f"Seeded {num_patients} patients across {len(clinic_ids)} clinics.")
print(f"{snapshots.count_documents({})} snapshots created.")
print(f" {conflict_total} unique conflicts stored.")