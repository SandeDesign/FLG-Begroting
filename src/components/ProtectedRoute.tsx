// src/components/ProtectedRoute.tsx
// Poort voor elke pagina achter de login. Naast ingelogd zijn moet de uid ook op
// de whitelist in settings/access staan; anders krijg je een nette melding in
// plaats van overal leesfouten uit Firestore.

import React from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './ui/LoadingSpinner';
import Button from './ui/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, toegang, laden, uitloggen } = useAuth();

  if (laden) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (toegang === false) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center mb-5">
            <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden />
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">
            Geen toegang
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
            Dit account staat niet op de lijst met gebruikers die deze begroting mogen inzien.
            Voeg de uid toe aan <code className="font-mono text-xs">allowedUids</code> in het
            document <code className="font-mono text-xs">settings/access</code> in Firestore.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-6 break-all">
            Ingelogd als {user.email} · uid {user.uid}
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
