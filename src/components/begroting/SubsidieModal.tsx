// src/components/begroting/SubsidieModal.tsx
// Een subsidie. Die hoort bij de entiteit, niet bij de opdracht, en wordt nooit
// van een kost afgetrokken — hij staat als eigen regel in de resultatenstaat.

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { veiligGetal } from '../../utils/firestoreSchoon';
import EenheidKeuze from './EenheidKeuze';
import type { Eenheid, Inzet, Subsidie } from '../../types/begroting';

interface FormWaarden {
  omschrijving: string;
  bedrag: number;
  eenheid: Eenheid;
  inzetId: string;
  einddatum: string;
}

const LEEG: FormWaarden = {
  omschrijving: '',
  bedrag: 0,
  eenheid: 'maand',
  inzetId: '',
  einddatum: '',
};

interface SubsidieModalProps {
  isOpen: boolean;
  onClose: () => void;
  subsidie: Subsidie | null;
  inzet: Inzet[];
  onBewaren: (subsidie: Subsidie) => Promise<void>;
}

const SubsidieModal: React.FC<SubsidieModalProps> = ({
  isOpen,
  onClose,
  subsidie,
  inzet,
  onBewaren,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormWaarden>({ defaultValues: LEEG });

  const eenheid = watch('eenheid');

  useEffect(() => {
    if (!isOpen) return;

    reset(
      subsidie
        ? {
            omschrijving: subsidie.omschrijving,
            bedrag: subsidie.bedrag,
            eenheid: subsidie.eenheid,
            inzetId: subsidie.inzetId ?? '',
            einddatum: subsidie.einddatum ?? '',
          }
        : LEEG
    );
  }, [isOpen, subsidie, reset]);

  const verstuur = handleSubmit(async (waarden) => {
    await onBewaren({
      id: subsidie?.id ?? `subsidie-${Math.random().toString(36).slice(2, 10)}`,
      omschrijving: waarden.omschrijving.trim(),
      bedrag: waarden.bedrag,
      eenheid: waarden.eenheid,
      inzetId: waarden.inzetId || null,
      einddatum: waarden.einddatum.trim() || null,
    });
    onClose();
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={subsidie ? 'Subsidie bewerken' : 'Nieuwe subsidie'}
    >
      <form onSubmit={verstuur} className="space-y-4">
        <Input
          label="Omschrijving"
          placeholder="Loonkostensubsidie medewerker 1"
          error={errors.omschrijving?.message}
          {...register('omschrijving', { required: 'Vul een omschrijving in' })}
        />

        <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
          <Input
            label="Bedrag"
            type="number"
            step="0.01"
            min="0"
            {...register('bedrag', { setValueAs: veiligGetal })}
          />
          <div className="space-y-1.5">
            <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
              Eenheid
            </span>
            <EenheidKeuze
              waarde={eenheid}
              onChange={(nieuw) => setValue('eenheid', nieuw, { shouldDirty: true })}
              className="w-full"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
            Hoort bij
          </span>
          <select
            {...register('inzetId')}
            className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Niemand in het bijzonder</option>
            {inzet.map((item) => (
              <option key={item.id} value={item.id}>
                {item.naam}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Alleen om te tonen bij wie de subsidie hoort. Het bedrag wordt nooit van de
            loonkosten afgetrokken.
          </p>
        </div>

        <Input
          label="Einddatum"
          placeholder="2027-06"
          helperText="JJJJ-MM. Leeg laten als de subsidie doorloopt."
          {...register('einddatum')}
        />

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {subsidie ? 'Opslaan' : 'Subsidie toevoegen'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default SubsidieModal;
