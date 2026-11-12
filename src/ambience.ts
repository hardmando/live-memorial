/**
 * Distant storm ambience, generated with Web Audio so there is no audio file to download
 * or license: a low gusting wind bed, plus far-off thunder rolling in at random intervals,
 * all sent through a long synthetic reverb so it sounds miles away.
 */
export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private ducked = false;

  /** Browsers only allow audio after a user gesture, so call this from one. */
  start() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.applyVolume();

    const noise = this.brownNoise(ctx, 8);
    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulseResponse(ctx, 6);
    const wet = ctx.createGain();
    wet.gain.value = 0.8;
    reverb.connect(wet).connect(this.master);

    this.startWind(ctx, noise);

    // Schedule a little ahead of the audio clock so timing never depends on frame rate
    let nextThunderAt = ctx.currentTime + 3 + Math.random() * 4;
    const schedule = () => {
      while (nextThunderAt < ctx.currentTime + 2) {
        this.playThunder(ctx, noise, reverb, nextThunderAt);
        nextThunderAt += 8 + Math.random() * 14;
      }
    };
    schedule();
    setInterval(schedule, 500);
  }

  toggleMute() {
    this.muted = !this.muted;
    this.applyVolume();
    return this.muted;
  }

  /** Quiets the ambience while a trailer is playing. */
  setDucked(ducked: boolean) {
    this.ducked = ducked;
    this.applyVolume();
  }

  private applyVolume() {
    if (!this.ctx || !this.master) return;
    const target = this.muted ? 0 : this.ducked ? 0.12 : 0.8;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.8);
  }

  // Low wind: brown noise through a lowpass whose cutoff and level drift slowly
  private startWind(ctx: AudioContext, noise: AudioBuffer) {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    const volume = ctx.createGain();
    volume.gain.value = 0.3;

    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.05;
    const sweepDepth = ctx.createGain();
    sweepDepth.gain.value = 140;
    sweep.connect(sweepDepth).connect(filter.frequency);
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.08;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 0.15;
    gust.connect(gustDepth).connect(volume.gain);

    source.connect(filter).connect(volume).connect(this.master!);
    source.start();
    sweep.start();
    gust.start();
  }

  // One far-off thunder roll: heavily low-passed noise that swells, rumbles a few times, and fades
  private playThunder(ctx: AudioContext, noise: AudioBuffer, reverb: AudioNode, at: number) {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 80 + Math.random() * 140;
    const env = ctx.createGain();
    const peak = 0.5 + Math.random() * 0.5;
    const duration = 5 + Math.random() * 5;

    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.4 + Math.random() * 1.2);
    let t = at + 1.5;
    while (t < at + duration - 1.5) {
      env.gain.setTargetAtTime(peak * (0.25 + Math.random() * 0.6), t, 0.3);
      t += 0.6 + Math.random() * 1.2;
    }
    env.gain.setTargetAtTime(0, t, duration / 5);

    source.connect(filter).connect(env);
    env.connect(this.master!);
    env.connect(reverb);
    source.start(at, Math.random() * noise.duration);
    source.stop(t + duration);
  }

  // Brown noise: integrated white noise, deep and soft rather than hissy
  private brownNoise(ctx: AudioContext, seconds: number) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  // Exponentially decaying stereo noise: a cheap, convincing large-space reverb
  private impulseResponse(ctx: AudioContext, seconds: number) {
    const length = ctx.sampleRate * seconds;
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    return impulse;
  }
}
