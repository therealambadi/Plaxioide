import sys

path = 'webserver/app.py'
src = open(path).read()

# Add import traceback at the top if not present
if 'import traceback' not in src:
    src = src.replace('import flask\n', 'import flask\nimport traceback\n', 1)
    print('Added traceback import')

# Replace the OSError handler to include full traceback in the log
OLD = '''    except (OSError, IOError) as e:
        build_state.status = BuildStatus.FAILED
        build_state.log(f"[ERROR] File system error: {e}")
        return {
            "UploadFileFail": f"File system error: {e}",
            "CompilationStatus": build_state.status.name,
        }
    except Exception as e:
        build_state.status = BuildStatus.FAILED
        build_state.log(f"[ERROR] Unexpected error: {e}")'''

if OLD not in src:
    print('W9 ERROR: exception handler anchor not found', file=sys.stderr)
    sys.exit(1)

NEW = '''    except (OSError, IOError) as e:
        build_state.status = BuildStatus.FAILED
        _tb = traceback.format_exc()
        build_state.log(f"[ERROR] File system error: {e}\\nTRACEBACK:\\n{_tb}")
        return {
            "UploadFileFail": f"File system error: {e}",
            "CompilationStatus": build_state.status.name,
        }
    except Exception as e:
        build_state.status = BuildStatus.FAILED
        _tb = traceback.format_exc()
        build_state.log(f"[ERROR] Unexpected error: {e}\\nTRACEBACK:\\n{_tb}")'''

src = src.replace(OLD, NEW, 1)
print('W9 traceback logging added')
open(path, 'w').write(src)

import ast
try:
    ast.parse(open(path).read())
    print('W9 syntax OK')
except SyntaxError as e:
    print(f'W9 SYNTAX ERROR: {e}', file=sys.stderr)
    sys.exit(1)

print('W9 DONE')
