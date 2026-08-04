"""migracion_manual

Revision ID: manual_001
Revises: 
Create Date: 2026-08-04

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'manual_001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar la columna seller_id a la tabla products
    op.add_column('products', sa.Column('seller_id', sa.UUID(), nullable=False))
    op.create_foreign_key('fk_products_seller_id', 'products', 'users', ['seller_id'], ['id'])


def downgrade() -> None:
    # Eliminar la columna seller_id
    op.drop_column('products', 'seller_id')