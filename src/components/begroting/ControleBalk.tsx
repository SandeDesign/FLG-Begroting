// src/components/begroting/ControleBalk.tsx
// De balk bovenaan elke begrotingspagina. Groen als alle controles kloppen,
// rood met de afwijkingen erin als dat niet zo is. Zichtbaar, niet weggestopt.

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, XCircle } from 'lucide-react';
import type { Afwijking } from '../../types/begroting';
import { formatEuro } from '../../utils/periode';

interface ControleBalkProps {
  afwijkingen: Afwijking[];
  waarschuwingen?: string[];
  className?: string;
}

const ControleBalk: React.FC<ControleBalkProps> = ({
  afwijkingen,
  waarschuwingen = [],
  className = '',
}) => {
  const [open, setOpen] = useState(afwijkingen.length > 0);

  const heeftAfwijkingen = afwijkingen.length > 0;
  const heeftWaarschuwingen = waarschuwingen.length > 0;

  // Alles klopt en er valt niets te melden: één rustige groene regel.
  if (!heeftAfwijkingen && !heeftWaarschuwingen) {
    return (
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60 ${className}`}
      >
        <CheckCircle2
          className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0"
          aria-hidden
        />
        <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
          Alle controles kloppen
        </span>
      </div>
    );
  }

  const kleuren = heeftAfwijkingen
    ? {
        rand: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/60',
        tekst: 'text-red-800 dark:text-red-200',
        icoon: 'text-red-600 dark:text-red-400',
      }
    : {
        rand: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/60',
        tekst: 'text-amber-900 dark:text-amber-200',
        icoon: 'text-amber-600 dark:text-amber-400',
      };

  const kop = heeftAfwijkingen
    ? `${afwijkingen.length} ${afwijkingen.length === 1 ? 'controle klopt niet' : 'controles kloppen niet'}`
    : `${waarschuwingen.length} ${waarschuwingen.length === 1 ? 'aandachtspunt' : 'aandachtspunten'}`;

  return (
    <div className={`rounded-xl border ${kleuren.rand} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
        aria-expanded={open}
      >
        {heeftAfwijkingen ? (
          <XCircle className={`h-5 w-5 flex-shrink-0 ${kleuren.icoon}`} aria-hidden />
        ) : (
          <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${kleuren.icoon}`} aria-hidden />
        )}
        <span className={`text-sm font-semibold flex-1 ${kleuren.tekst}`}>{kop}</span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 ${kleuren.icoon} transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {heeftAfwijkingen && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className={`${kleuren.tekst} opacity-70`}>
                    <th className="text-left font-semibold py-1.5 pr-3">Waar</th>
                    <th className="text-right font-semibold py-1.5 px-3 whitespace-nowrap">
                      Verwacht
                    </th>
                    <th className="text-right font-semibold py-1.5 px-3 whitespace-nowrap">
                      Gevonden
                    </th>
                    <th className="text-right font-semibold py-1.5 pl-3 whitespace-nowrap">
                      Verschil
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {afwijkingen.map((afwijking, index) => (
                    <tr
                      key={`${afwijking.waar}-${index}`}
                      className="border-t border-red-200/60 dark:border-red-800/40"
                    >
                      <td className={`py-1.5 pr-3 ${kleuren.tekst}`}>{afwijking.waar}</td>
                      <td className={`py-1.5 px-3 text-right tabular-nums ${kleuren.tekst}`}>
                        {formatEuro(afwijking.verwacht)}
                      </td>
                      <td className={`py-1.5 px-3 text-right tabular-nums ${kleuren.tekst}`}>
                        {formatEuro(afwijking.gevonden)}
                      </td>
                      <td
                        className={`py-1.5 pl-3 text-right tabular-nums font-semibold ${kleuren.tekst}`}
                      >
                        {formatEuro(afwijking.verschil)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {heeftWaarschuwingen && (
            <ul className={`space-y-1.5 text-xs ${kleuren.tekst}`}>
              {waarschuwingen.map((waarschuwing, index) => (
                <li key={index} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>{waarschuwing}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ControleBalk;
