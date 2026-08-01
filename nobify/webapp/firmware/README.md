# Browser-flasher firmware (same-origin)

`nobify-factory.bin` is the merged ESP32-S3 factory image served **from this
Pages site** so the in-browser flasher (ESP Web Tools, see `../manifest-esp.json`)
can `fetch()` it without a cross-origin/CORS failure.

GitHub Release download URLs (`github.com/.../releases/latest/download/...`) do
**not** send an `Access-Control-Allow-Origin` header, so fetching them from the
dashboard origin fails with "Failed to fetch". Hosting the bin here (same origin
as `install.html`) avoids that entirely.

## Refreshing it after a new firmware build

```powershell
# from a release asset
Invoke-WebRequest `
  https://github.com/Ionity-Global/ionity-assets-ionity-global-ionity-today/releases/latest/download/nobify-factory.bin `
  -OutFile nobify-factory.bin

# or from a local merge-bin build (nobify/firmware/.pio/build/esp32-s3-n16r8/)
```

Then bump `version` in `../manifest-esp.json`, commit, and let the Pages workflow
redeploy.
