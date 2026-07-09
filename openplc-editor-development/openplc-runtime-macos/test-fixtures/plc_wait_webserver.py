import time, sys, os

# Webserver nohup redirects to /c/webserver_win.log (MSYS2 path for C:\).
# Windows Python reads it as C:\webserver_win.log directly.
log = os.environ.get('WEBSERVER_LOG', r'C:\webserver_win.log')
for i in range(180):
    time.sleep(1)
    try:
        txt = open(log).read()
    except OSError:
        txt = ''
    if 'Running on' in txt or 'Serving on' in txt:
        print(f'webserver READY at {i+1}s')
        print(txt)
        sys.exit(0)
    if '_run_module_as_main' in txt:
        print(f'webserver CRASHED at {i+1}s')
        print(txt)
        sys.exit(1)
    if (i + 1) % 15 == 0:
        lines = txt.strip().splitlines()
        print(f'waiting... {i+1}s, last line: {lines[-1] if lines else "(empty)"}')
print('webserver did not become ready in 180s')
try:
    print(open(log).read())
except OSError as e:
    print(f'(could not read log: {e})')
sys.exit(1)
