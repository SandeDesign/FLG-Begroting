// src/pages/ResetPassword.tsx
// Wachtwoord vergeten. Firebase stuurt de resetlink; wij tonen alleen of de
// e-mail de deur uit is.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';

const ResetPassword: React.FC = () => {
  const { wachtwoordVergeten } = useAuth();
  const [email, setEmail] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [verstuurd, setVerstuurd] = useState(false);
  const [bezig, setBezig] = useState(false);

  const verstuur = async (event: React.FormEvent) => {
    event.preventDefault();
    setFout(null);
    setBezig(true);

    try {
      await wachtwoordVergeten(email.trim());
      setVerstuurd(true);
    } catch (foutmelding) {
      setFout(foutmelding instanceof Error ? foutmelding.message : 'Versturen mislukt');
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Wachtwoord vergeten
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            We sturen je een link om een nieuw wachtwoord in te stellen.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          {verstuurd ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Als er een account bestaat met <span className="font-semibold">{email}</span>, dan
                staat er nu een e-mail met een resetlink in die inbox.
              </p>
            </div>
          ) : (
            <form onSubmit={verstuur} className="space-y-4">
              {fout && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden />
                  <span>{fout}</span>
                </div>
              )}

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

              <Button type="submit" loading={bezig} className="w-full" size="lg">
                Stuur de resetlink
              </Button>
            </form>
          )}

          <p className="text-center mt-5">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Terug naar inloggen
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
