import { act, render } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Song } from '../types';
import { FakeAudioElement, makeFakePair } from '../test/fakeAudio';
import { usePlaybackEngine, type PlaybackEngine } from './usePlaybackEngine';

function makeSong(id: string): Song {
  return {
    id,
    url: `blob:fake/${id}`,
    description: `song ${id}`,
    genre: 'ambient',
    valence: 0,
    arousal: 0,
    acousticness: 0,
    complexity: 0,
    customInstructions: '',
    createdAt: 0,
  };
}

interface HarnessProps {
  currentSong: Song | null;
  nextReadySong: Song | null;
  crossfadeDuration: number;
  onAdvance: () => boolean;
  fakeA: FakeAudioElement;
  fakeB: FakeAudioElement;
  expose: (engine: PlaybackEngine) => void;
}

function Harness(props: HarnessProps) {
  const engine = usePlaybackEngine({
    currentSong: props.currentSong,
    nextReadySong: props.nextReadySong,
    crossfadeDuration: props.crossfadeDuration,
    onAdvance: props.onAdvance,
  });

  // Install fakes into the engine's refs *before* its own useEffect (which
  // attaches event listeners) runs. Layout effects fire before passive
  // effects, so this is safe even on the first render.
  useLayoutEffect(() => {
    engine.audioRefA.current = props.fakeA as unknown as HTMLAudioElement;
    engine.audioRefB.current = props.fakeB as unknown as HTMLAudioElement;
  }, [engine.audioRefA, engine.audioRefB, props.fakeA, props.fakeB]);

  // Mirror what App.tsx does in JSX: <audio src={songA?.url}/>. The engine's
  // src plumbing lives in App, not in the hook, so the test harness owns it.
  useLayoutEffect(() => {
    props.fakeA.src = engine.songA?.url ?? '';
  }, [props.fakeA, engine.songA?.url]);
  useLayoutEffect(() => {
    props.fakeB.src = engine.songB?.url ?? '';
  }, [props.fakeB, engine.songB?.url]);

  props.expose(engine);
  return null;
}

interface MountOptions {
  currentSong: Song | null;
  nextReadySong: Song | null;
  crossfadeDuration?: number;
  onAdvance?: () => boolean;
}

function mountEngine(opts: MountOptions) {
  const [fakeA, fakeB] = makeFakePair();
  const onAdvance = opts.onAdvance ?? vi.fn(() => true);
  let engine!: PlaybackEngine;
  const expose = (e: PlaybackEngine) => {
    engine = e;
  };

  let currentProps: HarnessProps = {
    currentSong: opts.currentSong,
    nextReadySong: opts.nextReadySong,
    crossfadeDuration: opts.crossfadeDuration ?? 3,
    onAdvance,
    fakeA,
    fakeB,
    expose,
  };

  const utils = render(<Harness {...currentProps} />);

  const update = (next: Partial<MountOptions>) => {
    currentProps = {
      ...currentProps,
      ...('currentSong' in next ? { currentSong: next.currentSong! } : {}),
      ...('nextReadySong' in next ? { nextReadySong: next.nextReadySong! } : {}),
      ...(next.crossfadeDuration !== undefined
        ? { crossfadeDuration: next.crossfadeDuration }
        : {}),
    };
    utils.rerender(<Harness {...currentProps} />);
  };

  return {
    fakeA,
    fakeB,
    onAdvance: onAdvance as ReturnType<typeof vi.fn>,
    getEngine: () => engine,
    update,
    unmount: utils.unmount,
  };
}

