import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { createSickLeave, getEmployeeById } from '../../services/firebase';
import { Employee } from '../../types';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface SickLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  employeeId: string;
}

interface SickLeaveFormData {
  startDate: string;
  workCapacityPercentage: number;
  notes: string;
}

const SickLeaveModal: React.FC<SickLeaveModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  employeeId,
}) => {
  const { user, adminUserId } = useAuth();
  const { success, error: showError } = useToast();
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<SickLeaveFormData>({
    startDate: new Date().toISOString().split('T')[0],
    workCapacityPercentage: 0,
    notes: '',
  });

  useEffect(() => {
    const loadEmployee = async () => {
      if (employeeId) {
        try {
          const employee = await getEmployeeById(employeeId);
          setCurrentEmployee(employee);
        } catch (err) {
          console.error('Error loading employee:', err);
          showError('Fout bij laden', 'Werknemersgegevens konden niet geladen worden');
        }
      }
    };

    if (isOpen) {
      loadEmployee();
    }
  }, [isOpen, employeeId, showError]);

  const handleInputChange = (field: keyof SickLeaveFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClose = () => {
    setFormData({
      startDate: new Date().toISOString().split('T')[0],
      workCapacityPercentage: 0,
      notes: '',
    });
    onClose();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !adminUserId) {
      showError('Fout', 'Gebruiker niet ingelogd');
      return;
    }
    if (!currentEmployee) {
      showError('Fout', 'Werknemergegevens ontbreken');
      return;
    }
    if (!currentEmployee.companyId) {
      showError('Fout', 'Werknemer is niet gekoppeld aan een bedrijf');
      return;
    }

    setSubmitting(true);
    try {
      await createSickLeave(adminUserId, { // Use user.uid as adminUserId
        employeeId,
        companyId: currentEmployee.companyId,
        startDate: new Date(formData.startDate),
        reportedAt: new Date(),
        reportedBy: user?.displayName || user?.email || 'Werknemer',
        reportedVia: 'app',
        workCapacityPercentage: formData.workCapacityPercentage,
        status: 'active',
        notes: formData.notes || '',
        arboServiceContacted: false,
        poortwachterActive: false,
        doctorVisits: [],
      });

      success('Ziekmelding succesvol ingediend');
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      console.error('Error creating sick leave:', err);
      showError('Fout bij indienen', 'Kon ziekmelding niet indienen');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Ziekmelding">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Startdatum"
          type="date"
          value={formData.startDate}
          onChange={(e) => handleInputChange('startDate', e.target.value)}
          required
        />

        <Input
          label="Arbeidsgeschiktheid (%)"
          type="number"
          min="0"
          max="100"
          value={formData.workCapacityPercentage}
          onChange={(e) => handleInputChange('workCapacityPercentage', parseInt(e.target.value) || 0)}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Opmerkingen
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Eventuele opmerkingen..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Annuleren
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Bezig...' : 'Indienen'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default SickLeaveModal;