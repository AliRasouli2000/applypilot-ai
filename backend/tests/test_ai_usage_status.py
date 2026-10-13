from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

import ai.routes
from ai.schemas import ResumeMatchResult
from ai.usage import (
    DAILY_AI_LIMIT,
    get_ai_usage_status,
    get_utc_day_bounds,
    reserve_ai_usage,
)
from auth import create_access_token
from models import AIUsage, User
from tests.conftest import TestingSessionLocal


MATCH_REQUEST = {
    "resume_text": (
        "Software developer experienced in Python, FastAPI, PostgreSQL, "
        "REST API development, automated testing, Git and Docker."
    ),
    "job_description": (
        "We are looking for a backend Python developer with experience "
        "building REST APIs and working with relational databases."
    ),
}


def create_user(email):
    with TestingSessionLocal() as db:
        user = User(email=email, hashed_password="test-password-hash")
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.id


def auth_headers(user_id):
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


@pytest.fixture
def mocked_ai(monkeypatch):
    mock = AsyncMock(
        return_value=ResumeMatchResult(
            match_score=80,
            matched_skills=["Python"],
            missing_skills=["AWS"],
            strengths=["Backend experience"],
            improvement_suggestions=["Mention cloud experience"],
            summary="Good match.",
        )
    )
    monkeypatch.setattr(ai.routes, "analyze_resume", mock)
    return mock


def test_usage_requires_authentication(client):
    response = client.get("/ai/usage")

    assert response.status_code == 401


def test_new_user_has_full_allowance(client):
    user_id = create_user("fresh@example.com")

    response = client.get("/ai/usage", headers=auth_headers(user_id))

    assert response.status_code == 200
    body = response.json()
    assert body["limit"] == DAILY_AI_LIMIT
    assert body["used"] == 0
    assert body["remaining"] == DAILY_AI_LIMIT


def test_remaining_decreases_after_each_analysis(client, mocked_ai):
    user_id = create_user("counter@example.com")
    headers = auth_headers(user_id)

    for expected_remaining in range(DAILY_AI_LIMIT - 1, -1, -1):
        match = client.post("/ai/match", json=MATCH_REQUEST, headers=headers)
        assert match.status_code == 200, match.text

        usage = client.get("/ai/usage", headers=headers).json()
        assert usage["remaining"] == expected_remaining
        assert usage["used"] == DAILY_AI_LIMIT - expected_remaining


def test_backend_still_blocks_requests_at_zero(client, mocked_ai):
    user_id = create_user("blocked@example.com")
    headers = auth_headers(user_id)

    for _ in range(DAILY_AI_LIMIT):
        client.post("/ai/match", json=MATCH_REQUEST, headers=headers)

    # Calling the API directly, bypassing the frontend, is still rejected
    response = client.post("/ai/match", json=MATCH_REQUEST, headers=headers)

    assert response.status_code == 429
    assert mocked_ai.await_count == DAILY_AI_LIMIT
    assert client.get("/ai/usage", headers=headers).json()["remaining"] == 0


def test_usage_is_tracked_per_user(client, mocked_ai):
    first = create_user("first-user@example.com")
    second = create_user("second-user@example.com")

    client.post("/ai/match", json=MATCH_REQUEST, headers=auth_headers(first))

    first_usage = client.get("/ai/usage", headers=auth_headers(first)).json()
    second_usage = client.get("/ai/usage", headers=auth_headers(second)).json()

    assert first_usage["remaining"] == DAILY_AI_LIMIT - 1
    assert second_usage["remaining"] == DAILY_AI_LIMIT


def test_previous_day_usage_is_not_counted(client):
    user_id = create_user("yesterday@example.com")
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)

    with TestingSessionLocal() as db:
        for _ in range(DAILY_AI_LIMIT):
            db.add(
                AIUsage(
                    user_id=user_id,
                    feature="resume_match",
                    created_at=yesterday,
                )
            )
        db.commit()

    usage = client.get("/ai/usage", headers=auth_headers(user_id)).json()

    assert usage["remaining"] == DAILY_AI_LIMIT


def test_count_resets_at_next_utc_midnight(client):
    user_id = create_user("midnight@example.com")
    late_evening = datetime(2026, 10, 13, 23, 59, tzinfo=timezone.utc)
    next_morning = datetime(2026, 10, 14, 0, 1, tzinfo=timezone.utc)

    with TestingSessionLocal() as db:
        for _ in range(DAILY_AI_LIMIT):
            db.add(
                AIUsage(
                    user_id=user_id,
                    feature="resume_match",
                    created_at=late_evening,
                )
            )
        db.commit()

        before = get_ai_usage_status(db, user_id, now=late_evening)
        after = get_ai_usage_status(db, user_id, now=next_morning)

    assert before["remaining"] == 0
    assert before["resets_at"] == datetime(2026, 10, 14, tzinfo=timezone.utc)
    assert after["remaining"] == DAILY_AI_LIMIT


def test_resets_at_is_next_utc_midnight(client):
    user_id = create_user("resets@example.com")

    body = client.get("/ai/usage", headers=auth_headers(user_id)).json()
    resets_at = datetime.fromisoformat(body["resets_at"])

    _, expected = get_utc_day_bounds(datetime.now(timezone.utc))
    assert resets_at == expected
    assert resets_at.tzinfo is not None


def test_remaining_never_goes_negative(client):
    user_id = create_user("overflow@example.com")

    with TestingSessionLocal() as db:
        for _ in range(DAILY_AI_LIMIT + 2):
            db.add(AIUsage(user_id=user_id, feature="resume_match"))
        db.commit()

    usage = client.get("/ai/usage", headers=auth_headers(user_id)).json()

    assert usage["remaining"] == 0
    assert usage["used"] == DAILY_AI_LIMIT


def test_utc_day_bounds_handle_other_time_zones():
    # 20:00 on Oct 13 in UTC-7 is 03:00 on Oct 14 in UTC
    pacific = timezone(timedelta(hours=-7))
    start, end = get_utc_day_bounds(datetime(2026, 10, 13, 20, 0, tzinfo=pacific))

    assert start == datetime(2026, 10, 14, tzinfo=timezone.utc)
    assert end == datetime(2026, 10, 15, tzinfo=timezone.utc)


def test_reserve_still_uses_same_day_window(client):
    user_id = create_user("reserve@example.com")

    with TestingSessionLocal() as db:
        reserve_ai_usage(db, user_id)
        status = get_ai_usage_status(db, user_id)

    assert status["remaining"] == DAILY_AI_LIMIT - 1
