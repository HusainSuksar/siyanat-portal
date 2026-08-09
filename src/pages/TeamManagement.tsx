import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Shield, UserCog,  } from 'lucide-react';

export default function TeamManagement() {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('role', { ascending: true }) // Group Admins first
      .order('full_name', { ascending: true });

    if (data && !error) setTeam(data);
    setLoading(false);
  };

  const updateRole = async (userId: string, currentName: string, newRole: string) => {
    if (!confirm(`Are you sure you want to change ${currentName}'s role to ${newRole}?`)) return;
    
    setSavingId(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (!error) {
      // Secretly log this action to the Global Audit Trail (God Mode)
      const { data: authData } = await supabase.auth.getUser();
      await supabase.from('system_logs').insert({
        action_type: 'ACCESS_CHANGE',
        description: `Modified access permissions for ${currentName}. New Role: ${newRole}`,
        user_email: authData.user?.email || 'System Admin'
      });
      
      fetchTeam();
    } else {
      alert("Error updating user role. Check database permissions.");
    }
    setSavingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-brand-maroon flex items-center gap-2">
            <Users className="w-6 h-6" />
            Team & Access Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">Manage personnel, assign departments, and control portal access levels.</p>
        </div>
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
                <th className="p-3">Full Name</th>
                <th className="p-3">Department</th>
                <th className="p-3">Current Role</th>
                <th className="p-3 text-right">Access Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500 font-medium animate-pulse">
                    Loading personnel data...
                  </td>
                </tr>
              ) : team.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500 font-medium italic">
                    No users found.
                  </td>
                </tr>
              ) : (
                team.map((user) => {
                  const isAdmin = user.role === 'ADMIN';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-800">{user.full_name || 'Unknown User'}</td>
                      <td className="p-3 font-semibold text-slate-600">{user.department || 'Unassigned'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold flex items-center w-max space-x-1 ${
                          isAdmin ? 'bg-brand-maroon text-brand-gold' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {isAdmin && <Shield className="w-3 h-3" />}
                          <span>{user.role}</span>
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <select 
                          value={user.role}
                          disabled={savingId === user.id}
                          onChange={(e) => updateRole(user.id, user.full_name, e.target.value)}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-brand-maroon outline-none ml-auto block disabled:opacity-50"
                        >
                          <option value="REQUESTER">Standard Requester</option>
                          <option value="ADMIN">System Administrator</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}