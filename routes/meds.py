from fastapi import APIRouter, HTTPException
from bson import ObjectId
from config.db import snapshots, conflicts, patients
from services.normalize import normalize_med
from services.conflict_engine import detect_conflicts
from model.schemas import IngestRequest, ResolveRequest
from datetime import datetime, timedelta

router = APIRouter()


# ─────────────────────────────────────────────
# INGEST
# ─────────────────────────────────────────────

@router.post("/ingest")
async def ingest(data: IngestRequest):
    """
    Ingest a medication list for a patient from a given source.

    Versioning decision:
      Every ingest call creates a NEW snapshot version rather than updating
      the existing one.  This gives a full audit trail — clinicians can see
      exactly what each source reported at each point in time.

    Conflict deduplication:
      Before storing, we check whether an identical unresolved conflict
      (same patient / drug / type / doses) already exists so that
      re-ingesting the same source does not produce duplicate records.
    """
    patient_id = data.patient_id
    source = data.source

    meds = [normalize_med(m.dict()) for m in data.medications]

    # Auto-create patient record if it doesn't exist yet
    if not patients.find_one({"_id": patient_id}):
        patients.insert_one({"_id": patient_id, "clinic_id": data.clinic_id or "unknown"})

    # Assign next version number
    version = snapshots.count_documents({"patient_id": patient_id}) + 1

    snapshot_doc = {
        "patient_id": patient_id,
        "source": source,
        "medications": meds,
        "version": version,
        "created_at": datetime.utcnow(),
    }
    snapshots.insert_one(snapshot_doc)

    # Compare only against *prior* snapshots to avoid self-conflict
    prior_snapshots = list(
        snapshots.find({"patient_id": patient_id, "version": {"$lt": version}})
    )
    meds_list = [s["medications"] for s in prior_snapshots]

    detected = detect_conflicts(patient_id, meds, meds_list)

    inserted = 0
    for c in detected:
        # Deduplicate against already-stored unresolved conflicts
        existing = conflicts.find_one({
            "patient_id": c["patient_id"],
            "drug": c["drug"],
            "type": c["type"],
            "status": "unresolved",
        })
        if not existing:
            c["created_at"] = datetime.utcnow()
            conflicts.insert_one(c)
            inserted += 1

    return {
        "message": "Data ingested",
        "snapshot_version": version,
        "conflicts_detected": len(detected),
        "new_conflicts_stored": inserted,
    }


# ─────────────────────────────────────────────
# VIEW CONFLICTS FOR A PATIENT
# ─────────────────────────────────────────────

@router.get("/conflicts/{patient_id}")
def get_conflicts(patient_id: str):
    """
    Return all conflict records for a patient (resolved + unresolved).
    Each record includes a 'conflict_id' field — use this value in POST /resolve.
    """
    if not patients.find_one({"_id": patient_id}):
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found")

    result = []
    for c in conflicts.find({"patient_id": patient_id}):
        c["conflict_id"] = str(c.pop("_id"))  # rename _id → conflict_id for clarity
        result.append(c)

    return result  # empty list is valid — patient exists but has no conflicts yet


# ─────────────────────────────────────────────
# VIEW SNAPSHOT HISTORY FOR A PATIENT
# ─────────────────────────────────────────────

@router.get("/snapshots/{patient_id}")
def get_snapshots(patient_id: str):
    """
    Return the full longitudinal medication history for a patient,
    ordered by version ascending so the caller can see how the list evolved.
    """
    if not patients.find_one({"_id": patient_id}):
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found")

    result = list(
        snapshots.find({"patient_id": patient_id}, {"_id": 0}).sort("version", 1)
    )
    return result  # empty list is valid — patient exists but no snapshots yet


# ─────────────────────────────────────────────
# RESOLVE A CONFLICT
# ─────────────────────────────────────────────

