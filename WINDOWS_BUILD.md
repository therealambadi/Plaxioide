# Plaxio Windows Build Guide — For AI Agent

This document contains everything needed to build and package Plaxio for Windows (win32-x64) from the `ide-clean` branch. Follow every step exactly in order.

---

## Prerequisites

Install these before starting. All are required.

| Tool | Version | Download |
|---|---|---|
| Node.js | **20.x exactly** (not 22, not 18) | https://nodejs.org/dist/v20.18.3/node-v20.18.3-x64.msi |
| Git | Any recent | https://git-scm.com/download/win |
| Python | 3.11 | https://www.python.org/downloads/release/python-3119/ |
| Visual Studio Build Tools | 2022 | https://visualstudio.microsoft.com/visual-cpp-build-tools/ — install "Desktop development with C++" workload |
| Inno Setup | 6.x | https://jrsoftware.org/isdl.php |

Verify Node version before proceeding:
```
node --version   # must print v20.x.x
```

---

## Step 1 — Clone the repository

```
git clone -b ide-clean https://github.com/therealambadi/volt.git
cd volt
```

---

## Step 2 — Install dependencies

This builds native `.node` modules (`@parcel/watcher`, `@vscode/deviceid`) for Windows using node-gyp + Visual Studio. It will take 5–10 minutes.

```
npm ci
```

If npm ci fails with a node-gyp error:
- Make sure Visual Studio Build Tools 2022 is installed with the C++ workload
- Run: `npm config set msvs_version 2022`
- Run: `npm config set python C:\Python311\python.exe` (adjust path to your Python 3.11)
- Then retry `npm ci`

After `npm ci` completes, verify the native modules are Windows PE binaries:
```
file node_modules\@parcel\watcher\build\Release\watcher.node
```
Must say: `PE32+ executable (DLL) (GUI) x86-64, for MS Windows`

---

## Step 3 — Build the React bundle

```
npm run buildreact
```

Expected output ends with: `Build complete!`

---

## Step 4 — Package the Windows app

The production bundles are already pre-built in `out-vscode-min/` (compiled on macOS and committed to the repo). Skip the TypeScript compile step entirely and go straight to packaging:

```
npx gulp vscode-win32-x64-min-ci
```

This command will:
1. Use the pre-built bundles from `out-vscode-min/` (18MB workbench, 1MB main)
2. Download the Windows Electron 34.3.2 binary automatically
3. Copy all extensions from `extensions/`
4. Run `rcedit.exe` natively to stamp version info into `.node` files (works natively on Windows — no wine needed)
5. Produce `../VSCode-win32-x64/` folder next to the repo root

Expected duration: 3–5 minutes.

After it completes, verify the bundle is the correct size:
```
dir ..\VSCode-win32-x64\resources\app\out\vs\workbench\workbench.desktop.main.js
```
**The file must be ~18MB (18,000,000+ bytes).** If it shows ~19KB the packaging used the wrong source — stop and report immediately before proceeding.

---

## Step 5 — Verify the app runs

Before building the installer, test the app directly:

```
..\VSCode-win32-x64\Plaxio.exe
```

The app should launch and show the Plaxio IDE — sidebar, title bar with "Plaxio" logo text, and the main editor area. If the window is blank or white, see the troubleshooting section below.

---

## Step 6 — Build the Windows installer

Use Inno Setup to package into a `.exe` installer:

```
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" /DRepoDir="%CD%" /DSourceDir="..\VSCode-win32-x64" /DOutputDir="%CD%\dist" build\win32\code.iss
```

The installer will be created at `dist\PlaxioSetup-1.99.3.exe`.

---

## Step 7 — Upload to GitHub Releases

```
gh release upload v1.99.3 dist\PlaxioSetup-1.99.3.exe --repo therealambadi/volt --clobber
```

If `gh` CLI is not installed: download from https://cli.github.com/ and authenticate with `gh auth login` first.

---

## Troubleshooting

### App is blank / white window after launch

The workbench bundle is wrong size. Check:
```
dir ..\VSCode-win32-x64\resources\app\out\vs\workbench\workbench.desktop.main.js
```
- **~19KB** → packaging used the dev source file, not the production bundle. The `out-vscode-min/` folder was not found. Pull the latest and retry Step 4.
- **~18MB** → bundle is correct. The blank app has a different cause. Run with logging:

