// src/components/begroting/BtwStaat.tsx
// Het BTW-overzicht van één begroting.
//
// De BTW telt nergens mee in het resultaat — dat is van begin tot eind
// exclusief BTW. Maar hij loopt wél elke maand over de rekening: wat wij
// factureren dragen we af, wat ons gefactureerd wordt vorderen we terug. Zonder
// dit overzicht zie je dat verschil niet, en dat scheelt op de bankrekening.

import React from 'react';
import { Landmark } from 'lucide-react';
import type { BegrotingResultaat, Eenheid } from '../../types/begroting';
import { EENHEID_LABEL } from '../../types/begroting';
import { formatEuro, vanMaand } from '../../utils/periode';

interface BtwStaatProps {
  resultaat: BegrotingResultaat;
  eenheid: Eenheid;
}

interface Regel {
  label: string;
  bedrag: number;
  toelichting?: string;
}

const BtwStaat: React.FC<BtwStaatProps> = ({ resultaat, eenheid }) => {
  const om = (bedrag: number) => vanMaand(bedrag, eenheid, resultaat.aannames);
  const btw = resultaat.btw;

  const afTeDragen: Regel[] = [
    {
      label: 'Over onze opdrachten',
      bedrag: om(btw.overOpdrachten),
      toelichting: 'Opdrachten met verlegde BTW staan hier op nul',
    },
    { label: 'Over onze onderlinge facturen', bedrag: om(btw.overOnderlingUit) },
  ];

  const terugTeVorderen: Regel[] = [
    { label: 'Over middelen', bedrag: om(btw.overMiddelen) },
    {
      label: 'Over inzet',
      bedrag: om(btw.overInzet),
      toelichting: "Alleen ZZP-facturen; over loon zit geen BTW",
    },
    { label: 'Over vaste lasten', bedrag: om(btw.overVasteLasten) },
    { label: 'Over onderlinge facturen aan ons', bedrag: om(btw.overOnderlingIn) },
  ];

  const regel = (item: Regel) => (
    <div key={item.label} className="flex items-baseline justify-between gap-4 py-2 pl-4">
      <div>
        <span className="text-sm text-gray-600 dark:text-gray-300">{item.label}</span>
        {item.toelichting && (
          <span className="block text-[11px] text-gray-400 dark:text-gray-500">
            {item.toelichting}
          </span>
        )}
      </div>
      <span className="text-sm tabular-nums whitespace-nowrap text-gray-700 dark:text-gray-200">
        {formatEuro(item.bedrag)}
      </span>
    </div>
  );

  const totaal = (label: string, bedrag: number) => (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</span>
      <span className="text-sm font-semibold tabular-nums whitespace-nowrap text-gray-900 dark:text-gray-100">
        {formatEuro(bedrag)}
      </span>
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4 mb-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            BTW
          </h3>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Bedragen {EENHEID_LABEL[eenheid]}
        </span>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {afTeDragen.map(regel)}
        {totaal('Af te dragen', om(btw.afTeDragen))}
        {terugTeVorderen.map(regel)}
        {totaal('Terug te vorderen', om(btw.terugTeVorderen))}

        <div className="flex items-baseline justify-between gap-4 py-3 border-t-2 border-t-gray-300 dark:border-t-gray-600 mt-1">
          <div>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {btw.saldo >= 0 ? 'Te betalen aan de Belastingdienst' : 'Terug van de Belastingdienst'}
            </span>
            <span className="block text-[11px] text-gray-400 dark:text-gray-500">
              Af te dragen min terug te vorderen
            </span>
          </div>
          <span
            className={`text-base font-bold tabular-nums whitespace-nowrap ${
              btw.saldo >= 0
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {formatEuro(Math.abs(om(btw.saldo)))}
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        De BTW verandert het resultaat niet — dat blijft exclusief BTW. Dit overzicht laat
        alleen zien wat er via de aangifte heen en weer gaat.
      </p>
    </div>
  );
};

export default BtwStaat;
