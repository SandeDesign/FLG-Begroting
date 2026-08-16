// src/utils/begroting.calc.ts
// De rekenmotor. Pure functies: geen Firestore, geen React, geen datum van nu.
// Alles wat hier uitkomt moet met de hand na te rekenen zijn — zie
// docs/REKENMOTOR.md voor uitgewerkte voorbeelden.
//
// Alle bedragen in dit bestand zijn per maand. Omrekenen naar de weergave-
// eenheid gebeurt pas in de UI.

import type {
  Aannames,
  Afwijking,
  BegrotingResultaat,
  BreakEven,
  Budget,
  Entity,
  Inzet,
  KetenResultaat,
  KetenStroom,
  LeveringRegel,
  Middel,
  OnderlingeLevering,
  Opdracht,
  OpdrachtResultaat,
  Subsidie,
} from '../types/begroting';
import { BTW_PERCENTAGE, HOORT_BIJ_ENTITEIT, LEGE_SCHAAL, SCHAAL_IDS } from '../types/begroting';
import { EENHEDEN } from '../types/begroting';
import type { Schaal, StandaardMedewerker, StandaardMiddel } from '../types/begroting';
import { naarMaand, vanMaand } from './periode';

const WEKEN_PER_JAAR = 52;
const MAANDEN_PER_JAAR = 12;

/** Verschillen kleiner dan een halve cent zijn afrondingsruis, geen fout. */
const TOLERANTIE = 0.005;

/** Beschermt tegen NaN en Infinity die anders door de hele staat heen lekken. */
function getal(waarde: number): number {
  return Number.isFinite(waarde) ? waarde : 0;
}

function som(waarden: number[]): number {
  return waarden.reduce((totaal, waarde) => totaal + getal(waarde), 0);
}

// ─── Opbrengst per opdracht ─────────────────────────────────────────────────

/**
 * De kale opbrengst uit het model, zonder toeslagen. Per maand.
 *
 * - uren:  aantalMensen × urenPerWeek × 52 / 12 × productiviteit × tariefPerUur
 * - stuks: stuksPerDag × tariefPerStuk × dagenPerMaand
 * - vast:  het bedrag omgerekend naar maand
 */
export function berekenBasisOpbrengst(opdracht: Opdracht, aannames: Aannames): number {
  const model = opdracht.opbrengst;

  switch (model.soort) {
    case 'uren':
      return getal(
        model.aantalMensen *
          model.urenPerWeek *
          (WEKEN_PER_JAAR / MAANDEN_PER_JAAR) *
          model.productiviteit *
          model.tariefPerUur
      );
    case 'stuks':
      return getal(model.stuksPerDag * model.tariefPerStuk * model.dagenPerMaand);
    case 'vast':
      return naarMaand(model.bedrag, model.eenheid, aannames);
  }
}

/**
 * De volledige opbrengst van één opdracht per maand: het model plus eventuele
 * toeslagen en overige opbrengst.
 */
export function berekenOpbrengst(opdracht: Opdracht, aannames: Aannames): number {
  return som([
    berekenBasisOpbrengst(opdracht, aannames),
    naarMaand(opdracht.toeslagen ?? 0, opdracht.extraEenheid ?? 'maand', aannames),
    naarMaand(opdracht.overigeOpbrengst ?? 0, opdracht.extraEenheid ?? 'maand', aannames),
  ]);
}

/**
 * Het volume waar een opdracht op draait, per maand: stuks of declarabele uren.
 * Bij een vast bedrag valt er niets te tellen.
 */
export function berekenVolume(
  opdracht: Opdracht
): { volume: number; eenheid: 'stuks' | 'uren' | 'geen' } {
  const model = opdracht.opbrengst;

  switch (model.soort) {
    case 'stuks':
      return { volume: getal(model.stuksPerDag * model.dagenPerMaand), eenheid: 'stuks' };
    case 'uren':
      return {
        volume: getal(
          model.aantalMensen *
            model.urenPerWeek *
            (WEKEN_PER_JAAR / MAANDEN_PER_JAAR) *
            model.productiviteit
        ),
        eenheid: 'uren',
      };
    case 'vast':
      return { volume: 0, eenheid: 'geen' };
  }
}

// ─── Kosten van een middel ──────────────────────────────────────────────────

/**
 * Annuïteit: de vaste maandtermijn om een bedrag in n maanden af te lossen
 * inclusief rente. Bij rente 0 is dat simpelweg het bedrag gedeeld door n.
 */
export function annuiteit(maandrente: number, looptijdMaanden: number, hoofdsom: number): number {
  if (looptijdMaanden <= 0) return 0;
  if (maandrente === 0) return getal(hoofdsom / looptijdMaanden);

  const noemer = 1 - Math.pow(1 + maandrente, -looptijdMaanden);
  if (noemer === 0) return 0;

  return getal((hoofdsom * maandrente) / noemer);
}

/**
 * De financieringslast van een middel, per maand.
 *
 * Bij lease is dat de leasetermijn, omgerekend vanuit de eenheid van het middel.
 * Bij financial lease en eigendom gaat het om een aanschafwaarde die over de
 * looptijd in maanden wordt uitgesmeerd — die uitkomst is per definitie al per
 * maand en wordt dus niet nog eens omgerekend.
 */
export function berekenFinancieringslast(middel: Middel, aannames: Aannames): number {
  switch (middel.financiering) {
    case 'lease':
      return naarMaand(middel.leasetermijn, middel.eenheid, aannames);
    case 'financial_lease':
      return annuiteit(
        aannames.rente / MAANDEN_PER_JAAR,
        middel.looptijdMaanden,
        middel.waarde - middel.restwaarde
      );
    case 'eigendom':
      if (middel.looptijdMaanden <= 0) return 0;
      return getal((middel.waarde - middel.restwaarde) / middel.looptijdMaanden);
  }
}

