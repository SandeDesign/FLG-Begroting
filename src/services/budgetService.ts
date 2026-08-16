// src/services/budgetService.ts
// Alle Firestore-toegang tot de collectie `budgets`. Eén document per begroting,
// met opdrachten, middelen, inzet, subsidies en onderlinge leveringen erin
// genest: één read om te laden, één write om op te slaan.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { schoonVoorFirestore } from '../utils/firestoreSchoon';
import {
  LEGE_SCHAAL,
  MIDDEL_SOORT_KOSTEN,
  STANDAARD_AANNAMES,
  type Aannames,
  type BegrotingStatus,
  type Budget,
  type Eenheid,
  type Inzet,
  type Middel,
  type NieuweBudget,
  type OnderlingeLevering,
  type Opdracht,
  type Schaal,
  type Subsidie,
} from '../types/begroting';

const COLLECTIE = 'budgets';

/**
 * Firestore kan niet queryen op een veld binnen een array van objecten. Zonder
 * dit afgeleide veld zou een ontvangende entiteit de leveringen naar haar toe
 * nooit kunnen vinden. De array onderlingeLeveringen blijft de bron van waarheid.
 */
function afgeleideOntvangers(leveringen: OnderlingeLevering[]): string[] {
  return Array.from(new Set(leveringen.map((levering) => levering.naarEntityId)));
}

/** Vult ontbrekende aannames aan, zodat oudere documenten blijven werken. */
function naarAannames(ruw: unknown): Aannames {
  const data = (ruw ?? {}) as Partial<Aannames>;
  return {
    ...STANDAARD_AANNAMES,
    ...data,
    handmatigeVerdeling: data.handmatigeVerdeling ?? {},
  };
}

/**
 * Vult velden aan die later aan het model zijn toegevoegd, zodat begrotingen die
 * eerder zijn opgeslagen gewoon blijven werken.
 */
function naarOpdrachten(ruw: unknown): Opdracht[] {
  const lijst = (ruw as Opdracht[]) ?? [];
  return lijst.map((opdracht) => ({
    ...opdracht,
    toeslagen: opdracht.toeslagen ?? 0,
    overigeOpbrengst: opdracht.overigeOpbrengst ?? 0,
    extraEenheid: opdracht.extraEenheid ?? 'maand',
    btw: opdracht.btw ?? 'hoog',
  }));
}

/**
 * Vult het BTW-tarief en de soort aan op middelen van vóór die velden. Tot dan
 * was elk middel een voertuig, dus dat is de juiste terugval.
 *
 * En het belangrijkste: kostenposten die bij de soort niet bestaan worden hier
 * op nul gezet. Alleen bij een voertuig splitsen we uit naar brandstof,
 * verzekering, wegenbelasting en onderhoud; staat er bij een laptop nog een oud
 * bedrag in zo'n veld, dan zou dat meetellen zonder dat je het ergens ziet
 * staan. Dat mag een begroting nooit doen.
 */
function naarMiddelen(ruw: unknown): Middel[] {
  const lijst = (ruw as Middel[]) ?? [];

  return lijst.map((middel) => {
    const soort = middel.soort ?? 'voertuig';
    const posten = MIDDEL_SOORT_KOSTEN[soort] ?? MIDDEL_SOORT_KOSTEN.voertuig;

    return {
      ...middel,
      btw: middel.btw ?? 'hoog',
      soort,
      brandstof: posten.brandstof ? middel.brandstof : 0,
      verzekering: posten.verzekering ? middel.verzekering : 0,
      wegenbelasting: posten.wegenbelasting ? middel.wegenbelasting : 0,
      onderhoud: posten.onderhoud ? middel.onderhoud : 0,
      onderhoudBerekenen: posten.kilometers ? middel.onderhoudBerekenen : false,
    };
  });
}

