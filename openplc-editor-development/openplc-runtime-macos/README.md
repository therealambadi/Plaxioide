# OpenPLC Runtime — macOS Native Port

## Overview

This directory documents the complete patch set required to build and run the
[Autonomy-Logic/openplc-runtime](https://github.com/Autonomy-Logic/openplc-runtime)
natively on macOS (arm64 / x86_64) without Docker or root privileges.

**Upstream base commit:** `cb1060d` — "Merge pull request #150 from
Autonomy-Logic/feat/journaled-globals" (v4.1.8, 2025)

**Upstream repo:** https://github.com/Autonomy-Logic/openplc-runtime

---

## What Was Patched and Why

### 1. `core/src/plc_app/utils/utils.h` — Guard Linux-only headers

**Why:** `<sched.h>` and `<sys/mman.h>` exist on macOS but expose a different API surface. `mlockall`, `SCHED_FIFO`, and `sched_setscheduler` are unavailable or behave differently. The `HAS_REALTIME_FEATURES` guard controls all real-time features cleanly.

```c
#if !defined(__APPLE__) && !defined(__CYGWIN__) && !defined(__MSYS__)
#include <sched.h>
#include <sys/mman.h>
#define HAS_REALTIME_FEATURES 1
#else
#define HAS_REALTIME_FEATURES 0
#endif
```

### 2. `core/src/plc_app/utils/utils.c` — Guard `sys/prctl.h` + fix `parse_hex_string`

**Why (prctl guard):** `sys/prctl.h` is Linux-only. `PR_SET_TIMERSLACK` does not exist on macOS.

**Why (parse_hex_string fix — CRITICAL):**
The original loop after reading a hex pair was:
```c
while (*ptr != '\0' && *ptr != ' ')
    ptr++;
```
For compact hex strings (no space separators, e.g. `44000300000000000100000300`),
this consumed ALL remaining bytes after the first pair. Result: every FC 0x44
GET_LIST request decoded to 1 byte instead of N, `num_indexes` was always 0,
and the function returned `0x81 OUT_OF_BOUNDS` unconditionally.

**Fix:** Advance exactly 2 chars, then skip optional space:
```c
for (int _i = 0; _i < 2 && *ptr != '\0'; _i++) ptr++;
if (*ptr == ' ') ptr++;
```

### 3. `core/src/CMakeLists.txt` — macOS linker flags + Python lib dirs

**Why:** `-rdynamic` is GCC/Linux only. macOS linker requires `-Wl,-export_dynamic`.
Python framework library directories are needed for the Python loader on macOS.

### 4. `core/src/plc_app/plc_state_manager.cpp` — Two critical runtime fixes

#### Fix A: `pthread_cond_timedwait` CLOCK mismatch (macOS spin at 76k ticks/sec)

**Why:** On macOS, `pthread_condattr_setclock(CLOCK_MONOTONIC)` is unsupported.
The `done_cond` condvar is therefore initialized with `CLOCK_REALTIME`.
The original code initialized `next_tick` with `CLOCK_MONOTONIC`.

MONOTONIC epoch (seconds since boot) ≈ tens of thousands of seconds.
REALTIME epoch ≈ 1.78 billion seconds.

So every `pthread_cond_timedwait` deadline appeared already expired →
returned `ETIMEDOUT` immediately → dispatcher spun at ~76,000 ticks/sec
instead of the intended 50/sec.

At 76k ticks/sec with `task_divisor=20` (20ms period): tasks were released
3,800×/sec, causing persistent scan overruns → `debug_write_journal_drain()`
was never called → debugger forces were never applied.

**Fix:**
```cpp
#ifdef __APPLE__
    clock_gettime(CLOCK_REALTIME, &next_tick);
#else
    clock_gettime(CLOCK_MONOTONIC, &next_tick);
#endif
```

#### Fix B: Debug write journal drain (force-apply reliability on macOS)

**Why:** `SCHED_FIFO` is unavailable on macOS user-space. Even after Fix A,
scan bodies can occasionally overrun, keeping `g_tasks_running > 0` during
the dispatcher's normal drain window. Forces enqueued via FC 0x42 DEBUG_SET
would not be applied until the next window — which might never open under load.

**Fix:** Call `debug_write_journal_drain()` from inside the task worker body
after copy-out, guarded by `#ifdef __APPLE__`:
```cpp
#ifdef __APPLE__
    debug_write_journal_drain();
#endif
```

### 5. `core/src/plc_app/plcapp_manager.c` — Match `.dylib` extension

**Why:** `find_libplc_file()` only matched `*.so`. The compiled library on macOS
has a `.dylib` extension.

### 6. `core/src/plc_app/unix_socket.h` — Socket path

**Why:** `/run/runtime/` does not exist on macOS without Docker. Changed to `/tmp/`.
```c
#define SOCKET_PATH "/tmp/plc_runtime.socket"
```

### 7. `core/src/plc_app/utils/log.h` — Log socket path

**Why:** Same `/run/runtime/` issue.
```c
#define LOG_SOCKET_PATH "/tmp/log_runtime.socket"
```

### 8. `webserver/app.py` — Socket paths

**Why:** Hard-coded paths in `RuntimeManager` constructor.
```python
plc_socket="/tmp/plc_runtime.socket",
log_socket="/tmp/log_runtime.socket",
```

### 9. `webserver/config.py` — Runtime and data directories

**Why:** `get_runtime_dir()` and `get_persistent_data_dir()` defaulted to
`/run/runtime` for non-Linux. Changed to `/tmp` and `/tmp/openplc-runtime`.

### 10. `scripts/compile.sh` — `nproc` and `/proc/meminfo` are Linux-only

**Why:** `nproc` does not exist on macOS; `hw.logicalcpu` via `sysctl` is the
equivalent. `/proc/meminfo` does not exist; `hw.memsize` via `sysctl` is the
equivalent.

### 11. `scripts/Makefile.strucpp` — `.dylib` extension and `-dynamiclib` flag

**Why:** On macOS, shared libraries use `.dylib` extension and require
`-dynamiclib` instead of `-shared`. The `LIBPLC_EXT` variable is computed
once from `uname -s` and used consistently.

### 12. `scripts/compile-clean.sh` — Use `LIB_EXT` variable

**Why:** Hard-coded `.so` extension in `rm` and `mv` commands. Now uses a
platform-detected `LIB_EXT` variable consistent with `Makefile.strucpp`.

---

## How to Apply These Patches to a New Upstream Version

1. Clone upstream at the target commit:
   ```bash
   git clone https://github.com/Autonomy-Logic/openplc-runtime
   cd openplc-runtime
   git checkout <target-commit>
   ```

2. Apply the patch file (if stored as a `.patch`):
   ```bash
   git apply openplc-runtime-macos-cb1060d.patch
   ```

3. Or apply manually — each patch is small and the diffs are listed above.
   The most critical patches (in order of risk if missed) are:
   - **Patch 2** (parse_hex_string) — without this, FC 0x44 always returns OOB
   - **Patch 4A** (CLOCK_REALTIME) — without this, dispatcher spins at 76k/sec
   - **Patch 4B** (drain in task body) — without this, forces may not apply
   - **Patch 5** (.dylib matching) — without this, START always fails

4. If upstream changes `plc_state_manager.cpp` significantly, re-check:
   - The `init_done_cond()` function — ensure the `#ifndef __APPLE__` guard
     around `pthread_condattr_setclock` is still present
   - The `plc_cycle_thread()` function — ensure `CLOCK_REALTIME` is used for
     `next_tick` initialization on macOS
   - The `plc_task_thread()` worker body — ensure drain call is still inside
     the `try` block after `located_range` copy-out

---

## Build Instructions (macOS arm64)

### Prerequisites

```bash
brew install cmake ccache python@3.11
pip3 install flask flask-jwt-extended flask-socketio flask-cors eventlet
```

### Configure and build

```bash
cd openplc-runtime
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --target plc_main
```

### Start the runtime

The `plc_main` binary must be launched from the repo root (it looks for
`./build/` relative to CWD):

```bash
cd openplc-runtime
./build/plc_main &
python3 -m webserver.app &
```

### API credentials (default)

```
username: volt
password: volt123
```

HTTPS on port `8443`, self-signed cert — use `rejectUnauthorized: false`
in any HTTPS/Socket.IO client.

---

## End-to-End Test Sequence (motor-start proof)

After upload + compile + start-plc, run:
```bash
node /tmp/debug-final.mjs
```

Expected output:
```
── Read #1 (baseline) ──
  scan=N  PB_START=false  PB_STOP=false  MOTOR_RUN=false

Forcing PB_START=TRUE (FC 0x42)...
  force result: 0x7E SUCCESS

── Read #2 (after forcing PB_START=TRUE) ──
  scan=N+15  PB_START=true  PB_STOP=false  MOTOR_RUN=true

── Read #3 (after releasing PB_START force) ──
  scan=N+25  PB_START=true  MOTOR_RUN=true

✅ MOTOR_RUN = TRUE after forcing PB_START=TRUE
✅ Full round-trip confirmed: PB_START force → MOTOR_RUN coil latched
✅ MOTOR_RUN stays TRUE after releasing PB_START (motor-start latching logic working)
```

---

## Known macOS Limitations

| Feature | Status |
|---|---|
| `SCHED_FIFO` real-time scheduling | Not available (user-space limitation) |
| `clock_nanosleep(TIMER_ABSTIME)` | Falls back to `nanosleep` |
| `mlockall` memory locking | Not available |
| `PR_SET_TIMERSLACK` | Linux-only, not available |

None of these affect functionality for development and testing. The drain-in-task-body workaround (Patch 4B) compensates for the missing SCHED_FIFO drain window.

---

## Debug Protocol Reference

| FC | Name | Direction | Purpose |
|---|---|---|---|
| `0x41` | DEBUG_INFO | R | Returns array count + elem count per array |
| `0x42` | DEBUG_SET | W | Force/unforce a variable |
| `0x43` | DEBUG_GET | R | Contiguous range read from one array |
| `0x44` | DEBUG_GET_LIST | R | Batch read: arbitrary (arr, elem) list |
| `0x45` | DEBUG_GET_MD5 | R | Program MD5 for debug-map sync |

**Status bytes:** `0x7E` SUCCESS, `0x81` OUT_OF_BOUNDS, `0x82` OUT_OF_MEMORY, `0x83` NOT_LOADED

**FC 0x44 request:** `[0x44][count_hi][count_lo]` then N×3-byte entries `[arr][elem_hi][elem_lo]`

**FC 0x44 response:** `[0x44][0x7E][last_idx_hi][last_idx_lo][scan_ctr: 4B BE][payload_sz: 2B BE][data...]`

**Note:** `bytes_to_hex_string()` outputs space-separated hex. Strip spaces before `Buffer.from(hex, 'hex')` in Node.js.
