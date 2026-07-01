import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Building2, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Company } from '../../types';
import {
  incomingInvoiceService,
  IncomingInvoice,
} from '../../services/incomingInvoiceService';

interface MoveInvoiceModalProps {
  isOpen: boolean;
  invoice: IncomingInvoice | null;
  companies: Company[];
  currentCompanyId: string;
  movedBy: string;
  onClose: () => void;
  onMoved: (result: { targetName: string; newReference: string }) => void;
  onError: (message: string) => void;
}

const MoveInvoiceModal: React.FC<MoveInvoiceModalProps> = ({
  isOpen,
  invoice,
  companies,
  currentCompanyId,
  movedBy,
  onClose,
  onMoved,
  onError,
}) => {
  const [targetId, setTargetId] = useState('');
  const [moving, setMoving] = useState(false);

  // Alleen andere administraties (bedrijven) dan de huidige
  const targets = useMemo(
    () => companies.filter(c => c.id !== currentCompanyId),
    [companies, currentCompanyId]
  );

  const handleClose = () => {
    if (moving) return;
    setTargetId('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!invoice || !targetId) return;
    const target = targets.find(c => c.id === targetId);
    if (!target) return;

    try {
      setMoving(true);
      const result = await incomingInvoiceService.moveInvoiceToCompany(
        invoice,
        { id: target.id, name: target.name, userId: target.userId },
        movedBy
      );
      setTargetId('');
      onMoved({ targetName: target.name, newReference: result.newReference });
    } catch (err) {
      onError(
        err instanceof Error ? err.message : 'Kon bon niet verplaatsen'
      );
    } finally {
      setMoving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Verplaats naar andere administratie"
      size="md"
    >
      {invoice && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 p-3">
            <ArrowRightLeft className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {invoice.supplierName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {invoice.invoiceNumber}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Doel-administratie
            </label>
            {targets.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Geen ander bedrijf beschikbaar om naartoe te verplaatsen.
              </div>
            ) : (
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={targetId}
                  onChange={e => setTargetId(e.target.value)}
                  disabled={moving}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all disabled:opacity-50"
                >
                  <option value="">Selecteer een administratie…</option>
                  {targets.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            De bon en het bijbehorende bestand worden verplaatst naar de gekozen
            administratie. De bon krijgt daar een nieuw inkoopnummer en komt op{' '}
            <span className="font-medium text-gray-700 dark:text-gray-200">
              "In behandeling"
            </span>{' '}
            te staan, zodat deze opnieuw goedgekeurd moet worden.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={handleClose} disabled={moving}>
              Annuleren
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              loading={moving}
              disabled={moving || !targetId || targets.length === 0}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Verplaatsen
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default MoveInvoiceModal;
