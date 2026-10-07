// Canciones originales generadas por código (sin problemas de derechos).
// La melodía y el chart salen del MISMO patrón, así que cada nota que ves
// es una nota de marimba que escuchas. Las notas sostenidas suenan como
// "redoble" de marimba.

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
export const INTRO_BEATS = 8;   // 2 compases de introducción

// Crea un motivo de 2 compases (16 corcheas)
function makeMotif(rnd, def) {
  const slots = new Array(16).fill(null);
  let lane = Math.floor(rnd() * 4);
  let s = 0;
  while (s < 16) {
    const onBeat = s % 2 === 0;
    const p = onBeat ? def.density.on : def.density.off;
    if (rnd() < p) {
      // salto de carril tipo "paseo aleatorio" para que sea tocable
      const step = [-2, -1, -1, 1, 1, 2, 0][Math.floor(rnd() * 7)];
      lane = Math.max(0, Math.min(3, lane + step));
      let len = 0;
      if (onBeat && s <= 12 && rnd() < def.holdChance) {
        len = rnd() < 0.5 ? 2 : 4; // en corcheas
      }
      slots[s] = { lane, len };
      s += len > 0 ? len + 1 : 1;
    } else {
      s += 1;
    }
  }
  return slots;
}

function varyMotif(rnd, motif) {
  const v = motif.map((x) => (x ? { ...x } : null));
  for (let s = 12; s < 16; s++) {
    if (v[s] && rnd() < 0.6) v[s].lane = 3 - v[s].lane;
  }
  return v;
}

// Genera la partitura completa (todas las notas, nivel difícil)
export function composeSong(def) {
  const rnd = mulberry32(def.seed);
  const beat = 60 / def.bpm;
  const eighth = beat / 2;
  const t0 = INTRO_BEATS * beat;
  const notes = []; // { t, lane, len, slot, pitch }

  const phrases = Math.ceil(def.bars / 2);
  let motifs = null;
  let shifts = null;
  for (let p = 0; p < phrases; p++) {
    const sectionPos = p % 4; // forma A A B A'
    if (sectionPos === 0) {
      const a = makeMotif(rnd, def);
      const b = makeMotif(rnd, def);
      motifs = [a, a, b, varyMotif(rnd, a)];
      shifts = [0, 1, 2, 0].map((x) => (x + Math.floor(rnd() * 2)) % 4);
    }
    const motif = motifs[sectionPos];
    for (let s = 0; s < 16; s++) {
      const m = motif[s];
      if (!m) continue;
      const bar = p * 2 + Math.floor(s / 8);
      if (bar >= def.bars) continue;
      const slot = s % 8;
      const t = t0 + (bar * 8 + slot) * eighth;
      const pitch = def.root + 12 + PENTA[m.lane + shifts[sectionPos]];
      notes.push({ t, lane: m.lane, len: m.len * eighth, slot, pitch });
    }
  }

  // Final: nota larga en el carril central
  const endT = t0 + def.bars * 4 * beat;
  notes.push({ t: endT, lane: 1, len: beat * 2, slot: 0, pitch: def.root + 12 });

  const duration = endT + beat * 6;
  return { notes, beat, t0, duration };
}

// Saca los 3 niveles de dificultad a partir de la partitura
export function chartsFromNotes(notes) {
  const clean = (arr, minGap) => {
    const out = [];
    let last = -Infinity;
    for (const n of arr) {
      if (n.t - last < minGap) continue;
      out.push({ t: n.t, lane: n.lane, len: n.len });
      last = n.t + n.len;
    }
    return out;
  };
  return {
    dificil: clean(notes, 0.08),
    normal: clean(notes.filter((n) => n.slot % 2 === 0 || n.len > 0), 0.2),
    facil: clean(notes.filter((n) => n.slot % 4 === 0 || n.len > 0), 0.45),
  };
}

// ----------------------- Síntesis de audio -----------------------
// Se sintetiza muestra por muestra en JavaScript (no con nodos de Web Audio):
// así una canción de 90 s se genera en una fracción de segundo, incluso en la Raspberry.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const LN1000 = Math.log(1000);

function makeMix(sr, duration) {
  const n = Math.ceil(duration * sr);
  return { sr, L: new Float32Array(n), R: new Float32Array(n), n };
}

