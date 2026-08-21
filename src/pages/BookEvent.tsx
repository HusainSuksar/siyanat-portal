import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Users, MonitorSpeaker, Send, Clock, PackageSearch, PlusCircle, Trash2, Edit, XCircle, ShieldAlert, ListPlus, MapPin, Lock, Car } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EVENT_VENUES, EVENT_ZONES } from '../constants/locations';

const BETWEEN_CLASS_PERIODS = [
  { id: 'P1', time: '08:15 - 09:00' },
  { id: 'P2', time: '09:01 - 09:35' },
  { id: 'P3', time: '09:36 - 10:10' },
  { id: 'P4', time: '10:11 - 10:45' },
  { id: 'P5', time: '10:46 - 11:35' },
  { id: 'P6', time: '11:36 - 12:10' },
  { id: 'P7', time: '12:11 - 12:45' },
  { id: 'P8', time: '12:46 - 13:20' },
  { id: 'P9', time: '14:20 - 15:00' },
  { id: 'P10', time: '15:01 - 15:45' }
];

const AFTER_CLASS_SLOTS = [
  '15:46 - 16:30', '16:31 - 17:00', '17:01 - 17:30', '17:31 - 18:00',
  '18:01 - 18:30', '18:31 - 19:00', '19:01 - 19:30', '19:31 - 20:00',
  '20:31 - 21:00', '21:01 - 21:30', '21:31 - 22:00', '22:01 - 22:30'
];

const PRESET_CLASSES: Record<string, { male: number, female: number }> = {
  "1AM": { male: 25, female: 0 }, "1AF": { male: 0, female: 20 },
  "1BF": { male: 0, female: 19 }, "1BM": { male: 25, female: 0 },
  "1CF": { male: 0, female: 19 }, "1CM": { male: 23, female: 0 },
  "1DF": { male: 0, female: 19 }, "1DM": { male: 24, female: 0 },
  "6AF": { male: 0, female: 23 }, "6AM": { male: 26, female: 0 },
  "Random": { male: 0, female: 0 }, "Faculty / Staff": { male: 0, female: 0 }
};

