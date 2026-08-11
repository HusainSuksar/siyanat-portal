import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Users, MonitorSpeaker, Send, Clock } from 'lucide-react';

export default function BookEvent() {
  const [loading, setLoading] = useState(false);
  
  // Basic Details
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [timingType, setTimingType] = useState('After Classes');
  const [timeSlot, setTimeSlot] = useState('');
  const [location, setLocation] = useState('');
  const [subLocation, setSubLocation] = useState('');
  
  // Headcount
  const [darajah, setDarajah] = useState('Mutawassitah');
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);
  const [othersCount, setOthersCount] = useState(0);

  // Requirements
  const [requirements, setRequirements] = useState<{dept: string, item: string}[]>([]);

  const toggleRequirement = (dept: string, item: string) => {
    setRequirements(prev => {
      const exists = prev.find(r => r.item === item);
      if (exists) return prev.filter(r => r.item !== item);
      return [...prev, { dept, item }];
    });
  };

  const totalCount = maleCount + femaleCount + othersCount;

  const submitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalCount === 0) return alert("Total headcount cannot be zero.");
    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Not authenticated");

      // 1. Insert Event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          requester_id: authData.user.id,
          event_title: title,
          event_date: date,
          timing_type: timingType,
          time_slot: timeSlot,
          location,
          sub_location: subLocation,
          darajah,
          male_count: maleCount,
          female_count: femaleCount,
          others_count: othersCount,
          total_count: totalCount
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // 2. Insert Requirements
      if (requirements.length > 0) {
        const reqPayload = requirements.map(req => ({
          event_id: eventData.id,
          department: req.dept,
          item_name: req.item
        }));

        const { error: reqError } = await supabase.from('event_requirements').insert(reqPayload);
        if (reqError) throw reqError;
      }

      await supabase.from('system_logs').insert({
        action_type: 'EVENT_REQUESTED',
        description: `Requested venue booking for ${title} on ${date}.`,
        user_email: authData.user.email
      });

      alert('Event Booking Request Submitted! Pending Tanzeem Approval.');
      
      // Reset
      setTitle(''); setDate(''); setLocation(''); setSubLocation('');
      setMaleCount(0); setFemaleCount(0); setOthersCount(0); setRequirements([]);

    } catch (err: any) {
      alert("Error booking event: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-brand-maroon text-brand-gold rounded-xl shadow-md">
          <Calendar className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Book Venue & Event</h2>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Request facilities, AVIT support, and schedule events.</p>
        </div>
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Timing</label>
                <select value={timingType} onChange={e => setTimingType(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none">
                  <option>After Classes</option>
                  <option>Between Classes</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Time Slot / Period *</label>
                <input required type="text" value={timeSlot} onChange={e => setTimeSlot(e.target.value)} placeholder={timingType === 'Between Classes' ? 'e.g. Period 3' : 'e.g. 4:00 PM - 6:00 PM'} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
              </div>
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
            
            <div>
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
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Darajah</label>
              <select value={darajah} onChange={e => setDarajah(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none">
                <option>Mutawassitah</option>
                <option>Sanawiyyah</option>
                <option>Aaliyah</option>
                <option>Faculty / Staff</option>
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
          
          <div className="mt-4 p-3 bg-brand-maroon/5 rounded-xl border border-brand-maroon/20 flex justify-between items-center">
            <span className="text-xs font-black uppercase text-brand-maroon">Total Computed Capacity</span>
            <span className="text-xl font-black text-brand-maroon">{totalCount}</span>
          </div>
        </div>

        {/* SECTION 3: ASSETS & REQUIREMENTS */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
            <MonitorSpeaker className="w-5 h-5 text-brand-maroon" />
            <h3 className="font-extrabold text-sm uppercase text-slate-800">Fixed Assets & Event Requirements</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2">AVIT Department</h4>
              <div className="space-y-2">
                {['Microphones (Wireless)', 'Projector & Screen', 'Webcasting Setup', 'A/V Relays'].map(item => (
                  <label key={item} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer border border-transparent hover:border-slate-200 transition">
                    <input type="checkbox" onChange={() => toggleRequirement('AVIT', item)} className="w-4 h-4 text-brand-maroon rounded focus:ring-brand-maroon" />
                    <span className="text-xs font-bold text-slate-700">{item}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2">Siyanat / Tanzeem Support</h4>
              <div className="space-y-2">
                {['AC Override / Support', 'Facility Lighting Control', 'Crowd Control Barricades', 'Additional Seating'].map(item => (
                  <label key={item} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer border border-transparent hover:border-slate-200 transition">
                    <input type="checkbox" onChange={() => toggleRequirement('Support', item)} className="w-4 h-4 text-brand-maroon rounded focus:ring-brand-maroon" />
                    <span className="text-xs font-bold text-slate-700">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl transition flex justify-center items-center space-x-2 disabled:opacity-70"
        >
          {loading ? <span>Processing Request...</span> : <><Send className="w-5 h-5" /><span>Submit Event Booking</span></>}
        </button>
      </form>
    </div>
  );
}