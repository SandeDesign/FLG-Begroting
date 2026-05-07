import React from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';

export const CompanySelector: React.FC = () => {
  const { companies, selectedCompany, setSelectedCompany } = useApp();
  const { userRole } = useAuth();

  // Only show for admin, manager en boekhouder
  if (!userRole || !['admin', 'manager', 'boekhouder'].includes(userRole) || !companies || companies.length === 0) {
    return null;
  }

  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const companyId = e.target.value;
    const company = companies.find(c => c.id === companyId);
    setSelectedCompany(company || null);
  };

  return (
    <div className="w-full">
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider mb-2">
        Bedrijf
      </label>
      <div className="relative">
        <select
          value={selectedCompany?.id || ''}
          onChange={handleCompanyChange}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none"
        >
          <option value="">Selecteer bedrijf...</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
              {company.companyType === 'payroll_company' ? ' (Loonmaatschappij)' : ''}
              {company.companyType === 'work_company' ? ' (Werkmaatschappij)' : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
      </div>

      {selectedCompany && (
        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs text-gray-600 dark:text-gray-300">
          <div className="flex items-center space-x-2">
            <Building2 className="h-3 w-3" />
            <span>{selectedCompany.name}</span>
            {selectedCompany.companyType === 'payroll_company' && (
              <span className="bg-green-100 text-green-800 px-1 rounded">Loon</span>
            )}
            {selectedCompany.companyType === 'work_company' && (
              <span className="bg-primary-100 text-primary-800 px-1 rounded">Werk</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};