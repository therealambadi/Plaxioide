import sys

path = 'webserver/app.py'
src = open(path).read()

# Dump call site for diagnostics
idx = src.find('analyze_zip')
if idx >= 0:
    print('=== analyze_zip context (repr) ===')
    print(repr(src[max(0, idx-300):idx+200]))
idx2 = src.find('safe_extract(zip_')
if idx2 >= 0:
    print('=== safe_extract call context (repr) ===')
    print(repr(src[max(0, idx2-100):idx2+200]))

# Patch: insert BytesIO conversion before analyze_zip call.
# Try 8-space and 4-space indentation to handle any formatting.
patched = False
for indent in ('        ', '    '):
    old = indent + 'safe, valid_files = analyze_zip(zip_file)'
    if old in src:
        new = (indent + 'import io as _io\n' +
               indent + 'zip_data = _io.BytesIO(zip_file.read())\n' +
               indent + 'safe, valid_files = analyze_zip(zip_data)')
        src = src.replace(old, new, 1)
        patched = True
        print('W6 fix1 applied (indent=%d)' % len(indent))
        break

if not patched:
    print('W6 fix1: anchor not found', file=sys.stderr)
    sys.exit(1)

# Replace safe_extract(zip_file, -> safe_extract(zip_data,
old2 = 'safe_extract(zip_file,'
if old2 not in src:
    print('W6 fix2: safe_extract(zip_file, not found', file=sys.stderr)
    sys.exit(1)
src = src.replace(old2, 'safe_extract(zip_data,', 1)
print('W6 fix2 applied')

open(path, 'w').write(src)
print('W6 done')
