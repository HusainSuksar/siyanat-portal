import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Wrench, Package, Calendar, Car, Clock, CheckCircle, ArrowRight } from 'lucide-react';
interface TrackerItem {
  id: string;
  type: 'Maintenance' | 'Material' | 'Event' | 'Fleet';
  title: string;
  subtitle: string;
  status: string;
  date: string;
  icon: any;
}

export default function MyRequests() {
  const { session } = useAuth();
  const [items, setItems] = useState<TrackerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPersonalRequests() {
      if (!session?.user?.id) return;
      setLoading(true);

      const userId = session.user.id;

      try {
        // Fetch all 4 request types simultaneously
        const [
          { data: complaints },
          { data: materials },
          { data: events },
          { data: fleet }
        ] = await Promise.all([
          supabase.from('complaints').select('complaint_id, category, venue, pipeline_state, created_at').eq('requester_id', userId),
          supabase.from('work_orders').select('id, batch_id, department, location, pipeline_state, created_at').eq('requester_id', userId),
          supabase.from('events').select('id, event_title, location, pipeline_state, created_at').eq('requester_id', userId),
          supabase.from('vehicle_requests').select('id, destination, purpose, pipeline_state, created_at').eq('requester_id', userId)
        ]);

        const unifiedList: TrackerItem[] = [];

        // Map Complaints
        if (complaints) {
          complaints.forEach(c => unifiedList.push({
            id: c.complaint_id, type: 'Maintenance', title: c.category, subtitle: c.venue, status: c.pipeline_state, date: c.created_at, icon: Wrench
          }));
        }

        // Map Materials
        if (materials) {
          materials.forEach(m => unifiedList.push({
            id: m.id, type: 'Material', title: `Batch ${m.batch_id}`, subtitle: `${m.department} - ${m.location}`, status: m.pipeline_state, date: m.created_at, icon: Package
          }));
        }

        // Map Events
        if (events) {
          events.forEach(e => unifiedList.push({
            id: e.id, type: 'Event', title: e.event_title, subtitle: e.location, status: e.pipeline_state, date: e.created_at, icon: Calendar
          }));
        }

        // Map Fleet
        if (fleet) {
          fleet.forEach(f => unifiedList.push({
            id: f.id, type: 'Fleet', title: f.destination, subtitle: f.purpose, status: f.pipeline_state, date: f.created_at, icon: Car
          }));
        }

        // Sort chronologically (newest first)
        unifiedList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setItems(unifiedList);
      } catch (error) {
        console.error("Error fetching requests:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPersonalRequests();
  }, [session]);

  // Helper to color-code status badges
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Pending Review' };
      case 'AUTHORIZED': return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Approved & Queued' };
      case 'PROCESSING': return { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'In Progress' };
      case 'ACTION_REQUIRED': return { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Action Needed' };
      case 'CLOSED': return { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Completed' };
      case 'REJECTED': return { bg: 'bg-red-100', text: 'text-red-800', label: 'Declined' };
      default: return { bg: 'bg-slate-100', text: 'text-slate-600', label: status };
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-4xl mx-auto animate-in fade-in duration-500">
      
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-brand-maroon/10 p-3 rounded-2xl">
            <Clock className="w-8 h-8 text-brand-maroon" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">My Personal Tracker</h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
              Live status of your submitted requests
            </p>
          </div>
        </div>
        <div className="hidden md:flex text-right flex-col">
          <span className="text-3xl font-black text-brand-maroon">{items.length}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Tickets</span>
        </div>
      </div>

      {/* Timeline List */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 min-h-[50vh]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-3">
            <div className="w-8 h-8 border-4 border-brand-maroon/20 border-t-brand-maroon rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Timeline...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-600">No active requests.</p>
              <p className="text-xs font-medium text-slate-400">Items you request will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:to-transparent">
            {items.map((item, idx) => {
              const Icon = item.icon;
              const statusCfg = getStatusConfig(item.status);
              const isClosed = item.status === 'CLOSED';
              const isRejected = item.status === 'REJECTED';

              return (
                <div key={`${item.id}-${idx}`} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                  
                  {/* Timeline Node Center */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white border-4 border-slate-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-brand-maroon absolute left-0 md:left-1/2 -ml-5 md:ml-0">
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Card Content */}
                  <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition ml-12 md:ml-0">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {item.type}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${statusCfg.bg} ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    
                    <h4 className={`font-black text-sm mb-1 ${isClosed || isRejected ? 'text-slate-500' : 'text-slate-800'}`}>
                      {item.title}
                    </h4>
                    <p className="text-xs font-semibold text-slate-500 line-clamp-1">{item.subtitle}</p>
                    
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span>{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="flex items-center gap-1 group-hover:text-brand-maroon transition-colors cursor-pointer">
                        View Details <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}