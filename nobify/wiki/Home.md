# Nobify Wiki

**Nobify** is a full-stack, human-only presence detection system built around an
**ESP32-S3** with a **24 GHz mmWave radar** and **WiFi CSI**. It streams
detections to a self-hosted server, shows them on a live dashboard, and pops
desktop notifications — with movement, ambient-light (day/night) and clutter
suppression baked in.

- 🔵 **BLUE LED** — WiFi CSI detected a person
- 🟠 **ORANGE LED** — 24 GHz mmWave detected a person

## Start here

| Page | What's inside |
| --- | --- |
| [[Architecture]] | How the pieces fit together (data flow) |
| [[Hardware and Wiring]] | ESP32-S3 + radar pinout |
| [[Installation]] | Get server, dashboard, companion & firmware running |
| [[Configuration YAML]] | Every YAML knob for server + firmware + companion |
| [[Server and API]] | REST + WebSocket + AI endpoints |
| [[Firmware and OTA]] | Sensors, LEDs, and over-the-air updates |
| [[Desktop Companion]] | System-tray notifications + snooze |
| [[CI and Releases]] | Pipelines that test, build & publish |
| [[Troubleshooting]] | Common issues & fixes |

## The three (four) parts

1. **Server** (`nobify/server`) — Node, zero native deps (`node:sqlite` + `ws`).
2. **Dashboard** (`nobify/webapp`) — static, GitHub Pages friendly.
3. **Companion** (`nobify/companion`) — desktop tray notifier.
4. **Firmware** (`nobify/firmware`) — PlatformIO ESP32-S3 sketch.

> Everything is namespaced under `nobify/` and adds nothing to the host repo's
> existing assets.
