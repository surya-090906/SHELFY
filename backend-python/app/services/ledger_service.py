from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import StockLedger, ReferenceCounter
from app.services.redis_service import cache
from app.services.websocket_manager import ws_manager


def get_product_stock(company_id: str, product_id: str, db: Session) -> Decimal:
    """
    Computes current stock as SUM(quantity_delta) from the immutable stock ledger.
    Caches in Redis under tenant-namespaced key.
    """
    cache_key = f"stock:{company_id}:{product_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        try:
            return Decimal(cached)
        except Exception:
            pass

    # Compute from DB ledger
    total = (
        db.query(func.coalesce(func.sum(StockLedger.quantity_delta), 0))
        .filter(
            StockLedger.company_id == company_id,
            StockLedger.product_id == product_id,
        )
        .scalar()
    )

    stock_val = Decimal(str(total))
    cache.set(cache_key, str(stock_val), ex=300)  # 5 min cache
    return stock_val


def invalidate_product_stock(company_id: str, product_id: str):
    cache_key = f"stock:{company_id}:{product_id}"
    cache.delete(cache_key)
    cache.delete_prefix(f"dashboard:kpis:{company_id}")


def get_next_reference(company_id: str, doc_type: str, warehouse_code: str = "WH", db: Session = None) -> str:
    """
    Atomically allocates the next sequential human-readable document reference:
    e.g. WH/IN/0001, WH/OUT/0001, WH/INT/0001
    """
    counter = (
        db.query(ReferenceCounter)
        .filter(ReferenceCounter.company_id == company_id, ReferenceCounter.doc_type == doc_type)
        .with_for_update()
        .first()
    )

    if not counter:
        counter = ReferenceCounter(company_id=company_id, doc_type=doc_type, current_val=1)
        db.add(counter)
        seq_num = 1
    else:
        counter.current_val += 1
        seq_num = counter.current_val

    db.flush()
    return f"{warehouse_code}/{doc_type}/{str(seq_num).zfill(4)}"
