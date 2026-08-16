// src/services/seedService.ts
// Voorbeelddata om mee te beginnen: de drie entiteiten en hun begrotingen.
//
// Dit is nadrukkelijk een startpunt, geen waarheid. Alle bedragen, tarieven en
// uren zijn in de app aan te passen; de seed zorgt er alleen voor dat je niet
// tegen een leeg scherm aankijkt en dat de controles meteen iets te controleren
// hebben.

import { maakEntiteit } from './entityService';
import { maakBegroting } from './budgetService';
import { STANDAARD_AANNAMES, type NieuweBudget, type NieuweEntity } from '../types/begroting';

/** Wat er is aangemaakt, om terug te melden aan de gebruiker. */
export interface SeedResultaat {
  entiteiten: number;
  begrotingen: number;
}

const PERIODE_VAN = '2026-01';
const PERIODE_TOT = '2026-12';

// Het personeel zit allemaal bij Buddy. Deze waarden zijn een startpunt —
// uurloon en uren pas je per medewerker aan onder het tabblad Inzet.
const UURLOON = 17.39;
const UREN_PER_WEEK = 40;
const VAKANTIEGELD = 0.08;
const WERKGEVERSLASTEN = 0.22;
const OVERIG_PER_MAAND = 50;

/** Bouwt een loondienst-inzet met de standaardwaarden hierboven. */
function loondienst(id: string, naam: string, hoortBij: string): NieuweBudget['inzet'][number] {
  return {
    id,
    naam,
    hoortBij,
    actief: true,
    model: {
      soort: 'loondienst',
      uurloon: UURLOON,
      urenPerWeek: UREN_PER_WEEK,
      vakantiegeldPct: VAKANTIEGELD,
      werkgeverslastenPct: WERKGEVERSLASTEN,
      pensioen: 0,
      overig: OVERIG_PER_MAAND,
    },
  };
}

/** Bouwt een bestelbus met de posten uit het startpunt. */
function bus(
  id: string,
  naam: string,
  leasetermijn: number,
  hoortBij: string
): NieuweBudget['middelen'][number] {
  return {
    id,
    naam,
    hoortBij,
    actief: true,
    financiering: 'lease',
    leasetermijn,
    waarde: 0,
    looptijdMaanden: 0,
    restwaarde: 0,
    brandstof: 1000,
    verzekering: 150,
    wegenbelasting: 50,
    onderhoud: 150,
    onderhoudBerekenen: false,
    overig: 0,
    eenheid: 'maand',
  };
}

const ENTITEITEN: NieuweEntity[] = [
  {
    naam: 'Buddy BV',
    kvk: '',
    actief: true,
    heeftPersoneel: true,
    kleur: '#cd853f',
    volgorde: 1,
    vasteLasten: [
      { id: 'vl-huur', omschrijving: 'Kantoorhuur', bedrag: 2000, eenheid: 'maand', categorie: 'huisvesting' },
      { id: 'vl-gwl', omschrijving: 'Gas, water en licht', bedrag: 330, eenheid: 'maand', categorie: 'huisvesting' },
      { id: 'vl-internet', omschrijving: 'Internet', bedrag: 150, eenheid: 'maand', categorie: 'ict' },
      { id: 'vl-boekhouding', omschrijving: 'Boekhouding', bedrag: 200, eenheid: 'maand', categorie: 'administratie' },
      { id: 'vl-software', omschrijving: 'Software', bedrag: 130, eenheid: 'maand', categorie: 'ict' },
      { id: 'vl-bank', omschrijving: 'Bankkosten', bedrag: 60, eenheid: 'maand', categorie: 'administratie' },
    ],
  },
  {
    naam: 'De Installatie BV',
    kvk: '',
    actief: true,
    heeftPersoneel: false,
    kleur: '#3B82F6',
    volgorde: 2,
    vasteLasten: [],
  },
  {
    naam: 'Smart Transport BV',
    kvk: '',
    actief: false,
    heeftPersoneel: false,
    kleur: '#10B981',
    volgorde: 3,
    vasteLasten: [],
  },
];

/**
 * Zet de voorbeelddata neer. Geeft terug hoeveel entiteiten en begrotingen er
 * zijn aangemaakt.
 *
 * Er wordt niets gecontroleerd op wat er al staat: draai je dit twee keer, dan
 * krijg je alles dubbel. De knop in de app waarschuwt daarvoor.
 */
