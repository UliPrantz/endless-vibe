export class FakeAudioElement extends EventTarget {
  volume = 1;
  currentTime = 0;
  duration = 30;
  paused = true;
  src = '';

  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }

  get ended(): boolean {
    return this.duration > 0 && this.currentTime >= this.duration;
  }

  tick(seconds: number): void {
    this.currentTime = Math.min(this.duration, this.currentTime + seconds);
    this.dispatchEvent(new Event('timeupdate'));
    if (this.currentTime >= this.duration) {
      this.dispatchEvent(new Event('ended'));
    }
  }

  emitLoadedMetadata(): void {
    this.dispatchEvent(new Event('loadedmetadata'));
  }
}

export function makeFakePair(): [FakeAudioElement, FakeAudioElement] {
  return [new FakeAudioElement(), new FakeAudioElement()];
}
