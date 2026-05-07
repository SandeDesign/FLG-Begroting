import React, { useEffect, useState, useCallback } from 'react';
import {
  Factory,
  Building2,
  Download,
  Save,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { EmptyState } from '../components/ui/EmptyState';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { usePageTitle } from '../contexts/PageTitleContext';
import { collection, addDoc, Timestamp, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface ProductionEntry {
  id?: string;
  monteur: string;
  datum: string;
  uren: number;
  opdrachtgever: string;
  locaties: string;
  week: number;
  year: number;
  companyId: string;
  employeeId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductionWeek {
  id?: string;
  week: number;
  year: number;
  companyId: string;
  employeeId: string;
  userId: string;
  entries: ProductionEntry[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'processed';
  totalHours: number;
  totalEntries: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectProduction: React.FC = () => {
  const { user, userRole } = useAuth();
  const { selectedCompany, employees, queryUserId } = useApp(); // ✅ Gebruik queryUserId ipv adminUserId
  const { success, error: showError } = useToast();
  usePageTitle('Productie');

  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number>(getWeekNumber(new Date()));
  const [selectedYear, setSelectedYear] = useState<number>(getISOWeekYear(new Date())); // ✅ FIX: Use ISO week year
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [productionData, setProductionData] = useState<ProductionWeek | null>(null);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [linkedEmployees, setLinkedEmployees] = useState<any[]>([]);
  const [existingWeek, setExistingWeek] = useState<ProductionWeek | null>(null);

  // 🔥 Load production data
  const loadProductionData = useCallback(async () => {
    if (!user || !queryUserId || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get linked employees
      const linked = employees.filter(emp =>
        emp.workCompanies?.includes(selectedCompany.id) ||
        emp.projectCompanies?.includes(selectedCompany.id)
      );

      setLinkedEmployees(linked);

      // Auto-select first employee
      let empId = selectedEmployeeId;
      if (!empId && linked.length > 0) {
        empId = linked[0].id;
        setSelectedEmployeeId(empId);
      }

      // Check if week already exists in Firebase
      if (empId) {
        const q = query(
          collection(db, 'productionWeeks'),
          where('userId', '==', queryUserId),
          where('week', '==', selectedWeek),
          where('year', '==', selectedYear),
          where('companyId', '==', selectedCompany.id),
          where('employeeId', '==', empId)
        );
        const snap = await getDocs(q);
        
        if (snap.docs.length > 0) {
          const doc = snap.docs[0];
          const data = doc.data();
          const existing: ProductionWeek = {
            id: doc.id,
            week: data.week,
            year: data.year,
            companyId: data.companyId,
            employeeId: data.employeeId,
            userId: data.userId,
            entries: data.entries || [],
            status: data.status,
            totalHours: data.totalHours,
            totalEntries: data.totalEntries,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          };
          setExistingWeek(existing);
          setProductionData(existing);
          setEntries(existing.entries || []);
          setLoading(false);
          return;
        }
      }

      // No existing week, create new
      setExistingWeek(null);
      const newWeek: ProductionWeek = {
        week: selectedWeek,
        year: selectedYear,
        companyId: selectedCompany.id,
        employeeId: empId,
        userId: queryUserId,
        entries: [],
        status: 'draft',
        totalHours: 0,
        totalEntries: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      setProductionData(newWeek);
      setEntries([]);
    } catch (error) {
      console.error('Error loading production data:', error);
      showError('Fout bij laden', 'Kan productie gegevens niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, queryUserId, selectedCompany, selectedEmployeeId, employees, selectedWeek, selectedYear, showError]);

  // 🔥 Import from Make webhook
  const handleImportFromMake = async () => {
    if (!selectedCompany) {
      showError('Fout', 'Selecteer eerst een bedrijf');
      return;
    }

    if (!selectedEmployeeId) {
      showError('Fout', 'Selecteer een medewerker');
      return;
    }

    const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);

    if (!selectedEmployee) {
      showError('Fout', 'Medewerker niet gevonden');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch(
        'https://hook.eu2.make.com/qmvow9qbpesofmm9p8srgvck550i7xr6',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'get_production_data',
            week: selectedWeek,
            year: selectedYear,
            companyId: selectedCompany.id,
            employee: {
              id: selectedEmployee.id,
              firstName: selectedEmployee.personalInfo.firstName,
              lastName: selectedEmployee.personalInfo.lastName,
              fullName: `${selectedEmployee.personalInfo.firstName} ${selectedEmployee.personalInfo.lastName}`
            },
            employeeName: `${selectedEmployee.personalInfo.firstName} ${selectedEmployee.personalInfo.lastName}`
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Webhook call failed: ${response.status}`);
      }

      let productionResponse;
      const contentType = response.headers.get('content-type');
      
      try {
        if (contentType && contentType.includes('application/json')) {
          productionResponse = await response.json();
        } else {
          const text = await response.text();
          console.log('Raw webhook response:', text);
          
          try {
            productionResponse = JSON.parse(text);
          } catch {
            if (text.toLowerCase().includes('accepted') || text === '202') {
              showError('Verwerking loopt', 'Make.com verwerkt je aanvraag. Dit kan enkele seconden duren. Probeer opnieuw.');
              setImporting(false);
              return;
            }
            throw new Error(`Onverwacht antwoord: ${text}`);
          }
        }
      } catch (parseError) {
        console.error('Error parsing webhook response:', parseError);
        showError('Parse fout', 'Kon webhook antwoord niet interpreteren');
        setImporting(false);
        return;
      }

      console.log('✅ Webhook response:', productionResponse);

      if (
        productionResponse &&
        Array.isArray(productionResponse) &&
        productionResponse.length > 0
      ) {
        const savedSuccessfully = await processProductionData(productionResponse, selectedEmployeeId);
        if (savedSuccessfully) {
          success('Import & Opslaan geslaagd', `${productionResponse.length} productie entries geïmporteerd en opgeslagen`);
        }
      } else if (productionResponse) {
        console.log('Webhook response:', productionResponse);
        showError('Geen data', 'Geen productie gegevens gevonden voor deze week/medewerker');
      } else {
        showError('Leeg antwoord', 'Webhook gaf geen data terug');
      }
    } catch (error) {
      console.error('Error importing production data:', error);
      showError('Import fout', 'Kon productie gegevens niet ophalen');
    } finally {
      setImporting(false);
    }
  };

  const processProductionData = async (rawData: any[], employeeId: string): Promise<boolean> => {
    console.log('🔍 Raw data received:', rawData);

    const normalizedEntries = rawData.map((record, idx) => {
      const data = record.data || record;

      let monteur = '';
      let datum = '';
      let uren = 0;
      let opdrachtgever = '';
      let locaties = '';

      // Try numeric indices first (Make.com format)
      if (data['0'] !== undefined) {
        monteur = data['0'] || '';
        datum = data['1'] ? data['1'].replace(/['"]/g, '') : '';
        uren = parseFloat(data['2']) || 0;
        opdrachtgever = data['3'] || '';
        locaties = data['4'] ? data['4'].replace(/\n/g, ' ').trim() : '';
      } else {
        // Fallback to named properties
        monteur = data.Monteur || data.monteur || '';
        datum = data.Datum || data.datum || '';
        uren = parseFloat(data.Uren || data.uren || 0);
        opdrachtgever = data.Opdrachtgever || data.opdrachtgever || '';
        locaties = data.Locaties || data.locaties || '';
      }

      return {
        dag: datum,
        monteur,
        uren,
        opdrachtgever,
        locaties
      };
    });

    const updatedEntries: ProductionEntry[] = normalizedEntries.map((entry) => ({
      monteur: entry.monteur,
      datum: entry.dag,
      uren: entry.uren,
      opdrachtgever: entry.opdrachtgever,
      locaties: entry.locaties,
      week: selectedWeek,
      year: selectedYear,
      companyId: selectedCompany!.id,
      employeeId: employeeId,
      userId: queryUserId!,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const totalHours = updatedEntries.reduce((sum, entry) => sum + entry.uren, 0);

    const updatedWeek: ProductionWeek = {
      week: selectedWeek,
      year: selectedYear,
      companyId: selectedCompany!.id,
      employeeId: employeeId,
      userId: queryUserId!,
      entries: updatedEntries,
      status: 'draft',
      totalHours: totalHours,
      totalEntries: updatedEntries.length,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setProductionData(updatedWeek);
    setEntries(updatedEntries);

    // 🔥 AUTO-SAVE: Automatisch opslaan na import
    try {
      const dataToSave = {
        week: updatedWeek.week,
        year: updatedWeek.year,
        companyId: updatedWeek.companyId,
        employeeId: updatedWeek.employeeId,
        userId: queryUserId!,
        entries: updatedEntries.map(entry => ({
          monteur: entry.monteur,
          datum: entry.datum,
          uren: entry.uren,
          opdrachtgever: entry.opdrachtgever,
          locaties: entry.locaties,
          week: entry.week,
          year: entry.year,
          companyId: entry.companyId,
          employeeId: entry.employeeId,
          userId: entry.userId,
          createdAt: Timestamp.fromDate(entry.createdAt instanceof Date ? entry.createdAt : new Date()),
          updatedAt: Timestamp.fromDate(entry.updatedAt instanceof Date ? entry.updatedAt : new Date())
        })),
        status: 'draft',
        totalHours: updatedWeek.totalHours,
        totalEntries: updatedWeek.totalEntries,
        createdAt: Timestamp.fromDate(updatedWeek.createdAt instanceof Date ? updatedWeek.createdAt : new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      };

      if (existingWeek?.id) {
        // Update existing
        await updateDoc(doc(db, 'productionWeeks', existingWeek.id), dataToSave);
        console.log('✅ Auto-saved (updated) with ID:', existingWeek.id);
      } else {
        // Create new
        const docRef = await addDoc(collection(db, 'productionWeeks'), dataToSave);
        console.log('✅ Auto-saved (created) with ID:', docRef.id);
        setExistingWeek({ ...updatedWeek, id: docRef.id });
      }

      // Reload data to ensure consistency
      setTimeout(() => {
        loadProductionData();
      }, 500);

      return true;
    } catch (error) {
      console.error('Error auto-saving production data:', error);
      showError('Fout bij automatisch opslaan', `Data is geïmporteerd maar niet opgeslagen: ${error instanceof Error ? error.message : 'Onbekende fout'}`);
      return false;
    }
  };

  const updateEntry = (index: number, field: keyof ProductionEntry, value: any) => {
    const updatedEntries = [...entries];
    updatedEntries[index] = {
      ...updatedEntries[index],
      [field]: field === 'uren' ? parseFloat(value) || 0 : value,
      updatedAt: new Date()
    };

    const totalHours = updatedEntries.reduce((sum, entry) => sum + entry.uren, 0);

    setEntries(updatedEntries);
    if (productionData) {
      setProductionData({
        ...productionData,
        entries: updatedEntries,
        totalHours: totalHours,
        totalEntries: updatedEntries.length,
        updatedAt: new Date()
      });
    }
  };

  const addEntry = () => {
    const newEntry: ProductionEntry = {
      monteur: '',
      datum: new Date().toISOString().split('T')[0],
      uren: 0,
      opdrachtgever: '',
      locaties: '',
      week: selectedWeek,
      year: selectedYear,
      companyId: selectedCompany!.id,
      employeeId: selectedEmployeeId,
      userId: queryUserId!,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedEntries = [...entries, newEntry];
    setEntries(updatedEntries);

    if (productionData) {
      setProductionData({
        ...productionData,
        entries: updatedEntries,
        totalEntries: updatedEntries.length,
        updatedAt: new Date()
      });
    }
  };

  const removeEntry = (index: number) => {
    const updatedEntries = entries.filter((_, i) => i !== index);
    const totalHours = updatedEntries.reduce((sum, entry) => sum + entry.uren, 0);

    setEntries(updatedEntries);
    if (productionData) {
      setProductionData({
        ...productionData,
        entries: updatedEntries,
        totalHours: totalHours,
        totalEntries: updatedEntries.length,
        updatedAt: new Date()
      });
    }
  };

  // 🔥 FIREBASE: Save or update production week
  const handleSave = async () => {
    if (!productionData || !user || !queryUserId || entries.length === 0) {
      showError('Fout', 'Voeg minstens 1 entry toe voordat je opslaat');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        week: productionData.week,
        year: productionData.year,
        companyId: productionData.companyId,
        employeeId: productionData.employeeId,
        userId: queryUserId,
        entries: entries.map(entry => ({
          monteur: entry.monteur,
          datum: entry.datum,
          uren: entry.uren,
          opdrachtgever: entry.opdrachtgever,
          locaties: entry.locaties,
          week: entry.week,
          year: entry.year,
          companyId: entry.companyId,
          employeeId: entry.employeeId,
          userId: entry.userId,
          createdAt: Timestamp.fromDate(entry.createdAt instanceof Date ? entry.createdAt : new Date()),
          updatedAt: Timestamp.fromDate(entry.updatedAt instanceof Date ? entry.updatedAt : new Date())
        })),
        status: 'draft',
        totalHours: productionData.totalHours,
        totalEntries: productionData.totalEntries,
        createdAt: Timestamp.fromDate(productionData.createdAt instanceof Date ? productionData.createdAt : new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      };

      console.log('💾 Saving production week:', dataToSave);

      if (existingWeek?.id) {
        // Update existing
        await updateDoc(doc(db, 'productionWeeks', existingWeek.id), dataToSave);
        console.log('✅ Updated with ID:', existingWeek.id);
        success('Bijgewerkt', `Week ${selectedWeek} productie bijgewerkt met ${entries.length} entries`);
      } else {
        // Create new
        const docRef = await addDoc(collection(db, 'productionWeeks'), dataToSave);
        console.log('✅ Saved with ID:', docRef.id);
        setExistingWeek({ ...productionData, id: docRef.id });
        success('Opgeslagen', `Week ${selectedWeek} productie opgeslagen met ${entries.length} entries`);
      }
      
      setTimeout(() => {
        loadProductionData();
      }, 500);
    } catch (error) {
      console.error('Error saving production data:', error);
      showError('Fout bij opslaan', `Kon productie niet opslaan: ${error instanceof Error ? error.message : 'Onbekende fout'}`);
    } finally {
      setSaving(false);
    }
  };

  const changeWeek = (delta: number) => {
    let newWeek = selectedWeek + delta;
    let newYear = selectedYear;

    if (newWeek < 1) {
      newWeek = 52;
      newYear--;
    } else if (newWeek > 52) {
      newWeek = 1;
      newYear++;
    }

    setSelectedWeek(newWeek);
    setSelectedYear(newYear);
  };

  useEffect(() => {
    loadProductionData();
  }, [loadProductionData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!selectedCompany) {
    return (
      <div className="space-y-6 px-4 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Productie Verwerking</h1>
        <EmptyState
          icon={Building2}
          title="Geen bedrijf geselecteerd"
          description="Selecteer een projectbedrijf om productie te verwerken."
        />
      </div>
    );
  }

  if (selectedCompany.companyType !== 'project') {
    return (
      <div className="space-y-6 px-4 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Productie Verwerking</h1>
        <EmptyState
          icon={Factory}
          title="Dit is geen projectbedrijf"
          description="Productie verwerking is alleen beschikbaar voor projectbedrijven."
        />
      </div>
    );
  }

  // ✅ Show empty state only for non-admin/manager roles
  if (linkedEmployees.length === 0 && userRole !== 'admin' && userRole !== 'manager') {
    return (
      <div className="space-y-6 px-4 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Productie Verwerking</h1>
        <EmptyState
          icon={UserIcon}
          title="Geen medewerkers gekoppeld"
          description="Koppel eerst medewerkers aan dit projectbedrijf om productie in te voeren."
        />
      </div>
    );
  }

  const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);

  return (
    <div className="space-y-3 sm:space-y-6 px-4 sm:px-0 pb-24 sm:pb-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Productie Verwerking</h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-2">
            Beheer productie voor {selectedCompany.name}
          </p>
        </div>

        {/* Week Navigation + Employee Selector + Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Week Selector */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => changeWeek(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Vorige week"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div className="text-center px-4 min-w-[120px]">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Week {selectedWeek}</p>
              <p className="text-xs text-gray-500 dark:text-gray-300">{selectedYear}</p>
            </div>
            <button
              onClick={() => changeWeek(1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Volgende week"
            >
              <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Employee Selector */}
          {linkedEmployees.length > 1 && (
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800"
            >
              <option value="">Selecteer medewerker...</option>
              {linkedEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                </option>
              ))}
            </select>
          )}

          {/* Import Button */}
          <Button
            onClick={handleImportFromMake}
            disabled={importing || saving || !selectedEmployeeId}
            variant="secondary"
            size="sm"
            className="text-xs sm:text-sm"
          >
            {importing ? (
              <>
                <LoadingSpinner className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                Laden...
              </>
            ) : (
              <>
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                Ophalen
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Selected Employee Info */}
      {selectedEmployee && (
        <Card className="bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 dark:bg-primary-800/50 rounded-full p-2">
              <UserIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-xs text-primary-700 dark:text-primary-300 font-medium">Geselecteerde medewerker</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {selectedEmployee.personalInfo.firstName} {selectedEmployee.personalInfo.lastName}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Summary Card */}
      {productionData && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800 p-4 sm:p-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Week {selectedWeek} Samenvatting</h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-2 sm:p-3 bg-white dark:bg-gray-700 rounded-lg text-center border border-gray-100 dark:border-gray-600">
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1 font-medium">Totaal Uren</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                  {productionData.totalHours}u
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-white dark:bg-gray-700 rounded-lg text-center border border-gray-100 dark:border-gray-600">
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1 font-medium">Entries</p>
                <p className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {productionData.totalEntries}
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-white dark:bg-gray-700 rounded-lg text-center border border-gray-100 dark:border-gray-600">
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1 font-medium">Status</p>
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200 capitalize">
                  {productionData.status}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Production Entries Table */}
      {entries.length > 0 ? (
        <Card className="p-3 sm:p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Productie Entries</h3>
              <Button
                onClick={addEntry}
                size="sm"
                variant="secondary"
                className="text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Toevoegen
              </Button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3">Monteur</th>
                    <th className="text-left py-2 px-3">Datum</th>
                    <th className="text-left py-2 px-3">Uren</th>
                    <th className="text-left py-2 px-3">Opdrachtgever</th>
                    <th className="text-left py-2 px-3">Locaties</th>
                    <th className="text-center py-2 px-3">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-900">
                      <td className="py-2 px-3">
                        <Input
                          type="text"
                          value={entry.monteur}
                          onChange={(e) => updateEntry(index, 'monteur', e.target.value)}
                          className="text-xs"
                          placeholder="Monteur"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="date"
                          value={entry.datum}
                          onChange={(e) => updateEntry(index, 'datum', e.target.value)}
                          className="text-xs"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          min="0"
                          step="0.25"
                          value={entry.uren}
                          onChange={(e) => updateEntry(index, 'uren', e.target.value)}
                          className="text-xs text-center"
                          placeholder="0"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="text"
                          value={entry.opdrachtgever}
                          onChange={(e) => updateEntry(index, 'opdrachtgever', e.target.value)}
                          className="text-xs"
                          placeholder="Opdrachtgever"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="text"
                          value={entry.locaties}
                          onChange={(e) => updateEntry(index, 'locaties', e.target.value)}
                          className="text-xs"
                          placeholder="Locaties"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => removeEntry(index)}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-2">
              {entries.map((entry, index) => (
                <Card key={index} className="p-3 bg-gray-50 dark:bg-gray-900">
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-300 font-medium">Monteur</label>
                        <Input
                          type="text"
                          value={entry.monteur}
                          onChange={(e) => updateEntry(index, 'monteur', e.target.value)}
                          className="text-xs"
                          placeholder="Monteur"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-300 font-medium">Datum</label>
                        <Input
                          type="date"
                          value={entry.datum}
                          onChange={(e) => updateEntry(index, 'datum', e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-300 font-medium">Uren</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.25"
                          value={entry.uren}
                          onChange={(e) => updateEntry(index, 'uren', e.target.value)}
                          className="text-xs text-center"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => removeEntry(index)}
                          className="w-full text-red-600 hover:text-red-800 p-2 bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 dark:text-gray-300 font-medium">Opdrachtgever</label>
                      <Input
                        type="text"
                        value={entry.opdrachtgever}
                        onChange={(e) => updateEntry(index, 'opdrachtgever', e.target.value)}
                        className="text-xs"
                        placeholder="Opdrachtgever"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 dark:text-gray-300 font-medium">Locaties</label>
                      <Input
                        type="text"
                        value={entry.locaties}
                        onChange={(e) => updateEntry(index, 'locaties', e.target.value)}
                        className="text-xs"
                        placeholder="Locaties"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-8">
          <div className="text-center">
            <Factory className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-500 dark:text-gray-300 mb-4">Geen productie entries beschikbaar</p>
            <Button onClick={addEntry} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Eerste Entry Toevoegen
            </Button>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 sm:gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || entries.length === 0}
          loading={saving}
          className="flex-1 sm:flex-none"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Opslaan...' : existingWeek ? 'Bijwerken' : 'Opslaan'}
        </Button>
      </div>
    </div>
  );
};

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

export default ProjectProduction;