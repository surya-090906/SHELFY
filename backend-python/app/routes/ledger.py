from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.database import get_db
from app.models import StockLedger, Product, Location, User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/ledger", tags=["Move History"])


@router.get("", response_model=List[Dict[str, Any]])
def get_ledger_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns the immutable stock ledger movement history for the company.
    Direction: IN for positive delta (green), OUT for negative delta (red).
    """
    entries = (
        db.query(StockLedger)
        .filter(StockLedger.company_id == current_user.company_id)
        .order_by(StockLedger.created_at.desc())
        .limit(100)
        .all()
    )

    result = []
    for row in entries:
        prod = db.query(Product).filter(Product.id == row.product_id).first()
        loc = db.query(Location).filter(Location.id == row.location_id).first()
        delta = float(row.quantity_delta)

        result.append({
            "id": row.id,
            "reference": row.reference,
            "product_id": row.product_id,
            "product_name": prod.name if prod else "Inventory Item",
            "product_sku": prod.sku if prod else "SKU",
            "location_name": loc.name if loc else "Warehouse Bay",
            "quantity_delta": delta,
            "direction": "IN" if delta > 0 else "OUT",
            "movement_type": row.movement_type,
            "created_by": row.created_by,
            "created_at": row.created_at,
        })

    return result
