import React, { useState } from 'react';
import { Upload, Send, FileText, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useToast } from '../../hooks/useToast';
import { uploadFile } from '../../services/fileUploadService';
import { outgoingInvoiceService } from '../../services/outgoingInvoiceService';
import { Company } from '../../types';

interface Props {
  selectedCompany: Company;
}

const BTW_OPTIONS = [
  { pct: 21, label: '21% (hoog)' },
  { pct: 9,  label: '9% (laag)' },
  { pct: 0,  label: '0% / vrijgesteld' },
];

const UitgaandeFacturenTab: React.FC<Props> = ({ selectedCompany }) => {
  const { user } = useAuth();
  const { success, error: showError } = useToast();

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    clientName: '',
    invoiceNumber: '',
    invoiceDate: today,
    dueDate: in30Days,
    amountExclBtw: '',
    btwPct: 21,
    description: '',
    status: 'sent' as 'draft' | 'sent' | 'paid',
  });

  const resetAll = () => {
    setUploadedFile(null);
    setForm({
      clientName: '',
      invoiceNumber: '',
      invoiceDate: today,
      dueDate: in30Days,
      amountExclBtw: '',
      btwPct: 21,
      description: '',
      status: 'sent',
    });
  };

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      showError('Ongeldig bestandstype', 'Alleen PDF of afbeeldingen');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showError('Bestand te groot', 'Maximaal 10MB');
      return;
    }
    setUploadedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    if (!user || !selectedCompany) return;
    if (!uploadedFile) {
      showError('Geen bestand', 'Selecteer eerst een PDF van de factuur');
      return;
    }
    if (!form.clientName.trim()) {
      showError('Ontbrekend veld', 'Klantnaam is verplicht');
      return;
    }
    if (!form.invoiceNumber.trim()) {
      showError('Ontbrekend veld', 'Factuurnummer is verplicht');
      return;
    }
    const amount = parseFloat(form.amountExclBtw);
    if (!Number.isFinite(amount) || amount <= 0) {
      showError('Ongeldig bedrag', 'Vul een geldig bedrag excl. BTW in');
      return;
    }

    setSaving(true);
    try {
      // companyId meegeven → nieuwe structuur: FLG-Administratie/{id}__{slug}/Verkoop/{year}/{invoiceNumber}.ext
      const uploadRes = await uploadFile(uploadedFile, selectedCompany.name, 'Verkoop', form.invoiceNumber, selectedCompany.id);
      if (!uploadRes.success) throw new Error('Upload mislukt');

      const vatAmount = +(amount * (form.btwPct / 100)).toFixed(2);
      const totalAmount = +(amount + vatAmount).toFixed(2);
      const invoiceDate = new Date(form.invoiceDate);
      const dueDate = new Date(form.dueDate);

      await outgoingInvoiceService.createInvoice({
        userId: selectedCompany.userId,
        companyId: selectedCompany.id,
        invoiceNumber: form.invoiceNumber.trim(),
        clientName: form.clientName.trim(),
        clientEmail: '',
        clientAddress: { street: '', city: '', zipCode: '', country: 'Nederland' },
        amount,
        vatAmount,
        totalAmount,
        description: form.description.trim() || `Extern aangemaakt — ${form.clientName.trim()}`,
        invoiceDate,
        dueDate,
        status: form.status,
        paidAmount: form.status === 'paid' ? totalAmount : 0,
        sentAt: form.status !== 'draft' ? new Date() : undefined,
        paidAt: form.status === 'paid' ? new Date() : undefined,
        items: [{
          title: form.description.trim() || form.clientName.trim(),
          description: '',
          quantity: 1,
          rate: amount,
          amount,
        }],
        notes: 'Extern aangemaakt en geüpload',
        ExtraOntvangers: 'nee',
        pdfUrl: uploadRes.fileUrl,
      });

      success('Factuur opgeslagen', `${form.invoiceNumber} is toegevoegd aan uitgaande facturen`);
      resetAll();
    } catch (err) {
      console.error('Upload externe factuur mislukt:', err);
      showError('Opslaan mislukt', err instanceof Error ? err.message : 'Onbekende fout');
    } finally {
      setSaving(false);
    }
  };

  const amountNum = parseFloat(form.amountExclBtw) || 0;
  const vatPreview = +(amountNum * (form.btwPct / 100)).toFixed(2);
  const totalPreview = +(amountNum + vatPreview).toFixed(2);

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-primary-50/50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800">
        <div className="flex items-start gap-3">
          <Send className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">Externe facturen uploaden</p>
            <p>
              Upload hier facturen die je <strong>buiten dit systeem</strong> hebt aangemaakt (bijv. Exact, Twinfield, handmatig).
              Ze worden opgeslagen als uitgaande facturen en tellen mee in alle statistieken en overzichten.
            </p>
          </div>
        </div>
      </Card>

      {!uploadedFile ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
          className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
            isDragOver ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            Sleep een factuur PDF hierheen of{' '}
            <label className="font-medium text-primary-600 hover:text-primary-500 cursor-pointer">
              selecteer bestand
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </label>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            PDF of afbeelding, max 10MB
          </p>
        </div>
      ) : (
        <Card>
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{uploadedFile.name}</p>
                  <p className="text-xs text-gray-500">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button
                onClick={() => setUploadedFile(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                aria-label="Verwijder bestand"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  Klantnaam *
                </label>
                <input
                  type="text"
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                  placeholder="Bijv. ABC Bouwbedrijf BV"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  Factuurnummer *
                </label>
                <input
                  type="text"
                  value={form.invoiceNumber}
                  onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                  placeholder="Bijv. 2026-0042"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  Factuurdatum *
                </label>
                <input
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  Vervaldatum
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  Bedrag excl. BTW *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amountExclBtw}
                  onChange={(e) => setForm({ ...form, amountExclBtw: e.target.value })}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  BTW tarief
                </label>
                <select
                  value={form.btwPct}
                  onChange={(e) => setForm({ ...form, btwPct: Number(e.target.value) })}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                >
                  {BTW_OPTIONS.map(o => (
                    <option key={o.pct} value={o.pct}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  Omschrijving
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                  placeholder="Waarvoor is deze factuur?"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  Status
                </label>
                <div className="flex gap-2">
                  {(['draft', 'sent', 'paid'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({ ...form, status: s })}
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        form.status === s
                          ? 'bg-primary-50 border-primary-500 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {s === 'draft' ? 'Concept' : s === 'sent' ? 'Verstuurd' : 'Betaald'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-3 border-t dark:border-gray-700">
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                <p className="text-xs text-gray-600 dark:text-gray-300">Excl. BTW</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">€ {amountNum.toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                <p className="text-xs text-gray-600 dark:text-gray-300">BTW ({form.btwPct}%)</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">€ {vatPreview.toFixed(2)}</p>
              </div>
              <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded">
                <p className="text-xs text-primary-600">Incl. BTW</p>
                <p className="text-lg font-bold text-primary-900 dark:text-primary-100">€ {totalPreview.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-700">
              <Button variant="secondary" onClick={resetAll} disabled={saving}>
                Annuleren
              </Button>
              <Button onClick={handleSubmit} disabled={saving} icon={CheckCircle}>
                {saving ? 'Opslaan...' : 'Factuur opslaan'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default UitgaandeFacturenTab;
