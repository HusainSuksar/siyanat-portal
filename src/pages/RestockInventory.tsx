import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PackageSearch, Warehouse, MapPin, ShoppingCart, Building2 } from 'lucide-react';
import CatalogTab from '../components/inventory/CatalogTab';
import BulkRestockTab from '../components/inventory/BulkRestockTab';
import WarehouseLocationsTab from '../components/inventory/WarehouseLocationsTab';
import PendingPOsTab from '../components/inventory/PendingPOsTab';
import VendorDirectoryTab from '../components/inventory/VendorDirectoryTab';

export default function RestockInventory() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<'catalog' | 'restock' | 'locations' | 'pos' | 'vendors'>('catalog');
  const [loading, setLoading] = useState(true);

  const [catalog, setCatalog] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [pendingPOs, setPendingPOs] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  const isTanzeemOnly = role === 'TANZEEM_HEAD';

  const fetchData = async () => {
    setLoading(true);
    let catQuery = supabase.from('inventory_items').select('*').order('name');
    if (isTanzeemOnly) catQuery = catQuery.in('category', ['Office & Administrative Supplies', 'IT & Networking Hardware']);

    let locQuery = supabase.from('warehouse_locations').select('*').eq('is_active', true).order('name');
    if (role === 'SIYANAT_HEAD' || role === 'TANZEEM_HEAD' || role === 'AVIT_HEAD') {
      locQuery = locQuery.eq('department', role);
    }

    const [catRes, vendorRes, poRes, locRes] = await Promise.all([
      catQuery,
      supabase.from('vendors').select('*').order('name'),
      supabase.from('purchase_orders').select('*, vendor:vendors(name, category), items:purchase_order_items(*)').eq('status', 'PO Issued'),
      locQuery
    ]);

    if (catRes.data) setCatalog(catRes.data);
    if (vendorRes.data) setVendors(vendorRes.data);
    if (poRes.data) setPendingPOs(poRes.data);
    if (locRes.data) setLocations(locRes.data);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      {/* Navigation Bar */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button onClick={() => setActiveTab('catalog')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'catalog' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <PackageSearch className="w-4 h-4" /> Master Catalog ({catalog.length})
        </button>
        <button onClick={() => setActiveTab('restock')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'restock' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Warehouse className="w-4 h-4" /> Incoming Restock
        </button>
        <button onClick={() => setActiveTab('locations')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'locations' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <MapPin className="w-4 h-4" /> Warehouse Stores ({locations.length})
        </button>
        <button onClick={() => setActiveTab('pos')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'pos' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <ShoppingCart className="w-4 h-4" /> Pending POs
          {pendingPOs.length > 0 && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full ml-1">{pendingPOs.length}</span>}
        </button>
        <button onClick={() => setActiveTab('vendors')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'vendors' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Building2 className="w-4 h-4" /> Vendor Directory
        </button>
      </div>

      {/* Modular Tab Routing */}
      {activeTab === 'catalog' && <CatalogTab catalog={catalog} locations={locations} loading={loading} onRefresh={fetchData} />}
      {activeTab === 'restock' && <BulkRestockTab catalog={catalog} locations={locations} isTanzeemOnly={isTanzeemOnly} onRefresh={fetchData} />}
      {activeTab === 'locations' && <WarehouseLocationsTab locations={locations} role={role} onRefresh={fetchData} />}
      {activeTab === 'pos' && <PendingPOsTab pendingPOs={pendingPOs} role={role} onRefresh={fetchData} />}
      {activeTab === 'vendors' && <VendorDirectoryTab vendors={vendors} onRefresh={fetchData} />}
    </div>
  );
}