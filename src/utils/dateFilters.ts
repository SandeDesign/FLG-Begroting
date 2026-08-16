// src/utils/dateFilters.ts
// Hulpfuncties voor perioden. Een begroting loopt van "2026-01" tot en met
// "2026-12"; die notatie is overal de standaard.

const MAANDNAMEN = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
];

const MAANDNAMEN_KORT = [
  'jan',
  'feb',
  'mrt',
  'apr',
  'mei',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
];

/** Controleert of een string de vorm "JJJJ-MM" heeft met een geldige maand. */
export function isGeldigePeriode(periode: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode)) return false;
  const jaar = Number.parseInt(periode.slice(0, 4), 10);
  return jaar >= 2020 && jaar <= 2060;
}

/** "2026-01" → { jaar: 2026, maand: 1 } */
export function splitsPeriode(periode: string): { jaar: number; maand: number } {
  const [jaar, maand] = periode.split('-');
  return { jaar: Number.parseInt(jaar, 10), maand: Number.parseInt(maand, 10) };
}

/** { jaar: 2026, maand: 1 } → "2026-01" */
export function bouwPeriode(jaar: number, maand: number): string {
  return `${jaar}-${String(maand).padStart(2, '0')}`;
}

/** "2026-01" → "januari 2026" */
export function periodeLabel(periode: string): string {
  if (!isGeldigePeriode(periode)) return periode;
  const { jaar, maand } = splitsPeriode(periode);
  return `${MAANDNAMEN[maand - 1]} ${jaar}`;
}

/** "2026-01" → "jan 2026" */
export function periodeLabelKort(periode: string): string {
  if (!isGeldigePeriode(periode)) return periode;
  const { jaar, maand } = splitsPeriode(periode);
  return `${MAANDNAMEN_KORT[maand - 1]} ${jaar}`;
}

/** "januari 2026 t/m december 2026" */
export function periodeBereikLabel(van: string, tot: string): string {
  return `${periodeLabel(van)} t/m ${periodeLabel(tot)}`;
}

/** Het aantal maanden in een bereik, inclusief begin- en eindmaand. Minimaal 1. */
export function aantalMaanden(van: string, tot: string): number {
  if (!isGeldigePeriode(van) || !isGeldigePeriode(tot)) return 1;
  const start = splitsPeriode(van);
  const eind = splitsPeriode(tot);
  const maanden = (eind.jaar - start.jaar) * 12 + (eind.maand - start.maand) + 1;
  return maanden > 0 ? maanden : 1;
}

/** Alle perioden in een bereik, van begin tot en met eind. */
export function maandenInBereik(van: string, tot: string): string[] {
  if (!isGeldigePeriode(van) || !isGeldigePeriode(tot)) return [];
  const start = splitsPeriode(van);
  const totaal = aantalMaanden(van, tot);

  return Array.from({ length: totaal }, (_, index) => {
    const maandNummer = start.maand - 1 + index;
    return bouwPeriode(start.jaar + Math.floor(maandNummer / 12), (maandNummer % 12) + 1);
  });
}

/** Valt een begroting binnen het gekozen jaar? Overlap is genoeg. */
export function valtInJaar(van: string, tot: string, jaar: number): boolean {
  if (!isGeldigePeriode(van) || !isGeldigePeriode(tot)) return false;
  return splitsPeriode(van).jaar <= jaar && splitsPeriode(tot).jaar >= jaar;
}

/** De huidige maand als periode, bijvoorbeeld "2026-08". */
export function huidigePeriode(): string {
  const nu = new Date();
  return bouwPeriode(nu.getFullYear(), nu.getMonth() + 1);
}
