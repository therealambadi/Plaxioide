import sys

path = 'webserver/plcapp_management.py'
src = open(path).read()

# Instrument analyze_zip to log each step
OLD = '''def analyze_zip(zip_path) -> tuple[bool, list]:
    """Analyze the ZIP file for safety before extraction."""
    build_state.status = BuildStatus.UNZIPPING

    if not zipfile.is_zipfile(zip_path):
        build_state.log("[ERROR] Not a valid PLC Program file.\\n")
        return False, []

    with zipfile.ZipFile(zip_path, "r") as zf:'''

if OLD not in src:
    print('W7b ERROR: anchor not found', file=sys.stderr)
    idx = src.find('def analyze_zip')
    if idx >= 0:
        print('Context:', repr(src[idx:idx+300]))
    sys.exit(1)

NEW = '''def analyze_zip(zip_path) -> tuple[bool, list]:
    """Analyze the ZIP file for safety before extraction."""
    build_state.status = BuildStatus.UNZIPPING
    build_state.log(f"[W7b] analyze_zip path={zip_path}\\n")
    import os as _az_os
    build_state.log(f"[W7b] file exists: {_az_os.path.exists(zip_path)}, size: {_az_os.path.getsize(zip_path) if _az_os.path.exists(zip_path) else -1}\\n")

    build_state.log("[W7b] calling is_zipfile\\n")
    if not zipfile.is_zipfile(zip_path):
        build_state.log("[ERROR] Not a valid PLC Program file.\\n")
        return False, []
    build_state.log("[W7b] is_zipfile OK\\n")

    build_state.log("[W7b] opening ZipFile\\n")
    with zipfile.ZipFile(zip_path, "r") as zf:
        build_state.log("[W7b] ZipFile opened OK\\n")'''

src = src.replace(OLD, NEW, 1)
print('W7b instrumentation applied')

open(path, 'w').write(src)

for i, line in enumerate(open(path), 1):
    if '[W7b]' in line:
        print('%d: %s' % (i, line.rstrip()))

print('W7b DONE')
