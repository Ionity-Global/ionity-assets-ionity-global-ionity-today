#include "wifi_csi.h"
#include "nobify_config.h"

#if NB_CSI_ENABLED
#include "esp_wifi.h"

namespace {
  constexpr int WIN = NB_CSI_WINDOW;
  volatile float gSignatures[WIN];
  volatile int   gCount = 0;
  volatile int   gHead = 0;
  volatile float gVar = 0.0f;
  volatile uint32_t gLastPacket = 0;

  // CSI receive callback: compute a per-packet amplitude signature and push it
  // into a ring buffer, then update the windowed variance (motion indicator).
  void IRAM_ATTR onCsi(void* ctx, wifi_csi_info_t* info) {
    if (!info || !info->buf || info->len < 8) return;
    const int8_t* d = info->buf;
    int pairs = info->len / 2;
    float sum = 0.0f;
    for (int i = 0; i < pairs; i++) {
      float im = d[i * 2];
      float re = d[i * 2 + 1];
      sum += sqrtf(im * im + re * re);
    }
    float sig = sum / pairs;

    gSignatures[gHead] = sig;
    gHead = (gHead + 1) % WIN;
    if (gCount < WIN) gCount++;
    gLastPacket = millis();

    // Variance of the signature window.
    float mean = 0.0f;
    for (int i = 0; i < gCount; i++) mean += gSignatures[i];
    mean /= gCount;
    float var = 0.0f;
    for (int i = 0; i < gCount; i++) { float dd = gSignatures[i] - mean; var += dd * dd; }
    gVar = (gCount > 1) ? var / gCount : 0.0f;
  }
}

void WifiCsi::begin() {
  wifi_csi_config_t cfg = {};
  cfg.lltf_en = true;
  cfg.htltf_en = true;
  cfg.stbc_htltf2_en = true;
  cfg.ltf_merge_en = true;
  cfg.channel_filter_en = true;
  cfg.manu_scale = false;
  esp_wifi_set_csi_config(&cfg);
  esp_wifi_set_csi_rx_cb(&onCsi, nullptr);
  esp_wifi_set_csi(true);
}

bool WifiCsi::present() {
  // Stale data (no recent packets) => cannot assert presence.
  if (millis() - gLastPacket > 4000) return false;
  return gVar >= NB_CSI_VAR_THRESH;
}

float WifiCsi::variance() { return gVar; }

#else  // CSI disabled

void WifiCsi::begin() {}
bool WifiCsi::present() { return false; }
float WifiCsi::variance() { return 0.0f; }

#endif
