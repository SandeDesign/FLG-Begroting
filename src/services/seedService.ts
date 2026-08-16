// src/services/seedService.ts
// Voorbeelddata om mee te beginnen.
//
// De bezorgingskant komt rechtstreeks uit de Excel-begroting die aan deze app
// ten grondslag ligt: dezelfde routes, dezelfde bussen, hetzelfde personeel en
// dezelfde ZZP-tarieven. De vaste lasten uit die sheet staan hier bewust niet
// bij een werkende entiteit maar bij FLG Holding — die staat boven de
// entiteiten en draagt de vaste lasten van de groep.
//
// Alles is in de app aan te passen; dit is een startpunt, geen waarheid.

import { haalEntiteiten, maakEntiteit, verwijderEntiteit } from './entityService';
import { haalBegrotingen, maakBegroting, verwijderBegroting } from './budgetService';
import {
  LEGE_SCHAAL,
  STANDAARD_AANNAMES,
  type NieuweBudget,
  type BtwTarief,
  type NieuweEntity,
  type Opdracht,
} from '../types/begroting';

/** Wat er is aangemaakt, om terug te melden aan de gebruiker. */
export interface SeedResultaat {
  entiteiten: number;
  begrotingen: number;
}

const PERIODE_VAN = '2026-01';
const PERIODE_TOT = '2026-12';
const RIJDAGEN = 26;

// Personeel volgens de Excel: bruto 3.014, vakantiegeld 241, werkgeverslasten
// 716, kleding/telefoon/scanner 50. Bruto volgt hier uit uurloon maal uren, dus
// het uurloon is teruggerekend: 3.014 ÷ (40 × 52 ÷ 12) = 17,3885.
const UURLOON = 17.3885;
const UREN_PER_WEEK = 40;
const VAKANTIEGELD = 0.08;
const WERKGEVERSLASTEN = 0.22;
const KLEDING_TELEFOON_SCANNER = 50;

function opdracht(
  id: string,
  naam: string,
  voorWie: string,
  opbrengst: Opdracht['opbrengst'],
  btw: BtwTarief = 'hoog'
): Opdracht {
  return {
    id,
    naam,
    voorWie,
    actief: true,
    opbrengst,
    toeslagen: 0,
    overigeOpbrengst: 0,
    extraEenheid: 'maand',
    btw,
  };
}

/** Een route die op pakketten draait. */
function route(id: string, naam: string, voorWie: string, pakkettenPerDag: number, tarief: number) {
  // Op wat wij naar de bezorgingsopdrachtgever factureren is de BTW verlegd —
  // zo is het met de opdrachtgever afgesproken.
  return opdracht(
    id,
    naam,
    voorWie,
    {
      soort: 'stuks',
      stuksPerDag: pakkettenPerDag,
      tariefPerStuk: tarief,
      dagenPerMaand: RIJDAGEN,
    },
    'verlegd'
  );
}

/** Een medewerker in loondienst met de standaardposten uit de Excel. */
function medewerker(id: string, naam: string, hoortBij: string): NieuweBudget['inzet'][number] {
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
      overig: KLEDING_TELEFOON_SCANNER,
    },
  };
}

/** Een bus met de postenindeling uit de Excel. */
function bus(
  id: string,
  naam: string,
  lease: number,
  hoortBij: string
): NieuweBudget['middelen'][number] {
  return {
    id,
    naam,
    hoortBij,
    actief: true,
    financiering: 'lease',
    leasetermijn: lease,
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
    btw: 'hoog',
  };
}

