// src/pages/ScenarioVergelijk.tsx
// Twee tot vier scenario's naast elkaar in één tabel, met daaronder altijd de
// variant zonder subsidie — anders lijkt een begroting gezonder dan hij is.

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitCompareArrows, X } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useBegrotingsdata, type DoorgerekendeBegroting } from '../hooks/useBegrotingsdata';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import EenheidSchakelaar from '../components/begroting/EenheidSchakelaar';
import { formatEuro, vanMaand } from '../utils/periode';
import { EENHEID_LABEL, type BegrotingResultaat, type Eenheid } from '../types/begroting';

const MAXIMAAL = 4;

/** De regels die naast elkaar gezet worden, in de volgorde van de resultatenstaat. */
const REGELS: Array<{
  label: string;
  waarde: (resultaat: BegrotingResultaat) => number;
  soort?: 'totaal' | 'uitkomst' | 'subsidie';
  ingesprongen?: boolean;
}> = [
  { label: 'Opbrengsten uit opdrachten', waarde: (r) => r.opbrengstOpdrachten, ingesprongen: true },
  {
    label: 'Opbrengst onderlinge leveringen',
    waarde: (r) => r.opbrengstOnderlingUit,
    ingesprongen: true,
  },
  { label: 'Totale opbrengst', waarde: (r) => r.totaleOpbrengst, soort: 'totaal' },
  { label: 'Subsidies', waarde: (r) => r.subsidies, soort: 'subsidie' },
  { label: 'Directe kosten — middelen', waarde: (r) => r.kostenMiddelen, ingesprongen: true },
  { label: 'Directe kosten — inzet', waarde: (r) => r.kostenInzet, ingesprongen: true },
  {
    label: 'Kosten onderlinge leveringen',
    waarde: (r) => r.kostenOnderlingIn,
    ingesprongen: true,
  },
  { label: 'Vaste lasten', waarde: (r) => r.vasteLasten, ingesprongen: true },
  { label: 'Totale kosten', waarde: (r) => r.totaleKosten, soort: 'totaal' },
  { label: 'Resultaat', waarde: (r) => r.resultaat, soort: 'uitkomst' },
  { label: 'Resultaat zonder subsidie', waarde: (r) => r.resultaatZonderSubsidie, soort: 'uitkomst' },
];

