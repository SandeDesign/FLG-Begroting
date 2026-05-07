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
  <div className="text-center py-12">
    <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
      <Icon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
    </div>
    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
      {title}
    </h3>
    <p className="text-sm text-gray-600 dark:text-gray-300 max-w-sm mx-auto">
      {description}
    </p>
    {actionLabel && onAction && (
      <div className="mt-8">
        <Button onClick={onAction}>{actionLabel}</Button>
      </div>
    )}
  </div>
);