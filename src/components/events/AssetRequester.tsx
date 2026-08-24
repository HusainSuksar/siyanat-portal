import React, { useState } from 'react';
import { MonitorSpeaker, PackageSearch, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import type { EventFormData, StandardAsset, InventoryAsset } from '../../types/eventBooking';

export default function AssetRequester({
  formData,
  setFormData,
  inventory,
  standardAssets,
  showStockCount
}: {
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
  inventory: InventoryAsset[];
  standardAssets: StandardAsset[];
  showStockCount: boolean;
}) {
  const { showToast } = useToast();
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assetQty, setAssetQty] = useState(1);

  const toggleStandard = (asset: StandardAsset) => {
    setFormData(prev => {
      const exists = prev.requirements.find(r => r.id === asset.id);
      if (exists) return { ...prev, requirements: prev.requirements.filter(r => r.id !== asset.id) };
      return { ...prev, requirements: [...prev.requirements, { id: asset.id, dept: asset.department, item: asset.item_name, qty: 1 }] };
    });
  };

  const addDynamicAsset = () => {
    if (!selectedAssetId) return;
    const item = inventory.find(i => i.id === selectedAssetId);
    if (!item) return;

    const available = item.physical_stock - item.freezed_stock;
    if (assetQty > available) {
      showToast(`Only ${available} ${item.unit} available in stock!`, 'error');
      return;
    }

    setFormData(prev => ({
      ...prev,
      requirements: [...prev.requirements, { dept: item.fulfillment_dept || 'SIYANAT_HEAD', item: item.name, qty: assetQty }]
    }));
    setSelectedAssetId('');
    setAssetQty(1);
  };

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200">
      <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
        <MonitorSpeaker className="w-5 h-5 text-brand-maroon" />
        <h3 className="font-extrabold text-sm uppercase text-slate-800">Assets & Requirements</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3">AVIT Checklist</h4>
          <div className="space-y-2">
            {standardAssets.filter(a => a.department === 'AVIT_HEAD').map(asset => (
              <label key={asset.id} className="flex items-center space-x-2 p-2 bg-white rounded-lg cursor-pointer border border-slate-200 shadow-sm">
                <input 
                  type="checkbox" 
                  checked={formData.requirements.some(r => r.id === asset.id)} 
                  onChange={() => toggleStandard(asset)} 
                  className="w-4 h-4 text-brand-maroon rounded focus:ring-brand-maroon" 
                />
                <span className="text-xs font-bold text-slate-700">{asset.item_name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3">Siyanat Support</h4>
          <div className="space-y-2">
            {standardAssets.filter(a => a.department !== 'AVIT_HEAD').map(asset => (
              <label key={asset.id} className="flex items-center space-x-2 p-2 bg-white rounded-lg cursor-pointer border border-slate-200 shadow-sm">
                <input 
                  type="checkbox" 
                  checked={formData.requirements.some(r => r.id === asset.id)} 
                  onChange={() => toggleStandard(asset)} 
                  className="w-4 h-4 text-brand-maroon rounded focus:ring-brand-maroon" 
                />
                <span className="text-xs font-bold text-slate-700">{asset.item_name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 pt-5">
         <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-1"><PackageSearch className="w-3.5 h-3.5"/> Dynamic Catalog</h4>
         <div className="flex flex-col sm:flex-row gap-3 items-end">
           <div className="flex-1 w-full">
             <select 
               value={selectedAssetId} 
               onChange={e => setSelectedAssetId(e.target.value)} 
               className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
             >
               <option value="">-- Choose Item --</option>
               {inventory.map(item => {
                 const available = item.physical_stock - item.freezed_stock;
                 return (
                   <option key={item.id} value={item.id} disabled={available <= 0}>
                     {item.name} {showStockCount ? `(Avail: ${available})` : (available <= 0 ? '(Out of Stock)' : '')}
                   </option>
                 );
               })}
             </select>
           </div>
           <div className="w-full sm:w-24">
             <input 
               type="number" 
               min="1" 
               value={assetQty} 
               onChange={e => setAssetQty(parseInt(e.target.value, 10) || 1)} 
               className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-center outline-none" 
             />
           </div>
           <button type="button" onClick={addDynamicAsset} className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1">
             <PlusCircle className="w-4 h-4" /> Add
           </button>
         </div>
         {formData.requirements.length > 0 && (
           <div className="mt-4 space-y-2">
             {formData.requirements.map((req, idx) => (
               <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                 <div>
                   <div className="text-xs font-bold">{req.item}</div>
                   <div className="text-[9px] text-slate-500 uppercase">{req.dept}</div>
                 </div>
                 <div className="flex items-center gap-4">
                   {req.qty > 1 && <span className="text-xs font-black text-brand-maroon">Qty: {req.qty}</span>}
                   <button 
                     type="button" 
                     onClick={() => setFormData(prev => ({ ...prev, requirements: prev.requirements.filter((_, i) => i !== idx) }))} 
                     className="text-slate-400 hover:text-red-500"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                 </div>
               </div>
             ))}
           </div>
         )}
      </div>
    </div>
  );
}