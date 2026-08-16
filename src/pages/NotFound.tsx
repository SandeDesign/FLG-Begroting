// src/pages/NotFound.tsx
// Pagina bestaat niet.

import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

const NotFound: React.FC = () => (
  <div className="min-h-screen supports-[height:100dvh]:min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
    <div className="text-center max-w-sm">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 flex items-center justify-center mb-5 shadow-xs">
        <Compass className="h-6 w-6 text-gray-400 dark:text-gray-500" aria-hidden />
      </div>
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">
        Deze pagina bestaat niet
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
        De link klopt niet, of de pagina is verplaatst.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg bg-primary-500 hover:bg-primary-600 text-white shadow-glow-primary transition-colors"
      >
        Terug naar het dashboard
      </Link>
    </div>
  </div>
);

export default NotFound;
