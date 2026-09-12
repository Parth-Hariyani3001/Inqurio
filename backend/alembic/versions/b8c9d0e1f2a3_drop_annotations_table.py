"""drop annotations table

Revision ID: b8c9d0e1f2a3
Revises: 7fe1a1523bcf
Create Date: 2026-09-12 18:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, Sequence[str], None] = "7fe1a1523bcf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("annotations")


def downgrade() -> None:
    op.create_table(
        "annotations",
        sa.Column("uid", sa.Uuid(), nullable=False),
        sa.Column("paper_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("content", sa.TEXT(), nullable=False),
        sa.Column("selection", sa.JSON(), nullable=False),
        sa.Column("color", sa.VARCHAR(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["paper_id"], ["papers.uid"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.uid"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("uid"),
    )
