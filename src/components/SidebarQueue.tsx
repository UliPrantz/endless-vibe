/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, Music, Play, Loader2, AlertTriangle } from 'lucide-react';
import { PlaylistState, QueueItem } from '../types';
import { cn } from '../lib/utils';

interface SidebarQueueProps {
  playlist: PlaylistState;
  isPlaying: boolean;
  maxAttempts: number;
}

type Role = 'past' | 'current' | 'upcoming';

interface CardProps {
  item: QueueItem;
  role: Role;
  isPlaying: boolean;
  maxAttempts: number;
}

const QueueItemCard: React.FC<CardProps> = ({ item, role, isPlaying, maxAttempts }) => {
  if (item.status === 'pending') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="p-4 rounded-xl border-2 border-indigo-500/30 border-dashed bg-indigo-500/5 transition-all text-center w-full relative overflow-hidden flex flex-col items-center justify-center min-h-[5rem] shrink-0"
      >
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mb-2" />
        <div className="text-xs font-semibold italic text-indigo-300">Synthesizing Next...</div>
        {item.attempts > 1 && (
          <div className="text-[9px] text-amber-500 mt-1 uppercase tracking-widest bg-amber-500/20 px-1.5 py-0.5 rounded">
            Attempt {item.attempts}/{maxAttempts}
          </div>
        )}
      </motion.div>
    );
  }

  if (item.status === 'failed') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 transition-all w-full shrink-0"
      >
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-3 h-3 text-rose-400" />
          <div className="text-xs font-semibold italic text-rose-300">Generation Failed</div>
        </div>
        <p className="text-[10px] text-rose-200/70 leading-relaxed max-h-12 overflow-hidden text-ellipsis">
          {item.error || `Stopped after ${maxAttempts} attempts.`}
        </p>
      </motion.div>
    );
  }

  // status === 'ready'
  const song = item.song!;
  if (role === 'current') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="p-4 rounded-xl border border-indigo-500/50 bg-indigo-600/20 shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all w-full relative overflow-hidden shrink-0"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,1)]" />
        <div className="flex justify-between items-center mb-1 pl-2">
          <div className="text-xs font-bold italic text-white flex items-center gap-2">
            {isPlaying ? <Music className="w-3 h-3 text-indigo-400 animate-pulse" /> : <Play className="w-3 h-3 text-indigo-400" />}
            {song.genre} Session
          </div>
          <div className="text-[9px] uppercase tracking-wider text-indigo-200 font-bold px-1.5 py-0.5 bg-indigo-500/30 rounded">Playing</div>
        </div>
        <p className="text-[10px] text-white/80 leading-relaxed max-h-12 overflow-hidden text-ellipsis pl-2">
          {song.description}
        </p>
      </motion.div>
    );
  }

  if (role === 'upcoming') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 transition-all w-full shrink-0"
      >
        <div className="flex justify-between items-center mb-1">
          <div className="text-xs font-semibold italic text-emerald-400">{song.genre} Session</div>
          <div className="text-[9px] uppercase tracking-wider text-emerald-500 font-bold px-1.5 py-0.5 bg-emerald-500/20 rounded">Ready</div>
        </div>
        <p className="text-[10px] text-emerald-200/70 leading-relaxed max-h-12 overflow-hidden text-ellipsis">
          {song.description}
        </p>
      </motion.div>
    );
  }

  // role === 'past'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 0.5, x: 0 }}
      whileHover={{ opacity: 0.8 }}
      className="p-4 rounded-xl bg-white/5 border border-white/5 transition-all w-full grayscale shrink-0"
    >
      <div className="text-xs font-semibold mb-1 italic text-slate-300">{song.genre} Session</div>
      <p className="text-[10px] text-slate-500 leading-relaxed max-h-12 overflow-hidden text-ellipsis">
        {song.description}
      </p>
    </motion.div>
  );
};

export default function SidebarQueue({ playlist, isPlaying, maxAttempts }: SidebarQueueProps) {
  const isEmpty = playlist.items.length === 0;
  return (
    <aside className="w-[280px] lg:w-[320px] shrink-0 border-r border-white/5 bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="p-6 h-full flex flex-col">
        <h2 className={cn("text-[10px] uppercase tracking-[0.2em] text-white/40 mb-6 flex items-center gap-2")}>
          <History className="w-3 h-3" />
          Stream Queue
        </h2>
        <div className="flex-1 gap-4 overflow-y-auto custom-scrollbar pr-2 flex flex-col">
          <AnimatePresence>
            {playlist.items.map((item, i) => {
              const role: Role =
                i < playlist.cursor ? 'past' : i === playlist.cursor ? 'current' : 'upcoming';
              return (
                <QueueItemCard
                  key={item.id}
                  item={item}
                  role={role}
                  isPlaying={isPlaying}
                  maxAttempts={maxAttempts}
                />
              );
            })}
            {isEmpty && (
              <motion.div key="empty-segment" layout className="p-4 rounded-xl border border-white/5 border-dashed text-[10px] text-white/20 uppercase tracking-widest text-center py-12 w-full">
                Queue is empty
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}
