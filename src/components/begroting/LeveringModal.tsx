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
import Uitkomst from './Uitkomst';
import {
  BTW_LABEL,
  BTW_PERCENTAGE,
  GRONDSLAG_LABEL,
  type BtwTarief,
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
  btw: BtwTarief;
}

const LEEG: FormWaarden = {
  omschrijving: '',
  naarEntityId: '',
  opdrachtId: '',
  grondslag: 'per_uur',
  tarief: 0,
  aantal: 0,
  eenheid: 'maand',
  btw: 'hoog',
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
  const btw = watch('btw');

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
            btw: levering.btw ?? 'hoog',
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
      btw: waarden.btw,
    });
    onClose();
  });

  const eenheidLabel = grondslag === 'per_uur' ? 'uren' : 'stuks';

  // Wat er per maand omgaat, met en zonder BTW.
  const bedragExBtw = grondslag === 'vast' ? tarief || 0 : (tarief || 0) * (aantal || 0);
  const btwBedrag = bedragExBtw * BTW_PERCENTAGE[btw];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={levering ? 'Onderlinge levering bewerken' : 'Nieuwe onderlinge levering'}
      size="lg"
    >
      <form onSubmit={verstuur} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {vanEntiteit.naam}
            </span>
            <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 rotate-90 sm:rotate-0" aria-hidden />
          </div>
          <select
            {...register('naarEntityId', { required: true })}
            className="w-full min-w-0 sm:flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
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

        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
            BTW op de factuur
          </span>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(BTW_LABEL) as BtwTarief[]).map((optie) => (
              <button
                key={optie}
                type="button"
                onClick={() => setValue('btw', optie, { shouldDirty: true })}
                className={`px-2 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  btw === optie
                    ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-900/20 text-primary-700 dark:text-primary-200'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
                {BTW_LABEL[optie]}
              </button>
            ))}
          </div>
        </div>

        <Uitkomst
          titel="Wat hier per maand omgaat"
          regels={[
            {
              label: 'Bedrag exclusief BTW',
              bedrag: bedragExBtw,
              berekening:
                grondslag === 'vast'
                  ? 'Het vaste bedrag'
                  : `${tarief || 0} × ${aantal || 0} ${eenheidLabel}`,
            },
            {
              label: `BTW (${BTW_LABEL[btw]})`,
              bedrag: btwBedrag,
              berekening:
                btw === 'verlegd'
                  ? 'Verlegd: de ontvanger geeft de BTW zelf aan'
                  : undefined,
            },
          ]}
          totaal={{ label: 'Op de factuur', bedrag: bedragExBtw + btwBedrag }}
          opmerking="Alleen het bedrag exclusief BTW telt mee in de begroting. De BTW draag je af en de ontvangende entiteit vordert hem terug, dus binnen de groep valt die tegen elkaar weg."
        />

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Deze regel telt bij {vanEntiteit.naam} als opbrengst en bij de ontvangende entiteit als
          directe kost. In het ketenoverzicht vallen ze tegen elkaar weg.
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2">
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
