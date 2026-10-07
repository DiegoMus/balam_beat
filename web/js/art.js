// Arte de Balam Beat: synthwave en el bosque nuboso verapacense.
// Todo se dibuja con código (sin imágenes externas).

import { CONFIG } from './config.js';

const W = CONFIG.width;
const H = CONFIG.height;
export const HORIZON = 300;

export const PALETTE = {
  night: '#140A2B',
  night2: '#24104A',
  jade: '#3FE0D0',
  magenta: '#FF3D9A',
  gold: '#FFC93C',
  orchid: '#FFF7F0',
  lilac: '#B98CFF',
  stone: '#2E2A3D',
  stoneLight: '#4A4560',
};

function offscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ------------------------------------------------------------------
// Fondo: cielo, sol neón partido, montañas, ceibas y cuadrícula
// ------------------------------------------------------------------
export class Background {
  constructor() {
    this.static = this._renderStatic();
    this.drops = Array.from({ length: 90 }, () => ({
      x: Math.random() * W, y: Math.random() * H, v: 260 + Math.random() * 220,
    }));
    this.gridOffset = 0;
  }

  _renderStatic() {
    const c = offscreen(W, H);
    const g = c.getContext('2d');

    const sky = g.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#0B0620');
    sky.addColorStop(0.6, PALETTE.night2);
    sky.addColorStop(1, '#5A1A5E');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, HORIZON);

