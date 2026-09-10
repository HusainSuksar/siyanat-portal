import { useState, useEffect, useRef, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import { Tag, Upload, Download, FileSpreadsheet, X, AlertCircle, History, ArrowRight, Layers } from 'lucide-react';
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

  // Price Catalog Modal States (Single Vendor)
  const [catalogModalVendor, setCatalogModalVendor] = useState<any | null>(null);
  const [vendorAgreements, setVendorAgreements] = useState<any[]>([]);
  const [loadingAgreements, setLoadingAgreements] = useState(false);
  const [isSingleUploading, setIsSingleUploading] = useState(false);
  const [singleProgress, setSingleProgress] = useState({ total: 0, current: 0 });
  const [singleErrors, setSingleErrors] = useState<string[]>([]);
  const singleFileInputRef = useRef<HTMLInputElement | null>(null);

  // Global Multi-Vendor Import Modal States
  const [globalModalOpen, setGlobalModalOpen] = useState(false);
  const [isGlobalProcessing, setIsGlobalProcessing] = useState(false);
  const [globalProgress, setGlobalProgress] = useState({ total: 0, current: 0, failed: 0 });
  const [globalErrors, setGlobalErrors] = useState<string[]>([]);
  const globalFileInputRef = useRef<HTMLInputElement | null>(null);

  // Price History Timeline States
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);
  const [priceHistoryLogs, setPriceHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

  const openPriceCatalog = async (vendor: any) => {
    setCatalogModalVendor(vendor);
    setSelectedHistoryItem(null);
    setSingleErrors([]);
    setSingleProgress({ total: 0, current: 0 });
    setLoadingAgreements(true);

    const { data } = await supabase
      .from('vendor_price_agreements')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('item_name');

    setVendorAgreements(data || []);
    setLoadingAgreements(false);
  };

  const viewItemPriceHistory = async (item: any) => {
    setSelectedHistoryItem(item);
    setLoadingHistory(true);

    const { data } = await supabase
      .from('vendor_price_history')
      .select('*')
      .eq('vendor_id', catalogModalVendor.id)
      .ilike('item_name', item.item_name.trim())
      .order('recorded_at', { ascending: false });

    setPriceHistoryLogs(data || []);
    setLoadingHistory(false);
  };

  // Download Single Vendor Template
  const downloadSingleVendorTemplate = (vendorName: string) => {
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

  // Upload Single Vendor CSV
  const handleSingleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !catalogModalVendor) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows: any[] = results.data;
        if (rows.length === 0) return showToast("The CSV file is empty.", "warning");

        setIsSingleUploading(true);
        setSingleErrors([]);
        setSingleProgress({ total: rows.length, current: 0 });

        const errors: string[] = [];
        let successCount = 0;

        const { data: invItems } = await supabase.from('inventory_items').select('id, name');
        const invMap = new Map((invItems || []).map(i => [i.name.trim().toLowerCase(), i.id]));

        for (let idx = 0; idx < rows.length; idx++) {
          const row = rows[idx];
          const itemName = (row.item_name || '').trim();
          const rate = parseFloat(row.unit_price) || 0;
          const parsedTax = parseFloat(row.tax_rate);
          const tax = isNaN(parsedTax) ? 18.0 : parsedTax;
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

          setSingleProgress({ total: rows.length, current: idx + 1 });
        }

        setIsSingleUploading(false);
        setSingleErrors(errors);
        showToast(`Imported ${successCount} prices for ${catalogModalVendor.name}!`, "success");
        openPriceCatalog(catalogModalVendor);
      }
    });
  };

  // Download Global Multi-Vendor Template
  const downloadGlobalTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," +
      "vendor_name,vendor_category,vendor_item_code,item_name,unit,unit_price,tax_rate\n" +
      "Hakimi Hardware,Electrical,HH-EL-001,Finolex 2.5 sq mm Wire (Red),Coil,1850.00,18.00\n" +
      "Sarovar,Plumbing,SAR-PL-045,Supreme PVC Pipe 1 inch,Length,320.00,18.00\n" +
      "CleanCare Supplies,General / Stationary,CC-CLN-01,Naphthalene Balls Grade A,Kg,145.00,5.00";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Multi_Vendor_Price_Directory_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Process Unified Master Multi-Vendor Sheet
  const handleGlobalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows: any[] = results.data;
        if (rows.length === 0) return showToast("The CSV file is empty.", "warning");

        setIsGlobalProcessing(true);
        setGlobalErrors([]);
        setGlobalProgress({ total: rows.length, current: 0, failed: 0 });

        const errors: string[] = [];
        let successCount = 0;
        let failCount = 0;

        const { data: freshVendors } = await supabase.from('vendors').select('id, name');
        const vendorMap = new Map((freshVendors || []).map(v => [v.name.trim().toLowerCase(), v.id]));

        const { data: invItems } = await supabase.from('inventory_items').select('id, name');
        const invMap = new Map((invItems || []).map(i => [i.name.trim().toLowerCase(), i.id]));

        for (let idx = 0; idx < rows.length; idx++) {
          const row = rows[idx];
          const rawVendor = (row.vendor_name || '').trim();
          const rawCat = (row.vendor_category || 'General / Stationary').trim();
          const itemName = (row.item_name || '').trim();
          const rate = parseFloat(row.unit_price) || 0;
          const parsedTax = parseFloat(row.tax_rate);
          const tax = isNaN(parsedTax) ? 18.0 : parsedTax;
          const unit = (row.unit || 'Pcs').trim();
          const itemCode = (row.vendor_item_code || '').trim() || null;
          if (!rawVendor || !itemName || rate <= 0) {
            failCount++;
            errors.push(`Row ${idx + 1}: Missing vendor name, item name, or valid rate.`);
            setGlobalProgress({ total: rows.length, current: idx + 1, failed: failCount });
            continue;
          }

          let vendorId = vendorMap.get(rawVendor.toLowerCase());

          if (!vendorId) {
            const { data: newV, error: vErr } = await supabase.from('vendors').insert({
              name: rawVendor,
              category: rawCat,
              is_active: true
            }).select('id, name').single();

            if (vErr || !newV) {
              failCount++;
              errors.push(`Row ${idx + 1}: Could not register vendor "${rawVendor}".`);
              setGlobalProgress({ total: rows.length, current: idx + 1, failed: failCount });
              continue;
            }

            vendorId = newV.id;
            vendorMap.set(rawVendor.toLowerCase(), vendorId);
          }

          const matchedInvId = invMap.get(itemName.toLowerCase()) || null;

          const { error: upsertErr } = await supabase.from('vendor_price_agreements').upsert({
            vendor_id: vendorId,
            inventory_id: matchedInvId,
            item_name: itemName,
            vendor_item_code: itemCode,
            unit: unit,
            unit_price: rate,
            tax_rate: tax,
            updated_at: new Date().toISOString()
          }, { onConflict: 'vendor_id,item_name' });

          if (upsertErr) {
            failCount++;
            errors.push(`Row ${idx + 1} (${itemName}): ${upsertErr.message}`);
          } else {
            successCount++;
          }

          setGlobalProgress({ total: rows.length, current: idx + 1, failed: failCount });
        }

        setIsGlobalProcessing(false);
        setGlobalErrors(errors);
        showToast(`Imported ${successCount} prices across vendors!`, "success");
        onRefresh();
      }
    });
  };

  return (
    <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200 space-y-6">
      <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Manage Approved Vendors</h3>
          <p className="text-xs font-bold text-slate-400 mt-1">Register suppliers, upload central catalogs, and track rate histories.</p>
        </div>
        <button
          onClick={() => { setGlobalErrors([]); setGlobalProgress({ total: 0, current: 0, failed: 0 }); setGlobalModalOpen(true); }}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center gap-2"
        >
          <Layers className="w-4 h-4" /> Global Catalog Ingest
        </button>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleAddVendor} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
        <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Register Single Vendor</h4>
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

      {/* GLOBAL MULTI-VENDOR IMPORT MODAL */}
      {globalModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            <div className="bg-indigo-700 p-5 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-gold" />
                <h3 className="font-extrabold text-sm uppercase tracking-wide">Bulk Master Price Sheet Ingestion</h3>
              </div>
              {!isGlobalProcessing && (
                <button onClick={() => setGlobalModalOpen(false)}><X className="w-5 h-5 hover:text-red-300" /></button>
              )}
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase">Download Master Format</h4>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Includes vendor names, items, units, and rates.</p>
                </div>
                <button
                  type="button"
                  onClick={downloadGlobalTemplate}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-brand-maroon" />
                  <span>Template</span>
                </button>
              </div>

              <div
                onClick={() => !isGlobalProcessing && globalFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${isGlobalProcessing ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50' : 'border-slate-300 hover:border-indigo-600 hover:bg-indigo-50/20'
                  }`}
              >
                <Upload className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                <p className="text-xs font-black text-slate-700 uppercase">Click to Select Master Price CSV</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Vendors not yet registered will be auto-created automatically.</p>
                <input
                  ref={globalFileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleGlobalFileUpload}
                  className="hidden"
                  disabled={isGlobalProcessing}
                />
              </div>

              {globalProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>Processed: {globalProgress.current} / {globalProgress.total}</span>
                    <span>{Math.round((globalProgress.current / globalProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${(globalProgress.current / globalProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {globalErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-3.5 rounded-2xl max-h-32 overflow-y-auto space-y-1 text-[11px] text-red-700">
                  <div className="font-black uppercase flex items-center gap-1 mb-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Import Errors ({globalErrors.length})
                  </div>
                  {globalErrors.map((err, i) => (
                    <div key={i} className="font-semibold">• {err}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SINGLE VENDOR PRICE CATALOG & HISTORY MODAL */}
      {catalogModalVendor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[88vh]">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="font-extrabold text-sm uppercase flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-brand-gold" /> {catalogModalVendor.name} — Price Directory
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">Agreed Contract Pricing & Audit History</p>
              </div>
              <button onClick={() => setCatalogModalVendor(null)} className="hover:text-red-300 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Single Vendor Ingestion Action Header */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800">Vendor Ingestion</h4>
                  <p className="text-[10px] text-slate-500 font-bold">Import catalog prices specifically for {catalogModalVendor.name}.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => downloadSingleVendorTemplate(catalogModalVendor.name)}
                    className="flex-1 sm:flex-initial px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <Download className="w-3.5 h-3.5 text-brand-maroon" /> Template
                  </button>
                  <button
                    onClick={() => singleFileInputRef.current?.click()}
                    disabled={isSingleUploading}
                    className="flex-1 sm:flex-initial px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload CSV
                  </button>
                  <input
                    ref={singleFileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleSingleFileUpload}
                  />
                </div>
              </div>

              {/* Single Upload Progress */}
              {isSingleUploading && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-800 flex items-center justify-between">
                  <span>Importing catalog: {singleProgress.current} / {singleProgress.total}</span>
                  <span className="animate-spin">⏳</span>
                </div>
              )}

              {/* Single Upload Errors */}
              {singleErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 space-y-1 max-h-24 overflow-y-auto">
                  <div className="flex items-center gap-1 text-[11px] uppercase font-black">
                    <AlertCircle className="w-3.5 h-3.5" /> {singleErrors.length} Issue(s) during import
                  </div>
                  {singleErrors.map((err, i) => <div key={i}>• {err}</div>)}
                </div>
              )}

              {/* Rate Fluctuation Audit Section */}
              {selectedHistoryItem && (
                <div className="bg-indigo-50/70 border border-indigo-200 p-4 rounded-2xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-indigo-700" />
                      <h5 className="text-xs font-black uppercase tracking-wider text-indigo-950">
                        Price History: {selectedHistoryItem.item_name}
                      </h5>
                    </div>
                    <button
                      onClick={() => setSelectedHistoryItem(null)}
                      className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-900"
                    >
                      Close History
                    </button>
                  </div>

                  {loadingHistory ? (
                    <div className="p-4 text-center text-xs font-bold text-indigo-400 animate-pulse">Loading price records...</div>
                  ) : priceHistoryLogs.length === 0 ? (
                    <div className="p-3 bg-white rounded-xl text-xs text-slate-500 font-bold italic text-center border border-indigo-100">
                      No previous price revisions recorded yet. Current rate: ₹{Number(selectedHistoryItem.unit_price).toFixed(2)}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {priceHistoryLogs.map((log) => (
                        <div key={log.id} className="bg-white p-2.5 rounded-xl border border-indigo-100 flex justify-between items-center text-xs shadow-sm">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">
                              {new Date(log.recorded_at).toLocaleDateString('en-GB')} • {log.source_type}
                            </span>
                            <span className="font-bold text-slate-700">{log.changed_by}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 line-through text-[11px]">₹{Number(log.old_price).toFixed(2)}</span>
                            <ArrowRight className="w-3 h-3 text-slate-300" />
                            <span className="font-black text-brand-maroon">₹{Number(log.new_price).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Agreements Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-black text-[10px]">
                    <tr>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">Unit</th>
                      <th className="p-3 text-right">Agreed Rate</th>
                      <th className="p-3 text-center">Tax (GST)</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-bold">
                    {loadingAgreements ? (
                      <tr><td colSpan={5} className="p-6 text-center text-slate-400 animate-pulse">Loading catalog prices...</td></tr>
                    ) : vendorAgreements.length === 0 ? (
                      <tr><td colSpan={5} className="p-6 text-center text-slate-400 italic">No price agreements uploaded for this vendor yet.</td></tr>
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
                          <td className="p-3 text-center">
                            <button
                              onClick={() => viewItemPriceHistory(item)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-800 rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1 mx-auto"
                              title="Audit Rate Changes"
                            >
                              <History className="w-3 h-3" /> History
                            </button>
                          </td>
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