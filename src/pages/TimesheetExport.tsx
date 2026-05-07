import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Calendar,
  Building2,
  Users,
  FileText,
  Filter,
  Clock,
  Euro,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { usePageTitle } from '../contexts/PageTitleContext';

interface ExportPeriod {
  id: string;
  userId: string;
  companyId: string;
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'exported' | 'processed';
  employeeCount: number;
  totalHours: number;
  totalAmount: number;
  exportedAt?: Date;
  exportedBy?: string;
  fileName?: string;
  fileUrl?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ExportData {
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    bsn: string;
  };
  company: {
    name: string;
    companyType: string;
  };
  timeEntries: {
    date: Date;
    regularHours: number;
    overtimeHours: number;
    irregularHours: number;
    description?: string;
    workCompanyId?: string;
    workCompanyName?: string;
  }[];
  totals: {
    regularHours: number;
    overtimeHours: number;
    irregularHours: number;
    totalHours: number;
  };
}

const TimesheetExport: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('Uren Export');
  const [exportPeriods, setExportPeriods] = useState<ExportPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  });
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('excel');

  const loadExportPeriods = useCallback(async () => {
    if (!user || !adminUserId || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // TODO: Implement firebase service call
      // const periodsData = await getExportPeriods(adminUserId, selectedCompany.id);
      // setExportPeriods(periodsData);
      
      // Mock data for now
      const mockPeriods: ExportPeriod[] = [
        {
          id: '1',
          userId: adminUserId,
          companyId: selectedCompany.id,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          status: 'exported',
          employeeCount: 12,
          totalHours: 1920,
          totalAmount: 48000,
          exportedAt: new Date('2024-02-01'),
          exportedBy: adminUserId,
          fileName: 'uren-export-januari-2024.xlsx',
          fileUrl: '/exports/uren-export-januari-2024.xlsx',
          notes: 'Export voor loonadministratie januari 2024',
          createdAt: new Date('2024-02-01'),
          updatedAt: new Date('2024-02-01')
        }
      ];
      setExportPeriods(mockPeriods);
    } catch (error) {
      console.error('Error loading export periods:', error);
      showError('Fout bij laden', 'Kon export geschiedenis niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, showError]);

  useEffect(() => {
    loadExportPeriods();
  }, [loadExportPeriods]);

  const generateExport = async () => {
    if (!selectedCompany || !selectedPeriod.startDate || !selectedPeriod.endDate) {
      showError('Onvolledige gegevens', 'Selecteer een periode om te exporteren');
      return;
    }

    setExporting(true);
    try {
      // TODO: Implement export generation
      const startDate = new Date(selectedPeriod.startDate);
      const endDate = new Date(selectedPeriod.endDate);
      
      // Mock export data
      const exportData: ExportData[] = [
        {
          employee: {
            firstName: 'Jan',
            lastName: 'Jansen',
            employeeNumber: 'EMP001',
            bsn: '123456789'
          },
          company: {
            name: selectedCompany.name,
            companyType: selectedCompany.companyType || 'payroll_company'
          },
          timeEntries: [
            {
              date: new Date('2024-01-02'),
              regularHours: 8,
              overtimeHours: 0,
              irregularHours: 0,
              description: 'Reguliere werkdag',
              workCompanyId: 'company123',
              workCompanyName: 'Project Alpha B.V.'
            }
          ],
          totals: {
            regularHours: 160,
            overtimeHours: 8,
            irregularHours: 4,
            totalHours: 172
          }
        }
      ];

      // Generate file (mock)
      const fileName = `uren-export-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.${exportFormat === 'excel' ? 'xlsx' : 'csv'}`;
      
      success('Export gegenereerd', `Het bestand ${fileName} is klaar voor download`);
      loadExportPeriods();
    } catch (error) {
      showError('Fout bij exporteren', 'Kon export niet genereren');
    } finally {
      setExporting(false);
    }
  };

  const downloadExport = async (period: ExportPeriod) => {
    try {
      // TODO: Implement download functionality
      success('Download gestart', 'Het bestand wordt gedownload');
    } catch (error) {
      showError('Fout bij downloaden', 'Kon bestand niet downloaden');
    }
  };

  const getStatusColor = (status: ExportPeriod['status']) => {
    switch (status) {
      case 'pending': return 'text-orange-600 bg-orange-100';
      case 'exported': return 'text-green-600 bg-green-100';
      case 'processed': return 'text-primary-600 bg-primary-100';
      default: return 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800';
    }
  };

  const getStatusIcon = (status: ExportPeriod['status']) => {
    switch (status) {
      case 'pending': return Clock;
      case 'exported': return CheckCircle;
      case 'processed': return CheckCircle;
      default: return Clock;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een bedrijf om uren te exporteren"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Uren Export</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
          Exporteer urenregistraties naar loonadministratie voor {selectedCompany.name}
        </p>
      </div>

      {/* Export Generator */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Nieuwe Export Genereren</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Startdatum
              </label>
              <input
                type="date"
                value={selectedPeriod.startDate}
                onChange={(e) => setSelectedPeriod(prev => ({...prev, startDate: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Einddatum
              </label>
              <input
                type="date"
                value={selectedPeriod.endDate}
                onChange={(e) => setSelectedPeriod(prev => ({...prev, endDate: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Formaat
              </label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'csv' | 'excel')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="excel">Excel (.xlsx)</option>
                <option value="csv">CSV (.csv)</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <Button
                onClick={generateExport}
                disabled={exporting}
                icon={exporting ? Clock : Download}
                className="w-full"
              >
                {exporting ? 'Exporteren...' : 'Genereer Export'}
              </Button>
            </div>
          </div>

          <div className="mt-4 p-4 bg-primary-50 rounded-lg">
            <h3 className="text-sm font-medium text-primary-900 mb-2">Export bevat:</h3>
            <ul className="text-sm text-primary-800 space-y-1">
              <li>• Werknemersgegevens (naam, BSN, personeelsnummer)</li>
              <li>• Urenregistraties per dag (regulier, overwerk, onregelmatig)</li>
              <li>• Werkmaatschappij toewijzing per uur</li>
              <li>• Totaaloverzicht per werknemer</li>
              <li>• Compatibel met standaard loonadministratie systemen</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Export History */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Export Geschiedenis</h2>
          
          {exportPeriods.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Geen exports gevonden"
              description="Genereer je eerste export om de geschiedenis te zien"
            />
          ) : (
            <div className="space-y-4">
              {exportPeriods.map((period) => {
                const StatusIcon = getStatusIcon(period.status);
                return (
                  <div key={period.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <FileText className="h-5 w-5 text-green-600" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {period.startDate.toLocaleDateString('nl-NL')} - {period.endDate.toLocaleDateString('nl-NL')}
                            </h3>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(period.status)}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {period.status === 'pending' && 'In behandeling'}
                              {period.status === 'exported' && 'Geëxporteerd'}
                              {period.status === 'processed' && 'Verwerkt'}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-300">
                            <div className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              {period.employeeCount} werknemers
                            </div>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {period.totalHours} uren
                            </div>
                            <div className="flex items-center">
                              <Euro className="h-4 w-4 mr-1" />
                              €{period.totalAmount.toLocaleString('nl-NL')}
                            </div>
                            {period.exportedAt && (
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                {period.exportedAt.toLocaleDateString('nl-NL')}
                              </div>
                            )}
                          </div>
                          {period.notes && (
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{period.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {period.status === 'exported' && period.fileName && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Download}
                            onClick={() => downloadExport(period)}
                          >
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Instructions */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Instructies voor Loonadministratie</h3>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <p>
              <strong>Stap 1:</strong> Selecteer de gewenste periode en genereer de export
            </p>
            <p>
              <strong>Stap 2:</strong> Download het gegenereerde bestand
            </p>
            <p>
              <strong>Stap 3:</strong> Stuur het bestand naar je loonadministratie
            </p>
            <p>
              <strong>Bestandsformaat:</strong> Het Excel bestand bevat aparte tabbladen voor verschillende bedrijven en een overzichtstabblad
            </p>
            <p>
              <strong>Kolommen:</strong> Werknemer, BSN, Datum, Reguliere uren, Overwerk, Onregelmatig, Werkmaatschappij, Beschrijving
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TimesheetExport;