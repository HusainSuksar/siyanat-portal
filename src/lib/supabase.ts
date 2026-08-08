import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase Environment Variables in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database TypeScript Definitions
export type Profile = {
  id: string;
  its_number: string;
  full_name: string;
  department: string;
  role: 'ADMIN' | 'SIYANAT_HEAD' | 'REQUESTER';
};

export type InventoryItem = {
  id: string;
  item_id: string;
  name: string;
  category: string;
  physical_stock: number;
  freezed_stock: number;
  unit: string;
  created_at?: string;
};

export type WorkOrder = {
  id: string;
  batch_id: string;
  requester_id: string;
  department: string;
  location: string;
  urgency: string;
  reason?: string;
  approval_status: string;
  dispatch_status: string;
  delivery_eta?: string;
  created_at?: string;
};