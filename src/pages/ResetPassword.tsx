import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';

interface ResetFormData {
  email: string;
}

const ResetPassword: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { user, resetPassword } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<ResetFormData>();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (data: ResetFormData) => {
    setLoading(true);
    try {
      await resetPassword(data.email);
      setEmailSent(true);
    } catch (error) {
      // Error handling is done in AuthContext
    } finally {
      setLoading(false);
    }
  };

  const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-gray-50 to-primary-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div aria-hidden className="absolute -top-24 -left-24 w-96 h-96 bg-primary-300/30 dark:bg-primary-700/20 rounded-full blur-3xl" />
      <div aria-hidden className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary-400/20 dark:bg-primary-600/15 rounded-full blur-3xl" />
      <div className="max-w-md w-full space-y-8 relative">{children}</div>
    </div>
  );

  if (emailSent) {
    return (
      <PageShell>
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <img src="/Logo_1.png" alt="FLG Administratie" className="h-16 w-auto" />
          </div>
          <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            E-mail verzonden
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Controleer je inbox voor de reset-link
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 text-center">
          <div className="mb-5">
            <div className="mx-auto w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-200 dark:ring-emerald-700/50 rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
            We hebben een wachtwoord-reset link gestuurd naar je e-mailadres.
            Klik op de link in de e-mail om je wachtwoord opnieuw in te stellen.
          </p>
          <Link to="/login">
            <Button size="lg" className="w-full">
              <ArrowLeft className="h-4 w-4" />
              Terug naar inloggen
            </Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="text-center">
        <div className="flex justify-center mb-2">
          <img src="/Logo_1.png" alt="FLG Administratie" className="h-16 w-auto" />
        </div>
        <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
          Wachtwoord vergeten?
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Voer je e-mailadres in om een reset-link te ontvangen
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight mb-1.5">
              E-mailadres
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                {...register('email', {
                  required: 'E-mailadres is verplicht',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Ongeldig e-mailadres',
                  },
                })}
                type="email"
                placeholder="naam@bedrijf.nl"
                autoComplete="email"
                className={`w-full pl-10 pr-3.5 py-2.5 border bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg outline-none transition-all duration-150 ${
                  errors.email
                    ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20'
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            loading={loading}
            size="lg"
            className="w-full"
          >
            Reset-link versturen
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Terug naar inloggen
          </Link>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        © {new Date().getFullYear()} FLG Administratie · SandeDesign
      </p>
    </PageShell>
  );
};

export default ResetPassword;
