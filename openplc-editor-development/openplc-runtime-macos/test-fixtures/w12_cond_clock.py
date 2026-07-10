import sys

# W12: On MSYS2/Cygwin, pthread_condattr_setclock(CLOCK_MONOTONIC) is silently
# ignored by winpthread — the condvar still uses CLOCK_REALTIME. When next_tick
# is set with CLOCK_MONOTONIC, the timedwait deadline never fires (clock mismatch)
# and the scan cycle hangs forever, causing the watchdog to kill the PLC.
#
# Fix: guard the CLOCK_MONOTONIC condattr_setclock with the same __APPLE__ guard
# as the original macOS patch, extending it to also skip __CYGWIN__/__MSYS__.
# On MSYS2, fall through to the default CLOCK_REALTIME condvar.
# Also update the next_tick initialization to use CLOCK_REALTIME on MSYS2
# (already done by W1, but the done_cond init needs the matching fix too).

path = 'core/src/plc_app/plc_state_manager.cpp'
src = open(path).read()

# Patch 1: guard CLOCK_MONOTONIC condattr_setclock to skip on Cygwin/MSYS2
OLD1 = '''static void init_done_cond(void)
{
    pthread_condattr_t cattr;
    pthread_condattr_init(&cattr);
    pthread_condattr_setclock(&cattr, CLOCK_MONOTONIC);
    pthread_cond_init(&done_cond, &cattr);
    pthread_condattr_destroy(&cattr);
}'''

NEW1 = '''static void init_done_cond(void)
{
    pthread_condattr_t cattr;
    pthread_condattr_init(&cattr);
#if !defined(__APPLE__) && !defined(__CYGWIN__) && !defined(__MSYS__)
    /* CLOCK_MONOTONIC condvar supported on Linux only.
     * macOS/Cygwin/MSYS2 winpthread does not support CLOCK_MONOTONIC for
     * condvars — setclock is either unavailable or silently ignored.
     * Leave the default CLOCK_REALTIME on those platforms. */
    pthread_condattr_setclock(&cattr, CLOCK_MONOTONIC);
#endif
    pthread_cond_init(&done_cond, &cattr);
    pthread_condattr_destroy(&cattr);
}'''

if OLD1 not in src:
    print('W12 ERROR: init_done_cond anchor not found', file=sys.stderr)
    idx = src.find('init_done_cond')
    if idx >= 0:
        print('context:', repr(src[idx:idx+400]))
    sys.exit(1)

src = src.replace(OLD1, NEW1, 1)
print('W12 patch 1: init_done_cond guarded for MSYS2/Cygwin')

# Patch 2: the initial next_tick clock_gettime must match the condvar clock.
# On MSYS2/Cygwin the condvar is CLOCK_REALTIME, so next_tick must also use
# CLOCK_REALTIME. W1 may have already patched this — check.
OLD2 = '    clock_gettime(CLOCK_MONOTONIC, &next_tick);'
NEW2 = '''#if defined(__CYGWIN__) || defined(__MSYS__)
    clock_gettime(CLOCK_REALTIME, &next_tick);
#else
    clock_gettime(CLOCK_MONOTONIC, &next_tick);
#endif'''

# Only patch if it hasn't been patched by W1 already
if OLD2 in src:
    src = src.replace(OLD2, NEW2, 1)
    print('W12 patch 2: next_tick uses CLOCK_REALTIME on MSYS2/Cygwin')
else:
    print('W12 patch 2: next_tick already patched (W1)')

open(path, 'w').write(src)
print('W12 DONE')