const ENTITEITEN: NieuweEntity[] = [
  {
    naam: 'FLG Holding',
    kvk: '',
    actief: true,
    heeftPersoneel: false,
    isHolding: true,
    kleur: '#673d28',
    volgorde: 0,
    // De vaste lasten van de groep. Uit de sheet Vaste lasten.
    vasteLasten: [
      { id: 'vl-huur', omschrijving: 'Kantoorhuur', bedrag: 2000, eenheid: 'maand', categorie: 'huisvesting', btw: 'hoog' },
      { id: 'vl-gwl', omschrijving: 'Gas, water en licht', bedrag: 330, eenheid: 'maand', categorie: 'huisvesting', btw: 'hoog' },
      { id: 'vl-internet', omschrijving: 'Internet en telefonie', bedrag: 150, eenheid: 'maand', categorie: 'ict', btw: 'hoog' },
      { id: 'vl-boekhouding', omschrijving: 'Boekhouding en salarisadministratie', bedrag: 200, eenheid: 'maand', categorie: 'administratie', btw: 'hoog' },
      { id: 'vl-avb', omschrijving: 'Bedrijfsaansprakelijkheid', bedrag: 0, eenheid: 'maand', categorie: 'verzekering', btw: 'geen' },
      { id: 'vl-software', omschrijving: 'Software (route, scan, boekhouding)', bedrag: 130, eenheid: 'maand', categorie: 'ict', btw: 'hoog' },
      { id: 'vl-bank', omschrijving: 'Bankkosten', bedrag: 60, eenheid: 'maand', categorie: 'administratie', btw: 'geen' },
      { id: 'vl-pand', omschrijving: 'Verzekering pand en inventaris', bedrag: 0, eenheid: 'maand', categorie: 'verzekering', btw: 'geen' },
      { id: 'vl-schade', omschrijving: 'Schade, boetes, eigen risico', bedrag: 0, eenheid: 'maand', categorie: 'overig', btw: 'hoog' },
    ],
  },
  {
    naam: 'Buddy BV',
    kvk: '',
    actief: true,
    heeftPersoneel: true,
    isHolding: false,
    kleur: '#cd853f',
    volgorde: 1,
    vasteLasten: [],
  },
  {
    naam: 'De Installatie BV',
    kvk: '',
    actief: true,
    heeftPersoneel: false,
    isHolding: false,
    kleur: '#3B82F6',
    volgorde: 2,
    vasteLasten: [],
  },
  {
    naam: 'Smart Transport BV',
    kvk: '',
    actief: false,
    heeftPersoneel: false,
    isHolding: false,
    kleur: '#10B981',
    volgorde: 3,
    vasteLasten: [],
  },
];

/** Een lege begroting voor een entiteit die nog niets doet. */
function legeBegroting(entityId: string, naam: string, createdBy: string): NieuweBudget {
  return {
    entityId,
    naam,
    periodeVan: PERIODE_VAN,
    periodeTot: PERIODE_TOT,
    status: 'concept',
    scenarioVan: null,
    weergaveEenheid: 'maand',
    aannames: { ...STANDAARD_AANNAMES, dagenPerMaand: RIJDAGEN },
    schaal: LEGE_SCHAAL,
    opdrachten: [],
    middelen: [],
    inzet: [],
    subsidies: [],
    onderlingeLeveringen: [],
    createdBy,
  };
}

/**
 * Zet de voorbeelddata neer. Geeft terug hoeveel entiteiten en begrotingen er
 * zijn aangemaakt.
 *
 * Staat er al data, dan stopt deze functie — anders krijg je alles dubbel en
 * blijf je met een onoverzichtelijke lijst zitten. Wil je opnieuw beginnen, dan
 * eerst `wisAlleData()`; de knop in de app biedt dat aan.
 */
