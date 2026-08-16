// src/contexts/AuthContext.tsx
// Inloggen en toegang. Er is één rol en er zijn twee accounts; die worden
// handmatig in de Firebase console aangemaakt. Registreren kan dus niet.

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { heeftToegang as controleerToegang } from '../services/toegangService';

interface AuthContextType {
  user: User | null;
  /** null zolang de controle nog loopt. */
  toegang: boolean | null;
  laden: boolean;
  inloggen: (email: string, wachtwoord: string) => Promise<void>;
  uitloggen: () => Promise<void>;
  wachtwoordVergeten: (email: string) => Promise<void>;
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
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (huidigeGebruiker) => {
      setUser(huidigeGebruiker);

      if (!huidigeGebruiker) {
        setToegang(null);
        setLaden(false);
        return;
      }

      try {
        setToegang(await controleerToegang(huidigeGebruiker.uid));
      } catch (fout) {
        console.error('Toegangscontrole mislukt:', fout);
        setToegang(false);
      } finally {
        setLaden(false);
      }
    });
  }, []);

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

  return (
    <AuthContext.Provider value={{ user, toegang, laden, inloggen, uitloggen, wachtwoordVergeten }}>
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
