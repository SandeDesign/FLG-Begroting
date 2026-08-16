// src/components/begroting/RegelKaart.tsx
// Eén regel in een lijst op het werkblad: een opdracht, een middel, een inzet,
// een subsidie of een onderlinge levering. Overal dezelfde vorm, zodat de
// tabbladen op elkaar lijken.

import React from 'react';
import { Pencil, Sliders, Trash2 } from 'lucide-react';
import ActionMenu, { type ActionMenuItem } from '../ui/ActionMenu';
import { formatEuro } from '../../utils/periode';

interface RegelKaartProps {
  titel: string;
  ondertitel?: string;
  /** Kleine labels onder de titel, bijvoorbeeld "Per stuk" of "Inactief". */
  labels?: Array<{ tekst: string; toon?: 'neutraal' | 'goed' | 'waarschuwing' | 'schaal' }>;
  /** Het bedrag in de weergave-eenheid. */
  bedrag: number;
  bedragLabel: string;
  /** Regels met de opbouw van het bedrag, getoond onder de kaart. */
  opbouw?: Array<{ label: string; bedrag: number }>;
  actief: boolean;
  onBewerken: () => void;
  onVerwijderen: () => void;
  extraActies?: ActionMenuItem[];
  /**
   * Regels die uit de schaalknoppen komen zijn hier niet te bewerken: ze volgen
   * die knoppen. In plaats van bewerken en verwijderen wijst deze kaart naar het
   * tabblad Schaal.
   */
  vanSchaal?: boolean;
  onNaarSchaal?: () => void;
}

const LABEL_KLEUR = {
  neutraal: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  schaal: 'bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200',
  goed: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200',
  waarschuwing: 'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200',
};

const RegelKaart: React.FC<RegelKaartProps> = ({
  titel,
  ondertitel,
  labels = [],
  bedrag,
  bedragLabel,
  opbouw,
  actief,
  onBewerken,
  onVerwijderen,
  extraActies = [],
  vanSchaal = false,
  onNaarSchaal,
}) => (
  <div
    className={`p-3.5 rounded-lg border transition-colors ${
      vanSchaal
        ? 'border-dashed border-primary-200 dark:border-primary-800/60 bg-primary-50/30 dark:bg-primary-900/10'
        : 'border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800'
    } ${actief ? '' : 'opacity-60'}`}
  >
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={vanSchaal ? onNaarSchaal : onBewerken}
        className="flex-1 min-w-0 text-left"
      >
        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
          {titel}
        </span>
        {ondertitel && (
          <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
            {ondertitel}
          </span>
        )}
        {labels.length > 0 && (
          <span className="flex flex-wrap gap-1.5 mt-1.5">
            {labels.map((label) => (
              <span
                key={label.tekst}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  LABEL_KLEUR[label.toon ?? 'neutraal']
                }`}
              >
                {label.tekst}
              </span>
            ))}
          </span>
        )}
      </button>

      <div className="text-right flex-shrink-0">
        <span className="block text-[11px] text-gray-400 dark:text-gray-500">{bedragLabel}</span>
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
          {formatEuro(bedrag)}
        </span>
      </div>

      {vanSchaal ? (
        <ActionMenu
          actions={[
            {
              label: 'Naar de schaalknoppen',
              icon: Sliders,
              onClick: () => onNaarSchaal?.(),
            },
          ]}
        />
      ) : (
        <ActionMenu
          actions={[
            { label: 'Bewerken', icon: Pencil, onClick: onBewerken },
            ...extraActies,
            { label: 'Verwijderen', icon: Trash2, variant: 'danger', onClick: onVerwijderen },
          ]}
        />
      )}
    </div>

    {opbouw && opbouw.length > 0 && (
      <dl className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {opbouw.map((regel) => (
          <div key={regel.label} className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-gray-500 dark:text-gray-400 truncate">{regel.label}</dt>
            <dd className="text-xs text-gray-700 dark:text-gray-200 tabular-nums whitespace-nowrap">
              {formatEuro(regel.bedrag)}
            </dd>
          </div>
        ))}
      </dl>
    )}
  </div>
);

export default RegelKaart;
