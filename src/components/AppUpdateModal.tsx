import React from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  reg: ServiceWorkerRegistration | null;
  onDismiss: () => void;
}

const CHANGELOG: Record<string, string[]> = {
  employee: [
    'Feestdag selectie: kies "Feestdag" als dagstatus (bv. Koningsdag)',
    'ITKnecht uren zijn beveiligd — niet meer handmatig aanpasbaar',
    'Week legen knop: opnieuw beginnen is nu eenvoudig',
    'Directe checklist: zie meteen wat je nog moet invullen per dag',
  ],
  admin: [
    'Week legen knop voor monteurs toegevoegd',
    'Betere foutmeldingen bij incomplete weken',
    'Feestdag auto-detectie in urenbriefjes',
  ],
  manager: [
    'Betere foutmeldingen bij incomplete weken',
    'Feestdag auto-detectie in urenbriefjes',
  ],
  all: [
    'App update melding: je ziet voortaan direct als een nieuwe versie klaarstaat',
  ],
};

const AppUpdateModal: React.FC<Props> = ({ reg, onDismiss }) => {
  const { userRole } = useAuth();

  const handleUpdate = () => {
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  const roleChanges = (userRole && CHANGELOG[userRole]) ? CHANGELOG[userRole] : [];
  const allChanges = CHANGELOG.all;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal card */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Gradient header */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-800 px-6 py-8 text-white text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-white/20 rounded-full p-3">
              <Sparkles className="h-8 w-8" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-1">Nieuwe versie beschikbaar</h2>
          <p className="text-primary-100 text-sm">
            FLG-Administratie is bijgewerkt met nieuwe functies.
          </p>
        </div>

        {/* Changelog */}
        <div className="px-6 py-5">
          {roleChanges.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300 mb-2">
                Wat is er nieuw voor jou
              </h3>
              <ul className="space-y-2">
                {roleChanges.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <span className="mt-0.5 text-green-500 font-bold shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {allChanges.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300 mb-2">
                Algemeen
              </h3>
              <ul className="space-y-2">
                {allChanges.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <span className="mt-0.5 text-blue-500 font-bold shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col gap-3">
          <button
            onClick={handleUpdate}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Nu vernieuwen
          </button>
          <button
            onClick={onDismiss}
            className="w-full text-sm text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 py-2 transition-colors"
          >
            Later herinneren
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppUpdateModal;
