"""
test_normalize.py
-----------------
Unit tests for services/normalize.py.
No database or HTTP involved — pure function tests.
"""

import pytest
from services.normalize import normalize_med


class TestNormalizeMed:

    def test_name_lowercased(self):
        result = normalize_med({"name": "IBUPROFEN", "dose": "200mg", "status": "active"})
        assert result["name"] == "ibuprofen"

    def test_name_stripped_of_whitespace(self):
        result = normalize_med({"name": "  paracetamol  ", "dose": "500mg", "status": "active"})
        assert result["name"] == "paracetamol"

    def test_dose_lowercased_and_stripped(self):
        result = normalize_med({"name": "aspirin", "dose": "  500MG  ", "status": "active"})
        assert result["dose"] == "500mg"

    def test_status_lowercased(self):
        result = normalize_med({"name": "warfarin", "dose": "5mg", "status": "ACTIVE"})
        assert result["status"] == "active"

    def test_missing_dose_defaults_to_empty_string(self):
        result = normalize_med({"name": "metformin", "status": "active"})
        assert result["dose"] == ""

    def test_missing_status_defaults_to_active(self):
        result = normalize_med({"name": "metformin", "dose": "500mg"})
        assert result["status"] == "active"

    def test_mixed_case_name_with_spaces(self):
        result = normalize_med({"name": "  Warfarin 5mg Tablet  ", "dose": "5mg", "status": "stopped"})
        assert result["name"] == "warfarin 5mg tablet"

    def test_all_fields_present_and_normalised(self):
        result = normalize_med({"name": "Diclofenac", "dose": "75MG", "status": "Stopped"})
        assert result == {"name": "diclofenac", "dose": "75mg", "status": "stopped"}