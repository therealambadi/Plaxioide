import sys
path = 'core/src/plc_app/plc_state_manager.cpp'
src = open(path).read()
old = ('#ifdef __APPLE__\n'
       '    /* On macOS, pthread_cond_timedwait uses CLOCK_REALTIME (the condvar was\n'
       '     * initialized without pthread_condattr_setclock, which macOS doesn\'t\n'
       '     * support for CLOCK_MONOTONIC).  Use CLOCK_REALTIME here to match. */\n'
       '    clock_gettime(CLOCK_REALTIME, &next_tick);\n'
       '#else\n'
       '    clock_gettime(CLOCK_MONOTONIC, &next_tick);\n'
       '#endif')
new = ('#if defined(__APPLE__) || defined(__CYGWIN__) || defined(__MSYS__)\n'
       '    /* macOS/MSYS2/Cygwin: pthread_cond_timedwait uses CLOCK_REALTIME.\n'
       '     * pthread_condattr_setclock(CLOCK_MONOTONIC) is unsupported. */\n'
       '    clock_gettime(CLOCK_REALTIME, &next_tick);\n'
       '#else\n'
       '    clock_gettime(CLOCK_MONOTONIC, &next_tick);\n'
       '#endif')
if old in src:
    open(path, 'w').write(src.replace(old, new))
    print('W1: OK')
else:
    print('W1: anchor not found or already applied', file=sys.stderr)
    idx = src.find('CLOCK_REALTIME')
    if idx >= 0:
        print(f'  CLOCK_REALTIME context: {repr(src[max(0,idx-50):idx+100])}', file=sys.stderr)
