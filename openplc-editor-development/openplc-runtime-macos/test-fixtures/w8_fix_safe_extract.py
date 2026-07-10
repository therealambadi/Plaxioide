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

# Use zf.read(info.filename) which avoids cross-ZipFile-instance seek issues.
# Also use zf.infolist() from the CURRENT ZipFile instead of the passed-in valid_files
# which came from a different ZipFile instance in analyze_zip.
NEW = '''def safe_extract(zip_path, dest_dir, valid_files):
    """Extract files safely to a target directory."""
    build_state.status = BuildStatus.UNZIPPING

    abs_dest = os.path.abspath(dest_dir)

    with zipfile.ZipFile(zip_path, "r") as zf:
        # Use infolist from THIS ZipFile instance (not from analyze_zip's closed instance)
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

            # Use zf.read() by filename string — avoids seek issues with
            # ZipInfo objects on Cygwin/MSYS2 where cross-handle seeks fail
            data = zf.read(info.filename)
            with open(out_path, "wb") as _dst:
                _dst.write(data)

            logger.debug("Extracted: %s", out_path)'''

src = src.replace(OLD, NEW, 1)
print('W8 safe_extract replaced')

open(path, 'w').write(src)

import ast
try:
    ast.parse(open(path).read())
    print('W8 syntax OK')
except SyntaxError as e:
    print(f'W8 SYNTAX ERROR: {e}', file=sys.stderr)
    sys.exit(1)

print('W8 DONE')
