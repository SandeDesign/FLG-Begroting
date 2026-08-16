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
  /** Hex-kleur, voor herkenning in het ketenoverzicht. */
  kleur: string;
  volgorde: number;
  vasteLasten: VasteLast[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Wat er nodig is om een entiteit aan te maken; id en timestamps komen erbij. */
export type NieuweEntity = Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>;

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
}

export interface LeveringRegel {
  id: string;
  omschrijving: string;
  vanEntityId: string;
  naarEntityId: string;
  opdrachtId: string;
  /** Bedrag per maand. */
  bedrag: number;
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
  /** Kosten van middelen die op de entiteit drukken in plaats van op een opdracht. */
  kostenOpEntiteit: number;
  /** Vaste lasten die niet over opdrachten verdeeld konden worden. */
  nietVerdeeldeVasteLasten: number;

  onderlingUit: LeveringRegel[];
  onderlingIn: LeveringRegel[];

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
