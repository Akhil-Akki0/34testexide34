import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEquilibrium,
  calculateTau,
  calculateOmega,
  D2Q9_WEIGHTS,
  D2Q9_CX,
  D2Q9_CY,
  D2Q9_OPPOSITE,
  LBMGrid,
} from './lbmCore';

test('calculateEquilibrium preserves total density sum', () => {
  const rho = 1.0;
  const u = 0.05;
  const v = -0.02;

  let sumFeq = 0;
  for (let i = 0; i < 9; i++) {
    sumFeq += calculateEquilibrium(i, rho, u, v);
  }

  // sum(feq) must equal rho within float precision
  assert.ok(Math.abs(sumFeq - rho) < 1e-6);
});

test('calculateEquilibrium preserves macroscopic momentum', () => {
  const rho = 1.0;
  const u = 0.08;
  const v = -0.04;

  let sumUx = 0;
  let sumUy = 0;
  for (let i = 0; i < 9; i++) {
    const feq = calculateEquilibrium(i, rho, u, v);
    sumUx += feq * D2Q9_CX[i];
    sumUy += feq * D2Q9_CY[i];
  }

  assert.ok(Math.abs(sumUx - rho * u) < 1e-5);
  assert.ok(Math.abs(sumUy - rho * v) < 1e-5);
});

test('calculateTau and calculateOmega satisfy kinetic theory limits', () => {
  const nu = 0.02;
  const tau = calculateTau(nu);
  assert.equal(tau, 3 * 0.02 + 0.5); // 0.56
  const omega = calculateOmega(nu);
  assert.ok(Math.abs(omega - (1 / 0.56)) < 1e-6);
});

test('D2Q9_OPPOSITE satisfies exact involution symmetry', () => {
  for (let i = 0; i < 9; i++) {
    const opp = D2Q9_OPPOSITE[i];
    const doubleOpp = D2Q9_OPPOSITE[opp];
    assert.equal(doubleOpp, i, `Opposite of opposite direction for ${i} must equal ${i}`);
  }
});

test('LBMGrid executes single step without numerical explosion', () => {
  const grid = new LBMGrid(32, 16, 0.02, 0.05);
  grid.addCylinder(10, 8, 3);
  
  const { residual, forces } = grid.step();
  assert.ok(!isNaN(residual));
  assert.ok(residual >= 0);
  assert.ok(!isNaN(forces.cd));
  assert.ok(!isNaN(forces.cl));
});
