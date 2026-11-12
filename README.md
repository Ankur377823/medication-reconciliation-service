# Medication Reconciliation & Conflict Reporting Service

A FastAPI + MongoDB service that ingests medication lists from multiple clinical sources, detects conflicts across them, and surfaces unresolved conflicts for clinicians and reporting. A React web app sits on top of the API so reviewers can work through conflicts without touching the API directly.

**Live app:** https://medication-reconciliation-service-1-y257.onrender.com/

**API docs (live):** https://medication-reconciliation-service.onrender.com/docs

Both run on Render's free tier, so the first load can take up to a minute while the API wakes up.

The repository holds two independent apps:

| Folder | What it is | Stack |
|--------|------------|-------|
| `backend/` | REST API, conflict detection, reporting | Python, FastAPI, MongoDB |
| `frontend/` | Web app for reviewers | React, Vite, JavaScript |

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB running locally (or a MongoDB Atlas connection string)

### 1. Backend

```bash
git clone https://github.com/Ankur377823/medication-reconciliation-service.git
cd medication-reconciliation-service/backend

# Create and activate a virtual environment
python -m venv myenv
myenv\Scriptsctivate        # Windows
# source myenv/bin/activate   # Mac/Linux

pip install -r requirements.txt

# Create backend/.env
echo MONGO_URL=mongodb://localhost:27017 > .env

uvicorn main:app --reload
```

The API runs at http://localhost:8000, with interactive docs at http://localhost:8000/docs.

### 2. Frontend

In a second terminal:

```bash
cd medication-reconciliation-service/frontend
npm install
npm run dev
```

Open http://localhost:5173. In development the app calls the API at `http://localhost:8000`. To point it somewhere else, copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL`.

### Seed the database (optional)

```bash
cd backend
python seed/seed_data.py
```

This generates 15 synthetic patients across 3 clinics with varied medication snapshots and conflicts. It wipes existing data first.

### Run tests

```bash
cd backend
pytest
```

---

## Frontend

| Page | What it does |
|------|--------------|
| Overview | Totals, workload per clinic, and a review queue sorted by unresolved conflicts |
| Patients | Searchable, sortable patient list with clinic and "needs review" filters |
| Patient record | Conflicts shown as a side-by-side comparison of what each source reported, a resolve dialog that records who, which source and why, and the full medication history as a version timeline |
| Submit medication list | Form for recording a new medication list from a source |

Design choices:
- Colour is reserved for status. Amber marks items that need review, red marks drug interactions, and everything else is neutral. Every status also has a text label, so nothing depends on colour alone.
- Conflicting values are placed side by side rather than described in a sentence, so differences can be compared at a glance.
- Lists are sorted by risk first (most unresolved conflicts, interactions before other conflict types).

---

## Architecture Overview

```
POST /ingest
     │
     ▼
normalize_med()          ← lowercases, strips whitespace from drug names/doses
     │
     ▼
medication_snapshots     ← append-only versioned snapshot stored in MongoDB
     │
     ▼
detect_conflicts()       ← compares new snapshot against all prior snapshots
     │                      for the same patient
     ▼
conflicts collection     ← deduplicated conflict records stored with status=unresolved
```

### Folder Structure

```
├── backend/
│   ├── config/
│   │   └── db.py                   # MongoDB connection, collection references, indexes
│   ├── data/
│   │   └── rules.json              # Static conflict rules (blacklisted drug combos, max doses)
│   ├── model/
│   │   └── schemas.py              # Pydantic V2 request/response models
│   ├── routes/
│   │   └── meds.py                 # All FastAPI route handlers
│   ├── services/
│   │   ├── conflict_engine.py      # Core conflict detection logic
│   │   └── normalize.py            # Drug name/dose normalization
│   ├── seed/
│   │   └── seed_data.py            # Synthetic data generator (15 patients, 3 clinics)
│   ├── tests/                      # Unit and integration tests
│   ├── main.py                     # FastAPI app entry point (CORS, router)
│   ├── requirements.txt
│   ├── pytest.ini
│   └── SCHEMA.md                   # Detailed MongoDB schema + indexing rationale
├── frontend/
│   ├── src/
│   │   ├── api/client.js           # All calls to the backend
│   │   ├── hooks/useAsync.js       # Data loading with cancellation
│   │   ├── utils/format.js         # Dates, labels, conflict type metadata
│   │   ├── styles/                 # Design tokens, base, layout, component styles
│   │   ├── components/
│   │   │   ├── layout/             # App shell, sidebar, API status
│   │   │   ├── ui/                 # Button, Card, DataTable, Dialog, Badge, Field, ...
│   │   │   ├── conflicts/          # ConflictCard, ConflictComparison, ResolveDialog
│   │   │   ├── snapshots/          # SnapshotTimeline
│   │   │   └── ingest/             # MedicationRows
│   │   ├── pages/                  # Overview, Patients, PatientDetail, Ingest
│   │   ├── App.jsx                 # Routes
│   │   └── main.jsx                # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── render.yaml                     # Render deployment config for both apps
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ingest` | Ingest a medication list for a patient from a source |
| GET | `/conflicts/{patient_id}` | List all conflicts for a patient |
| GET | `/snapshots/{patient_id}` | Full medication history for a patient |
| POST | `/resolve` | Mark a conflict as resolved with audit trail |
| GET | `/patients-with-conflicts?clinic_id=X` | Patients in a clinic with ≥1 unresolved conflict |
| GET | `/conflict-stats` | Per-clinic count of patients with ≥2 conflicts (last 30 days) |
| GET | `/patients?clinic_id=X` | All patients with total and unresolved conflict counts (`clinic_id` optional) |

