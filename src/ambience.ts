/**
 * Melancholic background ambience, generated with Web Audio so there is no audio file to
 * download or license: a soft wind bed, a slow minor-key pad, and sparse chime notes,
 * all sent through a long synthetic reverb.
 */

const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

// Am – Fmaj7 – C – Em, voiced low and close; each chord swells in and out over ~10 s
const CHORDS = [
  [45, 52, 57, 60],
  [41, 48, 52, 57],
  [48, 55, 60, 64],
  [40, 47, 52, 55],
];
const CHORD_SECONDS = 10;
// A minor pentatonic, upper register, for the occasional chime
const CHIME_NOTES = [69, 72, 74, 76, 79, 81];

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

    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulseResponse(ctx, 5);
    const wet = ctx.createGain();
    wet.gain.value = 0.6;
    reverb.connect(wet).connect(this.master);

    this.startWind(ctx);

    const pad = ctx.createBiquadFilter();
    pad.type = "lowpass";
    pad.frequency.value = 900;
    pad.connect(this.master);
    pad.connect(reverb);
    const chimes = ctx.createGain();
    chimes.connect(this.master);
    chimes.connect(reverb);

    // Schedule a little ahead of the audio clock so timing never depends on frame rate
    let chordIndex = 0;
    let nextChordAt = ctx.currentTime + 0.5;
    let nextChimeAt = ctx.currentTime + 4;
    const schedule = () => {
      while (nextChordAt < ctx.currentTime + 2) {
        this.playChord(ctx, pad, CHORDS[chordIndex++ % CHORDS.length], nextChordAt);
        nextChordAt += CHORD_SECONDS;
      }
      while (nextChimeAt < ctx.currentTime + 2) {
        this.playChime(ctx, chimes, nextChimeAt);
        nextChimeAt += 3 + Math.random() * 6;
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
    const target = this.muted ? 0 : this.ducked ? 0.12 : 0.7;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.8);
  }

  // Low, gently gusting wind: brown noise through a lowpass whose cutoff and level drift
  private startWind(ctx: AudioContext) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 350;
    const volume = ctx.createGain();
    volume.gain.value = 0.3;

    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.05;
    const sweepDepth = ctx.createGain();
    sweepDepth.gain.value = 150;
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

  private playChord(ctx: AudioContext, out: AudioNode, notes: number[], at: number) {
    const end = at + CHORD_SECONDS + 4;
    for (const note of notes) {
      // Two slightly detuned voices per note give a soft, chorused pad
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = midiToHz(note);
        osc.detune.value = detune;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(0.035, at + 4);
        env.gain.setValueAtTime(0.035, at + CHORD_SECONDS - 1);
        env.gain.linearRampToValueAtTime(0, end);
        osc.connect(env).connect(out);
        osc.start(at);
        osc.stop(end);
      }
    }
  }

  private playChime(ctx: AudioContext, out: AudioNode, at: number) {
    const note = CHIME_NOTES[Math.floor(Math.random() * CHIME_NOTES.length)];
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = midiToHz(note);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.05, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 4);
    osc.connect(env).connect(out);
    osc.start(at);
    osc.stop(at + 4);
  }

  // Exponentially decaying stereo noise: a cheap, convincing large-room reverb
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