/** Idem voor de ZZP-inzet; over loon zit geen BTW. */
function naarInzet(ruw: unknown): Inzet[] {
  const lijst = (ruw as Inzet[]) ?? [];
  return lijst.map((item) =>
    item.model.soort === 'loondienst'
      ? item
      : { ...item, model: { ...item.model, btw: item.model.btw ?? 'hoog' } }
  );
}

/** Vult de schaal aan voor begrotingen die van vóór deze functie stammen. */
function naarSchaal(ruw: unknown): Schaal {
  const data = (ruw ?? {}) as Partial<Schaal>;
  return {
    ...LEGE_SCHAAL,
    ...data,
    standaardMiddel: { ...LEGE_SCHAAL.standaardMiddel, ...(data.standaardMiddel ?? {}) },
    standaardMedewerker: {
      ...LEGE_SCHAAL.standaardMedewerker,
      ...(data.standaardMedewerker ?? {}),
    },
  };
}

/** Vult het BTW-tarief aan voor leveringen die van vóór dat veld stammen. */
function naarLeveringen(ruw: unknown): OnderlingeLevering[] {
  const lijst = (ruw as OnderlingeLevering[]) ?? [];
  return lijst.map((levering) => ({ ...levering, btw: levering.btw ?? 'hoog' }));
}

function naarBudget(id: string, data: Record<string, unknown>): Budget {
  const leveringen = naarLeveringen(data.onderlingeLeveringen);

  return {
    id,
    entityId: (data.entityId as string) ?? '',
    naam: (data.naam as string) ?? '',
    periodeVan: (data.periodeVan as string) ?? '',
    periodeTot: (data.periodeTot as string) ?? '',
    status: (data.status as BegrotingStatus) ?? 'concept',
    scenarioVan: (data.scenarioVan as string | null) ?? null,
    weergaveEenheid: (data.weergaveEenheid as Eenheid) ?? 'maand',
    aannames: naarAannames(data.aannames),
    schaal: naarSchaal(data.schaal),
    opdrachten: naarOpdrachten(data.opdrachten),
    middelen: naarMiddelen(data.middelen),
    inzet: naarInzet(data.inzet),
    subsidies: (data.subsidies as Subsidie[]) ?? [],
    onderlingeLeveringen: leveringen,
    leveringNaarEntityIds:
      (data.leveringNaarEntityIds as string[]) ?? afgeleideOntvangers(leveringen),
    createdAt: data.createdAt as Budget['createdAt'],
    updatedAt: data.updatedAt as Budget['updatedAt'],
    createdBy: (data.createdBy as string) ?? '',
  };
}

/** Alle begrotingen, nieuwste bovenaan. */
export async function haalBegrotingen(): Promise<Budget[]> {
  const snapshot = await getDocs(query(collection(db, COLLECTIE), orderBy('naam', 'asc')));
  return snapshot.docs.map((d) => naarBudget(d.id, d.data()));
}

/**
 * Blijft alle begrotingen volgen. De eerste melding komt uit de schijfcache en
 * is er dus meteen; daarna volgt de server. Zo hoeft geen enkele pagina bij het
 * openen nog op een netwerkronde te wachten.
 *
 * Geeft de opzegfunctie terug — altijd aanroepen bij het opruimen.
 */
export function volgBegrotingen(
  bij: (begrotingen: Budget[]) => void,
  bijFout: (fout: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, COLLECTIE), orderBy('naam', 'asc')),
    (snapshot) => bij(snapshot.docs.map((d) => naarBudget(d.id, d.data()))),
    bijFout
  );
}

