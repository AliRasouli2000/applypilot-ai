
from datetime import date

from sqlalchemy import (
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    applications: Mapped[list["JobApplication"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
    )


class JobApplication(Base):
    __tablename__ = "job_applications"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    company: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    job_title: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="Applied",
        nullable=False,
    )

    application_date: Mapped[date] = mapped_column(
        Date,
        default=date.today,
        nullable=False,
    )

    job_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    owner: Mapped["User"] = relationship(
        back_populates="applications",
    )
