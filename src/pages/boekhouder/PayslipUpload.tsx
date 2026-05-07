import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Upload, Calendar, User, CheckCircle2, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { usePageTitle } from '../../contexts/PageTitleContext';
import { useToast } from '../../hooks/useToast';
import { getEmployees } from '../../services/firebase';
import { uploadPayslipForEmployee, getPayslips, deletePayslip } from '../../services/payslipService';
import { Employee } from '../../types';
import { Payslip } from '../../types/payslip';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';

const MONTHS = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

const PayslipUpload: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('Loonstroken uploaden');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth()); // 0-11
  // Uitbetaaldatum wordt NIET meer door de boekhouder ingevuld — dat doet
  // admin/co-admin bij goedkeuring. Boekhouder uploadt alleen de PDF + periode.
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Recente uploads voor de geselecteerde medewerker — kort lijstje ter
  // bevestiging dat er al iets staat.
  const [recent, setRecent] = useState<Payslip[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!selectedCompany) {
        setEmployees([]);
        setLoadingEmployees(false);
        return;
      }
      try {
        setLoadingEmployees(true);
        // Boekhouder: laad employees onder de admin-UID van het bedrijf
        const list = await getEmployees(selectedCompany.userId, selectedCompany.id);
        setEmployees(list.filter((e) => e.status === 'active' || !e.status));
      } catch (err) {
        console.error('[PayslipUpload] employees load error:', err);
        showError('Kon werknemers niet laden');
      } finally {
        setLoadingEmployees(false);
      }
    };
    load();
    setSelectedEmployeeId('');
  }, [selectedCompany, showError]);

  // Haal recente uploads op zodra er een werknemer gekozen is.
  useEffect(() => {
    const load = async () => {
      if (!selectedCompany || !selectedEmployeeId) {
        setRecent([]);
        return;
      }
      try {
        setLoadingRecent(true);
        const all = await getPayslips(selectedCompany.userId, selectedEmployeeId);
        setRecent(all.sort((a, b) => b.periodStartDate.getTime() - a.periodStartDate.getTime()).slice(0, 6));
      } catch (err) {
        console.warn('[PayslipUpload] recent load error:', err);
      } finally {
        setLoadingRecent(false);
      }
    };
    load();
  }, [selectedCompany, selectedEmployeeId]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      showError('Alleen PDF-bestanden toegestaan');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      showError('Bestand te groot (max 5 MB)');
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!user || !selectedCompany || !selectedEmployeeId || !file) return;
    const periodStart = new Date(year, month, 1);
    const periodEnd = new Date(year, month + 1, 0); // laatste dag van de maand

    try {
      setUploading(true);
      await uploadPayslipForEmployee({
        adminUserId: selectedCompany.userId,
        employeeId: selectedEmployeeId,
        companyId: selectedCompany.id,
        companyName: selectedCompany.name,
        employeeCode: selectedEmployee
          ? `${selectedEmployee.personalInfo.firstName}-${selectedEmployee.personalInfo.lastName}`
          : undefined,
        file,
        periodStartDate: periodStart,
        periodEndDate: periodEnd,
        generatedBy: user.uid,
      });
      success('Loonstrook geüpload', `${MONTHS[month]} ${year} opgeslagen voor ${selectedEmployee?.personalInfo.firstName || 'medewerker'}`);
      setFile(null);
      // Reload recente lijst
      const all = await getPayslips(selectedCompany.userId, selectedEmployeeId);
      setRecent(all.sort((a, b) => b.periodStartDate.getTime() - a.periodStartDate.getTime()).slice(0, 6));
    } catch (err) {
      console.error('[PayslipUpload] upload failed:', err);
      showError('Uploaden mislukt');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePayslip = async (payslipId: string) => {
    if (!confirm('Weet je zeker dat je deze loonstrook wilt verwijderen?')) return;
    try {
      setDeletingId(payslipId);
      await deletePayslip(payslipId);
      setRecent((prev) => prev.filter((p) => p.id !== payslipId));
      success('Loonstrook verwijderd');
    } catch (err) {
      console.error('[PayslipUpload] delete failed:', err);
      showError('Verwijderen mislukt');
    } finally {
      setDeletingId(null);
    }
  };

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={FileText}
        title="Geen bedrijf geselecteerd"
        description="Selecteer eerst een bedrijf waarvoor je loonstroken wil uploaden."
      />
    );
  }

  // Alleen zinnig voor een loonmaatschappij (employer). Toon duidelijke melding
  // als er een ander bedrijfstype actief is.
  if (selectedCompany.companyType !== 'employer') {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Geen loonmaatschappij"
        description="Loonstroken uploaden is alleen beschikbaar voor loonmaatschappijen (employer)."
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary-600" />
          Loonstroken uploaden
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
          Voor {selectedCompany.name} — kies een medewerker en upload de maandlooncheck als PDF.
        </p>
      </div>

      <Card>
        <div className="p-4 sm:p-6 space-y-4">
          {/* Werknemer */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
              Medewerker
            </label>
            {loadingEmployees ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300">
                <Loader2 className="h-4 w-4 animate-spin" /> Laden…
              </div>
            ) : employees.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-300">
                Geen actieve medewerkers gevonden voor dit bedrijf.
              </p>
            ) : (
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">— Kies medewerker —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Periode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Maand
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Jaar
              </label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Info voor boekhouder over approval-flow */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Goedkeuringsflow</p>
            <p>
              Na upload staat de loonstrook als <strong>concept</strong>. De admin of co-admin van dit bedrijf
              moet hem goedkeuren en de uitbetaaldatum invullen — pas daarna
              is de loonstrook zichtbaar voor de werknemer.
            </p>
          </div>

          {/* Bestand */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
              Loonstrook PDF
            </label>
            <label className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary-400 transition-colors bg-gray-50 dark:bg-gray-900/40">
              <Upload className="h-5 w-5 text-primary-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {file ? file.name : 'Klik om een PDF te kiezen'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-300">Max 5 MB, alleen PDF</p>
              </div>
              <input type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
            </label>
          </div>

          {/* Upload knop */}
          <div className="flex justify-end gap-2">
            <Button
              onClick={handleUpload}
              disabled={!selectedEmployeeId || !file || uploading}
              loading={uploading}
              icon={Upload}
            >
              {uploading ? 'Uploaden…' : 'Uploaden'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Recente uploads voor deze werknemer */}
      {selectedEmployeeId && (
        <Card>
          <div className="p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-primary-600" />
              Recente loonstroken van {selectedEmployee ? `${selectedEmployee.personalInfo.firstName} ${selectedEmployee.personalInfo.lastName}` : 'deze medewerker'}
            </h2>
            {loadingRecent ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300">
                <Loader2 className="h-4 w-4 animate-spin" /> Laden…
              </div>
            ) : recent.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-300">Nog geen loonstroken geüpload.</p>
            ) : (
              <div className="space-y-2">
                {recent.map((p) => {
                  const monthLabel =
                    MONTHS[p.periodStartDate.getMonth()].charAt(0).toUpperCase() +
                    MONTHS[p.periodStartDate.getMonth()].slice(1);
                  const hasPdf = !!p.pdfUrl;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-sm"
                    >
                      {hasPdf ? (
                        <a
                          href={p.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 min-w-0 flex items-center gap-3"
                          title="Open PDF in nieuwe tab"
                        >
                          <FileText className="h-4 w-4 text-primary-600 flex-shrink-0" />
                          <span className="flex-1 min-w-0 truncate text-gray-900 dark:text-gray-100">
                            {monthLabel} {p.periodStartDate.getFullYear()}
                          </span>
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 flex-shrink-0">
                            <CheckCircle2 className="h-3 w-3" /> PDF
                          </span>
                        </a>
                      ) : (
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="flex-1 min-w-0 truncate text-gray-500 dark:text-gray-300">
                            {monthLabel} {p.periodStartDate.getFullYear()}
                          </span>
                          <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 flex-shrink-0">
                            Zonder PDF
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => handleDeletePayslip(p.id!)}
                        disabled={!!deletingId}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0 disabled:opacity-50"
                        title="Verwijderen"
                      >
                        {deletingId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default PayslipUpload;
