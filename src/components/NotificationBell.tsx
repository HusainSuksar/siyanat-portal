import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, Circle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Sync unread count to the native device App Icon (iOS/Android/Desktop)
  useEffect(() => {
    const nav = navigator as any;
    if ('setAppBadge' in nav) {
      if (unreadCount > 0) {
        nav.setAppBadge(unreadCount).catch(() => {});
      } else {
        nav.clearAppBadge().catch(() => {});
      }
    }
  }, [unreadCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // THE FIX: Wait until the user session is fully verified before fetching
    if (!user) return; 

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('in_app_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchNotifications();

    // REAL-TIME LISTENER
    const uniqueChannelId = `siyanat_notifs_${user.id}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(uniqueChannelId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'in_app_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      await supabase.from('in_app_notifications').update({ is_read: true }).eq('id', notif.id);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    
    setIsOpen(false);
    if (notif.redirect_url) navigate(notif.redirect_url);
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('in_app_notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-brand-gold hover:bg-brand-dark rounded-full transition focus:outline-none"
      >
        <Bell className="w-5 h-5 md:w-6 md:h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-brand-maroon">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[400px] animate-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              Alerts
              {unreadCount > 0 && <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">{unreadCount} new</span>}
            </h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 uppercase">
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {notifications.map(notif => (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors flex gap-3 ${!notif.is_read ? 'bg-amber-50/40' : ''}`}
                  >
                    <div className="mt-1 shrink-0">
                      {!notif.is_read ? (
                        <Circle className="w-3 h-3 fill-amber-500 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div>
                      <p className={`text-xs ${!notif.is_read ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
                        {notif.title}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{notif.message}</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center text-slate-400">
                <Bell className="w-10 h-10 mb-3 opacity-20" />
                <p className="font-bold text-xs uppercase">All caught up!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}