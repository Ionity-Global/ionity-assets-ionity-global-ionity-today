# Nobify desktop companion — Windows installer
# Downloads the latest signed-off companion binary from GitHub Releases,
# installs it to %LOCALAPPDATA%\Nobify, and registers it to run at login.
#
#   irm https://<owner>.github.io/<repo>/install.ps1 | iex
#
# Optional: set the server URL first, e.g.
#   $env:NOBIFY_SERVER="https://my-server"; irm .../install.ps1 | iex
#
# (c) Ionity Global (Pty) Ltd — https://www.ionity.co.za

$ErrorActionPreference = 'Stop'
$Repo   = 'Ionity-Global/ionity-assets-ionity-global-ionity-today'
$Asset  = 'nobify-companion-win.exe'
$Server = $env:NOBIFY_SERVER

$dir = Join-Path $env:LOCALAPPDATA 'Nobify'
$exe = Join-Path $dir 'nobify.exe'
$url = "https://github.com/$Repo/releases/latest/download/$Asset"

Write-Host ""
Write-Host "  Nobify companion installer" -ForegroundColor Cyan
Write-Host "  ==========================" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $dir | Out-Null

Write-Host "  Downloading $Asset ..."
try {
  Invoke-WebRequest -Uri $url -OutFile $exe -UseBasicParsing
} catch {
  Write-Host "  Download failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "  No release asset yet? See $url" -ForegroundColor Yellow
  return
}
Write-Host "  Installed to $exe" -ForegroundColor Green

# Run-at-login via a Startup-folder shortcut.
$startup  = [Environment]::GetFolderPath('Startup')
$lnkPath  = Join-Path $startup 'Nobify.lnk'
$wsh      = New-Object -ComObject WScript.Shell
$lnk      = $wsh.CreateShortcut($lnkPath)
$lnk.TargetPath = $exe
if ($Server) { $lnk.Arguments = "--server `"$Server`"" }
$lnk.WorkingDirectory = $dir
$lnk.IconLocation = $exe
$lnk.Description = 'Nobify presence-detection companion'
$lnk.Save()
Write-Host "  Registered to start at login." -ForegroundColor Green

Write-Host ""
if ($Server) {
  Write-Host "  Launching (server: $Server) ..."
  Start-Process -FilePath $exe -ArgumentList @('--server', $Server) -WorkingDirectory $dir
} else {
  Write-Host "  Launch now with your server URL:" -ForegroundColor Cyan
  Write-Host "    & `"$exe`" --server https://your-server"
  Start-Process -FilePath $exe -WorkingDirectory $dir
}
Write-Host "  Done. Look for the Nobify icon in your system tray." -ForegroundColor Green
Write-Host ""
