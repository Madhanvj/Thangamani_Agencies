from decimal import Decimal
from pydantic import BaseModel


class SalesChartDataPoint(BaseModel):
    date: str
    sales: Decimal
    invoices: int


class TopProductItem(BaseModel):
    product_id: int
    name: str
    sku: str
    brand: str
    category_name: str
    units_sold: int
    total_revenue: Decimal


class DashboardMetrics(BaseModel):
    today_sales: Decimal
    this_month_sales: Decimal
    total_invoices_count: int
    today_invoices_count: int
    pending_payments_amount: Decimal
    low_stock_items_count: int
    sales_trend_30_days: list[SalesChartDataPoint]
    top_selling_products: list[TopProductItem]
