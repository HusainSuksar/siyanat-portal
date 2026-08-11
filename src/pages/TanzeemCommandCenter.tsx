import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, CalendarCheck, Car, CheckCircle, XCircle, MapPin, Clock, Send, X } from 'lucide-react';

export default function TanzeemCommandCenter() {
  const [activeTab, setActiveTab] = useState<'events' | 'fleet'>('events');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
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
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));
  }, []);

  // --- EVENT LOGIC ---
  const approveEvent = async (id: string, title: string) => {
    if (!confirm('Confirm and approve this event booking? AVIT and Siyanat will be notified if required.')) return;
    setProcessingId(id);

    await supabase.from('events').update({ status: 'Approved & Scheduled' }).eq('id', id);
    await supabase.from('system_logs').insert({
      action_type: 'EVENT_APPROVED',
      description: `Approved venue booking: ${title}.`,
      user_email: currentUser?.email || 'Admin'
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
      user_email: currentUser?.email || 'Admin'
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
    <div className="space-y-6 pb-24">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-brand-maroon flex items-center gap-2">
            <CalendarCheck className="w-6 h-6" />
            Tanzeem Command Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">Dual-approval for campus events and dynamic fleet logistics.</p>
        </div>
        <button onClick={fetchData} className="text-xs text-brand-maroon font-bold flex items-center space-x-1 hover:text-brand-dark">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      <div className="flex space-x-2 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition flex items-center gap-2 ${activeTab === 'events' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <CalendarCheck className="w-4 h-4" /> Event Approvals
          {events.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{events.length}</span>}
        </button>
        <button 
          onClick={() => setActiveTab('fleet')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition flex items-center gap-2 ${activeTab === 'fleet' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Car className="w-4 h-4" /> Fleet Logistics
          {vehicles.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{vehicles.length}</span>}
        </button>
      </div>

      {/* --- TAB 1: EVENT APPROVALS --- */}
      {activeTab === 'events' && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="p-3">Event Details</th>
                <th className="p-3">Schedule & Venue</th>
                <th className="p-3">Darajah & Headcount</th>
                <th className="p-3">Asset Requirements</th>
                <th className="p-3 text-right">Approval Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (<tr><td colSpan={5} className="p-4 text-center">Loading...</td></tr>) : events.length === 0 ? (<tr><td colSpan={5} className="p-4 text-center font-medium italic text-slate-500">No pending events.</td></tr>) : events.map(e => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-bold text-brand-maroon text-sm">{e.event_title}</div>
                    <div className="text-[10px] text-slate-500 mt-1 font-semibold">{e.requester?.full_name} • {e.requester?.department}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 text-slate-800 font-bold"><Clock className="w-3 h-3 text-slate-400"/> {new Date(e.event_date).toLocaleDateString()}</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">{e.timing_type} ({e.time_slot})</div>
                    <div className="flex items-center gap-1 text-slate-700 mt-1 text-[10px]"><MapPin className="w-3 h-3 text-slate-400"/> {e.location}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-700">{e.darajah}</div>
                    <div className="text-[10px] text-slate-500 font-medium">Total Pax: <span className="font-bold text-brand-maroon">{e.total_count}</span></div>
                  </td>
                  <td className="p-3 max-w-[200px]">
                    {e.requirements && e.requirements.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {e.requirements.map((req: any, idx: number) => (
                          <span key={idx} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${req.department === 'AVIT' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'}`}>
                            {req.item_name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[10px]">No assets requested</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => approveEvent(e.id, e.event_title)} disabled={processingId === e.id} className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-sm flex items-center disabled:opacity-50">
                        <CheckCircle className="w-3 h-3 mr-1"/> Confirm
                      </button>
                      <button onClick={() => rejectEvent(e.id)} disabled={processingId === e.id} className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[11px] shadow-sm flex items-center disabled:opacity-50">
                        <XCircle className="w-3 h-3 mr-1"/> Decline
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- TAB 2: FLEET LOGISTICS --- */}
      {activeTab === 'fleet' && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="p-3">Destination & Purpose</th>
                <th className="p-3">Requester & Date</th>
                <th className="p-3">Pax Count</th>
                <th className="p-3">Required Timings</th>
                <th className="p-3 text-right">Fleet Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (<tr><td colSpan={5} className="p-4 text-center">Loading...</td></tr>) : vehicles.length === 0 ? (<tr><td colSpan={5} className="p-4 text-center font-medium italic text-slate-500">No pending vehicle requests.</td></tr>) : vehicles.map(v => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-bold text-brand-maroon text-sm flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {v.destination}</div>
                    <div className="text-[10px] text-slate-600 mt-1 line-clamp-1">{v.purpose}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-800">{new Date(v.request_date).toLocaleDateString()}</div>
                    <div className="text-[10px] text-slate-500">{v.requester?.full_name} • {v.requester?.department}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-700">{v.darajah}</div>
                    <div className="text-[10px] text-slate-500 font-medium">Passengers: <span className="font-bold text-brand-maroon">{v.total_count}</span></div>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-emerald-700">Reach By: {v.arrival_time}</div>
                    {v.release_time && <div className="text-[10px] text-slate-500 mt-0.5">Release: {v.release_time}</div>}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => { setSelectedReq(v); setFleetModalOpen(true); }} className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] shadow-sm flex items-center gap-1">
                        <Car className="w-3 h-3" /> Assign Fleet
                      </button>
                      <button onClick={() => rejectVehicle(v.id)} disabled={processingId === v.id} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition disabled:opacity-50">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- FLEET ASSIGNMENT MODAL --- */}
      {fleetModalOpen && selectedReq && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-brand-maroon p-4 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase">Dispatch Fleet & Shuttles</h3>
              <button onClick={() => setFleetModalOpen(false)}><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            <form onSubmit={handleFleetDispatch} className="p-5 space-y-4">
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-4 text-xs text-amber-900">
                <span className="font-bold">Objective:</span> Transport <strong>{selectedReq.total_count} pax</strong> to <strong>{selectedReq.destination}</strong> by <strong>{selectedReq.arrival_time}</strong>.
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Assign Vehicles (Internal/Rental) *</label>
                <input 
                  required type="text" value={assignedVehicles} onChange={e => setAssignedVehicles(e.target.value)} 
                  placeholder="e.g. 2x Magic Vans (2 rounds each), 1x Bus" 
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-maroon"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Calculated Departure Time *</label>
                <input 
                  required type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} 
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-maroon"
                />
                <p className="text-[10px] text-slate-500 mt-1">Based on transit time, when should they leave?</p>
              </div>

              <button type="submit" disabled={processingId === selectedReq.id} className="w-full py-3 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> Dispatch Logistics & Notify
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}