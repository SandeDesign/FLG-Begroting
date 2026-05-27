import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/layout/Layout';
import EmployeeLayout from './components/layout/EmployeeLayout';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import EmployeesNew from './pages/EmployeesNew';
import Leave from './pages/Leave';
import Absence from './pages/Absence';
import Expenses from './pages/Expenses';
import AdminLeaveApprovals from './pages/AdminLeaveApprovals';
import AdminAbsenceManagement from './pages/AdminAbsenceManagement';
import InvestmentPitch from './pages/InvestmentPitch';
import ProjectProduction from './pages/ProjectProduction';
import CompaniesVisibilitySettings from '../components/settings/CompaniesVisibilitySettings';
import ProjectStatistics from './pages/ProjectStatistics';

// Wrapper for InvestmentPitch that conditionally applies Layout
const InvestmentPitchWrapper: React.FC = () => {
  const isFrameMode = new URLSearchParams(window.location.search).get('mode') === 'frame';

  if (isFrameMode) {
    // Frame mode: No Layout
    return <InvestmentPitch />;
  }

  // Normal mode: With Layout
  return (
    <Layout>
      <InvestmentPitch />
    </Layout>
  );
};
// ✅ STATISTICS PAGES
import EmployerStatistics from './pages/EmployerStatistics';
import HoldingStatistics from './pages/HoldingStatistics';
// ✅ NEW ADMIN PAGES
import AdminDashboard from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import BoekhouderDashboard from './pages/boekhouder/Dashboard';
import BoekhouderInvoiceRelations from './pages/boekhouder/InvoiceRelations';
import BoekhouderOutgoingInvoices from './pages/boekhouder/OutgoingInvoices';
import BoekhouderIncomingInvoicesStats from './pages/boekhouder/IncomingInvoicesStats';
import BoekhouderBankStatementImport from './pages/boekhouder/BankStatementImport';
import BoekhouderGrootboekrekeningen from './pages/boekhouder/Grootboekrekeningen';
import BoekhouderBtwOverzicht from './pages/boekhouder/BtwOverzicht';
import BoekhouderExpenses from './pages/boekhouder/Expenses';
import BoekhouderUpload from './pages/boekhouder/Upload';
import BoekhouderSettings from './pages/boekhouder/Settings';
import BoekhouderPayslipUpload from './pages/boekhouder/PayslipUpload';
import AdminExpenses from './pages/AdminExpenses';
import AdminUsers from './pages/AdminUsers';
import AdminRoles from './pages/AdminRoles';
import Chat from './pages/Chat';
import BoekhouderChat from './pages/boekhouder/Chat';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import NotFound from './pages/NotFound';
import Settings from './pages/Settings';
import AuditLogPage from './pages/AuditLog';
import Timesheets from './pages/Timesheets';
import TimesheetApprovals from './pages/TimesheetApprovals';
import Payslips from './pages/Payslips';
// ✅ INVOICE RELATIONS - NIEUW!
import InvoiceRelations from './pages/InvoiceRelations';
// ✅ FACTUREN IMPORTS
import OutgoingInvoices from './pages/OutgoingInvoices';
import Upload from './pages/Upload';
// ✅ INCOMING INVOICES STATS - NIEUW!
import IncomingInvoicesStats from './pages/IncomingInvoicesStats';
// ✅ BUDGETING - NIEUW!
import Budgeting from './pages/Budgeting';
import TimesheetExport from './pages/TimesheetExport';
import Tasks from './pages/Tasks';
// ✅ BANK STATEMENT IMPORT - NIEUW!
import BankStatementImport from './pages/BankStatementImport';
import Grootboekrekeningen from './pages/Grootboekrekeningen';
import BtwOverzicht from './pages/BtwOverzicht';
import InternalProjects from './pages/InternalProjects';
import EmployeeAgenda from './pages/EmployeeAgenda';
import EmployeeTasks from './pages/EmployeeTasks';
import AutoBeheer from './pages/AutoBeheer';
import EmployeeVehicle from './pages/EmployeeVehicle';
import { AppProvider } from './contexts/AppContext';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { PageTitleProvider } from './contexts/PageTitleContext';
import { ToastContainer } from './components/ui/Toast';
import EmployeeDashboard from './pages/EmployeeDashboard';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import AppUpdateModal from './components/AppUpdateModal';

