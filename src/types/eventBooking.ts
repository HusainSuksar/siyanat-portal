// --- ASSET & INVENTORY TYPES ---

export interface InventoryAsset {
  id: string;
  name: string;
  category?: string;
  fulfillment_dept?: string;
  physical_stock: number;
  freezed_stock: number;
  unit?: string;
}

export interface StandardAsset {
  id?: string;
  item_name?: string;
  name?: string;
  category: 'AVIT' | 'SIYANAT';
  is_returnable: boolean;
  is_active: boolean;
}
// --- FORM DATA TYPES ---

export interface EventRequirement {
  item_name: string;
  quantity: number;
  asset_type: 'STANDARD' | 'CATALOG';
  is_returnable?: boolean;
  inventory_id?: string;
}

export interface EventFormData {
  id: string | null;
  title: string;
  date: string;
  timingType: 'Between Classes' | 'After Class' | string;
  selectedPeriods: string[];
  selectedAfterClass: string[];
  location: string;
  subLocation: string;
  selectedClasses: string[];
  maleCount: number;
  femaleCount: number;
  othersCount: number;
  requirements: EventRequirement[];
}

// --- DATABASE FETCH TYPES ---

export interface EventRequirementDB {
  id: string;
  item_name: string;
  quantity: number;
  approved_qty: number;
  status: string;
  is_returnable: boolean;
  return_status: string;
  returned_qty: number;
  asset_type: string;
  inventory_id?: string;
  department?: string;
}

export interface BaseEventData {
  id: string;
  event_title: string;
  event_date: string;
  time_slot: string;
  timing_type?: string;
  location: string;
  sub_location?: string;
  darajah?: string;
  pipeline_state: string;
  requester_id: string;
  created_at: string;
  total_count: number;
  rejection_reason?: string;
  requirements?: EventRequirementDB[];
  requester?: {
    full_name: string;
    department?: string;
  };
}