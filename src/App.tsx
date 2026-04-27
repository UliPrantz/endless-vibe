/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, SkipForward, Settings2, ChevronDown } from 'lucide-react';
import type { AdvancedDims, DimSliderState, PlaylistState, VibeMode } from './types';
import type { PipelineEvent, ResolvedVibe } from './musicPipeline';
import { ALL_DIMS, resolveAdvancedVibe, resolveBasicVibe } from './musicPipeline';
import { fetchLyriaModels, generateSong } from './services/musicService';
import { clearStoredApiKey, getResolvedApiKey, setStoredApiKey } from './lib/apiKeyStore';
import {
  getCurrentSong,
  getNextReadySong,
  isAnyPending,
  upcomingReadyCount,
} from './playlist/selectors';
import {
  advance as advanceCursor,
  bumpAttempt,
  enqueuePending,
  initialPlaylist,
  markFailed,
  resolvePending,
} from './playlist/actions';
import { usePlaybackEngine } from './playback/usePlaybackEngine';
import { cn } from './lib/utils';
import VibePad from './components/VibePad';
import SidebarQueue from './components/SidebarQueue';
import APIKeyOverlay from './components/APIKeyOverlay';
import ModeToggle from './components/ModeToggle';
import AdvancedMixer from './components/AdvancedMixer';
import VibeMetadataControls from './components/VibeMetadataControls';

const MAX_GENERATION_ATTEMPTS = 5;
const GENRES = ['Pop', 'Rap', 'Techno', 'Schlager', 'Rock', 'Classical'];
const COUNTRIES = ['Global', 'USA', 'UK', 'Japan', 'Brazil', 'Germany', 'France', 'India', 'South Korea'];

const DEFAULT_DIM: DimSliderState = { locked: true, value: 0, min: -0.5, max: 0.5 };
function makeDefaultAdvanced(): AdvancedDims {
  const out = {} as AdvancedDims;
  for (const d of ALL_DIMS) out[d] = { ...DEFAULT_DIM };
  return out;
}

