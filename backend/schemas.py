
from datetime import date
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class ApplicationStatus(str, Enum):
    applied = "Applied"
    interviewing = "Interviewing"
    offer = "Offer"
    rejected = "Rejected"


class JobApplicationBase(BaseModel):
    company: str = Field(min_length=1, max_length=150)
    job_title: str = Field(min_length=1, max_length=150)
    status: ApplicationStatus = ApplicationStatus.applied
    application_date: date = Field(default_factory=date.today)
    job_url: str | None = None
    notes: str | None = None


class JobApplicationCreate(JobApplicationBase):
    pass


class JobApplicationUpdate(BaseModel):
    company: str | None = Field(default=None, min_length=1, max_length=150)
    job_title: str | None = Field(default=None, min_length=1, max_length=150)
    status: ApplicationStatus | None = None
    application_date: date | None = None
    job_url: str | None = None
    notes: str | None = None


class JobApplicationResponse(JobApplicationBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
