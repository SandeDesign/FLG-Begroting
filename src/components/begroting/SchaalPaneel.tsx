// src/components/begroting/SchaalPaneel.tsx
// De schaalknoppen: één getal waaraan je draait, waarna de routes, de bussen en
// de mensen meeschalen. Wat eruit volgt staat er direct naast, zodat je nooit
// hoeft te raden wat een knop doet.

import React from 'react';
import { ArrowRight, Info, Layers, Wand2 } from 'lucide-react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { veiligGetal } from '../../utils/firestoreSchoon';
import { berekenSchaalAfgeleid } from '../../utils/begroting.calc';
import { formatEuro, formatGetal } from '../../utils/periode';
import type { Aannames, Schaal, StandaardMedewerker, StandaardMiddel } from '../../types/begroting';

interface SchaalPaneelProps {
  schaal: Schaal;
  aannames: Aannames;
  onWijzigen: (aanpassing: Partial<Schaal>) => void;
  /** Zet de gegenereerde regels om naar losse regels die je kunt fijnslijpen. */
  onVastzetten: () => void;
}

/** Eén regel met een afgeleid getal, zodat zichtbaar is wat een knop doet. */
const Afgeleid: React.FC<{ label: string; waarde: string; toelichting?: string }> = ({
  label,
  waarde,
  toelichting,
}) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5">
    <span className="text-sm text-gray-600 dark:text-gray-300">
      {label}
      {toelichting && (
        <span className="block text-[11px] text-gray-400 dark:text-gray-500">{toelichting}</span>
      )}
    </span>
    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums whitespace-nowrap">
      {waarde}
    </span>
  </div>
);

