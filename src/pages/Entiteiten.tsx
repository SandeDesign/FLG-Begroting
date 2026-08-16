// src/pages/Entiteiten.tsx
// De BV's van de groep: aanmaken, bewerken en doorklikken naar hun vaste lasten.

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useApp } from '../contexts/AppContext';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import ActionMenu from '../components/ui/ActionMenu';
import EntiteitModal from '../components/begroting/EntiteitModal';
import {
  maakEntiteit,
  verwijderEntiteit,
  werkEntiteitBij,
} from '../services/entityService';
import { naarMaand, formatEuro } from '../utils/periode';
import {
  ENTITEIT_SOORT_LABEL,
  entiteitSoort,
  STANDAARD_AANNAMES,
  type Entity,
  type NieuweEntity,
} from '../types/begroting';

const Entiteiten: React.FC = () => {
  usePageTitle('Entiteiten');
  const navigate = useNavigate();
  const { entiteiten, laden, fout, herlaadEntiteiten } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [teBewerken, setTeBewerken] = useState<Entity | null>(null);
  const [melding, setMelding] = useState<string | null>(null);

  // De vaste lasten worden hier per maand getoond, ongeacht hoe ze zijn ingevoerd.
  const vasteLastenPerEntiteit = useMemo(() => {
    const totalen = new Map<string, number>();
    entiteiten.forEach((entiteit) => {
      totalen.set(
        entiteit.id,
        entiteit.vasteLasten.reduce(
          (totaal, last) => totaal + naarMaand(last.bedrag, last.eenheid, STANDAARD_AANNAMES),
          0
        )
      );
    });
    return totalen;
  }, [entiteiten]);

  const bewaar = async (waarden: NieuweEntity) => {
    if (teBewerken) {
      await werkEntiteitBij(teBewerken.id, waarden);
    } else {
      await maakEntiteit(waarden);
    }
    await herlaadEntiteiten();
  };

  const verwijder = async (entiteit: Entity) => {
    const bevestigd = window.confirm(
      `${entiteit.naam} verwijderen? De begrotingen van deze entiteit blijven staan, maar horen dan nergens meer bij.`
    );
    if (!bevestigd) return;

    try {
      await verwijderEntiteit(entiteit.id);
      await herlaadEntiteiten();
      setMelding(`${entiteit.naam} is verwijderd.`);
    } catch {
      setMelding('Verwijderen mislukt. Probeer het opnieuw.');
    }
  };

  const openNieuw = () => {
    setTeBewerken(null);
    setModalOpen(true);
  };

  const openBewerken = (entiteit: Entity) => {
    setTeBewerken(entiteit);
    setModalOpen(true);
  };

  if (laden) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Entiteiten"
        subtitle="De BV's van de groep"
        emoji="🏢"
        actions={
          <Button onClick={openNieuw}>
            <Plus className="h-4 w-4" aria-hidden />
            Nieuwe entiteit
          </Button>
        }
      />

      {fout && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 text-sm text-red-800 dark:text-red-200">
          {fout}
        </div>
      )}

      {melding && (
        <div className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200">
          {melding}
        </div>
      )}

      {entiteiten.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="Nog geen entiteiten"
            description="Voeg de BV's toe waarvoor je wilt begroten. Of laad de voorbeelddata onder Instellingen."
            actionLabel="Nieuwe entiteit"
            onAction={openNieuw}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entiteiten.map((entiteit) => (
            <Card key={entiteit.id} className={entiteit.actief ? '' : 'opacity-70'}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="h-10 w-10 rounded-xl flex-shrink-0"
                    style={{ backgroundColor: entiteit.kleur }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight truncate">
                      {entiteit.naam}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {entiteit.kvk ? `KvK ${entiteit.kvk}` : 'Geen KvK-nummer'}
                    </p>
                  </div>
                </div>

                <ActionMenu
                  actions={[
                    { label: 'Bewerken', icon: Pencil, onClick: () => openBewerken(entiteit) },
                    {
                      label: 'Vaste lasten',
                      icon: Receipt,
                      onClick: () => navigate(`/entiteiten/${entiteit.id}/vaste-lasten`),
                    },
                    {
                      label: 'Verwijderen',
                      icon: Trash2,
                      variant: 'danger',
                      onClick: () => void verwijder(entiteit),
                    },
                  ]}
                />
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    entiteit.isHolding
                      ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200'
                      : entiteit.heeftPersoneel
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200'
                        : 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200'
                  }`}
                >
                  {ENTITEIT_SOORT_LABEL[entiteitSoort(entiteit)]}
                </span>
                {!entiteit.actief && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    Inactief
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate(`/entiteiten/${entiteit.id}/vaste-lasten`)}
                className="w-full flex items-baseline justify-between px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors text-left"
              >
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Vaste lasten ({entiteit.vasteLasten.length})
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                  {formatEuro(vasteLastenPerEntiteit.get(entiteit.id) ?? 0)}
                  <span className="text-xs font-normal text-gray-400 dark:text-gray-500"> /mnd</span>
                </span>
              </button>
            </Card>
          ))}
        </div>
      )}

      <EntiteitModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        entiteit={teBewerken}
        aantalBestaand={entiteiten.length}
        onBewaren={bewaar}
      />
    </div>
  );
};

export default Entiteiten;
