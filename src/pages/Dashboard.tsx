import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Clock, Truck, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    dispatched: 0,
    outOfStock: 0,
  });
  const [requisitions, setRequisitions] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    
    // In a real scenario, you would fetch from your Supabase tables here.
    // For now, we are setting up the UI shell to match your legacy app's look and feel.
    const { data: workOrders, error } = await supabase
      .from('work_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && workOrders) {
      setRequisitions(workOrders);
      // Basic stat calculation example
      setStats({
        total: workOrders.length,
        pending: workOrders.filter(w => w.approval_status === 'Pending Approval').length,
        dispatched: workOrders.filter(w => w.dispatch_status === 'Dispatched').length,
        outOfStock: 0, // Would be calculated based on inventory joins
      });
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-maroon to-brand-dark rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-brand-gold">Welcome to the Dashboard!</h2>
          <p className="text-xs text-slate-200">Real-time status of material requisitions.</p>
        </div>
        <button className="px-5 py-3 bg-brand-gold hover:bg-amber-500 text-brand-dark font-black text-xs rounded-xl shadow-lg transition">
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
                <th className="p-3">Department</th>
                <th className="p-3">Location</th>
                <th className="p-3">Urgency</th>
                <th className="p-3">Approval</th>
                <th className="p-3">Dispatch Status</th>
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
                requisitions.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-brand-maroon">{req.batch_id}</td>
                    <td className="p-3 font-semibold text-slate-700">{req.department}</td>
                    <td className="p-3 font-semibold">{req.location}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase bg-slate-100 text-slate-700">
                        {req.urgency}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {req.approval_status}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {req.dispatch_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}