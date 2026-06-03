// ✅ NIEUW: src/utils/companyHelpers.ts
// Smart logica voor het tonen/verbergen van company selectors

import { Company, Employee, EmployeeWithCompanies } from '../types';

// Bepaal of company selector getoond moet worden
export const shouldShowCompanySelector = (
  employee: EmployeeWithCompanies | Employee,
  companies: Company[]
): boolean => {
  // Als employee project companies heeft, toon selector
  if ('projectCompaniesData' in employee) {
    return employee.projectCompaniesData && employee.projectCompaniesData.length > 0;
  }
  
  // Fallback: check projectCompanies array
  if (employee.projectCompanies && employee.projectCompanies.length > 0) {
    return true;
  }
  
  return false;
};

// Get beschikbare bedrijven voor een employee
export const getAvailableCompaniesForEmployee = (
  employee: Employee,
  allCompanies: Company[]
): Company[] => {
  const allowedCompanyIds = [employee.companyId, ...(employee.projectCompanies || [])];
  return allCompanies.filter(company => allowedCompanyIds.includes(company.id));
};

// Get standaard company voor een employee (primaire werkgever)
export const getDefaultCompanyForEmployee = (
  employee: Employee,
  allCompanies: Company[]
): Company | null => {
  return allCompanies.find(company => company.id === employee.companyId) || null;
};

// Check of een employee voor een specifiek bedrijf mag werken
export const canEmployeeWorkForCompany = (
  employee: Employee,
  companyId: string
): boolean => {
  const allowedCompanyIds = [employee.companyId, ...(employee.projectCompanies || [])];
  return allowedCompanyIds.includes(companyId);
};

// Format company name voor UI (met type indicator)
export const formatCompanyNameForUI = (company: Company): string => {
  if (company.companyType === 'project') {
    return `${company.name} (Project)`;
  }
  return company.name;
};

// Group companies by type voor UI
export const groupCompaniesByType = (companies: Company[]) => {
  return {
    employers: companies.filter(c => c.companyType === 'employer'),
    projects: companies.filter(c => c.companyType === 'project')
  };
};

// Of een medewerker bij een (geselecteerd) bedrijf hoort.
// Voor project-/werkmaatschappijen telt naast de primaire `companyId` ook de
// koppeling via `projectCompanies`/`workCompanies`, zodat medewerkers die via
// een werkmaatschappij (bv. Buddy) aan een project (bv. Deinstallatie) gekoppeld
// zijn, daar correct verschijnen. Voor employer/holding telt enkel `companyId`.
export const employeeBelongsToCompany = (
  employee: Employee,
  company: Pick<Company, 'id' | 'companyType'>
): boolean => {
  const projectIds = [
    ...(employee.projectCompanies || []),
    ...(((employee as any).workCompanies as string[] | undefined) || []),
  ];
  const isProjectLike =
    company.companyType === 'project' ||
    (company.companyType as string) === 'work_company';
  if (isProjectLike) {
    return employee.companyId === company.id || projectIds.includes(company.id);
  }
  return employee.companyId === company.id;
};

// Filter een lijst medewerkers op een geselecteerd bedrijf (employer- vs
// project-logica). Zonder bedrijf → ongewijzigde lijst.
export const filterEmployeesForCompany = (
  employees: Employee[],
  company: Pick<Company, 'id' | 'companyType'> | null | undefined
): Employee[] => {
  if (!company) return employees;
  return employees.filter(e => employeeBelongsToCompany(e, company));
};

// Get project companies voor een employer
export const getProjectCompaniesForEmployer = (
  employerId: string,
  allCompanies: Company[]
): Company[] => {
  return allCompanies.filter(c => 
    c.companyType === 'project' && c.primaryEmployerId === employerId
  );
};