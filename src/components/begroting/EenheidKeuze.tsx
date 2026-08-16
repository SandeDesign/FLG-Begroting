// src/components/begroting/EenheidKeuze.tsx
// Keuzelijst voor de eenheid naast een bedragveld. Elk bedrag in de app heeft
// een eigen eenheid; de rekenmotor zet alles intern om naar maand.

import React from 'react';
import { EENHEDEN, EENHEID_LABEL, type Eenheid } from '../../types/begroting';

interface EenheidKeuzeProps {
  waarde: Eenheid;
  onChange: (eenheid: Eenheid) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

const EenheidKeuze: React.FC<EenheidKeuzeProps> = ({
  waarde,
  onChange,
  id,
  className = '',
  disabled = false,
}) => (
  <select
    id={id}
    value={waarde}
    disabled={disabled}
    onChange={(event) => onChange(event.target.value as Eenheid)}
    aria-label="Eenheid"
    className={`px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg outline-none transition-all duration-150 hover:border-gray-300 dark:hover:border-gray-500 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 ${className}`}
  >
    {EENHEDEN.map((eenheid) => (
      <option key={eenheid} value={eenheid}>
        {EENHEID_LABEL[eenheid]}
      </option>
    ))}
  </select>
);

export default EenheidKeuze;
