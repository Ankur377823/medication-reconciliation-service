from fastapi import FastAPI
from routes import meds

app = FastAPI()

app.include_router(meds.router)

@app.get("/")
def home():
    return {"message": "Medication Service Running"}