# Future Forge — tools/serve.ps1
# A tiny static web server with no dependencies, so Windows machines can run
# Future Forge from http://127.0.0.1:8765/ (the browser then remembers the
# camera permission and the offline cache works). Started by START FUTURE FORGE.bat.
param([int]$Port = 8765)
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$mime = @{ ".html"="text/html; charset=utf-8"; ".js"="application/javascript; charset=utf-8"; ".css"="text/css; charset=utf-8";
  ".json"="application/json"; ".webmanifest"="application/manifest+json"; ".svg"="image/svg+xml"; ".png"="image/png";
  ".jpg"="image/jpeg"; ".ico"="image/x-icon"; ".txt"="text/plain; charset=utf-8"; ".md"="text/plain; charset=utf-8"; ".bin"="application/octet-stream" }
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
try { $listener.Start() } catch { Write-Host "Port $Port is busy. Close the other Future Forge window, or open index.html directly."; Start-Sleep 5; exit 1 }
Write-Host "Future Forge is running at http://127.0.0.1:$Port/  (close this window to stop)"
while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $requestLine = $reader.ReadLine()
    while (($line = $reader.ReadLine()) -ne $null -and $line -ne "") { }   # skip headers
    $path = "/"
    if ($requestLine -match "^(GET|HEAD) (\S+)") { $path = $matches[2] }
    $path = [System.Uri]::UnescapeDataString(($path -split "\?")[0])
    if ($path -eq "/") { $path = "/index.html" }
    $file = Join-Path $root ($path.TrimStart("/") -replace "/", "\")
    $full = [System.IO.Path]::GetFullPath($file)
    $body = $null; $status = "404 Not Found"; $type = "text/plain"
    if ($full.StartsWith($root) -and (Test-Path $full -PathType Leaf)) {
      $body = [System.IO.File]::ReadAllBytes($full); $status = "200 OK"
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      if ($mime.ContainsKey($ext)) { $type = $mime[$ext] } else { $type = "application/octet-stream" }
    } else { $body = [System.Text.Encoding]::UTF8.GetBytes("Not found") }
    $header = "HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($hb, 0, $hb.Length)
    if (-not ($requestLine -like "HEAD *")) { $stream.Write($body, 0, $body.Length) }
    $stream.Flush()
  } catch { } finally { $client.Close() }
}
