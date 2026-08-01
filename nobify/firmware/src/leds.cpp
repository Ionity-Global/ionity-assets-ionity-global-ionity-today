#include "leds.h"
#include "nobify_config.h"
#include <Adafruit_NeoPixel.h>
#include <math.h>

// Onboard RGB status LED behaviour:
//   RED    (breathing) = error / offline (device can't reach the server)
//   ORANGE (breathing) = all in order, nobody present
//   ORANGE (solid)     = 24GHz mmWave detected a person (priority)
//   BLUE   (solid)     = WiFi CSI detected a person
//
// Generic ESP32-S3 boards place their onboard addressable RGB LED on different
// GPIOs (commonly 48 on DevKitC-1 clones, 47 on some). To "just work" without
// the user telling us which, we drive BOTH configured data pins with the same
// colour, each a 2-pixel strip (covers a single onboard LED and a small
// external strip). A wrong pin simply does nothing.

namespace {
  constexpr uint32_t C_RED = 0xFF0000;

#if NB_LED_NEOPIXEL
  Adafruit_NeoPixel stripA(2, NB_LED_WIFI_GPIO,   NEO_GRB + NEO_KHZ800);
  Adafruit_NeoPixel stripB(2, NB_LED_MMWAVE_GPIO, NEO_GRB + NEO_KHZ800);

  // Paint both strips with an RGB colour scaled by factor k (0..1).
  void paintScaled(uint32_t rgb, float k) {
    uint8_t r = ((rgb >> 16) & 0xFF) * k;
    uint8_t g = ((rgb >> 8)  & 0xFF) * k;
    uint8_t b = ( rgb        & 0xFF) * k;
    uint32_t c = stripA.Color(r, g, b);
    stripA.setPixelColor(0, c); stripA.setPixelColor(1, c); stripA.show();
    stripB.setPixelColor(0, c); stripB.setPixelColor(1, c); stripB.show();
  }
#endif

  bool     healthy = true;
  bool     wifiPresent = false, mmPresent = false;
  bool     inited = false;
  uint32_t lastRenderMs = 0;
}

void Leds::begin() {
#if NB_LED_NEOPIXEL
  stripA.begin(); stripB.begin();
  stripA.clear(); stripA.show();
  stripB.clear(); stripB.show();
#else
  pinMode(NB_LED_WIFI_GPIO, OUTPUT);
  pinMode(NB_LED_MMWAVE_GPIO, OUTPUT);
  digitalWrite(NB_LED_WIFI_GPIO, LOW);
  digitalWrite(NB_LED_MMWAVE_GPIO, LOW);
#endif
  inited = true;
}

void Leds::update(bool wifi, bool mmwave) {
  wifiPresent = wifi;
  mmPresent   = mmwave;
}

void Leds::setHealthy(bool ok) {
  healthy = ok;
}

void Leds::tick() {
  if (!inited) return;
#if NB_LED_NEOPIXEL
  if (millis() - lastRenderMs < 30) return;   // ~33 fps animation
  lastRenderMs = millis();

  const float bright = NB_LED_BRIGHTNESS / 255.0f;
  uint32_t color;
  float k;

  if (mmPresent) {              // person via radar -> solid orange
    color = NB_LED_MMWAVE_COLOR; k = bright;
  } else if (wifiPresent) {     // person via WiFi CSI -> solid blue
    color = NB_LED_WIFI_COLOR;   k = bright;
  } else {                      // idle: breathe orange (ok) or red (error)
    color = healthy ? NB_LED_MMWAVE_COLOR : C_RED;
    const uint32_t period = healthy ? 2800 : 900;      // error breathes faster
    float t = (millis() % period) / (float)period;
    float s = 0.5f * (1.0f - cosf(t * 2.0f * (float)M_PI));  // smooth 0..1
    k = bright * (0.10f + 0.90f * s);
  }
  paintScaled(color, k);
#else
  digitalWrite(NB_LED_WIFI_GPIO, wifiPresent ? HIGH : LOW);
  digitalWrite(NB_LED_MMWAVE_GPIO, (mmPresent || !healthy) ? HIGH : LOW);
#endif
}

void Leds::selfTest() {
#if NB_LED_NEOPIXEL
  // Bright, unmistakable boot sequence so the user can confirm the LED works:
  // red, green, blue, orange, off.
  const uint32_t seq[] = { 0xFF0000, 0x00FF00, 0x0000FF, NB_LED_MMWAVE_COLOR };
  for (uint32_t c : seq) { paintScaled(c, 0.25f); delay(220); }
  paintScaled(0, 0);
#else
  digitalWrite(NB_LED_WIFI_GPIO, HIGH); digitalWrite(NB_LED_MMWAVE_GPIO, HIGH);
  delay(400);
  digitalWrite(NB_LED_WIFI_GPIO, LOW); digitalWrite(NB_LED_MMWAVE_GPIO, LOW);
#endif
}
