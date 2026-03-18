"""
test_conflict_engine.py
-----------------------
Unit tests for services/conflict_engine.py  — the core detection logic.
No database or HTTP involved.

Edge cases covered:
  • Dose mismatch (standard, empty dose, same dose no conflict)
  • Status conflict (active vs stopped)
  • Class conflict (blacklisted drug combinations from rules.json)
  • No false positives (identical meds → no conflict)
  • Deduplication across multiple prior snapshots
  • Missing / empty fields do not cause crashes
  • No existing snapshots → empty result
"""

import pytest
from services.conflict_engine import detect_conflicts


# ── Helpers ───────────────────────────────────────────────────────────────────

def med(name, dose="200mg", status="active"):
    return {"name": name, "dose": dose, "status": status}


# ── Dose Mismatch ─────────────────────────────────────────────────────────────

class TestDoseMismatch:

    def test_detects_dose_mismatch(self):
        new   = [med("paracetamol", "1000mg")]
        prior = [[med("paracetamol", "500mg")]]
        result = detect_conflicts("p1", new, prior)
        types = [c["type"] for c in result]
        assert "dose_mismatch" in types

    def test_dose_mismatch_captures_both_doses(self):
        new   = [med("ibuprofen", "800mg")]
        prior = [[med("ibuprofen", "200mg")]]
        result = detect_conflicts("p1", new, prior)
        dm = next(c for c in result if c["type"] == "dose_mismatch")
        assert dm["details"]["dose1"] == "800mg"
        assert dm["details"]["dose2"] == "200mg"

    def test_no_conflict_when_doses_identical(self):
        new   = [med("aspirin", "500mg")]
        prior = [[med("aspirin", "500mg")]]
        result = detect_conflicts("p1", new, prior)
        assert not any(c["type"] == "dose_mismatch" for c in result)

    def test_empty_dose_vs_real_dose_is_a_mismatch(self):
        """A missing dose ('') vs a supplied dose must still flag a mismatch."""
        new   = [med("warfarin", "")]
        prior = [[med("warfarin", "5mg")]]
        result = detect_conflicts("p1", new, prior)
        assert any(c["type"] == "dose_mismatch" for c in result)

    def test_both_empty_doses_no_mismatch(self):
        new   = [med("warfarin", "")]
        prior = [[med("warfarin", "")]]
        result = detect_conflicts("p1", new, prior)
        assert not any(c["type"] == "dose_mismatch" for c in result)


# ── Status Conflict ───────────────────────────────────────────────────────────

class TestStatusConflict:

    def test_detects_active_vs_stopped(self):
        new   = [med("metformin", status="active")]
        prior = [[med("metformin", status="stopped")]]
        result = detect_conflicts("p1", new, prior)
        assert any(c["type"] == "status_conflict" for c in result)

    def test_detects_stopped_vs_active(self):
        new   = [med("metformin", status="stopped")]
        prior = [[med("metformin", status="active")]]
        result = detect_conflicts("p1", new, prior)
        assert any(c["type"] == "status_conflict" for c in result)

    def test_status_conflict_captures_both_statuses(self):
        new   = [med("aspirin", status="stopped")]
        prior = [[med("aspirin", status="active")]]
        result = detect_conflicts("p1", new, prior)
        sc = next(c for c in result if c["type"] == "status_conflict")
        assert set([sc["details"]["status1"], sc["details"]["status2"]]) == {"active", "stopped"}

    def test_no_conflict_when_both_active(self):
        new   = [med("ibuprofen", status="active")]
        prior = [[med("ibuprofen", status="active")]]
        result = detect_conflicts("p1", new, prior)
        assert not any(c["type"] == "status_conflict" for c in result)

    def test_no_conflict_when_both_stopped(self):
        new   = [med("ibuprofen", status="stopped")]
        prior = [[med("ibuprofen", status="stopped")]]
        result = detect_conflicts("p1", new, prior)
        assert not any(c["type"] == "status_conflict" for c in result)


# ── Class Conflict ────────────────────────────────────────────────────────────

