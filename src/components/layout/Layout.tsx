// src/components/layout/Layout.tsx
// Het frame om elke pagina heen: zijbalk op desktop, kopbalk met de entiteit- en
// jaarkeuze, en op mobiel een onderbalk plus schermvullend menu.

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, ChevronDown } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { usePageTitleValue } from '../../contexts/PageTitleContext';
import Sidebar from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileFullScreenMenu } from './MobileFullScreenMenu';
import PeriodSelector from '../ui/PeriodSelector';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [entiteitOpen, setEntiteitOpen] = useState(false);
  const { entiteiten, geselecteerdeEntiteit, setGeselecteerdeEntiteit } = useApp();
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

  const kiesEntiteit = (entiteitId: string) => {
    const gekozen = entiteiten.find((entiteit) => entiteit.id === entiteitId);
    setGeselecteerdeEntiteit(gekozen ?? null);
    setEntiteitOpen(false);
  };

  const entiteitKnop = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setEntiteitOpen(!entiteitOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-500 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-colors"
      >
        {geselecteerdeEntiteit ? (
          <span
            className="h-3 w-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: geselecteerdeEntiteit.kleur }}
            aria-hidden
          />
        ) : (
          <Building2 className="h-4 w-4 text-primary-600 dark:text-primary-400" aria-hidden />
        )}
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight max-w-[180px] truncate">
          {geselecteerdeEntiteit?.naam ?? 'Kies een entiteit'}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-gray-400 dark:text-gray-500 transition-transform ${
            entiteitOpen ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {entiteitOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setEntiteitOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg z-20 w-64 max-h-72 overflow-y-auto">
            <div className="p-1.5 space-y-0.5">
              {entiteiten.length === 0 && (
                <p className="px-2.5 py-3 text-sm text-gray-500 dark:text-gray-400">
                  Nog geen entiteiten
                </p>
              )}
              {entiteiten.map((entiteit) => (
                <button
                  key={entiteit.id}
                  type="button"
                  onClick={() => kiesEntiteit(entiteit.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${
                    geselecteerdeEntiteit?.id === entiteit.id
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-200 font-semibold'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: entiteit.kleur }}
                    aria-hidden
                  />
                  <span className="text-sm truncate">{entiteit.naam}</span>
                  {!entiteit.actief && (
                    <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">
                      inactief
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <MobileFullScreenMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Kopbalk mobiel */}
        <header className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/60 shadow-xs px-3 h-16 flex items-center justify-between sticky top-0 z-40">
          <div className="flex-1">
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
          </div>
          <span className="flex-shrink-0 text-sm font-semibold text-gray-800 dark:text-gray-100 truncate max-w-[45%]">
            {paginaTitel || 'FLG-Begroting'}
          </span>
          <div className="flex-1 flex justify-end">{entiteitKnop}</div>
        </header>

        {/* Kopbalk desktop */}
        <header className="hidden lg:flex lg:items-center lg:justify-between lg:gap-3 lg:px-6 lg:h-14 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/60 shadow-xs sticky top-0 z-30">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
            {paginaTitel}
          </span>
          <div className="flex items-center gap-3">
            <PeriodSelector />
            {entiteitKnop}
          </div>
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
