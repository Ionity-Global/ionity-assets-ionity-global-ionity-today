# Firmware binaries for OTA live here (git-ignored).
#
# CI/release drops files like `nobify-fw-1.2.3.bin` plus a `manifest.json`:
#   { "version": "1.2.3", "bin": "nobify-fw-1.2.3.bin", "notes": "…",
#     "mandatory": false, "ts": 1700000000000 }
#
# If no manifest.json is present, the server serves the newest *.bin and parses
# the version from its filename. Devices poll GET /api/firmware/manifest?current=<ver>.
