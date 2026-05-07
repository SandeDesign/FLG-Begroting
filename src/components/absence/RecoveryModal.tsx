import React from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { updateSickLeave } from '../../services/firebase';
import { SickLeave } from '../../types';
import { CheckCircle } from 'lucide-react';

interface RecoveryFormData {
  endDate: string;
  workCapacityPercentage: number;
  status: 'recovered' | 'partially_recovered';
  notes?: string;
}

interface RecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sickLeave: SickLeave;
  employeeId: string;
}

const RecoveryModal: React.FC<RecoveryModalProps> = ({ isOpen, onClose, onSuccess, sickLeave, employeeId }) => {
  const { user, adminUserId } = useAuth();
  const { success, error: showError } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<RecoveryFormData>({
    defaultValues: {
      endDate: new Date().toISOString().split('T')[0],
      workCapacityPercentage: 100,
      status: 'recovered',
    }
  });

  const workCapacity = watch('workCapacityPercentage');

  const onSubmit = async (data: RecoveryFormData) => {
    if (!user) {
      showError('Geen gebruiker', 'Je moet ingelogd zijn');
      return;
    }

    setSubmitting(true);
    try {
      await updateSickLeave(sickLeave.id, sickLeave.userId, {
        endDate: new Date(data.endDate),
        actualReturnDate: new Date(data.endDate),
        workCapacityPercentage: data.workCapacityPercentage,
        status: data.status,
        notes: data.notes,
      });

      success(
        'Betermelding geregistreerd',
        data.status === 'recovered'
          ? 'Je bent weer volledig hersteld. Welkom terug!'
          : 'Je herstel is geregistreerd'
      );
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error updating sick leave:', err);
      showError('Fout bij updaten', 'Kon betermelding niet registreren');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Beter Melden" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-green-900">
                Herstelmelding
              </h4>
              <p className="text-sm text-green-700 mt-1">
                Ziek sinds: {(sickLeave.startDate instanceof Date ? sickLeave.startDate : new Date(sickLeave.startDate)).toLocaleDateString('nl-NL')}
              </p>
            </div>
          </div>
        </div>

        <Input
          label="Datum Herstel *"
          type="date"
          {...register('endDate', { required: 'Hersteldatum is verplicht' })}
          error={errors.endDate?.message}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Arbeidsgeschiktheid (%) *
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            {...register('workCapacityPercentage', {
              required: 'Arbeidsgeschiktheid is verplicht',
              valueAsNumber: true,
            })}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mt-1">
            <span>0%</span>
            <span className="font-semibold">{workCapacity}%</span>
            <span>100%</span>
          </div>
          {errors.workCapacityPercentage && (
            <p className="text-sm text-red-600 mt-1">
              {errors.workCapacityPercentage.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Status *
          </label>
          <select
            {...register('status', { required: 'Status is verplicht' })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="recovered">Volledig hersteld (100%)</option>
            <option value="partially_recovered">Gedeeltelijk hersteld</option>
          </select>
          {errors.status && (
            <p className="text-sm text-red-600 mt-1">{errors.status.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Notities (optioneel)
          </label>
          <textarea
            {...register('notes')}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Eventuele aanvullende informatie..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Annuleren
          </Button>
          <Button type="submit" loading={submitting}>
            Beter Melden
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default RecoveryModal;