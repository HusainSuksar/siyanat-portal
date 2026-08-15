import { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    const isAppStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isAppStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  if (isStandalone) return null;
  if (!isIOS && !deferredPrompt) return null;

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  return (
    <>
      <button 
        onClick={handleInstallClick}
        className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white px-4 py-3 rounded-full text-xs font-black uppercase tracking-widest shadow-xl transition-all border border-slate-700 hover:scale-105"
      >
        <Download className="w-4 h-4" /> Install App
      </button>

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
              <p className="text-xs text-slate-500 font-bold">Install Siyanat on your home screen for quick access.</p>
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