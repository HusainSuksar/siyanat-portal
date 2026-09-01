import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Edit2, X, RefreshCw, Layers } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface StandardAssetItem {
  id: string;
  name?: string;
  item_name?: string;
  category: string;
  department?: string;
  is_returnable: boolean;
  is_active: boolean;
}

export default function StandardAssetsManager() {
  const { showToast } = useToast();
  const [assets, setAssets] = useState<StandardAssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'AVIT' | 'SIYANAT'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<'AVIT' | 'SIYANAT'>('AVIT');
  const [isReturnable, setIsReturnable] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAssets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('standard_event_assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      showToast(error.message, 'error');
    } else if (data) {
      setAssets(data as StandardAssetItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setItemName('');
    setCategory('AVIT');
    setIsReturnable(true);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (asset: StandardAssetItem) => {
    setEditingId(asset.id);
    setItemName(asset.name || asset.item_name || '');
    setCategory((asset.category as 'AVIT' | 'SIYANAT') || (asset.department?.includes('SIYANAT') ? 'SIYANAT' : 'AVIT'));
    setIsReturnable(asset.is_returnable ?? true);
    setIsActive(asset.is_active ?? true);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    setSaving(true);
    try {
      const cleanName = itemName.trim();
      const mappedDept = category === 'SIYANAT' ? 'SIYANAT_HEAD' : 'AVIT_HEAD';

      const payload = {
        name: cleanName,
        item_name: cleanName,
        category,
        department: mappedDept,
        is_returnable: isReturnable,
        is_active: isActive
      };

      if (editingId) {
        const { error } = await supabase
          .from('standard_event_assets')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        showToast('Checklist item updated successfully.', 'success');
      } else {
        const { error } = await supabase
          .from('standard_event_assets')
          .insert([payload]);
        if (error) throw error;
        showToast('Checklist item created successfully.', 'success');
      }

      setIsModalOpen(false);
      fetchAssets();
    } catch (err: any) {
      showToast(err.message || 'Error saving asset', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" from the event checklist?`)) return;

    try {
      const { error } = await supabase
        .from('standard_event_assets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Item deleted.', 'success');
      setAssets(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const toggleActiveStatus = async (asset: StandardAssetItem) => {
    try {
      const nextStatus = !asset.is_active;
      const { error } = await supabase
        .from('standard_event_assets')
        .update({ is_active: nextStatus })
        .eq('id', asset.id);

      if (error) throw error;
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, is_active: nextStatus } : a));
      showToast(`Item ${nextStatus ? 'Activated' : 'Deactivated'}.`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filteredAssets = assets.filter(a => {
    if (activeTab === 'ALL') return true;
    const itemCategory = (a.category || (a.department?.includes('SIYANAT') ? 'SIYANAT' : 'AVIT')).toUpperCase();
    return itemCategory === activeTab;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-maroon" /> Standard Event Checklist Assets
          </h3>
          <p className="text-xs font-bold text-slate-500 mt-0.5">
            Configure checklist buttons shown on the Book Event form.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={fetchAssets}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openAddModal}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-brand-maroon hover:bg-brand-dark text-brand-gold text-xs font-black uppercase tracking-wider rounded-xl transition shadow flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-1">
        {(['ALL', 'AVIT', 'SIYANAT'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition ${
              activeTab === tab ? 'bg-brand-maroon text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {tab === 'ALL' ? 'All Checklists' : tab === 'AVIT' ? 'AVIT Checklist' : 'Siyanat Support'}
          </button>
        ))}
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-bold animate-pulse bg-white rounded-3xl border border-slate-200">
          Loading checklist items...
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="p-12 text-center text-slate-400 font-bold bg-white rounded-3xl border border-slate-200">
          No standard checklist items configured. Click "Add Item" to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map(asset => {
            const displayName = asset.name || asset.item_name || 'Unnamed Item';
            const displayCategory = asset.category || (asset.department?.includes('SIYANAT') ? 'SIYANAT' : 'AVIT');
            return (
              <div
                key={asset.id}
                className={`p-4 rounded-2xl border transition bg-white shadow-sm flex flex-col justify-between gap-3 ${
                  !asset.is_active ? 'opacity-50 border-dashed border-slate-300' : 'border-slate-200 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                      displayCategory === 'SIYANAT' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {displayCategory}
                    </span>
                    <button
                      onClick={() => toggleActiveStatus(asset)}
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded transition ${
                        asset.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {asset.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 leading-snug">{displayName}</h4>
                  <span className="text-[10px] font-semibold text-slate-400 block mt-1">
                    {asset.is_returnable ? '🔄 Returnable after event' : '📦 Consumable / One-time service'}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => openEditModal(asset)}
                    className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                    title="Edit Item"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(asset.id, displayName)}
                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                    title="Delete Item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-black uppercase tracking-tight text-slate-800">
                {editingId ? 'Edit Checklist Item' : 'New Checklist Item'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Item / Service Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Projector & Screen, AC Override..."
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Assigned Department / Checklist</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as any)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
                >
                  <option value="AVIT">AVIT Checklist (Audio/Visual, IT, Tech)</option>
                  <option value="SIYANAT">Siyanat Support (Facility, Seating, AC, Cleaning)</option>
                </select>
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isReturnable}
                    onChange={e => setIsReturnable(e.target.checked)}
                    className="rounded text-brand-maroon focus:ring-brand-maroon"
                  />
                  <span className="text-xs font-bold text-slate-700">Item is Returnable (requires check-in after event)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="rounded text-brand-maroon focus:ring-brand-maroon"
                  />
                  <span className="text-xs font-bold text-slate-700">Item is Active (visible on Book Event form)</span>
                </label>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-brand-maroon hover:bg-brand-dark text-brand-gold font-black rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Item' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}