// src/pages/VasteLasten.tsx
// De vaste lasten van deze entiteit
// Skelet — wordt gevuld zodra de rekenmotor is goedgekeurd.

import React from 'react';
import { Receipt } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import PageHeader from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import Card from '../components/ui/Card';

const VasteLasten: React.FC = () => {
  usePageTitle('Vaste lasten');

  return (
    <div className="space-y-4">
      <PageHeader title="Vaste lasten" subtitle="De vaste lasten van deze entiteit" emoji="🧾" />
      <Card>
        <EmptyState
          icon={Receipt}
          title="Nog in aanbouw"
          description="Deze pagina wordt gebouwd zodra de rekenmotor is nagerekend en goedgekeurd."
        />
      </Card>
    </div>
  );
};

export default VasteLasten;
