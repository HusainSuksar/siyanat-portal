import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ShoppingCart, RefreshCw, Clock, AlertTriangle, Edit, 
  Trash2, CheckCircle, X, PackageSearch, FileText, ShoppingBag 
} from 'lucide-react';
import DirectPOModal from '../components/inventory/DirectPOModal';
import AlternativeItemModal, { InventoryItem } from '../components/siyanat/AlternativeItemModal';

export default function RequestToOrder() {
  const { user: currentUser, role: userRole } = useAuth();
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Edit ETA Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newEta, setNewEta] = useState(0);

  // Direct PO Modal State
  const [isDirectPOOpen, setIsDirectPOOpen] = useState(false);

  // Swap / Substitute Modal State
  const [swapModalTarget, setSwapModalTarget] = useState<{ item: any; name: string; qty: number; dept: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const currentRole = userRole || '';
    
    // Fetch items with complete PO lifecycle
    let query = supabase
      .from('work_order_items')
      .select(`
        *,
        work_order:work_orders(id, batch_id, department, location, created_at, requester_id),
        inventory:inventory_items(name, physical_stock)
      `)
      .in('status', ['Pending', 'Ordered', 'PO Issued'])
      .order('id', { ascending: false });

    // Resilient Department Filtering (Handles both 'SIYANAT' and 'SIYANAT_HEAD')
    if (currentRole === 'SIYANAT_HEAD') {
      query = query.in('fulfillment_dept', ['SIYANAT_HEAD', 'SIYANAT']);
    } else if (currentRole === 'TANZEEM_HEAD') {
      query = query.in('fulfillment_dept', ['TANZEEM_HEAD', 'TANZEEM']);
    } else if (currentRole === 'AVIT_HEAD') {
      query = query.in('fulfillment_dept', ['AVIT_HEAD', 'AVIT']);
    }

    const { data, error } = await query;

    if (!error && data) {
      // Fetch requester names for batches
      const requesterIds = Array.from(new Set(data.map((i: any) => i.work_order?.requester_id).filter(Boolean)));
      const profileMap: Record<string, string> = {};
      
      if (requesterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', requesterIds);
        
        if (profiles) {
          profiles.forEach((p: any) => { profileMap[p.id] = p.full_name; });
        }
      }

      const formatted = data.map((item: any) => ({
        ...item,
        work_order: {
          ...item.work_order,
          requester_name: item.work_order?.requester_id ? (profileMap[item.work_order.requester_id] || 'Requester') : 'N/A'
        }
      }));

      setPendingItems(formatted);
    }
    setLoading(false);
  }, [userRole]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (isMounted) await fetchData();
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [fetchData]);

  // Actions
  const openEditModal = (item: any) => {
    setEditingItem(item);
    setNewEta(item.eta_days || 0);
    setEditModalOpen(true);
  };

  const saveEta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setProcessingId(editingItem.id);

    await supabase.from('work_order_items').update({ eta_days: newEta }).eq('id', editingItem.id);
    
    await supabase.from('system_logs').insert({
      action_type: 'ETA_UPDATED',
      description: `Admin updated ETA for pending item in batch ${editingItem.work_order?.batch_id} to ${newEta} days.`,
      user_email: currentUser?.email || 'Admin'
    });

    alert('ETA Updated Successfully!');
    setEditModalOpen(false);
    fetchData();
    setProcessingId(null);
  };

  // Editable Order Quantity handler
  const handleUpdateItemQty = async (item: any, newQtyVal: number) => {
    try {
      setProcessingId(item.id);
      const clampedQty = Math.max(1, newQtyVal);

      await supabase
        .from('work_order_items')
        .update({ requested_qty: clampedQty })
        .eq('id', item.id);

      const targetWoId = item.work_order?.id || item.work_order_id;
      if (targetWoId) {
        await supabase.from('work_order_logs').insert({
          work_order_id: targetWoId,
          author_id: currentUser?.id,
          message: `📝 Adjusted order qty for "${item.custom_item_name || item.inventory?.name || 'Item'}" from ${item.requested_qty} to ${clampedQty}.`
        });
      }

      await supabase.from('system_logs').insert({
        action_type: 'ORDER_QTY_UPDATED',
        description: `Admin updated order qty for item in batch ${item.work_order?.batch_id} to ${clampedQty}.`,
        user_email: currentUser?.email || 'Admin'
      });

      fetchData();
    } catch (err: any) {
      console.error('Failed to update qty:', err);
      alert('Error updating quantity: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Swap / Substitute Item handler
  const handleSwapAlternative = async (newAltItem: InventoryItem, subQty: number) => {
    if (!swapModalTarget) return;
    const targetItem = swapModalTarget.item;
    const oldName = targetItem.custom_item_name || targetItem.inventory?.name || 'Item';
    const newCustomName = `[Alt for: ${oldName}] ${newAltItem.name}`;

    try {
      setProcessingId(targetItem.id);

      // 1. Update work_order_items in Supabase
      const { error: updateErr } = await supabase
        .from('work_order_items')
        .update({
          inventory_id: newAltItem.id || null,
          custom_item_name: newCustomName,
          requested_qty: subQty,
          item_type: newAltItem.id ? 'Catalog' : 'Custom'
        })
        .eq('id', targetItem.id);

      if (updateErr) throw updateErr;

      // 2. Log in work_order_logs
      const targetWoId = targetItem.work_order?.id || targetItem.work_order_id;
      if (targetWoId) {
        await supabase.from('work_order_logs').insert({
          work_order_id: targetWoId,
          author_id: currentUser?.id,
          message: `🔄 Substituted RTO item: "${oldName}" replaced with "${newAltItem.name}" (Qty: ${subQty}).`
        });
      }

      await supabase.from('system_logs').insert({
        action_type: 'RTO_ITEM_SUBSTITUTED',
        description: `Substituted "${oldName}" with "${newAltItem.name}" (Qty: ${subQty}) in batch ${targetItem.work_order?.batch_id || 'N/A'}.`,
        user_email: currentUser?.email || 'Admin'
      });

      alert(`Substituted "${oldName}" with "${newAltItem.name}" successfully!`);
      fetchData();
    } catch (err: any) {
      console.error('Swap failed:', err);
      alert('Failed to swap item: ' + err.message);
    } finally {
      setProcessingId(null);
      setSwapModalTarget(null);
    }
  };

  const markAsOrdered = async (id: string, batchId: string) => {
    if (!confirm('Mark this item as officially ordered from a supplier?')) return;
    setProcessingId(id);

    await supabase.from('work_order_items').update({ status: 'Ordered' }).eq('id', id);
    
    await supabase.from('system_logs').insert({
      action_type: 'ITEM_ORDERED',
      description: `Admin marked pending item in batch ${batchId} as 'Ordered'.`,
      user_email: currentUser?.email || 'Admin'
    });

    fetchData();
    setProcessingId(null);
  };

  const cancelItem = async (id: string, batchId: string) => {
    if (!confirm('Cancel this item? It will be marked as "Not Provided" and removed from the procurement queue.')) return;
    setProcessingId(id);

    await supabase.from('work_order_items').update({ status: 'Not Provided' }).eq('id', id);
    
    await supabase.from('system_logs').insert({
      action_type: 'ITEM_CANCELLED',
      description: `Admin cancelled pending item in batch ${batchId}.`,
      user_email: currentUser?.email || 'Admin'
    });

    fetchData();
    setProcessingId(null);
  };

  const deleteItem = async (id: string, batchId: string) => {
    if (!confirm(`Are you sure you want to delete this item from Batch ${batchId}?`)) return;
    setProcessingId(id);

    await supabase.from('work_order_items').delete().eq('id', id);
    
    await supabase.from('system_logs').insert({
      action_type: 'GOD_MODE_DELETE',
      description: `Admin deleted an item from material batch ${batchId}.`,
      user_email: currentUser?.email || 'Admin'
    });

    alert('Item deleted.');
    fetchData();
    setProcessingId(null);
  };

  // Metrics Calculations
  const totalItems = pendingItems.length;
  const totalPending = pendingItems.filter(i => i.status === 'Pending' || i.status === 'Ordered').length;
  const totalInFlight = pendingItems.filter(i => i.status === 'PO Issued').length;
  const customItems = pendingItems.filter(i => i.item_type === 'Custom').length;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-brand-maroon flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            Request-to-Order (Procurement)
          </h2>
          <p className="text-xs text-slate-500 mt-1">Manage unavailable stock, ETAs, and external vendor orders.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Direct PO Button */}
          {['SIYANAT_HEAD', 'TANZEEM_HEAD', 'AVIT_HEAD', 'SUPER_ADMIN', 'ADMIN'].includes(userRole) && (
            <button
              onClick={() => setIsDirectPOOpen(true)}
              className="px-4 py-2.5 bg-brand-maroon hover:bg-brand-dark text-brand-gold font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Direct PO</span>
            </button>
          )}

          <button onClick={fetchData} className="text-xs text-brand-maroon font-bold flex items-center space-x-1 hover:text-brand-dark bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase text-amber-600">Pending Purchase</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{totalPending}</div>
          </div>
          <AlertTriangle className="w-8 h-8 text-amber-100" />
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase text-indigo-600">POs Issued / Ordered</span>
            <div className="text-2xl font-black text-indigo-600 mt-1">{totalInFlight}</div>
          </div>
          <PackageSearch className="w-8 h-8 text-indigo-100" />
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase text-slate-500">Unlisted / Custom Items</span>
            <div className="text-2xl font-black text-slate-800 mt-1">{customItems}</div>
          </div>
          <ShoppingCart className="w-8 h-8 text-slate-100" />
        </div>
      </div>

      {/* Master Data Table */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
            <tr>
              <th className="p-3">Item Details</th>
              <th className="p-3">Batch & Requester</th>
              <th className="p-3">Quantity & ETA</th>
              <th className="p-3 text-right">Procurement Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={4} className="p-4 text-center">Loading queue...</td></tr>
            ) : totalItems === 0 ? (
              <tr><td colSpan={4} className="p-4 text-center font-medium italic text-slate-500">No items currently pending procurement.</td></tr>
            ) : (
              pendingItems.map(item => {
                const itemName = item.item_type === 'Catalog' ? item.inventory?.name : item.custom_item_name;
                const isCustom = item.item_type === 'Custom';
                const isSubstituted = item.custom_item_name?.includes('[Alt for:');
                
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-bold text-slate-800 text-sm">{itemName}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {isCustom ? (
                          <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-bold uppercase">Custom Item</span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[9px] font-bold uppercase">Catalog</span>
                        )}
                        {isSubstituted && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded text-[9px] font-black uppercase">Substituted</span>
                        )}
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold uppercase">{item.fulfillment_dept ? item.fulfillment_dept.replace('_HEAD', '') : 'GENERAL'}</span>
                      </div>

                      {/* Swap / Substitute Item Button */}
                      <button
                        type="button"
                        onClick={() => setSwapModalTarget({
                          item,
                          name: itemName || 'Item',
                          qty: item.requested_qty,
                          dept: item.fulfillment_dept || ''
                        })}
                        className="mt-1.5 text-[10px] font-black uppercase text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Swap / Substitute Item</span>
                      </button>
                    </td>

                    <td className="p-3">
                      <div className="font-bold text-brand-maroon">{item.work_order?.batch_id || 'N/A'}</div>
                      <div className="text-[10px] text-slate-500 font-semibold">{item.work_order?.requester_name} • {item.work_order?.department || 'General'}</div>
                      <div className="text-[10px] text-slate-400">{item.work_order?.created_at ? new Date(item.work_order.created_at).toLocaleDateString() : ''}</div>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-500">Order Qty:</span>
                        <input
                          type="number"
                          min={1}
                          defaultValue={item.requested_qty}
                          key={`${item.id}-${item.requested_qty}`}
                          onBlur={async (e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            if (val !== item.requested_qty) {
                              await handleUpdateItemQty(item, val);
                            }
                          }}
                          className="w-16 p-1 bg-white border border-slate-300 rounded-md text-xs font-black text-center focus:ring-2 focus:ring-brand-maroon outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'PO Issued' ? 'bg-indigo-100 text-indigo-800 flex items-center gap-1' :
                          item.status === 'Ordered' ? 'bg-purple-100 text-purple-800' : 
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {item.status === 'PO Issued' && <FileText className="w-3 h-3" />}
                          {item.status}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-0.5"><Clock className="w-3 h-3"/> {item.eta_days || 0} Days</span>
                      </div>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.status === 'Pending' && (
                          <button onClick={() => markAsOrdered(item.id, item.work_order?.batch_id)} disabled={processingId === item.id} className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition" title="Mark as Ordered">
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => openEditModal(item)} disabled={processingId === item.id} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition" title="Edit ETA">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => cancelItem(item.id, item.work_order?.batch_id)} disabled={processingId === item.id} className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition" title="Cancel/Not Provided">
                          <X className="w-4 h-4" />
                        </button>
                        
                        {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
                          <button onClick={() => deleteItem(item.id, item.work_order?.batch_id)} disabled={processingId === item.id} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition" title="Delete from Database">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit ETA Modal */}
      {editModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase">Update Expected ETA</h3>
              <button onClick={() => setEditModalOpen(false)}><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            
            <form onSubmit={saveEta} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Item</div>
                <div className="font-black text-slate-800">{editingItem.item_type === 'Catalog' ? editingItem.inventory?.name : editingItem.custom_item_name}</div>
                <div className="text-xs text-brand-maroon font-bold mt-1">Batch: {editingItem.work_order?.batch_id}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">New ETA (Days)</label>
                <input 
                  type="number" 
                  min="0" 
                  required
                  value={newEta} 
                  onChange={e => setNewEta(parseInt(e.target.value) || 0)} 
                  className="w-full p-3 border border-slate-300 rounded-xl text-lg font-black outline-none focus:ring-2 focus:ring-brand-maroon text-center"
                />
              </div>

              <button 
                type="submit" 
                disabled={processingId === editingItem.id}
                className="w-full py-3 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Save New ETA
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Alternative Item Substitution Modal */}
      {swapModalTarget && (
        <AlternativeItemModal
          isOpen={!!swapModalTarget}
          onClose={() => setSwapModalTarget(null)}
          requestedItemName={swapModalTarget.name}
          requestedQty={swapModalTarget.qty}
          fulfillmentDept={swapModalTarget.dept}
          onConfirmAlternative={handleSwapAlternative}
        />
      )}

      {/* Standalone Direct PO Modal */}
      <DirectPOModal
        isOpen={isDirectPOOpen}
        onClose={() => setIsDirectPOOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
}