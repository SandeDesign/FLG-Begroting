import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { BottomNavItem } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useToast } from '../../hooks/useToast';
import { getBottomNavDefaults, CompanyType } from '../../utils/menuConfig';
import { Save, RotateCcw } from 'lucide-react';

type IconOption = { name: string; emoji: string; label: string };

const ADMIN_ICONS: IconOption[] = [
  { name: 'Clock',        emoji: '⏱️', label: 'Uren' },
  { name: 'Users',        emoji: '👥', label: 'Team' },
  { name: 'Send',         emoji: '📤', label: 'Verkoop' },
  { name: 'Upload',       emoji: '📎', label: 'Upload' },
  { name: 'PieChart',     emoji: '📊', label: 'Inkoop' },
  { name: 'CheckCircle2', emoji: '✅', label: 'Goedkeuren' },
  { name: 'TrendingUp',   emoji: '📈', label: 'Stats' },
  { name: 'Wallet',       emoji: '💼', label: 'Begroting' },
  { name: 'Cpu',          emoji: '🏭', label: 'Productie' },
  { name: 'ListTodo',     emoji: '☑️', label: 'Taken' },
  { name: 'MessageSquare',emoji: '💬', label: 'Berichten' },
  { name: 'Settings',     emoji: '⚙️', label: 'Profiel' },
];

const BOEKHOUDER_ICONS: IconOption[] = [
  { name: 'Send',         emoji: '📤', label: 'Verkoop' },
  { name: 'PieChart',     emoji: '📊', label: 'Inkoop' },
  { name: 'BookOpen',     emoji: '📒', label: 'Grootboek' },
  { name: 'Wallet',       emoji: '🧮', label: 'BTW' },
  { name: 'FileInput',    emoji: '🏦', label: 'Bank' },
  { name: 'Upload',       emoji: '📎', label: 'Upload' },
  { name: 'Handshake',    emoji: '🤝', label: 'Relaties' },
  { name: 'Receipt',      emoji: '🧾', label: 'Declaraties' },
  { name: 'MessageSquare',emoji: '💬', label: 'Berichten' },
  { name: 'Settings',     emoji: '⚙️', label: 'Profiel' },
];

const getAvailableIcons = (role: string | null): IconOption[] =>
  role === 'boekhouder' ? BOEKHOUDER_ICONS : ADMIN_ICONS;

