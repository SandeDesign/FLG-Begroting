import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { outgoingInvoiceService, OutgoingInvoice, CompanyInfo } from '../services/outgoingInvoiceService';

// A4 formaat in punten (jsPDF 'pt' unit)
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
// Renderbreedte van de factuur-HTML (matcht .container max-width van 900px)
const RENDER_WIDTH_PX = 900;

/**
 * Rendert de factuur-HTML in een geïsoleerde offscreen iframe zodat de
 * styling niet lekt naar de rest van de app, en zet het resultaat om naar
 * een canvas via html2canvas.
 */
async function renderInvoiceToCanvas(
  invoice: OutgoingInvoice,
  company: CompanyInfo
): Promise<HTMLCanvasElement> {
  const html = await outgoingInvoiceService.generateInvoiceHTML(invoice, company);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = `${RENDER_WIDTH_PX}px`;
  iframe.style.height = '10px';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Kon iframe-document niet openen');

    doc.open();
    doc.write(html);
    doc.close();

    // Wacht tot fonts/afbeeldingen (logo) geladen zijn
    await new Promise<void>((resolve) => {
      const win = iframe.contentWindow;
      if (win && win.document.readyState === 'complete') {
        resolve();
      } else if (win) {
        win.addEventListener('load', () => resolve(), { once: true });
        // Fallback timeout
        setTimeout(resolve, 1500);
      } else {
        setTimeout(resolve, 500);
      }
    });

    // Wacht op eventuele logo-afbeeldingen
    const images = Array.from(doc.images);
    await Promise.all(
      images.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((res) => {
                img.addEventListener('load', () => res(), { once: true });
                img.addEventListener('error', () => res(), { once: true });
              })
      )
    );

    const target = (doc.querySelector('.container') as HTMLElement) || doc.body;
    // Zorg dat iframe hoog genoeg is voor volledige render
    iframe.style.height = `${target.scrollHeight + 40}px`;

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: RENDER_WIDTH_PX,
    });

    return canvas;
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * Voegt een canvas (één factuur) toe aan een jsPDF-document, met paginering
 * wanneer de factuur langer is dan één A4.
 */
function addCanvasToPdf(pdf: jsPDF, canvas: HTMLCanvasElement, addNewPageFirst: boolean): void {
  const margin = 24; // pt
  const usableWidth = A4_WIDTH_PT - margin * 2;
  const usableHeight = A4_HEIGHT_PT - margin * 2;

  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const ratio = usableWidth / canvas.width;
  const scaledFullHeight = canvas.height * ratio;

  if (scaledFullHeight <= usableHeight) {
    // Past op één pagina
    if (addNewPageFirst) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', margin, margin, usableWidth, scaledFullHeight);
    return;
  }

  // Meerdere pagina's: knip het canvas in verticale segmenten
  const pageHeightPx = usableHeight / ratio;
  let renderedPx = 0;
  let firstSegment = true;

  while (renderedPx < canvas.height) {
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    const ctx = pageCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        renderedPx,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx
      );
    }

    if (addNewPageFirst || !firstSegment) pdf.addPage();
    const sliceData = pageCanvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(sliceData, 'JPEG', margin, margin, usableWidth, sliceHeightPx * ratio);

    renderedPx += sliceHeightPx;
    firstSegment = false;
  }
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Genereert en downloadt een PDF voor één enkele factuur.
 */
export async function downloadInvoicePDF(
  invoice: OutgoingInvoice,
  company: CompanyInfo
): Promise<void> {
  const canvas = await renderInvoiceToCanvas(invoice, company);
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  addCanvasToPdf(pdf, canvas, false);
  pdf.save(`Factuur-${safeFileName(invoice.invoiceNumber)}.pdf`);
}

/**
 * Genereert en downloadt één gecombineerde PDF met alle meegegeven facturen,
 * elke factuur op een eigen pagina. Handig voor migratie/archivering.
 */
export async function downloadAllInvoicesPDF(
  invoices: OutgoingInvoice[],
  company: CompanyInfo,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  if (invoices.length === 0) return;

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });

  // Oudste eerst voor een logische volgorde in het archief
  const ordered = [...invoices].sort(
    (a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime()
  );

  for (let i = 0; i < ordered.length; i++) {
    const canvas = await renderInvoiceToCanvas(ordered[i], company);
    addCanvasToPdf(pdf, canvas, i > 0);
    onProgress?.(i + 1, ordered.length);
  }

  const companyPart = safeFileName(company.name || 'bedrijf');
  pdf.save(`Verkoopfacturen-${companyPart}.pdf`);
}
