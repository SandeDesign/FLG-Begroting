// src/components/invoices/FactuurWerkbonnenImport.tsx

import React, { useState } from 'react';
import { Download, X, Loader, AlertCircle } from 'lucide-react';
import { ITKnechtFactuurService, FactuurWeekData } from '../../services/itknechtFactuurService';
import Button from '../ui/Button';
import { useToast } from '../../hooks/useToast';

interface FactuurWerkbonnenImportProps {
  companyId: string;
  onImport: (items: any[]) => void;
}

const FactuurWerkbonnenImport: React.FC<FactuurWerkbonnenImportProps> = ({
  companyId,
  onImport
}) => {
  const { error: showError, success } = useToast();
  const [selectedWeek, setSelectedWeek] = useState<number>(ITKnechtFactuurService.getCurrentWeek());
  const [loading, setLoading] = useState(false);
  const [weekData, setWeekData] = useState<FactuurWeekData[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const weekOptions = ITKnechtFactuurService.getWeekOptions();
  const currentYear = ITKnechtFactuurService.getCurrentYear();

  const handleLoadWeek = async () => {
    if (!selectedWeek) {
      showError('Fout', 'Selecteer een week');
      return;
    }

    setLoading(true);
    try {
      const data = await ITKnechtFactuurService.fetchFactuurData(
        selectedWeek,
        currentYear,
        companyId
      );

      if (!data || data.length === 0) {
        showError('Geen gegevens', `Geen productiegegevens gevonden voor week ${selectedWeek}`);
        setWeekData([]);
        return;
      }

      setWeekData(data);
      setShowPreview(true);
      success('Gegevens geladen', `Week ${selectedWeek} gegevens succesvol geladen`);
    } catch (err) {
      console.error('Error loading factuur data:', err);
      showError('Fout bij laden', err instanceof Error ? err.message : 'Kon gegevens niet laden');
      setWeekData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!weekData || weekData.length === 0) {
      showError('Fout', 'Geen gegevens om in te voeren');
      return;
    }

    const items = ITKnechtFactuurService.transformToInvoiceItems(weekData);
    onImport(items);
    setShowPreview(false);
    setWeekData([]);
    success('Geïmporteerd', `${items.length} factuurregels toegevoegd`);
  };

  const handleClose = () => {
    setShowPreview(false);
    setWeekData([]);
  };

  return (
    <div className="space-y-4">
      {/* Week Selector */}
      <div className="flex gap-2">
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(Number(e.target.value))}
          disabled={loading || showPreview}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
        >
          {weekOptions.map(opt => (
            <option key={opt.week} value={opt.week}>
              {opt.label} ({currentYear})
            </option>
          ))}
        </select>

        <Button
          onClick={handleLoadWeek}
          disabled={loading || showPreview}
          icon={loading ? Loader : Download}
          className={loading ? 'opacity-50' : ''}
        >
          {loading ? 'Laden...' : 'Laad Week'}
        </Button>
      </div>

      {/* Preview Modal */}
      {showPreview && weekData.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold">Werkbonnen Factuurgegevens - Week {selectedWeek}</h3>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(80vh-140px)] p-4 space-y-4">
              {weekData.map((week, weekIdx) => (
                <div key={weekIdx} className="border border-gray-200 dark:border-gray-700 rounded p-3">
                  <h4 className="font-semibold mb-2">
                    Week {week.week} - {week.monteur}
                  </h4>
                  
                  <div className="space-y-1 text-sm">
                    {week.regels.map((regel, rIdx) => (
                      <div key={rIdx} className="text-gray-700 dark:text-gray-300 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                        <div className="font-mono">
                          "{regel.datum}" {regel.uren} {regel.opdrachtgever} "{regel.locaties}"
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 text-right text-sm font-semibold text-gray-600 dark:text-gray-300">
                    Totaal: {week.totalUren} uren
                  </div>
                </div>
              ))}

              {/* Info */}
              <div className="flex gap-2 p-3 bg-primary-50 border border-primary-200 rounded text-sm text-primary-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Opmerking:</strong> Deze gegevens worden als beschrijving toegevoegd. Pas het dagtarief aan als nodig.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700 justify-end">
              <Button
                variant="ghost"
                onClick={handleClose}
              >
                Annuleren
              </Button>
              <Button
                variant="primary"
                onClick={handleImport}
              >
                Voeg toe aan factuur
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FactuurWerkbonnenImport;