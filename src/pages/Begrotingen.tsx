// src/pages/Begrotingen.tsx
// Alle begrotingen en scenario's, gegroepeerd per entiteit.

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useBegrotingsdata } from '../hooks/useBegrotingsdata';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ActionMenu from '../components/ui/ActionMenu';
import PeriodSelector from '../components/ui/PeriodSelector';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { dupliceerAlsScenario, verwijderBegroting, wijzigStatus } from '../services/budgetService';
import { periodeBereikLabel, valtInJaar } from '../utils/dateFilters';
import { formatEuro, vanMaand } from '../utils/periode';
import { BEGROTING_STATUS_LABEL, type BegrotingStatus } from '../types/begroting';

const STATUS_KLEUR: Record<BegrotingStatus, string> = {
  concept: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
  vastgesteld: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200',
  archief: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

const Begrotingen: React.FC = () => {
  usePageTitle('Begrotingen');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { entiteiten, geselecteerdJaar } = useApp();
  const { doorgerekend, laden, fout, herlaad } = useBegrotingsdata();
  const [melding, setMelding] = useState<string | null>(null);

  // Alleen de begrotingen die het gekozen jaar raken; een begroting die van
  // 2026-01 tot 2027-06 loopt hoort dus bij allebei die jaren.
  const zichtbaar = useMemo(
    () =>
      doorgerekend.filter((item) =>
        valtInJaar(item.budget.periodeVan, item.budget.periodeTot, geselecteerdJaar)
      ),
    [doorgerekend, geselecteerdJaar]
  );

  const perEntiteit = useMemo(
    () =>
      entiteiten
        .map((entiteit) => ({
          entiteit,
          items: zichtbaar.filter((item) => item.entiteit.id === entiteit.id),
        }))
        .filter((groep) => groep.items.length > 0),
    [entiteiten, zichtbaar]
  );

  const dupliceer = async (budgetId: string, huidigeNaam: string) => {
    const naam = window.prompt('Naam voor het nieuwe scenario', `${huidigeNaam} — variant`);
    if (!naam?.trim()) return;

    try {
      const nieuwId = await dupliceerAlsScenario(budgetId, naam.trim(), user?.uid ?? '');
      await herlaad();
      navigate(`/begrotingen/${nieuwId}`);
    } catch (foutmelding) {
      setMelding(foutmelding instanceof Error ? foutmelding.message : 'Dupliceren mislukt.');
    }
  };

  const zetStatus = async (budgetId: string, status: BegrotingStatus) => {
    try {
      await wijzigStatus(budgetId, status);
      await herlaad();
    } catch {
      setMelding('De status kon niet gewijzigd worden.');
    }
  };

  const verwijder = async (budgetId: string, naam: string) => {
    if (!window.confirm(`"${naam}" verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return;

    try {
      await verwijderBegroting(budgetId);
      await herlaad();
      setMelding(`"${naam}" is verwijderd.`);
    } catch {
      setMelding('Verwijderen mislukt.');
    }
  };

  if (laden) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Begrotingen"
        subtitle={`Alle begrotingen en scenario's die ${geselecteerdJaar} raken`}
        emoji="💼"
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <PeriodSelector />
            </div>
            <Button onClick={() => navigate('/begrotingen/nieuw')}>
              <Plus className="h-4 w-4" aria-hidden />
              Nieuwe begroting
            </Button>
          </div>
        }
      />

      {(fout || melding) && (
        <div
          className={`px-4 py-3 rounded-xl text-sm ${
            fout
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-200'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
          }`}
        >
          {fout ?? melding}
        </div>
      )}

      {perEntiteit.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title={`Geen begrotingen in ${geselecteerdJaar}`}
            description="Maak een nieuwe begroting aan, of kies een ander jaar. Onder Instellingen kun je ook de voorbeelddata laden."
            actionLabel="Nieuwe begroting"
            onAction={() => navigate('/begrotingen/nieuw')}
          />
        </Card>
      ) : (
        perEntiteit.map(({ entiteit, items }) => (
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
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {items.length} {items.length === 1 ? 'begroting' : 'begrotingen'}
              </span>
            </div>

            <div className="space-y-2">
              {items.map(({ budget, resultaat, afwijkingen }) => (
                <div
                  key={budget.id}
                  className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/begrotingen/${budget.id}`)}
                    className="flex-1 min-w-[200px] text-left"
                  >
                    <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {budget.naam}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {periodeBereikLabel(budget.periodeVan, budget.periodeTot)}
                      {budget.scenarioVan && ' · scenario'}
                    </span>
                  </button>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_KLEUR[budget.status]}`}
                    >
                      {BEGROTING_STATUS_LABEL[budget.status]}
                    </span>

                    {afwijkingen.length > 0 && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200">
                        {afwijkingen.length} controle
                        {afwijkingen.length === 1 ? '' : 's'} niet in orde
                      </span>
                    )}

                    <span className="text-right min-w-[120px]">
                      <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                        Resultaat per maand
                      </span>
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          resultaat.resultaat >= 0
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-red-700 dark:text-red-300'
                        }`}
                      >
                        {formatEuro(vanMaand(resultaat.resultaat, 'maand', budget.aannames))}
                      </span>
                    </span>

                    <ActionMenu
                      actions={[
                        {
                          label: 'Openen',
                          icon: Pencil,
                          onClick: () => navigate(`/begrotingen/${budget.id}`),
                        },
                        {
                          label: 'Dupliceren als scenario',
                          icon: Copy,
                          onClick: () => void dupliceer(budget.id, budget.naam),
                        },
                        ...(budget.status !== 'vastgesteld'
                          ? [
                              {
                                label: 'Markeren als vastgesteld',
                                onClick: () => void zetStatus(budget.id, 'vastgesteld'),
                              },
                            ]
                          : []),
                        ...(budget.status !== 'concept'
                          ? [
                              {
                                label: 'Terug naar concept',
                                onClick: () => void zetStatus(budget.id, 'concept'),
                              },
                            ]
                          : []),
                        ...(budget.status !== 'archief'
                          ? [
                              {
                                label: 'Naar archief',
                                onClick: () => void zetStatus(budget.id, 'archief'),
                              },
                            ]
                          : []),
                        {
                          label: 'Verwijderen',
                          icon: Trash2,
                          variant: 'danger' as const,
                          onClick: () => void verwijder(budget.id, budget.naam),
                        },
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default Begrotingen;
