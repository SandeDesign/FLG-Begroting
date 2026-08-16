// src/types/begroting.ts
// Het volledige datamodel van FLG-Begroting.
//
// Terminologie is bindend: entiteit, begroting, scenario, opdracht, voor wie,
// wie het uitvoert, hoort bij, opbrengst, wat het ons kost, wat wij hiervoor
// rekenen, wat er overblijft, onderling, middel, inzet, vaste lasten, directe
// kosten. Geen boekhoudjargon.

import type { Timestamp } from 'firebase/firestore';

// ─── Periode-eenheden ───────────────────────────────────────────────────────
// Maand is de interne rekenbasis. Alles wordt bij invoer naar maand omgerekend
// en bij weergave weer terug.

export type Eenheid = 'uur' | 'dag' | 'week' | 'maand' | 'jaar';

export const EENHEDEN: Eenheid[] = ['uur', 'dag', 'week', 'maand', 'jaar'];

export const EENHEID_LABEL: Record<Eenheid, string> = {
  uur: 'per uur',
  dag: 'per dag',
  week: 'per week',
  maand: 'per maand',
  jaar: 'per jaar',
};

export const EENHEID_KORT: Record<Eenheid, string> = {
  uur: 'u',
  dag: 'dag',
  week: 'wk',
  maand: 'mnd',
  jaar: 'jr',
};

// ─── Entiteit ───────────────────────────────────────────────────────────────

export type VasteLastCategorie =
  | 'huisvesting'
  | 'administratie'
  | 'verzekering'
  | 'ict'
  | 'overig';

export const VASTE_LAST_CATEGORIE_LABEL: Record<VasteLastCategorie, string> = {
  huisvesting: 'Huisvesting',
  administratie: 'Administratie',
  verzekering: 'Verzekering',
  ict: 'ICT',
  overig: 'Overig',
};

export interface VasteLast {
  id: string;
  omschrijving: string;
  bedrag: number;
  /** De eenheid waarin dit bedrag is ingevoerd. */
  eenheid: Eenheid;
  categorie: VasteLastCategorie;
}