// Suma un buffer mono al mix con paneo (-1 izquierda, 1 derecha)
function addVoice(mix, start, buf, len, pan) {
  const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
  const { L, R, n } = mix;
  const i0 = Math.max(0, -start), i1 = Math.min(len, n - start);
  for (let i = i0; i < i1; i++) { const v = buf[i]; L[start + i] += v * gl; R[start + i] += v * gr; }
}

let scratch = new Float32Array(48000 * 6);
function tmp(len) {
  if (scratch.length < len) scratch = new Float32Array(len);
  scratch.fill(0, 0, len);
  return scratch;
}

function marimba(mix, t, midi, vel, pan) {
  const { sr } = mix;
  const f = mtof(midi);
  const len = Math.round(0.9 * sr);
  const buf = tmp(len);
  const attack = Math.round(0.003 * sr);
  for (const [mult, amp, dec] of [[1, 0.55, 0.9], [3.93, 0.18, 0.12], [9.2, 0.05, 0.04]]) {
    const w = (2 * Math.PI * f * mult) / sr;
    if (w >= Math.PI) continue;
    const plen = Math.round(dec * sr);
    const k = Math.exp(-LN1000 / plen);
    const c = 2 * Math.cos(w);
    let y1 = Math.sin(-w), y2 = Math.sin(-2 * w), env = amp * vel;
    for (let i = 0; i < plen; i++) {
      const y = c * y1 - y2; y2 = y1; y1 = y;
      buf[i] += y * env * (i < attack ? i / attack : 1);
      env *= k;
    }
  }
  addVoice(mix, Math.round(t * sr), buf, len, pan);
}

function tun(mix, t, vel, high) {
  const { sr } = mix;
  const f = high ? 220 : 140;
  const len = Math.round(0.32 * sr), glideLen = 0.05 * sr;
  const buf = tmp(len);
  const k = Math.exp(-LN1000 / len);
  let phase = 0, env = 0.9 * vel;
  for (let i = 0; i < len; i++) {
    const glide = i < glideLen ? 1 - i / glideLen : 0;
    phase += (2 * Math.PI * f * (1 + 0.6 * glide)) / sr;
    buf[i] = Math.sin(phase) * env;
    env *= k;
  }
  addVoice(mix, Math.round(t * sr), buf, len, high ? 0.25 : 0);
}

let seedNoise = 12345;
const noise = () => { seedNoise = (seedNoise * 1103515245 + 12345) & 0x7fffffff; return seedNoise / 0x3fffffff - 1; };

function shaker(mix, t, vel) {
  const { sr } = mix;
  const len = Math.round(0.06 * sr);
  const buf = tmp(len);
  const k = Math.exp(-LN1000 / len);
  const a = 0.85; // pasa-altos de un polo
  let y = 0, xp = 0, env = 0.12 * vel;
  for (let i = 0; i < len; i++) {
    const x = noise();
    y = a * (y + x - xp); xp = x;
    buf[i] = y * env;
    env *= k;
  }
  addVoice(mix, Math.round(t * sr), buf, len, -0.35);
}

function bass(mix, t, midi, dur) {
  const { sr } = mix;
  const f = mtof(midi);
  const len = Math.round(dur * sr);
  const buf = tmp(len);
  const k = Math.exp(-LN1000 / len);
  const sweep = Math.pow(220 / 900, 1 / len);
  let phase = 0, lp = 0, env = 0.28, cutoff = 900;
  for (let i = 0; i < len; i++) {
    phase += f / sr; if (phase >= 1) phase -= 1;
    lp += ((2 * Math.PI * cutoff) / sr) * (2 * phase - 1 - lp);
    buf[i] = lp * env;
    env *= k;
    cutoff *= sweep;
  }
  addVoice(mix, Math.round(t * sr), buf, len, 0);
}

