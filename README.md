# Balam Beat

Juego de ritmo estilo *Guitar Hero* que se toca **pasando la mano por 4 barreras láser**.
Estética synthwave neón con identidad maya y verapacense: pirámide escalonada, glifos,
quetzal, monja blanca, ceibas, chipi-chipi y numeración maya.

```
balam-beat/
├── firmware/balam_beat_serial/       Sketch para cualquier ESP32/Arduino: 4 láseres → puerto serial
├── docs/PROTOCOLO_SERIAL.md          Qué envía la ESP32 por serial y cómo lo lee el juego
├── web/                              El juego (Canvas + Web Audio + Web Serial, sin librerías)
│   ├── js/config.js                  Ajustes del evento: ventanas de acierto, energía, colores, alias…
│   └── songs/                        Tus canciones (audio + chart.json), ver songs/LEEME.md
├── tools/
│   ├── midi2chart.mjs                Convierte un MIDI en chart.json
│   ├── build-single.mjs              Empaqueta todo en dist/balam-beat.html
│   └── test.mjs                      Pruebas
└── dist/balam-beat.html              Versión en un solo archivo (doble clic y a jugar)
```

## 1. Probar sin hardware

Abre `dist/balam-beat.html` en Chrome o Chromium. Juega con **D F J K** o tocando la pantalla.
Trae 3 canciones originales generadas por código (sin problemas de derechos).

> Ramas: **`serial`** = controlador por puerto serial (esta versión) ·
> **`main`** = controlador USB MIDI, publicada en GitHub Pages.

## 2. Controlador serial (cualquier placa)

1. Sube `firmware/balam_beat_serial` (ESP32 clásico, ESP32-S3, C3, Arduino Uno/Nano…).
   En ESP32-S3 por USB nativo: **Herramientas → USB CDC On Boot → Enabled**.
2. Abre el juego por `http://localhost` en Chrome/Edge (no con doble clic).
3. Presiona **S**, elige el puerto de la placa y listo. Las siguientes veces se conecta solo.

La placa envía una línea de texto por evento: `D1`…`D4` al entrar la mano al haz y
`U1`…`U4` al salir, a 115200 baudios. Detalles en `docs/PROTOCOLO_SERIAL.md`.

> ¿Prefieres USB MIDI? Está en la rama **`main`**.

## 3. Montaje en la Raspberry Pi (o laptop)

```bash
# en la carpeta del proyecto
python3 -m http.server 8000 --directory web
# en otra terminal (modo kiosco)
chromium-browser --kiosk --autoplay-policy=no-user-gesture-required http://localhost:8000
```

- `--autoplay-policy=no-user-gesture-required` es **importante**: sin él, el navegador
  no deja sonar el audio hasta que alguien toque el teclado o el mouse (un láser no cuenta).
- Usa el servidor (no doble clic) para que carguen tus canciones de `web/songs/` y para que
  Web Serial funcione.
- Con el controlador serial en la Raspberry: `sudo usermod -aG dialout $USER`, conecta un teclado
  la primera vez para presionar **S** y elegir el puerto; después se reconecta solo.
- Para usarlo sin internet, descarga la fuente *Press Start 2P* (Google Fonts, licencia OFL)
  como `web/fonts/PressStart2P-Regular.ttf`.
- **P** pone pantalla completa si no usas modo kiosco.

## 4. Cómo se juega

| Pantalla | Carril 1 | Carril 2 | Carril 3 | Carril 4 |
|---|---|---|---|---|
| Atracción | cualquiera inicia | | | |
| Alias | anterior | siguiente | al azar | listo |
| Canción | anterior | siguiente | dificultad | ¡jugar! |
| Resultados / récords | | | | continuar |

- **Perfecto** ±60 ms, **Bien** ±110 ms. Presionar al aire no castiga.
- Cada 10 aciertos seguidos sube el multiplicador (hasta x4). Cada 25, cruza el quetzal.
- Las **serpientes emplumadas** son notas sostenidas: deja la mano dentro del haz.
- Si se acaba la energía se pierde (desactívalo con `allowFail: false` en `config.js`).
- Sin tocar nada por 30 s, los menús vuelven a la pantalla de atracción.

## 5. Calibración (encargado)

En la pantalla de atracción, **mantén los carriles 1 y 4** por 1.5 s (o tecla **C**).

- Ves en vivo cada sensor y cuántos toques registra: ideal para alinear láseres.
- **Mantén el carril 3** (o **T**): suenan 4 clics de aviso y 8 de prueba; pasa la mano al
  ritmo y el juego calcula la latencia del proyector/bocinas automáticamente.
- Carriles 1 / 2 (o ← →) ajustan ±5 ms a mano. Sal manteniendo carriles 1 y 4 (o Esc).

## 6. Agregar canciones

Ver `web/songs/LEEME.md`. En resumen:

```bash
node tools/midi2chart.mjs coban.mid --title "Cobán" --audio audio.ogg --out web/songs/coban/chart.json
```

y agregar `"coban"` a `web/songs/index.json`.

## Desarrollo

```bash
npm install        # solo esbuild, para empaquetar
npm test           # pruebas de charts y del lector MIDI
npm run build      # genera dist/balam-beat.html
```

Ideas para la versión 2: editor de charts tocando los láseres, modo versus, ranking en red
desde la Raspberry y textos en q'eqchi' validados con la comunidad.
