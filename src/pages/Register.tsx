// src/pages/Register.tsx
// Account aanmaken. Zelfde opzet als de inlogpagina.

import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertCircle, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

const Register: React.FC = () => {
  const { user, laden, registreren } = useAuth();
  const [naam, setNaam] = useState('');
  const [email, setEmail] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [herhaling, setHerhaling] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  if (laden) {
    return (
      <div className="min-h-screen supports-[height:100dvh]:min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Na het aanmaken ben je meteen ingelogd; de poort regelt de rest.
  if (user) {
    return <Navigate to="/" replace />;
  }

  const verstuur = async (event: React.FormEvent) => {
    event.preventDefault();
    setFout(null);

    if (wachtwoord.length < 6) {
      setFout('Gebruik een wachtwoord van minimaal zes tekens.');
      return;
    }

    if (wachtwoord !== herhaling) {
      setFout('De twee wachtwoorden zijn niet gelijk.');
      return;
    }

    setBezig(true);

    try {
      await registreren(email, wachtwoord, naam);
    } catch (foutmelding) {
      setFout(foutmelding instanceof Error ? foutmelding.message : 'Account aanmaken mislukt');
      setBezig(false);
    }
  };

  return (
    <div className="min-h-screen supports-[height:100dvh]:min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Account aanmaken
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">FLG-Begroting</p>
        </div>

        <form
          onSubmit={verstuur}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4"
        >
          {fout && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden />
              <span>{fout}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="naam"
              className="block text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider mb-2"
            >
              Naam
            </label>
            <div className="relative">
              <User
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                aria-hidden
              />
              <input
                id="naam"
                type="text"
                autoComplete="name"
                value={naam}
                onChange={(event) => setNaam(event.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider mb-2"
            >
              E-mailadres
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                aria-hidden
              />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="wachtwoord"
              className="block text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider mb-2"
            >
              Wachtwoord
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                aria-hidden
              />
              <input
                id="wachtwoord"
                type="password"
                required
                autoComplete="new-password"
                value={wachtwoord}
                onChange={(event) => setWachtwoord(event.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="herhaling"
              className="block text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider mb-2"
            >
              Wachtwoord herhalen
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                aria-hidden
              />
              <input
                id="herhaling"
                type="password"
                required
                autoComplete="new-password"
                value={herhaling}
                onChange={(event) => setHerhaling(event.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
              />
            </div>
          </div>

          <Button type="submit" loading={bezig} className="w-full" size="lg">
            Account aanmaken
          </Button>

          <p className="text-center">
            <Link
              to="/login"
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Heb je al een account? Inloggen
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
