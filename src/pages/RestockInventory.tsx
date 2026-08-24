import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Warehouse, Plus, Trash2, Save, Search, PackageSearch, Edit, X, Hash, ShoppingCart, Truck, Building2, UploadCloud, DownloadCloud } from 'lucide-react';
import { useToast } from '../hooks/useToast';

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  physical_stock: number;
  freezed_stock: number;
  unit: string;
  fulfillment_dept: string;
};

type RestockRow = {
  id: string;
  type: 'EXISTING' | 'NEW';
  itemId: string;
  name: string;
  category: string;
  qty: number;
  fulfillment_dept: string;
};

const SIYANAT_CATEGORIES = [
  "Electrical & Lighting", "Plumbing & Sanitary", "HVAC & AC Maintenance", 
  "Civil & Masonry", "Carpentry & Hardware", "Painting & Finishes", 
  "Safety & PPE Equipment", "Cleaning & Janitorial Supplies", 
  "Tools & Machinery", "General / Miscellaneous"
];

const TANZEEM_CATEGORIES = [
  "Office & Administrative Supplies", 
  "IT & Networking Hardware"
];

export default function RestockInventory() {
  const { role, user } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<'catalog' | 'restock' | 'pos' | 'vendors'>('catalog');
  
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [pendingPOs, setPendingPOs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<RestockRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCategory, setNewVendorCategory] = useState('Electrical');
  const [newVendorContact, setNewVendorContact] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [poConfirmTarget, setPoConfirmTarget] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isTanzeemOnly = role === 'TANZEEM_HEAD';
  const availableCategories = isTanzeemOnly ? TANZEEM_CATEGORIES : [...SIYANAT_CATEGORIES, ...TANZEEM_CATEGORIES];

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    let catQuery = supabase.from('inventory_items').select('*').order('name');
    if (isTanzeemOnly) catQuery = catQuery.in('category', TANZEEM_CATEGORIES);
    
    const [catRes, vendorRes, poRes] = await Promise.all([
      catQuery,
      supabase.from('vendors').select('*').order('name'),
      supabase.from('purchase_orders').select('*, vendor:vendors(name, category), items:purchase_order_items(*)').eq('status', 'PO Issued')
    ]);

    if (catRes.data) setCatalog(catRes.data);
    if (vendorRes.data) setVendors(vendorRes.data);
    if (poRes.data) setPendingPOs(poRes.data);

    setLoading(false);
  };

  const addRow = () => {
    const defaultItemId = catalog.length > 0 ? catalog[0].id : '';
    setRows(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'EXISTING',
      itemId: defaultItemId,
      name: '',
      category: availableCategories[0],
      qty: 10,
      fulfillment_dept: isTanzeemOnly ? 'TANZEEM_HEAD' : 'SIYANAT_HEAD'
    }]);
  };

  const removeRow = (id: string) => setRows(prev => prev.filter(row => row.id !== id));
  const updateRow = (id: string, field: keyof RestockRow, value: any) => setRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));

  const downloadCSVTemplate = () => {
    const headers = "Type (NEW or EXISTING),Item ID (Leave blank if NEW),Item Name,Category,Route To (SIYANAT_HEAD or TANZEEM_HEAD or AVIT_HEAD),Qty";
    const sample1 = "EXISTING,uuid-goes-here,Copper Wire,Electrical & Lighting,SIYANAT_HEAD,50";
    const sample2 = "NEW,,Brand New Pens,Office & Administrative Supplies,TANZEEM_HEAD,100";
    const csvContent = [headers, sample1, sample2].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "Restock_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const newRows: RestockRow[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(','); 
        if (cols.length >= 6) {
           const typeStr = cols[0].trim().toUpperCase();
           const type = typeStr === 'NEW' ? 'NEW' : 'EXISTING';
           const itemId = cols[1].trim();
           const name = cols[2].trim();
           const category = cols[3].trim() || availableCategories[0];
           const fulfillment = cols[4].trim() || 'SIYANAT_HEAD';
           const qty = parseInt(cols[5].trim(), 10) || 1;

           newRows.push({
             id: crypto.randomUUID(),
             type, itemId, name, category,
             fulfillment_dept: fulfillment,
             qty
           });
        }
      }
      
      if(newRows.length > 0) {
         setRows(prev => [...prev, ...newRows]);
         showToast(`Successfully imported ${newRows.length} items from CSV!`, 'success');
      } else {
         showToast('No valid rows found. Please ensure you followed the template.', 'error');
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const submitBulkRestock = async () => {
    if (rows.length === 0) return;
    setSubmitting(true);

    try {
      let totalItemsRestocked = 0;

      for (const row of rows) {
        if (row.type === 'NEW') {
          const { error } = await supabase.from('inventory_items').insert({
            item_id: `CAT-${Math.floor(10000 + Math.random() * 90000)}`,
            name: row.name, 
            category: row.category, 
            physical_stock: row.qty, 
            freezed_stock: 0, 
            unit: 'Pcs',
            fulfillment_dept: row.fulfillment_dept
          });
          if (error) throw error;
          totalItemsRestocked += row.qty;
        } else if (row.type === 'EXISTING' && row.itemId) {
          const item = catalog.find(i => i.id === row.itemId);
          if (item) {
            await supabase.from('inventory_items').update({ physical_stock: item.physical_stock + row.qty }).eq('id', row.itemId);
            totalItemsRestocked += row.qty;
          }
        }
      }

      await supabase.from('system_logs').insert({
        action_type: 'INVENTORY_RESTOCK',
        description: `Processed bulk restock adding ${totalItemsRestocked} items.`,
        user_email: user?.email || 'System Admin'
      });

      showToast("Warehouse Restocked Successfully!", "success");
      setRows([]);
      fetchData();
    } catch (err: any) {
      showToast("Error processing restock: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorName.trim()) return;

    const { error } = await supabase.from('vendors').insert({ name: newVendorName, category: newVendorCategory, contact_info: newVendorContact });
    if (!error) {
      setNewVendorName(''); setNewVendorContact('');
      showToast("Vendor registered!", "success");
      fetchData();
    } else {
      showToast("Error adding vendor.", "error");
    }
  };

  const toggleVendorStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('vendors').update({ is_active: !currentStatus }).eq('id', id);
    fetchData();
  };

  // --- PO Receiving & Auto-Cataloging Engine ---
  const fulfillPO = async () => {
    if (!poConfirmTarget) return;
    setProcessingId(poConfirmTarget.id);

    try {
      // 1. Mark PO as fulfilled
      await supabase.from('purchase_orders').update({ status: 'Fulfilled & Received' }).eq('id', poConfirmTarget.id);

      const affectedWorkOrderIds = new Set<string>();

      for (const item of poConfirmTarget.items) {
        let targetInventoryId = item.inventory_id;
        
        if (!targetInventoryId && item.custom_item_name) {
          // 2. AUTO-CATALOG CUSTOM ITEMS
          const { data: woItems } = await supabase.from('work_order_items')
            .select('id, work_order_id, requested_qty')
            .eq('custom_item_name', item.custom_item_name)
            .in('status', ['Ordered', 'Pending', 'PO Issued']);
            
          const totalReq = woItems?.reduce((sum, wi) => sum + wi.requested_qty, 0) || 0;
          woItems?.forEach(wi => affectedWorkOrderIds.add(wi.work_order_id));

          const { data: newInv } = await supabase.from('inventory_items').insert({
            item_id: `CAT-${Math.floor(10000 + Math.random() * 90000)}`,
            name: item.custom_item_name,
            category: 'General / Miscellaneous',
            physical_stock: item.requested_qty, // Stock ordered from PO
            freezed_stock: totalReq, // Reserved for Requester
            unit: 'Pcs',
            fulfillment_dept: role?.includes('_HEAD') ? role : 'SIYANAT_HEAD'
          }).select().single();
          
          if (newInv && woItems && woItems.length > 0) {
            targetInventoryId = newInv.id;
            await supabase.from('work_order_items')
              .update({ status: 'Stock Injected', inventory_id: targetInventoryId })
              .in('id', woItems.map(wi => wi.id));
          }

        } else if (targetInventoryId) {
          // 3. EXISTING CATALOG ITEM
          const { data: inv } = await supabase.from('inventory_items').select('physical_stock, freezed_stock').eq('id', targetInventoryId).single();
          
          if (inv) {
            const { data: woItems } = await supabase.from('work_order_items')
              .select('id, work_order_id, requested_qty')
              .eq('inventory_id', targetInventoryId)
              .in('status', ['Ordered', 'Pending', 'PO Issued']);
              
            const newReq = woItems?.reduce((sum, wi) => sum + wi.requested_qty, 0) || 0;
            woItems?.forEach(wi => affectedWorkOrderIds.add(wi.work_order_id));

            await supabase.from('inventory_items').update({ 
              physical_stock: inv.physical_stock + item.requested_qty,
              freezed_stock: inv.freezed_stock + newReq
            }).eq('id', targetInventoryId);

            if (woItems && woItems.length > 0) {
              await supabase.from('work_order_items')
                .update({ status: 'Stock Injected' })
                .in('id', woItems.map(wi => wi.id));
            }
          }
        }
      }

      // 4. Update Technician Task (if linked)
      if (poConfirmTarget.complaint_id) {
        await supabase.from('technician_assignments').update({ status: 'Assigned' }).eq('complaint_id', poConfirmTarget.complaint_id);
        await supabase.from('complaints').update({ pipeline_state: 'PROCESSING' }).eq('id', poConfirmTarget.complaint_id);
      }

      // 5. BUMP THE BATCH STATE
      for (const woId of Array.from(affectedWorkOrderIds)) {
        await supabase.from('work_orders')
          .update({ pipeline_state: 'ACTION_REQUIRED', dispatch_status: 'Ready for Collection' })
          .eq('id', woId);
      }

      showToast(`PO ${poConfirmTarget.po_number} received & warehouse stock updated!`, "success");
      setPoConfirmTarget(null);
      fetchData();
    } catch (err: any) {
      showToast("Error fulfilling PO: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setProcessingId(editingItem.id);

    const { error } = await supabase.from('inventory_items').update({
      name: editingItem.name, 
      category: editingItem.category, 
      unit: editingItem.unit,
      physical_stock: editingItem.physical_stock, 
      freezed_stock: editingItem.freezed_stock,
      fulfillment_dept: editingItem.fulfillment_dept
    }).eq('id', editingItem.id);

    if (!error) {
      showToast('Item updated successfully.', "success");
      setEditModalOpen(false);
      fetchData();
    } else {
      showToast("Error updating item.", "error");
    }
    setProcessingId(null);
  };

  const filteredCatalog = catalog.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.category.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      {/* Header Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button onClick={() => setActiveTab('catalog')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'catalog' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <PackageSearch className="w-4 h-4" /> Master Catalog ({catalog.length})
        </button>
        <button onClick={() => setActiveTab('restock')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'restock' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Warehouse className="w-4 h-4" /> Incoming Restock
        </button>
        <button onClick={() => setActiveTab('pos')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'pos' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <ShoppingCart className="w-4 h-4" /> Pending POs
          {pendingPOs.length > 0 && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full ml-1">{pendingPOs.length}</span>}
        </button>
        <button onClick={() => setActiveTab('vendors')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'vendors' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Building2 className="w-4 h-4" /> Vendor Directory
        </button>
      </div>

      {/* --- TAB 1: MASTER CATALOG --- */}
      {activeTab === 'catalog' && (
        <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200 space-y-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
            <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Inventory Stock Overview</h3>
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input type="text" placeholder="Search catalog..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {loading ? <div className="col-span-full p-8 text-center text-slate-400 font-bold animate-pulse">Loading catalog...</div> : filteredCatalog.length === 0 ? <div className="col-span-full p-8 text-center text-slate-400 font-bold italic">No items found.</div> : filteredCatalog.map(item => {
                const avail = item.physical_stock - item.freezed_stock;
                return (
                  <div key={item.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col justify-between shadow-sm">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-black uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500">{item.unit}</span>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${avail > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>{avail > 0 ? `Avail: ${avail}` : 'Out of Stock'}</span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm leading-tight">{item.name}</h4>
                      <div className="flex flex-col gap-0.5 mt-1">
                        <p className="text-[10px] text-slate-500 font-semibold uppercase">{item.category}</p>
                        <p className="text-[9px] text-indigo-500 font-black uppercase tracking-wider">{item.fulfillment_dept?.replace('_HEAD', '') || 'SIYANAT'}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400">Phy: {item.physical_stock} | Frz: {item.freezed_stock}</span>
                      <button onClick={() => { setEditingItem(item); setEditModalOpen(true); }} className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 shadow-sm transition flex items-center gap-1"><Edit className="w-3.5 h-3.5" /> Edit</button>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {/* --- TAB 2: INCOMING RESTOCK (Now with CSV Integration) --- */}
      {activeTab === 'restock' && (
        <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200 space-y-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Process Bulk Shipment Restock</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Add rows manually or upload a formatted CSV.</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button onClick={downloadCSVTemplate} className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-wide rounded-xl shadow-sm transition flex items-center gap-1.5">
                <DownloadCloud className="w-4 h-4 text-brand-maroon" /> Get Template
              </button>
              
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-wide rounded-xl shadow-sm transition flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-emerald-600" /> Upload CSV
              </button>

              <button onClick={addRow} className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-wide rounded-xl shadow-sm transition flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add Row
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {rows.length === 0 ? (
               <div className="p-12 text-center text-slate-400 font-bold italic bg-slate-50 rounded-2xl border border-slate-100">
                 No items added to shipment. Add a row manually or upload a CSV.
               </div>
            ) : rows.map((row, index) => (
              <div key={row.id} className="relative bg-slate-50 rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col gap-4 animate-in fade-in duration-200">
                <button onClick={() => removeRow(row.id)} className="absolute top-3 right-3 p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition" title="Remove"><Trash2 className="w-4 h-4" /></button>
                <div className="font-black text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-1"><Hash className="w-3 h-3"/> Row {index + 1}</div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Source</label>
                    <select value={row.type} onChange={(e) => updateRow(row.id, 'type', e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none">
                      <option value="EXISTING">Catalog Item</option>
                      <option value="NEW">New Unlisted Item</option>
                    </select>
                  </div>
                  
                  <div className={row.type === 'NEW' ? "md:col-span-3" : "md:col-span-4"}>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Item Name</label>
                    {row.type === 'EXISTING' ? (
                      <select value={row.itemId} onChange={(e) => updateRow(row.id, 'itemId', e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none">
                        <option value="" disabled>-- Select Item --</option>
                        {catalog.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    ) : (
                      <input type="text" placeholder="e.g. Copper Wire" value={row.name} onChange={(e) => updateRow(row.id, 'name', e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none" />
                    )}
                  </div>

                  {row.type === 'NEW' && (
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-indigo-600 uppercase mb-1.5">Route To</label>
                      <select value={row.fulfillment_dept} onChange={(e) => updateRow(row.id, 'fulfillment_dept', e.target.value)} className="w-full p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="SIYANAT_HEAD">Siyanat</option>
                        <option value="TANZEEM_HEAD">Tanzeem</option>
                        <option value="AVIT_HEAD">AVIT</option>
                      </select>
                    </div>
                  )}

                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Category</label>
                    <select value={row.category} onChange={(e) => updateRow(row.id, 'category', e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none disabled:opacity-50" disabled={row.type === 'EXISTING'}>
                      {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <div className={row.type === 'NEW' ? "md:col-span-1" : "md:col-span-2"}>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Qty</label>
                    <input type="number" min="1" value={row.qty} onChange={(e) => updateRow(row.id, 'qty', parseInt(e.target.value) || 0)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-center outline-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={submitBulkRestock} disabled={submitting || rows.length === 0} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl transition flex justify-center items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" /> {submitting ? 'Processing Restock...' : 'Commit Restock to Warehouse'}
          </button>
        </div>
      )}

      {/* --- TAB 3: PENDING POs --- */}
      {activeTab === 'pos' && (
        <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200 space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Pending Purchase Orders (Receiving Dock)</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">Mark shipments as received to automatically update warehouse stock.</p>
          </div>
          <div className="space-y-4">
            {pendingPOs.length === 0 ? <div className="p-12 text-center text-slate-400 font-bold italic bg-slate-50 rounded-2xl border border-slate-100">No pending purchase orders waiting for delivery.</div> : pendingPOs.map(po => (
                <div key={po.id} className="bg-slate-50 rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-5">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-black text-brand-maroon text-base">{po.po_number}</h4>
                      <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[9px] font-black uppercase tracking-wider rounded border border-indigo-200">{po.status}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-slate-100">
                      <div><span className="text-[10px] font-black uppercase text-slate-400">Vendor:</span><p className="font-bold text-slate-800 text-xs">{po.vendor?.name || 'External Vendor'}</p></div>
                      <div><span className="text-[10px] font-black uppercase text-slate-400">Requested By:</span><p className="font-bold text-slate-800 text-xs">{po.technician?.full_name || 'Field Technician'}</p></div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400">Ordered Items:</span>
                      {po.items.map((i: any) => (
                        <div key={i.id} className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-100 flex justify-between">
                          <span>{i.custom_item_name || 'Catalog Item'}</span><span className="text-brand-maroon">Qty: {i.requested_qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <button onClick={() => setPoConfirmTarget(po)} disabled={processingId === po.id} className="w-full md:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50">
                      <Truck className="w-4 h-4" /> Receive Shipment
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* --- TAB 4: VENDOR DIRECTORY --- */}
      {activeTab === 'vendors' && (
        <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Manage Approved Vendors</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">Add external suppliers used for purchase order generation.</p>
          </div>
          <form onSubmit={handleAddVendor} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Register New Vendor</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Vendor Name *</label><input required type="text" placeholder="e.g. Al-Saif Hardware" value={newVendorName} onChange={e => setNewVendorName(e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none" /></div>
              <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Category *</label><select value={newVendorCategory} onChange={e => setNewVendorCategory(e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none"><option value="Electrical">Electrical</option><option value="Plumbing">Plumbing</option><option value="Carpentry">Carpentry</option><option value="Civil">Civil</option><option value="General">General / Stationery</option></select></div>
              <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Contact Info</label><input type="text" placeholder="Phone or email..." value={newVendorContact} onChange={e => setNewVendorContact(e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none" /></div>
            </div>
            <button type="submit" className="px-6 py-3 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition">Register Vendor</button>
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {vendors.map(v => (
              <div key={v.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                <div>
                  <div className="flex items-center gap-2"><h5 className="font-bold text-slate-800 text-sm">{v.name}</h5><span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${v.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>{v.is_active ? 'Active' : 'Disabled'}</span></div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Category: {v.category}</p>
                  {v.contact_info && <p className="text-[10px] text-slate-400 mt-0.5">{v.contact_info}</p>}
                </div>
                <button onClick={() => toggleVendorStatus(v.id, v.is_active)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${v.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>{v.is_active ? 'Disable' : 'Enable'}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="bg-slate-800 p-5 flex justify-between items-center text-white"><h3 className="font-extrabold text-sm uppercase">Edit Item</h3><button onClick={() => setEditModalOpen(false)}><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleUpdateItem} className="p-6 space-y-4">
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Name</label><input type="text" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold outline-none" /></div>
              <div>
                <label className="block text-[10px] font-bold text-indigo-600 uppercase mb-1">Department Route</label>
                <select value={editingItem.fulfillment_dept || 'SIYANAT_HEAD'} onChange={e => setEditingItem({...editingItem, fulfillment_dept: e.target.value})} className="w-full p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="SIYANAT_HEAD">Siyanat Operations</option>
                  <option value="TANZEEM_HEAD">Tanzeem Operations</option>
                  <option value="AVIT_HEAD">AVIT Operations</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Physical</label><input type="number" min="0" value={editingItem.physical_stock} onChange={e => setEditingItem({...editingItem, physical_stock: parseInt(e.target.value) || 0})} className="w-full p-3 border border-slate-300 rounded-xl text-xs font-black text-center outline-none" /></div>
                <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Frozen</label><input type="number" min="0" value={editingItem.freezed_stock} onChange={e => setEditingItem({...editingItem, freezed_stock: parseInt(e.target.value) || 0})} className="w-full p-3 border border-slate-300 rounded-xl text-xs font-black text-center outline-none" /></div>
              </div>
              <button type="submit" className="w-full py-3 bg-slate-900 text-white font-bold text-xs uppercase tracking-wide rounded-xl shadow-lg">Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {/* Receive PO Modal */}
      {poConfirmTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><Truck className="w-6 h-6" /></div>
            <h3 className="text-lg font-black text-slate-800 mb-2">Receive PO {poConfirmTarget.po_number}?</h3>
            <p className="text-xs text-slate-500 mb-6">Confirming this shipment will permanently inject the items into warehouse physical stock.</p>
            <div className="flex gap-3">
              <button onClick={() => setPoConfirmTarget(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition">Cancel</button>
              <button onClick={fulfillPO} disabled={!!processingId} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition disabled:opacity-50">Receive</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}