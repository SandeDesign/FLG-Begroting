// src/contexts/DarkModeContext.tsx
// Donkere modus. De voorkeur staat in localStorage — met twee accounts op eigen
// apparaten is dat voldoende en scheelt een Firestore-lees bij elke start.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const OPSLAG_SLEUTEL = 'flg.donkereModus';

interface DarkModeContextType {
  donkereModus: boolean;
  zetDonkereModus: (waarde: boolean) => void;
  wisselDonkereModus: () => void;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

/** Zet of verwijdert de class `dark` op <html>, waar Tailwind op stuurt. */
function pasToe(actief: boolean): void {
  document.documentElement.classList.toggle('dark', actief);
}

/** Leest de opgeslagen voorkeur, of valt terug op de systeeminstelling. */
function leesVoorkeur(): boolean {
  const bewaard = localStorage.getItem(OPSLAG_SLEUTEL);
  if (bewaard !== null) return bewaard === 'true';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const DarkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [donkereModus, setDonkereModus] = useState<boolean>(false);

  useEffect(() => {
    const voorkeur = leesVoorkeur();
    setDonkereModus(voorkeur);
    pasToe(voorkeur);
  }, []);

  const zetDonkereModus = useCallback((waarde: boolean) => {
    setDonkereModus(waarde);
    pasToe(waarde);
    localStorage.setItem(OPSLAG_SLEUTEL, String(waarde));
  }, []);

  const wisselDonkereModus = useCallback(() => {
    setDonkereModus((huidig) => {
      const nieuw = !huidig;
      pasToe(nieuw);
      localStorage.setItem(OPSLAG_SLEUTEL, String(nieuw));
      return nieuw;
    });
  }, []);

  return (
    <DarkModeContext.Provider value={{ donkereModus, zetDonkereModus, wisselDonkereModus }}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = (): DarkModeContextType => {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkMode moet binnen een DarkModeProvider gebruikt worden');
  }
  return context;
};
