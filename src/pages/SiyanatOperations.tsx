import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, MessageSquare, Truck, UserPlus, X, SplitSquareHorizontal, Trash2, CheckCircle, Package, Wrench, ShoppingCart, FileText } from 'lucide-react';
import BatchDetailsModal from '../components/BatchDetailsModal';

export default function SiyanatOperations() {
  const [activeTab, setActiveTab] = useState<'materials' | 'maintenance'>('materials');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Data State
  const [batches, setBatches] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  
  // Modal States
  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewBatch, setReviewBatch] = useState<any>(null);
  const [itemDecisions, setItemDecisions] = useState<any>({});
  
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [selectedTechId, setSelectedTechId] = useState('');

  // PO Modal State
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poBatch, setPoBatch] = useState<any>(null);
  const [selectedVendorId, setSelectedVendorId] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();
      const currentRole = profile?.role || '';
      setUserRole(currentRole);

      // 1. Fetch Materials
      const { data: batchData, error: batchError } = await supabase
        .from('work_orders')
        .select(`
          *, 
          requester:profiles(full_name, department),
          logs:work_order_logs(author_id), 
          items:work_order_items(
            id, requested_qty, item_type, custom_item_name, status, eta_days, fulfillment_dept, inventory_id, 
            inventory:inventory_items(id, name, physical_stock, freezed_stock)
          )
        `)
        .in('pipeline_state', ['AUTHORIZED', 'PROCESSING'])
        .order('created_at', { ascending: false });

      if (batchError) throw batchError;

      if (batchData) {
        // Filter batches that contain items assigned to the current department
        const filteredBatches = batchData.filter(batch => {
          if (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN') return true;
          return batch.items && batch.items.some((item: any) => item.fulfillment_dept === currentRole);
        });
        setBatches(filteredBatches);
      }

      // 2. Fetch Maintenance
      let complaintQuery = supabase
        .from('complaints')
        .select(`
          *, 
          requester:profiles(full_name, department), 
          assignments:technician_assignments(status, technician:profiles!technician_assignments_technician_id_fkey(full_name, trade))
        `)
        .in('pipeline_state', ['AUTHORIZED', 'PROCESSING', 'ACTION_REQUIRED'])
        .order('created_at', { ascending: false });

      if (currentRole === 'SIYANAT_HEAD') {
        complaintQuery = complaintQuery.neq('category', 'AVIT');
      } else if (currentRole === 'AVIT_HEAD') {
        complaintQuery = complaintQuery.eq('category', 'AVIT');
      }

      const { data: complaintData, error: complaintError } = await complaintQuery;
      if (complaintError) throw complaintError;
      if (complaintData) setComplaints(complaintData);

      // 3. Fetch Technicians
      const { data: techData } = await supabase.from('profiles').select('id, full_name, trade').eq('role', 'EXECUTOR');
      if (techData) setTechnicians(techData);

      // 4. Fetch Vendors for PO Engine
      const { data: vendorData } = await supabase.from('vendors').select('*').eq('is_active', true).order('name');
      if (vendorData) setVendors(vendorData);

    } catch (err: any) {
      console.error("Error fetching operations data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));
  }, [fetchData, activeTab]); 

  // --- STANDARD MATERIAL LOGIC ---
  const openReviewModal = (batch: any) => {
    const relevantItems = (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') 
      ? batch.items 
      : batch.items.filter((i: any) => i.fulfillment_dept === userRole);

    setReviewBatch({ ...batch, items: relevantItems });
    
    const initialDecisions: any = {};
    relevantItems.forEach((item: any) => {
      initialDecisions[item.id] = { status: item.status || 'Available', eta: item.eta_days || 0 };
    });
    setItemDecisions(initialDecisions);
    setReviewModalOpen(true);
  };

  const updateDecision = (itemId: string, field: string, value: any) => {
    setItemDecisions((prev: any) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId(reviewBatch.id);

    try {
      // 1. Process only the items visible in the modal
      for (const item of reviewBatch.items) {
        const decision = itemDecisions[item.id];
        if (!decision) continue;

        await supabase.from('work_order_items').update({ status: decision.status, eta_days: decision.eta }).eq('id', item.id);

        // SECURITY FIX: Only freeze stock if moving FROM Pending TO Available
        if (item.status === 'Pending' && decision.status === 'Available' && item.item_type === 'Catalog' && item.inventory_id) {
          const inv = item.inventory;
          const newFreezedStock = (inv?.freezed_stock || 0) + item.requested_qty;
          await supabase.from('inventory_items').update({ freezed_stock: newFreezedStock }).eq('id', item.inventory_id);
        }
      }

      // 2. THE FIX: Smart Pipeline Evaluation
      const { data: allItems } = await supabase.from('work_order_items').select('status').eq('work_order_id', reviewBatch.id);
      
      const hasPending = allItems?.some(i => i.status === 'Pending' || i.status === 'Ordered');
      const hasAvailable = allItems?.some(i => i.status === 'Available');

      let newState = 'REJECTED';
      if (hasPending) {
        newState = 'PROCESSING';
      } else if (hasAvailable) {
        newState = 'ACTION_REQUIRED';
      }

      await supabase.from('work_orders').update({ pipeline_state: newState }).eq('id', reviewBatch.id);

      await supabase.from('system_logs').insert({
        action_type: 'BATCH_REVIEWED',
        description: `Department processed items for material batch ${reviewBatch.batch_id}.`,
        user_email: currentUser?.email || 'Admin'
      });

      setSuccessMsg("Batch items processed and stock updated successfully!");
      setReviewModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert("Error processing batch: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // --- VENDOR PURCHASE ORDER LOGIC ---
  const generatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId || !poBatch) return;
    setProcessingId(poBatch.id);

    try {
      const poNumber = `PO-${Math.floor(100000 + Math.random() * 900000)}`;
      const complaintMatch = poBatch.reason.match(/Complaint:\s*([A-Za-z0-9-]+)/);
      const complaintRef = complaintMatch ? complaintMatch[1] : null;

      let actualComplaintId = null;
      if (complaintRef) {
        const { data: comp } = await supabase.from('complaints').select('id').eq('complaint_id', complaintRef).single();
        if (comp) actualComplaintId = comp.id;
      }

      const { data: newPo, error: poError } = await supabase.from('purchase_orders').insert({
        po_number: poNumber,
        complaint_id: actualComplaintId,
        technician_id: poBatch.requester_id,
        vendor_id: selectedVendorId,
        status: 'PO Issued'
      }).select().single();

      if (poError) throw poError;

      const poItems = poBatch.items.map((item: any) => ({
        po_id: newPo.id,
        inventory_id: item.item_type === 'Catalog' ? item.inventory_id : null,
        custom_item_name: item.item_type === 'Custom' ? item.custom_item_name : null,
        requested_qty: item.requested_qty
      }));

      await supabase.from('purchase_order_items').insert(poItems);

      await supabase.from('work_orders').update({ pipeline_state: 'PROCESSING' }).eq('id', poBatch.id);

      await supabase.from('system_logs').insert({
        action_type: 'PO_GENERATED',
        description: `Generated ${poNumber} for vendor to fulfill technician material request.`,
        user_email: currentUser?.email || 'Admin'
      });

      setSuccessMsg(`Official Purchase Order (${poNumber}) successfully generated!`);
      setPoModalOpen(false);
      fetchData();

    } catch (err: any) {
      alert("Error generating PO: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const deleteBatch = async (id: string, batchId: string) => {
    if (!confirm(`GOD MODE WARNING: Are you sure you want to completely eradicate Batch ${batchId}?`)) return;
    setProcessingId(id);
    await supabase.from('work_orders').delete().eq('id', id);
    fetchData();
    setProcessingId(null);
  };

  // --- MAINTENANCE LOGIC ---
  const handleAssignTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechId || !selectedComplaint) return;
    setProcessingId(selectedComplaint.id);

    try {
      const { error: assignError } = await supabase.from('technician_assignments').insert({
        complaint_id: selectedComplaint.id,
        technician_id: selectedTechId,
        assigned_by: currentUser?.id
      });
      
      if (assignError) throw assignError;

      if(selectedComplaint.pipeline_state === 'AUTHORIZED') {
         await supabase.rpc('advance_pipeline', { target_table: 'complaints', target_id: selectedComplaint.id });
      } else {
         await supabase.from('complaints').update({ status: 'Assigned' }).eq('id', selectedComplaint.id);
      }
      
      setAssignModalOpen(false);
      setSelectedTechId('');
      fetchData();
    } catch(err: any) {
       alert("DATABASE ERROR Assigning Technician: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const deleteComplaint = async (id: string, complaintId: string) => {
    if (!confirm(`GOD MODE WARNING: Eradicate Complaint ${complaintId}?`)) return;
    setProcessingId(id);
    await supabase.from('complaints').delete().eq('id', id);
    fetchData();
    setProcessingId(null);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-brand-maroon flex items-center gap-2">
            <Truck className="w-6 h-6" />
            Operations Control
          </h2>
          <p className="text-xs text-slate-500 mt-1">Manage material dispatches, vendor POs, and maintenance routing.</p>
        </div>
        <button onClick={fetchData} className="w-full md:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-brand-maroon font-bold rounded-lg flex items-center justify-center space-x-2 transition">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button onClick={() => setActiveTab('materials')} className={`px-4 py-2 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'materials' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Package className="w-4 h-4" /> Material Dispatch ({batches.length})
        </button>
        <button onClick={() => setActiveTab('maintenance')} className={`px-4 py-2 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'maintenance' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Wrench className="w-4 h-4" /> Maintenance Routing ({complaints.length})
        </button>
      </div>

      {/* --- TAB 1: MATERIAL DISPATCH --- */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          {loading ? (
             <div className="p-8 text-center font-medium text-slate-500 bg-white rounded-2xl border border-slate-200 animate-pulse">Loading batches...</div>
          ) : batches.length === 0 ? (
             <div className="p-8 text-center font-medium italic text-slate-500 bg-white rounded-2xl border border-slate-200">No active batches for your department.</div>
          ) : (
             <div className="grid grid-cols-1 gap-4">
               {batches.map(b => {
                 const isTechPORequest = b.department === 'Technician Procurement';
                 const myItems = (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN')
                   ? b.items || []
                   : b.items?.filter((i: any) => i.fulfillment_dept === userRole) || [];
                 const relevantItemsCount = myItems.length;
                 const needsReview = myItems.some((i: any) => i.status === 'Pending');

                 return (
                  <div key={b.id} className={`bg-white rounded-2xl p-5 shadow-sm border-2 flex flex-col md:flex-row md:items-center justify-between gap-4 ${isTechPORequest ? 'border-indigo-400' : 'border-slate-200'}`}>
                     
                     <div className="space-y-3 flex-1 w-full">
                       <div>
                         <div className="flex items-center gap-2 mb-1">
                           <h3 className="font-black text-brand-maroon text-sm md:text-base leading-tight">Batch: {b.batch_id}</h3>
                           {isTechPORequest && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[9px] font-black uppercase tracking-wider rounded border border-indigo-200">Field Request</span>}
                         </div>
                         <p className="text-xs text-slate-600 font-semibold">{b.requester?.full_name || 'Requester'} • {b.department}</p>
                       </div>

                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                         <div>
                           <div className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Location</div>
                           <div className="font-bold text-slate-700 text-xs">{b.location}</div>
                         </div>
                         <div>
                           <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Items to Process</div>
                           <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                             {relevantItemsCount} Department Item(s)
                           </span>
                         </div>
                       </div>
                     </div>

                     <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 flex-wrap">
                        
                        {/* SPECIAL PO ACTION & THE FIX: HIDE GHOST BUTTON */}
                        {isTechPORequest ? (
                          <button 
                            onClick={() => { setPoBatch(b); setPoModalOpen(true); }}
                            className="flex-1 md:w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 transition"
                          >
                            <ShoppingCart className="w-3.5 h-3.5"/> Gen PO
                          </button>
                        ) : needsReview ? (
                          <button onClick={() => openReviewModal(b)} className="flex-1 md:w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 transition">
                            <SplitSquareHorizontal className="w-3.5 h-3.5"/> Split & Dispatch
                          </button>
                        ) : (
                          <div className="flex-1 md:w-full py-2.5 px-3 bg-slate-100 text-slate-500 font-bold uppercase tracking-wider rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-200">
                            <CheckCircle className="w-3.5 h-3.5" /> Reviewed
                          </div>
                        )}
                        
                        <button onClick={() => { setActiveBatch(b); setIsChatOpen(true); }} className="flex-1 md:w-full py-2.5 px-3 bg-slate-800 hover:bg-black text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 transition">
                          <MessageSquare className="w-3.5 h-3.5"/> Chat
                        </button>
                        
                        {userRole === 'SUPER_ADMIN' && (
                          <button onClick={() => deleteBatch(b.id, b.batch_id)} disabled={processingId === b.id} className="py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition disabled:opacity-50 flex items-center justify-center">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                     </div>
                  </div>
                 );
               })}
             </div>
          )}
        </div>
      )}

      {/* --- TAB 2: MAINTENANCE ROUTING --- */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4">
          {loading ? (
             <div className="p-8 text-center font-medium text-slate-500 bg-white rounded-2xl border border-slate-200 animate-pulse">Loading complaints...</div>
          ) : complaints.length === 0 ? (
             <div className="p-8 text-center font-medium italic text-slate-500 bg-white rounded-2xl border border-slate-200">No maintenance tasks pending assignment.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {complaints.map(c => {
                const isAssigned = c.assignments && c.assignments.length > 0;
                return (
                  <div key={c.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                     <div className="space-y-3 flex-1 w-full">
                       <div>
                         <h3 className="font-black text-brand-maroon text-sm md:text-base leading-tight">{c.complaint_id}</h3>
                         <p className="text-xs text-slate-500 mt-1 font-semibold">{c.requester?.full_name}</p>
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                         <div>
                           <div className="font-bold text-slate-800 text-xs">{c.category}</div>
                           <div className="text-[10px] text-slate-600 mt-0.5">{c.zone} - {c.venue}</div>
                         </div>
                         <div>
                           <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Pipeline State</div>
                           <div className="flex flex-col gap-1 items-start">
                             <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${c.pipeline_state === 'PROCESSING' ? 'bg-indigo-200 text-indigo-900' : 'bg-slate-200 text-slate-800'}`}>
                               {c.pipeline_state}
                             </span>
                             {isAssigned && (
                               <span className="text-[9px] font-bold text-indigo-600 uppercase bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                 Tech: {c.assignments[0].technician?.full_name}
                               </span>
                             )}
                           </div>
                         </div>
                       </div>
                     </div>
                     <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 flex-wrap">
                        {(c.pipeline_state === 'AUTHORIZED' || c.pipeline_state === 'PROCESSING') && (
                          <button 
                            onClick={() => { setSelectedComplaint(c); setAssignModalOpen(true); }} 
                            className="flex-1 md:w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 transition"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> 
                            <span>{c.pipeline_state === 'PROCESSING' ? 'Reassign' : 'Assign'}</span>
                          </button>
                        )}
                        
                        {userRole === 'SUPER_ADMIN' && (
                          <button onClick={() => deleteComplaint(c.id, c.complaint_id)} disabled={processingId === c.id} className="py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition disabled:opacity-50 flex items-center justify-center">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                     </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- VENDOR PO GENERATION MODAL --- */}
      {poModalOpen && poBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-end sm:items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
            <div className="bg-indigo-600 p-5 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase flex items-center gap-2"><ShoppingCart className="w-5 h-5"/> Generate Purchase Order</h3>
              <button onClick={() => setPoModalOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition"><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            <form onSubmit={generatePO} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-1">Context</p>
                <p className="text-sm font-bold text-indigo-900">{poBatch.reason}</p>
              </div>
              
              <div>
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Requested Items</h4>
                <div className="space-y-2 border border-slate-200 rounded-xl p-2 bg-slate-50">
                  {poBatch.items.map((item: any) => {
                    const itemName = item.item_type === 'Catalog' && item.inventory ? item.inventory.name : item.custom_item_name;
                    return (
                      <div key={item.id} className="flex justify-between items-center p-2.5 bg-white rounded-lg border border-slate-100 shadow-sm">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{itemName}</p>
                          <p className="text-[9px] font-black text-brand-maroon uppercase mt-0.5">{item.item_type}</p>
                        </div>
                        <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-1 rounded">Qty: {item.requested_qty}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Select Approved Vendor *</label>
                <select 
                  required value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)} 
                  className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
                >
                  <option value="" disabled>-- Choose External Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={processingId === poBatch.id} className="w-full py-4 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition disabled:opacity-50 flex justify-center items-center gap-2">
                <FileText className="w-4 h-4" /> Issue Formal P.O. to Vendor
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- STANDARD BATCH REVIEW MODAL --- */}
      {reviewModalOpen && reviewBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-end sm:items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
            <div className="bg-brand-maroon p-5 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase">Review Batch: {reviewBatch.batch_id}</h3>
              <button onClick={() => setReviewModalOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition"><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            <form onSubmit={handleReviewSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-slate-500 font-bold mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                Determine availability for your department's items.
              </p>
              
              {reviewBatch.items.map((item: any) => {
                const itemName = item.item_type === 'Catalog' && item.inventory ? item.inventory.name : item.custom_item_name;
                const physicalStock = item.inventory?.physical_stock || 0;
                const frozenStock = item.inventory?.freezed_stock || 0;
                const availableStock = Math.max(0, physicalStock - frozenStock);
                
                return (
                  <div key={item.id} className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-4">
                      <div className="font-bold text-slate-800 text-sm md:text-xs">
                        {itemName}
                        <span className="ml-2 px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-bold uppercase tracking-wider">
                          {item.fulfillment_dept?.replace('_HEAD', '') || 'SIYANAT'}
                        </span>
                      </div>
                      <div className="text-[11px] md:text-[10px] text-slate-500 mt-1 md:mt-0">Requested: <span className="font-bold text-brand-maroon">{item.requested_qty}</span></div>
                      {item.item_type === 'Catalog' && (
                        <div className="text-[11px] md:text-[10px] text-emerald-600 font-bold mt-0.5">Avail Stock: {availableStock}</div>
                      )}
                    </div>
                    
                    <div className="md:col-span-5">
                      <select 
                        value={itemDecisions[item.id]?.status || 'Available'}
                        onChange={(e) => updateDecision(item.id, 'status', e.target.value)}
                        className="w-full p-3 md:p-2 bg-slate-50 border border-slate-300 rounded-xl md:rounded-lg text-sm md:text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon transition"
                      >
                        <option value="Available">Available (Freeze Stock)</option>
                        {/* THE FIX: Replaced Pending with Ordered */}
                        <option value="Ordered">Pending (Requires ETA)</option>
                        <option value="Not Provided">Not Provided (Reject)</option>
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      {/* THE FIX: Changed to trigger off 'Ordered' */}
                      {itemDecisions[item.id]?.status === 'Ordered' && (
                        <div className="animate-in fade-in duration-200">
                          <label className="block text-[10px] md:text-[9px] font-bold text-slate-500 uppercase mb-1">ETA (Days)</label>
                          <input 
                            type="number" 
                            min="1" 
                            required
                            value={itemDecisions[item.id]?.eta || ''}
                            onChange={(e) => updateDecision(item.id, 'eta', parseInt(e.target.value) || 0)}
                            className="w-full p-3 md:p-1.5 bg-white border border-slate-300 rounded-xl md:rounded text-sm md:text-xs font-bold outline-none text-center focus:ring-2 focus:ring-amber-500 transition"
                            placeholder="e.g. 5"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <button type="submit" disabled={processingId === reviewBatch.id} className="w-full py-4 md:py-3 mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wide rounded-xl shadow-lg transition disabled:opacity-50">
                Confirm & Process Items
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MAINTENANCE ASSIGN MODAL --- */}
      {assignModalOpen && selectedComplaint && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-end sm:items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
            <div className="bg-brand-maroon p-5 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase">Assign Technician</h3>
              <button onClick={() => setAssignModalOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition"><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            <form onSubmit={handleAssignTechnician} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Select Tradesman *</label>
                <select required value={selectedTechId} onChange={e => setSelectedTechId(e.target.value)} className="w-full p-3.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-maroon bg-slate-50 transition">
                  <option value="" disabled>-- Choose Tradesman --</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.trade || 'General'})</option>)}
                </select>
              </div>
              <button type="submit" disabled={processingId === selectedComplaint.id} className="w-full py-3.5 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wide rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center transition">
                Dispatch
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {activeBatch && currentUser && <BatchDetailsModal batchId={activeBatch.batch_id} workOrderId={activeBatch.id} isOpen={isChatOpen} onClose={() => { setIsChatOpen(false); setActiveBatch(null); }} currentUser={currentUser} />}
      
      {/* Success Modal */}
      {successMsg && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-5 shadow-inner">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 text-center mb-2">Success!</h3>
            <p className="text-sm text-slate-500 text-center font-medium leading-relaxed">{successMsg}</p>
            <button onClick={() => setSuccessMsg(null)} className="mt-8 w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition shadow-lg">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}