// src/pages/Ketenoverzicht.tsx
// De entiteiten naast elkaar, met de onderlinge leveringen
// Skelet — wordt gevuld zodra de rekenmotor is goedgekeurd.

import React from 'react';
import { Network } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import PageHeader from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import Card from '../components/ui/Card';

const Ketenoverzicht: React.FC = () => {
  usePageTitle('Ketenoverzicht');

  return (
    <div className="space-y-4">
      <PageHeader title="Ketenoverzicht" subtitle="De entiteiten naast elkaar, met de onderlinge leveringen" emoji="🔗" />
      <Card>
        <EmptyState
          icon={Network}
          title="Nog in aanbouw"
          description="Deze pagina wordt gebouwd zodra de rekenmotor is nagerekend en goedgekeurd."
        />
      </Card>
    </div>
  );
};

export default Ketenoverzicht;
