import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { getQuarterLabel } from '../../utils/dateFilters';

interface PeriodSelectorProps {
  showQuarter?: boolean;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ showQuarter = true }) => {
  const { selectedYear, setSelectedYear, selectedQuarter, setSelectedQuarter } = useApp();

  const quarters: (number | null)[] = [null, 1, 2, 3, 4];

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="flex items-center gap-1">
        <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-300" />
        <button
          onClick={() => setSelectedYear(selectedYear - 1)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[3rem] text-center">
          {selectedYear}
        </span>
        <button
          onClick={() => setSelectedYear(selectedYear + 1)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {showQuarter && (
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {quarters.map((q) => (
            <button
              key={q ?? 'all'}
              onClick={() => setSelectedQuarter(q)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                selectedQuarter === q
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {getQuarterLabel(q)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PeriodSelector;
