// src/pages/ScenarioVergelijk.tsx
// Twee tot vier scenario's naast elkaar
// Skelet — wordt gevuld zodra de rekenmotor is goedgekeurd.

import React from 'react';
import { GitCompareArrows } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import PageHeader from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import Card from '../components/ui/Card';

const ScenarioVergelijk: React.FC = () => {
  usePageTitle('Scenario vergelijken');

  return (
    <div className="space-y-4">
      <PageHeader title="Scenario vergelijken" subtitle="Twee tot vier scenario's naast elkaar" emoji="⚖️" />
      <Card>
        <EmptyState
          icon={GitCompareArrows}
          title="Nog in aanbouw"
          description="Deze pagina wordt gebouwd zodra de rekenmotor is nagerekend en goedgekeurd."
        />
      </Card>
    </div>
  );
};

export default ScenarioVergelijk;
