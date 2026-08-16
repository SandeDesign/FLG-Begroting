// src/components/ui/EntiteitSelector.tsx
// Keuzelijst om te wisselen van entiteit. Inactieve entiteiten worden getoond
// maar als zodanig gemarkeerd — Smart Transport bestaat nog niet echt.

import React from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

interface EntiteitSelectorProps {
  label?: string;
  className?: string;
}

const EntiteitSelector: React.FC<EntiteitSelectorProps> = ({
  label = 'Entiteit',
  className = '',
}) => {
  const { entiteiten, geselecteerdeEntiteit, setGeselecteerdeEntiteit } = useApp();

  if (entiteiten.length === 0) return null;

  const wissel = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const gekozen = entiteiten.find((entiteit) => entiteit.id === event.target.value);
    setGeselecteerdeEntiteit(gekozen ?? null);
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-800"
          style={{ backgroundColor: geselecteerdeEntiteit?.kleur ?? '#a89d8f' }}
          aria-hidden
        />
        <select
          value={geselecteerdeEntiteit?.id ?? ''}
          onChange={wissel}
          className="w-full pl-8 pr-9 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none"
        >
          <option value="">Kies een entiteit…</option>
          {entiteiten.map((entiteit) => (
            <option key={entiteit.id} value={entiteit.id}>
              {entiteit.naam}
              {entiteit.actief ? '' : ' (inactief)'}
            </option>
          ))}
        </select>
        <ChevronDown
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none"
          aria-hidden
        />
      </div>

      {geselecteerdeEntiteit && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <Building2 className="h-3 w-3" aria-hidden />
          <span>{geselecteerdeEntiteit.naam}</span>
          {geselecteerdeEntiteit.heeftPersoneel && (
            <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded">
              Heeft personeel
            </span>
          )}
          {!geselecteerdeEntiteit.actief && (
            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
              Inactief
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default EntiteitSelector;
