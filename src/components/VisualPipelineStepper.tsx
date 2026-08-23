import { Check, Clock, XCircle } from 'lucide-react';

interface StepperProps {
  type: 'COMPLAINT' | 'REQUISITION' | 'EVENT' | 'FLEET';
  pipelineState: string;
}

export default function VisualPipelineStepper({ type, pipelineState }: StepperProps) {
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
    { key: 'ACTION_REQUIRED', label: 'Active', desc: 'Event Today' },
    { key: 'CLOSED', label: 'Completed', desc: 'Concluded' },
  ];

  const steps = type === 'COMPLAINT' 
    ? complaintSteps 
    : type === 'REQUISITION' 
      ? requisitionSteps 
      : eventSteps;

  const getStepIndex = (state: string) => {
    if (state === 'SUBMITTED') return 0;
    if (state === 'AUTHORIZED') return 1;
    if (state === 'PROCESSING') return 2;
    if (state === 'ACTION_REQUIRED') return 2;
    if (state === 'CLOSED') return 4; // Set to 4 so all 4 steps (0, 1, 2, 3) are marked completed with checkmarks
    return 0;
  };

  const currentIdx = getStepIndex(pipelineState);
  const isAllClosed = pipelineState === 'CLOSED';

  return (
    <div className="w-full mt-3 pt-3 border-t border-slate-100">
      <div className="grid grid-cols-4 relative">
        {/* Progress Track */}
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