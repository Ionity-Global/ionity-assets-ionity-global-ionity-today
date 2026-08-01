#pragma once

// Over-the-air firmware updates for the ESP32-S3.
//  - Pull updates from the Nobify server (/api/firmware/manifest -> HTTP Update)
//  - Optional ArduinoOTA for local push flashing over WiFi
namespace Ota {
  void begin();          // start ArduinoOTA once WiFi is up
  void loop();           // service ArduinoOTA + periodic HTTP update checks
  bool checkNow();       // force one HTTP update check; true if an update started
  const char* version(); // compiled firmware version (NB_FW_VERSION)
}
