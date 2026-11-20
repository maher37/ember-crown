// The sound engine: every note and noise is made live with the browser's Web Audio API.
// No recorded files, so nothing to license or credit. Presentation only: Math.random is fine here
// (it never touches the seeded game dice).
import type { Ambience, Cue, Mood } from './cues';

interface Volumes {
  music: number;
  ambience: number;
  effects: number;
  muted: boolean;
}

/** A piece of generative music: a mode, a chord loop and how busy each instrument is. */
interface Song {
  bpm: number;
  /** MIDI note of the key's root. */
  root: number;
  scale: number[];
  /** Scale degrees (0-based) of each bar's chord. */
  chords: number[];
  /** Steps per bar (eighth notes): 8 = 4/4, 6 = 6/8. */
  steps: number;
  pluck: number;
  bass: number;
  lead: number;
  drums: 0 | 1 | 2;
  pad: number;
  /** Lowpass on the pad (darker = lower). */
  bright: number;
}

const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const IONIAN = [0, 2, 4, 5, 7, 9, 11];
const MIXO = [0, 2, 4, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];

const SONGS: Record<Mood, Song> = {
  title: {
    bpm: 58,
    root: 50,
    scale: DORIAN,
    chords: [0, 5, 3, 4],
    steps: 8,
    pluck: 0.35,
    bass: 0.5,
    lead: 0.18,
    drums: 0,
    pad: 1,
    bright: 900,
  },
  tavern: {
    bpm: 104,
    root: 55,
    scale: MIXO,
    chords: [0, 0, 3, 4, 0, 6, 3, 4],
    steps: 6,
    pluck: 0.8,
    bass: 1,
    lead: 0.35,
    drums: 1,
    pad: 0.5,
    bright: 1400,
  },
  travel: {
    bpm: 78,
    root: 50,
    scale: MIXO,
    chords: [0, 6, 3, 0],
    steps: 8,
    pluck: 0.55,
    bass: 0.7,
    lead: 0.3,
    drums: 0,
    pad: 0.9,
    bright: 1200,
  },
  dungeon: {
    bpm: 50,
    root: 45,
    scale: PHRYGIAN,
    chords: [0, 1, 0, 5],
    steps: 8,
    pluck: 0.18,
    bass: 0.4,
    lead: 0.1,
    drums: 0,
    pad: 1,
    bright: 600,
  },
  marsh: {
    bpm: 54,
    root: 52,
    scale: AEOLIAN,
    chords: [0, 5, 6, 0],
    steps: 8,
    pluck: 0.2,
    bass: 0.35,
    lead: 0.16,
    drums: 0,
    pad: 1,
    bright: 700,
  },
  combat: {
    bpm: 122,
    root: 45,
    scale: AEOLIAN,
    chords: [0, 5, 6, 4],
    steps: 8,
    pluck: 0.55,
    bass: 1,
    lead: 0.2,
    drums: 1,
    pad: 0.7,
    bright: 1100,
  },
  boss: {
    bpm: 132,
    root: 50,
    scale: HARMONIC,
    chords: [0, 5, 4, 0, 0, 5, 6, 4],
    steps: 8,
    pluck: 0.65,
    bass: 1,
    lead: 0.25,
    drums: 2,
    pad: 0.9,
    bright: 1000,
  },
  camp: {
    bpm: 64,
    root: 53,
    scale: IONIAN,
    chords: [0, 4, 5, 3],
    steps: 6,
    pluck: 0.45,
    bass: 0.5,
    lead: 0.15,
    drums: 0,
    pad: 0.8,
    bright: 1000,
  },
  epilogue: {
    bpm: 68,
    root: 48,
    scale: IONIAN,
    chords: [0, 5, 3, 4],
    steps: 8,
    pluck: 0.4,
    bass: 0.6,
    lead: 0.3,
    drums: 0,
    pad: 1,
    bright: 1300,
  },
};

/** Loudness per piece, so quiet, sparse pieces sit level with busy ones. */
const SONG_GAIN: Record<Mood, number> = {
  title: 1.9,
  tavern: 1,
  travel: 1.2,
  dungeon: 2,
  marsh: 1.9,
  combat: 1,
  boss: 1,
  camp: 1.4,
  epilogue: 1.4,
};

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

