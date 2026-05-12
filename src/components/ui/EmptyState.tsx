import React from 'react';
import Button from './Button';

interface EmptyStateProps {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction
}) => (
  <div className="text-center py-14 px-4">
    <div className="mx-auto w-14 h-14 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-2xl flex items-center justify-center mb-5 shadow-xs">
      <Icon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
    </div>
    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1.5 tracking-tight">
      {title}
    </h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
      {description}
    </p>
    {actionLabel && onAction && (
      <div className="mt-6">
        <Button onClick={onAction}>{actionLabel}</Button>
      </div>
    )}
  </div>
);
