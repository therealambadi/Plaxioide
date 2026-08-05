import assert from "assert";
import { timeout } from "../../../../common/async.js";
import { VSBuffer } from "../../../../common/buffer.js";
import { CancellationToken, CancellationTokenSource } from "../../../../common/cancellation.js";
import { canceled } from "../../../../common/errors.js";
import { Emitter, Event } from "../../../../common/event.js";
import { DisposableStore } from "../../../../common/lifecycle.js";
import { isEqual } from "../../../../common/resources.js";
import { URI } from "../../../../common/uri.js";
import { BufferReader, BufferWriter, deserialize, IPCClient, IPCServer, ProxyChannel, serialize } from "../../common/ipc.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../test/common/utils.js";
class QueueProtocol {
  constructor() {
    this.buffering = true;
    this.buffers = [];
    this._onMessage = new Emitter({
      onDidAddFirstListener: () => {
        for (const buffer of this.buffers) {
          this._onMessage.fire(buffer);
        }
        this.buffers = [];
        this.buffering = false;
      },
      onDidRemoveLastListener: () => {
        this.buffering = true;
      }
    });
    this.onMessage = this._onMessage.event;
  }
  send(buffer) {
    this.other.receive(buffer);
  }
  receive(buffer) {
    if (this.buffering) {
      this.buffers.push(buffer);
    } else {
      this._onMessage.fire(buffer);
    }
  }
}
function createProtocolPair() {
  const one = new QueueProtocol();
  const other = new QueueProtocol();
  one.other = other;
  other.other = one;
  return [one, other];
}
class TestIPCClient extends IPCClient {
  constructor(protocol, id) {
    super(protocol, id);
    this._onDidDisconnect = new Emitter();
    this.onDidDisconnect = this._onDidDisconnect.event;
  }
  dispose() {
    this._onDidDisconnect.fire();
    super.dispose();
  }
}
class TestIPCServer extends IPCServer {
  constructor() {
    const onDidClientConnect = new Emitter();
    super(onDidClientConnect.event);
    this.onDidClientConnect = onDidClientConnect;
  }
  createConnection(id) {
    const [pc, ps] = createProtocolPair();
    const client = new TestIPCClient(pc, id);
    this.onDidClientConnect.fire({
      protocol: ps,
      onDidClientDisconnect: client.onDidDisconnect
    });
    return client;
  }
}
const TestChannelId = "testchannel";
class TestService {
  constructor() {
    this.disposables = new DisposableStore();
    this._onPong = new Emitter();
    this.onPong = this._onPong.event;
  }
  marco() {
    return Promise.resolve("polo");
  }
  error(message) {
    return Promise.reject(new Error(message));
  }
  neverComplete() {
    return new Promise((_) => {
    });
  }
  neverCompleteCT(cancellationToken) {
    if (cancellationToken.isCancellationRequested) {
      return Promise.reject(canceled());
    }
    return new Promise((_, e) => this.disposables.add(cancellationToken.onCancellationRequested(() => e(canceled()))));
  }
  buffersLength(buffers) {
    return Promise.resolve(buffers.reduce((r, b) => r + b.buffer.length, 0));
  }
  ping(msg) {
    this._onPong.fire(msg);
  }
  marshall(uri) {
    return Promise.resolve(uri);
  }
  context(context) {
    return Promise.resolve(context);
  }
  dispose() {
    this.disposables.dispose();
  }
}
class TestChannel {
  constructor(service) {
    this.service = service;
  }
  call(_, command, arg, cancellationToken) {
    switch (command) {
      case "marco":
        return this.service.marco();
      case "error":
        return this.service.error(arg);
      case "neverComplete":
        return this.service.neverComplete();
      case "neverCompleteCT":
        return this.service.neverCompleteCT(cancellationToken);
      case "buffersLength":
        return this.service.buffersLength(arg);
      default:
        return Promise.reject(new Error("not implemented"));
    }
  }
  listen(_, event, arg) {
    switch (event) {
      case "onPong":
        return this.service.onPong;
      default:
        throw new Error("not implemented");
    }
  }
}
class TestChannelClient {
  constructor(channel) {
    this.channel = channel;
  }
  get onPong() {
    return this.channel.listen("onPong");
  }
  marco() {
    return this.channel.call("marco");
  }
  error(message) {
    return this.channel.call("error", message);
  }
  neverComplete() {
    return this.channel.call("neverComplete");
  }
  neverCompleteCT(cancellationToken) {
    return this.channel.call("neverCompleteCT", void 0, cancellationToken);
  }
  buffersLength(buffers) {
    return this.channel.call("buffersLength", buffers);
  }
  marshall(uri) {
    return this.channel.call("marshall", uri);
  }
  context() {
    return this.channel.call("context");
  }
}
suite("Base IPC", function() {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  test("createProtocolPair", async function() {
    const [clientProtocol, serverProtocol] = createProtocolPair();
    const b1 = VSBuffer.alloc(0);
    clientProtocol.send(b1);
    const b3 = VSBuffer.alloc(0);
    serverProtocol.send(b3);
    const b2 = await Event.toPromise(serverProtocol.onMessage);
    const b4 = await Event.toPromise(clientProtocol.onMessage);
    assert.strictEqual(b1, b2);
    assert.strictEqual(b3, b4);
  });
  suite("one to one", function() {
    let server;
    let client;
    let service;
    let ipcService;
    setup(function() {
      service = store.add(new TestService());
      const testServer = store.add(new TestIPCServer());
      server = testServer;
      server.registerChannel(TestChannelId, new TestChannel(service));
      client = store.add(testServer.createConnection("client1"));
      ipcService = new TestChannelClient(client.getChannel(TestChannelId));
    });
    test("call success", async function() {
      const r = await ipcService.marco();
      return assert.strictEqual(r, "polo");
    });
    test("call error", async function() {
      try {
        await ipcService.error("nice error");
        return assert.fail("should not reach here");
      } catch (err) {
        return assert.strictEqual(err.message, "nice error");
      }
    });
    test("cancel call with cancelled cancellation token", async function() {
      try {
        await ipcService.neverCompleteCT(CancellationToken.Cancelled);
        return assert.fail("should not reach here");
      } catch (err) {
        return assert(err.message === "Canceled");
      }
    });
    test("cancel call with cancellation token (sync)", function() {
      const cts = new CancellationTokenSource();
      const promise = ipcService.neverCompleteCT(cts.token).then(
        (_) => assert.fail("should not reach here"),
        (err) => assert(err.message === "Canceled")
      );
      cts.cancel();
      return promise;
    });
    test("cancel call with cancellation token (async)", function() {
      const cts = new CancellationTokenSource();
      const promise = ipcService.neverCompleteCT(cts.token).then(
        (_) => assert.fail("should not reach here"),
        (err) => assert(err.message === "Canceled")
      );
      setTimeout(() => cts.cancel());
      return promise;
    });
    test("listen to events", async function() {
      const messages = [];
      store.add(ipcService.onPong((msg) => messages.push(msg)));
      await timeout(0);
      assert.deepStrictEqual(messages, []);
      service.ping("hello");
      await timeout(0);
      assert.deepStrictEqual(messages, ["hello"]);
      service.ping("world");
      await timeout(0);
      assert.deepStrictEqual(messages, ["hello", "world"]);
    });
    test("buffers in arrays", async function() {
      const r = await ipcService.buffersLength([VSBuffer.alloc(2), VSBuffer.alloc(3)]);
      return assert.strictEqual(r, 5);
    });
    test("round trips numbers", () => {
      const input = [
        0,
        1,
        -1,
        12345,
        -12345,
        42.6,
        123412341234
      ];
      const writer = new BufferWriter();
      serialize(writer, input);
      assert.deepStrictEqual(deserialize(new BufferReader(writer.buffer)), input);
    });
  });
  suite("one to one (proxy)", function() {
    let server;
    let client;
    let service;
    let ipcService;
    const disposables = new DisposableStore();
    setup(function() {
      service = store.add(new TestService());
      const testServer = disposables.add(new TestIPCServer());
      server = testServer;
      server.registerChannel(TestChannelId, ProxyChannel.fromService(service, disposables));
      client = disposables.add(testServer.createConnection("client1"));
      ipcService = ProxyChannel.toService(client.getChannel(TestChannelId));
    });
    teardown(function() {
      disposables.clear();
    });
    test("call success", async function() {
      const r = await ipcService.marco();
      return assert.strictEqual(r, "polo");
    });
    test("call error", async function() {
      try {
        await ipcService.error("nice error");
        return assert.fail("should not reach here");
      } catch (err) {
        return assert.strictEqual(err.message, "nice error");
      }
    });
    test("listen to events", async function() {
      const messages = [];
      disposables.add(ipcService.onPong((msg) => messages.push(msg)));
      await timeout(0);
      assert.deepStrictEqual(messages, []);
      service.ping("hello");
      await timeout(0);
      assert.deepStrictEqual(messages, ["hello"]);
      service.ping("world");
      await timeout(0);
      assert.deepStrictEqual(messages, ["hello", "world"]);
    });
    test("marshalling uri", async function() {
      const uri = URI.file("foobar");
      const r = await ipcService.marshall(uri);
      assert.ok(r instanceof URI);
      return assert.ok(isEqual(r, uri));
    });
    test("buffers in arrays", async function() {
      const r = await ipcService.buffersLength([VSBuffer.alloc(2), VSBuffer.alloc(3)]);
      return assert.strictEqual(r, 5);
    });
  });
  suite("one to one (proxy, extra context)", function() {
    let server;
    let client;
    let service;
    let ipcService;
    const disposables = new DisposableStore();
    setup(function() {
      service = store.add(new TestService());
      const testServer = disposables.add(new TestIPCServer());
      server = testServer;
      server.registerChannel(TestChannelId, ProxyChannel.fromService(service, disposables));
      client = disposables.add(testServer.createConnection("client1"));
      ipcService = ProxyChannel.toService(client.getChannel(TestChannelId), { context: "Super Context" });
    });
    teardown(function() {
      disposables.clear();
    });
    test("call extra context", async function() {
      const r = await ipcService.context();
      return assert.strictEqual(r, "Super Context");
    });
  });
  suite("one to many", function() {
    test("all clients get pinged", async function() {
      const service = store.add(new TestService());
      const channel = new TestChannel(service);
      const server = store.add(new TestIPCServer());
      server.registerChannel("channel", channel);
      let client1GotPinged = false;
      const client1 = store.add(server.createConnection("client1"));
      const ipcService1 = new TestChannelClient(client1.getChannel("channel"));
      store.add(ipcService1.onPong(() => client1GotPinged = true));
      let client2GotPinged = false;
      const client2 = store.add(server.createConnection("client2"));
      const ipcService2 = new TestChannelClient(client2.getChannel("channel"));
      store.add(ipcService2.onPong(() => client2GotPinged = true));
      await timeout(1);
      service.ping("hello");
      await timeout(1);
      assert(client1GotPinged, "client 1 got pinged");
      assert(client2GotPinged, "client 2 got pinged");
    });
    test("server gets pings from all clients (broadcast channel)", async function() {
      const server = store.add(new TestIPCServer());
      const client1 = server.createConnection("client1");
      const clientService1 = store.add(new TestService());
      const clientChannel1 = new TestChannel(clientService1);
      client1.registerChannel("channel", clientChannel1);
      const pings = [];
      const channel = server.getChannel("channel", () => true);
      const service = new TestChannelClient(channel);
      store.add(service.onPong((msg) => pings.push(msg)));
      await timeout(1);
      clientService1.ping("hello 1");
      await timeout(1);
      assert.deepStrictEqual(pings, ["hello 1"]);
      const client2 = server.createConnection("client2");
      const clientService2 = store.add(new TestService());
      const clientChannel2 = new TestChannel(clientService2);
      client2.registerChannel("channel", clientChannel2);
      await timeout(1);
      clientService2.ping("hello 2");
      await timeout(1);
      assert.deepStrictEqual(pings, ["hello 1", "hello 2"]);
      client1.dispose();
      clientService1.ping("hello 1");
      await timeout(1);
      assert.deepStrictEqual(pings, ["hello 1", "hello 2"]);
      await timeout(1);
      clientService2.ping("hello again 2");
      await timeout(1);
      assert.deepStrictEqual(pings, ["hello 1", "hello 2", "hello again 2"]);
      client2.dispose();
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3BhcnRzL2lwYy90ZXN0L2NvbW1vbi9pcGMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgY2FuY2VsZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBCdWZmZXJSZWFkZXIsIEJ1ZmZlcldyaXRlciwgQ2xpZW50Q29ubmVjdGlvbkV2ZW50LCBkZXNlcmlhbGl6ZSwgSUNoYW5uZWwsIElNZXNzYWdlUGFzc2luZ1Byb3RvY29sLCBJUENDbGllbnQsIElQQ1NlcnZlciwgSVNlcnZlckNoYW5uZWwsIFByb3h5Q2hhbm5lbCwgc2VyaWFsaXplIH0gZnJvbSAnLi4vLi4vY29tbW9uL2lwYy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbmNsYXNzIFF1ZXVlUHJvdG9jb2wgaW1wbGVtZW50cyBJTWVzc2FnZVBhc3NpbmdQcm90b2NvbCB7XG5cblx0cHJpdmF0ZSBidWZmZXJpbmcgPSB0cnVlO1xuXHRwcml2YXRlIGJ1ZmZlcnM6IFZTQnVmZmVyW10gPSBbXTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbk1lc3NhZ2UgPSBuZXcgRW1pdHRlcjxWU0J1ZmZlcj4oe1xuXHRcdG9uRGlkQWRkRmlyc3RMaXN0ZW5lcjogKCkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBidWZmZXIgb2YgdGhpcy5idWZmZXJzKSB7XG5cdFx0XHRcdHRoaXMuX29uTWVzc2FnZS5maXJlKGJ1ZmZlcik7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuYnVmZmVycyA9IFtdO1xuXHRcdFx0dGhpcy5idWZmZXJpbmcgPSBmYWxzZTtcblx0XHR9LFxuXHRcdG9uRGlkUmVtb3ZlTGFzdExpc3RlbmVyOiAoKSA9PiB7XG5cdFx0XHR0aGlzLmJ1ZmZlcmluZyA9IHRydWU7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWFkb25seSBvbk1lc3NhZ2UgPSB0aGlzLl9vbk1lc3NhZ2UuZXZlbnQ7XG5cdG90aGVyITogUXVldWVQcm90b2NvbDtcblxuXHRzZW5kKGJ1ZmZlcjogVlNCdWZmZXIpOiB2b2lkIHtcblx0XHR0aGlzLm90aGVyLnJlY2VpdmUoYnVmZmVyKTtcblx0fVxuXG5cdHByb3RlY3RlZCByZWNlaXZlKGJ1ZmZlcjogVlNCdWZmZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5idWZmZXJpbmcpIHtcblx0XHRcdHRoaXMuYnVmZmVycy5wdXNoKGJ1ZmZlcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX29uTWVzc2FnZS5maXJlKGJ1ZmZlcik7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVByb3RvY29sUGFpcigpOiBbSU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2wsIElNZXNzYWdlUGFzc2luZ1Byb3RvY29sXSB7XG5cdGNvbnN0IG9uZSA9IG5ldyBRdWV1ZVByb3RvY29sKCk7XG5cdGNvbnN0IG90aGVyID0gbmV3IFF1ZXVlUHJvdG9jb2woKTtcblx0b25lLm90aGVyID0gb3RoZXI7XG5cdG90aGVyLm90aGVyID0gb25lO1xuXG5cdHJldHVybiBbb25lLCBvdGhlcl07XG59XG5cbmNsYXNzIFRlc3RJUENDbGllbnQgZXh0ZW5kcyBJUENDbGllbnQ8c3RyaW5nPiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWREaXNjb25uZWN0ID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cmVhZG9ubHkgb25EaWREaXNjb25uZWN0ID0gdGhpcy5fb25EaWREaXNjb25uZWN0LmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKHByb3RvY29sOiBJTWVzc2FnZVBhc3NpbmdQcm90b2NvbCwgaWQ6IHN0cmluZykge1xuXHRcdHN1cGVyKHByb3RvY29sLCBpZCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkRGlzY29ubmVjdC5maXJlKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIFRlc3RJUENTZXJ2ZXIgZXh0ZW5kcyBJUENTZXJ2ZXI8c3RyaW5nPiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBvbkRpZENsaWVudENvbm5lY3Q6IEVtaXR0ZXI8Q2xpZW50Q29ubmVjdGlvbkV2ZW50PjtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCBvbkRpZENsaWVudENvbm5lY3QgPSBuZXcgRW1pdHRlcjxDbGllbnRDb25uZWN0aW9uRXZlbnQ+KCk7XG5cdFx0c3VwZXIob25EaWRDbGllbnRDb25uZWN0LmV2ZW50KTtcblx0XHR0aGlzLm9uRGlkQ2xpZW50Q29ubmVjdCA9IG9uRGlkQ2xpZW50Q29ubmVjdDtcblx0fVxuXG5cdGNyZWF0ZUNvbm5lY3Rpb24oaWQ6IHN0cmluZyk6IElQQ0NsaWVudDxzdHJpbmc+IHtcblx0XHRjb25zdCBbcGMsIHBzXSA9IGNyZWF0ZVByb3RvY29sUGFpcigpO1xuXHRcdGNvbnN0IGNsaWVudCA9IG5ldyBUZXN0SVBDQ2xpZW50KHBjLCBpZCk7XG5cblx0XHR0aGlzLm9uRGlkQ2xpZW50Q29ubmVjdC5maXJlKHtcblx0XHRcdHByb3RvY29sOiBwcyxcblx0XHRcdG9uRGlkQ2xpZW50RGlzY29ubmVjdDogY2xpZW50Lm9uRGlkRGlzY29ubmVjdFxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGNsaWVudDtcblx0fVxufVxuXG5jb25zdCBUZXN0Q2hhbm5lbElkID0gJ3Rlc3RjaGFubmVsJztcblxuaW50ZXJmYWNlIElUZXN0U2VydmljZSB7XG5cdG1hcmNvKCk6IFByb21pc2U8c3RyaW5nPjtcblx0ZXJyb3IobWVzc2FnZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPjtcblx0bmV2ZXJDb21wbGV0ZSgpOiBQcm9taXNlPHZvaWQ+O1xuXHRuZXZlckNvbXBsZXRlQ1QoY2FuY2VsbGF0aW9uVG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPjtcblx0YnVmZmVyc0xlbmd0aChidWZmZXJzOiBWU0J1ZmZlcltdKTogUHJvbWlzZTxudW1iZXI+O1xuXHRtYXJzaGFsbCh1cmk6IFVSSSk6IFByb21pc2U8VVJJPjtcblx0Y29udGV4dCgpOiBQcm9taXNlPHVua25vd24+O1xuXG5cdG9uUG9uZzogRXZlbnQ8c3RyaW5nPjtcbn1cblxuY2xhc3MgVGVzdFNlcnZpY2UgaW1wbGVtZW50cyBJVGVzdFNlcnZpY2Uge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25Qb25nID0gbmV3IEVtaXR0ZXI8c3RyaW5nPigpO1xuXHRyZWFkb25seSBvblBvbmcgPSB0aGlzLl9vblBvbmcuZXZlbnQ7XG5cblx0bWFyY28oKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCdwb2xvJyk7XG5cdH1cblxuXHRlcnJvcihtZXNzYWdlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKG1lc3NhZ2UpKTtcblx0fVxuXG5cdG5ldmVyQ29tcGxldGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKF8gPT4geyB9KTtcblx0fVxuXG5cdG5ldmVyQ29tcGxldGVDVChjYW5jZWxsYXRpb25Ub2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoY2FuY2VsbGF0aW9uVG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChjYW5jZWxlZCgpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKF8sIGUpID0+IHRoaXMuZGlzcG9zYWJsZXMuYWRkKGNhbmNlbGxhdGlvblRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IGUoY2FuY2VsZWQoKSkpKSk7XG5cdH1cblxuXHRidWZmZXJzTGVuZ3RoKGJ1ZmZlcnM6IFZTQnVmZmVyW10pOiBQcm9taXNlPG51bWJlcj4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoYnVmZmVycy5yZWR1Y2UoKHIsIGIpID0+IHIgKyBiLmJ1ZmZlci5sZW5ndGgsIDApKTtcblx0fVxuXG5cdHBpbmcobXNnOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9vblBvbmcuZmlyZShtc2cpO1xuXHR9XG5cblx0bWFyc2hhbGwodXJpOiBVUkkpOiBQcm9taXNlPFVSST4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodXJpKTtcblx0fVxuXG5cdGNvbnRleHQoY29udGV4dD86IHVua25vd24pOiBQcm9taXNlPHVua25vd24+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGNvbnRleHQpO1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBUZXN0Q2hhbm5lbCBpbXBsZW1lbnRzIElTZXJ2ZXJDaGFubmVsIHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHNlcnZpY2U6IElUZXN0U2VydmljZSkgeyB9XG5cblx0Y2FsbChfOiB1bmtub3duLCBjb21tYW5kOiBzdHJpbmcsIGFyZzogYW55LCBjYW5jZWxsYXRpb25Ub2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGFueT4ge1xuXHRcdHN3aXRjaCAoY29tbWFuZCkge1xuXHRcdFx0Y2FzZSAnbWFyY28nOiByZXR1cm4gdGhpcy5zZXJ2aWNlLm1hcmNvKCk7XG5cdFx0XHRjYXNlICdlcnJvcic6IHJldHVybiB0aGlzLnNlcnZpY2UuZXJyb3IoYXJnKTtcblx0XHRcdGNhc2UgJ25ldmVyQ29tcGxldGUnOiByZXR1cm4gdGhpcy5zZXJ2aWNlLm5ldmVyQ29tcGxldGUoKTtcblx0XHRcdGNhc2UgJ25ldmVyQ29tcGxldGVDVCc6IHJldHVybiB0aGlzLnNlcnZpY2UubmV2ZXJDb21wbGV0ZUNUKGNhbmNlbGxhdGlvblRva2VuKTtcblx0XHRcdGNhc2UgJ2J1ZmZlcnNMZW5ndGgnOiByZXR1cm4gdGhpcy5zZXJ2aWNlLmJ1ZmZlcnNMZW5ndGgoYXJnKTtcblx0XHRcdGRlZmF1bHQ6IHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpKTtcblx0XHR9XG5cdH1cblxuXHRsaXN0ZW4oXzogdW5rbm93biwgZXZlbnQ6IHN0cmluZywgYXJnPzogYW55KTogRXZlbnQ8YW55PiB7XG5cdFx0c3dpdGNoIChldmVudCkge1xuXHRcdFx0Y2FzZSAnb25Qb25nJzogcmV0dXJuIHRoaXMuc2VydmljZS5vblBvbmc7XG5cdFx0XHRkZWZhdWx0OiB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBUZXN0Q2hhbm5lbENsaWVudCBpbXBsZW1lbnRzIElUZXN0U2VydmljZSB7XG5cblx0Z2V0IG9uUG9uZygpOiBFdmVudDxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5jaGFubmVsLmxpc3Rlbignb25Qb25nJyk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIGNoYW5uZWw6IElDaGFubmVsKSB7IH1cblxuXHRtYXJjbygpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHJldHVybiB0aGlzLmNoYW5uZWwuY2FsbCgnbWFyY28nKTtcblx0fVxuXG5cdGVycm9yKG1lc3NhZ2U6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmNoYW5uZWwuY2FsbCgnZXJyb3InLCBtZXNzYWdlKTtcblx0fVxuXG5cdG5ldmVyQ29tcGxldGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuY2hhbm5lbC5jYWxsKCduZXZlckNvbXBsZXRlJyk7XG5cdH1cblxuXHRuZXZlckNvbXBsZXRlQ1QoY2FuY2VsbGF0aW9uVG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuY2hhbm5lbC5jYWxsKCduZXZlckNvbXBsZXRlQ1QnLCB1bmRlZmluZWQsIGNhbmNlbGxhdGlvblRva2VuKTtcblx0fVxuXG5cdGJ1ZmZlcnNMZW5ndGgoYnVmZmVyczogVlNCdWZmZXJbXSk6IFByb21pc2U8bnVtYmVyPiB7XG5cdFx0cmV0dXJuIHRoaXMuY2hhbm5lbC5jYWxsKCdidWZmZXJzTGVuZ3RoJywgYnVmZmVycyk7XG5cdH1cblxuXHRtYXJzaGFsbCh1cmk6IFVSSSk6IFByb21pc2U8VVJJPiB7XG5cdFx0cmV0dXJuIHRoaXMuY2hhbm5lbC5jYWxsKCdtYXJzaGFsbCcsIHVyaSk7XG5cdH1cblxuXHRjb250ZXh0KCk6IFByb21pc2U8dW5rbm93bj4ge1xuXHRcdHJldHVybiB0aGlzLmNoYW5uZWwuY2FsbCgnY29udGV4dCcpO1xuXHR9XG59XG5cbnN1aXRlKCdCYXNlIElQQycsIGZ1bmN0aW9uICgpIHtcblxuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2NyZWF0ZVByb3RvY29sUGFpcicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBbY2xpZW50UHJvdG9jb2wsIHNlcnZlclByb3RvY29sXSA9IGNyZWF0ZVByb3RvY29sUGFpcigpO1xuXG5cdFx0Y29uc3QgYjEgPSBWU0J1ZmZlci5hbGxvYygwKTtcblx0XHRjbGllbnRQcm90b2NvbC5zZW5kKGIxKTtcblxuXHRcdGNvbnN0IGIzID0gVlNCdWZmZXIuYWxsb2MoMCk7XG5cdFx0c2VydmVyUHJvdG9jb2wuc2VuZChiMyk7XG5cblx0XHRjb25zdCBiMiA9IGF3YWl0IEV2ZW50LnRvUHJvbWlzZShzZXJ2ZXJQcm90b2NvbC5vbk1lc3NhZ2UpO1xuXHRcdGNvbnN0IGI0ID0gYXdhaXQgRXZlbnQudG9Qcm9taXNlKGNsaWVudFByb3RvY29sLm9uTWVzc2FnZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYjEsIGIyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYjMsIGI0KTtcblx0fSk7XG5cblx0c3VpdGUoJ29uZSB0byBvbmUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0bGV0IHNlcnZlcjogSVBDU2VydmVyO1xuXHRcdGxldCBjbGllbnQ6IElQQ0NsaWVudDtcblx0XHRsZXQgc2VydmljZTogVGVzdFNlcnZpY2U7XG5cdFx0bGV0IGlwY1NlcnZpY2U6IElUZXN0U2VydmljZTtcblxuXHRcdHNldHVwKGZ1bmN0aW9uICgpIHtcblx0XHRcdHNlcnZpY2UgPSBzdG9yZS5hZGQobmV3IFRlc3RTZXJ2aWNlKCkpO1xuXHRcdFx0Y29uc3QgdGVzdFNlcnZlciA9IHN0b3JlLmFkZChuZXcgVGVzdElQQ1NlcnZlcigpKTtcblx0XHRcdHNlcnZlciA9IHRlc3RTZXJ2ZXI7XG5cblx0XHRcdHNlcnZlci5yZWdpc3RlckNoYW5uZWwoVGVzdENoYW5uZWxJZCwgbmV3IFRlc3RDaGFubmVsKHNlcnZpY2UpKTtcblxuXHRcdFx0Y2xpZW50ID0gc3RvcmUuYWRkKHRlc3RTZXJ2ZXIuY3JlYXRlQ29ubmVjdGlvbignY2xpZW50MScpKTtcblx0XHRcdGlwY1NlcnZpY2UgPSBuZXcgVGVzdENoYW5uZWxDbGllbnQoY2xpZW50LmdldENoYW5uZWwoVGVzdENoYW5uZWxJZCkpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnY2FsbCBzdWNjZXNzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3QgciA9IGF3YWl0IGlwY1NlcnZpY2UubWFyY28oKTtcblx0XHRcdHJldHVybiBhc3NlcnQuc3RyaWN0RXF1YWwociwgJ3BvbG8nKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2NhbGwgZXJyb3InLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBpcGNTZXJ2aWNlLmVycm9yKCduaWNlIGVycm9yJyk7XG5cdFx0XHRcdHJldHVybiBhc3NlcnQuZmFpbCgnc2hvdWxkIG5vdCByZWFjaCBoZXJlJyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0cmV0dXJuIGFzc2VydC5zdHJpY3RFcXVhbChlcnIubWVzc2FnZSwgJ25pY2UgZXJyb3InKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRlc3QoJ2NhbmNlbCBjYWxsIHdpdGggY2FuY2VsbGVkIGNhbmNlbGxhdGlvbiB0b2tlbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IGlwY1NlcnZpY2UubmV2ZXJDb21wbGV0ZUNUKENhbmNlbGxhdGlvblRva2VuLkNhbmNlbGxlZCk7XG5cdFx0XHRcdHJldHVybiBhc3NlcnQuZmFpbCgnc2hvdWxkIG5vdCByZWFjaCBoZXJlJyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0cmV0dXJuIGFzc2VydChlcnIubWVzc2FnZSA9PT0gJ0NhbmNlbGVkJyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdjYW5jZWwgY2FsbCB3aXRoIGNhbmNlbGxhdGlvbiB0b2tlbiAoc3luYyknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdGNvbnN0IHByb21pc2UgPSBpcGNTZXJ2aWNlLm5ldmVyQ29tcGxldGVDVChjdHMudG9rZW4pLnRoZW4oXG5cdFx0XHRcdF8gPT4gYXNzZXJ0LmZhaWwoJ3Nob3VsZCBub3QgcmVhY2ggaGVyZScpLFxuXHRcdFx0XHRlcnIgPT4gYXNzZXJ0KGVyci5tZXNzYWdlID09PSAnQ2FuY2VsZWQnKVxuXHRcdFx0KTtcblxuXHRcdFx0Y3RzLmNhbmNlbCgpO1xuXG5cdFx0XHRyZXR1cm4gcHJvbWlzZTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2NhbmNlbCBjYWxsIHdpdGggY2FuY2VsbGF0aW9uIHRva2VuIChhc3luYyknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdGNvbnN0IHByb21pc2UgPSBpcGNTZXJ2aWNlLm5ldmVyQ29tcGxldGVDVChjdHMudG9rZW4pLnRoZW4oXG5cdFx0XHRcdF8gPT4gYXNzZXJ0LmZhaWwoJ3Nob3VsZCBub3QgcmVhY2ggaGVyZScpLFxuXHRcdFx0XHRlcnIgPT4gYXNzZXJ0KGVyci5tZXNzYWdlID09PSAnQ2FuY2VsZWQnKVxuXHRcdFx0KTtcblxuXHRcdFx0c2V0VGltZW91dCgoKSA9PiBjdHMuY2FuY2VsKCkpO1xuXG5cdFx0XHRyZXR1cm4gcHJvbWlzZTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2xpc3RlbiB0byBldmVudHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBtZXNzYWdlczogc3RyaW5nW10gPSBbXTtcblxuXHRcdFx0c3RvcmUuYWRkKGlwY1NlcnZpY2Uub25Qb25nKG1zZyA9PiBtZXNzYWdlcy5wdXNoKG1zZykpKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWVzc2FnZXMsIFtdKTtcblx0XHRcdHNlcnZpY2UucGluZygnaGVsbG8nKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWVzc2FnZXMsIFsnaGVsbG8nXSk7XG5cdFx0XHRzZXJ2aWNlLnBpbmcoJ3dvcmxkJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1lc3NhZ2VzLCBbJ2hlbGxvJywgJ3dvcmxkJ10pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnYnVmZmVycyBpbiBhcnJheXMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCByID0gYXdhaXQgaXBjU2VydmljZS5idWZmZXJzTGVuZ3RoKFtWU0J1ZmZlci5hbGxvYygyKSwgVlNCdWZmZXIuYWxsb2MoMyldKTtcblx0XHRcdHJldHVybiBhc3NlcnQuc3RyaWN0RXF1YWwociwgNSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyb3VuZCB0cmlwcyBudW1iZXJzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBbXG5cdFx0XHRcdDAsXG5cdFx0XHRcdDEsXG5cdFx0XHRcdC0xLFxuXHRcdFx0XHQxMjM0NSxcblx0XHRcdFx0LTEyMzQ1LFxuXHRcdFx0XHQ0Mi42LFxuXHRcdFx0XHQxMjM0MTIzNDEyMzRcblx0XHRcdF07XG5cblx0XHRcdGNvbnN0IHdyaXRlciA9IG5ldyBCdWZmZXJXcml0ZXIoKTtcblx0XHRcdHNlcmlhbGl6ZSh3cml0ZXIsIGlucHV0KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGVzZXJpYWxpemUobmV3IEJ1ZmZlclJlYWRlcih3cml0ZXIuYnVmZmVyKSksIGlucHV0KTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ29uZSB0byBvbmUgKHByb3h5KScsIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgc2VydmVyOiBJUENTZXJ2ZXI7XG5cdFx0bGV0IGNsaWVudDogSVBDQ2xpZW50O1xuXHRcdGxldCBzZXJ2aWNlOiBUZXN0U2VydmljZTtcblx0XHRsZXQgaXBjU2VydmljZTogSVRlc3RTZXJ2aWNlO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRzZXR1cChmdW5jdGlvbiAoKSB7XG5cdFx0XHRzZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VydmljZSgpKTtcblx0XHRcdGNvbnN0IHRlc3RTZXJ2ZXIgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RJUENTZXJ2ZXIoKSk7XG5cdFx0XHRzZXJ2ZXIgPSB0ZXN0U2VydmVyO1xuXG5cdFx0XHRzZXJ2ZXIucmVnaXN0ZXJDaGFubmVsKFRlc3RDaGFubmVsSWQsIFByb3h5Q2hhbm5lbC5mcm9tU2VydmljZShzZXJ2aWNlLCBkaXNwb3NhYmxlcykpO1xuXG5cdFx0XHRjbGllbnQgPSBkaXNwb3NhYmxlcy5hZGQodGVzdFNlcnZlci5jcmVhdGVDb25uZWN0aW9uKCdjbGllbnQxJykpO1xuXHRcdFx0aXBjU2VydmljZSA9IFByb3h5Q2hhbm5lbC50b1NlcnZpY2UoY2xpZW50LmdldENoYW5uZWwoVGVzdENoYW5uZWxJZCkpO1xuXHRcdH0pO1xuXG5cdFx0dGVhcmRvd24oZnVuY3Rpb24gKCkge1xuXHRcdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2NhbGwgc3VjY2VzcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IHIgPSBhd2FpdCBpcGNTZXJ2aWNlLm1hcmNvKCk7XG5cdFx0XHRyZXR1cm4gYXNzZXJ0LnN0cmljdEVxdWFsKHIsICdwb2xvJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdjYWxsIGVycm9yJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgaXBjU2VydmljZS5lcnJvcignbmljZSBlcnJvcicpO1xuXHRcdFx0XHRyZXR1cm4gYXNzZXJ0LmZhaWwoJ3Nob3VsZCBub3QgcmVhY2ggaGVyZScpO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdHJldHVybiBhc3NlcnQuc3RyaWN0RXF1YWwoZXJyLm1lc3NhZ2UsICduaWNlIGVycm9yJyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdsaXN0ZW4gdG8gZXZlbnRzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3QgbWVzc2FnZXM6IHN0cmluZ1tdID0gW107XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChpcGNTZXJ2aWNlLm9uUG9uZyhtc2cgPT4gbWVzc2FnZXMucHVzaChtc2cpKSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1lc3NhZ2VzLCBbXSk7XG5cdFx0XHRzZXJ2aWNlLnBpbmcoJ2hlbGxvJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1lc3NhZ2VzLCBbJ2hlbGxvJ10pO1xuXHRcdFx0c2VydmljZS5waW5nKCd3b3JsZCcpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgwKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtZXNzYWdlcywgWydoZWxsbycsICd3b3JsZCddKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ21hcnNoYWxsaW5nIHVyaScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5maWxlKCdmb29iYXInKTtcblx0XHRcdGNvbnN0IHIgPSBhd2FpdCBpcGNTZXJ2aWNlLm1hcnNoYWxsKHVyaSk7XG5cdFx0XHRhc3NlcnQub2sociBpbnN0YW5jZW9mIFVSSSk7XG5cdFx0XHRyZXR1cm4gYXNzZXJ0Lm9rKGlzRXF1YWwociwgdXJpKSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdidWZmZXJzIGluIGFycmF5cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IHIgPSBhd2FpdCBpcGNTZXJ2aWNlLmJ1ZmZlcnNMZW5ndGgoW1ZTQnVmZmVyLmFsbG9jKDIpLCBWU0J1ZmZlci5hbGxvYygzKV0pO1xuXHRcdFx0cmV0dXJuIGFzc2VydC5zdHJpY3RFcXVhbChyLCA1KTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ29uZSB0byBvbmUgKHByb3h5LCBleHRyYSBjb250ZXh0KScsIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgc2VydmVyOiBJUENTZXJ2ZXI7XG5cdFx0bGV0IGNsaWVudDogSVBDQ2xpZW50O1xuXHRcdGxldCBzZXJ2aWNlOiBUZXN0U2VydmljZTtcblx0XHRsZXQgaXBjU2VydmljZTogSVRlc3RTZXJ2aWNlO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRzZXR1cChmdW5jdGlvbiAoKSB7XG5cdFx0XHRzZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VydmljZSgpKTtcblx0XHRcdGNvbnN0IHRlc3RTZXJ2ZXIgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RJUENTZXJ2ZXIoKSk7XG5cdFx0XHRzZXJ2ZXIgPSB0ZXN0U2VydmVyO1xuXG5cdFx0XHRzZXJ2ZXIucmVnaXN0ZXJDaGFubmVsKFRlc3RDaGFubmVsSWQsIFByb3h5Q2hhbm5lbC5mcm9tU2VydmljZShzZXJ2aWNlLCBkaXNwb3NhYmxlcykpO1xuXG5cdFx0XHRjbGllbnQgPSBkaXNwb3NhYmxlcy5hZGQodGVzdFNlcnZlci5jcmVhdGVDb25uZWN0aW9uKCdjbGllbnQxJykpO1xuXHRcdFx0aXBjU2VydmljZSA9IFByb3h5Q2hhbm5lbC50b1NlcnZpY2UoY2xpZW50LmdldENoYW5uZWwoVGVzdENoYW5uZWxJZCksIHsgY29udGV4dDogJ1N1cGVyIENvbnRleHQnIH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVhcmRvd24oZnVuY3Rpb24gKCkge1xuXHRcdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2NhbGwgZXh0cmEgY29udGV4dCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IHIgPSBhd2FpdCBpcGNTZXJ2aWNlLmNvbnRleHQoKTtcblx0XHRcdHJldHVybiBhc3NlcnQuc3RyaWN0RXF1YWwociwgJ1N1cGVyIENvbnRleHQnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ29uZSB0byBtYW55JywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3QoJ2FsbCBjbGllbnRzIGdldCBwaW5nZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBzZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VydmljZSgpKTtcblx0XHRcdGNvbnN0IGNoYW5uZWwgPSBuZXcgVGVzdENoYW5uZWwoc2VydmljZSk7XG5cdFx0XHRjb25zdCBzZXJ2ZXIgPSBzdG9yZS5hZGQobmV3IFRlc3RJUENTZXJ2ZXIoKSk7XG5cdFx0XHRzZXJ2ZXIucmVnaXN0ZXJDaGFubmVsKCdjaGFubmVsJywgY2hhbm5lbCk7XG5cblx0XHRcdGxldCBjbGllbnQxR290UGluZ2VkID0gZmFsc2U7XG5cdFx0XHRjb25zdCBjbGllbnQxID0gc3RvcmUuYWRkKHNlcnZlci5jcmVhdGVDb25uZWN0aW9uKCdjbGllbnQxJykpO1xuXHRcdFx0Y29uc3QgaXBjU2VydmljZTEgPSBuZXcgVGVzdENoYW5uZWxDbGllbnQoY2xpZW50MS5nZXRDaGFubmVsKCdjaGFubmVsJykpO1xuXHRcdFx0c3RvcmUuYWRkKGlwY1NlcnZpY2UxLm9uUG9uZygoKSA9PiBjbGllbnQxR290UGluZ2VkID0gdHJ1ZSkpO1xuXG5cdFx0XHRsZXQgY2xpZW50MkdvdFBpbmdlZCA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgY2xpZW50MiA9IHN0b3JlLmFkZChzZXJ2ZXIuY3JlYXRlQ29ubmVjdGlvbignY2xpZW50MicpKTtcblx0XHRcdGNvbnN0IGlwY1NlcnZpY2UyID0gbmV3IFRlc3RDaGFubmVsQ2xpZW50KGNsaWVudDIuZ2V0Q2hhbm5lbCgnY2hhbm5lbCcpKTtcblx0XHRcdHN0b3JlLmFkZChpcGNTZXJ2aWNlMi5vblBvbmcoKCkgPT4gY2xpZW50MkdvdFBpbmdlZCA9IHRydWUpKTtcblxuXHRcdFx0YXdhaXQgdGltZW91dCgxKTtcblx0XHRcdHNlcnZpY2UucGluZygnaGVsbG8nKTtcblxuXHRcdFx0YXdhaXQgdGltZW91dCgxKTtcblx0XHRcdGFzc2VydChjbGllbnQxR290UGluZ2VkLCAnY2xpZW50IDEgZ290IHBpbmdlZCcpO1xuXHRcdFx0YXNzZXJ0KGNsaWVudDJHb3RQaW5nZWQsICdjbGllbnQgMiBnb3QgcGluZ2VkJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzZXJ2ZXIgZ2V0cyBwaW5ncyBmcm9tIGFsbCBjbGllbnRzIChicm9hZGNhc3QgY2hhbm5lbCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBzZXJ2ZXIgPSBzdG9yZS5hZGQobmV3IFRlc3RJUENTZXJ2ZXIoKSk7XG5cblx0XHRcdGNvbnN0IGNsaWVudDEgPSBzZXJ2ZXIuY3JlYXRlQ29ubmVjdGlvbignY2xpZW50MScpO1xuXHRcdFx0Y29uc3QgY2xpZW50U2VydmljZTEgPSBzdG9yZS5hZGQobmV3IFRlc3RTZXJ2aWNlKCkpO1xuXHRcdFx0Y29uc3QgY2xpZW50Q2hhbm5lbDEgPSBuZXcgVGVzdENoYW5uZWwoY2xpZW50U2VydmljZTEpO1xuXHRcdFx0Y2xpZW50MS5yZWdpc3RlckNoYW5uZWwoJ2NoYW5uZWwnLCBjbGllbnRDaGFubmVsMSk7XG5cblx0XHRcdGNvbnN0IHBpbmdzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0Y29uc3QgY2hhbm5lbCA9IHNlcnZlci5nZXRDaGFubmVsKCdjaGFubmVsJywgKCkgPT4gdHJ1ZSk7XG5cdFx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IFRlc3RDaGFubmVsQ2xpZW50KGNoYW5uZWwpO1xuXHRcdFx0c3RvcmUuYWRkKHNlcnZpY2Uub25Qb25nKG1zZyA9PiBwaW5ncy5wdXNoKG1zZykpKTtcblxuXHRcdFx0YXdhaXQgdGltZW91dCgxKTtcblx0XHRcdGNsaWVudFNlcnZpY2UxLnBpbmcoJ2hlbGxvIDEnKTtcblxuXHRcdFx0YXdhaXQgdGltZW91dCgxKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGluZ3MsIFsnaGVsbG8gMSddKTtcblxuXHRcdFx0Y29uc3QgY2xpZW50MiA9IHNlcnZlci5jcmVhdGVDb25uZWN0aW9uKCdjbGllbnQyJyk7XG5cdFx0XHRjb25zdCBjbGllbnRTZXJ2aWNlMiA9IHN0b3JlLmFkZChuZXcgVGVzdFNlcnZpY2UoKSk7XG5cdFx0XHRjb25zdCBjbGllbnRDaGFubmVsMiA9IG5ldyBUZXN0Q2hhbm5lbChjbGllbnRTZXJ2aWNlMik7XG5cdFx0XHRjbGllbnQyLnJlZ2lzdGVyQ2hhbm5lbCgnY2hhbm5lbCcsIGNsaWVudENoYW5uZWwyKTtcblxuXHRcdFx0YXdhaXQgdGltZW91dCgxKTtcblx0XHRcdGNsaWVudFNlcnZpY2UyLnBpbmcoJ2hlbGxvIDInKTtcblxuXHRcdFx0YXdhaXQgdGltZW91dCgxKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGluZ3MsIFsnaGVsbG8gMScsICdoZWxsbyAyJ10pO1xuXG5cdFx0XHRjbGllbnQxLmRpc3Bvc2UoKTtcblx0XHRcdGNsaWVudFNlcnZpY2UxLnBpbmcoJ2hlbGxvIDEnKTtcblxuXHRcdFx0YXdhaXQgdGltZW91dCgxKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGluZ3MsIFsnaGVsbG8gMScsICdoZWxsbyAyJ10pO1xuXG5cdFx0XHRhd2FpdCB0aW1lb3V0KDEpO1xuXHRcdFx0Y2xpZW50U2VydmljZTIucGluZygnaGVsbG8gYWdhaW4gMicpO1xuXG5cdFx0XHRhd2FpdCB0aW1lb3V0KDEpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwaW5ncywgWydoZWxsbyAxJywgJ2hlbGxvIDInLCAnaGVsbG8gYWdhaW4gMiddKTtcblxuXHRcdFx0Y2xpZW50Mi5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsbUJBQW1CLCtCQUErQjtBQUMzRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsY0FBYyxjQUFxQyxhQUFnRCxXQUFXLFdBQTJCLGNBQWMsaUJBQWlCO0FBQ2pMLFNBQVMsK0NBQStDO0FBRXhELE1BQU0sY0FBaUQ7QUFBQSxFQUF2RDtBQUVDLFNBQVEsWUFBWTtBQUNwQixTQUFRLFVBQXNCLENBQUM7QUFFL0IsU0FBaUIsYUFBYSxJQUFJLFFBQWtCO0FBQUEsTUFDbkQsdUJBQXVCLE1BQU07QUFDNUIsbUJBQVcsVUFBVSxLQUFLLFNBQVM7QUFDbEMsZUFBSyxXQUFXLEtBQUssTUFBTTtBQUFBLFFBQzVCO0FBRUEsYUFBSyxVQUFVLENBQUM7QUFDaEIsYUFBSyxZQUFZO0FBQUEsTUFDbEI7QUFBQSxNQUNBLHlCQUF5QixNQUFNO0FBQzlCLGFBQUssWUFBWTtBQUFBLE1BQ2xCO0FBQUEsSUFDRCxDQUFDO0FBRUQsU0FBUyxZQUFZLEtBQUssV0FBVztBQUFBO0FBQUEsRUFHckMsS0FBSyxRQUF3QjtBQUM1QixTQUFLLE1BQU0sUUFBUSxNQUFNO0FBQUEsRUFDMUI7QUFBQSxFQUVVLFFBQVEsUUFBd0I7QUFDekMsUUFBSSxLQUFLLFdBQVc7QUFDbkIsV0FBSyxRQUFRLEtBQUssTUFBTTtBQUFBLElBQ3pCLE9BQU87QUFDTixXQUFLLFdBQVcsS0FBSyxNQUFNO0FBQUEsSUFDNUI7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxTQUFTLHFCQUF5RTtBQUNqRixRQUFNLE1BQU0sSUFBSSxjQUFjO0FBQzlCLFFBQU0sUUFBUSxJQUFJLGNBQWM7QUFDaEMsTUFBSSxRQUFRO0FBQ1osUUFBTSxRQUFRO0FBRWQsU0FBTyxDQUFDLEtBQUssS0FBSztBQUNuQjtBQUVBLE1BQU0sc0JBQXNCLFVBQWtCO0FBQUEsRUFLN0MsWUFBWSxVQUFtQyxJQUFZO0FBQzFELFVBQU0sVUFBVSxFQUFFO0FBSm5CLFNBQWlCLG1CQUFtQixJQUFJLFFBQWM7QUFDdEQsU0FBUyxrQkFBa0IsS0FBSyxpQkFBaUI7QUFBQSxFQUlqRDtBQUFBLEVBRVMsVUFBZ0I7QUFDeEIsU0FBSyxpQkFBaUIsS0FBSztBQUMzQixVQUFNLFFBQVE7QUFBQSxFQUNmO0FBQ0Q7QUFFQSxNQUFNLHNCQUFzQixVQUFrQjtBQUFBLEVBSTdDLGNBQWM7QUFDYixVQUFNLHFCQUFxQixJQUFJLFFBQStCO0FBQzlELFVBQU0sbUJBQW1CLEtBQUs7QUFDOUIsU0FBSyxxQkFBcUI7QUFBQSxFQUMzQjtBQUFBLEVBRUEsaUJBQWlCLElBQStCO0FBQy9DLFVBQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxtQkFBbUI7QUFDcEMsVUFBTSxTQUFTLElBQUksY0FBYyxJQUFJLEVBQUU7QUFFdkMsU0FBSyxtQkFBbUIsS0FBSztBQUFBLE1BQzVCLFVBQVU7QUFBQSxNQUNWLHVCQUF1QixPQUFPO0FBQUEsSUFDL0IsQ0FBQztBQUVELFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUFFQSxNQUFNLGdCQUFnQjtBQWN0QixNQUFNLFlBQW9DO0FBQUEsRUFBMUM7QUFFQyxTQUFpQixjQUFjLElBQUksZ0JBQWdCO0FBRW5ELFNBQWlCLFVBQVUsSUFBSSxRQUFnQjtBQUMvQyxTQUFTLFNBQVMsS0FBSyxRQUFRO0FBQUE7QUFBQSxFQUUvQixRQUF5QjtBQUN4QixXQUFPLFFBQVEsUUFBUSxNQUFNO0FBQUEsRUFDOUI7QUFBQSxFQUVBLE1BQU0sU0FBZ0M7QUFDckMsV0FBTyxRQUFRLE9BQU8sSUFBSSxNQUFNLE9BQU8sQ0FBQztBQUFBLEVBQ3pDO0FBQUEsRUFFQSxnQkFBK0I7QUFDOUIsV0FBTyxJQUFJLFFBQVEsT0FBSztBQUFBLElBQUUsQ0FBQztBQUFBLEVBQzVCO0FBQUEsRUFFQSxnQkFBZ0IsbUJBQXFEO0FBQ3BFLFFBQUksa0JBQWtCLHlCQUF5QjtBQUM5QyxhQUFPLFFBQVEsT0FBTyxTQUFTLENBQUM7QUFBQSxJQUNqQztBQUVBLFdBQU8sSUFBSSxRQUFRLENBQUMsR0FBRyxNQUFNLEtBQUssWUFBWSxJQUFJLGtCQUFrQix3QkFBd0IsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUFBLEVBQ2xIO0FBQUEsRUFFQSxjQUFjLFNBQXNDO0FBQ25ELFdBQU8sUUFBUSxRQUFRLFFBQVEsT0FBTyxDQUFDLEdBQUcsTUFBTSxJQUFJLEVBQUUsT0FBTyxRQUFRLENBQUMsQ0FBQztBQUFBLEVBQ3hFO0FBQUEsRUFFQSxLQUFLLEtBQW1CO0FBQ3ZCLFNBQUssUUFBUSxLQUFLLEdBQUc7QUFBQSxFQUN0QjtBQUFBLEVBRUEsU0FBUyxLQUF3QjtBQUNoQyxXQUFPLFFBQVEsUUFBUSxHQUFHO0FBQUEsRUFDM0I7QUFBQSxFQUVBLFFBQVEsU0FBcUM7QUFDNUMsV0FBTyxRQUFRLFFBQVEsT0FBTztBQUFBLEVBQy9CO0FBQUEsRUFFQSxVQUFVO0FBQ1QsU0FBSyxZQUFZLFFBQVE7QUFBQSxFQUMxQjtBQUNEO0FBRUEsTUFBTSxZQUFzQztBQUFBLEVBRTNDLFlBQW9CLFNBQXVCO0FBQXZCO0FBQUEsRUFBeUI7QUFBQSxFQUU3QyxLQUFLLEdBQVksU0FBaUIsS0FBVSxtQkFBb0Q7QUFDL0YsWUFBUSxTQUFTO0FBQUEsTUFDaEIsS0FBSztBQUFTLGVBQU8sS0FBSyxRQUFRLE1BQU07QUFBQSxNQUN4QyxLQUFLO0FBQVMsZUFBTyxLQUFLLFFBQVEsTUFBTSxHQUFHO0FBQUEsTUFDM0MsS0FBSztBQUFpQixlQUFPLEtBQUssUUFBUSxjQUFjO0FBQUEsTUFDeEQsS0FBSztBQUFtQixlQUFPLEtBQUssUUFBUSxnQkFBZ0IsaUJBQWlCO0FBQUEsTUFDN0UsS0FBSztBQUFpQixlQUFPLEtBQUssUUFBUSxjQUFjLEdBQUc7QUFBQSxNQUMzRDtBQUFTLGVBQU8sUUFBUSxPQUFPLElBQUksTUFBTSxpQkFBaUIsQ0FBQztBQUFBLElBQzVEO0FBQUEsRUFDRDtBQUFBLEVBRUEsT0FBTyxHQUFZLE9BQWUsS0FBdUI7QUFDeEQsWUFBUSxPQUFPO0FBQUEsTUFDZCxLQUFLO0FBQVUsZUFBTyxLQUFLLFFBQVE7QUFBQSxNQUNuQztBQUFTLGNBQU0sSUFBSSxNQUFNLGlCQUFpQjtBQUFBLElBQzNDO0FBQUEsRUFDRDtBQUNEO0FBRUEsTUFBTSxrQkFBMEM7QUFBQSxFQU0vQyxZQUFvQixTQUFtQjtBQUFuQjtBQUFBLEVBQXFCO0FBQUEsRUFKekMsSUFBSSxTQUF3QjtBQUMzQixXQUFPLEtBQUssUUFBUSxPQUFPLFFBQVE7QUFBQSxFQUNwQztBQUFBLEVBSUEsUUFBeUI7QUFDeEIsV0FBTyxLQUFLLFFBQVEsS0FBSyxPQUFPO0FBQUEsRUFDakM7QUFBQSxFQUVBLE1BQU0sU0FBZ0M7QUFDckMsV0FBTyxLQUFLLFFBQVEsS0FBSyxTQUFTLE9BQU87QUFBQSxFQUMxQztBQUFBLEVBRUEsZ0JBQStCO0FBQzlCLFdBQU8sS0FBSyxRQUFRLEtBQUssZUFBZTtBQUFBLEVBQ3pDO0FBQUEsRUFFQSxnQkFBZ0IsbUJBQXFEO0FBQ3BFLFdBQU8sS0FBSyxRQUFRLEtBQUssbUJBQW1CLFFBQVcsaUJBQWlCO0FBQUEsRUFDekU7QUFBQSxFQUVBLGNBQWMsU0FBc0M7QUFDbkQsV0FBTyxLQUFLLFFBQVEsS0FBSyxpQkFBaUIsT0FBTztBQUFBLEVBQ2xEO0FBQUEsRUFFQSxTQUFTLEtBQXdCO0FBQ2hDLFdBQU8sS0FBSyxRQUFRLEtBQUssWUFBWSxHQUFHO0FBQUEsRUFDekM7QUFBQSxFQUVBLFVBQTRCO0FBQzNCLFdBQU8sS0FBSyxRQUFRLEtBQUssU0FBUztBQUFBLEVBQ25DO0FBQ0Q7QUFFQSxNQUFNLFlBQVksV0FBWTtBQUU3QixRQUFNLFFBQVEsd0NBQXdDO0FBRXRELE9BQUssc0JBQXNCLGlCQUFrQjtBQUM1QyxVQUFNLENBQUMsZ0JBQWdCLGNBQWMsSUFBSSxtQkFBbUI7QUFFNUQsVUFBTSxLQUFLLFNBQVMsTUFBTSxDQUFDO0FBQzNCLG1CQUFlLEtBQUssRUFBRTtBQUV0QixVQUFNLEtBQUssU0FBUyxNQUFNLENBQUM7QUFDM0IsbUJBQWUsS0FBSyxFQUFFO0FBRXRCLFVBQU0sS0FBSyxNQUFNLE1BQU0sVUFBVSxlQUFlLFNBQVM7QUFDekQsVUFBTSxLQUFLLE1BQU0sTUFBTSxVQUFVLGVBQWUsU0FBUztBQUV6RCxXQUFPLFlBQVksSUFBSSxFQUFFO0FBQ3pCLFdBQU8sWUFBWSxJQUFJLEVBQUU7QUFBQSxFQUMxQixDQUFDO0FBRUQsUUFBTSxjQUFjLFdBQVk7QUFDL0IsUUFBSTtBQUNKLFFBQUk7QUFDSixRQUFJO0FBQ0osUUFBSTtBQUVKLFVBQU0sV0FBWTtBQUNqQixnQkFBVSxNQUFNLElBQUksSUFBSSxZQUFZLENBQUM7QUFDckMsWUFBTSxhQUFhLE1BQU0sSUFBSSxJQUFJLGNBQWMsQ0FBQztBQUNoRCxlQUFTO0FBRVQsYUFBTyxnQkFBZ0IsZUFBZSxJQUFJLFlBQVksT0FBTyxDQUFDO0FBRTlELGVBQVMsTUFBTSxJQUFJLFdBQVcsaUJBQWlCLFNBQVMsQ0FBQztBQUN6RCxtQkFBYSxJQUFJLGtCQUFrQixPQUFPLFdBQVcsYUFBYSxDQUFDO0FBQUEsSUFDcEUsQ0FBQztBQUVELFNBQUssZ0JBQWdCLGlCQUFrQjtBQUN0QyxZQUFNLElBQUksTUFBTSxXQUFXLE1BQU07QUFDakMsYUFBTyxPQUFPLFlBQVksR0FBRyxNQUFNO0FBQUEsSUFDcEMsQ0FBQztBQUVELFNBQUssY0FBYyxpQkFBa0I7QUFDcEMsVUFBSTtBQUNILGNBQU0sV0FBVyxNQUFNLFlBQVk7QUFDbkMsZUFBTyxPQUFPLEtBQUssdUJBQXVCO0FBQUEsTUFDM0MsU0FBUyxLQUFLO0FBQ2IsZUFBTyxPQUFPLFlBQVksSUFBSSxTQUFTLFlBQVk7QUFBQSxNQUNwRDtBQUFBLElBQ0QsQ0FBQztBQUVELFNBQUssaURBQWlELGlCQUFrQjtBQUN2RSxVQUFJO0FBQ0gsY0FBTSxXQUFXLGdCQUFnQixrQkFBa0IsU0FBUztBQUM1RCxlQUFPLE9BQU8sS0FBSyx1QkFBdUI7QUFBQSxNQUMzQyxTQUFTLEtBQUs7QUFDYixlQUFPLE9BQU8sSUFBSSxZQUFZLFVBQVU7QUFBQSxNQUN6QztBQUFBLElBQ0QsQ0FBQztBQUVELFNBQUssOENBQThDLFdBQVk7QUFDOUQsWUFBTSxNQUFNLElBQUksd0JBQXdCO0FBQ3hDLFlBQU0sVUFBVSxXQUFXLGdCQUFnQixJQUFJLEtBQUssRUFBRTtBQUFBLFFBQ3JELE9BQUssT0FBTyxLQUFLLHVCQUF1QjtBQUFBLFFBQ3hDLFNBQU8sT0FBTyxJQUFJLFlBQVksVUFBVTtBQUFBLE1BQ3pDO0FBRUEsVUFBSSxPQUFPO0FBRVgsYUFBTztBQUFBLElBQ1IsQ0FBQztBQUVELFNBQUssK0NBQStDLFdBQVk7QUFDL0QsWUFBTSxNQUFNLElBQUksd0JBQXdCO0FBQ3hDLFlBQU0sVUFBVSxXQUFXLGdCQUFnQixJQUFJLEtBQUssRUFBRTtBQUFBLFFBQ3JELE9BQUssT0FBTyxLQUFLLHVCQUF1QjtBQUFBLFFBQ3hDLFNBQU8sT0FBTyxJQUFJLFlBQVksVUFBVTtBQUFBLE1BQ3pDO0FBRUEsaUJBQVcsTUFBTSxJQUFJLE9BQU8sQ0FBQztBQUU3QixhQUFPO0FBQUEsSUFDUixDQUFDO0FBRUQsU0FBSyxvQkFBb0IsaUJBQWtCO0FBQzFDLFlBQU0sV0FBcUIsQ0FBQztBQUU1QixZQUFNLElBQUksV0FBVyxPQUFPLFNBQU8sU0FBUyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ3RELFlBQU0sUUFBUSxDQUFDO0FBRWYsYUFBTyxnQkFBZ0IsVUFBVSxDQUFDLENBQUM7QUFDbkMsY0FBUSxLQUFLLE9BQU87QUFDcEIsWUFBTSxRQUFRLENBQUM7QUFFZixhQUFPLGdCQUFnQixVQUFVLENBQUMsT0FBTyxDQUFDO0FBQzFDLGNBQVEsS0FBSyxPQUFPO0FBQ3BCLFlBQU0sUUFBUSxDQUFDO0FBRWYsYUFBTyxnQkFBZ0IsVUFBVSxDQUFDLFNBQVMsT0FBTyxDQUFDO0FBQUEsSUFDcEQsQ0FBQztBQUVELFNBQUsscUJBQXFCLGlCQUFrQjtBQUMzQyxZQUFNLElBQUksTUFBTSxXQUFXLGNBQWMsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxHQUFHLFNBQVMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUMvRSxhQUFPLE9BQU8sWUFBWSxHQUFHLENBQUM7QUFBQSxJQUMvQixDQUFDO0FBRUQsU0FBSyx1QkFBdUIsTUFBTTtBQUNqQyxZQUFNLFFBQVE7QUFBQSxRQUNiO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUVBLFlBQU0sU0FBUyxJQUFJLGFBQWE7QUFDaEMsZ0JBQVUsUUFBUSxLQUFLO0FBQ3ZCLGFBQU8sZ0JBQWdCLFlBQVksSUFBSSxhQUFhLE9BQU8sTUFBTSxDQUFDLEdBQUcsS0FBSztBQUFBLElBQzNFLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxRQUFNLHNCQUFzQixXQUFZO0FBQ3ZDLFFBQUk7QUFDSixRQUFJO0FBQ0osUUFBSTtBQUNKLFFBQUk7QUFFSixVQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFFeEMsVUFBTSxXQUFZO0FBQ2pCLGdCQUFVLE1BQU0sSUFBSSxJQUFJLFlBQVksQ0FBQztBQUNyQyxZQUFNLGFBQWEsWUFBWSxJQUFJLElBQUksY0FBYyxDQUFDO0FBQ3RELGVBQVM7QUFFVCxhQUFPLGdCQUFnQixlQUFlLGFBQWEsWUFBWSxTQUFTLFdBQVcsQ0FBQztBQUVwRixlQUFTLFlBQVksSUFBSSxXQUFXLGlCQUFpQixTQUFTLENBQUM7QUFDL0QsbUJBQWEsYUFBYSxVQUFVLE9BQU8sV0FBVyxhQUFhLENBQUM7QUFBQSxJQUNyRSxDQUFDO0FBRUQsYUFBUyxXQUFZO0FBQ3BCLGtCQUFZLE1BQU07QUFBQSxJQUNuQixDQUFDO0FBRUQsU0FBSyxnQkFBZ0IsaUJBQWtCO0FBQ3RDLFlBQU0sSUFBSSxNQUFNLFdBQVcsTUFBTTtBQUNqQyxhQUFPLE9BQU8sWUFBWSxHQUFHLE1BQU07QUFBQSxJQUNwQyxDQUFDO0FBRUQsU0FBSyxjQUFjLGlCQUFrQjtBQUNwQyxVQUFJO0FBQ0gsY0FBTSxXQUFXLE1BQU0sWUFBWTtBQUNuQyxlQUFPLE9BQU8sS0FBSyx1QkFBdUI7QUFBQSxNQUMzQyxTQUFTLEtBQUs7QUFDYixlQUFPLE9BQU8sWUFBWSxJQUFJLFNBQVMsWUFBWTtBQUFBLE1BQ3BEO0FBQUEsSUFDRCxDQUFDO0FBRUQsU0FBSyxvQkFBb0IsaUJBQWtCO0FBQzFDLFlBQU0sV0FBcUIsQ0FBQztBQUU1QixrQkFBWSxJQUFJLFdBQVcsT0FBTyxTQUFPLFNBQVMsS0FBSyxHQUFHLENBQUMsQ0FBQztBQUM1RCxZQUFNLFFBQVEsQ0FBQztBQUVmLGFBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxDQUFDO0FBQ25DLGNBQVEsS0FBSyxPQUFPO0FBQ3BCLFlBQU0sUUFBUSxDQUFDO0FBRWYsYUFBTyxnQkFBZ0IsVUFBVSxDQUFDLE9BQU8sQ0FBQztBQUMxQyxjQUFRLEtBQUssT0FBTztBQUNwQixZQUFNLFFBQVEsQ0FBQztBQUVmLGFBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxTQUFTLE9BQU8sQ0FBQztBQUFBLElBQ3BELENBQUM7QUFFRCxTQUFLLG1CQUFtQixpQkFBa0I7QUFDekMsWUFBTSxNQUFNLElBQUksS0FBSyxRQUFRO0FBQzdCLFlBQU0sSUFBSSxNQUFNLFdBQVcsU0FBUyxHQUFHO0FBQ3ZDLGFBQU8sR0FBRyxhQUFhLEdBQUc7QUFDMUIsYUFBTyxPQUFPLEdBQUcsUUFBUSxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ2pDLENBQUM7QUFFRCxTQUFLLHFCQUFxQixpQkFBa0I7QUFDM0MsWUFBTSxJQUFJLE1BQU0sV0FBVyxjQUFjLENBQUMsU0FBUyxNQUFNLENBQUMsR0FBRyxTQUFTLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDL0UsYUFBTyxPQUFPLFlBQVksR0FBRyxDQUFDO0FBQUEsSUFDL0IsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELFFBQU0scUNBQXFDLFdBQVk7QUFDdEQsUUFBSTtBQUNKLFFBQUk7QUFDSixRQUFJO0FBQ0osUUFBSTtBQUVKLFVBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUV4QyxVQUFNLFdBQVk7QUFDakIsZ0JBQVUsTUFBTSxJQUFJLElBQUksWUFBWSxDQUFDO0FBQ3JDLFlBQU0sYUFBYSxZQUFZLElBQUksSUFBSSxjQUFjLENBQUM7QUFDdEQsZUFBUztBQUVULGFBQU8sZ0JBQWdCLGVBQWUsYUFBYSxZQUFZLFNBQVMsV0FBVyxDQUFDO0FBRXBGLGVBQVMsWUFBWSxJQUFJLFdBQVcsaUJBQWlCLFNBQVMsQ0FBQztBQUMvRCxtQkFBYSxhQUFhLFVBQVUsT0FBTyxXQUFXLGFBQWEsR0FBRyxFQUFFLFNBQVMsZ0JBQWdCLENBQUM7QUFBQSxJQUNuRyxDQUFDO0FBRUQsYUFBUyxXQUFZO0FBQ3BCLGtCQUFZLE1BQU07QUFBQSxJQUNuQixDQUFDO0FBRUQsU0FBSyxzQkFBc0IsaUJBQWtCO0FBQzVDLFlBQU0sSUFBSSxNQUFNLFdBQVcsUUFBUTtBQUNuQyxhQUFPLE9BQU8sWUFBWSxHQUFHLGVBQWU7QUFBQSxJQUM3QyxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsUUFBTSxlQUFlLFdBQVk7QUFDaEMsU0FBSywwQkFBMEIsaUJBQWtCO0FBQ2hELFlBQU0sVUFBVSxNQUFNLElBQUksSUFBSSxZQUFZLENBQUM7QUFDM0MsWUFBTSxVQUFVLElBQUksWUFBWSxPQUFPO0FBQ3ZDLFlBQU0sU0FBUyxNQUFNLElBQUksSUFBSSxjQUFjLENBQUM7QUFDNUMsYUFBTyxnQkFBZ0IsV0FBVyxPQUFPO0FBRXpDLFVBQUksbUJBQW1CO0FBQ3ZCLFlBQU0sVUFBVSxNQUFNLElBQUksT0FBTyxpQkFBaUIsU0FBUyxDQUFDO0FBQzVELFlBQU0sY0FBYyxJQUFJLGtCQUFrQixRQUFRLFdBQVcsU0FBUyxDQUFDO0FBQ3ZFLFlBQU0sSUFBSSxZQUFZLE9BQU8sTUFBTSxtQkFBbUIsSUFBSSxDQUFDO0FBRTNELFVBQUksbUJBQW1CO0FBQ3ZCLFlBQU0sVUFBVSxNQUFNLElBQUksT0FBTyxpQkFBaUIsU0FBUyxDQUFDO0FBQzVELFlBQU0sY0FBYyxJQUFJLGtCQUFrQixRQUFRLFdBQVcsU0FBUyxDQUFDO0FBQ3ZFLFlBQU0sSUFBSSxZQUFZLE9BQU8sTUFBTSxtQkFBbUIsSUFBSSxDQUFDO0FBRTNELFlBQU0sUUFBUSxDQUFDO0FBQ2YsY0FBUSxLQUFLLE9BQU87QUFFcEIsWUFBTSxRQUFRLENBQUM7QUFDZixhQUFPLGtCQUFrQixxQkFBcUI7QUFDOUMsYUFBTyxrQkFBa0IscUJBQXFCO0FBQUEsSUFDL0MsQ0FBQztBQUVELFNBQUssMERBQTBELGlCQUFrQjtBQUNoRixZQUFNLFNBQVMsTUFBTSxJQUFJLElBQUksY0FBYyxDQUFDO0FBRTVDLFlBQU0sVUFBVSxPQUFPLGlCQUFpQixTQUFTO0FBQ2pELFlBQU0saUJBQWlCLE1BQU0sSUFBSSxJQUFJLFlBQVksQ0FBQztBQUNsRCxZQUFNLGlCQUFpQixJQUFJLFlBQVksY0FBYztBQUNyRCxjQUFRLGdCQUFnQixXQUFXLGNBQWM7QUFFakQsWUFBTSxRQUFrQixDQUFDO0FBQ3pCLFlBQU0sVUFBVSxPQUFPLFdBQVcsV0FBVyxNQUFNLElBQUk7QUFDdkQsWUFBTSxVQUFVLElBQUksa0JBQWtCLE9BQU87QUFDN0MsWUFBTSxJQUFJLFFBQVEsT0FBTyxTQUFPLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQztBQUVoRCxZQUFNLFFBQVEsQ0FBQztBQUNmLHFCQUFlLEtBQUssU0FBUztBQUU3QixZQUFNLFFBQVEsQ0FBQztBQUNmLGFBQU8sZ0JBQWdCLE9BQU8sQ0FBQyxTQUFTLENBQUM7QUFFekMsWUFBTSxVQUFVLE9BQU8saUJBQWlCLFNBQVM7QUFDakQsWUFBTSxpQkFBaUIsTUFBTSxJQUFJLElBQUksWUFBWSxDQUFDO0FBQ2xELFlBQU0saUJBQWlCLElBQUksWUFBWSxjQUFjO0FBQ3JELGNBQVEsZ0JBQWdCLFdBQVcsY0FBYztBQUVqRCxZQUFNLFFBQVEsQ0FBQztBQUNmLHFCQUFlLEtBQUssU0FBUztBQUU3QixZQUFNLFFBQVEsQ0FBQztBQUNmLGFBQU8sZ0JBQWdCLE9BQU8sQ0FBQyxXQUFXLFNBQVMsQ0FBQztBQUVwRCxjQUFRLFFBQVE7QUFDaEIscUJBQWUsS0FBSyxTQUFTO0FBRTdCLFlBQU0sUUFBUSxDQUFDO0FBQ2YsYUFBTyxnQkFBZ0IsT0FBTyxDQUFDLFdBQVcsU0FBUyxDQUFDO0FBRXBELFlBQU0sUUFBUSxDQUFDO0FBQ2YscUJBQWUsS0FBSyxlQUFlO0FBRW5DLFlBQU0sUUFBUSxDQUFDO0FBQ2YsYUFBTyxnQkFBZ0IsT0FBTyxDQUFDLFdBQVcsV0FBVyxlQUFlLENBQUM7QUFFckUsY0FBUSxRQUFRO0FBQUEsSUFDakIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
