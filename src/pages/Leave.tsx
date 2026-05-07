import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Plus, Filter, Building2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import LeaveBalanceCard from '../components/leave/LeaveBalanceCard';
import LeaveRequestModal from '../components/leave/LeaveRequestModal';
import { LeaveRequest, LeaveBalance } from '../types';
import * as firebaseService from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { formatLeaveType } from '../utils/leaveCalculations';
import { useApp } from '../contexts/AppContext';
import { usePageTitle } from '../contexts/PageTitleContext';

const Leave: React.FC = () => {
  const { user, currentEmployeeId, adminUserId } = useAuth();
  const { selectedCompany, queryUserId } = useApp();
  const effectiveUserId = queryUserId || adminUserId;
  const { success, error: showError } = useToast();
  usePageTitle('Verlof');
  const [loading, setLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadLeaveData = useCallback(async () => {
    if (!user || !effectiveUserId || !currentEmployeeId || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const currentYear = new Date().getFullYear();

      const currentEmployee = await firebaseService.getEmployeeById(currentEmployeeId);
      if (!currentEmployee) {
        showError('Fout', 'Werknemergegevens niet gevonden.');
        setLoading(false);
        return;
      }

      const [requests, balance] = await Promise.all([
        firebaseService.getLeaveRequests(effectiveUserId, currentEmployeeId),
        firebaseService.getLeaveBalance(currentEmployeeId, effectiveUserId, currentYear),
      ]);

      setLeaveRequests(requests);
      setLeaveBalance(balance);
    } catch (err) {
      console.error('Error loading leave data:', err);
      showError('Fout bij laden', 'Kan verlofgegevens niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, effectiveUserId, currentEmployeeId, selectedCompany, showError]);

  useEffect(() => {
    loadLeaveData();
  }, [loadLeaveData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'cancelled':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
      default:
        return 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      draft: 'Concept',
      pending: 'In behandeling',
      approved: 'Goedgekeurd',
      rejected: 'Afgewezen',
      cancelled: 'Geannuleerd',
    };
    return statusMap[status] || status;
  };

  const filteredRequests = leaveRequests.filter(request => {
    if (filterStatus === 'all') return true;
    return request.status === filterStatus;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!currentEmployeeId) {
    return (
      <EmptyState
        icon={Building2}
        title="Geen werknemer geselecteerd"
        description="Selecteer een werknemer om verlof te beheren."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Verlof</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Beheer je verlofaanvragen en bekijk je saldo
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Verlof Aanvragen
        </Button>
      </div>

      {leaveBalance && (
        <LeaveBalanceCard balance={leaveBalance} />
      )}

      <Card>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Mijn Verlofaanvragen
            </h2>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500 dark:text-gray-300" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">Alle statussen</option>
                <option value="pending">In behandeling</option>
                <option value="approved">Goedgekeurd</option>
                <option value="rejected">Afgewezen</option>
              </select>
            </div>
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Geen verlofaanvragen"
            description="Je hebt nog geen verlof aangevraagd"
            actionLabel="Verlof Aanvragen"
            onAction={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Periode
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Dagen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Aangevraagd op
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50 dark:bg-gray-900">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatLeaveType(request.type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {request.startDate && request.endDate ? (
                        <>
                          {(request.startDate instanceof Date ? request.startDate : new Date(request.startDate)).toLocaleDateString('nl-NL')} -{' '}
                          {(request.endDate instanceof Date ? request.endDate : new Date(request.endDate)).toLocaleDateString('nl-NL')}
                        </>
                      ) : 'Datum niet beschikbaar'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {request.totalDays || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                        {getStatusText(request.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {request.createdAt ? (request.createdAt instanceof Date ? request.createdAt : new Date(request.createdAt)).toLocaleDateString('nl-NL') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <LeaveRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadLeaveData}
        employeeId={currentEmployeeId || ''}
      />
    </div>
  );
};

export default Leave;