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
      {/* Backdrop blur separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Modern glasmorphism nav */}
      <div className="bg-white dark:bg-gray-800 backdrop-blur-xl border-t border-white/20 shadow-2xl">
        <div className="flex justify-around items-center px-2 py-3 max-w-full">
          {finalNavItems.map(({ href, icon: Icon, label, gradient }) => {
            // Badge: tonen als dit item naar de chat-pagina verwijst én er
            // ongelezen berichten zijn (werkt voor zowel /chat als /boekhouder/chat).
            const isChatEntry = href === '/chat' || href === '/boekhouder/chat';
            const showBadge = isChatEntry && chatUnread > 0;
            return (
            <NavLink
              key={href}
              to={href}
              title={label}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 transition-all duration-300 group relative ${
                  isActive ? 'scale-110' : 'hover:scale-105'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Background glow on active */}
                  {isActive && (
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-full blur-md opacity-20 scale-150`} />
                  )}

                  {/* Icon container */}
                  <div className={`relative p-3 rounded-2xl transition-all duration-300 ${
                    isActive
                      ? `bg-gradient-to-br ${gradient} text-white shadow-lg shadow-${gradient.split('-')[1]}-500/50`
                      : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 group-hover:bg-gray-200/50 dark:group-hover:bg-gray-600/50 group-hover:text-gray-800 dark:group-hover:text-gray-100'
                  }`}>
                    <Icon
                      size={20}
                      strokeWidth={2.2}
                      className="transition-all duration-300"
                    />
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow">
                        {chatUnread > 99 ? '99+' : chatUnread}
                      </span>
                    )}
                  </div>

                  {/* Label */}
                  <span className={`text-xs font-semibold mt-1.5 transition-all duration-300 ${ isActive ? 'text-gray-900 dark:text-gray-100 scale-100 opacity-100' : 'text-gray-600 dark:text-gray-300 scale-95 opacity-75 group-hover:opacity-100' }`}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
            );
          })}

          {/* Menu button */}
          <button
            onClick={onMenuClick}
            title="Menu"
            className="flex flex-col items-center justify-center flex-1 transition-all duration-300 group hover:scale-105"
          >
            <div className="relative p-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 group-hover:bg-gray-200/50 dark:group-hover:bg-gray-700/50 group-hover:text-gray-800 dark:group-hover:text-gray-100 transition-all duration-300">
              <MoreVertical
                size={20}
                strokeWidth={2.2}
              />
            </div>
            <span className="text-xs font-semibold mt-1.5 text-gray-600 dark:text-gray-300 scale-95 opacity-75 group-hover:opacity-100 transition-all duration-300">
              Menu
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
