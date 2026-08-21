import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { User, Shield, Building, MapPin, Key, Wrench, Send } from 'lucide-react';

export default function UserProfile() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingAuth, setUpdatingAuth] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return showToast('Password must be at least 6 characters.', 'warning');
    if (newPassword !== confirmPassword) return showToast('Passwords do not match.', 'error');

    setUpdatingAuth(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      showToast('Password updated successfully!', 'success');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setUpdatingAuth(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Loading profile...</div>;
  if (!profile) return <div className="p-8 text-center text-red-500 font-bold">Profile not found.</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-4 bg-brand-maroon p-6 rounded-3xl text-white shadow-lg">
        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
          <User className="w-8 h-8 text-brand-gold" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">{profile.full_name}</h2>
          <p className="text-sm font-bold text-brand-gold mt-1">{user?.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* --- IDENTITY CARDS --- */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-5">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-3">Official Identity</h3>
          
          <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <Shield className="w-5 h-5 text-indigo-500" />
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">System Role</p>
              <p className="text-sm font-bold text-slate-800">{profile.role.replace('_', ' ')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <Building className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Department</p>
              <p className="text-sm font-bold text-slate-800">{profile.department}</p>
            </div>
          </div>

          {profile.zone && (
            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <MapPin className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Assigned Zone</p>
                <p className="text-sm font-bold text-slate-800">{profile.zone}</p>
              </div>
            </div>
          )}

          {profile.trade && (
            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Wrench className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Technician Trade</p>
                <p className="text-sm font-bold text-slate-800">{profile.trade}</p>
              </div>
            </div>
          )}
        </div>

        {/* --- SECURITY / PASSWORD --- */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-3 mb-5">Account Security</h3>
          
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">New Password</label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input required type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-maroon transition shadow-sm" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Confirm New Password</label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input required type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-maroon transition shadow-sm" />
              </div>
            </div>

            <button type="submit" disabled={updatingAuth || !newPassword} className="w-full py-4 mt-2 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50">
              <Send className="w-4 h-4" /> {updatingAuth ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}