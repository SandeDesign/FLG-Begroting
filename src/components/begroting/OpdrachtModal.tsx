// src/components/begroting/OpdrachtModal.tsx
// Een opdracht: wat we doen, voor wie, en hoe de opbrengst opgebouwd is.

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { veiligGetal } from '../../utils/firestoreSchoon';
import Uitkomst from './Uitkomst';
import { berekenBasisOpbrengst, berekenOpbrengst } from '../../utils/begroting.calc';
import { naarMaand } from '../../utils/periode';
import EenheidKeuze from './EenheidKeuze';
import {
  OPBRENGST_SOORT_LABEL,
  type Aannames,
  type Eenheid,
  type Opdracht,
  type OpbrengstModel,
  type OpbrengstSoort,
} from '../../types/begroting';

/** Eén platte vorm voor alle drie de opbrengstsoorten; bij opslaan gesplitst. */
interface FormWaarden {
  naam: string;
  voorWie: string;
  actief: boolean;
  soort: OpbrengstSoort;
  aantalMensen: number;
  urenPerWeek: number;
  tariefPerUur: number;
  productiviteit: number;
  stuksPerDag: number;
  tariefPerStuk: number;
  dagenPerMaand: number;
  vastBedrag: number;
  vastEenheid: Eenheid;
  toeslagen: number;
  overigeOpbrengst: number;
  extraEenheid: Eenheid;
}

const LEEG: FormWaarden = {
  naam: '',
  voorWie: '',
  actief: true,
  soort: 'stuks',
  aantalMensen: 1,
  urenPerWeek: 40,
  tariefPerUur: 0,
  productiviteit: 0.92,
  stuksPerDag: 0,
  tariefPerStuk: 0,
  dagenPerMaand: 26,
  vastBedrag: 0,
  vastEenheid: 'maand',
  toeslagen: 0,
  overigeOpbrengst: 0,
  extraEenheid: 'maand',
};

/** Zet een bestaande opdracht om naar de platte formuliervorm. */
function naarForm(opdracht: Opdracht): FormWaarden {
  const basis: FormWaarden = {
    ...LEEG,
    naam: opdracht.naam,
    voorWie: opdracht.voorWie,
    actief: opdracht.actief,
    soort: opdracht.opbrengst.soort,
    toeslagen: opdracht.toeslagen ?? 0,
    overigeOpbrengst: opdracht.overigeOpbrengst ?? 0,
    extraEenheid: opdracht.extraEenheid ?? 'maand',
  };

  switch (opdracht.opbrengst.soort) {
    case 'uren':
      return { ...basis, ...opdracht.opbrengst };
    case 'stuks':
      return { ...basis, ...opdracht.opbrengst };
    case 'vast':
      return {
        ...basis,
        vastBedrag: opdracht.opbrengst.bedrag,
        vastEenheid: opdracht.opbrengst.eenheid,
      };
  }
}

/** Bouwt het opbrengstmodel op uit de platte formulierwaarden. */
function naarOpbrengst(waarden: FormWaarden): OpbrengstModel {
  switch (waarden.soort) {
    case 'uren':
      return {
        soort: 'uren',
        aantalMensen: waarden.aantalMensen,
        urenPerWeek: waarden.urenPerWeek,
        tariefPerUur: waarden.tariefPerUur,
        productiviteit: waarden.productiviteit,
      };
    case 'stuks':
      return {
        soort: 'stuks',
        stuksPerDag: waarden.stuksPerDag,
        tariefPerStuk: waarden.tariefPerStuk,
        dagenPerMaand: waarden.dagenPerMaand,
      };
    case 'vast':
      return { soort: 'vast', bedrag: waarden.vastBedrag, eenheid: waarden.vastEenheid };
  }
}

interface OpdrachtModalProps {
  isOpen: boolean;
  onClose: () => void;
  opdracht: Opdracht | null;
  /** Nodig om live te laten zien wat de opbrengst wordt. */
  aannames: Aannames;
  onBewaren: (opdracht: Opdracht) => Promise<void>;
}

