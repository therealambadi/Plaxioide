import assert from "assert";
import * as cp from "child_process";
import { FileAccess } from "../../../common/network.js";
import * as objects from "../../../common/objects.js";
import * as platform from "../../../common/platform.js";
import * as processes from "../../../node/processes.js";
function fork(id) {
  const opts = {
    env: objects.mixin(objects.deepClone(process.env), {
      VSCODE_ESM_ENTRYPOINT: id,
      VSCODE_PIPE_LOGGING: "true",
      VSCODE_VERBOSE_LOGGING: true
    })
  };
  return cp.fork(FileAccess.asFileUri("bootstrap-fork").fsPath, ["--type=processTests"], opts);
}
suite("Processes", () => {
  test("buffered sending - simple data", function(done) {
    if (process.env["VSCODE_PID"]) {
      return done();
    }
    const child = fork("vs/base/test/node/processes/fixtures/fork");
    const sender = processes.createQueuedSender(child);
    let counter = 0;
    const msg1 = "Hello One";
    const msg2 = "Hello Two";
    const msg3 = "Hello Three";
    child.on("message", (msgFromChild) => {
      if (msgFromChild === "ready") {
        sender.send(msg1);
        sender.send(msg2);
        sender.send(msg3);
      } else {
        counter++;
        if (counter === 1) {
          assert.strictEqual(msgFromChild, msg1);
        } else if (counter === 2) {
          assert.strictEqual(msgFromChild, msg2);
        } else if (counter === 3) {
          assert.strictEqual(msgFromChild, msg3);
          child.kill();
          done();
        }
      }
    });
  });
  (!platform.isWindows || process.env["VSCODE_PID"] ? test.skip : test)("buffered sending - lots of data (potential deadlock on win32)", function(done) {
    const child = fork("vs/base/test/node/processes/fixtures/fork_large");
    const sender = processes.createQueuedSender(child);
    const largeObj = /* @__PURE__ */ Object.create(null);
    for (let i = 0; i < 1e4; i++) {
      largeObj[i] = "some data";
    }
    const msg = JSON.stringify(largeObj);
    child.on("message", (msgFromChild) => {
      if (msgFromChild === "ready") {
        sender.send(msg);
        sender.send(msg);
        sender.send(msg);
      } else if (msgFromChild === "done") {
        child.kill();
        done();
      }
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3Qvbm9kZS9wcm9jZXNzZXMvcHJvY2Vzc2VzLmludGVncmF0aW9uVGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCAqIGFzIGNwIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgRmlsZUFjY2VzcyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCAqIGFzIG9iamVjdHMgZnJvbSAnLi4vLi4vLi4vY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCAqIGFzIHByb2Nlc3NlcyBmcm9tICcuLi8uLi8uLi9ub2RlL3Byb2Nlc3Nlcy5qcyc7XG5cbmZ1bmN0aW9uIGZvcmsoaWQ6IHN0cmluZyk6IGNwLkNoaWxkUHJvY2VzcyB7XG5cdGNvbnN0IG9wdHM6IGFueSA9IHtcblx0XHRlbnY6IG9iamVjdHMubWl4aW4ob2JqZWN0cy5kZWVwQ2xvbmUocHJvY2Vzcy5lbnYpLCB7XG5cdFx0XHRWU0NPREVfRVNNX0VOVFJZUE9JTlQ6IGlkLFxuXHRcdFx0VlNDT0RFX1BJUEVfTE9HR0lORzogJ3RydWUnLFxuXHRcdFx0VlNDT0RFX1ZFUkJPU0VfTE9HR0lORzogdHJ1ZVxuXHRcdH0pXG5cdH07XG5cblx0cmV0dXJuIGNwLmZvcmsoRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoJ2Jvb3RzdHJhcC1mb3JrJykuZnNQYXRoLCBbJy0tdHlwZT1wcm9jZXNzVGVzdHMnXSwgb3B0cyk7XG59XG5cbnN1aXRlKCdQcm9jZXNzZXMnLCAoKSA9PiB7XG5cdHRlc3QoJ2J1ZmZlcmVkIHNlbmRpbmcgLSBzaW1wbGUgZGF0YScsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0aWYgKHByb2Nlc3MuZW52WydWU0NPREVfUElEJ10pIHtcblx0XHRcdHJldHVybiBkb25lKCk7IC8vIHRoaXMgdGVzdCBmYWlscyB3aGVuIHJ1biBmcm9tIHdpdGhpbiBWUyBDb2RlXG5cdFx0fVxuXG5cdFx0Y29uc3QgY2hpbGQgPSBmb3JrKCd2cy9iYXNlL3Rlc3Qvbm9kZS9wcm9jZXNzZXMvZml4dHVyZXMvZm9yaycpO1xuXHRcdGNvbnN0IHNlbmRlciA9IHByb2Nlc3Nlcy5jcmVhdGVRdWV1ZWRTZW5kZXIoY2hpbGQpO1xuXG5cdFx0bGV0IGNvdW50ZXIgPSAwO1xuXG5cdFx0Y29uc3QgbXNnMSA9ICdIZWxsbyBPbmUnO1xuXHRcdGNvbnN0IG1zZzIgPSAnSGVsbG8gVHdvJztcblx0XHRjb25zdCBtc2czID0gJ0hlbGxvIFRocmVlJztcblxuXHRcdGNoaWxkLm9uKCdtZXNzYWdlJywgbXNnRnJvbUNoaWxkID0+IHtcblx0XHRcdGlmIChtc2dGcm9tQ2hpbGQgPT09ICdyZWFkeScpIHtcblx0XHRcdFx0c2VuZGVyLnNlbmQobXNnMSk7XG5cdFx0XHRcdHNlbmRlci5zZW5kKG1zZzIpO1xuXHRcdFx0XHRzZW5kZXIuc2VuZChtc2czKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvdW50ZXIrKztcblxuXHRcdFx0XHRpZiAoY291bnRlciA9PT0gMSkge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtc2dGcm9tQ2hpbGQsIG1zZzEpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGNvdW50ZXIgPT09IDIpIHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobXNnRnJvbUNoaWxkLCBtc2cyKTtcblx0XHRcdFx0fSBlbHNlIGlmIChjb3VudGVyID09PSAzKSB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1zZ0Zyb21DaGlsZCwgbXNnMyk7XG5cblx0XHRcdFx0XHRjaGlsZC5raWxsKCk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXG5cdCghcGxhdGZvcm0uaXNXaW5kb3dzIHx8IHByb2Nlc3MuZW52WydWU0NPREVfUElEJ10gPyB0ZXN0LnNraXAgOiB0ZXN0KSgnYnVmZmVyZWQgc2VuZGluZyAtIGxvdHMgb2YgZGF0YSAocG90ZW50aWFsIGRlYWRsb2NrIG9uIHdpbjMyKScsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7IC8vIHRlc3QgaXMgb25seSByZWxldmFudCBmb3IgV2luZG93cyBhbmQgc2VlbXMgdG8gY3Jhc2ggcmFuZG9tbHkgb24gc29tZSBMaW51eCBidWlsZHNcblx0XHRjb25zdCBjaGlsZCA9IGZvcmsoJ3ZzL2Jhc2UvdGVzdC9ub2RlL3Byb2Nlc3Nlcy9maXh0dXJlcy9mb3JrX2xhcmdlJyk7XG5cdFx0Y29uc3Qgc2VuZGVyID0gcHJvY2Vzc2VzLmNyZWF0ZVF1ZXVlZFNlbmRlcihjaGlsZCk7XG5cblx0XHRjb25zdCBsYXJnZU9iaiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxMDAwMDsgaSsrKSB7XG5cdFx0XHRsYXJnZU9ialtpXSA9ICdzb21lIGRhdGEnO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1zZyA9IEpTT04uc3RyaW5naWZ5KGxhcmdlT2JqKTtcblx0XHRjaGlsZC5vbignbWVzc2FnZScsIG1zZ0Zyb21DaGlsZCA9PiB7XG5cdFx0XHRpZiAobXNnRnJvbUNoaWxkID09PSAncmVhZHknKSB7XG5cdFx0XHRcdHNlbmRlci5zZW5kKG1zZyk7XG5cdFx0XHRcdHNlbmRlci5zZW5kKG1zZyk7XG5cdFx0XHRcdHNlbmRlci5zZW5kKG1zZyk7XG5cdFx0XHR9IGVsc2UgaWYgKG1zZ0Zyb21DaGlsZCA9PT0gJ2RvbmUnKSB7XG5cdFx0XHRcdGNoaWxkLmtpbGwoKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFlBQVksUUFBUTtBQUNwQixTQUFTLGtCQUFrQjtBQUMzQixZQUFZLGFBQWE7QUFDekIsWUFBWSxjQUFjO0FBQzFCLFlBQVksZUFBZTtBQUUzQixTQUFTLEtBQUssSUFBNkI7QUFDMUMsUUFBTSxPQUFZO0FBQUEsSUFDakIsS0FBSyxRQUFRLE1BQU0sUUFBUSxVQUFVLFFBQVEsR0FBRyxHQUFHO0FBQUEsTUFDbEQsdUJBQXVCO0FBQUEsTUFDdkIscUJBQXFCO0FBQUEsTUFDckIsd0JBQXdCO0FBQUEsSUFDekIsQ0FBQztBQUFBLEVBQ0Y7QUFFQSxTQUFPLEdBQUcsS0FBSyxXQUFXLFVBQVUsZ0JBQWdCLEVBQUUsUUFBUSxDQUFDLHFCQUFxQixHQUFHLElBQUk7QUFDNUY7QUFFQSxNQUFNLGFBQWEsTUFBTTtBQUN4QixPQUFLLGtDQUFrQyxTQUFVLE1BQWtCO0FBQ2xFLFFBQUksUUFBUSxJQUFJLFlBQVksR0FBRztBQUM5QixhQUFPLEtBQUs7QUFBQSxJQUNiO0FBRUEsVUFBTSxRQUFRLEtBQUssMkNBQTJDO0FBQzlELFVBQU0sU0FBUyxVQUFVLG1CQUFtQixLQUFLO0FBRWpELFFBQUksVUFBVTtBQUVkLFVBQU0sT0FBTztBQUNiLFVBQU0sT0FBTztBQUNiLFVBQU0sT0FBTztBQUViLFVBQU0sR0FBRyxXQUFXLGtCQUFnQjtBQUNuQyxVQUFJLGlCQUFpQixTQUFTO0FBQzdCLGVBQU8sS0FBSyxJQUFJO0FBQ2hCLGVBQU8sS0FBSyxJQUFJO0FBQ2hCLGVBQU8sS0FBSyxJQUFJO0FBQUEsTUFDakIsT0FBTztBQUNOO0FBRUEsWUFBSSxZQUFZLEdBQUc7QUFDbEIsaUJBQU8sWUFBWSxjQUFjLElBQUk7QUFBQSxRQUN0QyxXQUFXLFlBQVksR0FBRztBQUN6QixpQkFBTyxZQUFZLGNBQWMsSUFBSTtBQUFBLFFBQ3RDLFdBQVcsWUFBWSxHQUFHO0FBQ3pCLGlCQUFPLFlBQVksY0FBYyxJQUFJO0FBRXJDLGdCQUFNLEtBQUs7QUFDWCxlQUFLO0FBQUEsUUFDTjtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxHQUFDLENBQUMsU0FBUyxhQUFhLFFBQVEsSUFBSSxZQUFZLElBQUksS0FBSyxPQUFPLE1BQU0saUVBQWlFLFNBQVUsTUFBa0I7QUFDbEssVUFBTSxRQUFRLEtBQUssaURBQWlEO0FBQ3BFLFVBQU0sU0FBUyxVQUFVLG1CQUFtQixLQUFLO0FBRWpELFVBQU0sV0FBVyx1QkFBTyxPQUFPLElBQUk7QUFDbkMsYUFBUyxJQUFJLEdBQUcsSUFBSSxLQUFPLEtBQUs7QUFDL0IsZUFBUyxDQUFDLElBQUk7QUFBQSxJQUNmO0FBRUEsVUFBTSxNQUFNLEtBQUssVUFBVSxRQUFRO0FBQ25DLFVBQU0sR0FBRyxXQUFXLGtCQUFnQjtBQUNuQyxVQUFJLGlCQUFpQixTQUFTO0FBQzdCLGVBQU8sS0FBSyxHQUFHO0FBQ2YsZUFBTyxLQUFLLEdBQUc7QUFDZixlQUFPLEtBQUssR0FBRztBQUFBLE1BQ2hCLFdBQVcsaUJBQWlCLFFBQVE7QUFDbkMsY0FBTSxLQUFLO0FBQ1gsYUFBSztBQUFBLE1BQ047QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
