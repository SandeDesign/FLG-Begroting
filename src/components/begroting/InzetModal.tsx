// src/components/begroting/InzetModal.tsx
// Wie de opdracht uitvoert en wat dat kost: loondienst, ZZP per stuk of ZZP per
// dag. Loondienst kan alleen bij een entiteit met personeel.

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Info } from 'lucide-react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import {
  INZET_SOORT_LABEL,
  type Inzet,
  type InzetModel,
  type InzetSoort,
  type Opdracht,
} from '../../types/begroting';

interface FormWaarden {
  naam: string;
  hoortBij: string;
  actief: boolean;
  soort: InzetSoort;
  uurloon: number;
  urenPerWeek: number;
  vakantiegeldPct: number;
  werkgeverslastenPct: number;
  pensioen: number;
  overig: number;
  tariefPerStuk: number;
  stuksPerDag: number;
  dagtarief: number;
  dagenPerMaand: number;
}

const LEEG: FormWaarden = {
  naam: '',
  hoortBij: '',
  actief: true,
  soort: 'zzp_dag',
  uurloon: 0,
  urenPerWeek: 40,
  // In het formulier staan de percentages als heel getal; in het model als breuk.
  vakantiegeldPct: 8,
  werkgeverslastenPct: 22,
  pensioen: 0,
  overig: 0,
  tariefPerStuk: 0,
  stuksPerDag: 0,
  dagtarief: 0,
  dagenPerMaand: 26,
};

function naarForm(inzet: Inzet): FormWaarden {
  const basis: FormWaarden = {
    ...LEEG,
    naam: inzet.naam,
    hoortBij: inzet.hoortBij,
    actief: inzet.actief,
    soort: inzet.model.soort,
  };

  switch (inzet.model.soort) {
    case 'loondienst':
      return {
        ...basis,
        uurloon: inzet.model.uurloon,
        urenPerWeek: inzet.model.urenPerWeek,
        vakantiegeldPct: inzet.model.vakantiegeldPct * 100,
        werkgeverslastenPct: inzet.model.werkgeverslastenPct * 100,
        pensioen: inzet.model.pensioen,
        overig: inzet.model.overig,
      };
    case 'zzp_stuk':
      return { ...basis, ...inzet.model };
    case 'zzp_dag':
      return { ...basis, ...inzet.model };
  }
}

function naarModel(waarden: FormWaarden): InzetModel {
  switch (waarden.soort) {
    case 'loondienst':
      return {
        soort: 'loondienst',
        uurloon: waarden.uurloon,
        urenPerWeek: waarden.urenPerWeek,
        vakantiegeldPct: waarden.vakantiegeldPct / 100,
        werkgeverslastenPct: waarden.werkgeverslastenPct / 100,
        pensioen: waarden.pensioen,
        overig: waarden.overig,
      };
    case 'zzp_stuk':
      return {
        soort: 'zzp_stuk',
        tariefPerStuk: waarden.tariefPerStuk,
        stuksPerDag: waarden.stuksPerDag,
        dagenPerMaand: waarden.dagenPerMaand,
      };
    case 'zzp_dag':
      return {
        soort: 'zzp_dag',
        dagtarief: waarden.dagtarief,
        dagenPerMaand: waarden.dagenPerMaand,
      };
  }
}

interface InzetModalProps {
  isOpen: boolean;
  onClose: () => void;
  inzet: Inzet | null;
  opdrachten: Opdracht[];
  /** Loondienst is alleen toegestaan als de entiteit personeel heeft. */
  heeftPersoneel: boolean;
  entiteitNaam: string;
  onBewaren: (inzet: Inzet) => Promise<void>;
}

