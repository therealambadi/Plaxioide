import urllib.request, json, ssl, sys, time, os

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

boundary = b"----VoltBoundary7MA4YWxkTrZu0gW"
zip_path = os.environ.get("MOTOR_ZIP", "C:/motor_start.zip")
with open(zip_path, "rb") as f:
    file_data = f.read()

body = (
    b"--" + boundary + b"\r\n"
    b"Content-Disposition: form-data; name=\"file\"; filename=\"motor_start.zip\"\r\n"
    b"Content-Type: application/zip\r\n\r\n"
    + file_data
    + b"\r\n--" + boundary + b"--\r\n"
)
req2 = urllib.request.Request(
    "https://localhost:8443/api/upload-file",
    data=body,
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": f"multipart/form-data; boundary={boundary.decode()}"
    },
    method="POST"
)
r2 = urllib.request.urlopen(req2, context=ctx, timeout=30)
print("Upload:", json.loads(r2.read()))

for i in range(40):
    time.sleep(3)
    req3 = urllib.request.Request(
        "https://localhost:8443/api/compilation-status",
        headers={"Authorization": f"Bearer {token}"}
    )
    status = json.loads(urllib.request.urlopen(req3, context=ctx, timeout=8).read())
    s = status.get("status", "?")
    print(f"  [{i*3}s] {s}")
    if s == "SUCCESS":
        print("Compilation SUCCESS")
        sys.exit(0)
    if s == "FAILED":
        print("Compilation FAILED")
        for line in status.get("logs", [])[-30:]:
            print(" ", line.rstrip())
        sys.exit(1)

print("Compilation timeout")
sys.exit(1)
