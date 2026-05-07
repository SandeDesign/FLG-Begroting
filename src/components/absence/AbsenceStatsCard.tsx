import React from 'react';
import { Activity, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import Card from '../ui/Card';
import { AbsenceStatistics } from '../../types';

interface AbsenceStatsCardProps {
  stats: AbsenceStatistics;
  previousYearStats?: AbsenceStatistics;
}

const AbsenceStatsCard: React.FC<AbsenceStatsCardProps> = ({ stats, previousYearStats }) => {
  const formatPercentage = (value: number) => {
    if (isNaN(value) || !isFinite(value)) {
      return '0.00%';
    }
    return value.toFixed(2) + '%';
  };

  const getTrendIcon = () => {
    if (!previousYearStats) return null;

    const currentPct = isNaN(stats.absencePercentage) ? 0 : stats.absencePercentage;
    const prevPct = isNaN(previousYearStats.absencePercentage) ? 0 : previousYearStats.absencePercentage;
    const diff = currentPct - prevPct;

    if (diff > 0) {
      return <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400" />;
    } else if (diff < 0) {
      return <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />;
    }
    return null;
  };

  const getTrendColor = () => {
    if (!previousYearStats) return '';

    const currentPct = isNaN(stats.absencePercentage) ? 0 : stats.absencePercentage;
    const prevPct = isNaN(previousYearStats.absencePercentage) ? 0 : previousYearStats.absencePercentage;
    const diff = currentPct - prevPct;

    if (diff > 0) return 'text-red-600 dark:text-red-400';
    if (diff < 0) return 'text-green-600 dark:text-green-400';
    return 'text-gray-600 dark:text-gray-300';
  };

  const getStatusColor = () => {
    const pct = isNaN(stats.absencePercentage) ? 0 : stats.absencePercentage;
    if (pct < 3) return 'text-green-600 dark:text-green-400';
    if (pct < 5) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getStatusText = () => {
    const pct = isNaN(stats.absencePercentage) ? 0 : stats.absencePercentage;
    if (pct < 3) return 'Laag';
    if (pct < 5) return 'Gemiddeld';
    return 'Hoog';
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <Activity className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Verzuim Statistieken
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {new Date(stats.periodStart).getFullYear()}
            </p>
          </div>
        </div>
      </div>

      {(stats.longTermAbsence || stats.chronicAbsence) && (
        <div className="mb-4 p-3 bg-orange-50 dark:bg-gray-700 border border-orange-200 dark:border-orange-700 rounded-lg flex items-start space-x-2">
          <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
              Aandachtspunt
            </p>
            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
              {stats.longTermAbsence && 'Lang verzuim geconstateerd. '}
              {stats.chronicAbsence && 'Frequent verzuim geconstateerd.'}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Verzuimpercentage</p>
            <p className={`text-2xl font-bold ${getStatusColor()}`}>
              {formatPercentage(stats.absencePercentage)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
              Status: {getStatusText()}
            </p>
          </div>
          {previousYearStats && (
            <div className={`flex items-center space-x-1 ${getTrendColor()}`}>
              {getTrendIcon()}
              <span className="text-sm font-medium">
                {(() => {
                  const currentPct = isNaN(stats.absencePercentage) ? 0 : stats.absencePercentage;
                  const prevPct = isNaN(previousYearStats.absencePercentage) ? 0 : previousYearStats.absencePercentage;
                  return Math.abs(currentPct - prevPct).toFixed(2);
                })()}%
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">Totaal Dagen</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {stats.totalSickDays}
            </p>
          </div>

          <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">Frequentie</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {stats.absenceFrequency}x
            </p>
          </div>

          <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg col-span-2">
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">
              Gemiddelde Duur per Keer
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {isNaN(stats.averageDuration) || !isFinite(stats.averageDuration) ? '0.0' : stats.averageDuration.toFixed(1)} dagen
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-300">
            Laatst berekend: {new Date(stats.calculatedAt).toLocaleDateString('nl-NL', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default AbsenceStatsCard;