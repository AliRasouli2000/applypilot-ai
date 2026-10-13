
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from models import AIUsage, User
from tests.conftest import TestingSessionLocal
from ai.usage import DAILY_AI_LIMIT, reserve_ai_usage


def create_test_user(db, email):
    user = User(
        email=email,
        hashed_password="test-password-hash",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_five_requests_allowed_and_sixth_rejected(client):
    with TestingSessionLocal() as db:
        user = create_test_user(db, "limit@example.com")

        for _ in range(DAILY_AI_LIMIT):
            reserve_ai_usage(db, user.id)

        with pytest.raises(HTTPException) as error:
            reserve_ai_usage(db, user.id)

        assert error.value.status_code == 429

        usage = db.scalars(
            select(AIUsage).where(AIUsage.user_id == user.id)
        ).all()

        assert len(usage) == DAILY_AI_LIMIT


def test_users_have_separate_limits(client):
    with TestingSessionLocal() as db:
        first_user = create_test_user(db, "first@example.com")
        second_user = create_test_user(db, "second@example.com")

        for _ in range(DAILY_AI_LIMIT):
            reserve_ai_usage(db, first_user.id)

        # A second user should still have their full allowance.
        reserve_ai_usage(db, second_user.id)

        first_count = len(
            db.scalars(
                select(AIUsage).where(AIUsage.user_id == first_user.id)
            ).all()
        )

        second_count = len(
            db.scalars(
                select(AIUsage).where(AIUsage.user_id == second_user.id)
            ).all()
        )

        assert first_count == DAILY_AI_LIMIT
        assert second_count == 1


def test_previous_day_does_not_count(client):
    with TestingSessionLocal() as db:
        user = create_test_user(db, "reset@example.com")

        yesterday = datetime.now(timezone.utc) - timedelta(days=1)

        for _ in range(DAILY_AI_LIMIT):
            db.add(
                AIUsage(
                    user_id=user.id,
                    feature="resume_match",
                    created_at=yesterday,
                )
            )

        db.commit()

        # Yesterday's usage should not block today's requests.
        reserve_ai_usage(db, user.id)

        usage = db.scalars(
            select(AIUsage).where(AIUsage.user_id == user.id)
        ).all()

        assert len(usage) == DAILY_AI_LIMIT + 1
