// src/components/begroting/BtwKeuze.tsx
// Keuzelijst voor het BTW-tarief op een factuurregel.
//
// Vrijwel elke factuur bevat BTW, dus staat dit veld overal waar geld in of uit
// gaat. De BTW telt nooit mee in het resultaat — dat blijft exclusief — maar
// wordt wel bijgehouden zodat het BTW-overzicht klopt.

import React from 'react';
import { BTW_LABEL, BTW_TARIEVEN, type BtwTarief } from '../../types/begroting';

interface BtwKeuzeProps {
  waarde: BtwTarief;
  onChange: (tarief: BtwTarief) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

const BtwKeuze: React.FC<BtwKeuzeProps> = ({
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
    onChange={(event) => onChange(event.target.value as BtwTarief)}
    aria-label="BTW-tarief"
    className={`px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg outline-none transition-all duration-150 hover:border-gray-300 dark:hover:border-gray-500 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 ${className}`}
  >
    {BTW_TARIEVEN.map((tarief) => (
      <option key={tarief} value={tarief}>
        {BTW_LABEL[tarief]}
      </option>
    ))}
  </select>
);

export default BtwKeuze;
