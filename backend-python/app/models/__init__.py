import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    Integer,
    Text,
    UniqueConstraint,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Company(Base):
    __tablename__ = "companies"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(100), nullable=False)
    short_code = Column(String(20), nullable=False, unique=True, index=True)
    logo_url = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    users = relationship("User", back_populates="company", cascade="all, delete-orphan")
    warehouses = relationship("Warehouse", back_populates="company", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="company", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    login_id = Column(String(50), nullable=False)
    email = Column(String(100), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="staff")  # manager, staff, super_admin
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("company_id", "login_id", name="uq_user_company_login"),
        UniqueConstraint("company_id", "email", name="uq_user_company_email"),
    )

    company = relationship("Company", back_populates="users")


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(String, primary_key=True, default=gen_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), nullable=False)
    address = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_warehouse_company_code"),
    )

    company = relationship("Company", back_populates="warehouses")
    locations = relationship("Location", back_populates="warehouse", cascade="all, delete-orphan")


class Location(Base):
    __tablename__ = "locations"

    id = Column(String, primary_key=True, default=gen_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    warehouse_id = Column(String, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(20), nullable=False)
    is_default = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("warehouse_id", "code", name="uq_location_warehouse_code"),
    )

    warehouse = relationship("Warehouse", back_populates="locations")


class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=gen_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_category_company_name"),
    )


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=gen_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(String, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(150), nullable=False)
    sku = Column(String(50), nullable=False, index=True)
    barcode = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    uom = Column(String(20), nullable=False, default="Units")
    per_unit_cost = Column(Numeric(12, 2), nullable=False, default=0.0)
    reorder_threshold = Column(Integer, nullable=False, default=10)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("company_id", "sku", name="uq_product_company_sku"),
    )

    company = relationship("Company", back_populates="products")


class StockLedger(Base):
    __tablename__ = "stock_ledger"

    id = Column(String, primary_key=True, default=gen_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    location_id = Column(String, ForeignKey("locations.id"), nullable=False, index=True)
    quantity_delta = Column(Numeric(12, 2), nullable=False)  # + for inbound, - for outbound
    movement_type = Column(String(30), nullable=False)  # receipt, delivery, transfer_in, transfer_out, adjustment
    reference = Column(String(50), nullable=False, index=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ReferenceCounter(Base):
    __tablename__ = "reference_counters"

    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True)
    doc_type = Column(String(10), primary_key=True)  # IN, OUT, INT
    current_val = Column(Integer, nullable=False, default=0)


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(String, primary_key=True, default=gen_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    reference = Column(String(50), nullable=False)
    supplier_name = Column(String(100), nullable=True)
    destination_location_id = Column(String, ForeignKey("locations.id"), nullable=False)
    status = Column(String(20), nullable=False, default="draft")  # draft, ready, done, canceled
    notes = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=False)
    validated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("company_id", "reference", name="uq_receipt_company_ref"),
    )

    lines = relationship("ReceiptLine", back_populates="receipt", cascade="all, delete-orphan")


class ReceiptLine(Base):
    __tablename__ = "receipt_lines"

    id = Column(String, primary_key=True, default=gen_uuid)
    receipt_id = Column(String, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    quantity_expected = Column(Numeric(12, 2), nullable=False)
    quantity_received = Column(Numeric(12, 2), nullable=False, default=0.0)
    unit_cost = Column(Numeric(12, 2), nullable=False, default=0.0)

    receipt = relationship("Receipt", back_populates="lines")


class DeliveryOrder(Base):
    __tablename__ = "delivery_orders"

    id = Column(String, primary_key=True, default=gen_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    reference = Column(String(50), nullable=False)
    customer_name = Column(String(100), nullable=True)
    source_location_id = Column(String, ForeignKey("locations.id"), nullable=False)
    status = Column(String(20), nullable=False, default="draft")  # draft, waiting, ready, done, canceled
    notes = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=False)
    validated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("company_id", "reference", name="uq_delivery_company_ref"),
    )

    lines = relationship("DeliveryLine", back_populates="delivery", cascade="all, delete-orphan")


class DeliveryLine(Base):
    __tablename__ = "delivery_lines"

    id = Column(String, primary_key=True, default=gen_uuid)
    delivery_id = Column(String, ForeignKey("delivery_orders.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    quantity_ordered = Column(Numeric(12, 2), nullable=False)
    quantity_delivered = Column(Numeric(12, 2), nullable=False, default=0.0)

    delivery = relationship("DeliveryOrder", back_populates="lines")


class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(String, primary_key=True, default=gen_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    reference = Column(String(50), nullable=False)
    source_location_id = Column(String, ForeignKey("locations.id"), nullable=False)
    destination_location_id = Column(String, ForeignKey("locations.id"), nullable=False)
    status = Column(String(20), nullable=False, default="draft")  # draft, ready, done, canceled
    notes = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=False)
    validated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("company_id", "reference", name="uq_transfer_company_ref"),
    )


class OtpCode(Base):
    __tablename__ = "otp_codes"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String(100), nullable=False, index=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    code_hash = Column(String(255), nullable=False)
    purpose = Column(String(30), nullable=False, default="password_reset")
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, nullable=False)
    action = Column(String(50), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(100), nullable=False)
    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
