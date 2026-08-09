import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Clock, Truck, CheckCircle2, AlertTriangle, RefreshCw, MessageSquare } from 'lucide-react';
import BatchDetailsModal from '../components/BatchDetailsModal';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const navigate = useNavigate();
  
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    dispatched: 0,
    outOfStock: 0,
  });
  
  const [requisitions, setRequisitions] = useState<any[]>([]);
  
  // Chat Modal State
  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    
    // Fetch work orders AND their nested chat logs
    const { data: workOrders, error } = await supabase
      .from('work_orders')
      .select('*, logs:work_order_logs(author_id)')
      .order('created_at', { ascending: false })
      .limit(15);

    if (!error && workOrders) {
      setRequisitions(workOrders);
      
      setStats({
        total: workOrders.length,
        pending: workOrders.filter(w => w.approval_status.includes('Pending')).length,
        dispatched: workOrders.filter(w => w.dispatch_status === 'Dispatched').length,
        outOfStock: 0, 
      });
    }
    
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user);
      fetchDashboardData();
    });
  }, []);

  const openChat = (batch: any) => {
    setActiveBatch(batch);
    setIsChatOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-maroon to-brand-dark rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-brand-gold">Welcome to the Dashboard!</h2>
          <p className="text-xs text-slate-200">Real-time status of material requisitions.</p>
        </div>
        <button 
          onClick={() => navigate('/new-requisition')}
          className="px-5 py-3 bg-brand-gold hover:bg-amber-500 text-brand-dark font-black text-xs rounded-xl shadow-lg transition"
        >
          + New Requisition
        </button>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase">
            <span>Total Requisitions</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-800 mt-1">{stats.total}</div>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-xs text-amber-600 font-bold uppercase">
            <span>Pending Approval</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{stats.pending}</div>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-xs text-emerald-600 font-bold uppercase">
            <span>Dispatched</span>
            <Truck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{stats.dispatched}</div>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-xs text-red-600 font-bold uppercase">
            <span>Out of Stock</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-extrabold text-red-600 mt-1">{stats.outOfStock}</div>
        </div>
      </div>

      {/* Requisition Activity Table */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
          <h3 className="font-extrabold text-sm uppercase text-slate-800">Requisition Activity</h3>
          <button 
            onClick={fetchDashboardData}
            className="text-xs text-brand-maroon font-bold flex items-center space-x-1 hover:text-brand-dark transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Live Refresh'}</span>
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="p-3">Batch ID</th>
                <th className="p-3">Location</th>
                <th className="p-3">Urgency</th>
                <th className="p-3">Approval</th>
                <th className="p-3">Dispatch Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {requisitions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500">
                    {loading ? 'Loading live activity...' : 'No requisitions recorded yet.'}
                  </td>
                </tr>
              ) : (
                requisitions.map((req) => {
                  const logs = req.logs || [];
                  const hasUnread = logs.length > 0 && logs[logs.length - 1].author_id !== currentUser?.id;

                  return (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-brand-maroon">{req.batch_id}</td>
                      <td className="p-3 font-semibold">{req.location}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase bg-slate-100 text-slate-700">
                          {req.urgency}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          req.approval_status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                          req.approval_status === 'Rejected' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {req.approval_status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          req.dispatch_status === 'Dispatched' ? 'bg-emerald-100 text-emerald-800' :
                          req.dispatch_status === 'Cancelled' ? 'bg-slate-200 text-slate-600' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {req.dispatch_status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => openChat(req)}
                          className="relative px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] shadow-sm transition flex items-center space-x-1 ml-auto"
                        >
                          {hasUnread && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white"></span>
                            </span>
                          )}
                          <MessageSquare className="w-3 h-3" />
                          <span className="hidden sm:inline">Thread</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Chat Modal */}
      {activeBatch && currentUser && (
        <BatchDetailsModal
          batchId={activeBatch.batch_id}
          workOrderId={activeBatch.id}
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            setActiveBatch(null);
            fetchDashboardData(); // Refresh logs to clear notification dot
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}