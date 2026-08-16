import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, LucideIcon } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface ActionMenuProps {
  actions: ActionMenuItem[];
  className?: string;
  /**
   * 'plat' is de kale drie-puntjes-knop in een rij of tabel. 'knop' geeft hem
   * een rand, zodat hij als losse knop in een titelbalk op zichzelf staat.
   */
  variant?: 'plat' | 'knop';
  /** Voorleestekst; standaard "Meer acties". */
  label?: string;
}

const ActionMenu: React.FC<ActionMenuProps> = ({
  actions,
  className = '',
  variant = 'plat',
  label = 'Meer acties',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Zonder touchstart blijft het menu op een telefoon openstaan.
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 200);
    }
    setIsOpen(!isOpen);
  };

  if (actions.length === 0) return null;

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={
          variant === 'knop'
            ? 'h-10 w-10 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/30'
            : 'h-9 w-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/30'
        }
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 z-50 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg py-1.5 ${
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {actions.map((action, i) => {
            const Icon = action.icon;
            return (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  action.onClick();
                }}
                disabled={action.disabled}
                className={`w-full flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg text-sm font-medium transition-colors text-left ${
                  action.variant === 'danger'
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60'
                } ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ width: 'calc(100% - 0.5rem)' }}
              >
                {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActionMenu;
