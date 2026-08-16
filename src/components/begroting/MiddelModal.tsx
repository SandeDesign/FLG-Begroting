// src/components/begroting/MiddelModal.tsx
// Een middel: een bus, een machine, alles wat geld kost en bij een opdracht of
// bij de entiteit zelf hoort.

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { veiligGetal } from '../../utils/firestoreSchoon';
import EenheidKeuze from './EenheidKeuze';
import {
  FINANCIERING_LABEL,
  HOORT_BIJ_ENTITEIT,
  type Eenheid,
  type Financiering,
  type Middel,
  type Opdracht,
} from '../../types/begroting';

interface FormWaarden {
  naam: string;
  hoortBij: string;
  actief: boolean;
  financiering: Financiering;
  leasetermijn: number;
  waarde: number;
  looptijdMaanden: number;
  restwaarde: number;
  brandstof: number;
  verzekering: number;
  wegenbelasting: number;
  onderhoud: number;
  onderhoudBerekenen: boolean;
  overig: number;
  eenheid: Eenheid;
}

const LEEG: FormWaarden = {
  naam: '',
  hoortBij: HOORT_BIJ_ENTITEIT,
  actief: true,
  financiering: 'lease',
  leasetermijn: 0,
  waarde: 0,
  looptijdMaanden: 60,
  restwaarde: 0,
  brandstof: 0,
  verzekering: 0,
  wegenbelasting: 0,
  onderhoud: 0,
  onderhoudBerekenen: false,
  overig: 0,
  eenheid: 'maand',
};

interface MiddelModalProps {
  isOpen: boolean;
  onClose: () => void;
  middel: Middel | null;
  opdrachten: Opdracht[];
  onBewaren: (middel: Middel) => Promise<void>;
}

const MiddelModal: React.FC<MiddelModalProps> = ({
  isOpen,
  onClose,
  middel,
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

  const financiering = watch('financiering');
  const eenheid = watch('eenheid');
  const onderhoudBerekenen = watch('onderhoudBerekenen');

  useEffect(() => {
    if (!isOpen) return;
    reset(middel ? { ...LEEG, ...middel } : LEEG);
  }, [isOpen, middel, reset]);

  const verstuur = handleSubmit(async (waarden) => {
    await onBewaren({
      ...waarden,
      id: middel?.id ?? `middel-${Math.random().toString(36).slice(2, 10)}`,
      naam: waarden.naam.trim(),
    });
    onClose();
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={middel ? `${middel.naam} bewerken` : 'Nieuw middel'}
      size="lg"
    >
      <form onSubmit={verstuur} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Naam"
            placeholder="Opel Combo"
            error={errors.naam?.message}
            {...register('naam', { required: 'Vul een naam in' })}
          />

          <div className="space-y-1.5">
            <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
              Hoort bij
            </span>
            <select
              {...register('hoortBij')}
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
            >
              <option value={HOORT_BIJ_ENTITEIT}>De entiteit zelf</option>
              {opdrachten.map((opdracht) => (
                <option key={opdracht.id} value={opdracht.id}>
                  {opdracht.naam}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
            Financiering
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(FINANCIERING_LABEL) as Financiering[]).map((optie) => (
              <button
                key={optie}
                type="button"
                onClick={() => setValue('financiering', optie, { shouldDirty: true })}
                className={`px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  financiering === optie
                    ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-900/20 text-primary-700 dark:text-primary-200'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
                {FINANCIERING_LABEL[optie]}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40">
          {financiering === 'lease' ? (
            <Input
              label="Leasetermijn"
              type="number"
              step="0.01"
              min="0"
              helperText="Het bedrag dat je per periode betaalt"
              {...register('leasetermijn', { setValueAs: veiligGetal })}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Waarde"
                type="number"
                step="0.01"
                min="0"
                helperText="Aanschafwaarde"
                {...register('waarde', { setValueAs: veiligGetal })}
              />
              <Input
                label="Restwaarde"
                type="number"
                step="0.01"
                min="0"
                {...register('restwaarde', { setValueAs: veiligGetal })}
              />
              <Input
                label="Looptijd in maanden"
                type="number"
                step="1"
                min="1"
                {...register('looptijdMaanden', { setValueAs: veiligGetal })}
              />
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            {financiering === 'lease' &&
              'De leasetermijn wordt omgerekend vanuit de eenheid hieronder.'}
            {financiering === 'financial_lease' &&
              'De maandtermijn wordt berekend als annuïteit over de looptijd, met de rente uit de aannames.'}
            {financiering === 'eigendom' &&
              'Waarde min restwaarde wordt gelijkmatig over de looptijd verdeeld.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Brandstof"
            type="number"
            step="0.01"
            min="0"
            {...register('brandstof', { setValueAs: veiligGetal })}
          />
          <Input
            label="Verzekering"
            type="number"
            step="0.01"
            min="0"
            {...register('verzekering', { setValueAs: veiligGetal })}
          />
          <Input
            label="Wegenbelasting"
            type="number"
            step="0.01"
            min="0"
            {...register('wegenbelasting', { setValueAs: veiligGetal })}
          />
          <Input
            label="Overig"
            type="number"
            step="0.01"
            min="0"
            {...register('overig', { setValueAs: veiligGetal })}
          />
        </div>

        <div className="space-y-2">
          <Input
            label="Onderhoud"
            type="number"
            step="0.01"
            min="0"
            disabled={onderhoudBerekenen}
            {...register('onderhoud', { setValueAs: veiligGetal })}
          />
          <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              {...register('onderhoudBerekenen')}
            />
            Onderhoud berekenen uit de kilometers uit de aannames
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
          <div className="space-y-1.5">
            <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
              Eenheid van de bedragen
            </span>
            <EenheidKeuze
              waarde={eenheid}
              onChange={(nieuw) => setValue('eenheid', nieuw, { shouldDirty: true })}
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Geldt voor alle bedragen van dit middel.
            </p>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              {...register('actief')}
            />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Actief — telt mee in de berekening
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {middel ? 'Opslaan' : 'Middel toevoegen'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default MiddelModal;
