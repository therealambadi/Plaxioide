import sys

path = 'webserver/app.py'
src = open(path).read()

# Dump the upload handler context for diagnostics
for marker in ('request.files', 'analyze_zip', 'safe_extract'):
    idx = src.find(marker)
    if idx >= 0:
        print('=== %s context ===' % marker)
        print(repr(src[max(0, idx-100):idx+150]))

# The fix: write the uploaded bytes to a real temp file on disk and pass
# the file PATH string to analyze_zip + safe_extract.  A path makes
# zipfile.ZipFile open its own fresh OS file descriptor from byte 0 on
# every call — completely immune to stream-position bugs.
#
# We replace the single line that reads zip_file from the request and
# inject two lines: write to NamedTemporaryFile, rebind zip_file to path.

# Find the request.files["file"] assignment line
old_zip_line = None
for candidate in (
    'zip_file = flask.request.files["file"]',
    "zip_file = flask.request.files['file']",
    'zip_file = request.files["file"]',
    "zip_file = request.files['file']",
):
    if candidate in src:
        old_zip_line = candidate
        break

if old_zip_line is None:
    print('W6 ERROR: cannot find zip_file = request.files[...] line', file=sys.stderr)
    idx2 = src.find('request.files')
    print('request.files context:', repr(src[max(0,idx2-50):idx2+100]) if idx2 >= 0 else '(not found)')
    sys.exit(1)

# Detect the indentation of that line
line_start = src.rfind('\n', 0, src.index(old_zip_line)) + 1
indent = src[line_start:src.index(old_zip_line)]
print('indent detected: %r (%d chars)' % (indent, len(indent)))

# Build replacement block
new_block = (
    old_zip_line + '\n' +
    indent + 'import tempfile as _tf, os as _os\n' +
    indent + '_ztmp = _tf.NamedTemporaryFile(delete=False, suffix=".zip")\n' +
    indent + '_ztmp.write(zip_file.read()); _ztmp.flush(); _ztmp.close()\n' +
    indent + 'zip_file = _ztmp.name  # real path: ZipFile opens fresh fd from byte 0'
)

src = src.replace(old_zip_line, new_block, 1)
print('W6 fix1: injected temp-file write + rebind after zip_file assignment')

# Normalise any remaining zip_data references back to zip_file
for old in ('analyze_zip(zip_data)', 'safe_extract(zip_data,',
            'import io as _io\n', 'zip_data = _io.BytesIO(zip_file.read())\n',
            'zip_data.seek(0)  # rewind after analyze_zip consumed the stream\n'):
    if old in src:
        if old.startswith('analyze_zip') or old.startswith('safe_extract'):
            src = src.replace(old, old.replace('zip_data', 'zip_file'), 1)
            print('W6: renamed zip_data -> zip_file in %s call' % old.split('(')[0])
        else:
            src = src.replace(old, '', 1)
            print('W6: removed stale line: %r' % old[:60])

# Add cleanup: delete the temp file after safe_extract finishes.
# Anchor: the line calling apply_vpp_plugin_conf (always right after safe_extract).
cleanup_anchor = 'apply_vpp_plugin_conf(extract_dir)'
if cleanup_anchor in src:
    idx_ca = src.index(cleanup_anchor)
    ls = src.rfind('\n', 0, idx_ca) + 1
    ind_ca = src[ls:idx_ca]
    src = src.replace(
        ind_ca + cleanup_anchor,
        ind_ca + '_os.unlink(_ztmp.name)\n' + ind_ca + cleanup_anchor,
        1
    )
    print('W6 fix2: temp-file cleanup injected before apply_vpp_plugin_conf')
else:
    print('W6 WARNING: apply_vpp_plugin_conf not found — temp file leaks (non-fatal for CI)')

open(path, 'w').write(src)
print('W6 DONE')
