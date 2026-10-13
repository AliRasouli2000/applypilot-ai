import os

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from ai.routes import router as ai_router

from sqlalchemy import text, select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import engine, get_db
from models import User
from rate_limit import limit_auth_requests

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

import crud

from schemas import (
    JobApplicationCreate,
    JobApplicationUpdate,
    JobApplicationResponse,
    UserRegister,
    UserResponse,
    UserLogin,
    TokenResponse,
)


# Interactive API docs can be disabled in production with ENABLE_DOCS=false
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "true").lower() == "true"

app = FastAPI(
    title="ApplyPilot Lite API",
    description="AI-powered job application tracker",
    version="1.0.0",
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
)

app.include_router(ai_router)


# Allow React to communicate with FastAPI.
# Production origins are set with a comma-separated CORS_ORIGINS variable.
CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    # Auth uses bearer tokens, not cookies.
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


# --------------------------------------------------
# General endpoints
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Welcome to ApplyPilot Lite!"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.get("/health/db")
def database_health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {
        "database": "connected"
    }


# --------------------------------------------------
# Authentication endpoints
# --------------------------------------------------

@app.post(
    "/auth/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limit_auth_requests)],
)
def register_user(
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
    email = str(user_data.email).lower()

    existing_user = db.scalar(
        select(User).where(User.email == email)
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    new_user = User(
        email=email,
        hashed_password=hash_password(user_data.password),
    )

    db.add(new_user)

    try:
        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    db.refresh(new_user)

    return new_user


@app.post(
    "/auth/login",
    response_model=TokenResponse,
    dependencies=[Depends(limit_auth_requests)],
)
def login_user(
    credentials: UserLogin,
    db: Session = Depends(get_db),
):
    email = str(credentials.email).lower()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    if not user or not verify_password(
        credentials.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    access_token = create_access_token(user.id)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
    )


@app.get(
    "/auth/me",
    response_model=UserResponse,
)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user


# --------------------------------------------------
# Protected job application endpoints
# --------------------------------------------------

@app.post(
    "/applications",
    response_model=JobApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_job_application(
    data: JobApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return crud.create_application(
        db,
        data,
        user_id=current_user.id,
    )


@app.get(
    "/applications",
    response_model=list[JobApplicationResponse],
)
def list_job_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return crud.get_applications(
        db,
        user_id=current_user.id,
    )


@app.get(
    "/applications/{application_id}",
    response_model=JobApplicationResponse,
)
def get_job_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = crud.get_application(
        db,
        application_id,
        user_id=current_user.id,
    )

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
    current_user: User = Depends(get_current_user),
):
    application = crud.get_application(
        db,
        application_id,
        user_id=current_user.id,
    )

    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )

    return crud.update_application(
        db,
        application,
        data,
    )


@app.delete(
    "/applications/{application_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_job_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = crud.get_application(
        db,
        application_id,
        user_id=current_user.id,
    )

    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )

    crud.delete_application(
        db,
        application,
    )

    return None
