
from datetime import date

from sqlalchemy import Date, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class JobApplication(Base):
    __tablename__ = "job_applications"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    company: Mapped[str] = mapped_column(
        String(150), nullable=False
    )

    job_title: Mapped[str] = mapped_column(
        String(150), nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(30), default="Applied", nullable=False
    )

    application_date: Mapped[date] = mapped_column(
        Date, default=date.today, nullable=False
    )

    job_url: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    notes: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
