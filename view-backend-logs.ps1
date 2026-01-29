# View Backend Logs Live
# This script displays real-time backend logs from the running uvicorn process

$logFile = "$env:USERPROFILE\.cursor\projects\c-Users-RHYTHM-Desktop-dex\terminals\*.txt"

Write-Host "🔍 Searching for backend log files..." -ForegroundColor Cyan

# Find the most recent backend log file
$logFiles = Get-ChildItem -Path "$env:USERPROFILE\.cursor\projects\c-Users-RHYTHM-Desktop-dex\terminals\" -Filter "*.txt" -ErrorAction SilentlyContinue | 
    Where-Object { 
        $content = Get-Content $_.FullName -TotalCount 5 -ErrorAction SilentlyContinue
        $content -match "uvicorn|backend|python" 
    } | 
    Sort-Object LastWriteTime -Descending

if ($logFiles.Count -eq 0) {
    Write-Host "❌ No backend log files found." -ForegroundColor Red
    Write-Host "Make sure the backend is running with: uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload" -ForegroundColor Yellow
    exit 1
}

$latestLog = $logFiles[0]
Write-Host "📄 Found log file: $($latestLog.Name)" -ForegroundColor Green
Write-Host "📅 Last updated: $($latestLog.LastWriteTime)" -ForegroundColor Gray
Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "  LIVE BACKEND LOGS - Press Ctrl+C to exit" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

# Function to display logs with color coding
function Format-LogLine {
    param([string]$line)
    
    if ($line -match "ERROR|Failed|Exception|Traceback") {
        Write-Host $line -ForegroundColor Red
    }
    elseif ($line -match "WARNING|Warning|⚠") {
        Write-Host $line -ForegroundColor Yellow
    }
    elseif ($line -match "INFO|✅|Loaded|Started|Running") {
        Write-Host $line -ForegroundColor Green
    }
    elseif ($line -match "DEBUG|Debug") {
        Write-Host $line -ForegroundColor Gray
    }
    elseif ($line -match "POSTGRES|Database|connection") {
        Write-Host $line -ForegroundColor Cyan
    }
    elseif ($line -match "GET|POST|PUT|DELETE|/api/") {
        Write-Host $line -ForegroundColor Magenta
    }
    else {
        Write-Host $line
    }
}

# Tail the log file (similar to `tail -f` in Linux)
$lastSize = 0
$lastPosition = 0

try {
    while ($true) {
        if (Test-Path $latestLog.FullName) {
            $currentSize = (Get-Item $latestLog.FullName).Length
            
            if ($currentSize -gt $lastSize) {
                # File has grown, read new content
                $stream = [System.IO.File]::Open($latestLog.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
                $stream.Position = $lastPosition
                $reader = New-Object System.IO.StreamReader($stream)
                
                while ($null -ne ($line = $reader.ReadLine())) {
                    Format-LogLine $line
                }
                
                $lastPosition = $stream.Position
                $lastSize = $currentSize
                $reader.Close()
                $stream.Close()
            }
        }
        
        Start-Sleep -Milliseconds 500
    }
}
catch {
    Write-Host "`n❌ Error reading logs: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    Write-Host "`n👋 Stopped monitoring logs." -ForegroundColor Yellow
}