export interface Entity {
  id: string;
  naam: string;
  kvk: string;
  actief: boolean;
  /** Alleen een entiteit met personeel mag inzet in loondienst hebben. */
  heeftPersoneel: boolean;
  /**
   * De holding boven de entiteiten. Daar zitten de vaste lasten van de groep,
   * die dus niet op een werkende entiteit drukken. Een holding heeft normaal
   * gesproken geen eigen opdrachten.
   */
  isHolding: boolean;
  /** Hex-kleur, voor herkenning in het ketenoverzicht. */
  kleur: string;
  volgorde: number;
  vasteLasten: VasteLast[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Wat er nodig is om een entiteit aan te maken; id en timestamps komen erbij. */
export type NieuweEntity = Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * De drie soorten entiteit, zoals je ze in de UI kiest. Intern blijven het twee
 * losse vlaggen, zodat een entiteit die ooit anders wordt ingericht niet vastzit
 * aan één hokje.
 */
export type EntiteitSoort = 'bv' | 'bv_met_personeel' | 'holding';

export const ENTITEIT_SOORT_LABEL: Record<EntiteitSoort, string> = {
  bv: 'BV',
  bv_met_personeel: 'BV met personeel',
  holding: 'Holding',
};

export const ENTITEIT_SOORT_UITLEG: Record<EntiteitSoort, string> = {
  bv: 'Een werkende BV zonder eigen personeel. Inzet gaat via ZZP of via een andere entiteit.',
  bv_met_personeel: 'Een werkende BV met mensen in loondienst. Alleen hier kun je loondienst-inzet toevoegen.',
  holding: 'Staat boven de entiteiten en draagt de vaste lasten van de groep. Heeft normaal geen eigen opdrachten.',
};

/** Leidt de soort af uit de twee vlaggen op de entiteit. */
export function entiteitSoort(entiteit: Pick<Entity, 'heeftPersoneel' | 'isHolding'>): EntiteitSoort {
  if (entiteit.isHolding) return 'holding';
  return entiteit.heeftPersoneel ? 'bv_met_personeel' : 'bv';
}

/** En andersom: van een gekozen soort naar de twee vlaggen. */
export function soortNaarVlaggen(soort: EntiteitSoort): {
  heeftPersoneel: boolean;
  isHolding: boolean;
} {
  return {
    heeftPersoneel: soort === 'bv_met_personeel',
    isHolding: soort === 'holding',
  };
}

// ─── Opdracht ───────────────────────────────────────────────────────────────

export type OpbrengstModel =
  | {
      soort: 'uren';
      aantalMensen: number;
      urenPerWeek: number;
      tariefPerUur: number;
      /** 0,92 betekent dat 8% van de uren niet declarabel is. */
      productiviteit: number;
    }
  | {
      soort: 'stuks';
      stuksPerDag: number;
      tariefPerStuk: number;
      dagenPerMaand: number;
    }
  | {
      soort: 'vast';
      bedrag: number;
      eenheid: Eenheid;
    };

export type OpbrengstSoort = OpbrengstModel['soort'];

export const OPBRENGST_SOORT_LABEL: Record<OpbrengstSoort, string> = {
  uren: 'Per uur',
  stuks: 'Per stuk',
  vast: 'Vast bedrag',
};

export interface Opdracht {
  id: string;
  naam: string;
  /** Vrije tekst: voor wie we deze opdracht uitvoeren. */
  voorWie: string;
  actief: boolean;
  opbrengst: OpbrengstModel;
  /** Toeslagen bovenop de opbrengst, bijvoorbeeld een brandstoftoeslag. */
  toeslagen: number;
  /** Overige opbrengst die niet uit het model volgt. */
  overigeOpbrengst: number;
  /** De eenheid van toeslagen en overige opbrengst. */
  extraEenheid: Eenheid;
}

// ─── Middel ─────────────────────────────────────────────────────────────────

export type Financiering = 'lease' | 'financial_lease' | 'eigendom';

export const FINANCIERING_LABEL: Record<Financiering, string> = {
  lease: 'Lease',
  financial_lease: 'Financial lease',
  eigendom: 'Eigendom',
};

/** Waarde die `hoortBij` krijgt als iets op de entiteit zelf drukt. */
export const HOORT_BIJ_ENTITEIT = 'entiteit';

export interface Middel {
  id: string;
  naam: string;
  /** Een opdrachtId, of 'entiteit' als het middel op de entiteit zelf drukt. */
  hoortBij: string;
  actief: boolean;
  financiering: Financiering;
  /** Bij financiering 'lease'. */
  leasetermijn: number;
  /** Bij financiering 'financial_lease' of 'eigendom'. */
  waarde: number;
  looptijdMaanden: number;
  restwaarde: number;
  brandstof: number;
  verzekering: number;
  wegenbelasting: number;
  /** Leeg laten en onderhoudBerekenen aanzetten om uit km × onderhoudPerKm te rekenen. */
  onderhoud: number;
  onderhoudBerekenen: boolean;
  overig: number;
  /** De eenheid waarin de bedragen van dit middel zijn ingevoerd. */
  eenheid: Eenheid;
}

// ─── Inzet ──────────────────────────────────────────────────────────────────

export type InzetModel =
  | {
      soort: 'loondienst';
      uurloon: number;
      urenPerWeek: number;
      vakantiegeldPct: number;
      werkgeverslastenPct: number;
      pensioen: number;
      overig: number;
    }
  | {
      soort: 'zzp_stuk';
      tariefPerStuk: number;
      stuksPerDag: number;
      dagenPerMaand: number;
    }
  | {
      soort: 'zzp_dag';
      dagtarief: number;
      dagenPerMaand: number;
    };

export type InzetSoort = InzetModel['soort'];

export const INZET_SOORT_LABEL: Record<InzetSoort, string> = {
  loondienst: 'Loondienst',
  zzp_stuk: 'ZZP per stuk',
  zzp_dag: 'ZZP per dag',
};

export interface Inzet {
  id: string;
  naam: string;
  /** Precies één opdrachtId — inzet hoort nooit bij meerdere opdrachten. */
  hoortBij: string;
  actief: boolean;
  model: InzetModel;
}

// ─── Subsidie ───────────────────────────────────────────────────────────────
// Een subsidie is een eigen regel in de resultatenstaat en wordt nooit van een
// kost afgetrokken. Hij hoort bij de entiteit, niet bij de opdracht.

export interface Subsidie {
  id: string;
  omschrijving: string;
  bedrag: number;
  eenheid: Eenheid;
  /** Informatief: bij wie de subsidie hoort. Verandert niets aan de berekening. */
  inzetId: string | null;
  /** "2027-06", of leeg als de subsidie doorloopt. */
  einddatum: string | null;
}

// ─── Onderlinge levering ────────────────────────────────────────────────────
// Telt bij de leverende entiteit als opbrengst en bij de ontvangende entiteit
// als directe kost. In het ketenoverzicht vallen ze tegen elkaar weg.

export type Grondslag = 'per_uur' | 'per_stuk' | 'vast';

export const GRONDSLAG_LABEL: Record<Grondslag, string> = {
  per_uur: 'Per uur',
  per_stuk: 'Per stuk',
  vast: 'Vast bedrag',
};

/**
 * Het BTW-tarief op een onderlinge factuur.
 *
 * BTW telt niet mee in het resultaat: je draagt hem af en de ontvangende
 * entiteit vordert hem terug, dus per saldo is het een doorlopende post. Hij
 * staat er wel bij, omdat het factuurbedrag anders niet klopt met wat er
 * werkelijk heen en weer gaat.
 */
export type BtwTarief = 'hoog' | 'laag' | 'geen' | 'verlegd';

export const BTW_LABEL: Record<BtwTarief, string> = {
  hoog: '21%',
  laag: '9%',
  geen: 'Geen BTW',
  verlegd: 'Verlegd',
};

export const BTW_PERCENTAGE: Record<BtwTarief, number> = {
  hoog: 0.21,
  laag: 0.09,
  geen: 0,
  // Bij verlegde BTW staat er geen BTW op de factuur; de ontvanger geeft hem
  // zelf aan en trekt hem in dezelfde aangifte weer af.
  verlegd: 0,
};

export interface OnderlingeLevering {
  id: string;
  omschrijving: string;
  vanEntityId: string;
  naarEntityId: string;
  /** Welke opdracht deze levering betreft. */
  opdrachtId: string;
  grondslag: Grondslag;
  /** Wat wij hiervoor rekenen — handmatig ingevuld. */
  tarief: number;
  /** Uren of stuks per maand. Bij grondslag 'vast' niet gebruikt. */
  aantal: number;
  eenheid: Eenheid;
  /** Wat er op de factuur staat. Verandert niets aan het resultaat. */
  btw: BtwTarief;
}

// ─── Aannames ───────────────────────────────────────────────────────────────

/**
 * Hoe de vaste lasten over de opdrachten worden verdeeld.
 * - omzet: naar rato van de opbrengst per opdracht (standaard)
 * - gelijk: elke actieve opdracht een even groot deel
 * - handmatig: percentages uit `handmatigeVerdeling`
 */
export type Verdeelsleutel = 'omzet' | 'gelijk' | 'handmatig';

export const VERDEELSLEUTEL_LABEL: Record<Verdeelsleutel, string> = {
  omzet: 'Naar rato van opbrengst',
  gelijk: 'Gelijk over de opdrachten',
  handmatig: 'Handmatig ingevuld',
};

export interface Aannames {
  /** 26 bij maandag tot en met zaterdag. */
  dagenPerMaand: number;
  /** Basis voor de omrekening van en naar uur. */
  contracturenPerWeek: number;
  urenPerDag: number;
  kmPerDagPerMiddel: number;
  onderhoudPerKm: number;
  /** Bijvoorbeeld 0,075 voor 7,5%. */
  rente: number;
  /** Bijvoorbeeld 0,21 voor 21%. */
  btwTarief: number;
  verdeelsleutel: Verdeelsleutel;
  /** opdrachtId → percentage (0–100). Alleen gebruikt bij verdeelsleutel 'handmatig'. */
  handmatigeVerdeling: Record<string, number>;
}

export const STANDAARD_AANNAMES: Aannames = {
  dagenPerMaand: 26,
  contracturenPerWeek: 40,
  urenPerDag: 8,
  kmPerDagPerMiddel: 120,
  onderhoudPerKm: 0.05,
  rente: 0.075,
  btwTarief: 0.21,
  verdeelsleutel: 'omzet',
  handmatigeVerdeling: {},
};

// ─── Schaal ─────────────────────────────────────────────────────────────────
// De schaalknoppen uit de Excel: één getal waaraan je draait, waarna de routes,
// de bussen en de mensen meeschalen. Bedoeld om snel te zien wat er gebeurt bij
// routes erbij, zonder alles los in te voeren.
//
// De posten staan hier bewust als bedragen en niet als percentages, precies
// zoals in de Excel. Wat je invult is wat je terugziet.

/** De vaste posten van één standaardbus, per maand. */
export interface StandaardMiddel {
  lease: number;
  brandstof: number;
  verzekering: number;
  wegenbelasting: number;
  onderhoud: number;
  overig: number;
}

/** De vaste posten van één standaardmedewerker, per maand. */
export interface StandaardMedewerker {
  bruto: number;
  vakantiegeld: number;
  werkgeverslasten: number;
  pensioen: number;
  /** Kleding, telefoon, scanner. */
  overig: number;
}

export interface Schaal {
  /** Staat de schaal uit, dan telt er niets van mee. */
  actief: boolean;

  // Extra routes die je zelf rijdt, met eigen mensen
  extraRoutes: number;
  stuksPerRoutePerDag: number;
  tariefPerStuk: number;
  middelenPerRoute: number;
  mensenPerRoute: number;

  standaardMiddel: StandaardMiddel;
  standaardMedewerker: StandaardMedewerker;

  // Routes die je door ZZP'ers laat rijden
  zzpRoutes: number;
  zzpStuksPerRoutePerDag: number;
  /** Wat wij hiervoor rekenen. */
  zzpTariefPerStuk: number;
  /** Wat wij de ZZP'er betalen. */
  zzpKostenPerStuk: number;
  /** 0 = de ZZP'er brengt een eigen bus mee, 1 = onze bus. */
  zzpMiddelenPerRoute: number;
}

export const LEGE_SCHAAL: Schaal = {
  actief: false,
  extraRoutes: 0,
  stuksPerRoutePerDag: 100,
  tariefPerStuk: 2.3,
  middelenPerRoute: 1,
  mensenPerRoute: 1,
  standaardMiddel: {
    lease: 250,
    brandstof: 1000,
    verzekering: 150,
    wegenbelasting: 50,
    onderhoud: 150,
    overig: 0,
  },
  standaardMedewerker: {
    bruto: 3014,
    vakantiegeld: 241,
    werkgeverslasten: 716,
    pensioen: 0,
    overig: 50,
  },
  zzpRoutes: 0,
  zzpStuksPerRoutePerDag: 100,
  zzpTariefPerStuk: 2.6,
  zzpKostenPerStuk: 2.25,
  zzpMiddelenPerRoute: 0,
};

/** De id's die de schaal aan zijn gegenereerde regels geeft. */
export const SCHAAL_IDS = {
  extraOpdracht: 'schaal-extra-routes',
  extraMiddel: 'schaal-extra-middelen',
  extraInzet: 'schaal-extra-inzet',
  zzpOpdracht: 'schaal-zzp-routes',
  zzpMiddel: 'schaal-zzp-middelen',
  zzpInzet: 'schaal-zzp-inzet',
} as const;

/** Herkent een regel die door de schaal is gemaakt in plaats van met de hand. */
export function isSchaalRegel(id: string): boolean {
  return id.startsWith('schaal-');
}

// ─── Begroting ──────────────────────────────────────────────────────────────

export type BegrotingStatus = 'concept' | 'vastgesteld' | 'archief';

export const BEGROTING_STATUS_LABEL: Record<BegrotingStatus, string> = {
  concept: 'Concept',
  vastgesteld: 'Vastgesteld',
  archief: 'Archief',
};

export interface Budget {
  id: string;
  entityId: string;
  naam: string;
  /** "2026-01" */
  periodeVan: string;
  /** "2026-12" */
  periodeTot: string;
  status: BegrotingStatus;
  /** Het budgetId waar dit scenario uit gedupliceerd is. */
  scenarioVan: string | null;
  /** De eenheid waarin de gebruiker nu naar de resultatenstaat kijkt. */
  weergaveEenheid: Eenheid;
  aannames: Aannames;
  /** De schaalknoppen. Genereert extra routes bovenop de handmatige regels. */
  schaal: Schaal;
  opdrachten: Opdracht[];
  middelen: Middel[];
  inzet: Inzet[];
  subsidies: Subsidie[];
  onderlingeLeveringen: OnderlingeLevering[];
  /**
   * Afgeleid veld, geschreven door budgetService. Firestore kan niet queryen op
   * een veld binnen een array van objecten, dus dit maakt het mogelijk om met
   * array-contains de inkomende leveringen van een entiteit op te halen.
   * De array onderlingeLeveringen blijft de bron van waarheid.
   */
  leveringNaarEntityIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export type NieuweBudget = Omit<
  Budget,
  'id' | 'createdAt' | 'updatedAt' | 'leveringNaarEntityIds'
>;

// ─── Rekenresultaten ────────────────────────────────────────────────────────
// Alle bedragen in deze types zijn per maand — de interne rekenbasis. Omrekenen
// naar de weergave-eenheid gebeurt pas in de UI.

/** Wat er nodig is om deze opdracht quitte te laten draaien. */
export type BreakEven =
  | { soort: 'stuks'; stuksPerDag: number }
  | { soort: 'uren'; tariefPerUur: number }
  | { soort: 'vast'; bedragPerMaand: number };

export interface OpdrachtResultaat {
  opdrachtId: string;
  naam: string;
  voorWie: string;
  opbrengst: number;
  kostenMiddelen: number;
  kostenInzet: number;
  directeKosten: number;
  /** Opbrengst min directe kosten. */
  overVoorVasteLasten: number;
  aandeelVasteLasten: number;
  overNaVasteLasten: number;
  breakEven: BreakEven;
  /**
   * Het aantal stuks of uren per maand waar deze opdracht op draait. Nul bij een
   * opdracht met een vast bedrag.
   */
  volumePerMaand: number;
  /** Hoe dat volume heet, voor de labels in de UI. */
  volumeEenheid: 'stuks' | 'uren' | 'geen';
  /** Wat er per stuk of per uur overblijft na de vaste lasten. */
  resultaatPerEenheid: number;
}

export interface LeveringRegel {
  id: string;
  omschrijving: string;
  vanEntityId: string;
  naarEntityId: string;
  opdrachtId: string;
  /** Bedrag per maand, exclusief BTW. Dit telt mee in het resultaat. */
  bedrag: number;
  /** De BTW over dat bedrag. Telt niet mee in het resultaat. */
  btwBedrag: number;
  /** Wat er op de factuur komt te staan: bedrag plus BTW. */
  factuurbedrag: number;
  btw: BtwTarief;
  tarief: number;
  aantal: number;
  grondslag: Grondslag;
}

export interface Afwijking {
  /** Waar de afwijking zit, bijvoorbeeld "Opdracht Bezorging — directe kosten". */
  waar: string;
  verwacht: number;
  gevonden: number;
  verschil: number;
}

export interface BegrotingResultaat {
  budgetId: string;
  budgetNaam: string;
  entityId: string;
  entiteitNaam: string;
  /** De aannames waarmee gerekend is — nodig om het resultaat na te kunnen rekenen. */
  aannames: Aannames;

  // Opbrengsten
  opbrengstOpdrachten: number;
  opbrengstOnderlingUit: number;
  totaleOpbrengst: number;

  // Subsidies — eigen regel, nooit verrekend met een kost
  subsidies: number;

  // Kosten
  kostenMiddelen: number;
  kostenInzet: number;
  kostenOnderlingIn: number;
  vasteLasten: number;
  totaleKosten: number;

  // Uitkomst
  resultaat: number;
  /** Dezelfde begroting zonder de subsidieregel. */
  resultaatZonderSubsidie: number;

  opdrachten: OpdrachtResultaat[];
  /** Kosten die op de entiteit drukken in plaats van op een opdracht. */
  kostenOpEntiteit: number;
  kostenMiddelenOpEntiteit: number;
  kostenInzetOpEntiteit: number;
  /** Vaste lasten die niet over opdrachten verdeeld konden worden. */
  nietVerdeeldeVasteLasten: number;

  onderlingUit: LeveringRegel[];
  onderlingIn: LeveringRegel[];
  /** BTW op de uitgaande onderlinge facturen. Telt niet mee in het resultaat. */
  btwOnderlingUit: number;
  /** BTW op de inkomende onderlinge facturen. Telt niet mee in het resultaat. */
  btwOnderlingIn: number;

  /** Totaal aantal stuks per maand over alle opdrachten die op stuks draaien. */
  stuksPerMaand: number;
  /** Wat er per stuk overblijft, over de hele begroting. */
  resultaatPerStuk: number;
  /** Wat er per actieve opdracht gemiddeld overblijft. */
  resultaatPerOpdracht: number;

  /** Waarschuwingen over de invoer, bijvoorbeeld loondienst zonder personeel. */
  waarschuwingen: string[];
}

export interface KetenStroom {
  id: string;
  omschrijving: string;
  vanEntityId: string;
  vanNaam: string;
  naarEntityId: string;
  naarNaam: string;
  opdrachtId: string;
  bedrag: number;
}

export interface KetenResultaat {
  entiteiten: BegrotingResultaat[];
  /** Opbrengst van alle entiteiten bij elkaar, inclusief onderlinge leveringen. */
  opbrengstBruto: number;
  /** Wat er onderling wordt geleverd en dus tegen elkaar wegvalt. */
  onderlingTotaal: number;
  /** Opbrengst naar buiten toe: bruto min onderling. */
  opbrengstNetto: number;
  subsidies: number;
  kostenBruto: number;
  kostenNetto: number;
  resultaat: number;
  resultaatZonderSubsidie: number;
  stromen: KetenStroom[];
  afwijkingen: Afwijking[];
}
