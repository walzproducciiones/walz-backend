"""migracion_is_active

Revision ID: manual_is_active_001
Revises: manual_avatar_001
Create Date: 2026-08-05

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'manual_is_active_001'
down_revision = 'manual_avatar_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar la columna is_active a la tabla users
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    # Eliminar la columna is_active
    op.drop_column('users', 'is_active')