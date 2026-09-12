"""unique clerk_user_id

Revision ID: c3d4e5f6a7b8
Revises: a2b1c273b5fc
Create Date: 2026-08-29 21:05:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "a2b1c273b5fc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM users AS a
        USING users AS b
        WHERE a.clerk_user_id IS NOT NULL
          AND a.clerk_user_id = b.clerk_user_id
          AND a.uid > b.uid
        """
    )
    op.create_unique_constraint(
        "uq_users_clerk_user_id",
        "users",
        ["clerk_user_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_clerk_user_id", "users", type_="unique")
