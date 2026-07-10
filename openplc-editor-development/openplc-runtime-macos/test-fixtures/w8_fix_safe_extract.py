import sys

path = 'webserver/plcapp_management.py'
src = open(path).read()

OLD = '''def safe_extract(zip_path, dest_dir, valid_files):
    """Extract files safely to a target directory.
    - Skips macOS metadata (__MACOSX, .DS_Store)
    - Auto-strips a single common root folder if present
    """
    build_state.status = BuildStatus.UNZIPPING

    with zipfile.ZipFile(zip_path, "r") as zf:
        # Detect roots (ignoring macOS junk)
        roots = set()
        for info in valid_files:
            if info.filename.startswith("__MACOSX/") or info.filename.endswith(".DS_Store"):
                continue
            parts = info.filename.split("/", 1)
            if parts and parts[0]:
                roots.add(parts[0])
        strip_root = len(roots) == 1

        for info in valid_files:
            filename = info.filename

            # Normalize path separators for cross-platform compatibility (Windows \\ to Unix /)
            filename = filename.replace('\\\\', '/')

            # Skip macOS junk and directories
            if filename.startswith("__MACOSX/") or filename.endswith(".DS_Store") or filename.endswith("/"):
                continue

            # Optionally strip single root folder
            if strip_root:
                parts = filename.split("/", 1)
                if len(parts) == 2:
                    filename = parts[1]
                else:
                    filename = parts[0]

            out_path = os.path.join(dest_dir, filename)
            out_path = os.path.abspath(out_path)

            # Ensure extraction stays inside destination
            if not out_path.startswith(os.path.abspath(dest_dir)):
                # logger.warning("Skipping suspicious path: %s", filename)
                continue

            os.makedirs(os.path.dirname(out_path), exist_ok=True)

            with zf.open(info) as src, open(out_path, "wb") as dst:
                dst.write(src.read())

            logger.debug("Extracted: %s", out_path)'''

if OLD not in src:
    print('W8 ERROR: safe_extract anchor not found', file=sys.stderr)
    idx = src.find('def safe_extract')
    if idx >= 0:
        print('Context:', repr(src[idx:idx+400]))
    sys.exit(1)

