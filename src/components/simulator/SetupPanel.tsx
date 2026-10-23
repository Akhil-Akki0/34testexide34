import React from 'react';
import { Sliders, AlertTriangle, ShieldCheck, Info, RotateCcw, Activity } from 'lucide-react';
import { PresetId } from '../../solver/types';
import { PRESET_DEFINITIONS } from '../../solver/presets';
import { STANDARD_FLUIDS } from '../../utils/cfdMath';

interface SetupPanelProps {
  preset: PresetId;
  onSelectPreset: (preset: PresetId) => void;
  fluidType: string;
  onChangeFluid: (fluid: string) => void;
  velocity: number;
  onChangeVelocity: (v: number) => void;
  density: number;
  onChangeDensity: (d: number) => void;
  viscosity: number;
  onChangeViscosity: (v: number) => void;
  resolution: string;
  onChangeResolution: (res: string) => void;
  turbulenceModel: string;
  onChangeTurbulence: (m: string) => void;
  reynolds: number;
  mach: number;
  cfl: number;
  isStable: boolean;
  onReset: () => void;
}

export const SetupPanel: React.FC<SetupPanelProps> = ({
  preset,
  onSelectPreset,
  fluidType,
  onChangeFluid,
  velocity,
  onChangeVelocity,
  density,
  onChangeDensity,
  viscosity,
  onChangeViscosity,
  resolution,
  onChangeResolution,
  turbulenceModel,
  onChangeTurbulence,
  reynolds,
  mach,
  cfl,
  isStable,
  onReset,
}) => {
  const currentPresetDef = PRESET_DEFINITIONS[preset] || PRESET_DEFINITIONS.cylinder_karman;

  return (
    <div className="h-full flex flex-col justify-between p-4 bg-[#080c14] border-r border-white/10 text-xs overflow-y-auto space-y-5">
      
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-white/10 text-slate-400 font-mono">
          <span className="flex items-center gap-1.5 font-bold text-white uppercase tracking-wider text-[11px]">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            Physical Setup Wizard
          </span>
          <button
            onClick={onReset}
            className="hover:text-white transition-colors"
            title="Reset parameters to preset default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Preset Selector */}
        <div className="mt-4 space-y-1.5">
          <label className="text-slate-300 font-medium block">Active CFD Preset</label>
          <select
            value={preset}
            onChange={(e) => onSelectPreset(e.target.value as PresetId)}
            className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-400"
          >
            {Object.values(PRESET_DEFINITIONS).map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400 font-mono line-clamp-2 mt-1">
            {currentPresetDef.description}
          </p>
          <div className="text-[10px] text-amber-400 font-mono">
            Ref: {currentPresetDef.referenceLit}
          </div>
        </div>

        {/* Fluid Medium */}
        <div className="mt-5 space-y-1.5">
          <label className="text-slate-300 font-medium block">Working Fluid</label>
          <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
            {[
              { id: 'air', label: 'Air' },
              { id: 'water', label: 'Water' },
              { id: 'oil', label: 'Oil' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  onChangeFluid(f.id);
                  const std = STANDARD_FLUIDS[f.id];
                  if (std) {
                    onChangeDensity(std.density);
                    onChangeViscosity(std.kinematicViscosity);
                  }
                }}
                className={`py-1.5 rounded border transition-colors ${
                  fluidType === f.id
                    ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold'
                    : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.08]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Velocity Slider */}
        <div className="mt-5 space-y-1.5">
          <div className="flex justify-between font-mono">
            <span className="text-slate-400">Inlet Velocity (U_inf)</span>
            <span className="text-cyan-400 font-bold">{velocity} m/s</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="40"
            step="0.5"
            value={velocity}
            onChange={(e) => onChangeVelocity(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Grid Resolution */}
        <div className="mt-5 space-y-1.5">
          <label className="text-slate-300 font-medium block">Mesh Resolution (Nx × Ny)</label>
          <div className="grid grid-cols-3 gap-1 font-mono text-[11px]">
            {['128x64', '240x120', '320x160'].map((res) => (
              <button
                key={res}
                onClick={() => onChangeResolution(res)}
                className={`py-1.5 rounded border transition-colors ${
                  resolution === res
                    ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold'
                    : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.08]'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>

        {/* Turbulence Model Selector */}
        <div className="mt-5 space-y-1.5">
          <label className="text-slate-300 font-medium block">Turbulence Model (Subgrid Scale)</label>
          <select
            value={turbulenceModel}
            onChange={(e) => onChangeTurbulence(e.target.value)}
            className="w-full p-2 rounded bg-white/5 border border-white/10 text-slate-200 text-xs font-mono focus:outline-none"
          >
            <option value="None (Laminar)" className="bg-slate-900">None (Direct Lattice BGK Laminar)</option>
            <option value="Smagorinsky LES" className="bg-slate-900">Smagorinsky Large-Eddy (Cs=0.14)</option>
            <option value="k-omega SST (UI preview)" className="bg-slate-900">k-ω Shear Stress Transport (3D Cloud Preview)</option>
          </select>
        </div>
      </div>

      {/* Derived Aerodynamic Values & Stability Warnings */}
      <div className="space-y-3 pt-4 border-t border-white/10">
        <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 font-mono space-y-2 text-[11px]">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
            Live Non-Dimensional State
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Reynolds (Re):</span>
            <span className="text-cyan-300 font-bold">{reynolds.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Mach Number (Ma):</span>
            <span className="text-white">{mach.toFixed(3)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Courant CFL:</span>
            <span className={cfl < 0.5 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {cfl.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Stability Warning / Status Indicator */}
        {!isStable || cfl > 0.8 ? (
          <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>High CFL: Reduce velocity to maintain lattice stability.</span>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Numerical scheme stable · Incompressible limit valid.</span>
          </div>
        )}

        <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between">
          <span>Browser solver · 2D</span>
          <span className="text-slate-400">D2Q9 BGK</span>
        </div>
      </div>

    </div>
  );
};
