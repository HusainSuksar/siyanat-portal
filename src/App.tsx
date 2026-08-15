import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
import {
  PackageCheck,
  LogOut,
  LayoutDashboard,
  PlusCircle,
  Truck,
  Warehouse,
  Bell,
  X,
  Server,
  PieChart,
  ShieldAlert,
  Users,
  Menu,
  Wrench,
  ClipboardList,
  Calendar,
  Car,
  CalendarCheck,
  ShoppingCart,
} from "lucide-react";
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

// --- NOTIFICATION MANAGER ---
const NotificationManager = ({
  userRole,
  userId,
}: {
  userRole: string | null;
  userId: string | null;
}) => {
  const [toast, setToast] = useState<{
    id: string;
    message: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;

    let orderSub: any;
    if (userRole === "ADMIN") {
      const channelId = `admin_orders_${Math.random().toString(36).substring(7)}`;
      orderSub = supabase
        .channel(channelId)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "work_orders" },
          (payload) => {
            setToast({
              id: payload.new.id,
              title: "Incoming Requisition!",
              message: `Batch ${payload.new.batch_id} submitted.`,
            });
            setTimeout(() => setToast(null), 6000);
          },
        )
        .subscribe();
    }

    const chatChannelId = `chat_notifs_${Math.random().toString(36).substring(7)}`;
    const chatSub = supabase
      .channel(chatChannelId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "work_order_logs" },
        (payload) => {
          if (payload.new.author_id !== userId) {
            setToast({
              id: payload.new.id,
              title: "New Message",
              message: "You have a new message in a batch thread.",
            });
            setTimeout(() => setToast(null), 6000);
          }
        },
      )
      .subscribe();

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
          <h4 className="text-sm font-extrabold text-emerald-400 uppercase tracking-wide">
            {toast.title}
          </h4>
          <p className="text-xs text-slate-300 font-medium leading-relaxed mt-1">
            {toast.message}
          </p>
        </div>
        <button
          onClick={() => setToast(null)}
          className="text-slate-400 hover:text-white transition mt-0.5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// --- DESKTOP NAVIGATION (Hidden on Mobile) ---
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
        <Link to="/" className={getTabClass("/")}>
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>
        <Link to="/new-requisition" className={getTabClass("/new-requisition")}>
          <PlusCircle className="w-4 h-4" />
          <span>New Requisition</span>
        </Link>
        <Link to="/book-event" className={getTabClass("/book-event")}>
          <Calendar className="w-4 h-4" />
          <span>Book Event</span>
        </Link>
        <Link to="/new-complaint" className={getTabClass("/new-complaint")}>
          <Wrench className="w-4 h-4" />
          <span>File Complaint</span>
        </Link>
        <Link to="/book-vehicle" className={getTabClass("/book-vehicle")}>
          <Car className="w-4 h-4" />
          <span>Book Vehicle</span>
        </Link>

        {userRole === "ADMIN" && (
          <>
            <Link
              to="/siyanat-operations"
              className={getTabClass("/siyanat-operations")}
            >
              <Truck className="w-4 h-4" />
              <span>Queue</span>
            </Link>
            <Link to="/restock" className={getTabClass("/restock")}>
              <Warehouse className="w-4 h-4" />
              <span>Stock</span>
            </Link>
            <Link to="/rto" className={getTabClass("/rto")}>
              <ShoppingCart className="w-4 h-4" />
              <span>RTO Queue</span>
            </Link>
            <Link to="/reports" className={getTabClass("/reports")}>
              <PieChart className="w-4 h-4" />
              <span>Reports</span>
            </Link>
            <Link to="/assets" className={getTabClass("/assets")}>
              <Server className="w-4 h-4" />
              <span>Assets</span>
            </Link>
            <Link to="/audit" className={getTabClass("/audit")}>
              <ShieldAlert className="w-4 h-4" />
              <span>Audit</span>
            </Link>
            <Link to="/team" className={getTabClass("/team")}>
              <Users className="w-4 h-4" />
              <span>Team</span>
            </Link>
            <Link to="/tanzeem" className={getTabClass("/tanzeem")}>
              <CalendarCheck className="w-4 h-4" />
              <span>Tanzeem Center</span>
            </Link>
          </>
        )}
        {(userRole === "ADMIN" || userRole === "SUPERVISOR") && (
          <Link
            to="/supervisor-queue"
            className={getTabClass("/supervisor-queue")}
          >
            <ClipboardList className="w-4 h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" />
            <span className="md:inline hidden text-xs">Review Queue</span>
            <span className="md:hidden text-[10px] font-bold">Review</span>
          </Link>
        )}
        {(userRole === "ADMIN" || userRole === "TECHNICIAN") && (
          <Link
            to="/technician-portal"
            className={getTabClass("/technician-portal")}
          >
            <Wrench className="w-4 h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" />
            <span className="md:inline hidden text-xs">My Workload</span>
            <span className="md:hidden text-[10px] font-bold">Tasks</span>
          </Link>
        )}
      </div>
    </div>
  );
};

