// src/components/begroting/ResultatenStaat.tsx
// De resultatenstaat van één begroting, omgerekend naar de gekozen weergave-
// eenheid. De subsidie staat er als eigen regel tussen opbrengsten en kosten —
// nooit verrekend met een kost.

import React from 'react';
import type { BegrotingResultaat, Eenheid } from '../../types/begroting';
import { EENHEID_LABEL } from '../../types/begroting';
import { formatEuro, vanMaand } from '../../utils/periode';

interface ResultatenStaatProps {
  resultaat: BegrotingResultaat;
  eenheid: Eenheid;
}

interface Regel {
  label: string;
  bedrag: number;
  soort?: 'totaal' | 'uitkomst' | 'subsidie';
  ingesprongen?: boolean;
  toelichting?: string;
}

const ResultatenStaat: React.FC<ResultatenStaatProps> = ({ resultaat, eenheid }) => {
  const om = (bedrag: number) => vanMaand(bedrag, eenheid, resultaat.aannames);

  const regels: Regel[] = [
    { label: 'Opbrengsten uit opdrachten', bedrag: om(resultaat.opbrengstOpdrachten), ingesprongen: true },
    {
      label: 'Opbrengst onderlinge leveringen',
      bedrag: om(resultaat.opbrengstOnderlingUit),
      ingesprongen: true,
      toelichting: 'Wat wij aan andere entiteiten leveren',
    },
    { label: 'Totale opbrengst', bedrag: om(resultaat.totaleOpbrengst), soort: 'totaal' },
    {
      label: 'Subsidies',
      bedrag: om(resultaat.subsidies),
      soort: 'subsidie',
      toelichting: 'Eigen regel — nooit van een kost afgetrokken',
    },
    { label: 'Directe kosten — middelen', bedrag: om(resultaat.kostenMiddelen), ingesprongen: true },
    { label: 'Directe kosten — inzet', bedrag: om(resultaat.kostenInzet), ingesprongen: true },
    {
      label: 'Kosten onderlinge leveringen',
      bedrag: om(resultaat.kostenOnderlingIn),
      ingesprongen: true,
      toelichting: 'Wat andere entiteiten aan ons leveren',
    },
    { label: 'Vaste lasten', bedrag: om(resultaat.vasteLasten), ingesprongen: true },
    { label: 'Totale kosten', bedrag: om(resultaat.totaleKosten), soort: 'totaal' },
    { label: 'Resultaat', bedrag: om(resultaat.resultaat), soort: 'uitkomst' },
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
          Resultatenstaat
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Bedragen {EENHEID_LABEL[eenheid]}, exclusief BTW
        </span>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {regels.map((regel) => {
          const isUitkomst = regel.soort === 'uitkomst';
          const isTotaal = regel.soort === 'totaal';
          const isSubsidie = regel.soort === 'subsidie';

          return (
            <div
              key={regel.label}
              className={`flex items-baseline justify-between gap-4 py-2.5 ${
                isUitkomst ? 'border-t-2 border-t-gray-300 dark:border-t-gray-600 mt-1 pt-3' : ''
              }`}
            >
              <div className={regel.ingesprongen ? 'pl-4' : ''}>
                <span
                  className={`text-sm ${
                    isUitkomst
                      ? 'font-bold text-gray-900 dark:text-gray-100'
                      : isTotaal
                        ? 'font-semibold text-gray-900 dark:text-gray-100'
                        : isSubsidie
                          ? 'font-medium text-emerald-700 dark:text-emerald-300'
                          : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {regel.label}
                </span>
                {regel.toelichting && (
                  <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                    {regel.toelichting}
                  </span>
                )}
              </div>

              <span
                className={`text-sm tabular-nums whitespace-nowrap ${
                  isUitkomst
                    ? `text-base font-bold ${
                        resultaat.resultaat >= 0
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-red-700 dark:text-red-300'
                      }`
                    : isTotaal
                      ? 'font-semibold text-gray-900 dark:text-gray-100'
                      : isSubsidie
                        ? 'font-medium text-emerald-700 dark:text-emerald-300'
                        : 'text-gray-700 dark:text-gray-200'
                }`}
              >
                {formatEuro(regel.bedrag)}
              </span>
            </div>
          );
        })}
      </div>

      {(resultaat.btwOnderlingUit > 0 || resultaat.btwOnderlingIn > 0) && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Op de onderlinge facturen staat daarnaast {formatEuro(om(resultaat.btwOnderlingUit))} aan
          BTW die wij in rekening brengen en {formatEuro(om(resultaat.btwOnderlingIn))} die aan ons
          in rekening wordt gebracht. Die telt niet mee in het resultaat: hij wordt afgedragen en
          weer teruggevorderd.
        </p>
      )}

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Zonder subsidie zou het resultaat{' '}
        <span className="font-semibold tabular-nums">
          {formatEuro(om(resultaat.resultaatZonderSubsidie))}
        </span>{' '}
        zijn.
      </p>

      {(resultaat.kostenOpEntiteit > 0 || resultaat.nietVerdeeldeVasteLasten > 0) && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          Hiervan hangt {formatEuro(om(resultaat.kostenOpEntiteit))} aan kosten en{' '}
          {formatEuro(om(resultaat.nietVerdeeldeVasteLasten))} aan vaste lasten niet aan een
          opdracht.
        </p>
      )}
    </div>
  );
};

export default ResultatenStaat;
