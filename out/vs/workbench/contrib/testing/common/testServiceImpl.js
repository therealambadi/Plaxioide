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
import { groupBy } from "../../../../base/common/arrays.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter } from "../../../../base/common/event.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { isDefined } from "../../../../base/common/types.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { bindContextKey } from "../../../../platform/observable/common/platformObservableUtils.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceTrustRequestService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { getTestingConfiguration, TestingConfigKeys } from "./configuration.js";
import { MainThreadTestCollection } from "./mainThreadTestCollection.js";
import { MutableObservableValue } from "./observableValue.js";
import { StoredValue } from "./storedValue.js";
import { TestExclusions } from "./testExclusions.js";
import { TestId } from "./testId.js";
import { TestingContextKeys } from "./testingContextKeys.js";
import { canUseProfileWithTest, ITestProfileService } from "./testProfileService.js";
import { ITestResultService } from "./testResultService.js";
import { TestControllerCapability, TestDiffOpType } from "./testTypes.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
let TestService = class extends Disposable {
  constructor(contextKeyService, instantiationService, uriIdentityService, storage, editorService, testProfiles, notificationService, configurationService, testResults, workspaceTrustRequestService) {
    super();
    this.uriIdentityService = uriIdentityService;
    this.storage = storage;
    this.editorService = editorService;
    this.testProfiles = testProfiles;
    this.notificationService = notificationService;
    this.configurationService = configurationService;
    this.testResults = testResults;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
    this.testControllers = observableValue("testControllers", /* @__PURE__ */ new Map());
    this.testExtHosts = /* @__PURE__ */ new Set();
    this.cancelExtensionTestRunEmitter = new Emitter();
    this.willProcessDiffEmitter = new Emitter();
    this.didProcessDiffEmitter = new Emitter();
    this.testRefreshCancellations = /* @__PURE__ */ new Set();
    /**
     * Cancellation for runs requested by the user being managed by the UI.
     * Test runs initiated by extensions are not included here.
     */
    this.uiRunningTests = /* @__PURE__ */ new Map();
    /**
     * @inheritdoc
     */
    this.onWillProcessDiff = this.willProcessDiffEmitter.event;
    /**
     * @inheritdoc
     */
    this.onDidProcessDiff = this.didProcessDiffEmitter.event;
    /**
     * @inheritdoc
     */
    this.onDidCancelTestRun = this.cancelExtensionTestRunEmitter.event;
    /**
     * @inheritdoc
     */
    this.collection = new MainThreadTestCollection(this.uriIdentityService, this.expandTest.bind(this));
    /**
     * @inheritdoc
     */
    this.showInlineOutput = this._register(MutableObservableValue.stored(new StoredValue({
      key: "inlineTestOutputVisible",
      scope: StorageScope.WORKSPACE,
      target: StorageTarget.USER
    }, this.storage), true));
    this.excluded = instantiationService.createInstance(TestExclusions);
    this.isRefreshingTests = TestingContextKeys.isRefreshingTests.bindTo(contextKeyService);
    this.activeEditorHasTests = TestingContextKeys.activeEditorHasTests.bindTo(contextKeyService);
    this._register(bindContextKey(
      TestingContextKeys.providerCount,
      contextKeyService,
      (reader) => this.testControllers.read(reader).size
    ));
    const bindCapability = (key, capability) => this._register(bindContextKey(
      key,
      contextKeyService,
      (reader) => Iterable.some(
        this.testControllers.read(reader).values(),
        (ctrl) => !!(ctrl.capabilities.read(reader) & capability)
      )
    ));
    bindCapability(TestingContextKeys.canRefreshTests, TestControllerCapability.Refresh);
    bindCapability(TestingContextKeys.canGoToRelatedCode, TestControllerCapability.CodeRelatedToTest);
    bindCapability(TestingContextKeys.canGoToRelatedTest, TestControllerCapability.TestRelatedToCode);
    this._register(editorService.onDidActiveEditorChange(() => this.updateEditorContextKeys()));
  }
  /**
   * @inheritdoc
   */
  async expandTest(id, levels) {
    await this.testControllers.get().get(TestId.fromString(id).controllerId)?.expandTest(id, levels);
  }
  /**
   * @inheritdoc
   */
  cancelTestRun(runId, taskId) {
    this.cancelExtensionTestRunEmitter.fire({ runId, taskId });
    if (runId === void 0) {
      for (const runCts of this.uiRunningTests.values()) {
        runCts.cancel();
      }
    } else if (!taskId) {
      this.uiRunningTests.get(runId)?.cancel();
    }
  }
  /**
   * @inheritdoc
   */
  async runTests(req, token = CancellationToken.None) {
    const byProfile = [];
    for (const test of req.tests) {
      const existing = byProfile.find((p) => canUseProfileWithTest(p.profile, test));
      if (existing) {
        existing.tests.push(test);
        continue;
      }
      const bestProfile = this.testProfiles.getDefaultProfileForTest(req.group, test);
      if (!bestProfile) {
        continue;
      }
      byProfile.push({ profile: bestProfile, tests: [test] });
    }
    const resolved = {
      targets: byProfile.map(({ profile, tests }) => ({
        profileId: profile.profileId,
        controllerId: tests[0].controllerId,
        testIds: tests.map((t) => t.item.extId)
      })),
      group: req.group,
      exclude: req.exclude?.map((t) => t.item.extId),
      continuous: req.continuous
    };
    if (resolved.targets.length === 0) {
      for (const byController of groupBy(req.tests, (a, b) => a.controllerId === b.controllerId ? 0 : 1)) {
        const profiles = this.testProfiles.getControllerProfiles(byController[0].controllerId);
        const withControllers = byController.map((test) => ({
          profile: profiles.find((p) => p.group === req.group && canUseProfileWithTest(p, test)),
          test
        }));
        for (const byProfile2 of groupBy(withControllers, (a, b) => a.profile === b.profile ? 0 : 1)) {
          const profile = byProfile2[0].profile;
          if (profile) {
            resolved.targets.push({
              testIds: byProfile2.map((t) => t.test.item.extId),
              profileId: profile.profileId,
              controllerId: profile.controllerId
            });
          }
        }
      }
    }
    return this.runResolvedTests(resolved, token);
  }
  /** @inheritdoc */
  async startContinuousRun(req, token) {
    if (!req.exclude) {
      req.exclude = [...this.excluded.all];
    }
    const trust = await this.workspaceTrustRequestService.requestWorkspaceTrust({
      message: localize("testTrust", "Running tests may execute code in your workspace.")
    });
    if (!trust) {
      return;
    }
    const byController = groupBy(req.targets, (a, b) => a.controllerId.localeCompare(b.controllerId));
    const requests = byController.map(
      (group) => this.getTestController(group[0].controllerId)?.startContinuousRun(
        group.map((controlReq) => ({
          excludeExtIds: req.exclude.filter((t) => !controlReq.testIds.includes(t)),
          profileId: controlReq.profileId,
          controllerId: controlReq.controllerId,
          testIds: controlReq.testIds
        })),
        token
      ).then((result) => {
        const errs = result.map((r) => r.error).filter(isDefined);
        if (errs.length) {
          this.notificationService.error(localize("testError", "An error occurred attempting to run tests: {0}", errs.join(" ")));
        }
      })
    );
    await Promise.all(requests);
  }
  /**
   * @inheritdoc
   */
  async runResolvedTests(req, token = CancellationToken.None) {
    if (!req.exclude) {
      req.exclude = [...this.excluded.all];
    }
    const result = this.testResults.createLiveResult(req);
    const trust = await this.workspaceTrustRequestService.requestWorkspaceTrust({
      message: localize("testTrust", "Running tests may execute code in your workspace.")
    });
    if (!trust) {
      result.markComplete();
      return result;
    }
    try {
      const cancelSource = new CancellationTokenSource(token);
      this.uiRunningTests.set(result.id, cancelSource);
      const byController = groupBy(req.targets, (a, b) => a.controllerId.localeCompare(b.controllerId));
      const requests = byController.map(
        (group) => this.getTestController(group[0].controllerId)?.runTests(
          group.map((controlReq) => ({
            runId: result.id,
            excludeExtIds: req.exclude.filter((t) => !controlReq.testIds.includes(t)),
            profileId: controlReq.profileId,
            controllerId: controlReq.controllerId,
            testIds: controlReq.testIds
          })),
          cancelSource.token
        ).then((result2) => {
          const errs = result2.map((r) => r.error).filter(isDefined);
          if (errs.length) {
            this.notificationService.error(localize("testError", "An error occurred attempting to run tests: {0}", errs.join(" ")));
          }
        })
      );
      await this.saveAllBeforeTest(req);
      await Promise.all(requests);
      return result;
    } finally {
      this.uiRunningTests.delete(result.id);
      result.markComplete();
    }
  }
  /**
   * @inheritdoc
   */
  async provideTestFollowups(req, token) {
    const reqs = await Promise.all([...this.testExtHosts].map(async (ctrl) => ({ ctrl, followups: await ctrl.provideTestFollowups(req, token) })));
    const followups = {
      followups: reqs.flatMap(({ ctrl, followups: followups2 }) => followups2.map((f) => ({
        message: f.title,
        execute: () => ctrl.executeTestFollowup(f.id)
      }))),
      dispose: () => {
        for (const { ctrl, followups: followups2 } of reqs) {
          ctrl.disposeTestFollowups(followups2.map((f) => f.id));
        }
      }
    };
    if (token.isCancellationRequested) {
      followups.dispose();
    }
    return followups;
  }
  /**
   * @inheritdoc
   */
  publishDiff(_controllerId, diff) {
    this.willProcessDiffEmitter.fire(diff);
    this.collection.apply(diff);
    this.updateEditorContextKeys();
    this.didProcessDiffEmitter.fire(diff);
  }
  /**
   * @inheritdoc
   */
  getTestController(id) {
    return this.testControllers.get().get(id);
  }
  /**
   * @inheritdoc
   */
  async syncTests() {
    const cts = new CancellationTokenSource();
    try {
      await Promise.all([...this.testControllers.get().values()].map((c) => c.syncTests(cts.token)));
    } finally {
      cts.dispose(true);
    }
  }
  /**
   * @inheritdoc
   */
  async refreshTests(controllerId) {
    const cts = new CancellationTokenSource();
    this.testRefreshCancellations.add(cts);
    this.isRefreshingTests.set(true);
    try {
      if (controllerId) {
        await this.getTestController(controllerId)?.refreshTests(cts.token);
      } else {
        await Promise.all([...this.testControllers.get().values()].map((c) => c.refreshTests(cts.token)));
      }
    } finally {
      this.testRefreshCancellations.delete(cts);
      this.isRefreshingTests.set(this.testRefreshCancellations.size > 0);
      cts.dispose(true);
    }
  }
  /**
   * @inheritdoc
   */
  cancelRefreshTests() {
    for (const cts of this.testRefreshCancellations) {
      cts.cancel();
    }
    this.testRefreshCancellations.clear();
    this.isRefreshingTests.set(false);
  }
  /**
   * @inheritdoc
   */
  registerExtHost(controller) {
    this.testExtHosts.add(controller);
    return toDisposable(() => this.testExtHosts.delete(controller));
  }
  /**
   * @inheritdoc
   */
  async getTestsRelatedToCode(uri, position, token = CancellationToken.None) {
    const testIds = await Promise.all([...this.testExtHosts.values()].map((v) => v.getTestsRelatedToCode(uri, position, token)));
    return testIds.flatMap((ids) => ids.map((id) => this.collection.getNodeById(id))).filter(isDefined);
  }
  /**
   * @inheritdoc
   */
  registerTestController(id, controller) {
    this.testControllers.set(new Map(this.testControllers.get()).set(id, controller), void 0);
    return toDisposable(() => {
      const diff = [];
      for (const root of this.collection.rootItems) {
        if (root.controllerId === id) {
          diff.push({ op: TestDiffOpType.Remove, itemId: root.item.extId });
        }
      }
      this.publishDiff(id, diff);
      const next = new Map(this.testControllers.get());
      next.delete(id);
      this.testControllers.set(next, void 0);
    });
  }
  /**
   * @inheritdoc
   */
  async getCodeRelatedToTest(test, token = CancellationToken.None) {
    return await this.testControllers.get().get(test.controllerId)?.getRelatedCode(test.item.extId, token) || [];
  }
  updateEditorContextKeys() {
    const uri = this.editorService.activeEditor?.resource;
    if (uri) {
      this.activeEditorHasTests.set(!Iterable.isEmpty(this.collection.getNodeByUrl(uri)));
    } else {
      this.activeEditorHasTests.set(false);
    }
  }
  async saveAllBeforeTest(req, configurationService = this.configurationService, editorService = this.editorService) {
    if (req.preserveFocus === true) {
      return;
    }
    const saveBeforeTest = getTestingConfiguration(this.configurationService, TestingConfigKeys.SaveBeforeTest);
    if (saveBeforeTest) {
      await editorService.saveAll();
    }
    return;
  }
};
TestService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IUriIdentityService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, ITestProfileService),
  __decorateParam(6, INotificationService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, ITestResultService),
  __decorateParam(9, IWorkspaceTrustRequestService)
], TestService);
export {
  TestService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2NvbW1vbi90ZXN0U2VydmljZUltcGwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBncm91cEJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IG9ic2VydmFibGVWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgaXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IExvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgYmluZENvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vYnNlcnZhYmxlL2NvbW1vbi9wbGF0Zm9ybU9ic2VydmFibGVVdGlscy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlVHJ1c3QuanMnO1xuaW1wb3J0IHsgZ2V0VGVzdGluZ0NvbmZpZ3VyYXRpb24sIFRlc3RpbmdDb25maWdLZXlzIH0gZnJvbSAnLi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IE1haW5UaHJlYWRUZXN0Q29sbGVjdGlvbiB9IGZyb20gJy4vbWFpblRocmVhZFRlc3RDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IE11dGFibGVPYnNlcnZhYmxlVmFsdWUgfSBmcm9tICcuL29ic2VydmFibGVWYWx1ZS5qcyc7XG5pbXBvcnQgeyBTdG9yZWRWYWx1ZSB9IGZyb20gJy4vc3RvcmVkVmFsdWUuanMnO1xuaW1wb3J0IHsgVGVzdEV4Y2x1c2lvbnMgfSBmcm9tICcuL3Rlc3RFeGNsdXNpb25zLmpzJztcbmltcG9ydCB7IFRlc3RJZCB9IGZyb20gJy4vdGVzdElkLmpzJztcbmltcG9ydCB7IFRlc3RpbmdDb250ZXh0S2V5cyB9IGZyb20gJy4vdGVzdGluZ0NvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IGNhblVzZVByb2ZpbGVXaXRoVGVzdCwgSVRlc3RQcm9maWxlU2VydmljZSB9IGZyb20gJy4vdGVzdFByb2ZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXN0UmVzdWx0IH0gZnJvbSAnLi90ZXN0UmVzdWx0LmpzJztcbmltcG9ydCB7IElUZXN0UmVzdWx0U2VydmljZSB9IGZyb20gJy4vdGVzdFJlc3VsdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQW1iaWd1b3VzUnVuVGVzdHNSZXF1ZXN0LCBJTWFpblRocmVhZFRlc3RDb250cm9sbGVyLCBJTWFpblRocmVhZFRlc3RIb3N0UHJveHksIElUZXN0Rm9sbG93dXBzLCBJVGVzdFNlcnZpY2UgfSBmcm9tICcuL3Rlc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEludGVybmFsVGVzdEl0ZW0sIElUZXN0UnVuUHJvZmlsZSwgUmVzb2x2ZWRUZXN0UnVuUmVxdWVzdCwgVGVzdENvbnRyb2xsZXJDYXBhYmlsaXR5LCBUZXN0RGlmZk9wVHlwZSwgVGVzdE1lc3NhZ2VGb2xsb3d1cFJlcXVlc3QsIFRlc3RzRGlmZiB9IGZyb20gJy4vdGVzdFR5cGVzLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFRlc3RTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUZXN0U2VydmljZSB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRwcml2YXRlIHRlc3RDb250cm9sbGVycyA9IG9ic2VydmFibGVWYWx1ZTxSZWFkb25seU1hcDxzdHJpbmcsIElNYWluVGhyZWFkVGVzdENvbnRyb2xsZXI+PigndGVzdENvbnRyb2xsZXJzJywgbmV3IE1hcDxzdHJpbmcsIElNYWluVGhyZWFkVGVzdENvbnRyb2xsZXI+KCkpO1xuXHRwcml2YXRlIHRlc3RFeHRIb3N0cyA9IG5ldyBTZXQ8SU1haW5UaHJlYWRUZXN0SG9zdFByb3h5PigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY2FuY2VsRXh0ZW5zaW9uVGVzdFJ1bkVtaXR0ZXIgPSBuZXcgRW1pdHRlcjx7IHJ1bklkOiBzdHJpbmcgfCB1bmRlZmluZWQ7IHRhc2tJZDogc3RyaW5nIHwgdW5kZWZpbmVkIH0+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgd2lsbFByb2Nlc3NEaWZmRW1pdHRlciA9IG5ldyBFbWl0dGVyPFRlc3RzRGlmZj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBkaWRQcm9jZXNzRGlmZkVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxUZXN0c0RpZmY+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgdGVzdFJlZnJlc2hDYW5jZWxsYXRpb25zID0gbmV3IFNldDxDYW5jZWxsYXRpb25Ub2tlblNvdXJjZT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBpc1JlZnJlc2hpbmdUZXN0czogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgYWN0aXZlRWRpdG9ySGFzVGVzdHM6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdC8qKlxuXHQgKiBDYW5jZWxsYXRpb24gZm9yIHJ1bnMgcmVxdWVzdGVkIGJ5IHRoZSB1c2VyIGJlaW5nIG1hbmFnZWQgYnkgdGhlIFVJLlxuXHQgKiBUZXN0IHJ1bnMgaW5pdGlhdGVkIGJ5IGV4dGVuc2lvbnMgYXJlIG5vdCBpbmNsdWRlZCBoZXJlLlxuXHQgKi9cblx0cHJpdmF0ZSByZWFkb25seSB1aVJ1bm5pbmdUZXN0cyA9IG5ldyBNYXA8c3RyaW5nIC8qIHJ1biBJRCAqLywgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U+KCk7XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgb25XaWxsUHJvY2Vzc0RpZmYgPSB0aGlzLndpbGxQcm9jZXNzRGlmZkVtaXR0ZXIuZXZlbnQ7XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRQcm9jZXNzRGlmZiA9IHRoaXMuZGlkUHJvY2Vzc0RpZmZFbWl0dGVyLmV2ZW50O1xuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2FuY2VsVGVzdFJ1biA9IHRoaXMuY2FuY2VsRXh0ZW5zaW9uVGVzdFJ1bkVtaXR0ZXIuZXZlbnQ7XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgY29sbGVjdGlvbiA9IG5ldyBNYWluVGhyZWFkVGVzdENvbGxlY3Rpb24odGhpcy51cmlJZGVudGl0eVNlcnZpY2UsIHRoaXMuZXhwYW5kVGVzdC5iaW5kKHRoaXMpKTtcblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyByZWFkb25seSBleGNsdWRlZDogVGVzdEV4Y2x1c2lvbnM7XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgc2hvd0lubGluZU91dHB1dCA9IHRoaXMuX3JlZ2lzdGVyKE11dGFibGVPYnNlcnZhYmxlVmFsdWUuc3RvcmVkKG5ldyBTdG9yZWRWYWx1ZTxib29sZWFuPih7XG5cdFx0a2V5OiAnaW5saW5lVGVzdE91dHB1dFZpc2libGUnLFxuXHRcdHNjb3BlOiBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLFxuXHRcdHRhcmdldDogU3RvcmFnZVRhcmdldC5VU0VSXG5cdH0sIHRoaXMuc3RvcmFnZSksIHRydWUpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElUZXN0UHJvZmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXN0UHJvZmlsZXM6IElUZXN0UHJvZmlsZVNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUZXN0UmVzdWx0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlc3RSZXN1bHRzOiBJVGVzdFJlc3VsdFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZTogSVdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5leGNsdWRlZCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RFeGNsdXNpb25zKTtcblx0XHR0aGlzLmlzUmVmcmVzaGluZ1Rlc3RzID0gVGVzdGluZ0NvbnRleHRLZXlzLmlzUmVmcmVzaGluZ1Rlc3RzLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5hY3RpdmVFZGl0b3JIYXNUZXN0cyA9IFRlc3RpbmdDb250ZXh0S2V5cy5hY3RpdmVFZGl0b3JIYXNUZXN0cy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYmluZENvbnRleHRLZXkoVGVzdGluZ0NvbnRleHRLZXlzLnByb3ZpZGVyQ291bnQsIGNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0cmVhZGVyID0+IHRoaXMudGVzdENvbnRyb2xsZXJzLnJlYWQocmVhZGVyKS5zaXplKSk7XG5cblx0XHRjb25zdCBiaW5kQ2FwYWJpbGl0eSA9IChrZXk6IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4sIGNhcGFiaWxpdHk6IFRlc3RDb250cm9sbGVyQ2FwYWJpbGl0eSkgPT5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGJpbmRDb250ZXh0S2V5KGtleSwgY29udGV4dEtleVNlcnZpY2UsIHJlYWRlciA9PlxuXHRcdFx0XHRJdGVyYWJsZS5zb21lKFxuXHRcdFx0XHRcdHRoaXMudGVzdENvbnRyb2xsZXJzLnJlYWQocmVhZGVyKS52YWx1ZXMoKSxcblx0XHRcdFx0XHRjdHJsID0+ICEhKGN0cmwuY2FwYWJpbGl0aWVzLnJlYWQocmVhZGVyKSAmIGNhcGFiaWxpdHkpXG5cdFx0XHRcdCksXG5cdFx0XHQpKTtcblxuXHRcdGJpbmRDYXBhYmlsaXR5KFRlc3RpbmdDb250ZXh0S2V5cy5jYW5SZWZyZXNoVGVzdHMsIFRlc3RDb250cm9sbGVyQ2FwYWJpbGl0eS5SZWZyZXNoKTtcblx0XHRiaW5kQ2FwYWJpbGl0eShUZXN0aW5nQ29udGV4dEtleXMuY2FuR29Ub1JlbGF0ZWRDb2RlLCBUZXN0Q29udHJvbGxlckNhcGFiaWxpdHkuQ29kZVJlbGF0ZWRUb1Rlc3QpO1xuXHRcdGJpbmRDYXBhYmlsaXR5KFRlc3RpbmdDb250ZXh0S2V5cy5jYW5Hb1RvUmVsYXRlZFRlc3QsIFRlc3RDb250cm9sbGVyQ2FwYWJpbGl0eS5UZXN0UmVsYXRlZFRvQ29kZSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3JTZXJ2aWNlLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlKCgpID0+IHRoaXMudXBkYXRlRWRpdG9yQ29udGV4dEtleXMoKSkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgYXN5bmMgZXhwYW5kVGVzdChpZDogc3RyaW5nLCBsZXZlbHM6IG51bWJlcikge1xuXHRcdGF3YWl0IHRoaXMudGVzdENvbnRyb2xsZXJzLmdldCgpLmdldChUZXN0SWQuZnJvbVN0cmluZyhpZCkuY29udHJvbGxlcklkKT8uZXhwYW5kVGVzdChpZCwgbGV2ZWxzKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIGNhbmNlbFRlc3RSdW4ocnVuSWQ/OiBzdHJpbmcsIHRhc2tJZD86IHN0cmluZykge1xuXHRcdHRoaXMuY2FuY2VsRXh0ZW5zaW9uVGVzdFJ1bkVtaXR0ZXIuZmlyZSh7IHJ1bklkLCB0YXNrSWQgfSk7XG5cblx0XHRpZiAocnVuSWQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Zm9yIChjb25zdCBydW5DdHMgb2YgdGhpcy51aVJ1bm5pbmdUZXN0cy52YWx1ZXMoKSkge1xuXHRcdFx0XHRydW5DdHMuY2FuY2VsKCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICghdGFza0lkKSB7XG5cdFx0XHR0aGlzLnVpUnVubmluZ1Rlc3RzLmdldChydW5JZCk/LmNhbmNlbCgpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIGFzeW5jIHJ1blRlc3RzKHJlcTogQW1iaWd1b3VzUnVuVGVzdHNSZXF1ZXN0LCB0b2tlbiA9IENhbmNlbGxhdGlvblRva2VuLk5vbmUpOiBQcm9taXNlPElUZXN0UmVzdWx0PiB7XG5cdFx0Ly8gV2UgdHJ5IHRvIGVuc3VyZSB0aGF0IGFsbCB0ZXN0cyBpbiB0aGUgcmVxdWVzdCB3aWxsIGJlIHJ1biwgcHJlZmVycmluZ1xuXHRcdC8vIHRvIHVzZSBkZWZhdWx0IHByb2ZpbGVzIGZvciBlYWNoIGNvbnRyb2xsZXIgd2hlbiBwb3NzaWJsZS5cblx0XHRjb25zdCBieVByb2ZpbGU6IHsgcHJvZmlsZTogSVRlc3RSdW5Qcm9maWxlOyB0ZXN0czogSW50ZXJuYWxUZXN0SXRlbVtdIH1bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgdGVzdCBvZiByZXEudGVzdHMpIHtcblx0XHRcdGNvbnN0IGV4aXN0aW5nID0gYnlQcm9maWxlLmZpbmQocCA9PiBjYW5Vc2VQcm9maWxlV2l0aFRlc3QocC5wcm9maWxlLCB0ZXN0KSk7XG5cdFx0XHRpZiAoZXhpc3RpbmcpIHtcblx0XHRcdFx0ZXhpc3RpbmcudGVzdHMucHVzaCh0ZXN0KTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGJlc3RQcm9maWxlID0gdGhpcy50ZXN0UHJvZmlsZXMuZ2V0RGVmYXVsdFByb2ZpbGVGb3JUZXN0KHJlcS5ncm91cCwgdGVzdCk7XG5cdFx0XHRpZiAoIWJlc3RQcm9maWxlKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRieVByb2ZpbGUucHVzaCh7IHByb2ZpbGU6IGJlc3RQcm9maWxlLCB0ZXN0czogW3Rlc3RdIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc29sdmVkOiBSZXNvbHZlZFRlc3RSdW5SZXF1ZXN0ID0ge1xuXHRcdFx0dGFyZ2V0czogYnlQcm9maWxlLm1hcCgoeyBwcm9maWxlLCB0ZXN0cyB9KSA9PiAoe1xuXHRcdFx0XHRwcm9maWxlSWQ6IHByb2ZpbGUucHJvZmlsZUlkLFxuXHRcdFx0XHRjb250cm9sbGVySWQ6IHRlc3RzWzBdLmNvbnRyb2xsZXJJZCxcblx0XHRcdFx0dGVzdElkczogdGVzdHMubWFwKHQgPT4gdC5pdGVtLmV4dElkKSxcblx0XHRcdH0pKSxcblx0XHRcdGdyb3VwOiByZXEuZ3JvdXAsXG5cdFx0XHRleGNsdWRlOiByZXEuZXhjbHVkZT8ubWFwKHQgPT4gdC5pdGVtLmV4dElkKSxcblx0XHRcdGNvbnRpbnVvdXM6IHJlcS5jb250aW51b3VzLFxuXHRcdH07XG5cblx0XHQvLyBJZiBubyB0ZXN0cyBhcmUgY292ZXJlZCBieSB0aGUgZGVmYXVsdHMsIGp1c3QgdXNlIHdoYXRldmVyIHRoZSBkZWZhdWx0c1xuXHRcdC8vIGZvciB0aGVpciBjb250cm9sbGVyIGFyZS4gVGhpcyBjYW4gaGFwcGVuIGlmIHRoZSB1c2VyIGNob3NlIHNwZWNpZmljXG5cdFx0Ly8gcHJvZmlsZXMgZm9yIHRoZSBydW4gYnV0dG9uLCBidXQgdGhlbiBhc2tlZCB0byBydW4gYSBzaW5nbGUgdGVzdCBmcm9tIHRoZVxuXHRcdC8vIGV4cGxvcmVyIG9yIGRlY29yYXRpb24uIFdlIHNob3VsZG4ndCBuby1vcC5cblx0XHRpZiAocmVzb2x2ZWQudGFyZ2V0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdGZvciAoY29uc3QgYnlDb250cm9sbGVyIG9mIGdyb3VwQnkocmVxLnRlc3RzLCAoYSwgYikgPT4gYS5jb250cm9sbGVySWQgPT09IGIuY29udHJvbGxlcklkID8gMCA6IDEpKSB7XG5cdFx0XHRcdGNvbnN0IHByb2ZpbGVzID0gdGhpcy50ZXN0UHJvZmlsZXMuZ2V0Q29udHJvbGxlclByb2ZpbGVzKGJ5Q29udHJvbGxlclswXS5jb250cm9sbGVySWQpO1xuXHRcdFx0XHRjb25zdCB3aXRoQ29udHJvbGxlcnMgPSBieUNvbnRyb2xsZXIubWFwKHRlc3QgPT4gKHtcblx0XHRcdFx0XHRwcm9maWxlOiBwcm9maWxlcy5maW5kKHAgPT4gcC5ncm91cCA9PT0gcmVxLmdyb3VwICYmIGNhblVzZVByb2ZpbGVXaXRoVGVzdChwLCB0ZXN0KSksXG5cdFx0XHRcdFx0dGVzdCxcblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdGZvciAoY29uc3QgYnlQcm9maWxlIG9mIGdyb3VwQnkod2l0aENvbnRyb2xsZXJzLCAoYSwgYikgPT4gYS5wcm9maWxlID09PSBiLnByb2ZpbGUgPyAwIDogMSkpIHtcblx0XHRcdFx0XHRjb25zdCBwcm9maWxlID0gYnlQcm9maWxlWzBdLnByb2ZpbGU7XG5cdFx0XHRcdFx0aWYgKHByb2ZpbGUpIHtcblx0XHRcdFx0XHRcdHJlc29sdmVkLnRhcmdldHMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdHRlc3RJZHM6IGJ5UHJvZmlsZS5tYXAodCA9PiB0LnRlc3QuaXRlbS5leHRJZCksXG5cdFx0XHRcdFx0XHRcdHByb2ZpbGVJZDogcHJvZmlsZS5wcm9maWxlSWQsXG5cdFx0XHRcdFx0XHRcdGNvbnRyb2xsZXJJZDogcHJvZmlsZS5jb250cm9sbGVySWQsXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5ydW5SZXNvbHZlZFRlc3RzKHJlc29sdmVkLCB0b2tlbik7XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIGFzeW5jIHN0YXJ0Q29udGludW91c1J1bihyZXE6IFJlc29sdmVkVGVzdFJ1blJlcXVlc3QsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdGlmICghcmVxLmV4Y2x1ZGUpIHtcblx0XHRcdHJlcS5leGNsdWRlID0gWy4uLnRoaXMuZXhjbHVkZWQuYWxsXTtcblx0XHR9XG5cblx0XHRjb25zdCB0cnVzdCA9IGF3YWl0IHRoaXMud29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZS5yZXF1ZXN0V29ya3NwYWNlVHJ1c3Qoe1xuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3Rlc3RUcnVzdCcsIFwiUnVubmluZyB0ZXN0cyBtYXkgZXhlY3V0ZSBjb2RlIGluIHlvdXIgd29ya3NwYWNlLlwiKSxcblx0XHR9KTtcblxuXHRcdGlmICghdHJ1c3QpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBieUNvbnRyb2xsZXIgPSBncm91cEJ5KHJlcS50YXJnZXRzLCAoYSwgYikgPT4gYS5jb250cm9sbGVySWQubG9jYWxlQ29tcGFyZShiLmNvbnRyb2xsZXJJZCkpO1xuXHRcdGNvbnN0IHJlcXVlc3RzID0gYnlDb250cm9sbGVyLm1hcChcblx0XHRcdGdyb3VwID0+IHRoaXMuZ2V0VGVzdENvbnRyb2xsZXIoZ3JvdXBbMF0uY29udHJvbGxlcklkKT8uc3RhcnRDb250aW51b3VzUnVuKFxuXHRcdFx0XHRncm91cC5tYXAoY29udHJvbFJlcSA9PiAoe1xuXHRcdFx0XHRcdGV4Y2x1ZGVFeHRJZHM6IHJlcS5leGNsdWRlIS5maWx0ZXIodCA9PiAhY29udHJvbFJlcS50ZXN0SWRzLmluY2x1ZGVzKHQpKSxcblx0XHRcdFx0XHRwcm9maWxlSWQ6IGNvbnRyb2xSZXEucHJvZmlsZUlkLFxuXHRcdFx0XHRcdGNvbnRyb2xsZXJJZDogY29udHJvbFJlcS5jb250cm9sbGVySWQsXG5cdFx0XHRcdFx0dGVzdElkczogY29udHJvbFJlcS50ZXN0SWRzLFxuXHRcdFx0XHR9KSksXG5cdFx0XHRcdHRva2VuLFxuXHRcdFx0KS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRcdGNvbnN0IGVycnMgPSByZXN1bHQubWFwKHIgPT4gci5lcnJvcikuZmlsdGVyKGlzRGVmaW5lZCk7XG5cdFx0XHRcdGlmIChlcnJzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihsb2NhbGl6ZSgndGVzdEVycm9yJywgJ0FuIGVycm9yIG9jY3VycmVkIGF0dGVtcHRpbmcgdG8gcnVuIHRlc3RzOiB7MH0nLCBlcnJzLmpvaW4oJyAnKSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdCk7XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbChyZXF1ZXN0cyk7XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyBhc3luYyBydW5SZXNvbHZlZFRlc3RzKHJlcTogUmVzb2x2ZWRUZXN0UnVuUmVxdWVzdCwgdG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSB7XG5cdFx0aWYgKCFyZXEuZXhjbHVkZSkge1xuXHRcdFx0cmVxLmV4Y2x1ZGUgPSBbLi4udGhpcy5leGNsdWRlZC5hbGxdO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMudGVzdFJlc3VsdHMuY3JlYXRlTGl2ZVJlc3VsdChyZXEpO1xuXHRcdGNvbnN0IHRydXN0ID0gYXdhaXQgdGhpcy53b3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLnJlcXVlc3RXb3Jrc3BhY2VUcnVzdCh7XG5cdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgndGVzdFRydXN0JywgXCJSdW5uaW5nIHRlc3RzIG1heSBleGVjdXRlIGNvZGUgaW4geW91ciB3b3Jrc3BhY2UuXCIpLFxuXHRcdH0pO1xuXG5cdFx0aWYgKCF0cnVzdCkge1xuXHRcdFx0cmVzdWx0Lm1hcmtDb21wbGV0ZSgpO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY2FuY2VsU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKHRva2VuKTtcblx0XHRcdHRoaXMudWlSdW5uaW5nVGVzdHMuc2V0KHJlc3VsdC5pZCwgY2FuY2VsU291cmNlKTtcblxuXHRcdFx0Y29uc3QgYnlDb250cm9sbGVyID0gZ3JvdXBCeShyZXEudGFyZ2V0cywgKGEsIGIpID0+IGEuY29udHJvbGxlcklkLmxvY2FsZUNvbXBhcmUoYi5jb250cm9sbGVySWQpKTtcblx0XHRcdGNvbnN0IHJlcXVlc3RzID0gYnlDb250cm9sbGVyLm1hcChcblx0XHRcdFx0Z3JvdXAgPT4gdGhpcy5nZXRUZXN0Q29udHJvbGxlcihncm91cFswXS5jb250cm9sbGVySWQpPy5ydW5UZXN0cyhcblx0XHRcdFx0XHRncm91cC5tYXAoY29udHJvbFJlcSA9PiAoe1xuXHRcdFx0XHRcdFx0cnVuSWQ6IHJlc3VsdC5pZCxcblx0XHRcdFx0XHRcdGV4Y2x1ZGVFeHRJZHM6IHJlcS5leGNsdWRlIS5maWx0ZXIodCA9PiAhY29udHJvbFJlcS50ZXN0SWRzLmluY2x1ZGVzKHQpKSxcblx0XHRcdFx0XHRcdHByb2ZpbGVJZDogY29udHJvbFJlcS5wcm9maWxlSWQsXG5cdFx0XHRcdFx0XHRjb250cm9sbGVySWQ6IGNvbnRyb2xSZXEuY29udHJvbGxlcklkLFxuXHRcdFx0XHRcdFx0dGVzdElkczogY29udHJvbFJlcS50ZXN0SWRzLFxuXHRcdFx0XHRcdH0pKSxcblx0XHRcdFx0XHRjYW5jZWxTb3VyY2UudG9rZW4sXG5cdFx0XHRcdCkudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGVycnMgPSByZXN1bHQubWFwKHIgPT4gci5lcnJvcikuZmlsdGVyKGlzRGVmaW5lZCk7XG5cdFx0XHRcdFx0aWYgKGVycnMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IobG9jYWxpemUoJ3Rlc3RFcnJvcicsICdBbiBlcnJvciBvY2N1cnJlZCBhdHRlbXB0aW5nIHRvIHJ1biB0ZXN0czogezB9JywgZXJycy5qb2luKCcgJykpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pXG5cdFx0XHQpO1xuXHRcdFx0YXdhaXQgdGhpcy5zYXZlQWxsQmVmb3JlVGVzdChyZXEpO1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwocmVxdWVzdHMpO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy51aVJ1bm5pbmdUZXN0cy5kZWxldGUocmVzdWx0LmlkKTtcblx0XHRcdHJlc3VsdC5tYXJrQ29tcGxldGUoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyBhc3luYyBwcm92aWRlVGVzdEZvbGxvd3VwcyhyZXE6IFRlc3RNZXNzYWdlRm9sbG93dXBSZXF1ZXN0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElUZXN0Rm9sbG93dXBzPiB7XG5cdFx0Y29uc3QgcmVxcyA9IGF3YWl0IFByb21pc2UuYWxsKFsuLi50aGlzLnRlc3RFeHRIb3N0c10ubWFwKGFzeW5jIGN0cmwgPT5cblx0XHRcdCh7IGN0cmwsIGZvbGxvd3VwczogYXdhaXQgY3RybC5wcm92aWRlVGVzdEZvbGxvd3VwcyhyZXEsIHRva2VuKSB9KSkpO1xuXG5cdFx0Y29uc3QgZm9sbG93dXBzOiBJVGVzdEZvbGxvd3VwcyA9IHtcblx0XHRcdGZvbGxvd3VwczogcmVxcy5mbGF0TWFwKCh7IGN0cmwsIGZvbGxvd3VwcyB9KSA9PiBmb2xsb3d1cHMubWFwKGYgPT4gKHtcblx0XHRcdFx0bWVzc2FnZTogZi50aXRsZSxcblx0XHRcdFx0ZXhlY3V0ZTogKCkgPT4gY3RybC5leGVjdXRlVGVzdEZvbGxvd3VwKGYuaWQpXG5cdFx0XHR9KSkpLFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHsgY3RybCwgZm9sbG93dXBzIH0gb2YgcmVxcykge1xuXHRcdFx0XHRcdGN0cmwuZGlzcG9zZVRlc3RGb2xsb3d1cHMoZm9sbG93dXBzLm1hcChmID0+IGYuaWQpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdGZvbGxvd3Vwcy5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZvbGxvd3Vwcztcblx0fVxuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIHB1Ymxpc2hEaWZmKF9jb250cm9sbGVySWQ6IHN0cmluZywgZGlmZjogVGVzdHNEaWZmKSB7XG5cdFx0dGhpcy53aWxsUHJvY2Vzc0RpZmZFbWl0dGVyLmZpcmUoZGlmZik7XG5cdFx0dGhpcy5jb2xsZWN0aW9uLmFwcGx5KGRpZmYpO1xuXHRcdHRoaXMudXBkYXRlRWRpdG9yQ29udGV4dEtleXMoKTtcblx0XHR0aGlzLmRpZFByb2Nlc3NEaWZmRW1pdHRlci5maXJlKGRpZmYpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgZ2V0VGVzdENvbnRyb2xsZXIoaWQ6IHN0cmluZykge1xuXHRcdHJldHVybiB0aGlzLnRlc3RDb250cm9sbGVycy5nZXQoKS5nZXQoaWQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgYXN5bmMgc3luY1Rlc3RzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChbLi4udGhpcy50ZXN0Q29udHJvbGxlcnMuZ2V0KCkudmFsdWVzKCldLm1hcChjID0+IGMuc3luY1Rlc3RzKGN0cy50b2tlbikpKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Y3RzLmRpc3Bvc2UodHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgYXN5bmMgcmVmcmVzaFRlc3RzKGNvbnRyb2xsZXJJZD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdHRoaXMudGVzdFJlZnJlc2hDYW5jZWxsYXRpb25zLmFkZChjdHMpO1xuXHRcdHRoaXMuaXNSZWZyZXNoaW5nVGVzdHMuc2V0KHRydWUpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGlmIChjb250cm9sbGVySWQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5nZXRUZXN0Q29udHJvbGxlcihjb250cm9sbGVySWQpPy5yZWZyZXNoVGVzdHMoY3RzLnRva2VuKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IFByb21pc2UuYWxsKFsuLi50aGlzLnRlc3RDb250cm9sbGVycy5nZXQoKS52YWx1ZXMoKV0ubWFwKGMgPT4gYy5yZWZyZXNoVGVzdHMoY3RzLnRva2VuKSkpO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLnRlc3RSZWZyZXNoQ2FuY2VsbGF0aW9ucy5kZWxldGUoY3RzKTtcblx0XHRcdHRoaXMuaXNSZWZyZXNoaW5nVGVzdHMuc2V0KHRoaXMudGVzdFJlZnJlc2hDYW5jZWxsYXRpb25zLnNpemUgPiAwKTtcblx0XHRcdGN0cy5kaXNwb3NlKHRydWUpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIGNhbmNlbFJlZnJlc2hUZXN0cygpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IGN0cyBvZiB0aGlzLnRlc3RSZWZyZXNoQ2FuY2VsbGF0aW9ucykge1xuXHRcdFx0Y3RzLmNhbmNlbCgpO1xuXHRcdH1cblx0XHR0aGlzLnRlc3RSZWZyZXNoQ2FuY2VsbGF0aW9ucy5jbGVhcigpO1xuXHRcdHRoaXMuaXNSZWZyZXNoaW5nVGVzdHMuc2V0KGZhbHNlKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIHJlZ2lzdGVyRXh0SG9zdChjb250cm9sbGVyOiBJTWFpblRocmVhZFRlc3RIb3N0UHJveHkpOiBJRGlzcG9zYWJsZSB7XG5cdFx0dGhpcy50ZXN0RXh0SG9zdHMuYWRkKGNvbnRyb2xsZXIpO1xuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy50ZXN0RXh0SG9zdHMuZGVsZXRlKGNvbnRyb2xsZXIpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIGFzeW5jIGdldFRlc3RzUmVsYXRlZFRvQ29kZSh1cmk6IFVSSSwgcG9zaXRpb246IFBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTogUHJvbWlzZTxJbnRlcm5hbFRlc3RJdGVtW10+IHtcblx0XHRjb25zdCB0ZXN0SWRzID0gYXdhaXQgUHJvbWlzZS5hbGwoWy4uLnRoaXMudGVzdEV4dEhvc3RzLnZhbHVlcygpXS5tYXAodiA9PiB2LmdldFRlc3RzUmVsYXRlZFRvQ29kZSh1cmksIHBvc2l0aW9uLCB0b2tlbikpKTtcblx0XHQvLyBleHQgaG9zdCB3aWxsIGZsdXNoIGRpZmZzIGJlZm9yZSByZXR1cm5pbmcsIHNvIHdlIHNob3VsZCBoYXZlIGV2ZXJ5dGhpbmcgaGVyZTpcblx0XHRyZXR1cm4gdGVzdElkcy5mbGF0TWFwKGlkcyA9PiBpZHMubWFwKGlkID0+IHRoaXMuY29sbGVjdGlvbi5nZXROb2RlQnlJZChpZCkpKS5maWx0ZXIoaXNEZWZpbmVkKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIHJlZ2lzdGVyVGVzdENvbnRyb2xsZXIoaWQ6IHN0cmluZywgY29udHJvbGxlcjogSU1haW5UaHJlYWRUZXN0Q29udHJvbGxlcik6IElEaXNwb3NhYmxlIHtcblx0XHR0aGlzLnRlc3RDb250cm9sbGVycy5zZXQobmV3IE1hcCh0aGlzLnRlc3RDb250cm9sbGVycy5nZXQoKSkuc2V0KGlkLCBjb250cm9sbGVyKSwgdW5kZWZpbmVkKTtcblxuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGlmZjogVGVzdHNEaWZmID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IHJvb3Qgb2YgdGhpcy5jb2xsZWN0aW9uLnJvb3RJdGVtcykge1xuXHRcdFx0XHRpZiAocm9vdC5jb250cm9sbGVySWQgPT09IGlkKSB7XG5cdFx0XHRcdFx0ZGlmZi5wdXNoKHsgb3A6IFRlc3REaWZmT3BUeXBlLlJlbW92ZSwgaXRlbUlkOiByb290Lml0ZW0uZXh0SWQgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5wdWJsaXNoRGlmZihpZCwgZGlmZik7XG5cblx0XHRcdGNvbnN0IG5leHQgPSBuZXcgTWFwKHRoaXMudGVzdENvbnRyb2xsZXJzLmdldCgpKTtcblx0XHRcdG5leHQuZGVsZXRlKGlkKTtcblx0XHRcdHRoaXMudGVzdENvbnRyb2xsZXJzLnNldChuZXh0LCB1bmRlZmluZWQpO1xuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgYXN5bmMgZ2V0Q29kZVJlbGF0ZWRUb1Rlc3QodGVzdDogSW50ZXJuYWxUZXN0SXRlbSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuID0gQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk6IFByb21pc2U8TG9jYXRpb25bXT4ge1xuXHRcdHJldHVybiAoYXdhaXQgdGhpcy50ZXN0Q29udHJvbGxlcnMuZ2V0KCkuZ2V0KHRlc3QuY29udHJvbGxlcklkKT8uZ2V0UmVsYXRlZENvZGUodGVzdC5pdGVtLmV4dElkLCB0b2tlbikpIHx8IFtdO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVFZGl0b3JDb250ZXh0S2V5cygpIHtcblx0XHRjb25zdCB1cmkgPSB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yPy5yZXNvdXJjZTtcblx0XHRpZiAodXJpKSB7XG5cdFx0XHR0aGlzLmFjdGl2ZUVkaXRvckhhc1Rlc3RzLnNldCghSXRlcmFibGUuaXNFbXB0eSh0aGlzLmNvbGxlY3Rpb24uZ2V0Tm9kZUJ5VXJsKHVyaSkpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5hY3RpdmVFZGl0b3JIYXNUZXN0cy5zZXQoZmFsc2UpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2F2ZUFsbEJlZm9yZVRlc3QocmVxOiBSZXNvbHZlZFRlc3RSdW5SZXF1ZXN0LCBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UgPSB0aGlzLmVkaXRvclNlcnZpY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAocmVxLnByZXNlcnZlRm9jdXMgPT09IHRydWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgc2F2ZUJlZm9yZVRlc3QgPSBnZXRUZXN0aW5nQ29uZmlndXJhdGlvbih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBUZXN0aW5nQ29uZmlnS2V5cy5TYXZlQmVmb3JlVGVzdCk7XG5cdFx0aWYgKHNhdmVCZWZvcmVUZXN0KSB7XG5cdFx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLnNhdmVBbGwoKTtcblx0XHR9XG5cdFx0cmV0dXJuO1xuXHR9XG59XG5cblxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxtQkFBbUIsK0JBQStCO0FBQzNELFNBQVMsZUFBZTtBQUN4QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFlBQXlCLG9CQUFv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QU8sS0FBSyxLQUFNLENBQUM7QUFBQSxFQUM5RztBQUFBLEVBRVEsMEJBQTBCO0FBQ2pDLFVBQU0sTUFBTSxLQUFLLGNBQWMsY0FBYztBQUM3QyxRQUFJLEtBQUs7QUFDUixXQUFLLHFCQUFxQixJQUFJLENBQUMsU0FBUyxRQUFRLEtBQUssV0FBVyxhQUFhLEdBQUcsQ0FBQyxDQUFDO0FBQUEsSUFDbkYsT0FBTztBQUNOLFdBQUsscUJBQXFCLElBQUksS0FBSztBQUFBLElBQ3BDO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYyxrQkFBa0IsS0FBNkIsdUJBQThDLEtBQUssc0JBQXNCLGdCQUFnQyxLQUFLLGVBQThCO0FBQ3hNLFFBQUksSUFBSSxrQkFBa0IsTUFBTTtBQUMvQjtBQUFBLElBQ0Q7QUFDQSxVQUFNLGlCQUFpQix3QkFBd0IsS0FBSyxzQkFBc0Isa0JBQWtCLGNBQWM7QUFDMUcsUUFBSSxnQkFBZ0I7QUFDbkIsWUFBTSxjQUFjLFFBQVE7QUFBQSxJQUM3QjtBQUNBO0FBQUEsRUFDRDtBQUNEO0FBdFphLGNBQU47QUFBQSxFQXFESjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBOURVOyIsCiAgIm5hbWVzIjogWyJieVByb2ZpbGUiLCAicmVzdWx0IiwgImZvbGxvd3VwcyJdCn0K
