// src/types.ts

export interface Profile {
  id: string; // <-- Added this
  full_name: string;
  department: string;
  role?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  physical_stock: number;
  freezed_stock: number;
}

export interface WorkOrderItem {
  id: string;
  requested_qty: number;
  item_type: 'Catalog' | 'Custom';
  custom_item_name: string | null;
  status: 'Pending' | 'Ordered' | 'Available' | 'Not Provided';
  eta_days: number;
  fulfillment_dept: string;
  inventory_id: string | null;
  inventory?: InventoryItem;
}

export interface WorkOrder {
  id: string;
  batch_id: string;
  location: string;
  pipeline_state: string;
  reason?: string | null;      // <-- Added this
  department?: string | null;  // <-- Added this
  requester?: Profile;
  items: WorkOrderItem[];
  created_at?: string;
}