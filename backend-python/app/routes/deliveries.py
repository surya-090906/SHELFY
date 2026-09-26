import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import DeliveryOrder, DeliveryLine, StockLedger, AuditLog, User, Product
from app.schemas import DeliveryCreate
from app.services.auth_service import get_current_user
from app.services.ledger_service import get_next_reference, get_product_stock, invalidate_product_stock
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/api/deliveries", tags=["Deliveries"])


@router.get("")
def list_deliveries(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    deliveries = (
        db.query(DeliveryOrder)
        .filter(DeliveryOrder.company_id == current_user.company_id)
        .order_by(DeliveryOrder.created_at.desc())
        .all()
    )
    result = []
    for d in deliveries:
        lines = []
        for l in d.lines:
            avail = get_product_stock(current_user.company_id, l.product_id, db)
            is_short = avail < l.quantity_ordered
            prod = db.query(Product).filter(Product.id == l.product_id).first()
            lines.append({
                "id": l.id,
                "product_id": l.product_id,
                "product_name": prod.name if prod else "Item",
                "product_sku": prod.sku if prod else "SKU",
                "quantity_ordered": float(l.quantity_ordered),
                "available_stock": float(avail),
                "is_short": is_short,
            })
        result.append({
            "id": d.id,
            "reference": d.reference,
            "customer_name": d.customer_name,
            "source_location_id": d.source_location_id,
            "status": d.status,
            "notes": d.notes,
            "created_at": d.created_at,
            "lines": lines,
        })
    return result


@router.post("")
def create_delivery(
    req: DeliveryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ref = get_next_reference(current_user.company_id, "OUT", "WH", db)

    # Determine if any item is short on stock
    has_shortage = False
    for l_in in req.lines:
        avail = get_product_stock(current_user.company_id, l_in.product_id, db)
        if avail < l_in.quantity_ordered:
            has_shortage = True
            break

    initial_status = "waiting" if has_shortage else "ready"

    delivery = DeliveryOrder(
        company_id=current_user.company_id,
        reference=ref,
        customer_name=req.customer_name,
        source_location_id=req.source_location_id,
        status=initial_status,
        notes=req.notes,
        created_by=current_user.id,
    )
    db.add(delivery)
    db.flush()

    for line_in in req.lines:
        line = DeliveryLine(
            delivery_id=delivery.id,
            company_id=current_user.company_id,
            product_id=line_in.product_id,
            quantity_ordered=line_in.quantity_ordered,
            quantity_delivered=Decimal("0.00"),
        )
        db.add(line)

    db.commit()
    db.refresh(delivery)
    return {"success": True, "delivery": {"id": delivery.id, "reference": delivery.reference, "status": delivery.status}}


@router.post("/{delivery_id}/validate")
async def validate_delivery(
    delivery_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Validates an Outbound Delivery Order:
    1. Checks stock sufficiency for every line. If short, sets status to 'waiting' and rejects with 400.
    2. If sufficient, sets status to 'done'.
    3. Deducts stock by inserting negative quantity entries (-qty) into stock_ledger.
    4. Invalidates cache & broadcasts realtime update.
    """
    delivery = (
        db.query(DeliveryOrder)
        .filter(DeliveryOrder.id == delivery_id, DeliveryOrder.company_id == current_user.company_id)
        .first()
    )
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery order not found")
    if delivery.status == "done":
        raise HTTPException(status_code=400, detail="Delivery order is already validated.")

    # Stock check
    for line in delivery.lines:
        avail = get_product_stock(current_user.company_id, line.product_id, db)
        if avail < line.quantity_ordered:
            delivery.status = "waiting"
            db.commit()
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for product. Available: {avail}, Ordered: {line.quantity_ordered}. Order status changed to Waiting.",
            )

    delivery.status = "done"
    delivery.validated_at = datetime.datetime.utcnow()

    # Deduct stock in ledger (negative delta)
    for line in delivery.lines:
        line.quantity_delivered = line.quantity_ordered
        ledger_entry = StockLedger(
            company_id=current_user.company_id,
            product_id=line.product_id,
            location_id=delivery.source_location_id,
            quantity_delta=-abs(line.quantity_ordered),
            movement_type="delivery",
            reference=delivery.reference,
            created_by=current_user.id,
        )
        db.add(ledger_entry)
        invalidate_product_stock(current_user.company_id, line.product_id)

    # Audit log
    audit = AuditLog(
        company_id=current_user.company_id,
        user_id=current_user.id,
        action="delivery.validated",
        entity_type="delivery_order",
        entity_id=delivery.id,
        after_state={"reference": delivery.reference, "status": "done"},
    )
    db.add(audit)
    db.commit()

    # Realtime broadcast
    await ws_manager.broadcast_to_company(
        current_user.company_id,
        {"event": "delivery_validated", "reference": delivery.reference, "timestamp": str(datetime.datetime.utcnow())},
    )

    return {"success": True, "message": f"Delivery {delivery.reference} validated. Stock deducted from ledger."}
