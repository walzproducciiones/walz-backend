"""migracion_role

Revision ID: manual_role_001
Revises: manual_users_001
Create Date: 2026-08-04

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'manual_role_001'
down_revision = 'manual_users_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar la columna role a la tabla users
    op.add_column('users', sa.Column('role', sa.String(30), nullable=False, server_default='COMPRADOR'))


def downgrade() -> None:
    # Eliminar la columna role
    op.drop_column('users', 'role')