// Núcleo: bucle principal, escenas y utilidades compartidas.

import { CONFIG } from './config.js';
import { Background, PALETTE, text, roundRect, hexA, HORIZON } from './art.js';
import { LOGO_UMG, LOGO_SISTEMAS, LOGO_SISTEMAS_RATIO } from './logos.js';

export const LANE_SPACING = 170;
export const HIT_Y = 610;

export function laneX(i) {
  return CONFIG.width / 2 + (i - (CONFIG.lanes - 1) / 2) * LANE_SPACING;
}

// Proyección en perspectiva: z=0 en la línea de acierto, z=1 en el horizonte lejano
const K = 3;
export function project(lane, z) {
  const s = 1 / (1 + Math.max(z, -0.3) * K);
  const vx = CONFIG.width / 2;
  const vy = HORIZON + 10;
  return {
    x: vx + (laneX(lane) - vx) * s,
    y: vy + (HIT_Y - vy) * s,
    s,
  };
}

export class Game {
  constructor(canvas, audio, input) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.audio = audio;
    this.input = input;
    this.bg = new Background();
    this.songs = [];
    this.player = { alias: '' };
    this.selection = { songIndex: 0, diff: 'normal' };
    this.scenes = {};
    this.scene = null;
    this.time = 0;
    this.last = performance.now();
    this.shake = 0;
    this.logos = { umg: new Image(), sis: new Image() };
    this.logos.umg.src = LOGO_UMG;
    this.logos.sis.src = LOGO_SISTEMAS;

    input.on('press', (lane, t) => this.scene?.onPress?.(lane, t));
    input.on('release', (lane, t) => this.scene?.onRelease?.(lane, t));
    input.on('key', (e) => this._onKey(e));

    // Toque/clic sobre la pantalla = carril según la posición horizontal
    // (útil en tablets y para probar sin teclado ni láseres)
    const laneFromPointer = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * CONFIG.width;
      let best = 0;
      for (let i = 1; i < CONFIG.lanes; i++) if (Math.abs(x - laneX(i)) < Math.abs(x - laneX(best))) best = i;
      return best;
    };
    const pointerLane = new Map();
    canvas.addEventListener('pointerdown', (e) => {
      const lane = laneFromPointer(e);
      pointerLane.set(e.pointerId, lane);
      input._press(lane, e.timeStamp || performance.now());
    });
    const up = (e) => {
      if (!pointerLane.has(e.pointerId)) return;
      input._release(pointerLane.get(e.pointerId), e.timeStamp || performance.now());
      pointerLane.delete(e.pointerId);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    canvas.style.touchAction = 'none';

    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    input.on('press', unlock);

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const ratio = CONFIG.width / CONFIG.height;
    let w = window.innerWidth, h = window.innerHeight;
    if (w / h > ratio) w = h * ratio; else h = w / ratio;
    this.canvas.style.width = `${Math.floor(w)}px`;
    this.canvas.style.height = `${Math.floor(h)}px`;
  }

  _onKey(e) {
    if (e.code === 'KeyF11' || e.code === 'F11') return;
    // Atajos de teclado equivalentes a los carriles en menús
    const nav = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 2, Enter: 3, Space: 3 };
    if (this.scene?.onKey?.(e)) return;
    if (e.code in nav && this.scene?.onNav) this.scene.onNav(nav[e.code]);
  }

  add(name, scene) {
    scene.game = this;
    this.scenes[name] = scene;
  }

  go(name, data) {
    this.scene?.exit?.();
    this.scene = this.scenes[name];
    this.sceneTime = 0;
    this.scene.enter?.(data || {});
  }

  start() {
    const frame = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      this.sceneTime += dt;
      this.shake = Math.max(0, this.shake - dt * 30);
      this.scene?.update?.(dt);

      const g = this.g;
      g.save();
      if (this.shake > 0) g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.scene?.draw?.(g);
      g.restore();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // ---- utilidades de interfaz ----

  // Pistas de carril en la parte inferior: enseñan qué hace cada láser en el menú
  drawLaneHints(g, labels) {
    for (let i = 0; i < CONFIG.lanes; i++) {
      const label = labels[i];
      if (!label) continue;
      const x = laneX(i);
      const y = 676;
      const col = CONFIG.laneColors[i];
      const lit = this.input.down[i];
      roundRect(g, x - 76, y - 20, 152, 40, 10);
      g.fillStyle = lit ? col : hexA(col, 0.15);
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = col;
      g.stroke();
      text(g, label, x, y + 1, { size: 11, color: lit ? PALETTE.night : col });
    }
  }

  drawPanel(g, x, y, w, h, color = PALETTE.jade) {
    roundRect(g, x, y, w, h, 18);
    g.fillStyle = 'rgba(16,8,36,0.78)';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = color;
    g.stroke();
    // greca escalonada en las esquinas
    g.fillStyle = color;
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      for (let k = 0; k < 3; k++) {
        g.fillRect(cx + sx * (10 + k * 8) - (sx < 0 ? 6 : 0), cy + sy * (10 + (2 - k) * 6) - (sy < 0 ? 4 : 0), 6, 4);
      }
    }
  }

  // Logos institucionales minimalistas: sello UMG + Ingeniería en Sistemas UMG Cobán
  drawLogos(g, x, y, size, alpha = 0.85, align = 'left') {
    const { umg, sis } = this.logos;
    const sisH = size * 0.42, sisW = sisH * LOGO_SISTEMAS_RATIO, gap = size * 0.25;
    const total = size + gap + sisW;
    const x0 = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    g.save();
    g.globalAlpha = alpha;
    if (umg.complete && umg.naturalWidth) g.drawImage(umg, x0, y, size, size);
    if (sis.complete && sis.naturalWidth) g.drawImage(sis, x0 + size + gap, y + (size - sisH) / 2, sisW, sisH);
    g.restore();
  }

  idleFor() {
    return (performance.now() - this.input.lastActivity) / 1000;
  }
}
