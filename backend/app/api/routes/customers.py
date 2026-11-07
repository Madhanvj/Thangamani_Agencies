from datetime import date, datetime
from typing import Literal
from fastapi.responses import Response
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from app.models import Payment, UserRole, CompanySetting
from app.api.deps import require_roles
from app.schemas.payment import CustomerPaymentCreate, PaymentOut
from app.services.ledger_service import customer_totals, allocate_payment, statement, IST
from app.services.pdf_service import generate_statement_pdf
import math
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.db import get_db
from app.models import Customer, Invoice, InvoiceStatus
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerOut, CustomerListOut
from app.schemas.invoice import InvoiceOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=CustomerListOut)
def list_customers(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: str | None = None,
    customer_type: Literal['RETAIL', 'VENDOR'] | None = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Customer).options(selectinload(Customer.invoices))
    if customer_type:
        query = query.filter(Customer.customer_type == customer_type)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Customer.name.ilike(s), Customer.shop_name.ilike(s),
                Customer.phone.ilike(s),
                Customer.email.ilike(s),
                Customer.gstin.ilike(s)
            )
        )

    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 1
    offset = (page - 1) * limit
    db_items = query.order_by(Customer.name.asc()).offset(offset).limit(limit).all()

    items = [customer_totals(c) for c in db_items]

    return CustomerListOut(items=items, total=total, page=page, limit=limit, pages=pages)


@router.get("/by-phone/{phone}", response_model=CustomerOut | None)
def get_customer_by_phone(
    phone: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    clean_phone = phone.strip()
    customer = db.query(Customer).filter(Customer.phone == clean_phone).first()
    if not customer:
        return None
    return customer_totals(customer)


@router.get('/khata/summary')
def khata_summary(db: Session = Depends(get_db),
    current_user = Depends(require_roles(UserRole.ADMIN, UserRole.BILLING_STAFF))):
    totals = db.query(func.count(Customer.id)).filter(Customer.customer_type == 'VENDOR').scalar()
    outstanding = db.query(func.coalesce(func.sum(Invoice.balance_due), 0)).join(Customer).filter(
        Customer.customer_type == 'VENDOR', Invoice.status != InvoiceStatus.CANCELLED).scalar()
    now = datetime.now(IST)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    collected = db.query(func.coalesce(func.sum(Payment.amount), 0)).join(Invoice).join(Customer).filter(
        Customer.customer_type == 'VENDOR', Invoice.status != InvoiceStatus.CANCELLED,
        Payment.payment_date >= start, Payment.payment_date <= now).scalar()
    return dict(total_vendors=totals, total_receivables=outstanding, collected_this_month=collected)

@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return customer_totals(customer)


@router.get("/{customer_id}/invoices", response_model=list[InvoiceOut])
def get_customer_invoices(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    invoices = (
        db.query(Invoice)
        .filter(Invoice.customer_id == customer_id)
        .order_by(Invoice.invoice_date.desc())
        .all()
    )
    return invoices


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    customer_in: CustomerCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    existing = db.query(Customer).filter(Customer.phone == customer_in.phone.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Customer with phone '{customer_in.phone}' already exists.")

    customer = Customer(
        customer_type=customer_in.customer_type,
        shop_name=customer_in.shop_name,
        credit_limit=customer_in.credit_limit,
        name=customer_in.name.strip(),
        phone=customer_in.phone.strip(),
        email=customer_in.email.strip() if customer_in.email else None,
        address=customer_in.address.strip() if customer_in.address else None,
        state=customer_in.state.strip(),
        gstin=customer_in.gstin.strip().upper() if customer_in.gstin else None
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer_totals(customer)


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    customer_in: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    if customer_in.phone and customer_in.phone.strip() != customer.phone:
        existing = db.query(Customer).filter(Customer.phone == customer_in.phone.strip()).first()
        if existing:
            raise HTTPException(status_code=400, detail="Phone number is already associated with another customer.")
        customer.phone = customer_in.phone.strip()

    for field in ('customer_type', 'shop_name', 'credit_limit'):
        if field in customer_in.model_fields_set:
            value = getattr(customer_in, field)
            if field == 'customer_type' and value is None:
                raise HTTPException(status_code=422, detail='Customer type cannot be null')
            setattr(customer, field, value)

    if customer_in.name is not None:
        customer.name = customer_in.name.strip()
    if customer_in.email is not None:
        customer.email = customer_in.email.strip() if customer_in.email else None
    if customer_in.address is not None:
        customer.address = customer_in.address.strip() if customer_in.address else None
    if customer_in.state is not None:
        customer.state = customer_in.state.strip()
    if customer_in.gstin is not None:
        customer.gstin = customer_in.gstin.strip().upper() if customer_in.gstin else None

    db.commit()
    db.refresh(customer)
    return customer_totals(customer)


@router.post('/{customer_id}/payments', response_model=list[PaymentOut], status_code=201)
def collect_customer_payment(customer_id: int, data: CustomerPaymentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles(UserRole.ADMIN, UserRole.BILLING_STAFF))):
    try:
        return allocate_payment(db, customer_id, data, current_user.id)
    except LookupError as exc:
        raise HTTPException(404, str(exc))
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@router.get('/{customer_id}/statement')
def customer_statement(customer_id: int, start_date: date | None = None, end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles(UserRole.ADMIN, UserRole.BILLING_STAFF))):
    try:
        return statement(db, customer_id, start_date, end_date)
    except LookupError as exc:
        raise HTTPException(404, str(exc))
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@router.get('/{customer_id}/statement/pdf')
def customer_statement_pdf(customer_id: int, start_date: date | None = None, end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles(UserRole.ADMIN, UserRole.BILLING_STAFF))):
    data = customer_statement(customer_id, start_date, end_date, db, current_user)
    pdf = generate_statement_pdf(data, db.query(CompanySetting).first())
    return Response(pdf, media_type='application/pdf', headers={
        'Content-Disposition': f'attachment; filename="Statement_{customer_id}.pdf"'})


