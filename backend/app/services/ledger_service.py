from datetime import datetime, timezone, timedelta
from decimal import Decimal


from sqlalchemy.orm import selectinload
from app.models import Customer, Invoice, InvoiceStatus, Payment
from app.schemas.customer import CustomerOut

ZERO = Decimal('0.00')
IST = timezone(timedelta(hours=5, minutes=30))


def customer_totals(customer):
    invoices = [i for i in customer.invoices if i.status != InvoiceStatus.CANCELLED]
    out = CustomerOut.model_validate(customer)
    out.total_invoices = len(invoices)
    out.total_billed = sum((i.grand_total for i in invoices), ZERO)
    out.total_paid = sum((i.amount_paid for i in invoices), ZERO)
    out.balance_due = sum((i.balance_due for i in invoices), ZERO)
    out.total_spent = float(out.total_billed)
    return out


def allocate_payment(db, customer_id, data, user_id=None):
    try:
        customer = db.query(Customer).filter(Customer.id == customer_id).with_for_update().first()
        if not customer:
            raise LookupError('Customer not found')
        invoices = (db.query(Invoice).filter(Invoice.customer_id == customer_id,
            Invoice.status != InvoiceStatus.CANCELLED, Invoice.balance_due > 0)
            .order_by(Invoice.invoice_date, Invoice.id).with_for_update().all())
        if data.amount > sum((i.balance_due for i in invoices), ZERO):
            raise ValueError('Payment cannot exceed outstanding balance.')
        paid_at = data.payment_date or datetime.now(timezone.utc)
        if paid_at.tzinfo is None:
            paid_at = paid_at.replace(tzinfo=IST)
        if paid_at > datetime.now(timezone.utc):
            raise ValueError('Payment date cannot be in the future.')
        remaining = data.amount
        payments = []
        for invoice in invoices:
            if not remaining:
                break
            if paid_at < aware(invoice.invoice_date):
                raise ValueError('Payment date cannot precede an invoice receiving allocation.')
            amount = min(remaining, invoice.balance_due)
            payment = Payment(invoice_id=invoice.id, amount=amount, payment_mode=data.payment_mode,
                payment_date=paid_at, reference_number=data.reference_number, notes=data.notes, created_by=user_id)
            db.add(payment)
            payments.append(payment)
            invoice.amount_paid += amount
            invoice.balance_due -= amount
            invoice.status = InvoiceStatus.PAID if invoice.balance_due == 0 else InvoiceStatus.PARTIALLY_PAID
            remaining -= amount
        db.commit()
        for payment in payments:
            db.refresh(payment)
        return payments
    except Exception:
        db.rollback()
        raise


def aware(dt):
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def statement(db, customer_id, start_date=None, end_date=None):
    if start_date and end_date and start_date > end_date:
        raise ValueError('Start date must be before end date.')
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise LookupError('Customer not found')
    invoices = (db.query(Invoice).options(selectinload(Invoice.payments))
        .filter(Invoice.customer_id == customer_id, Invoice.status != InvoiceStatus.CANCELLED).all())
    events = []
    for inv in invoices:
        events.append(dict(date=aware(inv.invoice_date), type='INVOICE', id=inv.id,
            description=inv.invoice_number, debit=inv.grand_total, credit=ZERO))
        for pay in inv.payments:
            events.append(dict(date=aware(pay.payment_date), type='PAYMENT', id=pay.id,
                description=f'{pay.payment_mode} - {inv.invoice_number}', reference_number=pay.reference_number,
                notes=pay.notes, debit=ZERO, credit=pay.amount))
    events.sort(key=lambda e: (e['date'], e['type'] != 'INVOICE', e['id']))
    running = ZERO
    opening = ZERO
    rows = []
    for event in events:
        day = event['date'].astimezone(IST).date()
        if end_date and day > end_date:
            continue
        running += event['debit'] - event['credit']
        if start_date and day < start_date:
            opening = running
            continue
        rows.append({**event, 'balance': running})
    return dict(customer=customer_totals(customer), start_date=start_date, end_date=end_date,
        opening_balance=opening, transactions=rows, balance_due=running)

