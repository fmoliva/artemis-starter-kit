# Generates .mcp.json with the correct absolute paths for this machine.
# Run this once after cloning, from the repo root.
# Usage: powershell -ExecutionPolicy Bypass -File setup-mcp.ps1

$RepoRoot = (Get-Location).Path
$ArtemisProject = Join-Path $RepoRoot ".artemis-project"

if (-not (Test-Path $ArtemisProject)) {
    Write-Host "⚠  .artemis-project not found. Make sure you are running this from the repo root." -ForegroundColor Yellow
    exit 1
}

$App = (Get-Content $ArtemisProject -TotalCount 1).Trim()

if ([string]::IsNullOrEmpty($App)) {
    Write-Host "⚠  .artemis-project is empty. Add your app name on line 1." -ForegroundColor Yellow
    exit 1
}

$McpCli = "$RepoRoot\$App\node_modules\@playwright\mcp\cli.js"
$OutputDir = "$RepoRoot\$App\results\screenshots"

if (-not (Test-Path $McpCli)) {
    Write-Host "⚠  Playwright MCP not found. Run: cd $App; npm install" -ForegroundColor Yellow
    exit 1
}

$config = @"
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": [
        "$($McpCli -replace '\\', '\\')",
        "--output-dir",
        "$($OutputDir -replace '\\', '\\')"
      ]
    }
  }
}
"@

$config | Out-File -FilePath "$RepoRoot\.mcp.json" -Encoding utf8
Write-Host "✅ .mcp.json created for app: $App. Restart Claude Code to apply." -ForegroundColor Green
