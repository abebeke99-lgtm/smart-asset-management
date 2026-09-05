// Maintenance Component
import React from 'react';
import { Wrench } from 'lucide-react';
import InfrastructureComponentStub from './InfrastructureComponentStub';

const InfrastructureMaintenance = () => (
  <InfrastructureComponentStub
    icon={Wrench}
    title="Facility Maintenance"
    description="Request, review, and manage infrastructure maintenance operations"
  />
);

export default InfrastructureMaintenance;
