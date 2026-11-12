import json
from pathlib import Path

# load rules
with open(Path(__file__).parent.parent / "data" / "rules.json") as f:
    RULES = json.load(f)


def _conflict_key(conflict: dict) -> tuple:
    """
    Produce a hashable key that uniquely identifies a conflict by its
    essential fields.  Used to deduplicate within a single detection run
    so that adding a 3rd snapshot doesn't re-raise conflicts already
    recorded from snapshots 1 & 2.
    """
    return (
        conflict["patient_id"],
        conflict["drug"],
        conflict["type"],
        conflict.get("details", {}).get("dose1", ""),
        conflict.get("details", {}).get("dose2", ""),
    )


def detect_conflicts(patient_id: str, new_meds: list, existing_snapshots_data: list) -> list:
    """
    Compare *new_meds* (from the latest snapshot) against every set of
    meds in *existing_snapshots_data* (list-of-lists, one per prior snapshot).

    Returns a deduplicated list of conflict dicts, each with status="unresolved".
    """
    conflicts = []
    seen_keys: set = set()

    def add_if_new(conflict: dict):
        key = _conflict_key(conflict)
        if key not in seen_keys:
            seen_keys.add(key)
            conflicts.append(conflict)

    for existing_meds in existing_snapshots_data:
        for med1 in new_meds:
            for med2 in existing_meds:

                # --------------------------------------------------
                # 1. SAME DRUG — DOSE MISMATCH
                # --------------------------------------------------
                if med1["name"] == med2["name"]:
                    if med1["dose"] != med2["dose"]:
                        add_if_new({
                            "patient_id": patient_id,
                            "drug": med1["name"],
                            "type": "dose_mismatch",
                            "details": {
                                "dose1": med1["dose"],
                                "dose2": med2["dose"],
                                "source1": med1.get("source", ""),
                                "source2": med2.get("source", ""),
                            },
                            "status": "unresolved"
                        })

                    # --------------------------------------------------
                    # 2. SAME DRUG — STATUS CONFLICT (active vs stopped)
                    # --------------------------------------------------
                    if med1["status"] != med2["status"]:
                        add_if_new({
                            "patient_id": patient_id,
                            "drug": med1["name"],
                            "type": "status_conflict",
                            "details": {
                                "status1": med1["status"],
                                "status2": med2["status"],
                                "source1": med1.get("source", ""),
                                "source2": med2.get("source", ""),
                            },
                            "status": "unresolved"
                        })

                # --------------------------------------------------
                # 3. CLASS CONFLICT — two drugs that must not be combined
                # --------------------------------------------------
                for group in RULES["conflicting_classes"]:
                    if (
                        med1["name"] in group
                        and med2["name"] in group
                        and med1["name"] != med2["name"]
                    ):
                        # normalise ordering so "A vs B" == "B vs A"
                        pair = sorted([med1["name"], med2["name"]])
                        add_if_new({
                            "patient_id": patient_id,
                            "drug": f"{pair[0]} vs {pair[1]}",
                            "type": "class_conflict",
                            "details": {
                                "drug1": pair[0],
                                "drug2": pair[1],
                            },
                            "status": "unresolved"
                        })

    return conflicts