# Replace safe_extract with a version that uses subprocess unzip on Cygwin/Windows
# and falls back to Python zipfile on other platforms.
# Root cause: Cygwin Python 3.12 zipfile has a seek bug (EINVAL / ValueError:
# negative seek value -1) when reading entries from certain real-world ZIP files.
# The system `unzip` command bypasses Python's zipfile entirely and works correctly.
# After extraction, we strip the single root directory if present (same logic as before).
NEW = '''def safe_extract(zip_src, dest_dir, valid_files):
    """Extract files safely to a target directory.
    zip_src: file path string or file-like object (io.BytesIO).
    On Cygwin/MSYS2, uses system unzip to bypass Python zipfile seek bugs.
    """
    import platform as _platform
    import subprocess as _subprocess
    import tempfile as _tempfile

    build_state.status = BuildStatus.UNZIPPING
    abs_dest = os.path.abspath(dest_dir)
    os.makedirs(abs_dest, exist_ok=True)

    # If zip_src is a file-like object, write it to a temp file so unzip can read it
    _tmp_path = None
    if hasattr(zip_src, "read"):
        if hasattr(zip_src, "seek"):
            zip_src.seek(0)
        fd, _tmp_path = _tempfile.mkstemp(suffix=".zip")
        try:
            with os.fdopen(fd, "wb") as _tf:
                _tf.write(zip_src.read())
        except Exception:
            os.close(fd)
            raise
        zip_path = _tmp_path
    else:
        zip_path = zip_src

    try:
        _is_cygwin = _platform.system().startswith("CYGWIN") or _platform.system().startswith("MSYS")

        if _is_cygwin:
            # Use system unzip: extract to a staging dir, then copy with root-strip
            _stage = _tempfile.mkdtemp()
            try:
                result = _subprocess.run(
                    ["unzip", "-o", "-q", zip_path, "-d", _stage],
                    capture_output=True, text=True
                )
                if result.returncode not in (0, 1):  # unzip exits 1 on warnings
                    raise OSError(f"unzip failed (rc={result.returncode}): {result.stderr}")

                # Move files from staging to dest_dir, stripping single root if present
                stage_entries = [e for e in os.listdir(_stage) if e not in ("__MACOSX",)]
                strip_root = len(stage_entries) == 1 and os.path.isdir(os.path.join(_stage, stage_entries[0]))
                src_root = os.path.join(_stage, stage_entries[0]) if strip_root else _stage

                for dirpath, dirnames, filenames in os.walk(src_root):
                    # Skip __MACOSX entirely
                    dirnames[:] = [d for d in dirnames if d != "__MACOSX"]
                    for fname in filenames:
                        if fname.endswith(".DS_Store"):
                            continue
                        src_path = os.path.join(dirpath, fname)
                        rel = os.path.relpath(src_path, src_root)
                        out_path = os.path.abspath(os.path.join(abs_dest, rel))
                        if not out_path.startswith(abs_dest):
                            continue
                        os.makedirs(os.path.dirname(out_path), exist_ok=True)
                        with open(src_path, "rb") as _s, open(out_path, "wb") as _d:
                            _d.write(_s.read())
                        logger.debug("Extracted: %s", out_path)
            finally:
                import shutil as _shutil
                _shutil.rmtree(_stage, ignore_errors=True)

        else:
            # Non-Cygwin: use Python zipfile directly (works on Linux/macOS)
            if hasattr(zip_src, "seek"):
                zip_src.seek(0)
                _zf_src = zip_src
            else:
                _zf_src = zip_path

            with zipfile.ZipFile(_zf_src, "r") as zf:
                entries = zf.infolist()
                roots = set()
                for info in entries:
                    if info.filename.startswith("__MACOSX/") or info.filename.endswith(".DS_Store"):
                        continue
                    parts = info.filename.split("/", 1)
                    if parts and parts[0]:
                        roots.add(parts[0])
                strip_root = len(roots) == 1

                for info in entries:
                    filename = info.filename.replace("\\\\", "/")
                    if filename.startswith("__MACOSX/") or filename.endswith(".DS_Store") or filename.endswith("/"):
                        continue
                    if strip_root:
                        parts = filename.split("/", 1)
                        filename = parts[1] if len(parts) == 2 else parts[0]
                    out_path = os.path.abspath(os.path.join(abs_dest, filename))
                    if not out_path.startswith(abs_dest):
                        continue
                    os.makedirs(os.path.dirname(out_path), exist_ok=True)
                    with zf.open(info.filename) as _entry, open(out_path, "wb") as _dst:
                        _dst.write(_entry.read())
                    logger.debug("Extracted: %s", out_path)

    finally:
        if _tmp_path:
            try:
                os.unlink(_tmp_path)
            except OSError:
                pass'''

src = src.replace(OLD, NEW, 1)
print('W8 safe_extract replaced')

# Also patch analyze_zip to rewind BytesIO before is_zipfile and ZipFile.
OLD_AZ = '''def analyze_zip(zip_path) -> tuple[bool, list]:
    """Analyze the ZIP file for safety before extraction."""
    build_state.status = BuildStatus.UNZIPPING

    if not zipfile.is_zipfile(zip_path):'''

NEW_AZ = '''def analyze_zip(zip_path) -> tuple[bool, list]:
    """Analyze the ZIP file for safety before extraction.
    zip_path may be a path string or a seekable file-like object (io.BytesIO).
    """
    build_state.status = BuildStatus.UNZIPPING

    if hasattr(zip_path, "seek"):
        zip_path.seek(0)
    if not zipfile.is_zipfile(zip_path):'''

if OLD_AZ in src:
    src = src.replace(OLD_AZ, NEW_AZ, 1)
    print('W8 analyze_zip is_zipfile rewind applied')
    OLD_AZ2 = '    with zipfile.ZipFile(zip_path, "r") as zf:\n        total_size = 0'
    NEW_AZ2 = '    if hasattr(zip_path, "seek"):\n        zip_path.seek(0)\n    with zipfile.ZipFile(zip_path, "r") as zf:\n        total_size = 0'
    if OLD_AZ2 in src:
        src = src.replace(OLD_AZ2, NEW_AZ2, 1)
        print('W8 analyze_zip ZipFile rewind applied')
    else:
        print('W8 WARNING: analyze_zip ZipFile rewind anchor not found')
else:
    print('W8 WARNING: analyze_zip anchor not found (may already be patched)')

open(path, 'w').write(src)

import ast
try:
    ast.parse(open(path).read())
    print('W8 syntax OK')
except SyntaxError as e:
    print(f'W8 SYNTAX ERROR: {e}', file=sys.stderr)
    sys.exit(1)

print('W8 DONE')
