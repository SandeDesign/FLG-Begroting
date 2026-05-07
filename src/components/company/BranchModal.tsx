import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { createBranch, updateBranch } from '../../services/firebase';
import { Company, Branch } from '../../types';

interface BranchFormData {
  name: string;
  location: string;
  costCenter: string;
  cao?: string;
  overtimeRate: number;
  irregularRate: number;
  shiftRate: number;
}

interface BranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  company: Company | null;
  branch?: Branch | null;
}

const BranchModal: React.FC<BranchModalProps> = ({ isOpen, onClose, onSuccess, company, branch }) => {
  const { user, adminUserId } = useAuth();
  const { success, error: showError } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BranchFormData>({
    defaultValues: {
      overtimeRate: 150,
      irregularRate: 125,
      shiftRate: 115,
    }
  });

  React.useEffect(() => {
    if (branch) {
      reset({
        name: branch.name,
        location: branch.location,
        costCenter: branch.costCenter,
        cao: branch.cao,
        overtimeRate: branch.specificSettings?.overtimeRate || 150,
        irregularRate: branch.specificSettings?.irregularRate || 125,
        shiftRate: branch.specificSettings?.shiftRate || 115,
      });
    } else {
      reset({
        overtimeRate: 150,
        irregularRate: 125,
        shiftRate: 115,
      });
    }
  }, [branch, reset]);

  const onSubmit = async (data: BranchFormData) => {
    if (!user || !company) return;

    setSubmitting(true);
    try {
      const branchData = {
        companyId: company.id,
        name: data.name,
        location: data.location,
        costCenter: data.costCenter,
        cao: data.cao,
        specificSettings: {
          overtimeRate: data.overtimeRate,
          irregularRate: data.irregularRate,
          shiftRate: data.shiftRate,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (branch) {
        await updateBranch(branch.id, adminUserId!, branchData);
        success('Vestiging bijgewerkt', `${data.name} is succesvol bijgewerkt`);
      } else {
        await createBranch(adminUserId!, branchData);
        success('Vestiging aangemaakt', `${data.name} is succesvol aangemaakt`);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving branch:', error);
      showError('Fout bij opslaan', 'Kon vestiging niet opslaan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={branch ? 'Vestiging Bewerken' : 'Nieuwe Vestiging'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {company && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <p className="text-sm font-medium text-primary-900">
              Vestiging voor: {company.name}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Vestigingsnaam *"
            {...register('name', { required: 'Vestigingsnaam is verplicht' })}
            error={errors.name?.message}
          />
          <Input
            label="Locatie *"
            {...register('location', { required: 'Locatie is verplicht' })}
            error={errors.location?.message}
          />
        </div>

        <Input
          label="Kostenplaats *"
          {...register('costCenter', { required: 'Kostenplaats is verplicht' })}
          error={errors.costCenter?.message}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            CAO (optioneel)
          </label>
          <select
            {...register('cao')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Gebruik bedrijfsstandaard</option>
            <option value="cao-algemeen">Algemeen (geen specifieke CAO)</option>
            <option value="cao-bouw">Bouw & Infra</option>
            <option value="cao-horeca">Horeca & Catering</option>
            <option value="cao-zorg">Zorg & Welzijn</option>
            <option value="cao-metaal">Metaal & Techniek</option>
          </select>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Specifieke Tarieven (%)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Overuren *"
              type="number"
              {...register('overtimeRate', { 
                required: 'Overurentarief is verplicht',
                valueAsNumber: true 
              })}
              error={errors.overtimeRate?.message}
            />
            <Input
              label="Onregelmatig *"
              type="number"
              {...register('irregularRate', { 
                required: 'Onregelmatigheidstarief is verplicht',
                valueAsNumber: true 
              })}
              error={errors.irregularRate?.message}
            />
            <Input
              label="Ploegendienst *"
              type="number"
              {...register('shiftRate', { 
                required: 'Ploegendiensttarief is verplicht',
                valueAsNumber: true 
              })}
              error={errors.shiftRate?.message}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Annuleren
          </Button>
          <Button type="submit" loading={submitting}>
            {branch ? 'Bijwerken' : 'Aanmaken'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default BranchModal;