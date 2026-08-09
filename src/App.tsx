import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { PackageCheck, LogOut, LayoutDashboard, PlusCircle, Truck, Warehouse, Bell, X, Server, PieChart, ShieldAlert, Users } from 'lucide-react';
import TeamManagement from './pages/TeamManagement';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewRequisition from './pages/NewRequisition';
import SiyanatOperations from './pages/SiyanatOperations';
import RestockInventory from './pages/RestockInventory';
import Reports from './pages/Reports';
import AssetRegister from './pages/AssetRegister';
import AuditLogs from './pages/AuditLogs'; // Import the new component

const NotificationManager = ({ userRole, userId }: { userRole: string | null, userId: string | null }) => {
  const [toast, setToast] = useState<{ id: string, message: string, title: string } | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Listener 1: New Work Orders (ADMIN ONLY)
    let orderSub: any;
    if (userRole === 'ADMIN') {
      const channelId = `admin_orders_${Math.random().toString(36).substring(7)}`;
      orderSub = supabase.channel(channelId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'work_orders' }, (payload) => {
          setToast({ id: payload.new.id, title: 'Incoming Requisition!', message: `Batch ${payload.new.batch_id} submitted.` });
          setTimeout(() => setToast(null), 6000);
        }).subscribe();
    }

    // Listener 2: New Chat Messages (EVERYONE)
    const chatChannelId = `chat_notifs_${Math.random().toString(36).substring(7)}`;
    const chatSub = supabase.channel(chatChannelId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'work_order_logs' }, (payload) => {
        // Only trigger if the message was sent by SOMEONE ELSE
        if (payload.new.author_id !== userId) {
          setToast({ id: payload.new.id, title: 'New Message', message: 'You have a new message in a batch thread.' });
          setTimeout(() => setToast(null), 6000);
        }
      }).subscribe();

    return () => {
      if (orderSub) supabase.removeChannel(orderSub);
      supabase.removeChannel(chatSub);
    };
  }, [userRole, userId]);

  if (!toast) return null;

  return (
    <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-right-8 fade-in duration-300">
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl border-l-4 border-emerald-500 flex items-start space-x-3 w-80">
        <div className="p-2 bg-emerald-500/20 rounded-lg mt-0.5">
          <Bell className="w-5 h-5 text-emerald-400 animate-[ring_2s_ease-in-out_infinite]" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-extrabold text-emerald-400 uppercase tracking-wide">{toast.title}</h4>
          <p className="text-xs text-slate-300 font-medium leading-relaxed mt-1">{toast.message}</p>
        </div>
        <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white transition mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const DesktopNavigation = ({ userRole }: { userRole: string | null }) => {
  const location = useLocation();

  const getTabClass = (path: string) => {
    const isActive = location.pathname === path;
    return isActive
      ? "px-4 py-2 rounded-xl font-bold text-xs bg-brand-maroon text-white shadow-md flex items-center space-x-2 whitespace-nowrap transition"
      : "px-4 py-2 rounded-xl font-bold text-xs bg-white text-slate-600 hover:text-slate-900 border border-slate-200 flex items-center space-x-2 whitespace-nowrap transition";
  };

  return (
    <div className="hidden md:block bg-white border-b border-slate-200 shadow-sm sticky top-[57px] z-40">
      <div className="max-w-7xl mx-auto px-4 flex space-x-2 py-2 overflow-x-auto">
        <Link to="/" className={getTabClass('/')}>
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>
        <Link to="/new-requisition" className={getTabClass('/new-requisition')}>
          <PlusCircle className="w-4 h-4" />
          <span>New Requisition</span>
        </Link>
        {userRole === 'ADMIN' && (
          <>
            <Link to="/siyanat-operations" className={getTabClass('/siyanat-operations')}>
              <Truck className="w-4 h-4" />
              <span>Siyanat Operations</span>
            </Link>
            <Link to="/restock" className={getTabClass('/restock')}>
              <Warehouse className="w-4 h-4" />
              <span>Restock Inventory</span>
            </Link>
            <Link to="/reports" className={getTabClass('/reports')}>
              <PieChart className="w-4 h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" />
              <span className="md:inline hidden text-xs">Reports</span>
              <span className="md:hidden text-[10px] font-bold">Reports</span>
            </Link>
            <Link to="/assets" className={getTabClass('/assets')}>
              <Server className="w-4 h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" />
              <span className="md:inline hidden text-xs">Assets</span>
              <span className="md:hidden text-[10px] font-bold">Assets</span>
            </Link>
            {/* Added Audit Link */}
            <Link to="/audit" className={getTabClass('/audit')}>
              <ShieldAlert className="w-4 h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" />
              <span className="md:inline hidden text-xs">Audit</span>
              <span className="md:hidden text-[10px] font-bold">Audit</span>
            </Link>
            <Link to="/team" className={getTabClass('/team')}>
  <Users className="w-4 h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" />
  <span className="md:inline hidden text-xs">Team</span>
  <span className="md:hidden text-[10px] font-bold">Team</span>
</Link>
          </>
        )}
      </div>
    </div>
  );
};

const MobileBottomNav = ({ userRole }: { userRole: string | null }) => {
  const location = useLocation();

  const getTabClass = (path: string) => {
    const isActive = location.pathname === path;
    return isActive
      ? "flex flex-col items-center justify-center w-full text-brand-maroon space-y-1"
      : "flex flex-col items-center justify-center w-full text-slate-400 hover:text-slate-600 space-y-1 transition";
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 z-50 w-full h-16 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex justify-around items-center px-2 pb-safe">
      <Link to="/" className={getTabClass('/')}>
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px] font-bold">Dash</span>
      </Link>
      <Link to="/new-requisition" className={getTabClass('/new-requisition')}>
        <PlusCircle className="w-5 h-5" />
        <span className="text-[10px] font-bold">Request</span>
      </Link>
      {userRole === 'ADMIN' && (
        <>
          <Link to="/siyanat-operations" className={getTabClass('/siyanat-operations')}>
            <Truck className="w-5 h-5" />
            <span className="text-[10px] font-bold">Queue</span>
          </Link>
          <Link to="/restock" className={getTabClass('/restock')}>
            <Warehouse className="w-5 h-5" />
            <span className="text-[10px] font-bold">Stock</span>
          </Link>
        </>
      )}
    </div>
  );
};