// --- NEW: MOBILE DRAWER NAVIGATION (Hidden on Desktop) ---
const MobileDrawerNavigation = ({
  userRole,
  isOpen,
  setIsOpen,
  handleLogout,
}: {
  userRole: string | null;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  handleLogout: () => void;
}) => {
  const location = useLocation();

  if (!isOpen) return null;

  const getLinkClass = (path: string) => {
    const isActive = location.pathname === path;
    return isActive
      ? "flex items-center space-x-3 p-3 bg-brand-maroon/10 text-brand-maroon font-bold rounded-xl"
      : "flex items-center space-x-3 p-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl";
  };

  const navItem = (to: string, Icon: any, label: string) => (
    <Link to={to} onClick={() => setIsOpen(false)} className={getLinkClass(to)}>
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </Link>
  );

  return (
    <div className="md:hidden fixed inset-0 z-50 bg-black/50 flex justify-end">
      <div className="w-72 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">
        <div className="p-4 bg-brand-maroon text-white flex justify-between items-center">
          <span className="font-extrabold uppercase tracking-widest text-brand-gold text-sm">
            Menu
          </span>
          <button onClick={() => setIsOpen(false)} className="p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItem("/", LayoutDashboard, "Dashboard")}
          {navItem("/new-requisition", PlusCircle, "New Requisition")}
          {navItem("/new-complaint", Wrench, "File Complaint")}
          {navItem("/book-event", Calendar, "Book Event")}
          {navItem("/book-vehicle", Car, "Book Vehicle")}

          {userRole === "ADMIN" && (
            <>
              <div className="pt-4 pb-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Admin Controls
              </div>
              {navItem("/siyanat-operations", Truck, "Dispatch Queue")}
              {navItem("/restock", Warehouse, "Restock Inventory")}
              {navItem("/rto", ShoppingCart, "Request-to-Order Queue")}
              {navItem("/reports", PieChart, "Analytics & Reports")}
              {navItem("/assets", Server, "Asset Register")}
              {navItem("/audit", ShieldAlert, "Audit Trail")}
              {navItem("/team", Users, "Team Management")}
              {navItem("/tanzeem", CalendarCheck, "Tanzeem Command Center")}
            </>
          )}
          {(userRole === "ADMIN" || userRole === "SUPERVISOR") && (
            <>
              <div className="pt-4 pb-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Supervisor Tools
              </div>
              {navItem("/supervisor-queue", ClipboardList, "Review Queue")}
            </>
          )}
          {(userRole === "ADMIN" || userRole === "TECHNICIAN") && (
            <>
              <div className="pt-4 pb-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Technician Dashboard
              </div>
              {navItem("/technician-portal", Wrench, "My Workload")}
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 pb-safe">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 p-3 bg-red-50 text-red-700 font-bold rounded-xl border border-red-200"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- LAYOUT WRAPPER ---
const PortalLayout = ({
  children,
  userRole,
  userId,
}: {
  children: React.ReactNode;
  userRole: string | null;
  userId: string | null;
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
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
              <p className="text-xs text-amber-100/80">
                Al Jamea tus Saifiyah, Siddhpur | 1447H
              </p>
            </div>
          </div>

          {/* Desktop Logout Button */}
          <button
            onClick={handleLogout}
            className="hidden md:flex items-center space-x-1 px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-xs font-semibold rounded-lg border border-red-400/30 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 bg-brand-dark rounded-lg"
          >
            <Menu className="w-6 h-6 text-brand-gold" />
          </button>
        </div>
      </header>

      <NotificationManager userRole={userRole} userId={userId} />
      <DesktopNavigation userRole={userRole} />
      <MobileDrawerNavigation
        userRole={userRole}
        isOpen={isMobileMenuOpen}
        setIsOpen={setIsMobileMenuOpen}
        handleLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 py-6 flex-grow w-full">
        {children}
      </main>
    </div>
  );
};

// --- APP ROUTER ---
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (data && !error) setUserRole(data.role);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
      else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-brand-maroon text-brand-gold font-bold">
        Loading Portal...
      </div>
    );

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={!session ? <Login /> : <Navigate to="/" />}
        />

        {/* Universal Routes */}
        <Route
          path="/"
          element={
            session ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <Dashboard />
              </PortalLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/new-requisition"
          element={
            session ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <NewRequisition />
              </PortalLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Admin Routes */}
        <Route
          path="/siyanat-operations"
          element={
            session && userRole === "ADMIN" ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <SiyanatOperations />
              </PortalLayout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/restock"
          element={
            session && userRole === "ADMIN" ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <RestockInventory />
              </PortalLayout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/rto"
          element={
            session && userRole === "ADMIN" ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <RequestToOrder />
              </PortalLayout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/reports"
          element={
            session && userRole === "ADMIN" ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <Reports />
              </PortalLayout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/assets"
          element={
            session && userRole === "ADMIN" ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <AssetRegister />
              </PortalLayout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/audit"
          element={
            session && userRole === "ADMIN" ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <AuditLogs />
              </PortalLayout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/team"
          element={
            session && userRole === "ADMIN" ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <TeamManagement />
              </PortalLayout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/tanzeem"
          element={
            session && userRole === "ADMIN" ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <TanzeemCommandCenter />
              </PortalLayout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/new-complaint"
          element={
            session ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <NewComplaint />
              </PortalLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/supervisor-queue"
          element={
            session && (userRole === "ADMIN" || userRole === "SUPERVISOR") ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <SupervisorQueue />
              </PortalLayout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/technician-portal"
          element={
            session && (userRole === "ADMIN" || userRole === "TECHNICIAN") ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <TechnicianPortal />
              </PortalLayout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/book-event"
          element={
            session ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <BookEvent />
              </PortalLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/book-vehicle"
          element={
            session ? (
              <PortalLayout userRole={userRole} userId={session.user.id}>
                <BookVehicle />
              </PortalLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  );
}
