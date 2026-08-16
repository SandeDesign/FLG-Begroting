// src/vite-env.d.ts
/// <reference types="vite/client" />

// De Firebase-configuratie komt volledig uit environment variables. Ze zijn hier
// optioneel getypeerd omdat een ontbrekende waarde pas bij het opstarten wordt
// afgevangen — met een duidelijke melding in src/lib/firebase.ts.
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
