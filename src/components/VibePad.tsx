/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface VibePadProps {
  title: string;
  xValue: number;
  yValue: number;
  onChange: (x: number, y: number) => void;
  labels: { top: string, bottom: string, left: string, right: string };
  disabled: boolean;
  gradientClass: string;
  dotClass: string;
}

export default function VibePad({ title, xValue, yValue, onChange, labels, disabled, gradientClass, dotClass }: VibePadProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleInteraction = useCallback((clientX: number, clientY: number) => {
    if (disabled || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    onChange(
      Math.max(-1, Math.min(1, x * 2 - 1)),
      Math.max(-1, Math.min(1, (1 - y) * 2 - 1))
    );
  }, [disabled, onChange]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    
    const handlePointerMove = (moveEvent: PointerEvent) => {
      handleInteraction(moveEvent.clientX, moveEvent.clientY);
    };
    
    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    handleInteraction(e.clientX, e.clientY);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <h3 className="text-[11px] font-bold text-white/50 tracking-[0.2em]">{title}</h3>
      <div 
        ref={containerRef}
        onPointerDown={onPointerDown}
        className={cn(
          "relative w-[220px] h-[220px] lg:w-[260px] lg:h-[260px] xl:w-[320px] xl:h-[320px] rounded-full border-2 border-white/10 shrink-0 select-none overflow-hidden transition-colors",
          gradientClass,
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-crosshair hover:border-white/20"
        )}
        style={{ touchAction: 'none' }}
      >
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

        {/* Axes */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/10 -translate-x-1/2" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10 -translate-y-1/2" />
        
        {/* Center marker */}
        <div className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full border border-white/20 -translate-x-1/2 -translate-y-1/2 bg-black/50" />

        {/* Labels */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[9px] font-bold tracking-widest text-white/60 drop-shadow-md">{labels.top}</div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-bold tracking-widest text-white/60 drop-shadow-md">{labels.bottom}</div>
        <div className="absolute left-10 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-bold tracking-widest text-white/60 -rotate-90 drop-shadow-md whitespace-nowrap">{labels.left}</div>
        <div className="absolute right-10 top-1/2 translate-x-1/2 -translate-y-1/2 text-[9px] font-bold tracking-widest text-white/60 rotate-90 drop-shadow-md whitespace-nowrap">{labels.right}</div>

        {/* Active Point */}
        <motion.div 
          className={cn("absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-lg z-10", dotClass)}
          animate={{
            left: `${(xValue + 1) * 50}%`,
            top: `${(1 - yValue) * 50}%`
          }}
          transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.5 }}
        >
          <div className="absolute inset-2 bg-white rounded-full animate-pulse opacity-50" />
        </motion.div>
      </div>
    </div>
  );
}
