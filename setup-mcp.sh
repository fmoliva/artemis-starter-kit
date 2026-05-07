#!/usr/bin/env bash
# Generates .mcp.json with the correct absolute paths for this machine.
# Run this once after cloning, from the repo root.
# Usage: bash setup-mcp.sh

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
APP=$(head -1 "$REPO_ROOT/.artemis-project" 2>/dev/null | tr -d '[:space:]')

if [ -z "$APP" ]; then
  echo "⚠  .artemis-project not found or empty. Make sure you are running this from the repo root."
  exit 1
fi

MCP_CLI="$REPO_ROOT/$APP/node_modules/@playwright/mcp/cli.js"
OUTPUT_DIR="$REPO_ROOT/$APP/results/screenshots"

if [ ! -f "$MCP_CLI" ]; then
  echo "⚠  Playwright MCP not found. Run: cd $APP && npm install"
  exit 1
fi

cat > "$REPO_ROOT/.mcp.json" << EOF
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": [
        "$MCP_CLI",
        "--output-dir",
        "$OUTPUT_DIR"
      ]
    }
  }
}
EOF

echo "✅ .mcp.json created for app: $APP. Restart Claude Code to apply."
