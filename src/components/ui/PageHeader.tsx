// src/components/ui/PageHeader.tsx
// De kop van elke pagina: titel, ondertitel en rechts de knoppen.

import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Emoji naast de titel. */
  emoji?: string;
  /** Knoppen rechts van de titel. */
  actions?: React.ReactNode;
  /**
   * Houdt de knoppen op een telefoon náást de titel in plaats van eronder.
   *
   * Standaard zakken ze op een smal scherm naar een eigen regel: twee brede
   * knoppen naast de titel drukken die anders helemaal weg. Gaat het om één
   * kleine knop, zoals het actiemenu op het werkblad, dan is een eigen regel
   * juist zonde van de ruimte — zet deze vlag dan aan.
   */
  actiesNaastTitel?: boolean;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  emoji,
  actions,
  actiesNaastTitel = false,
  className = '',
}) => (
  <div
    className={`flex ${
      actiesNaastTitel ? 'items-start' : 'flex-col sm:flex-row sm:items-start'
    } justify-between gap-3 sm:gap-4 mb-1 ${className}`}
  >
    <div className="min-w-0 flex-1">
      <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
        {emoji && (
          <span aria-hidden className="text-2xl leading-none flex-shrink-0">
            {emoji}
          </span>
        )}
        <span className="truncate">{title}</span>
      </h1>
      {subtitle && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">{subtitle}</p>
      )}
    </div>
    {actions && (
      <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">{actions}</div>
    )}
  </div>
);

export default PageHeader;
