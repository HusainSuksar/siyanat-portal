import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function usePushNotificationSync(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    const syncDeviceSubscription = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          const rawSub = subscription.toJSON();
          const endpoint = subscription.endpoint;
          const p256dh = rawSub.keys?.p256dh || '';
          const auth = rawSub.keys?.auth || '';

          if (endpoint && p256dh && auth) {
            // Upsert: Rebind this device endpoint to the newly logged-in user
            await supabase.from('user_push_subscriptions').upsert(
              {
                user_id: userId,
                endpoint,
                p256dh,
                auth,
                user_agent: navigator.userAgent
              },
              { onConflict: 'endpoint' }
            );
          }
        }
      } catch (err) {
        console.warn("Push sync bypassed:", err);
      }
    };

    syncDeviceSubscription();
  }, [userId]);
}