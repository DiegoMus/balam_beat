// Escena de partida: carriles en perspectiva, notas, juicio de aciertos y HUD.

import { CONFIG } from './config.js';
import { Settings } from './storage.js';
import { laneX, project, HIT_Y } from './game.js';
import {
  PALETTE, text, drawGlow, drawGlyphTile, drawMayaNumber, drawQuetzal, hexA, roundRect, HORIZON,
} from './art.js';

const JUDGE_TEXT = {
  perfect: { label: '¡PERFECTO!', color: PALETTE.jade },
  good: { label: 'BIEN', color: PALETTE.gold },
  miss: { label: 'FALLO', color: PALETTE.magenta },
};

export class PlayScene {
  enter({ song, diff, buffer }) {
    this.song = song;
    this.diff = diff;
    this.buffer = buffer;
    this.lookahead = CONFIG.difficulties[diff].lookahead;
    this.offset = Settings.get().offsetMs / 1000;

    this.notes = song.charts[diff].map((n) => ({
      ...n, judged: false, result: null, holding: false, holdDone: false, holdBroken: false,
    }));
    const lastEnd = this.notes.reduce((m, n) => Math.max(m, n.t + n.len), 0);
    this.endTime = Math.max(lastEnd + 2.5, buffer.duration + 0.3);

    this.stats = { perfect: 0, good: 0, miss: 0, maxCombo: 0, total: this.notes.length };
    this.score = 0;
    this.combo = 0;
    this.energy = CONFIG.energy.start;
    this.failed = false;
    this.finished = false;
    this.nextIndex = 0;      // primera nota aún no juzgada (optimización)
    this.popups = [];        // textos de juicio
    this.particles = [];
    this.laneFlash = new Array(CONFIG.lanes).fill(0);
    this.quetzal = null;
    this.beatPulse = 0;

    this.game.audio.play(buffer, CONFIG.countdown);
  }

  exit() {
    this.game.audio.stop();
  }

  get multiplier() {
    return Math.min(CONFIG.maxMultiplier, 1 + Math.floor(this.combo / CONFIG.comboStep));
  }

  // ------------------------- entrada -------------------------
  onKey(e) {
    if (e.code === 'Escape') {
      this.game.go('select');
      return true;
    }
    return true; // en partida, el resto de teclas no navega menús
  }

  onPress(lane, perfMs) {
    this.laneFlash[lane] = 1;
    if (this.finished) return;
    const t = this.game.audio.songTimeAt(perfMs) - this.offset;
    const W = CONFIG.windows;

    // nota sin juzgar más cercana en este carril
    let best = null, bestD = Infinity;
    for (let i = this.nextIndex; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.t - t > W.good) break;
      if (n.judged || n.lane !== lane) continue;
      const d = Math.abs(n.t - t);
      if (d < bestD) { best = n; bestD = d; }
    }
    if (!best || bestD > W.good) return; // presionar al aire no castiga

