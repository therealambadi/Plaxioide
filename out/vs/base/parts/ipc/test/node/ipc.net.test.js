import assert from "assert";
import sinon from "sinon";
import { EventEmitter } from "events";
import { connect, createServer } from "net";
import { tmpdir } from "os";
import { Barrier, timeout } from "../../../../common/async.js";
import { VSBuffer } from "../../../../common/buffer.js";
import { Emitter, Event } from "../../../../common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../common/lifecycle.js";
import { PersistentProtocol, Protocol, ProtocolConstants } from "../../common/ipc.net.js";
import { createRandomIPCHandle, createStaticIPCHandle, NodeSocket, WebSocketNodeSocket } from "../../node/ipc.net.js";
import { flakySuite } from "../../../../test/common/testUtils.js";
import { runWithFakedTimers } from "../../../../test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../test/common/utils.js";
class MessageStream extends Disposable {
  constructor(x) {
    super();
    this._currentComplete = null;
    this._messages = [];
    this._register(x.onMessage((data) => {
      this._messages.push(data);
      this._trigger();
    }));
  }
  _trigger() {
    if (!this._currentComplete) {
      return;
    }
    if (this._messages.length === 0) {
      return;
    }
    const complete = this._currentComplete;
    const msg = this._messages.shift();
    this._currentComplete = null;
    complete(msg);
  }
  waitForOne() {
    return new Promise((complete) => {
      this._currentComplete = complete;
      this._trigger();
    });
  }
}
class EtherStream extends EventEmitter {
  constructor(_ether, _name) {
    super();
    this._ether = _ether;
    this._name = _name;
  }
  write(data, cb) {
    if (!Buffer.isBuffer(data)) {
      throw new Error(`Invalid data`);
    }
    this._ether.write(this._name, data);
    return true;
  }
  destroy() {
  }
}
class Ether {
  constructor(_wireLatency = 0) {
    this._wireLatency = _wireLatency;
    this._a = new EtherStream(this, "a");
    this._b = new EtherStream(this, "b");
    this._ab = [];
    this._ba = [];
  }
  get a() {
    return this._a;
  }
  get b() {
    return this._b;
  }
  write(from, data) {
    setTimeout(() => {
      if (from === "a") {
        this._ab.push(data);
      } else {
        this._ba.push(data);
      }
      setTimeout(() => this._deliver(), 0);
    }, this._wireLatency);
  }
  _deliver() {
    if (this._ab.length > 0) {
      const data = Buffer.concat(this._ab);
      this._ab.length = 0;
      this._b.emit("data", data);
      setTimeout(() => this._deliver(), 0);
      return;
    }
    if (this._ba.length > 0) {
      const data = Buffer.concat(this._ba);
      this._ba.length = 0;
      this._a.emit("data", data);
      setTimeout(() => this._deliver(), 0);
      return;
    }
  }
}
suite("IPC, Socket Protocol", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  let ether;
  setup(() => {
    ether = new Ether();
  });
  test("read/write", async () => {
    const a = new Protocol(new NodeSocket(ether.a));
    const b = new Protocol(new NodeSocket(ether.b));
    const bMessages = new MessageStream(b);
    a.send(VSBuffer.fromString("foobarfarboo"));
    const msg1 = await bMessages.waitForOne();
    assert.strictEqual(msg1.toString(), "foobarfarboo");
    const buffer = VSBuffer.alloc(1);
    buffer.writeUInt8(123, 0);
    a.send(buffer);
    const msg2 = await bMessages.waitForOne();
    assert.strictEqual(msg2.readUInt8(0), 123);
    bMessages.dispose();
    a.dispose();
    b.dispose();
  });
  test("read/write, object data", async () => {
    const a = new Protocol(new NodeSocket(ether.a));
    const b = new Protocol(new NodeSocket(ether.b));
    const bMessages = new MessageStream(b);
    const data = {
      pi: Math.PI,
      foo: "bar",
      more: true,
      data: "Hello World".split("")
    };
    a.send(VSBuffer.fromString(JSON.stringify(data)));
    const msg = await bMessages.waitForOne();
    assert.deepStrictEqual(JSON.parse(msg.toString()), data);
    bMessages.dispose();
    a.dispose();
    b.dispose();
  });
  test("issue #211462: destroy socket after end timeout", async () => {
    const socket = new EventEmitter();
    Object.assign(socket, { destroy: () => socket.emit("close") });
    const protocol = ds.add(new Protocol(new NodeSocket(socket)));
    const disposed = sinon.stub();
    const timers = sinon.useFakeTimers();
    ds.add(toDisposable(() => timers.restore()));
    ds.add(protocol.onDidDispose(disposed));
    socket.emit("end");
    assert.ok(!disposed.called);
    timers.tick(29999);
    assert.ok(!disposed.called);
    timers.tick(1);
    assert.ok(disposed.called);
  });
});
suite("PersistentProtocol reconnection", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("acks get piggybacked with messages", async () => {
    const ether = new Ether();
    const a = new PersistentProtocol({ socket: new NodeSocket(ether.a) });
    const aMessages = new MessageStream(a);
    const b = new PersistentProtocol({ socket: new NodeSocket(ether.b) });
    const bMessages = new MessageStream(b);
    a.send(VSBuffer.fromString("a1"));
    assert.strictEqual(a.unacknowledgedCount, 1);
    assert.strictEqual(b.unacknowledgedCount, 0);
    a.send(VSBuffer.fromString("a2"));
    assert.strictEqual(a.unacknowledgedCount, 2);
    assert.strictEqual(b.unacknowledgedCount, 0);
    a.send(VSBuffer.fromString("a3"));
    assert.strictEqual(a.unacknowledgedCount, 3);
    assert.strictEqual(b.unacknowledgedCount, 0);
    const a1 = await bMessages.waitForOne();
    assert.strictEqual(a1.toString(), "a1");
    assert.strictEqual(a.unacknowledgedCount, 3);
    assert.strictEqual(b.unacknowledgedCount, 0);
    const a2 = await bMessages.waitForOne();
    assert.strictEqual(a2.toString(), "a2");
    assert.strictEqual(a.unacknowledgedCount, 3);
    assert.strictEqual(b.unacknowledgedCount, 0);
    const a3 = await bMessages.waitForOne();
    assert.strictEqual(a3.toString(), "a3");
    assert.strictEqual(a.unacknowledgedCount, 3);
    assert.strictEqual(b.unacknowledgedCount, 0);
    b.send(VSBuffer.fromString("b1"));
    assert.strictEqual(a.unacknowledgedCount, 3);
    assert.strictEqual(b.unacknowledgedCount, 1);
    const b1 = await aMessages.waitForOne();
    assert.strictEqual(b1.toString(), "b1");
    assert.strictEqual(a.unacknowledgedCount, 0);
    assert.strictEqual(b.unacknowledgedCount, 1);
    a.send(VSBuffer.fromString("a4"));
    assert.strictEqual(a.unacknowledgedCount, 1);
    assert.strictEqual(b.unacknowledgedCount, 1);
    const b2 = await bMessages.waitForOne();
    assert.strictEqual(b2.toString(), "a4");
    assert.strictEqual(a.unacknowledgedCount, 1);
    assert.strictEqual(b.unacknowledgedCount, 0);
    aMessages.dispose();
    bMessages.dispose();
    a.dispose();
    b.dispose();
  });
  test("ack gets sent after a while", async () => {
    await runWithFakedTimers({ useFakeTimers: true, maxTaskCount: 100 }, async () => {
      const loadEstimator = {
        hasHighLoad: () => false
      };
      const ether = new Ether();
      const aSocket = new NodeSocket(ether.a);
      const a = new PersistentProtocol({ socket: aSocket, loadEstimator });
      const aMessages = new MessageStream(a);
      const bSocket = new NodeSocket(ether.b);
      const b = new PersistentProtocol({ socket: bSocket, loadEstimator });
      const bMessages = new MessageStream(b);
      a.send(VSBuffer.fromString("a1"));
      assert.strictEqual(a.unacknowledgedCount, 1);
      assert.strictEqual(b.unacknowledgedCount, 0);
      const a1 = await bMessages.waitForOne();
      assert.strictEqual(a1.toString(), "a1");
      assert.strictEqual(a.unacknowledgedCount, 1);
      assert.strictEqual(b.unacknowledgedCount, 0);
      await timeout(2 * ProtocolConstants.AcknowledgeTime);
      assert.strictEqual(a.unacknowledgedCount, 0);
      assert.strictEqual(b.unacknowledgedCount, 0);
      aMessages.dispose();
      bMessages.dispose();
      a.dispose();
      b.dispose();
    });
  });
  test("messages that are never written to a socket should not cause an ack timeout", async () => {
    await runWithFakedTimers(
      {
        useFakeTimers: true,
        useSetImmediate: true,
        maxTaskCount: 1e3
      },
      async () => {
        await timeout(60 * 60 * 1e3);
        const loadEstimator = {
          hasHighLoad: () => false
        };
        const ether = new Ether();
        const aSocket = new NodeSocket(ether.a);
        const a = new PersistentProtocol({ socket: aSocket, loadEstimator, sendKeepAlive: false });
        const aMessages = new MessageStream(a);
        const bSocket = new NodeSocket(ether.b);
        const b = new PersistentProtocol({ socket: bSocket, loadEstimator, sendKeepAlive: false });
        const bMessages = new MessageStream(b);
        a.send(VSBuffer.fromString("a1"));
        assert.strictEqual(a.unacknowledgedCount, 1);
        assert.strictEqual(b.unacknowledgedCount, 0);
        const a1 = await bMessages.waitForOne();
        assert.strictEqual(a1.toString(), "a1");
        assert.strictEqual(a.unacknowledgedCount, 1);
        assert.strictEqual(b.unacknowledgedCount, 0);
        b.send(VSBuffer.fromString("b1"));
        assert.strictEqual(a.unacknowledgedCount, 1);
        assert.strictEqual(b.unacknowledgedCount, 1);
        const b1 = await aMessages.waitForOne();
        assert.strictEqual(b1.toString(), "b1");
        assert.strictEqual(a.unacknowledgedCount, 0);
        assert.strictEqual(b.unacknowledgedCount, 1);
        aSocket.dispose();
        const aSocket2 = new NodeSocket(ether.a);
        a.beginAcceptReconnection(aSocket2, null);
        let timeoutListenerCalled = false;
        const socketTimeoutListener = a.onSocketTimeout(() => {
          timeoutListenerCalled = true;
        });
        a.send(VSBuffer.fromString("a2"));
        assert.strictEqual(a.unacknowledgedCount, 1);
        assert.strictEqual(b.unacknowledgedCount, 1);
        await timeout(2 * ProtocolConstants.TimeoutTime);
        assert.strictEqual(a.unacknowledgedCount, 1);
        assert.strictEqual(b.unacknowledgedCount, 1);
        assert.strictEqual(timeoutListenerCalled, false);
        a.endAcceptReconnection();
        assert.strictEqual(timeoutListenerCalled, false);
        await timeout(2 * ProtocolConstants.TimeoutTime);
        assert.strictEqual(a.unacknowledgedCount, 0);
        assert.strictEqual(b.unacknowledgedCount, 0);
        assert.strictEqual(timeoutListenerCalled, false);
        socketTimeoutListener.dispose();
        aMessages.dispose();
        bMessages.dispose();
        a.dispose();
        b.dispose();
      }
    );
  });
  test("acks are always sent after a reconnection", async () => {
    await runWithFakedTimers(
      {
        useFakeTimers: true,
        useSetImmediate: true,
        maxTaskCount: 1e3
      },
      async () => {
        const loadEstimator = {
          hasHighLoad: () => false
        };
        const wireLatency = 1e3;
        const ether = new Ether(wireLatency);
        const aSocket = new NodeSocket(ether.a);
        const a = new PersistentProtocol({ socket: aSocket, loadEstimator });
        const aMessages = new MessageStream(a);
        const bSocket = new NodeSocket(ether.b);
        const b = new PersistentProtocol({ socket: bSocket, loadEstimator });
        const bMessages = new MessageStream(b);
        a.send(VSBuffer.fromString("a1"));
        assert.strictEqual(a.unacknowledgedCount, 1);
        assert.strictEqual(b.unacknowledgedCount, 0);
        const a1 = await bMessages.waitForOne();
        assert.strictEqual(a1.toString(), "a1");
        assert.strictEqual(a.unacknowledgedCount, 1);
        assert.strictEqual(b.unacknowledgedCount, 0);
        await timeout(ProtocolConstants.AcknowledgeTime + wireLatency / 2);
        assert.strictEqual(a.unacknowledgedCount, 1);
        assert.strictEqual(b.unacknowledgedCount, 0);
        aSocket.dispose();
        bSocket.dispose();
        const ether2 = new Ether(wireLatency);
        const aSocket2 = new NodeSocket(ether2.a);
        const bSocket2 = new NodeSocket(ether2.b);
        b.beginAcceptReconnection(bSocket2, null);
        b.endAcceptReconnection();
        a.beginAcceptReconnection(aSocket2, null);
        a.endAcceptReconnection();
        await timeout(2 * ProtocolConstants.AcknowledgeTime + wireLatency);
        assert.strictEqual(a.unacknowledgedCount, 0);
        assert.strictEqual(b.unacknowledgedCount, 0);
        aMessages.dispose();
        bMessages.dispose();
        a.dispose();
        b.dispose();
      }
    );
  });
  test("onSocketTimeout is emitted at most once every 20s", async () => {
    await runWithFakedTimers(
      {
        useFakeTimers: true,
        useSetImmediate: true,
        maxTaskCount: 1e3
      },
      async () => {
        const loadEstimator = {
          hasHighLoad: () => false
        };
        const ether = new Ether();
        const aSocket = new NodeSocket(ether.a);
        const a = new PersistentProtocol({ socket: aSocket, loadEstimator });
        const aMessages = new MessageStream(a);
        const bSocket = new NodeSocket(ether.b);
        const b = new PersistentProtocol({ socket: bSocket, loadEstimator });
        const bMessages = new MessageStream(b);
        b.pauseSocketWriting();
        a.send(VSBuffer.fromString("a1"));
        await Event.toPromise(a.onSocketTimeout);
        let timeoutFiredAgain = false;
        const timeoutListener = a.onSocketTimeout(() => {
          timeoutFiredAgain = true;
        });
        a.send(VSBuffer.fromString("a2"));
        a.send(VSBuffer.fromString("a3"));
        await timeout(ProtocolConstants.TimeoutTime / 2);
        assert.strictEqual(timeoutFiredAgain, false);
        timeoutListener.dispose();
        aMessages.dispose();
        bMessages.dispose();
        a.dispose();
        b.dispose();
      }
    );
  });
  test("writing can be paused", async () => {
    await runWithFakedTimers({ useFakeTimers: true, maxTaskCount: 100 }, async () => {
      const loadEstimator = {
        hasHighLoad: () => false
      };
      const ether = new Ether();
      const aSocket = new NodeSocket(ether.a);
      const a = new PersistentProtocol({ socket: aSocket, loadEstimator });
      const aMessages = new MessageStream(a);
      const bSocket = new NodeSocket(ether.b);
      const b = new PersistentProtocol({ socket: bSocket, loadEstimator });
      const bMessages = new MessageStream(b);
      a.send(VSBuffer.fromString("a1"));
      const a1 = await bMessages.waitForOne();
      assert.strictEqual(a1.toString(), "a1");
      b.sendPause();
      b.send(VSBuffer.fromString("b1"));
      const b1 = await aMessages.waitForOne();
      assert.strictEqual(b1.toString(), "b1");
      a.send(VSBuffer.fromString("a2"));
      await timeout(2 * ProtocolConstants.AcknowledgeTime);
      assert.strictEqual(a.unacknowledgedCount, 1);
      assert.strictEqual(b.unacknowledgedCount, 1);
      b.sendResume();
      const a2 = await bMessages.waitForOne();
      assert.strictEqual(a2.toString(), "a2");
      await timeout(2 * ProtocolConstants.AcknowledgeTime);
      assert.strictEqual(a.unacknowledgedCount, 0);
      assert.strictEqual(b.unacknowledgedCount, 0);
      aMessages.dispose();
      bMessages.dispose();
      a.dispose();
      b.dispose();
    });
  });
});
flakySuite("IPC, create handle", () => {
  test("createRandomIPCHandle", async () => {
    return testIPCHandle(createRandomIPCHandle());
  });
  test("createStaticIPCHandle", async () => {
    return testIPCHandle(createStaticIPCHandle(tmpdir(), "test", "1.64.0"));
  });
  function testIPCHandle(handle) {
    return new Promise((resolve, reject) => {
      const pipeName = createRandomIPCHandle();
      const server = createServer();
      server.on("error", () => {
        return new Promise(() => server.close(() => reject()));
      });
      server.listen(pipeName, () => {
        server.removeListener("error", reject);
        return new Promise(() => {
          server.close(() => resolve());
        });
      });
    });
  }
});
suite("WebSocketNodeSocket", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  function toUint8Array(data) {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i];
    }
    return result;
  }
  function fromUint8Array(data) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i];
    }
    return result;
  }
  function fromCharCodeArray(data) {
    let result = "";
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(data[i]);
    }
    return result;
  }
  class FakeNodeSocket extends Disposable {
    constructor() {
      super();
      this._onData = new Emitter();
      this.onData = this._onData.event;
      this._onClose = new Emitter();
      this.onClose = this._onClose.event;
      this.writtenData = [];
    }
    traceSocketEvent(type, data) {
    }
    write(data) {
      this.writtenData.push(data);
    }
    fireData(data) {
      this._onData.fire(VSBuffer.wrap(toUint8Array(data)));
    }
  }
  async function testReading(frames, permessageDeflate) {
    const disposables = new DisposableStore();
    const socket = new FakeNodeSocket();
    const webSocket = disposables.add(new WebSocketNodeSocket(socket, permessageDeflate, null, false));
    const barrier = new Barrier();
    let remainingFrameCount = frames.length;
    let receivedData = "";
    disposables.add(webSocket.onData((buff) => {
      receivedData += fromCharCodeArray(fromUint8Array(buff.buffer));
      remainingFrameCount--;
      if (remainingFrameCount === 0) {
        barrier.open();
      }
    }));
    for (let i = 0; i < frames.length; i++) {
      socket.fireData(frames[i]);
    }
    await barrier.wait();
    disposables.dispose();
    return receivedData;
  }
  test("A single-frame unmasked text message", async () => {
    const frames = [
      [129, 5, 72, 101, 108, 108, 111]
      // contains "Hello"
    ];
    const actual = await testReading(frames, false);
    assert.deepStrictEqual(actual, "Hello");
  });
  test("A single-frame masked text message", async () => {
    const frames = [
      [129, 133, 55, 250, 33, 61, 127, 159, 77, 81, 88]
      // contains "Hello"
    ];
    const actual = await testReading(frames, false);
    assert.deepStrictEqual(actual, "Hello");
  });
  test("A fragmented unmasked text message", async () => {
    const frames = [
      [1, 3, 72, 101, 108],
      // contains "Hel"
      [128, 2, 108, 111]
      // contains "lo"
    ];
    const actual = await testReading(frames, false);
    assert.deepStrictEqual(actual, "Hello");
  });
  suite("compression", () => {
    test("A single-frame compressed text message", async () => {
      const frames = [
        [193, 7, 242, 72, 205, 201, 201, 7, 0]
        // contains "Hello"
      ];
      const actual = await testReading(frames, true);
      assert.deepStrictEqual(actual, "Hello");
    });
    test("A fragmented compressed text message", async () => {
      const frames = [
        // contains "Hello"
        [65, 3, 242, 72, 205],
        [128, 4, 201, 201, 7, 0]
      ];
      const actual = await testReading(frames, true);
      assert.deepStrictEqual(actual, "Hello");
    });
    test("A single-frame non-compressed text message", async () => {
      const frames = [
        [129, 5, 72, 101, 108, 108, 111]
        // contains "Hello"
      ];
      const actual = await testReading(frames, true);
      assert.deepStrictEqual(actual, "Hello");
    });
    test("A single-frame compressed text message followed by a single-frame non-compressed text message", async () => {
      const frames = [
        [193, 7, 242, 72, 205, 201, 201, 7, 0],
        // contains "Hello"
        [129, 5, 119, 111, 114, 108, 100]
        // contains "world"
      ];
      const actual = await testReading(frames, true);
      assert.deepStrictEqual(actual, "Helloworld");
    });
  });
  test("Large buffers are split and sent in chunks", async () => {
    let receivingSideOnDataCallCount = 0;
    let receivingSideTotalBytes = 0;
    const receivingSideSocketClosedBarrier = new Barrier();
    const server = await listenOnRandomPort((socket2) => {
      server.close();
      const webSocketNodeSocket2 = new WebSocketNodeSocket(new NodeSocket(socket2), true, null, false);
      ds.add(webSocketNodeSocket2.onData((data) => {
        receivingSideOnDataCallCount++;
        receivingSideTotalBytes += data.byteLength;
      }));
      ds.add(webSocketNodeSocket2.onClose(() => {
        webSocketNodeSocket2.dispose();
        receivingSideSocketClosedBarrier.open();
      }));
    });
    const socket = connect({
      host: "127.0.0.1",
      port: server.address().port
    });
    const buff = generateRandomBuffer(1 * 1024 * 1024);
    const webSocketNodeSocket = new WebSocketNodeSocket(new NodeSocket(socket), true, null, false);
    webSocketNodeSocket.write(buff);
    await webSocketNodeSocket.drain();
    webSocketNodeSocket.dispose();
    await receivingSideSocketClosedBarrier.wait();
    assert.strictEqual(receivingSideTotalBytes, buff.byteLength);
    assert.strictEqual(receivingSideOnDataCallCount, 4);
  });
  test("issue #194284: ping/pong opcodes are supported", async () => {
    const disposables = new DisposableStore();
    const socket = new FakeNodeSocket();
    const webSocket = disposables.add(new WebSocketNodeSocket(socket, false, null, false));
    let receivedData = "";
    disposables.add(webSocket.onData((buff) => {
      receivedData += fromCharCodeArray(fromUint8Array(buff.buffer));
    }));
    socket.fireData([129, 5, 72, 101, 108, 108, 111]);
    socket.fireData([137, 4, 100, 97, 116, 97]);
    socket.fireData([129, 5, 72, 101, 108, 108, 111]);
    assert.strictEqual(receivedData, "HelloHello");
    assert.deepStrictEqual(
      socket.writtenData.map((x) => fromUint8Array(x.buffer)),
      [
        // A pong message that contains "data"
        [138, 4, 100, 97, 116, 97]
      ]
    );
    disposables.dispose();
    return receivedData;
  });
  function generateRandomBuffer(size) {
    const buff = VSBuffer.alloc(size);
    for (let i = 0; i < size; i++) {
      buff.writeUInt8(Math.floor(256 * Math.random()), i);
    }
    return buff;
  }
  function listenOnRandomPort(handler) {
    return new Promise((resolve, reject) => {
      const server = createServer(handler).listen(0);
      server.on("listening", () => {
        resolve(server);
      });
      server.on("error", (err) => {
        reject(err);
      });
    });
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3BhcnRzL2lwYy90ZXN0L25vZGUvaXBjLm5ldC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHNpbm9uIGZyb20gJ3Npbm9uJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgeyBBZGRyZXNzSW5mbywgY29ubmVjdCwgY3JlYXRlU2VydmVyLCBTZXJ2ZXIsIFNvY2tldCB9IGZyb20gJ25ldCc7XG5pbXBvcnQgeyB0bXBkaXIgfSBmcm9tICdvcyc7XG5pbXBvcnQgeyBCYXJyaWVyLCB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUxvYWRFc3RpbWF0b3IsIFBlcnNpc3RlbnRQcm90b2NvbCwgUHJvdG9jb2wsIFByb3RvY29sQ29uc3RhbnRzLCBTb2NrZXRDbG9zZUV2ZW50LCBTb2NrZXREaWFnbm9zdGljc0V2ZW50VHlwZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9pcGMubmV0LmpzJztcbmltcG9ydCB7IGNyZWF0ZVJhbmRvbUlQQ0hhbmRsZSwgY3JlYXRlU3RhdGljSVBDSGFuZGxlLCBOb2RlU29ja2V0LCBXZWJTb2NrZXROb2RlU29ja2V0IH0gZnJvbSAnLi4vLi4vbm9kZS9pcGMubmV0LmpzJztcbmltcG9ydCB7IGZsYWt5U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi90ZXN0VXRpbHMuanMnO1xuaW1wb3J0IHsgcnVuV2l0aEZha2VkVGltZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vdGltZVRyYXZlbFNjaGVkdWxlci5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbmNsYXNzIE1lc3NhZ2VTdHJlYW0gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIF9jdXJyZW50Q29tcGxldGU6ICgoZGF0YTogVlNCdWZmZXIpID0+IHZvaWQpIHwgbnVsbDtcblx0cHJpdmF0ZSBfbWVzc2FnZXM6IFZTQnVmZmVyW107XG5cblx0Y29uc3RydWN0b3IoeDogUHJvdG9jb2wgfCBQZXJzaXN0ZW50UHJvdG9jb2wpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2N1cnJlbnRDb21wbGV0ZSA9IG51bGw7XG5cdFx0dGhpcy5fbWVzc2FnZXMgPSBbXTtcblx0XHR0aGlzLl9yZWdpc3Rlcih4Lm9uTWVzc2FnZShkYXRhID0+IHtcblx0XHRcdHRoaXMuX21lc3NhZ2VzLnB1c2goZGF0YSk7XG5cdFx0XHR0aGlzLl90cmlnZ2VyKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdHJpZ2dlcigpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2N1cnJlbnRDb21wbGV0ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fbWVzc2FnZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGNvbXBsZXRlID0gdGhpcy5fY3VycmVudENvbXBsZXRlO1xuXHRcdGNvbnN0IG1zZyA9IHRoaXMuX21lc3NhZ2VzLnNoaWZ0KCkhO1xuXG5cdFx0dGhpcy5fY3VycmVudENvbXBsZXRlID0gbnVsbDtcblx0XHRjb21wbGV0ZShtc2cpO1xuXHR9XG5cblx0cHVibGljIHdhaXRGb3JPbmUoKTogUHJvbWlzZTxWU0J1ZmZlcj4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTxWU0J1ZmZlcj4oKGNvbXBsZXRlKSA9PiB7XG5cdFx0XHR0aGlzLl9jdXJyZW50Q29tcGxldGUgPSBjb21wbGV0ZTtcblx0XHRcdHRoaXMuX3RyaWdnZXIoKTtcblx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBFdGhlclN0cmVhbSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2V0aGVyOiBFdGhlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9uYW1lOiAnYScgfCAnYidcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHdyaXRlKGRhdGE6IEJ1ZmZlciwgY2I/OiBGdW5jdGlvbik6IGJvb2xlYW4ge1xuXHRcdGlmICghQnVmZmVyLmlzQnVmZmVyKGRhdGEpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZGF0YWApO1xuXHRcdH1cblx0XHR0aGlzLl9ldGhlci53cml0ZSh0aGlzLl9uYW1lLCBkYXRhKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGRlc3Ryb3koKTogdm9pZCB7XG5cdH1cbn1cblxuY2xhc3MgRXRoZXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2E6IEV0aGVyU3RyZWFtO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9iOiBFdGhlclN0cmVhbTtcblxuXHRwcml2YXRlIF9hYjogQnVmZmVyW107XG5cdHByaXZhdGUgX2JhOiBCdWZmZXJbXTtcblxuXHRwdWJsaWMgZ2V0IGEoKTogU29ja2V0IHtcblx0XHRyZXR1cm4gPGFueT50aGlzLl9hO1xuXHR9XG5cblx0cHVibGljIGdldCBiKCk6IFNvY2tldCB7XG5cdFx0cmV0dXJuIDxhbnk+dGhpcy5fYjtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3dpcmVMYXRlbmN5ID0gMFxuXHQpIHtcblx0XHR0aGlzLl9hID0gbmV3IEV0aGVyU3RyZWFtKHRoaXMsICdhJyk7XG5cdFx0dGhpcy5fYiA9IG5ldyBFdGhlclN0cmVhbSh0aGlzLCAnYicpO1xuXHRcdHRoaXMuX2FiID0gW107XG5cdFx0dGhpcy5fYmEgPSBbXTtcblx0fVxuXG5cdHB1YmxpYyB3cml0ZShmcm9tOiAnYScgfCAnYicsIGRhdGE6IEJ1ZmZlcik6IHZvaWQge1xuXHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0aWYgKGZyb20gPT09ICdhJykge1xuXHRcdFx0XHR0aGlzLl9hYi5wdXNoKGRhdGEpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fYmEucHVzaChkYXRhKTtcblx0XHRcdH1cblxuXHRcdFx0c2V0VGltZW91dCgoKSA9PiB0aGlzLl9kZWxpdmVyKCksIDApO1xuXHRcdH0sIHRoaXMuX3dpcmVMYXRlbmN5KTtcblx0fVxuXG5cdHByaXZhdGUgX2RlbGl2ZXIoKTogdm9pZCB7XG5cblx0XHRpZiAodGhpcy5fYWIubGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IEJ1ZmZlci5jb25jYXQodGhpcy5fYWIpO1xuXHRcdFx0dGhpcy5fYWIubGVuZ3RoID0gMDtcblx0XHRcdHRoaXMuX2IuZW1pdCgnZGF0YScsIGRhdGEpO1xuXHRcdFx0c2V0VGltZW91dCgoKSA9PiB0aGlzLl9kZWxpdmVyKCksIDApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9iYS5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBkYXRhID0gQnVmZmVyLmNvbmNhdCh0aGlzLl9iYSk7XG5cdFx0XHR0aGlzLl9iYS5sZW5ndGggPSAwO1xuXHRcdFx0dGhpcy5fYS5lbWl0KCdkYXRhJywgZGF0YSk7XG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHRoaXMuX2RlbGl2ZXIoKSwgMCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdH1cbn1cblxuc3VpdGUoJ0lQQywgU29ja2V0IFByb3RvY29sJywgKCkgPT4ge1xuXG5cdGNvbnN0IGRzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IGV0aGVyOiBFdGhlcjtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZXRoZXIgPSBuZXcgRXRoZXIoKTtcblx0fSk7XG5cblx0dGVzdCgncmVhZC93cml0ZScsIGFzeW5jICgpID0+IHtcblxuXHRcdGNvbnN0IGEgPSBuZXcgUHJvdG9jb2wobmV3IE5vZGVTb2NrZXQoZXRoZXIuYSkpO1xuXHRcdGNvbnN0IGIgPSBuZXcgUHJvdG9jb2wobmV3IE5vZGVTb2NrZXQoZXRoZXIuYikpO1xuXHRcdGNvbnN0IGJNZXNzYWdlcyA9IG5ldyBNZXNzYWdlU3RyZWFtKGIpO1xuXG5cdFx0YS5zZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoJ2Zvb2JhcmZhcmJvbycpKTtcblx0XHRjb25zdCBtc2cxID0gYXdhaXQgYk1lc3NhZ2VzLndhaXRGb3JPbmUoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobXNnMS50b1N0cmluZygpLCAnZm9vYmFyZmFyYm9vJyk7XG5cblx0XHRjb25zdCBidWZmZXIgPSBWU0J1ZmZlci5hbGxvYygxKTtcblx0XHRidWZmZXIud3JpdGVVSW50OCgxMjMsIDApO1xuXHRcdGEuc2VuZChidWZmZXIpO1xuXHRcdGNvbnN0IG1zZzIgPSBhd2FpdCBiTWVzc2FnZXMud2FpdEZvck9uZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtc2cyLnJlYWRVSW50OCgwKSwgMTIzKTtcblxuXHRcdGJNZXNzYWdlcy5kaXNwb3NlKCk7XG5cdFx0YS5kaXNwb3NlKCk7XG5cdFx0Yi5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cblx0dGVzdCgncmVhZC93cml0ZSwgb2JqZWN0IGRhdGEnLCBhc3luYyAoKSA9PiB7XG5cblx0XHRjb25zdCBhID0gbmV3IFByb3RvY29sKG5ldyBOb2RlU29ja2V0KGV0aGVyLmEpKTtcblx0XHRjb25zdCBiID0gbmV3IFByb3RvY29sKG5ldyBOb2RlU29ja2V0KGV0aGVyLmIpKTtcblx0XHRjb25zdCBiTWVzc2FnZXMgPSBuZXcgTWVzc2FnZVN0cmVhbShiKTtcblxuXHRcdGNvbnN0IGRhdGEgPSB7XG5cdFx0XHRwaTogTWF0aC5QSSxcblx0XHRcdGZvbzogJ2JhcicsXG5cdFx0XHRtb3JlOiB0cnVlLFxuXHRcdFx0ZGF0YTogJ0hlbGxvIFdvcmxkJy5zcGxpdCgnJylcblx0XHR9O1xuXG5cdFx0YS5zZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoZGF0YSkpKTtcblx0XHRjb25zdCBtc2cgPSBhd2FpdCBiTWVzc2FnZXMud2FpdEZvck9uZSgpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoSlNPTi5wYXJzZShtc2cudG9TdHJpbmcoKSksIGRhdGEpO1xuXG5cdFx0Yk1lc3NhZ2VzLmRpc3Bvc2UoKTtcblx0XHRhLmRpc3Bvc2UoKTtcblx0XHRiLmRpc3Bvc2UoKTtcblx0fSk7XG5cblxuXG5cdHRlc3QoJ2lzc3VlICMyMTE0NjI6IGRlc3Ryb3kgc29ja2V0IGFmdGVyIGVuZCB0aW1lb3V0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNvY2tldCA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcblx0XHRPYmplY3QuYXNzaWduKHNvY2tldCwgeyBkZXN0cm95OiAoKSA9PiBzb2NrZXQuZW1pdCgnY2xvc2UnKSB9KTtcblx0XHRjb25zdCBwcm90b2NvbCA9IGRzLmFkZChuZXcgUHJvdG9jb2wobmV3IE5vZGVTb2NrZXQoc29ja2V0IGFzIFNvY2tldCkpKTtcblxuXHRcdGNvbnN0IGRpc3Bvc2VkID0gc2lub24uc3R1YigpO1xuXHRcdGNvbnN0IHRpbWVycyA9IHNpbm9uLnVzZUZha2VUaW1lcnMoKTtcblxuXHRcdGRzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gdGltZXJzLnJlc3RvcmUoKSkpO1xuXHRcdGRzLmFkZChwcm90b2NvbC5vbkRpZERpc3Bvc2UoZGlzcG9zZWQpKTtcblxuXHRcdHNvY2tldC5lbWl0KCdlbmQnKTtcblx0XHRhc3NlcnQub2soIWRpc3Bvc2VkLmNhbGxlZCk7XG5cdFx0dGltZXJzLnRpY2soMjlfOTk5KTtcblx0XHRhc3NlcnQub2soIWRpc3Bvc2VkLmNhbGxlZCk7XG5cdFx0dGltZXJzLnRpY2soMSk7XG5cdFx0YXNzZXJ0Lm9rKGRpc3Bvc2VkLmNhbGxlZCk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdQZXJzaXN0ZW50UHJvdG9jb2wgcmVjb25uZWN0aW9uJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2Fja3MgZ2V0IHBpZ2d5YmFja2VkIHdpdGggbWVzc2FnZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZXRoZXIgPSBuZXcgRXRoZXIoKTtcblx0XHRjb25zdCBhID0gbmV3IFBlcnNpc3RlbnRQcm90b2NvbCh7IHNvY2tldDogbmV3IE5vZGVTb2NrZXQoZXRoZXIuYSkgfSk7XG5cdFx0Y29uc3QgYU1lc3NhZ2VzID0gbmV3IE1lc3NhZ2VTdHJlYW0oYSk7XG5cdFx0Y29uc3QgYiA9IG5ldyBQZXJzaXN0ZW50UHJvdG9jb2woeyBzb2NrZXQ6IG5ldyBOb2RlU29ja2V0KGV0aGVyLmIpIH0pO1xuXHRcdGNvbnN0IGJNZXNzYWdlcyA9IG5ldyBNZXNzYWdlU3RyZWFtKGIpO1xuXG5cdFx0YS5zZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoJ2ExJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLnVuYWNrbm93bGVkZ2VkQ291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLnVuYWNrbm93bGVkZ2VkQ291bnQsIDApO1xuXG5cdFx0YS5zZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoJ2EyJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLnVuYWNrbm93bGVkZ2VkQ291bnQsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLnVuYWNrbm93bGVkZ2VkQ291bnQsIDApO1xuXG5cdFx0YS5zZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoJ2EzJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLnVuYWNrbm93bGVkZ2VkQ291bnQsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLnVuYWNrbm93bGVkZ2VkQ291bnQsIDApO1xuXG5cdFx0Y29uc3QgYTEgPSBhd2FpdCBiTWVzc2FnZXMud2FpdEZvck9uZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhMS50b1N0cmluZygpLCAnYTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYS51bmFja25vd2xlZGdlZENvdW50LCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYi51bmFja25vd2xlZGdlZENvdW50LCAwKTtcblxuXHRcdGNvbnN0IGEyID0gYXdhaXQgYk1lc3NhZ2VzLndhaXRGb3JPbmUoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYTIudG9TdHJpbmcoKSwgJ2EyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGEudW5hY2tub3dsZWRnZWRDb3VudCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGIudW5hY2tub3dsZWRnZWRDb3VudCwgMCk7XG5cblx0XHRjb25zdCBhMyA9IGF3YWl0IGJNZXNzYWdlcy53YWl0Rm9yT25lKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGEzLnRvU3RyaW5nKCksICdhMycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLnVuYWNrbm93bGVkZ2VkQ291bnQsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLnVuYWNrbm93bGVkZ2VkQ291bnQsIDApO1xuXG5cdFx0Yi5zZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoJ2IxJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLnVuYWNrbm93bGVkZ2VkQ291bnQsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLnVuYWNrbm93bGVkZ2VkQ291bnQsIDEpO1xuXG5cdFx0Y29uc3QgYjEgPSBhd2FpdCBhTWVzc2FnZXMud2FpdEZvck9uZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChiMS50b1N0cmluZygpLCAnYjEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYS51bmFja25vd2xlZGdlZENvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYi51bmFja25vd2xlZGdlZENvdW50LCAxKTtcblxuXHRcdGEuc2VuZChWU0J1ZmZlci5mcm9tU3RyaW5nKCdhNCcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYS51bmFja25vd2xlZGdlZENvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYi51bmFja25vd2xlZGdlZENvdW50LCAxKTtcblxuXHRcdGNvbnN0IGIyID0gYXdhaXQgYk1lc3NhZ2VzLndhaXRGb3JPbmUoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYjIudG9TdHJpbmcoKSwgJ2E0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGEudW5hY2tub3dsZWRnZWRDb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGIudW5hY2tub3dsZWRnZWRDb3VudCwgMCk7XG5cblx0XHRhTWVzc2FnZXMuZGlzcG9zZSgpO1xuXHRcdGJNZXNzYWdlcy5kaXNwb3NlKCk7XG5cdFx0YS5kaXNwb3NlKCk7XG5cdFx0Yi5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FjayBnZXRzIHNlbnQgYWZ0ZXIgYSB3aGlsZScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoeyB1c2VGYWtlVGltZXJzOiB0cnVlLCBtYXhUYXNrQ291bnQ6IDEwMCB9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBsb2FkRXN0aW1hdG9yOiBJTG9hZEVzdGltYXRvciA9IHtcblx0XHRcdFx0aGFzSGlnaExvYWQ6ICgpID0+IGZhbHNlXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgZXRoZXIgPSBuZXcgRXRoZXIoKTtcblx0XHRcdGNvbnN0IGFTb2NrZXQgPSBuZXcgTm9kZVNvY2tldChldGhlci5hKTtcblx0XHRcdGNvbnN0IGEgPSBuZXcgUGVyc2lzdGVudFByb3RvY29sKHsgc29ja2V0OiBhU29ja2V0LCBsb2FkRXN0aW1hdG9yIH0pO1xuXHRcdFx0Y29uc3QgYU1lc3NhZ2VzID0gbmV3IE1lc3NhZ2VTdHJlYW0oYSk7XG5cdFx0XHRjb25zdCBiU29ja2V0ID0gbmV3IE5vZGVTb2NrZXQoZXRoZXIuYik7XG5cdFx0XHRjb25zdCBiID0gbmV3IFBlcnNpc3RlbnRQcm90b2NvbCh7IHNvY2tldDogYlNvY2tldCwgbG9hZEVzdGltYXRvciB9KTtcblx0XHRcdGNvbnN0IGJNZXNzYWdlcyA9IG5ldyBNZXNzYWdlU3RyZWFtKGIpO1xuXG5cdFx0XHQvLyBzZW5kIG9uZSBtZXNzYWdlIEEgLT4gQlxuXHRcdFx0YS5zZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoJ2ExJykpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGEudW5hY2tub3dsZWRnZWRDb3VudCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYi51bmFja25vd2xlZGdlZENvdW50LCAwKTtcblx0XHRcdGNvbnN0IGExID0gYXdhaXQgYk1lc3NhZ2VzLndhaXRGb3JPbmUoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhMS50b1N0cmluZygpLCAnYTEnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLnVuYWNrbm93bGVkZ2VkQ291bnQsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGIudW5hY2tub3dsZWRnZWRDb3VudCwgMCk7XG5cblx0XHRcdC8vIHdhaXQgZm9yIGFjayB0byBhcnJpdmUgQiAtPiBBXG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIgKiBQcm90b2NvbENvbnN0YW50cy5BY2tub3dsZWRnZVRpbWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGEudW5hY2tub3dsZWRnZWRDb3VudCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYi51bmFja25vd2xlZGdlZENvdW50LCAwKTtcblxuXHRcdFx0YU1lc3NhZ2VzLmRpc3Bvc2UoKTtcblx0XHRcdGJNZXNzYWdlcy5kaXNwb3NlKCk7XG5cdFx0XHRhLmRpc3Bvc2UoKTtcblx0XHRcdGIuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXNzYWdlcyB0aGF0IGFyZSBuZXZlciB3cml0dGVuIHRvIGEgc29ja2V0IHNob3VsZCBub3QgY2F1c2UgYW4gYWNrIHRpbWVvdXQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKFxuXHRcdFx0e1xuXHRcdFx0XHR1c2VGYWtlVGltZXJzOiB0cnVlLFxuXHRcdFx0XHR1c2VTZXRJbW1lZGlhdGU6IHRydWUsXG5cdFx0XHRcdG1heFRhc2tDb3VudDogMTAwMFxuXHRcdFx0fSxcblx0XHRcdGFzeW5jICgpID0+IHtcblx0XHRcdFx0Ly8gRGF0ZS5ub3coKSBpbiBmYWtlIHRpbWVycyBzdGFydHMgYXQgMCwgd2hpY2ggaXMgdmVyeSBpbmNvbnZlbmllbnRcblx0XHRcdFx0Ly8gc2luY2Ugd2Ugd2FudCB0byB0ZXN0IGV4YWN0bHkgdGhhdCBhIGNlcnRhaW4gZmllbGQgaXMgbm90IGluaXRpYWxpemVkIHdpdGggRGF0ZS5ub3coKVxuXHRcdFx0XHQvLyBBcyBhIHdvcmthcm91bmQgd2Ugd2FpdCBzdWNoIHRoYXQgRGF0ZS5ub3coKSBzdGFydHMgcHJvZHVjaW5nIG1vcmUgcmVhbGlzdGljIHZhbHVlc1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDYwICogNjAgKiAxMDAwKTtcblxuXHRcdFx0XHRjb25zdCBsb2FkRXN0aW1hdG9yOiBJTG9hZEVzdGltYXRvciA9IHtcblx0XHRcdFx0XHRoYXNIaWdoTG9hZDogKCkgPT4gZmFsc2Vcblx0XHRcdFx0fTtcblx0XHRcdFx0Y29uc3QgZXRoZXIgPSBuZXcgRXRoZXIoKTtcblx0XHRcdFx0Y29uc3QgYVNvY2tldCA9IG5ldyBOb2RlU29ja2V0KGV0aGVyLmEpO1xuXHRcdFx0XHRjb25zdCBhID0gbmV3IFBlcnNpc3RlbnRQcm90b2NvbCh7IHNvY2tldDogYVNvY2tldCwgbG9hZEVzdGltYXRvciwgc2VuZEtlZXBBbGl2ZTogZmFsc2UgfSk7XG5cdFx0XHRcdGNvbnN0IGFNZXNzYWdlcyA9IG5ldyBNZXNzYWdlU3RyZWFtKGEpO1xuXHRcdFx0XHRjb25zdCBiU29ja2V0ID0gbmV3IE5vZGVTb2NrZXQoZXRoZXIuYik7XG5cdFx0XHRcdGNvbnN0IGIgPSBuZXcgUGVyc2lzdGVudFByb3RvY29sKHsgc29ja2V0OiBiU29ja2V0LCBsb2FkRXN0aW1hdG9yLCBzZW5kS2VlcEFsaXZlOiBmYWxzZSB9KTtcblx0XHRcdFx0Y29uc3QgYk1lc3NhZ2VzID0gbmV3IE1lc3NhZ2VTdHJlYW0oYik7XG5cblx0XHRcdFx0Ly8gc2VuZCBtZXNzYWdlIGExIGJlZm9yZSByZWNvbm5lY3Rpb24gdG8gZ2V0IF9yZWN2QWNrQ2hlY2soKSBzY2hlZHVsZWRcblx0XHRcdFx0YS5zZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoJ2ExJykpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYS51bmFja25vd2xlZGdlZENvdW50LCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGIudW5hY2tub3dsZWRnZWRDb3VudCwgMCk7XG5cblx0XHRcdFx0Ly8gcmVhZCBtZXNzYWdlIGExIGF0IEJcblx0XHRcdFx0Y29uc3QgYTEgPSBhd2FpdCBiTWVzc2FnZXMud2FpdEZvck9uZSgpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYTEudG9TdHJpbmcoKSwgJ2ExJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLnVuYWNrbm93bGVkZ2VkQ291bnQsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYi51bmFja25vd2xlZGdlZENvdW50LCAwKTtcblxuXHRcdFx0XHQvLyBzZW5kIG1lc3NhZ2UgYjEgdG8gc2VuZCB0aGUgYWNrIGZvciBhMVxuXHRcdFx0XHRiLnNlbmQoVlNCdWZmZXIuZnJvbVN0cmluZygnYjEnKSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLnVuYWNrbm93bGVkZ2VkQ291bnQsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYi51bmFja25vd2xlZGdlZENvdW50LCAxKTtcblxuXHRcdFx0XHQvLyByZWFkIG1lc3NhZ2UgYjEgYXQgQSB0byByZWNlaXZlIHRoZSBhY2sgZm9yIGExXG5cdFx0XHRcdGNvbnN0IGIxID0gYXdhaXQgYU1lc3NhZ2VzLndhaXRGb3JPbmUoKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGIxLnRvU3RyaW5nKCksICdiMScpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYS51bmFja25vd2xlZGdlZENvdW50LCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGIudW5hY2tub3dsZWRnZWRDb3VudCwgMSk7XG5cblx0XHRcdFx0Ly8gYmVnaW4gcmVjb25uZWN0aW9uXG5cdFx0XHRcdGFTb2NrZXQuZGlzcG9zZSgpO1xuXHRcdFx0XHRjb25zdCBhU29ja2V0MiA9IG5ldyBOb2RlU29ja2V0KGV0aGVyLmEpO1xuXHRcdFx0XHRhLmJlZ2luQWNjZXB0UmVjb25uZWN0aW9uKGFTb2NrZXQyLCBudWxsKTtcblxuXHRcdFx0XHRsZXQgdGltZW91dExpc3RlbmVyQ2FsbGVkID0gZmFsc2U7XG5cdFx0XHRcdGNvbnN0IHNvY2tldFRpbWVvdXRMaXN0ZW5lciA9IGEub25Tb2NrZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHR0aW1lb3V0TGlzdGVuZXJDYWxsZWQgPSB0cnVlO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHQvLyBzZW5kIG1lc3NhZ2UgMiBkdXJpbmcgcmVjb25uZWN0aW9uXG5cdFx0XHRcdGEuc2VuZChWU0J1ZmZlci5mcm9tU3RyaW5nKCdhMicpKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGEudW5hY2tub3dsZWRnZWRDb3VudCwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLnVuYWNrbm93bGVkZ2VkQ291bnQsIDEpO1xuXG5cdFx0XHRcdC8vIHdhaXQgZm9yIHNjaGVkdWxlZCBfcmVjdkFja0NoZWNrKCkgdG8gZXhlY3V0ZVxuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDIgKiBQcm90b2NvbENvbnN0YW50cy5UaW1lb3V0VGltZSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGEudW5hY2tub3dsZWRnZWRDb3VudCwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLnVuYWNrbm93bGVkZ2VkQ291bnQsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGltZW91dExpc3RlbmVyQ2FsbGVkLCBmYWxzZSk7XG5cblx0XHRcdFx0YS5lbmRBY2NlcHRSZWNvbm5lY3Rpb24oKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRpbWVvdXRMaXN0ZW5lckNhbGxlZCwgZmFsc2UpO1xuXG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMiAqIFByb3RvY29sQ29uc3RhbnRzLlRpbWVvdXRUaW1lKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGEudW5hY2tub3dsZWRnZWRDb3VudCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLnVuYWNrbm93bGVkZ2VkQ291bnQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGltZW91dExpc3RlbmVyQ2FsbGVkLCBmYWxzZSk7XG5cblx0XHRcdFx0c29ja2V0VGltZW91dExpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0YU1lc3NhZ2VzLmRpc3Bvc2UoKTtcblx0XHRcdFx0Yk1lc3NhZ2VzLmRpc3Bvc2UoKTtcblx0XHRcdFx0YS5kaXNwb3NlKCk7XG5cdFx0XHRcdGIuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Fja3MgYXJlIGFsd2F5cyBzZW50IGFmdGVyIGEgcmVjb25uZWN0aW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVycyhcblx0XHRcdHtcblx0XHRcdFx0dXNlRmFrZVRpbWVyczogdHJ1ZSxcblx0XHRcdFx0dXNlU2V0SW1tZWRpYXRlOiB0cnVlLFxuXHRcdFx0XHRtYXhUYXNrQ291bnQ6IDEwMDBcblx0XHRcdH0sXG5cdFx0XHRhc3luYyAoKSA9PiB7XG5cblx0XHRcdFx0Y29uc3QgbG9hZEVzdGltYXRvcjogSUxvYWRFc3RpbWF0b3IgPSB7XG5cdFx0XHRcdFx0aGFzSGlnaExvYWQ6ICgpID0+IGZhbHNlXG5cdFx0XHRcdH07XG5cdFx0XHRcdGNvbnN0IHdpcmVMYXRlbmN5ID0gMTAwMDtcblx0XHRcdFx0Y29uc3QgZXRoZXIgPSBuZXcgRXRoZXIod2lyZUxhdGVuY3kpO1xuXHRcdFx0XHRjb25zdCBhU29ja2V0ID0gbmV3IE5vZGVTb2NrZXQoZXRoZXIuYSk7XG5cdFx0XHRcdGNvbnN0IGEgPSBuZXcgUGVyc2lzdGVudFByb3RvY29sKHsgc29ja2V0OiBhU29ja2V0LCBsb2FkRXN0aW1hdG9yIH0pO1xuXHRcdFx0XHRjb25zdCBhTWVzc2FnZXMgPSBuZXcgTWVzc2FnZVN0cmVhbShhKTtcblx0XHRcdFx0Y29uc3QgYlNvY2tldCA9IG5ldyBOb2RlU29ja2V0KGV0aGVyLmIpO1xuXHRcdFx0XHRjb25zdCBiID0gbmV3IFBlcnNpc3RlbnRQcm90b2NvbCh7IHNvY2tldDogYlNvY2tldCwgbG9hZEVzdGltYXRvciB9KTtcblx0XHRcdFx0Y29uc3QgYk1lc3NhZ2VzID0gbmV3IE1lc3NhZ2VTdHJlYW0oYik7XG5cblx0XHRcdFx0Ly8gc2VuZCBtZXNzYWdlIGExIHRvIGhhdmUgc29tZXRoaW5nIHVuYWNrbm93bGVkZ2VkXG5cdFx0XHRcdGEuc2VuZChWU0J1ZmZlci5mcm9tU3RyaW5nKCdhMScpKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGEudW5hY2tub3dsZWRnZWRDb3VudCwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLnVuYWNrbm93bGVkZ2VkQ291bnQsIDApO1xuXG5cdFx0XHRcdC8vIHJlYWQgbWVzc2FnZSBhMSBhdCBCXG5cdFx0XHRcdGNvbnN0IGExID0gYXdhaXQgYk1lc3NhZ2VzLndhaXRGb3JPbmUoKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGExLnRvU3RyaW5nKCksICdhMScpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYS51bmFja25vd2xlZGdlZENvdW50LCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGIudW5hY2tub3dsZWRnZWRDb3VudCwgMCk7XG5cblx0XHRcdFx0Ly8gd2FpdCBmb3IgQiB0byBzZW5kIGFuIEFDSyBtZXNzYWdlLFxuXHRcdFx0XHQvLyBidXQgcmVzdW1lIGJlZm9yZSBBIHJlY2VpdmVzIGl0XG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoUHJvdG9jb2xDb25zdGFudHMuQWNrbm93bGVkZ2VUaW1lICsgd2lyZUxhdGVuY3kgLyAyKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGEudW5hY2tub3dsZWRnZWRDb3VudCwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLnVuYWNrbm93bGVkZ2VkQ291bnQsIDApO1xuXG5cdFx0XHRcdC8vIHNpbXVsYXRlIGNvbXBsZXRlIHJlY29ubmVjdGlvblxuXHRcdFx0XHRhU29ja2V0LmRpc3Bvc2UoKTtcblx0XHRcdFx0YlNvY2tldC5kaXNwb3NlKCk7XG5cdFx0XHRcdGNvbnN0IGV0aGVyMiA9IG5ldyBFdGhlcih3aXJlTGF0ZW5jeSk7XG5cdFx0XHRcdGNvbnN0IGFTb2NrZXQyID0gbmV3IE5vZGVTb2NrZXQoZXRoZXIyLmEpO1xuXHRcdFx0XHRjb25zdCBiU29ja2V0MiA9IG5ldyBOb2RlU29ja2V0KGV0aGVyMi5iKTtcblx0XHRcdFx0Yi5iZWdpbkFjY2VwdFJlY29ubmVjdGlvbihiU29ja2V0MiwgbnVsbCk7XG5cdFx0XHRcdGIuZW5kQWNjZXB0UmVjb25uZWN0aW9uKCk7XG5cdFx0XHRcdGEuYmVnaW5BY2NlcHRSZWNvbm5lY3Rpb24oYVNvY2tldDIsIG51bGwpO1xuXHRcdFx0XHRhLmVuZEFjY2VwdFJlY29ubmVjdGlvbigpO1xuXG5cdFx0XHRcdC8vIHdhaXQgZm9yIHF1aXRlIHNvbWUgdGltZVxuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDIgKiBQcm90b2NvbENvbnN0YW50cy5BY2tub3dsZWRnZVRpbWUgKyB3aXJlTGF0ZW5jeSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLnVuYWNrbm93bGVkZ2VkQ291bnQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYi51bmFja25vd2xlZGdlZENvdW50LCAwKTtcblxuXHRcdFx0XHRhTWVzc2FnZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHRiTWVzc2FnZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHRhLmRpc3Bvc2UoKTtcblx0XHRcdFx0Yi5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnb25Tb2NrZXRUaW1lb3V0IGlzIGVtaXR0ZWQgYXQgbW9zdCBvbmNlIGV2ZXJ5IDIwcycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoXG5cdFx0XHR7XG5cdFx0XHRcdHVzZUZha2VUaW1lcnM6IHRydWUsXG5cdFx0XHRcdHVzZVNldEltbWVkaWF0ZTogdHJ1ZSxcblx0XHRcdFx0bWF4VGFza0NvdW50OiAxMDAwXG5cdFx0XHR9LFxuXHRcdFx0YXN5bmMgKCkgPT4ge1xuXG5cdFx0XHRcdGNvbnN0IGxvYWRFc3RpbWF0b3I6IElMb2FkRXN0aW1hdG9yID0ge1xuXHRcdFx0XHRcdGhhc0hpZ2hMb2FkOiAoKSA9PiBmYWxzZVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRjb25zdCBldGhlciA9IG5ldyBFdGhlcigpO1xuXHRcdFx0XHRjb25zdCBhU29ja2V0ID0gbmV3IE5vZGVTb2NrZXQoZXRoZXIuYSk7XG5cdFx0XHRcdGNvbnN0IGEgPSBuZXcgUGVyc2lzdGVudFByb3RvY29sKHsgc29ja2V0OiBhU29ja2V0LCBsb2FkRXN0aW1hdG9yIH0pO1xuXHRcdFx0XHRjb25zdCBhTWVzc2FnZXMgPSBuZXcgTWVzc2FnZVN0cmVhbShhKTtcblx0XHRcdFx0Y29uc3QgYlNvY2tldCA9IG5ldyBOb2RlU29ja2V0KGV0aGVyLmIpO1xuXHRcdFx0XHRjb25zdCBiID0gbmV3IFBlcnNpc3RlbnRQcm90b2NvbCh7IHNvY2tldDogYlNvY2tldCwgbG9hZEVzdGltYXRvciB9KTtcblx0XHRcdFx0Y29uc3QgYk1lc3NhZ2VzID0gbmV3IE1lc3NhZ2VTdHJlYW0oYik7XG5cblx0XHRcdFx0Ly8gbmV2ZXIgcmVjZWl2ZSBhY2tzXG5cdFx0XHRcdGIucGF1c2VTb2NrZXRXcml0aW5nKCk7XG5cblx0XHRcdFx0Ly8gc2VuZCBtZXNzYWdlIGExIHRvIGhhdmUgc29tZXRoaW5nIHVuYWNrbm93bGVkZ2VkXG5cdFx0XHRcdGEuc2VuZChWU0J1ZmZlci5mcm9tU3RyaW5nKCdhMScpKTtcblxuXHRcdFx0XHQvLyB3YWl0IGZvciB0aGUgZmlyc3QgdGltZW91dCB0byBmaXJlXG5cdFx0XHRcdGF3YWl0IEV2ZW50LnRvUHJvbWlzZShhLm9uU29ja2V0VGltZW91dCk7XG5cblx0XHRcdFx0bGV0IHRpbWVvdXRGaXJlZEFnYWluID0gZmFsc2U7XG5cdFx0XHRcdGNvbnN0IHRpbWVvdXRMaXN0ZW5lciA9IGEub25Tb2NrZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHR0aW1lb3V0RmlyZWRBZ2FpbiA9IHRydWU7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdC8vIHNlbmQgbW9yZSBtZXNzYWdlc1xuXHRcdFx0XHRhLnNlbmQoVlNCdWZmZXIuZnJvbVN0cmluZygnYTInKSk7XG5cdFx0XHRcdGEuc2VuZChWU0J1ZmZlci5mcm9tU3RyaW5nKCdhMycpKTtcblxuXHRcdFx0XHQvLyB3YWl0IGZvciAxMHNcblx0XHRcdFx0YXdhaXQgdGltZW91dChQcm90b2NvbENvbnN0YW50cy5UaW1lb3V0VGltZSAvIDIpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aW1lb3V0RmlyZWRBZ2FpbiwgZmFsc2UpO1xuXG5cdFx0XHRcdHRpbWVvdXRMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHRcdGFNZXNzYWdlcy5kaXNwb3NlKCk7XG5cdFx0XHRcdGJNZXNzYWdlcy5kaXNwb3NlKCk7XG5cdFx0XHRcdGEuZGlzcG9zZSgpO1xuXHRcdFx0XHRiLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0aW5nIGNhbiBiZSBwYXVzZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHsgdXNlRmFrZVRpbWVyczogdHJ1ZSwgbWF4VGFza0NvdW50OiAxMDAgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbG9hZEVzdGltYXRvcjogSUxvYWRFc3RpbWF0b3IgPSB7XG5cdFx0XHRcdGhhc0hpZ2hMb2FkOiAoKSA9PiBmYWxzZVxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGV0aGVyID0gbmV3IEV0aGVyKCk7XG5cdFx0XHRjb25zdCBhU29ja2V0ID0gbmV3IE5vZGVTb2NrZXQoZXRoZXIuYSk7XG5cdFx0XHRjb25zdCBhID0gbmV3IFBlcnNpc3RlbnRQcm90b2NvbCh7IHNvY2tldDogYVNvY2tldCwgbG9hZEVzdGltYXRvciB9KTtcblx0XHRcdGNvbnN0IGFNZXNzYWdlcyA9IG5ldyBNZXNzYWdlU3RyZWFtKGEpO1xuXHRcdFx0Y29uc3QgYlNvY2tldCA9IG5ldyBOb2RlU29ja2V0KGV0aGVyLmIpO1xuXHRcdFx0Y29uc3QgYiA9IG5ldyBQZXJzaXN0ZW50UHJvdG9jb2woeyBzb2NrZXQ6IGJTb2NrZXQsIGxvYWRFc3RpbWF0b3IgfSk7XG5cdFx0XHRjb25zdCBiTWVzc2FnZXMgPSBuZXcgTWVzc2FnZVN0cmVhbShiKTtcblxuXHRcdFx0Ly8gc2VuZCBvbmUgbWVzc2FnZSBBIC0+IEJcblx0XHRcdGEuc2VuZChWU0J1ZmZlci5mcm9tU3RyaW5nKCdhMScpKTtcblx0XHRcdGNvbnN0IGExID0gYXdhaXQgYk1lc3NhZ2VzLndhaXRGb3JPbmUoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhMS50b1N0cmluZygpLCAnYTEnKTtcblxuXHRcdFx0Ly8gYXNrIEEgdG8gcGF1c2Ugd3JpdGluZ1xuXHRcdFx0Yi5zZW5kUGF1c2UoKTtcblxuXHRcdFx0Ly8gc2VuZCBhIG1lc3NhZ2UgQiAtPiBBXG5cdFx0XHRiLnNlbmQoVlNCdWZmZXIuZnJvbVN0cmluZygnYjEnKSk7XG5cdFx0XHRjb25zdCBiMSA9IGF3YWl0IGFNZXNzYWdlcy53YWl0Rm9yT25lKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYjEudG9TdHJpbmcoKSwgJ2IxJyk7XG5cblx0XHRcdC8vIHNlbmQgYSBtZXNzYWdlIEEgLT4gQiAodGhpcyBzaG91bGQgYmUgYmxvY2tlZCBhdCBBKVxuXHRcdFx0YS5zZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoJ2EyJykpO1xuXG5cdFx0XHQvLyB3YWl0IGEgbG9uZyB0aW1lIGFuZCBjaGVjayB0aGF0IG5vdCBldmVuIGFja3MgYXJlIHdyaXR0ZW5cblx0XHRcdGF3YWl0IHRpbWVvdXQoMiAqIFByb3RvY29sQ29uc3RhbnRzLkFja25vd2xlZGdlVGltZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYS51bmFja25vd2xlZGdlZENvdW50LCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLnVuYWNrbm93bGVkZ2VkQ291bnQsIDEpO1xuXG5cdFx0XHQvLyBhc2sgQSB0byByZXN1bWUgd3JpdGluZ1xuXHRcdFx0Yi5zZW5kUmVzdW1lKCk7XG5cblx0XHRcdC8vIGNoZWNrIHRoYXQgQiByZWNlaXZlcyBtZXNzYWdlXG5cdFx0XHRjb25zdCBhMiA9IGF3YWl0IGJNZXNzYWdlcy53YWl0Rm9yT25lKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYTIudG9TdHJpbmcoKSwgJ2EyJyk7XG5cblx0XHRcdC8vIHdhaXQgYSBsb25nIHRpbWUgYW5kIGNoZWNrIHRoYXQgYWNrcyBhcmUgd3JpdHRlblxuXHRcdFx0YXdhaXQgdGltZW91dCgyICogUHJvdG9jb2xDb25zdGFudHMuQWNrbm93bGVkZ2VUaW1lKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLnVuYWNrbm93bGVkZ2VkQ291bnQsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGIudW5hY2tub3dsZWRnZWRDb3VudCwgMCk7XG5cblx0XHRcdGFNZXNzYWdlcy5kaXNwb3NlKCk7XG5cdFx0XHRiTWVzc2FnZXMuZGlzcG9zZSgpO1xuXHRcdFx0YS5kaXNwb3NlKCk7XG5cdFx0XHRiLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG59KTtcblxuZmxha3lTdWl0ZSgnSVBDLCBjcmVhdGUgaGFuZGxlJywgKCkgPT4ge1xuXG5cdHRlc3QoJ2NyZWF0ZVJhbmRvbUlQQ0hhbmRsZScsIGFzeW5jICgpID0+IHtcblx0XHRyZXR1cm4gdGVzdElQQ0hhbmRsZShjcmVhdGVSYW5kb21JUENIYW5kbGUoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZVN0YXRpY0lQQ0hhbmRsZScsIGFzeW5jICgpID0+IHtcblx0XHRyZXR1cm4gdGVzdElQQ0hhbmRsZShjcmVhdGVTdGF0aWNJUENIYW5kbGUodG1wZGlyKCksICd0ZXN0JywgJzEuNjQuMCcpKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gdGVzdElQQ0hhbmRsZShoYW5kbGU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRjb25zdCBwaXBlTmFtZSA9IGNyZWF0ZVJhbmRvbUlQQ0hhbmRsZSgpO1xuXG5cdFx0XHRjb25zdCBzZXJ2ZXIgPSBjcmVhdGVTZXJ2ZXIoKTtcblxuXHRcdFx0c2VydmVyLm9uKCdlcnJvcicsICgpID0+IHtcblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHNlcnZlci5jbG9zZSgoKSA9PiByZWplY3QoKSkpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHNlcnZlci5saXN0ZW4ocGlwZU5hbWUsICgpID0+IHtcblx0XHRcdFx0c2VydmVyLnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIHJlamVjdCk7XG5cblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHtcblx0XHRcdFx0XHRzZXJ2ZXIuY2xvc2UoKCkgPT4gcmVzb2x2ZSgpKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG59KTtcblxuc3VpdGUoJ1dlYlNvY2tldE5vZGVTb2NrZXQnLCAoKSA9PiB7XG5cblx0Y29uc3QgZHMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRmdW5jdGlvbiB0b1VpbnQ4QXJyYXkoZGF0YTogbnVtYmVyW10pOiBVaW50OEFycmF5IHtcblx0XHRjb25zdCByZXN1bHQgPSBuZXcgVWludDhBcnJheShkYXRhLmxlbmd0aCk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRyZXN1bHRbaV0gPSBkYXRhW2ldO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0ZnVuY3Rpb24gZnJvbVVpbnQ4QXJyYXkoZGF0YTogVWludDhBcnJheSk6IG51bWJlcltdIHtcblx0XHRjb25zdCByZXN1bHQgPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcblx0XHRcdHJlc3VsdFtpXSA9IGRhdGFbaV07XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRmdW5jdGlvbiBmcm9tQ2hhckNvZGVBcnJheShkYXRhOiBudW1iZXJbXSk6IHN0cmluZyB7XG5cdFx0bGV0IHJlc3VsdCA9ICcnO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuXHRcdFx0cmVzdWx0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoZGF0YVtpXSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRjbGFzcyBGYWtlTm9kZVNvY2tldCBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb25EYXRhID0gbmV3IEVtaXR0ZXI8VlNCdWZmZXI+KCk7XG5cdFx0cHVibGljIHJlYWRvbmx5IG9uRGF0YSA9IHRoaXMuX29uRGF0YS5ldmVudDtcblxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29uQ2xvc2UgPSBuZXcgRW1pdHRlcjxTb2NrZXRDbG9zZUV2ZW50PigpO1xuXHRcdHB1YmxpYyByZWFkb25seSBvbkNsb3NlID0gdGhpcy5fb25DbG9zZS5ldmVudDtcblxuXHRcdHB1YmxpYyB3cml0dGVuRGF0YTogVlNCdWZmZXJbXSA9IFtdO1xuXG5cdFx0cHVibGljIHRyYWNlU29ja2V0RXZlbnQodHlwZTogU29ja2V0RGlhZ25vc3RpY3NFdmVudFR5cGUsIGRhdGE/OiBWU0J1ZmZlciB8IFVpbnQ4QXJyYXkgfCBBcnJheUJ1ZmZlciB8IEFycmF5QnVmZmVyVmlldyB8IGFueSk6IHZvaWQge1xuXHRcdH1cblxuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoKTtcblx0XHR9XG5cblx0XHRwdWJsaWMgd3JpdGUoZGF0YTogVlNCdWZmZXIpOiB2b2lkIHtcblx0XHRcdHRoaXMud3JpdHRlbkRhdGEucHVzaChkYXRhKTtcblx0XHR9XG5cblx0XHRwdWJsaWMgZmlyZURhdGEoZGF0YTogbnVtYmVyW10pOiB2b2lkIHtcblx0XHRcdHRoaXMuX29uRGF0YS5maXJlKFZTQnVmZmVyLndyYXAodG9VaW50OEFycmF5KGRhdGEpKSk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gdGVzdFJlYWRpbmcoZnJhbWVzOiBudW1iZXJbXVtdLCBwZXJtZXNzYWdlRGVmbGF0ZTogYm9vbGVhbik6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3Qgc29ja2V0ID0gbmV3IEZha2VOb2RlU29ja2V0KCk7XG5cdFx0Y29uc3Qgd2ViU29ja2V0ID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBXZWJTb2NrZXROb2RlU29ja2V0KDxhbnk+c29ja2V0LCBwZXJtZXNzYWdlRGVmbGF0ZSwgbnVsbCwgZmFsc2UpKTtcblxuXHRcdGNvbnN0IGJhcnJpZXIgPSBuZXcgQmFycmllcigpO1xuXHRcdGxldCByZW1haW5pbmdGcmFtZUNvdW50ID0gZnJhbWVzLmxlbmd0aDtcblxuXHRcdGxldCByZWNlaXZlZERhdGE6IHN0cmluZyA9ICcnO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh3ZWJTb2NrZXQub25EYXRhKChidWZmKSA9PiB7XG5cdFx0XHRyZWNlaXZlZERhdGEgKz0gZnJvbUNoYXJDb2RlQXJyYXkoZnJvbVVpbnQ4QXJyYXkoYnVmZi5idWZmZXIpKTtcblx0XHRcdHJlbWFpbmluZ0ZyYW1lQ291bnQtLTtcblx0XHRcdGlmIChyZW1haW5pbmdGcmFtZUNvdW50ID09PSAwKSB7XG5cdFx0XHRcdGJhcnJpZXIub3BlbigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZnJhbWVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRzb2NrZXQuZmlyZURhdGEoZnJhbWVzW2ldKTtcblx0XHR9XG5cblx0XHRhd2FpdCBiYXJyaWVyLndhaXQoKTtcblxuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblxuXHRcdHJldHVybiByZWNlaXZlZERhdGE7XG5cdH1cblxuXHR0ZXN0KCdBIHNpbmdsZS1mcmFtZSB1bm1hc2tlZCB0ZXh0IG1lc3NhZ2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZnJhbWVzID0gW1xuXHRcdFx0WzB4ODEsIDB4MDUsIDB4NDgsIDB4NjUsIDB4NmMsIDB4NmMsIDB4NmZdIC8vIGNvbnRhaW5zIFwiSGVsbG9cIlxuXHRcdF07XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgdGVzdFJlYWRpbmcoZnJhbWVzLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsICdIZWxsbycpO1xuXHR9KTtcblxuXHR0ZXN0KCdBIHNpbmdsZS1mcmFtZSBtYXNrZWQgdGV4dCBtZXNzYWdlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZyYW1lcyA9IFtcblx0XHRcdFsweDgxLCAweDg1LCAweDM3LCAweGZhLCAweDIxLCAweDNkLCAweDdmLCAweDlmLCAweDRkLCAweDUxLCAweDU4XSAvLyBjb250YWlucyBcIkhlbGxvXCJcblx0XHRdO1xuXHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IHRlc3RSZWFkaW5nKGZyYW1lcywgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCAnSGVsbG8nKTtcblx0fSk7XG5cblx0dGVzdCgnQSBmcmFnbWVudGVkIHVubWFza2VkIHRleHQgbWVzc2FnZScsIGFzeW5jICgpID0+IHtcblx0XHQvLyBjb250YWlucyBcIkhlbGxvXCJcblx0XHRjb25zdCBmcmFtZXMgPSBbXG5cdFx0XHRbMHgwMSwgMHgwMywgMHg0OCwgMHg2NSwgMHg2Y10sIC8vIGNvbnRhaW5zIFwiSGVsXCJcblx0XHRcdFsweDgwLCAweDAyLCAweDZjLCAweDZmXSwgLy8gY29udGFpbnMgXCJsb1wiXG5cdFx0XTtcblx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCB0ZXN0UmVhZGluZyhmcmFtZXMsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgJ0hlbGxvJyk7XG5cdH0pO1xuXG5cdHN1aXRlKCdjb21wcmVzc2lvbicsICgpID0+IHtcblx0XHR0ZXN0KCdBIHNpbmdsZS1mcmFtZSBjb21wcmVzc2VkIHRleHQgbWVzc2FnZScsIGFzeW5jICgpID0+IHtcblx0XHRcdC8vIGNvbnRhaW5zIFwiSGVsbG9cIlxuXHRcdFx0Y29uc3QgZnJhbWVzID0gW1xuXHRcdFx0XHRbMHhjMSwgMHgwNywgMHhmMiwgMHg0OCwgMHhjZCwgMHhjOSwgMHhjOSwgMHgwNywgMHgwMF0sIC8vIGNvbnRhaW5zIFwiSGVsbG9cIlxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IHRlc3RSZWFkaW5nKGZyYW1lcywgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgJ0hlbGxvJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdBIGZyYWdtZW50ZWQgY29tcHJlc3NlZCB0ZXh0IG1lc3NhZ2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHQvLyBjb250YWlucyBcIkhlbGxvXCJcblx0XHRcdGNvbnN0IGZyYW1lcyA9IFsgIC8vIGNvbnRhaW5zIFwiSGVsbG9cIlxuXHRcdFx0XHRbMHg0MSwgMHgwMywgMHhmMiwgMHg0OCwgMHhjZF0sXG5cdFx0XHRcdFsweDgwLCAweDA0LCAweGM5LCAweGM5LCAweDA3LCAweDAwXVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IHRlc3RSZWFkaW5nKGZyYW1lcywgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgJ0hlbGxvJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdBIHNpbmdsZS1mcmFtZSBub24tY29tcHJlc3NlZCB0ZXh0IG1lc3NhZ2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBmcmFtZXMgPSBbXG5cdFx0XHRcdFsweDgxLCAweDA1LCAweDQ4LCAweDY1LCAweDZjLCAweDZjLCAweDZmXSAvLyBjb250YWlucyBcIkhlbGxvXCJcblx0XHRcdF07XG5cdFx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCB0ZXN0UmVhZGluZyhmcmFtZXMsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsICdIZWxsbycpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnQSBzaW5nbGUtZnJhbWUgY29tcHJlc3NlZCB0ZXh0IG1lc3NhZ2UgZm9sbG93ZWQgYnkgYSBzaW5nbGUtZnJhbWUgbm9uLWNvbXByZXNzZWQgdGV4dCBtZXNzYWdlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZnJhbWVzID0gW1xuXHRcdFx0XHRbMHhjMSwgMHgwNywgMHhmMiwgMHg0OCwgMHhjZCwgMHhjOSwgMHhjOSwgMHgwNywgMHgwMF0sIC8vIGNvbnRhaW5zIFwiSGVsbG9cIlxuXHRcdFx0XHRbMHg4MSwgMHgwNSwgMHg3NywgMHg2ZiwgMHg3MiwgMHg2YywgMHg2NF0gLy8gY29udGFpbnMgXCJ3b3JsZFwiXG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgdGVzdFJlYWRpbmcoZnJhbWVzLCB0cnVlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCAnSGVsbG93b3JsZCcpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdMYXJnZSBidWZmZXJzIGFyZSBzcGxpdCBhbmQgc2VudCBpbiBjaHVua3MnLCBhc3luYyAoKSA9PiB7XG5cblx0XHRsZXQgcmVjZWl2aW5nU2lkZU9uRGF0YUNhbGxDb3VudCA9IDA7XG5cdFx0bGV0IHJlY2VpdmluZ1NpZGVUb3RhbEJ5dGVzID0gMDtcblx0XHRjb25zdCByZWNlaXZpbmdTaWRlU29ja2V0Q2xvc2VkQmFycmllciA9IG5ldyBCYXJyaWVyKCk7XG5cblx0XHRjb25zdCBzZXJ2ZXIgPSBhd2FpdCBsaXN0ZW5PblJhbmRvbVBvcnQoKHNvY2tldCkgPT4ge1xuXHRcdFx0Ly8gc3RvcCB0aGUgc2VydmVyIHdoZW4gdGhlIGZpcnN0IGNvbm5lY3Rpb24gaXMgcmVjZWl2ZWRcblx0XHRcdHNlcnZlci5jbG9zZSgpO1xuXG5cdFx0XHRjb25zdCB3ZWJTb2NrZXROb2RlU29ja2V0ID0gbmV3IFdlYlNvY2tldE5vZGVTb2NrZXQobmV3IE5vZGVTb2NrZXQoc29ja2V0KSwgdHJ1ZSwgbnVsbCwgZmFsc2UpO1xuXHRcdFx0ZHMuYWRkKHdlYlNvY2tldE5vZGVTb2NrZXQub25EYXRhKChkYXRhKSA9PiB7XG5cdFx0XHRcdHJlY2VpdmluZ1NpZGVPbkRhdGFDYWxsQ291bnQrKztcblx0XHRcdFx0cmVjZWl2aW5nU2lkZVRvdGFsQnl0ZXMgKz0gZGF0YS5ieXRlTGVuZ3RoO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRkcy5hZGQod2ViU29ja2V0Tm9kZVNvY2tldC5vbkNsb3NlKCgpID0+IHtcblx0XHRcdFx0d2ViU29ja2V0Tm9kZVNvY2tldC5kaXNwb3NlKCk7XG5cdFx0XHRcdHJlY2VpdmluZ1NpZGVTb2NrZXRDbG9zZWRCYXJyaWVyLm9wZW4oKTtcblx0XHRcdH0pKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IHNvY2tldCA9IGNvbm5lY3Qoe1xuXHRcdFx0aG9zdDogJzEyNy4wLjAuMScsXG5cdFx0XHRwb3J0OiAoPEFkZHJlc3NJbmZvPnNlcnZlci5hZGRyZXNzKCkpLnBvcnRcblx0XHR9KTtcblxuXHRcdGNvbnN0IGJ1ZmYgPSBnZW5lcmF0ZVJhbmRvbUJ1ZmZlcigxICogMTAyNCAqIDEwMjQpO1xuXG5cdFx0Y29uc3Qgd2ViU29ja2V0Tm9kZVNvY2tldCA9IG5ldyBXZWJTb2NrZXROb2RlU29ja2V0KG5ldyBOb2RlU29ja2V0KHNvY2tldCksIHRydWUsIG51bGwsIGZhbHNlKTtcblx0XHR3ZWJTb2NrZXROb2RlU29ja2V0LndyaXRlKGJ1ZmYpO1xuXHRcdGF3YWl0IHdlYlNvY2tldE5vZGVTb2NrZXQuZHJhaW4oKTtcblx0XHR3ZWJTb2NrZXROb2RlU29ja2V0LmRpc3Bvc2UoKTtcblx0XHRhd2FpdCByZWNlaXZpbmdTaWRlU29ja2V0Q2xvc2VkQmFycmllci53YWl0KCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVjZWl2aW5nU2lkZVRvdGFsQnl0ZXMsIGJ1ZmYuYnl0ZUxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlY2VpdmluZ1NpZGVPbkRhdGFDYWxsQ291bnQsIDQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTk0Mjg0OiBwaW5nL3Bvbmcgb3Bjb2RlcyBhcmUgc3VwcG9ydGVkJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3Qgc29ja2V0ID0gbmV3IEZha2VOb2RlU29ja2V0KCk7XG5cdFx0Y29uc3Qgd2ViU29ja2V0ID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBXZWJTb2NrZXROb2RlU29ja2V0KDxhbnk+c29ja2V0LCBmYWxzZSwgbnVsbCwgZmFsc2UpKTtcblxuXHRcdGxldCByZWNlaXZlZERhdGE6IHN0cmluZyA9ICcnO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh3ZWJTb2NrZXQub25EYXRhKChidWZmKSA9PiB7XG5cdFx0XHRyZWNlaXZlZERhdGEgKz0gZnJvbUNoYXJDb2RlQXJyYXkoZnJvbVVpbnQ4QXJyYXkoYnVmZi5idWZmZXIpKTtcblx0XHR9KSk7XG5cblx0XHQvLyBBIHNpbmdsZS1mcmFtZSBub24tY29tcHJlc3NlZCB0ZXh0IG1lc3NhZ2UgdGhhdCBjb250YWlucyBcIkhlbGxvXCJcblx0XHRzb2NrZXQuZmlyZURhdGEoWzB4ODEsIDB4MDUsIDB4NDgsIDB4NjUsIDB4NmMsIDB4NmMsIDB4NmZdKTtcblxuXHRcdC8vIEEgcGluZyBtZXNzYWdlIHRoYXQgY29udGFpbnMgXCJkYXRhXCJcblx0XHRzb2NrZXQuZmlyZURhdGEoWzB4ODksIDB4MDQsIDB4NjQsIDB4NjEsIDB4NzQsIDB4NjFdKTtcblxuXHRcdC8vIEFub3RoZXIgc2luZ2xlLWZyYW1lIG5vbi1jb21wcmVzc2VkIHRleHQgbWVzc2FnZSB0aGF0IGNvbnRhaW5zIFwiSGVsbG9cIlxuXHRcdHNvY2tldC5maXJlRGF0YShbMHg4MSwgMHgwNSwgMHg0OCwgMHg2NSwgMHg2YywgMHg2YywgMHg2Zl0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlY2VpdmVkRGF0YSwgJ0hlbGxvSGVsbG8nKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0c29ja2V0LndyaXR0ZW5EYXRhLm1hcCh4ID0+IGZyb21VaW50OEFycmF5KHguYnVmZmVyKSksXG5cdFx0XHRbXG5cdFx0XHRcdC8vIEEgcG9uZyBtZXNzYWdlIHRoYXQgY29udGFpbnMgXCJkYXRhXCJcblx0XHRcdFx0WzB4OEEsIDB4MDQsIDB4NjQsIDB4NjEsIDB4NzQsIDB4NjFdXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblxuXHRcdHJldHVybiByZWNlaXZlZERhdGE7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGdlbmVyYXRlUmFuZG9tQnVmZmVyKHNpemU6IG51bWJlcik6IFZTQnVmZmVyIHtcblx0XHRjb25zdCBidWZmID0gVlNCdWZmZXIuYWxsb2Moc2l6ZSk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzaXplOyBpKyspIHtcblx0XHRcdGJ1ZmYud3JpdGVVSW50OChNYXRoLmZsb29yKDI1NiAqIE1hdGgucmFuZG9tKCkpLCBpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGJ1ZmY7XG5cdH1cblxuXHRmdW5jdGlvbiBsaXN0ZW5PblJhbmRvbVBvcnQoaGFuZGxlcjogKHNvY2tldDogU29ja2V0KSA9PiB2b2lkKTogUHJvbWlzZTxTZXJ2ZXI+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0Y29uc3Qgc2VydmVyID0gY3JlYXRlU2VydmVyKGhhbmRsZXIpLmxpc3RlbigwKTtcblx0XHRcdHNlcnZlci5vbignbGlzdGVuaW5nJywgKCkgPT4ge1xuXHRcdFx0XHRyZXNvbHZlKHNlcnZlcik7XG5cdFx0XHR9KTtcblx0XHRcdHNlcnZlci5vbignZXJyb3InLCAoZXJyKSA9PiB7XG5cdFx0XHRcdHJlamVjdChlcnIpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLE9BQU8sV0FBVztBQUNsQixTQUFTLG9CQUFvQjtBQUM3QixTQUFzQixTQUFTLG9CQUFvQztBQUNuRSxTQUFTLGNBQWM7QUFDdkIsU0FBUyxTQUFTLGVBQWU7QUFDakMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxZQUFZLGlCQUFpQixvQkFBb0I7QUFDMUQsU0FBeUIsb0JBQW9CLFVBQVUseUJBQXVFO0FBQzlILFNBQVMsdUJBQXVCLHVCQUF1QixZQUFZLDJCQUEyQjtBQUM5RixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLCtDQUErQztBQUV4RCxNQUFNLHNCQUFzQixXQUFXO0FBQUEsRUFLdEMsWUFBWSxHQUFrQztBQUM3QyxVQUFNO0FBQ04sU0FBSyxtQkFBbUI7QUFDeEIsU0FBSyxZQUFZLENBQUM7QUFDbEIsU0FBSyxVQUFVLEVBQUUsVUFBVSxVQUFRO0FBQ2xDLFdBQUssVUFBVSxLQUFLLElBQUk7QUFDeEIsV0FBSyxTQUFTO0FBQUEsSUFDZixDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSxXQUFpQjtBQUN4QixRQUFJLENBQUMsS0FBSyxrQkFBa0I7QUFDM0I7QUFBQSxJQUNEO0FBQ0EsUUFBSSxLQUFLLFVBQVUsV0FBVyxHQUFHO0FBQ2hDO0FBQUEsSUFDRDtBQUNBLFVBQU0sV0FBVyxLQUFLO0FBQ3RCLFVBQU0sTUFBTSxLQUFLLFVBQVUsTUFBTTtBQUVqQyxTQUFLLG1CQUFt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
