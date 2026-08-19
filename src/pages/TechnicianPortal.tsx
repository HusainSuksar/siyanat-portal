import { useState, useEffect } from 'react';
import { supabase, type InventoryItem } from '../lib/supabase';
import { Wrench, Printer, CheckCircle, MapPin, AlertCircle, PackageSearch, X, PlusCircle, Trash2, Send } from 'lucide-react';

export default function TechnicianPortal() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Material Request Modal State
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState<any>(null);
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Request Carts
  const [selectedItems, setSelectedItems] = useState<{ id: string, name: string, qty: number, type: 'Catalog' | 'Custom' }[]>([]);
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState(1);
  const [submittingMaterial, setSubmittingMaterial] = useState(false);

  const fetchAssignments = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    
    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();
      
      setUserProfile(profile);

      // THE FIX: Querying specifically for the universal pipeline_state
      const { data, error } = await supabase
        .from('technician_assignments')
        .select(`
          *,
          complaint:complaints(*)
        `)
        .eq('technician_id', authData.user.id)
        .in('complaint.pipeline_state', ['PROCESSING', 'ACTION_REQUIRED'])
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error("Database Error fetching assignments:", error.message);
      }
      
      if (data) {
        // Filter out any assignments where the joined complaint is null (due to inner join filtering logic)
        setAssignments(data.filter(a => a.complaint !== null));
      }
    }
    setLoading(false);
  };

  const fetchCatalog = async () => {
    const { data } = await supabase.from('inventory_items').select('*').order('name');
    if (data) setCatalog(data);
  };

  useEffect(() => {
    fetchAssignments();
    fetchCatalog();
  }, []);

  const completeTask = async (assignmentId: string, complaintId: string) => {
    if (!confirm(`Mark this task as fully completed? The Supervisor will be notified to verify.`)) return;

    // THE FIX: RPC Call to advance from PROCESSING to ACTION_REQUIRED
    await supabase.rpc('advance_pipeline', { target_table: 'complaints', target_id: complaintId });
    await supabase.from('technician_assignments').update({ status: 'Completed' }).eq('id', assignmentId);
    
    await supabase.from('system_logs').insert({
      action_type: 'TASK_COMPLETED',
      description: `Technician ${userProfile?.full_name} marked task for complaint ${complaintId} as completed.`,
      user_email: userProfile?.email || 'Technician'
    });

    fetchAssignments();
  };

  // --- MATERIAL REQUEST LOGIC ---
  const openMaterialModal = (assignment: any) => {
    setActiveAssignment(assignment);
    setSelectedItems([]);
    setCustomName('');
    setCustomQty(1);
    setMaterialModalOpen(true);
  };

  const addCatalogItem = (item: InventoryItem) => {
    const existing = selectedItems.find(i => i.id === item.id);
    if (existing) {
      setSelectedItems(prev => prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setSelectedItems(prev => [...prev, { id: item.id, name: item.name, qty: 1, type: 'Catalog' }]);
    }
  };

  const addCustomItem = () => {
    if (!customName.trim()) return;
    const tempId = `custom-${Math.random().toString(36).substr(2, 9)}`;
    setSelectedItems(prev => [...prev, { id: tempId, name: customName, qty: customQty, type: 'Custom' }]);
    setCustomName('');
    setCustomQty(1);
  };

  const updateItemQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setSelectedItems(prev => prev.filter(i => i.id !== id));
    } else {
      setSelectedItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
    }
  };

  const submitMaterialRequest = async () => {
    if (selectedItems.length === 0) return alert("Please select at least one material.");
    setSubmittingMaterial(true);

    try {
      // 1. Create a dummy Work Order tied to this complaint specifically for procurement
      const { data: woData, error: woError } = await supabase.from('work_orders').insert({
        requester_id: userProfile.id,
        department: 'Technician Procurement',
        location: activeAssignment.complaint.venue,
        urgency: 'High',
        reason: `Material required for Complaint: ${activeAssignment.complaint.complaint_id}`,
        approval_status: 'Pending Admin PO', 
        dispatch_status: 'Pending'
      }).select().single();

      if (woError) throw woError;

      // 2. Insert the requested items
      const itemsToInsert = selectedItems.map(item => ({
        work_order_id: woData.id,
        inventory_id: item.type === 'Catalog' ? item.id : null,
        custom_item_name: item.type === 'Custom' ? item.name : null,
        requested_qty: item.qty,
        item_type: item.type
      }));

      const { error: itemsError } = await supabase.from('work_order_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      await supabase.from('technician_assignments').update({ status: 'Waiting for Material' }).eq('id', activeAssignment.id);

      await supabase.from('system_logs').insert({
        action_type: 'TECH_MATERIAL_REQUEST',
        description: `Technician ${userProfile?.full_name} requested materials for ${activeAssignment.complaint.complaint_id}.`,
        user_email: userProfile?.email || 'Technician'
      });

      alert("Material request sent to Siyanat Operations for Purchase Order generation!");
      setMaterialModalOpen(false);
      fetchAssignments();

    } catch (err: any) {
      alert("Error submitting material request: " + err.message);
    } finally {
      setSubmittingMaterial(false);
    }
  };

  const printWorkloadSlip = () => {
    const tasksHtml = assignments.map((a, idx) => `
      <div style="border: 1px solid #000; padding: 15px; margin-bottom: 15px;">
        <h4 style="margin: 0 0 10px 0; border-bottom: 1px solid #ccc; padding-bottom: 5px;">
          TASK ${idx + 1} | ${a.complaint.complaint_id} 
          <span style="float: right;">${a.complaint.priority}</span>
        </h4>
        <p><strong>Category:</strong> ${a.complaint.category}</p>
        <p><strong>Location:</strong> ${a.complaint.zone} - ${a.complaint.venue} (${a.complaint.floor}, ${a.complaint.room_area})</p>
        <p><strong>Description:</strong> ${a.complaint.description}</p>
        <p><strong>Pipeline Status:</strong> ${a.complaint.pipeline_state}</p>
      </div>
    `).join("");

    const slipWindow = window.open('', '_blank');
    if (!slipWindow) return;

    slipWindow.document.write(`
      <html>
        <head>
          <title>Workload Slip - ${userProfile?.full_name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #000; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          </style>
        </head>
        <body onload="window.print();">
          <div class="header">
            <h2 style="margin: 0; color: #581c28;">SIYANAT UL MUMTALEKAAT</h2>
            <h3 style="margin: 5px 0;">TECHNICIAN WORKLOAD SLIP</h3>
          </div>
          <p><strong>Technician:</strong> ${userProfile?.full_name}</p>
          <p><strong>Trade:</strong> ${userProfile?.trade || 'General'}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Total Assigned Tasks:</strong> ${assignments.length}</p>
          <div style="margin-top: 20px;">
            ${tasksHtml}
          </div>
        </body>
      </html>
    `);
    slipWindow.document.close();
  };

  const filteredCatalog = catalog.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.category.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-brand-maroon p-6 rounded-3xl text-white shadow-lg">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-3 text-brand-gold">
            <Wrench className="w-7 h-7" />
            My Workload
          </h2>
          <p className="text-sm font-bold text-brand-gold/80 mt-1 uppercase tracking-wide">Technician: {userProfile?.full_name}</p>
        </div>
        <button 
          onClick={printWorkloadSlip}
          disabled={assignments.length === 0}
          className="w-full sm:w-auto px-5 py-3 bg-brand-gold hover:bg-amber-500 text-brand-dark font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition flex justify-center items-center space-x-2 disabled:opacity-50"
        >
          <Printer className="w-4 h-4" />
          <span>Print Slip</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="text-2xl md:text-3xl font-black text-slate-800">{assignments.length}</div>
          <div className="text-[9px] md:text-[10px] font-black tracking-widest text-slate-400 uppercase mt-1">Total Tasks</div>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="text-2xl md:text-3xl font-black text-red-600">
            {assignments.filter(a => a.complaint.priority.includes('URGENT')).length}
          </div>
          <div className="text-[9px] md:text-[10px] font-black tracking-widest text-slate-400 uppercase mt-1">Urgent</div>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="text-2xl md:text-3xl font-black text-emerald-600">
            {assignments.filter(a => a.complaint.pipeline_state === 'ACTION_REQUIRED').length}
          </div>
          <div className="text-[9px] md:text-[10px] font-black tracking-widest text-slate-400 uppercase mt-1">Completed</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-slate-500 font-bold animate-pulse bg-white rounded-3xl border border-slate-200">Loading assignments...</div>
        ) : assignments.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-3xl border border-slate-200 text-slate-500 font-bold">No active tasks assigned. Relax!</div>
        ) : (
          assignments.map(a => {
            const isUrgent = a.complaint.priority.includes('URGENT');
            const isCompleted = a.complaint.pipeline_state === 'ACTION_REQUIRED' || a.complaint.pipeline_state === 'CLOSED';
            const isWaiting = a.status === 'Waiting for Material';

            return (
              <div key={a.id} className={`bg-white rounded-3xl p-5 shadow-sm border-2 ${isUrgent ? 'border-red-400' : 'border-slate-200'} flex flex-col justify-between`}>
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-xs font-black text-brand-maroon tracking-wider">{a.complaint.complaint_id}</span>
                      <h3 className="font-extrabold text-slate-800 text-sm mt-0.5">{a.complaint.category}</h3>
                    </div>
                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider ${
                      isCompleted ? 'bg-emerald-100 text-emerald-800' : 
                      isWaiting ? 'bg-amber-100 text-amber-800' : 
                      'bg-indigo-100 text-indigo-800'
                    }`}>
                      {isCompleted ? 'Pending Verification' : a.complaint.pipeline_state}
                    </span>
                  </div>

                  <div className="space-y-2.5 mb-6 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-start gap-2 text-slate-700">
                      <MapPin className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
                      <div>
                        <span className="font-bold block">{a.complaint.venue}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{a.complaint.zone} ({a.complaint.floor}, {a.complaint.room_area})</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-slate-700 pt-2 border-t border-slate-200">
                      <AlertCircle className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
                      <span className="font-medium line-clamp-3 leading-relaxed">{a.complaint.description}</span>
                    </div>
                  </div>
                </div>

                {!isCompleted && !isWaiting && (
                  <div className="flex gap-2 pt-4 border-t border-slate-100">
                    <button 
                      onClick={() => openMaterialModal(a)}
                      className="flex-1 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 font-black text-[10px] uppercase tracking-wider rounded-xl transition flex flex-col justify-center items-center gap-1 border border-amber-200"
                    >
                      <PackageSearch className="w-4 h-4" />
                      Request Material
                    </button>
                    <button 
                      onClick={() => completeTask(a.id, a.complaint.id)}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-md transition flex flex-col justify-center items-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Mark Completed
                    </button>
                  </div>
                )}
                
                {isWaiting && (
                  <div className="pt-4 border-t border-slate-100 text-center">
                    <span className="text-xs font-bold text-amber-600 animate-pulse">Request sent. Awaiting Admin PO & Stock.</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* --- MATERIAL PROCUREMENT MODAL --- */}
      {materialModalOpen && activeAssignment && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-brand-maroon p-5 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2"><PackageSearch className="w-5 h-5 text-brand-gold"/> Request Material / Parts</h3>
                <p className="text-[10px] text-brand-gold mt-1 font-semibold">For Task: {activeAssignment.complaint.complaint_id}</p>
              </div>
              <button onClick={() => setMaterialModalOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition"><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Selected Items Cart */}
              {selectedItems.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Cart / Requested Items</h4>
                  <div className="space-y-2">
                    {selectedItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{item.name}</p>
                          <p className="text-[9px] font-black text-brand-maroon uppercase">{item.type}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                            <button onClick={() => updateItemQty(item.id, item.qty - 1)} className="px-2.5 py-1 bg-slate-50 hover:bg-slate-200 text-slate-600 font-bold">-</button>
                            <span className="px-3 py-1 text-xs font-black text-slate-800 bg-white">{item.qty}</span>
                            <button onClick={() => updateItemQty(item.id, item.qty + 1)} className="px-2.5 py-1 bg-slate-50 hover:bg-slate-200 text-slate-600 font-bold">+</button>
                          </div>
                          <button onClick={() => updateItemQty(item.id, 0)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Item Adder */}
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                <h4 className="text-[10px] font-black uppercase text-amber-800 tracking-widest mb-3">Can't find it? Request Custom Part</h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="text" placeholder="e.g. 50mm Brass Valve" value={customName} onChange={(e) => setCustomName(e.target.value)} className="flex-1 px-3 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon" />
                  <div className="flex gap-2">
                    <input type="number" min="1" value={customQty} onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)} className="w-20 px-3 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-center outline-none focus:ring-2 focus:ring-brand-maroon" />
                    <button onClick={addCustomItem} className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition"><PlusCircle className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>

              {/* Catalog Search & Select */}
              <div>
                <div className="flex justify-between items-end mb-3 border-b border-slate-100 pb-2">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Live Inventory Catalog</h4>
                  <input type="text" placeholder="Search catalog..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-32 sm:w-48 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-brand-maroon" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {filteredCatalog.length === 0 ? (
                    <div className="col-span-full text-center py-4 text-xs text-slate-400 font-bold italic">No items found.</div>
                  ) : (
                    filteredCatalog.map(item => {
                      const avail = item.physical_stock - item.freezed_stock;
                      return (
                        <div key={item.id} className="flex justify-between items-center p-2.5 border border-slate-200 rounded-xl hover:border-slate-300 transition cursor-pointer" onClick={() => avail > 0 && addCatalogItem(item)}>
                          <div>
                            <p className="text-xs font-bold text-slate-700">{item.name}</p>
                            <p className={`text-[9px] font-black uppercase mt-0.5 ${avail > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{avail > 0 ? `${avail} In Stock` : 'Out of Stock'}</p>
                          </div>
                          {avail > 0 && <PlusCircle className="w-4 h-4 text-brand-maroon opacity-50" />}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer / Submit */}
            <div className="p-5 border-t border-slate-100 bg-white shrink-0">
              <button 
                onClick={submitMaterialRequest}
                disabled={submittingMaterial || selectedItems.length === 0}
                className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl transition flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {submittingMaterial ? 'Sending Request...' : <><Send className="w-4 h-4"/> Submit Material Request</>}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}