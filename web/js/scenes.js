// Escenas de menú: atracción, alias, selección, carga, resultados, récords y calibración.

import { CONFIG, ALIASES, QEQCHI } from './config.js';
import { Settings, Highscores } from './storage.js';
import { laneX } from './game.js';
import {
  PALETTE, text, drawJaguarEyes, drawGlyphTile, drawMayaNumber, drawMonjaBlanca, drawGlow, roundRect, hexA,
} from './art.js';

const W = CONFIG.width;
const H = CONFIG.height;

function title(g, t, y = 210, size = 64) {
  const wob = Math.sin(t * 2) * 2;
  text(g, 'BALAM', W / 2, y - size * 0.6 + wob, { size, color: PALETTE.gold, glow: PALETTE.magenta });
  text(g, 'BEAT', W / 2, y + size * 0.6 + wob, { size, color: PALETTE.jade, glow: PALETTE.jade });
}

// Mantener dos carriles a la vez abre opciones ocultas (sin teclado)
function comboHeld(input, a, b) {
  return Math.min(input.heldFor(a), input.heldFor(b));
}

// ------------------------------------------------------------------
export class AttractScene {
  enter() {
    this.board = 0;
    this.boardTimer = 0;
    // si se llega con una mano aún en el haz, se ignora ese gesto
    this._ignore = this.game.input.down.some(Boolean);
    this.game.mascot.setBase('normal');
  }

  onPress() { this.game.mascot.react('feliz', 0.8); }
  onRelease() {
    // se avanza al SOLTAR para no confundir con el gesto de mantener
    if (this.game.input.down.some(Boolean)) return;
    if (this._ignore) { this._ignore = false; return; }
    this.game.audio.blip(880);
    this.game.go('alias');
  }
  onKey(e) {
    if (e.code === 'KeyC') { this.game.go('calibration'); return true; }
    if (e.code === 'Enter' || e.code === 'Space') { this.game.go('alias'); return true; }
    return false;
  }

  update(dt) {
    const game = this.game;
    game.bg.update(dt, 0.6);
    if (comboHeld(game.input, 0, CONFIG.lanes - 1) > CONFIG.holdToActivate) {
      game.go('calibration');
    }
    this.boardTimer += dt;
    if (this.boardTimer > 8) { this.boardTimer = 0; this.board = (this.board + 1) % Math.max(1, game.songs.length); }
  }

  draw(g) {
    const game = this.game;
    const t = game.time;
    game.bg.draw(g, (Math.sin(t * 3) + 1) * 0.15);
    drawJaguarEyes(g, W / 2, 110, t, 0.8);
    game.drawLogos(g, 24, 20, 64, 0.9);
    title(g, t, 300, 72);
    game.mascot.draw(g, 1060, 330, 0.7, t);

    const blink = (Math.sin(t * 4) + 1) / 2;
    text(g, 'PASA LA MANO POR UN LÁSER PARA JUGAR', W / 2, 470, {
      size: 18, color: PALETTE.orchid, glow: PALETTE.magenta, alpha: 0.4 + blink * 0.6,
    });

    // glifos de carril animados
    for (let i = 0; i < CONFIG.lanes; i++) {
      const bounce = Math.max(0, Math.sin(t * 4 - i * 0.8)) * 12;
      drawGlyphTile(g, laneX(i), 570 - bounce, 90, CONFIG.laneColors[i], i, { lit: game.input.down[i] });
    }

    // mini tabla de récords rotativa
    const song = game.songs[this.board];
    if (song) {
      const list = Highscores.list(song.id, 'normal').slice(0, 3);
      if (list.length) {
        text(g, `RÉCORDS · ${song.title.toUpperCase()}`, W - 30, 30, { size: 10, color: PALETTE.lilac, align: 'right' });
        list.forEach((e, i) => {
          text(g, `${i + 1}. ${e.name}  ${e.score}`, W - 30, 54 + i * 22, { size: 11, color: PALETTE.gold, align: 'right' });
        });
      }
    }

    text(g, game.input.controllerLabel, 24, H - 20, { size: 10, color: PALETTE.lilac, align: 'left' });
    if (!game.input.serialPort && game.input.serialStatus !== 'sin-soporte') {
      text(g, 'S: conectar controlador serial', W - 24, H - 20, { size: 10, color: PALETTE.lilac, align: 'right' });
    }
    if (!game.audio.unlocked) {
      text(g, 'Haz clic o presiona una tecla para activar el sonido', W / 2, H - 22, { size: 10, color: PALETTE.gold });
    }
  }
}

