import { X, CheckCircle, Truck, Wrench, ShieldCheck, AlertCircle, Calendar, Car, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RoleAwareActionModal({ 
  ticket, 
  role, 
  onClose 
}: { 
  ticket: any;
  role: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  if (!ticket) return null;

  // 1. Identify Ticket Type safely
  const isComplaint = !!ticket.complaint_id;
  const isMaterial = !!ticket.batch_id;
  const isEvent = !!ticket.event_title;
  const isFleet = !!ticket.destination && !!ticket.purpose;

  // Extract common variables
  const state = ticket.pipeline_state;
  const displayId = isComplaint 
    ? ticket.complaint_id 
    : isMaterial 
      ? ticket.batch_id 
      : isEvent 
        ? ticket.event_title 
        : ticket.destination;
  const location = ticket.location || ticket.venue || ticket.destination;
  const requesterName = ticket.requester?.full_name || 'A user';

  // Master Access Control
  const isGodMode = role === 'SUPER_ADMIN' || role === 'ADMIN';

  // --- THE BRAIN: Determine Next Action Based on Role & State ---
  let primaryAction = null;
  let contextMessage = '';
  let highlightColor = 'text-slate-800';

  // A. REJECTIONS (Universal for Requesters)
  if (state === 'REJECTED') {
    contextMessage = `Your request for ${displayId} was reviewed and declined.`;
    highlightColor = 'text-red-700';
    primaryAction = {
      label: 'Acknowledge & Dismiss',
      icon: X,
      color: 'bg-red-600 hover:bg-red-700 text-white border-none',
      onClick: () => { onClose(); navigate('/my-requests'); }
    };
  }

  // B. COMPLAINTS (Maintenance)
  else if (isComplaint) {
    if (state === 'SUBMITTED' && (role === 'SUPERVISOR' || isGodMode)) {
      contextMessage = `A new maintenance issue was reported at ${location} by ${requesterName}. Requires Zone Supervisor approval.`;
      primaryAction = {
        label: 'Review in Supervisor Queue',
        icon: ShieldCheck,
        color: 'bg-amber-600 hover:bg-amber-700 text-white',
        onClick: () => { onClose(); navigate('/supervisor-queue'); }
      };
    } else if (state === 'PROCESSING' && (role === 'EXECUTOR' || role === 'TECHNICIAN' || isGodMode)) {
      contextMessage = `You have been assigned to resolve a ${ticket.category || 'Maintenance'} issue at ${location}.`;
      primaryAction = {
        label: 'Open Technician Portal',
        icon: Wrench,
        color: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        onClick: () => { onClose(); navigate('/technician-portal'); }
      };
    } else if (state === 'ACTION_REQUIRED') {
      if (role === 'SUPERVISOR' || isGodMode) {
        contextMessage = `Technician completed work at ${location}. Requires Supervisor verification and sign-off.`;
        primaryAction = {
          label: 'Verify in Supervisor Queue',
          icon: ShieldCheck,
          color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
          onClick: () => { onClose(); navigate('/supervisor-queue'); }
        };
      } else {
        contextMessage = `Technicians have marked your issue at ${location} as resolved. Please verify.`;
        primaryAction = {
          label: 'Verify & Close Ticket',
          icon: CheckCircle,
          color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
          onClick: () => { onClose(); navigate('/my-requests'); }
        };
      }
    }
  }

  // C. MATERIALS (Work Orders)
  else if (isMaterial) {
    if (state === 'SUBMITTED' && (role === 'DEPT_HEAD' || isGodMode)) {
      contextMessage = `${requesterName} submitted a material requisition. Requires Department Head review.`;
      primaryAction = {
        label: 'Review Requisition',
        icon: ClipboardList,
        color: 'bg-amber-600 hover:bg-amber-700 text-white',
        onClick: () => { onClose(); navigate('/my-requests'); }
      };
    } else if (state === 'AUTHORIZED' && (role === 'SIYANAT_HEAD' || role === 'TANZEEM_HEAD' || role === 'AVIT_HEAD' || isGodMode)) {
      contextMessage = `${requesterName} requested materials for ${location}. Items need stock allocation from Operations.`;
      primaryAction = {
        label: 'Split & Allocate Stock',
        icon: Truck,
        color: 'bg-brand-maroon hover:bg-brand-dark text-white',
        onClick: () => { onClose(); navigate('/siyanat-operations'); }
      };
    } else if (state === 'ACTION_REQUIRED') {
      contextMessage = `Your requested materials for Batch ${displayId} are ready for collection.`;
      primaryAction = {
        label: 'Confirm Material Receipt',
        icon: CheckCircle,
        color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        onClick: () => { onClose(); navigate('/my-requests'); }
      };
    }
  }

  // D. EVENTS (Tanzeem)
  else if (isEvent) {
    if ((state === 'SUBMITTED' || state === 'AUTHORIZED') && (role === 'TANZEEM_HEAD' || isGodMode)) {
      contextMessage = `New event booking request: "${displayId}" submitted by ${requesterName} for ${location}.`;
      primaryAction = {
        label: 'Review Event Booking',
        icon: Calendar,
        color: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        onClick: () => { onClose(); navigate('/tanzeem'); }
      };
    }
  }

  // E. FLEET (Transport)
  else if (isFleet) {
    if ((state === 'SUBMITTED' || state === 'AUTHORIZED') && (role === 'TANZEEM_HEAD' || isGodMode)) {
      contextMessage = `Vehicle request submitted by ${requesterName} for a trip to ${location}. Requires vehicle assignment.`;
      primaryAction = {
        label: 'Calculate & Assign Fleet',
        icon: Car,
        color: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        onClick: () => { onClose(); navigate('/tanzeem'); }
      };
    }
  }

  // F. FALLBACK (General Intimation)
  if (!contextMessage) {
    contextMessage = `Update regarding ${displayId}: Pipeline status is currently ${state}.`;
  }

  // Fixed Safe Route Fallback (prevents "No routes matched location /materials")
  const getFallbackRoute = () => {
    if (isComplaint) {
      if (role === 'SUPERVISOR') return '/supervisor-queue';
      if (role === 'TECHNICIAN' || role === 'EXECUTOR') return '/technician-portal';
      return '/my-requests';
    }
    if (isMaterial) {
      if (['SIYANAT_HEAD', 'TANZEEM_HEAD', 'AVIT_HEAD', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
        return '/siyanat-operations';
      }
      return '/my-requests';
    }
    if (isEvent || isFleet) {
      if (role === 'TANZEEM_HEAD' || isGodMode) return '/tanzeem';
      return '/my-requests';
    }
    return '/my-requests';
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex justify-center items-end sm:items-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 sm:zoom-in-95">
        
        {/* Header */}
        <div className="bg-slate-900 p-5 flex justify-between items-center text-white">
          <div>
            <h3 className="font-extrabold text-sm uppercase tracking-widest text-brand-gold">
              System Alert
            </h3>
            <p className="text-xs font-medium text-slate-400 mt-0.5 line-clamp-1">{displayId}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="flex items-start gap-3">
            {state === 'REJECTED' && <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />}
            <p className={`text-sm font-bold leading-relaxed ${highlightColor}`}>
              {contextMessage}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2">
            <div className="flex justify-between items-start gap-4">
              <span className="font-bold text-slate-500 uppercase shrink-0">Location:</span>
              <span className="font-black text-slate-800 text-right">{location}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="font-bold text-slate-500 uppercase">Status:</span>
              <span className="font-black text-brand-maroon">{state}</span>
            </div>
            {ticket.rejection_reason && (
              <div className="flex justify-between items-start gap-4 pt-1 border-t border-slate-200 mt-1">
                <span className="font-bold text-slate-500 uppercase shrink-0">Reason:</span>
                <span className="font-black text-red-600 text-right">{ticket.rejection_reason}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 space-y-3">
          {primaryAction && (
            <button 
              onClick={primaryAction.onClick}
              className={`w-full py-3.5 font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition flex items-center justify-center gap-2 ${primaryAction.color}`}
            >
              <primaryAction.icon className="w-4 h-4" /> {primaryAction.label}
            </button>
          )}
          
          <button 
            onClick={() => {
              onClose();
              navigate(getFallbackRoute());
            }}
            className="w-full py-3 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold text-xs uppercase tracking-widest rounded-xl border border-slate-200 shadow-sm transition"
          >
            View Full Ticket Data
          </button>
        </div>
      </div>
    </div>
  );
}