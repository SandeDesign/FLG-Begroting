import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Factory, Euro, TrendingUp, Package, Clock } from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { usePageTitle } from '../contexts/PageTitleContext';

import { isInQuarter, isWeekInQuarter } from '../utils/dateFilters';

const ProjectStatistics: React.FC = () => {
  const { selectedCompany, queryUserId, selectedYear, selectedQuarter, employees } = useApp();
  const { user } = useAuth();
  usePageTitle('Projectstatistieken');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProductionHours: 0,
    totalOvertime: 0,
    totalRevenue: 0,
    totalCosts: 0,
    totalInvoices: 0,
    hourlyRate: 0,
    productionValue: 0,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [employeeProduction, setEmployeeProduction] = useState<Array<{ employeeId: string; name: string; totalHours: number; totalWeeks: number; value: number }>>([]);
  const [weeklyProduction, setWeeklyProduction] = useState<Array<{ week: number; employeeId: string; name: string; hours: number; value: number }>>([]);

  useEffect(() => {
    if (!selectedCompany || !queryUserId || selectedCompany.companyType !== 'project') {
      setLoading(false);
      return;
    }

    loadProjectStatistics();
  }, [selectedCompany, queryUserId, selectedYear, selectedQuarter]);

  const loadProjectStatistics = async () => {
    if (!queryUserId || !selectedCompany) return;

    setLoading(true);
    try {
      // Vers uurtarief ophalen uit Firestore
      const companyDocSnap = await getDoc(doc(db, 'companies', selectedCompany.id));
      const companyData = companyDocSnap.data();
      const companyHourlyRate = companyData?.hourlyRate || 0;

      // Production weeks (productie) - Load all production hours for this company
      const productionWeeksQuery = query(
        collection(db, 'productionWeeks'),
        where('userId', '==', queryUserId),
        where('companyId', '==', selectedCompany.id),
        where('year', '==', selectedYear) // ✅ YEAR FILTERING: Only load selected year
      );
      const productionWeeksSnap = await getDocs(productionWeeksQuery);
      let totalHours = 0;
      let totalOvertime = 0;

      // Groepeer productie per medewerker en per week
      const empMap = new Map<string, { totalHours: number; weeks: Set<number> }>();
      const weekList: Array<{ week: number; employeeId: string; hours: number }> = [];

      productionWeeksSnap.forEach(doc => {
        const data = doc.data();
        if (!isWeekInQuarter(data.week, selectedQuarter)) return;

        const hours = data.totalHours || 0;
        totalHours += hours;

        const empId = data.employeeId || 'onbekend';
        const existing = empMap.get(empId) || { totalHours: 0, weeks: new Set<number>() };
        existing.totalHours += hours;
        existing.weeks.add(data.week);
        empMap.set(empId, existing);

        weekList.push({ week: data.week, employeeId: empId, hours });
      });

      // Outgoing invoices (omzet)
      const outgoingQuery = query(
        collection(db, 'outgoingInvoices'),
        where('userId', '==', queryUserId),
        where('companyId', '==', selectedCompany.id)
      );
      const outgoingSnap = await getDocs(outgoingQuery);
      let totalRevenue = 0;
      const monthlyRevenueMap = new Map<string, number>();
      const monthlyHoursMap = new Map<string, number>();

      outgoingSnap.forEach(doc => {
        const data = doc.data();
        const invoiceDate = data.invoiceDate?.toDate?.() || new Date(data.invoiceDate);

        if (!isInQuarter(invoiceDate, selectedYear, selectedQuarter)) return;

        totalRevenue += data.totalAmount || 0;

        const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenueMap.set(monthKey, (monthlyRevenueMap.get(monthKey) || 0) + (data.totalAmount || 0));
      });

      // Incoming invoices (kosten)
      const incomingQuery = query(
        collection(db, 'incomingInvoices'),
        where('userId', '==', queryUserId),
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

      // Production weeks per maand tellen
      productionWeeksSnap.forEach(doc => {
        const data = doc.data();
        if (!isWeekInQuarter(data.week, selectedQuarter)) return;
        const approximateMonth = Math.ceil((data.week || 1) / 4.33);
        const monthKey = `${data.year}-${String(approximateMonth).padStart(2, '0')}`;
        const hours = data.totalHours || 0;
        monthlyHoursMap.set(monthKey, (monthlyHoursMap.get(monthKey) || 0) + hours);
      });

      const productionValue = totalHours * companyHourlyRate * 1.21;

      const totalInvoicesForPeriod = Array.from(outgoingSnap.docs).filter(doc => {
        const data = doc.data();
        const invoiceDate = data.invoiceDate?.toDate?.() || new Date(data.invoiceDate);
        return isInQuarter(invoiceDate, selectedYear, selectedQuarter);
      }).length;

      setStats({
        totalProductionHours: totalHours,
        totalOvertime,
        totalRevenue,
        totalCosts,
        totalInvoices: totalInvoicesForPeriod,
        hourlyRate: companyHourlyRate,
        productionValue,
      });

      // Maandelijkse data voor chart
      const allMonthKeys = new Set([
        ...Array.from(monthlyRevenueMap.keys()),
        ...Array.from(monthlyCostsMap.keys()),
        ...Array.from(monthlyHoursMap.keys()),
      ]);
      const monthlyChartData = Array.from(allMonthKeys)
        .sort()
        .map(monthKey => ({
          month: monthKey,
          omzet: monthlyRevenueMap.get(monthKey) || 0,
          kosten: monthlyCostsMap.get(monthKey) || 0,
          uren: monthlyHoursMap.get(monthKey) || 0,
        }));
      setMonthlyData(monthlyChartData);

      // Productie per medewerker
      const getEmployeeName = (empId: string) => {
        const emp = employees.find(e => e.id === empId);
        return emp ? `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}` : empId;
      };

      const empProduction = Array.from(empMap.entries()).map(([empId, data]) => ({
        employeeId: empId,
        name: getEmployeeName(empId),
        totalHours: data.totalHours,
        totalWeeks: data.weeks.size,
        value: data.totalHours * companyHourlyRate * 1.21,
      })).sort((a, b) => b.totalHours - a.totalHours);
      setEmployeeProduction(empProduction);

      // Productie per week per medewerker
      const weekProd = weekList.map(w => ({
        ...w,
        name: getEmployeeName(w.employeeId),
        value: w.hours * companyHourlyRate * 1.21,
      })).sort((a, b) => a.week - b.week || a.name.localeCompare(b.name));
      setWeeklyProduction(weekProd);
    } catch (error) {
      console.error('❌ Error loading project statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <p className="text-gray-500 dark:text-gray-300">Selecteer een project bedrijf om statistieken te bekijken.</p>
      </div>
    );
  }

  if (selectedCompany.companyType !== 'project') {
    return (
      <div className="p-6">
        <p className="text-gray-500 dark:text-gray-300">Deze pagina is alleen beschikbaar voor project bedrijven.</p>
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
  const profitMargin = stats.totalRevenue > 0 ? (profit / stats.totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Projectstatistieken</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">Overzicht van {selectedCompany.name}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Productie Uren</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {stats.totalProductionHours.toLocaleString('nl-NL')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                {stats.totalOvertime > 0 && `+${stats.totalOvertime.toFixed(0)} overuren`}
              </p>
            </div>
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Totale Omzet</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                €{stats.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">{stats.totalInvoices} facturen</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Winstmarge</p>
              <p className={`text-2xl font-bold mt-1 ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profitMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                €{profit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })} winst
              </p>
            </div>
            <Factory className={`h-8 w-8 ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </Card>
      </div>

      {/* Financieel Overzicht */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Verkoop (Omzet)</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              €{stats.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>

        <Card>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Inkoop (Kosten)</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              €{stats.totalCosts.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>

        <Card>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Netto Winst</p>
            <p className={`text-2xl font-bold mt-1 ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{profit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>
      </div>

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
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Maandelijkse Productie Uren */}
      {monthlyData.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Maandelijkse Productie Uren</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="uren" fill="#3B82F6" name="Productie Uren" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Project Performance Indicatoren */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Performance Indicatoren</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 dark:bg-gray-700 p-4 rounded-lg">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-300">Uurtarief</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              €{stats.hourlyRate.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">excl. BTW</p>
          </div>
          <div className="bg-green-50 dark:bg-gray-700 p-4 rounded-lg">
            <p className="text-sm font-medium text-green-900 dark:text-green-300">Productie Waarde (incl. BTW)</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              €{stats.productionValue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-green-700 dark:text-green-400 mt-1">{stats.totalProductionHours.toLocaleString('nl-NL')} uur × €{stats.hourlyRate.toLocaleString('nl-NL', { minimumFractionDigits: 2 })} excl. BTW</p>
          </div>
          <div className="bg-purple-50 dark:bg-gray-700 p-4 rounded-lg">
            <p className="text-sm font-medium text-purple-900 dark:text-purple-300">Winstmarge</p>
            <p className={`text-2xl font-bold mt-2 ${profitMargin >= 0 ? 'text-purple-600' : 'text-red-600'}`}>{profitMargin.toFixed(1)}%</p>
            <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">€{profit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })} winst</p>
          </div>
        </div>
      </Card>

      {/* Productie per Medewerker */}
      {employeeProduction.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Productie per Medewerker</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-gray-200">Medewerker</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-200">Weken</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-200">Uren</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-200">Waarde (incl. BTW)</th>
                </tr>
              </thead>
              <tbody>
                {employeeProduction.map((emp) => (
                  <tr key={emp.employeeId} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-2 text-gray-900 dark:text-gray-100">{emp.name}</td>
                    <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-300">{emp.totalWeeks}</td>
                    <td className="py-2 px-2 text-right font-medium text-gray-900 dark:text-gray-100">{emp.totalHours.toLocaleString('nl-NL', { minimumFractionDigits: 1 })}</td>
                    <td className="py-2 px-2 text-right font-medium text-green-600">€{emp.value.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-semibold">
                  <td className="py-2 px-2 text-gray-900 dark:text-gray-100">Totaal</td>
                  <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-300"></td>
                  <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">{employeeProduction.reduce((s, e) => s + e.totalHours, 0).toLocaleString('nl-NL', { minimumFractionDigits: 1 })}</td>
                  <td className="py-2 px-2 text-right text-green-600">€{employeeProduction.reduce((s, e) => s + e.value, 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Productie per Periode */}
      {weeklyProduction.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Productie per Periode</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-gray-200">Week</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-gray-200">Medewerker</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-200">Uren</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-200">Waarde (incl. BTW)</th>
                </tr>
              </thead>
              <tbody>
                {weeklyProduction.map((row, i) => (
                  <tr key={`${row.week}-${row.employeeId}-${i}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-2 text-gray-900 dark:text-gray-100">Week {row.week}</td>
                    <td className="py-2 px-2 text-gray-600 dark:text-gray-300">{row.name}</td>
                    <td className="py-2 px-2 text-right font-medium text-gray-900 dark:text-gray-100">{row.hours.toLocaleString('nl-NL', { minimumFractionDigits: 1 })}</td>
                    <td className="py-2 px-2 text-right font-medium text-green-600">€{row.value.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-semibold">
                  <td className="py-2 px-2 text-gray-900 dark:text-gray-100">Totaal</td>
                  <td className="py-2 px-2"></td>
                  <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">{weeklyProduction.reduce((s, r) => s + r.hours, 0).toLocaleString('nl-NL', { minimumFractionDigits: 1 })}</td>
                  <td className="py-2 px-2 text-right text-green-600">€{weeklyProduction.reduce((s, r) => s + r.value, 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Geen werknemers notitie */}
      <Card>
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
          <Package className="h-5 w-5" />
          <p className="text-sm">
            <strong>Let op:</strong> Project bedrijven hebben geen eigen personeel in dienst.
            Productie uren worden geregistreerd door werknemers van gekoppelde employer bedrijven.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ProjectStatistics;
