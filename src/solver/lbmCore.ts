/**
 * D2Q9 Lattice Boltzmann Numerical Engine
 * Standard BGK Single-Relaxation-Time Formulation
 */

export const D2Q9_CX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
export const D2Q9_CY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
export const D2Q9_WEIGHTS = [
  4 / 9,
  1 / 9, 1 / 9, 1 / 9, 1 / 9,
  1 / 36, 1 / 36, 1 / 36, 1 / 36
];
export const D2Q9_OPPOSITE = [0, 3, 4, 1, 2, 7, 8, 5, 6];

/**
 * Calculates equilibrium distribution for direction i in D2Q9
 */
export function calculateEquilibrium(i: number, rho: number, u: number, v: number): number {
  const cx = D2Q9_CX[i];
  const cy = D2Q9_CY[i];
  const w = D2Q9_WEIGHTS[i];

  // c_i · u
  const cu = cx * u + cy * v;
  // u · u
  const u2 = u * u + v * v;

  // f_i^eq = w_i * rho * (1 + 3*(c·u) + 4.5*(c·u)^2 - 1.5*(u^2))
  return w * rho * (1 + 3 * cu + 4.5 * cu * cu - 1.5 * u2);
}

/**
 * Computes relaxation parameter tau from lattice viscosity: tau = 3 * nu + 0.5
 */
export function calculateTau(viscosityLattice: number): number {
  return 3 * viscosityLattice + 0.5;
}

/**
 * Computes omega relaxation frequency: omega = 1 / tau
 */
export function calculateOmega(viscosityLattice: number): number {
  const tau = calculateTau(viscosityLattice);
  return 1 / tau;
}

export class LBMGrid {
  public nx: number;
  public ny: number;
  public size: number;
  
  // Distribution functions: 9 directions per cell
  public f: Float32Array;
  public fTemp: Float32Array;

  // Macro fields
  public rho: Float32Array;
  public u: Float32Array;
  public v: Float32Array;
  public obstacle: Uint8Array; // 1 = solid, 0 = fluid

  // Physical parameters
  public tau: number;
  public omega: number;
  public uInlet: number;
  public topWallVelocity: number;

  constructor(nx: number, ny: number, viscosityLattice: number = 0.02, uInlet: number = 0.05) {
    this.nx = nx;
    this.ny = ny;
    this.size = nx * ny;
    this.uInlet = uInlet;
    this.topWallVelocity = 0.0;
    this.tau = calculateTau(viscosityLattice);
    this.omega = 1 / this.tau;

    this.f = new Float32Array(this.size * 9);
    this.fTemp = new Float32Array(this.size * 9);
    this.rho = new Float32Array(this.size);
    this.u = new Float32Array(this.size);
    this.v = new Float32Array(this.size);
    this.obstacle = new Uint8Array(this.size);

    this.initialize(1.0, uInlet, 0.0);
  }

  public setViscosity(nu: number) {
    this.tau = calculateTau(nu);
    this.omega = 1 / this.tau;
  }

  public initialize(rho0: number = 1.0, u0: number = 0.0, v0: number = 0.0) {
    for (let y = 0; y < this.ny; y++) {
      for (let x = 0; x < this.nx; x++) {
        const idx = x + y * this.nx;
        this.rho[idx] = rho0;
        this.u[idx] = u0;
        this.v[idx] = v0;

        for (let i = 0; i < 9; i++) {
          this.f[idx * 9 + i] = calculateEquilibrium(i, rho0, u0, v0);
          this.fTemp[idx * 9 + i] = this.f[idx * 9 + i];
        }
      }
    }
  }

  /**
   * Collision step: BGK relaxation
   */
  public collide() {
    const size = this.size;
    const omega = this.omega;

    for (let idx = 0; idx < size; idx++) {
      if (this.obstacle[idx] === 1) continue;

      const r = this.rho[idx];
      const ux = this.u[idx];
      const uy = this.v[idx];

      const baseIdx = idx * 9;
      for (let i = 0; i < 9; i++) {
        const feq = calculateEquilibrium(i, r, ux, uy);
        this.f[baseIdx + i] = this.f[baseIdx + i] * (1 - omega) + feq * omega;
      }
    }
  }

