# Single-file site exporter (week 3).
# Takes the template (index.html + styles.css + motion.js + particles.js)
# and a content config (JSON), and produces ONE self-contained HTML file:
# CSS and JS inlined, slot content filled, particle data embedded,
# images embedded as base64 data URIs (default) or left as URLs.
# The result opens by double-click and can be handed to the family.
#
# Usage:
#   powershell -File tools\export-site.ps1 -Config demo-export.json
#   powershell -File tools\export-site.ps1 -Config demo-export.json -KeepImageUrls

param(
  [string]$Config = 'demo-export.json',
  [string]$Out = '',
  [switch]$KeepImageUrls
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

# --- Read content config ---
$cfg = Get-Content (Join-Path $root $Config) -Raw -Encoding UTF8 | ConvertFrom-Json
$name = [string]$cfg.name
if (-not $Out) { $Out = "dist\$name.html" }

# --- Read template parts ---
$html      = [IO.File]::ReadAllText((Join-Path $root 'index.html'), [Text.Encoding]::UTF8)
$css       = [IO.File]::ReadAllText((Join-Path $root 'styles.css'), [Text.Encoding]::UTF8)
$motion    = [IO.File]::ReadAllText((Join-Path $root 'motion.js'), [Text.Encoding]::UTF8)
$particles = [IO.File]::ReadAllText((Join-Path $root 'particles.js'), [Text.Encoding]::UTF8)
$flight    = [IO.File]::ReadAllText((Join-Path $root 'flight.js'), [Text.Encoding]::UTF8)
$carousel  = [IO.File]::ReadAllText((Join-Path $root 'carousel.js'), [Text.Encoding]::UTF8)
$fill      = [IO.File]::ReadAllText((Join-Path $root 'tools\fill-slots.js'), [Text.Encoding]::UTF8)

# --- Build SITE_DATA (images -> data URIs unless -KeepImageUrls) ---
$mimeMap = @{ '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.png' = 'image/png'; '.webp' = 'image/webp'; '.gif' = 'image/gif' }
$images = @{}
foreach ($prop in $cfg.images.PSObject.Properties) {
  $src = [string]$prop.Value.src
  $alt = [string]$prop.Value.alt
  if (-not $KeepImageUrls) {
    $imgPath = Join-Path $root $src
    $ext = [IO.Path]::GetExtension($imgPath).ToLower()
    $mime = $mimeMap[$ext]
    if (-not $mime) { $mime = 'application/octet-stream' }
    $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($imgPath))
    $src = "data:$mime;base64,$b64"
  }
  $images[$prop.Name] = @{ src = $src; alt = $alt }
}

$siteData = [ordered]@{
  theme     = [string]$cfg.theme
  pageTitle = [string]$cfg.pageTitle
  slots     = $cfg.slots
  images    = $images
}
$siteDataJson = ConvertTo-Json $siteData -Depth 10 -Compress
# Guard: never allow a literal "</script>" inside the inline data
$siteDataJson = $siteDataJson.Replace('</', '<\/')

# --- Particle data (already JS: window.PARTICLE_DATA[...] = ...) ---
$particleJs = ''
foreach ($prop in $cfg.particles.PSObject.Properties) {
  $particleJs += [IO.File]::ReadAllText((Join-Path $root ([string]$prop.Value)), [Text.Encoding]::UTF8) + "`n"
}

# --- Assemble the single file (literal replacements, template strings) ---
$html = $html.Replace(
  '<html lang="en" data-theme="sunny-day">',
  '<html lang="en" data-theme="' + [string]$cfg.theme + '">'
)
$html = $html.Replace('<title>My AI Site</title>', '<title>' + [string]$cfg.pageTitle + '</title>')
$html = $html.Replace(
  '  <link rel="stylesheet" href="styles.css">',
  "  <style>`n" + $css + "`n  </style>"
)

$oldScripts = @"
  <!-- Production modules -->
  <script src="motion.js"></script>
  <script src="particles.js"></script>
  <script src="flight.js"></script>
  <script src="carousel.js"></script>
  <!-- DEV PREVIEW ONLY - remove before production -->
  <script src="dev-preview.js"></script>
"@
$newScripts = @"
  <script>window.SITE_DATA = $siteDataJson</script>
  <script>
$fill
  </script>
  <script>
$particleJs  </script>
  <script>
$motion
  </script>
  <script>
$particles
  </script>
  <script>
$flight
  </script>
  <script>
$carousel
  </script>
"@
if (-not $html.Contains($oldScripts)) {
  throw 'Template script block not found - index.html changed, update export-site.ps1'
}
$html = $html.Replace($oldScripts, $newScripts)

# --- Write ---
$outPath = Join-Path $root $Out
$outDir = Split-Path $outPath -Parent
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
[IO.File]::WriteAllText($outPath, $html, (New-Object Text.UTF8Encoding($true)))

$sizeKb = [math]::Round((Get-Item $outPath).Length / 1kb)
Write-Output "Exported: $Out ($sizeKb KB, theme: $($cfg.theme), images embedded: $(-not $KeepImageUrls))"
