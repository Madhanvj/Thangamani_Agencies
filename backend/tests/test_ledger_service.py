from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models import Base, Customer, Invoice, InvoiceStatus, Payment
from app.schemas.payment import CustomerPaymentCreate
from app.services.ledger_service import allocate_payment, customer_totals, statement
from app.services.pdf_service import generate_statement_pdf


@pytest.fixture
def ledger_db():
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def invoice(db, customer, number, total, paid=0, days=3, cancelled=False):
    inv = Invoice(customer_id=customer.id, invoice_number=number,
        invoice_date=datetime.now(timezone.utc) - timedelta(days=days),
        grand_total=Decimal(total), grand_total_words='Test', amount_paid=Decimal(paid),
        balance_due=Decimal(total)-Decimal(paid), status=InvoiceStatus.CANCELLED if cancelled else
        InvoiceStatus.PARTIALLY_PAID if paid else InvoiceStatus.UNPAID)
    db.add(inv)
    db.flush()
    if paid:
        db.add(Payment(invoice_id=inv.id, amount=Decimal(paid), payment_mode='Cash', payment_date=inv.invoice_date))
    return inv


def setup(db):
    customer = Customer(name='Vendor', shop_name='Shop', phone='9999999999', customer_type='VENDOR')
    db.add(customer)
    db.flush()
    return customer


def test_fifo_across_partial_and_unpaid_invoices(ledger_db):
    db = ledger_db
    customer = setup(db)
    older = invoice(db, customer, 'OLD', 100, paid=20, days=4)
    newer = invoice(db, customer, 'NEW', 200, days=2)
    cancelled = invoice(db, customer, 'CANCEL', 500, days=5, cancelled=True)
    other = Customer(name='Other', phone='8888888888')
    db.add(other); db.flush()
    untouched = invoice(db, other, 'OTHER', 1000)
    db.commit()
    payments = allocate_payment(db, customer.id, CustomerPaymentCreate(amount=Decimal('130'), payment_mode='UPI', reference_number='REF'))
    assert [p.amount for p in payments] == [Decimal('80'), Decimal('50')]
    assert all(p.reference_number == 'REF' for p in payments)
    assert older.status == InvoiceStatus.PAID
    assert older.balance_due == 0 and older.amount_paid == 100
    assert newer.status == InvoiceStatus.PARTIALLY_PAID
    assert newer.balance_due == 150 and newer.amount_paid == 50
    assert cancelled.status == InvoiceStatus.CANCELLED
    assert untouched.balance_due == 1000
    totals = customer_totals(customer)
    assert (totals.total_billed, totals.total_paid, totals.balance_due) == (300, 150, 150)
    allocate_payment(db, customer.id, CustomerPaymentCreate(amount=Decimal('150')))
    assert newer.status == InvoiceStatus.PAID and newer.balance_due == 0


def test_overpayment_rolls_back_and_does_not_record_payment(ledger_db):
    db = ledger_db
    customer = setup(db)
    inv = invoice(db, customer, 'ONE', 100)
    db.commit()
    with pytest.raises(ValueError, match='exceed'):
        allocate_payment(db, customer.id, CustomerPaymentCreate(amount=Decimal('101')))
    assert db.query(Payment).count() == 0
    assert inv.balance_due == 100 and inv.status == InvoiceStatus.UNPAID


def test_statement_initial_and_later_payments_and_date_range(ledger_db):
    db = ledger_db
    customer = setup(db)
    invoice(db, customer, 'ONE', 100, paid=25, days=10)
    invoice(db, customer, 'VOID', 999, cancelled=True)
    db.commit()
    allocate_payment(db, customer.id, CustomerPaymentCreate(amount=Decimal('20')))
    full = statement(db, customer.id)
    assert [r['balance'] for r in full['transactions']] == [100, 75, 55]
    assert full['balance_due'] == customer_totals(customer).balance_due == 55
    ranged = statement(db, customer.id, start_date=(datetime.now(timezone.utc)-timedelta(days=1)).date())
    assert ranged['opening_balance'] == 75
    assert len(ranged['transactions']) == 1
    assert ranged['balance_due'] == 55
    assert generate_statement_pdf(ranged).startswith(b'%PDF-')


