$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:NEXT_TELEMETRY_DISABLED = '1'
if (-not (Test-Path -LiteralPath 'node_modules/next/dist/bin/next')) {
    throw 'Install dependencies first: pnpm install --frozen-lockfile'
}
Write-Host 'SmartBooking: http://127.0.0.1:3101 (Ctrl+C to stop)'
& node 'node_modules/next/dist/bin/next' dev --hostname 127.0.0.1 --port 3101
