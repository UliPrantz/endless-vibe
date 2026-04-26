/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  Volume2, 
  Settings2, 
  ChevronDown
} from 'lucide-react';
import { Song, VibeState, GenerationStatus, PlaylistState } from './types';
import { generateSong, fetchLyriaModels } from './services/musicService';
import { cn } from './lib/utils';
import VibePad from './components/VibePad';
import SidebarQueue from './components/SidebarQueue';
import APIKeyOverlay from './components/APIKeyOverlay';

const GENRES = ['Pop', 'Rap', 'Techno', 'Schlager', 'Rock', 'Classical'];
const COUNTRIES = ['Global', 'USA', 'UK', 'Japan', 'Brazil', 'Germany', 'France', 'India', 'South Korea'];

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  // --- Refs ---
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);
  const isCrossfadingRef = useRef(false);
  const generationIdRef = useRef(0);

  // --- State ---
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [showKeyError, setShowKeyError] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  
  const [draftVibe, setDraftVibe] = useState<VibeState>({
    valence: 0, arousal: 0, acousticness: 0, complexity: 0, genre: 'Pop', country: 'Global', customInstructions: ''
  });
  const [activeVibe, setActiveVibe] = useState<VibeState>(draftVibe);
  const [songsSinceLastChange, setSongsSinceLastChange] = useState(0);
  const [audioModel, setAudioModel] = useState("lyria-3-pro-preview");
  const [lyriaModels, setLyriaModels] = useState<string[]>([]);
  const [generationAttempts, setGenerationAttempts] = useState(0);

  const [playlist, setPlaylist] = useState<PlaylistState>({
    history: [], currentSong: null, nextSong: null, status: GenerationStatus.IDLE
  });

  const [crossfadeDuration, setCrossfadeDuration] = useState(2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isChangingVibe, setIsChangingVibe] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
  const [songA, setSongA] = useState<Song | null>(null);
  const [songB, setSongB] = useState<Song | null>(null);

  // --- Helpers ---
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Actions ---
  const handleSkip = useCallback(() => {
    setPlaylist(prev => {
      if (!prev.currentSong && !prev.nextSong) return prev;

      const nextHistory = prev.currentSong 
        ? [prev.currentSong, ...prev.history].slice(0, 50) 
        : prev.history;

      return {
        ...prev,
        history: nextHistory,
        currentSong: prev.nextSong,
        nextSong: null,
        status: GenerationStatus.IDLE,
      };
    });

    setSongsSinceLastChange(s => s + 1);
    setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
    setProgress(0);
    setDuration(0);
    isCrossfadingRef.current = false;
  }, []);

  const triggerNextGeneration = useCallback(async (currentVibe: VibeState, modelToUse: string, evolutionDepth: number) => {
    if (hasApiKey === false) return;
    
    generationIdRef.current += 1;
    const currentGenId = generationIdRef.current;

    setPlaylist(prev => ({ ...prev, status: GenerationStatus.GENERATING }));
    
    let attempts = 0;
    const maxAttempts = 5;
    let newSong: Song | null = null;
    let lastError: any = null;

    setGenerationAttempts(1);
    while (attempts < maxAttempts && !newSong) {
      if (generationIdRef.current !== currentGenId) return; // Stale generation aborted

      try {
        attempts++;
        setGenerationAttempts(attempts);
        newSong = await generateSong(currentVibe, modelToUse, evolutionDepth);
      } catch (error: any) {
        lastError = error;
        if (error?.message?.includes("PERMISSION_DENIED") || error?.message?.includes("not found")) break;
      }
    }

    if (generationIdRef.current !== currentGenId) return; // Stale generation aborted

    if (newSong) {
      const songRef = newSong;
      try {
        const audio = new Audio(songRef.url);
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, 3000);
          audio.onloadedmetadata = () => { songRef.duration = audio.duration; clearTimeout(t); resolve(); };
          audio.onerror = () => { clearTimeout(t); resolve(); };
        });
      } catch (e) { console.error("Duration extraction failed", e); }

      if (generationIdRef.current !== currentGenId) return; // Re-check after await

      setPlaylist(prev => {
        if (!prev.currentSong) {
          return { ...prev, currentSong: songRef, status: GenerationStatus.IDLE };
        }
        if (prev.nextSong) URL.revokeObjectURL(prev.nextSong.url);
        return { ...prev, nextSong: songRef, status: GenerationStatus.READY };
      });
      setIsChangingVibe(false);
    } else {
      const isAuthErr = lastError?.message?.includes("PERMISSION_DENIED") || lastError?.message?.includes("not found");
      if (isAuthErr) setHasApiKey(false);
      setApiErrorMessage(isAuthErr ? "Lyria access required. Check GCP project & billing." : (lastError?.message || "Generation failed."));
      setShowKeyError(true);
      setPlaylist(prev => ({ ...prev, status: GenerationStatus.ERROR }));
    }
  }, [hasApiKey]);

  // --- Players Sync ---
  useEffect(() => {
    // We aggressively assign the NEW song to the INACTIVE player so it preloads!
    // We strictly preserve the old song for the ACTIVE player until it swaps out, so fades complete.
    if (activePlayer === 'A') {
      if (playlist.currentSong && songA?.id !== playlist.currentSong.id) setSongA(playlist.currentSong);
      if (playlist.nextSong && songB?.id !== playlist.nextSong.id) setSongB(playlist.nextSong);
    } else {
      if (playlist.currentSong && songB?.id !== playlist.currentSong.id) setSongB(playlist.currentSong);
      if (playlist.nextSong && songA?.id !== playlist.nextSong.id) setSongA(playlist.nextSong);
    }
  }, [playlist.currentSong, playlist.nextSong, activePlayer, songA?.id, songB?.id]);

  const useFadingEffect = (player: 'A' | 'B', audioRef: React.RefObject<HTMLAudioElement | null>) => {
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      let interval: NodeJS.Timeout;

      if (activePlayer === player) {
        if (isPlaying) {
          audio.play().catch(error => {
            if (error.name === 'NotAllowedError') {
              console.warn("Autoplay blocked. User must interact first.");
              setIsPlaying(false);
            }
          });
          
          let vol = audio.volume;
          const step = 50;
          interval = setInterval(() => {
            vol = Math.min(1, vol + step / (crossfadeDuration * 1000 || 1));
            audio.volume = crossfadeDuration > 0 ? vol : 1;
            if (vol >= 1 || crossfadeDuration === 0) clearInterval(interval);
          }, step);
        } else {
          audio.pause();
        }
      } else {
        // Inactive player fades out. DO NOT instantly pause.
        let vol = audio.volume;
        const step = 50;
        interval = setInterval(() => {
          vol = Math.max(0, vol - step / (crossfadeDuration * 1000 || 1));
          audio.volume = crossfadeDuration > 0 ? vol : 0;
          if (vol <= 0 || crossfadeDuration === 0) {
            clearInterval(interval);
            audio.pause(); 
            audio.currentTime = 0; // Essential string-tie for the leap-frog alternating race conditions
          }
        }, step);
      }
      return () => { if (interval) clearInterval(interval); };
    }, [activePlayer, crossfadeDuration, isPlaying, player, audioRef]);
  };

  useFadingEffect('A', audioRefA);
  useFadingEffect('B', audioRefB);

  const checkCrossfade = useCallback((cTime: number, tDuration: number) => {
    if (tDuration > 0 && playlist.nextSong && playlist.status === GenerationStatus.READY) {
      if (tDuration - cTime <= crossfadeDuration && !isCrossfadingRef.current) {
        isCrossfadingRef.current = true;
        handleSkip();
      }
    }
  }, [crossfadeDuration, playlist.nextSong, playlist.status, handleSkip]);

  const handleTimeUpdate = useCallback((player: 'A' | 'B') => {
    const audio = player === 'A' ? audioRefA.current : audioRefB.current;
    if (activePlayer === player && audio) {
      setProgress(audio.currentTime);
      if (audio.duration && audio.duration !== duration) {
        setDuration(audio.duration);
      }
      checkCrossfade(audio.currentTime, audio.duration);
    }
  }, [activePlayer, checkCrossfade, duration]);

  const handleLoadedMetadata = useCallback(() => {
    const activeRef = activePlayer === 'A' ? audioRefA.current : audioRefB.current;
    if (activeRef) setDuration(activeRef.duration);
  }, [activePlayer]);

  // --- Hooks ---
  useEffect(() => {
    const init = async () => {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
        if (hasKey) {
          const models = await fetchLyriaModels();
          if (models.length > 0) {
            setLyriaModels(models);
            setAudioModel(prev => models.includes(prev) ? prev : models[0]);
          }
        }
      } catch (e) { setHasApiKey(false); }
    };
    init();
  }, []);

  useEffect(() => {
    if (hasStarted && hasApiKey && !playlist.nextSong && playlist.status === GenerationStatus.IDLE) {
      triggerNextGeneration(activeVibe, audioModel, songsSinceLastChange);
    }
  }, [hasStarted, hasApiKey, playlist.nextSong, playlist.status, triggerNextGeneration, activeVibe, audioModel, songsSinceLastChange]);

  return (
    <div className="h-screen bg-[#050505] text-slate-200 flex flex-col font-sans overflow-hidden">
      <APIKeyOverlay 
        show={showKeyError} 
        message={apiErrorMessage} 
        onClose={() => setShowKeyError(false)} 
        onSelectKey={async () => { await window.aistudio.openSelectKey(); setHasApiKey(true); setShowKeyError(false); }} 
      />

      <audio 
        ref={audioRefA} 
        src={songA?.url} 
        onEnded={() => activePlayer === 'A' && handleSkip()} 
        onLoadedMetadata={handleLoadedMetadata} 
        onPlay={() => activePlayer === 'A' && setIsPlaying(true)} 
        onPause={() => activePlayer === 'A' && setIsPlaying(false)}
        onTimeUpdate={() => handleTimeUpdate('A')} 
      />
      <audio 
        ref={audioRefB} 
        src={songB?.url} 
        onEnded={() => activePlayer === 'B' && handleSkip()} 
        onLoadedMetadata={handleLoadedMetadata} 
        onPlay={() => activePlayer === 'B' && setIsPlaying(true)} 
        onPause={() => activePlayer === 'B' && setIsPlaying(false)}
        onTimeUpdate={() => handleTimeUpdate('B')} 
      />

      <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-rose-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
          <h1 className="text-xl font-bold tracking-tighter uppercase italic text-white">Endless Vibe</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={async () => {
              await window.aistudio.openSelectKey();
              const keyStatus = await window.aistudio.hasSelectedApiKey();
              setHasApiKey(keyStatus);
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-[10px] font-bold uppercase tracking-widest",
              hasApiKey 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20" 
                : "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
            )}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", hasApiKey ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
            {hasApiKey ? "API Key Active" : "Setup API Key"}
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>

          <div className="h-4 w-px bg-white/10 mx-2"></div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Vibe Studio v1.5</div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <SidebarQueue playlist={playlist} isPlaying={isPlaying} generationAttempts={generationAttempts} maxAttempts={5} />

        <section className="flex-1 p-8 flex flex-col items-center justify-center relative overflow-x-hidden overflow-y-auto custom-scrollbar">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.03)_0%,_transparent_70%)] pointer-events-none"></div>
          
          <div className="flex flex-col xl:flex-row items-center justify-center gap-12 xl:gap-24 w-full max-w-5xl relative z-10 pt-4 pb-12">
            <VibePad 
              title="CIRCLE 1: MOOD" xValue={draftVibe.valence} yValue={draftVibe.arousal}
              onChange={(x, y) => { setDraftVibe(v => ({ ...v, valence: x, arousal: y })); setIsChangingVibe(true); }}
              labels={{ top: "HIGH ENERGY", bottom: "LOW ENERGY", left: "NEGATIVE", right: "POSITIVE" }}
              disabled={!hasApiKey || showKeyError}
              gradientClass="bg-gradient-to-tr from-[#381e72] via-[#ce484b] to-[#f0b029]"
              dotClass="bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.8)]"
            />
            <VibePad 
              title="CIRCLE 2: CHARACTER" xValue={draftVibe.acousticness || 0} yValue={draftVibe.complexity || 0}
              onChange={(x, y) => { setDraftVibe(v => ({ ...v, acousticness: x, complexity: y })); setIsChangingVibe(true); }}
              labels={{ top: "COMPLEX", bottom: "SIMPLE", left: "ACOUSTIC", right: "ELECTRONIC" }}
              disabled={!hasApiKey || showKeyError}
              gradientClass="bg-gradient-to-tr from-[#2d1b54] via-[#5c2a80] to-[#2eb868]"
              dotClass="bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.8)]"
            />
          </div>

          <motion.div key={playlist.currentSong?.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center mt-auto pb-8 z-10">
            <h3 className="text-3xl font-light italic mb-2 tracking-tight text-white capitalize">{playlist.currentSong?.genre || "Initializing"} Synthesis</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed h-10 overflow-hidden line-clamp-2">{playlist.currentSong?.description || "Curating your soundscape..."}</p>
          </motion.div>
        </section>

        <aside className="w-[300px] shrink-0 border-l border-white/5 bg-[#0a0a0a] p-6 flex flex-col overflow-hidden">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-8 flex items-center gap-2"><Settings2 className="w-3 h-3" /> Controller</h2>
          <div className="space-y-8 flex-1 overflow-y-auto custom-scrollbar pr-2 mb-6">
            <div>
              <div className="text-[11px] text-white/40 mb-3 uppercase tracking-widest">Generator</div>
              <select 
                value={audioModel} 
                onChange={(e) => {
                  setAudioModel(e.target.value);
                  setIsChangingVibe(true);
                }} 
                className="w-full h-12 bg-white/5 border border-white/10 rounded-lg px-4 text-xs text-white appearance-none transition-all hover:bg-white/10"
              >
                {lyriaModels.map(m => <option key={m} value={m} className="bg-[#0a0a0a]">{m}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[11px] text-white/40 mb-3 uppercase tracking-widest uppercase">Culture</div>
              <select 
                value={draftVibe.country || 'Global'} 
                onChange={(e) => {
                  setDraftVibe(v => ({ ...v, country: e.target.value }));
                  setIsChangingVibe(true);
                }} 
                className="w-full h-12 bg-white/5 border border-white/10 rounded-lg px-4 text-xs text-white appearance-none transition-all hover:bg-white/10"
              >
                {COUNTRIES.map(c => <option key={c} value={c} className="bg-[#0a0a0a]">{c}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[11px] text-white/40 mb-3 uppercase tracking-widest">Genre</div>
              <div className="grid grid-cols-2 gap-2">
                {GENRES.map(g => (
                  <button 
                    key={g} 
                    onClick={() => {
                      setDraftVibe(v => ({ ...v, genre: g }));
                      setIsChangingVibe(true);
                    }} 
                    className={cn("h-10 text-[10px] uppercase tracking-widest border transition-all rounded-lg", draftVibe.genre === g ? "bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.2)]" : "bg-white/5 text-white/40 border-white/10 hover:text-white/60")}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-white/40 mb-3 uppercase tracking-widest">Custom Style</div>
              <textarea 
                value={draftVibe.customInstructions} 
                onChange={(e) => {
                  setDraftVibe(v => ({ ...v, customInstructions: e.target.value }));
                  setIsChangingVibe(true);
                }}
                placeholder="e.g. Add heavy distortion, focus on cinematic strings..."
                className="w-full h-24 bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-all resize-none custom-scrollbar"
              />
            </div>
            <div>
              <div className="flex justify-between items-center text-[11px] text-white/40 mb-3 uppercase tracking-widest">
                <span>Crossfade</span>
                <span className="text-indigo-400 font-mono font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded">{crossfadeDuration}s</span>
              </div>
              <input type="range" min="0" max="5" step="0.5" value={crossfadeDuration} onChange={(e) => setCrossfadeDuration(parseFloat(e.target.value))} className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer" />
            </div>
            <button onClick={() => { 
                if (!hasStarted) setIsPlaying(true);
                setHasStarted(true); 
                setActiveVibe(draftVibe); 
                setSongsSinceLastChange(0);
                triggerNextGeneration(draftVibe, audioModel, 0); 
                setIsChangingVibe(false); 
              }}
                    disabled={(!isChangingVibe && playlist.status === GenerationStatus.GENERATING) || !hasApiKey || showKeyError}
                    className={cn(
                      "w-full h-14 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative overflow-hidden", 
                      (!hasApiKey || showKeyError || (!isChangingVibe && playlist.status === GenerationStatus.GENERATING)) 
                        ? "bg-neutral-900 text-neutral-600 grayscale" 
                        : isChangingVibe 
                          ? "bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] scale-[1.02] border-2 border-white/20" 
                          : "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 hover:bg-indigo-500"
                    )}>
              <span className="relative z-10">{(playlist.status === GenerationStatus.GENERATING && !isChangingVibe) ? "Generating..." : "Apply Vibe"}</span>
              {isChangingVibe && playlist.status !== GenerationStatus.GENERATING && (
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
                />
              )}
            </button>
          </div>

          <div className="pt-6 border-t border-white/5 mt-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-4">
                <button onClick={() => {
                  const activeRef = activePlayer === 'A' ? audioRefA.current : audioRefB.current;
                  if (activeRef) { if (isPlaying) activeRef.pause(); else activeRef.play(); setIsPlaying(!isPlaying); }
                }} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition-transform">
                  {isPlaying ? <Pause className="fill-current w-5 h-5" /> : <Play className="fill-current w-5 h-5 ml-1" />}
                </button>
                <button onClick={handleSkip} className="text-white/40 hover:text-white transition-colors"><SkipForward className="w-5 h-5" /></button>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-white/80">{formatTime(progress)} / {formatTime(duration)}</div>
                <div className={cn("text-[9px] font-mono tracking-tighter mt-1", playlist.nextSong ? "text-emerald-400" : "text-amber-400")}>
                  {playlist.nextSong ? `STABLE (${formatTime(playlist.nextSong.duration || 0)} Buffer)` : "REPLENISHING..."}
                </div>
              </div>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
              <motion.div className="absolute top-0 left-0 h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" animate={{ width: `${(progress / (duration || 1)) * 100}%` }} transition={{ type: "tween", ease: "linear" }} />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
