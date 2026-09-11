import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import RoleAwareActionModal from './RoleAwareActionModal';

export default function GlobalActionController() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const [targetTicket, setTargetTicket] = useState<any | null>(null);

  useEffect(() => {
    const actionId = searchParams.get('action_ticket');
    if (!actionId) return;

    const fetchTarget = async () => {
      // Clean up the URL query parameter silently so page refreshes don't re-trigger the modal
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action_ticket');
      setSearchParams(newParams, { replace: true });

      const cleanId = actionId.trim();

      // 1. Maintenance Complaint
      if (cleanId.startsWith('CMP-')) {
        const { data } = await supabase
          .from('complaints')
          .select('*, requester:profiles(full_name)')
          .ilike('complaint_id', cleanId)
          .maybeSingle();

        if (data) {
          setTargetTicket(data);
          return;
        }
      }

      // 2. Material Requisition
      if (cleanId.startsWith('BATCH-')) {
        const { data } = await supabase
          .from('work_orders')
          .select('*, requester:profiles(full_name)')
          .ilike('batch_id', cleanId)
          .maybeSingle();

        if (data) {
          setTargetTicket(data);
          return;
        }
      }

      // 3. Fallback check for Events or Fleet by UUID or identifier
      const uuidMatch = cleanId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (uuidMatch) {
        const id = uuidMatch[0];

        // Check events
        const { data: eventData } = await supabase
          .from('events')
          .select('*, requester:profiles(full_name)')
          .eq('id', id)
          .maybeSingle();

        if (eventData) {
          setTargetTicket(eventData);
          return;
        }

        // Check fleet
        const { data: fleetData } = await supabase
          .from('vehicle_requests')
          .select('*, requester:profiles(full_name)')
          .eq('id', id)
          .maybeSingle();

        if (fleetData) {
          setTargetTicket(fleetData);
          return;
        }
      }
    };

    fetchTarget();
  }, [searchParams, setSearchParams]);

  if (!targetTicket) return null;

  return (
    <RoleAwareActionModal
      ticket={targetTicket}
      role={role}
      onClose={() => setTargetTicket(null)}
    />
  );
}