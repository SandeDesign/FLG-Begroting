// src/components/ProtectedRoute.tsx
// Poort voor elke pagina achter de login.
//
// Drie uitkomsten: je staat op de lijst en mag door; de lijst bestaat nog niet
// en je mag hem eenmalig claimen; of je staat er niet op en krijgt een nette
// melding met je uid erbij, zodat iemand die er wél op staat je kan toevoegen.

import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './ui/LoadingSpinner';
import Button from './ui/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, toegang, ingericht, laden, uitloggen, claimEersteToegang } = useAuth();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  if (laden) {
    return (
      <div className="min-h-screen supports-[height:100dvh]:min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const claim = async () => {
    setFout(null);
    setBezig(true);
    try {
      await claimEersteToegang();
    } catch (foutmelding) {
      setFout(foutmelding instanceof Error ? foutmelding.message : 'Inrichten mislukt');
    } finally {
      setBezig(false);
    }
  };

  // Nog niemand heeft toegang ingericht: de eerste die inlogt claimt de app.
  if (toegang === false && !ingericht) {
    return (
      <div className="min-h-screen supports-[height:100dvh]:min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-5">
            <KeyRound className="h-6 w-6 text-primary-600 dark:text-primary-400" aria-hidden />
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">
            Toegang nog niet ingericht
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
            Er is nog niemand die toegang heeft tot deze begroting. Je kunt jezelf nu als eerste
            toevoegen. Daarna beheer je de overige accounts vanuit Instellingen.
          </p>

          {fout && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{fout}</p>
          )}

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => void uitloggen()}>
              Uitloggen
            </Button>
            <Button loading={bezig} onClick={() => void claim()}>
              Geef mij toegang
            </Button>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-6 break-all">
            {user.email} · uid {user.uid}
          </p>
        </div>
      </div>
    );
  }

  if (toegang === false) {
    return (
      <div className="min-h-screen supports-[height:100dvh]:min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center mb-5">
            <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden />
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">
            Geen toegang
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
            Dit account staat niet op de lijst met gebruikers die deze begroting mogen inzien.
            Laat iemand die er wel op staat je toevoegen onder Instellingen, met de uid hieronder.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-6 break-all">
            {user.email} · uid {user.uid}
          </p>
          <Button variant="outline" onClick={() => void uitloggen()}>
            Uitloggen
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
