
from unittest.mock import AsyncMock

from ai.schemas import ResumeMatchResult
from ai.service import analyze_resume
from auth import create_access_token
from main import app
from models import User
from tests.conftest import TestingSessionLocal


def test_ai_endpoint_enforces_daily_limit(client):
    # Create a user in the isolated test database.
    with TestingSessionLocal() as db:
        user = User(
            email="ai-route@example.com",
            hashed_password="test-password-hash",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        user_id = user.id

    token = create_access_token(user_id)

    # Mock the AI service to prevent real API calls.
    mocked_analysis = AsyncMock(
        return_value=ResumeMatchResult(
            match_score=80,
            matched_skills=["Python"],
            missing_skills=["AWS"],
            strengths=["Backend development experience"],
            improvement_suggestions=["Highlight relevant cloud experience"],
            summary="Good match for the position.",
        )
    )

    # Patch the function used by the route.
    import ai.routes

    original_analyze_resume = ai.routes.analyze_resume
    ai.routes.analyze_resume = mocked_analysis

    try:
        
        request_data = {
            "resume_text": (
                "Software developer experienced in Python, FastAPI, "
                "PostgreSQL, REST API development, automated testing, "
                "Git, Docker, and backend application development. "
                "Built and tested several web applications."
            ),
            "job_description": (
                "We are looking for a backend Python developer "
                "with experience building REST APIs and working "
                "with cloud infrastructure and relational databases."
            ),
        }


        headers = {"Authorization": f"Bearer {token}"}

        # First five requests should succeed.
        for _ in range(5):
            response = client.post(
                "/ai/match",
                json=request_data,
                headers=headers,
            )
            assert response.status_code == 200, response.text

        # Sixth request must be blocked.
        response = client.post(
            "/ai/match",
            json=request_data,
            headers=headers,
        )

        assert response.status_code == 429
        assert mocked_analysis.await_count == 5

    finally:
        ai.routes.analyze_resume = original_analyze_resume
