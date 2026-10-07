// Entrada unificada: controlador MIDI (barreras láser) + teclado de respaldo.
// Emite eventos de carril con la marca de tiempo original del evento
// (performance.now), para juzgar los aciertos con precisión.

import { CONFIG } from './config.js';

export class Input {
  constructor() {
    this.down = new Array(CONFIG.lanes).fill(false);
    this.downSince = new Array(CONFIG.lanes).fill(0);
    this.listeners = { press: [], release: [], key: [], any: [] };
    this.midiDevices = [];
    this.midiStatus = 'sin-soporte'; // 'sin-soporte' | 'pendiente' | 'listo' | 'denegado'
    this.lastActivity = performance.now();

    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));
    window.addEventListener('blur', () => {
      for (let i = 0; i < CONFIG.lanes; i++) if (this.down[i]) this._release(i, performance.now());
    });
    this._initMidi();
  }

  on(type, fn) { this.listeners[type].push(fn); }
  _emit(type, ...args) { for (const fn of this.listeners[type]) fn(...args); }

  _press(lane, time) {
    if (this.down[lane]) return;
    this.down[lane] = true;
    this.downSince[lane] = time;
    this.lastActivity = performance.now();
    this._emit('press', lane, time);
    this._emit('any');
  }

  _release(lane, time) {
    if (!this.down[lane]) return;
    this.down[lane] = false;
    this._emit('release', lane, time);
  }

  // Cuánto tiempo (s) lleva presionado un carril, 0 si está suelto
  heldFor(lane) {
    return this.down[lane] ? (performance.now() - this.downSince[lane]) / 1000 : 0;
  }

  _onKey(e, isDown) {
    const lane = CONFIG.keys.indexOf(e.code);
    if (lane >= 0) {
      e.preventDefault();
      if (e.repeat) return;
      if (isDown) this._press(lane, e.timeStamp || performance.now());
      else this._release(lane, e.timeStamp || performance.now());
      return;
    }
    if (isDown) {
      this.lastActivity = performance.now();
      this._emit('key', e);
      this._emit('any');
    }
  }

  async _initMidi() {
    if (!navigator.requestMIDIAccess) return;
    this.midiStatus = 'pendiente';
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      this.midiStatus = 'listo';
      const bind = () => {
        this.midiDevices = [];
        for (const input of access.inputs.values()) {
          input.onmidimessage = (msg) => this._onMidi(msg);
          this.midiDevices.push(input.name || 'Controlador MIDI');
        }
      };
      bind();
      access.onstatechange = bind;
    } catch (_) {
      this.midiStatus = 'denegado';
    }
  }

  _onMidi(msg) {
    const [status, note, velocity] = msg.data;
    const type = status & 0xf0;
    const lane = CONFIG.midiNotes.indexOf(note);
    if (lane < 0) return;
    const time = msg.timeStamp || performance.now();
    if (type === 0x90 && velocity > 0) this._press(lane, time);
    else if (type === 0x80 || (type === 0x90 && velocity === 0)) this._release(lane, time);
  }

  get controllerLabel() {
    if (this.midiDevices.length) return `Controlador: ${this.midiDevices[0]}`;
    return 'Teclado: D F J K';
  }
}
