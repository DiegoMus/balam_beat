# Protocolo serial de Balam Beat

Cómo viajan las señales de las barreras láser desde la ESP32 hasta el juego en el navegador.

```
 Láser ──► Receptor ──► GPIO ──► ESP32 ──USB──► Puerto serie ──► Chrome (Web Serial API) ──► Juego
                                 "D2\n"         COM3 / ttyACM0      navigator.serial
```

## Parámetros del puerto

| Parámetro | Valor |
|---|---|
| Velocidad | **115200 baudios** (`BAUD` en el firmware, `serial.baudRate` en `web/js/config.js`) |
| Formato | 8 bits, sin paridad, 1 bit de parada (8N1) |
| Codificación | Texto ASCII, una línea por mensaje, terminada en `\n` (se acepta `\r\n`) |

## Mensajes de la ESP32 al juego

| Mensaje | Significado |
|---|---|
| `D1` … `D4` | La mano **entró** al haz del carril 1 a 4 (*Down*) |
| `U1` … `U4` | La mano **salió** del haz del carril 1 a 4 (*Up*) |
| `BALAM,1.0,4` | Identificación: versión del firmware y número de carriles |
| `# texto` | Comentario o depuración; el juego lo ignora |

Cualquier otra línea se ignora, así que puedes imprimir mensajes de prueba sin romper el juego
(lo más limpio es empezarlos con `#`).

## Mensajes del juego a la ESP32

| Mensaje | Respuesta de la ESP32 |
|---|---|
| `?` | Envía `BALAM,<versión>,<carriles>` y un `D` por cada carril que ya tenga el haz cortado |

El juego manda `?` justo al abrir el puerto, así queda sincronizado aunque alguien tenga la mano
en un láser en ese momento.

## Ejemplo de una partida

Lo que verías en el Monitor Serie del IDE:

```
BALAM,1.0,4
D1        ← mano entra al carril 1
U1        ← mano sale del carril 1
D3        ← entra al carril 3 (nota sostenida)
U3        ← sale del carril 3
```

## Cómo lo lee el juego

1. **Abrir el puerto** (`web/js/input.js` → `connectSerial`): `navigator.serial.requestPort()` muestra el
   selector del navegador y `port.open({ baudRate: 115200 })` lo abre. El navegador exige que esto lo
   dispare una persona: en el juego, la tecla **S**.
2. **Leer** (`_readSerial`): un bucle lee bloques de bytes del `ReadableStream` del puerto, los convierte a
   texto y los acumula; `parseSerialLines` (`web/js/serial-protocol.js`) separa las líneas completas y
   guarda el pedazo incompleto para la siguiente lectura.
3. **Convertir en jugadas**: cada `D`/`U` se vuelve una pulsación o liberación del carril, igual que
   una tecla D F J K o una nota MIDI. La marca de tiempo es el instante en que llegaron los bytes.
4. **Reconexión**: el navegador recuerda el puerto autorizado. Al recargar la página, o al
   desconectar y reconectar la ESP32, el juego vuelve a abrirlo solo, sin diálogo.

## Requisitos

- **Chrome, Edge o Chromium** de escritorio (Firefox y Safari no tienen Web Serial).
- La página debe servirse por **https** o desde **localhost** (`python3 -m http.server`).
  Abrirla con doble clic (`file://`) no permite usar el puerto serie.
- Solo un programa puede usar el puerto a la vez: **cierra el Monitor Serie del IDE** antes de jugar.
  Si está ocupado, la calibración muestra `Serial: ocupado`.
- En Linux / Raspberry Pi, el usuario debe pertenecer al grupo `dialout`:
  `sudo usermod -aG dialout $USER` (y volver a iniciar sesión).

## Latencia

- **ESP32-S3 por su USB nativo** (USB CDC): prácticamente inmediata (~1 ms).
- **ESP32 clásico o Arduino con chip CH340 / CP2102**: unos pocos milisegundos.
- Chips **FTDI** agrupan datos hasta 16 ms por defecto; si notas retraso, baja su *latency timer*
  o usa la calibración de latencia del juego (mantener carril 3).

## ¿MIDI o serial?

Ambas versiones conviven: el juego acepta las dos a la vez.

| | USB MIDI (`firmware/balam_beat_controller`) | Serial (`firmware/balam_beat_serial`) |
|---|---|---|
| Placas | ESP32-S3, Leonardo/Micro | Cualquiera (ESP32, S3, C3, Uno, Nano…) |
| Conexión en el juego | Automática | Tecla **S** la primera vez, luego automática |
| Depuración | Herramientas MIDI | Monitor Serie del IDE (texto legible) |
| Navegadores | Chrome, Edge, Firefox | Chrome, Edge |
