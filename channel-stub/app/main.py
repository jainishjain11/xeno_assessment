from fastapi import FastAPI
from app.routers import send
import logging

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Channel Stub API")

app.include_router(send.router)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "channel-stub"}
