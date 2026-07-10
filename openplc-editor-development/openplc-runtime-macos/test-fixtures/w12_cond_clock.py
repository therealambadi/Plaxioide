import sys, re

# W12: On MSYS2/Cygwin, pthread_condattr_setclock(CLOCK_MONOTONIC) is silently
# ignored by winpthread — the condvar stays on CLOCK_REALTIME. When next_tick
# uses CLOCK_MONOTONIC the timedwait deadline never fires, the scan cycle hangs,
# and the watchdog kills the PLC after 2 seconds.
#
# The macOS base patch already guards setclock with #ifndef __APPLE__ and chooses
# CLOCK_REALTIME for next_tick on Apple. W12 extends both guards to also cover
# __CYGWIN__ and __MSYS__ (MSYS2 predefined macros).

path = 'core/src/plc_app/plc_state_manager.cpp'
src = open(path).read()

# Patch 1: extend existing #ifndef __APPLE__ guard around setclock call
OLD1 = '#ifndef __APPLE__\n    pthread_condattr_setclock(&cattr, CLOCK_MONOTONIC);\n#endif'
NEW1 = '#if !defined(__APPLE__) && !defined(__CYGWIN__) && !defined(__MSYS__)\n    pthread_condattr_setclock(&cattr, CLOCK_MONOTONIC);\n#endif'

if OLD1 not in src:
    print('W12 ERROR: condattr setclock __APPLE__ guard not found', file=sys.stderr)
    idx = src.find('pthread_condattr_setclock')
    if idx >= 0:
        print('context:', repr(src[max(0, idx-150):idx+200]))
    sys.exit(1)

src = src.replace(OLD1, NEW1, 1)
print('W12 patch 1: condattr setclock guard extended to MSYS2/Cygwin')

# Patch 2: extend #ifdef __APPLE__ block for next_tick to cover MSYS2/Cygwin.
# Only the #ifdef line and the two clock_gettime lines are stable anchors;
# the comment in between may vary. Use a regex replace on the guard header only.
# Target: '#ifdef __APPLE__' -> '#if defined(__APPLE__) || defined(__CYGWIN__) || defined(__MSYS__)'
# but only if it's the one immediately before clock_gettime(CLOCK_REALTIME, &next_tick)
pattern = r'(#ifdef __APPLE__\n)((?:.*\n)*?)(    clock_gettime\(CLOCK_REALTIME, &next_tick\);)'
def replace_apple_guard(m):
    return '#if defined(__APPLE__) || defined(__CYGWIN__) || defined(__MSYS__)\n' + m.group(2) + m.group(3)

new_src, count = re.subn(pattern, replace_apple_guard, src, count=1)
if count == 0:
    print('W12 ERROR: #ifdef __APPLE__ / CLOCK_REALTIME next_tick block not found', file=sys.stderr)
    idx = src.find('clock_gettime(CLOCK_REALTIME, &next_tick)')
    if idx >= 0:
        print('context:', repr(src[max(0, idx-200):idx+100]))
    sys.exit(1)

src = new_src
print('W12 patch 2: next_tick CLOCK_REALTIME block extended to MSYS2/Cygwin')

open(path, 'w').write(src)
print('W12 DONE')
