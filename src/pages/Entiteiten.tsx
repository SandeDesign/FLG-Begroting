// src/pages/Entiteiten.tsx
// De BV's van de groep en hun vaste lasten
// Skelet — wordt gevuld zodra de rekenmotor is goedgekeurd.

import React from 'react';
import { Building2 } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import PageHeader from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import Card from '../components/ui/Card';

const Entiteiten: React.FC = () => {
  usePageTitle('Entiteiten');

  return (
    <div className="space-y-4">
      <PageHeader title="Entiteiten" subtitle="De BV's van de groep en hun vaste lasten" emoji="🏢" />
      <Card>
        <EmptyState
          icon={Building2}
          title="Nog in aanbouw"
          description="Deze pagina wordt gebouwd zodra de rekenmotor is nagerekend en goedgekeurd."
        />
      </Card>
    </div>
  );
};

export default Entiteiten;