/**
 * De onderhoudskosten van een middel, per maand. Staat onderhoudBerekenen aan,
 * dan volgt het bedrag uit de gereden kilometers; anders is het het ingevoerde
 * bedrag, omgerekend naar maand.
 */
export function berekenOnderhoud(middel: Middel, aannames: Aannames): number {
  if (middel.onderhoudBerekenen) {
    return getal(aannames.kmPerDagPerMiddel * aannames.dagenPerMaand * aannames.onderhoudPerKm);
  }
  return naarMaand(middel.onderhoud, middel.eenheid, aannames);
}

/** Alle kosten van één middel bij elkaar, per maand. */
export function berekenMiddel(middel: Middel, aannames: Aannames): number {
  return som([
    berekenFinancieringslast(middel, aannames),
    naarMaand(middel.brandstof, middel.eenheid, aannames),
    naarMaand(middel.verzekering, middel.eenheid, aannames),
    naarMaand(middel.wegenbelasting, middel.eenheid, aannames),
    berekenOnderhoud(middel, aannames),
    naarMaand(middel.overig, middel.eenheid, aannames),
  ]);
}

// ─── Kosten van inzet ───────────────────────────────────────────────────────

/**
 * Wat één inzet ons kost, per maand.
 *
 * Loondienst:
 *   bruto            = uurloon × urenPerWeek × 52 / 12
 *   vakantiegeld     = bruto × vakantiegeldPct
 *   werkgeverslasten = (bruto + vakantiegeld) × werkgeverslastenPct
 *   totaal           = bruto + vakantiegeld + werkgeverslasten + pensioen + overig
 *
 * De percentages zijn breuken: 8% staat als 0,08 in het model.
 *
 * Deze functie heeft de aannames niet nodig: loondienst rekent met de eigen
 * urenPerWeek, en beide ZZP-vormen dragen hun eigen dagenPerMaand bij zich.
 */
export function berekenInzet(inzet: Inzet): number {
  const model = inzet.model;

  switch (model.soort) {
    case 'loondienst': {
      const bruto = getal(model.uurloon * model.urenPerWeek * (WEKEN_PER_JAAR / MAANDEN_PER_JAAR));
      const vakantiegeld = getal(bruto * model.vakantiegeldPct);
      const werkgeverslasten = getal((bruto + vakantiegeld) * model.werkgeverslastenPct);
      return som([bruto, vakantiegeld, werkgeverslasten, model.pensioen, model.overig]);
    }
    case 'zzp_stuk':
      return getal(model.tariefPerStuk * model.stuksPerDag * model.dagenPerMaand);
    case 'zzp_dag':
      return getal(model.dagtarief * model.dagenPerMaand);
  }
}

/**
 * De inzet in woorden, zodat in een lijst meteen te zien is wat iemand krijgt.
 * Bij ZZP is dat het tarief dat de uitvoerder ontvangt — de vraag die je bij een
 * lijstje anders alleen kunt beantwoorden door de regel open te klikken.
 */
