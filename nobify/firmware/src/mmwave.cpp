#include "mmwave.h"
#include "nobify_config.h"
#include "esp32-hal-log.h"

// 24GHz mmWave human-presence radar.
//   Default hardware: DFRobot C4001 (SEN0609/SEN0610) over UART (radar.begin()).
//   Legacy fallback : LD2410-style F4F3F2F1 frame parser (NB_MMWAVE_DRIVER_C4001 == 0).
// Both paths produce a shared Reading with presence, target distance, movement
// (speed + approaching/leaving), ambient light and clutter-suppressed debounce.
static const char* TAG = "MMWAVE";

#if NB_MMWAVE_DRIVER_C4001
// ========================= DFRobot C4001 (default) =========================
#include "DFRobot_C4001.h"

namespace {
  // UART1: RX=GPIO16 (radar TX), TX=GPIO17 (radar RX). The library's ESP32
  // begin() forwards these pins to HardwareSerial::begin().
  DFRobot_C4001_UART radar(&Serial1, NB_MMWAVE_BAUD, NB_MMWAVE_UART_RX, NB_MMWAVE_UART_TX);
  bool sensorReady = false;

  float    luxValue = NAN;

  // Movement: direction from the range derivative (hardware-agnostic), speed
  // magnitude from the sensor's own velocity read.
  float    prevRangeCm = NAN;
  uint32_t prevRangeMs = 0;

  // Debounce so a single noisy frame (pet / airflow) can't trigger presence.
  uint8_t  presentStreak = 0;
  uint8_t  absentStreak  = 0;
  bool     stablePresent = false;

  // Brief settle window after boot, surfaced as the "calibrating" phase.
  uint32_t bootMs   = 0;
  bool     settling = true;

  float readLux() {
#if NB_LIGHT_ENABLED
    int raw = analogRead(NB_LUX_ADC_GPIO);            // 0..4095
    float lux = (raw / 4095.0f) * 50.0f;
    return constrain(lux, 0.0f, 50.0f);
#else
    return NAN;
#endif
  }

  void applySample(bool rawPresent, float rangeCm, float sensorSpeedCms,
                   float confidence, Reading& r) {
    // Range gating.
    if (rawPresent && (rangeCm < NB_MMWAVE_MIN_CM || rangeCm > NB_MMWAVE_MAX_CM))
      rawPresent = false;

    // Debounce (persistence).
    if (rawPresent) { if (presentStreak < 10) presentStreak++; absentStreak = 0; }
    else            { if (absentStreak  < 10) absentStreak++;  presentStreak = 0; }
    if (presentStreak >= 2) stablePresent = true;
    if (absentStreak  >= 3) stablePresent = false;

    r.present    = settling ? false : stablePresent;
    r.distanceCm = rawPresent ? rangeCm : NAN;
    r.confidence = confidence;
    r.lux        = luxValue;
    r.valid      = true;

#if NB_MOVEMENT_ENABLED
    uint32_t nowMs = millis();
    if (rawPresent && !isnan(rangeCm)) {
      if (!isnan(prevRangeCm) && nowMs > prevRangeMs) {
        float dt = (nowMs - prevRangeMs) / 1000.0f;
        if (dt > 0.05f) {
          float deriv = (rangeCm - prevRangeCm) / dt;         // cm/s, <0 = approaching
          float mag   = isnan(sensorSpeedCms) ? fabs(deriv) : fabs(sensorSpeedCms);
          if (mag < NB_APPROACH_SPEED_CMS) { r.direction = Direction::Stationary; r.speedCms = 0; }
          else if (deriv < 0)              { r.direction = Direction::Approaching; r.speedCms = -mag; }
          else                             { r.direction = Direction::Leaving;    r.speedCms =  mag; }
        }
      }
      prevRangeCm = rangeCm; prevRangeMs = nowMs;
    } else {
      prevRangeCm = NAN;
    }
#endif
  }
}

void Mmwave::begin() {
  bootMs   = millis();
  settling = true;

  // Force HD/OUT (GPIO18) LOW so the C4001 selects UART (not I2C) mode.
  if (NB_MMWAVE_OUT_GPIO >= 0) {
    pinMode(NB_MMWAVE_OUT_GPIO, OUTPUT);
    digitalWrite(NB_MMWAVE_OUT_GPIO, LOW);
  }
  delay(100);                                          // let the mode change register

#if NB_LIGHT_ENABLED
  analogReadResolution(12);
#endif

  // The C4001's own status light only lights AFTER begin() succeeds, so retry.
  for (int attempt = 1; attempt <= NB_MMWAVE_BEGIN_RETRY; ++attempt) {
    if (radar.begin()) { sensorReady = true; break; }
    ESP_LOGE(TAG, "C4001 begin() failed %d/%d (rx=%d tx=%d baud=%d)",
             attempt, NB_MMWAVE_BEGIN_RETRY, NB_MMWAVE_UART_RX, NB_MMWAVE_UART_TX, (int)NB_MMWAVE_BAUD);
    Serial.printf("[mmwave] C4001 begin() FAIL %d/%d\n", attempt, NB_MMWAVE_BEGIN_RETRY);
    delay(400);
  }

  if (sensorReady) {
    radar.setSensorMode(eSpeedMode);                   // target number + range + speed
    uint16_t minCm = NB_MMWAVE_MIN_CM < 30 ? 30 : (uint16_t)NB_MMWAVE_MIN_CM;
    uint16_t maxCm = NB_MMWAVE_MAX_CM < 240 ? 240
                   : (NB_MMWAVE_MAX_CM > 2000 ? 2000 : (uint16_t)NB_MMWAVE_MAX_CM);
    radar.setDetectionRange(minCm, maxCm, maxCm);
    radar.setSensor(eStartSen);                        // start collecting
    ESP_LOGI(TAG, "C4001 connected: speed mode, range %u..%u cm", minCm, maxCm);
    Serial.println("[mmwave] C4001 SUCCESS - sensor light blinks on detection");
  } else {
    ESP_LOGE(TAG, "C4001 not responding - sensor faulted (health LED -> RED)");
    Serial.println("[mmwave] C4001 FAIL - check TX->GPIO16, RX->GPIO17, HD/OUT->GPIO18 LOW, power");
  }
}

bool Mmwave::calibrating() {
  if (settling && millis() - bootMs >= NB_BG_CALIB_MS) settling = false;
  return settling;
}
bool  Mmwave::ready()   { return sensorReady; }
float Mmwave::lastLux() { return luxValue; }

Reading Mmwave::update() {
  Reading out;
  luxValue = readLux();
  out.lux  = luxValue;
  if (!sensorReady) { out.valid = false; return out; }

  Mmwave::calibrating();                               // advance the settle window

  uint8_t  targets = radar.getTargetNumber();          // refreshes range/speed/energy
  bool     rawPresent = targets > 0;
  float    rangeCm = rawPresent ? radar.getTargetRange() * 100.0f : NAN;
  float    spdCms  = rawPresent ? radar.getTargetSpeed() * 100.0f : NAN;
  uint32_t energy  = rawPresent ? radar.getTargetEnergy() : 0;

#if NB_CLUTTER_SUPPRESS
  // Reject weak returns near the noise floor (airflow / plants / pets).
  if (rawPresent && energy < (uint32_t)NB_MICRO_MOTION_THRESH) rawPresent = false;
#endif

  float conf = rawPresent ? constrain(energy / 100.0f, 0.0f, 1.0f) : NAN;
  applySample(rawPresent, rangeCm, spdCms, conf, out);

  ESP_LOGD(TAG, "targets=%u present=%d range=%.0fcm speed=%.0fcm/s energy=%u lux=%.1f",
           targets, out.present, rawPresent ? rangeCm : 0.0f,
           rawPresent ? spdCms : 0.0f, (unsigned)energy, luxValue);
  return out;
}

#else
// ========================= Legacy LD2410 parser =========================
// LD2410 report frame:  F4 F3 F2 F1 | len(2) | 0x02 0xAA | state | movDist(2)
//   movEnergy | statDist(2) | statEnergy | detDist(2) | 0x55 0x00 | F8 F7 F6 F5
// state: 0 none, 1 moving, 2 static, 3 moving+static.
namespace {
  HardwareSerial radar(1);

  uint8_t buf[64];
  size_t  idx = 0;

  uint32_t bootMs = 0;
  bool     calib = true;
  uint8_t  bgEnergy = 0;

  float    prevDist = NAN;
  uint32_t prevDistMs = 0;

  uint8_t  presentStreak = 0;
  uint8_t  absentStreak = 0;
  bool     stablePresent = false;

  float    luxValue = NAN;

  inline uint16_t le16(const uint8_t* p) { return (uint16_t)p[0] | ((uint16_t)p[1] << 8); }

