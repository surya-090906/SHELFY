import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models import Company, User, Warehouse, Location, Category, Product, StockLedger
from app.services.auth_service import get_password_hash
from app.services.websocket_manager import ws_manager

# Import Routers
from app.routes import companies, auth, products, receipts, deliveries, ledger, dashboard, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize DB tables
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"[Database Init Warning] {e}")

    # 2. Seed Default Super Admin and Starter Tenants if empty
    db = SessionLocal()
    try:
        # Check Super Admin
        super_admin = db.query(User).filter(User.role == "super_admin").first()
        if not super_admin:
            super_admin = User(
                company_id=None,
                login_id="superadmin",
                email="superadmin@shelfy.local",
                name="Platform Super Administrator",
                password_hash=get_password_hash("SuperAdmin@123"),
                role="super_admin",
                is_active=True,
            )
            db.add(super_admin)
            db.commit()

        # Check Demo Tenants
        comp_apex = db.query(Company).filter(Company.short_code == "APEX").first()
        if not comp_apex:
            comp_apex = Company(
                name="Apex Global Logistics",
                short_code="APEX",
                logo_url=None,
                is_active=True,
            )
            db.add(comp_apex)
            db.flush()

            wh = Warehouse(company_id=comp_apex.id, name="Apex Central Hub", code="WH", is_active=True)
            db.add(wh)
            db.flush()

            loc = Location(company_id=comp_apex.id, warehouse_id=wh.id, name="Primary Stock", code="STOCK", is_default=True)
            db.add(loc)
            db.flush()

            cat = Category(company_id=comp_apex.id, name="Industrial Equipment")
            db.add(cat)
            db.flush()

            p1 = Product(
                company_id=comp_apex.id,
                category_id=cat.id,
                name="Heavy Duty Steel Pallet",
                sku="PALLET-HD-01",
                uom="Units",
                per_unit_cost=145.0,
                reorder_threshold=15,
                is_active=True,
            )
            p2 = Product(
                company_id=comp_apex.id,
                category_id=cat.id,
                name='Pneumatic Control Valve 2"',
                sku="VALVE-PN-02",
                uom="Units",
                per_unit_cost=320.5,
                reorder_threshold=10,
                is_active=True,
            )
            db.add_all([p1, p2])
            db.flush()

            # Seed initial stock ledger
            db.add_all([
                StockLedger(company_id=comp_apex.id, product_id=p1.id, location_id=loc.id, quantity_delta=42, movement_type="adjustment", reference="INIT-STOCK"),
                StockLedger(company_id=comp_apex.id, product_id=p2.id, location_id=loc.id, quantity_delta=4, movement_type="adjustment", reference="INIT-STOCK"),
            ])

            # Seed Manager & Staff
            db.add_all([
                User(company_id=comp_apex.id, login_id="manager", email="suryanarayananr06@gmail.com", name="Apex Manager", password_hash=get_password_hash("Manager@123"), role="manager", is_active=True),
                User(company_id=comp_apex.id, login_id="staff01", email="staff@apex.local", name="Apex Staff", password_hash=get_password_hash("Staff@123"), role="staff", is_active=True),
            ])
            db.commit()

    except Exception as e:
        print(f"[Seed Check Warning] {e}")
    finally:
        db.close()

    yield


app = FastAPI(
    title="Shelfy — Multi-Tenant IMS API",
    description="Python/FastAPI multi-tenant inventory management system with stock ledger architecture, custom SMTP OTP, and WebSockets.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(companies.router)
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(receipts.router)
app.include_router(deliveries.router)
app.include_router(ledger.router)
app.include_router(dashboard.router)
app.include_router(admin.router)


# Realtime WebSocket Endpoint
@app.websocket("/ws/{company_id}")
async def websocket_endpoint(websocket: WebSocket, company_id: str):
    await ws_manager.connect(websocket, company_id)
    try:
        while True:
            # Keep-alive ping
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, company_id)


@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Shelfy Multi-Tenant IMS (FastAPI)",
        "version": "1.0.0",
        "docs_url": "/docs",
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
