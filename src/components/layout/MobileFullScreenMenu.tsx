import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  X,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  LayoutDashboard,
  Star,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { getFilteredNavigation, getNavigationSections, getItemDisplayName, CompanyType } from '../../utils/menuConfig';
import { getUserSettings } from '../../services/firebase';
import { getQuarterLabel } from '../../utils/dateFilters';
import { useChatUnreadCount } from '../../hooks/useChatUnreadCount';

interface MobileFullScreenMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileFullScreenMenu: React.FC<MobileFullScreenMenuProps> = ({ isOpen, onClose }) => {
  const { userRole, signOut, user } = useAuth();
  const { companies, selectedCompany, setSelectedCompany, selectedYear, setSelectedYear, selectedQuarter, setSelectedQuarter } = useApp();
  const chatUnread = useChatUnreadCount();
  const chatBadge = chatUnread > 0 ? (chatUnread > 99 ? '99+' : String(chatUnread)) : null;
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [favoritePages, setFavoritePages] = useState<string[]>([]);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [periodSelectorOpen, setPeriodSelectorOpen] = useState(false);

  const canSelectCompany = (userRole === 'admin' || userRole === 'co-admin' || userRole === 'boekhouder') && companies && companies.length > 1;

  useEffect(() => {
    const loadFavorites = async () => {
      if (user && (userRole === 'admin' || userRole === 'co-admin') && selectedCompany?.id) {
        try {
          const settings = await getUserSettings(user.uid);
          if (settings?.favoritePages && settings.favoritePages[selectedCompany.id]) {
            setFavoritePages(settings.favoritePages[selectedCompany.id]);
          } else {
            setFavoritePages([]);
          }
        } catch {
          setFavoritePages([]);
        }
      } else {
        setFavoritePages([]);
      }
    };
    loadFavorites();
  }, [user?.uid, userRole, selectedCompany?.id]);