// Passed userId through layout
const PortalLayout = ({ children, userRole, userId }: { children: React.ReactNode, userRole: string | null, userId: string | null }) => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login'; 
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
      
      <NotificationManager userRole={userRole} userId={userId} />
      <DesktopNavigation userRole={userRole} />
      
      <main className="max-w-7xl mx-auto px-4 py-6 flex-grow w-full pb-20 md:pb-6">
        {children}
      </main>

      <MobileBottomNav userRole={userRole} />
    </div>
  );
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
      
    if (data && !error) {
      setUserRole(data.role);
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setUserRole(null);
        setLoading(false);
      }
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
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        
        <Route path="/" element={session ? <PortalLayout userRole={userRole} userId={session.user.id}><Dashboard /></PortalLayout> : <Navigate to="/login" />} />
        <Route path="/new-requisition" element={session ? <PortalLayout userRole={userRole} userId={session.user.id}><NewRequisition /></PortalLayout> : <Navigate to="/login" />} />
        
        <Route 
          path="/siyanat-operations" 
          element={
            session && userRole === 'ADMIN' 
              ? <PortalLayout userRole={userRole} userId={session.user.id}><SiyanatOperations /></PortalLayout> 
              : <Navigate to="/" />
          } 
        />
        <Route 
          path="/restock" 
          element={
            session && userRole === 'ADMIN' 
              ? <PortalLayout userRole={userRole} userId={session.user.id}><RestockInventory /></PortalLayout> 
              : <Navigate to="/" />
          } 
        />
        <Route 
          path="/reports" 
          element={
            session && userRole === 'ADMIN' 
              ? <PortalLayout userRole={userRole} userId={session.user.id}><Reports /></PortalLayout> 
              : <Navigate to="/" />
          } 
        />
        <Route 
          path="/assets" 
          element={
            session && userRole === 'ADMIN' 
              ? <PortalLayout userRole={userRole} userId={session.user.id}><AssetRegister /></PortalLayout> 
              : <Navigate to="/" />
          } 
        />
        {/* Added Protected Audit Route */}
        <Route 
          path="/audit" 
          element={
            session && userRole === 'ADMIN' 
              ? <PortalLayout userRole={userRole} userId={session.user.id}><AuditLogs /></PortalLayout> 
              : <Navigate to="/" />
          } 
        />
        <Route 
  path="/team" 
  element={
    session && userRole === 'ADMIN' 
      ? <PortalLayout userRole={userRole} userId={session.user.id}><TeamManagement /></PortalLayout> 
      : <Navigate to="/" />
  } 
/>
      </Routes>
    </Router>
  );
}