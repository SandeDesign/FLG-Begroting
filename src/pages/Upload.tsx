import React, { useState, useEffect } from 'react';
import { Upload as UploadIcon, Mail, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { HardDrive } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import InkomendeFacturenTab from '../components/upload/InkomendeFacturenTab';
import InkomendePostTab from '../components/upload/InkomendePostTab';
import UitgaandeFacturenTab from '../components/upload/UitgaandeFacturenTab';

type TabKey = 'facturen' | 'post' | 'verkoop';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const TABS: TabDef[] = [
  { key: 'facturen', label: 'Inkomende Facturen', icon: UploadIcon, roles: ['admin', 'boekhouder'] },
  { key: 'post',     label: 'Inkomende Post',     icon: Mail,       roles: ['admin', 'co-admin', 'boekhouder'] },
  { key: 'verkoop',  label: 'Uitgaande Facturen', icon: Send,       roles: ['admin', 'boekhouder'] },
];

const Upload: React.FC = () => {
  const { userRole } = useAuth();
  const { selectedCompany: contextCompany, companies, setSelectedCompany } = useApp();
  usePageTitle('Upload');
  const [searchParams, setSearchParams] = useSearchParams();

  const companyIdFromUrl = searchParams.get('companyId');
  const tabFromUrl = searchParams.get('tab') as TabKey | null;

  useEffect(() => {
    if (companyIdFromUrl && companies.length > 0) {
      const targetCompany = companies.find(c => c.id === companyIdFromUrl);
      if (targetCompany && targetCompany.id !== contextCompany?.id) {
        setSelectedCompany(targetCompany);
      }
    }
  }, [companyIdFromUrl, companies, contextCompany?.id, setSelectedCompany]);

  const selectedCompany = companyIdFromUrl
    ? companies.find(c => c.id === companyIdFromUrl) || contextCompany
    : contextCompany;

  const visibleTabs = TABS.filter(t => userRole && t.roles.includes(userRole));
  const defaultTab: TabKey = visibleTabs[0]?.key || 'facturen';
  const activeTab: TabKey = (tabFromUrl && visibleTabs.some(t => t.key === tabFromUrl)) ? tabFromUrl : defaultTab;

  const setActiveTab = (key: TabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={HardDrive}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een bedrijf om te uploaden"
      />
    );
  }

  if (visibleTabs.length === 0) {
    return (
      <EmptyState
        icon={HardDrive}
        title="Geen toegang"
        description="Je hebt geen toegang tot de upload functionaliteit"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Upload</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
          Bestanden uploaden voor {selectedCompany.name}
        </p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 -mx-4 px-4 sm:mx-0 sm:px-0">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div>
        {activeTab === 'facturen' && <InkomendeFacturenTab selectedCompany={selectedCompany} />}
        {activeTab === 'post' && <InkomendePostTab selectedCompany={selectedCompany} />}
        {activeTab === 'verkoop' && <UitgaandeFacturenTab selectedCompany={selectedCompany} />}
      </div>
    </div>
  );
};

export default Upload;
