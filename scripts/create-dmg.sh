#!/bin/bash
# Plaxio DMG Installer Creator
# Creates a polished macOS .dmg with drag-to-Applications experience.
#
# Usage:
#   ./scripts/create-dmg.sh [path-to-app] [arch]
#
# Examples:
#   ./scripts/create-dmg.sh /Applications/Plaxio.app arm64
#   ./scripts/create-dmg.sh ../VSCode-darwin-arm64/Plaxio.app arm64
#   ./scripts/create-dmg.sh                                          # Uses /Applications/Plaxio.app, auto-detects arch

set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APP_PATH="${1:-/Applications/Plaxio.app}"
ARCH="${2:-$(uname -m)}"

# Normalize arch
case "$ARCH" in
  arm64|aarch64) ARCH="arm64" ;;
  x64|x86_64|amd64) ARCH="x64" ;;
esac

# Read version from product.json
VERSION=$(python3 -c "import json; print(json.load(open('${APP_PATH}/Contents/Resources/app/product.json'))['version'])" 2>/dev/null || echo "1.0.0")
DMG_NAME="Plaxio-${VERSION}-${ARCH}.dmg"
OUTPUT_DIR="${REPO}/dist"

echo "=== Plaxio DMG Creator ==="
echo "App:     ${APP_PATH}"
echo "Version: ${VERSION}"
echo "Arch:    ${ARCH}"
echo "Output:  ${OUTPUT_DIR}/${DMG_NAME}"
echo ""

# Validate input
if [ ! -d "${APP_PATH}" ]; then
  echo "ERROR: App not found at ${APP_PATH}"
  echo "Pass the path to Plaxio.app as the first argument."
  exit 1
fi

if [ ! -f "${APP_PATH}/Contents/Info.plist" ]; then
  echo "ERROR: ${APP_PATH} does not appear to be a valid .app bundle"
  exit 1
fi

# Check for create-dmg
if ! command -v create-dmg &>/dev/null; then
  echo "Installing create-dmg..."
  npm install -g create-dmg
fi

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Remove existing DMG if present (create-dmg won't overwrite)
rm -f "${OUTPUT_DIR}/${DMG_NAME}"

echo "[1/3] Creating DMG..."

# create-dmg automatically:
# - Adds an Applications symlink
# - Sets up the drag-to-install layout
# - Uses the app's icon as the DMG volume icon
# - Sizes the window appropriately
create-dmg "${APP_PATH}" "${OUTPUT_DIR}" \
  --overwrite \
  --dmg-title "Plaxio" \
  2>&1 || true

# create-dmg names the file based on the app name and version from Info.plist
# Rename to our standard naming convention
CREATED_DMG=$(find "${OUTPUT_DIR}" -name "Plaxio*.dmg" -newer "${APP_PATH}" -maxdepth 1 2>/dev/null | head -1)
if [ -z "$CREATED_DMG" ]; then
  # Fallback: try the most recent .dmg in output dir
  CREATED_DMG=$(ls -t "${OUTPUT_DIR}"/*.dmg 2>/dev/null | head -1)
fi

if [ -n "$CREATED_DMG" ] && [ "$CREATED_DMG" != "${OUTPUT_DIR}/${DMG_NAME}" ]; then
  mv "$CREATED_DMG" "${OUTPUT_DIR}/${DMG_NAME}"
fi

if [ ! -f "${OUTPUT_DIR}/${DMG_NAME}" ]; then
  echo ""
  echo "create-dmg didn't produce output. Falling back to hdiutil..."
  echo ""

  # Fallback: use hdiutil directly for a functional (less pretty) DMG
  STAGING="${REPO}/.dmg-staging"
  rm -rf "${STAGING}"
  mkdir -p "${STAGING}"

  # Copy app
  echo "  Copying app bundle..."
  cp -R "${APP_PATH}" "${STAGING}/"

  # Create Applications symlink
  ln -s /Applications "${STAGING}/Applications"

  # Create DMG
  echo "  Creating DMG with hdiutil..."
  hdiutil create \
    -volname "Plaxio" \
    -srcfolder "${STAGING}" \
    -ov \
    -format UDZO \
    -imagekey zlib-level=9 \
    "${OUTPUT_DIR}/${DMG_NAME}"

  # Cleanup
  rm -rf "${STAGING}"
fi

echo ""
echo "[2/3] Verifying DMG..."

if [ ! -f "${OUTPUT_DIR}/${DMG_NAME}" ]; then
  echo "ERROR: DMG was not created"
  exit 1
fi

DMG_SIZE=$(du -h "${OUTPUT_DIR}/${DMG_NAME}" | cut -f1)
echo "  File: ${OUTPUT_DIR}/${DMG_NAME}"
echo "  Size: ${DMG_SIZE}"

# Verify it mounts correctly
echo ""
echo "[3/3] Mount test..."
MOUNT_POINT=$(hdiutil attach "${OUTPUT_DIR}/${DMG_NAME}" -nobrowse -noverify -noautoopen 2>/dev/null | grep "/Volumes" | awk '{print $NF}')

if [ -z "$MOUNT_POINT" ]; then
  # Try to get full mount path
  MOUNT_POINT="/Volumes/Plaxio"
  sleep 2
fi

if [ -d "${MOUNT_POINT}" ]; then
  echo "  Mounted at: ${MOUNT_POINT}"
  echo "  Contents:"
  ls -la "${MOUNT_POINT}/" 2>/dev/null | grep -E "\.app|Applications" || true

  # Verify app exists in DMG
  if [ -d "${MOUNT_POINT}/Plaxio.app" ]; then
    echo "  ✓ Plaxio.app found"
  else
    echo "  ✗ Plaxio.app NOT found in DMG"
  fi

  # Verify Applications symlink
  if [ -L "${MOUNT_POINT}/Applications" ]; then
    echo "  ✓ Applications symlink present"
  else
    echo "  ✗ Applications symlink missing"
  fi

  # Unmount
  hdiutil detach "${MOUNT_POINT}" -quiet 2>/dev/null || true
else
  echo "  WARNING: Could not verify mount (may need manual check)"
fi

echo ""
echo "=== DMG Created Successfully ==="
echo ""
echo "  ${OUTPUT_DIR}/${DMG_NAME} (${DMG_SIZE})"
echo ""
echo "To distribute:"
echo "  1. Sign:     codesign --sign 'Developer ID Application: ...' '${OUTPUT_DIR}/${DMG_NAME}'"
echo "  2. Notarize: xcrun notarytool submit '${OUTPUT_DIR}/${DMG_NAME}' --apple-id ... --team-id ... --password ..."
echo "  3. Staple:   xcrun stapler staple '${OUTPUT_DIR}/${DMG_NAME}'"
