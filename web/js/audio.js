// Motor de audio. El reloj de la canción sale de la Web Audio API
// (no de la animación) para que las notas nunca se desfasen de la música.

import { CONFIG } from './config.js';

export class AudioEngine {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });

    this.out = this.ctx.createDynamicsCompressor();
    this.out.connect(this.ctx.destination);

    this.music = this.ctx.createGain();
    this.music.gain.value = CONFIG.musicVolume;
    this.music.connect(this.out);

    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = CONFIG.sfxVolume;
    this.sfx.connect(this.out);

    this.source = null;
    this.songStart = 0;   // tiempo de contexto en que empieza el buffer
    this.buffer = null;
  }

  get unlocked() { return this.ctx.state === 'running'; }

  async unlock() {
    if (this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch (_) { /* requiere gesto del usuario */ }
    }
  }

  // Convierte un instante de performance.now() (ms) al tiempo AUDIBLE del contexto.
  ctxTimeAt(perfMs) {
    const ts = this.ctx.getOutputTimestamp ? this.ctx.getOutputTimestamp() : null;
    if (ts && ts.performanceTime > 0) {
      return ts.contextTime + (perfMs - ts.performanceTime) / 1000;
    }
    const latency = this.ctx.outputLatency || this.ctx.baseLatency || 0;
    return this.ctx.currentTime - latency - (performance.now() - perfMs) / 1000;
  }

  // Tiempo de la canción (s) en un instante dado; negativo durante la cuenta regresiva.
  songTimeAt(perfMs) {
    return this.ctxTimeAt(perfMs) - this.songStart;
  }

  get songTime() { return this.songTimeAt(performance.now()); }

  async decode(arrayBuffer) {
    return await this.ctx.decodeAudioData(arrayBuffer);
  }

  async loadUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo cargar el audio: ${url}`);
    return this.decode(await res.arrayBuffer());
  }

  // Programa la canción para empezar dentro de `delay` segundos.
  play(buffer, delay) {
    this.stop();
    this.buffer = buffer;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.music);
    const startAt = this.ctx.currentTime + delay;
    src.start(startAt);
    this.source = src;
    this.songStart = startAt;
  }

  stop() {
    if (this.source) {
      try { this.source.stop(); } catch (_) { /* ya detenido */ }
      this.source.disconnect();
      this.source = null;
    }
  }

  // ---------- Efectos de sonido sintetizados ----------
  _env(gainNode, t, peak, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }

  // Golpe de tun (tambor de madera) al acertar
  hit(lane, perfect) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const base = [196, 220, 262, 294][lane] * (perfect ? 2 : 1.5);
    o.type = 'triangle';
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.6, t + 0.08);
    this._env(g, t, 0.5, 0.12);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.15);
  }

  miss() {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
    this._env(g, t, 0.18, 0.2);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.22);
  }

  // Clic de menú (caracol/ocarina estilizada)
  blip(pitch = 660) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(pitch, t);
    this._env(g, t, 0.12, 0.08);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.1);
  }

  // Clic de metrónomo para calibración, programado a un tiempo de contexto
  clickAt(ctxTime, accent) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = accent ? 1320 : 880;
    this._env(g, ctxTime, 0.3, 0.05);
    o.connect(g).connect(this.sfx);
    o.start(ctxTime);
    o.stop(ctxTime + 0.07);
  }
}
