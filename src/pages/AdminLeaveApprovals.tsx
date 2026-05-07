import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Check, X, User, Building2, ChevronDown, Clock, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { LeaveRequest } from '../types';
import * as firebaseService from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { formatLeaveType } from '../utils/leaveCalculations';
import { usePageTitle } from '../contexts/PageTitleContext';

const AdminLeaveApprovals: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { companies, employees, selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('Verlof Goedkeuren');
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadPendingRequests = useCallback(async () => {
    if (!user || !adminUserId || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const allLeaveRequests = await firebaseService.getLeaveRequests(adminUserId);
      const pending = allLeaveRequests.filter(request => 
        request.status === 'pending' && request.companyId === selectedCompany.id
      );
      setPendingRequests(pending);
    } catch (err) {
      console.error('Error loading pending requests:', err);
      showError('Fout bij laden', 'Kon verlofaanvragen niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, adminUserId, selectedCompany, showError]);

  useEffect(() => {
    loadPendingRequests();
  }, [loadPendingRequests]);

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee 
      ? `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
      : 'Onbekende werknemer';
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Onbekend bedrijf';
  };

  const formatDate = (dateInput: string | Date) => {
    try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(date.getTime())) return 'Ongeldig';
      return date.toLocaleDateString('nl-NL', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
    } catch {
      return 'Ongeldig';
    }
  };

  const handleApprove = async (request: LeaveRequest) => {
    if (!user || !adminUserId) return;
    setProcessingId(request.id);
    try {
      await firebaseService.approveLeaveRequest(
        request.id,
        adminUserId,
        user.displayName || user.email || 'Admin'
      );
      success('Verlof goedgekeurd', `Verlofaanvraag van ${getEmployeeName(request.employeeId)} is goedgekeurd`);
      await loadPendingRequests();
    } catch (err) {
      console.error('Error approving request:', err);
      showError('Fout bij goedkeuren', 'Kon verlofaanvraag niet goedkeuren');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: LeaveRequest) => {
    if (!user || !adminUserId) return;
    const reason = prompt('Reden voor afwijzing (optioneel):');
    if (reason === null) return;
    setProcessingId(request.id);
    try {
      await firebaseService.rejectLeaveRequest(
        request.id,
        adminUserId,
        user.displayName || user.email || 'Admin',
        reason || 'Geen reden opgegeven'
      );
      success('Verlof afgewezen', `Verlofaanvraag van ${getEmployeeName(request.employeeId)} is afgewezen`);
      await loadPendingRequests();
    } catch (err) {
      console.error('Error rejecting request:', err);
      showError('Fout bij afwijzen', 'Kon verlofaanvraag niet afwijzen');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = pendingRequests.filter(request => {
    if (filterCompany === 'all') return true;
    return request.companyId === filterCompany;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een bedrijf om verlofaanvragen te beheren."
      />
    );
  }

  return (
    <div className="space-y-5 px-4 sm:px-0 pb-6">
      {/* Header with Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="hidden lg:block">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Verlof Goedkeuren</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{filteredRequests.length} aanvraag{filteredRequests.length !== 1 ? 'en' : ''} wachten</p>
        </div>
        <select
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
          className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium hover:border-gray-400 transition-colors"
        >
          <option value="all">Alle bedrijven</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-50 dark:from-orange-900/20 to-amber-50 dark:to-amber-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-orange-700 dark:text-orange-300">Te Behandelen</p>
              <p className="text-3xl font-bold text-orange-900 dark:text-orange-100 mt-1">{pendingRequests.length}</p>
            </div>
            <Clock className="h-10 w-10 text-orange-300 dark:text-orange-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 dark:from-blue-900/20 to-indigo-50 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Werknemers</p>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">{employees.length}</p>
            </div>
            <User className="h-10 w-10 text-blue-300 dark:text-blue-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 dark:from-green-900/20 to-emerald-50 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-700 dark:text-green-300">Bedrijven</p>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100 mt-1">{companies.length}</p>
            </div>
            <Building2 className="h-10 w-10 text-green-300 dark:text-green-600" />
          </div>
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full">
              <Calendar className="h-6 w-6 text-gray-400 dark:text-gray-500" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Geen openstaande aanvragen</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">Alle verlofaanvragen zijn afgehandeld!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const isExpanded = expandedId === request.id;
            const isProcessing = processingId === request.id;
            
            return (
              <div
                key={request.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:shadow-md transition-all"
              >
                {/* Main Row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : request.id)}
                  className="w-full"
                >
                  <div className="p-4 sm:p-5 flex items-center gap-4 hover:bg-gray-50 dark:bg-gray-900 transition-colors">
                    {/* Status Icon */}
                    <div className="p-3 bg-gradient-to-br from-orange-100 dark:from-orange-900/30 to-amber-100 dark:to-amber-900/30 rounded-lg flex-shrink-0">
                      <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>

                    {/* Info - Desktop & Mobile */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
                          {getEmployeeName(request.employeeId)}
                        </h3>
                        <span className="px-2.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium rounded-full">
                          {request.totalDays}d
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                        <span className="font-medium">{formatLeaveType(request.type)}</span>
                        <span className="hidden sm:inline text-gray-400 dark:text-gray-500">•</span>
                        <span>{formatDate(request.startDate)} → {formatDate(request.endDate)}</span>
                      </div>
                    </div>

                    {/* Chevron */}
                    <ChevronDown className={`h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 dark:from-gray-900/20 to-white dark:to-gray-800 p-4 sm:p-5 space-y-4">
                    {/* Company & Type */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Bedrijf</p>
                        <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                          <Building2 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                          {getCompanyName(request.companyId)}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Type Verlof</p>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatLeaveType(request.type)}
                        </div>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-200">Startdatum:</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatDate(request.startDate)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-200">Einddatum:</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatDate(request.endDate)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-200">Totaal:</span>
                        <span className="text-base font-bold text-orange-600 dark:text-orange-400">{request.totalDays} dagen</span>
                      </div>
                    </div>

                    {/* Reason */}
                    {request.reason && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1.5">Reden</p>
                        <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">{request.reason}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleApprove(request)}
                        disabled={isProcessing || processingId !== null}
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        icon={Check}
                      >
                        {isProcessing ? 'Verwerken...' : 'Goedkeuren'}
                      </Button>
                      <Button
                        onClick={() => handleReject(request)}
                        disabled={isProcessing || processingId !== null}
                        variant="danger"
                        size="sm"
                        className="flex-1"
                        icon={X}
                      >
                        {isProcessing ? 'Verwerken...' : 'Afwijzen'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminLeaveApprovals;