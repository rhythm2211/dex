# Simple Backend Logs Viewer
# Shows the latest backend log file content and updates

$logDir = "$env:USERPROFILE\.cursor\projects\c-Users-RHYTHM-Desktop-dex\terminals"

Write-Host "🔍 Finding latest backend log..." -ForegroundColor Cyan

# Find all log files and get the most recent one
$allLogs = Get-ChildItem -Path $logDir -Filter "*.txt" -ErrorAction SilentlyContinue | 
    Sort-Object LastWriteTime -Descending

if ($allLogs.Count -eq 0) {
    Write-Host "❌ No log files found in: $logDir" -ForegroundColor Red
    exit 1
}

# Try to find the backend log (contains uvicorn or backend commands)
$backendLog = $allLogs | Where-Object {
    $content = Get-Content $_.FullName -TotalCount 10 -ErrorAction SilentlyContinue -Raw
    $content -match "uvicorn|backend\.app\.main"
} | Select-Object -First 1

if (-not $backendLog) {
    # Fallback to most recent log
    $backendLog = $allLogs[0]
    Write-Host "⚠️  Using most recent log file (may not be backend)" -ForegroundColor Yellow
}

Write-Host "📄 Log file: $($backendLog.Name)" -ForegroundColor Green
Write-Host "📅 Last updated: $($backendLog.LastWriteTime)" -ForegroundColor Gray
Write-Host ""
Write-Host "=" * 80
Write-Host "  BACKEND LOGS (Live Updates - Press Ctrl+C to stop)" 
Write-Host "=" * 80
Write-Host ""

# Clear screen and show last 50 lines, then tail
Clear-Host
Get-Content $backendLog.FullName -Tail 50 -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_ -match "ERROR|Failed|Exception") { Write-Host $_ -ForegroundColor Red }
    elseif ($_ -match "WARNING|⚠") { Write-Host $_ -ForegroundColor Yellow }
    elseif ($_ -match "INFO|✅|Started") { Write-Host $_ -ForegroundColor Green }
    elseif ($_ -match "Database|POSTGRES") { Write-Host $_ -ForegroundColor Cyan }
    else { Write-Host $_ }
}

Write-Host ""
Write-Host "--- Following new logs (Ctrl+C to exit) ---" -ForegroundColor Cyan
Write-Host ""

# Simple tail -f equivalent
$lastSize = (Get-Item $backendLog.FullName).Length
while ($true) {
    Start-Sleep -Seconds 1
    $currentSize = (Get-Item $backendLog.FullName).Length
    
    if ($currentSize -gt $lastSize) {
        # Read new content
        $stream = [System.IO.FileStream]::new($backendLog.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $stream.Position = $lastSize
        $reader = [System.IO.StreamReader]::new($stream)
        
        while ($null -ne ($line = $reader.ReadLine())) {
            if ($line -match "ERROR|Failed|Exception") { Write-Host $line -ForegroundColor Red }
            elseif ($line -match "WARNING|⚠") { Write-Host $line -ForegroundColor Yellow }
            elseif ($line -match "INFO|✅|Started|Running") { Write-Host $line -ForegroundColor Green }
            elseif ($line -match "Database|POSTGRES|connection") { Write-Host $line -ForegroundColor Cyan }
            elseif ($line -match "GET|POST|PUT|DELETE") { Write-Host $line -ForegroundColor Magenta }
            else { Write-Host $line }
        }
        
        $lastSize = $stream.Position
        $reader.Close()
        $stream.Close()
    }
}
