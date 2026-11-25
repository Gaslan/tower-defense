interface ToneOptions {
  readonly type: OscillatorType;
  readonly startFreq: number;
  readonly endFreq: number;
  readonly duration: number;
  readonly peakGain: number;
  readonly delay?: number;
  readonly filterFreq?: number;
}

interface NoiseOptions {
  readonly duration: number;
  readonly peakGain: number;
  readonly filterType: BiquadFilterType;
  readonly filterFreq: number;
  readonly filterEndFreq?: number;
  readonly q?: number;
  readonly delay?: number;
}

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private volume = 0.7;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.syncMasterGain();
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    this.syncMasterGain();
    return this.muted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.syncMasterGain();
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
  }

  public playArcherShoot(): void {
    this.playTone({
      type: 'triangle',
      startFreq: 920,
      endFreq: 250,
      duration: 0.08,
      peakGain: 0.1,
    });
    this.playNoise({
      duration: 0.06,
      peakGain: 0.06,
      filterType: 'bandpass',
      filterFreq: 3200,
      filterEndFreq: 1400,
      q: 2.0,
    });
  }

  public playKnightSlash(): void {
    this.playNoise({
      duration: 0.11,
      peakGain: 0.11,
      filterType: 'bandpass',
      filterFreq: 1300,
      filterEndFreq: 420,
      q: 2.5,
    });
    this.playTone({
      type: 'triangle',
      startFreq: 190,
      endFreq: 52,
      duration: 0.12,
      peakGain: 0.16,
      delay: 0.02,
    });
  }

  public playMageCast(): void {
    this.playTone({
      type: 'sine',
      startFreq: 440,
      endFreq: 880,
      duration: 0.18,
      peakGain: 0.1,
    });
    this.playTone({
      type: 'triangle',
      startFreq: 660,
      endFreq: 1320,
      duration: 0.14,
      peakGain: 0.05,
      delay: 0.03,
    });
  }

  public playFrostCast(): void {
    this.playTone({
      type: 'sine',
      startFreq: 1080,
      endFreq: 1620,
      duration: 0.14,
      peakGain: 0.09,
    });
    this.playTone({
      type: 'triangle',
      startFreq: 1440,
      endFreq: 720,
      duration: 0.11,
      peakGain: 0.05,
      delay: 0.025,
    });
  }

  public playMageImpact(): void {
    this.playTone({
      type: 'sine',
      startFreq: 155,
      endFreq: 38,
      duration: 0.24,
      peakGain: 0.18,
    });
    this.playNoise({
      duration: 0.2,
      peakGain: 0.09,
      filterType: 'lowpass',
      filterFreq: 480,
      filterEndFreq: 120,
    });
  }

  public playEnemyDeath(): void {
    this.playTone({
      type: 'sawtooth',
      startFreq: 340,
      endFreq: 80,
      duration: 0.11,
      peakGain: 0.09,
      filterFreq: 1200,
    });
    this.playNoise({
      duration: 0.07,
      peakGain: 0.06,
      filterType: 'bandpass',
      filterFreq: 900,
      q: 1.5,
    });
  }

  public playUpgrade(): void {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, index) => {
      this.playTone({
        type: 'sine',
        startFreq: freq,
        endFreq: freq,
        duration: index === notes.length - 1 ? 0.18 : 0.12,
        peakGain: index === notes.length - 1 ? 0.11 : 0.1,
        delay: index * 0.055,
      });
    });
  }

  public playVictory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, index) => {
      this.playTone({
        type: 'triangle',
        startFreq: freq,
        endFreq: freq,
        duration: index === notes.length - 1 ? 0.36 : 0.14,
        peakGain: index === notes.length - 1 ? 0.14 : 0.11,
        delay: index * 0.085,
      });
    });
  }

  public playPlaceUnit(): void {
    this.playTone({
      type: 'triangle',
      startFreq: 165,
      endFreq: 58,
      duration: 0.09,
      peakGain: 0.14,
    });
    this.playNoise({
      duration: 0.035,
      peakGain: 0.05,
      filterType: 'lowpass',
      filterFreq: 700,
    });
  }

  public playSellUnit(): void {
    this.playTone({
      type: 'sine',
      startFreq: 987.77,
      endFreq: 987.77,
      duration: 0.09,
      peakGain: 0.11,
    });
    this.playTone({
      type: 'sine',
      startFreq: 1318.51,
      endFreq: 1318.51,
      duration: 0.16,
      peakGain: 0.12,
      delay: 0.065,
    });
  }

  public playMeteorImpact(): void {
    this.playTone({
      type: 'sine',
      startFreq: 130,
      endFreq: 28,
      duration: 0.45,
      peakGain: 0.25,
    });
    this.playTone({
      type: 'triangle',
      startFreq: 88,
      endFreq: 32,
      duration: 0.38,
      peakGain: 0.18,
      delay: 0.02,
    });
    this.playNoise({
      duration: 0.48,
      peakGain: 0.2,
      filterType: 'lowpass',
      filterFreq: 680,
      filterEndFreq: 95,
    });
  }

  public playFrostWave(): void {
    const notes = [1046.5, 1318.51, 1760, 2093];
    notes.forEach((freq, index) => {
      this.playTone({
        type: 'sine',
        startFreq: freq,
        endFreq: freq * 1.03,
        duration: 0.26,
        peakGain: 0.075,
        delay: index * 0.045,
      });
    });
    this.playTone({
      type: 'triangle',
      startFreq: 1480,
      endFreq: 640,
      duration: 0.34,
      peakGain: 0.06,
    });
    this.playNoise({
      duration: 0.4,
      peakGain: 0.1,
      filterType: 'bandpass',
      filterFreq: 3000,
      filterEndFreq: 950,
      q: 3.2,
    });
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) {
      return this.ctx;
    }

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(
      this.muted ? 0 : this.volume,
      this.ctx.currentTime,
    );
    this.masterGain.connect(this.ctx.destination);

    const length = Math.floor(this.ctx.sampleRate * 0.55);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return this.ctx;
  }

  private syncMasterGain(): void {
    if (!this.ctx || !this.masterGain) {
      return;
    }
    this.masterGain.gain.setValueAtTime(
      this.muted ? 0 : this.volume,
      this.ctx.currentTime,
    );
  }

  private getActiveContext(): AudioContext | null {
    if (this.muted) {
      return null;
    }
    const ctx = this.ensureContext();
    if (!ctx) {
      return null;
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx;
  }

  private playTone(options: ToneOptions): void {
    const ctx = this.getActiveContext();
    if (!ctx) {
      return;
    }

    const startTime = ctx.currentTime + (options.delay ?? 0);
    const endTime = startTime + options.duration;

    const osc = ctx.createOscillator();
    osc.type = options.type;
    osc.frequency.setValueAtTime(options.startFreq, startTime);
    if (options.endFreq !== options.startFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, options.endFreq),
        endTime,
      );
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(options.peakGain, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    if (options.filterFreq !== undefined) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(options.filterFreq, startTime);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(this.masterGain ?? ctx.destination);
    osc.start(startTime);
    osc.stop(endTime + 0.02);
  }

  private playNoise(options: NoiseOptions): void {
    const ctx = this.getActiveContext();
    if (!ctx || !this.noiseBuffer) {
      return;
    }

    const startTime = ctx.currentTime + (options.delay ?? 0);
    const endTime = startTime + options.duration;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = options.filterType;
    filter.frequency.setValueAtTime(options.filterFreq, startTime);
    if (options.q !== undefined) {
      filter.Q.setValueAtTime(options.q, startTime);
    }
    if (options.filterEndFreq !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(40, options.filterEndFreq),
        endTime,
      );
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(options.peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain ?? ctx.destination);

    source.start(startTime);
    source.stop(endTime + 0.02);
  }
}
