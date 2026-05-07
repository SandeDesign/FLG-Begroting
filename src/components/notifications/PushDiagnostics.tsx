import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Bell,
  ShieldCheck,
  AlertTriangle,
  Copy,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { collection, doc, getDocs } from 'firebase/firestore';
import app, { db } from '../../lib/firebase';

const VAPID_KEY_FROM_CODE =
  (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined) ||
  'BNC4g-LWqqIwa-_yHnhM7y-aMZ0-uUYLeXPswZRQrohFFiSevJBpFJJj4uIGiuDEga0rJxPpwPgun-7mOyOdZQg';

type Check = {
  id: string;
  label: string;
  status: 'idle' | 'running' | 'ok' | 'fail' | 'warn';
  detail?: string;
};

const INITIAL: Check[] = [
  { id: 'env', label: '1. Browser & device support', status: 'idle' },
  { id: 'standalone', label: '2. PWA standalone mode (vereist iOS)', status: 'idle' },
  { id: 'permission', label: '3. Notification permission', status: 'idle' },
  { id: 'sw', label: '4. Service worker geregistreerd en up-to-date', status: 'idle' },
  { id: 'vapid', label: '5. VAPID key beschikbaar', status: 'idle' },
  { id: 'messaging', label: '6. Firebase Messaging support check', status: 'idle' },
  { id: 'token', label: '7. FCM token ophalen (getToken)', status: 'idle' },
  { id: 'firestore', label: '8. Token opgeslagen in Firestore', status: 'idle' },
  { id: 'server-health', label: '9a. PHP self-check (GET internedata.nl/fcm-send.php)', status: 'idle' },
  { id: 'server', label: '9b. PHP push proxy stuurt test push', status: 'idle' },
];

