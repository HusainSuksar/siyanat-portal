import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, Search, RefreshCw, ChevronDown } from 'lucide-react';

const PAGE_SIZE = 50;

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  // Initial fetch and search fetch (resets to page 0)
  const fetchLogs = async (search = searchTerm) => {
    setLoading(true);
    setPage(0);

    let query = supabase
      .from('system_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1);

    const cleanSearch = search.trim();
    if (cleanSearch) {
      query = query.or(
        `description.ilike.%${cleanSearch}%,user_email.ilike.%${cleanSearch}%,action_type.ilike.%${cleanSearch}%`
      );
    }

    const { data, error, count } = await query;

    if (data && !error) {
      setLogs(data);
      setHasMore(data.length === PAGE_SIZE && (count ? data.length < count : true));
    }
    setLoading(false);
  };

  // Load the next 50 records
  const loadMoreLogs = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    const nextPage = page + 1;
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('system_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    const cleanSearch = searchTerm.trim();
    if (cleanSearch) {
      query = query.or(
        `description.ilike.%${cleanSearch}%,user_email.ilike.%${cleanSearch}%,action_type.ilike.%${cleanSearch}%`
      );
    }

    const { data, error, count } = await query;

    if (data && !error) {
      setLogs((prev) => [...prev, ...data]);
      setPage(nextPage);
      const totalLoaded = from + data.length;
      setHasMore(data.length === PAGE_SIZE && (count ? totalLoaded < count : true));
    }

    setLoadingMore(false);
  };

  // Debounced server search on user typing
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchLogs(searchTerm);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-brand-maroon flex items-center gap-2">
            <ShieldAlert className="w-6 h-6" />
            Global Audit Trail
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Immutable ledger of system activity and modifications.
          </p>
        </div>
        <button
          onClick={() => fetchLogs()}
          disabled={loading}
          className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-sm uppercase text-slate-800">System Activity</h3>
            <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {logs.length} loaded
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search across entire history..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-brand-maroon outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold sticky top-0 z-10">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">User</th>
                <th className="p-3">Action Type</th>
                <th className="p-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 font-bold animate-pulse">
                    Querying system ledger...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 italic">
                    No matching log entries found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 font-mono">
                    <td className="p-3 text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 font-bold text-slate-700">{log.user_email}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-bold text-[10px] uppercase">
                        {log.action_type}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 leading-relaxed">{log.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load More Controls */}
        {!loading && (
          <div className="pt-2 flex justify-center">
            {hasMore ? (
              <button
                onClick={loadMoreLogs}
                disabled={loadingMore}
                className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading next 50...</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>Show More 50</span>
                  </>
                )}
              </button>
            ) : (
              logs.length > 0 && (
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 py-2">
                  All {logs.length} entries loaded
                </p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}