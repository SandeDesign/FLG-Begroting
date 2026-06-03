import React, { useState, useEffect } from 'react';
import { User, LogOut, Calendar, HeartPulse, Receipt, Clock, Menu, X, Home, Settings, CalendarDays, ListChecks, Car } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { getEmployeeById } from '../../services/firebase';
import PushPromptBanner from '../notifications/PushPromptBanner';
import WeeklyTasksReminder from '../tasks/WeeklyTasksReminder';

interface EmployeeLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard',  href: '/employee-dashboard',            icon: Home,         emoji: '📊' },
  { name: 'Uren',       href: '/employee-dashboard/timesheets', icon: Clock,        emoji: '⏱️' },
  { name: 'Mijn Taken', href: '/employee-dashboard/tasks',      icon: ListChecks,   emoji: '☑️' },
  { name: 'Declaraties', href: '/employee-dashboard/expenses',  icon: Receipt,      emoji: '🧾' },
  { name: 'Mijn Auto',  href: '/employee-dashboard/vehicle',    icon: Car,          emoji: '🚗' },
  { name: 'Verlof',     href: '/employee-dashboard/leave',      icon: Calendar,     emoji: '🌴' },
  { name: 'Verzuim',    href: '/employee-dashboard/absence',    icon: HeartPulse,   emoji: '🏥' },
];

// Mobile bottom nav - 5 main items
const bottomNavItems = [
  { name: 'Home',    href: '/employee-dashboard',            icon: Home,         emoji: '🏠' },
  { name: 'Uren',    href: '/employee-dashboard/timesheets', icon: Clock,        emoji: '⏱️' },
  { name: 'Taken',   href: '/employee-dashboard/tasks',      icon: ListChecks,   emoji: '☑️' },
  { name: 'Profiel', href: '/settings',                      icon: Settings,     emoji: '⚙️' },
];

const EmployeeLayout: React.FC<EmployeeLayoutProps> = ({ children }) => {
  const { user, signOut, currentEmployeeId } = useAuth();
  const { selectedCompany } = useApp();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [employeeData, setEmployeeData] = useState<any>(null);

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
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/60 shadow-xs flex items-center justify-between px-4 z-50">
        <img src="/Logo_1.png" alt="FLG-Administratie" className="h-8 w-auto" />
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div className="flex h-screen md:h-auto md:min-h-screen">
        {/* Sidebar */}
        <div
          className={`fixed md:fixed left-0 top-16 md:top-0 h-[calc(100vh-64px)] md:h-screen w-80 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700/60 flex flex-col transition-transform duration-300 z-50 md:z-0 overflow-hidden shadow-lg md:shadow-xs ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          {/* Logo */}
          <div className="hidden md:flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700/60 flex-shrink-0">
            <img src="/Logo_1.png" alt="FLG-Administratie" className="h-9 w-auto" />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight truncate">FLG Administratie</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{selectedCompany?.name || 'Mijn omgeving'}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto overflow-x-hidden">
            <div className="px-3 pb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
                Navigatie
              </p>
            </div>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`group flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg text-[14px] font-medium transition-all duration-150 relative ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 font-semibold'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary-500 dark:bg-primary-400" aria-hidden />
                  )}
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-[20px] h-[20px] text-base leading-none" aria-hidden>
                    {item.emoji}
                  </span>
                  <span className="truncate">{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="border-t border-gray-100 dark:border-gray-700/60 p-3 flex-shrink-0 bg-white dark:bg-gray-800">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-glow-primary">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate tracking-tight">
                  {getFirstName()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="mt-2 flex w-full items-center gap-3 px-3 py-2 text-[13px] font-medium text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut className="h-[18px] w-[18px]" />
              <span>Uitloggen</span>
            </button>
          </div>
        </div>

        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm md:hidden z-40 top-16"
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
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-700/60 shadow-xl">
          <div className="flex justify-around items-center px-2 py-2.5">
            {bottomNavItems.map(({ href, emoji, name }) => {
              const isActive = location.pathname === href;
              return (
                <NavLink
                  key={href}
                  to={href}
                  className="flex flex-col items-center justify-center flex-1 transition-all duration-200 group"
                >
                  <div
                    className={`p-2 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-br from-primary-500 to-primary-600 shadow-glow-primary'
                        : 'bg-transparent group-hover:bg-gray-100 dark:group-hover:bg-gray-700/60'
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center w-5 h-5 text-lg leading-none ${isActive ? 'grayscale-0' : 'grayscale opacity-70 group-hover:opacity-100 group-hover:grayscale-0'}`} aria-hidden>
                      {emoji}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold mt-1 ${
                      isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {name}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Taken-herinnering bij inloggen (eigen taken) */}
      <WeeklyTasksReminder />
    </div>
  );
};

export default EmployeeLayout;
