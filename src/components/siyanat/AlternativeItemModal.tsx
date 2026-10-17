import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, X, CheckCircle, Package, ArrowRight, AlertCircle, Sparkles, Layers, PlusCircle } from 'lucide-react';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  physical_stock: number;
  freezed_stock: number;
  unit: string;
  fulfillment_dept?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  requestedItemName: string;
  requestedQty: number;
  fulfillmentDept: string;
  onConfirmAlternative: (item: InventoryItem, qty: number) => void;
}

export default function AlternativeItemModal({
  isOpen,
  onClose,
  requestedItemName,
  requestedQty,
  fulfillmentDept,
  onConfirmAlternative
}: Props) {
  const [activeTab, setActiveTab] = useState<'in_stock' | 'catalog_or_custom'>('in_stock');
  const [searchTerm, setSearchTerm] = useState('');
  const [customNameInput, setCustomNameInput] = useState('');
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [customQty, setCustomQty] = useState<number | null>(null);
  const subQty = customQty ?? requestedQty;

  const handleClose = () => {
    setSelectedItem(null);
    setSearchTerm('');
    setCustomNameInput('');
    setCustomQty(null);
    setActiveTab('in_stock');
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    const fetchCatalog = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('inventory_items')
          .select('id, name, category, physical_stock, freezed_stock, unit, fulfillment_dept')
          .order('name');

        if (fulfillmentDept) {
          const depts = fulfillmentDept.includes('SIYANAT') ? ['SIYANAT', 'SIYANAT_HEAD']
            : fulfillmentDept.includes('TANZEEM') ? ['TANZEEM', 'TANZEEM_HEAD']
            : fulfillmentDept.includes('AVIT') ? ['AVIT', 'AVIT_HEAD']
            : [fulfillmentDept];
          query = query.in('fulfillment_dept', depts);
        }

        const { data, error } = await query;
        if (!error && data) {
          setCatalog(data as InventoryItem[]);
        }
      } catch (err) {
        console.error('Failed to load catalog items:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [isOpen, fulfillmentDept]);

  if (!isOpen) return null;

  // Tab 1: In-stock items only (available > 0)
  // Tab 2: All catalog items regardless of stock
  const filteredItems = catalog.filter(item => {
    const available = Math.max(0, (item.physical_stock || 0) - (item.freezed_stock || 0));
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()));
    if (activeTab === 'in_stock') {
      return matchesSearch && available > 0;
    }
    return matchesSearch;
  });

  const handleApply = () => {
    let finalItem: InventoryItem | null = selectedItem;

    if (!finalItem && activeTab === 'catalog_or_custom' && customNameInput.trim()) {
      finalItem = {
        id: '',
        name: customNameInput.trim(),
        category: 'Custom / Procurement',
        physical_stock: 0,
        freezed_stock: 0,
        unit: 'Pcs',
        fulfillment_dept: fulfillmentDept
      };
    }

    if (!finalItem) return;

    onConfirmAlternative(finalItem, subQty);
    handleClose();
  };

  const isCustomCandidate = activeTab === 'catalog_or_custom' && !selectedItem && customNameInput.trim().length > 0;
  const canConfirm = !!selectedItem || isCustomCandidate;

  return (
    <div className="fixed inset-0 bg-black/60 z-[75] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="bg-brand-maroon p-5 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-gold" />
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wide">Item Substitution & PO Routing</h3>
              <p className="text-[11px] text-amber-200 font-medium">
                Swap requested item with in-stock inventory or substitute a preferred catalog SKU for PO
              </p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="hover:text-red-200 p-1 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Tab Mode Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('in_stock');
              setSelectedItem(null);
            }}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition ${
              activeTab === 'in_stock'
                ? 'border-brand-maroon text-brand-maroon bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>In-Stock Alternatives (Immediate Dispatch)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('catalog_or_custom');
              setSelectedItem(null);
            }}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition ${
              activeTab === 'catalog_or_custom'
                ? 'border-brand-maroon text-brand-maroon bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Catalog / Custom Swap (For PO)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Target comparison banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block">Originally Requested Item</span>
              <p className="text-sm font-extrabold text-slate-800 mt-0.5">{requestedItemName}</p>
            </div>
            <span className="bg-amber-200/80 text-amber-900 text-xs font-black px-2.5 py-1 rounded-xl">
              Original Req: {requestedQty}
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === 'in_stock'
                  ? "Search in-stock warehouse inventory by name or category..."
                  : "Search all catalog items (including 0-stock SKUs)..."
              }
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition"
              autoFocus
            />
          </div>

          {/* Tab 2: Custom Name Direct Entry Option */}
          {activeTab === 'catalog_or_custom' && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2">
              <label className="text-[11px] font-black text-indigo-900 uppercase flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5 text-indigo-600" /> Or Enter Custom Item Name to Order:
              </label>
              <input
                type="text"
                placeholder="e.g. Lizol 5L Floor Cleaner (Special Grade)"
                value={customNameInput}
                onChange={e => {
                  setCustomNameInput(e.target.value);
                  if (e.target.value) setSelectedItem(null);
                }}
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-[10px] text-indigo-700 font-medium">
                Tip: Typing a custom item name here substitutes the original item and automatically routes this requirement into the PO procurement queue.
              </p>
            </div>
          )}

          {/* Catalog List */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              {activeTab === 'in_stock'
                ? `Available Warehouse Stock (${filteredItems.length} items found)`
                : `Full Inventory Catalog (${filteredItems.length} items found)`}
            </span>

            {loading ? (
              <div className="py-8 text-center text-slate-400 text-xs font-bold animate-pulse">
                Scanning warehouse catalog...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs font-bold flex flex-col items-center gap-1.5">
                <AlertCircle className="w-6 h-6 text-slate-300" />
                <span>No items found matching "{searchTerm}".</span>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {filteredItems.map(item => {
                  const available = Math.max(0, (item.physical_stock || 0) - (item.freezed_stock || 0));
                  const isSelected = selectedItem?.id === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedItem(item);
                        setCustomNameInput('');
                      }}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-brand-maroon bg-rose-50/60 ring-2 ring-brand-maroon/20 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="text-xs font-black text-slate-800 flex items-center gap-2">
                          <span>{item.name}</span>
                          {isSelected && (
                            <CheckCircle className="w-4 h-4 text-brand-maroon shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                          {item.category || 'General'} • Unit: {item.unit || 'Pcs'}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {available > 0 ? (
                          <span className="text-[11px] font-black px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800">
                            Avail: {available} {item.unit || 'Pcs'}
                          </span>
                        ) : (
                          <span className="text-[11px] font-black px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                            Stock: 0 {item.unit || 'Pcs'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Item Confirmation details */}
          {(selectedItem || isCustomCandidate) && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl animate-in fade-in space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-black text-xs uppercase tracking-wide">
                <CheckCircle className="w-4 h-4" />
                <span>Selected Substitute</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-extrabold text-slate-800">
                    {selectedItem ? selectedItem.name : customNameInput.trim()}
                  </span>
                  <span className="text-slate-400 block text-[11px]">
                    {selectedItem ? (
                      <>
                        Available in Warehouse: {Math.max(0, (selectedItem.physical_stock || 0) - (selectedItem.freezed_stock || 0))} {selectedItem.unit}
                        {Math.max(0, (selectedItem.physical_stock || 0) - (selectedItem.freezed_stock || 0)) < subQty && (
                          <span className="text-amber-700 font-bold ml-1.5">(Will route to PO)</span>
                        )}
                      </>
                    ) : (
                      <span className="text-indigo-700 font-bold">Custom Item (Requires PO)</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-black text-slate-600 uppercase">Fulfill / PO Qty:</label>
                  <input
                    type="number"
                    min="1"
                    max={
                      activeTab === 'in_stock' && selectedItem
                        ? Math.max(1, (selectedItem.physical_stock || 0) - (selectedItem.freezed_stock || 0))
                        : undefined
                    }
                    value={subQty}
                    onChange={e => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 p-1.5 bg-white border border-slate-300 rounded-lg text-center font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-black text-xs uppercase tracking-widest rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleApply}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition flex items-center gap-1.5"
          >
            <span>Confirm Substitution</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
