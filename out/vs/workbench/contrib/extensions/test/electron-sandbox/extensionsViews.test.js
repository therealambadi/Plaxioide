import assert from "assert";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { ExtensionsListView } from "../../browser/extensionsViews.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { IExtensionsWorkbenchService } from "../../common/extensions.js";
import { ExtensionsWorkbenchService } from "../../browser/extensionsWorkbenchService.js";
import {
  IExtensionManagementService,
  IExtensionGalleryService,
  getTargetPlatform,
  SortBy
} from "../../../../../platform/extensionManagement/common/extensionManagement.js";
import { IWorkbenchExtensionEnablementService, EnablementState, IExtensionManagementServerService, IWorkbenchExtensionManagementService } from "../../../../services/extensionManagement/common/extensionManagement.js";
import { IExtensionRecommendationsService, ExtensionRecommendationReason } from "../../../../services/extensionRecommendations/common/extensionRecommendations.js";
import { getGalleryExtensionId } from "../../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { TestExtensionEnablementService } from "../../../../services/extensionManagement/test/browser/extensionEnablementService.test.js";
import { ExtensionGalleryService } from "../../../../../platform/extensionManagement/common/extensionGalleryService.js";
import { IURLService } from "../../../../../platform/url/common/url.js";
import { Event } from "../../../../../base/common/event.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { IExtensionService, toExtensionDescription } from "../../../../services/extensions/common/extensions.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { TestMenuService } from "../../../../test/browser/workbenchTestServices.js";
import { TestSharedProcessService } from "../../../../test/electron-sandbox/workbenchTestServices.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ILogService, NullLogService } from "../../../../../platform/log/common/log.js";
import { NativeURLService } from "../../../../../platform/url/common/urlService.js";
import { URI } from "../../../../../base/common/uri.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { IRemoteAgentService } from "../../../../services/remote/common/remoteAgentService.js";
import { RemoteAgentService } from "../../../../services/remote/electron-sandbox/remoteAgentService.js";
import { ExtensionType } from "../../../../../platform/extensions/common/extensions.js";
import { ISharedProcessService } from "../../../../../platform/ipc/electron-sandbox/services.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { IMenuService } from "../../../../../platform/actions/common/actions.js";
import { TestContextService } from "../../../../test/common/workbenchTestServices.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../../common/views.js";
import { Schemas } from "../../../../../base/common/network.js";
import { platform } from "../../../../../base/common/platform.js";
import { arch } from "../../../../../base/common/process.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { IUpdateService, State } from "../../../../../platform/update/common/update.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { FileService } from "../../../../../platform/files/common/fileService.js";
import { IUserDataProfileService } from "../../../../services/userDataProfile/common/userDataProfile.js";
import { UserDataProfileService } from "../../../../services/userDataProfile/common/userDataProfileService.js";
import { toUserDataProfile } from "../../../../../platform/userDataProfile/common/userDataProfile.js";
suite("ExtensionsViews Tests", () => {
  const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();
  let instantiationService;
  let testableView;
  const localEnabledTheme = aLocalExtension("first-enabled-extension", { categories: ["Themes", "random"] }, { installedTimestamp: 123456 });
  const localEnabledLanguage = aLocalExtension("second-enabled-extension", { categories: ["Programming languages"], version: "1.0.0" }, { installedTimestamp: Date.now(), updated: false });
  const localDisabledTheme = aLocalExtension("first-disabled-extension", { categories: ["themes"] }, { installedTimestamp: 234567 });
  const localDisabledLanguage = aLocalExtension("second-disabled-extension", { categories: ["programming languages"] }, { installedTimestamp: Date.now() - 5e4, updated: true });
  const localRandom = aLocalExtension("random-enabled-extension", { categories: ["random"] }, { installedTimestamp: 345678 });
  const builtInTheme = aLocalExtension("my-theme", { categories: ["Themes"], contributes: { themes: ["my-theme"] } }, { type: ExtensionType.System, installedTimestamp: 222 });
  const builtInBasic = aLocalExtension("my-lang", { categories: ["Programming Languages"], contributes: { grammars: [{ language: "my-language" }] } }, { type: ExtensionType.System, installedTimestamp: 666666 });
  let queryPage = aPage([]);
  const galleryExtensions = [];
  const workspaceRecommendationA = aGalleryExtension("workspace-recommendation-A");
  const workspaceRecommendationB = aGalleryExtension("workspace-recommendation-B");
  const configBasedRecommendationA = aGalleryExtension("configbased-recommendation-A");
  const configBasedRecommendationB = aGalleryExtension("configbased-recommendation-B");
  const fileBasedRecommendationA = aGalleryExtension("filebased-recommendation-A");
  const fileBasedRecommendationB = aGalleryExtension("filebased-recommendation-B");
  const otherRecommendationA = aGalleryExtension("other-recommendation-A");
  setup(async () => {
    instantiationService = disposableStore.add(new TestInstantiationService());
    instantiationService.stub(ITelemetryService, NullTelemetryService);
    instantiationService.stub(ILogService, NullLogService);
    instantiationService.stub(IFileService, disposableStore.add(new FileService(new NullLogService())));
    instantiationService.stub(IProductService, {});
    instantiationService.stub(IWorkspaceContextService, new TestContextService());
    instantiationService.stub(IConfigurationService, new TestConfigurationService());
    instantiationService.stub(IExtensionGalleryService, ExtensionGalleryService);
    instantiationService.stub(ISharedProcessService, TestSharedProcessService);
    instantiationService.stub(IWorkbenchExtensionManagementService, {
      onInstallExtension: Event.None,
      onDidInstallExtensions: Event.None,
      onUninstallExtension: Event.None,
      onDidUninstallExtension: Event.None,
      onDidUpdateExtensionMetadata: Event.None,
      onDidChangeProfile: Event.None,
      onProfileAwareDidInstallExtensions: Event.None,
      async getInstalled() {
        return [];
      },
      async getInstalledWorkspaceExtensions() {
        return [];
      },
      async canInstall() {
        return true;
      },
      async getExtensionsControlManifest() {
        return { malicious: [], deprecated: {}, search: [], publisherMapping: {} };
      },
      async getTargetPlatform() {
        return getTargetPlatform(platform, arch);
      },
      async updateMetadata(local) {
        return local;
      }
    });
    instantiationService.stub(IRemoteAgentService, RemoteAgentService);
    instantiationService.stub(IContextKeyService, new MockContextKeyService());
    instantiationService.stub(IMenuService, new TestMenuService());
    const localExtensionManagementServer = { extensionManagementService: instantiationService.get(IExtensionManagementService), label: "local", id: "vscode-local" };
    instantiationService.stub(IExtensionManagementServerService, {
      get localExtensionManagementServer() {
        return localExtensionManagementServer;
      },
      getExtensionManagementServer(extension) {
        if (extension.location.scheme === Schemas.file) {
          return localExtensionManagementServer;
        }
        throw new Error(`Invalid Extension ${extension.location}`);
      }
    });
    instantiationService.stub(IWorkbenchExtensionEnablementService, disposableStore.add(new TestExtensionEnablementService(instantiationService)));
    instantiationService.stub(IUserDataProfileService, disposableStore.add(new UserDataProfileService(toUserDataProfile("test", "test", URI.file("foo"), URI.file("cache")))));
    const reasons = {};
    reasons[workspaceRecommendationA.identifier.id] = { reasonId: ExtensionRecommendationReason.Workspace };
    reasons[workspaceRecommendationB.identifier.id] = { reasonId: ExtensionRecommendationReason.Workspace };
    reasons[fileBasedRecommendationA.identifier.id] = { reasonId: ExtensionRecommendationReason.File };
    reasons[fileBasedRecommendationB.identifier.id] = { reasonId: ExtensionRecommendationReason.File };
    reasons[otherRecommendationA.identifier.id] = { reasonId: ExtensionRecommendationReason.Executable };
    reasons[configBasedRecommendationA.identifier.id] = { reasonId: ExtensionRecommendationReason.WorkspaceConfig };
    instantiationService.stub(IExtensionRecommendationsService, {
      getWorkspaceRecommendations() {
        return Promise.resolve([
          workspaceRecommendationA.identifier.id,
          workspaceRecommendationB.identifier.id
        ]);
      },
      getConfigBasedRecommendations() {
        return Promise.resolve({
          important: [configBasedRecommendationA.identifier.id],
          others: [configBasedRecommendationB.identifier.id]
        });
      },
      getImportantRecommendations() {
        return Promise.resolve([]);
      },
      getFileBasedRecommendations() {
        return [
          fileBasedRecommendationA.identifier.id,
          fileBasedRecommendationB.identifier.id
        ];
      },
      getOtherRecommendations() {
        return Promise.resolve([
          configBasedRecommendationB.identifier.id,
          otherRecommendationA.identifier.id
        ]);
      },
      getAllRecommendationsWithReason() {
        return reasons;
      }
    });
    instantiationService.stub(IURLService, NativeURLService);
    instantiationService.stubPromise(IExtensionManagementService, "getInstalled", [localEnabledTheme, localEnabledLanguage, localRandom, localDisabledTheme, localDisabledLanguage, builtInTheme, builtInBasic]);
    instantiationService.stubPromise(IExtensionManagementService, "getExtensgetExtensionsControlManifestionsReport", {});
    instantiationService.stub(IExtensionGalleryService, {
      query: async () => {
        return queryPage;
      },
      getCompatibleExtension: async (gallery) => {
        return gallery;
      },
      getExtensions: async (infos) => {
        const result = [];
        for (const info of infos) {
          const extension = galleryExtensions.find((e) => e.identifier.id === info.id);
          if (extension) {
            result.push(extension);
          }
        }
        return result;
      },
      isEnabled: () => true,
      isExtensionCompatible: async () => true
    });
    instantiationService.stub(IViewDescriptorService, {
      getViewLocationById() {
        return ViewContainerLocation.Sidebar;
      },
      onDidChangeLocation: Event.None
    });
    instantiationService.stub(IExtensionService, {
      onDidChangeExtensions: Event.None,
      extensions: [
        toExtensionDescription(localEnabledTheme),
        toExtensionDescription(localEnabledLanguage),
        toExtensionDescription(localRandom),
        toExtensionDescription(builtInTheme),
        toExtensionDescription(builtInBasic)
      ],
      canAddExtension: (extension) => true,
      whenInstalledExtensionsRegistered: () => Promise.resolve(true)
    });
    await instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([localDisabledTheme], EnablementState.DisabledGlobally);
    await instantiationService.get(IWorkbenchExtensionEnablementService).setEnablement([localDisabledLanguage], EnablementState.DisabledGlobally);
    instantiationService.stub(IUpdateService, { onStateChange: Event.None, state: State.Uninitialized });
    instantiationService.set(IExtensionsWorkbenchService, disposableStore.add(instantiationService.createInstance(ExtensionsWorkbenchService)));
    testableView = disposableStore.add(instantiationService.createInstance(ExtensionsListView, {}, { id: "", title: "" }));
    queryPage = aPage([]);
    galleryExtensions.splice(0, galleryExtensions.length, ...[
      workspaceRecommendationA,
      workspaceRecommendationB,
      configBasedRecommendationA,
      configBasedRecommendationB,
      fileBasedRecommendationA,
      fileBasedRecommendationB,
      otherRecommendationA
    ]);
  });
  test("Test query types", () => {
    assert.strictEqual(ExtensionsListView.isBuiltInExtensionsQuery("@builtin"), true);
    assert.strictEqual(ExtensionsListView.isLocalExtensionsQuery("@installed"), true);
    assert.strictEqual(ExtensionsListView.isLocalExtensionsQuery("@enabled"), true);
    assert.strictEqual(ExtensionsListView.isLocalExtensionsQuery("@disabled"), true);
    assert.strictEqual(ExtensionsListView.isLocalExtensionsQuery("@outdated"), true);
    assert.strictEqual(ExtensionsListView.isLocalExtensionsQuery("@updates"), true);
    assert.strictEqual(ExtensionsListView.isLocalExtensionsQuery("@sort:name"), true);
    assert.strictEqual(ExtensionsListView.isLocalExtensionsQuery("@sort:updateDate"), true);
    assert.strictEqual(ExtensionsListView.isLocalExtensionsQuery("@installed searchText"), true);
    assert.strictEqual(ExtensionsListView.isLocalExtensionsQuery("@enabled searchText"), true);
    assert.strictEqual(ExtensionsListView.isLocalExtensionsQuery("@disabled searchText"), true);
    assert.strictEqual(ExtensionsListView.isLocalExtensionsQuery("@outdated searchText"), true);
    assert.strictEqual(ExtensionsListView.isLocalExtensionsQuery("@updates searchText"), true);
  });
  test("Test empty query equates to sort by install count", async () => {
    const target = instantiationService.stubPromise(IExtensionGalleryService, "query", aPage());
    await testableView.show("");
    assert.ok(target.calledOnce);
    const options = target.args[0][0];
    assert.strictEqual(options.sortBy, SortBy.InstallCount);
  });
  test("Test non empty query without sort doesnt use sortBy", async () => {
    const target = instantiationService.stubPromise(IExtensionGalleryService, "query", aPage());
    await testableView.show("some extension");
    assert.ok(target.calledOnce);
    const options = target.args[0][0];
    assert.strictEqual(options.sortBy, void 0);
  });
  test("Test query with sort uses sortBy", async () => {
    const target = instantiationService.stubPromise(IExtensionGalleryService, "query", aPage());
    await testableView.show("some extension @sort:rating");
    assert.ok(target.calledOnce);
    const options = target.args[0][0];
    assert.strictEqual(options.sortBy, SortBy.WeightedRating);
  });
  test("Test default view actions required sorting", async () => {
    queryPage = aPage([aGalleryExtension(localEnabledLanguage.manifest.name, { ...localEnabledLanguage.manifest, version: "1.0.1", identifier: localDisabledLanguage.identifier })]);
    const workbenchService = instantiationService.get(IExtensionsWorkbenchService);
    const extension = (await workbenchService.queryLocal()).find((ex) => ex.identifier.id === localEnabledLanguage.identifier.id);
    await new Promise((c) => {
      const disposable = workbenchService.onChange(() => {
        if (extension?.outdated) {
          disposable.dispose();
          c();
        }
      });
      instantiationService.get(IExtensionsWorkbenchService).queryGallery(CancellationToken.None);
    });
    const result = await testableView.show("@installed");
    assert.strictEqual(result.length, 5, "Unexpected number of results for @installed query");
    const actual = [result.get(0).name, result.get(1).name, result.get(2).name, result.get(3).name, result.get(4).name];
    const expected = [localEnabledLanguage.manifest.name, localEnabledTheme.manifest.name, localRandom.manifest.name, localDisabledTheme.manifest.name, localDisabledLanguage.manifest.name];
    for (let i = 0; i < result.length; i++) {
      assert.strictEqual(actual[i], expected[i], "Unexpected extension for @installed query with outadted extension.");
    }
  });
  test("Test installed query results", async () => {
    await testableView.show("@installed").then((result) => {
      assert.strictEqual(result.length, 5, "Unexpected number of results for @installed query");
      const actual = [result.get(0).name, result.get(1).name, result.get(2).name, result.get(3).name, result.get(4).name].sort();
      const expected = [localDisabledTheme.manifest.name, localEnabledTheme.manifest.name, localRandom.manifest.name, localDisabledLanguage.manifest.name, localEnabledLanguage.manifest.name];
      for (let i = 0; i < result.length; i++) {
        assert.strictEqual(actual[i], expected[i], "Unexpected extension for @installed query.");
      }
    });
    await testableView.show("@installed first").then((result) => {
      assert.strictEqual(result.length, 2, "Unexpected number of results for @installed query");
      assert.strictEqual(result.get(0).name, localEnabledTheme.manifest.name, "Unexpected extension for @installed query with search text.");
      assert.strictEqual(result.get(1).name, localDisabledTheme.manifest.name, "Unexpected extension for @installed query with search text.");
    });
    await testableView.show("@disabled").then((result) => {
      assert.strictEqual(result.length, 2, "Unexpected number of results for @disabled query");
      assert.strictEqual(result.get(0).name, localDisabledTheme.manifest.name, "Unexpected extension for @disabled query.");
      assert.strictEqual(result.get(1).name, localDisabledLanguage.manifest.name, "Unexpected extension for @disabled query.");
    });
    await testableView.show("@enabled").then((result) => {
      assert.strictEqual(result.length, 3, "Unexpected number of results for @enabled query");
      assert.strictEqual(result.get(0).name, localEnabledTheme.manifest.name, "Unexpected extension for @enabled query.");
      assert.strictEqual(result.get(1).name, localRandom.manifest.name, "Unexpected extension for @enabled query.");
      assert.strictEqual(result.get(2).name, localEnabledLanguage.manifest.name, "Unexpected extension for @enabled query.");
    });
    await testableView.show("@builtin category:themes").then((result) => {
      assert.strictEqual(result.length, 1, "Unexpected number of results for @builtin category:themes query");
      assert.strictEqual(result.get(0).name, builtInTheme.manifest.name, "Unexpected extension for @builtin:themes query.");
    });
    await testableView.show('@builtin category:"programming languages"').then((result) => {
      assert.strictEqual(result.length, 1, "Unexpected number of results for @builtin:basics query");
      assert.strictEqual(result.get(0).name, builtInBasic.manifest.name, "Unexpected extension for @builtin:basics query.");
    });
    await testableView.show("@builtin").then((result) => {
      assert.strictEqual(result.length, 2, "Unexpected number of results for @builtin query");
      assert.strictEqual(result.get(0).name, builtInBasic.manifest.name, "Unexpected extension for @builtin query.");
      assert.strictEqual(result.get(1).name, builtInTheme.manifest.name, "Unexpected extension for @builtin query.");
    });
    await testableView.show("@builtin my-theme").then((result) => {
      assert.strictEqual(result.length, 1, "Unexpected number of results for @builtin query");
      assert.strictEqual(result.get(0).name, builtInTheme.manifest.name, "Unexpected extension for @builtin query.");
    });
  });
  test("Test installed query with category", async () => {
    await testableView.show("@installed category:themes").then((result) => {
      assert.strictEqual(result.length, 2, "Unexpected number of results for @installed query with category");
      assert.strictEqual(result.get(0).name, localEnabledTheme.manifest.name, "Unexpected extension for @installed query with category.");
      assert.strictEqual(result.get(1).name, localDisabledTheme.manifest.name, "Unexpected extension for @installed query with category.");
    });
    await testableView.show('@installed category:"themes"').then((result) => {
      assert.strictEqual(result.length, 2, "Unexpected number of results for @installed query with quoted category");
      assert.strictEqual(result.get(0).name, localEnabledTheme.manifest.name, "Unexpected extension for @installed query with quoted category.");
      assert.strictEqual(result.get(1).name, localDisabledTheme.manifest.name, "Unexpected extension for @installed query with quoted category.");
    });
    await testableView.show('@installed category:"programming languages"').then((result) => {
      assert.strictEqual(result.length, 2, "Unexpected number of results for @installed query with quoted category including space");
      assert.strictEqual(result.get(0).name, localEnabledLanguage.manifest.name, "Unexpected extension for @installed query with quoted category including space.");
      assert.strictEqual(result.get(1).name, localDisabledLanguage.manifest.name, "Unexpected extension for @installed query with quoted category inlcuding space.");
    });
    await testableView.show("@installed category:themes category:random").then((result) => {
      assert.strictEqual(result.length, 3, "Unexpected number of results for @installed query with multiple category");
      assert.strictEqual(result.get(0).name, localEnabledTheme.manifest.name, "Unexpected extension for @installed query with multiple category.");
      assert.strictEqual(result.get(1).name, localRandom.manifest.name, "Unexpected extension for @installed query with multiple category.");
      assert.strictEqual(result.get(2).name, localDisabledTheme.manifest.name, "Unexpected extension for @installed query with multiple category.");
    });
    await testableView.show("@enabled category:themes").then((result) => {
      assert.strictEqual(result.length, 1, "Unexpected number of results for @enabled query with category");
      assert.strictEqual(result.get(0).name, localEnabledTheme.manifest.name, "Unexpected extension for @enabled query with category.");
    });
    await testableView.show('@enabled category:"themes"').then((result) => {
      assert.strictEqual(result.length, 1, "Unexpected number of results for @enabled query with quoted category");
      assert.strictEqual(result.get(0).name, localEnabledTheme.manifest.name, "Unexpected extension for @enabled query with quoted category.");
    });
    await testableView.show('@enabled category:"programming languages"').then((result) => {
      assert.strictEqual(result.length, 1, "Unexpected number of results for @enabled query with quoted category inlcuding space");
      assert.strictEqual(result.get(0).name, localEnabledLanguage.manifest.name, "Unexpected extension for @enabled query with quoted category including space.");
    });
    await testableView.show("@disabled category:themes").then((result) => {
      assert.strictEqual(result.length, 1, "Unexpected number of results for @disabled query with category");
      assert.strictEqual(result.get(0).name, localDisabledTheme.manifest.name, "Unexpected extension for @disabled query with category.");
    });
    await testableView.show('@disabled category:"themes"').then((result) => {
      assert.strictEqual(result.length, 1, "Unexpected number of results for @disabled query with quoted category");
      assert.strictEqual(result.get(0).name, localDisabledTheme.manifest.name, "Unexpected extension for @disabled query with quoted category.");
    });
    await testableView.show('@disabled category:"programming languages"').then((result) => {
      assert.strictEqual(result.length, 1, "Unexpected number of results for @disabled query with quoted category inlcuding space");
      assert.strictEqual(result.get(0).name, localDisabledLanguage.manifest.name, "Unexpected extension for @disabled query with quoted category including space.");
    });
  });
  test("Test local query with sorting order", async () => {
    await testableView.show("@recentlyUpdated").then((result) => {
      assert.strictEqual(result.length, 1, "Unexpected number of results for @recentlyUpdated");
      assert.strictEqual(result.get(0).name, localDisabledLanguage.manifest.name, "Unexpected default sort order of extensions for @recentlyUpdate query");
    });
    await testableView.show("@installed @sort:updateDate").then((result) => {
      assert.strictEqual(result.length, 5, "Unexpected number of results for @sort:updateDate. Expected all localy installed Extension which are not builtin");
      const actual = [result.get(0).local?.installedTimestamp, result.get(1).local?.installedTimestamp, result.get(2).local?.installedTimestamp, result.get(3).local?.installedTimestamp, result.get(4).local?.installedTimestamp];
      const expected = [localEnabledLanguage.installedTimestamp, localDisabledLanguage.installedTimestamp, localRandom.installedTimestamp, localDisabledTheme.installedTimestamp, localEnabledTheme.installedTimestamp];
      for (let i = 0; i < result.length; i++) {
        assert.strictEqual(actual[i], expected[i], "Unexpected extension sorting for @sort:updateDate query.");
      }
    });
  });
  test("Test @recommended:workspace query", () => {
    const workspaceRecommendedExtensions = [
      workspaceRecommendationA,
      workspaceRecommendationB,
      configBasedRecommendationA
    ];
    return testableView.show("@recommended:workspace").then((result) => {
      assert.strictEqual(result.length, workspaceRecommendedExtensions.length);
      for (let i = 0; i < workspaceRecommendedExtensions.length; i++) {
        assert.strictEqual(result.get(i).identifier.id, workspaceRecommendedExtensions[i].identifier.id);
      }
    });
  });
  test("Test @recommended query", async () => {
    const allRecommendedExtensions = [
      fileBasedRecommendationA,
      fileBasedRecommendationB,
      configBasedRecommendationB,
      otherRecommendationA
    ];
    const result = await testableView.show("@recommended");
    assert.strictEqual(result.length, allRecommendedExtensions.length);
    for (let i = 0; i < allRecommendedExtensions.length; i++) {
      assert.strictEqual(result.get(i).identifier.id, allRecommendedExtensions[i].identifier.id);
    }
  });
  test("Test @recommended:all query", async () => {
    const allRecommendedExtensions = [
      workspaceRecommendationA,
      workspaceRecommendationB,
      configBasedRecommendationA,
      fileBasedRecommendationA,
      fileBasedRecommendationB,
      configBasedRecommendationB,
      otherRecommendationA
    ];
    const result = await testableView.show("@recommended:all");
    assert.strictEqual(result.length, allRecommendedExtensions.length);
    for (let i = 0; i < allRecommendedExtensions.length; i++) {
      assert.strictEqual(result.get(i).identifier.id, allRecommendedExtensions[i].identifier.id);
    }
  });
  test("Test search", async () => {
    const results = [
      fileBasedRecommendationA,
      workspaceRecommendationA,
      otherRecommendationA,
      workspaceRecommendationB
    ];
    queryPage = aPage(results);
    const result = await testableView.show("search-me");
    assert.strictEqual(result.length, results.length);
    for (let i = 0; i < results.length; i++) {
      assert.strictEqual(result.get(i).identifier.id, results[i].identifier.id);
    }
  });
  test("Test preferred search experiment", async () => {
    queryPage = aPage([
      fileBasedRecommendationA,
      workspaceRecommendationA,
      otherRecommendationA,
      workspaceRecommendationB
    ], 5);
    const notInFirstPage = aGalleryExtension("not-in-first-page");
    galleryExtensions.push(notInFirstPage);
    const expected = [
      workspaceRecommendationA,
      notInFirstPage,
      workspaceRecommendationB,
      fileBasedRecommendationA,
      otherRecommendationA
    ];
    instantiationService.stubPromise(IWorkbenchExtensionManagementService, "getExtensionsControlManifest", {
      malicious: [],
      deprecated: {},
      search: [{
        query: "search-me",
        preferredResults: [
          workspaceRecommendationA.identifier.id,
          notInFirstPage.identifier.id,
          workspaceRecommendationB.identifier.id
        ]
      }]
    });
    const testObject = disposableStore.add(instantiationService.createInstance(ExtensionsListView, {}, { id: "", title: "" }));
    const result = await testObject.show("search-me");
    assert.strictEqual(result.length, expected.length);
    for (let i = 0; i < expected.length; i++) {
      assert.strictEqual(result.get(i).identifier.id, expected[i].identifier.id);
    }
  });
  test("Skip preferred search experiment when user defines sort order", async () => {
    const realResults = [
      fileBasedRecommendationA,
      workspaceRecommendationA,
      otherRecommendationA,
      workspaceRecommendationB
    ];
    queryPage = aPage(realResults);
    const result = await testableView.show("search-me @sort:installs");
    assert.strictEqual(result.length, realResults.length);
    for (let i = 0; i < realResults.length; i++) {
      assert.strictEqual(result.get(i).identifier.id, realResults[i].identifier.id);
    }
  });
  function aLocalExtension(name = "someext", manifest = {}, properties = {}) {
    manifest = { name, publisher: "pub", version: "1.0.0", ...manifest };
    properties = {
      type: ExtensionType.User,
      location: URI.file(`pub.${name}`),
      identifier: { id: getGalleryExtensionId(manifest.publisher, manifest.name) },
      metadata: { id: getGalleryExtensionId(manifest.publisher, manifest.name), publisherId: manifest.publisher, publisherDisplayName: "somename" },
      ...properties,
      isValid: properties.isValid ?? true
    };
    properties.isBuiltin = properties.type === ExtensionType.System;
    return /* @__PURE__ */ Object.create({ manifest, ...properties });
  }
  function aGalleryExtension(name, properties = {}, galleryExtensionProperties = {}, assets = {}) {
    const targetPlatform = getTargetPlatform(platform, arch);
    const galleryExtension = /* @__PURE__ */ Object.create({ name, publisher: "pub", version: "1.0.0", allTargetPlatforms: [targetPlatform], properties: {}, assets: {}, ...properties });
    galleryExtension.properties = { ...galleryExtension.properties, dependencies: [], targetPlatform, ...galleryExtensionProperties };
    galleryExtension.assets = { ...galleryExtension.assets, ...assets };
    galleryExtension.identifier = { id: getGalleryExtensionId(galleryExtension.publisher, galleryExtension.name), uuid: generateUuid() };
    return galleryExtension;
  }
  function aPage(objects = [], total) {
    return { firstPage: objects, total: total ?? objects.length, pageSize: objects.length, getPage: () => null };
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL3Rlc3QvZWxlY3Ryb24tc2FuZGJveC9leHRlbnNpb25zVmlld3MudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uc0xpc3RWaWV3IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9leHRlbnNpb25zVmlld3MuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL2V4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmpzJztcbmltcG9ydCB7XG5cdElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwgSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLCBJTG9jYWxFeHRlbnNpb24sIElHYWxsZXJ5RXh0ZW5zaW9uLCBJUXVlcnlPcHRpb25zLFxuXHRnZXRUYXJnZXRQbGF0Zm9ybSwgU29ydEJ5XG59IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCBFbmFibGVtZW50U3RhdGUsIElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSwgSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIsIElQcm9maWxlQXdhcmVFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwgSVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZSwgRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25SZWFzb24gfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25SZWNvbW1lbmRhdGlvbnMvY29tbW9uL2V4dGVuc2lvblJlY29tbWVuZGF0aW9ucy5qcyc7XG5pbXBvcnQgeyBnZXRHYWxsZXJ5RXh0ZW5zaW9uSWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50VXRpbC5qcyc7XG5pbXBvcnQgeyBUZXN0RXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25NYW5hZ2VtZW50L3Rlc3QvYnJvd3Nlci9leHRlbnNpb25FbmFibGVtZW50U2VydmljZS50ZXN0LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVSTFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmwvY29tbW9uL3VybC5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElQYWdlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhZ2luZy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IE51bGxUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnlVdGlscy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSwgdG9FeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgVGVzdE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBUZXN0U2hhcmVkUHJvY2Vzc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2VsZWN0cm9uLXNhbmRib3gvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UsIE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgTmF0aXZlVVJMU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VybC9jb21tb24vdXJsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2lub25TdHViIH0gZnJvbSAnc2lub24nO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9lbGVjdHJvbi1zYW5kYm94L3JlbW90ZUFnZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25UeXBlLCBJRXh0ZW5zaW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJU2hhcmVkUHJvY2Vzc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pcGMvZWxlY3Ryb24tc2FuZGJveC9zZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IE1vY2tDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvdGVzdC9jb21tb24vbW9ja0tleWJpbmRpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgVGVzdENvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsIFZpZXdDb250YWluZXJMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGFyY2ggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wcm9jZXNzLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSVVwZGF0ZVNlcnZpY2UsIFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXBkYXRlL2NvbW1vbi91cGRhdGUuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgVXNlckRhdGFQcm9maWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyB0b1VzZXJEYXRhUHJvZmlsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcblxuc3VpdGUoJ0V4dGVuc2lvbnNWaWV3cyBUZXN0cycsICgpID0+IHtcblxuXHRjb25zdCBkaXNwb3NhYmxlU3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblx0bGV0IHRlc3RhYmxlVmlldzogRXh0ZW5zaW9uc0xpc3RWaWV3O1xuXG5cdGNvbnN0IGxvY2FsRW5hYmxlZFRoZW1lID0gYUxvY2FsRXh0ZW5zaW9uKCdmaXJzdC1lbmFibGVkLWV4dGVuc2lvbicsIHsgY2F0ZWdvcmllczogWydUaGVtZXMnLCAncmFuZG9tJ10gfSwgeyBpbnN0YWxsZWRUaW1lc3RhbXA6IDEyMzQ1NiB9KTtcblx0Y29uc3QgbG9jYWxFbmFibGVkTGFuZ3VhZ2UgPSBhTG9jYWxFeHRlbnNpb24oJ3NlY29uZC1lbmFibGVkLWV4dGVuc2lvbicsIHsgY2F0ZWdvcmllczogWydQcm9ncmFtbWluZyBsYW5ndWFnZXMnXSwgdmVyc2lvbjogJzEuMC4wJyB9LCB7IGluc3RhbGxlZFRpbWVzdGFtcDogRGF0ZS5ub3coKSwgdXBkYXRlZDogZmFsc2UgfSk7XG5cdGNvbnN0IGxvY2FsRGlzYWJsZWRUaGVtZSA9IGFMb2NhbEV4dGVuc2lvbignZmlyc3QtZGlzYWJsZWQtZXh0ZW5zaW9uJywgeyBjYXRlZ29yaWVzOiBbJ3RoZW1lcyddIH0sIHsgaW5zdGFsbGVkVGltZXN0YW1wOiAyMzQ1NjcgfSk7XG5cdGNvbnN0IGxvY2FsRGlzYWJsZWRMYW5ndWFnZSA9IGFMb2NhbEV4dGVuc2lvbignc2Vjb25kLWRpc2FibGVkLWV4dGVuc2lvbicsIHsgY2F0ZWdvcmllczogWydwcm9ncmFtbWluZyBsYW5ndWFnZXMnXSB9LCB7IGluc3RhbGxlZFRpbWVzdGFtcDogRGF0ZS5ub3coKSAtIDUwMDAwLCB1cGRhdGVkOiB0cnVlIH0pO1xuXHRjb25zdCBsb2NhbFJhbmRvbSA9IGFMb2NhbEV4dGVuc2lvbigncmFuZG9tLWVuYWJsZWQtZXh0ZW5zaW9uJywgeyBjYXRlZ29yaWVzOiBbJ3JhbmRvbSddIH0sIHsgaW5zdGFsbGVkVGltZXN0YW1wOiAzNDU2NzggfSk7XG5cdGNvbnN0IGJ1aWx0SW5UaGVtZSA9IGFMb2NhbEV4dGVuc2lvbignbXktdGhlbWUnLCB7IGNhdGVnb3JpZXM6IFsnVGhlbWVzJ10sIGNvbnRyaWJ1dGVzOiB7IHRoZW1lczogWydteS10aGVtZSddIH0gfSwgeyB0eXBlOiBFeHRlbnNpb25UeXBlLlN5c3RlbSwgaW5zdGFsbGVkVGltZXN0YW1wOiAyMjIgfSk7XG5cdGNvbnN0IGJ1aWx0SW5CYXNpYyA9IGFMb2NhbEV4dGVuc2lvbignbXktbGFuZycsIHsgY2F0ZWdvcmllczogWydQcm9ncmFtbWluZyBMYW5ndWFnZXMnXSwgY29udHJpYnV0ZXM6IHsgZ3JhbW1hcnM6IFt7IGxhbmd1YWdlOiAnbXktbGFuZ3VhZ2UnIH1dIH0gfSwgeyB0eXBlOiBFeHRlbnNpb25UeXBlLlN5c3RlbSwgaW5zdGFsbGVkVGltZXN0YW1wOiA2NjY2NjYgfSk7XG5cblx0bGV0IHF1ZXJ5UGFnZSA9IGFQYWdlKFtdKTtcblx0Y29uc3QgZ2FsbGVyeUV4dGVuc2lvbnM6IElHYWxsZXJ5RXh0ZW5zaW9uW10gPSBbXTtcblxuXHRjb25zdCB3b3Jrc3BhY2VSZWNvbW1lbmRhdGlvbkEgPSBhR2FsbGVyeUV4dGVuc2lvbignd29ya3NwYWNlLXJlY29tbWVuZGF0aW9uLUEnKTtcblx0Y29uc3Qgd29ya3NwYWNlUmVjb21tZW5kYXRpb25CID0gYUdhbGxlcnlFeHRlbnNpb24oJ3dvcmtzcGFjZS1yZWNvbW1lbmRhdGlvbi1CJyk7XG5cdGNvbnN0IGNvbmZpZ0Jhc2VkUmVjb21tZW5kYXRpb25BID0gYUdhbGxlcnlFeHRlbnNpb24oJ2NvbmZpZ2Jhc2VkLXJlY29tbWVuZGF0aW9uLUEnKTtcblx0Y29uc3QgY29uZmlnQmFzZWRSZWNvbW1lbmRhdGlvbkIgPSBhR2FsbGVyeUV4dGVuc2lvbignY29uZmlnYmFzZWQtcmVjb21tZW5kYXRpb24tQicpO1xuXHRjb25zdCBmaWxlQmFzZWRSZWNvbW1lbmRhdGlvbkEgPSBhR2FsbGVyeUV4dGVuc2lvbignZmlsZWJhc2VkLXJlY29tbWVuZGF0aW9uLUEnKTtcblx0Y29uc3QgZmlsZUJhc2VkUmVjb21tZW5kYXRpb25CID0gYUdhbGxlcnlFeHRlbnNpb24oJ2ZpbGViYXNlZC1yZWNvbW1lbmRhdGlvbi1CJyk7XG5cdGNvbnN0IG90aGVyUmVjb21tZW5kYXRpb25BID0gYUdhbGxlcnlFeHRlbnNpb24oJ290aGVyLXJlY29tbWVuZGF0aW9uLUEnKTtcblxuXHRzZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGVsZW1ldHJ5U2VydmljZSwgTnVsbFRlbGVtZXRyeVNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUxvZ1NlcnZpY2UsIE51bGxMb2dTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElGaWxlU2VydmljZSwgZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgRmlsZVNlcnZpY2UobmV3IE51bGxMb2dTZXJ2aWNlKCkpKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJUHJvZHVjdFNlcnZpY2UsIHt9KTtcblxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBuZXcgVGVzdENvbnRleHRTZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpO1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsIEV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTaGFyZWRQcm9jZXNzU2VydmljZSwgVGVzdFNoYXJlZFByb2Nlc3NTZXJ2aWNlKTtcblxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCB7XG5cdFx0XHRvbkluc3RhbGxFeHRlbnNpb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZEluc3RhbGxFeHRlbnNpb25zOiBFdmVudC5Ob25lLFxuXHRcdFx0b25Vbmluc3RhbGxFeHRlbnNpb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZFVuaW5zdGFsbEV4dGVuc2lvbjogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkVXBkYXRlRXh0ZW5zaW9uTWV0YWRhdGE6IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZENoYW5nZVByb2ZpbGU6IEV2ZW50Lk5vbmUsXG5cdFx0XHRvblByb2ZpbGVBd2FyZURpZEluc3RhbGxFeHRlbnNpb25zOiBFdmVudC5Ob25lLFxuXHRcdFx0YXN5bmMgZ2V0SW5zdGFsbGVkKCkgeyByZXR1cm4gW107IH0sXG5cdFx0XHRhc3luYyBnZXRJbnN0YWxsZWRXb3Jrc3BhY2VFeHRlbnNpb25zKCkgeyByZXR1cm4gW107IH0sXG5cdFx0XHRhc3luYyBjYW5JbnN0YWxsKCkgeyByZXR1cm4gdHJ1ZTsgfSxcblx0XHRcdGFzeW5jIGdldEV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3QoKSB7IHJldHVybiB7IG1hbGljaW91czogW10sIGRlcHJlY2F0ZWQ6IHt9LCBzZWFyY2g6IFtdLCBwdWJsaXNoZXJNYXBwaW5nOiB7fSB9OyB9LFxuXHRcdFx0YXN5bmMgZ2V0VGFyZ2V0UGxhdGZvcm0oKSB7IHJldHVybiBnZXRUYXJnZXRQbGF0Zm9ybShwbGF0Zm9ybSwgYXJjaCk7IH0sXG5cdFx0XHRhc3luYyB1cGRhdGVNZXRhZGF0YShsb2NhbCkgeyByZXR1cm4gbG9jYWw7IH1cblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElSZW1vdGVBZ2VudFNlcnZpY2UsIFJlbW90ZUFnZW50U2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udGV4dEtleVNlcnZpY2UsIG5ldyBNb2NrQ29udGV4dEtleVNlcnZpY2UoKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTWVudVNlcnZpY2UsIG5ldyBUZXN0TWVudVNlcnZpY2UoKSk7XG5cblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIgPSB7IGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlOiBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlKSBhcyBJUHJvZmlsZUF3YXJlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsIGxhYmVsOiAnbG9jYWwnLCBpZDogJ3ZzY29kZS1sb2NhbCcgfTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSwge1xuXHRcdFx0Z2V0IGxvY2FsRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcigpOiBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciB7XG5cdFx0XHRcdHJldHVybiBsb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXI7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0RXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcihleHRlbnNpb246IElFeHRlbnNpb24pOiBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciB8IG51bGwge1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uLmxvY2F0aW9uLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGxvY2FsRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgRXh0ZW5zaW9uICR7ZXh0ZW5zaW9uLmxvY2F0aW9ufWApO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFRlc3RFeHRlbnNpb25FbmFibGVtZW50U2VydmljZShpbnN0YW50aWF0aW9uU2VydmljZSkpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlLCBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlKHRvVXNlckRhdGFQcm9maWxlKCd0ZXN0JywgJ3Rlc3QnLCBVUkkuZmlsZSgnZm9vJyksIFVSSS5maWxlKCdjYWNoZScpKSkpKTtcblxuXHRcdGNvbnN0IHJlYXNvbnM6IHsgW2tleTogc3RyaW5nXTogYW55IH0gPSB7fTtcblx0XHRyZWFzb25zW3dvcmtzcGFjZVJlY29tbWVuZGF0aW9uQS5pZGVudGlmaWVyLmlkXSA9IHsgcmVhc29uSWQ6IEV4dGVuc2lvblJlY29tbWVuZGF0aW9uUmVhc29uLldvcmtzcGFjZSB9O1xuXHRcdHJlYXNvbnNbd29ya3NwYWNlUmVjb21tZW5kYXRpb25CLmlkZW50aWZpZXIuaWRdID0geyByZWFzb25JZDogRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25SZWFzb24uV29ya3NwYWNlIH07XG5cdFx0cmVhc29uc1tmaWxlQmFzZWRSZWNvbW1lbmRhdGlvbkEuaWRlbnRpZmllci5pZF0gPSB7IHJlYXNvbklkOiBFeHRlbnNpb25SZWNvbW1lbmRhdGlvblJlYXNvbi5GaWxlIH07XG5cdFx0cmVhc29uc1tmaWxlQmFzZWRSZWNvbW1lbmRhdGlvbkIuaWRlbnRpZmllci5pZF0gPSB7IHJlYXNvbklkOiBFeHRlbnNpb25SZWNvbW1lbmRhdGlvblJlYXNvbi5GaWxlIH07XG5cdFx0cmVhc29uc1tvdGhlclJlY29tbWVuZGF0aW9uQS5pZGVudGlmaWVyLmlkXSA9IHsgcmVhc29uSWQ6IEV4dGVuc2lvblJlY29tbWVuZGF0aW9uUmVhc29uLkV4ZWN1dGFibGUgfTtcblx0XHRyZWFzb25zW2NvbmZpZ0Jhc2VkUmVjb21tZW5kYXRpb25BLmlkZW50aWZpZXIuaWRdID0geyByZWFzb25JZDogRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25SZWFzb24uV29ya3NwYWNlQ29uZmlnIH07XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZSwge1xuXHRcdFx0Z2V0V29ya3NwYWNlUmVjb21tZW5kYXRpb25zKCkge1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFtcblx0XHRcdFx0XHR3b3Jrc3BhY2VSZWNvbW1lbmRhdGlvbkEuaWRlbnRpZmllci5pZCxcblx0XHRcdFx0XHR3b3Jrc3BhY2VSZWNvbW1lbmRhdGlvbkIuaWRlbnRpZmllci5pZF0pO1xuXHRcdFx0fSxcblx0XHRcdGdldENvbmZpZ0Jhc2VkUmVjb21tZW5kYXRpb25zKCkge1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHtcblx0XHRcdFx0XHRpbXBvcnRhbnQ6IFtjb25maWdCYXNlZFJlY29tbWVuZGF0aW9uQS5pZGVudGlmaWVyLmlkXSxcblx0XHRcdFx0XHRvdGhlcnM6IFtjb25maWdCYXNlZFJlY29tbWVuZGF0aW9uQi5pZGVudGlmaWVyLmlkXSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0SW1wb3J0YW50UmVjb21tZW5kYXRpb25zKCk6IFByb21pc2U8c3RyaW5nW10+IHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShbXSk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0RmlsZUJhc2VkUmVjb21tZW5kYXRpb25zKCkge1xuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdGZpbGVCYXNlZFJlY29tbWVuZGF0aW9uQS5pZGVudGlmaWVyLmlkLFxuXHRcdFx0XHRcdGZpbGVCYXNlZFJlY29tbWVuZGF0aW9uQi5pZGVudGlmaWVyLmlkXG5cdFx0XHRcdF07XG5cdFx0XHR9LFxuXHRcdFx0Z2V0T3RoZXJSZWNvbW1lbmRhdGlvbnMoKSB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoW1xuXHRcdFx0XHRcdGNvbmZpZ0Jhc2VkUmVjb21tZW5kYXRpb25CLmlkZW50aWZpZXIuaWQsXG5cdFx0XHRcdFx0b3RoZXJSZWNvbW1lbmRhdGlvbkEuaWRlbnRpZmllci5pZFxuXHRcdFx0XHRdKTtcblx0XHRcdH0sXG5cdFx0XHRnZXRBbGxSZWNvbW1lbmRhdGlvbnNXaXRoUmVhc29uKCkge1xuXHRcdFx0XHRyZXR1cm4gcmVhc29ucztcblx0XHRcdH1cblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVUkxTZXJ2aWNlLCBOYXRpdmVVUkxTZXJ2aWNlKTtcblxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWJQcm9taXNlKElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwgJ2dldEluc3RhbGxlZCcsIFtsb2NhbEVuYWJsZWRUaGVtZSwgbG9jYWxFbmFibGVkTGFuZ3VhZ2UsIGxvY2FsUmFuZG9tLCBsb2NhbERpc2FibGVkVGhlbWUsIGxvY2FsRGlzYWJsZWRMYW5ndWFnZSwgYnVpbHRJblRoZW1lLCBidWlsdEluQmFzaWNdKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViUHJvbWlzZShJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsICdnZXRFeHRlbnNnZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0aW9uc1JlcG9ydCcsIHt9KTtcblxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLCA8UGFydGlhbDxJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2U+Pntcblx0XHRcdHF1ZXJ5OiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHJldHVybiBxdWVyeVBhZ2U7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0Q29tcGF0aWJsZUV4dGVuc2lvbjogYXN5bmMgKGdhbGxlcnkpID0+IHtcblx0XHRcdFx0cmV0dXJuIGdhbGxlcnk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0RXh0ZW5zaW9uczogYXN5bmMgKGluZm9zKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdDogSUdhbGxlcnlFeHRlbnNpb25bXSA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGluZm8gb2YgaW5mb3MpIHtcblx0XHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSBnYWxsZXJ5RXh0ZW5zaW9ucy5maW5kKGUgPT4gZS5pZGVudGlmaWVyLmlkID09PSBpbmZvLmlkKTtcblx0XHRcdFx0XHRpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQucHVzaChleHRlbnNpb24pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSxcblx0XHRcdGlzRW5hYmxlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdGlzRXh0ZW5zaW9uQ29tcGF0aWJsZTogYXN5bmMgKCkgPT4gdHJ1ZSxcblx0XHR9KTtcblxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdEZXNjcmlwdG9yU2VydmljZSwge1xuXHRcdFx0Z2V0Vmlld0xvY2F0aW9uQnlJZCgpOiBWaWV3Q29udGFpbmVyTG9jYXRpb24ge1xuXHRcdFx0XHRyZXR1cm4gVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXI7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VMb2NhdGlvbjogRXZlbnQuTm9uZVxuXHRcdH0pO1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRXh0ZW5zaW9uU2VydmljZSwge1xuXHRcdFx0b25EaWRDaGFuZ2VFeHRlbnNpb25zOiBFdmVudC5Ob25lLFxuXHRcdFx0ZXh0ZW5zaW9uczogW1xuXHRcdFx0XHR0b0V4dGVuc2lvbkRlc2NyaXB0aW9uKGxvY2FsRW5hYmxlZFRoZW1lKSxcblx0XHRcdFx0dG9FeHRlbnNpb25EZXNjcmlwdGlvbihsb2NhbEVuYWJsZWRMYW5ndWFnZSksXG5cdFx0XHRcdHRvRXh0ZW5zaW9uRGVzY3JpcHRpb24obG9jYWxSYW5kb20pLFxuXHRcdFx0XHR0b0V4dGVuc2lvbkRlc2NyaXB0aW9uKGJ1aWx0SW5UaGVtZSksXG5cdFx0XHRcdHRvRXh0ZW5zaW9uRGVzY3JpcHRpb24oYnVpbHRJbkJhc2ljKVxuXHRcdFx0XSxcblx0XHRcdGNhbkFkZEV4dGVuc2lvbjogKGV4dGVuc2lvbikgPT4gdHJ1ZSxcblx0XHRcdHdoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZDogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKHRydWUpXG5cdFx0fSk7XG5cdFx0YXdhaXQgKDxUZXN0RXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2U+aW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSkpLnNldEVuYWJsZW1lbnQoW2xvY2FsRGlzYWJsZWRUaGVtZV0sIEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEdsb2JhbGx5KTtcblx0XHRhd2FpdCAoPFRlc3RFeHRlbnNpb25FbmFibGVtZW50U2VydmljZT5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlKSkuc2V0RW5hYmxlbWVudChbbG9jYWxEaXNhYmxlZExhbmd1YWdlXSwgRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkR2xvYmFsbHkpO1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVXBkYXRlU2VydmljZSwgeyBvblN0YXRlQ2hhbmdlOiBFdmVudC5Ob25lLCBzdGF0ZTogU3RhdGUuVW5pbml0aWFsaXplZCB9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zZXQoSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLCBkaXNwb3NhYmxlU3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKSkpO1xuXHRcdHRlc3RhYmxlVmlldyA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9uc0xpc3RWaWV3LCB7fSwgeyBpZDogJycsIHRpdGxlOiAnJyB9KSk7XG5cdFx0cXVlcnlQYWdlID0gYVBhZ2UoW10pO1xuXG5cdFx0Z2FsbGVyeUV4dGVuc2lvbnMuc3BsaWNlKDAsIGdhbGxlcnlFeHRlbnNpb25zLmxlbmd0aCwgLi4uW1xuXHRcdFx0d29ya3NwYWNlUmVjb21tZW5kYXRpb25BLFxuXHRcdFx0d29ya3NwYWNlUmVjb21tZW5kYXRpb25CLFxuXHRcdFx0Y29uZmlnQmFzZWRSZWNvbW1lbmRhdGlvbkEsXG5cdFx0XHRjb25maWdCYXNlZFJlY29tbWVuZGF0aW9uQixcblx0XHRcdGZpbGVCYXNlZFJlY29tbWVuZGF0aW9uQSxcblx0XHRcdGZpbGVCYXNlZFJlY29tbWVuZGF0aW9uQixcblx0XHRcdG90aGVyUmVjb21tZW5kYXRpb25BXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlc3QgcXVlcnkgdHlwZXMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKEV4dGVuc2lvbnNMaXN0Vmlldy5pc0J1aWx0SW5FeHRlbnNpb25zUXVlcnkoJ0BidWlsdGluJyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChFeHRlbnNpb25zTGlzdFZpZXcuaXNMb2NhbEV4dGVuc2lvbnNRdWVyeSgnQGluc3RhbGxlZCcpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoRXh0ZW5zaW9uc0xpc3RWaWV3LmlzTG9jYWxFeHRlbnNpb25zUXVlcnkoJ0BlbmFibGVkJyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChFeHRlbnNpb25zTGlzdFZpZXcuaXNMb2NhbEV4dGVuc2lvbnNRdWVyeSgnQGRpc2FibGVkJyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChFeHRlbnNpb25zTGlzdFZpZXcuaXNMb2NhbEV4dGVuc2lvbnNRdWVyeSgnQG91dGRhdGVkJyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChFeHRlbnNpb25zTGlzdFZpZXcuaXNMb2NhbEV4dGVuc2lvbnNRdWVyeSgnQHVwZGF0ZXMnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKEV4dGVuc2lvbnNMaXN0Vmlldy5pc0xvY2FsRXh0ZW5zaW9uc1F1ZXJ5KCdAc29ydDpuYW1lJyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChFeHRlbnNpb25zTGlzdFZpZXcuaXNMb2NhbEV4dGVuc2lvbnNRdWVyeSgnQHNvcnQ6dXBkYXRlRGF0ZScpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoRXh0ZW5zaW9uc0xpc3RWaWV3LmlzTG9jYWxFeHRlbnNpb25zUXVlcnkoJ0BpbnN0YWxsZWQgc2VhcmNoVGV4dCcpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoRXh0ZW5zaW9uc0xpc3RWaWV3LmlzTG9jYWxFeHRlbnNpb25zUXVlcnkoJ0BlbmFibGVkIHNlYXJjaFRleHQnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKEV4dGVuc2lvbnNMaXN0Vmlldy5pc0xvY2FsRXh0ZW5zaW9uc1F1ZXJ5KCdAZGlzYWJsZWQgc2VhcmNoVGV4dCcpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoRXh0ZW5zaW9uc0xpc3RWaWV3LmlzTG9jYWxFeHRlbnNpb25zUXVlcnkoJ0BvdXRkYXRlZCBzZWFyY2hUZXh0JyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChFeHRlbnNpb25zTGlzdFZpZXcuaXNMb2NhbEV4dGVuc2lvbnNRdWVyeSgnQHVwZGF0ZXMgc2VhcmNoVGV4dCcpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnVGVzdCBlbXB0eSBxdWVyeSBlcXVhdGVzIHRvIHNvcnQgYnkgaW5zdGFsbCBjb3VudCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0YXJnZXQgPSA8U2lub25TdHViPmluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWJQcm9taXNlKElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSwgJ3F1ZXJ5JywgYVBhZ2UoKSk7XG5cdFx0YXdhaXQgdGVzdGFibGVWaWV3LnNob3coJycpO1xuXHRcdGFzc2VydC5vayh0YXJnZXQuY2FsbGVkT25jZSk7XG5cdFx0Y29uc3Qgb3B0aW9uczogSVF1ZXJ5T3B0aW9ucyA9IHRhcmdldC5hcmdzWzBdWzBdO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvcHRpb25zLnNvcnRCeSwgU29ydEJ5Lkluc3RhbGxDb3VudCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlc3Qgbm9uIGVtcHR5IHF1ZXJ5IHdpdGhvdXQgc29ydCBkb2VzbnQgdXNlIHNvcnRCeScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0YXJnZXQgPSA8U2lub25TdHViPmluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWJQcm9taXNlKElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSwgJ3F1ZXJ5JywgYVBhZ2UoKSk7XG5cdFx0YXdhaXQgdGVzdGFibGVWaWV3LnNob3coJ3NvbWUgZXh0ZW5zaW9uJyk7XG5cdFx0YXNzZXJ0Lm9rKHRhcmdldC5jYWxsZWRPbmNlKTtcblx0XHRjb25zdCBvcHRpb25zOiBJUXVlcnlPcHRpb25zID0gdGFyZ2V0LmFyZ3NbMF1bMF07XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9wdGlvbnMuc29ydEJ5LCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXN0IHF1ZXJ5IHdpdGggc29ydCB1c2VzIHNvcnRCeScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0YXJnZXQgPSA8U2lub25TdHViPmluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWJQcm9taXNlKElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSwgJ3F1ZXJ5JywgYVBhZ2UoKSk7XG5cdFx0YXdhaXQgdGVzdGFibGVWaWV3LnNob3coJ3NvbWUgZXh0ZW5zaW9uIEBzb3J0OnJhdGluZycpO1xuXHRcdGFzc2VydC5vayh0YXJnZXQuY2FsbGVkT25jZSk7XG5cdFx0Y29uc3Qgb3B0aW9uczogSVF1ZXJ5T3B0aW9ucyA9IHRhcmdldC5hcmdzWzBdWzBdO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvcHRpb25zLnNvcnRCeSwgU29ydEJ5LldlaWdodGVkUmF0aW5nKTtcblx0fSk7XG5cblx0dGVzdCgnVGVzdCBkZWZhdWx0IHZpZXcgYWN0aW9ucyByZXF1aXJlZCBzb3J0aW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdHF1ZXJ5UGFnZSA9IGFQYWdlKFthR2FsbGVyeUV4dGVuc2lvbihsb2NhbEVuYWJsZWRMYW5ndWFnZS5tYW5pZmVzdC5uYW1lLCB7IC4uLmxvY2FsRW5hYmxlZExhbmd1YWdlLm1hbmlmZXN0LCB2ZXJzaW9uOiAnMS4wLjEnLCBpZGVudGlmaWVyOiBsb2NhbERpc2FibGVkTGFuZ3VhZ2UuaWRlbnRpZmllciB9KV0pO1xuXG5cdFx0Y29uc3Qgd29ya2JlbmNoU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbiA9IChhd2FpdCB3b3JrYmVuY2hTZXJ2aWNlLnF1ZXJ5TG9jYWwoKSkuZmluZChleCA9PiBleC5pZGVudGlmaWVyLmlkID09PSBsb2NhbEVuYWJsZWRMYW5ndWFnZS5pZGVudGlmaWVyLmlkKTtcblxuXHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KGMgPT4ge1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHdvcmtiZW5jaFNlcnZpY2Uub25DaGFuZ2UoKCkgPT4ge1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uPy5vdXRkYXRlZCkge1xuXHRcdFx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdGMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKS5xdWVyeUdhbGxlcnkoQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXN0YWJsZVZpZXcuc2hvdygnQGluc3RhbGxlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubGVuZ3RoLCA1LCAnVW5leHBlY3RlZCBudW1iZXIgb2YgcmVzdWx0cyBmb3IgQGluc3RhbGxlZCBxdWVyeScpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IFtyZXN1bHQuZ2V0KDApLm5hbWUsIHJlc3VsdC5nZXQoMSkubmFtZSwgcmVzdWx0LmdldCgyKS5uYW1lLCByZXN1bHQuZ2V0KDMpLm5hbWUsIHJlc3VsdC5nZXQoNCkubmFtZV07XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbbG9jYWxFbmFibGVkTGFuZ3VhZ2UubWFuaWZlc3QubmFtZSwgbG9jYWxFbmFibGVkVGhlbWUubWFuaWZlc3QubmFtZSwgbG9jYWxSYW5kb20ubWFuaWZlc3QubmFtZSwgbG9jYWxEaXNhYmxlZFRoZW1lLm1hbmlmZXN0Lm5hbWUsIGxvY2FsRGlzYWJsZWRMYW5ndWFnZS5tYW5pZmVzdC5uYW1lXTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdC5sZW5ndGg7IGkrKykge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbFtpXSwgZXhwZWN0ZWRbaV0sICdVbmV4cGVjdGVkIGV4dGVuc2lvbiBmb3IgQGluc3RhbGxlZCBxdWVyeSB3aXRoIG91dGFkdGVkIGV4dGVuc2lvbi4nKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlc3QgaW5zdGFsbGVkIHF1ZXJ5IHJlc3VsdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdGFibGVWaWV3LnNob3coJ0BpbnN0YWxsZWQnKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmxlbmd0aCwgNSwgJ1VuZXhwZWN0ZWQgbnVtYmVyIG9mIHJlc3VsdHMgZm9yIEBpbnN0YWxsZWQgcXVlcnknKTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IFtyZXN1bHQuZ2V0KDApLm5hbWUsIHJlc3VsdC5nZXQoMSkubmFtZSwgcmVzdWx0LmdldCgyKS5uYW1lLCByZXN1bHQuZ2V0KDMpLm5hbWUsIHJlc3VsdC5nZXQoNCkubmFtZV0uc29ydCgpO1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBbbG9jYWxEaXNhYmxlZFRoZW1lLm1hbmlmZXN0Lm5hbWUsIGxvY2FsRW5hYmxlZFRoZW1lLm1hbmlmZXN0Lm5hbWUsIGxvY2FsUmFuZG9tLm1hbmlmZXN0Lm5hbWUsIGxvY2FsRGlzYWJsZWRMYW5ndWFnZS5tYW5pZmVzdC5uYW1lLCBsb2NhbEVuYWJsZWRMYW5ndWFnZS5tYW5pZmVzdC5uYW1lXTtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcmVzdWx0Lmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWxbaV0sIGV4cGVjdGVkW2ldLCAnVW5leHBlY3RlZCBleHRlbnNpb24gZm9yIEBpbnN0YWxsZWQgcXVlcnkuJyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRhd2FpdCB0ZXN0YWJsZVZpZXcuc2hvdygnQGluc3RhbGxlZCBmaXJzdCcpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubGVuZ3RoLCAyLCAnVW5leHBlY3RlZCBudW1iZXIgb2YgcmVzdWx0cyBmb3IgQGluc3RhbGxlZCBxdWVyeScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5nZXQoMCkubmFtZSwgbG9jYWxFbmFibGVkVGhlbWUubWFuaWZlc3QubmFtZSwgJ1VuZXhwZWN0ZWQgZXh0ZW5zaW9uIGZvciBAaW5zdGFsbGVkIHF1ZXJ5IHdpdGggc2VhcmNoIHRleHQuJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmdldCgxKS5uYW1lLCBsb2NhbERpc2FibGVkVGhlbWUubWFuaWZlc3QubmFtZSwgJ1VuZXhwZWN0ZWQgZXh0ZW5zaW9uIGZvciBAaW5zdGFsbGVkIHF1ZXJ5IHdpdGggc2VhcmNoIHRleHQuJyk7XG5cdFx0fSk7XG5cblx0XHRhd2FpdCB0ZXN0YWJsZVZpZXcuc2hvdygnQGRpc2FibGVkJykudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5sZW5ndGgsIDIsICdVbmV4cGVjdGVkIG51bWJlciBvZiByZXN1bHRzIGZvciBAZGlzYWJsZWQgcXVlcnknKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KDApLm5hbWUsIGxvY2FsRGlzYWJsZWRUaGVtZS5tYW5pZmVzdC5uYW1lLCAnVW5leHBlY3RlZCBleHRlbnNpb24gZm9yIEBkaXNhYmxlZCBxdWVyeS4nKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KDEpLm5hbWUsIGxvY2FsRGlzYWJsZWRMYW5ndWFnZS5tYW5pZmVzdC5uYW1lLCAnVW5leHBlY3RlZCBleHRlbnNpb24gZm9yIEBkaXNhYmxlZCBxdWVyeS4nKTtcblx0XHR9KTtcblxuXHRcdGF3YWl0IHRlc3RhYmxlVmlldy5zaG93KCdAZW5hYmxlZCcpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubGVuZ3RoLCAzLCAnVW5leHBlY3RlZCBudW1iZXIgb2YgcmVzdWx0cyBmb3IgQGVuYWJsZWQgcXVlcnknKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KDApLm5hbWUsIGxvY2FsRW5hYmxlZFRoZW1lLm1hbmlmZXN0Lm5hbWUsICdVbmV4cGVjdGVkIGV4dGVuc2lvbiBmb3IgQGVuYWJsZWQgcXVlcnkuJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmdldCgxKS5uYW1lLCBsb2NhbFJhbmRvbS5tYW5pZmVzdC5uYW1lLCAnVW5leHBlY3RlZCBleHRlbnNpb24gZm9yIEBlbmFibGVkIHF1ZXJ5LicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5nZXQoMikubmFtZSwgbG9jYWxFbmFibGVkTGFuZ3VhZ2UubWFuaWZlc3QubmFtZSwgJ1VuZXhwZWN0ZWQgZXh0ZW5zaW9uIGZvciBAZW5hYmxlZCBxdWVyeS4nKTtcblx0XHR9KTtcblxuXHRcdGF3YWl0IHRlc3RhYmxlVmlldy5zaG93KCdAYnVpbHRpbiBjYXRlZ29yeTp0aGVtZXMnKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmxlbmd0aCwgMSwgJ1VuZXhwZWN0ZWQgbnVtYmVyIG9mIHJlc3VsdHMgZm9yIEBidWlsdGluIGNhdGVnb3J5OnRoZW1lcyBxdWVyeScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5nZXQoMCkubmFtZSwgYnVpbHRJblRoZW1lLm1hbmlmZXN0Lm5hbWUsICdVbmV4cGVjdGVkIGV4dGVuc2lvbiBmb3IgQGJ1aWx0aW46dGhlbWVzIHF1ZXJ5LicpO1xuXHRcdH0pO1xuXG5cdFx0YXdhaXQgdGVzdGFibGVWaWV3LnNob3coJ0BidWlsdGluIGNhdGVnb3J5OlwicHJvZ3JhbW1pbmcgbGFuZ3VhZ2VzXCInKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmxlbmd0aCwgMSwgJ1VuZXhwZWN0ZWQgbnVtYmVyIG9mIHJlc3VsdHMgZm9yIEBidWlsdGluOmJhc2ljcyBxdWVyeScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5nZXQoMCkubmFtZSwgYnVpbHRJbkJhc2ljLm1hbmlmZXN0Lm5hbWUsICdVbmV4cGVjdGVkIGV4dGVuc2lvbiBmb3IgQGJ1aWx0aW46YmFzaWNzIHF1ZXJ5LicpO1xuXHRcdH0pO1xuXG5cdFx0YXdhaXQgdGVzdGFibGVWaWV3LnNob3coJ0BidWlsdGluJykudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5sZW5ndGgsIDIsICdVbmV4cGVjdGVkIG51bWJlciBvZiByZXN1bHRzIGZvciBAYnVpbHRpbiBxdWVyeScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5nZXQoMCkubmFtZSwgYnVpbHRJbkJhc2ljLm1hbmlmZXN0Lm5hbWUsICdVbmV4cGVjdGVkIGV4dGVuc2lvbiBmb3IgQGJ1aWx0aW4gcXVlcnkuJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmdldCgxKS5uYW1lLCBidWlsdEluVGhlbWUubWFuaWZlc3QubmFtZSwgJ1VuZXhwZWN0ZWQgZXh0ZW5zaW9uIGZvciBAYnVpbHRpbiBxdWVyeS4nKTtcblx0XHR9KTtcblxuXHRcdGF3YWl0IHRlc3RhYmxlVmlldy5zaG93KCdAYnVpbHRpbiBteS10aGVtZScpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubGVuZ3RoLCAxLCAnVW5leHBlY3RlZCBudW1iZXIgb2YgcmVzdWx0cyBmb3IgQGJ1aWx0aW4gcXVlcnknKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KDApLm5hbWUsIGJ1aWx0SW5UaGVtZS5tYW5pZmVzdC5uYW1lLCAnVW5leHBlY3RlZCBleHRlbnNpb24gZm9yIEBidWlsdGluIHF1ZXJ5LicpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXN0IGluc3RhbGxlZCBxdWVyeSB3aXRoIGNhdGVnb3J5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RhYmxlVmlldy5zaG93KCdAaW5zdGFsbGVkIGNhdGVnb3J5OnRoZW1lcycpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubGVuZ3RoLCAyLCAnVW5leHBlY3RlZCBudW1iZXIgb2YgcmVzdWx0cyBmb3IgQGluc3RhbGxlZCBxdWVyeSB3aXRoIGNhdGVnb3J5Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmdldCgwKS5uYW1lLCBsb2NhbEVuYWJsZWRUaGVtZS5tYW5pZmVzdC5uYW1lLCAnVW5leHBlY3RlZCBleHRlbnNpb24gZm9yIEBpbnN0YWxsZWQgcXVlcnkgd2l0aCBjYXRlZ29yeS4nKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KDEpLm5hbWUsIGxvY2FsRGlzYWJsZWRUaGVtZS5tYW5pZmVzdC5uYW1lLCAnVW5leHBlY3RlZCBleHRlbnNpb24gZm9yIEBpbnN0YWxsZWQgcXVlcnkgd2l0aCBjYXRlZ29yeS4nKTtcblx0XHR9KTtcblxuXHRcdGF3YWl0IHRlc3RhYmxlVmlldy5zaG93KCdAaW5zdGFsbGVkIGNhdGVnb3J5OlwidGhlbWVzXCInKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmxlbmd0aCwgMiwgJ1VuZXhwZWN0ZWQgbnVtYmVyIG9mIHJlc3VsdHMgZm9yIEBpbnN0YWxsZWQgcXVlcnkgd2l0aCBxdW90ZWQgY2F0ZWdvcnknKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KDApLm5hbWUsIGxvY2FsRW5hYmxlZFRoZW1lLm1hbmlmZXN0Lm5hbWUsICdVbmV4cGVjdGVkIGV4dGVuc2lvbiBmb3IgQGluc3RhbGxlZCBxdWVyeSB3aXRoIHF1b3RlZCBjYXRlZ29yeS4nKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KDEpLm5hbWUsIGxvY2FsRGlzYWJsZWRUaGVtZS5tYW5pZmVzdC5uYW1lLCAnVW5leHBlY3RlZCBleHRlbnNpb24gZm9yIEBpbnN0YWxsZWQgcXVlcnkgd2l0aCBxdW90ZWQgY2F0ZWdvcnkuJyk7XG5cdFx0fSk7XG5cblx0XHRhd2FpdCB0ZXN0YWJsZVZpZXcuc2hvdygnQGluc3RhbGxlZCBjYXRlZ29yeTpcInByb2dyYW1taW5nIGxhbmd1YWdlc1wiJykudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5sZW5ndGgsIDIsICdVbmV4cGVjdGVkIG51bWJlciBvZiByZXN1bHRzIGZvciBAaW5zdGFsbGVkIHF1ZXJ5IHdpdGggcXVvdGVkIGNhdGVnb3J5IGluY2x1ZGluZyBzcGFjZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5nZXQoMCkubmFtZSwgbG9jYWxFbmFibGVkTGFuZ3VhZ2UubWFuaWZlc3QubmFtZSwgJ1VuZXhwZWN0ZWQgZXh0ZW5zaW9uIGZvciBAaW5zdGFsbGVkIHF1ZXJ5IHdpdGggcXVvdGVkIGNhdGVnb3J5IGluY2x1ZGluZyBzcGFjZS4nKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KDEpLm5hbWUsIGxvY2FsRGlzYWJsZWRMYW5ndWFnZS5tYW5pZmVzdC5uYW1lLCAnVW5leHBlY3RlZCBleHRlbnNpb24gZm9yIEBpbnN0YWxsZWQgcXVlcnkgd2l0aCBxdW90ZWQgY2F0ZWdvcnkgaW5sY3VkaW5nIHNwYWNlLicpO1xuXHRcdH0pO1xuXG5cdFx0YXdhaXQgdGVzdGFibGVWaWV3LnNob3coJ0BpbnN0YWxsZWQgY2F0ZWdvcnk6dGhlbWVzIGNhdGVnb3J5OnJhbmRvbScpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubGVuZ3RoLCAzLCAnVW5leHBlY3RlZCBudW1iZXIgb2YgcmVzdWx0cyBmb3IgQGluc3RhbGxlZCBxdWVyeSB3aXRoIG11bHRpcGxlIGNhdGVnb3J5Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmdldCgwKS5uYW1lLCBsb2NhbEVuYWJsZWRUaGVtZS5tYW5pZmVzdC5uYW1lLCAnVW5leHBlY3RlZCBleHRlbnNpb24gZm9yIEBpbnN0YWxsZWQgcXVlcnkgd2l0aCBtdWx0aXBsZSBjYXRlZ29yeS4nKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KDEpLm5hbWUsIGxvY2FsUmFuZG9tLm1hbmlmZXN0Lm5hbWUsICdVbmV4cGVjdGVkIGV4dGVuc2lvbiBmb3IgQGluc3RhbGxlZCBxdWVyeSB3aXRoIG11bHRpcGxlIGNhdGVnb3J5LicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5nZXQoMikubmFtZSwgbG9jYWxEaXNhYmxlZFRoZW1lLm1hbmlmZXN0Lm5hbWUsICdVbmV4cGVjdGVkIGV4dGVuc2lvbiBmb3IgQGluc3RhbGxlZCBxdWVyeSB3aXRoIG11bHRpcGxlIGNhdGVnb3J5LicpO1xuXHRcdH0pO1xuXG5cdFx0YXdhaXQgdGVzdGFibGVWaWV3LnNob3coJ0BlbmFibGVkIGNhdGVnb3J5OnRoZW1lcycpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubGVuZ3RoLCAxLCAnVW5leHBlY3RlZCBudW1iZXIgb2YgcmVzdWx0cyBmb3IgQGVuYWJsZWQgcXVlcnkgd2l0aCBjYXRlZ29yeScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5nZXQoMCkubmFtZSwgbG9jYWxFbmFibGVkVGhlbWUubWFuaWZlc3QubmFtZSwgJ1VuZXhwZWN0ZWQgZXh0ZW5zaW9uIGZvciBAZW5hYmxlZCBxdWVyeSB3aXRoIGNhdGVnb3J5LicpO1xuXHRcdH0pO1xuXG5cdFx0YXdhaXQgdGVzdGFibGVWaWV3LnNob3coJ0BlbmFibGVkIGNhdGVnb3J5OlwidGhlbWVzXCInKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmxlbmd0aCwgMSwgJ1VuZXhwZWN0ZWQgbnVtYmVyIG9mIHJlc3VsdHMgZm9yIEBlbmFibGVkIHF1ZXJ5IHdpdGggcXVvdGVkIGNhdGVnb3J5Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmdldCgwKS5uYW1lLCBsb2NhbEVuYWJsZWRUaGVtZS5tYW5pZmVzdC5uYW1lLCAnVW5leHBlY3RlZCBleHRlbnNpb24gZm9yIEBlbmFibGVkIHF1ZXJ5IHdpdGggcXVvdGVkIGNhdGVnb3J5LicpO1xuXHRcdH0pO1xuXG5cdFx0YXdhaXQgdGVzdGFibGVWaWV3LnNob3coJ0BlbmFibGVkIGNhdGVnb3J5OlwicHJvZ3JhbW1pbmcgbGFuZ3VhZ2VzXCInKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmxlbmd0aCwgMSwgJ1VuZXhwZWN0ZWQgbnVtYmVyIG9mIHJlc3VsdHMgZm9yIEBlbmFibGVkIHF1ZXJ5IHdpdGggcXVvdGVkIGNhdGVnb3J5IGlubGN1ZGluZyBzcGFjZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5nZXQoMCkubmFtZSwgbG9jYWxFbmFibGVkTGFuZ3VhZ2UubWFuaWZlc3QubmFtZSwgJ1VuZXhwZWN0ZWQgZXh0ZW5zaW9uIGZvciBAZW5hYmxlZCBxdWVyeSB3aXRoIHF1b3RlZCBjYXRlZ29yeSBpbmNsdWRpbmcgc3BhY2UuJyk7XG5cdFx0fSk7XG5cblx0XHRhd2FpdCB0ZXN0YWJsZVZpZXcuc2hvdygnQGRpc2FibGVkIGNhdGVnb3J5OnRoZW1lcycpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubGVuZ3RoLCAxLCAnVW5leHBlY3RlZCBudW1iZXIgb2YgcmVzdWx0cyBmb3IgQGRpc2FibGVkIHF1ZXJ5IHdpdGggY2F0ZWdvcnknKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KDApLm5hbWUsIGxvY2FsRGlzYWJsZWRUaGVtZS5tYW5pZmVzdC5uYW1lLCAnVW5leHBlY3RlZCBleHRlbnNpb24gZm9yIEBkaXNhYmxlZCBxdWVyeSB3aXRoIGNhdGVnb3J5LicpO1xuXHRcdH0pO1xuXG5cdFx0YXdhaXQgdGVzdGFibGVWaWV3LnNob3coJ0BkaXNhYmxlZCBjYXRlZ29yeTpcInRoZW1lc1wiJykudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5sZW5ndGgsIDEsICdVbmV4cGVjdGVkIG51bWJlciBvZiByZXN1bHRzIGZvciBAZGlzYWJsZWQgcXVlcnkgd2l0aCBxdW90ZWQgY2F0ZWdvcnknKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KDApLm5hbWUsIGxvY2FsRGlzYWJsZWRUaGVtZS5tYW5pZmVzdC5uYW1lLCAnVW5leHBlY3RlZCBleHRlbnNpb24gZm9yIEBkaXNhYmxlZCBxdWVyeSB3aXRoIHF1b3RlZCBjYXRlZ29yeS4nKTtcblx0XHR9KTtcblxuXHRcdGF3YWl0IHRlc3RhYmxlVmlldy5zaG93KCdAZGlzYWJsZWQgY2F0ZWdvcnk6XCJwcm9ncmFtbWluZyBsYW5ndWFnZXNcIicpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubGVuZ3RoLCAxLCAnVW5leHBlY3RlZCBudW1iZXIgb2YgcmVzdWx0cyBmb3IgQGRpc2FibGVkIHF1ZXJ5IHdpdGggcXVvdGVkIGNhdGVnb3J5IGlubGN1ZGluZyBzcGFjZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5nZXQoMCkubmFtZSwgbG9jYWxEaXNhYmxlZExhbmd1YWdlLm1hbmlmZXN0Lm5hbWUsICdVbmV4cGVjdGVkIGV4dGVuc2lvbiBmb3IgQGRpc2FibGVkIHF1ZXJ5IHdpdGggcXVvdGVkIGNhdGVnb3J5IGluY2x1ZGluZyBzcGFjZS4nKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnVGVzdCBsb2NhbCBxdWVyeSB3aXRoIHNvcnRpbmcgb3JkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdGFibGVWaWV3LnNob3coJ0ByZWNlbnRseVVwZGF0ZWQnKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmxlbmd0aCwgMSwgJ1VuZXhwZWN0ZWQgbnVtYmVyIG9mIHJlc3VsdHMgZm9yIEByZWNlbnRseVVwZGF0ZWQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KDApLm5hbWUsIGxvY2FsRGlzYWJsZWRMYW5ndWFnZS5tYW5pZmVzdC5uYW1lLCAnVW5leHBlY3RlZCBkZWZhdWx0IHNvcnQgb3JkZXIgb2YgZXh0ZW5zaW9ucyBmb3IgQHJlY2VudGx5VXBkYXRlIHF1ZXJ5Jyk7XG5cdFx0fSk7XG5cblx0XHRhd2FpdCB0ZXN0YWJsZVZpZXcuc2hvdygnQGluc3RhbGxlZCBAc29ydDp1cGRhdGVEYXRlJykudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5sZW5ndGgsIDUsICdVbmV4cGVjdGVkIG51bWJlciBvZiByZXN1bHRzIGZvciBAc29ydDp1cGRhdGVEYXRlLiBFeHBlY3RlZCBhbGwgbG9jYWx5IGluc3RhbGxlZCBFeHRlbnNpb24gd2hpY2ggYXJlIG5vdCBidWlsdGluJyk7XG5cdFx0XHRjb25zdCBhY3R1YWwgPSBbcmVzdWx0LmdldCgwKS5sb2NhbD8uaW5zdGFsbGVkVGltZXN0YW1wLCByZXN1bHQuZ2V0KDEpLmxvY2FsPy5pbnN0YWxsZWRUaW1lc3RhbXAsIHJlc3VsdC5nZXQoMikubG9jYWw/Lmluc3RhbGxlZFRpbWVzdGFtcCwgcmVzdWx0LmdldCgzKS5sb2NhbD8uaW5zdGFsbGVkVGltZXN0YW1wLCByZXN1bHQuZ2V0KDQpLmxvY2FsPy5pbnN0YWxsZWRUaW1lc3RhbXBdO1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBbbG9jYWxFbmFibGVkTGFuZ3VhZ2UuaW5zdGFsbGVkVGltZXN0YW1wLCBsb2NhbERpc2FibGVkTGFuZ3VhZ2UuaW5zdGFsbGVkVGltZXN0YW1wLCBsb2NhbFJhbmRvbS5pbnN0YWxsZWRUaW1lc3RhbXAsIGxvY2FsRGlzYWJsZWRUaGVtZS5pbnN0YWxsZWRUaW1lc3RhbXAsIGxvY2FsRW5hYmxlZFRoZW1lLmluc3RhbGxlZFRpbWVzdGFtcF07XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdC5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsW2ldLCBleHBlY3RlZFtpXSwgJ1VuZXhwZWN0ZWQgZXh0ZW5zaW9uIHNvcnRpbmcgZm9yIEBzb3J0OnVwZGF0ZURhdGUgcXVlcnkuJyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlc3QgQHJlY29tbWVuZGVkOndvcmtzcGFjZSBxdWVyeScsICgpID0+IHtcblx0XHRjb25zdCB3b3Jrc3BhY2VSZWNvbW1lbmRlZEV4dGVuc2lvbnMgPSBbXG5cdFx0XHR3b3Jrc3BhY2VSZWNvbW1lbmRhdGlvbkEsXG5cdFx0XHR3b3Jrc3BhY2VSZWNvbW1lbmRhdGlvbkIsXG5cdFx0XHRjb25maWdCYXNlZFJlY29tbWVuZGF0aW9uQSxcblx0XHRdO1xuXG5cdFx0cmV0dXJuIHRlc3RhYmxlVmlldy5zaG93KCdAcmVjb21tZW5kZWQ6d29ya3NwYWNlJykudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5sZW5ndGgsIHdvcmtzcGFjZVJlY29tbWVuZGVkRXh0ZW5zaW9ucy5sZW5ndGgpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB3b3Jrc3BhY2VSZWNvbW1lbmRlZEV4dGVuc2lvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5nZXQoaSkuaWRlbnRpZmllci5pZCwgd29ya3NwYWNlUmVjb21tZW5kZWRFeHRlbnNpb25zW2ldLmlkZW50aWZpZXIuaWQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXN0IEByZWNvbW1lbmRlZCBxdWVyeScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBhbGxSZWNvbW1lbmRlZEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRmaWxlQmFzZWRSZWNvbW1lbmRhdGlvbkEsXG5cdFx0XHRmaWxlQmFzZWRSZWNvbW1lbmRhdGlvbkIsXG5cdFx0XHRjb25maWdCYXNlZFJlY29tbWVuZGF0aW9uQixcblx0XHRcdG90aGVyUmVjb21tZW5kYXRpb25BXG5cdFx0XTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRlc3RhYmxlVmlldy5zaG93KCdAcmVjb21tZW5kZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmxlbmd0aCwgYWxsUmVjb21tZW5kZWRFeHRlbnNpb25zLmxlbmd0aCk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhbGxSZWNvbW1lbmRlZEV4dGVuc2lvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KGkpLmlkZW50aWZpZXIuaWQsIGFsbFJlY29tbWVuZGVkRXh0ZW5zaW9uc1tpXS5pZGVudGlmaWVyLmlkKTtcblx0XHR9XG5cdH0pO1xuXG5cblx0dGVzdCgnVGVzdCBAcmVjb21tZW5kZWQ6YWxsIHF1ZXJ5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGFsbFJlY29tbWVuZGVkRXh0ZW5zaW9ucyA9IFtcblx0XHRcdHdvcmtzcGFjZVJlY29tbWVuZGF0aW9uQSxcblx0XHRcdHdvcmtzcGFjZVJlY29tbWVuZGF0aW9uQixcblx0XHRcdGNvbmZpZ0Jhc2VkUmVjb21tZW5kYXRpb25BLFxuXHRcdFx0ZmlsZUJhc2VkUmVjb21tZW5kYXRpb25BLFxuXHRcdFx0ZmlsZUJhc2VkUmVjb21tZW5kYXRpb25CLFxuXHRcdFx0Y29uZmlnQmFzZWRSZWNvbW1lbmRhdGlvbkIsXG5cdFx0XHRvdGhlclJlY29tbWVuZGF0aW9uQSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGVzdGFibGVWaWV3LnNob3coJ0ByZWNvbW1lbmRlZDphbGwnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmxlbmd0aCwgYWxsUmVjb21tZW5kZWRFeHRlbnNpb25zLmxlbmd0aCk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhbGxSZWNvbW1lbmRlZEV4dGVuc2lvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KGkpLmlkZW50aWZpZXIuaWQsIGFsbFJlY29tbWVuZGVkRXh0ZW5zaW9uc1tpXS5pZGVudGlmaWVyLmlkKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlc3Qgc2VhcmNoJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc3VsdHMgPSBbXG5cdFx0XHRmaWxlQmFzZWRSZWNvbW1lbmRhdGlvbkEsXG5cdFx0XHR3b3Jrc3BhY2VSZWNvbW1lbmRhdGlvbkEsXG5cdFx0XHRvdGhlclJlY29tbWVuZGF0aW9uQSxcblx0XHRcdHdvcmtzcGFjZVJlY29tbWVuZGF0aW9uQlxuXHRcdF07XG5cdFx0cXVlcnlQYWdlID0gYVBhZ2UocmVzdWx0cyk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGVzdGFibGVWaWV3LnNob3coJ3NlYXJjaC1tZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubGVuZ3RoLCByZXN1bHRzLmxlbmd0aCk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCByZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmdldChpKS5pZGVudGlmaWVyLmlkLCByZXN1bHRzW2ldLmlkZW50aWZpZXIuaWQpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnVGVzdCBwcmVmZXJyZWQgc2VhcmNoIGV4cGVyaW1lbnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0cXVlcnlQYWdlID0gYVBhZ2UoW1xuXHRcdFx0ZmlsZUJhc2VkUmVjb21tZW5kYXRpb25BLFxuXHRcdFx0d29ya3NwYWNlUmVjb21tZW5kYXRpb25BLFxuXHRcdFx0b3RoZXJSZWNvbW1lbmRhdGlvbkEsXG5cdFx0XHR3b3Jrc3BhY2VSZWNvbW1lbmRhdGlvbkJcblx0XHRdLCA1KTtcblx0XHRjb25zdCBub3RJbkZpcnN0UGFnZSA9IGFHYWxsZXJ5RXh0ZW5zaW9uKCdub3QtaW4tZmlyc3QtcGFnZScpO1xuXHRcdGdhbGxlcnlFeHRlbnNpb25zLnB1c2gobm90SW5GaXJzdFBhZ2UpO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0d29ya3NwYWNlUmVjb21tZW5kYXRpb25BLFxuXHRcdFx0bm90SW5GaXJzdFBhZ2UsXG5cdFx0XHR3b3Jrc3BhY2VSZWNvbW1lbmRhdGlvbkIsXG5cdFx0XHRmaWxlQmFzZWRSZWNvbW1lbmRhdGlvbkEsXG5cdFx0XHRvdGhlclJlY29tbWVuZGF0aW9uQSxcblx0XHRdO1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YlByb21pc2UoSVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCAnZ2V0RXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCcsIHtcblx0XHRcdG1hbGljaW91czogW10sIGRlcHJlY2F0ZWQ6IHt9LFxuXHRcdFx0c2VhcmNoOiBbe1xuXHRcdFx0XHRxdWVyeTogJ3NlYXJjaC1tZScsXG5cdFx0XHRcdHByZWZlcnJlZFJlc3VsdHM6IFtcblx0XHRcdFx0XHR3b3Jrc3BhY2VSZWNvbW1lbmRhdGlvbkEuaWRlbnRpZmllci5pZCxcblx0XHRcdFx0XHRub3RJbkZpcnN0UGFnZS5pZGVudGlmaWVyLmlkLFxuXHRcdFx0XHRcdHdvcmtzcGFjZVJlY29tbWVuZGF0aW9uQi5pZGVudGlmaWVyLmlkXG5cdFx0XHRcdF1cblx0XHRcdH1dXG5cdFx0fSk7XG5cblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb25zTGlzdFZpZXcsIHt9LCB7IGlkOiAnJywgdGl0bGU6ICcnIH0pKTtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXN0T2JqZWN0LnNob3coJ3NlYXJjaC1tZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZXhwZWN0ZWQubGVuZ3RoOyBpKyspIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZ2V0KGkpLmlkZW50aWZpZXIuaWQsIGV4cGVjdGVkW2ldLmlkZW50aWZpZXIuaWQpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnU2tpcCBwcmVmZXJyZWQgc2VhcmNoIGV4cGVyaW1lbnQgd2hlbiB1c2VyIGRlZmluZXMgc29ydCBvcmRlcicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZWFsUmVzdWx0cyA9IFtcblx0XHRcdGZpbGVCYXNlZFJlY29tbWVuZGF0aW9uQSxcblx0XHRcdHdvcmtzcGFjZVJlY29tbWVuZGF0aW9uQSxcblx0XHRcdG90aGVyUmVjb21tZW5kYXRpb25BLFxuXHRcdFx0d29ya3NwYWNlUmVjb21tZW5kYXRpb25CXG5cdFx0XTtcblx0XHRxdWVyeVBhZ2UgPSBhUGFnZShyZWFsUmVzdWx0cyk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXN0YWJsZVZpZXcuc2hvdygnc2VhcmNoLW1lIEBzb3J0Omluc3RhbGxzJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5sZW5ndGgsIHJlYWxSZXN1bHRzLmxlbmd0aCk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCByZWFsUmVzdWx0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5nZXQoaSkuaWRlbnRpZmllci5pZCwgcmVhbFJlc3VsdHNbaV0uaWRlbnRpZmllci5pZCk7XG5cdFx0fVxuXHR9KTtcblxuXHRmdW5jdGlvbiBhTG9jYWxFeHRlbnNpb24obmFtZTogc3RyaW5nID0gJ3NvbWVleHQnLCBtYW5pZmVzdDogYW55ID0ge30sIHByb3BlcnRpZXM6IGFueSA9IHt9KTogSUxvY2FsRXh0ZW5zaW9uIHtcblx0XHRtYW5pZmVzdCA9IHsgbmFtZSwgcHVibGlzaGVyOiAncHViJywgdmVyc2lvbjogJzEuMC4wJywgLi4ubWFuaWZlc3QgfTtcblx0XHRwcm9wZXJ0aWVzID0ge1xuXHRcdFx0dHlwZTogRXh0ZW5zaW9uVHlwZS5Vc2VyLFxuXHRcdFx0bG9jYXRpb246IFVSSS5maWxlKGBwdWIuJHtuYW1lfWApLFxuXHRcdFx0aWRlbnRpZmllcjogeyBpZDogZ2V0R2FsbGVyeUV4dGVuc2lvbklkKG1hbmlmZXN0LnB1Ymxpc2hlciwgbWFuaWZlc3QubmFtZSkgfSxcblx0XHRcdG1ldGFkYXRhOiB7IGlkOiBnZXRHYWxsZXJ5RXh0ZW5zaW9uSWQobWFuaWZlc3QucHVibGlzaGVyLCBtYW5pZmVzdC5uYW1lKSwgcHVibGlzaGVySWQ6IG1hbmlmZXN0LnB1Ymxpc2hlciwgcHVibGlzaGVyRGlzcGxheU5hbWU6ICdzb21lbmFtZScgfSxcblx0XHRcdC4uLnByb3BlcnRpZXMsXG5cdFx0XHRpc1ZhbGlkOiBwcm9wZXJ0aWVzLmlzVmFsaWQgPz8gdHJ1ZSxcblx0XHR9O1xuXHRcdHByb3BlcnRpZXMuaXNCdWlsdGluID0gcHJvcGVydGllcy50eXBlID09PSBFeHRlbnNpb25UeXBlLlN5c3RlbTtcblx0XHRyZXR1cm4gPElMb2NhbEV4dGVuc2lvbj5PYmplY3QuY3JlYXRlKHsgbWFuaWZlc3QsIC4uLnByb3BlcnRpZXMgfSk7XG5cdH1cblxuXHRmdW5jdGlvbiBhR2FsbGVyeUV4dGVuc2lvbihuYW1lOiBzdHJpbmcsIHByb3BlcnRpZXM6IGFueSA9IHt9LCBnYWxsZXJ5RXh0ZW5zaW9uUHJvcGVydGllczogYW55ID0ge30sIGFzc2V0czogYW55ID0ge30pOiBJR2FsbGVyeUV4dGVuc2lvbiB7XG5cdFx0Y29uc3QgdGFyZ2V0UGxhdGZvcm0gPSBnZXRUYXJnZXRQbGF0Zm9ybShwbGF0Zm9ybSwgYXJjaCk7XG5cdFx0Y29uc3QgZ2FsbGVyeUV4dGVuc2lvbiA9IDxJR2FsbGVyeUV4dGVuc2lvbj5PYmplY3QuY3JlYXRlKHsgbmFtZSwgcHVibGlzaGVyOiAncHViJywgdmVyc2lvbjogJzEuMC4wJywgYWxsVGFyZ2V0UGxhdGZvcm1zOiBbdGFyZ2V0UGxhdGZvcm1dLCBwcm9wZXJ0aWVzOiB7fSwgYXNzZXRzOiB7fSwgLi4ucHJvcGVydGllcyB9KTtcblx0XHRnYWxsZXJ5RXh0ZW5zaW9uLnByb3BlcnRpZXMgPSB7IC4uLmdhbGxlcnlFeHRlbnNpb24ucHJvcGVydGllcywgZGVwZW5kZW5jaWVzOiBbXSwgdGFyZ2V0UGxhdGZvcm0sIC4uLmdhbGxlcnlFeHRlbnNpb25Qcm9wZXJ0aWVzIH07XG5cdFx0Z2FsbGVyeUV4dGVuc2lvbi5hc3NldHMgPSB7IC4uLmdhbGxlcnlFeHRlbnNpb24uYXNzZXRzLCAuLi5hc3NldHMgfTtcblx0XHRnYWxsZXJ5RXh0ZW5zaW9uLmlkZW50aWZpZXIgPSB7IGlkOiBnZXRHYWxsZXJ5RXh0ZW5zaW9uSWQoZ2FsbGVyeUV4dGVuc2lvbi5wdWJsaXNoZXIsIGdhbGxlcnlFeHRlbnNpb24ubmFtZSksIHV1aWQ6IGdlbmVyYXRlVXVpZCgpIH07XG5cdFx0cmV0dXJuIDxJR2FsbGVyeUV4dGVuc2lvbj5nYWxsZXJ5RXh0ZW5zaW9uO1xuXHR9XG5cblx0ZnVuY3Rpb24gYVBhZ2U8VD4ob2JqZWN0czogSUdhbGxlcnlFeHRlbnNpb25bXSA9IFtdLCB0b3RhbD86IG51bWJlcik6IElQYWdlcjxJR2FsbGVyeUV4dGVuc2lvbj4ge1xuXHRcdHJldHVybiB7IGZpcnN0UGFnZTogb2JqZWN0cywgdG90YWw6IHRvdGFsID8/IG9iamVjdHMubGVuZ3RoLCBwYWdlU2l6ZTogb2JqZWN0cy5sZW5ndGgsIGdldFBhZ2U6ICgpID0+IG51bGwhIH07XG5cdH1cblxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyxrQ0FBa0M7QUFDM0M7QUFBQSxFQUNDO0FBQUEsRUFBNkI7QUFBQSxFQUM3QjtBQUFBLEVBQW1CO0FBQUEsT0FDYjtBQUNQLFNBQVMsc0NBQXNDLGlCQUFpQixtQ0FBd0csNENBQTRDO0FBQ3BOLFNBQVMsa0NBQWtDLHFDQUFxQztBQUNoRixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGFBQWE7QUFFdEIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxtQkFBbUIsOEJBQThCO0FBQzFELFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsNkJBQTZCO0FBQ3RDLFNB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
