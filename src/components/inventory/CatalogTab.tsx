import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, MapPin, Edit, X } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface Props {
  catalog: any[];
  locations: any[];
  loading: boolean;
  onRefresh: () => void;
}

export default function CatalogTab({ catalog, locations, loading, onRefresh }: Props) {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

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
      fulfillment_dept: editingItem.fulfillment_dept,
      warehouse_location: editingItem.warehouse_location
    }).eq('id', editingItem.id);

    if (!error) {
      showToast('Item updated successfully.', 'success');
      setEditModalOpen(false);
      onRefresh();
    } else {
      showToast('Error updating item: ' + error.message, 'error');
    }
    setProcessingId(null);
  };

  const filteredCatalog = catalog.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.warehouse_location && item.warehouse_location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200 space-y-5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
        <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Inventory Stock & Location Overview</h3>
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search name, category, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-400 font-bold animate-pulse">Loading catalog...</div>
        ) : filteredCatalog.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-400 font-bold italic">No items found.</div>
        ) : (
          filteredCatalog.map(item => {
            const avail = item.physical_stock - item.freezed_stock;
            return (
              <div key={item.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col justify-between shadow-sm hover:border-slate-300 transition">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500">{item.unit}</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${avail > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                      {avail > 0 ? `Avail: ${avail}` : 'Out of Stock'}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm leading-tight">{item.name}</h4>
                  <div className="flex flex-col gap-1 mt-2">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase">{item.category}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-brand-maroon bg-brand-maroon/10 px-2 py-0.5 rounded-md border border-brand-maroon/20">
                        <MapPin className="w-3 h-3" /> {item.warehouse_location || 'Main Store'}
                      </span>
                      <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">
                        {item.fulfillment_dept?.replace('_HEAD', '')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400">Phy: {item.physical_stock} | Frz: {item.freezed_stock}</span>
                  <button
                    onClick={() => { setEditingItem(item); setEditModalOpen(true); }}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 shadow-sm transition flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="bg-slate-800 p-5 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase">Edit Item</h3>
              <button onClick={() => setEditModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdateItem} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Name</label>
                <input type="text" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-brand-maroon uppercase mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Warehouse Location
                </label>
                <select
                  value={editingItem.warehouse_location || (locations[0]?.name ?? 'Main Store')}
                  onChange={e => setEditingItem({...editingItem, warehouse_location: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-indigo-600 uppercase mb-1">Department Route</label>
                <select value={editingItem.fulfillment_dept || 'SIYANAT_HEAD'} onChange={e => setEditingItem({...editingItem, fulfillment_dept: e.target.value})} className="w-full p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900 outline-none">
                  <option value="SIYANAT_HEAD">Siyanat Operations</option>
                  <option value="TANZEEM_HEAD">Tanzeem Operations</option>
                  <option value="AVIT_HEAD">AVIT Operations</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Physical</label>
                  <input type="number" min="0" value={editingItem.physical_stock} onChange={e => setEditingItem({...editingItem, physical_stock: parseInt(e.target.value) || 0})} className="w-full p-3 border border-slate-300 rounded-xl text-xs font-black text-center outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Frozen</label>
                  <input type="number" min="0" value={editingItem.freezed_stock} onChange={e => setEditingItem({...editingItem, freezed_stock: parseInt(e.target.value) || 0})} className="w-full p-3 border border-slate-300 rounded-xl text-xs font-black text-center outline-none" />
                </div>
              </div>
              <button type="submit" disabled={!!processingId} className="w-full py-3 bg-slate-900 text-white font-bold text-xs uppercase tracking-wide rounded-xl shadow-lg">
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}