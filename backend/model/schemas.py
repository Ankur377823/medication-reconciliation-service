"""
schemas.py
----------
All Pydantic request/response models for the Medication Reconciliation Service.
Keeping schemas separate from route logic makes them reusable, testable,
and easier to document.
"""

from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional


class MedicationIn(BaseModel):
    """
    A single medication item as submitted by the caller.
    Names and doses are normalised (lowercased, stripped) before storage.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "ibuprofen",
                "dose": "200mg",
                "status": "active"
            }
        }
    )

    name: str = Field(
        ...,
        min_length=1,
        description="Generic drug name.",
        examples=["Ibuprofen", "paracetamol", "Warfarin 5mg tablet"]
    )

    dose: Optional[str] = Field(
        default="",
        description="Dose string as reported by the source. Leave blank if unknown.",
        examples=["200mg", "500 mg", "1g"]
    )

    status: Optional[str] = Field(
        default="active",
        description="Whether the medication is currently being taken. One of: 'active', 'stopped'.",
        examples=["active", "stopped"]
    )


class IngestRequest(BaseModel):
    """
    Payload for POST /ingest.
    Represents one medication list submission from a single source for a patient.
    Each call creates a new versioned snapshot — existing snapshots are never overwritten.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "patient_id": "p1",
                "clinic_id": "clinic_1",
                "source": "clinic_emr",
                "medications": [
                    {"name": "ibuprofen", "dose": "200mg", "status": "active"},
                    {"name": "paracetamol", "dose": "500mg", "status": "active"}
                ]
            }
        }
    )

    patient_id: str = Field(
        ...,
        min_length=1,
        description="Unique patient identifier. Auto-creates a patient record if one does not exist.",
        examples=["p1", "MRN-00123"]
    )

    clinic_id: Optional[str] = Field(
        default=None,
        description=(
            "Clinic this patient belongs to. Used only when auto-creating a new patient record. "
            "Ignored if the patient already exists."
        ),
        examples=["clinic_1", "clinic_2", "clinic_3"]
    )

    source: str = Field(
        ...,
        description="The system or person that produced this medication list.",
        examples=["clinic_emr", "hospital_discharge", "patient_reported"]
    )

    medications: List[MedicationIn] = Field(
        ...,
        min_length=1,
        description="One or more medications reported by this source. Must contain at least one item.",
    )


class ResolveRequest(BaseModel):
    """
    Payload for POST /resolve.
    Marks an existing conflict as resolved and records who resolved it and why.
    The conflict record is never deleted — the full audit trail is preserved.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "conflict_id": "64f1a2b3c4d5e6f7a8b9c0d1",
                "resolved_by": "dr_sharma",
                "reason": "Hospital discharge dose is post-surgery; clinic dose is long-term maintenance.",
                "chosen_source": "hospital_discharge"
            }
        }
    )

    conflict_id: str = Field(
        ...,
        description="MongoDB ObjectId string of the conflict document to resolve.",
        examples=["64f1a2b3c4d5e6f7a8b9c0d1"]
    )

    resolved_by: Optional[str] = Field(
        default=None,
        description="Identifier of the clinician or system resolving this conflict.",
        examples=["dr_sharma", "nurse_patel", "system_auto"]
    )

    reason: Optional[str] = Field(
        default=None,
        description="Free-text explanation of why and how the conflict was resolved.",
        examples=[
            "Hospital discharge dose is post-surgery; clinic dose is long-term maintenance.",
            "Patient confirmed they stopped warfarin 2 weeks ago."
        ]
    )

    chosen_source: Optional[str] = Field(
        default=None,
        description="The source whose medication data was treated as authoritative.",
        examples=["clinic_emr", "hospital_discharge", "patient_reported"]
    )