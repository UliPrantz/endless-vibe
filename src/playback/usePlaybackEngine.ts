import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Song } from '../types';

export interface PlaybackEngine {
  audioRefA: RefObject<HTMLAudioElement | null>;
  audioRefB: RefObject<HTMLAudioElement | null>;
  songA: Song | null;
  songB: Song | null;
  activePlayer: 'A' | 'B';
  isPlaying: boolean;
  progress: number;
  duration: number;
  togglePlayPause: () => void;
  start: () => void;
  skip: () => void;
}

interface UsePlaybackEngineArgs {
  currentSong: Song | null;
  nextReadySong: Song | null;
  crossfadeDuration: number;
  /** Advance the playlist cursor. Return true if it actually advanced. */
  onAdvance: () => boolean;
}

const FADE_INTERVAL_MS = 50;

/**
 * Two-element crossfade engine. The active element plays the current song;
 * the inactive element preloads the next ready song. When the active track is
 * within `crossfadeDuration` seconds of its end (or has ended), we call
 * `onAdvance`, which is expected to advance the playlist cursor. We then flip
 * `activePlayer`, fade the outgoing element down, and fade the incoming one up.
 */
export function usePlaybackEngine({
  currentSong,
  nextReadySong,
  crossfadeDuration,
  onAdvance,
}: UsePlaybackEngineArgs): PlaybackEngine {
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);

  const [songA, setSongA] = useState<Song | null>(null);
  const [songB, setSongB] = useState<Song | null>(null);
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Guard so we don't call onAdvance more than once per song-end.
  const advancingRef = useRef(false);

  // Mirror-write currentSong/nextReadySong into the active/inactive slots.
  // Active slot keeps its track until activePlayer flips, so the fade can
  // complete without a src change.
  useEffect(() => {
    if (activePlayer === 'A') {
      if (currentSong && songA?.id !== currentSong.id) setSongA(currentSong);
      if (nextReadySong && songB?.id !== nextReadySong.id) setSongB(nextReadySong);
    } else {
      if (currentSong && songB?.id !== currentSong.id) setSongB(currentSong);
      if (nextReadySong && songA?.id !== nextReadySong.id) setSongA(nextReadySong);
    }
  }, [currentSong, nextReadySong, activePlayer, songA?.id, songB?.id]);

  // Drive each audio element from isPlaying + activePlayer. This is the
  // single source of truth — the <audio> element's own pause/play events do
  // not feed back into React state, which avoids the race where a fade-out
  // pause flips isPlaying off mid-crossfade.
  const driveElement = useCallback((player: 'A' | 'B', audio: HTMLAudioElement | null) => {
    if (!audio) return undefined;
    const isActive = player === activePlayer;

    if (isActive) {
      audio.volume = crossfadeDuration > 0 ? audio.volume : 1;
      if (isPlaying) {
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch(error => {
            if (error?.name === 'NotAllowedError') {
              console.warn('Autoplay blocked. User must interact first.');
              setIsPlaying(false);
            }
          });
        }
        if (crossfadeDuration <= 0) {
          audio.volume = 1;
          return undefined;
        }
        const step = FADE_INTERVAL_MS / (crossfadeDuration * 1000);
        const interval = setInterval(() => {
          const next = Math.min(1, audio.volume + step);
          audio.volume = next;
          if (next >= 1) clearInterval(interval);
        }, FADE_INTERVAL_MS);
        return () => clearInterval(interval);
      }
      audio.pause();
      return undefined;
    }

    // Inactive player fades out. Once silent, pause and rewind so it's
    // ready to be reused as the next active player.
    if (crossfadeDuration <= 0) {
      audio.volume = 0;
      audio.pause();
      audio.currentTime = 0;
      return undefined;
    }
    const step = FADE_INTERVAL_MS / (crossfadeDuration * 1000);
    const interval = setInterval(() => {
      const next = Math.max(0, audio.volume - step);
      audio.volume = next;
      if (next <= 0) {
        clearInterval(interval);
        audio.pause();
        audio.currentTime = 0;
      }
    }, FADE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activePlayer, crossfadeDuration, isPlaying]);

  useEffect(() => driveElement('A', audioRefA.current), [driveElement]);
  useEffect(() => driveElement('B', audioRefB.current), [driveElement]);

  // When the cursor advances (currentSong changes), the next song is now
  // playing; clear the guard so we can crossfade out of *this* one too.
  useEffect(() => {
    advancingRef.current = false;
    setProgress(0);
    setDuration(0);
  }, [currentSong?.id]);

  const advance = useCallback(() => {
    if (advancingRef.current) return;
    if (!onAdvance()) return;
    advancingRef.current = true;
    setActivePlayer(prev => (prev === 'A' ? 'B' : 'A'));
  }, [onAdvance]);

  const handleTimeUpdate = useCallback((player: 'A' | 'B') => {
    if (player !== activePlayer) return;
    const audio = player === 'A' ? audioRefA.current : audioRefB.current;
    if (!audio) return;

    setProgress(audio.currentTime);
    if (audio.duration && !Number.isNaN(audio.duration)) {
      setDuration(audio.duration);
    }

    const total = audio.duration;
    if (total > 0 && nextReadySong) {
      const remaining = total - audio.currentTime;
      if (remaining <= Math.max(crossfadeDuration, 0.05)) {
        advance();
      }
    }
  }, [activePlayer, crossfadeDuration, nextReadySong, advance]);

  const handleEnded = useCallback((player: 'A' | 'B') => {
    if (player !== activePlayer) return;
    // If we never crossfaded (e.g. next song wasn't ready in time), still
    // advance now that this one has finished. The new song will start from
    // its first frame once it becomes ready.
    advance();
  }, [activePlayer, advance]);

  const handleLoadedMetadata = useCallback((player: 'A' | 'B') => {
    if (player !== activePlayer) return;
    const audio = player === 'A' ? audioRefA.current : audioRefB.current;
    if (audio?.duration) setDuration(audio.duration);
  }, [activePlayer]);

  // Wire up event handlers on the audio elements via a stable effect.
  useEffect(() => {
    const a = audioRefA.current;
    const b = audioRefB.current;
    if (!a || !b) return;

    const onTimeA = () => handleTimeUpdate('A');
    const onTimeB = () => handleTimeUpdate('B');
    const onEndedA = () => handleEnded('A');
    const onEndedB = () => handleEnded('B');
    const onMetaA = () => handleLoadedMetadata('A');
    const onMetaB = () => handleLoadedMetadata('B');

    a.addEventListener('timeupdate', onTimeA);
    b.addEventListener('timeupdate', onTimeB);
    a.addEventListener('ended', onEndedA);
    b.addEventListener('ended', onEndedB);
    a.addEventListener('loadedmetadata', onMetaA);
    b.addEventListener('loadedmetadata', onMetaB);

    return () => {
      a.removeEventListener('timeupdate', onTimeA);
      b.removeEventListener('timeupdate', onTimeB);
      a.removeEventListener('ended', onEndedA);
      b.removeEventListener('ended', onEndedB);
      a.removeEventListener('loadedmetadata', onMetaA);
      b.removeEventListener('loadedmetadata', onMetaB);
    };
  }, [handleTimeUpdate, handleEnded, handleLoadedMetadata]);

  // Recover from "buffer exhausted": if the active track has already ended
  // (no crossfade was possible because nextReadySong arrived too late) and a
  // song becomes ready afterward, advance now.
  useEffect(() => {
    if (!nextReadySong) return;
    const audio = activePlayer === 'A' ? audioRefA.current : audioRefB.current;
    if (audio && audio.ended) advance();
  }, [nextReadySong, activePlayer, advance]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const start = useCallback(() => {
    setIsPlaying(true);
  }, []);

  return {
    audioRefA,
    audioRefB,
    songA,
    songB,
    activePlayer,
    isPlaying,
    progress,
    duration,
    togglePlayPause,
    start,
    skip: advance,
  };
}
