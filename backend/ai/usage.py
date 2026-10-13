
from datetime import datetime, time, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models import AIUsage, User


DAILY_AI_LIMIT = 5


def reserve_ai_usage(
    db: Session,
    user_id: int,
    feature: str = "resume_match",
) -> None:
    """Atomically reserve one AI request for an authenticated user."""

    now = datetime.now(timezone.utc)
    start_of_day = datetime.combine(
        now.date(),
        time.min,
        tzinfo=timezone.utc,
    )
    end_of_day = start_of_day + timedelta(days=1)

    try:
        # Serialize reservations for this user.
        user = db.execute(
            select(User)
            .where(User.id == user_id)
            .with_for_update()
        ).scalar_one_or_none()

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User no longer exists.",
            )

        usage_count = db.scalar(
            select(func.count(AIUsage.id)).where(
                AIUsage.user_id == user_id,
                AIUsage.created_at >= start_of_day,
                AIUsage.created_at < end_of_day,
            )
        )

        if usage_count >= DAILY_AI_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Daily AI limit reached. Try again tomorrow (UTC).",
            )

        db.add(
            AIUsage(
                user_id=user_id,
                feature=feature,
                created_at=now,
            )
        )

        db.commit()

    except Exception:
        db.rollback()
        raise
