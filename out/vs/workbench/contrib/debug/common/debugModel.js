var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { distinct } from "../../../../base/common/arrays.js";
import { findLastIdx } from "../../../../base/common/arraysFind.js";
import { DeferredPromise, RunOnceScheduler } from "../../../../base/common/async.js";
import { VSBuffer, decodeBase64, encodeBase64 } from "../../../../base/common/buffer.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter, trackSetChanges } from "../../../../base/common/event.js";
import { stringHash } from "../../../../base/common/hash.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { mixin } from "../../../../base/common/objects.js";
import { autorun } from "../../../../base/common/observable.js";
import * as resources from "../../../../base/common/resources.js";
import { isString, isUndefinedOrNull } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { Range } from "../../../../editor/common/core/range.js";
import * as nls from "../../../../nls.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { DEBUG_MEMORY_SCHEME, DataBreakpointSetType, DebugTreeItemCollapsibleState, MemoryRangeType, State, isFrameDeemphasized } from "./debug.js";
import { UNKNOWN_SOURCE_LABEL, getUriFromSource } from "./debugSource.js";
import { DisassemblyViewInput } from "./disassemblyViewInput.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
const _ExpressionContainer = class _ExpressionContainer {
  constructor(session, threadId, _reference, id, namedVariables = 0, indexedVariables = 0, memoryReference = void 0, startOfVariables = 0, presentationHint = void 0, valueLocationReference = void 0) {
    this.session = session;
    this.threadId = threadId;
    this._reference = _reference;
    this.id = id;
    this.namedVariables = namedVariables;
    this.indexedVariables = indexedVariables;
    this.memoryReference = memoryReference;
    this.startOfVariables = startOfVariables;
    this.presentationHint = presentationHint;
    this.valueLocationReference = valueLocationReference;
    this.valueChanged = false;
    this._value = "";
  }
  get reference() {
    return this._reference;
  }
  set reference(value) {
    this._reference = value;
    this.children = void 0;
  }
  async evaluateLazy() {
    if (typeof this.reference === "undefined") {
      return;
    }
    const response = await this.session.variables(this.reference, this.threadId, void 0, void 0, void 0);
    if (!response || !response.body || !response.body.variables || response.body.variables.length !== 1) {
      return;
    }
    const dummyVar = response.body.variables[0];
    this.reference = dummyVar.variablesReference;
    this._value = dummyVar.value;
    this.namedVariables = dummyVar.namedVariables;
    this.indexedVariables = dummyVar.indexedVariables;
    this.memoryReference = dummyVar.memoryReference;
    this.presentationHint = dummyVar.presentationHint;
    this.valueLocationReference = dummyVar.valueLocationReference;
    this.adoptLazyResponse(dummyVar);
  }
  adoptLazyResponse(response) {
  }
  getChildren() {
    if (!this.children) {
      this.children = this.doGetChildren();
    }
    return this.children;
  }
  async doGetChildren() {
    if (!this.hasChildren) {
      return [];
    }
    if (!this.getChildrenInChunks) {
      return this.fetchVariables(void 0, void 0, void 0);
    }
    const children = this.namedVariables ? await this.fetchVariables(void 0, void 0, "named") : [];
    let chunkSize = _ExpressionContainer.BASE_CHUNK_SIZE;
    while (!!this.indexedVariables && this.indexedVariables > chunkSize * _ExpressionContainer.BASE_CHUNK_SIZE) {
      chunkSize *= _ExpressionContainer.BASE_CHUNK_SIZE;
    }
    if (!!this.indexedVariables && this.indexedVariables > chunkSize) {
      const numberOfChunks = Math.ceil(this.indexedVariables / chunkSize);
      for (let i = 0; i < numberOfChunks; i++) {
        const start = (this.startOfVariables || 0) + i * chunkSize;
        const count = Math.min(chunkSize, this.indexedVariables - i * chunkSize);
        children.push(new Variable(this.session, this.threadId, this, this.reference, `[${start}..${start + count - 1}]`, "", "", void 0, count, void 0, { kind: "virtual" }, void 0, void 0, true, start));
      }
      return children;
    }
    const variables = await this.fetchVariables(this.startOfVariables, this.indexedVariables, "indexed");
    return children.concat(variables);
  }
  getId() {
    return this.id;
  }
  getSession() {
    return this.session;
  }
  get value() {
    return this._value;
  }
  get hasChildren() {
    return !!this.reference && this.reference > 0 && !this.presentationHint?.lazy;
  }
  async fetchVariables(start, count, filter) {
    try {
      const response = await this.session.variables(this.reference || 0, this.threadId, filter, start, count);
      if (!response || !response.body || !response.body.variables) {
        return [];
      }
      const nameCount = /* @__PURE__ */ new Map();
      const vars = response.body.variables.filter((v) => !!v).map((v) => {
        if (isString(v.value) && isString(v.name) && typeof v.variablesReference === "number") {
          const count2 = nameCount.get(v.name) || 0;
          const idDuplicationIndex = count2 > 0 ? count2.toString() : "";
          nameCount.set(v.name, count2 + 1);
          return new Variable(this.session, this.threadId, this, v.variablesReference, v.name, v.evaluateName, v.value, v.namedVariables, v.indexedVariables, v.memoryReference, v.presentationHint, v.type, v.__vscodeVariableMenuContext, true, 0, idDuplicationIndex, v.declarationLocationReference, v.valueLocationReference);
        }
        return new Variable(this.session, this.threadId, this, 0, "", void 0, nls.localize("invalidVariableAttributes", "Invalid variable attributes"), 0, 0, void 0, { kind: "virtual" }, void 0, void 0, false);
      });
      if (this.session.autoExpandLazyVariables) {
        await Promise.all(vars.map((v) => v.presentationHint?.lazy && v.evaluateLazy()));
      }
      return vars;
    } catch (e) {
      return [new Variable(this.session, this.threadId, this, 0, "", void 0, e.message, 0, 0, void 0, { kind: "virtual" }, void 0, void 0, false)];
    }
  }
  // The adapter explicitly sents the children count of an expression only if there are lots of children which should be chunked.
  get getChildrenInChunks() {
    return !!this.indexedVariables;
  }
  set value(value) {
    this._value = value;
    this.valueChanged = !!_ExpressionContainer.allValues.get(this.getId()) && _ExpressionContainer.allValues.get(this.getId()) !== Expression.DEFAULT_VALUE && _ExpressionContainer.allValues.get(this.getId()) !== value;
    _ExpressionContainer.allValues.set(this.getId(), value);
  }
  toString() {
    return this.value;
  }
  async evaluateExpression(expression, session, stackFrame, context, keepLazyVars = false, location) {
    if (!session || !stackFrame && context !== "repl") {
      this.value = context === "repl" ? nls.localize("startDebugFirst", "Please start a debug session to evaluate expressions") : Expression.DEFAULT_VALUE;
      this.reference = 0;
      return false;
    }
    this.session = session;
    try {
      const response = await session.evaluate(expression, stackFrame ? stackFrame.frameId : void 0, context, location);
      if (response && response.body) {
        this.value = response.body.result || "";
        this.reference = response.body.variablesReference;
        this.namedVariables = response.body.namedVariables;
        this.indexedVariables = response.body.indexedVariables;
        this.memoryReference = response.body.memoryReference;
        this.type = response.body.type || this.type;
        this.presentationHint = response.body.presentationHint;
        this.valueLocationReference = response.body.valueLocationReference;
        if (!keepLazyVars && response.body.presentationHint?.lazy) {
          await this.evaluateLazy();
        }
        return true;
      }
      return false;
    } catch (e) {
      this.value = e.message || "";
      this.reference = 0;
      return false;
    }
  }
};
_ExpressionContainer.allValues = /* @__PURE__ */ new Map();
// Use chunks to support variable paging #9537
_ExpressionContainer.BASE_CHUNK_SIZE = 100;
let ExpressionContainer = _ExpressionContainer;
function handleSetResponse(expression, response) {
  if (response && response.body) {
    expression.value = response.body.value || "";
    expression.type = response.body.type || expression.type;
    expression.reference = response.body.variablesReference;
    expression.namedVariables = response.body.namedVariables;
    expression.indexedVariables = response.body.indexedVariables;
  }
}
class VisualizedExpression {
  constructor(session, visualizer, treeId, treeItem, original) {
    this.session = session;
    this.visualizer = visualizer;
    this.treeId = treeId;
    this.treeItem = treeItem;
    this.original = original;
    this.id = generateUuid();
  }
  evaluateLazy() {
    return Promise.resolve();
  }
  getChildren() {
    return this.visualizer.getVisualizedChildren(this.session, this.treeId, this.treeItem.id);
  }
  getId() {
    return this.id;
  }
  get name() {
    return this.treeItem.label;
  }
  get value() {
    return this.treeItem.description || "";
  }
  get hasChildren() {
    return this.treeItem.collapsibleState !== DebugTreeItemCollapsibleState.None;
  }
  getSession() {
    return this.session;
  }
  /** Edits the value, sets the {@link errorMessage} and returns false if unsuccessful */
  async edit(newValue) {
    try {
      await this.visualizer.editTreeItem(this.treeId, this.treeItem, newValue);
      return true;
    } catch (e) {
      this.errorMessage = e.message;
      return false;
    }
  }
}
const _Expression = class _Expression extends ExpressionContainer {
  constructor(name, id = generateUuid()) {
    super(void 0, void 0, 0, id);
    this.name = name;
    this._onDidChangeValue = new Emitter();
    this.onDidChangeValue = this._onDidChangeValue.event;
    this.available = false;
    if (name) {
      this.value = _Expression.DEFAULT_VALUE;
    }
  }
  async evaluate(session, stackFrame, context, keepLazyVars, location) {
    const hadDefaultValue = this.value === _Expression.DEFAULT_VALUE;
    this.available = await this.evaluateExpression(this.name, session, stackFrame, context, keepLazyVars, location);
    if (hadDefaultValue || this.valueChanged) {
      this._onDidChangeValue.fire(this);
    }
  }
  toString() {
    return `${this.name}
${this.value}`;
  }
  async setExpression(value, stackFrame) {
    if (!this.session) {
      return;
    }
    const response = await this.session.setExpression(stackFrame.frameId, this.name, value);
    handleSetResponse(this, response);
  }
};
_Expression.DEFAULT_VALUE = nls.localize("notAvailable", "not available");
let Expression = _Expression;
class Variable extends ExpressionContainer {
  constructor(session, threadId, parent, reference, name, evaluateName, value, namedVariables, indexedVariables, memoryReference, presentationHint, type = void 0, variableMenuContext = void 0, available = true, startOfVariables = 0, idDuplicationIndex = "", declarationLocationReference = void 0, valueLocationReference = void 0) {
    super(session, threadId, reference, `variable:${parent.getId()}:${name}:${idDuplicationIndex}`, namedVariables, indexedVariables, memoryReference, startOfVariables, presentationHint, valueLocationReference);
    this.parent = parent;
    this.name = name;
    this.evaluateName = evaluateName;
    this.variableMenuContext = variableMenuContext;
    this.available = available;
    this.declarationLocationReference = declarationLocationReference;
    this.value = value || "";
    this.type = type;
  }
  getThreadId() {
    return this.threadId;
  }
  async setVariable(value, stackFrame) {
    if (!this.session) {
      return;
    }
    try {
      if (this.session.capabilities.supportsSetExpression && !this.session.capabilities.supportsSetVariable && this.evaluateName) {
        return this.setExpression(value, stackFrame);
      }
      const response = await this.session.setVariable(this.parent.reference, this.name, value);
      handleSetResponse(this, response);
    } catch (err) {
      this.errorMessage = err.message;
    }
  }
  async setExpression(value, stackFrame) {
    if (!this.session || !this.evaluateName) {
      return;
    }
    const response = await this.session.setExpression(stackFrame.frameId, this.evaluateName, value);
    handleSetResponse(this, response);
  }
  toString() {
    return this.name ? `${this.name}: ${this.value}` : this.value;
  }
  adoptLazyResponse(response) {
    this.evaluateName = response.evaluateName;
  }
  toDebugProtocolObject() {
    return {
      name: this.name,
      variablesReference: this.reference || 0,
      memoryReference: this.memoryReference,
      value: this.value,
      evaluateName: this.evaluateName
    };
  }
}
class Scope extends ExpressionContainer {
  constructor(stackFrame, id, name, reference, expensive, namedVariables, indexedVariables, range) {
    super(stackFrame.thread.session, stackFrame.thread.threadId, reference, `scope:${name}:${id}`, namedVariables, indexedVariables);
    this.stackFrame = stackFrame;
    this.name = name;
    this.expensive = expensive;
    this.range = range;
  }
  toString() {
    return this.name;
  }
  toDebugProtocolObject() {
    return {
      name: this.name,
      variablesReference: this.reference || 0,
      expensive: this.expensive
    };
  }
}
class ErrorScope extends Scope {
  constructor(stackFrame, index, message) {
    super(stackFrame, index, message, 0, false);
  }
  toString() {
    return this.name;
  }
}
class StackFrame {
  constructor(thread, frameId, source, name, presentationHint, range, index, canRestart, instructionPointerReference) {
    this.thread = thread;
    this.frameId = frameId;
    this.source = source;
    this.name = name;
    this.presentationHint = presentationHint;
    this.range = range;
    this.index = index;
    this.canRestart = canRestart;
    this.instructionPointerReference = instructionPointerReference;
  }
  getId() {
    return `stackframe:${this.thread.getId()}:${this.index}:${this.source.name}`;
  }
  getScopes() {
    if (!this.scopes) {
      this.scopes = this.thread.session.scopes(this.frameId, this.thread.threadId).then((response) => {
        if (!response || !response.body || !response.body.scopes) {
          return [];
        }
        const usedIds = /* @__PURE__ */ new Set();
        return response.body.scopes.map((rs) => {
          let id = 0;
          do {
            id = stringHash(`${rs.name}:${rs.line}:${rs.column}`, id);
          } while (usedIds.has(id));
          usedIds.add(id);
          return new Scope(
            this,
            id,
            rs.name,
            rs.variablesReference,
            rs.expensive,
            rs.namedVariables,
            rs.indexedVariables,
            rs.line && rs.column && rs.endLine && rs.endColumn ? new Range(rs.line, rs.column, rs.endLine, rs.endColumn) : void 0
          );
        });
      }, (err) => [new ErrorScope(this, 0, err.message)]);
    }
    return this.scopes;
  }
  async getMostSpecificScopes(range) {
    const scopes = await this.getScopes();
    const nonExpensiveScopes = scopes.filter((s) => !s.expensive);
    const haveRangeInfo = nonExpensiveScopes.some((s) => !!s.range);
    if (!haveRangeInfo) {
      return nonExpensiveScopes;
    }
    const scopesContainingRange = nonExpensiveScopes.filter((scope) => scope.range && Range.containsRange(scope.range, range)).sort((first, second) => first.range.endLineNumber - first.range.startLineNumber - (second.range.endLineNumber - second.range.startLineNumber));
    return scopesContainingRange.length ? scopesContainingRange : nonExpensiveScopes;
  }
  restart() {
    return this.thread.session.restartFrame(this.frameId, this.thread.threadId);
  }
  forgetScopes() {
    this.scopes = void 0;
  }
  toString() {
    const lineNumberToString = typeof this.range.startLineNumber === "number" ? `:${this.range.startLineNumber}` : "";
    const sourceToString = `${this.source.inMemory ? this.source.name : this.source.uri.fsPath}${lineNumberToString}`;
    return sourceToString === UNKNOWN_SOURCE_LABEL ? this.name : `${this.name} (${sourceToString})`;
  }
  async openInEditor(editorService, preserveFocus, sideBySide, pinned) {
    const threadStopReason = this.thread.stoppedDetails?.reason;
    if (this.instructionPointerReference && (threadStopReason === "instruction breakpoint" || threadStopReason === "step" && this.thread.lastSteppingGranularity === "instruction" || editorService.activeEditor instanceof DisassemblyViewInput)) {
      return editorService.openEditor(DisassemblyViewInput.instance, { pinned: true, revealIfOpened: true });
    }
    if (this.source.available) {
      return this.source.openInEditor(editorService, this.range, preserveFocus, sideBySide, pinned);
    }
    return void 0;
  }
  equals(other) {
    return this.name === other.name && other.thread === this.thread && this.frameId === other.frameId && other.source === this.source && Range.equalsRange(this.range, other.range);
  }
}
const KEEP_SUBTLE_FRAME_AT_TOP_REASONS = ["breakpoint", "step", "function breakpoint"];
class Thread {
  constructor(session, name, threadId) {
    this.session = session;
    this.name = name;
    this.threadId = threadId;
    this.callStackCancellationTokens = [];
    this.reachedEndOfCallStack = false;
    this.callStack = [];
    this.staleCallStack = [];
    this.stopped = false;
  }
  getId() {
    return `thread:${this.session.getId()}:${this.threadId}`;
  }
  clearCallStack() {
    if (this.callStack.length) {
      this.staleCallStack = this.callStack;
    }
    this.callStack = [];
    this.callStackCancellationTokens.forEach((c) => c.dispose(true));
    this.callStackCancellationTokens = [];
  }
  getCallStack() {
    return this.callStack;
  }
  getStaleCallStack() {
    return this.staleCallStack;
  }
  getTopStackFrame() {
    const callStack = this.getCallStack();
    const stopReason = this.stoppedDetails?.reason;
    const firstAvailableStackFrame = callStack.find((sf) => !!((stopReason === "instruction breakpoint" || stopReason === "step" && this.lastSteppingGranularity === "instruction") && sf.instructionPointerReference || sf.source && sf.source.available && (KEEP_SUBTLE_FRAME_AT_TOP_REASONS.includes(stopReason) || !isFrameDeemphasized(sf))));
    return firstAvailableStackFrame;
  }
  get stateLabel() {
    if (this.stoppedDetails) {
      return this.stoppedDetails.description || (this.stoppedDetails.reason ? nls.localize({ key: "pausedOn", comment: ["indicates reason for program being paused"] }, "Paused on {0}", this.stoppedDetails.reason) : nls.localize("paused", "Paused"));
    }
    return nls.localize({ key: "running", comment: ["indicates state"] }, "Running");
  }
  /**
   * Queries the debug adapter for the callstack and returns a promise
   * which completes once the call stack has been retrieved.
   * If the thread is not stopped, it returns a promise to an empty array.
   * Only fetches the first stack frame for performance reasons. Calling this method consecutive times
   * gets the remainder of the call stack.
   */
  async fetchCallStack(levels = 20) {
    if (this.stopped) {
      const start = this.callStack.length;
      const callStack = await this.getCallStackImpl(start, levels);
      this.reachedEndOfCallStack = callStack.length < levels;
      if (start < this.callStack.length) {
        this.callStack.splice(start, this.callStack.length - start);
      }
      this.callStack = this.callStack.concat(callStack || []);
      if (typeof this.stoppedDetails?.totalFrames === "number" && this.stoppedDetails.totalFrames === this.callStack.length) {
        this.reachedEndOfCallStack = true;
      }
    }
  }
  async getCallStackImpl(startFrame, levels) {
    try {
      const tokenSource = new CancellationTokenSource();
      this.callStackCancellationTokens.push(tokenSource);
      const response = await this.session.stackTrace(this.threadId, startFrame, levels, tokenSource.token);
      if (!response || !response.body || tokenSource.token.isCancellationRequested) {
        return [];
      }
      if (this.stoppedDetails) {
        this.stoppedDetails.totalFrames = response.body.totalFrames;
      }
      return response.body.stackFrames.map((rsf, index) => {
        const source = this.session.getSource(rsf.source);
        return new StackFrame(this, rsf.id, source, rsf.name, rsf.presentationHint, new Range(
          rsf.line,
          rsf.column,
          rsf.endLine || rsf.line,
          rsf.endColumn || rsf.column
        ), startFrame + index, typeof rsf.canRestart === "boolean" ? rsf.canRestart : true, rsf.instructionPointerReference);
      });
    } catch (err) {
      if (this.stoppedDetails) {
        this.stoppedDetails.framesErrorMessage = err.message;
      }
      return [];
    }
  }
  /**
   * Returns exception info promise if the exception was thrown, otherwise undefined
   */
  get exceptionInfo() {
    if (this.stoppedDetails && this.stoppedDetails.reason === "exception") {
      if (this.session.capabilities.supportsExceptionInfoRequest) {
        return this.session.exceptionInfo(this.threadId);
      }
      return Promise.resolve({
        description: this.stoppedDetails.text,
        breakMode: null
      });
    }
    return Promise.resolve(void 0);
  }
  next(granularity) {
    return this.session.next(this.threadId, granularity);
  }
  stepIn(granularity) {
    return this.session.stepIn(this.threadId, void 0, granularity);
  }
  stepOut(granularity) {
    return this.session.stepOut(this.threadId, granularity);
  }
  stepBack(granularity) {
    return this.session.stepBack(this.threadId, granularity);
  }
  continue() {
    return this.session.continue(this.threadId);
  }
  pause() {
    return this.session.pause(this.threadId);
  }
  terminate() {
    return this.session.terminateThreads([this.threadId]);
  }
  reverseContinue() {
    return this.session.reverseContinue(this.threadId);
  }
}
const getUriForDebugMemory = (sessionId, memoryReference, range, displayName = "memory") => {
  return URI.from({
    scheme: DEBUG_MEMORY_SCHEME,
    authority: sessionId,
    path: "/" + encodeURIComponent(memoryReference) + `/${encodeURIComponent(displayName)}.bin`,
    query: range ? `?range=${range.fromOffset}:${range.toOffset}` : void 0
  });
};
class MemoryRegion extends Disposable {
  constructor(memoryReference, session) {
    super();
    this.memoryReference = memoryReference;
    this.session = session;
    this.invalidateEmitter = this._register(new Emitter());
    /** @inheritdoc */
    this.onDidInvalidate = this.invalidateEmitter.event;
    /** @inheritdoc */
    this.writable = !!this.session.capabilities.supportsWriteMemoryRequest;
    this._register(session.onDidInvalidateMemory((e) => {
      if (e.body.memoryReference === memoryReference) {
        this.invalidate(e.body.offset, e.body.count - e.body.offset);
      }
    }));
  }
  async read(fromOffset, toOffset) {
    const length = toOffset - fromOffset;
    const offset = fromOffset;
    const result = await this.session.readMemory(this.memoryReference, offset, length);
    if (result === void 0 || !result.body?.data) {
      return [{ type: MemoryRangeType.Unreadable, offset, length }];
    }
    let data;
    try {
      data = decodeBase64(result.body.data);
    } catch {
      return [{ type: MemoryRangeType.Error, offset, length, error: "Invalid base64 data from debug adapter" }];
    }
    const unreadable = result.body.unreadableBytes || 0;
    const dataLength = length - unreadable;
    if (data.byteLength < dataLength) {
      const pad = VSBuffer.alloc(dataLength - data.byteLength);
      pad.buffer.fill(0);
      data = VSBuffer.concat([data, pad], dataLength);
    } else if (data.byteLength > dataLength) {
      data = data.slice(0, dataLength);
    }
    if (!unreadable) {
      return [{ type: MemoryRangeType.Valid, offset, length, data }];
    }
    return [
      { type: MemoryRangeType.Valid, offset, length: dataLength, data },
      { type: MemoryRangeType.Unreadable, offset: offset + dataLength, length: unreadable }
    ];
  }
  async write(offset, data) {
    const result = await this.session.writeMemory(this.memoryReference, offset, encodeBase64(data), true);
    const written = result?.body?.bytesWritten ?? data.byteLength;
    this.invalidate(offset, offset + written);
    return written;
  }
  dispose() {
    super.dispose();
  }
  invalidate(fromOffset, toOffset) {
    this.invalidateEmitter.fire({ fromOffset, toOffset });
  }
}
class Enablement {
  constructor(enabled, id) {
    this.enabled = enabled;
    this.id = id;
  }
  getId() {
    return this.id;
  }
}
function toBreakpointSessionData(data, capabilities) {
  return mixin({
    supportsConditionalBreakpoints: !!capabilities.supportsConditionalBreakpoints,
    supportsHitConditionalBreakpoints: !!capabilities.supportsHitConditionalBreakpoints,
    supportsLogPoints: !!capabilities.supportsLogPoints,
    supportsFunctionBreakpoints: !!capabilities.supportsFunctionBreakpoints,
    supportsDataBreakpoints: !!capabilities.supportsDataBreakpoints,
    supportsInstructionBreakpoints: !!capabilities.supportsInstructionBreakpoints
  }, data);
}
class BaseBreakpoint extends Enablement {
  constructor(id, opts) {
    super(opts.enabled ?? true, id);
    this.sessionData = /* @__PURE__ */ new Map();
    this.condition = opts.condition;
    this.hitCondition = opts.hitCondition;
    this.logMessage = opts.logMessage;
    this.mode = opts.mode;
    this.modeLabel = opts.modeLabel;
  }
  setSessionData(sessionId, data) {
    if (!data) {
      this.sessionData.delete(sessionId);
    } else {
      data.sessionId = sessionId;
      this.sessionData.set(sessionId, data);
    }
    const allData = Array.from(this.sessionData.values());
    const verifiedData = distinct(allData.filter((d) => d.verified), (d) => `${d.line}:${d.column}`);
    if (verifiedData.length) {
      this.data = verifiedData.length === 1 ? verifiedData[0] : void 0;
    } else {
      this.data = allData.length ? allData[0] : void 0;
    }
  }
  get message() {
    if (!this.data) {
      return void 0;
    }
    return this.data.message;
  }
  get verified() {
    return this.data ? this.data.verified : true;
  }
  get sessionsThatVerified() {
    const sessionIds = [];
    for (const [sessionId, data] of this.sessionData) {
      if (data.verified) {
        sessionIds.push(sessionId);
      }
    }
    return sessionIds;
  }
  getIdFromAdapter(sessionId) {
    const data = this.sessionData.get(sessionId);
    return data ? data.id : void 0;
  }
  getDebugProtocolBreakpoint(sessionId) {
    const data = this.sessionData.get(sessionId);
    if (data) {
      const bp = {
        id: data.id,
        verified: data.verified,
        message: data.message,
        source: data.source,
        line: data.line,
        column: data.column,
        endLine: data.endLine,
        endColumn: data.endColumn,
        instructionReference: data.instructionReference,
        offset: data.offset
      };
      return bp;
    }
    return void 0;
  }
  toJSON() {
    return {
      id: this.getId(),
      enabled: this.enabled,
      condition: this.condition,
      hitCondition: this.hitCondition,
      logMessage: this.logMessage,
      mode: this.mode,
      modeLabel: this.modeLabel
    };
  }
}
class Breakpoint extends BaseBreakpoint {
  constructor(opts, textFileService, uriIdentityService, logService, id = generateUuid()) {
    super(id, opts);
    this.textFileService = textFileService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this._uri = opts.uri;
    this._lineNumber = opts.lineNumber;
    this._column = opts.column;
    this._adapterData = opts.adapterData;
    this.triggeredBy = opts.triggeredBy;
  }
  toDAP() {
    return {
      line: this.sessionAgnosticData.lineNumber,
      column: this.sessionAgnosticData.column,
      condition: this.condition,
      hitCondition: this.hitCondition,
      logMessage: this.logMessage,
      mode: this.mode
    };
  }
  get originalUri() {
    return this._uri;
  }
  get lineNumber() {
    return this.verified && this.data && typeof this.data.line === "number" ? this.data.line : this._lineNumber;
  }
  get verified() {
    if (this.data) {
      return this.data.verified && !this.textFileService.isDirty(this._uri);
    }
    return true;
  }
  get pending() {
    if (this.data) {
      return false;
    }
    return this.triggeredBy !== void 0;
  }
  get uri() {
    return this.verified && this.data && this.data.source ? getUriFromSource(this.data.source, this.data.source.path, this.data.sessionId, this.uriIdentityService, this.logService) : this._uri;
  }
  get column() {
    return this.verified && this.data && typeof this.data.column === "number" ? this.data.column : this._column;
  }
  get message() {
    if (this.textFileService.isDirty(this.uri)) {
      return nls.localize("breakpointDirtydHover", "Unverified breakpoint. File is modified, please restart debug session.");
    }
    return super.message;
  }
  get adapterData() {
    return this.data && this.data.source && this.data.source.adapterData ? this.data.source.adapterData : this._adapterData;
  }
  get endLineNumber() {
    return this.verified && this.data ? this.data.endLine : void 0;
  }
  get endColumn() {
    return this.verified && this.data ? this.data.endColumn : void 0;
  }
  get sessionAgnosticData() {
    return {
      lineNumber: this._lineNumber,
      column: this._column
    };
  }
  get supported() {
    if (!this.data) {
      return true;
    }
    if (this.logMessage && !this.data.supportsLogPoints) {
      return false;
    }
    if (this.condition && !this.data.supportsConditionalBreakpoints) {
      return false;
    }
    if (this.hitCondition && !this.data.supportsHitConditionalBreakpoints) {
      return false;
    }
    return true;
  }
  setSessionData(sessionId, data) {
    super.setSessionData(sessionId, data);
    if (!this._adapterData) {
      this._adapterData = this.adapterData;
    }
  }
  toJSON() {
    return {
      ...super.toJSON(),
      uri: this._uri,
      lineNumber: this._lineNumber,
      column: this._column,
      adapterData: this.adapterData,
      triggeredBy: this.triggeredBy
    };
  }
  toString() {
    return `${resources.basenameOrAuthority(this.uri)} ${this.lineNumber}`;
  }
  setSessionDidTrigger(sessionId, didTrigger = true) {
    if (didTrigger) {
      this.sessionsDidTrigger ??= /* @__PURE__ */ new Set();
      this.sessionsDidTrigger.add(sessionId);
    } else {
      this.sessionsDidTrigger?.delete(sessionId);
    }
  }
  getSessionDidTrigger(sessionId) {
    return !!this.sessionsDidTrigger?.has(sessionId);
  }
  update(data) {
    if (data.hasOwnProperty("lineNumber") && !isUndefinedOrNull(data.lineNumber)) {
      this._lineNumber = data.lineNumber;
    }
    if (data.hasOwnProperty("column")) {
      this._column = data.column;
    }
    if (data.hasOwnProperty("condition")) {
      this.condition = data.condition;
    }
    if (data.hasOwnProperty("hitCondition")) {
      this.hitCondition = data.hitCondition;
    }
    if (data.hasOwnProperty("logMessage")) {
      this.logMessage = data.logMessage;
    }
    if (data.hasOwnProperty("mode")) {
      this.mode = data.mode;
      this.modeLabel = data.modeLabel;
    }
    if (data.hasOwnProperty("triggeredBy")) {
      this.triggeredBy = data.triggeredBy;
      this.sessionsDidTrigger = void 0;
    }
  }
}
class FunctionBreakpoint extends BaseBreakpoint {
  constructor(opts, id = generateUuid()) {
    super(id, opts);
    this.name = opts.name;
  }
  toDAP() {
    return {
      name: this.name,
      condition: this.condition,
      hitCondition: this.hitCondition
    };
  }
  toJSON() {
    return {
      ...super.toJSON(),
      name: this.name
    };
  }
  get supported() {
    if (!this.data) {
      return true;
    }
    return this.data.supportsFunctionBreakpoints;
  }
  toString() {
    return this.name;
  }
}
class DataBreakpoint extends BaseBreakpoint {
  constructor(opts, id = generateUuid()) {
    super(id, opts);
    this.sessionDataIdForAddr = /* @__PURE__ */ new WeakMap();
    this.description = opts.description;
    if ("dataId" in opts) {
      opts.src = { type: DataBreakpointSetType.Variable, dataId: opts.dataId };
    }
    this.src = opts.src;
    this.canPersist = opts.canPersist;
    this.accessTypes = opts.accessTypes;
    this.accessType = opts.accessType;
    if (opts.initialSessionData) {
      this.sessionDataIdForAddr.set(opts.initialSessionData.session, opts.initialSessionData.dataId);
    }
  }
  async toDAP(session) {
    let dataId;
    if (this.src.type === DataBreakpointSetType.Variable) {
      dataId = this.src.dataId;
    } else {
      let sessionDataId = this.sessionDataIdForAddr.get(session);
      if (!sessionDataId) {
        sessionDataId = (await session.dataBytesBreakpointInfo(this.src.address, this.src.bytes))?.dataId;
        if (!sessionDataId) {
          return void 0;
        }
        this.sessionDataIdForAddr.set(session, sessionDataId);
      }
      dataId = sessionDataId;
    }
    return {
      dataId,
      accessType: this.accessType,
      condition: this.condition,
      hitCondition: this.hitCondition
    };
  }
  toJSON() {
    return {
      ...super.toJSON(),
      description: this.description,
      src: this.src,
      accessTypes: this.accessTypes,
      accessType: this.accessType,
      canPersist: this.canPersist
    };
  }
  get supported() {
    if (!this.data) {
      return true;
    }
    return this.data.supportsDataBreakpoints;
  }
  toString() {
    return this.description;
  }
}
class ExceptionBreakpoint extends BaseBreakpoint {
  constructor(opts, id = generateUuid()) {
    super(id, opts);
    this.supportedSessions = /* @__PURE__ */ new Set();
    this.fallback = false;
    this.filter = opts.filter;
    this.label = opts.label;
    this.supportsCondition = opts.supportsCondition;
    this.description = opts.description;
    this.conditionDescription = opts.conditionDescription;
    this.fallback = opts.fallback || false;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      filter: this.filter,
      label: this.label,
      enabled: this.enabled,
      supportsCondition: this.supportsCondition,
      conditionDescription: this.conditionDescription,
      condition: this.condition,
      fallback: this.fallback,
      description: this.description
    };
  }
  setSupportedSession(sessionId, supported) {
    if (supported) {
      this.supportedSessions.add(sessionId);
    } else {
      this.supportedSessions.delete(sessionId);
    }
  }
  /**
   * Used to specify which breakpoints to show when no session is specified.
   * Useful when no session is active and we want to show the exception breakpoints from the last session.
   */
  setFallback(isFallback) {
    this.fallback = isFallback;
  }
  get supported() {
    return true;
  }
  /**
   * Checks if the breakpoint is applicable for the specified session.
   * If sessionId is undefined, returns true if this breakpoint is a fallback breakpoint.
   */
  isSupportedSession(sessionId) {
    return sessionId ? this.supportedSessions.has(sessionId) : this.fallback;
  }
  matches(filter) {
    return this.filter === filter.filter && this.label === filter.label && this.supportsCondition === !!filter.supportsCondition && this.conditionDescription === filter.conditionDescription && this.description === filter.description;
  }
  toString() {
    return this.label;
  }
}
class InstructionBreakpoint extends BaseBreakpoint {
  constructor(opts, id = generateUuid()) {
    super(id, opts);
    this.instructionReference = opts.instructionReference;
    this.offset = opts.offset;
    this.canPersist = opts.canPersist;
    this.address = opts.address;
  }
  toDAP() {
    return {
      instructionReference: this.instructionReference,
      condition: this.condition,
      hitCondition: this.hitCondition,
      mode: this.mode,
      offset: this.offset
    };
  }
  toJSON() {
    return {
      ...super.toJSON(),
      instructionReference: this.instructionReference,
      offset: this.offset,
      canPersist: this.canPersist,
      address: this.address
    };
  }
  get supported() {
    if (!this.data) {
      return true;
    }
    return this.data.supportsInstructionBreakpoints;
  }
  toString() {
    return this.instructionReference;
  }
}
class ThreadAndSessionIds {
  constructor(sessionId, threadId) {
    this.sessionId = sessionId;
    this.threadId = threadId;
  }
  getId() {
    return `${this.sessionId}:${this.threadId}`;
  }
}
let DebugModel = class extends Disposable {
  constructor(debugStorage, textFileService, uriIdentityService, logService) {
    super();
    this.textFileService = textFileService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this.schedulers = /* @__PURE__ */ new Map();
    this.breakpointsActivated = true;
    this._onDidChangeBreakpoints = this._register(new Emitter());
    this._onDidChangeCallStack = this._register(new Emitter());
    this._onDidChangeWatchExpressions = this._register(new Emitter());
    this._onDidChangeWatchExpressionValue = this._register(new Emitter());
    this._breakpointModes = /* @__PURE__ */ new Map();
    this._register(autorun((reader) => {
      this.breakpoints = debugStorage.breakpoints.read(reader);
      this.functionBreakpoints = debugStorage.functionBreakpoints.read(reader);
      this.exceptionBreakpoints = debugStorage.exceptionBreakpoints.read(reader);
      this.dataBreakpoints = debugStorage.dataBreakpoints.read(reader);
      this._onDidChangeBreakpoints.fire(void 0);
    }));
    this._register(autorun((reader) => {
      this.watchExpressions = debugStorage.watchExpressions.read(reader);
      this._onDidChangeWatchExpressions.fire(void 0);
    }));
    this._register(
      trackSetChanges(
        () => new Set(this.watchExpressions),
        this.onDidChangeWatchExpressions,
        (we) => we.onDidChangeValue((e) => this._onDidChangeWatchExpressionValue.fire(e))
      )
    );
    this.instructionBreakpoints = [];
    this.sessions = [];
  }
  getId() {
    return "root";
  }
  getSession(sessionId, includeInactive = false) {
    if (sessionId) {
      return this.getSessions(includeInactive).find((s) => s.getId() === sessionId);
    }
    return void 0;
  }
  getSessions(includeInactive = false) {
    return this.sessions.filter((s) => includeInactive || s.state !== State.Inactive);
  }
  addSession(session) {
    this.sessions = this.sessions.filter((s) => {
      if (s.getId() === session.getId()) {
        return false;
      }
      if (s.state === State.Inactive && s.configuration.name === session.configuration.name) {
        return false;
      }
      return true;
    });
    let i = 1;
    while (this.sessions.some((s) => s.getLabel() === session.getLabel())) {
      session.setName(`${session.configuration.name} ${++i}`);
    }
    let index = -1;
    if (session.parentSession) {
      index = findLastIdx(this.sessions, (s) => s.parentSession === session.parentSession || s === session.parentSession);
    }
    if (index >= 0) {
      this.sessions.splice(index + 1, 0, session);
    } else {
      this.sessions.push(session);
    }
    this._onDidChangeCallStack.fire(void 0);
  }
  get onDidChangeBreakpoints() {
    return this._onDidChangeBreakpoints.event;
  }
  get onDidChangeCallStack() {
    return this._onDidChangeCallStack.event;
  }
  get onDidChangeWatchExpressions() {
    return this._onDidChangeWatchExpressions.event;
  }
  get onDidChangeWatchExpressionValue() {
    return this._onDidChangeWatchExpressionValue.event;
  }
  rawUpdate(data) {
    const session = this.sessions.find((p) => p.getId() === data.sessionId);
    if (session) {
      session.rawUpdate(data);
      this._onDidChangeCallStack.fire(void 0);
    }
  }
  clearThreads(id, removeThreads, reference = void 0) {
    const session = this.sessions.find((p) => p.getId() === id);
    this.schedulers.forEach((entry) => {
      entry.scheduler.dispose();
      entry.completeDeferred.complete();
    });
    this.schedulers.clear();
    if (session) {
      session.clearThreads(removeThreads, reference);
      this._onDidChangeCallStack.fire(void 0);
    }
  }
  /**
   * Update the call stack and notify the call stack view that changes have occurred.
   */
  async fetchCallstack(thread, levels) {
    if (thread.reachedEndOfCallStack) {
      return;
    }
    const totalFrames = thread.stoppedDetails?.totalFrames;
    const remainingFrames = typeof totalFrames === "number" ? totalFrames - thread.getCallStack().length : void 0;
    if (!levels || remainingFrames && levels > remainingFrames) {
      levels = remainingFrames;
    }
    if (levels && levels > 0) {
      await thread.fetchCallStack(levels);
      this._onDidChangeCallStack.fire();
    }
    return;
  }
  refreshTopOfCallstack(thread, fetchFullStack = true) {
    if (thread.session.capabilities.supportsDelayedStackTraceLoading) {
      let topCallStack = Promise.resolve();
      const wholeCallStack2 = new Promise((c, e) => {
        topCallStack = thread.fetchCallStack(1).then(() => {
          if (!fetchFullStack) {
            c();
            this._onDidChangeCallStack.fire();
            return;
          }
          if (!this.schedulers.has(thread.getId())) {
            const deferred = new DeferredPromise();
            this.schedulers.set(thread.getId(), {
              completeDeferred: deferred,
              scheduler: new RunOnceScheduler(() => {
                thread.fetchCallStack(19).then(() => {
                  const stale = thread.getStaleCallStack();
                  const current = thread.getCallStack();
                  let bottomOfCallStackChanged = stale.length !== current.length;
                  for (let i = 1; i < stale.length && !bottomOfCallStackChanged; i++) {
                    bottomOfCallStackChanged = !stale[i].equals(current[i]);
                  }
                  if (bottomOfCallStackChanged) {
                    this._onDidChangeCallStack.fire();
                  }
                }).finally(() => {
                  deferred.complete();
                  this.schedulers.delete(thread.getId());
                });
              }, 420)
            });
          }
          const entry = this.schedulers.get(thread.getId());
          entry.scheduler.schedule();
          entry.completeDeferred.p.then(c, e);
          this._onDidChangeCallStack.fire();
        });
      });
      return { topCallStack, wholeCallStack: wholeCallStack2 };
    }
    const wholeCallStack = thread.fetchCallStack();
    return { wholeCallStack, topCallStack: wholeCallStack };
  }
  getBreakpoints(filter) {
    if (filter) {
      const uriStr = filter.uri?.toString();
      const originalUriStr = filter.originalUri?.toString();
      return this.breakpoints.filter((bp) => {
        if (uriStr && bp.uri.toString() !== uriStr) {
          return false;
        }
        if (originalUriStr && bp.originalUri.toString() !== originalUriStr) {
          return false;
        }
        if (filter.lineNumber && bp.lineNumber !== filter.lineNumber) {
          return false;
        }
        if (filter.column && bp.column !== filter.column) {
          return false;
        }
        if (filter.enabledOnly && (!this.breakpointsActivated || !bp.enabled)) {
          return false;
        }
        if (filter.triggeredOnly && bp.triggeredBy === void 0) {
          return false;
        }
        return true;
      });
    }
    return this.breakpoints;
  }
  getFunctionBreakpoints() {
    return this.functionBreakpoints;
  }
  getDataBreakpoints() {
    return this.dataBreakpoints;
  }
  getExceptionBreakpoints() {
    return this.exceptionBreakpoints;
  }
  getExceptionBreakpointsForSession(sessionId) {
    return this.exceptionBreakpoints.filter((ebp) => ebp.isSupportedSession(sessionId));
  }
  getInstructionBreakpoints() {
    return this.instructionBreakpoints;
  }
  setExceptionBreakpointsForSession(sessionId, filters) {
    if (!filters) {
      return;
    }
    let didChangeBreakpoints = false;
    filters.forEach((d) => {
      let ebp = this.exceptionBreakpoints.filter((exbp) => exbp.matches(d)).pop();
      if (!ebp) {
        didChangeBreakpoints = true;
        ebp = new ExceptionBreakpoint({
          filter: d.filter,
          label: d.label,
          enabled: !!d.default,
          supportsCondition: !!d.supportsCondition,
          description: d.description,
          conditionDescription: d.conditionDescription
        });
        this.exceptionBreakpoints.push(ebp);
      }
      ebp.setSupportedSession(sessionId, true);
    });
    if (didChangeBreakpoints) {
      this._onDidChangeBreakpoints.fire(void 0);
    }
  }
  removeExceptionBreakpointsForSession(sessionId) {
    this.exceptionBreakpoints.forEach((ebp) => ebp.setSupportedSession(sessionId, false));
  }
  // Set last focused session as fallback session.
  // This is done to keep track of the exception breakpoints to show when no session is active.
  setExceptionBreakpointFallbackSession(sessionId) {
    this.exceptionBreakpoints.forEach((ebp) => ebp.setFallback(ebp.isSupportedSession(sessionId)));
  }
  setExceptionBreakpointCondition(exceptionBreakpoint, condition) {
    exceptionBreakpoint.condition = condition;
    this._onDidChangeBreakpoints.fire(void 0);
  }
  areBreakpointsActivated() {
    return this.breakpointsActivated;
  }
  setBreakpointsActivated(activated) {
    this.breakpointsActivated = activated;
    this._onDidChangeBreakpoints.fire(void 0);
  }
  addBreakpoints(uri2, rawData, fireEvent = true) {
    const newBreakpoints = rawData.map((rawBp) => {
      return new Breakpoint({
        uri: uri2,
        lineNumber: rawBp.lineNumber,
        column: rawBp.column,
        enabled: rawBp.enabled ?? true,
        condition: rawBp.condition,
        hitCondition: rawBp.hitCondition,
        logMessage: rawBp.logMessage,
        triggeredBy: rawBp.triggeredBy,
        adapterData: void 0,
        mode: rawBp.mode,
        modeLabel: rawBp.modeLabel
      }, this.textFileService, this.uriIdentityService, this.logService, rawBp.id);
    });
    this.breakpoints = this.breakpoints.concat(newBreakpoints);
    this.breakpointsActivated = true;
    this.sortAndDeDup();
    if (fireEvent) {
      this._onDidChangeBreakpoints.fire({ added: newBreakpoints, sessionOnly: false });
    }
    return newBreakpoints;
  }
  removeBreakpoints(toRemove) {
    this.breakpoints = this.breakpoints.filter((bp) => !toRemove.some((toRemove2) => toRemove2.getId() === bp.getId()));
    this._onDidChangeBreakpoints.fire({ removed: toRemove, sessionOnly: false });
  }
  updateBreakpoints(data) {
    const updated = [];
    this.breakpoints.forEach((bp) => {
      const bpData = data.get(bp.getId());
      if (bpData) {
        bp.update(bpData);
        updated.push(bp);
      }
    });
    this.sortAndDeDup();
    this._onDidChangeBreakpoints.fire({ changed: updated, sessionOnly: false });
  }
  setBreakpointSessionData(sessionId, capabilites, data) {
    this.breakpoints.forEach((bp) => {
      if (!data) {
        bp.setSessionData(sessionId, void 0);
      } else {
        const bpData = data.get(bp.getId());
        if (bpData) {
          bp.setSessionData(sessionId, toBreakpointSessionData(bpData, capabilites));
        }
      }
    });
    this.functionBreakpoints.forEach((fbp) => {
      if (!data) {
        fbp.setSessionData(sessionId, void 0);
      } else {
        const fbpData = data.get(fbp.getId());
        if (fbpData) {
          fbp.setSessionData(sessionId, toBreakpointSessionData(fbpData, capabilites));
        }
      }
    });
    this.dataBreakpoints.forEach((dbp) => {
      if (!data) {
        dbp.setSessionData(sessionId, void 0);
      } else {
        const dbpData = data.get(dbp.getId());
        if (dbpData) {
          dbp.setSessionData(sessionId, toBreakpointSessionData(dbpData, capabilites));
        }
      }
    });
    this.exceptionBreakpoints.forEach((ebp) => {
      if (!data) {
        ebp.setSessionData(sessionId, void 0);
      } else {
        const ebpData = data.get(ebp.getId());
        if (ebpData) {
          ebp.setSessionData(sessionId, toBreakpointSessionData(ebpData, capabilites));
        }
      }
    });
    this.instructionBreakpoints.forEach((ibp) => {
      if (!data) {
        ibp.setSessionData(sessionId, void 0);
      } else {
        const ibpData = data.get(ibp.getId());
        if (ibpData) {
          ibp.setSessionData(sessionId, toBreakpointSessionData(ibpData, capabilites));
        }
      }
    });
    this._onDidChangeBreakpoints.fire({
      sessionOnly: true
    });
  }
  getDebugProtocolBreakpoint(breakpointId, sessionId) {
    const bp = this.breakpoints.find((bp2) => bp2.getId() === breakpointId);
    if (bp) {
      return bp.getDebugProtocolBreakpoint(sessionId);
    }
    return void 0;
  }
  getBreakpointModes(forBreakpointType) {
    return [...this._breakpointModes.values()].filter((mode) => mode.appliesTo.includes(forBreakpointType));
  }
  registerBreakpointModes(debugType, modes) {
    for (const mode of modes) {
      const key = `${mode.mode}/${mode.label}`;
      const rec = this._breakpointModes.get(key);
      if (rec) {
        for (const target of mode.appliesTo) {
          if (!rec.appliesTo.includes(target)) {
            rec.appliesTo.push(target);
          }
        }
      } else {
        const duplicate = [...this._breakpointModes.values()].find((r) => r !== rec && r.label === mode.label);
        if (duplicate) {
          duplicate.label = `${duplicate.label} (${duplicate.firstFromDebugType})`;
        }
        this._breakpointModes.set(key, {
          mode: mode.mode,
          label: duplicate ? `${mode.label} (${debugType})` : mode.label,
          firstFromDebugType: debugType,
          description: mode.description,
          appliesTo: mode.appliesTo.slice()
          // avoid later mutations
        });
      }
    }
  }
  sortAndDeDup() {
    this.breakpoints = this.breakpoints.sort((first, second) => {
      if (first.uri.toString() !== second.uri.toString()) {
        return resources.basenameOrAuthority(first.uri).localeCompare(resources.basenameOrAuthority(second.uri));
      }
      if (first.lineNumber === second.lineNumber) {
        if (first.column && second.column) {
          return first.column - second.column;
        }
        return 1;
      }
      return first.lineNumber - second.lineNumber;
    });
    this.breakpoints = distinct(this.breakpoints, (bp) => `${bp.uri.toString()}:${bp.lineNumber}:${bp.column}`);
  }
  setEnablement(element, enable) {
    if (element instanceof Breakpoint || element instanceof FunctionBreakpoint || element instanceof ExceptionBreakpoint || element instanceof DataBreakpoint || element instanceof InstructionBreakpoint) {
      const changed = [];
      if (element.enabled !== enable && (element instanceof Breakpoint || element instanceof FunctionBreakpoint || element instanceof DataBreakpoint || element instanceof InstructionBreakpoint)) {
        changed.push(element);
      }
      element.enabled = enable;
      if (enable) {
        this.breakpointsActivated = true;
      }
      this._onDidChangeBreakpoints.fire({ changed, sessionOnly: false });
    }
  }
  enableOrDisableAllBreakpoints(enable) {
    const changed = [];
    this.breakpoints.forEach((bp) => {
      if (bp.enabled !== enable) {
        changed.push(bp);
      }
      bp.enabled = enable;
    });
    this.functionBreakpoints.forEach((fbp) => {
      if (fbp.enabled !== enable) {
        changed.push(fbp);
      }
      fbp.enabled = enable;
    });
    this.dataBreakpoints.forEach((dbp) => {
      if (dbp.enabled !== enable) {
        changed.push(dbp);
      }
      dbp.enabled = enable;
    });
    this.instructionBreakpoints.forEach((ibp) => {
      if (ibp.enabled !== enable) {
        changed.push(ibp);
      }
      ibp.enabled = enable;
    });
    if (enable) {
      this.breakpointsActivated = true;
    }
    this._onDidChangeBreakpoints.fire({ changed, sessionOnly: false });
  }
  addFunctionBreakpoint(opts, id) {
    const newFunctionBreakpoint = new FunctionBreakpoint(opts, id);
    this.functionBreakpoints.push(newFunctionBreakpoint);
    this._onDidChangeBreakpoints.fire({ added: [newFunctionBreakpoint], sessionOnly: false });
    return newFunctionBreakpoint;
  }
  updateFunctionBreakpoint(id, update) {
    const functionBreakpoint = this.functionBreakpoints.find((fbp) => fbp.getId() === id);
    if (functionBreakpoint) {
      if (typeof update.name === "string") {
        functionBreakpoint.name = update.name;
      }
      if (typeof update.condition === "string") {
        functionBreakpoint.condition = update.condition;
      }
      if (typeof update.hitCondition === "string") {
        functionBreakpoint.hitCondition = update.hitCondition;
      }
      this._onDidChangeBreakpoints.fire({ changed: [functionBreakpoint], sessionOnly: false });
    }
  }
  removeFunctionBreakpoints(id) {
    let removed;
    if (id) {
      removed = this.functionBreakpoints.filter((fbp) => fbp.getId() === id);
      this.functionBreakpoints = this.functionBreakpoints.filter((fbp) => fbp.getId() !== id);
    } else {
      removed = this.functionBreakpoints;
      this.functionBreakpoints = [];
    }
    this._onDidChangeBreakpoints.fire({ removed, sessionOnly: false });
  }
  addDataBreakpoint(opts, id) {
    const newDataBreakpoint = new DataBreakpoint(opts, id);
    this.dataBreakpoints.push(newDataBreakpoint);
    this._onDidChangeBreakpoints.fire({ added: [newDataBreakpoint], sessionOnly: false });
  }
  updateDataBreakpoint(id, update) {
    const dataBreakpoint = this.dataBreakpoints.find((fbp) => fbp.getId() === id);
    if (dataBreakpoint) {
      if (typeof update.condition === "string") {
        dataBreakpoint.condition = update.condition;
      }
      if (typeof update.hitCondition === "string") {
        dataBreakpoint.hitCondition = update.hitCondition;
      }
      this._onDidChangeBreakpoints.fire({ changed: [dataBreakpoint], sessionOnly: false });
    }
  }
  removeDataBreakpoints(id) {
    let removed;
    if (id) {
      removed = this.dataBreakpoints.filter((fbp) => fbp.getId() === id);
      this.dataBreakpoints = this.dataBreakpoints.filter((fbp) => fbp.getId() !== id);
    } else {
      removed = this.dataBreakpoints;
      this.dataBreakpoints = [];
    }
    this._onDidChangeBreakpoints.fire({ removed, sessionOnly: false });
  }
  addInstructionBreakpoint(opts) {
    const newInstructionBreakpoint = new InstructionBreakpoint(opts);
    this.instructionBreakpoints.push(newInstructionBreakpoint);
    this._onDidChangeBreakpoints.fire({ added: [newInstructionBreakpoint], sessionOnly: true });
  }
  removeInstructionBreakpoints(instructionReference, offset) {
    let removed = [];
    if (instructionReference) {
      for (let i = 0; i < this.instructionBreakpoints.length; i++) {
        const ibp = this.instructionBreakpoints[i];
        if (ibp.instructionReference === instructionReference && (offset === void 0 || ibp.offset === offset)) {
          removed.push(ibp);
          this.instructionBreakpoints.splice(i--, 1);
        }
      }
    } else {
      removed = this.instructionBreakpoints;
      this.instructionBreakpoints = [];
    }
    this._onDidChangeBreakpoints.fire({ removed, sessionOnly: false });
  }
  getWatchExpressions() {
    return this.watchExpressions;
  }
  addWatchExpression(name) {
    const we = new Expression(name || "");
    this.watchExpressions.push(we);
    this._onDidChangeWatchExpressions.fire(we);
    return we;
  }
  renameWatchExpression(id, newName) {
    const filtered = this.watchExpressions.filter((we) => we.getId() === id);
    if (filtered.length === 1) {
      filtered[0].name = newName;
      this._onDidChangeWatchExpressions.fire(filtered[0]);
    }
  }
  removeWatchExpressions(id = null) {
    this.watchExpressions = id ? this.watchExpressions.filter((we) => we.getId() !== id) : [];
    this._onDidChangeWatchExpressions.fire(void 0);
  }
  moveWatchExpression(id, position) {
    const we = this.watchExpressions.find((we2) => we2.getId() === id);
    if (we) {
      this.watchExpressions = this.watchExpressions.filter((we2) => we2.getId() !== id);
      this.watchExpressions = this.watchExpressions.slice(0, position).concat(we, this.watchExpressions.slice(position));
      this._onDidChangeWatchExpressions.fire(void 0);
    }
  }
  sourceIsNotAvailable(uri2) {
    this.sessions.forEach((s) => {
      const source = s.getSourceForUri(uri2);
      if (source) {
        source.available = false;
      }
    });
    this._onDidChangeCallStack.fire(void 0);
  }
};
DebugModel = __decorateClass([
  __decorateParam(1, ITextFileService),
  __decorateParam(2, IUriIdentityService),
  __decorateParam(3, ILogService)
], DebugModel);
export {
  BaseBreakpoint,
  Breakpoint,
  DataBreakpoint,
  DebugModel,
  Enablement,
  ErrorScope,
  ExceptionBreakpoint,
  Expression,
  ExpressionContainer,
  FunctionBreakpoint,
  InstructionBreakpoint,
  MemoryRegion,
  Scope,
  StackFrame,
  Thread,
  ThreadAndSessionIds,
  Variable,
  VisualizedExpression,
  getUriForDebugMemory
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9jb21tb24vZGVidWdNb2RlbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGRpc3RpbmN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IGZpbmRMYXN0SWR4IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzRmluZC5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UsIFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciwgZGVjb2RlQmFzZTY0LCBlbmNvZGVCYXNlNjQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQsIHRyYWNrU2V0Q2hhbmdlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IHN0cmluZ0hhc2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oYXNoLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgbWl4aW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IGF1dG9ydW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCAqIGFzIHJlc291cmNlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgaXNTdHJpbmcsIGlzVW5kZWZpbmVkT3JOdWxsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJLCBVUkkgYXMgdXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yUGFuZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgREVCVUdfTUVNT1JZX1NDSEVNRSwgRGF0YUJyZWFrcG9pbnRTZXRUeXBlLCBEYXRhQnJlYWtwb2ludFNvdXJjZSwgRGVidWdUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUsIElCYXNlQnJlYWtwb2ludCwgSUJyZWFrcG9pbnQsIElCcmVha3BvaW50RGF0YSwgSUJyZWFrcG9pbnRVcGRhdGVEYXRhLCBJQnJlYWtwb2ludHNDaGFuZ2VFdmVudCwgSURhdGFCcmVha3BvaW50LCBJRGVidWdFdmFsdWF0ZVBvc2l0aW9uLCBJRGVidWdNb2RlbCwgSURlYnVnU2Vzc2lvbiwgSURlYnVnVmlzdWFsaXphdGlvblRyZWVJdGVtLCBJRW5hYmxlbWVudCwgSUV4Y2VwdGlvbkJyZWFrcG9pbnQsIElFeGNlcHRpb25JbmZvLCBJRXhwcmVzc2lvbiwgSUV4cHJlc3Npb25Db250YWluZXIsIElGdW5jdGlvbkJyZWFrcG9pbnQsIElJbnN0cnVjdGlvbkJyZWFrcG9pbnQsIElNZW1vcnlJbnZhbGlkYXRpb25FdmVudCwgSU1lbW9yeVJlZ2lvbiwgSVJhd01vZGVsVXBkYXRlLCBJUmF3U3RvcHBlZERldGFpbHMsIElTY29wZSwgSVN0YWNrRnJhbWUsIElUaHJlYWQsIElUcmVlRWxlbWVudCwgTWVtb3J5UmFuZ2UsIE1lbW9yeVJhbmdlVHlwZSwgU3RhdGUsIGlzRnJhbWVEZWVtcGhhc2l6ZWQgfSBmcm9tICcuL2RlYnVnLmpzJztcbmltcG9ydCB7IFNvdXJjZSwgVU5LTk9XTl9TT1VSQ0VfTEFCRUwsIGdldFVyaUZyb21Tb3VyY2UgfSBmcm9tICcuL2RlYnVnU291cmNlLmpzJztcbmltcG9ydCB7IERlYnVnU3RvcmFnZSB9IGZyb20gJy4vZGVidWdTdG9yYWdlLmpzJztcbmltcG9ydCB7IElEZWJ1Z1Zpc3VhbGl6ZXJTZXJ2aWNlIH0gZnJvbSAnLi9kZWJ1Z1Zpc3VhbGl6ZXJzLmpzJztcbmltcG9ydCB7IERpc2Fzc2VtYmx5Vmlld0lucHV0IH0gZnJvbSAnLi9kaXNhc3NlbWJseVZpZXdJbnB1dC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGV4dEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRmaWxlcy5qcyc7XG5cbmludGVyZmFjZSBJRGVidWdQcm90b2NvbFZhcmlhYmxlV2l0aENvbnRleHQgZXh0ZW5kcyBEZWJ1Z1Byb3RvY29sLlZhcmlhYmxlIHtcblx0X192c2NvZGVWYXJpYWJsZU1lbnVDb250ZXh0Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRXhwcmVzc2lvbkNvbnRhaW5lciBpbXBsZW1lbnRzIElFeHByZXNzaW9uQ29udGFpbmVyIHtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGFsbFZhbHVlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cdC8vIFVzZSBjaHVua3MgdG8gc3VwcG9ydCB2YXJpYWJsZSBwYWdpbmcgIzk1Mzdcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQkFTRV9DSFVOS19TSVpFID0gMTAwO1xuXG5cdHB1YmxpYyB0eXBlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyB2YWx1ZUNoYW5nZWQgPSBmYWxzZTtcblx0cHJpdmF0ZSBfdmFsdWU6IHN0cmluZyA9ICcnO1xuXHRwcm90ZWN0ZWQgY2hpbGRyZW4/OiBQcm9taXNlPElFeHByZXNzaW9uW10+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByb3RlY3RlZCBzZXNzaW9uOiBJRGVidWdTZXNzaW9uIHwgdW5kZWZpbmVkLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSB0aHJlYWRJZDogbnVtYmVyIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgX3JlZmVyZW5jZTogbnVtYmVyIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgaWQ6IHN0cmluZyxcblx0XHRwdWJsaWMgbmFtZWRWYXJpYWJsZXM6IG51bWJlciB8IHVuZGVmaW5lZCA9IDAsXG5cdFx0cHVibGljIGluZGV4ZWRWYXJpYWJsZXM6IG51bWJlciB8IHVuZGVmaW5lZCA9IDAsXG5cdFx0cHVibGljIG1lbW9yeVJlZmVyZW5jZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgc3RhcnRPZlZhcmlhYmxlczogbnVtYmVyIHwgdW5kZWZpbmVkID0gMCxcblx0XHRwdWJsaWMgcHJlc2VudGF0aW9uSGludDogRGVidWdQcm90b2NvbC5WYXJpYWJsZVByZXNlbnRhdGlvbkhpbnQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsXG5cdFx0cHVibGljIHZhbHVlTG9jYXRpb25SZWZlcmVuY2U6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCxcblx0KSB7IH1cblxuXHRnZXQgcmVmZXJlbmNlKCk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlZmVyZW5jZTtcblx0fVxuXG5cdHNldCByZWZlcmVuY2UodmFsdWU6IG51bWJlciB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX3JlZmVyZW5jZSA9IHZhbHVlO1xuXHRcdHRoaXMuY2hpbGRyZW4gPSB1bmRlZmluZWQ7IC8vIGludmFsaWRhdGUgY2hpbGRyZW4gY2FjaGVcblx0fVxuXG5cdGFzeW5jIGV2YWx1YXRlTGF6eSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodHlwZW9mIHRoaXMucmVmZXJlbmNlID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5zZXNzaW9uIS52YXJpYWJsZXModGhpcy5yZWZlcmVuY2UsIHRoaXMudGhyZWFkSWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdGlmICghcmVzcG9uc2UgfHwgIXJlc3BvbnNlLmJvZHkgfHwgIXJlc3BvbnNlLmJvZHkudmFyaWFibGVzIHx8IHJlc3BvbnNlLmJvZHkudmFyaWFibGVzLmxlbmd0aCAhPT0gMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGR1bW15VmFyID0gcmVzcG9uc2UuYm9keS52YXJpYWJsZXNbMF07XG5cdFx0dGhpcy5yZWZlcmVuY2UgPSBkdW1teVZhci52YXJpYWJsZXNSZWZlcmVuY2U7XG5cdFx0dGhpcy5fdmFsdWUgPSBkdW1teVZhci52YWx1ZTtcblx0XHR0aGlzLm5hbWVkVmFyaWFibGVzID0gZHVtbXlWYXIubmFtZWRWYXJpYWJsZXM7XG5cdFx0dGhpcy5pbmRleGVkVmFyaWFibGVzID0gZHVtbXlWYXIuaW5kZXhlZFZhcmlhYmxlcztcblx0XHR0aGlzLm1lbW9yeVJlZmVyZW5jZSA9IGR1bW15VmFyLm1lbW9yeVJlZmVyZW5jZTtcblx0XHR0aGlzLnByZXNlbnRhdGlvbkhpbnQgPSBkdW1teVZhci5wcmVzZW50YXRpb25IaW50O1xuXHRcdHRoaXMudmFsdWVMb2NhdGlvblJlZmVyZW5jZSA9IGR1bW15VmFyLnZhbHVlTG9jYXRpb25SZWZlcmVuY2U7XG5cdFx0Ly8gQWxzbyBjYWxsIG92ZXJyaWRkZW4gbWV0aG9kIHRvIGFkb3B0IHN1YmNsYXNzIHByb3BzXG5cdFx0dGhpcy5hZG9wdExhenlSZXNwb25zZShkdW1teVZhcik7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWRvcHRMYXp5UmVzcG9uc2UocmVzcG9uc2U6IERlYnVnUHJvdG9jb2wuVmFyaWFibGUpOiB2b2lkIHtcblx0fVxuXG5cdGdldENoaWxkcmVuKCk6IFByb21pc2U8SUV4cHJlc3Npb25bXT4ge1xuXHRcdGlmICghdGhpcy5jaGlsZHJlbikge1xuXHRcdFx0dGhpcy5jaGlsZHJlbiA9IHRoaXMuZG9HZXRDaGlsZHJlbigpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmNoaWxkcmVuO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0dldENoaWxkcmVuKCk6IFByb21pc2U8SUV4cHJlc3Npb25bXT4ge1xuXHRcdGlmICghdGhpcy5oYXNDaGlsZHJlbikge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5nZXRDaGlsZHJlbkluQ2h1bmtzKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5mZXRjaFZhcmlhYmxlcyh1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHQvLyBDaGVjayBpZiBvYmplY3QgaGFzIG5hbWVkIHZhcmlhYmxlcywgZmV0Y2ggdGhlbSBpbmRlcGVuZGVudCBmcm9tIGluZGV4ZWQgdmFyaWFibGVzICM5NjcwXG5cdFx0Y29uc3QgY2hpbGRyZW4gPSB0aGlzLm5hbWVkVmFyaWFibGVzID8gYXdhaXQgdGhpcy5mZXRjaFZhcmlhYmxlcyh1bmRlZmluZWQsIHVuZGVmaW5lZCwgJ25hbWVkJykgOiBbXTtcblxuXHRcdC8vIFVzZSBhIGR5bmFtaWMgY2h1bmsgc2l6ZSBiYXNlZCBvbiB0aGUgbnVtYmVyIG9mIGVsZW1lbnRzICM5Nzc0XG5cdFx0bGV0IGNodW5rU2l6ZSA9IEV4cHJlc3Npb25Db250YWluZXIuQkFTRV9DSFVOS19TSVpFO1xuXHRcdHdoaWxlICghIXRoaXMuaW5kZXhlZFZhcmlhYmxlcyAmJiB0aGlzLmluZGV4ZWRWYXJpYWJsZXMgPiBjaHVua1NpemUgKiBFeHByZXNzaW9uQ29udGFpbmVyLkJBU0VfQ0hVTktfU0laRSkge1xuXHRcdFx0Y2h1bmtTaXplICo9IEV4cHJlc3Npb25Db250YWluZXIuQkFTRV9DSFVOS19TSVpFO1xuXHRcdH1cblxuXHRcdGlmICghIXRoaXMuaW5kZXhlZFZhcmlhYmxlcyAmJiB0aGlzLmluZGV4ZWRWYXJpYWJsZXMgPiBjaHVua1NpemUpIHtcblx0XHRcdC8vIFRoZXJlIGFyZSBhIGxvdCBvZiBjaGlsZHJlbiwgY3JlYXRlIGZha2UgaW50ZXJtZWRpYXRlIHZhbHVlcyB0aGF0IHJlcHJlc2VudCBjaHVua3MgIzk1Mzdcblx0XHRcdGNvbnN0IG51bWJlck9mQ2h1bmtzID0gTWF0aC5jZWlsKHRoaXMuaW5kZXhlZFZhcmlhYmxlcyAvIGNodW5rU2l6ZSk7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG51bWJlck9mQ2h1bmtzOyBpKyspIHtcblx0XHRcdFx0Y29uc3Qgc3RhcnQgPSAodGhpcy5zdGFydE9mVmFyaWFibGVzIHx8IDApICsgaSAqIGNodW5rU2l6ZTtcblx0XHRcdFx0Y29uc3QgY291bnQgPSBNYXRoLm1pbihjaHVua1NpemUsIHRoaXMuaW5kZXhlZFZhcmlhYmxlcyAtIGkgKiBjaHVua1NpemUpO1xuXHRcdFx0XHRjaGlsZHJlbi5wdXNoKG5ldyBWYXJpYWJsZSh0aGlzLnNlc3Npb24sIHRoaXMudGhyZWFkSWQsIHRoaXMsIHRoaXMucmVmZXJlbmNlLCBgWyR7c3RhcnR9Li4ke3N0YXJ0ICsgY291bnQgLSAxfV1gLCAnJywgJycsIHVuZGVmaW5lZCwgY291bnQsIHVuZGVmaW5lZCwgeyBraW5kOiAndmlydHVhbCcgfSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUsIHN0YXJ0KSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBjaGlsZHJlbjtcblx0XHR9XG5cblx0XHRjb25zdCB2YXJpYWJsZXMgPSBhd2FpdCB0aGlzLmZldGNoVmFyaWFibGVzKHRoaXMuc3RhcnRPZlZhcmlhYmxlcywgdGhpcy5pbmRleGVkVmFyaWFibGVzLCAnaW5kZXhlZCcpO1xuXHRcdHJldHVybiBjaGlsZHJlbi5jb25jYXQodmFyaWFibGVzKTtcblx0fVxuXG5cdGdldElkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuaWQ7XG5cdH1cblxuXHRnZXRTZXNzaW9uKCk6IElEZWJ1Z1Nlc3Npb24gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnNlc3Npb247XG5cdH1cblxuXHRnZXQgdmFsdWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5fdmFsdWU7XG5cdH1cblxuXHRnZXQgaGFzQ2hpbGRyZW4oKTogYm9vbGVhbiB7XG5cdFx0Ly8gb25seSB2YXJpYWJsZXMgd2l0aCByZWZlcmVuY2UgPiAwIGhhdmUgY2hpbGRyZW4uXG5cdFx0cmV0dXJuICEhdGhpcy5yZWZlcmVuY2UgJiYgdGhpcy5yZWZlcmVuY2UgPiAwICYmICF0aGlzLnByZXNlbnRhdGlvbkhpbnQ/Lmxhenk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGZldGNoVmFyaWFibGVzKHN0YXJ0OiBudW1iZXIgfCB1bmRlZmluZWQsIGNvdW50OiBudW1iZXIgfCB1bmRlZmluZWQsIGZpbHRlcjogJ2luZGV4ZWQnIHwgJ25hbWVkJyB8IHVuZGVmaW5lZCk6IFByb21pc2U8VmFyaWFibGVbXT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuc2Vzc2lvbiEudmFyaWFibGVzKHRoaXMucmVmZXJlbmNlIHx8IDAsIHRoaXMudGhyZWFkSWQsIGZpbHRlciwgc3RhcnQsIGNvdW50KTtcblx0XHRcdGlmICghcmVzcG9uc2UgfHwgIXJlc3BvbnNlLmJvZHkgfHwgIXJlc3BvbnNlLmJvZHkudmFyaWFibGVzKSB7XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbmFtZUNvdW50ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblx0XHRcdGNvbnN0IHZhcnMgPSByZXNwb25zZS5ib2R5LnZhcmlhYmxlcy5maWx0ZXIodiA9PiAhIXYpLm1hcCgodjogSURlYnVnUHJvdG9jb2xWYXJpYWJsZVdpdGhDb250ZXh0KSA9PiB7XG5cdFx0XHRcdGlmIChpc1N0cmluZyh2LnZhbHVlKSAmJiBpc1N0cmluZyh2Lm5hbWUpICYmIHR5cGVvZiB2LnZhcmlhYmxlc1JlZmVyZW5jZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRjb25zdCBjb3VudCA9IG5hbWVDb3VudC5nZXQodi5uYW1lKSB8fCAwO1xuXHRcdFx0XHRcdGNvbnN0IGlkRHVwbGljYXRpb25JbmRleCA9IGNvdW50ID4gMCA/IGNvdW50LnRvU3RyaW5nKCkgOiAnJztcblx0XHRcdFx0XHRuYW1lQ291bnQuc2V0KHYubmFtZSwgY291bnQgKyAxKTtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFZhcmlhYmxlKHRoaXMuc2Vzc2lvbiwgdGhpcy50aHJlYWRJZCwgdGhpcywgdi52YXJpYWJsZXNSZWZlcmVuY2UsIHYubmFtZSwgdi5ldmFsdWF0ZU5hbWUsIHYudmFsdWUsIHYubmFtZWRWYXJpYWJsZXMsIHYuaW5kZXhlZFZhcmlhYmxlcywgdi5tZW1vcnlSZWZlcmVuY2UsIHYucHJlc2VudGF0aW9uSGludCwgdi50eXBlLCB2Ll9fdnNjb2RlVmFyaWFibGVNZW51Q29udGV4dCwgdHJ1ZSwgMCwgaWREdXBsaWNhdGlvbkluZGV4LCB2LmRlY2xhcmF0aW9uTG9jYXRpb25SZWZlcmVuY2UsIHYudmFsdWVMb2NhdGlvblJlZmVyZW5jZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG5ldyBWYXJpYWJsZSh0aGlzLnNlc3Npb24sIHRoaXMudGhyZWFkSWQsIHRoaXMsIDAsICcnLCB1bmRlZmluZWQsIG5scy5sb2NhbGl6ZSgnaW52YWxpZFZhcmlhYmxlQXR0cmlidXRlcycsIFwiSW52YWxpZCB2YXJpYWJsZSBhdHRyaWJ1dGVzXCIpLCAwLCAwLCB1bmRlZmluZWQsIHsga2luZDogJ3ZpcnR1YWwnIH0sIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKHRoaXMuc2Vzc2lvbiEuYXV0b0V4cGFuZExhenlWYXJpYWJsZXMpIHtcblx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwodmFycy5tYXAodiA9PiB2LnByZXNlbnRhdGlvbkhpbnQ/LmxhenkgJiYgdi5ldmFsdWF0ZUxhenkoKSkpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdmFycztcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gW25ldyBWYXJpYWJsZSh0aGlzLnNlc3Npb24sIHRoaXMudGhyZWFkSWQsIHRoaXMsIDAsICcnLCB1bmRlZmluZWQsIGUubWVzc2FnZSwgMCwgMCwgdW5kZWZpbmVkLCB7IGtpbmQ6ICd2aXJ0dWFsJyB9LCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UpXTtcblx0XHR9XG5cdH1cblxuXHQvLyBUaGUgYWRhcHRlciBleHBsaWNpdGx5IHNlbnRzIHRoZSBjaGlsZHJlbiBjb3VudCBvZiBhbiBleHByZXNzaW9uIG9ubHkgaWYgdGhlcmUgYXJlIGxvdHMgb2YgY2hpbGRyZW4gd2hpY2ggc2hvdWxkIGJlIGNodW5rZWQuXG5cdHByaXZhdGUgZ2V0IGdldENoaWxkcmVuSW5DaHVua3MoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5pbmRleGVkVmFyaWFibGVzO1xuXHR9XG5cblx0c2V0IHZhbHVlKHZhbHVlOiBzdHJpbmcpIHtcblx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdHRoaXMudmFsdWVDaGFuZ2VkID0gISFFeHByZXNzaW9uQ29udGFpbmVyLmFsbFZhbHVlcy5nZXQodGhpcy5nZXRJZCgpKSAmJlxuXHRcdFx0RXhwcmVzc2lvbkNvbnRhaW5lci5hbGxWYWx1ZXMuZ2V0KHRoaXMuZ2V0SWQoKSkgIT09IEV4cHJlc3Npb24uREVGQVVMVF9WQUxVRSAmJiBFeHByZXNzaW9uQ29udGFpbmVyLmFsbFZhbHVlcy5nZXQodGhpcy5nZXRJZCgpKSAhPT0gdmFsdWU7XG5cdFx0RXhwcmVzc2lvbkNvbnRhaW5lci5hbGxWYWx1ZXMuc2V0KHRoaXMuZ2V0SWQoKSwgdmFsdWUpO1xuXHR9XG5cblx0dG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy52YWx1ZTtcblx0fVxuXG5cdGFzeW5jIGV2YWx1YXRlRXhwcmVzc2lvbihcblx0XHRleHByZXNzaW9uOiBzdHJpbmcsXG5cdFx0c2Vzc2lvbjogSURlYnVnU2Vzc2lvbiB8IHVuZGVmaW5lZCxcblx0XHRzdGFja0ZyYW1lOiBJU3RhY2tGcmFtZSB8IHVuZGVmaW5lZCxcblx0XHRjb250ZXh0OiBzdHJpbmcsXG5cdFx0a2VlcExhenlWYXJzID0gZmFsc2UsXG5cdFx0bG9jYXRpb24/OiBJRGVidWdFdmFsdWF0ZVBvc2l0aW9uLFxuXHQpOiBQcm9taXNlPGJvb2xlYW4+IHtcblxuXHRcdGlmICghc2Vzc2lvbiB8fCAoIXN0YWNrRnJhbWUgJiYgY29udGV4dCAhPT0gJ3JlcGwnKSkge1xuXHRcdFx0dGhpcy52YWx1ZSA9IGNvbnRleHQgPT09ICdyZXBsJyA/IG5scy5sb2NhbGl6ZSgnc3RhcnREZWJ1Z0ZpcnN0JywgXCJQbGVhc2Ugc3RhcnQgYSBkZWJ1ZyBzZXNzaW9uIHRvIGV2YWx1YXRlIGV4cHJlc3Npb25zXCIpIDogRXhwcmVzc2lvbi5ERUZBVUxUX1ZBTFVFO1xuXHRcdFx0dGhpcy5yZWZlcmVuY2UgPSAwO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRoaXMuc2Vzc2lvbiA9IHNlc3Npb247XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgc2Vzc2lvbi5ldmFsdWF0ZShleHByZXNzaW9uLCBzdGFja0ZyYW1lID8gc3RhY2tGcmFtZS5mcmFtZUlkIDogdW5kZWZpbmVkLCBjb250ZXh0LCBsb2NhdGlvbik7XG5cblx0XHRcdGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5ib2R5KSB7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSByZXNwb25zZS5ib2R5LnJlc3VsdCB8fCAnJztcblx0XHRcdFx0dGhpcy5yZWZlcmVuY2UgPSByZXNwb25zZS5ib2R5LnZhcmlhYmxlc1JlZmVyZW5jZTtcblx0XHRcdFx0dGhpcy5uYW1lZFZhcmlhYmxlcyA9IHJlc3BvbnNlLmJvZHkubmFtZWRWYXJpYWJsZXM7XG5cdFx0XHRcdHRoaXMuaW5kZXhlZFZhcmlhYmxlcyA9IHJlc3BvbnNlLmJvZHkuaW5kZXhlZFZhcmlhYmxlcztcblx0XHRcdFx0dGhpcy5tZW1vcnlSZWZlcmVuY2UgPSByZXNwb25zZS5ib2R5Lm1lbW9yeVJlZmVyZW5jZTtcblx0XHRcdFx0dGhpcy50eXBlID0gcmVzcG9uc2UuYm9keS50eXBlIHx8IHRoaXMudHlwZTtcblx0XHRcdFx0dGhpcy5wcmVzZW50YXRpb25IaW50ID0gcmVzcG9uc2UuYm9keS5wcmVzZW50YXRpb25IaW50O1xuXHRcdFx0XHR0aGlzLnZhbHVlTG9jYXRpb25SZWZlcmVuY2UgPSByZXNwb25zZS5ib2R5LnZhbHVlTG9jYXRpb25SZWZlcmVuY2U7XG5cblx0XHRcdFx0aWYgKCFrZWVwTGF6eVZhcnMgJiYgcmVzcG9uc2UuYm9keS5wcmVzZW50YXRpb25IaW50Py5sYXp5KSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5ldmFsdWF0ZUxhenkoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMudmFsdWUgPSBlLm1lc3NhZ2UgfHwgJyc7XG5cdFx0XHR0aGlzLnJlZmVyZW5jZSA9IDA7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZVNldFJlc3BvbnNlKGV4cHJlc3Npb246IEV4cHJlc3Npb25Db250YWluZXIsIHJlc3BvbnNlOiBEZWJ1Z1Byb3RvY29sLlNldFZhcmlhYmxlUmVzcG9uc2UgfCBEZWJ1Z1Byb3RvY29sLlNldEV4cHJlc3Npb25SZXNwb25zZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2UuYm9keSkge1xuXHRcdGV4cHJlc3Npb24udmFsdWUgPSByZXNwb25zZS5ib2R5LnZhbHVlIHx8ICcnO1xuXHRcdGV4cHJlc3Npb24udHlwZSA9IHJlc3BvbnNlLmJvZHkudHlwZSB8fCBleHByZXNzaW9uLnR5cGU7XG5cdFx0ZXhwcmVzc2lvbi5yZWZlcmVuY2UgPSByZXNwb25zZS5ib2R5LnZhcmlhYmxlc1JlZmVyZW5jZTtcblx0XHRleHByZXNzaW9uLm5hbWVkVmFyaWFibGVzID0gcmVzcG9uc2UuYm9keS5uYW1lZFZhcmlhYmxlcztcblx0XHRleHByZXNzaW9uLmluZGV4ZWRWYXJpYWJsZXMgPSByZXNwb25zZS5ib2R5LmluZGV4ZWRWYXJpYWJsZXM7XG5cdFx0Ly8gdG9kbyBAd2VpbmFuZDogdGhlIHNldCByZXNwb25zZXMgY29udGFpbiBtb3N0IHByb3BlcnRpZXMsIGJ1dCBub3QgbWVtb3J5IHJlZmVyZW5jZXMuIFNob3VsZCB0aGV5P1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBWaXN1YWxpemVkRXhwcmVzc2lvbiBpbXBsZW1lbnRzIElFeHByZXNzaW9uIHtcblx0cHVibGljIGVycm9yTWVzc2FnZT86IHN0cmluZztcblx0cHJpdmF0ZSByZWFkb25seSBpZCA9IGdlbmVyYXRlVXVpZCgpO1xuXG5cdGV2YWx1YXRlTGF6eSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblx0Z2V0Q2hpbGRyZW4oKTogUHJvbWlzZTxJRXhwcmVzc2lvbltdPiB7XG5cdFx0cmV0dXJuIHRoaXMudmlzdWFsaXplci5nZXRWaXN1YWxpemVkQ2hpbGRyZW4odGhpcy5zZXNzaW9uLCB0aGlzLnRyZWVJZCwgdGhpcy50cmVlSXRlbS5pZCk7XG5cdH1cblxuXHRnZXRJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmlkO1xuXHR9XG5cblx0Z2V0IG5hbWUoKSB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZUl0ZW0ubGFiZWw7XG5cdH1cblxuXHRnZXQgdmFsdWUoKSB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZUl0ZW0uZGVzY3JpcHRpb24gfHwgJyc7XG5cdH1cblxuXHRnZXQgaGFzQ2hpbGRyZW4oKSB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZUl0ZW0uY29sbGFwc2libGVTdGF0ZSAhPT0gRGVidWdUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuTm9uZTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgc2Vzc2lvbjogSURlYnVnU2Vzc2lvbiB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHZpc3VhbGl6ZXI6IElEZWJ1Z1Zpc3VhbGl6ZXJTZXJ2aWNlLFxuXHRcdHB1YmxpYyByZWFkb25seSB0cmVlSWQ6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgdHJlZUl0ZW06IElEZWJ1Z1Zpc3VhbGl6YXRpb25UcmVlSXRlbSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgb3JpZ2luYWw/OiBWYXJpYWJsZSxcblx0KSB7IH1cblxuXHRwdWJsaWMgZ2V0U2Vzc2lvbigpOiBJRGVidWdTZXNzaW9uIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5zZXNzaW9uO1xuXHR9XG5cblx0LyoqIEVkaXRzIHRoZSB2YWx1ZSwgc2V0cyB0aGUge0BsaW5rIGVycm9yTWVzc2FnZX0gYW5kIHJldHVybnMgZmFsc2UgaWYgdW5zdWNjZXNzZnVsICovXG5cdHB1YmxpYyBhc3luYyBlZGl0KG5ld1ZhbHVlOiBzdHJpbmcpIHtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy52aXN1YWxpemVyLmVkaXRUcmVlSXRlbSh0aGlzLnRyZWVJZCwgdGhpcy50cmVlSXRlbSwgbmV3VmFsdWUpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5lcnJvck1lc3NhZ2UgPSBlLm1lc3NhZ2U7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHByZXNzaW9uIGV4dGVuZHMgRXhwcmVzc2lvbkNvbnRhaW5lciBpbXBsZW1lbnRzIElFeHByZXNzaW9uIHtcblx0c3RhdGljIHJlYWRvbmx5IERFRkFVTFRfVkFMVUUgPSBubHMubG9jYWxpemUoJ25vdEF2YWlsYWJsZScsIFwibm90IGF2YWlsYWJsZVwiKTtcblxuXHRwdWJsaWMgYXZhaWxhYmxlOiBib29sZWFuO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlVmFsdWUgPSBuZXcgRW1pdHRlcjxJRXhwcmVzc2lvbj4oKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmFsdWU6IEV2ZW50PElFeHByZXNzaW9uPiA9IHRoaXMuX29uRGlkQ2hhbmdlVmFsdWUuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IocHVibGljIG5hbWU6IHN0cmluZywgaWQgPSBnZW5lcmF0ZVV1aWQoKSkge1xuXHRcdHN1cGVyKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCAwLCBpZCk7XG5cdFx0dGhpcy5hdmFpbGFibGUgPSBmYWxzZTtcblx0XHQvLyBuYW1lIGlzIG5vdCBzZXQgaWYgdGhlIGV4cHJlc3Npb24gaXMganVzdCBiZWluZyBhZGRlZFxuXHRcdC8vIGluIHRoYXQgY2FzZSBkbyBub3Qgc2V0IGRlZmF1bHQgdmFsdWUgdG8gcHJldmVudCBmbGFzaGluZyAjMTQ0OTlcblx0XHRpZiAobmFtZSkge1xuXHRcdFx0dGhpcy52YWx1ZSA9IEV4cHJlc3Npb24uREVGQVVMVF9WQUxVRTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBldmFsdWF0ZShzZXNzaW9uOiBJRGVidWdTZXNzaW9uIHwgdW5kZWZpbmVkLCBzdGFja0ZyYW1lOiBJU3RhY2tGcmFtZSB8IHVuZGVmaW5lZCwgY29udGV4dDogc3RyaW5nLCBrZWVwTGF6eVZhcnM/OiBib29sZWFuLCBsb2NhdGlvbj86IElEZWJ1Z0V2YWx1YXRlUG9zaXRpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBoYWREZWZhdWx0VmFsdWUgPSB0aGlzLnZhbHVlID09PSBFeHByZXNzaW9uLkRFRkFVTFRfVkFMVUU7XG5cdFx0dGhpcy5hdmFpbGFibGUgPSBhd2FpdCB0aGlzLmV2YWx1YXRlRXhwcmVzc2lvbih0aGlzLm5hbWUsIHNlc3Npb24sIHN0YWNrRnJhbWUsIGNvbnRleHQsIGtlZXBMYXp5VmFycywgbG9jYXRpb24pO1xuXHRcdGlmIChoYWREZWZhdWx0VmFsdWUgfHwgdGhpcy52YWx1ZUNoYW5nZWQpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVmFsdWUuZmlyZSh0aGlzKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSB0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiBgJHt0aGlzLm5hbWV9XFxuJHt0aGlzLnZhbHVlfWA7XG5cdH1cblxuXHRhc3luYyBzZXRFeHByZXNzaW9uKHZhbHVlOiBzdHJpbmcsIHN0YWNrRnJhbWU6IElTdGFja0ZyYW1lKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLnNlc3Npb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuc2Vzc2lvbi5zZXRFeHByZXNzaW9uKHN0YWNrRnJhbWUuZnJhbWVJZCwgdGhpcy5uYW1lLCB2YWx1ZSk7XG5cdFx0aGFuZGxlU2V0UmVzcG9uc2UodGhpcywgcmVzcG9uc2UpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBWYXJpYWJsZSBleHRlbmRzIEV4cHJlc3Npb25Db250YWluZXIgaW1wbGVtZW50cyBJRXhwcmVzc2lvbiB7XG5cblx0Ly8gVXNlZCB0byBzaG93IHRoZSBlcnJvciBtZXNzYWdlIGNvbWluZyBmcm9tIHRoZSBhZGFwdGVyIHdoZW4gc2V0dGluZyB0aGUgdmFsdWUgIzc4MDdcblx0cHVibGljIGVycm9yTWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHNlc3Npb246IElEZWJ1Z1Nlc3Npb24gfCB1bmRlZmluZWQsXG5cdFx0dGhyZWFkSWQ6IG51bWJlciB8IHVuZGVmaW5lZCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcGFyZW50OiBJRXhwcmVzc2lvbkNvbnRhaW5lcixcblx0XHRyZWZlcmVuY2U6IG51bWJlciB8IHVuZGVmaW5lZCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbmFtZTogc3RyaW5nLFxuXHRcdHB1YmxpYyBldmFsdWF0ZU5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHR2YWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdG5hbWVkVmFyaWFibGVzOiBudW1iZXIgfCB1bmRlZmluZWQsXG5cdFx0aW5kZXhlZFZhcmlhYmxlczogbnVtYmVyIHwgdW5kZWZpbmVkLFxuXHRcdG1lbW9yeVJlZmVyZW5jZTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdHByZXNlbnRhdGlvbkhpbnQ6IERlYnVnUHJvdG9jb2wuVmFyaWFibGVQcmVzZW50YXRpb25IaW50IHwgdW5kZWZpbmVkLFxuXHRcdHR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgdmFyaWFibGVNZW51Q29udGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkLFxuXHRcdHB1YmxpYyByZWFkb25seSBhdmFpbGFibGUgPSB0cnVlLFxuXHRcdHN0YXJ0T2ZWYXJpYWJsZXMgPSAwLFxuXHRcdGlkRHVwbGljYXRpb25JbmRleCA9ICcnLFxuXHRcdHB1YmxpYyByZWFkb25seSBkZWNsYXJhdGlvbkxvY2F0aW9uUmVmZXJlbmNlOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsXG5cdFx0dmFsdWVMb2NhdGlvblJlZmVyZW5jZTogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkLFxuXHQpIHtcblx0XHRzdXBlcihzZXNzaW9uLCB0aHJlYWRJZCwgcmVmZXJlbmNlLCBgdmFyaWFibGU6JHtwYXJlbnQuZ2V0SWQoKX06JHtuYW1lfToke2lkRHVwbGljYXRpb25JbmRleH1gLCBuYW1lZFZhcmlhYmxlcywgaW5kZXhlZFZhcmlhYmxlcywgbWVtb3J5UmVmZXJlbmNlLCBzdGFydE9mVmFyaWFibGVzLCBwcmVzZW50YXRpb25IaW50LCB2YWx1ZUxvY2F0aW9uUmVmZXJlbmNlKTtcblx0XHR0aGlzLnZhbHVlID0gdmFsdWUgfHwgJyc7XG5cdFx0dGhpcy50eXBlID0gdHlwZTtcblx0fVxuXG5cdGdldFRocmVhZElkKCkge1xuXHRcdHJldHVybiB0aGlzLnRocmVhZElkO1xuXHR9XG5cblx0YXN5bmMgc2V0VmFyaWFibGUodmFsdWU6IHN0cmluZywgc3RhY2tGcmFtZTogSVN0YWNrRnJhbWUpOiBQcm9taXNlPGFueT4ge1xuXHRcdGlmICghdGhpcy5zZXNzaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdC8vIFNlbmQgb3V0IGEgc2V0RXhwcmVzc2lvbiBmb3IgZGVidWcgZXh0ZW5zaW9ucyB0aGF0IGRvIG5vdCBzdXBwb3J0IHNldCB2YXJpYWJsZXMgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEyNDY3OSNpc3N1ZWNvbW1lbnQtODY5ODQ0NDM3XG5cdFx0XHRpZiAodGhpcy5zZXNzaW9uLmNhcGFiaWxpdGllcy5zdXBwb3J0c1NldEV4cHJlc3Npb24gJiYgIXRoaXMuc2Vzc2lvbi5jYXBhYmlsaXRpZXMuc3VwcG9ydHNTZXRWYXJpYWJsZSAmJiB0aGlzLmV2YWx1YXRlTmFtZSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRFeHByZXNzaW9uKHZhbHVlLCBzdGFja0ZyYW1lKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnNlc3Npb24uc2V0VmFyaWFibGUoKDxFeHByZXNzaW9uQ29udGFpbmVyPnRoaXMucGFyZW50KS5yZWZlcmVuY2UsIHRoaXMubmFtZSwgdmFsdWUpO1xuXHRcdFx0aGFuZGxlU2V0UmVzcG9uc2UodGhpcywgcmVzcG9uc2UpO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0dGhpcy5lcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBzZXRFeHByZXNzaW9uKHZhbHVlOiBzdHJpbmcsIHN0YWNrRnJhbWU6IElTdGFja0ZyYW1lKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLnNlc3Npb24gfHwgIXRoaXMuZXZhbHVhdGVOYW1lKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnNlc3Npb24uc2V0RXhwcmVzc2lvbihzdGFja0ZyYW1lLmZyYW1lSWQsIHRoaXMuZXZhbHVhdGVOYW1lLCB2YWx1ZSk7XG5cdFx0aGFuZGxlU2V0UmVzcG9uc2UodGhpcywgcmVzcG9uc2UpO1xuXHR9XG5cblx0b3ZlcnJpZGUgdG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5uYW1lID8gYCR7dGhpcy5uYW1lfTogJHt0aGlzLnZhbHVlfWAgOiB0aGlzLnZhbHVlO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFkb3B0TGF6eVJlc3BvbnNlKHJlc3BvbnNlOiBEZWJ1Z1Byb3RvY29sLlZhcmlhYmxlKTogdm9pZCB7XG5cdFx0dGhpcy5ldmFsdWF0ZU5hbWUgPSByZXNwb25zZS5ldmFsdWF0ZU5hbWU7XG5cdH1cblxuXHR0b0RlYnVnUHJvdG9jb2xPYmplY3QoKTogRGVidWdQcm90b2NvbC5WYXJpYWJsZSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdHZhcmlhYmxlc1JlZmVyZW5jZTogdGhpcy5yZWZlcmVuY2UgfHwgMCxcblx0XHRcdG1lbW9yeVJlZmVyZW5jZTogdGhpcy5tZW1vcnlSZWZlcmVuY2UsXG5cdFx0XHR2YWx1ZTogdGhpcy52YWx1ZSxcblx0XHRcdGV2YWx1YXRlTmFtZTogdGhpcy5ldmFsdWF0ZU5hbWVcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTY29wZSBleHRlbmRzIEV4cHJlc3Npb25Db250YWluZXIgaW1wbGVtZW50cyBJU2NvcGUge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBzdGFja0ZyYW1lOiBJU3RhY2tGcmFtZSxcblx0XHRpZDogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBuYW1lOiBzdHJpbmcsXG5cdFx0cmVmZXJlbmNlOiBudW1iZXIsXG5cdFx0cHVibGljIGV4cGVuc2l2ZTogYm9vbGVhbixcblx0XHRuYW1lZFZhcmlhYmxlcz86IG51bWJlcixcblx0XHRpbmRleGVkVmFyaWFibGVzPzogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSByYW5nZT86IElSYW5nZVxuXHQpIHtcblx0XHRzdXBlcihzdGFja0ZyYW1lLnRocmVhZC5zZXNzaW9uLCBzdGFja0ZyYW1lLnRocmVhZC50aHJlYWRJZCwgcmVmZXJlbmNlLCBgc2NvcGU6JHtuYW1lfToke2lkfWAsIG5hbWVkVmFyaWFibGVzLCBpbmRleGVkVmFyaWFibGVzKTtcblx0fVxuXG5cdG92ZXJyaWRlIHRvU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMubmFtZTtcblx0fVxuXG5cdHRvRGVidWdQcm90b2NvbE9iamVjdCgpOiBEZWJ1Z1Byb3RvY29sLlNjb3BlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0dmFyaWFibGVzUmVmZXJlbmNlOiB0aGlzLnJlZmVyZW5jZSB8fCAwLFxuXHRcdFx0ZXhwZW5zaXZlOiB0aGlzLmV4cGVuc2l2ZVxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEVycm9yU2NvcGUgZXh0ZW5kcyBTY29wZSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0c3RhY2tGcmFtZTogSVN0YWNrRnJhbWUsXG5cdFx0aW5kZXg6IG51bWJlcixcblx0XHRtZXNzYWdlOiBzdHJpbmcsXG5cdCkge1xuXHRcdHN1cGVyKHN0YWNrRnJhbWUsIGluZGV4LCBtZXNzYWdlLCAwLCBmYWxzZSk7XG5cdH1cblxuXHRvdmVycmlkZSB0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLm5hbWU7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0YWNrRnJhbWUgaW1wbGVtZW50cyBJU3RhY2tGcmFtZSB7XG5cblx0cHJpdmF0ZSBzY29wZXM6IFByb21pc2U8U2NvcGVbXT4gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHRocmVhZDogVGhyZWFkLFxuXHRcdHB1YmxpYyByZWFkb25seSBmcmFtZUlkOiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IHNvdXJjZTogU291cmNlLFxuXHRcdHB1YmxpYyByZWFkb25seSBuYW1lOiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IHByZXNlbnRhdGlvbkhpbnQ6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmFuZ2U6IElSYW5nZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGluZGV4OiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IGNhblJlc3RhcnQ6IGJvb2xlYW4sXG5cdFx0cHVibGljIHJlYWRvbmx5IGluc3RydWN0aW9uUG9pbnRlclJlZmVyZW5jZT86IHN0cmluZ1xuXHQpIHsgfVxuXG5cdGdldElkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGBzdGFja2ZyYW1lOiR7dGhpcy50aHJlYWQuZ2V0SWQoKX06JHt0aGlzLmluZGV4fToke3RoaXMuc291cmNlLm5hbWV9YDtcblx0fVxuXG5cdGdldFNjb3BlcygpOiBQcm9taXNlPElTY29wZVtdPiB7XG5cdFx0aWYgKCF0aGlzLnNjb3Blcykge1xuXHRcdFx0dGhpcy5zY29wZXMgPSB0aGlzLnRocmVhZC5zZXNzaW9uLnNjb3Blcyh0aGlzLmZyYW1lSWQsIHRoaXMudGhyZWFkLnRocmVhZElkKS50aGVuKHJlc3BvbnNlID0+IHtcblx0XHRcdFx0aWYgKCFyZXNwb25zZSB8fCAhcmVzcG9uc2UuYm9keSB8fCAhcmVzcG9uc2UuYm9keS5zY29wZXMpIHtcblx0XHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB1c2VkSWRzID0gbmV3IFNldDxudW1iZXI+KCk7XG5cdFx0XHRcdHJldHVybiByZXNwb25zZS5ib2R5LnNjb3Blcy5tYXAocnMgPT4ge1xuXHRcdFx0XHRcdC8vIGZvcm0gdGhlIGlkIGJhc2VkIG9uIHRoZSBuYW1lIGFuZCBsb2NhdGlvbiBzbyB0aGF0IGl0J3MgdGhlXG5cdFx0XHRcdFx0Ly8gc2FtZSBhY3Jvc3MgbXVsdGlwbGUgcGF1c2VzIHRvIHJldGFpbiBleHBhbnNpb24gc3RhdGVcblx0XHRcdFx0XHRsZXQgaWQgPSAwO1xuXHRcdFx0XHRcdGRvIHtcblx0XHRcdFx0XHRcdGlkID0gc3RyaW5nSGFzaChgJHtycy5uYW1lfToke3JzLmxpbmV9OiR7cnMuY29sdW1ufWAsIGlkKTtcblx0XHRcdFx0XHR9IHdoaWxlICh1c2VkSWRzLmhhcyhpZCkpO1xuXG5cdFx0XHRcdFx0dXNlZElkcy5hZGQoaWQpO1xuXHRcdFx0XHRcdHJldHVybiBuZXcgU2NvcGUodGhpcywgaWQsIHJzLm5hbWUsIHJzLnZhcmlhYmxlc1JlZmVyZW5jZSwgcnMuZXhwZW5zaXZlLCBycy5uYW1lZFZhcmlhYmxlcywgcnMuaW5kZXhlZFZhcmlhYmxlcyxcblx0XHRcdFx0XHRcdHJzLmxpbmUgJiYgcnMuY29sdW1uICYmIHJzLmVuZExpbmUgJiYgcnMuZW5kQ29sdW1uID8gbmV3IFJhbmdlKHJzLmxpbmUsIHJzLmNvbHVtbiwgcnMuZW5kTGluZSwgcnMuZW5kQ29sdW1uKSA6IHVuZGVmaW5lZCk7XG5cblx0XHRcdFx0fSk7XG5cdFx0XHR9LCBlcnIgPT4gW25ldyBFcnJvclNjb3BlKHRoaXMsIDAsIGVyci5tZXNzYWdlKV0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnNjb3Blcztcblx0fVxuXG5cdGFzeW5jIGdldE1vc3RTcGVjaWZpY1Njb3BlcyhyYW5nZTogSVJhbmdlKTogUHJvbWlzZTxJU2NvcGVbXT4ge1xuXHRcdGNvbnN0IHNjb3BlcyA9IGF3YWl0IHRoaXMuZ2V0U2NvcGVzKCk7XG5cdFx0Y29uc3Qgbm9uRXhwZW5zaXZlU2NvcGVzID0gc2NvcGVzLmZpbHRlcihzID0+ICFzLmV4cGVuc2l2ZSk7XG5cdFx0Y29uc3QgaGF2ZVJhbmdlSW5mbyA9IG5vbkV4cGVuc2l2ZVNjb3Blcy5zb21lKHMgPT4gISFzLnJhbmdlKTtcblx0XHRpZiAoIWhhdmVSYW5nZUluZm8pIHtcblx0XHRcdHJldHVybiBub25FeHBlbnNpdmVTY29wZXM7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2NvcGVzQ29udGFpbmluZ1JhbmdlID0gbm9uRXhwZW5zaXZlU2NvcGVzLmZpbHRlcihzY29wZSA9PiBzY29wZS5yYW5nZSAmJiBSYW5nZS5jb250YWluc1JhbmdlKHNjb3BlLnJhbmdlLCByYW5nZSkpXG5cdFx0XHQuc29ydCgoZmlyc3QsIHNlY29uZCkgPT4gKGZpcnN0LnJhbmdlIS5lbmRMaW5lTnVtYmVyIC0gZmlyc3QucmFuZ2UhLnN0YXJ0TGluZU51bWJlcikgLSAoc2Vjb25kLnJhbmdlIS5lbmRMaW5lTnVtYmVyIC0gc2Vjb25kLnJhbmdlIS5zdGFydExpbmVOdW1iZXIpKTtcblx0XHRyZXR1cm4gc2NvcGVzQ29udGFpbmluZ1JhbmdlLmxlbmd0aCA/IHNjb3Blc0NvbnRhaW5pbmdSYW5nZSA6IG5vbkV4cGVuc2l2ZVNjb3Blcztcblx0fVxuXG5cdHJlc3RhcnQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMudGhyZWFkLnNlc3Npb24ucmVzdGFydEZyYW1lKHRoaXMuZnJhbWVJZCwgdGhpcy50aHJlYWQudGhyZWFkSWQpO1xuXHR9XG5cblx0Zm9yZ2V0U2NvcGVzKCk6IHZvaWQge1xuXHRcdHRoaXMuc2NvcGVzID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0dG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRjb25zdCBsaW5lTnVtYmVyVG9TdHJpbmcgPSB0eXBlb2YgdGhpcy5yYW5nZS5zdGFydExpbmVOdW1iZXIgPT09ICdudW1iZXInID8gYDoke3RoaXMucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyfWAgOiAnJztcblx0XHRjb25zdCBzb3VyY2VUb1N0cmluZyA9IGAke3RoaXMuc291cmNlLmluTWVtb3J5ID8gdGhpcy5zb3VyY2UubmFtZSA6IHRoaXMuc291cmNlLnVyaS5mc1BhdGh9JHtsaW5lTnVtYmVyVG9TdHJpbmd9YDtcblxuXHRcdHJldHVybiBzb3VyY2VUb1N0cmluZyA9PT0gVU5LTk9XTl9TT1VSQ0VfTEFCRUwgPyB0aGlzLm5hbWUgOiBgJHt0aGlzLm5hbWV9ICgke3NvdXJjZVRvU3RyaW5nfSlgO1xuXHR9XG5cblx0YXN5bmMgb3BlbkluRWRpdG9yKGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLCBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbiwgc2lkZUJ5U2lkZT86IGJvb2xlYW4sIHBpbm5lZD86IGJvb2xlYW4pOiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgdGhyZWFkU3RvcFJlYXNvbiA9IHRoaXMudGhyZWFkLnN0b3BwZWREZXRhaWxzPy5yZWFzb247XG5cdFx0aWYgKHRoaXMuaW5zdHJ1Y3Rpb25Qb2ludGVyUmVmZXJlbmNlICYmXG5cdFx0XHQodGhyZWFkU3RvcFJlYXNvbiA9PT0gJ2luc3RydWN0aW9uIGJyZWFrcG9pbnQnIHx8XG5cdFx0XHRcdCh0aHJlYWRTdG9wUmVhc29uID09PSAnc3RlcCcgJiYgdGhpcy50aHJlYWQubGFzdFN0ZXBwaW5nR3JhbnVsYXJpdHkgPT09ICdpbnN0cnVjdGlvbicpIHx8XG5cdFx0XHRcdGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yIGluc3RhbmNlb2YgRGlzYXNzZW1ibHlWaWV3SW5wdXQpKSB7XG5cdFx0XHRyZXR1cm4gZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKERpc2Fzc2VtYmx5Vmlld0lucHV0Lmluc3RhbmNlLCB7IHBpbm5lZDogdHJ1ZSwgcmV2ZWFsSWZPcGVuZWQ6IHRydWUgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc291cmNlLmF2YWlsYWJsZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuc291cmNlLm9wZW5JbkVkaXRvcihlZGl0b3JTZXJ2aWNlLCB0aGlzLnJhbmdlLCBwcmVzZXJ2ZUZvY3VzLCBzaWRlQnlTaWRlLCBwaW5uZWQpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0ZXF1YWxzKG90aGVyOiBJU3RhY2tGcmFtZSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAodGhpcy5uYW1lID09PSBvdGhlci5uYW1lKSAmJiAob3RoZXIudGhyZWFkID09PSB0aGlzLnRocmVhZCkgJiYgKHRoaXMuZnJhbWVJZCA9PT0gb3RoZXIuZnJhbWVJZCkgJiYgKG90aGVyLnNvdXJjZSA9PT0gdGhpcy5zb3VyY2UpICYmIChSYW5nZS5lcXVhbHNSYW5nZSh0aGlzLnJhbmdlLCBvdGhlci5yYW5nZSkpO1xuXHR9XG59XG5cbmNvbnN0IEtFRVBfU1VCVExFX0ZSQU1FX0FUX1RPUF9SRUFTT05TOiByZWFkb25seSBzdHJpbmdbXSA9IFsnYnJlYWtwb2ludCcsICdzdGVwJywgJ2Z1bmN0aW9uIGJyZWFrcG9pbnQnXTtcblxuZXhwb3J0IGNsYXNzIFRocmVhZCBpbXBsZW1lbnRzIElUaHJlYWQge1xuXHRwcml2YXRlIGNhbGxTdGFjazogSVN0YWNrRnJhbWVbXTtcblx0cHJpdmF0ZSBzdGFsZUNhbGxTdGFjazogSVN0YWNrRnJhbWVbXTtcblx0cHJpdmF0ZSBjYWxsU3RhY2tDYW5jZWxsYXRpb25Ub2tlbnM6IENhbmNlbGxhdGlvblRva2VuU291cmNlW10gPSBbXTtcblx0cHVibGljIHN0b3BwZWREZXRhaWxzOiBJUmF3U3RvcHBlZERldGFpbHMgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyBzdG9wcGVkOiBib29sZWFuO1xuXHRwdWJsaWMgcmVhY2hlZEVuZE9mQ2FsbFN0YWNrID0gZmFsc2U7XG5cdHB1YmxpYyBsYXN0U3RlcHBpbmdHcmFudWxhcml0eTogRGVidWdQcm90b2NvbC5TdGVwcGluZ0dyYW51bGFyaXR5IHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBzZXNzaW9uOiBJRGVidWdTZXNzaW9uLCBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgcmVhZG9ubHkgdGhyZWFkSWQ6IG51bWJlcikge1xuXHRcdHRoaXMuY2FsbFN0YWNrID0gW107XG5cdFx0dGhpcy5zdGFsZUNhbGxTdGFjayA9IFtdO1xuXHRcdHRoaXMuc3RvcHBlZCA9IGZhbHNlO1xuXHR9XG5cblx0Z2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYHRocmVhZDoke3RoaXMuc2Vzc2lvbi5nZXRJZCgpfToke3RoaXMudGhyZWFkSWR9YDtcblx0fVxuXG5cdGNsZWFyQ2FsbFN0YWNrKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmNhbGxTdGFjay5sZW5ndGgpIHtcblx0XHRcdHRoaXMuc3RhbGVDYWxsU3RhY2sgPSB0aGlzLmNhbGxTdGFjaztcblx0XHR9XG5cdFx0dGhpcy5jYWxsU3RhY2sgPSBbXTtcblx0XHR0aGlzLmNhbGxTdGFja0NhbmNlbGxhdGlvblRva2Vucy5mb3JFYWNoKGMgPT4gYy5kaXNwb3NlKHRydWUpKTtcblx0XHR0aGlzLmNhbGxTdGFja0NhbmNlbGxhdGlvblRva2VucyA9IFtdO1xuXHR9XG5cblx0Z2V0Q2FsbFN0YWNrKCk6IElTdGFja0ZyYW1lW10ge1xuXHRcdHJldHVybiB0aGlzLmNhbGxTdGFjaztcblx0fVxuXG5cdGdldFN0YWxlQ2FsbFN0YWNrKCk6IFJlYWRvbmx5QXJyYXk8SVN0YWNrRnJhbWU+IHtcblx0XHRyZXR1cm4gdGhpcy5zdGFsZUNhbGxTdGFjaztcblx0fVxuXG5cdGdldFRvcFN0YWNrRnJhbWUoKTogSVN0YWNrRnJhbWUgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGNhbGxTdGFjayA9IHRoaXMuZ2V0Q2FsbFN0YWNrKCk7XG5cdFx0Y29uc3Qgc3RvcFJlYXNvbiA9IHRoaXMuc3RvcHBlZERldGFpbHM/LnJlYXNvbjtcblx0XHQvLyBBbGxvdyBzdGFjayBmcmFtZSB3aXRob3V0IHNvdXJjZSBhbmQgd2l0aCBpbnN0cnVjdGlvblJlZmVyZW5jZVBvaW50ZXIgYXMgdG9wIHN0YWNrIGZyYW1lIHdoZW4gdXNpbmcgZGlzYXNzZW1ibHkgdmlldy5cblx0XHRjb25zdCBmaXJzdEF2YWlsYWJsZVN0YWNrRnJhbWUgPSBjYWxsU3RhY2suZmluZChzZiA9PiAhIShcblx0XHRcdCgoc3RvcFJlYXNvbiA9PT0gJ2luc3RydWN0aW9uIGJyZWFrcG9pbnQnIHx8IChzdG9wUmVhc29uID09PSAnc3RlcCcgJiYgdGhpcy5sYXN0U3RlcHBpbmdHcmFudWxhcml0eSA9PT0gJ2luc3RydWN0aW9uJykpICYmIHNmLmluc3RydWN0aW9uUG9pbnRlclJlZmVyZW5jZSkgfHxcblx0XHRcdChzZi5zb3VyY2UgJiYgc2Yuc291cmNlLmF2YWlsYWJsZSAmJiAoS0VFUF9TVUJUTEVfRlJBTUVfQVRfVE9QX1JFQVNPTlMuaW5jbHVkZXMoc3RvcFJlYXNvbiEpIHx8ICFpc0ZyYW1lRGVlbXBoYXNpemVkKHNmKSkpKSk7XG5cdFx0cmV0dXJuIGZpcnN0QXZhaWxhYmxlU3RhY2tGcmFtZTtcblx0fVxuXG5cdGdldCBzdGF0ZUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0aWYgKHRoaXMuc3RvcHBlZERldGFpbHMpIHtcblx0XHRcdHJldHVybiB0aGlzLnN0b3BwZWREZXRhaWxzLmRlc2NyaXB0aW9uIHx8XG5cdFx0XHRcdCh0aGlzLnN0b3BwZWREZXRhaWxzLnJlYXNvbiA/IG5scy5sb2NhbGl6ZSh7IGtleTogJ3BhdXNlZE9uJywgY29tbWVudDogWydpbmRpY2F0ZXMgcmVhc29uIGZvciBwcm9ncmFtIGJlaW5nIHBhdXNlZCddIH0sIFwiUGF1c2VkIG9uIHswfVwiLCB0aGlzLnN0b3BwZWREZXRhaWxzLnJlYXNvbikgOiBubHMubG9jYWxpemUoJ3BhdXNlZCcsIFwiUGF1c2VkXCIpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKHsga2V5OiAncnVubmluZycsIGNvbW1lbnQ6IFsnaW5kaWNhdGVzIHN0YXRlJ10gfSwgXCJSdW5uaW5nXCIpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFF1ZXJpZXMgdGhlIGRlYnVnIGFkYXB0ZXIgZm9yIHRoZSBjYWxsc3RhY2sgYW5kIHJldHVybnMgYSBwcm9taXNlXG5cdCAqIHdoaWNoIGNvbXBsZXRlcyBvbmNlIHRoZSBjYWxsIHN0YWNrIGhhcyBiZWVuIHJldHJpZXZlZC5cblx0ICogSWYgdGhlIHRocmVhZCBpcyBub3Qgc3RvcHBlZCwgaXQgcmV0dXJucyBhIHByb21pc2UgdG8gYW4gZW1wdHkgYXJyYXkuXG5cdCAqIE9ubHkgZmV0Y2hlcyB0aGUgZmlyc3Qgc3RhY2sgZnJhbWUgZm9yIHBlcmZvcm1hbmNlIHJlYXNvbnMuIENhbGxpbmcgdGhpcyBtZXRob2QgY29uc2VjdXRpdmUgdGltZXNcblx0ICogZ2V0cyB0aGUgcmVtYWluZGVyIG9mIHRoZSBjYWxsIHN0YWNrLlxuXHQgKi9cblx0YXN5bmMgZmV0Y2hDYWxsU3RhY2sobGV2ZWxzID0gMjApOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5zdG9wcGVkKSB7XG5cdFx0XHRjb25zdCBzdGFydCA9IHRoaXMuY2FsbFN0YWNrLmxlbmd0aDtcblx0XHRcdGNvbnN0IGNhbGxTdGFjayA9IGF3YWl0IHRoaXMuZ2V0Q2FsbFN0YWNrSW1wbChzdGFydCwgbGV2ZWxzKTtcblx0XHRcdHRoaXMucmVhY2hlZEVuZE9mQ2FsbFN0YWNrID0gY2FsbFN0YWNrLmxlbmd0aCA8IGxldmVscztcblx0XHRcdGlmIChzdGFydCA8IHRoaXMuY2FsbFN0YWNrLmxlbmd0aCkge1xuXHRcdFx0XHQvLyBTZXQgdGhlIHN0YWNrIGZyYW1lcyBmb3IgZXhhY3QgcG9zaXRpb24gd2UgcmVxdWVzdGVkLiBUbyBtYWtlIHN1cmUgbm8gY29uY3VycmVudCByZXF1ZXN0cyBjcmVhdGUgZHVwbGljYXRlIHN0YWNrIGZyYW1lcyAjMzA2NjBcblx0XHRcdFx0dGhpcy5jYWxsU3RhY2suc3BsaWNlKHN0YXJ0LCB0aGlzLmNhbGxTdGFjay5sZW5ndGggLSBzdGFydCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmNhbGxTdGFjayA9IHRoaXMuY2FsbFN0YWNrLmNvbmNhdChjYWxsU3RhY2sgfHwgW10pO1xuXHRcdFx0aWYgKHR5cGVvZiB0aGlzLnN0b3BwZWREZXRhaWxzPy50b3RhbEZyYW1lcyA9PT0gJ251bWJlcicgJiYgdGhpcy5zdG9wcGVkRGV0YWlscy50b3RhbEZyYW1lcyA9PT0gdGhpcy5jYWxsU3RhY2subGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMucmVhY2hlZEVuZE9mQ2FsbFN0YWNrID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldENhbGxTdGFja0ltcGwoc3RhcnRGcmFtZTogbnVtYmVyLCBsZXZlbHM6IG51bWJlcik6IFByb21pc2U8SVN0YWNrRnJhbWVbXT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB0b2tlblNvdXJjZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdFx0dGhpcy5jYWxsU3RhY2tDYW5jZWxsYXRpb25Ub2tlbnMucHVzaCh0b2tlblNvdXJjZSk7XG5cdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuc2Vzc2lvbi5zdGFja1RyYWNlKHRoaXMudGhyZWFkSWQsIHN0YXJ0RnJhbWUsIGxldmVscywgdG9rZW5Tb3VyY2UudG9rZW4pO1xuXHRcdFx0aWYgKCFyZXNwb25zZSB8fCAhcmVzcG9uc2UuYm9keSB8fCB0b2tlblNvdXJjZS50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLnN0b3BwZWREZXRhaWxzKSB7XG5cdFx0XHRcdHRoaXMuc3RvcHBlZERldGFpbHMudG90YWxGcmFtZXMgPSByZXNwb25zZS5ib2R5LnRvdGFsRnJhbWVzO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzcG9uc2UuYm9keS5zdGFja0ZyYW1lcy5tYXAoKHJzZiwgaW5kZXgpID0+IHtcblx0XHRcdFx0Y29uc3Qgc291cmNlID0gdGhpcy5zZXNzaW9uLmdldFNvdXJjZShyc2Yuc291cmNlKTtcblxuXHRcdFx0XHRyZXR1cm4gbmV3IFN0YWNrRnJhbWUodGhpcywgcnNmLmlkLCBzb3VyY2UsIHJzZi5uYW1lLCByc2YucHJlc2VudGF0aW9uSGludCwgbmV3IFJhbmdlKFxuXHRcdFx0XHRcdHJzZi5saW5lLFxuXHRcdFx0XHRcdHJzZi5jb2x1bW4sXG5cdFx0XHRcdFx0cnNmLmVuZExpbmUgfHwgcnNmLmxpbmUsXG5cdFx0XHRcdFx0cnNmLmVuZENvbHVtbiB8fCByc2YuY29sdW1uXG5cdFx0XHRcdCksIHN0YXJ0RnJhbWUgKyBpbmRleCwgdHlwZW9mIHJzZi5jYW5SZXN0YXJ0ID09PSAnYm9vbGVhbicgPyByc2YuY2FuUmVzdGFydCA6IHRydWUsIHJzZi5pbnN0cnVjdGlvblBvaW50ZXJSZWZlcmVuY2UpO1xuXHRcdFx0fSk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRpZiAodGhpcy5zdG9wcGVkRGV0YWlscykge1xuXHRcdFx0XHR0aGlzLnN0b3BwZWREZXRhaWxzLmZyYW1lc0Vycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgZXhjZXB0aW9uIGluZm8gcHJvbWlzZSBpZiB0aGUgZXhjZXB0aW9uIHdhcyB0aHJvd24sIG90aGVyd2lzZSB1bmRlZmluZWRcblx0ICovXG5cdGdldCBleGNlcHRpb25JbmZvKCk6IFByb21pc2U8SUV4Y2VwdGlvbkluZm8gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAodGhpcy5zdG9wcGVkRGV0YWlscyAmJiB0aGlzLnN0b3BwZWREZXRhaWxzLnJlYXNvbiA9PT0gJ2V4Y2VwdGlvbicpIHtcblx0XHRcdGlmICh0aGlzLnNlc3Npb24uY2FwYWJpbGl0aWVzLnN1cHBvcnRzRXhjZXB0aW9uSW5mb1JlcXVlc3QpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc2Vzc2lvbi5leGNlcHRpb25JbmZvKHRoaXMudGhyZWFkSWQpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiB0aGlzLnN0b3BwZWREZXRhaWxzLnRleHQsXG5cdFx0XHRcdGJyZWFrTW9kZTogbnVsbFxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0fVxuXG5cdG5leHQoZ3JhbnVsYXJpdHk/OiBEZWJ1Z1Byb3RvY29sLlN0ZXBwaW5nR3JhbnVsYXJpdHkpOiBQcm9taXNlPGFueT4ge1xuXHRcdHJldHVybiB0aGlzLnNlc3Npb24ubmV4dCh0aGlzLnRocmVhZElkLCBncmFudWxhcml0eSk7XG5cdH1cblxuXHRzdGVwSW4oZ3JhbnVsYXJpdHk/OiBEZWJ1Z1Byb3RvY29sLlN0ZXBwaW5nR3JhbnVsYXJpdHkpOiBQcm9taXNlPGFueT4ge1xuXHRcdHJldHVybiB0aGlzLnNlc3Npb24uc3RlcEluKHRoaXMudGhyZWFkSWQsIHVuZGVmaW5lZCwgZ3JhbnVsYXJpdHkpO1xuXHR9XG5cblx0c3RlcE91dChncmFudWxhcml0eT86IERlYnVnUHJvdG9jb2wuU3RlcHBpbmdHcmFudWxhcml0eSk6IFByb21pc2U8YW55PiB7XG5cdFx0cmV0dXJuIHRoaXMuc2Vzc2lvbi5zdGVwT3V0KHRoaXMudGhyZWFkSWQsIGdyYW51bGFyaXR5KTtcblx0fVxuXG5cdHN0ZXBCYWNrKGdyYW51bGFyaXR5PzogRGVidWdQcm90b2NvbC5TdGVwcGluZ0dyYW51bGFyaXR5KTogUHJvbWlzZTxhbnk+IHtcblx0XHRyZXR1cm4gdGhpcy5zZXNzaW9uLnN0ZXBCYWNrKHRoaXMudGhyZWFkSWQsIGdyYW51bGFyaXR5KTtcblx0fVxuXG5cdGNvbnRpbnVlKCk6IFByb21pc2U8YW55PiB7XG5cdFx0cmV0dXJuIHRoaXMuc2Vzc2lvbi5jb250aW51ZSh0aGlzLnRocmVhZElkKTtcblx0fVxuXG5cdHBhdXNlKCk6IFByb21pc2U8YW55PiB7XG5cdFx0cmV0dXJuIHRoaXMuc2Vzc2lvbi5wYXVzZSh0aGlzLnRocmVhZElkKTtcblx0fVxuXG5cdHRlcm1pbmF0ZSgpOiBQcm9taXNlPGFueT4ge1xuXHRcdHJldHVybiB0aGlzLnNlc3Npb24udGVybWluYXRlVGhyZWFkcyhbdGhpcy50aHJlYWRJZF0pO1xuXHR9XG5cblx0cmV2ZXJzZUNvbnRpbnVlKCk6IFByb21pc2U8YW55PiB7XG5cdFx0cmV0dXJuIHRoaXMuc2Vzc2lvbi5yZXZlcnNlQ29udGludWUodGhpcy50aHJlYWRJZCk7XG5cdH1cbn1cblxuLyoqXG4gKiBHZXRzIGEgVVJJIHRvIGEgbWVtb3J5IGluIHRoZSBnaXZlbiBzZXNzaW9uIElELlxuICovXG5leHBvcnQgY29uc3QgZ2V0VXJpRm9yRGVidWdNZW1vcnkgPSAoXG5cdHNlc3Npb25JZDogc3RyaW5nLFxuXHRtZW1vcnlSZWZlcmVuY2U6IHN0cmluZyxcblx0cmFuZ2U/OiB7IGZyb21PZmZzZXQ6IG51bWJlcjsgdG9PZmZzZXQ6IG51bWJlciB9LFxuXHRkaXNwbGF5TmFtZSA9ICdtZW1vcnknXG4pID0+IHtcblx0cmV0dXJuIFVSSS5mcm9tKHtcblx0XHRzY2hlbWU6IERFQlVHX01FTU9SWV9TQ0hFTUUsXG5cdFx0YXV0aG9yaXR5OiBzZXNzaW9uSWQsXG5cdFx0cGF0aDogJy8nICsgZW5jb2RlVVJJQ29tcG9uZW50KG1lbW9yeVJlZmVyZW5jZSkgKyBgLyR7ZW5jb2RlVVJJQ29tcG9uZW50KGRpc3BsYXlOYW1lKX0uYmluYCxcblx0XHRxdWVyeTogcmFuZ2UgPyBgP3JhbmdlPSR7cmFuZ2UuZnJvbU9mZnNldH06JHtyYW5nZS50b09mZnNldH1gIDogdW5kZWZpbmVkLFxuXHR9KTtcbn07XG5cbmV4cG9ydCBjbGFzcyBNZW1vcnlSZWdpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSU1lbW9yeVJlZ2lvbiB7XG5cdHByaXZhdGUgcmVhZG9ubHkgaW52YWxpZGF0ZUVtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJTWVtb3J5SW52YWxpZGF0aW9uRXZlbnQ+KCkpO1xuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRJbnZhbGlkYXRlID0gdGhpcy5pbnZhbGlkYXRlRW1pdHRlci5ldmVudDtcblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIHJlYWRvbmx5IHdyaXRhYmxlID0gISF0aGlzLnNlc3Npb24uY2FwYWJpbGl0aWVzLnN1cHBvcnRzV3JpdGVNZW1vcnlSZXF1ZXN0O1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgbWVtb3J5UmVmZXJlbmNlOiBzdHJpbmcsIHByaXZhdGUgcmVhZG9ubHkgc2Vzc2lvbjogSURlYnVnU2Vzc2lvbikge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoc2Vzc2lvbi5vbkRpZEludmFsaWRhdGVNZW1vcnkoZSA9PiB7XG5cdFx0XHRpZiAoZS5ib2R5Lm1lbW9yeVJlZmVyZW5jZSA9PT0gbWVtb3J5UmVmZXJlbmNlKSB7XG5cdFx0XHRcdHRoaXMuaW52YWxpZGF0ZShlLmJvZHkub2Zmc2V0LCBlLmJvZHkuY291bnQgLSBlLmJvZHkub2Zmc2V0KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcmVhZChmcm9tT2Zmc2V0OiBudW1iZXIsIHRvT2Zmc2V0OiBudW1iZXIpOiBQcm9taXNlPE1lbW9yeVJhbmdlW10+IHtcblx0XHRjb25zdCBsZW5ndGggPSB0b09mZnNldCAtIGZyb21PZmZzZXQ7XG5cdFx0Y29uc3Qgb2Zmc2V0ID0gZnJvbU9mZnNldDtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnNlc3Npb24ucmVhZE1lbW9yeSh0aGlzLm1lbW9yeVJlZmVyZW5jZSwgb2Zmc2V0LCBsZW5ndGgpO1xuXG5cdFx0aWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkIHx8ICFyZXN1bHQuYm9keT8uZGF0YSkge1xuXHRcdFx0cmV0dXJuIFt7IHR5cGU6IE1lbW9yeVJhbmdlVHlwZS5VbnJlYWRhYmxlLCBvZmZzZXQsIGxlbmd0aCB9XTtcblx0XHR9XG5cblx0XHRsZXQgZGF0YTogVlNCdWZmZXI7XG5cdFx0dHJ5IHtcblx0XHRcdGRhdGEgPSBkZWNvZGVCYXNlNjQocmVzdWx0LmJvZHkuZGF0YSk7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHRyZXR1cm4gW3sgdHlwZTogTWVtb3J5UmFuZ2VUeXBlLkVycm9yLCBvZmZzZXQsIGxlbmd0aCwgZXJyb3I6ICdJbnZhbGlkIGJhc2U2NCBkYXRhIGZyb20gZGVidWcgYWRhcHRlcicgfV07XG5cdFx0fVxuXG5cdFx0Y29uc3QgdW5yZWFkYWJsZSA9IHJlc3VsdC5ib2R5LnVucmVhZGFibGVCeXRlcyB8fCAwO1xuXHRcdGNvbnN0IGRhdGFMZW5ndGggPSBsZW5ndGggLSB1bnJlYWRhYmxlO1xuXHRcdGlmIChkYXRhLmJ5dGVMZW5ndGggPCBkYXRhTGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBwYWQgPSBWU0J1ZmZlci5hbGxvYyhkYXRhTGVuZ3RoIC0gZGF0YS5ieXRlTGVuZ3RoKTtcblx0XHRcdHBhZC5idWZmZXIuZmlsbCgwKTtcblx0XHRcdGRhdGEgPSBWU0J1ZmZlci5jb25jYXQoW2RhdGEsIHBhZF0sIGRhdGFMZW5ndGgpO1xuXHRcdH0gZWxzZSBpZiAoZGF0YS5ieXRlTGVuZ3RoID4gZGF0YUxlbmd0aCkge1xuXHRcdFx0ZGF0YSA9IGRhdGEuc2xpY2UoMCwgZGF0YUxlbmd0aCk7XG5cdFx0fVxuXG5cdFx0aWYgKCF1bnJlYWRhYmxlKSB7XG5cdFx0XHRyZXR1cm4gW3sgdHlwZTogTWVtb3J5UmFuZ2VUeXBlLlZhbGlkLCBvZmZzZXQsIGxlbmd0aCwgZGF0YSB9XTtcblx0XHR9XG5cblx0XHRyZXR1cm4gW1xuXHRcdFx0eyB0eXBlOiBNZW1vcnlSYW5nZVR5cGUuVmFsaWQsIG9mZnNldCwgbGVuZ3RoOiBkYXRhTGVuZ3RoLCBkYXRhIH0sXG5cdFx0XHR7IHR5cGU6IE1lbW9yeVJhbmdlVHlwZS5VbnJlYWRhYmxlLCBvZmZzZXQ6IG9mZnNldCArIGRhdGFMZW5ndGgsIGxlbmd0aDogdW5yZWFkYWJsZSB9LFxuXHRcdF07XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgd3JpdGUob2Zmc2V0OiBudW1iZXIsIGRhdGE6IFZTQnVmZmVyKTogUHJvbWlzZTxudW1iZXI+IHtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnNlc3Npb24ud3JpdGVNZW1vcnkodGhpcy5tZW1vcnlSZWZlcmVuY2UsIG9mZnNldCwgZW5jb2RlQmFzZTY0KGRhdGEpLCB0cnVlKTtcblx0XHRjb25zdCB3cml0dGVuID0gcmVzdWx0Py5ib2R5Py5ieXRlc1dyaXR0ZW4gPz8gZGF0YS5ieXRlTGVuZ3RoO1xuXHRcdHRoaXMuaW52YWxpZGF0ZShvZmZzZXQsIG9mZnNldCArIHdyaXR0ZW4pO1xuXHRcdHJldHVybiB3cml0dGVuO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBpbnZhbGlkYXRlKGZyb21PZmZzZXQ6IG51bWJlciwgdG9PZmZzZXQ6IG51bWJlcikge1xuXHRcdHRoaXMuaW52YWxpZGF0ZUVtaXR0ZXIuZmlyZSh7IGZyb21PZmZzZXQsIHRvT2Zmc2V0IH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFbmFibGVtZW50IGltcGxlbWVudHMgSUVuYWJsZW1lbnQge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgZW5hYmxlZDogYm9vbGVhbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGlkOiBzdHJpbmdcblx0KSB7IH1cblxuXHRnZXRJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmlkO1xuXHR9XG59XG5cbmludGVyZmFjZSBJQnJlYWtwb2ludFNlc3Npb25EYXRhIGV4dGVuZHMgRGVidWdQcm90b2NvbC5CcmVha3BvaW50IHtcblx0c3VwcG9ydHNDb25kaXRpb25hbEJyZWFrcG9pbnRzOiBib29sZWFuO1xuXHRzdXBwb3J0c0hpdENvbmRpdGlvbmFsQnJlYWtwb2ludHM6IGJvb2xlYW47XG5cdHN1cHBvcnRzTG9nUG9pbnRzOiBib29sZWFuO1xuXHRzdXBwb3J0c0Z1bmN0aW9uQnJlYWtwb2ludHM6IGJvb2xlYW47XG5cdHN1cHBvcnRzRGF0YUJyZWFrcG9pbnRzOiBib29sZWFuO1xuXHRzdXBwb3J0c0luc3RydWN0aW9uQnJlYWtwb2ludHM6IGJvb2xlYW47XG5cdHNlc3Npb25JZDogc3RyaW5nO1xufVxuXG5mdW5jdGlvbiB0b0JyZWFrcG9pbnRTZXNzaW9uRGF0YShkYXRhOiBEZWJ1Z1Byb3RvY29sLkJyZWFrcG9pbnQsIGNhcGFiaWxpdGllczogRGVidWdQcm90b2NvbC5DYXBhYmlsaXRpZXMpOiBJQnJlYWtwb2ludFNlc3Npb25EYXRhIHtcblx0cmV0dXJuIG1peGluKHtcblx0XHRzdXBwb3J0c0NvbmRpdGlvbmFsQnJlYWtwb2ludHM6ICEhY2FwYWJpbGl0aWVzLnN1cHBvcnRzQ29uZGl0aW9uYWxCcmVha3BvaW50cyxcblx0XHRzdXBwb3J0c0hpdENvbmRpdGlvbmFsQnJlYWtwb2ludHM6ICEhY2FwYWJpbGl0aWVzLnN1cHBvcnRzSGl0Q29uZGl0aW9uYWxCcmVha3BvaW50cyxcblx0XHRzdXBwb3J0c0xvZ1BvaW50czogISFjYXBhYmlsaXRpZXMuc3VwcG9ydHNMb2dQb2ludHMsXG5cdFx0c3VwcG9ydHNGdW5jdGlvbkJyZWFrcG9pbnRzOiAhIWNhcGFiaWxpdGllcy5zdXBwb3J0c0Z1bmN0aW9uQnJlYWtwb2ludHMsXG5cdFx0c3VwcG9ydHNEYXRhQnJlYWtwb2ludHM6ICEhY2FwYWJpbGl0aWVzLnN1cHBvcnRzRGF0YUJyZWFrcG9pbnRzLFxuXHRcdHN1cHBvcnRzSW5zdHJ1Y3Rpb25CcmVha3BvaW50czogISFjYXBhYmlsaXRpZXMuc3VwcG9ydHNJbnN0cnVjdGlvbkJyZWFrcG9pbnRzXG5cdH0sIGRhdGEpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElCYXNlQnJlYWtwb2ludE9wdGlvbnMge1xuXHRlbmFibGVkPzogYm9vbGVhbjtcblx0aGl0Q29uZGl0aW9uPzogc3RyaW5nO1xuXHRjb25kaXRpb24/OiBzdHJpbmc7XG5cdGxvZ01lc3NhZ2U/OiBzdHJpbmc7XG5cdG1vZGU/OiBzdHJpbmc7XG5cdG1vZGVMYWJlbD86IHN0cmluZztcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VCcmVha3BvaW50IGV4dGVuZHMgRW5hYmxlbWVudCBpbXBsZW1lbnRzIElCYXNlQnJlYWtwb2ludCB7XG5cblx0cHJpdmF0ZSBzZXNzaW9uRGF0YSA9IG5ldyBNYXA8c3RyaW5nLCBJQnJlYWtwb2ludFNlc3Npb25EYXRhPigpO1xuXHRwcm90ZWN0ZWQgZGF0YTogSUJyZWFrcG9pbnRTZXNzaW9uRGF0YSB8IHVuZGVmaW5lZDtcblx0cHVibGljIGhpdENvbmRpdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwdWJsaWMgY29uZGl0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyBsb2dNZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyBtb2RlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyBtb2RlTGFiZWw6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRpZDogc3RyaW5nLFxuXHRcdG9wdHM6IElCYXNlQnJlYWtwb2ludE9wdGlvbnNcblx0KSB7XG5cdFx0c3VwZXIob3B0cy5lbmFibGVkID8/IHRydWUsIGlkKTtcblx0XHR0aGlzLmNvbmRpdGlvbiA9IG9wdHMuY29uZGl0aW9uO1xuXHRcdHRoaXMuaGl0Q29uZGl0aW9uID0gb3B0cy5oaXRDb25kaXRpb247XG5cdFx0dGhpcy5sb2dNZXNzYWdlID0gb3B0cy5sb2dNZXNzYWdlO1xuXHRcdHRoaXMubW9kZSA9IG9wdHMubW9kZTtcblx0XHR0aGlzLm1vZGVMYWJlbCA9IG9wdHMubW9kZUxhYmVsO1xuXHR9XG5cblx0c2V0U2Vzc2lvbkRhdGEoc2Vzc2lvbklkOiBzdHJpbmcsIGRhdGE6IElCcmVha3BvaW50U2Vzc2lvbkRhdGEgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdHRoaXMuc2Vzc2lvbkRhdGEuZGVsZXRlKHNlc3Npb25JZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRhdGEuc2Vzc2lvbklkID0gc2Vzc2lvbklkO1xuXHRcdFx0dGhpcy5zZXNzaW9uRGF0YS5zZXQoc2Vzc2lvbklkLCBkYXRhKTtcblx0XHR9XG5cblx0XHRjb25zdCBhbGxEYXRhID0gQXJyYXkuZnJvbSh0aGlzLnNlc3Npb25EYXRhLnZhbHVlcygpKTtcblx0XHRjb25zdCB2ZXJpZmllZERhdGEgPSBkaXN0aW5jdChhbGxEYXRhLmZpbHRlcihkID0+IGQudmVyaWZpZWQpLCBkID0+IGAke2QubGluZX06JHtkLmNvbHVtbn1gKTtcblx0XHRpZiAodmVyaWZpZWREYXRhLmxlbmd0aCkge1xuXHRcdFx0Ly8gSW4gY2FzZSBtdWx0aXBsZSBzZXNzaW9uIHZlcmlmaWVkIHRoZSBicmVha3BvaW50IGFuZCB0aGV5IHByb3ZpZGUgZGlmZmVyZW50IGRhdGEgc2hvdyB0aGUgaW50aWFsIGRhdGEgdGhhdCB0aGUgdXNlciBzZXQgKGNvcm5lciBjYXNlKVxuXHRcdFx0dGhpcy5kYXRhID0gdmVyaWZpZWREYXRhLmxlbmd0aCA9PT0gMSA/IHZlcmlmaWVkRGF0YVswXSA6IHVuZGVmaW5lZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gTm8gc2Vzc2lvbiB2ZXJpZmllZCB0aGUgYnJlYWtwb2ludFxuXHRcdFx0dGhpcy5kYXRhID0gYWxsRGF0YS5sZW5ndGggPyBhbGxEYXRhWzBdIDogdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdGdldCBtZXNzYWdlKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLmRhdGEpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZGF0YS5tZXNzYWdlO1xuXHR9XG5cblx0Z2V0IHZlcmlmaWVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmRhdGEgPyB0aGlzLmRhdGEudmVyaWZpZWQgOiB0cnVlO1xuXHR9XG5cblx0Z2V0IHNlc3Npb25zVGhhdFZlcmlmaWVkKCkge1xuXHRcdGNvbnN0IHNlc3Npb25JZHM6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBbc2Vzc2lvbklkLCBkYXRhXSBvZiB0aGlzLnNlc3Npb25EYXRhKSB7XG5cdFx0XHRpZiAoZGF0YS52ZXJpZmllZCkge1xuXHRcdFx0XHRzZXNzaW9uSWRzLnB1c2goc2Vzc2lvbklkKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gc2Vzc2lvbklkcztcblx0fVxuXG5cdGFic3RyYWN0IGdldCBzdXBwb3J0ZWQoKTogYm9vbGVhbjtcblxuXHRnZXRJZEZyb21BZGFwdGVyKHNlc3Npb25JZDogc3RyaW5nKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBkYXRhID0gdGhpcy5zZXNzaW9uRGF0YS5nZXQoc2Vzc2lvbklkKTtcblx0XHRyZXR1cm4gZGF0YSA/IGRhdGEuaWQgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXREZWJ1Z1Byb3RvY29sQnJlYWtwb2ludChzZXNzaW9uSWQ6IHN0cmluZyk6IERlYnVnUHJvdG9jb2wuQnJlYWtwb2ludCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgZGF0YSA9IHRoaXMuc2Vzc2lvbkRhdGEuZ2V0KHNlc3Npb25JZCk7XG5cdFx0aWYgKGRhdGEpIHtcblx0XHRcdGNvbnN0IGJwOiBEZWJ1Z1Byb3RvY29sLkJyZWFrcG9pbnQgPSB7XG5cdFx0XHRcdGlkOiBkYXRhLmlkLFxuXHRcdFx0XHR2ZXJpZmllZDogZGF0YS52ZXJpZmllZCxcblx0XHRcdFx0bWVzc2FnZTogZGF0YS5tZXNzYWdlLFxuXHRcdFx0XHRzb3VyY2U6IGRhdGEuc291cmNlLFxuXHRcdFx0XHRsaW5lOiBkYXRhLmxpbmUsXG5cdFx0XHRcdGNvbHVtbjogZGF0YS5jb2x1bW4sXG5cdFx0XHRcdGVuZExpbmU6IGRhdGEuZW5kTGluZSxcblx0XHRcdFx0ZW5kQ29sdW1uOiBkYXRhLmVuZENvbHVtbixcblx0XHRcdFx0aW5zdHJ1Y3Rpb25SZWZlcmVuY2U6IGRhdGEuaW5zdHJ1Y3Rpb25SZWZlcmVuY2UsXG5cdFx0XHRcdG9mZnNldDogZGF0YS5vZmZzZXRcblx0XHRcdH07XG5cdFx0XHRyZXR1cm4gYnA7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHR0b0pTT04oKTogSUJhc2VCcmVha3BvaW50T3B0aW9ucyAmIHsgaWQ6IHN0cmluZyB9IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aWQ6IHRoaXMuZ2V0SWQoKSxcblx0XHRcdGVuYWJsZWQ6IHRoaXMuZW5hYmxlZCxcblx0XHRcdGNvbmRpdGlvbjogdGhpcy5jb25kaXRpb24sXG5cdFx0XHRoaXRDb25kaXRpb246IHRoaXMuaGl0Q29uZGl0aW9uLFxuXHRcdFx0bG9nTWVzc2FnZTogdGhpcy5sb2dNZXNzYWdlLFxuXHRcdFx0bW9kZTogdGhpcy5tb2RlLFxuXHRcdFx0bW9kZUxhYmVsOiB0aGlzLm1vZGVMYWJlbCxcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUJyZWFrcG9pbnRPcHRpb25zIGV4dGVuZHMgSUJhc2VCcmVha3BvaW50T3B0aW9ucyB7XG5cdHVyaTogdXJpO1xuXHRsaW5lTnVtYmVyOiBudW1iZXI7XG5cdGNvbHVtbjogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRhZGFwdGVyRGF0YTogYW55O1xuXHR0cmlnZ2VyZWRCeTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgY2xhc3MgQnJlYWtwb2ludCBleHRlbmRzIEJhc2VCcmVha3BvaW50IGltcGxlbWVudHMgSUJyZWFrcG9pbnQge1xuXHRwcml2YXRlIHNlc3Npb25zRGlkVHJpZ2dlcj86IFNldDxzdHJpbmc+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF91cmk6IHVyaTtcblx0cHJpdmF0ZSBfYWRhcHRlckRhdGE6IGFueTtcblx0cHJpdmF0ZSBfbGluZU51bWJlcjogbnVtYmVyO1xuXHRwcml2YXRlIF9jb2x1bW46IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cHVibGljIHRyaWdnZXJlZEJ5OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0czogSUJyZWFrcG9pbnRPcHRpb25zLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdGV4dEZpbGVTZXJ2aWNlOiBJVGV4dEZpbGVTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0aWQgPSBnZW5lcmF0ZVV1aWQoKSxcblx0KSB7XG5cdFx0c3VwZXIoaWQsIG9wdHMpO1xuXHRcdHRoaXMuX3VyaSA9IG9wdHMudXJpO1xuXHRcdHRoaXMuX2xpbmVOdW1iZXIgPSBvcHRzLmxpbmVOdW1iZXI7XG5cdFx0dGhpcy5fY29sdW1uID0gb3B0cy5jb2x1bW47XG5cdFx0dGhpcy5fYWRhcHRlckRhdGEgPSBvcHRzLmFkYXB0ZXJEYXRhO1xuXHRcdHRoaXMudHJpZ2dlcmVkQnkgPSBvcHRzLnRyaWdnZXJlZEJ5O1xuXHR9XG5cblx0dG9EQVAoKTogRGVidWdQcm90b2NvbC5Tb3VyY2VCcmVha3BvaW50IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bGluZTogdGhpcy5zZXNzaW9uQWdub3N0aWNEYXRhLmxpbmVOdW1iZXIsXG5cdFx0XHRjb2x1bW46IHRoaXMuc2Vzc2lvbkFnbm9zdGljRGF0YS5jb2x1bW4sXG5cdFx0XHRjb25kaXRpb246IHRoaXMuY29uZGl0aW9uLFxuXHRcdFx0aGl0Q29uZGl0aW9uOiB0aGlzLmhpdENvbmRpdGlvbixcblx0XHRcdGxvZ01lc3NhZ2U6IHRoaXMubG9nTWVzc2FnZSxcblx0XHRcdG1vZGU6IHRoaXMubW9kZVxuXHRcdH07XG5cdH1cblxuXHRnZXQgb3JpZ2luYWxVcmkoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VyaTtcblx0fVxuXG5cdGdldCBsaW5lTnVtYmVyKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMudmVyaWZpZWQgJiYgdGhpcy5kYXRhICYmIHR5cGVvZiB0aGlzLmRhdGEubGluZSA9PT0gJ251bWJlcicgPyB0aGlzLmRhdGEubGluZSA6IHRoaXMuX2xpbmVOdW1iZXI7XG5cdH1cblxuXHRvdmVycmlkZSBnZXQgdmVyaWZpZWQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuZGF0YSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZGF0YS52ZXJpZmllZCAmJiAhdGhpcy50ZXh0RmlsZVNlcnZpY2UuaXNEaXJ0eSh0aGlzLl91cmkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Z2V0IHBlbmRpbmcoKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuZGF0YSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy50cmlnZ2VyZWRCeSAhPT0gdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0IHVyaSgpOiB1cmkge1xuXHRcdHJldHVybiB0aGlzLnZlcmlmaWVkICYmIHRoaXMuZGF0YSAmJiB0aGlzLmRhdGEuc291cmNlID8gZ2V0VXJpRnJvbVNvdXJjZSh0aGlzLmRhdGEuc291cmNlLCB0aGlzLmRhdGEuc291cmNlLnBhdGgsIHRoaXMuZGF0YS5zZXNzaW9uSWQsIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UpIDogdGhpcy5fdXJpO1xuXHR9XG5cblx0Z2V0IGNvbHVtbigpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnZlcmlmaWVkICYmIHRoaXMuZGF0YSAmJiB0eXBlb2YgdGhpcy5kYXRhLmNvbHVtbiA9PT0gJ251bWJlcicgPyB0aGlzLmRhdGEuY29sdW1uIDogdGhpcy5fY29sdW1uO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0IG1lc3NhZ2UoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy50ZXh0RmlsZVNlcnZpY2UuaXNEaXJ0eSh0aGlzLnVyaSkpIHtcblx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ2JyZWFrcG9pbnREaXJ0eWRIb3ZlcicsIFwiVW52ZXJpZmllZCBicmVha3BvaW50LiBGaWxlIGlzIG1vZGlmaWVkLCBwbGVhc2UgcmVzdGFydCBkZWJ1ZyBzZXNzaW9uLlwiKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3VwZXIubWVzc2FnZTtcblx0fVxuXG5cdGdldCBhZGFwdGVyRGF0YSgpOiBhbnkge1xuXHRcdHJldHVybiB0aGlzLmRhdGEgJiYgdGhpcy5kYXRhLnNvdXJjZSAmJiB0aGlzLmRhdGEuc291cmNlLmFkYXB0ZXJEYXRhID8gdGhpcy5kYXRhLnNvdXJjZS5hZGFwdGVyRGF0YSA6IHRoaXMuX2FkYXB0ZXJEYXRhO1xuXHR9XG5cblx0Z2V0IGVuZExpbmVOdW1iZXIoKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy52ZXJpZmllZCAmJiB0aGlzLmRhdGEgPyB0aGlzLmRhdGEuZW5kTGluZSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdGdldCBlbmRDb2x1bW4oKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy52ZXJpZmllZCAmJiB0aGlzLmRhdGEgPyB0aGlzLmRhdGEuZW5kQ29sdW1uIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0IHNlc3Npb25BZ25vc3RpY0RhdGEoKTogeyBsaW5lTnVtYmVyOiBudW1iZXI7IGNvbHVtbjogbnVtYmVyIHwgdW5kZWZpbmVkIH0ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRsaW5lTnVtYmVyOiB0aGlzLl9saW5lTnVtYmVyLFxuXHRcdFx0Y29sdW1uOiB0aGlzLl9jb2x1bW5cblx0XHR9O1xuXHR9XG5cblx0Z2V0IHN1cHBvcnRlZCgpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuZGF0YSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmICh0aGlzLmxvZ01lc3NhZ2UgJiYgIXRoaXMuZGF0YS5zdXBwb3J0c0xvZ1BvaW50cykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAodGhpcy5jb25kaXRpb24gJiYgIXRoaXMuZGF0YS5zdXBwb3J0c0NvbmRpdGlvbmFsQnJlYWtwb2ludHMpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuaGl0Q29uZGl0aW9uICYmICF0aGlzLmRhdGEuc3VwcG9ydHNIaXRDb25kaXRpb25hbEJyZWFrcG9pbnRzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRvdmVycmlkZSBzZXRTZXNzaW9uRGF0YShzZXNzaW9uSWQ6IHN0cmluZywgZGF0YTogSUJyZWFrcG9pbnRTZXNzaW9uRGF0YSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHN1cGVyLnNldFNlc3Npb25EYXRhKHNlc3Npb25JZCwgZGF0YSk7XG5cdFx0aWYgKCF0aGlzLl9hZGFwdGVyRGF0YSkge1xuXHRcdFx0dGhpcy5fYWRhcHRlckRhdGEgPSB0aGlzLmFkYXB0ZXJEYXRhO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIHRvSlNPTigpOiBJQnJlYWtwb2ludE9wdGlvbnMgJiB7IGlkOiBzdHJpbmcgfSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdC4uLnN1cGVyLnRvSlNPTigpLFxuXHRcdFx0dXJpOiB0aGlzLl91cmksXG5cdFx0XHRsaW5lTnVtYmVyOiB0aGlzLl9saW5lTnVtYmVyLFxuXHRcdFx0Y29sdW1uOiB0aGlzLl9jb2x1bW4sXG5cdFx0XHRhZGFwdGVyRGF0YTogdGhpcy5hZGFwdGVyRGF0YSxcblx0XHRcdHRyaWdnZXJlZEJ5OiB0aGlzLnRyaWdnZXJlZEJ5LFxuXHRcdH07XG5cdH1cblxuXHRvdmVycmlkZSB0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiBgJHtyZXNvdXJjZXMuYmFzZW5hbWVPckF1dGhvcml0eSh0aGlzLnVyaSl9ICR7dGhpcy5saW5lTnVtYmVyfWA7XG5cdH1cblxuXHRwdWJsaWMgc2V0U2Vzc2lvbkRpZFRyaWdnZXIoc2Vzc2lvbklkOiBzdHJpbmcsIGRpZFRyaWdnZXIgPSB0cnVlKTogdm9pZCB7XG5cdFx0aWYgKGRpZFRyaWdnZXIpIHtcblx0XHRcdHRoaXMuc2Vzc2lvbnNEaWRUcmlnZ2VyID8/PSBuZXcgU2V0KCk7XG5cdFx0XHR0aGlzLnNlc3Npb25zRGlkVHJpZ2dlci5hZGQoc2Vzc2lvbklkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zZXNzaW9uc0RpZFRyaWdnZXI/LmRlbGV0ZShzZXNzaW9uSWQpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXRTZXNzaW9uRGlkVHJpZ2dlcihzZXNzaW9uSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuc2Vzc2lvbnNEaWRUcmlnZ2VyPy5oYXMoc2Vzc2lvbklkKTtcblx0fVxuXG5cdHVwZGF0ZShkYXRhOiBJQnJlYWtwb2ludFVwZGF0ZURhdGEpOiB2b2lkIHtcblx0XHRpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnbGluZU51bWJlcicpICYmICFpc1VuZGVmaW5lZE9yTnVsbChkYXRhLmxpbmVOdW1iZXIpKSB7XG5cdFx0XHR0aGlzLl9saW5lTnVtYmVyID0gZGF0YS5saW5lTnVtYmVyO1xuXHRcdH1cblx0XHRpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY29sdW1uJykpIHtcblx0XHRcdHRoaXMuX2NvbHVtbiA9IGRhdGEuY29sdW1uO1xuXHRcdH1cblx0XHRpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY29uZGl0aW9uJykpIHtcblx0XHRcdHRoaXMuY29uZGl0aW9uID0gZGF0YS5jb25kaXRpb247XG5cdFx0fVxuXHRcdGlmIChkYXRhLmhhc093blByb3BlcnR5KCdoaXRDb25kaXRpb24nKSkge1xuXHRcdFx0dGhpcy5oaXRDb25kaXRpb24gPSBkYXRhLmhpdENvbmRpdGlvbjtcblx0XHR9XG5cdFx0aWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2xvZ01lc3NhZ2UnKSkge1xuXHRcdFx0dGhpcy5sb2dNZXNzYWdlID0gZGF0YS5sb2dNZXNzYWdlO1xuXHRcdH1cblx0XHRpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnbW9kZScpKSB7XG5cdFx0XHR0aGlzLm1vZGUgPSBkYXRhLm1vZGU7XG5cdFx0XHR0aGlzLm1vZGVMYWJlbCA9IGRhdGEubW9kZUxhYmVsO1xuXHRcdH1cblx0XHRpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndHJpZ2dlcmVkQnknKSkge1xuXHRcdFx0dGhpcy50cmlnZ2VyZWRCeSA9IGRhdGEudHJpZ2dlcmVkQnk7XG5cdFx0XHR0aGlzLnNlc3Npb25zRGlkVHJpZ2dlciA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRnVuY3Rpb25CcmVha3BvaW50T3B0aW9ucyBleHRlbmRzIElCYXNlQnJlYWtwb2ludE9wdGlvbnMge1xuXHRuYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBGdW5jdGlvbkJyZWFrcG9pbnQgZXh0ZW5kcyBCYXNlQnJlYWtwb2ludCBpbXBsZW1lbnRzIElGdW5jdGlvbkJyZWFrcG9pbnQge1xuXHRwdWJsaWMgbmFtZTogc3RyaW5nO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdHM6IElGdW5jdGlvbkJyZWFrcG9pbnRPcHRpb25zLFxuXHRcdGlkID0gZ2VuZXJhdGVVdWlkKClcblx0KSB7XG5cdFx0c3VwZXIoaWQsIG9wdHMpO1xuXHRcdHRoaXMubmFtZSA9IG9wdHMubmFtZTtcblx0fVxuXG5cdHRvREFQKCk6IERlYnVnUHJvdG9jb2wuRnVuY3Rpb25CcmVha3BvaW50IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29uZGl0aW9uOiB0aGlzLmNvbmRpdGlvbixcblx0XHRcdGhpdENvbmRpdGlvbjogdGhpcy5oaXRDb25kaXRpb24sXG5cdFx0fTtcblx0fVxuXG5cdG92ZXJyaWRlIHRvSlNPTigpOiBJRnVuY3Rpb25CcmVha3BvaW50T3B0aW9ucyAmIHsgaWQ6IHN0cmluZyB9IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4uc3VwZXIudG9KU09OKCksXG5cdFx0XHRuYW1lOiB0aGlzLm5hbWUsXG5cdFx0fTtcblx0fVxuXG5cdGdldCBzdXBwb3J0ZWQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLmRhdGEpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmRhdGEuc3VwcG9ydHNGdW5jdGlvbkJyZWFrcG9pbnRzO1xuXHR9XG5cblx0b3ZlcnJpZGUgdG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5uYW1lO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSURhdGFCcmVha3BvaW50T3B0aW9ucyBleHRlbmRzIElCYXNlQnJlYWtwb2ludE9wdGlvbnMge1xuXHRkZXNjcmlwdGlvbjogc3RyaW5nO1xuXHRzcmM6IERhdGFCcmVha3BvaW50U291cmNlO1xuXHRjYW5QZXJzaXN0OiBib29sZWFuO1xuXHRpbml0aWFsU2Vzc2lvbkRhdGE/OiB7IHNlc3Npb246IElEZWJ1Z1Nlc3Npb247IGRhdGFJZDogc3RyaW5nIH07XG5cdGFjY2Vzc1R5cGVzOiBEZWJ1Z1Byb3RvY29sLkRhdGFCcmVha3BvaW50QWNjZXNzVHlwZVtdIHwgdW5kZWZpbmVkO1xuXHRhY2Nlc3NUeXBlOiBEZWJ1Z1Byb3RvY29sLkRhdGFCcmVha3BvaW50QWNjZXNzVHlwZTtcbn1cblxuZXhwb3J0IGNsYXNzIERhdGFCcmVha3BvaW50IGV4dGVuZHMgQmFzZUJyZWFrcG9pbnQgaW1wbGVtZW50cyBJRGF0YUJyZWFrcG9pbnQge1xuXHRwcml2YXRlIHJlYWRvbmx5IHNlc3Npb25EYXRhSWRGb3JBZGRyID0gbmV3IFdlYWtNYXA8SURlYnVnU2Vzc2lvbiwgc3RyaW5nIHwgbnVsbD4oKTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgZGVzY3JpcHRpb246IHN0cmluZztcblx0cHVibGljIHJlYWRvbmx5IHNyYzogRGF0YUJyZWFrcG9pbnRTb3VyY2U7XG5cdHB1YmxpYyByZWFkb25seSBjYW5QZXJzaXN0OiBib29sZWFuO1xuXHRwdWJsaWMgcmVhZG9ubHkgYWNjZXNzVHlwZXM6IERlYnVnUHJvdG9jb2wuRGF0YUJyZWFrcG9pbnRBY2Nlc3NUeXBlW10gfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyByZWFkb25seSBhY2Nlc3NUeXBlOiBEZWJ1Z1Byb3RvY29sLkRhdGFCcmVha3BvaW50QWNjZXNzVHlwZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRvcHRzOiBJRGF0YUJyZWFrcG9pbnRPcHRpb25zLFxuXHRcdGlkID0gZ2VuZXJhdGVVdWlkKClcblx0KSB7XG5cdFx0c3VwZXIoaWQsIG9wdHMpO1xuXHRcdHRoaXMuZGVzY3JpcHRpb24gPSBvcHRzLmRlc2NyaXB0aW9uO1xuXHRcdGlmICgnZGF0YUlkJyBpbiBvcHRzKSB7IC8vICBiYWNrIGNvbXBhdCB3aXRoIG9sZCBzYXZlZCB2YXJpYWJsZXMgaW4gMS44N1xuXHRcdFx0b3B0cy5zcmMgPSB7IHR5cGU6IERhdGFCcmVha3BvaW50U2V0VHlwZS5WYXJpYWJsZSwgZGF0YUlkOiBvcHRzLmRhdGFJZCBhcyBzdHJpbmcgfTtcblx0XHR9XG5cdFx0dGhpcy5zcmMgPSBvcHRzLnNyYztcblx0XHR0aGlzLmNhblBlcnNpc3QgPSBvcHRzLmNhblBlcnNpc3Q7XG5cdFx0dGhpcy5hY2Nlc3NUeXBlcyA9IG9wdHMuYWNjZXNzVHlwZXM7XG5cdFx0dGhpcy5hY2Nlc3NUeXBlID0gb3B0cy5hY2Nlc3NUeXBlO1xuXHRcdGlmIChvcHRzLmluaXRpYWxTZXNzaW9uRGF0YSkge1xuXHRcdFx0dGhpcy5zZXNzaW9uRGF0YUlkRm9yQWRkci5zZXQob3B0cy5pbml0aWFsU2Vzc2lvbkRhdGEuc2Vzc2lvbiwgb3B0cy5pbml0aWFsU2Vzc2lvbkRhdGEuZGF0YUlkKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyB0b0RBUChzZXNzaW9uOiBJRGVidWdTZXNzaW9uKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLkRhdGFCcmVha3BvaW50IHwgdW5kZWZpbmVkPiB7XG5cdFx0bGV0IGRhdGFJZDogc3RyaW5nO1xuXHRcdGlmICh0aGlzLnNyYy50eXBlID09PSBEYXRhQnJlYWtwb2ludFNldFR5cGUuVmFyaWFibGUpIHtcblx0XHRcdGRhdGFJZCA9IHRoaXMuc3JjLmRhdGFJZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGV0IHNlc3Npb25EYXRhSWQgPSB0aGlzLnNlc3Npb25EYXRhSWRGb3JBZGRyLmdldChzZXNzaW9uKTtcblx0XHRcdGlmICghc2Vzc2lvbkRhdGFJZCkge1xuXHRcdFx0XHRzZXNzaW9uRGF0YUlkID0gKGF3YWl0IHNlc3Npb24uZGF0YUJ5dGVzQnJlYWtwb2ludEluZm8odGhpcy5zcmMuYWRkcmVzcywgdGhpcy5zcmMuYnl0ZXMpKT8uZGF0YUlkO1xuXHRcdFx0XHRpZiAoIXNlc3Npb25EYXRhSWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuc2Vzc2lvbkRhdGFJZEZvckFkZHIuc2V0KHNlc3Npb24sIHNlc3Npb25EYXRhSWQpO1xuXHRcdFx0fVxuXHRcdFx0ZGF0YUlkID0gc2Vzc2lvbkRhdGFJZDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGF0YUlkLFxuXHRcdFx0YWNjZXNzVHlwZTogdGhpcy5hY2Nlc3NUeXBlLFxuXHRcdFx0Y29uZGl0aW9uOiB0aGlzLmNvbmRpdGlvbixcblx0XHRcdGhpdENvbmRpdGlvbjogdGhpcy5oaXRDb25kaXRpb24sXG5cdFx0fTtcblx0fVxuXG5cdG92ZXJyaWRlIHRvSlNPTigpOiBJRGF0YUJyZWFrcG9pbnRPcHRpb25zICYgeyBpZDogc3RyaW5nIH0ge1xuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5zdXBlci50b0pTT04oKSxcblx0XHRcdGRlc2NyaXB0aW9uOiB0aGlzLmRlc2NyaXB0aW9uLFxuXHRcdFx0c3JjOiB0aGlzLnNyYyxcblx0XHRcdGFjY2Vzc1R5cGVzOiB0aGlzLmFjY2Vzc1R5cGVzLFxuXHRcdFx0YWNjZXNzVHlwZTogdGhpcy5hY2Nlc3NUeXBlLFxuXHRcdFx0Y2FuUGVyc2lzdDogdGhpcy5jYW5QZXJzaXN0LFxuXHRcdH07XG5cdH1cblxuXHRnZXQgc3VwcG9ydGVkKCk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5kYXRhKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5kYXRhLnN1cHBvcnRzRGF0YUJyZWFrcG9pbnRzO1xuXHR9XG5cblx0b3ZlcnJpZGUgdG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5kZXNjcmlwdGlvbjtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElFeGNlcHRpb25CcmVha3BvaW50T3B0aW9ucyBleHRlbmRzIElCYXNlQnJlYWtwb2ludE9wdGlvbnMge1xuXHRmaWx0ZXI6IHN0cmluZztcblx0bGFiZWw6IHN0cmluZztcblx0c3VwcG9ydHNDb25kaXRpb246IGJvb2xlYW47XG5cdGRlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGNvbmRpdGlvbkRlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGZhbGxiYWNrPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIEV4Y2VwdGlvbkJyZWFrcG9pbnQgZXh0ZW5kcyBCYXNlQnJlYWtwb2ludCBpbXBsZW1lbnRzIElFeGNlcHRpb25CcmVha3BvaW50IHtcblxuXHRwcml2YXRlIHN1cHBvcnRlZFNlc3Npb25zOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgZmlsdGVyOiBzdHJpbmc7XG5cdHB1YmxpYyByZWFkb25seSBsYWJlbDogc3RyaW5nO1xuXHRwdWJsaWMgcmVhZG9ubHkgc3VwcG9ydHNDb25kaXRpb246IGJvb2xlYW47XG5cdHB1YmxpYyByZWFkb25seSBkZXNjcmlwdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwdWJsaWMgcmVhZG9ubHkgY29uZGl0aW9uRGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBmYWxsYmFjazogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdHM6IElFeGNlcHRpb25CcmVha3BvaW50T3B0aW9ucyxcblx0XHRpZCA9IGdlbmVyYXRlVXVpZCgpLFxuXHQpIHtcblx0XHRzdXBlcihpZCwgb3B0cyk7XG5cdFx0dGhpcy5maWx0ZXIgPSBvcHRzLmZpbHRlcjtcblx0XHR0aGlzLmxhYmVsID0gb3B0cy5sYWJlbDtcblx0XHR0aGlzLnN1cHBvcnRzQ29uZGl0aW9uID0gb3B0cy5zdXBwb3J0c0NvbmRpdGlvbjtcblx0XHR0aGlzLmRlc2NyaXB0aW9uID0gb3B0cy5kZXNjcmlwdGlvbjtcblx0XHR0aGlzLmNvbmRpdGlvbkRlc2NyaXB0aW9uID0gb3B0cy5jb25kaXRpb25EZXNjcmlwdGlvbjtcblx0XHR0aGlzLmZhbGxiYWNrID0gb3B0cy5mYWxsYmFjayB8fCBmYWxzZTtcblx0fVxuXG5cdG92ZXJyaWRlIHRvSlNPTigpOiBJRXhjZXB0aW9uQnJlYWtwb2ludE9wdGlvbnMgJiB7IGlkOiBzdHJpbmcgfSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdC4uLnN1cGVyLnRvSlNPTigpLFxuXHRcdFx0ZmlsdGVyOiB0aGlzLmZpbHRlcixcblx0XHRcdGxhYmVsOiB0aGlzLmxhYmVsLFxuXHRcdFx0ZW5hYmxlZDogdGhpcy5lbmFibGVkLFxuXHRcdFx0c3VwcG9ydHNDb25kaXRpb246IHRoaXMuc3VwcG9ydHNDb25kaXRpb24sXG5cdFx0XHRjb25kaXRpb25EZXNjcmlwdGlvbjogdGhpcy5jb25kaXRpb25EZXNjcmlwdGlvbixcblx0XHRcdGNvbmRpdGlvbjogdGhpcy5jb25kaXRpb24sXG5cdFx0XHRmYWxsYmFjazogdGhpcy5mYWxsYmFjayxcblx0XHRcdGRlc2NyaXB0aW9uOiB0aGlzLmRlc2NyaXB0aW9uLFxuXHRcdH07XG5cdH1cblxuXHRzZXRTdXBwb3J0ZWRTZXNzaW9uKHNlc3Npb25JZDogc3RyaW5nLCBzdXBwb3J0ZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoc3VwcG9ydGVkKSB7XG5cdFx0XHR0aGlzLnN1cHBvcnRlZFNlc3Npb25zLmFkZChzZXNzaW9uSWQpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRoaXMuc3VwcG9ydGVkU2Vzc2lvbnMuZGVsZXRlKHNlc3Npb25JZCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFVzZWQgdG8gc3BlY2lmeSB3aGljaCBicmVha3BvaW50cyB0byBzaG93IHdoZW4gbm8gc2Vzc2lvbiBpcyBzcGVjaWZpZWQuXG5cdCAqIFVzZWZ1bCB3aGVuIG5vIHNlc3Npb24gaXMgYWN0aXZlIGFuZCB3ZSB3YW50IHRvIHNob3cgdGhlIGV4Y2VwdGlvbiBicmVha3BvaW50cyBmcm9tIHRoZSBsYXN0IHNlc3Npb24uXG5cdCAqL1xuXHRzZXRGYWxsYmFjayhpc0ZhbGxiYWNrOiBib29sZWFuKSB7XG5cdFx0dGhpcy5mYWxsYmFjayA9IGlzRmFsbGJhY2s7XG5cdH1cblxuXHRnZXQgc3VwcG9ydGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIENoZWNrcyBpZiB0aGUgYnJlYWtwb2ludCBpcyBhcHBsaWNhYmxlIGZvciB0aGUgc3BlY2lmaWVkIHNlc3Npb24uXG5cdCAqIElmIHNlc3Npb25JZCBpcyB1bmRlZmluZWQsIHJldHVybnMgdHJ1ZSBpZiB0aGlzIGJyZWFrcG9pbnQgaXMgYSBmYWxsYmFjayBicmVha3BvaW50LlxuXHQgKi9cblx0aXNTdXBwb3J0ZWRTZXNzaW9uKHNlc3Npb25JZD86IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBzZXNzaW9uSWQgPyB0aGlzLnN1cHBvcnRlZFNlc3Npb25zLmhhcyhzZXNzaW9uSWQpIDogdGhpcy5mYWxsYmFjaztcblx0fVxuXG5cdG1hdGNoZXMoZmlsdGVyOiBEZWJ1Z1Byb3RvY29sLkV4Y2VwdGlvbkJyZWFrcG9pbnRzRmlsdGVyKSB7XG5cdFx0cmV0dXJuIHRoaXMuZmlsdGVyID09PSBmaWx0ZXIuZmlsdGVyXG5cdFx0XHQmJiB0aGlzLmxhYmVsID09PSBmaWx0ZXIubGFiZWxcblx0XHRcdCYmIHRoaXMuc3VwcG9ydHNDb25kaXRpb24gPT09ICEhZmlsdGVyLnN1cHBvcnRzQ29uZGl0aW9uXG5cdFx0XHQmJiB0aGlzLmNvbmRpdGlvbkRlc2NyaXB0aW9uID09PSBmaWx0ZXIuY29uZGl0aW9uRGVzY3JpcHRpb25cblx0XHRcdCYmIHRoaXMuZGVzY3JpcHRpb24gPT09IGZpbHRlci5kZXNjcmlwdGlvbjtcblx0fVxuXG5cdG92ZXJyaWRlIHRvU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMubGFiZWw7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJSW5zdHJ1Y3Rpb25CcmVha3BvaW50T3B0aW9ucyBleHRlbmRzIElCYXNlQnJlYWtwb2ludE9wdGlvbnMge1xuXHRpbnN0cnVjdGlvblJlZmVyZW5jZTogc3RyaW5nO1xuXHRvZmZzZXQ6IG51bWJlcjtcblx0Y2FuUGVyc2lzdDogYm9vbGVhbjtcblx0YWRkcmVzczogYmlnaW50O1xufVxuXG5leHBvcnQgY2xhc3MgSW5zdHJ1Y3Rpb25CcmVha3BvaW50IGV4dGVuZHMgQmFzZUJyZWFrcG9pbnQgaW1wbGVtZW50cyBJSW5zdHJ1Y3Rpb25CcmVha3BvaW50IHtcblx0cHVibGljIHJlYWRvbmx5IGluc3RydWN0aW9uUmVmZXJlbmNlOiBzdHJpbmc7XG5cdHB1YmxpYyByZWFkb25seSBvZmZzZXQ6IG51bWJlcjtcblx0cHVibGljIHJlYWRvbmx5IGNhblBlcnNpc3Q6IGJvb2xlYW47XG5cdHB1YmxpYyByZWFkb25seSBhZGRyZXNzOiBiaWdpbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0czogSUluc3RydWN0aW9uQnJlYWtwb2ludE9wdGlvbnMsXG5cdFx0aWQgPSBnZW5lcmF0ZVV1aWQoKVxuXHQpIHtcblx0XHRzdXBlcihpZCwgb3B0cyk7XG5cdFx0dGhpcy5pbnN0cnVjdGlvblJlZmVyZW5jZSA9IG9wdHMuaW5zdHJ1Y3Rpb25SZWZlcmVuY2U7XG5cdFx0dGhpcy5vZmZzZXQgPSBvcHRzLm9mZnNldDtcblx0XHR0aGlzLmNhblBlcnNpc3QgPSBvcHRzLmNhblBlcnNpc3Q7XG5cdFx0dGhpcy5hZGRyZXNzID0gb3B0cy5hZGRyZXNzO1xuXHR9XG5cblx0dG9EQVAoKTogRGVidWdQcm90b2NvbC5JbnN0cnVjdGlvbkJyZWFrcG9pbnQge1xuXHRcdHJldHVybiB7XG5cdFx0XHRpbnN0cnVjdGlvblJlZmVyZW5jZTogdGhpcy5pbnN0cnVjdGlvblJlZmVyZW5jZSxcblx0XHRcdGNvbmRpdGlvbjogdGhpcy5jb25kaXRpb24sXG5cdFx0XHRoaXRDb25kaXRpb246IHRoaXMuaGl0Q29uZGl0aW9uLFxuXHRcdFx0bW9kZTogdGhpcy5tb2RlLFxuXHRcdFx0b2Zmc2V0OiB0aGlzLm9mZnNldCxcblx0XHR9O1xuXHR9XG5cblx0b3ZlcnJpZGUgdG9KU09OKCk6IElJbnN0cnVjdGlvbkJyZWFrcG9pbnRPcHRpb25zICYgeyBpZDogc3RyaW5nIH0ge1xuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5zdXBlci50b0pTT04oKSxcblx0XHRcdGluc3RydWN0aW9uUmVmZXJlbmNlOiB0aGlzLmluc3RydWN0aW9uUmVmZXJlbmNlLFxuXHRcdFx0b2Zmc2V0OiB0aGlzLm9mZnNldCxcblx0XHRcdGNhblBlcnNpc3Q6IHRoaXMuY2FuUGVyc2lzdCxcblx0XHRcdGFkZHJlc3M6IHRoaXMuYWRkcmVzcyxcblx0XHR9O1xuXHR9XG5cblx0Z2V0IHN1cHBvcnRlZCgpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuZGF0YSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZGF0YS5zdXBwb3J0c0luc3RydWN0aW9uQnJlYWtwb2ludHM7XG5cdH1cblxuXHRvdmVycmlkZSB0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmluc3RydWN0aW9uUmVmZXJlbmNlO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUaHJlYWRBbmRTZXNzaW9uSWRzIGltcGxlbWVudHMgSVRyZWVFbGVtZW50IHtcblx0Y29uc3RydWN0b3IocHVibGljIHNlc3Npb25JZDogc3RyaW5nLCBwdWJsaWMgdGhyZWFkSWQ6IG51bWJlcikgeyB9XG5cblx0Z2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYCR7dGhpcy5zZXNzaW9uSWR9OiR7dGhpcy50aHJlYWRJZH1gO1xuXHR9XG59XG5cbmludGVyZmFjZSBJQnJlYWtwb2ludE1vZGVJbnRlcm5hbCBleHRlbmRzIERlYnVnUHJvdG9jb2wuQnJlYWtwb2ludE1vZGUge1xuXHRmaXJzdEZyb21EZWJ1Z1R5cGU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIERlYnVnTW9kZWwgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSURlYnVnTW9kZWwge1xuXG5cdHByaXZhdGUgc2Vzc2lvbnM6IElEZWJ1Z1Nlc3Npb25bXTtcblx0cHJpdmF0ZSBzY2hlZHVsZXJzID0gbmV3IE1hcDxzdHJpbmcsIHsgc2NoZWR1bGVyOiBSdW5PbmNlU2NoZWR1bGVyOyBjb21wbGV0ZURlZmVycmVkOiBEZWZlcnJlZFByb21pc2U8dm9pZD4gfT4oKTtcblx0cHJpdmF0ZSBicmVha3BvaW50c0FjdGl2YXRlZCA9IHRydWU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQnJlYWtwb2ludHMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJQnJlYWtwb2ludHNDaGFuZ2VFdmVudCB8IHVuZGVmaW5lZD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ2FsbFN0YWNrID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlV2F0Y2hFeHByZXNzaW9ucyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElFeHByZXNzaW9uIHwgdW5kZWZpbmVkPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VXYXRjaEV4cHJlc3Npb25WYWx1ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElFeHByZXNzaW9uIHwgdW5kZWZpbmVkPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfYnJlYWtwb2ludE1vZGVzID0gbmV3IE1hcDxzdHJpbmcsIElCcmVha3BvaW50TW9kZUludGVybmFsPigpO1xuXHRwcml2YXRlIGJyZWFrcG9pbnRzITogQnJlYWtwb2ludFtdO1xuXHRwcml2YXRlIGZ1bmN0aW9uQnJlYWtwb2ludHMhOiBGdW5jdGlvbkJyZWFrcG9pbnRbXTtcblx0cHJpdmF0ZSBleGNlcHRpb25CcmVha3BvaW50cyE6IEV4Y2VwdGlvbkJyZWFrcG9pbnRbXTtcblx0cHJpdmF0ZSBkYXRhQnJlYWtwb2ludHMhOiBEYXRhQnJlYWtwb2ludFtdO1xuXHRwcml2YXRlIHdhdGNoRXhwcmVzc2lvbnMhOiBFeHByZXNzaW9uW107XG5cdHByaXZhdGUgaW5zdHJ1Y3Rpb25CcmVha3BvaW50czogSW5zdHJ1Y3Rpb25CcmVha3BvaW50W107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZGVidWdTdG9yYWdlOiBEZWJ1Z1N0b3JhZ2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0RmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdHRoaXMuYnJlYWtwb2ludHMgPSBkZWJ1Z1N0b3JhZ2UuYnJlYWtwb2ludHMucmVhZChyZWFkZXIpO1xuXHRcdFx0dGhpcy5mdW5jdGlvbkJyZWFrcG9pbnRzID0gZGVidWdTdG9yYWdlLmZ1bmN0aW9uQnJlYWtwb2ludHMucmVhZChyZWFkZXIpO1xuXHRcdFx0dGhpcy5leGNlcHRpb25CcmVha3BvaW50cyA9IGRlYnVnU3RvcmFnZS5leGNlcHRpb25CcmVha3BvaW50cy5yZWFkKHJlYWRlcik7XG5cdFx0XHR0aGlzLmRhdGFCcmVha3BvaW50cyA9IGRlYnVnU3RvcmFnZS5kYXRhQnJlYWtwb2ludHMucmVhZChyZWFkZXIpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VCcmVha3BvaW50cy5maXJlKHVuZGVmaW5lZCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0dGhpcy53YXRjaEV4cHJlc3Npb25zID0gZGVidWdTdG9yYWdlLndhdGNoRXhwcmVzc2lvbnMucmVhZChyZWFkZXIpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VXYXRjaEV4cHJlc3Npb25zLmZpcmUodW5kZWZpbmVkKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0cmFja1NldENoYW5nZXMoXG5cdFx0XHQoKSA9PiBuZXcgU2V0KHRoaXMud2F0Y2hFeHByZXNzaW9ucyksXG5cdFx0XHR0aGlzLm9uRGlkQ2hhbmdlV2F0Y2hFeHByZXNzaW9ucyxcblx0XHRcdCh3ZSkgPT4gd2Uub25EaWRDaGFuZ2VWYWx1ZSgoZSkgPT4gdGhpcy5fb25EaWRDaGFuZ2VXYXRjaEV4cHJlc3Npb25WYWx1ZS5maXJlKGUpKSlcblx0XHQpO1xuXG5cdFx0dGhpcy5pbnN0cnVjdGlvbkJyZWFrcG9pbnRzID0gW107XG5cdFx0dGhpcy5zZXNzaW9ucyA9IFtdO1xuXHR9XG5cblx0Z2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gJ3Jvb3QnO1xuXHR9XG5cblx0Z2V0U2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgaW5jbHVkZUluYWN0aXZlID0gZmFsc2UpOiBJRGVidWdTZXNzaW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoc2Vzc2lvbklkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRTZXNzaW9ucyhpbmNsdWRlSW5hY3RpdmUpLmZpbmQocyA9PiBzLmdldElkKCkgPT09IHNlc3Npb25JZCk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXRTZXNzaW9ucyhpbmNsdWRlSW5hY3RpdmUgPSBmYWxzZSk6IElEZWJ1Z1Nlc3Npb25bXSB7XG5cdFx0Ly8gQnkgZGVmYXVsdCBkbyBub3QgcmV0dXJuIGluYWN0aXZlIHNlc3Npb25zLlxuXHRcdC8vIEhvd2V2ZXIgd2UgYXJlIHN0aWxsIGhvbGRpbmcgb250byBpbmFjdGl2ZSBzZXNzaW9ucyBkdWUgdG8gcmVwbCBhbmQgZGVidWcgc2VydmljZSBzZXNzaW9uIHJldml2YWwgKGVoIHNjZW5hcmlvKVxuXHRcdHJldHVybiB0aGlzLnNlc3Npb25zLmZpbHRlcihzID0+IGluY2x1ZGVJbmFjdGl2ZSB8fCBzLnN0YXRlICE9PSBTdGF0ZS5JbmFjdGl2ZSk7XG5cdH1cblxuXHRhZGRTZXNzaW9uKHNlc3Npb246IElEZWJ1Z1Nlc3Npb24pOiB2b2lkIHtcblx0XHR0aGlzLnNlc3Npb25zID0gdGhpcy5zZXNzaW9ucy5maWx0ZXIocyA9PiB7XG5cdFx0XHRpZiAocy5nZXRJZCgpID09PSBzZXNzaW9uLmdldElkKCkpIHtcblx0XHRcdFx0Ly8gTWFrZSBzdXJlIHRvIGRlLWR1cGUgaWYgYSBzZXNzaW9uIGlzIHJlLWluaXRpYWxpemVkLiBJbiBjYXNlIG9mIEVIIGRlYnVnZ2luZyB3ZSBhcmUgYWRkaW5nIGEgc2Vzc2lvbiBhZ2FpbiBhZnRlciBhbiBhdHRhY2guXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmIChzLnN0YXRlID09PSBTdGF0ZS5JbmFjdGl2ZSAmJiBzLmNvbmZpZ3VyYXRpb24ubmFtZSA9PT0gc2Vzc2lvbi5jb25maWd1cmF0aW9uLm5hbWUpIHtcblx0XHRcdFx0Ly8gTWFrZSBzdXJlIHRvIHJlbW92ZSBhbGwgaW5hY3RpdmUgc2Vzc2lvbnMgdGhhdCBhcmUgdXNpbmcgdGhlIHNhbWUgY29uZmlndXJhdGlvbiBhcyB0aGUgbmV3IHNlc3Npb25cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9KTtcblxuXHRcdGxldCBpID0gMTtcblx0XHR3aGlsZSAodGhpcy5zZXNzaW9ucy5zb21lKHMgPT4gcy5nZXRMYWJlbCgpID09PSBzZXNzaW9uLmdldExhYmVsKCkpKSB7XG5cdFx0XHRzZXNzaW9uLnNldE5hbWUoYCR7c2Vzc2lvbi5jb25maWd1cmF0aW9uLm5hbWV9ICR7KytpfWApO1xuXHRcdH1cblxuXHRcdGxldCBpbmRleCA9IC0xO1xuXHRcdGlmIChzZXNzaW9uLnBhcmVudFNlc3Npb24pIHtcblx0XHRcdC8vIE1ha2Ugc3VyZSB0aGF0IGNoaWxkIHNlc3Npb25zIGFyZSBwbGFjZWQgYWZ0ZXIgdGhlIHBhcmVudCBzZXNzaW9uXG5cdFx0XHRpbmRleCA9IGZpbmRMYXN0SWR4KHRoaXMuc2Vzc2lvbnMsIHMgPT4gcy5wYXJlbnRTZXNzaW9uID09PSBzZXNzaW9uLnBhcmVudFNlc3Npb24gfHwgcyA9PT0gc2Vzc2lvbi5wYXJlbnRTZXNzaW9uKTtcblx0XHR9XG5cdFx0aWYgKGluZGV4ID49IDApIHtcblx0XHRcdHRoaXMuc2Vzc2lvbnMuc3BsaWNlKGluZGV4ICsgMSwgMCwgc2Vzc2lvbik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc2Vzc2lvbnMucHVzaChzZXNzaW9uKTtcblx0XHR9XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDYWxsU3RhY2suZmlyZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0Z2V0IG9uRGlkQ2hhbmdlQnJlYWtwb2ludHMoKTogRXZlbnQ8SUJyZWFrcG9pbnRzQ2hhbmdlRXZlbnQgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VCcmVha3BvaW50cy5ldmVudDtcblx0fVxuXG5cdGdldCBvbkRpZENoYW5nZUNhbGxTdGFjaygpOiBFdmVudDx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX29uRGlkQ2hhbmdlQ2FsbFN0YWNrLmV2ZW50O1xuXHR9XG5cblx0Z2V0IG9uRGlkQ2hhbmdlV2F0Y2hFeHByZXNzaW9ucygpOiBFdmVudDxJRXhwcmVzc2lvbiB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZENoYW5nZVdhdGNoRXhwcmVzc2lvbnMuZXZlbnQ7XG5cdH1cblxuXHRnZXQgb25EaWRDaGFuZ2VXYXRjaEV4cHJlc3Npb25WYWx1ZSgpOiBFdmVudDxJRXhwcmVzc2lvbiB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZENoYW5nZVdhdGNoRXhwcmVzc2lvblZhbHVlLmV2ZW50O1xuXHR9XG5cblx0cmF3VXBkYXRlKGRhdGE6IElSYXdNb2RlbFVwZGF0ZSk6IHZvaWQge1xuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLnNlc3Npb25zLmZpbmQocCA9PiBwLmdldElkKCkgPT09IGRhdGEuc2Vzc2lvbklkKTtcblx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0c2Vzc2lvbi5yYXdVcGRhdGUoZGF0YSk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNhbGxTdGFjay5maXJlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0Y2xlYXJUaHJlYWRzKGlkOiBzdHJpbmcsIHJlbW92ZVRocmVhZHM6IGJvb2xlYW4sIHJlZmVyZW5jZTogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuc2Vzc2lvbnMuZmluZChwID0+IHAuZ2V0SWQoKSA9PT0gaWQpO1xuXHRcdHRoaXMuc2NoZWR1bGVycy5mb3JFYWNoKGVudHJ5ID0+IHtcblx0XHRcdGVudHJ5LnNjaGVkdWxlci5kaXNwb3NlKCk7XG5cdFx0XHRlbnRyeS5jb21wbGV0ZURlZmVycmVkLmNvbXBsZXRlKCk7XG5cdFx0fSk7XG5cdFx0dGhpcy5zY2hlZHVsZXJzLmNsZWFyKCk7XG5cblx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0c2Vzc2lvbi5jbGVhclRocmVhZHMocmVtb3ZlVGhyZWFkcywgcmVmZXJlbmNlKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ2FsbFN0YWNrLmZpcmUodW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogVXBkYXRlIHRoZSBjYWxsIHN0YWNrIGFuZCBub3RpZnkgdGhlIGNhbGwgc3RhY2sgdmlldyB0aGF0IGNoYW5nZXMgaGF2ZSBvY2N1cnJlZC5cblx0ICovXG5cdGFzeW5jIGZldGNoQ2FsbHN0YWNrKHRocmVhZDogSVRocmVhZCwgbGV2ZWxzPzogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHRpZiAoKDxUaHJlYWQ+dGhyZWFkKS5yZWFjaGVkRW5kT2ZDYWxsU3RhY2spIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB0b3RhbEZyYW1lcyA9IHRocmVhZC5zdG9wcGVkRGV0YWlscz8udG90YWxGcmFtZXM7XG5cdFx0Y29uc3QgcmVtYWluaW5nRnJhbWVzID0gKHR5cGVvZiB0b3RhbEZyYW1lcyA9PT0gJ251bWJlcicpID8gKHRvdGFsRnJhbWVzIC0gdGhyZWFkLmdldENhbGxTdGFjaygpLmxlbmd0aCkgOiB1bmRlZmluZWQ7XG5cblx0XHRpZiAoIWxldmVscyB8fCAocmVtYWluaW5nRnJhbWVzICYmIGxldmVscyA+IHJlbWFpbmluZ0ZyYW1lcykpIHtcblx0XHRcdGxldmVscyA9IHJlbWFpbmluZ0ZyYW1lcztcblx0XHR9XG5cblx0XHRpZiAobGV2ZWxzICYmIGxldmVscyA+IDApIHtcblx0XHRcdGF3YWl0ICg8VGhyZWFkPnRocmVhZCkuZmV0Y2hDYWxsU3RhY2sobGV2ZWxzKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ2FsbFN0YWNrLmZpcmUoKTtcblx0XHR9XG5cblx0XHRyZXR1cm47XG5cdH1cblxuXHRyZWZyZXNoVG9wT2ZDYWxsc3RhY2sodGhyZWFkOiBUaHJlYWQsIGZldGNoRnVsbFN0YWNrID0gdHJ1ZSk6IHsgdG9wQ2FsbFN0YWNrOiBQcm9taXNlPHZvaWQ+OyB3aG9sZUNhbGxTdGFjazogUHJvbWlzZTx2b2lkPiB9IHtcblx0XHRpZiAodGhyZWFkLnNlc3Npb24uY2FwYWJpbGl0aWVzLnN1cHBvcnRzRGVsYXllZFN0YWNrVHJhY2VMb2FkaW5nKSB7XG5cdFx0XHQvLyBGb3IgaW1wcm92ZWQgcGVyZm9ybWFuY2UgbG9hZCB0aGUgZmlyc3Qgc3RhY2sgZnJhbWUgYW5kIHRoZW4gbG9hZCB0aGUgcmVzdCBhc3luYy5cblx0XHRcdGxldCB0b3BDYWxsU3RhY2sgPSBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdGNvbnN0IHdob2xlQ2FsbFN0YWNrID0gbmV3IFByb21pc2U8dm9pZD4oKGMsIGUpID0+IHtcblx0XHRcdFx0dG9wQ2FsbFN0YWNrID0gdGhyZWFkLmZldGNoQ2FsbFN0YWNrKDEpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRcdGlmICghZmV0Y2hGdWxsU3RhY2spIHtcblx0XHRcdFx0XHRcdGMoKTtcblx0XHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ2FsbFN0YWNrLmZpcmUoKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoIXRoaXMuc2NoZWR1bGVycy5oYXModGhyZWFkLmdldElkKCkpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0XHRcdFx0XHRcdHRoaXMuc2NoZWR1bGVycy5zZXQodGhyZWFkLmdldElkKCksIHtcblx0XHRcdFx0XHRcdFx0Y29tcGxldGVEZWZlcnJlZDogZGVmZXJyZWQsXG5cdFx0XHRcdFx0XHRcdHNjaGVkdWxlcjogbmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdHRocmVhZC5mZXRjaENhbGxTdGFjaygxOSkudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBzdGFsZSA9IHRocmVhZC5nZXRTdGFsZUNhbGxTdGFjaygpO1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgY3VycmVudCA9IHRocmVhZC5nZXRDYWxsU3RhY2soKTtcblx0XHRcdFx0XHRcdFx0XHRcdGxldCBib3R0b21PZkNhbGxTdGFja0NoYW5nZWQgPSBzdGFsZS5sZW5ndGggIT09IGN1cnJlbnQubGVuZ3RoO1xuXHRcdFx0XHRcdFx0XHRcdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCBzdGFsZS5sZW5ndGggJiYgIWJvdHRvbU9mQ2FsbFN0YWNrQ2hhbmdlZDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGJvdHRvbU9mQ2FsbFN0YWNrQ2hhbmdlZCA9ICFzdGFsZVtpXS5lcXVhbHMoY3VycmVudFtpXSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHRcdGlmIChib3R0b21PZkNhbGxTdGFja0NoYW5nZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDYWxsU3RhY2suZmlyZSgpO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH0pLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZGVmZXJyZWQuY29tcGxldGUoKTtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMuc2NoZWR1bGVycy5kZWxldGUodGhyZWFkLmdldElkKCkpO1xuXHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHR9LCA0MjApXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBlbnRyeSA9IHRoaXMuc2NoZWR1bGVycy5nZXQodGhyZWFkLmdldElkKCkpITtcblx0XHRcdFx0XHRlbnRyeS5zY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdFx0XHRlbnRyeS5jb21wbGV0ZURlZmVycmVkLnAudGhlbihjLCBlKTtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNhbGxTdGFjay5maXJlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHJldHVybiB7IHRvcENhbGxTdGFjaywgd2hvbGVDYWxsU3RhY2sgfTtcblx0XHR9XG5cblx0XHRjb25zdCB3aG9sZUNhbGxTdGFjayA9IHRocmVhZC5mZXRjaENhbGxTdGFjaygpO1xuXHRcdHJldHVybiB7IHdob2xlQ2FsbFN0YWNrLCB0b3BDYWxsU3RhY2s6IHdob2xlQ2FsbFN0YWNrIH07XG5cdH1cblxuXHRnZXRCcmVha3BvaW50cyhmaWx0ZXI/OiB7IHVyaT86IHVyaTsgb3JpZ2luYWxVcmk/OiB1cmk7IGxpbmVOdW1iZXI/OiBudW1iZXI7IGNvbHVtbj86IG51bWJlcjsgZW5hYmxlZE9ubHk/OiBib29sZWFuOyB0cmlnZ2VyZWRPbmx5PzogYm9vbGVhbiB9KTogSUJyZWFrcG9pbnRbXSB7XG5cdFx0aWYgKGZpbHRlcikge1xuXHRcdFx0Y29uc3QgdXJpU3RyID0gZmlsdGVyLnVyaT8udG9TdHJpbmcoKTtcblx0XHRcdGNvbnN0IG9yaWdpbmFsVXJpU3RyID0gZmlsdGVyLm9yaWdpbmFsVXJpPy50b1N0cmluZygpO1xuXHRcdFx0cmV0dXJuIHRoaXMuYnJlYWtwb2ludHMuZmlsdGVyKGJwID0+IHtcblx0XHRcdFx0aWYgKHVyaVN0ciAmJiBicC51cmkudG9TdHJpbmcoKSAhPT0gdXJpU3RyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChvcmlnaW5hbFVyaVN0ciAmJiBicC5vcmlnaW5hbFVyaS50b1N0cmluZygpICE9PSBvcmlnaW5hbFVyaVN0cikge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZmlsdGVyLmxpbmVOdW1iZXIgJiYgYnAubGluZU51bWJlciAhPT0gZmlsdGVyLmxpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGZpbHRlci5jb2x1bW4gJiYgYnAuY29sdW1uICE9PSBmaWx0ZXIuY29sdW1uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChmaWx0ZXIuZW5hYmxlZE9ubHkgJiYgKCF0aGlzLmJyZWFrcG9pbnRzQWN0aXZhdGVkIHx8ICFicC5lbmFibGVkKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZmlsdGVyLnRyaWdnZXJlZE9ubHkgJiYgYnAudHJpZ2dlcmVkQnkgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuYnJlYWtwb2ludHM7XG5cdH1cblxuXHRnZXRGdW5jdGlvbkJyZWFrcG9pbnRzKCk6IElGdW5jdGlvbkJyZWFrcG9pbnRbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZnVuY3Rpb25CcmVha3BvaW50cztcblx0fVxuXG5cdGdldERhdGFCcmVha3BvaW50cygpOiBJRGF0YUJyZWFrcG9pbnRbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZGF0YUJyZWFrcG9pbnRzO1xuXHR9XG5cblx0Z2V0RXhjZXB0aW9uQnJlYWtwb2ludHMoKTogSUV4Y2VwdGlvbkJyZWFrcG9pbnRbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZXhjZXB0aW9uQnJlYWtwb2ludHM7XG5cdH1cblxuXHRnZXRFeGNlcHRpb25CcmVha3BvaW50c0ZvclNlc3Npb24oc2Vzc2lvbklkPzogc3RyaW5nKTogSUV4Y2VwdGlvbkJyZWFrcG9pbnRbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZXhjZXB0aW9uQnJlYWtwb2ludHMuZmlsdGVyKGVicCA9PiBlYnAuaXNTdXBwb3J0ZWRTZXNzaW9uKHNlc3Npb25JZCkpO1xuXHR9XG5cblx0Z2V0SW5zdHJ1Y3Rpb25CcmVha3BvaW50cygpOiBJSW5zdHJ1Y3Rpb25CcmVha3BvaW50W10ge1xuXHRcdHJldHVybiB0aGlzLmluc3RydWN0aW9uQnJlYWtwb2ludHM7XG5cdH1cblxuXHRzZXRFeGNlcHRpb25CcmVha3BvaW50c0ZvclNlc3Npb24oc2Vzc2lvbklkOiBzdHJpbmcsIGZpbHRlcnM6IERlYnVnUHJvdG9jb2wuRXhjZXB0aW9uQnJlYWtwb2ludHNGaWx0ZXJbXSk6IHZvaWQge1xuXHRcdGlmICghZmlsdGVycykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBkaWRDaGFuZ2VCcmVha3BvaW50cyA9IGZhbHNlO1xuXHRcdGZpbHRlcnMuZm9yRWFjaCgoZCkgPT4ge1xuXHRcdFx0bGV0IGVicCA9IHRoaXMuZXhjZXB0aW9uQnJlYWtwb2ludHMuZmlsdGVyKChleGJwKSA9PiBleGJwLm1hdGNoZXMoZCkpLnBvcCgpO1xuXG5cdFx0XHRpZiAoIWVicCkge1xuXHRcdFx0XHRkaWRDaGFuZ2VCcmVha3BvaW50cyA9IHRydWU7XG5cdFx0XHRcdGVicCA9IG5ldyBFeGNlcHRpb25CcmVha3BvaW50KHtcblx0XHRcdFx0XHRmaWx0ZXI6IGQuZmlsdGVyLFxuXHRcdFx0XHRcdGxhYmVsOiBkLmxhYmVsLFxuXHRcdFx0XHRcdGVuYWJsZWQ6ICEhZC5kZWZhdWx0LFxuXHRcdFx0XHRcdHN1cHBvcnRzQ29uZGl0aW9uOiAhIWQuc3VwcG9ydHNDb25kaXRpb24sXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGQuZGVzY3JpcHRpb24sXG5cdFx0XHRcdFx0Y29uZGl0aW9uRGVzY3JpcHRpb246IGQuY29uZGl0aW9uRGVzY3JpcHRpb24sXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLmV4Y2VwdGlvbkJyZWFrcG9pbnRzLnB1c2goZWJwKTtcblx0XHRcdH1cblxuXHRcdFx0ZWJwLnNldFN1cHBvcnRlZFNlc3Npb24oc2Vzc2lvbklkLCB0cnVlKTtcblx0XHR9KTtcblxuXHRcdGlmIChkaWRDaGFuZ2VCcmVha3BvaW50cykge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VCcmVha3BvaW50cy5maXJlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0cmVtb3ZlRXhjZXB0aW9uQnJlYWtwb2ludHNGb3JTZXNzaW9uKHNlc3Npb25JZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5leGNlcHRpb25CcmVha3BvaW50cy5mb3JFYWNoKGVicCA9PiBlYnAuc2V0U3VwcG9ydGVkU2Vzc2lvbihzZXNzaW9uSWQsIGZhbHNlKSk7XG5cdH1cblxuXHQvLyBTZXQgbGFzdCBmb2N1c2VkIHNlc3Npb24gYXMgZmFsbGJhY2sgc2Vzc2lvbi5cblx0Ly8gVGhpcyBpcyBkb25lIHRvIGtlZXAgdHJhY2sgb2YgdGhlIGV4Y2VwdGlvbiBicmVha3BvaW50cyB0byBzaG93IHdoZW4gbm8gc2Vzc2lvbiBpcyBhY3RpdmUuXG5cdHNldEV4Y2VwdGlvbkJyZWFrcG9pbnRGYWxsYmFja1Nlc3Npb24oc2Vzc2lvbklkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLmV4Y2VwdGlvbkJyZWFrcG9pbnRzLmZvckVhY2goZWJwID0+IGVicC5zZXRGYWxsYmFjayhlYnAuaXNTdXBwb3J0ZWRTZXNzaW9uKHNlc3Npb25JZCkpKTtcblx0fVxuXG5cdHNldEV4Y2VwdGlvbkJyZWFrcG9pbnRDb25kaXRpb24oZXhjZXB0aW9uQnJlYWtwb2ludDogSUV4Y2VwdGlvbkJyZWFrcG9pbnQsIGNvbmRpdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0KGV4Y2VwdGlvbkJyZWFrcG9pbnQgYXMgRXhjZXB0aW9uQnJlYWtwb2ludCkuY29uZGl0aW9uID0gY29uZGl0aW9uO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQnJlYWtwb2ludHMuZmlyZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0YXJlQnJlYWtwb2ludHNBY3RpdmF0ZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuYnJlYWtwb2ludHNBY3RpdmF0ZWQ7XG5cdH1cblxuXHRzZXRCcmVha3BvaW50c0FjdGl2YXRlZChhY3RpdmF0ZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLmJyZWFrcG9pbnRzQWN0aXZhdGVkID0gYWN0aXZhdGVkO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQnJlYWtwb2ludHMuZmlyZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0YWRkQnJlYWtwb2ludHModXJpOiB1cmksIHJhd0RhdGE6IElCcmVha3BvaW50RGF0YVtdLCBmaXJlRXZlbnQgPSB0cnVlKTogSUJyZWFrcG9pbnRbXSB7XG5cdFx0Y29uc3QgbmV3QnJlYWtwb2ludHMgPSByYXdEYXRhLm1hcChyYXdCcCA9PiB7XG5cdFx0XHRyZXR1cm4gbmV3IEJyZWFrcG9pbnQoe1xuXHRcdFx0XHR1cmksXG5cdFx0XHRcdGxpbmVOdW1iZXI6IHJhd0JwLmxpbmVOdW1iZXIsXG5cdFx0XHRcdGNvbHVtbjogcmF3QnAuY29sdW1uLFxuXHRcdFx0XHRlbmFibGVkOiByYXdCcC5lbmFibGVkID8/IHRydWUsXG5cdFx0XHRcdGNvbmRpdGlvbjogcmF3QnAuY29uZGl0aW9uLFxuXHRcdFx0XHRoaXRDb25kaXRpb246IHJhd0JwLmhpdENvbmRpdGlvbixcblx0XHRcdFx0bG9nTWVzc2FnZTogcmF3QnAubG9nTWVzc2FnZSxcblx0XHRcdFx0dHJpZ2dlcmVkQnk6IHJhd0JwLnRyaWdnZXJlZEJ5LFxuXHRcdFx0XHRhZGFwdGVyRGF0YTogdW5kZWZpbmVkLFxuXHRcdFx0XHRtb2RlOiByYXdCcC5tb2RlLFxuXHRcdFx0XHRtb2RlTGFiZWw6IHJhd0JwLm1vZGVMYWJlbCxcblx0XHRcdH0sIHRoaXMudGV4dEZpbGVTZXJ2aWNlLCB0aGlzLnVyaUlkZW50aXR5U2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlLCByYXdCcC5pZCk7XG5cdFx0fSk7XG5cdFx0dGhpcy5icmVha3BvaW50cyA9IHRoaXMuYnJlYWtwb2ludHMuY29uY2F0KG5ld0JyZWFrcG9pbnRzKTtcblx0XHR0aGlzLmJyZWFrcG9pbnRzQWN0aXZhdGVkID0gdHJ1ZTtcblx0XHR0aGlzLnNvcnRBbmREZUR1cCgpO1xuXG5cdFx0aWYgKGZpcmVFdmVudCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VCcmVha3BvaW50cy5maXJlKHsgYWRkZWQ6IG5ld0JyZWFrcG9pbnRzLCBzZXNzaW9uT25seTogZmFsc2UgfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ld0JyZWFrcG9pbnRzO1xuXHR9XG5cblx0cmVtb3ZlQnJlYWtwb2ludHModG9SZW1vdmU6IElCcmVha3BvaW50W10pOiB2b2lkIHtcblx0XHR0aGlzLmJyZWFrcG9pbnRzID0gdGhpcy5icmVha3BvaW50cy5maWx0ZXIoYnAgPT4gIXRvUmVtb3ZlLnNvbWUodG9SZW1vdmUgPT4gdG9SZW1vdmUuZ2V0SWQoKSA9PT0gYnAuZ2V0SWQoKSkpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQnJlYWtwb2ludHMuZmlyZSh7IHJlbW92ZWQ6IHRvUmVtb3ZlLCBzZXNzaW9uT25seTogZmFsc2UgfSk7XG5cdH1cblxuXHR1cGRhdGVCcmVha3BvaW50cyhkYXRhOiBNYXA8c3RyaW5nLCBJQnJlYWtwb2ludFVwZGF0ZURhdGE+KTogdm9pZCB7XG5cdFx0Y29uc3QgdXBkYXRlZDogSUJyZWFrcG9pbnRbXSA9IFtdO1xuXHRcdHRoaXMuYnJlYWtwb2ludHMuZm9yRWFjaChicCA9PiB7XG5cdFx0XHRjb25zdCBicERhdGEgPSBkYXRhLmdldChicC5nZXRJZCgpKTtcblx0XHRcdGlmIChicERhdGEpIHtcblx0XHRcdFx0YnAudXBkYXRlKGJwRGF0YSk7XG5cdFx0XHRcdHVwZGF0ZWQucHVzaChicCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy5zb3J0QW5kRGVEdXAoKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUJyZWFrcG9pbnRzLmZpcmUoeyBjaGFuZ2VkOiB1cGRhdGVkLCBzZXNzaW9uT25seTogZmFsc2UgfSk7XG5cdH1cblxuXHRzZXRCcmVha3BvaW50U2Vzc2lvbkRhdGEoc2Vzc2lvbklkOiBzdHJpbmcsIGNhcGFiaWxpdGVzOiBEZWJ1Z1Byb3RvY29sLkNhcGFiaWxpdGllcywgZGF0YTogTWFwPHN0cmluZywgRGVidWdQcm90b2NvbC5CcmVha3BvaW50PiB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuYnJlYWtwb2ludHMuZm9yRWFjaChicCA9PiB7XG5cdFx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdFx0YnAuc2V0U2Vzc2lvbkRhdGEoc2Vzc2lvbklkLCB1bmRlZmluZWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgYnBEYXRhID0gZGF0YS5nZXQoYnAuZ2V0SWQoKSk7XG5cdFx0XHRcdGlmIChicERhdGEpIHtcblx0XHRcdFx0XHRicC5zZXRTZXNzaW9uRGF0YShzZXNzaW9uSWQsIHRvQnJlYWtwb2ludFNlc3Npb25EYXRhKGJwRGF0YSwgY2FwYWJpbGl0ZXMpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuZnVuY3Rpb25CcmVha3BvaW50cy5mb3JFYWNoKGZicCA9PiB7XG5cdFx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdFx0ZmJwLnNldFNlc3Npb25EYXRhKHNlc3Npb25JZCwgdW5kZWZpbmVkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGZicERhdGEgPSBkYXRhLmdldChmYnAuZ2V0SWQoKSk7XG5cdFx0XHRcdGlmIChmYnBEYXRhKSB7XG5cdFx0XHRcdFx0ZmJwLnNldFNlc3Npb25EYXRhKHNlc3Npb25JZCwgdG9CcmVha3BvaW50U2Vzc2lvbkRhdGEoZmJwRGF0YSwgY2FwYWJpbGl0ZXMpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuZGF0YUJyZWFrcG9pbnRzLmZvckVhY2goZGJwID0+IHtcblx0XHRcdGlmICghZGF0YSkge1xuXHRcdFx0XHRkYnAuc2V0U2Vzc2lvbkRhdGEoc2Vzc2lvbklkLCB1bmRlZmluZWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgZGJwRGF0YSA9IGRhdGEuZ2V0KGRicC5nZXRJZCgpKTtcblx0XHRcdFx0aWYgKGRicERhdGEpIHtcblx0XHRcdFx0XHRkYnAuc2V0U2Vzc2lvbkRhdGEoc2Vzc2lvbklkLCB0b0JyZWFrcG9pbnRTZXNzaW9uRGF0YShkYnBEYXRhLCBjYXBhYmlsaXRlcykpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy5leGNlcHRpb25CcmVha3BvaW50cy5mb3JFYWNoKGVicCA9PiB7XG5cdFx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdFx0ZWJwLnNldFNlc3Npb25EYXRhKHNlc3Npb25JZCwgdW5kZWZpbmVkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGVicERhdGEgPSBkYXRhLmdldChlYnAuZ2V0SWQoKSk7XG5cdFx0XHRcdGlmIChlYnBEYXRhKSB7XG5cdFx0XHRcdFx0ZWJwLnNldFNlc3Npb25EYXRhKHNlc3Npb25JZCwgdG9CcmVha3BvaW50U2Vzc2lvbkRhdGEoZWJwRGF0YSwgY2FwYWJpbGl0ZXMpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuaW5zdHJ1Y3Rpb25CcmVha3BvaW50cy5mb3JFYWNoKGlicCA9PiB7XG5cdFx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdFx0aWJwLnNldFNlc3Npb25EYXRhKHNlc3Npb25JZCwgdW5kZWZpbmVkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGlicERhdGEgPSBkYXRhLmdldChpYnAuZ2V0SWQoKSk7XG5cdFx0XHRcdGlmIChpYnBEYXRhKSB7XG5cdFx0XHRcdFx0aWJwLnNldFNlc3Npb25EYXRhKHNlc3Npb25JZCwgdG9CcmVha3BvaW50U2Vzc2lvbkRhdGEoaWJwRGF0YSwgY2FwYWJpbGl0ZXMpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VCcmVha3BvaW50cy5maXJlKHtcblx0XHRcdHNlc3Npb25Pbmx5OiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRnZXREZWJ1Z1Byb3RvY29sQnJlYWtwb2ludChicmVha3BvaW50SWQ6IHN0cmluZywgc2Vzc2lvbklkOiBzdHJpbmcpOiBEZWJ1Z1Byb3RvY29sLkJyZWFrcG9pbnQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGJwID0gdGhpcy5icmVha3BvaW50cy5maW5kKGJwID0+IGJwLmdldElkKCkgPT09IGJyZWFrcG9pbnRJZCk7XG5cdFx0aWYgKGJwKSB7XG5cdFx0XHRyZXR1cm4gYnAuZ2V0RGVidWdQcm90b2NvbEJyZWFrcG9pbnQoc2Vzc2lvbklkKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGdldEJyZWFrcG9pbnRNb2Rlcyhmb3JCcmVha3BvaW50VHlwZTogJ3NvdXJjZScgfCAnZXhjZXB0aW9uJyB8ICdkYXRhJyB8ICdpbnN0cnVjdGlvbicpOiBEZWJ1Z1Byb3RvY29sLkJyZWFrcG9pbnRNb2RlW10ge1xuXHRcdHJldHVybiBbLi4udGhpcy5fYnJlYWtwb2ludE1vZGVzLnZhbHVlcygpXS5maWx0ZXIobW9kZSA9PiBtb2RlLmFwcGxpZXNUby5pbmNsdWRlcyhmb3JCcmVha3BvaW50VHlwZSkpO1xuXHR9XG5cblx0cmVnaXN0ZXJCcmVha3BvaW50TW9kZXMoZGVidWdUeXBlOiBzdHJpbmcsIG1vZGVzOiBEZWJ1Z1Byb3RvY29sLkJyZWFrcG9pbnRNb2RlW10pIHtcblx0XHRmb3IgKGNvbnN0IG1vZGUgb2YgbW9kZXMpIHtcblx0XHRcdGNvbnN0IGtleSA9IGAke21vZGUubW9kZX0vJHttb2RlLmxhYmVsfWA7XG5cdFx0XHRjb25zdCByZWMgPSB0aGlzLl9icmVha3BvaW50TW9kZXMuZ2V0KGtleSk7XG5cdFx0XHRpZiAocmVjKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgdGFyZ2V0IG9mIG1vZGUuYXBwbGllc1RvKSB7XG5cdFx0XHRcdFx0aWYgKCFyZWMuYXBwbGllc1RvLmluY2x1ZGVzKHRhcmdldCkpIHtcblx0XHRcdFx0XHRcdHJlYy5hcHBsaWVzVG8ucHVzaCh0YXJnZXQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgZHVwbGljYXRlID0gWy4uLnRoaXMuX2JyZWFrcG9pbnRNb2Rlcy52YWx1ZXMoKV0uZmluZChyID0+IHIgIT09IHJlYyAmJiByLmxhYmVsID09PSBtb2RlLmxhYmVsKTtcblx0XHRcdFx0aWYgKGR1cGxpY2F0ZSkge1xuXHRcdFx0XHRcdGR1cGxpY2F0ZS5sYWJlbCA9IGAke2R1cGxpY2F0ZS5sYWJlbH0gKCR7ZHVwbGljYXRlLmZpcnN0RnJvbURlYnVnVHlwZX0pYDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX2JyZWFrcG9pbnRNb2Rlcy5zZXQoa2V5LCB7XG5cdFx0XHRcdFx0bW9kZTogbW9kZS5tb2RlLFxuXHRcdFx0XHRcdGxhYmVsOiBkdXBsaWNhdGUgPyBgJHttb2RlLmxhYmVsfSAoJHtkZWJ1Z1R5cGV9KWAgOiBtb2RlLmxhYmVsLFxuXHRcdFx0XHRcdGZpcnN0RnJvbURlYnVnVHlwZTogZGVidWdUeXBlLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBtb2RlLmRlc2NyaXB0aW9uLFxuXHRcdFx0XHRcdGFwcGxpZXNUbzogbW9kZS5hcHBsaWVzVG8uc2xpY2UoKSwgLy8gYXZvaWQgbGF0ZXIgbXV0YXRpb25zXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc29ydEFuZERlRHVwKCk6IHZvaWQge1xuXHRcdHRoaXMuYnJlYWtwb2ludHMgPSB0aGlzLmJyZWFrcG9pbnRzLnNvcnQoKGZpcnN0LCBzZWNvbmQpID0+IHtcblx0XHRcdGlmIChmaXJzdC51cmkudG9TdHJpbmcoKSAhPT0gc2Vjb25kLnVyaS50b1N0cmluZygpKSB7XG5cdFx0XHRcdHJldHVybiByZXNvdXJjZXMuYmFzZW5hbWVPckF1dGhvcml0eShmaXJzdC51cmkpLmxvY2FsZUNvbXBhcmUocmVzb3VyY2VzLmJhc2VuYW1lT3JBdXRob3JpdHkoc2Vjb25kLnVyaSkpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGZpcnN0LmxpbmVOdW1iZXIgPT09IHNlY29uZC5saW5lTnVtYmVyKSB7XG5cdFx0XHRcdGlmIChmaXJzdC5jb2x1bW4gJiYgc2Vjb25kLmNvbHVtbikge1xuXHRcdFx0XHRcdHJldHVybiBmaXJzdC5jb2x1bW4gLSBzZWNvbmQuY29sdW1uO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZmlyc3QubGluZU51bWJlciAtIHNlY29uZC5saW5lTnVtYmVyO1xuXHRcdH0pO1xuXHRcdHRoaXMuYnJlYWtwb2ludHMgPSBkaXN0aW5jdCh0aGlzLmJyZWFrcG9pbnRzLCBicCA9PiBgJHticC51cmkudG9TdHJpbmcoKX06JHticC5saW5lTnVtYmVyfToke2JwLmNvbHVtbn1gKTtcblx0fVxuXG5cdHNldEVuYWJsZW1lbnQoZWxlbWVudDogSUVuYWJsZW1lbnQsIGVuYWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgQnJlYWtwb2ludCB8fCBlbGVtZW50IGluc3RhbmNlb2YgRnVuY3Rpb25CcmVha3BvaW50IHx8IGVsZW1lbnQgaW5zdGFuY2VvZiBFeGNlcHRpb25CcmVha3BvaW50IHx8IGVsZW1lbnQgaW5zdGFuY2VvZiBEYXRhQnJlYWtwb2ludCB8fCBlbGVtZW50IGluc3RhbmNlb2YgSW5zdHJ1Y3Rpb25CcmVha3BvaW50KSB7XG5cdFx0XHRjb25zdCBjaGFuZ2VkOiBBcnJheTxJQnJlYWtwb2ludCB8IElGdW5jdGlvbkJyZWFrcG9pbnQgfCBJRGF0YUJyZWFrcG9pbnQgfCBJSW5zdHJ1Y3Rpb25CcmVha3BvaW50PiA9IFtdO1xuXHRcdFx0aWYgKGVsZW1lbnQuZW5hYmxlZCAhPT0gZW5hYmxlICYmIChlbGVtZW50IGluc3RhbmNlb2YgQnJlYWtwb2ludCB8fCBlbGVtZW50IGluc3RhbmNlb2YgRnVuY3Rpb25CcmVha3BvaW50IHx8IGVsZW1lbnQgaW5zdGFuY2VvZiBEYXRhQnJlYWtwb2ludCB8fCBlbGVtZW50IGluc3RhbmNlb2YgSW5zdHJ1Y3Rpb25CcmVha3BvaW50KSkge1xuXHRcdFx0XHRjaGFuZ2VkLnB1c2goZWxlbWVudCk7XG5cdFx0XHR9XG5cblx0XHRcdGVsZW1lbnQuZW5hYmxlZCA9IGVuYWJsZTtcblx0XHRcdGlmIChlbmFibGUpIHtcblx0XHRcdFx0dGhpcy5icmVha3BvaW50c0FjdGl2YXRlZCA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQnJlYWtwb2ludHMuZmlyZSh7IGNoYW5nZWQ6IGNoYW5nZWQsIHNlc3Npb25Pbmx5OiBmYWxzZSB9KTtcblx0XHR9XG5cdH1cblxuXHRlbmFibGVPckRpc2FibGVBbGxCcmVha3BvaW50cyhlbmFibGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBjaGFuZ2VkOiBBcnJheTxJQnJlYWtwb2ludCB8IElGdW5jdGlvbkJyZWFrcG9pbnQgfCBJRGF0YUJyZWFrcG9pbnQgfCBJSW5zdHJ1Y3Rpb25CcmVha3BvaW50PiA9IFtdO1xuXG5cdFx0dGhpcy5icmVha3BvaW50cy5mb3JFYWNoKGJwID0+IHtcblx0XHRcdGlmIChicC5lbmFibGVkICE9PSBlbmFibGUpIHtcblx0XHRcdFx0Y2hhbmdlZC5wdXNoKGJwKTtcblx0XHRcdH1cblx0XHRcdGJwLmVuYWJsZWQgPSBlbmFibGU7XG5cdFx0fSk7XG5cdFx0dGhpcy5mdW5jdGlvbkJyZWFrcG9pbnRzLmZvckVhY2goZmJwID0+IHtcblx0XHRcdGlmIChmYnAuZW5hYmxlZCAhPT0gZW5hYmxlKSB7XG5cdFx0XHRcdGNoYW5nZWQucHVzaChmYnApO1xuXHRcdFx0fVxuXHRcdFx0ZmJwLmVuYWJsZWQgPSBlbmFibGU7XG5cdFx0fSk7XG5cdFx0dGhpcy5kYXRhQnJlYWtwb2ludHMuZm9yRWFjaChkYnAgPT4ge1xuXHRcdFx0aWYgKGRicC5lbmFibGVkICE9PSBlbmFibGUpIHtcblx0XHRcdFx0Y2hhbmdlZC5wdXNoKGRicCk7XG5cdFx0XHR9XG5cdFx0XHRkYnAuZW5hYmxlZCA9IGVuYWJsZTtcblx0XHR9KTtcblx0XHR0aGlzLmluc3RydWN0aW9uQnJlYWtwb2ludHMuZm9yRWFjaChpYnAgPT4ge1xuXHRcdFx0aWYgKGlicC5lbmFibGVkICE9PSBlbmFibGUpIHtcblx0XHRcdFx0Y2hhbmdlZC5wdXNoKGlicCk7XG5cdFx0XHR9XG5cdFx0XHRpYnAuZW5hYmxlZCA9IGVuYWJsZTtcblx0XHR9KTtcblxuXHRcdGlmIChlbmFibGUpIHtcblx0XHRcdHRoaXMuYnJlYWtwb2ludHNBY3RpdmF0ZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQnJlYWtwb2ludHMuZmlyZSh7IGNoYW5nZWQ6IGNoYW5nZWQsIHNlc3Npb25Pbmx5OiBmYWxzZSB9KTtcblx0fVxuXG5cdGFkZEZ1bmN0aW9uQnJlYWtwb2ludChvcHRzOiBJRnVuY3Rpb25CcmVha3BvaW50T3B0aW9ucywgaWQ/OiBzdHJpbmcpOiBJRnVuY3Rpb25CcmVha3BvaW50IHtcblx0XHRjb25zdCBuZXdGdW5jdGlvbkJyZWFrcG9pbnQgPSBuZXcgRnVuY3Rpb25CcmVha3BvaW50KG9wdHMsIGlkKTtcblx0XHR0aGlzLmZ1bmN0aW9uQnJlYWtwb2ludHMucHVzaChuZXdGdW5jdGlvbkJyZWFrcG9pbnQpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQnJlYWtwb2ludHMuZmlyZSh7IGFkZGVkOiBbbmV3RnVuY3Rpb25CcmVha3BvaW50XSwgc2Vzc2lvbk9ubHk6IGZhbHNlIH0pO1xuXG5cdFx0cmV0dXJuIG5ld0Z1bmN0aW9uQnJlYWtwb2ludDtcblx0fVxuXG5cdHVwZGF0ZUZ1bmN0aW9uQnJlYWtwb2ludChpZDogc3RyaW5nLCB1cGRhdGU6IHsgbmFtZT86IHN0cmluZzsgaGl0Q29uZGl0aW9uPzogc3RyaW5nOyBjb25kaXRpb24/OiBzdHJpbmcgfSk6IHZvaWQge1xuXHRcdGNvbnN0IGZ1bmN0aW9uQnJlYWtwb2ludCA9IHRoaXMuZnVuY3Rpb25CcmVha3BvaW50cy5maW5kKGZicCA9PiBmYnAuZ2V0SWQoKSA9PT0gaWQpO1xuXHRcdGlmIChmdW5jdGlvbkJyZWFrcG9pbnQpIHtcblx0XHRcdGlmICh0eXBlb2YgdXBkYXRlLm5hbWUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGZ1bmN0aW9uQnJlYWtwb2ludC5uYW1lID0gdXBkYXRlLm5hbWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAodHlwZW9mIHVwZGF0ZS5jb25kaXRpb24gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGZ1bmN0aW9uQnJlYWtwb2ludC5jb25kaXRpb24gPSB1cGRhdGUuY29uZGl0aW9uO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiB1cGRhdGUuaGl0Q29uZGl0aW9uID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRmdW5jdGlvbkJyZWFrcG9pbnQuaGl0Q29uZGl0aW9uID0gdXBkYXRlLmhpdENvbmRpdGlvbjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQnJlYWtwb2ludHMuZmlyZSh7IGNoYW5nZWQ6IFtmdW5jdGlvbkJyZWFrcG9pbnRdLCBzZXNzaW9uT25seTogZmFsc2UgfSk7XG5cdFx0fVxuXHR9XG5cblx0cmVtb3ZlRnVuY3Rpb25CcmVha3BvaW50cyhpZD86IHN0cmluZyk6IHZvaWQge1xuXHRcdGxldCByZW1vdmVkOiBGdW5jdGlvbkJyZWFrcG9pbnRbXTtcblx0XHRpZiAoaWQpIHtcblx0XHRcdHJlbW92ZWQgPSB0aGlzLmZ1bmN0aW9uQnJlYWtwb2ludHMuZmlsdGVyKGZicCA9PiBmYnAuZ2V0SWQoKSA9PT0gaWQpO1xuXHRcdFx0dGhpcy5mdW5jdGlvbkJyZWFrcG9pbnRzID0gdGhpcy5mdW5jdGlvbkJyZWFrcG9pbnRzLmZpbHRlcihmYnAgPT4gZmJwLmdldElkKCkgIT09IGlkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVtb3ZlZCA9IHRoaXMuZnVuY3Rpb25CcmVha3BvaW50cztcblx0XHRcdHRoaXMuZnVuY3Rpb25CcmVha3BvaW50cyA9IFtdO1xuXHRcdH1cblx0XHR0aGlzLl9vbkRpZENoYW5nZUJyZWFrcG9pbnRzLmZpcmUoeyByZW1vdmVkLCBzZXNzaW9uT25seTogZmFsc2UgfSk7XG5cdH1cblxuXHRhZGREYXRhQnJlYWtwb2ludChvcHRzOiBJRGF0YUJyZWFrcG9pbnRPcHRpb25zLCBpZD86IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IG5ld0RhdGFCcmVha3BvaW50ID0gbmV3IERhdGFCcmVha3BvaW50KG9wdHMsIGlkKTtcblx0XHR0aGlzLmRhdGFCcmVha3BvaW50cy5wdXNoKG5ld0RhdGFCcmVha3BvaW50KTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUJyZWFrcG9pbnRzLmZpcmUoeyBhZGRlZDogW25ld0RhdGFCcmVha3BvaW50XSwgc2Vzc2lvbk9ubHk6IGZhbHNlIH0pO1xuXHR9XG5cblx0dXBkYXRlRGF0YUJyZWFrcG9pbnQoaWQ6IHN0cmluZywgdXBkYXRlOiB7IGhpdENvbmRpdGlvbj86IHN0cmluZzsgY29uZGl0aW9uPzogc3RyaW5nIH0pOiB2b2lkIHtcblx0XHRjb25zdCBkYXRhQnJlYWtwb2ludCA9IHRoaXMuZGF0YUJyZWFrcG9pbnRzLmZpbmQoZmJwID0+IGZicC5nZXRJZCgpID09PSBpZCk7XG5cdFx0aWYgKGRhdGFCcmVha3BvaW50KSB7XG5cdFx0XHRpZiAodHlwZW9mIHVwZGF0ZS5jb25kaXRpb24gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGRhdGFCcmVha3BvaW50LmNvbmRpdGlvbiA9IHVwZGF0ZS5jb25kaXRpb247XG5cdFx0XHR9XG5cdFx0XHRpZiAodHlwZW9mIHVwZGF0ZS5oaXRDb25kaXRpb24gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGRhdGFCcmVha3BvaW50LmhpdENvbmRpdGlvbiA9IHVwZGF0ZS5oaXRDb25kaXRpb247XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUJyZWFrcG9pbnRzLmZpcmUoeyBjaGFuZ2VkOiBbZGF0YUJyZWFrcG9pbnRdLCBzZXNzaW9uT25seTogZmFsc2UgfSk7XG5cdFx0fVxuXHR9XG5cblx0cmVtb3ZlRGF0YUJyZWFrcG9pbnRzKGlkPzogc3RyaW5nKTogdm9pZCB7XG5cdFx0bGV0IHJlbW92ZWQ6IERhdGFCcmVha3BvaW50W107XG5cdFx0aWYgKGlkKSB7XG5cdFx0XHRyZW1vdmVkID0gdGhpcy5kYXRhQnJlYWtwb2ludHMuZmlsdGVyKGZicCA9PiBmYnAuZ2V0SWQoKSA9PT0gaWQpO1xuXHRcdFx0dGhpcy5kYXRhQnJlYWtwb2ludHMgPSB0aGlzLmRhdGFCcmVha3BvaW50cy5maWx0ZXIoZmJwID0+IGZicC5nZXRJZCgpICE9PSBpZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlbW92ZWQgPSB0aGlzLmRhdGFCcmVha3BvaW50cztcblx0XHRcdHRoaXMuZGF0YUJyZWFrcG9pbnRzID0gW107XG5cdFx0fVxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQnJlYWtwb2ludHMuZmlyZSh7IHJlbW92ZWQsIHNlc3Npb25Pbmx5OiBmYWxzZSB9KTtcblx0fVxuXG5cdGFkZEluc3RydWN0aW9uQnJlYWtwb2ludChvcHRzOiBJSW5zdHJ1Y3Rpb25CcmVha3BvaW50T3B0aW9ucyk6IHZvaWQge1xuXHRcdGNvbnN0IG5ld0luc3RydWN0aW9uQnJlYWtwb2ludCA9IG5ldyBJbnN0cnVjdGlvbkJyZWFrcG9pbnQob3B0cyk7XG5cdFx0dGhpcy5pbnN0cnVjdGlvbkJyZWFrcG9pbnRzLnB1c2gobmV3SW5zdHJ1Y3Rpb25CcmVha3BvaW50KTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUJyZWFrcG9pbnRzLmZpcmUoeyBhZGRlZDogW25ld0luc3RydWN0aW9uQnJlYWtwb2ludF0sIHNlc3Npb25Pbmx5OiB0cnVlIH0pO1xuXHR9XG5cblx0cmVtb3ZlSW5zdHJ1Y3Rpb25CcmVha3BvaW50cyhpbnN0cnVjdGlvblJlZmVyZW5jZT86IHN0cmluZywgb2Zmc2V0PzogbnVtYmVyKTogdm9pZCB7XG5cdFx0bGV0IHJlbW92ZWQ6IEluc3RydWN0aW9uQnJlYWtwb2ludFtdID0gW107XG5cdFx0aWYgKGluc3RydWN0aW9uUmVmZXJlbmNlKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuaW5zdHJ1Y3Rpb25CcmVha3BvaW50cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBpYnAgPSB0aGlzLmluc3RydWN0aW9uQnJlYWtwb2ludHNbaV07XG5cdFx0XHRcdGlmIChpYnAuaW5zdHJ1Y3Rpb25SZWZlcmVuY2UgPT09IGluc3RydWN0aW9uUmVmZXJlbmNlICYmIChvZmZzZXQgPT09IHVuZGVmaW5lZCB8fCBpYnAub2Zmc2V0ID09PSBvZmZzZXQpKSB7XG5cdFx0XHRcdFx0cmVtb3ZlZC5wdXNoKGlicCk7XG5cdFx0XHRcdFx0dGhpcy5pbnN0cnVjdGlvbkJyZWFrcG9pbnRzLnNwbGljZShpLS0sIDEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlbW92ZWQgPSB0aGlzLmluc3RydWN0aW9uQnJlYWtwb2ludHM7XG5cdFx0XHR0aGlzLmluc3RydWN0aW9uQnJlYWtwb2ludHMgPSBbXTtcblx0XHR9XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VCcmVha3BvaW50cy5maXJlKHsgcmVtb3ZlZCwgc2Vzc2lvbk9ubHk6IGZhbHNlIH0pO1xuXHR9XG5cblx0Z2V0V2F0Y2hFeHByZXNzaW9ucygpOiBFeHByZXNzaW9uW10ge1xuXHRcdHJldHVybiB0aGlzLndhdGNoRXhwcmVzc2lvbnM7XG5cdH1cblxuXHRhZGRXYXRjaEV4cHJlc3Npb24obmFtZT86IHN0cmluZyk6IElFeHByZXNzaW9uIHtcblx0XHRjb25zdCB3ZSA9IG5ldyBFeHByZXNzaW9uKG5hbWUgfHwgJycpO1xuXHRcdHRoaXMud2F0Y2hFeHByZXNzaW9ucy5wdXNoKHdlKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVdhdGNoRXhwcmVzc2lvbnMuZmlyZSh3ZSk7XG5cblx0XHRyZXR1cm4gd2U7XG5cdH1cblxuXHRyZW5hbWVXYXRjaEV4cHJlc3Npb24oaWQ6IHN0cmluZywgbmV3TmFtZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgZmlsdGVyZWQgPSB0aGlzLndhdGNoRXhwcmVzc2lvbnMuZmlsdGVyKHdlID0+IHdlLmdldElkKCkgPT09IGlkKTtcblx0XHRpZiAoZmlsdGVyZWQubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRmaWx0ZXJlZFswXS5uYW1lID0gbmV3TmFtZTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlV2F0Y2hFeHByZXNzaW9ucy5maXJlKGZpbHRlcmVkWzBdKTtcblx0XHR9XG5cdH1cblxuXHRyZW1vdmVXYXRjaEV4cHJlc3Npb25zKGlkOiBzdHJpbmcgfCBudWxsID0gbnVsbCk6IHZvaWQge1xuXHRcdHRoaXMud2F0Y2hFeHByZXNzaW9ucyA9IGlkID8gdGhpcy53YXRjaEV4cHJlc3Npb25zLmZpbHRlcih3ZSA9PiB3ZS5nZXRJZCgpICE9PSBpZCkgOiBbXTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVdhdGNoRXhwcmVzc2lvbnMuZmlyZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0bW92ZVdhdGNoRXhwcmVzc2lvbihpZDogc3RyaW5nLCBwb3NpdGlvbjogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3Qgd2UgPSB0aGlzLndhdGNoRXhwcmVzc2lvbnMuZmluZCh3ZSA9PiB3ZS5nZXRJZCgpID09PSBpZCk7XG5cdFx0aWYgKHdlKSB7XG5cdFx0XHR0aGlzLndhdGNoRXhwcmVzc2lvbnMgPSB0aGlzLndhdGNoRXhwcmVzc2lvbnMuZmlsdGVyKHdlID0+IHdlLmdldElkKCkgIT09IGlkKTtcblx0XHRcdHRoaXMud2F0Y2hFeHByZXNzaW9ucyA9IHRoaXMud2F0Y2hFeHByZXNzaW9ucy5zbGljZSgwLCBwb3NpdGlvbikuY29uY2F0KHdlLCB0aGlzLndhdGNoRXhwcmVzc2lvbnMuc2xpY2UocG9zaXRpb24pKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlV2F0Y2hFeHByZXNzaW9ucy5maXJlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0c291cmNlSXNOb3RBdmFpbGFibGUodXJpOiB1cmkpOiB2b2lkIHtcblx0XHR0aGlzLnNlc3Npb25zLmZvckVhY2gocyA9PiB7XG5cdFx0XHRjb25zdCBzb3VyY2UgPSBzLmdldFNvdXJjZUZvclVyaSh1cmkpO1xuXHRcdFx0aWYgKHNvdXJjZSkge1xuXHRcdFx0XHRzb3VyY2UuYXZhaWxhYmxlID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhp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
