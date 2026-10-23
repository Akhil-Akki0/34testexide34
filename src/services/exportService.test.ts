import test from 'node:test';
import assert from 'node:assert/strict';
import { exportToCsv, exportToJson, generatePdfReport, ExportDataset } from './exportService';
import { LBMGrid } from '../solver/lbmCore';

const dummyGrid = new LBMGrid(32, 16, 0.02, 0.05);

const sampleData: ExportDataset = {
  presetName: 'Flow Around Cylinder (Kármán Vortex Street)',
  presetId: 'cylinder_karman',
  metrics: {
    iteration: 420,
    timeStep: 0.21,
    reynolds: 150,
    mach: 0.044,
    cfl: 0.25,
    residualL2: 4.82e-6,
    cd: 1.182,
    cl: 0.238,
    kineticEnergy: 137.8,
    maxVelocity: 21.7,
    minPressure: 101280,
    maxPressure: 101385,
    isStable: true,
  },
  forceHistory: [
    { step: 10, cd: 1.18, cl: 0.1 },
    { step: 20, cd: 1.182, cl: 0.238 },
  ],
  residualHistory: [
    { step: 10, residual: 1e-3 },
    { step: 20, residual: 4.82e-6 },
  ],
  probe: {
    id: 'probe-1',
    x: 0.5,
    y: 0.5,
    u: 14.8,
    v: -1.2,
    speed: 14.85,
    pressure: 101340,
    vorticity: 32.1,
    history: [{ step: 10, speed: 14.8, pressure: 101340 }],
  },
  grid: dummyGrid,
  physicalVelocity: 15.0,
  physicalDensity: 1.225,
  physicalViscosity: 1.48e-5,
  gridResolution: '240x120',
};

test('exportToCsv generates valid CSV with correct headers for forces', () => {
  const csv = exportToCsv(sampleData, 'forces');
  assert.ok(csv.includes('Step,TimeSeconds,Cd,Cl,Fx_N,Fy_N'));
  assert.ok(csv.includes('10,0.0050,1.1800,0.1000'));
});

test('exportToCsv generates valid summary CSV', () => {
  const csv = exportToCsv(sampleData, 'summary');
  assert.ok(csv.includes('Reynolds Number,Re,150,dimensionless'));
  assert.ok(csv.includes('Drag Coefficient,Cd,1.1820,-'));
});

test('exportToJson serializes complete simulation run into valid JSON object', () => {
  const jsonStr = exportToJson(sampleData);
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.application, 'AetherCFD');
  assert.equal(parsed.metrics.reynolds, 150);
  assert.equal(parsed.forces.length, 2);
});

test('generatePdfReport builds a valid PDF document with metadata', () => {
  const pdf = generatePdfReport(sampleData);
  assert.ok(pdf);
  assert.equal(pdf.getNumberOfPages(), 1);
});
