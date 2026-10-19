// Quiet sound for the landing sequence, made in the browser with the Web
// Audio API so there are no files to download. Browsers only allow sound
// after the visitor taps something, so this only ever plays from the Sound
// button (which replays the sequence) or the Register button.
//
// The cues follow the landing timing map: soft plucks as the eight scaffold
// lines draw, small ticks for the corner nodes, a warm chord as the mark
// rises, a chime with the gold wipe and an airy sweep as the scaffold
// withdraws. Everything sits well below normal speaking volume.

let ctx = null;
let out = null;
let live = [];

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.ratio.value = 3;
    out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// One soft note: a sine or triangle with a gentle attack and a long tail.
function note(at, freq, { type = "sine", gain = 0.05, attack = 0.01, decay = 0.9, detune = 0 } = {}) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
  live.push(osc);
}

// Filtered noise that sweeps downwards: the scaffold leaving.
function sweep(at, dur, from, to, gain) {
  const t = ctx.currentTime + at;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(from, t);
  band.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(band).connect(env).connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
  live.push(src);
}

export function stop() {
  for (const n of live) { try { n.stop(); } catch { /* already finished */ } }
  live = [];
}

// The full sequence, about 4.5 seconds.
export function playIntro({ reduced = false } = {}) {
  if (!audio()) return;
  stop();
  if (reduced) {
    // No motion, so no score: one chime to acknowledge the tap.
    note(0.05, 1318.5, { gain: 0.035, decay: 1.6 });
    note(0.05, 2637, { gain: 0.008, decay: 1.2 });
    return;
  }
  // Ground: a low warm pad under the grid fading in.
  note(0.05, 110, { gain: 0.03, attack: 0.9, decay: 2.4 });
  note(0.05, 164.8, { gain: 0.018, attack: 1.1, decay: 2.2 });
  // Eight scaffold lines, 0.50s to 1.38s: rising pentatonic plucks in A.
  const plucks = [440, 523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7];
  const at = [0.5, 0.62, 0.74, 0.86, 1.02, 1.14, 1.26, 1.38];
  plucks.forEach((f, i) => note(at[i], f, { type: "triangle", gain: 0.022, attack: 0.004, decay: 0.55 }));
  // Corner nodes, 1.30s to 1.60s: tiny high ticks.
  [1.3, 1.4, 1.5, 1.6].forEach((t) => note(t, 1760, { gain: 0.01, attack: 0.002, decay: 0.08 }));
  // The mark rises at 1.30s: a soft A major chord swelling in.
  [220, 277.2, 329.6, 440].forEach((f, i) => note(1.3, f, { gain: 0.022 - i * 0.003, attack: 0.7, decay: 2.2, detune: i % 2 ? 4 : -4 }));
  // Gold wipe behind "outlive" at 2.62s: a bell-like chime.
  note(2.62, 1318.5, { gain: 0.03, attack: 0.005, decay: 1.8 });
  note(2.62, 2637, { gain: 0.007, attack: 0.005, decay: 1.1 });
  // Scaffold withdraws, 3.25s: an airy downward sweep.
  sweep(3.25, 1.0, 2400, 500, 0.02);
  // Register button arrives at 3.95s: one low settling note.
  note(3.95, 220, { gain: 0.02, attack: 0.05, decay: 1.6 });
}

// A short two-note confirmation for the Register button.
export function playTap() {
  if (!ctx || ctx.state !== "running") return;
  note(0, 659.3, { type: "triangle", gain: 0.02, attack: 0.004, decay: 0.35 });
  note(0.09, 880, { type: "triangle", gain: 0.018, attack: 0.004, decay: 0.5 });
}
