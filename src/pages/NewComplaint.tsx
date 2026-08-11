import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, Send, MapPin, Wrench,  ImagePlus, Trash2 } from 'lucide-react';

export default function NewComplaint() {
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  
  const [form, setForm] = useState({
    zone: '',
    venue: '',
    floor: '',
    roomArea: '',
    studentTr: '',
    category: '',
    priority: 'Normal',
    description: ''
  });

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
          description: form.description,
          status: 'Pending Approval' // Will route to Zone Supervisor later
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

            // 3. Save photo reference to DB
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
        description: `Registered structural complaint ${complaintData.complaint_id} with ${photos.length} photos.`,
        user_email: authData.user.email || 'Requester'
      });

      alert(`Complaint Registered Successfully!\nReference ID: ${complaintData.complaint_id}`);
      
      // Reset Form
      setForm({ zone: '', venue: '', floor: '', roomArea: '', studentTr: '', category: '', priority: 'Normal', description: '' });
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
      <div className="flex items-center gap-3">
        <div className="p-3 bg-brand-maroon text-brand-gold rounded-xl shadow-md">
          <Wrench className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Register Maintenance Complaint</h2>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Report structural, electrical, or plumbing issues.</p>
        </div>
      </div>

      <form onSubmit={submitComplaint} className="space-y-6">
        
        {/* SECTION 1: LOCATION */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
            <MapPin className="w-5 h-5 text-brand-maroon" />
            <h3 className="font-extrabold text-sm uppercase text-slate-800">Location Details</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Zone *</label>
              <select required value={form.zone} onChange={e => setForm({...form, zone: e.target.value})} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none">
                <option value="" disabled>Select Zone</option>
                <option>Main Jamea Complex</option>
                <option>Rabwat</option>
                <option>Masakin</option>
                <option>Mawaid</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Building / Venue *</label>
              <input required type="text" value={form.venue} onChange={e => setForm({...form, venue: e.target.value})} placeholder="e.g. Block A" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Floor *</label>
              <input required type="text" value={form.floor} onChange={e => setForm({...form, floor: e.target.value})} placeholder="e.g. Ground Floor" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Room / Specific Area *</label>
              <input required type="text" value={form.roomArea} onChange={e => setForm({...form, roomArea: e.target.value})} placeholder="e.g. Room 201 Bathroom" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>
          </div>
        </div>

        {/* SECTION 2: ISSUE DETAILS */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
            <Camera className="w-5 h-5 text-brand-maroon" />
            <h3 className="font-extrabold text-sm uppercase text-slate-800">Issue Description</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Category *</label>
              <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none">
                <option value="" disabled>Select Type</option>
                <option>Plumbing</option>
                <option>Electrical</option>
                <option>Carpentry</option>
                <option>Civil</option>
                <option>HVAC / AC</option>
                <option>Cleaning</option>
                <option>General</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none">
                <option>Normal</option>
                <option>High</option>
                <option>URGENT (Immediate)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Student TR No. (Optional)</label>
              <input type="text" value={form.studentTr} onChange={e => setForm({...form, studentTr: e.target.value})} placeholder="e.g. 24440" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Detailed Description *</label>
            <textarea required rows={4} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Please describe the issue in detail..." className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-maroon outline-none"></textarea>
          </div>

          {/* PHOTO UPLOADER */}
          <div className="mt-5 p-5 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700">Photo Evidence (Optional)</span>
              <label className="cursor-pointer px-3 py-1.5 bg-white border border-slate-200 hover:border-brand-maroon hover:text-brand-maroon rounded-lg text-xs font-bold flex items-center space-x-1 transition shadow-sm">
                <ImagePlus className="w-4 h-4" />
                <span>Browse Files</span>
                <input type="file" multiple accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              </label>
            </div>
            
            {photoPreviews.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {photoPreviews.map((src, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white aspect-square">
                    <img src={src} alt="Preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removePhoto(idx)} className="absolute top-1 right-1 p-1 bg-red-500/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs font-medium">
                No photos selected. Upload images to help technicians understand the issue faster.
              </div>
            )}
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl transition flex justify-center items-center space-x-2 disabled:opacity-70"
        >
          {loading ? (
            <span>Uploading Complaint & Photos...</span>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Submit Formal Complaint</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}