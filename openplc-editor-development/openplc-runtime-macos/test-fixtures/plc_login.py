import urllib.request, json, ssl, sys, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

for attempt in range(15):
    try:
        body = json.dumps({"username": "volt", "password": "volt123"}).encode()
        req = urllib.request.Request(
            "https://localhost:8443/api/login",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        r = urllib.request.urlopen(req, context=ctx, timeout=8)
        token = json.loads(r.read())["access_token"]
        print(f"Login OK attempt {attempt+1}, token={token[:20]}...")
        req2 = urllib.request.Request(
            "https://localhost:8443/api/status",
            headers={"Authorization": f"Bearer {token}"}
        )
        r2 = urllib.request.urlopen(req2, context=ctx, timeout=8)
        print("Status:", json.loads(r2.read()))
        sys.exit(0)
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"Attempt {attempt+1}: HTTP {e.code}: {body}")
        time.sleep(2)
    except Exception as e:
        print(f"Attempt {attempt+1}: {type(e).__name__}: {e}")
        time.sleep(2)

sys.exit(1)