// ------------------------------------------------------------------
export class AliasScene {
  enter() {
    this.index = Math.floor(Math.random() * ALIASES.length);
    this.suffix = String(Math.floor(Math.random() * 90) + 10);
  }
  get name() { return `${ALIASES[this.index]} ${this.suffix}`; }

  onPress(lane) { this.onNav(lane); }
  onKey(e) {
    if (e.code === 'Escape') { this.game.go('attract'); return true; }
    return false;
  }
  onNav(lane) {
    const a = this.game.audio;
    if (lane === 0) { this.index = (this.index - 1 + ALIASES.length) % ALIASES.length; a.blip(520); }
    if (lane === 1) { this.index = (this.index + 1) % ALIASES.length; a.blip(620); }
    if (lane === 2) { this.enter(); a.blip(740); }
    if (lane === 3) {
      a.blip(990);
      this.game.player.alias = this.name;
      this.game.go('select');
    }
  }

  update(dt) {
    this.game.bg.update(dt, 0.6);
    if (this.game.idleFor() > CONFIG.idleTimeout) this.game.go('attract');
  }

  draw(g) {
    const game = this.game;
    game.bg.draw(g);
    game.drawPanel(g, 240, 120, W - 480, 380, PALETTE.jade);
    text(g, 'ELIGE TU NOMBRE DE JUGADOR', W / 2, 180, { size: 18, color: PALETTE.lilac });
    text(g, '◀', 330, 310, { size: 28, color: CONFIG.laneColors[0] });
    text(g, '▶', W - 330, 310, { size: 28, color: CONFIG.laneColors[1] });
    text(g, this.name.toUpperCase(), W / 2, 310, { size: 30, color: PALETTE.gold, glow: PALETTE.magenta });
    text(g, 'Usa los láseres como botones', W / 2, 440, { size: 12, color: PALETTE.orchid, alpha: 0.7 });
    game.drawLaneHints(g, ['◀ ANTERIOR', 'SIGUIENTE ▶', '⟳ AL AZAR', '✔ LISTO']);
  }
}

// ------------------------------------------------------------------
export class SelectScene {
  enter() { this.slide = 0; }

  onPress(lane) { this.onNav(lane); }
  onKey(e) {
    if (e.code === 'Escape') { this.game.go('attract'); return true; }
    return false;
  }
  onNav(lane) {
    const game = this.game, sel = game.selection, n = game.songs.length;
    if (lane === 0) { sel.songIndex = (sel.songIndex - 1 + n) % n; this.slide = -1; game.audio.blip(520); }
    if (lane === 1) { sel.songIndex = (sel.songIndex + 1) % n; this.slide = 1; game.audio.blip(620); }
    if (lane === 2) {
      const o = CONFIG.difficultyOrder;
      sel.diff = o[(o.indexOf(sel.diff) + 1) % o.length];
      game.audio.blip(740);
    }
    if (lane === 3) {
      game.audio.blip(990);
      game.go('loading', { song: game.songs[sel.songIndex], diff: sel.diff });
    }
  }

  update(dt) {
    this.game.bg.update(dt, 0.8);
    this.slide *= Math.pow(0.001, dt);
    if (this.game.idleFor() > CONFIG.idleTimeout) this.game.go('attract');
  }

