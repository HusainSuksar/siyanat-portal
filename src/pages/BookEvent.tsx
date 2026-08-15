import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Users, MonitorSpeaker, Send, Clock, PackageSearch, PlusCircle, Trash2, Edit, XCircle, ShieldAlert, ListPlus } from 'lucide-react';

const PERIODS = [
  { id: 'P1', time: '08:00 AM - 08:35 AM' },
  { id: 'P2', time: '08:35 AM - 09:10 AM' },
  { id: 'P3', time: '09:10 AM - 09:45 AM' },
  { id: 'P4', time: '09:45 AM - 10:20 AM' },
  { id: 'BREAK_1', time: '10:35 AM - 10:55 AM (Short Break)', isBreak: true },
  { id: 'P5', time: '10:55 AM - 11:30 AM' },
  { id: 'P6', time: '11:30 AM - 12:05 PM' },
  { id: 'P7', time: '12:05 PM - 12:40 PM' },
  { id: 'BREAK_2', time: '12:40 PM - 02:00 PM (Namaz & Lunch)', isBreak: true },
  { id: 'P8', time: '02:00 PM - 02:35 PM' },
  { id: 'P9', time: '02:35 PM - 03:10 PM' },
  { id: 'P10', time: '03:10 PM - 03:45 PM' }
];
const PRESET_CLASSES: Record<string, { male: number, female: number }> = {
  "1AM": { male: 11, female: 10 },
  "2AF": { male: 10, female: 12 },
  "3AM": { male: 15, female: 14 },
  "4AF": { male: 12, female: 12 },
  "5AM": { male: 14, female: 10 },
  "6AF": { male: 9, female: 11 },
  "7AM": { male: 13, female: 13 },
  "8AF": { male: 11, female: 15 },
  "9AM": { male: 12, female: 10 },
  "10AF": { male: 10, female: 10 },
  "11AM": { male: 15, female: 12 },
  "Random": { male: 0, female: 0 },
  "Faculty / Staff": { male: 0, female: 0 }
};

