import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Car, Send, MapPin, Clock, Users, ShieldAlert, Route as RouteIcon, Map } from 'lucide-react';
import { ZONE_COORDINATES, LOCAL_LANDMARKS } from '../constants/locations';
import { useSystemConfig } from '../hooks/useSystemConfig';

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

// Preset Class Headcount Configuration


const getMinBookingDate = () => {
  const now = new Date();
  if (now.getHours() >= 18) {
    now.setDate(now.getDate() + 1);
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function BookVehicle() {
  const { user, role } = useAuth();
  const { classes: PRESET_CLASSES } = useSystemConfig();
  const [loading, setLoading] = useState(false);
  
  // Base Form State
  const [date, setDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [zone, setZone] = useState('');
  
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
  
  // Multi-Class & Headcount State
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);
  const [othersCount, setOthersCount] = useState(0);
  const totalCount = maleCount + femaleCount + othersCount;

  const isStandardUser = role === 'REQUESTER';

  // Mobile Past Date Validation Interceptor
  const handleDateChange = (selectedDate: string) => {
    const minDate = getMinBookingDate();
    if (selectedDate && selectedDate < minDate) {
      alert("Past dates cannot be selected. Setting to earliest available date.");
      setDate(minDate);
    } else {
      setDate(selectedDate);
    }
  };

  const toggleClass = (className: string) => {
    const classData = PRESET_CLASSES[className] || { male: 0, female: 0 };
    if (selectedClasses.includes(className)) {
      setSelectedClasses(prev => prev.filter(c => c !== className));
      setMaleCount(prev => Math.max(0, prev - classData.male));
      setFemaleCount(prev => Math.max(0, prev - classData.female));
    } else {
      setSelectedClasses(prev => [...prev, className]);
      setMaleCount(prev => prev + classData.male);
      setFemaleCount(prev => prev + classData.female);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Hybrid Search: Local Landmarks + Proximity-Biased Mapbox
  useEffect(() => {
    if (!destinationQuery || destinationQuery.length < 2 || destinationCoords) {
      setSuggestions([]);
      return;
    }

    const fetchPlaces = async () => {
      const queryLower = destinationQuery.toLowerCase();
      
      // 1. Search Local Landmarks
      const localMatches = Object.entries(LOCAL_LANDMARKS || {})
        .filter(([key, val]) => 
          key.toLowerCase().includes(queryLower) || 
          val.name.toLowerCase().includes(queryLower)
        )
        .map(([key, val]) => ({
          id: `local-${key}`,
          text: key,
          place_name: val.name,
          geometry: { coordinates: val.coords },
          isLocal: true
        }));

      // 2. Fetch Mapbox with Siddhpur Proximity Bias
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destinationQuery)}.json?access_token=${MAPBOX_TOKEN}&country=in&proximity=72.3789,23.9184&types=poi,address,place`
        );
        const data = await res.json();
        const mapboxResults = data.features || [];

        setSuggestions([...localMatches, ...mapboxResults]);
        setShowSuggestions(true);
      } catch (err) {
        console.error("Mapbox Geocoding Error:", err);
        if (localMatches.length > 0) {
          setSuggestions(localMatches);
          setShowSuggestions(true);
        }
      }
    };

    const timeoutId = setTimeout(fetchPlaces, 300);
    return () => clearTimeout(timeoutId);
  }, [destinationQuery, destinationCoords]);

  const handleDestinationSelect = (feature: any) => {
    setDestinationQuery(feature.place_name || feature.text);
    setDestinationCoords(feature.geometry.coordinates as [number, number]);
    setShowSuggestions(false);
  };

  useEffect(() => {
    const getRoute = async () => {
      if (zone && destinationCoords && ZONE_COORDINATES[zone]) {
        try {
          const origin = ZONE_COORDINATES[zone];
          const dest = destinationCoords;
          const res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${dest[0]},${dest[1]}?access_token=${MAPBOX_TOKEN}`);
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
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

  useEffect(() => {
    if (arrivalTime && travelTimeMins > 0) {
      setCalculatedDeparture(addMinutesToTime(arrivalTime, -(travelTimeMins + 15)));
    } else {
      setCalculatedDeparture('');
    }

    if (releaseTime && travelTimeMins > 0) {
      setCalculatedReturn(addMinutesToTime(releaseTime, travelTimeMins));
    } else {
      setCalculatedReturn('');
    }
  }, [arrivalTime, releaseTime, travelTimeMins]);

  const submitVehicleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalCount === 0) return alert("Total headcount cannot be zero.");
    if (!zone || !destinationCoords) return alert("Please select a pickup zone and a valid mapped destination.");
    
    setLoading(true);

    try {
      if (!user) throw new Error("Not authenticated");

      const fullDestination = `${destinationQuery} | Route Mins: ${travelTimeMins} | Dep: ${calculatedDeparture} | Ret: ${calculatedReturn}`;

      const { error } = await supabase.from('vehicle_requests').insert({
        requester_id: user.id,
        request_date: date,
        purpose,
        arrival_time: arrivalTime,
        release_time: releaseTime,
        destination: `From: ${zone} | To: ${fullDestination}`,
        darajah: selectedClasses.join(', ') || 'Others (Custom)',
        male_count: maleCount,
        female_count: femaleCount,
        total_count: totalCount
      });

      if (error) throw error;

      await supabase.from('system_logs').insert({
        action_type: 'VEHICLE_REQUESTED',
        description: `Requested transport from ${zone} to ${destinationQuery} on ${date} for ${totalCount} pax.`,
        user_email: user.email
      });

      alert('Vehicle Booking Submitted! Routed to Tanzeem Fleet Operations.');
      
      setDate(''); setPurpose(''); setZone('');
      setDestinationQuery(''); setDestinationCoords(null); setTravelTimeMins(0);
      setArrivalTime(''); setReleaseTime('');
      setSelectedClasses([]); setMaleCount(0); setFemaleCount(0); setOthersCount(0);

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
              <input 
                required 
                type="date" 
                min={getMinBookingDate()} 
                value={date} 
                onChange={e => handleDateChange(e.target.value)} 
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" 
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Purpose / Linked Event *</label>
              <input required type="text" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Guest Pickup for Annual Seminar" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
            </div>

            <div className="md:col-span-2 pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Pickup Campus Zone *</label>
              <select required value={zone} onChange={e => setZone(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm">
                <option value="" disabled>-- Select Campus Pickup Zone --</option>
                {Object.keys(ZONE_COORDINATES).map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>

            {/* MAPBOX & LOCAL LANDMARKS AUTOCOMPLETE */}
            <div className="md:col-span-2 relative" ref={searchRef}>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1"><Map className="w-3.5 h-3.5"/> Drop-off Destination (Landmark or Mapbox Address) *</label>
              <input 
                required 
                type="text" 
                value={destinationQuery} 
                onChange={e => { setDestinationQuery(e.target.value); setDestinationCoords(null); }} 
                placeholder="Search landmark (e.g. Hasanfeer, Station) or full address..." 
                className={`w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none transition shadow-sm focus:ring-2 ${destinationCoords ? 'focus:ring-emerald-500 border-emerald-200' : 'focus:ring-brand-maroon'}`} 
              />
              
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                  {suggestions.map((feature) => (
                    <div 
                      key={feature.id} 
                      onClick={() => handleDestinationSelect(feature)}
                      className="px-4 py-3 hover:bg-slate-50 border-b border-slate-100 cursor-pointer transition last:border-b-0 flex justify-between items-center"
                    >
                      <div className="pr-3">
                        <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          {feature.text}
                          {feature.isLocal && (
                            <span className="px-2 py-0.5 bg-brand-maroon/10 text-brand-maroon rounded text-[9px] font-black uppercase tracking-wider">
                              Preset Landmark
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">{feature.place_name}</div>
                      </div>
                      <MapPin className={`w-4 h-4 shrink-0 ${feature.isLocal ? 'text-brand-maroon' : 'text-slate-400'}`} />
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
                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Calculated Travel Time</p>
                 <p className="text-lg font-black text-indigo-900 mt-0.5">
                   {formatMinutesToHours(travelTimeMins)} (One Way)
                 </p>
               </div>
             </div>
          ) : (
            <div className="mb-6 p-4 rounded-xl text-xs font-bold text-slate-400 bg-slate-50 border border-slate-100 italic">
              Select origin zone and destination to auto-calculate travel times.
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

        {/* SECTION 3: MULTI-CLASS & HEADCOUNT ENGINE */}
        <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
            <div className="bg-brand-maroon/10 p-2 rounded-xl">
              <Users className="w-5 h-5 text-brand-maroon" />
            </div>
            <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Passenger Count & Darajah</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-4 mb-2">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-2">Select Darajah / Audience (Select Multiple) *</label>
              <div className="flex flex-wrap gap-2">
                {Object.keys(PRESET_CLASSES).map(className => {
                   const isSelected = selectedClasses.includes(className);
                   return (
                     <button
                       key={className}
                       type="button"
                       onClick={() => toggleClass(className)}
                       className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition border-2 ${isSelected ? 'border-brand-maroon bg-brand-maroon/10 text-brand-maroon' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'}`}
                     >
                       {className}
                     </button>
                   );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Male Passengers</label>
              <input type="number" min="0" value={maleCount} onChange={e => setMaleCount(parseInt(e.target.value) || 0)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-center focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
            </div>
            
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Female Passengers</label>
              <input type="number" min="0" value={femaleCount} onChange={e => setFemaleCount(parseInt(e.target.value) || 0)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-center focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Others / Guests</label>
              <input type="number" min="0" value={othersCount} onChange={e => setOthersCount(parseInt(e.target.value) || 0)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-center focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
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
               <div className="text-[10px] font-extrabold uppercase text-brand-gold">Total Seats Required</div>
               <div className="text-xl font-black text-white">{totalCount}</div>
             </div>
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