#pragma once
#include "nobify_types.h"

// 24GHz mmWave human-presence radar driver (LD2410-style UART frames).
// Adds: movement (speed + approaching/leaving), ambient light (0..50 lux),
// and interference filtering (background calibration + clutter suppression to
// ignore airflow, pets and swaying plants).
namespace Mmwave {
  void begin();
  // Parse any pending UART bytes and refresh internal state.
  // Returns a Reading; `valid` is true only when a fresh radar frame arrived.
  Reading update();
  bool calibrating();      // true while sampling the empty-room background
  float lastLux();
}
