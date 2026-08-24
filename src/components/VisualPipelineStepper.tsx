import { Check, Clock, XCircle } from 'lucide-react';

interface StepperProps {
  type: 'COMPLAINT' | 'REQUISITION' | 'EVENT' | 'FLEET';
  pipelineState: string;
  eventDate?: string;
  timeSlot?: string;
}

const PERIOD_END_TIMES: Record<string, string> = {
  P1: '09:00', P2: '09:35', P3: '10:10', P4: '10:45', P5: '11:35',
  P6: '12:10', P7: '12:45', P8: '13:20', P9: '15:00', P10: '15:45'
};

export default function VisualPipelineStepper({ type, pipelineState, eventDate, timeSlot }: StepperProps) {
  if (pipelineState === 'REJECTED') {
    return (
      <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold mt-2.5">
        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
        <span>Request was reviewed and rejected. Check ticket thread for details.</span>
      </div>
    );
  }

  const complaintSteps = [
    { key: 'SUBMITTED', label: 'Logged', desc: 'Awaiting Supervisor' },
    { key: 'AUTHORIZED', label: 'Approved', desc: 'Routed to Siyanat' },
    { key: 'PROCESSING', label: 'In Progress', desc: 'Tech Dispatched' },
    { key: 'CLOSED', label: 'Resolved', desc: 'Verified & Closed' },
  ];

  const requisitionSteps = [
    { key: 'AUTHORIZED', label: 'Submitted', desc: 'Awaiting Split' },
    { key: 'PROCESSING', label: 'Allocated', desc: 'PO / Warehouse' },
    { key: 'ACTION_REQUIRED', label: 'Ready', desc: 'Ready for Pickup' },
    { key: 'CLOSED', label: 'Received', desc: 'Fulfilled' },
  ];

  const eventSteps = [
    { key: 'AUTHORIZED', label: 'Requested', desc: 'Under Review' },
    { key: 'PROCESSING', label: 'Approved', desc: 'Venue Scheduled' },
    { key: 'ACTIVE', label: 'Active', desc: 'Event Today' },
    { key: 'CLOSED', label: 'Completed', desc: 'Concluded' },
  ];

  const steps = type === 'COMPLAINT' 
    ? complaintSteps 
    : type === 'REQUISITION' 
      ? requisitionSteps 
      : eventSteps;

  const getStepIndex = () => {
    // DATE & TIME AWARE EVENT TIMELINE FIRST
    if (type === 'EVENT') {
      if (pipelineState === 'AUTHORIZED') return 0; // Step 1: Requested (Under Review)

      if (eventDate) {
        const now = new Date();
        const [year, month, day] = eventDate.split('-').map(Number);
        const eventDayStart = new Date(year, month - 1, day, 0, 0, 0);
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

        // 1. Future Date (e.g., 26/08/2026 or 31/08/2026) -> Force Step 2 (Venue Scheduled)
        if (eventDayStart.getTime() > todayStart.getTime()) {
          return 1;
        }

        // 2. Past Date -> Force Step 4 (Completed)
        if (eventDayStart.getTime() < todayStart.getTime()) {
          return 4;
        }

        // 3. Event is TODAY -> Check exact end time
        let endHour = 23;
        let endMin = 59;

        if (timeSlot) {
          const pMatch = timeSlot.match(/P\d+/g);
          if (pMatch && pMatch.length > 0) {
            const lastPeriod = pMatch[pMatch.length - 1];
            if (PERIOD_END_TIMES[lastPeriod]) {
              const [h, m] = PERIOD_END_TIMES[lastPeriod].split(':').map(Number);
              endHour = h;
              endMin = m;
            }
          } else {
            const customMatch = timeSlot.match(/(\d{2}):(\d{2})/g);
            if (customMatch && customMatch.length > 0) {
              const lastTime = customMatch[customMatch.length - 1];
              const [h, m] = lastTime.split(':').map(Number);
              endHour = h;
              endMin = m;
            }
          }
        }

        const eventEndTime = new Date(year, month - 1, day, endHour, endMin, 0);
        if (now.getTime() >= eventEndTime.getTime()) {
          return 4; // Completed once slot ends
        }

        return 2; // Active today during/before slot
      }

      if (pipelineState === 'CLOSED') return 4;
      return 1;
    }

    // NON-EVENT PIPELINES (Requisitions, Complaints, Fleet)
    if (pipelineState === 'CLOSED') return 4;

    if (type === 'REQUISITION') {
      if (pipelineState === 'AUTHORIZED') return 0;
      if (pipelineState === 'PROCESSING') return 1;
      if (pipelineState === 'ACTION_REQUIRED') return 2;
    }

    if (type === 'COMPLAINT') {
      if (pipelineState === 'SUBMITTED') return 0;
      if (pipelineState === 'AUTHORIZED') return 1;
      if (pipelineState === 'PROCESSING') return 2;
    }

    if (type === 'FLEET') {
      if (pipelineState === 'AUTHORIZED') return 0;
      if (pipelineState === 'PROCESSING') return 1;
      if (pipelineState === 'ACTION_REQUIRED') return 2;
    }

    return 0;
  };

  const currentIdx = getStepIndex();
  const isAllClosed = currentIdx === 4;

  return (
    <div className="w-full mt-3 pt-3 border-t border-slate-100">
      <div className="grid grid-cols-4 relative">
        <div className="absolute top-3 left-[12.5%] right-[12.5%] h-0.5 bg-slate-200 -z-0">
          <div
            className="h-full bg-brand-maroon transition-all duration-500"
            style={{ width: `${Math.min(100, (currentIdx / (steps.length - 1)) * 100)}%` }}
          />
        </div>

        {steps.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx && !isAllClosed;

          return (
            <div key={step.key} className="flex flex-col items-center text-center relative z-10">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                  isCompleted
                    ? 'bg-brand-maroon text-brand-gold shadow-sm'
                    : isCurrent
                    ? 'bg-brand-maroon text-white ring-4 ring-brand-maroon/20 animate-pulse'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : isCurrent ? <Clock className="w-3.5 h-3.5" /> : idx + 1}
              </div>
              <span className={`text-[9px] font-black uppercase mt-1.5 ${isCurrent ? 'text-brand-maroon' : isCompleted ? 'text-slate-800' : 'text-slate-400'}`}>
                {step.label}
              </span>
              <span className="text-[8px] font-semibold text-slate-400 hidden sm:block leading-tight">
                {step.desc}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}