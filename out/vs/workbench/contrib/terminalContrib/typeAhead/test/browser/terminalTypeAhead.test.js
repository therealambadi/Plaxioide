import assert from "assert";
import { stub, useFakeTimers } from "sinon";
import { Emitter } from "../../../../../../base/common/event.js";
import { CharPredictState, PredictionStats, TypeAheadAddon } from "../../browser/terminalTypeAheadAddon.js";
import { TestConfigurationService } from "../../../../../../platform/configuration/test/common/testConfigurationService.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { DEFAULT_LOCAL_ECHO_EXCLUDE } from "../../common/terminalTypeAheadConfiguration.js";
const CSI = `\x1B[`;
var CursorMoveDirection = /* @__PURE__ */ ((CursorMoveDirection2) => {
  CursorMoveDirection2["Back"] = "D";
  CursorMoveDirection2["Forwards"] = "C";
  return CursorMoveDirection2;
})(CursorMoveDirection || {});
suite("Workbench - Terminal Typeahead", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  suite("PredictionStats", () => {
    let stats;
    let add;
    let succeed;
    let fail;
    setup(() => {
      add = ds.add(new Emitter());
      succeed = ds.add(new Emitter());
      fail = ds.add(new Emitter());
      stats = ds.add(new PredictionStats({
        onPredictionAdded: add.event,
        onPredictionSucceeded: succeed.event,
        onPredictionFailed: fail.event
      }));
    });
    test("creates sane data", () => {
      const stubs = createPredictionStubs(5);
      const clock = useFakeTimers();
      try {
        for (const s of stubs) {
          add.fire(s);
        }
        for (let i = 0; i < stubs.length; i++) {
          clock.tick(100);
          (i % 2 ? fail : succeed).fire(stubs[i]);
        }
        assert.strictEqual(stats.accuracy, 3 / 5);
        assert.strictEqual(stats.sampleSize, 5);
        assert.deepStrictEqual(stats.latency, {
          count: 3,
          min: 100,
          max: 500,
          median: 300
        });
      } finally {
        clock.restore();
      }
    });
    test("circular buffer", () => {
      const bufferSize = 24;
      const stubs = createPredictionStubs(bufferSize * 2);
      for (const s of stubs.slice(0, bufferSize)) {
        add.fire(s);
        succeed.fire(s);
      }
      assert.strictEqual(stats.accuracy, 1);
      for (const s of stubs.slice(bufferSize, bufferSize * 3 / 2)) {
        add.fire(s);
        fail.fire(s);
      }
      assert.strictEqual(stats.accuracy, 0.5);
      for (const s of stubs.slice(bufferSize * 3 / 2)) {
        add.fire(s);
        fail.fire(s);
      }
      assert.strictEqual(stats.accuracy, 0);
    });
  });
  suite("timeline", () => {
    let onBeforeProcessData;
    let publicLog;
    let config;
    let addon;
    const predictedHelloo = [
      `${CSI}?25l`,
      // hide cursor
      `${CSI}2;7H`,
      // move cursor
      "o",
      // new character
      `${CSI}2;8H`,
      // place cursor back at end of line
      `${CSI}?25h`
      // show cursor
    ].join("");
    const expectProcessed = (input, output) => {
      const evt = { data: input };
      onBeforeProcessData.fire(evt);
      assert.strictEqual(JSON.stringify(evt.data), JSON.stringify(output));
    };
    setup(() => {
      onBeforeProcessData = ds.add(new Emitter());
      config = upcastPartial({
        localEchoStyle: "italic",
        localEchoLatencyThreshold: 0,
        localEchoExcludePrograms: DEFAULT_LOCAL_ECHO_EXCLUDE
      });
      publicLog = stub();
      addon = new TestTypeAheadAddon(
        upcastPartial({ onBeforeProcessData: onBeforeProcessData.event }),
        new TestConfigurationService({ terminal: { integrated: { ...config } } }),
        upcastPartial({ publicLog })
      );
      addon.unlockMakingPredictions();
    });
    teardown(() => {
      addon.dispose();
    });
    test("predicts a single character", () => {
      const t = ds.add(createMockTerminal({ lines: ["hello|"] }));
      addon.activate(t.terminal);
      t.onData("o");
      t.expectWritten(`${CSI}3mo${CSI}23m`);
    });
    test("validates character prediction", () => {
      const t = ds.add(createMockTerminal({ lines: ["hello|"] }));
      addon.activate(t.terminal);
      t.onData("o");
      expectProcessed("o", predictedHelloo);
      assert.strictEqual(addon.stats?.accuracy, 1);
    });
    test("validates zsh prediction (#112842)", () => {
      const t = ds.add(createMockTerminal({ lines: ["hello|"] }));
      addon.activate(t.terminal);
      t.onData("o");
      expectProcessed("o", predictedHelloo);
      t.onData("x");
      expectProcessed("\box", [
        `${CSI}?25l`,
        // hide cursor
        `${CSI}2;8H`,
        // move cursor
        "\box",
        // new data
        `${CSI}2;9H`,
        // place cursor back at end of line
        `${CSI}?25h`
        // show cursor
      ].join(""));
      assert.strictEqual(addon.stats?.accuracy, 1);
    });
    test("does not validate zsh prediction on differing lookbehindn (#112842)", () => {
      const t = ds.add(createMockTerminal({ lines: ["hello|"] }));
      addon.activate(t.terminal);
      t.onData("o");
      expectProcessed("o", predictedHelloo);
      t.onData("x");
      expectProcessed("\bqx", [
        `${CSI}?25l`,
        // hide cursor
        `${CSI}2;8H`,
        // move cursor cursor
        `${CSI}X`,
        // delete character
        `${CSI}0m`,
        // reset style
        "\bqx",
        // new data
        `${CSI}?25h`
        // show cursor
      ].join(""));
      assert.strictEqual(addon.stats?.accuracy, 0.5);
    });
    test("rolls back character prediction", () => {
      const t = ds.add(createMockTerminal({ lines: ["hello|"] }));
      addon.activate(t.terminal);
      t.onData("o");
      expectProcessed("q", [
        `${CSI}?25l`,
        // hide cursor
        `${CSI}2;7H`,
        // move cursor cursor
        `${CSI}X`,
        // delete character
        `${CSI}0m`,
        // reset style
        "q",
        // new character
        `${CSI}?25h`
        // show cursor
      ].join(""));
      assert.strictEqual(addon.stats?.accuracy, 0);
    });
    test("handles left arrow when we hit the boundary", () => {
      const t = ds.add(createMockTerminal({ lines: ["|"] }));
      addon.activate(t.terminal);
      addon.unlockNavigating();
      const cursorXBefore = addon.physicalCursor(t.terminal.buffer.active)?.x;
      t.onData(`${CSI}${"D" /* Back */}`);
      t.expectWritten("");
      onBeforeProcessData.fire({ data: "xy" });
      assert.strictEqual(
        addon.physicalCursor(t.terminal.buffer.active)?.x,
        // The cursor should not have changed because we've hit the
        // boundary (start of prompt)
        cursorXBefore
      );
    });
    test("handles right arrow when we hit the boundary", () => {
      const t = ds.add(createMockTerminal({ lines: ["|"] }));
      addon.activate(t.terminal);
      addon.unlockNavigating();
      const cursorXBefore = addon.physicalCursor(t.terminal.buffer.active)?.x;
      t.onData(`${CSI}${"C" /* Forwards */}`);
      t.expectWritten("");
      onBeforeProcessData.fire({ data: "xy" });
      assert.strictEqual(
        addon.physicalCursor(t.terminal.buffer.active)?.x,
        // The cursor should not have changed because we've hit the
        // boundary (end of prompt)
        cursorXBefore
      );
    });
    test("internal cursor state is reset when all predictions are undone", () => {
      const t = ds.add(createMockTerminal({ lines: ["|"] }));
      addon.activate(t.terminal);
      addon.unlockNavigating();
      const cursorXBefore = addon.physicalCursor(t.terminal.buffer.active)?.x;
      t.onData(`${CSI}${"D" /* Back */}`);
      t.expectWritten("");
      addon.undoAllPredictions();
      assert.strictEqual(
        addon.physicalCursor(t.terminal.buffer.active)?.x,
        // The cursor should not have changed because we've hit the
        // boundary (start of prompt)
        cursorXBefore
      );
    });
    test("restores cursor graphics mode", () => {
      const t = ds.add(createMockTerminal({
        lines: ["hello|"],
        cursorAttrs: { isAttributeDefault: false, isBold: true, isFgPalette: true, getFgColor: 1 }
      }));
      addon.activate(t.terminal);
      t.onData("o");
      expectProcessed("q", [
        `${CSI}?25l`,
        // hide cursor
        `${CSI}2;7H`,
        // move cursor cursor
        `${CSI}X`,
        // delete character
        `${CSI}1;38;5;1m`,
        // reset style
        "q",
        // new character
        `${CSI}?25h`
        // show cursor
      ].join(""));
      assert.strictEqual(addon.stats?.accuracy, 0);
    });
    test("validates against and applies graphics mode on predicted", () => {
      const t = ds.add(createMockTerminal({ lines: ["hello|"] }));
      addon.activate(t.terminal);
      t.onData("o");
      expectProcessed(`${CSI}4mo`, [
        `${CSI}?25l`,
        // hide cursor
        `${CSI}2;7H`,
        // move cursor
        `${CSI}4m`,
        // new PTY's style
        "o",
        // new character
        `${CSI}2;8H`,
        // place cursor back at end of line
        `${CSI}?25h`
        // show cursor
      ].join(""));
      assert.strictEqual(addon.stats?.accuracy, 1);
    });
    test("ignores cursor hides or shows", () => {
      const t = ds.add(createMockTerminal({ lines: ["hello|"] }));
      addon.activate(t.terminal);
      t.onData("o");
      expectProcessed(`${CSI}?25lo${CSI}?25h`, [
        `${CSI}?25l`,
        // hide cursor from PTY
        `${CSI}?25l`,
        // hide cursor
        `${CSI}2;7H`,
        // move cursor
        "o",
        // new character
        `${CSI}?25h`,
        // show cursor from PTY
        `${CSI}2;8H`,
        // place cursor back at end of line
        `${CSI}?25h`
        // show cursor
      ].join(""));
      assert.strictEqual(addon.stats?.accuracy, 1);
    });
    test("matches backspace at EOL (bash style)", () => {
      const t = ds.add(createMockTerminal({ lines: ["hello|"] }));
      addon.activate(t.terminal);
      t.onData("\x7F");
      expectProcessed(`\b${CSI}K`, `\b${CSI}K`);
      assert.strictEqual(addon.stats?.accuracy, 1);
    });
    test("matches backspace at EOL (zsh style)", () => {
      const t = ds.add(createMockTerminal({ lines: ["hello|"] }));
      addon.activate(t.terminal);
      t.onData("\x7F");
      expectProcessed("\b \b", "\b \b");
      assert.strictEqual(addon.stats?.accuracy, 1);
    });
    test("gradually matches backspace", () => {
      const t = ds.add(createMockTerminal({ lines: ["hello|"] }));
      addon.activate(t.terminal);
      t.onData("\x7F");
      expectProcessed("\b", "");
      expectProcessed(" \b", "\b \b");
      assert.strictEqual(addon.stats?.accuracy, 1);
    });
    test("restores old character after invalid backspace", () => {
      const t = ds.add(createMockTerminal({ lines: ["hel|lo"] }));
      addon.activate(t.terminal);
      addon.unlockNavigating();
      t.onData("\x7F");
      t.expectWritten(`${CSI}2;4H${CSI}X`);
      expectProcessed("x", `${CSI}?25l${CSI}0ml${CSI}2;5H${CSI}0mx${CSI}?25h`);
      assert.strictEqual(addon.stats?.accuracy, 0);
    });
    test("waits for validation before deleting to left of cursor", () => {
      const t = ds.add(createMockTerminal({ lines: ["hello|"] }));
      addon.activate(t.terminal);
      t.onData("\x7F");
      t.expectWritten("");
      expectProcessed("\b \b", "\b \b");
      t.cursor.x--;
      t.onData("o");
      onBeforeProcessData.fire({ data: "o" });
      t.cursor.x++;
      t.clearWritten();
      t.onData("\x7F");
      t.expectWritten(`${CSI}2;6H${CSI}X`);
    });
    test("waits for first valid prediction on a line", () => {
      const t = ds.add(createMockTerminal({ lines: ["hello|"] }));
      addon.lockMakingPredictions();
      addon.activate(t.terminal);
      t.onData("o");
      t.expectWritten("");
      expectProcessed("o", "o");
      t.onData("o");
      t.expectWritten(`${CSI}3mo${CSI}23m`);
    });
    test("disables on title change", () => {
      const t = ds.add(createMockTerminal({ lines: ["hello|"] }));
      addon.activate(t.terminal);
      addon.reevaluateNow();
      assert.strictEqual(addon.isShowing, true, "expected to show initially");
      t.onTitleChange.fire("foo - VIM.exe");
      addon.reevaluateNow();
      assert.strictEqual(addon.isShowing, false, "expected to hide when vim is open");
      t.onTitleChange.fire("foo - git.exe");
      addon.reevaluateNow();
      assert.strictEqual(addon.isShowing, true, "expected to show again after vim closed");
    });
    test("adds line wrap prediction even if behind a boundary", () => {
      const t = ds.add(createMockTerminal({ lines: ["hello|"] }));
      addon.lockMakingPredictions();
      addon.activate(t.terminal);
      t.onData("hi".repeat(50));
      t.expectWritten("");
      expectProcessed("hi", [
        `${CSI}?25l`,
        // hide cursor
        "hi",
        // this greeting characters
        ...new Array(36).fill(`${CSI}3mh${CSI}23m${CSI}3mi${CSI}23m`),
        // rest of the greetings that fit on this line
        `${CSI}2;81H`,
        // move to end of line
        `${CSI}?25h`
      ].join(""));
    });
  });
});
class TestTypeAheadAddon extends TypeAheadAddon {
  unlockMakingPredictions() {
    this._lastRow = { y: 1, startingX: 100, endingX: 100, charState: CharPredictState.Validated };
  }
  lockMakingPredictions() {
    this._lastRow = void 0;
  }
  unlockNavigating() {
    this._lastRow = { y: 1, startingX: 1, endingX: 1, charState: CharPredictState.Validated };
  }
  reevaluateNow() {
    this._reevaluatePredictorStateNow(this.stats, this._timeline);
  }
  get isShowing() {
    return !!this._timeline?.isShowingPredictions;
  }
  undoAllPredictions() {
    this._timeline?.undoAllPredictions();
  }
  physicalCursor(buffer) {
    return this._timeline?.physicalCursor(buffer);
  }
  tentativeCursor(buffer) {
    return this._timeline?.tentativeCursor(buffer);
  }
}
function upcastPartial(v) {
  return v;
}
function createPredictionStubs(n) {
  return new Array(n).fill(0).map(stubPrediction);
}
function stubPrediction() {
  return {
    apply: () => "",
    rollback: () => "",
    matches: () => 0,
    rollForwards: () => ""
  };
}
function createMockTerminal({ lines, cursorAttrs }) {
  const ds = new DisposableStore();
  const written = [];
  const cursor = { y: 1, x: 1 };
  const onTitleChange = ds.add(new Emitter());
  const onData = ds.add(new Emitter());
  const csiEmitter = ds.add(new Emitter());
  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    if (line.includes("|")) {
      cursor.y = y + 1;
      cursor.x = line.indexOf("|") + 1;
      lines[y] = line.replace("|", "");
      break;
    }
  }
  return {
    written,
    cursor,
    expectWritten: (s) => {
      assert.strictEqual(JSON.stringify(written.join("")), JSON.stringify(s));
      written.splice(0, written.length);
    },
    clearWritten: () => written.splice(0, written.length),
    onData: (s) => onData.fire(s),
    csiEmitter,
    onTitleChange,
    dispose: () => ds.dispose(),
    terminal: {
      cols: 80,
      rows: 5,
      onResize: new Emitter().event,
      onData: onData.event,
      onTitleChange: onTitleChange.event,
      parser: {
        registerCsiHandler(_, callback) {
          ds.add(csiEmitter.event(callback));
        }
      },
      write(line) {
        written.push(line);
      },
      _core: {
        _inputHandler: {
          _curAttrData: mockCell("", cursorAttrs)
        },
        writeSync() {
        }
      },
      buffer: {
        active: {
          type: "normal",
          baseY: 0,
          get cursorY() {
            return cursor.y;
          },
          get cursorX() {
            return cursor.x;
          },
          getLine(y) {
            const s = lines[y - 1] || "";
            return {
              length: s.length,
              getCell: (x) => mockCell(s[x - 1] || ""),
              translateToString: (trim, start = 0, end = s.length) => {
                const out = s.slice(start, end);
                return trim ? out.trimRight() : out;
              }
            };
          }
        }
      }
    }
  };
}
function mockCell(char, attrs = {}) {
  return new Proxy({}, {
    get(_, prop) {
      if (typeof prop === "string" && attrs.hasOwnProperty(prop)) {
        return () => attrs[prop];
      }
      switch (prop) {
        case "getWidth":
          return () => 1;
        case "getChars":
          return () => char;
        case "getCode":
          return () => char.charCodeAt(0) || 0;
        case "isAttributeDefault":
          return () => true;
        default:
          return String(prop).startsWith("is") ? () => false : () => 0;
      }
    }
  });
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvdHlwZUFoZWFkL3Rlc3QvYnJvd3Nlci90ZXJtaW5hbFR5cGVBaGVhZC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHR5cGUgeyBJQnVmZmVyLCBUZXJtaW5hbCB9IGZyb20gJ0B4dGVybS94dGVybSc7XG5pbXBvcnQgeyBTaW5vblN0dWIsIHN0dWIsIHVzZUZha2VUaW1lcnMgfSBmcm9tICdzaW5vbic7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgQ2hhclByZWRpY3RTdGF0ZSwgSVByZWRpY3Rpb24sIFByZWRpY3Rpb25TdGF0cywgVHlwZUFoZWFkQWRkb24gfSBmcm9tICcuLi8uLi9icm93c2VyL3Rlcm1pbmFsVHlwZUFoZWFkQWRkb24uanMnO1xuaW1wb3J0IHsgSUJlZm9yZVByb2Nlc3NEYXRhRXZlbnQsIElUZXJtaW5hbFByb2Nlc3NNYW5hZ2VyIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgREVGQVVMVF9MT0NBTF9FQ0hPX0VYQ0xVREUsIHR5cGUgSVRlcm1pbmFsVHlwZUFoZWFkQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXJtaW5hbFR5cGVBaGVhZENvbmZpZ3VyYXRpb24uanMnO1xuXG5jb25zdCBDU0kgPSBgXFx4MWJbYDtcblxuY29uc3QgZW51bSBDdXJzb3JNb3ZlRGlyZWN0aW9uIHtcblx0QmFjayA9ICdEJyxcblx0Rm9yd2FyZHMgPSAnQycsXG59XG5cbnN1aXRlKCdXb3JrYmVuY2ggLSBUZXJtaW5hbCBUeXBlYWhlYWQnLCAoKSA9PiB7XG5cdGNvbnN0IGRzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c3VpdGUoJ1ByZWRpY3Rpb25TdGF0cycsICgpID0+IHtcblx0XHRsZXQgc3RhdHM6IFByZWRpY3Rpb25TdGF0cztcblx0XHRsZXQgYWRkOiBFbWl0dGVyPElQcmVkaWN0aW9uPjtcblx0XHRsZXQgc3VjY2VlZDogRW1pdHRlcjxJUHJlZGljdGlvbj47XG5cdFx0bGV0IGZhaWw6IEVtaXR0ZXI8SVByZWRpY3Rpb24+O1xuXG5cdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0YWRkID0gZHMuYWRkKG5ldyBFbWl0dGVyPElQcmVkaWN0aW9uPigpKTtcblx0XHRcdHN1Y2NlZWQgPSBkcy5hZGQobmV3IEVtaXR0ZXI8SVByZWRpY3Rpb24+KCkpO1xuXHRcdFx0ZmFpbCA9IGRzLmFkZChuZXcgRW1pdHRlcjxJUHJlZGljdGlvbj4oKSk7XG5cblx0XHRcdHN0YXRzID0gZHMuYWRkKG5ldyBQcmVkaWN0aW9uU3RhdHMoe1xuXHRcdFx0XHRvblByZWRpY3Rpb25BZGRlZDogYWRkLmV2ZW50LFxuXHRcdFx0XHRvblByZWRpY3Rpb25TdWNjZWVkZWQ6IHN1Y2NlZWQuZXZlbnQsXG5cdFx0XHRcdG9uUHJlZGljdGlvbkZhaWxlZDogZmFpbC5ldmVudCxcblx0XHRcdH0gYXMgYW55KSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdjcmVhdGVzIHNhbmUgZGF0YScsICgpID0+IHtcblx0XHRcdGNvbnN0IHN0dWJzID0gY3JlYXRlUHJlZGljdGlvblN0dWJzKDUpO1xuXHRcdFx0Y29uc3QgY2xvY2sgPSB1c2VGYWtlVGltZXJzKCk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHMgb2Ygc3R1YnMpIHsgYWRkLmZpcmUocyk7IH1cblxuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHN0dWJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0Y2xvY2sudGljaygxMDApO1xuXHRcdFx0XHRcdChpICUgMiA/IGZhaWwgOiBzdWNjZWVkKS5maXJlKHN0dWJzW2ldKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGF0cy5hY2N1cmFjeSwgMyAvIDUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhdHMuc2FtcGxlU2l6ZSwgNSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhdHMubGF0ZW5jeSwge1xuXHRcdFx0XHRcdGNvdW50OiAzLFxuXHRcdFx0XHRcdG1pbjogMTAwLFxuXHRcdFx0XHRcdG1heDogNTAwLFxuXHRcdFx0XHRcdG1lZGlhbjogMzAwXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0Y2xvY2sucmVzdG9yZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGVzdCgnY2lyY3VsYXIgYnVmZmVyJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgYnVmZmVyU2l6ZSA9IDI0O1xuXHRcdFx0Y29uc3Qgc3R1YnMgPSBjcmVhdGVQcmVkaWN0aW9uU3R1YnMoYnVmZmVyU2l6ZSAqIDIpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHMgb2Ygc3R1YnMuc2xpY2UoMCwgYnVmZmVyU2l6ZSkpIHsgYWRkLmZpcmUocyk7IHN1Y2NlZWQuZmlyZShzKTsgfVxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YXRzLmFjY3VyYWN5LCAxKTtcblxuXHRcdFx0Zm9yIChjb25zdCBzIG9mIHN0dWJzLnNsaWNlKGJ1ZmZlclNpemUsIGJ1ZmZlclNpemUgKiAzIC8gMikpIHsgYWRkLmZpcmUocyk7IGZhaWwuZmlyZShzKTsgfVxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YXRzLmFjY3VyYWN5LCAwLjUpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHMgb2Ygc3R1YnMuc2xpY2UoYnVmZmVyU2l6ZSAqIDMgLyAyKSkgeyBhZGQuZmlyZShzKTsgZmFpbC5maXJlKHMpOyB9XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhdHMuYWNjdXJhY3ksIDApO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgndGltZWxpbmUnLCAoKSA9PiB7XG5cdFx0bGV0IG9uQmVmb3JlUHJvY2Vzc0RhdGE6IEVtaXR0ZXI8SUJlZm9yZVByb2Nlc3NEYXRhRXZlbnQ+O1xuXHRcdGxldCBwdWJsaWNMb2c6IFNpbm9uU3R1Yjtcblx0XHRsZXQgY29uZmlnOiBJVGVybWluYWxUeXBlQWhlYWRDb25maWd1cmF0aW9uO1xuXHRcdGxldCBhZGRvbjogVGVzdFR5cGVBaGVhZEFkZG9uO1xuXG5cdFx0Y29uc3QgcHJlZGljdGVkSGVsbG9vID0gW1xuXHRcdFx0YCR7Q1NJfT8yNWxgLCAvLyBoaWRlIGN1cnNvclxuXHRcdFx0YCR7Q1NJfTI7N0hgLCAvLyBtb3ZlIGN1cnNvclxuXHRcdFx0J28nLCAvLyBuZXcgY2hhcmFjdGVyXG5cdFx0XHRgJHtDU0l9Mjs4SGAsIC8vIHBsYWNlIGN1cnNvciBiYWNrIGF0IGVuZCBvZiBsaW5lXG5cdFx0XHRgJHtDU0l9PzI1aGAsIC8vIHNob3cgY3Vyc29yXG5cdFx0XS5qb2luKCcnKTtcblxuXHRcdGNvbnN0IGV4cGVjdFByb2Nlc3NlZCA9IChpbnB1dDogc3RyaW5nLCBvdXRwdXQ6IHN0cmluZykgPT4ge1xuXHRcdFx0Y29uc3QgZXZ0ID0geyBkYXRhOiBpbnB1dCB9O1xuXHRcdFx0b25CZWZvcmVQcm9jZXNzRGF0YS5maXJlKGV2dCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoSlNPTi5zdHJpbmdpZnkoZXZ0LmRhdGEpLCBKU09OLnN0cmluZ2lmeShvdXRwdXQpKTtcblx0XHR9O1xuXG5cdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0b25CZWZvcmVQcm9jZXNzRGF0YSA9IGRzLmFkZChuZXcgRW1pdHRlcjxJQmVmb3JlUHJvY2Vzc0RhdGFFdmVudD4oKSk7XG5cdFx0XHRjb25maWcgPSB1cGNhc3RQYXJ0aWFsPElUZXJtaW5hbFR5cGVBaGVhZENvbmZpZ3VyYXRpb24+KHtcblx0XHRcdFx0bG9jYWxFY2hvU3R5bGU6ICdpdGFsaWMnLFxuXHRcdFx0XHRsb2NhbEVjaG9MYXRlbmN5VGhyZXNob2xkOiAwLFxuXHRcdFx0XHRsb2NhbEVjaG9FeGNsdWRlUHJvZ3JhbXM6IERFRkFVTFRfTE9DQUxfRUNIT19FWENMVURFLFxuXHRcdFx0fSk7XG5cdFx0XHRwdWJsaWNMb2cgPSBzdHViKCk7XG5cdFx0XHRhZGRvbiA9IG5ldyBUZXN0VHlwZUFoZWFkQWRkb24oXG5cdFx0XHRcdHVwY2FzdFBhcnRpYWw8SVRlcm1pbmFsUHJvY2Vzc01hbmFnZXI+KHsgb25CZWZvcmVQcm9jZXNzRGF0YTogb25CZWZvcmVQcm9jZXNzRGF0YS5ldmVudCB9KSxcblx0XHRcdFx0bmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7IHRlcm1pbmFsOiB7IGludGVncmF0ZWQ6IHsgLi4uY29uZmlnIH0gfSB9KSxcblx0XHRcdFx0dXBjYXN0UGFydGlhbDxJVGVsZW1ldHJ5U2VydmljZT4oeyBwdWJsaWNMb2cgfSlcblx0XHRcdCk7XG5cdFx0XHRhZGRvbi51bmxvY2tNYWtpbmdQcmVkaWN0aW9ucygpO1xuXHRcdH0pO1xuXG5cdFx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdFx0YWRkb24uZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncHJlZGljdHMgYSBzaW5nbGUgY2hhcmFjdGVyJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdCA9IGRzLmFkZChjcmVhdGVNb2NrVGVybWluYWwoeyBsaW5lczogWydoZWxsb3wnXSB9KSk7XG5cdFx0XHRhZGRvbi5hY3RpdmF0ZSh0LnRlcm1pbmFsKTtcblx0XHRcdHQub25EYXRhKCdvJyk7XG5cdFx0XHR0LmV4cGVjdFdyaXR0ZW4oYCR7Q1NJfTNtbyR7Q1NJfTIzbWApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgndmFsaWRhdGVzIGNoYXJhY3RlciBwcmVkaWN0aW9uJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdCA9IGRzLmFkZChjcmVhdGVNb2NrVGVybWluYWwoeyBsaW5lczogWydoZWxsb3wnXSB9KSk7XG5cdFx0XHRhZGRvbi5hY3RpdmF0ZSh0LnRlcm1pbmFsKTtcblx0XHRcdHQub25EYXRhKCdvJyk7XG5cdFx0XHRleHBlY3RQcm9jZXNzZWQoJ28nLCBwcmVkaWN0ZWRIZWxsb28pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFkZG9uLnN0YXRzPy5hY2N1cmFjeSwgMSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd2YWxpZGF0ZXMgenNoIHByZWRpY3Rpb24gKCMxMTI4NDIpJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdCA9IGRzLmFkZChjcmVhdGVNb2NrVGVybWluYWwoeyBsaW5lczogWydoZWxsb3wnXSB9KSk7XG5cdFx0XHRhZGRvbi5hY3RpdmF0ZSh0LnRlcm1pbmFsKTtcblx0XHRcdHQub25EYXRhKCdvJyk7XG5cdFx0XHRleHBlY3RQcm9jZXNzZWQoJ28nLCBwcmVkaWN0ZWRIZWxsb28pO1xuXG5cdFx0XHR0Lm9uRGF0YSgneCcpO1xuXHRcdFx0ZXhwZWN0UHJvY2Vzc2VkKCdcXGJveCcsIFtcblx0XHRcdFx0YCR7Q1NJfT8yNWxgLCAvLyBoaWRlIGN1cnNvclxuXHRcdFx0XHRgJHtDU0l9Mjs4SGAsIC8vIG1vdmUgY3Vyc29yXG5cdFx0XHRcdCdcXGJveCcsIC8vIG5ldyBkYXRhXG5cdFx0XHRcdGAke0NTSX0yOzlIYCwgLy8gcGxhY2UgY3Vyc29yIGJhY2sgYXQgZW5kIG9mIGxpbmVcblx0XHRcdFx0YCR7Q1NJfT8yNWhgLCAvLyBzaG93IGN1cnNvclxuXHRcdFx0XS5qb2luKCcnKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWRkb24uc3RhdHM/LmFjY3VyYWN5LCAxKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2RvZXMgbm90IHZhbGlkYXRlIHpzaCBwcmVkaWN0aW9uIG9uIGRpZmZlcmluZyBsb29rYmVoaW5kbiAoIzExMjg0MiknLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ID0gZHMuYWRkKGNyZWF0ZU1vY2tUZXJtaW5hbCh7IGxpbmVzOiBbJ2hlbGxvfCddIH0pKTtcblx0XHRcdGFkZG9uLmFjdGl2YXRlKHQudGVybWluYWwpO1xuXHRcdFx0dC5vbkRhdGEoJ28nKTtcblx0XHRcdGV4cGVjdFByb2Nlc3NlZCgnbycsIHByZWRpY3RlZEhlbGxvbyk7XG5cblx0XHRcdHQub25EYXRhKCd4Jyk7XG5cdFx0XHRleHBlY3RQcm9jZXNzZWQoJ1xcYnF4JywgW1xuXHRcdFx0XHRgJHtDU0l9PzI1bGAsIC8vIGhpZGUgY3Vyc29yXG5cdFx0XHRcdGAke0NTSX0yOzhIYCwgLy8gbW92ZSBjdXJzb3IgY3Vyc29yXG5cdFx0XHRcdGAke0NTSX1YYCwgLy8gZGVsZXRlIGNoYXJhY3RlclxuXHRcdFx0XHRgJHtDU0l9MG1gLCAvLyByZXNldCBzdHlsZVxuXHRcdFx0XHQnXFxicXgnLCAvLyBuZXcgZGF0YVxuXHRcdFx0XHRgJHtDU0l9PzI1aGAsIC8vIHNob3cgY3Vyc29yXG5cdFx0XHRdLmpvaW4oJycpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhZGRvbi5zdGF0cz8uYWNjdXJhY3ksIDAuNSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyb2xscyBiYWNrIGNoYXJhY3RlciBwcmVkaWN0aW9uJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdCA9IGRzLmFkZChjcmVhdGVNb2NrVGVybWluYWwoeyBsaW5lczogWydoZWxsb3wnXSB9KSk7XG5cdFx0XHRhZGRvbi5hY3RpdmF0ZSh0LnRlcm1pbmFsKTtcblx0XHRcdHQub25EYXRhKCdvJyk7XG5cblx0XHRcdGV4cGVjdFByb2Nlc3NlZCgncScsIFtcblx0XHRcdFx0YCR7Q1NJfT8yNWxgLCAvLyBoaWRlIGN1cnNvclxuXHRcdFx0XHRgJHtDU0l9Mjs3SGAsIC8vIG1vdmUgY3Vyc29yIGN1cnNvclxuXHRcdFx0XHRgJHtDU0l9WGAsIC8vIGRlbGV0ZSBjaGFyYWN0ZXJcblx0XHRcdFx0YCR7Q1NJfTBtYCwgLy8gcmVzZXQgc3R5bGVcblx0XHRcdFx0J3EnLCAvLyBuZXcgY2hhcmFjdGVyXG5cdFx0XHRcdGAke0NTSX0/MjVoYCwgLy8gc2hvdyBjdXJzb3Jcblx0XHRcdF0uam9pbignJykpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFkZG9uLnN0YXRzPy5hY2N1cmFjeSwgMCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdoYW5kbGVzIGxlZnQgYXJyb3cgd2hlbiB3ZSBoaXQgdGhlIGJvdW5kYXJ5JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdCA9IGRzLmFkZChjcmVhdGVNb2NrVGVybWluYWwoeyBsaW5lczogWyd8J10gfSkpO1xuXHRcdFx0YWRkb24uYWN0aXZhdGUodC50ZXJtaW5hbCk7XG5cdFx0XHRhZGRvbi51bmxvY2tOYXZpZ2F0aW5nKCk7XG5cblx0XHRcdGNvbnN0IGN1cnNvclhCZWZvcmUgPSBhZGRvbi5waHlzaWNhbEN1cnNvcih0LnRlcm1pbmFsLmJ1ZmZlci5hY3RpdmUpPy54ITtcblx0XHRcdHQub25EYXRhKGAke0NTSX0ke0N1cnNvck1vdmVEaXJlY3Rpb24uQmFja31gKTtcblx0XHRcdHQuZXhwZWN0V3JpdHRlbignJyk7XG5cblx0XHRcdC8vIFRyaWdnZXIgcm9sbGJhY2sgYmVjYXVzZSB3ZSBkb24ndCBleHBlY3QgdGhpcyBkYXRhXG5cdFx0XHRvbkJlZm9yZVByb2Nlc3NEYXRhLmZpcmUoeyBkYXRhOiAneHknIH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRcdGFkZG9uLnBoeXNpY2FsQ3Vyc29yKHQudGVybWluYWwuYnVmZmVyLmFjdGl2ZSk/LngsXG5cdFx0XHRcdC8vIFRoZSBjdXJzb3Igc2hvdWxkIG5vdCBoYXZlIGNoYW5nZWQgYmVjYXVzZSB3ZSd2ZSBoaXQgdGhlXG5cdFx0XHRcdC8vIGJvdW5kYXJ5IChzdGFydCBvZiBwcm9tcHQpXG5cdFx0XHRcdGN1cnNvclhCZWZvcmUpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnaGFuZGxlcyByaWdodCBhcnJvdyB3aGVuIHdlIGhpdCB0aGUgYm91bmRhcnknLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ID0gZHMuYWRkKGNyZWF0ZU1vY2tUZXJtaW5hbCh7IGxpbmVzOiBbJ3wnXSB9KSk7XG5cdFx0XHRhZGRvbi5hY3RpdmF0ZSh0LnRlcm1pbmFsKTtcblx0XHRcdGFkZG9uLnVubG9ja05hdmlnYXRpbmcoKTtcblxuXHRcdFx0Y29uc3QgY3Vyc29yWEJlZm9yZSA9IGFkZG9uLnBoeXNpY2FsQ3Vyc29yKHQudGVybWluYWwuYnVmZmVyLmFjdGl2ZSk/LnghO1xuXHRcdFx0dC5vbkRhdGEoYCR7Q1NJfSR7Q3Vyc29yTW92ZURpcmVjdGlvbi5Gb3J3YXJkc31gKTtcblx0XHRcdHQuZXhwZWN0V3JpdHRlbignJyk7XG5cblx0XHRcdC8vIFRyaWdnZXIgcm9sbGJhY2sgYmVjYXVzZSB3ZSBkb24ndCBleHBlY3QgdGhpcyBkYXRhXG5cdFx0XHRvbkJlZm9yZVByb2Nlc3NEYXRhLmZpcmUoeyBkYXRhOiAneHknIH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRcdGFkZG9uLnBoeXNpY2FsQ3Vyc29yKHQudGVybWluYWwuYnVmZmVyLmFjdGl2ZSk/LngsXG5cdFx0XHRcdC8vIFRoZSBjdXJzb3Igc2hvdWxkIG5vdCBoYXZlIGNoYW5nZWQgYmVjYXVzZSB3ZSd2ZSBoaXQgdGhlXG5cdFx0XHRcdC8vIGJvdW5kYXJ5IChlbmQgb2YgcHJvbXB0KVxuXHRcdFx0XHRjdXJzb3JYQmVmb3JlKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2ludGVybmFsIGN1cnNvciBzdGF0ZSBpcyByZXNldCB3aGVuIGFsbCBwcmVkaWN0aW9ucyBhcmUgdW5kb25lJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdCA9IGRzLmFkZChjcmVhdGVNb2NrVGVybWluYWwoeyBsaW5lczogWyd8J10gfSkpO1xuXHRcdFx0YWRkb24uYWN0aXZhdGUodC50ZXJtaW5hbCk7XG5cdFx0XHRhZGRvbi51bmxvY2tOYXZpZ2F0aW5nKCk7XG5cblx0XHRcdGNvbnN0IGN1cnNvclhCZWZvcmUgPSBhZGRvbi5waHlzaWNhbEN1cnNvcih0LnRlcm1pbmFsLmJ1ZmZlci5hY3RpdmUpPy54ITtcblx0XHRcdHQub25EYXRhKGAke0NTSX0ke0N1cnNvck1vdmVEaXJlY3Rpb24uQmFja31gKTtcblx0XHRcdHQuZXhwZWN0V3JpdHRlbignJyk7XG5cdFx0XHRhZGRvbi51bmRvQWxsUHJlZGljdGlvbnMoKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0XHRhZGRvbi5waHlzaWNhbEN1cnNvcih0LnRlcm1pbmFsLmJ1ZmZlci5hY3RpdmUpPy54LFxuXHRcdFx0XHQvLyBUaGUgY3Vyc29yIHNob3VsZCBub3QgaGF2ZSBjaGFuZ2VkIGJlY2F1c2Ugd2UndmUgaGl0IHRoZVxuXHRcdFx0XHQvLyBib3VuZGFyeSAoc3RhcnQgb2YgcHJvbXB0KVxuXHRcdFx0XHRjdXJzb3JYQmVmb3JlKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Jlc3RvcmVzIGN1cnNvciBncmFwaGljcyBtb2RlJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdCA9IGRzLmFkZChjcmVhdGVNb2NrVGVybWluYWwoe1xuXHRcdFx0XHRsaW5lczogWydoZWxsb3wnXSxcblx0XHRcdFx0Y3Vyc29yQXR0cnM6IHsgaXNBdHRyaWJ1dGVEZWZhdWx0OiBmYWxzZSwgaXNCb2xkOiB0cnVlLCBpc0ZnUGFsZXR0ZTogdHJ1ZSwgZ2V0RmdDb2xvcjogMSB9LFxuXHRcdFx0fSkpO1xuXHRcdFx0YWRkb24uYWN0aXZhdGUodC50ZXJtaW5hbCk7XG5cdFx0XHR0Lm9uRGF0YSgnbycpO1xuXG5cdFx0XHRleHBlY3RQcm9jZXNzZWQoJ3EnLCBbXG5cdFx0XHRcdGAke0NTSX0/MjVsYCwgLy8gaGlkZSBjdXJzb3Jcblx0XHRcdFx0YCR7Q1NJfTI7N0hgLCAvLyBtb3ZlIGN1cnNvciBjdXJzb3Jcblx0XHRcdFx0YCR7Q1NJfVhgLCAvLyBkZWxldGUgY2hhcmFjdGVyXG5cdFx0XHRcdGAke0NTSX0xOzM4OzU7MW1gLCAvLyByZXNldCBzdHlsZVxuXHRcdFx0XHQncScsIC8vIG5ldyBjaGFyYWN0ZXJcblx0XHRcdFx0YCR7Q1NJfT8yNWhgLCAvLyBzaG93IGN1cnNvclxuXHRcdFx0XS5qb2luKCcnKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWRkb24uc3RhdHM/LmFjY3VyYWN5LCAwKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3ZhbGlkYXRlcyBhZ2FpbnN0IGFuZCBhcHBsaWVzIGdyYXBoaWNzIG1vZGUgb24gcHJlZGljdGVkJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdCA9IGRzLmFkZChjcmVhdGVNb2NrVGVybWluYWwoeyBsaW5lczogWydoZWxsb3wnXSB9KSk7XG5cdFx0XHRhZGRvbi5hY3RpdmF0ZSh0LnRlcm1pbmFsKTtcblx0XHRcdHQub25EYXRhKCdvJyk7XG5cdFx0XHRleHBlY3RQcm9jZXNzZWQoYCR7Q1NJfTRtb2AsIFtcblx0XHRcdFx0YCR7Q1NJfT8yNWxgLCAvLyBoaWRlIGN1cnNvclxuXHRcdFx0XHRgJHtDU0l9Mjs3SGAsIC8vIG1vdmUgY3Vyc29yXG5cdFx0XHRcdGAke0NTSX00bWAsIC8vIG5ldyBQVFkncyBzdHlsZVxuXHRcdFx0XHQnbycsIC8vIG5ldyBjaGFyYWN0ZXJcblx0XHRcdFx0YCR7Q1NJfTI7OEhgLCAvLyBwbGFjZSBjdXJzb3IgYmFjayBhdCBlbmQgb2YgbGluZVxuXHRcdFx0XHRgJHtDU0l9PzI1aGAsIC8vIHNob3cgY3Vyc29yXG5cdFx0XHRdLmpvaW4oJycpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhZGRvbi5zdGF0cz8uYWNjdXJhY3ksIDEpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnaWdub3JlcyBjdXJzb3IgaGlkZXMgb3Igc2hvd3MnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ID0gZHMuYWRkKGNyZWF0ZU1vY2tUZXJtaW5hbCh7IGxpbmVzOiBbJ2hlbGxvfCddIH0pKTtcblx0XHRcdGFkZG9uLmFjdGl2YXRlKHQudGVybWluYWwpO1xuXHRcdFx0dC5vbkRhdGEoJ28nKTtcblx0XHRcdGV4cGVjdFByb2Nlc3NlZChgJHtDU0l9PzI1bG8ke0NTSX0/MjVoYCwgW1xuXHRcdFx0XHRgJHtDU0l9PzI1bGAsIC8vIGhpZGUgY3Vyc29yIGZyb20gUFRZXG5cdFx0XHRcdGAke0NTSX0/MjVsYCwgLy8gaGlkZSBjdXJzb3Jcblx0XHRcdFx0YCR7Q1NJfTI7N0hgLCAvLyBtb3ZlIGN1cnNvclxuXHRcdFx0XHQnbycsIC8vIG5ldyBjaGFyYWN0ZXJcblx0XHRcdFx0YCR7Q1NJfT8yNWhgLCAvLyBzaG93IGN1cnNvciBmcm9tIFBUWVxuXHRcdFx0XHRgJHtDU0l9Mjs4SGAsIC8vIHBsYWNlIGN1cnNvciBiYWNrIGF0IGVuZCBvZiBsaW5lXG5cdFx0XHRcdGAke0NTSX0/MjVoYCwgLy8gc2hvdyBjdXJzb3Jcblx0XHRcdF0uam9pbignJykpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFkZG9uLnN0YXRzPy5hY2N1cmFjeSwgMSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdtYXRjaGVzIGJhY2tzcGFjZSBhdCBFT0wgKGJhc2ggc3R5bGUpJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdCA9IGRzLmFkZChjcmVhdGVNb2NrVGVybWluYWwoeyBsaW5lczogWydoZWxsb3wnXSB9KSk7XG5cdFx0XHRhZGRvbi5hY3RpdmF0ZSh0LnRlcm1pbmFsKTtcblx0XHRcdHQub25EYXRhKCdcXHg3RicpO1xuXHRcdFx0ZXhwZWN0UHJvY2Vzc2VkKGBcXGIke0NTSX1LYCwgYFxcYiR7Q1NJfUtgKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhZGRvbi5zdGF0cz8uYWNjdXJhY3ksIDEpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbWF0Y2hlcyBiYWNrc3BhY2UgYXQgRU9MICh6c2ggc3R5bGUpJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdCA9IGRzLmFkZChjcmVhdGVNb2NrVGVybWluYWwoeyBsaW5lczogWydoZWxsb3wnXSB9KSk7XG5cdFx0XHRhZGRvbi5hY3RpdmF0ZSh0LnRlcm1pbmFsKTtcblx0XHRcdHQub25EYXRhKCdcXHg3RicpO1xuXHRcdFx0ZXhwZWN0UHJvY2Vzc2VkKCdcXGIgXFxiJywgJ1xcYiBcXGInKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhZGRvbi5zdGF0cz8uYWNjdXJhY3ksIDEpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZ3JhZHVhbGx5IG1hdGNoZXMgYmFja3NwYWNlJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdCA9IGRzLmFkZChjcmVhdGVNb2NrVGVybWluYWwoeyBsaW5lczogWydoZWxsb3wnXSB9KSk7XG5cdFx0XHRhZGRvbi5hY3RpdmF0ZSh0LnRlcm1pbmFsKTtcblx0XHRcdHQub25EYXRhKCdcXHg3RicpO1xuXHRcdFx0ZXhwZWN0UHJvY2Vzc2VkKCdcXGInLCAnJyk7XG5cdFx0XHRleHBlY3RQcm9jZXNzZWQoJyBcXGInLCAnXFxiIFxcYicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFkZG9uLnN0YXRzPy5hY2N1cmFjeSwgMSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyZXN0b3JlcyBvbGQgY2hhcmFjdGVyIGFmdGVyIGludmFsaWQgYmFja3NwYWNlJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdCA9IGRzLmFkZChjcmVhdGVNb2NrVGVybWluYWwoeyBsaW5lczogWydoZWx8bG8nXSB9KSk7XG5cdFx0XHRhZGRvbi5hY3RpdmF0ZSh0LnRlcm1pbmFsKTtcblx0XHRcdGFkZG9uLnVubG9ja05hdmlnYXRpbmcoKTtcblx0XHRcdHQub25EYXRhKCdcXHg3RicpO1xuXHRcdFx0dC5leHBlY3RXcml0dGVuKGAke0NTSX0yOzRIJHtDU0l9WGApO1xuXHRcdFx0ZXhwZWN0UHJvY2Vzc2VkKCd4JywgYCR7Q1NJfT8yNWwke0NTSX0wbWwke0NTSX0yOzVIJHtDU0l9MG14JHtDU0l9PzI1aGApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFkZG9uLnN0YXRzPy5hY2N1cmFjeSwgMCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd3YWl0cyBmb3IgdmFsaWRhdGlvbiBiZWZvcmUgZGVsZXRpbmcgdG8gbGVmdCBvZiBjdXJzb3InLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ID0gZHMuYWRkKGNyZWF0ZU1vY2tUZXJtaW5hbCh7IGxpbmVzOiBbJ2hlbGxvfCddIH0pKTtcblx0XHRcdGFkZG9uLmFjdGl2YXRlKHQudGVybWluYWwpO1xuXG5cdFx0XHQvLyBpbml0aWFsbHkgc2hvdWxkIG5vdCBiYWNrc3BhY2UgKHVudGlsIHRoZSBzZXJ2ZXIgY29uZmlybXMgaXQpXG5cdFx0XHR0Lm9uRGF0YSgnXFx4N0YnKTtcblx0XHRcdHQuZXhwZWN0V3JpdHRlbignJyk7XG5cdFx0XHRleHBlY3RQcm9jZXNzZWQoJ1xcYiBcXGInLCAnXFxiIFxcYicpO1xuXHRcdFx0dC5jdXJzb3IueC0tO1xuXG5cdFx0XHQvLyBlbnRlciBpbnB1dCBvbiB0aGUgY29sdW1uLi4uXG5cdFx0XHR0Lm9uRGF0YSgnbycpO1xuXHRcdFx0b25CZWZvcmVQcm9jZXNzRGF0YS5maXJlKHsgZGF0YTogJ28nIH0pO1xuXHRcdFx0dC5jdXJzb3IueCsrO1xuXHRcdFx0dC5jbGVhcldyaXR0ZW4oKTtcblxuXHRcdFx0Ly8gbm93IHRoYXQgdGhlIGNvbHVtbiBpcyAndW5sb2NrZWQnLCB3ZSBzaG91bGQgYmUgYWJsZSB0byBwcmVkaWN0IGJhY2tzcGFjZSBvbiBpdFxuXHRcdFx0dC5vbkRhdGEoJ1xceDdGJyk7XG5cdFx0XHR0LmV4cGVjdFdyaXR0ZW4oYCR7Q1NJfTI7Nkgke0NTSX1YYCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd3YWl0cyBmb3IgZmlyc3QgdmFsaWQgcHJlZGljdGlvbiBvbiBhIGxpbmUnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ID0gZHMuYWRkKGNyZWF0ZU1vY2tUZXJtaW5hbCh7IGxpbmVzOiBbJ2hlbGxvfCddIH0pKTtcblx0XHRcdGFkZG9uLmxvY2tNYWtpbmdQcmVkaWN0aW9ucygpO1xuXHRcdFx0YWRkb24uYWN0aXZhdGUodC50ZXJtaW5hbCk7XG5cblx0XHRcdHQub25EYXRhKCdvJyk7XG5cdFx0XHR0LmV4cGVjdFdyaXR0ZW4oJycpO1xuXHRcdFx0ZXhwZWN0UHJvY2Vzc2VkKCdvJywgJ28nKTtcblxuXHRcdFx0dC5vbkRhdGEoJ28nKTtcblx0XHRcdHQuZXhwZWN0V3JpdHRlbihgJHtDU0l9M21vJHtDU0l9MjNtYCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdkaXNhYmxlcyBvbiB0aXRsZSBjaGFuZ2UnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ID0gZHMuYWRkKGNyZWF0ZU1vY2tUZXJtaW5hbCh7IGxpbmVzOiBbJ2hlbGxvfCddIH0pKTtcblx0XHRcdGFkZG9uLmFjdGl2YXRlKHQudGVybWluYWwpO1xuXG5cdFx0XHRhZGRvbi5yZWV2YWx1YXRlTm93KCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWRkb24uaXNTaG93aW5nLCB0cnVlLCAnZXhwZWN0ZWQgdG8gc2hvdyBpbml0aWFsbHknKTtcblxuXHRcdFx0dC5vblRpdGxlQ2hhbmdlLmZpcmUoJ2ZvbyAtIFZJTS5leGUnKTtcblx0XHRcdGFkZG9uLnJlZXZhbHVhdGVOb3coKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhZGRvbi5pc1Nob3dpbmcsIGZhbHNlLCAnZXhwZWN0ZWQgdG8gaGlkZSB3aGVuIHZpbSBpcyBvcGVuJyk7XG5cblx0XHRcdHQub25UaXRsZUNoYW5nZS5maXJlKCdmb28gLSBnaXQuZXhlJyk7XG5cdFx0XHRhZGRvbi5yZWV2YWx1YXRlTm93KCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWRkb24uaXNTaG93aW5nLCB0cnVlLCAnZXhwZWN0ZWQgdG8gc2hvdyBhZ2FpbiBhZnRlciB2aW0gY2xvc2VkJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdhZGRzIGxpbmUgd3JhcCBwcmVkaWN0aW9uIGV2ZW4gaWYgYmVoaW5kIGEgYm91bmRhcnknLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ID0gZHMuYWRkKGNyZWF0ZU1vY2tUZXJtaW5hbCh7IGxpbmVzOiBbJ2hlbGxvfCddIH0pKTtcblx0XHRcdGFkZG9uLmxvY2tNYWtpbmdQcmVkaWN0aW9ucygpO1xuXHRcdFx0YWRkb24uYWN0aXZhdGUodC50ZXJtaW5hbCk7XG5cblx0XHRcdHQub25EYXRhKCdoaScucmVwZWF0KDUwKSk7XG5cdFx0XHR0LmV4cGVjdFdyaXR0ZW4oJycpO1xuXHRcdFx0ZXhwZWN0UHJvY2Vzc2VkKCdoaScsIFtcblx0XHRcdFx0YCR7Q1NJfT8yNWxgLCAvLyBoaWRlIGN1cnNvclxuXHRcdFx0XHQnaGknLCAvLyB0aGlzIGdyZWV0aW5nIGNoYXJhY3RlcnNcblx0XHRcdFx0Li4ubmV3IEFycmF5KDM2KS5maWxsKGAke0NTSX0zbWgke0NTSX0yM20ke0NTSX0zbWkke0NTSX0yM21gKSwgLy8gcmVzdCBvZiB0aGUgZ3JlZXRpbmdzIHRoYXQgZml0IG9uIHRoaXMgbGluZVxuXHRcdFx0XHRgJHtDU0l9Mjs4MUhgLCAvLyBtb3ZlIHRvIGVuZCBvZiBsaW5lXG5cdFx0XHRcdGAke0NTSX0/MjVoYFxuXHRcdFx0XS5qb2luKCcnKSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG5cbmNsYXNzIFRlc3RUeXBlQWhlYWRBZGRvbiBleHRlbmRzIFR5cGVBaGVhZEFkZG9uIHtcblx0dW5sb2NrTWFraW5nUHJlZGljdGlvbnMoKSB7XG5cdFx0dGhpcy5fbGFzdFJvdyA9IHsgeTogMSwgc3RhcnRpbmdYOiAxMDAsIGVuZGluZ1g6IDEwMCwgY2hhclN0YXRlOiBDaGFyUHJlZGljdFN0YXRlLlZhbGlkYXRlZCB9O1xuXHR9XG5cblx0bG9ja01ha2luZ1ByZWRpY3Rpb25zKCkge1xuXHRcdHRoaXMuX2xhc3RSb3cgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHR1bmxvY2tOYXZpZ2F0aW5nKCkge1xuXHRcdHRoaXMuX2xhc3RSb3cgPSB7IHk6IDEsIHN0YXJ0aW5nWDogMSwgZW5kaW5nWDogMSwgY2hhclN0YXRlOiBDaGFyUHJlZGljdFN0YXRlLlZhbGlkYXRlZCB9O1xuXHR9XG5cblx0cmVldmFsdWF0ZU5vdygpIHtcblx0XHR0aGlzLl9yZWV2YWx1YXRlUHJlZGljdG9yU3RhdGVOb3codGhpcy5zdGF0cyEsIHRoaXMuX3RpbWVsaW5lISk7XG5cdH1cblxuXHRnZXQgaXNTaG93aW5nKCkge1xuXHRcdHJldHVybiAhIXRoaXMuX3RpbWVsaW5lPy5pc1Nob3dpbmdQcmVkaWN0aW9ucztcblx0fVxuXG5cdHVuZG9BbGxQcmVkaWN0aW9ucygpIHtcblx0XHR0aGlzLl90aW1lbGluZT8udW5kb0FsbFByZWRpY3Rpb25zKCk7XG5cdH1cblxuXHRwaHlzaWNhbEN1cnNvcihidWZmZXI6IElCdWZmZXIpIHtcblx0XHRyZXR1cm4gdGhpcy5fdGltZWxpbmU/LnBoeXNpY2FsQ3Vyc29yKGJ1ZmZlcik7XG5cdH1cblxuXHR0ZW50YXRpdmVDdXJzb3IoYnVmZmVyOiBJQnVmZmVyKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3RpbWVsaW5lPy50ZW50YXRpdmVDdXJzb3IoYnVmZmVyKTtcblx0fVxufVxuXG5mdW5jdGlvbiB1cGNhc3RQYXJ0aWFsPFQ+KHY6IFBhcnRpYWw8VD4pOiBUIHtcblx0cmV0dXJuIHYgYXMgVDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUHJlZGljdGlvblN0dWJzKG46IG51bWJlcikge1xuXHRyZXR1cm4gbmV3IEFycmF5KG4pLmZpbGwoMCkubWFwKHN0dWJQcmVkaWN0aW9uKTtcbn1cblxuZnVuY3Rpb24gc3R1YlByZWRpY3Rpb24oKTogSVByZWRpY3Rpb24ge1xuXHRyZXR1cm4ge1xuXHRcdGFwcGx5OiAoKSA9PiAnJyxcblx0XHRyb2xsYmFjazogKCkgPT4gJycsXG5cdFx0bWF0Y2hlczogKCkgPT4gMCxcblx0XHRyb2xsRm9yd2FyZHM6ICgpID0+ICcnLFxuXHR9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVNb2NrVGVybWluYWwoeyBsaW5lcywgY3Vyc29yQXR0cnMgfToge1xuXHRsaW5lczogc3RyaW5nW107XG5cdGN1cnNvckF0dHJzPzogYW55O1xufSkge1xuXHRjb25zdCBkcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0Y29uc3Qgd3JpdHRlbjogc3RyaW5nW10gPSBbXTtcblx0Y29uc3QgY3Vyc29yID0geyB5OiAxLCB4OiAxIH07XG5cdGNvbnN0IG9uVGl0bGVDaGFuZ2UgPSBkcy5hZGQobmV3IEVtaXR0ZXI8c3RyaW5nPigpKTtcblx0Y29uc3Qgb25EYXRhID0gZHMuYWRkKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdGNvbnN0IGNzaUVtaXR0ZXIgPSBkcy5hZGQobmV3IEVtaXR0ZXI8bnVtYmVyW10+KCkpO1xuXG5cdGZvciAobGV0IHkgPSAwOyB5IDwgbGluZXMubGVuZ3RoOyB5KyspIHtcblx0XHRjb25zdCBsaW5lID0gbGluZXNbeV07XG5cdFx0aWYgKGxpbmUuaW5jbHVkZXMoJ3wnKSkge1xuXHRcdFx0Y3Vyc29yLnkgPSB5ICsgMTtcblx0XHRcdGN1cnNvci54ID0gbGluZS5pbmRleE9mKCd8JykgKyAxO1xuXHRcdFx0bGluZXNbeV0gPSBsaW5lLnJlcGxhY2UoJ3wnLCAnJyk7IC8vIENvZGVRTCBbU00wMjM4M10gcmVwbGFjaW5nIHRoZSBmaXJzdCBvY2N1cnJlbmNlIGlzIGludGVuZGVkXG5cdFx0XHRicmVhaztcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdHdyaXR0ZW4sXG5cdFx0Y3Vyc29yLFxuXHRcdGV4cGVjdFdyaXR0ZW46IChzOiBzdHJpbmcpID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChKU09OLnN0cmluZ2lmeSh3cml0dGVuLmpvaW4oJycpKSwgSlNPTi5zdHJpbmdpZnkocykpO1xuXHRcdFx0d3JpdHRlbi5zcGxpY2UoMCwgd3JpdHRlbi5sZW5ndGgpO1xuXHRcdH0sXG5cdFx0Y2xlYXJXcml0dGVuOiAoKSA9PiB3cml0dGVuLnNwbGljZSgwLCB3cml0dGVuLmxlbmd0aCksXG5cdFx0b25EYXRhOiAoczogc3RyaW5nKSA9PiBvbkRhdGEuZmlyZShzKSxcblx0XHRjc2lFbWl0dGVyLFxuXHRcdG9uVGl0bGVDaGFuZ2UsXG5cdFx0ZGlzcG9zZTogKCkgPT4gZHMuZGlzcG9zZSgpLFxuXHRcdHRlcm1pbmFsOiB7XG5cdFx0XHRjb2xzOiA4MCxcblx0XHRcdHJvd3M6IDUsXG5cdFx0XHRvblJlc2l6ZTogbmV3IEVtaXR0ZXI8dm9pZD4oKS5ldmVudCxcblx0XHRcdG9uRGF0YTogb25EYXRhLmV2ZW50LFxuXHRcdFx0b25UaXRsZUNoYW5nZTogb25UaXRsZUNoYW5nZS5ldmVudCxcblx0XHRcdHBhcnNlcjoge1xuXHRcdFx0XHRyZWdpc3RlckNzaUhhbmRsZXIoXzogdW5rbm93biwgY2FsbGJhY2s6ICgpID0+IHZvaWQpIHtcblx0XHRcdFx0XHRkcy5hZGQoY3NpRW1pdHRlci5ldmVudChjYWxsYmFjaykpO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHdyaXRlKGxpbmU6IHN0cmluZykge1xuXHRcdFx0XHR3cml0dGVuLnB1c2gobGluZSk7XG5cdFx0XHR9LFxuXHRcdFx0X2NvcmU6IHtcblx0XHRcdFx0X2lucHV0SGFuZGxlcjoge1xuXHRcdFx0XHRcdF9jdXJBdHRyRGF0YTogbW9ja0NlbGwoJycsIGN1cnNvckF0dHJzKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR3cml0ZVN5bmMoKSB7XG5cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGJ1ZmZlcjoge1xuXHRcdFx0XHRhY3RpdmU6IHtcblx0XHRcdFx0XHR0eXBlOiAnbm9ybWFsJyxcblx0XHRcdFx0XHRiYXNlWTogMCxcblx0XHRcdFx0XHRnZXQgY3Vyc29yWSgpIHsgcmV0dXJuIGN1cnNvci55OyB9LFxuXHRcdFx0XHRcdGdldCBjdXJzb3JYKCkgeyByZXR1cm4gY3Vyc29yLng7IH0sXG5cdFx0XHRcdFx0Z2V0TGluZSh5OiBudW1iZXIpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHMgPSBsaW5lc1t5IC0gMV0gfHwgJyc7XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRsZW5ndGg6IHMubGVuZ3RoLFxuXHRcdFx0XHRcdFx0XHRnZXRDZWxsOiAoeDogbnVtYmVyKSA9PiBtb2NrQ2VsbChzW3ggLSAxXSB8fCAnJyksXG5cdFx0XHRcdFx0XHRcdHRyYW5zbGF0ZVRvU3RyaW5nOiAodHJpbTogYm9vbGVhbiwgc3RhcnQgPSAwLCBlbmQgPSBzLmxlbmd0aCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IG91dCA9IHMuc2xpY2Uoc3RhcnQsIGVuZCk7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHRyaW0gPyBvdXQudHJpbVJpZ2h0KCkgOiBvdXQ7XG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGFzIHVua25vd24gYXMgVGVybWluYWxcblx0fTtcbn1cblxuZnVuY3Rpb24gbW9ja0NlbGwoY2hhcjogc3RyaW5nLCBhdHRyczogeyBba2V5OiBzdHJpbmddOiB1bmtub3duIH0gPSB7fSkge1xuXHRyZXR1cm4gbmV3IFByb3h5KHt9LCB7XG5cdFx0Z2V0KF8sIHByb3ApIHtcblx0XHRcdGlmICh0eXBlb2YgcHJvcCA9PT0gJ3N0cmluZycgJiYgYXR0cnMuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcblx0XHRcdFx0cmV0dXJuICgpID0+IGF0dHJzW3Byb3BdO1xuXHRcdFx0fVxuXG5cdFx0XHRzd2l0Y2ggKHByb3ApIHtcblx0XHRcdFx0Y2FzZSAnZ2V0V2lkdGgnOlxuXHRcdFx0XHRcdHJldHVybiAoKSA9PiAxO1xuXHRcdFx0XHRjYXNlICdnZXRDaGFycyc6XG5cdFx0XHRcdFx0cmV0dXJuICgpID0+IGNoYXI7XG5cdFx0XHRcdGNhc2UgJ2dldENvZGUnOlxuXHRcdFx0XHRcdHJldHVybiAoKSA9PiBjaGFyLmNoYXJDb2RlQXQoMCkgfHwgMDtcblx0XHRcdFx0Y2FzZSAnaXNBdHRyaWJ1dGVEZWZhdWx0Jzpcblx0XHRcdFx0XHRyZXR1cm4gKCkgPT4gdHJ1ZTtcblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRyZXR1cm4gU3RyaW5nKHByb3ApLnN0YXJ0c1dpdGgoJ2lzJykgPyAoKCkgPT4gZmFsc2UpIDogKCgpID0+IDApO1xuXHRcdFx0fVxuXHRcdH0sXG5cdH0pO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBRW5CLFNBQW9CLE1BQU0scUJBQXFCO0FBQy9DLFNBQVMsZUFBZTtBQUN4QixTQUFTLGtCQUErQixpQkFBaUIsc0JBQXNCO0FBRy9FLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsdUJBQXVCO0FB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
