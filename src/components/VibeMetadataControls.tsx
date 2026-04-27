import React from 'react';
import { cn } from '../lib/utils';

interface VibeMetadataControlsProps {
  genre: string;
  country: string;
  customInstructions: string;
  genres: readonly string[];
  countries: readonly string[];
  onGenreChange: (genre: string) => void;
  onCountryChange: (country: string) => void;
  onCustomInstructionsChange: (value: string) => void;
  disabled?: boolean;
}

export default function VibeMetadataControls({
  genre,
  country,
  customInstructions,
  genres,
  countries,
  onGenreChange,
  onCountryChange,
  onCustomInstructionsChange,
  disabled,
}: VibeMetadataControlsProps) {
  return (
    <div className={cn("w-full max-w-3xl grid grid-cols-1 md:grid-cols-3 gap-4", disabled && "opacity-50")}>
      <div className="md:col-span-1">
        <div className="text-[11px] text-white/40 mb-2 uppercase tracking-widest">Genre</div>
        <div className="grid grid-cols-2 gap-1.5">
          {genres.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => onGenreChange(g)}
              disabled={disabled}
              className={cn(
                "h-9 text-[10px] uppercase tracking-widest border transition-all rounded-md",
                genre === g
                  ? "bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                  : "bg-white/5 text-white/40 border-white/10 hover:text-white/60",
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="md:col-span-1 flex flex-col">
        <div className="text-[11px] text-white/40 mb-2 uppercase tracking-widest">Culture</div>
        <select
          value={country || 'Global'}
          onChange={(e) => onCountryChange(e.target.value)}
          disabled={disabled}
          className="h-10 bg-white/5 border border-white/10 rounded-md px-3 text-xs text-white appearance-none transition-all hover:bg-white/10"
        >
          {countries.map(c => <option key={c} value={c} className="bg-[#0a0a0a]">{c}</option>)}
        </select>
      </div>

      <div className="md:col-span-1 flex flex-col">
        <div className="text-[11px] text-white/40 mb-2 uppercase tracking-widest">Custom Style</div>
        <textarea
          value={customInstructions}
          onChange={(e) => onCustomInstructionsChange(e.target.value)}
          disabled={disabled}
          placeholder="e.g. heavy distortion, cinematic strings..."
          className="flex-1 min-h-[80px] bg-white/5 border border-white/10 rounded-md p-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-all resize-none custom-scrollbar"
        />
      </div>
    </div>
  );
}