class Engine {
  private ctx: AudioContext;
  private master: GainNode;
  private bus: { music: GainNode; ambience: GainNode; effects: GainNode };
  private noise: AudioBuffer;
  private brown: AudioBuffer;
  private song: Song | null = null;
  private mood: Mood | null = null;
  private nextStep = 0;
  private step = 0;
  private bar = 0;
  private leadNote = 0;
  private ambience: Ambience = 'none';
  private bed: { stop: () => void } | null = null;

  private last = 0;
  private musicLevel = 0.3;
  private songBus: GainNode;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    // A gentle limiter so stacked effects never clip.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 6;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    const mk = () => {
      const g = ctx.createGain();
      g.connect(this.master);
      return g;
    };
    this.bus = { music: mk(), ambience: mk(), effects: mk() };
    this.songBus = ctx.createGain();
    this.songBus.connect(this.bus.music);
    this.noise = this.makeNoise(false);
    this.brown = this.makeNoise(true);
    window.setInterval(() => this.tick(), 50);
  }

  private makeNoise(brown: boolean): AudioBuffer {
    const len = this.ctx.sampleRate * 2;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return b;
  }

  setVolumes(v: Volumes) {
    const t = this.ctx.currentTime;
    const set = (g: GainNode, x: number) => g.gain.setTargetAtTime(x, t, 0.1);
    set(this.master, v.muted ? 0 : 2.2);
    this.musicLevel = Math.max(0.0001, v.music * 0.55);
    set(this.bus.music, this.musicLevel);
    set(this.bus.ambience, v.ambience * 0.6);
    set(this.bus.effects, v.effects);
  }

  resume() {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ---------------------------------------------------------------- music

  setMood(mood: Mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    const g = this.bus.music.gain;
    const t = this.ctx.currentTime;
    const keep = this.musicLevel;
    // Fade out, switch, fade back in.
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.linearRampToValueAtTime(0.0001, t + 0.8);
    g.linearRampToValueAtTime(keep, t + 1.6);
    window.setTimeout(() => {
      this.song = SONGS[mood];
      this.songBus.gain.setValueAtTime(SONG_GAIN[mood], this.ctx.currentTime);
      this.step = 0;
      this.bar = 0;
      this.leadNote = 0;
      this.nextStep = this.ctx.currentTime + 0.1;
    }, 800);
  }

  private tick() {
    const now = this.ctx.currentTime;
    if (this.ctx.state !== 'running') return;
    const dt = this.last ? Math.min(0.5, now - this.last) : 0.05;
    this.last = now;
    if (this.song) {
      const sp = 60 / this.song.bpm / 2; // eighth notes
      if (this.nextStep < now) this.nextStep = now + 0.05;
      while (this.nextStep < now + 0.25) {
        this.playStep(this.song, this.nextStep, sp);
        this.nextStep += sp;
      }
    }
    this.ambientEvents(now, dt);
  }

  private chordNotes(s: Song, degree: number): number[] {
    return [0, 2, 4].map((k) => {
      const i = degree + k;
      return s.root + s.scale[i % 7]! + 12 * Math.floor(i / 7);
    });
  }

  private playStep(s: Song, t: number, sp: number) {
    const chord = this.chordNotes(s, s.chords[this.bar % s.chords.length]!);
    const beat = this.step % s.steps;
    const strong = beat === 0 || (s.steps === 8 && beat === 4) || (s.steps === 6 && beat === 3);
    if (beat === 0 && s.pad > 0) this.pad(chord, t, sp * s.steps, s.pad, s.bright);
    if (s.bass > 0 && (strong || (s.drums && Math.random() < 0.3 * s.bass)))
      this.bassNote(chord[0]! - 12, t, sp * (strong ? 2 : 1));
    if (Math.random() < s.pluck * (strong ? 1 : 0.7)) {
      const n =
        s.steps === 6 ? chord[beat % 3]! + 12 : pick(chord) + 12 * (Math.random() < 0.3 ? 1 : 0);
      this.pluck(n, t, strong ? 0.22 : 0.15);
    }
    if (Math.random() < s.lead && (strong || Math.random() < 0.4)) {
      // A wandering melody: mostly steps, sometimes a leap to a chord tone.
      const deg = this.leadNote + pick([-2, -1, -1, 1, 1, 2, 0]);
      this.leadNote = Math.max(-2, Math.min(9, deg));
      const i = this.leadNote + 7;
      const n = s.root + 12 + s.scale[((i % 7) + 7) % 7]! + 12 * (Math.floor(i / 7) - 1);
      this.lead(n, t, sp * pick([1, 2, 2, 3]));
    }
    if (s.drums) {
      if (strong) this.kick(t, s.drums === 2 ? 0.5 : 0.35);
      if (s.drums === 2 && beat === 7 && this.bar % 2 === 1) this.tom(t, 0.3);
      if (s.steps === 6 ? beat === 3 || beat === 5 : beat % 2 === 1)
        this.hat(t, s.steps === 6 ? 0.06 : 0.08);
      if (s.steps === 8 && (beat === 2 || beat === 6) && s.drums === 2) this.snare(t, 0.18);
    }
    this.step++;
    if (this.step % s.steps === 0) this.bar++;
  }

  private env(g: GainNode, t: number, peak: number, a: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private osc(type: OscillatorType, f: number, t: number, len: number, out: AudioNode, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    o.connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
    return o;
  }

  private pad(notes: number[], t: number, len: number, vol: number, bright: number) {
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = bright;
    f.connect(g).connect(this.songBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07 * vol, t + Math.min(1.2, len / 3));
    g.gain.setValueAtTime(0.07 * vol, t + len - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.9);
    for (const n of notes) {
      this.osc('sawtooth', hz(n), t, len + 1, f, -7);
      this.osc('sawtooth', hz(n), t, len + 1, f, 7);
    }
  }

  private pluck(n: number, t: number, vol: number) {
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 0.4);
    f.connect(g).connect(this.songBus);
    this.env(g, t, vol, 0.004, 0.7);
    this.osc('triangle', hz(n), t, 0.8, f);
    this.osc('sawtooth', hz(n), t, 0.8, f, 3);
  }

  private bassNote(n: number, t: number, len: number) {
    const g = this.ctx.createGain();
    g.connect(this.songBus);
    this.env(g, t, 0.22, 0.01, len);
    this.osc('triangle', hz(n), t, len + 0.1, g);
  }

  private lead(n: number, t: number, len: number) {
    const g = this.ctx.createGain();
    g.connect(this.songBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.06);
    g.gain.setValueAtTime(0.07, t + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.35);
    const o = this.osc('sine', hz(n), t, len + 0.4, g);
    // A flute-ish vibrato.
    const lfo = this.ctx.createOscillator();
    const depth = this.ctx.createGain();
    lfo.frequency.value = 5;
    depth.gain.value = 6;
    lfo.connect(depth).connect(o.detune);
    lfo.start(t);
    lfo.stop(t + len + 0.4);
    this.osc('sine', hz(n + 12), t, len + 0.4, g).detune.value = 4;
  }

  private kick(t: number, vol: number, out: AudioNode = this.songBus) {
    const g = this.ctx.createGain();
    g.connect(out);
    this.env(g, t, vol, 0.003, 0.3);
    const o = this.osc('sine', 120, t, 0.35, g);
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
  }

  private tom(t: number, vol: number) {
    const g = this.ctx.createGain();
    g.connect(this.songBus);
    this.env(g, t, vol, 0.003, 0.25);
    const o = this.osc('sine', 200, t, 0.3, g);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.2);
  }

  private noiseHit(
    t: number,
    vol: number,
    len: number,
    type: BiquadFilterType,
    freq: number,
    out: AudioNode,
    q = 1,
    buf = this.noise,
  ) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    src.connect(f).connect(g).connect(out);
    this.env(g, t, vol, 0.002, len);
    src.start(t, Math.random() * 1.5);
    src.stop(t + len + 0.05);
    return { f, g };
  }

  private hat(t: number, vol: number) {
    this.noiseHit(t, vol, 0.05, 'highpass', 7000, this.songBus);
  }

  private snare(t: number, vol: number) {
    this.noiseHit(t, vol, 0.14, 'bandpass', 1800, this.songBus, 0.8);
  }

  // ---------------------------------------------------------------- ambience

  setAmbience(a: Ambience) {
    if (a === this.ambience) return;
    this.ambience = a;
    this.bed?.stop();
    this.bed = null;
    const beds: Partial<Record<Ambience, [BiquadFilterType, number, number, boolean]>> = {
      tavern: ['bandpass', 500, 0.05, false],
      fire: ['lowpass', 300, 0.06, true],
      cave: ['lowpass', 180, 0.1, true],
      river: ['bandpass', 900, 0.05, false],
      forest: ['bandpass', 1200, 0.02, false],
      marsh: ['lowpass', 400, 0.05, true],
      wind: ['bandpass', 500, 0.08, true],
      forge: ['lowpass', 140, 0.16, true],
      night: ['lowpass', 250, 0.04, true],
    };
    const b = beds[a];
    if (!b) return;
    const [type, freq, vol, brown] = b;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = brown ? this.brown : this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = a === 'wind' ? 6 : 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 2);
    src.connect(f).connect(g).connect(this.bus.ambience);
    // Wind and murmur swell slowly.
    const lfo = this.ctx.createOscillator();
    const depth = this.ctx.createGain();
    lfo.frequency.value = a === 'wind' ? 0.07 : 0.15;
    depth.gain.value = a === 'wind' ? 300 : freq * 0.3;
    lfo.connect(depth).connect(f.frequency);
    lfo.start(t);
    src.start(t);
    this.bed = {
      stop: () => {
        const s = this.ctx.currentTime;
        g.gain.cancelScheduledValues(s);
        g.gain.setValueAtTime(g.gain.value, s);
        g.gain.linearRampToValueAtTime(0.0001, s + 1.5);
        src.stop(s + 1.6);
        lfo.stop(s + 1.6);
      },
    };
  }

  private ambientEvents(t: number, dt: number) {
    const a = this.ambience;
    const out = this.bus.ambience;
    const chance = (perSecond: number) => Math.random() < perSecond * dt;
    if (
      (a === 'tavern' || a === 'fire' || a === 'forge' || a === 'night') &&
      chance(a === 'night' ? 3 : 6)
    )
      this.noiseHit(t + rnd(0, 0.05), rnd(0.02, 0.08), 0.02, 'bandpass', rnd(1500, 4000), out, 2);
    if (a === 'tavern' && chance(0.35)) {
      // A clink of mugs.
      const f = rnd(1800, 3200);
      for (const k of [0, 0.07]) {
        const g = this.ctx.createGain();
        g.connect(out);
        this.env(g, t + k, 0.03, 0.002, 0.25);
        this.osc('sine', f * (1 + k), t + k, 0.3, g);
      }
    }
    if (a === 'cave' && chance(0.4)) {
      // A water drip, with a little echo.
      for (const [k, v] of [
        [0, 0.07],
        [0.18, 0.025],
      ] as const) {
        const g = this.ctx.createGain();
        g.connect(out);
        this.env(g, t + k, v, 0.002, 0.12);
        const o = this.osc('sine', 1400, t + k, 0.15, g);
        o.frequency.exponentialRampToValueAtTime(600, t + k + 0.1);
      }
    }
    if (a === 'forest' && chance(0.5)) {
      // Bird calls.
      const f = rnd(2400, 4200);
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const s = t + i * 0.13;
        const g = this.ctx.createGain();
        g.connect(out);
        this.env(g, s, 0.025, 0.01, 0.09);
        const o = this.osc('sine', f, s, 0.1, g);
        o.frequency.exponentialRampToValueAtTime(f * rnd(1.2, 1.5), s + 0.08);
      }
    }
    if (a === 'marsh' && chance(0.6)) {
      // A frog's croak.
      const f = rnd(110, 220);
      for (let i = 0; i < 3; i++) {
        const s = t + i * 0.06;
        const g = this.ctx.createGain();
        const lp = this.ctx.createBiquadFilter();
        lp.frequency.value = 900;
        lp.connect(g).connect(out);
        this.env(g, s, 0.03, 0.005, 0.05);
        this.osc('sawtooth', f, s, 0.06, lp);
      }
    }
    if ((a === 'night' || a === 'marsh') && chance(1.2)) {
      // Crickets.
      for (let i = 0; i < 4; i++) {
        const g = this.ctx.createGain();
        g.connect(out);
        this.env(g, t + i * 0.035, 0.008, 0.003, 0.02);
        this.osc('sine', 4300, t + i * 0.035, 0.03, g);
      }
    }
    if (a === 'forge' && chance(0.25)) this.clang(t, 0.06, out);
  }

  private clang(t: number, vol: number, out: AudioNode) {
    for (const [m, v] of [
      [1, 1],
      [2.76, 0.5],
      [5.4, 0.25],
    ] as const) {
      const g = this.ctx.createGain();
      g.connect(out);
      this.env(g, t, vol * v, 0.002, 0.6);
      this.osc('sine', 420 * m, t, 0.7, g);
    }
    this.noiseHit(t, vol, 0.05, 'highpass', 3000, out);
  }

  // ---------------------------------------------------------------- effects

  play(cue: Cue) {
    const t = this.ctx.currentTime + 0.01;
    const fx = this.bus.effects;
    const tone = (
      type: OscillatorType,
      f: number,
      at: number,
      len: number,
      vol: number,
      to?: number,
    ) => {
      const g = this.ctx.createGain();
      g.connect(fx);
      this.env(g, at, vol, 0.005, len);
      const o = this.osc(type, f, at, len + 0.05, g);
      if (to) o.frequency.exponentialRampToValueAtTime(to, at + len);
      return o;
    };
    const sweep = (from: number, to: number, len: number, vol: number, q = 2, at = t) => {
      const { f } = this.noiseHit(at, vol, len, 'bandpass', from, fx, q);
      f.frequency.setValueAtTime(from, at);
      f.frequency.exponentialRampToValueAtTime(to, at + len);
    };
    switch (cue) {
      case 'click':
        tone('sine', 900, t, 0.03, 0.03);
        break;
      case 'hit':
        this.noiseHit(t, 0.35, 0.12, 'bandpass', 1400, fx, 0.9);
        this.kick(t, 0.4, fx);
        break;
      case 'crit':
        this.noiseHit(t, 0.4, 0.15, 'bandpass', 1400, fx, 0.9);
        this.kick(t, 0.55, fx);
        this.clang(t + 0.02, 0.12, fx);
        break;
      case 'miss':
        sweep(500, 2400, 0.22, 0.2);
        break;
      case 'arrow':
        tone('triangle', 260, t, 0.12, 0.12, 180);
        sweep(1800, 900, 0.18, 0.12, 3, t + 0.02);
        this.kick(t + 0.2, 0.25, fx);
        break;
      case 'block':
        this.clang(t, 0.1, fx);
        break;
      case 'spell-fire':
        sweep(200, 1600, 0.5, 0.35, 0.8);
        for (let i = 0; i < 8; i++)
          this.noiseHit(
            t + 0.1 + Math.random() * 0.4,
            0.08,
            0.02,
            'bandpass',
            rnd(1500, 3500),
            fx,
            2,
          );
        break;
      case 'spell-cold':
        for (const [i, f] of [1568, 2093, 2637, 3136].entries())
          tone('sine', f, t + i * 0.05, 0.5, 0.05);
        sweep(6000, 3000, 0.4, 0.1, 1);
        break;
      case 'spell-lightning':
        this.noiseHit(t, 0.45, 0.25, 'highpass', 1200, fx);
        tone('sawtooth', 900, t, 0.25, 0.08, 120);
        break;
      case 'spell-thunder':
        this.noiseHit(t, 0.5, 0.8, 'lowpass', 220, fx, 0.7, this.brown);
        this.kick(t, 0.6, fx);
        break;
      case 'spell-radiant':
        for (const [i, n] of [72, 76, 79, 84].entries())
          tone('sine', hz(n), t + i * 0.04, 0.9, 0.06);
        break;
      case 'spell-necrotic':
        tone('sawtooth', 70, t, 0.7, 0.12, 50);
        tone('sawtooth', 73, t, 0.7, 0.1, 52);
        sweep(800, 200, 0.6, 0.12, 1);
        break;
      case 'spell-acid':
      case 'spell-poison':
        for (let i = 0; i < 6; i++)
          tone('sine', rnd(300, 700), t + i * 0.06, 0.06, 0.06, rnd(800, 1200));
        break;
      case 'spell-psychic':
        tone('sine', 440, t, 0.6, 0.08, 220).detune.value = 30;
        tone('sine', 466, t, 0.6, 0.06, 233);
        break;
      case 'spell-heal':
        for (const [i, n] of [72, 76, 79, 84, 88].entries())
          tone('sine', hz(n), t + i * 0.07, 0.6, 0.06);
        break;
      case 'spell-force':
      case 'spell-arcane':
        tone('sine', 400, t, 0.35, 0.1, 1300);
        for (let i = 0; i < 4; i++) tone('sine', rnd(2000, 3500), t + 0.1 + i * 0.05, 0.12, 0.03);
        break;
      case 'down':
        tone('sine', 220, t, 0.6, 0.18, 55);
        this.kick(t, 0.3, fx);
        break;
      case 'death':
        sweep(900, 150, 0.35, 0.18, 1);
        this.kick(t + 0.05, 0.3, fx);
        break;
      case 'victory':
        for (const [i, n] of [60, 64, 67, 72].entries())
          tone('triangle', hz(n), t + i * 0.12, 0.35, 0.12);
        for (const n of [60, 64, 67, 72]) tone('triangle', hz(n), t + 0.55, 1.2, 0.06);
        break;
      case 'defeat':
        for (const [i, n] of [64, 63, 60, 55].entries())
          tone('triangle', hz(n), t + i * 0.3, 0.5, 0.1);
        break;
      case 'levelup':
        for (const [i, n] of [67, 72, 76, 79, 84].entries())
          tone('triangle', hz(n), t + i * 0.08, 0.5, 0.1);
        for (const n of [72, 76, 79]) tone('sine', hz(n), t + 0.45, 1.4, 0.05);
        break;
      case 'dice':
        for (let i = 0; i < 5; i++)
          this.noiseHit(t + i * rnd(0.03, 0.07), 0.12, 0.02, 'bandpass', rnd(2500, 4000), fx, 3);
        break;
      case 'success':
        tone('sine', hz(76), t, 0.25, 0.08);
        tone('sine', hz(83), t + 0.1, 0.4, 0.08);
        break;
      case 'fail':
        tone('triangle', hz(57), t, 0.25, 0.1);
        tone('triangle', hz(52), t + 0.12, 0.4, 0.1);
        break;
      case 'quest':
        for (const [i, n] of [72, 79, 84, 88].entries())
          tone('sine', hz(n), t + i * 0.1, 0.9, 0.06);
        break;
      case 'item':
        tone('sine', 2637, t, 0.25, 0.06);
        tone('sine', 3136, t + 0.08, 0.35, 0.06);
        break;
      case 'page':
        sweep(1200, 3000, 0.25, 0.08, 0.6);
        break;
      case 'steps':
        for (let i = 0; i < 4; i++) this.noiseHit(t + i * 0.32, 0.12, 0.06, 'lowpass', 400, fx, 1);
        break;
    }
  }
}

