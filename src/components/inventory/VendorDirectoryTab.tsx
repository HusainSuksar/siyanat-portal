import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';

interface Props {
  vendors: any[];
  onRefresh: () => void;
}

export default function VendorDirectoryTab({ vendors, onRefresh }: Props) {
  const { showToast } = useToast();
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCategory, setNewVendorCategory] = useState('Electrical');
  const [newVendorContact, setNewVendorContact] = useState('');

  const handleAddVendor = async (e: FormEvent) => {
    e.preventDefault();
    if (!newVendorName.trim()) return;

    const { error } = await supabase.from('vendors').insert({
      name: newVendorName.trim(),
      category: newVendorCategory,
      contact_info: newVendorContact.trim() || null
    });

    if (!error) {
      setNewVendorName('');
      setNewVendorContact('');
      showToast("Vendor registered!", "success");
      onRefresh();
    } else {
      showToast("Error adding vendor: " + error.message, "error");
    }
  };

  const toggleVendorStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('vendors').update({ is_active: !currentStatus }).eq('id', id);
    onRefresh();
  };

  return (
    <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200 space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Manage Approved Vendors</h3>
        <p className="text-xs font-bold text-slate-400 mt-1">Add external suppliers used for purchase order generation.</p>
      </div>

      <form onSubmit={handleAddVendor} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
        <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Register New Vendor</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Vendor Name *</label>
            <input 
              required 
              type="text" 
              placeholder="e.g. Al-Saif Hardware" 
              value={newVendorName} 
              onChange={e => setNewVendorName(e.target.value)} 
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Category *</label>
            <select 
              value={newVendorCategory} 
              onChange={e => setNewVendorCategory(e.target.value)} 
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none"
            >
              <option value="Electrical">Electrical</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Carpentry">Carpentry</option>
              <option value="Civil">Civil</option>
              <option value="General">General / Stationery</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Contact Info</label>
            <input 
              type="text" 
              placeholder="Phone or email..." 
              value={newVendorContact} 
              onChange={e => setNewVendorContact(e.target.value)} 
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none" 
            />
          </div>
        </div>
        <button type="submit" className="px-6 py-3 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition">
          Register Vendor
        </button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {vendors.map(v => (
          <div key={v.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <h5 className="font-bold text-slate-800 text-sm">{v.name}</h5>
                <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${v.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                  {v.is_active ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Category: {v.category}</p>
              {v.contact_info && <p className="text-[10px] text-slate-400 mt-0.5">{v.contact_info}</p>}
            </div>
            <button 
              onClick={() => toggleVendorStatus(v.id, v.is_active)} 
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${v.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
            >
              {v.is_active ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}