import sys

path = 'webserver/app.py'
src = open(path).read()

# Dump upload handler context
for marker in ('content_length', 'analyze_zip(zip_file)', 'safe_extract(zip_file,'):
    idx = src.find(marker)
    if idx >= 0:
        print('=== %s ===' % marker)
        print(repr(src[max(0, idx-80):idx+80]))

# Strategy: read the entire FileStorage into io.BytesIO once, then pass the
# BytesIO to both analyze_zip and safe_extract. This is purely in-memory —
# no Cygwin filesystem seeks involved after the initial read. Avoids EINVAL
# caused by Cygwin's zipfile seek failures on disk-backed file handles inside
# a Werkzeug/eventlet green thread.
#
# We replace:
#   safe, valid_files = analyze_zip(zip_file)
# with:
#   import io as _io
#   _zip_bytes = io.BytesIO(zip_file.read())
#   safe, valid_files = analyze_zip(_zip_bytes)
#
# Then replace safe_extract(zip_file, -> safe_extract(_zip_bytes,
# and remove the unlink (no file to delete).

OLD1 = 'safe, valid_files = analyze_zip(zip_file)'
if OLD1 not in src:
    print('W6 ERROR: anchor %r not found' % OLD1, file=sys.stderr)
    idx = src.find('analyze_zip')
    print('analyze_zip context:', repr(src[max(0,idx-100):idx+200]) if idx >= 0 else '(not found)')
    sys.exit(1)

# Detect indentation of the analyze_zip call
line_start = src.rfind('\n', 0, src.index(OLD1)) + 1
indent = src[line_start:src.index(OLD1)]

NEW1 = (
    'import io as _io\n' +
    indent + '_zip_bytes = _io.BytesIO(zip_file.read())\n' +
    indent + 'safe, valid_files = analyze_zip(_zip_bytes)'
)

src = src.replace(OLD1, NEW1, 1)
print('W6 fix1 applied (indent=%r)' % indent)

# Replace safe_extract(zip_file, -> safe_extract(_zip_bytes,
OLD2 = 'safe_extract(zip_file,'
if OLD2 not in src:
    print('W6 ERROR: anchor %r not found' % OLD2, file=sys.stderr)
    sys.exit(1)
src = src.replace(OLD2, 'safe_extract(_zip_bytes,', 1)
print('W6 fix2 applied')

# Remove the old _os.unlink line if present from a prior W6 run (cleanup for
# the disk-file approach that no longer applies).
src = src.replace(indent + '_os.unlink(_zip_bytes)\n', '')
src = src.replace(indent + '_os.unlink(_zip_path)\n', '')
print('W6 fix3: cleanup lines removed (in-memory — no file to delete)')

open(path, 'w').write(src)

# Verify
print('=== verification ===')
for i, line in enumerate(open(path), 1):
    if any(k in line for k in ('_zip_bytes', '_zip_path', 'analyze_zip', 'safe_extract', '_io.BytesIO')):
        print('%d: %s' % (i, line.rstrip()))

print('W6 DONE')
