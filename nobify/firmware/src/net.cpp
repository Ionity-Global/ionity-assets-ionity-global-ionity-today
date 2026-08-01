#include "net.h"
#include "nobify_config.h"
#include "provision.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

namespace {
  bool wasConnected = false;

  bool postJson(const String& body) {
    if (WiFi.status() != WL_CONNECTED) return false;
    HTTPClient http;
    String url = String(Provision::serverUrl()) + NB_INGEST_PATH;
    if (!http.begin(url)) return false;
    http.setTimeout(4000);
    http.addHeader("Content-Type", "application/json");
    if (strlen(NB_INGEST_KEY) > 0) http.addHeader("x-ingest-key", NB_INGEST_KEY);
    int code = http.POST(body);
    http.end();
    if (code != 200) { Serial.printf("[net] POST %s -> %d\n", url.c_str(), code); }
    return code == 200;
  }

  void addCommon(JsonDocument& doc, float lux) {
    doc["device_id"] = NB_DEVICE_ID;
    doc["name"]      = NB_DEVICE_NAME;
    doc["firmware"]  = "nobify-fw/" NB_FW_VERSION;
    doc["rssi"]      = WiFi.RSSI();
    if (!isnan(lux)) doc["lux"] = lux;
  }
}

void Net::begin() {
  // WiFi is owned by Provision (Improv + NVS creds); nothing to do here beyond
  // logging the first successful association in loop().
  Serial.println("[net] ready (WiFi managed by provisioning)");
}

void Net::loop() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wasConnected) {
      wasConnected = true;
      Serial.printf("[net] connected, ip=%s rssi=%d server=%s\n",
                    WiFi.localIP().toString().c_str(), WiFi.RSSI(), Provision::serverUrl());
    }
    return;
  }
  wasConnected = false;
}

bool Net::connected() { return WiFi.status() == WL_CONNECTED; }
int  Net::rssi()      { return WiFi.RSSI(); }
const char* Net::ip() { static String s; s = WiFi.localIP().toString(); return s.c_str(); }

bool Net::postState(const Reading& mm, bool mmPresent, bool wifiPresent, float lux) {
  JsonDocument doc;
  addCommon(doc, lux);
  JsonArray events = doc["events"].to<JsonArray>();

  // mmWave event (ORANGE LED source).
  {
    JsonObject e = events.add<JsonObject>();
    e["source"]  = "mmwave";
    e["present"] = mmPresent;
    if (!isnan(mm.distanceCm)) e["distance_cm"] = mm.distanceCm;
    if (!isnan(mm.speedCms))   e["speed_cms"]   = mm.speedCms;
    if (mm.direction != Direction::Unknown) e["direction"] = directionStr(mm.direction);
    if (!isnan(mm.confidence)) e["confidence"] = mm.confidence;
    if (!isnan(lux))           e["lux"] = lux;
  }
  // WiFi CSI event (BLUE LED source).
  {
    JsonObject e = events.add<JsonObject>();
    e["source"]  = "wifi";
    e["present"] = wifiPresent;
    if (!isnan(lux)) e["lux"] = lux;
  }

  String body; serializeJson(doc, body);
  return postJson(body);
}

bool Net::heartbeat(float lux) {
  JsonDocument doc;
  addCommon(doc, lux);
  JsonArray events = doc["events"].to<JsonArray>();
  JsonObject e = events.add<JsonObject>();
  e["source"] = "mmwave";
  e["present"] = false;
  if (!isnan(lux)) e["lux"] = lux;
  String body; serializeJson(doc, body);
  return postJson(body);
}
