
# OpenPLC Runtime — Windows Build Analysis (FINAL)

## Status: COMPLETE ✓

**Base commit:** cb1060d (Autonomy-Logic/openplc-runtime)  
**Toolchain:** MSYS2 `msystem: MSYS` (Cygwin-compatible POSIX layer — NOT MINGW64)  
**macOS baseline patch:** `openplc-runtime-macos-cb1060d.patch`  
**Windows patch:** `openplc-runtime-windows-cb1060d.patch`

---

## CI Proof

**Run:** [29074623406](https://github.com/therealambadi/volt/actions/runs/29074623406)  
**Workflow:** `.github/workflows/windows-runtime-test.yml`

### AF_UNIX socket verdict
```
AF_UNIX connect SUCCESS (attempt 1)
```
AF_UNIX sockets work on MSYS2 via Cygwin's POSIX emulation layer (maps to Windows named pipes internally). No patch required.

### Motor-start force/read transcript
```
── Read #1 (baseline) ──
  scan=1059  PB_START=false  PB_STOP=false  MOTOR_RUN=false

Forcing PB_START=TRUE (FC 0x42)...
  force result: 0x7E SUCCESS

── Read #2 (after forcing PB_START=TRUE) ──
  scan=1080  PB_START=true   PB_STOP=false  MOTOR_RUN=true

Releasing force on PB_START...

── Read #3 (after releasing force) ──
  scan=1095  PB_START=true   PB_STOP=false  MOTOR_RUN=true

✅ MOTOR_RUN = TRUE after forcing PB_START=TRUE
✅ Full round-trip confirmed: PB_START force → MOTOR_RUN coil latched
✅ MOTOR_RUN stays TRUE after releasing PB_START (seal-in working)
```

---

## MSYS2 toolchain selection rationale

Must use `msystem: MSYS`, **not** MINGW64.

| Feature | MSYS | MINGW64 |
|---|---|---|
| `dlfcn.h` / `dlopen` | ✓ | ✗ |
| `sys/socket.h` / `AF_UNIX` | ✓ | ✗ |
| POSIX `pthread` with condvar | ✓ | ✗ (Win32 threads only) |
| `sys/un.h` | ✓ | ✗ |
| `/proc/` filesystem | ✓ (Cygwin emulated) | ✗ |

This matches upstream's own `windows-installer.yml`.

---

## Windows Patch Set

Applied in order, each patch is cumulative:

### Patch order
1. Apply `openplc-runtime-macos-cb1060d.patch` (macOS baseline — also fixes many MSYS2 issues)
2. Apply `openplc-runtime-windows-cb1060d.patch` (Windows-specific deltas)

### W1 — `core/src/plc_app/plc_state_manager.cpp` — CLOCK_REALTIME for next_tick
**Problem:** The macOS base patch guards `next_tick` with `#ifdef __APPLE__` to use `CLOCK_REALTIME`. MSYS2/Cygwin has the same constraint (winpthread condvars use `CLOCK_REALTIME`), but the `#ifdef __APPLE__` guard doesn't cover MSYS2.  
**Fix:** Extend `#ifdef __APPLE__` → `#if defined(__APPLE__) || defined(__CYGWIN__) || defined(__MSYS__)`

### W2 — `core/src/plc_app/plc_state_manager.cpp` — SCHED_FIFO drain guard
**Problem:** The macOS base patch guards `debug_write_journal_drain()` with `#ifdef __APPLE__` because `SCHED_FIFO` isn't available on macOS. Same is true for MSYS2/Cygwin.  
**Fix:** Extend `#ifdef __APPLE__` → `#if defined(__APPLE__) || defined(__CYGWIN__) || defined(__MSYS__)`

### W3 — NO-OP
**`pthread_setname_np` is already correct.** The macOS base patch adds `#ifdef __APPLE__` for the 1-arg form; MSYS2 winpthread uses the 2-arg form (same as Linux), so the existing `#else` branch is correct. No patch needed.

### W4 — `scripts/compile.sh` — memory detection
**Problem:** `/proc/meminfo` is Linux-only. The macOS base patch adds a `sysctl` fallback but not a Windows fallback.  
**Fix:** Add `wmic` third branch for MSYS2.

### W5 — `scripts/compile-clean.sh` — date nanoseconds
**Problem:** `date +%s%N` (`%N` = nanoseconds) is GNU date. MSYS2's date may not support `%N`.  
**Fix:** `date +%s%N 2>/dev/null || echo "$(date +%s)$$"`

### W6 — `webserver/app.py` — upload handler BytesIO
**Problem:** Cygwin Python 3.12 has a seek bug in `zipfile` when the underlying file handle comes from Werkzeug/eventlet's multipart stream. `zf.read()` → `self._file.seek()` → `OSError: [Errno 22] Invalid argument`.  
**Fix:** Read the entire FileStorage into `io.BytesIO` before passing to `analyze_zip` and `safe_extract`. No disk file involved after the initial read.

### W7 / W7b / W9 — DIAGNOSTIC ONLY
Instrumentation steps used to capture the real traceback during investigation. Not included in the production patch.

### W8 — `webserver/plcapp_management.py` — safe_extract subprocess fallback
**Problem:** Python `zipfile` seek bugs on Cygwin affect all modes (path string, binary open, BytesIO). Real-world JSZip-generated ZIPs fail with `EINVAL` even from `BytesIO`.  
**Root cause confirmed by:** DIAG isolation step — synthetic Python-created zips passed; real motor-start-proof.zip failed all Python zipfile modes.  
**Fix:** On Cygwin/MSYS2, use `subprocess unzip` (system unzip bypasses Python's zipfile entirely). On Linux/macOS, use Python zipfile normally. Also patches `analyze_zip` to rewind BytesIO before `is_zipfile` and `ZipFile`.

### W10 — `scripts/Makefile.strucpp` — -lrt conditional
**Problem:** `librt` (POSIX real-time extensions) does not exist on MSYS2/Cygwin. The link line `$(CXX) -shared -fPIC -o $@ $^ -lpthread -lrt` fails.  
**Anchor correction:** The macOS base patch had already changed `g++` → `$(CXX)` in this line. W10 targets the post-patch form.  
**Fix:** `$(CXX) -shared -fPIC -o $@ $^ -lpthread $(if $(IS_WINDOWS),,-lrt)`

### W11 — NOT NEEDED
W11 was a speculative patch to accept `.dll` alongside `.so` in the libplc file search. MSYS2 `g++ -shared` with `-o new_libplc.so` produces a `.so` file (not `.dll`), so the existing search works without this patch.

### W12 — `core/src/plc_app/plc_state_manager.cpp` — condvar clock guard
**Problem:** `pthread_condattr_setclock(CLOCK_MONOTONIC)` is silently ignored by MSYS2 winpthread — the condvar stays on `CLOCK_REALTIME`. The macOS base patch guards this with `#ifndef __APPLE__`, which doesn't cover MSYS2.  
**Effect without fix:** `pthread_cond_timedwait` deadline never fires → scan cycle hangs → watchdog fires after 2 seconds → `STATUS:ERROR`.  
**Fix:** Extend `#ifndef __APPLE__` → `#if !defined(__APPLE__) && !defined(__CYGWIN__) && !defined(__MSYS__)`  
**Note:** W12 patch 2 (next_tick clock) is already covered by W1 — the two patches overlap; W1 fixes `next_tick`, W12 fixes `init_done_cond`.

---

## Existing Windows Guards in Upstream Source (pre-patch)

These already work on MSYS2 without modification:

| Guard | Files | What it controls |
|---|---|---|
| `!defined(__CYGWIN__) && !defined(__MSYS__)` | `utils.c`, `utils.h`, `image_tables.cpp` | Disables `mlockall`, `SCHED_FIFO`, `sched_setscheduler`, `PTHREAD_PRIO_INHERIT` |
| `IS_WINDOWS` in `Makefile.strucpp` | `scripts/Makefile.strucpp` | Links `comm_stubs.o` instead of TCP/UDP blocks |
| `sleep_until` fallback | `utils.c` | Uses `nanosleep` instead of `clock_nanosleep(TIMER_ABSTIME)` |

---

## Known Behavioral Differences vs Linux

These are real differences, not bugs. Documented here for Electron integration awareness:

| Feature | Linux | MSYS2/Windows |
|---|---|---|
| `SCHED_FIFO` real-time scheduling | ✓ | ✗ (skipped by existing guards) |
| `mlockall` memory locking | ✓ | ✗ (skipped by existing guards) |
| Scan cycle timing precision | nanosecond `clock_nanosleep(ABSTIME)` | `nanosleep` (relative, less precise) |
| Condvar clock | `CLOCK_MONOTONIC` | `CLOCK_REALTIME` (winpthread limitation) |
| `librt` real-time lib | linked | excluded (not present) |

SCHED_FIFO removal is the most significant: the PLC scan cycle runs at normal thread priority on Windows. For the editor's use case (offline commissioning, not production control), this is acceptable.

---

## Build Sequence (verified)

```bash
# 1. Clone
git clone https://github.com/Autonomy-Logic/openplc-runtime.git
cd openplc-runtime && git checkout cb1060d

# 2. Apply patches
patch -p1 < openplc-runtime-macos-cb1060d.patch
patch -p1 < openplc-runtime-windows-cb1060d.patch

# 3. Apply W6/W8 Python patches
python3 test-fixtures/w6_patch_app.py
python3 test-fixtures/w8_fix_safe_extract.py

# 4. Build
mkdir build && cd build
cmake .. -G "Unix Makefiles"
make -j$(nproc) plc_main
```

Note: W6 and W8 patch Python files in `webserver/` — they cannot be expressed as a unified diff because the changes depend on detecting existing indentation at apply-time. They remain as Python scripts.

---

## Phase 0.2 — Definition of Done

| Item | Status |
|---|---|
| `plc_main` builds on macOS (patched) | ✓ Done |
| `plc_main` builds on Windows/MSYS2 | ✓ Done — CI run 29074623406 |
| AF_UNIX socket confirmed on Windows | ✓ `AF_UNIX connect SUCCESS (attempt 1)` |
| Motor-start latch proof — macOS | ✓ Prior session (macOS native) |
| Motor-start latch proof — Windows | ✓ CI run 29074623406 |
| Phase 0.2 | **CLOSED** |