  draw(g) {
    const game = this.game;
    const { songIndex, diff } = game.selection;
    const song = game.songs[songIndex];
    game.bg.draw(g);
    game.drawLogos(g, 24, 16, 46, 0.75);
    text(g, `JUGADOR: ${game.player.alias.toUpperCase()}`, W / 2, 40, { size: 12, color: PALETTE.lilac });
    text(g, 'ELIGE UNA CANCIÓN', W / 2, 80, { size: 22, color: PALETTE.orchid, glow: PALETTE.magenta });

    // tarjetas vecinas
    const n = game.songs.length;
    for (const off of [-1, 1]) {
      if (n < 2) break;
      const s = game.songs[(songIndex + off + n) % n];
      const x = W / 2 + off * 470 + this.slide * 120;
      g.save();
      g.globalAlpha = 0.45;
      game.drawPanel(g, x - 150, 200, 300, 260, PALETTE.lilac);
      text(g, s.title.toUpperCase(), x, 330, { size: 12, color: PALETTE.orchid });
      g.restore();
    }

    const cx = W / 2 + this.slide * 120;
    game.drawPanel(g, cx - 260, 130, 520, 430, PALETTE.jade);
    text(g, song.title.toUpperCase(), cx, 200, { size: 24, color: PALETTE.gold, glow: PALETTE.magenta });
    text(g, song.artist, cx, 240, { size: 11, color: PALETTE.lilac });
    text(g, song.style || '', cx, 268, { size: 11, color: PALETTE.orchid, alpha: 0.8 });
    text(g, `${song.bpm ? song.bpm + ' BPM · ' : ''}${song.durationLabel} · ${song.charts[diff].length} notas`, cx, 300, {
      size: 11, color: PALETTE.orchid,
    });

    // selector de dificultad
    CONFIG.difficultyOrder.forEach((d, i) => {
      const x = cx - 160 + i * 160;
      const active = d === diff;
      roundRect(g, x - 70, 340, 140, 44, 10);
      g.fillStyle = active ? PALETTE.gold : 'rgba(255,255,255,0.06)';
      g.fill();
      g.strokeStyle = PALETTE.gold;
      g.lineWidth = 2;
      g.stroke();
      text(g, CONFIG.difficulties[d].label.toUpperCase(), x, 363, { size: 12, color: active ? PALETTE.night : PALETTE.gold });
    });

    const best = Highscores.best(song.id, diff);
    text(g, 'RÉCORD', cx, 420, { size: 11, color: PALETTE.lilac });
    text(g, best ? String(best) : '— sin récord —', cx, 452, { size: 20, color: PALETTE.jade, glow: PALETTE.jade });
    const top = Highscores.list(song.id, diff)[0];
    if (top) text(g, top.name, cx, 484, { size: 10, color: PALETTE.orchid });

    game.drawLaneHints(g, ['◀ ANTERIOR', 'SIGUIENTE ▶', '⟳ DIFICULTAD', '✔ ¡JUGAR!']);
  }
}

// ------------------------------------------------------------------
export class LoadingScene {
  async enter({ song, diff }) {
    this.error = null;
    this.ready = false;
    try {
      await this.game.audio.unlock();
      const buffer = await song.loadAudio(this.game.audio);
      if (this.game.scene !== this) return;
      this.game.go('play', { song, diff, buffer });
    } catch (err) {
      console.error(err);
      this.error = String(err.message || err);
    }
  }
  onPress(lane) { if (this.error && lane === 3) this.game.go('select'); }
  onKey(e) { if (e.code === 'Escape' || (this.error && e.code === 'Enter')) this.game.go('select'); return true; }
  update(dt) { this.game.bg.update(dt, 2); }
  draw(g) {
    const game = this.game;
    game.bg.draw(g);
    if (this.error) {
      text(g, 'NO SE PUDO CARGAR LA CANCIÓN', W / 2, 330, { size: 20, color: PALETTE.magenta });
      text(g, this.error.slice(0, 80), W / 2, 380, { size: 10, color: PALETTE.orchid });
      game.drawLaneHints(g, [null, null, null, '✔ VOLVER']);
      return;
    }
    const dots = '.'.repeat(1 + Math.floor(game.time * 3) % 3);
    text(g, `AFINANDO LA MARIMBA${dots}`, W / 2, 350, { size: 20, color: PALETTE.jade, glow: PALETTE.jade });
  }
}

