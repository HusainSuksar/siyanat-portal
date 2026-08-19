import { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X, Smartphone, BellRing } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Helper function to decode the VAPID Public Key for the browser
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function InstallAppButton() {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [notifsEnabled, setNotifsEnabled] = useState(true);

  useEffect(() => {
    const isAppStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isAppStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    if ('Notification' in window) {
      setNotifsEnabled(Notification.permission === 'granted');
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // THE FIX: Silent Sync for Login Swaps
  useEffect(() => {
    const syncSubscription = async () => {
      if (user && 'Notification' in window && Notification.permission === 'granted') {
        try {
          if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
          
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          
          if (subscription) {
            const subJson = subscription.toJSON();
            // Automatically re-assign this device's token to the currently logged-in user
            await supabase.from('user_push_subscriptions').upsert({
              user_id: user.id,
              endpoint: subJson.endpoint,
              p256dh: subJson.keys?.p256dh,
              auth: subJson.keys?.auth,
              user_agent: navigator.userAgent
            }, { onConflict: 'endpoint' });
          }
        } catch (error) {
          console.error("Silent sync failed:", error);
        }
      }
    };

    syncSubscription();
  }, [user]);

  const enableNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported on this device/browser. iOS requires adding the app to your Home Screen first.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Notification permission denied. You can enable it in your device settings.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) throw new Error("VAPID Public Key missing in .env file.");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      const subJson = subscription.toJSON();
      if (user) {
        await supabase.from('user_push_subscriptions').upsert({
          user_id: user.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
          user_agent: navigator.userAgent
        }, { onConflict: 'endpoint' });
      }

      setNotifsEnabled(true);
      alert("Device registered! You will now receive lock-screen alerts.");
    } catch (error: any) {
      console.error('Push setup error:', error);
      alert('Failed to enable notifications. Error: ' + error.message);
    }
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setTimeout(() => enableNotifications(), 2000);
      }
    }
  };

  if (isStandalone && notifsEnabled) return null;

  return (
    <>
      <div className="flex flex-col gap-3 items-end">
        {!notifsEnabled && (
          <button 
            onClick={enableNotifications}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-full text-xs font-black uppercase tracking-widest shadow-xl transition-all border border-emerald-500 hover:scale-105 animate-in slide-in-from-bottom-4"
          >
            <BellRing className="w-4 h-4" /> Turn On Alerts
          </button>
        )}

        {!isStandalone && (isIOS || deferredPrompt) && (
          <button 
            onClick={handleInstallClick}
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white px-4 py-3 rounded-full text-xs font-black uppercase tracking-widest shadow-xl transition-all border border-slate-700 hover:scale-105 animate-in slide-in-from-bottom-2"
          >
            <Download className="w-4 h-4" /> Install App
          </button>
        )}
      </div>

      {showIOSModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 p-4 sm:p-0 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full sm:w-[400px] rounded-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                <Smartphone className="w-5 h-5 text-brand-maroon" /> Install on iPhone
              </h3>
              <button onClick={() => setShowIOSModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-xs text-slate-500 font-bold">Install Siyanat on your home screen to enable Native Push Notifications.</p>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-blue-500 shrink-0 border border-slate-200"><Share className="w-5 h-5 mb-1" /></div>
                  <p className="text-xs font-bold text-slate-700">1. Tap the <span className="text-blue-500">Share</span> icon at the bottom of Safari.</p>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-slate-700 shrink-0 border border-slate-200"><PlusSquare className="w-5 h-5" /></div>
                  <p className="text-xs font-bold text-slate-700">2. Scroll down and tap <br/><span className="text-slate-800 bg-slate-200 px-1.5 py-0.5 rounded uppercase text-[10px] tracking-wider">Add to Home Screen</span></p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button onClick={() => setShowIOSModal(false)} className="w-full py-3.5 bg-brand-maroon hover:bg-brand-dark text-white rounded-xl text-xs uppercase tracking-widest font-black shadow-md transition-colors">Got it, thanks!</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}