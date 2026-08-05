import { DeferredPromise } from "../../../../../base/common/async.js";
import { NullLogService } from "../../../../../platform/log/common/log.js";
import { AbstractDebugAdapter } from "../../common/abstractDebugAdapter.js";
import { State } from "../../common/debug.js";
import { DebugStorage } from "../../common/debugStorage.js";
class MockDebugService {
  get state() {
    throw new Error("not implemented");
  }
  get onWillNewSession() {
    throw new Error("not implemented");
  }
  get onDidNewSession() {
    throw new Error("not implemented");
  }
  get onDidEndSession() {
    throw new Error("not implemented");
  }
  get onDidChangeState() {
    throw new Error("not implemented");
  }
  getConfigurationManager() {
    throw new Error("not implemented");
  }
  getAdapterManager() {
    throw new Error("Method not implemented.");
  }
  canSetBreakpointsIn(model) {
    throw new Error("Method not implemented.");
  }
  focusStackFrame(focusedStackFrame) {
    throw new Error("not implemented");
  }
  sendAllBreakpoints(session) {
    throw new Error("not implemented");
  }
  sendBreakpoints(modelUri, sourceModified, session) {
    throw new Error("not implemented");
  }
  addBreakpoints(uri2, rawBreakpoints) {
    throw new Error("not implemented");
  }
  updateBreakpoints(uri2, data, sendOnResourceSaved) {
    throw new Error("not implemented");
  }
  enableOrDisableBreakpoints(enabled) {
    throw new Error("not implemented");
  }
  setBreakpointsActivated() {
    throw new Error("not implemented");
  }
  removeBreakpoints() {
    throw new Error("not implemented");
  }
  addInstructionBreakpoint(opts) {
    throw new Error("Method not implemented.");
  }
  removeInstructionBreakpoints(address) {
    throw new Error("Method not implemented.");
  }
  setExceptionBreakpointCondition(breakpoint, condition) {
    throw new Error("Method not implemented.");
  }
  setExceptionBreakpointsForSession(session, data) {
    throw new Error("Method not implemented.");
  }
  addFunctionBreakpoint() {
  }
  moveWatchExpression(id, position) {
  }
  updateFunctionBreakpoint(id, update) {
    throw new Error("not implemented");
  }
  removeFunctionBreakpoints(id) {
    throw new Error("not implemented");
  }
  addDataBreakpoint() {
    throw new Error("Method not implemented.");
  }
  updateDataBreakpoint(id, update) {
    throw new Error("not implemented");
  }
  removeDataBreakpoints(id) {
    throw new Error("Method not implemented.");
  }
  addReplExpression(name) {
    throw new Error("not implemented");
  }
  removeReplExpressions() {
  }
  addWatchExpression(name) {
    throw new Error("not implemented");
  }
  renameWatchExpression(id, newName) {
    throw new Error("not implemented");
  }
  removeWatchExpressions(id) {
  }
  startDebugging(launch, configOrName, options) {
    return Promise.resolve(true);
  }
  restartSession() {
    throw new Error("not implemented");
  }
  stopSession() {
    throw new Error("not implemented");
  }
  getModel() {
    throw new Error("not implemented");
  }
  getViewModel() {
    throw new Error("not implemented");
  }
  sourceIsNotAvailable(uri2) {
  }
  tryToAutoFocusStackFrame(thread) {
    throw new Error("not implemented");
  }
  runTo(uri2, lineNumber, column) {
    throw new Error("Method not implemented.");
  }
}
class MockSession {
  constructor() {
    this.suppressDebugToolbar = false;
    this.suppressDebugStatusbar = false;
    this.suppressDebugView = false;
    this.autoExpandLazyVariables = false;
    this.configuration = { type: "mock", name: "mock", request: "launch" };
    this.unresolvedConfiguration = { type: "mock", name: "mock", request: "launch" };
    this.state = State.Stopped;
    this.capabilities = {};
  }
  getMemory(memoryReference) {
    throw new Error("Method not implemented.");
  }
  get onDidInvalidateMemory() {
    throw new Error("Not implemented");
  }
  readMemory(memoryReference, offset, count) {
    throw new Error("Method not implemented.");
  }
  writeMemory(memoryReference, offset, data, allowPartial) {
    throw new Error("Method not implemented.");
  }
  cancelCorrelatedTestRun() {
  }
  get compoundRoot() {
    return void 0;
  }
  get saveBeforeRestart() {
    return true;
  }
  get isSimpleUI() {
    return false;
  }
  get lifecycleManagedByParent() {
    return false;
  }
  stepInTargets(frameId) {
    throw new Error("Method not implemented.");
  }
  cancel(_progressId) {
    throw new Error("Method not implemented.");
  }
  breakpointsLocations(uri2, lineNumber) {
    throw new Error("Method not implemented.");
  }
  dataBytesBreakpointInfo(address, bytes) {
    throw new Error("Method not implemented.");
  }
  dataBreakpointInfo(name, variablesReference) {
    throw new Error("Method not implemented.");
  }
  sendDataBreakpoints(dbps) {
    throw new Error("Method not implemented.");
  }
  get compact() {
    return false;
  }
  setSubId(subId) {
    throw new Error("Method not implemented.");
  }
  get parentSession() {
    return void 0;
  }
  getReplElements() {
    return [];
  }
  hasSeparateRepl() {
    return true;
  }
  removeReplExpressions() {
  }
  get onDidChangeReplElements() {
    throw new Error("not implemented");
  }
  addReplExpression(stackFrame, name) {
    return Promise.resolve(void 0);
  }
  appendToRepl(data) {
  }
  getId() {
    return "mock";
  }
  getLabel() {
    return "mockname";
  }
  get name() {
    return "mockname";
  }
  setName(name) {
    throw new Error("not implemented");
  }
  getSourceForUri(modelUri) {
    throw new Error("not implemented");
  }
  getThread(threadId) {
    throw new Error("not implemented");
  }
  getStoppedDetails() {
    throw new Error("not implemented");
  }
  get onDidCustomEvent() {
    throw new Error("not implemented");
  }
  get onDidLoadedSource() {
    throw new Error("not implemented");
  }
  get onDidChangeState() {
    throw new Error("not implemented");
  }
  get onDidEndAdapter() {
    throw new Error("not implemented");
  }
  get onDidChangeName() {
    throw new Error("not implemented");
  }
  get onDidProgressStart() {
    throw new Error("not implemented");
  }
  get onDidProgressUpdate() {
    throw new Error("not implemented");
  }
  get onDidProgressEnd() {
    throw new Error("not implemented");
  }
  setConfiguration(configuration) {
  }
  getAllThreads() {
    return [];
  }
  getSource(raw) {
    throw new Error("not implemented");
  }
  getLoadedSources() {
    return Promise.resolve([]);
  }
  completions(frameId, threadId, text, position) {
    throw new Error("not implemented");
  }
  clearThreads(removeThreads, reference) {
  }
  rawUpdate(data) {
  }
  initialize(dbgr) {
    throw new Error("Method not implemented.");
  }
  launchOrAttach(config) {
    throw new Error("Method not implemented.");
  }
  restart() {
    throw new Error("Method not implemented.");
  }
  sendBreakpoints(modelUri, bpts, sourceModified) {
    throw new Error("Method not implemented.");
  }
  sendFunctionBreakpoints(fbps) {
    throw new Error("Method not implemented.");
  }
  sendExceptionBreakpoints(exbpts) {
    throw new Error("Method not implemented.");
  }
  sendInstructionBreakpoints(dbps) {
    throw new Error("Method not implemented.");
  }
  getDebugProtocolBreakpoint(breakpointId) {
    throw new Error("Method not implemented.");
  }
  customRequest(request, args) {
    throw new Error("Method not implemented.");
  }
  stackTrace(threadId, startFrame, levels, token) {
    throw new Error("Method not implemented.");
  }
  exceptionInfo(threadId) {
    throw new Error("Method not implemented.");
  }
  scopes(frameId) {
    throw new Error("Method not implemented.");
  }
  variables(variablesReference, threadId, filter, start, count) {
    throw new Error("Method not implemented.");
  }
  evaluate(expression, frameId, context) {
    throw new Error("Method not implemented.");
  }
  restartFrame(frameId, threadId) {
    throw new Error("Method not implemented.");
  }
  next(threadId, granularity) {
    throw new Error("Method not implemented.");
  }
  stepIn(threadId, targetId, granularity) {
    throw new Error("Method not implemented.");
  }
  stepOut(threadId, granularity) {
    throw new Error("Method not implemented.");
  }
  stepBack(threadId, granularity) {
    throw new Error("Method not implemented.");
  }
  continue(threadId) {
    throw new Error("Method not implemented.");
  }
  reverseContinue(threadId) {
    throw new Error("Method not implemented.");
  }
  pause(threadId) {
    throw new Error("Method not implemented.");
  }
  terminateThreads(threadIds) {
    throw new Error("Method not implemented.");
  }
  setVariable(variablesReference, name, value) {
    throw new Error("Method not implemented.");
  }
  setExpression(frameId, expression, value) {
    throw new Error("Method not implemented.");
  }
  loadSource(resource) {
    throw new Error("Method not implemented.");
  }
  disassemble(memoryReference, offset, instructionOffset, instructionCount) {
    throw new Error("Method not implemented.");
  }
  terminate(restart = false) {
    throw new Error("Method not implemented.");
  }
  disconnect(restart = false) {
    throw new Error("Method not implemented.");
  }
  gotoTargets(source, line, column) {
    throw new Error("Method not implemented.");
  }
  goto(threadId, targetId) {
    throw new Error("Method not implemented.");
  }
  resolveLocationReference(locationReference) {
    throw new Error("Method not implemented.");
  }
}
class MockRawSession {
  constructor() {
    this.capabilities = {};
    this.disconnected = false;
    this.sessionLengthInSeconds = 0;
    this.readyForBreakpoints = true;
    this.emittedStopped = true;
    this.onDidStop = null;
  }
  getLengthInSeconds() {
    return 100;
  }
  stackTrace(args) {
    return Promise.resolve({
      seq: 1,
      type: "response",
      request_seq: 1,
      success: true,
      command: "stackTrace",
      body: {
        stackFrames: [{
          id: 1,
          name: "mock",
          line: 5,
          column: 6
        }]
      }
    });
  }
  exceptionInfo(args) {
    throw new Error("not implemented");
  }
  launchOrAttach(args) {
    throw new Error("not implemented");
  }
  scopes(args) {
    throw new Error("not implemented");
  }
  variables(args) {
    throw new Error("not implemented");
  }
  evaluate(args) {
    return Promise.resolve(null);
  }
  custom(request, args) {
    throw new Error("not implemented");
  }
  terminate(restart = false) {
    throw new Error("not implemented");
  }
  disconnect(restart) {
    throw new Error("not implemented");
  }
  threads() {
    throw new Error("not implemented");
  }
  stepIn(args) {
    throw new Error("not implemented");
  }
  stepOut(args) {
    throw new Error("not implemented");
  }
  stepBack(args) {
    throw new Error("not implemented");
  }
  continue(args) {
    throw new Error("not implemented");
  }
  reverseContinue(args) {
    throw new Error("not implemented");
  }
  pause(args) {
    throw new Error("not implemented");
  }
  terminateThreads(args) {
    throw new Error("not implemented");
  }
  setVariable(args) {
    throw new Error("not implemented");
  }
  restartFrame(args) {
    throw new Error("not implemented");
  }
  completions(args) {
    throw new Error("not implemented");
  }
  next(args) {
    throw new Error("not implemented");
  }
  source(args) {
    throw new Error("not implemented");
  }
  loadedSources(args) {
    throw new Error("not implemented");
  }
  setBreakpoints(args) {
    throw new Error("not implemented");
  }
  setFunctionBreakpoints(args) {
    throw new Error("not implemented");
  }
  setExceptionBreakpoints(args) {
    throw new Error("not implemented");
  }
}
class MockDebugAdapter extends AbstractDebugAdapter {
  constructor() {
    super(...arguments);
    this.seq = 0;
    this.pendingResponses = /* @__PURE__ */ new Map();
  }
  startSession() {
    return Promise.resolve();
  }
  stopSession() {
    return Promise.resolve();
  }
  sendMessage(message) {
    if (message.type === "request") {
      setTimeout(() => {
        const request = message;
        switch (request.command) {
          case "evaluate":
            this.evaluate(request, request.arguments);
            return;
        }
        this.sendResponseBody(request, {});
        return;
      }, 0);
    } else if (message.type === "response") {
      const response = message;
      if (this.pendingResponses.has(response.command)) {
        this.pendingResponses.get(response.command).complete(response);
      }
    }
  }
  sendResponseBody(request, body) {
    const response = {
      seq: ++this.seq,
      type: "response",
      request_seq: request.seq,
      command: request.command,
      success: true,
      body
    };
    this.acceptMessage(response);
  }
  sendEventBody(event, body) {
    const response = {
      seq: ++this.seq,
      type: "event",
      event,
      body
    };
    this.acceptMessage(response);
  }
  waitForResponseFromClient(command) {
    const deferred = new DeferredPromise();
    if (this.pendingResponses.has(command)) {
      return this.pendingResponses.get(command).p;
    }
    this.pendingResponses.set(command, deferred);
    return deferred.p;
  }
  sendRequestBody(command, args) {
    const response = {
      seq: ++this.seq,
      type: "request",
      command,
      arguments: args
    };
    this.acceptMessage(response);
  }
  evaluate(request, args) {
    if (args.expression.indexOf("before.") === 0) {
      this.sendEventBody("output", { output: args.expression });
    }
    this.sendResponseBody(request, {
      result: "=" + args.expression,
      variablesReference: 0
    });
    if (args.expression.indexOf("after.") === 0) {
      this.sendEventBody("output", { output: args.expression });
    }
  }
}
class MockDebugStorage extends DebugStorage {
  constructor(storageService) {
    super(storageService, void 0, void 0, new NullLogService());
  }
}
export {
  MockDebugAdapter,
  MockDebugService,
  MockDebugStorage,
  MockRawSession,
  MockSession
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy90ZXN0L2NvbW1vbi9tb2NrRGVidWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFVSSSBhcyB1cmkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uLCBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUZvbGRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IEFic3RyYWN0RGVidWdBZGFwdGVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL2Fic3RyYWN0RGVidWdBZGFwdGVyLmpzJztcbmltcG9ydCB7IEFkYXB0ZXJFbmRFdmVudCwgSUFkYXB0ZXJNYW5hZ2VyLCBJQnJlYWtwb2ludCwgSUJyZWFrcG9pbnREYXRhLCBJQnJlYWtwb2ludFVwZGF0ZURhdGEsIElDb25maWcsIElDb25maWd1cmF0aW9uTWFuYWdlciwgSURhdGFCcmVha3BvaW50LCBJRGF0YUJyZWFrcG9pbnRJbmZvUmVzcG9uc2UsIElEZWJ1Z0xvY2F0aW9uUmVmZXJlbmNlZCwgSURlYnVnTW9kZWwsIElEZWJ1Z1NlcnZpY2UsIElEZWJ1Z1Nlc3Npb24sIElEZWJ1Z1Nlc3Npb25PcHRpb25zLCBJRGVidWdnZXIsIElFeGNlcHRpb25CcmVha3BvaW50LCBJRXhjZXB0aW9uSW5mbywgSUZ1bmN0aW9uQnJlYWtwb2ludCwgSUluc3RydWN0aW9uQnJlYWtwb2ludCwgSUxhdW5jaCwgSU1lbW9yeVJlZ2lvbiwgSU5ld1JlcGxFbGVtZW50RGF0YSwgSVJhd01vZGVsVXBkYXRlLCBJUmF3U3RvcHBlZERldGFpbHMsIElSZXBsRWxlbWVudCwgSVN0YWNrRnJhbWUsIElUaHJlYWQsIElWaWV3TW9kZWwsIExvYWRlZFNvdXJjZUV2ZW50LCBTdGF0ZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0NvbXBvdW5kUm9vdCB9IGZyb20gJy4uLy4uL2NvbW1vbi9kZWJ1Z0NvbXBvdW5kUm9vdC5qcyc7XG5pbXBvcnQgeyBJSW5zdHJ1Y3Rpb25CcmVha3BvaW50T3B0aW9ucyB9IGZyb20gJy4uLy4uL2NvbW1vbi9kZWJ1Z01vZGVsLmpzJztcbmltcG9ydCB7IFNvdXJjZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9kZWJ1Z1NvdXJjZS5qcyc7XG5pbXBvcnQgeyBEZWJ1Z1N0b3JhZ2UgfSBmcm9tICcuLi8uLi9jb21tb24vZGVidWdTdG9yYWdlLmpzJztcblxuZXhwb3J0IGNsYXNzIE1vY2tEZWJ1Z1NlcnZpY2UgaW1wbGVtZW50cyBJRGVidWdTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGdldCBzdGF0ZSgpOiBTdGF0ZSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdGdldCBvbldpbGxOZXdTZXNzaW9uKCk6IEV2ZW50PElEZWJ1Z1Nlc3Npb24+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0Z2V0IG9uRGlkTmV3U2Vzc2lvbigpOiBFdmVudDxJRGVidWdTZXNzaW9uPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdGdldCBvbkRpZEVuZFNlc3Npb24oKTogRXZlbnQ8eyBzZXNzaW9uOiBJRGVidWdTZXNzaW9uOyByZXN0YXJ0OiBib29sZWFuIH0+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0Z2V0IG9uRGlkQ2hhbmdlU3RhdGUoKTogRXZlbnQ8U3RhdGU+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0Z2V0Q29uZmlndXJhdGlvbk1hbmFnZXIoKTogSUNvbmZpZ3VyYXRpb25NYW5hZ2VyIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0Z2V0QWRhcHRlck1hbmFnZXIoKTogSUFkYXB0ZXJNYW5hZ2VyIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHRjYW5TZXRCcmVha3BvaW50c0luKG1vZGVsOiBJVGV4dE1vZGVsKTogYm9vbGVhbiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0Zm9jdXNTdGFja0ZyYW1lKGZvY3VzZWRTdGFja0ZyYW1lOiBJU3RhY2tGcmFtZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRzZW5kQWxsQnJlYWtwb2ludHMoc2Vzc2lvbj86IElEZWJ1Z1Nlc3Npb24pOiBQcm9taXNlPGFueT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRzZW5kQnJlYWtwb2ludHMobW9kZWxVcmk6IHVyaSwgc291cmNlTW9kaWZpZWQ/OiBib29sZWFuIHwgdW5kZWZpbmVkLCBzZXNzaW9uPzogSURlYnVnU2Vzc2lvbiB8IHVuZGVmaW5lZCk6IFByb21pc2U8YW55PiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdGFkZEJyZWFrcG9pbnRzKHVyaTogdXJpLCByYXdCcmVha3BvaW50czogSUJyZWFrcG9pbnREYXRhW10pOiBQcm9taXNlPElCcmVha3BvaW50W10+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0dXBkYXRlQnJlYWtwb2ludHModXJpOiB1cmksIGRhdGE6IE1hcDxzdHJpbmcsIElCcmVha3BvaW50VXBkYXRlRGF0YT4sIHNlbmRPblJlc291cmNlU2F2ZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0ZW5hYmxlT3JEaXNhYmxlQnJlYWtwb2ludHMoZW5hYmxlZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRzZXRCcmVha3BvaW50c0FjdGl2YXRlZCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0cmVtb3ZlQnJlYWtwb2ludHMoKTogUHJvbWlzZTxhbnk+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0YWRkSW5zdHJ1Y3Rpb25CcmVha3BvaW50KG9wdHM6IElJbnN0cnVjdGlvbkJyZWFrcG9pbnRPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0cmVtb3ZlSW5zdHJ1Y3Rpb25CcmVha3BvaW50cyhhZGRyZXNzPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0c2V0RXhjZXB0aW9uQnJlYWtwb2ludENvbmRpdGlvbihicmVha3BvaW50OiBJRXhjZXB0aW9uQnJlYWtwb2ludCwgY29uZGl0aW9uOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHRzZXRFeGNlcHRpb25CcmVha3BvaW50c0ZvclNlc3Npb24oc2Vzc2lvbjogSURlYnVnU2Vzc2lvbiwgZGF0YTogRGVidWdQcm90b2NvbC5FeGNlcHRpb25CcmVha3BvaW50c0ZpbHRlcltdKTogdm9pZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0YWRkRnVuY3Rpb25CcmVha3BvaW50KCk6IHZvaWQgeyB9XG5cblx0bW92ZVdhdGNoRXhwcmVzc2lvbihpZDogc3RyaW5nLCBwb3NpdGlvbjogbnVtYmVyKTogdm9pZCB7IH1cblxuXHR1cGRhdGVGdW5jdGlvbkJyZWFrcG9pbnQoaWQ6IHN0cmluZywgdXBkYXRlOiB7IG5hbWU/OiBzdHJpbmc7IGhpdENvbmRpdGlvbj86IHN0cmluZzsgY29uZGl0aW9uPzogc3RyaW5nIH0pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0cmVtb3ZlRnVuY3Rpb25CcmVha3BvaW50cyhpZD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRhZGREYXRhQnJlYWtwb2ludCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHR1cGRhdGVEYXRhQnJlYWtwb2ludChpZDogc3RyaW5nLCB1cGRhdGU6IHsgaGl0Q29uZGl0aW9uPzogc3RyaW5nOyBjb25kaXRpb24/OiBzdHJpbmcgfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRyZW1vdmVEYXRhQnJlYWtwb2ludHMoaWQ/OiBzdHJpbmcgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHRhZGRSZXBsRXhwcmVzc2lvbihuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0cmVtb3ZlUmVwbEV4cHJlc3Npb25zKCk6IHZvaWQgeyB9XG5cblx0YWRkV2F0Y2hFeHByZXNzaW9uKG5hbWU/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0cmVuYW1lV2F0Y2hFeHByZXNzaW9uKGlkOiBzdHJpbmcsIG5ld05hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRyZW1vdmVXYXRjaEV4cHJlc3Npb25zKGlkPzogc3RyaW5nKTogdm9pZCB7IH1cblxuXHRzdGFydERlYnVnZ2luZyhsYXVuY2g6IElMYXVuY2gsIGNvbmZpZ09yTmFtZT86IElDb25maWcgfCBzdHJpbmcsIG9wdGlvbnM/OiBJRGVidWdTZXNzaW9uT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodHJ1ZSk7XG5cdH1cblxuXHRyZXN0YXJ0U2Vzc2lvbigpOiBQcm9taXNlPGFueT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRzdG9wU2Vzc2lvbigpOiBQcm9taXNlPGFueT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRnZXRNb2RlbCgpOiBJRGVidWdNb2RlbCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdGdldFZpZXdNb2RlbCgpOiBJVmlld01vZGVsIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0c291cmNlSXNOb3RBdmFpbGFibGUodXJpOiB1cmkpOiB2b2lkIHsgfVxuXG5cdHRyeVRvQXV0b0ZvY3VzU3RhY2tGcmFtZSh0aHJlYWQ6IElUaHJlYWQpOiBQcm9taXNlPGFueT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRydW5Ubyh1cmk6IHVyaSwgbGluZU51bWJlcjogbnVtYmVyLCBjb2x1bW4/OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vY2tTZXNzaW9uIGltcGxlbWVudHMgSURlYnVnU2Vzc2lvbiB7XG5cdHJlYWRvbmx5IHN1cHByZXNzRGVidWdUb29sYmFyID0gZmFsc2U7XG5cdHJlYWRvbmx5IHN1cHByZXNzRGVidWdTdGF0dXNiYXIgPSBmYWxzZTtcblx0cmVhZG9ubHkgc3VwcHJlc3NEZWJ1Z1ZpZXcgPSBmYWxzZTtcblx0cmVhZG9ubHkgYXV0b0V4cGFuZExhenlWYXJpYWJsZXMgPSBmYWxzZTtcblxuXHRnZXRNZW1vcnkobWVtb3J5UmVmZXJlbmNlOiBzdHJpbmcpOiBJTWVtb3J5UmVnaW9uIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHRnZXQgb25EaWRJbnZhbGlkYXRlTWVtb3J5KCk6IEV2ZW50PERlYnVnUHJvdG9jb2wuTWVtb3J5RXZlbnQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0cmVhZE1lbW9yeShtZW1vcnlSZWZlcmVuY2U6IHN0cmluZywgb2Zmc2V0OiBudW1iZXIsIGNvdW50OiBudW1iZXIpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuUmVhZE1lbW9yeVJlc3BvbnNlIHwgdW5kZWZpbmVkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0d3JpdGVNZW1vcnkobWVtb3J5UmVmZXJlbmNlOiBzdHJpbmcsIG9mZnNldDogbnVtYmVyLCBkYXRhOiBzdHJpbmcsIGFsbG93UGFydGlhbD86IGJvb2xlYW4pOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuV3JpdGVNZW1vcnlSZXNwb25zZSB8IHVuZGVmaW5lZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXG5cdGNhbmNlbENvcnJlbGF0ZWRUZXN0UnVuKCk6IHZvaWQge1xuXG5cdH1cblxuXHRnZXQgY29tcG91bmRSb290KCk6IERlYnVnQ29tcG91bmRSb290IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0IHNhdmVCZWZvcmVSZXN0YXJ0KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Z2V0IGlzU2ltcGxlVUkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Z2V0IGxpZmVjeWNsZU1hbmFnZWRCeVBhcmVudCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRzdGVwSW5UYXJnZXRzKGZyYW1lSWQ6IG51bWJlcik6IFByb21pc2U8eyBpZDogbnVtYmVyOyBsYWJlbDogc3RyaW5nIH1bXT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXG5cdGNhbmNlbChfcHJvZ3Jlc3NJZDogc3RyaW5nKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLkNhbmNlbFJlc3BvbnNlPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0YnJlYWtwb2ludHNMb2NhdGlvbnModXJpOiB1cmksIGxpbmVOdW1iZXI6IG51bWJlcik6IFByb21pc2U8SVBvc2l0aW9uW10+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHRkYXRhQnl0ZXNCcmVha3BvaW50SW5mbyhhZGRyZXNzOiBzdHJpbmcsIGJ5dGVzOiBudW1iZXIpOiBQcm9taXNlPElEYXRhQnJlYWtwb2ludEluZm9SZXNwb25zZSB8IHVuZGVmaW5lZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXG5cdGRhdGFCcmVha3BvaW50SW5mbyhuYW1lOiBzdHJpbmcsIHZhcmlhYmxlc1JlZmVyZW5jZT86IG51bWJlciB8IHVuZGVmaW5lZCk6IFByb21pc2U8eyBkYXRhSWQ6IHN0cmluZyB8IG51bGw7IGRlc2NyaXB0aW9uOiBzdHJpbmc7IGNhblBlcnNpc3Q/OiBib29sZWFuIHwgdW5kZWZpbmVkIH0gfCB1bmRlZmluZWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHRzZW5kRGF0YUJyZWFrcG9pbnRzKGRicHM6IElEYXRhQnJlYWtwb2ludFtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0c3ViSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRnZXQgY29tcGFjdCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRzZXRTdWJJZChzdWJJZDogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0Z2V0IHBhcmVudFNlc3Npb24oKTogSURlYnVnU2Vzc2lvbiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGdldFJlcGxFbGVtZW50cygpOiBJUmVwbEVsZW1lbnRbXSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0aGFzU2VwYXJhdGVSZXBsKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cmVtb3ZlUmVwbEV4cHJlc3Npb25zKCk6IHZvaWQgeyB9XG5cdGdldCBvbkRpZENoYW5nZVJlcGxFbGVtZW50cygpOiBFdmVudDxJUmVwbEVsZW1lbnQgfCB1bmRlZmluZWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0YWRkUmVwbEV4cHJlc3Npb24oc3RhY2tGcmFtZTogSVN0YWNrRnJhbWUsIG5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0fVxuXG5cdGFwcGVuZFRvUmVwbChkYXRhOiBJTmV3UmVwbEVsZW1lbnREYXRhKTogdm9pZCB7IH1cblxuXHRjb25maWd1cmF0aW9uOiBJQ29uZmlnID0geyB0eXBlOiAnbW9jaycsIG5hbWU6ICdtb2NrJywgcmVxdWVzdDogJ2xhdW5jaCcgfTtcblx0dW5yZXNvbHZlZENvbmZpZ3VyYXRpb246IElDb25maWcgPSB7IHR5cGU6ICdtb2NrJywgbmFtZTogJ21vY2snLCByZXF1ZXN0OiAnbGF1bmNoJyB9O1xuXHRzdGF0ZSA9IFN0YXRlLlN0b3BwZWQ7XG5cdHJvb3QhOiBJV29ya3NwYWNlRm9sZGVyO1xuXHRjYXBhYmlsaXRpZXM6IERlYnVnUHJvdG9jb2wuQ2FwYWJpbGl0aWVzID0ge307XG5cblx0Z2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gJ21vY2snO1xuXHR9XG5cblx0Z2V0TGFiZWwoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gJ21vY2tuYW1lJztcblx0fVxuXG5cdGdldCBuYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuICdtb2NrbmFtZSc7XG5cdH1cblxuXHRzZXROYW1lKG5hbWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRnZXRTb3VyY2VGb3JVcmkobW9kZWxVcmk6IHVyaSk6IFNvdXJjZSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdGdldFRocmVhZCh0aHJlYWRJZDogbnVtYmVyKTogSVRocmVhZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdGdldFN0b3BwZWREZXRhaWxzKCk6IElSYXdTdG9wcGVkRGV0YWlscyB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdGdldCBvbkRpZEN1c3RvbUV2ZW50KCk6IEV2ZW50PERlYnVnUHJvdG9jb2wuRXZlbnQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0Z2V0IG9uRGlkTG9hZGVkU291cmNlKCk6IEV2ZW50PExvYWRlZFNvdXJjZUV2ZW50PiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdGdldCBvbkRpZENoYW5nZVN0YXRlKCk6IEV2ZW50PHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0Z2V0IG9uRGlkRW5kQWRhcHRlcigpOiBFdmVudDxBZGFwdGVyRW5kRXZlbnQgfCB1bmRlZmluZWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0Z2V0IG9uRGlkQ2hhbmdlTmFtZSgpOiBFdmVudDxzdHJpbmc+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0Z2V0IG9uRGlkUHJvZ3Jlc3NTdGFydCgpOiBFdmVudDxEZWJ1Z1Byb3RvY29sLlByb2dyZXNzU3RhcnRFdmVudD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRnZXQgb25EaWRQcm9ncmVzc1VwZGF0ZSgpOiBFdmVudDxEZWJ1Z1Byb3RvY29sLlByb2dyZXNzVXBkYXRlRXZlbnQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0Z2V0IG9uRGlkUHJvZ3Jlc3NFbmQoKTogRXZlbnQ8RGVidWdQcm90b2NvbC5Qcm9ncmVzc0VuZEV2ZW50PiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdHNldENvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvbjogeyByZXNvbHZlZDogSUNvbmZpZzsgdW5yZXNvbHZlZDogSUNvbmZpZyB9KSB7IH1cblxuXHRnZXRBbGxUaHJlYWRzKCk6IElUaHJlYWRbXSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0Z2V0U291cmNlKHJhdzogRGVidWdQcm90b2NvbC5Tb3VyY2UpOiBTb3VyY2Uge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRnZXRMb2FkZWRTb3VyY2VzKCk6IFByb21pc2U8U291cmNlW10+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFtdKTtcblx0fVxuXG5cdGNvbXBsZXRpb25zKGZyYW1lSWQ6IG51bWJlciwgdGhyZWFkSWQ6IG51bWJlciwgdGV4dDogc3RyaW5nLCBwb3NpdGlvbjogUG9zaXRpb24pOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuQ29tcGxldGlvbnNSZXNwb25zZT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRjbGVhclRocmVhZHMocmVtb3ZlVGhyZWFkczogYm9vbGVhbiwgcmVmZXJlbmNlPzogbnVtYmVyKTogdm9pZCB7IH1cblxuXHRyYXdVcGRhdGUoZGF0YTogSVJhd01vZGVsVXBkYXRlKTogdm9pZCB7IH1cblxuXHRpbml0aWFsaXplKGRiZ3I6IElEZWJ1Z2dlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRsYXVuY2hPckF0dGFjaChjb25maWc6IElDb25maWcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0cmVzdGFydCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0c2VuZEJyZWFrcG9pbnRzKG1vZGVsVXJpOiB1cmksIGJwdHM6IElCcmVha3BvaW50W10sIHNvdXJjZU1vZGlmaWVkOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdHNlbmRGdW5jdGlvbkJyZWFrcG9pbnRzKGZicHM6IElGdW5jdGlvbkJyZWFrcG9pbnRbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRzZW5kRXhjZXB0aW9uQnJlYWtwb2ludHMoZXhicHRzOiBJRXhjZXB0aW9uQnJlYWtwb2ludFtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdHNlbmRJbnN0cnVjdGlvbkJyZWFrcG9pbnRzKGRicHM6IElJbnN0cnVjdGlvbkJyZWFrcG9pbnRbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRnZXREZWJ1Z1Byb3RvY29sQnJlYWtwb2ludChicmVha3BvaW50SWQ6IHN0cmluZyk6IERlYnVnUHJvdG9jb2wuQnJlYWtwb2ludCB8IHVuZGVmaW5lZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdGN1c3RvbVJlcXVlc3QocmVxdWVzdDogc3RyaW5nLCBhcmdzOiBhbnkpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuUmVzcG9uc2U+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0c3RhY2tUcmFjZSh0aHJlYWRJZDogbnVtYmVyLCBzdGFydEZyYW1lOiBudW1iZXIsIGxldmVsczogbnVtYmVyLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuU3RhY2tUcmFjZVJlc3BvbnNlPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdGV4Y2VwdGlvbkluZm8odGhyZWFkSWQ6IG51bWJlcik6IFByb21pc2U8SUV4Y2VwdGlvbkluZm8+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0c2NvcGVzKGZyYW1lSWQ6IG51bWJlcik6IFByb21pc2U8RGVidWdQcm90b2NvbC5TY29wZXNSZXNwb25zZT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHR2YXJpYWJsZXModmFyaWFibGVzUmVmZXJlbmNlOiBudW1iZXIsIHRocmVhZElkOiBudW1iZXIgfCB1bmRlZmluZWQsIGZpbHRlcjogJ2luZGV4ZWQnIHwgJ25hbWVkJywgc3RhcnQ6IG51bWJlciwgY291bnQ6IG51bWJlcik6IFByb21pc2U8RGVidWdQcm90b2NvbC5WYXJpYWJsZXNSZXNwb25zZT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRldmFsdWF0ZShleHByZXNzaW9uOiBzdHJpbmcsIGZyYW1lSWQ6IG51bWJlciwgY29udGV4dD86IHN0cmluZyk6IFByb21pc2U8RGVidWdQcm90b2NvbC5FdmFsdWF0ZVJlc3BvbnNlPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdHJlc3RhcnRGcmFtZShmcmFtZUlkOiBudW1iZXIsIHRocmVhZElkOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0bmV4dCh0aHJlYWRJZDogbnVtYmVyLCBncmFudWxhcml0eT86IERlYnVnUHJvdG9jb2wuU3RlcHBpbmdHcmFudWxhcml0eSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRzdGVwSW4odGhyZWFkSWQ6IG51bWJlciwgdGFyZ2V0SWQ/OiBudW1iZXIsIGdyYW51bGFyaXR5PzogRGVidWdQcm90b2NvbC5TdGVwcGluZ0dyYW51bGFyaXR5KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdHN0ZXBPdXQodGhyZWFkSWQ6IG51bWJlciwgZ3JhbnVsYXJpdHk/OiBEZWJ1Z1Byb3RvY29sLlN0ZXBwaW5nR3JhbnVsYXJpdHkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0c3RlcEJhY2sodGhyZWFkSWQ6IG51bWJlciwgZ3JhbnVsYXJpdHk/OiBEZWJ1Z1Byb3RvY29sLlN0ZXBwaW5nR3JhbnVsYXJpdHkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0Y29udGludWUodGhyZWFkSWQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRyZXZlcnNlQ29udGludWUodGhyZWFkSWQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRwYXVzZSh0aHJlYWRJZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdHRlcm1pbmF0ZVRocmVhZHModGhyZWFkSWRzOiBudW1iZXJbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRzZXRWYXJpYWJsZSh2YXJpYWJsZXNSZWZlcmVuY2U6IG51bWJlciwgbmFtZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLlNldFZhcmlhYmxlUmVzcG9uc2U+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0c2V0RXhwcmVzc2lvbihmcmFtZUlkOiBudW1iZXIsIGV4cHJlc3Npb246IHN0cmluZywgdmFsdWU6IHN0cmluZyk6IFByb21pc2U8RGVidWdQcm90b2NvbC5TZXRFeHByZXNzaW9uUmVzcG9uc2UgfCB1bmRlZmluZWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0bG9hZFNvdXJjZShyZXNvdXJjZTogdXJpKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLlNvdXJjZVJlc3BvbnNlPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdGRpc2Fzc2VtYmxlKG1lbW9yeVJlZmVyZW5jZTogc3RyaW5nLCBvZmZzZXQ6IG51bWJlciwgaW5zdHJ1Y3Rpb25PZmZzZXQ6IG51bWJlciwgaW5zdHJ1Y3Rpb25Db3VudDogbnVtYmVyKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLkRpc2Fzc2VtYmxlZEluc3RydWN0aW9uW10gfCB1bmRlZmluZWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHR0ZXJtaW5hdGUocmVzdGFydCA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdGRpc2Nvbm5lY3QocmVzdGFydCA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0Z290b1RhcmdldHMoc291cmNlOiBEZWJ1Z1Byb3RvY29sLlNvdXJjZSwgbGluZTogbnVtYmVyLCBjb2x1bW4/OiBudW1iZXIgfCB1bmRlZmluZWQpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuR290b1RhcmdldHNSZXNwb25zZT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRnb3RvKHRocmVhZElkOiBudW1iZXIsIHRhcmdldElkOiBudW1iZXIpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuR290b1Jlc3BvbnNlPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdHJlc29sdmVMb2NhdGlvblJlZmVyZW5jZShsb2NhdGlvblJlZmVyZW5jZTogbnVtYmVyKTogUHJvbWlzZTxJRGVidWdMb2NhdGlvblJlZmVyZW5jZWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vY2tSYXdTZXNzaW9uIHtcblxuXHRjYXBhYmlsaXRpZXM6IERlYnVnUHJvdG9jb2wuQ2FwYWJpbGl0aWVzID0ge307XG5cdGRpc2Nvbm5lY3RlZCA9IGZhbHNlO1xuXHRzZXNzaW9uTGVuZ3RoSW5TZWNvbmRzOiBudW1iZXIgPSAwO1xuXG5cdHJlYWR5Rm9yQnJlYWtwb2ludHMgPSB0cnVlO1xuXHRlbWl0dGVkU3RvcHBlZCA9IHRydWU7XG5cblx0Z2V0TGVuZ3RoSW5TZWNvbmRzKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIDEwMDtcblx0fVxuXG5cdHN0YWNrVHJhY2UoYXJnczogRGVidWdQcm90b2NvbC5TdGFja1RyYWNlQXJndW1lbnRzKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLlN0YWNrVHJhY2VSZXNwb25zZT4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoe1xuXHRcdFx0c2VxOiAxLFxuXHRcdFx0dHlwZTogJ3Jlc3BvbnNlJyxcblx0XHRcdHJlcXVlc3Rfc2VxOiAxLFxuXHRcdFx0c3VjY2VzczogdHJ1ZSxcblx0XHRcdGNvbW1hbmQ6ICdzdGFja1RyYWNlJyxcblx0XHRcdGJvZHk6IHtcblx0XHRcdFx0c3RhY2tGcmFtZXM6IFt7XG5cdFx0XHRcdFx0aWQ6IDEsXG5cdFx0XHRcdFx0bmFtZTogJ21vY2snLFxuXHRcdFx0XHRcdGxpbmU6IDUsXG5cdFx0XHRcdFx0Y29sdW1uOiA2XG5cdFx0XHRcdH1dXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRleGNlcHRpb25JbmZvKGFyZ3M6IERlYnVnUHJvdG9jb2wuRXhjZXB0aW9uSW5mb0FyZ3VtZW50cyk6IFByb21pc2U8RGVidWdQcm90b2NvbC5FeGNlcHRpb25JbmZvUmVzcG9uc2U+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0bGF1bmNoT3JBdHRhY2goYXJnczogSUNvbmZpZyk6IFByb21pc2U8RGVidWdQcm90b2NvbC5SZXNwb25zZT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRzY29wZXMoYXJnczogRGVidWdQcm90b2NvbC5TY29wZXNBcmd1bWVudHMpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuU2NvcGVzUmVzcG9uc2U+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0dmFyaWFibGVzKGFyZ3M6IERlYnVnUHJvdG9jb2wuVmFyaWFibGVzQXJndW1lbnRzKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLlZhcmlhYmxlc1Jlc3BvbnNlPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdGV2YWx1YXRlKGFyZ3M6IERlYnVnUHJvdG9jb2wuRXZhbHVhdGVBcmd1bWVudHMpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuRXZhbHVhdGVSZXNwb25zZT4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCEpO1xuXHR9XG5cblx0Y3VzdG9tKHJlcXVlc3Q6IHN0cmluZywgYXJnczogYW55KTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLlJlc3BvbnNlPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdHRlcm1pbmF0ZShyZXN0YXJ0ID0gZmFsc2UpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuVGVybWluYXRlUmVzcG9uc2U+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0ZGlzY29ubmVjdChyZXN0YXJ0PzogYm9vbGVhbik6IFByb21pc2U8YW55PiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdHRocmVhZHMoKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLlRocmVhZHNSZXNwb25zZT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRzdGVwSW4oYXJnczogRGVidWdQcm90b2NvbC5TdGVwSW5Bcmd1bWVudHMpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuU3RlcEluUmVzcG9uc2U+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0c3RlcE91dChhcmdzOiBEZWJ1Z1Byb3RvY29sLlN0ZXBPdXRBcmd1bWVudHMpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuU3RlcE91dFJlc3BvbnNlPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdHN0ZXBCYWNrKGFyZ3M6IERlYnVnUHJvdG9jb2wuU3RlcEJhY2tBcmd1bWVudHMpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuU3RlcEJhY2tSZXNwb25zZT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRjb250aW51ZShhcmdzOiBEZWJ1Z1Byb3RvY29sLkNvbnRpbnVlQXJndW1lbnRzKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLkNvbnRpbnVlUmVzcG9uc2U+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0cmV2ZXJzZUNvbnRpbnVlKGFyZ3M6IERlYnVnUHJvdG9jb2wuUmV2ZXJzZUNvbnRpbnVlQXJndW1lbnRzKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLlJldmVyc2VDb250aW51ZVJlc3BvbnNlPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdHBhdXNlKGFyZ3M6IERlYnVnUHJvdG9jb2wuUGF1c2VBcmd1bWVudHMpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuUGF1c2VSZXNwb25zZT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHR0ZXJtaW5hdGVUaHJlYWRzKGFyZ3M6IERlYnVnUHJvdG9jb2wuVGVybWluYXRlVGhyZWFkc0FyZ3VtZW50cyk6IFByb21pc2U8RGVidWdQcm90b2NvbC5UZXJtaW5hdGVUaHJlYWRzUmVzcG9uc2U+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0c2V0VmFyaWFibGUoYXJnczogRGVidWdQcm90b2NvbC5TZXRWYXJpYWJsZUFyZ3VtZW50cyk6IFByb21pc2U8RGVidWdQcm90b2NvbC5TZXRWYXJpYWJsZVJlc3BvbnNlPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdHJlc3RhcnRGcmFtZShhcmdzOiBEZWJ1Z1Byb3RvY29sLlJlc3RhcnRGcmFtZUFyZ3VtZW50cyk6IFByb21pc2U8RGVidWdQcm90b2NvbC5SZXN0YXJ0RnJhbWVSZXNwb25zZT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRjb21wbGV0aW9ucyhhcmdzOiBEZWJ1Z1Byb3RvY29sLkNvbXBsZXRpb25zQXJndW1lbnRzKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLkNvbXBsZXRpb25zUmVzcG9uc2U+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0bmV4dChhcmdzOiBEZWJ1Z1Byb3RvY29sLk5leHRBcmd1bWVudHMpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuTmV4dFJlc3BvbnNlPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdHNvdXJjZShhcmdzOiBEZWJ1Z1Byb3RvY29sLlNvdXJjZUFyZ3VtZW50cyk6IFByb21pc2U8RGVidWdQcm90b2NvbC5Tb3VyY2VSZXNwb25zZT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRsb2FkZWRTb3VyY2VzKGFyZ3M6IERlYnVnUHJvdG9jb2wuTG9hZGVkU291cmNlc0FyZ3VtZW50cyk6IFByb21pc2U8RGVidWdQcm90b2NvbC5Mb2FkZWRTb3VyY2VzUmVzcG9uc2U+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0c2V0QnJlYWtwb2ludHMoYXJnczogRGVidWdQcm90b2NvbC5TZXRCcmVha3BvaW50c0FyZ3VtZW50cyk6IFByb21pc2U8RGVidWdQcm90b2NvbC5TZXRCcmVha3BvaW50c1Jlc3BvbnNlPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdHNldEZ1bmN0aW9uQnJlYWtwb2ludHMoYXJnczogRGVidWdQcm90b2NvbC5TZXRGdW5jdGlvbkJyZWFrcG9pbnRzQXJndW1lbnRzKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLlNldEZ1bmN0aW9uQnJlYWtwb2ludHNSZXNwb25zZT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHRzZXRFeGNlcHRpb25CcmVha3BvaW50cyhhcmdzOiBEZWJ1Z1Byb3RvY29sLlNldEV4Y2VwdGlvbkJyZWFrcG9pbnRzQXJndW1lbnRzKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLlNldEV4Y2VwdGlvbkJyZWFrcG9pbnRzUmVzcG9uc2U+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0cmVhZG9ubHkgb25EaWRTdG9wOiBFdmVudDxEZWJ1Z1Byb3RvY29sLlN0b3BwZWRFdmVudD4gPSBudWxsITtcbn1cblxuZXhwb3J0IGNsYXNzIE1vY2tEZWJ1Z0FkYXB0ZXIgZXh0ZW5kcyBBYnN0cmFjdERlYnVnQWRhcHRlciB7XG5cdHByaXZhdGUgc2VxID0gMDtcblxuXHRwcml2YXRlIHBlbmRpbmdSZXNwb25zZXMgPSBuZXcgTWFwPHN0cmluZywgRGVmZXJyZWRQcm9taXNlPERlYnVnUHJvdG9jb2wuUmVzcG9uc2U+PigpO1xuXG5cdHN0YXJ0U2Vzc2lvbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHRzdG9wU2Vzc2lvbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHRzZW5kTWVzc2FnZShtZXNzYWdlOiBEZWJ1Z1Byb3RvY29sLlByb3RvY29sTWVzc2FnZSk6IHZvaWQge1xuXHRcdGlmIChtZXNzYWdlLnR5cGUgPT09ICdyZXF1ZXN0Jykge1xuXHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlcXVlc3QgPSBtZXNzYWdlIGFzIERlYnVnUHJvdG9jb2wuUmVxdWVzdDtcblx0XHRcdFx0c3dpdGNoIChyZXF1ZXN0LmNvbW1hbmQpIHtcblx0XHRcdFx0XHRjYXNlICdldmFsdWF0ZSc6XG5cdFx0XHRcdFx0XHR0aGlzLmV2YWx1YXRlKHJlcXVlc3QsIHJlcXVlc3QuYXJndW1lbnRzKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnNlbmRSZXNwb25zZUJvZHkocmVxdWVzdCwge30pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9LCAwKTtcblx0XHR9IGVsc2UgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ3Jlc3BvbnNlJykge1xuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBtZXNzYWdlIGFzIERlYnVnUHJvdG9jb2wuUmVzcG9uc2U7XG5cdFx0XHRpZiAodGhpcy5wZW5kaW5nUmVzcG9uc2VzLmhhcyhyZXNwb25zZS5jb21tYW5kKSkge1xuXHRcdFx0XHR0aGlzLnBlbmRpbmdSZXNwb25zZXMuZ2V0KHJlc3BvbnNlLmNvbW1hbmQpIS5jb21wbGV0ZShyZXNwb25zZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0c2VuZFJlc3BvbnNlQm9keShyZXF1ZXN0OiBEZWJ1Z1Byb3RvY29sLlJlcXVlc3QsIGJvZHk6IGFueSkge1xuXHRcdGNvbnN0IHJlc3BvbnNlOiBEZWJ1Z1Byb3RvY29sLlJlc3BvbnNlID0ge1xuXHRcdFx0c2VxOiArK3RoaXMuc2VxLFxuXHRcdFx0dHlwZTogJ3Jlc3BvbnNlJyxcblx0XHRcdHJlcXVlc3Rfc2VxOiByZXF1ZXN0LnNlcSxcblx0XHRcdGNvbW1hbmQ6IHJlcXVlc3QuY29tbWFuZCxcblx0XHRcdHN1Y2Nlc3M6IHRydWUsXG5cdFx0XHRib2R5XG5cdFx0fTtcblx0XHR0aGlzLmFjY2VwdE1lc3NhZ2UocmVzcG9uc2UpO1xuXHR9XG5cblx0c2VuZEV2ZW50Qm9keShldmVudDogc3RyaW5nLCBib2R5OiBhbnkpIHtcblx0XHRjb25zdCByZXNwb25zZTogRGVidWdQcm90b2NvbC5FdmVudCA9IHtcblx0XHRcdHNlcTogKyt0aGlzLnNlcSxcblx0XHRcdHR5cGU6ICdldmVudCcsXG5cdFx0XHRldmVudCxcblx0XHRcdGJvZHlcblx0XHR9O1xuXHRcdHRoaXMuYWNjZXB0TWVzc2FnZShyZXNwb25zZSk7XG5cdH1cblxuXHR3YWl0Rm9yUmVzcG9uc2VGcm9tQ2xpZW50KGNvbW1hbmQ6IHN0cmluZyk6IFByb21pc2U8RGVidWdQcm90b2NvbC5SZXNwb25zZT4ge1xuXHRcdGNvbnN0IGRlZmVycmVkID0gbmV3IERlZmVycmVkUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLlJlc3BvbnNlPigpO1xuXHRcdGlmICh0aGlzLnBlbmRpbmdSZXNwb25zZXMuaGFzKGNvbW1hbmQpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5wZW5kaW5nUmVzcG9uc2VzLmdldChjb21tYW5kKSEucDtcblx0XHR9XG5cblx0XHR0aGlzLnBlbmRpbmdSZXNwb25zZXMuc2V0KGNvbW1hbmQsIGRlZmVycmVkKTtcblx0XHRyZXR1cm4gZGVmZXJyZWQucDtcblx0fVxuXG5cdHNlbmRSZXF1ZXN0Qm9keShjb21tYW5kOiBzdHJpbmcsIGFyZ3M6IGFueSkge1xuXHRcdGNvbnN0IHJlc3BvbnNlOiBEZWJ1Z1Byb3RvY29sLlJlcXVlc3QgPSB7XG5cdFx0XHRzZXE6ICsrdGhpcy5zZXEsXG5cdFx0XHR0eXBlOiAncmVxdWVzdCcsXG5cdFx0XHRjb21tYW5kLFxuXHRcdFx0YXJndW1lbnRzOiBhcmdzXG5cdFx0fTtcblx0XHR0aGlzLmFjY2VwdE1lc3NhZ2UocmVzcG9uc2UpO1xuXHR9XG5cblx0ZXZhbHVhdGUocmVxdWVzdDogRGVidWdQcm90b2NvbC5SZXF1ZXN0LCBhcmdzOiBEZWJ1Z1Byb3RvY29sLkV2YWx1YXRlQXJndW1lbnRzKSB7XG5cdFx0aWYgKGFyZ3MuZXhwcmVzc2lvbi5pbmRleE9mKCdiZWZvcmUuJykgPT09IDApIHtcblx0XHRcdHRoaXMuc2VuZEV2ZW50Qm9keSgnb3V0cHV0JywgeyBvdXRwdXQ6IGFyZ3MuZXhwcmVzc2lvbiB9KTtcblx0XHR9XG5cblx0XHR0aGlzLnNlbmRSZXNwb25zZUJvZHkocmVxdWVzdCwge1xuXHRcdFx0cmVzdWx0OiAnPScgKyBhcmdzLmV4cHJlc3Npb24sXG5cdFx0XHR2YXJpYWJsZXNSZWZlcmVuY2U6IDBcblx0XHR9KTtcblxuXHRcdGlmIChhcmdzLmV4cHJlc3Npb24uaW5kZXhPZignYWZ0ZXIuJykgPT09IDApIHtcblx0XHRcdHRoaXMuc2VuZEV2ZW50Qm9keSgnb3V0cHV0JywgeyBvdXRwdXQ6IGFyZ3MuZXhwcmVzc2lvbiB9KTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vY2tEZWJ1Z1N0b3JhZ2UgZXh0ZW5kcyBEZWJ1Z1N0b3JhZ2Uge1xuXG5cdGNvbnN0cnVjdG9yKHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UpIHtcblx0XHRzdXBlcihzdG9yYWdlU2VydmljZSwgdW5kZWZpbmVkIGFzIGFueSwgdW5kZWZpbmVkIGFzIGFueSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHVCQUF1QjtBQU1oQyxTQUFTLHNCQUFzQjtBQUcvQixTQUFTLDRCQUE0QjtBQUNyQyxTQUE0ZixhQUFhO0FBSXpnQixTQUFTLG9CQUFvQjtBQUV0QixNQUFNLGlCQUEwQztBQUFBLEVBR3RELElBQUksUUFBZTtBQUNsQixVQUFNLElBQUksTUFBTSxpQkFBaUI7QUFBQSxFQUNsQztBQUFBLEVBRUEsSUFBSSxtQkFBeUM7QUFDNUMsVUFBTSxJQUFJLE1BQU0saUJBQWlCO0FBQUEsRUFDbEM7QUFBQSxFQUVBLElBQUksa0JBQXdDO0FBQzNDLFVBQU0s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
