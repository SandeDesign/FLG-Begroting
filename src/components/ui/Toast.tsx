import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Toast as ToastType, useToast } from '../../hooks/useToast';

interface ToastProps {
  toast: ToastType;
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case 'info':
        return <Info className="h-5 w-5 text-primary-600 dark:text-primary-400" />;
      default:
        return null;
    }
  };

  const getAccentClasses = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-white dark:bg-gray-800 border-l-4 border-l-emerald-500 border-y border-r border-gray-100 dark:border-gray-700';
      case 'error':
        return 'bg-white dark:bg-gray-800 border-l-4 border-l-red-500 border-y border-r border-gray-100 dark:border-gray-700';
      case 'warning':
        return 'bg-white dark:bg-gray-800 border-l-4 border-l-amber-500 border-y border-r border-gray-100 dark:border-gray-700';
      case 'info':
        return 'bg-white dark:bg-gray-800 border-l-4 border-l-primary-500 border-y border-r border-gray-100 dark:border-gray-700';
      default:
        return 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div
      className={`max-w-sm w-full shadow-lg rounded-xl pointer-events-auto overflow-hidden ${getAccentClasses()}`}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            {getIcon()}
          </div>
          <div className="ml-3 w-0 flex-1">
            {toast.title && (
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                {toast.title}
              </p>
            )}
            <p className={`text-sm text-gray-600 dark:text-gray-300 ${toast.title ? 'mt-0.5' : ''}`}>
              {toast.message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              className="rounded-md inline-flex p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-colors"
              onClick={() => onRemove(toast.id)}
              aria-label="Sluiten"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed inset-0 flex items-end justify-center px-4 py-6 pointer-events-none sm:p-6 sm:items-start sm:justify-end z-50">
      <div className="w-full flex flex-col items-center space-y-3 sm:items-end">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </div>
  );
};

export default Toast;