const formatTime = (seconds: number) => {
  if (Number.isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function App() {
  const generationIdRef = useRef(0);

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [showKeyError, setShowKeyError] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [showApiKeyEditor, setShowApiKeyEditor] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const [mode, setMode] = useState<VibeMode>('basic');
  const [activeMode, setActiveMode] = useState<VibeMode>('basic');

  const [metadata, setMetadata] = useState({ genre: 'Pop', country: 'Global', customInstructions: '' });

  const [draftBasicDims, setDraftBasicDims] = useState({ valence: 0, arousal: 0, acousticness: 0, complexity: 0 });
  const [activeBasicDims, setActiveBasicDims] = useState(draftBasicDims);

  const [draftAdvancedDims, setDraftAdvancedDims] = useState<AdvancedDims>(makeDefaultAdvanced);
  const [activeAdvancedDims, setActiveAdvancedDims] = useState<AdvancedDims>(draftAdvancedDims);

  const [songsSinceLastChange, setSongsSinceLastChange] = useState(0);
  const [audioModel, setAudioModel] = useState('lyria-3-pro-preview');
  const [lyriaModels, setLyriaModels] = useState<string[]>([]);

  const [playlist, setPlaylist] = useState<PlaylistState>(initialPlaylist);

  const [crossfadeDuration, setCrossfadeDuration] = useState(2);
  const [bufferDepth, setBufferDepth] = useState(1);
  const [isChangingVibe, setIsChangingVibe] = useState(false);

  const currentSong = getCurrentSong(playlist);
  const nextReadySong = getNextReadySong(playlist);

  const advanceCursorIfPossible = useCallback((): boolean => {
    let advanced = false;
    setPlaylist(prev => {
      const next = advanceCursor(prev);
      advanced = next.cursor !== prev.cursor;
      return next;
    });
    if (advanced) setSongsSinceLastChange(s => s + 1);
    return advanced;
  }, []);

  const playback = usePlaybackEngine({
    currentSong,
    nextReadySong,
    crossfadeDuration,
    onAdvance: advanceCursorIfPossible,
  });

  const refreshApiKeyStatus = useCallback(() => {
    const hasKey = Boolean(getResolvedApiKey());
    setHasApiKey(hasKey);
    return hasKey;
  }, []);

  const loadLyriaModels = useCallback(async () => {
    const models = await fetchLyriaModels();
    if (models.length > 0) {
      setLyriaModels(models);
      setAudioModel(prev => (models.includes(prev) ? prev : models[0]));
    }
  }, []);

  const triggerNextGeneration = useCallback(async (
    resolved: ResolvedVibe,
    modelToUse: string,
    evolutionDepth: number,
  ) => {
    if (hasApiKey === false) return;

    generationIdRef.current += 1;
    const currentGenId = generationIdRef.current;
    const itemId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    setPlaylist(prev => enqueuePending(prev, { id: itemId, generationId: currentGenId }));

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
      if (generationIdRef.current !== currentGenId) return;

      let newSong = null;
      try {
        newSong = await generateSong(resolved.inputs, modelToUse, evolutionDepth, {
          logger: (_event: PipelineEvent) => { /* intra-attempt pipeline retries are not surfaced here */ },
        });
        newSong.advancedValues = resolved.rolled;
        newSong.mode = resolved.mode;
      } catch (error) {
        lastError = error;
      }

      if (generationIdRef.current !== currentGenId) return;

      if (newSong) {
        const songRef = newSong;
        try {
          const probe = new Audio(songRef.url);
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, 3000);
            probe.onloadedmetadata = () => { songRef.duration = probe.duration; clearTimeout(t); resolve(); };
            probe.onerror = () => { clearTimeout(t); resolve(); };
          });
        } catch (e) { console.error('Duration extraction failed', e); }

        if (generationIdRef.current !== currentGenId) return;

        setPlaylist(prev => resolvePending(prev, itemId, songRef));
        setIsChangingVibe(false);
        return;
      }

      if (attempt < MAX_GENERATION_ATTEMPTS) {
        const errStr = lastError instanceof Error ? lastError.message : String(lastError || '');
        setPlaylist(prev => bumpAttempt(prev, itemId, errStr));
      }
    }

    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError || 'Generation failed.');
    const isAuthErr = errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('not found');
    if (isAuthErr) setHasApiKey(false);
    setApiErrorMessage(isAuthErr ? 'Lyria access required. Check GCP project & billing.' : errorMessage);
    setShowKeyError(true);
    setPlaylist(prev => markFailed(prev, itemId, errorMessage));
  }, [hasApiKey]);

  useEffect(() => {
    refreshApiKeyStatus();
  }, [refreshApiKeyStatus]);

  useEffect(() => {
    if (hasApiKey) loadLyriaModels();
  }, [hasApiKey, loadLyriaModels]);

  const buildActiveResolved = useCallback((): ResolvedVibe => {
    if (activeMode === 'advanced') {
      return resolveAdvancedVibe({ dims: activeAdvancedDims, ...metadata });
    }
    return resolveBasicVibe({ ...activeBasicDims, ...metadata });
  }, [activeMode, activeAdvancedDims, activeBasicDims, metadata]);

  // Buffer the next song(s) up to `bufferDepth`.
  useEffect(() => {
    if (!hasStarted || !hasApiKey) return;
    if (isAnyPending(playlist)) return;
    if (upcomingReadyCount(playlist) >= bufferDepth) return;
    triggerNextGeneration(buildActiveResolved(), audioModel, songsSinceLastChange);
  }, [hasStarted, hasApiKey, playlist, bufferDepth, triggerNextGeneration, buildActiveResolved, audioModel, songsSinceLastChange]);

  const handleApplyVibe = () => {
    if (!hasStarted) playback.start();
    setHasStarted(true);
    setActiveMode(mode);
    setActiveBasicDims(draftBasicDims);
    setActiveAdvancedDims(draftAdvancedDims);
    setSongsSinceLastChange(0);
    // Resolve from drafts directly: the active* setters above won't have
    // flushed by the time triggerNextGeneration runs.
    const resolved = mode === 'advanced'
      ? resolveAdvancedVibe({ dims: draftAdvancedDims, ...metadata })
      : resolveBasicVibe({ ...draftBasicDims, ...metadata });
    triggerNextGeneration(resolved, audioModel, 0);
    setIsChangingVibe(false);
  };

  const handleApiKeySave = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setApiErrorMessage('Enter a valid API key before saving.');
      setShowKeyError(true);
      return;
    }

    setStoredApiKey(trimmed);
    setApiKeyInput('');
    setShowApiKeyEditor(false);
    setShowKeyError(false);
    setApiErrorMessage('');
    setHasApiKey(true);

    try {
      await loadLyriaModels();
    } catch (error) {
      setApiErrorMessage(error instanceof Error ? error.message : 'Failed to load models with the provided key.');
      setShowKeyError(true);
    }
  };

  const handleApiKeyClear = () => {
    clearStoredApiKey();
    const stillHasKey = refreshApiKeyStatus();
    if (!stillHasKey) {
      setApiErrorMessage('No API key configured. Set GEMINI_API_KEY in .env.local or add one in the header.');
      setShowKeyError(true);
    }
  };

  const isControlsDisabled = !hasApiKey || showKeyError;

  return (
    <div className="h-screen bg-[#050505] text-slate-200 flex flex-col font-sans overflow-hidden">
      <APIKeyOverlay
        show={showKeyError}
        message={apiErrorMessage}
        onClose={() => setShowKeyError(false)}
        onSelectKey={async () => {
          const hasKey = refreshApiKeyStatus();
          if (hasKey) {
            setShowKeyError(false);
            await loadLyriaModels();
          } else {
            setShowApiKeyEditor(true);
          }
        }}
      />

      <audio ref={playback.audioRefA} src={playback.songA?.url} />
      <audio ref={playback.audioRefB} src={playback.songB?.url} />

      <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-rose-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
          <h1 className="text-xl font-bold tracking-tighter uppercase italic text-white">Endless Vibe</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={async () => {
              setShowApiKeyEditor(prev => !prev);
              const hasKey = refreshApiKeyStatus();
              if (hasKey) {
                setShowKeyError(false);
                await loadLyriaModels();
              } else {
                setApiErrorMessage('No API key configured. Set GEMINI_API_KEY in .env.local or add one in the header.');
                setShowKeyError(true);
              }
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-[10px] font-bold uppercase tracking-widest',
              hasApiKey
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20',
            )}
          >
            <div className={cn('w-1.5 h-1.5 rounded-full', hasApiKey ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse')} />
            {hasApiKey ? 'API Key Active' : 'Set API Key'}
            <ChevronDown className={cn('w-3 h-3 opacity-50 transition-transform', showApiKeyEditor && 'rotate-180')} />
          </button>

          <div className="h-4 w-px bg-white/10 mx-2"></div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Vibe Studio v1.5</div>
        </div>
      </header>

      {showApiKeyEditor && (
        <div className="border-b border-white/10 bg-black/50 px-8 py-3 flex items-center gap-3">
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Paste Gemini API key (AIza...)"
            className="flex-1 h-10 bg-white/5 border border-white/15 rounded-lg px-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/60"
          />
          <button
            onClick={handleApiKeySave}
            className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-widest"
          >
            Save Key
          </button>
          <button
            onClick={handleApiKeyClear}
            className="h-10 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-[10px] font-bold uppercase tracking-widest border border-white/10"
          >
            Clear Saved Key
          </button>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden">
        <SidebarQueue playlist={playlist} isPlaying={playback.isPlaying} maxAttempts={MAX_GENERATION_ATTEMPTS} />

        <section className="flex-1 p-8 flex flex-col items-center relative overflow-x-hidden overflow-y-auto custom-scrollbar">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.03)_0%,_transparent_70%)] pointer-events-none"></div>

          <div className="w-full flex justify-center relative z-10 pt-2 pb-6">
            <ModeToggle
              mode={mode}
              onChange={(m) => { setMode(m); setIsChangingVibe(true); }}
              disabled={isControlsDisabled}
            />
          </div>

          <div className="relative z-10 pb-6 w-full flex justify-center">
            <VibeMetadataControls
              genre={metadata.genre}
              country={metadata.country ?? 'Global'}
              customInstructions={metadata.customInstructions}
              genres={GENRES}
              countries={COUNTRIES}
              onGenreChange={(g) => { setMetadata(m => ({ ...m, genre: g })); setIsChangingVibe(true); }}
              onCountryChange={(c) => { setMetadata(m => ({ ...m, country: c })); setIsChangingVibe(true); }}
              onCustomInstructionsChange={(v) => { setMetadata(m => ({ ...m, customInstructions: v })); setIsChangingVibe(true); }}
              disabled={isControlsDisabled}
            />
          </div>

          {mode === 'basic' ? (
            <div className="flex flex-col xl:flex-row items-center justify-center gap-12 xl:gap-24 w-full max-w-5xl relative z-10 pb-8">
              <VibePad
                title="CIRCLE 1: MOOD" xValue={draftBasicDims.valence} yValue={draftBasicDims.arousal}
                onChange={(x, y) => { setDraftBasicDims(d => ({ ...d, valence: x, arousal: y })); setIsChangingVibe(true); }}
                labels={{ top: 'HIGH ENERGY', bottom: 'LOW ENERGY', left: 'NEGATIVE', right: 'POSITIVE' }}
                disabled={isControlsDisabled}
                gradientClass="bg-gradient-to-tr from-[#381e72] via-[#ce484b] to-[#f0b029]"
                dotClass="bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.8)]"
              />
              <VibePad
                title="CIRCLE 2: CHARACTER" xValue={draftBasicDims.acousticness} yValue={draftBasicDims.complexity}
                onChange={(x, y) => { setDraftBasicDims(d => ({ ...d, acousticness: x, complexity: y })); setIsChangingVibe(true); }}
                labels={{ top: 'COMPLEX', bottom: 'SIMPLE', left: 'ACOUSTIC', right: 'ELECTRONIC' }}
                disabled={isControlsDisabled}
                gradientClass="bg-gradient-to-tr from-[#2d1b54] via-[#5c2a80] to-[#2eb868]"
                dotClass="bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.8)]"
              />
            </div>
          ) : (
            <div className="w-full flex justify-center relative z-10 pb-8">
              <AdvancedMixer
                dims={draftAdvancedDims}
                currentSongRolled={currentSong?.advancedValues}
                onChange={(dim, next) => {
                  setDraftAdvancedDims(d => ({ ...d, [dim]: next }));
                  setIsChangingVibe(true);
                }}
                disabled={isControlsDisabled}
              />
            </div>
          )}

          <div className="w-full max-w-md relative z-10 pb-6">
            <button
              onClick={handleApplyVibe}
              disabled={(!isChangingVibe && isAnyPending(playlist)) || isControlsDisabled}
              className={cn(
                'w-full h-14 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative overflow-hidden',
                (isControlsDisabled || (!isChangingVibe && isAnyPending(playlist)))
                  ? 'bg-neutral-900 text-neutral-600 grayscale'
                  : isChangingVibe
                    ? 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] scale-[1.02] border-2 border-white/20'
                    : 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 hover:bg-indigo-500',
              )}
            >
              <span className="relative z-10">{(isAnyPending(playlist) && !isChangingVibe) ? 'Generating...' : 'Apply Vibe'}</span>
              {isChangingVibe && !isAnyPending(playlist) && (
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
                />
              )}
            </button>
          </div>

          <motion.div key={currentSong?.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center mt-auto pb-8 z-10">
            <h3 className="text-3xl font-light italic mb-2 tracking-tight text-white capitalize">{currentSong?.genre || 'Initializing'} Synthesis</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed h-10 overflow-hidden line-clamp-2">{currentSong?.description || 'Curating your soundscape...'}</p>
          </motion.div>
        </section>

        <aside className="w-[300px] shrink-0 border-l border-white/5 bg-[#0a0a0a] p-6 flex flex-col overflow-hidden">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-8 flex items-center gap-2"><Settings2 className="w-3 h-3" /> Output</h2>
          <div className="space-y-8 flex-1 overflow-y-auto custom-scrollbar pr-2 mb-6">
            <div>
              <div className="text-[11px] text-white/40 mb-3 uppercase tracking-widest">Generator</div>
              <select
                value={audioModel}
                onChange={(e) => { setAudioModel(e.target.value); setIsChangingVibe(true); }}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-lg px-4 text-xs text-white appearance-none transition-all hover:bg-white/10"
              >
                {lyriaModels.map(m => <option key={m} value={m} className="bg-[#0a0a0a]">{m}</option>)}
              </select>
            </div>
            <div>
              <div className="flex justify-between items-center text-[11px] text-white/40 mb-3 uppercase tracking-widest">
                <span>Crossfade</span>
                <span className="text-indigo-400 font-mono font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded">{crossfadeDuration}s</span>
              </div>
              <input type="range" min="0" max="5" step="0.5" value={crossfadeDuration} onChange={(e) => setCrossfadeDuration(parseFloat(e.target.value))} className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer" />
            </div>
            <div>
              <div className="flex justify-between items-center text-[11px] text-white/40 mb-3 uppercase tracking-widest">
                <span>Buffer</span>
                <span className="text-indigo-400 font-mono font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded">{bufferDepth}</span>
              </div>
              <input type="range" min="1" max="3" step="1" value={bufferDepth} onChange={(e) => setBufferDepth(parseInt(e.target.value, 10))} className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer" />
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 mt-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-4">
                <button
                  onClick={playback.togglePlayPause}
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition-transform"
                >
                  {playback.isPlaying ? <Pause className="fill-current w-5 h-5" /> : <Play className="fill-current w-5 h-5 ml-1" />}
                </button>
                <button onClick={playback.skip} className="text-white/40 hover:text-white transition-colors"><SkipForward className="w-5 h-5" /></button>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-white/80">{formatTime(playback.progress)} / {formatTime(playback.duration)}</div>
                <div className={cn('text-[9px] font-mono tracking-tighter mt-1', nextReadySong ? 'text-emerald-400' : 'text-amber-400')}>
                  {nextReadySong ? `STABLE (${formatTime(nextReadySong.duration || 0)} Buffer)` : 'REPLENISHING...'}
                </div>
              </div>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
              <motion.div className="absolute top-0 left-0 h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" animate={{ width: `${(playback.progress / (playback.duration || 1)) * 100}%` }} transition={{ type: 'tween', ease: 'linear' }} />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
