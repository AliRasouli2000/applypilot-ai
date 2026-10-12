
"""Baseline existing schema

Revision ID: 9b7562dbd217
Revises:
Create Date: 2026-10-10 18:39:59.043580
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Alembic revision identifiers
revision: str = "9b7562dbd217"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the original job applications table."""

    op.create_table(
        "job_applications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company", sa.String(length=150), nullable=False),
        sa.Column("job_title", sa.String(length=150), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("application_date", sa.Date(), nullable=False),
        sa.Column("job_url", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_job_applications_id",
        "job_applications",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove the original job applications table."""

    op.drop_index(
        "ix_job_applications_id",
        table_name="job_applications",
    )

    op.drop_table("job_applications")
