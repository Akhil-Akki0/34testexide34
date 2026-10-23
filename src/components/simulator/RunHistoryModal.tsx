import React, { useState, useEffect } from 'react';
import { X, Trash2, Play, Bookmark, Clock, Check, Download, Upload, Share2 } from 'lucide-react';
import { SavedRun, PresetId, SimulationMetrics } from '../../solver/types';

interface RunHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMetrics: SimulationMetrics;
  currentPreset: PresetId;
  onLoadRun: (run: SavedRun) => void;
}

const STORAGE_KEY = 'aethercfd_saved_runs';

export const RunHistoryModal: React.FC<RunHistoryModalProps> = ({
  isOpen,
  onClose,
  currentMetrics,
  currentPreset,
  onLoadRun,
}) => {
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [newRunName, setNewRunName] = useState('');
  const [newRunNotes, setNewRunNotes] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRuns(JSON.parse(stored));
      } else {
        // Sample default runs
        const initial: SavedRun[] = [
          {
            id: 'run-1',
            timestamp: 'Today at 04:12 PM',
            name: 'Kármán Shedding Re=150 Verification',
            preset: 'cylinder_karman',
            reynolds: 150,
            cdAvg: 1.182,
            clAmp: 0.238,
            convergenceStatus: 'L2 < 10^-5 (Converged)',
            notes: 'Baseline circular cylinder trial matching Williamson 1989 Strouhal number.',
          },
          {
            id: 'run-2',
            timestamp: 'Yesterday at 09:30 AM',
            name: 'NACA 0012 Alpha=6° Polar Sweep',
            preset: 'airfoil_naca',
            reynolds: 100000,
            cdAvg: 0.024,
            clAmp: 0.605,
            convergenceStatus: 'Converged',
            notes: 'Boundary layer suction peak and trailing-edge stagnation verified.',
          },
        ];
        setRuns(initial);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      }
    } catch {
      // Ignore storage errors in sandbox
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveCurrentRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRunName.trim()) return;

    const newRun: SavedRun = {
      id: `run-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      name: newRunName.trim(),
      preset: currentPreset,
      reynolds: currentMetrics.reynolds,
      cdAvg: Number(currentMetrics.cd.toFixed(3)),
      clAmp: Number(currentMetrics.cl.toFixed(3)),
      convergenceStatus: currentMetrics.residualL2 < 1e-4 ? 'Converged' : 'Iterating',
      notes: newRunNotes.trim() || 'Custom aerodynamic trial.',
    };

    const updated = [newRun, ...runs];
    setRuns(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setNewRunName('');
    setNewRunNotes('');
  };

  const handleDeleteRun = (id: string) => {
    const updated = runs.filter((r) => r.id !== id);
    setRuns(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleShareUrl = () => {
    const url = `${window.location.origin}/?preset=${currentPreset}&re=${currentMetrics.reynolds}`;
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 text-xs font-mono"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-3xl glass-panel rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-white font-sans">Run History & Parametric Comparison</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleShareUrl}
              className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300 hover:text-white flex items-center gap-1.5"
            >
              {shareCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{shareCopied ? 'URL Copied' : 'Share Configuration URL'}</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form: Save Current Run */}
        <form onSubmit={handleSaveCurrentRun} className="p-4 bg-slate-900/60 border-b border-white/10 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={newRunName}
            onChange={(e) => setNewRunName(e.target.value)}
            placeholder="Save current run name (e.g. 'Airfoil Alpha 8° Sweep')..."
            className="flex-1 p-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
          />
          <input
            type="text"
            value={newRunNotes}
            onChange={(e) => setNewRunNotes(e.target.value)}
            placeholder="Optional technical notes..."
            className="flex-1 p-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-semibold text-xs transition-colors shrink-0 cursor-pointer"
          >
            Save Run
          </button>
        </form>

        {/* Saved Runs List */}
        <div className="flex-1 p-6 overflow-y-auto divide-y divide-white/5 space-y-4">
          {runs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No saved runs yet. Click "Save Run" above to bookmark your current simulation results.
            </div>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="pt-4 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm font-sans">{run.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 uppercase">
                      {run.preset}
                    </span>
                    <span className="text-[10px] text-slate-500">{run.timestamp}</span>
                  </div>

                  <p className="text-slate-400 text-xs line-clamp-1">{run.notes}</p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-300 pt-1">
                    <span>Re: <strong className="text-cyan-300">{run.reynolds.toLocaleString()}</strong></span>
                    <span>Cd: <strong className="text-amber-400">{run.cdAvg}</strong></span>
                    <span>Cl: <strong className="text-cyan-400">{run.clAmp}</strong></span>
                    <span className="text-emerald-400">{run.convergenceStatus}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      onLoadRun(run);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Load Setup</span>
                  </button>

                  <button
                    onClick={() => handleDeleteRun(run.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Delete run"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-950/80 flex items-center justify-between text-slate-400">
          <span>Saved locally in browser localStorage (air-gapped privacy)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
