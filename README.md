# Thangamani Agencies - Billing & Inventory Management System

A production-grade **Billing and Inventory Management Web Application** designed for home appliance retail businesses in India (selling TVs, refrigerators, washing machines, air conditioners, mixer grinders, etc.). Built strictly with **Python FastAPI, PostgreSQL, SQLAlchemy 2.0 ORM, Alembic, React + TypeScript (Vite)**, and pure CSS.

---

## System Architecture & Tech Stack

### Backend
- **Framework**: Python 3.12 / 3.11+ with **FastAPI**
- **ORM**: **SQLAlchemy 2.0** with strict row-level locking (`SELECT ... FOR UPDATE`)
- **Database**: **PostgreSQL** (`psycopg2-binary`)
- **Migrations**: **Alembic** (fully versioned schemas)
- **Validation**: **Pydantic v2** (`pydantic-settings`)
- **Authentication**: JWT (`python-jose`) with `bcrypt` password hashing
- **PDF Generation**: **ReportLab** (pure Python, zero external system binaries needed)
- **Currency & Words**: `num2words` formatted for Indian Rupee (`en_IN`)

### Frontend
- **Framework**: **React 19 + TypeScript (Vite)**
- **Styling**: Vanilla CSS design system (Inter typography, modern cards, responsive layout, print-optimized media queries)
- **API Client**: Axios with typed request/response interfaces and Bearer token interceptor
- **Routing**: React Router v7 with role-based protected routes
- **Charts**: Recharts (30-day daily sales trend)
- **Icons**: Lucide React

---

## Core Features

1. **Product / Inventory Management**
   - Full CRUD with category filtering, search, and pagination.
   - Fields: SKU, Brand, Model, HSN code, Unit price (excl. GST), GST Rate % (0, 5, 12, 18, 28), Stock, Reorder level.
   - **Stock Movements**: Every stock IN (purchase/restock) and stock OUT (damage/sale) is audited in the `stock_movements` table.
   - **Low-Stock Alerts**: Dashboard banner and highlighted rows when `stock <= reorder_level`.
   - **Inventory Report**: Live stock valuation, units count, and movement history.

2. **GST Billing & Invoicing**
   - **Customer Flow**: Phone number auto-suggests returning customers and auto-fills details.
   - **Product Search**: Fast dropdown with stock indicators, keyboard navigation, and instant addition.
   - **Live Tax Calculation**:
     $$\text{taxable\_value} = (\text{unit\_price} \times \text{qty}) - \text{discount}$$
     $$\text{GST amount} = \text{taxable\_value} \times \frac{\text{gst\_rate}}{100}$$
   - **GST Split Logic**:
     - **Intra-state** ($\text{Customer State} = \text{Company State}$): Split equally into **CGST + SGST**.
     - **Inter-state** ($\text{Customer State} \neq \text{Company State}$): Charged as **IGST**.
     - Company default state: **Tamil Nadu** (configurable in Settings).
   - **Invoice Numbering**: Sequential invoice IDs resetting per financial year (e.g. `INV-2026-0001`).
   - **Concurrency Safety**: Stock deduction happens inside a single database transaction with row-level locking (`with_for_update()`).
   - **Invoice Cancellation**: Soft-cancellation automatically restores all deducted stock into inventory.
   - **Print & PDF**: Professional A4 printable tax invoice format with `@media print` support and backend PDF download.

3. **Roles & Permissions**
   - **Admin**: Complete access (Settings, Inventory, Billing, Reports, Users).
   - **Billing Staff**: Invoice creation, payment collection, customer directory, view products.
   - **Inventory Manager**: Product management, stock adjustments (IN/OUT), inventory valuation reports.

---

## Default User Accounts

| Role | Username | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | Full access to all modules and settings |
| **Billing Staff** | `billing` | `billing123` | Create invoices, view products & customers |
| **Inventory Manager** | `inventory` | `inventory123` | Manage products, restock, damage adjustments |

---

## Manual Installation & Setup Guide

### Prerequisites
- Python 3.11+ installed
- Node.js 18+ and npm installed
- PostgreSQL 14+ installed and running locally on port 5432

---

### Step 1: Database Setup
Connect to PostgreSQL and create the database:
```sql
CREATE DATABASE thangamani_agencies;
```

---

### Step 2: Backend Setup

1. Open a terminal in the project directory:
   ```bash
   cd "d:\Thangamani Agencies\backend"
   ```

2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows (PowerShell):
   ..\.venv\Scripts\Activate.ps1
   # Linux/macOS:
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   Copy `.env.example` to `.env` and verify database credentials:
   ```ini
   DATABASE_URL=postgresql://postgres:1234@localhost:5432/thangamani_agencies
   SECRET_KEY=thangamani-secret-key-change-in-production-2026-super-secure
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=480
   COMPANY_STATE=Tamil Nadu
   COMPANY_NAME=Thangamani Agencies
   COMPANY_GSTIN=33ABCDE1234F1Z5
   COMPANY_PHONE=+91 98765 43210
   COMPANY_EMAIL=contact@thangamaniagencies.com
   COMPANY_ADDRESS=124, Netaji Road, Pollachi, Coimbatore District, Tamil Nadu - 642001
   ```

5. Apply database migrations:
   ```bash
   alembic upgrade head
   ```

6. Seed initial categories, appliances, customers, and user accounts:
   ```bash
   python -m app.seed
   ```

7. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   Interactive OpenAPI documentation is available at: `http://localhost:8000/docs`

---

### Step 3: Frontend Setup

1. Open a separate terminal:
   ```bash
   cd "d:\Thangamani Agencies\frontend"
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Verify `frontend/.env` contains:
   ```ini
   VITE_API_URL=http://localhost:8000/api
   ```

4. Start Vite development server:
   ```bash
   npm run dev
   ```
   The application will be live at: `http://localhost:5173/`

---

## Running the Automated Test Suite

Run unit and integration tests covering GST calculations, stock deduction, insufficient stock prevention, and invoice cancellation:

```bash
cd "d:\Thangamani Agencies\backend"
..\.venv\Scripts\pytest.exe -v
```

### End-to-End Flow Verification Script
Execute the full lifecycle test script:
```bash
..\.venv\Scripts\python.exe verify_flow.py
```
This tests:
1. Admin authentication
2. Product creation
3. Stock IN adjustment (+5 units)
4. Invoice creation with 5% discount & GST split (deducts 4 units)
5. Stock verification (10 -> 6)
6. ReportLab PDF download
7. Invoice cancellation (restores stock from 6 -> 10)
8. Insufficient stock prevention (attempting to bill 20 units when stock is 10)
