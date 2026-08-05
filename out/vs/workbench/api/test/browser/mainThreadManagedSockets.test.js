import assert from "assert";
import { disposableTimeout, timeout } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { mock } from "../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { MainThreadManagedSocket } from "../../browser/mainThreadManagedSockets.js";
suite("MainThreadManagedSockets", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  suite("ManagedSocket", () => {
    let extHost;
    let half;
    class ExtHostMock extends mock() {
      constructor() {
        super(...arguments);
        this.onDidFire = new Emitter();
        this.events = [];
      }
      $remoteSocketWrite(socketId, buffer) {
        this.events.push({ socketId, data: buffer.toString() });
        this.onDidFire.fire();
      }
      $remoteSocketDrain(socketId) {
        this.events.push({ socketId, event: "drain" });
        this.onDidFire.fire();
        return Promise.resolve();
      }
      $remoteSocketEnd(socketId) {
        this.events.push({ socketId, event: "end" });
        this.onDidFire.fire();
      }
      expectEvent(test2, message) {
        if (this.events.some(test2)) {
          return;
        }
        const d = new DisposableStore();
        return new Promise((resolve) => {
          d.add(this.onDidFire.event(() => {
            if (this.events.some(test2)) {
              return;
            }
          }));
          d.add(disposableTimeout(() => {
            throw new Error(`Expected ${message} but only had ${JSON.stringify(this.events, null, 2)}`);
          }, 1e3));
        }).finally(() => d.dispose());
      }
    }
    setup(() => {
      extHost = new ExtHostMock();
      half = {
        onClose: new Emitter(),
        onData: new Emitter(),
        onEnd: new Emitter()
      };
    });
    async function doConnect() {
      const socket = MainThreadManagedSocket.connect(1, extHost, "/hello", "world=true", "", half);
      await extHost.expectEvent((evt) => evt.data && evt.data.startsWith("GET ws://localhost/hello?world=true&skipWebSocketFrames=true HTTP/1.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key:"), "websocket open event");
      half.onData.fire(VSBuffer.fromString("Opened successfully ;)\r\n\r\n"));
      return ds.add(await socket);
    }
    test("connects", async () => {
      await doConnect();
    });
    test("includes trailing connection data", async () => {
      const socketProm = MainThreadManagedSocket.connect(1, extHost, "/hello", "world=true", "", half);
      await extHost.expectEvent((evt) => evt.data && evt.data.includes("GET ws://localhost"), "websocket open event");
      half.onData.fire(VSBuffer.fromString("Opened successfully ;)\r\n\r\nSome trailing data"));
      const socket = ds.add(await socketProm);
      const data = [];
      ds.add(socket.onData((d) => data.push(d.toString())));
      await timeout(1);
      assert.deepStrictEqual(data, ["Some trailing data"]);
    });
    test("round trips data", async () => {
      const socket = await doConnect();
      const data = [];
      ds.add(socket.onData((d) => data.push(d.toString())));
      socket.write(VSBuffer.fromString("ping"));
      await extHost.expectEvent((evt) => evt.data === "ping", "expected ping");
      half.onData.fire(VSBuffer.fromString("pong"));
      assert.deepStrictEqual(data, ["pong"]);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9tYWluVGhyZWFkTWFuYWdlZFNvY2tldHMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGRpc3Bvc2FibGVUaW1lb3V0LCB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTb2NrZXRDbG9zZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9wYXJ0cy9pcGMvY29tbW9uL2lwYy5uZXQuanMnO1xuaW1wb3J0IHsgbW9jayB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFJlbW90ZVNvY2tldEhhbGYgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL21hbmFnZWRTb2NrZXQuanMnO1xuaW1wb3J0IHsgTWFpblRocmVhZE1hbmFnZWRTb2NrZXQgfSBmcm9tICcuLi8uLi9icm93c2VyL21haW5UaHJlYWRNYW5hZ2VkU29ja2V0cy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0TWFuYWdlZFNvY2tldHNTaGFwZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0LnByb3RvY29sLmpzJztcblxuc3VpdGUoJ01haW5UaHJlYWRNYW5hZ2VkU29ja2V0cycsICgpID0+IHtcblxuXHRjb25zdCBkcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHN1aXRlKCdNYW5hZ2VkU29ja2V0JywgKCkgPT4ge1xuXHRcdGxldCBleHRIb3N0OiBFeHRIb3N0TW9jaztcblx0XHRsZXQgaGFsZjogUmVtb3RlU29ja2V0SGFsZjtcblxuXHRcdGNsYXNzIEV4dEhvc3RNb2NrIGV4dGVuZHMgbW9jazxFeHRIb3N0TWFuYWdlZFNvY2tldHNTaGFwZT4oKSB7XG5cdFx0XHRwcml2YXRlIG9uRGlkRmlyZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdFx0XHRwdWJsaWMgcmVhZG9ubHkgZXZlbnRzOiBhbnlbXSA9IFtdO1xuXG5cdFx0XHRvdmVycmlkZSAkcmVtb3RlU29ja2V0V3JpdGUoc29ja2V0SWQ6IG51bWJlciwgYnVmZmVyOiBWU0J1ZmZlcik6IHZvaWQge1xuXHRcdFx0XHR0aGlzLmV2ZW50cy5wdXNoKHsgc29ja2V0SWQsIGRhdGE6IGJ1ZmZlci50b1N0cmluZygpIH0pO1xuXHRcdFx0XHR0aGlzLm9uRGlkRmlyZS5maXJlKCk7XG5cdFx0XHR9XG5cblx0XHRcdG92ZXJyaWRlICRyZW1vdGVTb2NrZXREcmFpbihzb2NrZXRJZDogbnVtYmVyKSB7XG5cdFx0XHRcdHRoaXMuZXZlbnRzLnB1c2goeyBzb2NrZXRJZCwgZXZlbnQ6ICdkcmFpbicgfSk7XG5cdFx0XHRcdHRoaXMub25EaWRGaXJlLmZpcmUoKTtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRvdmVycmlkZSAkcmVtb3RlU29ja2V0RW5kKHNvY2tldElkOiBudW1iZXIpIHtcblx0XHRcdFx0dGhpcy5ldmVudHMucHVzaCh7IHNvY2tldElkLCBldmVudDogJ2VuZCcgfSk7XG5cdFx0XHRcdHRoaXMub25EaWRGaXJlLmZpcmUoKTtcblx0XHRcdH1cblxuXHRcdFx0ZXhwZWN0RXZlbnQodGVzdDogKGV2dDogYW55KSA9PiB2b2lkLCBtZXNzYWdlOiBzdHJpbmcpIHtcblx0XHRcdFx0aWYgKHRoaXMuZXZlbnRzLnNvbWUodGVzdCkpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBkID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdFx0ZC5hZGQodGhpcy5vbkRpZEZpcmUuZXZlbnQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKHRoaXMuZXZlbnRzLnNvbWUodGVzdCkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHRkLmFkZChkaXNwb3NhYmxlVGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICR7bWVzc2FnZX0gYnV0IG9ubHkgaGFkICR7SlNPTi5zdHJpbmdpZnkodGhpcy5ldmVudHMsIG51bGwsIDIpfWApO1xuXHRcdFx0XHRcdH0sIDEwMDApKTtcblx0XHRcdFx0fSkuZmluYWxseSgoKSA9PiBkLmRpc3Bvc2UoKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0ZXh0SG9zdCA9IG5ldyBFeHRIb3N0TW9jaygpO1xuXHRcdFx0aGFsZiA9IHtcblx0XHRcdFx0b25DbG9zZTogbmV3IEVtaXR0ZXI8U29ja2V0Q2xvc2VFdmVudD4oKSxcblx0XHRcdFx0b25EYXRhOiBuZXcgRW1pdHRlcjxWU0J1ZmZlcj4oKSxcblx0XHRcdFx0b25FbmQ6IG5ldyBFbWl0dGVyPHZvaWQ+KCksXG5cdFx0XHR9O1xuXHRcdH0pO1xuXG5cdFx0YXN5bmMgZnVuY3Rpb24gZG9Db25uZWN0KCkge1xuXHRcdFx0Y29uc3Qgc29ja2V0ID0gTWFpblRocmVhZE1hbmFnZWRTb2NrZXQuY29ubmVjdCgxLCBleHRIb3N0LCAnL2hlbGxvJywgJ3dvcmxkPXRydWUnLCAnJywgaGFsZik7XG5cdFx0XHRhd2FpdCBleHRIb3N0LmV4cGVjdEV2ZW50KGV2dCA9PiBldnQuZGF0YSAmJiBldnQuZGF0YS5zdGFydHNXaXRoKCdHRVQgd3M6Ly9sb2NhbGhvc3QvaGVsbG8/d29ybGQ9dHJ1ZSZza2lwV2ViU29ja2V0RnJhbWVzPXRydWUgSFRUUC8xLjFcXHJcXG5Db25uZWN0aW9uOiBVcGdyYWRlXFxyXFxuVXBncmFkZTogd2Vic29ja2V0XFxyXFxuU2VjLVdlYlNvY2tldC1LZXk6JyksICd3ZWJzb2NrZXQgb3BlbiBldmVudCcpO1xuXHRcdFx0aGFsZi5vbkRhdGEuZmlyZShWU0J1ZmZlci5mcm9tU3RyaW5nKCdPcGVuZWQgc3VjY2Vzc2Z1bGx5IDspXFxyXFxuXFxyXFxuJykpO1xuXHRcdFx0cmV0dXJuIGRzLmFkZChhd2FpdCBzb2NrZXQpO1xuXHRcdH1cblxuXHRcdHRlc3QoJ2Nvbm5lY3RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgZG9Db25uZWN0KCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpbmNsdWRlcyB0cmFpbGluZyBjb25uZWN0aW9uIGRhdGEnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBzb2NrZXRQcm9tID0gTWFpblRocmVhZE1hbmFnZWRTb2NrZXQuY29ubmVjdCgxLCBleHRIb3N0LCAnL2hlbGxvJywgJ3dvcmxkPXRydWUnLCAnJywgaGFsZik7XG5cdFx0XHRhd2FpdCBleHRIb3N0LmV4cGVjdEV2ZW50KGV2dCA9PiBldnQuZGF0YSAmJiBldnQuZGF0YS5pbmNsdWRlcygnR0VUIHdzOi8vbG9jYWxob3N0JyksICd3ZWJzb2NrZXQgb3BlbiBldmVudCcpO1xuXHRcdFx0aGFsZi5vbkRhdGEuZmlyZShWU0J1ZmZlci5mcm9tU3RyaW5nKCdPcGVuZWQgc3VjY2Vzc2Z1bGx5IDspXFxyXFxuXFxyXFxuU29tZSB0cmFpbGluZyBkYXRhJykpO1xuXHRcdFx0Y29uc3Qgc29ja2V0ID0gZHMuYWRkKGF3YWl0IHNvY2tldFByb20pO1xuXG5cdFx0XHRjb25zdCBkYXRhOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0ZHMuYWRkKHNvY2tldC5vbkRhdGEoZCA9PiBkYXRhLnB1c2goZC50b1N0cmluZygpKSkpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgxKTsgLy8gYWxsb3cgbWljcm90YXNrcyB0byBmbHVzaFxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChkYXRhLCBbJ1NvbWUgdHJhaWxpbmcgZGF0YSddKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3JvdW5kIHRyaXBzIGRhdGEnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBzb2NrZXQgPSBhd2FpdCBkb0Nvbm5lY3QoKTtcblx0XHRcdGNvbnN0IGRhdGE6IHN0cmluZ1tdID0gW107XG5cdFx0XHRkcy5hZGQoc29ja2V0Lm9uRGF0YShkID0+IGRhdGEucHVzaChkLnRvU3RyaW5nKCkpKSk7XG5cblx0XHRcdHNvY2tldC53cml0ZShWU0J1ZmZlci5mcm9tU3RyaW5nKCdwaW5nJykpO1xuXHRcdFx0YXdhaXQgZXh0SG9zdC5leHBlY3RFdmVudChldnQgPT4gZXZ0LmRhdGEgPT09ICdwaW5nJywgJ2V4cGVjdGVkIHBpbmcnKTtcblx0XHRcdGhhbGYub25EYXRhLmZpcmUoVlNCdWZmZXIuZnJvbVN0cmluZyhcInBvbmdcIikpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChkYXRhLCBbJ3BvbmcnXSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxtQkFBbUIsZUFBZTtBQUMzQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGVBQWU7QUFDeEIsU0FBUyx1QkFBdUI7QUFFaEMsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsK0NBQStDO0FBRXhELFNBQVMsK0JBQStCO0FBR3hDLE1BQU0sNEJBQTRCLE1BQU07QUFFdkMsUUFBTSxLQUFLLHdDQUF3QztBQUVuRCxRQUFNLGlCQUFpQixNQUFNO0FBQzVCLFFBQUk7QUFDSixRQUFJO0FBQUEsSUFFSixNQUFNLG9CQUFvQixLQUFpQyxFQUFFO0FBQUEsTUFBN0Q7QUFBQTtBQUNDLGFBQVEsWUFBWSxJQUFJLFFBQWM7QUFDdEMsYUFBZ0IsU0FBZ0IsQ0FBQztBQUFBO0FBQUEsTUFFeEIsbUJBQW1CLFVBQWtCLFFBQXdCO0FBQ3JFLGFBQUssT0FBTyxLQUFLLEVBQUUsVUFBVSxNQUFNLE9BQU8sU0FBUyxFQUFFLENBQUM7QUFDdEQsYUFBSyxVQUFVLEtBQUs7QUFBQSxNQUNyQjtBQUFBLE1BRVMsbUJBQW1CLFVBQWtCO0FBQzdDLGFBQUssT0FBTyxLQUFLLEVBQUUsVUFBVSxPQUFPLFFBQVEsQ0FBQztBQUM3QyxhQUFLLFVBQVUsS0FBSztBQUNwQixlQUFPLFFBQVEsUUFBUTtBQUFBLE1BQ3hCO0FBQUEsTUFFUyxpQkFBaUIsVUFBa0I7QUFDM0MsYUFBSyxPQUFPLEtBQUssRUFBRSxVQUFVLE9BQU8sTUFBTSxDQUFDO0FBQzNDLGFBQUssVUFBVSxLQUFLO0FBQUEsTUFDckI7QUFB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