  useEffect(() => {
    if (!isOpen) {
      setCompanyDropdownOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const companyType = selectedCompany?.companyType as CompanyType | undefined;
  const filteredNavigation = getFilteredNavigation(userRole, companyType);
  const dashboardItem = filteredNavigation.find(i => i.id === 'dashboard');
  const favoriteItems = (userRole === 'admin' || userRole === 'co-admin') && favoritePages.length > 0
    ? filteredNavigation.filter(i => favoritePages.includes(i.href) && i.id !== 'dashboard')
    : [];
  const menuSections = getNavigationSections(userRole, companyType);

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionTitle)
        ? prev.filter(s => s !== sectionTitle)
        : [...prev, sectionTitle]
    );
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-gray-50 dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-out overflow-hidden flex flex-col">

        {/* Header with brand gradient */}
        <div className="relative px-5 py-5 bg-gradient-to-br from-primary-600 to-primary-800 flex-shrink-0 shadow-glow-primary-lg">
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {selectedCompany?.logoUrl ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow-md ring-1 ring-white/30 flex-shrink-0">
                  <img
                    src={selectedCompany.logoUrl}
                    alt={selectedCompany.name}
                    className="w-full h-full object-contain p-1.5"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center ring-1 ring-white/30 flex-shrink-0">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {canSelectCompany ? (
                  <button
                    onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                    className="flex items-center gap-1.5 text-left max-w-full"
                  >
                    <h2 className="text-base font-bold text-white tracking-tight truncate">
                      {selectedCompany?.name || 'Selecteer bedrijf'}
                    </h2>
                    <ChevronDown className={`h-4 w-4 text-white/80 flex-shrink-0 transition-transform ${companyDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  <h2 className="text-base font-bold text-white tracking-tight truncate">
                    {selectedCompany?.name || 'Menu'}
                  </h2>
                )}
                <p className="text-xs text-white/70 mt-0.5 truncate">FLG Administratie</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/90 hover:bg-white/15 hover:text-white transition-colors flex-shrink-0"
              aria-label="Sluiten"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Company Dropdown */}
        {canSelectCompany && companyDropdownOpen && (
          <div className="border-b border-gray-100 dark:border-gray-700/60 flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm">
            <div className="p-2 space-y-0.5 max-h-64 overflow-y-auto">
              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => {
                    setSelectedCompany(company);
                    setCompanyDropdownOpen(false);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    selectedCompany?.id === company.id
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-200 font-semibold'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60'
                  }`}
                >
                  {company.logoUrl ? (
                    <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center bg-white dark:bg-gray-700 ring-1 ring-gray-200 dark:ring-gray-600 flex-shrink-0">
                      <img
                        src={company.logoUrl}
                        alt={company.name}
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                  ) : (
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedCompany?.id === company.id ? 'bg-primary-500' : 'bg-gray-400 dark:bg-gray-600'}`}>
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm block truncate">{company.name}</span>
                    <span className="text-[11px] block truncate text-gray-400 dark:text-gray-500">
                      {company.companyType === 'project' ? 'Project' :
                       company.companyType === 'holding' ? 'Holding' :
                       company.companyType === 'shareholder' ? 'Aandeelhouder' :
                       company.companyType === 'employer' ? 'Werkgever' : company.companyType}
                    </span>
                  </div>
                  {selectedCompany?.id === company.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Period Selector */}
        <div className="border-b border-gray-100 dark:border-gray-700/60 flex-shrink-0 bg-white dark:bg-gray-800">
          <button
            onClick={() => setPeriodSelectorOpen(!periodSelectorOpen)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.08em]">Periode</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
                {selectedYear} <span className="text-gray-400 dark:text-gray-500 font-medium">·</span> {selectedQuarter ? `Q${selectedQuarter}` : 'Heel jaar'}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 dark:text-gray-500 transition-transform ${periodSelectorOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {periodSelectorOpen && (
            <div className="px-4 pb-3 space-y-2 border-t border-gray-100 dark:border-gray-700/60 pt-3">
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => { setSelectedYear(selectedYear - 1); }} className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:text-primary-600 text-gray-500 dark:text-gray-300 transition-colors">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight min-w-[3rem] text-center">{selectedYear}</span>
                <button onClick={() => { setSelectedYear(selectedYear + 1); }} className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:text-primary-600 text-gray-500 dark:text-gray-300 transition-colors">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1 bg-gray-100 dark:bg-gray-700/60 rounded-lg p-1">
                {([null, 1, 2, 3, 4] as (number | null)[]).map((q) => (
                  <button
                    key={q ?? 'all'}
                    onClick={() => { setSelectedQuarter(q); onClose(); }}
                    className={`px-2 py-1.5 text-xs font-semibold rounded-md transition-all ${
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
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">

          {/* Dashboard - prominent card */}
          {dashboardItem && (
            <NavLink
              to={dashboardItem.href}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
                  isActive
                    ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-glow-primary'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 border border-gray-100 dark:border-gray-700 shadow-xs'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-2 rounded-lg ${ isActive ? 'bg-white/15 backdrop-blur-sm' : 'bg-gray-50 dark:bg-gray-700/50' }`}>
                    <LayoutDashboard className={`h-4 w-4 ${ isActive ? 'text-white' : 'text-gray-600 dark:text-gray-300' }`} />
                  </div>
                  <span className="flex-1">Dashboard</span>
                </>
              )}
            </NavLink>
          )}

          {/* Favorites */}
          {favoriteItems.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xs overflow-hidden">
              <button
                onClick={() => toggleSection('Favorieten')}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-amber-500 shadow-xs">
                    <Star className="h-3.5 w-3.5 text-white fill-white" />
                  </div>
                  <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-[0.08em]">Favorieten</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${ expandedSections.includes('Favorieten') ? 'rotate-180' : '' }`} />
              </button>

              {expandedSections.includes('Favorieten') && (
                <div className="px-2 pb-2 space-y-0.5 border-t border-gray-100 dark:border-gray-700/60 pt-2">
                  {favoriteItems.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <NavLink
                        key={item.id}
                        to={item.href}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                            isActive
                              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 font-semibold'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary-500" aria-hidden />
                            )}
                            <ItemIcon className={`h-[18px] w-[18px] flex-shrink-0 ${ isActive ? 'text-primary-600 dark:text-primary-300' : 'text-gray-400 dark:text-gray-400' }`} />
                            <span className="flex-1 truncate">{getItemDisplayName(item, userRole)}</span>
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sections */}
          {menuSections.map((section) => {
            const SectionIcon = section.icon;
            const isExpanded = expandedSections.includes(section.title);
            return (
              <div key={section.title} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xs overflow-hidden">
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${section.color} shadow-xs`}>
                      <SectionIcon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-[0.08em]">{section.title}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${ isExpanded ? 'rotate-180' : '' }`} />
                </button>

                {isExpanded && (
                  <div className="px-2 pb-2 space-y-0.5 border-t border-gray-100 dark:border-gray-700/60 pt-2">
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <NavLink
                          key={item.id}
                          to={item.href}
                          onClick={onClose}
                          className={({ isActive }) =>
                            `relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                              isActive
                                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 font-semibold'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60'
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {isActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary-500" aria-hidden />
                              )}
                              <ItemIcon className={`h-[18px] w-[18px] flex-shrink-0 ${ isActive ? 'text-primary-600 dark:text-primary-300' : 'text-gray-400 dark:text-gray-400' }`} />
                              <span className="flex-1 truncate">{getItemDisplayName(item, userRole)}</span>
                              {item.id === 'chat' && chatBadge && (
                                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center leading-none">
                                  {chatBadge}
                                </span>
                              )}
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-gray-700/60 p-3 bg-white dark:bg-gray-800 flex-shrink-0">
          <button
            onClick={() => {
              signOut();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Uitloggen</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileFullScreenMenu;
