from datetime import datetime, timezone, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.db import get_db
from app.models import Invoice, InvoiceItem, InvoiceStatus, Product
from app.schemas.dashboard import DashboardMetrics, SalesChartDataPoint, TopProductItem
from app.api.deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/metrics", response_model=DashboardMetrics)
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)
    month_start = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=timezone.utc)

    # Base active invoices filter
    active_invoices = db.query(Invoice).filter(Invoice.status != InvoiceStatus.CANCELLED)

    # Today's sales
    today_sales_val = (
        active_invoices.filter(Invoice.invoice_date >= today_start)
        .with_entities(func.coalesce(func.sum(Invoice.grand_total), Decimal("0.00")))
        .scalar()
    )

    # This month's sales
    month_sales_val = (
        active_invoices.filter(Invoice.invoice_date >= month_start)
        .with_entities(func.coalesce(func.sum(Invoice.grand_total), Decimal("0.00")))
        .scalar()
    )

    # Invoices count
    total_invoices_count = active_invoices.count()
    today_invoices_count = active_invoices.filter(Invoice.invoice_date >= today_start).count()

    # Pending payments
    pending_payments_val = (
        active_invoices.filter(Invoice.status.in_([InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID]))
        .with_entities(func.coalesce(func.sum(Invoice.balance_due), Decimal("0.00")))
        .scalar()
    )

    # Low-stock items count
    low_stock_count = (
        db.query(Product)
        .filter(Product.is_active == True, Product.current_stock <= Product.reorder_level)
        .count()
    )

    # Last 30 days sales trend
    sales_trend_30_days: list[SalesChartDataPoint] = []
    for i in range(29, -1, -1):
        day = now - timedelta(days=i)
        day_start = datetime(day.year, day.month, day.day, 0, 0, 0, tzinfo=timezone.utc)
        day_end = datetime(day.year, day.month, day.day, 23, 59, 59, 999999, tzinfo=timezone.utc)

        day_query = active_invoices.filter(
            Invoice.invoice_date >= day_start,
            Invoice.invoice_date <= day_end
        )
        day_sales = day_query.with_entities(func.coalesce(func.sum(Invoice.grand_total), Decimal("0.00"))).scalar()
        day_count = day_query.count()

        sales_trend_30_days.append(
            SalesChartDataPoint(
                date=day.strftime("%d %b"),
                sales=day_sales,
                invoices=day_count
            )
        )

    # Top selling products
    top_items_query = (
        db.query(
            InvoiceItem.product_id,
            InvoiceItem.product_name,
            InvoiceItem.sku,
            func.sum(InvoiceItem.quantity).label("units_sold"),
            func.sum(InvoiceItem.line_total).label("total_revenue")
        )
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        .filter(Invoice.status != InvoiceStatus.CANCELLED)
        .group_by(InvoiceItem.product_id, InvoiceItem.product_name, InvoiceItem.sku)
        .order_by(func.sum(InvoiceItem.quantity).desc())
        .limit(5)
        .all()
    )

    top_selling_products: list[TopProductItem] = []
    for row in top_items_query:
        prod = db.query(Product).filter(Product.id == row.product_id).first()
        brand = prod.brand if prod else "Brand"
        cat_name = prod.category.name if prod and prod.category else "Category"
        top_selling_products.append(
            TopProductItem(
                product_id=row.product_id,
                name=row.product_name,
                sku=row.sku,
                brand=brand,
                category_name=cat_name,
                units_sold=int(row.units_sold),
                total_revenue=Decimal(str(row.total_revenue))
            )
        )

    return DashboardMetrics(
        today_sales=today_sales_val,
        this_month_sales=month_sales_val,
        total_invoices_count=total_invoices_count,
        today_invoices_count=today_invoices_count,
        pending_payments_amount=pending_payments_val,
        low_stock_items_count=low_stock_count,
        sales_trend_30_days=sales_trend_30_days,
        top_selling_products=top_selling_products
    )
