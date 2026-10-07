// Entrada unificada: controlador MIDI (barreras láser) + teclado de respaldo.
// Emite eventos de carril con la marca de tiempo original del evento
// (performance.now), para juzgar los aciertos con precisión.

import { CONFIG } from './config.js';
import { parseSerialLines } from './serial-protocol.js';

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

    // Serial
    this.serialPort = null;
    this.serialInfo = '';
    this.serialStatus = 'serial' in navigator ? 'desconectado' : 'sin-soporte';
    this._initSerial();
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

  // ------------------------- Web Serial -------------------------
  async _initSerial() {
    if (!('serial' in navigator)) return;
    navigator.serial.addEventListener('connect', (e) => {
      if (CONFIG.serial.autoConnect && !this.serialPort) this._openSerial(e.target);
    });
    navigator.serial.addEventListener('disconnect', (e) => {
      if (e.target === this.serialPort) this._serialLost();
    });
    // Puertos autorizados antes: se reconectan solos (sin diálogo)
    if (CONFIG.serial.autoConnect) {
      try {
        const ports = await navigator.serial.getPorts();
        if (ports.length) this._openSerial(ports[0]);
      } catch (_) { /* sin permiso */ }
    }
  }

  // Abre el selector de puertos del navegador. Debe llamarse desde un gesto
  // del usuario (tecla o clic): así lo exige el navegador.
  async connectSerial() {
    if (!('serial' in navigator)) { this.serialStatus = 'sin-soporte'; return; }
    try {
      const port = await navigator.serial.requestPort();
      await this.disconnectSerial();
      await this._openSerial(port);
    } catch (_) {
      // el usuario cerró el selector sin elegir
    }
  }

  async disconnectSerial() {
    const port = this.serialPort;
    if (!port) return;
    this.serialPort = null;
    try { await this._serialReader?.cancel(); } catch (_) { /* ignorar */ }
    try { await port.close(); } catch (_) { /* ignorar */ }
    this.serialStatus = 'desconectado';
  }

  async _openSerial(port) {
    try {
      await port.open({ baudRate: CONFIG.serial.baudRate });
    } catch (err) {
      // "already open" = otra pestaña o el Monitor Serie del IDE lo está usando
      this.serialStatus = 'ocupado';
      return;
    }
    this.serialPort = port;
    this.serialStatus = 'conectado';
    this.serialInfo = '';

    // Pide identificación y estado actual de los carriles
    try {
      const w = port.writable.getWriter();
      await w.write(new TextEncoder().encode('?\n'));
      w.releaseLock();
    } catch (_) { /* placa sin escritura: no es grave */ }

    this._readSerial(port);
  }

  async _readSerial(port) {
    const decoder = new TextDecoder();
    let buffer = '';
    while (port.readable && this.serialPort === port) {
      const reader = port.readable.getReader();
      this._serialReader = reader;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const time = performance.now();
          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = parseSerialLines(buffer);
          buffer = rest;
          for (const ev of events) this._onSerialEvent(ev, time);
        }
      } catch (_) {
        // error de lectura (p. ej. ruido o desconexión): se reintenta si el puerto sigue abierto
      } finally {
        reader.releaseLock();
      }
    }
    if (this.serialPort === port) this._serialLost();
  }

  _onSerialEvent(ev, time) {
    if (ev.type === 'hello') {
      this.serialInfo = `Balam Beat v${ev.version}`;
      return;
    }
    if (ev.lane >= CONFIG.lanes) return;
    if (ev.type === 'press') this._press(ev.lane, time);
    else this._release(ev.lane, time);
  }

  _serialLost() {
    this.serialPort = null;
    this.serialStatus = 'desconectado';
    for (let i = 0; i < CONFIG.lanes; i++) if (this.down[i]) this._release(i, performance.now());
  }

  get controllerLabel() {
    if (this.serialPort) return `Serial: ${this.serialInfo || 'conectado'}`;
    if (this.midiDevices.length) return `MIDI: ${this.midiDevices[0]}`;
    return 'Teclado: D F J K';
  }
}