    // estrellas
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.6})`;
      const s = Math.random() < 0.15 ? 3 : 2;
      g.fillRect(Math.floor(Math.random() * W), Math.floor(Math.random() * (HORIZON - 80)), s, s);
    }

    // sol neón partido en franjas (en su propio lienzo para recortar las franjas)
    const r = 140;
    const sunC = offscreen(r * 2, r * 2);
    const s = sunC.getContext('2d');
    const sun = s.createLinearGradient(0, 0, 0, r * 2);
    sun.addColorStop(0, PALETTE.gold);
    sun.addColorStop(0.5, '#FF7A59');
    sun.addColorStop(1, PALETTE.magenta);
    s.fillStyle = sun;
    s.beginPath();
    s.arc(r, r, r, 0, Math.PI * 2);
    s.fill();
    s.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 8; i++) {
      s.fillRect(0, r * 0.9 + i * 22, r * 2, 3 + i * 1.6);
    }
    const halo = g.createRadialGradient(W / 2, HORIZON - 90, r * 0.8, W / 2, HORIZON - 90, r * 2);
    halo.addColorStop(0, 'rgba(255,61,154,0.35)');
    halo.addColorStop(1, 'rgba(255,61,154,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, W, HORIZON);
    g.drawImage(sunC, W / 2 - r, HORIZON - 90 - r);

    // montañas verapacenses en capas
    const layers = [
      { base: HORIZON - 25, amp: 50, color: '#3A1550', seed: 1 },
      { base: HORIZON - 10, amp: 40, color: '#251040', seed: 2 },
      { base: HORIZON, amp: 26, color: '#160A2C', seed: 3 },
    ];
    for (const L of layers) {
      g.fillStyle = L.color;
      g.beginPath();
      g.moveTo(0, HORIZON);
      for (let x = 0; x <= W; x += 8) {
        const y = L.base - Math.abs(Math.sin(x * 0.006 * L.seed + L.seed) * L.amp)
          - Math.sin(x * 0.021 + L.seed * 3) * 10;
        g.lineTo(x, y);
      }
      g.lineTo(W, HORIZON);
      g.closePath();
      g.fill();
    }

    // neblina
    const fog = g.createLinearGradient(0, HORIZON - 60, 0, HORIZON);
    fog.addColorStop(0, 'rgba(185,140,255,0)');
    fog.addColorStop(1, 'rgba(185,140,255,0.22)');
    g.fillStyle = fog;
    g.fillRect(0, HORIZON - 60, W, 60);

    // ceibas a los lados
    drawCeiba(g, 120, HORIZON + 4, 1.0);
    drawCeiba(g, W - 140, HORIZON + 4, 1.15);

    // suelo
    const floor = g.createLinearGradient(0, HORIZON, 0, H);
    floor.addColorStop(0, '#1A0B33');
    floor.addColorStop(1, '#090414');
    g.fillStyle = floor;
    g.fillRect(0, HORIZON, W, H - HORIZON);

    return c;
  }

  update(dt, speed = 1) {
    this.gridOffset = (this.gridOffset + dt * 0.6 * speed) % 1;
    for (const d of this.drops) {
      d.y += d.v * dt;
      d.x -= d.v * dt * 0.15;
      if (d.y > H) { d.y = -10; d.x = Math.random() * (W + 100); }
    }
  }

  draw(g, pulse = 0) {
    g.drawImage(this.static, 0, 0);

    // cuadrícula en perspectiva
    g.save();
    g.strokeStyle = `rgba(255,61,154,${0.35 + pulse * 0.4})`;
    g.lineWidth = 2;
    const vx = W / 2;
    g.beginPath();
    for (let i = -14; i <= 14; i++) {
      g.moveTo(vx + i * 12, HORIZON);
      g.lineTo(vx + i * 160, H);
    }
    for (let i = 0; i < 12; i++) {
      const z = (i + this.gridOffset) / 12;
      const y = HORIZON + (H - HORIZON) * z * z;
      g.moveTo(0, y);
      g.lineTo(W, y);
    }
    g.stroke();
    g.restore();

    // chipi-chipi (llovizna de píxeles)
    g.fillStyle = 'rgba(160,220,255,0.35)';
    for (const d of this.drops) g.fillRect(d.x, d.y, 2, 8);
  }
}

function drawCeiba(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = '#0C0518';
  g.fillRect(-8, -150, 16, 150);
  g.beginPath();
  g.moveTo(-8, -40); g.lineTo(-34, 0); g.lineTo(-6, 0); g.fill();
  g.beginPath();
  g.moveTo(8, -40); g.lineTo(34, 0); g.lineTo(6, 0); g.fill();
  // ramas abiertas y copa en capas de follaje
  g.lineWidth = 7;
  g.strokeStyle = '#0C0518';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(0, -120); g.quadraticCurveTo(sx * 40, -150, sx * 90, -160);
    g.moveTo(0, -140); g.quadraticCurveTo(sx * 25, -175, sx * 55, -185);
    g.stroke();
  }
  for (const [w, yy, r] of [[230, -162, 16], [170, -186, 14], [100, -204, 12]]) {
    for (let x = -w / 2; x <= w / 2; x += r * 1.2) {
      const bump = Math.sin(x * 0.3 + yy) * 4;
      g.beginPath();
      g.arc(x, yy + bump, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

// ------------------------------------------------------------------
// Brillos prerenderizados (más rápido que shadowBlur en la Raspberry)
// ------------------------------------------------------------------
const glowCache = new Map();
export function glowSprite(color, size = 128) {
  const key = color + size;
  if (glowCache.has(key)) return glowCache.get(key);
  const c = offscreen(size, size);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, hexA(color, 0.45));
  grad.addColorStop(1, hexA(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowCache.set(key, c);
  return c;
}

export function drawGlow(g, color, x, y, radius, alpha = 1) {
  const s = glowSprite(color);
  g.save();
  g.globalAlpha = alpha;
  g.globalCompositeOperation = 'lighter';
  g.drawImage(s, x - radius, y - radius, radius * 2, radius * 2);
  g.restore();
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ------------------------------------------------------------------
// Texto neón
// ------------------------------------------------------------------
export function text(g, str, x, y, { size = 20, color = PALETTE.orchid, align = 'center', glow = null, alpha = 1, baseline = 'middle' } = {}) {
  g.save();
  g.globalAlpha = alpha;
  g.font = `${size}px ${CONFIG.font}`;
  g.textAlign = align;
  g.textBaseline = baseline;
  if (glow) {
    g.shadowColor = glow;
    g.shadowBlur = size * 0.8;
  }
  g.fillStyle = color;
  g.fillText(str, x, y);
  g.restore();
}

// ------------------------------------------------------------------
// Numeración maya (vigesimal): puntos = 1, barras = 5, caracol = 0
// Los niveles se apilan de arriba (mayor) hacia abajo (unidades).
// ------------------------------------------------------------------
export function mayaDigits(n) {
  n = Math.max(0, Math.floor(n));
  if (n === 0) return [0];
  const d = [];
  while (n > 0) { d.unshift(n % 20); n = Math.floor(n / 20); }
  return d;
}

function drawMayaDigit(g, d, x, y, u, color) {
  // ocupa un cuadro de 4u x 3u centrado en x, con la parte superior en y
  g.fillStyle = color;
  if (d === 0) {
    g.save();
    g.strokeStyle = color;
    g.lineWidth = Math.max(2, u * 0.3);
    g.beginPath();
    g.ellipse(x, y + u * 1.5, u * 1.8, u * 1.0, 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(x - u * 1.1, y + u * 1.2); g.lineTo(x + u * 1.1, y + u * 1.2);
    g.moveTo(x - u * 0.9, y + u * 1.8); g.lineTo(x + u * 0.9, y + u * 1.8);
    g.stroke();
    g.restore();
    return;
  }
  const bars = Math.floor(d / 5);
  const dots = d % 5;
  const rowH = u * 0.75;
  let yy = y + u * 3 - bars * rowH;
  for (let b = 0; b < bars; b++) {
    g.fillRect(x - u * 2, yy + b * rowH + u * 0.1, u * 4, rowH * 0.6);
  }
  if (dots) {
    const dy = yy - u * 0.55;
    const gap = u * 0.95;
    const start = x - ((dots - 1) * gap) / 2;
    for (let i = 0; i < dots; i++) {
      g.beginPath();
      g.arc(start + i * gap, dy, u * 0.35, 0, Math.PI * 2);
      g.fill();
    }
  }
}

// Devuelve la altura dibujada
export function drawMayaNumber(g, n, x, y, u, color = PALETTE.gold) {
  const digits = mayaDigits(n);
  const levelH = u * 3.8;
  digits.forEach((d, i) => drawMayaDigit(g, d, x, y + i * levelH, u, color));
  return digits.length * levelH;
}

// Glifo de carril: tablilla con 1 a 4 puntos (numeral maya del carril)
export function drawGlyphTile(g, x, y, size, color, lane, { fill = 0.18, alpha = 1, lit = false } = {}) {
  const r = size / 2;
  g.save();
  g.globalAlpha = alpha;
  roundRect(g, x - r, y - r * 0.72, size, size * 0.72, size * 0.16);
  g.fillStyle = lit ? color : hexA(color, fill);
  g.fill();
  g.lineWidth = Math.max(2, size * 0.07);
  g.strokeStyle = color;
  g.stroke();
  // puntos del numeral
  g.fillStyle = lit ? PALETTE.night : color;
  const n = lane + 1;
  const gap = size * 0.2;
  const sx = x - ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) {
    g.beginPath();
    g.arc(sx + i * gap, y - size * 0.06, size * 0.065, 0, Math.PI * 2);
    g.fill();
  }
  // barra inferior decorativa
  g.fillRect(x - size * 0.3, y + size * 0.1, size * 0.6, size * 0.06);
  g.restore();
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ------------------------------------------------------------------
// Pixel art: quetzal, monja blanca y ojos del jaguar
// ------------------------------------------------------------------
const QUETZAL = [
  '......GGG.......',
  '.....GGGGG......',
  '....GGKGGGG.....',
  '...YGGGGGGGG....',
  '.....RRGGGGGG...',
  '.....RRRGGGGGGG.',
  '......RRRGGGGGGGGGG.....',
  '.......RRGGGGGGGGGGGGGG.',
  '........G.G....GGGGGGGGGGGG',
  '...................GGGGGGGGGG',
];
const MONJA = [
  '.....WW.....',
  '....WWWW....',
  '.WW.WWWW.WW.',
  'WWWWWWWWWWWW',
  '.WWWWPPWWWW.',
  '..WWPYYPWW..',
  '.WWWWPPWWWW.',
  'WWWW.WW.WWWW',
  '.WW..WW..WW.',
  '.....GG.....',
  '....GGGG....',
  '.....GG.....',
];
const PIX_COLORS = {
  G: '#1FD07A', K: '#0B0620', Y: '#FFC93C', R: '#FF2E4D',
  W: '#FFF7F0', P: '#FF9AD5', '.': null,
};

export function drawPixels(g, map, x, y, px, flip = false) {
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < row.length; c++) {
      const col = PIX_COLORS[row[c]];
      if (!col) continue;
      g.fillStyle = col;
      const cx = flip ? x + (row.length - 1 - c) * px : x + c * px;
      g.fillRect(cx, y + r * px, px, px);
    }
  }
}
export const drawQuetzal = (g, x, y, px, flip) => drawPixels(g, QUETZAL, x, y, px, flip);
export const drawMonjaBlanca = (g, x, y, px) => drawPixels(g, MONJA, x, y, px);

export function drawJaguarEyes(g, cx, cy, t, scale = 1) {
  const blink = (t % 4.2) > 4.0 ? 0.12 : 1;
  for (const side of [-1, 1]) {
    const x = cx + side * 90 * scale;
    drawGlow(g, PALETTE.gold, x, cy, 90 * scale, 0.55);
    g.save();
    g.translate(x, cy);
    g.rotate(side * -0.18);
    g.scale(1, blink);
    g.fillStyle = PALETTE.gold;
    g.beginPath();
    g.ellipse(0, 0, 46 * scale, 20 * scale, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = PALETTE.night;
    g.beginPath();
    g.ellipse(0, 0, 7 * scale, 18 * scale, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
}
