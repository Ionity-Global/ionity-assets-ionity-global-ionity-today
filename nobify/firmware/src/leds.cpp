#include "leds.h"
#include "nobify_config.h"
#include <Adafruit_NeoPixel.h>

namespace {
#if NB_LED_NEOPIXEL
  // Two addressable pixels on the WiFi LED data pin: [0]=WiFi(blue) [1]=mmWave(orange).
  Adafruit_NeoPixel strip(2, NB_LED_WIFI_GPIO, NEO_GRB + NEO_KHZ800);

  uint32_t scaled(uint32_t rgb) {
    uint8_t r = (rgb >> 16) & 0xFF, g = (rgb >> 8) & 0xFF, b = rgb & 0xFF;
    float k = NB_LED_BRIGHTNESS / 255.0f;
    return strip.Color(r * k, g * k, b * k);
  }
#endif

  bool lastWifi = false, lastMm = false, inited = false;
}

void Leds::begin() {
#if NB_LED_NEOPIXEL
  strip.begin();
  strip.clear();
  strip.show();
#else
  pinMode(NB_LED_WIFI_GPIO, OUTPUT);
  pinMode(NB_LED_MMWAVE_GPIO, OUTPUT);
  digitalWrite(NB_LED_WIFI_GPIO, LOW);
  digitalWrite(NB_LED_MMWAVE_GPIO, LOW);
#endif
  inited = true;
}

void Leds::update(bool wifiPresent, bool mmwavePresent) {
  if (!inited) return;
  if (wifiPresent == lastWifi && mmwavePresent == lastMm) return; // no change
  lastWifi = wifiPresent; lastMm = mmwavePresent;
#if NB_LED_NEOPIXEL
  strip.setPixelColor(0, wifiPresent ? scaled(NB_LED_WIFI_COLOR) : 0);
  strip.setPixelColor(1, mmwavePresent ? scaled(NB_LED_MMWAVE_COLOR) : 0);
  strip.show();
#else
  digitalWrite(NB_LED_WIFI_GPIO, wifiPresent ? HIGH : LOW);
  digitalWrite(NB_LED_MMWAVE_GPIO, mmwavePresent ? HIGH : LOW);
#endif
}

void Leds::selfTest() {
#if NB_LED_NEOPIXEL
  strip.setPixelColor(0, scaled(NB_LED_WIFI_COLOR));
  strip.setPixelColor(1, scaled(NB_LED_MMWAVE_COLOR));
  strip.show();
  delay(500);
  strip.clear();
  strip.show();
#else
  digitalWrite(NB_LED_WIFI_GPIO, HIGH); digitalWrite(NB_LED_MMWAVE_GPIO, HIGH);
  delay(400);
  digitalWrite(NB_LED_WIFI_GPIO, LOW); digitalWrite(NB_LED_MMWAVE_GPIO, LOW);
#endif
}
