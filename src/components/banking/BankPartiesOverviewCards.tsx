import React, { useEffect, useState } from 'react';
import { BookOpen, Users, FileText, Download } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { supplierService } from '../../services/supplierService';
import { grootboekCategoryLabels } from '../../utils/grootboekTemplate';
import { generateGrootboekPDF } from '../../lib/generateGrootboekPDF';
import type { Grootboekrekening, Crediteur, Debiteur } from '../../types/supplier';

interface Props {
  companyId: string;
  companyName: string;
  /** Mag de gebruiker een sjabloon importeren? (niet voor boekhouder) */
  allowImportTemplate?: boolean;
  /** Callback om een template-import te starten — als undefined wordt de knop niet getoond. */
  onImportTemplate?: () => void;
  /** Loading state voor de import-knop */
  importingTemplate?: boolean;
}

/**
 * Drie samenvattings-kaarten:
 * - Rekeningschema  (aantal grootboekrekeningen + top-categorieën + PDF knop)
 * - Crediteuren     (leveranciers / schuldeisers, top 4)
 * - Debiteuren      (klanten / betalers, top 4)
 *
 * Zelf-ladend — hoeft alleen companyId + companyName mee te krijgen.
 */
const BankPartiesOverviewCards: React.FC<Props> = ({
  companyId,
  companyName,
  allowImportTemplate = false,
  onImportTemplate,
  importingTemplate,
}) => {
  const [grootboekrekeningen, setGrootboekrekeningen] = useState<Grootboekrekening[]>([]);
  const [crediteuren, setCrediteuren] = useState<Crediteur[]>([]);
  const [debiteuren, setDebiteuren] = useState<Debiteur[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [gb, cred, deb] = await Promise.all([
          supplierService.getGrootboekrekeningen(companyId),
          supplierService.getCrediteuren(companyId),
          supplierService.getDebiteuren(companyId),
        ]);
        if (!mounted) return;
        setGrootboekrekeningen(gb);
        setCrediteuren(cred);
        setDebiteuren(deb);
      } catch (err) {
        console.error('[BankPartiesOverviewCards] load error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [companyId]);

  if (loading && grootboekrekeningen.length === 0 && crediteuren.length === 0 && debiteuren.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Rekeningschema */}
      <Card>
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center min-w-0">
              <BookOpen className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">Rekeningschema</span>
            </h3>
            <div className="flex items-center gap-1 flex-wrap">
              {grootboekrekeningen.length > 0 && (
                <Button
                  onClick={() => generateGrootboekPDF(grootboekrekeningen, companyName)}
                  variant="outline"
                  className="text-xs px-2 py-1"
                  title="Download PDF voor boekhouder"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  PDF
                </Button>
              )}
              {allowImportTemplate && onImportTemplate && (
                <Button
                  onClick={onImportTemplate}
                  disabled={!!importingTemplate}
                  variant="outline"
                  className="text-xs px-2 py-1"
                >
                  {importingTemplate ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <Download className="w-3 h-3 mr-1" />
                      <span className="hidden sm:inline">Importeer sjabloon</span>
                      <span className="sm:hidden">Sjabloon</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {grootboekrekeningen.length}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            grootboekrekeningen
          </p>
          {grootboekrekeningen.length > 0 && (
            <div className="mt-2 space-y-1">
              {Object.entries(
                grootboekrekeningen.reduce((acc, gb) => {
                  acc[gb.category] = (acc[gb.category] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).slice(0, 4).map(([cat, count]) => (
                <div key={cat} className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                  <span>{grootboekCategoryLabels[cat as keyof typeof grootboekCategoryLabels] || cat}</span>
                  <span>{count}</span>
                </div>
              ))}
              {Object.keys(
                grootboekrekeningen.reduce((acc, gb) => {
                  acc[gb.category] = true;
                  return acc;
                }, {} as Record<string, boolean>)
              ).length > 4 && (
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  + meer categorien...
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Crediteuren */}
      <Card>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center mb-3">
            <Users className="w-4 h-4 mr-2 text-red-500" />
            Crediteuren
          </h3>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {crediteuren.length}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            leveranciers / schuldeisers
          </p>
          {crediteuren.length > 0 && (
            <div className="mt-2 space-y-1">
              {crediteuren.slice(0, 4).map((c) => (
                <div key={c.id} className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-300 truncate mr-2">
                    {c.code} - {c.name}
                  </span>
                  <span className="text-red-600 whitespace-nowrap">
                    {c.transactionCount}x
                  </span>
                </div>
              ))}
              {crediteuren.length > 4 && (
                <div className="text-xs text-gray-500">+ {crediteuren.length - 4} meer...</div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Debiteuren */}
      <Card>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center mb-3">
            <Users className="w-4 h-4 mr-2 text-green-500" />
            Debiteuren
          </h3>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {debiteuren.length}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            klanten / betalers
          </p>
          {debiteuren.length > 0 && (
            <div className="mt-2 space-y-1">
              {debiteuren.slice(0, 4).map((d) => (
                <div key={d.id} className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-300 truncate mr-2">
                    {d.code} - {d.name}
                  </span>
                  <span className="text-green-600 whitespace-nowrap">
                    {d.transactionCount}x
                  </span>
                </div>
              ))}
              {debiteuren.length > 4 && (
                <div className="text-xs text-gray-500">+ {debiteuren.length - 4} meer...</div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default BankPartiesOverviewCards;