/** De begrotingen van één entiteit. */
export async function haalBegrotingenVoorEntiteit(entityId: string): Promise<Budget[]> {
  const snapshot = await getDocs(
    query(collection(db, COLLECTIE), where('entityId', '==', entityId))
  );
  return snapshot.docs
    .map((d) => naarBudget(d.id, d.data()))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

/** Eén begroting, of null als hij niet bestaat. */
export async function haalBegroting(budgetId: string): Promise<Budget | null> {
  const snapshot = await getDoc(doc(db, COLLECTIE, budgetId));
  if (!snapshot.exists()) return null;
  return naarBudget(snapshot.id, snapshot.data());
}

/** Maakt een nieuwe begroting aan en geeft het nieuwe id terug. */
export async function maakBegroting(begroting: NieuweBudget): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIE), {
    ...schoonVoorFirestore(begroting),
    leveringNaarEntityIds: afgeleideOntvangers(begroting.onderlingeLeveringen),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Werkt een begroting bij. Raken de onderlinge leveringen de wijziging, dan
 * wordt het afgeleide queryveld meteen opnieuw geschreven.
 */
export async function werkBegrotingBij(
  budgetId: string,
  wijzigingen: Partial<NieuweBudget>
): Promise<void> {
  const afgeleid = wijzigingen.onderlingeLeveringen
    ? { leveringNaarEntityIds: afgeleideOntvangers(wijzigingen.onderlingeLeveringen) }
    : {};

  await updateDoc(doc(db, COLLECTIE, budgetId), {
    ...schoonVoorFirestore(wijzigingen),
    ...afgeleid,
    updatedAt: serverTimestamp(),
  });
}

/** Zet de status op concept, vastgesteld of archief. */
export async function wijzigStatus(budgetId: string, status: BegrotingStatus): Promise<void> {
  await updateDoc(doc(db, COLLECTIE, budgetId), { status, updatedAt: serverTimestamp() });
}

/**
 * Dupliceert een begroting als scenario. Een scenario is simpelweg een kopie —
 * daarom zit alles in één document. Het nieuwe scenario begint altijd als concept.
 */
export async function dupliceerAlsScenario(
  budgetId: string,
  nieuweNaam: string,
  createdBy: string
): Promise<string> {
  const origineel = await haalBegroting(budgetId);
  if (!origineel) {
    throw new Error('De begroting die je wilt dupliceren bestaat niet meer.');
  }

  return maakBegroting({
    entityId: origineel.entityId,
    naam: nieuweNaam,
    periodeVan: origineel.periodeVan,
    periodeTot: origineel.periodeTot,
    status: 'concept',
    scenarioVan: origineel.id,
    weergaveEenheid: origineel.weergaveEenheid,
    aannames: origineel.aannames,
    schaal: origineel.schaal,
    opdrachten: origineel.opdrachten,
    middelen: origineel.middelen,
    inzet: origineel.inzet,
    subsidies: origineel.subsidies,
    onderlingeLeveringen: origineel.onderlingeLeveringen,
    createdBy,
  });
}

export async function verwijderBegroting(budgetId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIE, budgetId));
}

/**
 * Verwijdert alle begrotingen van één entiteit en haalt de onderlinge
 * leveringen naar die entiteit uit de begrotingen die blijven staan.
 *
 * Wordt aangeroepen als een entiteit wordt verwijderd. Zonder dit bleven de
 * begrotingen als wees achter: onzichtbaar in de lijst, want die groepeert op
 * entiteit, maar wél nog aanwezig in de database.
 */
export async function verwijderBegrotingenVanEntiteit(entityId: string): Promise<number> {
  const alle = await haalBegrotingen();

  const vanEntiteit = alle.filter((begroting) => begroting.entityId === entityId);
  await Promise.all(vanEntiteit.map((begroting) => verwijderBegroting(begroting.id)));

  // De leveringen naar of van deze entiteit hebben nu geen tegenpartij meer.
  const teSchonen = alle.filter(
    (begroting) =>
      begroting.entityId !== entityId &&
      begroting.onderlingeLeveringen.some(
        (levering) =>
          levering.naarEntityId === entityId || levering.vanEntityId === entityId
      )
  );

  await Promise.all(
    teSchonen.map((begroting) =>
      werkBegrotingBij(begroting.id, {
        onderlingeLeveringen: begroting.onderlingeLeveringen.filter(
          (levering) =>
            levering.naarEntityId !== entityId && levering.vanEntityId !== entityId
        ),
      })
    )
  );

  return vanEntiteit.length;
}

