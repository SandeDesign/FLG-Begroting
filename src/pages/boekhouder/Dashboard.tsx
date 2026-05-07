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
  ArrowRight,
  PieChart,
  Send,
} from 'lucide-react';
import Card from '../../components/ui/Card';
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

  // Is een administratie momenteel 'actief' (d.w.z. bevat het geselecteerde bedrijf)?
  const isAdminActive = (ownerUserId: string) => selectedCompany?.userId === ownerUserId;

  return (
    <div className="space-y-6 pb-6">
      {/* Header — sobere info, geen totaal-bedragen over admins heen */}
      <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-900 p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Boekhouder Dashboard</h1>
            <p className="mt-1 text-sm text-white/80">
              Je beheert {adminGroups.length} administratie{adminGroups.length === 1 ? '' : 's'}
              {' '}met in totaal {companies.length} bedrij{companies.length === 1 ? 'f' : 'ven'}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/30">
            <Handshake className="h-4 w-4" />
            <span className="text-xs font-medium">
              {selectedCompany ? `Actief: ${selectedCompany.name}` : 'Kies een administratie'}
            </span>
          </div>
        </div>
      </div>

      {/* Snelle acties — focus op bank / btw / uploads / grootboek */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Snelle acties</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Bank', icon: FileInput, path: '/boekhouder/bank-statement-import', gradient: 'from-cyan-500 to-cyan-600' },
            { label: 'BTW', icon: Wallet, path: '/boekhouder/btw-overzicht', gradient: 'from-amber-500 to-amber-600' },
            { label: 'Uploads', icon: Upload, path: '/boekhouder/upload', gradient: 'from-blue-500 to-blue-600' },
            { label: 'Grootboek', icon: BookOpen, path: '/boekhouder/grootboekrekeningen', gradient: 'from-purple-500 to-purple-600' },
          ].map((action) => (
            <button key={action.path} onClick={() => navigate(action.path)} className="group">
              <div
                className={`rounded-xl p-5 bg-gradient-to-br ${action.gradient} text-white shadow-md hover:shadow-xl transition-all hover:scale-105 active:scale-95 flex flex-col items-center gap-2`}
              >
                <action.icon className="h-7 w-7" />
                <span className="text-sm font-semibold">{action.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Secundair: verkoop / inkoop / declaraties / relaties */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          {[
            { label: 'Verkoop', icon: Send, path: '/boekhouder/outgoing-invoices' },
            { label: 'Inkoop', icon: PieChart, path: '/boekhouder/incoming-invoices-stats' },
            { label: 'Declaraties', icon: Receipt, path: '/boekhouder/admin-expenses' },
            { label: 'Relaties', icon: Handshake, path: '/boekhouder/invoice-relations' },
          ].map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              <action.icon className="h-4 w-4 text-primary-600" />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Administraties — tab hoger dan bedrijven, 1 card per admin */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary-600" />
          Administraties die je beheert
        </h2>
        <div className="space-y-4">
          {adminGroups.map((group) => {
            const isActive = isAdminActive(group.ownerUserId);
            const numEmployerCompanies = group.companies.filter(c => c.companyType === 'employer').length;
            return (
              <Card key={group.ownerUserId}>
                <div
                  className={`p-4 rounded-2xl border-2 transition-colors ${
                    isActive
                      ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-900/10'
                      : 'border-transparent'
                  }`}
                >
                  {/* Administratie header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                        <Handshake className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          Administratie #{group.ownerUserId.substring(0, 6)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-300">
                          {group.companies.length} bedrij{group.companies.length === 1 ? 'f' : 'ven'}
                          {numEmployerCompanies > 0 && ` · ${numEmployerCompanies} werkgever${numEmployerCompanies === 1 ? '' : 's'}`}
                        </p>
                      </div>
                    </div>
                    {isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary-600 text-white font-medium flex-shrink-0">
                        Actief
                      </span>
                    )}
                  </div>

                  {/* Directe acties per administratie */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {[
                      { label: 'Bank', icon: FileInput, path: '/boekhouder/bank-statement-import' },
                      { label: 'BTW', icon: Wallet, path: '/boekhouder/btw-overzicht' },
                      { label: 'Uploads', icon: Upload, path: '/boekhouder/upload' },
                      { label: 'Grootboek', icon: BookOpen, path: '/boekhouder/grootboekrekeningen' },
                    ].map(a => (
                      <button
                        key={a.path}
                        onClick={() => goToAdminAction(group.ownerUserId, a.path)}
                        className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-white dark:hover:bg-gray-700 transition-all text-xs font-medium text-gray-700 dark:text-gray-200"
                      >
                        <a.icon className="h-3.5 w-3.5 text-primary-600" />
                        <span>{a.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Bedrijven binnen deze administratie — geen KPIs, alleen selectie */}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-300 mb-2">
                      Bedrijven
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.companies.map((company) => {
                        const isSelected = selectedCompany?.id === company.id;
                        return (
                          <button
                            key={company.id}
                            onClick={() => setSelectedCompany(company)}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                              isSelected
                                ? 'border-primary-500 bg-primary-600 text-white'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-primary-400'
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
              </Card>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <Card>
        <div className="p-4 flex items-start gap-3">
          <UsersIcon className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">Werken met meerdere administraties</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Klik op een bedrijf om dat als actieve context te zetten — alle acties werken dan voor die administratie</li>
              <li>Bank, BTW, Uploads en Grootboek zijn je hoofdtaken per administratie</li>
              <li>Verkoop en Inkoop zijn read-only; Grootboek en Bank mag je volledig beheren</li>
            </ul>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5 hidden sm:block" />
        </div>
      </Card>
    </div>
  );
};

export default BoekhouderDashboard;
