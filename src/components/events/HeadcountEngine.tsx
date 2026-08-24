import React from 'react';
import { Users } from 'lucide-react';
import type { EventFormData } from '../../types/eventBooking';

const PRESET_CLASSES: Record<string, { male: number, female: number }> = {
  "1AM": { male: 25, female: 0 }, "1BM": { male: 25, female: 0 }, "1CM": { male: 23, female: 0 },
  "1AF": { male: 0, female: 20 }, "1BF": { male: 0, female: 19 }, "1CF": { male: 0, female: 19 },
  "Faculty / Staff": { male: 0, female: 0 }, "Others (Custom)": { male: 0, female: 0 }
};

export default function HeadcountEngine({
  formData,
  setFormData
}: {
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
}) {
  const toggleClass = (className: string) => {
    const isSelected = formData.selectedClasses.includes(className);
    const mDelta = PRESET_CLASSES[className]?.male || 0;
    const fDelta = PRESET_CLASSES[className]?.female || 0;

    setFormData(prev => ({
      ...prev,
      selectedClasses: isSelected 
        ? prev.selectedClasses.filter(c => c !== className) 
        : [...prev.selectedClasses, className],
      maleCount: isSelected ? Math.max(0, prev.maleCount - mDelta) : prev.maleCount + mDelta,
      femaleCount: isSelected ? Math.max(0, prev.femaleCount - fDelta) : prev.femaleCount + fDelta
    }));
  };

  const totalCount = formData.maleCount + formData.femaleCount + formData.othersCount;

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200">
      <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
        <Users className="w-5 h-5 text-brand-maroon" />
        <h3 className="font-extrabold text-sm uppercase text-slate-800">Darajah & Headcount Summary</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="md:col-span-4 mb-2">
          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-2">Select Darajah / Audience *</label>
          <div className="flex flex-wrap gap-2">
            {Object.keys(PRESET_CLASSES).map(className => (
              <button 
                key={className} 
                type="button" 
                onClick={() => toggleClass(className)} 
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition border-2 ${formData.selectedClasses.includes(className) ? 'border-brand-maroon bg-brand-maroon/10 text-brand-maroon' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'}`}
              >
                {className}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Male Count</label>
          <input 
            type="number" 
            min="0" 
            value={formData.maleCount} 
            onChange={e => setFormData({ ...formData, maleCount: parseInt(e.target.value, 10) || 0 })} 
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-brand-maroon outline-none" 
          />
        </div>
        <div>
          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Female Count</label>
          <input 
            type="number" 
            min="0" 
            value={formData.femaleCount} 
            onChange={e => setFormData({ ...formData, femaleCount: parseInt(e.target.value, 10) || 0 })} 
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-brand-maroon outline-none" 
          />
        </div>
        <div>
          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Others / Guests</label>
          <input 
            type="number" 
            min="0" 
            value={formData.othersCount} 
            onChange={e => setFormData({ ...formData, othersCount: parseInt(e.target.value, 10) || 0 })} 
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-brand-maroon outline-none" 
          />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
         <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center shadow-sm">
           <div className="text-[10px] font-extrabold uppercase text-slate-500">Total Males</div>
           <div className="text-xl font-black text-slate-800">{formData.maleCount}</div>
         </div>
         <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center shadow-sm">
           <div className="text-[10px] font-extrabold uppercase text-slate-500">Total Females</div>
           <div className="text-xl font-black text-slate-800">{formData.femaleCount}</div>
         </div>
         <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center shadow-sm">
           <div className="text-[10px] font-extrabold uppercase text-slate-500">Total Guests</div>
           <div className="text-xl font-black text-slate-800">{formData.othersCount}</div>
         </div>
         <div className="bg-brand-maroon p-3 rounded-xl text-center shadow-md">
           <div className="text-[10px] font-extrabold uppercase text-brand-gold">Total Capacity</div>
           <div className="text-xl font-black text-white">{totalCount}</div>
         </div>
      </div>
    </div>
  );
}