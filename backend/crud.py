
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import JobApplication
from schemas import JobApplicationCreate, JobApplicationUpdate


def create_application(db: Session, data: JobApplicationCreate):
    application = JobApplication(**data.model_dump())
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


def get_applications(db: Session):
    return db.scalars(
        select(JobApplication).order_by(JobApplication.id.desc())
    ).all()


def get_application(db: Session, application_id: int):
    return db.get(JobApplication, application_id)


def update_application(
    db: Session,
    application: JobApplication,
    data: JobApplicationUpdate
):
    updates = data.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(application, field, value)

    db.commit()
    db.refresh(application)
    return application


def delete_application(db: Session, application: JobApplication):
    db.delete(application)
    db.commit()
