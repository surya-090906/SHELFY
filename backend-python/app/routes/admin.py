from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.database import get_db
from app.models import Company, User, Warehouse, Location, Category
from app.services.auth_service import require_super_admin, get_password_hash

router = APIRouter(prefix="/api/admin", tags=["Super Admin"])


class CreateTenantRequest(BaseModel):
    name: str
    short_code: str
    manager_login_id: str
    manager_email: str
    manager_password: str
    manager_name: str


@router.get("/companies")
def list_tenants(current_user: User = Depends(require_super_admin), db: Session = Depends(get_db)):
    """
    Super-admin only: lists all tenant organizations and status.
    """
    companies = db.query(Company).order_by(Company.created_at.desc()).all()
    results = []
    for c in companies:
        user_count = db.query(User).filter(User.company_id == c.id).count()
        results.append({
            "id": c.id,
            "name": c.name,
            "short_code": c.short_code,
            "is_active": c.is_active,
            "users_count": user_count,
            "created_at": c.created_at,
        })
    return results


@router.post("/companies")
def create_tenant(
    req: CreateTenantRequest,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    Provisions a new tenant with initial company, starter warehouse, default location,
    starter category, and founder manager user.
    """
    # Check short code
    code = req.short_code.strip().upper()
    existing = db.query(Company).filter(Company.short_code == code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Company code '{code}' is already registered.")

    company = Company(name=req.name.strip(), short_code=code, is_active=True)
    db.add(company)
    db.flush()

    # Starter warehouse and default location
    wh = Warehouse(company_id=company.id, name=f"{code} Main Warehouse", code="WH", is_active=True)
    db.add(wh)
    db.flush()

    loc = Location(company_id=company.id, warehouse_id=wh.id, name="Primary Stock", code="STOCK", is_default=True)
    db.add(loc)

    # Starter category
    cat = Category(company_id=company.id, name="General Inventory", description="Default category")
    db.add(cat)

    # Founder manager user
    manager = User(
        company_id=company.id,
        login_id=req.manager_login_id.strip().lower(),
        email=req.manager_email.strip().lower(),
        name=req.manager_name.strip(),
        password_hash=get_password_hash(req.manager_password),
        role="manager",
        is_active=True,
    )
    db.add(manager)

    db.commit()
    db.refresh(company)

    return {
        "success": True,
        "company": {"id": company.id, "name": company.name, "short_code": company.short_code},
        "manager": {"id": manager.id, "login_id": manager.login_id, "email": manager.email},
    }
