import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Truck, Package, Wrench } from 'lucide-react';
import MaterialDispatch from '../components/siyanat/MaterialDispatch';
import MaintenanceRouting from '../components/siyanat/MaintenanceRouting';

export default function SiyanatOperations() {
  const [activeTab, setActiveTab] = useState<'materials' | 'maintenance'>('materials');
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (data) setUserRole(data.role);
      }
    });
  }, []);

  return (
    <div className="space-y-6 pb-24 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="bg-brand-maroon/10 p-3 rounded-2xl"><Truck className="w-8 h-8 text-brand-maroon" /></div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Operations Control</h2>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">Manage material dispatches, vendor POs, and routing.</p>
          </div>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button onClick={() => setActiveTab('materials')} className={`px-5 py-3 text-xs uppercase font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'materials' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Package className="w-4 h-4" /> Material Dispatch
        </button>
        <button onClick={() => setActiveTab('maintenance')} className={`px-5 py-3 text-xs uppercase font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'maintenance' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Wrench className="w-4 h-4" /> Maintenance Routing
        </button>
      </div>

      {activeTab === 'materials' && <MaterialDispatch userRole={userRole} />}
      {activeTab === 'maintenance' && <MaintenanceRouting userRole={userRole} />}
    </div>
  );
}