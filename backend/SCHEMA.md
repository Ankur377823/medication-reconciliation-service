# Medication Reconciliation Service — Schema & Design Decisions

## 1. Collections

### `patients`

Stores one document per patient.

```json
{
  "_id":       "p1",          // string patient identifier (clinic-issued ID)
  "clinic_id": "clinic_1"     // which clinic this patient belongs to
}
```

**Why string `_id`?**  
Patient IDs come from clinic EMR systems and are already meaningful strings (e.g. `MRN-00123`).
Using the natural key avoids a separate `patient_id` field everywhere and makes cross-collection joins readable.

---

### `medication_snapshots`

One document per ingest event.  A patient can have many snapshots — one per source per ingestion.

```json
{
  "_id":        ObjectId,
  "patient_id": "p1",
  "source":     "clinic_emr",          // "clinic_emr" | "hospital_discharge" | "patient_reported"
  "version":    2,                      // monotonically increasing per patient
  "medications": [
    {
      "name":   "paracetamol",          // normalised: lower-cased, stripped
      "dose":   "500mg",
      "status": "active"                // "active" | "stopped"
    }
  ],
  "created_at": ISODate("2025-01-10T09:00:00Z")
}
```

**Versioning decision:**  
Every ingest call creates a *new* snapshot instead of updating the existing one.  
This gives a complete longitudinal record — clinicians can see exactly what each source reported at each point in time.  
Trade-off: document count grows with every ingest, but medication lists are small (typically < 20 drugs) so storage is negligible.

---

### `conflicts`

One document per detected conflict.  Records are never deleted; resolution metadata is appended in-place.

```json
{
  "_id":        ObjectId,
  "patient_id": "p1",
  "drug":       "ibuprofen",             // drug name, or "drugA vs drugB" for class conflicts
  "type":       "dose_mismatch",         // see Conflict Types below
  "details": {
    "dose1":    "200mg",
    "dose2":    "500mg",
    "source1":  "clinic_emr",
    "source2":  "hospital_discharge"
  },
  "status":     "unresolved",            // "unresolved" | "resolved"
  "created_at": ISODate("2025-01-10T09:00:00Z"),

  // Populated on resolution:
  "resolved_by":    "dr_sharma",
  "reason":         "Hospital dose is post-surgery; clinic dose is maintenance.",
  "chosen_source":  "hospital_discharge",
  "resolved_at":    ISODate("2025-01-11T14:22:00Z")
}
```

**Resolution design decision:**  
There is no single "truth source" — resolution is a clinical judgement.  
We store `chosen_source` (which source the clinician trusted), `reason` (free-text explanation), `resolved_by` (auditor identity), and `resolved_at` (timestamp).  
This creates a fully auditable trail without any data loss.

---

## 2. Conflict Types

| `type`           | Description                                                        |
|------------------|--------------------------------------------------------------------|
| `dose_mismatch`  | Same drug appears with different doses across two sources          |
| `status_conflict`| Same drug is "active" in one source and "stopped" in another       |
| `class_conflict` | Two drugs that must not be combined are both present (per rules.json) |

---

## 3. Indexes

| Collection             | Index fields                          | Reason                                                              |
|------------------------|---------------------------------------|---------------------------------------------------------------------|
| `patients`             | `clinic_id ASC`                       | `/patients-with-conflicts` filters by clinic before the $lookup     |
| `medication_snapshots` | `patient_id ASC, version ASC`         | History queries filter by patient and sort by version               |
| `conflicts`            | `patient_id ASC, status ASC`          | Conflict listing and deduplication checks filter on both fields     |
| `conflicts`            | `created_at ASC`                      | `/conflict-stats` filters on a 30-day time range                    |

---

## 4. Denormalisation vs References — Trade-offs

| Aspect | Decision | Trade-off |
|---|---|---|
| Medication list stored inside snapshot | **Denormalised** (embedded array) | Fast reads — one document fetch returns the full list. Downside: if a drug's canonical name changes, old snapshots are not updated (acceptable since they are historical records). |
| `clinic_id` stored on patient, not snapshot | **Reference** (patient doc) | Normalised; `clinic_id` is only maintained in one place. Requires a `$lookup` in aggregation queries. |
| Conflict records separate collection | **Reference** | Conflicts grow independently of patients; enables efficient status filtering and time-range queries without loading patient or snapshot data. |

---

## 5. Future Extensibility

- **Drug database integration:** `rules.json` is a static file today. Replacing it with a `drug_rules` collection (or an external API call) requires changing only `conflict_engine.py`.
- **Multi-tenant / multi-clinic:** `clinic_id` on the patient document means clinic-scoped queries are one `$match` stage away.
- **Soft deletes / archiving:** Snapshots and conflicts are append-only by design. An `archived: true` flag could be added without schema migration.
- **Role-based resolution:** `resolved_by` is currently a free string. It can reference a `users` collection in the future without breaking existing documents.