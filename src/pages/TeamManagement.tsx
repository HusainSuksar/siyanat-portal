import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Shield, UserCog, Edit, Trash2, X, Save, UserPlus } from 'lucide-react';

export default function TeamManagement() {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Modal States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: '', email: '', department: '', its_number: '', role: 'REQUESTER', zone: '', trade: ''
  });

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

  // --- ADD NEW MEMBER LOGIC ---
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('new-user');

    try {
      // 1. Create the user in Supabase Auth with the requested default password
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: '786110', // Default password per instruction
        options: {
          data: {
            full_name: newUser.full_name,
          }
        }
      });

      if (authError) throw authError;

      // 2. Wait a moment for Supabase triggers to create the profile row, then update it
      if (authData.user) {
        const payload = {
          full_name: newUser.full_name,
          department: newUser.department,
          its_number: newUser.its_number,
          role: newUser.role,
          zone: newUser.role === 'SUPERVISOR' ? newUser.zone : null,
          trade: newUser.role === 'TECHNICIAN' ? newUser.trade : null,
        };

        // Retry logic to ensure the trigger has finished
        let attempts = 0;
        let updateSuccess = false;
        while (attempts < 3 && !updateSuccess) {
          const { error: updateError } = await supabase.from('profiles').update(payload).eq('id', authData.user.id);
          if (!updateError) {
            updateSuccess = true;
          } else {
            attempts++;
            await new Promise(res => setTimeout(res, 500)); // wait half a second
          }
        }

        if (!updateSuccess) throw new Error("Could not apply profile data after account creation.");

        // 3. Log the action
        const { data: adminData } = await supabase.auth.getUser();
        await supabase.from('system_logs').insert({
          action_type: 'USER_CREATED',
          description: `Admin created new team member: ${newUser.full_name} (${newUser.role}).`,
          user_email: adminData.user?.email || 'System Admin'
        });

        alert(`Team member added successfully!\n\nEmail: ${newUser.email}\nDefault Password: 786110`);
        setAddModalOpen(false);
        setNewUser({ full_name: '', email: '', department: '', its_number: '', role: 'REQUESTER', zone: '', trade: '' });
        fetchTeam();
      }
    } catch (err: any) {
      alert("Error adding user: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // --- EDIT & DELETE LOGIC ---
  const openEditModal = (user: any) => {
    setEditingUser({ ...user });
    setEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setProcessingId(editingUser.id);

    const payload = {
      full_name: editingUser.full_name,
      department: editingUser.department,
      its_number: editingUser.its_number,
      role: editingUser.role,
      zone: editingUser.role === 'SUPERVISOR' ? editingUser.zone : null,
      trade: editingUser.role === 'TECHNICIAN' ? editingUser.trade : null,
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
      alert("Error updating user. " + error.message);
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
      alert("Cannot delete user. They likely have existing complaints or work orders tied to their account. Demote them to 'REQUESTER' instead.");
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
          <p className="text-xs text-slate-500 mt-1">Manage personnel, assign trades/zones, and control portal access levels.</p>
        </div>
        <button 
          onClick={() => setAddModalOpen(true)}
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
                <th className="p-3">Department & ITS</th>
                <th className="p-3">Role Context</th>
                <th className="p-3 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={4} className="p-6 text-center text-slate-500 font-medium animate-pulse">Loading personnel data...</td></tr>
              ) : team.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-slate-500 font-medium italic">No users found.</td></tr>
              ) : (
                team.map((user) => {
                  const isAdmin = user.role === 'ADMIN';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{user.full_name || 'Unknown User'}</div>
                        <div className="text-[10px] text-slate-500">{user.email}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-600">{user.department || 'Unassigned'}</div>
                        {user.its_number && <div className="text-[10px] text-brand-gold font-bold">ITS: {user.its_number}</div>}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold flex items-center w-max space-x-1 ${
                            isAdmin ? 'bg-brand-maroon text-brand-gold' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {isAdmin && <Shield className="w-3 h-3" />}
                            <span>{user.role}</span>
                          </span>
                          {user.role === 'SUPERVISOR' && user.zone && (
                            <span className="text-[9px] font-bold text-indigo-600 uppercase bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Zone: {user.zone}</span>
                          )}
                          {user.role === 'TECHNICIAN' && user.trade && (
                            <span className="text-[9px] font-bold text-emerald-600 uppercase bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Trade: {user.trade}</span>
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

      {/* --- ADD NEW MEMBER MODAL --- */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-brand-maroon p-4 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase">Register New Team Member</h3>
              <button onClick={() => setAddModalOpen(false)}><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            
            <form onSubmit={handleAddUser} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-[10px] text-amber-800 font-bold mb-4">
                Note: The user will be created with the default password <span className="bg-amber-200 px-1 rounded">786110</span>. They can use this to login immediately.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                  <input required type="text" value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"/>
                </div>
                
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Email Address (Login ID) *</label>
                  <input required type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"/>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Department</label>
                  <input type="text" value={newUser.department} onChange={e => setNewUser({...newUser, department: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"/>
                </div>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">ITS Number</label>
                  <input type="text" value={newUser.its_number} onChange={e => setNewUser({...newUser, its_number: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"/>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-brand-maroon" /> System Role *
                </label>
                <select 
                  required
                  value={newUser.role} 
                  onChange={e => setNewUser({...newUser, role: e.target.value})} 
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
                >
                  <option value="REQUESTER">Standard Requester</option>
                  <option value="SUPERVISOR">Zone Supervisor</option>
                  <option value="TECHNICIAN">Technician</option>
                  <option value="ADMIN">System Administrator</option>
                </select>
              </div>

              {newUser.role === 'SUPERVISOR' && (
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  <label className="block text-[11px] font-bold text-indigo-900 uppercase mb-1">Assigned Zone *</label>
                  <select required value={newUser.zone} onChange={e => setNewUser({...newUser, zone: e.target.value})} className="w-full p-2 border border-indigo-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="" disabled>-- Select Zone --</option>
                    <option value="Main Jamea Complex">Main Jamea Complex</option>
                    <option value="Rabwat">Rabwat</option>
                    <option value="Masakin">Masakin</option>
                    <option value="Mawaid">Mawaid</option>
                  </select>
                </div>
              )}

              {newUser.role === 'TECHNICIAN' && (
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <label className="block text-[11px] font-bold text-emerald-900 uppercase mb-1">Technician Trade *</label>
                  <select required value={newUser.trade} onChange={e => setNewUser({...newUser, trade: e.target.value})} className="w-full p-2 border border-emerald-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="" disabled>-- Select Trade --</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Carpentry">Carpentry</option>
                    <option value="Civil">Civil</option>
                    <option value="HVAC / AC">HVAC / AC</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="General">General</option>
                  </select>
                </div>
              )}

              <button 
                type="submit" 
                disabled={processingId === 'new-user'}
                className="w-full py-3 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processingId === 'new-user' ? 'Creating Account...' : <><UserPlus className="w-4 h-4" /> Register User</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT USER MODAL --- */}
      {editModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase">Edit Profile: {editingUser.full_name}</h3>
              <button onClick={() => setEditModalOpen(false)}><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Full Name</label>
                  <input type="text" value={editingUser.full_name || ''} onChange={e => setEditingUser({...editingUser, full_name: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"/>
                </div>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Department</label>
                  <input type="text" value={editingUser.department || ''} onChange={e => setEditingUser({...editingUser, department: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"/>
                </div>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">ITS Number</label>
                  <input type="text" value={editingUser.its_number || ''} onChange={e => setEditingUser({...editingUser, its_number: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"/>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-brand-maroon" /> System Role
                </label>
                <select 
                  value={editingUser.role} 
                  onChange={e => setEditingUser({...editingUser, role: e.target.value})} 
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
                >
                  <option value="REQUESTER">Standard Requester</option>
                  <option value="SUPERVISOR">Zone Supervisor</option>
                  <option value="TECHNICIAN">Technician</option>
                  <option value="ADMIN">System Administrator</option>
                </select>
              </div>

              {/* Conditional Field: Zone for Supervisors */}
              {editingUser.role === 'SUPERVISOR' && (
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  <label className="block text-[11px] font-bold text-indigo-900 uppercase mb-1">Assigned Zone *</label>
                  <select required value={editingUser.zone || ''} onChange={e => setEditingUser({...editingUser, zone: e.target.value})} className="w-full p-2 border border-indigo-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="" disabled>-- Select Zone --</option>
                    <option value="Main Jamea Complex">Main Jamea Complex</option>
                    <option value="Rabwat">Rabwat</option>
                    <option value="Masakin">Masakin</option>
                    <option value="Mawaid">Mawaid</option>
                  </select>
                </div>
              )}

              {/* Conditional Field: Trade for Technicians */}
              {editingUser.role === 'TECHNICIAN' && (
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <label className="block text-[11px] font-bold text-emerald-900 uppercase mb-1">Technician Trade *</label>
                  <select required value={editingUser.trade || ''} onChange={e => setEditingUser({...editingUser, trade: e.target.value})} className="w-full p-2 border border-emerald-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="" disabled>-- Select Trade --</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Carpentry">Carpentry</option>
                    <option value="Civil">Civil</option>
                    <option value="HVAC / AC">HVAC / AC</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="General">General</option>
                  </select>
                </div>
              )}

              <button 
                type="submit" 
                disabled={processingId === editingUser.id}
                className="w-full py-3 mt-4 bg-slate-900 hover:bg-black text-white font-extrabold text-xs uppercase rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Profile Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}