import React from 'react';
import { Circle, SlidersHorizontal } from 'lucide-react';
import { cn } from '../lib/utils';
import type { VibeMode } from '../types';

interface ModeToggleProps {
  mode: VibeMode;
  onChange: (mode: VibeMode) => void;
  disabled?: boolean;
}

const OPTIONS: { value: VibeMode; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'basic', label: 'Basic', Icon: Circle },
  { value: 'advanced', label: 'Advanced', Icon: SlidersHorizontal },
];

export default function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Mixing mode"
      className={cn(
        "inline-flex items-center gap-1 p-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(value)}
            className={cn(
              "flex items-center gap-2 h-10 px-5 rounded-full text-xs font-semibold transition-all",
              active
                ? "bg-white/10 text-white shadow-inner shadow-white/5 border border-white/15"
                : "text-white/50 hover:text-white/80 border border-transparent"
            )}
          >
            <Icon className={cn("w-4 h-4", active ? "text-indigo-300" : "text-white/40")} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
