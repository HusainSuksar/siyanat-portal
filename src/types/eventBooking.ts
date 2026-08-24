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