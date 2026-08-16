// src/components/layout/MobileBottomNav.tsx
// Onderbalk op mobiel: vier pagina's plus een knop naar het volledige menu.
// Niet instelbaar — met zes pagina's in totaal valt er weinig te kiezen.
//
// De balk zweeft bewust niet boven de pagina. Als laatste blok in de kolom
// staat hij altijd onderaan, kan er nooit inhoud achter verdwijnen, en hoeft de
// pagina er geen ruimte voor vrij te houden die je moet raden.

import React from 'react';
import { NavLink } from 'react-router-dom';
import { ONDERBALK } from '../../utils/menuConfig';

interface MobileBottomNavProps {
  onMenuClick: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onMenuClick }) => (
  <nav className="lg:hidden flex-shrink-0">
    {/* Dekkend, zonder blur: er scrolt niets meer achter deze balk langs, en
          een permanent backdrop-filter kost elk beeld GPU-werk — precies wat je
          op een telefoon als schokkerig scrollen terugziet. */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/60 shadow-lg">
      <div className="flex justify-around items-center px-2 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        {ONDERBALK.map((item) => (
          <NavLink
            key={item.id}
            to={item.href}
            end={item.exact}
            title={item.naam}
            className="flex flex-col items-center justify-center flex-1 group"
          >
            {({ isActive }) => (
              <>
                <div
                  className={`p-2.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-br from-primary-500 to-primary-600 shadow-glow-primary'
                      : 'bg-transparent group-hover:bg-gray-100 dark:group-hover:bg-gray-700/60'
                  }`}
                >
                  <span className="text-xl leading-none select-none" aria-hidden>
                    {item.emoji}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-semibold mt-1 transition-colors ${
                    isActive
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {item.kort}
                </span>
              </>
            )}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={onMenuClick}
          title="Menu"
          className="flex flex-col items-center justify-center flex-1 group"
        >
          <div className="p-2.5 rounded-xl bg-transparent group-hover:bg-gray-100 dark:group-hover:bg-gray-700/60 transition-all duration-200">
            <span className="text-xl leading-none select-none" aria-hidden>
              ☰
            </span>
          </div>
          <span className="text-[10px] font-semibold mt-1 text-gray-500 dark:text-gray-400">
            Menu
          </span>
        </button>
      </div>
    </div>
  </nav>
);

export default MobileBottomNav;
