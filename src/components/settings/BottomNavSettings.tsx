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
import {
  Clock,
  Users,
  Send,
  Upload,
  CheckCircle2,
  TrendingUp,
  Wallet,
  Cpu,
  Settings,
  Save,
  RotateCcw,
  Home,
  MoreVertical,
  ListTodo,
  PieChart,
  BookOpen,
  FileInput,
  Handshake,
  Receipt,
  MessageSquare,
} from 'lucide-react';

type IconOption = { name: string; icon: any; label: string; gradient: string };

// Icons voor admin / manager (de originele set)
const ADMIN_ICONS: IconOption[] = [
  { name: 'Clock', icon: Clock, label: 'Uren', gradient: 'from-blue-500 to-blue-600' },
  { name: 'Users', icon: Users, label: 'Team', gradient: 'from-purple-500 to-purple-600' },
  { name: 'Send', icon: Send, label: 'Verkoop', gradient: 'from-green-500 to-green-600' },
  { name: 'Upload', icon: Upload, label: 'Upload', gradient: 'from-orange-500 to-orange-600' },
  { name: 'PieChart', icon: PieChart, label: 'Inkoop', gradient: 'from-orange-500 to-orange-600' },
  { name: 'CheckCircle2', icon: CheckCircle2, label: 'Goedkeuren', gradient: 'from-emerald-500 to-emerald-600' },
  { name: 'TrendingUp', icon: TrendingUp, label: 'Stats', gradient: 'from-indigo-500 to-indigo-600' },
  { name: 'Wallet', icon: Wallet, label: 'Begroting', gradient: 'from-pink-500 to-pink-600' },
  { name: 'Cpu', icon: Cpu, label: 'Productie', gradient: 'from-cyan-500 to-cyan-600' },
  { name: 'ListTodo', icon: ListTodo, label: 'Taken', gradient: 'from-amber-500 to-amber-600' },
  { name: 'MessageSquare', icon: MessageSquare, label: 'Berichten', gradient: 'from-sky-500 to-sky-600' },
  { name: 'Settings', icon: Settings, label: 'Profiel', gradient: 'from-gray-500 to-gray-600' },
];

// Icons voor boekhouder — alleen pagina's waar zij toegang tot hebben
const BOEKHOUDER_ICONS: IconOption[] = [
  { name: 'Send', icon: Send, label: 'Verkoop', gradient: 'from-green-500 to-green-600' },
  { name: 'PieChart', icon: PieChart, label: 'Inkoop', gradient: 'from-orange-500 to-orange-600' },
  { name: 'BookOpen', icon: BookOpen, label: 'Grootboek', gradient: 'from-purple-500 to-purple-600' },
  { name: 'Wallet', icon: Wallet, label: 'BTW', gradient: 'from-amber-500 to-amber-600' },
  { name: 'FileInput', icon: FileInput, label: 'Bank', gradient: 'from-cyan-500 to-cyan-600' },
  { name: 'Upload', icon: Upload, label: 'Upload', gradient: 'from-orange-500 to-orange-600' },
  { name: 'Handshake', icon: Handshake, label: 'Relaties', gradient: 'from-indigo-500 to-indigo-600' },
  { name: 'Receipt', icon: Receipt, label: 'Declaraties', gradient: 'from-pink-500 to-pink-600' },
  { name: 'MessageSquare', icon: MessageSquare, label: 'Berichten', gradient: 'from-sky-500 to-sky-600' },
  { name: 'Settings', icon: Settings, label: 'Profiel', gradient: 'from-gray-500 to-gray-600' },
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

      // Prefix boekhouder paden
      const prefix = userRole === 'boekhouder' ? '/boekhouder' : '';
      const isBoekhouder = userRole === 'boekhouder';

      // Map icon names naar BottomNavItem objecten
      const bottomNavItems: BottomNavItem[] = selectedIcons.map(iconName => {
        const iconConfig = availableIcons.find(i => i.name === iconName);
        if (!iconConfig) throw new Error(`Icon ${iconName} not found`);

        // Bepaal href op basis van icon naam
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
        // Boekhouder-only icons
        else if (iconName === 'BookOpen') href = '/boekhouder/grootboekrekeningen';
        else if (iconName === 'FileInput') href = '/boekhouder/bank-statement-import';
        else if (iconName === 'Handshake') href = '/boekhouder/invoice-relations';
        else if (iconName === 'Receipt') href = '/boekhouder/admin-expenses';

        return {
          href,
          icon: iconName,
          label: iconConfig.label,
          gradient: iconConfig.gradient,
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
          bottomNavItems: {
            [selectedCompany.id]: bottomNavItems,
          },
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
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Preview:</p>
              <div className="flex items-center justify-around gap-2">
                {/* Dashboard - altijd fixed */}
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white mb-1">
                    <Home size={20} />
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-300 font-semibold">Dashboard</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 block">(fixed)</span>
                </div>

                {/* 3 custom iconen */}
                {selectedIcons.map((iconName, index) => {
                  const iconConfig = availableIcons.find(i => i.name === iconName);
                  const Icon = iconConfig?.icon;
                  return (
                    <div key={index} className="text-center">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconConfig?.gradient} flex items-center justify-center text-white mb-1`}>
                        {Icon && <Icon size={20} />}
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-300">{iconConfig?.label}</span>
                    </div>
                  );
                })}

                {/* Menu - altijd fixed */}
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center text-gray-600 dark:text-gray-300 mb-1">
                    <MoreVertical size={20} />
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-300 font-semibold">Menu</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 block">(fixed)</span>
                </div>
              </div>
            </div>

            {/* Icon selectors */}
            <div className="space-y-4">
              {[0, 1, 2].map((index) => (
                <div key={index}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Icon {index + 1}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {availableIcons.map((iconConfig) => {
                      const Icon = iconConfig.icon;
                      const isSelected = selectedIcons[index] === iconConfig.name;

                      return (
                        <button
                          key={iconConfig.name}
                          type="button"
                          onClick={() => handleIconSelect(iconConfig.name, index)}
                          className={`p-3 rounded-lg border-2 transition-all ${ isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800' }`}
                        >
                          <div className={`w-12 h-12 mx-auto rounded-xl bg-gradient-to-br ${iconConfig.gradient} flex items-center justify-center text-white mb-2`}>
                            <Icon size={20} />
                          </div>
                          <p className="text-xs text-center font-medium text-gray-700 dark:text-gray-200">
                            {iconConfig.label}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="secondary"
                icon={RotateCcw}
                onClick={handleReset}
              >
                Reset naar standaard
              </Button>
              <Button
                type="button"
                icon={Save}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Opslaan...' : 'Opslaan'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
