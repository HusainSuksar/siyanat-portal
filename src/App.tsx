import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { useAuth } from "./contexts/AuthContext"; 
import { PackageCheck, LogOut, LayoutDashboard, PlusCircle, Truck, Warehouse, Bell, X, Server, PieChart, ShieldAlert, Users, Menu, Wrench, ClipboardList, Calendar, Car, CalendarCheck, ShoppingCart, Package, UserCircle, Eye } from "lucide-react";
import { useWorkloadBadges } from "./hooks/useWorkloadBadges";

import ForcePasswordChange from "./components/ForcePasswordChange";
import UserProfile from "./pages/UserProfile";
import ReceptionWatchtower from "./pages/ReceptionWatchtower";

import SupervisorQueue from "./pages/SupervisorQueue";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewRequisition from "./pages/NewRequisition";
import SiyanatOperations from "./pages/SiyanatOperations";
import RestockInventory from "./pages/RestockInventory";
import Reports from "./pages/Reports";
import AssetRegister from "./pages/AssetRegister";
import AuditLogs from "./pages/AuditLogs";
import TeamManagement from "./pages/TeamManagement";
import NewComplaint from "./pages/NewComplaint";
import TechnicianPortal from "./pages/TechnicianPortal";
import BookEvent from "./pages/BookEvent";
import BookVehicle from "./pages/BookVehicle";
import TanzeemCommandCenter from "./pages/TanzeemCommandCenter";
import RequestToOrder from "./pages/RequestToOrder";
import NotificationBell from './components/NotificationBell';
import InstallAppButton from './components/InstallAppButton';

// Global Clean Logout Handler
const performCleanLogout = async () => {
  try {
    supabase.removeAllChannels();
    await supabase.auth.signOut();
  } catch (err) {
    console.error("SignOut error:", err);
  } finally {
    window.location.href = "/login";
  }
};

// --- AUTO-SYNC PUSH SUBSCRIPTIONS ON AUTH ---
const usePushNotificationSync = (userId: string | null) => {
  useEffect(() => {
    if (!userId) return;

    const syncDeviceSubscription = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          const rawSub = subscription.toJSON();
          const endpoint = subscription.endpoint;
          const p256dh = rawSub.keys?.p256dh || '';
          const auth = rawSub.keys?.auth || '';

          if (endpoint && p256dh && auth) {
            await supabase.from('user_push_subscriptions').upsert(
              {
                user_id: userId,
                endpoint,
                p256dh,
                auth,
                user_agent: navigator.userAgent,
                updated_at: new Date().toISOString()
              },
              { onConflict: 'endpoint' }
            );
          }
        }
      } catch (err) {
        console.warn("Push sync bypassed:", err);
      }
    };

    syncDeviceSubscription();
  }, [userId]);
};

