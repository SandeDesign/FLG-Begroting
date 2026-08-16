// src/components/layout/Layout.tsx
// Het frame om elke pagina heen: zijbalk op desktop, en op mobiel een onderbalk
// plus schermvullend menu.
//
// Bewust geen entiteit- of jaarkiezer in de kopbalk. Je werkt hier per
// begroting, en die bepaalt zelf al bij welke entiteit en periode hij hoort —
// een tweede keuze bovenin zou daar alleen maar mee botsen.

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usePageTitleValue } from '../../contexts/PageTitleContext';
import Sidebar from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileFullScreenMenu } from './MobileFullScreenMenu';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <MobileFullScreenMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

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
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 lg:pb-0">
          <div className="p-4 lg:p-6">{children}</div>
        </main>

        <MobileBottomNav onMenuClick={() => setMenuOpen(true)} />
      </div>
    </div>
  );
};

export default Layout;
