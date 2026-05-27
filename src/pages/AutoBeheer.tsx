import { useState, useEffect, useCallback } from 'react';
import {
  Car, Plus, Pencil, Trash2, Gauge, ShieldCheck, Wrench, AlertTriangle,
  CheckCircle2, CreditCard, User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import { usePageTitle } from '../contexts/PageTitleContext';
import { Vehicle, VehicleMileageLog, VehicleReport, FuelType, VehicleStatusLevel } from '../types/vehicle';
import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  assignVehicleToEmployee,
  getMileageHistory,
  getVehicleReports,
  updateVehicleReportStatus,
  getApkStatus,
  getMaintenanceStatus,
} from '../services/vehicleService';
import { AuditService } from '../services/auditService';

const FUEL_LABELS: Record<FuelType, string> = {
  electric: 'Elektrisch',
  petrol: 'Benzine',
  diesel: 'Diesel',
  hybrid: 'Hybride',
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  damage: 'Schade',
  malfunction: 'Defect',
  maintenance_due: 'Onderhoud nodig',
  other: 'Overig',
};

const STATUS_STYLE: Record<VehicleStatusLevel, string> = {
  ok: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  soon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};

const toDateInput = (d?: Date): string => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

interface VehicleFormState {
  kenteken: string;
  make: string;
  model: string;
  year: string;
  vin: string;
  fuelType: FuelType;
  fuelCardNumber: string;
  currentMileage: string;
  assignedToEmployeeId: string;
  apkExpiryDate: string;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  maintenanceIntervalKm: string;
  lastMaintenanceMileage: string;
  insurer: string;
  policyNumber: string;
  notes: string;
}

const emptyForm: VehicleFormState = {
  kenteken: '', make: '', model: '', year: '', vin: '', fuelType: 'petrol',
  fuelCardNumber: '', currentMileage: '', assignedToEmployeeId: '', apkExpiryDate: '',
  lastMaintenanceDate: '', nextMaintenanceDate: '', maintenanceIntervalKm: '',
  lastMaintenanceMileage: '', insurer: '', policyNumber: '', notes: '',
};

