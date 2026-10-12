"""Add users and application ownership

Revision ID: 0e2370506bcb
Revises: 9b7562dbd217
Create Date: 2026-10-10 19:22:54.096906

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0e2370506bcb'
down_revision: Union[str, Sequence[str], None] = '9b7562dbd217'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    """Add users and application ownership."""

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    op.create_index(
        "ix_users_id",
        "users",
        ["id"],
        unique=False,
    )

    op.add_column(
        "job_applications",
        sa.Column("user_id", sa.Integer(), nullable=False),
    )

    op.create_index(
        "ix_job_applications_user_id",
        "job_applications",
        ["user_id"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_job_applications_user_id",
        "job_applications",
        "users",
        ["user_id"],
        ["id"],
    )


def downgrade() -> None:
    """Remove users and application ownership."""

    op.drop_constraint(
        "fk_job_applications_user_id",
        "job_applications",
        type_="foreignkey",
    )

    op.drop_index(
        "ix_job_applications_user_id",
        table_name="job_applications",
    )

    op.drop_column(
        "job_applications",
        "user_id",
    )

    op.drop_index(
        "ix_users_id",
        table_name="users",
    )

    op.drop_table("users")
