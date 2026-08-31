import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Users, Shield, UserCog, Edit, Trash2, X, Save, UserPlus, Phone, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';

// 1. Initialize a secondary client explicitly for provisioning users
// This prevents Supabase from destroying the Admin's active session upon user creation.
const authProvisionClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

const AVAILABLE_ZONES = [
  "Main Jamea Complex",
  "Rabwat (Girls Hostel)",
  "Masakin (Boys Hostel)",
  "Mawaid",
  "Khaimat al-Riyadat"
];

const AVAILABLE_TRADES = [
  "Plumbing", "Electrical", "Carpentry", "Civil", "HVAC", "Housekeeping", "Cleaning", "General"
];

export default function TeamManagement() {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Single Add / Edit Modal States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: '', 
    email: '', 
    phone_number: '',
    department: '', 
    its_number: '', 
    role: 'REQUESTER', 
    zone: '', 
    trade: ''
  });

  // Bulk Upload Modal States
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ total: number; current: number; failed: number }>({ total: 0, current: 0, failed: 0 });
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Multi-Select States
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('role', { ascending: true })
      .order('full_name', { ascending: true });

    if (data && !error) setTeam(data);
    setLoading(false);
  };

  const toggleZone = (zone: string) => {
    setSelectedZones(prev => prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]);
  };

  const toggleTrade = (trade: string) => {
    setSelectedTrades(prev => prev.includes(trade) ? prev.filter(t => t !== trade) : [...prev, trade]);
  };

  // --- SINGLE USER REGISTRATION ---
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('new-user');

    const cleanEmail = newUser.email.trim().toLowerCase();
    const cleanPassword = '786110'; 

    try {
      // FIX: Use the isolated provision client to prevent session hijacking
      const { data: authData, error: authError } = await authProvisionClient.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: { data: { full_name: newUser.full_name } }
      });

      if (authError) throw authError;

      if (authData.user) {
        const zoneString = newUser.role === 'SUPERVISOR' ? selectedZones.join(', ') : null;
        const tradeString = newUser.role === 'EXECUTOR' ? selectedTrades.join(', ') : null;

        const payload = {
          id: authData.user.id,
          full_name: newUser.full_name,
          phone_number: newUser.phone_number.trim() || null,
          department: newUser.department,
          its_number: newUser.its_number || null,
          role: newUser.role,
          zone: zoneString,
          trade: tradeString,
        };

        // Use the main client (Admin Session) to execute the DB insert
        const { error: profileError } = await supabase.from('profiles').upsert(payload);
        if (profileError) throw profileError;

        const { data: adminData } = await supabase.auth.getUser();
        await supabase.from('system_logs').insert({
          action_type: 'USER_CREATED',
          description: `Admin registered new user: ${newUser.full_name} (${cleanEmail}) as ${newUser.role}.`,
          user_email: adminData?.user?.email || 'System Admin'
        });

        alert(`User Registered Successfully!\n\nEmail: ${cleanEmail}\nPassword: ${cleanPassword}`);
        setAddModalOpen(false);
        setNewUser({ full_name: '', email: '', phone_number: '', department: '', its_number: '', role: 'REQUESTER', zone: '', trade: '' });
        setSelectedZones([]); setSelectedTrades([]);
        fetchTeam();
      }
    } catch (err: any) {
      alert("Registration Error: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // --- BULK CSV DOWNLOAD & UPLOAD ---
  const downloadSampleCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "full_name,email,phone_number,department,its_number,role,zone,trade\n" +
      "Murtaza Ali,murtaza@jamea.edu,+919876543210,IT Support,12345678,REQUESTER,,\n" +
      "Husain Electric,husain.elec@jamea.edu,+919876543211,Maintenance,87654321,EXECUTOR,,Electrical; Plumbing\n" +
      "Taher Supervisor,taher.sup@jamea.edu,+919876543212,Facilities,11223344,SUPERVISOR,Main Jamea Complex; Mawaid,";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bulk_users_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows: any[] = results.data;
        if (rows.length === 0) {
          alert("The uploaded CSV file is empty.");
          return;
        }

        setIsBulkProcessing(true);
        setBulkErrors([]);
        setBulkProgress({ total: rows.length, current: 0, failed: 0 });

        let successCount = 0;
        let failCount = 0;
        const errMessages: string[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const cleanEmail = (row.email || '').trim().toLowerCase();
          const cleanName = (row.full_name || '').trim();
          const cleanRole = (row.role || 'REQUESTER').trim().toUpperCase();

          if (!cleanEmail || !cleanName) {
            failCount++;
            errMessages.push(`Row ${i + 1}: Missing name or email.`);
            setBulkProgress(prev => ({ ...prev, current: i + 1, failed: failCount }));
            continue;
          }

          try {
            // FIX: Use the isolated provision client inside the loop
            const { data: authData, error: authError } = await authProvisionClient.auth.signUp({
              email: cleanEmail,
              password: '786110',
              options: { data: { full_name: cleanName } }
            });

            if (authError) throw authError;

            if (authData.user) {
              const zoneFormatted = row.zone ? row.zone.replace(/;/g, ',').trim() : null;
              const tradeFormatted = row.trade ? row.trade.replace(/;/g, ',').trim() : null;

              const payload = {
                id: authData.user.id,
                full_name: cleanName,
                phone_number: row.phone_number ? row.phone_number.trim() : null,
                department: row.department ? row.department.trim() : 'General',
                its_number: row.its_number ? row.its_number.trim() : null,
                role: cleanRole,
                zone: cleanRole === 'SUPERVISOR' ? zoneFormatted : null,
                trade: cleanRole === 'EXECUTOR' ? tradeFormatted : null,
              };

              // Main client processes the upsert using Admin privileges
              const { error: profileError } = await supabase.from('profiles').upsert(payload);
              if (profileError) throw profileError;
              successCount++;
            }
          } catch (err: any) {
            failCount++;
            errMessages.push(`Row ${i + 1} (${cleanEmail}): ${err.message}`);
          }

          setBulkProgress({ total: rows.length, current: i + 1, failed: failCount });
        }

        setIsBulkProcessing(false);
        setBulkErrors(errMessages);
        fetchTeam();

        const { data: adminData } = await supabase.auth.getUser();
        await supabase.from('system_logs').insert({
          action_type: 'BULK_USERS_UPLOADED',
          description: `Admin processed bulk upload: ${successCount} created, ${failCount} failed.`,
          user_email: adminData?.user?.email || 'System Admin'
        });
      }
    });
  };

  // --- EDIT & DELETE LOGIC ---
  const openEditModal = (user: any) => {
    setEditingUser({ ...user });
    if (user.role === 'SUPERVISOR' && user.zone) {
      setSelectedZones(user.zone.split(',').map((s: string) => s.trim()));
    } else {
      setSelectedZones([]);
    }

    if (user.role === 'EXECUTOR' && user.trade) {
      setSelectedTrades(user.trade.split(',').map((s: string) => s.trim()));
    } else {
      setSelectedTrades([]);
    }
    setEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setProcessingId(editingUser.id);

    const zoneString = editingUser.role === 'SUPERVISOR' ? selectedZones.join(', ') : null;
    const tradeString = editingUser.role === 'EXECUTOR' ? selectedTrades.join(', ') : null;

    const payload = {
      full_name: editingUser.full_name,
      phone_number: editingUser.phone_number ? editingUser.phone_number.trim() : null,
      department: editingUser.department,
      its_number: editingUser.its_number,
      role: editingUser.role,
      zone: zoneString,
      trade: tradeString,
    };

    const { error } = await supabase.from('profiles').update(payload).eq('id', editingUser.id);

    if (!error) {
      const { data: authData } = await supabase.auth.getUser();
      await supabase.from('system_logs').insert({
        action_type: 'PROFILE_UPDATED',
        description: `Admin updated profile for ${editingUser.full_name}. Role set to ${editingUser.role}.`,
        user_email: authData.user?.email || 'System Admin'
      });
      alert('User profile updated successfully!');
      setEditModalOpen(false);
      fetchTeam();
    } else {
      alert("Error updating user: " + error.message);
    }
    setProcessingId(null);
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`CRITICAL WARNING: Are you sure you want to completely delete ${name} from the portal? This cannot be undone.`)) return;
    setProcessingId(id);
    const { error } = await supabase.from('profiles').delete().eq('id', id);

    if (!error) {
      const { data: authData } = await supabase.auth.getUser();
      await supabase.from('system_logs').insert({
        action_type: 'USER_DELETED',
        description: `Admin deleted the profile of ${name}.`,
        user_email: authData.user?.email || 'System Admin'
      });
      alert('User deleted successfully.');
      fetchTeam();
    } else {
      alert("Cannot delete user. They likely have existing data tied to their account. Demote them to 'REQUESTER' instead.");
    }
    setProcessingId(null);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-brand-maroon flex items-center gap-2">
            <Users className="w-6 h-6" />
            Team & Access Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">Manage personnel, roles, and automated batch onboarding.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={() => { setBulkErrors([]); setBulkProgress({ total: 0, current: 0, failed: 0 }); setBulkModalOpen(true); }}
            className="flex-1 sm:flex-initial px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition flex items-center justify-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Bulk Upload</span>
          </button>
          <button 
            onClick={() => {
              setNewUser({ full_name: '', email: '', phone_number: '', department: '', its_number: '', role: 'REQUESTER', zone: '', trade: '' });
              setSelectedZones([]); setSelectedTrades([]);
              setAddModalOpen(true);
            }}
            className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition flex items-center justify-center space-x-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* --- Active Personnel Roster Table --- */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center space-x-2 border-b pb-3">
          <UserCog className="w-4 h-4 text-brand-maroon" />
          <h3 className="font-extrabold text-sm uppercase text-slate-800">Active Personnel Roster</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="p-3">Personnel Details</th>
                <th className="p-3">Contact Details</th>
                <th className="p-3">Department & ITS</th>
                <th className="p-3">Role Context</th>
                <th className="p-3 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500 font-medium animate-pulse">Loading personnel data...</td></tr>
              ) : team.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500 font-medium italic">No users found.</td></tr>
              ) : (
                team.map((user) => {
                  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
                  const isOpsHead = ['SIYANAT_HEAD', 'TANZEEM_HEAD', 'AVIT_HEAD'].includes(user.role);
                  const isDeptHead = user.role === 'DEPT_HEAD';
                  const isReceptionist = user.role === 'RECEPTIONIST';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{user.full_name || 'Unknown User'}</div>
                        <div className="text-[10px] text-slate-500">{user.email}</div>
                      </td>
                      <td className="p-3">
                        {user.phone_number ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Phone className="w-3 h-3" /> {user.phone_number}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-medium">No Phone</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-600">{user.department || 'Unassigned'}</div>
                        {user.its_number && <div className="text-[10px] text-brand-gold font-bold">ITS: {user.its_number}</div>}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold flex items-center w-max space-x-1 ${
                            isAdmin ? 'bg-brand-maroon text-brand-gold' 
                            : isOpsHead ? 'bg-indigo-100 text-indigo-800' 
                            : isDeptHead ? 'bg-purple-100 text-purple-800'
                            : isReceptionist ? 'bg-amber-100 text-amber-800' 
                            : 'bg-slate-100 text-slate-700'
                          }`}>
                            {(isAdmin || isOpsHead || isDeptHead) && <Shield className="w-3 h-3" />}
                            <span>{user.role.replace('_', ' ')}</span>
                          </span>
                          {user.role === 'SUPERVISOR' && user.zone && (
                            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Zone: {user.zone}</span>
                          )}
                          {user.role === 'EXECUTOR' && user.trade && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Trade: {user.trade}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openEditModal(user)}
                            disabled={processingId === user.id}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition disabled:opacity-50"
                            title="Edit User"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id, user.full_name)}
                            disabled={processingId === user.id}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition disabled:opacity-50"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- BULK UPLOAD MODAL --- */}
      {bulkModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-brand-gold" />
                <h3 className="font-extrabold text-sm uppercase tracking-wide">Bulk Upload Personnel</h3>
              </div>
              {!isBulkProcessing && (
                <button onClick={() => setBulkModalOpen(false)}>
                  <X className="w-5 h-5 hover:text-red-300" />
                </button>
              )}
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase">Download Sample CSV</h4>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Use this template format for your spreadsheet.</p>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleCSV}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-brand-maroon" />
                  <span>Template</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div 
                onClick={() => !isBulkProcessing && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                  isBulkProcessing ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50' : 'border-slate-300 hover:border-brand-maroon hover:bg-brand-maroon/5'
                }`}
              >
                <Upload className="w-8 h-8 text-brand-maroon mx-auto mb-2" />
                <p className="text-xs font-black text-slate-700 uppercase">Click to Select CSV File</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Default password for all users will be 786110</p>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  disabled={isBulkProcessing}
                />
              </div>

              {/* Progress Bar */}
              {bulkProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>Processing: {bulkProgress.current} / {bulkProgress.total}</span>
                    <span>{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Log Container */}
              {bulkErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-3.5 rounded-2xl max-h-32 overflow-y-auto space-y-1 text-[11px] text-red-700">
                  <div className="font-black uppercase flex items-center gap-1 mb-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Upload Failures ({bulkErrors.length})
                  </div>
                  {bulkErrors.map((err, i) => (
                    <div key={i} className="font-semibold">• {err}</div>
                  ))}
                </div>
              )}

              {bulkProgress.total > 0 && bulkProgress.current === bulkProgress.total && bulkProgress.failed === 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" /> All {bulkProgress.total} users registered and configured successfully!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT USER MODAL --- */}
      {(addModalOpen || editModalOpen) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className={addModalOpen ? "bg-brand-maroon p-4 flex justify-between items-center text-white" : "bg-slate-800 p-4 flex justify-between items-center text-white"}>
              <h3 className="font-extrabold text-sm uppercase">{addModalOpen ? 'Register New Team Member' : `Edit Profile: ${editingUser?.full_name}`}</h3>
              <button onClick={() => { setAddModalOpen(false); setEditModalOpen(false); }}><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            
            <form onSubmit={addModalOpen ? handleAddUser : handleUpdateUser} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {addModalOpen && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-[10px] text-amber-800 font-bold mb-4">
                  Note: The user will be created with the default password <span className="bg-amber-200 px-1 rounded">786110</span>.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                  <input required type="text" value={addModalOpen ? newUser.full_name : editingUser.full_name} onChange={e => addModalOpen ? setNewUser({...newUser, full_name: e.target.value}) : setEditingUser({...editingUser, full_name: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"/>
                </div>
                
                {addModalOpen && (
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Email Address (Login ID) *</label>
                    <input required type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"/>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" /> WhatsApp / Contact Phone Number
                  </label>
                  <input 
                    type="tel" 
                    placeholder="e.g. +91 98765 43210"
                    value={addModalOpen ? newUser.phone_number : editingUser.phone_number || ''} 
                    onChange={e => addModalOpen ? setNewUser({...newUser, phone_number: e.target.value}) : setEditingUser({...editingUser, phone_number: e.target.value})} 
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"
                  />
                  <p className="text-[9px] text-slate-400 mt-0.5">Required for instant WhatsApp maintenance dispatches.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Department</label>
                  <input required={(addModalOpen ? newUser.role : editingUser.role) === 'DEPT_HEAD'} type="text" value={addModalOpen ? newUser.department : editingUser.department || ''} onChange={e => addModalOpen ? setNewUser({...newUser, department: e.target.value}) : setEditingUser({...editingUser, department: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon" placeholder="e.g. Arabic Literature"/>
                </div>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">ITS Number</label>
                  <input type="text" value={addModalOpen ? newUser.its_number : editingUser.its_number || ''} onChange={e => addModalOpen ? setNewUser({...newUser, its_number: e.target.value}) : setEditingUser({...editingUser, its_number: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"/>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-brand-maroon" /> System Role *
                </label>
                <select 
                  required
                  value={addModalOpen ? newUser.role : editingUser.role} 
                  onChange={e => {
                    const r = e.target.value;
                    addModalOpen ? setNewUser({...newUser, role: r}) : setEditingUser({...editingUser, role: r});
                    setSelectedZones([]); setSelectedTrades([]);
                  }} 
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
                >
                  <option value="REQUESTER">Standard Requester</option>
                  <option value="DEPT_HEAD">Department Head</option>
                  <option value="SUPERVISOR">Zone Supervisor</option>
                  <option value="EXECUTOR">Field Technician / Executor</option>
                  <option value="SIYANAT_HEAD">Siyanat Head</option>
                  <option value="TANZEEM_HEAD">Tanzeem Head</option>
                  <option value="AVIT_HEAD">AVIT Head</option>
                  <option value="RECEPTIONIST">Help Desk / Receptionist</option>
                  <option value="SUPER_ADMIN">System Administrator</option>
                </select>
              </div>

              {/* DYNAMIC MULTI-SELECT FOR SUPERVISORS */}
              {(addModalOpen ? newUser.role : editingUser.role) === 'SUPERVISOR' && (
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  <label className="block text-[11px] font-bold text-indigo-900 uppercase mb-2">Assign Zones (Select Multiple)</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {AVAILABLE_ZONES.map(zone => (
                      <label key={zone} className="flex items-center space-x-2 p-1 cursor-pointer hover:bg-indigo-100 rounded transition">
                        <input type="checkbox" checked={selectedZones.includes(zone)} onChange={() => toggleZone(zone)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                        <span className="text-xs font-bold text-indigo-900">{zone}</span>
                      </label>
                    ))}
                  </div>
                  {selectedZones.length === 0 && <p className="text-[9px] text-red-500 font-bold mt-2 uppercase">Please select at least one zone.</p>}
                </div>
              )}

              {/* DYNAMIC MULTI-SELECT FOR EXECUTORS (TECHNICIANS) */}
              {(addModalOpen ? newUser.role : editingUser.role) === 'EXECUTOR' && (
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <label className="block text-[11px] font-bold text-emerald-900 uppercase mb-2">Assign Trades (Select Multiple)</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {AVAILABLE_TRADES.map(trade => (
                      <label key={trade} className="flex items-center space-x-2 p-1 cursor-pointer hover:bg-emerald-100 rounded transition">
                        <input type="checkbox" checked={selectedTrades.includes(trade)} onChange={() => toggleTrade(trade)} className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500" />
                        <span className="text-xs font-bold text-emerald-900">{trade}</span>
                      </label>
                    ))}
                  </div>
                  {selectedTrades.length === 0 && <p className="text-[9px] text-red-500 font-bold mt-2 uppercase">Please select at least one trade.</p>}
                </div>
              )}

              <button 
                type="submit" 
                disabled={processingId === 'new-user' || processingId === editingUser?.id || ( ((addModalOpen ? newUser.role : editingUser?.role) === 'SUPERVISOR' && selectedZones.length === 0) || ((addModalOpen ? newUser.role : editingUser?.role) === 'EXECUTOR' && selectedTrades.length === 0) )}
                className={`w-full py-3 mt-4 text-white font-extrabold text-xs uppercase rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 ${addModalOpen ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-black'}`}
              >
                {addModalOpen ? <><UserPlus className="w-4 h-4" /> Register User</> : <><Save className="w-4 h-4" /> Save Profile Changes</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}