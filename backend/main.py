
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import Base, engine, get_db
import models
import crud

from schemas import (
    JobApplicationCreate,
    JobApplicationUpdate,
    JobApplicationResponse,
)

# Create database tables during initial development
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ApplyPilot Lite API",
    description="AI-powered job application tracker",
    version="1.0.0",
)

# Allow React to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "Welcome to ApplyPilot Lite!"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/health/db")
def database_health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {"database": "connected"}


@app.post(
    "/applications",
    response_model=JobApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_job_application(
    data: JobApplicationCreate,
    db: Session = Depends(get_db),
):
    return crud.create_application(db, data)


@app.get(
    "/applications",
    response_model=list[JobApplicationResponse],
)
def list_job_applications(
    db: Session = Depends(get_db),
):
    return crud.get_applications(db)


@app.get(
    "/applications/{application_id}",
    response_model=JobApplicationResponse,
)
def get_job_application(
    application_id: int,
    db: Session = Depends(get_db),
):
    application = crud.get_application(db, application_id)

    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )

    return application


@app.put(
    "/applications/{application_id}",
    response_model=JobApplicationResponse,
)
def update_job_application(
    application_id: int,
    data: JobApplicationUpdate,
    db: Session = Depends(get_db),
):
    application = crud.get_application(db, application_id)

    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )

    return crud.update_application(db, application, data)


@app.delete(
    "/applications/{application_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_job_application(
    application_id: int,
    db: Session = Depends(get_db),
):
    application = crud.get_application(db, application_id)

    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )

    crud.delete_application(db, application)
