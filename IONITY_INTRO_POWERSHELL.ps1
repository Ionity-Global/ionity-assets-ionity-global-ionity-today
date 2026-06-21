# IONITY LOADER v3.2 - "INTRO PS IONITY EDITION 2026/01/19 5:20AM GMT+2"
# Easy Windows LOAD PS 7 - No Admin Required. 
# Safe for VS Code/ISE.

try {
    # 1. CHECK ENVIRONMENT
    if ($Host.Name -like "*ISE*" -or $Host.Name -like "*Visual Studio Code*") {
        Write-Warning "Visual loader requires a standard PowerShell Console window."
        Write-Host "IONITY MASTER RUNNER v16.0" -ForegroundColor Cyan
        Start-Sleep -Seconds 2
        exit
    }

    # 2. SETUP & SAFETY CALCS
    $origBg = $Host.UI.RawUI.BackgroundColor
    $origFg = $Host.UI.RawUI.ForegroundColor
    [Console]::CursorVisible = $false
    
    # Get safe dimensions
    $width = [Console]::WindowWidth
    $height = [Console]::WindowHeight
    
    if ($width -lt 65 -or $height -lt 20) { throw "Window too small" }

    $center = [math]::Floor($width / 2)
    $yPos = [math]::Floor($height / 2) - 3

    # 3. PREP SCREEN
    [Console]::BackgroundColor = "Black"
    Clear-Host

    # 4. THE CHARGING BEAM
    $beamChars = @("·", "·", "-", "=", "≡", "▓", "█")
    $sleepTime = 60
    $freq = 1000 
    
    for ($i = 0; $i -lt ($center - 15); $i+=2) {
        try { [Console]::SetCursorPosition($i, $yPos) } catch { break }
        
        # Draw Projectile
        Write-Host ($beamChars[0] * 5) -NoNewline -ForegroundColor DarkGray
        Write-Host ($beamChars[2] * 4) -NoNewline -ForegroundColor DarkCyan
        Write-Host ($beamChars[4] * 2) -NoNewline -ForegroundColor Cyan
        Write-Host "►" -NoNewline -ForegroundColor White
        
        # Audio Ramp Up
        if ($i % 4 -eq 0) {
            try { [Console]::Beep($freq, 30) } catch {}
            $freq += 150
        }

        # Speed logic
        if ($sleepTime -gt 5) { $sleepTime -= 3 }
        Start-Sleep -Milliseconds $sleepTime
        
        # Erase trail
        try { 
            [Console]::SetCursorPosition($i, $yPos) 
            Write-Host "             " -NoNewline -BackgroundColor Black
        } catch { break }
    }

    # 5. THE IMPACT
    try { [Console]::Beep(6000, 150) } catch {} 
    
    # Double Flash Effect
    $flashes = @("White", "Cyan", "DarkCyan", "Black")
    foreach ($color in $flashes) {
        [Console]::BackgroundColor = $color
        Clear-Host
        Start-Sleep -Milliseconds 30
    }

    # 6. LOGO REVEAL (SOLID BLOCK METHOD)
    # Using a Here-String (@" ... "@) allows a solid block of text.
    # IMPORTANT: The closing "@ must be at the very start of the line.
    $logoRaw = @"
   ██╗ ██████╗ ███╗   ██╗██╗████████╗██╗   ██╗
   ██║██╔═══██╗████╗  ██║██║╚══██╔══╝╚██╗ ██╔╝
  ██║██║   ██║██╔██╗ ██║██║   ██║    ╚████╔╝
 ██║██║   ██║██║╚██╗██║██║   ██║     ╚██╔╝
██║╚██████╔╝██║ ╚████║██║   ██║      ██║
╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝   ╚═╝      ╚═╝
"@

    # Convert the solid block into lines for centering logic
    # -split "\r?\n" handles both Windows and Linux newline formats safely
    $logo = $logoRaw -split "\r?\n"
    
    $vCenter = $yPos - 4 
    
    foreach ($line in $logo) {
        # Skip empty lines to prevent errors
        if ([string]::IsNullOrWhiteSpace($line)) { continue }

        if ($vCenter -ge 0 -and $vCenter -lt $height) {
            # Calculate absolute center based on string length
            # We trim the end to ensure no trailing spaces throw off center
            $cleanLine = $line.TrimEnd() 
            $hCenter = [math]::Floor(($width - $cleanLine.Length) / 2)
            
            if ($hCenter -ge 0) {
                [Console]::SetCursorPosition($hCenter, $vCenter)
                Write-Host $cleanLine -ForegroundColor Cyan
            }
        }
        $vCenter++
    }

    # 7. SUBTITLE
    $subTitle = "ANYTHING IS POSSIBLE | BY CREATOR FOR CREATION"
    $hCenterSub = [math]::Floor(($width - $subTitle.Length) / 2)
    
    if (($vCenter) -lt $height) {
        [Console]::SetCursorPosition($hCenterSub, $vCenter)
        foreach ($char in $subTitle.ToCharArray()) {
            Write-Host $char -NoNewline -ForegroundColor White
            Start-Sleep -Milliseconds 10
        }
    }

    # 8. PROGRESS BAR & STATUS TEXT
    $barWidth = 40
    $barStart = [math]::Floor(($width - $barWidth) / 2)
    $barY = $vCenter + 2
    
    $statusMsgs = @("  Initializing Core",  "  ...Allocating RAM...",  "  ...Injecting DLLs...",".......3......",".......2......","......1......", "<......READY.....>")
    
    # Draw empty bar frame
    [Console]::SetCursorPosition($barStart - 1, $barY)
    Write-Host "[" -NoNewline -ForegroundColor DarkGray
    [Console]::SetCursorPosition($barStart + $barWidth, $barY)
    Write-Host "]" -NoNewline -ForegroundColor DarkGray

    # Fill the bar
    for ($p = 0; $p -le $barWidth; $p++) {
        $percent = [math]::Round(($p / $barWidth) * 100)
        
        [Console]::SetCursorPosition($barStart + $p, $barY)
        if ($p -lt $barWidth) { Write-Host "▓" -NoNewline -ForegroundColor DarkCyan }

        # Update status text less frequently to avoid flicker
        if ($p % 8 -eq 0) {
            $msgIndex = [math]::Floor(($p / $barWidth) * ($statusMsgs.Count - 1))
            $currentMsg = $statusMsgs[$msgIndex]
            $msgX = [math]::Floor(($width - $currentMsg.Length) / 2)
            
            [Console]::SetCursorPosition($msgX, $barY + 1)
            Write-Host (" " * 40) -NoNewline # Clear previous
            [Console]::SetCursorPosition($msgX, $barY + 1)
            Write-Host $currentMsg -NoNewline -ForegroundColor DarkGray
        }

        Start-Sleep -Milliseconds 40
    }

    # 9. FINAL PULSE & STARS
    $rnd = New-Object Random
    $starChars = @(".", "+", "*", "·")
    
    for ($pulse = 0; $pulse -lt 6; $pulse++) {
        
        $pulseColor = if ($pulse % 2 -eq 0) { "White" } else { "Cyan" }
        
        # Redraw Logo in new color (Using the new $logo array)
        $vLogoReset = $yPos - 4
        foreach ($line in $logo) {
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            $cleanLine = $line.TrimEnd()
            $hCenter = [math]::Floor(($width - $cleanLine.Length) / 2)
            [Console]::SetCursorPosition($hCenter, $vLogoReset)
            Write-Host $cleanLine -ForegroundColor $pulseColor
            $vLogoReset++
        }

        # Sprinkle Stars
        for ($s = 0; $s -lt 15; $s++) {
            $rX = $rnd.Next(0, $width)
            $rY = $rnd.Next(0, $height)
            if ($rY -lt ($yPos - 6) -or $rY -gt ($yPos + 6)) {
                try {
                    [Console]::SetCursorPosition($rX, $rY)
                    $char = $starChars[$rnd.Next(0, $starChars.Count)]
                    Write-Host $char -NoNewline -ForegroundColor Yellow
                } catch {}
            }
        }
        
        try { [Console]::Beep(4000, 50) } catch {}
        Start-Sleep -Milliseconds 150
    }

    Start-Sleep -Seconds 1

} catch {
    # Fail-safe
    [Console]::BackgroundColor = "Black"
    Clear-Host
    Write-Host "IONITY LOADING..." -ForegroundColor Cyan
} finally {
    # Cleanup
    [Console]::CursorVisible = $true
    [Console]::BackgroundColor = $origBg
    [Console]::ForegroundColor = $origFg
    Clear-Host
}