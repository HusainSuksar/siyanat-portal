import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Car, MapPin, Calculator, XCircle, Send, X, Plus, History, ListFilter } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

// Strict Type Interfaces
export interface VehicleRequest {
  id: string;
  destination: string;
  purpose: string;
  request_date: string;
  arrival_time: string;
  release_time: string | null;
  darajah: string;
  total_count: number;
  pipeline_state: string;
  assigned_vehicles?: string; // Added for history
  rejection_reason?: string;  // Added for history
  requester?: { full_name: string; department: string };
}

export interface FleetInventory {
  id: string;
  vehicle_type: string;
  license_plate: string;
  seat_capacity: number;
}

export interface Assignment {
  id: string;
  type: 'INTERNAL' | 'RENTAL';
  vehicleId?: string;
  name: string;
  capacity: number;
  rounds: number;
}

export default function FleetEngine() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // THE NEW FEATURE: Toggle between Active Queue and History Archive
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [vehicles, setVehicles] = useState<VehicleRequest[]>([]);
  const [internalFleet, setInternalFleet] = useState<FleetInventory[]>([]);
  
  const [fleetModalOpen, setFleetModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<VehicleRequest | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [departureTime, setDepartureTime] = useState('');
  const [customRentalName, setCustomRentalName] = useState('');
  const [customRentalCapacity, setCustomRentalCapacity] = useState(4);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [targetReq, setTargetReq] = useState<VehicleRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchFleet = async () => {
    setLoading(true);
    
    // Fetch AUTHORIZED for active assignment. Fetch others for history logs.
    const targetStates = viewMode === 'active' 
      ? ['AUTHORIZED'] 
      : ['PROCESSING', 'ACTION_REQUIRED', 'CLOSED', 'REJECTED'];

    const [reqRes, invRes] = await Promise.all([
      supabase.from('vehicle_requests')
        .select(`*, requester:profiles(full_name, department)`)
        .in('pipeline_state', targetStates)
        .order('request_date', { ascending: viewMode === 'active' }),
      supabase.from('fleet_inventory').select('*').eq('is_active', true).order('vehicle_type')
    ]);

    if (reqRes.data) setVehicles(reqRes.data as VehicleRequest[]);
    if (invRes.data) setInternalFleet(invRes.data as FleetInventory[]);
    setLoading(false);
  };

  // Re-fetch whenever the toggle is clicked
  useEffect(() => { fetchFleet(); }, [viewMode]);

  const addInternalVehicle = (v: FleetInventory) => {
    if (assignments.find(a => a.vehicleId === v.id)) return;
    setAssignments([...assignments, { id: crypto.randomUUID(), type: 'INTERNAL', vehicleId: v.id, name: `${v.vehicle_type} (${v.license_plate})`, capacity: v.seat_capacity, rounds: 1 }]);
  };

  const addRentalVehicle = () => {
    if (!customRentalName) return;
    setAssignments([...assignments, { id: crypto.randomUUID(), type: 'RENTAL', name: `Rental: ${customRentalName}`, capacity: customRentalCapacity, rounds: 1 }]);
    setCustomRentalName(''); setCustomRentalCapacity(4);
  };

  const updateRounds = (id: string, rounds: number) => {
    if (rounds < 1) return;
    setAssignments(assignments.map(a => a.id === id ? { ...a, rounds } : a));
  };

  const removeAssignment = (id: string) => setAssignments(assignments.filter(a => a.id !== id));

  const totalSeatsAssigned = assignments.reduce((total, a) => total + (a.capacity * a.rounds), 0);
  const passengersRemaining = selectedReq ? Math.max(0, selectedReq.total_count - totalSeatsAssigned) : 0;
  const isDeficit = passengersRemaining > 0;

  const handleFleetDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq || assignments.length === 0 || !departureTime) {
      showToast('Assignment and departure time required.', 'warning');
      return;
    }
    
    setProcessingId(selectedReq.id);
    const assignmentString = assignments.map(a => `${a.name} (x${a.rounds} rounds)`).join(' | ');

    try {
      await supabase.from('vehicle_requests').update({
        assigned_vehicles: assignmentString,
        departure_time: departureTime
      }).eq('id', selectedReq.id);

      await supabase.rpc('advance_pipeline', { target_table: 'vehicle_requests', target_id: selectedReq.id });

      await supabase.from('system_logs').insert({
        action_type: 'FLEET_DISPATCHED',
        description: `Dispatched fleet for ${selectedReq.destination}. Setup: ${assignmentString}.`,
        user_email: user?.email || 'Admin'
      });

      showToast('Fleet assigned and requester notified!', 'success');
      setFleetModalOpen(false); 
      setAssignments([]); 
      setDepartureTime('');
      fetchFleet();
    } catch(err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetReq || !rejectionReason.trim()) return;
    setProcessingId(targetReq.id);

    try {
      const { error } = await supabase.from('vehicle_requests').update({ 
        pipeline_state: 'REJECTED', 
        rejection_reason: rejectionReason 
      }).eq('id', targetReq.id);
      
      if (error) throw error;

      showToast('Vehicle request rejected and requester notified.', 'success');
      setRejectModalOpen(false);
      setRejectionReason('');
      fetchFleet();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* View Mode Toggle Switch */}
      <div className="flex justify-between items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto mb-4">
        <div className="flex gap-2 w-full">
          <button 
            onClick={() => setViewMode('active')} 
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition ${viewMode === 'active' ? 'bg-brand-maroon text-brand-gold shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <ListFilter className="w-4 h-4" /> Active Queue
          </button>
          <button 
            onClick={() => setViewMode('history')} 
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition ${viewMode === 'history' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <History className="w-4 h-4" /> History Log
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center animate-pulse text-slate-500 font-bold bg-white rounded-3xl border border-slate-200">Loading fleet requests...</div>
      ) : vehicles.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">
            {viewMode === 'active' ? 'No pending vehicle requests.' : 'No historical records found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {vehicles.map(v => (
            <div key={v.id} className={`bg-white rounded-3xl p-5 shadow-sm border flex flex-col lg:flex-row justify-between gap-5 transition hover:shadow-md ${v.pipeline_state === 'REJECTED' ? 'border-red-200' : 'border-slate-200'}`}>
               <div className="space-y-4 flex-1 w-full">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="font-black text-brand-maroon text-lg md:text-base leading-tight tracking-wide flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" /> {v.destination}
                      </h3>
                      {viewMode === 'history' && (
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${v.pipeline_state === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-700'}`}>
                          {v.pipeline_state === 'REJECTED' ? 'Rejected' : 'Dispatched'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 font-bold line-clamp-2">{v.purpose}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div>
                      <div className="font-black text-slate-800 text-xs">{new Date(v.request_date).toLocaleDateString()}</div>
                      <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">{v.requester?.full_name} • {v.requester?.department}</div>
                    </div>
                    <div>
                      <div className="font-black text-emerald-700 text-xs">Reach By: {v.arrival_time}</div>
                      {v.release_time && <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Release: {v.release_time}</div>}
                    </div>
                    <div>
                      <div className="font-black text-slate-700 text-xs tracking-wider">{v.darajah}</div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Passengers: <span className="text-brand-maroon">{v.total_count}</span></div>
                    </div>
                  </div>

                  {/* Show rejection reason or assigned fleet in history view */}
                  {viewMode === 'history' && v.pipeline_state === 'REJECTED' && v.rejection_reason && (
                    <div className="bg-red-50 p-3 rounded-xl border border-red-100 mt-4">
                      <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block mb-1">Reason for Rejection</span>
                      <p className="text-xs font-semibold text-red-900">{v.rejection_reason}</p>
                    </div>
                  )}
                  {viewMode === 'history' && v.pipeline_state !== 'REJECTED' && v.assigned_vehicles && (
                    <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 mt-4">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-1">Assigned Fleet Setup</span>
                      <p className="text-xs font-semibold text-indigo-900">{v.assigned_vehicles}</p>
                    </div>
                  )}
               </div>
               
               {viewMode === 'active' && (
                 <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-48 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-5">
                    <button onClick={() => { setSelectedReq(v); setFleetModalOpen(true); }} className="flex-1 lg:w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] shadow-sm flex items-center justify-center gap-2 transition">
                      <Calculator className="w-4 h-4" /> Calc & Assign
                    </button>
                    <button onClick={() => { setTargetReq(v); setRejectModalOpen(true); }} disabled={processingId === v.id} className="flex-1 lg:w-full py-3 bg-white hover:bg-red-50 text-red-600 font-black uppercase tracking-wider rounded-xl border border-red-200 text-[10px] shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                 </div>
               )}
            </div>
          ))}
        </div>
      )}

      {/* Fleet Assignment Modal Omitted for Brevity (It remains identical to your working version) */}
      {fleetModalOpen && selectedReq && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-start pt-10 sm:items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in duration-300 max-h-[90vh] flex flex-col">
            <div className="bg-indigo-600 p-5 flex justify-between items-center text-white shrink-0">
              <h3 className="font-extrabold text-sm uppercase flex items-center gap-2"><Calculator className="w-5 h-5"/> Fleet Calculation Engine</h3>
              <button onClick={() => setFleetModalOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Pax Needed</div>
                  <div className="text-2xl font-black text-slate-800 mt-1">{selectedReq.total_count}</div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 text-center">
                  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Seats Assigned</div>
                  <div className="text-2xl font-black text-indigo-700 mt-1">{totalSeatsAssigned}</div>
                </div>
                <div className={`p-4 rounded-2xl border text-center ${isDeficit ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                  <div className={`text-[10px] font-black uppercase tracking-widest ${isDeficit ? 'text-red-500' : 'text-emerald-600'}`}>Status</div>
                  <div className={`text-2xl font-black mt-1 ${isDeficit ? 'text-red-600' : 'text-emerald-700'}`}>{isDeficit ? `-${passengersRemaining} Deficit` : 'Capacity Met'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-black text-xs uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">1. Select Vehicles</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {internalFleet.map(v => (
                      <div key={v.id} onClick={() => addInternalVehicle(v)} className="flex justify-between items-center p-3 border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition cursor-pointer group">
                        <div>
                          <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-800">{v.vehicle_type}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase mt-0.5">{v.license_plate}</p>
                        </div>
                        <span className="text-[10px] font-black bg-slate-100 group-hover:bg-indigo-100 text-slate-600 group-hover:text-indigo-700 px-2 py-1 rounded">Seats: {v.seat_capacity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Inject Rental Vehicle</p>
                    <div className="flex gap-2">
                      <input type="text" placeholder="e.g. rented bus" value={customRentalName} onChange={e => setCustomRentalName(e.target.value)} className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"/>
                      <input type="number" min="1" placeholder="Seats" value={customRentalCapacity} onChange={e => setCustomRentalCapacity(parseInt(e.target.value) || 0)} className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none text-center"/>
                      <button onClick={addRentalVehicle} className="p-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition"><Plus className="w-4 h-4"/></button>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-black text-xs uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">2. Manage Multi-Rounds</h4>
                  {assignments.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-400 italic">Click a vehicle on the left to add.</div>
                  ) : (
                    <div className="space-y-3">
                      {assignments.map(a => (
                        <div key={a.id} className="p-3 bg-white border border-indigo-200 rounded-xl shadow-sm relative">
                          <button onClick={() => removeAssignment(a.id)} className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200 transition"><X className="w-3 h-3"/></button>
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="text-xs font-bold text-slate-800">{a.name}</p>
                              <p className="text-[9px] font-black text-indigo-500 uppercase mt-0.5">{a.type}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-black text-slate-500 uppercase block">Total Output</span>
                              <span className="text-sm font-black text-indigo-700">{a.capacity * a.rounds} seats</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-[10px] font-black uppercase text-slate-500">Rounds:</span>
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md overflow-hidden">
                              <button onClick={() => updateRounds(a.id, a.rounds - 1)} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 font-bold text-slate-600">-</button>
                              <span className="px-2 text-xs font-black text-slate-800">{a.rounds}</span>
                              <button onClick={() => updateRounds(a.id, a.rounds + 1)} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 font-bold text-slate-600">+</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="pt-4 border-t border-slate-100">
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Departure Time *</label>
                    <input required type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition"/>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-white shrink-0">
              <button onClick={handleFleetDispatch} disabled={processingId === selectedReq.id || assignments.length === 0 || !departureTime} className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl transition flex justify-center items-center gap-2 disabled:opacity-50">
                <Send className="w-4 h-4" /> {isDeficit ? `Dispatch with ${passengersRemaining} deficit` : 'Finalize Dispatch Setup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fleet Rejection Modal */}
      {rejectModalOpen && targetReq && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 bg-red-600 text-white flex justify-between items-center">
              <h3 className="font-bold uppercase text-sm">Reject Fleet Request</h3>
              <button onClick={() => setRejectModalOpen(false)} className="hover:text-red-200"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleRejectSubmit} className="p-5 space-y-4">
              <p className="text-xs text-slate-500 font-bold">Please provide a mandatory reason for rejecting this vehicle request:</p>
              <textarea required placeholder="Enter rejection reason..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm min-h-[100px]" />
              <button type="submit" disabled={processingId === targetReq.id} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl uppercase text-xs tracking-wider transition disabled:opacity-50">Confirm Rejection</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}