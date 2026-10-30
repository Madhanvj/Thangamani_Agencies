from datetime import datetime
import math
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.db import get_db
from app.models import Invoice, InvoiceStatus, UserRole, CompanySetting
from app.schemas.invoice import (
    InvoiceCreate, InvoiceOut, InvoiceListOut, InvoicePreviewRequest, InvoicePreviewOut
)
from app.services.billing_service import (
    create_invoice, cancel_invoice, preview_invoice
)
from app.services.pdf_service import generate_invoice_pdf
from app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.post("/preview", response_model=InvoicePreviewOut)
def preview_invoice_totals(
    preview_req: InvoicePreviewRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        return preview_invoice(db, preview_req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
def create_new_invoice(
    invoice_in: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles(UserRole.ADMIN, UserRole.BILLING_STAFF))
):
    try:
        invoice = create_invoice(db=db, invoice_in=invoice_in, user_id=current_user.id)
        return invoice
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create invoice: {str(e)}")


@router.get("", response_model=InvoiceListOut)
def list_invoices(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: str | None = None,
    status_filter: InvoiceStatus | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Invoice)

    if status_filter:
        query = query.filter(Invoice.status == status_filter)

    if start_date:
        query = query.filter(Invoice.invoice_date >= start_date)

    if end_date:
        query = query.filter(Invoice.invoice_date <= end_date)

    if search:
        s = f"%{search.strip()}%"
        query = query.join(Invoice.customer).filter(
            or_(
                Invoice.invoice_number.ilike(s),
                Invoice.customer.has(Invoice.customer.property.mapper.class_.name.ilike(s)),
                Invoice.customer.has(Invoice.customer.property.mapper.class_.phone.ilike(s))
            )
        )

    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 1
    offset = (page - 1) * limit
    items = query.order_by(Invoice.invoice_date.desc()).offset(offset).limit(limit).all()

    return InvoiceListOut(items=items, total=total, page=page, limit=limit, pages=pages)


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    company_setting = db.query(CompanySetting).first()
    pdf_bytes = generate_invoice_pdf(invoice, company_setting)

    filename = f"Invoice_{invoice.invoice_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/{invoice_id}/cancel", response_model=InvoiceOut)
def cancel_existing_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles(UserRole.ADMIN, UserRole.BILLING_STAFF))
):
    try:
        cancelled = cancel_invoice(db=db, invoice_id=invoice_id, user_id=current_user.id)
        return cancelled
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel invoice: {str(e)}")