// ------------------------------------------------------------------
function grade(stats) {
  const acc = stats.total ? (stats.perfect + stats.good * 0.6) / stats.total : 0;
  const letter = acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : acc >= 0.5 ? 'C' : 'D';
  return { acc, letter };
}

export class ResultsScene {
  enter({ song, diff, score, stats, failed }) {
    this.data = { song, diff, score, stats, failed };
    this.g = grade(stats);
    this.fullCombo = !failed && stats.miss === 0 && stats.total > 0;
    // también se guardan partidas perdidas: lo importante es participar
    this.rank = Highscores.add(song.id, diff, {
      name: this.game.player.alias || 'Anónimo', score, grade: this.g.letter, acc: this.g.acc,
    });
    this.shown = 0;
    this.game.mascot.setBase(failed ? 'triste' : 'feliz');
  }
  onPress(lane) { if (lane === 3 && this.game.sceneTime > 1) this._next(); }
  onKey(e) { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') this._next(); return true; }
  _next() { this.game.go('highscores', { songId: this.data.song.id, diff: this.data.diff, highlight: this.rank, title: this.data.song.title }); }

  update(dt) {
    this.game.bg.update(dt, 0.5);
    this.shown = Math.min(this.data.score, this.shown + Math.max(1, this.data.score) * dt * 0.8);
    if (this.game.sceneTime > CONFIG.resultsTimeout) this._next();
  }

  draw(g) {
    const game = this.game;
    const { song, diff, score, stats, failed } = this.data;
    game.bg.draw(g);
    game.drawPanel(g, 160, 60, W - 320, 560, failed ? PALETTE.magenta : PALETTE.jade);

    game.drawLogos(g, 190, 80, 44, 0.7);
    text(g, failed ? '¡CASI LO LOGRAS!' : '¡CANCIÓN COMPLETA!', W / 2, 110, {
      size: 24, color: failed ? PALETTE.magenta : PALETTE.jade, glow: failed ? PALETTE.magenta : PALETTE.jade,
    });
    text(g, `${song.title.toUpperCase()} · ${CONFIG.difficulties[diff].label.toUpperCase()}`, W / 2, 150, { size: 12, color: PALETTE.lilac });

    // calificación grande
    const pop = Math.min(1, game.sceneTime * 2);
    text(g, this.g.letter, 360, 330, { size: 120 * pop + 1, color: PALETTE.gold, glow: PALETTE.magenta });
    if (this.fullCombo) {
      drawGlow(g, PALETTE.orchid, 360, 470, 80, 0.5);
      drawMonjaBlanca(g, 360 - 36, 440, 6);
      text(g, '¡SIN FALLOS!', 360, 540, { size: 12, color: PALETTE.orchid });
    }

    const rows = [
      ['PUNTAJE', String(Math.round(this.shown))],
      ['PRECISIÓN', `${Math.round(this.g.acc * 100)}%`],
      ['PERFECTOS', String(stats.perfect)],
      ['BIEN', String(stats.good)],
      ['FALLOS', String(stats.miss)],
      ['COMBO MÁX.', String(stats.maxCombo)],
    ];
    rows.forEach(([k, v], i) => {
      text(g, k, 560, 220 + i * 46, { size: 13, color: PALETTE.lilac, align: 'left' });
      text(g, v, 900, 220 + i * 46, { size: 16, color: i === 0 ? PALETTE.gold : PALETTE.orchid, align: 'right' });
    });

    // puntaje en numeración maya
    text(g, 'EN MAYA', 1010, 190, { size: 9, color: PALETTE.lilac });
    drawMayaNumber(g, score, 1010, 210, 8, PALETTE.gold);

    if (this.rank === 0) {
      const b = (Math.sin(game.time * 6) + 1) / 2;
      text(g, '¡NUEVO RÉCORD!', W / 2, 520, { size: 22, color: PALETTE.gold, glow: PALETTE.magenta, alpha: 0.5 + b * 0.5 });
    } else if (this.rank > 0) {
      text(g, `Entraste al top 10 en el puesto ${this.rank + 1}`, W / 2, 520, { size: 13, color: PALETTE.jade });
    }
    game.mascot.draw(g, 1010, 470, 0.45, game.time);
    text(g, `${QEQCHI.thanks} · ¡Gracias por jugar!`, W / 2, 580, { size: 12, color: PALETTE.orchid, alpha: 0.85 });

    game.drawLaneHints(g, [null, null, null, '✔ CONTINUAR']);
  }
}

// ------------------------------------------------------------------
export class HighscoresScene {
  enter({ songId, diff, highlight = -1, title = '' }) {
    this.songId = songId; this.diff = diff; this.highlight = highlight; this.title = title;
  }
  onPress(lane) { if (lane === 3 && this.game.sceneTime > 0.8) this.game.go('attract'); }
  onKey() { this.game.go('attract'); return true; }
  update(dt) {
    this.game.bg.update(dt, 0.5);
    if (this.game.sceneTime > CONFIG.highscoresTimeout) this.game.go('attract');
  }
  draw(g) {
    const game = this.game;
    game.bg.draw(g);
    game.drawPanel(g, 260, 50, W - 520, 580, PALETTE.gold);
    text(g, 'TABLA DE RÉCORDS', W / 2, 100, { size: 24, color: PALETTE.gold, glow: PALETTE.magenta });
    text(g, `${this.title.toUpperCase()} · ${CONFIG.difficulties[this.diff].label.toUpperCase()}`, W / 2, 140, { size: 11, color: PALETTE.lilac });
    const list = Highscores.list(this.songId, this.diff);
    list.forEach((e, i) => {
      const y = 190 + i * 40;
      const hl = i === this.highlight;
      if (hl) {
        roundRect(g, 300, y - 18, W - 600, 36, 8);
        g.fillStyle = hexA(PALETTE.jade, 0.2 + 0.15 * Math.sin(game.time * 6));
        g.fill();
      }
      const col = hl ? PALETTE.jade : i < 3 ? PALETTE.gold : PALETTE.orchid;
      text(g, `${i + 1}.`, 330, y, { size: 14, color: col, align: 'left' });
      text(g, e.name.toUpperCase(), 390, y, { size: 14, color: col, align: 'left' });
      text(g, e.grade || '', 840, y, { size: 14, color: PALETTE.lilac });
      text(g, String(e.score), W - 320, y, { size: 14, color: col, align: 'right' });
    });
    game.drawLogos(g, 24, H - 70, 48, 0.75);
    game.drawLaneHints(g, [null, null, null, '✔ SIGUIENTE']);
  }
}

// ------------------------------------------------------------------
// Calibración (para el encargado):
//  · prueba de los 4 sensores
//  · ajuste de latencia: ←/→ o carriles 1/2 (±5 ms)
//  · prueba de toques: T, o mantener el carril 3
//  · salir: Esc, o mantener los carriles 1 y 4
export class CalibrationScene {
  enter() {
    this.offsetMs = Settings.get().offsetMs;
    this.test = null;
    this.message = '';
    this.counts = new Array(CONFIG.lanes).fill(0);
    this._lock = this.game.input.down.some(Boolean);  // ignora el gesto que abrió la escena
  }
  exit() { Settings.set({ offsetMs: this.offsetMs }); }