describe('usePlaybackEngine — autoplay handoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-advances when active track enters the crossfade window', () => {
    const song1 = makeSong('s1');
    const song2 = makeSong('s2');
    const harness = mountEngine({
      currentSong: song1,
      nextReadySong: song2,
      crossfadeDuration: 3,
    });

    act(() => {
      harness.getEngine().start();
    });

    // Active is A. Set duration, then tick into the crossfade window.
    harness.fakeA.duration = 30;
    act(() => {
      harness.fakeA.tick(28); // remaining = 2 < crossfadeDuration (3)
    });

    expect(harness.onAdvance).toHaveBeenCalledTimes(1);
    expect(harness.getEngine().activePlayer).toBe('B');

    // Simulate the playlist reducer reacting to advance: currentSong becomes
    // song2, nextReadySong clears (or becomes a future song). The engine should
    // now be playing song2 on player B.
    act(() => {
      harness.update({ currentSong: song2, nextReadySong: null });
    });

    expect(harness.fakeB.paused).toBe(false);
  });

  it('resumes playback when the next song becomes ready after the current track ended', () => {
    const song1 = makeSong('s1');
    const song2 = makeSong('s2');
    const onAdvance = vi.fn(() => false); // mirrors App.tsx: no next song = no advance
    const harness = mountEngine({
      currentSong: song1,
      nextReadySong: null,
      crossfadeDuration: 3,
      onAdvance,
    });

    act(() => {
      harness.getEngine().start();
    });

    expect(harness.fakeA.paused).toBe(false);

    // Play to the natural end with no next song.
    harness.fakeA.duration = 10;
    act(() => {
      harness.fakeA.tick(10);
    });

    expect(harness.fakeA.ended).toBe(true);
    expect(harness.getEngine().activePlayer).toBe('A');

    onAdvance.mockImplementation(() => true);
    act(() => {
      harness.update({ currentSong: song1, nextReadySong: song2 });
    });
    act(() => {
      harness.update({ currentSong: song2, nextReadySong: null });
    });

    expect(harness.getEngine().activePlayer).toBe('B');
    expect(harness.fakeB.paused).toBe(false);
    expect(harness.fakeB.src).toContain('s2');
  });

  it('only fires onAdvance once even if many timeupdate events land in the crossfade window', () => {
    const song1 = makeSong('s1');
    const song2 = makeSong('s2');
    const harness = mountEngine({
      currentSong: song1,
      nextReadySong: song2,
      crossfadeDuration: 3,
    });

    act(() => {
      harness.getEngine().start();
    });

    harness.fakeA.duration = 30;
    act(() => {
      // First tick crosses into the window; subsequent ticks should be no-ops.
      harness.fakeA.tick(28);
      harness.fakeA.dispatchEvent(new Event('timeupdate'));
      harness.fakeA.dispatchEvent(new Event('timeupdate'));
      harness.fakeA.dispatchEvent(new Event('timeupdate'));
    });

    expect(harness.onAdvance).toHaveBeenCalledTimes(1);
  });

  it('keeps song slots stable while activePlayer and parent cursor updates settle', () => {
    const song1 = makeSong('s1');
    const song2 = makeSong('s2');

    const harness = mountEngine({
      currentSong: song1,
      nextReadySong: song2,
      crossfadeDuration: 3,
    });

    act(() => {
      harness.getEngine().start();
    });

    expect(harness.fakeA.src).toContain('s1');
    expect(harness.fakeB.src).toContain('s2');

    harness.fakeA.duration = 30;
    act(() => {
      harness.fakeA.tick(28);
    });

    expect(harness.getEngine().activePlayer).toBe('B');
    expect(harness.fakeB.src).toContain('s2');
    expect(harness.fakeB.paused).toBe(false);

    // Now the parent catches up: cursor advanced, currentSong=song2, nextReady=null.
    act(() => {
      harness.update({ currentSong: song2, nextReadySong: null });
    });

    expect(harness.fakeB.src).toContain('s2');
    expect(harness.fakeB.paused).toBe(false);
  });

  it('starts the new active element after auto-advance', () => {
    const song1 = makeSong('s1');
    const song2 = makeSong('s2');
    const harness = mountEngine({
      currentSong: song1,
      nextReadySong: song2,
      crossfadeDuration: 3,
    });

    act(() => {
      harness.getEngine().start();
    });

    // Sanity: A is playing song1.
    expect(harness.fakeA.paused).toBe(false);
    expect(harness.fakeA.src).toContain('s1');
    // And B has song2 preloaded (the inactive slot mirrors nextReadySong).
    expect(harness.fakeB.src).toContain('s2');

    // Tick into the crossfade window. Then simulate App.tsx reacting to the
    // advance: currentSong becomes song2, nextReadySong clears (no buffer yet).
    harness.fakeA.duration = 30;
    act(() => {
      harness.fakeA.tick(28);
    });
    act(() => {
      harness.update({ currentSong: song2, nextReadySong: null });
    });

    // Post-conditions: activePlayer flipped, B is playing song2, A is paused.
    expect(harness.getEngine().activePlayer).toBe('B');
    expect(harness.fakeB.paused).toBe(false);
    expect(harness.fakeB.src).toContain('s2');
  });

  it('manual skip() goes through the same advance path', () => {
    const song1 = makeSong('s1');
    const song2 = makeSong('s2');
    const harness = mountEngine({
      currentSong: song1,
      nextReadySong: song2,
      crossfadeDuration: 3,
    });

    act(() => {
      harness.getEngine().start();
    });

    harness.fakeA.duration = 60;
    act(() => {
      harness.fakeA.tick(5); // mid-track, well outside crossfade window
    });

    expect(harness.onAdvance).not.toHaveBeenCalled();

    act(() => {
      harness.getEngine().skip();
    });

    expect(harness.onAdvance).toHaveBeenCalledTimes(1);
    expect(harness.getEngine().activePlayer).toBe('B');

    act(() => {
      harness.update({ currentSong: song2, nextReadySong: null });
    });

    expect(harness.fakeB.paused).toBe(false);
  });
});
