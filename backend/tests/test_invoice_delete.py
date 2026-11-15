from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.core.db import get_db
from app.main import app
from app.models import (
    Base, Category, Customer, Invoice, InvoiceItem, InvoiceStatus,
    Payment, Product, StockMovement, UserRole,
)


@pytest.fixture
def delete_client():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)

    @event.listens_for(engine, 'connect')
    def enable_foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')

    Base.metadata.create_all(engine)
    with Session(engine) as db:
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=None, role=UserRole.ADMIN)
        try:
            with TestClient(app) as client:
                yield client, db
        finally:
            app.dependency_overrides.clear()
    engine.dispose()


@pytest.mark.parametrize('cancelled', [False, True])
def test_delete_removes_invoice_and_dependents_and_restores_stock_once(delete_client, cancelled):
    client, db = delete_client
    category = Category(name='Test')
    customer = Customer(name='Test', phone='9999999999')
    db.add_all([category, customer])
    db.flush()
    product = Product(name='Test', sku='TEST', category_id=category.id, brand='Test',
                      model='Test', hsn_code='1234', unit_price=100, current_stock=5)
    invoice = Invoice(invoice_number='DELETE-TEST', customer_id=customer.id,
                      grand_total=100, grand_total_words='One hundred',
                      status=InvoiceStatus.CANCELLED if cancelled else InvoiceStatus.PAID)
    db.add_all([product, invoice])
    db.flush()
    db.add(InvoiceItem(invoice_id=invoice.id, product_id=product.id, product_name='Test',
                       sku='TEST', hsn_code='1234', quantity=2, unit_price=50,
                       taxable_value=100, gst_rate=0, line_total=100))
    db.add(Payment(invoice_id=invoice.id, amount=Decimal('100'), payment_mode='Cash'))
    db.commit()
    invoice_id = invoice.id

    response = client.delete(f'/api/invoices/{invoice_id}')
    assert response.status_code == 204, response.text
    assert response.content == b''
    assert db.get(Invoice, invoice_id) is None
    assert db.query(InvoiceItem).count() == 0
    assert db.query(Payment).count() == 0
    db.refresh(product)
    assert product.current_stock == (5 if cancelled else 7)
    assert db.query(StockMovement).count() == (0 if cancelled else 1)
    assert client.delete(f'/api/invoices/{invoice_id}').status_code == 404
    db.refresh(product)
    assert product.current_stock == (5 if cancelled else 7)


def test_delete_requires_admin(delete_client):
    client, _ = delete_client
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=None, role=UserRole.BILLING_STAFF)
    assert client.delete('/api/invoices/1').status_code == 403
