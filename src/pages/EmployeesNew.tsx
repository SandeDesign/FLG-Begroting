import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Edit, Trash2, User, Mail, Phone, Building2, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Employee } from '../types';
import { getEmployees, deleteEmployee, createEmployeeAuthAccount, updateEmployee } from '../services/firebase';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import EmployeeModal from '../components/employee/EmployeeModal';
import { useToast } from '../hooks/useToast';
import { usePageTitle } from '../contexts/PageTitleContext';

const DEFAULT_PASSWORD = 'DeInstallatie1234!!';

const EmployeesNew: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { companies, selectedCompany, refreshDashboardStats } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('Werknemers');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [creatingAccount, setCreatingAccount] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    if (!user || !adminUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const employeesData = await getEmployees(adminUserId);

      const filteredEmployees = selectedCompany
        ? employeesData.filter(emp => emp.companyId === selectedCompany.id)
        : employeesData;

      setEmployees(filteredEmployees);
      await refreshDashboardStats();
    } catch (error) {
      console.error('Error loading employees:', error);
      showError('Fout bij laden', 'Kon werknemers niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, adminUserId, selectedCompany, showError, refreshDashboardStats]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setIsModalOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsModalOpen(true);
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!user || !adminUserId) return;

    if (window.confirm(`Weet je zeker dat je ${employee.personalInfo.firstName} ${employee.personalInfo.lastName} wilt verwijderen?`)) {
      try {
        await deleteEmployee(employee.id, adminUserId);
        success('Werknemer verwijderd', `${employee.personalInfo.firstName} ${employee.personalInfo.lastName} is succesvol verwijderd`);
        await loadEmployees();
      } catch (error) {
        console.error('Error deleting employee:', error);
        showError('Fout bij verwijderen', 'Kon werknemer niet verwijderen');
      }
    }
  };

  const handleCreateAccount = async (employee: Employee) => {
    if (!user || !adminUserId) return;

    if (employee.hasAccount) {
      showError('Account bestaat al', `${employee.personalInfo.firstName} heeft al een account`);
      return;
    }

    const confirmMsg = `Weet je zeker dat je een account wilt aanmaken voor ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}?\n\nInloggegevens:\nE-mail: ${employee.personalInfo.contactInfo.email}\nWachtwoord: ${DEFAULT_PASSWORD}`;

    if (window.confirm(confirmMsg)) {
      try {
        setCreatingAccount(employee.id);

        await createEmployeeAuthAccount(
          employee.id,
          adminUserId,
          employee.personalInfo.contactInfo.email,
          DEFAULT_PASSWORD
        );

        success(
          'Account aangemaakt! ✓',
          `${employee.personalInfo.firstName} kan nu inloggen.`
        );
        await loadEmployees();
      } catch (error: any) {
        console.error('Error creating account:', error);
        
        let errorMessage = 'Kon account niet aanmaken';
        if (error.code === 'auth/email-already-in-use') {
          errorMessage = 'Dit e-mailadres is al in gebruik';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'E-mailadres is ongeldig';
        }
        
        showError('Fout bij account aanmaken', errorMessage);
      } finally {
        setCreatingAccount(null);
      }
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedEmployee(null);
  };

  const handleModalSuccess = async () => {
    await loadEmployees();
    handleModalClose();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'inactive':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
      case 'on_leave':
        return 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300';
      case 'sick':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      active: 'Actief',
      inactive: 'Inactief',
      on_leave: 'Met verlof',
      sick: 'Ziek',
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4 md:space-y-6 px-4 md:px-0">
      {/* Header - Mobiel vriendelijk */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="hidden lg:block">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">Werknemers</h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mt-1 md:mt-2">
            Beheer je werknemers en hun gegevens
          </p>
        </div>
        <Button
          onClick={handleAddEmployee}
          disabled={companies.length === 0}
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nieuwe Werknemer
        </Button>
      </div>

      {/* No companies state */}
      {companies.length === 0 ? (
        <Card className="p-6 md:p-8">
          <div className="text-center">
            <Building2 className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Geen bedrijven gevonden
            </h3>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mb-4">
              Je moet eerst een bedrijf aanmaken voordat je werknemers kunt toevoegen.
            </p>
            <Button onClick={() => window.location.href = '/companies'}>
              Bedrijf Toevoegen
            </Button>
          </div>
        </Card>
      ) : employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Geen werknemers gevonden"
          description={`Voeg je eerste werknemer toe voor ${selectedCompany?.name || 'het geselecteerde bedrijf'}`}
          actionLabel="Eerste Werknemer Toevoegen"
          onAction={handleAddEmployee}
        />
      ) : (
        /* Employees Grid - Responsive */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {employees.map((employee) => (
            <Card key={employee.id} className="p-4 md:p-6 hover:shadow-lg transition-shadow flex flex-col h-full">
              {/* Header with name and status */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="p-2 bg-primary-100 rounded-lg flex-shrink-0">
                    <User className="h-5 w-5 md:h-6 md:w-6 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {employee.personalInfo.firstName} {employee.personalInfo.lastName}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 truncate">
                      {employee.contractInfo.position}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 whitespace-nowrap ${getStatusColor(employee.status)}`}>
                  {getStatusText(employee.status)}
                </span>
              </div>

              {/* Contact & Contract Info */}
              <div className="space-y-2 mb-4 text-xs md:text-sm flex-1">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 truncate">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate" title={employee.personalInfo.contactInfo.email}>
                    {employee.personalInfo.contactInfo.email}
                  </span>
                </div>
                
                {employee.personalInfo.contactInfo.phone && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 truncate">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{employee.personalInfo.contactInfo.phone}</span>
                  </div>
                )}
                
                <div className="text-gray-600 dark:text-gray-300">
                  <span className="font-medium">Contract:</span> {employee.contractInfo.type}
                </div>
                
                <div className="text-gray-600 dark:text-gray-300">
                  <span className="font-medium">Uren/week:</span> {employee.contractInfo.hoursPerWeek}
                </div>
              </div>

              {/* Account Status Alert */}
              {!employee.hasAccount && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-gray-700 rounded-lg border border-amber-200 dark:border-gray-600">
                  <div className="flex items-start gap-2 text-xs md:text-sm">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <span className="text-amber-700 dark:text-amber-300">Geen account</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEditEmployee(employee)}
                  className="text-xs md:text-sm"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Bewerken
                </Button>
                
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDeleteEmployee(employee)}
                  className="text-xs md:text-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                {!employee.hasAccount && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreateAccount(employee)}
                    disabled={creatingAccount === employee.id}
                    className="col-span-2 text-xs md:text-sm bg-primary-50 dark:bg-gray-700 border-primary-200 dark:border-gray-600 hover:bg-primary-100 dark:hover:bg-gray-600 text-primary-700 dark:text-primary-300"
                  >
                    <LogIn className="h-4 w-4 mr-1" />
                    {creatingAccount === employee.id ? 'Aanmaken...' : 'Account aanmaken'}
                  </Button>
                )}

                {employee.hasAccount && (
                  <div className="col-span-2 text-xs text-green-600 dark:text-green-400 text-center py-2 px-3 bg-green-50 dark:bg-gray-700 rounded-lg border border-green-200 dark:border-gray-600">
                    ✓ Account actief
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <EmployeeModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        employee={selectedEmployee}
      />
    </div>
  );
};

export default EmployeesNew;