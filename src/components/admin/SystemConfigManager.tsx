import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import { Plus, Trash2, Users, Wrench, FolderTree, KeyRound } from 'lucide-react';

export default function SystemConfigManager() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'classes' | 'trades' | 'categories' | 'password'>('classes');
  const [classes, setClasses] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [defaultPassword, setDefaultPassword] = useState('786110');
  const [loading, setLoading] = useState(true);

  const [newClass, setNewClass] = useState({ name: '', male: 0, female: 0 });
  const [newTrade, setNewTrade] = useState('');
  const [newCat, setNewCat] = useState({ name: '', dept: 'SIYANAT_HEAD' });

  const fetchData = async () => {
    setLoading(true);
    const [c, t, cat, s] = await Promise.all([
      supabase.from('academic_classes').select('*').order('class_name'),
      supabase.from('technician_trades').select('*').order('trade_name'),
      supabase.from('inventory_categories').select('*').order('name'),
      supabase.from('system_settings').select('*').eq('key', 'default_user_password').maybeSingle()
    ]);
    if (c.data) setClasses(c.data);
    if (t.data) setTrades(t.data);
    if (cat.data) setCategories(cat.data);
    if (s.data && s.data.value) {
      setDefaultPassword(typeof s.data.value === 'string' ? s.data.value : String(s.data.value));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.name.trim()) return;
    const { error } = await supabase.from('academic_classes').insert({
      class_name: newClass.name.trim().toUpperCase(),
      male_count: newClass.male,
      female_count: newClass.female
    });
    if (!error) {
      showToast('Class added successfully', 'success');
      setNewClass({ name: '', male: 0, female: 0 });
      fetchData();
    } else {
      showToast(error.message, 'error');
    }
  };

  const deleteClass = async (id: string) => {
    if (!confirm('Delete this class?')) return;
    await supabase.from('academic_classes').delete().eq('id', id);
    fetchData();
  };

  const addTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrade.trim()) return;
    const { error } = await supabase.from('technician_trades').insert({ trade_name: newTrade.trim() });
    if (!error) {
      showToast('Trade added successfully', 'success');
      setNewTrade('');
      fetchData();
    } else {
      showToast(error.message, 'error');
    }
  };

  const deleteTrade = async (id: string) => {
    if (!confirm('Delete this trade?')) return;
    await supabase.from('technician_trades').delete().eq('id', id);
    fetchData();
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.name.trim()) return;
    const { error } = await supabase.from('inventory_categories').insert({
      name: newCat.name.trim(),
      department: newCat.dept
    });
    if (!error) {
      showToast('Category created', 'success');
      setNewCat({ name: '', dept: 'SIYANAT_HEAD' });
      fetchData();
    } else {
      showToast(error.message, 'error');
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    await supabase.from('inventory_categories').delete().eq('id', id);
    fetchData();
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defaultPassword.trim()) return;
    const { error } = await supabase.from('system_settings').upsert({
      key: 'default_user_password',
      value: defaultPassword.trim(),
      description: 'Default onboarding password'
    });
    if (!error) {
      showToast('Default onboarding password updated!', 'success');
    } else {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200 space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Dynamic System Configuration</h3>
        <p className="text-xs font-bold text-slate-400 mt-1">Manage classes, trades, inventory categories, and default credentials in real time.</p>
      </div>

      <div className="flex space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button onClick={() => setActiveTab('classes')} className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition whitespace-nowrap ${activeTab === 'classes' ? 'bg-brand-maroon text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
          <Users className="w-3.5 h-3.5 inline mr-1.5" /> Classes & Strength ({classes.length})
        </button>
        <button onClick={() => setActiveTab('trades')} className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition whitespace-nowrap ${activeTab === 'trades' ? 'bg-brand-maroon text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
          <Wrench className="w-3.5 h-3.5 inline mr-1.5" /> Technician Trades ({trades.length})
        </button>
        <button onClick={() => setActiveTab('categories')} className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition whitespace-nowrap ${activeTab === 'categories' ? 'bg-brand-maroon text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
          <FolderTree className="w-3.5 h-3.5 inline mr-1.5" /> Inventory Categories ({categories.length})
        </button>
        <button onClick={() => setActiveTab('password')} className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition whitespace-nowrap ${activeTab === 'password' ? 'bg-brand-maroon text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
          <KeyRound className="w-3.5 h-3.5 inline mr-1.5" /> Default Password
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs font-bold text-slate-400 animate-pulse">Loading system settings...</div>
      ) : (
        <>
          {activeTab === 'classes' && (
            <div className="space-y-4">
              <form onSubmit={addClass} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Class Code *</label>
                  <input required type="text" placeholder="e.g. 2AM, 3BF..." value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-brand-maroon" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Male Count</label>
                  <input type="number" min="0" value={newClass.male} onChange={e => setNewClass({...newClass, male: parseInt(e.target.value) || 0})} className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-center outline-none focus:ring-2 focus:ring-brand-maroon" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Female Count</label>
                  <input type="number" min="0" value={newClass.female} onChange={e => setNewClass({...newClass, female: parseInt(e.target.value) || 0})} className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-center outline-none focus:ring-2 focus:ring-brand-maroon" />
                </div>
                <button type="submit" className="py-2.5 bg-brand-maroon hover:bg-brand-dark text-brand-gold text-xs font-black uppercase rounded-xl shadow transition">
                  <Plus className="w-4 h-4 inline mr-1" /> Add Class
                </button>
              </form>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {classes.map(c => (
                  <div key={c.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-sm flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">{c.class_name}</h4>
                      <span className="text-[10px] text-slate-500 font-bold block mt-0.5">M: {c.male_count} | F: {c.female_count} (Total: {c.male_count + c.female_count})</span>
                    </div>
                    <button onClick={() => deleteClass(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete class">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'trades' && (
            <div className="space-y-4">
              <form onSubmit={addTrade} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex gap-3">
                <input required type="text" placeholder="e.g. Sound Engineer, Gardening, Fire Safety..." value={newTrade} onChange={e => setNewTrade(e.target.value)} className="flex-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon" />
                <button type="submit" className="px-5 py-2.5 bg-brand-maroon hover:bg-brand-dark text-brand-gold text-xs font-black uppercase rounded-xl shadow transition">
                  <Plus className="w-4 h-4 inline mr-1" /> Add Trade
                </button>
              </form>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {trades.map(t => (
                  <div key={t.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-sm flex justify-between items-center">
                    <span className="font-bold text-slate-800 text-xs">{t.trade_name}</span>
                    <button onClick={() => deleteTrade(t.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete trade">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-4">
              <form onSubmit={addCategory} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input required type="text" placeholder="e.g. Audio Visual Equipment..." value={newCat.name} onChange={e => setNewCat({...newCat, name: e.target.value})} className="p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon" />
                <select value={newCat.dept} onChange={e => setNewCat({...newCat, dept: e.target.value})} className="p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none">
                  <option value="SIYANAT_HEAD">Siyanat Operations</option>
                  <option value="TANZEEM_HEAD">Tanzeem Operations</option>
                  <option value="AVIT_HEAD">AVIT Operations</option>
                </select>
                <button type="submit" className="py-2.5 bg-brand-maroon hover:bg-brand-dark text-brand-gold text-xs font-black uppercase rounded-xl shadow transition">
                  <Plus className="w-4 h-4 inline mr-1" /> Add Category
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {categories.map(cat => (
                  <div key={cat.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-sm flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">{cat.name}</h4>
                      <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 mt-1 inline-block">{cat.department.replace('_HEAD', '')}</span>
                    </div>
                    <button onClick={() => deleteCategory(cat.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete category">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'password' && (
            <form onSubmit={updatePassword} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 max-w-md space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Default Onboarding Password</label>
                <input required type="text" value={defaultPassword} onChange={e => setDefaultPassword(e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon" />
                <p className="text-[10px] text-slate-400 font-semibold mt-1">This password is used during single or bulk CSV user provisioning.</p>
              </div>
              <button type="submit" className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase rounded-xl shadow transition">
                Update Default Password
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}