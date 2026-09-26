export interface Company {
  id: string; // Clerk org_id
  name: string;
  short_code: string;
  logo_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  company_id: string;
  name: string;
  code: string;
  address?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Location {
  id: string;
  company_id: string;
  warehouse_id: string;
  name: string;
  code: string;
  is_default: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  company_id: string;
  category_id?: string | null;
  name: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  uom: string;
  per_unit_cost: number;
  reorder_threshold: number;
  is_active: boolean;
  created_at: string;
  current_stock?: number;
}

export type DocumentStatus = 'draft' | 'waiting' | 'ready' | 'done' | 'canceled';

export interface Receipt {
  id: string;
  company_id: string;
  reference: string;
  supplier_name?: string | null;
  destination_location_id: string;
  status: DocumentStatus;
  notes?: string | null;
  created_by: string;
  validated_at?: string | null;
  created_at: string;
  lines?: ReceiptLine[];
}

export interface ReceiptLine {
  id: string;
  receipt_id: string;
  company_id: string;
  product_id: string;
  quantity_expected: number;
  quantity_received: number;
  unit_cost: number;
  product?: Product;
}

export interface DeliveryOrder {
  id: string;
  company_id: string;
  reference: string;
  customer_name?: string | null;
  source_location_id: string;
  status: DocumentStatus;
  notes?: string | null;
  created_by: string;
  validated_at?: string | null;
  created_at: string;
  lines?: DeliveryLine[];
}

export interface DeliveryLine {
  id: string;
  delivery_order_id: string;
  company_id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_delivered: number;
  product?: Product;
  available_stock?: number;
  is_short?: boolean;
}

export interface Transfer {
  id: string;
  company_id: string;
  reference: string;
  source_location_id: string;
  destination_location_id: string;
  status: DocumentStatus;
  notes?: string | null;
  created_by: string;
  validated_at?: string | null;
  created_at: string;
  lines?: TransferLine[];
}

export interface TransferLine {
  id: string;
  transfer_id: string;
  company_id: string;
  product_id: string;
  quantity: number;
  product?: Product;
}

export interface StockLedgerEntry {
  id: string;
  company_id: string;
  product_id: string;
  location_id: string;
  quantity_change: number;
  movement_type: 'receipt' | 'delivery' | 'transfer_out' | 'transfer_in' | 'adjustment';
  reference: string;
  created_by?: string | null;
  created_at: string;
  product?: Product;
  location?: Location;
}

export interface AuditLog {
  id: string;
  company_id: string;
  clerk_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
}
