import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative bg-brand">
      {/* Background Image Layer with Opacity */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-30 mix-blend-overlay"
        style={{ backgroundImage: "url('/BG_img.jpeg')" }}
      />
      
      {/* Login Card */}
      <div className="relative z-10 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 md:p-8 max-w-md w-full border-2 border-brand-gold/40 text-center">
        
        <div className="inline-block bg-amber-50 text-amber-900 text-[10px] font-extrabold px-3 py-1 rounded-full border border-amber-200 tracking-widest uppercase mb-6">
          Al Jamea tus Saifiyah, Siddhpur
        </div>
        
        {/* New Big Logo Image */}
        <div className="flex justify-center mb-4">
          <img 
            src="/login_card_img.jpeg" 
            alt="Tanzeem and Siyanat Offices" 
            className="w-full max-w-[340px] h-auto object-contain drop-shadow-sm"
          />
        </div>
        
        <p className="text-xs text-slate-500 mb-6 font-semibold uppercase tracking-wider">
          Material Requisition & Management System
        </p>
        
        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Email Address</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-maroon focus:outline-none"
              placeholder="e.g. electrical@jameasaifiyah.edu"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-maroon focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-700 text-center">
              {errorMsg}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 mt-2 bg-brand-maroon hover:bg-brand-dark text-white font-bold rounded-lg shadow-lg transition disabled:opacity-70"
          >
            {loading ? 'Authenticating...' : 'Login to Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}