```
..\VSCode-win32-x64\Plaxio.exe --log debug 2> C:\temp\plaxio-error.log
```
Read `C:\temp\plaxio-error.log` to find the error.

### `out-vscode-min` folder is missing or empty after clone

The pre-built bundles must be present after cloning `ide-clean`. Verify:
```
dir out-vscode-min\vs\workbench\workbench.desktop.main.js
```
If missing:
```
git pull origin ide-clean
git lfs pull   (if using git LFS)
```
If still missing, contact the macOS developer to re-push the bundles.

### `npm ci` fails — OVERLAPPING edit or mangling error

This error comes from the TypeScript name-mangler and is **not a problem** — it only affects the `compile-build-with-mangling` step which we skip entirely. The pre-built `out-vscode-min/` bundles from macOS are used instead. Ignore this error and proceed with Step 4.

### rcedit fails on Windows

On Windows, rcedit runs natively without wine. If it fails:
1. Verify `npm ci` ran successfully and `node_modules\rcedit\bin\rcedit.exe` exists
2. Verify Visual Studio Build Tools 2022 are installed
3. Re-run `npm ci` if needed

### `@parcel/watcher` or `@vscode/deviceid` fails to load at runtime

These native modules must be compiled on Windows by `npm ci`. If the app crashes with a module load error:
1. Delete `node_modules`: `rmdir /s /q node_modules`
2. Re-run `npm ci`
3. Verify: `file node_modules\@parcel\watcher\build\Release\watcher.node` → must be `PE32+`

### Electron download fails during `gulp vscode-win32-x64-min-ci`

The gulp task downloads Electron 34.3.2 for win32-x64 from GitHub. If the download fails due to network:
- Retry the command — it resumes downloads
- Or manually download from https://github.com/electron/electron/releases/tag/v34.3.2 (`electron-v34.3.2-win32-x64.zip`) and place it in `.build/electron/` before running gulp

---

## Key files reference

| File | Purpose |
|---|---|
| `out-vscode-min/vs/workbench/workbench.desktop.main.js` | **18MB** production workbench bundle (pre-built on macOS, committed) |
| `out-vscode-min/main.js` | **1MB** production Electron main bundle (pre-built on macOS, committed) |
| `build/lib/optimize.js` | ESM bundler with electron-cjs-shim fix — prevents blank app on Electron 34 |
| `build/win32/code.iss` | Inno Setup script for the Windows installer |
| `product.json` | App name, version, checksums |
| `src/vs/code/electron-main/app.ts` | Electron main process (FUXA server, auth, LSUIElement) |
| `out/vs/workbench/contrib/void/browser/plcExplorerPanel.js` | Sidebar chevron injection |
| `out/vs/workbench/browser/parts/titlebar/commandCenterControl.js` | "Plaxio" title bar logo |
| `out/vs/workbench/browser/workbench.contribution.js` | Nav arrows hidden (navigationControl.enabled=false) |

---

## Build architecture

```
[macOS — already done]
src/ → gulp compile → out-build/ → gulp minify → out-vscode-min/
                                                       ↓
                                              committed to git ✓

[Windows — what the agent does]
out-vscode-min/  ←  already in repo (cloned)
      +
node_modules/    ←  npm ci builds Windows .node files natively
      +
extensions/      ←  already in repo
      ↓
npx gulp vscode-win32-x64-min-ci
      ↓
../VSCode-win32-x64/     ← Complete Windows app
  Plaxio.exe
  resources/app/
    out/                 ← 18MB workbench bundle here
    extensions/
      ↓
Inno Setup (build/win32/code.iss)
      ↓
dist/PlaxioSetup-1.99.3.exe   ← Final installer
```

---

## Important rules

- **Node 20 is mandatory.** Node 22+ runs out of memory during gulp. Node 18 is incompatible with Electron 34.
- **Do not edit `src2/`** — it is auto-generated and will be overwritten.
- **Do not run `scripts/code.sh`** for production — it is for development only.
- **Do not run `gulp compile-build-with-mangling`** — it fails with OVERLAPPING edit on some files. Use the pre-built `out-vscode-min/` bundles instead.
- The macOS production app was built from this exact source and works correctly. The source code is correct. The Windows build only needs the native `.node` modules compiled on Windows.