export const PushDiagnostics: React.FC = () => {
  const { user } = useAuth();
  const [checks, setChecks] = useState<Check[]>(INITIAL);
  const [running, setRunning] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Check>) => {
    setChecks(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };

  const run = async () => {
    if (!user) return;
    setChecks(INITIAL.map(c => ({ ...c })));
    setRunning(true);
    setToken(null);

    // 1. Browser support
    update('env', { status: 'running' });
    const uaDetails = `UA: ${navigator.userAgent.substring(0, 80)}…`;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      update('env', { status: 'fail', detail: `Browser support missing. ${uaDetails}` });
      setRunning(false);
      return;
    }
    update('env', { status: 'ok', detail: uaDetails });

    // 2. Standalone (iOS vereist)
    update('standalone', { status: 'running' });
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone =
      (navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (isIos && !isStandalone) {
      update('standalone', {
        status: 'fail',
        detail: 'iOS gedetecteerd, maar app draait niet in standalone. Push werkt alleen als PWA via "Zet op beginscherm" is geïnstalleerd.',
      });
      setRunning(false);
      return;
    }
    update('standalone', {
      status: 'ok',
      detail: isStandalone ? 'Standalone modus actief ✓' : 'Desktop / Android browser — standalone niet vereist',
    });

    // 3. Permission
    update('permission', { status: 'running' });
    const perm = Notification.permission;
    if (perm === 'denied') {
      update('permission', {
        status: 'fail',
        detail: `permission = "${perm}". Reset via slotje in adresbalk → Meldingen → Standaard of Toestaan.`,
      });
      setRunning(false);
      return;
    }
    if (perm === 'default') {
      update('permission', {
        status: 'warn',
        detail: `permission = "${perm}". Eerst klik op "Activeer" op de banner om toestemming te geven.`,
      });
      setRunning(false);
      return;
    }
    update('permission', { status: 'ok', detail: 'granted ✓' });

    // 4. Service Worker
    update('sw', { status: 'running' });
    try {
      const registration = await navigator.serviceWorker.ready;
      const scriptURL = registration.active?.scriptURL || '';
      if (!scriptURL.includes('/service-worker.js')) {
        update('sw', {
          status: 'fail',
          detail: `Verkeerde SW geregistreerd: ${scriptURL}. Verwacht /service-worker.js. Unregister via DevTools → Application.`,
        });
        setRunning(false);
        return;
      }
      update('sw', { status: 'ok', detail: `Actief: ${scriptURL}` });
    } catch (e: any) {
      update('sw', { status: 'fail', detail: `SW error: ${e?.message || e}` });
      setRunning(false);
      return;
    }

    // 5. VAPID key
    update('vapid', { status: 'running' });
    if (!VAPID_KEY_FROM_CODE || VAPID_KEY_FROM_CODE.length < 80) {
      update('vapid', { status: 'fail', detail: 'VAPID key lijkt leeg of te kort.' });
      setRunning(false);
      return;
    }
    update('vapid', { status: 'ok', detail: `${VAPID_KEY_FROM_CODE.substring(0, 20)}… (${VAPID_KEY_FROM_CODE.length} chars)` });

    // 6. isSupported (firebase/messaging)
    update('messaging', { status: 'running' });
    try {
      const supported = await isSupported();
      if (!supported) {
        update('messaging', { status: 'fail', detail: 'firebase/messaging isSupported() = false. Deze browser ondersteunt FCM niet.' });
        setRunning(false);
        return;
      }
      update('messaging', { status: 'ok', detail: 'isSupported() = true ✓' });
    } catch (e: any) {
      update('messaging', { status: 'fail', detail: `isSupported error: ${e?.message || e}` });
      setRunning(false);
      return;
    }

    // 7. getToken
    update('token', { status: 'running' });
    let fcmToken: string | null = null;
    try {
      const messaging = getMessaging(app);
      const registration = await navigator.serviceWorker.ready;
      fcmToken = await getToken(messaging, {
        vapidKey: VAPID_KEY_FROM_CODE,
        serviceWorkerRegistration: registration,
      });
      if (!fcmToken) {
        update('token', { status: 'fail', detail: 'getToken returned empty. Meestal: permission recent geweigerd of token service onbereikbaar.' });
        setRunning(false);
        return;
      }
      setToken(fcmToken);
      update('token', { status: 'ok', detail: `Token OK: ${fcmToken.substring(0, 30)}…` });
    } catch (e: any) {
      const msg = e?.message || String(e);
      const code = e?.code || '';
      update('token', {
        status: 'fail',
        detail: `Error: ${code} — ${msg}. Mogelijk: messagingSenderId of VAPID key hoort niet bij dit Firebase project, of 3rd-party cookies geblokkeerd.`,
      });
      setRunning(false);
      return;
    }

    // 8. Firestore
    update('firestore', { status: 'running' });
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'fcmTokens'));
      if (snap.empty) {
        update('firestore', { status: 'warn', detail: 'Geen tokens in Firestore gevonden. Token hierboven wel opgehaald — klik Activeer opnieuw om op te slaan.' });
      } else {
        const found = snap.docs.find(d => d.id === fcmToken);
        update('firestore', {
          status: found ? 'ok' : 'warn',
          detail: found
            ? `${snap.size} token(s) in Firestore, huidige device inbegrepen ✓`
            : `${snap.size} andere token(s) staan in Firestore, maar huidige niet. Activeer opnieuw om toe te voegen.`,
        });
      }
    } catch (e: any) {
      update('firestore', { status: 'fail', detail: `Firestore read failed: ${e?.message || e}` });
    }

    // 9a. PHP self-check via GET — geeft uitsluitsel of service account,
    // OAuth en Firestore allemaal werken vóór we überhaupt POST proberen.
    update('server-health', { status: 'running' });
    let healthOk = false;
    try {
      const healthRes = await fetch('https://internedata.nl/fcm-send.php', {
        method: 'GET',
      });
      const health = await healthRes.json().catch(() => null);
      if (!health) {
        update('server-health', {
          status: 'fail',
          detail: `${healthRes.status} — geen JSON response. PHP draait niet of geeft HTML error.`,
        });
      } else if (!health.serviceAccountConfigured) {
        update('server-health', {
          status: 'fail',
          detail: `service_account_not_configured — plak je JSON tussen NOWDOC markers in fcm-send.php (regel ~50).`,
        });
      } else if (!health.oauthOk) {
        update('server-health', {
          status: 'fail',
          detail: `OAuth faalt (${health.error || 'unknown'}). Service account email: ${health.serviceAccountEmail || '?'}. HTTP: ${health.oauth?.oauthHttpCode || '?'}`,
        });
      } else if (!health.firestoreOk) {
        update('server-health', {
          status: 'fail',
          detail: `Firestore call faalt (HTTP ${health.firestoreHttpCode}). Service account heeft mogelijk geen 'datastore' scope of project_id mismatch.`,
        });
      } else {
        healthOk = true;
        update('server-health', {
          status: 'ok',
          detail: `Service account ${health.serviceAccountEmail} → project ${health.serviceAccountProjectId} → Firestore reachable ✓`,
        });
      }
    } catch (e: any) {
      update('server-health', {
        status: 'fail',
        detail: `GET fetch error: ${e?.message || e}. Check DNS / SSL van internedata.nl.`,
      });
    }

    // 9b. POST test — alleen zinvol als 9a groen.
    if (!healthOk) {
      update('server', { status: 'warn', detail: 'Overgeslagen omdat 9a faalde. Fix eerst de health-check.' });
      setRunning(false);
      return;
    }
    update('server', { status: 'running' });
    try {
      const res = await fetch('https://internedata.nl/fcm-send.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds: [user.uid],
          title: '🧪 Diagnostic test',
          body: 'Als je deze push ontvangt: alles werkt end-to-end.',
          url: '/',
          category: 'system_update',
        }),
      });

      const body = await res.json().catch(() => null);

      if (res.status === 403) {
        update('server', {
          status: 'fail',
          detail: `403 — Origin '${window.location.origin}' niet whitelisted. Voeg toe aan ALLOWED_ORIGINS in fcm-send.php.`,
        });
      } else if (!res.ok) {
        update('server', {
          status: 'fail',
          detail: `${res.status} — ${body?.error || 'unknown'}: ${body?.message || ''}`,
        });
      } else if (body?.sent > 0) {
        update('server', {
          status: 'ok',
          detail: `✓ Sent: ${body.sent}, Failed: ${body.failed}, Dead tokens removed: ${body.deletedTokens}. Push zou binnen seconden moeten binnenkomen.`,
        });
      } else {
        const tokensInfo = body?.debug?.tokensFoundPerUser?.[user.uid] ?? '?';
        update('server', {
          status: 'warn',
          detail: `PHP 200 OK maar 0 verstuurd. Tokens gevonden voor ${user.uid}: ${tokensInfo}. Mogelijk: Firestore rules blokkeren read, of subcollectie is leeg.`,
        });
      }
    } catch (e: any) {
      update('server', {
        status: 'fail',
        detail: `Fetch error: ${e?.message || e}. Check CORS / SSL / DNS van internedata.nl.`,
      });
    }

    setRunning(false);
  };

  const [swTestResult, setSwTestResult] = useState<string | null>(null);

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token).catch(() => undefined);
    }
  };

  // Lokale test: vraag de SW zelf een notification te tonen. Bewijst dat
  // de SW's showNotification API werkt (= dezelfde code die FCM push
  // gebruikt). Als dit werkt ken je zeker dat binnenkomende pushes óók
  // getoond worden.
  const testLocalNotification = async () => {
    setSwTestResult('Bezig…');
    try {
      if (Notification.permission !== 'granted') {
        setSwTestResult('Geen permission — klik eerst Activeer in banner.');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('🔔 Lokale SW test', {
        body: 'Als je dit ziet: de service worker kan notifications tonen. Inkomende pushes gebruiken dezelfde code.',
        icon: '/Logo-192.png',
        badge: '/Logo-192.png',
        tag: 'sw-local-test',
        data: { url: '/' },
      });
      setSwTestResult('Notification getoond via SW ✓ (kijk in je notification center)');
    } catch (e: any) {
      setSwTestResult(`Error: ${e?.message || e}`);
    }
  };

  // Kopieer token + open Firebase Console direct
  const openFirebaseTest = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token).catch(() => undefined);
    window.open(
      'https://console.firebase.google.com/project/alloon/notification/compose',
      '_blank'
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary-600" />
            Push Diagnostics
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-300">
            Test elke stap van de push-flow en toon waar het hangt.
          </p>
        </div>
        <button
          onClick={run}
          disabled={running || !user}
          className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-2"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
          {running ? 'Bezig…' : 'Start diagnose'}
        </button>
      </div>

      <ul className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {checks.map(c => (
          <li key={c.id} className="p-3 bg-white dark:bg-gray-800">
            <div className="flex items-start gap-2">
              <span className="pt-0.5">
                {c.status === 'idle' && <span className="inline-block w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700" />}
                {c.status === 'running' && <Loader2 className="h-4 w-4 text-primary-600 animate-spin" />}
                {c.status === 'ok' && <CheckCircle className="h-4 w-4 text-green-600" />}
                {c.status === 'warn' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                {c.status === 'fail' && <XCircle className="h-4 w-4 text-red-600" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-gray-100">{c.label}</p>
                {c.detail && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 break-words">
                    {c.detail}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Test-actieknoppen — werken ook zonder server-config */}
      <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 space-y-2">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          Harde tests (bypass de server)
        </p>

        <button
          onClick={testLocalNotification}
          className="w-full text-left p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-400 text-xs flex items-start gap-2"
        >
          <Zap className="h-4 w-4 text-primary-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              1. Test Service Worker notificatie lokaal
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              Toont een notificatie via dezelfde SW-code die inkomende pushes gebruikt. Als deze werkt: de SW werkt.
            </p>
            {swTestResult && (
              <p className="mt-1 text-[11px] text-primary-700 dark:text-primary-300">
                {swTestResult}
              </p>
            )}
          </div>
        </button>

        <button
          onClick={openFirebaseTest}
          disabled={!token}
          className="w-full text-left p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-400 text-xs flex items-start gap-2 disabled:opacity-50"
        >
          <ExternalLink className="h-4 w-4 text-primary-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              2. Test echte push met app gesloten (via Firebase Console)
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              Kopieert token → opent Firebase Console in nieuwe tab. Plak token in "Test on device", sluit/minimize deze app, klik Test in Firebase → als push binnenkomt: alles werkt behalve onze server function.
            </p>
          </div>
        </button>
      </div>

      {token && (
        <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">FCM token</span>
            <button
              onClick={copyToken}
              className="text-xs text-primary-600 hover:underline flex items-center gap-1"
            >
              <Copy className="h-3 w-3" /> Kopieer
            </button>
          </div>
          <code className="block text-[10px] break-all text-gray-600 dark:text-gray-300 font-mono">
            {token}
          </code>
        </div>
      )}
    </div>
  );
};

export default PushDiagnostics;
