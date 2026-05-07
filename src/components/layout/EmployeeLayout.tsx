import React, { useState, useEffect } from 'react';
import { User, LogOut, Calendar, HeartPulse, Receipt, Clock, Menu, X, Home, Settings, CalendarDays, ListChecks } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { getEmployeeById } from '../../services/firebase';
import Button from '../ui/Button';
import PushPromptBanner from '../notifications/PushPromptBanner';

interface EmployeeLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/employee-dashboard', icon: Home },
  { name: 'Uren', href: '/employee-dashboard/timesheets', icon: Clock },
  { name: 'Agenda', href: '/employee-dashboard/agenda', icon: CalendarDays },
  { name: 'Mijn Taken', href: '/employee-dashboard/tasks', icon: ListChecks },
  { name: 'Declaraties', href: '/employee-dashboard/expenses', icon: Receipt },
  { name: 'Verlof', href: '/employee-dashboard/leave', icon: Calendar },
  { name: 'Verzuim', href: '/employee-dashboard/absence', icon: HeartPulse },
];

// Mobile bottom nav - 4 main items (uren, agenda, declaraties, profiel)
const bottomNavItems = [
  { name: 'Home', href: '/employee-dashboard', icon: Home },
  { name: 'Uren', href: '/employee-dashboard/timesheets', icon: Clock },
  { name: 'Agenda', href: '/employee-dashboard/agenda', icon: CalendarDays },
  { name: 'Taken', href: '/employee-dashboard/tasks', icon: ListChecks },
  { name: 'Profiel', href: '/settings', icon: Settings },
];

const EmployeeLayout: React.FC<EmployeeLayoutProps> = ({ children }) => {
  const { user, signOut, currentEmployeeId } = useAuth();
  const { selectedCompany } = useApp();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [employeeData, setEmployeeData] = useState<any>(null);

  // Load employee data
  useEffect(() => {
    const loadEmployee = async () => {
      if (currentEmployeeId) {
        try {
          const employee = await getEmployeeById(currentEmployeeId);
          setEmployeeData(employee);
        } catch (error) {
          console.error('Error loading employee:', error);
        }
      }
    };
    loadEmployee();
  }, [currentEmployeeId]);

  const getFirstName = () => {
    if (employeeData?.personalInfo?.firstName) {
      return employeeData.personalInfo.firstName;
    }
    return user?.displayName?.split(' ')[0] || 'Gebruiker';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 z-50">
        <img src="/Logo_1.png" alt="FLG-Administratie Logo" className="h-8 w-auto" />
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6 text-gray-600 dark:text-gray-300" />
          ) : (
            <Menu className="h-6 w-6 text-gray-600 dark:text-gray-300" />
          )}
        </button>
      </div>

      <div className="flex h-screen md:h-auto md:min-h-screen">
        {/* Desktop Sidebar */}
        <div
          className={`fixed md:fixed left-0 top-16 md:top-0 h-[calc(100vh-64px)] md:h-screen w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 z-50 md:z-0 overflow-hidden shadow-lg md:shadow-none ${ mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0' }`}
        >
          {/* Logo */}
          <div className="hidden md:flex items-center gap-3 px-6 py-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <img src="/Logo_1.png" alt="FLG-Administratie Logo" className="h-8 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Administratie</h1>
              <p className="text-xs text-gray-500 dark:text-gray-300">{selectedCompany?.name || 'Dashboard'}</p>
            </div>
          </div>

          {/* Navigation - SCROLLABLE */}
          <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto overflow-x-hidden">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold text-base transition-all duration-200 ${ isActive ? 'bg-primary-50 text-primary-600 border-l-4 border-primary-600 shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900 border-l-4 border-transparent hover:text-gray-900 dark:text-gray-100' }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User Info & Logout - STICKY BOTTOM */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3 flex-shrink-0 bg-white dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                  {getFirstName()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-300 truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              onClick={signOut}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-all"
              size="sm"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Uitloggen
            </Button>
          </div>
        </div>

        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 md:hidden z-40 top-16"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
        )}

        {/* Main Content */}
        <main className="flex-1 w-full md:ml-80 mt-16 md:mt-0 pb-24 md:pb-0">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-4">
            <PushPromptBanner />
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40">
        <div className="bg-white dark:bg-gray-800 backdrop-blur-xl border-t border-gray-200 dark:border-gray-700 shadow-2xl">
          <div className="flex justify-around items-center px-2 py-3">
            {bottomNavItems.map(({ href, icon: Icon, name }) => {
              const isActive = location.pathname === href;
              return (
                <NavLink
                  key={href}
                  to={href}
                  className="flex flex-col items-center justify-center flex-1 transition-all duration-300"
                >
                  <div className={`p-3 rounded-2xl transition-all duration-300 ${ isActive ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 dark:text-gray-500' }`}>
                    <Icon size={20} strokeWidth={2.2} />
                  </div>
                  <span className={`text-xs font-semibold mt-1.5 ${ isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300 dark:text-gray-500' }`}>
                    {name}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
};

export default EmployeeLayout;
