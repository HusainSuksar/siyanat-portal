import React, { useState, useMemo } from 'react';
import { Search, Filter, Plus, Trash2, CheckSquare, Square, PackageSearch } from 'lucide-react';
import type { EventFormData, InventoryAsset, StandardAsset, EventRequirement } from '../../types/eventBooking';

interface AssetRequesterProps {
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
  inventory: InventoryAsset[];
  standardAssets: StandardAsset[];
  showStockCount?: boolean;
}

export default function AssetRequester({
  formData,
  setFormData,
  inventory,
  standardAssets,
  showStockCount = false
}: AssetRequesterProps) {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryAsset | null>(null);
  const [catalogQty, setCatalogQty] = useState(1);

  // Helper to extract name across any Supabase schema variation
  const getAssetName = (asset: any): string => {
    return asset?.item_name || asset?.name || asset?.asset_name || asset?.title || asset?.label || '';
  };

  // Group Standard Checkboxes into AVIT vs Siyanat Support
  const avitAssets = useMemo(() => {
    return standardAssets.filter(a => {
      const rawName = getAssetName(a).toLowerCase();
      const rawCat = (a.category || (a as any).dept || '').toUpperCase();
      
      if (rawCat === 'AVIT') return true;
      if (rawCat === 'SIYANAT' || rawCat === 'MAINTENANCE') return false;
      
      // Keyword matching fallback for legacy rows
      const isSiyanatItem = rawName.includes('seating') || 
                            rawName.includes('chair') || 
                            rawName.includes('ac override') || 
                            rawName.includes('barricade') || 
                            rawName.includes('cleaning') || 
                            rawName.includes('janitorial') ||
                            rawName.includes('lighting');
      return !isSiyanatItem;
    });
  }, [standardAssets]);

  const siyanatAssets = useMemo(() => {
    return standardAssets.filter(a => {
      const rawName = getAssetName(a).toLowerCase();
      const rawCat = (a.category || (a as any).dept || '').toUpperCase();
      
      if (rawCat === 'SIYANAT' || rawCat === 'MAINTENANCE') return true;
      if (rawCat === 'AVIT') return false;
      
      // Keyword matching fallback for legacy rows
      const isSiyanatItem = rawName.includes('seating') || 
                            rawName.includes('chair') || 
                            rawName.includes('ac override') || 
                            rawName.includes('barricade') || 
                            rawName.includes('cleaning') || 
                            rawName.includes('janitorial') ||
                            rawName.includes('lighting');
      return isSiyanatItem;
    });
  }, [standardAssets]);

  // Filter Catalog (400+ items support)
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const name = item.name || '';
      const category = item.category || '';
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = selectedDeptFilter === 'ALL' || item.fulfillment_dept === selectedDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [inventory, searchQuery, selectedDeptFilter]);

  // Standard Checkbox Toggle
  const toggleStandardAsset = (asset: StandardAsset) => {
    const assetName = getAssetName(asset);
    if (!assetName) return;

    const exists = formData.requirements.find(r => r.asset_type === 'STANDARD' && r.item_name === assetName);
    
    if (exists) {
      setFormData(prev => ({
        ...prev,
        requirements: prev.requirements.filter(r => !(r.asset_type === 'STANDARD' && r.item_name === assetName))
      }));
    } else {
      const newReq: EventRequirement = {
        item_name: assetName,
        quantity: 1,
        asset_type: 'STANDARD',
        is_returnable: asset.is_returnable ?? true
      };
      setFormData(prev => ({
        ...prev,
        requirements: [...prev.requirements, newReq]
      }));
    }
  };

  // Add Item from Dynamic Catalog
  const handleAddCatalogItem = () => {
    if (!selectedInventoryItem) return;

    const existingIndex = formData.requirements.findIndex(
      r => r.asset_type === 'CATALOG' && r.inventory_id === selectedInventoryItem.id
    );

    if (existingIndex >= 0) {
      const updated = [...formData.requirements];
      updated[existingIndex].quantity += catalogQty;
      setFormData(prev => ({ ...prev, requirements: updated }));
    } else {
      const newReq: EventRequirement = {
        inventory_id: selectedInventoryItem.id,
        item_name: selectedInventoryItem.name,
        quantity: catalogQty,
        asset_type: 'CATALOG',
        is_returnable: true
      };
      setFormData(prev => ({ ...prev, requirements: [...prev.requirements, newReq] }));
    }

    setSelectedInventoryItem(null);
    setCatalogQty(1);
    setSearchQuery('');
  };

  // Remove Requirement
  const removeRequirement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200 space-y-6">
      <div className="flex items-center space-x-2 border-b border-slate-100 pb-4">
        <span className="flex items-center justify-center w-6 h-6 bg-brand-maroon text-white text-xs font-black rounded-lg">3</span>
        <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Assets & Event Requirements</h3>
      </div>

      {/* 1. STANDARD CHECKLIST GRIDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* AVIT CHECKLIST */}
        <div className="space-y-3">
          <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">AVIT Checklist</span>
          <div className="space-y-2">
            {avitAssets.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-400 italic">
                No standard AVIT checklist items configured.
              </div>
            ) : (
              avitAssets.map(asset => {
                const assetName = getAssetName(asset);
                const isSelected = formData.requirements.some(r => r.asset_type === 'STANDARD' && r.item_name === assetName);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => toggleStandardAsset(asset)}
                    className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold transition text-left ${
                      isSelected ? 'bg-brand-maroon/5 border-brand-maroon text-brand-maroon shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{assetName}</span>
                    {isSelected ? <CheckSquare className="w-4 h-4 text-brand-maroon shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* SIYANAT SUPPORT */}
        <div className="space-y-3">
          <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">Siyanat Support</span>
          <div className="space-y-2">
            {siyanatAssets.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-400 italic">
                No standard Siyanat support checklist items configured.
              </div>
            ) : (
              siyanatAssets.map(asset => {
                const assetName = getAssetName(asset);
                const isSelected = formData.requirements.some(r => r.asset_type === 'STANDARD' && r.item_name === assetName);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => toggleStandardAsset(asset)}
                    className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold transition text-left ${
                      isSelected ? 'bg-brand-maroon/5 border-brand-maroon text-brand-maroon shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{assetName}</span>
                    {isSelected ? <CheckSquare className="w-4 h-4 text-brand-maroon shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC CATALOG SEARCH & PICKER */}
      <div className="pt-6 border-t border-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
            <PackageSearch className="w-4 h-4 text-brand-maroon" /> Dynamic Catalog Item Request
          </span>
          <span className="text-[10px] font-bold text-slate-400">{filteredInventory.length} item(s) available</span>
        </div>

        {/* Search & Department Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search 400+ items by name or category..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-maroon transition"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
            {[
              { id: 'ALL', label: 'All' },
              { id: 'SIYANAT_HEAD', label: 'Siyanat' },
              { id: 'AVIT_HEAD', label: 'AVIT' },
              { id: 'TANZEEM_HEAD', label: 'Stationery' },
            ].map(dept => (
              <button
                key={dept.id}
                type="button"
                onClick={() => setSelectedDeptFilter(dept.id)}
                className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition border ${
                  selectedDeptFilter === dept.id
                    ? 'bg-brand-maroon text-white border-brand-maroon shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {dept.label}
              </button>
            ))}
          </div>
        </div>

        {/* Searchable Picker Row */}
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <select
            value={selectedInventoryItem?.id || ''}
            onChange={(e) => {
              const item = inventory.find(i => i.id === e.target.value) || null;
              setSelectedInventoryItem(item);
            }}
            className="w-full sm:flex-1 p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand-maroon shadow-sm"
          >
            <option value="">-- Choose Item ({filteredInventory.length} filtered) --</option>
            {filteredInventory.map(item => {
              const available = Math.max(0, item.physical_stock - item.freezed_stock);
              return (
                <option key={item.id} value={item.id}>
                  {item.name} {showStockCount ? `(Avail: ${available})` : ''} - [{item.fulfillment_dept?.replace('_HEAD', '') || 'General'}]
                </option>
              );
            })}
          </select>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input 
              type="number" 
              min="1" 
              value={catalogQty}
              onChange={(e) => setCatalogQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-center outline-none focus:ring-2 focus:ring-brand-maroon shadow-sm"
            />
            <button
              type="button"
              disabled={!selectedInventoryItem}
              onClick={handleAddCatalogItem}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-sm disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>
      </div>

      {/* 3. CURRENTLY ADDED REQUIREMENTS LIST */}
      {formData.requirements.length > 0 && (
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">Selected Event Assets & Services</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {formData.requirements.map((req, idx) => (
              <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="font-bold text-slate-800">{req.item_name}</span>
                  <span className="text-[9px] font-black uppercase text-slate-400 block mt-0.5">
                    {req.asset_type === 'STANDARD' ? 'Standard Checklist' : 'Catalog Request'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-brand-maroon bg-white px-2 py-1 rounded-lg border border-slate-200">
                    Qty: {req.quantity}
                  </span>
                  <button 
                    type="button"
                    onClick={() => removeRequirement(idx)} 
                    className="text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}