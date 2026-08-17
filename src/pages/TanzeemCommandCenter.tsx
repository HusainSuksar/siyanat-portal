import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {CalendarCheck, Car, CheckCircle, XCircle, MapPin, Clock, Send, X, Users, Layers, ShieldCheck } from 'lucide-react';

export default function TanzeemCommandCenter() {
  const { user, role } = useAuth(); // FAST GLOBAL MEMORY
  const [activeTab, setActiveTab] = useState<'events' | 'fleet'>('events');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Data States
  const [events, setEvents] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  
  // Fleet Assignment Modal
  const [fleetModalOpen, setFleetModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [assignedVehicles, setAssignedVehicles] = useState('');
  const [departureTime, setDepartureTime] = useState('');

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Fetch Pending Events with Requirements
    const { data: eventData } = await supabase
      .from('events')
      .select(`*, requester:profiles(full_name, department), requirements:event_requirements(department, item_name)`)
      .eq('status', 'Pending Tanzeem Approval')
      .order('event_date', { ascending: true });

    if (eventData) setEvents(eventData);

    // 2. Fetch Pending Vehicle Requests
    const { data: vehicleData } = await supabase
      .from('vehicle_requests')
      .select(`*, requester:profiles(full_name, department)`)
      .eq('status', 'Pending Tanzeem Approval')
      .order('request_date', { ascending: true });

    if (vehicleData) setVehicles(vehicleData);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // --- EVENT LOGIC ---
  const approveEvent = async (id: string, title: string) => {
    if (!confirm('Confirm and approve this event booking? AVIT and Siyanat will be notified if required.')) return;
    setProcessingId(id);

    await supabase.from('events').update({ status: 'Approved & Scheduled' }).eq('id', id);
    await supabase.from('system_logs').insert({
      action_type: 'EVENT_APPROVED',
      description: `Approved venue booking: ${title}.`,
      user_email: user?.email || 'Admin'
    });

    fetchData();
    setProcessingId(null);
  };

  const rejectEvent = async (id: string) => {
    const reason = prompt('Please enter the reason for non-confirmation (This will be sent to the requester):');
    if (!reason) return alert('A reason is mandatory.');
    
    setProcessingId(id);
    await supabase.from('events').update({ status: 'Not Confirmed', rejection_reason: reason }).eq('id', id);
    fetchData();
    setProcessingId(null);
  };

  // --- FLEET LOGIC ---
  const handleFleetDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq || !assignedVehicles || !departureTime) return;
    setProcessingId(selectedReq.id);

    await supabase.from('vehicle_requests').update({
      status: 'Fleet Dispatched',
      assigned_vehicles: assignedVehicles,
      departure_time: departureTime
    }).eq('id', selectedReq.id);

    await supabase.from('system_logs').insert({
      action_type: 'FLEET_DISPATCHED',
      description: `Dispatched fleet (${assignedVehicles}) for destination: ${selectedReq.destination}.`,
      user_email: user?.email || 'Admin'
    });

    alert('Fleet assigned and requester notified!');
    setFleetModalOpen(false);
    setAssignedVehicles('');
    setDepartureTime('');
    fetchData();
    setProcessingId(null);
  };

  const rejectVehicle = async (id: string) => {
    const reason = prompt('Reason for rejection (e.g., Cars unavailable for requested time slot):');
    if (!reason) return alert('A reason is mandatory.');
    
    setProcessingId(id);
    await supabase.from('vehicle_requests').update({ status: 'Not Serviced', rejection_reason: reason }).eq('id', id);
    fetchData();
    setProcessingId(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="bg-brand-maroon/10 p-3 rounded-2xl">
            <ShieldCheck className="w-8 h-8 text-brand-maroon" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Tanzeem Command Center</h2>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Dual-approval for campus events and dynamic fleet logistics.
            </p>
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
                  
                  {/* Card Content (Mobile-First Layout) */}
                  <div className="space-y-4 flex-1 w-full">
                    
                    {/* Header: Title & Requester */}
                    <div>
                      <h3 className="font-black text-brand-maroon text-lg md:text-base leading-tight tracking-wide">{e.event_title}</h3>
                      <p className="text-xs text-slate-500 mt-1 font-bold flex items-center gap-1 uppercase tracking-wider">
                        <Users className="w-3 h-3"/> {e.requester?.full_name} • {e.requester?.department}
                      </p>
                    </div>

                    {/* Meta Grid: Schedule, Location, Darajah */}
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

                    {/* Requirements */}
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                      <h4 className="text-[10px] font-black uppercase text-amber-700/70 mb-2 flex items-center gap-1 tracking-widest"><Layers className="w-3.5 h-3.5"/> Requested Assets</h4>
                      {e.requirements && e.requirements.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {e.requirements.map((req: any, idx: number) => (
                            <span key={idx} className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm border ${req.department === 'AVIT' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-700 border-slate-200'}`}>
                              {req.item_name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-amber-600/70 font-bold italic text-[11px]">No additional assets requested.</span>
                      )}
                    </div>
                  </div>

                  {/* Actions (Stacked on Mobile, Right-aligned on Desktop) */}
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
                    
                    {/* Card Content */}
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

                    {/* Actions */}
                    <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-48 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-5">
                      <button onClick={() => { setSelectedReq(v); setFleetModalOpen(true); }} className="flex-1 lg:w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] shadow-sm flex items-center justify-center gap-2 transition">
                        <Car className="w-4 h-4" /> Assign Fleet
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

      {/* --- FLEET ASSIGNMENT MODAL --- */}
      {fleetModalOpen && selectedReq && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-end sm:items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
            <div className="bg-indigo-600 p-5 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase flex items-center gap-2"><Car className="w-5 h-5"/> Dispatch Fleet</h3>
              <button onClick={() => setFleetModalOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition"><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            <form onSubmit={handleFleetDispatch} className="p-6 space-y-5">
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-xs text-indigo-900 leading-relaxed shadow-inner">
                <span className="font-black block mb-1 uppercase tracking-widest text-[9px] text-indigo-400">Objective</span> 
                Transport <strong className="text-brand-maroon">{selectedReq.total_count} pax</strong> to <strong>{selectedReq.destination}</strong> by <strong>{selectedReq.arrival_time}</strong>.
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Assign Vehicles (Internal/Rental) *</label>
                <input required type="text" value={assignedVehicles} onChange={e => setAssignedVehicles(e.target.value)} placeholder="e.g. 2x Magic Vans (2 rounds each), 1x Bus" className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-sm"/>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Calculated Departure Time *</label>
                <input required type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-sm"/>
                <p className="text-[10px] text-slate-400 mt-1.5 font-bold uppercase">Based on transit time, when should they leave campus?</p>
              </div>

              <button type="submit" disabled={processingId === selectedReq.id} className="w-full py-4 mt-2 bg-slate-900 hover:bg-black text-white font-extrabold text-xs uppercase tracking-widest rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition">
                <Send className="w-4 h-4" /> Dispatch Logistics
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}