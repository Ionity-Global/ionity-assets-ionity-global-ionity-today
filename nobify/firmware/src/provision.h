#pragma once
#include <Arduino.h>

// Runtime provisioning for a web-flashed device.
//
// A factory image published to a public GitHub Release can't carry anyone's
// WiFi secrets, so credentials are supplied *after* flashing:
//   1. Improv-Wi-Fi over the USB serial link — the browser (ESP Web Tools)
//      asks for the SSID/password and hands them to the device.
//   2. A tiny on-device web page (http://<device-ip>/) to point the sensor at
//      your Nobify server.
// Everything is persisted in NVS, so it survives reboots and OTA updates.
// Compiled-in nobify.config.yaml values are used only as fallback defaults.
namespace Provision {
  void begin();                 // load NVS creds, bring up WiFi + Improv
  void loop();                  // service Improv serial + config web server
  bool connected();

  const char* ssid();
  const char* password();
  const char* serverUrl();      // device -> server ingest base URL
  bool configured();            // real (non-placeholder) WiFi credentials present
}
