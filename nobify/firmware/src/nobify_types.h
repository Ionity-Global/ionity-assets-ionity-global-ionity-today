#pragma once
#include <Arduino.h>

// Shared presence reading produced by each sensor module.
enum class Direction : uint8_t { Unknown = 0, Approaching, Leaving, Stationary };

inline const char* directionStr(Direction d) {
  switch (d) {
    case Direction::Approaching: return "approaching";
    case Direction::Leaving:     return "leaving";
    case Direction::Stationary:  return "stationary";
    default:                     return "";
  }
}

struct Reading {
  bool      present   = false;
  float     distanceCm = NAN;   // target distance (mmWave)
  float     speedCms   = NAN;   // signed: negative = approaching
  Direction direction  = Direction::Unknown;
  float     lux        = NAN;   // ambient light 0..50
  float     confidence = NAN;   // 0..1
  bool      valid      = false; // did the sensor produce a fresh reading?
};