/**
 * Zoekt begrotingen waarvan de entiteit niet meer bestaat. Die zijn in de lijst
 * onzichtbaar — daar wordt op entiteit gegroepeerd — maar staan wel in de weg.
 */
export function zoekWeesBegrotingen(
  begrotingen: Budget[],
  bestaandeEntityIds: string[]
): Budget[] {
  const bestaat = new Set(bestaandeEntityIds);
  return begrotingen.filter((begroting) => !bestaat.has(begroting.entityId));
}

/** Ruimt in één keer alle begrotingen op waarvan de entiteit weg is. */
export async function verwijderWeesBegrotingen(bestaandeEntityIds: string[]): Promise<number> {
  const wezen = zoekWeesBegrotingen(await haalBegrotingen(), bestaandeEntityIds);
  await Promise.all(wezen.map((begroting) => verwijderBegroting(begroting.id)));
  return wezen.length;
}

/** Wat er allemaal meeverhuist als een opdracht naar een andere entiteit gaat. */
export interface VerplaatsingOverzicht {
  opdracht: string;
  aantalMiddelen: number;
  aantalInzet: number;
  aantalLeveringen: number;
}

/**
 * Verplaatst een opdracht met alles wat eraan hangt naar de begroting van een
 * andere entiteit: de middelen en inzet die bij de opdracht horen, en de
 * onderlinge leveringen die de opdracht betreffen.
 *
 * Bedoeld voor het moment dat een opdracht een eigen entiteit krijgt — zoals
 * Bezorging die van Buddy naar Smart Transport gaat.
 */
export async function verplaatsOpdracht(
  vanBudgetId: string,
  naarBudgetId: string,
  opdrachtId: string
): Promise<VerplaatsingOverzicht> {
  if (vanBudgetId === naarBudgetId) {
    throw new Error('De opdracht staat al in deze begroting.');
  }

  const [bron, doelBegroting] = await Promise.all([
    haalBegroting(vanBudgetId),
    haalBegroting(naarBudgetId),
  ]);

  if (!bron) throw new Error('De begroting waar de opdracht nu in staat, bestaat niet meer.');
  if (!doelBegroting) throw new Error('De begroting waar je naartoe wilt verplaatsen, bestaat niet meer.');

  const opdracht = bron.opdrachten.find((item) => item.id === opdrachtId);
  if (!opdracht) throw new Error('Deze opdracht staat niet in de begroting.');

  const middelen = bron.middelen.filter((middel) => middel.hoortBij === opdrachtId);
  const inzet = bron.inzet.filter((item) => item.hoortBij === opdrachtId);
  const leveringen = bron.onderlingeLeveringen.filter((item) => item.opdrachtId === opdrachtId);

  // De leveringen gaan mee en worden vanaf nu geleverd door de nieuwe entiteit.
  const verhuisdeLeveringen = leveringen.map((levering) => ({
    ...levering,
    vanEntityId: doelBegroting.entityId,
  }));

  await werkBegrotingBij(vanBudgetId, {
    opdrachten: bron.opdrachten.filter((item) => item.id !== opdrachtId),
    middelen: bron.middelen.filter((middel) => middel.hoortBij !== opdrachtId),
    inzet: bron.inzet.filter((item) => item.hoortBij !== opdrachtId),
    onderlingeLeveringen: bron.onderlingeLeveringen.filter(
      (item) => item.opdrachtId !== opdrachtId
    ),
  });

  await werkBegrotingBij(naarBudgetId, {
    opdrachten: [...doelBegroting.opdrachten, opdracht],
    middelen: [...doelBegroting.middelen, ...middelen],
    inzet: [...doelBegroting.inzet, ...inzet],
    onderlingeLeveringen: [...doelBegroting.onderlingeLeveringen, ...verhuisdeLeveringen],
  });

  return {
    opdracht: opdracht.naam,
    aantalMiddelen: middelen.length,
    aantalInzet: inzet.length,
    aantalLeveringen: verhuisdeLeveringen.length,
  };
}
