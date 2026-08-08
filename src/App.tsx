import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { PackageCheck, LogOut } from 'lucide-react';
import Login from './pages/Login';

// Placeholder components for the other tabs we will build next
const Dashboard = () => <div className="p-10 text-slate-800">Dashboard Overview Component (To be built next)</div>;
const SiyanatQueue = () => <div className="p-10 text-slate-800">Admin Siyanat Dispatch Queue (To be built)</div>;
const RestockInventory = () => <div className="p-10 text-slate-800">Bulk Restock Grid (To be built)</div>;

// Global Layout Wrapper (Replaces the header and tabs from Index.html)
const PortalLayout = ({ children }: { children: React.ReactNode }) => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f6f0] font-sans">
      <header className="bg-brand-maroon text-white shadow-xl sticky top-0 z-50 border-b-2 border-brand-gold/40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <PackageCheck className="w-6 h-6 text-brand-gold" />
            <div>
              <h1 className="font-bold text-base md:text-lg leading-tight tracking-wide text-brand-gold">SIYANAT UL MUMTALEKAAT</h1>
              <p className="text-xs text-amber-100/80">Al Jamea tus Saifiyah, Siddhpur | 1447H</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-1 px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-xs font-semibold rounded-lg border border-red-400/30 transition"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>
      
      {/* Tab Navigation would go here in the next step */}
      
      <main className="max-w-7xl mx-auto px-4 py-6 flex-grow w-full">
        {children}
      </main>
    </div>
  );
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen bg-brand-maroon text-brand-gold font-bold">Loading Portal...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        
        {/* Protected Routes wrapped in PortalLayout */}
        <Route path="/" element={session ? <PortalLayout><Dashboard /></PortalLayout> : <Navigate to="/login" />} />
        <Route path="/siyanat-operations" element={session ? <PortalLayout><SiyanatQueue /></PortalLayout> : <Navigate to="/login" />} />
        <Route path="/restock" element={session ? <PortalLayout><RestockInventory /></PortalLayout> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}