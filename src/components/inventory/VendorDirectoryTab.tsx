import { useState, useEffect, useRef, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import { Tag, Upload, Download, FileSpreadsheet, X, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';

interface Props {
  vendors: any[];
  onRefresh: () => void;
}

const DEFAULT_CATEGORIES = [
  'Electrical',
  'Plumbing',
  'Carpentry',
  'Civil',
  'General / Stationary'
];

export default function VendorDirectoryTab({ vendors, onRefresh }: Props) {
  const { showToast } = useToast();
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCategory, setNewVendorCategory] = useState('Electrical');
  const [newVendorContact, setNewVendorContact] = useState('');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  // Price Catalog Modal States
  const [catalogModalVendor, setCatalogModalVendor] = useState<any | null>(null);
  const [vendorAgreements, setVendorAgreements] = useState<any[]>([]);
  const [loadingAgreements, setLoadingAgreements] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ total: 0, current: 0 });
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('vendor_categories')
        .select('name')
        .order('name');

      if (!error && data && data.length > 0) {
        const catNames = data.map((c: any) => c.name);
        setCategories(catNames);
        if (!catNames.includes(newVendorCategory)) {
          setNewVendorCategory(catNames[0]);
        }
      }
    };
    fetchCategories();
  }, []);

  const handleAddVendor = async (e: FormEvent) => {
    e.preventDefault();
    if (!newVendorName.trim()) return;

    const { error } = await supabase.from('vendors').insert({
      name: newVendorName.trim(),
      category: newVendorCategory,
      contact_info: newVendorContact.trim() || null
    });

    if (!error) {
      setNewVendorName('');
      setNewVendorContact('');
      showToast("Vendor registered!", "success");
      onRefresh();
    } else {
      showToast("Error adding vendor: " + error.message, "error");
    }
  };

  const toggleVendorStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('vendors').update({ is_active: !currentStatus }).eq('id', id);
    onRefresh();
  };

  // Open Vendor Price Catalog
  const openPriceCatalog = async (vendor: any) => {
    setCatalogModalVendor(vendor);
    setUploadErrors([]);
    setUploadProgress({ total: 0, current: 0 });
    setLoadingAgreements(true);

    const { data } = await supabase
      .from('vendor_price_agreements')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('item_name');

    setVendorAgreements(data || []);
    setLoadingAgreements(false);
  };

  // Download Sample Template for Client
  const downloadVendorTemplate = (vendorName: string) => {
    const csvContent = "data:text/csv;charset=utf-8," +
      "vendor_item_code,item_name,unit,unit_price,tax_rate\n" +
      "SKU-001,Finolex 2.5 sq mm Wire (Red),Coil,1850.00,18.00\n" +
      "SKU-002,Supreme PVC Pipe 1 inch,Length,320.00,18.00\n" +
      "SKU-003,Naphthalene Balls Grade A,Kg,145.00,5.00";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${vendorName.replace(/\s+/g, '_')}_Price_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk Upload File Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !catalogModalVendor) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows: any[] = results.data;
        if (rows.length === 0) return showToast("The CSV file is empty.", "warning");

        setIsBulkUploading(true);
        setUploadErrors([]);
        setUploadProgress({ total: rows.length, current: 0 });

        const errors: string[] = [];
        let successCount = 0;

        // Fetch master inventory to map inventory_id if matched
        const { data: invItems } = await supabase.from('inventory_items').select('id, name');
        const invMap = new Map((invItems || []).map(i => [i.name.trim().toLowerCase(), i.id]));

        for (let idx = 0; idx < rows.length; idx++) {
          const row = rows[idx];
          const itemName = (row.item_name || '').trim();
          const rate = parseFloat(row.unit_price) || 0;
          const tax = parseFloat(row.tax_rate) || 18.0;
          const unit = (row.unit || 'Pcs').trim();
          const itemCode = (row.vendor_item_code || '').trim() || null;

          if (!itemName || rate <= 0) {
            errors.push(`Row ${idx + 1}: Missing item name or invalid rate.`);
            continue;
          }

          const matchedInvId = invMap.get(itemName.toLowerCase()) || null;

          const { error } = await supabase.from('vendor_price_agreements').upsert({
            vendor_id: catalogModalVendor.id,
            inventory_id: matchedInvId,
            item_name: itemName,
            vendor_item_code: itemCode,
            unit: unit,
            unit_price: rate,
            tax_rate: tax,
            updated_at: new Date().toISOString()
          }, { onConflict: 'vendor_id,item_name' });

          if (error) {
            errors.push(`Row ${idx + 1} (${itemName}): ${error.message}`);
          } else {
            successCount++;
          }

          setUploadProgress({ total: rows.length, current: idx + 1 });
        }

        setIsBulkUploading(false);
        setUploadErrors(errors);
        showToast(`Imported ${successCount} prices for ${catalogModalVendor.name}!`, "success");

        // Reload current modal list
        openPriceCatalog(catalogModalVendor);
      }
    });
  };

  return (
    <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200 space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Manage Approved Vendors</h3>
        <p className="text-xs font-bold text-slate-400 mt-1">Register external suppliers and maintain their agreed price directories.</p>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleAddVendor} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
        <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Register New Vendor</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Vendor Name *</label>
            <input 
              required 
              type="text" 
              placeholder="e.g. Hakimi Hardware" 
              value={newVendorName} 
              onChange={e => setNewVendorName(e.target.value)} 
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Category *</label>
            <select 
              value={newVendorCategory} 
              onChange={e => setNewVendorCategory(e.target.value)} 
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Contact Info</label>
            <input 
              type="text" 
              placeholder="Phone or email..." 
              value={newVendorContact} 
              onChange={e => setNewVendorContact(e.target.value)} 
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none" 
            />
          </div>
        </div>
        <button type="submit" className="px-6 py-3 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition">
          Register Vendor
        </button>
      </form>

      {/* Vendor Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {vendors.map(v => (
          <div key={v.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between shadow-sm gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h5 className="font-bold text-slate-800 text-sm">{v.name}</h5>
                <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${v.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                  {v.is_active ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Category: {v.category}</p>
              {v.contact_info && <p className="text-[10px] text-slate-400 mt-0.5">{v.contact_info}</p>}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <button 
                onClick={() => openPriceCatalog(v)}
                className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
              >
                <Tag className="w-3.5 h-3.5" /> Price Catalog
              </button>

              <button 
                onClick={() => toggleVendorStatus(v.id, v.is_active)} 
                className={`px-3 py-2 rounded-xl text-xs font-bold transition ${v.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
              >
                {v.is_active ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Price Catalog Management Modal */}
      {catalogModalVendor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="font-extrabold text-sm uppercase flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-brand-gold" /> {catalogModalVendor.name} — Price Directory
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">Agreed Contract Pricing</p>
              </div>
              <button onClick={() => setCatalogModalVendor(null)} className="hover:text-red-300 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Actions Header */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800">Bulk Ingestion</h4>
                  <p className="text-[10px] text-slate-500 font-bold">Upload CSV formatted price lists.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => downloadVendorTemplate(catalogModalVendor.name)}
                    className="flex-1 sm:flex-initial px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <Download className="w-3.5 h-3.5 text-brand-maroon" /> Template
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBulkUploading}
                    className="flex-1 sm:flex-initial px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload CSV
                  </button>
                  <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={handleFileUpload} 
                  />
                </div>
              </div>

              {/* Upload Progress */}
              {isBulkUploading && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-800 flex items-center justify-between">
                  <span>Importing rows: {uploadProgress.current} / {uploadProgress.total}</span>
                  <span className="animate-spin">⏳</span>
                </div>
              )}

              {/* Upload Errors */}
              {uploadErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 space-y-1 max-h-24 overflow-y-auto">
                  <div className="flex items-center gap-1 text-[11px] uppercase font-black">
                    <AlertCircle className="w-3.5 h-3.5" /> {uploadErrors.length} Issue(s) during import
                  </div>
                  {uploadErrors.map((err, i) => <div key={i}>• {err}</div>)}
                </div>
              )}

              {/* Agreements Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-black text-[10px]">
                    <tr>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">Unit</th>
                      <th className="p-3 text-right">Agreed Rate</th>
                      <th className="p-3 text-center">Tax (GST)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-bold">
                    {loadingAgreements ? (
                      <tr><td colSpan={4} className="p-6 text-center text-slate-400 animate-pulse">Loading catalog prices...</td></tr>
                    ) : vendorAgreements.length === 0 ? (
                      <tr><td colSpan={4} className="p-6 text-center text-slate-400 italic">No price agreements uploaded for this vendor yet.</td></tr>
                    ) : (
                      vendorAgreements.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 text-slate-800">
                            <div>{item.item_name}</div>
                            {item.vendor_item_code && (
                              <span className="text-[9px] text-slate-400 font-normal">Code: {item.vendor_item_code}</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-500">{item.unit || 'Pcs'}</td>
                          <td className="p-3 text-right font-black text-brand-maroon">₹{Number(item.unit_price).toFixed(2)}</td>
                          <td className="p-3 text-center text-slate-600">{item.tax_rate}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}