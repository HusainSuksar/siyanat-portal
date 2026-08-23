import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface WorkloadCounts {
  supervisorReview: number;
  materialDispatch: number;
  techTasks: number;
  pendingPOs: number;
}

export function useWorkloadBadges(userId: string | null, userRole: string | null) {
  const [counts, setCounts] = useState<WorkloadCounts>({
    supervisorReview: 0,
    materialDispatch: 0,
    techTasks: 0,
    pendingPOs: 0,
  });

  const fetchCounts = async () => {
    if (!userId || !userRole) return;

    try {
      // 1. Supervisor Pending Approvals
      let supervisorCount = 0;
      if (userRole === 'SUPERVISOR' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
        const { count } = await supabase
          .from('complaints')
          .select('id', { count: 'exact', head: true })
          .eq('pipeline_state', 'SUBMITTED');
        supervisorCount = count || 0;
      }

      // 2. Department Material Dispatches
      let dispatchCount = 0;
      if (['SIYANAT_HEAD', 'TANZEEM_HEAD', 'AVIT_HEAD', 'SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
        let query = supabase
          .from('work_orders')
          .select('id, items:work_order_items!inner(fulfillment_dept, status)', { count: 'exact', head: true })
          .in('pipeline_state', ['AUTHORIZED', 'PROCESSING'])
          .eq('items.status', 'Pending');

        if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
          query = query.eq('items.fulfillment_dept', userRole);
        }
        const { count } = await query;
        dispatchCount = count || 0;
      }

      // 3. Technician Active Tasks
      let techCount = 0;
      if (userRole === 'EXECUTOR' || userRole === 'TECHNICIAN' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
        const { count } = await supabase
          .from('technician_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('technician_id', userId)
          .eq('status', 'Assigned');
        techCount = count || 0;
      }

      // 4. Pending RTO Items (Ordered / Needs PO)
      let poCount = 0;
      if (['SIYANAT_HEAD', 'TANZEEM_HEAD', 'AVIT_HEAD', 'SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
        let query = supabase
          .from('work_order_items')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Ordered');

        if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
          query = query.eq('fulfillment_dept', userRole);
        }
        const { count } = await query;
        poCount = count || 0;
      }

      setCounts({
        supervisorReview: supervisorCount,
        materialDispatch: dispatchCount,
        techTasks: techCount,
        pendingPOs: poCount,
      });
    } catch (err) {
      console.warn('Error updating workload counts:', err);
    }
  };

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 20000); // Auto-refresh every 20 seconds
    return () => clearInterval(interval);
  }, [userId, userRole]);

  return counts;
}