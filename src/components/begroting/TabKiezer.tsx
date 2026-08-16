// src/components/begroting/TabKiezer.tsx
// De tabbladen van het werkblad.
//
// Op een breed scherm staan ze naast elkaar. Op een telefoon paste die rij niet
// en moest je zijwaarts scrollen naar een tabblad dat je niet zag staan — dus
// daar staat er één knop met het huidige tabblad, die de rest uitklapt.

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface TabKeuze<T extends string> {
  id: T;
  naam: string;
  icoon: React.ComponentType<{ className?: string }>;
  /** Getal in een rood bolletje, bijvoorbeeld het aantal fouten. */
  telling?: number;
}

interface TabKiezerProps<T extends string> {
  tabbladen: TabKeuze<T>[];
  actief: T;
  onKies: (id: T) => void;
}

function TabKiezer<T extends string>({ tabbladen, actief, onKies }: TabKiezerProps<T>) {
  const [open, setOpen] = useState(false);
  const wikkel = useRef<HTMLDivElement>(null);

  const huidig = tabbladen.find((tab) => tab.id === actief) ?? tabbladen[0];

  // Buiten het menu tikken sluit het. Zowel muis als aanraking, anders blijft
  // het op een telefoon openstaan.
  useEffect(() => {
    if (!open) return;

    const buiten = (event: Event) => {
      if (wikkel.current && !wikkel.current.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('mousedown', buiten);
    document.addEventListener('touchstart', buiten);
    return () => {
      document.removeEventListener('mousedown', buiten);
      document.removeEventListener('touchstart', buiten);
    };
  }, [open]);

  const kies = (id: T) => {
    onKies(id);
    setOpen(false);
  };

  const Huidig = huidig.icoon;

  return (
    <>
      {/* Telefoon: één knop die uitklapt */}
      <div ref={wikkel} className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((vorig) => !vorig)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-primary-500 text-white font-semibold text-sm shadow-glow-primary"
        >
          <Huidig className="h-4 w-4 flex-shrink-0" aria-hidden />
          <span className="flex-1 text-left truncate">{huidig.naam}</span>
          {tabbladen.some((tab) => (tab.telling ?? 0) > 0 && tab.id !== actief) && (
            <span className="h-2 w-2 rounded-full bg-red-400 flex-shrink-0" aria-hidden />
          )}
          <ChevronDown
            className={`h-4 w-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg py-1.5 max-h-[60vh] overflow-y-auto"
          >
            {tabbladen.map(({ id, naam, icoon: Icoon, telling }) => (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={id === actief}
                onClick={() => kies(id)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-left transition-colors ${
                  id === actief
                    ? 'text-primary-700 dark:text-primary-300 bg-primary-50/60 dark:bg-primary-900/20'
                    : 'text-gray-700 dark:text-gray-200 active:bg-gray-50 dark:active:bg-gray-700/60'
                }`}
              >
                <Icoon className="h-4 w-4 flex-shrink-0" aria-hidden />
                <span className="flex-1 truncate">{naam}</span>
                {(telling ?? 0) > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full flex-shrink-0">
                    {telling}
                  </span>
                )}
                {id === actief && (
                  <Check className="h-4 w-4 flex-shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Breed scherm: gewoon naast elkaar */}
      <div className="hidden sm:flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {tabbladen.map(({ id, naam, icoon: Icoon, telling }) => (
          <button
            key={id}
            type="button"
            onClick={() => onKies(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              id === actief
                ? 'bg-primary-500 text-white shadow-glow-primary'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60'
            }`}
          >
            <Icoon className="h-4 w-4" aria-hidden />
            {naam}
            {(telling ?? 0) > 0 && (
              <span className="ml-0.5 bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">
                {telling}
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}

export default TabKiezer;
