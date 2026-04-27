import React, { useCallback } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { cn } from '../lib/utils';
import type { DimSliderState } from '../types';
import { DIM_META, type DimName } from '../musicPipeline/dims';

interface LockableSliderProps {
  dim: DimName;
  state: DimSliderState;
  onChange: (next: DimSliderState) => void;
  rolledValue?: number;
  disabled?: boolean;
}

const STEP = 0.01;
const MIN_GAP = 0.02; // keeps the two thumbs distinguishable when overlapping

const clamp = (n: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, n));
const pct = (v: number) => `${((clamp(v) + 1) * 50).toFixed(2)}%`;

const LockableSlider: React.FC<LockableSliderProps> = ({ dim, state, onChange, rolledValue, disabled }) => {
  const meta = DIM_META[dim];

  const toggleLock = useCallback(() => {
    if (state.locked) {
      // Unlocking: seed range around the current value.
      const halfWidth = 0.25;
      const min = clamp(state.value - halfWidth);
      const max = clamp(state.value + halfWidth);
      onChange({ ...state, locked: false, min, max });
    } else {
      // Locking: snap value to the midpoint of the current range.
      const value = clamp((state.min + state.max) / 2);
      onChange({ ...state, locked: true, value });
    }
  }, [state, onChange]);

  const handleSingleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...state, value: clamp(parseFloat(e.target.value)) });
  }, [state, onChange]);

  const handleMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = clamp(parseFloat(e.target.value));
    const min = Math.min(raw, state.max - MIN_GAP);
    onChange({ ...state, min: clamp(min) });
  }, [state, onChange]);

  const handleMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = clamp(parseFloat(e.target.value));
    const max = Math.max(raw, state.min + MIN_GAP);
    onChange({ ...state, max: clamp(max) });
  }, [state, onChange]);

  const readout = state.locked
    ? state.value.toFixed(2)
    : `${state.min.toFixed(2)} → ${state.max.toFixed(2)}`;

  return (
    <div className={cn(disabled && "opacity-50 pointer-events-none")}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-white/60 uppercase tracking-widest">{meta.label}</div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-indigo-300/80 bg-indigo-500/10 px-1.5 py-0.5 rounded">
            {readout}
          </span>
          <button
            type="button"
            onClick={toggleLock}
            disabled={disabled}
            aria-label={state.locked ? `Unlock ${meta.label} (enable random range)` : `Lock ${meta.label}`}
            title={state.locked ? "Unlock for random range per song" : "Lock to single value"}
            className={cn(
              "w-6 h-6 rounded-md border flex items-center justify-center transition-colors",
              state.locked
                ? "bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20"
                : "bg-indigo-500/15 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25"
            )}
          >
            {state.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <div className="relative h-6 flex items-center">
        {/* Track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-white/10 rounded-full" />

        {state.locked ? (
          <>
            {/* Filled portion from center for locked single thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-1 bg-indigo-500/40 rounded-full"
              style={{
                left: state.value >= 0 ? '50%' : pct(state.value),
                right: state.value >= 0 ? `calc(100% - ${pct(state.value)})` : '50%',
              }}
            />
            <input
              type="range"
              min={-1}
              max={1}
              step={STEP}
              value={state.value}
              onChange={handleSingleChange}
              disabled={disabled}
              className="relative w-full h-1 appearance-none bg-transparent accent-indigo-500 cursor-pointer"
            />
          </>
        ) : (
          <>
            {/* Filled portion between min and max */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-1 bg-indigo-500/40 rounded-full"
              style={{ left: pct(state.min), right: `calc(100% - ${pct(state.max)})` }}
            />
            <input
              type="range"
              min={-1}
              max={1}
              step={STEP}
              value={state.min}
              onChange={handleMinChange}
              disabled={disabled}
              className="dual-range absolute inset-x-0 h-6 w-full"
            />
            <input
              type="range"
              min={-1}
              max={1}
              step={STEP}
              value={state.max}
              onChange={handleMaxChange}
              disabled={disabled}
              className="dual-range absolute inset-x-0 h-6 w-full"
            />
          </>
        )}

        {/* Currently-playing indicator (gray dot) */}
        {rolledValue !== undefined && (
          <div
            aria-hidden
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/40 ring-1 ring-white/10 pointer-events-none"
            style={{ left: pct(rolledValue) }}
          />
        )}
      </div>

      <div className="flex justify-between mt-1.5 text-[9px] uppercase tracking-widest text-white/30">
        <span>{meta.negPole}</span>
        <span>{meta.posPole}</span>
      </div>
    </div>
  );
};

export default LockableSlider;