function App() {
  const AppContent: React.FC = () => {
    const { userRole, loading } = useAuth();
    const [showUpdate, setShowUpdate] = useState(false);
    const [updateReg, setUpdateReg] = useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
      const handler = (e: Event) => {
        const reg = (e as CustomEvent<{ reg: ServiceWorkerRegistration }>).detail.reg;
        setUpdateReg(reg);
        setShowUpdate(true);
      };
      window.addEventListener('swUpdateAvailable', handler);
      return () => window.removeEventListener('swUpdateAvailable', handler);
    }, []);

    if (loading) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      );
    }

    return (
      <>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/Logo.png" element={<Navigate to="/Logo.png" replace />} />
        <Route path="/Logo-groot.png" element={<Navigate to="/Logo-groot.png" replace />} />
        
        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Routes>
                {/* ✅ FRAME MODE ROUTES (No Layout) */}
                <Route path="/investment-pitch" element={<InvestmentPitchWrapper />} />

                {/* ✅ ADMIN & CO-ADMIN ROUTES */}
                {(userRole === 'admin' || userRole === 'co-admin') && (
                  <Route
                    path="/*"
                    element={
                      <Layout>
                        <Routes>
                          <Route index element={<Dashboard />} />
                          <Route path="companies" element={<Companies />} />
                          <Route path="employees" element={<EmployeesNew />} />
                          <Route path="project-production" element={<ProjectProduction />} />
                          <Route path="project-statistics" element={<ProjectStatistics />} />

                          {/* ✅ STATISTICS ROUTES */}
                          <Route path="statistics/employer" element={<EmployerStatistics />} />
                          <Route path="statistics/project" element={<ProjectStatistics />} />
                          <Route path="statistics/holding" element={<HoldingStatistics />} />

                          {/* ✅ NEW ADMIN ROUTES */}
                          <Route path="admin/dashboard" element={<AdminDashboard />} />
                          <Route path="admin/users" element={<AdminUsers />} />
                          <Route path="admin/roles" element={<AdminRoles />} />
                          
                          {/* ✅ TIJD & UREN */}
                          <Route path="timesheets" element={<Timesheets />} />
                          <Route path="timesheet-approvals" element={<TimesheetApprovals />} />
                          <Route path="internal-projects" element={<InternalProjects />} />
                          <Route path="auto-beheer" element={<AutoBeheer />} />
                          <Route path="vehicle" element={<EmployeeVehicle />} />
                          <Route path="admin-expenses" element={<AdminExpenses />} />

                          {/* ✅ VERLOF & VERZUIM */}
                          <Route path="admin/leave-approvals" element={<AdminLeaveApprovals />} />
                          <Route path="admin/absence-management" element={<AdminAbsenceManagement />} />
                          
                          {/* ✅ FACTURATIE - MET RELATIES EN STATISTIEKEN! */}
                          <Route path="invoice-relations" element={<InvoiceRelations />} />
                          <Route path="budgeting" element={<Budgeting />} />
                          <Route path="outgoing-invoices" element={<OutgoingInvoices />} />
                          <Route path="upload" element={<Upload />} />
                          {/* Backwards-compat redirects for old URLs and iframes */}
                          <Route path="incoming-invoices" element={<Navigate to="/upload?tab=facturen" replace />} />
                          <Route path="incoming-post" element={<Navigate to="/upload?tab=post" replace />} />
                          {/* ✅ NEW ROUTE - Incoming Invoices Stats Dashboard */}
                          <Route path="incoming-invoices-stats" element={<IncomingInvoicesStats />} />
                          {/* ✅ NEW ROUTE - Bank Statement Import */}
                          <Route path="bank-statement-import" element={<BankStatementImport />} />
                          <Route path="grootboekrekeningen" element={<Grootboekrekeningen />} />
                          <Route path="btw-overzicht" element={<BtwOverzicht />} />
                          
                          {/* ✅ DATA & EXPORTS */}
                          <Route path="timesheet-export" element={<TimesheetExport />} />
                          
                          {/* ✅ SYSTEEM */}
                          <Route path="tasks" element={<Tasks />} />
                          <Route path="payslips" element={<Payslips />} />
                          <Route path="audit-log" element={<AuditLogPage />} />
                          <Route path="chat" element={<Chat />} />
                          <Route path="settings" element={<Settings />} />
                          
                          <Route path="employee-dashboard/*" element={<Navigate to="/" replace />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Layout>
                    }
                  />
                )}

                {/* ✅ MANAGER ROUTES */}
                {userRole === 'manager' && (
                  <Route
                    path="/*"
                    element={
                      <Layout>
                        <Routes>
                          <Route index element={<ManagerDashboard />} />
                          <Route path="employees" element={<EmployeesNew />} />

                          {/* Manager kan productie beheren */}
                          <Route path="project-production" element={<ProjectProduction />} />

                          {/* Manager kan interne projecten inzien (read-only) */}
                          <Route path="internal-projects" element={<InternalProjects />} />
                          <Route path="auto-beheer" element={<AutoBeheer />} />
                          <Route path="vehicle" element={<EmployeeVehicle />} />

                          {/* ✅ STATISTICS ROUTES */}
                          <Route path="statistics/employer" element={<EmployerStatistics />} />
                          <Route path="statistics/project" element={<ProjectStatistics />} />
                          <Route path="statistics/holding" element={<HoldingStatistics />} />

                          {/* Manager kan uren beheren */}
                          <Route path="timesheets" element={<Timesheets />} />
                          <Route path="timesheet-approvals" element={<TimesheetApprovals />} />

                          {/* Manager kan verlof/verzuim goedkeuren */}
                          <Route path="admin/leave-approvals" element={<AdminLeaveApprovals />} />
                          <Route path="admin/absence-management" element={<AdminAbsenceManagement />} />

                          {/* Manager self-service: eigen verlof, verzuim, declaraties en loonstroken */}
                          <Route path="leave" element={<Leave />} />
                          <Route path="absence" element={<Absence />} />
                          <Route path="expenses" element={<Expenses />} />
                          <Route path="payslips" element={<Payslips />} />

                          {/* Manager kan facturatie beheren — géén inkoop, géén upload */}
                          <Route path="invoice-relations" element={<InvoiceRelations />} />
                          <Route path="budgeting" element={<Budgeting />} />
                          <Route path="outgoing-invoices" element={<OutgoingInvoices />} />
                          {/* Upload volledig dichtgezet voor manager — redirect naar dashboard */}
                          <Route path="upload" element={<Navigate to="/" replace />} />
                          {/* Inkoop-routes verborgen voor manager — redirect naar dashboard */}
                          <Route path="incoming-invoices" element={<Navigate to="/" replace />} />
                          <Route path="incoming-invoices-stats" element={<Navigate to="/" replace />} />

                          {/* Manager kan exporteren */}
                          <Route path="timesheet-export" element={<TimesheetExport />} />

                          {/* Manager systeem */}
                          <Route path="tasks" element={<Tasks />} />
                          <Route path="settings" element={<Settings />} />

                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Layout>
                    }
                  />
                )}

                {/* ✅ BOEKHOUDER ROUTES — eigen /boekhouder/* prefix */}
                {userRole === 'boekhouder' && (
                  <Route
                    path="/*"
                    element={
                      <Layout>
                        <Routes>
                          {/* Root → boekhouder dashboard */}
                          <Route index element={<Navigate to="/boekhouder" replace />} />

                          {/* Boekhouder eigen pagina's */}
                          <Route path="boekhouder" element={<BoekhouderDashboard />} />
                          <Route path="boekhouder/invoice-relations" element={<BoekhouderInvoiceRelations />} />
                          <Route path="boekhouder/outgoing-invoices" element={<BoekhouderOutgoingInvoices />} />
                          <Route path="boekhouder/incoming-invoices-stats" element={<BoekhouderIncomingInvoicesStats />} />
                          <Route path="boekhouder/bank-statement-import" element={<BoekhouderBankStatementImport />} />
                          <Route path="boekhouder/grootboekrekeningen" element={<BoekhouderGrootboekrekeningen />} />
                          <Route path="boekhouder/btw-overzicht" element={<BoekhouderBtwOverzicht />} />
                          <Route path="boekhouder/admin-expenses" element={<BoekhouderExpenses />} />
                          <Route path="boekhouder/upload" element={<BoekhouderUpload />} />
                          <Route path="boekhouder/settings" element={<BoekhouderSettings />} />
                          <Route path="boekhouder/chat" element={<BoekhouderChat />} />
                          <Route path="boekhouder/payslip-upload" element={<BoekhouderPayslipUpload />} />
                          <Route path="boekhouder/tasks" element={<Tasks />} />
                          <Route path="boekhouder/incoming-invoices" element={<Navigate to="/boekhouder/upload?tab=facturen" replace />} />
                          <Route path="boekhouder/incoming-post" element={<Navigate to="/boekhouder/upload?tab=post" replace />} />

                          {/* Backwards-compat: oude paden redirecten naar /boekhouder/* */}
                          <Route path="invoice-relations" element={<Navigate to="/boekhouder/invoice-relations" replace />} />
                          <Route path="outgoing-invoices" element={<Navigate to="/boekhouder/outgoing-invoices" replace />} />
                          <Route path="incoming-invoices-stats" element={<Navigate to="/boekhouder/incoming-invoices-stats" replace />} />
                          <Route path="bank-statement-import" element={<Navigate to="/boekhouder/bank-statement-import" replace />} />
                          <Route path="grootboekrekeningen" element={<Navigate to="/boekhouder/grootboekrekeningen" replace />} />
                          <Route path="btw-overzicht" element={<Navigate to="/boekhouder/btw-overzicht" replace />} />
                          <Route path="admin-expenses" element={<Navigate to="/boekhouder/admin-expenses" replace />} />
                          <Route path="upload" element={<Navigate to="/boekhouder/upload" replace />} />
                          <Route path="incoming-invoices" element={<Navigate to="/boekhouder/upload?tab=facturen" replace />} />
                          <Route path="incoming-post" element={<Navigate to="/boekhouder/upload?tab=post" replace />} />
                          <Route path="settings" element={<Navigate to="/boekhouder/settings" replace />} />
                          <Route path="chat" element={<Navigate to="/boekhouder/chat" replace />} />

                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Layout>
                    }
                  />
                )}

                {/* ✅ EMPLOYEE ROUTES */}
                {userRole === 'employee' && (
                  <>
                    <Route path="/" element={<Navigate to="/employee-dashboard" replace />} />
                    <Route
                      path="/employee-dashboard/*"
                      element={
                        <EmployeeLayout>
                          <Routes>
                            <Route index element={<EmployeeDashboard />} />
                            <Route path="leave" element={<Leave />} />
                            <Route path="absence" element={<Absence />} />
                            <Route path="expenses" element={<Expenses />} />
                            <Route path="timesheets" element={<Timesheets />} />
                            <Route path="agenda" element={<EmployeeAgenda />} />
                            <Route path="tasks" element={<EmployeeTasks />} />
                            <Route path="vehicle" element={<EmployeeVehicle />} />
                            <Route path="payslips" element={<Payslips />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </EmployeeLayout>
                      }
                    />
                  </>
                )}
                
                {!userRole && (
                  <Route path="*" element={<LoadingSpinner />} />
                )}
              </Routes>
            </ProtectedRoute>
          }
        />
      </Routes>
      {showUpdate && (
        <AppUpdateModal reg={updateReg} onDismiss={() => setShowUpdate(false)} />
      )}
      </>
    );
  };

  return (
    <AuthProvider>
      <DarkModeProvider>
        <AppProvider>
          <PageTitleProvider>
            <Router>
              <div className="App">
                <AppContent />
                <ToastContainer />
              </div>
            </Router>
          </PageTitleProvider>
        </AppProvider>
      </DarkModeProvider>
    </AuthProvider>
  );
}

export default App;