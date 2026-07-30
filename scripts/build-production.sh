#!/bin/bash
# Plaxio Production Build Script
# Builds distributable packages for macOS and Windows.
#
# Usage:
#   ./scripts/build-production.sh [platform] [arch]
#
# Examples:
#   ./scripts/build-production.sh              # Build for current platform
#   ./scripts/build-production.sh darwin arm64  # macOS Apple Silicon
#   ./scripts/build-production.sh darwin x64    # macOS Intel
#   ./scripts/build-production.sh win32 x64     # Windows 64-bit
#   ./scripts/build-production.sh win32 arm64   # Windows ARM64
#   ./scripts/build-production.sh all           # All macOS + Windows targets

set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

PLATFORM="${1:-$(uname -s | tr '[:upper:]' '[:lower:]')}"
ARCH="${2:-$(uname -m)}"

# Normalize platform
case "$PLATFORM" in
  darwin|Darwin|macos|macOS) PLATFORM="darwin" ;;
  win32|windows|Windows) PLATFORM="win32" ;;
  all) ;;
  *) echo "Unsupported platform: $PLATFORM"; exit 1 ;;
esac

# Normalize arch
case "$ARCH" in
  arm64|aarch64) ARCH="arm64" ;;
  x64|x86_64|amd64) ARCH="x64" ;;
esac

echo "=== Plaxio Production Build ==="
echo "Platform: $PLATFORM"
echo "Arch: $ARCH"
echo ""

# Step 1: Install dependencies
echo "[1/6] Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "Installing node_modules..."
  npm ci
fi

# Step 2: Build React bundle
echo "[2/6] Building React bundle..."
npm run buildreact

# Step 3: Compile TypeScript
echo "[3/6] Compiling TypeScript (with mangling for production)..."
npx gulp compile-build-with-mangling

# Step 4: Build extensions
echo "[4/6] Building extensions..."
npx gulp compile-extensions-build

# Step 5: Bundle & minify
echo "[5/6] Bundling and minifying..."
npx gulp minify-vscode

# Step 6: Package for target platforms
echo "[6/6] Packaging..."

build_target() {
  local plat=$1
  local arch=$2
  echo ""
  echo "--- Building: $plat-$arch ---"
  npx gulp "vscode-${plat}-${arch}-min-ci"

  local dest_dir="../VSCode-${plat}-${arch}"
  echo "Output: $dest_dir"

  # Post-packaging: rename app if needed
  if [[ "$plat" == "darwin" ]]; then
    local app_dir="$dest_dir/Plaxio.app"
    if [ -d "$app_dir" ]; then
      echo "macOS app bundle: $app_dir"
      # Create ZIP for distribution
      pushd "$(dirname "$dest_dir")" > /dev/null
      local zip_name="Plaxio-${plat}-${arch}.zip"
      rm -f "$zip_name"
      zip -r -y "$zip_name" "$(basename "$dest_dir")/Plaxio.app"
      echo "Created: $(dirname "$dest_dir")/$zip_name"
      popd > /dev/null
    fi
  fi

  if [[ "$plat" == "win32" ]]; then
    echo "Windows build: $dest_dir"
    echo "To create installer, run Inno Setup with build/win32/code.iss"
    echo "  ISCC.exe /DRepoDir=\"$REPO\" /DSourceDir=\"$dest_dir\" /DOutputDir=\"$REPO/dist\" build/win32/code.iss"
  fi
}

if [[ "$PLATFORM" == "all" ]]; then
  build_target "darwin" "arm64"
  build_target "darwin" "x64"
  build_target "win32" "x64"
  build_target "win32" "arm64"
else
  build_target "$PLATFORM" "$ARCH"
fi

echo ""
echo "=== Build Complete ==="
echo ""
echo "Outputs in parent directory:"
ls -d ../VSCode-* 2>/dev/null || echo "(none found — build may have failed)"
echo ""
echo "Next steps:"
echo "  macOS: Sign with 'codesign' and notarize with 'xcrun notarytool'"
echo "  Windows: Run Inno Setup to create .exe installer"
