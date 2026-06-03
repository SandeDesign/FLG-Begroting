import { useState, useEffect, useCallback } from 'react';
import { Car, Gauge, ShieldCheck, Wrench, CreditCard, AlertTriangle, Plus, CheckCircle2, Route as RouteIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import { usePageTitle } from '../contexts/PageTitleContext';
import { Vehicle, VehicleReport, VehicleReportType } from '../types/vehicle';
import {
  getEmployeeVehicle,
  getVehicleReports,
  getVehicleTripLogs,
  createVehicleReport,
  getApkStatus,
  getMaintenanceStatus,
} from '../services/vehicleService';
import { VehicleTripLog } from '../types/vehicle';

const FUEL_LABELS: Record<string, string> = {
  electric: 'Elektrisch', petrol: 'Benzine', diesel: 'Diesel', hybrid: 'Hybride',
};

const REPORT_TYPES: { value: VehicleReportType; label: string }[] = [
  { value: 'damage', label: 'Schade' },
  { value: 'malfunction', label: 'Defect / pech' },
  { value: 'maintenance_due', label: 'Onderhoud nodig' },
  { value: 'other', label: 'Overig' },
];

const STATUS_STYLE: Record<string, string> = {
  ok: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  soon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};

export default function EmployeeVehicle() {
  usePageTitle('Mijn Auto');
  const { user } = useAuth();
  const { selectedCompany, queryUserId, currentEmployeeId } = useApp();
  const { success, error: showError } = useToast();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [reports, setReports] = useState<VehicleReport[]>([]);
  const [trips, setTrips] = useState<VehicleTripLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState<VehicleReportType>('damage');
  const [reportDesc, setReportDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!queryUserId || !selectedCompany || !currentEmployeeId) { setLoading(false); return; }
    try {
      setLoading(true);
      const v = await getEmployeeVehicle(queryUserId, selectedCompany.id, currentEmployeeId);
      setVehicle(v);
      if (v?.id) {
        const reps = await getVehicleReports(queryUserId, selectedCompany.id, v.id);
        setReports(reps);
        // Eigen ritten uit de persistente rit-logs van de auto
        try {
          const logs = await getVehicleTripLogs(v.id);
          setTrips(logs.filter(l => !l.employeeId || l.employeeId === currentEmployeeId));
        } catch {
          setTrips([]);
        }
      } else {
        setReports([]);
        setTrips([]);
      }
    } catch {
      showError('Fout', 'Kon voertuiggegevens niet laden.');
    } finally {
      setLoading(false);
    }
  }, [queryUserId, selectedCompany, currentEmployeeId, showError]);

  useEffect(() => { load(); }, [load]);

  const handleSubmitReport = async () => {
    if (!reportDesc.trim()) { showError('Validatie', 'Beschrijf de melding.'); return; }
    if (!vehicle?.id || !queryUserId || !selectedCompany || !currentEmployeeId) return;
    try {
      setSaving(true);
      await createVehicleReport({
        userId: queryUserId,
        companyId: selectedCompany.id,
        vehicleId: vehicle.id,
        vehicleKenteken: vehicle.kenteken,
        reportedByEmployeeId: currentEmployeeId,
        reportedByName: user?.displayName || user?.email || undefined,
        type: reportType,
        description: reportDesc.trim(),
      });
      success('Melding verstuurd', 'De beheerder is op de hoogte gesteld.');
      setShowReport(false);
      setReportDesc('');
      setReportType('damage');
      await load();
    } catch {
      showError('Fout', 'Melding versturen mislukt.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  if (!vehicle) {
    return <EmptyState icon={Car} title="Geen auto toegewezen" description="Er is nog geen voertuig aan jou gekoppeld. Neem contact op met je beheerder." />;
  }

  const apk = getApkStatus(vehicle);
  const maint = getMaintenanceStatus(vehicle);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
            <Car className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 font-mono">{vehicle.kenteken}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-300">{vehicle.make} {vehicle.model}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowReport(true)}>
          <Plus className="h-4 w-4 mr-1" /> Melding maken
        </Button>
      </div>

      <Card className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div><p className="text-xs text-gray-500 dark:text-gray-400">Km-stand</p><p className="font-semibold flex items-center gap-1"><Gauge className="h-4 w-4 text-gray-400" />{vehicle.currentMileage ?? '–'} km</p></div>
        <div><p className="text-xs text-gray-500 dark:text-gray-400">Brandstof</p><p className="font-semibold">{FUEL_LABELS[vehicle.fuelType]}</p></div>
        <div><p className="text-xs text-gray-500 dark:text-gray-400">Tankpas</p><p className="font-semibold flex items-center gap-1"><CreditCard className="h-4 w-4 text-gray-400" />{vehicle.fuelCardNumber || '–'}</p></div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${STATUS_STYLE[apk.level]}`}>
          <ShieldCheck className="h-3.5 w-3.5" />
          APK: {vehicle.apkExpiryDate ? new Date(vehicle.apkExpiryDate).toLocaleDateString('nl-NL') : 'onbekend'}
          {apk.level === 'overdue' && ' (verlopen!)'}
          {apk.level === 'soon' && ` (nog ${apk.daysLeft} dagen)`}
        </span>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${STATUS_STYLE[maint.level]}`}>
          <Wrench className="h-3.5 w-3.5" />
          Onderhoud: {maint.level === 'ok' ? 'in orde' : (maint.reason || 'nodig')}
        </span>
      </div>

      <Card className="bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Je kilometerstand (begin- en eindstand) vul je in bij je urenregistratie. Tanken doe je met de tankpas — kosten hoef je hier niet door te geven.
        </p>
      </Card>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
          <RouteIcon className="h-4 w-4" /> Mijn ritten ({trips.length})
        </h4>
        {trips.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nog geen ritten. Ritten ontstaan uit je dagelijkse kilometerstanden en taken-met-kilometers in de urenregistratie.
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {trips.map(log => (
              <div key={log.id} className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {log.date.toLocaleDateString('nl-NL', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <div className="text-right flex-shrink-0">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{log.dayKilometers} km</span>
                    {typeof log.startKilometers === 'number' && typeof log.endKilometers === 'number' && (
                      <p className="text-[11px] text-gray-400">{log.startKilometers} → {log.endKilometers}</p>
                    )}
                  </div>
                </div>
                {log.taskTrips && log.taskTrips.length > 0 && (
                  <div className="mt-1.5 space-y-1 pl-3 border-l-2 border-gray-300 dark:border-gray-600">
                    {log.taskTrips.map((tt, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tt.isRiset ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                            {tt.isRiset ? 'Riset' : 'Taak'}
                          </span>
                          <span className="truncate">{tt.description}</span>
                        </span>
                        <span className="font-medium flex-shrink-0">{tt.kilometers} km</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4" /> Mijn meldingen
        </h4>
        {reports.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nog geen meldingen gemaakt.</p>
        ) : (
          <div className="space-y-1.5">
            {reports.map(r => (
              <Card key={r.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{REPORT_TYPES.find(t => t.value === r.type)?.label || r.type}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{r.description}</p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0 ${r.status === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                  {r.status === 'resolved' ? <><CheckCircle2 className="h-3 w-3" /> Opgelost</> : 'In behandeling'}
                </span>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showReport} onClose={() => setShowReport(false)} title="Melding maken" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Type melding</label>
            <select
              value={reportType}
              onChange={e => setReportType(e.target.value as VehicleReportType)}
              className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100"
            >
              {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Omschrijving</label>
            <textarea
              value={reportDesc}
              onChange={e => setReportDesc(e.target.value)}
              rows={4}
              placeholder="Beschrijf de schade, het defect of het benodigde onderhoud..."
              className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmitReport} disabled={saving}>{saving ? 'Versturen...' : 'Versturen'}</Button>
            <Button variant="secondary" onClick={() => setShowReport(false)} disabled={saving}>Annuleren</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
