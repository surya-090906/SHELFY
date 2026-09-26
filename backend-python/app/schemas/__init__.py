from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


# --- Company Schemas ---
class CompanySearchResponse(BaseModel):
    id: str
    name: str
    short_code: str
    logo_url: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class CompanyBrandingResponse(BaseModel):
    id: str
    name: str
    short_code: str
    logo_url: Optional[str] = None

    class Config:
        from_attributes = True


# --- Auth Schemas ---
class LoginRequest(BaseModel):
    company_id: str
    login_id_or_email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


class ForgotPasswordRequest(BaseModel):
    company_id: str
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    company_id: str
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)


# --- Product Schemas ---
class ProductCreate(BaseModel):
    name: str
    sku: str
    barcode: Optional[str] = None
    description: Optional[str] = None
    uom: str = "Units"
    per_unit_cost: Decimal = Decimal("0.00")
    reorder_threshold: int = 10
    initial_stock: Optional[Decimal] = None
    location_id: Optional[str] = None


class ProductResponse(BaseModel):
    id: str
    company_id: str
    category_id: Optional[str] = None
    name: str
    sku: str
    barcode: Optional[str] = None
    description: Optional[str] = None
    uom: str
    per_unit_cost: Decimal
    reorder_threshold: int
    current_stock: Decimal = Decimal("0.00")
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- Document Operations Schemas ---
class ReceiptLineCreate(BaseModel):
    product_id: str
    quantity_expected: Decimal
    unit_cost: Optional[Decimal] = Decimal("0.00")


class ReceiptCreate(BaseModel):
    supplier_name: Optional[str] = None
    destination_location_id: str
    notes: Optional[str] = None
    lines: List[ReceiptLineCreate]


class DeliveryLineCreate(BaseModel):
    product_id: str
    quantity_ordered: Decimal


class DeliveryCreate(BaseModel):
    customer_name: Optional[str] = None
    source_location_id: str
    notes: Optional[str] = None
    lines: List[DeliveryLineCreate]


class TransferLineCreate(BaseModel):
    product_id: str
    quantity: Decimal


class TransferCreate(BaseModel):
    source_location_id: str
    destination_location_id: str
    notes: Optional[str] = None
    lines: List[TransferLineCreate]


# --- Dashboard KPI Schemas ---
class DashboardKpiResponse(BaseModel):
    total_products: int
    pending_receipts: int
    pending_deliveries: int
    low_stock_items: int
    recent_movements: List[Dict[str, Any]]
