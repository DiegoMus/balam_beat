// Guardado local (ajustes y récords). Todo protegido con try/catch:
// si el navegador bloquea el almacenamiento, el juego sigue funcionando en memoria.

const memory = {};

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw);
  } catch (_) { /* sin almacenamiento */ }
  return key in memory ? memory[key] : fallback;
}

function write(key, value) {
  memory[key] = value;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* ignorar */ }
}

export const Settings = {
  get() {
    return Object.assign({ offsetMs: 0 }, read('balam.settings', {}));
  },
  set(patch) {
    write('balam.settings', Object.assign(this.get(), patch));
  },
};

export const Highscores = {
  key(songId, diff) { return `balam.hs.${songId}.${diff}`; },

  list(songId, diff) {
    return read(this.key(songId, diff), []);
  },

  best(songId, diff) {
    const l = this.list(songId, diff);
    return l.length ? l[0].score : 0;
  },

  // Devuelve la posición (0-based) o -1 si no entró al top 10
  add(songId, diff, entry) {
    const l = this.list(songId, diff);
    const record = Object.assign({ date: Date.now() }, entry);
    l.push(record);
    l.sort((a, b) => b.score - a.score || a.date - b.date);
    const top = l.slice(0, 10);
    write(this.key(songId, diff), top);
    return top.indexOf(record);
  },
};
