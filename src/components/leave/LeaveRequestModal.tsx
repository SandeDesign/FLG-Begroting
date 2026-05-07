import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../hooks/useToast';
import { createLeaveRequest, getLeaveBalance, getEmployeeById } from '../../services/firebase';
import { LeaveBalance, Employee } from '../../types';
import { User } from 'lucide-react';

interface LeaveRequestFormData {
  type: 'holiday' | 'unpaid' | 'special' | 'parental' | 'care';
  startDate: string;
  endDate: string;
  reason: string;
}

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employeeId: string;
}

const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({ isOpen, onClose, onSuccess, employeeId }) => {
  const { user, adminUserId, userRole } = useAuth();
  const { companies } = useApp();
  const { success, error: showError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<LeaveRequestFormData>();

  const startDate = watch('startDate');
  const endDate = watch('endDate');

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
    if (user && adminUserId && employeeId) {
      loadLeaveBalance(employeeId);
    }
  }, [user, adminUserId, employeeId]);

  const loadLeaveBalance = async (empId: string) => {
    if (!user || !adminUserId) return;
    try {
      const currentYear = new Date().getFullYear();
      const balance = await getLeaveBalance(empId, adminUserId, currentYear);
      setLeaveBalance(balance);
    } catch (err) {
      console.error('Error loading leave balance:', err);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      const days = calculateWorkingDays(new Date(startDate), new Date(endDate));
      setCalculatedDays(days);
    } else {
      setCalculatedDays(0);
    }
  }, [startDate, endDate]);

  const calculateWorkingDays = (start: Date, end: Date): number => {
    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  };

  const onSubmit = async (data: LeaveRequestFormData) => {
    if (!employeeId || !currentEmployee) {
      showError('Geen werknemer', 'Werknemergegevens ontbreken');
      return;
    }

    if (!currentEmployee.companyId) {
      showError('Geen bedrijf', 'Werknemer is niet gekoppeld aan een bedrijf');
      return;
    }

    if (calculatedDays <= 0) {
      showError('Ongeldige datums', 'Einddatum moet na startdatum liggen');
      return;
    }

    // Pre-approval: werknemers/managers mogen niet met terugwerkende kracht
    // verlof aanvragen — verlof moet vooraf aangevraagd + goedgekeurd zijn.
    // Admin/co-admin kunnen wél backdaten voor correcties.
    const isSelfService = userRole === 'employee' || userRole === 'manager';
    if (isSelfService) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(data.startDate);
      start.setHours(0, 0, 0, 0);
      if (start.getTime() < today.getTime()) {
        showError(
          'Verlof niet met terugwerkende kracht',
          'Je kunt alleen verlof voor vandaag of later aanvragen. Voor eerder genomen vrije dagen: overleg met je leidinggevende of admin.'
        );
        return;
      }
    }

    if (data.type === 'holiday' && leaveBalance) {
      const availableDays = leaveBalance.holidayDays.statutory + leaveBalance.holidayDays.extraStatutory + leaveBalance.holidayDays.accumulated - leaveBalance.holidayDays.taken;
      if (calculatedDays > availableDays) {
        showError('Onvoldoende saldo', `Je hebt maar ${availableDays} verlofdagen beschikbaar`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await createLeaveRequest(adminUserId!, { // Use user!.uid as adminUserId
        employeeId,
        companyId: currentEmployee.companyId,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        totalDays: calculatedDays,
        totalHours: calculatedDays * 8,
        reason: data.reason,
        status: 'pending',
      });

      reset();
      onSuccess();
      onClose();
      success('Verlofaanvraag ingediend', 'Je verlofaanvraag is succesvol ingediend');
    } catch (err) {
      console.error('Error creating leave request:', err);
      showError('Fout bij aanvragen', 'Er is een fout opgetreden bij het indienen van je verlofaanvraag');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setCalculatedDays(0);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Verlof Aanvragen" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {currentEmployee && (
          <div className="bg-primary-50 dark:bg-gray-700 border border-primary-200 dark:border-primary-700 rounded-lg p-4">
            <div className="flex items-start">
              <User className="h-5 w-5 text-primary-600 dark:text-primary-400 mt-0.5 mr-3" />
              <div>
                <h4 className="text-sm font-medium text-primary-900 dark:text-primary-100">
                  {currentEmployee.personalInfo.firstName} {currentEmployee.personalInfo.lastName}
                </h4>
                <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">
                  {currentEmployee.contractInfo.position}
                </p>
              </div>
            </div>
          </div>
        )}

        {leaveBalance && (
          <div className="bg-primary-50 dark:bg-gray-700 border border-primary-200 dark:border-primary-700 rounded-lg p-4">
            <p className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
              Beschikbaar Verlofsaldo
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-primary-700 dark:text-primary-300">Wettelijk:</span>
                <span className="ml-2 font-semibold text-primary-900 dark:text-primary-100">
                  {leaveBalance.holidayDays.statutory} dagen
                </span>
              </div>
              <div>
                <span className="text-primary-700 dark:text-primary-300">Bovenwettelijk:</span>
                <span className="ml-2 font-semibold text-primary-900 dark:text-primary-100">
                  {leaveBalance.holidayDays.extraStatutory} dagen
                </span>
              </div>
              <div>
                <span className="text-primary-700 dark:text-primary-300">Opgebouwd:</span>
                <span className="ml-2 font-semibold text-primary-900 dark:text-primary-100">
                  {leaveBalance.holidayDays.accumulated} dagen
                </span>
              </div>
              <div>
                <span className="text-primary-700 dark:text-primary-300">Opgenomen:</span>
                <span className="ml-2 font-semibold text-primary-900 dark:text-primary-100">
                  {leaveBalance.holidayDays.taken} dagen
                </span>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Type Verlof *
          </label>
          <select
            {...register('type', { required: 'Type is verplicht' })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="holiday">Vakantie</option>
            <option value="unpaid">Onbetaald</option>
            <option value="special">Bijzonder (huwelijk, verhuizing, etc.)</option>
            <option value="parental">Ouderschapsverlof</option>
            <option value="care">Zorgverlof</option>
          </select>
          {errors.type && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.type.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Startdatum *"
            type="date"
            {...register('startDate', { required: 'Startdatum is verplicht' })}
            error={errors.startDate?.message}
          />
          <Input
            label="Einddatum *"
            type="date"
            {...register('endDate', { required: 'Einddatum is verplicht' })}
            error={errors.endDate?.message}
          />
        </div>

        {calculatedDays > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Aantal werkdagen: <span className="font-semibold text-gray-900 dark:text-gray-100">{calculatedDays}</span>
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Reden *
          </label>
          <textarea
            {...register('reason', { required: 'Reden is verplicht' })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Geef een korte toelichting..."
          />
          {errors.reason && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.reason.message}</p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Annuleren
          </Button>
          <Button type="submit" loading={submitting} disabled={submitting}>
            Aanvragen
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default LeaveRequestModal;