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
// Fondo: bosque húmedo verapacense de noche. Luna entre la neblina,
// montañas, ceibas, lianas, helechos, heliconias, luciérnagas y
// chipi-chipi. Lo estático se pinta una vez; lo animado, cada cuadro.
// ------------------------------------------------------------------
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FOREST = {
  sky0: '#020D0A', sky1: '#07231C', sky2: '#12392F',
  far: '#14382F', mid: '#0B241E', near: '#061612', ink: '#030C09',
  moss: '#0E2A1F', mist: '200,255,235', moon: '#DFFFF4',
};

export class Background {
  constructor() {
    this.static = this._renderStatic();
    this.front = this._renderFront();
    this.mist = [0, 1, 2].map((i) => this._renderMist(i));
    const rnd = seeded(9);
    this.drops = Array.from({ length: 140 }, () => ({
      x: rnd() * W, y: rnd() * H, v: 320 + rnd() * 260, l: 6 + rnd() * 8,
    }));
    this.flies = Array.from({ length: 46 }, () => ({
      x: rnd() * W, y: 120 + rnd() * (H - 160), ph: rnd() * 6.28, sp: 0.4 + rnd() * 0.8,
      col: rnd() < 0.7 ? '#D7FF6B' : PALETTE.jade,
    }));
    this.t = 0;
    this.flow = 0;
  }

