import httpx
import json

BASE_URL = "http://localhost:8000/api"

def run_verification():
    print("=" * 60)
    print("RUNNING END-TO-END FLOW VERIFICATION ON THANGAMANI AGENCIES")
    print("=" * 60)

    client = httpx.Client(base_url=BASE_URL, timeout=10.0)

    # 1. Login as Admin
    print("\n1. Logging in as Admin...")
    login_res = client.post("/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   [OK] Logged in successfully. Token acquired.")

    # 2. Create a new test product
    print("\n2. Creating new Product: 'Samsung 55-inch Neo QLED 8K Smart TV'...")
    product_payload = {
        "name": "Samsung 55-inch Neo QLED 8K Smart TV",
        "sku": "TV-SAMS-8K-TEST",
        "category_id": 1,
        "brand": "Samsung",
        "model": "QA55QN700C",
        "hsn_code": "8528",
        "unit_price": 89990.00,
        "gst_rate": 18.00,
        "current_stock": 5,
        "reorder_level": 2,
        "is_active": True
    }
    prod_res = client.post("/products", json=product_payload, headers=headers)
    assert prod_res.status_code in (201, 200), f"Product creation failed: {prod_res.text}"
    prod = prod_res.json()
    prod_id = prod["id"]
    print(f"   [OK] Product created with ID: {prod_id}, Initial Stock: {prod['current_stock']}")

    # 3. Add Stock (Stock IN restock)
    print("\n3. Adding Stock (+5 units) via Stock Adjustment...")
    adj_payload = {
        "product_id": prod_id,
        "type": "IN",
        "quantity": 5,
        "reference": "Supplier Inward Batch #9921"
    }
    adj_res = client.post("/inventory/adjust", json=adj_payload, headers=headers)
    assert adj_res.status_code == 201, f"Stock adjust failed: {adj_res.text}"
    
    # Verify stock increased to 10
    prod_check = client.get(f"/products/{prod_id}", headers=headers).json()
    assert prod_check["current_stock"] == 10, f"Expected stock 10, got {prod_check['current_stock']}"
    print(f"   [OK] Stock verified after IN adjustment: {prod_check['current_stock']} units")

    # 4. Create Invoice (selling 4 units)
    print("\n4. Creating Sale Invoice (Selling 4 units to customer)...")
    inv_payload = {
        "customer": {
            "name": "Karthikeyan Veerappan",
            "phone": "9842199887",
            "email": "karthik.v@gmail.com",
            "address": "15, Meenkarai Road, Pollachi",
            "state": "Tamil Nadu",
            "gstin": None
        },
        "items": [
            {
                "product_id": prod_id,
                "quantity": 4,
                "unit_price": 89990.00,
                "discount_type": "percentage",
                "discount_value": 5.00 # 5% festival discount
            }
        ],
        "payment_mode": "UPI",
        "amount_paid": 403335.00, # Paid in full
        "notes": "Fast-track doorstep delivery"
    }
    inv_res = client.post("/invoices", json=inv_payload, headers=headers)
    assert inv_res.status_code in (201, 200), f"Invoice creation failed: {inv_res.text}"
    inv = inv_res.json()
    inv_id = inv["id"]
    inv_number = inv["invoice_number"]
    print(f"   [OK] Invoice created: {inv_number}")
    print(f"        Taxable Value: Rs. {inv['total_taxable']}")
    print(f"        CGST: Rs. {inv['total_cgst']}, SGST: Rs. {inv['total_sgst']}, IGST: Rs. {inv['total_igst']}")
    print(f"        Grand Total: Rs. {inv['grand_total']} ({inv['grand_total_words']})")
    print(f"        Status: {inv['status']}")

    # 5. Verify stock reduced from 10 to 6
    print("\n5. Verifying Stock Reduction...")
    prod_after_inv = client.get(f"/products/{prod_id}", headers=headers).json()
    assert prod_after_inv["current_stock"] == 6, f"Expected 6, got {prod_after_inv['current_stock']}"
    print(f"   [OK] Stock successfully reduced to {prod_after_inv['current_stock']} units")

    # 6. Test PDF generation endpoint
    print("\n6. Testing PDF Generation endpoint...")
    pdf_res = client.get(f"/invoices/{inv_id}/pdf", headers=headers)
    assert pdf_res.status_code == 200, f"PDF failed: {pdf_res.status_code}"
    assert pdf_res.headers.get("content-type") == "application/pdf"
    assert len(pdf_res.content) > 1000, "PDF content is too small"
    print(f"   [OK] PDF successfully generated ({len(pdf_res.content)} bytes)")

    # 7. Cancel Invoice and verify stock restored
    print("\n7. Cancelling Invoice and Verifying Stock Restoration...")
    cancel_res = client.post(f"/invoices/{inv_id}/cancel", headers=headers)
    assert cancel_res.status_code == 200, f"Cancel failed: {cancel_res.text}"
    cancelled_inv = cancel_res.json()
    assert cancelled_inv["status"] == "CANCELLED"
    print(f"   [OK] Invoice status updated to CANCELLED")

    # Verify stock restored back to 10
    prod_restored = client.get(f"/products/{prod_id}", headers=headers).json()
    assert prod_restored["current_stock"] == 10, f"Expected restored stock 10, got {prod_restored['current_stock']}"
    print(f"   [OK] Stock successfully restored to {prod_restored['current_stock']} units")

    # 8. Test Insufficient Stock Prevention
    print("\n8. Testing Over-stock billing prevention (Requesting 20 when stock is 10)...")
    over_payload = {
        "customer": {
            "name": "Test Customer",
            "phone": "9842199887",
            "state": "Tamil Nadu"
        },
        "items": [
            {
                "product_id": prod_id,
                "quantity": 20 # Exceeds 10
            }
        ],
        "payment_mode": "Cash",
        "amount_paid": 0.00
    }
    over_res = client.post("/invoices", json=over_payload, headers=headers)
    assert over_res.status_code == 400, f"Expected 400, got {over_res.status_code}"
    print(f"   [OK] Backend properly rejected invoice: {over_res.json().get('detail')}")

    print("\n" + "=" * 60)
    print("ALL END-TO-END FLOW VERIFICATION STEPS PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == "__main__":
    run_verification()
