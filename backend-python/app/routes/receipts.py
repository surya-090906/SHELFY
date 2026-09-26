import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.database import get_db
from app.models import Receipt, ReceiptLine, DeliveryOrder, DeliveryLine, StockLedger, AuditLog, User
from app.schemas import ReceiptCreate
from app.services.auth_service import get_current_user
from app.services.ledger_service import get_next_reference, get_product_stock, invalidate_product_stock
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/api/receipts", tags=["Receipts"])


@router.get("")
def list_receipts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    receipts = (
        db.query(Receipt)
        .filter(Receipt.company_id == current_user.company_id)
        .order_by(Receipt.created_at.desc())
        .all()
    )
    result = []
    for r in receipts:
        lines = []
        for l in r.lines:
            lines.append({
                "id": l.id,
                "product_id": l.product_id,
                "quantity_expected": float(l.quantity_expected),
                "quantity_received": float(l.quantity_received),
                "unit_cost": float(l.unit_cost),
            })
        result.append({
            "id": r.id,
            "reference": r.reference,
            "supplier_name": r.supplier_name,
            "destination_location_id": r.destination_location_id,
            "status": r.status,
            "notes": r.notes,
            "created_at": r.created_at,
            "lines": lines,
        })
    return result


@router.post("")
def create_receipt(
    req: ReceiptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ref = get_next_reference(current_user.company_id, "IN", "WH", db)

    receipt = Receipt(
        company_id=current_user.company_id,
        reference=ref,
        supplier_name=req.supplier_name,
        destination_location_id=req.destination_location_id,
        status="ready",  # Default ready to receive
        notes=req.notes,
        created_by=current_user.id,
    )
    db.add(receipt)
    db.flush()

    for line_in in req.lines:
        line = ReceiptLine(
            receipt_id=receipt.id,
            company_id=current_user.company_id,
            product_id=line_in.product_id,
            quantity_expected=line_in.quantity_expected,
            quantity_received=line_in.quantity_expected,
            unit_cost=line_in.unit_cost or Decimal("0.00"),
        )
        db.add(line)

    db.commit()
    db.refresh(receipt)
    return {"success": True, "receipt": {"id": receipt.id, "reference": receipt.reference, "status": receipt.status}}


@router.post("/{receipt_id}/validate")
async def validate_receipt(
    receipt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Validates an Inbound Receipt:
    1. Updates status to 'done' (immutable)
    2. Inserts positive quantity entries (+qty) into stock_ledger
    3. Invalidates product stock cache
    4. Triggers restocking check on waiting delivery orders
    5. Broadcasts realtime update to connected WebSocket clients
    """
    receipt = (
        db.query(Receipt)
        .filter(Receipt.id == receipt_id, Receipt.company_id == current_user.company_id)
        .first()
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if receipt.status == "done":
        raise HTTPException(status_code=400, detail="Receipt is already validated and immutable.")

    receipt.status = "done"
    receipt.validated_at = datetime.datetime.utcnow()

    # Insert into stock ledger
    for line in receipt.lines:
        ledger_entry = StockLedger(
            company_id=current_user.company_id,
            product_id=line.product_id,
            location_id=receipt.destination_location_id,
            quantity_delta=line.quantity_expected,
            movement_type="receipt",
            reference=receipt.reference,
            created_by=current_user.id,
        )
        db.add(ledger_entry)
        invalidate_product_stock(current_user.company_id, line.product_id)

    # Audit log
    audit = AuditLog(
        company_id=current_user.company_id,
        user_id=current_user.id,
        action="receipt.validated",
        entity_type="receipt",
        entity_id=receipt.id,
        after_state={"reference": receipt.reference, "status": "done"},
    )
    db.add(audit)
    db.commit()

    # Restocking Trigger: Check all waiting delivery orders to see if any can now be fulfilled
    waiting_deliveries = (
        db.query(DeliveryOrder)
        .filter(DeliveryOrder.company_id == current_user.company_id, DeliveryOrder.status == "waiting")
        .all()
    )

    for delivery in waiting_deliveries:
        can_fulfill = True
        for d_line in delivery.lines:
            avail = get_product_stock(current_user.company_id, d_line.product_id, db)
            if avail < d_line.quantity_ordered:
                can_fulfill = False
                break
        if can_fulfill:
            delivery.status = "ready"
            db.commit()

    # Realtime WebSocket broadcast
    await ws_manager.broadcast_to_company(
        current_user.company_id,
        {"event": "receipt_validated", "reference": receipt.reference, "timestamp": str(datetime.datetime.utcnow())},
    )

    return {"success": True, "message": f"Receipt {receipt.reference} validated. Quantities posted to stock ledger."}
