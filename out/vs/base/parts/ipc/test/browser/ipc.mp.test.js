import assert from "assert";
import { Client as MessagePortClient } from "../../browser/ipc.mp.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../test/common/utils.js";
suite("IPC, MessagePorts", () => {
  test("message passing", async () => {
    const { port1, port2 } = new MessageChannel();
    const client1 = new MessagePortClient(port1, "client1");
    const client2 = new MessagePortClient(port2, "client2");
    client1.registerChannel("client1", {
      call(_, command, arg, cancellationToken) {
        switch (command) {
          case "testMethodClient1":
            return Promise.resolve("success1");
          default:
            return Promise.reject(new Error("not implemented"));
        }
      },
      listen(_, event, arg) {
        switch (event) {
          default:
            throw new Error("not implemented");
        }
      }
    });
    client2.registerChannel("client2", {
      call(_, command, arg, cancellationToken) {
        switch (command) {
          case "testMethodClient2":
            return Promise.resolve("success2");
          default:
            return Promise.reject(new Error("not implemented"));
        }
      },
      listen(_, event, arg) {
        switch (event) {
          default:
            throw new Error("not implemented");
        }
      }
    });
    const channelClient1 = client2.getChannel("client1");
    assert.strictEqual(await channelClient1.call("testMethodClient1"), "success1");
    const channelClient2 = client1.getChannel("client2");
    assert.strictEqual(await channelClient2.call("testMethodClient2"), "success2");
    client1.dispose();
    client2.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3BhcnRzL2lwYy90ZXN0L2Jyb3dzZXIvaXBjLm1wLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgQ2xpZW50IGFzIE1lc3NhZ2VQb3J0Q2xpZW50IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9pcGMubXAuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5zdWl0ZSgnSVBDLCBNZXNzYWdlUG9ydHMnLCAoKSA9PiB7XG5cblx0dGVzdCgnbWVzc2FnZSBwYXNzaW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcG9ydDEsIHBvcnQyIH0gPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcblxuXHRcdGNvbnN0IGNsaWVudDEgPSBuZXcgTWVzc2FnZVBvcnRDbGllbnQocG9ydDEsICdjbGllbnQxJyk7XG5cdFx0Y29uc3QgY2xpZW50MiA9IG5ldyBNZXNzYWdlUG9ydENsaWVudChwb3J0MiwgJ2NsaWVudDInKTtcblxuXHRcdGNsaWVudDEucmVnaXN0ZXJDaGFubmVsKCdjbGllbnQxJywge1xuXHRcdFx0Y2FsbChfOiB1bmtub3duLCBjb21tYW5kOiBzdHJpbmcsIGFyZzogYW55LCBjYW5jZWxsYXRpb25Ub2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGFueT4ge1xuXHRcdFx0XHRzd2l0Y2ggKGNvbW1hbmQpIHtcblx0XHRcdFx0XHRjYXNlICd0ZXN0TWV0aG9kQ2xpZW50MSc6IHJldHVybiBQcm9taXNlLnJlc29sdmUoJ3N1Y2Nlc3MxJyk7XG5cdFx0XHRcdFx0ZGVmYXVsdDogcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJykpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRsaXN0ZW4oXzogdW5rbm93biwgZXZlbnQ6IHN0cmluZywgYXJnPzogYW55KTogRXZlbnQ8YW55PiB7XG5cdFx0XHRcdHN3aXRjaCAoZXZlbnQpIHtcblx0XHRcdFx0XHRkZWZhdWx0OiB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjbGllbnQyLnJlZ2lzdGVyQ2hhbm5lbCgnY2xpZW50MicsIHtcblx0XHRcdGNhbGwoXzogdW5rbm93biwgY29tbWFuZDogc3RyaW5nLCBhcmc6IGFueSwgY2FuY2VsbGF0aW9uVG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxhbnk+IHtcblx0XHRcdFx0c3dpdGNoIChjb21tYW5kKSB7XG5cdFx0XHRcdFx0Y2FzZSAndGVzdE1ldGhvZENsaWVudDInOiByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCdzdWNjZXNzMicpO1xuXHRcdFx0XHRcdGRlZmF1bHQ6IHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0bGlzdGVuKF86IHVua25vd24sIGV2ZW50OiBzdHJpbmcsIGFyZz86IGFueSk6IEV2ZW50PGFueT4ge1xuXHRcdFx0XHRzd2l0Y2ggKGV2ZW50KSB7XG5cdFx0XHRcdFx0ZGVmYXVsdDogdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY2hhbm5lbENsaWVudDEgPSBjbGllbnQyLmdldENoYW5uZWwoJ2NsaWVudDEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgY2hhbm5lbENsaWVudDEuY2FsbCgndGVzdE1ldGhvZENsaWVudDEnKSwgJ3N1Y2Nlc3MxJyk7XG5cblx0XHRjb25zdCBjaGFubmVsQ2xpZW50MiA9IGNsaWVudDEuZ2V0Q2hhbm5lbCgnY2xpZW50MicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBjaGFubmVsQ2xpZW50Mi5jYWxsKCd0ZXN0TWV0aG9kQ2xpZW50MicpLCAnc3VjY2VzczInKTtcblxuXHRcdGNsaWVudDEuZGlzcG9zZSgpO1xuXHRcdGNsaWVudDIuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBR25CLFNBQVMsVUFBVSx5QkFBeUI7QUFDNUMsU0FBUywrQ0FBK0M7QUFFeEQsTUFBTSxxQkFBcUIsTUFBTTtBQUVoQyxPQUFLLG1CQUFtQixZQUFZO0FBQ25DLFVBQU0sRUFBRSxPQUFPLE1BQU0sSUFBSSxJQUFJLGVBQWU7QUFFNUMsVUFBTSxVQUFVLElBQUksa0JBQWtCLE9BQU8sU0FBUztBQUN0RCxVQUFNLFVBQVUsSUFBSSxrQkFBa0IsT0FBTyxTQUFTO0FBRXRELFlBQVEsZ0JBQWdCLFdBQVc7QUFBQSxNQUNsQyxLQUFLLEdBQVksU0FBaUIsS0FBVSxtQkFBb0Q7QUFDL0YsZ0JBQVEsU0FBUztBQUFBLFVBQ2hCLEtBQUs7QUFBcUIsbUJBQU8sUUFBUSxRQUFRLFVBQVU7QUFBQSxVQUMzRDtBQUFTLG1CQUFPLFFBQVEsT0FBTyxJQUFJLE1BQU0saUJBQWlCLENBQUM7QUFBQSxRQUM1RDtBQUFBLE1BQ0Q7QUFBQSxNQUVBLE9BQU8sR0FBWSxPQUFlLEtBQXVCO0FBQ3hELGdCQUFRLE9BQU87QUFBQSxVQUNkO0FBQVMsa0JBQU0sSUFBSSxNQUFNLGlCQUFpQjtBQUFBLFFBQzNDO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUVELFlBQVEsZ0JBQWdCLFdBQVc7QUFBQSxNQUNsQyxLQUFLLEdBQVksU0FBaUIsS0FBVSxtQkFBb0Q7QUFDL0YsZ0JBQVEsU0FBUztBQUFBLFVBQ2hCLEtBQUs7QUFBcUIsbUJBQU8sUUFBUSxRQUFRLFVBQVU7QUFBQSxVQUMzRDtBQUFTLG1CQUFPLFFBQVEsT0FBTyxJQUFJLE1BQU0saUJBQWlCLENBQUM7QUFBQSxRQUM1RDtBQUFBLE1BQ0Q7QUFBQSxNQUVBLE9BQU8sR0FBWSxPQUFlLEtBQXVCO0FBQ3hELGdCQUFRLE9BQU87QUFBQSxVQUNkO0FBQVMsa0JBQU0sSUFBSSxNQUFNLGlCQUFpQjtBQUFBLFFBQzNDO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUVELFVBQU0saUJBQWlCLFFBQVEsV0FBVyxTQUFTO0FBQ25ELFdBQU8sWUFBWSxNQUFNLGVBQWUsS0FBSyxtQkFBbUIsR0FBRyxVQUFVO0FBRTdFLFVBQU0saUJBQWlCLFFBQVEsV0FBVyxTQUFTO0FBQ25ELFdBQU8sWUFBWSxNQUFNLGVBQWUsS0FBSyxtQkFBbUIsR0FBRyxVQUFVO0FBRTdFLFlBQVEsUUFBUTtBQUNoQixZQUFRLFFBQVE7QUFBQSxFQUNqQixDQUFDO0FBRUQsMENBQXdDO0FBQ3pDLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
