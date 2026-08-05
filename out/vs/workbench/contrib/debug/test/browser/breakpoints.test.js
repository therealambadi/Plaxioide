import assert from "assert";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { dispose } from "../../../../../base/common/lifecycle.js";
import { URI as uri } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { OverviewRulerLane } from "../../../../../editor/common/model.js";
import { LanguageService } from "../../../../../editor/common/services/languageService.js";
import { createTextModel } from "../../../../../editor/test/common/testTextModel.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { NullLogService } from "../../../../../platform/log/common/log.js";
import { StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { createBreakpointDecorations } from "../../browser/breakpointEditorContribution.js";
import { getBreakpointMessageAndIcon, getExpandedBodySize } from "../../browser/breakpointsView.js";
import { DataBreakpointSetType, IDebugService, State } from "../../common/debug.js";
import { Breakpoint, DebugModel } from "../../common/debugModel.js";
import { createTestSession } from "./callStack.test.js";
import { createMockDebugModel, mockUriIdentityService } from "./mockDebugModel.js";
import { MockDebugService, MockDebugStorage } from "../common/mockDebug.js";
import { MockLabelService } from "../../../../services/label/test/common/mockLabelService.js";
import { TestStorageService } from "../../../../test/common/workbenchTestServices.js";
function addBreakpointsAndCheckEvents(model, uri2, data) {
  let eventCount = 0;
  const toDispose = model.onDidChangeBreakpoints((e) => {
    assert.strictEqual(e?.sessionOnly, false);
    assert.strictEqual(e?.changed, void 0);
    assert.strictEqual(e?.removed, void 0);
    const added = e?.added;
    assert.notStrictEqual(added, void 0);
    assert.strictEqual(added.length, data.length);
    eventCount++;
    dispose(toDispose);
    for (let i = 0; i < data.length; i++) {
      assert.strictEqual(e.added[i] instanceof Breakpoint, true);
      assert.strictEqual(e.added[i].lineNumber, data[i].lineNumber);
    }
  });
  const bps = model.addBreakpoints(uri2, data);
  assert.strictEqual(eventCount, 1);
  return bps;
}
suite("Debug - Breakpoints", () => {
  let model;
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  setup(() => {
    model = createMockDebugModel(disposables);
  });
  test("simple", () => {
    const modelUri = uri.file("/myfolder/myfile.js");
    addBreakpointsAndCheckEvents(model, modelUri, [{ lineNumber: 5, enabled: true }, { lineNumber: 10, enabled: false }]);
    assert.strictEqual(model.areBreakpointsActivated(), true);
    assert.strictEqual(model.getBreakpoints().length, 2);
    let eventCount = 0;
    const toDispose = model.onDidChangeBreakpoints((e) => {
      eventCount++;
      assert.strictEqual(e?.added, void 0);
      assert.strictEqual(e?.sessionOnly, false);
      assert.strictEqual(e?.removed?.length, 2);
      assert.strictEqual(e?.changed, void 0);
      dispose(toDispose);
    });
    model.removeBreakpoints(model.getBreakpoints());
    assert.strictEqual(eventCount, 1);
    assert.strictEqual(model.getBreakpoints().length, 0);
  });
  test("toggling", () => {
    const modelUri = uri.file("/myfolder/myfile.js");
    addBreakpointsAndCheckEvents(model, modelUri, [{ lineNumber: 5, enabled: true }, { lineNumber: 10, enabled: false }]);
    addBreakpointsAndCheckEvents(model, modelUri, [{ lineNumber: 12, enabled: true, condition: "fake condition" }]);
    assert.strictEqual(model.getBreakpoints().length, 3);
    const bp = model.getBreakpoints().pop();
    if (bp) {
      model.removeBreakpoints([bp]);
    }
    assert.strictEqual(model.getBreakpoints().length, 2);
    model.setBreakpointsActivated(false);
    assert.strictEqual(model.areBreakpointsActivated(), false);
    model.setBreakpointsActivated(true);
    assert.strictEqual(model.areBreakpointsActivated(), true);
  });
  test("two files", () => {
    const modelUri1 = uri.file("/myfolder/my file first.js");
    const modelUri2 = uri.file("/secondfolder/second/second file.js");
    addBreakpointsAndCheckEvents(model, modelUri1, [{ lineNumber: 5, enabled: true }, { lineNumber: 10, enabled: false }]);
    assert.strictEqual(getExpandedBodySize(model, void 0, 9), 44);
    addBreakpointsAndCheckEvents(model, modelUri2, [{ lineNumber: 1, enabled: true }, { lineNumber: 2, enabled: true }, { lineNumber: 3, enabled: false }]);
    assert.strictEqual(getExpandedBodySize(model, void 0, 9), 110);
    assert.strictEqual(model.getBreakpoints().length, 5);
    assert.strictEqual(model.getBreakpoints({ uri: modelUri1 }).length, 2);
    assert.strictEqual(model.getBreakpoints({ uri: modelUri2 }).length, 3);
    assert.strictEqual(model.getBreakpoints({ lineNumber: 5 }).length, 1);
    assert.strictEqual(model.getBreakpoints({ column: 5 }).length, 0);
    const bp = model.getBreakpoints()[0];
    const update = /* @__PURE__ */ new Map();
    update.set(bp.getId(), { lineNumber: 100 });
    let eventFired = false;
    const toDispose = model.onDidChangeBreakpoints((e) => {
      eventFired = true;
      assert.strictEqual(e?.added, void 0);
      assert.strictEqual(e?.removed, void 0);
      assert.strictEqual(e?.changed?.length, 1);
      dispose(toDispose);
    });
    model.updateBreakpoints(update);
    assert.strictEqual(eventFired, true);
    assert.strictEqual(bp.lineNumber, 100);
    assert.strictEqual(model.getBreakpoints({ enabledOnly: true }).length, 3);
    model.enableOrDisableAllBreakpoints(false);
    model.getBreakpoints().forEach((bp2) => {
      assert.strictEqual(bp2.enabled, false);
    });
    assert.strictEqual(model.getBreakpoints({ enabledOnly: true }).length, 0);
    model.setEnablement(bp, true);
    assert.strictEqual(bp.enabled, true);
    model.removeBreakpoints(model.getBreakpoints({ uri: modelUri1 }));
    assert.strictEqual(getExpandedBodySize(model, void 0, 9), 66);
    assert.strictEqual(model.getBreakpoints().length, 3);
  });
  test("conditions", () => {
    const modelUri1 = uri.file("/myfolder/my file first.js");
    addBreakpointsAndCheckEvents(model, modelUri1, [{ lineNumber: 5, condition: "i < 5", hitCondition: "17" }, { lineNumber: 10, condition: "j < 3" }]);
    const breakpoints = model.getBreakpoints();
    assert.strictEqual(breakpoints[0].condition, "i < 5");
    assert.strictEqual(breakpoints[0].hitCondition, "17");
    assert.strictEqual(breakpoints[1].condition, "j < 3");
    assert.strictEqual(!!breakpoints[1].hitCondition, false);
    assert.strictEqual(model.getBreakpoints().length, 2);
    model.removeBreakpoints(model.getBreakpoints());
    assert.strictEqual(model.getBreakpoints().length, 0);
  });
  test("function breakpoints", () => {
    model.addFunctionBreakpoint({ name: "foo" }, "1");
    model.addFunctionBreakpoint({ name: "bar" }, "2");
    model.updateFunctionBreakpoint("1", { name: "fooUpdated" });
    model.updateFunctionBreakpoint("2", { name: "barUpdated" });
    const functionBps = model.getFunctionBreakpoints();
    assert.strictEqual(functionBps[0].name, "fooUpdated");
    assert.strictEqual(functionBps[1].name, "barUpdated");
    model.removeFunctionBreakpoints();
    assert.strictEqual(model.getFunctionBreakpoints().length, 0);
  });
  test("multiple sessions", () => {
    const modelUri = uri.file("/myfolder/myfile.js");
    addBreakpointsAndCheckEvents(model, modelUri, [{ lineNumber: 5, enabled: true, condition: "x > 5" }, { lineNumber: 10, enabled: false }]);
    const breakpoints = model.getBreakpoints();
    const session = disposables.add(createTestSession(model));
    const data = /* @__PURE__ */ new Map();
    assert.strictEqual(breakpoints[0].lineNumber, 5);
    assert.strictEqual(breakpoints[1].lineNumber, 10);
    data.set(breakpoints[0].getId(), { verified: false, line: 10 });
    data.set(breakpoints[1].getId(), { verified: true, line: 50 });
    model.setBreakpointSessionData(session.getId(), {}, data);
    assert.strictEqual(breakpoints[0].lineNumber, 5);
    assert.strictEqual(breakpoints[1].lineNumber, 50);
    const session2 = disposables.add(createTestSession(model));
    const data2 = /* @__PURE__ */ new Map();
    data2.set(breakpoints[0].getId(), { verified: true, line: 100 });
    data2.set(breakpoints[1].getId(), { verified: true, line: 500 });
    model.setBreakpointSessionData(session2.getId(), {}, data2);
    assert.strictEqual(breakpoints[0].lineNumber, 100);
    assert.strictEqual(breakpoints[1].lineNumber, 10);
    model.setBreakpointSessionData(session.getId(), {}, void 0);
    assert.strictEqual(breakpoints[0].lineNumber, 100);
    assert.strictEqual(breakpoints[1].lineNumber, 500);
    assert.strictEqual(breakpoints[0].supported, false);
    const data3 = /* @__PURE__ */ new Map();
    data3.set(breakpoints[0].getId(), { verified: true, line: 500 });
    model.setBreakpointSessionData(session2.getId(), { supportsConditionalBreakpoints: true }, data2);
    assert.strictEqual(breakpoints[0].supported, true);
  });
  test("exception breakpoints", () => {
    let eventCount = 0;
    disposables.add(model.onDidChangeBreakpoints(() => eventCount++));
    model.setExceptionBreakpointsForSession("session-id-1", [{ filter: "uncaught", label: "UNCAUGHT", default: true }]);
    assert.strictEqual(eventCount, 1);
    let exceptionBreakpoints = model.getExceptionBreakpointsForSession("session-id-1");
    assert.strictEqual(exceptionBreakpoints.length, 1);
    assert.strictEqual(exceptionBreakpoints[0].filter, "uncaught");
    assert.strictEqual(exceptionBreakpoints[0].enabled, true);
    model.setExceptionBreakpointsForSession("session-id-2", [{ filter: "uncaught", label: "UNCAUGHT" }, { filter: "caught", label: "CAUGHT" }]);
    assert.strictEqual(eventCount, 2);
    exceptionBreakpoints = model.getExceptionBreakpointsForSession("session-id-2");
    assert.strictEqual(exceptionBreakpoints.length, 2);
    assert.strictEqual(exceptionBreakpoints[0].filter, "uncaught");
    assert.strictEqual(exceptionBreakpoints[0].enabled, true);
    assert.strictEqual(exceptionBreakpoints[1].filter, "caught");
    assert.strictEqual(exceptionBreakpoints[1].label, "CAUGHT");
    assert.strictEqual(exceptionBreakpoints[1].enabled, false);
    model.setExceptionBreakpointsForSession("session-id-3", [{ filter: "all", label: "ALL" }]);
    assert.strictEqual(eventCount, 3);
    assert.strictEqual(model.getExceptionBreakpointsForSession("session-id-3").length, 1);
    exceptionBreakpoints = model.getExceptionBreakpoints();
    assert.strictEqual(exceptionBreakpoints[0].filter, "uncaught");
    assert.strictEqual(exceptionBreakpoints[0].enabled, true);
    assert.strictEqual(exceptionBreakpoints[1].filter, "caught");
    assert.strictEqual(exceptionBreakpoints[1].label, "CAUGHT");
    assert.strictEqual(exceptionBreakpoints[1].enabled, false);
    assert.strictEqual(exceptionBreakpoints[2].filter, "all");
    assert.strictEqual(exceptionBreakpoints[2].label, "ALL");
  });
  test("exception breakpoints multiple sessions", () => {
    let eventCount = 0;
    disposables.add(model.onDidChangeBreakpoints(() => eventCount++));
    model.setExceptionBreakpointsForSession("session-id-4", [{ filter: "uncaught", label: "UNCAUGHT", default: true }, { filter: "caught", label: "CAUGHT" }]);
    model.setExceptionBreakpointFallbackSession("session-id-4");
    assert.strictEqual(eventCount, 1);
    let exceptionBreakpointsForSession = model.getExceptionBreakpointsForSession("session-id-4");
    assert.strictEqual(exceptionBreakpointsForSession.length, 2);
    assert.strictEqual(exceptionBreakpointsForSession[0].filter, "uncaught");
    assert.strictEqual(exceptionBreakpointsForSession[1].filter, "caught");
    model.setExceptionBreakpointsForSession("session-id-5", [{ filter: "all", label: "ALL" }, { filter: "caught", label: "CAUGHT" }]);
    assert.strictEqual(eventCount, 2);
    exceptionBreakpointsForSession = model.getExceptionBreakpointsForSession("session-id-5");
    let exceptionBreakpointsForUndefined = model.getExceptionBreakpointsForSession(void 0);
    assert.strictEqual(exceptionBreakpointsForSession.length, 2);
    assert.strictEqual(exceptionBreakpointsForSession[0].filter, "caught");
    assert.strictEqual(exceptionBreakpointsForSession[1].filter, "all");
    assert.strictEqual(exceptionBreakpointsForUndefined.length, 2);
    assert.strictEqual(exceptionBreakpointsForUndefined[0].filter, "uncaught");
    assert.strictEqual(exceptionBreakpointsForUndefined[1].filter, "caught");
    model.removeExceptionBreakpointsForSession("session-id-4");
    assert.strictEqual(eventCount, 2);
    exceptionBreakpointsForUndefined = model.getExceptionBreakpointsForSession(void 0);
    assert.strictEqual(exceptionBreakpointsForUndefined.length, 2);
    assert.strictEqual(exceptionBreakpointsForUndefined[0].filter, "uncaught");
    assert.strictEqual(exceptionBreakpointsForUndefined[1].filter, "caught");
    model.setExceptionBreakpointFallbackSession("session-id-5");
    assert.strictEqual(eventCount, 2);
    exceptionBreakpointsForUndefined = model.getExceptionBreakpointsForSession(void 0);
    assert.strictEqual(exceptionBreakpointsForUndefined.length, 2);
    assert.strictEqual(exceptionBreakpointsForUndefined[0].filter, "caught");
    assert.strictEqual(exceptionBreakpointsForUndefined[1].filter, "all");
    const exceptionBreakpoints = model.getExceptionBreakpoints();
    assert.strictEqual(exceptionBreakpoints.length, 3);
  });
  test("instruction breakpoints", () => {
    let eventCount = 0;
    disposables.add(model.onDidChangeBreakpoints(() => eventCount++));
    model.addInstructionBreakpoint({ instructionReference: "0xCCCCFFFF", offset: 0, address: 0n, canPersist: false });
    assert.strictEqual(eventCount, 1);
    let instructionBreakpoints = model.getInstructionBreakpoints();
    assert.strictEqual(instructionBreakpoints.length, 1);
    assert.strictEqual(instructionBreakpoints[0].instructionReference, "0xCCCCFFFF");
    assert.strictEqual(instructionBreakpoints[0].offset, 0);
    model.addInstructionBreakpoint({ instructionReference: "0xCCCCEEEE", offset: 1, address: 0n, canPersist: false });
    assert.strictEqual(eventCount, 2);
    instructionBreakpoints = model.getInstructionBreakpoints();
    assert.strictEqual(instructionBreakpoints.length, 2);
    assert.strictEqual(instructionBreakpoints[0].instructionReference, "0xCCCCFFFF");
    assert.strictEqual(instructionBreakpoints[0].offset, 0);
    assert.strictEqual(instructionBreakpoints[1].instructionReference, "0xCCCCEEEE");
    assert.strictEqual(instructionBreakpoints[1].offset, 1);
  });
  test("data breakpoints", () => {
    let eventCount = 0;
    disposables.add(model.onDidChangeBreakpoints(() => eventCount++));
    model.addDataBreakpoint({ description: "label", src: { type: DataBreakpointSetType.Variable, dataId: "id" }, canPersist: true, accessTypes: ["read"], accessType: "read" }, "1");
    model.addDataBreakpoint({ description: "second", src: { type: DataBreakpointSetType.Variable, dataId: "secondId" }, canPersist: false, accessTypes: ["readWrite"], accessType: "readWrite" }, "2");
    model.updateDataBreakpoint("1", { condition: "aCondition" });
    model.updateDataBreakpoint("2", { hitCondition: "10" });
    const dataBreakpoints = model.getDataBreakpoints();
    assert.strictEqual(dataBreakpoints[0].canPersist, true);
    assert.deepStrictEqual(dataBreakpoints[0].src, { type: DataBreakpointSetType.Variable, dataId: "id" });
    assert.strictEqual(dataBreakpoints[0].accessType, "read");
    assert.strictEqual(dataBreakpoints[0].condition, "aCondition");
    assert.strictEqual(dataBreakpoints[1].canPersist, false);
    assert.strictEqual(dataBreakpoints[1].description, "second");
    assert.strictEqual(dataBreakpoints[1].accessType, "readWrite");
    assert.strictEqual(dataBreakpoints[1].hitCondition, "10");
    assert.strictEqual(eventCount, 4);
    model.removeDataBreakpoints(dataBreakpoints[0].getId());
    assert.strictEqual(eventCount, 5);
    assert.strictEqual(model.getDataBreakpoints().length, 1);
    model.removeDataBreakpoints();
    assert.strictEqual(model.getDataBreakpoints().length, 0);
    assert.strictEqual(eventCount, 6);
  });
  test("message and class name", () => {
    const modelUri = uri.file("/myfolder/my file first.js");
    addBreakpointsAndCheckEvents(model, modelUri, [
      { lineNumber: 5, enabled: true, condition: "x > 5" },
      { lineNumber: 10, enabled: false },
      { lineNumber: 12, enabled: true, logMessage: "hello" },
      { lineNumber: 15, enabled: true, hitCondition: "12" },
      { lineNumber: 500, enabled: true }
    ]);
    const breakpoints = model.getBreakpoints();
    const ls = new MockLabelService();
    let result = getBreakpointMessageAndIcon(State.Stopped, true, breakpoints[0], ls, model);
    assert.strictEqual(result.message, "Condition: x > 5");
    assert.strictEqual(result.icon.id, "debug-breakpoint-conditional");
    result = getBreakpointMessageAndIcon(State.Stopped, true, breakpoints[1], ls, model);
    assert.strictEqual(result.message, "Disabled Breakpoint");
    assert.strictEqual(result.icon.id, "debug-breakpoint-disabled");
    result = getBreakpointMessageAndIcon(State.Stopped, true, breakpoints[2], ls, model);
    assert.strictEqual(result.message, "Log Message: hello");
    assert.strictEqual(result.icon.id, "debug-breakpoint-log");
    result = getBreakpointMessageAndIcon(State.Stopped, true, breakpoints[3], ls, model);
    assert.strictEqual(result.message, "Hit Count: 12");
    assert.strictEqual(result.icon.id, "debug-breakpoint-conditional");
    result = getBreakpointMessageAndIcon(State.Stopped, true, breakpoints[4], ls, model);
    assert.strictEqual(result.message, ls.getUriLabel(breakpoints[4].uri));
    assert.strictEqual(result.icon.id, "debug-breakpoint");
    result = getBreakpointMessageAndIcon(State.Stopped, false, breakpoints[2], ls, model);
    assert.strictEqual(result.message, "Disabled Logpoint");
    assert.strictEqual(result.icon.id, "debug-breakpoint-log-disabled");
    model.addDataBreakpoint({ description: "label", canPersist: true, accessTypes: ["read"], accessType: "read", src: { type: DataBreakpointSetType.Variable, dataId: "id" } });
    const dataBreakpoints = model.getDataBreakpoints();
    result = getBreakpointMessageAndIcon(State.Stopped, true, dataBreakpoints[0], ls, model);
    assert.strictEqual(result.message, "Data Breakpoint");
    assert.strictEqual(result.icon.id, "debug-breakpoint-data");
    const functionBreakpoint = model.addFunctionBreakpoint({ name: "foo" }, "1");
    result = getBreakpointMessageAndIcon(State.Stopped, true, functionBreakpoint, ls, model);
    assert.strictEqual(result.message, "Function Breakpoint");
    assert.strictEqual(result.icon.id, "debug-breakpoint-function");
    const data = /* @__PURE__ */ new Map();
    data.set(breakpoints[0].getId(), { verified: false, line: 10 });
    data.set(breakpoints[1].getId(), { verified: true, line: 50 });
    data.set(breakpoints[2].getId(), { verified: true, line: 50, message: "world" });
    data.set(functionBreakpoint.getId(), { verified: true });
    model.setBreakpointSessionData("mocksessionid", { supportsFunctionBreakpoints: false, supportsDataBreakpoints: true, supportsLogPoints: true }, data);
    result = getBreakpointMessageAndIcon(State.Stopped, true, breakpoints[0], ls, model);
    assert.strictEqual(result.message, "Unverified Breakpoint");
    assert.strictEqual(result.icon.id, "debug-breakpoint-unverified");
    result = getBreakpointMessageAndIcon(State.Stopped, true, functionBreakpoint, ls, model);
    assert.strictEqual(result.message, "Function breakpoints not supported by this debug type");
    assert.strictEqual(result.icon.id, "debug-breakpoint-function-unverified");
    result = getBreakpointMessageAndIcon(State.Stopped, true, breakpoints[2], ls, model);
    assert.strictEqual(result.message, "Log Message: hello, world");
    assert.strictEqual(result.icon.id, "debug-breakpoint-log");
  });
  test("decorations", () => {
    const modelUri = uri.file("/myfolder/my file first.js");
    const languageId = "testMode";
    const textModel = createTextModel(
      ["this is line one", "this is line two", "    this is line three it has whitespace at start", "this is line four", "this is line five"].join("\n"),
      languageId
    );
    addBreakpointsAndCheckEvents(model, modelUri, [
      { lineNumber: 1, enabled: true, condition: "x > 5" },
      { lineNumber: 2, column: 4, enabled: false },
      { lineNumber: 3, enabled: true, logMessage: "hello" },
      { lineNumber: 500, enabled: true }
    ]);
    const breakpoints = model.getBreakpoints();
    const instantiationService = new TestInstantiationService();
    const debugService = new MockDebugService();
    debugService.getModel = () => model;
    instantiationService.stub(IDebugService, debugService);
    instantiationService.stub(ILabelService, new MockLabelService());
    instantiationService.stub(ILanguageService, disposables.add(new LanguageService()));
    let decorations = instantiationService.invokeFunction((accessor) => createBreakpointDecorations(accessor, textModel, breakpoints, State.Running, true, true));
    assert.strictEqual(decorations.length, 3);
    assert.deepStrictEqual(decorations[0].range, new Range(1, 1, 1, 2));
    assert.deepStrictEqual(decorations[1].range, new Range(2, 4, 2, 5));
    assert.deepStrictEqual(decorations[2].range, new Range(3, 5, 3, 6));
    assert.strictEqual(decorations[0].options.beforeContentClassName, void 0);
    assert.strictEqual(decorations[1].options.before?.inlineClassName, `debug-breakpoint-placeholder`);
    assert.strictEqual(decorations[0].options.overviewRuler?.position, OverviewRulerLane.Left);
    const expected = new MarkdownString(void 0, { isTrusted: true, supportThemeIcons: true }).appendCodeblock(languageId, "Condition: x > 5");
    assert.deepStrictEqual(decorations[0].options.glyphMarginHoverMessage, expected);
    decorations = instantiationService.invokeFunction((accessor) => createBreakpointDecorations(accessor, textModel, breakpoints, State.Running, true, false));
    assert.strictEqual(decorations[0].options.overviewRuler, null);
    textModel.dispose();
    instantiationService.dispose();
  });
  test("updates when storage changes", () => {
    const storage1 = disposables.add(new TestStorageService());
    const debugStorage1 = disposables.add(new MockDebugStorage(storage1));
    const model1 = disposables.add(new DebugModel(debugStorage1, { isDirty: (e) => false }, mockUriIdentityService, new NullLogService()));
    const modelUri = uri.file("/myfolder/my file first.js");
    const first = [
      { lineNumber: 1, enabled: true, condition: "x > 5" },
      { lineNumber: 2, column: 4, enabled: false }
    ];
    addBreakpointsAndCheckEvents(model1, modelUri, first);
    debugStorage1.storeBreakpoints(model1);
    const stored = storage1.get("debug.breakpoint", StorageScope.WORKSPACE);
    const storage2 = disposables.add(new TestStorageService());
    const model2 = disposables.add(new DebugModel(disposables.add(new MockDebugStorage(storage2)), { isDirty: (e) => false }, mockUriIdentityService, new NullLogService()));
    storage2.store(
      "debug.breakpoint",
      stored,
      StorageScope.WORKSPACE,
      StorageTarget.USER,
      /* external= */
      true
    );
    assert.deepStrictEqual(model2.getBreakpoints().map((b) => b.getId()), model1.getBreakpoints().map((b) => b.getId()));
    storage2.store(
      "debug.breakpoint",
      "[]",
      StorageScope.WORKSPACE,
      StorageTarget.USER,
      /* external= */
      false
    );
    assert.deepStrictEqual(model2.getBreakpoints().map((b) => b.getId()), model1.getBreakpoints().map((b) => b.getId()));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy90ZXN0L2Jyb3dzZXIvYnJlYWtwb2ludHMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgYXMgdXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IE92ZXJ2aWV3UnVsZXJMYW5lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVCcmVha3BvaW50RGVjb3JhdGlvbnMgfSBmcm9tICcuLi8uLi9icm93c2VyL2JyZWFrcG9pbnRFZGl0b3JDb250cmlidXRpb24uanMnO1xuaW1wb3J0IHsgZ2V0QnJlYWtwb2ludE1lc3NhZ2VBbmRJY29uLCBnZXRFeHBhbmRlZEJvZHlTaXplIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9icmVha3BvaW50c1ZpZXcuanMnO1xuaW1wb3J0IHsgRGF0YUJyZWFrcG9pbnRTZXRUeXBlLCBJQnJlYWtwb2ludERhdGEsIElCcmVha3BvaW50VXBkYXRlRGF0YSwgSURlYnVnU2VydmljZSwgU3RhdGUgfSBmcm9tICcuLi8uLi9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHsgQnJlYWtwb2ludCwgRGVidWdNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9kZWJ1Z01vZGVsLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRlc3RTZXNzaW9uIH0gZnJvbSAnLi9jYWxsU3RhY2sudGVzdC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVNb2NrRGVidWdNb2RlbCwgbW9ja1VyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4vbW9ja0RlYnVnTW9kZWwuanMnO1xuaW1wb3J0IHsgTW9ja0RlYnVnU2VydmljZSwgTW9ja0RlYnVnU3RvcmFnZSB9IGZyb20gJy4uL2NvbW1vbi9tb2NrRGVidWcuanMnO1xuaW1wb3J0IHsgTW9ja0xhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2xhYmVsL3Rlc3QvY29tbW9uL21vY2tMYWJlbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdFN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcblxuZnVuY3Rpb24gYWRkQnJlYWtwb2ludHNBbmRDaGVja0V2ZW50cyhtb2RlbDogRGVidWdNb2RlbCwgdXJpOiB1cmksIGRhdGE6IElCcmVha3BvaW50RGF0YVtdKSB7XG5cdGxldCBldmVudENvdW50ID0gMDtcblx0Y29uc3QgdG9EaXNwb3NlID0gbW9kZWwub25EaWRDaGFuZ2VCcmVha3BvaW50cyhlID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZT8uc2Vzc2lvbk9ubHksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZT8uY2hhbmdlZCwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZT8ucmVtb3ZlZCwgdW5kZWZpbmVkKTtcblx0XHRjb25zdCBhZGRlZCA9IGU/LmFkZGVkO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChhZGRlZCwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWRkZWQhLmxlbmd0aCwgZGF0YS5sZW5ndGgpO1xuXHRcdGV2ZW50Q291bnQrKztcblx0XHRkaXNwb3NlKHRvRGlzcG9zZSk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZS5hZGRlZCFbaV0gaW5zdGFuY2VvZiBCcmVha3BvaW50LCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoZS5hZGRlZCFbaV0gYXMgQnJlYWtwb2ludCkubGluZU51bWJlciwgZGF0YVtpXS5saW5lTnVtYmVyKTtcblx0XHR9XG5cdH0pO1xuXHRjb25zdCBicHMgPSBtb2RlbC5hZGRCcmVha3BvaW50cyh1cmksIGRhdGEpO1xuXHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRDb3VudCwgMSk7XG5cdHJldHVybiBicHM7XG59XG5cbnN1aXRlKCdEZWJ1ZyAtIEJyZWFrcG9pbnRzJywgKCkgPT4ge1xuXHRsZXQgbW9kZWw6IERlYnVnTW9kZWw7XG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdG1vZGVsID0gY3JlYXRlTW9ja0RlYnVnTW9kZWwoZGlzcG9zYWJsZXMpO1xuXHR9KTtcblxuXHQvLyBCcmVha3BvaW50c1xuXG5cdHRlc3QoJ3NpbXBsZScsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbFVyaSA9IHVyaS5maWxlKCcvbXlmb2xkZXIvbXlmaWxlLmpzJyk7XG5cblx0XHRhZGRCcmVha3BvaW50c0FuZENoZWNrRXZlbnRzKG1vZGVsLCBtb2RlbFVyaSwgW3sgbGluZU51bWJlcjogNSwgZW5hYmxlZDogdHJ1ZSB9LCB7IGxpbmVOdW1iZXI6IDEwLCBlbmFibGVkOiBmYWxzZSB9XSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmFyZUJyZWFrcG9pbnRzQWN0aXZhdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRCcmVha3BvaW50cygpLmxlbmd0aCwgMik7XG5cblx0XHRsZXQgZXZlbnRDb3VudCA9IDA7XG5cdFx0Y29uc3QgdG9EaXNwb3NlID0gbW9kZWwub25EaWRDaGFuZ2VCcmVha3BvaW50cyhlID0+IHtcblx0XHRcdGV2ZW50Q291bnQrKztcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlPy5hZGRlZCwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlPy5zZXNzaW9uT25seSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGU/LnJlbW92ZWQ/Lmxlbmd0aCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZT8uY2hhbmdlZCwgdW5kZWZpbmVkKTtcblxuXHRcdFx0ZGlzcG9zZSh0b0Rpc3Bvc2UpO1xuXHRcdH0pO1xuXG5cdFx0bW9kZWwucmVtb3ZlQnJlYWtwb2ludHMobW9kZWwuZ2V0QnJlYWtwb2ludHMoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Q291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRCcmVha3BvaW50cygpLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3RvZ2dsaW5nJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsVXJpID0gdXJpLmZpbGUoJy9teWZvbGRlci9teWZpbGUuanMnKTtcblxuXHRcdGFkZEJyZWFrcG9pbnRzQW5kQ2hlY2tFdmVudHMobW9kZWwsIG1vZGVsVXJpLCBbeyBsaW5lTnVtYmVyOiA1LCBlbmFibGVkOiB0cnVlIH0sIHsgbGluZU51bWJlcjogMTAsIGVuYWJsZWQ6IGZhbHNlIH1dKTtcblx0XHRhZGRCcmVha3BvaW50c0FuZENoZWNrRXZlbnRzKG1vZGVsLCBtb2RlbFVyaSwgW3sgbGluZU51bWJlcjogMTIsIGVuYWJsZWQ6IHRydWUsIGNvbmRpdGlvbjogJ2Zha2UgY29uZGl0aW9uJyB9XSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldEJyZWFrcG9pbnRzKCkubGVuZ3RoLCAzKTtcblx0XHRjb25zdCBicCA9IG1vZGVsLmdldEJyZWFrcG9pbnRzKCkucG9wKCk7XG5cdFx0aWYgKGJwKSB7XG5cdFx0XHRtb2RlbC5yZW1vdmVCcmVha3BvaW50cyhbYnBdKTtcblx0XHR9XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldEJyZWFrcG9pbnRzKCkubGVuZ3RoLCAyKTtcblxuXHRcdG1vZGVsLnNldEJyZWFrcG9pbnRzQWN0aXZhdGVkKGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuYXJlQnJlYWtwb2ludHNBY3RpdmF0ZWQoKSwgZmFsc2UpO1xuXHRcdG1vZGVsLnNldEJyZWFrcG9pbnRzQWN0aXZhdGVkKHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5hcmVCcmVha3BvaW50c0FjdGl2YXRlZCgpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgndHdvIGZpbGVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsVXJpMSA9IHVyaS5maWxlKCcvbXlmb2xkZXIvbXkgZmlsZSBmaXJzdC5qcycpO1xuXHRcdGNvbnN0IG1vZGVsVXJpMiA9IHVyaS5maWxlKCcvc2Vjb25kZm9sZGVyL3NlY29uZC9zZWNvbmQgZmlsZS5qcycpO1xuXHRcdGFkZEJyZWFrcG9pbnRzQW5kQ2hlY2tFdmVudHMobW9kZWwsIG1vZGVsVXJpMSwgW3sgbGluZU51bWJlcjogNSwgZW5hYmxlZDogdHJ1ZSB9LCB7IGxpbmVOdW1iZXI6IDEwLCBlbmFibGVkOiBmYWxzZSB9XSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldEV4cGFuZGVkQm9keVNpemUobW9kZWwsIHVuZGVmaW5lZCwgOSksIDQ0KTtcblxuXHRcdGFkZEJyZWFrcG9pbnRzQW5kQ2hlY2tFdmVudHMobW9kZWwsIG1vZGVsVXJpMiwgW3sgbGluZU51bWJlcjogMSwgZW5hYmxlZDogdHJ1ZSB9LCB7IGxpbmVOdW1iZXI6IDIsIGVuYWJsZWQ6IHRydWUgfSwgeyBsaW5lTnVtYmVyOiAzLCBlbmFibGVkOiBmYWxzZSB9XSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldEV4cGFuZGVkQm9keVNpemUobW9kZWwsIHVuZGVmaW5lZCwgOSksIDExMCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0QnJlYWtwb2ludHMoKS5sZW5ndGgsIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRCcmVha3BvaW50cyh7IHVyaTogbW9kZWxVcmkxIH0pLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldEJyZWFrcG9pbnRzKHsgdXJpOiBtb2RlbFVyaTIgfSkubGVuZ3RoLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0QnJlYWtwb2ludHMoeyBsaW5lTnVtYmVyOiA1IH0pLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldEJyZWFrcG9pbnRzKHsgY29sdW1uOiA1IH0pLmxlbmd0aCwgMCk7XG5cblx0XHRjb25zdCBicCA9IG1vZGVsLmdldEJyZWFrcG9pbnRzKClbMF07XG5cdFx0Y29uc3QgdXBkYXRlID0gbmV3IE1hcDxzdHJpbmcsIElCcmVha3BvaW50VXBkYXRlRGF0YT4oKTtcblx0XHR1cGRhdGUuc2V0KGJwLmdldElkKCksIHsgbGluZU51bWJlcjogMTAwIH0pO1xuXHRcdGxldCBldmVudEZpcmVkID0gZmFsc2U7XG5cdFx0Y29uc3QgdG9EaXNwb3NlID0gbW9kZWwub25EaWRDaGFuZ2VCcmVha3BvaW50cyhlID0+IHtcblx0XHRcdGV2ZW50RmlyZWQgPSB0cnVlO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGU/LmFkZGVkLCB1bmRlZmluZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGU/LnJlbW92ZWQsIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZT8uY2hhbmdlZD8ubGVuZ3RoLCAxKTtcblx0XHRcdGRpc3Bvc2UodG9EaXNwb3NlKTtcblx0XHR9KTtcblx0XHRtb2RlbC51cGRhdGVCcmVha3BvaW50cyh1cGRhdGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudEZpcmVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYnAubGluZU51bWJlciwgMTAwKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRCcmVha3BvaW50cyh7IGVuYWJsZWRPbmx5OiB0cnVlIH0pLmxlbmd0aCwgMyk7XG5cdFx0bW9kZWwuZW5hYmxlT3JEaXNhYmxlQWxsQnJlYWtwb2ludHMoZmFsc2UpO1xuXHRcdG1vZGVsLmdldEJyZWFrcG9pbnRzKCkuZm9yRWFjaChicCA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYnAuZW5hYmxlZCwgZmFsc2UpO1xuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRCcmVha3BvaW50cyh7IGVuYWJsZWRPbmx5OiB0cnVlIH0pLmxlbmd0aCwgMCk7XG5cblx0XHRtb2RlbC5zZXRFbmFibGVtZW50KGJwLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYnAuZW5hYmxlZCwgdHJ1ZSk7XG5cblx0XHRtb2RlbC5yZW1vdmVCcmVha3BvaW50cyhtb2RlbC5nZXRCcmVha3BvaW50cyh7IHVyaTogbW9kZWxVcmkxIH0pKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0RXhwYW5kZWRCb2R5U2l6ZShtb2RlbCwgdW5kZWZpbmVkLCA5KSwgNjYpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldEJyZWFrcG9pbnRzKCkubGVuZ3RoLCAzKTtcblx0fSk7XG5cblx0dGVzdCgnY29uZGl0aW9ucycsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbFVyaTEgPSB1cmkuZmlsZSgnL215Zm9sZGVyL215IGZpbGUgZmlyc3QuanMnKTtcblx0XHRhZGRCcmVha3BvaW50c0FuZENoZWNrRXZlbnRzKG1vZGVsLCBtb2RlbFVyaTEsIFt7IGxpbmVOdW1iZXI6IDUsIGNvbmRpdGlvbjogJ2kgPCA1JywgaGl0Q29uZGl0aW9uOiAnMTcnIH0sIHsgbGluZU51bWJlcjogMTAsIGNvbmRpdGlvbjogJ2ogPCAzJyB9XSk7XG5cdFx0Y29uc3QgYnJlYWtwb2ludHMgPSBtb2RlbC5nZXRCcmVha3BvaW50cygpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJyZWFrcG9pbnRzWzBdLmNvbmRpdGlvbiwgJ2kgPCA1Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJyZWFrcG9pbnRzWzBdLmhpdENvbmRpdGlvbiwgJzE3Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJyZWFrcG9pbnRzWzFdLmNvbmRpdGlvbiwgJ2ogPCAzJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCEhYnJlYWtwb2ludHNbMV0uaGl0Q29uZGl0aW9uLCBmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0QnJlYWtwb2ludHMoKS5sZW5ndGgsIDIpO1xuXHRcdG1vZGVsLnJlbW92ZUJyZWFrcG9pbnRzKG1vZGVsLmdldEJyZWFrcG9pbnRzKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRCcmVha3BvaW50cygpLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Z1bmN0aW9uIGJyZWFrcG9pbnRzJywgKCkgPT4ge1xuXHRcdG1vZGVsLmFkZEZ1bmN0aW9uQnJlYWtwb2ludCh7IG5hbWU6ICdmb28nIH0sICcxJyk7XG5cdFx0bW9kZWwuYWRkRnVuY3Rpb25CcmVha3BvaW50KHsgbmFtZTogJ2JhcicgfSwgJzInKTtcblx0XHRtb2RlbC51cGRhdGVGdW5jdGlvbkJyZWFrcG9pbnQoJzEnLCB7IG5hbWU6ICdmb29VcGRhdGVkJyB9KTtcblx0XHRtb2RlbC51cGRhdGVGdW5jdGlvbkJyZWFrcG9pbnQoJzInLCB7IG5hbWU6ICdiYXJVcGRhdGVkJyB9KTtcblxuXHRcdGNvbnN0IGZ1bmN0aW9uQnBzID0gbW9kZWwuZ2V0RnVuY3Rpb25CcmVha3BvaW50cygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmdW5jdGlvbkJwc1swXS5uYW1lLCAnZm9vVXBkYXRlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmdW5jdGlvbkJwc1sxXS5uYW1lLCAnYmFyVXBkYXRlZCcpO1xuXG5cdFx0bW9kZWwucmVtb3ZlRnVuY3Rpb25CcmVha3BvaW50cygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRGdW5jdGlvbkJyZWFrcG9pbnRzKCkubGVuZ3RoLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlwbGUgc2Vzc2lvbnMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWxVcmkgPSB1cmkuZmlsZSgnL215Zm9sZGVyL215ZmlsZS5qcycpO1xuXHRcdGFkZEJyZWFrcG9pbnRzQW5kQ2hlY2tFdmVudHMobW9kZWwsIG1vZGVsVXJpLCBbeyBsaW5lTnVtYmVyOiA1LCBlbmFibGVkOiB0cnVlLCBjb25kaXRpb246ICd4ID4gNScgfSwgeyBsaW5lTnVtYmVyOiAxMCwgZW5hYmxlZDogZmFsc2UgfV0pO1xuXHRcdGNvbnN0IGJyZWFrcG9pbnRzID0gbW9kZWwuZ2V0QnJlYWtwb2ludHMoKTtcblx0XHRjb25zdCBzZXNzaW9uID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZVRlc3RTZXNzaW9uKG1vZGVsKSk7XG5cdFx0Y29uc3QgZGF0YSA9IG5ldyBNYXA8c3RyaW5nLCBEZWJ1Z1Byb3RvY29sLkJyZWFrcG9pbnQ+KCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYnJlYWtwb2ludHNbMF0ubGluZU51bWJlciwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJyZWFrcG9pbnRzWzFdLmxpbmVOdW1iZXIsIDEwKTtcblxuXHRcdGRhdGEuc2V0KGJyZWFrcG9pbnRzWzBdLmdldElkKCksIHsgdmVyaWZpZWQ6IGZhbHNlLCBsaW5lOiAxMCB9KTtcblx0XHRkYXRhLnNldChicmVha3BvaW50c1sxXS5nZXRJZCgpLCB7IHZlcmlmaWVkOiB0cnVlLCBsaW5lOiA1MCB9KTtcblx0XHRtb2RlbC5zZXRCcmVha3BvaW50U2Vzc2lvbkRhdGEoc2Vzc2lvbi5nZXRJZCgpLCB7fSwgZGF0YSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJyZWFrcG9pbnRzWzBdLmxpbmVOdW1iZXIsIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChicmVha3BvaW50c1sxXS5saW5lTnVtYmVyLCA1MCk7XG5cblx0XHRjb25zdCBzZXNzaW9uMiA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXN0U2Vzc2lvbihtb2RlbCkpO1xuXHRcdGNvbnN0IGRhdGEyID0gbmV3IE1hcDxzdHJpbmcsIERlYnVnUHJvdG9jb2wuQnJlYWtwb2ludD4oKTtcblx0XHRkYXRhMi5zZXQoYnJlYWtwb2ludHNbMF0uZ2V0SWQoKSwgeyB2ZXJpZmllZDogdHJ1ZSwgbGluZTogMTAwIH0pO1xuXHRcdGRhdGEyLnNldChicmVha3BvaW50c1sxXS5nZXRJZCgpLCB7IHZlcmlmaWVkOiB0cnVlLCBsaW5lOiA1MDAgfSk7XG5cdFx0bW9kZWwuc2V0QnJlYWtwb2ludFNlc3Npb25EYXRhKHNlc3Npb24yLmdldElkKCksIHt9LCBkYXRhMik7XG5cblx0XHQvLyBCcmVha3BvaW50IGlzIHZlcmlmaWVkIG9ubHkgb25jZSwgc2hvdyB0aGF0IGxpbmVcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYnJlYWtwb2ludHNbMF0ubGluZU51bWJlciwgMTAwKTtcblx0XHQvLyBCcmVha3BvaW50IGlzIHZlcmlmaWVkIHR3byB0aW1lcywgc2hvdyB0aGUgb3JpZ2luYWwgbGluZVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChicmVha3BvaW50c1sxXS5saW5lTnVtYmVyLCAxMCk7XG5cblx0XHRtb2RlbC5zZXRCcmVha3BvaW50U2Vzc2lvbkRhdGEoc2Vzc2lvbi5nZXRJZCgpLCB7fSwgdW5kZWZpbmVkKTtcblx0XHQvLyBObyBtb3JlIGRvdWJsZSBzZXNzaW9uIHZlcmlmaWNhdGlvblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChicmVha3BvaW50c1swXS5saW5lTnVtYmVyLCAxMDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChicmVha3BvaW50c1sxXS5saW5lTnVtYmVyLCA1MDApO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJyZWFrcG9pbnRzWzBdLnN1cHBvcnRlZCwgZmFsc2UpO1xuXHRcdGNvbnN0IGRhdGEzID0gbmV3IE1hcDxzdHJpbmcsIERlYnVnUHJvdG9jb2wuQnJlYWtwb2ludD4oKTtcblx0XHRkYXRhMy5zZXQoYnJlYWtwb2ludHNbMF0uZ2V0SWQoKSwgeyB2ZXJpZmllZDogdHJ1ZSwgbGluZTogNTAwIH0pO1xuXHRcdG1vZGVsLnNldEJyZWFrcG9pbnRTZXNzaW9uRGF0YShzZXNzaW9uMi5nZXRJZCgpLCB7IHN1cHBvcnRzQ29uZGl0aW9uYWxCcmVha3BvaW50czogdHJ1ZSB9LCBkYXRhMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJyZWFrcG9pbnRzWzBdLnN1cHBvcnRlZCwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4Y2VwdGlvbiBicmVha3BvaW50cycsICgpID0+IHtcblx0XHRsZXQgZXZlbnRDb3VudCA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsLm9uRGlkQ2hhbmdlQnJlYWtwb2ludHMoKCkgPT4gZXZlbnRDb3VudCsrKSk7XG5cdFx0bW9kZWwuc2V0RXhjZXB0aW9uQnJlYWtwb2ludHNGb3JTZXNzaW9uKFwic2Vzc2lvbi1pZC0xXCIsIFt7IGZpbHRlcjogJ3VuY2F1Z2h0JywgbGFiZWw6ICdVTkNBVUdIVCcsIGRlZmF1bHQ6IHRydWUgfV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50LCAxKTtcblx0XHRsZXQgZXhjZXB0aW9uQnJlYWtwb2ludHMgPSBtb2RlbC5nZXRFeGNlcHRpb25CcmVha3BvaW50c0ZvclNlc3Npb24oXCJzZXNzaW9uLWlkLTFcIik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4Y2VwdGlvbkJyZWFrcG9pbnRzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4Y2VwdGlvbkJyZWFrcG9pbnRzWzBdLmZpbHRlciwgJ3VuY2F1Z2h0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4Y2VwdGlvbkJyZWFrcG9pbnRzWzBdLmVuYWJsZWQsIHRydWUpO1xuXG5cdFx0bW9kZWwuc2V0RXhjZXB0aW9uQnJlYWtwb2ludHNGb3JTZXNzaW9uKFwic2Vzc2lvbi1pZC0yXCIsIFt7IGZpbHRlcjogJ3VuY2F1Z2h0JywgbGFiZWw6ICdVTkNBVUdIVCcgfSwgeyBmaWx0ZXI6ICdjYXVnaHQnLCBsYWJlbDogJ0NBVUdIVCcgfV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50LCAyKTtcblx0XHRleGNlcHRpb25CcmVha3BvaW50cyA9IG1vZGVsLmdldEV4Y2VwdGlvbkJyZWFrcG9pbnRzRm9yU2Vzc2lvbihcInNlc3Npb24taWQtMlwiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhjZXB0aW9uQnJlYWtwb2ludHMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhjZXB0aW9uQnJlYWtwb2ludHNbMF0uZmlsdGVyLCAndW5jYXVnaHQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhjZXB0aW9uQnJlYWtwb2ludHNbMF0uZW5hYmxlZCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4Y2VwdGlvbkJyZWFrcG9pbnRzWzFdLmZpbHRlciwgJ2NhdWdodCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGNlcHRpb25CcmVha3BvaW50c1sxXS5sYWJlbCwgJ0NBVUdIVCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGNlcHRpb25CcmVha3BvaW50c1sxXS5lbmFibGVkLCBmYWxzZSk7XG5cblx0XHRtb2RlbC5zZXRFeGNlcHRpb25CcmVha3BvaW50c0ZvclNlc3Npb24oXCJzZXNzaW9uLWlkLTNcIiwgW3sgZmlsdGVyOiAnYWxsJywgbGFiZWw6ICdBTEwnIH1dKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRDb3VudCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldEV4Y2VwdGlvbkJyZWFrcG9pbnRzRm9yU2Vzc2lvbihcInNlc3Npb24taWQtM1wiKS5sZW5ndGgsIDEpO1xuXHRcdGV4Y2VwdGlvbkJyZWFrcG9pbnRzID0gbW9kZWwuZ2V0RXhjZXB0aW9uQnJlYWtwb2ludHMoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhjZXB0aW9uQnJlYWtwb2ludHNbMF0uZmlsdGVyLCAndW5jYXVnaHQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhjZXB0aW9uQnJlYWtwb2ludHNbMF0uZW5hYmxlZCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4Y2VwdGlvbkJyZWFrcG9pbnRzWzFdLmZpbHRlciwgJ2NhdWdodCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGNlcHRpb25CcmVha3BvaW50c1sxXS5sYWJlbCwgJ0NBVUdIVCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGNlcHRpb25CcmVha3BvaW50c1sxXS5lbmFibGVkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4Y2VwdGlvbkJyZWFrcG9pbnRzWzJdLmZpbHRlciwgJ2FsbCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGNlcHRpb25CcmVha3BvaW50c1syXS5sYWJlbCwgJ0FMTCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdleGNlcHRpb24gYnJlYWtwb2ludHMgbXVsdGlwbGUgc2Vzc2lvbnMnLCAoKSA9PiB7XG5cdFx0bGV0IGV2ZW50Q291bnQgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbC5vbkRpZENoYW5nZUJyZWFrcG9pbnRzKCgpID0+IGV2ZW50Q291bnQrKykpO1xuXG5cdFx0bW9kZWwuc2V0RXhjZXB0aW9uQnJlYWtwb2ludHNGb3JTZXNzaW9uKFwic2Vzc2lvbi1pZC00XCIsIFt7IGZpbHRlcjogJ3VuY2F1Z2h0JywgbGFiZWw6ICdVTkNBVUdIVCcsIGRlZmF1bHQ6IHRydWUgfSwgeyBmaWx0ZXI6ICdjYXVnaHQnLCBsYWJlbDogJ0NBVUdIVCcgfV0pO1xuXHRcdG1vZGVsLnNldEV4Y2VwdGlvbkJyZWFrcG9pbnRGYWxsYmFja1Nlc3Npb24oXCJzZXNzaW9uLWlkLTRcIik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Q291bnQsIDEpO1xuXHRcdGxldCBleGNlcHRpb25CcmVha3BvaW50c0ZvclNlc3Npb24gPSBtb2RlbC5nZXRFeGNlcHRpb25CcmVha3BvaW50c0ZvclNlc3Npb24oXCJzZXNzaW9uLWlkLTRcIik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4Y2VwdGlvbkJyZWFrcG9pbnRzRm9yU2Vzc2lvbi5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGNlcHRpb25CcmVha3BvaW50c0ZvclNlc3Npb25bMF0uZmlsdGVyLCAndW5jYXVnaHQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhjZXB0aW9uQnJlYWtwb2ludHNGb3JTZXNzaW9uWzFdLmZpbHRlciwgJ2NhdWdodCcpO1xuXG5cdFx0bW9kZWwuc2V0RXhjZXB0aW9uQnJlYWtwb2ludHNGb3JTZXNzaW9uKFwic2Vzc2lvbi1pZC01XCIsIFt7IGZpbHRlcjogJ2FsbCcsIGxhYmVsOiAnQUxMJyB9LCB7IGZpbHRlcjogJ2NhdWdodCcsIGxhYmVsOiAnQ0FVR0hUJyB9XSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Q291bnQsIDIpO1xuXHRcdGV4Y2VwdGlvbkJyZWFrcG9pbnRzRm9yU2Vzc2lvbiA9IG1vZGVsLmdldEV4Y2VwdGlvbkJyZWFrcG9pbnRzRm9yU2Vzc2lvbihcInNlc3Npb24taWQtNVwiKTtcblx0XHRsZXQgZXhjZXB0aW9uQnJlYWtwb2ludHNGb3JVbmRlZmluZWQgPSBtb2RlbC5nZXRFeGNlcHRpb25CcmVha3BvaW50c0ZvclNlc3Npb24odW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhjZXB0aW9uQnJlYWtwb2ludHNGb3JTZXNzaW9uLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4Y2VwdGlvbkJyZWFrcG9pbnRzRm9yU2Vzc2lvblswXS5maWx0ZXIsICdjYXVnaHQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhjZXB0aW9uQnJlYWtwb2ludHNGb3JTZXNzaW9uWzFdLmZpbHRlciwgJ2FsbCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGNlcHRpb25CcmVha3BvaW50c0ZvclVuZGVmaW5lZC5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGNlcHRpb25CcmVha3BvaW50c0ZvclVuZGVmaW5lZFswXS5maWx0ZXIsICd1bmNhdWdodCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGNlcHRpb25CcmVha3BvaW50c0ZvclVuZGVmaW5lZFsxXS5maWx0ZXIsICdjYXVnaHQnKTtcblxuXHRcdG1vZGVsLnJlbW92ZUV4Y2VwdGlvbkJyZWFrcG9pbnRzRm9yU2Vzc2lvbihcInNlc3Npb24taWQtNFwiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRDb3VudCwgMik7XG5cdFx0ZXhjZXB0aW9uQnJlYWtwb2ludHNGb3JVbmRlZmluZWQgPSBtb2RlbC5nZXRFeGNlcHRpb25CcmVha3BvaW50c0ZvclNlc3Npb24odW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhjZXB0aW9uQnJlYWtwb2ludHNGb3JVbmRlZmluZWQubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhjZXB0aW9uQnJlYWtwb2ludHNGb3JVbmRlZmluZWRbMF0uZmlsdGVyLCAndW5jYXVnaHQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhjZXB0aW9uQnJlYWtwb2ludHNGb3JVbmRlZmluZWRbMV0uZmlsdGVyLCAnY2F1Z2h0Jyk7XG5cblx0XHRtb2RlbC5zZXRFeGNlcHRpb25CcmVha3BvaW50RmFsbGJhY2tTZXNzaW9uKFwic2Vzc2lvbi1pZC01XCIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50LCAyKTtcblx0XHRleGNlcHRpb25CcmVha3BvaW50c0ZvclVuZGVmaW5lZCA9IG1vZGVsLmdldEV4Y2VwdGlvbkJyZWFrcG9pbnRzRm9yU2Vzc2lvbih1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGNlcHRpb25CcmVha3BvaW50c0ZvclVuZGVmaW5lZC5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGNlcHRpb25CcmVha3BvaW50c0ZvclVuZGVmaW5lZFswXS5maWx0ZXIsICdjYXVnaHQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhjZXB0aW9uQnJlYWtwb2ludHNGb3JVbmRlZmluZWRbMV0uZmlsdGVyLCAnYWxsJyk7XG5cblx0XHRjb25zdCBleGNlcHRpb25CcmVha3BvaW50cyA9IG1vZGVsLmdldEV4Y2VwdGlvbkJyZWFrcG9pbnRzKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4Y2VwdGlvbkJyZWFrcG9pbnRzLmxlbmd0aCwgMyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc3RydWN0aW9uIGJyZWFrcG9pbnRzJywgKCkgPT4ge1xuXHRcdGxldCBldmVudENvdW50ID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwub25EaWRDaGFuZ2VCcmVha3BvaW50cygoKSA9PiBldmVudENvdW50KyspKTtcblx0XHQvL2FkZHJlc3M6IHN0cmluZywgb2Zmc2V0OiBudW1iZXIsIGNvbmRpdGlvbj86IHN0cmluZywgaGl0Q29uZGl0aW9uPzogc3RyaW5nXG5cdFx0bW9kZWwuYWRkSW5zdHJ1Y3Rpb25CcmVha3BvaW50KHsgaW5zdHJ1Y3Rpb25SZWZlcmVuY2U6ICcweENDQ0NGRkZGJywgb2Zmc2V0OiAwLCBhZGRyZXNzOiAwbiwgY2FuUGVyc2lzdDogZmFsc2UgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRDb3VudCwgMSk7XG5cdFx0bGV0IGluc3RydWN0aW9uQnJlYWtwb2ludHMgPSBtb2RlbC5nZXRJbnN0cnVjdGlvbkJyZWFrcG9pbnRzKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluc3RydWN0aW9uQnJlYWtwb2ludHMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdHJ1Y3Rpb25CcmVha3BvaW50c1swXS5pbnN0cnVjdGlvblJlZmVyZW5jZSwgJzB4Q0NDQ0ZGRkYnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdHJ1Y3Rpb25CcmVha3BvaW50c1swXS5vZmZzZXQsIDApO1xuXG5cdFx0bW9kZWwuYWRkSW5zdHJ1Y3Rpb25CcmVha3BvaW50KHsgaW5zdHJ1Y3Rpb25SZWZlcmVuY2U6ICcweENDQ0NFRUVFJywgb2Zmc2V0OiAxLCBhZGRyZXNzOiAwbiwgY2FuUGVyc2lzdDogZmFsc2UgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Q291bnQsIDIpO1xuXHRcdGluc3RydWN0aW9uQnJlYWtwb2ludHMgPSBtb2RlbC5nZXRJbnN0cnVjdGlvbkJyZWFrcG9pbnRzKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluc3RydWN0aW9uQnJlYWtwb2ludHMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdHJ1Y3Rpb25CcmVha3BvaW50c1swXS5pbnN0cnVjdGlvblJlZmVyZW5jZSwgJzB4Q0NDQ0ZGRkYnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdHJ1Y3Rpb25CcmVha3BvaW50c1swXS5vZmZzZXQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnN0cnVjdGlvbkJyZWFrcG9pbnRzWzFdLmluc3RydWN0aW9uUmVmZXJlbmNlLCAnMHhDQ0NDRUVFRScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnN0cnVjdGlvbkJyZWFrcG9pbnRzWzFdLm9mZnNldCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RhdGEgYnJlYWtwb2ludHMnLCAoKSA9PiB7XG5cdFx0bGV0IGV2ZW50Q291bnQgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbC5vbkRpZENoYW5nZUJyZWFrcG9pbnRzKCgpID0+IGV2ZW50Q291bnQrKykpO1xuXG5cdFx0bW9kZWwuYWRkRGF0YUJyZWFrcG9pbnQoeyBkZXNjcmlwdGlvbjogJ2xhYmVsJywgc3JjOiB7IHR5cGU6IERhdGFCcmVha3BvaW50U2V0VHlwZS5WYXJpYWJsZSwgZGF0YUlkOiAnaWQnIH0sIGNhblBlcnNpc3Q6IHRydWUsIGFjY2Vzc1R5cGVzOiBbJ3JlYWQnXSwgYWNjZXNzVHlwZTogJ3JlYWQnIH0sICcxJyk7XG5cdFx0bW9kZWwuYWRkRGF0YUJyZWFrcG9pbnQoeyBkZXNjcmlwdGlvbjogJ3NlY29uZCcsIHNyYzogeyB0eXBlOiBEYXRhQnJlYWtwb2ludFNldFR5cGUuVmFyaWFibGUsIGRhdGFJZDogJ3NlY29uZElkJyB9LCBjYW5QZXJzaXN0OiBmYWxzZSwgYWNjZXNzVHlwZXM6IFsncmVhZFdyaXRlJ10sIGFjY2Vzc1R5cGU6ICdyZWFkV3JpdGUnIH0sICcyJyk7XG5cdFx0bW9kZWwudXBkYXRlRGF0YUJyZWFrcG9pbnQoJzEnLCB7IGNvbmRpdGlvbjogJ2FDb25kaXRpb24nIH0pO1xuXHRcdG1vZGVsLnVwZGF0ZURhdGFCcmVha3BvaW50KCcyJywgeyBoaXRDb25kaXRpb246ICcxMCcgfSk7XG5cdFx0Y29uc3QgZGF0YUJyZWFrcG9pbnRzID0gbW9kZWwuZ2V0RGF0YUJyZWFrcG9pbnRzKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRhdGFCcmVha3BvaW50c1swXS5jYW5QZXJzaXN0LCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGRhdGFCcmVha3BvaW50c1swXS5zcmMsIHsgdHlwZTogRGF0YUJyZWFrcG9pbnRTZXRUeXBlLlZhcmlhYmxlLCBkYXRhSWQ6ICdpZCcgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRhdGFCcmVha3BvaW50c1swXS5hY2Nlc3NUeXBlLCAncmVhZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkYXRhQnJlYWtwb2ludHNbMF0uY29uZGl0aW9uLCAnYUNvbmRpdGlvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkYXRhQnJlYWtwb2ludHNbMV0uY2FuUGVyc2lzdCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkYXRhQnJlYWtwb2ludHNbMV0uZGVzY3JpcHRpb24sICdzZWNvbmQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGF0YUJyZWFrcG9pbnRzWzFdLmFjY2Vzc1R5cGUsICdyZWFkV3JpdGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGF0YUJyZWFrcG9pbnRzWzFdLmhpdENvbmRpdGlvbiwgJzEwJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRDb3VudCwgNCk7XG5cblx0XHRtb2RlbC5yZW1vdmVEYXRhQnJlYWtwb2ludHMoZGF0YUJyZWFrcG9pbnRzWzBdLmdldElkKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50LCA1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0RGF0YUJyZWFrcG9pbnRzKCkubGVuZ3RoLCAxKTtcblxuXHRcdG1vZGVsLnJlbW92ZURhdGFCcmVha3BvaW50cygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXREYXRhQnJlYWtwb2ludHMoKS5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50LCA2KTtcblx0fSk7XG5cblx0dGVzdCgnbWVzc2FnZSBhbmQgY2xhc3MgbmFtZScsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbFVyaSA9IHVyaS5maWxlKCcvbXlmb2xkZXIvbXkgZmlsZSBmaXJzdC5qcycpO1xuXHRcdGFkZEJyZWFrcG9pbnRzQW5kQ2hlY2tFdmVudHMobW9kZWwsIG1vZGVsVXJpLCBbXG5cdFx0XHR7IGxpbmVOdW1iZXI6IDUsIGVuYWJsZWQ6IHRydWUsIGNvbmRpdGlvbjogJ3ggPiA1JyB9LFxuXHRcdFx0eyBsaW5lTnVtYmVyOiAxMCwgZW5hYmxlZDogZmFsc2UgfSxcblx0XHRcdHsgbGluZU51bWJlcjogMTIsIGVuYWJsZWQ6IHRydWUsIGxvZ01lc3NhZ2U6ICdoZWxsbycgfSxcblx0XHRcdHsgbGluZU51bWJlcjogMTUsIGVuYWJsZWQ6IHRydWUsIGhpdENvbmRpdGlvbjogJzEyJyB9LFxuXHRcdFx0eyBsaW5lTnVtYmVyOiA1MDAsIGVuYWJsZWQ6IHRydWUgfSxcblx0XHRdKTtcblx0XHRjb25zdCBicmVha3BvaW50cyA9IG1vZGVsLmdldEJyZWFrcG9pbnRzKCk7XG5cdFx0Y29uc3QgbHMgPSBuZXcgTW9ja0xhYmVsU2VydmljZSgpO1xuXG5cdFx0bGV0IHJlc3VsdCA9IGdldEJyZWFrcG9pbnRNZXNzYWdlQW5kSWNvbihTdGF0ZS5TdG9wcGVkLCB0cnVlLCBicmVha3BvaW50c1swXSwgbHMsIG1vZGVsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lm1lc3NhZ2UsICdDb25kaXRpb246IHggPiA1Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pY29uLmlkLCAnZGVidWctYnJlYWtwb2ludC1jb25kaXRpb25hbCcpO1xuXG5cdFx0cmVzdWx0ID0gZ2V0QnJlYWtwb2ludE1lc3NhZ2VBbmRJY29uKFN0YXRlLlN0b3BwZWQsIHRydWUsIGJyZWFrcG9pbnRzWzFdLCBscywgbW9kZWwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubWVzc2FnZSwgJ0Rpc2FibGVkIEJyZWFrcG9pbnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmljb24uaWQsICdkZWJ1Zy1icmVha3BvaW50LWRpc2FibGVkJyk7XG5cblx0XHRyZXN1bHQgPSBnZXRCcmVha3BvaW50TWVzc2FnZUFuZEljb24oU3RhdGUuU3RvcHBlZCwgdHJ1ZSwgYnJlYWtwb2ludHNbMl0sIGxzLCBtb2RlbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5tZXNzYWdlLCAnTG9nIE1lc3NhZ2U6IGhlbGxvJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pY29uLmlkLCAnZGVidWctYnJlYWtwb2ludC1sb2cnKTtcblxuXHRcdHJlc3VsdCA9IGdldEJyZWFrcG9pbnRNZXNzYWdlQW5kSWNvbihTdGF0ZS5TdG9wcGVkLCB0cnVlLCBicmVha3BvaW50c1szXSwgbHMsIG1vZGVsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lm1lc3NhZ2UsICdIaXQgQ291bnQ6IDEyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pY29uLmlkLCAnZGVidWctYnJlYWtwb2ludC1jb25kaXRpb25hbCcpO1xuXG5cdFx0cmVzdWx0ID0gZ2V0QnJlYWtwb2ludE1lc3NhZ2VBbmRJY29uKFN0YXRlLlN0b3BwZWQsIHRydWUsIGJyZWFrcG9pbnRzWzRdLCBscywgbW9kZWwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubWVzc2FnZSwgbHMuZ2V0VXJpTGFiZWwoYnJlYWtwb2ludHNbNF0udXJpKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pY29uLmlkLCAnZGVidWctYnJlYWtwb2ludCcpO1xuXG5cdFx0cmVzdWx0ID0gZ2V0QnJlYWtwb2ludE1lc3NhZ2VBbmRJY29uKFN0YXRlLlN0b3BwZWQsIGZhbHNlLCBicmVha3BvaW50c1syXSwgbHMsIG1vZGVsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lm1lc3NhZ2UsICdEaXNhYmxlZCBMb2dwb2ludCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaWNvbi5pZCwgJ2RlYnVnLWJyZWFrcG9pbnQtbG9nLWRpc2FibGVkJyk7XG5cblx0XHRtb2RlbC5hZGREYXRhQnJlYWtwb2ludCh7IGRlc2NyaXB0aW9uOiAnbGFiZWwnLCBjYW5QZXJzaXN0OiB0cnVlLCBhY2Nlc3NUeXBlczogWydyZWFkJ10sIGFjY2Vzc1R5cGU6ICdyZWFkJywgc3JjOiB7IHR5cGU6IERhdGFCcmVha3BvaW50U2V0VHlwZS5WYXJpYWJsZSwgZGF0YUlkOiAnaWQnIH0gfSk7XG5cdFx0Y29uc3QgZGF0YUJyZWFrcG9pbnRzID0gbW9kZWwuZ2V0RGF0YUJyZWFrcG9pbnRzKCk7XG5cdFx0cmVzdWx0ID0gZ2V0QnJlYWtwb2ludE1lc3NhZ2VBbmRJY29uKFN0YXRlLlN0b3BwZWQsIHRydWUsIGRhdGFCcmVha3BvaW50c1swXSwgbHMsIG1vZGVsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lm1lc3NhZ2UsICdEYXRhIEJyZWFrcG9pbnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmljb24uaWQsICdkZWJ1Zy1icmVha3BvaW50LWRhdGEnKTtcblxuXHRcdGNvbnN0IGZ1bmN0aW9uQnJlYWtwb2ludCA9IG1vZGVsLmFkZEZ1bmN0aW9uQnJlYWtwb2ludCh7IG5hbWU6ICdmb28nIH0sICcxJyk7XG5cdFx0cmVzdWx0ID0gZ2V0QnJlYWtwb2ludE1lc3NhZ2VBbmRJY29uKFN0YXRlLlN0b3BwZWQsIHRydWUsIGZ1bmN0aW9uQnJlYWtwb2ludCwgbHMsIG1vZGVsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lm1lc3NhZ2UsICdGdW5jdGlvbiBCcmVha3BvaW50Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pY29uLmlkLCAnZGVidWctYnJlYWtwb2ludC1mdW5jdGlvbicpO1xuXG5cdFx0Y29uc3QgZGF0YSA9IG5ldyBNYXA8c3RyaW5nLCBEZWJ1Z1Byb3RvY29sLkJyZWFrcG9pbnQ+KCk7XG5cdFx0ZGF0YS5zZXQoYnJlYWtwb2ludHNbMF0uZ2V0SWQoKSwgeyB2ZXJpZmllZDogZmFsc2UsIGxpbmU6IDEwIH0pO1xuXHRcdGRhdGEuc2V0KGJyZWFrcG9pbnRzWzFdLmdldElkKCksIHsgdmVyaWZpZWQ6IHRydWUsIGxpbmU6IDUwIH0pO1xuXHRcdGRhdGEuc2V0KGJyZWFrcG9pbnRzWzJdLmdldElkKCksIHsgdmVyaWZpZWQ6IHRydWUsIGxpbmU6IDUwLCBtZXNzYWdlOiAnd29ybGQnIH0pO1xuXHRcdGRhdGEuc2V0KGZ1bmN0aW9uQnJlYWtwb2ludC5nZXRJZCgpLCB7IHZlcmlmaWVkOiB0cnVlIH0pO1xuXHRcdG1vZGVsLnNldEJyZWFrcG9pbnRTZXNzaW9uRGF0YSgnbW9ja3Nlc3Npb25pZCcsIHsgc3VwcG9ydHNGdW5jdGlvbkJyZWFrcG9pbnRzOiBmYWxzZSwgc3VwcG9ydHNEYXRhQnJlYWtwb2ludHM6IHRydWUsIHN1cHBvcnRzTG9nUG9pbnRzOiB0cnVlIH0sIGRhdGEpO1xuXG5cdFx0cmVzdWx0ID0gZ2V0QnJlYWtwb2ludE1lc3NhZ2VBbmRJY29uKFN0YXRlLlN0b3BwZWQsIHRydWUsIGJyZWFrcG9pbnRzWzBdLCBscywgbW9kZWwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubWVzc2FnZSwgJ1VudmVyaWZpZWQgQnJlYWtwb2ludCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaWNvbi5pZCwgJ2RlYnVnLWJyZWFrcG9pbnQtdW52ZXJpZmllZCcpO1xuXG5cdFx0cmVzdWx0ID0gZ2V0QnJlYWtwb2ludE1lc3NhZ2VBbmRJY29uKFN0YXRlLlN0b3BwZWQsIHRydWUsIGZ1bmN0aW9uQnJlYWtwb2ludCwgbHMsIG1vZGVsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lm1lc3NhZ2UsICdGdW5jdGlvbiBicmVha3BvaW50cyBub3Qgc3VwcG9ydGVkIGJ5IHRoaXMgZGVidWcgdHlwZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaWNvbi5pZCwgJ2RlYnVnLWJyZWFrcG9pbnQtZnVuY3Rpb24tdW52ZXJpZmllZCcpO1xuXG5cdFx0cmVzdWx0ID0gZ2V0QnJlYWtwb2ludE1lc3NhZ2VBbmRJY29uKFN0YXRlLlN0b3BwZWQsIHRydWUsIGJyZWFrcG9pbnRzWzJdLCBscywgbW9kZWwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubWVzc2FnZSwgJ0xvZyBNZXNzYWdlOiBoZWxsbywgd29ybGQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmljb24uaWQsICdkZWJ1Zy1icmVha3BvaW50LWxvZycpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWNvcmF0aW9ucycsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbFVyaSA9IHVyaS5maWxlKCcvbXlmb2xkZXIvbXkgZmlsZSBmaXJzdC5qcycpO1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSAndGVzdE1vZGUnO1xuXHRcdGNvbnN0IHRleHRNb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFsndGhpcyBpcyBsaW5lIG9uZScsICd0aGlzIGlzIGxpbmUgdHdvJywgJyAgICB0aGlzIGlzIGxpbmUgdGhyZWUgaXQgaGFzIHdoaXRlc3BhY2UgYXQgc3RhcnQnLCAndGhpcyBpcyBsaW5lIGZvdXInLCAndGhpcyBpcyBsaW5lIGZpdmUnXS5qb2luKCdcXG4nKSxcblx0XHRcdGxhbmd1YWdlSWRcblx0XHQpO1xuXHRcdGFkZEJyZWFrcG9pbnRzQW5kQ2hlY2tFdmVudHMobW9kZWwsIG1vZGVsVXJpLCBbXG5cdFx0XHR7IGxpbmVOdW1iZXI6IDEsIGVuYWJsZWQ6IHRydWUsIGNvbmRpdGlvbjogJ3ggPiA1JyB9LFxuXHRcdFx0eyBsaW5lTnVtYmVyOiAyLCBjb2x1bW46IDQsIGVuYWJsZWQ6IGZhbHNlIH0sXG5cdFx0XHR7IGxpbmVOdW1iZXI6IDMsIGVuYWJsZWQ6IHRydWUsIGxvZ01lc3NhZ2U6ICdoZWxsbycgfSxcblx0XHRcdHsgbGluZU51bWJlcjogNTAwLCBlbmFibGVkOiB0cnVlIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgYnJlYWtwb2ludHMgPSBtb2RlbC5nZXRCcmVha3BvaW50cygpO1xuXG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCk7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gbmV3IE1vY2tEZWJ1Z1NlcnZpY2UoKTtcblx0XHRkZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwgPSAoKSA9PiBtb2RlbDtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElEZWJ1Z1NlcnZpY2UsIGRlYnVnU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTGFiZWxTZXJ2aWNlLCBuZXcgTW9ja0xhYmVsU2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElMYW5ndWFnZVNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgTGFuZ3VhZ2VTZXJ2aWNlKCkpKTtcblx0XHRsZXQgZGVjb3JhdGlvbnMgPSBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBjcmVhdGVCcmVha3BvaW50RGVjb3JhdGlvbnMoYWNjZXNzb3IsIHRleHRNb2RlbCwgYnJlYWtwb2ludHMsIFN0YXRlLlJ1bm5pbmcsIHRydWUsIHRydWUpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVjb3JhdGlvbnMubGVuZ3RoLCAzKTsgLy8gbGFzdCBicmVha3BvaW50IGZpbHRlcmVkIG91dCBzaW5jZSBpdCBoYXMgYSBsYXJnZSBsaW5lIG51bWJlclxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGVjb3JhdGlvbnNbMF0ucmFuZ2UsIG5ldyBSYW5nZSgxLCAxLCAxLCAyKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChkZWNvcmF0aW9uc1sxXS5yYW5nZSwgbmV3IFJhbmdlKDIsIDQsIDIsIDUpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGRlY29yYXRpb25zWzJdLnJhbmdlLCBuZXcgUmFuZ2UoMywgNSwgMywgNikpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWNvcmF0aW9uc1swXS5vcHRpb25zLmJlZm9yZUNvbnRlbnRDbGFzc05hbWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlY29yYXRpb25zWzFdLm9wdGlvbnMuYmVmb3JlPy5pbmxpbmVDbGFzc05hbWUsIGBkZWJ1Zy1icmVha3BvaW50LXBsYWNlaG9sZGVyYCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlY29yYXRpb25zWzBdLm9wdGlvbnMub3ZlcnZpZXdSdWxlcj8ucG9zaXRpb24sIE92ZXJ2aWV3UnVsZXJMYW5lLkxlZnQpO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gbmV3IE1hcmtkb3duU3RyaW5nKHVuZGVmaW5lZCwgeyBpc1RydXN0ZWQ6IHRydWUsIHN1cHBvcnRUaGVtZUljb25zOiB0cnVlIH0pLmFwcGVuZENvZGVibG9jayhsYW5ndWFnZUlkLCAnQ29uZGl0aW9uOiB4ID4gNScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGVjb3JhdGlvbnNbMF0ub3B0aW9ucy5nbHlwaE1hcmdpbkhvdmVyTWVzc2FnZSwgZXhwZWN0ZWQpO1xuXG5cdFx0ZGVjb3JhdGlvbnMgPSBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBjcmVhdGVCcmVha3BvaW50RGVjb3JhdGlvbnMoYWNjZXNzb3IsIHRleHRNb2RlbCwgYnJlYWtwb2ludHMsIFN0YXRlLlJ1bm5pbmcsIHRydWUsIGZhbHNlKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlY29yYXRpb25zWzBdLm9wdGlvbnMub3ZlcnZpZXdSdWxlciwgbnVsbCk7XG5cblx0XHR0ZXh0TW9kZWwuZGlzcG9zZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlcyB3aGVuIHN0b3JhZ2UgY2hhbmdlcycsICgpID0+IHtcblx0XHRjb25zdCBzdG9yYWdlMSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IGRlYnVnU3RvcmFnZTEgPSBkaXNwb3NhYmxlcy5hZGQobmV3IE1vY2tEZWJ1Z1N0b3JhZ2Uoc3RvcmFnZTEpKTtcblx0XHRjb25zdCBtb2RlbDEgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERlYnVnTW9kZWwoZGVidWdTdG9yYWdlMSwgPGFueT57IGlzRGlydHk6IChlOiBhbnkpID0+IGZhbHNlIH0sIG1vY2tVcmlJZGVudGl0eVNlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpKSk7XG5cblx0XHQvLyAxLiBjcmVhdGUgYnJlYWtwb2ludHMgaW4gdGhlIGZpcnN0IG1vZGVsXG5cdFx0Y29uc3QgbW9kZWxVcmkgPSB1cmkuZmlsZSgnL215Zm9sZGVyL215IGZpbGUgZmlyc3QuanMnKTtcblx0XHRjb25zdCBmaXJzdCA9IFtcblx0XHRcdHsgbGluZU51bWJlcjogMSwgZW5hYmxlZDogdHJ1ZSwgY29uZGl0aW9uOiAneCA+IDUnIH0sXG5cdFx0XHR7IGxpbmVOdW1iZXI6IDIsIGNvbHVtbjogNCwgZW5hYmxlZDogZmFsc2UgfSxcblx0XHRdO1xuXG5cdFx0YWRkQnJlYWtwb2ludHNBbmRDaGVja0V2ZW50cyhtb2RlbDEsIG1vZGVsVXJpLCBmaXJzdCk7XG5cdFx0ZGVidWdTdG9yYWdlMS5zdG9yZUJyZWFrcG9pbnRzKG1vZGVsMSk7XG5cdFx0Y29uc3Qgc3RvcmVkID0gc3RvcmFnZTEuZ2V0KCdkZWJ1Zy5icmVha3BvaW50JywgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cblx0XHQvLyAyLiBoeWRyYXRlIGEgbmV3IG1vZGVsIGFuZCBlbnN1cmUgZXh0ZXJuYWwgYnJlYWtwb2ludHMgZ2V0IGFwcGxpZWRcblx0XHRjb25zdCBzdG9yYWdlMiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IG1vZGVsMiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRGVidWdNb2RlbChkaXNwb3NhYmxlcy5hZGQobmV3IE1vY2tEZWJ1Z1N0b3JhZ2Uoc3RvcmFnZTIpKSwgPGFueT57IGlzRGlydHk6IChlOiBhbnkpID0+IGZhbHNlIH0sIG1vY2tVcmlJZGVudGl0eVNlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpKSk7XG5cdFx0c3RvcmFnZTIuc3RvcmUoJ2RlYnVnLmJyZWFrcG9pbnQnLCBzdG9yZWQsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuVVNFUiwgLyogZXh0ZXJuYWw9ICovIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwyLmdldEJyZWFrcG9pbnRzKCkubWFwKGIgPT4gYi5nZXRJZCgpKSwgbW9kZWwxLmdldEJyZWFrcG9pbnRzKCkubWFwKGIgPT4gYi5nZXRJZCgpKSk7XG5cblx0XHQvLyAzLiBlbnN1cmUgbm9uLWV4dGVybmFsIGNoYW5nZXMgYXJlIGlnbm9yZWRcblx0XHRzdG9yYWdlMi5zdG9yZSgnZGVidWcuYnJlYWtwb2ludCcsICdbXScsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuVVNFUiwgLyogZXh0ZXJuYWw9ICovIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsMi5nZXRCcmVha3BvaW50cygpLm1hcChiID0+IGIuZ2V0SWQoKSksIG1vZGVsMS5nZXRCcmVha3BvaW50cygpLm1hcChiID0+IGIuZ2V0SWQoKSkpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZUFBZTtBQUN4QixTQUFTLE9BQU8sV0FBVztBQUMzQixTQUFTLCtDQUErQztBQUN4RCxTQUFTLGFBQWE7QUFDdEIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxjQUFjLHFCQUFxQjtBQUM1QyxTQUFTLG1DQUFtQztBQUM1QyxTQUFTLDZCQUE2QiwyQkFBMkI7QUFDakUsU0FBUyx1QkFBK0QsZUFBZSxhQUFhO0FBQ3BHLFNBQVMsWUFBWSxrQkFBa0I7QUFDdkMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxzQkFBc0IsOEJBQThCO0FBQzdELFNBQVMsa0JBQWtCLHdCQUF3QjtBQUNuRCxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUVuQyxTQUFTLDZCQUE2QixPQUFtQkEsTUFBVSxNQUF5QjtBQUMzRixNQUFJLGFBQWE7QUFDakIsUUFBTSxZQUFZLE1BQU0sdUJBQXVCLE9BQUs7QUFDbkQsV0FBTyxZQUFZLEdBQUcsYUFBYSxLQUFLO0FBQ3hDLFdBQU8sWUFBWSxHQUFHLFNBQVMsTUFBUztBQUN4QyxXQUFPLFlBQVksR0FBRyxTQUFTLE1BQVM7QUFDeEMsVUFBTSxRQUFRLEdBQUc7QUFDakIsV0FBTyxlQUFlLE9BQU8sTUFBUztBQUN0QyxXQUFPLFlBQVksTUFBTyxRQUFRLEtBQUssTUFBTTtBQUM3QztBQUNBLFlBQVEsU0FBUztBQUNqQixhQUFTLElBQUksR0FBRyxJQUFJLEtBQUssUUFBUSxLQUFLO0FBQ3JDLGFBQU8sWUFBWSxFQUFFLE1BQU8sQ0FBQyxhQUFhLFlBQVksSUFBSTtBQUMxRCxhQUFPLFlBQWEsRUFBRSxNQUFPLENBQUMsRUFBaUIsWUFBWSxLQUFLLENBQUMsRUFBRSxVQUFVO0FBQUEsSUFDOUU7QUFBQSxFQUNELENBQUM7QUFDRCxRQUFNLE1BQU0sTUFBTSxlQUFlQSxNQUFLLElBQUk7QUFDMUMsU0FBTyxZQUFZLFlBQVksQ0FBQztBQUNoQyxTQUFPO0FBQ1I7QUFFQSxNQUFNLHVCQUF1QixNQUFNO0FBQ2xDLE1BQUk7QUFDSixRQUFNLGNBQWMsd0NBQXdDO0FBRTVELFFBQU0sTUFBTTtBQUNYLFlBQVEscUJBQXFCLFdBQVc7QUFBQSxFQUN6QyxDQUFDO0FBSUQsT0FBSyxVQUFVLE1BQU07QUFDcEIsVUFBTSxXQUFXLElBQUksS0FBSyxxQkFBcUI7QUFFL0MsaUNBQTZCLE9BQU8sVUFBVSxDQUFDLEVBQUUsWUFBWSxHQUFHLFNBQVMsS0FBSyxHQUFHLEVBQUUsWUFBWSxJQUFJLFNBQVMsTUFBTSxDQUFDLENBQUM7QUFDcEgsV0FBTyxZQUFZLE1BQU0sd0JBQXdCLEdBQUcsSUFBSTtBQUN4RCxXQUFPLFlBQVksTUFBTSxlQUFlLEVBQUUsUUFBUSxDQUFDO0FBRW5ELFFBQUksYUFBYTtBQUNqQixVQUFNLFlBQVksTUFBTSx1QkFBdUIsT0FBSztBQUNuRDtBQUNBLGFBQU8sWUFBWSxHQUFHLE9BQU8sTUFBUztBQUN0QyxhQUFPLFlBQVksR0FBRyxhQUFhLEtBQUs7QUFDeEMsYUFBTyxZQUFZLEdBQUcsU0FBUyxRQUFRLENBQUM7QUFDeEMsYUFBTyxZQUFZLEdBQUcsU0FBUyxNQUFTO0FBRXhDLGNBQVEsU0FBUztBQUFBLElBQ2xCLENBQUM7QUFFRCxVQUFNLGtCQUFrQixNQUFNLGVBQWUsQ0FBQztBQUM5QyxXQUFPLFlBQVksWUFBWSxDQUFDO0FBQ2hDLFdBQU8sWUFBWSxNQUFNLGVBQWUsRUFBRSxRQUFRLENBQUM7QUFBQSxFQUNwRCxDQUFDO0FBRUQsT0FBSyxZQUFZLE1BQU07QUFDdEIsVUFBTSxXQUFXLElBQUksS0FBSyxxQkFBcUI7QUFFL0MsaUNBQTZCLE9BQU8sVUFBVSxDQUFDLEVBQUUsWUFBWSxHQUFHLFNBQVMsS0FBSyxHQUFHLEVBQUUsWUFBWSxJQUFJLFNBQVMsTUFBTSxDQUFDLENBQUM7QUFDcEgsaUNBQTZCLE9BQU8sVUFBVSxDQUFDLEVBQUUsWUFBWSxJQUFJLFNBQVMsTUFBTSxXQUFXLGlCQUFpQixDQUFDLENBQUM7QUFDOUcsV0FBTyxZQUFZLE1BQU0sZUFBZSxFQUFFLFFBQVEsQ0FBQztBQUNuRCxVQUFNLEtBQUssTUFBTSxlQUFlLEVBQUUsSUFBSTtBQUN0QyxRQUFJLElBQUk7QUFDUCxZQUFNLGtCQUFrQixDQUFDLEVBQUUsQ0FBQztBQUFBLElBQzdCO0FBQ0EsV0FBTyxZQUFZLE1BQU0sZUFBZSxFQUFFLFFBQVEsQ0FBQztBQUVuRCxVQUFNLHdCQUF3QixLQUFLO0FBQ25DLFdBQU8sWUFBWSxNQUFNLHdCQUF3QixHQUFHLEtBQUs7QUFDekQsVUFBTSx3QkFBd0IsSUFBSTtBQUNsQyxXQUFPLFlBQVksTUFBTSx3QkFBd0IsR0FBRyxJQUFJO0FBQUEsRUFDekQsQ0FBQztBQUVELE9BQUssYUFBYSxNQUFNO0FBQ3ZCLFVBQU0sWUFBWSxJQUFJLEtBQUssNEJBQTRCO0FBQ3ZELFVBQU0sWUFBWSxJQUFJLEtBQUsscUNBQXFDO0FBQ2hFLGlDQUE2QixPQUFPLFdBQVcsQ0FBQyxFQUFFLFlBQVksR0FBRyxTQUFTLEtBQUssR0FBRyxFQUFFLFlBQVksSUFBSSxTQUFTLE1BQU0sQ0FBQyxDQUFDO0FBQ3JILFdBQU8sWUFBWSxvQkFBb0IsT0FBTyxRQUFXLENBQUMsR0FBRyxFQUFFO0FBRS9ELGlDQUE2QixPQUFPLFdBQVcsQ0FBQyxFQUFFLFlBQVksR0FBRyxTQUFTLEtBQUssR0FBRyxFQUFFLFlBQVksR0FBRyxTQUFTLEtBQUssR0FBRyxFQUFFLFlBQVksR0FBRyxTQUFTLE1BQU0sQ0FBQyxDQUFDO0FBQ3RKLFdBQU8sWUFBWSxvQkFBb0IsT0FBTyxRQUFXLENBQUMsR0FBRyxHQUFHO0FBRWhFLFdBQU8sWUFBWSxNQUFNLGVBQWUsRUFBRSxRQUFRLENBQUM7QUFDbkQsV0FBTyxZQUFZLE1BQU0sZUFBZSxFQUFFLEtBQUssVUFBVSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQ3JFLFdBQU8sWUFBWSxNQUFNLGVBQWUsRUFBRSxLQUFLLFVBQVUsQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUNyRSxXQUFPLFlBQVksTUFBTSxlQUFlLEVBQUUsWUFBWSxFQUFFLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDcEUsV0FBTyxZQUFZLE1BQU0sZUFBZSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBRWhFLFVBQU0sS0FBSyxNQUFNLGVBQWUsRUFBRSxDQUFDO0FBQ25DLFVBQU0sU0FBUyxvQkFBSSxJQUFtQztBQUN0RCxXQUFPLElBQUksR0FBRyxNQUFNLEdBQUcsRUFBRSxZQUFZLElBQUksQ0FBQztBQUMxQyxRQUFJLGFBQWE7QUFDakIsVUFBTSxZQUFZLE1BQU0sdUJBQXVCLE9BQUs7QUFDbkQsbUJBQWE7QUFDYixhQUFPLFlBQVksR0FBRyxPQUFPLE1BQVM7QUFDdEMsYUFBTyxZQUFZLEdBQUcsU0FBUyxNQUFTO0FBQ3hDLGFBQU8sWUFBWSxHQUFHLFNBQVMsUUFBUSxDQUFDO0FBQ3hDLGNBQVEsU0FBUztBQUFBLElBQ2xCLENBQUM7QUFDRCxVQUFNLGtCQUFrQixNQUFNO0FBQzlCLFdBQU8sWUFBWSxZQUFZLElBQUk7QUFDbkMsV0FBTyxZQUFZLEdBQUcsWUFBWSxHQUFHO0FBRXJDLFdBQU8sWUFBWSxNQUFNLGVBQWUsRUFBRSxhQUFhLEtBQUssQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUN4RSxVQUFNLDhCQUE4QixLQUFLO0FBQ3pDLFVBQU0sZUFBZSxFQUFFLFFBQVEsQ0FBQUMsUUFBTTtBQUNwQyxhQUFPLFlBQVlBLElBQUcsU0FBUyxLQUFLO0FBQUEsSUFDckMsQ0FBQztBQUNELFdBQU8sWUFBWSxNQUFNLGVBQWUsRUFBRSxhQUFhLEtBQUssQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUV4RSxVQUFNLGNBQWMsSUFBSSxJQUFJO0FBQzVCLFdBQU8sWUFBWSxHQUFHLFNBQVMsSUFBSTtBQUVuQyxVQUFNLGtCQUFrQixNQUFNLGVBQWUsRUFBRSxLQUFLLFVBQVUsQ0FBQyxDQUFDO0FBQ2hFLFdBQU8sWUFBWSxvQkFBb0IsT0FBTyxRQUFXLENBQUMsR0FBRyxFQUFFO0FBRS9ELFdBQU8sWUFBWSxNQUFNLGVBQWUsRUFBRSxRQUFRLENBQUM7QUFBQSxFQUNwRCxDQUFDO0FBRUQsT0FBSyxjQUFjLE1BQU07QUFDeEIsVUFBTSxZQUFZLElBQUksS0FBSyw0QkFBNEI7QUFDdkQsaUNBQTZCLE9BQU8sV0FBVyxDQUFDLEVBQUUsWUFBWSxHQUFHLFdBQVcsU0FBUyxjQUFjLEtBQUssR0FBRyxFQUFFLFlBQVksSUFBSSxXQUFXLFFBQVEsQ0FBQyxDQUFDO0FBQ2xKLFVBQU0sY0FBYyxNQUFNLGVBQWU7QUFFekMsV0FBTyxZQUFZLFlBQVksQ0FBQyxFQUFFLFdBQVcsT0FBTztBQUNwRCxXQUFPLFlBQVksWUFBWSxDQUFDLEVBQUUsY0FBYyxJQUFJO0FBQ3BELFdBQU8sWUFBWSxZQUFZLENBQUMsRUFBRSxXQUFXLE9BQU87QUFDcEQsV0FBTyxZQUFZLENBQUMsQ0FBQyxZQUFZLENBQUMsRUFBRSxjQUFjLEtBQUs7QUFFdkQsV0FBTyxZQUFZLE1BQU0sZUFBZSxFQUFFLFFBQVEsQ0FBQztBQUNuRCxVQUFNLGtCQUFrQixNQUFNLGVBQWUsQ0FBQztBQUM5QyxXQUFPLFlBQVksTUFBTSxlQUFlLEVBQUUsUUFBUSxDQUFDO0FBQUEsRUFDcEQsQ0FBQztBQUVELE9BQUssd0JBQXdCLE1BQU07QUFDbEMsVUFBTSxzQkFBc0IsRUFBRSxNQUFNLE1BQU0sR0FBRyxHQUFHO0FBQ2hELFVBQU0sc0JBQXNCLEVBQUUsTUFBTSxNQUFNLEdBQUcsR0FBRztBQUNoRCxVQUFNLHlCQUF5QixLQUFLLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDMUQsVUFBTSx5QkFBeUIsS0FBSyxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBRTFELFVBQU0sY0FBYyxNQUFNLHVCQUF1QjtBQUNqRCxXQUFPLFlBQVksWUFBWSxDQUFDLEVBQUUsTUFBTSxZQUFZO0FBQ3BELFdBQU8sWUFBWSxZQUFZLENBQUMsRUFBRSxNQUFNLFlBQVk7QUFFcEQsVUFBTSwwQkFBMEI7QUFDaEMsV0FBTyxZQUFZLE1BQU0sdUJBQXVCLEVBQUUsUUFBUSxDQUFDO0FBQUEsRUFDNUQsQ0FBQztBQUVELE9BQUsscUJBQXFCLE1BQU07QUFDL0IsVUFBTSxXQUFXLElBQUksS0FBSyxxQkFBcUI7QUFDL0MsaUNBQTZCLE9BQU8sVUFBVSxDQUFDLEVBQUUsWUFBWSxHQUFHLFNBQVMsTUFBTSxXQUFXLFFBQVEsR0FBRyxFQUFFLFlBQVksSUFBSSxTQUFTLE1BQU0sQ0FBQyxDQUFDO0FBQ3hJLFVBQU0sY0FBYyxNQUFNLGVBQWU7QUFDekMsVUFBTSxVQUFVLFlBQVksSUFBSSxrQkFBa0IsS0FBSyxDQUFDO0FBQ3hELFVBQU0sT0FBTyxvQkFBSSxJQUFzQztBQUV2RCxXQUFPLFlBQVksWUFBWSxDQUFDLEVBQUUsWUFBWSxDQUFDO0FBQy9DLFdBQU8sWUFBWSxZQUFZLENBQUMsRUFBRSxZQUFZLEVBQUU7QUFFaEQsU0FBSyxJQUFJLFlBQVksQ0FBQyxFQUFFLE1BQU0sR0FBRyxFQUFFLFVBQVUsT0FBTyxNQUFNLEdBQUcsQ0FBQztBQUM5RCxTQUFLLElBQUksWUFBWSxDQUFDLEVBQUUsTUFBTSxHQUFHLEVBQUUsVUFBVSxNQUFNLE1BQU0sR0FBRyxDQUFDO0FBQzdELFVBQU0seUJBQXlCLFFBQVEsTUFBTSxHQUFHLENBQUMsR0FBRyxJQUFJO0FBQ3hELFdBQU8sWUFBWSxZQUFZLENBQUMsRUFBRSxZQUFZLENBQUM7QUFDL0MsV0FBTyxZQUFZLFlBQVksQ0FBQyxFQUFFLFlBQVksRUFBRTtBQUVoRCxVQUFNLFdBQVcsWUFBWSxJQUFJLGtCQUFrQixLQUFLLENBQUM7QUFDekQsVUFBTSxRQUFRLG9CQUFJLElBQXNDO0FBQ3hELFVBQU0sSUFBSSxZQUFZLENBQUMsRUFBRSxNQUFNLEdBQUcsRUFBRSxVQUFVLE1BQU0sTUFBTSxJQUFJLENBQUM7QUFDL0QsVUFBTSxJQUFJLFlBQVksQ0FBQyxFQUFFLE1BQU0sR0FBRyxFQUFFLFVBQVUsTUFBTSxNQUFNLElBQUksQ0FBQztBQUMvRCxVQUFNLHlCQUF5QixTQUFTLE1BQU0sR0FBRyxDQUFDLEdBQUcsS0FBSztBQUcxRCxXQUFPLFlBQVksWUFBWSxDQUFDLEVBQUUsWUFBWSxHQUFHO0FBRWpELFdBQU8sWUFBWSxZQUFZLENBQUMsRUFBRSxZQUFZLEVBQUU7QUFFaEQsVUFBTSx5QkFBeUIsUUFBUSxNQUFNLEdBQUcsQ0FBQyxHQUFHLE1BQVM7QUFFN0QsV0FBTyxZQUFZLFlBQVksQ0FBQyxFQUFFLFlBQVksR0FBRztBQUNqRCxXQUFPLFlBQVksWUFBWSxDQUFDLEVBQUUsWUFBWSxHQUFHO0FBRWpELFdBQU8sWUFBWSxZQUFZLENBQUMsRUFBRSxXQUFXLEtBQUs7QUFDbEQsVUFBTSxRQUFRLG9CQUFJLElBQXNDO0FBQ3hELFVBQU0sSUFBSSxZQUFZLENBQUMsRUFBRSxNQUFNLEdBQUcsRUFBRSxVQUFVLE1BQU0sTUFBTSxJQUFJLENBQUM7QUFDL0QsVUFBTSx5QkFBeUIsU0FBUyxNQUFNLEdBQUcsRUFBRSxnQ0FBZ0MsS0FBSyxHQUFHLEtBQUs7QUFDaEcsV0FBTyxZQUFZLFlBQVksQ0FBQyxFQUFFLFdBQVcsSUFBSTtBQUFBLEVBQ2xELENBQUM7QUFFRCxPQUFLLHlCQUF5QixNQUFNO0FBQ25DLFFBQUksYUFBYTtBQUNqQixnQkFBWSxJQUFJLE1BQU0sdUJBQXVCLE1BQU0sWUFBWSxDQUFDO0FBQ2hFLFVBQU0sa0NBQWtDLGdCQUFnQixDQUFDLEVBQUUsUUFBUSxZQUFZLE9BQU8sWUFBWSxTQUFTLEtBQUssQ0FBQyxDQUFDO0FBQ2xILFdBQU8sWUFBWSxZQUFZLENBQUM7QUFDaEMsUUFBSSx1QkFBdUIsTUFBTSxrQ0FBa0MsY0FBYztBQUNqRixXQUFPLFlBQVkscUJBQXFCLFFBQVEsQ0FBQztBQUNqRCxXQUFPLFlBQVkscUJBQXFCLENBQUMsRUFBRSxRQUFRLFVBQVU7QUFDN0QsV0FBTyxZQUFZLHFCQUFxQixDQUFDLEVBQUUsU0FBUyxJQUFJO0FBRXhELFVBQU0sa0NBQWtDLGdCQUFnQixDQUFDLEVBQUUsUUFBUSxZQUFZLE9BQU8sV0FBVyxHQUFHLEVBQUUsUUFBUSxVQUFVLE9BQU8sU0FBUyxDQUFDLENBQUM7QUFDMUksV0FBTyxZQUFZLFlBQVksQ0FBQztBQUNoQywyQkFBdUIsTUFBTSxrQ0FBa0MsY0FBYztBQUM3RSxXQUFPLFlBQVkscUJBQXFCLFFBQVEsQ0FBQztBQUNqRCxXQUFPLFlBQVkscUJBQXFCLENBQUMsRUFBRSxRQUFRLFVBQVU7QUFDN0QsV0FBTyxZQUFZLHFCQUFxQixDQUFDLEVBQUUsU0FBUyxJQUFJO0FBQ3hELFdBQU8sWUFBWSxxQkFBcUIsQ0FBQyxFQUFFLFFBQVEsUUFBUTtBQUMzRCxXQUFPLFlBQVkscUJBQXFCLENBQUMsRUFBRSxPQUFPLFFBQVE7QUFDMUQsV0FBTyxZQUFZLHFCQUFxQixDQUFDLEVBQUUsU0FBUyxLQUFLO0FBRXpELFVBQU0sa0NBQWtDLGdCQUFnQixDQUFDLEVBQUUsUUFBUSxPQUFPLE9BQU8sTUFBTSxDQUFDLENBQUM7QUFDekYsV0FBTyxZQUFZLFlBQVksQ0FBQztBQUNoQyxXQUFPLFlBQVksTUFBTSxrQ0FBa0MsY0FBYyxFQUFFLFFBQVEsQ0FBQztBQUNwRiwyQkFBdUIsTUFBTSx3QkFBd0I7QUFDckQsV0FBTyxZQUFZLHFCQUFxQixDQUFDLEVBQUUsUUFBUSxVQUFVO0FBQzdELFdBQU8sWUFBWSxxQkFBcUIsQ0FBQyxFQUFFLFNBQVMsSUFBSTtBQUN4RCxXQUFPLFlBQVkscUJBQXFCLENBQUMsRUFBRSxRQUFRLFFBQVE7QUFDM0QsV0FBTyxZQUFZLHFCQUFxQixDQUFDLEVBQUUsT0FBTyxRQUFRO0FBQzFELFdBQU8sWUFBWSxxQkFBcUIsQ0FBQyxFQUFFLFNBQVMsS0FBSztBQUN6RCxXQUFPLFlBQVkscUJBQXFCLENBQUMsRUFBRSxRQUFRLEtBQUs7QUFDeEQsV0FBTyxZQUFZLHFCQUFxQixDQUFDLEVBQUUsT0FBTyxLQUFLO0FBQUEsRUFDeEQsQ0FBQztBQUVELE9BQUssMkNBQTJDLE1BQU07QUFDckQsUUFBSSxhQUFhO0FBQ2pCLGdCQUFZLElBQUksTUFBTSx1QkFBdUIsTUFBTSxZQUFZLENBQUM7QUFFaEUsVUFBTSxrQ0FBa0MsZ0JBQWdCLENBQUMsRUFBRSxRQUFRLFlBQVksT0FBTyxZQUFZLFNBQVMsS0FBSyxHQUFHLEVBQUUsUUFBUSxVQUFVLE9BQU8sU0FBUyxDQUFDLENBQUM7QUFDekosVUFBTSxzQ0FBc0MsY0FBYztBQUMxRCxXQUFPLFlBQVksWUFBWSxDQUFDO0FBQ2hDLFFBQUksaUNBQWlDLE1BQU0sa0NBQWtDLGNBQWM7QUFDM0YsV0FBTyxZQUFZLCtCQUErQixRQUFRLENBQUM7QUFDM0QsV0FBTyxZQUFZLCtCQUErQixDQUFDLEVBQUUsUUFBUSxVQUFVO0FBQ3ZFLFdBQU8sWUFBWSwrQkFBK0IsQ0FBQyxFQUFFLFFBQVEsUUFBUTtBQUVyRSxVQUFNLGtDQUFrQyxnQkFBZ0IsQ0FBQyxFQUFFLFFBQVEsT0FBTyxPQUFPLE1BQU0sR0FBRyxFQUFFLFFBQVEsVUFBVSxPQUFPLFNBQVMsQ0FBQyxDQUFDO0FBQ2hJLFdBQU8sWUFBWSxZQUFZLENBQUM7QUFDaEMscUNBQWlDLE1BQU0sa0NBQWtDLGNBQWM7QUFDdkYsUUFBSSxtQ0FBbUMsTUFBTSxrQ0FBa0MsTUFBUztBQUN4RixXQUFPLFlBQVksK0JBQStCLFFBQVEsQ0FBQztBQUMzRCxXQUFPLFlBQVksK0JBQStCLENBQUMsRUFBRSxRQUFRLFFBQVE7QUFDckUsV0FBTyxZQUFZLCtCQUErQixDQUFDLEVBQUUsUUFBUSxLQUFLO0FBQ2xFLFdBQU8sWUFBWSxpQ0FBaUMsUUFBUSxDQUFDO0FBQzdELFdBQU8sWUFBWSxpQ0FBaUMsQ0FBQyxFQUFFLFFBQVEsVUFBVTtBQUN6RSxXQUFPLFlBQVksaUNBQWlDLENBQUMsRUFBRSxRQUFRLFFBQVE7QUFFdkUsVUFBTSxxQ0FBcUMsY0FBYztBQUN6RCxXQUFPLFlBQVksWUFBWSxDQUFDO0FBQ2hDLHVDQUFtQyxNQUFNLGtDQUFrQyxNQUFTO0FBQ3BGLFdBQU8sWUFBWSxpQ0FBaUMsUUFBUSxDQUFDO0FBQzdELFdBQU8sWUFBWSxpQ0FBaUMsQ0FBQyxFQUFFLFFBQVEsVUFBVTtBQUN6RSxXQUFPLFlBQVksaUNBQWlDLENBQUMsRUFBRSxRQUFRLFFBQVE7QUFFdkUsVUFBTSxzQ0FBc0MsY0FBYztBQUMxRCxXQUFPLFlBQVksWUFBWSxDQUFDO0FBQ2hDLHVDQUFtQyxNQUFNLGtDQUFrQyxNQUFTO0FBQ3BGLFdBQU8sWUFBWSxpQ0FBaUMsUUFBUSxDQUFDO0FBQzdELFdBQU8sWUFBWSxpQ0FBaUMsQ0FBQyxFQUFFLFFBQVEsUUFBUTtBQUN2RSxXQUFPLFlBQVksaUNBQWlDLENBQUMsRUFBRSxRQUFRLEtBQUs7QUFFcEUsVUFBTSx1QkFBdUIsTUFBTSx3QkFBd0I7QUFDM0QsV0FBTyxZQUFZLHFCQUFxQixRQUFRLENBQUM7QUFBQSxFQUNsRCxDQUFDO0FBRUQsT0FBSywyQkFBMkIsTUFBTTtBQUNyQyxRQUFJLGFBQWE7QUFDakIsZ0JBQVksSUFBSSxNQUFNLHVCQUF1QixNQUFNLFlBQVksQ0FBQztBQUVoRSxVQUFNLHlCQUF5QixFQUFFLHNCQUFzQixjQUFjLFFBQVEsR0FBRyxTQUFTLElBQUksWUFBWSxNQUFNLENBQUM7QUFFaEgsV0FBTyxZQUFZLFlBQVksQ0FBQztBQUNoQyxRQUFJLHlCQUF5QixNQUFNLDBCQUEwQjtBQUM3RCxXQUFPLFlBQVksdUJBQXVCLFFBQVEsQ0FBQztBQUNuRCxXQUFPLFlBQVksdUJBQXVCLENBQUMsRUFBRSxzQkFBc0IsWUFBWTtBQUMvRSxXQUFPLFlBQVksdUJBQXVCLENBQUMsRUFBRSxRQUFRLENBQUM7QUFFdEQsVUFBTSx5QkFBeUIsRUFBRSxzQkFBc0IsY0FBYyxRQUFRLEdBQUcsU0FBUyxJQUFJLFlBQVksTUFBTSxDQUFDO0FBQ2hILFdBQU8sWUFBWSxZQUFZLENBQUM7QUFDaEMsNkJBQXlCLE1BQU0sMEJBQTBCO0FBQ3pELFdBQU8sWUFBWSx1QkFBdUIsUUFBUSxDQUFDO0FBQ25ELFdBQU8sWUFBWSx1QkFBdUIsQ0FBQyxFQUFFLHNCQUFzQixZQUFZO0FBQy9FLFdBQU8sWUFBWSx1QkFBdUIsQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUN0RCxXQUFPLFlBQVksdUJBQXVCLENBQUMsRUFBRSxzQkFBc0IsWUFBWTtBQUMvRSxXQUFPLFlBQVksdUJBQXVCLENBQUMsRUFBRSxRQUFRLENBQUM7QUFBQSxFQUN2RCxDQUFDO0FBRUQsT0FBSyxvQkFBb0IsTUFBTTtBQUM5QixRQUFJLGFBQWE7QUFDakIsZ0JBQVksSUFBSSxNQUFNLHVCQUF1QixNQUFNLFlBQVksQ0FBQztBQUVoRSxVQUFNLGtCQUFrQixFQUFFLGFBQWEsU0FBUyxLQUFLLEVBQUUsTUFBTSxzQkFBc0IsVUFBVSxRQUFRLEtBQUssR0FBRyxZQUFZLE1BQU0sYUFBYSxDQUFDLE1BQU0sR0FBRyxZQUFZLE9BQU8sR0FBRyxHQUFHO0FBQy9LLFVBQU0sa0JBQWtCLEVBQUUsYUFBYSxVQUFVLEtBQUssRUFBRSxNQUFNLHNCQUFzQixVQUFVLFFBQVEsV0FBVyxHQUFHLFlBQVksT0FBTyxhQUFhLENBQUMsV0FBVyxHQUFHLFlBQVksWUFBWSxHQUFHLEdBQUc7QUFDak0sVUFBTSxxQkFBcUIsS0FBSyxFQUFFLFdBQVcsYUFBYSxDQUFDO0FBQzNELFVBQU0scUJBQXFCLEtBQUssRUFBRSxjQUFjLEtBQUssQ0FBQztBQUN0RCxVQUFNLGtCQUFrQixNQUFNLG1CQUFtQjtBQUNqRCxXQUFPLFlBQVksZ0JBQWdCLENBQUMsRUFBRSxZQUFZLElBQUk7QUFDdEQsV0FBTyxnQkFBZ0IsZ0JBQWdCLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxzQkFBc0IsVUFBVSxRQUFRLEtBQUssQ0FBQztBQUNyRyxXQUFPLFlBQVksZ0JBQWdCLENBQUMsRUFBRSxZQUFZLE1BQU07QUFDeEQsV0FBTyxZQUFZLGdCQUFnQixDQUFDLEVBQUUsV0FBVyxZQUFZO0FBQzdELFdBQU8sWUFBWSxnQkFBZ0IsQ0FBQyxFQUFFLFlBQVksS0FBSztBQUN2RCxXQUFPLFlBQVksZ0JBQWdCLENBQUMsRUFBRSxhQUFhLFFBQVE7QUFDM0QsV0FBTyxZQUFZLGdCQUFnQixDQUFDLEVBQUUsWUFBWSxXQUFXO0FBQzdELFdBQU8sWUFBWSxnQkFBZ0IsQ0FBQyxFQUFFLGNBQWMsSUFBSTtBQUV4RCxXQUFPLFlBQVksWUFBWSxDQUFDO0FBRWhDLFVBQU0sc0JBQXNCLGdCQUFnQixDQUFDLEVBQUUsTUFBTSxDQUFDO0FBQ3RELFdBQU8sWUFBWSxZQUFZLENBQUM7QUFDaEMsV0FBTyxZQUFZLE1BQU0sbUJBQW1CLEVBQUUsUUFBUSxDQUFDO0FBRXZELFVBQU0sc0JBQXNCO0FBQzVCLFdBQU8sWUFBWSxNQUFNLG1CQUFtQixFQUFFLFFBQVEsQ0FBQztBQUN2RCxXQUFPLFlBQVksWUFBWSxDQUFDO0FBQUEsRUFDakMsQ0FBQztBQUVELE9BQUssMEJBQTBCLE1BQU07QUFDcEMsVUFBTSxXQUFXLElBQUksS0FBSyw0QkFBNEI7QUFDdEQsaUNBQTZCLE9BQU8sVUFBVTtBQUFBLE1BQzdDLEVBQUUsWUFBWSxHQUFHLFNBQVMsTUFBTSxXQUFXLFFBQVE7QUFBQSxNQUNuRCxFQUFFLFlBQVksSUFBSSxTQUFTLE1BQU07QUFBQSxNQUNqQyxFQUFFLFlBQVksSUFBSSxTQUFTLE1BQU0sWUFBWSxRQUFRO0FBQUEsTUFDckQsRUFBRSxZQUFZLElBQUksU0FBUyxNQUFNLGNBQWMsS0FBSztBQUFBLE1BQ3BELEVBQUUsWUFBWSxLQUFLLFNBQVMsS0FBSztBQUFBLElBQ2xDLENBQUM7QUFDRCxVQUFNLGNBQWMsTUFBTSxlQUFlO0FBQ3pDLFVBQU0sS0FBSyxJQUFJLGlCQUFpQjtBQUVoQyxRQUFJLFNBQVMsNEJBQTRCLE1BQU0sU0FBUyxNQUFNLFlBQVksQ0FBQyxHQUFHLElBQUksS0FBSztBQUN2RixXQUFPLFlBQVksT0FBTyxTQUFTLGtCQUFrQjtBQUNyRCxXQUFPLFlBQVksT0FBTyxLQUFLLElBQUksOEJBQThCO0FBRWpFLGFBQVMsNEJBQTRCLE1BQU0sU0FBUyxNQUFNLFlBQVksQ0FBQyxHQUFHLElBQUksS0FBSztBQUNuRixXQUFPLFlBQVksT0FBTyxTQUFTLHFCQUFxQjtBQUN4RCxXQUFPLFlBQVksT0FBTyxLQUFLLElBQUksMkJBQTJCO0FBRTlELGFBQVMsNEJBQTRCLE1BQU0sU0FBUyxNQUFNLFlBQVksQ0FBQyxHQUFHLElBQUksS0FBSztBQUNuRixXQUFPLFlBQVksT0FBTyxTQUFTLG9CQUFvQjtBQUN2RCxXQUFPLFlBQVksT0FBTyxLQUFLLElBQUksc0JBQXNCO0FBRXpELGFBQVMsNEJBQTRCLE1BQU0sU0FBUyxNQUFNLFlBQVksQ0FBQyxHQUFHLElBQUksS0FBSztBQUNuRixXQUFPLFlBQVksT0FBTyxTQUFTLGVBQWU7QUFDbEQsV0FBTyxZQUFZLE9BQU8sS0FBSyxJQUFJLDhCQUE4QjtBQUVqRSxhQUFTLDRCQUE0QixNQUFNLFNBQVMsTUFBTSxZQUFZLENBQUMsR0FBRyxJQUFJLEtBQUs7QUFDbkYsV0FBTyxZQUFZLE9BQU8sU0FBUyxHQUFHLFlBQVksWUFBWSxDQUFDLEVBQUUsR0FBRyxDQUFDO0FBQ3JFLFdBQU8sWUFBWSxPQUFPLEtBQUssSUFBSSxrQkFBa0I7QUFFckQsYUFBUyw0QkFBNEIsTUFBTSxTQUFTLE9BQU8sWUFBWSxDQUFDLEdBQUcsSUFBSSxLQUFLO0FBQ3BGLFdBQU8sWUFBWSxPQUFPLFNBQVMsbUJBQW1CO0FBQ3RELFdBQU8sWUFBWSxPQUFPLEtBQUssSUFBSSwrQkFBK0I7QUFFbEUsVUFBTSxrQkFBa0IsRUFBRSxhQUFhLFNBQVMsWUFBWSxNQUFNLGFBQWEsQ0FBQyxNQUFNLEdBQUcsWUFBWSxRQUFRLEtBQUssRUFBRSxNQUFNLHNCQUFzQixVQUFVLFFBQVEsS0FBSyxFQUFFLENBQUM7QUFDMUssVUFBTSxrQkFBa0IsTUFBTSxtQkFBbUI7QUFDakQsYUFBUyw0QkFBNEIsTUFBTSxTQUFTLE1BQU0sZ0JBQWdCLENBQUMsR0FBRyxJQUFJLEtBQUs7QUFDdkYsV0FBTyxZQUFZLE9BQU8sU0FBUyxpQkFBaUI7QUFDcEQsV0FBTyxZQUFZLE9BQU8sS0FBSyxJQUFJLHVCQUF1QjtBQUUxRCxVQUFNLHFCQUFxQixNQUFNLHNCQUFzQixFQUFFLE1BQU0sTUFBTSxHQUFHLEdBQUc7QUFDM0UsYUFBUyw0QkFBNEIsTUFBTSxTQUFTLE1BQU0sb0JBQW9CLElBQUksS0FBSztBQUN2RixXQUFPLFlBQVksT0FBTyxTQUFTLHFCQUFxQjtBQUN4RCxXQUFPLFlBQVksT0FBTyxLQUFLLElBQUksMkJBQTJCO0FBRTlELFVBQU0sT0FBTyxvQkFBSSxJQUFzQztBQUN2RCxTQUFLLElBQUksWUFBWSxDQUFDLEVBQUUsTUFBTSxHQUFHLEVBQUUsVUFBVSxPQUFPLE1BQU0sR0FBRyxDQUFDO0FBQzlELFNBQUssSUFBSSxZQUFZLENBQUMsRUFBRSxNQUFNLEdBQUcsRUFBRSxVQUFVLE1BQU0sTUFBTSxHQUFHLENBQUM7QUFDN0QsU0FBSyxJQUFJLFlBQVksQ0FBQyxFQUFFLE1BQU0sR0FBRyxFQUFFLFVBQVUsTUFBTSxNQUFNLElBQUksU0FBUyxRQUFRLENBQUM7QUFDL0UsU0FBSyxJQUFJLG1CQUFtQixNQUFNLEdBQUcsRUFBRSxVQUFVLEtBQUssQ0FBQztBQUN2RCxVQUFNLHlCQUF5QixpQkFBaUIsRUFBRSw2QkFBNkIsT0FBTyx5QkFBeUIsTUFBTSxtQkFBbUIsS0FBSyxHQUFHLElBQUk7QUFFcEosYUFBUyw0QkFBNEIsTUFBTSxTQUFTLE1BQU0sWUFBWSxDQUFDLEdBQUcsSUFBSSxLQUFLO0FBQ25GLFdBQU8sWUFBWSxPQUFPLFNBQVMsdUJBQXVCO0FBQzFELFdBQU8sWUFBWSxPQUFPLEtBQUssSUFBSSw2QkFBNkI7QUFFaEUsYUFBUyw0QkFBNEIsTUFBTSxTQUFTLE1BQU0sb0JBQW9CLElBQUksS0FBSztBQUN2RixXQUFPLFlBQVksT0FBTyxTQUFTLHVEQUF1RDtBQUMxRixXQUFPLFlBQVksT0FBTyxLQUFLLElBQUksc0NBQXNDO0FBRXpFLGFBQVMsNEJBQTRCLE1BQU0sU0FBUyxNQUFNLFlBQVksQ0FBQyxHQUFHLElBQUksS0FBSztBQUNuRixXQUFPLFlBQVksT0FBTyxTQUFTLDJCQUEyQjtBQUM5RCxXQUFPLFlBQVksT0FBTyxLQUFLLElBQUksc0JBQXNCO0FBQUEsRUFDMUQsQ0FBQztBQUVELE9BQUssZUFBZSxNQUFNO0FBQ3pCLFVBQU0sV0FBVyxJQUFJLEtBQUssNEJBQTRCO0FBQ3RELFVBQU0sYUFBYTtBQUNuQixVQUFNLFlBQVk7QUFBQSxNQUNqQixDQUFDLG9CQUFvQixvQkFBb0IscURBQXFELHFCQUFxQixtQkFBbUIsRUFBRSxLQUFLLElBQUk7QUFBQSxNQUNqSjtBQUFBLElBQ0Q7QUFDQSxpQ0FBNkIsT0FBTyxVQUFVO0FBQUEsTUFDN0MsRUFBRSxZQUFZLEdBQUcsU0FBUyxNQUFNLFdBQVcsUUFBUTtBQUFBLE1BQ25ELEVBQUUsWUFBWSxHQUFHLFFBQVEsR0FBRyxTQUFTLE1BQU07QUFBQSxNQUMzQyxFQUFFLFlBQVksR0FBRyxTQUFTLE1BQU0sWUFBWSxRQUFRO0FBQUEsTUFDcEQsRUFBRSxZQUFZLEtBQUssU0FBUyxLQUFLO0FBQUEsSUFDbEMsQ0FBQztBQUNELFVBQU0sY0FBYyxNQUFNLGVBQWU7QUFFekMsVUFBTSx1QkFBdUIsSUFBSSx5QkFBeUI7QUFDMUQsVUFBTSxlQUFlLElBQUksaUJBQWlCO0FBQzFDLGlCQUFhLFdBQVcsTUFBTTtBQUM5Qix5QkFBcUIsS0FBSyxlQUFlLFlBQVk7QUFDckQseUJBQXFCLEtBQUssZUFBZSxJQUFJLGlCQUFpQixDQUFDO0FBQy9ELHlCQUFxQixLQUFLLGtCQUFrQixZQUFZLElBQUksSUFBSSxnQkFBZ0IsQ0FBQyxDQUFDO0FBQ2xGLFFBQUksY0FBYyxxQkFBcUIsZUFBZSxjQUFZLDRCQUE0QixVQUFVLFdBQVcsYUFBYSxNQUFNLFNBQVMsTUFBTSxJQUFJLENBQUM7QUFDMUosV0FBTyxZQUFZLFlBQVksUUFBUSxDQUFDO0FBQ3hDLFdBQU8sZ0JBQWdCLFlBQVksQ0FBQyxFQUFFLE9BQU8sSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUNsRSxXQUFPLGdCQUFnQixZQUFZLENBQUMsRUFBRSxPQUFPLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFDbEUsV0FBTyxnQkFBZ0IsWUFBWSxDQUFDLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQ2xFLFdBQU8sWUFBWSxZQUFZLENBQUMsRUFBRSxRQUFRLHdCQUF3QixNQUFTO0FBQzNFLFdBQU8sWUFBWSxZQUFZLENBQUMsRUFBRSxRQUFRLFFBQVEsaUJBQWlCLDhCQUE4QjtBQUNqRyxXQUFPLFlBQVksWUFBWSxDQUFDLEVBQUUsUUFBUSxlQUFlLFVBQVUsa0JBQWtCLElBQUk7QUFDekYsVUFBTSxXQUFXLElBQUksZUFBZSxRQUFXLEVBQUUsV0FBVyxNQUFNLG1CQUFtQixLQUFLLENBQUMsRUFBRSxnQkFBZ0IsWUFBWSxrQkFBa0I7QUFDM0ksV0FBTyxnQkFBZ0IsWUFBWSxDQUFDLEVBQUUsUUFBUSx5QkFBeUIsUUFBUTtBQUUvRSxrQkFBYyxxQkFBcUIsZUFBZSxjQUFZLDRCQUE0QixVQUFVLFdBQVcsYUFBYSxNQUFNLFNBQVMsTUFBTSxLQUFLLENBQUM7QUFDdkosV0FBTyxZQUFZLFlBQVksQ0FBQyxFQUFFLFFBQVEsZUFBZSxJQUFJO0FBRTdELGNBQVUsUUFBUTtBQUNsQix5QkFBcUIsUUFBUTtBQUFBLEVBQzlCLENBQUM7QUFFRCxPQUFLLGdDQUFnQyxNQUFNO0FBQzFDLFVBQU0sV0FBVyxZQUFZLElBQUksSUFBSSxtQkFBbUIsQ0FBQztBQUN6RCxVQUFNLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQkFBaUIsUUFBUSxDQUFDO0FBQ3BFLFVBQU0sU0FBUyxZQUFZLElBQUksSUFBSSxXQUFXLGVBQW9CLEVBQUUsU0FBUyxDQUFDLE1BQVcsTUFBTSxHQUFHLHdCQUF3QixJQUFJLGVBQWUsQ0FBQyxDQUFDO0FBRy9JLFVBQU0sV0FBVyxJQUFJLEtBQUssNEJBQTRCO0FBQ3RELFVBQU0sUUFBUTtBQUFBLE1BQ2IsRUFBRSxZQUFZLEdBQUcsU0FBUyxNQUFNLFdBQVcsUUFBUTtBQUFBLE1BQ25ELEVBQUUsWUFBWSxHQUFHLFFBQVEsR0FBRyxTQUFTLE1BQU07QUFBQSxJQUM1QztBQUVBLGlDQUE2QixRQUFRLFVBQVUsS0FBSztBQUNwRCxrQkFBYyxpQkFBaUIsTUFBTTtBQUNyQyxVQUFNLFNBQVMsU0FBUyxJQUFJLG9CQUFvQixhQUFhLFNBQVM7QUFHdEUsVUFBTSxXQUFXLFlBQVksSUFBSSxJQUFJLG1CQUFtQixDQUFDO0FBQ3pELFVBQU0sU0FBUyxZQUFZLElBQUksSUFBSSxXQUFXLFlBQVksSUFBSSxJQUFJLGlCQUFpQixRQUFRLENBQUMsR0FBUSxFQUFFLFNBQVMsQ0FBQyxNQUFXLE1BQU0sR0FBRyx3QkFBd0IsSUFBSSxlQUFlLENBQUMsQ0FBQztBQUNqTCxhQUFTO0FBQUEsTUFBTTtBQUFBLE1BQW9CO0FBQUEsTUFBUSxhQUFhO0FBQUEsTUFBVyxjQUFjO0FBQUE7QUFBQSxNQUFzQjtBQUFBLElBQUk7QUFDM0csV0FBTyxnQkFBZ0IsT0FBTyxlQUFlLEVBQUUsSUFBSSxPQUFLLEVBQUUsTUFBTSxDQUFDLEdBQUcsT0FBTyxlQUFlLEVBQUUsSUFBSSxPQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFHL0csYUFBUztBQUFBLE1BQU07QUFBQSxNQUFvQjtBQUFBLE1BQU0sYUFBYTtBQUFBLE1BQVcsY0FBYztBQUFBO0FBQUEsTUFBc0I7QUFBQSxJQUFLO0FBQzFHLFdBQU8sZ0JBQWdCLE9BQU8sZUFBZSxFQUFFLElBQUksT0FBSyxFQUFFLE1BQU0sQ0FBQyxHQUFHLE9BQU8sZUFBZSxFQUFFLElBQUksT0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQUEsRUFDaEgsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbInVyaSIsICJicCJdCn0K
