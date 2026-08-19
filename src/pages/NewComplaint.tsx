import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, Send, MapPin, Wrench, ImagePlus, Trash2, CheckCircle } from 'lucide-react';

const ZONES: Record<string, string[]> = {
  "Main Jamea Complex": [
    "Zainee Masjid/Sehen Ground Floor", "Zainee Masjid First Floor (Classes)", "Zainee Masjid - Offices", 
    "Zainee Masjid Bathrooms", "Zainee Masjid Outer Area", "Zainee Masjid (IT Room)",
    "Najmi Hall Ground Floor (Classes)", "Najmi Hall First Floor (Classes)", "Najmi Hall - Offices", 
    "Najmi Hall Bathrooms", "Najmi Hall Outer Area", "Najmi Hall Multi Purpose", "Najmi Hall - Library",
    "Saifee Masjid Ground Floor (Classes)", "Saifee Masjid Bathrooms", "Rajas Office", "Rajas Office Bathroom"
  ],
  "Rabwat (Girls Hostel)": [
    "Rabwat residence building", "Naashta Mawaid/Garden Room", "Mawaid Hall (Dinner Mawaid)", 
    "Mawaid Hall 1st floor (Maamal, library etc:-)", "Laundry"
  ],
  "Masakin (Boys Hostel)": [
    "Masakin Residence Building", "Computer Room", "Qasida Room", "Pantry", 
    "Bathrooms Ground Floor", "Bathrooms First Floor", "Bathrooms Second Floor", 
    "Reception/Office", "Luggage Room"
  ],
  "Mawaid": [
    "Mawaid Hall", "Kitchen", "Office", "Mawaid Bathrooms", "Zabihat Room", "Roti Room"
  ],
  "Khaimat al-Riyadat": [
    "Football/Cricket Ground", "Volleyball Court", "Indore Games Room", "Swimming Pool"
  ]
};

const CATEGORIES = [
  "Civil", "Electrical", "Plumbing", "Carpentry", "Housekeeping", 
  "Furniture", "Accessories", "HVAC", "Painting", "Pest Control", 
  "AVIT", "Space Shortage", "Other"
];

const PRIORITIES = [
  { id: 'Low (24–48 hrs)', label: 'Low (24–48 hrs)', desc: 'Minor repairs, squeaky doors, or loose furniture hinges.' },
  { id: 'Medium (12–24 hrs)', label: 'Medium (12–24 hrs)', desc: 'Single light/fan down, slow leaks, or routine appliance issues.' },
  { id: 'High (8–12 hrs)', label: 'High (8–12 hrs)', desc: 'Main washroom blockages or major appliances broken.' },
  { id: 'Emergency (2–4 hrs)', label: 'Emergency (2–4 hrs)', desc: 'Total power/water failure, severe leaks, or safety hazards.' }
];

export default function NewComplaint() {
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [successRef, setSuccessRef] = useState<string | null>(null);
  
  // RBAC State
  const [, setUserRole] = useState('REQUESTER');
  const [isSupervisor, setIsSupervisor] = useState(false);
  
  const [form, setForm] = useState({
    zone: '',
    venue: '',
    floor: '',
    roomArea: '',
    studentTr: '',
    category: '',
    priority: 'Medium (12–24 hrs)',
    description: ''
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      // Changed 'domain' to 'zone'
      const { data: profile } = await supabase.from('profiles').select('role, zone').eq('id', authData.user.id).single();
      if (profile) {
        setUserRole(profile.role);
        
        // Lock down zone for Supervisors
        if (profile.role === 'SUPERVISOR') {
          setIsSupervisor(true);
          if (profile.zone) {
            // Take the first zone if they are assigned multiple (e.g. "Mawaid, Masakin" -> "Mawaid")
            setForm(prev => ({ ...prev, zone: profile.zone.split(',')[0].trim() }));
          }
        }
      }
    }
  };

  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm({ ...form, zone: e.target.value, venue: '' });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setPhotos(prev => [...prev, ...newFiles]);
      
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPhotoPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const submitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Authentication required.");

      // 1. Insert Complaint Record 
      // THE FIX: Removed hardcoded status. DB sets pipeline_state to SUBMITTED automatically.
      const { data: complaintData, error: complaintError } = await supabase
        .from('complaints')
        .insert({
          requester_id: authData.user.id,
          zone: form.zone,
          venue: form.venue,
          floor: form.floor,
          room_area: form.roomArea,
          student_tr_no: form.studentTr,
          category: form.category,
          priority: form.priority,
          description: form.description
        })
        .select()
        .single();

      if (complaintError) throw complaintError;

      // 2. Upload Photos to Supabase Storage
      if (photos.length > 0) {
        for (const file of photos) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
          const filePath = `${complaintData.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('complaint_photos')
            .upload(filePath, file);

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('complaint_photos')
              .getPublicUrl(filePath);

            await supabase.from('complaint_photos').insert({
              complaint_id: complaintData.id,
              file_name: file.name,
              file_url: publicUrlData.publicUrl
            });
          }
        }
      }

      // Log to Audit Trail
      await supabase.from('system_logs').insert({
        action_type: 'COMPLAINT_REGISTERED',
        description: `Registered structural complaint ${complaintData.complaint_id} in ${form.zone}.`,
        user_email: authData.user.email || 'Requester'
      });

      // Show Success Modal
      setSuccessRef(complaintData.complaint_id);
      
      // Reset Form (Preserving Supervisor Zone)
      setForm(prev => ({ 
        zone: isSupervisor ? prev.zone : '', 
        venue: '', floor: '', roomArea: '', studentTr: '', 
        category: '', priority: 'Medium (12–24 hrs)', description: '' 
      }));
      setPhotos([]);
      setPhotoPreviews([]);

    } catch (err: any) {
      alert(`Error submitting complaint: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="p-4 bg-brand-maroon text-brand-gold rounded-2xl shadow-md shrink-0">
          <Wrench className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Register Maintenance Complaint</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Report structural, electrical, or plumbing issues.</p>
        </div>
      </div>

      <form onSubmit={submitComplaint} className="space-y-6">
        
        {/* SECTION 1: LOCATION */}
        <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
            <div className="bg-brand-maroon/10 p-2 rounded-xl">
              <MapPin className="w-5 h-5 text-brand-maroon" />
            </div>
            <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Location Details</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Zone *</label>
              <select 
                required 
                disabled={isSupervisor}
                value={form.zone} 
                onChange={handleZoneChange} 
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <option value="" disabled>-- Select Zone --</option>
                {Object.keys(ZONES).map(zone => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
              {isSupervisor && <p className="text-[9px] font-bold text-brand-maroon mt-1.5 uppercase">Locked to assigned domain</p>}
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Building / Venue *</label>
              <select required disabled={!form.zone} value={form.venue} onChange={e => setForm({...form, venue: e.target.value})} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm disabled:opacity-50">
                <option value="" disabled>{form.zone ? '-- Select Venue --' : 'Select Zone First'}</option>
                {form.zone && ZONES[form.zone].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              {form.zone === 'Mawaid' && (
                <p className="text-[10px] text-amber-600 font-bold mt-1.5 flex items-center gap-1">
                  ⚠️ Please be precise in your description for Mawaid venues.
                </p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Floor *</label>
              <input required type="text" value={form.floor} onChange={e => setForm({...form, floor: e.target.value})} placeholder="e.g. Ground Floor" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Room / Specific Area *</label>
              <input required type="text" value={form.roomArea} onChange={e => setForm({...form, roomArea: e.target.value})} placeholder="e.g. Room 201 Bathroom" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
            </div>
          </div>
        </div>

        {/* SECTION 2: ISSUE DETAILS */}
        <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
            <div className="bg-brand-maroon/10 p-2 rounded-xl">
              <Camera className="w-5 h-5 text-brand-maroon" />
            </div>
            <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Issue Description</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 mb-6">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Category *</label>
              <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm">
                <option value="" disabled>-- Select Category --</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Student TR No. (Optional)</label>
              <input type="text" value={form.studentTr} onChange={e => setForm({...form, studentTr: e.target.value})} placeholder="e.g. 24440" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Priority Level *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {PRIORITIES.map(p => (
                  <label key={p.id} className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition ${form.priority === p.id ? 'border-brand-maroon bg-brand-maroon/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <input type="radio" name="priority" value={p.id} checked={form.priority === p.id} onChange={() => setForm({...form, priority: p.id})} className="hidden" />
                    <span className={`text-xs font-black mb-1 ${form.priority === p.id ? 'text-brand-maroon' : 'text-slate-800'}`}>{p.label}</span>
                    <span className="text-[9px] font-bold text-slate-500 leading-tight">{p.desc}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Detailed Description *</label>
            <textarea required rows={4} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Please describe the issue in detail to help our technicians..." className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm resize-none"></textarea>
          </div>

          {/* PHOTO UPLOADER */}
          <div className="p-5 md:p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl transition hover:border-brand-maroon/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <span className="block text-sm font-black text-slate-800">Photo Evidence</span>
                <span className="text-xs font-bold text-slate-500">Upload images to help technicians understand the issue faster.</span>
              </div>
              <label className="cursor-pointer px-4 py-2.5 bg-white border border-slate-200 hover:border-brand-maroon hover:text-brand-maroon rounded-xl text-xs font-black uppercase tracking-wide flex items-center justify-center space-x-2 transition shadow-sm w-full sm:w-auto">
                <ImagePlus className="w-4 h-4" />
                <span>Browse Files</span>
                <input type="file" multiple accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              </label>
            </div>
            
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-4 animate-in fade-in duration-300">
                {photoPreviews.map((src, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white aspect-square shadow-sm">
                    <img src={src} alt="Preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removePhoto(idx)} className="absolute top-1.5 right-1.5 p-1.5 bg-red-500/90 text-white rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                      <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs md:text-sm uppercase tracking-widest rounded-2xl shadow-xl transition flex justify-center items-center space-x-2 disabled:opacity-70"
        >
          {loading ? (
            <span className="animate-pulse">Uploading Complaint & Photos...</span>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Submit Formal Complaint</span>
            </>
          )}
        </button>
      </form>

      {/* CREATIVE SUCCESS MODAL */}
      {successRef && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-5 shadow-inner">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 text-center mb-2">Complaint Logged!</h3>
            <p className="text-sm text-slate-500 text-center font-medium">
              Your maintenance request has been routed to the local Gatekeeper for review.
            </p>
            <div className="mt-5 w-full bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reference ID</span>
              <span className="text-lg font-black text-brand-maroon tracking-wider">{successRef}</span>
            </div>
            <button 
              onClick={() => setSuccessRef(null)} 
              className="mt-6 w-full py-3.5 bg-slate-900 text-white font-black uppercase tracking-wide text-xs rounded-xl hover:bg-black transition shadow-lg"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}