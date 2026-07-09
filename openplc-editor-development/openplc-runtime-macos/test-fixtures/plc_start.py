import urllib.request, json, ssl, sys, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

body = json.dumps({"username": "volt", "password": "volt123"}).encode()
req = urllib.request.Request(
    "https://localhost:8443/api/login",
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST"
)
token = json.loads(urllib.request.urlopen(req, context=ctx, timeout=8).read())["access_token"]

req2 = urllib.request.Request(
    "https://localhost:8443/api/start-plc",
    data=b'{}',
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST"
)
print("start-plc:", json.loads(urllib.request.urlopen(req2, context=ctx, timeout=8).read()))
time.sleep(3)

req3 = urllib.request.Request(
    "https://localhost:8443/api/status",
    headers={"Authorization": f"Bearer {token}"}
)
status = json.loads(urllib.request.urlopen(req3, context=ctx, timeout=8).read())
print("Status:", status)

if status.get("status") != "STATUS:RUNNING":
    print("FATAL: PLC not running")
    sys.exit(1)

print("PLC STATUS:RUNNING")
