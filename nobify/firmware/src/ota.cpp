#include "ota.h"
#include "nobify_config.h"
#include "provision.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <ArduinoJson.h>
#if NB_OTA_ARDUINO
#include <ArduinoOTA.h>
#endif

namespace {
  uint32_t lastCheck = 0;
  bool arduinoStarted = false;

  void startArduinoOta() {
  #if NB_OTA_ARDUINO
    if (arduinoStarted) return;
    ArduinoOTA.setHostname(NB_WIFI_HOSTNAME);
    if (strlen(NB_OTA_ARDUINO_PASS) > 0) ArduinoOTA.setPassword(NB_OTA_ARDUINO_PASS);
    ArduinoOTA.onStart([]() { Serial.println("[ota] local update starting"); });
    ArduinoOTA.onEnd([]()   { Serial.println("[ota] local update complete"); });
    ArduinoOTA.onError([](ota_error_t e) { Serial.printf("[ota] local error %u\n", e); });
    ArduinoOTA.begin();
    arduinoStarted = true;
    Serial.println("[ota] ArduinoOTA ready (local push)");
  #endif
  }
}

void Ota::begin() {
  if (WiFi.status() == WL_CONNECTED) startArduinoOta();
}

const char* Ota::version() { return NB_FW_VERSION; }

bool Ota::checkNow() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(Provision::serverUrl()) + "/api/firmware/manifest?current=" + NB_FW_VERSION;
  if (!http.begin(url)) return false;
  http.setTimeout(6000);
  int code = http.GET();
  if (code != 200) { Serial.printf("[ota] manifest HTTP %d\n", code); http.end(); return false; }
  String payload = http.getString();
  http.end();

  JsonDocument doc;
  if (deserializeJson(doc, payload)) { Serial.println("[ota] bad manifest json"); return false; }
  if (!doc["available"].as<bool>() || !doc["updateAvailable"].as<bool>()) {
    Serial.printf("[ota] up to date (%s)\n", NB_FW_VERSION);
    return false;
  }

  String binUrl = doc["url"].as<String>();
  const char* newVer = doc["version"].as<const char*>();
  if (binUrl.length() == 0) return false;
  Serial.printf("[ota] updating %s -> %s\n", NB_FW_VERSION, newVer ? newVer : "?");

  // The server sends an x-MD5 header which HTTPUpdate uses to verify the image.
  WiFiClient client;
  httpUpdate.rebootOnUpdate(true);
  httpUpdate.setLedPin(-1, LOW);
  t_httpUpdate_return ret = httpUpdate.update(client, binUrl, NB_FW_VERSION);
  switch (ret) {
    case HTTP_UPDATE_FAILED:
      Serial.printf("[ota] failed (%d): %s\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
      return false;
    case HTTP_UPDATE_NO_UPDATES:
      Serial.println("[ota] server reports no update");
      return false;
    case HTTP_UPDATE_OK:
      Serial.println("[ota] update OK — rebooting");
      return true;  // device reboots into the new image
  }
  return false;
}

void Ota::loop() {
#if NB_OTA_ARDUINO
  if (!arduinoStarted && WiFi.status() == WL_CONNECTED) startArduinoOta();
  if (arduinoStarted) ArduinoOTA.handle();
#endif

#if NB_OTA_ENABLED
  const uint32_t iv = NB_OTA_CHECK_MS;
  if (iv == 0) return;                 // 0 = disable periodic polling (boot/manual only)
  if (millis() < 15000) return;        // let sensors settle before the first check
  if (lastCheck != 0 && (millis() - lastCheck) < iv) return;
  lastCheck = millis();
  checkNow();
#endif
}
