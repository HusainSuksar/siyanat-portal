import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CalendarCheck, Car, CheckCircle, XCircle, MapPin, Clock, Send, X, Users, ShieldCheck, Plus, Calculator } from 'lucide-react';

export default function TanzeemCommandCenter() {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<'events' | 'fleet'>('events');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Data States
  const [events, setEvents] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [internalFleet, setInternalFleet] = useState<any[]>([]);
  
  // Fleet Assignment Modal & Engine State
  const [fleetModalOpen, setFleetModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [departureTime, setDepartureTime] = useState('');
  
  // The Fleet Calculation Engine State
  type Assignment = { id: string; type: 'INTERNAL' | 'RENTAL'; vehicleId?: string; name: string; capacity: number; rounds: number };
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  // Rental Form State
  const [customRentalName, setCustomRentalName] = useState('');
  const [customRentalCapacity, setCustomRentalCapacity] = useState(4);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: eventData } = await supabase.from('events').select(`*, requester:profiles(full_name, department), requirements:event_requirements(department, item_name)`).eq('status', 'Pending Tanzeem Approval').order('event_date', { ascending: true });
    if (eventData) setEvents(eventData);

    const { data: vehicleData } = await supabase.from('vehicle_requests').select(`*, requester:profiles(full_name, department)`).eq('status', 'Pending Tanzeem Approval').order('request_date', { ascending: true });
    if (vehicleData) setVehicles(vehicleData);

    const { data: fleetData } = await supabase.from('fleet_inventory').select('*').eq('is_active', true).order('vehicle_type');
    if (fleetData) setInternalFleet(fleetData);

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  // --- EVENT LOGIC ---
  const approveEvent = async (id: string, title: string) => {
    if (!confirm('Confirm and approve this event booking?')) return;
    setProcessingId(id);
    await supabase.from('events').update({ status: 'Approved & Scheduled' }).eq('id', id);
    await supabase.from('system_logs').insert({ action_type: 'EVENT_APPROVED', description: `Approved venue booking: ${title}.`, user_email: user?.email || 'Admin' });
    fetchData(); setProcessingId(null);
  };

  const rejectEvent = async (id: string) => {
    const reason = prompt('Reason for non-confirmation:');
    if (!reason) return alert('A reason is mandatory.');
    setProcessingId(id);
    await supabase.from('events').update({ status: 'Not Confirmed', rejection_reason: reason }).eq('id', id);
    fetchData(); setProcessingId(null);
  };

  // --- FLEET CALCULATION ENGINE ---
  const totalSeatsAssigned = assignments.reduce((total, a) => total + (a.capacity * a.rounds), 0);
  const passengersRemaining = selectedReq ? Math.max(0, selectedReq.total_count - totalSeatsAssigned) : 0;
  const isDeficit = passengersRemaining > 0;

  const addInternalVehicle = (v: any) => {
    if (assignments.find(a => a.vehicleId === v.id)) return; // Prevent duplicates
    setAssignments([...assignments, { id: Math.random().toString(), type: 'INTERNAL', vehicleId: v.id, name: `${v.vehicle_type} (${v.license_plate})`, capacity: v.seat_capacity, rounds: 1 }]);
  };

  const addRentalVehicle = () => {
    if (!customRentalName) return;
    setAssignments([...assignments, { id: Math.random().toString(), type: 'RENTAL', name: `Rental: ${customRentalName}`, capacity: customRentalCapacity, rounds: 1 }]);
    setCustomRentalName(''); setCustomRentalCapacity(4);
  };

  const updateRounds = (id: string, rounds: number) => {
    if (rounds < 1) return;
    setAssignments(assignments.map(a => a.id === id ? { ...a, rounds } : a));
  };

  const removeAssignment = (id: string) => setAssignments(assignments.filter(a => a.id !== id));

  // --- FLEET DISPATCH LOGIC ---
  const handleFleetDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq || assignments.length === 0 || !departureTime) return alert("Must assign at least one vehicle and set departure time.");
    if (isDeficit && !confirm(`WARNING: You are dispatching a fleet with a deficit of ${passengersRemaining} seats. Continue anyway?`)) return;
    setProcessingId(selectedReq.id);

    // Format the assignment string for the backend
    const assignmentString = assignments.map(a => `${a.name} (x${a.rounds} rounds)`).join(' | ');

    await supabase.from('vehicle_requests').update({
      status: 'Fleet Dispatched',
      assigned_vehicles: assignmentString,
      departure_time: departureTime
    }).eq('id', selectedReq.id);

    await supabase.from('system_logs').insert({
      action_type: 'FLEET_DISPATCHED',
      description: `Dispatched fleet for ${selectedReq.destination}. Setup: ${assignmentString}.`,
      user_email: user?.email || 'Admin'
    });

    alert('Fleet assigned and requester notified!');
    setFleetModalOpen(false); setAssignments([]); setDepartureTime('');
    fetchData(); setProcessingId(null);
  };

  const rejectVehicle = async (id: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return alert('A reason is mandatory.');
    setProcessingId(id);
    await supabase.from('vehicle_requests').update({ status: 'Not Serviced', rejection_reason: reason }).eq('id', id);
    fetchData(); setProcessingId(null);
  };

  const openFleetModal = (v: any) => {
    setSelectedReq(v); setAssignments([]); setDepartureTime(''); setFleetModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      {/* ... (Keep existing Header and Tabs code the exact same as previously provided) ... */}
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="bg-brand-maroon/10 p-3 rounded-2xl">
            <ShieldCheck className="w-8 h-8 text-brand-maroon" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Tanzeem Command Center</h2>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">Dual-approval for campus events and dynamic fleet logistics.</p>
          </div>
        </div>
        {(role === 'TANZEEM_HEAD' || role === 'SUPER_ADMIN') && (
          <div className="px-5 py-2.5 bg-brand-maroon text-brand-gold font-black text-xs uppercase tracking-widest rounded-xl shadow-md border border-brand-dark/20 flex items-center gap-2 w-full sm:w-auto justify-center">
            {role.replace('_', ' ')}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button onClick={() => setActiveTab('events')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'events' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <CalendarCheck className="w-4 h-4" /> Event Approvals
          {events.length > 0 && <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full ml-1">{events.length}</span>}
        </button>
        <button onClick={() => setActiveTab('fleet')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'fleet' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Car className="w-4 h-4" /> Fleet Logistics
          {vehicles.length > 0 && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full ml-1">{vehicles.length}</span>}
        </button>
      </div>

      {/* --- TAB 1: EVENT APPROVALS --- */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {loading ? (
             <div className="p-8 text-center font-medium text-slate-500 bg-white rounded-3xl border border-slate-200 shadow-sm animate-pulse">Loading events...</div>
          ) : events.length === 0 ? (
             <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
               <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
               <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">No pending events.</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {events.map(e => (
                <div key={e.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between gap-5 transition hover:shadow-md">
                  {/* ... (Keep existing Event Card content the exact same) ... */}
                  <div className="space-y-4 flex-1 w-full">
                    <div>
                      <h3 className="font-black text-brand-maroon text-lg md:text-base leading-tight tracking-wide">{e.event_title}</h3>
                      <p className="text-xs text-slate-500 mt-1 font-bold flex items-center gap-1 uppercase tracking-wider">
                        <Users className="w-3 h-3"/> {e.requester?.full_name} • {e.requester?.department}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                       <div>
                         <div className="flex items-center gap-1 text-slate-800 font-black text-xs"><Clock className="w-3.5 h-3.5 text-slate-400"/> {new Date(e.event_date).toLocaleDateString()}</div>
                         <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{e.timing_type}</div>
                         <div className="text-[10px] font-bold text-slate-600 mt-0.5 truncate max-w-[200px]" title={e.time_slot}>{e.time_slot}</div>
                       </div>
                       <div>
                         <div className="flex items-center gap-1 text-slate-800 font-black text-xs"><MapPin className="w-3.5 h-3.5 text-slate-400"/> {e.location}</div>
                         {e.sub_location && <div className="text-[10px] font-bold text-slate-500 mt-0.5 truncate">{e.sub_location}</div>}
                       </div>
                       <div>
                         <div className="font-black text-slate-700 text-xs tracking-wider">{e.darajah}</div>
                         <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Total Pax: <span className="text-brand-maroon">{e.total_count}</span></div>
                       </div>
                    </div>
                  </div>
                  <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-48 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-5">
                    <button onClick={() => approveEvent(e.id, e.event_title)} disabled={processingId === e.id} className="flex-1 lg:w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
                      <CheckCircle className="w-4 h-4"/> Confirm
                    </button>
                    <button onClick={() => rejectEvent(e.id)} disabled={processingId === e.id} className="flex-1 lg:w-full py-3 bg-white hover:bg-red-50 text-red-600 font-black uppercase tracking-wider rounded-xl border border-red-200 text-[10px] shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
                      <XCircle className="w-4 h-4"/> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: FLEET LOGISTICS --- */}
      {activeTab === 'fleet' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-8 text-center font-medium text-slate-500 bg-white rounded-3xl border border-slate-200 shadow-sm animate-pulse">Loading requests...</div>
          ) : vehicles.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
              <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">No pending vehicle requests.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {vehicles.map(v => (
                 <div key={v.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between gap-5 transition hover:shadow-md">
                    {/* ... (Keep existing Fleet Card content the exact same) ... */}
                    <div className="space-y-4 flex-1 w-full">
                       <div>
                         <h3 className="font-black text-brand-maroon text-lg md:text-base leading-tight tracking-wide flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {v.destination}</h3>
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
                    </div>
                    <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-48 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-5">
                      <button onClick={() => openFleetModal(v)} className="flex-1 lg:w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] shadow-sm flex items-center justify-center gap-2 transition">
                        <Calculator className="w-4 h-4" /> Calc & Assign
                      </button>
                      <button onClick={() => rejectVehicle(v.id)} disabled={processingId === v.id} className="flex-1 lg:w-full py-3 bg-white hover:bg-red-50 text-red-600 font-black uppercase tracking-wider rounded-xl border border-red-200 text-[10px] shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                 </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- COMPLEX FLEET CALCULATION MODAL --- */}
      {fleetModalOpen && selectedReq && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-start pt-10 sm:items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            
            <div className="bg-indigo-600 p-5 flex justify-between items-center text-white shrink-0">
              <h3 className="font-extrabold text-sm uppercase flex items-center gap-2"><Calculator className="w-5 h-5"/> Fleet Calculation Engine</h3>
              <button onClick={() => setFleetModalOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Top Summary Bar */}
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
                  <div className={`text-2xl font-black mt-1 ${isDeficit ? 'text-red-600' : 'text-emerald-700'}`}>
                    {isDeficit ? `-${passengersRemaining} Deficit` : 'Capacity Met'}
                  </div>
                </div>
              </div>

              {/* Assignment Engine Workspace */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Col: Vehicle Selection */}
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

                {/* Right Col: Active Assignments & Rounds */}
                <div className="space-y-4">
                  <h4 className="font-black text-xs uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">2. Manage Multi-Rounds</h4>
                  
                  {assignments.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-400 italic">No vehicles assigned yet. Click a vehicle on the left to add it.</div>
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
                            <span className="text-[10px] font-black uppercase text-slate-500">Number of Rounds:</span>
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
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Calculated Departure Time *</label>
                    <input required type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition"/>
                    <p className="text-[9px] text-slate-400 mt-1 font-bold uppercase">Back-calculate this based on the number of rounds and transit distance.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 bg-white shrink-0">
              <button 
                onClick={handleFleetDispatch}
                disabled={processingId === selectedReq.id || assignments.length === 0 || !departureTime}
                className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl transition flex justify-center items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> Finalize Dispatch Setup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}