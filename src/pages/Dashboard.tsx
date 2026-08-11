import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  FileText,
  Clock,
  Truck,
  CheckSquare,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import BatchDetailsModal from "../components/BatchDetailsModal";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    dispatched: 0,
    received: 0,
  });

  const [requisitions, setRequisitions] = useState<any[]>([]);

  // Chat Modal State
  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();

    if (authData.user) {
      setCurrentUser(authData.user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();
      const isAdmin = profile?.role === "ADMIN";

      // Requesters only see their own orders. Admins see all.
      let query = supabase
        .from("work_orders")
        .select("*, logs:work_order_logs(author_id)")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!isAdmin) {
        query = query.eq("requester_id", authData.user.id);
      }

      const { data: workOrders, error } = await query;

      if (!error && workOrders) {
        setRequisitions(workOrders);

        setStats({
          total: workOrders.length,
          pending: workOrders.filter((w) =>
            w.approval_status.includes("Pending"),
          ).length,
          dispatched: workOrders.filter(
            (w) => w.dispatch_status === "Dispatched",
          ).length,
          received: workOrders.filter((w) => w.dispatch_status === "Received")
            .length,
        });
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // --- CONFIRM RECEIPT LOGIC ---
  const confirmReceipt = async (batch: any) => {
    if (
      !confirm(
        "Confirm you have physically received these items? This will finalize the inventory deduction.",
      )
    )
      return;
    setProcessingId(batch.id);

    try {
      // 1. Fetch the items in this specific batch to un-freeze and deduct them
      const { data: items, error: itemsError } = await supabase
        .from("work_order_items")
        .select(
          "*, inventory:inventory_items(id, physical_stock, freezed_stock)",
        )
        .eq("work_order_id", batch.id)
        .eq("status", "Available"); // Only deduct items that were marked Available

      if (itemsError) throw itemsError;

      // 2. Loop through and process actual stock deduction
      if (items) {
        for (const item of items) {
          if (item.item_type === "Catalog" && item.inventory) {
            // Deduct from physical AND remove the freeze
            const newPhysical = Math.max(
              0,
              item.inventory.physical_stock - item.requested_qty,
            );
            const newFreezed = Math.max(
              0,
              item.inventory.freezed_stock - item.requested_qty,
            );

            await supabase
              .from("inventory_items")
              .update({
                physical_stock: newPhysical,
                freezed_stock: newFreezed,
              })
              .eq("id", item.inventory.id);
          }
        }
      }

      // 3. Update the batch status
      await supabase
        .from("work_orders")
        .update({ dispatch_status: "Received" })
        .eq("id", batch.id);

      // 4. Log the action
      await supabase.from("system_logs").insert({
        action_type: "ITEMS_RECEIVED",
        description: `Batch ${batch.batch_id} marked as received. Physical stock successfully deducted.`,
        user_email: currentUser?.email || "Requester",
      });

      alert("Receipt confirmed! Inventory finalized.");
      fetchDashboardData();
    } catch (err: any) {
      alert("Error confirming receipt: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const openChat = (batch: any) => {
    setActiveBatch(batch);
    setIsChatOpen(true);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-maroon to-brand-dark rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-brand-gold">
            Welcome to the Dashboard!
          </h2>
          <p className="text-xs text-slate-200">
            Track your material requisitions and maintenance requests.
          </p>
        </div>
        <button
          onClick={() => navigate("/new-requisition")}
          className="px-5 py-3 bg-brand-gold hover:bg-amber-500 text-brand-dark font-black text-xs rounded-xl shadow-lg transition"
        >
          + New Requisition
        </button>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase">
            <span>Total Requests</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-800 mt-1">
            {stats.total}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-xs text-amber-600 font-bold uppercase">
            <span>Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">
            {stats.pending}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-xs text-indigo-600 font-bold uppercase">
            <span>In Transit</span>
            <Truck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-600 mt-1">
            {stats.dispatched}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-xs text-emerald-600 font-bold uppercase">
            <span>Received</span>
            <CheckSquare className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">
            {stats.received}
          </div>
        </div>
      </div>

      {/* Requisition Activity Table */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
          <h3 className="font-extrabold text-sm uppercase text-slate-800">
            Your Recent Activity
          </h3>
          <button
            onClick={fetchDashboardData}
            className="text-xs text-brand-maroon font-bold flex items-center space-x-1 hover:text-brand-dark transition"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>{loading ? "Refreshing..." : "Live Refresh"}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="p-3">Batch ID</th>
                <th className="p-3">Location</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {requisitions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-500">
                    {loading
                      ? "Loading live activity..."
                      : "No requisitions recorded yet."}
                  </td>
                </tr>
              ) : (
                requisitions.map((req) => {
                  const logs = req.logs || [];
                  const hasUnread =
                    logs.length > 0 &&
                    logs[logs.length - 1].author_id !== currentUser?.id;

                  return (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-brand-maroon">
                        {req.batch_id}
                      </td>
                      <td className="p-3 font-semibold">{req.location}</td>
                      <td className="p-3">
                        <div className="flex flex-col space-y-1 items-start">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.approval_status === "Approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : req.approval_status === "Rejected"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {req.approval_status}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.dispatch_status === "Received"
                                ? "bg-emerald-100 text-emerald-800"
                                : req.dispatch_status === "Dispatched"
                                  ? "bg-indigo-100 text-indigo-800"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {req.dispatch_status}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* RECEIPT BUTTON */}
                          {req.dispatch_status === "Dispatched" && (
                            <button
                              onClick={() => confirmReceipt(req)}
                              disabled={processingId === req.id}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-sm flex items-center space-x-1 disabled:opacity-50"
                            >
                              <CheckSquare className="w-3 h-3" />
                              <span className="hidden sm:inline">
                                Confirm Receipt
                              </span>
                            </button>
                          )}

                          <button
                            onClick={() => openChat(req)}
                            className="relative px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-[11px] shadow-sm flex items-center space-x-1"
                          >
                            {hasUnread && (
                              <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white"></span>
                              </span>
                            )}
                            <MessageSquare className="w-3 h-3" />
                            <span className="hidden sm:inline">Thread</span>
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

      {/* Slide-out Chat Modal */}
      {activeBatch && currentUser && (
        <BatchDetailsModal
          batchId={activeBatch.batch_id}
          workOrderId={activeBatch.id}
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            setActiveBatch(null);
            fetchDashboardData();
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
