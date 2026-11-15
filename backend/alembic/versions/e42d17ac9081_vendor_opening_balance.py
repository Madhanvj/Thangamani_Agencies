"""Vendor opening balances and collections against existing dues.

Revision ID: e42d17ac9081
Revises: c81a9f024b10
"""
from alembic import op
import sqlalchemy as sa

revision = 'e42d17ac9081'
down_revision = 'c81a9f024b10'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('customers', sa.Column('opening_balance', sa.Numeric(12, 2), server_default='0', nullable=False))
    op.create_check_constraint('ck_customer_opening_balance', 'customers', 'opening_balance >= 0')
    op.add_column('payments', sa.Column('customer_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_payments_opening_customer', 'payments', 'customers', ['customer_id'], ['id'])
    op.create_index('ix_payments_customer_id', 'payments', ['customer_id'])
    op.alter_column('payments', 'invoice_id', existing_type=sa.Integer(), nullable=True)
    op.create_check_constraint('ck_payment_account', 'payments',
        '(invoice_id IS NOT NULL AND customer_id IS NULL) OR (invoice_id IS NULL AND customer_id IS NOT NULL)')


def downgrade():
    # Retain financial records: removing this migration after collections requires an explicit data conversion.
    connection = op.get_bind()
    if connection.execute(sa.text('SELECT count(*) FROM payments WHERE customer_id IS NOT NULL')).scalar():
        raise RuntimeError('Cannot downgrade while opening balance payments exist.')
    if connection.execute(sa.text('SELECT count(*) FROM customers WHERE opening_balance <> 0')).scalar():
        raise RuntimeError('Cannot downgrade while vendor opening balances exist.')
    op.drop_constraint('ck_payment_account', 'payments', type_='check')
    op.alter_column('payments', 'invoice_id', existing_type=sa.Integer(), nullable=False)
    op.drop_index('ix_payments_customer_id', table_name='payments')
    op.drop_constraint('fk_payments_opening_customer', 'payments', type_='foreignkey')
    op.drop_column('payments', 'customer_id')
    op.drop_constraint('ck_customer_opening_balance', 'customers', type_='check')
    op.drop_column('customers', 'opening_balance')
