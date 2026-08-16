// src/components/layout/Sidebar.tsx
// Vaste zijbalk op desktop. Zes items, geen secties en geen rolfilter — met dit
// aantal pagina's is inklappen per groep alleen maar in de weg lopen.

import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NAVIGATIE, type NavigatieItem } from '../../utils/menuConfig';

const OPSLAG_INGEKLAPT = 'flg.zijbalkIngeklapt';

const ZijbalkItem: React.FC<{ item: NavigatieItem; ingeklapt: boolean }> = ({
  item,
  ingeklapt,
}) => (
  <NavLink
    to={item.href}
    end={item.exact}
    title={ingeklapt ? item.naam : undefined}
    className={({ isActive }) =>
      `group relative flex items-center px-3 py-2 mx-2 text-[13px] font-medium rounded-lg transition-all duration-150 ${
        isActive
          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 font-semibold'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60 hover:text-gray-900 dark:hover:text-gray-100'
      } ${ingeklapt ? 'justify-center' : ''}`
    }
  >
    {({ isActive }) => (
      <>
        {isActive && !ingeklapt && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary-500 dark:bg-primary-400"
            aria-hidden
          />
        )}
        <span
          className={`flex-shrink-0 inline-flex items-center justify-center w-5 h-5 text-base leading-none ${
            ingeklapt ? '' : 'mr-2.5'
          }`}
          aria-hidden
        >
          {item.emoji}
        </span>
        {!ingeklapt && <span className="truncate">{item.naam}</span>}
      </>
    )}
  </NavLink>
);

const Sidebar: React.FC = () => {
  const { user, uitloggen } = useAuth();
  const [ingeklapt, setIngeklapt] = useState(false);

  useEffect(() => {
    setIngeklapt(localStorage.getItem(OPSLAG_INGEKLAPT) === 'true');
  }, []);

  const wisselIngeklapt = () => {
    setIngeklapt((huidig) => {
      const nieuw = !huidig;
      localStorage.setItem(OPSLAG_INGEKLAPT, String(nieuw));
      return nieuw;
    });
  };

  return (
    <aside
      className={`hidden lg:flex lg:flex-col bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700/60 transition-all duration-200 ${
        ingeklapt ? 'w-[68px]' : 'w-60'
      }`}
    >
      {/* Kop */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-gray-100 dark:border-gray-700/60">
        {!ingeklapt && (
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight truncate">
            FLG-Begroting
          </span>
        )}
        <button
          type="button"
          onClick={wisselIngeklapt}
          aria-label={ingeklapt ? 'Zijbalk uitklappen' : 'Zijbalk inklappen'}
          className={`h-9 w-9 flex items-center justify-center rounded-md text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ${
            ingeklapt ? 'mx-auto' : ''
          }`}
        >
          {ingeklapt ? (
            <ChevronRight className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      {/* Navigatie */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
        {NAVIGATIE.map((item) => (
          <ZijbalkItem key={item.id} item={item} ingeklapt={ingeklapt} />
        ))}
      </nav>

      {/* Voet */}
      <div className="border-t border-gray-100 dark:border-gray-700/60 p-2">
        {!ingeklapt && user?.email && (
          <p className="px-3 pb-2 text-[11px] text-gray-400 dark:text-gray-500 truncate">
            {user.email}
          </p>
        )}
        <button
          type="button"
          onClick={() => void uitloggen()}
          title={ingeklapt ? 'Uitloggen' : undefined}
          className={`flex items-center w-full px-3 py-2 text-[13px] font-medium rounded-lg text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 transition-colors ${
            ingeklapt ? 'justify-center' : ''
          }`}
        >
          <LogOut className={`h-4 w-4 flex-shrink-0 ${ingeklapt ? '' : 'mr-2.5'}`} aria-hidden />
          {!ingeklapt && <span>Uitloggen</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
