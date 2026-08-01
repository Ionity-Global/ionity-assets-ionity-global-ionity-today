#pragma once
#include <Arduino.h>

// Status LEDs that mirror the dashboard indicator:
//   BLUE   = WiFi CSI detected a person
//   ORANGE = 24GHz mmWave detected a person
namespace Leds {
  void begin();
  // Call every loop with the latest per-sensor presence state.
  void update(bool wifiPresent, bool mmwavePresent);
  // Health/status baseline for the onboard RGB:
  //   ok == true  -> ORANGE ("all in order") when no one is present
  //   ok == false -> RED    (error: offline / sensor fault)
  void setHealthy(bool ok);
  // Drive the breathing/pulse animation. Call every loop().
  void tick();
  // Brief boot animation / self-test.
  void selfTest();
}
