import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { createCompany, updateCompany, getCompanies } from '../../services/firebase';
import { Company } from '../../types';
import { THEME_COLOR_PRESETS } from '../../utils/themeColors';

interface CompanyFormData {
  name: string;
  kvk: string;
  taxNumber: string;
  bankAccount?: string; // ✅ NIEUW: Bankrekening voor facturen
  invoicePrefix?: string; // ✅ NIEUW: Prefix voor factuurnummers (bijv. "FLG", "2025")
  street: string;
  city: string;
  zipCode: string;
  country: string;
  email: string;
  phone: string;
  website?: string;
  defaultCAO: string;
  travelAllowancePerKm: number;
  standardWorkWeek: number;
  holidayAllowancePercentage: number;
  pensionContributionPercentage: number;

  // ✅ NIEUW: Bedrijfstype fields
  companyType: 'employer' | 'project' | 'holding' | 'shareholder' | 'investor';
  primaryEmployerId?: string;
  themeColor?: string; // Theme color for this company
  logoUrl?: string; // Base64 encoded logo
}

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  company?: Company | null;
}

const CompanyModal: React.FC<CompanyModalProps> = ({ isOpen, onClose, onSuccess, company }) => {
  const { user, adminUserId } = useAuth();
  const { success, error: showError } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // ✅ NIEUW: State voor employer companies
  const [employerCompanies, setEmployerCompanies] = useState<Company[]>([]);

  // ✅ NIEUW: State voor logo upload
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<CompanyFormData>({
    defaultValues: {
      country: 'Nederland',
      defaultCAO: 'cao-algemeen',
      travelAllowancePerKm: 0.23,
      standardWorkWeek: 40,
      holidayAllowancePercentage: 8,
      pensionContributionPercentage: 6,
      companyType: 'employer', // Default naar employer
    }
  });

  // ✅ NIEUW: Watch companyType om UI aan te passen
  const companyType = watch('companyType');

  // ✅ NIEUW: Load employer companies voor project company selector
  useEffect(() => {
    const loadEmployerCompanies = async () => {
      if (user && adminUserId) {
        try {
          const companies = await getCompanies(adminUserId);
          const employers = companies.filter(c => c.companyType === 'employer');
          setEmployerCompanies(employers);
        } catch (error) {
          console.error('Error loading employer companies:', error);
        }
      }
    };

    if (isOpen) {
      loadEmployerCompanies();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (company) {
      reset({
        name: company.name,
        kvk: company.kvk,
        taxNumber: company.taxNumber,
        bankAccount: company.bankAccount, // ✅ NIEUW: Load bankAccount
        invoicePrefix: (company as any).invoicePrefix, // ✅ NIEUW: Load invoicePrefix
        street: company.address.street,
        city: company.address.city,
        zipCode: company.address.zipCode,
        country: company.address.country,
        email: company.contactInfo.email,
        phone: company.contactInfo.phone,
        website: company.contactInfo.website,
        defaultCAO: company.settings.defaultCAO,
        travelAllowancePerKm: company.settings.travelAllowancePerKm,
        standardWorkWeek: company.settings.standardWorkWeek,
        holidayAllowancePercentage: company.settings.holidayAllowancePercentage,
        pensionContributionPercentage: company.settings.pensionContributionPercentage,

        // ✅ NIEUW: Set company type fields
        companyType: company.companyType || 'employer',
        primaryEmployerId: company.primaryEmployerId,
        themeColor: company.themeColor || 'blue',
        logoUrl: company.logoUrl,
        hourlyRate: company.hourlyRate,
      });
      setLogoPreview(company.logoUrl || null);
    } else {
      reset({
        country: 'Nederland',
        defaultCAO: 'cao-algemeen',
        travelAllowancePerKm: 0.23,
        standardWorkWeek: 40,
        holidayAllowancePercentage: 8,
        pensionContributionPercentage: 6,
        companyType: 'employer',
        themeColor: 'blue',
      });
      setLogoPreview(null);
    }
  }, [company, reset]);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Ongeldig bestand', 'Upload een afbeelding (JPG, PNG, etc.)');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('Bestand te groot', 'Kies een afbeelding kleiner dan 5MB');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setLogoPreview(base64String);
    };
    reader.onerror = () => {
      showError('Upload mislukt', 'Kon afbeelding niet laden. Probeer het opnieuw.');
      event.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: CompanyFormData) => {
    if (!user) return;

    // ✅ NIEUW: Validatie voor project companies (holding is optioneel)
    if (data.companyType === 'project' && !data.primaryEmployerId) {
      showError('Primaire werkgever vereist', 'Selecteer een primaire werkgever voor dit projectbedrijf');
      return;
    }

    setSubmitting(true);
    try {
      // ✅ FIX: Build company data object without undefined values
      const companyData: any = {
        name: data.name,
        kvk: data.kvk,
        taxNumber: data.taxNumber,
        bankAccount: data.bankAccount, // ✅ NIEUW: Save bankAccount
        invoicePrefix: data.invoicePrefix || '', // ✅ NIEUW: Save invoicePrefix
        companyType: data.companyType,
        themeColor: data.themeColor || 'blue', // ✅ NIEUW: Save theme color
        logoUrl: logoPreview || '', // ✅ NIEUW: Save logo as base64
        address: {
          street: data.street,
          city: data.city,
          zipCode: data.zipCode,
          country: data.country,
        },
        contactInfo: {
          email: data.email,
          phone: data.phone,
          website: data.website,
        },
        settings: {
          defaultCAO: data.defaultCAO,
          travelAllowancePerKm: data.travelAllowancePerKm,
          standardWorkWeek: data.standardWorkWeek,
          holidayAllowancePercentage: data.holidayAllowancePercentage,
          pensionContributionPercentage: data.pensionContributionPercentage,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // ✅ FIX: Only add primaryEmployerId if it has a value (for project or holding)
      if ((data.companyType === 'project' || data.companyType === 'holding') && data.primaryEmployerId) {
        companyData.primaryEmployerId = data.primaryEmployerId;
      }

      // Uurtarief voor project bedrijven
      if (data.companyType === 'project' && data.hourlyRate) {
        const rate = typeof data.hourlyRate === 'string'
          ? parseFloat(data.hourlyRate.replace(',', '.'))
          : Number(data.hourlyRate);
        if (!isNaN(rate) && rate > 0) {
          companyData.hourlyRate = rate;
        }
      }

      if (company) {
        await updateCompany(company.id, adminUserId!, companyData);
        success('Bedrijf bijgewerkt', `${data.name} is succesvol bijgewerkt`);
      } else {
        await createCompany(adminUserId!, companyData);
        success('Bedrijf aangemaakt', `${data.name} is succesvol aangemaakt`);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving company:', error);
      showError('Fout bij opslaan', 'Kon bedrijf niet opslaan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setLogoPreview(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={company ? 'Bedrijf bewerken' : 'Nieuw bedrijf'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* ✅ NIEUW: Bedrijfstype selector */}
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
            Bedrijfstype *
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-100">
              <input
                type="radio"
                value="employer"
                {...register('companyType', { required: 'Selecteer een bedrijfstype' })}
                className="mt-1 mr-3"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Loonmaatschappij</div>
                <div className="text-xs text-gray-500 dark:text-gray-300">
                  Personeel in dienst + HR
                </div>
              </div>
            </label>

            <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-100">
              <input
                type="radio"
                value="project"
                {...register('companyType', { required: 'Selecteer een bedrijfstype' })}
                className="mt-1 mr-3"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Werkmaatschappij</div>
                <div className="text-xs text-gray-500 dark:text-gray-300">
                  Detachering + Facturatie
                </div>
              </div>
            </label>

            <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-100">
              <input
                type="radio"
                value="holding"
                {...register('companyType', { required: 'Selecteer een bedrijfstype' })}
                className="mt-1 mr-3"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Holding</div>
                <div className="text-xs text-gray-500 dark:text-gray-300">
                  Operationele holding
                </div>
              </div>
            </label>

            <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-100">
              <input
                type="radio"
                value="shareholder"
                {...register('companyType', { required: 'Selecteer een bedrijfstype' })}
                className="mt-1 mr-3"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Aandeelhouder</div>
                <div className="text-xs text-gray-500 dark:text-gray-300">
                  Participatie in holdings
                </div>
              </div>
            </label>

            <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-100 opacity-50">
              <input
                type="radio"
                value="investor"
                {...register('companyType', { required: 'Selecteer een bedrijfstype' })}
                className="mt-1 mr-3"
                disabled
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Investeerder</div>
                <div className="text-xs text-gray-500 dark:text-gray-300">
                  (Binnenkort beschikbaar)
                </div>
              </div>
            </label>
          </div>
          {errors.companyType && (
            <p className="text-red-500 text-sm mt-1">{errors.companyType.message}</p>
          )}
        </div>

        {/* ✅ NIEUW: Primary employer selector voor project/holding companies */}
        {(companyType === 'project' || companyType === 'holding') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Primaire werkgever {companyType === 'project' ? '*' : '(optioneel)'}
            </label>
            <select
              {...register('primaryEmployerId', {
                required: companyType === 'project' ? 'Selecteer een primaire werkgever' : false
              })}
              className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border rounded-lg border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Selecteer werkgever...</option>
              {employerCompanies.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
            {errors.primaryEmployerId && (
              <p className="text-red-500 text-sm mt-1">{errors.primaryEmployerId.message}</p>
            )}
            {employerCompanies.length === 0 && companyType === 'project' && (
              <p className="text-yellow-600 text-sm mt-1">
                Maak eerst een werkgever-bedrijf aan voordat je een projectbedrijf kunt maken.
              </p>
            )}
          </div>
        )}

        {/* Bestaande bedrijfsinformatie velden */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Bedrijfsnaam *"
            {...register('name', { required: 'Bedrijfsnaam is verplicht' })}
            error={errors.name?.message}
          />
          <Input
            label="KvK nummer *"
            {...register('kvk', { required: 'KvK nummer is verplicht' })}
            error={errors.kvk?.message}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Belastingnummer"
            {...register('taxNumber')}
            error={errors.taxNumber?.message}
          />
          <Input
            label="Bankrekening voor facturen"
            placeholder="NL91 ABNA 0417 1643 00"
            {...register('bankAccount')}
            error={errors.bankAccount?.message}
          />

          <Input
            label="Factuurnummer Prefix (optioneel)"
            placeholder="Bijv: FLG, 2025, PROJ"
            {...register('invoicePrefix')}
            error={errors.invoicePrefix?.message}
          />
          <p className="text-xs text-gray-500 dark:text-gray-300 -mt-1">
            Prefix voor factuurnummers. Bijv: "FLG" maakt "FLG-001", "2025" maakt "2025-001". Laat leeg voor standaard nummering.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Adresgegevens</h3>
          <Input
            label="Straat en huisnummer *"
            {...register('street', { required: 'Straat is verplicht' })}
            error={errors.street?.message}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Postcode *"
              {...register('zipCode', { required: 'Postcode is verplicht' })}
              error={errors.zipCode?.message}
            />
            <Input
              label="Plaats *"
              {...register('city', { required: 'Plaats is verplicht' })}
              error={errors.city?.message}
            />
          </div>
          <Input
            label="Land *"
            {...register('country', { required: 'Land is verplicht' })}
            error={errors.country?.message}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Contactgegevens</h3>
          <Input
            label="E-mailadres *"
            type="email"
            {...register('email', { 
              required: 'E-mailadres is verplicht',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Ongeldig e-mailadres'
              }
            })}
            error={errors.email?.message}
          />
          <Input
            label="Telefoonnummer *"
            {...register('phone', { required: 'Telefoonnummer is verplicht' })}
            error={errors.phone?.message}
          />
          <Input
            label="Website"
            {...register('website')}
            error={errors.website?.message}
          />
        </div>

        {/* ✅ Instellingen alleen voor employer companies (niet voor holding of project) */}
        {companyType === 'employer' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Standaardinstellingen</h3>
            <Input
              label="Standaard CAO"
              {...register('defaultCAO')}
              error={errors.defaultCAO?.message}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Reiskosten per km (€)"
                type="number"
                step="0.01"
                {...register('travelAllowancePerKm', { 
                  required: 'Reiskosten per km is verplicht',
                  min: { value: 0, message: 'Reiskosten kan niet negatief zijn' }
                })}
                error={errors.travelAllowancePerKm?.message}
              />
              <Input
                label="Standaard werkweek (uren)"
                type="number"
                {...register('standardWorkWeek', { 
                  required: 'Standaard werkweek is verplicht',
                  min: { value: 1, message: 'Werkweek moet minimaal 1 uur zijn' },
                  max: { value: 60, message: 'Werkweek kan maximaal 60 uur zijn' }
                })}
                error={errors.standardWorkWeek?.message}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Vakantietoeslag (%)"
                type="number"
                step="0.1"
                {...register('holidayAllowancePercentage', { 
                  required: 'Vakantietoeslag is verplicht',
                  min: { value: 0, message: 'Vakantietoeslag kan niet negatief zijn' }
                })}
                error={errors.holidayAllowancePercentage?.message}
              />
              <Input
                label="Pensioenbijdrage (%)"
                type="number"
                step="0.1"
                {...register('pensionContributionPercentage', { 
                  required: 'Pensioenbijdrage is verplicht',
                  min: { value: 0, message: 'Pensioenbijdrage kan niet negatief zijn' }
                })}
                error={errors.pensionContributionPercentage?.message}
              />
            </div>
          </div>
        )}

        {/* ✅ Instellingen alleen voor project companies (werkmaatschappijen) */}
        {companyType === 'project' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Projectinstellingen</h3>
            <Input
              label="Uurtarief excl. BTW (€)"
              type="number"
              step="0.01"
              {...register('hourlyRate', {
                min: { value: 0, message: 'Uurtarief kan niet negatief zijn' }
              })}
              error={errors.hourlyRate?.message}
            />
          </div>
        )}

        {/* Theme Color Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
            Kleurthema
          </label>
          <div className="grid grid-cols-5 gap-3">
            {THEME_COLOR_PRESETS.map((preset) => {
              const isSelected = watch('themeColor') === preset.id;
              return (
                <label
                  key={preset.id}
                  className={`relative cursor-pointer group`}
                  title={preset.name}
                >
                  <input
                    type="radio"
                    value={preset.id}
                    {...register('themeColor')}
                    className="sr-only"
                  />
                  <div
                    className={`w-full h-12 rounded-lg transition-all ${ isSelected ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:scale-105' }`}
                    style={{ backgroundColor: preset.primaryHex }}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-5 h-5 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-gray-900 dark:text-gray-100"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-center mt-1 text-gray-600 dark:text-gray-300">{preset.name}</p>
                </label>
              );
            })}
          </div>
        </div>

        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
            Bedrijfslogo
          </label>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border rounded-lg border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                Upload een bedrijfslogo. Het bestand wordt opgeslagen als base64.
              </p>
            </div>
            {logoPreview && (
              <div className="flex-shrink-0">
                <div className="w-24 h-24 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center p-2">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLogoPreview(null);
                  }}
                  className="text-xs text-red-600 hover:text-red-700 mt-1 block text-center w-full"
                >
                  Verwijderen
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <Button type="button" variant="outline" onClick={handleClose} isFullWidth>
            Annuleren
          </Button>
          <Button type="submit" isLoading={submitting} isFullWidth>
            {company ? 'Bijwerken' : 'Aanmaken'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CompanyModal;