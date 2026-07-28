---
name: plc-build
description: Rebuild React bundle, verify out/ timestamp updated, clear cache, and relaunch. Use after any React source edit.
---

Run the mandatory Volt build sequence in order:

1. Run: `cd src/vs/workbench/contrib/void/browser/react && node build.js`
2. Check the modification timestamp of `out/vs/workbench/contrib/void/browser/react/out/` entry files. They must be NEWER than your edit.
3. If timestamps did NOT change — STOP. Do not proceed. Report that the build did not update the bundle and investigate the entry point.
4. If timestamps updated — run `scripts/buildandrun.sh` to clear cache and relaunch.
5. After relaunch, run /check-console to triage any runtime errors before declaring the change done.
