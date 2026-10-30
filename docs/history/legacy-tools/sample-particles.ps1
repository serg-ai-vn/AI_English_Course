# Server-side particle sampler (production pipeline prototype).
# Reads an image, samples a pixel grid, writes a JS file:
#   window.PARTICLE_DATA = { avatar: { w, h, step, points: [[x, y, luminance0-100], ...] } }
# The tablet only animates precomputed points - zero sampling cost on device,
# zero CORS/tainted-canvas issues.
#
# Usage: powershell -File tools\sample-particles.ps1 -Source demo-assets\avatar.jpg -Out demo-assets\avatar-particles.js -SlotName avatar -Step 10

param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$Out,
  [string]$SlotName = 'avatar',
  [int]$Step = 10
)

Add-Type -AssemblyName System.Drawing

$bmp = New-Object System.Drawing.Bitmap($Source)
$w = $bmp.Width
$h = $bmp.Height

$sb = New-Object System.Text.StringBuilder
[void]$sb.Append("window.PARTICLE_DATA = window.PARTICLE_DATA || {};`n")
[void]$sb.Append("window.PARTICLE_DATA['$SlotName'] = { w: $w, h: $h, step: $Step, points: [")

$first = $true
for ($y = [int]($Step/2); $y -lt $h; $y += $Step) {
  for ($x = [int]($Step/2); $x -lt $w; $x += $Step) {
    $c = $bmp.GetPixel($x, $y)
    # Skip transparent pixels (PNG avatars): particles follow the shape
    if ($c.A -lt 128) { continue }
    $l = [int][Math]::Round(0.2126*$c.R + 0.7152*$c.G + 0.0722*$c.B)
    if (-not $first) { [void]$sb.Append(',') }
    $first = $false
    [void]$sb.Append("[$x,$y,$l]")
  }
}
[void]$sb.Append('] };')

$bmp.Dispose()

$outPath = if ([System.IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path (Get-Location).Path $Out }
[System.IO.File]::WriteAllText($outPath, $sb.ToString(), [System.Text.Encoding]::ASCII)
$count = ([regex]::Matches($sb.ToString(), '\[')).Count - 1
Write-Output "Sampled $count points from ${w}x${h} (step $Step) -> $outPath"
