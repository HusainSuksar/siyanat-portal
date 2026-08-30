import { useState } from 'react';
import { ShieldCheck, CalendarCheck, Car, Package, Layers } from 'lucide-react';
import EventsManager from '../components/tanzeem/EventsManager';
import FleetEngine from '../components/tanzeem/FleetEngine';
import StationeryDispatcher from '../components/tanzeem/StationeryDispatcher';
import StandardAssetsManager from '../components/tanzeem/StandardAssetsManager';

export default function TanzeemCommandCenter() {
  const [activeTab, setActiveTab] = useState<'events' | 'fleet' | 'stationery' | 'checklists'>('events');

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="bg-brand-maroon/10 p-3 rounded-2xl">
            <ShieldCheck className="w-8 h-8 text-brand-maroon" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Tanzeem Command Center</h2>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Events, Fleet Logistics, Stationery Dispatch, and Checklist Catalog.
            </p>
          </div>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button 
          onClick={() => setActiveTab('events')} 
          className={`px-5 py-3 text-xs uppercase font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'events' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <CalendarCheck className="w-4 h-4" /> Event Approvals
        </button>

        <button 
          onClick={() => setActiveTab('fleet')} 
          className={`px-5 py-3 text-xs uppercase font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'fleet' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Car className="w-4 h-4" /> Fleet Logistics
        </button>

        <button 
          onClick={() => setActiveTab('stationery')} 
          className={`px-5 py-3 text-xs uppercase font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'stationery' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Package className="w-4 h-4" /> Stationery Orders
        </button>

        <button 
          onClick={() => setActiveTab('checklists')} 
          className={`px-5 py-3 text-xs uppercase font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'checklists' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" /> Checklist Config
        </button>
      </div>

      {activeTab === 'events' && <EventsManager />}
      {activeTab === 'fleet' && <FleetEngine />}
      {activeTab === 'stationery' && <StationeryDispatcher />}
      {activeTab === 'checklists' && <StandardAssetsManager />}
    </div>
  );
}