export const BottomNavSettings: React.FC = () => {
  const { user, userRole } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedIcons, setSelectedIcons] = useState<string[]>([]);

  const companyType = selectedCompany?.companyType as CompanyType | undefined;
  const availableIcons = getAvailableIcons(userRole);

  useEffect(() => {
    if (user && selectedCompany) {
      loadSettings();
    }
  }, [user, selectedCompany]);

  const loadSettings = async () => {
    if (!user || !selectedCompany) return;

    try {
      setLoading(true);
      const settingsRef = doc(db, 'userSettings', user.uid);
      const settingsDoc = await getDoc(settingsRef);

      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        const companyBottomNav = data.bottomNavItems?.[selectedCompany.id];

        if (companyBottomNav && companyBottomNav.length === 3) {
          setSelectedIcons(companyBottomNav.map((item: BottomNavItem) => item.icon));
        } else {
          loadDefaults();
        }
      } else {
        loadDefaults();
      }
    } catch (err) {
      console.error('Error loading bottom nav settings:', err);
      error('Fout bij laden van instellingen');
    } finally {
      setLoading(false);
    }
  };

  const loadDefaults = () => {
    const defaults = getBottomNavDefaults(userRole, companyType);
    setSelectedIcons(defaults.map(d => d.icon));
  };

  const handleIconSelect = (iconName: string, index: number) => {
    const newIcons = [...selectedIcons];
    newIcons[index] = iconName;
    setSelectedIcons(newIcons);
  };

  const handleSave = async () => {
    if (!user || !selectedCompany) return;
    if (selectedIcons.length !== 3) {
      error('Selecteer exact 3 iconen');
      return;
    }

    try {
      setSaving(true);

      const prefix = userRole === 'boekhouder' ? '/boekhouder' : '';
      const isBoekhouder = userRole === 'boekhouder';

      const bottomNavItems: BottomNavItem[] = selectedIcons.map(iconName => {
        const iconConfig = availableIcons.find(i => i.name === iconName);
        if (!iconConfig) throw new Error(`Icon ${iconName} not found`);

        let href = '/';
        if (iconName === 'Clock') href = '/timesheets';
        else if (iconName === 'Users') href = '/employees';
        else if (iconName === 'Send') href = `${prefix}/outgoing-invoices`;
        else if (iconName === 'Upload') href = `${prefix}/upload`;
        else if (iconName === 'CheckCircle2') href = (userRole === 'admin' || userRole === 'co-admin') ? '/timesheet-approvals' : '/payslips';
        else if (iconName === 'TrendingUp') href = `/statistics/${selectedCompany.companyType}`;
        else if (iconName === 'Wallet') href = isBoekhouder ? '/boekhouder/btw-overzicht' : '/budgeting';
        else if (iconName === 'Cpu') href = '/project-production';
        else if (iconName === 'PieChart') href = `${prefix}/incoming-invoices-stats`;
        else if (iconName === 'ListTodo') href = '/tasks';
        else if (iconName === 'Settings') href = `${prefix}/settings`;
        else if (iconName === 'MessageSquare') href = `${prefix}/chat`;
        else if (iconName === 'BookOpen') href = '/boekhouder/grootboekrekeningen';
        else if (iconName === 'FileInput') href = '/boekhouder/bank-statement-import';
        else if (iconName === 'Handshake') href = '/boekhouder/invoice-relations';
        else if (iconName === 'Receipt') href = '/boekhouder/admin-expenses';

        return {
          href,
          icon: iconName,
          label: iconConfig.label,
          gradient: 'from-primary-500 to-primary-600',
        };
      });

      const settingsRef = doc(db, 'userSettings', user.uid);
      const settingsDoc = await getDoc(settingsRef);

      if (settingsDoc.exists()) {
        await updateDoc(settingsRef, {
          [`bottomNavItems.${selectedCompany.id}`]: bottomNavItems,
          updatedAt: new Date(),
        });
      } else {
        await setDoc(settingsRef, {
          userId: user.uid,
          bottomNavItems: { [selectedCompany.id]: bottomNavItems },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      success('Bottom navigatie iconen opgeslagen');
    } catch (err) {
      console.error('Error saving bottom nav settings:', err);
      error('Fout bij opslaan');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadDefaults();
  };

  if (!selectedCompany) return null;

  return (
    <Card>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mobiele Bottom Navigatie</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Kies 3 iconen voor de mobiele bottom navigatie. Dashboard en Menu zijn altijd zichtbaar.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <>
            {/* Preview */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Preview</p>
              <div className="flex items-end justify-around gap-2">
                {/* Dashboard — fixed */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-glow-primary">
                    <span className="text-xl leading-none" aria-hidden>🏠</span>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-200">Dashboard</span>
                  <span className="text-[9px] text-gray-400">(fixed)</span>
                </div>

                {/* 3 custom icons */}
                {selectedIcons.map((iconName, index) => {
                  const iconConfig = availableIcons.find(i => i.name === iconName);
                  return (
                    <div key={index} className="flex flex-col items-center gap-1">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-glow-primary">
                        <span className="text-xl leading-none" aria-hidden>{iconConfig?.emoji ?? '?'}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-200">{iconConfig?.label}</span>
                    </div>
                  );
                })}

                {/* Menu — fixed */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <span className="text-xl leading-none" aria-hidden>☰</span>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-200">Menu</span>
                  <span className="text-[9px] text-gray-400">(fixed)</span>
                </div>
              </div>
            </div>

            {/* Icon selectors */}
            <div className="space-y-5">
              {[0, 1, 2].map((index) => (
                <div key={index}>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Positie {index + 1}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {availableIcons.map((iconConfig) => {
                      const isSelected = selectedIcons[index] === iconConfig.name;
                      return (
                        <button
                          key={iconConfig.name}
                          type="button"
                          onClick={() => handleIconSelect(iconConfig.name, index)}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                        >
                          <span className="text-2xl leading-none" aria-hidden>{iconConfig.emoji}</span>
                          <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200 text-center leading-tight">
                            {iconConfig.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
              <Button type="button" variant="secondary" icon={RotateCcw} onClick={handleReset}>
                Reset naar standaard
              </Button>
              <Button type="button" icon={Save} onClick={handleSave} disabled={saving}>
                {saving ? 'Opslaan...' : 'Opslaan'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
