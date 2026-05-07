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
  Sparkles,
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

  // Load favorite pages from user settings for the selected company
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

  // Get filtered navigation using menuConfig
  const filteredNavigation = getFilteredNavigation(userRole, companyType);

  // Dashboard item (standalone)
  const dashboardItem = filteredNavigation.find(i => i.id === 'dashboard');

  // Favorite items (only for admin)
  const favoriteItems = (userRole === 'admin' || userRole === 'co-admin') && favoritePages.length > 0
    ? filteredNavigation.filter(i => favoritePages.includes(i.href) && i.id !== 'dashboard')
    : [];

  // Get sections from menuConfig
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
      {/* Modern Overlay with blur */}
      <div
        className="fixed inset-0 bg-gradient-to-br from-gray-900/60 via-gray-800/50 to-gray-900/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modern Menu Content */}
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-gradient-to-br from-white via-gray-50/95 to-white/90 dark:from-gray-900 dark:via-gray-800/95 dark:to-gray-900/90 backdrop-blur-xl shadow-2xl transform transition-transform duration-300 ease-out overflow-hidden flex flex-col">

        {/* Modern Header with Gradient */}
        <div className="relative p-6 border-b border-white/20 bg-gradient-to-br from-primary-600 via-primary-500 to-indigo-600 flex-shrink-0 shadow-lg">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '32px 32px'
            }} />
          </div>

          <div className="relative flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {selectedCompany?.logoUrl ? (
                <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center bg-white dark:bg-gray-800 shadow-xl shadow-black/20 ring-2 ring-white/30">
                  <img
                    src={selectedCompany.logoUrl}
                    alt={selectedCompany.name}
                    className="w-full h-full object-contain p-2"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 bg-gradient-to-br from-white to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-2xl flex items-center justify-center shadow-xl shadow-black/20 ring-2 ring-white/30 dark:ring-gray-600/30">
                  <Sparkles className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                </div>
              )}
              <div>
                {canSelectCompany ? (
                  <button
                    onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                    className="flex items-center space-x-1.5 text-left"
                  >
                    <h2 className="text-base font-bold text-white drop-shadow-sm truncate max-w-[180px]">
                      {selectedCompany?.name || 'Selecteer bedrijf'}
                    </h2>
                    <ChevronDown className={`h-4 w-4 text-white/80 flex-shrink-0 transition-transform duration-200 ${companyDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  <h2 className="text-base font-bold text-white drop-shadow-sm truncate max-w-[180px]">
                    {selectedCompany?.name || 'Menu'}
                  </h2>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-white/90 hover:bg-white/20 dark:hover:bg-gray-700/50 hover:text-white transition-all duration-200 backdrop-blur-sm shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Company Dropdown */}
        {canSelectCompany && companyDropdownOpen && (
          <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800 shadow-lg">
            <div className="p-3 space-y-1 max-h-64 overflow-y-auto">
              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => {
                    setSelectedCompany(company);
                    setCompanyDropdownOpen(false);
                    onClose();
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-left transition-all duration-200 ${
                    selectedCompany?.id === company.id
                      ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {company.logoUrl ? (
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white dark:bg-gray-800 shadow-md ring-1 ring-gray-200 dark:ring-gray-600 flex-shrink-0">
                      <img
                        src={company.logoUrl}
                        alt={company.name}
                        className="w-full h-full object-contain p-1.5"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-semibold block truncate ${
                      selectedCompany?.id === company.id ? 'text-white' : ''
                    }`}>
                      {company.name}
                    </span>
                    <span className={`text-xs block ${
                      selectedCompany?.id === company.id ? 'text-white/70' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {company.companyType === 'project' ? 'Project' :
                       company.companyType === 'holding' ? 'Holding' :
                       company.companyType === 'shareholder' ? 'Aandeelhouder' :
                       company.companyType === 'employer' ? 'Werkgever' : company.companyType}
                    </span>
                  </div>
                  {selectedCompany?.id === company.id && (
                    <div className="w-2 h-2 rounded-full bg-white shadow-sm flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Period Selector (collapsible) */}
        <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
          <button
            onClick={() => setPeriodSelectorOpen(!periodSelectorOpen)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <span className="text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wide">Periode</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                {selectedYear} · {selectedQuarter ? `Q${selectedQuarter}` : 'Heel jaar'}
              </span>
              <ChevronDown className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${periodSelectorOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {periodSelectorOpen && (
            <div className="px-4 pb-3 space-y-2">
              <div className="flex items-center justify-center gap-1">
                <button onClick={() => { setSelectedYear(selectedYear - 1); onClose(); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[3rem] text-center">{selectedYear}</span>
                <button onClick={() => { setSelectedYear(selectedYear + 1); onClose(); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1 bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
                {([null, 1, 2, 3, 4] as (number | null)[]).map((q) => (
                  <button
                    key={q ?? 'all'}
                    onClick={() => { setSelectedQuarter(q); onClose(); }}
                    className={`px-2 py-2 text-xs font-medium rounded-md transition-all duration-150 ${
                      selectedQuarter === q
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {getQuarterLabel(q)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modern Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-3">

          {/* Dashboard Card */}
          {dashboardItem && (
            <div className="mb-4">
              <NavLink
                to={dashboardItem.href}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center space-x-4 px-5 py-4 rounded-2xl transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl ${
                    isActive
                      ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-primary-500/40'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-gray-200/50 dark:shadow-gray-900/50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-3 rounded-xl transition-all duration-300 ${ isActive ? 'bg-white/20 backdrop-blur-sm shadow-inner border border-white/30' : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600' }`}>
                      <LayoutDashboard className={`h-5 w-5 ${ isActive ? 'text-white' : 'text-gray-700 dark:text-gray-300' }`} />
                    </div>
                    <span className="flex-1">Dashboard</span>
                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-white shadow-sm"></div>
                    )}
                  </>
                )}
              </NavLink>
            </div>
          )}

          {/* Favorites Card */}
          {favoriteItems.length > 0 && (
            <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/20 dark:via-yellow-900/20 dark:to-orange-900/20 rounded-2xl p-4 mb-4 shadow-lg border border-amber-100 dark:border-amber-800">
              <button
                onClick={() => toggleSection('Favorieten')}
                className="w-full flex items-center justify-between mb-3 group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
                    <Star className="h-4 w-4 text-white fill-white" />
                  </div>
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">Favorieten</span>
                </div>
                <ChevronDown className={`h-5 w-5 text-amber-600 dark:text-amber-400 transition-transform duration-300 ${ expandedSections.includes('Favorieten') ? 'rotate-180' : '' }`} />
              </button>

              {expandedSections.includes('Favorieten') && (
                <div className="space-y-1.5 mt-2">
                  {favoriteItems.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <NavLink
                        key={item.id}
                        to={item.href}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
                            isActive
                              ? 'bg-white dark:bg-gray-800 text-amber-700 dark:text-amber-400 shadow-md'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/60'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <div className={`p-2 rounded-lg transition-all duration-200 ${ isActive ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-white dark:bg-gray-700/70' }`}>
                              <ItemIcon className={`h-4 w-4 ${ isActive ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300' }`} />
                            </div>
                            <span className="flex-1">{getItemDisplayName(item, userRole)}</span>
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Modern Section Cards */}
          {menuSections.map((section) => {
            const SectionIcon = section.icon;
            const isExpanded = expandedSections.includes(section.title);
            return (
              <div key={section.title} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between p-4 group hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 shadow-lg group-hover:shadow-xl transition-shadow">
                      <SectionIcon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">{section.title}</span>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-gray-400 dark:text-gray-500 transition-transform duration-300 ${ isExpanded ? 'rotate-180 text-primary-600 dark:text-primary-400' : '' }`} />
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-1 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <NavLink
                          key={item.id}
                          to={item.href}
                          onClick={onClose}
                          className={({ isActive }) =>
                            `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
                              isActive
                                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md'
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <div className={`p-2 rounded-lg transition-all duration-200 ${ isActive ? 'bg-white dark:bg-gray-800/20 shadow-inner' : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600' }`}>
                                <ItemIcon className={`h-4 w-4 ${ isActive ? 'text-white' : 'text-gray-600 dark:text-gray-300' }`} />
                              </div>
                              <span className="flex-1">{getItemDisplayName(item, userRole)}</span>
                              {item.id === 'chat' && chatBadge && (
                                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                                  {chatBadge}
                                </span>
                              )}
                              {isActive && !(item.id === 'chat' && chatBadge) && (
                                <div className="w-2 h-2 rounded-full bg-white dark:bg-gray-800 shadow-sm"></div>
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

        {/* Modern Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-5 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex-shrink-0 shadow-inner">
          <button
            onClick={() => {
              signOut();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-3 px-5 py-3.5 text-sm font-bold text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl border border-red-100 dark:border-red-800 hover:border-red-200 dark:hover:border-red-700"
          >
            <LogOut className="h-5 w-5" />
            <span>Uitloggen</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileFullScreenMenu;
