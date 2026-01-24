# Supabase IPv4 Add-on Management Script (PowerShell)
# This script helps manage the IPv4 add-on for your Supabase project

# Configuration
$SUPABASE_ACCESS_TOKEN = "sbp_dda610bf0a8e5fe2782b093b069919719edbddc4"
$PROJECT_REF = "zyrxhllgdgowsbjislaq"

Write-Host "Supabase IPv4 Add-on Manager" -ForegroundColor Green
Write-Host "Project Ref: $PROJECT_REF"
Write-Host ""

# Function to check current add-on status
function Check-Status {
    Write-Host "Checking current IPv4 add-on status..." -ForegroundColor Yellow
    
    $headers = @{
        "Authorization" = "Bearer $SUPABASE_ACCESS_TOKEN"
    }
    
    $uri = "https://api.supabase.com/v1/projects/$PROJECT_REF/billing/addons"
    
    try {
        $response = Invoke-RestMethod -Uri $uri -Method Get -Headers $headers
        $response | ConvertTo-Json -Depth 10
        
        if ($response -is [array]) {
            $ipv4Addon = $response | Where-Object { $_.addon_type -eq "ipv4" }
        } else {
            $ipv4Addon = $null
        }
        
        if ($ipv4Addon) {
            Write-Host "[OK] IPv4 add-on is enabled" -ForegroundColor Green
        } else {
            Write-Host "[X] IPv4 add-on is not enabled" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "Error: $_" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host $_.ErrorDetails.Message
        }
    }
}

# Function to enable IPv4 add-on
function Enable-IPv4 {
    Write-Host "Enabling IPv4 add-on..." -ForegroundColor Yellow
    
    $headers = @{
        "Authorization" = "Bearer $SUPABASE_ACCESS_TOKEN"
        "Content-Type" = "application/json"
    }
    
    # Use the correct endpoint and body format
    $body = @{
        addon_type = "ipv4"
    } | ConvertTo-Json
    
    $uri = "https://api.supabase.com/v1/projects/$PROJECT_REF/addons"
    
    try {
        $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body
        $response | ConvertTo-Json -Depth 10
        Write-Host "[OK] IPv4 add-on enabled successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "[X] Failed to enable IPv4 add-on" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host $_.ErrorDetails.Message
        }
    }
}

# Function to disable IPv4 add-on
function Disable-IPv4 {
    Write-Host "Disabling IPv4 add-on..." -ForegroundColor Yellow
    
    $headers = @{
        "Authorization" = "Bearer $SUPABASE_ACCESS_TOKEN"
    }
    
    $uri = "https://api.supabase.com/v1/projects/$PROJECT_REF/billing/addons/ipv4"
    
    try {
        Invoke-RestMethod -Uri $uri -Method Delete -Headers $headers
        Write-Host "[OK] IPv4 add-on disabled successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "[X] Failed to disable IPv4 add-on" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host $_.ErrorDetails.Message
        }
    }
}

# Main script logic
$command = $args[0]

switch ($command) {
    "status" {
        Check-Status
    }
    "check" {
        Check-Status
    }
    "enable" {
        Enable-IPv4
    }
    "disable" {
        Disable-IPv4
    }
    default {
        Write-Host "Usage: .\manage-supabase-ipv4.ps1 {status|enable|disable}" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  status  - Check current IPv4 add-on status"
        Write-Host "  enable  - Enable IPv4 add-on for your project"
        Write-Host "  disable - Disable IPv4 add-on for your project"
        Write-Host ""
        Write-Host "Example:"
        Write-Host "  .\manage-supabase-ipv4.ps1 status"
        Write-Host "  .\manage-supabase-ipv4.ps1 enable"
        exit 1
    }
}
