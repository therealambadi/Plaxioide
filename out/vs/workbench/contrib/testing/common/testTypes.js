import { URI } from "../../../../base/common/uri.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { localize } from "../../../../nls.js";
import { TestId } from "./testId.js";
var TestResultState = /* @__PURE__ */ ((TestResultState2) => {
  TestResultState2[TestResultState2["Unset"] = 0] = "Unset";
  TestResultState2[TestResultState2["Queued"] = 1] = "Queued";
  TestResultState2[TestResultState2["Running"] = 2] = "Running";
  TestResultState2[TestResultState2["Passed"] = 3] = "Passed";
  TestResultState2[TestResultState2["Failed"] = 4] = "Failed";
  TestResultState2[TestResultState2["Skipped"] = 5] = "Skipped";
  TestResultState2[TestResultState2["Errored"] = 6] = "Errored";
  return TestResultState2;
})(TestResultState || {});
const testResultStateToContextValues = {
  [0 /* Unset */]: "unset",
  [1 /* Queued */]: "queued",
  [2 /* Running */]: "running",
  [3 /* Passed */]: "passed",
  [4 /* Failed */]: "failed",
  [5 /* Skipped */]: "skipped",
  [6 /* Errored */]: "errored"
};
var ExtTestRunProfileKind = /* @__PURE__ */ ((ExtTestRunProfileKind2) => {
  ExtTestRunProfileKind2[ExtTestRunProfileKind2["Run"] = 1] = "Run";
  ExtTestRunProfileKind2[ExtTestRunProfileKind2["Debug"] = 2] = "Debug";
  ExtTestRunProfileKind2[ExtTestRunProfileKind2["Coverage"] = 3] = "Coverage";
  return ExtTestRunProfileKind2;
})(ExtTestRunProfileKind || {});
var TestControllerCapability = /* @__PURE__ */ ((TestControllerCapability2) => {
  TestControllerCapability2[TestControllerCapability2["Refresh"] = 2] = "Refresh";
  TestControllerCapability2[TestControllerCapability2["CodeRelatedToTest"] = 4] = "CodeRelatedToTest";
  TestControllerCapability2[TestControllerCapability2["TestRelatedToCode"] = 8] = "TestRelatedToCode";
  return TestControllerCapability2;
})(TestControllerCapability || {});
var TestRunProfileBitset = /* @__PURE__ */ ((TestRunProfileBitset2) => {
  TestRunProfileBitset2[TestRunProfileBitset2["Run"] = 2] = "Run";
  TestRunProfileBitset2[TestRunProfileBitset2["Debug"] = 4] = "Debug";
  TestRunProfileBitset2[TestRunProfileBitset2["Coverage"] = 8] = "Coverage";
  TestRunProfileBitset2[TestRunProfileBitset2["HasNonDefaultProfile"] = 16] = "HasNonDefaultProfile";
  TestRunProfileBitset2[TestRunProfileBitset2["HasConfigurable"] = 32] = "HasConfigurable";
  TestRunProfileBitset2[TestRunProfileBitset2["SupportsContinuousRun"] = 64] = "SupportsContinuousRun";
  return TestRunProfileBitset2;
})(TestRunProfileBitset || {});
const testProfileBitset = {
  [2 /* Run */]: localize("testing.runProfileBitset.run", "Run"),
  [4 /* Debug */]: localize("testing.runProfileBitset.debug", "Debug"),
  [8 /* Coverage */]: localize("testing.runProfileBitset.coverage", "Coverage")
};
const testRunProfileBitsetList = [
  2 /* Run */,
  4 /* Debug */,
  8 /* Coverage */,
  16 /* HasNonDefaultProfile */,
  32 /* HasConfigurable */,
  64 /* SupportsContinuousRun */
];
const isStartControllerTests = (t) => "runId" in t;
var IRichLocation;
((IRichLocation2) => {
  IRichLocation2.serialize = (location) => ({
    range: location.range.toJSON(),
    uri: location.uri.toJSON()
  });
  IRichLocation2.deserialize = (uriIdentity, location) => ({
    range: Range.lift(location.range),
    uri: uriIdentity.asCanonicalUri(URI.revive(location.uri))
  });
})(IRichLocation || (IRichLocation = {}));
var TestMessageType = /* @__PURE__ */ ((TestMessageType2) => {
  TestMessageType2[TestMessageType2["Error"] = 0] = "Error";
  TestMessageType2[TestMessageType2["Output"] = 1] = "Output";
  return TestMessageType2;
})(TestMessageType || {});
var ITestMessageStackFrame;
((ITestMessageStackFrame2) => {
  ITestMessageStackFrame2.serialize = (stack) => ({
    label: stack.label,
    uri: stack.uri?.toJSON(),
    position: stack.position?.toJSON()
  });
  ITestMessageStackFrame2.deserialize = (uriIdentity, stack) => ({
    label: stack.label,
    uri: stack.uri ? uriIdentity.asCanonicalUri(URI.revive(stack.uri)) : void 0,
    position: stack.position ? Position.lift(stack.position) : void 0
  });
})(ITestMessageStackFrame || (ITestMessageStackFrame = {}));
var ITestErrorMessage;
((ITestErrorMessage2) => {
  ITestErrorMessage2.serialize = (message) => ({
    message: message.message,
    type: 0 /* Error */,
    expected: message.expected,
    actual: message.actual,
    contextValue: message.contextValue,
    location: message.location && IRichLocation.serialize(message.location),
    stackTrace: message.stackTrace?.map(ITestMessageStackFrame.serialize)
  });
  ITestErrorMessage2.deserialize = (uriIdentity, message) => ({
    message: message.message,
    type: 0 /* Error */,
    expected: message.expected,
    actual: message.actual,
    contextValue: message.contextValue,
    location: message.location && IRichLocation.deserialize(uriIdentity, message.location),
    stackTrace: message.stackTrace && message.stackTrace.map((s) => ITestMessageStackFrame.deserialize(uriIdentity, s))
  });
})(ITestErrorMessage || (ITestErrorMessage = {}));
const getMarkId = (marker, start) => `${start ? "s" : "e"}${marker}`;
var ITestOutputMessage;
((ITestOutputMessage2) => {
  ITestOutputMessage2.serialize = (message) => ({
    message: message.message,
    type: 1 /* Output */,
    offset: message.offset,
    length: message.length,
    location: message.location && IRichLocation.serialize(message.location)
  });
  ITestOutputMessage2.deserialize = (uriIdentity, message) => ({
    message: message.message,
    type: 1 /* Output */,
    offset: message.offset,
    length: message.length,
    location: message.location && IRichLocation.deserialize(uriIdentity, message.location)
  });
})(ITestOutputMessage || (ITestOutputMessage = {}));
var ITestMessage;
((ITestMessage2) => {
  ITestMessage2.serialize = (message) => message.type === 0 /* Error */ ? ITestErrorMessage.serialize(message) : ITestOutputMessage.serialize(message);
  ITestMessage2.deserialize = (uriIdentity, message) => message.type === 0 /* Error */ ? ITestErrorMessage.deserialize(uriIdentity, message) : ITestOutputMessage.deserialize(uriIdentity, message);
  ITestMessage2.isDiffable = (message) => message.type === 0 /* Error */ && message.actual !== void 0 && message.expected !== void 0;
})(ITestMessage || (ITestMessage = {}));
var ITestTaskState;
((ITestTaskState2) => {
  ITestTaskState2.serializeWithoutMessages = (state) => ({
    state: state.state,
    duration: state.duration,
    messages: []
  });
  ITestTaskState2.serialize = (state) => ({
    state: state.state,
    duration: state.duration,
    messages: state.messages.map(ITestMessage.serialize)
  });
  ITestTaskState2.deserialize = (uriIdentity, state) => ({
    state: state.state,
    duration: state.duration,
    messages: state.messages.map((m) => ITestMessage.deserialize(uriIdentity, m))
  });
})(ITestTaskState || (ITestTaskState = {}));
const testTagDelimiter = "\0";
const namespaceTestTag = (ctrlId, tagId) => ctrlId + testTagDelimiter + tagId;
const denamespaceTestTag = (namespaced) => {
  const index = namespaced.indexOf(testTagDelimiter);
  return { ctrlId: namespaced.slice(0, index), tagId: namespaced.slice(index + 1) };
};
var ITestItem;
((ITestItem2) => {
  ITestItem2.serialize = (item) => ({
    extId: item.extId,
    label: item.label,
    tags: item.tags,
    busy: item.busy,
    children: void 0,
    uri: item.uri?.toJSON(),
    range: item.range?.toJSON() || null,
    description: item.description,
    error: item.error,
    sortText: item.sortText
  });
  ITestItem2.deserialize = (uriIdentity, serialized) => ({
    extId: serialized.extId,
    label: serialized.label,
    tags: serialized.tags,
    busy: serialized.busy,
    children: void 0,
    uri: serialized.uri ? uriIdentity.asCanonicalUri(URI.revive(serialized.uri)) : void 0,
    range: serialized.range ? Range.lift(serialized.range) : null,
    description: serialized.description,
    error: serialized.error,
    sortText: serialized.sortText
  });
})(ITestItem || (ITestItem = {}));
var TestItemExpandState = /* @__PURE__ */ ((TestItemExpandState2) => {
  TestItemExpandState2[TestItemExpandState2["NotExpandable"] = 0] = "NotExpandable";
  TestItemExpandState2[TestItemExpandState2["Expandable"] = 1] = "Expandable";
  TestItemExpandState2[TestItemExpandState2["BusyExpanding"] = 2] = "BusyExpanding";
  TestItemExpandState2[TestItemExpandState2["Expanded"] = 3] = "Expanded";
  return TestItemExpandState2;
})(TestItemExpandState || {});
var InternalTestItem;
((InternalTestItem2) => {
  InternalTestItem2.serialize = (item) => ({
    expand: item.expand,
    item: ITestItem.serialize(item.item)
  });
  InternalTestItem2.deserialize = (uriIdentity, serialized) => ({
    // the `controllerId` is derived from the test.item.extId. It's redundant
    // in the non-serialized InternalTestItem too, but there just because it's
    // checked against in many hot paths.
    controllerId: TestId.root(serialized.item.extId),
    expand: serialized.expand,
    item: ITestItem.deserialize(uriIdentity, serialized.item)
  });
})(InternalTestItem || (InternalTestItem = {}));
var ITestItemUpdate;
((ITestItemUpdate2) => {
  ITestItemUpdate2.serialize = (u) => {
    let item;
    if (u.item) {
      item = {};
      if (u.item.label !== void 0) {
        item.label = u.item.label;
      }
      if (u.item.tags !== void 0) {
        item.tags = u.item.tags;
      }
      if (u.item.busy !== void 0) {
        item.busy = u.item.busy;
      }
      if (u.item.uri !== void 0) {
        item.uri = u.item.uri?.toJSON();
      }
      if (u.item.range !== void 0) {
        item.range = u.item.range?.toJSON();
      }
      if (u.item.description !== void 0) {
        item.description = u.item.description;
      }
      if (u.item.error !== void 0) {
        item.error = u.item.error;
      }
      if (u.item.sortText !== void 0) {
        item.sortText = u.item.sortText;
      }
    }
    return { extId: u.extId, expand: u.expand, item };
  };
  ITestItemUpdate2.deserialize = (u) => {
    let item;
    if (u.item) {
      item = {};
      if (u.item.label !== void 0) {
        item.label = u.item.label;
      }
      if (u.item.tags !== void 0) {
        item.tags = u.item.tags;
      }
      if (u.item.busy !== void 0) {
        item.busy = u.item.busy;
      }
      if (u.item.range !== void 0) {
        item.range = u.item.range ? Range.lift(u.item.range) : null;
      }
      if (u.item.description !== void 0) {
        item.description = u.item.description;
      }
      if (u.item.error !== void 0) {
        item.error = u.item.error;
      }
      if (u.item.sortText !== void 0) {
        item.sortText = u.item.sortText;
      }
    }
    return { extId: u.extId, expand: u.expand, item };
  };
})(ITestItemUpdate || (ITestItemUpdate = {}));
const applyTestItemUpdate = (internal, patch) => {
  if (patch.expand !== void 0) {
    internal.expand = patch.expand;
  }
  if (patch.item !== void 0) {
    internal.item = internal.item ? Object.assign(internal.item, patch.item) : patch.item;
  }
};
var TestResultItem;
((TestResultItem2) => {
  TestResultItem2.serializeWithoutMessages = (original) => ({
    ...InternalTestItem.serialize(original),
    ownComputedState: original.ownComputedState,
    computedState: original.computedState,
    tasks: original.tasks.map(ITestTaskState.serializeWithoutMessages)
  });
  TestResultItem2.serialize = (original) => ({
    ...InternalTestItem.serialize(original),
    ownComputedState: original.ownComputedState,
    computedState: original.computedState,
    tasks: original.tasks.map(ITestTaskState.serialize)
  });
  TestResultItem2.deserialize = (uriIdentity, serialized) => ({
    ...InternalTestItem.deserialize(uriIdentity, serialized),
    ownComputedState: serialized.ownComputedState,
    computedState: serialized.computedState,
    tasks: serialized.tasks.map((m) => ITestTaskState.deserialize(uriIdentity, m)),
    retired: true
  });
})(TestResultItem || (TestResultItem = {}));
var ICoverageCount;
((ICoverageCount2) => {
  ICoverageCount2.empty = () => ({ covered: 0, total: 0 });
  ICoverageCount2.sum = (target, src) => {
    target.covered += src.covered;
    target.total += src.total;
  };
})(ICoverageCount || (ICoverageCount = {}));
var IFileCoverage;
((IFileCoverage2) => {
  IFileCoverage2.serialize = (original) => ({
    id: original.id,
    statement: original.statement,
    branch: original.branch,
    declaration: original.declaration,
    testIds: original.testIds,
    uri: original.uri.toJSON()
  });
  IFileCoverage2.deserialize = (uriIdentity, serialized) => ({
    id: serialized.id,
    statement: serialized.statement,
    branch: serialized.branch,
    declaration: serialized.declaration,
    testIds: serialized.testIds,
    uri: uriIdentity.asCanonicalUri(URI.revive(serialized.uri))
  });
  IFileCoverage2.empty = (id, uri) => ({
    id,
    uri,
    statement: ICoverageCount.empty()
  });
})(IFileCoverage || (IFileCoverage = {}));
function serializeThingWithLocation(serialized) {
  return {
    ...serialized,
    location: serialized.location?.toJSON()
  };
}
function deserializeThingWithLocation(serialized) {
  serialized.location = serialized.location ? Position.isIPosition(serialized.location) ? Position.lift(serialized.location) : Range.lift(serialized.location) : void 0;
  return serialized;
}
const KEEP_N_LAST_COVERAGE_REPORTS = 3;
var DetailType = /* @__PURE__ */ ((DetailType2) => {
  DetailType2[DetailType2["Declaration"] = 0] = "Declaration";
  DetailType2[DetailType2["Statement"] = 1] = "Statement";
  DetailType2[DetailType2["Branch"] = 2] = "Branch";
  return DetailType2;
})(DetailType || {});
var CoverageDetails;
((CoverageDetails2) => {
  CoverageDetails2.serialize = (original) => original.type === 0 /* Declaration */ ? IDeclarationCoverage.serialize(original) : IStatementCoverage.serialize(original);
  CoverageDetails2.deserialize = (serialized) => serialized.type === 0 /* Declaration */ ? IDeclarationCoverage.deserialize(serialized) : IStatementCoverage.deserialize(serialized);
})(CoverageDetails || (CoverageDetails = {}));
var IBranchCoverage;
((IBranchCoverage2) => {
  IBranchCoverage2.serialize = serializeThingWithLocation;
  IBranchCoverage2.deserialize = deserializeThingWithLocation;
})(IBranchCoverage || (IBranchCoverage = {}));
var IDeclarationCoverage;
((IDeclarationCoverage2) => {
  IDeclarationCoverage2.serialize = serializeThingWithLocation;
  IDeclarationCoverage2.deserialize = deserializeThingWithLocation;
})(IDeclarationCoverage || (IDeclarationCoverage = {}));
var IStatementCoverage;
((IStatementCoverage2) => {
  IStatementCoverage2.serialize = (original) => ({
    ...serializeThingWithLocation(original),
    branches: original.branches?.map(IBranchCoverage.serialize)
  });
  IStatementCoverage2.deserialize = (serialized) => ({
    ...deserializeThingWithLocation(serialized),
    branches: serialized.branches?.map(IBranchCoverage.deserialize)
  });
})(IStatementCoverage || (IStatementCoverage = {}));
var TestDiffOpType = /* @__PURE__ */ ((TestDiffOpType2) => {
  TestDiffOpType2[TestDiffOpType2["Add"] = 0] = "Add";
  TestDiffOpType2[TestDiffOpType2["Update"] = 1] = "Update";
  TestDiffOpType2[TestDiffOpType2["DocumentSynced"] = 2] = "DocumentSynced";
  TestDiffOpType2[TestDiffOpType2["Remove"] = 3] = "Remove";
  TestDiffOpType2[TestDiffOpType2["IncrementPendingExtHosts"] = 4] = "IncrementPendingExtHosts";
  TestDiffOpType2[TestDiffOpType2["Retire"] = 5] = "Retire";
  TestDiffOpType2[TestDiffOpType2["AddTag"] = 6] = "AddTag";
  TestDiffOpType2[TestDiffOpType2["RemoveTag"] = 7] = "RemoveTag";
  return TestDiffOpType2;
})(TestDiffOpType || {});
var TestsDiffOp;
((TestsDiffOp2) => {
  TestsDiffOp2.deserialize = (uriIdentity, u) => {
    if (u.op === 0 /* Add */) {
      return { op: u.op, item: InternalTestItem.deserialize(uriIdentity, u.item) };
    } else if (u.op === 1 /* Update */) {
      return { op: u.op, item: ITestItemUpdate.deserialize(u.item) };
    } else if (u.op === 2 /* DocumentSynced */) {
      return { op: u.op, uri: uriIdentity.asCanonicalUri(URI.revive(u.uri)), docv: u.docv };
    } else {
      return u;
    }
  };
  TestsDiffOp2.serialize = (u) => {
    if (u.op === 0 /* Add */) {
      return { op: u.op, item: InternalTestItem.serialize(u.item) };
    } else if (u.op === 1 /* Update */) {
      return { op: u.op, item: ITestItemUpdate.serialize(u.item) };
    } else {
      return u;
    }
  };
})(TestsDiffOp || (TestsDiffOp = {}));
class AbstractIncrementalTestCollection {
  constructor(uriIdentity) {
    this.uriIdentity = uriIdentity;
    this._tags = /* @__PURE__ */ new Map();
    /**
     * Map of item IDs to test item objects.
     */
    this.items = /* @__PURE__ */ new Map();
    /**
     * ID of test root items.
     */
    this.roots = /* @__PURE__ */ new Set();
    /**
     * Number of 'busy' controllers.
     */
    this.busyControllerCount = 0;
    /**
     * Number of pending roots.
     */
    this.pendingRootCount = 0;
    /**
     * Known test tags.
     */
    this.tags = this._tags;
  }
  /**
   * Applies the diff to the collection.
   */
  apply(diff) {
    const changes = this.createChangeCollector();
    for (const op of diff) {
      switch (op.op) {
        case 0 /* Add */:
          this.add(InternalTestItem.deserialize(this.uriIdentity, op.item), changes);
          break;
        case 1 /* Update */:
          this.update(ITestItemUpdate.deserialize(op.item), changes);
          break;
        case 3 /* Remove */:
          this.remove(op.itemId, changes);
          break;
        case 5 /* Retire */:
          this.retireTest(op.itemId);
          break;
        case 4 /* IncrementPendingExtHosts */:
          this.updatePendingRoots(op.amount);
          break;
        case 6 /* AddTag */:
          this._tags.set(op.tag.id, op.tag);
          break;
        case 7 /* RemoveTag */:
          this._tags.delete(op.id);
          break;
      }
    }
    changes.complete?.();
  }
  add(item, changes) {
    const parentId = TestId.parentId(item.item.extId)?.toString();
    let created;
    if (!parentId) {
      created = this.createItem(item);
      this.roots.add(created);
      this.items.set(item.item.extId, created);
    } else if (this.items.has(parentId)) {
      const parent = this.items.get(parentId);
      parent.children.add(item.item.extId);
      created = this.createItem(item, parent);
      this.items.set(item.item.extId, created);
    } else {
      console.error(`Test with unknown parent ID: ${JSON.stringify(item)}`);
      return;
    }
    changes.add?.(created);
    if (item.expand === 2 /* BusyExpanding */) {
      this.busyControllerCount++;
    }
    return created;
  }
  update(patch, changes) {
    const existing = this.items.get(patch.extId);
    if (!existing) {
      return;
    }
    if (patch.expand !== void 0) {
      if (existing.expand === 2 /* BusyExpanding */) {
        this.busyControllerCount--;
      }
      if (patch.expand === 2 /* BusyExpanding */) {
        this.busyControllerCount++;
      }
    }
    applyTestItemUpdate(existing, patch);
    changes.update?.(existing);
    return existing;
  }
  remove(itemId, changes) {
    const toRemove = this.items.get(itemId);
    if (!toRemove) {
      return;
    }
    const parentId = TestId.parentId(toRemove.item.extId)?.toString();
    if (parentId) {
      const parent = this.items.get(parentId);
      parent.children.delete(toRemove.item.extId);
    } else {
      this.roots.delete(toRemove);
    }
    const queue = [[itemId]];
    while (queue.length) {
      for (const itemId2 of queue.pop()) {
        const existing = this.items.get(itemId2);
        if (existing) {
          queue.push(existing.children);
          this.items.delete(itemId2);
          changes.remove?.(existing, existing !== toRemove);
          if (existing.expand === 2 /* BusyExpanding */) {
            this.busyControllerCount--;
          }
        }
      }
    }
  }
  /**
   * Called when the extension signals a test result should be retired.
   */
  retireTest(testId) {
  }
  /**
   * Updates the number of test root sources who are yet to report. When
   * the total pending test roots reaches 0, the roots for all controllers
   * will exist in the collection.
   */
  updatePendingRoots(delta) {
    this.pendingRootCount += delta;
  }
  /**
   * Called before a diff is applied to create a new change collector.
   */
  createChangeCollector() {
    return {};
  }
}
export {
  AbstractIncrementalTestCollection,
  CoverageDetails,
  DetailType,
  ExtTestRunProfileKind,
  IBranchCoverage,
  ICoverageCount,
  IDeclarationCoverage,
  IFileCoverage,
  IRichLocation,
  IStatementCoverage,
  ITestErrorMessage,
  ITestItem,
  ITestItemUpdate,
  ITestMessage,
  ITestMessageStackFrame,
  ITestOutputMessage,
  ITestTaskState,
  InternalTestItem,
  KEEP_N_LAST_COVERAGE_REPORTS,
  TestControllerCapability,
  TestDiffOpType,
  TestItemExpandState,
  TestMessageType,
  TestResultItem,
  TestResultState,
  TestRunProfileBitset,
  TestsDiffOp,
  applyTestItemUpdate,
  denamespaceTestTag,
  getMarkId,
  isStartControllerTests,
  namespaceTestTag,
  testProfileBitset,
  testResultStateToContextValues,
  testRunProfileBitsetList
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2NvbW1vbi90ZXN0VHlwZXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBNYXJzaGFsbGVkSWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZ0lkcy5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uLCBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UsIFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IFRlc3RJZCB9IGZyb20gJy4vdGVzdElkLmpzJztcblxuZXhwb3J0IGNvbnN0IGVudW0gVGVzdFJlc3VsdFN0YXRlIHtcblx0VW5zZXQgPSAwLFxuXHRRdWV1ZWQgPSAxLFxuXHRSdW5uaW5nID0gMixcblx0UGFzc2VkID0gMyxcblx0RmFpbGVkID0gNCxcblx0U2tpcHBlZCA9IDUsXG5cdEVycm9yZWQgPSA2XG59XG5cbmV4cG9ydCBjb25zdCB0ZXN0UmVzdWx0U3RhdGVUb0NvbnRleHRWYWx1ZXM6IHsgW0sgaW4gVGVzdFJlc3VsdFN0YXRlXTogc3RyaW5nIH0gPSB7XG5cdFtUZXN0UmVzdWx0U3RhdGUuVW5zZXRdOiAndW5zZXQnLFxuXHRbVGVzdFJlc3VsdFN0YXRlLlF1ZXVlZF06ICdxdWV1ZWQnLFxuXHRbVGVzdFJlc3VsdFN0YXRlLlJ1bm5pbmddOiAncnVubmluZycsXG5cdFtUZXN0UmVzdWx0U3RhdGUuUGFzc2VkXTogJ3Bhc3NlZCcsXG5cdFtUZXN0UmVzdWx0U3RhdGUuRmFpbGVkXTogJ2ZhaWxlZCcsXG5cdFtUZXN0UmVzdWx0U3RhdGUuU2tpcHBlZF06ICdza2lwcGVkJyxcblx0W1Rlc3RSZXN1bHRTdGF0ZS5FcnJvcmVkXTogJ2Vycm9yZWQnLFxufTtcblxuLyoqIG5vdGU6IGtlZXAgaW4gc3luYyB3aXRoIFRlc3RSdW5Qcm9maWxlS2luZCBpbiB2c2NvZGUuZC50cyAqL1xuZXhwb3J0IGNvbnN0IGVudW0gRXh0VGVzdFJ1blByb2ZpbGVLaW5kIHtcblx0UnVuID0gMSxcblx0RGVidWcgPSAyLFxuXHRDb3ZlcmFnZSA9IDMsXG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIFRlc3RDb250cm9sbGVyQ2FwYWJpbGl0eSB7XG5cdFJlZnJlc2ggPSAxIDw8IDEsXG5cdENvZGVSZWxhdGVkVG9UZXN0ID0gMSA8PCAyLFxuXHRUZXN0UmVsYXRlZFRvQ29kZSA9IDEgPDwgMyxcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gVGVzdFJ1blByb2ZpbGVCaXRzZXQge1xuXHRSdW4gPSAxIDw8IDEsXG5cdERlYnVnID0gMSA8PCAyLFxuXHRDb3ZlcmFnZSA9IDEgPDwgMyxcblx0SGFzTm9uRGVmYXVsdFByb2ZpbGUgPSAxIDw8IDQsXG5cdEhhc0NvbmZpZ3VyYWJsZSA9IDEgPDwgNSxcblx0U3VwcG9ydHNDb250aW51b3VzUnVuID0gMSA8PCA2LFxufVxuXG5leHBvcnQgY29uc3QgdGVzdFByb2ZpbGVCaXRzZXQgPSB7XG5cdFtUZXN0UnVuUHJvZmlsZUJpdHNldC5SdW5dOiBsb2NhbGl6ZSgndGVzdGluZy5ydW5Qcm9maWxlQml0c2V0LnJ1bicsICdSdW4nKSxcblx0W1Rlc3RSdW5Qcm9maWxlQml0c2V0LkRlYnVnXTogbG9jYWxpemUoJ3Rlc3RpbmcucnVuUHJvZmlsZUJpdHNldC5kZWJ1ZycsICdEZWJ1ZycpLFxuXHRbVGVzdFJ1blByb2ZpbGVCaXRzZXQuQ292ZXJhZ2VdOiBsb2NhbGl6ZSgndGVzdGluZy5ydW5Qcm9maWxlQml0c2V0LmNvdmVyYWdlJywgJ0NvdmVyYWdlJyksXG59O1xuXG4vKipcbiAqIExpc3Qgb2YgYWxsIHRlc3QgcnVuIHByb2ZpbGUgYml0c2V0IHZhbHVlcy5cbiAqL1xuZXhwb3J0IGNvbnN0IHRlc3RSdW5Qcm9maWxlQml0c2V0TGlzdCA9IFtcblx0VGVzdFJ1blByb2ZpbGVCaXRzZXQuUnVuLFxuXHRUZXN0UnVuUHJvZmlsZUJpdHNldC5EZWJ1Zyxcblx0VGVzdFJ1blByb2ZpbGVCaXRzZXQuQ292ZXJhZ2UsXG5cdFRlc3RSdW5Qcm9maWxlQml0c2V0Lkhhc05vbkRlZmF1bHRQcm9maWxlLFxuXHRUZXN0UnVuUHJvZmlsZUJpdHNldC5IYXNDb25maWd1cmFibGUsXG5cdFRlc3RSdW5Qcm9maWxlQml0c2V0LlN1cHBvcnRzQ29udGludW91c1J1bixcbl07XG5cbi8qKlxuICogRFRPIGZvciBhIGNvbnRyb2xsZXIncyBydW4gcHJvZmlsZXMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSVRlc3RSdW5Qcm9maWxlIHtcblx0Y29udHJvbGxlcklkOiBzdHJpbmc7XG5cdHByb2ZpbGVJZDogbnVtYmVyO1xuXHRsYWJlbDogc3RyaW5nO1xuXHRncm91cDogVGVzdFJ1blByb2ZpbGVCaXRzZXQ7XG5cdGlzRGVmYXVsdDogYm9vbGVhbjtcblx0dGFnOiBzdHJpbmcgfCBudWxsO1xuXHRoYXNDb25maWd1cmF0aW9uSGFuZGxlcjogYm9vbGVhbjtcblx0c3VwcG9ydHNDb250aW51b3VzUnVuOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUZXN0UnVuUHJvZmlsZVJlZmVyZW5jZSB7XG5cdGNvbnRyb2xsZXJJZDogc3RyaW5nO1xuXHRwcm9maWxlSWQ6IG51bWJlcjtcblx0Z3JvdXA6IFRlc3RSdW5Qcm9maWxlQml0c2V0O1xufVxuXG4vKipcbiAqIEEgZnVsbHktcmVzb2x2ZWQgcmVxdWVzdCB0byBydW4gdGVzdHMsIHBhc3NzZWQgYmV0d2VlbiB0aGUgbWFpbiB0aHJlYWRcbiAqIGFuZCBleHRlbnNpb24gaG9zdC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSZXNvbHZlZFRlc3RSdW5SZXF1ZXN0IHtcblx0Z3JvdXA6IFRlc3RSdW5Qcm9maWxlQml0c2V0O1xuXHR0YXJnZXRzOiB7XG5cdFx0dGVzdElkczogc3RyaW5nW107XG5cdFx0Y29udHJvbGxlcklkOiBzdHJpbmc7XG5cdFx0cHJvZmlsZUlkOiBudW1iZXI7XG5cdH1bXTtcblx0ZXhjbHVkZT86IHN0cmluZ1tdO1xuXHQvKiogV2hldGhlciB0aGlzIGlzIGEgY29udGludW91cyB0ZXN0IHJ1biAqL1xuXHRjb250aW51b3VzPzogYm9vbGVhbjtcblx0LyoqIFdoZXRoZXIgdGhpcyB3YXMgdHJpZ2dlZCBieSBhIHVzZXIgYWN0aW9uIGluIFVJLiBEZWZhdWx0PXRydWUgKi9cblx0cHJlc2VydmVGb2N1cz86IGJvb2xlYW47XG59XG5cbi8qKlxuICogUmVxdWVzdCB0byB0aGUgbWFpbiB0aHJlYWQgdG8gcnVuIGEgc2V0IG9mIHRlc3RzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEV4dGVuc2lvblJ1blRlc3RzUmVxdWVzdCB7XG5cdGlkOiBzdHJpbmc7XG5cdGluY2x1ZGU6IHN0cmluZ1tdO1xuXHRleGNsdWRlOiBzdHJpbmdbXTtcblx0Y29udHJvbGxlcklkOiBzdHJpbmc7XG5cdHByb2ZpbGU/OiB7IGdyb3VwOiBUZXN0UnVuUHJvZmlsZUJpdHNldDsgaWQ6IG51bWJlciB9O1xuXHRwZXJzaXN0OiBib29sZWFuO1xuXHRwcmVzZXJ2ZUZvY3VzOiBib29sZWFuO1xuXHQvKiogV2hldGhlciB0aGlzIGlzIGEgcmVzdWx0IG9mIGEgY29udGludW91cyB0ZXN0IHJ1biByZXF1ZXN0ICovXG5cdGNvbnRpbnVvdXM6IGJvb2xlYW47XG59XG5cbi8qKlxuICogUmVxdWVzdCBwYXJhbWV0ZXJzIGEgY29udHJvbGxlciBydW4gaGFuZGxlci4gVGhpcyBpcyBkaWZmZXJlbnQgdGhhblxuICoge0BsaW5rIElTdGFydENvbnRyb2xsZXJUZXN0c30uIFRoZSBsYXR0ZXIgaXMgdXNlZCB0byBhc2sgZm9yIG9uZSBvciBtb3JlIHRlc3RcbiAqIHJ1bnMgdHJhY2tlZCBkaXJlY3RseSBieSB0aGUgcmVuZGVyZXIuXG4gKlxuICogVGhpcyBhbG9uZSBjYW4gYmUgdXNlZCB0byBzdGFydCBhbiBhdXRvcnVuLCB3aXRob3V0IGEgc3BlY2lmaWMgYXNzb2NpYXRlZCBydW5JZC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJQ2FsbFByb2ZpbGVSdW5IYW5kbGVyIHtcblx0Y29udHJvbGxlcklkOiBzdHJpbmc7XG5cdHByb2ZpbGVJZDogbnVtYmVyO1xuXHRleGNsdWRlRXh0SWRzOiBzdHJpbmdbXTtcblx0dGVzdElkczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBjb25zdCBpc1N0YXJ0Q29udHJvbGxlclRlc3RzID0gKHQ6IElDYWxsUHJvZmlsZVJ1bkhhbmRsZXIgfCBJU3RhcnRDb250cm9sbGVyVGVzdHMpOiB0IGlzIElTdGFydENvbnRyb2xsZXJUZXN0cyA9PiAoJ3J1bklkJyBhcyBrZXlvZiBJU3RhcnRDb250cm9sbGVyVGVzdHMpIGluIHQ7XG5cbi8qKlxuICogUmVxdWVzdCBmcm9tIHRoZSBtYWluIHRocmVhZCB0byBydW4gdGVzdHMgZm9yIGEgc2luZ2xlIGNvbnRyb2xsZXIuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSVN0YXJ0Q29udHJvbGxlclRlc3RzIGV4dGVuZHMgSUNhbGxQcm9maWxlUnVuSGFuZGxlciB7XG5cdHJ1bklkOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0YXJ0Q29udHJvbGxlclRlc3RzUmVzdWx0IHtcblx0ZXJyb3I/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogTG9jYXRpb24gd2l0aCBhIGZ1bGx5LWluc3RhbnRpYXRlZCBSYW5nZSBhbmQgVVJJLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElSaWNoTG9jYXRpb24ge1xuXHRyYW5nZTogUmFuZ2U7XG5cdHVyaTogVVJJO1xufVxuXG4vKiogU3Vic2V0IG9mIHRoZSBJVXJpSWRlbnRpdHlTZXJ2aWNlICovXG5leHBvcnQgaW50ZXJmYWNlIElUZXN0VXJpQ2Fub25pY2FsaXplciB7XG5cdC8qKiBAbGluayBpbXBvcnQoJ3ZzL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eScpLklVcmlJZGVudGl0eVNlcnZpY2UgKi9cblx0YXNDYW5vbmljYWxVcmkodXJpOiBVUkkpOiBVUkk7XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgSVJpY2hMb2NhdGlvbiB7XG5cdGV4cG9ydCBpbnRlcmZhY2UgU2VyaWFsaXplIHtcblx0XHRyYW5nZTogSVJhbmdlO1xuXHRcdHVyaTogVXJpQ29tcG9uZW50cztcblx0fVxuXG5cdGV4cG9ydCBjb25zdCBzZXJpYWxpemUgPSAobG9jYXRpb246IFJlYWRvbmx5PElSaWNoTG9jYXRpb24+KTogU2VyaWFsaXplID0+ICh7XG5cdFx0cmFuZ2U6IGxvY2F0aW9uLnJhbmdlLnRvSlNPTigpLFxuXHRcdHVyaTogbG9jYXRpb24udXJpLnRvSlNPTigpLFxuXHR9KTtcblxuXHRleHBvcnQgY29uc3QgZGVzZXJpYWxpemUgPSAodXJpSWRlbnRpdHk6IElUZXN0VXJpQ2Fub25pY2FsaXplciwgbG9jYXRpb246IFNlcmlhbGl6ZSk6IElSaWNoTG9jYXRpb24gPT4gKHtcblx0XHRyYW5nZTogUmFuZ2UubGlmdChsb2NhdGlvbi5yYW5nZSksXG5cdFx0dXJpOiB1cmlJZGVudGl0eS5hc0Nhbm9uaWNhbFVyaShVUkkucmV2aXZlKGxvY2F0aW9uLnVyaSkpLFxuXHR9KTtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gVGVzdE1lc3NhZ2VUeXBlIHtcblx0RXJyb3IsXG5cdE91dHB1dFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUZXN0TWVzc2FnZVN0YWNrRnJhbWUge1xuXHRsYWJlbDogc3RyaW5nO1xuXHR1cmk6IFVSSSB8IHVuZGVmaW5lZDtcblx0cG9zaXRpb246IFBvc2l0aW9uIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgbmFtZXNwYWNlIElUZXN0TWVzc2FnZVN0YWNrRnJhbWUge1xuXHRleHBvcnQgaW50ZXJmYWNlIFNlcmlhbGl6ZWQge1xuXHRcdGxhYmVsOiBzdHJpbmc7XG5cdFx0dXJpOiBVcmlDb21wb25lbnRzIHwgdW5kZWZpbmVkO1xuXHRcdHBvc2l0aW9uOiBJUG9zaXRpb24gfCB1bmRlZmluZWQ7XG5cdH1cblxuXHRleHBvcnQgY29uc3Qgc2VyaWFsaXplID0gKHN0YWNrOiBSZWFkb25seTxJVGVzdE1lc3NhZ2VTdGFja0ZyYW1lPik6IFNlcmlhbGl6ZWQgPT4gKHtcblx0XHRsYWJlbDogc3RhY2subGFiZWwsXG5cdFx0dXJpOiBzdGFjay51cmk/LnRvSlNPTigpLFxuXHRcdHBvc2l0aW9uOiBzdGFjay5wb3NpdGlvbj8udG9KU09OKCksXG5cdH0pO1xuXG5cdGV4cG9ydCBjb25zdCBkZXNlcmlhbGl6ZSA9ICh1cmlJZGVudGl0eTogSVRlc3RVcmlDYW5vbmljYWxpemVyLCBzdGFjazogU2VyaWFsaXplZCk6IElUZXN0TWVzc2FnZVN0YWNrRnJhbWUgPT4gKHtcblx0XHRsYWJlbDogc3RhY2subGFiZWwsXG5cdFx0dXJpOiBzdGFjay51cmkgPyB1cmlJZGVudGl0eS5hc0Nhbm9uaWNhbFVyaShVUkkucmV2aXZlKHN0YWNrLnVyaSkpIDogdW5kZWZpbmVkLFxuXHRcdHBvc2l0aW9uOiBzdGFjay5wb3NpdGlvbiA/IFBvc2l0aW9uLmxpZnQoc3RhY2sucG9zaXRpb24pIDogdW5kZWZpbmVkLFxuXHR9KTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGVzdEVycm9yTWVzc2FnZSB7XG5cdG1lc3NhZ2U6IHN0cmluZyB8IElNYXJrZG93blN0cmluZztcblx0dHlwZTogVGVzdE1lc3NhZ2VUeXBlLkVycm9yO1xuXHRleHBlY3RlZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRhY3R1YWw6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Y29udGV4dFZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGxvY2F0aW9uOiBJUmljaExvY2F0aW9uIHwgdW5kZWZpbmVkO1xuXHRzdGFja1RyYWNlOiB1bmRlZmluZWQgfCBJVGVzdE1lc3NhZ2VTdGFja0ZyYW1lW107XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgSVRlc3RFcnJvck1lc3NhZ2Uge1xuXHRleHBvcnQgaW50ZXJmYWNlIFNlcmlhbGl6ZWQge1xuXHRcdG1lc3NhZ2U6IHN0cmluZyB8IElNYXJrZG93blN0cmluZztcblx0XHR0eXBlOiBUZXN0TWVzc2FnZVR5cGUuRXJyb3I7XG5cdFx0ZXhwZWN0ZWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRhY3R1YWw6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRjb250ZXh0VmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRsb2NhdGlvbjogSVJpY2hMb2NhdGlvbi5TZXJpYWxpemUgfCB1bmRlZmluZWQ7XG5cdFx0c3RhY2tUcmFjZTogdW5kZWZpbmVkIHwgSVRlc3RNZXNzYWdlU3RhY2tGcmFtZS5TZXJpYWxpemVkW107XG5cdH1cblxuXHRleHBvcnQgY29uc3Qgc2VyaWFsaXplID0gKG1lc3NhZ2U6IFJlYWRvbmx5PElUZXN0RXJyb3JNZXNzYWdlPik6IFNlcmlhbGl6ZWQgPT4gKHtcblx0XHRtZXNzYWdlOiBtZXNzYWdlLm1lc3NhZ2UsXG5cdFx0dHlwZTogVGVzdE1lc3NhZ2VUeXBlLkVycm9yLFxuXHRcdGV4cGVjdGVkOiBtZXNzYWdlLmV4cGVjdGVkLFxuXHRcdGFjdHVhbDogbWVzc2FnZS5hY3R1YWwsXG5cdFx0Y29udGV4dFZhbHVlOiBtZXNzYWdlLmNvbnRleHRWYWx1ZSxcblx0XHRsb2NhdGlvbjogbWVzc2FnZS5sb2NhdGlvbiAmJiBJUmljaExvY2F0aW9uLnNlcmlhbGl6ZShtZXNzYWdlLmxvY2F0aW9uKSxcblx0XHRzdGFja1RyYWNlOiBtZXNzYWdlLnN0YWNrVHJhY2U/Lm1hcChJVGVzdE1lc3NhZ2VTdGFja0ZyYW1lLnNlcmlhbGl6ZSksXG5cdH0pO1xuXG5cdGV4cG9ydCBjb25zdCBkZXNlcmlhbGl6ZSA9ICh1cmlJZGVudGl0eTogSVRlc3RVcmlDYW5vbmljYWxpemVyLCBtZXNzYWdlOiBTZXJpYWxpemVkKTogSVRlc3RFcnJvck1lc3NhZ2UgPT4gKHtcblx0XHRtZXNzYWdlOiBtZXNzYWdlLm1lc3NhZ2UsXG5cdFx0dHlwZTogVGVzdE1lc3NhZ2VUeXBlLkVycm9yLFxuXHRcdGV4cGVjdGVkOiBtZXNzYWdlLmV4cGVjdGVkLFxuXHRcdGFjdHVhbDogbWVzc2FnZS5hY3R1YWwsXG5cdFx0Y29udGV4dFZhbHVlOiBtZXNzYWdlLmNvbnRleHRWYWx1ZSxcblx0XHRsb2NhdGlvbjogbWVzc2FnZS5sb2NhdGlvbiAmJiBJUmljaExvY2F0aW9uLmRlc2VyaWFsaXplKHVyaUlkZW50aXR5LCBtZXNzYWdlLmxvY2F0aW9uKSxcblx0XHRzdGFja1RyYWNlOiBtZXNzYWdlLnN0YWNrVHJhY2UgJiYgbWVzc2FnZS5zdGFja1RyYWNlLm1hcChzID0+IElUZXN0TWVzc2FnZVN0YWNrRnJhbWUuZGVzZXJpYWxpemUodXJpSWRlbnRpdHksIHMpKSxcblx0fSk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRlc3RPdXRwdXRNZXNzYWdlIHtcblx0bWVzc2FnZTogc3RyaW5nO1xuXHR0eXBlOiBUZXN0TWVzc2FnZVR5cGUuT3V0cHV0O1xuXHRvZmZzZXQ6IG51bWJlcjtcblx0bGVuZ3RoOiBudW1iZXI7XG5cdG1hcmtlcj86IG51bWJlcjtcblx0bG9jYXRpb246IElSaWNoTG9jYXRpb24gfCB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgVFRZIG1hcmtlciBJRCBmb3IgZWl0aGVyIHN0YXJ0aW5nIG9yIGVuZGluZ1xuICogYW4gSVRlc3RPdXRwdXRNZXNzYWdlLm1hcmtlciBvZiB0aGUgZ2l2ZW4gSUQuXG4gKi9cbmV4cG9ydCBjb25zdCBnZXRNYXJrSWQgPSAobWFya2VyOiBudW1iZXIsIHN0YXJ0OiBib29sZWFuKSA9PiBgJHtzdGFydCA/ICdzJyA6ICdlJ30ke21hcmtlcn1gO1xuXG5leHBvcnQgbmFtZXNwYWNlIElUZXN0T3V0cHV0TWVzc2FnZSB7XG5cdGV4cG9ydCBpbnRlcmZhY2UgU2VyaWFsaXplZCB7XG5cdFx0bWVzc2FnZTogc3RyaW5nO1xuXHRcdG9mZnNldDogbnVtYmVyO1xuXHRcdGxlbmd0aDogbnVtYmVyO1xuXHRcdHR5cGU6IFRlc3RNZXNzYWdlVHlwZS5PdXRwdXQ7XG5cdFx0bG9jYXRpb246IElSaWNoTG9jYXRpb24uU2VyaWFsaXplIHwgdW5kZWZpbmVkO1xuXHR9XG5cblx0ZXhwb3J0IGNvbnN0IHNlcmlhbGl6ZSA9IChtZXNzYWdlOiBSZWFkb25seTxJVGVzdE91dHB1dE1lc3NhZ2U+KTogU2VyaWFsaXplZCA9PiAoe1xuXHRcdG1lc3NhZ2U6IG1lc3NhZ2UubWVzc2FnZSxcblx0XHR0eXBlOiBUZXN0TWVzc2FnZVR5cGUuT3V0cHV0LFxuXHRcdG9mZnNldDogbWVzc2FnZS5vZmZzZXQsXG5cdFx0bGVuZ3RoOiBtZXNzYWdlLmxlbmd0aCxcblx0XHRsb2NhdGlvbjogbWVzc2FnZS5sb2NhdGlvbiAmJiBJUmljaExvY2F0aW9uLnNlcmlhbGl6ZShtZXNzYWdlLmxvY2F0aW9uKSxcblx0fSk7XG5cblx0ZXhwb3J0IGNvbnN0IGRlc2VyaWFsaXplID0gKHVyaUlkZW50aXR5OiBJVGVzdFVyaUNhbm9uaWNhbGl6ZXIsIG1lc3NhZ2U6IFNlcmlhbGl6ZWQpOiBJVGVzdE91dHB1dE1lc3NhZ2UgPT4gKHtcblx0XHRtZXNzYWdlOiBtZXNzYWdlLm1lc3NhZ2UsXG5cdFx0dHlwZTogVGVzdE1lc3NhZ2VUeXBlLk91dHB1dCxcblx0XHRvZmZzZXQ6IG1lc3NhZ2Uub2Zmc2V0LFxuXHRcdGxlbmd0aDogbWVzc2FnZS5sZW5ndGgsXG5cdFx0bG9jYXRpb246IG1lc3NhZ2UubG9jYXRpb24gJiYgSVJpY2hMb2NhdGlvbi5kZXNlcmlhbGl6ZSh1cmlJZGVudGl0eSwgbWVzc2FnZS5sb2NhdGlvbiksXG5cdH0pO1xufVxuXG5leHBvcnQgdHlwZSBJVGVzdE1lc3NhZ2UgPSBJVGVzdEVycm9yTWVzc2FnZSB8IElUZXN0T3V0cHV0TWVzc2FnZTtcblxuZXhwb3J0IG5hbWVzcGFjZSBJVGVzdE1lc3NhZ2Uge1xuXHRleHBvcnQgdHlwZSBTZXJpYWxpemVkID0gSVRlc3RFcnJvck1lc3NhZ2UuU2VyaWFsaXplZCB8IElUZXN0T3V0cHV0TWVzc2FnZS5TZXJpYWxpemVkO1xuXG5cdGV4cG9ydCBjb25zdCBzZXJpYWxpemUgPSAobWVzc2FnZTogUmVhZG9ubHk8SVRlc3RNZXNzYWdlPik6IFNlcmlhbGl6ZWQgPT5cblx0XHRtZXNzYWdlLnR5cGUgPT09IFRlc3RNZXNzYWdlVHlwZS5FcnJvciA/IElUZXN0RXJyb3JNZXNzYWdlLnNlcmlhbGl6ZShtZXNzYWdlKSA6IElUZXN0T3V0cHV0TWVzc2FnZS5zZXJpYWxpemUobWVzc2FnZSk7XG5cblx0ZXhwb3J0IGNvbnN0IGRlc2VyaWFsaXplID0gKHVyaUlkZW50aXR5OiBJVGVzdFVyaUNhbm9uaWNhbGl6ZXIsIG1lc3NhZ2U6IFNlcmlhbGl6ZWQpOiBJVGVzdE1lc3NhZ2UgPT5cblx0XHRtZXNzYWdlLnR5cGUgPT09IFRlc3RNZXNzYWdlVHlwZS5FcnJvciA/IElUZXN0RXJyb3JNZXNzYWdlLmRlc2VyaWFsaXplKHVyaUlkZW50aXR5LCBtZXNzYWdlKSA6IElUZXN0T3V0cHV0TWVzc2FnZS5kZXNlcmlhbGl6ZSh1cmlJZGVudGl0eSwgbWVzc2FnZSk7XG5cblx0ZXhwb3J0IGNvbnN0IGlzRGlmZmFibGUgPSAobWVzc2FnZTogSVRlc3RNZXNzYWdlKTogbWVzc2FnZSBpcyBJVGVzdEVycm9yTWVzc2FnZSAmIHsgYWN0dWFsOiBzdHJpbmc7IGV4cGVjdGVkOiBzdHJpbmcgfSA9PlxuXHRcdG1lc3NhZ2UudHlwZSA9PT0gVGVzdE1lc3NhZ2VUeXBlLkVycm9yICYmIG1lc3NhZ2UuYWN0dWFsICE9PSB1bmRlZmluZWQgJiYgbWVzc2FnZS5leHBlY3RlZCAhPT0gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUZXN0VGFza1N0YXRlIHtcblx0c3RhdGU6IFRlc3RSZXN1bHRTdGF0ZTtcblx0ZHVyYXRpb246IG51bWJlciB8IHVuZGVmaW5lZDtcblx0bWVzc2FnZXM6IElUZXN0TWVzc2FnZVtdO1xufVxuXG5leHBvcnQgbmFtZXNwYWNlIElUZXN0VGFza1N0YXRlIHtcblx0ZXhwb3J0IGludGVyZmFjZSBTZXJpYWxpemVkIHtcblx0XHRzdGF0ZTogVGVzdFJlc3VsdFN0YXRlO1xuXHRcdGR1cmF0aW9uOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdFx0bWVzc2FnZXM6IElUZXN0TWVzc2FnZS5TZXJpYWxpemVkW107XG5cdH1cblxuXHRleHBvcnQgY29uc3Qgc2VyaWFsaXplV2l0aG91dE1lc3NhZ2VzID0gKHN0YXRlOiBJVGVzdFRhc2tTdGF0ZSk6IFNlcmlhbGl6ZWQgPT4gKHtcblx0XHRzdGF0ZTogc3RhdGUuc3RhdGUsXG5cdFx0ZHVyYXRpb246IHN0YXRlLmR1cmF0aW9uLFxuXHRcdG1lc3NhZ2VzOiBbXSxcblx0fSk7XG5cblx0ZXhwb3J0IGNvbnN0IHNlcmlhbGl6ZSA9IChzdGF0ZTogUmVhZG9ubHk8SVRlc3RUYXNrU3RhdGU+KTogU2VyaWFsaXplZCA9PiAoe1xuXHRcdHN0YXRlOiBzdGF0ZS5zdGF0ZSxcblx0XHRkdXJhdGlvbjogc3RhdGUuZHVyYXRpb24sXG5cdFx0bWVzc2FnZXM6IHN0YXRlLm1lc3NhZ2VzLm1hcChJVGVzdE1lc3NhZ2Uuc2VyaWFsaXplKSxcblx0fSk7XG5cblx0ZXhwb3J0IGNvbnN0IGRlc2VyaWFsaXplID0gKHVyaUlkZW50aXR5OiBJVGVzdFVyaUNhbm9uaWNhbGl6ZXIsIHN0YXRlOiBTZXJpYWxpemVkKTogSVRlc3RUYXNrU3RhdGUgPT4gKHtcblx0XHRzdGF0ZTogc3RhdGUuc3RhdGUsXG5cdFx0ZHVyYXRpb246IHN0YXRlLmR1cmF0aW9uLFxuXHRcdG1lc3NhZ2VzOiBzdGF0ZS5tZXNzYWdlcy5tYXAobSA9PiBJVGVzdE1lc3NhZ2UuZGVzZXJpYWxpemUodXJpSWRlbnRpdHksIG0pKSxcblx0fSk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRlc3RSdW5UYXNrIHtcblx0aWQ6IHN0cmluZztcblx0bmFtZTogc3RyaW5nO1xuXHRydW5uaW5nOiBib29sZWFuO1xuXHRjdHJsSWQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGVzdFRhZyB7XG5cdHJlYWRvbmx5IGlkOiBzdHJpbmc7XG59XG5cbmNvbnN0IHRlc3RUYWdEZWxpbWl0ZXIgPSAnXFwwJztcblxuZXhwb3J0IGNvbnN0IG5hbWVzcGFjZVRlc3RUYWcgPVxuXHQoY3RybElkOiBzdHJpbmcsIHRhZ0lkOiBzdHJpbmcpID0+IGN0cmxJZCArIHRlc3RUYWdEZWxpbWl0ZXIgKyB0YWdJZDtcblxuZXhwb3J0IGNvbnN0IGRlbmFtZXNwYWNlVGVzdFRhZyA9IChuYW1lc3BhY2VkOiBzdHJpbmcpID0+IHtcblx0Y29uc3QgaW5kZXggPSBuYW1lc3BhY2VkLmluZGV4T2YodGVzdFRhZ0RlbGltaXRlcik7XG5cdHJldHVybiB7IGN0cmxJZDogbmFtZXNwYWNlZC5zbGljZSgwLCBpbmRleCksIHRhZ0lkOiBuYW1lc3BhY2VkLnNsaWNlKGluZGV4ICsgMSkgfTtcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRlc3RUYWdEaXNwbGF5SW5mbyB7XG5cdGlkOiBzdHJpbmc7XG59XG5cbi8qKlxuICogVGhlIFRlc3RJdGVtIGZyb20gLmQudHMsIGFzIGEgcGxhaW4gb2JqZWN0IHdpdGhvdXQgY2hpbGRyZW4uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSVRlc3RJdGVtIHtcblx0LyoqIElEIG9mIHRoZSB0ZXN0IGdpdmVuIGJ5IHRoZSB0ZXN0IGNvbnRyb2xsZXIgKi9cblx0ZXh0SWQ6IHN0cmluZztcblx0bGFiZWw6IHN0cmluZztcblx0dGFnczogc3RyaW5nW107XG5cdGJ1c3k6IGJvb2xlYW47XG5cdGNoaWxkcmVuPzogbmV2ZXI7XG5cdHVyaTogVVJJIHwgdW5kZWZpbmVkO1xuXHRyYW5nZTogUmFuZ2UgfCBudWxsO1xuXHRkZXNjcmlwdGlvbjogc3RyaW5nIHwgbnVsbDtcblx0ZXJyb3I6IHN0cmluZyB8IElNYXJrZG93blN0cmluZyB8IG51bGw7XG5cdHNvcnRUZXh0OiBzdHJpbmcgfCBudWxsO1xufVxuXG5leHBvcnQgbmFtZXNwYWNlIElUZXN0SXRlbSB7XG5cdGV4cG9ydCBpbnRlcmZhY2UgU2VyaWFsaXplZCB7XG5cdFx0ZXh0SWQ6IHN0cmluZztcblx0XHRsYWJlbDogc3RyaW5nO1xuXHRcdHRhZ3M6IHN0cmluZ1tdO1xuXHRcdGJ1c3k6IGJvb2xlYW47XG5cdFx0Y2hpbGRyZW4/OiBuZXZlcjtcblx0XHR1cmk6IFVyaUNvbXBvbmVudHMgfCB1bmRlZmluZWQ7XG5cdFx0cmFuZ2U6IElSYW5nZSB8IG51bGw7XG5cdFx0ZGVzY3JpcHRpb246IHN0cmluZyB8IG51bGw7XG5cdFx0ZXJyb3I6IHN0cmluZyB8IElNYXJrZG93blN0cmluZyB8IG51bGw7XG5cdFx0c29ydFRleHQ6IHN0cmluZyB8IG51bGw7XG5cdH1cblxuXHRleHBvcnQgY29uc3Qgc2VyaWFsaXplID0gKGl0ZW06IFJlYWRvbmx5PElUZXN0SXRlbT4pOiBTZXJpYWxpemVkID0+ICh7XG5cdFx0ZXh0SWQ6IGl0ZW0uZXh0SWQsXG5cdFx0bGFiZWw6IGl0ZW0ubGFiZWwsXG5cdFx0dGFnczogaXRlbS50YWdzLFxuXHRcdGJ1c3k6IGl0ZW0uYnVzeSxcblx0XHRjaGlsZHJlbjogdW5kZWZpbmVkLFxuXHRcdHVyaTogaXRlbS51cmk/LnRvSlNPTigpLFxuXHRcdHJhbmdlOiBpdGVtLnJhbmdlPy50b0pTT04oKSB8fCBudWxsLFxuXHRcdGRlc2NyaXB0aW9uOiBpdGVtLmRlc2NyaXB0aW9uLFxuXHRcdGVycm9yOiBpdGVtLmVycm9yLFxuXHRcdHNvcnRUZXh0OiBpdGVtLnNvcnRUZXh0XG5cdH0pO1xuXG5cdGV4cG9ydCBjb25zdCBkZXNlcmlhbGl6ZSA9ICh1cmlJZGVudGl0eTogSVRlc3RVcmlDYW5vbmljYWxpemVyLCBzZXJpYWxpemVkOiBTZXJpYWxpemVkKTogSVRlc3RJdGVtID0+ICh7XG5cdFx0ZXh0SWQ6IHNlcmlhbGl6ZWQuZXh0SWQsXG5cdFx0bGFiZWw6IHNlcmlhbGl6ZWQubGFiZWwsXG5cdFx0dGFnczogc2VyaWFsaXplZC50YWdzLFxuXHRcdGJ1c3k6IHNlcmlhbGl6ZWQuYnVzeSxcblx0XHRjaGlsZHJlbjogdW5kZWZpbmVkLFxuXHRcdHVyaTogc2VyaWFsaXplZC51cmkgPyB1cmlJZGVudGl0eS5hc0Nhbm9uaWNhbFVyaShVUkkucmV2aXZlKHNlcmlhbGl6ZWQudXJpKSkgOiB1bmRlZmluZWQsXG5cdFx0cmFuZ2U6IHNlcmlhbGl6ZWQucmFuZ2UgPyBSYW5nZS5saWZ0KHNlcmlhbGl6ZWQucmFuZ2UpIDogbnVsbCxcblx0XHRkZXNjcmlwdGlvbjogc2VyaWFsaXplZC5kZXNjcmlwdGlvbixcblx0XHRlcnJvcjogc2VyaWFsaXplZC5lcnJvcixcblx0XHRzb3J0VGV4dDogc2VyaWFsaXplZC5zb3J0VGV4dFxuXHR9KTtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gVGVzdEl0ZW1FeHBhbmRTdGF0ZSB7XG5cdE5vdEV4cGFuZGFibGUsXG5cdEV4cGFuZGFibGUsXG5cdEJ1c3lFeHBhbmRpbmcsXG5cdEV4cGFuZGVkLFxufVxuXG4vKipcbiAqIFRlc3RJdGVtLWxpa2Ugc2hhcGUsIGJ1dCB3aXRoIGFuIElEIGFuZCBjaGlsZHJlbiBhcyBzdHJpbmdzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEludGVybmFsVGVzdEl0ZW0ge1xuXHQvKiogQ29udHJvbGxlciBJRCBmcm9tIHdoZW5jZSB0aGlzIHRlc3QgY2FtZSAqL1xuXHRjb250cm9sbGVySWQ6IHN0cmluZztcblx0LyoqIEV4cGFuZGFiaWxpdHkgc3RhdGUgKi9cblx0ZXhwYW5kOiBUZXN0SXRlbUV4cGFuZFN0YXRlO1xuXHQvKiogUmF3IHRlc3QgaXRlbSBwcm9wZXJ0aWVzICovXG5cdGl0ZW06IElUZXN0SXRlbTtcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBJbnRlcm5hbFRlc3RJdGVtIHtcblx0ZXhwb3J0IGludGVyZmFjZSBTZXJpYWxpemVkIHtcblx0XHRleHBhbmQ6IFRlc3RJdGVtRXhwYW5kU3RhdGU7XG5cdFx0aXRlbTogSVRlc3RJdGVtLlNlcmlhbGl6ZWQ7XG5cdH1cblxuXHRleHBvcnQgY29uc3Qgc2VyaWFsaXplID0gKGl0ZW06IFJlYWRvbmx5PEludGVybmFsVGVzdEl0ZW0+KTogU2VyaWFsaXplZCA9PiAoe1xuXHRcdGV4cGFuZDogaXRlbS5leHBhbmQsXG5cdFx0aXRlbTogSVRlc3RJdGVtLnNlcmlhbGl6ZShpdGVtLml0ZW0pXG5cdH0pO1xuXG5cdGV4cG9ydCBjb25zdCBkZXNlcmlhbGl6ZSA9ICh1cmlJZGVudGl0eTogSVRlc3RVcmlDYW5vbmljYWxpemVyLCBzZXJpYWxpemVkOiBTZXJpYWxpemVkKTogSW50ZXJuYWxUZXN0SXRlbSA9PiAoe1xuXHRcdC8vIHRoZSBgY29udHJvbGxlcklkYCBpcyBkZXJpdmVkIGZyb20gdGhlIHRlc3QuaXRlbS5leHRJZC4gSXQncyByZWR1bmRhbnRcblx0XHQvLyBpbiB0aGUgbm9uLXNlcmlhbGl6ZWQgSW50ZXJuYWxUZXN0SXRlbSB0b28sIGJ1dCB0aGVyZSBqdXN0IGJlY2F1c2UgaXQnc1xuXHRcdC8vIGNoZWNrZWQgYWdhaW5zdCBpbiBtYW55IGhvdCBwYXRocy5cblx0XHRjb250cm9sbGVySWQ6IFRlc3RJZC5yb290KHNlcmlhbGl6ZWQuaXRlbS5leHRJZCksXG5cdFx0ZXhwYW5kOiBzZXJpYWxpemVkLmV4cGFuZCxcblx0XHRpdGVtOiBJVGVzdEl0ZW0uZGVzZXJpYWxpemUodXJpSWRlbnRpdHksIHNlcmlhbGl6ZWQuaXRlbSlcblx0fSk7XG59XG5cbi8qKlxuICogQSBwYXJ0aWFsIHVwZGF0ZSBtYWRlIHRvIGFuIGV4aXN0aW5nIEludGVybmFsVGVzdEl0ZW0uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSVRlc3RJdGVtVXBkYXRlIHtcblx0ZXh0SWQ6IHN0cmluZztcblx0ZXhwYW5kPzogVGVzdEl0ZW1FeHBhbmRTdGF0ZTtcblx0aXRlbT86IFBhcnRpYWw8SVRlc3RJdGVtPjtcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBJVGVzdEl0ZW1VcGRhdGUge1xuXHRleHBvcnQgaW50ZXJmYWNlIFNlcmlhbGl6ZWQge1xuXHRcdGV4dElkOiBzdHJpbmc7XG5cdFx0ZXhwYW5kPzogVGVzdEl0ZW1FeHBhbmRTdGF0ZTtcblx0XHRpdGVtPzogUGFydGlhbDxJVGVzdEl0ZW0uU2VyaWFsaXplZD47XG5cdH1cblxuXHRleHBvcnQgY29uc3Qgc2VyaWFsaXplID0gKHU6IFJlYWRvbmx5PElUZXN0SXRlbVVwZGF0ZT4pOiBTZXJpYWxpemVkID0+IHtcblx0XHRsZXQgaXRlbTogUGFydGlhbDxJVGVzdEl0ZW0uU2VyaWFsaXplZD4gfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHUuaXRlbSkge1xuXHRcdFx0aXRlbSA9IHt9O1xuXHRcdFx0aWYgKHUuaXRlbS5sYWJlbCAhPT0gdW5kZWZpbmVkKSB7IGl0ZW0ubGFiZWwgPSB1Lml0ZW0ubGFiZWw7IH1cblx0XHRcdGlmICh1Lml0ZW0udGFncyAhPT0gdW5kZWZpbmVkKSB7IGl0ZW0udGFncyA9IHUuaXRlbS50YWdzOyB9XG5cdFx0XHRpZiAodS5pdGVtLmJ1c3kgIT09IHVuZGVmaW5lZCkgeyBpdGVtLmJ1c3kgPSB1Lml0ZW0uYnVzeTsgfVxuXHRcdFx0aWYgKHUuaXRlbS51cmkgIT09IHVuZGVmaW5lZCkgeyBpdGVtLnVyaSA9IHUuaXRlbS51cmk/LnRvSlNPTigpOyB9XG5cdFx0XHRpZiAodS5pdGVtLnJhbmdlICE9PSB1bmRlZmluZWQpIHsgaXRlbS5yYW5nZSA9IHUuaXRlbS5yYW5nZT8udG9KU09OKCk7IH1cblx0XHRcdGlmICh1Lml0ZW0uZGVzY3JpcHRpb24gIT09IHVuZGVmaW5lZCkgeyBpdGVtLmRlc2NyaXB0aW9uID0gdS5pdGVtLmRlc2NyaXB0aW9uOyB9XG5cdFx0XHRpZiAodS5pdGVtLmVycm9yICE9PSB1bmRlZmluZWQpIHsgaXRlbS5lcnJvciA9IHUuaXRlbS5lcnJvcjsgfVxuXHRcdFx0aWYgKHUuaXRlbS5zb3J0VGV4dCAhPT0gdW5kZWZpbmVkKSB7IGl0ZW0uc29ydFRleHQgPSB1Lml0ZW0uc29ydFRleHQ7IH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyBleHRJZDogdS5leHRJZCwgZXhwYW5kOiB1LmV4cGFuZCwgaXRlbSB9O1xuXHR9O1xuXG5cdGV4cG9ydCBjb25zdCBkZXNlcmlhbGl6ZSA9ICh1OiBTZXJpYWxpemVkKTogSVRlc3RJdGVtVXBkYXRlID0+IHtcblx0XHRsZXQgaXRlbTogUGFydGlhbDxJVGVzdEl0ZW0+IHwgdW5kZWZpbmVkO1xuXHRcdGlmICh1Lml0ZW0pIHtcblx0XHRcdGl0ZW0gPSB7fTtcblx0XHRcdGlmICh1Lml0ZW0ubGFiZWwgIT09IHVuZGVmaW5lZCkgeyBpdGVtLmxhYmVsID0gdS5pdGVtLmxhYmVsOyB9XG5cdFx0XHRpZiAodS5pdGVtLnRhZ3MgIT09IHVuZGVmaW5lZCkgeyBpdGVtLnRhZ3MgPSB1Lml0ZW0udGFnczsgfVxuXHRcdFx0aWYgKHUuaXRlbS5idXN5ICE9PSB1bmRlZmluZWQpIHsgaXRlbS5idXN5ID0gdS5pdGVtLmJ1c3k7IH1cblx0XHRcdGlmICh1Lml0ZW0ucmFuZ2UgIT09IHVuZGVmaW5lZCkgeyBpdGVtLnJhbmdlID0gdS5pdGVtLnJhbmdlID8gUmFuZ2UubGlmdCh1Lml0ZW0ucmFuZ2UpIDogbnVsbDsgfVxuXHRcdFx0aWYgKHUuaXRlbS5kZXNjcmlwdGlvbiAhPT0gdW5kZWZpbmVkKSB7IGl0ZW0uZGVzY3JpcHRpb24gPSB1Lml0ZW0uZGVzY3JpcHRpb247IH1cblx0XHRcdGlmICh1Lml0ZW0uZXJyb3IgIT09IHVuZGVmaW5lZCkgeyBpdGVtLmVycm9yID0gdS5pdGVtLmVycm9yOyB9XG5cdFx0XHRpZiAodS5pdGVtLnNvcnRUZXh0ICE9PSB1bmRlZmluZWQpIHsgaXRlbS5zb3J0VGV4dCA9IHUuaXRlbS5zb3J0VGV4dDsgfVxuXHRcdH1cblxuXHRcdHJldHVybiB7IGV4dElkOiB1LmV4dElkLCBleHBhbmQ6IHUuZXhwYW5kLCBpdGVtIH07XG5cdH07XG5cbn1cblxuZXhwb3J0IGNvbnN0IGFwcGx5VGVzdEl0ZW1VcGRhdGUgPSAoaW50ZXJuYWw6IEludGVybmFsVGVzdEl0ZW0gfCBJVGVzdEl0ZW1VcGRhdGUsIHBhdGNoOiBJVGVzdEl0ZW1VcGRhdGUpID0+IHtcblx0aWYgKHBhdGNoLmV4cGFuZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0aW50ZXJuYWwuZXhwYW5kID0gcGF0Y2guZXhwYW5kO1xuXHR9XG5cdGlmIChwYXRjaC5pdGVtICE9PSB1bmRlZmluZWQpIHtcblx0XHRpbnRlcm5hbC5pdGVtID0gaW50ZXJuYWwuaXRlbSA/IE9iamVjdC5hc3NpZ24oaW50ZXJuYWwuaXRlbSwgcGF0Y2guaXRlbSkgOiBwYXRjaC5pdGVtO1xuXHR9XG59O1xuXG4vKiogUmVxdWVzdCB0byBhbiBleHQgaG9zdCB0byBnZXQgZm9sbG93dXAgbWVzc2FnZXMgZm9yIGEgdGVzdCBmYWlsdXJlLiAqL1xuZXhwb3J0IGludGVyZmFjZSBUZXN0TWVzc2FnZUZvbGxvd3VwUmVxdWVzdCB7XG5cdHJlc3VsdElkOiBzdHJpbmc7XG5cdGV4dElkOiBzdHJpbmc7XG5cdHRhc2tJbmRleDogbnVtYmVyO1xuXHRtZXNzYWdlSW5kZXg6IG51bWJlcjtcbn1cblxuLyoqIFJlcXVlc3QgdG8gYW4gZXh0IGhvc3QgdG8gZ2V0IGZvbGxvd3VwIG1lc3NhZ2VzIGZvciBhIHRlc3QgZmFpbHVyZS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVGVzdE1lc3NhZ2VGb2xsb3d1cFJlc3BvbnNlIHtcblx0aWQ6IG51bWJlcjtcblx0dGl0bGU6IHN0cmluZztcbn1cblxuLyoqXG4gKiBUZXN0IHJlc3VsdCBpdGVtIHVzZWQgaW4gdGhlIG1haW4gdGhyZWFkLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFRlc3RSZXN1bHRJdGVtIGV4dGVuZHMgSW50ZXJuYWxUZXN0SXRlbSB7XG5cdC8qKiBTdGF0ZSBvZiB0aGlzIHRlc3QgaW4gdmFyaW91cyB0YXNrcyAqL1xuXHR0YXNrczogSVRlc3RUYXNrU3RhdGVbXTtcblx0LyoqIFN0YXRlIG9mIHRoaXMgdGVzdCBhcyBhIGNvbXB1dGF0aW9uIG9mIGl0cyB0YXNrcyAqL1xuXHRvd25Db21wdXRlZFN0YXRlOiBUZXN0UmVzdWx0U3RhdGU7XG5cdC8qKiBDb21wdXRlZCBzdGF0ZSBiYXNlZCBvbiBjaGlsZHJlbiAqL1xuXHRjb21wdXRlZFN0YXRlOiBUZXN0UmVzdWx0U3RhdGU7XG5cdC8qKiBNYXggZHVyYXRpb24gb2YgdGhlIGl0ZW0ncyB0YXNrcyAoaWYgcnVuIGRpcmVjdGx5KSAqL1xuXHRvd25EdXJhdGlvbj86IG51bWJlcjtcblx0LyoqIFdoZXRoZXIgdGhpcyB0ZXN0IGl0ZW0gaXMgb3V0ZGF0ZWQgKi9cblx0cmV0aXJlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgVGVzdFJlc3VsdEl0ZW0ge1xuXHQvKipcblx0ICogU2VyaWFsaXplZCB2ZXJzaW9uIG9mIHRoZSBUZXN0UmVzdWx0SXRlbS4gTm90ZSB0aGF0ICdyZXRpcmVkJyBpcyBub3Rcblx0ICogaW5jbHVkZWQgc2luY2UgYWxsIGh5ZHJhdGVkIGl0ZW1zIGFyZSBhdXRvbWF0aWNhbGx5IHJldGlyZWQuXG5cdCAqL1xuXHRleHBvcnQgaW50ZXJmYWNlIFNlcmlhbGl6ZWQgZXh0ZW5kcyBJbnRlcm5hbFRlc3RJdGVtLlNlcmlhbGl6ZWQge1xuXHRcdHRhc2tzOiBJVGVzdFRhc2tTdGF0ZS5TZXJpYWxpemVkW107XG5cdFx0b3duQ29tcHV0ZWRTdGF0ZTogVGVzdFJlc3VsdFN0YXRlO1xuXHRcdGNvbXB1dGVkU3RhdGU6IFRlc3RSZXN1bHRTdGF0ZTtcblx0fVxuXG5cdGV4cG9ydCBjb25zdCBzZXJpYWxpemVXaXRob3V0TWVzc2FnZXMgPSAob3JpZ2luYWw6IFRlc3RSZXN1bHRJdGVtKTogU2VyaWFsaXplZCA9PiAoe1xuXHRcdC4uLkludGVybmFsVGVzdEl0ZW0uc2VyaWFsaXplKG9yaWdpbmFsKSxcblx0XHRvd25Db21wdXRlZFN0YXRlOiBvcmlnaW5hbC5vd25Db21wdXRlZFN0YXRlLFxuXHRcdGNvbXB1dGVkU3RhdGU6IG9yaWdpbmFsLmNvbXB1dGVkU3RhdGUsXG5cdFx0dGFza3M6IG9yaWdpbmFsLnRhc2tzLm1hcChJVGVzdFRhc2tTdGF0ZS5zZXJpYWxpemVXaXRob3V0TWVzc2FnZXMpLFxuXHR9KTtcblxuXHRleHBvcnQgY29uc3Qgc2VyaWFsaXplID0gKG9yaWdpbmFsOiBSZWFkb25seTxUZXN0UmVzdWx0SXRlbT4pOiBTZXJpYWxpemVkID0+ICh7XG5cdFx0Li4uSW50ZXJuYWxUZXN0SXRlbS5zZXJpYWxpemUob3JpZ2luYWwpLFxuXHRcdG93bkNvbXB1dGVkU3RhdGU6IG9yaWdpbmFsLm93bkNvbXB1dGVkU3RhdGUsXG5cdFx0Y29tcHV0ZWRTdGF0ZTogb3JpZ2luYWwuY29tcHV0ZWRTdGF0ZSxcblx0XHR0YXNrczogb3JpZ2luYWwudGFza3MubWFwKElUZXN0VGFza1N0YXRlLnNlcmlhbGl6ZSksXG5cdH0pO1xuXG5cdGV4cG9ydCBjb25zdCBkZXNlcmlhbGl6ZSA9ICh1cmlJZGVudGl0eTogSVRlc3RVcmlDYW5vbmljYWxpemVyLCBzZXJpYWxpemVkOiBTZXJpYWxpemVkKTogVGVzdFJlc3VsdEl0ZW0gPT4gKHtcblx0XHQuLi5JbnRlcm5hbFRlc3RJdGVtLmRlc2VyaWFsaXplKHVyaUlkZW50aXR5LCBzZXJpYWxpemVkKSxcblx0XHRvd25Db21wdXRlZFN0YXRlOiBzZXJpYWxpemVkLm93bkNvbXB1dGVkU3RhdGUsXG5cdFx0Y29tcHV0ZWRTdGF0ZTogc2VyaWFsaXplZC5jb21wdXRlZFN0YXRlLFxuXHRcdHRhc2tzOiBzZXJpYWxpemVkLnRhc2tzLm1hcChtID0+IElUZXN0VGFza1N0YXRlLmRlc2VyaWFsaXplKHVyaUlkZW50aXR5LCBtKSksXG5cdFx0cmV0aXJlZDogdHJ1ZSxcblx0fSk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNlcmlhbGl6ZWRUZXN0UmVzdWx0cyB7XG5cdC8qKiBJRCBvZiB0aGVzZSB0ZXN0IHJlc3VsdHMgKi9cblx0aWQ6IHN0cmluZztcblx0LyoqIFRpbWUgdGhlIHJlc3VsdHMgd2VyZSBjb21wZWx0ZWQgKi9cblx0Y29tcGxldGVkQXQ6IG51bWJlcjtcblx0LyoqIFN1YnNldCBvZiB0ZXN0IHJlc3VsdCBpdGVtcyAqL1xuXHRpdGVtczogVGVzdFJlc3VsdEl0ZW0uU2VyaWFsaXplZFtdO1xuXHQvKiogVGFza3MgaW52b2x2ZWQgaW4gdGhlIHJ1bi4gKi9cblx0dGFza3M6IHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkOyBjdHJsSWQ6IHN0cmluZzsgaGFzQ292ZXJhZ2U6IGJvb2xlYW4gfVtdO1xuXHQvKiogSHVtYW4tcmVhZGFibGUgbmFtZSBvZiB0aGUgdGVzdCBydW4uICovXG5cdG5hbWU6IHN0cmluZztcblx0LyoqIFRlc3QgdHJpZ2dlciBpbmZvcm1hdG9uICovXG5cdHJlcXVlc3Q6IFJlc29sdmVkVGVzdFJ1blJlcXVlc3Q7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRlc3RDb3ZlcmFnZSB7XG5cdGZpbGVzOiBJRmlsZUNvdmVyYWdlW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvdmVyYWdlQ291bnQge1xuXHRjb3ZlcmVkOiBudW1iZXI7XG5cdHRvdGFsOiBudW1iZXI7XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgSUNvdmVyYWdlQ291bnQge1xuXHRleHBvcnQgY29uc3QgZW1wdHkgPSAoKTogSUNvdmVyYWdlQ291bnQgPT4gKHsgY292ZXJlZDogMCwgdG90YWw6IDAgfSk7XG5cdGV4cG9ydCBjb25zdCBzdW0gPSAodGFyZ2V0OiBJQ292ZXJhZ2VDb3VudCwgc3JjOiBSZWFkb25seTxJQ292ZXJhZ2VDb3VudD4pID0+IHtcblx0XHR0YXJnZXQuY292ZXJlZCArPSBzcmMuY292ZXJlZDtcblx0XHR0YXJnZXQudG90YWwgKz0gc3JjLnRvdGFsO1xuXHR9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlQ292ZXJhZ2Uge1xuXHRpZDogc3RyaW5nO1xuXHR1cmk6IFVSSTtcblx0dGVzdElkcz86IHN0cmluZ1tdO1xuXHRzdGF0ZW1lbnQ6IElDb3ZlcmFnZUNvdW50O1xuXHRicmFuY2g/OiBJQ292ZXJhZ2VDb3VudDtcblx0ZGVjbGFyYXRpb24/OiBJQ292ZXJhZ2VDb3VudDtcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBJRmlsZUNvdmVyYWdlIHtcblx0ZXhwb3J0IGludGVyZmFjZSBTZXJpYWxpemVkIHtcblx0XHRpZDogc3RyaW5nO1xuXHRcdHVyaTogVXJpQ29tcG9uZW50cztcblx0XHR0ZXN0SWRzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcblx0XHRzdGF0ZW1lbnQ6IElDb3ZlcmFnZUNvdW50O1xuXHRcdGJyYW5jaD86IElDb3ZlcmFnZUNvdW50O1xuXHRcdGRlY2xhcmF0aW9uPzogSUNvdmVyYWdlQ291bnQ7XG5cdH1cblxuXHRleHBvcnQgY29uc3Qgc2VyaWFsaXplID0gKG9yaWdpbmFsOiBSZWFkb25seTxJRmlsZUNvdmVyYWdlPik6IFNlcmlhbGl6ZWQgPT4gKHtcblx0XHRpZDogb3JpZ2luYWwuaWQsXG5cdFx0c3RhdGVtZW50OiBvcmlnaW5hbC5zdGF0ZW1lbnQsXG5cdFx0YnJhbmNoOiBvcmlnaW5hbC5icmFuY2gsXG5cdFx0ZGVjbGFyYXRpb246IG9yaWdpbmFsLmRlY2xhcmF0aW9uLFxuXHRcdHRlc3RJZHM6IG9yaWdpbmFsLnRlc3RJZHMsXG5cdFx0dXJpOiBvcmlnaW5hbC51cmkudG9KU09OKCksXG5cdH0pO1xuXG5cdGV4cG9ydCBjb25zdCBkZXNlcmlhbGl6ZSA9ICh1cmlJZGVudGl0eTogSVRlc3RVcmlDYW5vbmljYWxpemVyLCBzZXJpYWxpemVkOiBTZXJpYWxpemVkKTogSUZpbGVDb3ZlcmFnZSA9PiAoe1xuXHRcdGlkOiBzZXJpYWxpemVkLmlkLFxuXHRcdHN0YXRlbWVudDogc2VyaWFsaXplZC5zdGF0ZW1lbnQsXG5cdFx0YnJhbmNoOiBzZXJpYWxpemVkLmJyYW5jaCxcblx0XHRkZWNsYXJhdGlvbjogc2VyaWFsaXplZC5kZWNsYXJhdGlvbixcblx0XHR0ZXN0SWRzOiBzZXJpYWxpemVkLnRlc3RJZHMsXG5cdFx0dXJpOiB1cmlJZGVudGl0eS5hc0Nhbm9uaWNhbFVyaShVUkkucmV2aXZlKHNlcmlhbGl6ZWQudXJpKSksXG5cdH0pO1xuXG5cdGV4cG9ydCBjb25zdCBlbXB0eSA9IChpZDogc3RyaW5nLCB1cmk6IFVSSSk6IElGaWxlQ292ZXJhZ2UgPT4gKHtcblx0XHRpZCxcblx0XHR1cmksXG5cdFx0c3RhdGVtZW50OiBJQ292ZXJhZ2VDb3VudC5lbXB0eSgpLFxuXHR9KTtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplVGhpbmdXaXRoTG9jYXRpb248VCBleHRlbmRzIHsgbG9jYXRpb24/OiBSYW5nZSB8IFBvc2l0aW9uIH0+KHNlcmlhbGl6ZWQ6IFQpOiBUICYgeyBsb2NhdGlvbj86IElSYW5nZSB8IElQb3NpdGlvbiB9IHtcblx0cmV0dXJuIHtcblx0XHQuLi5zZXJpYWxpemVkLFxuXHRcdGxvY2F0aW9uOiBzZXJpYWxpemVkLmxvY2F0aW9uPy50b0pTT04oKSxcblx0fTtcbn1cblxuZnVuY3Rpb24gZGVzZXJpYWxpemVUaGluZ1dpdGhMb2NhdGlvbjxUIGV4dGVuZHMgeyBsb2NhdGlvbj86IElSYW5nZSB8IElQb3NpdGlvbiB9PihzZXJpYWxpemVkOiBUKTogVCAmIHsgbG9jYXRpb24/OiBSYW5nZSB8IFBvc2l0aW9uIH0ge1xuXHRzZXJpYWxpemVkLmxvY2F0aW9uID0gc2VyaWFsaXplZC5sb2NhdGlvbiA/IChQb3NpdGlvbi5pc0lQb3NpdGlvbihzZXJpYWxpemVkLmxvY2F0aW9uKSA/IFBvc2l0aW9uLmxpZnQoc2VyaWFsaXplZC5sb2NhdGlvbikgOiBSYW5nZS5saWZ0KHNlcmlhbGl6ZWQubG9jYXRpb24pKSA6IHVuZGVmaW5lZDtcblx0cmV0dXJuIHNlcmlhbGl6ZWQgYXMgVCAmIHsgbG9jYXRpb24/OiBSYW5nZSB8IFBvc2l0aW9uIH07XG59XG5cbi8qKiBOdW1iZXIgb2YgcmVjZW50IHJ1bnMgaW4gd2hpY2ggY292ZXJhZ2UgcmVwb3J0cyBzaG91bGQgYmUgcmV0YWluZWQuICovXG5leHBvcnQgY29uc3QgS0VFUF9OX0xBU1RfQ09WRVJBR0VfUkVQT1JUUyA9IDM7XG5cbmV4cG9ydCBjb25zdCBlbnVtIERldGFpbFR5cGUge1xuXHREZWNsYXJhdGlvbixcblx0U3RhdGVtZW50LFxuXHRCcmFuY2gsXG59XG5cbmV4cG9ydCB0eXBlIENvdmVyYWdlRGV0YWlscyA9IElEZWNsYXJhdGlvbkNvdmVyYWdlIHwgSVN0YXRlbWVudENvdmVyYWdlO1xuXG5leHBvcnQgbmFtZXNwYWNlIENvdmVyYWdlRGV0YWlscyB7XG5cdGV4cG9ydCB0eXBlIFNlcmlhbGl6ZWQgPSBJRGVjbGFyYXRpb25Db3ZlcmFnZS5TZXJpYWxpemVkIHwgSVN0YXRlbWVudENvdmVyYWdlLlNlcmlhbGl6ZWQ7XG5cblx0ZXhwb3J0IGNvbnN0IHNlcmlhbGl6ZSA9IChvcmlnaW5hbDogUmVhZG9ubHk8Q292ZXJhZ2VEZXRhaWxzPik6IFNlcmlhbGl6ZWQgPT5cblx0XHRvcmlnaW5hbC50eXBlID09PSBEZXRhaWxUeXBlLkRlY2xhcmF0aW9uID8gSURlY2xhcmF0aW9uQ292ZXJhZ2Uuc2VyaWFsaXplKG9yaWdpbmFsKSA6IElTdGF0ZW1lbnRDb3ZlcmFnZS5zZXJpYWxpemUob3JpZ2luYWwpO1xuXG5cdGV4cG9ydCBjb25zdCBkZXNlcmlhbGl6ZSA9IChzZXJpYWxpemVkOiBTZXJpYWxpemVkKTogQ292ZXJhZ2VEZXRhaWxzID0+XG5cdFx0c2VyaWFsaXplZC50eXBlID09PSBEZXRhaWxUeXBlLkRlY2xhcmF0aW9uID8gSURlY2xhcmF0aW9uQ292ZXJhZ2UuZGVzZXJpYWxpemUoc2VyaWFsaXplZCkgOiBJU3RhdGVtZW50Q292ZXJhZ2UuZGVzZXJpYWxpemUoc2VyaWFsaXplZCk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUJyYW5jaENvdmVyYWdlIHtcblx0Y291bnQ6IG51bWJlciB8IGJvb2xlYW47XG5cdGxhYmVsPzogc3RyaW5nO1xuXHRsb2NhdGlvbj86IFJhbmdlIHwgUG9zaXRpb247XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgSUJyYW5jaENvdmVyYWdlIHtcblx0ZXhwb3J0IGludGVyZmFjZSBTZXJpYWxpemVkIHtcblx0XHRjb3VudDogbnVtYmVyIHwgYm9vbGVhbjtcblx0XHRsYWJlbD86IHN0cmluZztcblx0XHRsb2NhdGlvbj86IElSYW5nZSB8IElQb3NpdGlvbjtcblx0fVxuXG5cdGV4cG9ydCBjb25zdCBzZXJpYWxpemU6IChvcmlnaW5hbDogSUJyYW5jaENvdmVyYWdlKSA9PiBTZXJpYWxpemVkID0gc2VyaWFsaXplVGhpbmdXaXRoTG9jYXRpb247XG5cdGV4cG9ydCBjb25zdCBkZXNlcmlhbGl6ZTogKG9yaWdpbmFsOiBTZXJpYWxpemVkKSA9PiBJQnJhbmNoQ292ZXJhZ2UgPSBkZXNlcmlhbGl6ZVRoaW5nV2l0aExvY2F0aW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElEZWNsYXJhdGlvbkNvdmVyYWdlIHtcblx0dHlwZTogRGV0YWlsVHlwZS5EZWNsYXJhdGlvbjtcblx0bmFtZTogc3RyaW5nO1xuXHRjb3VudDogbnVtYmVyIHwgYm9vbGVhbjtcblx0bG9jYXRpb246IFJhbmdlIHwgUG9zaXRpb247XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgSURlY2xhcmF0aW9uQ292ZXJhZ2Uge1xuXHRleHBvcnQgaW50ZXJmYWNlIFNlcmlhbGl6ZWQge1xuXHRcdHR5cGU6IERldGFpbFR5cGUuRGVjbGFyYXRpb247XG5cdFx0bmFtZTogc3RyaW5nO1xuXHRcdGNvdW50OiBudW1iZXIgfCBib29sZWFuO1xuXHRcdGxvY2F0aW9uOiBJUmFuZ2UgfCBJUG9zaXRpb247XG5cdH1cblxuXHRleHBvcnQgY29uc3Qgc2VyaWFsaXplOiAob3JpZ2luYWw6IElEZWNsYXJhdGlvbkNvdmVyYWdlKSA9PiBTZXJpYWxpemVkID0gc2VyaWFsaXplVGhpbmdXaXRoTG9jYXRpb247XG5cdGV4cG9ydCBjb25zdCBkZXNlcmlhbGl6ZTogKG9yaWdpbmFsOiBTZXJpYWxpemVkKSA9PiBJRGVjbGFyYXRpb25Db3ZlcmFnZSA9IGRlc2VyaWFsaXplVGhpbmdXaXRoTG9jYXRpb247XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0YXRlbWVudENvdmVyYWdlIHtcblx0dHlwZTogRGV0YWlsVHlwZS5TdGF0ZW1lbnQ7XG5cdGNvdW50OiBudW1iZXIgfCBib29sZWFuO1xuXHRsb2NhdGlvbjogUmFuZ2UgfCBQb3NpdGlvbjtcblx0YnJhbmNoZXM/OiBJQnJhbmNoQ292ZXJhZ2VbXTtcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBJU3RhdGVtZW50Q292ZXJhZ2Uge1xuXHRleHBvcnQgaW50ZXJmYWNlIFNlcmlhbGl6ZWQge1xuXHRcdHR5cGU6IERldGFpbFR5cGUuU3RhdGVtZW50O1xuXHRcdGNvdW50OiBudW1iZXIgfCBib29sZWFuO1xuXHRcdGxvY2F0aW9uOiBJUmFuZ2UgfCBJUG9zaXRpb247XG5cdFx0YnJhbmNoZXM/OiBJQnJhbmNoQ292ZXJhZ2UuU2VyaWFsaXplZFtdO1xuXHR9XG5cblx0ZXhwb3J0IGNvbnN0IHNlcmlhbGl6ZSA9IChvcmlnaW5hbDogUmVhZG9ubHk8SVN0YXRlbWVudENvdmVyYWdlPik6IFNlcmlhbGl6ZWQgPT4gKHtcblx0XHQuLi5zZXJpYWxpemVUaGluZ1dpdGhMb2NhdGlvbihvcmlnaW5hbCksXG5cdFx0YnJhbmNoZXM6IG9yaWdpbmFsLmJyYW5jaGVzPy5tYXAoSUJyYW5jaENvdmVyYWdlLnNlcmlhbGl6ZSksXG5cdH0pO1xuXG5cdGV4cG9ydCBjb25zdCBkZXNlcmlhbGl6ZSA9IChzZXJpYWxpemVkOiBTZXJpYWxpemVkKTogSVN0YXRlbWVudENvdmVyYWdlID0+ICh7XG5cdFx0Li4uZGVzZXJpYWxpemVUaGluZ1dpdGhMb2NhdGlvbihzZXJpYWxpemVkKSxcblx0XHRicmFuY2hlczogc2VyaWFsaXplZC5icmFuY2hlcz8ubWFwKElCcmFuY2hDb3ZlcmFnZS5kZXNlcmlhbGl6ZSksXG5cdH0pO1xufVxuXG5leHBvcnQgY29uc3QgZW51bSBUZXN0RGlmZk9wVHlwZSB7XG5cdC8qKiBBZGRzIGEgbmV3IHRlc3QgKHdpdGggY2hpbGRyZW4pICovXG5cdEFkZCxcblx0LyoqIFNoYWxsb3ctdXBkYXRlcyBhbiBleGlzdGluZyB0ZXN0ICovXG5cdFVwZGF0ZSxcblx0LyoqIFJhbmdlcyBvZiBzb21lIHRlc3RzIGluIGEgZG9jdW1lbnQgd2VyZSBzeW5jZWQsIHNvIGl0IHNob3VsZCBiZSBjb25zaWRlcmVkIHVwLXRvLWRhdGUgKi9cblx0RG9jdW1lbnRTeW5jZWQsXG5cdC8qKiBSZW1vdmVzIGEgdGVzdCAoYW5kIGFsbCBpdHMgY2hpbGRyZW4pICovXG5cdFJlbW92ZSxcblx0LyoqIENoYW5nZXMgdGhlIG51bWJlciBvZiBjb250cm9sbGVycyB3aG8gYXJlIHlldCB0byBwdWJsaXNoIHRoZWlyIGNvbGxlY3Rpb24gcm9vdHMuICovXG5cdEluY3JlbWVudFBlbmRpbmdFeHRIb3N0cyxcblx0LyoqIFJldGlyZXMgYSB0ZXN0L3Jlc3VsdCAqL1xuXHRSZXRpcmUsXG5cdC8qKiBBZGQgYSBuZXcgdGVzdCB0YWcgKi9cblx0QWRkVGFnLFxuXHQvKiogUmVtb3ZlIGEgdGVzdCB0YWcgKi9cblx0UmVtb3ZlVGFnLFxufVxuXG5leHBvcnQgdHlwZSBUZXN0c0RpZmZPcCA9XG5cdHwgeyBvcDogVGVzdERpZmZPcFR5cGUuQWRkOyBpdGVtOiBJbnRlcm5hbFRlc3RJdGVtIH1cblx0fCB7IG9wOiBUZXN0RGlmZk9wVHlwZS5VcGRhdGU7IGl0ZW06IElUZXN0SXRlbVVwZGF0ZSB9XG5cdHwgeyBvcDogVGVzdERpZmZPcFR5cGUuUmVtb3ZlOyBpdGVtSWQ6IHN0cmluZyB9XG5cdHwgeyBvcDogVGVzdERpZmZPcFR5cGUuUmV0aXJlOyBpdGVtSWQ6IHN0cmluZyB9XG5cdHwgeyBvcDogVGVzdERpZmZPcFR5cGUuSW5jcmVtZW50UGVuZGluZ0V4dEhvc3RzOyBhbW91bnQ6IG51bWJlciB9XG5cdHwgeyBvcDogVGVzdERpZmZPcFR5cGUuQWRkVGFnOyB0YWc6IElUZXN0VGFnRGlzcGxheUluZm8gfVxuXHR8IHsgb3A6IFRlc3REaWZmT3BUeXBlLlJlbW92ZVRhZzsgaWQ6IHN0cmluZyB9XG5cdHwgeyBvcDogVGVzdERpZmZPcFR5cGUuRG9jdW1lbnRTeW5jZWQ7IHVyaTogVVJJOyBkb2N2PzogbnVtYmVyIH07XG5cbmV4cG9ydCBuYW1lc3BhY2UgVGVzdHNEaWZmT3Age1xuXHRleHBvcnQgdHlwZSBTZXJpYWxpemVkID1cblx0XHR8IHsgb3A6IFRlc3REaWZmT3BUeXBlLkFkZDsgaXRlbTogSW50ZXJuYWxUZXN0SXRlbS5TZXJpYWxpemVkIH1cblx0XHR8IHsgb3A6IFRlc3REaWZmT3BUeXBlLlVwZGF0ZTsgaXRlbTogSVRlc3RJdGVtVXBkYXRlLlNlcmlhbGl6ZWQgfVxuXHRcdHwgeyBvcDogVGVzdERpZmZPcFR5cGUuUmVtb3ZlOyBpdGVtSWQ6IHN0cmluZyB9XG5cdFx0fCB7IG9wOiBUZXN0RGlmZk9wVHlwZS5SZXRpcmU7IGl0ZW1JZDogc3RyaW5nIH1cblx0XHR8IHsgb3A6IFRlc3REaWZmT3BUeXBlLkluY3JlbWVudFBlbmRpbmdFeHRIb3N0czsgYW1vdW50OiBudW1iZXIgfVxuXHRcdHwgeyBvcDogVGVzdERpZmZPcFR5cGUuQWRkVGFnOyB0YWc6IElUZXN0VGFnRGlzcGxheUluZm8gfVxuXHRcdHwgeyBvcDogVGVzdERpZmZPcFR5cGUuUmVtb3ZlVGFnOyBpZDogc3RyaW5nIH1cblx0XHR8IHsgb3A6IFRlc3REaWZmT3BUeXBlLkRvY3VtZW50U3luY2VkOyB1cmk6IFVyaUNvbXBvbmVudHM7IGRvY3Y/OiBudW1iZXIgfTtcblxuXHRleHBvcnQgY29uc3QgZGVzZXJpYWxpemUgPSAodXJpSWRlbnRpdHk6IElUZXN0VXJpQ2Fub25pY2FsaXplciwgdTogU2VyaWFsaXplZCk6IFRlc3RzRGlmZk9wID0+IHtcblx0XHRpZiAodS5vcCA9PT0gVGVzdERpZmZPcFR5cGUuQWRkKSB7XG5cdFx0XHRyZXR1cm4geyBvcDogdS5vcCwgaXRlbTogSW50ZXJuYWxUZXN0SXRlbS5kZXNlcmlhbGl6ZSh1cmlJZGVudGl0eSwgdS5pdGVtKSB9O1xuXHRcdH0gZWxzZSBpZiAodS5vcCA9PT0gVGVzdERpZmZPcFR5cGUuVXBkYXRlKSB7XG5cdFx0XHRyZXR1cm4geyBvcDogdS5vcCwgaXRlbTogSVRlc3RJdGVtVXBkYXRlLmRlc2VyaWFsaXplKHUuaXRlbSkgfTtcblx0XHR9IGVsc2UgaWYgKHUub3AgPT09IFRlc3REaWZmT3BUeXBlLkRvY3VtZW50U3luY2VkKSB7XG5cdFx0XHRyZXR1cm4geyBvcDogdS5vcCwgdXJpOiB1cmlJZGVudGl0eS5hc0Nhbm9uaWNhbFVyaShVUkkucmV2aXZlKHUudXJpKSksIGRvY3Y6IHUuZG9jdiB9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdTtcblx0XHR9XG5cdH07XG5cblx0ZXhwb3J0IGNvbnN0IHNlcmlhbGl6ZSA9ICh1OiBSZWFkb25seTxUZXN0c0RpZmZPcD4pOiBTZXJpYWxpemVkID0+IHtcblx0XHRpZiAodS5vcCA9PT0gVGVzdERpZmZPcFR5cGUuQWRkKSB7XG5cdFx0XHRyZXR1cm4geyBvcDogdS5vcCwgaXRlbTogSW50ZXJuYWxUZXN0SXRlbS5zZXJpYWxpemUodS5pdGVtKSB9O1xuXHRcdH0gZWxzZSBpZiAodS5vcCA9PT0gVGVzdERpZmZPcFR5cGUuVXBkYXRlKSB7XG5cdFx0XHRyZXR1cm4geyBvcDogdS5vcCwgaXRlbTogSVRlc3RJdGVtVXBkYXRlLnNlcmlhbGl6ZSh1Lml0ZW0pIH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB1O1xuXHRcdH1cblx0fTtcbn1cblxuLyoqXG4gKiBDb250ZXh0IGZvciBhY3Rpb25zIHRha2VuIGluIHRoZSB0ZXN0IGV4cGxvcmVyIHZpZXcuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSVRlc3RJdGVtQ29udGV4dCB7XG5cdC8qKiBNYXJzaGFsbGluZyBtYXJrZXIgKi9cblx0JG1pZDogTWFyc2hhbGxlZElkLlRlc3RJdGVtQ29udGV4dDtcblx0LyoqIFRlc3RzIGFuZCBwYXJlbnRzIGZyb20gdGhlIHJvb3QgdG8gdGhlIGN1cnJlbnQgaXRlbXMgKi9cblx0dGVzdHM6IEludGVybmFsVGVzdEl0ZW0uU2VyaWFsaXplZFtdO1xufVxuXG4vKipcbiAqIENvbnRleHQgZm9yIGFjdGlvbnMgdGFrZW4gaW4gdGhlIHRlc3QgZXhwbG9yZXIgdmlldy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJVGVzdE1lc3NhZ2VNZW51QXJncyB7XG5cdC8qKiBNYXJzaGFsbGluZyBtYXJrZXIgKi9cblx0JG1pZDogTWFyc2hhbGxlZElkLlRlc3RNZXNzYWdlTWVudUFyZ3M7XG5cdC8qKiBUZXN0cyBleHQgSUQgKi9cblx0dGVzdDogSW50ZXJuYWxUZXN0SXRlbS5TZXJpYWxpemVkO1xuXHQvKiogU2VyaWFsaXplZCB0ZXN0IG1lc3NhZ2UgKi9cblx0bWVzc2FnZTogSVRlc3RNZXNzYWdlLlNlcmlhbGl6ZWQ7XG59XG5cbi8qKlxuICogUmVxdWVzdCBmcm9tIHRoZSBleHQgaG9zdCBvciBtYWluIHRocmVhZCB0byBpbmRpY2F0ZSB0aGF0IHRlc3RzIGhhdmVcbiAqIGNoYW5nZWQuIEl0J3MgYXNzdW1lZCB0aGF0IGFueSBpdGVtIHVwc2VydGVkICptdXN0KiBoYXZlIGl0cyBjaGlsZHJlblxuICogcHJldmlvdXNseSBhbHNvIHVwc2VydGVkLCBvciB1cHNlcnRlZCBhcyBwYXJ0IG9mIHRoZSBzYW1lIG9wZXJhdGlvbi5cbiAqIENoaWxkcmVuIHRoYXQgbm8gbG9uZ2VyIGV4aXN0IGluIGFuIHVwc2VydGVkIGl0ZW0gd2lsbCBiZSByZW1vdmVkLlxuICovXG5leHBvcnQgdHlwZSBUZXN0c0RpZmYgPSBUZXN0c0RpZmZPcFtdO1xuXG4vKipcbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSW5jcmVtZW50YWxUZXN0Q29sbGVjdGlvbkl0ZW0gZXh0ZW5kcyBJbnRlcm5hbFRlc3RJdGVtIHtcblx0Y2hpbGRyZW46IFNldDxzdHJpbmc+O1xufVxuXG4vKipcbiAqIFRoZSBJbmNyZW1lbnRhbENoYW5nZUNvbGxlY3RvciBpcyB1c2VkIGluIHRoZSBJbmNyZW1lbnRhbFRlc3RDb2xsZWN0aW9uXG4gKiBhbmQgY2FsbGVkIHdpdGggZGlmZiBjaGFuZ2VzIGFzIHRoZXkncmUgYXBwbGllZC4gVGhpcyBpcyB1c2VkIGluIHRoZVxuICogZXh0IGhvc3QgdG8gY3JlYXRlIGEgY29oZXNpdmUgY2hhbmdlIGV2ZW50IGZyb20gYSBkaWZmLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEluY3JlbWVudGFsQ2hhbmdlQ29sbGVjdG9yPFQ+IHtcblx0LyoqXG5cdCAqIEEgbm9kZSB3YXMgYWRkZWQuXG5cdCAqL1xuXHRhZGQ/KG5vZGU6IFQpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBBIG5vZGUgaW4gdGhlIGNvbGxlY3Rpb24gd2FzIHVwZGF0ZWQuXG5cdCAqL1xuXHR1cGRhdGU/KG5vZGU6IFQpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBBIG5vZGUgd2FzIHJlbW92ZWQuXG5cdCAqL1xuXHRyZW1vdmU/KG5vZGU6IFQsIGlzTmVzdGVkT3BlcmF0aW9uOiBib29sZWFuKTogdm9pZDtcblxuXHQvKipcblx0ICogQ2FsbGVkIHdoZW4gdGhlIGRpZmYgaGFzIGJlZW4gYXBwbGllZC5cblx0ICovXG5cdGNvbXBsZXRlPygpOiB2b2lkO1xufVxuXG4vKipcbiAqIE1haW50YWlucyB0ZXN0cyBpbiB0aGlzIGV4dGVuc2lvbiBob3N0IHNlbnQgZnJvbSB0aGUgbWFpbiB0aHJlYWQuXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdEluY3JlbWVudGFsVGVzdENvbGxlY3Rpb248VCBleHRlbmRzIEluY3JlbWVudGFsVGVzdENvbGxlY3Rpb25JdGVtPiB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3RhZ3MgPSBuZXcgTWFwPHN0cmluZywgSVRlc3RUYWdEaXNwbGF5SW5mbz4oKTtcblxuXHQvKipcblx0ICogTWFwIG9mIGl0ZW0gSURzIHRvIHRlc3QgaXRlbSBvYmplY3RzLlxuXHQgKi9cblx0cHJvdGVjdGVkIHJlYWRvbmx5IGl0ZW1zID0gbmV3IE1hcDxzdHJpbmcsIFQ+KCk7XG5cblx0LyoqXG5cdCAqIElEIG9mIHRlc3Qgcm9vdCBpdGVtcy5cblx0ICovXG5cdHByb3RlY3RlZCByZWFkb25seSByb290cyA9IG5ldyBTZXQ8VD4oKTtcblxuXHQvKipcblx0ICogTnVtYmVyIG9mICdidXN5JyBjb250cm9sbGVycy5cblx0ICovXG5cdHByb3RlY3RlZCBidXN5Q29udHJvbGxlckNvdW50ID0gMDtcblxuXHQvKipcblx0ICogTnVtYmVyIG9mIHBlbmRpbmcgcm9vdHMuXG5cdCAqL1xuXHRwcm90ZWN0ZWQgcGVuZGluZ1Jvb3RDb3VudCA9IDA7XG5cblx0LyoqXG5cdCAqIEtub3duIHRlc3QgdGFncy5cblx0ICovXG5cdHB1YmxpYyByZWFkb25seSB0YWdzOiBSZWFkb25seU1hcDxzdHJpbmcsIElUZXN0VGFnRGlzcGxheUluZm8+ID0gdGhpcy5fdGFncztcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5OiBJVGVzdFVyaUNhbm9uaWNhbGl6ZXIpIHsgfVxuXG5cdC8qKlxuXHQgKiBBcHBsaWVzIHRoZSBkaWZmIHRvIHRoZSBjb2xsZWN0aW9uLlxuXHQgKi9cblx0cHVibGljIGFwcGx5KGRpZmY6IFRlc3RzRGlmZikge1xuXHRcdGNvbnN0IGNoYW5nZXMgPSB0aGlzLmNyZWF0ZUNoYW5nZUNvbGxlY3RvcigpO1xuXG5cdFx0Zm9yIChjb25zdCBvcCBvZiBkaWZmKSB7XG5cdFx0XHRzd2l0Y2ggKG9wLm9wKSB7XG5cdFx0XHRcdGNhc2UgVGVzdERpZmZPcFR5cGUuQWRkOlxuXHRcdFx0XHRcdHRoaXMuYWRkKEludGVybmFsVGVzdEl0ZW0uZGVzZXJpYWxpemUodGhpcy51cmlJZGVudGl0eSwgb3AuaXRlbSksIGNoYW5nZXMpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGNhc2UgVGVzdERpZmZPcFR5cGUuVXBkYXRlOlxuXHRcdFx0XHRcdHRoaXMudXBkYXRlKElUZXN0SXRlbVVwZGF0ZS5kZXNlcmlhbGl6ZShvcC5pdGVtKSwgY2hhbmdlcyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSBUZXN0RGlmZk9wVHlwZS5SZW1vdmU6XG5cdFx0XHRcdFx0dGhpcy5yZW1vdmUob3AuaXRlbUlkLCBjaGFuZ2VzKTtcblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRjYXNlIFRlc3REaWZmT3BUeXBlLlJldGlyZTpcblx0XHRcdFx0XHR0aGlzLnJldGlyZVRlc3Qob3AuaXRlbUlkKTtcblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRjYXNlIFRlc3REaWZmT3BUeXBlLkluY3JlbWVudFBlbmRpbmdFeHRIb3N0czpcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVBlbmRpbmdSb290cyhvcC5hbW91bnQpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGNhc2UgVGVzdERpZmZPcFR5cGUuQWRkVGFnOlxuXHRcdFx0XHRcdHRoaXMuX3RhZ3Muc2V0KG9wLnRhZy5pZCwgb3AudGFnKTtcblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRjYXNlIFRlc3REaWZmT3BUeXBlLlJlbW92ZVRhZzpcblx0XHRcdFx0XHR0aGlzLl90YWdzLmRlbGV0ZShvcC5pZCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y2hhbmdlcy5jb21wbGV0ZT8uKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWRkKGl0ZW06IEludGVybmFsVGVzdEl0ZW0sIGNoYW5nZXM6IEluY3JlbWVudGFsQ2hhbmdlQ29sbGVjdG9yPFQ+XG5cdCkge1xuXHRcdGNvbnN0IHBhcmVudElkID0gVGVzdElkLnBhcmVudElkKGl0ZW0uaXRlbS5leHRJZCk/LnRvU3RyaW5nKCk7XG5cdFx0bGV0IGNyZWF0ZWQ6IFQ7XG5cdFx0aWYgKCFwYXJlbnRJZCkge1xuXHRcdFx0Y3JlYXRlZCA9IHRoaXMuY3JlYXRlSXRlbShpdGVtKTtcblx0XHRcdHRoaXMucm9vdHMuYWRkKGNyZWF0ZWQpO1xuXHRcdFx0dGhpcy5pdGVtcy5zZXQoaXRlbS5pdGVtLmV4dElkLCBjcmVhdGVkKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuaXRlbXMuaGFzKHBhcmVudElkKSkge1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gdGhpcy5pdGVtcy5nZXQocGFyZW50SWQpITtcblx0XHRcdHBhcmVudC5jaGlsZHJlbi5hZGQoaXRlbS5pdGVtLmV4dElkKTtcblx0XHRcdGNyZWF0ZWQgPSB0aGlzLmNyZWF0ZUl0ZW0oaXRlbSwgcGFyZW50KTtcblx0XHRcdHRoaXMuaXRlbXMuc2V0KGl0ZW0uaXRlbS5leHRJZCwgY3JlYXRlZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoYFRlc3Qgd2l0aCB1bmtub3duIHBhcmVudCBJRDogJHtKU09OLnN0cmluZ2lmeShpdGVtKX1gKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjaGFuZ2VzLmFkZD8uKGNyZWF0ZWQpO1xuXHRcdGlmIChpdGVtLmV4cGFuZCA9PT0gVGVzdEl0ZW1FeHBhbmRTdGF0ZS5CdXN5RXhwYW5kaW5nKSB7XG5cdFx0XHR0aGlzLmJ1c3lDb250cm9sbGVyQ291bnQrKztcblx0XHR9XG5cblx0XHRyZXR1cm4gY3JlYXRlZDtcblx0fVxuXG5cdHByb3RlY3RlZCB1cGRhdGUocGF0Y2g6IElUZXN0SXRlbVVwZGF0ZSwgY2hhbmdlczogSW5jcmVtZW50YWxDaGFuZ2VDb2xsZWN0b3I8VD5cblx0KSB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLml0ZW1zLmdldChwYXRjaC5leHRJZCk7XG5cdFx0aWYgKCFleGlzdGluZykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChwYXRjaC5leHBhbmQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0aWYgKGV4aXN0aW5nLmV4cGFuZCA9PT0gVGVzdEl0ZW1FeHBhbmRTdGF0ZS5CdXN5RXhwYW5kaW5nKSB7XG5cdFx0XHRcdHRoaXMuYnVzeUNvbnRyb2xsZXJDb3VudC0tO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHBhdGNoLmV4cGFuZCA9PT0gVGVzdEl0ZW1FeHBhbmRTdGF0ZS5CdXN5RXhwYW5kaW5nKSB7XG5cdFx0XHRcdHRoaXMuYnVzeUNvbnRyb2xsZXJDb3VudCsrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGFwcGx5VGVzdEl0ZW1VcGRhdGUoZXhpc3RpbmcsIHBhdGNoKTtcblx0XHRjaGFuZ2VzLnVwZGF0ZT8uKGV4aXN0aW5nKTtcblx0XHRyZXR1cm4gZXhpc3Rpbmc7XG5cdH1cblxuXHRwcm90ZWN0ZWQgcmVtb3ZlKGl0ZW1JZDogc3RyaW5nLCBjaGFuZ2VzOiBJbmNyZW1lbnRhbENoYW5nZUNvbGxlY3RvcjxUPikge1xuXHRcdGNvbnN0IHRvUmVtb3ZlID0gdGhpcy5pdGVtcy5nZXQoaXRlbUlkKTtcblx0XHRpZiAoIXRvUmVtb3ZlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGFyZW50SWQgPSBUZXN0SWQucGFyZW50SWQodG9SZW1vdmUuaXRlbS5leHRJZCk/LnRvU3RyaW5nKCk7XG5cdFx0aWYgKHBhcmVudElkKSB7XG5cdFx0XHRjb25zdCBwYXJlbnQgPSB0aGlzLml0ZW1zLmdldChwYXJlbnRJZCkhO1xuXHRcdFx0cGFyZW50LmNoaWxkcmVuLmRlbGV0ZSh0b1JlbW92ZS5pdGVtLmV4dElkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5yb290cy5kZWxldGUodG9SZW1vdmUpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHF1ZXVlOiBJdGVyYWJsZTxzdHJpbmc+W10gPSBbW2l0ZW1JZF1dO1xuXHRcdHdoaWxlIChxdWV1ZS5sZW5ndGgpIHtcblx0XHRcdGZvciAoY29uc3QgaXRlbUlkIG9mIHF1ZXVlLnBvcCgpISkge1xuXHRcdFx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMuaXRlbXMuZ2V0KGl0ZW1JZCk7XG5cdFx0XHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0XHRcdHF1ZXVlLnB1c2goZXhpc3RpbmcuY2hpbGRyZW4pO1xuXHRcdFx0XHRcdHRoaXMuaXRlbXMuZGVsZXRlKGl0ZW1JZCk7XG5cdFx0XHRcdFx0Y2hhbmdlcy5yZW1vdmU/LihleGlzdGluZywgZXhpc3RpbmcgIT09IHRvUmVtb3ZlKTtcblxuXHRcdFx0XHRcdGlmIChleGlzdGluZy5leHBhbmQgPT09IFRlc3RJdGVtRXhwYW5kU3RhdGUuQnVzeUV4cGFuZGluZykge1xuXHRcdFx0XHRcdFx0dGhpcy5idXN5Q29udHJvbGxlckNvdW50LS07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENhbGxlZCB3aGVuIHRoZSBleHRlbnNpb24gc2lnbmFscyBhIHRlc3QgcmVzdWx0IHNob3VsZCBiZSByZXRpcmVkLlxuXHQgKi9cblx0cHJvdGVjdGVkIHJldGlyZVRlc3QodGVzdElkOiBzdHJpbmcpIHtcblx0XHQvLyBuby1vcFxuXHR9XG5cblx0LyoqXG5cdCAqIFVwZGF0ZXMgdGhlIG51bWJlciBvZiB0ZXN0IHJvb3Qgc291cmNlcyB3aG8gYXJlIHlldCB0byByZXBvcnQuIFdoZW5cblx0ICogdGhlIHRvdGFsIHBlbmRpbmcgdGVzdCByb290cyByZWFjaGVzIDAsIHRoZSByb290cyBmb3IgYWxsIGNvbnRyb2xsZXJzXG5cdCAqIHdpbGwgZXhpc3QgaW4gdGhlIGNvbGxlY3Rpb24uXG5cdCAqL1xuXHRwdWJsaWMgdXBkYXRlUGVuZGluZ1Jvb3RzKGRlbHRhOiBudW1iZXIpIHtcblx0XHR0aGlzLnBlbmRpbmdSb290Q291bnQgKz0gZGVsdGE7XG5cdH1cblxuXHQvKipcblx0ICogQ2FsbGVkIGJlZm9yZSBhIGRpZmYgaXMgYXBwbGllZCB0byBjcmVhdGUgYSBuZXcgY2hhbmdlIGNvbGxlY3Rvci5cblx0ICovXG5cdHByb3RlY3RlZCBjcmVhdGVDaGFuZ2VDb2xsZWN0b3IoKTogSW5jcmVtZW50YWxDaGFuZ2VDb2xsZWN0b3I8VD4ge1xuXHRcdHJldHVybiB7fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IGl0ZW0gZm9yIHRoZSBjb2xsZWN0aW9uIGZyb20gdGhlIGludGVybmFsIHRlc3QgaXRlbS5cblx0ICovXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBjcmVhdGVJdGVtKGludGVybmFsOiBJbnRlcm5hbFRlc3RJdGVtLCBwYXJlbnQ/OiBUKTogVDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU9BLFNBQVMsV0FBMEI7QUFDbkMsU0FBb0IsZ0JBQWdCO0FBQ3BDLFNBQWlCLGFBQWE7QUFDOUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxjQUFjO0FBRWhCLElBQVcsa0JBQVgsa0JBQVdBLHFCQUFYO0FBQ04sRUFBQUEsa0NBQUEsV0FBUSxLQUFSO0FBQ0EsRUFBQUEsa0NBQUEsWUFBUyxLQUFUO0FBQ0EsRUFBQUEsa0NBQUEsYUFBVSxLQUFWO0FBQ0EsRUFBQUEsa0NBQUEsWUFBUyxLQUFUO0FBQ0EsRUFBQUEsa0NBQUEsWUFBUyxLQUFUO0FBQ0EsRUFBQUEsa0NBQUEsYUFBVSxLQUFWO0FBQ0EsRUFBQUEsa0NBQUEsYUFBVSxLQUFWO0FBUGlCLFNBQUFBO0FBQUEs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QUssU0FBUyxRQUFRO0FBQzVCLGVBQUssTUFBTSxPQUFPQSxPQUFNO0FBQ3hCLGtCQUFRLFNBQVMsVUFBVSxhQUFhLFFBQVE7QUFFaEQsY0FBSSxTQUFTLFdBQVcsdUJBQW1DO0FBQzFELGlCQUFLO0FBQUEsVUFDTjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtVLFdBQVcsUUFBZ0I7QUFBQSxFQUVyQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU9PLG1CQUFtQixPQUFlO0FBQ3hDLFNBQUssb0JBQW9CO0FBQUEsRUFDMUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtVLHdCQUF1RDtBQUNoRSxXQUFPLENBQUM7QUFBQSxFQUNUO0FBTUQ7IiwKICAibmFtZXMiOiBbIlRlc3RSZXN1bHRTdGF0ZSIsICJFeHRUZXN0UnVuUHJvZmlsZUtpbmQiLCAiVGVzdENvbnRyb2xsZXJDYXBhYmlsaXR5IiwgIlRlc3RSdW5Qcm9maWxlQml0c2V0IiwgIklSaWNoTG9jYXRpb24iLCAiVGVzdE1lc3NhZ2VUeXBlIiwgIklUZXN0TWVzc2FnZVN0YWNrRnJhbWUiLCAiSVRlc3RFcnJvck1lc3NhZ2UiLCAiSVRlc3RPdXRwdXRNZXNzYWdlIiwgIklUZXN0TWVzc2FnZSIsICJJVGVzdFRhc2tTdGF0ZSIsICJJVGVzdEl0ZW0iLCAiVGVzdEl0ZW1FeHBhbmRTdGF0ZSIsICJJbnRlcm5hbFRlc3RJdGVtIiwgIklUZXN0SXRlbVVwZGF0ZSIsICJUZXN0UmVzdWx0SXRlbSIsICJJQ292ZXJhZ2VDb3VudCIsICJJRmlsZUNvdmVyYWdlIiwgIkRldGFpbFR5cGUiLCAiQ292ZXJhZ2VEZXRhaWxzIiwgIklCcmFuY2hDb3ZlcmFnZSIsICJJRGVjbGFyYXRpb25Db3ZlcmFnZSIsICJJU3RhdGVtZW50Q292ZXJhZ2UiLCAiVGVzdERpZmZPcFR5cGUiLCAiVGVzdHNEaWZmT3AiLCAiaXRlbUlkIl0KfQo=
