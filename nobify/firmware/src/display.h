#pragma once
#include "nobify_types.h"

// On-board TFT status screen (optional). Shows live presence, distance,
// movement, ambient light and connectivity. No-op when disabled in YAML.
namespace Display {
  void begin();
  void render(bool mmPresent, bool wifiPresent, const Reading& mm,
              float lux, bool netUp, int rssi, const char* ip, bool calibrating);
  void banner(const char* line1, const char* line2);
}