def test_backdated_payment_cannot_precede_allocated_invoice(ledger_db):
    db = ledger_db
    customer = setup(db)
    inv = invoice(db, customer, 'ONE', 100)
    db.commit()
    with pytest.raises(ValueError, match='precede'):
        allocate_payment(db, customer.id, CustomerPaymentCreate(amount=Decimal('20'), payment_date=datetime.now(timezone.utc)-timedelta(days=5)))
    assert inv.balance_due == 100
    assert db.query(Payment).count() == 0


@pytest.mark.parametrize('amount', ['0', '-1', '0.001'])
def test_invalid_payment_amount(amount):
    with pytest.raises(ValueError):
        CustomerPaymentCreate(amount=Decimal(amount))


def test_opening_balance_collections_and_statement(ledger_db):
    db = ledger_db
    customer = setup(db)
    customer.opening_balance = Decimal('250.50')
    customer.created_at = datetime.now(timezone.utc) - timedelta(days=10)
    db.commit()
    assert customer_totals(customer).balance_due == Decimal('250.50')
    payments = allocate_payment(db, customer.id, CustomerPaymentCreate(amount=Decimal('100.25')))
    assert len(payments) == 1
    assert payments[0].invoice_id is None and payments[0].customer_id == customer.id
    totals = customer_totals(customer)
    assert (totals.total_billed, totals.total_paid, totals.balance_due) == (Decimal('250.50'), Decimal('100.25'), Decimal('150.25'))
    full = statement(db, customer.id)
    assert [r['type'] for r in full['transactions']] == ['OPENING_BALANCE', 'PAYMENT']
    assert full['balance_due'] == Decimal('150.25')
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).astimezone(timezone(timedelta(hours=5, minutes=30))).date()
    ranged = statement(db, customer.id, start_date=yesterday)
    assert ranged['opening_balance'] == Decimal('250.50')
    assert len(ranged['transactions']) == 1
    assert generate_statement_pdf(full).startswith(b'%PDF-')
    with pytest.raises(ValueError, match='exceed'):
        allocate_payment(db, customer.id, CustomerPaymentCreate(amount=Decimal('150.26')))
    allocate_payment(db, customer.id, CustomerPaymentCreate(amount=Decimal('150.25')))
    assert customer_totals(customer).balance_due == 0


def test_opening_balance_paid_before_invoices_and_rollback(ledger_db):
    db = ledger_db
    customer = setup(db)
    customer.opening_balance = Decimal('100')
    customer.created_at = datetime.now(timezone.utc) - timedelta(days=10)
    inv = invoice(db, customer, 'NEW', 200, days=2)
    db.commit()
    with pytest.raises(ValueError, match='precede'):
        allocate_payment(db, customer.id, CustomerPaymentCreate(amount=Decimal('150'),
            payment_date=datetime.now(timezone.utc) - timedelta(days=5)))
    assert db.query(Payment).count() == 0
    assert customer_totals(customer).balance_due == 300
    payments = allocate_payment(db, customer.id, CustomerPaymentCreate(amount=Decimal('150')))
    assert [(p.invoice_id, p.amount) for p in payments] == [(None, Decimal('100')), (inv.id, Decimal('50'))]
    assert customer_totals(customer).balance_due == statement(db, customer.id)['balance_due'] == 150


@pytest.mark.parametrize('amount', ['-1', '0.001', '10000000000', 'NaN', 'Infinity'])
def test_invalid_opening_balance(amount):
    from app.schemas.customer import CustomerCreate
    with pytest.raises(ValueError):
        CustomerCreate(name='Vendor', phone='9999999999', customer_type='VENDOR', opening_balance=amount)


