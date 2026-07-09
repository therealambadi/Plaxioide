import socket, sys, time

SOCK = '/tmp/plc_runtime.socket'
print(f'Testing AF_UNIX connect to {SOCK}')
for attempt in range(8):
    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(2)
        s.connect(SOCK)
        s.close()
        print(f'  AF_UNIX connect SUCCESS (attempt {attempt+1})')
        sys.exit(0)
    except FileNotFoundError:
        print(f'  attempt {attempt+1}: socket file not found yet')
    except Exception as e:
        print(f'  attempt {attempt+1}: {type(e).__name__}: {e}')
    time.sleep(1)
print('  AF_UNIX connect FAILED after 8 attempts')
