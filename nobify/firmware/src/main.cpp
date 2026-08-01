// ============================================================================
//  Nobify — ESP32-S3 dual-sensor human presence node
//  24GHz mmWave radar (ORANGE LED) + WiFi CSI (BLUE LED) -> hosted server
//
//  Configure nobify.config.yaml, then:  cd ../server && npm run gen:firmware
// ============================================================================
#include <Arduino.h>
#include "nobify_config.h"
#include "nobify_types.h"
#include "leds.h"
#include "display.h"
#include "mmwave.h"
#include "wifi_csi.h"
#include "net.h"

static constexpr uint32_t LOCAL_HOLD_MS = 3000;   // LED/display presence hold

static Reading  lastMm;
static uint32_t lastMmPresentMs = 0;
static bool     csiStarted = false;

static bool     prevMmPresent = false, prevWifiPresent = false;
static uint32_t lastPostMs = 0, lastHeartbeatMs = 0;

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n[nobify] booting " NB_DEVICE_ID);

  Leds::begin();
  Leds::selfTest();
  Display::begin();
  Display::banner("Starting", NB_DEVICE_NAME);

  Mmwave::begin();
  Net::begin();
}

void loop() {
  Net::loop();

  // Start CSI once WiFi is up (needs the driver running).
  if (!csiStarted && Net::connected()) {
    WifiCsi::begin();
    csiStarted = true;
    Serial.println("[nobify] WiFi CSI presence started");
  }

  // ---- mmWave ----
  Reading mm = Mmwave::update();
  if (mm.valid) lastMm = mm;
  float lux = Mmwave::lastLux();

  if (mm.valid && mm.present) lastMmPresentMs = millis();
  bool mmPresent = (millis() - lastMmPresentMs) <= LOCAL_HOLD_MS && lastMmPresentMs != 0;

  // ---- WiFi CSI ----
  bool wifiPresent = csiStarted ? WifiCsi::present() : false;

  // ---- Local indicators ----
  Leds::update(wifiPresent, mmPresent);
  Display::render(mmPresent, wifiPresent, lastMm, lux,
                  Net::connected(), Net::rssi(), Net::ip(), Mmwave::calibrating());

  // ---- Upload to server ----
  uint32_t nowMs = millis();
  bool changed = (mmPresent != prevMmPresent) || (wifiPresent != prevWifiPresent);
  bool present = mmPresent || wifiPresent;

  if (Net::connected() && !Mmwave::calibrating()) {
    if (changed && (nowMs - lastPostMs) >= 250) {
      Net::postState(lastMm, mmPresent, wifiPresent, lux);
      lastPostMs = nowMs; lastHeartbeatMs = nowMs;
      prevMmPresent = mmPresent; prevWifiPresent = wifiPresent;
    } else if (present && (nowMs - lastPostMs) >= NB_POST_INTERVAL_MS) {
      // Keep streaming distance/movement while someone is present.
      Net::postState(lastMm, mmPresent, wifiPresent, lux);
      lastPostMs = nowMs; lastHeartbeatMs = nowMs;
    } else if (!present && (nowMs - lastHeartbeatMs) >= NB_HEARTBEAT_MS) {
      Net::heartbeat(lux);
      lastHeartbeatMs = nowMs;
    }
  }

  delay(30);
}
