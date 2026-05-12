import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional emoji rendered next to the title */
  emoji?: string;
  /** Optional right-aligned actions (buttons, dropdowns, etc.) */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Clean, non-gradient page header — replaces heavy bronze hero blocks.
 * Matches the design preview's straight-to-content style.
 */
const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, emoji, actions, className = '' }) => (
  <div className={`flex items-start justify-between gap-4 mb-1 ${className}`}>
    <div className="min-w-0">
      <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
        {emoji && <span aria-hidden className="text-2xl leading-none">{emoji}</span>}
        <span className="truncate">{title}</span>
      </h1>
      {subtitle && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">{subtitle}</p>
      )}
    </div>
    {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
  </div>
);

export default PageHeader;
