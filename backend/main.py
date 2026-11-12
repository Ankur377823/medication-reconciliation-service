import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import meds

app = FastAPI(title="Medication Reconciliation Service")

# The frontend is deployed as a separate static site, so the browser calls this
# API cross-origin. Set ALLOWED_ORIGINS to a comma-separated list of frontend
# URLs to restrict access; it defaults to any origin.
allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(meds.router)


@app.get("/")
def home():
    return {"message": "Medication Service Running"}
