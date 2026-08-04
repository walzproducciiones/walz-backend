"""migracion_users

Revision ID: manual_users_001
Revises: manual_001
Create Date: 2026-08-04

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'manual_users_001'
down_revision = 'manual_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar first_name y last_name a la tabla users
    op.add_column('users', sa.Column('first_name', sa.String(80), nullable=False, server_default=''))
    op.add_column('users', sa.Column('last_name', sa.String(80), nullable=False, server_default=''))


def downgrade() -> None:
    # Eliminar las columnas
    op.drop_column('users', 'last_name')
    op.drop_column('users', 'first_name')