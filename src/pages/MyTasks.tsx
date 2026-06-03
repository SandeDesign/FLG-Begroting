import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ListChecks, CalendarDays } from 'lucide-react';
import EmployeeTasks from './EmployeeTasks';
import EmployeeAgenda from './EmployeeAgenda';

// Samengevoegde pagina "Mijn Taken" met een subtiele tab tussen de takenlijst en
// de week-agenda. Gebruikt voor zowel medewerker als manager.
const MyTasks: React.FC = () => {
  const location = useLocation();
  const [tab, setTab] = useState<'list' | 'agenda'>(
    location.pathname.endsWith('/agenda') ? 'agenda' : 'list'
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mijn Taken</h1>
        {/* Subtiele segment-tab */}
        <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
          <button
            onClick={() => setTab('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'list'
                ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <ListChecks className="h-4 w-4" />
            Taken
          </button>
          <button
            onClick={() => setTab('agenda')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'agenda'
                ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            Agenda
          </button>
        </div>
      </div>

      {tab === 'list' ? <EmployeeTasks embedded /> : <EmployeeAgenda embedded />}
    </div>
  );
};

export default MyTasks;