@router.post("/resolve")
def resolve_conflict(data: ResolveRequest):
    """
    Mark a conflict as resolved.

    Resolution fields stored:
      - resolved_by:    clinician identifier
      - reason:         free-text explanation
      - chosen_source:  which source was treated as authoritative
      - resolved_at:    UTC timestamp

    Trade-off: we never delete conflict records — the full audit trail
    (including why and by whom it was resolved) is always preserved.
    """
    try:
        oid = ObjectId(data.conflict_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid conflict_id format")

    result = conflicts.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": "resolved",
                "resolved_by": data.resolved_by,
                "reason": data.reason,
                "chosen_source": data.chosen_source,
                "resolved_at": datetime.utcnow(),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Conflict not found")

    return {"message": "Conflict resolved"}


# ─────────────────────────────────────────────
# REPORTING: patients in a clinic with ≥1 unresolved conflict
# ─────────────────────────────────────────────

@router.get("/patients-with-conflicts")
def patients_with_conflicts(clinic_id: str):
    """
    List all patients in a given clinic who have at least one unresolved
    medication conflict, sorted by unresolved conflict count descending.
    """
    pipeline = [
        # 1. Only consider patients in the requested clinic
        {"$match": {"clinic_id": clinic_id}},

        # 2. Join conflicts on the string patient_id
        {
            "$lookup": {
                "from": "conflicts",
                "localField": "_id",
                "foreignField": "patient_id",
                "as": "patient_conflicts",
            }
        },

        # 3. Keep only patients who have ≥1 unresolved conflict
        {
            "$match": {
                "patient_conflicts": {
                    "$elemMatch": {"status": "unresolved"}
                }
            }
        },

        # 4. Shape the output
        {
            "$project": {
                "_id": 0,
                "patient_id": "$_id",
                "clinic_id": 1,
                "unresolved_count": {
                    "$size": {
                        "$filter": {
                            "input": "$patient_conflicts",
                            "as": "c",
                            "cond": {"$eq": ["$$c.status", "unresolved"]},
                        }
                    }
                },
            }
        },

        {"$sort": {"unresolved_count": -1}},
    ]

    return list(patients.aggregate(pipeline))


# ─────────────────────────────────────────────
# REPORTING: conflict stats grouped by clinic (last 30 days)
# ─────────────────────────────────────────────

@router.get("/conflict-stats")
def conflict_stats():
    """
    For the past 30 days, return — per clinic — the count of patients
    who have ≥ 2 conflicts.
    """
    last_30_days = datetime.utcnow() - timedelta(days=30)

    pipeline = [
        # 1. Recent conflicts only
        {"$match": {"created_at": {"$gte": last_30_days}}},

        # 2. Count conflicts per patient
        {
            "$group": {
                "_id": "$patient_id",
                "conflict_count": {"$sum": 1},
            }
        },

        # 3. Keep only patients with ≥ 2 conflicts
        {"$match": {"conflict_count": {"$gte": 2}}},

        # 4. Join to patients to get clinic_id
        {
            "$lookup": {
                "from": "patients",
                "localField": "_id",
                "foreignField": "_id",
                "as": "patient_info",
            }
        },

        # 5. Unwind (each patient has exactly one doc)
        {"$unwind": {"path": "$patient_info", "preserveNullAndEmptyArrays": True}},

        # 6. Promote clinic_id before grouping overwrites _id
        {
            "$addFields": {
                "patient_id": "$_id",
                "clinic_id": "$patient_info.clinic_id",
            }
        },

        # 7. Group by clinic
        {
            "$group": {
                "_id": "$clinic_id",
                "patients_with_2_plus_conflicts": {"$sum": 1},
                "patient_ids": {"$push": "$patient_id"},
            }
        },

        # 8. Clean up output
        {
            "$project": {
                "_id": 0,
                "clinic_id": "$_id",
                "patients_with_2_plus_conflicts": 1,
                "patient_ids": 1,
            }
        },

        {"$sort": {"patients_with_2_plus_conflicts": -1}},
    ]

    return list(conflicts.aggregate(pipeline))