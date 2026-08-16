// src/contexts/BegrotingsdataContext.tsx
// De begrotingen, één keer geladen voor de hele app.
//
// Hiervoor haalde elke pagina die begrotingen nodig had ze bij het openen zelf
// op. Vijf pagina's, elke keer opnieuw een volledige query — en tot die klaar
// was stond er een laadscherm. Op een mobiele verbinding betekende dat bij elke
// stap in het menu opnieuw wachten.
//
// Nu draait er één luisteraar. Firestore levert de eerste melding uit zijn
// schijfcache, dus de data staat er meteen, en werkt daarna op de achtergrond
// bij. Navigeren tussen pagina's kost geen enkele query meer.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { volgBegrotingen } from '../services/budgetService';
import type { Budget } from '../types/begroting';

interface BegrotingsdataContextType {
  begrotingen: Budget[];
  laden: boolean;
  fout: string | null;
  /** Blijft bestaan voor pagina's die hem na een opslag aanroepen. */
  herlaad: () => Promise<void>;
}

const BegrotingsdataContext = createContext<BegrotingsdataContextType | undefined>(undefined);

export const BegrotingsdataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, toegang } = useAuth();
  const [begrotingen, setBegrotingen] = useState<Budget[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (!user || toegang !== true) {
      setBegrotingen([]);
      setLaden(false);
      return;
    }

    setLaden(true);
    setFout(null);

    const stop = volgBegrotingen(
      (opgehaald) => {
        setBegrotingen(opgehaald);
        setLaden(false);
      },
      (foutmelding) => {
        console.error('Begrotingen laden mislukt:', foutmelding);
        setFout('De begrotingen konden niet geladen worden.');
        setBegrotingen([]);
        setLaden(false);
      }
    );

    return stop;
  }, [user, toegang]);

  // De luisteraar heeft elke wijziging al doorgegeven — ook de eigen writes.
  const herlaad = useCallback(async () => {}, []);

  return (
    <BegrotingsdataContext.Provider value={{ begrotingen, laden, fout, herlaad }}>
      {children}
    </BegrotingsdataContext.Provider>
  );
};

export const useBegrotingen = (): BegrotingsdataContextType => {
  const context = useContext(BegrotingsdataContext);
  if (context === undefined) {
    throw new Error('useBegrotingen moet binnen een BegrotingsdataProvider gebruikt worden');
  }
  return context;
};