const ScenarioVergelijk: React.FC = () => {
  usePageTitle('Scenario vergelijken');
  const navigate = useNavigate();
  const { doorgerekend, laden, fout } = useBegrotingsdata();

  const [gekozen, setGekozen] = useState<string[]>([]);
  const [eenheid, setEenheid] = useState<Eenheid>('maand');

  const selectie = useMemo<DoorgerekendeBegroting[]>(
    () =>
      gekozen.flatMap((id) => {
        const gevonden = doorgerekend.find((item) => item.budget.id === id);
        return gevonden ? [gevonden] : [];
      }),
    [gekozen, doorgerekend]
  );

  const aannames = selectie[0]?.resultaat.aannames;
  const om = (bedrag: number) => (aannames ? vanMaand(bedrag, eenheid, aannames) : bedrag);

  const voegToe = (budgetId: string) => {
    if (!budgetId || gekozen.includes(budgetId) || gekozen.length >= MAXIMAAL) return;
    setGekozen([...gekozen, budgetId]);
  };

  const haalWeg = (budgetId: string) => {
    setGekozen(gekozen.filter((id) => id !== budgetId));
  };

  if (laden) return <LoadingSpinner />;

  const beschikbaar = doorgerekend.filter((item) => !gekozen.includes(item.budget.id));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Scenario vergelijken"
        subtitle={`Tot ${MAXIMAAL} begrotingen naast elkaar`}
        emoji="⚖️"
        actions={selectie.length > 0 ? <EenheidSchakelaar waarde={eenheid} onChange={setEenheid} /> : undefined}
      />

      {fout && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 text-sm text-red-800 dark:text-red-200">
          {fout}
        </div>
      )}

      {doorgerekend.length === 0 ? (
        <Card>
          <EmptyState
            icon={GitCompareArrows}
            title="Nog niets te vergelijken"
            description="Maak eerst een paar begrotingen of scenario's aan. Een scenario maak je door een bestaande begroting te dupliceren."
            actionLabel="Naar begrotingen"
            onAction={() => navigate('/begrotingen')}
          />
        </Card>
      ) : (
        <>
          {/* Kiezen */}
          <Card>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-3">
              Welke begrotingen
            </h3>

            {gekozen.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectie.map(({ budget, entiteit }) => (
                  <span
                    key={budget.id}
                    className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-sm"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: entiteit.kleur }}
                      aria-hidden
                    />
                    <span className="text-gray-800 dark:text-gray-100">{budget.naam}</span>
                    <button
                      type="button"
                      onClick={() => haalWeg(budget.id)}
                      aria-label={`${budget.naam} weghalen`}
                      className="p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {gekozen.length < MAXIMAAL && beschikbaar.length > 0 ? (
              <select
                value=""
                onChange={(event) => voegToe(event.target.value)}
                className="w-full sm:max-w-md px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">Voeg een begroting toe…</option>
                {beschikbaar.map(({ budget, entiteit }) => (
                  <option key={budget.id} value={budget.id}>
                    {entiteit.naam} — {budget.naam}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {gekozen.length >= MAXIMAAL
                  ? `Meer dan ${MAXIMAAL} naast elkaar wordt onleesbaar. Haal er eerst een weg.`
                  : 'Alle begrotingen staan al in de vergelijking.'}
              </p>
            )}
          </Card>

          {/* Vergelijking */}
          {selectie.length < 2 ? (
            <Card>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Kies er minstens twee om ze naast elkaar te kunnen zetten.
              </p>
            </Card>
          ) : (
            <Card>
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-4 mb-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                  Naast elkaar
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Bedragen {EENHEID_LABEL[eenheid]}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 py-2 pr-3 min-w-[220px]">
                        Regel
                      </th>
                      {selectie.map(({ budget, entiteit }) => (
                        <th key={budget.id} className="text-right py-2 px-3 min-w-[140px]">
                          <span className="flex items-center justify-end gap-1.5">
                            <span
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: entiteit.kleur }}
                              aria-hidden
                            />
                            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                              {budget.naam}
                            </span>
                          </span>
                          <span className="block text-[11px] font-normal text-gray-400 dark:text-gray-500">
                            {entiteit.naam}
                          </span>
                        </th>
                      ))}
                      <th className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 py-2 pl-3 min-w-[120px]">
                        Verschil
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {REGELS.map((regel) => {
                      const waarden = selectie.map((item) => om(regel.waarde(item.resultaat)));
                      const verschil = waarden[waarden.length - 1] - waarden[0];
                      const isUitkomst = regel.soort === 'uitkomst';
                      const isTotaal = regel.soort === 'totaal';
                      const isSubsidie = regel.soort === 'subsidie';

                      return (
                        <tr
                          key={regel.label}
                          className={isUitkomst ? 'bg-gray-50/60 dark:bg-gray-900/30' : ''}
                        >
                          <td
                            className={`py-2.5 pr-3 ${regel.ingesprongen ? 'pl-4' : ''} ${
                              isUitkomst || isTotaal
                                ? 'font-semibold text-gray-900 dark:text-gray-100'
                                : isSubsidie
                                  ? 'font-medium text-emerald-700 dark:text-emerald-300'
                                  : 'text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            {regel.label}
                          </td>

                          {waarden.map((waarde, index) => (
                            <td
                              key={selectie[index].budget.id}
                              className={`py-2.5 px-3 text-right tabular-nums ${
                                isUitkomst
                                  ? `font-bold ${
                                      waarde >= 0
                                        ? 'text-emerald-700 dark:text-emerald-300'
                                        : 'text-red-700 dark:text-red-300'
                                    }`
                                  : isTotaal
                                    ? 'font-semibold text-gray-900 dark:text-gray-100'
                                    : isSubsidie
                                      ? 'text-emerald-700 dark:text-emerald-300'
                                      : 'text-gray-700 dark:text-gray-200'
                              }`}
                            >
                              {formatEuro(waarde)}
                            </td>
                          ))}

                          <td
                            className={`py-2.5 pl-3 text-right tabular-nums text-xs ${
                              Math.abs(verschil) < 0.005
                                ? 'text-gray-400 dark:text-gray-500'
                                : verschil > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {verschil > 0 ? '+' : ''}
                            {formatEuro(verschil)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                De kolom Verschil zet de laatst gekozen begroting af tegen de eerste. De regel
                zonder subsidie staat er altijd bij: een begroting die alleen met subsidie
                rondkomt, is een andere begroting dan een die dat zonder doet.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ScenarioVergelijk;
