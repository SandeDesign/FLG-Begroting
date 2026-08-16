import React from 'react';

export type StatTileTone = 'bronze' | 'sky' | 'emerald' | 'amber' | 'purple' | 'red' | 'teal';

const TONE_CLASSES: Record<StatTileTone, { stripe: string; iconBg: string; iconText: string }> = {
  bronze:  { stripe: 'from-primary-400 to-primary-600',   iconBg: 'bg-primary-50 dark:bg-primary-900/30',   iconText: 'text-primary-600 dark:text-primary-400' },
  sky:     { stripe: 'from-sky-400 to-sky-600',           iconBg: 'bg-sky-50 dark:bg-sky-900/30',           iconText: 'text-sky-600 dark:text-sky-400' },
  emerald: { stripe: 'from-emerald-400 to-emerald-600',   iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',   iconText: 'text-emerald-600 dark:text-emerald-400' },
  amber:   { stripe: 'from-amber-400 to-amber-600',       iconBg: 'bg-amber-50 dark:bg-amber-900/30',       iconText: 'text-amber-600 dark:text-amber-400' },
  purple:  { stripe: 'from-purple-400 to-purple-600',     iconBg: 'bg-purple-50 dark:bg-purple-900/30',     iconText: 'text-purple-600 dark:text-purple-400' },
  red:     { stripe: 'from-red-400 to-red-600',           iconBg: 'bg-red-50 dark:bg-red-900/30',           iconText: 'text-red-600 dark:text-red-400' },
  teal:    { stripe: 'from-teal-400 to-teal-600',         iconBg: 'bg-teal-50 dark:bg-teal-900/30',         iconText: 'text-teal-600 dark:text-teal-400' },
};

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  /** Optional sub-text (e.g. "van 127 totaal", "Deze maand") */
  sub?: string;
  /** Optional emoji icon shown in the small icon-pill next to label */
  emoji?: string;
  /** Optional Lucide icon (alternative to emoji) */
  icon?: React.ComponentType<{ className?: string }>;
  tone?: StatTileTone;
  /** Optional badge count shown top-right (e.g. number of pending items) */
  badgeCount?: number;
  /** Optional delta indicator like "+12% t.o.v. vorige maand" */
  delta?: {
    text: string;
    direction?: 'up' | 'down' | 'neutral';
  };
  onClick?: () => void;
  className?: string;
}

const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  sub,
  emoji,
  icon: Icon,
  tone = 'bronze',
  badgeCount,
  delta,
  onClick,
  className = '',
}) => {
  const c = TONE_CLASSES[tone];
  const isClickable = !!onClick;

  const deltaColor =
    delta?.direction === 'up'   ? 'text-emerald-600 dark:text-emerald-400'
    : delta?.direction === 'down' ? 'text-red-600 dark:text-red-400'
    : 'text-gray-500 dark:text-gray-400';
  const deltaArrow =
    delta?.direction === 'up'   ? '↑'
    : delta?.direction === 'down' ? '↓'
    : '→';

  const content = (
    <>
      <div aria-hidden className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${c.stripe}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.06em] leading-tight text-gray-400 dark:text-gray-500 mb-1.5 flex items-start sm:items-center gap-1.5">
            <span className={`flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 mt-px sm:mt-0 rounded-md ${c.iconBg} flex items-center justify-center`}>
              {emoji ? (
                <span className="text-[12px] leading-none" aria-hidden>{emoji}</span>
              ) : Icon ? (
                <Icon className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${c.iconText}`} />
              ) : null}
            </span>
            <span className="min-w-0">{label}</span>
          </p>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tightest leading-none tabular-nums">
            {value}
          </p>
          {sub && !delta && (
            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1.5">{sub}</p>
          )}
          {delta && (
            <p className={`text-[11px] sm:text-xs font-medium mt-1.5 flex items-center gap-1 ${deltaColor}`}>
              <span>{deltaArrow}</span>
              <span>{delta.text}</span>
            </p>
          )}
        </div>
        {typeof badgeCount === 'number' && badgeCount > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center flex-shrink-0 ring-2 ring-white dark:ring-gray-800">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </div>
    </>
  );

  const baseClass = `relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs p-3.5 sm:p-4 lg:p-5 overflow-hidden transition-all duration-200 ${
    isClickable ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer text-left w-full' : ''
  } ${className}`;

  if (isClickable) {
    return (
      <button type="button" onClick={onClick} className={baseClass}>
        {content}
      </button>
    );
  }
  return <div className={baseClass}>{content}</div>;
};

export default StatTile;
