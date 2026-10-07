// Pruebas rápidas: charts de las canciones incluidas y el convertidor MIDI.
// Ejecuta: node tools/test.mjs

import assert from 'node:assert/strict';
import { BUILTIN_SONGS, composeSong, chartsFromNotes } from '../web/js/procedural.js';
import { parseMidi, buildCharts } from './midi2chart.mjs';

let ok = 0;
const check = (name, fn) => { fn(); ok++; console.log('  ✔', name); };

console.log('Canciones incluidas');
for (const def of BUILTIN_SONGS) {
  const composed = composeSong(def);
  const charts = chartsFromNotes(composed.notes);
  check(`${def.title}: ${charts.facil.length}/${charts.normal.length}/${charts.dificil.length} notas, ${composed.duration.toFixed(0)} s`, () => {
    assert.ok(charts.facil.length > 10);
    assert.ok(charts.facil.length < charts.normal.length);
    assert.ok(charts.normal.length <= charts.dificil.length);
    for (const d of Object.values(charts)) {
      for (let i = 0; i < d.length; i++) {
        const n = d[i];
        assert.ok(n.lane >= 0 && n.lane < 4);
        assert.ok(n.t > 0 && n.t + n.len < composed.duration);
        if (i) assert.ok(n.t >= d[i - 1].t + d[i - 1].len, 'ninguna nota empieza durante una sostenida');
      }
    }
    // determinista: misma semilla, mismo chart
    assert.deepEqual(chartsFromNotes(composeSong(def).notes), charts);
  });
}

// --- MIDI sintético: 120 BPM, ppq 480, escala en corcheas + una nota larga ---
function vlq(n) { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; }
function makeMidi() {
  const ppq = 480;
  const ev = [0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20]; // 500000 us = 120 BPM
  const name = [...Buffer.from('Melodia')];
  ev.push(0x00, 0xff, 0x03, name.length, ...name);
  const pitches = [60, 62, 64, 67, 69, 67, 64, 62];
  pitches.forEach((p, i) => {
    ev.push(...vlq(0), 0x90, p, 100, ...vlq(ppq / 2), 0x80, p, 0);
  });
  ev.push(...vlq(0), 0x90, 72, 100, ...vlq(ppq * 2), 0x80, 72, 0); // nota larga
  ev.push(0x00, 0xff, 0x2f, 0x00);
  const trk = Buffer.concat([Buffer.from('MTrk'), Buffer.from([0, 0, ev.length >> 8, ev.length & 255].map((x, i) => (i < 2 ? 0 : x))), Buffer.from(ev)]);
  const hdr = Buffer.from([...Buffer.from('MThd'), 0, 0, 0, 6, 0, 0, 0, 1, ppq >> 8, ppq & 255]);
  return Buffer.concat([hdr, trk]);
}

console.log('Convertidor MIDI');
const midi = parseMidi(makeMidi());
check('lee tempo, pista y notas', () => {
  assert.equal(midi.bpm, 120);
  assert.equal(midi.tracks[0].name, 'Melodia');
  assert.equal(midi.tracks[0].notes.length, 9);
  assert.equal(midi.tickToSec(480), 0.5);
});
const { charts } = buildCharts(midi, {});
check(`genera niveles ${charts.facil.length}/${charts.normal.length}/${charts.dificil.length}`, () => {
  assert.equal(charts.dificil.length, 9);
  assert.equal(charts.dificil[1][0], 0.25);          // segunda corchea a 0.25 s
  assert.ok(charts.normal.length === 5);             // tiempos 0,1,2,3 + nota larga
  assert.ok(charts.facil.length === 3);              // tiempos 0,2 + nota larga
  const last = charts.dificil[charts.dificil.length - 1];
  assert.ok(last[2] > 0.9, 'la nota larga es sostenida');
  assert.equal(charts.dificil[0][1], 0);             // tono más grave -> carril 1
  assert.equal(last[1], 3);                          // tono más agudo -> carril 4
});

console.log(`\n${ok} pruebas correctas`);
