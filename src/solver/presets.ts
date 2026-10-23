import { PresetId, SolverConfig } from './types';
import { LBMGrid } from './lbmCore';

export interface PresetDefinition {
  id: PresetId;
  name: string;
  category: string;
  description: string;
  referenceLit: string;
  config: SolverConfig;
  setupGeometry: (grid: LBMGrid) => void;
}

export const PRESET_DEFINITIONS: Record<PresetId, PresetDefinition> = {
  cylinder_karman: {
    id: 'cylinder_karman',
    name: 'Flow Around Cylinder (Kármán Vortex Street)',
    category: 'Unsteady Wake Instability',
    description: 'Alternating laminar vortex shedding behind a circular cylinder at Re=150. Generates periodic oscillating lift forces and Strouhal wake shedding.',
    referenceLit: 'Williamson, C. H. K. (1989) J. Fluid Mech.',
    config: {
      preset: 'cylinder_karman',
      nx: 240,
      ny: 120,
      uInlet: 0.05,
      viscosityLattice: 0.015,
      physicalVelocity: 15.0,
      physicalLength: 0.1,
      physicalDensity: 1.225,
      physicalKinematicViscosity: 1.48e-5,
      turbulenceModel: 'None (Laminar)',
      boundaryTop: 'slip',
      boundaryBottom: 'slip',
      boundaryLeft: 'zou_he_velocity',
      boundaryRight: 'convective_outflow',
    },
    setupGeometry: (grid: LBMGrid) => {
      grid.clearObstacles();
      // Add cylinder at 1/4 chord
      const cx = Math.round(grid.nx * 0.28);
      const cy = Math.round(grid.ny * 0.50);
      const radius = Math.round(grid.ny * 0.16);
      grid.addCylinder(cx, cy, radius);
      grid.uInlet = 0.05;
      grid.topWallVelocity = 0.0;
    },
  },

  lid_cavity: {
    id: 'lid_cavity',
    name: '2D Lid-Driven Cavity Flow',
    category: 'Canonical Navier-Stokes Benchmark',
    description: 'Square enclosure with three stationary walls and a moving top boundary at U=1.0. Forms primary central vortex and secondary bottom-corner eddies.',
    referenceLit: 'Ghia, Ghia & Shin (1982) J. Comput. Phys.',
    config: {
      preset: 'lid_cavity',
      nx: 160,
      ny: 160,
      uInlet: 0.0,
      viscosityLattice: 0.01,
      physicalVelocity: 1.0,
      physicalLength: 1.0,
      physicalDensity: 1000.0,
      physicalKinematicViscosity: 1.0e-3,
      turbulenceModel: 'None (Laminar)',
      boundaryTop: 'moving_wall',
      boundaryBottom: 'bounce_back',
      boundaryLeft: 'zou_he_velocity',
      boundaryRight: 'convective_outflow',
    },
    setupGeometry: (grid: LBMGrid) => {
      grid.clearObstacles();
      grid.uInlet = 0.0;
      grid.topWallVelocity = 0.08; // Moving lid velocity in lattice units
      // Solid left and right walls for cavity
      for (let y = 0; y < grid.ny; y++) {
        grid.obstacle[0 + y * grid.nx] = 1;
        grid.obstacle[(grid.nx - 1) + y * grid.nx] = 1;
      }
      for (let x = 0; x < grid.nx; x++) {
        grid.obstacle[x + 0 * grid.nx] = 1;
      }
    },
  },

  poiseuille_channel: {
    id: 'poiseuille_channel',
    name: 'Planar Poiseuille Channel Flow',
    category: 'Exact Analytical Navier-Stokes',
    description: 'Fully developed laminar flow between two parallel stationary plates driven by a uniform pressure gradient. Parabolic velocity profile u(y).',
    referenceLit: 'Navier (1823) / Stokes (1845)',
    config: {
      preset: 'poiseuille_channel',
      nx: 200,
      ny: 100,
      uInlet: 0.04,
      viscosityLattice: 0.02,
      physicalVelocity: 10.0,
      physicalLength: 0.1,
      physicalDensity: 1.225,
      physicalKinematicViscosity: 1.48e-5,
      turbulenceModel: 'None (Laminar)',
      boundaryTop: 'bounce_back',
      boundaryBottom: 'bounce_back',
      boundaryLeft: 'zou_he_velocity',
      boundaryRight: 'convective_outflow',
    },
    setupGeometry: (grid: LBMGrid) => {
      grid.clearObstacles();
      grid.uInlet = 0.04;
      grid.topWallVelocity = 0.0;
      // Top and bottom plates
      for (let x = 0; x < grid.nx; x++) {
        grid.obstacle[x + 0 * grid.nx] = 1;
        grid.obstacle[x + (grid.ny - 1) * grid.nx] = 1;
      }
    },
  },

  backward_step: {
    id: 'backward_step',
    name: 'Backward-Facing Step Separation',
    category: 'Recirculation & Reattachment',
    description: 'Sudden channel expansion creating adverse pressure gradient and detached shear layer. Validates reattachment length X_r vs Re.',
    referenceLit: 'Armaly et al. (1983) J. Fluid Mech.',
    config: {
      preset: 'backward_step',
      nx: 240,
      ny: 100,
      uInlet: 0.04,
      viscosityLattice: 0.015,
      physicalVelocity: 12.0,
      physicalLength: 0.05,
      physicalDensity: 1.225,
      physicalKinematicViscosity: 1.48e-5,
      turbulenceModel: 'None (Laminar)',
      boundaryTop: 'bounce_back',
      boundaryBottom: 'bounce_back',
      boundaryLeft: 'zou_he_velocity',
      boundaryRight: 'convective_outflow',
    },
    setupGeometry: (grid: LBMGrid) => {
      grid.clearObstacles();
      grid.uInlet = 0.04;
      grid.topWallVelocity = 0.0;
      // Step block at bottom entrance
      const stepWidth = Math.round(grid.nx * 0.25);
      const stepHeight = Math.round(grid.ny * 0.5);
      for (let y = 0; y < stepHeight; y++) {
        for (let x = 0; x < stepWidth; x++) {
          grid.obstacle[x + y * grid.nx] = 1;
        }
      }
      // Top wall
      for (let x = 0; x < grid.nx; x++) {
        grid.obstacle[x + (grid.ny - 1) * grid.nx] = 1;
      }
    },
  },

  airfoil_naca: {
    id: 'airfoil_naca',
    name: 'NACA 0012 Airfoil Aerodynamic Polar',
    category: 'Lifting Surface & Circulation',
    description: 'Symmetric NACA 4-digit airfoil at angle of attack. Visualizes bound circulation, suction-peak acceleration, and trailing-edge stagnation point.',
    referenceLit: 'Abbott & Von Doenhoff / NASA TM 4074',
    config: {
      preset: 'airfoil_naca',
      nx: 240,
      ny: 120,
      uInlet: 0.05,
      viscosityLattice: 0.012,
      physicalVelocity: 25.0,
      physicalLength: 0.20,
      physicalDensity: 1.225,
      physicalKinematicViscosity: 1.48e-5,
      turbulenceModel: 'None (Laminar)',
      boundaryTop: 'slip',
      boundaryBottom: 'slip',
      boundaryLeft: 'zou_he_velocity',
      boundaryRight: 'convective_outflow',
    },
    setupGeometry: (grid: LBMGrid) => {
      grid.clearObstacles();
      grid.uInlet = 0.05;
      grid.topWallVelocity = 0.0;
      // Draw inclined NACA 0012 airfoil
      const cx = Math.round(grid.nx * 0.32);
      const cy = Math.round(grid.ny * 0.50);
      const chord = Math.round(grid.nx * 0.22);
      const alphaRad = (6 * Math.PI) / 180; // 6 deg alpha

      for (let y = 0; y < grid.ny; y++) {
        for (let x = 0; x < grid.nx; x++) {
          // Coordinate relative to leading edge
          const dx = x - cx;
          const dy = y - cy;
          // Rotate by alpha
          const rotX = dx * Math.cos(alphaRad) + dy * Math.sin(alphaRad);
          const rotY = -dx * Math.sin(alphaRad) + dy * Math.cos(alphaRad);

          if (rotX >= 0 && rotX <= chord) {
            const xNorm = rotX / chord;
            // NACA 0012 thickness formula: yt = 5 * t * (0.2969*sqrt(x) - 0.1260*x - 0.3516*x^2 + 0.2843*x^3 - 0.1015*x^4)
            const t = 0.12;
            const halfThick = chord * 5 * t * (
              0.2969 * Math.sqrt(xNorm) -
              0.1260 * xNorm -
              0.3516 * xNorm * xNorm +
              0.2843 * xNorm * xNorm * xNorm -
              0.1015 * xNorm * xNorm * xNorm * xNorm
            );

            if (Math.abs(rotY) <= halfThick) {
              grid.obstacle[x + y * grid.nx] = 1;
            }
          }
        }
      }
    },
  },

  heated_cavity: {
    id: 'heated_cavity',
    name: 'Thermally Driven Buoyant Cavity',
    category: 'Natural Convection & Rayleigh Numbers',
    description: 'Enclosure with differential heating: hot left vertical wall, cold right vertical wall, adiabatic top and bottom. Buoyancy circulation.',
    referenceLit: 'de Vahl Davis (1983) Int. J. Numer. Meth. Fluids',
    config: {
      preset: 'heated_cavity',
      nx: 140,
      ny: 140,
      uInlet: 0.0,
      viscosityLattice: 0.015,
      physicalVelocity: 0.5,
      physicalLength: 0.5,
      physicalDensity: 1.2,
      physicalKinematicViscosity: 1.5e-5,
      turbulenceModel: 'None (Laminar)',
      boundaryTop: 'bounce_back',
      boundaryBottom: 'bounce_back',
      boundaryLeft: 'zou_he_velocity',
      boundaryRight: 'convective_outflow',
    },
    setupGeometry: (grid: LBMGrid) => {
      grid.clearObstacles();
      grid.uInlet = 0.0;
      grid.topWallVelocity = 0.0;
      // Enclose cavity walls
      for (let y = 0; y < grid.ny; y++) {
        grid.obstacle[0 + y * grid.nx] = 1;
        grid.obstacle[(grid.nx - 1) + y * grid.nx] = 1;
      }
      for (let x = 0; x < grid.nx; x++) {
        grid.obstacle[x + 0 * grid.nx] = 1;
        grid.obstacle[x + (grid.ny - 1) * grid.nx] = 1;
      }
    },
  },
};
