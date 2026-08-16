// src/components/begroting/OpdrachtTabel.tsx
// Per opdracht wat het oplevert, wat het kost en wat er overblijft — vóór en na
// het aandeel in de vaste lasten. Onderaan staat wat er nodig is om quitte te
// draaien.

import React from 'react';
import type { BegrotingResultaat, BreakEven, Eenheid } from '../../types/begroting';
import { EENHEID_LABEL } from '../../types/begroting';
import { formatEuro, formatGetal, vanMaand } from '../../utils/periode';

interface OpdrachtTabelProps {
  resultaat: BegrotingResultaat;
  eenheid: Eenheid;
}

/** Zet het break-even punt om naar één leesbare zin. */
function breakEvenTekst(breakEven: BreakEven): string {
  switch (breakEven.soort) {
    case 'stuks':
      return `${formatGetal(breakEven.stuksPerDag, 1)} stuks per dag`;
    case 'uren':
      return `${formatEuro(breakEven.tariefPerUur)} per uur`;
    case 'vast':
      return `${formatEuro(breakEven.bedragPerMaand)} per maand`;
  }
}

const OpdrachtTabel: React.FC<OpdrachtTabelProps> = ({ resultaat, eenheid }) => {
  const om = (bedrag: number) => vanMaand(bedrag, eenheid, resultaat.aannames);

  if (resultaat.opdrachten.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Er zijn nog geen actieve opdrachten. Voeg er een toe onder het tabblad Opdrachten.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-4 mb-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
          Per opdracht
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Bedragen {EENHEID_LABEL[eenheid]}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left font-semibold py-2 pr-3">Opdracht</th>
              <th className="text-right font-semibold py-2 px-3 whitespace-nowrap">Opbrengst</th>
              <th className="text-right font-semibold py-2 px-3 whitespace-nowrap">
                Directe kosten
              </th>
              <th className="text-right font-semibold py-2 px-3 whitespace-nowrap">
                Over vóór vaste lasten
              </th>
              <th className="text-right font-semibold py-2 px-3 whitespace-nowrap">
                Aandeel vaste lasten
              </th>
              <th className="text-right font-semibold py-2 px-3 whitespace-nowrap">
                Over ná vaste lasten
              </th>
              <th className="text-right font-semibold py-2 px-3 whitespace-nowrap">
                Per stuk / uur
              </th>
              <th className="text-right font-semibold py-2 pl-3 whitespace-nowrap">Quitte bij</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {resultaat.opdrachten.map((opdracht) => (
              <tr key={opdracht.opdrachtId}>
                <td className="py-2.5 pr-3">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {opdracht.naam}
                  </span>
                  {opdracht.voorWie && (
                    <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                      voor {opdracht.voorWie}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-200">
                  {formatEuro(om(opdracht.opbrengst))}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-200">
                  {formatEuro(om(opdracht.directeKosten))}
                </td>
                <td
                  className={`py-2.5 px-3 text-right tabular-nums ${
                    opdracht.overVoorVasteLasten >= 0
                      ? 'text-gray-700 dark:text-gray-200'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatEuro(om(opdracht.overVoorVasteLasten))}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                  {formatEuro(om(opdracht.aandeelVasteLasten))}
                </td>
                <td
                  className={`py-2.5 px-3 text-right tabular-nums font-semibold ${
                    opdracht.overNaVasteLasten >= 0
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  {formatEuro(om(opdracht.overNaVasteLasten))}
                </td>
                <td className="py-2.5 px-3 text-right text-xs whitespace-nowrap">
                  {opdracht.volumeEenheid === 'geen' ? (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  ) : (
                    <>
                      <span
                        className={`font-semibold tabular-nums ${
                          opdracht.resultaatPerEenheid >= 0
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-red-700 dark:text-red-300'
                        }`}
                      >
                        {formatEuro(opdracht.resultaatPerEenheid)}
                      </span>
                      <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                        {formatGetal(opdracht.volumePerMaand, 0)} {opdracht.volumeEenheid} p/mnd
                      </span>
                    </>
                  )}
                </td>
                <td className="py-2.5 pl-3 text-right text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {breakEvenTekst(opdracht.breakEven)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        "Per stuk / uur" is wat er na de vaste lasten overblijft, gedeeld door het volume van die
        opdracht. "Quitte bij" is wat er nodig is om precies de directe kosten plus het aandeel in
        de vaste lasten te dekken; het aandeel in de vaste lasten blijft daarbij staan op de
        huidige verdeling.
      </p>
    </div>
  );
};

export default OpdrachtTabel;
