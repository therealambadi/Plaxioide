import assert from "assert";
import * as sinon from "sinon";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { Constants } from "../../../../../base/common/uint.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { TestAccessibilityService } from "../../../../../platform/accessibility/test/common/testAccessibilityService.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { NullLogService } from "../../../../../platform/log/common/log.js";
import { createDecorationsForStackFrame } from "../../browser/callStackEditorContribution.js";
import { getContext, getContextForContributedActions, getSpecificSourceName } from "../../browser/callStackView.js";
import { debugStackframe, debugStackframeFocused } from "../../browser/debugIcons.js";
import { getStackFrameThreadAndSessionToFocus } from "../../browser/debugService.js";
import { DebugSession } from "../../browser/debugSession.js";
import { State } from "../../common/debug.js";
import { StackFrame, Thread } from "../../common/debugModel.js";
import { Source } from "../../common/debugSource.js";
import { createMockDebugModel, mockUriIdentityService } from "./mockDebugModel.js";
import { MockRawSession } from "../common/mockDebug.js";
const mockWorkspaceContextService = {
  getWorkspace: () => {
    return {
      folders: []
    };
  }
};
function createTestSession(model, name = "mockSession", options) {
  return new DebugSession(generateUuid(), { resolved: { name, type: "node", request: "launch" }, unresolved: void 0 }, void 0, model, options, {
    getViewModel() {
      return {
        updateViews() {
        }
      };
    }
  }, void 0, void 0, new TestConfigurationService({ debug: { console: { collapseIdenticalLines: true } } }), void 0, mockWorkspaceContextService, void 0, void 0, void 0, mockUriIdentityService, new TestInstantiationService(), void 0, void 0, new NullLogService(), void 0, void 0, new TestAccessibilityService());
}
function createTwoStackFrames(session) {
  const thread = new class extends Thread {
    getCallStack() {
      return [firstStackFrame, secondStackFrame];
    }
  }(session, "mockthread", 1);
  const firstSource = new Source({
    name: "internalModule.js",
    path: "a/b/c/d/internalModule.js",
    sourceReference: 10
  }, "aDebugSessionId", mockUriIdentityService, new NullLogService());
  const secondSource = new Source({
    name: "internalModule.js",
    path: "z/x/c/d/internalModule.js",
    sourceReference: 11
  }, "aDebugSessionId", mockUriIdentityService, new NullLogService());
  const firstStackFrame = new StackFrame(thread, 0, firstSource, "app.js", "normal", { startLineNumber: 1, startColumn: 2, endLineNumber: 1, endColumn: 10 }, 0, true);
  const secondStackFrame = new StackFrame(thread, 1, secondSource, "app2.js", "normal", { startLineNumber: 1, startColumn: 2, endLineNumber: 1, endColumn: 10 }, 1, true);
  return { firstStackFrame, secondStackFrame };
}
suite("Debug - CallStack", () => {
  let model;
  let mockRawSession;
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  setup(() => {
    model = createMockDebugModel(disposables);
    mockRawSession = new MockRawSession();
  });
  teardown(() => {
    sinon.restore();
  });
  test("threads simple", () => {
    const threadId = 1;
    const threadName = "firstThread";
    const session = createTestSession(model);
    disposables.add(session);
    model.addSession(session);
    assert.strictEqual(model.getSessions(true).length, 1);
    model.rawUpdate({
      sessionId: session.getId(),
      threads: [{
        id: threadId,
        name: threadName
      }]
    });
    assert.strictEqual(session.getThread(threadId).name, threadName);
    model.clearThreads(session.getId(), true);
    assert.strictEqual(session.getThread(threadId), void 0);
    assert.strictEqual(model.getSessions(true).length, 1);
  });
  test("threads multiple with allThreadsStopped", async () => {
    const threadId1 = 1;
    const threadName1 = "firstThread";
    const threadId2 = 2;
    const threadName2 = "secondThread";
    const stoppedReason = "breakpoint";
    const session = createTestSession(model);
    disposables.add(session);
    model.addSession(session);
    session["raw"] = mockRawSession;
    model.rawUpdate({
      sessionId: session.getId(),
      threads: [{
        id: threadId1,
        name: threadName1
      }]
    });
    model.rawUpdate({
      sessionId: session.getId(),
      threads: [{
        id: threadId1,
        name: threadName1
      }, {
        id: threadId2,
        name: threadName2
      }],
      stoppedDetails: {
        reason: stoppedReason,
        threadId: 1,
        allThreadsStopped: true
      }
    });
    const thread1 = session.getThread(threadId1);
    const thread2 = session.getThread(threadId2);
    assert.strictEqual(session.getAllThreads().length, 2);
    assert.strictEqual(thread1.name, threadName1);
    assert.strictEqual(thread1.stopped, true);
    assert.strictEqual(thread1.getCallStack().length, 0);
    assert.strictEqual(thread1.stoppedDetails.reason, stoppedReason);
    assert.strictEqual(thread2.name, threadName2);
    assert.strictEqual(thread2.stopped, true);
    assert.strictEqual(thread2.getCallStack().length, 0);
    assert.strictEqual(thread2.stoppedDetails.reason, void 0);
    await thread1.fetchCallStack();
    assert.notStrictEqual(thread1.getCallStack().length, 0);
    await thread2.fetchCallStack();
    assert.notStrictEqual(thread2.getCallStack().length, 0);
    await thread1.fetchCallStack();
    await thread2.fetchCallStack();
    thread1.clearCallStack();
    assert.strictEqual(thread1.stopped, true);
    assert.strictEqual(thread1.getCallStack().length, 0);
    thread2.clearCallStack();
    assert.strictEqual(thread2.stopped, true);
    assert.strictEqual(thread2.getCallStack().length, 0);
    model.clearThreads(session.getId(), true);
    assert.strictEqual(session.getThread(threadId1), void 0);
    assert.strictEqual(session.getThread(threadId2), void 0);
    assert.strictEqual(session.getAllThreads().length, 0);
  });
  test("allThreadsStopped in multiple events", async () => {
    const threadId1 = 1;
    const threadName1 = "firstThread";
    const threadId2 = 2;
    const threadName2 = "secondThread";
    const stoppedReason = "breakpoint";
    const session = createTestSession(model);
    disposables.add(session);
    model.addSession(session);
    session["raw"] = mockRawSession;
    model.rawUpdate({
      sessionId: session.getId(),
      threads: [{
        id: threadId1,
        name: threadName1
      }, {
        id: threadId2,
        name: threadName2
      }],
      stoppedDetails: {
        reason: stoppedReason,
        threadId: threadId1,
        allThreadsStopped: true
      }
    });
    model.rawUpdate({
      sessionId: session.getId(),
      threads: [{
        id: threadId1,
        name: threadName1
      }, {
        id: threadId2,
        name: threadName2
      }],
      stoppedDetails: {
        reason: stoppedReason,
        threadId: threadId2,
        allThreadsStopped: true
      }
    });
    const thread1 = session.getThread(threadId1);
    const thread2 = session.getThread(threadId2);
    assert.strictEqual(thread1.stoppedDetails?.reason, stoppedReason);
    assert.strictEqual(thread2.stoppedDetails?.reason, stoppedReason);
  });
  test("threads multiple without allThreadsStopped", async () => {
    const sessionStub = sinon.spy(mockRawSession, "stackTrace");
    const stoppedThreadId = 1;
    const stoppedThreadName = "stoppedThread";
    const runningThreadId = 2;
    const runningThreadName = "runningThread";
    const stoppedReason = "breakpoint";
    const session = createTestSession(model);
    disposables.add(session);
    model.addSession(session);
    session["raw"] = mockRawSession;
    model.rawUpdate({
      sessionId: session.getId(),
      threads: [{
        id: stoppedThreadId,
        name: stoppedThreadName
      }]
    });
    model.rawUpdate({
      sessionId: session.getId(),
      threads: [{
        id: 1,
        name: stoppedThreadName
      }, {
        id: runningThreadId,
        name: runningThreadName
      }],
      stoppedDetails: {
        reason: stoppedReason,
        threadId: 1,
        allThreadsStopped: false
      }
    });
    const stoppedThread = session.getThread(stoppedThreadId);
    const runningThread = session.getThread(runningThreadId);
    assert.strictEqual(stoppedThread.name, stoppedThreadName);
    assert.strictEqual(stoppedThread.stopped, true);
    assert.strictEqual(session.getAllThreads().length, 2);
    assert.strictEqual(stoppedThread.getCallStack().length, 0);
    assert.strictEqual(stoppedThread.stoppedDetails.reason, stoppedReason);
    assert.strictEqual(runningThread.name, runningThreadName);
    assert.strictEqual(runningThread.stopped, false);
    assert.strictEqual(runningThread.getCallStack().length, 0);
    assert.strictEqual(runningThread.stoppedDetails, void 0);
    await stoppedThread.fetchCallStack();
    assert.notStrictEqual(stoppedThread.getCallStack().length, 0);
    assert.strictEqual(runningThread.getCallStack().length, 0);
    assert.strictEqual(sessionStub.callCount, 1);
    await runningThread.fetchCallStack();
    assert.strictEqual(runningThread.getCallStack().length, 0);
    assert.strictEqual(sessionStub.callCount, 1);
    stoppedThread.clearCallStack();
    assert.strictEqual(stoppedThread.stopped, true);
    assert.strictEqual(stoppedThread.getCallStack().length, 0);
    model.clearThreads(session.getId(), true);
    assert.strictEqual(session.getThread(stoppedThreadId), void 0);
    assert.strictEqual(session.getThread(runningThreadId), void 0);
    assert.strictEqual(session.getAllThreads().length, 0);
  });
  test("stack frame get specific source name", () => {
    const session = createTestSession(model);
    disposables.add(session);
    model.addSession(session);
    const { firstStackFrame, secondStackFrame } = createTwoStackFrames(session);
    assert.strictEqual(getSpecificSourceName(firstStackFrame), ".../b/c/d/internalModule.js");
    assert.strictEqual(getSpecificSourceName(secondStackFrame), ".../x/c/d/internalModule.js");
  });
  test("stack frame toString()", () => {
    const session = createTestSession(model);
    disposables.add(session);
    const thread = new Thread(session, "mockthread", 1);
    const firstSource = new Source({
      name: "internalModule.js",
      path: "a/b/c/d/internalModule.js",
      sourceReference: 10
    }, "aDebugSessionId", mockUriIdentityService, new NullLogService());
    const stackFrame = new StackFrame(thread, 1, firstSource, "app", "normal", { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 10 }, 1, true);
    assert.strictEqual(stackFrame.toString(), "app (internalModule.js:1)");
    const secondSource = new Source(void 0, "aDebugSessionId", mockUriIdentityService, new NullLogService());
    const stackFrame2 = new StackFrame(thread, 2, secondSource, "module", "normal", { startLineNumber: void 0, startColumn: void 0, endLineNumber: void 0, endColumn: void 0 }, 2, true);
    assert.strictEqual(stackFrame2.toString(), "module");
  });
  test("debug child sessions are added in correct order", () => {
    const session = disposables.add(createTestSession(model));
    model.addSession(session);
    const secondSession = disposables.add(createTestSession(model, "mockSession2"));
    model.addSession(secondSession);
    const firstChild = disposables.add(createTestSession(model, "firstChild", { parentSession: session }));
    model.addSession(firstChild);
    const secondChild = disposables.add(createTestSession(model, "secondChild", { parentSession: session }));
    model.addSession(secondChild);
    const thirdSession = disposables.add(createTestSession(model, "mockSession3"));
    model.addSession(thirdSession);
    const anotherChild = disposables.add(createTestSession(model, "secondChild", { parentSession: secondSession }));
    model.addSession(anotherChild);
    const sessions = model.getSessions();
    assert.strictEqual(sessions[0].getId(), session.getId());
    assert.strictEqual(sessions[1].getId(), firstChild.getId());
    assert.strictEqual(sessions[2].getId(), secondChild.getId());
    assert.strictEqual(sessions[3].getId(), secondSession.getId());
    assert.strictEqual(sessions[4].getId(), anotherChild.getId());
    assert.strictEqual(sessions[5].getId(), thirdSession.getId());
  });
  test("decorations", () => {
    const session = createTestSession(model);
    disposables.add(session);
    model.addSession(session);
    const { firstStackFrame, secondStackFrame } = createTwoStackFrames(session);
    let decorations = createDecorationsForStackFrame(firstStackFrame, true, false);
    assert.strictEqual(decorations.length, 3);
    assert.deepStrictEqual(decorations[0].range, new Range(1, 2, 1, 3));
    assert.strictEqual(decorations[0].options.glyphMarginClassName, ThemeIcon.asClassName(debugStackframe));
    assert.deepStrictEqual(decorations[1].range, new Range(1, 2, 1, Constants.MAX_SAFE_SMALL_INTEGER));
    assert.strictEqual(decorations[1].options.className, "debug-top-stack-frame-line");
    assert.strictEqual(decorations[1].options.isWholeLine, true);
    decorations = createDecorationsForStackFrame(secondStackFrame, true, false);
    assert.strictEqual(decorations.length, 2);
    assert.deepStrictEqual(decorations[0].range, new Range(1, 2, 1, 3));
    assert.strictEqual(decorations[0].options.glyphMarginClassName, ThemeIcon.asClassName(debugStackframeFocused));
    assert.deepStrictEqual(decorations[1].range, new Range(1, 2, 1, Constants.MAX_SAFE_SMALL_INTEGER));
    assert.strictEqual(decorations[1].options.className, "debug-focused-stack-frame-line");
    assert.strictEqual(decorations[1].options.isWholeLine, true);
    decorations = createDecorationsForStackFrame(firstStackFrame, true, false);
    assert.strictEqual(decorations.length, 3);
    assert.deepStrictEqual(decorations[0].range, new Range(1, 2, 1, 3));
    assert.strictEqual(decorations[0].options.glyphMarginClassName, ThemeIcon.asClassName(debugStackframe));
    assert.deepStrictEqual(decorations[1].range, new Range(1, 2, 1, Constants.MAX_SAFE_SMALL_INTEGER));
    assert.strictEqual(decorations[1].options.className, "debug-top-stack-frame-line");
    assert.strictEqual(decorations[1].options.isWholeLine, true);
    assert.strictEqual(decorations[2].options.before?.inlineClassName, "debug-top-stack-frame-column");
    assert.deepStrictEqual(decorations[2].range, new Range(1, 2, 1, Constants.MAX_SAFE_SMALL_INTEGER));
  });
  test("contexts", () => {
    const session = createTestSession(model);
    disposables.add(session);
    model.addSession(session);
    const { firstStackFrame, secondStackFrame } = createTwoStackFrames(session);
    let context = getContext(firstStackFrame);
    assert.strictEqual(context.sessionId, firstStackFrame.thread.session.getId());
    assert.strictEqual(context.threadId, firstStackFrame.thread.getId());
    assert.strictEqual(context.frameId, firstStackFrame.getId());
    context = getContext(secondStackFrame.thread);
    assert.strictEqual(context.sessionId, secondStackFrame.thread.session.getId());
    assert.strictEqual(context.threadId, secondStackFrame.thread.getId());
    assert.strictEqual(context.frameId, void 0);
    context = getContext(session);
    assert.strictEqual(context.sessionId, session.getId());
    assert.strictEqual(context.threadId, void 0);
    assert.strictEqual(context.frameId, void 0);
    let contributedContext = getContextForContributedActions(firstStackFrame);
    assert.strictEqual(contributedContext, firstStackFrame.source.raw.path);
    contributedContext = getContextForContributedActions(firstStackFrame.thread);
    assert.strictEqual(contributedContext, firstStackFrame.thread.threadId);
    contributedContext = getContextForContributedActions(session);
    assert.strictEqual(contributedContext, session.getId());
  });
  test("focusStackFrameThreadAndSession", () => {
    const threadId1 = 1;
    const threadName1 = "firstThread";
    const threadId2 = 2;
    const threadName2 = "secondThread";
    const stoppedReason = "breakpoint";
    const session = new class extends DebugSession {
      get state() {
        return State.Stopped;
      }
    }(generateUuid(), { resolved: { name: "stoppedSession", type: "node", request: "launch" }, unresolved: void 0 }, void 0, model, void 0, void 0, void 0, void 0, void 0, void 0, mockWorkspaceContextService, void 0, void 0, void 0, mockUriIdentityService, new TestInstantiationService(), void 0, void 0, new NullLogService(), void 0, void 0, new TestAccessibilityService());
    disposables.add(session);
    const runningSession = createTestSession(model);
    disposables.add(runningSession);
    model.addSession(runningSession);
    model.addSession(session);
    session["raw"] = mockRawSession;
    model.rawUpdate({
      sessionId: session.getId(),
      threads: [{
        id: threadId1,
        name: threadName1
      }]
    });
    model.rawUpdate({
      sessionId: session.getId(),
      threads: [{
        id: threadId1,
        name: threadName1
      }, {
        id: threadId2,
        name: threadName2
      }],
      stoppedDetails: {
        reason: stoppedReason,
        threadId: 1,
        allThreadsStopped: true
      }
    });
    const thread = session.getThread(threadId1);
    const runningThread = session.getThread(threadId2);
    let toFocus = getStackFrameThreadAndSessionToFocus(model, void 0);
    assert.deepStrictEqual(toFocus, { stackFrame: void 0, thread, session });
    toFocus = getStackFrameThreadAndSessionToFocus(model, void 0, void 0, runningSession);
    assert.deepStrictEqual(toFocus, { stackFrame: void 0, thread: void 0, session: runningSession });
    toFocus = getStackFrameThreadAndSessionToFocus(model, void 0, thread);
    assert.deepStrictEqual(toFocus, { stackFrame: void 0, thread, session });
    toFocus = getStackFrameThreadAndSessionToFocus(model, void 0, runningThread);
    assert.deepStrictEqual(toFocus, { stackFrame: void 0, thread: runningThread, session });
    const stackFrame = new StackFrame(thread, 5, void 0, "stackframename2", void 0, void 0, 1, true);
    toFocus = getStackFrameThreadAndSessionToFocus(model, stackFrame);
    assert.deepStrictEqual(toFocus, { stackFrame, thread, session });
  });
});
export {
  createTestSession
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy90ZXN0L2Jyb3dzZXIvY2FsbFN0YWNrLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBzaW5vbiBmcm9tICdzaW5vbic7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgQ29uc3RhbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdWludC5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgVGVzdEFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS90ZXN0L2NvbW1vbi90ZXN0QWNjZXNzaWJpbGl0eVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0aW9uc0ZvclN0YWNrRnJhbWUgfSBmcm9tICcuLi8uLi9icm93c2VyL2NhbGxTdGFja0VkaXRvckNvbnRyaWJ1dGlvbi5qcyc7XG5pbXBvcnQgeyBnZXRDb250ZXh0LCBnZXRDb250ZXh0Rm9yQ29udHJpYnV0ZWRBY3Rpb25zLCBnZXRTcGVjaWZpY1NvdXJjZU5hbWUgfSBmcm9tICcuLi8uLi9icm93c2VyL2NhbGxTdGFja1ZpZXcuanMnO1xuaW1wb3J0IHsgZGVidWdTdGFja2ZyYW1lLCBkZWJ1Z1N0YWNrZnJhbWVGb2N1c2VkIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9kZWJ1Z0ljb25zLmpzJztcbmltcG9ydCB7IGdldFN0YWNrRnJhbWVUaHJlYWRBbmRTZXNzaW9uVG9Gb2N1cyB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvZGVidWdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IERlYnVnU2Vzc2lvbiB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvZGVidWdTZXNzaW9uLmpzJztcbmltcG9ydCB7IElEZWJ1Z1NlcnZpY2UsIElEZWJ1Z1Nlc3Npb25PcHRpb25zLCBTdGF0ZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z01vZGVsLCBTdGFja0ZyYW1lLCBUaHJlYWQgfSBmcm9tICcuLi8uLi9jb21tb24vZGVidWdNb2RlbC5qcyc7XG5pbXBvcnQgeyBTb3VyY2UgfSBmcm9tICcuLi8uLi9jb21tb24vZGVidWdTb3VyY2UuanMnO1xuaW1wb3J0IHsgY3JlYXRlTW9ja0RlYnVnTW9kZWwsIG1vY2tVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuL21vY2tEZWJ1Z01vZGVsLmpzJztcbmltcG9ydCB7IE1vY2tSYXdTZXNzaW9uIH0gZnJvbSAnLi4vY29tbW9uL21vY2tEZWJ1Zy5qcyc7XG5cbmNvbnN0IG1vY2tXb3Jrc3BhY2VDb250ZXh0U2VydmljZSA9IHtcblx0Z2V0V29ya3NwYWNlOiAoKSA9PiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGZvbGRlcnM6IFtdXG5cdFx0fTtcblx0fVxufSBhcyBhbnk7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVUZXN0U2Vzc2lvbihtb2RlbDogRGVidWdNb2RlbCwgbmFtZSA9ICdtb2NrU2Vzc2lvbicsIG9wdGlvbnM/OiBJRGVidWdTZXNzaW9uT3B0aW9ucyk6IERlYnVnU2Vzc2lvbiB7XG5cdHJldHVybiBuZXcgRGVidWdTZXNzaW9uKGdlbmVyYXRlVXVpZCgpLCB7IHJlc29sdmVkOiB7IG5hbWUsIHR5cGU6ICdub2RlJywgcmVxdWVzdDogJ2xhdW5jaCcgfSwgdW5yZXNvbHZlZDogdW5kZWZpbmVkIH0sIHVuZGVmaW5lZCwgbW9kZWwsIG9wdGlvbnMsIHtcblx0XHRnZXRWaWV3TW9kZWwoKTogYW55IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHVwZGF0ZVZpZXdzKCk6IHZvaWQge1xuXHRcdFx0XHRcdC8vIG5vb3Bcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cdH0gYXMgSURlYnVnU2VydmljZSwgdW5kZWZpbmVkISwgdW5kZWZpbmVkISwgbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7IGRlYnVnOiB7IGNvbnNvbGU6IHsgY29sbGFwc2VJZGVudGljYWxMaW5lczogdHJ1ZSB9IH0gfSksIHVuZGVmaW5lZCEsIG1vY2tXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgdW5kZWZpbmVkISwgdW5kZWZpbmVkISwgdW5kZWZpbmVkISwgbW9ja1VyaUlkZW50aXR5U2VydmljZSwgbmV3IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSgpLCB1bmRlZmluZWQhLCB1bmRlZmluZWQhLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSwgdW5kZWZpbmVkISwgdW5kZWZpbmVkISwgbmV3IFRlc3RBY2Nlc3NpYmlsaXR5U2VydmljZSgpKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVHdvU3RhY2tGcmFtZXMoc2Vzc2lvbjogRGVidWdTZXNzaW9uKTogeyBmaXJzdFN0YWNrRnJhbWU6IFN0YWNrRnJhbWU7IHNlY29uZFN0YWNrRnJhbWU6IFN0YWNrRnJhbWUgfSB7XG5cdGNvbnN0IHRocmVhZCA9IG5ldyBjbGFzcyBleHRlbmRzIFRocmVhZCB7XG5cdFx0cHVibGljIG92ZXJyaWRlIGdldENhbGxTdGFjaygpOiBTdGFja0ZyYW1lW10ge1xuXHRcdFx0cmV0dXJuIFtmaXJzdFN0YWNrRnJhbWUsIHNlY29uZFN0YWNrRnJhbWVdO1xuXHRcdH1cblx0fShzZXNzaW9uLCAnbW9ja3RocmVhZCcsIDEpO1xuXG5cdGNvbnN0IGZpcnN0U291cmNlID0gbmV3IFNvdXJjZSh7XG5cdFx0bmFtZTogJ2ludGVybmFsTW9kdWxlLmpzJyxcblx0XHRwYXRoOiAnYS9iL2MvZC9pbnRlcm5hbE1vZHVsZS5qcycsXG5cdFx0c291cmNlUmVmZXJlbmNlOiAxMCxcblx0fSwgJ2FEZWJ1Z1Nlc3Npb25JZCcsIG1vY2tVcmlJZGVudGl0eVNlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0Y29uc3Qgc2Vjb25kU291cmNlID0gbmV3IFNvdXJjZSh7XG5cdFx0bmFtZTogJ2ludGVybmFsTW9kdWxlLmpzJyxcblx0XHRwYXRoOiAnei94L2MvZC9pbnRlcm5hbE1vZHVsZS5qcycsXG5cdFx0c291cmNlUmVmZXJlbmNlOiAxMSxcblx0fSwgJ2FEZWJ1Z1Nlc3Npb25JZCcsIG1vY2tVcmlJZGVudGl0eVNlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblxuXHRjb25zdCBmaXJzdFN0YWNrRnJhbWUgPSBuZXcgU3RhY2tGcmFtZSh0aHJlYWQsIDAsIGZpcnN0U291cmNlLCAnYXBwLmpzJywgJ25vcm1hbCcsIHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMiwgZW5kTGluZU51bWJlcjogMSwgZW5kQ29sdW1uOiAxMCB9LCAwLCB0cnVlKTtcblx0Y29uc3Qgc2Vjb25kU3RhY2tGcmFtZSA9IG5ldyBTdGFja0ZyYW1lKHRocmVhZCwgMSwgc2Vjb25kU291cmNlLCAnYXBwMi5qcycsICdub3JtYWwnLCB7IHN0YXJ0TGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDIsIGVuZExpbmVOdW1iZXI6IDEsIGVuZENvbHVtbjogMTAgfSwgMSwgdHJ1ZSk7XG5cblx0cmV0dXJuIHsgZmlyc3RTdGFja0ZyYW1lLCBzZWNvbmRTdGFja0ZyYW1lIH07XG59XG5cbnN1aXRlKCdEZWJ1ZyAtIENhbGxTdGFjaycsICgpID0+IHtcblx0bGV0IG1vZGVsOiBEZWJ1Z01vZGVsO1xuXHRsZXQgbW9ja1Jhd1Nlc3Npb246IE1vY2tSYXdTZXNzaW9uO1xuXHRjb25zdCBkaXNwb3NhYmxlcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRtb2RlbCA9IGNyZWF0ZU1vY2tEZWJ1Z01vZGVsKGRpc3Bvc2FibGVzKTtcblx0XHRtb2NrUmF3U2Vzc2lvbiA9IG5ldyBNb2NrUmF3U2Vzc2lvbigpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0c2lub24ucmVzdG9yZSgpO1xuXHR9KTtcblxuXHQvLyBUaHJlYWRzXG5cblx0dGVzdCgndGhyZWFkcyBzaW1wbGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdGhyZWFkSWQgPSAxO1xuXHRcdGNvbnN0IHRocmVhZE5hbWUgPSAnZmlyc3RUaHJlYWQnO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBjcmVhdGVUZXN0U2Vzc2lvbihtb2RlbCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlc3Npb24pO1xuXHRcdG1vZGVsLmFkZFNlc3Npb24oc2Vzc2lvbik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0U2Vzc2lvbnModHJ1ZSkubGVuZ3RoLCAxKTtcblx0XHRtb2RlbC5yYXdVcGRhdGUoe1xuXHRcdFx0c2Vzc2lvbklkOiBzZXNzaW9uLmdldElkKCksXG5cdFx0XHR0aHJlYWRzOiBbe1xuXHRcdFx0XHRpZDogdGhyZWFkSWQsXG5cdFx0XHRcdG5hbWU6IHRocmVhZE5hbWVcblx0XHRcdH1dXG5cdFx0fSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5nZXRUaHJlYWQodGhyZWFkSWQpIS5uYW1lLCB0aHJlYWROYW1lKTtcblxuXHRcdG1vZGVsLmNsZWFyVGhyZWFkcyhzZXNzaW9uLmdldElkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLmdldFRocmVhZCh0aHJlYWRJZCksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFNlc3Npb25zKHRydWUpLmxlbmd0aCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3RocmVhZHMgbXVsdGlwbGUgd2l0aCBhbGxUaHJlYWRzU3RvcHBlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0aHJlYWRJZDEgPSAxO1xuXHRcdGNvbnN0IHRocmVhZE5hbWUxID0gJ2ZpcnN0VGhyZWFkJztcblx0XHRjb25zdCB0aHJlYWRJZDIgPSAyO1xuXHRcdGNvbnN0IHRocmVhZE5hbWUyID0gJ3NlY29uZFRocmVhZCc7XG5cdFx0Y29uc3Qgc3RvcHBlZFJlYXNvbiA9ICdicmVha3BvaW50JztcblxuXHRcdC8vIEFkZCB0aGUgdGhyZWFkc1xuXHRcdGNvbnN0IHNlc3Npb24gPSBjcmVhdGVUZXN0U2Vzc2lvbihtb2RlbCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlc3Npb24pO1xuXHRcdG1vZGVsLmFkZFNlc3Npb24oc2Vzc2lvbik7XG5cblx0XHRzZXNzaW9uWydyYXcnXSA9IDxhbnk+bW9ja1Jhd1Nlc3Npb247XG5cblx0XHRtb2RlbC5yYXdVcGRhdGUoe1xuXHRcdFx0c2Vzc2lvbklkOiBzZXNzaW9uLmdldElkKCksXG5cdFx0XHR0aHJlYWRzOiBbe1xuXHRcdFx0XHRpZDogdGhyZWFkSWQxLFxuXHRcdFx0XHRuYW1lOiB0aHJlYWROYW1lMVxuXHRcdFx0fV1cblx0XHR9KTtcblxuXHRcdC8vIFN0b3BwZWQgZXZlbnQgd2l0aCBhbGwgdGhyZWFkcyBzdG9wcGVkXG5cdFx0bW9kZWwucmF3VXBkYXRlKHtcblx0XHRcdHNlc3Npb25JZDogc2Vzc2lvbi5nZXRJZCgpLFxuXHRcdFx0dGhyZWFkczogW3tcblx0XHRcdFx0aWQ6IHRocmVhZElkMSxcblx0XHRcdFx0bmFtZTogdGhyZWFkTmFtZTFcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IHRocmVhZElkMixcblx0XHRcdFx0bmFtZTogdGhyZWFkTmFtZTJcblx0XHRcdH1dLFxuXHRcdFx0c3RvcHBlZERldGFpbHM6IHtcblx0XHRcdFx0cmVhc29uOiBzdG9wcGVkUmVhc29uLFxuXHRcdFx0XHR0aHJlYWRJZDogMSxcblx0XHRcdFx0YWxsVGhyZWFkc1N0b3BwZWQ6IHRydWVcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHRjb25zdCB0aHJlYWQxID0gc2Vzc2lvbi5nZXRUaHJlYWQodGhyZWFkSWQxKSE7XG5cdFx0Y29uc3QgdGhyZWFkMiA9IHNlc3Npb24uZ2V0VGhyZWFkKHRocmVhZElkMikhO1xuXG5cdFx0Ly8gYXQgdGhlIGJlZ2lubmluZywgY2FsbHN0YWNrcyBhcmUgb2J0YWluYWJsZSBidXQgbm90IGF2YWlsYWJsZVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLmdldEFsbFRocmVhZHMoKS5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aHJlYWQxLm5hbWUsIHRocmVhZE5hbWUxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhyZWFkMS5zdG9wcGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhyZWFkMS5nZXRDYWxsU3RhY2soKS5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aHJlYWQxLnN0b3BwZWREZXRhaWxzIS5yZWFzb24sIHN0b3BwZWRSZWFzb24pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aHJlYWQyLm5hbWUsIHRocmVhZE5hbWUyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhyZWFkMi5zdG9wcGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhyZWFkMi5nZXRDYWxsU3RhY2soKS5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aHJlYWQyLnN0b3BwZWREZXRhaWxzIS5yZWFzb24sIHVuZGVmaW5lZCk7XG5cblx0XHQvLyBhZnRlciBjYWxsaW5nIGdldENhbGxTdGFjaywgdGhlIGNhbGxzdGFjayBiZWNvbWVzIGF2YWlsYWJsZVxuXHRcdC8vIGFuZCByZXN1bHRzIGluIGEgcmVxdWVzdCBmb3IgdGhlIGNhbGxzdGFjayBpbiB0aGUgZGVidWcgYWRhcHRlclxuXHRcdGF3YWl0IHRocmVhZDEuZmV0Y2hDYWxsU3RhY2soKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodGhyZWFkMS5nZXRDYWxsU3RhY2soKS5sZW5ndGgsIDApO1xuXG5cdFx0YXdhaXQgdGhyZWFkMi5mZXRjaENhbGxTdGFjaygpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0aHJlYWQyLmdldENhbGxTdGFjaygpLmxlbmd0aCwgMCk7XG5cblx0XHQvLyBjYWxsaW5nIG11bHRpcGxlIHRpbWVzIGdldENhbGxTdGFjayBkb2Vzbid0IHJlc3VsdCBpbiBtdWx0aXBsZSBjYWxsc1xuXHRcdC8vIHRvIHRoZSBkZWJ1ZyBhZGFwdGVyXG5cdFx0YXdhaXQgdGhyZWFkMS5mZXRjaENhbGxTdGFjaygpO1xuXHRcdGF3YWl0IHRocmVhZDIuZmV0Y2hDYWxsU3RhY2soKTtcblxuXHRcdC8vIGNsZWFyaW5nIHRoZSBjYWxsc3RhY2sgcmVzdWx0cyBpbiB0aGUgY2FsbHN0YWNrIG5vdCBiZWluZyBhdmFpbGFibGVcblx0XHR0aHJlYWQxLmNsZWFyQ2FsbFN0YWNrKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRocmVhZDEuc3RvcHBlZCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRocmVhZDEuZ2V0Q2FsbFN0YWNrKCkubGVuZ3RoLCAwKTtcblxuXHRcdHRocmVhZDIuY2xlYXJDYWxsU3RhY2soKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhyZWFkMi5zdG9wcGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhyZWFkMi5nZXRDYWxsU3RhY2soKS5sZW5ndGgsIDApO1xuXG5cdFx0bW9kZWwuY2xlYXJUaHJlYWRzKHNlc3Npb24uZ2V0SWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uZ2V0VGhyZWFkKHRocmVhZElkMSksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uZ2V0VGhyZWFkKHRocmVhZElkMiksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uZ2V0QWxsVGhyZWFkcygpLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FsbFRocmVhZHNTdG9wcGVkIGluIG11bHRpcGxlIGV2ZW50cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0aHJlYWRJZDEgPSAxO1xuXHRcdGNvbnN0IHRocmVhZE5hbWUxID0gJ2ZpcnN0VGhyZWFkJztcblx0XHRjb25zdCB0aHJlYWRJZDIgPSAyO1xuXHRcdGNvbnN0IHRocmVhZE5hbWUyID0gJ3NlY29uZFRocmVhZCc7XG5cdFx0Y29uc3Qgc3RvcHBlZFJlYXNvbiA9ICdicmVha3BvaW50JztcblxuXHRcdC8vIEFkZCB0aGUgdGhyZWFkc1xuXHRcdGNvbnN0IHNlc3Npb24gPSBjcmVhdGVUZXN0U2Vzc2lvbihtb2RlbCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlc3Npb24pO1xuXHRcdG1vZGVsLmFkZFNlc3Npb24oc2Vzc2lvbik7XG5cblx0XHRzZXNzaW9uWydyYXcnXSA9IDxhbnk+bW9ja1Jhd1Nlc3Npb247XG5cblx0XHQvLyBTdG9wcGVkIGV2ZW50IHdpdGggYWxsIHRocmVhZHMgc3RvcHBlZFxuXHRcdG1vZGVsLnJhd1VwZGF0ZSh7XG5cdFx0XHRzZXNzaW9uSWQ6IHNlc3Npb24uZ2V0SWQoKSxcblx0XHRcdHRocmVhZHM6IFt7XG5cdFx0XHRcdGlkOiB0aHJlYWRJZDEsXG5cdFx0XHRcdG5hbWU6IHRocmVhZE5hbWUxXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiB0aHJlYWRJZDIsXG5cdFx0XHRcdG5hbWU6IHRocmVhZE5hbWUyXG5cdFx0XHR9XSxcblx0XHRcdHN0b3BwZWREZXRhaWxzOiB7XG5cdFx0XHRcdHJlYXNvbjogc3RvcHBlZFJlYXNvbixcblx0XHRcdFx0dGhyZWFkSWQ6IHRocmVhZElkMSxcblx0XHRcdFx0YWxsVGhyZWFkc1N0b3BwZWQ6IHRydWVcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHRtb2RlbC5yYXdVcGRhdGUoe1xuXHRcdFx0c2Vzc2lvbklkOiBzZXNzaW9uLmdldElkKCksXG5cdFx0XHR0aHJlYWRzOiBbe1xuXHRcdFx0XHRpZDogdGhyZWFkSWQxLFxuXHRcdFx0XHRuYW1lOiB0aHJlYWROYW1lMVxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogdGhyZWFkSWQyLFxuXHRcdFx0XHRuYW1lOiB0aHJlYWROYW1lMlxuXHRcdFx0fV0sXG5cdFx0XHRzdG9wcGVkRGV0YWlsczoge1xuXHRcdFx0XHRyZWFzb246IHN0b3BwZWRSZWFzb24sXG5cdFx0XHRcdHRocmVhZElkOiB0aHJlYWRJZDIsXG5cdFx0XHRcdGFsbFRocmVhZHNTdG9wcGVkOiB0cnVlXG5cdFx0XHR9LFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdGhyZWFkMSA9IHNlc3Npb24uZ2V0VGhyZWFkKHRocmVhZElkMSkhO1xuXHRcdGNvbnN0IHRocmVhZDIgPSBzZXNzaW9uLmdldFRocmVhZCh0aHJlYWRJZDIpITtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aHJlYWQxLnN0b3BwZWREZXRhaWxzPy5yZWFzb24sIHN0b3BwZWRSZWFzb24pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aHJlYWQyLnN0b3BwZWREZXRhaWxzPy5yZWFzb24sIHN0b3BwZWRSZWFzb24pO1xuXHR9KTtcblxuXHR0ZXN0KCd0aHJlYWRzIG11bHRpcGxlIHdpdGhvdXQgYWxsVGhyZWFkc1N0b3BwZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc2Vzc2lvblN0dWIgPSBzaW5vbi5zcHkobW9ja1Jhd1Nlc3Npb24sICdzdGFja1RyYWNlJyk7XG5cblx0XHRjb25zdCBzdG9wcGVkVGhyZWFkSWQgPSAxO1xuXHRcdGNvbnN0IHN0b3BwZWRUaHJlYWROYW1lID0gJ3N0b3BwZWRUaHJlYWQnO1xuXHRcdGNvbnN0IHJ1bm5pbmdUaHJlYWRJZCA9IDI7XG5cdFx0Y29uc3QgcnVubmluZ1RocmVhZE5hbWUgPSAncnVubmluZ1RocmVhZCc7XG5cdFx0Y29uc3Qgc3RvcHBlZFJlYXNvbiA9ICdicmVha3BvaW50Jztcblx0XHRjb25zdCBzZXNzaW9uID0gY3JlYXRlVGVzdFNlc3Npb24obW9kZWwpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChzZXNzaW9uKTtcblx0XHRtb2RlbC5hZGRTZXNzaW9uKHNlc3Npb24pO1xuXG5cdFx0c2Vzc2lvblsncmF3J10gPSA8YW55Pm1vY2tSYXdTZXNzaW9uO1xuXG5cdFx0Ly8gQWRkIHRoZSB0aHJlYWRzXG5cdFx0bW9kZWwucmF3VXBkYXRlKHtcblx0XHRcdHNlc3Npb25JZDogc2Vzc2lvbi5nZXRJZCgpLFxuXHRcdFx0dGhyZWFkczogW3tcblx0XHRcdFx0aWQ6IHN0b3BwZWRUaHJlYWRJZCxcblx0XHRcdFx0bmFtZTogc3RvcHBlZFRocmVhZE5hbWVcblx0XHRcdH1dXG5cdFx0fSk7XG5cblx0XHQvLyBTdG9wcGVkIGV2ZW50IHdpdGggb25seSBvbmUgdGhyZWFkIHN0b3BwZWRcblx0XHRtb2RlbC5yYXdVcGRhdGUoe1xuXHRcdFx0c2Vzc2lvbklkOiBzZXNzaW9uLmdldElkKCksXG5cdFx0XHR0aHJlYWRzOiBbe1xuXHRcdFx0XHRpZDogMSxcblx0XHRcdFx0bmFtZTogc3RvcHBlZFRocmVhZE5hbWVcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IHJ1bm5pbmdUaHJlYWRJZCxcblx0XHRcdFx0bmFtZTogcnVubmluZ1RocmVhZE5hbWVcblx0XHRcdH1dLFxuXHRcdFx0c3RvcHBlZERldGFpbHM6IHtcblx0XHRcdFx0cmVhc29uOiBzdG9wcGVkUmVhc29uLFxuXHRcdFx0XHR0aHJlYWRJZDogMSxcblx0XHRcdFx0YWxsVGhyZWFkc1N0b3BwZWQ6IGZhbHNlXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBzdG9wcGVkVGhyZWFkID0gc2Vzc2lvbi5nZXRUaHJlYWQoc3RvcHBlZFRocmVhZElkKSE7XG5cdFx0Y29uc3QgcnVubmluZ1RocmVhZCA9IHNlc3Npb24uZ2V0VGhyZWFkKHJ1bm5pbmdUaHJlYWRJZCkhO1xuXG5cdFx0Ly8gdGhlIGNhbGxzdGFjayBmb3IgdGhlIHN0b3BwZWQgdGhyZWFkIGlzIG9idGFpbmFibGUgYnV0IG5vdCBhdmFpbGFibGVcblx0XHQvLyB0aGUgY2FsbHN0YWNrIGZvciB0aGUgcnVubmluZyB0aHJlYWQgaXMgbm90IG9idGFpbmFibGUgbm9yIGF2YWlsYWJsZVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdG9wcGVkVGhyZWFkLm5hbWUsIHN0b3BwZWRUaHJlYWROYW1lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RvcHBlZFRocmVhZC5zdG9wcGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5nZXRBbGxUaHJlYWRzKCkubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RvcHBlZFRocmVhZC5nZXRDYWxsU3RhY2soKS5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdG9wcGVkVGhyZWFkLnN0b3BwZWREZXRhaWxzIS5yZWFzb24sIHN0b3BwZWRSZWFzb24pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChydW5uaW5nVGhyZWFkLm5hbWUsIHJ1bm5pbmdUaHJlYWROYW1lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocnVubmluZ1RocmVhZC5zdG9wcGVkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJ1bm5pbmdUaHJlYWQuZ2V0Q2FsbFN0YWNrKCkubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocnVubmluZ1RocmVhZC5zdG9wcGVkRGV0YWlscywgdW5kZWZpbmVkKTtcblxuXHRcdC8vIGFmdGVyIGNhbGxpbmcgZ2V0Q2FsbFN0YWNrLCB0aGUgY2FsbHN0YWNrIGJlY29tZXMgYXZhaWxhYmxlXG5cdFx0Ly8gYW5kIHJlc3VsdHMgaW4gYSByZXF1ZXN0IGZvciB0aGUgY2FsbHN0YWNrIGluIHRoZSBkZWJ1ZyBhZGFwdGVyXG5cdFx0YXdhaXQgc3RvcHBlZFRocmVhZC5mZXRjaENhbGxTdGFjaygpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChzdG9wcGVkVGhyZWFkLmdldENhbGxTdGFjaygpLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJ1bm5pbmdUaHJlYWQuZ2V0Q2FsbFN0YWNrKCkubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvblN0dWIuY2FsbENvdW50LCAxKTtcblxuXHRcdC8vIGNhbGxpbmcgZ2V0Q2FsbFN0YWNrIG9uIHRoZSBydW5uaW5nIHRocmVhZCByZXR1cm5zIGVtcHR5IGFycmF5XG5cdFx0Ly8gYW5kIGRvZXMgbm90IHJldHVybiBpbiBhIHJlcXVlc3QgZm9yIHRoZSBjYWxsc3RhY2sgaW4gdGhlIGRlYnVnXG5cdFx0Ly8gYWRhcHRlclxuXHRcdGF3YWl0IHJ1bm5pbmdUaHJlYWQuZmV0Y2hDYWxsU3RhY2soKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocnVubmluZ1RocmVhZC5nZXRDYWxsU3RhY2soKS5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uU3R1Yi5jYWxsQ291bnQsIDEpO1xuXG5cdFx0Ly8gY2xlYXJpbmcgdGhlIGNhbGxzdGFjayByZXN1bHRzIGluIHRoZSBjYWxsc3RhY2sgbm90IGJlaW5nIGF2YWlsYWJsZVxuXHRcdHN0b3BwZWRUaHJlYWQuY2xlYXJDYWxsU3RhY2soKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RvcHBlZFRocmVhZC5zdG9wcGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RvcHBlZFRocmVhZC5nZXRDYWxsU3RhY2soKS5sZW5ndGgsIDApO1xuXG5cdFx0bW9kZWwuY2xlYXJUaHJlYWRzKHNlc3Npb24uZ2V0SWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uZ2V0VGhyZWFkKHN0b3BwZWRUaHJlYWRJZCksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uZ2V0VGhyZWFkKHJ1bm5pbmdUaHJlYWRJZCksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uZ2V0QWxsVGhyZWFkcygpLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N0YWNrIGZyYW1lIGdldCBzcGVjaWZpYyBzb3VyY2UgbmFtZScsICgpID0+IHtcblx0XHRjb25zdCBzZXNzaW9uID0gY3JlYXRlVGVzdFNlc3Npb24obW9kZWwpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChzZXNzaW9uKTtcblx0XHRtb2RlbC5hZGRTZXNzaW9uKHNlc3Npb24pO1xuXHRcdGNvbnN0IHsgZmlyc3RTdGFja0ZyYW1lLCBzZWNvbmRTdGFja0ZyYW1lIH0gPSBjcmVhdGVUd29TdGFja0ZyYW1lcyhzZXNzaW9uKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRTcGVjaWZpY1NvdXJjZU5hbWUoZmlyc3RTdGFja0ZyYW1lKSwgJy4uLi9iL2MvZC9pbnRlcm5hbE1vZHVsZS5qcycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRTcGVjaWZpY1NvdXJjZU5hbWUoc2Vjb25kU3RhY2tGcmFtZSksICcuLi4veC9jL2QvaW50ZXJuYWxNb2R1bGUuanMnKTtcblx0fSk7XG5cblx0dGVzdCgnc3RhY2sgZnJhbWUgdG9TdHJpbmcoKScsICgpID0+IHtcblx0XHRjb25zdCBzZXNzaW9uID0gY3JlYXRlVGVzdFNlc3Npb24obW9kZWwpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChzZXNzaW9uKTtcblx0XHRjb25zdCB0aHJlYWQgPSBuZXcgVGhyZWFkKHNlc3Npb24sICdtb2NrdGhyZWFkJywgMSk7XG5cdFx0Y29uc3QgZmlyc3RTb3VyY2UgPSBuZXcgU291cmNlKHtcblx0XHRcdG5hbWU6ICdpbnRlcm5hbE1vZHVsZS5qcycsXG5cdFx0XHRwYXRoOiAnYS9iL2MvZC9pbnRlcm5hbE1vZHVsZS5qcycsXG5cdFx0XHRzb3VyY2VSZWZlcmVuY2U6IDEwLFxuXHRcdH0sICdhRGVidWdTZXNzaW9uSWQnLCBtb2NrVXJpSWRlbnRpdHlTZXJ2aWNlLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cdFx0Y29uc3Qgc3RhY2tGcmFtZSA9IG5ldyBTdGFja0ZyYW1lKHRocmVhZCwgMSwgZmlyc3RTb3VyY2UsICdhcHAnLCAnbm9ybWFsJywgeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDEwIH0sIDEsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGFja0ZyYW1lLnRvU3RyaW5nKCksICdhcHAgKGludGVybmFsTW9kdWxlLmpzOjEpJyk7XG5cblx0XHRjb25zdCBzZWNvbmRTb3VyY2UgPSBuZXcgU291cmNlKHVuZGVmaW5lZCwgJ2FEZWJ1Z1Nlc3Npb25JZCcsIG1vY2tVcmlJZGVudGl0eVNlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0XHRjb25zdCBzdGFja0ZyYW1lMiA9IG5ldyBTdGFja0ZyYW1lKHRocmVhZCwgMiwgc2Vjb25kU291cmNlLCAnbW9kdWxlJywgJ25vcm1hbCcsIHsgc3RhcnRMaW5lTnVtYmVyOiB1bmRlZmluZWQhLCBzdGFydENvbHVtbjogdW5kZWZpbmVkISwgZW5kTGluZU51bWJlcjogdW5kZWZpbmVkISwgZW5kQ29sdW1uOiB1bmRlZmluZWQhIH0sIDIsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGFja0ZyYW1lMi50b1N0cmluZygpLCAnbW9kdWxlJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlYnVnIGNoaWxkIHNlc3Npb25zIGFyZSBhZGRlZCBpbiBjb3JyZWN0IG9yZGVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IHNlc3Npb24gPSBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlVGVzdFNlc3Npb24obW9kZWwpKTtcblx0XHRtb2RlbC5hZGRTZXNzaW9uKHNlc3Npb24pO1xuXHRcdGNvbnN0IHNlY29uZFNlc3Npb24gPSBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlVGVzdFNlc3Npb24obW9kZWwsICdtb2NrU2Vzc2lvbjInKSk7XG5cdFx0bW9kZWwuYWRkU2Vzc2lvbihzZWNvbmRTZXNzaW9uKTtcblx0XHRjb25zdCBmaXJzdENoaWxkID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZVRlc3RTZXNzaW9uKG1vZGVsLCAnZmlyc3RDaGlsZCcsIHsgcGFyZW50U2Vzc2lvbjogc2Vzc2lvbiB9KSk7XG5cdFx0bW9kZWwuYWRkU2Vzc2lvbihmaXJzdENoaWxkKTtcblx0XHRjb25zdCBzZWNvbmRDaGlsZCA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXN0U2Vzc2lvbihtb2RlbCwgJ3NlY29uZENoaWxkJywgeyBwYXJlbnRTZXNzaW9uOiBzZXNzaW9uIH0pKTtcblx0XHRtb2RlbC5hZGRTZXNzaW9uKHNlY29uZENoaWxkKTtcblx0XHRjb25zdCB0aGlyZFNlc3Npb24gPSBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlVGVzdFNlc3Npb24obW9kZWwsICdtb2NrU2Vzc2lvbjMnKSk7XG5cdFx0bW9kZWwuYWRkU2Vzc2lvbih0aGlyZFNlc3Npb24pO1xuXHRcdGNvbnN0IGFub3RoZXJDaGlsZCA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXN0U2Vzc2lvbihtb2RlbCwgJ3NlY29uZENoaWxkJywgeyBwYXJlbnRTZXNzaW9uOiBzZWNvbmRTZXNzaW9uIH0pKTtcblx0XHRtb2RlbC5hZGRTZXNzaW9uKGFub3RoZXJDaGlsZCk7XG5cblx0XHRjb25zdCBzZXNzaW9ucyA9IG1vZGVsLmdldFNlc3Npb25zKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25zWzBdLmdldElkKCksIHNlc3Npb24uZ2V0SWQoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25zWzFdLmdldElkKCksIGZpcnN0Q2hpbGQuZ2V0SWQoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25zWzJdLmdldElkKCksIHNlY29uZENoaWxkLmdldElkKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uc1szXS5nZXRJZCgpLCBzZWNvbmRTZXNzaW9uLmdldElkKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uc1s0XS5nZXRJZCgpLCBhbm90aGVyQ2hpbGQuZ2V0SWQoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25zWzVdLmdldElkKCksIHRoaXJkU2Vzc2lvbi5nZXRJZCgpKTtcblx0fSk7XG5cblx0dGVzdCgnZGVjb3JhdGlvbnMnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGNyZWF0ZVRlc3RTZXNzaW9uKG1vZGVsKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoc2Vzc2lvbik7XG5cdFx0bW9kZWwuYWRkU2Vzc2lvbihzZXNzaW9uKTtcblx0XHRjb25zdCB7IGZpcnN0U3RhY2tGcmFtZSwgc2Vjb25kU3RhY2tGcmFtZSB9ID0gY3JlYXRlVHdvU3RhY2tGcmFtZXMoc2Vzc2lvbik7XG5cdFx0bGV0IGRlY29yYXRpb25zID0gY3JlYXRlRGVjb3JhdGlvbnNGb3JTdGFja0ZyYW1lKGZpcnN0U3RhY2tGcmFtZSwgdHJ1ZSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWNvcmF0aW9ucy5sZW5ndGgsIDMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGVjb3JhdGlvbnNbMF0ucmFuZ2UsIG5ldyBSYW5nZSgxLCAyLCAxLCAzKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlY29yYXRpb25zWzBdLm9wdGlvbnMuZ2x5cGhNYXJnaW5DbGFzc05hbWUsIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShkZWJ1Z1N0YWNrZnJhbWUpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGRlY29yYXRpb25zWzFdLnJhbmdlLCBuZXcgUmFuZ2UoMSwgMiwgMSwgQ29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVIpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVjb3JhdGlvbnNbMV0ub3B0aW9ucy5jbGFzc05hbWUsICdkZWJ1Zy10b3Atc3RhY2stZnJhbWUtbGluZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWNvcmF0aW9uc1sxXS5vcHRpb25zLmlzV2hvbGVMaW5lLCB0cnVlKTtcblxuXHRcdGRlY29yYXRpb25zID0gY3JlYXRlRGVjb3JhdGlvbnNGb3JTdGFja0ZyYW1lKHNlY29uZFN0YWNrRnJhbWUsIHRydWUsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVjb3JhdGlvbnMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGRlY29yYXRpb25zWzBdLnJhbmdlLCBuZXcgUmFuZ2UoMSwgMiwgMSwgMykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWNvcmF0aW9uc1swXS5vcHRpb25zLmdseXBoTWFyZ2luQ2xhc3NOYW1lLCBUaGVtZUljb24uYXNDbGFzc05hbWUoZGVidWdTdGFja2ZyYW1lRm9jdXNlZCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGVjb3JhdGlvbnNbMV0ucmFuZ2UsIG5ldyBSYW5nZSgxLCAyLCAxLCBDb25zdGFudHMuTUFYX1NBRkVfU01BTExfSU5URUdFUikpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWNvcmF0aW9uc1sxXS5vcHRpb25zLmNsYXNzTmFtZSwgJ2RlYnVnLWZvY3VzZWQtc3RhY2stZnJhbWUtbGluZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWNvcmF0aW9uc1sxXS5vcHRpb25zLmlzV2hvbGVMaW5lLCB0cnVlKTtcblxuXHRcdGRlY29yYXRpb25zID0gY3JlYXRlRGVjb3JhdGlvbnNGb3JTdGFja0ZyYW1lKGZpcnN0U3RhY2tGcmFtZSwgdHJ1ZSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWNvcmF0aW9ucy5sZW5ndGgsIDMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGVjb3JhdGlvbnNbMF0ucmFuZ2UsIG5ldyBSYW5nZSgxLCAyLCAxLCAzKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlY29yYXRpb25zWzBdLm9wdGlvbnMuZ2x5cGhNYXJnaW5DbGFzc05hbWUsIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShkZWJ1Z1N0YWNrZnJhbWUpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGRlY29yYXRpb25zWzFdLnJhbmdlLCBuZXcgUmFuZ2UoMSwgMiwgMSwgQ29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVIpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVjb3JhdGlvbnNbMV0ub3B0aW9ucy5jbGFzc05hbWUsICdkZWJ1Zy10b3Atc3RhY2stZnJhbWUtbGluZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWNvcmF0aW9uc1sxXS5vcHRpb25zLmlzV2hvbGVMaW5lLCB0cnVlKTtcblx0XHQvLyBJbmxpbmUgZGVjb3JhdGlvbiBnZXRzIHJlbmRlcmVkIGluIHRoaXMgY2FzZVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWNvcmF0aW9uc1syXS5vcHRpb25zLmJlZm9yZT8uaW5saW5lQ2xhc3NOYW1lLCAnZGVidWctdG9wLXN0YWNrLWZyYW1lLWNvbHVtbicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGVjb3JhdGlvbnNbMl0ucmFuZ2UsIG5ldyBSYW5nZSgxLCAyLCAxLCBDb25zdGFudHMuTUFYX1NBRkVfU01BTExfSU5URUdFUikpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb250ZXh0cycsICgpID0+IHtcblx0XHRjb25zdCBzZXNzaW9uID0gY3JlYXRlVGVzdFNlc3Npb24obW9kZWwpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChzZXNzaW9uKTtcblx0XHRtb2RlbC5hZGRTZXNzaW9uKHNlc3Npb24pO1xuXHRcdGNvbnN0IHsgZmlyc3RTdGFja0ZyYW1lLCBzZWNvbmRTdGFja0ZyYW1lIH0gPSBjcmVhdGVUd29TdGFja0ZyYW1lcyhzZXNzaW9uKTtcblx0XHRsZXQgY29udGV4dCA9IGdldENvbnRleHQoZmlyc3RTdGFja0ZyYW1lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC5zZXNzaW9uSWQsIGZpcnN0U3RhY2tGcmFtZS50aHJlYWQuc2Vzc2lvbi5nZXRJZCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC50aHJlYWRJZCwgZmlyc3RTdGFja0ZyYW1lLnRocmVhZC5nZXRJZCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC5mcmFtZUlkLCBmaXJzdFN0YWNrRnJhbWUuZ2V0SWQoKSk7XG5cblx0XHRjb250ZXh0ID0gZ2V0Q29udGV4dChzZWNvbmRTdGFja0ZyYW1lLnRocmVhZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQuc2Vzc2lvbklkLCBzZWNvbmRTdGFja0ZyYW1lLnRocmVhZC5zZXNzaW9uLmdldElkKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LnRocmVhZElkLCBzZWNvbmRTdGFja0ZyYW1lLnRocmVhZC5nZXRJZCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC5mcmFtZUlkLCB1bmRlZmluZWQpO1xuXG5cdFx0Y29udGV4dCA9IGdldENvbnRleHQoc2Vzc2lvbik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQuc2Vzc2lvbklkLCBzZXNzaW9uLmdldElkKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LnRocmVhZElkLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LmZyYW1lSWQsIHVuZGVmaW5lZCk7XG5cblx0XHRsZXQgY29udHJpYnV0ZWRDb250ZXh0ID0gZ2V0Q29udGV4dEZvckNvbnRyaWJ1dGVkQWN0aW9ucyhmaXJzdFN0YWNrRnJhbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250cmlidXRlZENvbnRleHQsIGZpcnN0U3RhY2tGcmFtZS5zb3VyY2UucmF3LnBhdGgpO1xuXHRcdGNvbnRyaWJ1dGVkQ29udGV4dCA9IGdldENvbnRleHRGb3JDb250cmlidXRlZEFjdGlvbnMoZmlyc3RTdGFja0ZyYW1lLnRocmVhZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRyaWJ1dGVkQ29udGV4dCwgZmlyc3RTdGFja0ZyYW1lLnRocmVhZC50aHJlYWRJZCk7XG5cdFx0Y29udHJpYnV0ZWRDb250ZXh0ID0gZ2V0Q29udGV4dEZvckNvbnRyaWJ1dGVkQWN0aW9ucyhzZXNzaW9uKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udHJpYnV0ZWRDb250ZXh0LCBzZXNzaW9uLmdldElkKCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdmb2N1c1N0YWNrRnJhbWVUaHJlYWRBbmRTZXNzaW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRocmVhZElkMSA9IDE7XG5cdFx0Y29uc3QgdGhyZWFkTmFtZTEgPSAnZmlyc3RUaHJlYWQnO1xuXHRcdGNvbnN0IHRocmVhZElkMiA9IDI7XG5cdFx0Y29uc3QgdGhyZWFkTmFtZTIgPSAnc2Vjb25kVGhyZWFkJztcblx0XHRjb25zdCBzdG9wcGVkUmVhc29uID0gJ2JyZWFrcG9pbnQnO1xuXG5cdFx0Ly8gQWRkIHRoZSB0aHJlYWRzXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IG5ldyBjbGFzcyBleHRlbmRzIERlYnVnU2Vzc2lvbiB7XG5cdFx0XHRvdmVycmlkZSBnZXQgc3RhdGUoKTogU3RhdGUge1xuXHRcdFx0XHRyZXR1cm4gU3RhdGUuU3RvcHBlZDtcblx0XHRcdH1cblx0XHR9KGdlbmVyYXRlVXVpZCgpLCB7IHJlc29sdmVkOiB7IG5hbWU6ICdzdG9wcGVkU2Vzc2lvbicsIHR5cGU6ICdub2RlJywgcmVxdWVzdDogJ2xhdW5jaCcgfSwgdW5yZXNvbHZlZDogdW5kZWZpbmVkIH0sIHVuZGVmaW5lZCwgbW9kZWwsIHVuZGVmaW5lZCwgdW5kZWZpbmVkISwgdW5kZWZpbmVkISwgdW5kZWZpbmVkISwgdW5kZWZpbmVkISwgdW5kZWZpbmVkISwgbW9ja1dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCB1bmRlZmluZWQhLCB1bmRlZmluZWQhLCB1bmRlZmluZWQhLCBtb2NrVXJpSWRlbnRpdHlTZXJ2aWNlLCBuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCksIHVuZGVmaW5lZCEsIHVuZGVmaW5lZCEsIG5ldyBOdWxsTG9nU2VydmljZSgpLCB1bmRlZmluZWQhLCB1bmRlZmluZWQhLCBuZXcgVGVzdEFjY2Vzc2liaWxpdHlTZXJ2aWNlKCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChzZXNzaW9uKTtcblxuXHRcdGNvbnN0IHJ1bm5pbmdTZXNzaW9uID0gY3JlYXRlVGVzdFNlc3Npb24obW9kZWwpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChydW5uaW5nU2Vzc2lvbik7XG5cdFx0bW9kZWwuYWRkU2Vzc2lvbihydW5uaW5nU2Vzc2lvbik7XG5cdFx0bW9kZWwuYWRkU2Vzc2lvbihzZXNzaW9uKTtcblxuXHRcdHNlc3Npb25bJ3JhdyddID0gPGFueT5tb2NrUmF3U2Vzc2lvbjtcblxuXHRcdG1vZGVsLnJhd1VwZGF0ZSh7XG5cdFx0XHRzZXNzaW9uSWQ6IHNlc3Npb24uZ2V0SWQoKSxcblx0XHRcdHRocmVhZHM6IFt7XG5cdFx0XHRcdGlkOiB0aHJlYWRJZDEsXG5cdFx0XHRcdG5hbWU6IHRocmVhZE5hbWUxXG5cdFx0XHR9XVxuXHRcdH0pO1xuXG5cdFx0Ly8gU3RvcHBlZCBldmVudCB3aXRoIGFsbCB0aHJlYWRzIHN0b3BwZWRcblx0XHRtb2RlbC5yYXdVcGRhdGUoe1xuXHRcdFx0c2Vzc2lvbklkOiBzZXNzaW9uLmdldElkKCksXG5cdFx0XHR0aHJlYWRzOiBbe1xuXHRcdFx0XHRpZDogdGhyZWFkSWQxLFxuXHRcdFx0XHRuYW1lOiB0aHJlYWROYW1lMVxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogdGhyZWFkSWQyLFxuXHRcdFx0XHRuYW1lOiB0aHJlYWROYW1lMlxuXHRcdFx0fV0sXG5cdFx0XHRzdG9wcGVkRGV0YWlsczoge1xuXHRcdFx0XHRyZWFzb246IHN0b3BwZWRSZWFzb24sXG5cdFx0XHRcdHRocmVhZElkOiAxLFxuXHRcdFx0XHRhbGxUaHJlYWRzU3RvcHBlZDogdHJ1ZVxuXHRcdFx0fSxcblx0XHR9KTtcblxuXHRcdGNvbnN0IHRocmVhZCA9IHNlc3Npb24uZ2V0VGhyZWFkKHRocmVhZElkMSkhO1xuXHRcdGNvbnN0IHJ1bm5pbmdUaHJlYWQgPSBzZXNzaW9uLmdldFRocmVhZCh0aHJlYWRJZDIpO1xuXG5cdFx0bGV0IHRvRm9jdXMgPSBnZXRTdGFja0ZyYW1lVGhyZWFkQW5kU2Vzc2lvblRvRm9jdXMobW9kZWwsIHVuZGVmaW5lZCk7XG5cdFx0Ly8gVmVyaWZ5IHN0b3BwZWQgc2Vzc2lvbiBhbmQgc3RvcHBlZCB0aHJlYWQgZ2V0IGZvY3VzZWRcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvRm9jdXMsIHsgc3RhY2tGcmFtZTogdW5kZWZpbmVkLCB0aHJlYWQ6IHRocmVhZCwgc2Vzc2lvbjogc2Vzc2lvbiB9KTtcblxuXHRcdHRvRm9jdXMgPSBnZXRTdGFja0ZyYW1lVGhyZWFkQW5kU2Vzc2lvblRvRm9jdXMobW9kZWwsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBydW5uaW5nU2Vzc2lvbik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0ZvY3VzLCB7IHN0YWNrRnJhbWU6IHVuZGVmaW5lZCwgdGhyZWFkOiB1bmRlZmluZWQsIHNlc3Npb246IHJ1bm5pbmdTZXNzaW9uIH0pO1xuXG5cdFx0dG9Gb2N1cyA9IGdldFN0YWNrRnJhbWVUaHJlYWRBbmRTZXNzaW9uVG9Gb2N1cyhtb2RlbCwgdW5kZWZpbmVkLCB0aHJlYWQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9Gb2N1cywgeyBzdGFja0ZyYW1lOiB1bmRlZmluZWQsIHRocmVhZDogdGhyZWFkLCBzZXNzaW9uOiBzZXNzaW9uIH0pO1xuXG5cdFx0dG9Gb2N1cyA9IGdldFN0YWNrRnJhbWVUaHJlYWRBbmRTZXNzaW9uVG9Gb2N1cyhtb2RlbCwgdW5kZWZpbmVkLCBydW5uaW5nVGhyZWFkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvRm9jdXMsIHsgc3RhY2tGcmFtZTogdW5kZWZpbmVkLCB0aHJlYWQ6IHJ1bm5pbmdUaHJlYWQsIHNlc3Npb246IHNlc3Npb24gfSk7XG5cblx0XHRjb25zdCBzdGFja0ZyYW1lID0gbmV3IFN0YWNrRnJhbWUodGhyZWFkLCA1LCB1bmRlZmluZWQhLCAnc3RhY2tmcmFtZW5hbWUyJywgdW5kZWZpbmVkLCB1bmRlZmluZWQhLCAxLCB0cnVlKTtcblx0XHR0b0ZvY3VzID0gZ2V0U3RhY2tGcmFtZVRocmVhZEFuZFNlc3Npb25Ub0ZvY3VzKG1vZGVsLCBzdGFja0ZyYW1lKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvRm9jdXMsIHsgc3RhY2tGcmFtZTogc3RhY2tGcmFtZSwgdGhyZWFkOiB0aHJlYWQsIHNlc3Npb246IHNlc3Npb24gfSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsYUFBYTtBQUN0QixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHNDQUFzQztBQUMvQyxTQUFTLFlBQVksaUNBQWlDLDZCQUE2QjtBQUNuRixTQUFTLGlCQUFpQiw4QkFBOEI7QUFDeEQsU0FBUyw0Q0FBNEM7QUFDckQsU0FBUyxvQkFBb0I7QUFDN0IsU0FBOEMsYUFBYTtBQUMzRCxTQUFxQixZQUFZLGNBQWM7QUFDL0MsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsc0JBQXNCLDhCQUE4QjtBQUM3RCxTQUFTLHNCQUFzQjtBQUUvQixNQUFNLDhCQUE4QjtBQUFBLEVBQ25DLGNBQWMsTUFBTTtBQUNuQixXQUFPO0FBQUEsTUFDTixTQUFTLENBQUM7QUFBQSxJQUNYO0FBQUEsRUFDRDtBQUNEO0FBRU8sU0FBUyxrQkFBa0IsT0FBbUIsT0FBTyxlQUFlLFNBQThDO0FBQ3hILFNBQU8sSUFBSSxhQUFhLGFBQWEsR0FBRyxFQUFFLFVBQVUsRUFBRSxNQUFNLE1BQU0sUUFBUSxTQUFTLFNBQVMsR0FBRyxZQUFZLE9BQVUsR0FBRyxRQUFXLE9BQU8sU0FBUztBQUFBLElBQ2xKLGVBQW9CO0FBQ25C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
