# 1. Clone the repo
git clone -b ide-clean https://github.com/therealambadi/volt.git
cd volt

# 2. Install Node 20 (use nvm-windows or download from nodejs.org)
# Verify: node --version should show v20.x

# 3. Install dependencies (node-gyp will build native .node files for Windows)
npm ci

# 4. Build React bundle
npm run buildreact

# 5. Compile TypeScript
npx gulp compile-build-without-mangling

# 6. Build extensions
npx gulp compile-extensions-build

# 7. Bundle + minify
npx gulp minify-vscode

# 8. Package Windows app
npx gulp vscode-win32-x64-min-ci
