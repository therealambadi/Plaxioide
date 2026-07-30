#!/bin/bash
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

echo "🔨 Building React bundle..."
npm run buildreact

echo "🗑  Killing old Electron process..."
pkill -9 -f "Void|Electron.*plc|electron.*void" 2>/dev/null || true
# Kill any orphaned FUXA node process holding port 1881
kill -9 $(lsof -ti :1881 2>/dev/null) 2>/dev/null || true
kill -9 $(lsof -ti :9091 2>/dev/null) 2>/dev/null || true
sleep 1
# Remove socket so next launch creates a fresh instance instead of reusing a stale one
rm -f "$HOME/Library/Application Support/code-oss-dev/1.99-main.sock" 2>/dev/null || true

echo "🚀 Launching..."
> /tmp/void-console.log
bash "$REPO/scripts/code.sh" 2>&1 | tee -a /tmp/void-console.log
