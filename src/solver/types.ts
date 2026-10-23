export type PresetId = 
  | 'cylinder_karman'
  | 'lid_cavity'
  | 'poiseuille_channel'
  | 'backward_step'
  | 'airfoil_naca'
  | 'heated_cavity';

export type FieldType = 'velocity' | 'pressure' | 'vorticity' | 'streamlines' | 'vectors';
export type ColormapType = 'viridis' | 'turbo' | 'coolwarm';
export type ObstacleTool = 'none' | 'draw' | 'circle' | 'rect' | 'erase' | 'probe' | 'slice';

export interface SolverConfig {
  preset: PresetId;
  nx: number;
  ny: number;
  uInlet: number; // Lattice velocity (typically 0.02 - 0.1)
  viscosityLattice: number; // Lattice kinematic viscosity nu_lb
  physicalVelocity: number; // m/s
  physicalLength: number; // m
  physicalDensity: number; // kg/m^3
  physicalKinematicViscosity: number; // m^2/s
  turbulenceModel: 'None (Laminar)' | 'Smagorinsky LES' | 'k-omega SST (UI preview)';
  boundaryTop: 'bounce_back' | 'moving_wall' | 'periodic' | 'slip';
  boundaryBottom: 'bounce_back' | 'periodic' | 'slip';
  boundaryLeft: 'zou_he_velocity' | 'periodic';
  boundaryRight: 'convective_outflow' | 'periodic';
}

export interface SimulationMetrics {
  iteration: number;
  timeStep: number;
  reynolds: number;
  mach: number;
  cfl: number;
  residualL2: number;
  cd: number; // Drag coefficient
  cl: number; // Lift coefficient
  kineticEnergy: number;
  maxVelocity: number;
  minPressure: number;
  maxPressure: number;
  isStable: boolean;
}

export interface ProbePoint {
  id: string;
  x: number; // normalized [0, 1]
  y: number; // normalized [0, 1]
  u: number;
  v: number;
  speed: number;
  pressure: number;
  vorticity: number;
  history: { step: number; speed: number; pressure: number }[];
}

export interface SavedRun {
  id: string;
  timestamp: string;
  name: string;
  preset: PresetId;
  reynolds: number;
  cdAvg: number;
  clAmp: number;
  convergenceStatus: string;
  notes: string;
}
