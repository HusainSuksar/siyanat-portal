import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, Search } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100); // Fetch last 100 actions

    if (data && !error) setLogs(data);
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => 
    log.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-brand-maroon flex items-center gap-2">
            <ShieldAlert className="w-6 h-6" />
            Global Audit Trail
          </h2>
          <p className="text-xs text-slate-500 mt-1">Immutable ledger of system activity and modifications.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
          <h3 className="font-extrabold text-sm uppercase text-slate-800">System Activity</h3>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="Search logs..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-brand-maroon outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold sticky top-0">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">User</th>
                <th className="p-3">Action Type</th>
                <th className="p-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="p-6 text-center text-slate-500 animate-pulse">Loading ledger...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-slate-500 italic">No logs recorded yet.</td></tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 font-mono">
                    <td className="p-3 text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 font-bold text-slate-700">{log.user_email}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-bold text-[10px] uppercase">
                        {log.action_type}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{log.description}</td>
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