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
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
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

function naarBudget(id: string, data: Record<string, unknown>): Budget {
  const leveringen = (data.onderlingeLeveringen as OnderlingeLevering[]) ?? [];

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
    opdrachten: (data.opdrachten as Opdracht[]) ?? [],
    middelen: (data.middelen as Middel[]) ?? [],
    inzet: (data.inzet as Inzet[]) ?? [],
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
    ...begroting,
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
    ...wijzigingen,
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
