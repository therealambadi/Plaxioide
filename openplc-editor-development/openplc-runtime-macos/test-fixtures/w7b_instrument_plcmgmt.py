import sys

path = 'webserver/plcapp_management.py'
src = open(path).read()

# === ANCHOR 1: instrument analyze_zip ===
OLD1 = '''def analyze_zip(zip_path) -> tuple[bool, list]:
    """Analyze the ZIP file for safety before extraction."""
    build_state.status = BuildStatus.UNZIPPING

    if not zipfile.is_zipfile(zip_path):
        build_state.log("[ERROR] Not a valid PLC Program file.\\n")
        return False, []

    with zipfile.ZipFile(zip_path, "r") as zf:'''

if OLD1 not in src:
    print('W7b ERROR: anchor1 not found', file=sys.stderr)
    sys.exit(1)

NEW1 = '''def analyze_zip(zip_path) -> tuple[bool, list]:
    """Analyze the ZIP file for safety before extraction."""
    build_state.status = BuildStatus.UNZIPPING
    build_state.log(f"[W7b] analyze_zip: is_zipfile check\\n")
    if not zipfile.is_zipfile(zip_path):
        build_state.log("[ERROR] Not a valid PLC Program file.\\n")
        return False, []
    build_state.log("[W7b] analyze_zip: ZipFile open\\n")
    with zipfile.ZipFile(zip_path, "r") as zf:
        build_state.log(f"[W7b] analyze_zip: infolist count={len(zf.infolist())}\\n")'''

src = src.replace(OLD1, NEW1, 1)
print('W7b anchor1 applied')

# === ANCHOR 2: instrument safe_extract ===
OLD2 = '''def safe_extract(zip_path, dest_dir, valid_files):
    """Extract files safely to a target directory.
    - Skips macOS metadata (__MACOSX, .DS_Store)
    - Auto-strips a single common root folder if present
    """
    build_state.status = BuildStatus.UNZIPPING

    with zipfile.ZipFile(zip_path, "r") as zf:'''

if OLD2 not in src:
    print('W7b ERROR: anchor2 not found', file=sys.stderr)
    idx = src.find('def safe_extract')
    if idx >= 0:
        print('Context:', repr(src[idx:idx+300]))
    sys.exit(1)

NEW2 = '''def safe_extract(zip_path, dest_dir, valid_files):
    """Extract files safely to a target directory."""
    build_state.status = BuildStatus.UNZIPPING
    build_state.log(f"[W7b] safe_extract: opening ZipFile {zip_path}\\n")
    with zipfile.ZipFile(zip_path, "r") as zf:
        build_state.log(f"[W7b] safe_extract: ZipFile open OK\\n")'''

src = src.replace(OLD2, NEW2, 1)
print('W7b anchor2 applied')

# === ANCHOR 3: instrument the file extraction loop ===
OLD3 = '''            out_path = os.path.join(dest_dir, filename)
            out_path = os.path.abspath(out_path)

            # Ensure extraction stays inside destination
            if not out_path.startswith(os.path.abspath(dest_dir)):
                # logger.warning("Skipping suspicious path: %s", filename)
                continue

            os.makedirs(os.path.dirname(out_path), exist_ok=True)

            with zf.open(info) as src, open(out_path, "wb") as dst:
                dst.write(src.read())'''

if OLD3 not in src:
    print('W7b ERROR: anchor3 not found', file=sys.stderr)
    idx = src.find('out_path = os.path.join(dest_dir')
    if idx >= 0:
        print('Context:', repr(src[idx:idx+300]))
    sys.exit(1)

NEW3 = '''            out_path = os.path.join(dest_dir, filename)
            out_path = os.path.abspath(out_path)
            abs_dest = os.path.abspath(dest_dir)
            build_state.log(f"[W7b] extract: out_path={out_path} abs_dest={abs_dest}\\n")

            if not out_path.startswith(abs_dest):
                build_state.log(f"[W7b] extract: SKIP path traversal {out_path}\\n")
                continue

            build_state.log(f"[W7b] extract: makedirs {os.path.dirname(out_path)}\\n")
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            build_state.log(f"[W7b] extract: open output file\\n")
            with zf.open(info) as _src, open(out_path, "wb") as _dst:
                build_state.log(f"[W7b] extract: writing\\n")
                _dst.write(_src.read())
            build_state.log(f"[W7b] extract: done {filename}\\n")'''

src = src.replace(OLD3, NEW3, 1)
print('W7b anchor3 applied')

open(path, 'w').write(src)

count = 0
for i, line in enumerate(open(path), 1):
    if '[W7b]' in line:
        print('%d: %s' % (i, line.rstrip()))
        count += 1
print(f'W7b DONE ({count} instrumentation lines)')
