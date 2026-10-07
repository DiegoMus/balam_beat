// Configuración general de Balam Beat.
// Casi todo lo que querrías ajustar para un evento está aquí.

export const CONFIG = {
  width: 1280,
  height: 720,

  lanes: 4,
  // jade (Semuc Champey), magenta neón, oro (cacao), lila nocturno
  laneColors: ['#3FE0D0', '#FF3D9A', '#FFC93C', '#B98CFF'],

  // Entrada
  keys: ['KeyD', 'KeyF', 'KeyJ', 'KeyK'],     // teclado de respaldo
  holdToActivate: 1.5,                        // segundos manteniendo carriles para accesos ocultos
  serial: {
    baudRate: 115200,     // debe coincidir con BAUD del firmware serial
    autoConnect: true,    // reconecta solo al puerto autorizado la última vez
    key: 'KeyS',          // tecla que abre el selector de puerto
  },

  // Ventanas de acierto (segundos, ± respecto a la nota)
  windows: { perfect: 0.06, good: 0.11 },
  holdReleaseGrace: 0.15,   // margen para soltar una nota sostenida antes de tiempo

  difficulties: {
    facil:   { label: 'Fácil',   lookahead: 2.0 },
    normal:  { label: 'Normal',  lookahead: 1.6 },
    dificil: { label: 'Difícil', lookahead: 1.25 },
  },
  difficultyOrder: ['facil', 'normal', 'dificil'],

  // Partida
  allowFail: true,                       // false = nadie pierde por energía
  energy: { start: 60, max: 100, hit: 2, miss: -7 },
  scores: { perfect: 300, good: 120, holdPerSecond: 240 },
  comboStep: 10,                         // cada N aciertos sube el multiplicador
  maxMultiplier: 4,
  quetzalEvery: 25,                      // el quetzal cruza cada N de combo
  countdown: 3,                          // segundos antes de que arranque la música

  // Flujo de feria
  idleTimeout: 30,      // s sin actividad en menús -> vuelve a la pantalla de atracción
  resultsTimeout: 15,
  highscoresTimeout: 12,

  musicVolume: 0.9,
  sfxVolume: 0.35,

  songsIndex: 'songs/index.json',
  font: '"BalamPixel", "Press Start 2P", "Courier New", monospace',
};

// Alias divertidos para elegir sin teclado
export const ALIASES = [
  'Jaguar Neón', 'Quetzal Veloz', 'Kakaw Master', 'Ceiba Rítmica', 'Monja Blanca',
  'Semuc Splash', 'Chipi-Chipi', 'Balam Rayo', 'Tun Tun', 'Caracol Láser',
  'Cardamomo Turbo', 'Pozas Jade', 'Neblina Cobán', 'Serpiente Pluma', 'Marimba Max',
  'Cueva Lanquín', 'Sol Pixel', 'Guacamaya Pro', 'Glifo Dorado', 'Tapir Sónico',
];

// Palabras en q'eqchi' usadas en pantalla.
// Valídalas con hablantes o docentes de la región antes del evento.
export const QEQCHI = {
  thanks: 'Bantiox',
};