  float readLux() {
#if NB_LIGHT_ENABLED
    int raw = analogRead(NB_LUX_ADC_GPIO);
    float lux = (raw / 4095.0f) * 50.0f;
    return constrain(lux, 0.0f, 50.0f);
#else
    return NAN;
#endif
  }

  bool decode(const uint8_t* d, size_t n, Reading& r) {
    if (n < 13 || d[0] != 0x02 || d[1] != 0xAA) return false;
    uint8_t  state    = d[2];
    uint16_t movDist  = le16(&d[3]);
    uint8_t  movEng   = d[5];
    uint16_t statDist = le16(&d[6]);
    uint8_t  statEng  = d[8];

    bool moving = (state & 0x01);
    bool stat   = (state & 0x02);

    uint16_t dist = moving ? movDist : (stat ? statDist : 0);
    uint8_t  eng  = moving ? movEng  : (stat ? statEng  : 0);

    bool rawPresent = (state != 0) && dist > 0;
    if (dist < NB_MMWAVE_MIN_CM || dist > NB_MMWAVE_MAX_CM) rawPresent = false;
#if NB_CLUTTER_SUPPRESS
    uint8_t floorEng = bgEnergy + NB_MICRO_MOTION_THRESH;
    if (eng < floorEng) rawPresent = false;
    if (!moving && stat && statEng < floorEng) rawPresent = false;
#endif

    if (rawPresent) { if (presentStreak < 10) presentStreak++; absentStreak = 0; }
    else            { if (absentStreak < 10) absentStreak++; presentStreak = 0; }
    if (presentStreak >= 2) stablePresent = true;
    if (absentStreak >= 3)  stablePresent = false;

    r.present    = stablePresent;
    r.distanceCm = rawPresent ? dist : NAN;
    r.confidence = eng / 100.0f;
    r.lux        = luxValue;
    r.valid      = true;

    uint32_t nowMs = millis();
    if (r.present && !isnan((float)dist)) {
      if (!isnan(prevDist) && nowMs > prevDistMs) {
        float dt = (nowMs - prevDistMs) / 1000.0f;
        if (dt > 0.05f) {
          float v = (dist - prevDist) / dt;
          r.speedCms = v;
          if (fabs(v) < NB_APPROACH_SPEED_CMS) r.direction = Direction::Stationary;
          else r.direction = (v < 0) ? Direction::Approaching : Direction::Leaving;
        }
      }
      prevDist = dist; prevDistMs = nowMs;
    } else {
      prevDist = NAN;
    }
    return true;
  }
}

void Mmwave::begin() {
  radar.begin(NB_MMWAVE_BAUD, SERIAL_8N1, NB_MMWAVE_UART_RX, NB_MMWAVE_UART_TX);
#if NB_LIGHT_ENABLED
  analogReadResolution(12);
#endif
  bootMs = millis();
  calib = NB_CLUTTER_SUPPRESS;
  bgEnergy = 0;
  ESP_LOGI(TAG, "LD2410 legacy parser started rx=%d tx=%d baud=%d",
           NB_MMWAVE_UART_RX, NB_MMWAVE_UART_TX, (int)NB_MMWAVE_BAUD);
}

bool  Mmwave::calibrating() { return calib; }
bool  Mmwave::ready()       { return true; }
float Mmwave::lastLux()     { return luxValue; }

Reading Mmwave::update() {
  Reading out;
  luxValue = readLux();

  while (radar.available()) {
    uint8_t b = radar.read();
    if (idx == 0 && b != 0xF4) continue;
    if (idx < sizeof(buf)) buf[idx++] = b;

    if (idx >= 8 && buf[idx - 4] == 0xF8 && buf[idx - 3] == 0xF7 &&
        buf[idx - 2] == 0xF6 && buf[idx - 1] == 0xF5) {
      if (idx > 10) {
        Reading r;
        if (decode(&buf[6], idx - 10, r)) {
          if (calib) {
            uint8_t eng = (uint8_t)round((isnan(r.confidence) ? 0 : r.confidence) * 100.0f);
            if (eng > bgEnergy) bgEnergy = eng;
            if (millis() - bootMs >= NB_BG_CALIB_MS) calib = false;
            r.present = false;
          }
          out = r;
        }
      }
      idx = 0;
    }
  }
  out.lux = luxValue;
  return out;
}

#endif  // NB_MMWAVE_DRIVER_C4001
