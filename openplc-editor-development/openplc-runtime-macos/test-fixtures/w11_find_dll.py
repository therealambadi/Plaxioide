import sys

# W11: Make plcapp_manager.c find libplc_*.dll on MSYS2/Cygwin in addition to .so/.dylib.
# On MSYS2, g++ -shared produces a file named exactly as specified by -o (e.g., new_libplc.so)
# BUT the loader may produce new_libplc.dll depending on the toolchain. To be safe, also
# accept .dll in the filename scan.

path = 'core/src/plc_app/plcapp_manager.c'
src = open(path).read()

# The relevant line: look for any file starting with "libplc_" and containing ".so"
OLD = '        if (strncmp(entry->d_name, "libplc_", 7) == 0 && strstr(entry->d_name, ".so") != NULL)'
NEW = '        if (strncmp(entry->d_name, "libplc_", 7) == 0 && (strstr(entry->d_name, ".so") != NULL || strstr(entry->d_name, ".dll") != NULL))'

if OLD not in src:
    print('W11 ERROR: anchor not found', file=sys.stderr)
    idx = src.find('libplc_')
    print('context:', repr(src[max(0,idx-100):idx+200]) if idx >= 0 else '(not found)')
    sys.exit(1)

src = src.replace(OLD, NEW, 1)
open(path, 'w').write(src)
print('W11 applied: .dll accepted alongside .so in libplc search')

# Also add .dll to the dylib check if present
OLD2 = '        if (strncmp(entry->d_name, "libplc_", 7) == 0 && strstr(entry->d_name, ".dylib") != NULL)'
if OLD2 in src:
    NEW2 = '        if (strncmp(entry->d_name, "libplc_", 7) == 0 && (strstr(entry->d_name, ".dylib") != NULL || strstr(entry->d_name, ".dll") != NULL))'
    src2 = open(path).read().replace(OLD2, NEW2, 1)
    open(path, 'w').write(src2)
    print('W11 dylib variant also patched')

print('W11 DONE')
