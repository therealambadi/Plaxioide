import sys

path = 'webserver/app.py'
src = open(path).read()

# We need to wrap each operation in the upload handler individually with logging
# Find the try block in handle_upload_file and add per-step logging

# The try block contains:
# import os as _os
# _zip_path = _os.path.join(_os.getcwd(), "upload_tmp.zip")
# open(_zip_path, "wb").write(zip_file.read())
# safe, valid_files = analyze_zip(_zip_path)
# ... 
# safe_extract(_zip_path, extract_dir, valid_files)

# We'll add a build_state.log call after each step to identify which one fails

OLD = '        import os as _os\n        _zip_path = _os.path.join(_os.getcwd(), "upload_tmp.zip")\n        open(_zip_path, "wb").write(zip_file.read())\n        safe, valid_files = analyze_zip(_zip_path)'

if OLD not in src:
    print('W7 ERROR: W6 anchor not found - run W6 first', file=sys.stderr)
    # Show what the block looks like
    idx = src.find('_zip_path')
    if idx >= 0:
        print('Context around _zip_path:', repr(src[max(0,idx-100):idx+200]))
    sys.exit(1)

NEW = '''        import os as _os
        build_state.log("[W7] step1: getcwd\\n")
        _cwd = _os.getcwd()
        build_state.log(f"[W7] cwd={_cwd}\\n")
        _zip_path = _os.path.join(_cwd, "upload_tmp.zip")
        build_state.log(f"[W7] zip_path={_zip_path}\\n")
        build_state.log("[W7] step2: reading FileStorage\\n")
        _zip_bytes = zip_file.read()
        build_state.log(f"[W7] read {len(_zip_bytes)} bytes\\n")
        build_state.log("[W7] step3: writing to disk\\n")
        with open(_zip_path, "wb") as _zf:
            _zf.write(_zip_bytes)
        build_state.log(f"[W7] wrote zip to {_zip_path}\\n")
        build_state.log("[W7] step4: analyze_zip\\n")
        safe, valid_files = analyze_zip(_zip_path)'''

src = src.replace(OLD, NEW, 1)
print('W7 instrumentation applied')

open(path, 'w').write(src)

# Verify
for i, line in enumerate(open(path), 1):
    if '[W7]' in line:
        print('%d: %s' % (i, line.rstrip()))

print('W7 DONE')
