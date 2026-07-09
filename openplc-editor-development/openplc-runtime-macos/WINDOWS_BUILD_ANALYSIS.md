# OpenPLC Runtime — Windows Build Analysis

## Status: Not Yet Tested (No Windows Machine Available)

This document records the complete pre-flight analysis of what is required to
build and run the runtime on Windows. **No live Windows build has been attempted.**
All findings are from code inspection of the patched macOS source tree.

---

## Intended Windows Build Path: MSYS2 + MinGW-w64

The upstream repo already has explicit MSYS2/Cygwin guards throughout the C/C++
source. The intended route is:

1. Install MSYS2 (https://www.msys2.org)
2. Install MinGW-w64 toolchain inside MSYS2: `pacman -S mingw-w64-x86_64-gcc cmake`
3. Build exactly as on Linux/macOS: `cmake .. && make`

There is **no MSVC path** in CMakeLists.txt. The entire build system assumes a
POSIX-compatible toolchain. MSVC is not a supported build target.

---

## Existing Windows Guards in Source

The upstream codebase already handles MSYS2/Cygwin for:

| Guard | Files | What it controls |
|---|---|---|
| `!defined(__CYGWIN__) && !defined(__MSYS__)` | `utils.c`, `utils.h`, `image_tables.cpp` | Disables `mlockall`, `SCHED_FIFO`, `sched_setscheduler`, `PTHREAD_PRIO_INHERIT` |
| `IS_WINDOWS` in `Makefile.strucpp` | `scripts/Makefile.strucpp` | Links `comm_stubs.o` instead of TCP/UDP communication blocks |
| `sleep_until` fallback | `utils.c` | Uses `nanosleep` instead of `clock_nanosleep(TIMER_ABSTIME)` |
| `SCHED_FIFO` guard in `plc_state_manager.cpp` | `plc_state_manager.cpp` | Skips `sched_setschedparam` |

---

## Predicted Breakages and Required Patches

### 1. `pthread_cond_timedwait` CLOCK mismatch (same bug as macOS — CRITICAL)

**Predicted:** The macOS CLOCK_REALTIME fix is also needed on MSYS2.

**Why:** MSYS2's `winpthread` implementation (`libwinpthread-1.dll`) uses the
Windows `GetSystemTimeAsFileTime` epoch for the condvar timeout, which maps to
CLOCK_REALTIME. If `pthread_condattr_setclock(CLOCK_MONOTONIC)` is silently
ignored or rejected on MSYS2 (as it is on macOS), the same dispatcher spin
at CPU max speed would occur.

**The macOS fix's `#ifdef __APPLE__` guard does NOT cover MSYS2.**

Required extension:
```cpp
#if defined(__APPLE__) || defined(__CYGWIN__) || defined(__MSYS__)
    clock_gettime(CLOCK_REALTIME, &next_tick);
#else
    clock_gettime(CLOCK_MONOTONIC, &next_tick);
#endif
```

### 2. Debug write journal drain (same issue as macOS — CRITICAL)

**Predicted:** Same fix needed for MSYS2 for the same reason (no SCHED_FIFO
→ dispatcher drain window may not open → forces not applied).

Required extension of the `#ifdef __APPLE__` drain guard:
```cpp
#if defined(__APPLE__) || defined(__CYGWIN__) || defined(__MSYS__)
    debug_write_journal_drain();
#endif
```

### 3. `pthread_setname_np` signature (same as macOS)

**Predicted:** MSYS2's `winpthread` uses the 1-argument form
`pthread_setname_np(name)` like macOS, not the 2-argument Linux form
`pthread_setname_np(tid, name)`.

Current macOS patch:
```cpp
#ifdef __APPLE__
    pthread_setname_np(ctx->name);
#else
    pthread_setname_np(pthread_self(), ctx->name);
#endif
```

Required extension:
```cpp
#if defined(__APPLE__) || defined(__CYGWIN__) || defined(__MSYS__)
    pthread_setname_np(ctx->name);
#else
    pthread_setname_np(pthread_self(), ctx->name);
#endif
```

### 4. `AF_UNIX` sockets on Windows

**Status:** MSYS2/MinGW uses Cygwin's POSIX socket emulation. `AF_UNIX` sockets
are supported via this emulation layer — they map to Windows named pipes
internally. The socket path `/tmp/plc_runtime.socket` maps to a Windows pipe
under `C:\msys64\tmp\` (or wherever MSYS2's `/tmp` maps).

**The macOS `/tmp` socket path patches (Patches 6, 7, 8) already handle this
path for MSYS2** — the `config.py` non-Linux branch already falls through to
`/tmp` after our macOS patch.

**However:** MSYS2's `/tmp` is NOT `C:\Windows\Temp`. The webserver Python
process (running native Windows Python, not MSYS2 Python) and the C runtime
(running under MSYS2) must agree on the socket path. If the Python process
is launched as a native Windows Python executable, it will try to open the
Cygwin-virtualized `/tmp/plc_runtime.socket` which doesn't exist in the
Windows filesystem namespace.

**Resolution options:**
1. Run both Python webserver and `plc_main` inside MSYS2 (consistent paths)
2. Use a named pipe path that both can agree on: `\\.\pipe\plc_runtime`

### 5. `compile.sh` and `compile-clean.sh` — `date +%s%N` not available

**Predicted:** `date +%s%N` (nanosecond timestamps) is GNU date. MSYS2 ships
GNU coreutils but `%N` may not be available on older MSYS2 installations.

**Impact:** `compile-clean.sh` line `TIMESTAMP=$(date +%s%N)` fails.
**Fix:** Fall back to `date +%s%3N` (milliseconds) or `date +%s$$` (seconds+PID).

### 6. `nproc` — available on MSYS2

**Status:** MSYS2 ships `nproc` via `util-linux`. The `compile.sh` fix
(`nproc 2>/dev/null || sysctl -n hw.logicalcpu`) will work on MSYS2 since
`nproc` succeeds.

### 7. `/proc/meminfo` — NOT available on MSYS2

**Status:** MSYS2 does NOT provide `/proc/meminfo`. Our macOS fix already
handles this with the `sysctl` fallback, but `sysctl -n hw.memsize` is macOS-only.

**Required Windows-specific addition to `compile.sh`:**
```bash
if [ -f /proc/meminfo ]; then
    MEM_KB=$(awk '/^MemTotal:/{print $2}' /proc/meminfo)
elif command -v sysctl >/dev/null 2>&1 && sysctl -n hw.memsize >/dev/null 2>&1; then
    MEM_KB=$(( $(sysctl -n hw.memsize) / 1024 ))
else
    # MSYS2/Windows fallback: query via wmic or use a safe default
    MEM_KB=$(wmic memorychip get capacity 2>/dev/null | awk 'NR>1{sum+=$1} END{printf "%d", sum/1024}' || echo 4194304)
fi
```

### 8. CMakeLists.txt — `target_link_options` on MSYS2/MinGW

**Status:** MSYS2/MinGW uses the GNU linker (`ld`), so `-rdynamic` works.
Our macOS patch only changes the Apple branch — the else branch stays as
`-rdynamic` which is correct for MSYS2/MinGW.

### 9. `Makefile.strucpp` — `.dll` extension on Windows

**Status:** Our macOS patch added `IS_MACOS` → `.dylib`. The Windows/MSYS2 path
falls through to `.so` because `IS_WINDOWS` is set but only used for `COMM_STUB_OBJ`.

**The `.so` extension is correct for Cygwin/MSYS2** — MinGW shared libraries
use `.dll` but Cygwin/MSYS2 programs that use `dlopen()` use `.so` by
convention (the extension is just a naming choice since `dlopen` resolves the
actual PE/COFF DLL regardless).

**Status: no change needed.**

---

## Summary of Required New Patches for Windows (MSYS2)

| Patch | File | Change |
|---|---|---|
| W1 | `plc_state_manager.cpp` | Extend CLOCK_REALTIME guard to `__CYGWIN__ || __MSYS__` |
| W2 | `plc_state_manager.cpp` | Extend drain guard to `__CYGWIN__ || __MSYS__` |
| W3 | `plc_state_manager.cpp` | Extend `pthread_setname_np` guard to `__CYGWIN__ || __MSYS__` |
| W4 | `scripts/compile.sh` | Add MSYS2 `wmic`-based memory query |
| W5 | `scripts/compile-clean.sh` | Guard `date +%s%N` for MSYS2 compatibility |

Most of the hard work (POSIX socket paths, Python config paths, `.so` extension,
`IS_WINDOWS` comm stubs) is **already handled** by the macOS patches and the
existing upstream MSYS2 guards.

---

## What Needs To Be Done

1. Obtain access to a Windows 10/11 machine with MSYS2 installed
2. Apply the macOS patch (`openplc-runtime-macos-cb1060d.patch`) first
3. Apply the 5 additional Windows patches listed above
4. Attempt `cmake .. && cmake --build . --target plc_main`
5. Paste real build output
6. If build succeeds: run the same motor-start proof sequence
7. Document the complete Windows patch as `openplc-runtime-windows-cb1060d.patch`

---

## Evidence Standard Required (from instructions)

Same as macOS — no assumptions from macOS result:

```
── Read #1 (baseline) ──
  scan=N  PB_START=false  PB_STOP=false  MOTOR_RUN=false

Forcing PB_START=TRUE (FC 0x42)...
  force result: 0x7E SUCCESS

── Read #2 (after forcing PB_START=TRUE) ──
  scan=N+15  PB_START=true  MOTOR_RUN=true

── Read #3 (after releasing PB_START force) ──
  MOTOR_RUN=true  (latched)

✅ MOTOR_RUN stays TRUE after releasing PB_START
```

This has NOT been obtained. Windows verification remains open.
