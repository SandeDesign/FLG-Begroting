import React from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';
import Card from '../ui/Card';
import { LeaveBalance } from '../../types';
import { getDaysUntilExpiry, shouldWarnAboutExpiry } from '../../utils/leaveCalculations';

interface LeaveBalanceCardProps {
  balance: LeaveBalance;
  onRequestLeave?: () => void;
}

const LeaveBalanceCard: React.FC<LeaveBalanceCardProps> = ({ balance, onRequestLeave }) => {
  const { holidayDays, advDays, seniorDays, snipperDays } = balance;
  const expiryDate = holidayDays.expires ? new Date(holidayDays.expires) : null;
  const isValidExpiry = expiryDate && !isNaN(expiryDate.getTime());
  const daysUntilExpiry = isValidExpiry ? getDaysUntilExpiry(expiryDate) : 0;
  const showExpiryWarning = isValidExpiry ? shouldWarnAboutExpiry(expiryDate) : false;

  const totalRemaining = holidayDays.remaining + (advDays?.remaining || 0) + seniorDays + snipperDays;

  const calculatePercentage = (used: number, total: number) => {
    if (total === 0) return 0;
    return (used / total) * 100;
  };

  const holidayTotal = holidayDays.statutory + holidayDays.extraStatutory + holidayDays.carried;
  const holidayUsed = holidayDays.taken + holidayDays.pending;
  const holidayPercentage = calculatePercentage(holidayUsed, holidayTotal);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <Calendar className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Verlof Saldo
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Jaar {balance.year}
            </p>
          </div>
        </div>
        {onRequestLeave && (
          <button
            onClick={onRequestLeave}
            className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            Aanvragen
          </button>
        )}
      </div>

      {showExpiryWarning && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-gray-700 border border-red-200 dark:border-red-700 rounded-lg flex items-start space-x-2">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Dagen vervallen binnenkort
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
              {holidayDays.carried} dagen vervallen over {daysUntilExpiry} dagen
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Vakantiedagen
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {holidayDays.remaining} / {holidayTotal}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(holidayPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-600 dark:text-gray-300">
            <span>Opgenomen: {holidayDays.taken}</span>
            <span>Aangevraagd: {holidayDays.pending}</span>
          </div>
        </div>

        {advDays && advDays.entitled > 0 && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                ADV Dagen
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {advDays.remaining} / {advDays.entitled}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${calculatePercentage(advDays.taken, advDays.entitled)}%` }}
              />
            </div>
          </div>
        )}

        {(seniorDays > 0 || snipperDays > 0) && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between text-sm">
              {seniorDays > 0 && (
                <div>
                  <span className="text-gray-600 dark:text-gray-300">Seniorendagen: </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{seniorDays}</span>
                </div>
              )}
              {snipperDays > 0 && (
                <div>
                  <span className="text-gray-600 dark:text-gray-300">Snipperdagen: </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{snipperDays}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Totaal Resterend
            </span>
            <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {totalRemaining}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default LeaveBalanceCard;