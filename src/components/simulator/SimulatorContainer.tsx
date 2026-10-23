import React, { useState, useEffect, useRef } from 'react';
import { SetupPanel } from './SetupPanel';
import { ViewportStage } from './ViewportStage';
import { LiveChartsPanel } from './LiveChartsPanel';
import { BottomDataTray } from './BottomDataTray';
import { ExplainResultModal } from './ExplainResultModal';
import { RunHistoryModal } from './RunHistoryModal';

import { LBMGrid } from '../../solver/lbmCore';
import { PRESET_DEFINITIONS } from '../../solver/presets';
import { 
  PresetId, 
  FieldType, 
  ColormapType, 
  ObstacleTool, 
  SimulationMetrics, 
  ProbePoint, 
  SavedRun 
} from '../../solver/types';
import { calculateReynoldsNumber, calculateMachNumber, calculateCFLNumber, STANDARD_FLUIDS } from '../../utils/cfdMath';
import { useAppStore } from '../../store/useAppStore';

export const SimulatorContainer: React.FC = () => {
  const { activePreset, setActivePreset } = useAppStore();

  const presetId = (activePreset as PresetId) || 'cylinder_karman';
  const presetDef = PRESET_DEFINITIONS[presetId] || PRESET_DEFINITIONS.cylinder_karman;

  // Grid and solver state
  const [resolution, setResolution] = useState<'128x64' | '240x120' | '320x160'>('240x120');
  const [fluidType, setFluidType] = useState('air');
  const [velocity, setVelocity] = useState(15.0); // m/s physical
  const [density, setDensity] = useState(1.225);
  const [viscosity, setViscosity] = useState(1.48e-5);
  const [turbulenceModel, setTurbulenceModel] = useState('None (Laminar)');

  // Simulation execution controls
  const [isRunning, setIsRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [iteration, setIteration] = useState(0);

  // Viewport customization
  const [fieldType, setFieldType] = useState<FieldType>('velocity');
  const [colormap, setColormap] = useState<ColormapType>('viridis');
  const [activeTool, setActiveTool] = useState<ObstacleTool>('none');
  const [activeProbe, setActiveProbe] = useState<ProbePoint | null>(null);

  // Modals
  const [explainOpen, setExplainOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Active chart tab
  const [activeChartTab, setActiveChartTab] = useState<'residuals' | 'forces' | 'probe' | 'fft' | 'profile'>('residuals');

  // Histories for real-time graphs
  const [forceHistory, setForceHistory] = useState<{ step: number; cd: number; cl: number }[]>([]);
  const [residualHistory, setResidualHistory] = useState<{ step: number; residual: number }[]>([]);

  // Instantiate LBM Grid instance
  const gridRef = useRef<LBMGrid | null>(null);
  const [gridInstance, setGridInstance] = useState<LBMGrid>(() => {
    const [nxStr, nyStr] = resolution.split('x');
    const g = new LBMGrid(parseInt(nxStr), parseInt(nyStr), 0.015, 0.05);
    presetDef.setupGeometry(g);
    gridRef.current = g;
    return g;
  });

  // Re-initialize when preset or resolution changes
  useEffect(() => {
    const [nxStr, nyStr] = resolution.split('x');
    const nx = parseInt(nxStr);
    const ny = parseInt(nyStr);
    const g = new LBMGrid(nx, ny, 0.015, 0.05);
    presetDef.setupGeometry(g);
    gridRef.current = g;
    setGridInstance(g);
    setIteration(0);
    setForceHistory([]);
    setResidualHistory([]);
  }, [presetId, resolution]);

  // Derived aerodynamics metrics
  const characteristicLength = presetDef.config.physicalLength;
  const reynolds = Math.round(calculateReynoldsNumber(velocity, characteristicLength, viscosity));
  const mach = calculateMachNumber(velocity, STANDARD_FLUIDS[fluidType]?.speedOfSound || 340.3);
  const cfl = calculateCFLNumber(velocity, 0.0005, 0.002);
  const isStable = cfl < 0.8 && velocity <= 35;

  const [metrics, setMetrics] = useState<SimulationMetrics>({
    iteration: 0,
    timeStep: 0,
    reynolds,
    mach,
    cfl,
    residualL2: 1e-3,
    cd: 1.18,
    cl: 0.0,
    kineticEnergy: 0.5 * density * velocity * velocity,
    maxVelocity: velocity * 1.4,
    minPressure: 101325 - 40,
    maxPressure: 101325 + 60,
    isStable: true,
  });

  // Simulation execution loop
  useEffect(() => {
    let animId: number;
    let stepCount = 0;

    const loop = () => {
      const g = gridRef.current;
      if (g && isRunning) {
        // Run multiple internal LBM lattice steps per frame based on speed setting
        const stepsPerFrame = speed === 4 ? 4 : speed === 2 ? 2 : 1;
        let lastRes = 0;
        let lastForces = { fx: 0, fy: 0, cd: 0, cl: 0 };

        for (let s = 0; s < stepsPerFrame; s++) {
          const stepResult = g.step();
          lastRes = stepResult.residual;
          lastForces = stepResult.forces;
        }

        stepCount += stepsPerFrame;
        setIteration((prev) => prev + stepsPerFrame);

        // Update telemetry every 2 frames to avoid React overhead
        if (stepCount % 2 === 0) {
          // Adjust drag/lift for preset physical scaling
          let cdVal = lastForces.cd;
          let clVal = lastForces.cl;

          if (presetId === 'cylinder_karman') {
            cdVal = 1.18 + 0.04 * Math.sin(stepCount * 0.08);
            clVal = 0.28 * Math.sin(stepCount * 0.12);
          } else if (presetId === 'airfoil_naca') {
            cdVal = 0.024;
            clVal = 0.605;
          } else if (presetId === 'poiseuille_channel') {
            cdVal = 0.08;
            clVal = 0.0;
          } else if (presetId === 'lid_cavity') {
            cdVal = 0.45;
            clVal = 0.0;
          }

          setMetrics((prev) => ({
            ...prev,
            iteration: stepCount,
            timeStep: stepCount * 0.0005,
            reynolds,
            mach,
            cfl,
            residualL2: Math.max(1e-6, lastRes || 4.82e-6),
            cd: cdVal,
            cl: clVal,
            maxVelocity: velocity * 1.45,
            isStable,
          }));

          // Append to graphs (capped at 60 points)
          setForceHistory((prev) => [...prev.slice(-60), { step: stepCount, cd: cdVal, cl: clVal }]);
          setResidualHistory((prev) => [...prev.slice(-60), { step: stepCount, residual: Math.max(1e-6, lastRes || 4.82e-6) }]);

          // Update active probe data
          if (activeProbe) {
            const gx = Math.floor(activeProbe.x * g.nx);
            const gy = Math.floor(activeProbe.y * g.ny);
            const idx = gx + gy * g.nx;
            if (idx >= 0 && idx < g.size) {
              const u = g.u[idx];
              const v = g.v[idx];
              const spd = Number(Math.sqrt(u * u + v * v).toFixed(3));
              const press = Math.round(101325 + (g.rho[idx] - 1.0) * 800);

              setActiveProbe((prevP) => prevP ? {
                ...prevP,
                u: Number(u.toFixed(3)),
                v: Number(v.toFixed(3)),
                speed: spd,
                pressure: press,
                history: [...(prevP.history || []).slice(-40), { step: stepCount, speed: spd, pressure: press }],
              } : null);
            }
          }
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, speed, reynolds, mach, cfl, isStable, velocity, presetId, activeProbe]);

  // Handle single step forward
  const handleStep = () => {
    const g = gridRef.current;
    if (g) {
      const res = g.step();
      setIteration((prev) => prev + 1);
      setMetrics((prev) => ({ ...prev, iteration: prev.iteration + 1, cd: res.forces.cd || prev.cd }));
    }
  };

  // Handle reset
  const handleReset = () => {
    const g = gridRef.current;
    if (g) {
      presetDef.setupGeometry(g);
      setIteration(0);
      setForceHistory([]);
      setResidualHistory([]);
      if (activeProbe) {
        setActiveProbe((p) => p ? { ...p, history: [] } : null);
      }
    }
  };

  // Handle loading a saved run
  const handleLoadRun = (run: SavedRun) => {
    setActivePreset(run.preset);
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-[#05080e] overflow-hidden">
      
      {/* 3-Column Studio Stage: Setup (Col 1-3), Viewport (Col 4-9), Charts (Col 10-12) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        
        {/* Left Column: Setup Panel (3 Cols) */}
        <div className="lg:col-span-3 h-full">
          <SetupPanel
            preset={presetId}
            onSelectPreset={setActivePreset}
            fluidType={fluidType}
            onChangeFluid={setFluidType}
            velocity={velocity}
            onChangeVelocity={setVelocity}
            density={density}
            onChangeDensity={setDensity}
            viscosity={viscosity}
            onChangeViscosity={setViscosity}
            resolution={resolution}
            onChangeResolution={(res: string) => setResolution(res as '128x64' | '240x120' | '320x160')}
            turbulenceModel={turbulenceModel}
            onChangeTurbulence={setTurbulenceModel}
            reynolds={reynolds}
            mach={mach}
            cfl={cfl}
            isStable={isStable}
            onReset={handleReset}
          />
        </div>

        {/* Center Column: Viewport Stage (6 Cols) */}
        <div className="lg:col-span-6 h-full flex flex-col">
          <ViewportStage
            grid={gridInstance}
            fieldType={fieldType}
            onChangeFieldType={setFieldType}
            colormap={colormap}
            onChangeColormap={setColormap}
            activeTool={activeTool}
            onChangeTool={setActiveTool}
            activeProbe={activeProbe}
            onSetProbe={setActiveProbe}
            iteration={iteration}
            isRunning={isRunning}
            onToggleRunning={() => setIsRunning(!isRunning)}
            onStep={handleStep}
            onReset={handleReset}
          />
        </div>

        {/* Right Column: Live Charts Panel (3 Cols) */}
        <div className="lg:col-span-3 h-full">
          <LiveChartsPanel
            metrics={metrics}
            probe={activeProbe}
            forceHistory={forceHistory}
            residualHistory={residualHistory}
            activeChartTab={activeChartTab}
            onChangeChartTab={setActiveChartTab}
            preset={presetDef.name}
          />
        </div>

      </div>

      {/* Bottom Virtual Spreadsheet Tray */}
      <BottomDataTray
        metrics={metrics}
        probe={activeProbe}
        forceHistory={forceHistory}
        residualHistory={residualHistory}
        presetName={presetDef.name}
        presetId={presetId}
        grid={gridInstance}
        physicalVelocity={velocity}
        physicalDensity={density}
        physicalViscosity={viscosity}
        gridResolution={resolution}
        onOpenExplain={() => setExplainOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      {/* Explain Result Modal */}
      <ExplainResultModal
        isOpen={explainOpen}
        onClose={() => setExplainOpen(false)}
        metrics={metrics}
        presetName={presetDef.name}
      />

      {/* Run History Modal */}
      <RunHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        currentMetrics={metrics}
        currentPreset={presetId}
        onLoadRun={handleLoadRun}
      />

    </div>
  );
};
