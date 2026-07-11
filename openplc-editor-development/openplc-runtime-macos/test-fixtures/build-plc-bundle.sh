#!/bin/bash
# build-plc-bundle.sh
# Build plc_main using the bundled MSYS2 toolchain.
# Called via: bash build-plc-bundle.sh <bundle_dir> <src_dir> <build_dir>
set -e

BUNDLE="$1"
SRC_DIR="$2"
BUILD_DIR="$3"

if [ -z "$BUNDLE" ] || [ -z "$SRC_DIR" ] || [ -z "$BUILD_DIR" ]; then
  echo "Usage: $0 <bundle_dir> <src_dir> <build_dir>" >&2
  exit 1
fi

BUNDLE_BIN="$BUNDLE/bin"
BUNDLE_USR="$BUNDLE/usr/bin"
GCC_ARCH="x86_64-pc-cygwin"
GCC_VER="15.3.0"

export PATH="$BUNDLE_BIN:$BUNDLE_USR:$PATH"
export CPLUS_INCLUDE_PATH="$BUNDLE/usr/lib/gcc/$GCC_ARCH/$GCC_VER/include/c++"
export C_INCLUDE_PATH="$BUNDLE/usr/include"
export LIBRARY_PATH="$BUNDLE/usr/lib/gcc/$GCC_ARCH/$GCC_VER:$BUNDLE/usr/lib:$BUNDLE/usr/lib/W32api"

echo "=== Bundled g++ version ==="
g++ --version | head -1

echo "=== cmake (from PATH) ==="
cmake --version | head -1

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

echo "=== cmake configure ==="
cmake "$SRC_DIR" -G "Unix Makefiles" \
  -DCMAKE_C_COMPILER="$BUNDLE_USR/gcc.exe" \
  -DCMAKE_CXX_COMPILER="$BUNDLE_USR/g++.exe"

echo "=== make plc_main ==="
make -j4 plc_main

echo "=== Build result ==="
ls -lh plc_main plc_main.exe 2>/dev/null
echo "BUILD COMPLETE"
