import sys

path = 'webserver/app.py'
src = open(path).read()

# Dump upload handler context
for marker in ('content_length', 'analyze_zip(zip_file)', 'safe_extract(zip_file,'):
    idx = src.find(marker)
    if idx >= 0:
        print('=== %s ===' % marker)
        print(repr(src[max(0, idx-80):idx+80]))

# Fix: inject NamedTemporaryFile write BETWEEN the content_length check and
# analyze_zip. The anchor is 'analyze_zip(zip_file)' which is always present
# after the check and before safe_extract.
#
# We replace:
#   safe, valid_files = analyze_zip(zip_file)
# with:
#   import tempfile as _tf, os as _os
#   _ztmp = _tf.NamedTemporaryFile(delete=False, suffix=".zip")
#   _ztmp.write(zip_file.stream.read()); _ztmp.flush(); _ztmp.close()
#   _zip_path = _ztmp.name
#   safe, valid_files = analyze_zip(_zip_path)
#
# Then replace safe_extract(zip_file, with safe_extract(_zip_path,
# and inject _os.unlink(_ztmp.name) before apply_vpp_plugin_conf.

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
    'import tempfile as _tf, os as _os\n' +
    indent + '_ztmp_dir = _os.environ.get("TEMP") or _os.environ.get("TMP") or _os.getcwd()\n' +
    indent + '_ztmp_fd, _ztmp_path = _tf.mkstemp(suffix=".zip", dir=_ztmp_dir)\n' +
    indent + '_os.write(_ztmp_fd, zip_file.read()); _os.close(_ztmp_fd)\n' +
    indent + '_zip_path = _ztmp_path\n' +
    indent + 'safe, valid_files = analyze_zip(_zip_path)'
)

src = src.replace(OLD1, NEW1, 1)
print('W6 fix1 applied (indent=%r)' % indent)

# Replace safe_extract(zip_file, -> safe_extract(_zip_path,
OLD2 = 'safe_extract(zip_file,'
if OLD2 not in src:
    print('W6 ERROR: anchor %r not found' % OLD2, file=sys.stderr)
    sys.exit(1)
src = src.replace(OLD2, 'safe_extract(_zip_path,', 1)
print('W6 fix2 applied')

# Inject cleanup before apply_vpp_plugin_conf
CLEANUP_ANCHOR = 'apply_vpp_plugin_conf(extract_dir)'
if CLEANUP_ANCHOR in src:
    idx_ca = src.index(CLEANUP_ANCHOR)
    ls = src.rfind('\n', 0, idx_ca) + 1
    ind_ca = src[ls:idx_ca]
    src = src.replace(
        ind_ca + CLEANUP_ANCHOR,
        ind_ca + '_os.unlink(_ztmp_path)\n' + ind_ca + CLEANUP_ANCHOR,
        1
    )
    print('W6 fix3: cleanup injected')
else:
    print('W6 WARNING: cleanup anchor not found (non-fatal)')

open(path, 'w').write(src)

# Verify
print('=== verification ===')
for line in open(path):
    n = 0
for i, line in enumerate(open(path), 1):
    if any(k in line for k in ('_ztmp', '_zip_path', 'analyze_zip', 'safe_extract', '_os.unlink')):
        print('%d: %s' % (i, line.rstrip()))

print('W6 DONE')
