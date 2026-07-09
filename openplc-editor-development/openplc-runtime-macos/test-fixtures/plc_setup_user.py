import urllib.request, json, ssl, sys

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# The upstream webserver at cb1060d allows unauthenticated POST to /create-user
# when no users exist yet (first-run bootstrap). Try both endpoint paths and
# both field combinations to be robust against minor API variations.
endpoints = [
    "https://localhost:8443/create-user",
    "https://localhost:8443/api/create-user",
]
payloads = [
    {"username": "volt", "password": "volt123"},
    {"username": "volt", "password": "volt123", "role": "admin"},
]

for url in endpoints:
    for body_dict in payloads:
        try:
            body = json.dumps(body_dict).encode()
            req = urllib.request.Request(
                url, data=body,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            r = urllib.request.urlopen(req, context=ctx, timeout=10)
            resp = r.read().decode(errors="replace")
            print(f"create-user OK at {url}: {resp}")
            sys.exit(0)
        except urllib.error.HTTPError as e:
            body_resp = e.read().decode(errors="replace")
            print(f"{url} HTTP {e.code}: {body_resp}")
            if e.code in (409, 200):
                print("User exists or was created — proceeding")
                sys.exit(0)
            if e.code == 400 and "already" in body_resp.lower():
                print("User already exists — proceeding")
                sys.exit(0)
        except Exception as e:
            print(f"{url} error: {type(e).__name__}: {e}")

print("create-user failed on all endpoints — will attempt login anyway")
# Don't exit(1) — if the user already exists from a prior run, login will work
sys.exit(0)
