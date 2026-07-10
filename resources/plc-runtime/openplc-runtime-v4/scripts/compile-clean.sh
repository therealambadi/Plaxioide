#!/bin/bash
set -euo pipefail

BUILD_DIR="build"

# Determine shared library extension for the current platform
if [ "$(uname -s)" = "Darwin" ]; then
    LIB_EXT=".dylib"
else
    LIB_EXT=".so"
fi

# Remove old object files from root (if any left from older builds)
find . -maxdepth 1 -name "*.o" -type f -exec rm -f {} \;

# Clean extra .o files from build dir if needed
rm -f "$BUILD_DIR"/*.o

# Remove old libplc_* files to ensure only one exists
rm -f "$BUILD_DIR"/libplc_*"$LIB_EXT"

TIMESTAMP=$(date +%s%N)
UNIQUE_LIBPLC="libplc_${TIMESTAMP}${LIB_EXT}"

# Move resulting shared library to unique name
mv "$BUILD_DIR/new_libplc${LIB_EXT}" "$BUILD_DIR/$UNIQUE_LIBPLC"
