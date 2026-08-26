import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { Calendar, Send, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import BookingForm from '../components/events/BookingForm';
import HeadcountEngine from '../components/events/HeadcountEngine';
import AssetRequester from '../components/events/AssetRequester';
import type { EventFormData, InventoryAsset, StandardAsset } from '../types/eventBooking';

const getMinBookingDate = () => {
  const now = new Date();
  if (now.getHours() >= 18) now.setDate(now.getDate() + 1);
  return now.toISOString().split('T')[0];
};

const INITIAL_FORM: EventFormData = {
  id: null, title: '', date: '', timingType: 'Between Classes',
  selectedPeriods: [], selectedAfterClass: [],
  location: '', subLocation: '', selectedClasses: [],
  maleCount: 0, femaleCount: 0, othersCount: 0, requirements: []
};

export default function BookEvent() {
  const { showToast, toasts, removeToast } = useToast();
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [userRole, setUserRole] = useState('REQUESTER');
  
  const [formData, setFormData] = useState<EventFormData>(INITIAL_FORM);
  const [inventory, setInventory] = useState<InventoryAsset[]>([]);
  const [standardAssets, setStandardAssets] = useState<StandardAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{ title: string; action: () => Promise<void> } | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      setCurrentUser({ id: authData.user.id, email: authData.user.email || '' });
      
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();
      setUserRole(profile?.role || 'REQUESTER');

      const [invRes, stdRes] = await Promise.all([
        supabase.from('inventory_items').select('*').order('name'),
        supabase.from('standard_event_assets').select('*').eq('is_active', true)
      ]);
      if (invRes.data) setInventory(invRes.data as InventoryAsset[]);
      if (stdRes.data) setStandardAssets(stdRes.data as StandardAsset[]);
    };
    init();
  }, []);

  useEffect(() => {
    const minDate = getMinBookingDate();
    if (formData.date && formData.date < minDate) {
      showToast("Cannot book past dates. Setting to earliest available.", "error");
      setFormData(prev => ({ ...prev, date: minDate }));
    }
  }, [formData.date, showToast]);

  const processSubmission = async () => {
    const totalCount = formData.maleCount + formData.femaleCount + formData.othersCount;
    if (totalCount === 0) {
      showToast("Headcount cannot be zero.", "error");
      return;
    }

    const requestedSlots = formData.timingType === 'Between Classes' ? formData.selectedPeriods : formData.selectedAfterClass;
    if (requestedSlots.length === 0) {
      showToast("Please select a time slot.", "error");
      return;
    }
    
    setLoading(true);
    setConfirmModalData(null);

    try {
      const { data, error } = await supabase.rpc('book_event_safely', {
        p_event_id: formData.id || null,
        p_requester_id: currentUser?.id || null,
        p_title: formData.title,
        p_date: formData.date,
        p_timing_type: formData.timingType,
        p_time_slot_string: requestedSlots.join(' | '),
        p_requested_slots: requestedSlots,
        p_location: formData.location,
        p_sub_location: formData.subLocation || null,
        p_darajah: formData.selectedClasses.join(', '),
        p_male: formData.maleCount,
        p_female: formData.femaleCount,
        p_others: formData.othersCount,
        p_total: totalCount,
        p_requirements: formData.requirements,
        p_user_email: currentUser?.email || null
      });

      if (error) throw error;
      
      if (data && data.success === false) {
        showToast(data.message.replace('DOUBLE_BOOKING: ', ''), "error");
        return;
      }
      
      showToast("Booking successfully processed! Routed to Operations.", "success");
      setFormData(INITIAL_FORM);
    } catch (err: any) {
      showToast(err.message?.replace('Exception: ', '') || "An error occurred", "error");
    } finally {
      setLoading(false);
    }
  };

  const attemptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmModalData({
      title: "Submit Event Booking?",
      action: processSubmission
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 relative">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl shadow-md bg-brand-maroon text-brand-gold">
          <Calendar className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Book Venue & Event</h2>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Request facilities, AVIT support, and schedule events.
          </p>
        </div>
      </div>

      <form onSubmit={attemptSubmit} className="space-y-6">
        <BookingForm formData={formData} setFormData={setFormData} isStandardUser={userRole === 'REQUESTER'} minBookingDate={getMinBookingDate()} />
        <HeadcountEngine formData={formData} setFormData={setFormData} />
        <AssetRequester formData={formData} setFormData={setFormData} inventory={inventory} standardAssets={standardAssets} showStockCount={userRole === 'SUPER_ADMIN' || userRole === 'SIYANAT_HEAD'} />

        <button type="submit" disabled={loading} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl transition flex justify-center items-center space-x-2 disabled:opacity-70">
          {loading ? <span>Verifying Schedule...</span> : <><Send className="w-5 h-5" /><span>Submit Event Booking</span></>}
        </button>
      </form>

      {/* Confirmation Modal */}
      {confirmModalData && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center animate-in zoom-in-95">
            <AlertTriangle className="w-12 h-12 text-brand-maroon mx-auto mb-4" />
            <h3 className="text-lg font-black text-slate-800 uppercase">{confirmModalData.title}</h3>
            <p className="text-xs text-slate-500 mt-2 mb-6">Confirm venue scheduling request details are correct.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmModalData(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition">Cancel</button>
              <button type="button" onClick={confirmModalData.action} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Toast Container */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} onClick={() => removeToast(t.id)} className={`p-4 rounded-2xl shadow-2xl text-white text-sm font-bold flex items-center gap-3 pointer-events-auto cursor-pointer animate-in slide-in-from-bottom-5 duration-300 ${t.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
            {t.type === 'error' ? <XCircle className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}