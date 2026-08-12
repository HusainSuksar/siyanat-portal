import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Car, Send, MapPin, Clock, Users } from 'lucide-react';

export default function BookVehicle() {
  const [loading, setLoading] = useState(false);
  
  // Details
  const [date, setDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [destination, setDestination] = useState('');
  
  // Timings
  const [arrivalTime, setArrivalTime] = useState('');
  const [releaseTime, setReleaseTime] = useState('');
  
  // Headcount
  const [darajah, setDarajah] = useState('1');
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);

  const totalCount = maleCount + femaleCount;

  const submitVehicleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalCount === 0) return alert("Total headcount cannot be zero. We need passenger numbers to assign vehicles.");
    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('vehicle_requests')
        .insert({
          requester_id: authData.user.id,
          request_date: date,
          purpose,
          arrival_time: arrivalTime,
          release_time: releaseTime,
          destination,
          darajah,
          male_count: maleCount,
          female_count: femaleCount,
          total_count: totalCount
        });

      if (error) throw error;

      await supabase.from('system_logs').insert({
        action_type: 'VEHICLE_REQUESTED',
        description: `Requested transport to ${destination} on ${date} for ${totalCount} pax.`,
        user_email: authData.user.email
      });

      alert('Vehicle Booking Submitted! Pending Tanzeem Fleet Approval.');
      
      // Reset Form
      setDate(''); setPurpose(''); setDestination(''); 
      setArrivalTime(''); setReleaseTime('');
      setMaleCount(0); setFemaleCount(0);

    } catch (err: any) {
      alert("Error booking vehicle: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-brand-maroon text-brand-gold rounded-xl shadow-md">
          <Car className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Book a Vehicle</h2>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Request fleet transport and shuttles for official events.</p>
        </div>
      </div>

      <form onSubmit={submitVehicleRequest} className="space-y-6">
        
        {/* SECTION 1: EVENT & DESTINATION */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
            <MapPin className="w-5 h-5 text-brand-maroon" />
            <h3 className="font-extrabold text-sm uppercase text-slate-800">Destination & Purpose</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Date Required *</label>
              <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Destination *</label>
              <input required type="text" value={destination} onChange={e => setDestination(e.target.value)} placeholder="e.g. Railway Station" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Purpose / Linked Event *</label>
              <input required type="text" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Guest Pickup for Annual Seminar" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>
          </div>
        </div>

        {/* SECTION 2: TIMINGS */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
            <Clock className="w-5 h-5 text-brand-maroon" />
            <h3 className="font-extrabold text-sm uppercase text-slate-800">Timing Parameters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Required Arrival Time *</label>
              <input required type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
              <p className="text-[10px] text-slate-500 mt-1">When must the passengers reach the destination?</p>
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Expected Release Time (Optional)</label>
              <input type="time" value={releaseTime} onChange={e => setReleaseTime(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
              <p className="text-[10px] text-slate-500 mt-1">When will the vehicles be free to return?</p>
            </div>
          </div>
        </div>

        {/* SECTION 3: HEADCOUNT */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
            <Users className="w-5 h-5 text-brand-maroon" />
            <h3 className="font-extrabold text-sm uppercase text-slate-800">Passenger Count</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Darajah / Category</label>
              <select value={darajah} onChange={e => setDarajah(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none">
                <option>1</option>
                <option>2</option>
                <option>3</option><option>4</option>
                <option>5</option>
                <option>6</option><option>7</option>
                <option>8</option>
                <option>9</option><option>10</option>
                <option>11</option>
                <option>Random</option>
                <option>Faculty / Staff</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Male Passengers</label>
              <input type="number" min="0" value={maleCount} onChange={e => setMaleCount(parseInt(e.target.value) || 0)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>
            
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Female Passengers</label>
              <input type="number" min="0" value={femaleCount} onChange={e => setFemaleCount(parseInt(e.target.value) || 0)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-brand-maroon/5 rounded-xl border border-brand-maroon/20 flex justify-between items-center">
            <span className="text-xs font-black uppercase text-brand-maroon">Total Seats Required</span>
            <span className="text-xl font-black text-brand-maroon">{totalCount}</span>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl transition flex justify-center items-center space-x-2 disabled:opacity-70"
        >
          {loading ? <span>Processing Request...</span> : <><Send className="w-5 h-5" /><span>Submit Vehicle Request</span></>}
        </button>
      </form>
    </div>
  );
}