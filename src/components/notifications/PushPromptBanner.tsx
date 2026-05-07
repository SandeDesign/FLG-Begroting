import React, { useEffect, useState } from 'react';
import { Bell, BellOff, X, Share2, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  requestPushPermission,
  registerCurrentDeviceToken,
  isPushSupported,
  isIos,
  isStandalone,
} from '../../lib/messaging';
import { useToast } from '../../hooks/useToast';

// Banner wordt verborgen voor 7 dagen na dismiss
const DISMISS_KEY = 'push_prompt_dismissed_until';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

type Phase = 'loading' | 'ios_install' | 'prompt' | 'granted' | 'denied' | 'dismissed' | 'hidden';

export const PushPromptBanner: React.FC = () => {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [phase, setPhase] = useState<Phase>('loading');
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    const evaluate = async () => {
      if (!user) {
        setPhase('hidden');
        return;
      }

      // Respecteer dismiss
      const dismissedUntilRaw = localStorage.getItem(DISMISS_KEY);
      if (dismissedUntilRaw) {
        const dismissedUntil = parseInt(dismissedUntilRaw, 10);
        if (!isNaN(dismissedUntil) && dismissedUntil > Date.now()) {
          setPhase('dismissed');
          return;
        }
      }

      // iOS PWA-specifieke check: push vereist "Add to Home Screen"
      if (isIos() && !isStandalone()) {
        setPhase('ios_install');
        return;
      }

      const supported = await isPushSupported();
      if (!supported) {
        setPhase('hidden');
        return;
      }

      const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
      if (permission === 'granted') {
        // Zorg dat we wel het token in Firestore hebben (refresh bij elke login)
        await registerCurrentDeviceToken(user.uid).catch(() => null);
        setPhase('hidden');
        return;
      }
      if (permission === 'denied') {
        setPhase('denied');
        return;
      }
      setPhase('prompt');
    };

    evaluate();
  }, [user?.uid]);

  const handleActivate = async () => {
    if (!user) return;
    setActivating(true);
    try {
      const permission = await requestPushPermission();
      if (permission !== 'granted') {
        if (permission === 'denied') {
          setPhase('denied');
          showError(
            'Toestemming geweigerd',
            'Je kunt dit aanpassen in je browser-instellingen.'
          );
        }
        return;
      }
      const token = await registerCurrentDeviceToken(user.uid);
      if (token) {
        success('Meldingen actief!', 'Je ontvangt nu push-notificaties op dit apparaat.');
        setPhase('granted');
        // Verberg na 4s
        setTimeout(() => setPhase('hidden'), 4000);
      } else {
        showError('Activatie mislukt', 'Kon token niet registreren. Probeer opnieuw.');
      }
    } catch (e) {
      console.error(e);
      showError('Er ging iets mis', 'Probeer het later nog eens.');
    } finally {
      setActivating(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DURATION_MS));
    setPhase('dismissed');
  };

  if (phase === 'loading' || phase === 'hidden' || phase === 'dismissed' || phase === 'denied') {
    return null;
  }

  if (phase === 'granted') {
    return (
      <div className="bg-green-50 dark:bg-gray-700 border-l-4 border-green-500 p-3 rounded-lg flex items-center gap-3">
        <Bell className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
        <p className="text-sm text-green-900 dark:text-green-200 flex-1">
          Push-notificaties staan aan voor dit apparaat.
        </p>
      </div>
    );
  }

  if (phase === 'ios_install') {
    return (
      <div className="bg-blue-50 dark:bg-gray-700 border-l-4 border-blue-500 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
              Wil je meldingen ontvangen op je iPhone?
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
              iOS staat alleen meldingen toe als de app op je beginscherm staat.
              Tik in Safari op <Share2 className="inline h-3 w-3 -mt-0.5" /> Delen →{' '}
              <Plus className="inline h-3 w-3 -mt-0.5" /> "Zet op beginscherm", open dan de app
              vanaf je beginscherm en kom hier terug.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 flex-shrink-0"
            aria-label="Verbergen"
            title="Verbergen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // prompt
  return (
    <div className="bg-primary-50 dark:bg-gray-700 border-l-4 border-primary-500 p-4 rounded-lg">
      <div className="flex items-start gap-3">
        <Bell className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-200 mb-1">
            Zet meldingen aan voor dit apparaat
          </h3>
          <p className="text-xs text-primary-700 dark:text-primary-300">
            Krijg direct bericht bij nieuwe taken, afgeronde taken en 1 uur voor een deadline —
            ook als de app gesloten is.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleActivate}
            disabled={activating}
            className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            {activating ? 'Bezig…' : 'Activeer'}
          </button>
          <button
            onClick={handleDismiss}
            className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200"
            aria-label="Niet nu"
            title="Niet nu"
          >
            <BellOff className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PushPromptBanner;
