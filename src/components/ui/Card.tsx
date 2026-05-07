import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', title, subtitle }) => {
  // Geen standaard bg toevoegen als className al een achtergrondklasse bevat —
  // zo wint dark:bg-gray-800 altijd van bg-*-50 zonder specificity-conflicten.
  const hasBg = /\bbg-/.test(className) || /\bfrom-/.test(className);
  const base = hasBg
    ? 'rounded-xl shadow-md border border-gray-100 dark:border-gray-600 hover:shadow-lg transition-shadow duration-200'
    : 'bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-600 hover:shadow-lg transition-shadow duration-200';
  return (
    <div className={`${base} ${className}`}>
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-600">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
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