import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Server, Search, Wrench, Plus, AlertCircle, CheckCircle2, X } from 'lucide-react';

export default function AssetRegister() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [activeAsset, setActiveAsset] = useState<any>(null);

  // Form States
  const [newAsset, setNewAsset] = useState({ tag: '', name: '', category: 'HVAC', location: '' });
  const [serviceLog, setServiceLog] = useState({ desc: '', nextDate: '', status: 'Operational' });

  const fetchAssets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fixed_assets')
      .select('*')
      .order('asset_tag', { ascending: true });

    if (data && !error) setAssets(data);
    setLoading(false);
  };

  useEffect(() => { fetchAssets(); }, []);

  // --- ACTIONS ---
  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('fixed_assets').insert({
      asset_tag: newAsset.tag,
      name: newAsset.name,
      category: newAsset.category,
      location: newAsset.location,
      status: 'Operational',
      next_maintenance: new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString().split('T')[0] // Default 6 months
    });

    if (!error) {
      alert("Asset added successfully!");
      setIsAddOpen(false);
      setNewAsset({ tag: '', name: '', category: 'HVAC', location: '' });
      fetchAssets();
    } else {
      alert("Error adding asset. Tag might already exist.");
    }
  };

  const handleLogService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAsset) return;

    const { data: userData } = await supabase.auth.getUser();
    
    // 1. Insert Log
    await supabase.from('asset_maintenance_logs').insert({
      asset_id: activeAsset.id,
      technician_id: userData.user?.id,
      description: serviceLog.desc
    });

    // 2. Update Asset Status & Dates
    await supabase.from('fixed_assets').update({
      status: serviceLog.status,
      last_maintenance: new Date().toISOString().split('T')[0],
      next_maintenance: serviceLog.nextDate
    }).eq('id', activeAsset.id);

    alert("Service logged successfully!");
    setIsServiceOpen(false);
    setServiceLog({ desc: '', nextDate: '', status: 'Operational' });
    fetchAssets();
  };

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.asset_tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-brand-maroon flex items-center gap-2">
            <Server className="w-6 h-6" />
            Fixed Asset Register
          </h2>
          <p className="text-xs text-slate-500 mt-1">Track machinery, equipment statuses, and scheduled maintenance.</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2.5 bg-brand-maroon hover:bg-brand-dark text-white font-bold rounded-lg text-xs shadow-md transition flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Asset</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
          <h3 className="font-extrabold text-sm uppercase text-slate-800">Equipment Directory</h3>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="Search by tag, name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-brand-maroon outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="p-3">Asset Tag</th>
                <th className="p-3">Equipment Name</th>
                <th className="p-3">Location</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Next Maint.</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-500 font-medium animate-pulse">Loading assets...</td></tr>
              ) : filteredAssets.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-500 font-medium italic">No assets found.</td></tr>
              ) : (
                filteredAssets.map(asset => {
                  const isUnderRepair = asset.status === 'Under Repair';
                  const isOverdue = new Date(asset.next_maintenance) < new Date();

                  return (
                    <tr key={asset.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-black text-brand-maroon tracking-wide">{asset.asset_tag}</td>
                      <td className="p-3 font-bold text-slate-800">
                        {asset.name}
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{asset.category}</div>
                      </td>
                      <td className="p-3 text-slate-600 font-medium">{asset.location}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold flex items-center w-max space-x-1 ${isUnderRepair ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {isUnderRepair ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          <span>{asset.status}</span>
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`font-bold ${isOverdue ? 'text-red-600' : 'text-slate-600'}`}>
                          {new Date(asset.next_maintenance).toLocaleDateString()}
                        </span>
                        {isOverdue && <div className="text-[9px] text-red-500 font-extrabold uppercase mt-0.5">Overdue</div>}
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => {
                            setActiveAsset(asset);
                            setServiceLog({ ...serviceLog, status: asset.status });
                            setIsServiceOpen(true);
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-[11px] shadow-sm transition flex items-center space-x-1 ml-auto"
                        >
                          <Wrench className="w-3 h-3" />
                          <span className="hidden sm:inline">Log Service</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD ASSET MODAL --- */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-brand-maroon p-4 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase text-brand-gold">Add New Fixed Asset</h3>
              <button onClick={() => setIsAddOpen(false)}><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            <form onSubmit={handleAddAsset} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Asset Tag (e.g. HVAC-005) *</label>
                <input required type="text" value={newAsset.tag} onChange={e => setNewAsset({...newAsset, tag: e.target.value})} className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-maroon"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Equipment Name *</label>
                <input required type="text" value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-maroon"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category</label>
                  <select value={newAsset.category} onChange={e => setNewAsset({...newAsset, category: e.target.value})} className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-maroon">
                    <option>HVAC</option><option>Electrical</option><option>Mechanical</option><option>Plumbing</option><option>IT / Network</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Location *</label>
                  <input required type="text" value={newAsset.location} onChange={e => setNewAsset({...newAsset, location: e.target.value})} className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-maroon"/>
                </div>
              </div>
              <button type="submit" className="w-full py-3 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl">Save Asset</button>
            </form>
          </div>
        </div>
      )}

      {/* --- LOG SERVICE MODAL --- */}
      {isServiceOpen && activeAsset && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase">Log Maintenance: {activeAsset.asset_tag}</h3>
              <button onClick={() => setIsServiceOpen(false)}><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            <form onSubmit={handleLogService} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Work Done / Description *</label>
                <textarea required rows={3} value={serviceLog.desc} onChange={e => setServiceLog({...serviceLog, desc: e.target.value})} className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-800" placeholder="e.g. Replaced fan belt and refilled coolant..."></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">New Asset Status</label>
                  <select value={serviceLog.status} onChange={e => setServiceLog({...serviceLog, status: e.target.value})} className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-800">
                    <option>Operational</option><option>Under Repair</option><option>Decommissioned</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Next Maint. Date *</label>
                  <input required type="date" value={serviceLog.nextDate} onChange={e => setServiceLog({...serviceLog, nextDate: e.target.value})} className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-800"/>
                </div>
              </div>
              <button type="submit" className="w-full py-3 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase rounded-xl">Submit Service Log</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}