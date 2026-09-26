from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Product, User, StockLedger, AuditLog
from app.schemas import ProductCreate, ProductResponse
from app.services.auth_service import get_current_user, require_manager
from app.services.ledger_service import get_product_stock, invalidate_product_stock

router = APIRouter(prefix="/api/products", tags=["Products"])


@router.get("", response_model=List[ProductResponse])
def get_products(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns products strictly scoped to the authenticated user's company.
    Computes current_stock dynamically from immutable stock_ledger.
    """
    products = (
        db.query(Product)
        .filter(Product.company_id == current_user.company_id, Product.is_active == True)
        .order_by(Product.name)
        .all()
    )

    results = []
    for p in products:
        stock = get_product_stock(current_user.company_id, p.id, db)
        p_dict = {
            "id": p.id,
            "company_id": p.company_id,
            "category_id": p.category_id,
            "name": p.name,
            "sku": p.sku,
            "barcode": p.barcode,
            "description": p.description,
            "uom": p.uom,
            "per_unit_cost": p.per_unit_cost,
            "reorder_threshold": p.reorder_threshold,
            "current_stock": stock,
            "is_active": p.is_active,
            "created_at": p.created_at,
        }
        results.append(ProductResponse(**p_dict))

    return results


@router.post("", response_model=ProductResponse)
def create_product(
    req: ProductCreate,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Manager-only: creates a new product in the company catalog.
    If initial_stock is specified, records an immutable adjustment in stock_ledger.
    """
    # Check SKU uniqueness within company
    existing = (
        db.query(Product)
        .filter(Product.company_id == current_user.company_id, Product.sku.ilike(req.sku.strip()))
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail=f"SKU '{req.sku}' already exists in your company catalog.")

    product = Product(
        company_id=current_user.company_id,
        name=req.name.strip(),
        sku=req.sku.strip().toUpperCase() if hasattr(req.sku, "toUpperCase") else req.sku.strip().upper(),
        barcode=req.barcode.strip() if req.barcode else None,
        description=req.description.strip() if req.description else None,
        uom=req.uom or "Units",
        per_unit_cost=req.per_unit_cost,
        reorder_threshold=req.reorder_threshold,
    )
    db.add(product)
    db.flush()

    # Initial stock entry if provided
    initial_stock_val = req.initial_stock or 0
    if req.initial_stock and req.initial_stock > 0 and req.location_id:
        ledger_entry = StockLedger(
            company_id=current_user.company_id,
            product_id=product.id,
            location_id=req.location_id,
            quantity_delta=req.initial_stock,
            movement_type="adjustment",
            reference="INIT-STOCK",
            created_by=current_user.id,
        )
        db.add(ledger_entry)

    # Audit log
    audit = AuditLog(
        company_id=current_user.company_id,
        user_id=current_user.id,
        action="product.created",
        entity_type="product",
        entity_id=product.id,
        after_state={"name": product.name, "sku": product.sku, "initial_stock": str(initial_stock_val)},
    )
    db.add(audit)
    db.commit()
    db.refresh(product)

    invalidate_product_stock(current_user.company_id, product.id)

    return ProductResponse(
        id=product.id,
        company_id=product.company_id,
        category_id=product.category_id,
        name=product.name,
        sku=product.sku,
        barcode=product.barcode,
        description=product.description,
        uom=product.uom,
        per_unit_cost=product.per_unit_cost,
        reorder_threshold=product.reorder_threshold,
        current_stock=initial_stock_val,
        is_active=product.is_active,
        created_at=product.created_at,
    )