const SchaalPaneel: React.FC<SchaalPaneelProps> = ({
  schaal,
  aannames,
  onWijzigen,
  onVastzetten,
}) => {
  const afgeleid = berekenSchaalAfgeleid(schaal, aannames);

  const getalVeld = (sleutel: keyof Schaal) => ({
    value: schaal[sleutel] as number,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      onWijzigen({ [sleutel]: veiligGetal(event.target.value) } as Partial<Schaal>),
  });

  const middelVeld = (sleutel: keyof StandaardMiddel) => ({
    value: schaal.standaardMiddel[sleutel],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      onWijzigen({
        standaardMiddel: {
          ...schaal.standaardMiddel,
          [sleutel]: veiligGetal(event.target.value),
        },
      }),
  });

  const medewerkerVeld = (sleutel: keyof StandaardMedewerker) => ({
    value: schaal.standaardMedewerker[sleutel],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      onWijzigen({
        standaardMedewerker: {
          ...schaal.standaardMedewerker,
          [sleutel]: veiligGetal(event.target.value),
        },
      }),
  });

  const heeftRegels = schaal.extraRoutes > 0 || schaal.zzpRoutes > 0;

  return (
    <div className="space-y-4">
      {/* Aan of uit */}
      <Card>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={schaal.actief}
            onChange={(event) => onWijzigen({ actief: event.target.checked })}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="flex-1">
            <span className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              <Layers className="h-4 w-4 text-primary-600 dark:text-primary-400" aria-hidden />
              Schaalknoppen gebruiken
            </span>
            <span className="block text-sm text-gray-500 dark:text-gray-400 mt-1">
              Hiermee zie je in één keer wat er gebeurt als er routes bij komen, zonder elke bus en
              medewerker los in te voeren. Wat je hier instelt komt bovenop de regels die je met de
              hand hebt ingevoerd — het vervangt ze niet.
            </span>
          </span>
        </label>

        {!schaal.actief && (
          <p className="mt-3 pl-7 text-xs text-gray-400 dark:text-gray-500">
            Staat uit: er telt niets van deze pagina mee in de begroting.
          </p>
        )}
      </Card>

      {schaal.actief && (
        <>
          {/* Extra routes met eigen mensen */}
          <Card>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
              Extra routes met eigen mensen
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Routes die je zelf rijdt, met eigen bussen en eigen personeel.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Aantal extra routes"
                type="number"
                step="1"
                min="0"
                {...getalVeld('extraRoutes')}
              />
              <Input
                label="Stuks per route per dag"
                type="number"
                step="1"
                min="0"
                {...getalVeld('stuksPerRoutePerDag')}
              />
              <Input
                label="Tarief per stuk"
                type="number"
                step="0.01"
                min="0"
                helperText="Wat wij hiervoor rekenen"
                {...getalVeld('tariefPerStuk')}
              />
              <Input
                label="Middelen per route"
                type="number"
                step="1"
                min="0"
                helperText="Meestal 1 bus per route"
                {...getalVeld('middelenPerRoute')}
              />
              <Input
                label="Mensen per route"
                type="number"
                step="0.1"
                min="0"
                helperText="Zet op 1,2 als je met verzuimopslag rekent"
                {...getalVeld('mensenPerRoute')}
              />
            </div>

            <div className="mt-5 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40 divide-y divide-gray-200 dark:divide-gray-700">
              <Afgeleid
                label="Extra middelen"
                waarde={formatGetal(afgeleid.extraMiddelen, 1)}
                toelichting={`${schaal.extraRoutes} routes × ${formatGetal(schaal.middelenPerRoute, 1)}`}
              />
              <Afgeleid
                label="Extra mensen"
                waarde={formatGetal(afgeleid.extraMensen, 1)}
                toelichting={`${schaal.extraRoutes} routes × ${formatGetal(schaal.mensenPerRoute, 1)}`}
              />
              <Afgeleid
                label="Extra stuks per dag"
                waarde={formatGetal(afgeleid.extraStuksPerDag, 0)}
              />
              <Afgeleid
                label="Opbrengst per maand"
                waarde={formatEuro(
                  afgeleid.extraStuksPerDag * schaal.tariefPerStuk * aannames.dagenPerMaand
                )}
                toelichting={`${formatGetal(afgeleid.extraStuksPerDag, 0)} × ${formatEuro(schaal.tariefPerStuk)} × ${aannames.dagenPerMaand} dagen`}
              />
              <Afgeleid
                label="Kosten per maand"
                waarde={formatEuro(
                  afgeleid.extraMiddelen * afgeleid.kostenPerMiddel +
                    afgeleid.extraMensen * afgeleid.kostenPerMedewerker
                )}
                toelichting="Middelen plus mensen"
              />
            </div>
          </Card>

          {/* De standaardposten */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
                Standaardmiddel
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Wat één extra bus per maand kost.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Lease of financiering" type="number" step="0.01" min="0" {...middelVeld('lease')} />
                <Input label="Brandstof" type="number" step="0.01" min="0" {...middelVeld('brandstof')} />
                <Input label="Verzekering" type="number" step="0.01" min="0" {...middelVeld('verzekering')} />
                <Input label="Wegenbelasting" type="number" step="0.01" min="0" {...middelVeld('wegenbelasting')} />
                <Input label="Onderhoud, banden, APK" type="number" step="0.01" min="0" {...middelVeld('onderhoud')} />
                <Input label="Overig" type="number" step="0.01" min="0" {...middelVeld('overig')} />
              </div>

              <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40">
                <Afgeleid
                  label="Totaal per extra middel"
                  waarde={formatEuro(afgeleid.kostenPerMiddel)}
                />
              </div>
            </Card>

            <Card>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
                Standaardmedewerker
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Wat één extra medewerker per maand kost. Hier vul je bedragen in, geen percentages.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Bruto loon" type="number" step="0.01" min="0" {...medewerkerVeld('bruto')} />
                <Input label="Vakantiegeld" type="number" step="0.01" min="0" {...medewerkerVeld('vakantiegeld')} />
                <Input label="Werkgeverslasten" type="number" step="0.01" min="0" {...medewerkerVeld('werkgeverslasten')} />
                <Input label="Pensioen" type="number" step="0.01" min="0" {...medewerkerVeld('pensioen')} />
                <Input
                  label="Kleding, telefoon, scanner"
                  type="number"
                  step="0.01"
                  min="0"
                  {...medewerkerVeld('overig')}
                />
              </div>

              <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40">
                <Afgeleid
                  label="Totaal per extra medewerker"
                  waarde={formatEuro(afgeleid.kostenPerMedewerker)}
                />
              </div>
            </Card>
          </div>

          {/* ZZP-routes */}
          <Card>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
              Routes door ZZP'ers
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Routes die je uitbesteedt. Je rekent een tarief aan de opdrachtgever en betaalt de
              ZZP'er een lager tarief; het verschil blijft bij jou.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Aantal ZZP-routes"
                type="number"
                step="1"
                min="0"
                {...getalVeld('zzpRoutes')}
              />
              <Input
                label="Stuks per ZZP-route per dag"
                type="number"
                step="1"
                min="0"
                {...getalVeld('zzpStuksPerRoutePerDag')}
              />
              <Input
                label="Wat wij hiervoor rekenen"
                type="number"
                step="0.01"
                min="0"
                helperText="Per stuk, aan de opdrachtgever"
                {...getalVeld('zzpTariefPerStuk')}
              />
              <Input
                label="Wat wij de ZZP'er betalen"
                type="number"
                step="0.01"
                min="0"
                helperText="Per stuk"
                {...getalVeld('zzpKostenPerStuk')}
              />
              <Input
                label="Middelen per ZZP-route"
                type="number"
                step="1"
                min="0"
                helperText="0 = eigen bus van de ZZP'er, 1 = onze bus"
                {...getalVeld('zzpMiddelenPerRoute')}
              />
            </div>

            <div className="mt-5 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40 divide-y divide-gray-200 dark:divide-gray-700">
              <Afgeleid
                label="Marge per stuk"
                waarde={formatEuro(afgeleid.margePerStuk)}
                toelichting={`${formatEuro(schaal.zzpTariefPerStuk)} min ${formatEuro(schaal.zzpKostenPerStuk)}`}
              />
              <Afgeleid
                label="Stuks per dag"
                waarde={formatGetal(afgeleid.zzpStuksPerDag, 0)}
              />
              <Afgeleid
                label="Kosten per ZZP-route per maand"
                waarde={formatEuro(afgeleid.kostenPerZzpRoute)}
              />
              <Afgeleid
                label="Wat een ZZP-route per dag kost"
                waarde={formatEuro(afgeleid.zzpDagtarief)}
                toelichting="Tarief per stuk × stuks per dag"
              />
              <Afgeleid
                label="Extra middelen voor ZZP-routes"
                waarde={formatGetal(afgeleid.zzpMiddelen, 1)}
              />
              <Afgeleid
                label="Wat er per maand overblijft"
                waarde={formatEuro(
                  afgeleid.zzpStuksPerDag * afgeleid.margePerStuk * aannames.dagenPerMaand -
                    afgeleid.zzpMiddelen * afgeleid.kostenPerMiddel
                )}
                toelichting="Marge min de kosten van eventuele eigen bussen"
              />
            </div>
          </Card>

          {/* Vastzetten */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-2.5 flex-1 min-w-[260px]">
                <Info
                  className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5"
                  aria-hidden
                />
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Zolang de schaal aan staat verschijnen de extra routes als losse regels op de
                  andere tabbladen, maar kun je ze daar niet aanpassen — ze volgen deze knoppen.
                  Wil je per bus of per medewerker iets anders invullen, zet ze dan hier vast: ze
                  worden dan gewone regels en de schaalknoppen gaan uit.
                </p>
              </div>

              <Button variant="outline" onClick={onVastzetten} disabled={!heeftRegels}>
                <Wand2 className="h-4 w-4" aria-hidden />
                Vastzetten als losse regels
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default SchaalPaneel;
