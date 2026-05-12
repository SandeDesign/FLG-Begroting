import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Building2,
  User,
  Mail,
  Lock,
  Camera,
  Check,
  UserPlus,
  X as XIcon,
  Star,
  Moon,
  Sun,
  Calendar,
  FileText,
  Link2,
  Link2Off,
  Eye,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useDarkMode } from '../contexts/DarkModeContext';
import { getUserSettings, saveUserSettings } from '../services/firebase';
import { updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { createFirebaseUser } from '../utils/firebaseAuth';
import { doc, updateDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { usePageTitle } from '../contexts/PageTitleContext';
import { getFilteredNavigation, CompanyType } from '../utils/menuConfig';
import CompaniesVisibilitySettings from '../components/settings/CompaniesVisibilitySettings';
import { BottomNavSettings } from '../components/settings/BottomNavSettings';
import { outgoingInvoiceService } from '../services/outgoingInvoiceService';
import PushDiagnostics from '../components/notifications/PushDiagnostics';
// ✅ Ensure this component is placed at: src/components/settings/CompaniesVisibilitySettings.tsx

// Microsoft Koppeling Component
const MicrosoftConnectionCard: React.FC = () => {
  const { user } = useAuth();
  const { success: showSuccess, error: showErr } = useToast();
  const [msConnected, setMsConnected] = React.useState(false);
  const [msEmail, setMsEmail] = React.useState('');
  const [msLoading, setMsLoading] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const { isMicrosoftConnected: isConnected, getMicrosoftAccount: getAccount } = await import('../services/microsoftService');
      const connected = await isConnected();
      setMsConnected(connected);
      if (connected) {
        const account = await getAccount();
        setMsEmail(account?.username || '');
      }
    } catch {
      // Microsoft niet beschikbaar
    } finally {
      setChecking(false);
    }
  };

  const handleConnect = async () => {
    if (!user) return;
    setMsLoading(true);
    try {
      const { loginMicrosoft, saveMicrosoftConnection } = await import('../services/microsoftService');
      const account = await loginMicrosoft();
      if (account) {
        await saveMicrosoftConnection(user.uid, account);
        setMsConnected(true);
        setMsEmail(account.username || '');
        showSuccess('Microsoft account gekoppeld');
      }
    } catch {
      showErr('Fout bij koppelen van Microsoft account');
    } finally {
      setMsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setMsLoading(true);
    try {
      const { disconnectMicrosoft } = await import('../services/microsoftService');
      await disconnectMicrosoft(user.uid);
      setMsConnected(false);
      setMsEmail('');
      showSuccess('Microsoft account ontkoppeld');
    } catch {
      showErr('Fout bij ontkoppelen');
    } finally {
      setMsLoading(false);
    }
  };

  if (checking) return null;

  return (
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary-600" />
          Microsoft Account
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">
          Koppel je Microsoft account om je Outlook-agenda te zien in de takenagenda. Zo kun je taken realistisch inplannen rondom je bestaande afspraken.
        </p>
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {msConnected ? 'Gekoppeld' : 'Niet gekoppeld'}
            </p>
            {msEmail && (
              <p className="text-sm text-gray-500 dark:text-gray-300">{msEmail}</p>
            )}
          </div>
          {msConnected ? (
            <button
              onClick={handleDisconnect}
              disabled={msLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-50 dark:bg-gray-700 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
            >
              <Link2Off className="h-4 w-4" />
              {msLoading ? 'Bezig...' : 'Ontkoppelen'}
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={msLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" />
              {msLoading ? 'Verbinden...' : 'Koppelen'}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
};

const Settings: React.FC = () => {
  const { user, userRole } = useAuth();
  const { companies, selectedCompany, selectedYear, setSelectedYear } = useApp();
  const { success, error: showError } = useToast();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  usePageTitle('Instellingen');
  const [activeTab, setActiveTab] = useState<'account' | 'visibility' | 'default-company' | 'year-filter' | 'invoice' | 'co-admins' | 'boekhouders' | 'favorites' | 'mobile-nav'>('account');
  const [loading, setLoading] = useState(false);
  const [selectedDefaultCompanyId, setSelectedDefaultCompanyId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Account settings state
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePhotoBase64, setProfilePhotoBase64] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string>('');

  // Co-admin state
  const [coAdminEmail, setCoAdminEmail] = useState('');
  const [coAdmins, setCoAdmins] = useState<string[]>([]);

  // Boekhouder state
  const [boekhouderEmail, setBoekhouderEmail] = useState('');
  const [boekhouders, setBoekhouders] = useState<string[]>([]);

  // Favorites state - nu per bedrijf
  const [favoritePages, setFavoritePages] = useState<string[]>([]);

  // Invoice prefix & next number state
  const [invoicePrefix, setInvoicePrefix] = useState<string>('');
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<string>('');
  const [loadingInvoiceNumber, setLoadingInvoiceNumber] = useState(false);

  useEffect(() => {
    if (user && (userRole === 'admin' || userRole === 'co-admin') && activeTab === 'company') {
      loadDefaultCompany();
    }
  }, [user, userRole, activeTab, selectedCompany?.id]);

  // Load next invoice number when company changes
  useEffect(() => {
    if (user && selectedCompany && activeTab === 'company') {
      loadNextInvoiceNumber();
    }
  }, [user, selectedCompany?.id, selectedCompany?.invoicePrefix, activeTab]);

  useEffect(() => {
    if (user) {
      setNewEmail(user.email || '');
      loadProfilePhoto();
    }
  }, [user]);

  const loadDefaultCompany = async () => {
    if (!user) return;

    try {
      const settings = await getUserSettings(user.uid);
      console.log('Loading settings:', settings);
      setSelectedDefaultCompanyId(settings?.defaultCompanyId || '');
      setCoAdmins(settings?.coAdminEmails || []);
      setBoekhouders(settings?.boekhouderEmails || []);

      // Ensure favoritePages is an object, not an array
      const favoritePages = settings?.favoritePages;
      const favoritePagesObj = favoritePages && typeof favoritePages === 'object' && !Array.isArray(favoritePages)
        ? favoritePages
        : {};

      // Load favorites voor het geselecteerde bedrijf
      if (selectedCompany?.id) {
        console.log(`Loading favorites for company ${selectedCompany.name} (${selectedCompany.id}):`, favoritePagesObj[selectedCompany.id]);
        setFavoritePages(favoritePagesObj[selectedCompany.id] || []);
      } else {
        console.log('No company selected, resetting to empty');
        setFavoritePages([]);
      }
    } catch (error) {
      console.error('Error loading default company:', error);
    }
  };

  const loadNextInvoiceNumber = async () => {
    if (!user || !selectedCompany) return;

    try {
      setLoadingInvoiceNumber(true);

      const nextNumber = await outgoingInvoiceService.getNextInvoiceNumber(user.uid, selectedCompany.id);
      setNextInvoiceNumber(nextNumber);
      console.log('📋 Next invoice number:', nextNumber);

      // ✅ Parse prefix from next invoice number (always fresh from DB)
      // Format: "PREFIX-001" or "001" (no prefix)
      const lastDashIndex = nextNumber.lastIndexOf('-');
      if (lastDashIndex !== -1) {
        // Has prefix: extract everything before last dash
        const extractedPrefix = nextNumber.substring(0, lastDashIndex);
        setInvoicePrefix(extractedPrefix);
      } else {
        // No prefix
        setInvoicePrefix('');
      }
    } catch (error) {
      console.error('Error loading next invoice number:', error);
      setNextInvoiceNumber('Error');
      setInvoicePrefix('');
    } finally {
      setLoadingInvoiceNumber(false);
    }
  };

  const handleAddCoAdmin = async () => {
    if (!user || !coAdminEmail) return;

    if (!coAdminEmail.includes('@')) {
      showError('Ongeldig e-mailadres', 'Voer een geldig e-mailadres in');
      return;
    }

    if (coAdmins.includes(coAdminEmail)) {
      showError('Al toegevoegd', 'Deze gebruiker is al een co-admin');
      return;
    }

    try {
      setSaving(true);

      // Try to create Firebase Authentication account
      console.log('Creating Firebase Auth account for:', coAdminEmail);
      const result = await createFirebaseUser(coAdminEmail, 'DeInstallatie1234!!');

      console.log('Account creation result:', result);

      if (!result.success) {
        showError('Account aanmaken mislukt', result.error || 'Kon Firebase account niet aanmaken');
        return;
      }

      if (result.alreadyExists) {
        success('Account bestaat al', `${coAdminEmail} heeft al een bestaand account`);
      } else {
        // Create Firestore user document for new account
        if (result.uid) {
          try {
            console.log('Creating Firestore user document for UID:', result.uid);

            // Create user role document in 'users' collection (required for getUserRole)
            await addDoc(collection(db, 'users'), {
              uid: result.uid,
              role: 'admin',
              email: coAdminEmail,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            });

            console.log('User role document created in users collection');

            // Also create user settings document with PRIMARY ADMIN reference
            await saveUserSettings(result.uid, {
              email: coAdminEmail,
              defaultCompanyId: companies.length > 0 ? companies[0].id : undefined,
              primaryAdminUserId: user.uid,  // ✅ DIRECT LINK to primary admin
              primaryAdminEmail: user.email, // ✅ For reference
            });

            console.log('Firestore user documents created successfully');
          } catch (firestoreError) {
            console.error('Error creating Firestore document:', firestoreError);
            showError('Waarschuwing', 'Account aangemaakt maar kon gebruikersprofiel niet initialiseren');
          }
        }
        success('Account aangemaakt!', `Er is een account aangemaakt voor ${coAdminEmail} met wachtwoord: DeInstallatie1234!!`);
      }

      // Add to co-admin list in PRIMARY ADMIN's settings
      const newCoAdmins = [...coAdmins, coAdminEmail];
      await saveUserSettings(user.uid, { coAdminEmails: newCoAdmins });
      setCoAdmins(newCoAdmins);
      setCoAdminEmail('');
      success('Co-admin toegevoegd', `${coAdminEmail} heeft nu toegang tot al je bedrijven`);
    } catch (error) {
      console.error('Error adding co-admin:', error);
      showError('Fout bij toevoegen', 'Kon co-admin niet toevoegen');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCoAdmin = async (email: string) => {
    if (!user) return;

    try {
      setSaving(true);
      const newCoAdmins = coAdmins.filter(e => e !== email);
      await saveUserSettings(user.uid, { coAdminEmails: newCoAdmins });
      setCoAdmins(newCoAdmins);
      success('Co-admin verwijderd', `${email} heeft geen toegang meer`);
    } catch (error) {
      console.error('Error removing co-admin:', error);
      showError('Fout bij verwijderen', 'Kon co-admin niet verwijderen');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBoekhouder = async () => {
    if (!user || !boekhouderEmail) return;

    if (!boekhouderEmail.includes('@')) {
      showError('Ongeldig e-mailadres', 'Voer een geldig e-mailadres in');
      return;
    }

    if (boekhouders.includes(boekhouderEmail)) {
      showError('Al toegevoegd', 'Deze boekhouder heeft al toegang');
      return;
    }

    try {
      setSaving(true);

      // Probeer een Firebase account aan te maken (bestaand account → alleen linken)
      const result = await createFirebaseUser(boekhouderEmail, 'DeInstallatie1234!!');
      if (!result.success) {
        showError('Account aanmaken mislukt', result.error || 'Kon Firebase account niet aanmaken');
        return;
      }

      if (result.alreadyExists) {
        success('Account bestaat al', `${boekhouderEmail} heeft al een bestaand account`);
      } else if (result.uid) {
        // Nieuw account: maak user role aan als boekhouder
        try {
          await addDoc(collection(db, 'users'), {
            uid: result.uid,
            role: 'boekhouder',
            email: boekhouderEmail,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
          // Initiële userSettings met deze admin in assignedAdminUserIds
          await saveUserSettings(result.uid, {
            email: boekhouderEmail,
            assignedAdminUserIds: [user.uid],
          });
        } catch (firestoreError) {
          console.error('Error creating boekhouder documents:', firestoreError);
          showError('Waarschuwing', 'Account aangemaakt maar kon profiel niet initialiseren');
        }
        success('Account aangemaakt!', `Boekhouder ${boekhouderEmail} aangemaakt met wachtwoord: DeInstallatie1234!!`);
      }

      // Voeg email toe aan admin's boekhouderEmails lijst
      const newBoekhouders = [...boekhouders, boekhouderEmail];
      await saveUserSettings(user.uid, { boekhouderEmails: newBoekhouders });
      setBoekhouders(newBoekhouders);
      setBoekhouderEmail('');
      success('Boekhouder toegevoegd', `${boekhouderEmail} kan nu jouw financiële gegevens inzien`);
    } catch (error) {
      console.error('Error adding boekhouder:', error);
      showError('Fout bij toevoegen', 'Kon boekhouder niet toevoegen');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveBoekhouder = async (email: string) => {
    if (!user) return;

    try {
      setSaving(true);
      const newBoekhouders = boekhouders.filter(e => e !== email);
      await saveUserSettings(user.uid, { boekhouderEmails: newBoekhouders });
      setBoekhouders(newBoekhouders);
      success('Boekhouder verwijderd', `${email} heeft geen toegang meer`);
    } catch (error) {
      console.error('Error removing boekhouder:', error);
      showError('Fout bij verwijderen', 'Kon boekhouder niet verwijderen');
    } finally {
      setSaving(false);
    }
  };

  const loadProfilePhoto = async () => {
    if (!user) return;

    try {
      const settings = await getUserSettings(user.uid);
      if (settings?.profilePhoto) {
        setProfilePhotoBase64(settings.profilePhoto);
        setPhotoPreview(settings.profilePhoto);
      }
    } catch (error) {
      console.error('Error loading profile photo:', error);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showError('Bestand te groot', 'Kies een afbeelding kleiner dan 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setProfilePhotoBase64(base64);
      setPhotoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfilePhoto = async () => {
    if (!user || !profilePhotoBase64) return;

    try {
      setSaving(true);
      await saveUserSettings(user.uid, { profilePhoto: profilePhotoBase64 });
      success('Profielfoto opgeslagen', 'Je profielfoto is bijgewerkt');
    } catch (error) {
      console.error('Error saving profile photo:', error);
      showError('Fout bij opslaan', 'Kon profielfoto niet opslaan');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!user || !newEmail || !currentPassword) {
      showError('Validatiefout', 'Vul alle velden in');
      return;
    }

    if (newEmail === user.email) {
      showError('Geen wijziging', 'Dit is al je huidige e-mailadres');
      return;
    }

    try {
      setSaving(true);

      // Re-authenticate
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update email
      await updateEmail(user, newEmail);

      success('E-mail bijgewerkt', 'Je e-mailadres is succesvol gewijzigd');
      setCurrentPassword('');
    } catch (error: any) {
      console.error('Error changing email:', error);
      if (error.code === 'auth/wrong-password') {
        showError('Verkeerd wachtwoord', 'Het huidige wachtwoord is onjuist');
      } else if (error.code === 'auth/email-already-in-use') {
        showError('E-mail in gebruik', 'Dit e-mailadres is al gekoppeld aan een ander account');
      } else {
        showError('Fout bij wijzigen', error.message || 'Kon e-mail niet wijzigen');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user || !currentPassword || !newPassword || !confirmPassword) {
      showError('Validatiefout', 'Vul alle velden in');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('Wachtwoorden komen niet overeen', 'Controleer je nieuwe wachtwoord');
      return;
    }

    if (newPassword.length < 6) {
      showError('Wachtwoord te kort', 'Gebruik minimaal 6 tekens');
      return;
    }

    try {
      setSaving(true);

      // Re-authenticate
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      success('Wachtwoord bijgewerkt', 'Je wachtwoord is succesvol gewijzigd');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        showError('Verkeerd wachtwoord', 'Het huidige wachtwoord is onjuist');
      } else {
        showError('Fout bij wijzigen', error.message || 'Kon wachtwoord niet wijzigen');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDefaultCompany = async () => {
    if (!user) return;

    try {
      setSaving(true);
      await saveUserSettings(user.uid, {
        defaultCompanyId: selectedDefaultCompanyId || undefined
      });
      success('Bedrijf opgeslagen', 'Je standaard bedrijf is ingesteld');
    } catch (error) {
      console.error('Error saving default company:', error);
      showError('Fout bij opslaan', 'Kon standaard bedrijf niet opslaan');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFavorite = (href: string) => {
    setFavoritePages(prev =>
      prev.includes(href)
        ? prev.filter(p => p !== href)
        : [...prev, href]
    );
  };

  const handleSaveFavorites = async () => {
    if (!user || !selectedCompany) {
      console.log('Cannot save: missing user or company', { user: !!user, selectedCompany: !!selectedCompany });
      return;
    }

    try {
      setSaving(true);
      console.log('Saving favorites for company:', selectedCompany.name, selectedCompany.id);
      console.log('Current favorite pages:', favoritePages);

      // Haal huidige settings op
      const currentSettings = await getUserSettings(user.uid);
      console.log('Current settings from DB:', currentSettings);

      // Ensure favoritePages is an object, not an array
      const existingFavorites = currentSettings?.favoritePages;
      const allFavorites = existingFavorites && typeof existingFavorites === 'object' && !Array.isArray(existingFavorites)
        ? { ...existingFavorites }
        : {};

      console.log('All existing favorites (ensured as object):', allFavorites);

      // Update favorieten voor dit specifieke bedrijf
      allFavorites[selectedCompany.id] = favoritePages;
      console.log('Updated favorites object:', allFavorites);

      await saveUserSettings(user.uid, {
        favoritePages: allFavorites
      });

      console.log('Favorites saved successfully!');
      success('Favorieten opgeslagen', `Favorieten voor ${selectedCompany.name} zijn bijgewerkt`);
    } catch (error) {
      console.error('Error saving favorites:', error);
      showError('Fout bij opslaan', 'Kon favorieten niet opslaan');
    } finally {
      setSaving(false);
    }
  };

  const isAdminOrManager = userRole === 'admin' || userRole === 'co-admin' || userRole === 'manager';
  const isPrimaryAdmin = userRole === 'admin';
  const isBoekhouder = userRole === 'boekhouder';
  const canCustomizeMobileNav = isAdminOrManager || isBoekhouder;
  const tabs = [
    { id: 'account', name: 'Account', icon: User },
    ...(isAdminOrManager ? [
      { id: 'visibility', name: 'Zichtbaarheid', icon: Eye },
      { id: 'default-company', name: 'Standaard Bedrijf', icon: Building2 },
      { id: 'year-filter', name: 'Jaar Filter', icon: Calendar },
      { id: 'invoice', name: 'Factuurnummer', icon: FileText },
      ...(isPrimaryAdmin ? [
        { id: 'co-admins', name: 'Co-Admins', icon: UserPlus },
        { id: 'boekhouders', name: 'Boekhouders', icon: UserPlus },
      ] : []),
      { id: 'favorites', name: 'Favorieten', icon: Star },
    ] : []),
    ...(canCustomizeMobileNav ? [
      { id: 'mobile-nav', name: 'Mobiele Nav', icon: Smartphone },
    ] : []),
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Instellingen</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Beheer je account en voorkeuren
          </p>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 -mx-4 px-4 sm:mx-0 sm:px-0">
        <nav className="-mb-px flex gap-3 sm:gap-6 lg:gap-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`${ activeTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 dark:text-gray-300 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:border-gray-600' } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-colors flex-shrink-0`}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* Push notifications diagnostics */}
          <Card>
            <div className="p-6">
              <PushDiagnostics />
            </div>
          </Card>

          {/* Profile Photo */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Profielfoto
              </h2>
              <div className="flex items-center gap-6">
                <div className="relative">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Profile"
                      className="h-24 w-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-full bg-primary-100 flex items-center justify-center border-4 border-gray-200 dark:border-gray-700">
                      <User className="h-12 w-12 text-primary-600" />
                    </div>
                  )}
                  <label
                    htmlFor="photo-upload"
                    className="absolute bottom-0 right-0 bg-primary-600 rounded-full p-2 cursor-pointer hover:bg-primary-700 transition-colors shadow-lg"
                  >
                    <Camera className="h-4 w-4 text-white" />
                    <input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                    Upload een profielfoto (max 2MB)
                  </p>
                  {profilePhotoBase64 && profilePhotoBase64 !== photoPreview && (
                    <Button
                      onClick={handleSaveProfilePhoto}
                      disabled={saving}
                      size="sm"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Opslaan
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Dark Mode */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                {isDarkMode ? (
                  <Moon className="h-5 w-5 text-primary-600" />
                ) : (
                  <Sun className="h-5 w-5 text-primary-600" />
                )}
                Weergave
              </h2>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Dark Mode
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-300">
                    {isDarkMode ? 'Donkere modus ingeschakeld' : 'Lichte modus ingeschakeld'}
                  </p>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${ isDarkMode ? 'bg-primary-600' : 'bg-gray-300' }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-800 shadow-lg transition-transform ${ isDarkMode ? 'translate-x-8' : 'translate-x-1' }`}
                  >
                    {isDarkMode ? (
                      <Moon className="h-5 w-5 text-primary-600 p-0.5" />
                    ) : (
                      <Sun className="h-5 w-5 text-gray-500 dark:text-gray-300 p-0.5" />
                    )}
                  </span>
                </button>
              </div>
            </div>
          </Card>

          {/* Microsoft Koppeling */}
          <MicrosoftConnectionCard />

          {/* Change Email */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                E-mailadres wijzigen
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Nieuw e-mailadres
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="nieuw@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Huidig wachtwoord (ter bevestiging)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleChangeEmail}
                  disabled={saving || !newEmail || !currentPassword}
                  loading={saving}
                >
                  E-mail wijzigen
                </Button>
              </div>
            </div>
          </Card>

          {/* Change Password */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Wachtwoord wijzigen
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Huidig wachtwoord
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Nieuw wachtwoord
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="••••••••"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">Minimaal 6 tekens</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Bevestig nieuw wachtwoord
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                  loading={saving}
                >
                  Wachtwoord wijzigen
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'visibility' && isAdminOrManager && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <CompaniesVisibilitySettings />
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'default-company' && isAdminOrManager && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Standaard Bedrijf
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Kies welk bedrijf standaard wordt geselecteerd wanneer je inlogt
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Selecteer bedrijf
                  </label>
                  <select
                    value={selectedDefaultCompanyId}
                    onChange={(e) => setSelectedDefaultCompanyId(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border rounded-lg border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Geen standaard (eerste bedrijf)</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  variant="primary"
                  onClick={handleSaveDefaultCompany}
                  disabled={saving}
                  loading={saving}
                >
                  Standaard bedrijf opslaan
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'year-filter' && isAdminOrManager && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary-600" />
                Jaar Filter
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Selecteer welk jaar wordt weergegeven voor productie, facturen en statistieken. <strong>Oude data blijft altijd toegankelijk</strong> door het jaar te wijzigen.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Selecteer jaar
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      const year = parseInt(e.target.value, 10);
                      setSelectedYear(year);
                      success('Jaar gewijzigd', `Data wordt nu gefilterd op jaar ${year}`);
                    }}
                    className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border rounded-lg border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map((year) => (
                      <option key={year} value={year}>
                        {year} {year === new Date().getFullYear() && '(huidig jaar)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Huidig geselecteerd jaar:</strong> {selectedYear}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Deze instelling wordt direct toegepast op alle pagina's met jaar-gerelateerde data
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'invoice' && isAdminOrManager && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary-600" />
                Factuurnummer Preview
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Bekijk welk factuurnummer de volgende factuur krijgt bij aanmaken. De prefix kun je wijzigen bij het bewerken van het bedrijf.
                </p>

                {selectedCompany ? (
                  <div className="space-y-3">
                    {/* Current Prefix */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Huidige prefix
                      </label>
                      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                          {invoicePrefix || '(geen prefix ingesteld)'}
                        </p>
                      </div>
                    </div>

                    {/* Next Invoice Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Eerstvolgende factuurnummer
                      </label>
                      <div className="px-4 py-3 bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                        {loadingInvoiceNumber ? (
                          <div className="flex items-center gap-2">
                            <LoadingSpinner className="h-4 w-4" />
                            <p className="text-sm text-gray-600 dark:text-gray-300">Laden...</p>
                          </div>
                        ) : (
                          <p className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300 tracking-tight">
                            {nextInvoiceNumber || 'N/A'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        <strong>Let op:</strong> Dit nummer wordt automatisch berekend op basis van de hoogste bestaande factuur met dezelfde prefix.
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Bij het wijzigen van de prefix (bijv. van FLG-2025 naar FLG-2026) reset de nummering automatisch naar 001.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-300 italic">
                    Selecteer een bedrijf om het volgende factuurnummer te zien
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'co-admins' && isAdminOrManager && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary-600" />
                Co-Admins Beheren
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Voeg andere gebruikers toe die toegang hebben tot <strong>al jouw bedrijven</strong> met dezelfde rechten als jij.
                </p>

                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="email"
                      value={coAdminEmail}
                      onChange={(e) => setCoAdminEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddCoAdmin()}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="email@voorbeeld.nl"
                    />
                  </div>
                  <Button
                    onClick={handleAddCoAdmin}
                    disabled={saving || !coAdminEmail}
                    size="sm"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Toevoegen
                  </Button>
                </div>

                {coAdmins.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Huidige co-admins:</p>
                    {coAdmins.map((email) => (
                      <div
                        key={email}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500 dark:text-gray-300" />
                          <span className="text-sm text-gray-900 dark:text-gray-100">{email}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveCoAdmin(email)}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 transition-colors"
                          disabled={saving}
                          title="Verwijderen"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {coAdmins.length === 0 && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-300">
                      Nog geen co-admins toegevoegd
                    </p>
                  </div>
                )}

                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>Let op:</strong> Co-admins krijgen volledige toegang tot al je bedrijven, werknemers en financiële gegevens. Voeg alleen vertrouwde personen toe.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'boekhouders' && isAdminOrManager && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-600" />
                Boekhouders Beheren
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Geef je boekhouder toegang tot <strong>al jouw bedrijven</strong>. De boekhouder ziet verkoop- en inkoopfacturen read-only,
                  en krijgt volledige toegang tot grootboek, BTW overzicht, bankafschriften en uploads.
                </p>

                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="email"
                      value={boekhouderEmail}
                      onChange={(e) => setBoekhouderEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddBoekhouder()}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="boekhouder@voorbeeld.nl"
                    />
                  </div>
                  <Button
                    onClick={handleAddBoekhouder}
                    disabled={saving || !boekhouderEmail}
                    size="sm"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Toevoegen
                  </Button>
                </div>

                {boekhouders.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Huidige boekhouders:</p>
                    {boekhouders.map((email) => (
                      <div
                        key={email}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500 dark:text-gray-300" />
                          <span className="text-sm text-gray-900 dark:text-gray-100">{email}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveBoekhouder(email)}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 transition-colors"
                          disabled={saving}
                          title="Verwijderen"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {boekhouders.length === 0 && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-300">
                      Nog geen boekhouders toegevoegd
                    </p>
                  </div>
                )}

                <div className="mt-4 p-3 bg-indigo-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-indigo-800 dark:text-indigo-300">
                    <strong>Let op:</strong> Boekhouders zien verkoop en inkoop alleen read-only, maar hebben wel volledige toegang
                    tot BTW, grootboek, bankafschriften en uploads. Boekhouders zien geen werknemers- of verlofgegevens.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'favorites' && isAdminOrManager && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                Favoriete Pagina's
              </h2>
              <div className="space-y-4">
                {selectedCompany ? (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Let op:</strong> Je stelt favorieten in voor <strong>{selectedCompany.name}</strong>.
                      Elk bedrijf heeft zijn eigen favorieten.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      Selecteer eerst een bedrijf om favorieten in te stellen.
                    </p>
                  </div>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Selecteer je favoriete pagina's om ze bovenaan het menu weer te geven voor snelle toegang.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {selectedCompany && getFilteredNavigation('admin', selectedCompany.companyType as CompanyType)
                    .filter(item => item.id !== 'dashboard')
                    .map((item) => {
                      const Icon = item.icon;
                      const isFavorite = favoritePages.includes(item.href);
                      return (
                        <button
                          key={item.href}
                          onClick={() => handleToggleFavorite(item.href)}
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${ isFavorite ? 'border-amber-400 bg-amber-50 hover:bg-amber-100' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:bg-gray-900' }`}
                        >
                          <div className={`p-2 rounded-lg ${ isFavorite ? 'bg-amber-100' : 'bg-gray-100 dark:bg-gray-800' }`}>
                            <Icon className={`h-4 w-4 ${ isFavorite ? 'text-amber-600' : 'text-gray-600 dark:text-gray-300 dark:text-gray-500' }`} />
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${ isFavorite ? 'text-amber-900' : 'text-gray-900 dark:text-gray-100' }`}>
                              {item.name}
                            </p>
                          </div>
                          {isFavorite && (
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          )}
                        </button>
                      );
                    })}
                </div>

                {favoritePages.length > 0 && (
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                    <p className="text-sm text-amber-800">
                      ✓ {favoritePages.length} favoriete pagina{favoritePages.length !== 1 ? "'s" : ''} geselecteerd
                    </p>
                  </div>
                )}

                <Button
                  variant="primary"
                  onClick={handleSaveFavorites}
                  disabled={saving || !selectedCompany}
                  loading={saving}
                >
                  <Star className="h-4 w-4 mr-2" />
                  Favorieten opslaan
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'mobile-nav' && canCustomizeMobileNav && (
        <div className="space-y-6">
          <BottomNavSettings />
        </div>
      )}
    </div>
  );
};

export default Settings;