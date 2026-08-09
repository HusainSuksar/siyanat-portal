import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Send, MessageSquare } from 'lucide-react';

export default function BatchDetailsModal({ 
  batchId, 
  workOrderId, 
  isOpen, 
  onClose,
  currentUser 
}: { 
  batchId: string, 
  workOrderId: string, 
  isOpen: boolean, 
  onClose: () => void,
  currentUser: any 
}) {
  const [logs, setLogs] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !workOrderId) return;
    
    fetchLogs();

    // Listen for incoming chat messages in real-time
    const channel = supabase
      .channel(`chat_${workOrderId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'work_order_logs',
        filter: `work_order_id=eq.${workOrderId}`
      }, () => {
        fetchLogs(); // Refresh logs when a new message hits
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isOpen, workOrderId]);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('work_order_logs')
      .select('*, author:profiles(full_name, role)')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: true });

    if (!error && data) setLogs(data);
    setLoading(false);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const { error } = await supabase.from('work_order_logs').insert({
      work_order_id: workOrderId,
      author_id: currentUser.id,
      message: newMessage.trim(),
    });

    if (!error) setNewMessage('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">
        
        {/* Header */}
        <div className="bg-brand-maroon text-white p-4 flex justify-between items-center shadow-md">
          <div>
            <h2 className="font-extrabold text-sm uppercase text-brand-gold tracking-wide">Batch Thread</h2>
            <p className="text-xs">{batchId}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-brand-dark rounded transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat / Audit Log Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {loading ? (
            <p className="text-center text-xs text-slate-500 font-bold animate-pulse mt-10">Loading thread...</p>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
              <MessageSquare className="w-8 h-8 opacity-50" />
              <p className="text-xs font-medium">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            logs.map((log) => {
              const isMe = log.author_id === currentUser.id;
              const isAdmin = log.author?.role === 'ADMIN';

              return (
                <div key={log.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] font-bold text-slate-500 mb-1 px-1">
                    {log.author?.full_name} {isAdmin && <span className="text-brand-maroon">(Admin)</span>}
                  </span>
                  <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm ${
                    isMe 
                      ? 'bg-brand-maroon text-white rounded-tr-none' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                  }`}>
                    {log.message}
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 px-1">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200 pb-safe">
          <form onSubmit={sendMessage} className="flex items-center space-x-2">
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..." 
              className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-full text-sm focus:ring-2 focus:ring-brand-maroon outline-none transition"
            />
            <button 
              type="submit" 
              disabled={!newMessage.trim()}
              className="p-2.5 bg-brand-maroon hover:bg-brand-dark text-white rounded-full shadow-md transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
        
      </div>
    </div>
  );
}