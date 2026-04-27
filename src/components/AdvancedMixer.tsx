import React from 'react';
import LockableSlider from './LockableSlider';
import { ALL_DIMS, BASE_DIMS, EXTRA_DIMS } from '../musicPipeline/dims';
import type { AdvancedDims, DimSliderState, RolledDimValues } from '../types';

interface AdvancedMixerProps {
  dims: AdvancedDims;
  currentSongRolled?: RolledDimValues;
  onChange: (dim: typeof ALL_DIMS[number], next: DimSliderState) => void;
  disabled?: boolean;
}

export default function AdvancedMixer({ dims, currentSongRolled, onChange, disabled }: AdvancedMixerProps) {
  return (
    <div className="w-full max-w-3xl bg-[#0a0a0a]/40 border border-white/5 rounded-2xl p-8 backdrop-blur-sm">
      <Section title="Core" hint="Mood & character — same axes as the Basic discs.">
        <Grid>
          {BASE_DIMS.map(dim => (
            <LockableSlider
              key={dim}
              dim={dim}
              state={dims[dim]}
              onChange={(next) => onChange(dim, next)}
              rolledValue={currentSongRolled?.[dim]}
              disabled={disabled}
            />
          ))}
        </Grid>
      </Section>

      <div className="h-px bg-white/5 my-6" />

      <Section title="Sound design" hint="Production parameters layered on top of the core.">
        <Grid>
          {EXTRA_DIMS.map(dim => (
            <LockableSlider
              key={dim}
              dim={dim}
              state={dims[dim]}
              onChange={(next) => onChange(dim, next)}
              rolledValue={currentSongRolled?.[dim]}
              disabled={disabled}
            />
          ))}
        </Grid>
      </Section>

      <p className="mt-6 text-[10px] text-white/30 leading-relaxed">
        Lock a slider to fix its value. Unlock to set a range — every new song
        will sample a random value within that range. The gray dot marks the
        value used for the song currently playing.
      </p>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/50">{title}</h3>
        <span className="text-[10px] text-white/30">{hint}</span>
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5">{children}</div>;
}
