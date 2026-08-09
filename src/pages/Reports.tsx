import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, Download, FileSpreadsheet } from 'lucide-react';

export default function Reports() {
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ total: 0, approved: 0, rejected: 0, dispatched: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch all historical work orders with their nested items for the CSV export
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        items:work_order_items (
          requested_qty,
          item_type,
          custom_item_name,
          inventory:inventory_items(name)
        )
      `)
      .order('created_at', { ascending: false });

    if (data && !error) {
      setWorkOrders(data);
      setMetrics({
        total: data.length,
        approved: data.filter(w => w.approval_status === 'Approved').length,
        rejected: data.filter(w => w.approval_status === 'Rejected').length,
        dispatched: data.filter(w => w.dispatch_status === 'Dispatched').length,
      });
    }
    setLoading(false);
  };

  // CSV Export Engine
  const downloadCSV = () => {
    if (workOrders.length === 0) return alert("No data to export.");

    // 1. Define CSV Headers
    const headers = [
      "Batch ID", "Date Submitted", "Department", "Location", 
      "Urgency", "Approval Status", "Dispatch Status", "Items Requested"
    ];

    // 2. Map data to rows
    const rows = workOrders.map(order => {
      // Format items into a readable string for the CSV cell
      const itemsString = order.items?.map((i: any) => {
        const name = i.item_type === 'Catalog' && i.inventory ? i.inventory.name : i.custom_item_name;
        return `${name} (x${i.requested_qty})`;
      }).join('; ');

      return [
        order.batch_id,
        new Date(order.created_at).toLocaleDateString(),
        order.department,
        order.location,
        order.urgency,
        order.approval_status,
        order.dispatch_status,
        `"${itemsString}"` // Wrap in quotes to prevent commas from breaking columns
      ].join(',');
    });

    // 3. Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // 4. Create a Blob and trigger the browser download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Siyanat_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-brand-maroon flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Analytics & Reports
          </h2>
          <p className="text-xs text-slate-500 mt-1">Export operational data and track facility consumption.</p>
        </div>
        <button 
          onClick={downloadCSV}
          disabled={loading || workOrders.length === 0}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-md transition flex items-center space-x-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>Export Master CSV</span>
        </button>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Processed</span>
          <span className="text-3xl font-black text-slate-800 mt-2">{metrics.total}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase text-emerald-600">Dispatched Items</span>
          <span className="text-3xl font-black text-emerald-600 mt-2">{metrics.dispatched}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase text-brand-gold">Approval Rate</span>
          <span className="text-3xl font-black text-brand-gold mt-2">
            {metrics.total > 0 ? Math.round((metrics.approved / metrics.total) * 100) : 0}%
          </span>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase text-red-500">Rejected Batches</span>
          <span className="text-3xl font-black text-red-500 mt-2">{metrics.rejected}</span>
        </div>
      </div>

      {/* Historical Data View */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center space-x-2 border-b pb-3">
          <FileSpreadsheet className="w-4 h-4 text-brand-maroon" />
          <h3 className="font-extrabold text-sm uppercase text-slate-800">Historical Master Data</h3>
        </div>
        
        {loading ? (
          <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Compiling database...</div>
        ) : (
          <div className="overflow-y-auto max-h-[500px] border border-slate-100 rounded-lg">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 text-slate-600 uppercase sticky top-0 shadow-sm">
                <tr>
                  <th className="p-3">Batch ID</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workOrders.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-brand-maroon">{row.batch_id}</td>
                    <td className="p-3 text-slate-500">{new Date(row.created_at).toLocaleDateString()}</td>
                    <td className="p-3 font-semibold text-slate-700">{row.location}</td>
                    <td className="p-3">
                      {row.dispatch_status === 'Dispatched' ? '🟢 Dispatched' : 
                       row.approval_status === 'Rejected' ? '🔴 Rejected' : '🟡 Pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}