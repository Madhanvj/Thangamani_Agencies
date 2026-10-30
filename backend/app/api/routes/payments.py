from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models import Payment, UserRole
from app.schemas.payment import PaymentCreate, PaymentOut
from app.services.billing_service import add_payment
from app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def record_payment(
    payment_in: PaymentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles(UserRole.ADMIN, UserRole.BILLING_STAFF))
):
    try:
        payment = add_payment(db=db, payment_in=payment_in, user_id=current_user.id)
        return payment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record payment: {str(e)}")


@router.get("/invoice/{invoice_id}", response_model=list[PaymentOut])
def get_invoice_payments(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    payments = db.query(Payment).filter(Payment.invoice_id == invoice_id).order_by(Payment.payment_date.desc()).all()
    return payments
