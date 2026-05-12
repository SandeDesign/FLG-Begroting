import React, { useState, useEffect } from 'react';
import {
  Upload,
  Zap,
  HardDrive,
  Download,
  CheckCircle,
  ArrowRight,
  RotateCw,
  History,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useToast } from '../../hooks/useToast';
import { uploadAndSaveInvoice, incomingInvoiceService, IncomingInvoice } from '../../services/incomingInvoiceService';
import { processInvoiceFile } from '../../services/ocrService';
import { Company } from '../../types';

interface OCRResult {
  id: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  amount: number;
  vatAmount: number;
  totalAmount: number;
  fileUrl: string;
  confidence: number;
}

interface Props {
  selectedCompany: Company;
}

const InkomendeFacturenTab: React.FC<Props> = ({ selectedCompany }) => {
  const { user } = useAuth();
  const { error: showError } = useToast();
  const navigate = useNavigate();

  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<IncomingInvoice[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<string[]>([]);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [ocrResults, setOcrResults] = useState<OCRResult[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

  useEffect(() => {
    if (selectedCompany?.userId) {
      loadHistory();
    }
  }, [selectedCompany?.id]);

  const loadHistory = async () => {
    if (!selectedCompany?.userId) return;
    setHistoryLoading(true);
    try {
      const invoices = await incomingInvoiceService.getInvoices(selectedCompany.userId, selectedCompany.id);
      setHistory(invoices.slice(0, 20));
    } catch {
      // silently fail — history is non-critical
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length || !selectedCompany || !user) return;

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
        showError('Ongeldig bestandstype', `${file.name}: Alleen PDF en afbeeldingen zijn toegestaan`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        showError('Bestand te groot', `${file.name}: Maximaal 10MB per bestand`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    setTotalFiles(validFiles.length);
    setTotalProcessed(0);
    const results: OCRResult[] = [];

    const PARALLEL_LIMIT = 3;
    const processFile = async (file: File) => {
      setProcessingFiles(prev => [...prev, file.name]);

      try {
        const ocrResult = await processInvoiceFile(file, (progress) => {
          setOcrProgress(Math.round(progress));
        });

        const uploadResult = await uploadAndSaveInvoice(
          file,
          selectedCompany.id,
          selectedCompany.name,
          selectedCompany.userId,
          user.email || undefined,
          {
            supplierName: ocrResult.invoiceData.supplierName,
            invoiceNumber: ocrResult.invoiceData.invoiceNumber,
            amount: ocrResult.invoiceData.subtotal,
            vatAmount: ocrResult.invoiceData.vatAmount,
            totalAmount: ocrResult.invoiceData.totalInclVat,
          },
          {
            ...ocrResult.invoiceData,
            text: ocrResult.text,
            confidence: ocrResult.confidence,
            pages: ocrResult.pages,
          }
        );

        const result: OCRResult = {
          id: uploadResult.invoiceId,
          supplierName: ocrResult.invoiceData.supplierName,
          invoiceNumber: ocrResult.invoiceData.invoiceNumber,
          invoiceDate: ocrResult.invoiceData.invoiceDate,
          amount: ocrResult.invoiceData.subtotal || 0,
          vatAmount: ocrResult.invoiceData.vatAmount || 0,
          totalAmount: ocrResult.invoiceData.totalInclVat || 0,
          fileUrl: uploadResult.fileUrl,
          confidence: ocrResult.confidence,
        };

        results.push(result);
      } catch (ocrError) {
        console.error('OCR error:', ocrError);
        showError('OCR fout', `${file.name}: ${ocrError instanceof Error ? ocrError.message : 'OCR verwerking mislukt'}`);
      } finally {
        setProcessingFiles(prev => prev.filter(f => f !== file.name));
        setTotalProcessed(prev => prev + 1);
      }
    };

    try {
      for (let i = 0; i < validFiles.length; i += PARALLEL_LIMIT) {
        const batch = validFiles.slice(i, i + PARALLEL_LIMIT);
        await Promise.all(batch.map(processFile));
      }

      if (results.length > 0) {
        setOcrResults(prev => [...results, ...prev]);
        setShowSuccessModal(true);
        loadHistory();
      }
    } catch (error) {
      console.error('Upload error:', error);
      showError('Fout bij uploaden', error instanceof Error ? error.message : 'Kon bestanden niet uploaden');
    } finally {
      setUploading(false);
      setProcessingFiles([]);
      setOcrProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <label className="cursor-pointer">
          <Button as="span" icon={Upload} disabled={uploading}>
            {uploading ? 'Uploaden...' : 'Upload Factuur'}
          </Button>
          <input
            type="file"
            multiple
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          />
        </label>
      </div>

      {processingFiles.length > 0 && (
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Zap className="h-5 w-5 text-primary-600 animate-pulse" />
                <h3 className="font-medium text-gray-900 dark:text-gray-100">OCR verwerking bezig...</h3>
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-200">
                {totalProcessed} / {totalFiles} voltooid
              </span>
            </div>
            <div className="space-y-2 mb-3">
              {processingFiles.map((fileName) => (
                <div key={fileName} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                  <LoadingSpinner size="sm" className="mr-2" />
                  <span>{fileName}</span>
                </div>
              ))}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all"
                style={{ width: `${(totalProcessed / totalFiles) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">
              {Math.round((totalProcessed / totalFiles) * 100)}% - Max 3 bestanden tegelijk
            </p>
          </div>
        </Card>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-md w-full">
            <div className="p-6 text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Upload geslaagd!
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {totalProcessed} {totalProcessed === 1 ? 'factuur is' : 'facturen zijn'} succesvol verwerkt met OCR en opgeslagen.
              </p>
              <div className="space-y-3">
                <Button
                  variant="primary"
                  className="w-full"
                  icon={ArrowRight}
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate('/incoming-invoices-stats');
                  }}
                >
                  Ga naar Inkoop
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  icon={RotateCw}
                  onClick={() => {
                    setShowSuccessModal(false);
                    setOcrResults([]);
                    setTotalProcessed(0);
                    setTotalFiles(0);
                  }}
                >
                  Nog meer uploaden
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${ isDragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400' }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <HardDrive className="mx-auto h-12 w-12 text-primary-400" />
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Sleep <strong>meerdere facturen</strong> hierheen of{' '}
          <label className="font-medium text-primary-600 hover:text-primary-500 cursor-pointer">
            selecteer bestanden
            <input
              type="file"
              multiple
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
          </label>
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
          PDF, PNG, JPG tot 10MB - Automatische OCR verwerking
        </p>
        <p className="mt-1 text-xs font-medium text-primary-600">
          ⚡ Parallel verwerking: max 3 bestanden tegelijk voor snelheid
        </p>
      </div>

      {/* Upload history */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <History className="h-4 w-4" />
            Upload geschiedenis
          </h2>
          {history.length > 0 && (
            <button
              onClick={() => navigate('/incoming-invoices-stats')}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              Alle inkoop <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
        {historyLoading ? (
          <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">Nog geen facturen geüpload voor {selectedCompany.name}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 text-left">
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Leverancier</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Factuurnr.</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Datum</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 text-right">Totaal</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 text-center">Status</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {history.map((inv) => (
                  <tr key={inv.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px]">{inv.supplierName || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">{inv.invoiceNumber || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 tabular-nums">{inv.invoiceDate.toLocaleDateString('nl-NL')}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">€ {inv.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        inv.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                        inv.status === 'approved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                        inv.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}>
                        {inv.status === 'paid' ? 'Betaald' : inv.status === 'approved' ? 'Goedgekeurd' : inv.status === 'rejected' ? 'Afgewezen' : 'In behandeling'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inv.fileUrl && (
                        <button onClick={() => window.open(inv.fileUrl, '_blank')} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Bekijk bestand">
                          <Download className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ocrResults.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Verwerkte facturen (deze sessie)</h2>
          {ocrResults.map((result) => (
            <Card key={result.id} className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Leverancier</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{result.supplierName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Factuurnummer</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{result.invoiceNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Factuurdatum</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {result.invoiceDate.toLocaleDateString('nl-NL')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">OCR Betrouwbaarheid</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{result.confidence.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                    <p className="text-xs text-gray-600 dark:text-gray-300">Excl. BTW</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">€{result.amount.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                    <p className="text-xs text-gray-600 dark:text-gray-300">BTW</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">€{result.vatAmount.toFixed(2)}</p>
                  </div>
                  <div className="bg-primary-50 p-3 rounded">
                    <p className="text-xs text-primary-600">Incl. BTW</p>
                    <p className="text-lg font-bold text-primary-900">€{result.totalAmount.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Download}
                    onClick={() => window.open(result.fileUrl, '_blank')}
                  >
                    Download PDF
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default InkomendeFacturenTab;
