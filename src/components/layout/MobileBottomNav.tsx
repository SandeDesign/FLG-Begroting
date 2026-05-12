import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  MoreVertical,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { BottomNavItem } from '../../types';
import { getBottomNavDefaults, ICON_MAP, CompanyType } from '../../utils/menuConfig';
import { useChatUnreadCount } from '../../hooks/useChatUnreadCount';

interface MobileBottomNavProps {
  onMenuClick: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onMenuClick }) => {
  const { user, userRole } = useAuth();
  const chatUnread = useChatUnreadCount();
  const { selectedCompany } = useApp();
  const [customNavItems, setCustomNavItems] = useState<BottomNavItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && selectedCompany) {
      loadCustomNavItems();
    }
  }, [user, selectedCompany]);

  const loadCustomNavItems = async () => {
    if (!user || !selectedCompany) return;

    try {
      const settingsRef = doc(db, 'userSettings', user.uid);
      const settingsDoc = await getDoc(settingsRef);

      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        const companyBottomNav = data.bottomNavItems?.[selectedCompany.id];

        if (companyBottomNav && Array.isArray(companyBottomNav) && companyBottomNav.length === 3) {
          setCustomNavItems(companyBottomNav);
        } else {
          setCustomNavItems(null);
        }
      } else {
        setCustomNavItems(null);
      }
    } catch {
      setCustomNavItems(null);
    } finally {
      setLoading(false);
    }
  };

  if (!userRole) return null;

  const companyType = selectedCompany?.companyType as CompanyType | undefined;

  // Dashboard is altijd het eerste item (fixed)
  const dashboardItem = {
    href: userRole === 'boekhouder' ? '/boekhouder' : '/',
    icon: Home,
    label: 'Dashboard',
    gradient: 'from-primary-500 to-primary-600'
  };

  // Bepaal de 3 middelste items (custom of defaults uit menuConfig)
  const middleItems = customNavItems
    ? customNavItems.map(item => ({
        ...item,
        icon: ICON_MAP[item.icon] || Clock,
      }))
    : getBottomNavDefaults(userRole, companyType).map(d => ({
        href: d.href,
        icon: d.iconComponent,
        label: d.label,
        gradient: d.gradient,
      }));

  // Final nav items: Dashboard (fixed) + 3 middle items
  const finalNavItems = [dashboardItem, ...middleItems];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-700/60 shadow-xl">
        <div className="flex justify-around items-center px-2 py-2.5 max-w-full">
          {finalNavItems.map(({ href, icon: Icon, label, gradient }) => {
            const isChatEntry = href === '/chat' || href === '/boekhouder/chat';
            const showBadge = isChatEntry && chatUnread > 0;
            return (
              <NavLink
                key={href}
                to={href}
                title={label}
                className="flex flex-col items-center justify-center flex-1 transition-all duration-200 group"
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                        isActive
                          ? `bg-gradient-to-br ${gradient} text-white shadow-glow-primary`
                          : 'bg-transparent text-gray-500 dark:text-gray-400 group-hover:bg-gray-100 dark:group-hover:bg-gray-700/60 group-hover:text-gray-700 dark:group-hover:text-gray-200'
                      }`}
                    >
                      <Icon size={20} strokeWidth={2.2} />
                      {showBadge && (
                        <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ring-2 ring-white dark:ring-gray-800">
                          {chatUnread > 99 ? '99+' : chatUnread}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-semibold mt-1 transition-colors ${
                        isActive
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}

          <button
            onClick={onMenuClick}
            title="Menu"
            className="flex flex-col items-center justify-center flex-1 transition-all duration-200 group"
          >
            <div className="relative p-2.5 rounded-xl bg-transparent text-gray-500 dark:text-gray-400 group-hover:bg-gray-100 dark:group-hover:bg-gray-700/60 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-all duration-200">
              <MoreVertical size={20} strokeWidth={2.2} />
            </div>
            <span className="text-[10px] font-semibold mt-1 text-gray-500 dark:text-gray-400">Menu</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
