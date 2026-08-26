export interface InventoryAsset {
  id: string;
  name: string;
  physical_stock: number;
  freezed_stock: number;
  unit: string;
  fulfillment_dept: string;
}

export interface StandardAsset {
  id: string;
  department: string;
  item_name: string;
  is_active: boolean;
}

export interface RequirementItem {
  id?: string;
  dept: string;
  item: string;
  qty: number;
}

export interface EventFormData {
  id: string | null;
  title: string;
  date: string;
  timingType: 'Between Classes' | 'After Classes';
  selectedPeriods: string[];
  selectedAfterClass: string[];
  location: string;
  subLocation: string;
  selectedClasses: string[];
  maleCount: number;
  femaleCount: number;
  othersCount: number;
  requirements: RequirementItem[];
}

export interface TanzeemEventRequirement {
  id: string;
  item_name: string;
  department?: string;
  status?: string;
  quantity: number;
  is_returnable: boolean;
  approved_qty: number;
  returned_qty: number;
  return_status: string;
}

export interface BaseEventData {
  id: string;
  event_title: string;
  event_date: string;
  time_slot: string;
  timing_type: string;
  location: string;
  sub_location: string | null;
  darajah: string;
  male_count: number;
  female_count: number;
  others_count: number;
  total_count: number;
  pipeline_state: string;
  rejection_reason?: string;
  requester_id: string;
  requester?: { full_name: string; department?: string };
  requirements?: TanzeemEventRequirement[];
}