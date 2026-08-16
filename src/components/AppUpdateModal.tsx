// src/components/AppUpdateModal.tsx
// Melding dat er een nieuwe versie klaarstaat. De service worker wacht tot de
// gebruiker hier op vernieuwen klikt, zodat je nooit midden in het invullen van
// een begroting wordt onderbroken.

import React from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

interface AppUpdateModalProps {
  registratie: ServiceWorkerRegistration | null;
  onSluiten: () => void;
}

const AppUpdateModal: React.FC<AppUpdateModalProps> = ({ registratie, onSluiten }) => {
  const vernieuw = () => {
    registratie?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onSluiten} />

      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-primary-600 to-primary-800 px-6 py-8 text-white text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-white/20 rounded-full p-3">
              <Sparkles className="h-8 w-8" aria-hidden />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-1">Nieuwe versie beschikbaar</h2>
          <p className="text-primary-100 text-sm">
            Vernieuw om met de laatste versie verder te werken.
          </p>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            Openstaande wijzigingen die je nog niet hebt opgeslagen gaan verloren bij het
            vernieuwen. Sla eerst je begroting op als je middenin een aanpassing zit.
          </p>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            type="button"
            onClick={onSluiten}
            className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Later
          </button>
          <button
            type="button"
            onClick={vernieuw}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-white shadow-glow-primary transition-colors"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Vernieuwen
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppUpdateModal;
