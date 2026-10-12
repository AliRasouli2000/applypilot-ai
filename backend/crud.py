
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import JobApplication
from schemas import JobApplicationCreate, JobApplicationUpdate


def create_application(
    db: Session,
    data: JobApplicationCreate,
    user_id: int,
):
    application = JobApplication(
        **data.model_dump(),
        user_id=user_id,
    )

    db.add(application)
    db.commit()
    db.refresh(application)

    return application


def get_applications(
    db: Session,
    user_id: int,
):
    statement = (
        select(JobApplication)
        .where(JobApplication.user_id == user_id)
        .order_by(JobApplication.id.desc())
    )

    return db.scalars(statement).all()


def get_application(
    db: Session,
    application_id: int,
    user_id: int,
):
    statement = select(JobApplication).where(
        JobApplication.id == application_id,
        JobApplication.user_id == user_id,
    )

    return db.scalar(statement)


def update_application(
    db: Session,
    application: JobApplication,
    data: JobApplicationUpdate,
):
    updates = data.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(application, field, value)

    db.commit()
    db.refresh(application)

    return application


def delete_application(
    db: Session,
    application: JobApplication,
):
    db.delete(application)
    db.commit()