    const kind = bestD <= W.perfect ? 'perfect' : 'good';
    best.judged = true;
    best.result = kind;
    if (best.len > 0) best.holding = true;
    this._registerHit(best, kind);
  }

  onRelease(lane, perfMs) {
    const t = this.game.audio.songTimeAt(perfMs) - this.offset;
    for (const n of this.notes) {
      if (n.holding && n.lane === lane) {
        n.holding = false;
        if (t < n.t + n.len - CONFIG.holdReleaseGrace) n.holdBroken = true;
        else n.holdDone = true;
      }
    }
  }

  _registerHit(note, kind) {
    this.stats[kind]++;
    this.combo++;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    this.score += CONFIG.scores[kind] * this.multiplier;
    this.energy = Math.min(CONFIG.energy.max, this.energy + CONFIG.energy.hit);
    this.game.audio.hit(note.lane, kind === 'perfect');
    this._popup(note.lane, kind);
    this._burst(note.lane, kind === 'perfect' ? 18 : 10);

    if (this.combo % CONFIG.quetzalEvery === 0) {
      this.quetzal = { x: CONFIG.width + 40, y: 90 + Math.random() * 80, t: 0 };
      this.game.shake = 10;
    }
  }

  _registerMiss(note) {
    note.judged = true;
    note.result = 'miss';
    this.stats.miss++;
    this.combo = 0;
    this.energy += CONFIG.energy.miss;
    this.game.audio.miss();
    this._popup(note.lane, 'miss');
    if (CONFIG.allowFail && this.energy <= 0) {
      this.energy = 0;
      this.failed = true;
      this._finish();
    }
  }

  _popup(lane, kind) {
    this.popups.push({ lane, kind, t: 0 });
  }

  _burst(lane, count) {
    const x = laneX(lane), y = HIT_Y;
    const col = CONFIG.laneColors[lane];
    for (let i = 0; i < count; i++) {
      const a = -Math.PI * (0.1 + Math.random() * 0.8);
      const v = 200 + Math.random() * 380;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6, col });
    }
  }

  _finish() {
    if (this.finished) return;
    this.finished = true;
    this.finishedAt = this.game.sceneTime;
    if (this.failed) this.game.audio.stop();
  }

  // ------------------------- lógica -------------------------
  update(dt) {
    const game = this.game;
    const t = game.audio.songTime - this.offset;
    this.songT = t;
    game.bg.update(dt, 1.5);

    if (!this.finished) {
      // fallos por notas que pasaron
      for (let i = this.nextIndex; i < this.notes.length; i++) {
        const n = this.notes[i];
        if (n.t > t - CONFIG.windows.good) break;
        if (!n.judged) this._registerMiss(n);
        if (this.finished) break;
      }
      while (this.nextIndex < this.notes.length && this.notes[this.nextIndex].judged
        && this.notes[this.nextIndex].t < t - CONFIG.windows.good) this.nextIndex++;

      // notas sostenidas
      for (const n of this.notes) {
        if (!n.holding) continue;
        const end = n.t + n.len;
        if (t >= end) { n.holding = false; n.holdDone = true; this._burst(n.lane, 8); continue; }
        this.score += CONFIG.scores.holdPerSecond * this.multiplier * dt;
        if (Math.random() < 0.4) this._burst(n.lane, 1);
      }

      if (t > this.endTime) this._finish();
    }

    // pulso al ritmo para la cuadrícula
    const bpm = this.song.bpm || 120;
    const phase = ((t * bpm) / 60) % 1;
    this.beatPulse = t > 0 ? Math.pow(1 - phase, 3) : 0;

    for (let i = 0; i < CONFIG.lanes; i++) this.laneFlash[i] = Math.max(0, this.laneFlash[i] - dt * 4);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < 0.6);
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.quetzal) {
      this.quetzal.x -= 520 * dt;
      this.quetzal.t += dt;
      if (this.quetzal.x < -200) this.quetzal = null;
    }

    if (this.finished && game.sceneTime - this.finishedAt > (this.failed ? 2.2 : 1.2)) {
      game.go('results', {
        song: this.song, diff: this.diff, score: Math.round(this.score),
        stats: this.stats, failed: this.failed,
      });
    }
  }

  // ------------------------- dibujo -------------------------
  draw(g) {
    const game = this.game;
    game.bg.draw(g, this.beatPulse * 0.5);
    const t = this.songT ?? -CONFIG.countdown;

    this._drawHighway(g);
    this._drawNotes(g, t);
    this._drawReceptors(g);

    // partículas
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      g.globalAlpha = Math.max(0, p.life / 0.6);
      g.fillStyle = p.col;
      g.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    g.restore();

    for (const p of this.popups) {
      const j = JUDGE_TEXT[p.kind];
      text(g, j.label, laneX(p.lane), HIT_Y - 90 - p.t * 60, {
        size: p.kind === 'perfect' ? 18 : 15, color: j.color, glow: j.color, alpha: 1 - p.t / 0.6,
      });
    }

    if (this.quetzal) {
      const q = this.quetzal;
      drawQuetzal(g, q.x, q.y + Math.sin(q.t * 10) * 8, 5);
      text(g, `¡COMBO ${this.combo - (this.combo % CONFIG.quetzalEvery)}!`, q.x + 80, q.y + 80, {
        size: 14, color: PALETTE.jade, glow: PALETTE.jade,
      });
    }

    this._drawHud(g, t);

    if (t < 0) {
      const n = Math.ceil(-t);
      text(g, n > 0 ? String(n) : '', CONFIG.width / 2, 420, { size: 72, color: PALETTE.gold, glow: PALETTE.magenta });
      text(g, this.song.title.toUpperCase(), CONFIG.width / 2, 330, { size: 22, color: PALETTE.orchid, glow: PALETTE.jade });
    }

    if (this.failed) {
      g.fillStyle = 'rgba(10,4,20,0.6)';
      g.fillRect(0, 0, CONFIG.width, CONFIG.height);
      text(g, '¡SE ACABÓ LA ENERGÍA!', CONFIG.width / 2, 340, { size: 32, color: PALETTE.magenta, glow: PALETTE.magenta });
      text(g, 'El jaguar descansa... ¡inténtalo otra vez!', CONFIG.width / 2, 400, { size: 14, color: PALETTE.orchid });
    }
  }

  _drawHighway(g) {
    // gradas de la pirámide: franjas oscuras bajo cada carril
    for (let i = 0; i < CONFIG.lanes; i++) {
      const col = CONFIG.laneColors[i];
      const half = 0.5 * 150;
      const a = project(i, 1), b = project(i, -0.08);
      g.beginPath();
      g.moveTo(a.x - half * a.s, a.y);
      g.lineTo(a.x + half * a.s, a.y);
      g.lineTo(b.x + half * b.s, b.y);
      g.lineTo(b.x - half * b.s, b.y);
      g.closePath();
      const grad = g.createLinearGradient(0, a.y, 0, b.y);
      grad.addColorStop(0, 'rgba(20,10,43,0.0)');
      grad.addColorStop(1, hexA(col, 0.12 + this.laneFlash[i] * 0.25));
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = hexA(col, 0.35);
      g.lineWidth = 2;
      g.stroke();

      // haz láser cuando la mano corta la barrera
      if (this.game.input.down[i]) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const lg = g.createLinearGradient(0, a.y, 0, b.y);
        lg.addColorStop(0, hexA(col, 0));
        lg.addColorStop(1, hexA(col, 0.55));
        g.fillStyle = lg;
        g.beginPath();
        g.moveTo(a.x - 6 * a.s, a.y);
        g.lineTo(a.x + 6 * a.s, a.y);
        g.lineTo(b.x + 14, b.y);
        g.lineTo(b.x - 14, b.y);
        g.fill();
        g.restore();
      }
    }

    // escalones horizontales (gradas) que avanzan con la música
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 2;
    const t = this.songT || 0;
    const step = 0.5;
    for (let k = 0; k < 8; k++) {
      const dt = step * k - (t % step);
      const z = dt / this.lookahead;
      if (z < 0 || z > 1) continue;
      const l = project(0, z), r = project(CONFIG.lanes - 1, z);
      g.beginPath();
      g.moveTo(l.x - 75 * l.s, l.y);
      g.lineTo(r.x + 75 * r.s, r.y);
      g.stroke();
    }
  }

  _drawReceptors(g) {
    // friso de piedra
    const left = laneX(0) - 110, right = laneX(CONFIG.lanes - 1) + 110;
    roundRect(g, left, HIT_Y - 48, right - left, 96, 14);
    g.fillStyle = 'rgba(46,42,61,0.85)';
    g.fill();
    g.strokeStyle = PALETTE.stoneLight;
    g.lineWidth = 3;
    g.stroke();
    // greca
    g.fillStyle = PALETTE.stoneLight;
    for (let x = left + 16; x < right - 16; x += 24) {
      g.fillRect(x, HIT_Y + 36, 12, 4);
      g.fillRect(x + 8, HIT_Y + 30, 4, 6);
    }

    for (let i = 0; i < CONFIG.lanes; i++) {
      const col = CONFIG.laneColors[i];
      const lit = this.game.input.down[i];
      if (lit || this.laneFlash[i] > 0) drawGlow(g, col, laneX(i), HIT_Y, 90, Math.max(lit ? 0.7 : 0, this.laneFlash[i]));
      drawGlyphTile(g, laneX(i), HIT_Y, 120, col, i, { fill: 0.1, lit });
    }
  }

  _drawNotes(g, t) {
    const la = this.lookahead;
    // de atrás hacia adelante para que las cercanas queden encima
    // incluye notas sostenidas que aún se están tocando
    let start = this.nextIndex;
    for (let k = Math.max(0, this.nextIndex - 32); k < this.nextIndex; k++) {
      const n = this.notes[k];
      if (n.len > 0 && n.t + n.len > t - 0.3) { start = k; break; }
    }
    for (let i = this.notes.length - 1; i >= start; i--) {
      const n = this.notes[i];
      const z = (n.t - t) / la;
      if (z > 1.05) continue;
      const col = CONFIG.laneColors[n.lane];

      // cuerpo de serpiente emplumada para notas sostenidas
      if (n.len > 0 && !n.holdDone) {
        const zEnd = Math.min(1.05, (n.t + n.len - t) / la);
        const zStart = n.holding ? 0 : Math.max(z, -0.1);
        if (zEnd > zStart) this._drawSerpent(g, n.lane, zStart, zEnd, col, n.holdBroken || n.result === 'miss' ? 0.25 : 1, t);
      }

      if (n.judged && n.result !== 'miss') continue;
      if (z < -0.25) continue;
      const p = project(n.lane, z);
      const alpha = n.result === 'miss' ? 0.3 : Math.min(1, (1.05 - z) * 4);
      if (n.result !== 'miss') drawGlow(g, col, p.x, p.y, 70 * p.s, 0.5 * alpha);
      drawGlyphTile(g, p.x, p.y, 112 * p.s, col, n.lane, { lit: true, alpha });
    }
  }

  _drawSerpent(g, lane, z0, z1, col, alpha, t) {
    const steps = 14;
    g.save();
    g.globalAlpha = alpha;
    // cuerpo
    g.beginPath();
    for (let k = 0; k <= steps; k++) {
      const z = z0 + ((z1 - z0) * k) / steps;
      const p = project(lane, z);
      const w = 26 * p.s;
      const wob = Math.sin(z * 18 - t * 6) * 6 * p.s;
      if (k === 0) g.moveTo(p.x - w + wob, p.y); else g.lineTo(p.x - w + wob, p.y);
    }
    for (let k = steps; k >= 0; k--) {
      const z = z0 + ((z1 - z0) * k) / steps;
      const p = project(lane, z);
      const w = 26 * p.s;
      const wob = Math.sin(z * 18 - t * 6) * 6 * p.s;
      g.lineTo(p.x + w + wob, p.y);
    }
    g.closePath();
    g.fillStyle = hexA(col, 0.55);
    g.fill();
    g.strokeStyle = col;
    g.lineWidth = 2;
    g.stroke();
    // plumas (chevrones)
    g.strokeStyle = PALETTE.orchid;
    g.lineWidth = 2;
    for (let k = 1; k < steps; k += 2) {
      const z = z0 + ((z1 - z0) * k) / steps;
      const p = project(lane, z);
      const wob = Math.sin(z * 18 - t * 6) * 6 * p.s;
      g.beginPath();
      g.moveTo(p.x - 14 * p.s + wob, p.y + 6 * p.s);
      g.lineTo(p.x + wob, p.y - 4 * p.s);
      g.lineTo(p.x + 14 * p.s + wob, p.y + 6 * p.s);
      g.stroke();
    }
    g.restore();
  }

  _drawHud(g, t) {
    const W = CONFIG.width;
    // progreso de la canción
    const prog = Math.max(0, Math.min(1, t / this.endTime));
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(0, 0, W, 6);
    g.fillStyle = PALETTE.jade;
    g.fillRect(0, 0, W * prog, 6);

    // puntaje
    text(g, String(Math.round(this.score)).padStart(7, '0'), W - 30, 46, {
      size: 26, color: PALETTE.gold, align: 'right', glow: PALETTE.magenta,
    });
    text(g, `x${this.multiplier}`, W - 30, 88, {
      size: 20, color: [PALETTE.orchid, PALETTE.jade, PALETTE.gold, PALETTE.magenta][this.multiplier - 1], align: 'right',
    });
    text(g, CONFIG.difficulties[this.diff].label.toUpperCase(), W - 30, 120, { size: 11, color: PALETTE.lilac, align: 'right' });

    // combo en numeración maya + arábiga
    if (this.combo >= 2) {
      text(g, 'COMBO', 80, 150, { size: 12, color: PALETTE.lilac });
      drawMayaNumber(g, this.combo, 80, 170, 9, PALETTE.gold);
      text(g, String(this.combo), 80, 130, { size: 22, color: PALETTE.orchid, glow: PALETTE.jade });
    }

    // energía
    const bx = 30, by = 330, bh = 240;
    roundRect(g, bx, by, 22, bh, 8);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fill();
    const e = this.energy / CONFIG.energy.max;
    const col = e > 0.5 ? PALETTE.jade : e > 0.25 ? PALETTE.gold : PALETTE.magenta;
    roundRect(g, bx + 3, by + 3 + (bh - 6) * (1 - e), 16, (bh - 6) * e, 6);
    g.fillStyle = col;
    g.fill();
    text(g, 'ENERGÍA', bx + 11, by + bh + 20, { size: 9, color: col });

    text(g, this.game.player.alias, 30, 30, { size: 12, color: PALETTE.orchid, align: 'left' });
    this.game.drawLogos(g, W - 24, CONFIG.height - 58, 40, 0.45, 'right');
  }
}
