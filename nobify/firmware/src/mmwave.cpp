#include "mmwave.h"
#include "nobify_config.h"

// LD2410 report frame:  F4 F3 F2 F1 | len(2) | 0x02 0xAA | state | movDist(2)
//   movEnergy | statDist(2) | statEnergy | detDist(2) | 0x55 0x00 | F8 F7 F6 F5
// state: 0 none, 1 moving, 2 static, 3 moving+static.
namespace {
  HardwareSerial radar(1);

  uint8_t buf[64];
  size_t  idx = 0;

  // Interference filtering / clutter suppression state.
  uint32_t bootMs = 0;
  bool     calib = true;
  uint8_t  bgEnergy = 0;         // background energy learned when empty

  // Movement tracking.
  float    prevDist = NAN;
  uint32_t prevDistMs = 0;

  // Debounce so a single noisy frame (pet/airflow) can't trigger presence.
  uint8_t  presentStreak = 0;
  uint8_t  absentStreak = 0;
  bool     stablePresent = false;

  float    luxValue = NAN;

  inline uint16_t le16(const uint8_t* p) { return (uint16_t)p[0] | ((uint16_t)p[1] << 8); }

  float readLux() {
#if NB_LIGHT_ENABLED
    // LDR/photodiode on an ADC pin mapped to the sensor's 0..50 lux range.
    // (If your radar reports lux over UART, populate luxValue there instead.)
    int raw = analogRead(NB_LUX_ADC_GPIO);            // 0..4095
    float lux = (raw / 4095.0f) * 50.0f;
    return constrain(lux, 0.0f, 50.0f);
#else
    return NAN;
#endif
  }

  // Decode one validated LD2410 target frame body (starting at data type byte).
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

    // ---- Interference filtering ----
    bool rawPresent = (state != 0) && dist > 0;
    // Range gating.
    if (dist < NB_MMWAVE_MIN_CM || dist > NB_MMWAVE_MAX_CM) rawPresent = false;
#if NB_CLUTTER_SUPPRESS
    // Reject weak returns near the learned background (airflow / plants / pets).
    uint8_t floorEng = bgEnergy + NB_MICRO_MOTION_THRESH;
    if (eng < floorEng) rawPresent = false;
    // A purely static, low-energy target is treated as clutter.
    if (!moving && stat && statEng < floorEng) rawPresent = false;
#endif

    // ---- Debounce (persistence) ----
    if (rawPresent) { if (presentStreak < 10) presentStreak++; absentStreak = 0; }
    else            { if (absentStreak < 10) absentStreak++; presentStreak = 0; }
    if (presentStreak >= 2) stablePresent = true;
    if (absentStreak >= 3)  stablePresent = false;

    r.present    = stablePresent;
    r.distanceCm = rawPresent ? dist : NAN;
    r.confidence = eng / 100.0f;
    r.lux        = luxValue;
    r.valid      = true;

    // ---- Movement: speed + direction from distance derivative ----
    uint32_t nowMs = millis();
    if (r.present && !isnan((float)dist)) {
      if (!isnan(prevDist) && nowMs > prevDistMs) {
        float dt = (nowMs - prevDistMs) / 1000.0f;
        if (dt > 0.05f) {
          float v = (dist - prevDist) / dt;             // cm/s, signed
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
  calib = NB_CLUTTER_SUPPRESS;   // only calibrate if suppression enabled
  bgEnergy = 0;
}

bool Mmwave::calibrating() { return calib; }
float Mmwave::lastLux() { return luxValue; }

Reading Mmwave::update() {
  Reading out;
  luxValue = readLux();

  // Feed the byte stream into a simple framer.
  while (radar.available()) {
    uint8_t b = radar.read();
    if (idx == 0 && b != 0xF4) continue;             // wait for header start
    if (idx < sizeof(buf)) buf[idx++] = b;

    // Full frame ends with tail F8 F7 F6 F5.
    if (idx >= 8 && buf[idx - 4] == 0xF8 && buf[idx - 3] == 0xF7 &&
        buf[idx - 2] == 0xF6 && buf[idx - 1] == 0xF5) {
      // Header(4) + len(2) + body + tail(4). Body starts at buf[6].
      if (idx > 10) {
        Reading r;
        if (decode(&buf[6], idx - 10, r)) {
          // During calibration, learn the empty-room background energy.
          if (calib) {
            uint8_t eng = (uint8_t)round((isnan(r.confidence) ? 0 : r.confidence) * 100.0f);
            if (eng > bgEnergy) bgEnergy = eng;
            if (millis() - bootMs >= NB_BG_CALIB_MS) calib = false;
            r.present = false;                          // suppress during calib
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
