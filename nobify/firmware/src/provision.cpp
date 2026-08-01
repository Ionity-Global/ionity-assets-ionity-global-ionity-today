#include "provision.h"
#include "nobify_config.h"
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ImprovWiFiLibrary.h>

// Provisioning: Improv-WiFi (browser sets the network over USB serial) plus a
// small on-device web page to set the server URL. Credentials live in NVS.
namespace {
  Preferences prefs;
  ImprovWiFi improv(&Serial);
  WebServer web(80);

  String gSsid, gPass, gUrl;
  bool   webStarted = false;
  uint32_t lastRetry = 0;

  const char* PLACEHOLDER_SSID = "YOUR_WIFI_SSID";

  void save(const char* key, const String& val) {
    prefs.begin("nobify", false);
    prefs.putString(key, val);
    prefs.end();
  }

  void beginWifi() {
    WiFi.persistent(false);
    WiFi.mode(WIFI_STA);
    WiFi.setHostname(NB_WIFI_HOSTNAME);
    if (gSsid.length()) WiFi.begin(gSsid.c_str(), gPass.c_str());
  }

  // Improv custom connect: persist creds, (re)connect, report success so the
  // browser can show the device URL.
  bool improvConnect(const char* ssid, const char* password) {
    gSsid = ssid; gPass = password;
    save("ssid", gSsid);
    save("pass", gPass);
    Serial.printf("[provision] Improv set SSID \"%s\"\n", gSsid.c_str());
    WiFi.disconnect();
    beginWifi();
    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) delay(200);
    return WiFi.status() == WL_CONNECTED;
  }

  String page() {
    String ip = WiFi.localIP().toString();
    String h;
    h += F("<!doctype html><html><head><meta charset=utf-8>"
           "<meta name=viewport content='width=device-width,initial-scale=1'>"
           "<title>Nobify sensor</title><style>"
           "body{font-family:system-ui,Segoe UI,Arial;background:#0a0e1a;color:#e6edff;margin:0;padding:24px}"
           ".c{max-width:460px;margin:0 auto;background:#111a2e;border:1px solid #22314f;border-radius:14px;padding:22px}"
           "h1{font-size:1.3rem;margin:0 0 4px}.m{color:#8aa0c8;font-size:.9rem}"
           "label{display:block;margin:14px 0 4px;font-size:.85rem;color:#b9c8ea}"
           "input{width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #2a3a5f;background:#0a1120;color:#cfe1ff}"
           "button{margin-top:16px;width:100%;padding:11px;border:0;border-radius:8px;background:#1e90ff;color:#04120d;font-weight:700;font-size:1rem}"
           ".ok{color:#39d98a}</style></head><body><div class=c>");
    h += F("<h1>Nobify sensor</h1><p class=m>Device ");
    h += NB_DEVICE_ID;
    h += F(" · ");
    h += ip;
    h += F("</p><form method=POST action=/save>"
           "<label>Server URL (where detections are sent)</label>"
           "<input name=url value='");
    h += gUrl;
    h += F("' placeholder='https://your-server'>"
           "<button type=submit>Save</button></form>"
           "<p class=m style='margin-top:16px'>WiFi is set from your browser during flashing (Improv). "
           "Ionity Global (Pty) Ltd · www.ionity.co.za</p></div></body></html>");
    return h;
  }

  void startWeb() {
    web.on("/", HTTP_GET, [] { web.send(200, "text/html", page()); });
    web.on("/save", HTTP_POST, [] {
      if (web.hasArg("url")) {
        gUrl = web.arg("url");
        save("url", gUrl);
        Serial.printf("[provision] server URL set to %s\n", gUrl.c_str());
      }
      web.sendHeader("Location", "/");
      web.send(303, "text/plain", "saved");
    });
    web.begin();
    webStarted = true;
    Serial.printf("[provision] config page at http://%s/\n", WiFi.localIP().toString().c_str());
  }
}

void Provision::begin() {
  prefs.begin("nobify", true);
  gSsid = prefs.getString("ssid", "");
  gPass = prefs.getString("pass", "");
  gUrl  = prefs.getString("url", "");
  prefs.end();

  if (!gSsid.length()) { gSsid = NB_WIFI_SSID; gPass = NB_WIFI_PASSWORD; }
  if (!gUrl.length())  { gUrl  = NB_SERVER_URL; }

  improv.setDeviceInfo(ImprovTypes::ChipFamily::CF_ESP32_S3, "Nobify",
                       NB_FW_VERSION, NB_DEVICE_NAME, "http://{LOCAL_IPV4}/");
  improv.setCustomConnectWiFi(improvConnect);

  beginWifi();
  Serial.printf("[provision] boot ssid=\"%s\" configured=%d\n",
                gSsid.c_str(), (int)Provision::configured());
}

void Provision::loop() {
  improv.handleSerial();

  if (WiFi.status() == WL_CONNECTED) {
    if (!webStarted) startWeb();
    web.handleClient();
  } else if (configured() && millis() - lastRetry > 5000) {
    lastRetry = millis();
    WiFi.disconnect();
    beginWifi();
  }
}

bool Provision::connected()    { return WiFi.status() == WL_CONNECTED; }
const char* Provision::ssid()      { return gSsid.c_str(); }
const char* Provision::password()  { return gPass.c_str(); }
const char* Provision::serverUrl() { return gUrl.c_str(); }
bool Provision::configured()   { return gSsid.length() && gSsid != PLACEHOLDER_SSID; }
