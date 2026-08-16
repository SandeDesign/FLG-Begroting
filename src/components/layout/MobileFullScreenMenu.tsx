// src/components/layout/MobileFullScreenMenu.tsx
// Schermvullend menu op mobiel: alleen de pagina's en uitloggen. De entiteit en
// de periode staan in de begroting zelf, dus die hoeven hier niet gekozen te
// worden.

import React from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NAVIGATIE } from '../../utils/menuConfig';

interface MobileFullScreenMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileFullScreenMenu: React.FC<MobileFullScreenMenuProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, uitloggen } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
      {/* Kop */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100 dark:border-gray-700/60">
        <span className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight">
          FLG-Begroting
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Menu sluiten"
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {/* Pagina's */}
        <nav className="p-3 space-y-1">
          {NAVIGATIE.map((item) => (
            <NavLink
              key={item.id}
              to={item.href}
              end={item.exact}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`
              }
            >
              <span className="text-xl leading-none" aria-hidden>
                {item.emoji}
              </span>
              <span>{item.naam}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Voet */}
      <div className="border-t border-gray-100 dark:border-gray-700/60 p-4">
        {user?.email && (
          <p className="pb-3 text-xs text-gray-400 dark:text-gray-500 truncate">{user.email}</p>
        )}
        <button
          type="button"
          onClick={() => void uitloggen()}
          className="flex items-center gap-2.5 w-full px-3 py-3 rounded-xl text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          <span>Uitloggen</span>
        </button>
      </div>
    </div>
  );
};

export default MobileFullScreenMenu;
