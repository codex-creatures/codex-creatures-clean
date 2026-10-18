# play.ps1 - serves the game in .\game at http://localhost:8123 (Windows, no installs needed).
# Your save lives in the browser for this address, so always use this port.
$port = 8123
$root = Join-Path $PSScriptRoot "game"
$types = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript"; ".css"="text/css"; ".json"="application/json";
  ".png"="image/png"; ".jpg"="image/jpeg"; ".svg"="image/svg+xml"; ".ico"="image/x-icon"; ".woff2"="font/woff2";
  ".woff"="font/woff"; ".txt"="text/plain"; ".webmanifest"="application/manifest+json"; ".gif"="image/gif" }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Codex Creatures is running at http://localhost:$port/ - keep this window open while you play."
Start-Process "http://localhost:$port/"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $p = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart("/")
    $file = Join-Path $root $p
    if (Test-Path $file -PathType Container) { $file = Join-Path $file "index.html" }
    if (-not (Test-Path $file -PathType Leaf) -and (Test-Path "$file.html" -PathType Leaf)) { $file = "$file.html" }
    if (-not (Test-Path $file -PathType Leaf)) { $file = Join-Path $root "404.html"; $ctx.Response.StatusCode = 404 }
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $ctx.Response.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" }
    $bytes = [IO.File]::ReadAllBytes($file)
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch { $ctx.Response.StatusCode = 500 }
  finally { $ctx.Response.OutputStream.Close() }
}