  onPress(lane, perfMs) {
    this.counts[lane]++;
    if (this._lock) return;
    if (this.test && this.test.running) {
      this.test.taps.push(this.game.audio.ctxTimeAt(perfMs));
      return;
    }
    if (lane === 0) this._adjust(-5);
    if (lane === 1) this._adjust(5);
  }
  onRelease() { if (!this.game.input.down.some(Boolean)) this._lock = false; }

  onKey(e) {
    if (e.code === 'Escape') { this.game.go('attract'); return true; }
    if (e.code === 'ArrowLeft') this._adjust(-5);
    if (e.code === 'ArrowRight') this._adjust(5);
    if (e.code === 'KeyT') this._startTest();
    if (e.code === 'Digit0') { this.offsetMs = 0; this.message = 'Latencia reiniciada'; }
    return true;
  }

  _adjust(d) {
    this.offsetMs = Math.max(-300, Math.min(300, this.offsetMs + d));
    this.game.audio.blip(700);
  }

  _startTest() {
    const audio = this.game.audio;
    audio.unlock();
    const bpm = 100, beat = 60 / bpm, start = audio.ctx.currentTime + 0.5;
    const clicks = [];
    for (let i = 0; i < 12; i++) {
      audio.clickAt(start + i * beat, i < 4);
      if (i >= 4) clicks.push(start + i * beat);
    }
    this.test = { running: true, clicks, taps: [], end: start + 12 * beat + 0.3, beat };
    this.message = 'Escucha 4 clics y luego pasa la mano al ritmo de los 8 siguientes';
  }

