import React from 'react';
import { SimulatorContainer } from '../simulator/SimulatorContainer';

export const SimulatorView: React.FC = () => {
  return (
    <div className="w-full flex-1 flex flex-col">
      <SimulatorContainer />
    </div>
  );
};
