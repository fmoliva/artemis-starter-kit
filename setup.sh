#!/bin/bash
# Artemis — one-time setup
# Run once after copying the skill folder to ~/.claude/skills/artemis/
# Usage: bash ~/.claude/skills/artemis/setup.sh

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMANDS_DIR="$HOME/.claude/commands"

mkdir -p "$COMMANDS_DIR"

COMMANDS=(artemis run rerun resume explore load bug improve dashboard parse port matrix diff scope init)
installed=0
skipped=0

for cmd in "${COMMANDS[@]}"; do
  src="$SKILL_DIR/commands/$cmd.md"
  dest="$COMMANDS_DIR/$cmd.md"
  if [ ! -f "$src" ]; then
    echo "⚠️  skipped (source missing): /$cmd"
    continue
  fi
  if [ -f "$dest" ]; then
    echo "✓ already exists: /$cmd"
    ((skipped++))
  else
    cp "$src" "$dest"
    echo "✅ installed: /$cmd"
    ((installed++))
  fi
done

echo ""
echo "─────────────────────────────────────"
echo "Artemis setup complete."
echo "Installed: $installed commands  |  Skipped (already present): $skipped"
echo ""
echo "Restart Claude Code — all /artemis commands will appear in the / menu."
echo "─────────────────────────────────────"