class TestClassConflict:

    def test_ibuprofen_vs_diclofenac(self):
        new   = [med("ibuprofen")]
        prior = [[med("diclofenac")]]
        result = detect_conflicts("p1", new, prior)
        assert any(c["type"] == "class_conflict" for c in result)

    def test_aspirin_vs_warfarin(self):
        new   = [med("aspirin")]
        prior = [[med("warfarin")]]
        result = detect_conflicts("p1", new, prior)
        assert any(c["type"] == "class_conflict" for c in result)

    def test_ibuprofen_vs_aspirin(self):
        new   = [med("ibuprofen")]
        prior = [[med("aspirin")]]
        result = detect_conflicts("p1", new, prior)
        assert any(c["type"] == "class_conflict" for c in result)

    def test_class_conflict_drug_field_is_sorted_pair(self):
        """drug field must be 'diclofenac vs ibuprofen' (alphabetical) not 'ibuprofen vs diclofenac'."""
        new   = [med("ibuprofen")]
        prior = [[med("diclofenac")]]
        result = detect_conflicts("p1", new, prior)
        cc = next(c for c in result if c["type"] == "class_conflict")
        assert cc["drug"] == "diclofenac vs ibuprofen"

    def test_unrelated_drugs_no_class_conflict(self):
        new   = [med("metformin")]
        prior = [[med("paracetamol")]]
        result = detect_conflicts("p1", new, prior)
        assert not any(c["type"] == "class_conflict" for c in result)

    def test_same_drug_no_class_conflict_with_itself(self):
        new   = [med("ibuprofen")]
        prior = [[med("ibuprofen")]]
        result = detect_conflicts("p1", new, prior)
        assert not any(c["type"] == "class_conflict" for c in result)


# ── Deduplication ─────────────────────────────────────────────────────────────

class TestDeduplication:

    def test_same_conflict_across_two_prior_snapshots_returned_once(self):
        """
        If snapshot v1 and snapshot v2 both have ibuprofen 200mg, and the
        new snapshot has ibuprofen 800mg, we should only get ONE dose_mismatch,
        not two.
        """
        new    = [med("ibuprofen", "800mg")]
        prior1 = [med("ibuprofen", "200mg")]
        prior2 = [med("ibuprofen", "200mg")]
        result = detect_conflicts("p1", new, [prior1, prior2])
        dose_mismatches = [c for c in result if c["type"] == "dose_mismatch" and c["drug"] == "ibuprofen"]
        assert len(dose_mismatches) == 1

    def test_no_conflicts_when_no_prior_snapshots(self):
        new = [med("paracetamol", "500mg")]
        result = detect_conflicts("p1", new, [])
        assert result == []

    def test_multiple_different_conflicts_all_returned(self):
        """A single new snapshot can produce both a dose_mismatch and a class_conflict."""
        new   = [med("ibuprofen", "800mg"), med("aspirin", "500mg")]
        prior = [[med("ibuprofen", "200mg"), med("warfarin", "5mg")]]
        result = detect_conflicts("p1", new, prior)
        types = {c["type"] for c in result}
        assert "dose_mismatch" in types
        assert "class_conflict" in types


# ── Malformed / Edge-case Inputs ──────────────────────────────────────────────

class TestMalformedInputs:

    def test_extra_unknown_fields_in_med_do_not_crash(self):
        new   = [{"name": "aspirin", "dose": "500mg", "status": "active", "unknown_field": "xyz"}]
        prior = [[{"name": "aspirin", "dose": "100mg", "status": "active"}]]
        # Should not raise, and should still detect the mismatch
        result = detect_conflicts("p1", new, prior)
        assert any(c["type"] == "dose_mismatch" for c in result)

    def test_empty_new_meds_list_returns_no_conflicts(self):
        prior = [[med("paracetamol", "500mg")]]
        result = detect_conflicts("p1", [], prior)
        assert result == []

    def test_empty_prior_snapshot_list_returns_no_conflicts(self):
        new = [med("paracetamol", "500mg")]
        result = detect_conflicts("p1", new, [[]])
        assert result == []

    def test_all_conflicts_have_status_unresolved(self):
        new   = [med("ibuprofen", "800mg")]
        prior = [[med("ibuprofen", "200mg"), med("diclofenac", "50mg")]]
        result = detect_conflicts("p1", new, prior)
        for c in result:
            assert c["status"] == "unresolved"

    def test_all_conflicts_have_patient_id(self):
        new   = [med("aspirin", "500mg")]
        prior = [[med("warfarin", "5mg")]]
        result = detect_conflicts("patient_xyz", new, prior)
        for c in result:
            assert c["patient_id"] == "patient_xyz"