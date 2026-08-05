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
import { RunOnceScheduler } from "../../../base/common/async.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { CancellationToken, CancellationTokenSource } from "../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { createSingleCallFunction } from "../../../base/common/functional.js";
import { hash } from "../../../base/common/hash.js";
import { Disposable, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { MarshalledId } from "../../../base/common/marshallingIds.js";
import { isDefined } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { TestCommandId } from "../../contrib/testing/common/constants.js";
import { TestId, TestPosition } from "../../contrib/testing/common/testId.js";
import { InvalidTestItemError } from "../../contrib/testing/common/testItemCollection.js";
import { AbstractIncrementalTestCollection, TestControllerCapability, TestResultState, TestsDiffOp, isStartControllerTests } from "../../contrib/testing/common/testTypes.js";
import { checkProposedApiEnabled } from "../../services/extensions/common/extensions.js";
import { MainContext } from "./extHost.protocol.js";
import { IExtHostCommands } from "./extHostCommands.js";
import { IExtHostDocumentsAndEditors } from "./extHostDocumentsAndEditors.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { ExtHostTestItemCollection, TestItemImpl, TestItemRootImpl, toItemFromContext } from "./extHostTestItem.js";
import * as Convert from "./extHostTypeConverters.js";
import { FileCoverage, TestRunProfileBase, TestRunRequest } from "./extHostTypes.js";
let followupCounter = 0;
const testResultInternalIDs = /* @__PURE__ */ new WeakMap();
const IExtHostTesting = createDecorator("IExtHostTesting");
let ExtHostTesting = class extends Disposable {
  constructor(rpc, logService, commands, editors) {
    super();
    this.logService = logService;
    this.commands = commands;
    this.editors = editors;
    this.resultsChangedEmitter = this._register(new Emitter());
    this.controllers = /* @__PURE__ */ new Map();
    this.defaultProfilesChangedEmitter = this._register(new Emitter());
    this.followupProviders = /* @__PURE__ */ new Set();
    this.testFollowups = /* @__PURE__ */ new Map();
    this.onResultsChanged = this.resultsChangedEmitter.event;
    this.results = [];
    this.proxy = rpc.getProxy(MainContext.MainThreadTesting);
    this.observer = new TestObservers(this.proxy);
    this.runTracker = new TestRunCoordinator(this.proxy, logService);
    commands.registerArgumentProcessor({
      processArgument: (arg) => {
        switch (arg?.$mid) {
          case MarshalledId.TestItemContext: {
            const cast = arg;
            const targetTest = cast.tests[cast.tests.length - 1].item.extId;
            const controller = this.controllers.get(TestId.root(targetTest));
            return controller?.collection.tree.get(targetTest)?.actual ?? toItemFromContext(arg);
          }
          case MarshalledId.TestMessageMenuArgs: {
            const { test, message } = arg;
            const extId = test.item.extId;
            return {
              test: this.controllers.get(TestId.root(extId))?.collection.tree.get(extId)?.actual ?? toItemFromContext({ $mid: MarshalledId.TestItemContext, tests: [test] }),
              message: Convert.TestMessage.to(message)
            };
          }
          default:
            return arg;
        }
      }
    });
    commands.registerCommand(false, "testing.getExplorerSelection", async () => {
      const inner = await commands.executeCommand(TestCommandId.GetExplorerSelection);
      const lookup = (i) => {
        const controller = this.controllers.get(TestId.root(i));
        if (!controller) {
          return void 0;
        }
        return TestId.isRoot(i) ? controller.controller : controller.collection.tree.get(i)?.actual;
      };
      return {
        include: inner?.include.map(lookup).filter(isDefined) || [],
        exclude: inner?.exclude.map(lookup).filter(isDefined) || []
      };
    });
  }
  //#region public API
  /**
   * Implements vscode.test.registerTestProvider
   */
  createTestController(extension, controllerId, label, refreshHandler) {
    if (this.controllers.has(controllerId)) {
      throw new Error(`Attempt to insert a duplicate controller with ID "${controllerId}"`);
    }
    const disposable = new DisposableStore();
    const collection = disposable.add(new ExtHostTestItemCollection(controllerId, label, this.editors));
    collection.root.label = label;
    const profiles = /* @__PURE__ */ new Map();
    const activeProfiles = /* @__PURE__ */ new Set();
    const proxy = this.proxy;
    const getCapability = () => {
      let cap = 0;
      if (refreshHandler) {
        cap |= TestControllerCapability.Refresh;
      }
      const rcp = info.relatedCodeProvider;
      if (rcp) {
        if (rcp?.provideRelatedTests) {
          cap |= TestControllerCapability.TestRelatedToCode;
        }
        if (rcp?.provideRelatedCode) {
          cap |= TestControllerCapability.CodeRelatedToTest;
        }
      }
      return cap;
    };
    const controller = {
      items: collection.root.children,
      get label() {
        return label;
      },
      set label(value) {
        label = value;
        collection.root.label = value;
        proxy.$updateController(controllerId, { label });
      },
      get refreshHandler() {
        return refreshHandler;
      },
      set refreshHandler(value) {
        refreshHandler = value;
        proxy.$updateController(controllerId, { capabilities: getCapability() });
      },
      get id() {
        return controllerId;
      },
      get relatedCodeProvider() {
        return info.relatedCodeProvider;
      },
      set relatedCodeProvider(value) {
        checkProposedApiEnabled(extension, "testRelatedCode");
        info.relatedCodeProvider = value;
        proxy.$updateController(controllerId, { capabilities: getCapability() });
      },
      createRunProfile: (label2, group, runHandler, isDefault, tag, supportsContinuousRun) => {
        let profileId = hash(label2);
        while (profiles.has(profileId)) {
          profileId++;
        }
        return new TestRunProfileImpl(this.proxy, profiles, activeProfiles, this.defaultProfilesChangedEmitter.event, controllerId, profileId, label2, group, runHandler, isDefault, tag, supportsContinuousRun);
      },
      createTestItem(id, label2, uri) {
        return new TestItemImpl(controllerId, id, label2, uri);
      },
      createTestRun: (request, name, persist = true) => {
        return this.runTracker.createTestRun(extension, controllerId, collection, request, name, persist);
      },
      invalidateTestResults: (items) => {
        if (items === void 0) {
          this.proxy.$markTestRetired(void 0);
        } else {
          const itemsArr = items instanceof Array ? items : [items];
          this.proxy.$markTestRetired(itemsArr.map((i) => TestId.fromExtHostTestItem(i, controllerId).toString()));
        }
      },
      set resolveHandler(fn) {
        collection.resolveHandler = fn;
      },
      get resolveHandler() {
        return collection.resolveHandler;
      },
      dispose: () => {
        disposable.dispose();
      }
    };
    const info = { controller, collection, profiles, extension, activeProfiles };
    proxy.$registerTestController(controllerId, label, getCapability());
    disposable.add(toDisposable(() => proxy.$unregisterTestController(controllerId)));
    this.controllers.set(controllerId, info);
    disposable.add(toDisposable(() => this.controllers.delete(controllerId)));
    disposable.add(collection.onDidGenerateDiff((diff) => proxy.$publishDiff(controllerId, diff.map(TestsDiffOp.serialize))));
    return controller;
  }
  /**
   * Implements vscode.test.createTestObserver
   */
  createTestObserver() {
    return this.observer.checkout();
  }
  /**
   * Implements vscode.test.runTests
   */
  async runTests(req, token = CancellationToken.None) {
    const profile = tryGetProfileFromTestRunReq(req);
    if (!profile) {
      throw new Error("The request passed to `vscode.test.runTests` must include a profile");
    }
    const controller = this.controllers.get(profile.controllerId);
    if (!controller) {
      throw new Error("Controller not found");
    }
    await this.proxy.$runTests({
      preserveFocus: req.preserveFocus ?? true,
      group: Convert.TestRunProfileKind.from(profile.kind),
      targets: [{
        testIds: req.include?.map((t) => TestId.fromExtHostTestItem(t, controller.collection.root.id).toString()) ?? [controller.collection.root.id],
        profileId: profile.profileId,
        controllerId: profile.controllerId
      }],
      exclude: req.exclude?.map((t) => t.id)
    }, token);
  }
  /**
   * Implements vscode.test.registerTestFollowupProvider
   */
  registerTestFollowupProvider(provider) {
    this.followupProviders.add(provider);
    return { dispose: () => {
      this.followupProviders.delete(provider);
    } };
  }
  //#endregion
  //#region RPC methods
  /**
   * @inheritdoc
   */
  async $getTestsRelatedToCode(uri, _position, token) {
    const doc = this.editors.getDocument(URI.revive(uri));
    if (!doc) {
      return [];
    }
    const position = Convert.Position.to(_position);
    const related = [];
    await Promise.all([...this.controllers.values()].map(async (c) => {
      let tests;
      try {
        tests = await c.relatedCodeProvider?.provideRelatedTests?.(doc.document, position, token);
      } catch (e) {
        if (!token.isCancellationRequested) {
          this.logService.warn(`Error thrown while providing related tests for ${c.controller.label}`, e);
        }
      }
      if (tests) {
        for (const test of tests) {
          related.push(TestId.fromExtHostTestItem(test, c.controller.id).toString());
        }
        c.collection.flushDiff();
      }
    }));
    return related;
  }
  /**
   * @inheritdoc
   */
  async $getCodeRelatedToTest(testId, token) {
    const controller = this.controllers.get(TestId.root(testId));
    if (!controller) {
      return [];
    }
    const test = controller.collection.tree.get(testId);
    if (!test) {
      return [];
    }
    const locations = await controller.relatedCodeProvider?.provideRelatedCode?.(test.actual, token);
    return locations?.map(Convert.location.from) ?? [];
  }
  /**
   * @inheritdoc
   */
  $syncTests() {
    for (const { collection } of this.controllers.values()) {
      collection.flushDiff();
    }
    return Promise.resolve();
  }
  /**
   * @inheritdoc
   */
  async $getCoverageDetails(coverageId, testId, token) {
    const details = await this.runTracker.getCoverageDetails(coverageId, testId, token);
    return details?.map(Convert.TestCoverage.fromDetails);
  }
  /**
   * @inheritdoc
   */
  async $disposeRun(runId) {
    this.runTracker.disposeTestRun(runId);
  }
  /** @inheritdoc */
  $configureRunProfile(controllerId, profileId) {
    this.controllers.get(controllerId)?.profiles.get(profileId)?.configureHandler?.();
  }
  /** @inheritdoc */
  $setDefaultRunProfiles(profiles) {
    const evt = /* @__PURE__ */ new Map();
    for (const [controllerId, profileIds] of Object.entries(profiles)) {
      const ctrl = this.controllers.get(controllerId);
      if (!ctrl) {
        continue;
      }
      const changes = /* @__PURE__ */ new Map();
      const added = profileIds.filter((id) => !ctrl.activeProfiles.has(id));
      const removed = [...ctrl.activeProfiles].filter((id) => !profileIds.includes(id));
      for (const id of added) {
        changes.set(id, true);
        ctrl.activeProfiles.add(id);
      }
      for (const id of removed) {
        changes.set(id, false);
        ctrl.activeProfiles.delete(id);
      }
      if (changes.size) {
        evt.set(controllerId, changes);
      }
    }
    this.defaultProfilesChangedEmitter.fire(evt);
  }
  /** @inheritdoc */
  async $refreshTests(controllerId, token) {
    await this.controllers.get(controllerId)?.controller.refreshHandler?.(token);
  }
  /**
   * Updates test results shown to extensions.
   * @override
   */
  $publishTestResults(results) {
    this.results = Object.freeze(
      results.map((r) => {
        const o = Convert.TestResults.to(r);
        const taskWithCoverage = r.tasks.findIndex((t) => t.hasCoverage);
        if (taskWithCoverage !== -1) {
          o.getDetailedCoverage = (uri, token = CancellationToken.None) => this.proxy.$getCoverageDetails(r.id, taskWithCoverage, uri, token).then((r2) => r2.map(Convert.TestCoverage.to));
        }
        testResultInternalIDs.set(o, r.id);
        return o;
      }).concat(this.results).sort((a, b) => b.completedAt - a.completedAt).slice(0, 32)
    );
    this.resultsChangedEmitter.fire();
  }
  /**
   * Expands the nodes in the test tree. If levels is less than zero, it will
   * be treated as infinite.
   */
  async $expandTest(testId, levels) {
    const collection = this.controllers.get(TestId.fromString(testId).controllerId)?.collection;
    if (collection) {
      await collection.expand(testId, levels < 0 ? Infinity : levels);
      collection.flushDiff();
    }
  }
  /**
   * Receives a test update from the main thread. Called (eventually) whenever
   * tests change.
   */
  $acceptDiff(diff) {
    this.observer.applyDiff(diff.map((d) => TestsDiffOp.deserialize({ asCanonicalUri: (u) => u }, d)));
  }
  /**
   * Runs tests with the given set of IDs. Allows for test from multiple
   * providers to be run.
   * @inheritdoc
   */
  async $runControllerTests(reqs, token) {
    return Promise.all(reqs.map((req) => this.runControllerTestRequest(req, false, token)));
  }
  /**
   * Starts continuous test runs with the given set of IDs. Allows for test from
   * multiple providers to be run.
   * @inheritdoc
   */
  async $startContinuousRun(reqs, token) {
    const cts = new CancellationTokenSource(token);
    const res = await Promise.all(reqs.map((req) => this.runControllerTestRequest(req, true, cts.token)));
    if (!token.isCancellationRequested && !res.some((r) => r.error)) {
      await new Promise((r) => token.onCancellationRequested(r));
    }
    cts.dispose(true);
    return res;
  }
  /** @inheritdoc */
  async $provideTestFollowups(req, token) {
    const results = this.results.find((r) => testResultInternalIDs.get(r) === req.resultId);
    const test = results && findTestInResultSnapshot(TestId.fromString(req.extId), results?.results);
    if (!test) {
      return [];
    }
    let followups = [];
    await Promise.all([...this.followupProviders].map(async (provider) => {
      try {
        const r = await provider.provideFollowup(results, test, req.taskIndex, req.messageIndex, token);
        if (r) {
          followups = followups.concat(r);
        }
      } catch (e) {
        this.logService.error(`Error thrown while providing followup for test message`, e);
      }
    }));
    if (token.isCancellationRequested) {
      return [];
    }
    return followups.map((command) => {
      const id = followupCounter++;
      this.testFollowups.set(id, command);
      return { title: command.title, id };
    });
  }
  $disposeTestFollowups(id) {
    for (const i of id) {
      this.testFollowups.delete(i);
    }
  }
  $executeTestFollowup(id) {
    const command = this.testFollowups.get(id);
    if (!command) {
      return Promise.resolve();
    }
    return this.commands.executeCommand(command.command, ...command.arguments || []);
  }
  /**
   * Cancels an ongoing test run.
   */
  $cancelExtensionTestRun(runId, taskId) {
    if (runId === void 0) {
      this.runTracker.cancelAllRuns();
    } else {
      this.runTracker.cancelRunById(runId, taskId);
    }
  }
  //#endregion
  getMetadataForRun(run) {
    for (const tracker of this.runTracker.trackers) {
      const taskId = tracker.getTaskIdForRun(run);
      if (taskId) {
        return { taskId, runId: tracker.id };
      }
    }
    return void 0;
  }
  async runControllerTestRequest(req, isContinuous, token) {
    const lookup = this.controllers.get(req.controllerId);
    if (!lookup) {
      return {};
    }
    const { collection, profiles, extension } = lookup;
    const profile = profiles.get(req.profileId);
    if (!profile) {
      return {};
    }
    const includeTests = req.testIds.map((testId) => collection.tree.get(testId)).filter(isDefined);
    const excludeTests = req.excludeExtIds.map((id) => lookup.collection.tree.get(id)).filter(isDefined).filter((exclude) => includeTests.some(
      (include) => include.fullId.compare(exclude.fullId) === TestPosition.IsChild
    ));
    if (!includeTests.length) {
      return {};
    }
    const publicReq = new TestRunRequest(
      includeTests.some((i) => i.actual instanceof TestItemRootImpl) ? void 0 : includeTests.map((t) => t.actual),
      excludeTests.map((t) => t.actual),
      profile,
      isContinuous
    );
    const tracker = isStartControllerTests(req) && this.runTracker.prepareForMainThreadTestRun(
      extension,
      publicReq,
      TestRunDto.fromInternal(req, lookup.collection),
      profile,
      token
    );
    try {
      await profile.runHandler(publicReq, token);
      return {};
    } catch (e) {
      return { error: String(e) };
    } finally {
      if (tracker) {
        if (tracker.hasRunningTasks && !token.isCancellationRequested) {
          await Event.toPromise(tracker.onEnd);
        }
      }
    }
  }
};
ExtHostTesting = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IExtHostCommands),
  __decorateParam(3, IExtHostDocumentsAndEditors)
], ExtHostTesting);
const RUN_CANCEL_DEADLINE = 1e4;
var TestRunTrackerState = /* @__PURE__ */ ((TestRunTrackerState2) => {
  TestRunTrackerState2[TestRunTrackerState2["Running"] = 0] = "Running";
  TestRunTrackerState2[TestRunTrackerState2["Cancelling"] = 1] = "Cancelling";
  TestRunTrackerState2[TestRunTrackerState2["Ended"] = 2] = "Ended";
  return TestRunTrackerState2;
})(TestRunTrackerState || {});
class TestRunTracker extends Disposable {
  constructor(dto, proxy, logService, profile, extension, parentToken) {
    super();
    this.dto = dto;
    this.proxy = proxy;
    this.logService = logService;
    this.profile = profile;
    this.extension = extension;
    this.state = 0 /* Running */;
    this.running = 0;
    this.tasks = /* @__PURE__ */ new Map();
    this.sharedTestIds = /* @__PURE__ */ new Set();
    this.endEmitter = this._register(new Emitter());
    this.publishedCoverage = /* @__PURE__ */ new Map();
    /**
     * Fires when a test ends, and no more tests are left running.
     */
    this.onEnd = this.endEmitter.event;
    this.cts = this._register(new CancellationTokenSource(parentToken));
    const forciblyEnd = this._register(new RunOnceScheduler(() => this.forciblyEndTasks(), RUN_CANCEL_DEADLINE));
    this._register(this.cts.token.onCancellationRequested(() => forciblyEnd.schedule()));
    const didDisposeEmitter = new Emitter();
    this.onDidDispose = didDisposeEmitter.event;
    this._register(toDisposable(() => {
      didDisposeEmitter.fire();
      didDisposeEmitter.dispose();
    }));
  }
  /**
   * Gets whether there are any tests running.
   */
  get hasRunningTasks() {
    return this.running > 0;
  }
  /**
   * Gets the run ID.
   */
  get id() {
    return this.dto.id;
  }
  /** Gets the task ID from a test run object. */
  getTaskIdForRun(run) {
    for (const [taskId, { run: r }] of this.tasks) {
      if (r === run) {
        return taskId;
      }
    }
    return void 0;
  }
  /** Requests cancellation of the run. On the second call, forces cancellation. */
  cancel(taskId) {
    if (taskId) {
      this.tasks.get(taskId)?.cts.cancel();
    } else if (this.state === 0 /* Running */) {
      this.cts.cancel();
      this.state = 1 /* Cancelling */;
    } else if (this.state === 1 /* Cancelling */) {
      this.forciblyEndTasks();
    }
  }
  /** Gets details for a previously-emitted coverage object. */
  async getCoverageDetails(id, testId, token) {
    const [, taskId] = TestId.fromString(id).path;
    const coverage = this.publishedCoverage.get(id);
    if (!coverage) {
      return [];
    }
    const { report, extIds } = coverage;
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error("unreachable: run task was not found");
    }
    let testItem;
    if (testId && report instanceof FileCoverage) {
      const index = extIds.indexOf(testId);
      if (index === -1) {
        return [];
      }
      testItem = report.includesTests[index];
    }
    const details = testItem ? this.profile?.loadDetailedCoverageForTest?.(task.run, report, testItem, token) : this.profile?.loadDetailedCoverage?.(task.run, report, token);
    return await details ?? [];
  }
  /** Creates the public test run interface to give to extensions. */
  createRun(name) {
    const runId = this.dto.id;
    const ctrlId = this.dto.controllerId;
    const taskId = generateUuid();
    const guardTestMutation = (fn) => (test, ...args) => {
      if (ended) {
        this.logService.warn(`Setting the state of test "${test.id}" is a no-op after the run ends.`);
        return;
      }
      this.ensureTestIsKnown(test);
      fn(test, ...args);
    };
    const appendMessages = (test, messages) => {
      const converted = messages instanceof Array ? messages.map(Convert.TestMessage.from) : [Convert.TestMessage.from(messages)];
      if (test.uri && test.range) {
        const defaultLocation = { range: Convert.Range.from(test.range), uri: test.uri };
        for (const message of converted) {
          message.location = message.location || defaultLocation;
        }
      }
      this.proxy.$appendTestMessagesInRun(runId, taskId, TestId.fromExtHostTestItem(test, ctrlId).toString(), converted);
    };
    let ended = false;
    const cts = this._register(new CancellationTokenSource(this.cts.token));
    const run = {
      isPersisted: this.dto.isPersisted,
      token: cts.token,
      name,
      onDidDispose: this.onDidDispose,
      addCoverage: (coverage) => {
        if (ended) {
          return;
        }
        const includesTests = coverage instanceof FileCoverage ? coverage.includesTests : [];
        if (includesTests.length) {
          for (const test of includesTests) {
            this.ensureTestIsKnown(test);
          }
        }
        const uriStr = coverage.uri.toString();
        const id = new TestId([runId, taskId, uriStr]).toString();
        this.publishedCoverage.set(id, { report: coverage, extIds: includesTests.map((t) => TestId.fromExtHostTestItem(t, ctrlId).toString()) });
        this.proxy.$appendCoverage(runId, taskId, Convert.TestCoverage.fromFile(ctrlId, id, coverage));
      },
      //#region state mutation
      enqueued: guardTestMutation((test) => {
        this.proxy.$updateTestStateInRun(runId, taskId, TestId.fromExtHostTestItem(test, ctrlId).toString(), TestResultState.Queued);
      }),
      skipped: guardTestMutation((test) => {
        this.proxy.$updateTestStateInRun(runId, taskId, TestId.fromExtHostTestItem(test, ctrlId).toString(), TestResultState.Skipped);
      }),
      started: guardTestMutation((test) => {
        this.proxy.$updateTestStateInRun(runId, taskId, TestId.fromExtHostTestItem(test, ctrlId).toString(), TestResultState.Running);
      }),
      errored: guardTestMutation((test, messages, duration) => {
        appendMessages(test, messages);
        this.proxy.$updateTestStateInRun(runId, taskId, TestId.fromExtHostTestItem(test, ctrlId).toString(), TestResultState.Errored, duration);
      }),
      failed: guardTestMutation((test, messages, duration) => {
        appendMessages(test, messages);
        this.proxy.$updateTestStateInRun(runId, taskId, TestId.fromExtHostTestItem(test, ctrlId).toString(), TestResultState.Failed, duration);
      }),
      passed: guardTestMutation((test, duration) => {
        this.proxy.$updateTestStateInRun(runId, taskId, TestId.fromExtHostTestItem(test, this.dto.controllerId).toString(), TestResultState.Passed, duration);
      }),
      //#endregion
      appendOutput: (output, location, test) => {
        if (ended) {
          return;
        }
        if (test) {
          this.ensureTestIsKnown(test);
        }
        this.proxy.$appendOutputToRun(
          runId,
          taskId,
          VSBuffer.fromString(output),
          location && Convert.location.from(location),
          test && TestId.fromExtHostTestItem(test, ctrlId).toString()
        );
      },
      end: () => {
        if (ended) {
          return;
        }
        ended = true;
        this.proxy.$finishedTestRunTask(runId, taskId);
        if (!--this.running) {
          this.markEnded();
        }
      }
    };
    this.running++;
    this.tasks.set(taskId, { run, cts });
    this.proxy.$startedTestRunTask(runId, {
      id: taskId,
      ctrlId: this.dto.controllerId,
      name: name || this.extension.displayName || this.extension.identifier.value,
      running: true
    });
    return run;
  }
  forciblyEndTasks() {
    for (const { run } of this.tasks.values()) {
      run.end();
    }
  }
  markEnded() {
    if (this.state !== 2 /* Ended */) {
      this.state = 2 /* Ended */;
      this.endEmitter.fire();
    }
  }
  ensureTestIsKnown(test) {
    if (!(test instanceof TestItemImpl)) {
      throw new InvalidTestItemError(test.id);
    }
    if (this.sharedTestIds.has(TestId.fromExtHostTestItem(test, this.dto.controllerId).toString())) {
      return;
    }
    const chain = [];
    const root = this.dto.colllection.root;
    while (true) {
      const converted = Convert.TestItem.from(test);
      chain.unshift(converted);
      if (this.sharedTestIds.has(converted.extId)) {
        break;
      }
      this.sharedTestIds.add(converted.extId);
      if (test === root) {
        break;
      }
      test = test.parent || root;
    }
    this.proxy.$addTestsToRun(this.dto.controllerId, this.dto.id, chain);
  }
  dispose() {
    this.markEnded();
    super.dispose();
  }
}
class TestRunCoordinator {
  constructor(proxy, logService) {
    this.proxy = proxy;
    this.logService = logService;
    this.tracked = /* @__PURE__ */ new Map();
    this.trackedById = /* @__PURE__ */ new Map();
  }
  get trackers() {
    return this.tracked.values();
  }
  /**
   * Gets a coverage report for a given run and task ID.
   */
  getCoverageDetails(id, testId, token) {
    const runId = TestId.root(id);
    return this.trackedById.get(runId)?.getCoverageDetails(id, testId, token) || [];
  }
  /**
   * Disposes the test run, called when the main thread is no longer interested
   * in associated data.
   */
  disposeTestRun(runId) {
    this.trackedById.get(runId)?.dispose();
    this.trackedById.delete(runId);
    for (const [req, { id }] of this.tracked) {
      if (id === runId) {
        this.tracked.delete(req);
      }
    }
  }
  /**
   * Registers a request as being invoked by the main thread, so
   * `$startedExtensionTestRun` is not invoked. The run must eventually
   * be cancelled manually.
   */
  prepareForMainThreadTestRun(extension, req, dto, profile, token) {
    return this.getTracker(req, dto, profile, extension, token);
  }
  /**
   * Cancels an existing test run via its cancellation token.
   */
  cancelRunById(runId, taskId) {
    this.trackedById.get(runId)?.cancel(taskId);
  }
  /**
   * Cancels an existing test run via its cancellation token.
   */
  cancelAllRuns() {
    for (const tracker of this.tracked.values()) {
      tracker.cancel();
    }
  }
  /**
   * Implements the public `createTestRun` API.
   */
  createTestRun(extension, controllerId, collection, request, name, persist) {
    const existing = this.tracked.get(request);
    if (existing) {
      return existing.createRun(name);
    }
    const dto = TestRunDto.fromPublic(controllerId, collection, request, persist);
    const profile = tryGetProfileFromTestRunReq(request);
    this.proxy.$startedExtensionTestRun({
      controllerId,
      continuous: !!request.continuous,
      profile: profile && { group: Convert.TestRunProfileKind.from(profile.kind), id: profile.profileId },
      exclude: request.exclude?.map((t) => TestId.fromExtHostTestItem(t, collection.root.id).toString()) ?? [],
      id: dto.id,
      include: request.include?.map((t) => TestId.fromExtHostTestItem(t, collection.root.id).toString()) ?? [collection.root.id],
      preserveFocus: request.preserveFocus ?? true,
      persist
    });
    const tracker = this.getTracker(request, dto, request.profile, extension);
    Event.once(tracker.onEnd)(() => {
      this.proxy.$finishedExtensionTestRun(dto.id);
    });
    return tracker.createRun(name);
  }
  getTracker(req, dto, profile, extension, token) {
    const tracker = new TestRunTracker(dto, this.proxy, this.logService, profile, extension, token);
    this.tracked.set(req, tracker);
    this.trackedById.set(tracker.id, tracker);
    return tracker;
  }
}
const tryGetProfileFromTestRunReq = (request) => {
  if (!request.profile) {
    return void 0;
  }
  if (!(request.profile instanceof TestRunProfileImpl)) {
    throw new Error(`TestRunRequest.profile is not an instance created from TestController.createRunProfile`);
  }
  return request.profile;
};
class TestRunDto {
  constructor(controllerId, id, isPersisted, colllection) {
    this.controllerId = controllerId;
    this.id = id;
    this.isPersisted = isPersisted;
    this.colllection = colllection;
  }
  static fromPublic(controllerId, collection, request, persist) {
    return new TestRunDto(
      controllerId,
      generateUuid(),
      persist,
      collection
    );
  }
  static fromInternal(request, collection) {
    return new TestRunDto(
      request.controllerId,
      request.runId,
      true,
      collection
    );
  }
}
class MirroredChangeCollector {
  constructor(emitter) {
    this.emitter = emitter;
    this.added = /* @__PURE__ */ new Set();
    this.updated = /* @__PURE__ */ new Set();
    this.removed = /* @__PURE__ */ new Set();
    this.alreadyRemoved = /* @__PURE__ */ new Set();
  }
  get isEmpty() {
    return this.added.size === 0 && this.removed.size === 0 && this.updated.size === 0;
  }
  /**
   * @inheritdoc
   */
  add(node) {
    this.added.add(node);
  }
  /**
   * @inheritdoc
   */
  update(node) {
    Object.assign(node.revived, Convert.TestItem.toPlain(node.item));
    if (!this.added.has(node)) {
      this.updated.add(node);
    }
  }
  /**
   * @inheritdoc
   */
  remove(node) {
    if (this.added.has(node)) {
      this.added.delete(node);
      return;
    }
    this.updated.delete(node);
    const parentId = TestId.parentId(node.item.extId);
    if (parentId && this.alreadyRemoved.has(parentId.toString())) {
      this.alreadyRemoved.add(node.item.extId);
      return;
    }
    this.removed.add(node);
  }
  /**
   * @inheritdoc
   */
  getChangeEvent() {
    const { added, updated, removed } = this;
    return {
      get added() {
        return [...added].map((n) => n.revived);
      },
      get updated() {
        return [...updated].map((n) => n.revived);
      },
      get removed() {
        return [...removed].map((n) => n.revived);
      }
    };
  }
  complete() {
    if (!this.isEmpty) {
      this.emitter.fire(this.getChangeEvent());
    }
  }
}
class MirroredTestCollection extends AbstractIncrementalTestCollection {
  constructor() {
    super(...arguments);
    this.changeEmitter = new Emitter();
    /**
     * Change emitter that fires with the same semantics as `TestObserver.onDidChangeTests`.
     */
    this.onDidChangeTests = this.changeEmitter.event;
  }
  /**
   * Gets a list of root test items.
   */
  get rootTests() {
    return this.roots;
  }
  /**
   *
   * If the test ID exists, returns its underlying ID.
   */
  getMirroredTestDataById(itemId) {
    return this.items.get(itemId);
  }
  /**
   * If the test item is a mirrored test item, returns its underlying ID.
   */
  getMirroredTestDataByReference(item) {
    return this.items.get(item.id);
  }
  /**
   * @override
   */
  createItem(item, parent) {
    return {
      ...item,
      // todo@connor4312: make this work well again with children
      revived: Convert.TestItem.toPlain(item.item),
      depth: parent ? parent.depth + 1 : 0,
      children: /* @__PURE__ */ new Set()
    };
  }
  /**
   * @override
   */
  createChangeCollector() {
    return new MirroredChangeCollector(this.changeEmitter);
  }
}
class TestObservers {
  constructor(proxy) {
    this.proxy = proxy;
  }
  checkout() {
    if (!this.current) {
      this.current = this.createObserverData();
    }
    const current = this.current;
    current.observers++;
    return {
      onDidChangeTest: current.tests.onDidChangeTests,
      get tests() {
        return [...current.tests.rootTests].map((t) => t.revived);
      },
      dispose: createSingleCallFunction(() => {
        if (--current.observers === 0) {
          this.proxy.$unsubscribeFromDiffs();
          this.current = void 0;
        }
      })
    };
  }
  /**
   * Gets the internal test data by its reference.
   */
  getMirroredTestDataByReference(ref) {
    return this.current?.tests.getMirroredTestDataByReference(ref);
  }
  /**
   * Applies test diffs to the current set of observed tests.
   */
  applyDiff(diff) {
    this.current?.tests.apply(diff);
  }
  createObserverData() {
    const tests = new MirroredTestCollection({ asCanonicalUri: (u) => u });
    this.proxy.$subscribeToDiffs();
    return { observers: 0, tests };
  }
}
const updateProfile = (impl, proxy, initial, update) => {
  if (initial) {
    Object.assign(initial, update);
  } else {
    proxy.$updateTestRunConfig(impl.controllerId, impl.profileId, update);
  }
};
class TestRunProfileImpl extends TestRunProfileBase {
  constructor(proxy, profiles, activeProfiles, onDidChangeActiveProfiles, controllerId, profileId, _label, kind, runHandler, _isDefault = false, _tag = void 0, _supportsContinuousRun = false) {
    super(controllerId, profileId, kind);
    this._label = _label;
    this.runHandler = runHandler;
    this._tag = _tag;
    this._supportsContinuousRun = _supportsContinuousRun;
    this.#proxy = proxy;
    this.#profiles = profiles;
    this.#activeProfiles = activeProfiles;
    this.#onDidChangeDefaultProfiles = onDidChangeActiveProfiles;
    profiles.set(profileId, this);
    const groupBitset = Convert.TestRunProfileKind.from(kind);
    if (_isDefault) {
      activeProfiles.add(profileId);
    }
    this.#initialPublish = {
      profileId,
      controllerId,
      tag: _tag ? Convert.TestTag.namespace(this.controllerId, _tag.id) : null,
      label: _label,
      group: groupBitset,
      isDefault: _isDefault,
      hasConfigurationHandler: false,
      supportsContinuousRun: _supportsContinuousRun
    };
    queueMicrotask(() => {
      if (this.#initialPublish) {
        this.#proxy.$publishTestRunProfile(this.#initialPublish);
        this.#initialPublish = void 0;
      }
    });
  }
  #proxy;
  #activeProfiles;
  #onDidChangeDefaultProfiles;
  #initialPublish;
  #profiles;
  get label() {
    return this._label;
  }
  set label(label) {
    if (label !== this._label) {
      this._label = label;
      updateProfile(this, this.#proxy, this.#initialPublish, { label });
    }
  }
  get supportsContinuousRun() {
    return this._supportsContinuousRun;
  }
  set supportsContinuousRun(supports) {
    if (supports !== this._supportsContinuousRun) {
      this._supportsContinuousRun = supports;
      updateProfile(this, this.#proxy, this.#initialPublish, { supportsContinuousRun: supports });
    }
  }
  get isDefault() {
    return this.#activeProfiles.has(this.profileId);
  }
  set isDefault(isDefault) {
    if (isDefault !== this.isDefault) {
      if (isDefault) {
        this.#activeProfiles.add(this.profileId);
      } else {
        this.#activeProfiles.delete(this.profileId);
      }
      updateProfile(this, this.#proxy, this.#initialPublish, { isDefault });
    }
  }
  get tag() {
    return this._tag;
  }
  set tag(tag) {
    if (tag?.id !== this._tag?.id) {
      this._tag = tag;
      updateProfile(this, this.#proxy, this.#initialPublish, {
        tag: tag ? Convert.TestTag.namespace(this.controllerId, tag.id) : null
      });
    }
  }
  get configureHandler() {
    return this._configureHandler;
  }
  set configureHandler(handler) {
    if (handler !== this._configureHandler) {
      this._configureHandler = handler;
      updateProfile(this, this.#proxy, this.#initialPublish, { hasConfigurationHandler: !!handler });
    }
  }
  get onDidChangeDefault() {
    return Event.chain(
      this.#onDidChangeDefaultProfiles,
      ($) => $.map((ev) => ev.get(this.controllerId)?.get(this.profileId)).filter(isDefined)
    );
  }
  dispose() {
    if (this.#profiles?.delete(this.profileId)) {
      this.#profiles = void 0;
      this.#proxy.$removeTestProfile(this.controllerId, this.profileId);
    }
    this.#initialPublish = void 0;
  }
}
function findTestInResultSnapshot(extId, snapshot) {
  for (let i = 0; i < extId.path.length; i++) {
    const item = snapshot.find((s) => s.id === extId.path[i]);
    if (!item) {
      return void 0;
    }
    if (i === extId.path.length - 1) {
      return item;
    }
    snapshot = item.children;
  }
  return void 0;
}
export {
  ExtHostTesting,
  IExtHostTesting,
  TestRunCoordinator,
  TestRunDto,
  TestRunProfileImpl
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VGVzdGluZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbi8qIGVzbGludC1kaXNhYmxlIGxvY2FsL2NvZGUtbm8tbmF0aXZlLXByaXZhdGUgKi9cblxuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTaW5nbGVDYWxsRnVuY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9mdW5jdGlvbmFsLmpzJztcbmltcG9ydCB7IGhhc2ggfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9oYXNoLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1hcnNoYWxsZWRJZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nSWRzLmpzJztcbmltcG9ydCB7IGlzRGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IElQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBUZXN0Q29tbWFuZElkIH0gZnJvbSAnLi4vLi4vY29udHJpYi90ZXN0aW5nL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVGVzdElkLCBUZXN0UG9zaXRpb24gfSBmcm9tICcuLi8uLi9jb250cmliL3Rlc3RpbmcvY29tbW9uL3Rlc3RJZC5qcyc7XG5pbXBvcnQgeyBJbnZhbGlkVGVzdEl0ZW1FcnJvciB9IGZyb20gJy4uLy4uL2NvbnRyaWIvdGVzdGluZy9jb21tb24vdGVzdEl0ZW1Db2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IEFic3RyYWN0SW5jcmVtZW50YWxUZXN0Q29sbGVjdGlvbiwgQ292ZXJhZ2VEZXRhaWxzLCBJQ2FsbFByb2ZpbGVSdW5IYW5kbGVyLCBJU2VyaWFsaXplZFRlc3RSZXN1bHRzLCBJU3RhcnRDb250cm9sbGVyVGVzdHMsIElTdGFydENvbnRyb2xsZXJUZXN0c1Jlc3VsdCwgSVRlc3RFcnJvck1lc3NhZ2UsIElUZXN0SXRlbSwgSVRlc3RJdGVtQ29udGV4dCwgSVRlc3RNZXNzYWdlTWVudUFyZ3MsIElUZXN0UnVuUHJvZmlsZSwgSW5jcmVtZW50YWxDaGFuZ2VDb2xsZWN0b3IsIEluY3JlbWVudGFsVGVzdENvbGxlY3Rpb25JdGVtLCBJbnRlcm5hbFRlc3RJdGVtLCBUZXN0Q29udHJvbGxlckNhcGFiaWxpdHksIFRlc3RNZXNzYWdlRm9sbG93dXBSZXF1ZXN0LCBUZXN0TWVzc2FnZUZvbGxvd3VwUmVzcG9uc2UsIFRlc3RSZXN1bHRTdGF0ZSwgVGVzdHNEaWZmLCBUZXN0c0RpZmZPcCwgaXNTdGFydENvbnRyb2xsZXJUZXN0cyB9IGZyb20gJy4uLy4uL2NvbnRyaWIvdGVzdGluZy9jb21tb24vdGVzdFR5cGVzLmpzJztcbmltcG9ydCB7IGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0VGVzdGluZ1NoYXBlLCBJTG9jYXRpb25EdG8sIE1haW5Db250ZXh0LCBNYWluVGhyZWFkVGVzdGluZ1NoYXBlIH0gZnJvbSAnLi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IElFeHRIb3N0Q29tbWFuZHMgfSBmcm9tICcuL2V4dEhvc3RDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMgfSBmcm9tICcuL2V4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzLmpzJztcbmltcG9ydCB7IElFeHRIb3N0UnBjU2VydmljZSB9IGZyb20gJy4vZXh0SG9zdFJwY1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgRXh0SG9zdFRlc3RJdGVtQ29sbGVjdGlvbiwgVGVzdEl0ZW1JbXBsLCBUZXN0SXRlbVJvb3RJbXBsLCB0b0l0ZW1Gcm9tQ29udGV4dCB9IGZyb20gJy4vZXh0SG9zdFRlc3RJdGVtLmpzJztcbmltcG9ydCAqIGFzIENvbnZlcnQgZnJvbSAnLi9leHRIb3N0VHlwZUNvbnZlcnRlcnMuanMnO1xuaW1wb3J0IHsgRmlsZUNvdmVyYWdlLCBUZXN0UnVuUHJvZmlsZUJhc2UsIFRlc3RSdW5SZXF1ZXN0IH0gZnJvbSAnLi9leHRIb3N0VHlwZXMuanMnO1xuXG5pbnRlcmZhY2UgQ29udHJvbGxlckluZm8ge1xuXHRjb250cm9sbGVyOiB2c2NvZGUuVGVzdENvbnRyb2xsZXI7XG5cdHByb2ZpbGVzOiBNYXA8bnVtYmVyLCB2c2NvZGUuVGVzdFJ1blByb2ZpbGU+O1xuXHRjb2xsZWN0aW9uOiBFeHRIb3N0VGVzdEl0ZW1Db2xsZWN0aW9uO1xuXHRleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbjtcblx0cmVsYXRlZENvZGVQcm92aWRlcj86IHZzY29kZS5UZXN0UmVsYXRlZENvZGVQcm92aWRlcjtcblx0YWN0aXZlUHJvZmlsZXM6IFNldDxudW1iZXI+O1xufVxuXG50eXBlIERlZmF1bHRQcm9maWxlQ2hhbmdlRXZlbnQgPSBNYXA8LyogY29udHJvbGxlcklkICovIHN0cmluZywgTWFwPCAvKiBwcm9maWxlSWQgKi9udW1iZXIsIGJvb2xlYW4+PjtcblxubGV0IGZvbGxvd3VwQ291bnRlciA9IDA7XG5cbmNvbnN0IHRlc3RSZXN1bHRJbnRlcm5hbElEcyA9IG5ldyBXZWFrTWFwPHZzY29kZS5UZXN0UnVuUmVzdWx0LCBzdHJpbmc+KCk7XG5cbmV4cG9ydCBjb25zdCBJRXh0SG9zdFRlc3RpbmcgPSBjcmVhdGVEZWNvcmF0b3I8SUV4dEhvc3RUZXN0aW5nPignSUV4dEhvc3RUZXN0aW5nJyk7XG5leHBvcnQgaW50ZXJmYWNlIElFeHRIb3N0VGVzdGluZyBleHRlbmRzIEV4dEhvc3RUZXN0aW5nIHtcblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgY2xhc3MgRXh0SG9zdFRlc3RpbmcgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgRXh0SG9zdFRlc3RpbmdTaGFwZSB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcmVzdWx0c0NoYW5nZWRFbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHByb3RlY3RlZCByZWFkb25seSBjb250cm9sbGVycyA9IG5ldyBNYXA8LyogY29udHJvbGxlciBJRCAqLyBzdHJpbmcsIENvbnRyb2xsZXJJbmZvPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHByb3h5OiBNYWluVGhyZWFkVGVzdGluZ1NoYXBlO1xuXHRwcml2YXRlIHJlYWRvbmx5IHJ1blRyYWNrZXI6IFRlc3RSdW5Db29yZGluYXRvcjtcblx0cHJpdmF0ZSByZWFkb25seSBvYnNlcnZlcjogVGVzdE9ic2VydmVycztcblx0cHJpdmF0ZSByZWFkb25seSBkZWZhdWx0UHJvZmlsZXNDaGFuZ2VkRW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPERlZmF1bHRQcm9maWxlQ2hhbmdlRXZlbnQ+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGZvbGxvd3VwUHJvdmlkZXJzID0gbmV3IFNldDx2c2NvZGUuVGVzdEZvbGxvd3VwUHJvdmlkZXI+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgdGVzdEZvbGxvd3VwcyA9IG5ldyBNYXA8bnVtYmVyLCB2c2NvZGUuQ29tbWFuZD4oKTtcblxuXHRwdWJsaWMgb25SZXN1bHRzQ2hhbmdlZCA9IHRoaXMucmVzdWx0c0NoYW5nZWRFbWl0dGVyLmV2ZW50O1xuXHRwdWJsaWMgcmVzdWx0czogUmVhZG9ubHlBcnJheTx2c2NvZGUuVGVzdFJ1blJlc3VsdD4gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dEhvc3RScGNTZXJ2aWNlIHJwYzogSUV4dEhvc3RScGNTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRXh0SG9zdENvbW1hbmRzIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZHM6IElFeHRIb3N0Q29tbWFuZHMsXG5cdFx0QElFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyBwcml2YXRlIHJlYWRvbmx5IGVkaXRvcnM6IElFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnByb3h5ID0gcnBjLmdldFByb3h5KE1haW5Db250ZXh0Lk1haW5UaHJlYWRUZXN0aW5nKTtcblx0XHR0aGlzLm9ic2VydmVyID0gbmV3IFRlc3RPYnNlcnZlcnModGhpcy5wcm94eSk7XG5cdFx0dGhpcy5ydW5UcmFja2VyID0gbmV3IFRlc3RSdW5Db29yZGluYXRvcih0aGlzLnByb3h5LCBsb2dTZXJ2aWNlKTtcblxuXHRcdGNvbW1hbmRzLnJlZ2lzdGVyQXJndW1lbnRQcm9jZXNzb3Ioe1xuXHRcdFx0cHJvY2Vzc0FyZ3VtZW50OiBhcmcgPT4ge1xuXHRcdFx0XHRzd2l0Y2ggKGFyZz8uJG1pZCkge1xuXHRcdFx0XHRcdGNhc2UgTWFyc2hhbGxlZElkLlRlc3RJdGVtQ29udGV4dDoge1xuXHRcdFx0XHRcdFx0Y29uc3QgY2FzdCA9IGFyZyBhcyBJVGVzdEl0ZW1Db250ZXh0O1xuXHRcdFx0XHRcdFx0Y29uc3QgdGFyZ2V0VGVzdCA9IGNhc3QudGVzdHNbY2FzdC50ZXN0cy5sZW5ndGggLSAxXS5pdGVtLmV4dElkO1xuXHRcdFx0XHRcdFx0Y29uc3QgY29udHJvbGxlciA9IHRoaXMuY29udHJvbGxlcnMuZ2V0KFRlc3RJZC5yb290KHRhcmdldFRlc3QpKTtcblx0XHRcdFx0XHRcdHJldHVybiBjb250cm9sbGVyPy5jb2xsZWN0aW9uLnRyZWUuZ2V0KHRhcmdldFRlc3QpPy5hY3R1YWwgPz8gdG9JdGVtRnJvbUNvbnRleHQoYXJnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2FzZSBNYXJzaGFsbGVkSWQuVGVzdE1lc3NhZ2VNZW51QXJnczoge1xuXHRcdFx0XHRcdFx0Y29uc3QgeyB0ZXN0LCBtZXNzYWdlIH0gPSBhcmcgYXMgSVRlc3RNZXNzYWdlTWVudUFyZ3M7XG5cdFx0XHRcdFx0XHRjb25zdCBleHRJZCA9IHRlc3QuaXRlbS5leHRJZDtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdHRlc3Q6IHRoaXMuY29udHJvbGxlcnMuZ2V0KFRlc3RJZC5yb290KGV4dElkKSk/LmNvbGxlY3Rpb24udHJlZS5nZXQoZXh0SWQpPy5hY3R1YWxcblx0XHRcdFx0XHRcdFx0XHQ/PyB0b0l0ZW1Gcm9tQ29udGV4dCh7ICRtaWQ6IE1hcnNoYWxsZWRJZC5UZXN0SXRlbUNvbnRleHQsIHRlc3RzOiBbdGVzdF0gfSksXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IENvbnZlcnQuVGVzdE1lc3NhZ2UudG8obWVzc2FnZSBhcyBJVGVzdEVycm9yTWVzc2FnZS5TZXJpYWxpemVkKSxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGRlZmF1bHQ6IHJldHVybiBhcmc7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbW1hbmRzLnJlZ2lzdGVyQ29tbWFuZChmYWxzZSwgJ3Rlc3RpbmcuZ2V0RXhwbG9yZXJTZWxlY3Rpb24nLCBhc3luYyAoKTogUHJvbWlzZTxhbnk+ID0+IHtcblx0XHRcdGNvbnN0IGlubmVyID0gYXdhaXQgY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8e1xuXHRcdFx0XHRpbmNsdWRlOiBzdHJpbmdbXTtcblx0XHRcdFx0ZXhjbHVkZTogc3RyaW5nW107XG5cdFx0XHR9PihUZXN0Q29tbWFuZElkLkdldEV4cGxvcmVyU2VsZWN0aW9uKTtcblxuXHRcdFx0Y29uc3QgbG9va3VwID0gKGk6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjb25zdCBjb250cm9sbGVyID0gdGhpcy5jb250cm9sbGVycy5nZXQoVGVzdElkLnJvb3QoaSkpO1xuXHRcdFx0XHRpZiAoIWNvbnRyb2xsZXIpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdFx0XHRyZXR1cm4gVGVzdElkLmlzUm9vdChpKSA/IGNvbnRyb2xsZXIuY29udHJvbGxlciA6IGNvbnRyb2xsZXIuY29sbGVjdGlvbi50cmVlLmdldChpKT8uYWN0dWFsO1xuXHRcdFx0fTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aW5jbHVkZTogaW5uZXI/LmluY2x1ZGUubWFwKGxvb2t1cCkuZmlsdGVyKGlzRGVmaW5lZCkgfHwgW10sXG5cdFx0XHRcdGV4Y2x1ZGU6IGlubmVyPy5leGNsdWRlLm1hcChsb29rdXApLmZpbHRlcihpc0RlZmluZWQpIHx8IFtdLFxuXHRcdFx0fTtcblx0XHR9KTtcblx0fVxuXG5cdC8vI3JlZ2lvbiBwdWJsaWMgQVBJXG5cblx0LyoqXG5cdCAqIEltcGxlbWVudHMgdnNjb2RlLnRlc3QucmVnaXN0ZXJUZXN0UHJvdmlkZXJcblx0ICovXG5cdHB1YmxpYyBjcmVhdGVUZXN0Q29udHJvbGxlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgY29udHJvbGxlcklkOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcsIHJlZnJlc2hIYW5kbGVyPzogKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikgPT4gVGhlbmFibGU8dm9pZD4gfCB2b2lkKTogdnNjb2RlLlRlc3RDb250cm9sbGVyIHtcblx0XHRpZiAodGhpcy5jb250cm9sbGVycy5oYXMoY29udHJvbGxlcklkKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBBdHRlbXB0IHRvIGluc2VydCBhIGR1cGxpY2F0ZSBjb250cm9sbGVyIHdpdGggSUQgXCIke2NvbnRyb2xsZXJJZH1cImApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgY29sbGVjdGlvbiA9IGRpc3Bvc2FibGUuYWRkKG5ldyBFeHRIb3N0VGVzdEl0ZW1Db2xsZWN0aW9uKGNvbnRyb2xsZXJJZCwgbGFiZWwsIHRoaXMuZWRpdG9ycykpO1xuXHRcdGNvbGxlY3Rpb24ucm9vdC5sYWJlbCA9IGxhYmVsO1xuXG5cdFx0Y29uc3QgcHJvZmlsZXMgPSBuZXcgTWFwPG51bWJlciwgdnNjb2RlLlRlc3RSdW5Qcm9maWxlPigpO1xuXHRcdGNvbnN0IGFjdGl2ZVByb2ZpbGVzID0gbmV3IFNldDxudW1iZXI+KCk7XG5cdFx0Y29uc3QgcHJveHkgPSB0aGlzLnByb3h5O1xuXG5cdFx0Y29uc3QgZ2V0Q2FwYWJpbGl0eSA9ICgpID0+IHtcblx0XHRcdGxldCBjYXAgPSAwO1xuXHRcdFx0aWYgKHJlZnJlc2hIYW5kbGVyKSB7XG5cdFx0XHRcdGNhcCB8PSBUZXN0Q29udHJvbGxlckNhcGFiaWxpdHkuUmVmcmVzaDtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHJjcCA9IGluZm8ucmVsYXRlZENvZGVQcm92aWRlcjtcblx0XHRcdGlmIChyY3ApIHtcblx0XHRcdFx0aWYgKHJjcD8ucHJvdmlkZVJlbGF0ZWRUZXN0cykge1xuXHRcdFx0XHRcdGNhcCB8PSBUZXN0Q29udHJvbGxlckNhcGFiaWxpdHkuVGVzdFJlbGF0ZWRUb0NvZGU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHJjcD8ucHJvdmlkZVJlbGF0ZWRDb2RlKSB7XG5cdFx0XHRcdFx0Y2FwIHw9IFRlc3RDb250cm9sbGVyQ2FwYWJpbGl0eS5Db2RlUmVsYXRlZFRvVGVzdDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGNhcCBhcyBUZXN0Q29udHJvbGxlckNhcGFiaWxpdHk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGNvbnRyb2xsZXI6IHZzY29kZS5UZXN0Q29udHJvbGxlciA9IHtcblx0XHRcdGl0ZW1zOiBjb2xsZWN0aW9uLnJvb3QuY2hpbGRyZW4sXG5cdFx0XHRnZXQgbGFiZWwoKSB7XG5cdFx0XHRcdHJldHVybiBsYWJlbDtcblx0XHRcdH0sXG5cdFx0XHRzZXQgbGFiZWwodmFsdWU6IHN0cmluZykge1xuXHRcdFx0XHRsYWJlbCA9IHZhbHVlO1xuXHRcdFx0XHRjb2xsZWN0aW9uLnJvb3QubGFiZWwgPSB2YWx1ZTtcblx0XHRcdFx0cHJveHkuJHVwZGF0ZUNvbnRyb2xsZXIoY29udHJvbGxlcklkLCB7IGxhYmVsIH0pO1xuXHRcdFx0fSxcblx0XHRcdGdldCByZWZyZXNoSGFuZGxlcigpIHtcblx0XHRcdFx0cmV0dXJuIHJlZnJlc2hIYW5kbGVyO1xuXHRcdFx0fSxcblx0XHRcdHNldCByZWZyZXNoSGFuZGxlcih2YWx1ZTogKCh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pID0+IFRoZW5hYmxlPHZvaWQ+IHwgdm9pZCkgfCB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmVmcmVzaEhhbmRsZXIgPSB2YWx1ZTtcblx0XHRcdFx0cHJveHkuJHVwZGF0ZUNvbnRyb2xsZXIoY29udHJvbGxlcklkLCB7IGNhcGFiaWxpdGllczogZ2V0Q2FwYWJpbGl0eSgpIH0pO1xuXHRcdFx0fSxcblx0XHRcdGdldCBpZCgpIHtcblx0XHRcdFx0cmV0dXJuIGNvbnRyb2xsZXJJZDtcblx0XHRcdH0sXG5cdFx0XHRnZXQgcmVsYXRlZENvZGVQcm92aWRlcigpIHtcblx0XHRcdFx0cmV0dXJuIGluZm8ucmVsYXRlZENvZGVQcm92aWRlcjtcblx0XHRcdH0sXG5cdFx0XHRzZXQgcmVsYXRlZENvZGVQcm92aWRlcih2YWx1ZTogdnNjb2RlLlRlc3RSZWxhdGVkQ29kZVByb3ZpZGVyIHwgdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ3Rlc3RSZWxhdGVkQ29kZScpO1xuXHRcdFx0XHRpbmZvLnJlbGF0ZWRDb2RlUHJvdmlkZXIgPSB2YWx1ZTtcblx0XHRcdFx0cHJveHkuJHVwZGF0ZUNvbnRyb2xsZXIoY29udHJvbGxlcklkLCB7IGNhcGFiaWxpdGllczogZ2V0Q2FwYWJpbGl0eSgpIH0pO1xuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZVJ1blByb2ZpbGU6IChsYWJlbCwgZ3JvdXAsIHJ1bkhhbmRsZXIsIGlzRGVmYXVsdCwgdGFnPzogdnNjb2RlLlRlc3RUYWcgfCB1bmRlZmluZWQsIHN1cHBvcnRzQ29udGludW91c1J1bj86IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0Ly8gRGVyaXZlIHRoZSBwcm9maWxlIElEIGZyb20gYSBoYXNoIHNvIHRoYXQgdGhlIHNhbWUgcHJvZmlsZSB3aWxsIHRlbmRcblx0XHRcdFx0Ly8gdG8gaGF2ZSB0aGUgc2FtZSBoYXNoZXMsIGFsbG93aW5nIHJlLXJ1biByZXF1ZXN0cyB0byB3b3JrIGFjcm9zcyByZWxvYWRzLlxuXHRcdFx0XHRsZXQgcHJvZmlsZUlkID0gaGFzaChsYWJlbCk7XG5cdFx0XHRcdHdoaWxlIChwcm9maWxlcy5oYXMocHJvZmlsZUlkKSkge1xuXHRcdFx0XHRcdHByb2ZpbGVJZCsrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIG5ldyBUZXN0UnVuUHJvZmlsZUltcGwodGhpcy5wcm94eSwgcHJvZmlsZXMsIGFjdGl2ZVByb2ZpbGVzLCB0aGlzLmRlZmF1bHRQcm9maWxlc0NoYW5nZWRFbWl0dGVyLmV2ZW50LCBjb250cm9sbGVySWQsIHByb2ZpbGVJZCwgbGFiZWwsIGdyb3VwLCBydW5IYW5kbGVyLCBpc0RlZmF1bHQsIHRhZywgc3VwcG9ydHNDb250aW51b3VzUnVuKTtcblx0XHRcdH0sXG5cdFx0XHRjcmVhdGVUZXN0SXRlbShpZCwgbGFiZWwsIHVyaSkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFRlc3RJdGVtSW1wbChjb250cm9sbGVySWQsIGlkLCBsYWJlbCwgdXJpKTtcblx0XHRcdH0sXG5cdFx0XHRjcmVhdGVUZXN0UnVuOiAocmVxdWVzdCwgbmFtZSwgcGVyc2lzdCA9IHRydWUpID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMucnVuVHJhY2tlci5jcmVhdGVUZXN0UnVuKGV4dGVuc2lvbiwgY29udHJvbGxlcklkLCBjb2xsZWN0aW9uLCByZXF1ZXN0LCBuYW1lLCBwZXJzaXN0KTtcblx0XHRcdH0sXG5cdFx0XHRpbnZhbGlkYXRlVGVzdFJlc3VsdHM6IGl0ZW1zID0+IHtcblx0XHRcdFx0aWYgKGl0ZW1zID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHR0aGlzLnByb3h5LiRtYXJrVGVzdFJldGlyZWQodW5kZWZpbmVkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBpdGVtc0FyciA9IGl0ZW1zIGluc3RhbmNlb2YgQXJyYXkgPyBpdGVtcyA6IFtpdGVtc107XG5cdFx0XHRcdFx0dGhpcy5wcm94eS4kbWFya1Rlc3RSZXRpcmVkKGl0ZW1zQXJyLm1hcChpID0+IFRlc3RJZC5mcm9tRXh0SG9zdFRlc3RJdGVtKGkhLCBjb250cm9sbGVySWQpLnRvU3RyaW5nKCkpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHNldCByZXNvbHZlSGFuZGxlcihmbikge1xuXHRcdFx0XHRjb2xsZWN0aW9uLnJlc29sdmVIYW5kbGVyID0gZm47XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHJlc29sdmVIYW5kbGVyKCkge1xuXHRcdFx0XHRyZXR1cm4gY29sbGVjdGlvbi5yZXNvbHZlSGFuZGxlciBhcyB1bmRlZmluZWQgfCAoKGl0ZW0/OiB2c2NvZGUuVGVzdEl0ZW0pID0+IHZvaWQpO1xuXHRcdFx0fSxcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHR9LFxuXHRcdH07XG5cblx0XHRjb25zdCBpbmZvOiBDb250cm9sbGVySW5mbyA9IHsgY29udHJvbGxlciwgY29sbGVjdGlvbiwgcHJvZmlsZXMsIGV4dGVuc2lvbiwgYWN0aXZlUHJvZmlsZXMgfTtcblx0XHRwcm94eS4kcmVnaXN0ZXJUZXN0Q29udHJvbGxlcihjb250cm9sbGVySWQsIGxhYmVsLCBnZXRDYXBhYmlsaXR5KCkpO1xuXHRcdGRpc3Bvc2FibGUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBwcm94eS4kdW5yZWdpc3RlclRlc3RDb250cm9sbGVyKGNvbnRyb2xsZXJJZCkpKTtcblxuXHRcdHRoaXMuY29udHJvbGxlcnMuc2V0KGNvbnRyb2xsZXJJZCwgaW5mbyk7XG5cdFx0ZGlzcG9zYWJsZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuY29udHJvbGxlcnMuZGVsZXRlKGNvbnRyb2xsZXJJZCkpKTtcblxuXHRcdGRpc3Bvc2FibGUuYWRkKGNvbGxlY3Rpb24ub25EaWRHZW5lcmF0ZURpZmYoZGlmZiA9PiBwcm94eS4kcHVibGlzaERpZmYoY29udHJvbGxlcklkLCBkaWZmLm1hcChUZXN0c0RpZmZPcC5zZXJpYWxpemUpKSkpO1xuXG5cdFx0cmV0dXJuIGNvbnRyb2xsZXI7XG5cdH1cblxuXHQvKipcblx0ICogSW1wbGVtZW50cyB2c2NvZGUudGVzdC5jcmVhdGVUZXN0T2JzZXJ2ZXJcblx0ICovXG5cdHB1YmxpYyBjcmVhdGVUZXN0T2JzZXJ2ZXIoKSB7XG5cdFx0cmV0dXJuIHRoaXMub2JzZXJ2ZXIuY2hlY2tvdXQoKTtcblx0fVxuXG5cblx0LyoqXG5cdCAqIEltcGxlbWVudHMgdnNjb2RlLnRlc3QucnVuVGVzdHNcblx0ICovXG5cdHB1YmxpYyBhc3luYyBydW5UZXN0cyhyZXE6IHZzY29kZS5UZXN0UnVuUmVxdWVzdCwgdG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSB7XG5cdFx0Y29uc3QgcHJvZmlsZSA9IHRyeUdldFByb2ZpbGVGcm9tVGVzdFJ1blJlcShyZXEpO1xuXHRcdGlmICghcHJvZmlsZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdUaGUgcmVxdWVzdCBwYXNzZWQgdG8gYHZzY29kZS50ZXN0LnJ1blRlc3RzYCBtdXN0IGluY2x1ZGUgYSBwcm9maWxlJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udHJvbGxlciA9IHRoaXMuY29udHJvbGxlcnMuZ2V0KHByb2ZpbGUuY29udHJvbGxlcklkKTtcblx0XHRpZiAoIWNvbnRyb2xsZXIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ29udHJvbGxlciBub3QgZm91bmQnKTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLnByb3h5LiRydW5UZXN0cyh7XG5cdFx0XHRwcmVzZXJ2ZUZvY3VzOiByZXEucHJlc2VydmVGb2N1cyA/PyB0cnVlLFxuXHRcdFx0Z3JvdXA6IENvbnZlcnQuVGVzdFJ1blByb2ZpbGVLaW5kLmZyb20ocHJvZmlsZS5raW5kKSxcblx0XHRcdHRhcmdldHM6IFt7XG5cdFx0XHRcdHRlc3RJZHM6IHJlcS5pbmNsdWRlPy5tYXAodCA9PiBUZXN0SWQuZnJvbUV4dEhvc3RUZXN0SXRlbSh0LCBjb250cm9sbGVyLmNvbGxlY3Rpb24ucm9vdC5pZCkudG9TdHJpbmcoKSkgPz8gW2NvbnRyb2xsZXIuY29sbGVjdGlvbi5yb290LmlkXSxcblx0XHRcdFx0cHJvZmlsZUlkOiBwcm9maWxlLnByb2ZpbGVJZCxcblx0XHRcdFx0Y29udHJvbGxlcklkOiBwcm9maWxlLmNvbnRyb2xsZXJJZCxcblx0XHRcdH1dLFxuXHRcdFx0ZXhjbHVkZTogcmVxLmV4Y2x1ZGU/Lm1hcCh0ID0+IHQuaWQpLFxuXHRcdH0sIHRva2VuKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBJbXBsZW1lbnRzIHZzY29kZS50ZXN0LnJlZ2lzdGVyVGVzdEZvbGxvd3VwUHJvdmlkZXJcblx0ICovXG5cdHB1YmxpYyByZWdpc3RlclRlc3RGb2xsb3d1cFByb3ZpZGVyKHByb3ZpZGVyOiB2c2NvZGUuVGVzdEZvbGxvd3VwUHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0dGhpcy5mb2xsb3d1cFByb3ZpZGVycy5hZGQocHJvdmlkZXIpO1xuXHRcdHJldHVybiB7IGRpc3Bvc2U6ICgpID0+IHsgdGhpcy5mb2xsb3d1cFByb3ZpZGVycy5kZWxldGUocHJvdmlkZXIpOyB9IH07XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gUlBDIG1ldGhvZHNcblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRhc3luYyAkZ2V0VGVzdHNSZWxhdGVkVG9Db2RlKHVyaTogVXJpQ29tcG9uZW50cywgX3Bvc2l0aW9uOiBJUG9zaXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8c3RyaW5nW10+IHtcblx0XHRjb25zdCBkb2MgPSB0aGlzLmVkaXRvcnMuZ2V0RG9jdW1lbnQoVVJJLnJldml2ZSh1cmkpKTtcblx0XHRpZiAoIWRvYykge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBvc2l0aW9uID0gQ29udmVydC5Qb3NpdGlvbi50byhfcG9zaXRpb24pO1xuXHRcdGNvbnN0IHJlbGF0ZWQ6IHN0cmluZ1tdID0gW107XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoWy4uLnRoaXMuY29udHJvbGxlcnMudmFsdWVzKCldLm1hcChhc3luYyAoYykgPT4ge1xuXHRcdFx0bGV0IHRlc3RzOiB2c2NvZGUuVGVzdEl0ZW1bXSB8IHVuZGVmaW5lZCB8IG51bGw7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0ZXN0cyA9IGF3YWl0IGMucmVsYXRlZENvZGVQcm92aWRlcj8ucHJvdmlkZVJlbGF0ZWRUZXN0cz8uKGRvYy5kb2N1bWVudCwgcG9zaXRpb24sIHRva2VuKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0aWYgKCF0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKGBFcnJvciB0aHJvd24gd2hpbGUgcHJvdmlkaW5nIHJlbGF0ZWQgdGVzdHMgZm9yICR7Yy5jb250cm9sbGVyLmxhYmVsfWAsIGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0ZXN0cykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHRlc3Qgb2YgdGVzdHMpIHtcblx0XHRcdFx0XHRyZWxhdGVkLnB1c2goVGVzdElkLmZyb21FeHRIb3N0VGVzdEl0ZW0odGVzdCwgYy5jb250cm9sbGVyLmlkKS50b1N0cmluZygpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjLmNvbGxlY3Rpb24uZmx1c2hEaWZmKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIHJlbGF0ZWQ7XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdGFzeW5jICRnZXRDb2RlUmVsYXRlZFRvVGVzdCh0ZXN0SWQ6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJTG9jYXRpb25EdG9bXT4ge1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLmNvbnRyb2xsZXJzLmdldChUZXN0SWQucm9vdCh0ZXN0SWQpKTtcblx0XHRpZiAoIWNvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCB0ZXN0ID0gY29udHJvbGxlci5jb2xsZWN0aW9uLnRyZWUuZ2V0KHRlc3RJZCk7XG5cdFx0aWYgKCF0ZXN0KSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgbG9jYXRpb25zID0gYXdhaXQgY29udHJvbGxlci5yZWxhdGVkQ29kZVByb3ZpZGVyPy5wcm92aWRlUmVsYXRlZENvZGU/Lih0ZXN0LmFjdHVhbCwgdG9rZW4pO1xuXHRcdHJldHVybiBsb2NhdGlvbnM/Lm1hcChDb252ZXJ0LmxvY2F0aW9uLmZyb20pID8/IFtdO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHQkc3luY1Rlc3RzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGZvciAoY29uc3QgeyBjb2xsZWN0aW9uIH0gb2YgdGhpcy5jb250cm9sbGVycy52YWx1ZXMoKSkge1xuXHRcdFx0Y29sbGVjdGlvbi5mbHVzaERpZmYoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdGFzeW5jICRnZXRDb3ZlcmFnZURldGFpbHMoY292ZXJhZ2VJZDogc3RyaW5nLCB0ZXN0SWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxDb3ZlcmFnZURldGFpbHMuU2VyaWFsaXplZFtdPiB7XG5cdFx0Y29uc3QgZGV0YWlscyA9IGF3YWl0IHRoaXMucnVuVHJhY2tlci5nZXRDb3ZlcmFnZURldGFpbHMoY292ZXJhZ2VJZCwgdGVzdElkLCB0b2tlbik7XG5cdFx0cmV0dXJuIGRldGFpbHM/Lm1hcChDb252ZXJ0LlRlc3RDb3ZlcmFnZS5mcm9tRGV0YWlscyk7XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdGFzeW5jICRkaXNwb3NlUnVuKHJ1bklkOiBzdHJpbmcpIHtcblx0XHR0aGlzLnJ1blRyYWNrZXIuZGlzcG9zZVRlc3RSdW4ocnVuSWQpO1xuXHR9XG5cblx0LyoqIEBpbmhlcml0ZG9jICovXG5cdCRjb25maWd1cmVSdW5Qcm9maWxlKGNvbnRyb2xsZXJJZDogc3RyaW5nLCBwcm9maWxlSWQ6IG51bWJlcikge1xuXHRcdHRoaXMuY29udHJvbGxlcnMuZ2V0KGNvbnRyb2xsZXJJZCk/LnByb2ZpbGVzLmdldChwcm9maWxlSWQpPy5jb25maWd1cmVIYW5kbGVyPy4oKTtcblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHQkc2V0RGVmYXVsdFJ1blByb2ZpbGVzKHByb2ZpbGVzOiBSZWNvcmQ8LyogY29udHJvbGxlciBpZCAqL3N0cmluZywgLyogcHJvZmlsZSBpZCAqLyBudW1iZXJbXT4pOiB2b2lkIHtcblx0XHRjb25zdCBldnQ6IERlZmF1bHRQcm9maWxlQ2hhbmdlRXZlbnQgPSBuZXcgTWFwKCk7XG5cdFx0Zm9yIChjb25zdCBbY29udHJvbGxlcklkLCBwcm9maWxlSWRzXSBvZiBPYmplY3QuZW50cmllcyhwcm9maWxlcykpIHtcblx0XHRcdGNvbnN0IGN0cmwgPSB0aGlzLmNvbnRyb2xsZXJzLmdldChjb250cm9sbGVySWQpO1xuXHRcdFx0aWYgKCFjdHJsKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY2hhbmdlcyA9IG5ldyBNYXA8bnVtYmVyLCBib29sZWFuPigpO1xuXHRcdFx0Y29uc3QgYWRkZWQgPSBwcm9maWxlSWRzLmZpbHRlcihpZCA9PiAhY3RybC5hY3RpdmVQcm9maWxlcy5oYXMoaWQpKTtcblx0XHRcdGNvbnN0IHJlbW92ZWQgPSBbLi4uY3RybC5hY3RpdmVQcm9maWxlc10uZmlsdGVyKGlkID0+ICFwcm9maWxlSWRzLmluY2x1ZGVzKGlkKSk7XG5cdFx0XHRmb3IgKGNvbnN0IGlkIG9mIGFkZGVkKSB7XG5cdFx0XHRcdGNoYW5nZXMuc2V0KGlkLCB0cnVlKTtcblx0XHRcdFx0Y3RybC5hY3RpdmVQcm9maWxlcy5hZGQoaWQpO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCBpZCBvZiByZW1vdmVkKSB7XG5cdFx0XHRcdGNoYW5nZXMuc2V0KGlkLCBmYWxzZSk7XG5cdFx0XHRcdGN0cmwuYWN0aXZlUHJvZmlsZXMuZGVsZXRlKGlkKTtcblx0XHRcdH1cblx0XHRcdGlmIChjaGFuZ2VzLnNpemUpIHtcblx0XHRcdFx0ZXZ0LnNldChjb250cm9sbGVySWQsIGNoYW5nZXMpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuZGVmYXVsdFByb2ZpbGVzQ2hhbmdlZEVtaXR0ZXIuZmlyZShldnQpO1xuXHR9XG5cblx0LyoqIEBpbmhlcml0ZG9jICovXG5cdGFzeW5jICRyZWZyZXNoVGVzdHMoY29udHJvbGxlcklkOiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdGF3YWl0IHRoaXMuY29udHJvbGxlcnMuZ2V0KGNvbnRyb2xsZXJJZCk/LmNvbnRyb2xsZXIucmVmcmVzaEhhbmRsZXI/Lih0b2tlbik7XG5cdH1cblxuXHQvKipcblx0ICogVXBkYXRlcyB0ZXN0IHJlc3VsdHMgc2hvd24gdG8gZXh0ZW5zaW9ucy5cblx0ICogQG92ZXJyaWRlXG5cdCAqL1xuXHRwdWJsaWMgJHB1Ymxpc2hUZXN0UmVzdWx0cyhyZXN1bHRzOiBJU2VyaWFsaXplZFRlc3RSZXN1bHRzW10pOiB2b2lkIHtcblx0XHR0aGlzLnJlc3VsdHMgPSBPYmplY3QuZnJlZXplKFxuXHRcdFx0cmVzdWx0c1xuXHRcdFx0XHQubWFwKHIgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG8gPSBDb252ZXJ0LlRlc3RSZXN1bHRzLnRvKHIpO1xuXHRcdFx0XHRcdGNvbnN0IHRhc2tXaXRoQ292ZXJhZ2UgPSByLnRhc2tzLmZpbmRJbmRleCh0ID0+IHQuaGFzQ292ZXJhZ2UpO1xuXHRcdFx0XHRcdGlmICh0YXNrV2l0aENvdmVyYWdlICE9PSAtMSkge1xuXHRcdFx0XHRcdFx0by5nZXREZXRhaWxlZENvdmVyYWdlID0gKHVyaSwgdG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSA9PlxuXHRcdFx0XHRcdFx0XHR0aGlzLnByb3h5LiRnZXRDb3ZlcmFnZURldGFpbHMoci5pZCwgdGFza1dpdGhDb3ZlcmFnZSwgdXJpLCB0b2tlbikudGhlbihyID0+IHIubWFwKENvbnZlcnQuVGVzdENvdmVyYWdlLnRvKSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGVzdFJlc3VsdEludGVybmFsSURzLnNldChvLCByLmlkKTtcblx0XHRcdFx0XHRyZXR1cm4gbztcblx0XHRcdFx0fSlcblx0XHRcdFx0LmNvbmNhdCh0aGlzLnJlc3VsdHMpXG5cdFx0XHRcdC5zb3J0KChhLCBiKSA9PiBiLmNvbXBsZXRlZEF0IC0gYS5jb21wbGV0ZWRBdClcblx0XHRcdFx0LnNsaWNlKDAsIDMyKSxcblx0XHQpO1xuXG5cdFx0dGhpcy5yZXN1bHRzQ2hhbmdlZEVtaXR0ZXIuZmlyZSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEV4cGFuZHMgdGhlIG5vZGVzIGluIHRoZSB0ZXN0IHRyZWUuIElmIGxldmVscyBpcyBsZXNzIHRoYW4gemVybywgaXQgd2lsbFxuXHQgKiBiZSB0cmVhdGVkIGFzIGluZmluaXRlLlxuXHQgKi9cblx0cHVibGljIGFzeW5jICRleHBhbmRUZXN0KHRlc3RJZDogc3RyaW5nLCBsZXZlbHM6IG51bWJlcikge1xuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSB0aGlzLmNvbnRyb2xsZXJzLmdldChUZXN0SWQuZnJvbVN0cmluZyh0ZXN0SWQpLmNvbnRyb2xsZXJJZCk/LmNvbGxlY3Rpb247XG5cdFx0aWYgKGNvbGxlY3Rpb24pIHtcblx0XHRcdGF3YWl0IGNvbGxlY3Rpb24uZXhwYW5kKHRlc3RJZCwgbGV2ZWxzIDwgMCA/IEluZmluaXR5IDogbGV2ZWxzKTtcblx0XHRcdGNvbGxlY3Rpb24uZmx1c2hEaWZmKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJlY2VpdmVzIGEgdGVzdCB1cGRhdGUgZnJvbSB0aGUgbWFpbiB0aHJlYWQuIENhbGxlZCAoZXZlbnR1YWxseSkgd2hlbmV2ZXJcblx0ICogdGVzdHMgY2hhbmdlLlxuXHQgKi9cblx0cHVibGljICRhY2NlcHREaWZmKGRpZmY6IFRlc3RzRGlmZk9wLlNlcmlhbGl6ZWRbXSk6IHZvaWQge1xuXHRcdHRoaXMub2JzZXJ2ZXIuYXBwbHlEaWZmKGRpZmYubWFwKGQgPT4gVGVzdHNEaWZmT3AuZGVzZXJpYWxpemUoeyBhc0Nhbm9uaWNhbFVyaTogdSA9PiB1IH0sIGQpKSk7XG5cdH1cblxuXHQvKipcblx0ICogUnVucyB0ZXN0cyB3aXRoIHRoZSBnaXZlbiBzZXQgb2YgSURzLiBBbGxvd3MgZm9yIHRlc3QgZnJvbSBtdWx0aXBsZVxuXHQgKiBwcm92aWRlcnMgdG8gYmUgcnVuLlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIGFzeW5jICRydW5Db250cm9sbGVyVGVzdHMocmVxczogSVN0YXJ0Q29udHJvbGxlclRlc3RzW10sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVN0YXJ0Q29udHJvbGxlclRlc3RzUmVzdWx0W10+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwocmVxcy5tYXAocmVxID0+IHRoaXMucnVuQ29udHJvbGxlclRlc3RSZXF1ZXN0KHJlcSwgZmFsc2UsIHRva2VuKSkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN0YXJ0cyBjb250aW51b3VzIHRlc3QgcnVucyB3aXRoIHRoZSBnaXZlbiBzZXQgb2YgSURzLiBBbGxvd3MgZm9yIHRlc3QgZnJvbVxuXHQgKiBtdWx0aXBsZSBwcm92aWRlcnMgdG8gYmUgcnVuLlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIGFzeW5jICRzdGFydENvbnRpbnVvdXNSdW4ocmVxczogSVN0YXJ0Q29udHJvbGxlclRlc3RzW10sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVN0YXJ0Q29udHJvbGxlclRlc3RzUmVzdWx0W10+IHtcblx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UodG9rZW4pO1xuXHRcdGNvbnN0IHJlcyA9IGF3YWl0IFByb21pc2UuYWxsKHJlcXMubWFwKHJlcSA9PiB0aGlzLnJ1bkNvbnRyb2xsZXJUZXN0UmVxdWVzdChyZXEsIHRydWUsIGN0cy50b2tlbikpKTtcblxuXHRcdC8vIGF2b2lkIHJldHVybmluZyB1bnRpbCBjYW5jZWxsYXRpb24gaXMgcmVxdWVzdGVkLCBvdGhlcndpc2UgaXBjIGRpc3Bvc2VzIG9mIHRoZSB0b2tlblxuXHRcdGlmICghdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQgJiYgIXJlcy5zb21lKHIgPT4gci5lcnJvcikpIHtcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gdG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQocikpO1xuXHRcdH1cblxuXHRcdGN0cy5kaXNwb3NlKHRydWUpO1xuXHRcdHJldHVybiByZXM7XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIGFzeW5jICRwcm92aWRlVGVzdEZvbGxvd3VwcyhyZXE6IFRlc3RNZXNzYWdlRm9sbG93dXBSZXF1ZXN0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFRlc3RNZXNzYWdlRm9sbG93dXBSZXNwb25zZVtdPiB7XG5cdFx0Y29uc3QgcmVzdWx0cyA9IHRoaXMucmVzdWx0cy5maW5kKHIgPT4gdGVzdFJlc3VsdEludGVybmFsSURzLmdldChyKSA9PT0gcmVxLnJlc3VsdElkKTtcblx0XHRjb25zdCB0ZXN0ID0gcmVzdWx0cyAmJiBmaW5kVGVzdEluUmVzdWx0U25hcHNob3QoVGVzdElkLmZyb21TdHJpbmcocmVxLmV4dElkKSwgcmVzdWx0cz8ucmVzdWx0cyk7XG5cdFx0aWYgKCF0ZXN0KSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0bGV0IGZvbGxvd3VwczogdnNjb2RlLkNvbW1hbmRbXSA9IFtdO1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKFsuLi50aGlzLmZvbGxvd3VwUHJvdmlkZXJzXS5tYXAoYXN5bmMgcHJvdmlkZXIgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgciA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVGb2xsb3d1cChyZXN1bHRzLCB0ZXN0LCByZXEudGFza0luZGV4LCByZXEubWVzc2FnZUluZGV4LCB0b2tlbik7XG5cdFx0XHRcdGlmIChyKSB7XG5cdFx0XHRcdFx0Zm9sbG93dXBzID0gZm9sbG93dXBzLmNvbmNhdChyKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYEVycm9yIHRocm93biB3aGlsZSBwcm92aWRpbmcgZm9sbG93dXAgZm9yIHRlc3QgbWVzc2FnZWAsIGUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdHJldHVybiBmb2xsb3d1cHMubWFwKGNvbW1hbmQgPT4ge1xuXHRcdFx0Y29uc3QgaWQgPSBmb2xsb3d1cENvdW50ZXIrKztcblx0XHRcdHRoaXMudGVzdEZvbGxvd3Vwcy5zZXQoaWQsIGNvbW1hbmQpO1xuXHRcdFx0cmV0dXJuIHsgdGl0bGU6IGNvbW1hbmQudGl0bGUsIGlkIH07XG5cdFx0fSk7XG5cdH1cblxuXHQkZGlzcG9zZVRlc3RGb2xsb3d1cHMoaWQ6IG51bWJlcltdKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBpIG9mIGlkKSB7XG5cdFx0XHR0aGlzLnRlc3RGb2xsb3d1cHMuZGVsZXRlKGkpO1xuXHRcdH1cblx0fVxuXG5cdCRleGVjdXRlVGVzdEZvbGxvd3VwKGlkOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb21tYW5kID0gdGhpcy50ZXN0Rm9sbG93dXBzLmdldChpZCk7XG5cdFx0aWYgKCFjb21tYW5kKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZC5jb21tYW5kLCAuLi4oY29tbWFuZC5hcmd1bWVudHMgfHwgW10pKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDYW5jZWxzIGFuIG9uZ29pbmcgdGVzdCBydW4uXG5cdCAqL1xuXHRwdWJsaWMgJGNhbmNlbEV4dGVuc2lvblRlc3RSdW4ocnVuSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgdGFza0lkOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAocnVuSWQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5ydW5UcmFja2VyLmNhbmNlbEFsbFJ1bnMoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5ydW5UcmFja2VyLmNhbmNlbFJ1bkJ5SWQocnVuSWQsIHRhc2tJZCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0cHVibGljIGdldE1ldGFkYXRhRm9yUnVuKHJ1bjogdnNjb2RlLlRlc3RSdW4pIHtcblx0XHRmb3IgKGNvbnN0IHRyYWNrZXIgb2YgdGhpcy5ydW5UcmFja2VyLnRyYWNrZXJzKSB7XG5cdFx0XHRjb25zdCB0YXNrSWQgPSB0cmFja2VyLmdldFRhc2tJZEZvclJ1bihydW4pO1xuXHRcdFx0aWYgKHRhc2tJZCkge1xuXHRcdFx0XHRyZXR1cm4geyB0YXNrSWQsIHJ1bklkOiB0cmFja2VyLmlkIH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcnVuQ29udHJvbGxlclRlc3RSZXF1ZXN0KHJlcTogSUNhbGxQcm9maWxlUnVuSGFuZGxlciB8IElDYWxsUHJvZmlsZVJ1bkhhbmRsZXIsIGlzQ29udGludW91czogYm9vbGVhbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJU3RhcnRDb250cm9sbGVyVGVzdHNSZXN1bHQ+IHtcblx0XHRjb25zdCBsb29rdXAgPSB0aGlzLmNvbnRyb2xsZXJzLmdldChyZXEuY29udHJvbGxlcklkKTtcblx0XHRpZiAoIWxvb2t1cCkge1xuXHRcdFx0cmV0dXJuIHt9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgY29sbGVjdGlvbiwgcHJvZmlsZXMsIGV4dGVuc2lvbiB9ID0gbG9va3VwO1xuXHRcdGNvbnN0IHByb2ZpbGUgPSBwcm9maWxlcy5nZXQocmVxLnByb2ZpbGVJZCk7XG5cdFx0aWYgKCFwcm9maWxlKSB7XG5cdFx0XHRyZXR1cm4ge307XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5jbHVkZVRlc3RzID0gcmVxLnRlc3RJZHNcblx0XHRcdC5tYXAoKHRlc3RJZCkgPT4gY29sbGVjdGlvbi50cmVlLmdldCh0ZXN0SWQpKVxuXHRcdFx0LmZpbHRlcihpc0RlZmluZWQpO1xuXG5cdFx0Y29uc3QgZXhjbHVkZVRlc3RzID0gcmVxLmV4Y2x1ZGVFeHRJZHNcblx0XHRcdC5tYXAoaWQgPT4gbG9va3VwLmNvbGxlY3Rpb24udHJlZS5nZXQoaWQpKVxuXHRcdFx0LmZpbHRlcihpc0RlZmluZWQpXG5cdFx0XHQuZmlsdGVyKGV4Y2x1ZGUgPT4gaW5jbHVkZVRlc3RzLnNvbWUoXG5cdFx0XHRcdGluY2x1ZGUgPT4gaW5jbHVkZS5mdWxsSWQuY29tcGFyZShleGNsdWRlLmZ1bGxJZCkgPT09IFRlc3RQb3NpdGlvbi5Jc0NoaWxkLFxuXHRcdFx0KSk7XG5cblx0XHRpZiAoIWluY2x1ZGVUZXN0cy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB7fTtcblx0XHR9XG5cblx0XHRjb25zdCBwdWJsaWNSZXEgPSBuZXcgVGVzdFJ1blJlcXVlc3QoXG5cdFx0XHRpbmNsdWRlVGVzdHMuc29tZShpID0+IGkuYWN0dWFsIGluc3RhbmNlb2YgVGVzdEl0ZW1Sb290SW1wbCkgPyB1bmRlZmluZWQgOiBpbmNsdWRlVGVzdHMubWFwKHQgPT4gdC5hY3R1YWwpLFxuXHRcdFx0ZXhjbHVkZVRlc3RzLm1hcCh0ID0+IHQuYWN0dWFsKSxcblx0XHRcdHByb2ZpbGUsXG5cdFx0XHRpc0NvbnRpbnVvdXMsXG5cdFx0KTtcblxuXHRcdGNvbnN0IHRyYWNrZXIgPSBpc1N0YXJ0Q29udHJvbGxlclRlc3RzKHJlcSkgJiYgdGhpcy5ydW5UcmFja2VyLnByZXBhcmVGb3JNYWluVGhyZWFkVGVzdFJ1bihcblx0XHRcdGV4dGVuc2lvbixcblx0XHRcdHB1YmxpY1JlcSxcblx0XHRcdFRlc3RSdW5EdG8uZnJvbUludGVybmFsKHJlcSwgbG9va3VwLmNvbGxlY3Rpb24pLFxuXHRcdFx0cHJvZmlsZSxcblx0XHRcdHRva2VuLFxuXHRcdCk7XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgcHJvZmlsZS5ydW5IYW5kbGVyKHB1YmxpY1JlcSwgdG9rZW4pO1xuXHRcdFx0cmV0dXJuIHt9O1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHJldHVybiB7IGVycm9yOiBTdHJpbmcoZSkgfTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0aWYgKHRyYWNrZXIpIHtcblx0XHRcdFx0aWYgKHRyYWNrZXIuaGFzUnVubmluZ1Rhc2tzICYmICF0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdGF3YWl0IEV2ZW50LnRvUHJvbWlzZSh0cmFja2VyLm9uRW5kKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG4vLyBEZWFkbGluZSBhZnRlciBiZWluZyByZXF1ZXN0ZWQgYnkgYSB1c2VyIHRoYXQgYSB0ZXN0IHJ1biBpcyBmb3JjaWJseSBjYW5jZWxsZWQuXG5jb25zdCBSVU5fQ0FOQ0VMX0RFQURMSU5FID0gMTBfMDAwO1xuXG5jb25zdCBlbnVtIFRlc3RSdW5UcmFja2VyU3RhdGUge1xuXHQvLyBEZWZhdWx0IHN0YXRlXG5cdFJ1bm5pbmcsXG5cdC8vIENhbmNlbGxhdGlvbiBpcyByZXF1ZXN0ZWQsIGJ1dCB0aGUgcnVuIGlzIHN0aWxsIGdvaW5nLlxuXHRDYW5jZWxsaW5nLFxuXHQvLyBBbGwgdGFza3MgaGF2ZSBlbmRlZFxuXHRFbmRlZCxcbn1cblxuY2xhc3MgVGVzdFJ1blRyYWNrZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBzdGF0ZSA9IFRlc3RSdW5UcmFja2VyU3RhdGUuUnVubmluZztcblx0cHJpdmF0ZSBydW5uaW5nID0gMDtcblx0cHJpdmF0ZSByZWFkb25seSB0YXNrcyA9IG5ldyBNYXA8LyogdGFzayBJRCAqL3N0cmluZywgeyBjdHM6IENhbmNlbGxhdGlvblRva2VuU291cmNlOyBydW46IHZzY29kZS5UZXN0UnVuIH0+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgc2hhcmVkVGVzdElkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGN0czogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgZW5kRW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG9uRGlkRGlzcG9zZTogRXZlbnQ8dm9pZD47XG5cdHByaXZhdGUgcmVhZG9ubHkgcHVibGlzaGVkQ292ZXJhZ2UgPSBuZXcgTWFwPHN0cmluZywgeyByZXBvcnQ6IHZzY29kZS5GaWxlQ292ZXJhZ2U7IGV4dElkczogc3RyaW5nW10gfT4oKTtcblxuXHQvKipcblx0ICogRmlyZXMgd2hlbiBhIHRlc3QgZW5kcywgYW5kIG5vIG1vcmUgdGVzdHMgYXJlIGxlZnQgcnVubmluZy5cblx0ICovXG5cdHB1YmxpYyByZWFkb25seSBvbkVuZCA9IHRoaXMuZW5kRW1pdHRlci5ldmVudDtcblxuXHQvKipcblx0ICogR2V0cyB3aGV0aGVyIHRoZXJlIGFyZSBhbnkgdGVzdHMgcnVubmluZy5cblx0ICovXG5cdHB1YmxpYyBnZXQgaGFzUnVubmluZ1Rhc2tzKCkge1xuXHRcdHJldHVybiB0aGlzLnJ1bm5pbmcgPiAwO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIHJ1biBJRC5cblx0ICovXG5cdHB1YmxpYyBnZXQgaWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuZHRvLmlkO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBkdG86IFRlc3RSdW5EdG8sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwcm94eTogTWFpblRocmVhZFRlc3RpbmdTaGFwZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcHJvZmlsZTogdnNjb2RlLlRlc3RSdW5Qcm9maWxlIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sXG5cdFx0cGFyZW50VG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbixcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmN0cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZShwYXJlbnRUb2tlbikpO1xuXG5cdFx0Y29uc3QgZm9yY2libHlFbmQgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLmZvcmNpYmx5RW5kVGFza3MoKSwgUlVOX0NBTkNFTF9ERUFETElORSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY3RzLnRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IGZvcmNpYmx5RW5kLnNjaGVkdWxlKCkpKTtcblxuXHRcdGNvbnN0IGRpZERpc3Bvc2VFbWl0dGVyID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0XHR0aGlzLm9uRGlkRGlzcG9zZSA9IGRpZERpc3Bvc2VFbWl0dGVyLmV2ZW50O1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRkaWREaXNwb3NlRW1pdHRlci5maXJlKCk7XG5cdFx0XHRkaWREaXNwb3NlRW1pdHRlci5kaXNwb3NlKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0LyoqIEdldHMgdGhlIHRhc2sgSUQgZnJvbSBhIHRlc3QgcnVuIG9iamVjdC4gKi9cblx0cHVibGljIGdldFRhc2tJZEZvclJ1bihydW46IHZzY29kZS5UZXN0UnVuKSB7XG5cdFx0Zm9yIChjb25zdCBbdGFza0lkLCB7IHJ1bjogciB9XSBvZiB0aGlzLnRhc2tzKSB7XG5cdFx0XHRpZiAociA9PT0gcnVuKSB7XG5cdFx0XHRcdHJldHVybiB0YXNrSWQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdC8qKiBSZXF1ZXN0cyBjYW5jZWxsYXRpb24gb2YgdGhlIHJ1bi4gT24gdGhlIHNlY29uZCBjYWxsLCBmb3JjZXMgY2FuY2VsbGF0aW9uLiAqL1xuXHRwdWJsaWMgY2FuY2VsKHRhc2tJZD86IHN0cmluZykge1xuXHRcdGlmICh0YXNrSWQpIHtcblx0XHRcdHRoaXMudGFza3MuZ2V0KHRhc2tJZCk/LmN0cy5jYW5jZWwoKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuc3RhdGUgPT09IFRlc3RSdW5UcmFja2VyU3RhdGUuUnVubmluZykge1xuXHRcdFx0dGhpcy5jdHMuY2FuY2VsKCk7XG5cdFx0XHR0aGlzLnN0YXRlID0gVGVzdFJ1blRyYWNrZXJTdGF0ZS5DYW5jZWxsaW5nO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5zdGF0ZSA9PT0gVGVzdFJ1blRyYWNrZXJTdGF0ZS5DYW5jZWxsaW5nKSB7XG5cdFx0XHR0aGlzLmZvcmNpYmx5RW5kVGFza3MoKTtcblx0XHR9XG5cdH1cblxuXHQvKiogR2V0cyBkZXRhaWxzIGZvciBhIHByZXZpb3VzbHktZW1pdHRlZCBjb3ZlcmFnZSBvYmplY3QuICovXG5cdHB1YmxpYyBhc3luYyBnZXRDb3ZlcmFnZURldGFpbHMoaWQ6IHN0cmluZywgdGVzdElkOiBzdHJpbmcgfCB1bmRlZmluZWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dnNjb2RlLkZpbGVDb3ZlcmFnZURldGFpbFtdPiB7XG5cdFx0Y29uc3QgWywgdGFza0lkXSA9IFRlc3RJZC5mcm9tU3RyaW5nKGlkKS5wYXRoOyAvKiogcnVuSWQsIHRhc2tJZCwgVVJJICovXG5cdFx0Y29uc3QgY292ZXJhZ2UgPSB0aGlzLnB1Ymxpc2hlZENvdmVyYWdlLmdldChpZCk7XG5cdFx0aWYgKCFjb3ZlcmFnZSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgcmVwb3J0LCBleHRJZHMgfSA9IGNvdmVyYWdlO1xuXHRcdGNvbnN0IHRhc2sgPSB0aGlzLnRhc2tzLmdldCh0YXNrSWQpO1xuXHRcdGlmICghdGFzaykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCd1bnJlYWNoYWJsZTogcnVuIHRhc2sgd2FzIG5vdCBmb3VuZCcpO1xuXHRcdH1cblxuXHRcdGxldCB0ZXN0SXRlbTogdnNjb2RlLlRlc3RJdGVtIHwgdW5kZWZpbmVkO1xuXHRcdGlmICh0ZXN0SWQgJiYgcmVwb3J0IGluc3RhbmNlb2YgRmlsZUNvdmVyYWdlKSB7XG5cdFx0XHRjb25zdCBpbmRleCA9IGV4dElkcy5pbmRleE9mKHRlc3RJZCk7XG5cdFx0XHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdHJldHVybiBbXTsgLy8gPz9cblx0XHRcdH1cblx0XHRcdHRlc3RJdGVtID0gcmVwb3J0LmluY2x1ZGVzVGVzdHNbaW5kZXhdO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRldGFpbHMgPSB0ZXN0SXRlbVxuXHRcdFx0PyB0aGlzLnByb2ZpbGU/LmxvYWREZXRhaWxlZENvdmVyYWdlRm9yVGVzdD8uKHRhc2sucnVuLCByZXBvcnQsIHRlc3RJdGVtLCB0b2tlbilcblx0XHRcdDogdGhpcy5wcm9maWxlPy5sb2FkRGV0YWlsZWRDb3ZlcmFnZT8uKHRhc2sucnVuLCByZXBvcnQsIHRva2VuKTtcblxuXHRcdHJldHVybiAoYXdhaXQgZGV0YWlscykgPz8gW107XG5cdH1cblxuXHQvKiogQ3JlYXRlcyB0aGUgcHVibGljIHRlc3QgcnVuIGludGVyZmFjZSB0byBnaXZlIHRvIGV4dGVuc2lvbnMuICovXG5cdHB1YmxpYyBjcmVhdGVSdW4obmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogdnNjb2RlLlRlc3RSdW4ge1xuXHRcdGNvbnN0IHJ1bklkID0gdGhpcy5kdG8uaWQ7XG5cdFx0Y29uc3QgY3RybElkID0gdGhpcy5kdG8uY29udHJvbGxlcklkO1xuXHRcdGNvbnN0IHRhc2tJZCA9IGdlbmVyYXRlVXVpZCgpO1xuXG5cdFx0Y29uc3QgZ3VhcmRUZXN0TXV0YXRpb24gPSA8QXJncyBleHRlbmRzIHVua25vd25bXT4oZm46ICh0ZXN0OiB2c2NvZGUuVGVzdEl0ZW0sIC4uLmFyZ3M6IEFyZ3MpID0+IHZvaWQpID0+XG5cdFx0XHQodGVzdDogdnNjb2RlLlRlc3RJdGVtLCAuLi5hcmdzOiBBcmdzKSA9PiB7XG5cdFx0XHRcdGlmIChlbmRlZCkge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKGBTZXR0aW5nIHRoZSBzdGF0ZSBvZiB0ZXN0IFwiJHt0ZXN0LmlkfVwiIGlzIGEgbm8tb3AgYWZ0ZXIgdGhlIHJ1biBlbmRzLmApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuZW5zdXJlVGVzdElzS25vd24odGVzdCk7XG5cdFx0XHRcdGZuKHRlc3QsIC4uLmFyZ3MpO1xuXHRcdFx0fTtcblxuXHRcdGNvbnN0IGFwcGVuZE1lc3NhZ2VzID0gKHRlc3Q6IHZzY29kZS5UZXN0SXRlbSwgbWVzc2FnZXM6IHZzY29kZS5UZXN0TWVzc2FnZSB8IHJlYWRvbmx5IHZzY29kZS5UZXN0TWVzc2FnZVtdKSA9PiB7XG5cdFx0XHRjb25zdCBjb252ZXJ0ZWQgPSBtZXNzYWdlcyBpbnN0YW5jZW9mIEFycmF5XG5cdFx0XHRcdD8gbWVzc2FnZXMubWFwKENvbnZlcnQuVGVzdE1lc3NhZ2UuZnJvbSlcblx0XHRcdFx0OiBbQ29udmVydC5UZXN0TWVzc2FnZS5mcm9tKG1lc3NhZ2VzKV07XG5cblx0XHRcdGlmICh0ZXN0LnVyaSAmJiB0ZXN0LnJhbmdlKSB7XG5cdFx0XHRcdGNvbnN0IGRlZmF1bHRMb2NhdGlvbjogSUxvY2F0aW9uRHRvID0geyByYW5nZTogQ29udmVydC5SYW5nZS5mcm9tKHRlc3QucmFuZ2UpLCB1cmk6IHRlc3QudXJpIH07XG5cdFx0XHRcdGZvciAoY29uc3QgbWVzc2FnZSBvZiBjb252ZXJ0ZWQpIHtcblx0XHRcdFx0XHRtZXNzYWdlLmxvY2F0aW9uID0gbWVzc2FnZS5sb2NhdGlvbiB8fCBkZWZhdWx0TG9jYXRpb247XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5wcm94eS4kYXBwZW5kVGVzdE1lc3NhZ2VzSW5SdW4ocnVuSWQsIHRhc2tJZCwgVGVzdElkLmZyb21FeHRIb3N0VGVzdEl0ZW0odGVzdCwgY3RybElkKS50b1N0cmluZygpLCBjb252ZXJ0ZWQpO1xuXHRcdH07XG5cblx0XHRsZXQgZW5kZWQgPSBmYWxzZTtcblx0XHQvLyB0YXNrcyBhcmUgYWxpdmUgZm9yIGFzIGxvbmcgYXMgdGhlIHRyYWNrZXIgaXMgYWxpdmUsIHNvIHNpbXBsZSB0aGlzLl9yZWdpc3RlciBpcyBmaW5lOlxuXHRcdGNvbnN0IGN0cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSh0aGlzLmN0cy50b2tlbikpO1xuXG5cdFx0Ly8gb25lLW9mZiBtYXAgdXNlZCB0byBhc3NvY2lhdGUgdGVzdCBpdGVtcyB3aXRoIGluY3JlbWVudGluZyBJRHMgaW4gYGFkZENvdmVyYWdlYC5cblx0XHQvLyBUaGVyZSdzIG5vIG5lZWQgdG8gaW5jbHVkZSB0aGVpciBlbnRpcmUgSUQsIHdlIGp1c3Qgd2FudCB0byBtYWtlIHN1cmUgdGhleSdyZVxuXHRcdC8vIHN0YWJsZSBhbmQgdW5pcXVlLiBOb3JtYWwgbWFwIGlzIG9rYXkgc2luY2UgVGVzdFJ1biBsaWZldGltZXMgYXJlIGxpbWl0ZWQuXG5cdFx0Y29uc3QgcnVuOiB2c2NvZGUuVGVzdFJ1biA9IHtcblx0XHRcdGlzUGVyc2lzdGVkOiB0aGlzLmR0by5pc1BlcnNpc3RlZCxcblx0XHRcdHRva2VuOiBjdHMudG9rZW4sXG5cdFx0XHRuYW1lLFxuXHRcdFx0b25EaWREaXNwb3NlOiB0aGlzLm9uRGlkRGlzcG9zZSxcblx0XHRcdGFkZENvdmVyYWdlOiAoY292ZXJhZ2UpID0+IHtcblx0XHRcdFx0aWYgKGVuZGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgaW5jbHVkZXNUZXN0cyA9IGNvdmVyYWdlIGluc3RhbmNlb2YgRmlsZUNvdmVyYWdlID8gY292ZXJhZ2UuaW5jbHVkZXNUZXN0cyA6IFtdO1xuXHRcdFx0XHRpZiAoaW5jbHVkZXNUZXN0cy5sZW5ndGgpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHRlc3Qgb2YgaW5jbHVkZXNUZXN0cykge1xuXHRcdFx0XHRcdFx0dGhpcy5lbnN1cmVUZXN0SXNLbm93bih0ZXN0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB1cmlTdHIgPSBjb3ZlcmFnZS51cmkudG9TdHJpbmcoKTtcblx0XHRcdFx0Y29uc3QgaWQgPSBuZXcgVGVzdElkKFtydW5JZCwgdGFza0lkLCB1cmlTdHJdKS50b1N0cmluZygpO1xuXHRcdFx0XHQvLyBpdCdzIGEgbGlsIGZ1bmt5LCBidXQgaXQncyBwb3NzaWJsZSBmb3IgYSB0ZXN0IGl0ZW0ncyBJRCB0byBjaGFuZ2UgYWZ0ZXJcblx0XHRcdFx0Ly8gaXQncyBiZWVuIHJlcG9ydGVkIGlmIGl0J3MgcmVob21lZCB1bmRlciBhIGRpZmZlcmVudCBwYXJlbnQuIFJlY29yZCBpdHNcblx0XHRcdFx0Ly8gSUQgYXQgdGhlIHRpbWUgd2hlbiB0aGUgY292ZXJhZ2UgcmVwb3J0IGlzIGdlbmVyYXRlZCBzbyB3ZSBjYW4gcmVmZXJlbmNlXG5cdFx0XHRcdC8vIGl0IGxhdGVyIGlmIG5lZWRlZWQuXG5cdFx0XHRcdHRoaXMucHVibGlzaGVkQ292ZXJhZ2Uuc2V0KGlkLCB7IHJlcG9ydDogY292ZXJhZ2UsIGV4dElkczogaW5jbHVkZXNUZXN0cy5tYXAodCA9PiBUZXN0SWQuZnJvbUV4dEhvc3RUZXN0SXRlbSh0LCBjdHJsSWQpLnRvU3RyaW5nKCkpIH0pO1xuXHRcdFx0XHR0aGlzLnByb3h5LiRhcHBlbmRDb3ZlcmFnZShydW5JZCwgdGFza0lkLCBDb252ZXJ0LlRlc3RDb3ZlcmFnZS5mcm9tRmlsZShjdHJsSWQsIGlkLCBjb3ZlcmFnZSkpO1xuXHRcdFx0fSxcblx0XHRcdC8vI3JlZ2lvbiBzdGF0ZSBtdXRhdGlvblxuXHRcdFx0ZW5xdWV1ZWQ6IGd1YXJkVGVzdE11dGF0aW9uKHRlc3QgPT4ge1xuXHRcdFx0XHR0aGlzLnByb3h5LiR1cGRhdGVUZXN0U3RhdGVJblJ1bihydW5JZCwgdGFza0lkLCBUZXN0SWQuZnJvbUV4dEhvc3RUZXN0SXRlbSh0ZXN0LCBjdHJsSWQpLnRvU3RyaW5nKCksIFRlc3RSZXN1bHRTdGF0ZS5RdWV1ZWQpO1xuXHRcdFx0fSksXG5cdFx0XHRza2lwcGVkOiBndWFyZFRlc3RNdXRhdGlvbih0ZXN0ID0+IHtcblx0XHRcdFx0dGhpcy5wcm94eS4kdXBkYXRlVGVzdFN0YXRlSW5SdW4ocnVuSWQsIHRhc2tJZCwgVGVzdElkLmZyb21FeHRIb3N0VGVzdEl0ZW0odGVzdCwgY3RybElkKS50b1N0cmluZygpLCBUZXN0UmVzdWx0U3RhdGUuU2tpcHBlZCk7XG5cdFx0XHR9KSxcblx0XHRcdHN0YXJ0ZWQ6IGd1YXJkVGVzdE11dGF0aW9uKHRlc3QgPT4ge1xuXHRcdFx0XHR0aGlzLnByb3h5LiR1cGRhdGVUZXN0U3RhdGVJblJ1bihydW5JZCwgdGFza0lkLCBUZXN0SWQuZnJvbUV4dEhvc3RUZXN0SXRlbSh0ZXN0LCBjdHJsSWQpLnRvU3RyaW5nKCksIFRlc3RSZXN1bHRTdGF0ZS5SdW5uaW5nKTtcblx0XHRcdH0pLFxuXHRcdFx0ZXJyb3JlZDogZ3VhcmRUZXN0TXV0YXRpb24oKHRlc3QsIG1lc3NhZ2VzLCBkdXJhdGlvbikgPT4ge1xuXHRcdFx0XHRhcHBlbmRNZXNzYWdlcyh0ZXN0LCBtZXNzYWdlcyk7XG5cdFx0XHRcdHRoaXMucHJveHkuJHVwZGF0ZVRlc3RTdGF0ZUluUnVuKHJ1bklkLCB0YXNrSWQsIFRlc3RJZC5mcm9tRXh0SG9zdFRlc3RJdGVtKHRlc3QsIGN0cmxJZCkudG9TdHJpbmcoKSwgVGVzdFJlc3VsdFN0YXRlLkVycm9yZWQsIGR1cmF0aW9uKTtcblx0XHRcdH0pLFxuXHRcdFx0ZmFpbGVkOiBndWFyZFRlc3RNdXRhdGlvbigodGVzdCwgbWVzc2FnZXMsIGR1cmF0aW9uKSA9PiB7XG5cdFx0XHRcdGFwcGVuZE1lc3NhZ2VzKHRlc3QsIG1lc3NhZ2VzKTtcblx0XHRcdFx0dGhpcy5wcm94eS4kdXBkYXRlVGVzdFN0YXRlSW5SdW4ocnVuSWQsIHRhc2tJZCwgVGVzdElkLmZyb21FeHRIb3N0VGVzdEl0ZW0odGVzdCwgY3RybElkKS50b1N0cmluZygpLCBUZXN0UmVzdWx0U3RhdGUuRmFpbGVkLCBkdXJhdGlvbik7XG5cdFx0XHR9KSxcblx0XHRcdHBhc3NlZDogZ3VhcmRUZXN0TXV0YXRpb24oKHRlc3QsIGR1cmF0aW9uKSA9PiB7XG5cdFx0XHRcdHRoaXMucHJveHkuJHVwZGF0ZVRlc3RTdGF0ZUluUnVuKHJ1bklkLCB0YXNrSWQsIFRlc3RJZC5mcm9tRXh0SG9zdFRlc3RJdGVtKHRlc3QsIHRoaXMuZHRvLmNvbnRyb2xsZXJJZCkudG9TdHJpbmcoKSwgVGVzdFJlc3VsdFN0YXRlLlBhc3NlZCwgZHVyYXRpb24pO1xuXHRcdFx0fSksXG5cdFx0XHQvLyNlbmRyZWdpb25cblx0XHRcdGFwcGVuZE91dHB1dDogKG91dHB1dCwgbG9jYXRpb24/OiB2c2NvZGUuTG9jYXRpb24sIHRlc3Q/OiB2c2NvZGUuVGVzdEl0ZW0pID0+IHtcblx0XHRcdFx0aWYgKGVuZGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRlc3QpIHtcblx0XHRcdFx0XHR0aGlzLmVuc3VyZVRlc3RJc0tub3duKHRlc3QpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5wcm94eS4kYXBwZW5kT3V0cHV0VG9SdW4oXG5cdFx0XHRcdFx0cnVuSWQsXG5cdFx0XHRcdFx0dGFza0lkLFxuXHRcdFx0XHRcdFZTQnVmZmVyLmZyb21TdHJpbmcob3V0cHV0KSxcblx0XHRcdFx0XHRsb2NhdGlvbiAmJiBDb252ZXJ0LmxvY2F0aW9uLmZyb20obG9jYXRpb24pLFxuXHRcdFx0XHRcdHRlc3QgJiYgVGVzdElkLmZyb21FeHRIb3N0VGVzdEl0ZW0odGVzdCwgY3RybElkKS50b1N0cmluZygpLFxuXHRcdFx0XHQpO1xuXHRcdFx0fSxcblx0XHRcdGVuZDogKCkgPT4ge1xuXHRcdFx0XHRpZiAoZW5kZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRlbmRlZCA9IHRydWU7XG5cdFx0XHRcdHRoaXMucHJveHkuJGZpbmlzaGVkVGVzdFJ1blRhc2socnVuSWQsIHRhc2tJZCk7XG5cdFx0XHRcdGlmICghLS10aGlzLnJ1bm5pbmcpIHtcblx0XHRcdFx0XHR0aGlzLm1hcmtFbmRlZCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMucnVubmluZysrO1xuXHRcdHRoaXMudGFza3Muc2V0KHRhc2tJZCwgeyBydW4sIGN0cyB9KTtcblx0XHR0aGlzLnByb3h5LiRzdGFydGVkVGVzdFJ1blRhc2socnVuSWQsIHtcblx0XHRcdGlkOiB0YXNrSWQsXG5cdFx0XHRjdHJsSWQ6IHRoaXMuZHRvLmNvbnRyb2xsZXJJZCxcblx0XHRcdG5hbWU6IG5hbWUgfHwgdGhpcy5leHRlbnNpb24uZGlzcGxheU5hbWUgfHwgdGhpcy5leHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSxcblx0XHRcdHJ1bm5pbmc6IHRydWUsXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcnVuO1xuXHR9XG5cblx0cHJpdmF0ZSBmb3JjaWJseUVuZFRhc2tzKCkge1xuXHRcdGZvciAoY29uc3QgeyBydW4gfSBvZiB0aGlzLnRhc2tzLnZhbHVlcygpKSB7XG5cdFx0XHRydW4uZW5kKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBtYXJrRW5kZWQoKSB7XG5cdFx0aWYgKHRoaXMuc3RhdGUgIT09IFRlc3RSdW5UcmFja2VyU3RhdGUuRW5kZWQpIHtcblx0XHRcdHRoaXMuc3RhdGUgPSBUZXN0UnVuVHJhY2tlclN0YXRlLkVuZGVkO1xuXHRcdFx0dGhpcy5lbmRFbWl0dGVyLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGVuc3VyZVRlc3RJc0tub3duKHRlc3Q6IHZzY29kZS5UZXN0SXRlbSkge1xuXHRcdGlmICghKHRlc3QgaW5zdGFuY2VvZiBUZXN0SXRlbUltcGwpKSB7XG5cdFx0XHR0aHJvdyBuZXcgSW52YWxpZFRlc3RJdGVtRXJyb3IodGVzdC5pZCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc2hhcmVkVGVzdElkcy5oYXMoVGVzdElkLmZyb21FeHRIb3N0VGVzdEl0ZW0odGVzdCwgdGhpcy5kdG8uY29udHJvbGxlcklkKS50b1N0cmluZygpKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNoYWluOiBJVGVzdEl0ZW0uU2VyaWFsaXplZFtdID0gW107XG5cdFx0Y29uc3Qgcm9vdCA9IHRoaXMuZHRvLmNvbGxsZWN0aW9uLnJvb3Q7XG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdGNvbnN0IGNvbnZlcnRlZCA9IENvbnZlcnQuVGVzdEl0ZW0uZnJvbSh0ZXN0IGFzIFRlc3RJdGVtSW1wbCk7XG5cdFx0XHRjaGFpbi51bnNoaWZ0KGNvbnZlcnRlZCk7XG5cblx0XHRcdGlmICh0aGlzLnNoYXJlZFRlc3RJZHMuaGFzKGNvbnZlcnRlZC5leHRJZCkpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuc2hhcmVkVGVzdElkcy5hZGQoY29udmVydGVkLmV4dElkKTtcblx0XHRcdGlmICh0ZXN0ID09PSByb290KSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHR0ZXN0ID0gdGVzdC5wYXJlbnQgfHwgcm9vdDtcblx0XHR9XG5cblx0XHR0aGlzLnByb3h5LiRhZGRUZXN0c1RvUnVuKHRoaXMuZHRvLmNvbnRyb2xsZXJJZCwgdGhpcy5kdG8uaWQsIGNoYWluKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMubWFya0VuZGVkKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbi8qKlxuICogUXVldWVzIHJ1bnMgZm9yIGEgc2luZ2xlIGV4dGVuc2lvbiBhbmQgcHJvdmlkZXMgdGhlIGN1cnJlbnRseS1leGVjdXRpbmdcbiAqIHJ1biBzbyB0aGF0IGBjcmVhdGVUZXN0UnVuYCBjYW4gYmUgcHJvcGVybHkgY29ycmVsYXRlZC5cbiAqL1xuZXhwb3J0IGNsYXNzIFRlc3RSdW5Db29yZGluYXRvciB7XG5cdHByaXZhdGUgcmVhZG9ubHkgdHJhY2tlZCA9IG5ldyBNYXA8dnNjb2RlLlRlc3RSdW5SZXF1ZXN0LCBUZXN0UnVuVHJhY2tlcj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSB0cmFja2VkQnlJZCA9IG5ldyBNYXA8c3RyaW5nLCBUZXN0UnVuVHJhY2tlcj4oKTtcblxuXHRwdWJsaWMgZ2V0IHRyYWNrZXJzKCkge1xuXHRcdHJldHVybiB0aGlzLnRyYWNrZWQudmFsdWVzKCk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHByb3h5OiBNYWluVGhyZWFkVGVzdGluZ1NoYXBlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkgeyB9XG5cblx0LyoqXG5cdCAqIEdldHMgYSBjb3ZlcmFnZSByZXBvcnQgZm9yIGEgZ2l2ZW4gcnVuIGFuZCB0YXNrIElELlxuXHQgKi9cblx0cHVibGljIGdldENvdmVyYWdlRGV0YWlscyhpZDogc3RyaW5nLCB0ZXN0SWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdGNvbnN0IHJ1bklkID0gVGVzdElkLnJvb3QoaWQpO1xuXHRcdHJldHVybiB0aGlzLnRyYWNrZWRCeUlkLmdldChydW5JZCk/LmdldENvdmVyYWdlRGV0YWlscyhpZCwgdGVzdElkLCB0b2tlbikgfHwgW107XG5cdH1cblxuXHQvKipcblx0ICogRGlzcG9zZXMgdGhlIHRlc3QgcnVuLCBjYWxsZWQgd2hlbiB0aGUgbWFpbiB0aHJlYWQgaXMgbm8gbG9uZ2VyIGludGVyZXN0ZWRcblx0ICogaW4gYXNzb2NpYXRlZCBkYXRhLlxuXHQgKi9cblx0cHVibGljIGRpc3Bvc2VUZXN0UnVuKHJ1bklkOiBzdHJpbmcpIHtcblx0XHR0aGlzLnRyYWNrZWRCeUlkLmdldChydW5JZCk/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLnRyYWNrZWRCeUlkLmRlbGV0ZShydW5JZCk7XG5cdFx0Zm9yIChjb25zdCBbcmVxLCB7IGlkIH1dIG9mIHRoaXMudHJhY2tlZCkge1xuXHRcdFx0aWYgKGlkID09PSBydW5JZCkge1xuXHRcdFx0XHR0aGlzLnRyYWNrZWQuZGVsZXRlKHJlcSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJlZ2lzdGVycyBhIHJlcXVlc3QgYXMgYmVpbmcgaW52b2tlZCBieSB0aGUgbWFpbiB0aHJlYWQsIHNvXG5cdCAqIGAkc3RhcnRlZEV4dGVuc2lvblRlc3RSdW5gIGlzIG5vdCBpbnZva2VkLiBUaGUgcnVuIG11c3QgZXZlbnR1YWxseVxuXHQgKiBiZSBjYW5jZWxsZWQgbWFudWFsbHkuXG5cdCAqL1xuXHRwdWJsaWMgcHJlcGFyZUZvck1haW5UaHJlYWRUZXN0UnVuKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCByZXE6IHZzY29kZS5UZXN0UnVuUmVxdWVzdCwgZHRvOiBUZXN0UnVuRHRvLCBwcm9maWxlOiB2c2NvZGUuVGVzdFJ1blByb2ZpbGUsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdHJldHVybiB0aGlzLmdldFRyYWNrZXIocmVxLCBkdG8sIHByb2ZpbGUsIGV4dGVuc2lvbiwgdG9rZW4pO1xuXHR9XG5cblx0LyoqXG5cdCAqIENhbmNlbHMgYW4gZXhpc3RpbmcgdGVzdCBydW4gdmlhIGl0cyBjYW5jZWxsYXRpb24gdG9rZW4uXG5cdCAqL1xuXHRwdWJsaWMgY2FuY2VsUnVuQnlJZChydW5JZDogc3RyaW5nLCB0YXNrSWQ/OiBzdHJpbmcpIHtcblx0XHR0aGlzLnRyYWNrZWRCeUlkLmdldChydW5JZCk/LmNhbmNlbCh0YXNrSWQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENhbmNlbHMgYW4gZXhpc3RpbmcgdGVzdCBydW4gdmlhIGl0cyBjYW5jZWxsYXRpb24gdG9rZW4uXG5cdCAqL1xuXHRwdWJsaWMgY2FuY2VsQWxsUnVucygpIHtcblx0XHRmb3IgKGNvbnN0IHRyYWNrZXIgb2YgdGhpcy50cmFja2VkLnZhbHVlcygpKSB7XG5cdFx0XHR0cmFja2VyLmNhbmNlbCgpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBJbXBsZW1lbnRzIHRoZSBwdWJsaWMgYGNyZWF0ZVRlc3RSdW5gIEFQSS5cblx0ICovXG5cdHB1YmxpYyBjcmVhdGVUZXN0UnVuKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBjb250cm9sbGVySWQ6IHN0cmluZywgY29sbGVjdGlvbjogRXh0SG9zdFRlc3RJdGVtQ29sbGVjdGlvbiwgcmVxdWVzdDogdnNjb2RlLlRlc3RSdW5SZXF1ZXN0LCBuYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQsIHBlcnNpc3Q6IGJvb2xlYW4pOiB2c2NvZGUuVGVzdFJ1biB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLnRyYWNrZWQuZ2V0KHJlcXVlc3QpO1xuXHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0cmV0dXJuIGV4aXN0aW5nLmNyZWF0ZVJ1bihuYW1lKTtcblx0XHR9XG5cblx0XHQvLyBJZiB0aGVyZSBpcyBub3QgYW4gZXhpc3RpbmcgdHJhY2tlZCBleHRlbnNpb24gZm9yIHRoZSByZXF1ZXN0LCBzdGFydFxuXHRcdC8vIGEgbmV3LCBkZXRhY2hlZCBzZXNzaW9uLlxuXHRcdGNvbnN0IGR0byA9IFRlc3RSdW5EdG8uZnJvbVB1YmxpYyhjb250cm9sbGVySWQsIGNvbGxlY3Rpb24sIHJlcXVlc3QsIHBlcnNpc3QpO1xuXHRcdGNvbnN0IHByb2ZpbGUgPSB0cnlHZXRQcm9maWxlRnJvbVRlc3RSdW5SZXEocmVxdWVzdCk7XG5cdFx0dGhpcy5wcm94eS4kc3RhcnRlZEV4dGVuc2lvblRlc3RSdW4oe1xuXHRcdFx0Y29udHJvbGxlcklkLFxuXHRcdFx0Y29udGludW91czogISFyZXF1ZXN0LmNvbnRpbnVvdXMsXG5cdFx0XHRwcm9maWxlOiBwcm9maWxlICYmIHsgZ3JvdXA6IENvbnZlcnQuVGVzdFJ1blByb2ZpbGVLaW5kLmZyb20ocHJvZmlsZS5raW5kKSwgaWQ6IHByb2ZpbGUucHJvZmlsZUlkIH0sXG5cdFx0XHRleGNsdWRlOiByZXF1ZXN0LmV4Y2x1ZGU/Lm1hcCh0ID0+IFRlc3RJZC5mcm9tRXh0SG9zdFRlc3RJdGVtKHQsIGNvbGxlY3Rpb24ucm9vdC5pZCkudG9TdHJpbmcoKSkgPz8gW10sXG5cdFx0XHRpZDogZHRvLmlkLFxuXHRcdFx0aW5jbHVkZTogcmVxdWVzdC5pbmNsdWRlPy5tYXAodCA9PiBUZXN0SWQuZnJvbUV4dEhvc3RUZXN0SXRlbSh0LCBjb2xsZWN0aW9uLnJvb3QuaWQpLnRvU3RyaW5nKCkpID8/IFtjb2xsZWN0aW9uLnJvb3QuaWRdLFxuXHRcdFx0cHJlc2VydmVGb2N1czogcmVxdWVzdC5wcmVzZXJ2ZUZvY3VzID8/IHRydWUsXG5cdFx0XHRwZXJzaXN0XG5cdFx0fSk7XG5cblx0XHRjb25zdCB0cmFja2VyID0gdGhpcy5nZXRUcmFja2VyKHJlcXVlc3QsIGR0bywgcmVxdWVzdC5wcm9maWxlLCBleHRlbnNpb24pO1xuXHRcdEV2ZW50Lm9uY2UodHJhY2tlci5vbkVuZCkoKCkgPT4ge1xuXHRcdFx0dGhpcy5wcm94eS4kZmluaXNoZWRFeHRlbnNpb25UZXN0UnVuKGR0by5pZCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gdHJhY2tlci5jcmVhdGVSdW4obmFtZSk7XG5cdH1cblxuXHRwcml2YXRlIGdldFRyYWNrZXIocmVxOiB2c2NvZGUuVGVzdFJ1blJlcXVlc3QsIGR0bzogVGVzdFJ1bkR0bywgcHJvZmlsZTogdnNjb2RlLlRlc3RSdW5Qcm9maWxlIHwgdW5kZWZpbmVkLCBleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdGNvbnN0IHRyYWNrZXIgPSBuZXcgVGVzdFJ1blRyYWNrZXIoZHRvLCB0aGlzLnByb3h5LCB0aGlzLmxvZ1NlcnZpY2UsIHByb2ZpbGUsIGV4dGVuc2lvbiwgdG9rZW4pO1xuXHRcdHRoaXMudHJhY2tlZC5zZXQocmVxLCB0cmFja2VyKTtcblx0XHR0aGlzLnRyYWNrZWRCeUlkLnNldCh0cmFja2VyLmlkLCB0cmFja2VyKTtcblx0XHRyZXR1cm4gdHJhY2tlcjtcblx0fVxufVxuXG5jb25zdCB0cnlHZXRQcm9maWxlRnJvbVRlc3RSdW5SZXEgPSAocmVxdWVzdDogdnNjb2RlLlRlc3RSdW5SZXF1ZXN0KSA9PiB7XG5cdGlmICghcmVxdWVzdC5wcm9maWxlKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGlmICghKHJlcXVlc3QucHJvZmlsZSBpbnN0YW5jZW9mIFRlc3RSdW5Qcm9maWxlSW1wbCkpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoYFRlc3RSdW5SZXF1ZXN0LnByb2ZpbGUgaXMgbm90IGFuIGluc3RhbmNlIGNyZWF0ZWQgZnJvbSBUZXN0Q29udHJvbGxlci5jcmVhdGVSdW5Qcm9maWxlYCk7XG5cdH1cblxuXHRyZXR1cm4gcmVxdWVzdC5wcm9maWxlO1xufTtcblxuZXhwb3J0IGNsYXNzIFRlc3RSdW5EdG8ge1xuXHRwdWJsaWMgc3RhdGljIGZyb21QdWJsaWMoY29udHJvbGxlcklkOiBzdHJpbmcsIGNvbGxlY3Rpb246IEV4dEhvc3RUZXN0SXRlbUNvbGxlY3Rpb24sIHJlcXVlc3Q6IHZzY29kZS5UZXN0UnVuUmVxdWVzdCwgcGVyc2lzdDogYm9vbGVhbikge1xuXHRcdHJldHVybiBuZXcgVGVzdFJ1bkR0byhcblx0XHRcdGNvbnRyb2xsZXJJZCxcblx0XHRcdGdlbmVyYXRlVXVpZCgpLFxuXHRcdFx0cGVyc2lzdCxcblx0XHRcdGNvbGxlY3Rpb24sXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZnJvbUludGVybmFsKHJlcXVlc3Q6IElTdGFydENvbnRyb2xsZXJUZXN0cywgY29sbGVjdGlvbjogRXh0SG9zdFRlc3RJdGVtQ29sbGVjdGlvbikge1xuXHRcdHJldHVybiBuZXcgVGVzdFJ1bkR0byhcblx0XHRcdHJlcXVlc3QuY29udHJvbGxlcklkLFxuXHRcdFx0cmVxdWVzdC5ydW5JZCxcblx0XHRcdHRydWUsXG5cdFx0XHRjb2xsZWN0aW9uLFxuXHRcdCk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgY29udHJvbGxlcklkOiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IGlkOiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IGlzUGVyc2lzdGVkOiBib29sZWFuLFxuXHRcdHB1YmxpYyByZWFkb25seSBjb2xsbGVjdGlvbjogRXh0SG9zdFRlc3RJdGVtQ29sbGVjdGlvbixcblx0KSB7XG5cdH1cbn1cblxuLyoqXG4gKiBAcHJpdmF0ZVxuICovXG5pbnRlcmZhY2UgTWlycm9yZWRDb2xsZWN0aW9uVGVzdEl0ZW0gZXh0ZW5kcyBJbmNyZW1lbnRhbFRlc3RDb2xsZWN0aW9uSXRlbSB7XG5cdHJldml2ZWQ6IHZzY29kZS5UZXN0SXRlbTtcblx0ZGVwdGg6IG51bWJlcjtcbn1cblxuY2xhc3MgTWlycm9yZWRDaGFuZ2VDb2xsZWN0b3IgaW1wbGVtZW50cyBJbmNyZW1lbnRhbENoYW5nZUNvbGxlY3RvcjxNaXJyb3JlZENvbGxlY3Rpb25UZXN0SXRlbT4ge1xuXHRwcml2YXRlIHJlYWRvbmx5IGFkZGVkID0gbmV3IFNldDxNaXJyb3JlZENvbGxlY3Rpb25UZXN0SXRlbT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSB1cGRhdGVkID0gbmV3IFNldDxNaXJyb3JlZENvbGxlY3Rpb25UZXN0SXRlbT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSByZW1vdmVkID0gbmV3IFNldDxNaXJyb3JlZENvbGxlY3Rpb25UZXN0SXRlbT4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGFscmVhZHlSZW1vdmVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0cHVibGljIGdldCBpc0VtcHR5KCkge1xuXHRcdHJldHVybiB0aGlzLmFkZGVkLnNpemUgPT09IDAgJiYgdGhpcy5yZW1vdmVkLnNpemUgPT09IDAgJiYgdGhpcy51cGRhdGVkLnNpemUgPT09IDA7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGVtaXR0ZXI6IEVtaXR0ZXI8dnNjb2RlLlRlc3RzQ2hhbmdlRXZlbnQ+KSB7XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyBhZGQobm9kZTogTWlycm9yZWRDb2xsZWN0aW9uVGVzdEl0ZW0pOiB2b2lkIHtcblx0XHR0aGlzLmFkZGVkLmFkZChub2RlKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIHVwZGF0ZShub2RlOiBNaXJyb3JlZENvbGxlY3Rpb25UZXN0SXRlbSk6IHZvaWQge1xuXHRcdE9iamVjdC5hc3NpZ24obm9kZS5yZXZpdmVkLCBDb252ZXJ0LlRlc3RJdGVtLnRvUGxhaW4obm9kZS5pdGVtKSk7XG5cdFx0aWYgKCF0aGlzLmFkZGVkLmhhcyhub2RlKSkge1xuXHRcdFx0dGhpcy51cGRhdGVkLmFkZChub2RlKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyByZW1vdmUobm9kZTogTWlycm9yZWRDb2xsZWN0aW9uVGVzdEl0ZW0pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5hZGRlZC5oYXMobm9kZSkpIHtcblx0XHRcdHRoaXMuYWRkZWQuZGVsZXRlKG5vZGUpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlZC5kZWxldGUobm9kZSk7XG5cblx0XHRjb25zdCBwYXJlbnRJZCA9IFRlc3RJZC5wYXJlbnRJZChub2RlLml0ZW0uZXh0SWQpO1xuXHRcdGlmIChwYXJlbnRJZCAmJiB0aGlzLmFscmVhZHlSZW1vdmVkLmhhcyhwYXJlbnRJZC50b1N0cmluZygpKSkge1xuXHRcdFx0dGhpcy5hbHJlYWR5UmVtb3ZlZC5hZGQobm9kZS5pdGVtLmV4dElkKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnJlbW92ZWQuYWRkKG5vZGUpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgZ2V0Q2hhbmdlRXZlbnQoKTogdnNjb2RlLlRlc3RzQ2hhbmdlRXZlbnQge1xuXHRcdGNvbnN0IHsgYWRkZWQsIHVwZGF0ZWQsIHJlbW92ZWQgfSA9IHRoaXM7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGdldCBhZGRlZCgpIHsgcmV0dXJuIFsuLi5hZGRlZF0ubWFwKG4gPT4gbi5yZXZpdmVkKTsgfSxcblx0XHRcdGdldCB1cGRhdGVkKCkgeyByZXR1cm4gWy4uLnVwZGF0ZWRdLm1hcChuID0+IG4ucmV2aXZlZCk7IH0sXG5cdFx0XHRnZXQgcmVtb3ZlZCgpIHsgcmV0dXJuIFsuLi5yZW1vdmVkXS5tYXAobiA9PiBuLnJldml2ZWQpOyB9LFxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgY29tcGxldGUoKSB7XG5cdFx0aWYgKCF0aGlzLmlzRW1wdHkpIHtcblx0XHRcdHRoaXMuZW1pdHRlci5maXJlKHRoaXMuZ2V0Q2hhbmdlRXZlbnQoKSk7XG5cdFx0fVxuXHR9XG59XG5cbi8qKlxuICogTWFpbnRhaW5zIHRlc3RzIGluIHRoaXMgZXh0ZW5zaW9uIGhvc3Qgc2VudCBmcm9tIHRoZSBtYWluIHRocmVhZC5cbiAqIEBwcml2YXRlXG4gKi9cbmNsYXNzIE1pcnJvcmVkVGVzdENvbGxlY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdEluY3JlbWVudGFsVGVzdENvbGxlY3Rpb248TWlycm9yZWRDb2xsZWN0aW9uVGVzdEl0ZW0+IHtcblx0cHJpdmF0ZSBjaGFuZ2VFbWl0dGVyID0gbmV3IEVtaXR0ZXI8dnNjb2RlLlRlc3RzQ2hhbmdlRXZlbnQ+KCk7XG5cblx0LyoqXG5cdCAqIENoYW5nZSBlbWl0dGVyIHRoYXQgZmlyZXMgd2l0aCB0aGUgc2FtZSBzZW1hbnRpY3MgYXMgYFRlc3RPYnNlcnZlci5vbkRpZENoYW5nZVRlc3RzYC5cblx0ICovXG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZVRlc3RzID0gdGhpcy5jaGFuZ2VFbWl0dGVyLmV2ZW50O1xuXG5cdC8qKlxuXHQgKiBHZXRzIGEgbGlzdCBvZiByb290IHRlc3QgaXRlbXMuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IHJvb3RUZXN0cygpIHtcblx0XHRyZXR1cm4gdGhpcy5yb290cztcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBJZiB0aGUgdGVzdCBJRCBleGlzdHMsIHJldHVybnMgaXRzIHVuZGVybHlpbmcgSUQuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0TWlycm9yZWRUZXN0RGF0YUJ5SWQoaXRlbUlkOiBzdHJpbmcpIHtcblx0XHRyZXR1cm4gdGhpcy5pdGVtcy5nZXQoaXRlbUlkKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBJZiB0aGUgdGVzdCBpdGVtIGlzIGEgbWlycm9yZWQgdGVzdCBpdGVtLCByZXR1cm5zIGl0cyB1bmRlcmx5aW5nIElELlxuXHQgKi9cblx0cHVibGljIGdldE1pcnJvcmVkVGVzdERhdGFCeVJlZmVyZW5jZShpdGVtOiB2c2NvZGUuVGVzdEl0ZW0pIHtcblx0XHRyZXR1cm4gdGhpcy5pdGVtcy5nZXQoaXRlbS5pZCk7XG5cdH1cblxuXHQvKipcblx0ICogQG92ZXJyaWRlXG5cdCAqL1xuXHRwcm90ZWN0ZWQgY3JlYXRlSXRlbShpdGVtOiBJbnRlcm5hbFRlc3RJdGVtLCBwYXJlbnQ/OiBNaXJyb3JlZENvbGxlY3Rpb25UZXN0SXRlbSk6IE1pcnJvcmVkQ29sbGVjdGlvblRlc3RJdGVtIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4uaXRlbSxcblx0XHRcdC8vIHRvZG9AY29ubm9yNDMxMjogbWFrZSB0aGlzIHdvcmsgd2VsbCBhZ2FpbiB3aXRoIGNoaWxkcmVuXG5cdFx0XHRyZXZpdmVkOiBDb252ZXJ0LlRlc3RJdGVtLnRvUGxhaW4oaXRlbS5pdGVtKSBhcyB2c2NvZGUuVGVzdEl0ZW0sXG5cdFx0XHRkZXB0aDogcGFyZW50ID8gcGFyZW50LmRlcHRoICsgMSA6IDAsXG5cdFx0XHRjaGlsZHJlbjogbmV3IFNldCgpLFxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogQG92ZXJyaWRlXG5cdCAqL1xuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgY3JlYXRlQ2hhbmdlQ29sbGVjdG9yKCkge1xuXHRcdHJldHVybiBuZXcgTWlycm9yZWRDaGFuZ2VDb2xsZWN0b3IodGhpcy5jaGFuZ2VFbWl0dGVyKTtcblx0fVxufVxuXG5jbGFzcyBUZXN0T2JzZXJ2ZXJzIHtcblx0cHJpdmF0ZSBjdXJyZW50Pzoge1xuXHRcdG9ic2VydmVyczogbnVtYmVyO1xuXHRcdHRlc3RzOiBNaXJyb3JlZFRlc3RDb2xsZWN0aW9uO1xuXHR9O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcHJveHk6IE1haW5UaHJlYWRUZXN0aW5nU2hhcGUsXG5cdCkge1xuXHR9XG5cblx0cHVibGljIGNoZWNrb3V0KCk6IHZzY29kZS5UZXN0T2JzZXJ2ZXIge1xuXHRcdGlmICghdGhpcy5jdXJyZW50KSB7XG5cdFx0XHR0aGlzLmN1cnJlbnQgPSB0aGlzLmNyZWF0ZU9ic2VydmVyRGF0YSgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGN1cnJlbnQgPSB0aGlzLmN1cnJlbnQ7XG5cdFx0Y3VycmVudC5vYnNlcnZlcnMrKztcblxuXHRcdHJldHVybiB7XG5cdFx0XHRvbkRpZENoYW5nZVRlc3Q6IGN1cnJlbnQudGVzdHMub25EaWRDaGFuZ2VUZXN0cyxcblx0XHRcdGdldCB0ZXN0cygpIHsgcmV0dXJuIFsuLi5jdXJyZW50LnRlc3RzLnJvb3RUZXN0c10ubWFwKHQgPT4gdC5yZXZpdmVkKTsgfSxcblx0XHRcdGRpc3Bvc2U6IGNyZWF0ZVNpbmdsZUNhbGxGdW5jdGlvbigoKSA9PiB7XG5cdFx0XHRcdGlmICgtLWN1cnJlbnQub2JzZXJ2ZXJzID09PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm94eS4kdW5zdWJzY3JpYmVGcm9tRGlmZnMoKTtcblx0XHRcdFx0XHR0aGlzLmN1cnJlbnQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pLFxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogR2V0cyB0aGUgaW50ZXJuYWwgdGVzdCBkYXRhIGJ5IGl0cyByZWZlcmVuY2UuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0TWlycm9yZWRUZXN0RGF0YUJ5UmVmZXJlbmNlKHJlZjogdnNjb2RlLlRlc3RJdGVtKSB7XG5cdFx0cmV0dXJuIHRoaXMuY3VycmVudD8udGVzdHMuZ2V0TWlycm9yZWRUZXN0RGF0YUJ5UmVmZXJlbmNlKHJlZik7XG5cdH1cblxuXHQvKipcblx0ICogQXBwbGllcyB0ZXN0IGRpZmZzIHRvIHRoZSBjdXJyZW50IHNldCBvZiBvYnNlcnZlZCB0ZXN0cy5cblx0ICovXG5cdHB1YmxpYyBhcHBseURpZmYoZGlmZjogVGVzdHNEaWZmKSB7XG5cdFx0dGhpcy5jdXJyZW50Py50ZXN0cy5hcHBseShkaWZmKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlT2JzZXJ2ZXJEYXRhKCkge1xuXHRcdGNvbnN0IHRlc3RzID0gbmV3IE1pcnJvcmVkVGVzdENvbGxlY3Rpb24oeyBhc0Nhbm9uaWNhbFVyaTogdSA9PiB1IH0pO1xuXHRcdHRoaXMucHJveHkuJHN1YnNjcmliZVRvRGlmZnMoKTtcblx0XHRyZXR1cm4geyBvYnNlcnZlcnM6IDAsIHRlc3RzLCB9O1xuXHR9XG59XG5cbmNvbnN0IHVwZGF0ZVByb2ZpbGUgPSAoaW1wbDogVGVzdFJ1blByb2ZpbGVJbXBsLCBwcm94eTogTWFpblRocmVhZFRlc3RpbmdTaGFwZSwgaW5pdGlhbDogSVRlc3RSdW5Qcm9maWxlIHwgdW5kZWZpbmVkLCB1cGRhdGU6IFBhcnRpYWw8SVRlc3RSdW5Qcm9maWxlPikgPT4ge1xuXHRpZiAoaW5pdGlhbCkge1xuXHRcdE9iamVjdC5hc3NpZ24oaW5pdGlhbCwgdXBkYXRlKTtcblx0fSBlbHNlIHtcblx0XHRwcm94eS4kdXBkYXRlVGVzdFJ1bkNvbmZpZyhpbXBsLmNvbnRyb2xsZXJJZCwgaW1wbC5wcm9maWxlSWQsIHVwZGF0ZSk7XG5cdH1cbn07XG5cbmV4cG9ydCBjbGFzcyBUZXN0UnVuUHJvZmlsZUltcGwgZXh0ZW5kcyBUZXN0UnVuUHJvZmlsZUJhc2UgaW1wbGVtZW50cyB2c2NvZGUuVGVzdFJ1blByb2ZpbGUge1xuXHRyZWFkb25seSAjcHJveHk6IE1haW5UaHJlYWRUZXN0aW5nU2hhcGU7XG5cdHJlYWRvbmx5ICNhY3RpdmVQcm9maWxlczogU2V0PG51bWJlcj47XG5cdHJlYWRvbmx5ICNvbkRpZENoYW5nZURlZmF1bHRQcm9maWxlczogRXZlbnQ8RGVmYXVsdFByb2ZpbGVDaGFuZ2VFdmVudD47XG5cdCNpbml0aWFsUHVibGlzaD86IElUZXN0UnVuUHJvZmlsZTtcblx0I3Byb2ZpbGVzPzogTWFwPG51bWJlciwgdnNjb2RlLlRlc3RSdW5Qcm9maWxlPjtcblx0cHJpdmF0ZSBfY29uZmlndXJlSGFuZGxlcj86ICgoKSA9PiB2b2lkKTtcblxuXHRwdWJsaWMgZ2V0IGxhYmVsKCkge1xuXHRcdHJldHVybiB0aGlzLl9sYWJlbDtcblx0fVxuXG5cdHB1YmxpYyBzZXQgbGFiZWwobGFiZWw6IHN0cmluZykge1xuXHRcdGlmIChsYWJlbCAhPT0gdGhpcy5fbGFiZWwpIHtcblx0XHRcdHRoaXMuX2xhYmVsID0gbGFiZWw7XG5cdFx0XHR1cGRhdGVQcm9maWxlKHRoaXMsIHRoaXMuI3Byb3h5LCB0aGlzLiNpbml0aWFsUHVibGlzaCwgeyBsYWJlbCB9KTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHN1cHBvcnRzQ29udGludW91c1J1bigpIHtcblx0XHRyZXR1cm4gdGhpcy5fc3VwcG9ydHNDb250aW51b3VzUnVuO1xuXHR9XG5cblx0cHVibGljIHNldCBzdXBwb3J0c0NvbnRpbnVvdXNSdW4oc3VwcG9ydHM6IGJvb2xlYW4pIHtcblx0XHRpZiAoc3VwcG9ydHMgIT09IHRoaXMuX3N1cHBvcnRzQ29udGludW91c1J1bikge1xuXHRcdFx0dGhpcy5fc3VwcG9ydHNDb250aW51b3VzUnVuID0gc3VwcG9ydHM7XG5cdFx0XHR1cGRhdGVQcm9maWxlKHRoaXMsIHRoaXMuI3Byb3h5LCB0aGlzLiNpbml0aWFsUHVibGlzaCwgeyBzdXBwb3J0c0NvbnRpbnVvdXNSdW46IHN1cHBvcnRzIH0pO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXQgaXNEZWZhdWx0KCkge1xuXHRcdHJldHVybiB0aGlzLiNhY3RpdmVQcm9maWxlcy5oYXModGhpcy5wcm9maWxlSWQpO1xuXHR9XG5cblx0cHVibGljIHNldCBpc0RlZmF1bHQoaXNEZWZhdWx0OiBib29sZWFuKSB7XG5cdFx0aWYgKGlzRGVmYXVsdCAhPT0gdGhpcy5pc0RlZmF1bHQpIHtcblx0XHRcdC8vICNhY3RpdmVQcm9maWxlcyBpcyBzeW5jZWQgZnJvbSB0aGUgbWFpbiB0aHJlYWQsIHNvIHdlIGNhbiBtYWtlXG5cdFx0XHQvLyBwcm92aXNpb25hbCBjaGFuZ2VzIGhlcmUgdGhhdCB3aWxsIGdldCBjb25maXJtZWQgbW9tZW50YXJpbHlcblx0XHRcdGlmIChpc0RlZmF1bHQpIHtcblx0XHRcdFx0dGhpcy4jYWN0aXZlUHJvZmlsZXMuYWRkKHRoaXMucHJvZmlsZUlkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuI2FjdGl2ZVByb2ZpbGVzLmRlbGV0ZSh0aGlzLnByb2ZpbGVJZCk7XG5cdFx0XHR9XG5cblx0XHRcdHVwZGF0ZVByb2ZpbGUodGhpcywgdGhpcy4jcHJveHksIHRoaXMuI2luaXRpYWxQdWJsaXNoLCB7IGlzRGVmYXVsdCB9KTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHRhZygpIHtcblx0XHRyZXR1cm4gdGhpcy5fdGFnO1xuXHR9XG5cblx0cHVibGljIHNldCB0YWcodGFnOiB2c2NvZGUuVGVzdFRhZyB8IHVuZGVmaW5lZCkge1xuXHRcdGlmICh0YWc/LmlkICE9PSB0aGlzLl90YWc/LmlkKSB7XG5cdFx0XHR0aGlzLl90YWcgPSB0YWc7XG5cdFx0XHR1cGRhdGVQcm9maWxlKHRoaXMsIHRoaXMuI3Byb3h5LCB0aGlzLiNpbml0aWFsUHVibGlzaCwge1xuXHRcdFx0XHR0YWc6IHRhZyA/IENvbnZlcnQuVGVzdFRhZy5uYW1lc3BhY2UodGhpcy5jb250cm9sbGVySWQsIHRhZy5pZCkgOiBudWxsLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldCBjb25maWd1cmVIYW5kbGVyKCkge1xuXHRcdHJldHVybiB0aGlzLl9jb25maWd1cmVIYW5kbGVyO1xuXHR9XG5cblx0cHVibGljIHNldCBjb25maWd1cmVIYW5kbGVyKGhhbmRsZXI6IHVuZGVmaW5lZCB8ICgoKSA9PiB2b2lkKSkge1xuXHRcdGlmIChoYW5kbGVyICE9PSB0aGlzLl9jb25maWd1cmVIYW5kbGVyKSB7XG5cdFx0XHR0aGlzLl9jb25maWd1cmVIYW5kbGVyID0gaGFuZGxlcjtcblx0XHRcdHVwZGF0ZVByb2ZpbGUodGhpcywgdGhpcy4jcHJveHksIHRoaXMuI2luaXRpYWxQdWJsaXNoLCB7IGhhc0NvbmZpZ3VyYXRpb25IYW5kbGVyOiAhIWhhbmRsZXIgfSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldCBvbkRpZENoYW5nZURlZmF1bHQoKSB7XG5cdFx0cmV0dXJuIEV2ZW50LmNoYWluKHRoaXMuI29uRGlkQ2hhbmdlRGVmYXVsdFByb2ZpbGVzLCAkID0+ICRcblx0XHRcdC5tYXAoZXYgPT4gZXYuZ2V0KHRoaXMuY29udHJvbGxlcklkKT8uZ2V0KHRoaXMucHJvZmlsZUlkKSlcblx0XHRcdC5maWx0ZXIoaXNEZWZpbmVkKVxuXHRcdCk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm94eTogTWFpblRocmVhZFRlc3RpbmdTaGFwZSxcblx0XHRwcm9maWxlczogTWFwPG51bWJlciwgdnNjb2RlLlRlc3RSdW5Qcm9maWxlPixcblx0XHRhY3RpdmVQcm9maWxlczogU2V0PG51bWJlcj4sXG5cdFx0b25EaWRDaGFuZ2VBY3RpdmVQcm9maWxlczogRXZlbnQ8RGVmYXVsdFByb2ZpbGVDaGFuZ2VFdmVudD4sXG5cdFx0Y29udHJvbGxlcklkOiBzdHJpbmcsXG5cdFx0cHJvZmlsZUlkOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSBfbGFiZWw6IHN0cmluZyxcblx0XHRraW5kOiB2c2NvZGUuVGVzdFJ1blByb2ZpbGVLaW5kLFxuXHRcdHB1YmxpYyBydW5IYW5kbGVyOiAocmVxdWVzdDogdnNjb2RlLlRlc3RSdW5SZXF1ZXN0LCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKSA9PiBUaGVuYWJsZTx2b2lkPiB8IHZvaWQsXG5cdFx0X2lzRGVmYXVsdCA9IGZhbHNlLFxuXHRcdHB1YmxpYyBfdGFnOiB2c2NvZGUuVGVzdFRhZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIF9zdXBwb3J0c0NvbnRpbnVvdXNSdW4gPSBmYWxzZSxcblx0KSB7XG5cdFx0c3VwZXIoY29udHJvbGxlcklkLCBwcm9maWxlSWQsIGtpbmQpO1xuXG5cdFx0dGhpcy4jcHJveHkgPSBwcm94eTtcblx0XHR0aGlzLiNwcm9maWxlcyA9IHByb2ZpbGVzO1xuXHRcdHRoaXMuI2FjdGl2ZVByb2ZpbGVzID0gYWN0aXZlUHJvZmlsZXM7XG5cdFx0dGhpcy4jb25EaWRDaGFuZ2VEZWZhdWx0UHJvZmlsZXMgPSBvbkRpZENoYW5nZUFjdGl2ZVByb2ZpbGVzO1xuXHRcdHByb2ZpbGVzLnNldChwcm9maWxlSWQsIHRoaXMpO1xuXG5cdFx0Y29uc3QgZ3JvdXBCaXRzZXQgPSBDb252ZXJ0LlRlc3RSdW5Qcm9maWxlS2luZC5mcm9tKGtpbmQpO1xuXHRcdGlmIChfaXNEZWZhdWx0KSB7XG5cdFx0XHRhY3RpdmVQcm9maWxlcy5hZGQocHJvZmlsZUlkKTtcblx0XHR9XG5cblx0XHR0aGlzLiNpbml0aWFsUHVibGlzaCA9IHtcblx0XHRcdHByb2ZpbGVJZDogcHJvZmlsZUlkLFxuXHRcdFx0Y29udHJvbGxlcklkLFxuXHRcdFx0dGFnOiBfdGFnID8gQ29udmVydC5UZXN0VGFnLm5hbWVzcGFjZSh0aGlzLmNvbnRyb2xsZXJJZCwgX3RhZy5pZCkgOiBudWxsLFxuXHRcdFx0bGFiZWw6IF9sYWJlbCxcblx0XHRcdGdyb3VwOiBncm91cEJpdHNldCxcblx0XHRcdGlzRGVmYXVsdDogX2lzRGVmYXVsdCxcblx0XHRcdGhhc0NvbmZpZ3VyYXRpb25IYW5kbGVyOiBmYWxzZSxcblx0XHRcdHN1cHBvcnRzQ29udGludW91c1J1bjogX3N1cHBvcnRzQ29udGludW91c1J1bixcblx0XHR9O1xuXG5cdFx0Ly8gd2Ugc2VuZCB0aGUgaW5pdGlhbCBwcm9maWxlIHB1Ymxpc2ggb3V0IG9uIHRoZSBuZXh0IG1pY3JvdGFzayBzbyB0aGF0XG5cdFx0Ly8gaW5pdGlhbGx5IHNldHRpbmcgdGhlIGlzRGVmYXVsdCB2YWx1ZSBkb2Vzbid0IG92ZXJ3cml0ZSBhIHVzZXItY29uZmlndXJlZCB2YWx1ZVxuXHRcdHF1ZXVlTWljcm90YXNrKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLiNpbml0aWFsUHVibGlzaCkge1xuXHRcdFx0XHR0aGlzLiNwcm94eS4kcHVibGlzaFRlc3RSdW5Qcm9maWxlKHRoaXMuI2luaXRpYWxQdWJsaXNoKTtcblx0XHRcdFx0dGhpcy4jaW5pdGlhbFB1Ymxpc2ggPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLiNwcm9maWxlcz8uZGVsZXRlKHRoaXMucHJvZmlsZUlkKSkge1xuXHRcdFx0dGhpcy4jcHJvZmlsZXMgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLiNwcm94eS4kcmVtb3ZlVGVzdFByb2ZpbGUodGhpcy5jb250cm9sbGVySWQsIHRoaXMucHJvZmlsZUlkKTtcblx0XHR9XG5cdFx0dGhpcy4jaW5pdGlhbFB1Ymxpc2ggPSB1bmRlZmluZWQ7XG5cdH1cbn1cblxuZnVuY3Rpb24gZmluZFRlc3RJblJlc3VsdFNuYXBzaG90KGV4dElkOiBUZXN0SWQsIHNuYXBzaG90OiByZWFkb25seSBSZWFkb25seTx2c2NvZGUuVGVzdFJlc3VsdFNuYXBzaG90PltdKSB7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgZXh0SWQucGF0aC5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IGl0ZW0gPSBzbmFwc2hvdC5maW5kKHMgPT4gcy5pZCA9PT0gZXh0SWQucGF0aFtpXSk7XG5cdFx0aWYgKCFpdGVtKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmIChpID09PSBleHRJZC5wYXRoLmxlbmd0aCAtIDEpIHtcblx0XHRcdHJldHVybiBpdGVtO1xuXHRcdH1cblxuXHRcdHNuYXBzaG90ID0gaXRlbS5jaGlsZHJlbjtcblx0fVxuXG5cdHJldHVybiB1bmRlZmluZWQ7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQVFBLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsbUJBQW1CLCtCQUErQjtBQUMzRCxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLFlBQVk7QUFDckIsU0FBUyxZQUFZLGlCQUFpQixvQkFBb0I7QUFDMUQsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxXQUEwQjtBQUNuQyxTQUFTLG9CQUFvQjtBQUc3QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLFFBQVEsb0JBQW9CO0FBQ3JDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsbUNBQTRULDBCQUFtRixpQkFBNEIsYUFBYSw4QkFBOEI7QUFDL2QsU0FBUywrQkFBK0I7QUFDeEMsU0FBNEMsbUJBQTJDO0FBQ3ZGLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsMkJBQTJCLGNBQWMsa0JBQWtCLHlCQUF5QjtBQUM3RixZQUFZLGFBQWE7QUFDekIsU0FBUyxjQUFjLG9CQUFvQixzQkFBc0I7QUFhakUsSUFBSSxrQkFBa0I7QUFFdEIsTUFBTSx3QkFBd0Isb0JBQUksUUFBc0M7QUFFakUsTUFBTSxrQkFBa0IsZ0JBQWlDLGlCQUFpQjtBQUsxRSxJQUFNLGlCQUFOLGNBQTZCLFdBQTBDO0FBQUEsRUFlN0UsWUFDcUIsS0FDVSxZQUNLLFVBQ1csU0FDN0M7QUFDRCxVQUFNO0FBSndCO0FBQ0s7QUFDVztBQWhCL0MsU0FBaUIsd0JBQXdCLEtB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LEVBa0RBLFVBQWdCO0FBQ2YsUUFBSSxLQUFLLFdBQVcsT0FBTyxLQUFLLFNBQVMsR0FBRztBQUMzQyxXQUFLLFlBQVk7QUFDakIsV0FBSyxPQUFPLG1CQUFtQixLQUFLLGNBQWMsS0FBSyxTQUFTO0FBQUEsSUFDakU7QUFDQSxTQUFLLGtCQUFrQjtBQUFBLEVBQ3hCO0FBQ0Q7QUFFQSxTQUFTLHlCQUF5QixPQUFlLFVBQTBEO0FBQzFHLFdBQVMsSUFBSSxHQUFHLElBQUksTUFBTSxLQUFLLFFBQVEsS0FBSztBQUMzQyxVQUFNLE9BQU8sU0FBUyxLQUFLLE9BQUssRUFBRSxPQUFPLE1BQU0sS0FBSyxDQUFDLENBQUM7QUFDdEQsUUFBSSxDQUFDLE1BQU07QUFDVixhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksTUFBTSxNQUFNLEtBQUssU0FBUyxHQUFHO0FBQ2hDLGFBQU87QUFBQSxJQUNSO0FBRUEsZUFBVyxLQUFLO0FBQUEsRUFDakI7QUFFQSxTQUFPO0FBQ1I7IiwKICAibmFtZXMiOiBbImxhYmVsIiwgInIiLCAiVGVzdFJ1blRyYWNrZXJTdGF0ZSJdCn0K
