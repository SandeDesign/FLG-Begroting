import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Upload,
  Receipt,
  BookOpen,
  FileInput,
  Handshake,
  Wallet,
  Users as UsersIcon,
  PieChart,
  Send,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import StatTile from '../../components/ui/StatTile';
import PageHeader from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { useApp } from '../../contexts/AppContext';
import { usePageTitle } from '../../contexts/PageTitleContext';

const BoekhouderDashboard: React.FC = () => {
  const { companies, selectedCompany, setSelectedCompany } = useApp();
  const navigate = useNavigate();
  usePageTitle('Boekhouder Dashboard');

  // Groepeer bedrijven per administratie (= per admin userId)
  const adminGroups = useMemo(() => {
    const map = new Map<string, { ownerUserId: string; companies: typeof companies }>();
    companies.forEach((c) => {
      const existing = map.get(c.userId) || { ownerUserId: c.userId, companies: [] as typeof companies };
      existing.companies = [...existing.companies, c];
      map.set(c.userId, existing);
    });
    return Array.from(map.values());
  }, [companies]);

  if (companies.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Nog geen toegang"
        description="Je bent nog niet toegewezen aan een admin. Vraag de admin om jouw e-mailadres toe te voegen bij Instellingen → Boekhouders."
      />
    );
  }

  // Helper: kies het eerste bedrijf binnen een administratie zodat
  // selectedCompany.userId klopt voor de queries op die admin.
  const activateAdmin = (ownerUserId: string) => {
    const group = adminGroups.find(g => g.ownerUserId === ownerUserId);
    const first = group?.companies[0];
    if (first) setSelectedCompany(first);
  };

  const goToAdminAction = (ownerUserId: string, path: string) => {
    activateAdmin(ownerUserId);
    navigate(path);
  };

  const isAdminActive = (ownerUserId: string) => selectedCompany?.userId === ownerUserId;

  const primaryActions = [
    { label: 'Bank', icon: FileInput, path: '/boekhouder/bank-statement-import', accent: 'sky' as const },
    { label: 'BTW', icon: Wallet, path: '/boekhouder/btw-overzicht', accent: 'amber' as const },
    { label: 'Uploads', icon: Upload, path: '/boekhouder/upload', accent: 'bronze' as const },
    { label: 'Grootboek', icon: BookOpen, path: '/boekhouder/grootboekrekeningen', accent: 'purple' as const },
  ];

  const secondaryActions = [
    { label: 'Verkoop', icon: Send, path: '/boekhouder/outgoing-invoices' },
    { label: 'Inkoop', icon: PieChart, path: '/boekhouder/incoming-invoices-stats' },
    { label: 'Declaraties', icon: Receipt, path: '/boekhouder/admin-expenses' },
    { label: 'Relaties', icon: Handshake, path: '/boekhouder/invoice-relations' },
  ];

  const accentClasses: Record<'sky' | 'amber' | 'bronze' | 'purple', { bg: string; text: string; ring: string }> = {
    sky:    { bg: 'bg-sky-50 dark:bg-sky-900/20',     text: 'text-sky-600 dark:text-sky-400',     ring: 'group-hover:ring-sky-200 dark:group-hover:ring-sky-700' },
    amber:  { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', ring: 'group-hover:ring-amber-200 dark:group-hover:ring-amber-700' },
    bronze: { bg: 'bg-primary-50 dark:bg-primary-900/20', text: 'text-primary-600 dark:text-primary-400', ring: 'group-hover:ring-primary-200 dark:group-hover:ring-primary-700' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', ring: 'group-hover:ring-purple-200 dark:group-hover:ring-purple-700' },
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <PageHeader
        title="Boekhouder Dashboard"
        subtitle={`Je beheert ${adminGroups.length} administratie${adminGroups.length === 1 ? '' : 's'} met in totaal ${companies.length} bedrij${companies.length === 1 ? 'f' : 'ven'}`}
        emoji="🤝"
        actions={
          <div className="hidden sm:flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-lg px-3 py-1.5">
            <Handshake className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            <span className="text-xs font-semibold text-primary-700 dark:text-primary-300 tracking-tight">
              {selectedCompany ? `Actief: ${selectedCompany.name}` : 'Kies een administratie'}
            </span>
          </div>
        }
      />

      {/* Overzicht stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatTile label="Administraties" value={adminGroups.length}   sub="onder beheer"           emoji="🤝" tone="bronze" />
        <StatTile label="Bedrijven"      value={companies.length}     sub="in totaal"              emoji="🏢" tone="sky" />
        <StatTile label="Werkgevers"     value={companies.filter(c => c.companyType === 'employer').length} sub="met loonadministratie" emoji="💼" tone="emerald" />
      </div>

      {/* Snelle acties */}
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">Snelle acties</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {primaryActions.map((action) => {
            const c = accentClasses[action.accent];
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className={`group bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xs hover:shadow-md transition-all duration-200 px-4 py-5 flex flex-col items-center gap-2.5 hover:-translate-y-0.5 ring-1 ring-transparent ${c.ring}`}
              >
                <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center`}>
                  <action.icon className={`h-5 w-5 ${c.text}`} />
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">{action.label}</span>
              </button>
            );
          })}
        </div>

        {/* Secundair */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          {secondaryActions.map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-500 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-colors text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              <action.icon className="h-4 w-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
              <span className="truncate">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Administraties */}
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 tracking-tight">
          <Handshake className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          Administraties die je beheert
        </h2>
        <div className="space-y-3">
          {adminGroups.map((group) => {
            const isActive = isAdminActive(group.ownerUserId);
            const numEmployerCompanies = group.companies.filter(c => c.companyType === 'employer').length;
            return (
              <div
                key={group.ownerUserId}
                className={`relative bg-white dark:bg-gray-800 rounded-2xl border shadow-xs transition-all overflow-hidden ${
                  isActive
                    ? 'border-primary-300 dark:border-primary-700 ring-1 ring-primary-300 dark:ring-primary-700/50'
                    : 'border-gray-100 dark:border-gray-700 hover:shadow-md'
                }`}
              >
                {isActive && (
                  <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary-400 to-primary-600" />
                )}
                <div className="p-5">
                  {/* Administratie header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isActive
                          ? 'bg-gradient-to-br from-primary-400 to-primary-600 shadow-glow-primary'
                          : 'bg-primary-50 dark:bg-primary-900/30'
                      }`}>
                        <Handshake className={`h-5 w-5 ${isActive ? 'text-white' : 'text-primary-600 dark:text-primary-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate tracking-tight">
                          Administratie #{group.ownerUserId.substring(0, 6)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {group.companies.length} bedrij{group.companies.length === 1 ? 'f' : 'ven'}
                          {numEmployerCompanies > 0 && ` · ${numEmployerCompanies} werkgever${numEmployerCompanies === 1 ? '' : 's'}`}
                        </p>
                      </div>
                    </div>
                    {isActive && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-500 dark:bg-primary-400" />
                        Actief
                      </span>
                    )}
                  </div>

                  {/* Directe acties */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    {primaryActions.map(a => (
                      <button
                        key={a.path}
                        onClick={() => goToAdminAction(group.ownerUserId, a.path)}
                        className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-500 hover:bg-white dark:hover:bg-gray-700 transition-colors text-xs font-semibold text-gray-700 dark:text-gray-200"
                      >
                        <a.icon className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                        <span>{a.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Bedrijven */}
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-700/60">
                    <p className="text-[10px] uppercase tracking-[0.08em] font-bold text-gray-400 dark:text-gray-500 mb-2.5">
                      Bedrijven
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.companies.map((company) => {
                        const isSelected = selectedCompany?.id === company.id;
                        return (
                          <button
                            key={company.id}
                            onClick={() => setSelectedCompany(company)}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                              isSelected
                                ? 'border-primary-500 bg-primary-500 text-white shadow-glow-primary'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/40 text-gray-700 dark:text-gray-200 hover:border-primary-300 dark:hover:border-primary-500'
                            }`}
                          >
                            {company.logoUrl ? (
                              <img src={company.logoUrl} alt="" className="h-4 w-4 rounded object-contain bg-white" />
                            ) : (
                              <Building2 className="h-3.5 w-3.5" />
                            )}
                            <span className="truncate max-w-[160px]">{company.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info card */}
      <Card accent="info">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex-shrink-0">
            <UsersIcon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5 tracking-tight">Werken met meerdere administraties</p>
            <ul className="space-y-1 list-disc list-inside marker:text-gray-300 dark:marker:text-gray-600">
              <li>Klik op een bedrijf om dat als actieve context te zetten — alle acties werken dan voor die administratie</li>
              <li>Bank, BTW, Uploads en Grootboek zijn je hoofdtaken per administratie</li>
              <li>Verkoop en Inkoop zijn read-only; Grootboek en Bank mag je volledig beheren</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BoekhouderDashboard;
