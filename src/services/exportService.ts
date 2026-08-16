// src/services/exportService.ts
// Een begroting of het ketenoverzicht naar CSV en PDF.
//
// CSV wordt geschreven in het formaat dat Excel in het Nederlands verwacht:
// puntkomma als scheidingsteken en een komma als decimaalteken. Daarom een
// eigen writer en geen bibliotheek.

import { jsPDF } from 'jspdf';
import type {
  BegrotingResultaat,
  Eenheid,
  KetenResultaat,
} from '../types/begroting';
import { EENHEID_LABEL } from '../types/begroting';
import { vanMaand } from '../utils/periode';

/** Eén regel in een export: een omschrijving met een bedrag. */
interface ExportRegel {
  omschrijving: string;
  bedrag: number | null;
  /** Vetgedrukt in de PDF, voor totaalregels. */
  nadruk?: boolean;
}

// ─── Hulpjes ────────────────────────────────────────────────────────────────

/** Getal met komma als decimaalteken, zonder duizendtalscheiding. */
function csvGetal(waarde: number): string {
  return waarde.toFixed(2).replace('.', ',');
}

/** Zet aanhalingstekens om een veld en verdubbelt die erbinnen. */
function csvVeld(tekst: string): string {
  return `"${tekst.replace(/"/g, '""')}"`;
}

function csvRegel(velden: string[]): string {
  return velden.map(csvVeld).join(';');
}

