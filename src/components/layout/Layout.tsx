import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { usePageTitleValue } from '../../contexts/PageTitleContext';
import { getQuarterLabel } from '../../utils/dateFilters';
import Sidebar from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileFullScreenMenu } from './MobileFullScreenMenu';
import BoekhouderAdminSelector from './BoekhouderAdminSelector';
import WeeklyTasksReminder, { WeeklyTasksReminderRef } from '../tasks/WeeklyTasksReminder';
import PushPromptBanner from '../notifications/PushPromptBanner';
import ChatUnreadBanner from '../notifications/ChatUnreadBanner';
import IncompleteWeekBanner from '../timesheet/IncompleteWeekBanner';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const { userRole } = useAuth();
  const { companies, selectedCompany, setSelectedCompany, selectedYear, setSelectedYear, selectedQuarter, setSelectedQuarter, currentEmployeeId, assignedAdmins } = useApp();
  const isBoekhouder = userRole === 'boekhouder';
  const location = useLocation();
  const navigate = useNavigate();
  const tasksReminderRef = useRef<WeeklyTasksReminderRef>(null);
  const pageTitle = usePageTitleValue();

  // Embed mode: render only the page content without layout chrome
  const isEmbed = new URLSearchParams(location.search).get('embed') === 'true';
  if (isEmbed) {
    return <div className="bg-gray-50 dark:bg-gray-900 min-h-screen p-4 lg:p-6">{children}</div>;
  }

  const canGoBack = location.pathname !== '/';

  const handleBackClick = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Desktop Sidebar */}
      <Sidebar onLogoClick={() => tasksReminderRef.current?.openManually()} />

      {/* Mobile Full Screen Menu */}
      <MobileFullScreenMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Weekly Tasks Reminder */}
      <WeeklyTasksReminder ref={tasksReminderRef} employeeId={currentEmployeeId || undefined} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/60 shadow-xs px-4 py-3 flex items-center justify-between sticky top-0 z-40 h-20 max-h-20">
          {/* LEFT: Back button */}
          <div className="flex-1">
            <button
              onClick={handleBackClick}
              className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${canGoBack ? '' : 'opacity-0 pointer-events-none'}`}
            >
              <ArrowLeft className="h-6 w-6 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* CENTER: LOGO + Page Title */}
          <div className="flex-shrink-0 mx-2 flex flex-col items-center min-w-0">
            <button
              onClick={() => tasksReminderRef.current?.openManually()}
              className="hover:opacity-80 transition-opacity"
            >
              {selectedCompany?.logoUrl ? (
                <img src={selectedCompany.logoUrl} alt={selectedCompany.name} className={`w-auto max-w-[120px] object-contain ${pageTitle ? 'h-8' : 'h-12'}`} />
              ) : (
                <img src="/Logo_1.png" alt="FLG-Administratie Logo" className={`w-auto ${pageTitle ? 'h-8' : 'h-12'}`} />
              )}
            </button>
            {pageTitle && (
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[160px]">
                {pageTitle}
              </span>
            )}
          </div>

          {/* RIGHT: Company Selector (admin / manager) of Administratie selector (boekhouder) */}
          <div className="flex-1 flex justify-end items-center gap-1">
            {isBoekhouder ? (
              <BoekhouderAdminSelector variant="mobile" />
            ) : (
              <div className="relative">
                <button
                  onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                  className="flex items-center space-x-1 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Building2 className="h-5 w-5 text-primary-600" />
                  <ChevronDown className={`h-4 w-4 text-gray-500 dark:text-gray-300 transition-transform ${companyDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu - Opens LEFT on mobile */}
                {companyDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setCompanyDropdownOpen(false)}
                    />
                    <div className="absolute -left-48 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20 w-64 max-h-60 overflow-y-auto lg:right-0">
                      <div className="p-2 space-y-1">
                        {companies && companies.map((company) => (
                          <button
                            key={company.id}
                            onClick={() => {
                              setSelectedCompany(company);
                              setCompanyDropdownOpen(false);
                            }}
                            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors text-left ${ selectedCompany?.id === company.id ? 'bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-200' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300' }`}
                          >
                            {company.logoUrl ? (
                              <img src={company.logoUrl} alt={company.name} className="h-8 w-8 object-contain rounded" />
                            ) : (
                              <div className={`p-1.5 rounded-lg ${ selectedCompany?.id === company.id ? 'bg-primary-500' : 'bg-gray-400' }`}>
                                <Building2 className="h-3 w-3 text-white" />
                              </div>
                            )}
                            <span className="font-medium text-sm">{company.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex lg:items-center lg:justify-end lg:gap-2 lg:px-6 lg:h-14 lg:bg-white dark:lg:bg-gray-800 lg:border-b lg:border-gray-100 dark:lg:border-gray-700/60 lg:shadow-xs sticky top-0 z-30">
          {/* Period Selector */}
          <div className="relative">
            <button
              onClick={() => { setPeriodDropdownOpen(!periodDropdownOpen); setCompanyDropdownOpen(false); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-150 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-500 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-colors group"
            >
              <Calendar className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
                {selectedYear} <span className="text-gray-400 dark:text-gray-500 font-medium">·</span> {selectedQuarter ? `Q${selectedQuarter}` : 'Heel jaar'}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 dark:text-gray-500 transition-transform ${periodDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {periodDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPeriodDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg z-20 w-56 p-3">
                  {/* Year selector */}
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setSelectedYear(selectedYear - 1)} className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-150 dark:border-gray-700 hover:border-primary-400 hover:text-primary-600 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300 transition-colors">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">{selectedYear}</span>
                    <button onClick={() => setSelectedYear(selectedYear + 1)} className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-150 dark:border-gray-700 hover:border-primary-400 hover:text-primary-600 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300 transition-colors">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* Quarter pills */}
                  <div className="grid grid-cols-5 gap-1 bg-gray-100 dark:bg-gray-700/60 rounded-lg p-1">
                    {([null, 1, 2, 3, 4] as (number | null)[]).map((q) => (
                      <button
                        key={q ?? 'all'}
                        onClick={() => { setSelectedQuarter(q); setPeriodDropdownOpen(false); }}
                        className={`px-2 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${
                          selectedQuarter === q
                            ? 'bg-primary-500 text-white shadow-glow-primary'
                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-600/60'
                        }`}
                      >
                        {getQuarterLabel(q)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Company / Administratie Selector */}
          {isBoekhouder ? (
            <BoekhouderAdminSelector variant="desktop" />
          ) : (
            <div className="relative">
              <button
                onClick={() => { setCompanyDropdownOpen(!companyDropdownOpen); setPeriodDropdownOpen(false); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-150 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-500 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-colors"
              >
                {selectedCompany?.logoUrl ? (
                  <img src={selectedCompany.logoUrl} alt={selectedCompany.name} className="h-5 w-5 object-contain rounded" />
                ) : (
                  <Building2 className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                )}
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight max-w-[180px] truncate">{selectedCompany?.name || 'Selecteer bedrijf'}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-gray-400 dark:text-gray-500 transition-transform ${companyDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {companyDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setCompanyDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg z-20 w-64 max-h-72 overflow-y-auto">
                    <div className="p-1.5 space-y-0.5">
                      {companies && companies.map((company) => (
                        <button
                          key={company.id}
                          onClick={() => {
                            setSelectedCompany(company);
                            setCompanyDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${ selectedCompany?.id === company.id ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-200 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200' }`}
                        >
                          {company.logoUrl ? (
                            <img src={company.logoUrl} alt={company.name} className="h-7 w-7 object-contain rounded-md flex-shrink-0" />
                          ) : (
                            <div className={`p-1.5 rounded-md flex-shrink-0 ${ selectedCompany?.id === company.id ? 'bg-primary-500' : 'bg-gray-400 dark:bg-gray-600' }`}>
                              <Building2 className="h-3.5 w-3.5 text-white" />
                            </div>
                          )}
                          <span className="text-sm truncate">{company.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 lg:pb-0">
          <div className="p-4 lg:p-6 space-y-4">
            <PushPromptBanner />
            <ChatUnreadBanner />
            <IncompleteWeekBanner />
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav onMenuClick={() => setMobileMenuOpen(true)} />
      </div>
    </div>
  );
};

export default Layout;