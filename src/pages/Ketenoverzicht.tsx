// src/pages/Ketenoverzicht.tsx
// De entiteiten naast elkaar, met de onderlinge leveringen zichtbaar. Wat de
// één levert en de ander afneemt valt tegen elkaar weg — die regel staat er
// expliciet in, want anders lijkt de groep groter dan hij is.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Download, Network } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useApp } from '../contexts/AppContext';
import { useBegrotingsdata } from '../hooks/useBegrotingsdata';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import ControleBalk from '../components/begroting/ControleBalk';
import KetenEntiteitKaart from '../components/begroting/KetenEntiteitKaart';
import EenheidSchakelaar from '../components/begroting/EenheidSchakelaar';
import { berekenKeten } from '../utils/begroting.calc';
import { exporteerKetenCSV, exporteerKetenPDF } from '../services/exportService';
import { formatEuro, vanMaand } from '../utils/periode';
import { EENHEID_LABEL, STANDAARD_AANNAMES, type Eenheid } from '../types/begroting';

const Ketenoverzicht: React.FC = () => {
  usePageTitle('Ketenoverzicht');
  const navigate = useNavigate();
  const { entiteiten } = useApp();
  const { doorgerekend, laden, fout } = useBegrotingsdata();

  const [eenheid, setEenheid] = useState<Eenheid>('maand');
  // Per entiteit kun je kiezen welke begroting meetelt in de keten.
  const [keuze, setKeuze] = useState<Record<string, string>>({});

  // Standaard de vastgestelde begroting, anders de eerste die geen archief is.
  useEffect(() => {
    setKeuze((huidig) => {
      const bijgewerkt = { ...huidig };
      let veranderd = false;

      entiteiten.forEach((entiteit) => {
        const vanEntiteit = doorgerekend.filter((item) => item.entiteit.id === entiteit.id);
        if (vanEntiteit.length === 0) return;

        const bestaatNog = vanEntiteit.some((item) => item.budget.id === bijgewerkt[entiteit.id]);
        if (bestaatNog) return;

        const standaard =
          vanEntiteit.find((item) => item.budget.status === 'vastgesteld') ??
          vanEntiteit.find((item) => item.budget.status !== 'archief') ??
          vanEntiteit[0];

        bijgewerkt[entiteit.id] = standaard.budget.id;
        veranderd = true;
      });

      return veranderd ? bijgewerkt : huidig;
    });
  }, [entiteiten, doorgerekend]);

  const selectie = useMemo(
    () =>
      entiteiten.flatMap((entiteit) => {
        const gekozen = doorgerekend.find((item) => item.budget.id === keuze[entiteit.id]);
        return gekozen ? [gekozen] : [];
      }),
    [entiteiten, doorgerekend, keuze]
  );

  const keten = useMemo(
    () => berekenKeten(selectie.map((item) => item.resultaat)),
    [selectie]
  );

  const aannames = selectie[0]?.resultaat.aannames ?? STANDAARD_AANNAMES;
  const om = (bedrag: number) => vanMaand(bedrag, eenheid, aannames);

  // De holding staat boven de entiteiten en draagt de vaste lasten van de groep.
  // Die zetten we onderaan apart, want het is geen werkende entiteit.
  const werkendeEntiteiten = selectie.filter((item) => !item.entiteit.isHolding);
  const holdings = selectie.filter((item) => item.entiteit.isHolding);
  const gesorteerd = [...werkendeEntiteiten, ...holdings];
  const vasteLastenGroep = holdings.reduce(
    (totaal, item) => totaal + item.resultaat.vasteLasten,
    0
  );

  // De BTW van de hele groep bij elkaar. Wat de één onderling afdraagt vordert
  // de ander terug, dus dat valt in deze optelling vanzelf tegen elkaar weg —
  // wat overblijft is wat er echt naar de Belastingdienst gaat.
  const btwKeten = selectie.reduce(
    (totalen, item) => ({
      afTeDragen: totalen.afTeDragen + item.resultaat.btw.afTeDragen,
      terugTeVorderen: totalen.terugTeVorderen + item.resultaat.btw.terugTeVorderen,
      saldo: totalen.saldo + item.resultaat.btw.saldo,
    }),
    { afTeDragen: 0, terugTeVorderen: 0, saldo: 0 }
  );

  if (laden) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ketenoverzicht"
        subtitle="De entiteiten naast elkaar, inclusief wat er onderling geleverd wordt"
        emoji="🔗"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <EenheidSchakelaar waarde={eenheid} onChange={setEenheid} />
            <Button
              variant="outline"
              onClick={() => exporteerKetenCSV(keten, eenheid)}
              disabled={selectie.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => void exporteerKetenPDF(keten, eenheid)}
              disabled={selectie.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden />
              PDF
            </Button>
          </div>
        }
      />

      {fout && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 text-sm text-red-800 dark:text-red-200">
          {fout}
        </div>
      )}

      {selectie.length === 0 ? (
        <Card>
          <EmptyState
            icon={Network}
            title="Nog niets om naast elkaar te zetten"
            description="Maak eerst begrotingen aan voor je entiteiten. Dan verschijnen ze hier naast elkaar, met de onderlinge leveringen ertussen."
            actionLabel="Naar begrotingen"
            onAction={() => navigate('/begrotingen')}
          />
        </Card>
      ) : (
        <>
          <ControleBalk afwijkingen={keten.afwijkingen} />

          {/* Welke begroting telt mee per entiteit */}
          <Card>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
              Welke begroting telt mee
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Per entiteit telt één begroting mee in de keten. Standaard de vastgestelde.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entiteiten.map((entiteit) => {
                const opties = doorgerekend.filter((item) => item.entiteit.id === entiteit.id);
                if (opties.length === 0) return null;

                return (
                  <div key={entiteit.id} className="space-y-1.5">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: entiteit.kleur }}
                        aria-hidden
                      />
                      {entiteit.naam}
                    </span>
                    <select
                      value={keuze[entiteit.id] ?? ''}
                      onChange={(event) =>
                        setKeuze((huidig) => ({ ...huidig, [entiteit.id]: event.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
                    >
                      {opties.map(({ budget }) => (
                        <option key={budget.id} value={budget.id}>
                          {budget.naam}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* De entiteiten naast elkaar */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-4 mb-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                De entiteiten naast elkaar
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Bedragen {EENHEID_LABEL[eenheid]}
              </span>
            </div>

            {/* Telefoon en tablet: onder elkaar. Zes kolommen worden op een smal
                scherm 680 px breed, en dan scrol je zijwaarts door je eigen
                cijfers heen. */}
            <div className="space-y-2 lg:hidden">
              {gesorteerd.map(({ entiteit, budget, resultaat }) => (
                <KetenEntiteitKaart
                  key={budget.id}
                  entiteit={entiteit}
                  budget={budget}
                  resultaat={resultaat}
                  om={om}
                  onOpenen={() => navigate(`/begrotingen/${budget.id}`)}
                />
              ))}

              <div className="pt-3 mt-1 border-t-2 border-gray-300 dark:border-gray-600">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">Samen</p>
                <div className="flex items-baseline justify-between gap-3 py-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Opbrengst</span>
                  <span className="text-sm tabular-nums whitespace-nowrap text-gray-700 dark:text-gray-200">
                    {formatEuro(om(keten.opbrengstBruto))}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Subsidies</span>
                  <span className="text-sm tabular-nums whitespace-nowrap text-emerald-700 dark:text-emerald-300">
                    {formatEuro(om(keten.subsidies))}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Kosten</span>
                  <span className="text-sm tabular-nums whitespace-nowrap text-gray-700 dark:text-gray-200">
                    {formatEuro(om(keten.kostenBruto))}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 pt-1.5 mt-1 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                    Resultaat
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums whitespace-nowrap ${
                      keten.resultaat >= 0
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}
                  >
                    {formatEuro(om(keten.resultaat))}
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left font-semibold py-2 pr-3">Entiteit</th>
                    <th className="text-right font-semibold py-2 px-3">Opbrengst</th>
                    <th className="text-right font-semibold py-2 px-3">Subsidies</th>
                    <th className="text-right font-semibold py-2 px-3">Kosten</th>
                    <th className="text-right font-semibold py-2 px-3">Resultaat</th>
                    <th className="text-right font-semibold py-2 pl-3">Zonder subsidie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {gesorteerd.map(({ entiteit, budget, resultaat }) => (
                    <tr key={budget.id}>
                      <td className="py-2.5 pr-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/begrotingen/${budget.id}`)}
                          className="flex items-center gap-2 text-left"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: entiteit.kleur }}
                            aria-hidden
                          />
                          <span>
                            <span className="block font-medium text-gray-900 dark:text-gray-100">
                              {entiteit.naam}
                              {entiteit.isHolding && (
                                <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 align-middle">
                                  holding
                                </span>
                              )}
                            </span>
                            <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                              {budget.naam}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-200">
                        {formatEuro(om(resultaat.totaleOpbrengst))}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                        {formatEuro(om(resultaat.subsidies))}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-200">
                        {formatEuro(om(resultaat.totaleKosten))}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums font-semibold ${
                          resultaat.resultaat >= 0
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-red-700 dark:text-red-300'
                        }`}
                      >
                        {formatEuro(om(resultaat.resultaat))}
                      </td>
                      <td className="py-2.5 pl-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                        {formatEuro(om(resultaat.resultaatZonderSubsidie))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                    <td className="py-2.5 pr-3 font-bold text-gray-900 dark:text-gray-100">
                      Samen
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                      {formatEuro(om(keten.opbrengstBruto))}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
                      {formatEuro(om(keten.subsidies))}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                      {formatEuro(om(keten.kostenBruto))}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right tabular-nums font-bold ${
                        keten.resultaat >= 0
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-red-700 dark:text-red-300'
                      }`}
                    >
                      {formatEuro(om(keten.resultaat))}
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {formatEuro(om(keten.resultaatZonderSubsidie))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* De onderlinge stromen */}
          <Card>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
              Onderling
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Wat de één levert en de ander afneemt. Bij de leverende entiteit een opbrengst, bij
              de ontvangende een even grote kost.
            </p>

            {keten.stromen.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Er wordt op dit moment niets onderling geleverd.
              </p>
            ) : (
              <div className="space-y-2">
                {keten.stromen.map((stroom) => (
                  <div
                    key={stroom.id}
                    className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700"
                  >
                    <span className="flex-1 min-w-[220px]">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        {stroom.omschrijving}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {stroom.vanNaam}
                        <ArrowRight className="h-3 w-3" aria-hidden />
                        {stroom.naarNaam}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                      {formatEuro(om(stroom.bedrag))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* De optelsom van de keten */}
          <Card>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-3">
              De keten als geheel
            </h3>

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {[
                { label: 'Opbrengst van alle entiteiten samen', bedrag: keten.opbrengstBruto },
                {
                  label: 'Onderling — valt tegen elkaar weg',
                  bedrag: -keten.onderlingTotaal,
                  gedempt: true,
                },
                { label: 'Opbrengst naar buiten toe', bedrag: keten.opbrengstNetto, vet: true },
                { label: 'Subsidies', bedrag: keten.subsidies },
                { label: 'Kosten van alle entiteiten samen', bedrag: keten.kostenBruto },
                {
                  label: 'Onderling — valt tegen elkaar weg',
                  bedrag: -keten.onderlingTotaal,
                  gedempt: true,
                },
                { label: 'Kosten naar buiten toe', bedrag: keten.kostenNetto, vet: true },
                ...(vasteLastenGroep > 0
                  ? [
                      {
                        label: 'Waarvan vaste lasten bij de holding',
                        bedrag: vasteLastenGroep,
                        gedempt: true,
                      },
                    ]
                  : []),
              ].map((regel, index) => (
                <div
                  key={`${regel.label}-${index}`}
                  className="flex items-baseline justify-between gap-4 py-2.5"
                >
                  <span
                    className={`text-sm ${
                      regel.vet
                        ? 'font-semibold text-gray-900 dark:text-gray-100'
                        : regel.gedempt
                          ? 'text-gray-500 dark:text-gray-400 pl-4'
                          : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {regel.label}
                  </span>
                  <span
                    className={`text-sm tabular-nums ${
                      regel.vet
                        ? 'font-semibold text-gray-900 dark:text-gray-100'
                        : regel.gedempt
                          ? 'text-gray-500 dark:text-gray-400'
                          : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {formatEuro(om(regel.bedrag))}
                  </span>
                </div>
              ))}

              <div className="flex items-baseline justify-between gap-4 pt-3 border-t-2 border-t-gray-300 dark:border-t-gray-600">
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Resultaat van de keten
                </span>
                <span
                  className={`text-base font-bold tabular-nums ${
                    keten.resultaat >= 0
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  {formatEuro(om(keten.resultaat))}
                </span>
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Zonder subsidie zou de keten uitkomen op{' '}
              <span className="font-semibold tabular-nums">
                {formatEuro(om(keten.resultaatZonderSubsidie))}
              </span>
              .
            </p>
          </Card>

          {/* De BTW van de groep */}
          <Card>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
              BTW van de groep
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Alle entiteiten bij elkaar. De BTW op de onderlinge facturen valt hier vanzelf
              tegen elkaar weg: de één draagt af wat de ander terugvordert.
            </p>

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <span className="text-sm text-gray-600 dark:text-gray-300">Af te dragen</span>
                <span className="text-sm tabular-nums text-gray-700 dark:text-gray-200">
                  {formatEuro(om(btwKeten.afTeDragen))}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <span className="text-sm text-gray-600 dark:text-gray-300">Terug te vorderen</span>
                <span className="text-sm tabular-nums text-gray-700 dark:text-gray-200">
                  {formatEuro(om(btwKeten.terugTeVorderen))}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4 pt-3 border-t-2 border-t-gray-300 dark:border-t-gray-600">
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {btwKeten.saldo >= 0
                    ? 'Te betalen aan de Belastingdienst'
                    : 'Terug van de Belastingdienst'}
                </span>
                <span
                  className={`text-base font-bold tabular-nums ${
                    btwKeten.saldo >= 0
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {formatEuro(Math.abs(om(btwKeten.saldo)))}
                </span>
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              De BTW verandert het resultaat van de keten niet — alle bedragen hierboven zijn
              exclusief BTW.
            </p>
          </Card>
        </>
      )}
    </div>
  );
};

export default Ketenoverzicht;
