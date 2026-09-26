from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from app.database import get_db
from app.models import Company
from app.schemas import CompanySearchResponse, CompanyBrandingResponse

router = APIRouter(prefix="/api/companies", tags=["Companies"])


@router.get("/search", response_model=List[CompanySearchResponse])
def search_companies(
    q: str = Query("", description="Search term for company name or short code"),
    db: Session = Depends(get_db),
):
    """
    Step 1: Public, unauthenticated type-ahead search querying active companies.
    Max 10 results.
    """
    query = db.query(Company).filter(Company.is_active == True)

    if q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(or_(Company.name.ilike(term), Company.short_code.ilike(term)))

    return query.order_by(Company.name).limit(10).all()


@router.get("/{company_id}/branding", response_model=CompanyBrandingResponse)
def get_company_branding(company_id: str, db: Session = Depends(get_db)):
    """
    Step 2: Returns public branding details (name and logo) for the login screen.
    Never exposes internal credentials or user data.
    """
    company = db.query(Company).filter(Company.id == company_id, Company.is_active == True).first()
    if not company:
        # Also allow finding by short_code for friendly URLs
        company = db.query(Company).filter(Company.short_code.ilike(company_id), Company.is_active == True).first()

    if not company:
        raise HTTPException(status_code=404, detail="Organization not found or inactive")

    return company
