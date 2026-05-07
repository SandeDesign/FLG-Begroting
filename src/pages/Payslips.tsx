import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Calendar, Building2, User, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Payslip } from '../types/payslip';
import { getPayslips, markPayslipAsDownloaded, regeneratePayslipPdf, approvePayslip, markPayslipPaid } from '../services/payslipService';
import { getEmployeeById, getCompany } from '../services/firebase';
import { getPayrollCalculations } from '../services/payrollService';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { usePageTitle } from '../contexts/PageTitleContext';

export default function Payslips() {
  const { user, userRole, adminUserId } = useAuth();
  const { currentEmployeeId, selectedCompany, employees } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('Loonstroken');

  const [loading, setLoading] = useState(true);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    const isSelfService = userRole === 'manager' || userRole === 'employee';
    const effectiveEmployeeId = isSelfService
      ? currentEmployeeId
      : selectedEmployeeId;

    if (!effectiveEmployeeId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const employee = await getEmployeeById(effectiveEmployeeId);
      if (!employee) {
        showError('Fout', 'Werknemergegevens niet gevonden.');
        setLoading(false);
        return;
      }
      setEmployeeData(employee);

      // Voor self-service (manager/employee): payslips staan onder de primary
      // admin's userId (= employee.userId), NIET onder hun eigen adminUserId
      // (die bij managers gelijk is aan manager.uid). Voor admin/co-admin:
      // gebruik adminUserId uit AuthContext zoals gewoonlijk.
      const payrollAdminUserId = isSelfService
        ? employee.userId
        : (adminUserId || employee.userId);

      // Werknemer + manager (self-service) zien alleen goedgekeurde /
      // uitbetaalde loonstroken. Concepten (boekhouder heeft geüpload,
      // admin nog niet goedgekeurd) blijven voor hen verborgen.
      // Admin/co-admin zien alles incl. draft zodat ze kunnen goedkeuren.
      const statusFilter = isSelfService ? ['approved', 'paid'] as const : undefined;
      const allPayslips = await getPayslips(
        payrollAdminUserId,
        effectiveEmployeeId,
        undefined,
        statusFilter as any
      );
      const filtered = allPayslips.filter(
        p => p.periodStartDate.getFullYear() === selectedYear
      );
      setPayslips(filtered.sort((a, b) => b.periodStartDate.getTime() - a.periodStartDate.getTime()));
    } catch (error) {
      console.error('Error loading payslips:', error);
      showError('Fout bij laden', 'Kon loonstroken niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, userRole, adminUserId, currentEmployeeId, selectedEmployeeId, selectedCompany, selectedYear, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getMonthName = (date: Date): string => {
    return date.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
  };

  const handleApprovePayslip = async (payslip: Payslip) => {
    if (!user || !payslip.id) return;
    const defaultDate = payslip.periodEndDate.toISOString().slice(0, 10);
    const input = prompt(
      `Goedkeuren van loonstrook ${getMonthName(payslip.periodStartDate)}.\n\n` +
        'Voer de uitbetaaldatum in (formaat: JJJJ-MM-DD):',
      defaultDate
    );
    if (input === null) return; // geannuleerd
    const parsed = input.trim() ? new Date(input.trim()) : undefined;
    if (parsed && isNaN(parsed.getTime())) {
      showError('Ongeldige datum', 'Gebruik JJJJ-MM-DD zoals 2026-01-15');
      return;
    }
    try {
      setApproving(payslip.id);
      await approvePayslip(payslip.id, user.uid, parsed);
      success('Goedgekeurd', 'Loonstrook is goedgekeurd en nu zichtbaar voor de werknemer.');
      await loadData();
    } catch (err) {
      console.error('[Payslips] approve failed:', err);
      showError('Fout', 'Kon loonstrook niet goedkeuren.');
    } finally {
      setApproving(null);
    }
  };

  const handleMarkPaid = async (payslip: Payslip) => {
    if (!user || !payslip.id) return;
    if (!confirm(`Markeer loonstrook ${getMonthName(payslip.periodStartDate)} als uitbetaald?`)) return;
    try {
      setApproving(payslip.id);
      await markPayslipPaid(payslip.id, user.uid);
      success('Uitbetaald', 'Loonstrook is gemarkeerd als uitbetaald.');
      await loadData();
    } catch (err) {
      console.error('[Payslips] markPaid failed:', err);
      showError('Fout', 'Kon loonstrook niet markeren als uitbetaald.');
    } finally {
      setApproving(null);
    }
  };

  const handleGeneratePdf = async (payslip: Payslip) => {
    if (!employeeData || !user || !selectedCompany) {
      showError('Fout', 'Benodigde gegevens ontbreken voor PDF generatie.');
      return;
    }

    if (!payslip.id) {
      showError('Fout', 'Loonstrook ID ontbreekt.');
      return;
    }

    setGenerating(payslip.id);

    try {
      const company = await getCompany(selectedCompany.id, adminUserId);
      if (!company) {
        throw new Error('Bedrijf niet gevonden');
      }

      const month = payslip.periodStartDate.getMonth() + 1;
      const year = payslip.periodStartDate.getFullYear();

      console.log(`Searching for payroll calculation for employee ${payslip.employeeId}, month: ${month}, year: ${year}`);

      const calculations = await getPayrollCalculations(
        adminUserId,
        payslip.employeeId,
        month,
        year
      );

      console.log(`Found ${calculations.length} calculation(s):`, calculations);

      if (!calculations || calculations.length === 0) {
        showError('Geen salarisberekening', `Er is geen salarisberekening gevonden voor ${getMonthName(payslip.periodStartDate)}. Zorg dat er eerst een salarisberekening is uitgevoerd in Payroll Processing.`);
        return;
      }

      const calculation = calculations[0];

      await regeneratePayslipPdf(
        payslip.id,
        adminUserId,
        employeeData,
        company,
        calculation
      );

      success('PDF gegenereerd', 'Loonstrook PDF is succesvol gegenereerd');
      await loadData();
    } catch (error) {
      console.error('Error generating PDF:', error);
      showError('Fout bij genereren', 'Kon loonstrook PDF niet genereren');
    } finally {
      setGenerating(null);
    }
  };

  const handleDownload = async (payslip: Payslip) => {
    if (!employeeData || !user) {
      showError('Fout', 'Werknemergegevens ontbreken voor download.');
      return;
    }

    if (!payslip.pdfUrl || payslip.pdfUrl.trim() === '') {
      showError('Niet beschikbaar', 'Loonstrook PDF is nog niet beschikbaar');
      return;
    }

    setDownloading(payslip.id || null);

    try {
      const response = await fetch(payslip.pdfUrl);
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `loonstrook-${getMonthName(payslip.periodStartDate)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      if (payslip.id) {
        await markPayslipAsDownloaded(payslip.id, adminUserId);
      }

      success('Loonstrook gedownload', 'Loonstrook succesvol gedownload');
      await loadData();
    } catch (error) {
      console.error('Error downloading payslip:', error);
      showError('Fout bij downloaden', 'Kon loonstrook niet downloaden');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Loonstroken</h1>
        </div>
        <EmptyState
          icon={Building2}
          title="Geen bedrijf geselecteerd"
          description="Selecteer een bedrijf uit de dropdown in de zijbalk om loonstroken te bekijken."
        />
      </div>
    );
  }

  // Manager/employee zonder gekoppelde werknemer: toon duidelijke melding
  // ipv een lege pagina. Dit gebeurt als het user-role doc geen employeeId
  // heeft (nog niet gelinkt door admin).
  if ((userRole === 'manager' || userRole === 'employee') && !currentEmployeeId) {
    return (
      <div className="space-y-6">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Loonstroken</h1>
        </div>
        <EmptyState
          icon={FileText}
          title="Je profiel is niet gekoppeld"
          description="Je account is nog niet aan een werknemer-profiel gekoppeld. Vraag een admin om dit te doen — dan verschijnen je loonstroken hier automatisch."
        />
      </div>
    );
  }

  const companyEmployees = employees.filter(emp => emp.companyId === selectedCompany.id);

  if ((userRole === 'admin' || userRole === 'co-admin') && !selectedEmployeeId && companyEmployees.length === 0) {
    return (
      <div className="space-y-6">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Loonstroken</h1>
        </div>
        <EmptyState
          icon={FileText}
          title="Geen werknemers gevonden"
          description="Er zijn geen werknemers voor dit bedrijf. Voeg eerst werknemers toe."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Loonstroken</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            {(userRole === 'admin' || userRole === 'co-admin') ? 'Bekijk en beheer loonstroken' : 'Bekijk en download uw loonstroken'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(userRole === 'admin' || userRole === 'co-admin') && companyEmployees.length > 0 && (
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 shadow-sm"
            >
              <option value="">Selecteer werknemer</option>
              {companyEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 shadow-sm"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {(userRole === 'admin' || userRole === 'co-admin') && !selectedEmployeeId ? (
        <Card>
          <EmptyState
            icon={User}
            title="Geen werknemer geselecteerd"
            description="Selecteer een werknemer uit de dropdown hierboven om loonstroken te bekijken."
          />
        </Card>
      ) : payslips.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="Geen loonstroken gevonden"
            description={`Geen loonstroken gevonden voor ${selectedYear} voor deze werknemer.`}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {payslips.map((payslip) => {
            const status = (payslip.status || 'approved') as 'draft' | 'approved' | 'paid';
            const isAdminRole = userRole === 'admin' || userRole === 'co-admin';
            const statusBadge = {
              draft: { label: 'Concept — nog niet goedgekeurd', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200' },
              approved: { label: 'Goedgekeurd', cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200' },
              paid: { label: 'Uitbetaald', cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' },
            }[status];
            return (
              <Card key={payslip.id} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary-50 rounded-xl">
                        <FileText className="h-6 w-6 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {getMonthName(payslip.periodStartDate)}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-300">
                          {payslip.periodStartDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - {payslip.periodEndDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-300">Gegenereerd:</span>
                      <span className="text-gray-900 dark:text-gray-100 font-medium">
                        {payslip.generatedAt.toLocaleDateString('nl-NL')}
                      </span>
                    </div>
                    {payslip.paymentDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-300">Uitbetaling:</span>
                        <span className="text-gray-900 dark:text-gray-100 font-medium">
                          {payslip.paymentDate.toLocaleDateString('nl-NL')}
                        </span>
                      </div>
                    )}
                    {!payslip.paymentDate && status !== 'draft' && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-300">Uitbetaling:</span>
                        <span className="text-gray-400 dark:text-gray-500 italic">nog niet ingevuld</span>
                      </div>
                    )}
                    {payslip.downloadedAt && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 dark:text-gray-500">Gedownload:</span>
                        <span className="text-gray-400 dark:text-gray-500">
                          {payslip.downloadedAt.toLocaleDateString('nl-NL')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Admin/co-admin: approve-knop voor draft */}
                  {isAdminRole && status === 'draft' && (
                    <Button
                      onClick={() => handleApprovePayslip(payslip)}
                      className="w-full"
                      size="sm"
                      variant="success"
                      loading={approving === payslip.id}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Goedkeuren + uitbetaaldatum
                    </Button>
                  )}

                  {/* Admin/co-admin: markeer als betaald */}
                  {isAdminRole && status === 'approved' && (
                    <Button
                      onClick={() => handleMarkPaid(payslip)}
                      className="w-full"
                      size="sm"
                      variant="secondary"
                      loading={approving === payslip.id}
                    >
                      Markeer als uitbetaald
                    </Button>
                  )}

                  {!payslip.pdfUrl || payslip.pdfUrl.trim() === '' ? (
                    <Button
                      onClick={() => handleGeneratePdf(payslip)}
                      className="w-full"
                      size="sm"
                      variant="success"
                      loading={generating === payslip.id}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {generating === payslip.id ? 'Genereren...' : 'Genereer PDF'}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleDownload(payslip)}
                      className="w-full"
                      size="sm"
                      loading={downloading === payslip.id}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {downloading === payslip.id ? 'Downloaden...' : 'Download PDF'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="bg-primary-50 border-primary-200">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-primary-100 rounded-xl">
            <FileText className="h-5 w-5 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-primary-900 mb-2">Bewaartermijn</h3>
            <p className="text-sm text-primary-800">
              Loonstroken worden 7 jaar bewaard conform wettelijke vereisten. Download en bewaar uw loonstroken ook zelf voor uw administratie.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
