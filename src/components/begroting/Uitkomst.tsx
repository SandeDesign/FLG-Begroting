// src/components/begroting/Uitkomst.tsx
// Toont in een formulier direct wat de ingevulde waarden opleveren, met de
// berekening erbij. Bedoeld om verkeerde interpretaties meteen zichtbaar te
// maken — een percentage dat als bedrag is ingevuld valt zo direct op.

import React from 'react';
import { Calculator } from 'lucide-react';
import { formatEuro } from '../../utils/periode';

export interface UitkomstRegel {
  label: string;
  bedrag: number;
  /** De berekening in woorden, bijvoorbeeld "100 × € 2,60 × 26 dagen". */
  berekening?: string;
}

interface UitkomstProps {
  titel: string;
  regels: UitkomstRegel[];
  /** De eindregel, dikgedrukt. */
  totaal: { label: string; bedrag: number };
  /** Extra opmerking onderaan, bijvoorbeeld een marge of een waarschuwing. */
  opmerking?: string;
}

const Uitkomst: React.FC<UitkomstProps> = ({ titel, regels, totaal, opmerking }) => (
  <div className="p-4 rounded-lg bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/40">
    <div className="flex items-center gap-2 mb-2.5">
      <Calculator className="h-4 w-4 text-primary-600 dark:text-primary-400" aria-hidden />
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{titel}</span>
    </div>

    <div className="divide-y divide-primary-100/70 dark:divide-primary-900/30">
      {regels.map((regel) => (
        <div key={regel.label} className="flex items-baseline justify-between gap-3 py-1.5">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {regel.label}
            {regel.berekening && (
              <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                {regel.berekening}
              </span>
            )}
          </span>
          <span className="text-sm text-gray-800 dark:text-gray-100 tabular-nums whitespace-nowrap">
            {formatEuro(regel.bedrag)}
          </span>
        </div>
      ))}

      <div className="flex items-baseline justify-between gap-3 pt-2 mt-1 border-t-2 border-primary-200 dark:border-primary-800/60">
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{totaal.label}</span>
        <span className="text-base font-bold text-gray-900 dark:text-gray-100 tabular-nums whitespace-nowrap">
          {formatEuro(totaal.bedrag)}
        </span>
      </div>
    </div>

    {opmerking && (
      <p className="mt-2.5 text-xs text-gray-500 dark:text-gray-400">{opmerking}</p>
    )}
  </div>
);

export default Uitkomst;
