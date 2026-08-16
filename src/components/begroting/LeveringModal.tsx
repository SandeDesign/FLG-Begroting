// src/components/begroting/LeveringModal.tsx
// Een onderlinge levering: wat wij aan een andere entiteit leveren en wat wij
// daarvoor rekenen. Bij ons een opbrengst, bij hen een directe kost.

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowRight } from 'lucide-react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { veiligGetal } from '../../utils/firestoreSchoon';
import EenheidKeuze from './EenheidKeuze';
import {
  GRONDSLAG_LABEL,
  type Eenheid,
  type Entity,
  type Grondslag,
  type OnderlingeLevering,
  type Opdracht,
} from '../../types/begroting';

interface FormWaarden {
  omschrijving: string;
  naarEntityId: string;
  opdrachtId: string;
  grondslag: Grondslag;
  tarief: number;
  aantal: number;
  eenheid: Eenheid;
}

const LEEG: FormWaarden = {
  omschrijving: '',
  naarEntityId: '',
  opdrachtId: '',
  grondslag: 'per_uur',
  tarief: 0,
  aantal: 0,
  eenheid: 'maand',
};

interface LeveringModalProps {
  isOpen: boolean;
  onClose: () => void;
  levering: OnderlingeLevering | null;
  /** De entiteit die levert — dat zijn wij. */
  vanEntiteit: Entity;
  /** Alle andere entiteiten waar we naartoe kunnen leveren. */
  andereEntiteiten: Entity[];
  opdrachten: Opdracht[];
  onBewaren: (levering: OnderlingeLevering) => Promise<void>;
}

const LeveringModal: React.FC<LeveringModalProps> = ({
  isOpen,
  onClose,
  levering,
  vanEntiteit,
  andereEntiteiten,
  opdrachten,
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

  const grondslag = watch('grondslag');
  const eenheid = watch('eenheid');
  const tarief = watch('tarief');
  const aantal = watch('aantal');

  useEffect(() => {
    if (!isOpen) return;

    reset(
      levering
        ? {
            omschrijving: levering.omschrijving,
            naarEntityId: levering.naarEntityId,
            opdrachtId: levering.opdrachtId,
            grondslag: levering.grondslag,
            tarief: levering.tarief,
            aantal: levering.aantal,
            eenheid: levering.eenheid,
          }
        : {
            ...LEEG,
            naarEntityId: andereEntiteiten[0]?.id ?? '',
            opdrachtId: opdrachten[0]?.id ?? '',
          }
    );
  }, [isOpen, levering, andereEntiteiten, opdrachten, reset]);

  const verstuur = handleSubmit(async (waarden) => {
    await onBewaren({
      id: levering?.id ?? `levering-${Math.random().toString(36).slice(2, 10)}`,
      omschrijving: waarden.omschrijving.trim(),
      vanEntityId: vanEntiteit.id,
      naarEntityId: waarden.naarEntityId,
      opdrachtId: waarden.opdrachtId,
      grondslag: waarden.grondslag,
      tarief: waarden.tarief,
      aantal: waarden.aantal,
      eenheid: waarden.eenheid,
    });
    onClose();
  });

  const eenheidLabel = grondslag === 'per_uur' ? 'uren' : 'stuks';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={levering ? 'Onderlinge levering bewerken' : 'Nieuwe onderlinge levering'}
      size="lg"
    >
      <form onSubmit={verstuur} className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 text-sm">
          <span className="font-semibold text-gray-900 dark:text-gray-100">{vanEntiteit.naam}</span>
          <ArrowRight className="h-4 w-4 text-gray-400" aria-hidden />
          <select
            {...register('naarEntityId', { required: true })}
            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Kies de ontvangende entiteit…</option>
            {andereEntiteiten.map((entiteit) => (
              <option key={entiteit.id} value={entiteit.id}>
                {entiteit.naam}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Omschrijving"
          placeholder="Buddy levert mensen aan De Installatie"
          error={errors.omschrijving?.message}
          {...register('omschrijving', { required: 'Vul een omschrijving in' })}
        />

        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
            Welke opdracht betreft dit
          </span>
          <select
            {...register('opdrachtId', { required: true })}
            className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Kies een opdracht…</option>
            {opdrachten.map((opdracht) => (
              <option key={opdracht.id} value={opdracht.id}>
                {opdracht.naam}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
            Waarop is het gebaseerd
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(GRONDSLAG_LABEL) as Grondslag[]).map((optie) => (
              <button
                key={optie}
                type="button"
                onClick={() => setValue('grondslag', optie, { shouldDirty: true })}
                className={`px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  grondslag === optie
                    ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-900/20 text-primary-700 dark:text-primary-200'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
                {GRONDSLAG_LABEL[optie]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 sm:items-end p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40">
          <Input
            label={grondslag === 'vast' ? 'Bedrag' : 'Wat wij hiervoor rekenen'}
            type="number"
            step="0.01"
            min="0"
            {...register('tarief', { setValueAs: veiligGetal })}
          />

          {grondslag !== 'vast' && (
            <Input
              label={`Aantal ${eenheidLabel}`}
              type="number"
              step="0.01"
              min="0"
              {...register('aantal', { setValueAs: veiligGetal })}
            />
          )}

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

          <p className="sm:col-span-3 text-xs text-gray-500 dark:text-gray-400">
            {grondslag === 'vast'
              ? 'Het bedrag geldt per de gekozen eenheid.'
              : `Tarief maal aantal geeft het bedrag per de gekozen eenheid: ${tarief || 0} × ${aantal || 0}.`}
          </p>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Deze regel telt bij {vanEntiteit.naam} als opbrengst en bij de ontvangende entiteit als
          directe kost. In het ketenoverzicht vallen ze tegen elkaar weg.
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={andereEntiteiten.length === 0 || opdrachten.length === 0}
          >
            {levering ? 'Opslaan' : 'Levering toevoegen'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default LeveringModal;