/** Start een download in de browser. */
function download(inhoud: Blob, bestandsnaam: string): void {
  const url = URL.createObjectURL(inhoud);
  const link = document.createElement('a');
  link.href = url;
  link.download = bestandsnaam;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Maakt een bestandsnaam zonder tekens die problemen geven. */
function veiligeNaam(tekst: string): string {
  return tekst
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function euro(bedrag: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(bedrag) ? bedrag : 0);
}

// ─── De regels van een begroting ────────────────────────────────────────────

/**
 * Bouwt de resultatenstaat op als losse regels, omgerekend naar de gevraagde
 * eenheid. Zowel de CSV als de PDF gebruiken dezelfde opbouw, zodat ze nooit
 * uit elkaar kunnen lopen.
 */
function begrotingsregels(resultaat: BegrotingResultaat, eenheid: Eenheid): ExportRegel[] {
  const om = (bedrag: number) => vanMaand(bedrag, eenheid, resultaat.aannames);

  const regels: ExportRegel[] = [
    { omschrijving: 'Opbrengsten uit opdrachten', bedrag: om(resultaat.opbrengstOpdrachten) },
    {
      omschrijving: 'Opbrengst onderlinge leveringen (uitgaand)',
      bedrag: om(resultaat.opbrengstOnderlingUit),
    },
    { omschrijving: 'Totale opbrengst', bedrag: om(resultaat.totaleOpbrengst), nadruk: true },
    { omschrijving: 'Subsidies', bedrag: om(resultaat.subsidies) },
    { omschrijving: 'Directe kosten — middelen', bedrag: om(resultaat.kostenMiddelen) },
    { omschrijving: 'Directe kosten — inzet', bedrag: om(resultaat.kostenInzet) },
    {
      omschrijving: 'Kosten onderlinge leveringen (inkomend)',
      bedrag: om(resultaat.kostenOnderlingIn),
    },
    { omschrijving: 'Vaste lasten', bedrag: om(resultaat.vasteLasten) },
    { omschrijving: 'Totale kosten', bedrag: om(resultaat.totaleKosten), nadruk: true },
    { omschrijving: 'Resultaat', bedrag: om(resultaat.resultaat), nadruk: true },
    { omschrijving: 'Resultaat zonder subsidie', bedrag: om(resultaat.resultaatZonderSubsidie) },
  ];

  if (resultaat.opdrachten.length > 0) {
    regels.push({ omschrijving: '', bedrag: null });
    regels.push({ omschrijving: 'Per opdracht', bedrag: null, nadruk: true });

    resultaat.opdrachten.forEach((opdracht) => {
      regels.push({
        omschrijving: `${opdracht.naam} (voor ${opdracht.voorWie}) — opbrengst`,
        bedrag: om(opdracht.opbrengst),
      });
      regels.push({
        omschrijving: `${opdracht.naam} — directe kosten`,
        bedrag: om(opdracht.directeKosten),
      });
      regels.push({
        omschrijving: `${opdracht.naam} — over vóór vaste lasten`,
        bedrag: om(opdracht.overVoorVasteLasten),
      });
      regels.push({
        omschrijving: `${opdracht.naam} — aandeel vaste lasten`,
        bedrag: om(opdracht.aandeelVasteLasten),
      });
      regels.push({
        omschrijving: `${opdracht.naam} — over ná vaste lasten`,
        bedrag: om(opdracht.overNaVasteLasten),
        nadruk: true,
      });
    });
  }

  return regels;
}

// ─── CSV ────────────────────────────────────────────────────────────────────

export function exporteerBegrotingCSV(resultaat: BegrotingResultaat, eenheid: Eenheid): void {
  const regels: string[] = [
    csvRegel([`Begroting ${resultaat.budgetNaam}`, '']),
    csvRegel(['Entiteit', resultaat.entiteitNaam]),
    csvRegel(['Weergave', EENHEID_LABEL[eenheid]]),
    '',
    csvRegel(['Omschrijving', `Bedrag ${EENHEID_LABEL[eenheid]}`]),
  ];

  begrotingsregels(resultaat, eenheid).forEach((regel) => {
    if (regel.bedrag === null && regel.omschrijving === '') {
      regels.push('');
      return;
    }
    regels.push(
      csvRegel([regel.omschrijving, regel.bedrag === null ? '' : csvGetal(regel.bedrag)])
    );
  });

  // Een BOM zorgt dat Excel het bestand als UTF-8 opent en accenten goed toont.
  const blob = new Blob([`\uFEFF${regels.join('\r\n')}\r\n`], {
    type: 'text/csv;charset=utf-8;',
  });
  download(blob, `begroting-${veiligeNaam(resultaat.budgetNaam)}.csv`);
}

export function exporteerKetenCSV(keten: KetenResultaat, eenheid: Eenheid): void {
  const aannames = keten.entiteiten[0]?.aannames;
  const om = (bedrag: number) => (aannames ? vanMaand(bedrag, eenheid, aannames) : bedrag);

  const regels: string[] = [
    csvRegel(['Ketenoverzicht', '']),
    csvRegel(['Weergave', EENHEID_LABEL[eenheid]]),
    '',
    csvRegel([
      'Entiteit',
      'Totale opbrengst',
      'Subsidies',
      'Totale kosten',
      'Resultaat',
      'Resultaat zonder subsidie',
    ]),
  ];

  keten.entiteiten.forEach((resultaat) => {
    regels.push(
      csvRegel([
        resultaat.entiteitNaam,
        csvGetal(om(resultaat.totaleOpbrengst)),
        csvGetal(om(resultaat.subsidies)),
        csvGetal(om(resultaat.totaleKosten)),
        csvGetal(om(resultaat.resultaat)),
        csvGetal(om(resultaat.resultaatZonderSubsidie)),
      ])
    );
  });

  regels.push('');
  regels.push(csvRegel(['Onderlinge leveringen', '']));
  regels.push(csvRegel(['Omschrijving', 'Van', 'Naar', 'Bedrag']));

  keten.stromen.forEach((stroom) => {
    regels.push(
      csvRegel([stroom.omschrijving, stroom.vanNaam, stroom.naarNaam, csvGetal(om(stroom.bedrag))])
    );
  });

  regels.push('');
  regels.push(csvRegel(['Opbrengst van alle entiteiten samen', csvGetal(om(keten.opbrengstBruto))]));
  regels.push(
    csvRegel(['Onderling — valt tegen elkaar weg', csvGetal(om(-keten.onderlingTotaal))])
  );
  regels.push(csvRegel(['Opbrengst naar buiten toe', csvGetal(om(keten.opbrengstNetto))]));
  regels.push(csvRegel(['Subsidies', csvGetal(om(keten.subsidies))]));
  regels.push(csvRegel(['Kosten naar buiten toe', csvGetal(om(keten.kostenNetto))]));
  regels.push(csvRegel(['Resultaat', csvGetal(om(keten.resultaat))]));

  const blob = new Blob([`\uFEFF${regels.join('\r\n')}\r\n`], {
    type: 'text/csv;charset=utf-8;',
  });
  download(blob, 'ketenoverzicht.csv');
}

// ─── PDF ────────────────────────────────────────────────────────────────────

const MARGE = 18;
const REGELHOOGTE = 6;
const PAGINAHOOGTE = 297;

/** Begint een nieuwe pagina zodra de onderkant in zicht komt. */
function nieuweRegel(pdf: jsPDF, y: number): number {
  if (y > PAGINAHOOGTE - MARGE) {
    pdf.addPage();
    return MARGE;
  }
  return y;
}

export function exporteerBegrotingPDF(resultaat: BegrotingResultaat, eenheid: Eenheid): void {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const rechts = 210 - MARGE;
  let y = MARGE;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(resultaat.budgetNaam, MARGE, y);

  y += 7;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(110);
  pdf.text(`${resultaat.entiteitNaam} · bedragen ${EENHEID_LABEL[eenheid]}`, MARGE, y);

  y += 8;
  pdf.setDrawColor(205, 133, 63);
  pdf.setLineWidth(0.6);
  pdf.line(MARGE, y, rechts, y);
  y += 7;

  pdf.setTextColor(30);
  pdf.setFontSize(10);

  begrotingsregels(resultaat, eenheid).forEach((regel) => {
    y = nieuweRegel(pdf, y);

    if (regel.bedrag === null && regel.omschrijving === '') {
      y += REGELHOOGTE / 2;
      return;
    }

    pdf.setFont('helvetica', regel.nadruk ? 'bold' : 'normal');
    pdf.text(regel.omschrijving, MARGE, y);

    if (regel.bedrag !== null) {
      pdf.text(euro(regel.bedrag), rechts, y, { align: 'right' });
    }

    y += REGELHOOGTE;
  });

  if (resultaat.waarschuwingen.length > 0) {
    y = nieuweRegel(pdf, y + 4);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(180, 80, 20);
    pdf.text('Let op', MARGE, y);
    y += REGELHOOGTE;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    resultaat.waarschuwingen.forEach((waarschuwing) => {
      pdf.splitTextToSize(`• ${waarschuwing}`, rechts - MARGE).forEach((tekstregel: string) => {
        y = nieuweRegel(pdf, y);
        pdf.text(tekstregel, MARGE, y);
        y += REGELHOOGTE - 1;
      });
    });
  }

  pdf.save(`begroting-${veiligeNaam(resultaat.budgetNaam)}.pdf`);
}

export function exporteerKetenPDF(keten: KetenResultaat, eenheid: Eenheid): void {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const rechts = 297 - MARGE;
  const aannames = keten.entiteiten[0]?.aannames;
  const om = (bedrag: number) => (aannames ? vanMaand(bedrag, eenheid, aannames) : bedrag);
  let y = MARGE;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('Ketenoverzicht', MARGE, y);

  y += 7;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(110);
  pdf.text(`Bedragen ${EENHEID_LABEL[eenheid]}`, MARGE, y);

  y += 8;
  pdf.setDrawColor(205, 133, 63);
  pdf.setLineWidth(0.6);
  pdf.line(MARGE, y, rechts, y);
  y += 8;

  pdf.setTextColor(30);
  const kolommen = [MARGE, 110, 155, 200, 245];

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  ['Entiteit', 'Opbrengst', 'Subsidies', 'Kosten', 'Resultaat'].forEach((kop, index) => {
    pdf.text(kop, kolommen[index], y, index === 0 ? undefined : { align: 'right' });
  });
  y += REGELHOOGTE;

  pdf.setFont('helvetica', 'normal');
  keten.entiteiten.forEach((resultaat) => {
    pdf.text(resultaat.entiteitNaam, kolommen[0], y);
    pdf.text(euro(om(resultaat.totaleOpbrengst)), kolommen[1], y, { align: 'right' });
    pdf.text(euro(om(resultaat.subsidies)), kolommen[2], y, { align: 'right' });
    pdf.text(euro(om(resultaat.totaleKosten)), kolommen[3], y, { align: 'right' });
    pdf.text(euro(om(resultaat.resultaat)), kolommen[4], y, { align: 'right' });
    y += REGELHOOGTE;
  });

  y += 4;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Onderling — valt tegen elkaar weg', kolommen[0], y);
  pdf.text(euro(om(keten.onderlingTotaal)), kolommen[4], y, { align: 'right' });
  y += REGELHOOGTE;

  pdf.text('Resultaat van de keten', kolommen[0], y);
  pdf.text(euro(om(keten.resultaat)), kolommen[4], y, { align: 'right' });

  pdf.save('ketenoverzicht.pdf');
}
