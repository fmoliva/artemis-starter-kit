#!/bin/bash
# Artemis Starter Kit — one-time setup
#
# Installs the Artemis skill and agents into ~/.claude/ so they are available
# across all your projects globally.
#
# Usage: bash setup.sh
#        (run from the Artemis Starter Kit directory)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SKILL_SRC="${SCRIPT_DIR}/skill"
AGENTS_SRC="${SCRIPT_DIR}/agents"

GLOBAL_SKILL_DIR="$HOME/.claude/skills/artemis"
GLOBAL_AGENTS_DIR="$HOME/.claude/agents"
GLOBAL_COMMANDS_DIR="$HOME/.claude/commands"

echo ""
echo "─────────────────────────────────────────"
echo "  Artemis Starter Kit — Setup"
echo "─────────────────────────────────────────"
echo ""

# ─── Install Skill ──────────────────────────────────────────────────────────

echo "Installing skill → ${GLOBAL_SKILL_DIR}/"

if [ -d "$GLOBAL_SKILL_DIR" ]; then
  echo "  ⚠️  Skill already exists at ${GLOBAL_SKILL_DIR}"
  echo "  Overwrite? (y/N)"
  read -r answer
  if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
    echo "  Skipped skill install."
  else
    cp -r "${SKILL_SRC}/" "$GLOBAL_SKILL_DIR/"
    echo "  ✓ Skill updated."
  fi
else
  mkdir -p "$GLOBAL_SKILL_DIR"
  cp -r "${SKILL_SRC}/" "$GLOBAL_SKILL_DIR/"
  echo "  ✓ Skill installed."
fi

# ─── Install Agents ──────────────────────────────────────────────────────────

echo ""
echo "Installing agents → ${GLOBAL_AGENTS_DIR}/"
mkdir -p "$GLOBAL_AGENTS_DIR"

agents_installed=0
agents_skipped=0

for agent_file in "${AGENTS_SRC}"/*.md; do
  [ -f "$agent_file" ] || continue
  agent_name="$(basename "$agent_file")"
  dest="${GLOBAL_AGENTS_DIR}/${agent_name}"
  if [ -f "$dest" ]; then
    ((agents_skipped++))
  else
    cp "$agent_file" "$dest"
    ((agents_installed++))
    echo "  ✓ ${agent_name}"
  fi
done

echo "  Agents: ${agents_installed} new  |  ${agents_skipped} already present"

# ─── Install Commands ─────────────────────────────────────────────────────────

echo ""
echo "Installing commands → ${GLOBAL_COMMANDS_DIR}/"
mkdir -p "$GLOBAL_COMMANDS_DIR"

commands_installed=0
commands_skipped=0

for cmd_file in "${SKILL_SRC}/commands"/*.md; do
  [ -f "$cmd_file" ] || continue
  cmd_name="$(basename "$cmd_file")"
  dest="${GLOBAL_COMMANDS_DIR}/${cmd_name}"
  if [ -f "$dest" ]; then
    ((commands_skipped++))
  else
    cp "$cmd_file" "$dest"
    ((commands_installed++))
  fi
done

echo "  Commands: ${commands_installed} new  |  ${commands_skipped} already present"

# ─── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "─────────────────────────────────────────"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Restart Claude Code (or open a new project)"
echo "  2. Copy vault-starter/ to your vault location"
echo "     cp -r vault-starter/ ~/path/to/your-app-vault"
echo "  3. Copy project-starter/ to your Playwright project"
echo "     cp -r project-starter/ ~/path/to/your-project"
echo "  4. Fill in vault/_app-overview.md + _test-data.md"
echo "  5. Run /context [your-module] to generate your first tests"
echo "     — or add a card to vault/_queue.md and run /ticket to have Artemis test it"
echo ""
echo "  See ONBOARDING.md for detailed setup instructions."
echo "─────────────────────────────────────────"
echo ""
