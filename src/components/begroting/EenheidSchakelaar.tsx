// src/components/begroting/EenheidSchakelaar.tsx
// De schakelaar bovenaan de begroting die de hele resultatenstaat omrekent naar
// uur, dag, week, maand of jaar. Raakt de opgeslagen data niet aan — alleen de
// weergave verandert.

import React from 'react';
import { EENHEDEN, EENHEID_KORT, EENHEID_LABEL, type Eenheid } from '../../types/begroting';

interface EenheidSchakelaarProps {
  waarde: Eenheid;
  onChange: (eenheid: Eenheid) => void;
  className?: string;
}

const EenheidSchakelaar: React.FC<EenheidSchakelaarProps> = ({
  waarde,
  onChange,
  className = '',
}) => (
  <div className={`inline-flex items-center gap-1.5 ${className}`}>
    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:inline">
      Toon bedragen
    </span>
    <div
      className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700/60 rounded-lg p-0.5"
      role="group"
      aria-label="Weergave-eenheid"
    >
      {EENHEDEN.map((eenheid) => (
        <button
          key={eenheid}
          type="button"
          onClick={() => onChange(eenheid)}
          title={EENHEID_LABEL[eenheid]}
          aria-pressed={waarde === eenheid}
          className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${
            waarde === eenheid
              ? 'bg-primary-500 text-white shadow-glow-primary'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-600/60'
          }`}
        >
          {EENHEID_KORT[eenheid]}
        </button>
      ))}
    </div>
  </div>
);

export default EenheidSchakelaar;
