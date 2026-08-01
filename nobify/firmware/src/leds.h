#pragma once
#include <Arduino.h>

// Status LEDs that mirror the dashboard indicator:
//   BLUE   = WiFi CSI detected a person
//   ORANGE = 24GHz mmWave detected a person
namespace Leds {
  void begin();
  // Call every loop with the latest per-sensor presence state.
  void update(bool wifiPresent, bool mmwavePresent);
  // Brief boot animation / self-test.
  void selfTest();
}