// --- NOTIFICATION MANAGER ---
const NotificationManager = ({ userRole, userId }: { userRole: string | null; userId: string | null; }) => {
  const [toast, setToast] = useState<{ id: string; message: string; title: string; } | null>(null);

  useEffect(() => {
    if (!userId) return;

    let orderSub: any;
    if (userRole === "SUPER_ADMIN" || userRole === "SIYANAT_HEAD" || userRole === "TANZEEM_HEAD" || userRole === "AVIT_HEAD" || userRole === "ADMIN") {
      const channelId = `admin_orders_${Math.random().toString(36).substring(7)}`;
      orderSub = supabase.channel(channelId).on('postgres_changes', { event: "INSERT", schema: "public", table: "work_orders" },
        (payload) => {
          setToast({ id: payload.new.id, title: "Incoming Requisition!", message: `Batch ${payload.new.batch_id} submitted.` });
          setTimeout(() => setToast(null), 6000);
        }
      ).subscribe();
    }

    const chatChannelId = `chat_notifs_${Math.random().toString(36).substring(7)}`;
    const chatSub = supabase.channel(chatChannelId).on('postgres_changes', { event: "INSERT", schema: "public", table: "work_order_logs" },
      (payload) => {
        if (payload.new.author_id !== userId) {
          setToast({ id: payload.new.id, title: "New Message", message: "You have a new message in a batch thread." });
          setTimeout(() => setToast(null), 6000);
        }
      }
    ).subscribe();

    return () => {
      if (orderSub) supabase.removeChannel(orderSub);
      supabase.removeChannel(chatSub);
    };
  }, [userRole, userId]);

  if (!toast) return null;

  return (
    <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-right-8 fade-in duration-300">
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl border-l-4 border-emerald-500 flex items-start space-x-3 w-80">
        <div className="p-2 bg-emerald-500/20 rounded-lg mt-0.5"><Bell className="w-5 h-5 text-emerald-400 animate-[ring_2s_ease-in-out_infinite]" /></div>
        <div className="flex-1">
          <h4 className="text-sm font-extrabold text-emerald-400 uppercase tracking-wide">{toast.title}</h4>
          <p className="text-xs text-slate-300 font-medium leading-relaxed mt-1">{toast.message}</p>
        </div>
        <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white transition mt-0.5"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

// --- DESKTOP NAVIGATION ---
const DesktopNavigation = ({ userRole, badges }: { userRole: string; badges: any }) => {
  const location = useLocation();
  const getTabClass = (path: string) => {
    const isActive = location.pathname === path;
    return isActive
      ? "px-4 py-2 rounded-xl font-bold text-xs bg-brand-maroon text-white shadow-md flex items-center space-x-2 whitespace-nowrap transition"
      : "px-4 py-2 rounded-xl font-bold text-xs bg-white text-slate-600 hover:text-slate-900 border border-slate-200 flex items-center space-x-2 whitespace-nowrap transition";
  };

  const isGodMode = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
  const isSiyanatHead = userRole === 'SIYANAT_HEAD' || isGodMode;
  const isTanzeemHead = userRole === 'TANZEEM_HEAD' || isGodMode;
  const isAvitHead = userRole === 'AVIT_HEAD' || isGodMode;
  const isReceptionist = userRole === 'RECEPTIONIST' || isGodMode;
  
  // Standard Users exclude DEPT_HEAD. DEPT_HEADs will see the "Book Vehicle" tab.
  const isStandardUser = userRole === 'STANDARD_USER' || userRole === 'REQUESTER' || userRole === 'RECEPTIONIST';

  return (
    <div className="hidden md:block bg-white border-b border-slate-200 shadow-sm sticky top-[57px] z-40">
      <div className="max-w-7xl mx-auto px-4 flex space-x-2 py-2 overflow-x-auto">
        <Link to="/" className={getTabClass("/")}><LayoutDashboard className="w-4 h-4" /><span>Dashboard</span></Link>
        <Link to="/new-requisition" className={getTabClass("/new-requisition")}><PlusCircle className="w-4 h-4" /><span>New Requisition</span></Link>
        <Link to="/new-complaint" className={getTabClass("/new-complaint")}><Wrench className="w-4 h-4" /><span>File Complaint</span></Link>
        <Link to="/book-event" className={getTabClass("/book-event")}><Calendar className="w-4 h-4" /><span>Book Event</span></Link>
        
        {!isStandardUser && (
          <Link to="/book-vehicle" className={getTabClass("/book-vehicle")}><Car className="w-4 h-4" /><span>Book Vehicle</span></Link>
        )}

        {isReceptionist && (
          <Link to="/watchtower" className={getTabClass("/watchtower")}><Eye className="w-4 h-4" /><span>Omni-Tracker</span></Link>
        )}

        {isSiyanatHead && (
          <>
            <Link to="/siyanat-operations" className={getTabClass("/siyanat-operations")}>
              <Truck className="w-4 h-4" />
              <span>Operations</span>
              {badges.materialDispatch > 0 && <span className="bg-brand-gold text-brand-dark px-1.5 py-0.2 rounded-full text-[10px] font-black">{badges.materialDispatch}</span>}
            </Link>
            <Link to="/restock" className={getTabClass("/restock")}><Warehouse className="w-4 h-4" /><span>Stock</span></Link>
            <Link to="/rto" className={getTabClass("/rto")}>
              <ShoppingCart className="w-4 h-4" />
              <span>RTO Queue</span>
              {badges.pendingPOs > 0 && <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-full text-[10px] font-black">{badges.pendingPOs}</span>}
            </Link>
            <Link to="/reports" className={getTabClass("/reports")}><PieChart className="w-4 h-4" /><span>Reports</span></Link>
            <Link to="/assets" className={getTabClass("/assets")}><Server className="w-4 h-4" /><span>Assets</span></Link>
            <Link to="/audit" className={getTabClass("/audit")}><ShieldAlert className="w-4 h-4" /><span>Audit</span></Link>
            <Link to="/team" className={getTabClass("/team")}><Users className="w-4 h-4" /><span>Team</span></Link>
          </>
        )}

        {isTanzeemHead && !isSiyanatHead && (
          <>
            <Link to="/siyanat-operations" className={getTabClass("/siyanat-operations")}>
              <Package className="w-4 h-4" />
              <span>Stationery Queue</span>
              {badges.materialDispatch > 0 && <span className="bg-brand-gold text-brand-dark px-1.5 py-0.2 rounded-full text-[10px] font-black">{badges.materialDispatch}</span>}
            </Link>
            <Link to="/restock" className={getTabClass("/restock")}><Warehouse className="w-4 h-4" /><span>Catalog</span></Link>
            <Link to="/rto" className={getTabClass("/rto")}><ShoppingCart className="w-4 h-4" /><span>RTO Queue</span></Link>
            <Link to="/tanzeem" className={getTabClass("/tanzeem")}><CalendarCheck className="w-4 h-4" /><span>Tanzeem Center</span></Link>
          </>
        )}

        {isAvitHead && !isSiyanatHead && (
          <>
            <Link to="/siyanat-operations" className={getTabClass("/siyanat-operations")}>
              <Truck className="w-4 h-4" />
              <span>AVIT Operations</span>
              {badges.materialDispatch > 0 && <span className="bg-brand-gold text-brand-dark px-1.5 py-0.2 rounded-full text-[10px] font-black">{badges.materialDispatch}</span>}
            </Link>
            <Link to="/restock" className={getTabClass("/restock")}><Warehouse className="w-4 h-4" /><span>Catalog</span></Link>
            <Link to="/rto" className={getTabClass("/rto")}><ShoppingCart className="w-4 h-4" /><span>RTO Queue</span></Link>
          </>
        )}

        {(userRole === "SUPERVISOR" || isGodMode) && (
          <Link to="/supervisor-queue" className={getTabClass("/supervisor-queue")}>
            <ClipboardList className="w-4 h-4" />
            <span>Review Queue</span>
            {badges.supervisorReview > 0 && <span className="bg-red-500 text-white px-1.5 py-0.2 rounded-full text-[10px] font-black">{badges.supervisorReview}</span>}
          </Link>
        )}
        
        {(userRole === "TECHNICIAN" || userRole === "EXECUTOR" || isGodMode) && (
          <Link to="/technician-portal" className={getTabClass("/technician-portal")}>
            <Wrench className="w-4 h-4" />
            <span>My Workload</span>
            {badges.techTasks > 0 && <span className="bg-indigo-600 text-white px-1.5 py-0.2 rounded-full text-[10px] font-black">{badges.techTasks}</span>}
          </Link>
        )}
      </div>
    </div>
  );
};

// --- MOBILE DRAWER NAVIGATION ---
const MobileDrawerNavigation = ({ userRole, isOpen, setIsOpen, badges }: { userRole: string; isOpen: boolean; setIsOpen: (val: boolean) => void; badges: any; }) => {
  const location = useLocation();
  if (!isOpen) return null;

  const getLinkClass = (path: string) => {
    const isActive = location.pathname === path;
    return isActive ? "flex items-center justify-between p-3 bg-brand-maroon/10 text-brand-maroon font-bold rounded-xl" : "flex items-center justify-between p-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl";
  };

  const navItem = (to: string, Icon: any, label: string, badgeCount?: number) => (
    <Link to={to} onClick={() => setIsOpen(false)} className={getLinkClass(to)}>
      <div className="flex items-center space-x-3">
        <Icon className="w-5 h-5" />
        <span>{label}</span>
      </div>
      {!!badgeCount && badgeCount > 0 && (
        <span className="bg-brand-maroon text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
          {badgeCount}
        </span>
      )}
    </Link>
  );

  const isGodMode = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
  const isSiyanatHead = userRole === 'SIYANAT_HEAD' || isGodMode;
  const isTanzeemHead = userRole === 'TANZEEM_HEAD' || isGodMode;
  const isAvitHead = userRole === 'AVIT_HEAD' || isGodMode;
  const isReceptionist = userRole === 'RECEPTIONIST' || isGodMode;
  const isStandardUser = userRole === 'STANDARD_USER' || userRole === 'REQUESTER' || userRole === 'RECEPTIONIST';

  return (
    <div className="md:hidden fixed inset-0 z-50 bg-black/50 flex justify-end">
      <div className="w-72 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">
        <div className="p-4 bg-brand-maroon text-white flex justify-between items-center">
          <span className="font-extrabold uppercase tracking-widest text-brand-gold text-sm">Menu</span>
          <button onClick={() => setIsOpen(false)} className="p-1"><X className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItem("/", LayoutDashboard, "Dashboard")}
          {navItem("/new-requisition", PlusCircle, "New Requisition")}
          {navItem("/new-complaint", Wrench, "File Complaint")}
          {navItem("/book-event", Calendar, "Book Event")}
          
          {!isStandardUser && navItem("/book-vehicle", Car, "Book Vehicle")}

          {isReceptionist && (
             <>
               <div className="pt-4 pb-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Help Desk Tools</div>
               {navItem("/watchtower", Eye, "Omni-Tracker Watchtower")}
             </>
          )}

          {isSiyanatHead && (
            <>
              <div className="pt-4 pb-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Siyanat Head Controls</div>
              {navItem("/siyanat-operations", Truck, "Operations Queue", badges.materialDispatch)}
              {navItem("/restock", Warehouse, "Restock Inventory")}
              {navItem("/rto", ShoppingCart, "Request-to-Order Queue", badges.pendingPOs)}
              {navItem("/reports", PieChart, "Analytics & Reports")}
              {navItem("/assets", Server, "Asset Register")}
              {navItem("/audit", ShieldAlert, "Audit Trail")}
              {navItem("/team", Users, "Team Management")}
            </>
          )}

          {isTanzeemHead && !isSiyanatHead && (
            <>
              <div className="pt-4 pb-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Tanzeem Head Controls</div>
              {navItem("/tanzeem", CalendarCheck, "Tanzeem Command Center")}
              {navItem("/siyanat-operations", Package, "Stationery Queue", badges.materialDispatch)}
              {navItem("/restock", Warehouse, "Catalog")}
              {navItem("/rto", ShoppingCart, "RTO Queue", badges.pendingPOs)}
            </>
          )}

          {isAvitHead && !isSiyanatHead && (
            <>
              <div className="pt-4 pb-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">AVIT Head Controls</div>
              {navItem("/siyanat-operations", Truck, "AVIT Operations", badges.materialDispatch)}
              {navItem("/restock", Warehouse, "Catalog")}
              {navItem("/rto", ShoppingCart, "RTO Queue", badges.pendingPOs)}
            </>
          )}

          {(userRole === "SUPERVISOR" || isGodMode) && (
            <>
              <div className="pt-4 pb-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Supervisor Tools</div>
              {navItem("/supervisor-queue", ClipboardList, "Review Queue", badges.supervisorReview)}
            </>
          )}
          
          {(userRole === "TECHNICIAN" || userRole === "EXECUTOR" || isGodMode) && (
            <>
              <div className="pt-4 pb-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Technician Dashboard</div>
              {navItem("/technician-portal", Wrench, "My Workload", badges.techTasks)}
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 pb-safe space-y-2">
          <Link to="/profile" onClick={() => setIsOpen(false)} className="w-full flex items-center justify-center space-x-2 p-3 bg-slate-50 text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-100">
            <UserCircle className="w-5 h-5" /><span>My Profile</span>
          </Link>
          <button onClick={performCleanLogout} className="w-full flex items-center justify-center space-x-2 p-3 bg-red-50 text-red-700 font-bold rounded-xl border border-red-200">
            <LogOut className="w-5 h-5" /><span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- LAYOUT WRAPPER ---
const PortalLayout = ({ children, userRole, userId }: { children: React.ReactNode; userRole: string; userId: string | null; }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const badges = useWorkloadBadges(userId, userRole);

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
          <div className="flex items-center gap-2 md:gap-4">
            <NotificationBell />
            <Link to="/profile" className="hidden md:flex items-center space-x-1 px-3 py-1.5 bg-brand-gold/20 hover:bg-brand-gold/30 text-brand-gold text-xs font-semibold rounded-lg border border-brand-gold/30 transition">
              <UserCircle className="w-4 h-4" /><span>Profile</span>
            </Link>
            <button onClick={performCleanLogout} className="hidden md:flex items-center space-x-1 px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-xs font-semibold rounded-lg border border-red-400/30 transition">
              <LogOut className="w-4 h-4" /><span>Logout</span>
            </button>
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 bg-brand-dark rounded-lg"><Menu className="w-6 h-6 text-brand-gold" /></button>
          </div>
        </div>
      </header>

      <NotificationManager userRole={userRole} userId={userId} />
      <DesktopNavigation userRole={userRole} badges={badges} />
      <MobileDrawerNavigation userRole={userRole} isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} badges={badges} />

      <main className="max-w-7xl mx-auto px-4 py-6 flex-grow w-full relative">
        {children}
        <div className="fixed bottom-6 right-6 z-[45]">
          <InstallAppButton />
        </div>
      </main>
    </div>
  );
};

// --- APP ROUTER ---
export default function App() {
  const { session, role, loading } = useAuth();

  usePushNotificationSync(session?.user?.id || null);

  if (loading) return <div className="flex justify-center items-center min-h-screen bg-brand-maroon text-brand-gold font-bold">Loading Portal...</div>;

  const isGodMode = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isSiyanatHead = role === 'SIYANAT_HEAD' || isGodMode;
  const isTanzeemHead = role === 'TANZEEM_HEAD' || isGodMode;
  const isAvitHead = role === 'AVIT_HEAD' || isGodMode;
  const isStandardUser = role === 'STANDARD_USER' || role === 'REQUESTER' || role === 'RECEPTIONIST';
  
  const isReceptionist = role === 'RECEPTIONIST' || isGodMode;
  const isOpsHead = isSiyanatHead || isTanzeemHead || isAvitHead;
  const isTech = role === 'EXECUTOR' || role === 'TECHNICIAN' || isGodMode;
  const isSupervisor = role === 'SUPERVISOR' || isGodMode;

  return (
    <Router>
      <ForcePasswordChange>
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />

          {/* Universal Routes */}
          <Route path="/" element={session ? <PortalLayout userRole={role} userId={session.user.id}><Dashboard /></PortalLayout> : <Navigate to="/login" />} />
          <Route path="/new-requisition" element={session ? <PortalLayout userRole={role} userId={session.user.id}><NewRequisition /></PortalLayout> : <Navigate to="/login" />} />
          <Route path="/new-complaint" element={session ? <PortalLayout userRole={role} userId={session.user.id}><NewComplaint /></PortalLayout> : <Navigate to="/login" />} />
          <Route path="/book-event" element={session ? <PortalLayout userRole={role} userId={session.user.id}><BookEvent /></PortalLayout> : <Navigate to="/login" />} />
          <Route path="/profile" element={session ? <PortalLayout userRole={role} userId={session.user.id}><UserProfile /></PortalLayout> : <Navigate to="/login" />} />

          {/* Receptionist Read-Only View */}
          <Route path="/watchtower" element={session && isReceptionist ? <PortalLayout userRole={role} userId={session.user.id}><ReceptionWatchtower /></PortalLayout> : <Navigate to="/" />} />

          {/* Restrict Vehicle Booking (DEPT_HEAD accesses this because they are not a standard user) */}
          <Route path="/book-vehicle" element={session && !isStandardUser ? <PortalLayout userRole={role} userId={session.user.id}><BookVehicle /></PortalLayout> : <Navigate to="/" />} />

          {/* Head Routes */}
          <Route path="/siyanat-operations" element={session && isOpsHead ? <PortalLayout userRole={role} userId={session.user.id}><SiyanatOperations /></PortalLayout> : <Navigate to="/" />} />
          <Route path="/restock" element={session && isOpsHead ? <PortalLayout userRole={role} userId={session.user.id}><RestockInventory /></PortalLayout> : <Navigate to="/" />} />
          <Route path="/rto" element={session && isOpsHead ? <PortalLayout userRole={role} userId={session.user.id}><RequestToOrder /></PortalLayout> : <Navigate to="/" />} />
          
          {/* Strictly Admin / Siyanat */}
          <Route path="/reports" element={session && isSiyanatHead ? <PortalLayout userRole={role} userId={session.user.id}><Reports /></PortalLayout> : <Navigate to="/" />} />
          <Route path="/assets" element={session && isSiyanatHead ? <PortalLayout userRole={role} userId={session.user.id}><AssetRegister /></PortalLayout> : <Navigate to="/" />} />
          <Route path="/audit" element={session && isSiyanatHead ? <PortalLayout userRole={role} userId={session.user.id}><AuditLogs /></PortalLayout> : <Navigate to="/" />} />
          <Route path="/team" element={session && isSiyanatHead ? <PortalLayout userRole={role} userId={session.user.id}><TeamManagement /></PortalLayout> : <Navigate to="/" />} />
          
          {/* Tanzeem Command Center */}
          <Route path="/tanzeem" element={session && isTanzeemHead ? <PortalLayout userRole={role} userId={session.user.id}><TanzeemCommandCenter /></PortalLayout> : <Navigate to="/" />} />

          {/* Supervisor & Tech Routes */}
          <Route path="/supervisor-queue" element={session && isSupervisor ? <PortalLayout userRole={role} userId={session.user.id}><SupervisorQueue /></PortalLayout> : <Navigate to="/" />} />
          <Route path="/technician-portal" element={session && isTech ? <PortalLayout userRole={role} userId={session.user.id}><TechnicianPortal /></PortalLayout> : <Navigate to="/" />} />
        </Routes>
      </ForcePasswordChange>
    </Router>
  );
}