import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, CreditCard as Edit, Trash2, MapPin, Phone, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Company, Branch } from '../types';
import { getCompanies, deleteCompany, getBranches } from '../services/firebase';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import CompanyModal from '../components/company/CompanyModal';
import BranchModal from '../components/company/BranchModal';
import { useToast } from '../hooks/useToast';
import { useApp } from '../contexts/AppContext'; // Import useApp to refresh global state
import { usePageTitle } from '../contexts/PageTitleContext';

const Companies: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { refreshDashboardStats } = useApp(); // Use refreshDashboardStats
  const { success, error: showError } = useToast();
  usePageTitle('Bedrijven');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null); // Renamed to avoid conflict

  const loadData = useCallback(async () => {
    if (!user || !adminUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [companiesData, branchesData] = await Promise.all([
        getCompanies(adminUserId),
        getBranches(adminUserId)
      ]);
      setCompanies(companiesData);
      setBranches(branchesData);
      await refreshDashboardStats(); // Refresh dashboard stats after loading company data
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Fout bij laden', 'Kon bedrijfsgegevens niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, adminUserId, showError, refreshDashboardStats]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company);
    setIsCompanyModalOpen(true);
  };

  const handleDeleteCompany = async (company: Company) => {
    if (!user || !adminUserId) return;

    if (window.confirm(`Weet je zeker dat je ${company.name} wilt verwijderen? Dit verwijdert ook alle gerelateerde vestigingen en werknemers.`)) {
      try {
        await deleteCompany(company.id, adminUserId);
        success('Bedrijf verwijderd', `${company.name} is succesvol verwijderd`);
        await loadData(); // Reload data after deletion
      } catch (error) {
        console.error('Error deleting company:', error);
        showError('Fout bij verwijderen', 'Kon bedrijf niet verwijderen');
      }
    }
  };

  const handleAddBranch = (company: Company) => {
    setSelectedCompany(company);
    setSelectedBranch(null); // Ensure no branch is selected for new creation
    setIsBranchModalOpen(true);
  };

  const handleEditBranch = (branch: Branch) => {
    const company = companies.find(c => c.id === branch.companyId);
    setSelectedCompany(company || null);
    setSelectedBranch(branch);
    setIsBranchModalOpen(true);
  };

  const getCompanyBranches = (companyId: string) => {
    return branches.filter(branch => branch.companyId === companyId);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Bedrijven</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Beheer je bedrijven en vestigingen
          </p>
        </div>
        <Button onClick={() => {
          setSelectedCompany(null);
          setIsCompanyModalOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nieuw Bedrijf
        </Button>
      </div>

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Geen bedrijven gevonden"
          description="Voeg je eerste bedrijf toe om te beginnen"
          actionLabel="Eerste Bedrijf Toevoegen"
          onAction={() => setIsCompanyModalOpen(true)}
        />
      ) : (
        <div className="space-y-6">
          {companies.map((company) => {
            const companyBranches = getCompanyBranches(company.id);
            
            return (
              <Card key={company.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-primary-100 rounded-lg">
                      <Building2 className="h-8 w-8 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {company.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        KvK: {company.kvk} | BTW: {company.taxNumber}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditCompany(company)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Bewerken
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteCompany(company)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Verwijderen
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {company.address.street}, {company.address.zipCode} {company.address.city}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                    <Mail className="h-4 w-4" />
                    <span>{company.contactInfo.email}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                    <Phone className="h-4 w-4" />
                    <span>{company.contactInfo.phone}</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      Vestigingen ({companyBranches.length})
                    </h4>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleAddBranch(company)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Vestiging Toevoegen
                    </Button>
                  </div>

                  {companyBranches.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-300 italic">
                      Nog geen vestigingen toegevoegd
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {companyBranches.map((branch) => (
                        <div
                          key={branch.id}
                          className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:bg-gray-900 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-gray-900 dark:text-gray-100">
                                {branch.name}
                              </h5>
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                {branch.location}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-300">
                                Kostenplaats: {branch.costCenter}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditBranch(branch)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CompanyModal
        isOpen={isCompanyModalOpen}
        onClose={() => {
          setIsCompanyModalOpen(false);
          setSelectedCompany(null);
        }}
        onSuccess={loadData}
        company={selectedCompany}
      />

      <BranchModal
        isOpen={isBranchModalOpen}
        onClose={() => {
          setIsBranchModalOpen(false);
          setSelectedCompany(null);
          setSelectedBranch(null);
        }}
        onSuccess={loadData}
        company={selectedCompany}
        branch={selectedBranch}
      />
    </div>
  );
};

export default Companies;