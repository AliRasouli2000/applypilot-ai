
from datetime import datetime, time, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models import AIUsage, User


DAILY_AI_LIMIT = 5


def get_utc_day_bounds(now: datetime) -> tuple[datetime, datetime]:
    """Return the start and end of the UTC day containing `now`."""
    start_of_day = datetime.combine(
        now.astimezone(timezone.utc).date(),
        time.min,
        tzinfo=timezone.utc,
    )

    return start_of_day, start_of_day + timedelta(days=1)


def count_ai_usage(
    db: Session,
    user_id: int,
    start_of_day: datetime,
    end_of_day: datetime,
) -> int:
    """Count a user's AI requests within one UTC day."""
    return db.scalar(
        select(func.count(AIUsage.id)).where(
            AIUsage.user_id == user_id,
            AIUsage.created_at >= start_of_day,
            AIUsage.created_at < end_of_day,
        )
    ) or 0


def get_ai_usage_status(
    db: Session,
    user_id: int,
    now: datetime | None = None,
) -> dict:
    """Return today's AI usage for a user without reserving anything."""
    now = now or datetime.now(timezone.utc)
    start_of_day, end_of_day = get_utc_day_bounds(now)

    used = count_ai_usage(db, user_id, start_of_day, end_of_day)

    return {
        "limit": DAILY_AI_LIMIT,
        "used": min(used, DAILY_AI_LIMIT),
        "remaining": max(DAILY_AI_LIMIT - used, 0),
        "resets_at": end_of_day,
    }


def reserve_ai_usage(
    db: Session,
    user_id: int,
    feature: str = "resume_match",
) -> None:
    """Atomically reserve one AI request for an authenticated user."""

    now = datetime.now(timezone.utc)
    start_of_day, end_of_day = get_utc_day_bounds(now)

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

        usage_count = count_ai_usage(
            db,
            user_id,
            start_of_day,
            end_of_day,
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
