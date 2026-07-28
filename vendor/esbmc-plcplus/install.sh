#!/bin/bash
# ESBMC-PLC+ installer for Plaxio
# Detects platform and downloads the appropriate binary from the artifact repo.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="pierredantas/esbmc-plcplus-artifact"
PLATFORM="$(uname -s)"
ARCH="$(uname -m)"

echo "=== Plaxio Formal Verification Engine Installer ==="
echo "Platform: $PLATFORM ($ARCH)"
echo "Target directory: $SCRIPT_DIR"
echo ""

# Check if Docker is available as fallback
if command -v docker &>/dev/null; then
  echo "[info] Docker detected — pulling ESBMC-PLC+ image..."
  if docker pull pierredantas/esbmc-plcplus 2>/dev/null; then
    echo "[ok] Docker image pulled successfully."
    echo "[ok] Plaxio will use Docker mode for verification."
    echo ""
    echo "To also install the native binary (faster, no Docker overhead),"
    echo "continue with Option 2 below."
    echo ""
  fi
fi

# Attempt native binary download
echo "[info] Attempting native binary download..."

case "$PLATFORM" in
  Linux)
    if [ "$ARCH" = "x86_64" ]; then
      BINARY_URL="https://github.com/$REPO/releases/latest/download/esbmc-linux-x86_64"
    elif [ "$ARCH" = "aarch64" ]; then
      BINARY_URL="https://github.com/$REPO/releases/latest/download/esbmc-linux-aarch64"
    else
      echo "[warn] Unsupported architecture: $ARCH. Use Docker mode instead."
      exit 0
    fi
    ;;
  Darwin)
    if [ "$ARCH" = "arm64" ]; then
      BINARY_URL="https://github.com/$REPO/releases/latest/download/esbmc-macos-arm64"
    elif [ "$ARCH" = "x86_64" ]; then
      BINARY_URL="https://github.com/$REPO/releases/latest/download/esbmc-macos-x86_64"
    else
      echo "[warn] Unsupported architecture: $ARCH. Use Docker mode instead."
      exit 0
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    BINARY_URL="https://github.com/$REPO/releases/latest/download/esbmc-windows-x86_64.exe"
    ;;
  *)
    echo "[warn] Unsupported platform: $PLATFORM. Use Docker mode instead."
    exit 0
    ;;
esac

OUTPUT_FILE="$SCRIPT_DIR/esbmc"
if [[ "$PLATFORM" == MINGW* || "$PLATFORM" == MSYS* || "$PLATFORM" == CYGWIN* ]]; then
  OUTPUT_FILE="$SCRIPT_DIR/esbmc.exe"
fi

echo "[info] Downloading from: $BINARY_URL"
if command -v curl &>/dev/null; then
  curl -fsSL -o "$OUTPUT_FILE" "$BINARY_URL" || {
    echo "[error] Download failed. The artifact repository may not have a release for your platform yet."
    echo "[info] Use Docker mode instead: docker pull pierredantas/esbmc-plcplus"
    exit 1
  }
elif command -v wget &>/dev/null; then
  wget -q -O "$OUTPUT_FILE" "$BINARY_URL" || {
    echo "[error] Download failed."
    exit 1
  }
else
  echo "[error] Neither curl nor wget found. Install one and retry."
  exit 1
fi

chmod +x "$OUTPUT_FILE"
echo "[ok] Binary installed at: $OUTPUT_FILE"

# Verify it runs
if "$OUTPUT_FILE" --version &>/dev/null; then
  VERSION=$("$OUTPUT_FILE" --version 2>&1 | head -1)
  echo "[ok] Engine version: $VERSION"
else
  echo "[warn] Binary installed but --version check failed. May need additional dependencies."
fi

echo ""
echo "=== Installation complete ==="
echo "Restart Plaxio and open the Verify tab to confirm detection."