  /**
   * Streaming step: advect distributions to neighboring nodes
   */
  public stream() {
    const nx = this.nx;
    const ny = this.ny;

    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const srcIdx = x + y * nx;
        const srcBase = srcIdx * 9;

        for (let i = 0; i < 9; i++) {
          let nextX = x + D2Q9_CX[i];
          let nextY = y + D2Q9_CY[i];

          // Periodic left-right wrapping if open channel
          if (nextX < 0) nextX = nx - 1;
          if (nextX >= nx) nextX = 0;

          // Bounce back on top/bottom walls
          if (nextY < 0 || nextY >= ny) {
            // bounce back immediately
            const opp = D2Q9_OPPOSITE[i];
            this.fTemp[srcBase + opp] = this.f[srcBase + i];
          } else {
            const destIdx = nextX + nextY * nx;
            this.fTemp[destIdx * 9 + i] = this.f[srcBase + i];
          }
        }
      }
    }

    // Copy back
    this.f.set(this.fTemp);
  }

  /**
   * Apply boundary conditions:
   * - Solid obstacle bounce-back
   * - Inflow velocity at west wall (x=0)
   * - Outflow at east wall (x=nx-1)
   * - Moving lid if topWallVelocity > 0
   */
  public applyBoundaries() {
    const nx = this.nx;
    const ny = this.ny;

    // 1. Obstacle bounce-back
    for (let idx = 0; idx < this.size; idx++) {
      if (this.obstacle[idx] === 1) {
        const base = idx * 9;
        const f0 = this.f[base + 0];
        const f1 = this.f[base + 1];
        const f2 = this.f[base + 2];
        const f3 = this.f[base + 3];
        const f4 = this.f[base + 4];
        const f5 = this.f[base + 5];
        const f6 = this.f[base + 6];
        const f7 = this.f[base + 7];
        const f8 = this.f[base + 8];

        this.f[base + 1] = f3;
        this.f[base + 3] = f1;
        this.f[base + 2] = f4;
        this.f[base + 4] = f2;
        this.f[base + 5] = f7;
        this.f[base + 7] = f5;
        this.f[base + 6] = f8;
        this.f[base + 8] = f6;
      }
    }

    // 2. West inlet boundary (Zou-He / equilibrium inlet)
    if (this.uInlet > 0) {
      for (let y = 1; y < ny - 1; y++) {
        const idx = 0 + y * nx;
        if (this.obstacle[idx] === 1) continue;
        const base = idx * 9;
        const rhoLocal = 1.0;
        for (let i = 0; i < 9; i++) {
          this.f[base + i] = calculateEquilibrium(i, rhoLocal, this.uInlet, 0.0);
        }
      }
    }

    // 3. Moving top lid boundary (for Lid-Driven Cavity)
    if (this.topWallVelocity !== 0.0) {
      const y = ny - 1;
      for (let x = 1; x < nx - 1; x++) {
        const idx = x + y * nx;
        const base = idx * 9;
        const rhoLocal = 1.0;
        for (let i = 0; i < 9; i++) {
          this.f[base + i] = calculateEquilibrium(i, rhoLocal, this.topWallVelocity, 0.0);
        }
      }
    }
  }

  /**
   * Updates macroscopic density rho, velocity u, v, and returns L2 residual
   */
  public updateMacroMoments(): number {
    const size = this.size;
    let sumDiffSq = 0;
    let sumMagSq = 0;

    for (let idx = 0; idx < size; idx++) {
      if (this.obstacle[idx] === 1) {
        this.u[idx] = 0;
        this.v[idx] = 0;
        continue;
      }

      const base = idx * 9;
      let r = 0;
      let rx = 0;
      let ry = 0;

      for (let i = 0; i < 9; i++) {
        const fi = this.f[base + i];
        r += fi;
        rx += fi * D2Q9_CX[i];
        ry += fi * D2Q9_CY[i];
      }

      this.rho[idx] = r;
      const oldUx = this.u[idx];
      const oldUy = this.v[idx];

      const newUx = r > 0 ? rx / r : 0;
      const newUy = r > 0 ? ry / r : 0;

      this.u[idx] = newUx;
      this.v[idx] = newUy;

      const du = newUx - oldUx;
      const dv = newUy - oldUy;
      sumDiffSq += du * du + dv * dv;
      sumMagSq += newUx * newUx + newUy * newUy;
    }

    // Relative L2 norm residual
    return sumMagSq > 0 ? Math.sqrt(sumDiffSq / sumMagSq) : 0;
  }

  /**
   * Calculates surface drag (Fx) and lift (Fy) on all solid obstacles via momentum exchange
   */
  public calculateSurfaceForces(): { fx: number; fy: number; cd: number; cl: number } {
    let fx = 0;
    let fy = 0;
    const nx = this.nx;
    const ny = this.ny;

    for (let y = 1; y < ny - 1; y++) {
      for (let x = 1; x < nx - 1; x++) {
        const idx = x + y * nx;
        if (this.obstacle[idx] !== 1) continue;

        // Check 8 fluid neighbors
        for (let i = 1; i < 9; i++) {
          const nX = x + D2Q9_CX[i];
          const nY = y + D2Q9_CY[i];
          const nIdx = nX + nY * nx;

          if (this.obstacle[nIdx] === 0) {
            // Fluid neighbor: momentum exchange
            const opp = D2Q9_OPPOSITE[i];
            const fOut = this.f[nIdx * 9 + opp];
            const fIn = this.f[idx * 9 + i];

            fx += (fOut + fIn) * D2Q9_CX[i];
            fy += (fOut + fIn) * D2Q9_CY[i];
          }
        }
      }
    }

    // Dynamic pressure q = 0.5 * rho * u^2 * characteristic_D
    const q = 0.5 * 1.0 * this.uInlet * this.uInlet * 30.0; // characteristic scale
    const cd = q > 0 ? Math.abs(fx) / q : 0;
    const cl = q > 0 ? fy / q : 0;

    return { fx, fy, cd, cl };
  }

  /**
   * Single time-step solver iteration
   */
  public step(): { residual: number; forces: { fx: number; fy: number; cd: number; cl: number } } {
    this.collide();
    this.stream();
    this.applyBoundaries();
    const residual = this.updateMacroMoments();
    const forces = this.calculateSurfaceForces();
    return { residual, forces };
  }

  /**
   * Geometry helpers: adds circular cylinder obstacle
   */
  public addCylinder(centerX: number, centerY: number, radius: number) {
    const r2 = radius * radius;
    for (let y = 0; y < this.ny; y++) {
      for (let x = 0; x < this.nx; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        if (dx * dx + dy * dy <= r2) {
          this.obstacle[x + y * this.nx] = 1;
        }
      }
    }
  }

  /**
   * Clears all obstacle geometry
   */
  public clearObstacles() {
    this.obstacle.fill(0);
  }
}
