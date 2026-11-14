// Tiny synthesized sound effects (Web Audio, no files). Every call is safe before the first
// user gesture and when audio is unavailable: it just does nothing.
// Rule of thumb for match feedback: pitch climbs with each cascade so chains feel like they build.

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // major pentatonic, in semitones
const note = (base: number, step: number) => base * Math.pow(2, SCALE[Math.min(step, SCALE.length - 1)] / 12);

function ac(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  return ctx.state === 'running' ? ctx : null;
}

function tone(freq: number, dur: number, opts: { type?: Wave; vol?: number; slide?: number; delay?: number } = {}): void {
  const a = ac();
  if (!a || !master) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = opts.type ?? 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slide), t0 + dur);
  const vol = opts.vol ?? 0.5;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol: number, delay = 0): void {
  const a = ac();
  if (!a || !master) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  const gain = a.createGain();
  gain.gain.value = vol;
  src.buffer = buf;
  src.connect(gain).connect(master);
  src.start(a.currentTime + delay);
}

export const sfx = {
  setEnabled(on: boolean): void { enabled = on; },
  /** Call from a pointer/keyboard handler: browsers only start audio after a user gesture. */
  unlock(): void {
    if (!enabled) return;
    try {
      if (!ctx) ac();
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    } catch { /* audio is optional */ }
  },
  tap(): void { tone(660, 0.04, { type: 'triangle', vol: 0.25 }); },
  swap(): void { tone(320, 0.07, { type: 'triangle', vol: 0.35, slide: 420 }); },
  invalid(): void { tone(190, 0.14, { type: 'sawtooth', vol: 0.3, slide: 110 }); },
  /** A match clears. `combo` is the cascade number (1 = first clear of the move). */
  match(combo: number): void {
    const f = note(523.25, combo - 1);
    tone(f, 0.09, { vol: 0.4 });
    tone(f * 1.5, 0.12, { vol: 0.3, delay: 0.05, type: 'triangle' });
  },
  land(): void { tone(120, 0.05, { type: 'sine', vol: 0.35 }); },
  collect(): void { tone(1320, 0.035, { type: 'triangle', vol: 0.18 }); },
  /** A special tile is created. */
  create(): void { [0, 2, 4].forEach((s, i) => tone(note(659.25, s), 0.09, { vol: 0.35, delay: i * 0.05, type: 'triangle' })); },
  line(): void { tone(1100, 0.25, { type: 'sawtooth', vol: 0.3, slide: 180 }); noise(0.15, 0.12); },
  bomb(): void { tone(140, 0.3, { vol: 0.5, slide: 45 }); noise(0.25, 0.25); },
  sigil(): void { [0, 2, 4, 5, 7, 9].forEach((s, i) => tone(note(392, s), 0.16, { vol: 0.3, delay: i * 0.045, type: 'triangle' })); noise(0.3, 0.1, 0.1); },
  /** Combo callout sting; higher combos start higher. */
  combo(combo: number): void { [0, 2, 4].forEach((s, i) => tone(note(587.33, s + combo - 2), 0.12, { vol: 0.4, delay: i * 0.06 })); },
  /** One tick of the leftover-moves bonus count. */
  tick(i: number): void { tone(note(783.99, i % 8), 0.05, { type: 'triangle', vol: 0.35 }); },
  star(i: number): void { tone([783.99, 987.77, 1318.5][i] ?? 1318.5, 0.22, { type: 'triangle', vol: 0.45 }); tone(([783.99, 987.77, 1318.5][i] ?? 1318.5) * 2, 0.15, { vol: 0.15, delay: 0.03 }); },
  win(): void { [0, 2, 4, 5, 7].forEach((s, i) => tone(note(523.25, s), 0.18, { vol: 0.4, delay: i * 0.08, type: 'triangle' })); },
  lose(): void { [4, 2, 1, 0].forEach((s, i) => tone(note(261.63, s), 0.2, { vol: 0.35, delay: i * 0.12, type: 'sawtooth' })); },
  reshuffle(): void { tone(300, 0.3, { type: 'triangle', vol: 0.3, slide: 900 }); },
  intro(): void { tone(200, 0.35, { type: 'triangle', vol: 0.25, slide: 700 }); },
  /** Short haptic tap where supported. */
  buzz(ms: number): void { try { if (enabled) navigator.vibrate?.(ms); } catch { /* optional */ } },
};
