import React, { useEffect, useState, useCallback } from 'react';
import { Receipt, Plus, Filter, Building2, Send } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import ExpenseModal from '../components/expense/ExpenseModal';
import { Expense, Employee } from '../types';
import * as firebaseService from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { formatExpenseType } from '../utils/leaveCalculations';
import { useApp } from '../contexts/AppContext';

const Expenses: React.FC = () => {
  usePageTitle('Declaraties');
  const { user, currentEmployeeId, adminUserId } = useAuth();
  const { selectedCompany, companies, queryUserId } = useApp();
  const effectiveUserId = queryUserId || adminUserId;
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  const employerCompany = currentEmployee?.companyId
    ? companies.find(c => c.id === currentEmployee.companyId)
    : null;

  const loadExpenses = useCallback(async () => {
    if (!user || !effectiveUserId || !currentEmployeeId || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const employee = await firebaseService.getEmployeeById(currentEmployeeId);
      if (!employee) {
        showError('Fout', 'Werknemergegevens niet gevonden.');
        setLoading(false);
        return;
      }
      setCurrentEmployee(employee);

      const data = await firebaseService.getExpenses(effectiveUserId, currentEmployeeId);
      setExpenses(data);
    } catch (err) {
      console.error('Error loading expenses:', err);
      showError('Fout bij laden', 'Kan declaraties niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, effectiveUserId, currentEmployeeId, selectedCompany, showError]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      case 'submitted':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'paid':
        return 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      draft: 'Concept',
      submitted: 'Ingediend',
      approved: 'Goedgekeurd',
      rejected: 'Afgewezen',
      paid: 'Uitbetaald',
    };
    return statusMap[status] || status;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleSubmitExpense = async (expense: Expense) => {
    if (!effectiveUserId || !user) return;

    if (!expense.id) {
      showError('Fout', 'Declaratie ID ontbreekt');
      return;
    }

    if (window.confirm('Weet je zeker dat je deze declaratie wilt indienen ter goedkeuring? Je kunt deze daarna niet meer bewerken.')) {
      setSubmittingId(expense.id);
      try {
        await firebaseService.submitExpense(
          expense.id,
          effectiveUserId,
          user.displayName || user.email || 'Werknemer'
        );
        success('Declaratie ingediend', 'Je declaratie is ingediend ter goedkeuring');
        await loadExpenses();
      } catch (err) {
        console.error('Error submitting expense:', err);
        showError('Fout bij indienen', 'Kon declaratie niet indienen');
      } finally {
        setSubmittingId(null);
      }
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    if (filterStatus === 'all') return true;
    return expense.status === filterStatus;
  });

  const totalByStatus = {
    draft: expenses.filter(e => e.status === 'draft').reduce((sum, e) => sum + e.amount, 0),
    submitted: expenses.filter(e => e.status === 'submitted').reduce((sum, e) => sum + e.amount, 0),
    approved: expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0),
    paid: expenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0),
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!currentEmployeeId) {
    return (
      <EmptyState
        icon={Building2}
        title="Geen werknemer geselecteerd"
        description="Selecteer een werknemer om declaraties te beheren."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Declaraties</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Beheer je onkostendeclaraties{employerCompany ? ` via ${employerCompany.name}` : ''}
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nieuwe Declaratie
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Concept</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(totalByStatus.draft)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Ingediend</p>
          <p className="text-2xl font-bold text-yellow-600">
            {formatCurrency(totalByStatus.submitted)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Goedgekeurd</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(totalByStatus.approved)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Uitbetaald</p>
          <p className="text-2xl font-bold text-primary-600">
            {formatCurrency(totalByStatus.paid)}
          </p>
        </Card>
      </div>

      {/* Filter bar for mobile */}
      <div className="md:hidden flex items-center space-x-2">
        <Filter className="h-4 w-4 text-gray-500 dark:text-gray-300" />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="all">Alle statussen</option>
          <option value="draft">Concept</option>
          <option value="submitted">Ingediend</option>
          <option value="approved">Goedgekeurd</option>
          <option value="paid">Uitbetaald</option>
        </select>
      </div>

      <Card className="hidden md:block">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Mijn Declaraties
            </h2>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500 dark:text-gray-300" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">Alle statussen</option>
                <option value="draft">Concept</option>
                <option value="submitted">Ingediend</option>
                <option value="approved">Goedgekeurd</option>
                <option value="paid">Uitbetaald</option>
              </select>
            </div>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Geen declaraties"
            description="Je hebt nog geen declaraties ingediend"
            actionLabel="Nieuwe Declaratie"
            onAction={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Datum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Beschrijving
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Bedrag
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 dark:bg-gray-900">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {new Date(expense.date).toLocaleDateString('nl-NL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatExpenseType(expense.type)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {expense.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(expense.status)}`}>
                        {getStatusText(expense.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {expense.status === 'draft' && expense.id && (
                        <Button
                          size="sm"
                          onClick={() => handleSubmitExpense(expense)}
                          loading={submittingId === expense.id}
                          disabled={submittingId !== null}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Indienen
                        </Button>
                      )}
                      {expense.status !== 'draft' && (
                        <span className="text-gray-400 dark:text-gray-500 text-xs">
                          {expense.status === 'submitted' ? 'In behandeling' :
                           expense.status === 'approved' ? 'Goedgekeurd' :
                           expense.status === 'rejected' ? 'Afgewezen' :
                           expense.status === 'paid' ? 'Uitbetaald' : '-'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {filteredExpenses.length === 0 ? (
          <Card>
            <EmptyState
              icon={Receipt}
              title="Geen declaraties"
              description="Je hebt nog geen declaraties ingediend"
              actionLabel="Nieuwe Declaratie"
              onAction={() => setIsModalOpen(true)}
            />
          </Card>
        ) : (
          filteredExpenses.map((expense) => (
            <Card key={expense.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-gray-500 dark:text-gray-300">
                      {new Date(expense.date).toLocaleDateString('nl-NL')}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(expense.status)}`}>
                      {getStatusText(expense.status)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatExpenseType(expense.type)}
                  </p>
                  {expense.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 truncate">
                      {expense.description}
                    </p>
                  )}
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-2">
                    {formatCurrency(expense.amount)}
                  </p>
                </div>
                <div className="ml-2 flex-shrink-0">
                  {expense.status === 'draft' && expense.id && (
                    <Button
                      size="sm"
                      onClick={() => handleSubmitExpense(expense)}
                      loading={submittingId === expense.id}
                      disabled={submittingId !== null}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Indienen
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadExpenses}
        employeeId={currentEmployeeId || ''}
      />
    </div>
  );
};

export default Expenses;