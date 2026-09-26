import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from decimal import Decimal

from app.database import Base, get_db
from app.models import Company, User, Warehouse, Location, Product, StockLedger, Receipt, ReceiptLine, DeliveryOrder, DeliveryLine, OtpCode
from app.services.auth_service import get_password_hash, create_access_token
from main import app

# In-memory SQLite for high-speed isolated automated testing with StaticPool
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    # Create 2 distinct test companies
    c1 = Company(id="comp_1", name="Apex Logistics", short_code="APEX", is_active=True)
    c2 = Company(id="comp_2", name="Omni Warehousing", short_code="OMNI", is_active=True)
    db.add_all([c1, c2])
    db.flush()

    # User in Company 1: manager
    u1_manager = User(
        id="user_1_mgr",
        company_id="comp_1",
        login_id="manager",
        email="manager@apex.com",
        name="Apex Manager",
        password_hash=get_password_hash("Manager@123"),
        role="manager",
        is_active=True,
    )
    # User in Company 1: staff
    u1_staff = User(
        id="user_1_staff",
        company_id="comp_1",
        login_id="staff01",
        email="staff@apex.com",
        name="Apex Staff",
        password_hash=get_password_hash("Staff@123"),
        role="staff",
        is_active=True,
    )
    # User in Company 2: identical login_id ("manager") but different company & password!
    u2_manager = User(
        id="user_2_mgr",
        company_id="comp_2",
        login_id="manager",
        email="manager@omni.com",
        name="Omni Manager",
        password_hash=get_password_hash("DifferentPass@123"),
        role="manager",
        is_active=True,
    )
    db.add_all([u1_manager, u1_staff, u2_manager])

    # Warehouses and locations
    wh1 = Warehouse(id="wh_1", company_id="comp_1", name="Apex Main", code="WH", is_active=True)
    db.add(wh1)
    db.flush()
    loc1 = Location(id="loc_1", company_id="comp_1", warehouse_id="wh_1", name="Stock Bay", code="STOCK", is_default=True)
    db.add(loc1)

    # Product with initial stock in stock_ledger
    p1 = Product(
        id="prod_1",
        company_id="comp_1",
        name="Heavy Steel Pallet",
        sku="PALLET-01",
        uom="Units",
        per_unit_cost=100.0,
        reorder_threshold=10,
        is_active=True,
    )
    db.add(p1)
    db.flush()

    # Initial stock: 20 units in stock_ledger
    ledger = StockLedger(
        company_id="comp_1",
        product_id="prod_1",
        location_id="loc_1",
        quantity_delta=20,
        movement_type="adjustment",
        reference="INIT-STOCK",
    )
    db.add(ledger)
    db.commit()
    db.close()

    yield
    Base.metadata.drop_all(bind=test_engine)


def test_step1_company_search():
    """Step 1: Public unauthenticated company search"""
    res = client.get("/api/companies/search?q=APEX")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["short_code"] == "APEX"
    assert data[0]["name"] == "Apex Logistics"


def test_step2_branded_login_and_company_scoping():
    """Step 2: Branded login scoped to company_id"""
    # 1. Successful login for Apex manager
    res = client.post(
        "/api/auth/login",
        json={"company_id": "APEX", "login_id_or_email": "manager", "password": "Manager@123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["company_code"] == "APEX"
    assert data["user"]["role"] == "manager"

    # 2. Company 2 manager has same login_id but different password
    res2 = client.post(
        "/api/auth/login",
        json={"company_id": "OMNI", "login_id_or_email": "manager", "password": "DifferentPass@123"},
    )
    assert res2.status_code == 200
    assert res2.json()["user"]["company_code"] == "OMNI"

    # 3. Wrong password -> Generic error
    bad_res = client.post(
        "/api/auth/login",
        json={"company_id": "APEX", "login_id_or_email": "manager", "password": "WrongPassword"},
    )
    assert bad_res.status_code == 401
    assert bad_res.json()["detail"] == "Invalid Login Id or Password"


def test_role_enforcement_staff_vs_manager():
    """FastAPI require_manager dependency restricts staff from manager actions"""
    # Staff token
    staff_token = create_access_token({"sub": "user_1_staff", "company_id": "comp_1", "role": "staff"})
    # Manager token
    manager_token = create_access_token({"sub": "user_1_mgr", "company_id": "comp_1", "role": "manager"})

    # Staff trying to create a product -> 403 Forbidden
    res = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"name": "Restricted Item", "sku": "RESTRICT-01", "uom": "Units", "per_unit_cost": 50, "reorder_threshold": 5},
    )
    assert res.status_code == 403
    assert "Manager privileges required" in res.json()["detail"]

    # Manager creating product -> 200 OK
    res_mgr = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {manager_token}"},
        json={"name": "Approved Item", "sku": "APPR-01", "uom": "Units", "per_unit_cost": 50, "reorder_threshold": 5},
    )
    assert res_mgr.status_code == 200
    assert res_mgr.json()["sku"] == "APPR-01"


def test_immutable_stock_ledger_and_calculation():
    """Stock is dynamically computed as SUM(quantity_delta) from stock_ledger"""
    manager_token = create_access_token({"sub": "user_1_mgr", "company_id": "comp_1", "role": "manager"})

    res = client.get("/api/products", headers={"Authorization": f"Bearer {manager_token}"})
    assert res.status_code == 200
    products = res.json()
    assert len(products) >= 1
    # Check initial stock is 20
    pallet = next(p for p in products if p["sku"] == "PALLET-01")
    assert float(pallet["current_stock"]) == 20.0


def test_delivery_shortage_detection_and_dispatch():
    """Deliveries with insufficient stock are set to 'waiting'; sufficient deliveries deduct stock"""
    manager_token = create_access_token({"sub": "user_1_mgr", "company_id": "comp_1", "role": "manager"})

    # Current stock for PALLET-01 is 20.
    # 1. Create Delivery with quantity 50 (> 20) -> must receive status 'waiting'
    d_res = client.post(
        "/api/deliveries",
        headers={"Authorization": f"Bearer {manager_token}"},
        json={
            "customer_name": "Mega Builders",
            "source_location_id": "loc_1",
            "lines": [{"product_id": "prod_1", "quantity_ordered": 50}],
        },
    )
    assert d_res.status_code == 200
    deliv = d_res.json()["delivery"]
    assert deliv["status"] == "waiting"

    # Attempting to validate when short -> 400 Insufficient stock
    val_res = client.post(
        f"/api/deliveries/{deliv['id']}/validate",
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert val_res.status_code == 400
    assert "Insufficient stock" in val_res.json()["detail"]

    # 2. Create Delivery with quantity 5 (<= 20) -> status 'ready' and validatable
    d_res_ok = client.post(
        "/api/deliveries",
        headers={"Authorization": f"Bearer {manager_token}"},
        json={
            "customer_name": "Standard Client",
            "source_location_id": "loc_1",
            "lines": [{"product_id": "prod_1", "quantity_ordered": 5}],
        },
    )
    deliv_ok = d_res_ok.json()["delivery"]
    assert deliv_ok["status"] == "ready"

    # Validate -> Deducts from ledger
    val_ok = client.post(
        f"/api/deliveries/{deliv_ok['id']}/validate",
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert val_ok.status_code == 200

    # Verify new computed stock is 20 - 5 = 15!
    p_check = client.get("/api/products", headers={"Authorization": f"Bearer {manager_token}"})
    pallet_after = next(p for p in p_check.json() if p["sku"] == "PALLET-01")
    assert float(pallet_after["current_stock"]) == 15.0
