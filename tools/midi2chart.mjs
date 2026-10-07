#!/usr/bin/env node
// midi2chart — convierte un archivo MIDI en chart.json para Balam Beat.
//
// Uso:
//   node tools/midi2chart.mjs cancion.mid --title "Cobán" --artist "Arreglo 5to Bach" \
//        --audio audio.ogg --out web/songs/coban/chart.json
//
// Opciones:
//   --track <n|nombre>   pista con la melodía (por defecto: la que tenga más notas)
//   --lanes 60,62,64,67  tono exacto de cada carril; los demás se asignan al más cercano
//                        (por defecto: se reparten los tonos usados en 4 grupos)
//   --offset <s>         segundos a sumar a todas las notas (si el audio tiene silencio inicial)
//
// Si el MIDI trae pistas llamadas "facil", "normal" y "dificil" (o easy/medium/hard),
// se usan tal cual como charts hechos a mano. Si no, los 3 niveles se generan
// automáticamente a partir de la melodía.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// --------------------------- lector MIDI ---------------------------
export function parseMidi(buf) {
  let pos = 0;
  const u8 = () => buf[pos++];
  const u16 = () => (buf[pos++] << 8) | buf[pos++];
  const u32 = () => ((buf[pos++] << 24) | (buf[pos++] << 16) | (buf[pos++] << 8) | buf[pos++]) >>> 0;
  const str = (n) => { const s = buf.slice(pos, pos + n).toString('latin1'); pos += n; return s; };
  const varlen = () => { let v = 0, b; do { b = u8(); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

  if (str(4) !== 'MThd') throw new Error('No es un archivo MIDI válido');
  const hlen = u32();
  const format = u16(), ntrks = u16(), division = u16();
  pos += hlen - 6;
  if (division & 0x8000) throw new Error('MIDI con tiempo SMPTE no soportado; exporta con PPQ');

  const tracks = [];
  const tempos = [];
  for (let ti = 0; ti < ntrks; ti++) {
    if (str(4) !== 'MTrk') throw new Error('Pista MIDI corrupta');
    const end = pos + u32();
    const track = { name: '', notes: [] };
    const open = new Map();
    let tick = 0, status = 0;
    while (pos < end) {
      tick += varlen();
      let b = buf[pos];
      if (b & 0x80) { status = b; pos++; }
      const type = status & 0xf0;
      if (status === 0xff) {
        const meta = u8(), len = varlen();
        if (meta === 0x51) tempos.push({ tick, uspq: (buf[pos] << 16) | (buf[pos + 1] << 8) | buf[pos + 2] });
        if (meta === 0x03) track.name = buf.slice(pos, pos + len).toString('utf8');
        pos += len;
        if (meta === 0x2f) break;
      } else if (status === 0xf0 || status === 0xf7) {
        pos += varlen();
      } else if (type === 0x90 || type === 0x80) {
        const note = u8(), vel = u8();
        const ch = status & 0x0f;
        const key = ch * 128 + note;
        if (type === 0x90 && vel > 0) {
          if (!open.has(key)) open.set(key, []);
          open.get(key).push(tick);
        } else {
          const starts = open.get(key);
          if (starts && starts.length) {
            const s = starts.shift();
            track.notes.push({ tick: s, dur: tick - s, pitch: note, ch });
          }
        }
      } else if (type === 0xc0 || type === 0xd0) {
        pos += 1;
      } else {
        pos += 2; // A0, B0, E0
      }
    }
    pos = end;
    track.notes.sort((a, b) => a.tick - b.tick || b.pitch - a.pitch);
    tracks.push(track);
  }

  tempos.sort((a, b) => a.tick - b.tick);
  if (!tempos.length || tempos[0].tick > 0) tempos.unshift({ tick: 0, uspq: 500000 });

  // mapa de tempo -> segundos
  const segs = [];
  let sec = 0;
  for (let i = 0; i < tempos.length; i++) {
    const t = tempos[i];
    if (i > 0) {
      const p = tempos[i - 1];
      sec += ((t.tick - p.tick) * p.uspq) / 1e6 / division;
    }
    segs.push({ tick: t.tick, sec, uspq: t.uspq });
  }
  const tickToSec = (tick) => {
    let s = segs[0];
    for (const x of segs) { if (x.tick <= tick) s = x; else break; }
    return s.sec + ((tick - s.tick) * s.uspq) / 1e6 / division;
  };

  return { format, ppq: division, tracks, tempos, tickToSec, bpm: Math.round(60e6 / tempos[0].uspq) };
}

// --------------------------- asignación de carriles ---------------------------
function laneMapper(notes, lanesArg) {
  if (lanesArg) {
    const targets = lanesArg.split(',').map(Number);
    return (p) => {
      let best = 0;
      targets.forEach((t, i) => { if (Math.abs(p - t) < Math.abs(p - targets[best])) best = i; });
      return best;
    };
  }
  const pitches = [...new Set(notes.map((n) => n.pitch))].sort((a, b) => a - b);
  if (pitches.length <= 4) {
    const offset = Math.floor((4 - pitches.length) / 2);
    return (p) => pitches.indexOf(p) + offset;
  }
  return (p) => Math.min(3, Math.floor((pitches.indexOf(p) * 4) / pitches.length));
}

// --------------------------- generación de niveles ---------------------------
export function buildCharts(midi, opts = {}) {
  const { ppq, tracks, tickToSec } = midi;
  const offset = Number(opts.offset || 0);
  const named = {};
  const re = { facil: /f[aá]cil|easy/i, normal: /normal|medium/i, dificil: /dif[ií]cil|hard|expert/i };
  for (const tr of tracks) {
    for (const [d, r] of Object.entries(re)) if (r.test(tr.name) && tr.notes.length) named[d] = tr;
  }

  const toChart = (notes, map) => notes.map((n) => {
    const t = tickToSec(n.tick) + offset;
    const holdTicks = n.dur >= ppq ? n.dur : 0;
    const len = holdTicks ? Math.max(0, tickToSec(n.tick + holdTicks) + offset - t - 0.05) : 0;
    return { t: +t.toFixed(3), lane: map(n.pitch), len: +len.toFixed(3), tick: n.tick };
  });

  // charts hechos a mano en pistas con nombre
  if (named.facil && named.normal && named.dificil) {
    const all = [...named.facil.notes, ...named.normal.notes, ...named.dificil.notes];
    const map = laneMapper(all, opts.lanes);
    const out = {};
    for (const d of ['facil', 'normal', 'dificil']) out[d] = toChart(named[d].notes, map).map(strip);
    return { charts: out, source: 'pistas con nombre' };
  }

  // melodía automática
  let track;
  if (opts.track != null) {
    const n = Number(opts.track);
    track = Number.isInteger(n) ? tracks[n] : tracks.find((t) => t.name.toLowerCase().includes(String(opts.track).toLowerCase()));
    if (!track) throw new Error(`No encontré la pista "${opts.track}"`);
  } else {
    track = tracks.reduce((a, b) => (b.notes.length > a.notes.length ? b : a));
  }
  if (!track.notes.length) throw new Error('La pista elegida no tiene notas');

  const map = laneMapper(track.notes, opts.lanes);
  const notes = toChart(track.notes, map);

  // acordes: agrupa notas casi simultáneas
  const groups = [];
  for (const n of notes) {
    const g = groups[groups.length - 1];
    if (g && Math.abs(g[0].tick - n.tick) <= ppq / 16) g.push(n); else groups.push([n]);
  }

  const level = (filterTick, minGap, maxChord) => {
    const out = [];
    let busyUntil = -Infinity;
    for (const g of groups) {
      if (!filterTick(g[0].tick, g)) continue;
      const t = g[0].t;
      if (t - busyUntil < minGap) continue;
      const lanes = new Set();
      const picked = [];
      for (const n of g) { // ya vienen del tono más agudo al más grave
        if (lanes.has(n.lane) || picked.length >= maxChord) continue;
        lanes.add(n.lane);
        picked.push(n);
      }
      for (const n of picked) out.push(strip(n));
      busyUntil = t + Math.max(...picked.map((n) => n.len));
    }
    return out;
  };

  const tol = ppq / 8;
  const onGrid = (tick, step) => { const r = tick % step; return r <= tol || step - r <= tol; };
  const hasHold = (g) => g.some((n) => n.len > 0);

  return {
    source: `pista "${track.name || 'sin nombre'}" (${track.notes.length} notas)`,
    charts: {
      dificil: level(() => true, 0.09, 2),
      normal: level((tick, g) => onGrid(tick, ppq) || hasHold(g), 0.2, 1),
      facil: level((tick, g) => onGrid(tick, ppq * 2) || hasHold(g), 0.45, 1),
    },
  };
}

const strip = (n) => [n.t, n.lane, n.len];

// --------------------------- línea de comandos ---------------------------
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('midi2chart.mjs');
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const file = args._[0];
  if (!file) {
    console.log('Uso: node tools/midi2chart.mjs archivo.mid [--title T] [--artist A] [--audio audio.ogg] [--track N] [--lanes 60,62,64,67] [--offset 0] [--out chart.json]');
    process.exit(1);
  }
  const midi = parseMidi(readFileSync(file));
  const { charts, source } = buildCharts(midi, args);
  const chart = {
    title: args.title || file.replace(/^.*[\\/]/, '').replace(/\.midi?$/i, ''),
    artist: args.artist || '',
    style: args.style || '',
    bpm: midi.bpm,
    audio: args.audio || 'audio.ogg',
    offset: 0,
    charts,
  };
  const out = args.out || 'chart.json';
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(chart, null, 1).replace(/\[\n\s+([\d.-]+),\n\s+(\d),\n\s+([\d.]+)\n\s+\]/g, '[$1,$2,$3]'));
  console.log(`✔ ${out}  (${source}, ${midi.bpm} BPM)`);
  for (const d of ['facil', 'normal', 'dificil']) console.log(`   ${d.padEnd(8)} ${charts[d].length} notas`);
}
