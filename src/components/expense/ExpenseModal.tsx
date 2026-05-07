import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../hooks/useToast';
import { createExpense, calculateTravelExpense, getEmployeeById } from '../../services/firebase';
import { Employee } from '../../types';
import { User } from 'lucide-react';

interface ExpenseFormData {
  date: string;
  type: 'travel' | 'meal' | 'parking' | 'accommodation' | 'other';
  description: string;
  amount: number;
  kilometers?: number;
  vatAmount?: number;
}

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employeeId: string;
}

const ExpenseModal: React.FC<ExpenseModalProps> = ({ isOpen, onClose, onSuccess, employeeId }) => {
  const { user, adminUserId } = useAuth();
  const { companies } = useApp();
  const { success, error: showError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [travelRatePerKm, setTravelRatePerKm] = useState(0.23);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<ExpenseFormData>({
    defaultValues: {
      type: 'travel',
      date: new Date().toISOString().split('T')[0],
    }
  });

  const expenseType = watch('type');
  const kilometers = watch('kilometers');

  useEffect(() => {
    if (employeeId) {
      const loadEmployee = async () => {
        try {
          const employee = await getEmployeeById(employeeId);
          setCurrentEmployee(employee);
        } catch (err) {
          console.error('Error loading employee:', err);
        }
      };
      loadEmployee();
    }
  }, [employeeId]);

  useEffect(() => {
    if (user && adminUserId && employeeId && currentEmployee) {
      const company = companies.find(c => c.id === currentEmployee.companyId);
      if (company?.settings?.travelAllowancePerKm) {
        setTravelRatePerKm(company.settings.travelAllowancePerKm);
      }
    }
  }, [user, employeeId, currentEmployee, companies]);

  useEffect(() => {
    if (expenseType === 'travel' && kilometers && kilometers > 0) {
      const calculatedAmount = calculateTravelExpense(kilometers, travelRatePerKm);
      setValue('amount', parseFloat(calculatedAmount.toFixed(2)));
    }
  }, [expenseType, kilometers, travelRatePerKm, setValue]);

  const onSubmit = async (data: ExpenseFormData) => {
    if (!employeeId) {
      showError('Geen werknemer', 'Werknemer ID ontbreekt');
      return;
    }

    if (!currentEmployee) {
      showError('Geen werknemer', 'Werknemergegevens ontbreken');
      return;
    }

    if (!currentEmployee.companyId) {
      showError('Geen bedrijf', 'Werknemer is niet gekoppeld aan een bedrijf');
      return;
    }

    if (data.amount <= 0) {
      showError('Ongeldig bedrag', 'Bedrag moet groter zijn dan 0');
      return;
    }

    setSubmitting(true);
    try {
      await createExpense(adminUserId!, { // Use user!.uid as adminUserId
        employeeId,
        companyId: currentEmployee.companyId,
        date: new Date(data.date),
        type: data.type,
        description: data.description,
        amount: data.amount,
        currency: 'EUR',
        status: 'draft',
        vatAmount: data.vatAmount || 0,
        travelDetails: data.type === 'travel' && data.kilometers ? {
          from: '',
          to: '',
          kilometers: data.kilometers,
          vehicleType: 'car',
        } : undefined,
        receipts: [],
        approvals: [],
        taxable: true,
        withinTaxFreeAllowance: data.type === 'travel',
      });

      success('Declaratie aangemaakt', 'Je declaratie is opgeslagen als concept');
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating expense:', err);
      showError('Fout bij aanmaken', 'Kon declaratie niet aanmaken');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nieuwe Declaratie" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {currentEmployee && (
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-lg p-4">
            <div className="flex items-start">
              <User className="h-5 w-5 text-primary-600 dark:text-primary-400 mt-0.5 mr-3" />
              <div>
                <h4 className="text-sm font-medium text-primary-900 dark:text-primary-100">
                  {currentEmployee.personalInfo.firstName} {currentEmployee.personalInfo.lastName}
                </h4>
                <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">
                  {currentEmployee.contractInfo.position}
                </p>
                {currentEmployee.companyId && (
                  <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">
                    Bedrijf: {companies.find(c => c.id === currentEmployee.companyId)?.name || 'Onbekend'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Datum *"
            type="date"
            {...register('date', { required: 'Datum is verplicht' })}
            error={errors.date?.message}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Type *
            </label>
            <select
              {...register('type', { required: 'Type is verplicht' })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="travel">Reiskosten</option>
              <option value="meal">Maaltijd</option>
              <option value="parking">Parkeren</option>
              <option value="accommodation">Accommodatie</option>
              <option value="other">Overig</option>
            </select>
            {errors.type && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.type.message}</p>
            )}
          </div>
        </div>

        {expenseType === 'travel' && (
          <div>
            <Input
              label="Aantal kilometers *"
              type="number"
              step="1"
              {...register('kilometers', {
                required: expenseType === 'travel' ? 'Kilometers zijn verplicht voor reiskosten' : false,
                min: { value: 1, message: 'Minimaal 1 kilometer' },
                valueAsNumber: true,
              })}
              error={errors.kilometers?.message}
            />
            <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
              Vergoeding: €{travelRatePerKm.toFixed(2)} per km
            </p>
          </div>
        )}

        <Input
          label="Bedrag (€) *"
          type="number"
          step="0.01"
          {...register('amount', {
            required: 'Bedrag is verplicht',
            min: { value: 0.01, message: 'Bedrag moet groter zijn dan 0' },
            valueAsNumber: true,
          })}
          error={errors.amount?.message}
          disabled={expenseType === 'travel' && !!kilometers}
        />

        <Input
          label="BTW Bedrag (€)"
          type="number"
          step="0.01"
          {...register('vatAmount', { valueAsNumber: true })}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Beschrijving *
          </label>
          <textarea
            {...register('description', { required: 'Beschrijving is verplicht' })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Geef een korte toelichting..."
          />
          {errors.description && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.description.message}</p>
          )}
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            De declaratie wordt opgeslagen als concept. Je kunt deze later nog bewerken voordat je deze indient ter goedkeuring.
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Annuleren
          </Button>
          <Button type="submit" loading={submitting}>
            Opslaan als Concept
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ExpenseModal;