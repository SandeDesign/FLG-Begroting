import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, Clock, Euro, TrendingUp, HeartPulse, AlertTriangle, Factory } from 'lucide-react';
import Card from '../components/ui/Card';
import StatTile from '../components/ui/StatTile';
import PageHeader from '../components/ui/PageHeader';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, LineChart } from 'recharts';
import { usePageTitle } from '../contexts/PageTitleContext';

import { isInQuarter, isWeekInQuarter } from '../utils/dateFilters';

const AVERAGE_MONTHLY_COST_PER_EMPLOYEE = 3000;

const formatCurrency = (amount: number): string => {
  if (Math.abs(amount) >= 100000) {
    return `€${(amount / 1000).toFixed(0)}k`;
  }
  return `€${amount.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const EmployerStatistics: React.FC = () => {
  const { selectedCompany, employees, selectedYear, selectedQuarter } = useApp();
  const { adminUserId } = useAuth();
  usePageTitle('Werkgeverstatistieken');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    totalHours: 0,
    totalOvertime: 0,
    estimatedMonthlyPayroll: 0,
    totalSickDays: 0,
    activeSickCount: 0,
    sickPercentage: 0,
    totalLeaveRequests: 0,
    approvedLeave: 0,
    totalRevenue: 0,
    totalCosts: 0,
    productionValue: 0,
    hourlyRate: 0,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [employeeHoursData, setEmployeeHoursData] = useState<any[]>([]);
  const [sickEmployees, setSickEmployees] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedCompany || !adminUserId || selectedCompany.companyType !== 'employer') {
      setLoading(false);
      return;
    }

    loadEmployerStatistics();
  }, [selectedCompany, adminUserId, selectedYear, selectedQuarter]);

  const loadEmployerStatistics = async () => {
    if (!adminUserId || !selectedCompany) return;

    setLoading(true);
    try {
      // Vers uurtarief ophalen uit Firestore
      const companyDocSnap = await getDoc(doc(db, 'companies', selectedCompany.id));
      const companyData = companyDocSnap.data();
      const companyHourlyRate = companyData?.hourlyRate || 0;

      // Werknemers voor dit bedrijf
      const companyEmployees = employees.filter(
        e => e.companyId === selectedCompany.id || e.userId === adminUserId
      );
      const activeEmps = companyEmployees.filter(e => e.status === 'active');

      // Loonkosten: gemiddeld €3k per actieve medewerker per maand
      const estimatedMonthlyPayroll = activeEmps.length * AVERAGE_MONTHLY_COST_PER_EMPLOYEE;

      // Production weeks (productie) - Load production hours with correct filtering
      const productionWeeksQuery = query(
        collection(db, 'productionWeeks'),
        where('userId', '==', adminUserId),
        where('companyId', '==', selectedCompany.id),
        where('year', '==', selectedYear)
      );
      const productionWeeksSnap = await getDocs(productionWeeksQuery);
      let totalHours = 0;
      let totalOvertime = 0;
      const employeeHoursMap = new Map<string, number>();

      productionWeeksSnap.forEach(doc => {
        const data = doc.data();
        // Filter op kwartaal (week moet in geselecteerd kwartaal vallen)
        if (!isWeekInQuarter(data.week, selectedQuarter)) return;

        const hours = data.totalHours || 0;
        totalHours += hours;
        totalOvertime += data.overtimeHours || 0;

        if (data.employeeId) {
          employeeHoursMap.set(
            data.employeeId,
            (employeeHoursMap.get(data.employeeId) || 0) + hours
          );
        }
      });

      // Bereken productiewaarde op basis van gefilterde uren
      const productionValue = totalHours * companyHourlyRate;

      // Sick leave (ziekteverzuim) - filter op companyId
      const sickLeaveQuery = query(
        collection(db, 'sickLeave'),
        where('userId', '==', adminUserId)
      );
      const sickLeaveSnap = await getDocs(sickLeaveQuery);
      let totalSickDays = 0;
      let activeSickCount = 0;
      const sickEmpList: any[] = [];
      const now = new Date();

      sickLeaveSnap.forEach(doc => {
        const data = doc.data();
        if (data.companyId !== selectedCompany.id) return;
        if (!data.startDate) return;

        const start = data.startDate?.toDate ? data.startDate.toDate() : new Date(data.startDate);
        if (isNaN(start.getTime())) return;

        // Filter op jaar/kwartaal: ziekmelding moet overlap hebben met geselecteerde periode
        if (!isInQuarter(start, selectedYear, selectedQuarter)) {
          // Check of het een actieve ziekmelding is die doorloopt in de geselecteerde periode
          if (data.status !== 'active' && data.status !== 'partially_recovered') return;
        }

        const end = data.endDate
          ? (data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate))
          : now;
        const endTime = isNaN(end.getTime()) ? now.getTime() : end.getTime();

        const days = Math.max(1, Math.ceil((endTime - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        totalSickDays += days;

        if (data.status === 'active' || data.status === 'partially_recovered') {
          activeSickCount++;
          const emp = companyEmployees.find(e => e.id === data.employeeId);
          const activeDays = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          sickEmpList.push({
            id: doc.id,
            employeeName: emp
              ? `${emp.personalInfo?.firstName || ''} ${emp.personalInfo?.lastName || ''}`.trim()
              : 'Onbekend',
            startDate: start,
            days: activeDays,
            status: data.status,
            capacity: data.workCapacityPercentage || 0,
          });
        }
      });

      setSickEmployees(sickEmpList.sort((a, b) => b.days - a.days));

      const sickPercentage = activeEmps.length > 0
        ? (activeSickCount / activeEmps.length) * 100
        : 0;

      // Leave requests (verlofaanvragen) - filter op companyId + jaar/kwartaal
      const leaveQuery = query(
        collection(db, 'leaveRequests'),
        where('userId', '==', adminUserId)
      );
      const leaveSnap = await getDocs(leaveQuery);
      let totalLeaveRequests = 0;
      let approvedLeave = 0;
      leaveSnap.forEach(doc => {
        const data = doc.data();
        if (data.companyId !== selectedCompany.id) return;

        const leaveDate = data.startDate?.toDate?.() || (data.startDate ? new Date(data.startDate) : null);
        if (leaveDate && !isInQuarter(leaveDate, selectedYear, selectedQuarter)) return;

        totalLeaveRequests++;
        if (data.status === 'approved') approvedLeave++;
      });

      // Outgoing invoices (omzet) - met jaar/kwartaal filter
      const outgoingQuery = query(
        collection(db, 'outgoingInvoices'),
        where('userId', '==', adminUserId),
        where('companyId', '==', selectedCompany.id)
      );
      const outgoingSnap = await getDocs(outgoingQuery);
      let totalRevenue = 0;
      const monthlyRevenueMap = new Map<string, number>();

      outgoingSnap.forEach(doc => {
        const data = doc.data();
        const invoiceDate = data.invoiceDate?.toDate?.() || new Date(data.invoiceDate);

        if (!isInQuarter(invoiceDate, selectedYear, selectedQuarter)) return;

        totalRevenue += data.totalAmount || 0;
        const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenueMap.set(monthKey, (monthlyRevenueMap.get(monthKey) || 0) + (data.totalAmount || 0));
      });

      // Incoming invoices (kosten) - met jaar/kwartaal filter
      const incomingQuery = query(
        collection(db, 'incomingInvoices'),
        where('userId', '==', adminUserId),
        where('companyId', '==', selectedCompany.id)
      );
      const incomingSnap = await getDocs(incomingQuery);
      let totalCosts = 0;
      const monthlyCostsMap = new Map<string, number>();

      incomingSnap.forEach(doc => {
        const data = doc.data();
        const invoiceDate = data.invoiceDate?.toDate?.() || new Date(data.invoiceDate);

        if (!isInQuarter(invoiceDate, selectedYear, selectedQuarter)) return;

        totalCosts += data.totalAmount || 0;
        const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
        monthlyCostsMap.set(monthKey, (monthlyCostsMap.get(monthKey) || 0) + (data.totalAmount || 0));
      });

      setStats({
        totalEmployees: companyEmployees.length,
        activeEmployees: activeEmps.length,
        totalHours,
        totalOvertime,
        estimatedMonthlyPayroll,
        totalSickDays,
        activeSickCount,
        sickPercentage,
        totalLeaveRequests,
        approvedLeave,
        totalRevenue,
        totalCosts,
        productionValue,
        hourlyRate: companyHourlyRate,
      });

      // Maandelijkse data voor chart
      const allMonthKeys = new Set([
        ...Array.from(monthlyRevenueMap.keys()),
        ...Array.from(monthlyCostsMap.keys()),
      ]);
      const monthlyChartData = Array.from(allMonthKeys)
        .sort()
        .map(monthKey => ({
          month: monthKey,
          omzet: monthlyRevenueMap.get(monthKey) || 0,
          kosten: monthlyCostsMap.get(monthKey) || 0,
          loonkosten: estimatedMonthlyPayroll,
        }));
      setMonthlyData(monthlyChartData);

      // Uren per werknemer
      const empHoursData = companyEmployees
        .map(emp => ({
          name: `${emp.personalInfo?.firstName || ''} ${emp.personalInfo?.lastName || ''}`.trim() || 'Onbekend',
          uren: employeeHoursMap.get(emp.id) || 0,
        }))
        .filter(e => e.uren > 0)
        .sort((a, b) => b.uren - a.uren)
        .slice(0, 10);
      setEmployeeHoursData(empHoursData);
    } catch (error) {
      console.error('Error loading employer statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <p className="text-gray-500 dark:text-gray-300">Selecteer een employer bedrijf om statistieken te bekijken.</p>
      </div>
    );
  }

  if (selectedCompany.companyType !== 'employer') {
    return (
      <div className="p-6">
        <p className="text-gray-500 dark:text-gray-300">Deze pagina is alleen beschikbaar voor employer bedrijven.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const profit = stats.totalRevenue - stats.totalCosts;

  return (
    <div className="space-y-5">
      <PageHeader title="Werkgeverstatistieken" subtitle={`Overzicht van ${selectedCompany.name}`} emoji="📈" />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatTile label="Werknemers"    value={stats.activeEmployees}                        sub={`van ${stats.totalEmployees} totaal`}                                          emoji="👥" tone="sky" />
        <StatTile label="Totaal uren"   value={stats.totalHours.toLocaleString('nl-NL')}     sub={stats.totalOvertime > 0 ? `+${stats.totalOvertime.toFixed(0)} overuren` : 'productie uren'} emoji="⏱️" tone="purple" />
        <StatTile label="Productiewaarde" value={formatCurrency(stats.productionValue)}      sub={stats.hourlyRate > 0 ? `€${stats.hourlyRate}/uur` : 'geen tarief'}             emoji="🏭" tone="bronze" />
        <StatTile label="Loonkosten /mnd" value={formatCurrency(stats.estimatedMonthlyPayroll)} sub={`~€${AVERAGE_MONTHLY_COST_PER_EMPLOYEE.toLocaleString('nl-NL')} p.p.`}     emoji="💰" tone="emerald" />
        <StatTile label="Ziekteverzuim"   value={`${(stats.sickPercentage || 0).toFixed(1)}%`} sub={`${stats.activeSickCount} ziek · ${stats.totalSickDays} dagen totaal`}      emoji="🏥" tone={stats.sickPercentage > 5 ? 'red' : 'amber'} />
      </div>

      {/* Financieel Overzicht */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-200 truncate">Totale Omzet</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1 break-words">
              €{stats.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>

        <Card>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-200 truncate">Totale Kosten</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600 mt-1 break-words">
              €{stats.totalCosts.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>

        <Card>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-200 truncate">Winst</p>
            <p className={`text-xl sm:text-2xl font-bold mt-1 break-words ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{profit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>
      </div>

      {/* Actief Zieke Medewerkers */}
      {sickEmployees.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Actief Zieke Medewerkers ({sickEmployees.length})
          </h2>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {sickEmployees.map((emp) => (
              <div key={emp.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{emp.employeeName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-300">
                    Sinds {emp.startDate.toLocaleDateString('nl-NL')} • {emp.days} dagen
                    {emp.days > 42 && <span className="text-orange-600 font-medium ml-1">(Poortwachter)</span>}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    emp.status === 'active' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  }`}>
                    {emp.status === 'active' ? 'Ziek' : 'Gedeeltelijk'}
                  </span>
                  {emp.capacity > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">{emp.capacity}% inzetbaar</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Maandelijkse Omzet vs Kosten */}
      {monthlyData.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Maandelijkse Omzet vs Kosten</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `€${value.toLocaleString('nl-NL')}`} />
              <Tooltip formatter={(value) => `€${Number(value).toLocaleString('nl-NL')}`} />
              <Legend />
              <Line type="monotone" dataKey="omzet" stroke="#10B981" name="Omzet" strokeWidth={2} />
              <Line type="monotone" dataKey="kosten" stroke="#EF4444" name="Kosten" strokeWidth={2} />
              <Line type="monotone" dataKey="loonkosten" stroke="#F59E0B" name="Loonkosten" strokeWidth={2} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Top 10 Werknemers (Uren) */}
      {employeeHoursData.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Top 10 Werknemers (Gewerkte Uren)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={employeeHoursData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="uren" fill="#3B82F6" name="Uren" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Verlof Overzicht */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Verlof & Verzuim Overzicht</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-gray-700 rounded-lg">
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.totalLeaveRequests}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Verlofaanvragen</p>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-gray-700 rounded-lg">
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.approvedLeave}</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">Goedgekeurd</p>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-gray-700 rounded-lg">
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.totalSickDays}</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Ziektedagen</p>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-gray-700 rounded-lg">
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{stats.activeSickCount}</p>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Nu ziek</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default EmployerStatistics;