const InzetModal: React.FC<InzetModalProps> = ({
  isOpen,
  onClose,
  inzet,
  opdrachten,
  heeftPersoneel,
  entiteitNaam,
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

  const soort = watch('soort');

  useEffect(() => {
    if (!isOpen) return;

    const start = inzet ? naarForm(inzet) : { ...LEEG, hoortBij: opdrachten[0]?.id ?? '' };
    reset(start);
  }, [isOpen, inzet, opdrachten, reset]);

  const verstuur = handleSubmit(async (waarden) => {
    await onBewaren({
      id: inzet?.id ?? `inzet-${Math.random().toString(36).slice(2, 10)}`,
      naam: waarden.naam.trim(),
      hoortBij: waarden.hoortBij,
      actief: waarden.actief,
      model: naarModel(waarden),
    });
    onClose();
  });

  const soorten = (Object.keys(INZET_SOORT_LABEL) as InzetSoort[]).filter(
    (optie) => optie !== 'loondienst' || heeftPersoneel
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={inzet ? `${inzet.naam} bewerken` : 'Nieuwe inzet'}
      size="lg"
    >
      <form onSubmit={verstuur} className="space-y-4">
        {opdrachten.length === 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-900 dark:text-amber-200">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden />
            <span>
              Er zijn nog geen opdrachten. Maak eerst een opdracht aan — inzet hoort altijd bij
              precies één opdracht.
            </span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Naam"
            placeholder="Bezorger 1"
            error={errors.naam?.message}
            {...register('naam', { required: 'Vul een naam in' })}
          />

          <div className="space-y-1.5">
            <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
              Hoort bij
            </span>
            <select
              {...register('hoortBij', { required: true })}
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
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
            Soort inzet
          </span>
          <div className="grid grid-cols-3 gap-2">
            {soorten.map((optie) => (
              <button
                key={optie}
                type="button"
                onClick={() => setValue('soort', optie, { shouldDirty: true })}
                className={`px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  soort === optie
                    ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-900/20 text-primary-700 dark:text-primary-200'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
                {INZET_SOORT_LABEL[optie]}
              </button>
            ))}
          </div>
          {!heeftPersoneel && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {entiteitNaam} staat niet als entiteit met personeel, dus loondienst kan hier niet.
              Zet dat aan bij de entiteit als dat wel de bedoeling is.
            </p>
          )}
        </div>

        {soort === 'loondienst' && (
          <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40">
            <Input
              label="Uurloon"
              type="number"
              step="0.01"
              min="0"
              {...register('uurloon', { valueAsNumber: true })}
            />
            <Input
              label="Uren per week"
              type="number"
              step="0.5"
              min="0"
              {...register('urenPerWeek', { valueAsNumber: true })}
            />
            <Input
              label="Vakantiegeld in procenten"
              type="number"
              step="0.1"
              min="0"
              helperText="Over het bruto loon"
              {...register('vakantiegeldPct', { valueAsNumber: true })}
            />
            <Input
              label="Werkgeverslasten in procenten"
              type="number"
              step="0.1"
              min="0"
              helperText="Over bruto plus vakantiegeld"
              {...register('werkgeverslastenPct', { valueAsNumber: true })}
            />
            <Input
              label="Pensioen per maand"
              type="number"
              step="0.01"
              min="0"
              {...register('pensioen', { valueAsNumber: true })}
            />
            <Input
              label="Overig per maand"
              type="number"
              step="0.01"
              min="0"
              {...register('overig', { valueAsNumber: true })}
            />
          </div>
        )}

        {soort === 'zzp_stuk' && (
          <div className="grid gap-4 sm:grid-cols-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40">
            <Input
              label="Tarief per stuk"
              type="number"
              step="0.01"
              min="0"
              {...register('tariefPerStuk', { valueAsNumber: true })}
            />
            <Input
              label="Stuks per dag"
              type="number"
              step="1"
              min="0"
              {...register('stuksPerDag', { valueAsNumber: true })}
            />
            <Input
              label="Dagen per maand"
              type="number"
              step="1"
              min="0"
              {...register('dagenPerMaand', { valueAsNumber: true })}
            />
          </div>
        )}

        {soort === 'zzp_dag' && (
          <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40">
            <Input
              label="Dagtarief"
              type="number"
              step="0.01"
              min="0"
              {...register('dagtarief', { valueAsNumber: true })}
            />
            <Input
              label="Dagen per maand"
              type="number"
              step="1"
              min="0"
              {...register('dagenPerMaand', { valueAsNumber: true })}
            />
          </div>
        )}

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

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={opdrachten.length === 0}>
            {inzet ? 'Opslaan' : 'Inzet toevoegen'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default InzetModal;
