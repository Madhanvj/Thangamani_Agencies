from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from app.models import (
    Invoice, InvoiceItem, InvoiceStatus,
    Customer, Product, StockMovement, MovementType,
    CompanySetting, Payment
)
from app.schemas.invoice import InvoiceCreate, InvoicePreviewRequest, InvoicePreviewOut
from app.schemas.payment import PaymentCreate
from app.services.gst_calculator import (
    calculate_line_item, calculate_invoice_totals, quantize_2dec
)
from app.core.config import settings


def get_financial_year(dt: datetime | None = None) -> int:
    """Returns the starting year of Indian financial year (April 1 - March 31)."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    if dt.month >= 4:
        return dt.year
    else:
        return dt.year - 1


def generate_invoice_number(db: Session, dt: datetime | None = None) -> str:
    """Generate sequential invoice number e.g. INV-2026-0001 resetting per FY."""
    fy = get_financial_year(dt)
    prefix = f"INV-{fy}-"

    # Find the highest existing invoice number for this FY prefix
    last_invoice = (
        db.query(Invoice.invoice_number)
        .filter(Invoice.invoice_number.like(f"{prefix}%"))
        .order_by(Invoice.invoice_number.desc())
        .first()
    )

    if last_invoice and last_invoice[0]:
        try:
            last_seq = int(last_invoice[0].replace(prefix, ""))
            next_seq = last_seq + 1
        except ValueError:
            next_seq = 1
    else:
        next_seq = 1

    return f"{prefix}{next_seq:04d}"


def preview_invoice(db: Session, request: InvoicePreviewRequest) -> InvoicePreviewOut:
    """Preview GST calculation without saving or modifying stock."""
    company_setting = db.query(CompanySetting).first()
    company_state = company_setting.state if company_setting else settings.COMPANY_STATE
    is_interstate = request.customer_state.strip().lower() != company_state.strip().lower()

    line_results = []
    item_details = []

    for item in request.items:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if not prod:
            raise ValueError(f"Product with ID {item.product_id} not found.")

        unit_price = item.unit_price if item.unit_price is not None else prod.unit_price
        gst_rate = prod.gst_rate
        price_includes_gst = item.price_includes_gst if item.price_includes_gst is not None else getattr(prod, 'price_includes_gst', True)

        line_calc = calculate_line_item(
            unit_price=unit_price,
            quantity=item.quantity,
            gst_rate=gst_rate,
            discount_type=item.discount_type,
            discount_value=item.discount_value,
            is_interstate=is_interstate,
            price_includes_gst=price_includes_gst
        )
        line_results.append(line_calc)
        item_details.append({
            "product_id": prod.id,
            "product_name": prod.name,
            "sku": prod.sku,
            "hsn_code": prod.hsn_code,
            "quantity": item.quantity,
            "unit_price": unit_price,
            "price_includes_gst": price_includes_gst,
            **line_calc
        })

    totals = calculate_invoice_totals(line_results)

    return InvoicePreviewOut(
        subtotal=totals["subtotal"],
        total_discount=totals["total_discount"],
        total_taxable=totals["total_taxable"],
        is_interstate=is_interstate,
        total_cgst=totals["total_cgst"],
        total_sgst=totals["total_sgst"],
        total_igst=totals["total_igst"],
        round_off=totals["round_off"],
        grand_total=totals["grand_total"],
        grand_total_words=totals["grand_total_words"],
        items=item_details,
        tax_summary=totals["tax_summary"]
    )


def create_invoice(db: Session, invoice_in: InvoiceCreate, user_id: int | None = None) -> Invoice:
    """
    Create invoice, lock & deduct stock, record stock movement, create customer if needed,
    and record initial payment in ONE ATOMIC TRANSACTION.
    """
    company_setting = db.query(CompanySetting).first()
    company_state = company_setting.state if company_setting else settings.COMPANY_STATE

    try:
        # 1. Resolve or create customer
        cust_data = invoice_in.customer
        customer = None
        if cust_data.id:
            customer = db.query(Customer).filter(Customer.id == cust_data.id).first()
        if not customer and cust_data.phone:
            customer = db.query(Customer).filter(Customer.phone == cust_data.phone.strip()).first()

        if not customer:
            customer = Customer(
                name=cust_data.name.strip(),
                phone=cust_data.phone.strip(),
                email=cust_data.email.strip() if cust_data.email else None,
                address=cust_data.address.strip() if cust_data.address else None,
                state=cust_data.state.strip() if cust_data.state else company_state,
                gstin=cust_data.gstin.strip() if cust_data.gstin else None
            )
            db.add(customer)
            db.flush()
        else:
            # Update customer details if provided
            customer.name = cust_data.name.strip()
            if cust_data.email:
                customer.email = cust_data.email.strip()
            if cust_data.address:
                customer.address = cust_data.address.strip()
            if cust_data.state:
                customer.state = cust_data.state.strip()
            if cust_data.gstin:
                customer.gstin = cust_data.gstin.strip()
            db.flush()

        # 2. Determine tax type (Interstate vs Intra-state)
        is_interstate = customer.state.strip().lower() != company_state.strip().lower()

        # 3. Generate invoice number
        invoice_number = generate_invoice_number(db)

        # 4. Process line items with ROW-LEVEL LOCKING on each product
        line_results = []
        db_items_to_create = []

        for item_in in invoice_in.items:
            # Row-level lock on product
            product = db.query(Product).filter(Product.id == item_in.product_id).with_for_update().first()
            if not product:
                raise ValueError(f"Product ID {item_in.product_id} does not exist.")

            if not product.is_active:
                raise ValueError(f"Product '{product.name}' is inactive and cannot be billed.")

            # Validate stock availability
            if product.current_stock < item_in.quantity:
                raise ValueError(
                    f"Insufficient stock for '{product.name}' (SKU: {product.sku}). "
                    f"Requested: {item_in.quantity}, Available: {product.current_stock}."
                )

            unit_price = item_in.unit_price if item_in.unit_price is not None else product.unit_price
            gst_rate = product.gst_rate
            price_includes_gst = item_in.price_includes_gst if item_in.price_includes_gst is not None else getattr(product, 'price_includes_gst', True)

            calc = calculate_line_item(
                unit_price=unit_price,
                quantity=item_in.quantity,
                gst_rate=gst_rate,
                discount_type=item_in.discount_type,
                discount_value=item_in.discount_value,
                is_interstate=is_interstate,
                price_includes_gst=price_includes_gst
            )
            line_results.append(calc)

            # Deduct stock
            product.current_stock -= item_in.quantity

            # Create Stock Movement entry
            movement = StockMovement(
                product_id=product.id,
                type=MovementType.OUT,
                quantity=item_in.quantity,
                reference=f"Sale Invoice #{invoice_number}",
                created_by=user_id
            )
            db.add(movement)

            # Prepare InvoiceItem with snapshots
            inv_item = InvoiceItem(
                product_id=product.id,
                product_name=product.name,
                sku=product.sku,
                hsn_code=product.hsn_code,
                quantity=item_in.quantity,
                unit_price=unit_price,
                price_includes_gst=price_includes_gst,
                discount_type=item_in.discount_type,
                discount_value=item_in.discount_value,
                discount_amount=calc["discount_amount"],
                taxable_value=calc["taxable_value"],
                gst_rate=gst_rate,
                cgst_rate=calc["cgst_rate"],
                cgst_amount=calc["cgst_amount"],
                sgst_rate=calc["sgst_rate"],
                sgst_amount=calc["sgst_amount"],
                igst_rate=calc["igst_rate"],
                igst_amount=calc["igst_amount"],
                line_total=calc["line_total"]
            )
            db_items_to_create.append(inv_item)

        # 5. Calculate totals
        totals = calculate_invoice_totals(line_results)
        grand_total = totals["grand_total"]
        amount_paid = quantize_2dec(invoice_in.amount_paid)

        if amount_paid >= grand_total:
            status = InvoiceStatus.PAID
            balance_due = Decimal("0.00")
            actual_payment_amt = grand_total
        elif amount_paid > Decimal("0.00"):
            status = InvoiceStatus.PARTIALLY_PAID
            balance_due = grand_total - amount_paid
            actual_payment_amt = amount_paid
        else:
            status = InvoiceStatus.UNPAID
            balance_due = grand_total
            actual_payment_amt = Decimal("0.00")

        # 6. Create Invoice record
        invoice = Invoice(
            invoice_number=invoice_number,
            customer_id=customer.id,
            status=status,
            payment_mode=invoice_in.payment_mode,
            company_state=company_state,
            customer_state=customer.state,
            is_interstate=is_interstate,
            subtotal=totals["subtotal"],
            total_discount=totals["total_discount"],
            total_taxable=totals["total_taxable"],
            total_cgst=totals["total_cgst"],
            total_sgst=totals["total_sgst"],
            total_igst=totals["total_igst"],
            round_off=totals["round_off"],
            grand_total=grand_total,
            grand_total_words=totals["grand_total_words"],
            amount_paid=amount_paid,
            balance_due=balance_due,
            notes=invoice_in.notes,
            created_by=user_id,
            items=db_items_to_create
        )
        db.add(invoice)
        db.flush()

        # 7. Record payment if any amount was paid
        if actual_payment_amt > Decimal("0.00"):
            payment = Payment(
                invoice_id=invoice.id,
                amount=actual_payment_amt,
                payment_mode=invoice_in.payment_mode.value,
                reference_number=f"Initial Payment - {invoice_number}",
                notes="Payment received at the time of billing",
                created_by=user_id
            )
            db.add(payment)

        db.commit()
        db.refresh(invoice)
        return invoice

    except Exception:
        db.rollback()
        raise


def cancel_invoice(db: Session, invoice_id: int, user_id: int | None = None) -> Invoice:
    """
    Cancel an invoice (soft-cancel).
    Restores stock for each item using row-level locking and records StockMovement IN.
    Never hard deletes.
    """
    try:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise ValueError(f"Invoice with ID {invoice_id} not found.")

        if invoice.status == InvoiceStatus.CANCELLED:
            raise ValueError("Invoice is already cancelled.")

        # Restore stock for each item with row-level locking
        for item in invoice.items:
            product = db.query(Product).filter(Product.id == item.product_id).with_for_update().first()
            if product:
                product.current_stock += item.quantity
                movement = StockMovement(
                    product_id=product.id,
                    type=MovementType.IN,
                    quantity=item.quantity,
                    reference=f"Restock from Cancelled Invoice #{invoice.invoice_number}",
                    created_by=user_id
                )
                db.add(movement)

        invoice.status = InvoiceStatus.CANCELLED
        invoice.balance_due = Decimal("0.00")
        db.commit()
        db.refresh(invoice)
        return invoice

    except Exception:
        db.rollback()
        raise


def add_payment(db: Session, payment_in: PaymentCreate, user_id: int | None = None) -> Payment:
    """Record later payment against an invoice."""
    try:
        invoice = db.query(Invoice).filter(Invoice.id == payment_in.invoice_id).with_for_update().first()
        if not invoice:
            raise ValueError(f"Invoice with ID {payment_in.invoice_id} not found.")

        if invoice.status == InvoiceStatus.CANCELLED:
            raise ValueError("Cannot record payment for a cancelled invoice.")

        if invoice.balance_due <= Decimal("0.00"):
            raise ValueError("Invoice is already fully paid.")

        pay_amount = quantize_2dec(payment_in.amount)
        if pay_amount > invoice.balance_due:
            raise ValueError(f"Payment amount ({pay_amount}) cannot exceed balance due ({invoice.balance_due}).")

        payment = Payment(
            invoice_id=invoice.id,
            amount=pay_amount,
            payment_mode=payment_in.payment_mode,
            reference_number=payment_in.reference_number,
            notes=payment_in.notes,
            created_by=user_id
        )
        db.add(payment)

        invoice.amount_paid += pay_amount
        invoice.balance_due -= pay_amount

        if invoice.balance_due == Decimal("0.00"):
            invoice.status = InvoiceStatus.PAID
        else:
            invoice.status = InvoiceStatus.PARTIALLY_PAID

        db.commit()
        db.refresh(payment)
        return payment

    except Exception:
        db.rollback()
        raise
