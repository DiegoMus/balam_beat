/*
  ============================================================
   BALAM BEAT — Controlador SERIAL de 4 barreras láser
  ============================================================
   Alternativa al controlador MIDI. Envía mensajes de texto por el
   puerto serie (USB) y el juego los lee con la Web Serial API.

   Ventaja: funciona con CUALQUIER placa con puerto USB-serie:
   ESP32 clásico, ESP32-S3, ESP32-C3, Arduino Uno/Nano/Mega...

   PROTOCOLO (texto, una línea por evento, 115200 baudios, 8N1)
     ESP -> juego
       D1..D4   mano DENTRO del haz del carril 1..4   (Down)
       U1..U4   mano FUERA del haz del carril 1..4    (Up)
       BALAM,<versión>,<carriles>   identificación (al arrancar y al recibir '?')
       #...     comentarios / depuración (el juego los ignora)
     juego -> ESP
       ?        pide identificación + estado actual de los carriles

   Ejemplo de lo que verías en el Monitor Serie al pasar la mano por
   el carril 2:   D2   (y al retirarla)   U2

   CONFIGURACIÓN DEL IDE
   - ESP32-S3 por su puerto USB nativo:
       Herramientas > USB CDC On Boot -> "Enabled"
   - ESP32 clásico / Arduino: no requiere nada especial.
  ============================================================
*/

#include <Arduino.h>

// ----------------------- CONFIGURACIÓN -----------------------
const uint8_t NUM_LANES = 4;

#if defined(ARDUINO_ARCH_ESP32)
const uint8_t SENSOR_PINS[NUM_LANES] = {4, 5, 6, 7};      // en ESP32 clásico usa p. ej. {32, 33, 25, 26}
const int8_t  LED_PINS[NUM_LANES]    = {15, 16, 17, 18};  // -1 = sin LED
#else  // Arduino Uno / Nano / Mega / Leonardo
const uint8_t SENSOR_PINS[NUM_LANES] = {2, 3, 4, 5};
const int8_t  LED_PINS[NUM_LANES]    = {6, 7, 8, 9};
#endif

const uint32_t BAUD = 115200;               // debe coincidir con el juego (config.js)
const int  BEAM_BROKEN_LEVEL = HIGH;        // cambia a LOW si los carriles funcionan al revés
const bool USE_PULLUP        = true;
const uint32_t LOCKOUT_US    = 12000;       // antirrebote por bloqueo (12 ms)
const char* FW_VERSION       = "1.0";
// -------------------------------------------------------------

struct Lane { bool broken; uint32_t lastEdgeUs; };
Lane lanes[NUM_LANES];

bool readBroken(uint8_t i) { return digitalRead(SENSOR_PINS[i]) == BEAM_BROKEN_LEVEL; }
void setLed(uint8_t i, bool on) { if (LED_PINS[i] >= 0) digitalWrite(LED_PINS[i], on ? HIGH : LOW); }

// Envía "D3\n" o "U3\n" en una sola escritura (menos latencia por USB)
void sendEvent(bool down, uint8_t lane) {
  char msg[4] = { down ? 'D' : 'U', (char)('1' + lane), '\n', 0 };
  Serial.write((const uint8_t*)msg, 3);
}

void sendHello() {
  Serial.print("BALAM,"); Serial.print(FW_VERSION); Serial.print(','); Serial.println(NUM_LANES);
  for (uint8_t i = 0; i < NUM_LANES; i++) if (lanes[i].broken) sendEvent(true, i);
}

void checkAlignment() {
  for (uint8_t i = 0; i < NUM_LANES; i++) {
    if (!readBroken(i)) continue;
    Serial.print("# Aviso: carril "); Serial.print(i + 1);
    Serial.println(" con el haz cortado al iniciar (¿láser desalineado?)");
    for (uint8_t k = 0; k < 3; k++) { setLed(i, true); delay(120); setLed(i, false); delay(120); }
  }
}

void setup() {
  Serial.begin(BAUD);
  for (uint8_t i = 0; i < NUM_LANES; i++) {
    pinMode(SENSOR_PINS[i], USE_PULLUP ? INPUT_PULLUP : INPUT);
    if (LED_PINS[i] >= 0) { pinMode(LED_PINS[i], OUTPUT); setLed(i, false); }
  }
  delay(300);
  checkAlignment();
  uint32_t now = micros();
  for (uint8_t i = 0; i < NUM_LANES; i++) {
    lanes[i].broken = readBroken(i);
    lanes[i].lastEdgeUs = now;
    setLed(i, lanes[i].broken);
  }
  sendHello();
}

void loop() {
  // Comandos del juego
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '?') sendHello();
  }

  uint32_t now = micros();
  for (uint8_t i = 0; i < NUM_LANES; i++) {
    bool raw = readBroken(i);
    if (raw == lanes[i].broken) continue;
    if ((uint32_t)(now - lanes[i].lastEdgeUs) < LOCKOUT_US) continue;
    lanes[i].broken = raw;
    lanes[i].lastEdgeUs = now;
    setLed(i, raw);
    sendEvent(raw, i);
  }
}
