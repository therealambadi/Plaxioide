import sys
path = 'core/src/plc_app/plc_state_manager.cpp'
src = open(path).read()
old = '    FILE *file = fopen("/proc/meminfo", "r");'
new = ('#ifdef __MSYS__\n'
       '    // Use wmic to read available memory on Windows/MSYS2\n'
       '    FILE *file = popen("wmic OS get FreePhysicalMemory /Value 2>/dev/null", "r");\n'
       '#else\n'
       '    FILE *file = fopen("/proc/meminfo", "r");\n'
       '#endif')
if old in src:
    open(path, 'w').write(src.replace(old, new, 1))
    print('W3: OK')
else:
    print('W3: anchor not found or already applied', file=sys.stderr)
