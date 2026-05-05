import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { makeFixtureSongs, mockMusicServiceModule, queueSong, resetMusicServiceMock } from './test/mockMusicService';
import type { FixtureSong } from './test/mockMusicService';

vi.mock('./services/musicService', () => mockMusicServiceModule());

vi.mock('./lib/apiKeyStore', () => ({
  getResolvedApiKey: () => 'fake-key-for-test',
  setStoredApiKey: vi.fn(),
  clearStoredApiKey: vi.fn(),
}));

function closestQueueCard(text: RegExp) {
  return Array.from(document.querySelectorAll('.rounded-xl')).find((element) =>
    text.test(element.textContent ?? ''),
  ) ?? null;
}

const audios = () => Array.from(document.querySelectorAll('audio'));

function playingAudioFor(song: FixtureSong) {
  return audios().find((audio) => !audio.paused && audio.src.includes(song.urlTail));
}

function audioFor(song: FixtureSong) {
  return audios().find((audio) => audio.src.includes(song.urlTail));
}

function seekToEnd(song: FixtureSong, secondsBeforeEnd: number) {
  const audio = audioFor(song);
  expect(audio, `${song.id} should be loaded into an audio element`).toBeTruthy();
  audio!.currentTime = audio!.duration - secondsBeforeEnd;
  return audio!;
}

async function renderStartedApp() {
  const App = (await import('./App')).default;
  const screen = render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /apply vibe/i }));
  return screen;
}

afterEach(() => {
  resetMusicServiceMock();
});

describe('autoplay handoff (real browser)', () => {
  it('song1 ends and song2 starts on the other audio element', async () => {
    const fixtures = makeFixtureSongs();
    queueSong(fixtures.silence12); // first track played
    queueSong(fixtures.silence13); // buffered, should start when song1 ends

    await renderStartedApp();

    await vi.waitFor(() => {
      const playing = playingAudioFor(fixtures.silence12);
      expect(playing, 'song1 should be playing on a real <audio>').toBeTruthy();
    }, { timeout: 8000 });

    const song1Audio = seekToEnd(fixtures.silence12, 1.0);
    expect(song1Audio.duration).toBeGreaterThan(10); // sanity: real WAV decoded

    await vi.waitFor(() => {
      const playingSong2 = playingAudioFor(fixtures.silence13);
      expect(playingSong2, 'song2 should be playing after song1 ends').toBeTruthy();
    }, { timeout: 8000 });
  });

  it('keeps generating item queued when current track ends, then auto-plays it once ready', async () => {
    const fixtures = makeFixtureSongs();
    const thirdSong = {
      ...fixtures.silence12,
      id: 'silence-12-next',
      url: `${fixtures.silence12.url}?next`,
      urlTail: `${fixtures.silence12.urlTail}?next`,
      description: 'fixture: silence-12-next',
    };

    queueSong(fixtures.silence12);
    queueSong(fixtures.silence13, 5000);
    queueSong(thirdSong, 1500);

    const screen = await renderStartedApp();

    await vi.waitFor(() => {
      const playing = playingAudioFor(fixtures.silence12);
      expect(playing, 'song1 should start before the buffer is ready').toBeTruthy();
    }, { timeout: 8000 });

    expect(screen.getByText(/synthesizing next/i)).toBeTruthy();

    const song1Audio = seekToEnd(fixtures.silence12, 0.05);

    await vi.waitFor(() => {
      expect(song1Audio.ended, 'song1 should naturally finish while song2 is pending').toBe(true);
    }, { timeout: 8000 });

    await vi.waitFor(() => {
      expect(closestQueueCard(/synthesizing next/i), 'pending song should stay in queue while generating').toBeTruthy();
    }, { timeout: 1000 });

    const pastSong = closestQueueCard(/fixture: silence-12/i);
    const pendingSong = closestQueueCard(/synthesizing next/i);
    expect(pastSong?.className.toString(), 'finished song should be greyed out as history').toContain('grayscale');
    expect(pendingSong?.className.toString(), 'pending next song should stay green while generating').toContain('emerald');

    await vi.waitFor(() => {
      const playingSong2 = playingAudioFor(fixtures.silence13);
      expect(playingSong2, 'song2 should auto-play when delayed generation completes').toBeTruthy();
    }, { timeout: 8000 });

    await vi.waitFor(() => {
      const currentSong = closestQueueCard(/fixture: silence-13/i);
      const nextPendingSong = closestQueueCard(/synthesizing next/i);

      expect(currentSong?.className.toString(), 'resolved song should become purple current playback').toContain('indigo');
      expect(nextPendingSong?.className.toString(), 'next generation should start after song2 begins').toContain('emerald');
    }, { timeout: 8000 });

    await vi.waitFor(() => {
      const nextReadySong = closestQueueCard(/fixture: silence-12-next/i);
      expect(nextReadySong?.className.toString(), 'third song should become the next ready item').toContain('emerald');
    }, { timeout: 8000 });

    seekToEnd(fixtures.silence13, 1.0);

    await vi.waitFor(() => {
      const playingSong3 = playingAudioFor(thirdSong);
      expect(playingSong3, 'song3 should auto-play after song2 in queue order').toBeTruthy();
    }, { timeout: 8000 });
  });
});
