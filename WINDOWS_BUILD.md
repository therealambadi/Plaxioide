# Plaxio Windows Build Guide

## Prerequisites (install once)

| Tool | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/en/download) | **20 LTS** | Must be v20.x — Electron 34 embeds Node 20 |
| [Git for Windows](https://git-scm.com/download/win) | Latest | — |
| [Visual Studio 2022](https://visualstudio.microsoft.com/downloads/) | 2022 | Select **"Desktop development with C++"** workload during install |
| [Python 3.11](https://www.python.org/downloads/release/python-3119/) | 3.11.x | Check **"Add Python to PATH"** during install. Do NOT use 3.14 — it breaks node-gyp |
| [Inno Setup 6](https://jrsoftware.org/isdl.php) | 6.x | For creating the `.exe` installer |

---

## Step 1 — Clone the repo

```cmd
git clone https://github.com/therealambadi/volt.git
cd volt
git checkout ide-clean
```

---

## Step 2 — Install dependencies

Open **Command Prompt** (NOT Git Bash, NOT PowerShell — use `cmd.exe`).

```cmd
npm ci
```

This takes 10–15 minutes. It installs all node_modules including native modules compiled for Windows.

---

## Step 3 — Build

Run all of these in order from the repo root in **Command Prompt**:

```cmd
npm run buildreact
npx gulp compile-build-with-mangling
npx gulp compile-extensions-build
npx gulp minify-vscode
npx gulp vscode-win32-x64-min-ci
```

Output lands in `..\VSCode-win32-x64\` (one folder up from the repo).

---

## Step 4 — Create installer

```cmd
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" /DRepoDir="%CD%" /DSourceDir="..\VSCode-win32-x64" /DOutputDir="%CD%\dist" build\win32\code.iss
```

Installer is created at `dist\PlaxioSetup.exe`.

---

## Troubleshooting

### `spawnSync cmd.exe ENOENT` during npm ci
- You are running npm from Git Bash or PowerShell. Switch to **cmd.exe**.

### `gyp ERR! find VS` during npm ci
- Visual Studio 2022 is not installed, or the **"Desktop development with C++"** workload is missing.
- Open Visual Studio Installer → Modify → add the C++ workload.

### `Python version X found` — gyp picks wrong Python
- Python 3.14 is being picked up instead of 3.11.
- Run `npm config set python C:\Path\To\Python311\python.exe` then retry.

### `SkuNotAvailable` (Azure VM — not relevant for local builds)
- Ignore. Azure for Students has capacity restrictions. Build locally instead.

---

## Key files (Plaxio customizations)

| File | What it does |
|---|---|
| `src/.../plaxioAuthService.ts` | Supabase auth + token refresh via GoTrue |
| `src/.../plaxioGateService.ts` | AI credits fetch + retry on token expiry |
| `src/.../plcEditorPane.ts` | Tag Monitor / Verify tabs, Plaxio title logo |
| `src/.../plcExplorerPanel.ts` | Sidebar DOM injection (Explorer + LIBRARY panels) |
| `src/.../react/src/sidebar-tsx/SidebarChat.tsx` | Chat suggestions |
| `src/.../media/void.css` | Plaxio branding styles |
| `product.json` | App name, version, publisher set to Plaxio |
| `build/win32/code.iss` | Inno Setup script for Windows installer |

---

## Branch

All Plaxio work lives on **`ide-clean`** branch in `therealambadi/volt`.

```cmd
git checkout ide-clean
git pull origin ide-clean
```

Always pull latest before building.
