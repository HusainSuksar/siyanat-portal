import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Shield, UserCog, Edit, Trash2, X, Save, UserPlus, Phone } from 'lucide-react';

const AVAILABLE_ZONES = [
  "Main Jamea Complex",
  "Rabwat (Girls Hostel)",
  "Masakin (Boys Hostel)",
  "Mawaid",
  "Khaimat al-Riyadat"
];

const AVAILABLE_TRADES = [
  "Plumbing", "Electrical", "Carpentry", "Civil", "HVAC", "Housekeeping", "Cleaning", "General"
];

export default function TeamManagement() {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Modal States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: '', 
    email: '', 
    phone_number: '',
    department: '', 
    its_number: '', 
    role: 'REQUESTER', 
    zone: '', 
    trade: ''
  });

  // Multi-Select States
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('role', { ascending: true })
      .order('full_name', { ascending: true });

    if (data && !error) setTeam(data);
    setLoading(false);
  };

  // --- MULTI-SELECT HELPERS ---
  const toggleZone = (zone: string) => {
    setSelectedZones(prev => prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]);
  };

  const toggleTrade = (trade: string) => {
    setSelectedTrades(prev => prev.includes(trade) ? prev.filter(t => t !== trade) : [...prev, trade]);
  };

  // --- ADD NEW MEMBER LOGIC ---
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('new-user');

    const cleanEmail = newUser.email.trim().toLowerCase();
    const cleanPassword = '786110'; 

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: { data: { full_name: newUser.full_name } }
      });

      if (authError) throw authError;

      if (authData.user) {
        const zoneString = newUser.role === 'SUPERVISOR' ? selectedZones.join(', ') : null;
        const tradeString = newUser.role === 'EXECUTOR' ? selectedTrades.join(', ') : null;

        const payload = {
          id: authData.user.id,
          full_name: newUser.full_name,
          phone_number: newUser.phone_number.trim() || null,
          department: newUser.department,
          its_number: newUser.its_number || null,
          role: newUser.role,
          zone: zoneString,
          trade: tradeString,
        };

        const { error: profileError } = await supabase.from('profiles').upsert(payload);
        if (profileError) throw profileError;

        const { data: adminData } = await supabase.auth.getUser();
        await supabase.from('system_logs').insert({
          action_type: 'USER_CREATED',
          description: `Admin registered new user: ${newUser.full_name} (${cleanEmail}) as ${newUser.role}.`,
          user_email: adminData?.user?.email || 'System Admin'
        });

        alert(`User Registered Successfully!\n\nEmail: ${cleanEmail}\nPassword: ${cleanPassword}`);
        setAddModalOpen(false);
        setNewUser({ full_name: '', email: '', phone_number: '', department: '', its_number: '', role: 'REQUESTER', zone: '', trade: '' });
        setSelectedZones([]); setSelectedTrades([]);
        fetchTeam();
      }
    } catch (err: any) {
      alert("Registration Error: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // --- EDIT LOGIC ---
  const openEditModal = (user: any) => {
    setEditingUser({ ...user });
    
    if (user.role === 'SUPERVISOR' && user.zone) {
      setSelectedZones(user.zone.split(',').map((s: string) => s.trim()));
    } else {
      setSelectedZones([]);
    }

    if (user.role === 'EXECUTOR' && user.trade) {
      setSelectedTrades(user.trade.split(',').map((s: string) => s.trim()));
    } else {
      setSelectedTrades([]);
    }

    setEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setProcessingId(editingUser.id);

    const zoneString = editingUser.role === 'SUPERVISOR' ? selectedZones.join(', ') : null;
    const tradeString = editingUser.role === 'EXECUTOR' ? selectedTrades.join(', ') : null;

    const payload = {
      full_name: editingUser.full_name,
      phone_number: editingUser.phone_number ? editingUser.phone_number.trim() : null,
      department: editingUser.department,
      its_number: editingUser.its_number,
      role: editingUser.role,
      zone: zoneString,
      trade: tradeString,
    };

    const { error } = await supabase.from('profiles').update(payload).eq('id', editingUser.id);

    if (!error) {
      const { data: authData } = await supabase.auth.getUser();
      await supabase.from('system_logs').insert({
        action_type: 'PROFILE_UPDATED',
        description: `Admin updated profile for ${editingUser.full_name}. Role set to ${editingUser.role}.`,
        user_email: authData.user?.email || 'System Admin'
      });
      
      alert('User profile updated successfully!');
      setEditModalOpen(false);
      fetchTeam();
    } else {
      alert("Error updating user: " + error.message);
    }
    setProcessingId(null);
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`CRITICAL WARNING: Are you sure you want to completely delete ${name} from the portal? This cannot be undone.`)) return;
    
    setProcessingId(id);
    const { error } = await supabase.from('profiles').delete().eq('id', id);

    if (!error) {
      const { data: authData } = await supabase.auth.getUser();
      await supabase.from('system_logs').insert({
        action_type: 'USER_DELETED',
        description: `Admin deleted the profile of ${name}.`,
        user_email: authData.user?.email || 'System Admin'
      });
      
      alert('User deleted successfully.');
      fetchTeam();
    } else {
      alert("Cannot delete user. They likely have existing data tied to their account. Demote them to 'REQUESTER' instead.");
    }
    setProcessingId(null);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-brand-maroon flex items-center gap-2">
            <Users className="w-6 h-6" />
            Team & Access Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">Manage personnel, WhatsApp contact numbers, and access levels.</p>
        </div>
        <button 
          onClick={() => {
            setNewUser({ full_name: '', email: '', phone_number: '', department: '', its_number: '', role: 'REQUESTER', zone: '', trade: '' });
            setSelectedZones([]); setSelectedTrades([]);
            setAddModalOpen(true);
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition flex items-center space-x-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Member</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center space-x-2 border-b pb-3">
          <UserCog className="w-4 h-4 text-brand-maroon" />
          <h3 className="font-extrabold text-sm uppercase text-slate-800">Active Personnel Roster</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="p-3">Personnel Details</th>
                <th className="p-3">Contact Details</th>
                <th className="p-3">Department & ITS</th>
                <th className="p-3">Role Context</th>
                <th className="p-3 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500 font-medium animate-pulse">Loading personnel data...</td></tr>
              ) : team.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500 font-medium italic">No users found.</td></tr>
              ) : (
                team.map((user) => {
                  const isAdmin = user.role === 'SUPER_ADMIN';
                  const isHead = user.role.includes('_HEAD');
                  const isReceptionist = user.role === 'RECEPTIONIST';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{user.full_name || 'Unknown User'}</div>
                        <div className="text-[10px] text-slate-500">{user.email}</div>
                      </td>
                      <td className="p-3">
                        {user.phone_number ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Phone className="w-3 h-3" /> {user.phone_number}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-medium">No Phone</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-600">{user.department || 'Unassigned'}</div>
                        {user.its_number && <div className="text-[10px] text-brand-gold font-bold">ITS: {user.its_number}</div>}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold flex items-center w-max space-x-1 ${
                            isAdmin ? 'bg-brand-maroon text-brand-gold' : isHead ? 'bg-indigo-100 text-indigo-800' : isReceptionist ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {(isAdmin || isHead) && <Shield className="w-3 h-3" />}
                            <span>{user.role.replace('_', ' ')}</span>
                          </span>
                          {user.role === 'SUPERVISOR' && user.zone && (
                            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Zone: {user.zone}</span>
                          )}
                          {user.role === 'EXECUTOR' && user.trade && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Trade: {user.trade}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openEditModal(user)}
                            disabled={processingId === user.id}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition disabled:opacity-50"
                            title="Edit User"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id, user.full_name)}
                            disabled={processingId === user.id}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition disabled:opacity-50"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD / EDIT USER MODAL --- */}
      {(addModalOpen || editModalOpen) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className={addModalOpen ? "bg-brand-maroon p-4 flex justify-between items-center text-white" : "bg-slate-800 p-4 flex justify-between items-center text-white"}>
              <h3 className="font-extrabold text-sm uppercase">{addModalOpen ? 'Register New Team Member' : `Edit Profile: ${editingUser?.full_name}`}</h3>
              <button onClick={() => { setAddModalOpen(false); setEditModalOpen(false); }}><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            
            <form onSubmit={addModalOpen ? handleAddUser : handleUpdateUser} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {addModalOpen && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-[10px] text-amber-800 font-bold mb-4">
                  Note: The user will be created with the default password <span className="bg-amber-200 px-1 rounded">786110</span>.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                  <input required type="text" value={addModalOpen ? newUser.full_name : editingUser.full_name} onChange={e => addModalOpen ? setNewUser({...newUser, full_name: e.target.value}) : setEditingUser({...editingUser, full_name: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"/>
                </div>
                
                {addModalOpen && (
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Email Address (Login ID) *</label>
                    <input required type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"/>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" /> WhatsApp / Contact Phone Number
                  </label>
                  <input 
                    type="tel" 
                    placeholder="e.g. +91 98765 43210"
                    value={addModalOpen ? newUser.phone_number : editingUser.phone_number || ''} 
                    onChange={e => addModalOpen ? setNewUser({...newUser, phone_number: e.target.value}) : setEditingUser({...editingUser, phone_number: e.target.value})} 
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"
                  />
                  <p className="text-[9px] text-slate-400 mt-0.5">Required for instant WhatsApp maintenance dispatches.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Department</label>
                  <input type="text" value={addModalOpen ? newUser.department : editingUser.department || ''} onChange={e => addModalOpen ? setNewUser({...newUser, department: e.target.value}) : setEditingUser({...editingUser, department: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"/>
                </div>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">ITS Number</label>
                  <input type="text" value={addModalOpen ? newUser.its_number : editingUser.its_number || ''} onChange={e => addModalOpen ? setNewUser({...newUser, its_number: e.target.value}) : setEditingUser({...editingUser, its_number: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"/>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-brand-maroon" /> System Role *
                </label>
                <select 
                  required
                  value={addModalOpen ? newUser.role : editingUser.role} 
                  onChange={e => {
                    const r = e.target.value;
                    addModalOpen ? setNewUser({...newUser, role: r}) : setEditingUser({...editingUser, role: r});
                    setSelectedZones([]); setSelectedTrades([]);
                  }} 
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
                >
                  <option value="REQUESTER">Standard Requester</option>
                  <option value="SUPERVISOR">Zone Supervisor</option>
                  <option value="EXECUTOR">Field Technician / Executor</option>
                  <option value="SIYANAT_HEAD">Siyanat Head</option>
                  <option value="TANZEEM_HEAD">Tanzeem Head</option>
                  <option value="AVIT_HEAD">AVIT Head</option>
                  <option value="RECEPTIONIST">Help Desk / Receptionist</option>
                  <option value="SUPER_ADMIN">System Administrator</option>
                </select>
              </div>

              {/* DYNAMIC MULTI-SELECT FOR SUPERVISORS */}
              {(addModalOpen ? newUser.role : editingUser.role) === 'SUPERVISOR' && (
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  <label className="block text-[11px] font-bold text-indigo-900 uppercase mb-2">Assign Zones (Select Multiple)</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {AVAILABLE_ZONES.map(zone => (
                      <label key={zone} className="flex items-center space-x-2 p-1 cursor-pointer hover:bg-indigo-100 rounded transition">
                        <input type="checkbox" checked={selectedZones.includes(zone)} onChange={() => toggleZone(zone)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                        <span className="text-xs font-bold text-indigo-900">{zone}</span>
                      </label>
                    ))}
                  </div>
                  {selectedZones.length === 0 && <p className="text-[9px] text-red-500 font-bold mt-2 uppercase">Please select at least one zone.</p>}
                </div>
              )}

              {/* DYNAMIC MULTI-SELECT FOR EXECUTORS (TECHNICIANS) */}
              {(addModalOpen ? newUser.role : editingUser.role) === 'EXECUTOR' && (
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <label className="block text-[11px] font-bold text-emerald-900 uppercase mb-2">Assign Trades (Select Multiple)</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {AVAILABLE_TRADES.map(trade => (
                      <label key={trade} className="flex items-center space-x-2 p-1 cursor-pointer hover:bg-emerald-100 rounded transition">
                        <input type="checkbox" checked={selectedTrades.includes(trade)} onChange={() => toggleTrade(trade)} className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500" />
                        <span className="text-xs font-bold text-emerald-900">{trade}</span>
                      </label>
                    ))}
                  </div>
                  {selectedTrades.length === 0 && <p className="text-[9px] text-red-500 font-bold mt-2 uppercase">Please select at least one trade.</p>}
                </div>
              )}

              <button 
                type="submit" 
                disabled={processingId === 'new-user' || processingId === editingUser?.id || ( ((addModalOpen ? newUser.role : editingUser?.role) === 'SUPERVISOR' && selectedZones.length === 0) || ((addModalOpen ? newUser.role : editingUser?.role) === 'EXECUTOR' && selectedTrades.length === 0) )}
                className={`w-full py-3 mt-4 text-white font-extrabold text-xs uppercase rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 ${addModalOpen ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-black'}`}
              >
                {addModalOpen ? <><UserPlus className="w-4 h-4" /> Register User</> : <><Save className="w-4 h-4" /> Save Profile Changes</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}