  _renderStatic() {
    const c = offscreen(W, H);
    const g = c.getContext('2d');
    const rnd = seeded(2026);

    // cielo nocturno verde-azulado
    const sky = g.createLinearGradient(0, 0, 0, HORIZON + 40);
    sky.addColorStop(0, FOREST.sky0);
    sky.addColorStop(0.6, FOREST.sky1);
    sky.addColorStop(1, FOREST.sky2);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    // luna con halo, velada por la neblina
    const mx = W * 0.76, my = 150;
    const halo = g.createRadialGradient(mx, my, 20, mx, my, 260);
    halo.addColorStop(0, 'rgba(223,255,244,0.35)');
    halo.addColorStop(1, 'rgba(223,255,244,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, W, HORIZON + 40);
    g.fillStyle = FOREST.moon;
    g.globalAlpha = 0.9;
    g.beginPath();
    g.arc(mx, my, 46, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;

    // pocas estrellas entre nubes
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(220,255,240,${0.15 + rnd() * 0.4})`;
      g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * 150), 2, 2);
    }

    // montañas de la Verapaz en capas de neblina
    const ridge = (base, amp, color, seed, step = 6) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += step) {
        const y = base - Math.abs(Math.sin(x * 0.0045 * seed + seed)) * amp
          - Math.sin(x * 0.019 + seed * 2) * amp * 0.18;
        g.lineTo(x, y);
      }
      g.lineTo(W, H);
      g.closePath();
      g.fill();
    };
    ridge(HORIZON - 30, 90, '#1A453A', 1.3);
    fogBand(g, HORIZON - 70, 70, 0.18);
    ridge(HORIZON - 10, 60, '#123329', 2.1);
    fogBand(g, HORIZON - 40, 60, 0.2);

    // línea de selva lejana: copas redondeadas
    canopyLine(g, rnd, HORIZON + 6, 26, FOREST.far, 18);
    fogBand(g, HORIZON - 20, 50, 0.22);
    canopyLine(g, rnd, HORIZON + 22, 34, FOREST.mid, 24);

    // suelo húmedo con musgo y reflejo de la luna
    const floor = g.createLinearGradient(0, HORIZON + 20, 0, H);
    floor.addColorStop(0, '#0A221B');
    floor.addColorStop(1, '#020806');
    g.fillStyle = floor;
    g.fillRect(0, HORIZON + 20, W, H - HORIZON - 20);
    const shine = g.createRadialGradient(W / 2, HORIZON + 60, 10, W / 2, HORIZON + 60, 420);
    shine.addColorStop(0, 'rgba(160,255,220,0.12)');
    shine.addColorStop(1, 'rgba(160,255,220,0)');
    g.fillStyle = shine;
    g.fillRect(0, HORIZON + 20, W, H);

    // ceibas a los lados (árbol sagrado del bosque)
    drawCeiba(g, 150, HORIZON + 40, 1.15);
    drawCeiba(g, W - 160, HORIZON + 40, 1.3);
    return c;
  }

  // Primer plano: lianas desde arriba, helechos y heliconias en las esquinas
  _renderFront() {
    const c = offscreen(W, H);
    const g = c.getContext('2d');
    const rnd = seeded(77);

    // copas que enmarcan la parte superior
    g.fillStyle = FOREST.ink;
    for (let x = -40; x < W + 40; x += 34) {
      const edge = x < 260 || x > W - 260 ? 1 : 0.35;
      const r = (26 + rnd() * 30) * edge + 10;
      g.beginPath();
      g.arc(x, -8 + rnd() * 18 * edge, r, 0, Math.PI * 2);
      g.fill();
    }

    // lianas con hojas
    for (const [x, len, sway] of [[70, 300, 20], [210, 190, -14], [330, 120, 10], [W - 80, 330, -22], [W - 230, 210, 16], [W - 360, 110, -8]]) {
      drawVine(g, rnd, x, len, sway);
    }

    // helechos y hojas grandes en las esquinas inferiores
    drawFern(g, rnd, 20, H + 10, -1.05, 260);
    drawFern(g, rnd, 110, H + 20, -0.55, 200);
    drawFern(g, rnd, W - 20, H + 10, -2.1, 260);
    drawFern(g, rnd, W - 120, H + 20, -2.55, 210);
    drawLeaf(g, -30, H - 60, -0.3, 230, 70);
    drawLeaf(g, W + 30, H - 70, Math.PI + 0.35, 240, 74);
    drawHeliconia(g, 205, H - 30, 0.9);
    drawHeliconia(g, W - 210, H - 20, 1.05);
    return c;
  }

  _renderMist(i) {
    const c = offscreen(W, 140);
    const g = c.getContext('2d');
    const rnd = seeded(300 + i);
    for (let k = 0; k < 18; k++) {
      const x = rnd() * W, y = 40 + rnd() * 60, rx = 120 + rnd() * 200, ry = 18 + rnd() * 22;
      const grad = g.createRadialGradient(x, y, 0, x, y, rx);
      grad.addColorStop(0, `rgba(${FOREST.mist},${0.07 + i * 0.02})`);
      grad.addColorStop(1, `rgba(${FOREST.mist},0)`);
      g.fillStyle = grad;
      g.save();
      g.translate(x, y);
      g.scale(1, ry / rx);
      g.translate(-x, -y);
      g.beginPath();
      g.arc(x, y, rx, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    return c;
  }

  update(dt, speed = 1) {
    this.t += dt;
    this.flow = (this.flow + dt * 0.5 * speed) % 1;
    for (const d of this.drops) {
      d.y += d.v * dt;
      d.x -= d.v * dt * 0.12;
      if (d.y > H) { d.y = -12; d.x = Math.random() * (W + 120); }
    }
    for (const f of this.flies) {
      f.ph += dt * f.sp;
      f.x += Math.cos(f.ph * 0.7) * 14 * dt;
      f.y += Math.sin(f.ph) * 10 * dt;
    }
  }

  draw(g, pulse = 0) {
    g.drawImage(this.static, 0, 0);

    // neblina que se desplaza entre las capas
    const offs = [this.t * 8, -this.t * 5, this.t * 12];
    const ys = [HORIZON - 120, HORIZON - 50, HORIZON + 10];
    for (let i = 0; i < 3; i++) {
      const x = ((offs[i] % W) + W) % W;
      g.drawImage(this.mist[i], x - W, ys[i]);
      g.drawImage(this.mist[i], x, ys[i]);
    }

    // vetas de agua/neblina en el suelo que avanzan con el ritmo
    g.save();
    g.strokeStyle = `rgba(120,255,210,${0.05 + pulse * 0.18})`;
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const z = (i + this.flow) / 10;
      const y = HORIZON + 24 + (H - HORIZON - 24) * z * z;
      const half = 120 + z * 620;
      g.moveTo(W / 2 - half, y);
      g.lineTo(W / 2 + half, y);
    }
    g.stroke();
    g.restore();

    // luciérnagas
    for (const f of this.flies) {
      const a = (0.35 + 0.65 * Math.max(0, Math.sin(f.ph * 2.3))) * (0.7 + pulse * 0.6);
      drawGlow(g, f.col, f.x, f.y, 10, a * 0.7);
      g.fillStyle = f.col;
      g.globalAlpha = Math.min(1, a);
      g.fillRect(f.x - 1, f.y - 1, 3, 3);
      g.globalAlpha = 1;
    }

    // chipi-chipi
    g.strokeStyle = 'rgba(190,240,225,0.28)';
    g.lineWidth = 1.5;
    g.beginPath();
    for (const d of this.drops) {
      g.moveTo(d.x, d.y);
      g.lineTo(d.x - d.l * 0.12, d.y + d.l);
    }
    g.stroke();

    g.drawImage(this.front, 0, 0);
  }
}

function fogBand(g, y, h, a) {
  const grad = g.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, `rgba(${FOREST.mist},0)`);
  grad.addColorStop(0.6, `rgba(${FOREST.mist},${a})`);
  grad.addColorStop(1, `rgba(${FOREST.mist},0)`);
  g.fillStyle = grad;
  g.fillRect(0, y, W, h);
}

function canopyLine(g, rnd, base, r, color, step) {
  g.fillStyle = color;
  g.fillRect(0, base, W, H - base);
  for (let x = -r; x < W + r; x += step) {
    const rr = r * (0.6 + rnd() * 0.7);
    g.beginPath();
    g.arc(x, base - rnd() * r * 0.6, rr, 0, Math.PI * 2);
    g.fill();
    if (rnd() < 0.18) { // árbol emergente
      g.fillRect(x - 3, base - r * 2.2, 6, r * 2.2);
      g.beginPath();
      g.ellipse(x, base - r * 2.3, r * 1.4, r * 0.6, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function drawCeiba(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = FOREST.near;
  g.strokeStyle = FOREST.near;
  // tronco con raíces tabulares
  g.fillRect(-9, -190, 18, 190);
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 6, -60); g.quadraticCurveTo(sx * 18, -14, sx * 46, 0); g.lineTo(sx * 4, 0); g.fill();
  }
  // ramas horizontales y copa en paraguas
  g.lineWidth = 7;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(0, -160); g.quadraticCurveTo(sx * 50, -190, sx * 110, -196);
    g.moveTo(0, -180); g.quadraticCurveTo(sx * 30, -215, sx * 70, -222);
    g.stroke();
  }
  for (const [w, yy, r] of [[260, -200, 18], [190, -226, 16], [110, -246, 13]]) {
    for (let px = -w / 2; px <= w / 2; px += r * 1.15) {
      g.beginPath();
      g.arc(px, yy + Math.sin(px * 0.3 + yy) * 5, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  // epífitas (bromelias) en las ramas, con un toque de color
  g.fillStyle = 'rgba(255,61,154,0.55)';
  for (const px of [-80, 60]) {
    g.beginPath();
    g.ellipse(px, -200, 6, 3, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function drawVine(g, rnd, x, len, sway) {
  g.strokeStyle = FOREST.ink;
  g.fillStyle = FOREST.ink;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x, 0);
  g.quadraticCurveTo(x + sway, len * 0.6, x + sway * 0.4, len);
  g.stroke();
  for (let t = 0.12; t < 1; t += 0.09) {
    const px = x + sway * 2 * t * (1 - t) * 0.6 + sway * 0.4 * t * t, py = len * t;
    const side = rnd() < 0.5 ? -1 : 1;
    g.save();
    g.translate(px, py);
    g.rotate(side * (0.6 + rnd() * 0.5));
    g.beginPath();
    g.ellipse(side * 9, 0, 10, 4.5, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
}

function drawFern(g, rnd, x, y, angle, len) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = FOREST.ink;
  g.strokeStyle = FOREST.ink;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.5, -len * 0.08, len, len * 0.12);
  g.stroke();
  for (let t = 0.08; t < 0.98; t += 0.05) {
    const px = len * t, py = -len * 0.16 * t * (1 - t) + len * 0.12 * t * t;
    const size = (1 - t) * 26 + 6;
    for (const side of [-1, 1]) {
      g.save();
      g.translate(px, py);
      g.rotate(side * 1.1 + 0.2);
      g.beginPath();
      g.ellipse(size * 0.55, 0, size * 0.6, size * 0.18, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  g.restore();
}

function drawLeaf(g, x, y, angle, len, wid) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = FOREST.ink;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.45, -wid, len, 0);
  g.quadraticCurveTo(len * 0.45, wid, 0, 0);
  g.fill();
  // nervaduras con un brillo húmedo
  g.strokeStyle = 'rgba(63,224,208,0.12)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(4, 0); g.lineTo(len * 0.95, 0);
  for (let t = 0.15; t < 0.9; t += 0.12) {
    g.moveTo(len * t, 0); g.lineTo(len * (t + 0.1), -wid * 0.55 * Math.sin(Math.PI * t));
    g.moveTo(len * t, 0); g.lineTo(len * (t + 0.1), wid * 0.55 * Math.sin(Math.PI * t));
  }
  g.stroke();
  g.restore();
}

// Heliconia: flor de brácteas rojas y amarillas del bosque húmedo
function drawHeliconia(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.strokeStyle = FOREST.ink;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(0, 30); g.lineTo(0, -150);
  g.stroke();
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const yy = -40 - i * 20;
    g.save();
    g.translate(0, yy);
    g.rotate(side * 0.5);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(side * 34, -6);
    g.lineTo(side * 4, -16);
    g.closePath();
    g.fillStyle = 'rgba(255,46,77,0.75)';
    g.fill();
    g.fillStyle = 'rgba(255,201,60,0.8)';
    g.fillRect(side > 0 ? 26 : -32, -8, 6, 3);
    g.restore();
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
