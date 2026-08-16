// src/components/begroting/KetenEntiteitKaart.tsx
// Eén entiteit in het ketenoverzicht, als kaart.
//
// Op een telefoon stond hier een tabel van zes kolommen die 680 px breed werd:
// je moest zijwaarts scrollen en de schermrand liep dwars door de bedragen.
//
// Naast elkaar passen die bedragen niet — € 15.760,00 is 87 px breed en in drie
// kolommen is er op een smal scherm 61 px. Daarom staat het bedrag hier achter
// zijn label, net als in de resultatenstaat: dat past altijd.

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { formatEuro } from '../../utils/periode';
import type { BegrotingResultaat, Budget, Entity } from '../../types/begroting';

interface KetenEntiteitKaartProps {
  entiteit: Entity;
  budget: Budget;
  resultaat: BegrotingResultaat;
  /** Rekent een maandbedrag om naar de gekozen weergave-eenheid. */
  om: (bedrag: number) => number;
  onOpenen: () => void;
}

const KetenEntiteitKaart: React.FC<KetenEntiteitKaartProps> = ({
  entiteit,
  budget,
  resultaat,
  om,
  onOpenen,
}) => {
  const regel = (label: string, bedrag: number, klasse = 'text-gray-700 dark:text-gray-200') => (
    <span className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm tabular-nums whitespace-nowrap ${klasse}`}>
        {formatEuro(bedrag)}
      </span>
    </span>
  );

  return (
    <button
      type="button"
      onClick={onOpenen}
      className="w-full text-left p-3.5 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800 transition-colors"
    >
      <span className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: entiteit.kleur }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {entiteit.naam}
          </span>
          <span className="block text-[11px] text-gray-400 dark:text-gray-500 truncate">
            {budget.naam}
          </span>
        </span>
        {entiteit.isHolding && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 flex-shrink-0">
            holding
          </span>
        )}
        <ChevronRight
          className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0"
          aria-hidden
        />
      </span>

      <span className="block">
        {regel('Opbrengst', om(resultaat.totaleOpbrengst))}
        {resultaat.subsidies > 0 &&
          regel(
            'Subsidies',
            om(resultaat.subsidies),
            'text-emerald-700 dark:text-emerald-300'
          )}
        {regel('Kosten', om(resultaat.totaleKosten))}
        <span className="flex items-baseline justify-between gap-3 pt-1.5 mt-1 border-t border-gray-100 dark:border-gray-700">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Resultaat</span>
          <span
            className={`text-sm font-bold tabular-nums whitespace-nowrap ${
              resultaat.resultaat >= 0
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-red-700 dark:text-red-300'
            }`}
          >
            {formatEuro(om(resultaat.resultaat))}
          </span>
        </span>
        {resultaat.subsidies > 0 &&
          regel(
            'Zonder subsidie',
            om(resultaat.resultaatZonderSubsidie),
            'text-gray-500 dark:text-gray-400'
          )}
      </span>
    </button>
  );
};

export default KetenEntiteitKaart;
