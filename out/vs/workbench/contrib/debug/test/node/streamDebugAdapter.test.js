import assert from "assert";
import * as crypto from "crypto";
import * as net from "net";
import * as platform from "../../../../../base/common/platform.js";
import { tmpdir } from "os";
import { join } from "../../../../../base/common/path.js";
import * as ports from "../../../../../base/node/ports.js";
import { SocketDebugAdapter, NamedPipeDebugAdapter } from "../../node/debugAdapter.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
function sendInitializeRequest(debugAdapter) {
  return new Promise((resolve, reject) => {
    debugAdapter.sendRequest("initialize", { adapterID: "test" }, (result) => {
      resolve(result);
    }, 3e3);
  });
}
function serverConnection(socket) {
  socket.on("data", (data) => {
    const str = data.toString().split("\r\n")[2];
    const request = JSON.parse(str);
    const response = {
      seq: request.seq,
      request_seq: request.seq,
      type: "response",
      command: request.command
    };
    if (request.arguments.adapterID === "test") {
      response.success = true;
    } else {
      response.success = false;
      response.message = "failed";
    }
    const responsePayload = JSON.stringify(response);
    socket.write(`Content-Length: ${responsePayload.length}\r
\r
${responsePayload}`);
  });
}
suite("Debug - StreamDebugAdapter", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test(`StreamDebugAdapter (NamedPipeDebugAdapter) can initialize a connection`, async () => {
    const pipeName = crypto.randomBytes(10).toString("hex");
    const pipePath = platform.isWindows ? join("\\\\.\\pipe\\", pipeName) : join(tmpdir(), pipeName);
    const server = await new Promise((resolve, reject) => {
      const server2 = net.createServer(serverConnection);
      server2.once("listening", () => resolve(server2));
      server2.once("error", reject);
      server2.listen(pipePath);
    });
    const debugAdapter = new NamedPipeDebugAdapter({
      type: "pipeServer",
      path: pipePath
    });
    try {
      await debugAdapter.startSession();
      const response = await sendInitializeRequest(debugAdapter);
      assert.strictEqual(response.command, "initialize");
      assert.strictEqual(response.request_seq, 1);
      assert.strictEqual(response.success, true, response.message);
    } finally {
      await debugAdapter.stopSession();
      server.close();
      debugAdapter.dispose();
    }
  });
  test(`StreamDebugAdapter (SocketDebugAdapter) can initialize a connection`, async () => {
    const rndPort = Math.floor(Math.random() * 1e3 + 8e3);
    const port = await ports.findFreePort(
      rndPort,
      10,
      3e3,
      87
      /* skip 87 ports between attempts */
    );
    const server = net.createServer(serverConnection).listen(port);
    const debugAdapter = new SocketDebugAdapter({
      type: "server",
      port
    });
    try {
      await debugAdapter.startSession();
      const response = await sendInitializeRequest(debugAdapter);
      assert.strictEqual(response.command, "initialize");
      assert.strictEqual(response.request_seq, 1);
      assert.strictEqual(response.success, true, response.message);
    } finally {
      await debugAdapter.stopSession();
      server.close();
      debugAdapter.dispose();
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy90ZXN0L25vZGUvc3RyZWFtRGVidWdBZGFwdGVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBjcnlwdG8gZnJvbSAnY3J5cHRvJztcbmltcG9ydCAqIGFzIG5ldCBmcm9tICduZXQnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgdG1wZGlyIH0gZnJvbSAnb3MnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0ICogYXMgcG9ydHMgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9ub2RlL3BvcnRzLmpzJztcbmltcG9ydCB7IFNvY2tldERlYnVnQWRhcHRlciwgTmFtZWRQaXBlRGVidWdBZGFwdGVyLCBTdHJlYW1EZWJ1Z0FkYXB0ZXIgfSBmcm9tICcuLi8uLi9ub2RlL2RlYnVnQWRhcHRlci5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcblxuXG5mdW5jdGlvbiBzZW5kSW5pdGlhbGl6ZVJlcXVlc3QoZGVidWdBZGFwdGVyOiBTdHJlYW1EZWJ1Z0FkYXB0ZXIpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuUmVzcG9uc2U+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRkZWJ1Z0FkYXB0ZXIuc2VuZFJlcXVlc3QoJ2luaXRpYWxpemUnLCB7IGFkYXB0ZXJJRDogJ3Rlc3QnIH0sIChyZXN1bHQpID0+IHtcblx0XHRcdHJlc29sdmUocmVzdWx0KTtcblx0XHR9LCAzMDAwKTtcblx0fSk7XG59XG5cbmZ1bmN0aW9uIHNlcnZlckNvbm5lY3Rpb24oc29ja2V0OiBuZXQuU29ja2V0KSB7XG5cdHNvY2tldC5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcblx0XHRjb25zdCBzdHIgPSBkYXRhLnRvU3RyaW5nKCkuc3BsaXQoJ1xcclxcbicpWzJdO1xuXHRcdGNvbnN0IHJlcXVlc3QgPSBKU09OLnBhcnNlKHN0cik7XG5cdFx0Y29uc3QgcmVzcG9uc2U6IGFueSA9IHtcblx0XHRcdHNlcTogcmVxdWVzdC5zZXEsXG5cdFx0XHRyZXF1ZXN0X3NlcTogcmVxdWVzdC5zZXEsXG5cdFx0XHR0eXBlOiAncmVzcG9uc2UnLFxuXHRcdFx0Y29tbWFuZDogcmVxdWVzdC5jb21tYW5kXG5cdFx0fTtcblx0XHRpZiAocmVxdWVzdC5hcmd1bWVudHMuYWRhcHRlcklEID09PSAndGVzdCcpIHtcblx0XHRcdHJlc3BvbnNlLnN1Y2Nlc3MgPSB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXNwb25zZS5zdWNjZXNzID0gZmFsc2U7XG5cdFx0XHRyZXNwb25zZS5tZXNzYWdlID0gJ2ZhaWxlZCc7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzcG9uc2VQYXlsb2FkID0gSlNPTi5zdHJpbmdpZnkocmVzcG9uc2UpO1xuXHRcdHNvY2tldC53cml0ZShgQ29udGVudC1MZW5ndGg6ICR7cmVzcG9uc2VQYXlsb2FkLmxlbmd0aH1cXHJcXG5cXHJcXG4ke3Jlc3BvbnNlUGF5bG9hZH1gKTtcblx0fSk7XG59XG5cbnN1aXRlKCdEZWJ1ZyAtIFN0cmVhbURlYnVnQWRhcHRlcicsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KGBTdHJlYW1EZWJ1Z0FkYXB0ZXIgKE5hbWVkUGlwZURlYnVnQWRhcHRlcikgY2FuIGluaXRpYWxpemUgYSBjb25uZWN0aW9uYCwgYXN5bmMgKCkgPT4ge1xuXG5cdFx0Y29uc3QgcGlwZU5hbWUgPSBjcnlwdG8ucmFuZG9tQnl0ZXMoMTApLnRvU3RyaW5nKCdoZXgnKTtcblx0XHRjb25zdCBwaXBlUGF0aCA9IHBsYXRmb3JtLmlzV2luZG93cyA/IGpvaW4oJ1xcXFxcXFxcLlxcXFxwaXBlXFxcXCcsIHBpcGVOYW1lKSA6IGpvaW4odG1wZGlyKCksIHBpcGVOYW1lKTtcblx0XHRjb25zdCBzZXJ2ZXIgPSBhd2FpdCBuZXcgUHJvbWlzZTxuZXQuU2VydmVyPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRjb25zdCBzZXJ2ZXIgPSBuZXQuY3JlYXRlU2VydmVyKHNlcnZlckNvbm5lY3Rpb24pO1xuXHRcdFx0c2VydmVyLm9uY2UoJ2xpc3RlbmluZycsICgpID0+IHJlc29sdmUoc2VydmVyKSk7XG5cdFx0XHRzZXJ2ZXIub25jZSgnZXJyb3InLCByZWplY3QpO1xuXHRcdFx0c2VydmVyLmxpc3RlbihwaXBlUGF0aCk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBkZWJ1Z0FkYXB0ZXIgPSBuZXcgTmFtZWRQaXBlRGVidWdBZGFwdGVyKHtcblx0XHRcdHR5cGU6ICdwaXBlU2VydmVyJyxcblx0XHRcdHBhdGg6IHBpcGVQYXRoXG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IGRlYnVnQWRhcHRlci5zdGFydFNlc3Npb24oKTtcblx0XHRcdGNvbnN0IHJlc3BvbnNlOiBEZWJ1Z1Byb3RvY29sLlJlc3BvbnNlID0gYXdhaXQgc2VuZEluaXRpYWxpemVSZXF1ZXN0KGRlYnVnQWRhcHRlcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzcG9uc2UuY29tbWFuZCwgJ2luaXRpYWxpemUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNwb25zZS5yZXF1ZXN0X3NlcSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzcG9uc2Uuc3VjY2VzcywgdHJ1ZSwgcmVzcG9uc2UubWVzc2FnZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGF3YWl0IGRlYnVnQWRhcHRlci5zdG9wU2Vzc2lvbigpO1xuXHRcdFx0c2VydmVyLmNsb3NlKCk7XG5cdFx0XHRkZWJ1Z0FkYXB0ZXIuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdChgU3RyZWFtRGVidWdBZGFwdGVyIChTb2NrZXREZWJ1Z0FkYXB0ZXIpIGNhbiBpbml0aWFsaXplIGEgY29ubmVjdGlvbmAsIGFzeW5jICgpID0+IHtcblxuXHRcdGNvbnN0IHJuZFBvcnQgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwICsgODAwMCk7XG5cdFx0Y29uc3QgcG9ydCA9IGF3YWl0IHBvcnRzLmZpbmRGcmVlUG9ydChybmRQb3J0LCAxMCAvKiB0cnkgMTAgcG9ydHMgKi8sIDMwMDAgLyogdHJ5IHVwIHRvIDMgc2Vjb25kcyAqLywgODcgLyogc2tpcCA4NyBwb3J0cyBiZXR3ZWVuIGF0dGVtcHRzICovKTtcblx0XHRjb25zdCBzZXJ2ZXIgPSBuZXQuY3JlYXRlU2VydmVyKHNlcnZlckNvbm5lY3Rpb24pLmxpc3Rlbihwb3J0KTtcblx0XHRjb25zdCBkZWJ1Z0FkYXB0ZXIgPSBuZXcgU29ja2V0RGVidWdBZGFwdGVyKHtcblx0XHRcdHR5cGU6ICdzZXJ2ZXInLFxuXHRcdFx0cG9ydFxuXHRcdH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBkZWJ1Z0FkYXB0ZXIuc3RhcnRTZXNzaW9uKCk7XG5cdFx0XHRjb25zdCByZXNwb25zZTogRGVidWdQcm90b2NvbC5SZXNwb25zZSA9IGF3YWl0IHNlbmRJbml0aWFsaXplUmVxdWVzdChkZWJ1Z0FkYXB0ZXIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3BvbnNlLmNvbW1hbmQsICdpbml0aWFsaXplJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzcG9uc2UucmVxdWVzdF9zZXEsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3BvbnNlLnN1Y2Nlc3MsIHRydWUsIHJlc3BvbnNlLm1lc3NhZ2UpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRhd2FpdCBkZWJ1Z0FkYXB0ZXIuc3RvcFNlc3Npb24oKTtcblx0XHRcdHNlcnZlci5jbG9zZSgpO1xuXHRcdFx0ZGVidWdBZGFwdGVyLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsWUFBWSxZQUFZO0FBQ3hCLFlBQVksU0FBUztBQUNyQixZQUFZLGNBQWM7QUFDMUIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsWUFBWTtBQUNyQixZQUFZLFdBQVc7QUFDdkIsU0FBUyxvQkFBb0IsNkJBQWlEO0FBQzlFLFNBQVMsK0NBQStDO0FBR3hELFNBQVMsc0JBQXNCLGNBQW1FO0FBQ2pHLFNBQU8sSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQ3ZDLGlCQUFhLFlBQVksY0FBYyxFQUFFLFdBQVcsT0FBTyxHQUFHLENBQUMsV0FBVztBQUN6RSxjQUFRLE1BQU07QUFBQSxJQUNmLEdBQUcsR0FBSTtBQUFBLEVBQ1IsQ0FBQztBQUNGO0FBRUEsU0FBUyxpQkFBaUIsUUFBb0I7QUFDN0MsU0FBTyxHQUFHLFFBQVEsQ0FB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
