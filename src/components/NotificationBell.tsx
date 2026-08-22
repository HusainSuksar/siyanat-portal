import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, Circle, Clock, X } from 'lucide-react';
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

  // Sync unread count to native device App Icon badge
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
        <>
          {/* Mobile Backdrop */}
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setIsOpen(false)} />
          
          {/* Responsive Dropdown: Fixed centered on mobile, absolute right-aligned on desktop */}
          <div className="fixed inset-x-4 top-16 md:inset-x-auto md:absolute md:right-0 md:top-auto md:mt-3 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[80vh] md:max-h-[450px] animate-in zoom-in-95 md:slide-in-from-top-2 duration-200">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-800 text-sm">Alerts</h3>
                {unreadCount > 0 && (
                  <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wider">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {notifications.length > 0 ? (
                notifications.map(notif => (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors flex gap-3 ${!notif.is_read ? 'bg-amber-50/40' : ''}`}
                  >
                    <div className="mt-1 shrink-0">
                      {!notif.is_read ? (
                        <Circle className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${!notif.is_read ? 'font-black text-slate-800' : 'font-semibold text-slate-600'}`}>
                        {notif.title}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed break-words">{notif.message}</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-1.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center flex flex-col items-center justify-center text-slate-400">
                  <Bell className="w-8 h-8 mb-2 opacity-20" />
                  <p className="font-bold text-xs uppercase tracking-wider">All caught up!</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}