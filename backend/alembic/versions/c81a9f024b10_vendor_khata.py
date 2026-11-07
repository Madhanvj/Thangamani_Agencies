"""Vendor khata customer fields.

Revision ID: c81a9f024b10
Revises: be0254fb3274
"""
from alembic import op
import sqlalchemy as sa

revision = 'c81a9f024b10'
down_revision = 'be0254fb3274'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('customers', sa.Column('customer_type', sa.String(10), server_default='RETAIL', nullable=False))
    op.add_column('customers', sa.Column('shop_name', sa.String(150), nullable=True))
    op.add_column('customers', sa.Column('credit_limit', sa.Numeric(12, 2), nullable=True))
    op.create_index('ix_customers_customer_type', 'customers', ['customer_type'])
    op.create_check_constraint('ck_customer_type', 'customers', "customer_type IN ('RETAIL', 'VENDOR')")


def downgrade():
    op.drop_constraint('ck_customer_type', 'customers', type_='check')
    op.drop_index('ix_customers_customer_type', table_name='customers')
    op.drop_column('customers', 'credit_limit')
    op.drop_column('customers', 'shop_name')
    op.drop_column('customers', 'customer_type')
