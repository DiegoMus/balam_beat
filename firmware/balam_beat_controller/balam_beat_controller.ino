/*
  ============================================================
   BALAM BEAT — Controlador de 4 barreras láser
  ============================================================
   Cada barrera (láser + receptor) es un carril del juego.
   Al cortar el haz con la mano  -> MIDI Note On
   Al retirar la mano            -> MIDI Note Off

   La computadora (Raspberry Pi o laptop) reconoce la placa como
   un instrumento MIDI USB, sin drivers. El juego lo lee con la
   Web MIDI API del navegador.

   PLACAS SOPORTADAS
   - ESP32-S3 (recomendada). En Arduino IDE:
       Herramientas > USB Mode          -> "USB-OTG (TinyUSB)"
       Herramientas > USB CDC On Boot   -> "Enabled" (solo si quieres depurar por Serial)
   - Arduino Leonardo / Micro / Pro Micro (ATmega32u4):
       instala la librería "MIDIUSB" desde el Gestor de librerías.
   (Un Arduino Uno NO sirve: no tiene USB nativo.)

   CABLEADO (por carril)
   - Módulo láser:   VCC -> 3V3 (o 5V según el módulo), GND -> GND
   - Receptor:       VCC -> 3V3, GND -> GND, OUT -> pin de SENSOR_PINS
     ¡El ESP32-S3 solo tolera 3.3 V en sus entradas! Si el receptor
     funciona solo a 5 V, usa un divisor resistivo (p. ej. 10k/20k).
   - En el ESP32-S3 NO uses los GPIO 19 y 20 (son el USB).
  ============================================================
*/

#include <Arduino.h>

// ----------------------- CONFIGURACIÓN -----------------------
const uint8_t NUM_LANES = 4;

#if defined(ARDUINO_ARCH_ESP32)
const uint8_t SENSOR_PINS[NUM_LANES] = {4, 5, 6, 7};      // salidas de los receptores
const int8_t  LED_PINS[NUM_LANES]    = {15, 16, 17, 18};  // LED indicador por carril (-1 = sin LED)
#else  // Leonardo / Micro
const uint8_t SENSOR_PINS[NUM_LANES] = {2, 3, 4, 5};
const int8_t  LED_PINS[NUM_LANES]    = {6, 7, 8, 9};
#endif

// Notas MIDI que envía cada carril (el juego espera 60, 61, 62, 63)
const uint8_t MIDI_NOTES[NUM_LANES] = {60, 61, 62, 63};
const uint8_t MIDI_CHANNEL = 1;     // 1..16
const uint8_t VELOCITY     = 100;

// Nivel que entrega el receptor cuando el haz está CORTADO.
// La mayoría de receptores láser dan LOW con luz y HIGH sin luz.
// Si tus carriles funcionan "al revés", cambia a LOW.
const int  BEAM_BROKEN_LEVEL = HIGH;
const bool USE_PULLUP        = true;   // pull-up interno en la entrada

// Antirrebote por bloqueo: el primer cambio se envía AL INSTANTE
// (cero latencia) y se ignoran cambios durante este tiempo.
const uint32_t LOCKOUT_US = 12000;     // 12 ms

const bool SERIAL_DEBUG = false;       // true = imprime eventos por Serial
// -------------------------------------------------------------


// ======================= Salida MIDI =========================
#if defined(ARDUINO_ARCH_ESP32)
  #if ARDUINO_USB_MODE
    #error "Selecciona Herramientas > USB Mode > 'USB-OTG (TinyUSB)' para usar USB MIDI."
  #endif
  #include "USB.h"
  #include "USBMIDI.h"
  USBMIDI MIDI;

  void midiBegin() {
    MIDI.begin();
    USB.productName("Balam Beat");
    USB.begin();
  }
  void midiNoteOn(uint8_t note)  { MIDI.noteOn(note, VELOCITY, MIDI_CHANNEL); }
  void midiNoteOff(uint8_t note) { MIDI.noteOff(note, 0, MIDI_CHANNEL); }

#elif defined(ARDUINO_ARCH_AVR)
  #include <MIDIUSB.h>
  void midiBegin() {}
  void midiNoteOn(uint8_t note) {
    midiEventPacket_t p = {0x09, (uint8_t)(0x90 | (MIDI_CHANNEL - 1)), note, VELOCITY};
    MidiUSB.sendMIDI(p);
    MidiUSB.flush();
  }
  void midiNoteOff(uint8_t note) {
    midiEventPacket_t p = {0x08, (uint8_t)(0x80 | (MIDI_CHANNEL - 1)), note, 0};
    MidiUSB.sendMIDI(p);
    MidiUSB.flush();
  }
#else
  #error "Placa no soportada: usa ESP32-S3 o Arduino Leonardo/Micro."
#endif


// ======================== Carriles ===========================
struct Lane {
  bool     broken;      // estado enviado (true = mano dentro del haz)
  uint32_t lastEdgeUs;  // momento del último cambio enviado
};
Lane lanes[NUM_LANES];

bool readBroken(uint8_t i) {
  return digitalRead(SENSOR_PINS[i]) == BEAM_BROKEN_LEVEL;
}

void setLed(uint8_t i, bool on) {
  if (LED_PINS[i] >= 0) digitalWrite(LED_PINS[i], on ? HIGH : LOW);
}

// Al arrancar, si algún haz ya está cortado probablemente el láser
// está desalineado: el LED de ese carril parpadea 3 veces.
void checkAlignment() {
  for (uint8_t i = 0; i < NUM_LANES; i++) {
    if (readBroken(i)) {
      for (uint8_t k = 0; k < 3; k++) {
        setLed(i, true);  delay(120);
        setLed(i, false); delay(120);
      }
      if (SERIAL_DEBUG) {
        Serial.print("Aviso: el carril "); Serial.print(i + 1);
        Serial.println(" parece desalineado (haz cortado al iniciar).");
      }
    }
  }
}

void setup() {
  if (SERIAL_DEBUG) Serial.begin(115200);

  for (uint8_t i = 0; i < NUM_LANES; i++) {
    pinMode(SENSOR_PINS[i], USE_PULLUP ? INPUT_PULLUP : INPUT);
    if (LED_PINS[i] >= 0) { pinMode(LED_PINS[i], OUTPUT); setLed(i, false); }
  }

  midiBegin();
  delay(300);
  checkAlignment();

  uint32_t now = micros();
  for (uint8_t i = 0; i < NUM_LANES; i++) {
    lanes[i].broken = readBroken(i);
    lanes[i].lastEdgeUs = now;
    setLed(i, lanes[i].broken);
  }
}

void loop() {
  uint32_t now = micros();

  for (uint8_t i = 0; i < NUM_LANES; i++) {
    bool raw = readBroken(i);
    if (raw == lanes[i].broken) continue;
    if ((uint32_t)(now - lanes[i].lastEdgeUs) < LOCKOUT_US) continue;

    lanes[i].broken = raw;
    lanes[i].lastEdgeUs = now;
    setLed(i, raw);

    if (raw) midiNoteOn(MIDI_NOTES[i]);
    else     midiNoteOff(MIDI_NOTES[i]);

    if (SERIAL_DEBUG) {
      Serial.print("Carril "); Serial.print(i + 1);
      Serial.println(raw ? " ON" : " OFF");
    }
  }
}
