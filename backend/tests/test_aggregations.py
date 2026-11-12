"""
test_aggregations.py
--------------------
Tests for the two reporting/aggregation endpoints.

  GET /patients-with-conflicts?clinic_id=X
  GET /conflict-stats

Both endpoints rely on MongoDB aggregation pipelines.
We seed the test DB directly (bypassing /ingest) to get precise, deterministic data.
"""

import pytest
from datetime import datetime, timedelta
from bson import ObjectId
from conftest import test_patients, test_snapshots, test_conflicts




def make_patient(patient_id, clinic_id):
    test_patients.insert_one({"_id": patient_id, "clinic_id": clinic_id})

def make_conflict(patient_id, drug="ibuprofen", conflict_type="dose_mismatch",
                  status="unresolved", created_at=None):
    test_conflicts.insert_one({
        "patient_id": patient_id,
        "drug": drug,
        "type": conflict_type,
        "details": {},
        "status": status,
        "created_at": created_at or datetime.utcnow(),
    })




class TestPatientsWithConflicts:

    def test_returns_patient_with_unresolved_conflict(self, client):
        make_patient("p1", "clinic_1")
        make_conflict("p1", status="unresolved")

        resp = client.get("/patients-with-conflicts?clinic_id=clinic_1")
        assert resp.status_code == 200
        ids = [r["patient_id"] for r in resp.json()]
        assert "p1" in ids

    def test_excludes_patient_with_only_resolved_conflicts(self, client):
        make_patient("p2", "clinic_1")
        make_conflict("p2", status="resolved")

        resp = client.get("/patients-with-conflicts?clinic_id=clinic_1")
        ids = [r["patient_id"] for r in resp.json()]
        assert "p2" not in ids

    def test_excludes_patients_from_other_clinics(self, client):
        make_patient("p_a", "clinic_1")
        make_patient("p_b", "clinic_2")
        make_conflict("p_a", status="unresolved")
        make_conflict("p_b", status="unresolved")

        resp = client.get("/patients-with-conflicts?clinic_id=clinic_1")
        ids = [r["patient_id"] for r in resp.json()]
        assert "p_a" in ids
        assert "p_b" not in ids

    def test_returns_empty_list_when_no_patients_in_clinic(self, client):
        resp = client.get("/patients-with-conflicts?clinic_id=nonexistent_clinic")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_unresolved_count_is_correct(self, client):
        make_patient("p3", "clinic_1")
        make_conflict("p3", drug="ibuprofen",  status="unresolved")
        make_conflict("p3", drug="paracetamol", status="unresolved")
        make_conflict("p3", drug="aspirin",     status="resolved")   # should not be counted

        resp = client.get("/patients-with-conflicts?clinic_id=clinic_1")
        record = next(r for r in resp.json() if r["patient_id"] == "p3")
        assert record["unresolved_count"] == 2

    def test_sorted_by_unresolved_count_descending(self, client):
        """Patient with most unresolved conflicts should appear first."""
        make_patient("p_low",  "clinic_1")
        make_patient("p_high", "clinic_1")
        make_conflict("p_low",  status="unresolved")
        make_conflict("p_high", drug="ibuprofen",   status="unresolved")
        make_conflict("p_high", drug="paracetamol", status="unresolved")
        make_conflict("p_high", drug="aspirin",     status="unresolved")

        resp = client.get("/patients-with-conflicts?clinic_id=clinic_1")
        results = resp.json()
        assert results[0]["patient_id"] == "p_high"

    def test_response_includes_required_fields(self, client):
        make_patient("p4", "clinic_1")
        make_conflict("p4", status="unresolved")

        resp = client.get("/patients-with-conflicts?clinic_id=clinic_1")
        record = resp.json()[0]
        assert "patient_id"       in record
        assert "clinic_id"        in record
        assert "unresolved_count" in record




class TestConflictStats:

    def test_counts_patients_with_2_plus_conflicts(self, client):
        make_patient("pa", "clinic_A")
        make_conflict("pa", drug="ibuprofen",   created_at=datetime.utcnow())
        make_conflict("pa", drug="paracetamol", created_at=datetime.utcnow())

        resp = client.get("/conflict-stats")
        assert resp.status_code == 200
        clinic_row = next(
            (r for r in resp.json() if r["clinic_id"] == "clinic_A"), None
        )
        assert clinic_row is not None
        assert clinic_row["patients_with_2_plus_conflicts"] >= 1

    def test_excludes_patient_with_only_1_conflict(self, client):
        make_patient("pb", "clinic_B")
        make_conflict("pb", drug="ibuprofen", created_at=datetime.utcnow())

        resp = client.get("/conflict-stats")
        clinic_row = next(
            (r for r in resp.json() if r["clinic_id"] == "clinic_B"), None
        )
        
        if clinic_row:
            assert clinic_row["patients_with_2_plus_conflicts"] == 0 or \
                   "pb" not in clinic_row.get("patient_ids", [])

    def test_excludes_conflicts_older_than_30_days(self, client):
        make_patient("pc", "clinic_C")
        old_date = datetime.utcnow() - timedelta(days=31)
        make_conflict("pc", drug="ibuprofen",   created_at=old_date)
        make_conflict("pc", drug="paracetamol", created_at=old_date)

        resp = client.get("/conflict-stats")
        clinic_row = next(
            (r for r in resp.json() if r["clinic_id"] == "clinic_C"), None
        )
        assert clinic_row is None  

    def test_includes_conflicts_within_30_days(self, client):
        make_patient("pd", "clinic_D")
        recent = datetime.utcnow() - timedelta(days=15)
        make_conflict("pd", drug="ibuprofen",   created_at=recent)
        make_conflict("pd", drug="paracetamol", created_at=recent)

        resp = client.get("/conflict-stats")
        clinic_row = next(
            (r for r in resp.json() if r["clinic_id"] == "clinic_D"), None
        )
        assert clinic_row is not None
        assert clinic_row["patients_with_2_plus_conflicts"] >= 1

    def test_multiple_clinics_returned(self, client):
        for clinic in ["clinic_X", "clinic_Y"]:
            pid = f"p_{clinic}"
            make_patient(pid, clinic)
            make_conflict(pid, drug="ibuprofen",   created_at=datetime.utcnow())
            make_conflict(pid, drug="paracetamol", created_at=datetime.utcnow())

        resp = client.get("/conflict-stats")
        clinic_ids = [r["clinic_id"] for r in resp.json()]
        assert "clinic_X" in clinic_ids
        assert "clinic_Y" in clinic_ids

    def test_response_includes_required_fields(self, client):
        make_patient("pe", "clinic_E")
        make_conflict("pe", drug="ibuprofen",   created_at=datetime.utcnow())
        make_conflict("pe", drug="paracetamol", created_at=datetime.utcnow())

        resp = client.get("/conflict-stats")
        row = next(r for r in resp.json() if r["clinic_id"] == "clinic_E")
        assert "clinic_id"                     in row
        assert "patients_with_2_plus_conflicts" in row
        assert "patient_ids"                  in row