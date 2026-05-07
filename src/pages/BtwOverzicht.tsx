import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Download,
  Shield,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { usePageTitle } from '../contexts/PageTitleContext';
import PeriodSelector from '../components/ui/PeriodSelector';
import { bankImportService } from '../services/bankImportService';
import { supplierService } from '../services/supplierService';
import { outgoingInvoiceService, OutgoingInvoice } from '../services/outgoingInvoiceService';
import { incomingInvoiceService, IncomingInvoice } from '../services/incomingInvoiceService';
import { dagboekExportService, ExportFormat } from '../services/dagboekExportService';
import { generateBtwPDF } from '../lib/generateBtwPDF';
import { BankTransaction } from '../types/bankImport';
import { Grootboekrekening } from '../types/supplier';
import { getQuarterDateRange } from '../utils/dateFilters';
import { format as formatDate } from 'date-fns';

type ExportChoice = ExportFormat | 'pdf';

interface BtwRegel {
  code: string;
  naam: string;
  btwType: string;
  btwPercentage: number;
  inNetto: number;
  inBtw: number;
  inBruto: number;
  uitNetto: number;
  uitBtw: number;
  uitBruto: number;
  count: number;
}

const BTW_PERCENTAGES: Record<string, number> = {
  hoog: 21,
  laag: 9,
  geen: 0,
  verlegd: 0,
};

const fmt = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);

function toDate(d: Date | number): Date {
  return d instanceof Date ? d : new Date(d);
}

function isValid(d: Date): boolean {
  return !isNaN(d.getTime());
}

function safeFmt(d: Date): string {
  return isValid(d) ? formatDate(d, 'dd-MM-yyyy') : 'Onbekend';
}

function sortByDate(a: BankTransaction, b: BankTransaction): number {
  const da = toDate(a.date);
  const db = toDate(b.date);
  if (!isValid(da) && !isValid(db)) return 0;
  if (!isValid(da)) return 1;
  if (!isValid(db)) return -1;
  return da.getTime() - db.getTime();
}

