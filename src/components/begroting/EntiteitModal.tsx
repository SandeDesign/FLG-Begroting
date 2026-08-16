// src/components/begroting/EntiteitModal.tsx
// Aanmaken en bewerken van een entiteit.

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import {
  ENTITEIT_SOORT_LABEL,
  ENTITEIT_SOORT_UITLEG,
  entiteitSoort,
  soortNaarVlaggen,
  type Entity,
  type EntiteitSoort,
  type NieuweEntity,
} from '../../types/begroting';

const SOORTEN = Object.keys(ENTITEIT_SOORT_LABEL) as EntiteitSoort[];

/** Een handvol herkenbare kleuren voor in het ketenoverzicht. */
const KLEUREN = [
  '#cd853f',
  '#3B82F6',
  '#10B981',
  '#A855F7',
  '#F97316',
  '#EF4444',
  '#14B8A6',
  '#EC4899',
];

interface FormWaarden {
  naam: string;
  kvk: string;
  volgorde: number;
  actief: boolean;
  soort: EntiteitSoort;
  kleur: string;
}

const schema: yup.ObjectSchema<FormWaarden> = yup.object({
  naam: yup.string().trim().required('Vul een naam in'),
  kvk: yup.string().trim().default(''),
  volgorde: yup
    .number()
    .typeError('Vul een getal in')
    .min(0, 'Mag niet negatief zijn')
    .required('Vul een volgorde in'),
  actief: yup.boolean().required(),
  soort: yup
    .mixed<EntiteitSoort>()
    .oneOf(SOORTEN)
    .required('Kies wat voor entiteit dit is'),
  kleur: yup.string().required(),
});

interface EntiteitModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Leeg bij een nieuwe entiteit. */
  entiteit: Entity | null;
  /** Wordt gebruikt om de volgorde van een nieuwe entiteit te bepalen. */
  aantalBestaand: number;
  onBewaren: (waarden: NieuweEntity) => Promise<void>;
}

const EntiteitModal: React.FC<EntiteitModalProps> = ({
  isOpen,
  onClose,
  entiteit,
  aantalBestaand,
  onBewaren,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormWaarden>({
    resolver: yupResolver(schema),
    defaultValues: {
      naam: '',
      kvk: '',
      volgorde: aantalBestaand + 1,
      actief: true,
      soort: 'bv',
      kleur: KLEUREN[0],
    },
  });

  const gekozenKleur = watch('kleur');
  const gekozenSoort = watch('soort');

  useEffect(() => {
    if (!isOpen) return;

    reset({
      naam: entiteit?.naam ?? '',
      kvk: entiteit?.kvk ?? '',
      volgorde: entiteit?.volgorde ?? aantalBestaand + 1,
      actief: entiteit?.actief ?? true,
      soort: entiteit ? entiteitSoort(entiteit) : 'bv',
      kleur: entiteit?.kleur ?? KLEUREN[aantalBestaand % KLEUREN.length],
    });
  }, [isOpen, entiteit, aantalBestaand, reset]);

  const verstuur = handleSubmit(async (waarden) => {
    await onBewaren({
      naam: waarden.naam.trim(),
      kvk: waarden.kvk.trim(),
      volgorde: waarden.volgorde,
      actief: waarden.actief,
      ...soortNaarVlaggen(waarden.soort),
      kleur: waarden.kleur,
      // De vaste lasten blijven staan; die beheer je op een eigen pagina.
      vasteLasten: entiteit?.vasteLasten ?? [],
    });
    onClose();
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={entiteit ? `${entiteit.naam} bewerken` : 'Nieuwe entiteit'}
    >
      <form onSubmit={verstuur} className="space-y-4">
        <Input
          label="Naam"
          placeholder="Buddy BV"
          error={errors.naam?.message}
          {...register('naam')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input label="KvK-nummer" placeholder="Optioneel" {...register('kvk')} />
          <Input
            label="Volgorde"
            type="number"
            min={0}
            helperText="Bepaalt de plek in lijsten"
            error={errors.volgorde?.message}
            {...register('volgorde')}
          />
        </div>

        <div>
          <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight mb-2">
            Kleur
          </span>
          <div className="flex flex-wrap gap-2">
            {KLEUREN.map((kleur) => (
              <button
                key={kleur}
                type="button"
                onClick={() => setValue('kleur', kleur, { shouldDirty: true })}
                aria-label={`Kleur ${kleur}`}
                aria-pressed={gekozenKleur === kleur}
                className={`h-8 w-8 rounded-full transition-all ${
                  gekozenKleur === kleur
                    ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800 scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: kleur }}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            Voor herkenning in het ketenoverzicht.
          </p>
        </div>

        <div>
          <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight mb-2">
            Wat voor entiteit is dit
          </span>
          <div className="grid gap-2 sm:grid-cols-3">
            {SOORTEN.map((soort) => (
              <button
                key={soort}
                type="button"
                onClick={() => setValue('soort', soort, { shouldDirty: true })}
                className={`px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors text-left ${
                  gekozenSoort === soort
                    ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-900/20 text-primary-700 dark:text-primary-200'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
                {ENTITEIT_SOORT_LABEL[soort]}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {ENTITEIT_SOORT_UITLEG[gekozenSoort]}
          </p>
        </div>

        <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            {...register('actief')}
          />
          <span>
            <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Actief
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              Zet uit voor een entiteit die nog niet bestaat, zoals Smart Transport.
            </span>
          </span>
        </label>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {entiteit ? 'Opslaan' : 'Entiteit toevoegen'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EntiteitModal;
