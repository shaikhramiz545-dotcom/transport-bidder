# Run this in PowerShell before Flutter/Dart/Firebase commands if you get "git is not recognized" or "flutterfire is not recognized"
# Usage: . .\fix-terminal-path.ps1   (dot-space to run in current session)

$gitPath = "C:\Program Files\Git\bin"
$pubBin = "$env:LOCALAPPDATA\Pub\Cache\bin"
$add = @()
if (Test-Path "$gitPath\git.exe") { $add += $gitPath }
if (Test-Path $pubBin) { $add += $pubBin }
if ($add.Count -gt 0) {
    $env:Path = ($add + ($env:Path -split ';') | Select-Object -Unique) -join ';'
    if ($gitPath -in $add) { Write-Host "Git in PATH: $(git --version)" }
    if ($pubBin -in $add) { Write-Host "Pub bin in PATH - you can run: flutterfire configure --project=transport-bidder" }
} else {
    Write-Host "Git not found. Install from https://git-scm.com/download/win"
}
