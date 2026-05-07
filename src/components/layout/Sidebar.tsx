import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LogOut,
  ChevronRight,
  ChevronLeft,
  Star,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { getUserSettings } from '../../services/firebase';
import {
  getFilteredNavigation,
  getNavigationSections,
  getItemDisplayName,
  NavigationItem,
  CompanyType,
} from '../../utils/menuConfig';
import { useChatUnreadCount } from '../../hooks/useChatUnreadCount';

// Navigation Item - Cleaner Design
const NavItem: React.FC<{ item: NavigationItem; collapsed: boolean; userRole: string | null; dynamicBadge?: string | null }> = ({ item, collapsed, userRole, dynamicBadge }) => {
  const badge = dynamicBadge ?? item.badge;
  return (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        `group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 ${
          isActive
            ? 'bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border-l-3 border-primary-500 dark:border-primary-400'
            : 'text-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
        } ${collapsed ? 'justify-center' : ''} relative`
      }
      title={collapsed ? getItemDisplayName(item, userRole) : undefined}
    >
      {({ isActive }) => (
        <>
          <item.icon className={`h-5 w-5 flex-shrink-0 ${ isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-300 group-hover:text-gray-600 dark:hover:text-gray-400 dark:group-hover:text-gray-300' } ${collapsed ? '' : 'mr-3'}`} />
          {/* Collapsed state: small red dot als er een badge is */}
          {collapsed && badge && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
          )}
          {!collapsed && (
            <>
              <span className="truncate">{getItemDisplayName(item, userRole)}</span>
              {badge && (
                <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium min-w-[18px] text-center">
                  {badge}
                </span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  );
};

// Section Header - Cleaner Design
const SectionHeader: React.FC<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  color: string;
}> = ({ title, icon: Icon, collapsed, isExpanded, onToggle, color }) => {
  if (collapsed) {
    return (
      <div className="flex justify-center py-1.5">
        <div className="w-6 h-px bg-gray-200"></div>
      </div>
    );
  }

  return (
    <button
      onClick={onToggle}
      className="flex items-center w-full px-3 py-2 mt-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
    >
      <div className={`p-1.5 rounded-md ${color} mr-2`}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide flex-1 text-left">
        {title}
      </span>
      <ChevronRight className={`h-3.5 w-3.5 text-gray-400 dark:text-gray-300 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
    </button>
  );
};

interface SidebarProps {
  onLogoClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogoClick }) => {
  const { signOut, userRole, user } = useAuth();
  const chatUnread = useChatUnreadCount();
  const dynamicBadgeFor = (item: NavigationItem): string | null => {
    if (item.id === 'chat' && chatUnread > 0) {
      return chatUnread > 99 ? '99+' : String(chatUnread);
    }
    return null;
  };
  const { selectedCompany } = useApp();
  const [collapsed, setCollapsed] = useState(true);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [favoritePages, setFavoritePages] = useState<string[]>([]);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    const savedExpanded = localStorage.getItem('sidebarExpandedSections');

    if (savedCollapsed !== null) {
      setCollapsed(JSON.parse(savedCollapsed));
    }
    if (savedExpanded !== null) {
      setExpandedSections(JSON.parse(savedExpanded));
    }
  }, []);

  // Load favorite pages from user settings voor het geselecteerde bedrijf
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

  const handleToggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  const toggleSection = (sectionTitle: string) => {
    const newExpandedSections = expandedSections.includes(sectionTitle)
      ? expandedSections.filter(s => s !== sectionTitle)
      : [...expandedSections, sectionTitle];

    setExpandedSections(newExpandedSections);
    localStorage.setItem('sidebarExpandedSections', JSON.stringify(newExpandedSections));
  };

  // Filter navigation by role AND company type
  const companyType = selectedCompany?.companyType as CompanyType | undefined;
  const filteredNavigation = getFilteredNavigation(userRole, companyType);

  // Dashboard item (no section)
  const dashboardItem = filteredNavigation.find(i => i.id === 'dashboard');

  // Favorite items (only for admin)
  const favoriteItems = (userRole === 'admin' || userRole === 'co-admin') && favoritePages.length > 0
    ? filteredNavigation.filter(i => favoritePages.includes(i.href) && i.id !== 'dashboard')
    : [];

  // Sections from menuConfig
  const sections = getNavigationSections(userRole, companyType);

  return (
    <div className={`hidden lg:flex lg:flex-col lg:bg-white dark:bg-gray-800 lg:border-r lg:border-gray-200 dark:border-gray-600 transition-all duration-200 ${ collapsed ? 'lg:w-16' : 'lg:w-64' }`}>
      {/* Header - Logo */}
      <div className="flex h-16 items-center justify-center border-b border-gray-100 dark:border-gray-700 px-3 relative">
        <button
          onClick={onLogoClick}
          className="hover:opacity-80 transition-opacity focus:outline-none"
          title="Open wekelijkse taken"
        >
          {!collapsed && (
            selectedCompany?.logoUrl ? (
              <img src={selectedCompany.logoUrl} alt={selectedCompany.name} className="h-10 w-auto max-w-[200px] object-contain" />
            ) : (
              <img src="/Logo_1.png" alt="Logo" className="h-10 w-auto" />
            )
          )}
          {collapsed && (
            selectedCompany?.logoUrl ? (
              <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center">
                <img src={selectedCompany.logoUrl} alt={selectedCompany.name} className="w-full h-full object-contain p-0.5" />
              </div>
            ) : (
              <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
            )
          )}
        </button>

        <button
          onClick={handleToggleCollapsed}
          className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm z-10"
        >
          <ChevronLeft className={`h-3 w-3 text-gray-500 dark:text-gray-300 transition-transform duration-150 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-1">
        {/* Dashboard - Solo */}
        {dashboardItem && (
          <div className="pb-3 mb-2 border-b border-gray-100">
            <NavItem item={dashboardItem} collapsed={collapsed} userRole={userRole} />
          </div>
        )}

        {/* Favorites Section - Only for admin */}
        {favoriteItems.length > 0 && (
          <div className="pb-3 mb-2">
            <SectionHeader
              title="Favorieten"
              icon={Star}
              collapsed={collapsed}
              isExpanded={expandedSections.includes('Favorieten')}
              onToggle={() => toggleSection('Favorieten')}
              color="bg-amber-500"
            />
            {(collapsed || expandedSections.includes('Favorieten')) && (
              <div className={`space-y-0.5 ${collapsed ? '' : 'ml-2 pl-3 border-l border-gray-100 dark:border-gray-700 mt-1'}`}>
                {favoriteItems.map((item) => (
                  <NavItem key={item.id} item={item} collapsed={collapsed} userRole={userRole} dynamicBadge={dynamicBadgeFor(item)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manager / Boekhouder: Flat list without collapsible sections */}
        {(userRole === 'manager' || userRole === 'boekhouder') ? (
          <div className="space-y-0.5">
            {filteredNavigation.filter(i => i.id !== 'dashboard').map((item) => (
              <NavItem key={item.id} item={item} collapsed={collapsed} userRole={userRole} dynamicBadge={dynamicBadgeFor(item)} />
            ))}
          </div>
        ) : (
          /* Admin/Employee: Sections with dropdowns */
          <div className="space-y-1">
            {sections.map((section) => (
              <div key={section.title}>
                <SectionHeader
                  title={section.title}
                  icon={section.icon}
                  collapsed={collapsed}
                  isExpanded={expandedSections.includes(section.title)}
                  onToggle={() => toggleSection(section.title)}
                  color={section.color}
                />

                {(collapsed || expandedSections.includes(section.title)) && (
                  <div className={`space-y-0.5 ${collapsed ? '' : 'ml-2 pl-3 border-l border-gray-100 dark:border-gray-700'}`}>
                    {section.items.map((item) => (
                      <NavItem key={item.id} item={item} collapsed={collapsed} userRole={userRole} dynamicBadge={dynamicBadgeFor(item)} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 p-2">
        <button
          onClick={signOut}
          className={`flex w-full items-center px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ${ collapsed ? 'justify-center' : '' }`}
          title={collapsed ? 'Uitloggen' : undefined}
        >
          <LogOut className={`h-5 w-5 ${collapsed ? '' : 'mr-3'}`} />
          {!collapsed && <span>Uitloggen</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
