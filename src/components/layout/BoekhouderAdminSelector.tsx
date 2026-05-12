import React, { useState, useMemo } from 'react';
import { Building2, ChevronDown, Handshake } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

interface Props {
  /**
   * Variant `mobile` opent het dropdown linksuit (zoals de bedrijfsselector
   * in de mobile header), `desktop` opent het rechts onder de knop.
   */
  variant: 'mobile' | 'desktop';
}

/**
 * Selector voor de boekhouder die administraties (admins) toont met
 * uitklap-submenu per administratie waarin de bedrijven van die admin staan.
 * Selecteren van een bedrijf zet de actieve company-context.
 */
const BoekhouderAdminSelector: React.FC<Props> = ({ variant }) => {
  const { companies, selectedCompany, setSelectedCompany, assignedAdmins } = useApp();
  const [open, setOpen] = useState(false);
  const [expandedAdminId, setExpandedAdminId] = useState<string | null>(null);

  // Groepeer companies per admin (userId)
  const adminGroups = useMemo(() => {
    const map = new Map<string, typeof companies>();
    companies.forEach((c) => {
      const existing = map.get(c.userId) || [];
      map.set(c.userId, [...existing, c]);
    });
    return Array.from(map.entries()).map(([userId, comps]) => {
      const info = assignedAdmins.find((a) => a.userId === userId);
      const label =
        info?.displayName ||
        info?.email ||
        `Administratie #${userId.substring(0, 6)}`;
      return { userId, label, companies: comps };
    });
  }, [companies, assignedAdmins]);

  const activeAdminLabel = useMemo(() => {
    if (!selectedCompany) return 'Kies administratie';
    const group = adminGroups.find((g) => g.userId === selectedCompany.userId);
    return group?.label || 'Administratie';
  }, [selectedCompany, adminGroups]);

  const toggleExpanded = (adminId: string) => {
    setExpandedAdminId((prev) => (prev === adminId ? null : adminId));
  };

  const handleSelectCompany = (company: (typeof companies)[number]) => {
    setSelectedCompany(company);
    setOpen(false);
    setExpandedAdminId(null);
  };

  // Trigger button — verschilt licht qua content per variant
  const triggerClasses =
    variant === 'mobile'
      ? 'flex items-center gap-1.5 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
      : 'flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-150 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-500 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-colors';

  const dropdownPosition =
    variant === 'mobile'
      ? 'absolute -left-48 top-full mt-1.5 w-72 lg:right-0'
      : 'absolute right-0 top-full mt-1.5 w-80';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={triggerClasses}
        title={activeAdminLabel}
      >
        <Handshake className="h-4 w-4 text-primary-600 dark:text-primary-400" />
        {variant === 'desktop' && (
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight max-w-[180px] truncate">
            {selectedCompany?.name || activeAdminLabel}
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 text-gray-400 dark:text-gray-500 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setOpen(false);
              setExpandedAdminId(null);
            }}
          />

          {/* Dropdown */}
          <div
            className={`${dropdownPosition} bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg z-20 max-h-[70vh] overflow-y-auto`}
          >
            <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-700">
              <p className="text-[10px] uppercase tracking-[0.08em] font-bold text-gray-400 dark:text-gray-500">
                Administraties
              </p>
            </div>

            <div className="p-1.5 space-y-0.5">
              {adminGroups.length === 0 && (
                <p className="px-3 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Nog geen administraties toegewezen
                </p>
              )}

              {adminGroups.map((group) => {
                const isExpanded = expandedAdminId === group.userId;
                const hasActive =
                  selectedCompany?.userId === group.userId;

                return (
                  <div key={group.userId}>
                    <button
                      onClick={() => toggleExpanded(group.userId)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                        hasActive
                          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-200'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-md flex-shrink-0 ${
                          hasActive ? 'bg-primary-500' : 'bg-gray-400 dark:bg-gray-600'
                        }`}
                      >
                        <Handshake className="h-3 w-3 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate tracking-tight">{group.label}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          {group.companies.length} bedrij{group.companies.length === 1 ? 'f' : 'ven'}
                        </p>
                      </div>
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="ml-5 mt-0.5 space-y-0.5 border-l border-gray-100 dark:border-gray-700 pl-2">
                        {group.companies.map((company) => {
                          const isSelected = selectedCompany?.id === company.id;
                          return (
                            <button
                              key={company.id}
                              onClick={() => handleSelectCompany(company)}
                              className={`w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors ${
                                isSelected
                                  ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-900 dark:text-primary-200 font-semibold'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200'
                              }`}
                            >
                              {company.logoUrl ? (
                                <img
                                  src={company.logoUrl}
                                  alt={company.name}
                                  className="h-6 w-6 rounded object-contain bg-white dark:bg-gray-700 ring-1 ring-gray-100 dark:ring-gray-600 flex-shrink-0"
                                />
                              ) : (
                                <div
                                  className={`p-1 rounded flex-shrink-0 ${
                                    isSelected
                                      ? 'bg-primary-500'
                                      : 'bg-gray-400 dark:bg-gray-600'
                                  }`}
                                >
                                  <Building2 className="h-3 w-3 text-white" />
                                </div>
                              )}
                              <span className="text-sm truncate">{company.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BoekhouderAdminSelector;
