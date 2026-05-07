import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Mail, Calculator, ArrowLeft } from 'lucide-react';
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

  // Redirect if already logged in
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

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="flex justify-center">
              <Calculator className="h-12 w-12 text-primary-600" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-gray-100">
              E-mail Verzonden!
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Controleer je inbox voor de reset link
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              <Mail className="mx-auto h-16 w-16 text-green-500" />
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              We hebben een wachtwoord reset link gestuurd naar je e-mailadres. 
              Klik op de link in de e-mail om je wachtwoord opnieuw in te stellen.
            </p>
            <Link to="/login">
              <Button className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Terug naar Inloggen
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <Calculator className="h-12 w-12 text-primary-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-gray-100">
            Wachtwoord Vergeten?
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Voer je e-mailadres in om een reset link te ontvangen
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
              <input
                {...register('email', { 
                  required: 'E-mailadres is verplicht',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Ongeldig e-mailadres'
                  }
                })}
                type="email"
                placeholder="E-mailadres"
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${ errors.email ? 'border-red-300' : 'border-gray-300 dark:border-gray-600' }`}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full py-3 text-base"
            >
              Reset Link Versturen
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-primary-600 hover:text-primary-500 flex items-center justify-center"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Terug naar Inloggen
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;