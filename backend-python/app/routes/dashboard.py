import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Product, Receipt, DeliveryOrder, StockLedger, User
from app.schemas import DashboardKpiResponse
from app.services.auth_service import get_current_user
from app.services.ledger_service import get_product_stock
from app.services.redis_service import cache

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/kpis", response_model=DashboardKpiResponse)
def get_dashboard_kpis(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns live operations metrics for the tenant.
    Cached in Redis under `dashboard:kpis:{company_id}` for fast response.
    """
    cache_key = f"dashboard:kpis:{current_user.company_id}"
    cached_data = cache.get(cache_key)
    if cached_data:
        try:
            return DashboardKpiResponse(**json.loads(cached_data))
        except Exception:
            pass

    company_id = current_user.company_id

    # 1. Total products
    total_products = db.query(Product).filter(Product.company_id == company_id, Product.is_active == True).count()

    # 2. Pending receipts (draft, ready)
    pending_receipts = (
        db.query(Receipt)
        .filter(Receipt.company_id == company_id, Receipt.status.in_(["draft", "ready"]))
        .count()
    )

    # 3. Pending deliveries (draft, waiting, ready)
    pending_deliveries = (
        db.query(DeliveryOrder)
        .filter(DeliveryOrder.company_id == company_id, DeliveryOrder.status.in_(["draft", "waiting", "ready"]))
        .count()
    )

    # 4. Low stock items calculation from ledger
    products = db.query(Product).filter(Product.company_id == company_id, Product.is_active == True).all()
    low_stock_items = 0
    for p in products:
        stock = get_product_stock(company_id, p.id, db)
        if stock <= p.reorder_threshold:
            low_stock_items += 1

    # 5. Recent movements
    recent_entries = (
        db.query(StockLedger)
        .filter(StockLedger.company_id == company_id)
        .order_by(StockLedger.created_at.desc())
        .limit(5)
        .all()
    )

    movements = []
    for m in recent_entries:
        prod = db.query(Product).filter(Product.id == m.product_id).first()
        movements.append({
            "id": m.id,
            "reference": m.reference,
            "product_name": prod.name if prod else "Item",
            "quantity_delta": float(m.quantity_delta),
            "movement_type": m.movement_type,
            "created_at": m.created_at.strftime("%I:%M %p"),
        })

    response_data = {
        "total_products": total_products,
        "pending_receipts": pending_receipts,
        "pending_deliveries": pending_deliveries,
        "low_stock_items": low_stock_items,
        "recent_movements": movements,
    }

    # Cache for 60 seconds in Redis
    cache.set(cache_key, json.dumps(response_data), ex=60)

    return DashboardKpiResponse(**response_data)
