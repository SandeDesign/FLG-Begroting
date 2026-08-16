// src/lib/firebase.ts
// Firebase-initialisatie voor FLG-Begroting.
//
// Alle configuratie komt uit environment variables. Er zijn bewust GEEN fallback-
// waarden: ontbreekt er een variabele, dan stopt de app direct met een leesbare
// melding in plaats van stil naar het verkeerde project te schrijven.
//
// Let op: een VITE_*-variabele belandt altijd in de clientbundle. Voor de Firebase-
// webconfig is dat normaal en veilig — de beveiliging zit in de Firestore rules.
// Zet hier dus nooit een sleutel in die geheim moet blijven.

import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// De waarden worden per stuk uitgelezen. Dat moet statisch (import.meta.env.NAAM),
// want Vite vervangt deze verwijzingen tijdens de build door de echte waarde.
const configuratie: Array<{ sleutel: string; variabele: string; waarde: string | undefined }> = [
  { sleutel: 'apiKey', variabele: 'VITE_FIREBASE_API_KEY', waarde: import.meta.env.VITE_FIREBASE_API_KEY },
  { sleutel: 'authDomain', variabele: 'VITE_FIREBASE_AUTH_DOMAIN', waarde: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN },
  { sleutel: 'projectId', variabele: 'VITE_FIREBASE_PROJECT_ID', waarde: import.meta.env.VITE_FIREBASE_PROJECT_ID },
  { sleutel: 'storageBucket', variabele: 'VITE_FIREBASE_STORAGE_BUCKET', waarde: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET },
  { sleutel: 'messagingSenderId', variabele: 'VITE_FIREBASE_MESSAGING_SENDER_ID', waarde: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID },
  { sleutel: 'appId', variabele: 'VITE_FIREBASE_APP_ID', waarde: import.meta.env.VITE_FIREBASE_APP_ID },
];

const ontbrekend = configuratie
  .filter((regel) => !regel.waarde || regel.waarde.trim() === '')
  .map((regel) => regel.variabele);

if (ontbrekend.length > 0) {
  throw new Error(
    `FLG-Begroting kan niet starten: de volgende environment variabelen ontbreken of zijn leeg: ${ontbrekend.join(', ')}. ` +
      'Zet ze lokaal in een .env-bestand (zie .env.example) en in Vercel onder Settings → Environment Variables, ' +
      'voor elke omgeving apart (Production, Preview en Development).'
  );
}

const firebaseConfig = Object.fromEntries(
  configuratie.map((regel) => [regel.sleutel, regel.waarde as string])
) as {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const app = initializeApp(firebaseConfig);

/**
 * Firestore met een schijfcache en automatische verbindingsdetectie.
 *
 * `persistentLocalCache` bewaart de data in IndexedDB. Kom je terug in de app,
 * dan staat alles er meteen en wordt er op de achtergrond bijgewerkt — geen
 * wachten op een netwerkronde voordat je iets ziet. Op mobiel scheelt dat het
 * meest.
 *
 * `experimentalAutoDetectLongPolling` lost het andere mobiele probleem op:
 * Firestore probeert standaard een streaming verbinding, en die blijft achter
 * sommige mobiele netwerken en bedrijfsproxy's seconden hangen voordat hij
 * terugvalt. Met deze vlag detecteert de client dat direct.
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalAutoDetectLongPolling: true,
});

export const auth = getAuth(app);

export default app;
