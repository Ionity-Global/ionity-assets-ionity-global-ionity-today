#pragma once
#include "nobify_types.h"

// WiFi connectivity + JSON upload to the hosted Nobify server.
namespace Net {
  void begin();                 // connect to WiFi (non-blocking retries)
  void loop();                  // maintain connection
  bool connected();
  int  rssi();
  const char* ip();

  // Upload the current fused state. `mm` carries mmWave data (may be invalid).
  // Sends one event per active source so the server can drive both LEDs.
  bool postState(const Reading& mm, bool mmPresent, bool wifiPresent, float lux);
  // Lightweight keepalive so the dashboard shows the device as online.
  bool heartbeat(float lux);
}
