import React, { useEffect, useState } from 'react';
import { Target, Users, Clock, User, Mail, Phone } from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Employee, TimeEntry } from '../types';
import * as firebaseService from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { usePageTitle } from '../contexts/PageTitleContext';

const ProjectTeam: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { selectedCompany } = useApp();
  const { error: showError } = useToast();
  usePageTitle('Project Team');
  const [loading, setLoading] = useState(true);
  const [projectEmployees, setProjectEmployees] = useState<Employee[]>([]);
  const [recentTimeEntries, setRecentTimeEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    loadProjectTeam();
  }, [selectedCompany]);

  const loadProjectTeam = async () => {
    if (!user || !adminUserId || !selectedCompany || selectedCompany.companyType !== 'project') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get employees assigned to this project company
      const employees = await firebaseService.getEmployeesForProjectCompany(
        adminUserId, 
        selectedCompany.id
      );
      setProjectEmployees(employees);

      // Get recent time entries for this project
      const entries = await firebaseService.getTimeEntries(adminUserId);
      const projectEntries = entries.filter(entry => 
        entry.workCompanyId === selectedCompany.id
      ).slice(0, 10); // Last 10 entries
      setRecentTimeEntries(projectEntries);

    } catch (error) {
      console.error('Error loading project team:', error);
      showError('Error', 'Kon projectteam niet laden');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!selectedCompany || selectedCompany.companyType !== 'project') {
    return (
      <EmptyState
        icon={Target}
        title="Geen project geselecteerd"
        description="Selecteer een project bedrijf om het team te bekijken"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Project Team</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Team voor project: <span className="font-medium">{selectedCompany.name}</span>
          </p>
        </div>
        
        <div className="flex items-center space-x-2 px-3 py-1 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium">
          <Target className="h-4 w-4" />
          <span>Project</span>
        </div>
      </div>

      {/* Project Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Users className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Team Leden</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{projectEmployees.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Deze Week</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {recentTimeEntries
                  .filter(entry => {
                    const entryDate = new Date(entry.date);
                    const weekStart = new Date();
                    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                    return entryDate >= weekStart;
                  })
                  .reduce((sum, entry) => sum + entry.regularHours + entry.overtimeHours, 0)
                  .toFixed(1)}h
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Actieve Project</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                {selectedCompany.name}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Team Members */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Toegewezen Teamleden</h2>
        </div>

        {projectEmployees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Geen teamleden toegewezen"
            description="Er zijn nog geen werknemers toegewezen aan dit project"
          />
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {projectEmployees.map((employee) => (
              <div key={employee.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {employee.personalInfo.firstName} {employee.personalInfo.lastName}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-300">{employee.contractInfo.position}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-300">
                    <div className="flex items-center space-x-1">
                      <Mail className="h-4 w-4" />
                      <span>{employee.personalInfo.contactInfo.email}</span>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <Phone className="h-4 w-4" />
                      <span>{employee.personalInfo.contactInfo.phone}</span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>
                        {recentTimeEntries
                          .filter(entry => entry.employeeId === employee.id)
                          .reduce((sum, entry) => sum + entry.regularHours + entry.overtimeHours, 0)
                          .toFixed(1)}h deze maand
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recente Projectactiviteit</h2>
        </div>

        {recentTimeEntries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Geen recente activiteit"
            description="Er zijn nog geen uren geregistreerd voor dit project"
          />
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentTimeEntries.map((entry) => {
              const employee = projectEmployees.find(emp => emp.id === entry.employeeId);
              return (
                <div key={entry.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {employee ? 
                          `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}` : 
                          'Onbekende werknemer'
                        }
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-300">
                        {new Date(entry.date).toLocaleDateString('nl-NL')} - {entry.project || 'Algemeen werk'}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {(entry.regularHours + entry.overtimeHours).toFixed(1)}h
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-300">
                        {entry.regularHours}h normaal
                        {entry.overtimeHours > 0 && ` + ${entry.overtimeHours}h overwerk`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ProjectTeam;