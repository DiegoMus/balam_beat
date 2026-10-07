# Agregar canciones a Balam Beat

Cada canción es una carpeta dentro de `web/songs/` con dos archivos:

```
web/songs/coban/
├── audio.ogg     (o .mp3)
└── chart.json
```

Luego agrega el nombre de la carpeta a `web/songs/index.json`:

```json
["coban", "luna-de-xelaju"]
```

## Crear el chart desde MIDI (recomendado)

1. Haz el arreglo en MuseScore o LMMS.
2. Exporta el audio (`audio.ogg`) y el MIDI (`cancion.mid`) **desde el mismo proyecto**, para que coincidan.
3. Convierte:

```bash
node tools/midi2chart.mjs cancion.mid --title "Cobán" --artist "Arreglo 5to Bachillerato" \
     --audio audio.ogg --out web/songs/coban/chart.json
```

La herramienta toma la pista con más notas como melodía y genera los 3 niveles:

- **Difícil:** todas las notas (máximo 2 a la vez).
- **Normal:** notas en los tiempos del compás.
- **Fácil:** notas cada 2 tiempos.

Las notas que duran 1 tiempo o más se vuelven notas sostenidas.

Si quieres controlar cada nivel a mano, crea en el MIDI tres pistas llamadas `facil`, `normal` y `dificil`, y la herramienta las usará tal cual.

## Formato de chart.json

```json
{
  "title": "Cobán",
  "artist": "Arreglo 5to Bachillerato",
  "bpm": 120,
  "audio": "audio.ogg",
  "offset": 0,
  "charts": {
    "facil":   [[2.0, 0, 0], [3.0, 2, 1.0]],
    "normal":  [],
    "dificil": []
  }
}
```

Cada nota es `[segundo, carril (0-3), duración en segundos (0 = nota simple)]`.
Si las notas se sienten adelantadas o atrasadas respecto al audio, ajusta `offset` (en segundos).

> Recuerda: usa música original, tradicional o con permiso de sus autores.
