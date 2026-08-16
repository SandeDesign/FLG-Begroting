// src/contexts/AppContext.tsx
// Gedeelde app-state: de entiteiten, welke entiteit nu geselecteerd is en welk
// jaar er bekeken wordt. Geen tenant-namespace — beide accounts zien dezelfde data.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { volgEntiteiten } from '../services/entityService';
import { applyThemeColor } from '../utils/themeColors';
import type { Entity } from '../types/begroting';

const OPSLAG_ENTITEIT = 'flg.geselecteerdeEntiteit';
const OPSLAG_JAAR = 'flg.geselecteerdJaar';
const OPSLAG_THEMA = 'flg.themakleur';

interface AppContextType {
  entiteiten: Entity[];
  geselecteerdeEntiteit: Entity | null;
  geselecteerdJaar: number;
  laden: boolean;
  fout: string | null;
  setGeselecteerdeEntiteit: (entiteit: Entity | null) => void;
  setGeselecteerdJaar: (jaar: number) => void;
  herlaadEntiteiten: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, toegang } = useAuth();
  const [entiteiten, setEntiteiten] = useState<Entity[]>([]);
  const [geselecteerdeEntiteit, setGeselecteerdeEntiteitState] = useState<Entity | null>(null);
  const [geselecteerdJaar, setGeselecteerdJaarState] = useState<number>(new Date().getFullYear());
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  /**
   * De entiteiten worden gevolgd in plaats van opgehaald. Firestore levert de
   * eerste melding uit zijn schijfcache — die is er dus meteen, zonder te
   * wachten op het netwerk — en stuurt daarna de versie van de server na. Ook
   * eigen wijzigingen komen direct langs.
   */
  useEffect(() => {
    if (!user || toegang !== true) {
      setEntiteiten([]);
      setLaden(false);
      return;
    }

    setLaden(true);
    setFout(null);

    const stop = volgEntiteiten(
      (opgehaald) => {
        setEntiteiten(opgehaald);

        // Houd de selectie geldig: bewaar hem als hij nog bestaat, val anders
        // terug op de eerder opgeslagen keuze of de eerste actieve entiteit.
        setGeselecteerdeEntiteitState((huidige) => {
          if (huidige) {
            const bijgewerkt = opgehaald.find((e) => e.id === huidige.id);
            if (bijgewerkt) return bijgewerkt;
          }
          const bewaardId = localStorage.getItem(OPSLAG_ENTITEIT);
          const bewaard = bewaardId ? opgehaald.find((e) => e.id === bewaardId) : undefined;
          return bewaard ?? opgehaald.find((e) => e.actief) ?? opgehaald[0] ?? null;
        });

        setLaden(false);
      },
      (foutmelding) => {
        console.error('Entiteiten laden mislukt:', foutmelding);
        setFout(
          'De entiteiten konden niet geladen worden. Controleer je verbinding en de Firestore rules.'
        );
        setEntiteiten([]);
        setLaden(false);
      }
    );

    return stop;
  }, [user, toegang]);

  /**
   * Blijft bestaan omdat pagina's hem na een opslag aanroepen. De luisteraar
   * hierboven heeft de wijziging dan al doorgegeven, dus er valt niets meer op
   * te halen.
   */
  const herlaadEntiteiten = useCallback(async () => {}, []);

  // Jaarkeuze terughalen uit de vorige sessie.
  useEffect(() => {
    const bewaard = localStorage.getItem(OPSLAG_JAAR);
    if (!bewaard) return;
    const jaar = Number.parseInt(bewaard, 10);
    if (Number.isInteger(jaar) && jaar >= 2020 && jaar <= 2060) {
      setGeselecteerdJaarState(jaar);
    }
  }, []);

  // De themakleur is een persoonlijke voorkeur, ingesteld op /settings.
  useEffect(() => {
    applyThemeColor(localStorage.getItem(OPSLAG_THEMA) ?? 'blue');
  }, []);

  const setGeselecteerdeEntiteit = useCallback((entiteit: Entity | null) => {
    setGeselecteerdeEntiteitState(entiteit);
    if (entiteit) {
      localStorage.setItem(OPSLAG_ENTITEIT, entiteit.id);
    } else {
      localStorage.removeItem(OPSLAG_ENTITEIT);
    }
  }, []);

  const setGeselecteerdJaar = useCallback((jaar: number) => {
    setGeselecteerdJaarState(jaar);
    localStorage.setItem(OPSLAG_JAAR, String(jaar));
  }, []);

  return (
    <AppContext.Provider
      value={{
        entiteiten,
        geselecteerdeEntiteit,
        geselecteerdJaar,
        laden,
        fout,
        setGeselecteerdeEntiteit,
        setGeselecteerdJaar,
        herlaadEntiteiten,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp moet binnen een AppProvider gebruikt worden');
  }
  return context;
};
