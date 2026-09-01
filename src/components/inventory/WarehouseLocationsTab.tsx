import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin, Edit, Trash2, X } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface Props {
  locations: any[];
  role: string | undefined;
  onRefresh: () => void;
}

export default function WarehouseLocationsTab({ locations, role, onRefresh }: Props) {
  const { showToast } = useToast();
  const [newLocName, setNewLocName] = useState('');
  const [newLocDesc, setNewLocDesc] = useState('');
  const [newLocDept, setNewLocDept] = useState('SIYANAT_HEAD');
  const [editingLoc, setEditingLoc] = useState<any>(null);

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) return;
    const dept = role?.includes('_HEAD') ? role : newLocDept;

    const { error } = await supabase.from('warehouse_locations').insert({
      name: newLocName.trim(),
      description: newLocDesc.trim() || null,
      department: dept,
      is_active: true
    });

    if (!error) {
      showToast('Warehouse location created!', 'success');
      setNewLocName('');
      setNewLocDesc('');
      onRefresh();
    } else {
      showToast('Error: ' + error.message, 'error');
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLoc || !editingLoc.name.trim()) return;

    const { error } = await supabase.from('warehouse_locations').update({
      name: editingLoc.name.trim(),
      description: editingLoc.description?.trim() || null
    }).eq('id', editingLoc.id);

    if (!error) {
      showToast('Location updated successfully!', 'success');
      setEditingLoc(null);
      onRefresh();
    } else {
      showToast('Error: ' + error.message, 'error');
    }
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    if (!confirm(`Delete location "${name}"? Existing inventory will remain intact.`)) return;

    const { error } = await supabase.from('warehouse_locations').delete().eq('id', id);
    if (!error) {
      showToast('Location deleted.', 'success');
      onRefresh();
    } else {
      showToast('Error: ' + error.message, 'error');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200 space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Manage Warehouse & Storage Locations</h3>
        <p className="text-xs font-bold text-slate-400 mt-1">Configure storage locations, sheds, and rooms available for inventory tagging.</p>
      </div>

      <form onSubmit={handleAddLocation} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
        <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Register New Location / Storage Area</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Location Name *</label>
            <input required type="text" placeholder="e.g. Electrical Shed Rack B" value={newLocName} onChange={e => setNewLocName(e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Description / Notes</label>
            <input type="text" placeholder="e.g. Near Workshop Area" value={newLocDesc} onChange={e => setNewLocDesc(e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none" />
          </div>
          {role === 'SUPER_ADMIN' || role === 'ADMIN' ? (
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Department</label>
              <select value={newLocDept} onChange={e => setNewLocDept(e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none">
                <option value="SIYANAT_HEAD">Siyanat</option>
                <option value="TANZEEM_HEAD">Tanzeem</option>
                <option value="AVIT_HEAD">AVIT</option>
              </select>
            </div>
          ) : (
            <div className="flex items-end">
              <span className="text-[11px] font-bold text-slate-400">Tagged to: <strong className="text-brand-maroon">{role?.replace('_HEAD', '')}</strong></span>
            </div>
          )}
        </div>
        <button type="submit" className="px-6 py-3 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition">
          Create Location
        </button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {locations.map(loc => (
          <div key={loc.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex justify-between items-start shadow-sm hover:border-slate-300 transition">
            <div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-maroon shrink-0" />
                <h5 className="font-bold text-slate-800 text-sm">{loc.name}</h5>
              </div>
              {loc.description && <p className="text-[10px] text-slate-500 mt-1 font-medium">{loc.description}</p>}
              <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-widest mt-2 inline-block">
                {loc.department.replace('_HEAD', '')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setEditingLoc(loc)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition" title="Edit Name">
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDeleteLocation(loc.id, loc.name)} className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition" title="Delete Location">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingLoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase">Edit Location Name</h3>
              <button onClick={() => setEditingLoc(null)}><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            <form onSubmit={handleUpdateLocation} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Location Name *</label>
                <input type="text" required value={editingLoc.name} onChange={e => setEditingLoc({...editingLoc, name: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description</label>
                <input type="text" value={editingLoc.description || ''} onChange={e => setEditingLoc({...editingLoc, description: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold outline-none" />
              </div>
              <button type="submit" className="w-full py-3 bg-brand-maroon text-white font-bold text-xs uppercase tracking-wide rounded-xl shadow-lg">
                Update Location
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}