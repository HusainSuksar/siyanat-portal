import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { PackageCheck, LogOut, LayoutDashboard, PlusCircle, Truck, Warehouse } from 'lucide-react';
import NewRequisition from './pages/NewRequisition';
import SiyanatOperations from './pages/SiyanatOperations';
import RestockInventory from './pages/RestockInventory';

// Import your new Dashboard component
import Dashboard from './pages/Dashboard';

// Placeholders for the remaining tabs we will build next

// Navigation Bar Component with Active State Styling
const NavigationTabs = () => {
  const location = useLocation();

  const getTabClass = (path: string) => {
    const isActive = location.pathname === path;
    return isActive
      ? "px-4 py-2 rounded-xl font-bold text-xs bg-brand-maroon text-white shadow-md flex items-center space-x-2 whitespace-nowrap transition"
      : "px-4 py-2 rounded-xl font-bold text-xs bg-white text-slate-600 hover:text-slate-900 border border-slate-200 flex items-center space-x-2 whitespace-nowrap transition";
  };

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm sticky top-[57px] z-40">
      <div className="max-w-7xl mx-auto px-4 flex space-x-2 py-2 overflow-x-auto">
        <Link to="/" className={getTabClass('/')}>
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>
        <Link to="/new-requisition" className={getTabClass('/new-requisition')}>
  <PlusCircle className="w-4 h-4" />
  <span>New Requisition</span>
</Link>
        <Link to="/siyanat-operations" className={getTabClass('/siyanat-operations')}>
          <Truck className="w-4 h-4" />
          <span>Siyanat Operations</span>
        </Link>
        <Link to="/restock" className={getTabClass('/restock')}>
          <Warehouse className="w-4 h-4" />
          <span>Restock Inventory</span>
        </Link>
      </div>
    </div>
  );
};

// Global Portal Layout
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
              <h1 className="font-bold text-base md:text-lg leading-tight tracking-wide text-brand-gold">
                SIYANAT UL MUMTALEKAAT
              </h1>
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
      
      {/* Dynamic Tab Navigation Bar */}
      <NavigationTabs />
      
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-brand-maroon text-brand-gold font-bold">
        Loading Portal...
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!session ? <Navigate to="/" /> : <Navigate to="/" />} />
        
        {/* Protected Routes */}
        <Route 
          path="/" 
          element={
            <PortalLayout>
              <Dashboard />
            </PortalLayout>
          } 
        />
        <Route 
          path="/siyanat-operations" 
          element={
            <PortalLayout>
              <SiyanatOperations />
            </PortalLayout>
          } 
        />
        <Route 
  path="/new-requisition" 
  element={
    <PortalLayout>
      <NewRequisition />
    </PortalLayout>
  } 
/>
        <Route 
          path="/restock" 
          element={
            <PortalLayout>
              <RestockInventory />
            </PortalLayout>
          } 
        />
      </Routes>
    </Router>
  );
}