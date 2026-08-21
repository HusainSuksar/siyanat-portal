import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Key, LogOut, CheckCircle } from 'lucide-react';

export default function ForcePasswordChange({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // If no user is logged in, render nothing (Login screen handles this)
  if (!user) return <>{children}</>;

  // Check if they have the secure flag in their metadata
  const hasChangedPassword = user.user_metadata?.password_changed === true;

  // If they have changed it, render the application normally
  if (hasChangedPassword) {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword === '786110') {
      return setError('Your new password cannot be the default 786110.');
    }
    if (newPassword.length < 6) {
      return setError('Password must be at least 6 characters long.');
    }
    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    setLoading(true);
    try {
      // Updates both the password AND the metadata flag in one atomic call
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { password_changed: true }
      });

      if (updateError) throw updateError;

      setSuccess(true);
      
      // Force logout after 2 seconds to make them log back in
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.reload();
      }, 2000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  // --- THE BLOCKER UI ---
  return (
    <div className="fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-500">
        
        {success ? (
          <div className="text-center space-y-4 py-8">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-black text-slate-800">Password Secured!</h2>
            <p className="text-sm font-bold text-slate-500">Logging you out to re-authenticate...</p>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>
            
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Security Action Required</h2>
              <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-widest leading-relaxed">
                You are currently using the default system password. You must secure your account to proceed.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold mb-6 text-center border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest">New Password</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input required type="password" placeholder="Enter new password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-maroon transition shadow-sm" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest">Confirm Password</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input required type="password" placeholder="Re-type new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-maroon transition shadow-sm" />
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button type="submit" disabled={loading} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition disabled:opacity-50">
                  {loading ? 'Securing Account...' : 'Update & Continue'}
                </button>
                <button type="button" onClick={handleLogout} className="w-full py-3 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-black text-xs uppercase tracking-widest rounded-xl border border-slate-200 transition flex items-center justify-center gap-2">
                  <LogOut className="w-4 h-4" /> Cancel & Logout
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}