import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Building2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserSettings, saveUserSettings, getCompanies } from '../../services/firebase';
import { useToast } from '../../hooks/useToast';
import { Company } from '../../types';

const CompaniesVisibilitySettings: React.FC = () => {
  const { user, userRole, adminUserId } = useAuth();
  const { success, error: showError } = useToast();
  const [loadingCompanyId, setLoadingCompanyId] = useState<string | null>(null);
  const [visibleCompanyIds, setVisibleCompanyIds] = useState<string[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Show for admin and co-admin (manager role)
  if ((userRole !== 'admin' && userRole !== 'manager') || !user || !adminUserId) {
    return null;
  }

  useEffect(() => {
    loadData();
  }, [user, adminUserId]);

  const loadData = async () => {
    if (!user || !adminUserId) return;
    try {
      setLoading(true);

      // Load ALL companies (unfiltered) - CRITICAL!
      const allCompaniesData = await getCompanies(adminUserId);
      setAllCompanies(allCompaniesData);

      // ✅ Load THIS USER's visible company IDs (not admin's!)
      // Each user (admin or co-admin) has their own visibility preferences
      const settings = await getUserSettings(user.uid);
      const visible = settings?.visibleCompanyIds || allCompaniesData.map(c => c.id);
      setVisibleCompanyIds(visible);

      console.log('👤 Loading visibility for user:', user.uid, user.email);
      console.log('📋 User settings:', settings);
      console.log('👁️ Visible company IDs:', visible);
    } catch (error) {
      console.error('Error loading data:', error);
      setVisibleCompanyIds([]);
    } finally {
      setLoading(false);
    }
  };

  const visibleCompanies = allCompanies.filter(c => visibleCompanyIds.includes(c.id));
  const hiddenCompanies = allCompanies.filter(c => !visibleCompanyIds.includes(c.id));
  const totalVisible = visibleCompanies.length;
  const totalCompanies = allCompanies.length;

  const handleToggleCompanyVisibility = async (companyId: string, isVisible: boolean) => {
    if (!user) return;
    try {
      setLoadingCompanyId(companyId);

      const newVisibleIds = isVisible
        ? visibleCompanyIds.filter(id => id !== companyId)
        : [...visibleCompanyIds, companyId];

      // ✅ Save to THIS USER's settings (user.uid), not admin's
      console.log('💾 Saving visibility for user:', user.uid, user.email);
      console.log('👁️ New visible IDs:', newVisibleIds);

      await saveUserSettings(user.uid, {
        visibleCompanyIds: newVisibleIds
      });

      setVisibleCompanyIds(newVisibleIds);

      if (isVisible) {
        success('Verborgen', `✓ Bedrijf is nu verborgen voor ${user.email}`);
      } else {
        success('Zichtbaar', `✓ Bedrijf is nu zichtbaar voor ${user.email}`);
      }

      // Reload AppContext to update dropdown immediately
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error('Error toggling company visibility:', error);
      showError('Fout', 'Kon zichtbaarheid niet wijzigen');
    } finally {
      setLoadingCompanyId(null);
    }
  };

  const handleEnableAll = async () => {
    if (!user || hiddenCompanies.length === 0) return;

    try {
      setLoadingCompanyId('all');
      const allIds = allCompanies.map(c => c.id);

      await saveUserSettings(user.uid, {
        visibleCompanyIds: allIds
      });

      setVisibleCompanyIds(allIds);
      success('Alle zichtbaar', `✓ ${hiddenCompanies.length} bedrijven zijn nu zichtbaar`);

      // Reload AppContext to update dropdown
      window.location.reload();
    } catch (error) {
      console.error('Error enabling all companies:', error);
      showError('Fout', 'Kon niet alle bedrijven activeren');
    } finally {
      setLoadingCompanyId(null);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500 dark:text-gray-300">Laden...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
          <Building2 className="h-5 w-5 text-primary-600" />
          Bedrijven Zichtbaarheid (Persoonlijk)
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Kies welke bedrijven <strong>voor jou</strong> zichtbaar zijn in de bedrijfenkeuze. Deze instelling is persoonlijk - andere gebruikers (admin/co-admin) kunnen hun eigen voorkeuren instellen.
        </p>
      </div>

      {/* Summary */}
      <div className="p-3 bg-primary-50 rounded-lg border border-primary-200">
        <p className="text-sm font-medium text-primary-900">
          {totalVisible} van {totalCompanies} bedrijven zichtbaar
        </p>
      </div>

      {/* Visible Companies */}
      {visibleCompanies.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Zichtbare bedrijven</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {visibleCompanies.map(company => (
              <div
                key={company.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 hover:border-green-300 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {company.logoUrl ? (
                    <img
                      src={company.logoUrl}
                      alt={company.name}
                      className="h-8 w-8 object-contain rounded"
                    />
                  ) : (
                    <div className="h-8 w-8 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{company.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-300 capitalize">{company.companyType}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleCompanyVisibility(company.id, true)}
                  disabled={loadingCompanyId !== null || totalVisible === 1}
                  className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={totalVisible === 1 ? "Minimaal 1 bedrijf moet zichtbaar zijn" : "Verbergen"}
                >
                  {loadingCompanyId === company.id ? (
                    <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden Companies */}
      {hiddenCompanies.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Verborgen bedrijven</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {hiddenCompanies.map(company => (
              <div
                key={company.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-600 hover:border-gray-400 transition-colors opacity-75"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {company.logoUrl ? (
                    <img
                      src={company.logoUrl}
                      alt={company.name}
                      className="h-8 w-8 object-contain rounded opacity-50"
                    />
                  ) : (
                    <div className="h-8 w-8 bg-gray-200 rounded flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{company.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-300 capitalize">{company.companyType}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleCompanyVisibility(company.id, false)}
                  disabled={loadingCompanyId !== null}
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                  title="Tonen"
                >
                  {loadingCompanyId === company.id ? (
                    <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Enable All Button */}
          {hiddenCompanies.length > 0 && (
            <button
              onClick={handleEnableAll}
              disabled={loadingCompanyId !== null}
              className="w-full mt-3 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg border border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Alle bedrijven tonen
            </button>
          )}
        </div>
      )}

      {/* No Hidden Companies */}
      {hiddenCompanies.length === 0 && (
        <div className="p-4 bg-green-50 rounded-lg text-center border border-green-200">
          <p className="text-sm text-green-800">
            ✓ Alle bedrijven zijn zichtbaar in de dropdown
          </p>
        </div>
      )}
    </div>
  );
};

export default CompaniesVisibilitySettings;