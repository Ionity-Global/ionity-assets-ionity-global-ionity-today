#include "display.h"
#include "nobify_config.h"

#if NB_DISPLAY_ENABLED
#include <TFT_eSPI.h>

namespace {
  TFT_eSPI tft;
  // Colors (RGB565)
  const uint16_t C_BG    = 0x0841;   // near-black navy
  const uint16_t C_TXT   = 0xE73C;   // light
  const uint16_t C_MUTED = 0x8410;
  const uint16_t C_WIFI  = 0x1C9F;   // blue
  const uint16_t C_MM    = 0xFC60;   // orange
  const uint16_t C_OK    = 0x2E6C;   // green
  const uint16_t C_WARN  = 0xFDE0;

  // cache to avoid needless redraws
  int8_t cMm = -1, cWifi = -1, cNet = -1, cDark = -1;
  int cDist = -999;
  Direction cDir = Direction::Unknown;

  void header() {
    tft.fillRect(0, 0, NB_DISPLAY_WIDTH, 30, C_BG);
    tft.setTextColor(C_TXT, C_BG);
    tft.setTextDatum(TL_DATUM);
    tft.drawString("NOBIFY", 8, 7, 4);
    tft.setTextColor(C_MUTED, C_BG);
    tft.drawString("presence", NB_DISPLAY_WIDTH - 78, 12, 2);
  }
}

void Display::begin() {
  tft.init();
  tft.setRotation(NB_DISPLAY_ROTATION);
  tft.fillScreen(C_BG);
  header();
}

void Display::banner(const char* l1, const char* l2) {
  tft.fillRect(0, 40, NB_DISPLAY_WIDTH, NB_DISPLAY_HEIGHT - 40, C_BG);
  tft.setTextColor(C_TXT, C_BG);
  tft.setTextDatum(MC_DATUM);
  tft.drawString(l1, NB_DISPLAY_WIDTH / 2, NB_DISPLAY_HEIGHT / 2 - 12, 4);
  tft.setTextColor(C_MUTED, C_BG);
  tft.drawString(l2, NB_DISPLAY_WIDTH / 2, NB_DISPLAY_HEIGHT / 2 + 16, 2);
}

void Display::render(bool mmPresent, bool wifiPresent, const Reading& mm,
                     float lux, bool netUp, int rssi, const char* ip, bool calibrating) {
  if (calibrating) { banner("Calibrating", "learning background..."); cMm = cWifi = -1; return; }

  bool present = mmPresent || wifiPresent;
  int dist = isnan(mm.distanceCm) ? -1 : (int)round(mm.distanceCm);
  int8_t dark = isnan(lux) ? -1 : (lux <= NB_DARK_LUX ? 1 : 0);

  bool changed = (cMm != mmPresent) || (cWifi != wifiPresent) || (cDist != dist) ||
                 (cDir != mm.direction) || (cNet != (int8_t)netUp) || (cDark != dark);
  if (!changed) return;
  cMm = mmPresent; cWifi = wifiPresent; cDist = dist; cDir = mm.direction;
  cNet = netUp; cDark = dark;

  // Big presence state
  tft.fillRect(0, 40, NB_DISPLAY_WIDTH, 60, C_BG);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(present ? (mmPresent ? C_MM : C_WIFI) : C_MUTED, C_BG);
  tft.drawString(present ? "PRESENT" : "CLEAR", NB_DISPLAY_WIDTH / 2, 68, 4);

  // Two LED chips
  int y = 108;
  tft.fillRoundRect(8, y, (NB_DISPLAY_WIDTH - 24) / 2, 34, 6, wifiPresent ? C_WIFI : C_BG);
  tft.drawRoundRect(8, y, (NB_DISPLAY_WIDTH - 24) / 2, 34, 6, C_WIFI);
  tft.setTextColor(wifiPresent ? C_BG : C_WIFI, wifiPresent ? C_WIFI : C_BG);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("WiFi", 8 + (NB_DISPLAY_WIDTH - 24) / 4, y + 17, 2);

  int x2 = 8 + (NB_DISPLAY_WIDTH - 24) / 2 + 8;
  tft.fillRoundRect(x2, y, (NB_DISPLAY_WIDTH - 24) / 2, 34, 6, mmPresent ? C_MM : C_BG);
  tft.drawRoundRect(x2, y, (NB_DISPLAY_WIDTH - 24) / 2, 34, 6, C_MM);
  tft.setTextColor(mmPresent ? C_BG : C_MM, mmPresent ? C_MM : C_BG);
  tft.drawString("mmWave", x2 + (NB_DISPLAY_WIDTH - 24) / 4, y + 17, 2);

  // Readout lines
  tft.fillRect(0, 152, NB_DISPLAY_WIDTH, NB_DISPLAY_HEIGHT - 178, C_BG);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(C_TXT, C_BG);
  char line[48];
  snprintf(line, sizeof(line), "Distance: %s", dist < 0 ? "--" : (String(dist) + " cm").c_str());
  tft.drawString(line, 10, 158, 2);
  const char* dir = directionStr(mm.direction);
  snprintf(line, sizeof(line), "Move: %s%s", (dir && *dir) ? dir : "--",
           (!isnan(mm.speedCms) && *dir) ? (" " + String((int)fabs(mm.speedCms)) + "cm/s").c_str() : "");
  tft.drawString(line, 10, 180, 2);
  snprintf(line, sizeof(line), "Light: %s %s", isnan(lux) ? "--" : String((int)round(lux)).c_str(),
           dark == 1 ? "(dark)" : dark == 0 ? "(bright)" : "");
  tft.setTextColor(dark == 1 ? C_WIFI : C_WARN, C_BG);
  tft.drawString(line, 10, 202, 2);

  // Footer: connectivity
  tft.fillRect(0, NB_DISPLAY_HEIGHT - 22, NB_DISPLAY_WIDTH, 22, C_BG);
  tft.setTextColor(netUp ? C_OK : C_WARN, C_BG);
  snprintf(line, sizeof(line), "%s  %s  %ddBm", netUp ? "online" : "offline", netUp ? ip : "", rssi);
  tft.drawString(line, 10, NB_DISPLAY_HEIGHT - 18, 2);
}

#else  // display disabled

void Display::begin() {}
void Display::render(bool, bool, const Reading&, float, bool, int, const char*, bool) {}
void Display::banner(const char*, const char*) {}

#endif
