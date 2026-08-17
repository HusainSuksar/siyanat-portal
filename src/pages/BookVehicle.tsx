import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Car, Send, MapPin, Clock, Users, ShieldAlert } from 'lucide-react';

const ZONES: Record<string, string[]> = {
  "Main Jamea Complex": [
    "Zainee Masjid/Sehen Ground Floor", "Zainee Masjid First Floor (Classes)", "Zainee Masjid - Offices", 
    "Zainee Masjid Bathrooms", "Zainee Masjid Outer Area", "Zainee Masjid (IT Room)",
    "Najmi Hall Ground Floor (Classes)", "Najmi Hall First Floor (Classes)", "Najmi Hall - Offices", 
    "Najmi Hall Bathrooms", "Najmi Hall Outer Area", "Najmi Hall Multi Purpose", "Najmi Hall - Library",
    "Saifee Masjid Ground Floor (Classes)", "Saifee Masjid Bathrooms", "Rajas Office", "Rajas Office Bathroom"
  ],
  "Rabwat (Girls Hostel)": [
    "Rabwat residence building", "Naashta Mawaid/Garden Room", "Mawaid Hall (Dinner Mawaid)", 
    "Mawaid Hall 1st floor (Maamal, library etc:-)", "Laundry"
  ],
  "Masakin (Boys Hostel)": [
    "Masakin Residence Building", "Computer Room", "Qasida Room", "Pantry", 
    "Bathrooms Ground Floor", "Bathrooms First Floor", "Bathrooms Second Floor", 
    "Reception/Office", "Luggage Room"
  ],
  "Mawaid": [
    "Mawaid Hall", "Kitchen", "Office", "Mawaid Bathrooms", "Zabihat Room", "Roti Room"
  ],
  "Khaimat al-Riyadat": [
    "Football/Cricket Ground", "Volleyball Court", "Indore Games Room", "Swimming Pool"
  ]
};

export default function BookVehicle() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Details
  const [date, setDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [zone, setZone] = useState('');
  const [pickupVenue, setPickupVenue] = useState('');
  const [destination, setDestination] = useState('');
  
  // Timings
  const [arrivalTime, setArrivalTime] = useState('');
  const [releaseTime, setReleaseTime] = useState('');
  
  // Headcount
  const [darajah, setDarajah] = useState('1');
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);

  const totalCount = maleCount + femaleCount;

  // COMPONENT-LEVEL SECURITY CHECK
  const isStandardUser = role === 'STANDARD_USER' || role === 'REQUESTER';
  if (isStandardUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Access Denied</h2>
        <p className="text-slate-500 font-bold mt-2 max-w-md">Your current departmental role does not have authorization to request fleet transport. Please contact your department head.</p>
      </div>
    );
  }

  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setZone(e.target.value);
    setPickupVenue(''); // Reset dependent venue
  };

  const submitVehicleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalCount === 0) return alert("Total headcount cannot be zero. We need passenger numbers to assign vehicles.");
    if (!pickupVenue) return alert("Please select a specific pickup location.");
    
    setLoading(true);

    try {
      if (!user) throw new Error("Not authenticated");

      const fullDestination = `From: ${pickupVenue} | To: ${destination}`;

      const { error } = await supabase.from('vehicle_requests').insert({
        requester_id: user.id,
        request_date: date,
        purpose,
        arrival_time: arrivalTime,
        release_time: releaseTime,
        destination: fullDestination, // Combine them for the backend
        darajah,
        male_count: maleCount,
        female_count: femaleCount,
        total_count: totalCount,
        status: 'Pending Tanzeem Approval'
      });

      if (error) throw error;

      await supabase.from('system_logs').insert({
        action_type: 'VEHICLE_REQUESTED',
        description: `Requested transport to ${destination} on ${date} for ${totalCount} pax.`,
        user_email: user.email
      });

      alert('Vehicle Booking Submitted! Pending Tanzeem Fleet Approval.');
      
      // Reset Form
      setDate(''); setPurpose(''); setZone(''); setPickupVenue(''); setDestination(''); 
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
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="p-4 bg-brand-maroon text-brand-gold rounded-2xl shadow-md shrink-0">
          <Car className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Book a Vehicle</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Request fleet transport and shuttles for official events.</p>
        </div>
      </div>

      <form onSubmit={submitVehicleRequest} className="space-y-6">
        
        {/* SECTION 1: EVENT & ROUTE */}
        <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
            <div className="bg-brand-maroon/10 p-2 rounded-xl">
              <MapPin className="w-5 h-5 text-brand-maroon" />
            </div>
            <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Route & Purpose</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Date Required *</label>
              <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Purpose / Linked Event *</label>
              <input required type="text" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Guest Pickup for Annual Seminar" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
            </div>

            <div className="md:col-span-2 pt-2 border-t border-slate-100">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Campus Pickup Location</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Pickup Zone *</label>
                  <select required value={zone} onChange={handleZoneChange} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm">
                    <option value="" disabled>-- Select Campus Zone --</option>
                    {Object.keys(ZONES).map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Specific Pickup Venue *</label>
                  <select required disabled={!zone} value={pickupVenue} onChange={e => setPickupVenue(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm disabled:opacity-50">
                    <option value="" disabled>{zone ? '-- Select Venue --' : 'Select Zone First'}</option>
                    {zone && ZONES[zone].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Final Destination *</label>
              <input required type="text" value={destination} onChange={e => setDestination(e.target.value)} placeholder="e.g. Ahmedabad Airport (Terminal 1)" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
            </div>
          </div>
        </div>

        {/* SECTION 2: TIMINGS */}
        <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
            <div className="bg-brand-maroon/10 p-2 rounded-xl">
              <Clock className="w-5 h-5 text-brand-maroon" />
            </div>
            <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Timing Parameters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Required Arrival Time *</label>
              <input required type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
              <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-wide">When must the passengers reach the destination?</p>
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Expected Release Time (Optional)</label>
              <input type="time" value={releaseTime} onChange={e => setReleaseTime(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
              <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-wide">When will the vehicles be free to return?</p>
            </div>
          </div>
        </div>

        {/* SECTION 3: HEADCOUNT */}
        <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
            <div className="bg-brand-maroon/10 p-2 rounded-xl">
              <Users className="w-5 h-5 text-brand-maroon" />
            </div>
            <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Passenger Count</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 items-end">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Darajah / Category</label>
              <select value={darajah} onChange={e => setDarajah(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm">
                <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
                <option>6</option><option>7</option><option>8</option><option>9</option><option>10</option>
                <option>11</option>
                <option>Random</option>
                <option>Faculty / Staff</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Male Passengers</label>
              <input type="number" min="0" value={maleCount} onChange={e => setMaleCount(parseInt(e.target.value) || 0)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-center focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
            </div>
            
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Female Passengers</label>
              <input type="number" min="0" value={femaleCount} onChange={e => setFemaleCount(parseInt(e.target.value) || 0)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-center focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-brand-maroon/5 rounded-xl border border-brand-maroon/20 flex justify-between items-center">
            <span className="text-[11px] font-black uppercase text-brand-maroon tracking-widest">Total Seats Required</span>
            <span className="text-2xl font-black text-brand-maroon">{totalCount}</span>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs md:text-sm uppercase tracking-widest rounded-2xl shadow-xl transition flex justify-center items-center space-x-2 disabled:opacity-70"
        >
          {loading ? (
            <span className="animate-pulse">Processing Request...</span>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Submit Vehicle Request</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}