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
import { DeferredPromise } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { language } from "../../../../base/common/platform.js";
import { localize } from "../../../../nls.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { refreshComputedState } from "./getComputedState.js";
import { TestId } from "./testId.js";
import { makeEmptyCounts, maxPriority, statesInOrder, terminalStatePriorities } from "./testingStates.js";
import { getMarkId, TestItemExpandState, TestMessageType, TestResultItem, TestResultState } from "./testTypes.js";
const emptyRawOutput = {
  buffers: [],
  length: 0,
  onDidWriteData: Event.None,
  endPromise: Promise.resolve(),
  getRange: () => VSBuffer.alloc(0),
  getRangeIter: () => []
};
class TaskRawOutput {
  constructor() {
    this.writeDataEmitter = new Emitter();
    this.endDeferred = new DeferredPromise();
    this.offset = 0;
    /** @inheritdoc */
    this.onDidWriteData = this.writeDataEmitter.event;
    /** @inheritdoc */
    this.endPromise = this.endDeferred.p;
    /** @inheritdoc */
    this.buffers = [];
  }
  /** @inheritdoc */
  get length() {
    return this.offset;
  }
  /** @inheritdoc */
  getRange(start, length) {
    const buf = VSBuffer.alloc(length);
    let bufLastWrite = 0;
    for (const chunk of this.getRangeIter(start, length)) {
      buf.buffer.set(chunk.buffer, bufLastWrite);
      bufLastWrite += chunk.byteLength;
    }
    return bufLastWrite < length ? buf.slice(0, bufLastWrite) : buf;
  }
  /** @inheritdoc */
  *getRangeIter(start, length) {
    let soFar = 0;
    let internalLastRead = 0;
    for (const b of this.buffers) {
      if (internalLastRead + b.byteLength <= start) {
        internalLastRead += b.byteLength;
        continue;
      }
      const bstart = Math.max(0, start - internalLastRead);
      const bend = Math.min(b.byteLength, bstart + length - soFar);
      yield b.slice(bstart, bend);
      soFar += bend - bstart;
      internalLastRead += b.byteLength;
      if (soFar === length) {
        break;
      }
    }
  }
  /**
   * Appends data to the output, returning the byte range where the data can be found.
   */
  append(data, marker) {
    const offset = this.offset;
    let length = data.byteLength;
    if (marker === void 0) {
      this.push(data);
      return { offset, length };
    }
    let TrimBytes;
    ((TrimBytes2) => {
      TrimBytes2[TrimBytes2["CR"] = 13] = "CR";
      TrimBytes2[TrimBytes2["LF"] = 10] = "LF";
    })(TrimBytes || (TrimBytes = {}));
    const start = VSBuffer.fromString(getMarkCode(marker, true));
    const end = VSBuffer.fromString(getMarkCode(marker, false));
    length += start.byteLength + end.byteLength;
    this.push(start);
    let trimLen = data.byteLength;
    for (; trimLen > 0; trimLen--) {
      const last = data.buffer[trimLen - 1];
      if (last !== 13 /* CR */ && last !== 10 /* LF */) {
        break;
      }
    }
    this.push(data.slice(0, trimLen));
    this.push(end);
    this.push(data.slice(trimLen));
    return { offset, length };
  }
  push(data) {
    if (data.byteLength === 0) {
      return;
    }
    this.buffers.push(data);
    this.writeDataEmitter.fire(data);
    this.offset += data.byteLength;
  }
  /** Signals the output has ended. */
  end() {
    this.endDeferred.complete();
  }
}
const resultItemParents = function* (results, item) {
  for (const id of TestId.fromString(item.item.extId).idsToRoot()) {
    yield results.getStateById(id.toString());
  }
};
const maxCountPriority = (counts) => {
  for (const state of statesInOrder) {
    if (counts[state] > 0) {
      return state;
    }
  }
  return TestResultState.Unset;
};
const getMarkCode = (marker, start) => `\x1B]633;SetMark;Id=${getMarkId(marker, start)};Hidden\x07`;
const itemToNode = (controllerId, item, parent) => ({
  controllerId,
  expand: TestItemExpandState.NotExpandable,
  item: { ...item },
  children: [],
  tasks: [],
  ownComputedState: TestResultState.Unset,
  computedState: TestResultState.Unset
});
var TestResultItemChangeReason = /* @__PURE__ */ ((TestResultItemChangeReason2) => {
  TestResultItemChangeReason2[TestResultItemChangeReason2["ComputedStateChange"] = 0] = "ComputedStateChange";
  TestResultItemChangeReason2[TestResultItemChangeReason2["OwnStateChange"] = 1] = "OwnStateChange";
  TestResultItemChangeReason2[TestResultItemChangeReason2["NewMessage"] = 2] = "NewMessage";
  return TestResultItemChangeReason2;
})(TestResultItemChangeReason || {});
let LiveTestResult = class extends Disposable {
  constructor(id, persist, request, insertOrder, telemetry) {
    super();
    this.id = id;
    this.persist = persist;
    this.request = request;
    this.insertOrder = insertOrder;
    this.telemetry = telemetry;
    this.completeEmitter = this._register(new Emitter());
    this.newTaskEmitter = this._register(new Emitter());
    this.endTaskEmitter = this._register(new Emitter());
    this.changeEmitter = this._register(new Emitter());
    /** todo@connor4312: convert to a WellDefinedPrefixTree */
    this.testById = /* @__PURE__ */ new Map();
    this.testMarkerCounter = 0;
    this.startedAt = Date.now();
    this.onChange = this.changeEmitter.event;
    this.onComplete = this.completeEmitter.event;
    this.onNewTask = this.newTaskEmitter.event;
    this.onEndTask = this.endTaskEmitter.event;
    this.tasks = [];
    this.name = localize("runFinished", "Test run at {0}", (/* @__PURE__ */ new Date()).toLocaleString(language));
    /**
     * @inheritdoc
     */
    this.counts = makeEmptyCounts();
    this.computedStateAccessor = {
      getOwnState: (i) => i.ownComputedState,
      getCurrentComputedState: (i) => i.computedState,
      setComputedState: (i, s) => i.computedState = s,
      getChildren: (i) => i.children,
      getParents: (i) => {
        const { testById: testByExtId } = this;
        return function* () {
          const parentId = TestId.fromString(i.item.extId).parentId;
          if (parentId) {
            for (const id of parentId.idsToRoot()) {
              yield testByExtId.get(id.toString());
            }
          }
        }();
      }
    };
    this.doSerialize = new Lazy(() => ({
      id: this.id,
      completedAt: this.completedAt,
      tasks: this.tasks.map((t) => ({ id: t.id, name: t.name, ctrlId: t.ctrlId, hasCoverage: !!t.coverage.get() })),
      name: this.name,
      request: this.request,
      items: [...this.testById.values()].map(TestResultItem.serializeWithoutMessages)
    }));
    this.doSerializeWithMessages = new Lazy(() => ({
      id: this.id,
      completedAt: this.completedAt,
      tasks: this.tasks.map((t) => ({ id: t.id, name: t.name, ctrlId: t.ctrlId, hasCoverage: !!t.coverage.get() })),
      name: this.name,
      request: this.request,
      items: [...this.testById.values()].map(TestResultItem.serialize)
    }));
  }
  /**
   * @inheritdoc
   */
  get completedAt() {
    return this._completedAt;
  }
  /**
   * @inheritdoc
   */
  get tests() {
    return this.testById.values();
  }
  /** Gets an included test item by ID. */
  getTestById(id) {
    return this.testById.get(id)?.item;
  }
  /**
   * @inheritdoc
   */
  getStateById(extTestId) {
    return this.testById.get(extTestId);
  }
  /**
   * Appends output that occurred during the test run.
   */
  appendOutput(output, taskId, location, testId) {
    const preview = output.byteLength > 100 ? output.slice(0, 100).toString() + "\u2026" : output.toString();
    let marker;
    if (testId || location) {
      marker = this.testMarkerCounter++;
    }
    const index = this.mustGetTaskIndex(taskId);
    const task = this.tasks[index];
    const { offset, length } = task.output.append(output, marker);
    const message = {
      location,
      message: preview,
      offset,
      length,
      marker,
      type: TestMessageType.Output
    };
    const test = testId && this.testById.get(testId);
    if (test) {
      test.tasks[index].messages.push(message);
      this.changeEmitter.fire({ item: test, result: this, reason: 2 /* NewMessage */, message });
    } else {
      task.otherMessages.push(message);
    }
  }
  /**
   * Adds a new run task to the results.
   */
  addTask(task) {
    this.tasks.push({ ...task, coverage: observableValue(this, void 0), otherMessages: [], output: new TaskRawOutput() });
    for (const test of this.tests) {
      test.tasks.push({ duration: void 0, messages: [], state: TestResultState.Unset });
    }
    this.newTaskEmitter.fire(this.tasks.length - 1);
  }
  /**
   * Add the chain of tests to the run. The first test in the chain should
   * be either a test root, or a previously-known test.
   */
  addTestChainToRun(controllerId, chain) {
    let parent = this.testById.get(chain[0].extId);
    if (!parent) {
      parent = this.addTestToRun(controllerId, chain[0], null);
    }
    for (let i = 1; i < chain.length; i++) {
      parent = this.addTestToRun(controllerId, chain[i], parent.item.extId);
    }
    return void 0;
  }
  /**
   * Updates the state of the test by its internal ID.
   */
  updateState(testId, taskId, state, duration) {
    const entry = this.testById.get(testId);
    if (!entry) {
      return;
    }
    const index = this.mustGetTaskIndex(taskId);
    const oldTerminalStatePrio = terminalStatePriorities[entry.tasks[index].state];
    const newTerminalStatePrio = terminalStatePriorities[state];
    if (oldTerminalStatePrio !== void 0 && (newTerminalStatePrio === void 0 || newTerminalStatePrio < oldTerminalStatePrio)) {
      return;
    }
    this.fireUpdateAndRefresh(entry, index, state, duration);
  }
  /**
   * Appends a message for the test in the run.
   */
  appendMessage(testId, taskId, message) {
    const entry = this.testById.get(testId);
    if (!entry) {
      return;
    }
    entry.tasks[this.mustGetTaskIndex(taskId)].messages.push(message);
    this.changeEmitter.fire({ item: entry, result: this, reason: 2 /* NewMessage */, message });
  }
  /**
   * Marks the task in the test run complete.
   */
  markTaskComplete(taskId) {
    const index = this.mustGetTaskIndex(taskId);
    const task = this.tasks[index];
    task.running = false;
    task.output.end();
    this.setAllToState(
      TestResultState.Unset,
      taskId,
      (t) => t.state === TestResultState.Queued || t.state === TestResultState.Running
    );
    this.endTaskEmitter.fire(index);
  }
  /**
   * Notifies the service that all tests are complete.
   */
  markComplete() {
    if (this._completedAt !== void 0) {
      throw new Error("cannot complete a test result multiple times");
    }
    for (const task of this.tasks) {
      if (task.running) {
        this.markTaskComplete(task.id);
      }
    }
    this._completedAt = Date.now();
    this.completeEmitter.fire();
    this.telemetry.publicLog2("test.outcomes", {
      failures: this.counts[TestResultState.Errored] + this.counts[TestResultState.Failed],
      passes: this.counts[TestResultState.Passed],
      controller: this.request.targets.map((t) => t.controllerId).join(",")
    });
  }
  /**
   * Marks the test and all of its children in the run as retired.
   */
  markRetired(testIds) {
    for (const [id, test] of this.testById) {
      if (!test.retired && (!testIds || testIds.hasKeyOrParent(TestId.fromString(id).path))) {
        test.retired = true;
        this.changeEmitter.fire({ reason: 0 /* ComputedStateChange */, item: test, result: this });
      }
    }
  }
  /**
   * @inheritdoc
   */
  toJSON() {
    return this.completedAt && this.persist ? this.doSerialize.value : void 0;
  }
  toJSONWithMessages() {
    return this.completedAt && this.persist ? this.doSerializeWithMessages.value : void 0;
  }
  /**
   * Updates all tests in the collection to the given state.
   */
  setAllToState(state, taskId, when) {
    const index = this.mustGetTaskIndex(taskId);
    for (const test of this.testById.values()) {
      if (when(test.tasks[index], test)) {
        this.fireUpdateAndRefresh(test, index, state);
      }
    }
  }
  fireUpdateAndRefresh(entry, taskIndex, newState, newOwnDuration) {
    const previousOwnComputed = entry.ownComputedState;
    const previousOwnDuration = entry.ownDuration;
    const changeEvent = {
      item: entry,
      result: this,
      reason: 1 /* OwnStateChange */,
      previousState: previousOwnComputed,
      previousOwnDuration
    };
    entry.tasks[taskIndex].state = newState;
    if (newOwnDuration !== void 0) {
      entry.tasks[taskIndex].duration = newOwnDuration;
      entry.ownDuration = Math.max(entry.ownDuration || 0, newOwnDuration);
    }
    const newOwnComputed = maxPriority(...entry.tasks.map((t) => t.state));
    if (newOwnComputed === previousOwnComputed) {
      if (newOwnDuration !== previousOwnDuration) {
        this.changeEmitter.fire(changeEvent);
      }
      return;
    }
    entry.ownComputedState = newOwnComputed;
    this.counts[previousOwnComputed]--;
    this.counts[newOwnComputed]++;
    refreshComputedState(this.computedStateAccessor, entry).forEach(
      (t) => this.changeEmitter.fire(t === entry ? changeEvent : {
        item: t,
        result: this,
        reason: 0 /* ComputedStateChange */
      })
    );
  }
  addTestToRun(controllerId, item, parent) {
    const node = itemToNode(controllerId, item, parent);
    this.testById.set(item.extId, node);
    this.counts[TestResultState.Unset]++;
    if (parent) {
      this.testById.get(parent)?.children.push(node);
    }
    if (this.tasks.length) {
      for (let i = 0; i < this.tasks.length; i++) {
        node.tasks.push({ duration: void 0, messages: [], state: TestResultState.Unset });
      }
    }
    return node;
  }
  mustGetTaskIndex(taskId) {
    const index = this.tasks.findIndex((t) => t.id === taskId);
    if (index === -1) {
      throw new Error(`Unknown task ${taskId} in updateState`);
    }
    return index;
  }
};
LiveTestResult = __decorateClass([
  __decorateParam(4, ITelemetryService)
], LiveTestResult);
class HydratedTestResult {
  constructor(identity, serialized, persist = true) {
    this.serialized = serialized;
    this.persist = persist;
    /**
     * @inheritdoc
     */
    this.counts = makeEmptyCounts();
    this.testById = /* @__PURE__ */ new Map();
    this.id = serialized.id;
    this.completedAt = serialized.completedAt;
    this.tasks = serialized.tasks.map((task, i) => ({
      id: task.id,
      name: task.name || localize("testUnnamedTask", "Unnamed Task"),
      ctrlId: task.ctrlId,
      running: false,
      coverage: observableValue(this, void 0),
      output: emptyRawOutput,
      otherMessages: []
    }));
    this.name = serialized.name;
    this.request = serialized.request;
    for (const item of serialized.items) {
      const de = TestResultItem.deserialize(identity, item);
      this.counts[de.ownComputedState]++;
      this.testById.set(item.item.extId, de);
    }
  }
  /**
   * @inheritdoc
   */
  get tests() {
    return this.testById.values();
  }
  /**
   * @inheritdoc
   */
  getStateById(extTestId) {
    return this.testById.get(extTestId);
  }
  /**
   * @inheritdoc
   */
  toJSON() {
    return this.persist ? this.serialized : void 0;
  }
  /**
   * @inheritdoc
   */
  toJSONWithMessages() {
    return this.toJSON();
  }
}
export {
  HydratedTestResult,
  LiveTestResult,
  TaskRawOutput,
  TestResultItemChangeReason,
  maxCountPriority,
  resultItemParents
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2NvbW1vbi90ZXN0UmVzdWx0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGVmZXJyZWRQcm9taXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBMYXp5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGF6eS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElPYnNlcnZhYmxlLCBvYnNlcnZhYmxlVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGxhbmd1YWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgV2VsbERlZmluZWRQcmVmaXhUcmVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcHJlZml4VHJlZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSUNvbXB1dGVkU3RhdGVBY2Nlc3NvciwgcmVmcmVzaENvbXB1dGVkU3RhdGUgfSBmcm9tICcuL2dldENvbXB1dGVkU3RhdGUuanMnO1xuaW1wb3J0IHsgVGVzdENvdmVyYWdlIH0gZnJvbSAnLi90ZXN0Q292ZXJhZ2UuanMnO1xuaW1wb3J0IHsgVGVzdElkIH0gZnJvbSAnLi90ZXN0SWQuanMnO1xuaW1wb3J0IHsgbWFrZUVtcHR5Q291bnRzLCBtYXhQcmlvcml0eSwgc3RhdGVzSW5PcmRlciwgdGVybWluYWxTdGF0ZVByaW9yaXRpZXMsIFRlc3RTdGF0ZUNvdW50IH0gZnJvbSAnLi90ZXN0aW5nU3RhdGVzLmpzJztcbmltcG9ydCB7IGdldE1hcmtJZCwgSVJpY2hMb2NhdGlvbiwgSVNlcmlhbGl6ZWRUZXN0UmVzdWx0cywgSVRlc3RJdGVtLCBJVGVzdE1lc3NhZ2UsIElUZXN0T3V0cHV0TWVzc2FnZSwgSVRlc3RSdW5UYXNrLCBJVGVzdFRhc2tTdGF0ZSwgUmVzb2x2ZWRUZXN0UnVuUmVxdWVzdCwgVGVzdEl0ZW1FeHBhbmRTdGF0ZSwgVGVzdE1lc3NhZ2VUeXBlLCBUZXN0UmVzdWx0SXRlbSwgVGVzdFJlc3VsdFN0YXRlIH0gZnJvbSAnLi90ZXN0VHlwZXMuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElUZXN0UnVuVGFza1Jlc3VsdHMgZXh0ZW5kcyBJVGVzdFJ1blRhc2sge1xuXHQvKipcblx0ICogQ29udGFpbnMgdGVzdCBjb3ZlcmFnZSBmb3IgdGhlIHJlc3VsdCwgaWYgaXQncyBhdmFpbGFibGUuXG5cdCAqL1xuXHRyZWFkb25seSBjb3ZlcmFnZTogSU9ic2VydmFibGU8VGVzdENvdmVyYWdlIHwgdW5kZWZpbmVkPjtcblxuXHQvKipcblx0ICogTWVzc2FnZXMgZnJvbSB0aGUgdGFzayBub3QgYXNzb2NpYXRlZCB3aXRoIGFueSBzcGVjaWZpYyB0ZXN0LlxuXHQgKi9cblx0cmVhZG9ubHkgb3RoZXJNZXNzYWdlczogSVRlc3RPdXRwdXRNZXNzYWdlW107XG5cblx0LyoqXG5cdCAqIFRlc3QgcmVzdWx0cyBvdXRwdXQgZm9yIHRoZSB0YXNrLlxuXHQgKi9cblx0cmVhZG9ubHkgb3V0cHV0OiBJVGFza1Jhd091dHB1dDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGVzdFJlc3VsdCB7XG5cdC8qKlxuXHQgKiBDb3VudCBvZiB0aGUgbnVtYmVyIG9mIHRlc3RzIGluIGVhY2ggcnVuIHN0YXRlLlxuXHQgKi9cblx0cmVhZG9ubHkgY291bnRzOiBSZWFkb25seTxUZXN0U3RhdGVDb3VudD47XG5cblx0LyoqXG5cdCAqIFVuaXF1ZSBJRCBvZiB0aGlzIHNldCBvZiB0ZXN0IHJlc3VsdHMuXG5cdCAqL1xuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBJZiB0aGUgdGVzdCBpcyBjb21wbGV0ZWQsIHRoZSB1bml4IG1pbGxpc2Vjb25kcyB0aW1lIGF0IHdoaWNoIGl0IHdhc1xuXHQgKiBjb21wbGV0ZWQuIElmIHVuZGVmaW5lZCwgdGhlIHRlc3QgaXMgc3RpbGwgcnVubmluZy5cblx0ICovXG5cdHJlYWRvbmx5IGNvbXBsZXRlZEF0OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgdGhpcyB0ZXN0IHJlc3VsdCBpcyB0cmlnZ2VyZWQgZnJvbSBhbiBhdXRvIHJ1bi5cblx0ICovXG5cdHJlYWRvbmx5IHJlcXVlc3Q6IFJlc29sdmVkVGVzdFJ1blJlcXVlc3Q7XG5cblx0LyoqXG5cdCAqIEh1bWFuLXJlYWRhYmxlIG5hbWUgb2YgdGhlIHRlc3QgcmVzdWx0LlxuXHQgKi9cblx0cmVhZG9ubHkgbmFtZTogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBHZXRzIGFsbCB0ZXN0cyBpbnZvbHZlZCBpbiB0aGUgcnVuLlxuXHQgKi9cblx0dGVzdHM6IEl0ZXJhYmxlSXRlcmF0b3I8VGVzdFJlc3VsdEl0ZW0+O1xuXG5cdC8qKlxuXHQgKiBMaXN0IG9mIHRoaXMgcmVzdWx0J3Mgc3VidGFza3MuXG5cdCAqL1xuXHR0YXNrczogUmVhZG9ubHlBcnJheTxJVGVzdFJ1blRhc2tSZXN1bHRzPjtcblxuXHQvKipcblx0ICogR2V0cyB0aGUgc3RhdGUgb2YgdGhlIHRlc3QgYnkgaXRzIGV4dGVuc2lvbi1hc3NpZ25lZCBJRC5cblx0ICovXG5cdGdldFN0YXRlQnlJZCh0ZXN0RXh0SWQ6IHN0cmluZyk6IFRlc3RSZXN1bHRJdGVtIHwgdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBTZXJpYWxpemVzIHRoZSB0ZXN0IHJlc3VsdC4gVXNlZCB0byBzYXZlIGFuZCByZXN0b3JlIHJlc3VsdHNcblx0ICogaW4gdGhlIHdvcmtzcGFjZS5cblx0ICovXG5cdHRvSlNPTigpOiBJU2VyaWFsaXplZFRlc3RSZXN1bHRzIHwgdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBTZXJpYWxpemVzIHRoZSB0ZXN0IHJlc3VsdCwgaW5jbHVkZXMgbWVzc2FnZXMuIFVzZWQgdG8gc2VuZCB0aGUgdGVzdCBzdGF0ZXMgdG8gdGhlIGV4dGVuc2lvbiBob3N0LlxuXHQgKi9cblx0dG9KU09OV2l0aE1lc3NhZ2VzKCk6IElTZXJpYWxpemVkVGVzdFJlc3VsdHMgfCB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogT3V0cHV0IHR5cGUgZXhwb3NlZCBmcm9tIGxpdmUgdGVzdCByZXN1bHRzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElUYXNrUmF3T3V0cHV0IHtcblx0cmVhZG9ubHkgb25EaWRXcml0ZURhdGE6IEV2ZW50PFZTQnVmZmVyPjtcblx0cmVhZG9ubHkgZW5kUHJvbWlzZTogUHJvbWlzZTx2b2lkPjtcblx0cmVhZG9ubHkgYnVmZmVyczogVlNCdWZmZXJbXTtcblx0cmVhZG9ubHkgbGVuZ3RoOiBudW1iZXI7XG5cblx0LyoqIEdldHMgYSBjb250aW51b3VzIGJ1ZmZlciBmb3IgdGhlIGRlc2lyZWQgcmFuZ2UgKi9cblx0Z2V0UmFuZ2Uoc3RhcnQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpOiBWU0J1ZmZlcjtcblx0LyoqIEdldHMgYW4gaXRlcmF0b3Igb2YgYnVmZmVycyBmb3IgdGhlIHJhbmdlOyBtYXkgYXZvaWQgYWxsb2NhdGlvbiBvZiBnZXRSYW5nZSgpICovXG5cdGdldFJhbmdlSXRlcihzdGFydDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcik6IEl0ZXJhYmxlPFZTQnVmZmVyPjtcbn1cblxuY29uc3QgZW1wdHlSYXdPdXRwdXQ6IElUYXNrUmF3T3V0cHV0ID0ge1xuXHRidWZmZXJzOiBbXSxcblx0bGVuZ3RoOiAwLFxuXHRvbkRpZFdyaXRlRGF0YTogRXZlbnQuTm9uZSxcblx0ZW5kUHJvbWlzZTogUHJvbWlzZS5yZXNvbHZlKCksXG5cdGdldFJhbmdlOiAoKSA9PiBWU0J1ZmZlci5hbGxvYygwKSxcblx0Z2V0UmFuZ2VJdGVyOiAoKSA9PiBbXSxcbn07XG5cbmV4cG9ydCBjbGFzcyBUYXNrUmF3T3V0cHV0IGltcGxlbWVudHMgSVRhc2tSYXdPdXRwdXQge1xuXHRwcml2YXRlIHJlYWRvbmx5IHdyaXRlRGF0YUVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxWU0J1ZmZlcj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBlbmREZWZlcnJlZCA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0cHJpdmF0ZSBvZmZzZXQgPSAwO1xuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRXcml0ZURhdGEgPSB0aGlzLndyaXRlRGF0YUVtaXR0ZXIuZXZlbnQ7XG5cblx0LyoqIEBpbmhlcml0ZG9jICovXG5cdHB1YmxpYyByZWFkb25seSBlbmRQcm9taXNlID0gdGhpcy5lbmREZWZlcnJlZC5wO1xuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgYnVmZmVyczogVlNCdWZmZXJbXSA9IFtdO1xuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgZ2V0IGxlbmd0aCgpIHtcblx0XHRyZXR1cm4gdGhpcy5vZmZzZXQ7XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0Z2V0UmFuZ2Uoc3RhcnQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpOiBWU0J1ZmZlciB7XG5cdFx0Y29uc3QgYnVmID0gVlNCdWZmZXIuYWxsb2MobGVuZ3RoKTtcblx0XHRsZXQgYnVmTGFzdFdyaXRlID0gMDtcblx0XHRmb3IgKGNvbnN0IGNodW5rIG9mIHRoaXMuZ2V0UmFuZ2VJdGVyKHN0YXJ0LCBsZW5ndGgpKSB7XG5cdFx0XHRidWYuYnVmZmVyLnNldChjaHVuay5idWZmZXIsIGJ1Zkxhc3RXcml0ZSk7XG5cdFx0XHRidWZMYXN0V3JpdGUgKz0gY2h1bmsuYnl0ZUxlbmd0aDtcblx0XHR9XG5cblx0XHRyZXR1cm4gYnVmTGFzdFdyaXRlIDwgbGVuZ3RoID8gYnVmLnNsaWNlKDAsIGJ1Zkxhc3RXcml0ZSkgOiBidWY7XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0KmdldFJhbmdlSXRlcihzdGFydDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcikge1xuXHRcdGxldCBzb0ZhciA9IDA7XG5cdFx0bGV0IGludGVybmFsTGFzdFJlYWQgPSAwO1xuXHRcdGZvciAoY29uc3QgYiBvZiB0aGlzLmJ1ZmZlcnMpIHtcblx0XHRcdGlmIChpbnRlcm5hbExhc3RSZWFkICsgYi5ieXRlTGVuZ3RoIDw9IHN0YXJ0KSB7XG5cdFx0XHRcdGludGVybmFsTGFzdFJlYWQgKz0gYi5ieXRlTGVuZ3RoO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgYnN0YXJ0ID0gTWF0aC5tYXgoMCwgc3RhcnQgLSBpbnRlcm5hbExhc3RSZWFkKTtcblx0XHRcdGNvbnN0IGJlbmQgPSBNYXRoLm1pbihiLmJ5dGVMZW5ndGgsIGJzdGFydCArIGxlbmd0aCAtIHNvRmFyKTtcblxuXHRcdFx0eWllbGQgYi5zbGljZShic3RhcnQsIGJlbmQpO1xuXHRcdFx0c29GYXIgKz0gYmVuZCAtIGJzdGFydDtcblx0XHRcdGludGVybmFsTGFzdFJlYWQgKz0gYi5ieXRlTGVuZ3RoO1xuXG5cdFx0XHRpZiAoc29GYXIgPT09IGxlbmd0aCkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQXBwZW5kcyBkYXRhIHRvIHRoZSBvdXRwdXQsIHJldHVybmluZyB0aGUgYnl0ZSByYW5nZSB3aGVyZSB0aGUgZGF0YSBjYW4gYmUgZm91bmQuXG5cdCAqL1xuXHRwdWJsaWMgYXBwZW5kKGRhdGE6IFZTQnVmZmVyLCBtYXJrZXI/OiBudW1iZXIpIHtcblx0XHRjb25zdCBvZmZzZXQgPSB0aGlzLm9mZnNldDtcblx0XHRsZXQgbGVuZ3RoID0gZGF0YS5ieXRlTGVuZ3RoO1xuXHRcdGlmIChtYXJrZXIgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5wdXNoKGRhdGEpO1xuXHRcdFx0cmV0dXJuIHsgb2Zmc2V0LCBsZW5ndGggfTtcblx0XHR9XG5cblx0XHQvLyBCeXRlcyB0aGF0IHNob3VsZCBiZSAndHJpbW1lZCcgb2ZmIHRoZSBlbmQgb2YgZGF0YS4gVGhpcyBpcyBkb25lIGJlY2F1c2Vcblx0XHQvLyBzZWxlY3Rpb25zIGluIHRoZSB0ZXJtaW5hbCBhcmUgYmFzZWQgb24gdGhlIGVudGlyZSBsaW5lLCBhbmQgY29tbW9ubHlcblx0XHQvLyB0aGUgaW50ZXJlc3RpbmcgbWFya2VkIHJhbmdlIGhhcyBhIHRyYWlsaW5nIG5ldyBsaW5lLiBXZSBkb24ndCB3YW50IHRvXG5cdFx0Ly8gc2VsZWN0IHRoZSB0cmFpbGluZyBsaW5lICh3aGljaCBtaWdodCBoYXZlIG90aGVyIGRhdGEpXG5cdFx0Ly8gc28gd2UgcGxhY2UgdGhlIG1hcmtlciBiZWZvcmUgYWxsIHRyYWlsaW5nIHRyaW1ieXRlcy5cblx0XHRjb25zdCBlbnVtIFRyaW1CeXRlcyB7XG5cdFx0XHRDUiA9IDEzLFxuXHRcdFx0TEYgPSAxMCxcblx0XHR9XG5cblx0XHRjb25zdCBzdGFydCA9IFZTQnVmZmVyLmZyb21TdHJpbmcoZ2V0TWFya0NvZGUobWFya2VyLCB0cnVlKSk7XG5cdFx0Y29uc3QgZW5kID0gVlNCdWZmZXIuZnJvbVN0cmluZyhnZXRNYXJrQ29kZShtYXJrZXIsIGZhbHNlKSk7XG5cdFx0bGVuZ3RoICs9IHN0YXJ0LmJ5dGVMZW5ndGggKyBlbmQuYnl0ZUxlbmd0aDtcblxuXHRcdHRoaXMucHVzaChzdGFydCk7XG5cdFx0bGV0IHRyaW1MZW4gPSBkYXRhLmJ5dGVMZW5ndGg7XG5cdFx0Zm9yICg7IHRyaW1MZW4gPiAwOyB0cmltTGVuLS0pIHtcblx0XHRcdGNvbnN0IGxhc3QgPSBkYXRhLmJ1ZmZlclt0cmltTGVuIC0gMV07XG5cdFx0XHRpZiAobGFzdCAhPT0gVHJpbUJ5dGVzLkNSICYmIGxhc3QgIT09IFRyaW1CeXRlcy5MRikge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLnB1c2goZGF0YS5zbGljZSgwLCB0cmltTGVuKSk7XG5cdFx0dGhpcy5wdXNoKGVuZCk7XG5cdFx0dGhpcy5wdXNoKGRhdGEuc2xpY2UodHJpbUxlbikpO1xuXG5cblx0XHRyZXR1cm4geyBvZmZzZXQsIGxlbmd0aCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBwdXNoKGRhdGE6IFZTQnVmZmVyKSB7XG5cdFx0aWYgKGRhdGEuYnl0ZUxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuYnVmZmVycy5wdXNoKGRhdGEpO1xuXHRcdHRoaXMud3JpdGVEYXRhRW1pdHRlci5maXJlKGRhdGEpO1xuXHRcdHRoaXMub2Zmc2V0ICs9IGRhdGEuYnl0ZUxlbmd0aDtcblx0fVxuXG5cdC8qKiBTaWduYWxzIHRoZSBvdXRwdXQgaGFzIGVuZGVkLiAqL1xuXHRwdWJsaWMgZW5kKCkge1xuXHRcdHRoaXMuZW5kRGVmZXJyZWQuY29tcGxldGUoKTtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgcmVzdWx0SXRlbVBhcmVudHMgPSBmdW5jdGlvbiogKHJlc3VsdHM6IElUZXN0UmVzdWx0LCBpdGVtOiBUZXN0UmVzdWx0SXRlbSkge1xuXHRmb3IgKGNvbnN0IGlkIG9mIFRlc3RJZC5mcm9tU3RyaW5nKGl0ZW0uaXRlbS5leHRJZCkuaWRzVG9Sb290KCkpIHtcblx0XHR5aWVsZCByZXN1bHRzLmdldFN0YXRlQnlJZChpZC50b1N0cmluZygpKSE7XG5cdH1cbn07XG5cbmV4cG9ydCBjb25zdCBtYXhDb3VudFByaW9yaXR5ID0gKGNvdW50czogUmVhZG9ubHk8VGVzdFN0YXRlQ291bnQ+KSA9PiB7XG5cdGZvciAoY29uc3Qgc3RhdGUgb2Ygc3RhdGVzSW5PcmRlcikge1xuXHRcdGlmIChjb3VudHNbc3RhdGVdID4gMCkge1xuXHRcdFx0cmV0dXJuIHN0YXRlO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBUZXN0UmVzdWx0U3RhdGUuVW5zZXQ7XG59O1xuXG5jb25zdCBnZXRNYXJrQ29kZSA9IChtYXJrZXI6IG51bWJlciwgc3RhcnQ6IGJvb2xlYW4pID0+IGBcXHgxYl02MzM7U2V0TWFyaztJZD0ke2dldE1hcmtJZChtYXJrZXIsIHN0YXJ0KX07SGlkZGVuXFx4MDdgO1xuXG5pbnRlcmZhY2UgVGVzdFJlc3VsdEl0ZW1XaXRoQ2hpbGRyZW4gZXh0ZW5kcyBUZXN0UmVzdWx0SXRlbSB7XG5cdC8qKiBDaGlsZHJlbiBpbiB0aGUgcnVuICovXG5cdGNoaWxkcmVuOiBUZXN0UmVzdWx0SXRlbVdpdGhDaGlsZHJlbltdO1xufVxuXG5jb25zdCBpdGVtVG9Ob2RlID0gKGNvbnRyb2xsZXJJZDogc3RyaW5nLCBpdGVtOiBJVGVzdEl0ZW0sIHBhcmVudDogc3RyaW5nIHwgbnVsbCk6IFRlc3RSZXN1bHRJdGVtV2l0aENoaWxkcmVuID0+ICh7XG5cdGNvbnRyb2xsZXJJZCxcblx0ZXhwYW5kOiBUZXN0SXRlbUV4cGFuZFN0YXRlLk5vdEV4cGFuZGFibGUsXG5cdGl0ZW06IHsgLi4uaXRlbSB9LFxuXHRjaGlsZHJlbjogW10sXG5cdHRhc2tzOiBbXSxcblx0b3duQ29tcHV0ZWRTdGF0ZTogVGVzdFJlc3VsdFN0YXRlLlVuc2V0LFxuXHRjb21wdXRlZFN0YXRlOiBUZXN0UmVzdWx0U3RhdGUuVW5zZXQsXG59KTtcblxuZXhwb3J0IGNvbnN0IGVudW0gVGVzdFJlc3VsdEl0ZW1DaGFuZ2VSZWFzb24ge1xuXHRDb21wdXRlZFN0YXRlQ2hhbmdlLFxuXHRPd25TdGF0ZUNoYW5nZSxcblx0TmV3TWVzc2FnZSxcbn1cblxuZXhwb3J0IHR5cGUgVGVzdFJlc3VsdEl0ZW1DaGFuZ2UgPSB7IGl0ZW06IFRlc3RSZXN1bHRJdGVtOyByZXN1bHQ6IElUZXN0UmVzdWx0IH0gJiAoXG5cdHwgeyByZWFzb246IFRlc3RSZXN1bHRJdGVtQ2hhbmdlUmVhc29uLkNvbXB1dGVkU3RhdGVDaGFuZ2UgfVxuXHR8IHsgcmVhc29uOiBUZXN0UmVzdWx0SXRlbUNoYW5nZVJlYXNvbi5Pd25TdGF0ZUNoYW5nZTsgcHJldmlvdXNTdGF0ZTogVGVzdFJlc3VsdFN0YXRlOyBwcmV2aW91c093bkR1cmF0aW9uOiBudW1iZXIgfCB1bmRlZmluZWQgfVxuXHR8IHsgcmVhc29uOiBUZXN0UmVzdWx0SXRlbUNoYW5nZVJlYXNvbi5OZXdNZXNzYWdlOyBtZXNzYWdlOiBJVGVzdE1lc3NhZ2UgfVxuKTtcblxuLyoqXG4gKiBSZXN1bHRzIG9mIGEgdGVzdC4gVGhlc2UgYXJlIGNyZWF0ZWQgd2hlbiB0aGUgdGVzdCBpbml0aWFsbHkgc3RhcnRlZCBydW5uaW5nXG4gKiBhbmQgbWFya2VkIGFzIFwiY29tcGxldGVcIiB3aGVuIHRoZSBydW4gZmluaXNoZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBMaXZlVGVzdFJlc3VsdCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVGVzdFJlc3VsdCB7XG5cdHByaXZhdGUgcmVhZG9ubHkgY29tcGxldGVFbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgbmV3VGFza0VtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGVuZFRhc2tFbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBjaGFuZ2VFbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8VGVzdFJlc3VsdEl0ZW1DaGFuZ2U+KCkpO1xuXHQvKiogdG9kb0Bjb25ub3I0MzEyOiBjb252ZXJ0IHRvIGEgV2VsbERlZmluZWRQcmVmaXhUcmVlICovXG5cdHByaXZhdGUgcmVhZG9ubHkgdGVzdEJ5SWQgPSBuZXcgTWFwPHN0cmluZywgVGVzdFJlc3VsdEl0ZW1XaXRoQ2hpbGRyZW4+KCk7XG5cdHByaXZhdGUgdGVzdE1hcmtlckNvdW50ZXIgPSAwO1xuXHRwcml2YXRlIF9jb21wbGV0ZWRBdD86IG51bWJlcjtcblxuXHRwdWJsaWMgcmVhZG9ubHkgc3RhcnRlZEF0ID0gRGF0ZS5ub3coKTtcblx0cHVibGljIHJlYWRvbmx5IG9uQ2hhbmdlID0gdGhpcy5jaGFuZ2VFbWl0dGVyLmV2ZW50O1xuXHRwdWJsaWMgcmVhZG9ubHkgb25Db21wbGV0ZSA9IHRoaXMuY29tcGxldGVFbWl0dGVyLmV2ZW50O1xuXHRwdWJsaWMgcmVhZG9ubHkgb25OZXdUYXNrID0gdGhpcy5uZXdUYXNrRW1pdHRlci5ldmVudDtcblx0cHVibGljIHJlYWRvbmx5IG9uRW5kVGFzayA9IHRoaXMuZW5kVGFza0VtaXR0ZXIuZXZlbnQ7XG5cdHB1YmxpYyByZWFkb25seSB0YXNrczogKElUZXN0UnVuVGFza1Jlc3VsdHMgJiB7IG91dHB1dDogVGFza1Jhd091dHB1dCB9KVtdID0gW107XG5cdHB1YmxpYyByZWFkb25seSBuYW1lID0gbG9jYWxpemUoJ3J1bkZpbmlzaGVkJywgJ1Rlc3QgcnVuIGF0IHswfScsIG5ldyBEYXRlKCkudG9Mb2NhbGVTdHJpbmcobGFuZ3VhZ2UpKTtcblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyBnZXQgY29tcGxldGVkQXQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbXBsZXRlZEF0O1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgY291bnRzID0gbWFrZUVtcHR5Q291bnRzKCk7XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IHRlc3RzKCkge1xuXHRcdHJldHVybiB0aGlzLnRlc3RCeUlkLnZhbHVlcygpO1xuXHR9XG5cblx0LyoqIEdldHMgYW4gaW5jbHVkZWQgdGVzdCBpdGVtIGJ5IElELiAqL1xuXHRwdWJsaWMgZ2V0VGVzdEJ5SWQoaWQ6IHN0cmluZykge1xuXHRcdHJldHVybiB0aGlzLnRlc3RCeUlkLmdldChpZCk/Lml0ZW07XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IGNvbXB1dGVkU3RhdGVBY2Nlc3NvcjogSUNvbXB1dGVkU3RhdGVBY2Nlc3NvcjxUZXN0UmVzdWx0SXRlbVdpdGhDaGlsZHJlbj4gPSB7XG5cdFx0Z2V0T3duU3RhdGU6IGkgPT4gaS5vd25Db21wdXRlZFN0YXRlLFxuXHRcdGdldEN1cnJlbnRDb21wdXRlZFN0YXRlOiBpID0+IGkuY29tcHV0ZWRTdGF0ZSxcblx0XHRzZXRDb21wdXRlZFN0YXRlOiAoaSwgcykgPT4gaS5jb21wdXRlZFN0YXRlID0gcyxcblx0XHRnZXRDaGlsZHJlbjogaSA9PiBpLmNoaWxkcmVuLFxuXHRcdGdldFBhcmVudHM6IGkgPT4ge1xuXHRcdFx0Y29uc3QgeyB0ZXN0QnlJZDogdGVzdEJ5RXh0SWQgfSA9IHRoaXM7XG5cdFx0XHRyZXR1cm4gKGZ1bmN0aW9uKiAoKSB7XG5cdFx0XHRcdGNvbnN0IHBhcmVudElkID0gVGVzdElkLmZyb21TdHJpbmcoaS5pdGVtLmV4dElkKS5wYXJlbnRJZDtcblx0XHRcdFx0aWYgKHBhcmVudElkKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBpZCBvZiBwYXJlbnRJZC5pZHNUb1Jvb3QoKSkge1xuXHRcdFx0XHRcdFx0eWllbGQgdGVzdEJ5RXh0SWQuZ2V0KGlkLnRvU3RyaW5nKCkpITtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pKCk7XG5cdFx0fSxcblx0fTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgaWQ6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcGVyc2lzdDogYm9vbGVhbixcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVxdWVzdDogUmVzb2x2ZWRUZXN0UnVuUmVxdWVzdCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgaW5zZXJ0T3JkZXI6IG51bWJlcixcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnk6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgZ2V0U3RhdGVCeUlkKGV4dFRlc3RJZDogc3RyaW5nKSB7XG5cdFx0cmV0dXJuIHRoaXMudGVzdEJ5SWQuZ2V0KGV4dFRlc3RJZCk7XG5cdH1cblxuXHQvKipcblx0ICogQXBwZW5kcyBvdXRwdXQgdGhhdCBvY2N1cnJlZCBkdXJpbmcgdGhlIHRlc3QgcnVuLlxuXHQgKi9cblx0cHVibGljIGFwcGVuZE91dHB1dChvdXRwdXQ6IFZTQnVmZmVyLCB0YXNrSWQ6IHN0cmluZywgbG9jYXRpb24/OiBJUmljaExvY2F0aW9uLCB0ZXN0SWQ/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBwcmV2aWV3ID0gb3V0cHV0LmJ5dGVMZW5ndGggPiAxMDAgPyBvdXRwdXQuc2xpY2UoMCwgMTAwKS50b1N0cmluZygpICsgJ1x1MjAyNicgOiBvdXRwdXQudG9TdHJpbmcoKTtcblx0XHRsZXQgbWFya2VyOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cblx0XHQvLyBjdXJyZW50bHksIHRoZSBVSSBvbmx5IGV4cG9zZXMganVtcC10by1tZXNzYWdlIGZyb20gdGVzdHMgb3IgbG9jYXRpb25zLFxuXHRcdC8vIHNvIG5vIG5lZWQgdG8gbWFyayBvdXRwdXRzIHRoYXQgZG9uJ3QgY29tZSBmcm9tIGVpdGhlciBvZiB0aG9zZS5cblx0XHRpZiAodGVzdElkIHx8IGxvY2F0aW9uKSB7XG5cdFx0XHRtYXJrZXIgPSB0aGlzLnRlc3RNYXJrZXJDb3VudGVyKys7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLm11c3RHZXRUYXNrSW5kZXgodGFza0lkKTtcblx0XHRjb25zdCB0YXNrID0gdGhpcy50YXNrc1tpbmRleF07XG5cblx0XHRjb25zdCB7IG9mZnNldCwgbGVuZ3RoIH0gPSB0YXNrLm91dHB1dC5hcHBlbmQob3V0cHV0LCBtYXJrZXIpO1xuXHRcdGNvbnN0IG1lc3NhZ2U6IElUZXN0T3V0cHV0TWVzc2FnZSA9IHtcblx0XHRcdGxvY2F0aW9uLFxuXHRcdFx0bWVzc2FnZTogcHJldmlldyxcblx0XHRcdG9mZnNldCxcblx0XHRcdGxlbmd0aCxcblx0XHRcdG1hcmtlcixcblx0XHRcdHR5cGU6IFRlc3RNZXNzYWdlVHlwZS5PdXRwdXQsXG5cdFx0fTtcblxuXHRcdGNvbnN0IHRlc3QgPSB0ZXN0SWQgJiYgdGhpcy50ZXN0QnlJZC5nZXQodGVzdElkKTtcblx0XHRpZiAodGVzdCkge1xuXHRcdFx0dGVzdC50YXNrc1tpbmRleF0ubWVzc2FnZXMucHVzaChtZXNzYWdlKTtcblx0XHRcdHRoaXMuY2hhbmdlRW1pdHRlci5maXJlKHsgaXRlbTogdGVzdCwgcmVzdWx0OiB0aGlzLCByZWFzb246IFRlc3RSZXN1bHRJdGVtQ2hhbmdlUmVhc29uLk5ld01lc3NhZ2UsIG1lc3NhZ2UgfSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRhc2sub3RoZXJNZXNzYWdlcy5wdXNoKG1lc3NhZ2UpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBBZGRzIGEgbmV3IHJ1biB0YXNrIHRvIHRoZSByZXN1bHRzLlxuXHQgKi9cblx0cHVibGljIGFkZFRhc2sodGFzazogSVRlc3RSdW5UYXNrKSB7XG5cdFx0dGhpcy50YXNrcy5wdXNoKHsgLi4udGFzaywgY292ZXJhZ2U6IG9ic2VydmFibGVWYWx1ZSh0aGlzLCB1bmRlZmluZWQpLCBvdGhlck1lc3NhZ2VzOiBbXSwgb3V0cHV0OiBuZXcgVGFza1Jhd091dHB1dCgpIH0pO1xuXG5cdFx0Zm9yIChjb25zdCB0ZXN0IG9mIHRoaXMudGVzdHMpIHtcblx0XHRcdHRlc3QudGFza3MucHVzaCh7IGR1cmF0aW9uOiB1bmRlZmluZWQsIG1lc3NhZ2VzOiBbXSwgc3RhdGU6IFRlc3RSZXN1bHRTdGF0ZS5VbnNldCB9KTtcblx0XHR9XG5cblx0XHR0aGlzLm5ld1Rhc2tFbWl0dGVyLmZpcmUodGhpcy50YXNrcy5sZW5ndGggLSAxKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGQgdGhlIGNoYWluIG9mIHRlc3RzIHRvIHRoZSBydW4uIFRoZSBmaXJzdCB0ZXN0IGluIHRoZSBjaGFpbiBzaG91bGRcblx0ICogYmUgZWl0aGVyIGEgdGVzdCByb290LCBvciBhIHByZXZpb3VzbHkta25vd24gdGVzdC5cblx0ICovXG5cdHB1YmxpYyBhZGRUZXN0Q2hhaW5Ub1J1bihjb250cm9sbGVySWQ6IHN0cmluZywgY2hhaW46IFJlYWRvbmx5QXJyYXk8SVRlc3RJdGVtPikge1xuXHRcdGxldCBwYXJlbnQgPSB0aGlzLnRlc3RCeUlkLmdldChjaGFpblswXS5leHRJZCk7XG5cdFx0aWYgKCFwYXJlbnQpIHsgLy8gbXVzdCBiZSBhIHRlc3Qgcm9vdFxuXHRcdFx0cGFyZW50ID0gdGhpcy5hZGRUZXN0VG9SdW4oY29udHJvbGxlcklkLCBjaGFpblswXSwgbnVsbCk7XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCBjaGFpbi5sZW5ndGg7IGkrKykge1xuXHRcdFx0cGFyZW50ID0gdGhpcy5hZGRUZXN0VG9SdW4oY29udHJvbGxlcklkLCBjaGFpbltpXSwgcGFyZW50Lml0ZW0uZXh0SWQpO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHQvKipcblx0ICogVXBkYXRlcyB0aGUgc3RhdGUgb2YgdGhlIHRlc3QgYnkgaXRzIGludGVybmFsIElELlxuXHQgKi9cblx0cHVibGljIHVwZGF0ZVN0YXRlKHRlc3RJZDogc3RyaW5nLCB0YXNrSWQ6IHN0cmluZywgc3RhdGU6IFRlc3RSZXN1bHRTdGF0ZSwgZHVyYXRpb24/OiBudW1iZXIpIHtcblx0XHRjb25zdCBlbnRyeSA9IHRoaXMudGVzdEJ5SWQuZ2V0KHRlc3RJZCk7XG5cdFx0aWYgKCFlbnRyeSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5tdXN0R2V0VGFza0luZGV4KHRhc2tJZCk7XG5cblx0XHRjb25zdCBvbGRUZXJtaW5hbFN0YXRlUHJpbyA9IHRlcm1pbmFsU3RhdGVQcmlvcml0aWVzW2VudHJ5LnRhc2tzW2luZGV4XS5zdGF0ZV07XG5cdFx0Y29uc3QgbmV3VGVybWluYWxTdGF0ZVByaW8gPSB0ZXJtaW5hbFN0YXRlUHJpb3JpdGllc1tzdGF0ZV07XG5cblx0XHQvLyBJZ25vcmUgcmVxdWVzdHMgdG8gc2V0IHRoZSBzdGF0ZSBmcm9tIG9uZSB0ZXJtaW5hbCBzdGF0ZSBiYWNrIHRvIGFcblx0XHQvLyBcImxvd2VyXCIgb25lLCBlLmcuIGZyb20gZmFpbGVkIGJhY2sgdG8gcGFzc2VkOlxuXHRcdGlmIChvbGRUZXJtaW5hbFN0YXRlUHJpbyAhPT0gdW5kZWZpbmVkICYmXG5cdFx0XHQobmV3VGVybWluYWxTdGF0ZVByaW8gPT09IHVuZGVmaW5lZCB8fCBuZXdUZXJtaW5hbFN0YXRlUHJpbyA8IG9sZFRlcm1pbmFsU3RhdGVQcmlvKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuZmlyZVVwZGF0ZUFuZFJlZnJlc2goZW50cnksIGluZGV4LCBzdGF0ZSwgZHVyYXRpb24pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFwcGVuZHMgYSBtZXNzYWdlIGZvciB0aGUgdGVzdCBpbiB0aGUgcnVuLlxuXHQgKi9cblx0cHVibGljIGFwcGVuZE1lc3NhZ2UodGVzdElkOiBzdHJpbmcsIHRhc2tJZDogc3RyaW5nLCBtZXNzYWdlOiBJVGVzdE1lc3NhZ2UpIHtcblx0XHRjb25zdCBlbnRyeSA9IHRoaXMudGVzdEJ5SWQuZ2V0KHRlc3RJZCk7XG5cdFx0aWYgKCFlbnRyeSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGVudHJ5LnRhc2tzW3RoaXMubXVzdEdldFRhc2tJbmRleCh0YXNrSWQpXS5tZXNzYWdlcy5wdXNoKG1lc3NhZ2UpO1xuXHRcdHRoaXMuY2hhbmdlRW1pdHRlci5maXJlKHsgaXRlbTogZW50cnksIHJlc3VsdDogdGhpcywgcmVhc29uOiBUZXN0UmVzdWx0SXRlbUNoYW5nZVJlYXNvbi5OZXdNZXNzYWdlLCBtZXNzYWdlIH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIE1hcmtzIHRoZSB0YXNrIGluIHRoZSB0ZXN0IHJ1biBjb21wbGV0ZS5cblx0ICovXG5cdHB1YmxpYyBtYXJrVGFza0NvbXBsZXRlKHRhc2tJZDogc3RyaW5nKSB7XG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLm11c3RHZXRUYXNrSW5kZXgodGFza0lkKTtcblx0XHRjb25zdCB0YXNrID0gdGhpcy50YXNrc1tpbmRleF07XG5cdFx0dGFzay5ydW5uaW5nID0gZmFsc2U7XG5cdFx0dGFzay5vdXRwdXQuZW5kKCk7XG5cblx0XHR0aGlzLnNldEFsbFRvU3RhdGUoXG5cdFx0XHRUZXN0UmVzdWx0U3RhdGUuVW5zZXQsXG5cdFx0XHR0YXNrSWQsXG5cdFx0XHR0ID0+IHQuc3RhdGUgPT09IFRlc3RSZXN1bHRTdGF0ZS5RdWV1ZWQgfHwgdC5zdGF0ZSA9PT0gVGVzdFJlc3VsdFN0YXRlLlJ1bm5pbmcsXG5cdFx0KTtcblxuXHRcdHRoaXMuZW5kVGFza0VtaXR0ZXIuZmlyZShpbmRleCk7XG5cdH1cblxuXHQvKipcblx0ICogTm90aWZpZXMgdGhlIHNlcnZpY2UgdGhhdCBhbGwgdGVzdHMgYXJlIGNvbXBsZXRlLlxuXHQgKi9cblx0cHVibGljIG1hcmtDb21wbGV0ZSgpIHtcblx0XHRpZiAodGhpcy5fY29tcGxldGVkQXQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdjYW5ub3QgY29tcGxldGUgYSB0ZXN0IHJlc3VsdCBtdWx0aXBsZSB0aW1lcycpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgdGFzayBvZiB0aGlzLnRhc2tzKSB7XG5cdFx0XHRpZiAodGFzay5ydW5uaW5nKSB7XG5cdFx0XHRcdHRoaXMubWFya1Rhc2tDb21wbGV0ZSh0YXNrLmlkKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9jb21wbGV0ZWRBdCA9IERhdGUubm93KCk7XG5cdFx0dGhpcy5jb21wbGV0ZUVtaXR0ZXIuZmlyZSgpO1xuXG5cdFx0dGhpcy50ZWxlbWV0cnkucHVibGljTG9nMjxcblx0XHRcdHsgZmFpbHVyZXM6IG51bWJlcjsgcGFzc2VzOiBudW1iZXI7IGNvbnRyb2xsZXI6IHN0cmluZyB9LFxuXHRcdFx0e1xuXHRcdFx0XHRvd25lcjogJ2Nvbm5vcjQzMTInO1xuXHRcdFx0XHRjb21tZW50OiAnVGVzdCBvdXRjb21lIG1ldHJpY3MuIFRoaXMgaGVscHMgdXMgdW5kZXJzdGFuZCBtYWduaXR1ZGUgb2YgZmVhdHVyZSB1c2UgYW5kIGhvdyB0byBidWlsZCBmaXggc3VnZ2VzdGlvbnMuJztcblx0XHRcdFx0ZmFpbHVyZXM6IHsgY29tbWVudDogJ051bWJlciBvZiB0ZXN0IGZhaWx1cmVzJzsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCcgfTtcblx0XHRcdFx0cGFzc2VzOiB7IGNvbW1lbnQ6ICdOdW1iZXIgb2YgdGVzdCBmYWlsdXJlcyc7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnIH07XG5cdFx0XHRcdGNvbnRyb2xsZXI6IHsgY29tbWVudDogJ1RoZSB0ZXN0IGNvbnRyb2xsZXIgYmVpbmcgdXNlZCc7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnIH07XG5cdFx0XHR9XG5cdFx0PigndGVzdC5vdXRjb21lcycsIHtcblx0XHRcdGZhaWx1cmVzOiB0aGlzLmNvdW50c1tUZXN0UmVzdWx0U3RhdGUuRXJyb3JlZF0gKyB0aGlzLmNvdW50c1tUZXN0UmVzdWx0U3RhdGUuRmFpbGVkXSxcblx0XHRcdHBhc3NlczogdGhpcy5jb3VudHNbVGVzdFJlc3VsdFN0YXRlLlBhc3NlZF0sXG5cdFx0XHRjb250cm9sbGVyOiB0aGlzLnJlcXVlc3QudGFyZ2V0cy5tYXAodCA9PiB0LmNvbnRyb2xsZXJJZCkuam9pbignLCcpXG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogTWFya3MgdGhlIHRlc3QgYW5kIGFsbCBvZiBpdHMgY2hpbGRyZW4gaW4gdGhlIHJ1biBhcyByZXRpcmVkLlxuXHQgKi9cblx0cHVibGljIG1hcmtSZXRpcmVkKHRlc3RJZHM6IFdlbGxEZWZpbmVkUHJlZml4VHJlZTx1bmRlZmluZWQ+IHwgdW5kZWZpbmVkKSB7XG5cdFx0Zm9yIChjb25zdCBbaWQsIHRlc3RdIG9mIHRoaXMudGVzdEJ5SWQpIHtcblx0XHRcdGlmICghdGVzdC5yZXRpcmVkICYmICghdGVzdElkcyB8fCB0ZXN0SWRzLmhhc0tleU9yUGFyZW50KFRlc3RJZC5mcm9tU3RyaW5nKGlkKS5wYXRoKSkpIHtcblx0XHRcdFx0dGVzdC5yZXRpcmVkID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5jaGFuZ2VFbWl0dGVyLmZpcmUoeyByZWFzb246IFRlc3RSZXN1bHRJdGVtQ2hhbmdlUmVhc29uLkNvbXB1dGVkU3RhdGVDaGFuZ2UsIGl0ZW06IHRlc3QsIHJlc3VsdDogdGhpcyB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyB0b0pTT04oKTogSVNlcmlhbGl6ZWRUZXN0UmVzdWx0cyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuY29tcGxldGVkQXQgJiYgdGhpcy5wZXJzaXN0ID8gdGhpcy5kb1NlcmlhbGl6ZS52YWx1ZSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdHB1YmxpYyB0b0pTT05XaXRoTWVzc2FnZXMoKTogSVNlcmlhbGl6ZWRUZXN0UmVzdWx0cyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuY29tcGxldGVkQXQgJiYgdGhpcy5wZXJzaXN0ID8gdGhpcy5kb1NlcmlhbGl6ZVdpdGhNZXNzYWdlcy52YWx1ZSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBVcGRhdGVzIGFsbCB0ZXN0cyBpbiB0aGUgY29sbGVjdGlvbiB0byB0aGUgZ2l2ZW4gc3RhdGUuXG5cdCAqL1xuXHRwcm90ZWN0ZWQgc2V0QWxsVG9TdGF0ZShzdGF0ZTogVGVzdFJlc3VsdFN0YXRlLCB0YXNrSWQ6IHN0cmluZywgd2hlbjogKHRhc2s6IElUZXN0VGFza1N0YXRlLCBpdGVtOiBUZXN0UmVzdWx0SXRlbSkgPT4gYm9vbGVhbikge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5tdXN0R2V0VGFza0luZGV4KHRhc2tJZCk7XG5cdFx0Zm9yIChjb25zdCB0ZXN0IG9mIHRoaXMudGVzdEJ5SWQudmFsdWVzKCkpIHtcblx0XHRcdGlmICh3aGVuKHRlc3QudGFza3NbaW5kZXhdLCB0ZXN0KSkge1xuXHRcdFx0XHR0aGlzLmZpcmVVcGRhdGVBbmRSZWZyZXNoKHRlc3QsIGluZGV4LCBzdGF0ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBmaXJlVXBkYXRlQW5kUmVmcmVzaChlbnRyeTogVGVzdFJlc3VsdEl0ZW0sIHRhc2tJbmRleDogbnVtYmVyLCBuZXdTdGF0ZTogVGVzdFJlc3VsdFN0YXRlLCBuZXdPd25EdXJhdGlvbj86IG51bWJlcikge1xuXHRcdGNvbnN0IHByZXZpb3VzT3duQ29tcHV0ZWQgPSBlbnRyeS5vd25Db21wdXRlZFN0YXRlO1xuXHRcdGNvbnN0IHByZXZpb3VzT3duRHVyYXRpb24gPSBlbnRyeS5vd25EdXJhdGlvbjtcblx0XHRjb25zdCBjaGFuZ2VFdmVudDogVGVzdFJlc3VsdEl0ZW1DaGFuZ2UgPSB7XG5cdFx0XHRpdGVtOiBlbnRyeSxcblx0XHRcdHJlc3VsdDogdGhpcyxcblx0XHRcdHJlYXNvbjogVGVzdFJlc3VsdEl0ZW1DaGFuZ2VSZWFzb24uT3duU3RhdGVDaGFuZ2UsXG5cdFx0XHRwcmV2aW91c1N0YXRlOiBwcmV2aW91c093bkNvbXB1dGVkLFxuXHRcdFx0cHJldmlvdXNPd25EdXJhdGlvbjogcHJldmlvdXNPd25EdXJhdGlvbixcblx0XHR9O1xuXG5cdFx0ZW50cnkudGFza3NbdGFza0luZGV4XS5zdGF0ZSA9IG5ld1N0YXRlO1xuXHRcdGlmIChuZXdPd25EdXJhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRlbnRyeS50YXNrc1t0YXNrSW5kZXhdLmR1cmF0aW9uID0gbmV3T3duRHVyYXRpb247XG5cdFx0XHRlbnRyeS5vd25EdXJhdGlvbiA9IE1hdGgubWF4KGVudHJ5Lm93bkR1cmF0aW9uIHx8IDAsIG5ld093bkR1cmF0aW9uKTtcblx0XHR9XG5cblx0XHRjb25zdCBuZXdPd25Db21wdXRlZCA9IG1heFByaW9yaXR5KC4uLmVudHJ5LnRhc2tzLm1hcCh0ID0+IHQuc3RhdGUpKTtcblx0XHRpZiAobmV3T3duQ29tcHV0ZWQgPT09IHByZXZpb3VzT3duQ29tcHV0ZWQpIHtcblx0XHRcdGlmIChuZXdPd25EdXJhdGlvbiAhPT0gcHJldmlvdXNPd25EdXJhdGlvbikge1xuXHRcdFx0XHR0aGlzLmNoYW5nZUVtaXR0ZXIuZmlyZShjaGFuZ2VFdmVudCk7IC8vIGZpcmUgbWFudWFsbHkgc2luY2Ugc3RhdGUgY2hhbmdlIHdvbid0IGRvIGl0XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZW50cnkub3duQ29tcHV0ZWRTdGF0ZSA9IG5ld093bkNvbXB1dGVkO1xuXHRcdHRoaXMuY291bnRzW3ByZXZpb3VzT3duQ29tcHV0ZWRdLS07XG5cdFx0dGhpcy5jb3VudHNbbmV3T3duQ29tcHV0ZWRdKys7XG5cdFx0cmVmcmVzaENvbXB1dGVkU3RhdGUodGhpcy5jb21wdXRlZFN0YXRlQWNjZXNzb3IsIGVudHJ5KS5mb3JFYWNoKHQgPT5cblx0XHRcdHRoaXMuY2hhbmdlRW1pdHRlci5maXJlKHQgPT09IGVudHJ5ID8gY2hhbmdlRXZlbnQgOiB7XG5cdFx0XHRcdGl0ZW06IHQsXG5cdFx0XHRcdHJlc3VsdDogdGhpcyxcblx0XHRcdFx0cmVhc29uOiBUZXN0UmVzdWx0SXRlbUNoYW5nZVJlYXNvbi5Db21wdXRlZFN0YXRlQ2hhbmdlLFxuXHRcdFx0fSksXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgYWRkVGVzdFRvUnVuKGNvbnRyb2xsZXJJZDogc3RyaW5nLCBpdGVtOiBJVGVzdEl0ZW0sIHBhcmVudDogc3RyaW5nIHwgbnVsbCkge1xuXHRcdGNvbnN0IG5vZGUgPSBpdGVtVG9Ob2RlKGNvbnRyb2xsZXJJZCwgaXRlbSwgcGFyZW50KTtcblx0XHR0aGlzLnRlc3RCeUlkLnNldChpdGVtLmV4dElkLCBub2RlKTtcblx0XHR0aGlzLmNvdW50c1tUZXN0UmVzdWx0U3RhdGUuVW5zZXRdKys7XG5cblx0XHRpZiAocGFyZW50KSB7XG5cdFx0XHR0aGlzLnRlc3RCeUlkLmdldChwYXJlbnQpPy5jaGlsZHJlbi5wdXNoKG5vZGUpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnRhc2tzLmxlbmd0aCkge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnRhc2tzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdG5vZGUudGFza3MucHVzaCh7IGR1cmF0aW9uOiB1bmRlZmluZWQsIG1lc3NhZ2VzOiBbXSwgc3RhdGU6IFRlc3RSZXN1bHRTdGF0ZS5VbnNldCB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbm9kZTtcblx0fVxuXG5cdHByaXZhdGUgbXVzdEdldFRhc2tJbmRleCh0YXNrSWQ6IHN0cmluZykge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy50YXNrcy5maW5kSW5kZXgodCA9PiB0LmlkID09PSB0YXNrSWQpO1xuXHRcdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVW5rbm93biB0YXNrICR7dGFza0lkfSBpbiB1cGRhdGVTdGF0ZWApO1xuXHRcdH1cblxuXHRcdHJldHVybiBpbmRleDtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgZG9TZXJpYWxpemUgPSBuZXcgTGF6eSgoKTogSVNlcmlhbGl6ZWRUZXN0UmVzdWx0cyA9PiAoe1xuXHRcdGlkOiB0aGlzLmlkLFxuXHRcdGNvbXBsZXRlZEF0OiB0aGlzLmNvbXBsZXRlZEF0ISxcblx0XHR0YXNrczogdGhpcy50YXNrcy5tYXAodCA9PiAoeyBpZDogdC5pZCwgbmFtZTogdC5uYW1lLCBjdHJsSWQ6IHQuY3RybElkLCBoYXNDb3ZlcmFnZTogISF0LmNvdmVyYWdlLmdldCgpIH0pKSxcblx0XHRuYW1lOiB0aGlzLm5hbWUsXG5cdFx0cmVxdWVzdDogdGhpcy5yZXF1ZXN0LFxuXHRcdGl0ZW1zOiBbLi4udGhpcy50ZXN0QnlJZC52YWx1ZXMoKV0ubWFwKFRlc3RSZXN1bHRJdGVtLnNlcmlhbGl6ZVdpdGhvdXRNZXNzYWdlcyksXG5cdH0pKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRvU2VyaWFsaXplV2l0aE1lc3NhZ2VzID0gbmV3IExhenkoKCk6IElTZXJpYWxpemVkVGVzdFJlc3VsdHMgPT4gKHtcblx0XHRpZDogdGhpcy5pZCxcblx0XHRjb21wbGV0ZWRBdDogdGhpcy5jb21wbGV0ZWRBdCEsXG5cdFx0dGFza3M6IHRoaXMudGFza3MubWFwKHQgPT4gKHsgaWQ6IHQuaWQsIG5hbWU6IHQubmFtZSwgY3RybElkOiB0LmN0cmxJZCwgaGFzQ292ZXJhZ2U6ICEhdC5jb3ZlcmFnZS5nZXQoKSB9KSksXG5cdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdHJlcXVlc3Q6IHRoaXMucmVxdWVzdCxcblx0XHRpdGVtczogWy4uLnRoaXMudGVzdEJ5SWQudmFsdWVzKCldLm1hcChUZXN0UmVzdWx0SXRlbS5zZXJpYWxpemUpLFxuXHR9KSk7XG59XG5cbi8qKlxuICogVGVzdCByZXN1bHRzIGh5ZHJhdGVkIGZyb20gYSBwcmV2aW91c2x5LXNlcmlhbGl6ZWQgdGVzdCBydW4uXG4gKi9cbmV4cG9ydCBjbGFzcyBIeWRyYXRlZFRlc3RSZXN1bHQgaW1wbGVtZW50cyBJVGVzdFJlc3VsdCB7XG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIHJlYWRvbmx5IGNvdW50cyA9IG1ha2VFbXB0eUNvdW50cygpO1xuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIHJlYWRvbmx5IGlkOiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgY29tcGxldGVkQXQ6IG51bWJlcjtcblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyByZWFkb25seSB0YXNrczogSVRlc3RSdW5UYXNrUmVzdWx0c1tdO1xuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIGdldCB0ZXN0cygpIHtcblx0XHRyZXR1cm4gdGhpcy50ZXN0QnlJZC52YWx1ZXMoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIHJlYWRvbmx5IG5hbWU6IHN0cmluZztcblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyByZWFkb25seSByZXF1ZXN0OiBSZXNvbHZlZFRlc3RSdW5SZXF1ZXN0O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgdGVzdEJ5SWQgPSBuZXcgTWFwPHN0cmluZywgVGVzdFJlc3VsdEl0ZW0+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0aWRlbnRpdHk6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBzZXJpYWxpemVkOiBJU2VyaWFsaXplZFRlc3RSZXN1bHRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcGVyc2lzdCA9IHRydWUsXG5cdCkge1xuXHRcdHRoaXMuaWQgPSBzZXJpYWxpemVkLmlkO1xuXHRcdHRoaXMuY29tcGxldGVkQXQgPSBzZXJpYWxpemVkLmNvbXBsZXRlZEF0O1xuXHRcdHRoaXMudGFza3MgPSBzZXJpYWxpemVkLnRhc2tzLm1hcCgodGFzaywgaSkgPT4gKHtcblx0XHRcdGlkOiB0YXNrLmlkLFxuXHRcdFx0bmFtZTogdGFzay5uYW1lIHx8IGxvY2FsaXplKCd0ZXN0VW5uYW1lZFRhc2snLCAnVW5uYW1lZCBUYXNrJyksXG5cdFx0XHRjdHJsSWQ6IHRhc2suY3RybElkLFxuXHRcdFx0cnVubmluZzogZmFsc2UsXG5cdFx0XHRjb3ZlcmFnZTogb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIHVuZGVmaW5lZCksXG5cdFx0XHRvdXRwdXQ6IGVtcHR5UmF3T3V0cHV0LFxuXHRcdFx0b3RoZXJNZXNzYWdlczogW11cblx0XHR9KSk7XG5cdFx0dGhpcy5uYW1lID0gc2VyaWFsaXplZC5uYW1lO1xuXHRcdHRoaXMucmVxdWVzdCA9IHNlcmlhbGl6ZWQucmVxdWVzdDtcblxuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBzZXJpYWxpemVkLml0ZW1zKSB7XG5cdFx0XHRjb25zdCBkZSA9IFRlc3RSZXN1bHRJdGVtLmRlc2VyaWFsaXplKGlkZW50aXR5LCBpdGVtKTtcblx0XHRcdHRoaXMuY291bnRzW2RlLm93bkNvbXB1dGVkU3RhdGVdKys7XG5cdFx0XHR0aGlzLnRlc3RCeUlkLnNldChpdGVtLml0ZW0uZXh0SWQsIGRlKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyBnZXRTdGF0ZUJ5SWQoZXh0VGVzdElkOiBzdHJpbmcpIHtcblx0XHRyZXR1cm4gdGhpcy50ZXN0QnlJZC5nZXQoZXh0VGVzdElkKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIHRvSlNPTigpOiBJU2VyaWFsaXplZFRlc3RSZXN1bHRzIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5wZXJzaXN0ID8gdGhpcy5zZXJpYWxpemVkIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgdG9KU09OV2l0aE1lc3NhZ2VzKCk6IElTZXJpYWxpemVkVGVzdFJlc3VsdHMgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnRvSlNPTigpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsWUFBWTtBQUNyQixTQUFTLGtCQUFrQjtBQUMzQixTQUFzQix1QkFBdUI7QUFDN0MsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx5QkFBeUI7QUFFbEMsU0FBaUMsNEJBQTRCO0FBRTdELFNBQVMsY0FBYztBQUN2QixTQUFTLGlCQUFpQixhQUFhLGVBQWUsK0JBQStDO0FBQ3JHLFNBQVMsV0FBcUoscUJBQXFCLGlCQUFpQixnQkFBZ0IsdUJBQXVCO0FBd0YzTyxNQUFNLGlCQUFp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
