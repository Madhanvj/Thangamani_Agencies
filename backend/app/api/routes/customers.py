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
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Customer)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Customer.name.ilike(s),
                Customer.phone.ilike(s),
                Customer.email.ilike(s),
                Customer.gstin.ilike(s)
            )
        )

    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 1
    offset = (page - 1) * limit
    db_items = query.order_by(Customer.name.asc()).offset(offset).limit(limit).all()

    items = []
    for c in db_items:
        c_out = CustomerOut.model_validate(c)
        c_out.total_invoices = len(c.invoices)
        c_out.total_spent = float(sum(
            inv.grand_total for inv in c.invoices if inv.status != InvoiceStatus.CANCELLED
        ))
        items.append(c_out)

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
    c_out = CustomerOut.model_validate(customer)
    c_out.total_invoices = len(customer.invoices)
    c_out.total_spent = float(sum(
        inv.grand_total for inv in customer.invoices if inv.status != InvoiceStatus.CANCELLED
    ))
    return c_out


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    c_out = CustomerOut.model_validate(customer)
    c_out.total_invoices = len(customer.invoices)
    c_out.total_spent = float(sum(
        inv.grand_total for inv in customer.invoices if inv.status != InvoiceStatus.CANCELLED
    ))
    return c_out


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
    return customer


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
    return customer
