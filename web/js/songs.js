// Catálogo de canciones: las originales generadas por código + las que
// agregues en web/songs/ (audio + chart.json, ver songs/LEEME.md).

import { CONFIG } from './config.js';
import { BUILTIN_SONGS, composeSong, chartsFromNotes, renderSong } from './procedural.js';

const fmtDuration = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

function normalizeChart(list) {
  // Acepta [[t, carril, duración], ...] o [{t, lane, len}, ...]
  return list
    .map((n) => (Array.isArray(n) ? { t: n[0], lane: n[1], len: n[2] || 0 } : { t: n.t, lane: n.lane, len: n.len || 0 }))
    .filter((n) => n.lane >= 0 && n.lane < CONFIG.lanes)
    .sort((a, b) => a.t - b.t);
}

export async function loadCatalog() {
  const songs = BUILTIN_SONGS.map((def) => {
    const composed = composeSong(def);
    return {
      id: def.id,
      title: def.title,
      artist: def.artist,
      style: def.style,
      bpm: def.bpm,
      duration: composed.duration,
      durationLabel: fmtDuration(composed.duration),
      charts: chartsFromNotes(composed.notes),
      async loadAudio(audio) {
        if (!this._buffer) this._buffer = await renderSong(def, composed, audio.ctx);
        return this._buffer;
      },
    };
  });

  // Canciones externas (necesitan servir la carpeta web/ con un servidor local)
  if (location.protocol === 'file:') return songs; // abierto con doble clic: solo incluidas
  try {
    const res = await fetch(CONFIG.songsIndex, { cache: 'no-store' });
    if (res.ok) {
      const index = await res.json();
      for (const entry of index) {
        const folder = typeof entry === 'string' ? entry : entry.folder;
        try {
          const base = `songs/${folder}/`;
          const c = await (await fetch(base + 'chart.json', { cache: 'no-store' })).json();
          const offset = c.offset || 0;
          const charts = {};
          for (const d of CONFIG.difficultyOrder) {
            const src = (c.charts && c.charts[d]) || [];
            charts[d] = normalizeChart(src).map((n) => ({ ...n, t: n.t + offset }));
          }
          const last = Math.max(0, ...Object.values(charts).flat().map((n) => n.t + n.len));
          songs.push({
            id: `ext-${folder}`,
            title: c.title || folder,
            artist: c.artist || '',
            style: c.style || '',
            bpm: c.bpm || 0,
            duration: last + 3,
            durationLabel: fmtDuration(last + 3),
            charts,
            async loadAudio(audio) {
              if (!this._buffer) this._buffer = await audio.loadUrl(base + (c.audio || 'audio.ogg'));
              return this._buffer;
            },
          });
        } catch (err) {
          console.warn(`No se pudo cargar la canción "${folder}":`, err);
        }
      }
    }
  } catch (_) {
    // Sin servidor (archivo abierto directo): solo canciones incluidas.
  }

  return songs;
}
