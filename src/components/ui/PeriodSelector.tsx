// src/components/ui/PeriodSelector.tsx
// Jaarkiezer voor de lijstweergaven. Kwartalen bestaan hier niet: een begroting
// heeft een eigen periodeVan en periodeTot per maand.

import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

interface PeriodSelectorProps {
  className?: string;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ className = '' }) => {
  const { geselecteerdJaar, setGeselecteerdJaar } = useApp();

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Calendar className="h-4 w-4 text-primary-600 dark:text-primary-400 mr-1" aria-hidden />
      <button
        type="button"
        onClick={() => setGeselecteerdJaar(geselecteerdJaar - 1)}
        aria-label="Vorig jaar"
        className="h-9 w-9 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[3rem] text-center tabular-nums">
        {geselecteerdJaar}
      </span>
      <button
        type="button"
        onClick={() => setGeselecteerdJaar(geselecteerdJaar + 1)}
        aria-label="Volgend jaar"
        className="h-9 w-9 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
};

export default PeriodSelector;