---

## Conflict Types Detected

| Type | Description |
|------|-------------|
| `dose_mismatch` | Same drug appears with different doses across two sources |
| `status_conflict` | Same drug is "active" in one source and "stopped" in another |
| `class_conflict` | Two drugs that must not be combined are both present (per rules.json) |

---

## Deployment (Render)

The two apps are deployed as two Render services from this one repository. `render.yaml` describes both.

**Backend: Web Service**

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Environment | `MONGO_URL` = your MongoDB connection string |
| Environment (optional) | `ALLOWED_ORIGINS` = the frontend URL, to restrict CORS to it. Defaults to any origin. |

**Frontend: Static Site**

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Environment | `VITE_API_URL` = the backend URL, e.g. `https://medication-reconciliation-service.onrender.com` |

`VITE_API_URL` is read at build time, so redeploy the static site after changing it.

---

## Assumptions & Trade-offs

### Versioning — append-only snapshots
Every `/ingest` call creates a **new snapshot** rather than updating the existing one. This gives a complete longitudinal record so clinicians can see exactly what each source reported at each point in time. Trade-off: document count grows with every ingest, but medication lists are small (typically < 20 drugs) so storage is negligible.

### No single "truth source"
Resolution is treated as a **clinical judgment**, not an automatic process. The `conflicts` collection stores `chosen_source`, `reason`, `resolved_by`, and `resolved_at` — a fully auditable trail without data loss. Conflict records are never deleted.

### Static rules file
`rules.json` is a static file of blacklisted drug combinations and max doses. This is intentional — a simple, inspectable, easily editable format that doesn't require a drug database. It can be replaced with a `drug_rules` MongoDB collection or an external API by changing only `conflict_engine.py`.

### clinic_id on patient, not snapshot
`clinic_id` lives on the patient document, not on every snapshot. This is normalized — clinic membership is maintained in one place. It requires a `$lookup` in aggregation queries but avoids data duplication.

### Conflict deduplication
Before storing a new conflict, we check whether an identical unresolved conflict (same patient / drug / type) already exists. This prevents duplicate records when the same conflicting source is re-ingested.

---

## Known Limitations & What I'd Do Next

| Limitation | Next Step |
|------------|-----------|
| `rules.json` dose units not normalized (`1g` vs `1000mg` not caught as equal) | Add a unit normalization layer before dose comparison |
| `max_doses` in `rules.json` is defined but not enforced | Implement overdose detection in `conflict_engine.py` |
| No authentication on any endpoint or in the web app | Add OAuth2 / API key middleware and a sign-in flow |
| `clinic_id` is set to `"unknown"` if not provided on first ingest | Caller should always pass `clinic_id` — could add validation |
| Free Render tier spins down after 15 min inactivity | Use UptimeRobot pinger or upgrade to paid tier |
| No pagination on conflict/snapshot list endpoints | Add `skip`/`limit` query params for large datasets |

---

## Running Tests

Tests use a separate `med_service_test` database that is wiped before every test — your real data is never touched.

```bash
cd backend
pytest
```

**69 tests** across 4 files:

| File | Tests | Covers |
|------|-------|--------|
| `test_normalize.py` | 8 | Normalization edge cases |
| `test_conflict_engine.py` | 24 | Conflict detection logic, deduplication, malformed inputs |
| `test_api.py` | 25 | All endpoints, error handling, versioning |
| `test_aggregations.py` | 12 | Reporting endpoints, date filtering, clinic isolation |

---

## AI Tools Used

I used Claude (Anthropic) during this project. Here's how:

**What I used AI for:**
- Generating the initial Pydantic schema boilerplate and MongoDB aggregation pipeline structure
- Writing the test suite scaffolding (fixture setup, TestClient configuration)
- Debugging the pytest `ModuleNotFoundError` caused by missing `sys.path` configuration

**What I reviewed and changed manually:**
- The conflict detection logic in `conflict_engine.py` — reviewed the deduplication key logic and verified it handles the "A vs B" == "B vs A" ordering correctly
- All MongoDB aggregation pipelines — traced each `$match`, `$lookup`, `$group` stage manually to verify correctness
- The `conftest.py` DB patching strategy — verified that patching at module level (before `main` is imported) is necessary for the monkey-patching to work

**One example where I disagreed with AI output:**
The AI initially suggested using `mongomock` (an in-memory MongoDB mock) for tests. I rejected this because mongomock doesn't fully support all aggregation pipeline stages, which would have made `test_aggregations.py` unreliable. I chose a real test database (`med_service_test`) with a `clean_db` fixture instead — more work to set up but tests the actual MongoDB behavior including aggregations.