const BtwOverzicht: React.FC = () => {
  const { userRole, user } = useAuth();
  const { selectedCompany, selectedYear, selectedQuarter, queryUserId } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('BTW Overzicht');

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [grootboekrekeningen, setGrootboekrekeningen] = useState<Grootboekrekening[]>([]);
  const [outgoingInvoices, setOutgoingInvoices] = useState<OutgoingInvoice[]>([]);
  const [incomingInvoices, setIncomingInvoices] = useState<IncomingInvoice[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportChoice>('csv');

  const loadData = useCallback(async () => {
    if (!selectedCompany || !user) return;
    // Prioriteit: queryUserId (manager/boekhouder) > company.userId (boekhouder fallback) > user.uid (admin)
    const effectiveUserId = queryUserId || selectedCompany.userId || user.uid;
    try {
      setLoading(true);
      const [confirmed, gb, outInv, inInv] = await Promise.all([
        bankImportService.getTransactionsByStatus(selectedCompany.id, 'confirmed'),
        supplierService.getGrootboekrekeningen(selectedCompany.id),
        outgoingInvoiceService.getInvoices(effectiveUserId, selectedCompany.id),
        incomingInvoiceService.getInvoices(effectiveUserId, selectedCompany.id),
      ]);
      setTransactions(confirmed);
      setGrootboekrekeningen(gb);
      setOutgoingInvoices(outInv);
      setIncomingInvoices(inInv);
    } catch (e) {
      console.error('Error loading BTW data:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, user, queryUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (userRole !== 'admin' && userRole !== 'co-admin' && userRole !== 'boekhouder') {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState icon={Shield} title="Geen toegang" description="Alleen administrators en boekhouders kunnen het BTW overzicht bekijken" />
      </div>
    );
  }

  if (!selectedCompany) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState icon={Receipt} title="Geen bedrijf geselecteerd" description="Selecteer eerst een bedrijf" />
      </div>
    );
  }

  const { start, end } = getQuarterDateRange(selectedYear, selectedQuarter);
  const gbMap = new Map(grootboekrekeningen.map((g) => [g.code, g]));
  const outInvMap = new Map(outgoingInvoices.map((i) => [i.id || '', i]));
  const inInvMap = new Map(incomingInvoices.map((i) => [i.id || '', i]));

  const periodTransactions = transactions.filter((t) => {
    const d = toDate(t.date);
    if (!isValid(d)) return true;
    return d >= start && d <= end;
  });

  // --- Resolve BTW bron per transactie: factuur > grootboek ---
  // Als transactie gekoppeld is aan factuur → gebruik vatAmount van de factuur
  // (proportioneel voor deelbetalingen). Anders fallback naar grootboek BTW tarief.
  const deriveBtw = (t: BankTransaction): { netto: number; btw: number; effPct: number; source: 'invoice' | 'grootboek' | 'none' } => {
    const abs = Math.abs(t.amount);
    if (t.matchedInvoiceId) {
      const inv = t.matchedInvoiceType === 'outgoing'
        ? outInvMap.get(t.matchedInvoiceId)
        : inInvMap.get(t.matchedInvoiceId);
      if (inv) {
        const total = Number(inv.totalAmount);
        let vat = Number(inv.vatAmount);
        let net = Number(inv.amount);
        if (!isFinite(vat)) vat = 0;
        if (!isFinite(net) && isFinite(total)) net = total - vat;
        if (isFinite(total) && total > 0 && isFinite(net) && isFinite(vat)) {
          const ratio = abs / total;
          const netto = net * ratio;
          const btw = vat * ratio;
          const effPct = net > 0 ? Math.round((vat / net) * 100) : 0;
          return { netto, btw, effPct, source: 'invoice' };
        }
      }
    }
    const gb = t.grootboekrekening ? gbMap.get(t.grootboekrekening) : undefined;
    const btwType = gb?.btw || 'geen';
    const pct = BTW_PERCENTAGES[btwType] ?? 0;
    const netto = pct > 0 ? abs / (1 + pct / 100) : abs;
    const btw = abs - netto;
    return { netto, btw, effPct: pct, source: gb ? 'grootboek' : 'none' };
  };

  // --- Build BTW regels (single source of truth) ---
  const regelMap = new Map<string, BtwRegel>();
  const btwRegels: BtwRegel[] = [];

  for (const t of periodTransactions) {
    const gbCode = t.grootboekrekening;
    const isIn = t.amount >= 0;
    const abs = Math.abs(t.amount);
    const { netto, btw } = deriveBtw(t);

    let key: string;
    let code: string;
    let naam: string;
    let btwType: string;
    let pct: number;

    if (gbCode) {
      const gb = gbMap.get(gbCode);
      btwType = gb?.btw || 'geen';
      pct = BTW_PERCENTAGES[btwType] ?? 0;
      key = gbCode;
      code = gbCode;
      naam = gb?.name || gbCode;
    } else {
      btwType = '?';
      pct = 0;
      key = isIn ? '_zonder_in' : '_zonder_uit';
      code = '—';
      naam = isIn ? 'Zonder grootboek (inkomend)' : 'Zonder grootboek (uitgaand)';
    }

    let regel = regelMap.get(key);
    if (!regel) {
      regel = {
        code,
        naam,
        btwType,
        btwPercentage: pct,
        inNetto: 0,
        inBtw: 0,
        inBruto: 0,
        uitNetto: 0,
        uitBtw: 0,
        uitBruto: 0,
        count: 0,
      };
      regelMap.set(key, regel);
      btwRegels.push(regel);
    }

    if (isIn) {
      regel.inBruto += abs;
      regel.inNetto += netto;
      regel.inBtw += btw;
    } else {
      regel.uitBruto += abs;
      regel.uitNetto += netto;
      regel.uitBtw += btw;
    }
    regel.count++;
  }

  // --- All totals derived from single source ---
  const totaalAfdracht = btwRegels.reduce((s, r) => s + r.inBtw, 0);
  const totaalVoorbelasting = btwRegels.reduce((s, r) => s + r.uitBtw, 0);
  const saldo = totaalAfdracht - totaalVoorbelasting;

  const totaalIn = periodTransactions
    .filter((t) => t.amount >= 0)
    .reduce((s, t) => s + t.amount, 0);
  const totaalUit = periodTransactions
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const zonderGb = periodTransactions.filter((t) => !t.grootboekrekening).length;
  const zonderGbIn = periodTransactions
    .filter((t) => !t.grootboekrekening && t.amount >= 0)
    .reduce((s, t) => s + t.amount, 0);
  const zonderGbUit = periodTransactions
    .filter((t) => !t.grootboekrekening && t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const netNetto = (r: BtwRegel) => r.inNetto - r.uitNetto;
  const netBtw = (r: BtwRegel) => r.inBtw - r.uitBtw;
  const netBruto = (r: BtwRegel) => r.inBruto - r.uitBruto;

  const sortedRegels = [...btwRegels].sort((a, b) => a.code.localeCompare(b.code));

  const handleExportDagboek = async () => {
    if (!selectedCompany) return;
    try {
      setExporting(true);

      if (exportFormat === 'pdf') {
        generateBtwPDF(
          periodTransactions,
          grootboekrekeningen,
          outgoingInvoices,
          incomingInvoices,
          selectedCompany.name,
          selectedYear,
          selectedQuarter
        );
        success('PDF gegenereerd', 'BTW overzicht PDF gedownload');
        return;
      }

      const regels = await dagboekExportService.buildDagboekRegels(
        selectedCompany.id,
        periodTransactions,
        grootboekrekeningen
      );
      const csv = dagboekExportService.generateCSV(regels, exportFormat);
      const periodLabel = selectedQuarter ? `Q${selectedQuarter}` : 'jaar';
      dagboekExportService.downloadCSV(
        csv,
        `Dagboek_${selectedCompany.name}_${selectedYear}_${periodLabel}.csv`
      );
      success('Geëxporteerd', `Dagboek export (${exportFormat}) gedownload`);
    } catch (e: any) {
      showError('Fout', e.message || 'Kon export niet genereren');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">BTW Overzicht</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          BTW aangifte overzicht op basis van geboekte transacties
        </p>
      </div>

      <PeriodSelector />

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {zonderGb > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {zonderGb} van {periodTransactions.length} zonder grootboekrekening
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    {fmt(zonderGbIn)} in / {fmt(zonderGbUit)} uit — BTW kan niet berekend worden
                  </p>
                </div>
              </div>
              <span className="inline-flex self-start items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 flex-shrink-0">
                {periodTransactions.length > 0
                  ? Math.round(
                      ((periodTransactions.length - zonderGb) / periodTransactions.length) * 100
                    )
                  : 0}
                %
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <Card>
              <div className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                  <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-200">
                    Af te dragen BTW
                  </h3>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">
                  {fmt(totaalAfdracht)}
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">BTW op verkopen/inkomsten</p>
              </div>
            </Card>
            <Card>
              <div className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-200">
                    Voorbelasting
                  </h3>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                  {fmt(totaalVoorbelasting)}
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">BTW op inkopen/kosten</p>
              </div>
            </Card>
            <Card>
              <div className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                  <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-200">
                    {saldo >= 0 ? 'Te betalen' : 'Terug te ontvangen'}
                  </h3>
                </div>
                <div
                  className={`text-xl sm:text-2xl font-bold ${saldo >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}
                >
                  {fmt(Math.abs(saldo))}
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                  {periodTransactions.length} transacties in periode
                </p>
              </div>
            </Card>
          </div>

          {btwRegels.length > 0 ? (
            <Card>
              <div className="p-3 sm:p-4">
                <h2 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                  Specificatie per grootboekrekening
                </h2>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300">
                        <th className="text-left py-2 px-3">Code</th>
                        <th className="text-left py-2 px-3">Rekening</th>
                        <th className="text-left py-2 px-3">BTW</th>
                        <th className="text-right py-2 px-3">Netto</th>
                        <th className="text-right py-2 px-3">BTW bedrag</th>
                        <th className="text-right py-2 px-3">Bruto</th>
                        <th className="text-right py-2 px-3">#</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRegels.map((r, i) => {
                        const isUncat = r.btwType === '?';
                        const netto = netNetto(r);
                        const btw = netBtw(r);
                        const bruto = netBruto(r);
                        const viaInvoice = r.btwPercentage === 0 && Math.abs(btw) > 0.01;
                        return (
                          <tr
                            key={i}
                            className={`border-b last:border-0 ${isUncat ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' : 'border-gray-50 dark:border-gray-800'}`}
                          >
                            <td
                              className={`py-2 px-3 font-mono font-bold ${isUncat ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}
                            >
                              {r.code}
                            </td>
                            <td
                              className={`py-2 px-3 ${isUncat ? 'text-amber-700 dark:text-amber-300 italic' : 'text-gray-900 dark:text-white'}`}
                            >
                              {r.naam}
                            </td>
                            <td className="py-2 px-3">
                              {isUncat ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                  onbekend
                                </span>
                              ) : viaInvoice ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                  via factuur
                                </span>
                              ) : (
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded ${
                                    r.btwType === 'hoog'
                                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                      : r.btwType === 'laag'
                                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                        : r.btwType === 'verlegd'
                                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  {r.btwType}
                                  {r.btwPercentage > 0 ? ` (${r.btwPercentage}%)` : ''}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                              {fmt(netto)}
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-medium ${isUncat ? 'text-gray-400' : btw > 0 ? 'text-red-600 dark:text-red-400' : btw < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}
                            >
                              {isUncat ? '—' : fmt(btw)}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                              {fmt(bruto)}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-500">{r.count}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-semibold">
                        <td colSpan={3} className="py-2 px-3 text-gray-900 dark:text-white">
                          Totaal
                        </td>
                        <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                          {fmt(btwRegels.reduce((s, r) => s + netNetto(r), 0))}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                          {fmt(btwRegels.reduce((s, r) => s + netBtw(r), 0))}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                          {fmt(btwRegels.reduce((s, r) => s + netBruto(r), 0))}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-500">
                          {btwRegels.reduce((s, r) => s + r.count, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="md:hidden space-y-2">
                  {sortedRegels.map((r, i) => {
                    const isUncat = r.btwType === '?';
                    const netto = netNetto(r);
                    const btw = netBtw(r);
                    const bruto = netBruto(r);
                    const viaInvoice = r.btwPercentage === 0 && Math.abs(btw) > 0.01;
                    return (
                      <div
                        key={i}
                        className={`p-3 rounded-lg ${isUncat ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'bg-gray-50 dark:bg-gray-800/50'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`font-mono text-xs font-bold ${isUncat ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}
                            >
                              {r.code}
                            </span>
                            <span
                              className={`text-xs truncate ${isUncat ? 'text-amber-700 dark:text-amber-300 italic' : 'text-gray-900 dark:text-white'}`}
                            >
                              {r.naam}
                            </span>
                          </div>
                          {isUncat ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              onbekend
                            </span>
                          ) : viaInvoice ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              via factuur
                            </span>
                          ) : (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                                r.btwType === 'hoog'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                  : r.btwType === 'laag'
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                    : r.btwType === 'verlegd'
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {r.btwType}
                              {r.btwPercentage > 0 ? ` ${r.btwPercentage}%` : ''}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500 block">Netto</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {fmt(netto)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">BTW</span>
                            <span
                              className={`font-medium ${isUncat ? 'text-gray-400' : btw > 0 ? 'text-red-600' : btw < 0 ? 'text-green-600' : 'text-gray-400'}`}
                            >
                              {isUncat ? '—' : fmt(btw)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-500 block">Bruto</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {fmt(bruto)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-t-2 border-gray-300 dark:border-gray-500">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white mb-2">
                      Totaal
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                      <div>
                        <span className="text-gray-500 block">Netto</span>
                        <span className="text-gray-900 dark:text-white">
                          {fmt(btwRegels.reduce((s, r) => s + netNetto(r), 0))}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">BTW</span>
                        <span className="text-gray-900 dark:text-white">
                          {fmt(btwRegels.reduce((s, r) => s + netBtw(r), 0))}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 block">Bruto</span>
                        <span className="text-gray-900 dark:text-white">
                          {fmt(btwRegels.reduce((s, r) => s + netBruto(r), 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-6 sm:p-8 text-center">
                <Receipt className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Geen geboekte transacties in deze periode.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Importeer bankafschriften en wijs grootboekrekeningen toe.
                </p>
              </div>
            </Card>
          )}

          {periodTransactions.length > 0 && (
            <Card>
              <div className="p-3 sm:p-4">
                <details>
                  <summary className="cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                    <h2 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">
                      Transacties ({periodTransactions.length})
                    </h2>
                    <div className="flex items-center gap-3 text-xs sm:text-sm">
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 inline mr-0.5" />
                        {fmt(totaalIn)} in
                      </span>
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 inline mr-0.5" />
                        {fmt(totaalUit)} uit
                      </span>
                    </div>
                  </summary>

                  <div className="mt-3 hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-300">
                          <th className="text-left py-2 px-2">Datum</th>
                          <th className="text-left py-2 px-2">Begunstigde</th>
                          <th className="text-left py-2 px-2">Omschrijving</th>
                          <th className="text-left py-2 px-2">Grootboek</th>
                          <th className="text-right py-2 px-2">Bedrag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...periodTransactions].sort(sortByDate).map((t, i) => (
                          <tr
                            key={i}
                            className="border-b border-gray-50 dark:border-gray-800 last:border-0"
                          >
                            <td className="py-1.5 px-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              {safeFmt(toDate(t.date))}
                            </td>
                            <td className="py-1.5 px-2 text-gray-900 dark:text-white truncate max-w-[150px]">
                              {t.beneficiary || '-'}
                            </td>
                            <td className="py-1.5 px-2 text-gray-600 dark:text-gray-300 truncate max-w-[250px]">
                              {t.matchedInvoiceNumber || t.description?.substring(0, 60) || '-'}
                            </td>
                            <td className="py-1.5 px-2">
                              {t.grootboekrekening ? (
                                <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                                  {t.grootboekrekening}
                                </span>
                              ) : (
                                <span className="text-xs text-amber-600 dark:text-amber-400">—</span>
                              )}
                            </td>
                            <td
                              className={`py-1.5 px-2 text-right font-medium whitespace-nowrap ${t.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                            >
                              {t.amount >= 0 ? '+' : ''}
                              {fmt(t.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 sm:hidden space-y-1">
                    {[...periodTransactions].sort(sortByDate).map((t, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-0.5">
                              <span>{safeFmt(toDate(t.date))}</span>
                              {t.grootboekrekening ? (
                                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                                  {t.grootboekrekening}
                                </span>
                              ) : (
                                <span className="text-amber-500">geen GB</span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                              {t.beneficiary || '-'}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate mt-0.5">
                              {t.matchedInvoiceNumber || t.description?.substring(0, 50) || '-'}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-semibold flex-shrink-0 ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {t.amount >= 0 ? '+' : ''}
                            {fmt(t.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </Card>
          )}

          <Card>
            <div className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    Dagboek Export
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">
                    Exporteer voor je boekhoudpakket
                  </p>
                </div>
                <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as ExportChoice)}
                    className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="csv">Algemeen CSV</option>
                    <option value="exact_online">Exact Online</option>
                    <option value="snelstart">SnelStart</option>
                    <option value="twinfield">Twinfield</option>
                    <option value="pdf">PDF overzicht</option>
                  </select>
                  <Button
                    onClick={handleExportDagboek}
                    disabled={exporting || periodTransactions.length === 0}
                    variant="outline"
                    className="flex-shrink-0"
                  >
                    {exporting ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 sm:mr-1" />
                        <span className="hidden sm:inline">Export</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default BtwOverzicht;