const OpdrachtModal: React.FC<OpdrachtModalProps> = ({
  isOpen,
  onClose,
  opdracht,
  aannames,
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
  const vastEenheid = watch('vastEenheid');
  const extraEenheid = watch('extraEenheid');
  const huidig = watch();

  // Direct laten zien wat er per maand uitkomt, met de berekening erbij.
  const proefOpdracht: Opdracht = {
    id: 'proef',
    naam: huidig.naam,
    voorWie: huidig.voorWie,
    actief: true,
    opbrengst: naarOpbrengst(huidig),
    toeslagen: huidig.toeslagen,
    overigeOpbrengst: huidig.overigeOpbrengst,
    extraEenheid: huidig.extraEenheid,
  };
  const basis = berekenBasisOpbrengst(proefOpdracht, aannames);
  const totaalOpbrengst = berekenOpbrengst(proefOpdracht, aannames);

  const berekeningInWoorden = () => {
    switch (huidig.soort) {
      case 'stuks':
        return `${huidig.stuksPerDag || 0} stuks × € ${huidig.tariefPerStuk || 0} × ${huidig.dagenPerMaand || 0} dagen`;
      case 'uren':
        return `${huidig.aantalMensen || 0} × ${huidig.urenPerWeek || 0} uur × 52 ÷ 12 × ${huidig.productiviteit || 0} × € ${huidig.tariefPerUur || 0}`;
      case 'vast':
        return `€ ${huidig.vastBedrag || 0} omgerekend naar maand`;
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    reset(opdracht ? naarForm(opdracht) : LEEG);
  }, [isOpen, opdracht, reset]);

  const verstuur = handleSubmit(async (waarden) => {
    await onBewaren({
      id: opdracht?.id ?? `opdracht-${Math.random().toString(36).slice(2, 10)}`,
      naam: waarden.naam.trim(),
      voorWie: waarden.voorWie.trim(),
      actief: waarden.actief,
      opbrengst: naarOpbrengst(waarden),
      toeslagen: waarden.toeslagen,
      overigeOpbrengst: waarden.overigeOpbrengst,
      extraEenheid: waarden.extraEenheid,
    });
    onClose();
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={opdracht ? `${opdracht.naam} bewerken` : 'Nieuwe opdracht'}
      size="lg"
    >
      <form onSubmit={verstuur} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Naam"
            placeholder="Bezorging depot Sittard"
            error={errors.naam?.message}
            {...register('naam', { required: 'Vul een naam in' })}
          />
          <Input
            label="Voor wie"
            placeholder="Riset"
            helperText="De opdrachtgever, als vrije tekst"
            {...register('voorWie')}
          />
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
            Hoe wordt er betaald
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(OPBRENGST_SOORT_LABEL) as OpbrengstSoort[]).map((optie) => (
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
                {OPBRENGST_SOORT_LABEL[optie]}
              </button>
            ))}
          </div>
        </div>

        {soort === 'uren' && (
          <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40">
            <Input
              label="Aantal mensen"
              type="number"
              step="1"
              min="0"
              {...register('aantalMensen', { setValueAs: veiligGetal })}
            />
            <Input
              label="Uren per week per persoon"
              type="number"
              step="0.5"
              min="0"
              {...register('urenPerWeek', { setValueAs: veiligGetal })}
            />
            <Input
              label="Tarief per uur"
              type="number"
              step="0.01"
              min="0"
              helperText="Wat wij hiervoor rekenen"
              {...register('tariefPerUur', { setValueAs: veiligGetal })}
            />
            <Input
              label="Productiviteit"
              type="number"
              step="0.01"
              min="0"
              max="1"
              helperText="0,92 betekent dat 8% van de uren niet declarabel is"
              {...register('productiviteit', { setValueAs: veiligGetal })}
            />
          </div>
        )}

        {soort === 'stuks' && (
          <div className="grid gap-4 sm:grid-cols-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40">
            <Input
              label="Stuks per dag"
              type="number"
              step="1"
              min="0"
              {...register('stuksPerDag', { setValueAs: veiligGetal })}
            />
            <Input
              label="Tarief per stuk"
              type="number"
              step="0.01"
              min="0"
              {...register('tariefPerStuk', { setValueAs: veiligGetal })}
            />
            <Input
              label="Dagen per maand"
              type="number"
              step="1"
              min="0"
              helperText="26 bij ma t/m za"
              {...register('dagenPerMaand', { setValueAs: veiligGetal })}
            />
          </div>
        )}

        {soort === 'vast' && (
          <div className="grid gap-4 sm:grid-cols-2 sm:items-end p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40">
            <Input
              label="Bedrag"
              type="number"
              step="0.01"
              min="0"
              {...register('vastBedrag', { setValueAs: veiligGetal })}
            />
            <div className="space-y-1.5">
              <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
                Eenheid
              </span>
              <EenheidKeuze
                waarde={vastEenheid}
                onChange={(eenheid) => setValue('vastEenheid', eenheid, { shouldDirty: true })}
                className="w-full"
              />
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <Input
            label="Toeslagen"
            type="number"
            step="0.01"
            min="0"
            helperText="Bijvoorbeeld een brandstoftoeslag"
            {...register('toeslagen', { setValueAs: veiligGetal })}
          />
          <Input
            label="Overige opbrengst"
            type="number"
            step="0.01"
            min="0"
            helperText="Wat niet uit het model volgt"
            {...register('overigeOpbrengst', { setValueAs: veiligGetal })}
          />
          <div className="space-y-1.5">
            <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
              Eenheid
            </span>
            <EenheidKeuze
              waarde={extraEenheid}
              onChange={(nieuw) => setValue('extraEenheid', nieuw, { shouldDirty: true })}
              className="w-full"
            />
          </div>
        </div>

        <Uitkomst
          titel="Wat deze opdracht per maand opbrengt"
          regels={[
            { label: 'Uit het model', bedrag: basis, berekening: berekeningInWoorden() },
            {
              label: 'Toeslagen',
              bedrag: naarMaand(huidig.toeslagen || 0, huidig.extraEenheid, aannames),
            },
            {
              label: 'Overige opbrengst',
              bedrag: naarMaand(huidig.overigeOpbrengst || 0, huidig.extraEenheid, aannames),
            },
          ]}
          totaal={{ label: 'Opbrengst per maand', bedrag: totaalOpbrengst }}
          opmerking={
            totaalOpbrengst === 0
              ? 'Nul opbrengst is prima als een andere entiteit hiervoor betaalt — leg dat dan vast onder Onderling. Staat daar niets, dan draagt deze opdracht alleen kosten.'
              : undefined
          }
        />

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
          <Button type="submit" loading={isSubmitting}>
            {opdracht ? 'Opslaan' : 'Opdracht toevoegen'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default OpdrachtModal;
