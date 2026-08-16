// src/pages/Dashboard.tsx
// Het resultaat van alle entiteiten in één oogopslag, met snelkoppelingen naar
// de begrotingen eronder.

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Network, Plus, Wallet } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useApp } from '../contexts/AppContext';
import { useBegrotingsdata } from '../hooks/useBegrotingsdata';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatTile from '../components/ui/StatTile';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { berekenKeten } from '../utils/begroting.calc';
import { periodeBereikLabel } from '../utils/dateFilters';
import { formatEuro } from '../utils/periode';
import { BEGROTING_STATUS_LABEL } from '../types/begroting';

const Dashboard: React.FC = () => {
  usePageTitle('Dashboard');
  const navigate = useNavigate();
  const { entiteiten } = useApp();
  const { doorgerekend, laden, fout } = useBegrotingsdata();

  // Voor de keten telt per entiteit één begroting mee: de vastgestelde als die
  // er is, anders de eerste die geen archief is.
  const ketenSelectie = useMemo(
    () =>
      entiteiten.flatMap((entiteit) => {
        const vanEntiteit = doorgerekend.filter((item) => item.entiteit.id === entiteit.id);
        const gekozen =
          vanEntiteit.find((item) => item.budget.status === 'vastgesteld') ??
          vanEntiteit.find((item) => item.budget.status !== 'archief');
        return gekozen ? [gekozen] : [];
      }),
    [entiteiten, doorgerekend]
  );

  const keten = useMemo(
    () => berekenKeten(ketenSelectie.map((item) => item.resultaat)),
    [ketenSelectie]
  );

  const aantalAfwijkingen = useMemo(
    () => doorgerekend.reduce((totaal, item) => totaal + item.afwijkingen.length, 0),
    [doorgerekend]
  );

  if (laden) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        subtitle="Het resultaat per entiteit, per maand"
        emoji="📊"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/keten')}>
              <Network className="h-4 w-4" aria-hidden />
              Ketenoverzicht
            </Button>
            <Button onClick={() => navigate('/begrotingen/nieuw')}>
              <Plus className="h-4 w-4" aria-hidden />
              Nieuwe begroting
            </Button>
          </div>
        }
      />

      {fout && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 text-sm text-red-800 dark:text-red-200">
          {fout}
        </div>
      )}

      {doorgerekend.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title="Nog geen begrotingen"
            description="Maak een begroting aan voor een entiteit, of laad de voorbeelddata onder Instellingen om met echte cijfers te beginnen."
            actionLabel="Nieuwe begroting"
            onAction={() => navigate('/begrotingen/nieuw')}
          />
        </Card>
      ) : (
        <>
          {/* Kerncijfers van de keten */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Opbrengst naar buiten"
              value={formatEuro(keten.opbrengstNetto)}
              sub="per maand, onderling weggestreept"
              emoji="📈"
              tone="sky"
            />
            <StatTile
              label="Kosten naar buiten"
              value={formatEuro(keten.kostenNetto)}
              sub="per maand"
              emoji="📉"
              tone="amber"
            />
            <StatTile
              label="Subsidies"
              value={formatEuro(keten.subsidies)}
              sub="eigen regel, niet verrekend"
              emoji="🤝"
              tone="teal"
            />
            <StatTile
              label="Resultaat"
              value={formatEuro(keten.resultaat)}
              sub={`zonder subsidie ${formatEuro(keten.resultaatZonderSubsidie)}`}
              emoji="💰"
              tone={keten.resultaat >= 0 ? 'emerald' : 'red'}
            />
          </div>

          {aantalAfwijkingen > 0 && (
            <button
              type="button"
              onClick={() => navigate('/begrotingen')}
              className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 text-left"
            >
              <AlertTriangle
                className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0"
                aria-hidden
              />
              <span className="text-sm font-semibold text-red-800 dark:text-red-200 flex-1">
                {aantalAfwijkingen} {aantalAfwijkingen === 1 ? 'controle klopt' : 'controles kloppen'}{' '}
                niet
              </span>
              <ArrowRight className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden />
            </button>
          )}

          {/* Per entiteit */}
          {entiteiten.map((entiteit) => {
            const items = doorgerekend.filter((item) => item.entiteit.id === entiteit.id);
            if (items.length === 0) return null;

            return (
              <Card key={entiteit.id}>
                <div className="flex items-center gap-2.5 mb-4">
                  <span
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: entiteit.kleur }}
                    aria-hidden
                  />
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                    {entiteit.naam}
                  </h2>
                  {!entiteit.actief && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      Inactief
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {items.map(({ budget, resultaat, afwijkingen }) => (
                    <button
                      key={budget.id}
                      type="button"
                      onClick={() => navigate(`/begrotingen/${budget.id}`)}
                      className="w-full flex flex-wrap items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800 transition-colors text-left"
                    >
                      <span className="flex-1 min-w-[180px]">
                        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {budget.naam}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {periodeBereikLabel(budget.periodeVan, budget.periodeTot)} ·{' '}
                          {BEGROTING_STATUS_LABEL[budget.status]}
                        </span>
                      </span>

                      {afwijkingen.length > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200">
                          {afwijkingen.length} controle{afwijkingen.length === 1 ? '' : 's'}
                        </span>
                      )}

                      <span className="grid grid-cols-3 gap-4 text-right">
                        <span>
                          <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                            Opbrengst
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-200 tabular-nums">
                            {formatEuro(resultaat.totaleOpbrengst)}
                          </span>
                        </span>
                        <span>
                          <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                            Kosten
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-200 tabular-nums">
                            {formatEuro(resultaat.totaleKosten)}
                          </span>
                        </span>
                        <span>
                          <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                            Resultaat
                          </span>
                          <span
                            className={`text-sm font-bold tabular-nums ${
                              resultaat.resultaat >= 0
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : 'text-red-700 dark:text-red-300'
                            }`}
                          >
                            {formatEuro(resultaat.resultaat)}
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
};

export default Dashboard;
