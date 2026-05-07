// ✅ NIEUW: src/components/ui/SmartCompanySelector.tsx
// Smart company selector die zich aanpast aan employee's toegewezen bedrijven

import React from 'react';
import { Company, Employee } from '../../types';
import { 
  shouldShowCompanySelector, 
  getAvailableCompaniesForEmployee,
  getDefaultCompanyForEmployee,
  formatCompanyNameForUI 
} from '../../utils/companyHelpers';

interface SmartCompanySelectorProps {
  employee: Employee;
  allCompanies: Company[];
  value?: string;
  onChange: (companyId: string) => void;
  className?: string;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  showLabel?: boolean;
}

const SmartCompanySelector: React.FC<SmartCompanySelectorProps> = ({
  employee,
  allCompanies,
  value,
  onChange,
  className = '',
  disabled = false,
  label = 'Bedrijf',
  placeholder = 'Selecteer bedrijf...',
  showLabel = true,
}) => {
  // Bepaal of selector getoond moet worden
  const showSelector = shouldShowCompanySelector(employee, allCompanies);
  
  // Als maar 1 bedrijf beschikbaar, geen selector tonen
  const availableCompanies = getAvailableCompaniesForEmployee(employee, allCompanies);
  const defaultCompany = getDefaultCompanyForEmployee(employee, allCompanies);
  
  // Automatisch default company selecteren als er geen waarde is
  React.useEffect(() => {
    if (!value && defaultCompany && !showSelector) {
      onChange(defaultCompany.id);
    }
  }, [value, defaultCompany, showSelector, onChange]);
  
  // Als maar 1 bedrijf: toon alleen tekst, geen selector
  if (!showSelector || availableCompanies.length <= 1) {
    const displayCompany = defaultCompany || availableCompanies[0];
    if (!displayCompany) return null;
    
    return (
      <div className={className}>
        {showLabel && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {label}
          </label>
        )}
        <div className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 border rounded-lg border-gray-300 dark:border-gray-600">
          {formatCompanyNameForUI(displayCompany)}
        </div>
        {/* Hidden input voor form submission */}
        <input 
          type="hidden" 
          value={displayCompany.id} 
          onChange={() => onChange(displayCompany.id)}
        />
      </div>
    );
  }
  
  // Meerdere bedrijven: toon dropdown selector
  return (
    <div className={className}>
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          {label}
        </label>
      )}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border rounded-lg border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {availableCompanies.map((company) => (
          <option key={company.id} value={company.id}>
            {formatCompanyNameForUI(company)}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SmartCompanySelector;

// ✅ NIEUW: Hook voor smart company selection
export const useSmartCompanySelection = (
  employee: Employee | null,
  allCompanies: Company[]
) => {
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>('');
  
  React.useEffect(() => {
    if (employee) {
      const availableCompanies = getAvailableCompaniesForEmployee(employee, allCompanies);
      const defaultCompany = getDefaultCompanyForEmployee(employee, allCompanies);
      
      // Auto-select if only one option
      if (availableCompanies.length === 1) {
        setSelectedCompanyId(availableCompanies[0].id);
      } else if (defaultCompany && !shouldShowCompanySelector(employee, allCompanies)) {
        setSelectedCompanyId(defaultCompany.id);
      }
    }
  }, [employee, allCompanies]);
  
  const shouldShow = employee ? shouldShowCompanySelector(employee, allCompanies) : false;
  const availableCompanies = employee ? getAvailableCompaniesForEmployee(employee, allCompanies) : [];
  
  return {
    selectedCompanyId,
    setSelectedCompanyId,
    shouldShowSelector: shouldShow && availableCompanies.length > 1,
    availableCompanies,
    defaultCompany: employee ? getDefaultCompanyForEmployee(employee, allCompanies) : null
  };
};