export function omschrijfInzet(inzet: Inzet): string {
  const model = inzet.model;
  const euro = (bedrag: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(getal(bedrag));

  switch (model.soort) {
    case 'loondienst':
      return `${euro(model.uurloon)} per uur · ${model.urenPerWeek} uur per week`;
    case 'zzp_stuk':
      return `krijgt ${euro(model.tariefPerStuk)} per stuk · ${model.stuksPerDag} stuks per dag · ${model.dagenPerMaand} dagen`;
    case 'zzp_dag':
      return `krijgt ${euro(model.dagtarief)} per dag · ${model.dagenPerMaand} dagen per maand`;
  }
}

/**
 * Wat een ZZP-inzet per stuk of per dag ontvangt, met de bijbehorende eenheid.
 * Null bij loondienst, want daar is er geen tarief per stuk.
 */
export function zzpTarief(
  inzet: Inzet
): { bedrag: number; eenheid: 'stuk' | 'dag'; perDag: number; perMaand: number } | null {
  const model = inzet.model;

  if (model.soort === 'zzp_stuk') {
    return {
      bedrag: model.tariefPerStuk,
      eenheid: 'stuk',
      perDag: getal(model.tariefPerStuk * model.stuksPerDag),
      perMaand: getal(model.tariefPerStuk * model.stuksPerDag * model.dagenPerMaand),
    };
  }

  if (model.soort === 'zzp_dag') {
    return {
      bedrag: model.dagtarief,
      eenheid: 'dag',
      perDag: model.dagtarief,
      perMaand: getal(model.dagtarief * model.dagenPerMaand),
    };
  }

  return null;
}

/** De losse regels van een loondienstberekening, om in de UI te kunnen tonen. */
export function splitsLoondienst(
  inzet: Inzet
): { bruto: number; vakantiegeld: number; werkgeverslasten: number; pensioen: number; overig: number } | null {
  if (inzet.model.soort !== 'loondienst') return null;

  const model = inzet.model;
  const bruto = getal(model.uurloon * model.urenPerWeek * (WEKEN_PER_JAAR / MAANDEN_PER_JAAR));
  const vakantiegeld = getal(bruto * model.vakantiegeldPct);
  const werkgeverslasten = getal((bruto + vakantiegeld) * model.werkgeverslastenPct);

  return {
    bruto,
    vakantiegeld,
    werkgeverslasten,
    pensioen: getal(model.pensioen),
    overig: getal(model.overig),
  };
}

// ─── Subsidie en onderlinge levering ────────────────────────────────────────

/** Een subsidie per maand. Altijd een eigen regel, nooit van een kost afgetrokken. */
export function berekenSubsidie(subsidie: Subsidie, aannames: Aannames): number {
  return naarMaand(subsidie.bedrag, subsidie.eenheid, aannames);
}

/**
 * Wat er per maand onderling geleverd wordt, exclusief BTW.
 *
 * Bij een vast bedrag telt alleen het tarief. Bij per uur en per stuk is het
 * tarief maal het aantal; de eenheid geeft aan over welke periode dat aantal
 * gaat en is normaal gesproken maand.
 */
export function berekenLevering(levering: OnderlingeLevering, aannames: Aannames): number {
  if (levering.grondslag === 'vast') {
    return naarMaand(levering.tarief, levering.eenheid, aannames);
  }
  return naarMaand(levering.tarief * levering.aantal, levering.eenheid, aannames);
}

/**
 * De BTW over een onderlinge levering.
 *
 * Deze telt bewust niet mee in het resultaat: de leverende entiteit draagt hem
 * af en de ontvangende vordert hem terug, dus binnen de groep is het een
 * doorlopende post. Hij wordt wel getoond, want anders klopt het bedrag op de
 * factuur niet met wat je in de begroting ziet staan.
 */
export function berekenLeveringBtw(levering: OnderlingeLevering, aannames: Aannames): number {
  const tarief = BTW_PERCENTAGE[levering.btw ?? 'hoog'];
  return getal(berekenLevering(levering, aannames) * tarief);
}

function naarLeveringRegel(levering: OnderlingeLevering, aannames: Aannames): LeveringRegel {
  const bedrag = berekenLevering(levering, aannames);
  const btwBedrag = berekenLeveringBtw(levering, aannames);

  return {
    id: levering.id,
    omschrijving: levering.omschrijving,
    vanEntityId: levering.vanEntityId,
    naarEntityId: levering.naarEntityId,
    opdrachtId: levering.opdrachtId,
    bedrag,
    btwBedrag,
    factuurbedrag: bedrag + btwBedrag,
    btw: levering.btw ?? 'hoog',
    tarief: levering.tarief,
    aantal: levering.aantal,
    grondslag: levering.grondslag,
  };
}

// ─── Verdeling van de vaste lasten ──────────────────────────────────────────

/**
 * Bepaalt per opdracht welk deel van de vaste lasten hij draagt.
 * De aandelen tellen altijd op tot 1, zodat er niets zoekraakt.
 *
 * - omzet:     naar rato van de opbrengst (valt terug op gelijk bij nul omzet)
 * - gelijk:    elke actieve opdracht een even groot deel
 * - handmatig: naar rato van de ingevulde percentages, genormaliseerd zodat een
 *              lijst die niet op 100 uitkomt toch netjes verdeeld wordt
 */
export function bepaalVerdeling(
  opdrachten: Opdracht[],
  opbrengstPerOpdracht: Map<string, number>,
  aannames: Aannames
): Map<string, number> {
  const verdeling = new Map<string, number>();
  if (opdrachten.length === 0) return verdeling;

  const gelijkAandeel = 1 / opdrachten.length;

  const gelijkVerdelen = () => {
    opdrachten.forEach((opdracht) => verdeling.set(opdracht.id, gelijkAandeel));
    return verdeling;
  };

  if (aannames.verdeelsleutel === 'gelijk') {
    return gelijkVerdelen();
  }

  if (aannames.verdeelsleutel === 'handmatig') {
    const gewichten = opdrachten.map((opdracht) =>
      Math.max(0, getal(aannames.handmatigeVerdeling[opdracht.id] ?? 0))
    );
    const totaalGewicht = som(gewichten);
    if (totaalGewicht <= 0) return gelijkVerdelen();

    opdrachten.forEach((opdracht, index) => {
      verdeling.set(opdracht.id, gewichten[index] / totaalGewicht);
    });
    return verdeling;
  }

  // Standaard: naar rato van de opbrengst.
  const totaleOpbrengst = som(opdrachten.map((opdracht) => opbrengstPerOpdracht.get(opdracht.id) ?? 0));
  if (totaleOpbrengst <= 0) return gelijkVerdelen();

  opdrachten.forEach((opdracht) => {
    verdeling.set(opdracht.id, getal(opbrengstPerOpdracht.get(opdracht.id) ?? 0) / totaleOpbrengst);
  });
  return verdeling;
}

// ─── Break-even ─────────────────────────────────────────────────────────────

/**
 * Wat er nodig is om deze opdracht quitte te laten draaien: precies genoeg om
 * de directe kosten plus het aandeel in de vaste lasten te dekken.
 *
 * Het aandeel in de vaste lasten wordt daarbij gelijk gehouden aan de huidige
 * verdeling. Bij de verdeelsleutel op omzet zou een ander tarief dat aandeel
 * namelijk ook verschuiven; die kringloop maakt de uitkomst onnavolgbaar en
 * dat is precies wat we hier niet willen.
 */
export function berekenBreakEven(opdracht: Opdracht, tekortTeDekken: number): BreakEven {
  // Toeslagen en overige opbrengst dekken al een deel van de kosten, dus het
  // model hoeft alleen de rest goed te maken.
  const model = opdracht.opbrengst;

  switch (model.soort) {
    case 'stuks': {
      const noemer = model.tariefPerStuk * model.dagenPerMaand;
      return { soort: 'stuks', stuksPerDag: noemer > 0 ? getal(tekortTeDekken / noemer) : 0 };
    }
    case 'uren': {
      const noemer =
        model.aantalMensen *
        model.urenPerWeek *
        (WEKEN_PER_JAAR / MAANDEN_PER_JAAR) *
        model.productiviteit;
      return { soort: 'uren', tariefPerUur: noemer > 0 ? getal(tekortTeDekken / noemer) : 0 };
    }
    case 'vast':
      return { soort: 'vast', bedragPerMaand: getal(tekortTeDekken) };
  }
}

// ─── De schaalknoppen ───────────────────────────────────────────────────────

/** Wat één standaardbus per maand kost. */
export function totaalStandaardMiddel(middel: StandaardMiddel): number {
  return som([
    middel.lease,
    middel.brandstof,
    middel.verzekering,
    middel.wegenbelasting,
    middel.onderhoud,
    middel.overig,
  ]);
}

/** Wat één standaardmedewerker per maand kost. */
export function totaalStandaardMedewerker(medewerker: StandaardMedewerker): number {
  return som([
    medewerker.bruto,
    medewerker.vakantiegeld,
    medewerker.werkgeverslasten,
    medewerker.pensioen,
    medewerker.overig,
  ]);
}

/** De getallen die uit de schaalknoppen volgen, om in de UI te tonen. */
export interface SchaalAfgeleid {
  extraMiddelen: number;
  extraMensen: number;
  extraStuksPerDag: number;
  kostenPerMiddel: number;
  kostenPerMedewerker: number;
  zzpMiddelen: number;
  zzpStuksPerDag: number;
  kostenPerZzpRoute: number;
  /** Wat wij rekenen min wat wij de ZZP'er betalen. */
  margePerStuk: number;
  /** Tarief per stuk maal stuks per dag: wat een ZZP-route per dag kost. */
  zzpDagtarief: number;
}

export function berekenSchaalAfgeleid(schaal: Schaal, aannames: Aannames): SchaalAfgeleid {
  return {
    extraMiddelen: getal(schaal.extraRoutes * schaal.middelenPerRoute),
    extraMensen: getal(schaal.extraRoutes * schaal.mensenPerRoute),
    extraStuksPerDag: getal(schaal.extraRoutes * schaal.stuksPerRoutePerDag),
    kostenPerMiddel: totaalStandaardMiddel(schaal.standaardMiddel),
    kostenPerMedewerker: totaalStandaardMedewerker(schaal.standaardMedewerker),
    zzpMiddelen: getal(schaal.zzpRoutes * schaal.zzpMiddelenPerRoute),
    zzpStuksPerDag: getal(schaal.zzpRoutes * schaal.zzpStuksPerRoutePerDag),
    kostenPerZzpRoute: getal(
      schaal.zzpKostenPerStuk * schaal.zzpStuksPerRoutePerDag * aannames.dagenPerMaand
    ),
    margePerStuk: getal(schaal.zzpTariefPerStuk - schaal.zzpKostenPerStuk),
    zzpDagtarief: getal(schaal.zzpKostenPerStuk * schaal.zzpStuksPerRoutePerDag),
  };
}

/**
 * Zet een standaardmedewerker om naar een gewone loondienst-inzet.
 *
 * De schaal werkt met bedragen en het inzetmodel met percentages, dus de
 * percentages worden hier teruggerekend. Zo komt er exact hetzelfde bedrag uit
 * als je in de schaal hebt ingevuld.
 */
function alsLoondienst(
  id: string,
  naam: string,
  hoortBij: string,
  aantal: number,
  medewerker: StandaardMedewerker,
  aannames: Aannames
): Inzet {
  const urenPerMaand = aannames.contracturenPerWeek * (WEKEN_PER_JAAR / MAANDEN_PER_JAAR);
  const bruto = getal(medewerker.bruto * aantal);

  return {
    id,
    naam,
    hoortBij,
    actief: true,
    model: {
      soort: 'loondienst',
      uurloon: urenPerMaand > 0 ? getal(bruto / urenPerMaand) : 0,
      urenPerWeek: aannames.contracturenPerWeek,
      vakantiegeldPct: bruto > 0 ? getal((medewerker.vakantiegeld * aantal) / bruto) : 0,
      werkgeverslastenPct:
        bruto + medewerker.vakantiegeld * aantal > 0
          ? getal(
              (medewerker.werkgeverslasten * aantal) / (bruto + medewerker.vakantiegeld * aantal)
            )
          : 0,
      pensioen: getal(medewerker.pensioen * aantal),
      overig: getal(medewerker.overig * aantal),
    },
  };
}

/** Zet een standaardbus om naar een gewoon middel, maal het aantal bussen. */
function alsMiddel(
  id: string,
  naam: string,
  hoortBij: string,
  aantal: number,
  standaard: StandaardMiddel
): Middel {
  return {
    id,
    naam,
    hoortBij,
    actief: true,
    financiering: 'lease',
    leasetermijn: getal(standaard.lease * aantal),
    waarde: 0,
    looptijdMaanden: 0,
    restwaarde: 0,
    brandstof: getal(standaard.brandstof * aantal),
    verzekering: getal(standaard.verzekering * aantal),
    wegenbelasting: getal(standaard.wegenbelasting * aantal),
    onderhoud: getal(standaard.onderhoud * aantal),
    onderhoudBerekenen: false,
    overig: getal(standaard.overig * aantal),
    eenheid: 'maand',
  };
}

/**
 * Zet de schaalknoppen om naar gewone opdrachten, middelen en inzet, en plakt ze
 * achter de handmatige regels.
 *
 * Zo hoeft de rest van de rekenmotor niets van de schaal te weten: de totalen,
 * de verdeling van de vaste lasten en alle controles werken er vanzelf overheen.
 */
export function pasSchaalToe(budget: Budget): Budget {
  const schaal = budget.schaal ?? LEGE_SCHAAL;
  if (!schaal.actief) return budget;

  const aannames = budget.aannames;
  const afgeleid = berekenSchaalAfgeleid(schaal, aannames);

  const opdrachten: Opdracht[] = [...budget.opdrachten];
  const middelen: Middel[] = [...budget.middelen];
  const inzet: Inzet[] = [...budget.inzet];

  // Extra routes die je zelf rijdt.
  if (schaal.extraRoutes > 0) {
    opdrachten.push({
      id: SCHAAL_IDS.extraOpdracht,
      naam: `Extra routes (${schaal.extraRoutes} stuks)`,
      voorWie: 'Uit de schaalknoppen',
      actief: true,
      opbrengst: {
        soort: 'stuks',
        stuksPerDag: afgeleid.extraStuksPerDag,
        tariefPerStuk: schaal.tariefPerStuk,
        dagenPerMaand: aannames.dagenPerMaand,
      },
      toeslagen: 0,
      overigeOpbrengst: 0,
      extraEenheid: 'maand',
    });

    if (afgeleid.extraMiddelen > 0) {
      middelen.push(
        alsMiddel(
          SCHAAL_IDS.extraMiddel,
          `Extra middelen (${afgeleid.extraMiddelen} stuks)`,
          SCHAAL_IDS.extraOpdracht,
          afgeleid.extraMiddelen,
          schaal.standaardMiddel
        )
      );
    }

    if (afgeleid.extraMensen > 0) {
      inzet.push(
        alsLoondienst(
          SCHAAL_IDS.extraInzet,
          `Extra mensen (${afgeleid.extraMensen} stuks)`,
          SCHAAL_IDS.extraOpdracht,
          afgeleid.extraMensen,
          schaal.standaardMedewerker,
          aannames
        )
      );
    }
  }

  // Routes die je door ZZP'ers laat rijden.
  if (schaal.zzpRoutes > 0) {
    opdrachten.push({
      id: SCHAAL_IDS.zzpOpdracht,
      naam: `ZZP-routes (${schaal.zzpRoutes} stuks)`,
      voorWie: 'Uit de schaalknoppen',
      actief: true,
      opbrengst: {
        soort: 'stuks',
        stuksPerDag: afgeleid.zzpStuksPerDag,
        tariefPerStuk: schaal.zzpTariefPerStuk,
        dagenPerMaand: aannames.dagenPerMaand,
      },
      toeslagen: 0,
      overigeOpbrengst: 0,
      extraEenheid: 'maand',
    });

    if (afgeleid.zzpMiddelen > 0) {
      middelen.push(
        alsMiddel(
          SCHAAL_IDS.zzpMiddel,
          `Middelen voor ZZP-routes (${afgeleid.zzpMiddelen} stuks)`,
          SCHAAL_IDS.zzpOpdracht,
          afgeleid.zzpMiddelen,
          schaal.standaardMiddel
        )
      );
    }

    inzet.push({
      id: SCHAAL_IDS.zzpInzet,
      naam: `ZZP'ers (${schaal.zzpRoutes} routes)`,
      hoortBij: SCHAAL_IDS.zzpOpdracht,
      actief: true,
      model: {
        soort: 'zzp_stuk',
        tariefPerStuk: schaal.zzpKostenPerStuk,
        stuksPerDag: afgeleid.zzpStuksPerDag,
        dagenPerMaand: aannames.dagenPerMaand,
      },
    });
  }

  return { ...budget, opdrachten, middelen, inzet };
}

// ─── De begroting doorrekenen ───────────────────────────────────────────────

/**
 * Rekent één begroting door.
 *
 * @param budget               de begroting zelf
 * @param entity               de entiteit waar hij bij hoort, voor de vaste lasten
 * @param inkomendeLeveringen  leveringen van andere entiteiten naar deze toe
 */
export function berekenBegroting(
  ruweBudget: Budget,
  entity: Entity,
  inkomendeLeveringen: OnderlingeLevering[]
): BegrotingResultaat {
  // De schaalknoppen worden eerst omgezet naar gewone regels. Daarna weet de
  // rest van deze functie niets meer van de schaal en kloppen alle controles.
  const budget = pasSchaalToe(ruweBudget);
  const aannames = budget.aannames;
  const waarschuwingen: string[] = [];

  const actieveOpdrachten = budget.opdrachten.filter((opdracht) => opdracht.actief);
  const actieveOpdrachtIds = new Set(actieveOpdrachten.map((opdracht) => opdracht.id));

  // ── Opbrengsten per opdracht
  const opbrengstPerOpdracht = new Map<string, number>();
  actieveOpdrachten.forEach((opdracht) => {
    opbrengstPerOpdracht.set(opdracht.id, berekenOpbrengst(opdracht, aannames));
  });

  // Het totaal wordt apart opgeteld over alle actieve opdrachten. Dat lijkt
  // dubbelop, maar juist die tweede optelling maakt controle 1 zinvol.
  const opbrengstOpdrachten = som(
    actieveOpdrachten.map((opdracht) => berekenOpbrengst(opdracht, aannames))
  );

  // ── Middelen
  const actieveMiddelen = budget.middelen.filter((middel) => middel.actief);
  const kostenMiddelen = som(actieveMiddelen.map((middel) => berekenMiddel(middel, aannames)));

  const middelenPerOpdracht = new Map<string, number>();
  let middelenOpEntiteit = 0;

  actieveMiddelen.forEach((middel) => {
    const kosten = berekenMiddel(middel, aannames);
    if (middel.hoortBij === HOORT_BIJ_ENTITEIT || !actieveOpdrachtIds.has(middel.hoortBij)) {
      if (middel.hoortBij !== HOORT_BIJ_ENTITEIT) {
        waarschuwingen.push(
          `Middel "${middel.naam}" hoort bij een opdracht die niet bestaat of niet actief is; de kosten drukken nu op de entiteit.`
        );
      }
      middelenOpEntiteit += kosten;
      return;
    }
    middelenPerOpdracht.set(middel.hoortBij, (middelenPerOpdracht.get(middel.hoortBij) ?? 0) + kosten);
  });

  // ── Inzet
  const actieveInzet = budget.inzet.filter((inzet) => inzet.actief);
  const kostenInzet = som(actieveInzet.map((inzet) => berekenInzet(inzet)));

  const inzetPerOpdracht = new Map<string, number>();
  let inzetOpEntiteit = 0;

  actieveInzet.forEach((inzet) => {
    const kosten = berekenInzet(inzet);

    // Loondienst mag alleen op een entiteit met personeel. In de UI is het
    // geblokkeerd; hier melden we het alsnog, want data kan van elders komen.
    if (inzet.model.soort === 'loondienst' && !entity.heeftPersoneel) {
      waarschuwingen.push(
        `Inzet "${inzet.naam}" staat op loondienst, maar ${entity.naam} heeft geen personeel. Zet de entiteit op "heeft personeel" of maak er een ZZP-inzet van.`
      );
    }

    if (!actieveOpdrachtIds.has(inzet.hoortBij)) {
      waarschuwingen.push(
        `Inzet "${inzet.naam}" hoort bij een opdracht die niet bestaat of niet actief is; de kosten drukken nu op de entiteit.`
      );
      inzetOpEntiteit += kosten;
      return;
    }
    inzetPerOpdracht.set(inzet.hoortBij, (inzetPerOpdracht.get(inzet.hoortBij) ?? 0) + kosten);
  });

  // ── Subsidies: eigen regel, nooit verrekend
  const subsidies = som(budget.subsidies.map((subsidie) => berekenSubsidie(subsidie, aannames)));

  // Een einddatum is informatief: de motor rekent met één maandbedrag en weet
  // niet welke maand het is. Loopt een subsidie af binnen de periode van deze
  // begroting, dan is het maandbedrag dus te rooskleurig — dat melden we.
  budget.subsidies
    .filter((subsidie) => subsidie.einddatum && subsidie.einddatum < budget.periodeTot)
    .forEach((subsidie) => {
      waarschuwingen.push(
        `Subsidie "${subsidie.omschrijving}" loopt af in ${subsidie.einddatum}, vóór het einde van deze begroting (${budget.periodeTot}). Het bedrag telt hier nog voor de hele periode mee; kijk ook naar het resultaat zonder subsidie.`
      );
    });

  // ── Vaste lasten van de entiteit
  const vasteLasten = som(
    entity.vasteLasten.map((last) => naarMaand(last.bedrag, last.eenheid, aannames))
  );

  const verdeling = bepaalVerdeling(actieveOpdrachten, opbrengstPerOpdracht, aannames);
  const verdeeldeVasteLasten = som(
    actieveOpdrachten.map((opdracht) => vasteLasten * (verdeling.get(opdracht.id) ?? 0))
  );
  const nietVerdeeldeVasteLasten = getal(vasteLasten - verdeeldeVasteLasten);

  // ── Onderlinge leveringen
  const uitgaand = budget.onderlingeLeveringen.filter(
    (levering) => levering.vanEntityId === entity.id
  );
  const onderlingUit = uitgaand.map((levering) => naarLeveringRegel(levering, aannames));
  const onderlingIn = inkomendeLeveringen
    .filter((levering) => levering.naarEntityId === entity.id)
    .map((levering) => naarLeveringRegel(levering, aannames));

  const opbrengstOnderlingUit = som(onderlingUit.map((regel) => regel.bedrag));
  const kostenOnderlingIn = som(onderlingIn.map((regel) => regel.bedrag));
  const btwOnderlingUit = som(onderlingUit.map((regel) => regel.btwBedrag));
  const btwOnderlingIn = som(onderlingIn.map((regel) => regel.btwBedrag));

  budget.onderlingeLeveringen
    .filter((levering) => levering.vanEntityId !== entity.id)
    .forEach((levering) => {
      waarschuwingen.push(
        `Onderlinge levering "${levering.omschrijving}" is opgeslagen bij ${entity.naam}, maar wordt geleverd door een andere entiteit. Sla hem op bij de leverende entiteit.`
      );
    });

  // Een opdracht zonder opbrengst is meestal geen fout: de opbrengst loopt dan
  // via een onderlinge levering. Alleen als die er níét is, is het het melden
  // waard — dan staan er wel kosten tegenover en niets ertegenover.
  actieveOpdrachten
    .filter((opdracht) => berekenOpbrengst(opdracht, aannames) === 0)
    .filter((opdracht) => !uitgaand.some((levering) => levering.opdrachtId === opdracht.id))
    .filter(
      (opdracht) =>
        (middelenPerOpdracht.get(opdracht.id) ?? 0) + (inzetPerOpdracht.get(opdracht.id) ?? 0) > 0
    )
    .forEach((opdracht) => {
      waarschuwingen.push(
        `Opdracht "${opdracht.naam}" heeft geen opbrengst, maar er hangen wel kosten aan. Vul een tarief in, of leg een onderlinge levering vast als een andere entiteit hiervoor betaalt.`
      );
    });

  // ── Per opdracht
  const opdrachten: OpdrachtResultaat[] = actieveOpdrachten.map((opdracht) => {
    const opbrengst = getal(opbrengstPerOpdracht.get(opdracht.id) ?? 0);
    const kostenMiddelenOpdracht = getal(middelenPerOpdracht.get(opdracht.id) ?? 0);
    const kostenInzetOpdracht = getal(inzetPerOpdracht.get(opdracht.id) ?? 0);
    const directeKosten = kostenMiddelenOpdracht + kostenInzetOpdracht;
    const aandeelVasteLasten = getal(vasteLasten * (verdeling.get(opdracht.id) ?? 0));
    const overVoorVasteLasten = opbrengst - directeKosten;
    const overNaVasteLasten = overVoorVasteLasten - aandeelVasteLasten;
    const { volume, eenheid: volumeEenheid } = berekenVolume(opdracht);

    return {
      opdrachtId: opdracht.id,
      naam: opdracht.naam,
      voorWie: opdracht.voorWie,
      opbrengst,
      kostenMiddelen: kostenMiddelenOpdracht,
      kostenInzet: kostenInzetOpdracht,
      directeKosten,
      overVoorVasteLasten,
      aandeelVasteLasten,
      overNaVasteLasten,
      breakEven: berekenBreakEven(
        opdracht,
        directeKosten +
          aandeelVasteLasten -
          naarMaand(opdracht.toeslagen ?? 0, opdracht.extraEenheid ?? 'maand', aannames) -
          naarMaand(opdracht.overigeOpbrengst ?? 0, opdracht.extraEenheid ?? 'maand', aannames)
      ),
      volumePerMaand: volume,
      volumeEenheid,
      resultaatPerEenheid: volume > 0 ? getal(overNaVasteLasten / volume) : 0,
    };
  });

  // ── Totalen
  const totaleOpbrengst = opbrengstOpdrachten + opbrengstOnderlingUit;
  const totaleKosten = kostenMiddelen + kostenInzet + kostenOnderlingIn + vasteLasten;
  const resultaat = totaleOpbrengst + subsidies - totaleKosten;

  // Kengetallen: waar draait het op en wat blijft er per eenheid over.
  const stuksPerMaand = som(
    opdrachten
      .filter((regel) => regel.volumeEenheid === 'stuks')
      .map((regel) => regel.volumePerMaand)
  );

  return {
    budgetId: budget.id,
    budgetNaam: budget.naam,
    entityId: entity.id,
    entiteitNaam: entity.naam,
    aannames,

    opbrengstOpdrachten,
    opbrengstOnderlingUit,
    totaleOpbrengst,

    subsidies,

    kostenMiddelen,
    kostenInzet,
    kostenOnderlingIn,
    vasteLasten,
    totaleKosten,

    resultaat,
    resultaatZonderSubsidie: resultaat - subsidies,

    opdrachten,
    kostenOpEntiteit: middelenOpEntiteit + inzetOpEntiteit,
    kostenMiddelenOpEntiteit: middelenOpEntiteit,
    kostenInzetOpEntiteit: inzetOpEntiteit,
    nietVerdeeldeVasteLasten,

    onderlingUit,
    onderlingIn,
    btwOnderlingUit,
    btwOnderlingIn,

    stuksPerMaand,
    resultaatPerStuk: stuksPerMaand > 0 ? getal(resultaat / stuksPerMaand) : 0,
    resultaatPerOpdracht: opdrachten.length > 0 ? getal(resultaat / opdrachten.length) : 0,

    waarschuwingen,
  };
}

// ─── Controles ──────────────────────────────────────────────────────────────

function vergelijk(
  waar: string,
  verwacht: number,
  gevonden: number,
  afwijkingen: Afwijking[]
): void {
  const verschil = getal(gevonden - verwacht);
  if (Math.abs(verschil) > TOLERANTIE) {
    afwijkingen.push({ waar, verwacht: getal(verwacht), gevonden: getal(gevonden), verschil });
  }
}

/**
 * Herberekent elk totaal langs een tweede, onafhankelijke weg en geeft elk
 * verschil terug. Een lege lijst betekent dat alles klopt.
 */
export function controleerBegroting(resultaat: BegrotingResultaat): Afwijking[] {
  const afwijkingen: Afwijking[] = [];

  // 1. De opdrachtregels tellen op tot de opbrengst uit opdrachten.
  vergelijk(
    'Opbrengst uit opdrachten — som van de opdrachtregels',
    resultaat.opbrengstOpdrachten,
    som(resultaat.opdrachten.map((opdracht) => opdracht.opbrengst)),
    afwijkingen
  );

  // 2. De middelen per opdracht plus die op de entiteit vormen samen het totaal.
  vergelijk(
    'Kosten middelen — som per opdracht plus entiteit',
    resultaat.kostenMiddelen,
    som(resultaat.opdrachten.map((opdracht) => opdracht.kostenMiddelen)) +
      resultaat.kostenMiddelenOpEntiteit,
    afwijkingen
  );

  // 3. Hetzelfde voor de inzet.
  vergelijk(
    'Kosten inzet — som per opdracht plus entiteit',
    resultaat.kostenInzet,
    som(resultaat.opdrachten.map((opdracht) => opdracht.kostenInzet)) +
      resultaat.kostenInzetOpEntiteit,
    afwijkingen
  );

  // 4. De verdeelde vaste lasten tellen op tot het totaal aan vaste lasten.
  vergelijk(
    'Vaste lasten — verdeeld over de opdrachten plus niet verdeeld',
    resultaat.vasteLasten,
    som(resultaat.opdrachten.map((opdracht) => opdracht.aandeelVasteLasten)) +
      resultaat.nietVerdeeldeVasteLasten,
    afwijkingen
  );

  // 5. De resultaten per opdracht plus alles wat niet aan een opdracht hangt
  //    komen uit op het totaalresultaat.
  const viaOpdrachten =
    som(resultaat.opdrachten.map((opdracht) => opdracht.overNaVasteLasten)) +
    resultaat.opbrengstOnderlingUit -
    resultaat.kostenOnderlingIn -
    resultaat.kostenOpEntiteit -
    resultaat.nietVerdeeldeVasteLasten +
    resultaat.subsidies;

  vergelijk('Resultaat — opgebouwd vanuit de opdrachtregels', resultaat.resultaat, viaOpdrachten, afwijkingen);

  // 5b. En langs de staat zelf: opbrengst plus subsidies min kosten.
  vergelijk(
    'Resultaat — totale opbrengst plus subsidies min totale kosten',
    resultaat.resultaat,
    resultaat.totaleOpbrengst + resultaat.subsidies - resultaat.totaleKosten,
    afwijkingen
  );

  // 5c. De opbrengst- en kostenregels tellen op tot hun eigen totaal.
  vergelijk(
    'Totale opbrengst — opdrachten plus onderlinge leveringen',
    resultaat.totaleOpbrengst,
    resultaat.opbrengstOpdrachten + resultaat.opbrengstOnderlingUit,
    afwijkingen
  );
  vergelijk(
    'Totale kosten — middelen, inzet, onderling en vaste lasten',
    resultaat.totaleKosten,
    resultaat.kostenMiddelen +
      resultaat.kostenInzet +
      resultaat.kostenOnderlingIn +
      resultaat.vasteLasten,
    afwijkingen
  );

  // 6. Elk bedrag heen en terug door de omrekening levert hetzelfde op.
  const teControleren: Array<{ naam: string; bedrag: number }> = [
    { naam: 'totale opbrengst', bedrag: resultaat.totaleOpbrengst },
    { naam: 'totale kosten', bedrag: resultaat.totaleKosten },
    { naam: 'resultaat', bedrag: resultaat.resultaat },
  ];

  teControleren.forEach(({ naam, bedrag }) => {
    EENHEDEN.forEach((eenheid) => {
      const heenEnTerug = naarMaand(
        vanMaand(bedrag, eenheid, resultaat.aannames),
        eenheid,
        resultaat.aannames
      );
      vergelijk(`Omrekening ${naam} via ${eenheid}`, bedrag, heenEnTerug, afwijkingen);
    });
  });

  return afwijkingen;
}

// ─── Het ketenoverzicht ─────────────────────────────────────────────────────

/**
 * Zet de doorgerekende begrotingen naast elkaar en laat zien wat er onderling
 * geleverd wordt. Die leveringen vallen in de keten tegen elkaar weg: bij de
 * één een opbrengst, bij de ander een even grote kost.
 */
export function berekenKeten(resultaten: BegrotingResultaat[]): KetenResultaat {
  const naamVan = new Map(resultaten.map((resultaat) => [resultaat.entityId, resultaat.entiteitNaam]));

  const stromen: KetenStroom[] = resultaten.flatMap((resultaat) =>
    resultaat.onderlingUit.map((regel) => ({
      id: regel.id,
      omschrijving: regel.omschrijving,
      vanEntityId: regel.vanEntityId,
      vanNaam: naamVan.get(regel.vanEntityId) ?? 'Onbekende entiteit',
      naarEntityId: regel.naarEntityId,
      naarNaam: naamVan.get(regel.naarEntityId) ?? 'Onbekende entiteit',
      opdrachtId: regel.opdrachtId,
      bedrag: regel.bedrag,
    }))
  );

  const opbrengstBruto = som(resultaten.map((resultaat) => resultaat.totaleOpbrengst));
  const kostenBruto = som(resultaten.map((resultaat) => resultaat.totaleKosten));
  const subsidies = som(resultaten.map((resultaat) => resultaat.subsidies));
  const onderlingTotaal = som(stromen.map((stroom) => stroom.bedrag));

  const opbrengstNetto = opbrengstBruto - onderlingTotaal;
  const kostenNetto = kostenBruto - onderlingTotaal;
  const resultaat = opbrengstNetto + subsidies - kostenNetto;

  // Controle 7: elke uitgaande levering heeft een gelijke inkomende tegenhanger.
  const afwijkingen: Afwijking[] = [];
  const inkomendPerId = new Map<string, LeveringRegel>();
  resultaten.forEach((entiteitResultaat) => {
    entiteitResultaat.onderlingIn.forEach((regel) => inkomendPerId.set(regel.id, regel));
  });

  stromen.forEach((stroom) => {
    const tegenhanger = inkomendPerId.get(stroom.id);
    if (!tegenhanger) {
      afwijkingen.push({
        waar: `Onderlinge levering "${stroom.omschrijving}" (${stroom.vanNaam} → ${stroom.naarNaam}) heeft geen tegenhanger bij de ontvangende entiteit`,
        verwacht: stroom.bedrag,
        gevonden: 0,
        verschil: -stroom.bedrag,
      });
      return;
    }
    vergelijk(
      `Onderlinge levering "${stroom.omschrijving}" — uitgaand en inkomend`,
      stroom.bedrag,
      tegenhanger.bedrag,
      afwijkingen
    );
  });

  // De som van de losse resultaten moet gelijk zijn aan het ketenresultaat:
  // wat er onderling stroomt heft elkaar precies op.
  vergelijk(
    'Ketenresultaat — som van de resultaten per entiteit',
    resultaat,
    som(resultaten.map((entiteitResultaat) => entiteitResultaat.resultaat)),
    afwijkingen
  );

  return {
    entiteiten: resultaten,
    opbrengstBruto,
    onderlingTotaal,
    opbrengstNetto,
    subsidies,
    kostenBruto,
    kostenNetto,
    resultaat,
    resultaatZonderSubsidie: resultaat - subsidies,
    stromen,
    afwijkingen,
  };
}
