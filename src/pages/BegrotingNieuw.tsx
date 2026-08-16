// src/pages/BegrotingNieuw.tsx
// Kies een entiteit en periode, of dupliceer een scenario
// Skelet — wordt gevuld zodra de rekenmotor is goedgekeurd.

import React from 'react';
import { FilePlus2 } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import PageHeader from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import Card from '../components/ui/Card';

const BegrotingNieuw: React.FC = () => {
  usePageTitle('Nieuwe begroting');

  return (
    <div className="space-y-4">
      <PageHeader title="Nieuwe begroting" subtitle="Kies een entiteit en periode, of dupliceer een scenario" emoji="➕" />
      <Card>
        <EmptyState
          icon={FilePlus2}
          title="Nog in aanbouw"
          description="Deze pagina wordt gebouwd zodra de rekenmotor is nagerekend en goedgekeurd."
        />
      </Card>
    </div>
  );
};

export default BegrotingNieuw;
