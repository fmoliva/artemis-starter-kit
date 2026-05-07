#!/usr/bin/env bash
# Installs Node.js, Python 3, and Git if not already present.
# Run this once before anything else.
# Usage: bash setup-prereqs.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${YELLOW}→  $1${NC}"; }

# ─── macOS ────────────────────────────────────────────────────────────────────
if [[ "$OSTYPE" == "darwin"* ]]; then

  # Homebrew
  if ! command -v brew >/dev/null 2>&1; then
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add brew to PATH for Apple Silicon
    eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
  else
    ok "Homebrew already installed"
  fi

  # Node.js
  if ! command -v node >/dev/null 2>&1; then
    info "Installing Node.js..."
    brew install node
  else
    ok "Node.js already installed ($(node --version))"
  fi

  # Python 3
  if ! command -v python3 >/dev/null 2>&1; then
    info "Installing Python 3..."
    brew install python3
  else
    ok "Python already installed ($(python3 --version))"
  fi

  # Git
  if ! command -v git >/dev/null 2>&1; then
    info "Installing Git..."
    brew install git
  else
    ok "Git already installed ($(git --version | head -1))"
  fi

# ─── Linux (Debian/Ubuntu) ────────────────────────────────────────────────────
elif command -v apt-get >/dev/null 2>&1; then

  info "Updating package list..."
  sudo apt-get update -qq

  # Node.js (via NodeSource for a current LTS version)
  if ! command -v node >/dev/null 2>&1; then
    info "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    ok "Node.js already installed ($(node --version))"
  fi

  # Python 3
  if ! command -v python3 >/dev/null 2>&1; then
    info "Installing Python 3..."
    sudo apt-get install -y python3 python3-pip
  else
    ok "Python already installed ($(python3 --version))"
  fi

  # Git
  if ! command -v git >/dev/null 2>&1; then
    info "Installing Git..."
    sudo apt-get install -y git
  else
    ok "Git already installed ($(git --version | head -1))"
  fi

# ─── Linux (RPM-based: Fedora/RHEL/CentOS) ───────────────────────────────────
elif command -v dnf >/dev/null 2>&1; then

  # Node.js
  if ! command -v node >/dev/null 2>&1; then
    info "Installing Node.js..."
    sudo dnf install -y nodejs
  else
    ok "Node.js already installed ($(node --version))"
  fi

  # Python 3
  if ! command -v python3 >/dev/null 2>&1; then
    info "Installing Python 3..."
    sudo dnf install -y python3
  else
    ok "Python already installed ($(python3 --version))"
  fi

  # Git
  if ! command -v git >/dev/null 2>&1; then
    info "Installing Git..."
    sudo dnf install -y git
  else
    ok "Git already installed ($(git --version | head -1))"
  fi

else
  echo "⚠  Unsupported OS. Please install Node.js 18+, Python 3.10+, and Git manually."
  echo "   Node.js: https://nodejs.org"
  echo "   Python:  https://python.org"
  echo "   Git:     https://git-scm.com"
  exit 1
fi

echo ""
echo "Prerequisites installed. Next step:"
echo "  cd [repo-folder] && cd [app-folder] && npm install && npx playwright install"
