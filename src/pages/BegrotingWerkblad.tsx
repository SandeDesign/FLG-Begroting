// src/pages/BegrotingWerkblad.tsx
// Opdrachten, middelen, inzet en het resultaat
// Skelet — wordt gevuld zodra de rekenmotor is goedgekeurd.

import React from 'react';
import { Table2 } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import PageHeader from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import Card from '../components/ui/Card';

const BegrotingWerkblad: React.FC = () => {
  usePageTitle('Begroting');

  return (
    <div className="space-y-4">
      <PageHeader title="Begroting" subtitle="Opdrachten, middelen, inzet en het resultaat" emoji="📋" />
      <Card>
        <EmptyState
          icon={Table2}
          title="Nog in aanbouw"
          description="Deze pagina wordt gebouwd zodra de rekenmotor is nagerekend en goedgekeurd."
        />
      </Card>
    </div>
  );
};

export default BegrotingWerkblad;
