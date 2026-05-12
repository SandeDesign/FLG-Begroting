import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  /** Optional top accent stripe color (e.g. 'bronze' | 'success' | 'warning' | 'danger' | 'info' | 'accent') */
  accent?: 'bronze' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
}

const ACCENT_GRADIENT: Record<NonNullable<CardProps['accent']>, string> = {
  bronze:  'from-primary-400 to-primary-600',
  success: 'from-emerald-400 to-emerald-600',
  warning: 'from-amber-400 to-amber-600',
  danger:  'from-red-400 to-red-600',
  info:    'from-sky-400 to-sky-600',
  accent:  'from-primary-400 to-primary-600',
};

const Card: React.FC<CardProps> = ({ children, className = '', title, subtitle, accent }) => {
  // Geen standaard bg toevoegen als className al een achtergrondklasse bevat —
  // zo wint dark:bg-gray-800 altijd van bg-*-50 zonder specificity-conflicten.
  const hasBg = /\bbg-/.test(className) || /\bfrom-/.test(className);
  const base = hasBg
    ? 'relative rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-200 overflow-hidden'
    : 'relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-200 overflow-hidden';

  return (
    <div className={`${base} ${className}`}>
      {accent && (
        <div
          aria-hidden
          className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${ACCENT_GRADIENT[accent]}`}
        />
      )}
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          {title && (
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

export default Card;
