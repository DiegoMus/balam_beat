// Punto de entrada de Balam Beat.

import { CONFIG } from './config.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { loadCatalog } from './songs.js';
import { PlayScene } from './play.js';
import {
  AttractScene, AliasScene, SelectScene, LoadingScene, ResultsScene, HighscoresScene, CalibrationScene,
} from './scenes.js';

async function boot() {
  const canvas = document.getElementById('game');
  canvas.width = CONFIG.width;
  canvas.height = CONFIG.height;

  // Espera la fuente pixel (si no está disponible se usa la monoespaciada)
  try {
    await Promise.race([
      document.fonts.load(`20px ${CONFIG.font}`),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (_) { /* sin fuente */ }

  const audio = new AudioEngine();
  const input = new Input();
  const game = new Game(canvas, audio, input);
  game.songs = await loadCatalog();

  game.add('attract', new AttractScene());
  game.add('alias', new AliasScene());
  game.add('select', new SelectScene());
  game.add('loading', new LoadingScene());
  game.add('play', new PlayScene());
  game.add('results', new ResultsScene());
  game.add('highscores', new HighscoresScene());
  game.add('calibration', new CalibrationScene());

  game.go('attract');
  game.start();

  // P = pantalla completa ("proyector"); la F ya es un carril
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  });

  window.balam = game; // útil para depurar desde la consola
}

boot();
