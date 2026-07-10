import sys

# W10: Remove -lrt from Makefile.strucpp link line on Windows (MSYS2/Cygwin).
# -lrt (POSIX real-time library) does not exist on MSYS2/Cygwin. The Makefile
# already has IS_WINDOWS detection; use it to conditionally exclude -lrt.

path = 'scripts/Makefile.strucpp'
src = open(path).read()

OLD = '\tg++ -shared -fPIC -o $@ $^ -lpthread -lrt'
NEW = '\tg++ -shared -fPIC -o $@ $^ -lpthread $(if $(IS_WINDOWS),,-lrt)'

if OLD not in src:
    print('W10 ERROR: link line anchor not found', file=sys.stderr)
    idx = src.find('-lrt')
    print('context:', repr(src[max(0,idx-200):idx+50]) if idx >= 0 else '(not found)')
    sys.exit(1)

src = src.replace(OLD, NEW, 1)
open(path, 'w').write(src)
print('W10 applied: -lrt made conditional on non-Windows')

# Verify
import subprocess
result = subprocess.run(['make', '-n', '-f', path, 'GENERATED_DIR=.', 'BUILD_DIR=/tmp/build_test'],
                       capture_output=True, text=True)
print('W10 make -n exit:', result.returncode)
print('W10 DONE')
