"""migracion_avatar

Revision ID: manual_avatar_001
Revises: manual_role_001
Create Date: 2026-08-05

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'manual_avatar_001'
down_revision = 'manual_role_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar la columna avatar a la tabla users
    op.add_column('users', sa.Column('avatar', sa.String(255), nullable=True))


def downgrade() -> None:
    # Eliminar la columna avatar
    op.drop_column('users', 'avatar')