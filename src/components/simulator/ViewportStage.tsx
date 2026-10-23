import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Camera, 
  Maximize2, 
  Circle, 
  Square, 
  PenTool, 
  Eraser, 
  Trash2, 
  Crosshair, 
  Video, 
  Activity,
  Layers,
  Eye
} from 'lucide-react';
import { FieldType, ColormapType, ObstacleTool, ProbePoint } from '../../solver/types';
import { LBMGrid } from '../../solver/lbmCore';
import { getColormapRgb } from '../../solver/colorMaps';

interface ViewportStageProps {
  grid: LBMGrid;
  fieldType: FieldType;
  onChangeFieldType: (f: FieldType) => void;
  colormap: ColormapType;
  onChangeColormap: (cm: ColormapType) => void;
  activeTool: ObstacleTool;
  onChangeTool: (tool: ObstacleTool) => void;
  activeProbe: ProbePoint | null;
  onSetProbe: (probe: ProbePoint | null) => void;
  iteration: number;
  isRunning: boolean;
  onToggleRunning: () => void;
  onStep: () => void;
  onReset: () => void;
}

export const ViewportStage: React.FC<ViewportStageProps> = ({
  grid,
  fieldType,
  onChangeFieldType,
  colormap,
  onChangeColormap,
  activeTool,
  onChangeTool,
  activeProbe,
  onSetProbe,
  iteration,
  isRunning,
  onToggleRunning,
  onStep,
  onReset,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMouseDownRef = useRef(false);
  const [minVal, setMinVal] = useState(0);
  const [maxVal, setMaxVal] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Particles for streamlines / streakline visualization
  const particlesRef = useRef<{ x: number; y: number; age: number; maxAge: number }[]>([]);

  useEffect(() => {
    // Initialize 220 streamline particles
    const list = [];
    for (let i = 0; i < 220; i++) {
      list.push({
        x: Math.random() * grid.nx,
        y: Math.random() * grid.ny,
        age: Math.random() * 80,
        maxAge: 60 + Math.random() * 60,
      });
    }
    particlesRef.current = list;
  }, [grid.nx, grid.ny]);

  // Handle canvas mouse events for drawing obstacles or dropping probes
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = grid.nx / rect.width;
    const scaleY = grid.ny / rect.height;

    const gx = Math.floor((e.clientX - rect.left) * scaleX);
    const gy = Math.floor((e.clientY - rect.top) * scaleY);

    if (gx < 0 || gx >= grid.nx || gy < 0 || gy >= grid.ny) return;

    if (activeTool === 'probe') {
      const idx = gx + gy * grid.nx;
      const u = grid.u[idx];
      const v = grid.v[idx];
      const speed = Math.sqrt(u * u + v * v);
      const pressure = Math.round(101325 + (grid.rho[idx] - 1.0) * 1000);

      onSetProbe({
        id: 'probe-1',
        x: Number((gx / grid.nx).toFixed(3)),
        y: Number((gy / grid.ny).toFixed(3)),
        u: Number(u.toFixed(3)),
        v: Number(v.toFixed(3)),
        speed: Number(speed.toFixed(3)),
        pressure,
        vorticity: 0,
        history: [{ step: iteration, speed, pressure }],
      });
      return;
    }

    isMouseDownRef.current = true;
    applyToolAt(gx, gy);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMouseDownRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = grid.nx / rect.width;
    const scaleY = grid.ny / rect.height;

    const gx = Math.floor((e.clientX - rect.left) * scaleX);
    const gy = Math.floor((e.clientY - rect.top) * scaleY);

    if (gx >= 0 && gx < grid.nx && gy >= 0 && gy < grid.ny) {
      applyToolAt(gx, gy);
    }
  };

  const handleCanvasMouseUp = () => {
    isMouseDownRef.current = false;
  };

  const applyToolAt = (gx: number, gy: number) => {
    const brushRadius = activeTool === 'circle' ? 6 : activeTool === 'rect' ? 8 : 4;
    for (let dy = -brushRadius; dy <= brushRadius; dy++) {
      for (let dx = -brushRadius; dx <= brushRadius; dx++) {
        const x = gx + dx;
        const y = gy + dy;
        if (x >= 0 && x < grid.nx && y >= 0 && y < grid.ny) {
          const idx = x + y * grid.nx;
          if (activeTool === 'erase') {
            grid.obstacle[idx] = 0;
          } else if (activeTool === 'circle') {
            if (dx * dx + dy * dy <= brushRadius * brushRadius) {
              grid.obstacle[idx] = 1;
            }
          } else if (activeTool === 'rect') {
            grid.obstacle[idx] = 1;
          } else if (activeTool === 'draw') {
            if (dx * dx + dy * dy <= brushRadius * brushRadius) {
              grid.obstacle[idx] = 1;
            }
          }
        }
      }
    }
  };

  // High-performance canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nx = grid.nx;
    const ny = grid.ny;

    // Buffer for imageData
    const imgData = ctx.createImageData(nx, ny);
    const data = imgData.data;

    let animId: number;

    const render = () => {
      // Find min and max for normalization
      let localMin = Infinity;
      let localMax = -Infinity;

      for (let idx = 0; idx < grid.size; idx++) {
        if (grid.obstacle[idx] === 1) continue;

        let val = 0;
        if (fieldType === 'velocity' || fieldType === 'streamlines' || fieldType === 'vectors') {
          const u = grid.u[idx];
          const v = grid.v[idx];
          val = Math.sqrt(u * u + v * v);
        } else if (fieldType === 'pressure') {
          val = grid.rho[idx] / 3; // p = c_s^2 * rho
        } else {
          // Vorticity: dv/dx - du/dy
          const x = idx % nx;
          const y = Math.floor(idx / nx);
          if (x > 0 && x < nx - 1 && y > 0 && y < ny - 1) {
            const dv_dx = (grid.v[x + 1 + y * nx] - grid.v[x - 1 + y * nx]) * 0.5;
            const du_dy = (grid.u[x + (y + 1) * nx] - grid.u[x + (y - 1) * nx]) * 0.5;
            val = Math.abs(dv_dx - du_dy);
          }
        }

        if (val < localMin) localMin = val;
        if (val > localMax) localMax = val;
      }

      if (localMin === Infinity) {
        localMin = 0;
        localMax = 0.1;
      }
      const range = localMax - localMin || 1;

      setMinVal(Number(localMin.toFixed(3)));
      setMaxVal(Number(localMax.toFixed(3)));

      // Render pixels
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
          const idx = x + y * nx;
          const pxIdx = (x + (ny - 1 - y) * nx) * 4; // Flip y for standard cartesian

          if (grid.obstacle[idx] === 1) {
            // Dark gray obstacle with cyan border
            data[pxIdx] = 30;
            data[pxIdx + 1] = 41;
            data[pxIdx + 2] = 59;
            data[pxIdx + 3] = 255;
            continue;
          }

          let val = 0;
          if (fieldType === 'velocity' || fieldType === 'streamlines' || fieldType === 'vectors') {
            const u = grid.u[idx];
            const v = grid.v[idx];
            val = Math.sqrt(u * u + v * v);
          } else if (fieldType === 'pressure') {
            val = grid.rho[idx] / 3;
          } else {
            // Vorticity
            if (x > 0 && x < nx - 1 && y > 0 && y < ny - 1) {
              const dv_dx = (grid.v[x + 1 + y * nx] - grid.v[x - 1 + y * nx]) * 0.5;
              const du_dy = (grid.u[x + (y + 1) * nx] - grid.u[x + (y - 1) * nx]) * 0.5;
              val = Math.abs(dv_dx - du_dy);
            }
          }

          const norm = (val - localMin) / range;
          const [r, g, b] = getColormapRgb(norm, colormap);

          data[pxIdx] = r;
          data[pxIdx + 1] = g;
          data[pxIdx + 2] = b;
          data[pxIdx + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Draw vector arrows if vectors enabled
      if (fieldType === 'vectors') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1;
        const step = 8;
        for (let y = step; y < ny; y += step) {
          for (let x = step; x < nx; x += step) {
            const idx = x + y * nx;
            if (grid.obstacle[idx] === 1) continue;
            const u = grid.u[idx] * 40;
            const v = grid.v[idx] * 40;
            const screenY = ny - 1 - y;

            ctx.beginPath();
            ctx.moveTo(x, screenY);
            ctx.lineTo(x + u, screenY - v);
            ctx.stroke();
          }
        }
      }

      // Draw particle streamlines if streamlines mode
      if (fieldType === 'streamlines') {
        const particles = particlesRef.current;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const gx = Math.floor(p.x);
          const gy = Math.floor(p.y);

          if (gx >= 0 && gx < nx && gy >= 0 && gy < ny) {
            const idx = gx + gy * nx;
            const u = grid.u[idx];
            const v = grid.v[idx];
            p.x += u * 4;
            p.y += v * 4;
            p.age++;

            const screenY = ny - 1 - p.y;
            ctx.fillRect(p.x, screenY, 1.5, 1.5);
          }

          if (p.x >= nx || p.x < 0 || p.y >= ny || p.y < 0 || p.age >= p.maxAge) {
            particles[i] = {
              x: 0,
              y: Math.random() * ny,
              age: 0,
              maxAge: 60 + Math.random() * 60,
            };
          }
        }
      }

      // Draw active probe crosshair
      if (activeProbe) {
        const px = activeProbe.x * nx;
        const py = ny - 1 - activeProbe.y * ny;

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.moveTo(px - 10, py);
        ctx.lineTo(px + 10, py);
        ctx.moveTo(px, py - 10);
        ctx.lineTo(px, py + 10);
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [grid, fieldType, colormap, activeProbe]);

  // Screenshot export handler
  const handleScreenshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `aethercfd-field-step${iteration}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Fullscreen toggle handler
  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative flex-1 flex flex-col bg-[#05080e] overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10"
    >
      
      {/* Top Viewport Toolbar */}
      <div className="px-4 py-2 bg-slate-950/80 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs z-10 font-mono">
        
        {/* Field Mode Picker */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
          {[
            { id: 'velocity' as FieldType, label: 'Velocity |U|' },
            { id: 'pressure' as FieldType, label: 'Pressure P' },
            { id: 'vorticity' as FieldType, label: 'Vorticity ω' },
            { id: 'streamlines' as FieldType, label: 'Streamlines' },
            { id: 'vectors' as FieldType, label: 'Vectors' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => onChangeFieldType(f.id)}
              className={`px-2.5 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                fieldType === f.id
                  ? 'bg-cyan-500 text-black font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Colormap Selector */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-[10px]">COLORMAP:</span>
          {(['viridis', 'turbo', 'coolwarm'] as ColormapType[]).map((cm) => (
            <button
              key={cm}
              onClick={() => onChangeColormap(cm)}
              className={`px-2 py-0.5 rounded text-[11px] capitalize border transition-colors cursor-pointer ${
                colormap === cm
                  ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              {cm}
            </button>
          ))}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleScreenshot}
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
            title="Download PNG Screenshot"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFullscreen}
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Canvas Stage */}
      <div className="relative flex-1 flex items-center justify-center p-3 overflow-hidden">
        
        <canvas
          ref={canvasRef}
          width={grid.nx}
          height={grid.ny}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          className="w-full h-full object-contain rounded-lg border border-white/10 shadow-2xl cursor-crosshair"
        />

        {/* Floating Obstacle & Probe Tool Palette (Top Left) */}
        <div className="absolute top-6 left-6 glass-panel rounded-xl p-1.5 border border-white/10 flex flex-col gap-1.5 z-20 shadow-xl">
          <button
            onClick={() => onChangeTool('probe')}
            className={`p-2 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer ${
              activeTool === 'probe' ? 'bg-amber-500 text-black font-bold' : 'text-slate-300 hover:bg-white/10'
            }`}
            title="Probe Tool: Click anywhere on mesh to inspect values"
          >
            <Crosshair className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px] font-mono">Probe</span>
          </button>

          <button
            onClick={() => onChangeTool('draw')}
            className={`p-2 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer ${
              activeTool === 'draw' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-300 hover:bg-white/10'
            }`}
            title="Draw Solid Obstacle"
          >
            <PenTool className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px] font-mono">Draw</span>
          </button>

          <button
            onClick={() => onChangeTool('circle')}
            className={`p-2 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer ${
              activeTool === 'circle' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-300 hover:bg-white/10'
            }`}
            title="Add Circular Cylinder Obstacle"
          >
            <Circle className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px] font-mono">Circle</span>
          </button>

          <button
            onClick={() => onChangeTool('rect')}
            className={`p-2 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer ${
              activeTool === 'rect' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-300 hover:bg-white/10'
            }`}
            title="Add Rectangular Obstacle"
          >
            <Square className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px] font-mono">Square</span>
          </button>

          <button
            onClick={() => onChangeTool('erase')}
            className={`p-2 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer ${
              activeTool === 'erase' ? 'bg-rose-500 text-white font-bold' : 'text-slate-300 hover:bg-white/10'
            }`}
            title="Erase Obstacle"
          >
            <Eraser className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px] font-mono">Eraser</span>
          </button>

          <button
            onClick={() => grid.clearObstacles()}
            className="p-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer"
            title="Clear All Obstacles"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px] font-mono">Clear</span>
          </button>
        </div>

        {/* Color Legend (Bottom Left) */}
        <div className="absolute bottom-6 left-6 glass-panel px-3.5 py-2 rounded-xl text-[10px] font-mono border border-white/10 shadow-lg z-20">
          <div className="text-slate-400 mb-1 flex justify-between">
            <span className="uppercase">{fieldType}</span>
            <span>{minVal} → {maxVal}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-400">{minVal}</span>
            <div className="w-28 h-2 rounded bg-gradient-to-r from-blue-600 via-cyan-400 to-amber-500" />
            <span className="text-amber-400">{maxVal}</span>
          </div>
        </div>

        {/* Live Probe HUD Card (Top Right) */}
        {activeProbe && (
          <div className="absolute top-6 right-6 glass-panel p-3.5 rounded-xl border border-amber-500/30 text-xs font-mono shadow-xl z-20 space-y-1.5">
            <div className="flex items-center justify-between text-amber-400 font-bold border-b border-white/10 pb-1">
              <span className="flex items-center gap-1">
                <Crosshair className="w-3.5 h-3.5" />
                ACTIVE PROBE P1
              </span>
              <button onClick={() => onSetProbe(null)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <div className="text-slate-300">Pos: X={activeProbe.x}, Y={activeProbe.y}</div>
            <div className="text-white">Velocity |U|: <span className="text-cyan-300 font-bold">{activeProbe.speed} m/s</span></div>
            <div className="text-white">Pressure: <span className="text-amber-300 font-bold">{activeProbe.pressure} Pa</span></div>
          </div>
        )}

      </div>

    </div>
  );
};