export default function BookEvent() {
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('REQUESTER');
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  
  const [standardAssets, setStandardAssets] = useState<any[]>([]);
  const [newAssetDept, setNewAssetDept] = useState('AVIT_HEAD');
  const [newAssetName, setNewAssetName] = useState('');

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [timingType, setTimingType] = useState('Between Classes');
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [selectedAfterClass, setSelectedAfterClass] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [subLocation, setSubLocation] = useState('');
  
  const [darajah, setDarajah] = useState('');
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);
  const [othersCount, setOthersCount] = useState(0);

  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assetQty, setAssetQty] = useState(1);
  const [requirements, setRequirements] = useState<{dept: string, item: string, qty?: number}[]>([]);

  const totalCount = maleCount + femaleCount + othersCount;
  const isStandardUser = userRole === 'REQUESTER';

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

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocation(e.target.value);
    setSubLocation('');
  };

  const fetchInitialData = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      setCurrentUser(authData.user);
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();
      
      const role = profile?.role || 'REQUESTER';
      setUserRole(role);
      
      const adminCheck = role === 'SUPER_ADMIN';
      setIsAdmin(adminCheck);

      if (adminCheck) fetchAllEvents();
      
      if (role === 'REQUESTER') setTimingType('Between Classes');
    }

    const { data: invData } = await supabase.from('inventory_items').select('*').order('name');
    if (invData) setInventory(invData);

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
    setSelectedPeriods(prev => prev.includes(periodId) ? prev.filter(p => p !== periodId) : [...prev, periodId].sort((a, b) => parseInt(a.substring(1)) - parseInt(b.substring(1))));
  };

  const toggleAfterClassSlot = (slot: string) => {
    setSelectedAfterClass(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]);
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

    setRequirements(prev => [...prev, { dept: item.fulfillment_dept || 'SIYANAT_HEAD', item: item.name, qty: assetQty }]);
    setSelectedAssetId('');
    setAssetQty(1);
  };

  const removeRequirement = (index: number) => {
    setRequirements(prev => prev.filter((_, i) => i !== index));
  };

  const submitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalCount === 0) return alert("Total headcount cannot be zero.");
    
    let finalTimeSlot = '';
    if (timingType === 'Between Classes') {
      if (selectedPeriods.length === 0) return alert("Please select at least one timetable period.");
      finalTimeSlot = selectedPeriods.map(pId => {
        const p = BETWEEN_CLASS_PERIODS.find(x => x.id === pId);
        return `${p?.id} (${p?.time})`;
      }).join(' | ');
    } else {
      if (selectedAfterClass.length === 0) return alert("Please select at least one after-class time slot.");
      finalTimeSlot = selectedAfterClass.join(' | ');
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
        await supabase.from('events').update(payload).eq('id', editingEventId);
        await supabase.from('event_requirements').delete().eq('event_id', editingEventId);
      } else {
        const { data: eventData, error: eventError } = await supabase.from('events').insert(payload).select().single();
        if (eventError) throw eventError;
        eventId = eventData.id;
      }

      if (requirements.length > 0 && eventId) {
        const reqPayload = requirements.map(req => ({ event_id: eventId, department: req.dept, item_name: req.item, quantity: req.qty || 1 }));
        await supabase.from('event_requirements').insert(reqPayload);
      }

      await supabase.from('system_logs').insert({
        action_type: editingEventId ? 'EVENT_UPDATED' : 'EVENT_REQUESTED',
        description: `${editingEventId ? 'Admin updated' : 'Requested'} venue booking for ${title}. Routed to Tanzeem.`,
        user_email: currentUser.email
      });

      alert(`Event Booking ${editingEventId ? 'Updated' : 'Submitted'}! Routed to Tanzeem Operations.`);
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
    setTimingType('Between Classes'); 
    setSelectedPeriods([]); setSelectedAfterClass([]);
    setDarajah(''); setMaleCount(0); setFemaleCount(0); setOthersCount(0); setRequirements([]);
  };

  const editEvent = async (event: any) => {
    setEditingEventId(event.id);
    setTitle(event.event_title);
    setDate(event.event_date);
    setTimingType(event.timing_type);
    setLocation(event.location);
    setSubLocation(event.sub_location || '');
    setDarajah(event.darajah || '');
    setMaleCount(event.male_count);
    setFemaleCount(event.female_count);
    setOthersCount(event.others_count || 0);

    if (event.timing_type === 'Between Classes') {
      const matchedPeriods = BETWEEN_CLASS_PERIODS.filter(p => event.time_slot.includes(p.id)).map(p => p.id);
      setSelectedPeriods(matchedPeriods);
      setSelectedAfterClass([]);
    } else {
      const matchedSlots = AFTER_CLASS_SLOTS.filter(s => event.time_slot.includes(s));
      setSelectedAfterClass(matchedSlots);
      setSelectedPeriods([]);
    }

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

  const avitAssets = standardAssets.filter(a => a.department === 'AVIT_HEAD');
  const supportAssets = standardAssets.filter(a => a.department === 'SIYANAT_HEAD' || a.department === 'TANZEEM_HEAD');

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
        
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
            <Clock className="w-5 h-5 text-brand-maroon" />
            <h3 className="font-extrabold text-sm uppercase text-slate-800">Scheduling & Location</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Event Title *</label>
              <input required type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Annual Department Seminar" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Event Date *</label>
              <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Primary Venue *</label>
              <select required value={location} onChange={handleLocationChange} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none">
                <option value="" disabled>Select Primary Venue</option>
                {EVENT_ZONES.map(venue => (
                  <option key={venue} value={venue}>{venue}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Sub-Location *</label>
              <select required disabled={!location} value={subLocation} onChange={e => setSubLocation(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none disabled:opacity-50">
                <option value="" disabled>{location ? 'Select Sub-Location' : 'Select Primary Venue First'}</option>
                {location && EVENT_VENUES[location].map(subLoc => (
                  <option key={subLoc} value={subLoc}>{subLoc}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-3">Event Timing Category *</label>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${timingType === 'Between Classes' ? 'border-brand-maroon bg-brand-maroon/5 text-brand-maroon' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="timing" value="Between Classes" checked={timingType === 'Between Classes'} onChange={() => setTimingType('Between Classes')} className="hidden" />
                  <span className="font-bold text-sm">Between Classes (Timetable)</span>
                </label>
                
                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition ${isStandardUser ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200' : timingType === 'After Classes' ? 'border-brand-maroon bg-brand-maroon/5 text-brand-maroon cursor-pointer' : 'border-slate-200 hover:border-slate-300 cursor-pointer'}`} title={isStandardUser ? "Only Department Heads can book events outside standard timetable hours." : ""}>
                  <input type="radio" name="timing" value="After Classes" disabled={isStandardUser} checked={timingType === 'After Classes'} onChange={() => !isStandardUser && setTimingType('After Classes')} className="hidden" />
                  <span className={`font-bold text-sm ${isStandardUser ? 'text-slate-400' : ''}`}>After Classes (Custom Time)</span>
                  {isStandardUser && <Lock className="w-4 h-4 text-slate-400" />}
                </label>
              </div>

              {timingType === 'Between Classes' ? (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase mb-3">Select Timetable Periods</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {BETWEEN_CLASS_PERIODS.map((p) => {
                      return (
                        <label key={p.id} className={`flex flex-col p-2 rounded-lg border-2 cursor-pointer transition ${selectedPeriods.includes(p.id) ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                          <input type="checkbox" checked={selectedPeriods.includes(p.id)} onChange={() => togglePeriod(p.id)} className="hidden" />
                          <span className={`text-[11px] font-black ${selectedPeriods.includes(p.id) ? 'text-indigo-800' : 'text-slate-700'}`}>{p.id}</span>
                          <span className="text-[9px] font-bold text-slate-500 tracking-tight mt-0.5">{p.time}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase mb-3">Select After-Class Slots</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {AFTER_CLASS_SLOTS.map((slot) => {
                      return (
                        <label key={slot} className={`flex flex-col p-2.5 rounded-lg border-2 cursor-pointer transition ${selectedAfterClass.includes(slot) ? 'border-brand-maroon bg-brand-maroon/10 shadow-sm' : 'border-slate-200 bg-white hover:border-brand-maroon/50'}`}>
                          <input type="checkbox" checked={selectedAfterClass.includes(slot)} onChange={() => toggleAfterClassSlot(slot)} className="hidden" />
                          <span className={`text-[11px] font-black text-center ${selectedAfterClass.includes(slot) ? 'text-brand-maroon' : 'text-slate-700'}`}>{slot}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
            <Users className="w-5 h-5 text-brand-maroon" />
            <h3 className="font-extrabold text-sm uppercase text-slate-800">Darajah & Headcount Summary</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
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
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
             <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center shadow-sm">
               <div className="text-[10px] font-extrabold uppercase text-slate-500">Total Males</div>
               <div className="text-xl font-black text-slate-800">{maleCount}</div>
             </div>
             <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center shadow-sm">
               <div className="text-[10px] font-extrabold uppercase text-slate-500">Total Females</div>
               <div className="text-xl font-black text-slate-800">{femaleCount}</div>
             </div>
             <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center shadow-sm">
               <div className="text-[10px] font-extrabold uppercase text-slate-500">Total Guests</div>
               <div className="text-xl font-black text-slate-800">{othersCount}</div>
             </div>
             <div className="bg-brand-maroon p-3 rounded-xl text-center shadow-md">
               <div className="text-[10px] font-extrabold uppercase text-brand-gold">Grand Total Capacity</div>
               <div className="text-xl font-black text-white">{totalCount}</div>
             </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
            <MonitorSpeaker className="w-5 h-5 text-brand-maroon" />
            <h3 className="font-extrabold text-sm uppercase text-slate-800">Assets & Event Requirements</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3">Standard AVIT Checklist</h4>
              <div className="space-y-2">
                {avitAssets.map(asset => (
                  <label key={asset.id} className="flex items-center space-x-2 p-2 bg-white rounded-lg cursor-pointer border border-slate-200 hover:border-slate-300 transition shadow-sm">
                    <input type="checkbox" checked={requirements.some(r => r.item === asset.item_name)} onChange={() => toggleStandardRequirement('AVIT_HEAD', asset.item_name)} className="w-4 h-4 text-brand-maroon rounded focus:ring-brand-maroon" />
                    <span className="text-xs font-bold text-slate-700">{asset.item_name}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3">Standard Siyanat Support</h4>
              <div className="space-y-2">
                {supportAssets.map(asset => (
                  <label key={asset.id} className="flex items-center space-x-2 p-2 bg-white rounded-lg cursor-pointer border border-slate-200 hover:border-slate-300 transition shadow-sm">
                    <input type="checkbox" checked={requirements.some(r => r.item === asset.item_name)} onChange={() => toggleStandardRequirement('SIYANAT_HEAD', asset.item_name)} className="w-4 h-4 text-brand-maroon rounded focus:ring-brand-maroon" />
                    <span className="text-xs font-bold text-slate-700">{asset.item_name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
             <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-1"><PackageSearch className="w-3.5 h-3.5"/> Request Additional Inventory Assets</h4>
             
             <div className="flex flex-col sm:flex-row gap-3 items-end">
               <div className="flex-1 w-full">
                 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select from Catalog</label>
                 <select value={selectedAssetId} onChange={e => setSelectedAssetId(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon">
                   <option value="">-- Choose Item --</option>
                   {inventory.map(item => (
                     <option key={item.id} value={item.id} disabled={(item.physical_stock - item.freezed_stock) <= 0}>
                       {item.name} (Avail: {item.physical_stock - item.freezed_stock})
                     </option>
                   ))}
                 </select>
               </div>
               <div className="w-full sm:w-24">
                 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qty</label>
                 <input type="number" min="1" value={assetQty} onChange={e => setAssetQty(parseInt(e.target.value) || 1)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-brand-maroon" />
               </div>
               <button type="button" onClick={addDynamicAsset} className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg shadow-sm transition flex justify-center items-center gap-1">
                 <PlusCircle className="w-4 h-4" /> Add Item
               </button>
             </div>

             {requirements.length > 0 && (
               <div className="mt-4 space-y-2">
                 {requirements.map((req, idx) => (
                   <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm">
                     <div>
                       <div className="text-xs font-bold text-slate-800">{req.item}</div>
                       <div className="text-[9px] text-slate-500 uppercase font-black tracking-wide mt-0.5">{req.dept}</div>
                     </div>
                     <div className="flex items-center gap-4">
                       {req.qty && <span className="text-xs font-black text-brand-maroon bg-white px-2 py-1 rounded border border-slate-200">Qty: {req.qty}</span>}
                       <button type="button" onClick={() => removeRequirement(idx)} className="text-slate-400 hover:text-red-500 transition bg-white p-1.5 rounded-md border border-slate-200"><Trash2 className="w-4 h-4" /></button>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>

        {userRole !== 'REQUESTER' && (
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 flex items-start gap-4">
            <div className="bg-white p-2 rounded-lg shadow-sm border border-indigo-100 shrink-0">
              <Car className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h4 className="text-sm font-black text-indigo-900 mb-1">Need Fleet Transportation?</h4>
              <p className="text-xs text-indigo-800/80 leading-relaxed">
                If your attendees require bus shuttles or van transport for this event, please submit a separate request via the <Link to="/book-vehicle" className="font-bold underline text-indigo-700 hover:text-indigo-900">Book Vehicle</Link> tab.
              </p>
            </div>
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading}
          className={`w-full py-4 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl transition flex justify-center items-center space-x-2 disabled:opacity-70 ${editingEventId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {loading ? <span>Processing...</span> : <><Send className="w-5 h-5" /><span>{editingEventId ? 'Update Event Record' : 'Submit Event Booking'}</span></>}
        </button>
      </form>

      {isAdmin && (
        <div className="mt-12 pt-8 border-t-4 border-slate-200 space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ListPlus className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">Manage Standard Event Checklists</h3>
            </div>
            <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6">
               <div className="flex-1 space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase border-b pb-2">Active Checklist Items</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {standardAssets.map(asset => (
                      <div key={asset.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <span className="font-bold text-slate-800 text-xs">{asset.item_name}</span> 
                          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider bg-slate-200 px-1.5 py-0.5 rounded w-max">{asset.department.replace('_HEAD', '')}</span>
                        </div>
                        <button onClick={() => deleteStandardAsset(asset.id, asset.item_name)} className="text-slate-400 hover:text-red-500 bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm transition"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
               </div>
               <div className="w-full md:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200">
                 <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Add New Item</h4>
                 <div className="space-y-3">
                   <select value={newAssetDept} onChange={e => setNewAssetDept(e.target.value)} className="w-full p-2.5 text-xs font-bold border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-maroon">
                     <option value="AVIT_HEAD">AVIT Department</option>
                     <option value="SIYANAT_HEAD">Siyanat Support</option>
                     <option value="TANZEEM_HEAD">Tanzeem Support</option>
                   </select>
                   <input type="text" value={newAssetName} onChange={e => setNewAssetName(e.target.value)} placeholder="e.g. Laser Pointer" className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-maroon" />
                   <button onClick={addStandardAsset} className="w-full py-2.5 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wide rounded-lg hover:bg-indigo-700 transition shadow-sm">Add Item</button>
                 </div>
               </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">Admin Override: Manage All Events</h3>
            </div>
            <div className="space-y-4">
              {allEvents.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 text-center text-slate-500 font-medium italic border border-slate-200">No events booked.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {allEvents.map(e => (
                    <div key={e.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-3 flex-1 w-full">
                        <div>
                          <h3 className="font-bold text-brand-maroon text-sm leading-tight">{e.event_title}</h3>
                          <p className="text-[11px] text-slate-500 mt-1 font-semibold flex items-center gap-1">
                            <Users className="w-3 h-3"/> {e.requester?.full_name}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div>
                            <div className="flex items-center gap-1 text-slate-800 font-bold text-xs"><Clock className="w-3.5 h-3.5 text-slate-400"/> {new Date(e.event_date).toLocaleDateString()}</div>
                            <div className="text-[10px] font-medium text-slate-500 mt-0.5 line-clamp-2" title={e.time_slot}>{e.time_slot}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-slate-800 font-bold text-xs"><MapPin className="w-3.5 h-3.5 text-slate-400"/> {e.location}</div>
                            {e.sub_location && <div className="text-[10px] text-slate-500 mt-0.5 truncate">{e.sub_location}</div>}
                            <div className="text-[10px] text-slate-500 font-medium mt-1">Total Pax: <span className="font-black text-brand-maroon">{e.total_count}</span></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                         <button onClick={() => editEvent(e)} className="flex-1 md:w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition">
                           <Edit className="w-4 h-4 md:w-3.5 md:h-3.5" /> <span className="md:hidden">Edit</span>
                         </button>
                         <button onClick={() => deleteEvent(e.id, e.event_title)} className="flex-1 md:w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition">
                           <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" /> <span className="md:hidden">Eradicate</span>
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}