import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { getWeeklyTimesheets } from '../../services/timesheetService';
import { WeeklyTimesheet } from '../../types/timesheet';
import {
  checkWeekComplete,
  isWeekDeadlinePassed,
  getCurrentWeek,
} from '../../utils/timesheetCompliance';

interface OpenWeek {
  timesheet: WeeklyTimesheet | null;
  week: number;
  year: number;
  missing: Date[];
  overdue: boolean;
}

/**
 * Banner voor werknemers/managers die een week niet compleet hebben
 * ingediend. Toont:
 *  - Rood bij "overdue" (vrijdag 17:00 deadline voorbij)
 *  - Amber bij nog-niet-overdue lopende week
 * Klik → naar urenregistratie.
 */
const IncompleteWeekBanner: React.FC<{ targetRoute?: string }> = ({ targetRoute = '/timesheets' }) => {
  const { user, userRole, currentEmployeeId } = useAuth();
  const { selectedCompany } = useApp();
  const navigate = useNavigate();
  const [openWeeks, setOpenWeeks] = useState<OpenWeek[]>([]);

  // Alleen relevant voor werknemers zelf — niet voor admin/co-admin die
  // andermans uren beheren.
  const selfService = userRole === 'employee' || userRole === 'manager';

  useEffect(() => {
    if (!user || !selfService || !currentEmployeeId || !selectedCompany) {
      setOpenWeeks([]);
      return;
    }
    const load = async () => {
      try {
        // Haal alle weken op en pak de laatste 3 (huidige + 2 voorgaande)
        // voor deze werknemer onder z'n admin.
        const employee = selectedCompany; // fallback lookup via employee doc
        // adminUserId = owner van selectedCompany (bij employees is dat de
        // admin van het bedrijf); via getWeeklyTimesheets(userId, employeeId).
        const adminUid = selectedCompany.userId;
        const all = await getWeeklyTimesheets(adminUid, currentEmployeeId);

        const now = new Date();
        const current = getCurrentWeek(now);
        // Check huidige en 2 voorgaande weken
        const targets = [
          { week: current.week - 2, year: current.year },
          { week: current.week - 1, year: current.year },
          { week: current.week, year: current.year },
        ].map((w) => (w.week < 1 ? { week: 52 + w.week, year: w.year - 1 } : w));

        const openList: OpenWeek[] = [];
        targets.forEach(({ week, year }) => {
          const ts = all.find((t) => t.weekNumber === week && t.year === year) || null;
          if (ts && (ts.status === 'approved' || ts.status === 'processed' || ts.status === 'submitted')) {
            return; // al ingediend/afgehandeld — geen probleem
          }
          const gap = checkWeekComplete(ts);
          if (gap.isComplete) return;
          // Niets daadwerkelijk open → geen banner (voorkomt "nog 0 dagen open").
          if (gap.missingDates.length === 0) return;

          const overdue = isWeekDeadlinePassed(week, year, now);
          const isCurrentWeek = week === current.week && year === current.year;
          // De lopende week pas tonen op vrijdag (deadline-dag) of zodra de
          // deadline gepasseerd is. Oudere weken (overdue) blijven zichtbaar.
          if (isCurrentWeek && !overdue && now.getDay() !== 5) return;

          openList.push({
            timesheet: ts,
            week,
            year,
            missing: gap.missingDates,
            overdue,
          });
        });
        setOpenWeeks(openList);
        // voorkom unused-warning
        void employee;
      } catch (err) {
        console.warn('[IncompleteWeekBanner] load error:', err);
      }
    };
    load();
  }, [user, selfService, currentEmployeeId, selectedCompany]);

  if (!selfService || openWeeks.length === 0) return null;

  const hasOverdue = openWeeks.some((w) => w.overdue);
  const mostUrgent = openWeeks.find((w) => w.overdue) || openWeeks[0];

  const base = hasOverdue
    ? 'from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-red-300 dark:border-red-700'
    : 'from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border-amber-300 dark:border-amber-700';

  const iconColor = hasOverdue ? 'bg-red-600 text-white' : 'bg-amber-500 text-white';
  const textColor = hasOverdue ? 'text-red-900 dark:text-red-200' : 'text-amber-900 dark:text-amber-200';
  const subColor = hasOverdue ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300';

  const Icon = hasOverdue ? AlertTriangle : Clock;

  const missingCount = mostUrgent.missing.length;
  const dagen = mostUrgent.missing
    .map((d) => new Date(d).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric' }))
    .join(', ');

  return (
    <button
      onClick={() => navigate(targetRoute)}
      className={`w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${base} border hover:opacity-90 transition-opacity text-left`}
    >
      <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconColor}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${textColor}`}>
          {hasOverdue
            ? `Week ${mostUrgent.week} is te laat — vrijdag 17:00 deadline gepasseerd`
            : `Week ${mostUrgent.week}: nog ${missingCount} dag${missingCount === 1 ? '' : 'en'} open`}
        </p>
        <p className={`text-xs ${subColor} truncate`}>
          Ontbreekt: {dagen}. Geef per werkdag aan: gewerkt / verlof / ziek / afwezig.
          {openWeeks.length > 1 && ` (+${openWeeks.length - 1} andere open week${openWeeks.length > 2 ? 'en' : ''})`}
        </p>
      </div>
      <ArrowRight className={`h-5 w-5 ${textColor} flex-shrink-0`} />
    </button>
  );
};

export default IncompleteWeekBanner;
