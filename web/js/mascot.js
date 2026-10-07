// Balam Cachorro: la mascota del juego.
// Baila al ritmo de la canción, celebra los combos y se pone triste con los fallos.
// Conserva los ojos dorados de la pantalla de inicio.

import { PALETTE, drawGlow } from './art.js';

const FUR = '#F2AE45';
const LIGHT = '#FFE9C2';
const SPOT = '#4A2410';
const ROSETTES = [[-60, -70, 9], [-2, -88, 8], [52, -72, 9], [-88, -20, 7], [88, -22, 7], [-30, -64, 5], [26, -60, 5]];

export class Mascot {
  constructor() {
    this.mood = 'normal';   // 'normal' | 'feliz' | 'triste'
    this.moodTime = 0;      // segundos restantes del ánimo temporal
    this.base = 'normal';   // ánimo al que vuelve
    this.tear = 0;
  }

  // Cambia el ánimo por un rato; un fallo no interrumpe una celebración recién empezada
  react(mood, seconds = 1.2) {
    if (mood === 'triste' && this.mood === 'feliz' && this.moodTime > 0.8) return;
    this.mood = mood;
    this.moodTime = seconds;
  }

  setBase(mood) {
    this.base = mood;
    if (this.moodTime <= 0) this.mood = mood;
  }

  update(dt) {
    if (this.moodTime > 0) {
      this.moodTime -= dt;
      if (this.moodTime <= 0) this.mood = this.base;
    }
    this.tear = (this.tear + dt * 40) % 30;
  }

  // beat: valor entre -1 y 1 que sigue el pulso de la música
  draw(g, x, y, scale, t, beat = Math.sin(t * Math.PI * 2 * 1.4)) {
    const mood = this.mood;
    const b = mood === 'feliz' ? beat : mood === 'triste' ? beat * 0.2 : beat * 0.7;
    const bob = b * 6;

    g.save();
    g.translate(x, y);
    g.scale(scale, scale);
    g.lineCap = 'round';

    // cola
    g.strokeStyle = FUR;
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(40, 110);
    g.quadraticCurveTo(110, 100 + b * 20, 100, 40 + b * 15);
    g.stroke();
    g.strokeStyle = SPOT;
    g.beginPath();
    g.moveTo(101, 50 + b * 15);
    g.lineTo(100, 40 + b * 15);
    g.stroke();

    // cuerpo
    g.fillStyle = FUR;
    g.beginPath();
    g.ellipse(0, 105 + bob * 0.3, 62, 52, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = LIGHT;
    g.beginPath();
    g.ellipse(0, 115 + bob * 0.3, 36, 36, 0, 0, Math.PI * 2);
    g.fill();

    // brazos: arriba al celebrar, abajo si está triste
    for (const s of [-1, 1]) {
      const up = mood === 'feliz' ? -70 + b * 8 : mood === 'triste' ? 30 : -10 + b * 6;
      g.strokeStyle = FUR;
      g.lineWidth = 20;
      g.beginPath();
      g.moveTo(s * 45, 85 + bob * 0.3);
      g.lineTo(s * 72, 85 + up);
      g.stroke();
      g.fillStyle = LIGHT;
      g.beginPath();
      g.arc(s * 72, 85 + up, 12, 0, Math.PI * 2);
      g.fill();
    }

    g.translate(0, bob + (mood === 'triste' ? 12 : 0));

    // orejas
    for (const s of [-1, 1]) {
      g.fillStyle = FUR;
      g.beginPath();
      g.arc(s * 70, -78, 28, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = SPOT;
      g.beginPath();
      g.arc(s * 70, -78, 15, 0, Math.PI * 2);
      g.fill();
    }

    // cabeza con halo neón (sprite de brillo, más ligero que shadowBlur)
    drawGlow(g, PALETTE.magenta, 0, -15, 150, mood === 'feliz' ? 0.55 : 0.3);
    g.fillStyle = FUR;
    g.beginPath();
    g.ellipse(0, -15, 108, 92, 0, 0, Math.PI * 2);
    g.fill();

    // rosetas
    g.strokeStyle = SPOT;
    g.lineWidth = 4;
    for (const [rx, ry, r] of ROSETTES) {
      g.beginPath();
      g.arc(rx, ry, r, 0.4, 5.4);
      g.stroke();
    }

    // hocico, nariz y boca
    g.fillStyle = LIGHT;
    g.beginPath();
    g.ellipse(0, 32, 56, 40, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = PALETTE.magenta;
    g.beginPath();
    g.moveTo(-12, 12); g.lineTo(12, 12); g.lineTo(0, 26);
    g.closePath();
    g.fill();

    g.strokeStyle = SPOT;
    g.lineWidth = 3;
    g.beginPath();
    if (mood === 'triste') {
      g.arc(0, 52, 12, Math.PI * 1.15, Math.PI * 1.85);
    } else {
      const smile = mood === 'feliz' ? 1 : 0.8;
      g.moveTo(0, 26); g.lineTo(0, 34);
      g.arc(-9, 34, 9, 0, Math.PI * smile);
      g.moveTo(18, 34);
      g.arc(9, 34, 9, 0, Math.PI * smile);
    }
    g.stroke();
    if (mood === 'feliz') {
      g.fillStyle = PALETTE.magenta;
      g.beginPath();
      g.ellipse(0, 46, 9, 7, 0, 0, Math.PI);
      g.fill();
    }

    // mejillas
    g.fillStyle = 'rgba(255,61,154,0.35)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(s * 72, 18, 14, 9, 0, 0, Math.PI * 2);
      g.fill();
    }

    drawEyes(g, 0, -22, 42, 30, t, mood);

    if (mood === 'triste') {
      g.fillStyle = PALETTE.jade;
      g.beginPath();
      g.ellipse(-46, 2 + this.tear, 4, 6, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    if (mood === 'feliz') drawSparkles(g, x, y, scale, t);
  }
}

// Los ojos de Balam (mismos de la pantalla de inicio)
function drawEyes(g, cx, cy, spread, w, t, mood) {
  const blink = (t % 4.2) > 4.0 ? 0.1 : 1;
  const squint = mood === 'feliz' ? 0.45 : mood === 'triste' ? 0.7 : 1;
  const tilt = 0.15;
  for (const side of [-1, 1]) {
    const x = cx + side * spread;
    drawGlow(g, PALETTE.gold, x, cy, w * 2.2, 0.45);
    g.save();
    g.translate(x, cy);
    g.rotate(side * (mood === 'triste' ? tilt * 1.8 : -tilt));
    g.scale(1, blink * squint);
    g.fillStyle = PALETTE.gold;
    g.beginPath();
    g.ellipse(0, 0, w, w * 0.44, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = PALETTE.night;
    g.beginPath();
    g.ellipse(side * w * 0.05, 0, w * 0.15, w * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
}

function drawSparkles(g, x, y, scale, t) {
  for (let i = 0; i < 8; i++) {
    const a = i * 0.785 + t * 1.5;
    const r = (150 + Math.sin(t * 4 + i) * 10) * scale;
    g.fillStyle = i % 2 ? PALETTE.gold : PALETTE.jade;
    g.fillRect(x + Math.cos(a) * r - 3, y + 20 * scale + Math.sin(a) * r * 0.75 - 3, 6, 6);
  }
}