export default function BookEvent() {
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Admin God Mode States
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  
  // Standard Assets Management States
  const [standardAssets, setStandardAssets] = useState<any[]>([]);
  const [newAssetDept, setNewAssetDept] = useState('AVIT');
  const [newAssetName, setNewAssetName] = useState('');

  // Form Details
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [timingType, setTimingType] = useState('After Classes');
  const [timeSlot, setTimeSlot] = useState('');
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [subLocation, setSubLocation] = useState('');
  
  // Headcount
  const [darajah, setDarajah] = useState('1');
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);
  const [othersCount, setOthersCount] = useState(0);

  // Dynamic Assets & Inventory
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assetQty, setAssetQty] = useState(1);
  const [requirements, setRequirements] = useState<{dept: string, item: string, qty?: number}[]>([]);

  const totalCount = maleCount + femaleCount + othersCount;

  useEffect(() => {
    fetchInitialData();
  }, []);
  const handleDarajahChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setDarajah(val);
    if (PRESET_CLASSES[val]) {
      setMaleCount(PRESET_CLASSES[val].male);
      setFemaleCount(PRESET_CLASSES[val].female);
    }
  };

  const fetchInitialData = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      setCurrentUser(authData.user);
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();
      
      const adminCheck = profile?.role === 'ADMIN';
      setIsAdmin(adminCheck);

      if (adminCheck) fetchAllEvents();
    }

    // Fetch Inventory for Dynamic Asset Checker
    const { data: invData } = await supabase.from('inventory_items').select('*').order('name');
    if (invData) setInventory(invData);

    // Fetch Standard Checklists
    fetchStandardAssets();
  };

  const fetchStandardAssets = async () => {
    const { data } = await supabase.from('standard_event_assets').select('*').eq('is_active', true).order('department');
    if (data) setStandardAssets(data);
  };

  const fetchAllEvents = async () => {
    const { data } = await supabase.from('events').select('*, requester:profiles(full_name)').order('event_date', { ascending: false });
    if (data) setAllEvents(data);
  };

  const togglePeriod = (periodId: string) => {
    setSelectedPeriods(prev => prev.includes(periodId) ? prev.filter(p => p !== periodId) : [...prev, periodId].sort());
  };

  const toggleStandardRequirement = (dept: string, item: string) => {
    setRequirements(prev => {
      const exists = prev.find(r => r.item === item);
      if (exists) return prev.filter(r => r.item !== item);
      return [...prev, { dept, item, qty: 1 }];
    });
  };

  const addDynamicAsset = () => {
    if (!selectedAssetId) return;
    const item = inventory.find(i => i.id === selectedAssetId);
    if (!item) return;

    const available = item.physical_stock - item.freezed_stock;
    if (assetQty > available) return alert(`Only ${available} ${item.unit} available in stock!`);

    setRequirements(prev => [...prev, { dept: 'Inventory Catalog', item: item.name, qty: assetQty }]);
    setSelectedAssetId('');
    setAssetQty(1);
  };

  const removeRequirement = (index: number) => {
    setRequirements(prev => prev.filter((_, i) => i !== index));
  };

  // --- SUBMIT / UPDATE LOGIC ---
  const submitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalCount === 0) return alert("Total headcount cannot be zero.");
    
    let finalTimeSlot = timeSlot;
    if (timingType === 'Between Classes') {
      if (selectedPeriods.length === 0) return alert("Please select at least one timetable period.");
      finalTimeSlot = selectedPeriods.map(pId => {
        const p = PERIODS.find(x => x.id === pId);
        return `${p?.id} (${p?.time})`;
      }).join(' | ');
    } else {
      if (!timeSlot) return alert("Please enter the specific time slot.");
    }

    setLoading(true);

    try {
      const payload = {
        requester_id: currentUser.id,
        event_title: title,
        event_date: date,
        timing_type: timingType,
        time_slot: finalTimeSlot,
        location,
        sub_location: subLocation,
        darajah,
        male_count: maleCount,
        female_count: femaleCount,
        others_count: othersCount,
        total_count: totalCount
      };

      let eventId = editingEventId;

      if (editingEventId) {
        // UPDATE (God Mode)
        await supabase.from('events').update(payload).eq('id', editingEventId);
        await supabase.from('event_requirements').delete().eq('event_id', editingEventId); // Wipe old requirements
      } else {
        // INSERT
        const { data: eventData, error: eventError } = await supabase.from('events').insert(payload).select().single();
        if (eventError) throw eventError;
        eventId = eventData.id;
      }

      // Insert Requirements
      if (requirements.length > 0 && eventId) {
        const reqPayload = requirements.map(req => ({ event_id: eventId, department: req.dept, item_name: req.item, quantity: req.qty || 1 }));
        await supabase.from('event_requirements').insert(reqPayload);
      }

      await supabase.from('system_logs').insert({
        action_type: editingEventId ? 'EVENT_UPDATED' : 'EVENT_REQUESTED',
        description: `${editingEventId ? 'Admin updated' : 'Requested'} venue booking for ${title} on ${date}.`,
        user_email: currentUser.email
      });

      alert(`Event Booking ${editingEventId ? 'Updated' : 'Submitted'} Successfully!`);
      resetForm();
      if (isAdmin) fetchAllEvents();

    } catch (err: any) {
      alert("Error processing event: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingEventId(null);
    setTitle(''); setDate(''); setLocation(''); setSubLocation('');
    setTimingType('After Classes'); setTimeSlot(''); setSelectedPeriods([]);
    setMaleCount(0); setFemaleCount(0); setOthersCount(0); setRequirements([]);
  };

  // --- GOD MODE ACTIONS: EVENTS ---
  const editEvent = async (event: any) => {
    setEditingEventId(event.id);
    setTitle(event.event_title);
    setDate(event.event_date);
    setTimingType(event.timing_type);
    setLocation(event.location);
    setSubLocation(event.sub_location || '');
    setDarajah(event.darajah);
    setMaleCount(event.male_count);
    setFemaleCount(event.female_count);
    setOthersCount(event.others_count || 0);

    if (event.timing_type === 'Between Classes') {
      // Very basic extraction of Period IDs from the string for editing
      const matchedPeriods = PERIODS.filter(p => event.time_slot.includes(p.id)).map(p => p.id);
      setSelectedPeriods(matchedPeriods);
      setTimeSlot('');
    } else {
      setTimeSlot(event.time_slot);
      setSelectedPeriods([]);
    }

    // Fetch existing requirements
    const { data: reqs } = await supabase.from('event_requirements').select('*').eq('event_id', event.id);
    if (reqs) {
      setRequirements(reqs.map(r => ({ dept: r.department, item: r.item_name, qty: r.quantity })));
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteEvent = async (id: string, name: string) => {
    if (!confirm(`GOD MODE: Eradicate event "${name}" permanently?`)) return;
    await supabase.from('events').delete().eq('id', id);
    await supabase.from('system_logs').insert({ action_type: 'GOD_MODE_DELETE', description: `Admin deleted event: ${name}`, user_email: currentUser?.email });
    fetchAllEvents();
  };

  // --- GOD MODE ACTIONS: STANDARD ASSETS ---
  const addStandardAsset = async () => {
    if (!newAssetName.trim()) return;
    const { error } = await supabase.from('standard_event_assets').insert({ department: newAssetDept, item_name: newAssetName });
    if (!error) {
      setNewAssetName('');
      fetchStandardAssets();
    } else {
      alert("Error adding asset to checklist.");
    }
  };

  const deleteStandardAsset = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from the standard checklists?`)) return;
    await supabase.from('standard_event_assets').update({ is_active: false }).eq('id', id);
    fetchStandardAssets();
  };

  // Separate standard assets by department for rendering
  const avitAssets = standardAssets.filter(a => a.department === 'AVIT');
  const supportAssets = standardAssets.filter(a => a.department === 'Support');

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-xl shadow-md ${editingEventId ? 'bg-amber-500 text-white' : 'bg-brand-maroon text-brand-gold'}`}>
          {editingEventId ? <Edit className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">{editingEventId ? `Editing Event: ${title}` : 'Book Venue & Event'}</h2>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {editingEventId ? 'God Mode: Modifying existing database record.' : 'Request facilities, AVIT support, and schedule events.'}
          </p>
        </div>
        {editingEventId && (
          <button onClick={resetForm} className="ml-auto flex items-center gap-1 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg transition">
            <XCircle className="w-4 h-4" /> Cancel Edit
          </button>
        )}
      </div>

      <form onSubmit={submitEvent} className="space-y-6">
        
        {/* SECTION 1: SCHEDULING & LOCATION */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
            <Clock className="w-5 h-5 text-brand-maroon" />
            <h3 className="font-extrabold text-sm uppercase text-slate-800">Scheduling & Location</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Event Title *</label>
              <input required type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Annual Department Seminar" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>
            
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Event Date *</label>
              <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Primary Venue *</label>
              <select required value={location} onChange={e => setLocation(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none">
                <option value="" disabled>Select Venue</option>
                <option>Main Auditorium</option>
                <option>Conference Hall A</option>
                <option>Sports Complex</option>
                <option>Library Seminar Room</option>
              </select>
            </div>

            <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-3">Event Timing Category *</label>
              <div className="flex gap-4 mb-4">
                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${timingType === 'Between Classes' ? 'border-brand-maroon bg-brand-maroon/5 text-brand-maroon' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="timing" value="Between Classes" checked={timingType === 'Between Classes'} onChange={() => setTimingType('Between Classes')} className="hidden" />
                  <span className="font-bold text-sm">Between Classes (Timetable)</span>
                </label>
                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${timingType === 'After Classes' ? 'border-brand-maroon bg-brand-maroon/5 text-brand-maroon' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="timing" value="After Classes" checked={timingType === 'After Classes'} onChange={() => setTimingType('After Classes')} className="hidden" />
                  <span className="font-bold text-sm">After Classes (Custom Time)</span>
                </label>
              </div>

              {/* DYNAMIC TIMETABLE RENDERER */}
              {timingType === 'Between Classes' ? (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase mb-3">Select Timetable Periods (35 Mins Each)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {PERIODS.map((p, idx) => {
                      if (p.isBreak) {
                        return <div key={idx} className="col-span-full py-1 text-center text-[10px] font-black uppercase text-amber-600 tracking-widest my-1">{p.time}</div>;
                      }
                      return (
                        <label key={p.id} className={`flex flex-col p-2 rounded-lg border-2 cursor-pointer transition ${selectedPeriods.includes(p.id) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                          <input type="checkbox" checked={selectedPeriods.includes(p.id)} onChange={() => togglePeriod(p.id)} className="hidden" />
                          <span className={`text-xs font-black ${selectedPeriods.includes(p.id) ? 'text-indigo-800' : 'text-slate-700'}`}>{p.id}</span>
                          <span className="text-[10px] font-medium text-slate-500">{p.time}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Custom Time Slot *</label>
                  <input required={timingType === 'After Classes'} type="text" value={timeSlot} onChange={e => setTimeSlot(e.target.value)} placeholder="e.g. 4:00 PM - 6:00 PM" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
                </div>
              )}
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Sub-Location (Optional)</label>
              <input type="text" value={subLocation} onChange={e => setSubLocation(e.target.value)} placeholder="e.g. Balcony Seating" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>
          </div>
        </div>

        {/* SECTION 2: HEADCOUNT */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
            <Users className="w-5 h-5 text-brand-maroon" />
            <h3 className="font-extrabold text-sm uppercase text-slate-800">Darajah & Headcount Summary</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Darajah / Class</label>
              <select 
                value={darajah} 
                onChange={handleDarajahChange} 
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none"
              >
                <option value="" disabled>Select Class</option>
                {Object.keys(PRESET_CLASSES).map(className => (
                  <option key={className} value={className}>{className}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Male Count</label>
              <input type="number" min="0" value={maleCount} onChange={e => setMaleCount(parseInt(e.target.value) || 0)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>
            
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Female Count</label>
              <input type="number" min="0" value={femaleCount} onChange={e => setFemaleCount(parseInt(e.target.value) || 0)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Others / Guests</label>
              <input type="number" min="0" value={othersCount} onChange={e => setOthersCount(parseInt(e.target.value) || 0)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>
          </div>
          
          {/* DYNAMIC READ-ONLY SUMMARY CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
             <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
               <div className="text-[10px] font-extrabold uppercase text-slate-500">Total Males</div>
               <div className="text-xl font-black text-slate-800">{maleCount}</div>
             </div>
             <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
               <div className="text-[10px] font-extrabold uppercase text-slate-500">Total Females</div>
               <div className="text-xl font-black text-slate-800">{femaleCount}</div>
             </div>
             <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
               <div className="text-[10px] font-extrabold uppercase text-slate-500">Total Guests</div>
               <div className="text-xl font-black text-slate-800">{othersCount}</div>
             </div>
             <div className="bg-brand-maroon p-3 rounded-xl text-center shadow-md">
               <div className="text-[10px] font-extrabold uppercase text-brand-gold">Grand Total Capacity</div>
               <div className="text-xl font-black text-white">{totalCount}</div>
             </div>
          </div>
        </div>

        {/* SECTION 3: ASSETS & REQUIREMENTS */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
            <MonitorSpeaker className="w-5 h-5 text-brand-maroon" />
            <h3 className="font-extrabold text-sm uppercase text-slate-800">Assets & Event Requirements</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2">Standard AVIT Checklist</h4>
              <div className="space-y-2">
                {avitAssets.map(asset => (
                  <label key={asset.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer border border-transparent hover:border-slate-200 transition">
                    <input type="checkbox" checked={requirements.some(r => r.item === asset.item_name)} onChange={() => toggleStandardRequirement('AVIT', asset.item_name)} className="w-4 h-4 text-brand-maroon rounded focus:ring-brand-maroon" />
                    <span className="text-xs font-bold text-slate-700">{asset.item_name}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2">Standard Siyanat Support</h4>
              <div className="space-y-2">
                {supportAssets.map(asset => (
                  <label key={asset.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer border border-transparent hover:border-slate-200 transition">
                    <input type="checkbox" checked={requirements.some(r => r.item === asset.item_name)} onChange={() => toggleStandardRequirement('Support', asset.item_name)} className="w-4 h-4 text-brand-maroon rounded focus:ring-brand-maroon" />
                    <span className="text-xs font-bold text-slate-700">{asset.item_name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* DYNAMIC ASSETS (STOCK CHECKER) */}
          <div className="border-t border-slate-100 pt-5">
             <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-1"><PackageSearch className="w-3.5 h-3.5"/> Request Additional Inventory Assets</h4>
             
             <div className="flex flex-col sm:flex-row gap-2 items-end">
               <div className="flex-1">
                 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select from Catalog</label>
                 <select value={selectedAssetId} onChange={e => setSelectedAssetId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon">
                   <option value="">-- Choose Item --</option>
                   {inventory.map(item => (
                     <option key={item.id} value={item.id} disabled={(item.physical_stock - item.freezed_stock) <= 0}>
                       {item.name} (Avail: {item.physical_stock - item.freezed_stock})
                     </option>
                   ))}
                 </select>
               </div>
               <div>
                 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qty</label>
                 <input type="number" min="1" value={assetQty} onChange={e => setAssetQty(parseInt(e.target.value) || 1)} className="w-20 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-brand-maroon" />
               </div>
               <button type="button" onClick={addDynamicAsset} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-1 h-9">
                 <PlusCircle className="w-4 h-4" /> Add
               </button>
             </div>

             {/* Asset List Render */}
             {requirements.length > 0 && (
               <div className="mt-4 space-y-2">
                 {requirements.map((req, idx) => (
                   <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                     <div>
                       <div className="text-xs font-bold text-slate-800">{req.item}</div>
                       <div className="text-[9px] text-slate-500 uppercase">{req.dept}</div>
                     </div>
                     <div className="flex items-center gap-4">
                       {req.qty && <span className="text-xs font-black text-brand-maroon">Qty: {req.qty}</span>}
                       <button type="button" onClick={() => removeRequirement(idx)} className="text-slate-400 hover:text-red-500 transition"><Trash2 className="w-4 h-4" /></button>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className={`w-full py-4 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl transition flex justify-center items-center space-x-2 disabled:opacity-70 ${editingEventId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {loading ? <span>Processing...</span> : <><Send className="w-5 h-5" /><span>{editingEventId ? 'Update Event Record' : 'Submit Event Booking'}</span></>}
        </button>
      </form>

      {/* --- ADMIN GOD MODE: EVENT & CHECKLIST MANAGEMENT --- */}
      {isAdmin && (
        <div className="mt-12 pt-8 border-t-4 border-slate-200 space-y-8">
          
          {/* Manage Standard Checklists */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ListPlus className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">Manage Standard Event Checklists</h3>
            </div>
            
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6">
               <div className="flex-1 space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase border-b pb-2">Active Checklist Items</h4>
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {standardAssets.map(asset => (
                      <li key={asset.id} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100">
                        <span><span className="font-bold text-slate-800">{asset.item_name}</span> <span className="text-[9px] text-slate-500 ml-1">({asset.department})</span></span>
                        <button onClick={() => deleteStandardAsset(asset.id, asset.item_name)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </li>
                    ))}
                  </ul>
               </div>
               <div className="w-full md:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200">
                 <h4 className="text-xs font-bold text-slate-700 mb-3">Add New Checklist Item</h4>
                 <div className="space-y-3">
                   <select value={newAssetDept} onChange={e => setNewAssetDept(e.target.value)} className="w-full p-2 text-xs border border-slate-300 rounded outline-none focus:ring-2 focus:ring-brand-maroon">
                     <option value="AVIT">AVIT Department</option>
                     <option value="Support">Siyanat / Tanzeem Support</option>
                   </select>
                   <input type="text" value={newAssetName} onChange={e => setNewAssetName(e.target.value)} placeholder="e.g. Laser Pointer" className="w-full p-2 text-xs border border-slate-300 rounded outline-none focus:ring-2 focus:ring-brand-maroon" />
                   <button onClick={addStandardAsset} className="w-full py-2 bg-indigo-600 text-white font-bold text-xs rounded hover:bg-indigo-700 transition">Add Item</button>
                 </div>
               </div>
            </div>
          </div>

          {/* Manage All Events */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">Admin Override: Manage All Events</h3>
            </div>
            
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                  <tr>
                    <th className="p-3">Event Title & Requester</th>
                    <th className="p-3">Schedule & Timetable</th>
                    <th className="p-3">Location & Pax</th>
                    <th className="p-3 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {allEvents.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50 transition">
                      <td className="p-3">
                        <div className="font-bold text-brand-maroon">{e.event_title}</div>
                        <div className="text-[10px] text-slate-500">{e.requester?.full_name}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{new Date(e.event_date).toLocaleDateString()}</div>
                        <div className="text-[10px] font-medium text-slate-500 mt-0.5 max-w-[200px] truncate" title={e.time_slot}>{e.time_slot}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-700">{e.location}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Total Pax: <span className="font-bold text-brand-maroon">{e.total_count}</span></div>
                      </td>
                      <td className="p-3 text-right">
                         <div className="flex items-center justify-end gap-2">
                           <button onClick={() => editEvent(e)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition" title="Edit Event"><Edit className="w-4 h-4" /></button>
                           <button onClick={() => deleteEvent(e.id, e.event_title)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition" title="Eradicate Event"><Trash2 className="w-4 h-4" /></button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}