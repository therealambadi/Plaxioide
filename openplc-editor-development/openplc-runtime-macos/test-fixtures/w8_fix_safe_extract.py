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

# Accept zip_src as either a path string or a file-like object (io.BytesIO).
# On Cygwin/MSYS2, zipfile.ZipFile on a disk path inside a Werkzeug/eventlet
# request fails to seek (EINVAL) on every zf.read() call. Passing io.BytesIO
# keeps everything in-memory and avoids all Cygwin filesystem seek issues.
NEW = '''def safe_extract(zip_src, dest_dir, valid_files):
    """Extract files safely to a target directory.
    zip_src may be a file path string or a file-like object (e.g. io.BytesIO).
    Using BytesIO avoids Cygwin seek failures on disk-backed zip handles.
    """
    build_state.status = BuildStatus.UNZIPPING

    abs_dest = os.path.abspath(dest_dir)

    # Rewind if seekable (handles io.BytesIO passed from W6)
    if hasattr(zip_src, "seek"):
        zip_src.seek(0)

    with zipfile.ZipFile(zip_src, "r") as zf:
        # Use infolist from THIS ZipFile instance
        entries = zf.infolist()

        # Detect single root to strip
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

            out_path = os.path.abspath(os.path.join(dest_dir, filename))
            if not out_path.startswith(abs_dest):
                continue

            os.makedirs(os.path.dirname(out_path), exist_ok=True)

            with zf.open(info.filename) as _entry, open(out_path, "wb") as _dst:
                _dst.write(_entry.read())

            logger.debug("Extracted: %s", out_path)'''

src = src.replace(OLD, NEW, 1)
print('W8 safe_extract replaced')

# Also patch analyze_zip to rewind the BytesIO before is_zipfile and ZipFile.
# Both accept file-like objects but require position at 0.
OLD_AZ = '''def analyze_zip(zip_path) -> tuple[bool, list]:
    """Analyze the ZIP file for safety before extraction."""
    build_state.status = BuildStatus.UNZIPPING

    if not zipfile.is_zipfile(zip_path):'''

NEW_AZ = '''def analyze_zip(zip_path) -> tuple[bool, list]:
    """Analyze the ZIP file for safety before extraction.
    zip_path may be a file path string or a seekable file-like object (e.g. io.BytesIO).
    """
    build_state.status = BuildStatus.UNZIPPING

    if hasattr(zip_path, "seek"):
        zip_path.seek(0)
    if not zipfile.is_zipfile(zip_path):'''

if OLD_AZ in src:
    src = src.replace(OLD_AZ, NEW_AZ, 1)
    print('W8 analyze_zip rewind patch applied')
    # Also rewind before the ZipFile open
    OLD_AZ2 = '    with zipfile.ZipFile(zip_path, "r") as zf:\n        total_size = 0'
    NEW_AZ2 = '    if hasattr(zip_path, "seek"):\n        zip_path.seek(0)\n    with zipfile.ZipFile(zip_path, "r") as zf:\n        total_size = 0'
    if OLD_AZ2 in src:
        src = src.replace(OLD_AZ2, NEW_AZ2, 1)
        print('W8 analyze_zip ZipFile rewind applied')
    else:
        print('W8 WARNING: analyze_zip ZipFile rewind anchor not found')
else:
    print('W8 WARNING: analyze_zip rewind anchor not found (may already be patched)')

open(path, 'w').write(src)

import ast
try:
    ast.parse(open(path).read())
    print('W8 syntax OK')
except SyntaxError as e:
    print(f'W8 SYNTAX ERROR: {e}', file=sys.stderr)
    sys.exit(1)

print('W8 DONE')
