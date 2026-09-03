import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ClassHeadcount {
  male: number;
  female: number;
}

export interface InventoryCategoryItem {
  id: string;
  name: string;
  department: string;
}

const FALLBACK_CLASSES: Record<string, ClassHeadcount> = {
  "1AM": { male: 25, female: 0 }, "1BM": { male: 25, female: 0 }, "1CM": { male: 23, female: 0 }, "1DM": { male: 24, female: 0 }, "6AM": { male: 26, female: 0 },
  "1AF": { male: 0, female: 20 }, "1BF": { male: 0, female: 19 }, "1CF": { male: 0, female: 19 }, "1DF": { male: 0, female: 19 }, "6AF": { male: 0, female: 23 },
  "Faculty / Staff": { male: 0, female: 0 },
  "Others (Custom)": { male: 0, female: 0 }
};

const FALLBACK_TRADES = [
  "Plumbing", "Electrical", "Carpentry", "Civil", "HVAC", "Housekeeping", "Cleaning", "General"
];

const FALLBACK_ZONES = [
  "Main Jamea Complex", "Rabwat (Girls Hostel)", "Masakin (Boys Hostel)", "Mawaid", "Khaimat al-Riyadat"
];

const FALLBACK_CATEGORIES = [
  { id: '1', name: "Electrical & Lighting", department: "SIYANAT_HEAD" },
  { id: '2', name: "Plumbing & Sanitary", department: "SIYANAT_HEAD" },
  { id: '3', name: "HVAC & AC Maintenance", department: "SIYANAT_HEAD" },
  { id: '4', name: "Civil & Masonry", department: "SIYANAT_HEAD" },
  { id: '5', name: "Carpentry & Hardware", department: "SIYANAT_HEAD" },
  { id: '6', name: "Painting & Finishes", department: "SIYANAT_HEAD" },
  { id: '7', name: "Safety & PPE Equipment", department: "SIYANAT_HEAD" },
  { id: '8', name: "Cleaning & Janitorial Supplies", department: "SIYANAT_HEAD" },
  { id: '9', name: "Tools & Machinery", department: "SIYANAT_HEAD" },
  { id: '10', name: "General / Miscellaneous", department: "SIYANAT_HEAD" },
  { id: '11', name: "Office & Administrative Supplies", department: "TANZEEM_HEAD" },
  { id: '12', name: "IT & Networking Hardware", department: "TANZEEM_HEAD" },
  { id: '13', name: "IT & Networking Hardware", department: "AVIT_HEAD" }
];

export function useSystemConfig() {
  const [classes, setClasses] = useState<Record<string, ClassHeadcount>>(FALLBACK_CLASSES);
  const [trades, setTrades] = useState<string[]>(FALLBACK_TRADES);
  const [zones, setZones] = useState<string[]>(FALLBACK_ZONES);
  const [defaultPassword, setDefaultPassword] = useState<string>('786110');
  const [categories, setCategories] = useState<InventoryCategoryItem[]>(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const [clsRes, trdRes, catRes, setRes] = await Promise.all([
        supabase.from('academic_classes').select('*').eq('is_active', true).order('class_name'),
        supabase.from('technician_trades').select('*').eq('is_active', true).order('trade_name'),
        supabase.from('inventory_categories').select('*').eq('is_active', true).order('name'),
        supabase.from('system_settings').select('*')
      ]);

      if (clsRes.data && clsRes.data.length > 0) {
        const classMap: Record<string, ClassHeadcount> = {};
        clsRes.data.forEach((c: any) => {
          classMap[c.class_name] = { male: Number(c.male_count) || 0, female: Number(c.female_count) || 0 };
        });
        if (!classMap['Others (Custom)']) {
          classMap['Others (Custom)'] = { male: 0, female: 0 };
        }
        setClasses(classMap);
      }

      if (trdRes.data && trdRes.data.length > 0) {
        setTrades(trdRes.data.map((t: any) => t.trade_name));
      }

      if (catRes.data && catRes.data.length > 0) {
        setCategories(catRes.data);
      }

      if (setRes.data && setRes.data.length > 0) {
        const pwdSetting = setRes.data.find((s: any) => s.key === 'default_user_password');
        if (pwdSetting && pwdSetting.value) {
          setDefaultPassword(typeof pwdSetting.value === 'string' ? pwdSetting.value : String(pwdSetting.value));
        }
        const zonesSetting = setRes.data.find((s: any) => s.key === 'campus_pickup_zones');
        if (zonesSetting && Array.isArray(zonesSetting.value) && zonesSetting.value.length > 0) {
          setZones(zonesSetting.value);
        }
      }
    } catch (err) {
      console.warn('Could not load dynamic system configurations, using fallbacks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return { classes, trades, zones, categories, defaultPassword, loading, refreshConfig: fetchConfig };
}