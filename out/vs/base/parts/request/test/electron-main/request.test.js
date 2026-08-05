import * as http from "http";
import assert from "assert";
import { CancellationToken, CancellationTokenSource } from "../../../../common/cancellation.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../test/common/utils.js";
import { request } from "../../common/requestImpl.js";
import { streamToBuffer } from "../../../../common/buffer.js";
suite("Request", () => {
  let port;
  let server;
  setup(async () => {
    port = await new Promise((resolvePort, rejectPort) => {
      server = http.createServer((req, res) => {
        if (req.url === "/noreply") {
          return;
        }
        res.setHeader("Content-Type", "application/json");
        if (req.headers["echo-header"]) {
          res.setHeader("echo-header", req.headers["echo-header"]);
        }
        const data = [];
        req.on("data", (chunk) => data.push(chunk));
        req.on("end", () => {
          res.end(JSON.stringify({
            method: req.method,
            url: req.url,
            data: Buffer.concat(data).toString()
          }));
        });
      }).listen(0, "127.0.0.1", () => {
        const address = server.address();
        resolvePort(address.port);
      }).on("error", (err) => {
        rejectPort(err);
      });
    });
  });
  teardown(async () => {
    await new Promise((resolve, reject) => {
      server.close((err) => err ? reject(err) : resolve());
    });
  });
  test("GET", async () => {
    const context = await request({
      url: `http://127.0.0.1:${port}`,
      headers: {
        "echo-header": "echo-value"
      }
    }, CancellationToken.None);
    assert.strictEqual(context.res.statusCode, 200);
    assert.strictEqual(context.res.headers["content-type"], "application/json");
    assert.strictEqual(context.res.headers["echo-header"], "echo-value");
    const buffer = await streamToBuffer(context.stream);
    const body = JSON.parse(buffer.toString());
    assert.strictEqual(body.method, "GET");
    assert.strictEqual(body.url, "/");
  });
  test("POST", async () => {
    const context = await request({
      type: "POST",
      url: `http://127.0.0.1:${port}/postpath`,
      data: "Some data"
    }, CancellationToken.None);
    assert.strictEqual(context.res.statusCode, 200);
    assert.strictEqual(context.res.headers["content-type"], "application/json");
    const buffer = await streamToBuffer(context.stream);
    const body = JSON.parse(buffer.toString());
    assert.strictEqual(body.method, "POST");
    assert.strictEqual(body.url, "/postpath");
    assert.strictEqual(body.data, "Some data");
  });
  test("timeout", async () => {
    try {
      await request({
        type: "GET",
        url: `http://127.0.0.1:${port}/noreply`,
        timeout: 123
      }, CancellationToken.None);
      assert.fail("Should fail with timeout");
    } catch (err) {
      assert.strictEqual(err.message, "Fetch timeout: 123ms");
    }
  });
  test("cancel", async () => {
    try {
      const source = new CancellationTokenSource();
      const res = request({
        type: "GET",
        url: `http://127.0.0.1:${port}/noreply`
      }, source.token);
      await new Promise((resolve) => setTimeout(resolve, 100));
      source.cancel();
      await res;
      assert.fail("Should fail with cancellation");
    } catch (err) {
      assert.strictEqual(err.message, "Canceled");
    }
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3BhcnRzL3JlcXVlc3QvdGVzdC9lbGVjdHJvbi1tYWluL3JlcXVlc3QudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGh0dHAgZnJvbSAnaHR0cCc7XG5pbXBvcnQgeyBBZGRyZXNzSW5mbyB9IGZyb20gJ25ldCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IHJlcXVlc3QgfSBmcm9tICcuLi8uLi9jb21tb24vcmVxdWVzdEltcGwuanMnO1xuaW1wb3J0IHsgc3RyZWFtVG9CdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vYnVmZmVyLmpzJztcblxuXG5zdWl0ZSgnUmVxdWVzdCcsICgpID0+IHtcblxuXHRsZXQgcG9ydDogbnVtYmVyO1xuXHRsZXQgc2VydmVyOiBodHRwLlNlcnZlcjtcblxuXHRzZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0cG9ydCA9IGF3YWl0IG5ldyBQcm9taXNlPG51bWJlcj4oKHJlc29sdmVQb3J0LCByZWplY3RQb3J0KSA9PiB7XG5cdFx0XHRzZXJ2ZXIgPSBodHRwLmNyZWF0ZVNlcnZlcigocmVxLCByZXMpID0+IHtcblx0XHRcdFx0aWYgKHJlcS51cmwgPT09ICcvbm9yZXBseScpIHtcblx0XHRcdFx0XHRyZXR1cm47IC8vIG5ldmVyIHJlc3BvbmRcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuXHRcdFx0XHRpZiAocmVxLmhlYWRlcnNbJ2VjaG8taGVhZGVyJ10pIHtcblx0XHRcdFx0XHRyZXMuc2V0SGVhZGVyKCdlY2hvLWhlYWRlcicsIHJlcS5oZWFkZXJzWydlY2hvLWhlYWRlciddKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBkYXRhOiBCdWZmZXJbXSA9IFtdO1xuXHRcdFx0XHRyZXEub24oJ2RhdGEnLCBjaHVuayA9PiBkYXRhLnB1c2goY2h1bmspKTtcblx0XHRcdFx0cmVxLm9uKCdlbmQnLCAoKSA9PiB7XG5cdFx0XHRcdFx0cmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHRcdFx0XHRtZXRob2Q6IHJlcS5tZXRob2QsXG5cdFx0XHRcdFx0XHR1cmw6IHJlcS51cmwsXG5cdFx0XHRcdFx0XHRkYXRhOiBCdWZmZXIuY29uY2F0KGRhdGEpLnRvU3RyaW5nKClcblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSkubGlzdGVuKDAsICcxMjcuMC4wLjEnLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGFkZHJlc3MgPSBzZXJ2ZXIuYWRkcmVzcygpO1xuXHRcdFx0XHRyZXNvbHZlUG9ydCgoYWRkcmVzcyBhcyBBZGRyZXNzSW5mbykucG9ydCk7XG5cdFx0XHR9KS5vbignZXJyb3InLCBlcnIgPT4ge1xuXHRcdFx0XHRyZWplY3RQb3J0KGVycik7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVhcmRvd24oYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdHNlcnZlci5jbG9zZShlcnIgPT4gZXJyID8gcmVqZWN0KGVycikgOiByZXNvbHZlKCkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdHRVQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGV4dCA9IGF3YWl0IHJlcXVlc3Qoe1xuXHRcdFx0dXJsOiBgaHR0cDovLzEyNy4wLjAuMToke3BvcnR9YCxcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J2VjaG8taGVhZGVyJzogJ2VjaG8tdmFsdWUnXG5cdFx0XHR9XG5cdFx0fSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQucmVzLnN0YXR1c0NvZGUsIDIwMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQucmVzLmhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddLCAnYXBwbGljYXRpb24vanNvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LnJlcy5oZWFkZXJzWydlY2hvLWhlYWRlciddLCAnZWNoby12YWx1ZScpO1xuXHRcdGNvbnN0IGJ1ZmZlciA9IGF3YWl0IHN0cmVhbVRvQnVmZmVyKGNvbnRleHQuc3RyZWFtKTtcblx0XHRjb25zdCBib2R5ID0gSlNPTi5wYXJzZShidWZmZXIudG9TdHJpbmcoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJvZHkubWV0aG9kLCAnR0VUJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJvZHkudXJsLCAnLycpO1xuXHR9KTtcblxuXHR0ZXN0KCdQT1NUJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRleHQgPSBhd2FpdCByZXF1ZXN0KHtcblx0XHRcdHR5cGU6ICdQT1NUJyxcblx0XHRcdHVybDogYGh0dHA6Ly8xMjcuMC4wLjE6JHtwb3J0fS9wb3N0cGF0aGAsXG5cdFx0XHRkYXRhOiAnU29tZSBkYXRhJyxcblx0XHR9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC5yZXMuc3RhdHVzQ29kZSwgMjAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC5yZXMuaGVhZGVyc1snY29udGVudC10eXBlJ10sICdhcHBsaWNhdGlvbi9qc29uJyk7XG5cdFx0Y29uc3QgYnVmZmVyID0gYXdhaXQgc3RyZWFtVG9CdWZmZXIoY29udGV4dC5zdHJlYW0pO1xuXHRcdGNvbnN0IGJvZHkgPSBKU09OLnBhcnNlKGJ1ZmZlci50b1N0cmluZygpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYm9keS5tZXRob2QsICdQT1NUJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJvZHkudXJsLCAnL3Bvc3RwYXRoJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJvZHkuZGF0YSwgJ1NvbWUgZGF0YScpO1xuXHR9KTtcblxuXHR0ZXN0KCd0aW1lb3V0JywgYXN5bmMgKCkgPT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCByZXF1ZXN0KHtcblx0XHRcdFx0dHlwZTogJ0dFVCcsXG5cdFx0XHRcdHVybDogYGh0dHA6Ly8xMjcuMC4wLjE6JHtwb3J0fS9ub3JlcGx5YCxcblx0XHRcdFx0dGltZW91dDogMTIzLFxuXHRcdFx0fSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhc3NlcnQuZmFpbCgnU2hvdWxkIGZhaWwgd2l0aCB0aW1lb3V0Jyk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXJyLm1lc3NhZ2UsICdGZXRjaCB0aW1lb3V0OiAxMjNtcycpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnY2FuY2VsJywgYXN5bmMgKCkgPT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdGNvbnN0IHJlcyA9IHJlcXVlc3Qoe1xuXHRcdFx0XHR0eXBlOiAnR0VUJyxcblx0XHRcdFx0dXJsOiBgaHR0cDovLzEyNy4wLjAuMToke3BvcnR9L25vcmVwbHlgLFxuXHRcdFx0fSwgc291cmNlLnRva2VuKTtcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAxMDApKTtcblx0XHRcdHNvdXJjZS5jYW5jZWwoKTtcblx0XHRcdGF3YWl0IHJlcztcblx0XHRcdGFzc2VydC5mYWlsKCdTaG91bGQgZmFpbCB3aXRoIGNhbmNlbGxhdGlvbicpO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVyci5tZXNzYWdlLCAnQ2FuY2VsZWQnKTtcblx0XHR9XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFVBQVU7QUFFdEIsT0FBTyxZQUFZO0FBQ25CLFNBQVMsbUJBQW1CLCtCQUErQjtBQUMzRCxTQUFTLCtDQUErQztBQUN4RCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxzQkFBc0I7QUFHL0IsTUFBTSxXQUFXLE1BQU07QUFFdEIsTUFBSTtBQUNKLE1BQUk7QUFFSixRQUFNLFlBQVk7QUFDakIsV0FBTyxNQUFNLElBQUksUUFBZ0IsQ0FBQyxhQUFhLGVBQWU7QUFDN0QsZUFBUyxLQUFLLGFBQWEsQ0FBQyxLQUFLLFFBQVE7QUFDeEMsWUFBSSxJQUFJLFFBQVEsWUFBWTtBQUMzQjtBQUFBLFFBQ0Q7QUFDQSxZQUFJLFVBQVUsZ0JBQWdCLGtCQUFrQjtBQUNoRCxZQUFJLElB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