export default function AutoBeheer() {
  usePageTitle('Auto Beheer');
  const { user, userRole } = useAuth();
  const { selectedCompany, queryUserId, employees } = useApp();
  const { success, error: showError } = useToast();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [detailVehicle, setDetailVehicle] = useState<Vehicle | null>(null);
  const [mileageHistory, setMileageHistory] = useState<VehicleMileageLog[]>([]);
  const [reports, setReports] = useState<VehicleReport[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const canManage = userRole === 'admin' || userRole === 'co-admin';
  const canAssign = canManage || userRole === 'manager';

  const employeeName = useCallback((id?: string) => {
    if (!id) return null;
    const emp = employees.find(e => e.id === id);
    if (!emp) return null;
    return [emp.personalInfo?.firstName, emp.personalInfo?.lastName].filter(Boolean).join(' ') || id;
  }, [employees]);

  const load = useCallback(async () => {
    if (!queryUserId || !selectedCompany) { setLoading(false); return; }
    try {
      setLoading(true);
      const data = await getVehicles(queryUserId, selectedCompany.id);
      setVehicles(data);
    } catch {
      showError('Fout', 'Voertuigen konden niet worden geladen.');
    } finally {
      setLoading(false);
    }
  }, [queryUserId, selectedCompany, showError]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };

  const openEdit = (v: Vehicle) => {
    setEditingId(v.id!);
    setForm({
      kenteken: v.kenteken || '', make: v.make || '', model: v.model || '',
      year: v.year ? String(v.year) : '', vin: v.vin || '', fuelType: v.fuelType || 'petrol',
      fuelCardNumber: v.fuelCardNumber || '',
      currentMileage: v.currentMileage !== undefined ? String(v.currentMileage) : '',
      assignedToEmployeeId: v.assignedToEmployeeId || '',
      apkExpiryDate: toDateInput(v.apkExpiryDate),
      lastMaintenanceDate: toDateInput(v.lastMaintenanceDate),
      nextMaintenanceDate: toDateInput(v.nextMaintenanceDate),
      maintenanceIntervalKm: v.maintenanceIntervalKm !== undefined ? String(v.maintenanceIntervalKm) : '',
      lastMaintenanceMileage: v.lastMaintenanceMileage !== undefined ? String(v.lastMaintenanceMileage) : '',
      insurer: v.insurer || '', policyNumber: v.policyNumber || '', notes: v.notes || '',
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const numOrUndef = (s: string): number | undefined => {
    if (s.trim() === '') return undefined;
    const n = Number(s);
    return isNaN(n) ? undefined : n;
  };
  const dateOrUndef = (s: string): Date | undefined => (s ? new Date(s) : undefined);

  const handleSave = async () => {
    if (!form.kenteken.trim()) { showError('Validatie', 'Kenteken is verplicht.'); return; }
    if (!form.make.trim()) { showError('Validatie', 'Merk is verplicht.'); return; }
    if (!queryUserId || !selectedCompany) return;

    const payload = {
      kenteken: form.kenteken.trim().toUpperCase(),
      make: form.make.trim(),
      model: form.model.trim(),
      year: numOrUndef(form.year),
      vin: form.vin.trim() || undefined,
      fuelType: form.fuelType,
      fuelCardNumber: form.fuelCardNumber.trim() || undefined,
      currentMileage: numOrUndef(form.currentMileage),
      assignedToEmployeeId: form.assignedToEmployeeId || undefined,
      apkExpiryDate: dateOrUndef(form.apkExpiryDate),
      lastMaintenanceDate: dateOrUndef(form.lastMaintenanceDate),
      nextMaintenanceDate: dateOrUndef(form.nextMaintenanceDate),
      maintenanceIntervalKm: numOrUndef(form.maintenanceIntervalKm),
      lastMaintenanceMileage: numOrUndef(form.lastMaintenanceMileage),
      insurer: form.insurer.trim() || undefined,
      policyNumber: form.policyNumber.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    try {
      setSaving(true);
      if (editingId) {
        await updateVehicle(editingId, payload);
        await AuditService.logAction(queryUserId, 'update', 'vehicle', editingId, { companyId: selectedCompany.id });
        success('Opgeslagen', 'Voertuig bijgewerkt.');
      } else {
        const id = await createVehicle({ ...payload, userId: queryUserId, companyId: selectedCompany.id, isActive: true });
        await AuditService.logAction(queryUserId, 'create', 'vehicle', id, { companyId: selectedCompany.id });
        success('Aangemaakt', 'Voertuig toegevoegd.');
      }
      closeForm();
      await load();
    } catch {
      showError('Fout', 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: Vehicle) => {
    if (!v.id || !queryUserId || !selectedCompany) return;
    if (!window.confirm(`Voertuig ${v.kenteken} verwijderen?`)) return;
    try {
      await deleteVehicle(v.id);
      await AuditService.logAction(queryUserId, 'delete', 'vehicle', v.id, { companyId: selectedCompany.id });
      success('Verwijderd', `${v.kenteken} verwijderd.`);
      await load();
    } catch {
      showError('Fout', 'Verwijderen mislukt.');
    }
  };

  const handleAssign = async (v: Vehicle, employeeId: string) => {
    if (!v.id || !queryUserId || !selectedCompany) return;
    try {
      await assignVehicleToEmployee(v.id, employeeId || null);
      await AuditService.logAction(queryUserId, 'update', 'vehicle', v.id, {
        companyId: selectedCompany.id,
      });
      success('Toegewezen', employeeId ? 'Medewerker gekoppeld.' : 'Koppeling verwijderd.');
      await load();
    } catch {
      showError('Fout', 'Toewijzen mislukt.');
    }
  };

  const openDetail = async (v: Vehicle) => {
    setDetailVehicle(v);
    if (!queryUserId || !selectedCompany || !v.id) return;
    try {
      setDetailLoading(true);
      const [history, reps] = await Promise.all([
        getMileageHistory(v.id),
        getVehicleReports(queryUserId, selectedCompany.id, v.id),
      ]);
      setMileageHistory(history);
      setReports(reps);
    } catch {
      setMileageHistory([]);
      setReports([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleResolveReport = async (report: VehicleReport) => {
    if (!report.id || !user) return;
    try {
      await updateVehicleReportStatus(report.id, 'resolved', user.uid);
      if (queryUserId && selectedCompany) {
        await AuditService.logAction(queryUserId, 'update', 'vehicle_report', report.id, { companyId: selectedCompany.id });
        const reps = await getVehicleReports(queryUserId, selectedCompany.id, report.vehicleId);
        setReports(reps);
      }
      success('Afgehandeld', 'Melding gemarkeerd als opgelost.');
    } catch {
      showError('Fout', 'Bijwerken mislukt.');
    }
  };

  if (!canAssign) {
    return <EmptyState icon={Car} title="Geen toegang" description="Alleen admins en managers kunnen het wagenpark beheren." />;
  }
  if (!selectedCompany) {
    return <EmptyState icon={Car} title="Geen bedrijf geselecteerd" description="Selecteer eerst een bedrijf." />;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
            <Car className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Auto Beheer</h1>
            <p className="text-sm text-gray-500 dark:text-gray-300">{selectedCompany.name}</p>
          </div>
        </div>
        {canManage && (
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nieuwe auto
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="Nog geen voertuigen"
          description="Voeg auto's toe en koppel ze aan medewerkers. De kilometerstanden lopen mee vanuit de urenregistratie."
          actionLabel={canManage ? 'Eerste auto toevoegen' : undefined}
          onAction={canManage ? openAdd : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {vehicles.map(v => {
            const apk = getApkStatus(v);
            const maint = getMaintenanceStatus(v);
            const driver = employeeName(v.assignedToEmployeeId);
            return (
              <Card key={v.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => openDetail(v)} className="text-left min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-900 dark:text-gray-100">{v.kenteken}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-300 truncate">{v.make} {v.model}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-300">
                      <span className="flex items-center gap-1"><Gauge className="h-3 w-3" />{v.currentMileage ?? '–'} km</span>
                      <span>{FUEL_LABELS[v.fuelType]}</span>
                    </div>
                  </button>
                  {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(v)} className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(v)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${STATUS_STYLE[apk.level]}`}>
                    <ShieldCheck className="h-3 w-3" />
                    APK {apk.daysLeft === null ? 'onbekend' : apk.level === 'overdue' ? 'verlopen' : `nog ${apk.daysLeft}d`}
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${STATUS_STYLE[maint.level]}`}>
                    <Wrench className="h-3 w-3" />
                    Onderhoud {maint.level === 'ok' ? 'ok' : maint.level === 'overdue' ? 'nodig' : 'binnenkort'}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                  <UserIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  {canAssign ? (
                    <select
                      value={v.assignedToEmployeeId || ''}
                      onChange={(e) => handleAssign(v, e.target.value)}
                      className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Geen medewerker</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {[emp.personalInfo?.firstName, emp.personalInfo?.lastName].filter(Boolean).join(' ') || emp.id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-gray-700 dark:text-gray-200">{driver || 'Niet toegewezen'}</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal isOpen={showForm} onClose={closeForm} title={editingId ? 'Auto bewerken' : 'Nieuwe auto'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Kenteken *" value={form.kenteken} onChange={e => setForm(f => ({ ...f, kenteken: e.target.value }))} placeholder="AB-123-C" />
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Brandstof</label>
              <select
                value={form.fuelType}
                onChange={e => setForm(f => ({ ...f, fuelType: e.target.value as FuelType }))}
                className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                {Object.entries(FUEL_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
            </div>
            <Input label="Merk *" value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))} placeholder="Volkswagen" />
            <Input label="Model" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Transporter" />
            <Input label="Bouwjaar" type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
            <Input label="Huidige km-stand" type="number" value={form.currentMileage} onChange={e => setForm(f => ({ ...f, currentMileage: e.target.value }))} />
            <Input label="VIN (chassisnummer)" value={form.vin} onChange={e => setForm(f => ({ ...f, vin: e.target.value }))} />
            <Input label="Tankpas-nummer" value={form.fuelCardNumber} onChange={e => setForm(f => ({ ...f, fuelCardNumber: e.target.value }))} placeholder="Tanken via tankpas" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Toegewezen medewerker</label>
            <select
              value={form.assignedToEmployeeId}
              onChange={e => setForm(f => ({ ...f, assignedToEmployeeId: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">Geen medewerker</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {[emp.personalInfo?.firstName, emp.personalInfo?.lastName].filter(Boolean).join(' ') || emp.id}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">APK vervaldatum</label>
              <Input type="date" value={form.apkExpiryDate} onChange={e => setForm(f => ({ ...f, apkExpiryDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Volgende onderhoudsbeurt</label>
              <Input type="date" value={form.nextMaintenanceDate} onChange={e => setForm(f => ({ ...f, nextMaintenanceDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Laatste onderhoudsbeurt</label>
              <Input type="date" value={form.lastMaintenanceDate} onChange={e => setForm(f => ({ ...f, lastMaintenanceDate: e.target.value }))} />
            </div>
            <Input label="Onderhoudsinterval (km)" type="number" value={form.maintenanceIntervalKm} onChange={e => setForm(f => ({ ...f, maintenanceIntervalKm: e.target.value }))} />
            <Input label="km-stand bij laatste onderhoud" type="number" value={form.lastMaintenanceMileage} onChange={e => setForm(f => ({ ...f, lastMaintenanceMileage: e.target.value }))} />
            <Input label="Verzekeraar" value={form.insurer} onChange={e => setForm(f => ({ ...f, insurer: e.target.value }))} />
            <Input label="Polisnummer" value={form.policyNumber} onChange={e => setForm(f => ({ ...f, policyNumber: e.target.value }))} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Notities</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Opslaan...' : editingId ? 'Bijwerken' : 'Aanmaken'}</Button>
            <Button variant="secondary" onClick={closeForm} disabled={saving}>Annuleren</Button>
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal isOpen={!!detailVehicle} onClose={() => setDetailVehicle(null)} title={detailVehicle ? `${detailVehicle.kenteken} — ${detailVehicle.make} ${detailVehicle.model}` : ''} size="lg">
        {detailVehicle && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Km-stand</p><p className="font-semibold">{detailVehicle.currentMileage ?? '–'} km</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Brandstof</p><p className="font-semibold">{FUEL_LABELS[detailVehicle.fuelType]}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Bestuurder</p><p className="font-semibold">{employeeName(detailVehicle.assignedToEmployeeId) || '–'}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">APK vervalt</p><p className="font-semibold">{detailVehicle.apkExpiryDate ? new Date(detailVehicle.apkExpiryDate).toLocaleDateString('nl-NL') : '–'}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Volgend onderhoud</p><p className="font-semibold">{detailVehicle.nextMaintenanceDate ? new Date(detailVehicle.nextMaintenanceDate).toLocaleDateString('nl-NL') : '–'}</p></div>
              <div className="flex items-center gap-1"><CreditCard className="h-4 w-4 text-gray-400" /><div><p className="text-xs text-gray-500 dark:text-gray-400">Tankpas</p><p className="font-semibold">{detailVehicle.fuelCardNumber || '–'}</p></div></div>
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-6"><LoadingSpinner /></div>
            ) : (
              <>
                {/* Meldingen */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Meldingen ({reports.length})
                  </h4>
                  {reports.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Geen meldingen.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {reports.map(r => (
                        <div key={r.id} className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {REPORT_TYPE_LABELS[r.type] || r.type}
                              {r.reportedByName ? ` — ${r.reportedByName}` : ''}
                            </span>
                            {r.status === 'resolved' ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Opgelost
                              </span>
                            ) : (
                              <button onClick={() => handleResolveReport(r)} className="text-[11px] px-2 py-0.5 rounded-full border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20">
                                Markeer opgelost
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{r.description}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('nl-NL') : ''}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tellerstand-historie */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                    <Gauge className="h-4 w-4" /> Tellerstand-historie
                  </h4>
                  {mileageHistory.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Nog geen kilometerstanden geregistreerd. Deze lopen mee vanuit de urenregistratie.</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {mileageHistory.map(log => (
                        <div key={log.id} className="flex items-center justify-between text-sm px-2.5 py-1.5 rounded bg-gray-50 dark:bg-gray-900">
                          <span className="text-gray-600 dark:text-gray-300">{log.date ? new Date(log.date).toLocaleDateString('nl-NL') : ''}</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{log.mileage} km</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {detailVehicle.notes && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Notities</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{detailVehicle.notes}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