function pad(mix, t, midis, dur) {
  const { sr } = mix;
  const len = Math.round(dur * sr);
  const alpha = 1 - Math.exp((-2 * Math.PI * 1100) / sr);
  for (const det of [-7, 7]) {
    const buf = tmp(len);
    for (const m of midis) {
      const inc = (mtof(m) * Math.pow(2, det / 1200)) / sr;
      let phase = 0, a1 = 0, a2 = 0;
      for (let i = 0; i < len; i++) {
        phase += inc; if (phase >= 1) phase -= 1;
        a1 += alpha * (2 * phase - 1 - a1);
        a2 += alpha * (a1 - a2);
        buf[i] += a2;
      }
    }
    for (let i = 0; i < len; i++) {
      const x = i / len;
      buf[i] *= 0.035 * (x < 0.3 ? x / 0.3 : (1 - x) / 0.7);
    }
    addVoice(mix, Math.round(t * sr), buf, len, det < 0 ? -0.6 : 0.6);
  }
}

// Genera las muestras estéreo (sin depender del navegador: se puede probar en Node)
export function renderSamples(def, composed, sr = 44100) {
  const { notes, beat, t0, duration } = composed;
  const mix = makeMix(sr, duration);
  seedNoise = def.seed;

  const totalBars = def.bars + 2;
  for (let bar = 0; bar < totalBars; bar++) {
    const barT = bar * 4 * beat;
    const songBar = bar - 2; // compases antes de 0 = intro
    const chordRoot = def.root + def.progression[((songBar % 4) + 4) % 4];
    pad(mix, barT, [chordRoot, chordRoot + 7, chordRoot + 12], beat * 4);
    for (let e = 0; e < 8; e++) {
      const t = barT + (e * beat) / 2;
      if (e === 0 || e === 4) tun(mix, t, 1, false);
      if (e === 3 || e === 6) tun(mix, t, 0.6, true);
      shaker(mix, t, e % 2 ? 1 : 0.5);
      if (songBar >= 0) bass(mix, t, chordRoot - 12, (beat / 2) * 0.9);
    }
  }

  for (const n of notes) {
    const pan = (n.lane - 1.5) * 0.25;
    if (n.len > 0) {
      for (let t = n.t; t < n.t + n.len; t += 0.085) marimba(mix, t, n.pitch, t === n.t ? 1 : 0.55, pan); // redoble
    } else {
      marimba(mix, n.t, n.pitch, 1, pan);
    }
  }

  const endT = t0 + def.bars * 4 * beat;
  pad(mix, endT, [def.root, def.root + 7, def.root + 12, def.root + 16], beat * 5);
  tun(mix, endT, 1, false);

  // normalizar
  let peak = 0;
  for (let i = 0; i < mix.n; i++) peak = Math.max(peak, Math.abs(mix.L[i]), Math.abs(mix.R[i]));
  const g = peak > 0 ? 0.89 / peak : 1;
  for (let i = 0; i < mix.n; i++) { mix.L[i] *= g; mix.R[i] *= g; }
  return mix;
}

export async function renderSong(def, composed, ctx) {
  const mix = renderSamples(def, composed, ctx.sampleRate);
  const buffer = ctx.createBuffer(2, mix.n, ctx.sampleRate);
  buffer.getChannelData(0).set(mix.L);
  buffer.getChannelData(1).set(mix.R);
  return buffer;
}


// ----------------------- Canciones incluidas -----------------------
export const BUILTIN_SONGS = [
  {
    id: 'primeros-pasos',
    title: 'Primeros Pasos',
    artist: 'Balam Beat (original)',
    style: 'Synthwave + tun · tutorial',
    bpm: 90, bars: 24, seed: 7, root: 57,              // La
    progression: [0, -3, 5, 7],
    density: { on: 0.65, off: 0.1 }, holdChance: 0.2,
  },
  {
    id: 'neon-coban',
    title: 'Neón en Cobán',
    artist: 'Balam Beat (original)',
    style: 'Marimba synthwave',
    bpm: 116, bars: 40, seed: 2026, root: 55,          // Sol
    progression: [0, 5, -3, 7],
    density: { on: 0.8, off: 0.35 }, holdChance: 0.18,
  },
  {
    id: 'jaguar-semuc',
    title: 'Jaguar de Semuc',
    artist: 'Balam Beat (original)',
    style: 'Percusión neón',
    bpm: 138, bars: 48, seed: 404, root: 52,           // Mi
    progression: [-3, 5, 0, 7],
    density: { on: 0.85, off: 0.55 }, holdChance: 0.12,
  },
];
