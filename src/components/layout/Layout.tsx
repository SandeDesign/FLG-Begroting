// src/components/layout/Layout.tsx
// Het frame om elke pagina heen: zijbalk op desktop, en op mobiel een onderbalk
// plus schermvullend menu.
//
// Bewust geen entiteit- of jaarkiezer in de kopbalk. Je werkt hier per
// begroting, en die bepaalt zelf al bij welke entiteit en periode hij hoort.
// Op die plek staat nu het handboek, want de app uitleggen is nuttiger dan een
// keuze aanbieden die nergens op slaat.

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { usePageTitleValue } from '../../contexts/PageTitleContext';
import Sidebar from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileFullScreenMenu } from './MobileFullScreenMenu';
import Handboek from '../handboek/Handboek';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [handboekOpen, setHandboekOpen] = useState(false);
  const paginaTitel = usePageTitleValue();
  const location = useLocation();
  const navigate = useNavigate();

  const kanTerug = location.pathname !== '/';

  const gaTerug = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handboekKnop = (
    <button
      type="button"
      onClick={() => setHandboekOpen(true)}
      title="Handboek openen"
      aria-label="Handboek openen"
      className="group flex items-center justify-center gap-2 px-3 h-10 min-w-[40px] rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-500 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-colors"
    >
      <HelpCircle
        className="h-4 w-4 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform"
        aria-hidden
      />
      <span className="hidden sm:inline text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
        Uitleg
      </span>
    </button>
  );

  return (
    <div className="flex h-screen supports-[height:100svh]:h-[100svh] bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <MobileFullScreenMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <Handboek isOpen={handboekOpen} onClose={() => setHandboekOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Kopbalk mobiel */}
        <header className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/60 shadow-xs px-3 h-14 flex items-center gap-2 sticky top-0 z-40">
          <button
            type="button"
            onClick={gaTerug}
            aria-label="Terug"
            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              kanTerug ? '' : 'opacity-0 pointer-events-none'
            }`}
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" aria-hidden />
          </button>
          <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
            {paginaTitel || 'FLG-Begroting'}
          </span>
          {handboekKnop}
        </header>

        {/* Kopbalk desktop */}
        <header className="hidden lg:flex lg:items-center lg:justify-between lg:gap-3 lg:px-6 lg:h-14 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/60 shadow-xs sticky top-0 z-30">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
            {paginaTitel}
          </span>
          {handboekKnop}
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="p-4 lg:p-6">{children}</div>
        </main>

        <MobileBottomNav onMenuClick={() => setMenuOpen(true)} />
      </div>
    </div>
  );
};

export default Layout;