export async function laadVoorbeelddata(createdBy: string): Promise<SeedResultaat> {
  const [buddyId, installatieId, smartId] = await Promise.all(
    ENTITEITEN.map((entiteit) => maakEntiteit(entiteit))
  );

  // ── Buddy: bezorging op eigen rekening, en detachering naar De Installatie.
  //
  // De opdracht Detachering Riset heeft zelf geen tarief: wat Buddy daaraan
  // verdient loopt via de onderlinge levering hieronder. Zou de opdracht óók
  // een tarief hebben, dan telde die opbrengst dubbel.
  const buddy: NieuweBudget = {
    entityId: buddyId,
    naam: 'Buddy 2026 basis',
    periodeVan: PERIODE_VAN,
    periodeTot: PERIODE_TOT,
    status: 'concept',
    scenarioVan: null,
    weergaveEenheid: 'maand',
    aannames: STANDAARD_AANNAMES,
    opdrachten: [
      {
        id: 'opdracht-bezorging',
        naam: 'Bezorging',
        voorWie: 'Smart Transport',
        actief: true,
        opbrengst: { soort: 'stuks', stuksPerDag: 165, tariefPerStuk: 2.6, dagenPerMaand: 26 },
      },
      {
        id: 'opdracht-detachering',
        naam: 'Detachering Riset',
        voorWie: 'De Installatie BV',
        actief: true,
        opbrengst: {
          soort: 'uren',
          aantalMensen: 3,
          urenPerWeek: 32,
          tariefPerUur: 0,
          productiviteit: 0.92,
        },
      },
    ],
    middelen: [
      bus('middel-combo', 'Opel Combo', 200, 'opdracht-bezorging'),
      bus('middel-ford', 'Ford grote bus', 390, 'opdracht-bezorging'),
    ],
    inzet: [
      loondienst('inzet-bezorging-1', 'Bezorger 1', 'opdracht-bezorging'),
      loondienst('inzet-bezorging-2', 'Bezorger 2', 'opdracht-bezorging'),
      loondienst('inzet-detachering-1', 'Gedetacheerd 1', 'opdracht-detachering'),
      loondienst('inzet-detachering-2', 'Gedetacheerd 2', 'opdracht-detachering'),
      loondienst('inzet-detachering-3', 'Gedetacheerd 3', 'opdracht-detachering'),
    ],
    subsidies: [
      {
        id: 'subsidie-1',
        omschrijving: 'Loonkostensubsidie medewerker 1',
        bedrag: 1500,
        eenheid: 'maand',
        inzetId: 'inzet-bezorging-1',
        einddatum: null,
      },
    ],
    onderlingeLeveringen: [
      {
        id: 'levering-detachering',
        omschrijving: 'Buddy detacheert 3 medewerkers aan De Installatie (3 × € 3.000)',
        vanEntityId: buddyId,
        naarEntityId: installatieId,
        opdrachtId: 'opdracht-detachering',
        grondslag: 'vast',
        tarief: 9000,
        aantal: 3,
        eenheid: 'maand',
      },
    ],
    createdBy,
  };

  // ── De Installatie: factureert Riset en betaalt Buddy voor de mensen.
  const installatie: NieuweBudget = {
    entityId: installatieId,
    naam: 'De Installatie 2026 basis',
    periodeVan: PERIODE_VAN,
    periodeTot: PERIODE_TOT,
    status: 'concept',
    scenarioVan: null,
    weergaveEenheid: 'maand',
    aannames: STANDAARD_AANNAMES,
    opdrachten: [
      {
        id: 'opdracht-riset',
        naam: 'Riset',
        voorWie: 'Riset',
        actief: true,
        opbrengst: {
          soort: 'uren',
          aantalMensen: 3,
          urenPerWeek: 32,
          tariefPerUur: 43.31,
          productiviteit: 0.92,
        },
      },
    ],
    middelen: [],
    inzet: [],
    subsidies: [],
    onderlingeLeveringen: [],
    createdBy,
  };

  // ── Smart Transport: leeg en inactief. De begroting staat er alvast, zodat de
  // opdracht Bezorging er straks met één knop naartoe verplaatst kan worden.
  const smart: NieuweBudget = {
    entityId: smartId,
    naam: 'Smart Transport 2026 basis',
    periodeVan: PERIODE_VAN,
    periodeTot: PERIODE_TOT,
    status: 'concept',
    scenarioVan: null,
    weergaveEenheid: 'maand',
    aannames: STANDAARD_AANNAMES,
    opdrachten: [],
    middelen: [],
    inzet: [],
    subsidies: [],
    onderlingeLeveringen: [],
    createdBy,
  };

  await Promise.all([maakBegroting(buddy), maakBegroting(installatie), maakBegroting(smart)]);

  return { entiteiten: ENTITEITEN.length, begrotingen: 3 };
}