def test_customer_api_filter_summary_and_statement(ledger_db):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.db import get_db
    from app.api.deps import get_current_user
    from app.models import UserRole
    from types import SimpleNamespace
    db = ledger_db
    customer = setup(db)
    invoice(db, customer, 'API', 100, paid=10)
    db.commit()
    # Use the same in-memory connection in the request worker.
    from sqlalchemy.pool import StaticPool
    api_engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(api_engine)
    with Session(api_engine) as api_db:
        api_customer = setup(api_db)
        invoice(api_db, api_customer, 'API', 100, paid=10)
        api_db.commit()
        app.dependency_overrides[get_db] = lambda: api_db
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=None, role=UserRole.ADMIN, is_active=True)
        try:
            with TestClient(app) as client:
                listing = client.get('/api/customers', params={'customer_type': 'VENDOR'})
                assert listing.status_code == 200
                assert listing.json()['items'][0]['balance_due'] == '90.00'
                summary = client.get('/api/customers/khata/summary')
                assert summary.status_code == 200
                assert summary.json()['total_vendors'] == 1
                result = client.post(f'/api/customers/{api_customer.id}/payments', json={'amount': '30', 'payment_mode': 'UPI'})
                assert result.status_code == 201
                result = client.get(f'/api/customers/{api_customer.id}/statement')
                assert result.status_code == 200
                assert Decimal(str(result.json()['balance_due'])) == 60
                pdf = client.get(f'/api/customers/{api_customer.id}/statement/pdf')
                assert pdf.status_code == 200 and pdf.content.startswith(b'%PDF-')
                baseline = client.get('/api/customers/khata/summary').json()
                created = client.post('/api/customers', json={'name': 'Existing vendor', 'phone': '7777777777',
                    'customer_type': 'VENDOR', 'opening_balance': '125.50'})
                assert created.status_code == 201
                assert Decimal(created.json()['balance_due']) == Decimal('125.50')
                vendor_id = created.json()['id']
                paid = client.post(f'/api/customers/{vendor_id}/payments', json={'amount': '25.50'})
                assert paid.status_code == 201 and paid.json()[0]['invoice_id'] is None
                updated = client.get('/api/customers/khata/summary').json()
                assert Decimal(str(updated['total_receivables'])) == Decimal(str(baseline['total_receivables'])) + 100
                assert Decimal(str(updated['collected_this_month'])) == Decimal(str(baseline['collected_this_month'])) + Decimal('25.50')
                ledger = client.get(f'/api/customers/{vendor_id}/statement').json()
                assert ledger['transactions'][0]['type'] == 'OPENING_BALANCE'
                assert Decimal(str(ledger['balance_due'])) == 100
                edited = client.put(f'/api/customers/{vendor_id}', json={
                    'name': 'Updated vendor', 'shop_name': 'New shop', 'phone': '7777777778',
                    'address': 'Updated address', 'state': 'Tamil Nadu', 'gstin': ''})
                assert edited.status_code == 200
                assert edited.json()['name'] == 'Updated vendor'
                assert edited.json()['shop_name'] == 'New shop'
                assert edited.json()['phone'] == '7777777778'
                assert Decimal(edited.json()['opening_balance']) == Decimal('125.50')
                assert Decimal(edited.json()['balance_due']) == 100
                after_edit = client.get(f'/api/customers/{vendor_id}/statement').json()
                assert after_edit['transactions'] == ledger['transactions']
                duplicate_phone = client.put(f'/api/customers/{vendor_id}', json={'phone': api_customer.phone})
                assert duplicate_phone.status_code == 400
                assert client.get(f'/api/customers/{vendor_id}/statement/pdf').content.startswith(b'%PDF-')
                blank = client.post('/api/customers', json={'name': 'New vendor', 'phone': '6666666666', 'customer_type': 'VENDOR'})
                assert blank.status_code == 201 and Decimal(blank.json()['balance_due']) == 0
                invalid = client.post('/api/customers', json={'name': 'Invalid', 'phone': '5555555555', 'opening_balance': '10'})
                assert invalid.status_code == 422
                app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=None, role=UserRole.INVENTORY_MANAGER, is_active=True)
                assert client.post(f'/api/customers/{api_customer.id}/payments', json={'amount': '10'}).status_code == 403
        finally:
            app.dependency_overrides.clear()
    api_engine.dispose()
