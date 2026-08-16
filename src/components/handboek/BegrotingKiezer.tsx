// src/components/handboek/BegrotingKiezer.tsx
// Kiezer die verschijnt als het handboek je naar een begroting wil sturen maar
// er nog geen open staat.
//
// Zonder deze stap belandde je op de lijst met begrotingen en was je het
// tabblad én het scherm kwijt waar de uitleg over ging. Nu kies je hier een
// begroting en ga je meteen naar de juiste plek.

import React, { useEffect, useState } from 'react';
import { ArrowRight, Wallet } from 'lucide-react';
import { haalBegrotingen } from '../../services/budgetService';
import { periodeBereikLabel } from '../../utils/dateFilters';
import { BEGROTING_STATUS_LABEL, type Budget, type Entity } from '../../types/begroting';

interface BegrotingKiezerProps {
  /** Waar je heen gaat, in gewone taal — bijvoorbeeld "Inzet". */
  bestemming: string;
  entiteiten: Entity[];
  onKies: (budgetId: string) => void;
  onAnnuleer: () => void;
}

const BegrotingKiezer: React.FC<BegrotingKiezerProps> = ({
  bestemming,
  entiteiten,
  onKies,
  onAnnuleer,
}) => {
  const [begrotingen, setBegrotingen] = useState<Budget[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    let actief = true;

    haalBegrotingen()
      .then((gevonden) => {
        if (actief) setBegrotingen(gevonden);
      })
      .catch(() => {
        if (actief) setFout('De begrotingen konden niet geladen worden.');
      })
      .finally(() => {
        if (actief) setLaden(false);
      });

    return () => {
      actief = false;
    };
  }, []);

  const naamVanEntiteit = (entityId: string) =>
    entiteiten.find((entiteit) => entiteit.id === entityId)?.naam ?? 'Onbekende entiteit';

  const kleurVanEntiteit = (entityId: string) =>
    entiteiten.find((entiteit) => entiteit.id === entityId)?.kleur ?? '#a89d8f';

  // Archief weglaten — daar wil je zelden een uitleg op toepassen — en ook
  // begrotingen waarvan de entiteit niet meer bestaat: daar val je alleen maar
  // in een leeg scherm.
  const bruikbaar = begrotingen.filter(
    (begroting) =>
      begroting.status !== 'archief' &&
      entiteiten.some((entiteit) => entiteit.id === begroting.entityId)
  );

  return (
    <div className="absolute inset-0 z-10 bg-white dark:bg-gray-900 flex flex-col">
      <div className="px-4 sm:px-8 py-5 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 tracking-tight">
          Welke begroting?
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Kies een begroting; je gaat daarna direct naar {bestemming}.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {laden && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Bezig met laden…</p>
        )}

        {fout && (
          <p className="text-sm text-red-600 dark:text-red-400">{fout}</p>
        )}

        {!laden && !fout && bruikbaar.length === 0 && (
          <div className="text-center py-10">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 flex items-center justify-center mb-4">
              <Wallet className="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Er is nog geen begroting om naartoe te gaan.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Maak er eerst een aan, of laad de voorbeelddata onder Instellingen.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {bruikbaar.map((begroting) => (
            <button
              key={begroting.id}
              type="button"
              onClick={() => onKies(begroting.id)}
              className="group w-full flex items-center gap-3 p-3.5 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/40 dark:hover:bg-primary-900/15 transition-colors text-left"
            >
              <span
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: kleurVanEntiteit(begroting.entityId) }}
                aria-hidden
              />

              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {begroting.naam}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                  {naamVanEntiteit(begroting.entityId)} ·{' '}
                  {periodeBereikLabel(begroting.periodeVan, begroting.periodeTot)} ·{' '}
                  {BEGROTING_STATUS_LABEL[begroting.status]}
                </span>
              </span>

              <ArrowRight
                className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all flex-shrink-0"
                aria-hidden
              />
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 sm:px-8 py-4 border-t border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={onAnnuleer}
          className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          Terug naar de uitleg
        </button>
      </div>
    </div>
  );
};

export default BegrotingKiezer;
