// src/utils/periode.ts
// Omrekenen tussen periode-eenheden.
//
// Maand is de interne rekenbasis. Alles wordt bij invoer naar maand omgerekend
// en pas bij weergave weer terug. Zo staat er nooit een optelling van bedragen
// met verschillende eenheden in de rekenmotor.
//
// De omrekening van en naar uur gaat bewust via contracturenPerWeek en niet via
// rijdagen maal uren per dag: een uurloon hoort bij een contract, niet bij het
// aantal dagen dat er gereden wordt.

import type { Aannames, Eenheid } from '../types/begroting';

const WEKEN_PER_JAAR = 52;
const MAANDEN_PER_JAAR = 12;

/**
 * Met hoeveel je een bedrag in `eenheid` moet vermenigvuldigen om op een bedrag
 * per maand uit te komen.
 */
export function maandFactor(eenheid: Eenheid, aannames: Aannames): number {
  switch (eenheid) {
    case 'jaar':
      return 1 / MAANDEN_PER_JAAR;
    case 'maand':
      return 1;
    case 'week':
      return WEKEN_PER_JAAR / MAANDEN_PER_JAAR;
    case 'dag':
      return aannames.dagenPerMaand;
    case 'uur':
      return (aannames.contracturenPerWeek * WEKEN_PER_JAAR) / MAANDEN_PER_JAAR;
  }
}

/** Rekent een bedrag in een willekeurige eenheid om naar een bedrag per maand. */
export function naarMaand(bedrag: number, van: Eenheid, aannames: Aannames): number {
  if (!Number.isFinite(bedrag)) return 0;
  return bedrag * maandFactor(van, aannames);
}

/**
 * Rekent een bedrag per maand terug naar de gevraagde eenheid.
 * Is de factor nul — bijvoorbeeld nul contracturen per week — dan is er niets
 * zinnigs te tonen en komt er 0 uit in plaats van Infinity.
 */
export function vanMaand(bedrag: number, naar: Eenheid, aannames: Aannames): number {
  if (!Number.isFinite(bedrag)) return 0;
  const factor = maandFactor(naar, aannames);
  if (factor === 0) return 0;
  return bedrag / factor;
}

/** Rekent rechtstreeks om tussen twee eenheden, met maand als tussenstap. */
export function reken(
  bedrag: number,
  van: Eenheid,
  naar: Eenheid,
  aannames: Aannames
): number {
  return vanMaand(naarMaand(bedrag, van, aannames), naar, aannames);
}

/** Afronden op hele centen, om afrondingsruis in vergelijkingen te voorkomen. */
export function afrondenCent(bedrag: number): number {
  if (!Number.isFinite(bedrag)) return 0;
  return Math.round(bedrag * 100) / 100;
}

/** Bedrag als "€ 1.234,56". */
export function formatEuro(bedrag: number, decimalen = 2): string {
  const veilig = Number.isFinite(bedrag) ? bedrag : 0;
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimalen,
    maximumFractionDigits: decimalen,
  }).format(veilig);
}

/** Getal als "1.234,56", zonder euroteken. */
export function formatGetal(waarde: number, decimalen = 2): string {
  const veilig = Number.isFinite(waarde) ? waarde : 0;
  return new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: decimalen,
    maximumFractionDigits: decimalen,
  }).format(veilig);
}

/** Fractie als percentage: 0,08 wordt "8%". */
export function formatPercentage(fractie: number, decimalen = 0): string {
  const veilig = Number.isFinite(fractie) ? fractie : 0;
  return new Intl.NumberFormat('nl-NL', {
    style: 'percent',
    minimumFractionDigits: decimalen,
    maximumFractionDigits: decimalen,
  }).format(veilig);
}