  update(dt) {
    const game = this.game;
    game.bg.update(dt, 0.4);
    if (comboHeld(game.input, 0, CONFIG.lanes - 1) > CONFIG.holdToActivate && !this._lock) {
      game.go('attract');
      return;
    }
    if (!this._lock && !this.test?.running && game.input.heldFor(2) > CONFIG.holdToActivate) {
      this._lock = true;
      this._startTest();
    }
    const T = this.test;
    if (T && T.running) {
      // los clics son tiempos de contexto programados; los toques, tiempos audibles
      const audible = game.audio.ctxTimeAt(performance.now());
      if (audible > T.end) {
        T.running = false;
        const deltas = [];
        for (const tap of T.taps) {
          let best = Infinity;
          for (const c of T.clicks) if (Math.abs(tap - c) < Math.abs(best)) best = tap - c;
          if (Math.abs(best) < T.beat / 2) deltas.push(best);
        }
        if (deltas.length >= 4) {
          deltas.sort((a, b) => a - b);
          const median = deltas[Math.floor(deltas.length / 2)];
          this.offsetMs = Math.round(median * 1000);
          this.message = `Listo: latencia ajustada a ${this.offsetMs} ms (${deltas.length} toques)`;
        } else {
          this.message = 'Muy pocos toques. Intenta de nuevo.';
        }
      }
    }
  }

  draw(g) {
    const game = this.game;
    game.bg.draw(g);
    game.drawPanel(g, 120, 40, W - 240, 600, PALETTE.lilac);
    text(g, 'CALIBRACIÓN', W / 2, 90, { size: 24, color: PALETTE.lilac, glow: PALETTE.lilac });
    text(g, game.input.controllerLabel, W / 2, 130, { size: 11, color: PALETTE.orchid });
    text(g, `Serial: ${game.input.serialStatus}  (S: elegir puerto)`, W / 2, 152, {
      size: 9, color: PALETTE.lilac,
    });

    for (let i = 0; i < CONFIG.lanes; i++) {
      const lit = game.input.down[i];
      if (lit) drawGlow(g, CONFIG.laneColors[i], laneX(i), 260, 90, 0.7);
      drawGlyphTile(g, laneX(i), 260, 110, CONFIG.laneColors[i], i, { lit });
      text(g, `${this.counts[i]} toques`, laneX(i), 330, { size: 10, color: CONFIG.laneColors[i] });
    }

    text(g, `LATENCIA: ${this.offsetMs > 0 ? '+' : ''}${this.offsetMs} ms`, W / 2, 400, { size: 20, color: PALETTE.gold });
    text(g, this.message, W / 2, 440, { size: 11, color: PALETTE.jade });

    const help = [
      'Carril 1 / 2  (o ← →): ajustar ±5 ms',
      'Mantener carril 3  (o T): prueba de ritmo automática',
      'Mantener carriles 1 y 4  (o Esc): salir',
    ];
    help.forEach((h, i) => text(g, h, W / 2, 500 + i * 26, { size: 10, color: PALETTE.orchid, alpha: 0.85 }));
    if (this.test?.running) text(g, '♪ PRUEBA EN CURSO ♪', W / 2, 600, { size: 14, color: PALETTE.magenta });
  }
}
