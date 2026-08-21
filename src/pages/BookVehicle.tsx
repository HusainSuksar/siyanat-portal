import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Car, Send, MapPin, Clock, Users, ShieldAlert, Route as RouteIcon, Map } from 'lucide-react';
import { MAINTENANCE_ZONES, ZONE_COORDINATES } from '../constants/locations';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

// Time Math Helper Functions
const addMinutesToTime = (timeStr: string, minsToAdd: number) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m + minsToAdd, 0);
  return date.toTimeString().slice(0, 5);
};
const formatMinutesToHours = (totalMins: number) => {
  if (!totalMins || totalMins <= 0) return '0 Mins';
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `${mins} Mins`;
  if (mins === 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${hours} hr${hours > 1 ? 's' : ''} ${mins} mins`;
};
export default function BookVehicle() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Base Form State
  const [date, setDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [zone, setZone] = useState('');
  const [pickupVenue, setPickupVenue] = useState('');
  
  // Mapbox Autocomplete State
  const [destinationQuery, setDestinationQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Routing Math State
  const [travelTimeMins, setTravelTimeMins] = useState<number>(0);
  const [arrivalTime, setArrivalTime] = useState('');
  const [releaseTime, setReleaseTime] = useState('');
  const [calculatedDeparture, setCalculatedDeparture] = useState('');
  const [calculatedReturn, setCalculatedReturn] = useState('');
  
  // Headcount
  const [darajah, setDarajah] = useState('1');
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);
  const totalCount = maleCount + femaleCount;

  // Security Check
  const isStandardUser = role === 'REQUESTER';

  // Click outside to close Autocomplete
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- MAPBOX GEOCODING (Autocomplete) ---
  useEffect(() => {
    if (!destinationQuery || destinationQuery.length < 3 || destinationCoords) {
      setSuggestions([]);
      return;
    }
    const fetchPlaces = async () => {
      try {
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destinationQuery)}.json?access_token=${MAPBOX_TOKEN}&country=in&types=poi,address,place`);
        const data = await res.json();
        setSuggestions(data.features || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error("Mapbox Geocoding Error:", err);
      }
    };
    const timeoutId = setTimeout(fetchPlaces, 500);
    return () => clearTimeout(timeoutId);
  }, [destinationQuery]);

  const handleDestinationSelect = (feature: any) => {
    setDestinationQuery(feature.place_name);
    setDestinationCoords(feature.geometry.coordinates as [number, number]);
    setShowSuggestions(false);
  };

  // --- MAPBOX DIRECTIONS (Travel Time) ---
  useEffect(() => {
    const getRoute = async () => {
      if (zone && destinationCoords && ZONE_COORDINATES[zone]) {
        try {
          const origin = ZONE_COORDINATES[zone];
          const dest = destinationCoords;
          const res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${dest[0]},${dest[1]}?access_token=${MAPBOX_TOKEN}`);
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            // Duration is in seconds, convert to minutes
            setTravelTimeMins(Math.ceil(data.routes[0].duration / 60));
          }
        } catch (err) {
          console.error("Mapbox Routing Error:", err);
        }
      } else {
        setTravelTimeMins(0);
      }
    };
    getRoute();
  }, [zone, destinationCoords]);

  // --- MATH ENGINE (Time Calculations) ---
  useEffect(() => {
    if (arrivalTime && travelTimeMins > 0) {
      // Departure = Arrival Time - Travel Time - 15 Min Buffer
      setCalculatedDeparture(addMinutesToTime(arrivalTime, -(travelTimeMins + 15)));
    } else {
      setCalculatedDeparture('');
    }

    if (releaseTime && travelTimeMins > 0) {
      // Return = Release Time + Travel Time
      setCalculatedReturn(addMinutesToTime(releaseTime, travelTimeMins));
    } else {
      setCalculatedReturn('');
    }
  }, [arrivalTime, releaseTime, travelTimeMins]);


  const submitVehicleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalCount === 0) return alert("Total headcount cannot be zero.");
    if (!pickupVenue || !destinationCoords) return alert("Please select a specific pickup location and a valid mapped destination.");
    
    setLoading(true);

    try {
      if (!user) throw new Error("Not authenticated");

      // We append the smart calculations into the payload so Dispatchers see it
      const fullDestination = `${destinationQuery} | Route Mins: ${travelTimeMins} | Dep: ${calculatedDeparture} | Ret: ${calculatedReturn}`;

      const { error } = await supabase.from('vehicle_requests').insert({
        requester_id: user.id,
        request_date: date,
        purpose,
        arrival_time: arrivalTime,
        release_time: releaseTime,
        destination: `From: ${pickupVenue} | To: ${fullDestination}`,
        darajah,
        male_count: maleCount,
        female_count: femaleCount,
        total_count: totalCount
      });

      if (error) throw error;

      await supabase.from('system_logs').insert({
        action_type: 'VEHICLE_REQUESTED',
        description: `Requested transport to ${destinationQuery} on ${date} for ${totalCount} pax.`,
        user_email: user.email
      });

      alert('Vehicle Booking Submitted! Routed to Tanzeem Fleet Operations.');
      
      // Reset State
      setDate(''); setPurpose(''); setZone(''); setPickupVenue(''); 
      setDestinationQuery(''); setDestinationCoords(null); setTravelTimeMins(0);
      setArrivalTime(''); setReleaseTime(''); setMaleCount(0); setFemaleCount(0);

    } catch (err: any) {
      alert("Error booking vehicle: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isStandardUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Access Denied</h2>
        <p className="text-slate-500 font-bold mt-2 max-w-md">Your current role does not have authorization to request fleet transport.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="p-4 bg-brand-maroon text-brand-gold rounded-2xl shadow-md shrink-0">
          <Car className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Book a Vehicle</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Request fleet transport and shuttles with smart routing.</p>
        </div>
      </div>

      <form onSubmit={submitVehicleRequest} className="space-y-6">
        
        {/* SECTION 1: ROUTE & MAPBOX INTEGRATION */}
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
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Campus Origin Point</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Pickup Zone *</label>
                  <select required value={zone} onChange={e => { setZone(e.target.value); setPickupVenue(''); }} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm">
                    <option value="" disabled>-- Select Campus Zone --</option>
                    {Object.keys(ZONE_COORDINATES).map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Specific Pickup Venue *</label>
                  <select required disabled={!zone} value={pickupVenue} onChange={e => setPickupVenue(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm disabled:opacity-50">
                    <option value="" disabled>{zone ? '-- Select Venue --' : 'Select Zone First'}</option>
                    {zone && MAINTENANCE_ZONES[zone]?.map((v: string) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* MAPBOX AUTOCOMPLETE */}
            <div className="md:col-span-2 relative" ref={searchRef}>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1"><Map className="w-3.5 h-3.5"/> Drop-off Destination (Powered by Mapbox) *</label>
              <input 
                required 
                type="text" 
                value={destinationQuery} 
                onChange={e => { setDestinationQuery(e.target.value); setDestinationCoords(null); }} 
                placeholder="Search real-world address or location..." 
                className={`w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none transition shadow-sm focus:ring-2 ${destinationCoords ? 'focus:ring-emerald-500 border-emerald-200' : 'focus:ring-brand-maroon'}`} 
              />
              
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-60">
                  {suggestions.map((feature) => (
                    <div 
                      key={feature.id} 
                      onClick={() => handleDestinationSelect(feature)}
                      className="px-4 py-3 hover:bg-slate-50 border-b border-slate-100 cursor-pointer transition last:border-b-0"
                    >
                      <div className="text-sm font-bold text-slate-800">{feature.text}</div>
                      <div className="text-[10px] text-slate-500 truncate">{feature.place_name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: TIMING ENGINE */}
        <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
            <div className="bg-brand-maroon/10 p-2 rounded-xl">
              <Clock className="w-5 h-5 text-brand-maroon" />
            </div>
            <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Timing Parameters</h3>
          </div>
          
          {travelTimeMins > 0 ? (
             <div className="mb-6 bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center gap-4">
               <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-100"><RouteIcon className="w-6 h-6 text-indigo-600"/></div>
               <div>
                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Mapbox Calculated Travel Time</p>
                 <p className="text-lg font-black text-indigo-900 mt-0.5">
  {formatMinutesToHours(travelTimeMins)} (One Way)
</p>
               </div>
             </div>
          ) : (
            <div className="mb-6 p-4 rounded-xl text-xs font-bold text-slate-400 bg-slate-50 border border-slate-100 italic">
              Select origin and destination to auto-calculate travel times.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Required Arrival Time *</label>
              <input required type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
              {calculatedDeparture && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-800">
                  <span className="uppercase font-black text-amber-600 tracking-wider">Suggested Dept:</span> {calculatedDeparture} <span className="text-amber-600/70">(Incl 15m Buffer)</span>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Expected Release Time (Optional)</label>
              <input type="time" value={releaseTime} onChange={e => setReleaseTime(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
              {calculatedReturn && (
                <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-800">
                  <span className="uppercase font-black text-emerald-600 tracking-wider">Est. Campus Drop:</span> {calculatedReturn}
                </div>
              )}
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