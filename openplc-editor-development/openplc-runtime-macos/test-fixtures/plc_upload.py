import json, ssl, sys, time, os
import http.client, urllib.parse

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def https_post(path, body_bytes, headers):
    conn = http.client.HTTPSConnection("localhost", 8443, context=ctx, timeout=30)
    conn.request("POST", path, body=body_bytes, headers=headers)
    r = conn.getresponse()
    data = r.read()
    conn.close()
    return r.status, data

def https_get(path, token):
    conn = http.client.HTTPSConnection("localhost", 8443, context=ctx, timeout=15)
    conn.request("GET", path, headers={"Authorization": f"Bearer {token}"})
    r = conn.getresponse()
    data = r.read()
    conn.close()
    return r.status, data

# Login
status, data = https_post(
    "/api/login",
    json.dumps({"username": "volt", "password": "volt123"}).encode(),
    {"Content-Type": "application/json"}
)
if status != 200:
    print(f"Login failed: HTTP {status}: {data.decode(errors='replace')}")
    sys.exit(1)
token = json.loads(data)["access_token"]
print(f"Login OK, token={token[:20]}...")

# Build multipart body
zip_path = os.environ.get("MOTOR_ZIP", "C:/motor_start.zip")
with open(zip_path, "rb") as f:
    file_data = f.read()

boundary = "----VoltFormBoundary1234567890"
CRLF = b"\r\n"
body = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="file"; filename="motor_start.zip"\r\n'
    f"Content-Type: application/zip\r\n"
    f"\r\n"
).encode() + file_data + f"\r\n--{boundary}--\r\n".encode()

print(f"Uploading {len(file_data)} bytes from {zip_path}...")
status, data = https_post(
    "/api/upload-file",
    body,
    {
        "Authorization": f"Bearer {token}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(body)),
    }
)
resp = data.decode(errors="replace")
print(f"Upload HTTP {status}: {resp}")
if status not in (200, 201, 202):
    sys.exit(1)

# Poll compilation status
for i in range(60):
    time.sleep(3)
    status, data = https_get("/api/compilation-status", token)
    try:
        obj = json.loads(data)
    except Exception:
        print(f"  [{i*3}s] bad JSON: {data[:200]}")
        continue
    s = obj.get("status", "?")
    print(f"  [{i*3}s] {s}")
    if s == "SUCCESS":
        print("Compilation SUCCESS")
        sys.exit(0)
    if s == "FAILED":
        print("Compilation FAILED")
        for line in obj.get("logs", [])[-30:]:
            print(" ", line.rstrip())
        sys.exit(1)

print("Compilation timeout")
sys.exit(1)
