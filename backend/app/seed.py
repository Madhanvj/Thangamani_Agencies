from decimal import Decimal
from app.core.db import SessionLocal
from app.core.security import get_password_hash
from app.models import (
    User, UserRole,
    Category,
    Product,
    StockMovement, MovementType,
    Customer,
    CompanySetting
)


def seed():
    db = SessionLocal()
    try:
        print("Checking existing data...")
        # Check if already seeded
        if db.query(User).first():
            print("Database already has data. Skipping seed.")
            return

        print("Seeding Company Settings...")
        company_setting = CompanySetting(
            company_name="Thangamani Agencies",
            gstin="33ABCDE1234F1Z5",
            phone="+91 98765 43210",
            email="contact@thangamaniagencies.com",
            address="124, Netaji Road, Pollachi, Coimbatore District, Tamil Nadu - 642001",
            state="Tamil Nadu",
            terms_and_conditions=(
                "1. Goods once sold will not be taken back without valid reason.\n"
                "2. Standard manufacturer warranty applies.\n"
                "3. Invoices must be presented for warranty claims.\n"
                "4. All disputes are subject to Pollachi / Coimbatore jurisdiction."
            )
        )
        db.add(company_setting)

        print("Seeding Users...")
        admin_user = User(
            username="admin",
            email="admin@thangamaniagencies.com",
            full_name="Thangamani Ramanathan (Admin)",
            hashed_password=get_password_hash("admin123"),
            role=UserRole.ADMIN,
            is_active=True
        )
        billing_user = User(
            username="billing",
            email="billing@thangamaniagencies.com",
            full_name="Karthik Rajan (Billing Staff)",
            hashed_password=get_password_hash("billing123"),
            role=UserRole.BILLING_STAFF,
            is_active=True
        )
        inventory_user = User(
            username="inventory",
            email="inventory@thangamaniagencies.com",
            full_name="Senthil Kumar (Inventory Manager)",
            hashed_password=get_password_hash("inventory123"),
            role=UserRole.INVENTORY_MANAGER,
            is_active=True
        )
        db.add_all([admin_user, billing_user, inventory_user])
        db.flush()

        print("Seeding Categories...")
        categories_data = [
            {"name": "TV", "description": "Smart LED, OLED, 4K UHD Televisions"},
            {"name": "Refrigerator", "description": "Single Door, Double Door, Side-by-Side Refrigerators"},
            {"name": "Washing Machine", "description": "Front Load, Top Load, Semi-Automatic Washing Machines"},
            {"name": "AC", "description": "Split ACs, Window ACs, Inverter Air Conditioners"},
            {"name": "Mixer Grinder", "description": "Kitchen mixer grinders, wet grinders, food processors"},
            {"name": "Other", "description": "Microwave ovens, water purifiers, small appliances"}
        ]
        category_map = {}
        for cat_info in categories_data:
            cat = Category(name=cat_info["name"], description=cat_info["description"])
            db.add(cat)
            db.flush()
            category_map[cat.name] = cat.id

        print("Seeding Products...")
        products_data = [
            # TV (HSN 8528)
            {"name": "Sony Bravia 55-inch 4K Ultra HD Smart LED TV", "sku": "TV-SONY-55X74L", "category": "TV", "brand": "Sony", "model": "KD-55X74L", "hsn_code": "8528", "unit_price": Decimal("48990.00"), "gst_rate": Decimal("18.00"), "current_stock": 8, "reorder_level": 3},
            {"name": "Samsung 43-inch Crystal 4K Vivid Pro Smart TV", "sku": "TV-SAMS-43CUE60", "category": "TV", "brand": "Samsung", "model": "UA43CUE60AKLXL", "hsn_code": "8528", "unit_price": Decimal("28500.00"), "gst_rate": Decimal("18.00"), "current_stock": 12, "reorder_level": 4},
            {"name": "LG 65-inch 4K OLED evo Smart TV", "sku": "TV-LG-65C3PSA", "category": "TV", "brand": "LG", "model": "OLED65C3PSA", "hsn_code": "8528", "unit_price": Decimal("145000.00"), "gst_rate": Decimal("28.00"), "current_stock": 2, "reorder_level": 2},
            {"name": "Mi 32-inch Horizon Edition HD Ready Smart TV", "sku": "TV-MI-32HORIZON", "category": "TV", "brand": "Xiaomi", "model": "L32M6-EI", "hsn_code": "8528", "unit_price": Decimal("11490.00"), "gst_rate": Decimal("18.00"), "current_stock": 15, "reorder_level": 5},

            # Refrigerator (HSN 8418)
            {"name": "LG 242 L 3-Star Smart Inverter Frost Free Double Door", "sku": "REF-LG-GL-I292", "category": "Refrigerator", "brand": "LG", "model": "GL-I292RPZX", "hsn_code": "8418", "unit_price": Decimal("23990.00"), "gst_rate": Decimal("18.00"), "current_stock": 7, "reorder_level": 3},
            {"name": "Samsung 183 L 4-Star Inverter Direct Cool Single Door", "sku": "REF-SAMS-183L4S", "category": "Refrigerator", "brand": "Samsung", "model": "RR20C1824CR", "hsn_code": "8418", "unit_price": Decimal("15490.00"), "gst_rate": Decimal("18.00"), "current_stock": 14, "reorder_level": 4},
            {"name": "Whirlpool 265 L 3-Star IntelliFresh Inverter Double Door", "sku": "REF-WHIRL-265L", "category": "Refrigerator", "brand": "Whirlpool", "model": "IF INV CNV 278", "hsn_code": "8418", "unit_price": Decimal("26800.00"), "gst_rate": Decimal("18.00"), "current_stock": 3, "reorder_level": 3},
            {"name": "Haier 531 L Inverter Frost Free Side-by-Side Refrigerator", "sku": "REF-HAIER-531L", "category": "Refrigerator", "brand": "Haier", "model": "HRB-550KG", "hsn_code": "8418", "unit_price": Decimal("56990.00"), "gst_rate": Decimal("18.00"), "current_stock": 2, "reorder_level": 2},

            # Washing Machine (HSN 8450)
            {"name": "Bosch 7 kg 5-Star Fully Automatic Front Load", "sku": "WM-BOSCH-7KG-FL", "category": "Washing Machine", "brand": "Bosch", "model": "WAJ2416SIN", "hsn_code": "8450", "unit_price": Decimal("31490.00"), "gst_rate": Decimal("18.00"), "current_stock": 5, "reorder_level": 2},
            {"name": "LG 8 kg 5-Star AI Direct Drive Front Load", "sku": "WM-LG-8KG-AIDD", "category": "Washing Machine", "brand": "LG", "model": "FHP1208Z5M", "hsn_code": "8450", "unit_price": Decimal("38990.00"), "gst_rate": Decimal("18.00"), "current_stock": 4, "reorder_level": 3},
            {"name": "Samsung 7 kg 5-Star Digital Inverter Top Load", "sku": "WM-SAMS-7KG-TL", "category": "Washing Machine", "brand": "Samsung", "model": "WA70A4002GS", "hsn_code": "8450", "unit_price": Decimal("16490.00"), "gst_rate": Decimal("18.00"), "current_stock": 9, "reorder_level": 4},
            {"name": "Whirlpool 7.5 kg 5-Star Semi-Automatic Top Load", "sku": "WM-WHIRL-75-SEMI", "category": "Washing Machine", "brand": "Whirlpool", "model": "SUPERB ATOM 75", "hsn_code": "8450", "unit_price": Decimal("10200.00"), "gst_rate": Decimal("18.00"), "current_stock": 11, "reorder_level": 4},

            # AC (HSN 8415)
            {"name": "Daikin 1.5 Ton 5-Star Inverter Split AC", "sku": "AC-DAIKIN-15T5S", "category": "AC", "brand": "Daikin", "model": "FTKM50U", "hsn_code": "8415", "unit_price": Decimal("44990.00"), "gst_rate": Decimal("28.00"), "current_stock": 6, "reorder_level": 3},
            {"name": "Voltas 1.5 Ton 3-Star Inverter Split AC", "sku": "AC-VOLTAS-15T3S", "category": "AC", "brand": "Voltas", "model": "183V Vectra Prism", "hsn_code": "8415", "unit_price": Decimal("32990.00"), "gst_rate": Decimal("28.00"), "current_stock": 10, "reorder_level": 4},
            {"name": "LG 1.0 Ton 5-Star Dual Inverter Split AC", "sku": "AC-LG-1T5S-DUAL", "category": "AC", "brand": "LG", "model": "RS-Q14YNZE", "hsn_code": "8415", "unit_price": Decimal("36490.00"), "gst_rate": Decimal("28.00"), "current_stock": 3, "reorder_level": 3},
            {"name": "Lloyd 1.5 Ton 3-Star Heavy Duty Inverter Split AC", "sku": "AC-LLOYD-15T3S", "category": "AC", "brand": "Lloyd", "model": "GLS18I3FWCBE", "hsn_code": "8415", "unit_price": Decimal("31990.00"), "gst_rate": Decimal("28.00"), "current_stock": 5, "reorder_level": 2},

            # Mixer Grinder (HSN 8509)
            {"name": "Preethi Zodiac 750-Watt Mixer Grinder with 5 Jars", "sku": "MG-PREETHI-ZODIAC", "category": "Mixer Grinder", "brand": "Preethi", "model": "MG-218", "hsn_code": "8509", "unit_price": Decimal("7890.00"), "gst_rate": Decimal("18.00"), "current_stock": 16, "reorder_level": 5},
            {"name": "Philips HL7756/00 750-Watt Mixer Grinder with 3 Jars", "sku": "MG-PHILIPS-HL7756", "category": "Mixer Grinder", "brand": "Philips", "model": "HL7756/00", "hsn_code": "8509", "unit_price": Decimal("3490.00"), "gst_rate": Decimal("18.00"), "current_stock": 20, "reorder_level": 6},
            {"name": "Butterfly Jet Elite 750-Watt Mixer Grinder with 4 Jars", "sku": "MG-BUTTERFLY-JET", "category": "Mixer Grinder", "brand": "Butterfly", "model": "Jet Elite", "hsn_code": "8509", "unit_price": Decimal("3190.00"), "gst_rate": Decimal("18.00"), "current_stock": 2, "reorder_level": 4}, # low stock test!
            {"name": "Sujata Dynamix 900-Watt Mixer Grinder with 3 Jars", "sku": "MG-SUJATA-DYNAMIX", "category": "Mixer Grinder", "brand": "Sujata", "model": "Dynamix 900W", "hsn_code": "8509", "unit_price": Decimal("5750.00"), "gst_rate": Decimal("18.00"), "current_stock": 8, "reorder_level": 3},

            # Other
            {"name": "IFB 30 L Convection Microwave Oven", "sku": "OTH-IFB-30L-MICR", "category": "Other", "brand": "IFB", "model": "30BRC2", "hsn_code": "8516", "unit_price": Decimal("14290.00"), "gst_rate": Decimal("18.00"), "current_stock": 4, "reorder_level": 2},
        ]

        for p_data in products_data:
            cat_id = category_map[p_data["category"]]
            prod = Product(
                name=p_data["name"],
                sku=p_data["sku"],
                category_id=cat_id,
                brand=p_data["brand"],
                model=p_data["model"],
                hsn_code=p_data["hsn_code"],
                unit_price=p_data["unit_price"],
                gst_rate=p_data["gst_rate"],
                current_stock=p_data["current_stock"],
                reorder_level=p_data["reorder_level"],
                is_active=True,
                price_includes_gst=True
            )
            db.add(prod)
            db.flush()

            # Record initial stock in stock_movements
            movement = StockMovement(
                product_id=prod.id,
                type=MovementType.IN,
                quantity=prod.current_stock,
                reference="Initial Stock / Opening Balance",
                created_by=admin_user.id
            )
            db.add(movement)

        print("Seeding Customers...")
        customers_data = [
            {
                "name": "Murugesan Palanisamy",
                "phone": "9842112345",
                "email": "murugesan.p@gmail.com",
                "address": "45, Gandhi Street, Mahalingapuram, Pollachi",
                "state": "Tamil Nadu",
                "gstin": None
            },
            {
                "name": "Kavitha Sundaram",
                "phone": "9789012345",
                "email": "kavitha.sundar@yahoo.com",
                "address": "12/B, Raja Mill Road, Pollachi",
                "state": "Tamil Nadu",
                "gstin": None
            },
            {
                "name": "Sri Lakshmi Enterprises",
                "phone": "9443212345",
                "email": "accounts@srilakshmient.in",
                "address": "88, Cross Cut Road, Gandhipuram, Coimbatore",
                "state": "Tamil Nadu",
                "gstin": "33AABCS1429B1Z8"
            },
            {
                "name": "Rajesh Electronics & Appliances",
                "phone": "9880198765",
                "email": "rajesh.bangalore@gmail.com",
                "address": "104, 100 Feet Road, Indiranagar, Bengaluru",
                "state": "Karnataka",  # Interstate customer!
                "gstin": "29AABCR8821K1ZM"
            },
            {
                "name": "Mathew Varghese",
                "phone": "9447198765",
                "email": "mathew.varghese@outlook.com",
                "address": "22/1, Palakkad Main Road, Chittur, Palakkad",
                "state": "Kerala",  # Interstate customer!
                "gstin": None
            }
        ]
        for c_data in customers_data:
            customer = Customer(
                name=c_data["name"],
                phone=c_data["phone"],
                email=c_data["email"],
                address=c_data["address"],
                state=c_data["state"],
                gstin=c_data["gstin"]
            )
            db.add(customer)

        db.commit()
        print("Seed completed successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
