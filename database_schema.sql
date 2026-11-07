-- ==============================================================================
-- Thangamani Agencies - Complete PostgreSQL Database Schema (DDL)
-- Database Name : thangamani_agencies
-- Schema Name   : store (Custom schema)
-- Includes      : Database & Schema Init, Tables, Types, Constraints, 
--                 Indexes, Sequences, and Official Company Seed Data
-- Compatible with PostgreSQL 14+
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: CREATE DATABASE
-- Run this statement in your PostgreSQL server (e.g., in psql, pgAdmin, or DBeaver)
-- ------------------------------------------------------------------------------
-- CREATE DATABASE thangamani_agencies WITH ENCODING = 'UTF8';

-- In psql command line tool:
-- \c thangamani_agencies;

-- ------------------------------------------------------------------------------
-- STEP 2: CUSTOM SCHEMA INITIALIZATION ('store')
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS store;

-- Set search_path for current and future operations
SET search_path TO store, public;

BEGIN;

-- 1. Alembic Version Table (Tracks schema migration state)
CREATE TABLE IF NOT EXISTS store.alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- 2. Custom Enum Types in 'store' schema
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'userrole' AND n.nspname = 'store') THEN
        CREATE TYPE store.userrole AS ENUM ('ADMIN', 'BILLING_STAFF', 'INVENTORY_MANAGER');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'invoicestatus' AND n.nspname = 'store') THEN
        CREATE TYPE store.invoicestatus AS ENUM ('PAID', 'PARTIALLY_PAID', 'UNPAID', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'paymentmode' AND n.nspname = 'store') THEN
        CREATE TYPE store.paymentmode AS ENUM ('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'discounttype' AND n.nspname = 'store') THEN
        CREATE TYPE store.discounttype AS ENUM ('PERCENTAGE', 'AMOUNT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'movementtype' AND n.nspname = 'store') THEN
        CREATE TYPE store.movementtype AS ENUM ('IN', 'OUT');
    END IF;
END $$;

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS store.categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_categories_id ON store.categories (id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_categories_name ON store.categories (name);

-- 4. Company Settings Table
CREATE TABLE IF NOT EXISTS store.company_settings (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(150) NOT NULL DEFAULT 'Thangamani Agencies',
    gstin VARCHAR(20) NOT NULL DEFAULT '33ABCDE1234F1Z5',
    phone VARCHAR(50) NOT NULL DEFAULT '+91 9500656805',
    email VARCHAR(100) NOT NULL DEFAULT 'madhansankar02@gmail.com',
    address VARCHAR(255) NOT NULL DEFAULT '15, Arumuga Achari St, Dharmapuri, Tamil Nadu 636701',
    state VARCHAR(50) NOT NULL DEFAULT 'Tamil Nadu',
    terms_and_conditions TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_company_settings_id ON store.company_settings (id);

-- 5. Customers & Vendors Table (Includes Khata / B2B Dealer Fields)
CREATE TABLE IF NOT EXISTS store.customers (
    id SERIAL PRIMARY KEY,
    customer_type VARCHAR(10) NOT NULL DEFAULT 'RETAIL',
    shop_name VARCHAR(150),
    credit_limit NUMERIC(12, 2),
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    address VARCHAR(255),
    state VARCHAR(50) NOT NULL DEFAULT 'Tamil Nadu',
    gstin VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_customer_type CHECK (customer_type IN ('RETAIL', 'VENDOR'))
);
CREATE INDEX IF NOT EXISTS ix_customers_id ON store.customers (id);
CREATE INDEX IF NOT EXISTS ix_customers_name ON store.customers (name);
CREATE INDEX IF NOT EXISTS ix_customers_phone ON store.customers (phone);
CREATE INDEX IF NOT EXISTS ix_customers_customer_type ON store.customers (customer_type);

-- 6. Users Table
CREATE TABLE IF NOT EXISTS store.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role store.userrole NOT NULL DEFAULT 'BILLING_STAFF',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_users_id ON store.users (id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON store.users (username);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON store.users (email);

-- 7. Products Table (Includes price_includes_gst)
CREATE TABLE IF NOT EXISTS store.products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    category_id INTEGER NOT NULL REFERENCES store.categories(id),
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    hsn_code VARCHAR(20) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    current_stock INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    price_includes_gst BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT check_stock_non_negative CHECK (current_stock >= 0),
    CONSTRAINT check_price_non_negative CHECK (unit_price >= 0)
);
CREATE INDEX IF NOT EXISTS ix_products_id ON store.products (id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_products_sku ON store.products (sku);
CREATE INDEX IF NOT EXISTS ix_products_category_id ON store.products (category_id);
CREATE INDEX IF NOT EXISTS ix_products_brand ON store.products (brand);
CREATE INDEX IF NOT EXISTS ix_products_hsn_code ON store.products (hsn_code);
CREATE INDEX IF NOT EXISTS ix_products_name ON store.products (name);

-- 8. Invoices Table
CREATE TABLE IF NOT EXISTS store.invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES store.customers(id),
    invoice_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status store.invoicestatus NOT NULL DEFAULT 'UNPAID',
    payment_mode store.paymentmode NOT NULL DEFAULT 'CASH',
    company_state VARCHAR(50) NOT NULL DEFAULT 'Tamil Nadu',
    customer_state VARCHAR(50) NOT NULL DEFAULT 'Tamil Nadu',
    is_interstate BOOLEAN NOT NULL DEFAULT FALSE,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_taxable NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_igst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    round_off NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    grand_total_words VARCHAR(500) NOT NULL,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_by INTEGER REFERENCES store.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_invoices_id ON store.invoices (id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_invoices_invoice_number ON store.invoices (invoice_number);
CREATE INDEX IF NOT EXISTS ix_invoices_customer_id ON store.invoices (customer_id);
CREATE INDEX IF NOT EXISTS ix_invoices_invoice_date ON store.invoices (invoice_date);
CREATE INDEX IF NOT EXISTS ix_invoices_status ON store.invoices (status);
CREATE INDEX IF NOT EXISTS ix_invoices_created_by ON store.invoices (created_by);

-- 9. Invoice Items Table
CREATE TABLE IF NOT EXISTS store.invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES store.invoices(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES store.products(id),
    product_name VARCHAR(200) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    hsn_code VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    price_includes_gst BOOLEAN NOT NULL DEFAULT TRUE,
    discount_type store.discounttype NOT NULL DEFAULT 'PERCENTAGE',
    discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    taxable_value NUMERIC(12, 2) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL,
    cgst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    line_total NUMERIC(12, 2) NOT NULL,
    CONSTRAINT check_item_quantity_positive CHECK (quantity > 0),
    CONSTRAINT check_item_unit_price_non_negative CHECK (unit_price >= 0)
);
CREATE INDEX IF NOT EXISTS ix_invoice_items_id ON store.invoice_items (id);
CREATE INDEX IF NOT EXISTS ix_invoice_items_invoice_id ON store.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS ix_invoice_items_product_id ON store.invoice_items (product_id);

-- 10. Payments Table
CREATE TABLE IF NOT EXISTS store.payments (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES store.invoices(id) ON DELETE CASCADE,
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    amount NUMERIC(12, 2) NOT NULL,
    payment_mode VARCHAR(50) NOT NULL DEFAULT 'Cash',
    reference_number VARCHAR(100),
    notes TEXT,
    created_by INTEGER REFERENCES store.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_payments_id ON store.payments (id);
CREATE INDEX IF NOT EXISTS ix_payments_invoice_id ON store.payments (invoice_id);
CREATE INDEX IF NOT EXISTS ix_payments_created_by ON store.payments (created_by);

-- 11. Stock Movements Table
CREATE TABLE IF NOT EXISTS store.stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES store.products(id),
    type store.movementtype NOT NULL,
    quantity INTEGER NOT NULL,
    reference VARCHAR(200),
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by INTEGER REFERENCES store.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT check_quantity_positive CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS ix_stock_movements_id ON store.stock_movements (id);
CREATE INDEX IF NOT EXISTS ix_stock_movements_product_id ON store.stock_movements (product_id);
CREATE INDEX IF NOT EXISTS ix_stock_movements_created_by ON store.stock_movements (created_by);

-- 12. Stamp Alembic Version
DELETE FROM store.alembic_version;
INSERT INTO store.alembic_version (version_num) VALUES ('c81a9f024b10');

-- ==============================================================================
-- 13. Initial Seed Data (Company Settings & Default Staff Accounts)
-- ==============================================================================

-- Official Company Settings (From Business Profile)
INSERT INTO store.company_settings (id, company_name, gstin, phone, email, address, state, terms_and_conditions)
VALUES (
    1,
    'Thangamani Agencies',
    '33ABCDE1234F1Z5',
    '+91 9500656805',
    'madhansankar02@gmail.com',
    '15, Arumuga Achari St, Dharmapuri, Tamil Nadu 636701',
    'Tamil Nadu',
    '1. Goods once sold will not be taken back without valid reason.' || E'\n' ||
    '2. Standard manufacturer warranty applies.' || E'\n' ||
    '3. Invoices must be presented for warranty claims.' || E'\n' ||
    '4. All disputes are subject to Dharmapuri jurisdiction.'
)
ON CONFLICT (id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    gstin = EXCLUDED.gstin,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    address = EXCLUDED.address,
    state = EXCLUDED.state,
    terms_and_conditions = EXCLUDED.terms_and_conditions;

-- Default Users (Password: admin123, billing123, inventory123)
INSERT INTO store.users (id, username, email, full_name, hashed_password, role, is_active)
VALUES 
    (1, 'admin', 'admin@thangamaniagencies.com', 'Thangamani Ramanathan (Admin)', '$2b$12$6IHdIkunm4lOyM41j8//l.g5puQItc8mlmYlvPZ6Im.g0/pJP8St.', 'ADMIN', TRUE),
    (2, 'billing', 'billing@thangamaniagencies.com', 'Karthik Rajan (Billing Staff)', '$2b$12$0mO93A1iUXJI39GLPEnZ0esGdMHF3ZIeLTq3cNWhFU8LEJz6UHurO', 'BILLING_STAFF', TRUE),
    (3, 'inventory', 'inventory@thangamaniagencies.com', 'Senthil Kumar (Inventory Manager)', '$2b$12$L7AO9iuIqlYfc8jdrcTpIeuV4MbvTLgWUtTuxrj9YPOG1CBWy9UyO', 'INVENTORY_MANAGER', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence IDs
SELECT setval('store.users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM store.users));
SELECT setval('store.company_settings_id_seq', (SELECT COALESCE(MAX(id), 1) FROM store.company_settings));

COMMIT;
