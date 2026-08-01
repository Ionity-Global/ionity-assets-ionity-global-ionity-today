#pragma once
#include <Arduino.h>

// WiFi CSI (Channel State Information) presence heuristic running on the
// ESP32-S3 itself. Human motion perturbs the WiFi channel; when the amplitude
// variance across recent packets exceeds a threshold we report presence.
// This drives the BLUE status LED.
namespace WifiCsi {
  void begin();          // call AFTER WiFi is connected
  bool present();        // current CSI-based presence estimate
  float variance();      // latest amplitude variance (diagnostics)
}