let engine: Engine | null = null;
let failed = false;

/** The one sound engine, made on the first click or key press (browsers block sound before that). */
function get(): Engine | null {
  if (engine || failed) return engine;
  try {
    const Ctx: typeof AudioContext | undefined =
      typeof window === 'undefined'
        ? undefined
        : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) {
      failed = true;
      return null;
    }
    engine = new Engine(new Ctx());
  } catch {
    failed = true;
  }
  return engine;
}

let pending: { volumes?: Volumes; mood?: Mood; ambience?: Ambience } = {};
let unlocked = false;

export const sound = {
  /** Call from a click or key press: starts the audio. */
  unlock() {
    if (unlocked) {
      engine?.resume();
      return;
    }
    const e = get();
    if (!e) return;
    unlocked = true;
    e.resume();
    if (pending.volumes) e.setVolumes(pending.volumes);
    if (pending.mood) e.setMood(pending.mood);
    if (pending.ambience) e.setAmbience(pending.ambience);
  },
  setVolumes(v: Volumes) {
    pending.volumes = v;
    if (unlocked) engine?.setVolumes(v);
  },
  setMood(m: Mood) {
    pending.mood = m;
    if (unlocked) engine?.setMood(m);
  },
  setAmbience(a: Ambience) {
    pending.ambience = a;
    if (unlocked) engine?.setAmbience(a);
  },
  play(cue: Cue, delayMs = 0) {
    if (!unlocked || !engine) return;
    if (delayMs) window.setTimeout(() => engine?.play(cue), delayMs);
    else engine.play(cue);
  },
};

// Only for tests.
export const _resetSound = () => {
  pending = {};
};
