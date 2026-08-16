// src/contexts/AuthContext.tsx
// Inloggen en toegang. Er is één soort gebruiker: wie op de lijst in
// settings/access staat mag alles inzien en wijzigen.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { claimToegang, haalToegangsstatus } from '../services/toegangService';

interface AuthContextType {
  user: User | null;
  /** null zolang de controle nog loopt. */
  toegang: boolean | null;
  /** false als settings/access nog niet bestaat — dan mag de eerste gebruiker claimen. */
  ingericht: boolean;
  laden: boolean;
  inloggen: (email: string, wachtwoord: string) => Promise<void>;
  uitloggen: () => Promise<void>;
  wachtwoordVergeten: (email: string) => Promise<void>;
  /** Zet de huidige gebruiker als eerste op de lijst. Kan maar één keer. */
  claimEersteToegang: () => Promise<void>;
  /** Leest de toegangsstatus opnieuw, bijvoorbeeld na het toevoegen van een account. */
  herlaadToegang: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Vertaalt een Firebase-foutcode naar een leesbare Nederlandse melding. */
function foutmelding(fout: unknown, standaard: string): string {
  const code = typeof fout === 'object' && fout !== null && 'code' in fout ? String(fout.code) : '';

  switch (code) {
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'Geen account gevonden met dit e-mailadres, of het wachtwoord klopt niet';
    case 'auth/wrong-password':
      return 'Onjuist wachtwoord';
    case 'auth/invalid-email':
      return 'Ongeldig e-mailadres';
    case 'auth/too-many-requests':
      return 'Te veel pogingen. Probeer het later opnieuw';
    case 'auth/network-request-failed':
      return 'Geen verbinding met Firebase. Controleer je internetverbinding';
    default:
      return standaard;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [toegang, setToegang] = useState<boolean | null>(null);
  const [ingericht, setIngericht] = useState(true);
  const [laden, setLaden] = useState(true);

  const controleerToegang = useCallback(async (huidigeGebruiker: User) => {
    try {
      const status = await haalToegangsstatus(huidigeGebruiker.uid);
      setIngericht(status.ingericht);
      setToegang(status.toegestaan);
    } catch (fout) {
      console.error('Toegangscontrole mislukt:', fout);
      setIngericht(true);
      setToegang(false);
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (huidigeGebruiker) => {
      setUser(huidigeGebruiker);

      if (!huidigeGebruiker) {
        setToegang(null);
        setIngericht(true);
        setLaden(false);
        return;
      }

      await controleerToegang(huidigeGebruiker);
      setLaden(false);
    });
  }, [controleerToegang]);

  const inloggen = async (email: string, wachtwoord: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, wachtwoord);
    } catch (fout) {
      throw new Error(foutmelding(fout, 'Er ging iets mis bij het inloggen'));
    }
  };

  const uitloggen = async () => {
    await firebaseSignOut(auth);
    setToegang(null);
  };

  const wachtwoordVergeten = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (fout) {
      throw new Error(foutmelding(fout, 'Er ging iets mis bij het versturen van de e-mail'));
    }
  };

  const claimEersteToegang = async () => {
    if (!user) throw new Error('Je bent niet ingelogd.');

    try {
      await claimToegang(user.uid);
    } catch {
      throw new Error(
        'De toegang kon niet ingericht worden. Waarschijnlijk heeft iemand anders dit al gedaan — vraag diegene om je toe te voegen.'
      );
    }

    await controleerToegang(user);
  };

  const herlaadToegang = async () => {
    if (user) await controleerToegang(user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        toegang,
        ingericht,
        laden,
        inloggen,
        uitloggen,
        wachtwoordVergeten,
        claimEersteToegang,
        herlaadToegang,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth moet binnen een AuthProvider gebruikt worden');
  }
  return context;
};
