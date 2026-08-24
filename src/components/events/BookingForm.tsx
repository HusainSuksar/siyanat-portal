import React from 'react';
import { Clock, Lock } from 'lucide-react';
import { EVENT_ZONES, EVENT_VENUES } from '../../constants/locations';
import type { EventFormData } from '../../types/eventBooking';

const BETWEEN_CLASS_PERIODS = [
  { id: 'P1', time: '08:15 - 09:00' }, { id: 'P2', time: '09:01 - 09:35' },
  { id: 'P3', time: '09:36 - 10:10' }, { id: 'P4', time: '10:11 - 10:45' },
  { id: 'P5', time: '10:46 - 11:35' }, { id: 'P6', time: '11:36 - 12:10' },
  { id: 'P7', time: '12:11 - 12:45' }, { id: 'P8', time: '12:46 - 13:20' },
  { id: 'P9', time: '14:20 - 15:00' }, { id: 'P10', time: '15:01 - 15:45' }
];

const AFTER_CLASS_SLOTS = [
  '15:46 - 16:30', '16:31 - 17:00', '17:01 - 17:30', '17:31 - 18:00',
  '18:01 - 18:30', '18:31 - 19:00', '19:01 - 19:30', '19:31 - 20:00',
  '20:31 - 21:00', '21:01 - 21:30', '21:31 - 22:00', '22:01 - 22:30'
];

export default function BookingForm({
  formData,
  setFormData,
  isStandardUser,
  minBookingDate
}: {
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
  isStandardUser: boolean;
  minBookingDate: string;
}) {
  const togglePeriod = (id: string) => {
    setFormData(prev => ({
      ...prev,
      selectedPeriods: prev.selectedPeriods.includes(id) 
        ? prev.selectedPeriods.filter(p => p !== id) 
        : [...prev.selectedPeriods, id].sort((a, b) => parseInt(a.substring(1)) - parseInt(b.substring(1)))
    }));
  };

  const toggleAfterClass = (slot: string) => {
    setFormData(prev => ({
      ...prev,
      selectedAfterClass: prev.selectedAfterClass.includes(slot) 
        ? prev.selectedAfterClass.filter(s => s !== slot) 
        : [...prev.selectedAfterClass, slot]
    }));
  };

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200">
      <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
        <Clock className="w-5 h-5 text-brand-maroon" />
        <h3 className="font-extrabold text-sm uppercase text-slate-800">Scheduling & Location</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Event Title *</label>
          <input 
            required 
            type="text" 
            value={formData.title} 
            onChange={e => setFormData({ ...formData, title: e.target.value })} 
            placeholder="e.g. Annual Department Seminar" 
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" 
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Event Date *</label>
          <input 
            required 
            type="date" 
            min={minBookingDate} 
            value={formData.date} 
            onChange={e => setFormData({ ...formData, date: e.target.value })} 
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" 
          />
        </div>
        <div>
          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Primary Venue *</label>
          <select 
            required 
            value={formData.location} 
            onChange={e => setFormData({ ...formData, location: e.target.value, subLocation: '' })} 
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none"
          >
            <option value="" disabled>Select Primary Venue</option>
            {EVENT_ZONES.map(venue => <option key={venue} value={venue}>{venue}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Sub-Location *</label>
          <select 
            required 
            disabled={!formData.location} 
            value={formData.subLocation} 
            onChange={e => setFormData({ ...formData, subLocation: e.target.value })} 
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none disabled:opacity-50"
          >
            <option value="" disabled>{formData.location ? 'Select Sub-Location' : 'Select Primary Venue First'}</option>
            {formData.location && EVENT_VENUES[formData.location]?.map(subLoc => <option key={subLoc} value={subLoc}>{subLoc}</option>)}
          </select>
        </div>

        <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-3">Event Timing Category *</label>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${formData.timingType === 'Between Classes' ? 'border-brand-maroon bg-brand-maroon/5 text-brand-maroon' : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="radio" value="Between Classes" checked={formData.timingType === 'Between Classes'} onChange={() => setFormData({ ...formData, timingType: 'Between Classes' })} className="hidden" />
              <span className="font-bold text-sm">Between Classes (Timetable)</span>
            </label>
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition ${isStandardUser ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200' : formData.timingType === 'After Classes' ? 'border-brand-maroon bg-brand-maroon/5 text-brand-maroon cursor-pointer' : 'border-slate-200 hover:border-slate-300 cursor-pointer'}`}>
              <input type="radio" value="After Classes" disabled={isStandardUser} checked={formData.timingType === 'After Classes'} onChange={() => !isStandardUser && setFormData({ ...formData, timingType: 'After Classes' })} className="hidden" />
              <span className={`font-bold text-sm ${isStandardUser ? 'text-slate-400' : ''}`}>After Classes (Custom Time)</span>
              {isStandardUser && <Lock className="w-4 h-4 text-slate-400" />}
            </label>
          </div>

          {formData.timingType === 'Between Classes' ? (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in">
              <h4 className="text-[10px] font-black text-slate-500 uppercase mb-3">Select Timetable Periods</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {BETWEEN_CLASS_PERIODS.map(p => (
                  <label key={p.id} className={`flex flex-col p-2 rounded-lg border-2 cursor-pointer transition ${formData.selectedPeriods.includes(p.id) ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                    <input type="checkbox" checked={formData.selectedPeriods.includes(p.id)} onChange={() => togglePeriod(p.id)} className="hidden" />
                    <span className={`text-[11px] font-black ${formData.selectedPeriods.includes(p.id) ? 'text-indigo-800' : 'text-slate-700'}`}>{p.id}</span>
                    <span className="text-[9px] font-bold text-slate-500 tracking-tight mt-0.5">{p.time}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in">
              <h4 className="text-[10px] font-black text-slate-500 uppercase mb-3">Select After-Class Slots</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {AFTER_CLASS_SLOTS.map(slot => (
                  <label key={slot} className={`flex flex-col p-2.5 rounded-lg border-2 cursor-pointer transition ${formData.selectedAfterClass.includes(slot) ? 'border-brand-maroon bg-brand-maroon/10 shadow-sm' : 'border-slate-200 bg-white hover:border-brand-maroon/50'}`}>
                    <input type="checkbox" checked={formData.selectedAfterClass.includes(slot)} onChange={() => toggleAfterClass(slot)} className="hidden" />
                    <span className={`text-[11px] font-black text-center ${formData.selectedAfterClass.includes(slot) ? 'text-brand-maroon' : 'text-slate-700'}`}>{slot}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}