export async function laadVoorbeelddata(createdBy: string): Promise<SeedResultaat> {
  const bestaand = await haalEntiteiten();
  if (bestaand.length > 0) {
    throw new Error(
      'Er staan al entiteiten in de app. Wis die eerst, anders komt alles dubbel te staan.'
    );
  }

  const [holdingId, buddyId, installatieId, smartId] = await Promise.all(
    ENTITEITEN.map((entiteit) => maakEntiteit(entiteit))
  );

  // ── FLG Holding: draagt de vaste lasten van de groep, verder niets.
  const holding = legeBegroting(holdingId, 'FLG Holding 2026', createdBy);

  // ── Buddy: de bezorging uit de Excel, plus de detachering naar De Installatie.
  //
  // De opdracht Detachering Riset heeft zelf geen tarief: wat Buddy daaraan
  // verdient loopt via de onderlinge levering hieronder. Zou de opdracht óók een
  // tarief hebben, dan telde die opbrengst dubbel.
  const buddy: NieuweBudget = {
    ...legeBegroting(buddyId, 'Buddy 2026 basis', createdBy),
    opdrachten: [
      route('opdracht-route-1', 'Route 1', 'Smart Transport', 100, 2.6),
      route('opdracht-route-2', 'Route 2', 'Smart Transport', 70, 2.6),
      route('opdracht-zzp-routes', 'ZZP-routes', 'Smart Transport', 200, 2.6),
      opdracht('opdracht-detachering', 'Detachering Riset', 'De Installatie BV', {
        soort: 'uren',
        aantalMensen: 3,
        urenPerWeek: 32,
        tariefPerUur: 0,
        productiviteit: 0.92,
      }),
    ],
    middelen: [
      bus('middel-combo', 'Opel Combo', 190, 'opdracht-route-1'),
      bus('middel-ford', 'Ford grote bus', 390, 'opdracht-route-2'),
    ],
    inzet: [
      medewerker('inzet-mw-1', 'Medewerker 1', 'opdracht-route-1'),
      medewerker('inzet-mw-2', 'Medewerker 2', 'opdracht-route-2'),
      {
        id: 'inzet-zzp',
        naam: "ZZP'ers op de ZZP-routes",
        hoortBij: 'opdracht-zzp-routes',
        actief: true,
        // Wat jij de ZZP'er betaalt: € 2,25 per pakket. Jouw tarief is € 2,60,
        // dus de marge is € 0,35 per pakket.
        model: {
          soort: 'zzp_stuk',
          tariefPerStuk: 2.25,
          stuksPerDag: 200,
          dagenPerMaand: RIJDAGEN,
          btw: 'hoog',
        },
      },
      medewerker('inzet-detachering-1', 'Gedetacheerd 1', 'opdracht-detachering'),
      medewerker('inzet-detachering-2', 'Gedetacheerd 2', 'opdracht-detachering'),
      medewerker('inzet-detachering-3', 'Gedetacheerd 3', 'opdracht-detachering'),
    ],
    subsidies: [
      {
        id: 'subsidie-1',
        omschrijving: 'Loonkostensubsidie medewerker 1',
        bedrag: 1500,
        eenheid: 'maand',
        inzetId: 'inzet-mw-1',
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
        btw: 'hoog',
      },
    ],
  };

  // ── De Installatie: factureert Riset en betaalt Buddy voor de mensen.
  const installatie: NieuweBudget = {
    ...legeBegroting(installatieId, 'De Installatie 2026 basis', createdBy),
    opdrachten: [
      opdracht('opdracht-riset', 'Riset', 'Riset', {
        soort: 'uren',
        aantalMensen: 3,
        urenPerWeek: 32,
        tariefPerUur: 43.31,
        productiviteit: 0.92,
      }),
    ],
  };

  // ── Smart Transport: leeg en inactief. De begroting staat er alvast, zodat de
  // routes er straks met één knop naartoe verplaatst kunnen worden.
  const smart = legeBegroting(smartId, 'Smart Transport 2026', createdBy);

  await Promise.all([
    maakBegroting(holding),
    maakBegroting(buddy),
    maakBegroting(installatie),
    maakBegroting(smart),
  ]);

  return { entiteiten: ENTITEITEN.length, begrotingen: 4 };
}


/**
 * Wist alle entiteiten en alle begrotingen. Bedoeld om schoon opnieuw te kunnen
 * beginnen met de voorbeelddata.
 *
 * De begrotingen gaan eerst en apart, zodat ook begrotingen zonder entiteit —
 * wezen van een eerder verwijderde entiteit — gegarandeerd meegaan.
 */
export async function wisAlleData(): Promise<{ entiteiten: number; begrotingen: number }> {
  const begrotingen = await haalBegrotingen();
  await Promise.all(begrotingen.map((begroting) => verwijderBegroting(begroting.id)));

  const entiteiten = await haalEntiteiten();
  await Promise.all(entiteiten.map((entiteit) => verwijderEntiteit(entiteit.id)));

  return { entiteiten: entiteiten.length, begrotingen: begrotingen.length };
}
