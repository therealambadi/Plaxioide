import * as sinon from "sinon";
import assert from "assert";
import * as uuid from "../../../../../base/common/uuid.js";
import {
  IExtensionGalleryService,
  IExtensionManagementService,
  IExtensionTipsService,
  getTargetPlatform
} from "../../../../../platform/extensionManagement/common/extensionManagement.js";
import { IWorkbenchExtensionEnablementService, IWorkbenchExtensionManagementService } from "../../../../services/extensionManagement/common/extensionManagement.js";
import { ExtensionGalleryService } from "../../../../../platform/extensionManagement/common/extensionGalleryService.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { TestLifecycleService } from "../../../../test/browser/workbenchTestServices.js";
import { TestContextService, TestProductService, TestStorageService } from "../../../../test/common/workbenchTestServices.js";
import { TestExtensionTipsService, TestSharedProcessService } from "../../../../test/electron-sandbox/workbenchTestServices.js";
import { TestNotificationService } from "../../../../../platform/notification/test/common/testNotificationService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { URI } from "../../../../../base/common/uri.js";
import { testWorkspace } from "../../../../../platform/workspace/test/common/testWorkspace.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { getGalleryExtensionId } from "../../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { ConfigurationKey, IExtensionsWorkbenchService } from "../../common/extensions.js";
import { TestExtensionEnablementService } from "../../../../services/extensionManagement/test/browser/extensionEnablementService.test.js";
import { IURLService } from "../../../../../platform/url/common/url.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ILifecycleService } from "../../../../services/lifecycle/common/lifecycle.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { NativeURLService } from "../../../../../platform/url/common/urlService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { ExtensionType } from "../../../../../platform/extensions/common/extensions.js";
import { ISharedProcessService } from "../../../../../platform/ipc/electron-sandbox/services.js";
import { FileService } from "../../../../../platform/files/common/fileService.js";
import { NullLogService, ILogService } from "../../../../../platform/log/common/log.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { ExtensionRecommendationsService } from "../../browser/extensionRecommendationsService.js";
import { NoOpWorkspaceTagsService } from "../../../tags/browser/workspaceTagsService.js";
import { IWorkspaceTagsService } from "../../../tags/common/workspaceTags.js";
import { ExtensionsWorkbenchService } from "../../browser/extensionsWorkbenchService.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { IWorkspaceExtensionsConfigService, WorkspaceExtensionsConfigService } from "../../../../services/extensionRecommendations/common/workspaceExtensionsConfig.js";
import { IExtensionIgnoredRecommendationsService } from "../../../../services/extensionRecommendations/common/extensionRecommendations.js";
import { ExtensionIgnoredRecommendationsService } from "../../../../services/extensionRecommendations/common/extensionIgnoredRecommendationsService.js";
import { IExtensionRecommendationNotificationService } from "../../../../../platform/extensionRecommendations/common/extensionRecommendations.js";
import { ExtensionRecommendationNotificationService } from "../../browser/extensionRecommendationNotificationService.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { InMemoryFileSystemProvider } from "../../../../../platform/files/common/inMemoryFilesystemProvider.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { platform } from "../../../../../base/common/platform.js";
import { arch } from "../../../../../base/common/process.js";
import { runWithFakedTimers } from "../../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { timeout } from "../../../../../base/common/async.js";
import { IUpdateService, State } from "../../../../../platform/update/common/update.js";
import { IUriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentity.js";
import { UriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentityService.js";
const ROOT = URI.file("tests").with({ scheme: "vscode-tests" });
const mockExtensionGallery = [
  aGalleryExtension("MockExtension1", {
    displayName: "Mock Extension 1",
    version: "1.5",
    publisherId: "mockPublisher1Id",
    publisher: "mockPublisher1",
    publisherDisplayName: "Mock Publisher 1",
    description: "Mock Description",
    installCount: 1e3,
    rating: 4,
    ratingCount: 100
  }, {
    dependencies: ["pub.1"]
  }, {
    manifest: { uri: "uri:manifest", fallbackUri: "fallback:manifest" },
    readme: { uri: "uri:readme", fallbackUri: "fallback:readme" },
    changelog: { uri: "uri:changelog", fallbackUri: "fallback:changlog" },
    download: { uri: "uri:download", fallbackUri: "fallback:download" },
    icon: { uri: "uri:icon", fallbackUri: "fallback:icon" },
    license: { uri: "uri:license", fallbackUri: "fallback:license" },
    repository: { uri: "uri:repository", fallbackUri: "fallback:repository" },
    signature: { uri: "uri:signature", fallbackUri: "fallback:signature" },
    coreTranslations: []
  }),
  aGalleryExtension("MockExtension2", {
    displayName: "Mock Extension 2",
    version: "1.5",
    publisherId: "mockPublisher2Id",
    publisher: "mockPublisher2",
    publisherDisplayName: "Mock Publisher 2",
    description: "Mock Description",
    installCount: 1e3,
    rating: 4,
    ratingCount: 100
  }, {
    dependencies: ["pub.1", "pub.2"]
  }, {
    manifest: { uri: "uri:manifest", fallbackUri: "fallback:manifest" },
    readme: { uri: "uri:readme", fallbackUri: "fallback:readme" },
    changelog: { uri: "uri:changelog", fallbackUri: "fallback:changlog" },
    download: { uri: "uri:download", fallbackUri: "fallback:download" },
    icon: { uri: "uri:icon", fallbackUri: "fallback:icon" },
    license: { uri: "uri:license", fallbackUri: "fallback:license" },
    repository: { uri: "uri:repository", fallbackUri: "fallback:repository" },
    signature: { uri: "uri:signature", fallbackUri: "fallback:signature" },
    coreTranslations: []
  })
];
const mockExtensionLocal = [
  {
    type: ExtensionType.User,
    identifier: mockExtensionGallery[0].identifier,
    manifest: {
      name: mockExtensionGallery[0].name,
      publisher: mockExtensionGallery[0].publisher,
      version: mockExtensionGallery[0].version
    },
    metadata: null,
    path: "somepath",
    readmeUrl: "some readmeUrl",
    changelogUrl: "some changelogUrl"
  },
  {
    type: ExtensionType.User,
    identifier: mockExtensionGallery[1].identifier,
    manifest: {
      name: mockExtensionGallery[1].name,
      publisher: mockExtensionGallery[1].publisher,
      version: mockExtensionGallery[1].version
    },
    metadata: null,
    path: "somepath",
    readmeUrl: "some readmeUrl",
    changelogUrl: "some changelogUrl"
  }
];
const mockTestData = {
  recommendedExtensions: [
    "mockPublisher1.mockExtension1",
    "MOCKPUBLISHER2.mockextension2",
    "badlyformattedextension",
    "MOCKPUBLISHER2.mockextension2",
    "unknown.extension"
  ],
  validRecommendedExtensions: [
    "mockPublisher1.mockExtension1",
    "MOCKPUBLISHER2.mockextension2"
  ]
};
function aPage(...objects) {
  return { firstPage: objects, total: objects.length, pageSize: objects.length, getPage: () => null };
}
const noAssets = {
  changelog: null,
  download: null,
  icon: null,
  license: null,
  manifest: null,
  readme: null,
  repository: null,
  signature: null,
  coreTranslations: []
};
function aGalleryExtension(name, properties = {}, galleryExtensionProperties = {}, assets = noAssets) {
  const targetPlatform = getTargetPlatform(platform, arch);
  const galleryExtension = /* @__PURE__ */ Object.create({ name, publisher: "pub", version: "1.0.0", allTargetPlatforms: [targetPlatform], properties: {}, assets: {}, ...properties });
  galleryExtension.properties = { ...galleryExtension.properties, dependencies: [], targetPlatform, ...galleryExtensionProperties };
  galleryExtension.assets = { ...galleryExtension.assets, ...assets };
  galleryExtension.identifier = { id: getGalleryExtensionId(galleryExtension.publisher, galleryExtension.name), uuid: uuid.generateUuid() };
  return galleryExtension;
}
suite("ExtensionRecommendationsService Test", () => {
  let disposableStore;
  let workspaceService;
  let instantiationService;
  let testConfigurationService;
  let testObject;
  let prompted;
  let promptedEmitter;
  let onModelAddedEvent;
  teardown(async () => {
    disposableStore.dispose();
    await timeout(0);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  setup(() => {
    disposableStore = new DisposableStore();
    instantiationService = disposableStore.add(new TestInstantiationService());
    promptedEmitter = disposableStore.add(new Emitter());
    instantiationService.stub(IExtensionGalleryService, ExtensionGalleryService);
    instantiationService.stub(ISharedProcessService, TestSharedProcessService);
    instantiationService.stub(ILifecycleService, disposableStore.add(new TestLifecycleService()));
    testConfigurationService = new TestConfigurationService();
    instantiationService.stub(IConfigurationService, testConfigurationService);
    instantiationService.stub(IProductService, TestProductService);
    instantiationService.stub(ILogService, NullLogService);
    const fileService = new FileService(instantiationService.get(ILogService));
    instantiationService.stub(IFileService, disposableStore.add(fileService));
    const fileSystemProvider = disposableStore.add(new InMemoryFileSystemProvider());
    disposableStore.add(fileService.registerProvider(ROOT.scheme, fileSystemProvider));
    instantiationService.stub(IUriIdentityService, disposableStore.add(new UriIdentityService(instantiationService.get(IFileService))));
    instantiationService.stub(INotificationService, new TestNotificationService());
    instantiationService.stub(IContextKeyService, new MockContextKeyService());
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
      async canInstall() {
        return true;
      },
      async getExtensionsControlManifest() {
        return { malicious: [], deprecated: {}, search: [], publisherMapping: {} };
      },
      async getTargetPlatform() {
        return getTargetPlatform(platform, arch);
      }
    });
    instantiationService.stub(IExtensionService, {
      onDidChangeExtensions: Event.None,
      extensions: [],
      async whenInstalledExtensionsRegistered() {
        return true;
      }
    });
    instantiationService.stub(IWorkbenchExtensionEnablementService, disposableStore.add(new TestExtensionEnablementService(instantiationService)));
    instantiationService.stub(ITelemetryService, NullTelemetryService);
    instantiationService.stub(IURLService, NativeURLService);
    instantiationService.stub(IWorkspaceTagsService, new NoOpWorkspaceTagsService());
    instantiationService.stub(IStorageService, disposableStore.add(new TestStorageService()));
    instantiationService.stub(ILogService, new NullLogService());
    instantiationService.stub(IProductService, {
      extensionRecommendations: {
        "ms-python.python": {
          onFileOpen: [
            {
              "pathGlob": "{**/*.py}",
              important: true
            }
          ]
        },
        "ms-vscode.PowerShell": {
          onFileOpen: [
            {
              "pathGlob": "{**/*.ps,**/*.ps1}",
              important: true
            }
          ]
        },
        "ms-dotnettools.csharp": {
          onFileOpen: [
            {
              "pathGlob": "{**/*.cs,**/project.json,**/global.json,**/*.csproj,**/*.sln,**/appsettings.json}"
            }
          ]
        },
        "msjsdiag.debugger-for-chrome": {
          onFileOpen: [
            {
              "pathGlob": "{**/*.ts,**/*.tsx,**/*.js,**/*.jsx,**/*.es6,**/*.mjs,**/*.cjs,**/.babelrc}"
            }
          ]
        },
        "lukehoban.Go": {
          onFileOpen: [
            {
              "pathGlob": "**/*.go"
            }
          ]
        }
      }
    });
    instantiationService.stub(IUpdateService, { onStateChange: Event.None, state: State.Uninitialized });
    instantiationService.set(IExtensionsWorkbenchService, disposableStore.add(instantiationService.createInstance(ExtensionsWorkbenchService)));
    instantiationService.stub(IExtensionTipsService, disposableStore.add(instantiationService.createInstance(TestExtensionTipsService)));
    onModelAddedEvent = new Emitter();
    instantiationService.stub(IEnvironmentService, {});
    instantiationService.stubPromise(IExtensionManagementService, "getInstalled", []);
    instantiationService.stub(IExtensionGalleryService, "isEnabled", true);
    instantiationService.stubPromise(IExtensionGalleryService, "query", aPage(...mockExtensionGallery));
    instantiationService.stubPromise(IExtensionGalleryService, "getExtensions", mockExtensionGallery);
    prompted = false;
    class TestNotificationService2 extends TestNotificationService {
      prompt(severity, message, choices, options) {
        prompted = true;
        promptedEmitter.fire();
        return super.prompt(severity, message, choices, options);
      }
    }
    instantiationService.stub(INotificationService, new TestNotificationService2());
    testConfigurationService.setUserConfiguration(ConfigurationKey, { ignoreRecommendations: false });
    instantiationService.stub(IModelService, {
      getModels() {
        return [];
      },
      onModelAdded: onModelAddedEvent.event
    });
  });
  function setUpFolderWorkspace(folderName, recommendedExtensions, ignoredRecommendations = []) {
    return setUpFolder(folderName, recommendedExtensions, ignoredRecommendations);
  }
  async function setUpFolder(folderName, recommendedExtensions, ignoredRecommendations = []) {
    const fileService = instantiationService.get(IFileService);
    const folderDir = joinPath(ROOT, folderName);
    const workspaceSettingsDir = joinPath(folderDir, ".vscode");
    await fileService.createFolder(workspaceSettingsDir);
    const configPath = joinPath(workspaceSettingsDir, "extensions.json");
    await fileService.writeFile(configPath, VSBuffer.fromString(JSON.stringify({
      "recommendations": recommendedExtensions,
      "unwantedRecommendations": ignoredRecommendations
    }, null, "	")));
    const myWorkspace = testWorkspace(folderDir);
    instantiationService.stub(IFileService, fileService);
    workspaceService = new TestContextService(myWorkspace);
    instantiationService.stub(IWorkspaceContextService, workspaceService);
    instantiationService.stub(IWorkspaceExtensionsConfigService, disposableStore.add(instantiationService.createInstance(WorkspaceExtensionsConfigService)));
    instantiationService.stub(IExtensionIgnoredRecommendationsService, disposableStore.add(instantiationService.createInstance(ExtensionIgnoredRecommendationsService)));
    instantiationService.stub(IExtensionRecommendationNotificationService, disposableStore.add(instantiationService.createInstance(ExtensionRecommendationNotificationService)));
  }
  function testNoPromptForValidRecommendations(recommendations) {
    return setUpFolderWorkspace("myFolder", recommendations).then(() => {
      testObject = disposableStore.add(instantiationService.createInstance(ExtensionRecommendationsService));
      return testObject.activationPromise.then(() => {
        assert.strictEqual(Object.keys(testObject.getAllRecommendationsWithReason()).length, recommendations.length);
        assert.ok(!prompted);
      });
    });
  }
  function testNoPromptOrRecommendationsForValidRecommendations(recommendations) {
    return setUpFolderWorkspace("myFolder", mockTestData.validRecommendedExtensions).then(() => {
      testObject = disposableStore.add(instantiationService.createInstance(ExtensionRecommendationsService));
      assert.ok(!prompted);
      return testObject.getWorkspaceRecommendations().then(() => {
        assert.strictEqual(Object.keys(testObject.getAllRecommendationsWithReason()).length, 0);
        assert.ok(!prompted);
      });
    });
  }
  test("ExtensionRecommendationsService: No Prompt for valid workspace recommendations when galleryService is absent", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const galleryQuerySpy = sinon.spy();
    instantiationService.stub(IExtensionGalleryService, { query: galleryQuerySpy, isEnabled: () => false });
    return testNoPromptOrRecommendationsForValidRecommendations(mockTestData.validRecommendedExtensions).then(() => assert.ok(galleryQuerySpy.notCalled));
  }));
  test("ExtensionRecommendationsService: No Prompt for valid workspace recommendations during extension development", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    instantiationService.stub(IEnvironmentService, { extensionDevelopmentLocationURI: [URI.file("/folder/file")], isExtensionDevelopment: true });
    return testNoPromptOrRecommendationsForValidRecommendations(mockTestData.validRecommendedExtensions);
  }));
  test("ExtensionRecommendationsService: No workspace recommendations or prompts when extensions.json has empty array", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    return testNoPromptForValidRecommendations([]);
  }));
  test("ExtensionRecommendationsService: Prompt for valid workspace recommendations", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    await setUpFolderWorkspace("myFolder", mockTestData.recommendedExtensions);
    testObject = disposableStore.add(instantiationService.createInstance(ExtensionRecommendationsService));
    await Event.toPromise(promptedEmitter.event);
    const recommendations = Object.keys(testObject.getAllRecommendationsWithReason());
    const expected = [...mockTestData.validRecommendedExtensions, "unknown.extension"];
    assert.strictEqual(recommendations.length, expected.length);
    expected.forEach((x) => {
      assert.strictEqual(recommendations.indexOf(x.toLowerCase()) > -1, true);
    });
  }));
  test("ExtensionRecommendationsService: No Prompt for valid workspace recommendations if they are already installed", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    instantiationService.stubPromise(IExtensionManagementService, "getInstalled", mockExtensionLocal);
    return testNoPromptForValidRecommendations(mockTestData.validRecommendedExtensions);
  }));
  test("ExtensionRecommendationsService: No Prompt for valid workspace recommendations with casing mismatch if they are already installed", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    instantiationService.stubPromise(IExtensionManagementService, "getInstalled", mockExtensionLocal);
    return testNoPromptForValidRecommendations(mockTestData.validRecommendedExtensions.map((x) => x.toUpperCase()));
  }));
  test("ExtensionRecommendationsService: No Prompt for valid workspace recommendations if ignoreRecommendations is set", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    testConfigurationService.setUserConfiguration(ConfigurationKey, { ignoreRecommendations: true });
    return testNoPromptForValidRecommendations(mockTestData.validRecommendedExtensions);
  }));
  test("ExtensionRecommendationsService: No Prompt for valid workspace recommendations if showRecommendationsOnlyOnDemand is set", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    testConfigurationService.setUserConfiguration(ConfigurationKey, { showRecommendationsOnlyOnDemand: true });
    return setUpFolderWorkspace("myFolder", mockTestData.validRecommendedExtensions).then(() => {
      testObject = disposableStore.add(instantiationService.createInstance(ExtensionRecommendationsService));
      return testObject.activationPromise.then(() => {
        assert.ok(!prompted);
      });
    });
  }));
  test("ExtensionRecommendationsService: No Prompt for valid workspace recommendations if ignoreRecommendations is set for current workspace", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    instantiationService.get(IStorageService).store("extensionsAssistant/workspaceRecommendationsIgnore", true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    return testNoPromptForValidRecommendations(mockTestData.validRecommendedExtensions);
  }));
  test("ExtensionRecommendationsService: No Recommendations of globally ignored recommendations", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    instantiationService.get(IStorageService).store("extensionsAssistant/workspaceRecommendationsIgnore", true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    instantiationService.get(IStorageService).store("extensionsAssistant/recommendations", '["ms-dotnettools.csharp", "ms-python.python", "ms-vscode.vscode-typescript-tslint-plugin"]', StorageScope.PROFILE, StorageTarget.MACHINE);
    instantiationService.get(IStorageService).store("extensionsAssistant/ignored_recommendations", '["ms-dotnettools.csharp", "mockpublisher2.mockextension2"]', StorageScope.PROFILE, StorageTarget.MACHINE);
    return setUpFolderWorkspace("myFolder", mockTestData.validRecommendedExtensions).then(() => {
      testObject = disposableStore.add(instantiationService.createInstance(ExtensionRecommendationsService));
      return testObject.activationPromise.then(() => {
        const recommendations = testObject.getAllRecommendationsWithReason();
        assert.ok(!recommendations["ms-dotnettools.csharp"]);
        assert.ok(recommendations["ms-python.python"]);
        assert.ok(recommendations["mockpublisher1.mockextension1"]);
        assert.ok(!recommendations["mockpublisher2.mockextension2"]);
      });
    });
  }));
  test("ExtensionRecommendationsService: No Recommendations of workspace ignored recommendations", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const ignoredRecommendations = ["ms-dotnettools.csharp", "mockpublisher2.mockextension2"];
    const storedRecommendations = '["ms-dotnettools.csharp", "ms-python.python"]';
    instantiationService.get(IStorageService).store("extensionsAssistant/workspaceRecommendationsIgnore", true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    instantiationService.get(IStorageService).store("extensionsAssistant/recommendations", storedRecommendations, StorageScope.PROFILE, StorageTarget.MACHINE);
    return setUpFolderWorkspace("myFolder", mockTestData.validRecommendedExtensions, ignoredRecommendations).then(() => {
      testObject = disposableStore.add(instantiationService.createInstance(ExtensionRecommendationsService));
      return testObject.activationPromise.then(() => {
        const recommendations = testObject.getAllRecommendationsWithReason();
        assert.ok(!recommendations["ms-dotnettools.csharp"]);
        assert.ok(recommendations["ms-python.python"]);
        assert.ok(recommendations["mockpublisher1.mockextension1"]);
        assert.ok(!recommendations["mockpublisher2.mockextension2"]);
      });
    });
  }));
  test("ExtensionRecommendationsService: Able to retrieve collection of all ignored recommendations", async () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const storageService = instantiationService.get(IStorageService);
    const workspaceIgnoredRecommendations = ["ms-dotnettools.csharp"];
    const storedRecommendations = '["ms-dotnettools.csharp", "ms-python.python"]';
    const globallyIgnoredRecommendations = '["mockpublisher2.mockextension2"]';
    storageService.store("extensionsAssistant/workspaceRecommendationsIgnore", true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    storageService.store("extensionsAssistant/recommendations", storedRecommendations, StorageScope.PROFILE, StorageTarget.MACHINE);
    storageService.store("extensionsAssistant/ignored_recommendations", globallyIgnoredRecommendations, StorageScope.PROFILE, StorageTarget.MACHINE);
    await setUpFolderWorkspace("myFolder", mockTestData.validRecommendedExtensions, workspaceIgnoredRecommendations);
    testObject = disposableStore.add(instantiationService.createInstance(ExtensionRecommendationsService));
    await testObject.activationPromise;
    const recommendations = testObject.getAllRecommendationsWithReason();
    assert.deepStrictEqual(Object.keys(recommendations), ["ms-python.python", "mockpublisher1.mockextension1"]);
  }));
  test("ExtensionRecommendationsService: Able to dynamically ignore/unignore global recommendations", async () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const storageService = instantiationService.get(IStorageService);
    const storedRecommendations = '["ms-dotnettools.csharp", "ms-python.python"]';
    const globallyIgnoredRecommendations = '["mockpublisher2.mockextension2"]';
    storageService.store("extensionsAssistant/workspaceRecommendationsIgnore", true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    storageService.store("extensionsAssistant/recommendations", storedRecommendations, StorageScope.PROFILE, StorageTarget.MACHINE);
    storageService.store("extensionsAssistant/ignored_recommendations", globallyIgnoredRecommendations, StorageScope.PROFILE, StorageTarget.MACHINE);
    await setUpFolderWorkspace("myFolder", mockTestData.validRecommendedExtensions);
    const extensionIgnoredRecommendationsService = instantiationService.get(IExtensionIgnoredRecommendationsService);
    testObject = disposableStore.add(instantiationService.createInstance(ExtensionRecommendationsService));
    await testObject.activationPromise;
    let recommendations = testObject.getAllRecommendationsWithReason();
    assert.ok(recommendations["ms-python.python"]);
    assert.ok(recommendations["mockpublisher1.mockextension1"]);
    assert.ok(!recommendations["mockpublisher2.mockextension2"]);
    extensionIgnoredRecommendationsService.toggleGlobalIgnoredRecommendation("mockpublisher1.mockextension1", true);
    recommendations = testObject.getAllRecommendationsWithReason();
    assert.ok(recommendations["ms-python.python"]);
    assert.ok(!recommendations["mockpublisher1.mockextension1"]);
    assert.ok(!recommendations["mockpublisher2.mockextension2"]);
    extensionIgnoredRecommendationsService.toggleGlobalIgnoredRecommendation("mockpublisher1.mockextension1", false);
    recommendations = testObject.getAllRecommendationsWithReason();
    assert.ok(recommendations["ms-python.python"]);
    assert.ok(recommendations["mockpublisher1.mockextension1"]);
    assert.ok(!recommendations["mockpublisher2.mockextension2"]);
  }));
  test("test global extensions are modified and recommendation change event is fired when an extension is ignored", async () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const storageService = instantiationService.get(IStorageService);
    const changeHandlerTarget = sinon.spy();
    const ignoredExtensionId = "Some.Extension";
    storageService.store("extensionsAssistant/workspaceRecommendationsIgnore", true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    storageService.store("extensionsAssistant/ignored_recommendations", '["ms-vscode.vscode"]', StorageScope.PROFILE, StorageTarget.MACHINE);
    await setUpFolderWorkspace("myFolder", []);
    testObject = disposableStore.add(instantiationService.createInstance(ExtensionRecommendationsService));
    const extensionIgnoredRecommendationsService = instantiationService.get(IExtensionIgnoredRecommendationsService);
    disposableStore.add(extensionIgnoredRecommendationsService.onDidChangeGlobalIgnoredRecommendation(changeHandlerTarget));
    extensionIgnoredRecommendationsService.toggleGlobalIgnoredRecommendation(ignoredExtensionId, true);
    await testObject.activationPromise;
    assert.ok(changeHandlerTarget.calledOnce);
    assert.ok(changeHandlerTarget.getCall(0).calledWithMatch({ extensionId: ignoredExtensionId.toLowerCase(), isRecommended: false }));
  }));
  test("ExtensionRecommendationsService: Get file based recommendations from storage (old format)", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const storedRecommendations = '["ms-dotnettools.csharp", "ms-python.python", "ms-vscode.vscode-typescript-tslint-plugin"]';
    instantiationService.get(IStorageService).store("extensionsAssistant/recommendations", storedRecommendations, StorageScope.PROFILE, StorageTarget.MACHINE);
    return setUpFolderWorkspace("myFolder", []).then(() => {
      testObject = disposableStore.add(instantiationService.createInstance(ExtensionRecommendationsService));
      return testObject.activationPromise.then(() => {
        const recommendations = testObject.getFileBasedRecommendations();
        assert.strictEqual(recommendations.length, 2);
        assert.ok(recommendations.some((extensionId) => extensionId === "ms-dotnettools.csharp"));
        assert.ok(recommendations.some((extensionId) => extensionId === "ms-python.python"));
        assert.ok(recommendations.every((extensionId) => extensionId !== "ms-vscode.vscode-typescript-tslint-plugin"));
      });
    });
  }));
  test("ExtensionRecommendationsService: Get file based recommendations from storage (new format)", async () => {
    const milliSecondsInADay = 1e3 * 60 * 60 * 24;
    const now = Date.now();
    const tenDaysOld = 10 * milliSecondsInADay;
    const storedRecommendations = `{"ms-dotnettools.csharp": ${now}, "ms-python.python": ${now}, "ms-vscode.vscode-typescript-tslint-plugin": ${now}, "lukehoban.Go": ${tenDaysOld}}`;
    instantiationService.get(IStorageService).store("extensionsAssistant/recommendations", storedRecommendations, StorageScope.PROFILE, StorageTarget.MACHINE);
    await setUpFolderWorkspace("myFolder", []);
    testObject = disposableStore.add(instantiationService.createInstance(ExtensionRecommendationsService));
    await testObject.activationPromise;
    const recommendations = testObject.getFileBasedRecommendations();
    assert.strictEqual(recommendations.length, 2);
    assert.ok(recommendations.some((extensionId) => extensionId === "ms-dotnettools.csharp"));
    assert.ok(recommendations.some((extensionId) => extensionId === "ms-python.python"));
    assert.ok(recommendations.every((extensionId) => extensionId !== "ms-vscode.vscode-typescript-tslint-plugin"));
    assert.ok(recommendations.every((extensionId) => extensionId !== "lukehoban.Go"));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL3Rlc3QvZWxlY3Ryb24tc2FuZGJveC9leHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBzaW5vbiBmcm9tICdzaW5vbic7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyB1dWlkIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHtcblx0SUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLCBJR2FsbGVyeUV4dGVuc2lvbkFzc2V0cywgSUdhbGxlcnlFeHRlbnNpb24sIElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwgSUV4dGVuc2lvblRpcHNTZXJ2aWNlLCBnZXRUYXJnZXRQbGF0Zm9ybSxcbn0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25HYWxsZXJ5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgTnVsbFRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeVV0aWxzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFRlc3RMaWZlY3ljbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBUZXN0Q29udGV4dFNlcnZpY2UsIFRlc3RQcm9kdWN0U2VydmljZSwgVGVzdFN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IFRlc3RFeHRlbnNpb25UaXBzU2VydmljZSwgVGVzdFNoYXJlZFByb2Nlc3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9lbGVjdHJvbi1zYW5kYm94L3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBUZXN0Tm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Tm90aWZpY2F0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyB0ZXN0V29ya3NwYWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL3Rlc3QvY29tbW9uL3Rlc3RXb3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVBhZ2VyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGFnaW5nLmpzJztcbmltcG9ydCB7IGdldEdhbGxlcnlFeHRlbnNpb25JZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnRVdGlsLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbktleSwgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgVGVzdEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC90ZXN0L2Jyb3dzZXIvZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UudGVzdC5qcyc7XG5pbXBvcnQgeyBJVVJMU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VybC9jb21tb24vdXJsLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIFNldmVyaXR5LCBJUHJvbXB0Q2hvaWNlLCBJUHJvbXB0T3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IE5hdGl2ZVVSTFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmwvY29tbW9uL3VybFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElTaGFyZWRQcm9jZXNzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2lwYy9lbGVjdHJvbi1zYW5kYm94L3NlcnZpY2VzLmpzJztcbmltcG9ydCB7IEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlLCBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9leHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5vT3BXb3Jrc3BhY2VUYWdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3RhZ3MvYnJvd3Nlci93b3Jrc3BhY2VUYWdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlVGFnc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi90YWdzL2NvbW1vbi93b3Jrc3BhY2VUYWdzLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlLCBXb3Jrc3BhY2VFeHRlbnNpb25zQ29uZmlnU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvblJlY29tbWVuZGF0aW9ucy9jb21tb24vd29ya3NwYWNlRXh0ZW5zaW9uc0NvbmZpZy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uSWdub3JlZFJlY29tbWVuZGF0aW9uc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25SZWNvbW1lbmRhdGlvbnMvY29tbW9uL2V4dGVuc2lvblJlY29tbWVuZGF0aW9ucy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZ25vcmVkUmVjb21tZW5kYXRpb25zU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvblJlY29tbWVuZGF0aW9ucy9jb21tb24vZXh0ZW5zaW9uSWdub3JlZFJlY29tbWVuZGF0aW9uc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblJlY29tbWVuZGF0aW9uTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvblJlY29tbWVuZGF0aW9ucy9jb21tb24vZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblJlY29tbWVuZGF0aW9uTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25Ob3RpZmljYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgTW9ja0NvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy90ZXN0L2NvbW1vbi9tb2NrS2V5YmluZGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vaW5NZW1vcnlGaWxlc3lzdGVtUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgam9pblBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBhcmNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcHJvY2Vzcy5qcyc7XG5pbXBvcnQgeyBydW5XaXRoRmFrZWRUaW1lcnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3RpbWVUcmF2ZWxTY2hlZHVsZXIuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElVcGRhdGVTZXJ2aWNlLCBTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VwZGF0ZS9jb21tb24vdXBkYXRlLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5U2VydmljZS5qcyc7XG5cbmNvbnN0IFJPT1QgPSBVUkkuZmlsZSgndGVzdHMnKS53aXRoKHsgc2NoZW1lOiAndnNjb2RlLXRlc3RzJyB9KTtcblxuY29uc3QgbW9ja0V4dGVuc2lvbkdhbGxlcnk6IElHYWxsZXJ5RXh0ZW5zaW9uW10gPSBbXG5cdGFHYWxsZXJ5RXh0ZW5zaW9uKCdNb2NrRXh0ZW5zaW9uMScsIHtcblx0XHRkaXNwbGF5TmFtZTogJ01vY2sgRXh0ZW5zaW9uIDEnLFxuXHRcdHZlcnNpb246ICcxLjUnLFxuXHRcdHB1Ymxpc2hlcklkOiAnbW9ja1B1Ymxpc2hlcjFJZCcsXG5cdFx0cHVibGlzaGVyOiAnbW9ja1B1Ymxpc2hlcjEnLFxuXHRcdHB1Ymxpc2hlckRpc3BsYXlOYW1lOiAnTW9jayBQdWJsaXNoZXIgMScsXG5cdFx0ZGVzY3JpcHRpb246ICdNb2NrIERlc2NyaXB0aW9uJyxcblx0XHRpbnN0YWxsQ291bnQ6IDEwMDAsXG5cdFx0cmF0aW5nOiA0LFxuXHRcdHJhdGluZ0NvdW50OiAxMDBcblx0fSwge1xuXHRcdGRlcGVuZGVuY2llczogWydwdWIuMSddLFxuXHR9LCB7XG5cdFx0bWFuaWZlc3Q6IHsgdXJpOiAndXJpOm1hbmlmZXN0JywgZmFsbGJhY2tVcmk6ICdmYWxsYmFjazptYW5pZmVzdCcgfSxcblx0XHRyZWFkbWU6IHsgdXJpOiAndXJpOnJlYWRtZScsIGZhbGxiYWNrVXJpOiAnZmFsbGJhY2s6cmVhZG1lJyB9LFxuXHRcdGNoYW5nZWxvZzogeyB1cmk6ICd1cmk6Y2hhbmdlbG9nJywgZmFsbGJhY2tVcmk6ICdmYWxsYmFjazpjaGFuZ2xvZycgfSxcblx0XHRkb3dubG9hZDogeyB1cmk6ICd1cmk6ZG93bmxvYWQnLCBmYWxsYmFja1VyaTogJ2ZhbGxiYWNrOmRvd25sb2FkJyB9LFxuXHRcdGljb246IHsgdXJpOiAndXJpOmljb24nLCBmYWxsYmFja1VyaTogJ2ZhbGxiYWNrOmljb24nIH0sXG5cdFx0bGljZW5zZTogeyB1cmk6ICd1cmk6bGljZW5zZScsIGZhbGxiYWNrVXJpOiAnZmFsbGJhY2s6bGljZW5zZScgfSxcblx0XHRyZXBvc2l0b3J5OiB7IHVyaTogJ3VyaTpyZXBvc2l0b3J5JywgZmFsbGJhY2tVcmk6ICdmYWxsYmFjazpyZXBvc2l0b3J5JyB9LFxuXHRcdHNpZ25hdHVyZTogeyB1cmk6ICd1cmk6c2lnbmF0dXJlJywgZmFsbGJhY2tVcmk6ICdmYWxsYmFjazpzaWduYXR1cmUnIH0sXG5cdFx0Y29yZVRyYW5zbGF0aW9uczogW11cblx0fSksXG5cdGFHYWxsZXJ5RXh0ZW5zaW9uKCdNb2NrRXh0ZW5zaW9uMicsIHtcblx0XHRkaXNwbGF5TmFtZTogJ01vY2sgRXh0ZW5zaW9uIDInLFxuXHRcdHZlcnNpb246ICcxLjUnLFxuXHRcdHB1Ymxpc2hlcklkOiAnbW9ja1B1Ymxpc2hlcjJJZCcsXG5cdFx0cHVibGlzaGVyOiAnbW9ja1B1Ymxpc2hlcjInLFxuXHRcdHB1Ymxpc2hlckRpc3BsYXlOYW1lOiAnTW9jayBQdWJsaXNoZXIgMicsXG5cdFx0ZGVzY3JpcHRpb246ICdNb2NrIERlc2NyaXB0aW9uJyxcblx0XHRpbnN0YWxsQ291bnQ6IDEwMDAsXG5cdFx0cmF0aW5nOiA0LFxuXHRcdHJhdGluZ0NvdW50OiAxMDBcblx0fSwge1xuXHRcdGRlcGVuZGVuY2llczogWydwdWIuMScsICdwdWIuMiddLFxuXHR9LCB7XG5cdFx0bWFuaWZlc3Q6IHsgdXJpOiAndXJpOm1hbmlmZXN0JywgZmFsbGJhY2tVcmk6ICdmYWxsYmFjazptYW5pZmVzdCcgfSxcblx0XHRyZWFkbWU6IHsgdXJpOiAndXJpOnJlYWRtZScsIGZhbGxiYWNrVXJpOiAnZmFsbGJhY2s6cmVhZG1lJyB9LFxuXHRcdGNoYW5nZWxvZzogeyB1cmk6ICd1cmk6Y2hhbmdlbG9nJywgZmFsbGJhY2tVcmk6ICdmYWxsYmFjazpjaGFuZ2xvZycgfSxcblx0XHRkb3dubG9hZDogeyB1cmk6ICd1cmk6ZG93bmxvYWQnLCBmYWxsYmFja1VyaTogJ2ZhbGxiYWNrOmRvd25sb2FkJyB9LFxuXHRcdGljb246IHsgdXJpOiAndXJpOmljb24nLCBmYWxsYmFja1VyaTogJ2ZhbGxiYWNrOmljb24nIH0sXG5cdFx0bGljZW5zZTogeyB1cmk6ICd1cmk6bGljZW5zZScsIGZhbGxiYWNrVXJpOiAnZmFsbGJhY2s6bGljZW5zZScgfSxcblx0XHRyZXBvc2l0b3J5OiB7IHVyaTogJ3VyaTpyZXBvc2l0b3J5JywgZmFsbGJhY2tVcmk6ICdmYWxsYmFjazpyZXBvc2l0b3J5JyB9LFxuXHRcdHNpZ25hdHVyZTogeyB1cmk6ICd1cmk6c2lnbmF0dXJlJywgZmFsbGJhY2tVcmk6ICdmYWxsYmFjazpzaWduYXR1cmUnIH0sXG5cdFx0Y29yZVRyYW5zbGF0aW9uczogW11cblx0fSlcbl07XG5cbmNvbnN0IG1vY2tFeHRlbnNpb25Mb2NhbCA9IFtcblx0e1xuXHRcdHR5cGU6IEV4dGVuc2lvblR5cGUuVXNlcixcblx0XHRpZGVudGlmaWVyOiBtb2NrRXh0ZW5zaW9uR2FsbGVyeVswXS5pZGVudGlmaWVyLFxuXHRcdG1hbmlmZXN0OiB7XG5cdFx0XHRuYW1lOiBtb2NrRXh0ZW5zaW9uR2FsbGVyeVswXS5uYW1lLFxuXHRcdFx0cHVibGlzaGVyOiBtb2NrRXh0ZW5zaW9uR2FsbGVyeVswXS5wdWJsaXNoZXIsXG5cdFx0XHR2ZXJzaW9uOiBtb2NrRXh0ZW5zaW9uR2FsbGVyeVswXS52ZXJzaW9uXG5cdFx0fSxcblx0XHRtZXRhZGF0YTogbnVsbCxcblx0XHRwYXRoOiAnc29tZXBhdGgnLFxuXHRcdHJlYWRtZVVybDogJ3NvbWUgcmVhZG1lVXJsJyxcblx0XHRjaGFuZ2Vsb2dVcmw6ICdzb21lIGNoYW5nZWxvZ1VybCdcblx0fSxcblx0e1xuXHRcdHR5cGU6IEV4dGVuc2lvblR5cGUuVXNlcixcblx0XHRpZGVudGlmaWVyOiBtb2NrRXh0ZW5zaW9uR2FsbGVyeVsxXS5pZGVudGlmaWVyLFxuXHRcdG1hbmlmZXN0OiB7XG5cdFx0XHRuYW1lOiBtb2NrRXh0ZW5zaW9uR2FsbGVyeVsxXS5uYW1lLFxuXHRcdFx0cHVibGlzaGVyOiBtb2NrRXh0ZW5zaW9uR2FsbGVyeVsxXS5wdWJsaXNoZXIsXG5cdFx0XHR2ZXJzaW9uOiBtb2NrRXh0ZW5zaW9uR2FsbGVyeVsxXS52ZXJzaW9uXG5cdFx0fSxcblx0XHRtZXRhZGF0YTogbnVsbCxcblx0XHRwYXRoOiAnc29tZXBhdGgnLFxuXHRcdHJlYWRtZVVybDogJ3NvbWUgcmVhZG1lVXJsJyxcblx0XHRjaGFuZ2Vsb2dVcmw6ICdzb21lIGNoYW5nZWxvZ1VybCdcblx0fVxuXTtcblxuY29uc3QgbW9ja1Rlc3REYXRhID0ge1xuXHRyZWNvbW1lbmRlZEV4dGVuc2lvbnM6IFtcblx0XHQnbW9ja1B1Ymxpc2hlcjEubW9ja0V4dGVuc2lvbjEnLFxuXHRcdCdNT0NLUFVCTElTSEVSMi5tb2NrZXh0ZW5zaW9uMicsXG5cdFx0J2JhZGx5Zm9ybWF0dGVkZXh0ZW5zaW9uJyxcblx0XHQnTU9DS1BVQkxJU0hFUjIubW9ja2V4dGVuc2lvbjInLFxuXHRcdCd1bmtub3duLmV4dGVuc2lvbidcblx0XSxcblx0dmFsaWRSZWNvbW1lbmRlZEV4dGVuc2lvbnM6IFtcblx0XHQnbW9ja1B1Ymxpc2hlcjEubW9ja0V4dGVuc2lvbjEnLFxuXHRcdCdNT0NLUFVCTElTSEVSMi5tb2NrZXh0ZW5zaW9uMidcblx0XVxufTtcblxuZnVuY3Rpb24gYVBhZ2U8VD4oLi4ub2JqZWN0czogVFtdKTogSVBhZ2VyPFQ+IHtcblx0cmV0dXJuIHsgZmlyc3RQYWdlOiBvYmplY3RzLCB0b3RhbDogb2JqZWN0cy5sZW5ndGgsIHBhZ2VTaXplOiBvYmplY3RzLmxlbmd0aCwgZ2V0UGFnZTogKCkgPT4gbnVsbCEgfTtcbn1cblxuY29uc3Qgbm9Bc3NldHM6IElHYWxsZXJ5RXh0ZW5zaW9uQXNzZXRzID0ge1xuXHRjaGFuZ2Vsb2c6IG51bGwsXG5cdGRvd25sb2FkOiBudWxsISxcblx0aWNvbjogbnVsbCEsXG5cdGxpY2Vuc2U6IG51bGwsXG5cdG1hbmlmZXN0OiBudWxsLFxuXHRyZWFkbWU6IG51bGwsXG5cdHJlcG9zaXRvcnk6IG51bGwsXG5cdHNpZ25hdHVyZTogbnVsbCxcblx0Y29yZVRyYW5zbGF0aW9uczogW11cbn07XG5cbmZ1bmN0aW9uIGFHYWxsZXJ5RXh0ZW5zaW9uKG5hbWU6IHN0cmluZywgcHJvcGVydGllczogYW55ID0ge30sIGdhbGxlcnlFeHRlbnNpb25Qcm9wZXJ0aWVzOiBhbnkgPSB7fSwgYXNzZXRzOiBJR2FsbGVyeUV4dGVuc2lvbkFzc2V0cyA9IG5vQXNzZXRzKTogSUdhbGxlcnlFeHRlbnNpb24ge1xuXHRjb25zdCB0YXJnZXRQbGF0Zm9ybSA9IGdldFRhcmdldFBsYXRmb3JtKHBsYXRmb3JtLCBhcmNoKTtcblx0Y29uc3QgZ2FsbGVyeUV4dGVuc2lvbiA9IDxJR2FsbGVyeUV4dGVuc2lvbj5PYmplY3QuY3JlYXRlKHsgbmFtZSwgcHVibGlzaGVyOiAncHViJywgdmVyc2lvbjogJzEuMC4wJywgYWxsVGFyZ2V0UGxhdGZvcm1zOiBbdGFyZ2V0UGxhdGZvcm1dLCBwcm9wZXJ0aWVzOiB7fSwgYXNzZXRzOiB7fSwgLi4ucHJvcGVydGllcyB9KTtcblx0Z2FsbGVyeUV4dGVuc2lvbi5wcm9wZXJ0aWVzID0geyAuLi5nYWxsZXJ5RXh0ZW5zaW9uLnByb3BlcnRpZXMsIGRlcGVuZGVuY2llczogW10sIHRhcmdldFBsYXRmb3JtLCAuLi5nYWxsZXJ5RXh0ZW5zaW9uUHJvcGVydGllcyB9O1xuXHRnYWxsZXJ5RXh0ZW5zaW9uLmFzc2V0cyA9IHsgLi4uZ2FsbGVyeUV4dGVuc2lvbi5hc3NldHMsIC4uLmFzc2V0cyB9O1xuXHRnYWxsZXJ5RXh0ZW5zaW9uLmlkZW50aWZpZXIgPSB7IGlkOiBnZXRHYWxsZXJ5RXh0ZW5zaW9uSWQoZ2FsbGVyeUV4dGVuc2lvbi5wdWJsaXNoZXIsIGdhbGxlcnlFeHRlbnNpb24ubmFtZSksIHV1aWQ6IHV1aWQuZ2VuZXJhdGVVdWlkKCkgfTtcblx0cmV0dXJuIDxJR2FsbGVyeUV4dGVuc2lvbj5nYWxsZXJ5RXh0ZW5zaW9uO1xufVxuXG5zdWl0ZSgnRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZSBUZXN0JywgKCkgPT4ge1xuXHRsZXQgZGlzcG9zYWJsZVN0b3JlOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCB3b3Jrc3BhY2VTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2U7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlOiBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2U7XG5cdGxldCB0ZXN0T2JqZWN0OiBFeHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlO1xuXHRsZXQgcHJvbXB0ZWQ6IGJvb2xlYW47XG5cdGxldCBwcm9tcHRlZEVtaXR0ZXI6IEVtaXR0ZXI8dm9pZD47XG5cdGxldCBvbk1vZGVsQWRkZWRFdmVudDogRW1pdHRlcjxJVGV4dE1vZGVsPjtcblxuXHR0ZWFyZG93bihhc3luYyAoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZVN0b3JlLmRpc3Bvc2UoKTtcblx0XHRhd2FpdCB0aW1lb3V0KDApOyAvLyBhbGxvdyBmb3IgYXN5bmMgZGlzcG9zYWJsZXMgdG8gY29tcGxldGVcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZSA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSgpKTtcblx0XHRwcm9tcHRlZEVtaXR0ZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLCBFeHRlbnNpb25HYWxsZXJ5U2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU2hhcmVkUHJvY2Vzc1NlcnZpY2UsIFRlc3RTaGFyZWRQcm9jZXNzU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTGlmZWN5Y2xlU2VydmljZSwgZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVGVzdExpZmVjeWNsZVNlcnZpY2UoKSkpO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb25maWd1cmF0aW9uU2VydmljZSwgdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElQcm9kdWN0U2VydmljZSwgVGVzdFByb2R1Y3RTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElMb2dTZXJ2aWNlLCBOdWxsTG9nU2VydmljZSk7XG5cdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBuZXcgRmlsZVNlcnZpY2UoaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMb2dTZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRmlsZVNlcnZpY2UsIGRpc3Bvc2FibGVTdG9yZS5hZGQoZmlsZVNlcnZpY2UpKTtcblx0XHRjb25zdCBmaWxlU3lzdGVtUHJvdmlkZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlcigpKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKGZpbGVTZXJ2aWNlLnJlZ2lzdGVyUHJvdmlkZXIoUk9PVC5zY2hlbWUsIGZpbGVTeXN0ZW1Qcm92aWRlcikpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVVyaUlkZW50aXR5U2VydmljZSwgZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXJpSWRlbnRpdHlTZXJ2aWNlKGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpKSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU5vdGlmaWNhdGlvblNlcnZpY2UsIG5ldyBUZXN0Tm90aWZpY2F0aW9uU2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb250ZXh0S2V5U2VydmljZSwgbmV3IE1vY2tDb250ZXh0S2V5U2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwge1xuXHRcdFx0b25JbnN0YWxsRXh0ZW5zaW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRJbnN0YWxsRXh0ZW5zaW9uczogRXZlbnQuTm9uZSxcblx0XHRcdG9uVW5pbnN0YWxsRXh0ZW5zaW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRVbmluc3RhbGxFeHRlbnNpb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhOiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRDaGFuZ2VQcm9maWxlOiBFdmVudC5Ob25lLFxuXHRcdFx0b25Qcm9maWxlQXdhcmVEaWRJbnN0YWxsRXh0ZW5zaW9uczogRXZlbnQuTm9uZSxcblx0XHRcdGFzeW5jIGdldEluc3RhbGxlZCgpIHsgcmV0dXJuIFtdOyB9LFxuXHRcdFx0YXN5bmMgY2FuSW5zdGFsbCgpIHsgcmV0dXJuIHRydWU7IH0sXG5cdFx0XHRhc3luYyBnZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KCkgeyByZXR1cm4geyBtYWxpY2lvdXM6IFtdLCBkZXByZWNhdGVkOiB7fSwgc2VhcmNoOiBbXSwgcHVibGlzaGVyTWFwcGluZzoge30gfTsgfSxcblx0XHRcdGFzeW5jIGdldFRhcmdldFBsYXRmb3JtKCkgeyByZXR1cm4gZ2V0VGFyZ2V0UGxhdGZvcm0ocGxhdGZvcm0sIGFyY2gpOyB9LFxuXHRcdH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUV4dGVuc2lvblNlcnZpY2UsIHtcblx0XHRcdG9uRGlkQ2hhbmdlRXh0ZW5zaW9uczogRXZlbnQuTm9uZSxcblx0XHRcdGV4dGVuc2lvbnM6IFtdLFxuXHRcdFx0YXN5bmMgd2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCkgeyByZXR1cm4gdHJ1ZTsgfVxuXHRcdH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBUZXN0RXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UoaW5zdGFudGlhdGlvblNlcnZpY2UpKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGVsZW1ldHJ5U2VydmljZSwgTnVsbFRlbGVtZXRyeVNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVVSTFNlcnZpY2UsIE5hdGl2ZVVSTFNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVdvcmtzcGFjZVRhZ3NTZXJ2aWNlLCBuZXcgTm9PcFdvcmtzcGFjZVRhZ3NTZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVN0b3JhZ2VTZXJ2aWNlLCBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUxvZ1NlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElQcm9kdWN0U2VydmljZSwge1xuXHRcdFx0ZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zOiB7XG5cdFx0XHRcdCdtcy1weXRob24ucHl0aG9uJzoge1xuXHRcdFx0XHRcdG9uRmlsZU9wZW46IFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0J3BhdGhHbG9iJzogJ3sqKi8qLnB5fScsXG5cdFx0XHRcdFx0XHRcdGltcG9ydGFudDogdHJ1ZVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0J21zLXZzY29kZS5Qb3dlclNoZWxsJzoge1xuXHRcdFx0XHRcdG9uRmlsZU9wZW46IFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0J3BhdGhHbG9iJzogJ3sqKi8qLnBzLCoqLyoucHMxfScsXG5cdFx0XHRcdFx0XHRcdGltcG9ydGFudDogdHJ1ZVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0J21zLWRvdG5ldHRvb2xzLmNzaGFycCc6IHtcblx0XHRcdFx0XHRvbkZpbGVPcGVuOiBbXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdCdwYXRoR2xvYic6ICd7KiovKi5jcywqKi9wcm9qZWN0Lmpzb24sKiovZ2xvYmFsLmpzb24sKiovKi5jc3Byb2osKiovKi5zbG4sKiovYXBwc2V0dGluZ3MuanNvbn0nLFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0J21zanNkaWFnLmRlYnVnZ2VyLWZvci1jaHJvbWUnOiB7XG5cdFx0XHRcdFx0b25GaWxlT3BlbjogW1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHQncGF0aEdsb2InOiAneyoqLyoudHMsKiovKi50c3gsKiovKi5qcywqKi8qLmpzeCwqKi8qLmVzNiwqKi8qLm1qcywqKi8qLmNqcywqKi8uYmFiZWxyY30nLFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0J2x1a2Vob2Jhbi5Hbyc6IHtcblx0XHRcdFx0XHRvbkZpbGVPcGVuOiBbXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdCdwYXRoR2xvYic6ICcqKi8qLmdvJyxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRdXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVcGRhdGVTZXJ2aWNlLCB7IG9uU3RhdGVDaGFuZ2U6IEV2ZW50Lk5vbmUsIHN0YXRlOiBTdGF0ZS5VbmluaXRpYWxpemVkIH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsIGRpc3Bvc2FibGVTdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRXh0ZW5zaW9uVGlwc1NlcnZpY2UsIGRpc3Bvc2FibGVTdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdEV4dGVuc2lvblRpcHNTZXJ2aWNlKSkpO1xuXG5cdFx0b25Nb2RlbEFkZGVkRXZlbnQgPSBuZXcgRW1pdHRlcjxJVGV4dE1vZGVsPigpO1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRW52aXJvbm1lbnRTZXJ2aWNlLCB7fSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YlByb21pc2UoSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCAnZ2V0SW5zdGFsbGVkJywgW10pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLCAnaXNFbmFibGVkJywgdHJ1ZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YlByb21pc2UoSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLCAncXVlcnknLCBhUGFnZTxJR2FsbGVyeUV4dGVuc2lvbj4oLi4ubW9ja0V4dGVuc2lvbkdhbGxlcnkpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViUHJvbWlzZShJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsICdnZXRFeHRlbnNpb25zJywgbW9ja0V4dGVuc2lvbkdhbGxlcnkpO1xuXG5cdFx0cHJvbXB0ZWQgPSBmYWxzZTtcblxuXHRcdGNsYXNzIFRlc3ROb3RpZmljYXRpb25TZXJ2aWNlMiBleHRlbmRzIFRlc3ROb3RpZmljYXRpb25TZXJ2aWNlIHtcblx0XHRcdHB1YmxpYyBvdmVycmlkZSBwcm9tcHQoc2V2ZXJpdHk6IFNldmVyaXR5LCBtZXNzYWdlOiBzdHJpbmcsIGNob2ljZXM6IElQcm9tcHRDaG9pY2VbXSwgb3B0aW9ucz86IElQcm9tcHRPcHRpb25zKSB7XG5cdFx0XHRcdHByb21wdGVkID0gdHJ1ZTtcblx0XHRcdFx0cHJvbXB0ZWRFbWl0dGVyLmZpcmUoKTtcblx0XHRcdFx0cmV0dXJuIHN1cGVyLnByb21wdChzZXZlcml0eSwgbWVzc2FnZSwgY2hvaWNlcywgb3B0aW9ucyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTm90aWZpY2F0aW9uU2VydmljZSwgbmV3IFRlc3ROb3RpZmljYXRpb25TZXJ2aWNlMigpKTtcblxuXHRcdHRlc3RDb25maWd1cmF0aW9uU2VydmljZS5zZXRVc2VyQ29uZmlndXJhdGlvbihDb25maWd1cmF0aW9uS2V5LCB7IGlnbm9yZVJlY29tbWVuZGF0aW9uczogZmFsc2UgfSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTW9kZWxTZXJ2aWNlLCA8SU1vZGVsU2VydmljZT57XG5cdFx0XHRnZXRNb2RlbHMoKTogYW55IHsgcmV0dXJuIFtdOyB9LFxuXHRcdFx0b25Nb2RlbEFkZGVkOiBvbk1vZGVsQWRkZWRFdmVudC5ldmVudFxuXHRcdH0pO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBzZXRVcEZvbGRlcldvcmtzcGFjZShmb2xkZXJOYW1lOiBzdHJpbmcsIHJlY29tbWVuZGVkRXh0ZW5zaW9uczogc3RyaW5nW10sIGlnbm9yZWRSZWNvbW1lbmRhdGlvbnM6IHN0cmluZ1tdID0gW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gc2V0VXBGb2xkZXIoZm9sZGVyTmFtZSwgcmVjb21tZW5kZWRFeHRlbnNpb25zLCBpZ25vcmVkUmVjb21tZW5kYXRpb25zKTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIHNldFVwRm9sZGVyKGZvbGRlck5hbWU6IHN0cmluZywgcmVjb21tZW5kZWRFeHRlbnNpb25zOiBzdHJpbmdbXSwgaWdub3JlZFJlY29tbWVuZGF0aW9uczogc3RyaW5nW10gPSBbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0Y29uc3QgZm9sZGVyRGlyID0gam9pblBhdGgoUk9PVCwgZm9sZGVyTmFtZSk7XG5cdFx0Y29uc3Qgd29ya3NwYWNlU2V0dGluZ3NEaXIgPSBqb2luUGF0aChmb2xkZXJEaXIsICcudnNjb2RlJyk7XG5cdFx0YXdhaXQgZmlsZVNlcnZpY2UuY3JlYXRlRm9sZGVyKHdvcmtzcGFjZVNldHRpbmdzRGlyKTtcblx0XHRjb25zdCBjb25maWdQYXRoID0gam9pblBhdGgod29ya3NwYWNlU2V0dGluZ3NEaXIsICdleHRlbnNpb25zLmpzb24nKTtcblx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUoY29uZmlnUGF0aCwgVlNCdWZmZXIuZnJvbVN0cmluZyhKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHQncmVjb21tZW5kYXRpb25zJzogcmVjb21tZW5kZWRFeHRlbnNpb25zLFxuXHRcdFx0J3Vud2FudGVkUmVjb21tZW5kYXRpb25zJzogaWdub3JlZFJlY29tbWVuZGF0aW9ucyxcblx0XHR9LCBudWxsLCAnXFx0JykpKTtcblxuXHRcdGNvbnN0IG15V29ya3NwYWNlID0gdGVzdFdvcmtzcGFjZShmb2xkZXJEaXIpO1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRmlsZVNlcnZpY2UsIGZpbGVTZXJ2aWNlKTtcblx0XHR3b3Jrc3BhY2VTZXJ2aWNlID0gbmV3IFRlc3RDb250ZXh0U2VydmljZShteVdvcmtzcGFjZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIHdvcmtzcGFjZVNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlLCBkaXNwb3NhYmxlU3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlKSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUV4dGVuc2lvbklnbm9yZWRSZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLCBkaXNwb3NhYmxlU3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbklnbm9yZWRSZWNvbW1lbmRhdGlvbnNTZXJ2aWNlKSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUV4dGVuc2lvblJlY29tbWVuZGF0aW9uTm90aWZpY2F0aW9uU2VydmljZSwgZGlzcG9zYWJsZVN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb25SZWNvbW1lbmRhdGlvbk5vdGlmaWNhdGlvblNlcnZpY2UpKSk7XG5cdH1cblxuXHRmdW5jdGlvbiB0ZXN0Tm9Qcm9tcHRGb3JWYWxpZFJlY29tbWVuZGF0aW9ucyhyZWNvbW1lbmRhdGlvbnM6IHN0cmluZ1tdKSB7XG5cdFx0cmV0dXJuIHNldFVwRm9sZGVyV29ya3NwYWNlKCdteUZvbGRlcicsIHJlY29tbWVuZGF0aW9ucykudGhlbigoKSA9PiB7XG5cdFx0XHR0ZXN0T2JqZWN0ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlKSk7XG5cdFx0XHRyZXR1cm4gdGVzdE9iamVjdC5hY3RpdmF0aW9uUHJvbWlzZS50aGVuKCgpID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKE9iamVjdC5rZXlzKHRlc3RPYmplY3QuZ2V0QWxsUmVjb21tZW5kYXRpb25zV2l0aFJlYXNvbigpKS5sZW5ndGgsIHJlY29tbWVuZGF0aW9ucy5sZW5ndGgpO1xuXHRcdFx0XHRhc3NlcnQub2soIXByb21wdGVkKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0ZnVuY3Rpb24gdGVzdE5vUHJvbXB0T3JSZWNvbW1lbmRhdGlvbnNGb3JWYWxpZFJlY29tbWVuZGF0aW9ucyhyZWNvbW1lbmRhdGlvbnM6IHN0cmluZ1tdKSB7XG5cdFx0cmV0dXJuIHNldFVwRm9sZGVyV29ya3NwYWNlKCdteUZvbGRlcicsIG1vY2tUZXN0RGF0YS52YWxpZFJlY29tbWVuZGVkRXh0ZW5zaW9ucykudGhlbigoKSA9PiB7XG5cdFx0XHR0ZXN0T2JqZWN0ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlKSk7XG5cdFx0XHRhc3NlcnQub2soIXByb21wdGVkKTtcblxuXHRcdFx0cmV0dXJuIHRlc3RPYmplY3QuZ2V0V29ya3NwYWNlUmVjb21tZW5kYXRpb25zKCkudGhlbigoKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChPYmplY3Qua2V5cyh0ZXN0T2JqZWN0LmdldEFsbFJlY29tbWVuZGF0aW9uc1dpdGhSZWFzb24oKSkubGVuZ3RoLCAwKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFwcm9tcHRlZCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHRlc3QoJ0V4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2U6IE5vIFByb21wdCBmb3IgdmFsaWQgd29ya3NwYWNlIHJlY29tbWVuZGF0aW9ucyB3aGVuIGdhbGxlcnlTZXJ2aWNlIGlzIGFic2VudCcsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGdhbGxlcnlRdWVyeVNweSA9IHNpbm9uLnNweSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLCB7IHF1ZXJ5OiBnYWxsZXJ5UXVlcnlTcHksIGlzRW5hYmxlZDogKCkgPT4gZmFsc2UgfSk7XG5cblx0XHRyZXR1cm4gdGVzdE5vUHJvbXB0T3JSZWNvbW1lbmRhdGlvbnNGb3JWYWxpZFJlY29tbWVuZGF0aW9ucyhtb2NrVGVzdERhdGEudmFsaWRSZWNvbW1lbmRlZEV4dGVuc2lvbnMpXG5cdFx0XHQudGhlbigoKSA9PiBhc3NlcnQub2soZ2FsbGVyeVF1ZXJ5U3B5Lm5vdENhbGxlZCkpO1xuXHR9KSk7XG5cblx0dGVzdCgnRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZTogTm8gUHJvbXB0IGZvciB2YWxpZCB3b3Jrc3BhY2UgcmVjb21tZW5kYXRpb25zIGR1cmluZyBleHRlbnNpb24gZGV2ZWxvcG1lbnQnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFbnZpcm9ubWVudFNlcnZpY2UsIHsgZXh0ZW5zaW9uRGV2ZWxvcG1lbnRMb2NhdGlvblVSSTogW1VSSS5maWxlKCcvZm9sZGVyL2ZpbGUnKV0sIGlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQ6IHRydWUgfSk7XG5cdFx0cmV0dXJuIHRlc3ROb1Byb21wdE9yUmVjb21tZW5kYXRpb25zRm9yVmFsaWRSZWNvbW1lbmRhdGlvbnMobW9ja1Rlc3REYXRhLnZhbGlkUmVjb21tZW5kZWRFeHRlbnNpb25zKTtcblx0fSkpO1xuXG5cdHRlc3QoJ0V4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2U6IE5vIHdvcmtzcGFjZSByZWNvbW1lbmRhdGlvbnMgb3IgcHJvbXB0cyB3aGVuIGV4dGVuc2lvbnMuanNvbiBoYXMgZW1wdHkgYXJyYXknLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRyZXR1cm4gdGVzdE5vUHJvbXB0Rm9yVmFsaWRSZWNvbW1lbmRhdGlvbnMoW10pO1xuXHR9KSk7XG5cblx0dGVzdCgnRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZTogUHJvbXB0IGZvciB2YWxpZCB3b3Jrc3BhY2UgcmVjb21tZW5kYXRpb25zJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgc2V0VXBGb2xkZXJXb3Jrc3BhY2UoJ215Rm9sZGVyJywgbW9ja1Rlc3REYXRhLnJlY29tbWVuZGVkRXh0ZW5zaW9ucyk7XG5cdFx0dGVzdE9iamVjdCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZSkpO1xuXG5cdFx0YXdhaXQgRXZlbnQudG9Qcm9taXNlKHByb21wdGVkRW1pdHRlci5ldmVudCk7XG5cdFx0Y29uc3QgcmVjb21tZW5kYXRpb25zID0gT2JqZWN0LmtleXModGVzdE9iamVjdC5nZXRBbGxSZWNvbW1lbmRhdGlvbnNXaXRoUmVhc29uKCkpO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gWy4uLm1vY2tUZXN0RGF0YS52YWxpZFJlY29tbWVuZGVkRXh0ZW5zaW9ucywgJ3Vua25vd24uZXh0ZW5zaW9uJ107XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlY29tbWVuZGF0aW9ucy5sZW5ndGgsIGV4cGVjdGVkLmxlbmd0aCk7XG5cdFx0ZXhwZWN0ZWQuZm9yRWFjaCh4ID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWNvbW1lbmRhdGlvbnMuaW5kZXhPZih4LnRvTG93ZXJDYXNlKCkpID4gLTEsIHRydWUpO1xuXHRcdH0pO1xuXHR9KSk7XG5cblx0dGVzdCgnRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZTogTm8gUHJvbXB0IGZvciB2YWxpZCB3b3Jrc3BhY2UgcmVjb21tZW5kYXRpb25zIGlmIHRoZXkgYXJlIGFscmVhZHkgaW5zdGFsbGVkJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YlByb21pc2UoSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCAnZ2V0SW5zdGFsbGVkJywgbW9ja0V4dGVuc2lvbkxvY2FsKTtcblx0XHRyZXR1cm4gdGVzdE5vUHJvbXB0Rm9yVmFsaWRSZWNvbW1lbmRhdGlvbnMobW9ja1Rlc3REYXRhLnZhbGlkUmVjb21tZW5kZWRFeHRlbnNpb25zKTtcblx0fSkpO1xuXG5cdHRlc3QoJ0V4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2U6IE5vIFByb21wdCBmb3IgdmFsaWQgd29ya3NwYWNlIHJlY29tbWVuZGF0aW9ucyB3aXRoIGNhc2luZyBtaXNtYXRjaCBpZiB0aGV5IGFyZSBhbHJlYWR5IGluc3RhbGxlZCcsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWJQcm9taXNlKElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwgJ2dldEluc3RhbGxlZCcsIG1vY2tFeHRlbnNpb25Mb2NhbCk7XG5cdFx0cmV0dXJuIHRlc3ROb1Byb21wdEZvclZhbGlkUmVjb21tZW5kYXRpb25zKG1vY2tUZXN0RGF0YS52YWxpZFJlY29tbWVuZGVkRXh0ZW5zaW9ucy5tYXAoeCA9PiB4LnRvVXBwZXJDYXNlKCkpKTtcblx0fSkpO1xuXG5cdHRlc3QoJ0V4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2U6IE5vIFByb21wdCBmb3IgdmFsaWQgd29ya3NwYWNlIHJlY29tbWVuZGF0aW9ucyBpZiBpZ25vcmVSZWNvbW1lbmRhdGlvbnMgaXMgc2V0JywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLnNldFVzZXJDb25maWd1cmF0aW9uKENvbmZpZ3VyYXRpb25LZXksIHsgaWdub3JlUmVjb21tZW5kYXRpb25zOiB0cnVlIH0pO1xuXHRcdHJldHVybiB0ZXN0Tm9Qcm9tcHRGb3JWYWxpZFJlY29tbWVuZGF0aW9ucyhtb2NrVGVzdERhdGEudmFsaWRSZWNvbW1lbmRlZEV4dGVuc2lvbnMpO1xuXHR9KSk7XG5cblx0dGVzdCgnRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZTogTm8gUHJvbXB0IGZvciB2YWxpZCB3b3Jrc3BhY2UgcmVjb21tZW5kYXRpb25zIGlmIHNob3dSZWNvbW1lbmRhdGlvbnNPbmx5T25EZW1hbmQgaXMgc2V0JywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLnNldFVzZXJDb25maWd1cmF0aW9uKENvbmZpZ3VyYXRpb25LZXksIHsgc2hvd1JlY29tbWVuZGF0aW9uc09ubHlPbkRlbWFuZDogdHJ1ZSB9KTtcblx0XHRyZXR1cm4gc2V0VXBGb2xkZXJXb3Jrc3BhY2UoJ215Rm9sZGVyJywgbW9ja1Rlc3REYXRhLnZhbGlkUmVjb21tZW5kZWRFeHRlbnNpb25zKS50aGVuKCgpID0+IHtcblx0XHRcdHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UpKTtcblx0XHRcdHJldHVybiB0ZXN0T2JqZWN0LmFjdGl2YXRpb25Qcm9taXNlLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQub2soIXByb21wdGVkKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KSk7XG5cblx0dGVzdCgnRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZTogTm8gUHJvbXB0IGZvciB2YWxpZCB3b3Jrc3BhY2UgcmVjb21tZW5kYXRpb25zIGlmIGlnbm9yZVJlY29tbWVuZGF0aW9ucyBpcyBzZXQgZm9yIGN1cnJlbnQgd29ya3NwYWNlJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElTdG9yYWdlU2VydmljZSkuc3RvcmUoJ2V4dGVuc2lvbnNBc3Npc3RhbnQvd29ya3NwYWNlUmVjb21tZW5kYXRpb25zSWdub3JlJywgdHJ1ZSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRyZXR1cm4gdGVzdE5vUHJvbXB0Rm9yVmFsaWRSZWNvbW1lbmRhdGlvbnMobW9ja1Rlc3REYXRhLnZhbGlkUmVjb21tZW5kZWRFeHRlbnNpb25zKTtcblx0fSkpO1xuXG5cdHRlc3QoJ0V4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2U6IE5vIFJlY29tbWVuZGF0aW9ucyBvZiBnbG9iYWxseSBpZ25vcmVkIHJlY29tbWVuZGF0aW9ucycsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJU3RvcmFnZVNlcnZpY2UpLnN0b3JlKCdleHRlbnNpb25zQXNzaXN0YW50L3dvcmtzcGFjZVJlY29tbWVuZGF0aW9uc0lnbm9yZScsIHRydWUsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElTdG9yYWdlU2VydmljZSkuc3RvcmUoJ2V4dGVuc2lvbnNBc3Npc3RhbnQvcmVjb21tZW5kYXRpb25zJywgJ1tcIm1zLWRvdG5ldHRvb2xzLmNzaGFycFwiLCBcIm1zLXB5dGhvbi5weXRob25cIiwgXCJtcy12c2NvZGUudnNjb2RlLXR5cGVzY3JpcHQtdHNsaW50LXBsdWdpblwiXScsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJU3RvcmFnZVNlcnZpY2UpLnN0b3JlKCdleHRlbnNpb25zQXNzaXN0YW50L2lnbm9yZWRfcmVjb21tZW5kYXRpb25zJywgJ1tcIm1zLWRvdG5ldHRvb2xzLmNzaGFycFwiLCBcIm1vY2twdWJsaXNoZXIyLm1vY2tleHRlbnNpb24yXCJdJywgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cblx0XHRyZXR1cm4gc2V0VXBGb2xkZXJXb3Jrc3BhY2UoJ215Rm9sZGVyJywgbW9ja1Rlc3REYXRhLnZhbGlkUmVjb21tZW5kZWRFeHRlbnNpb25zKS50aGVuKCgpID0+IHtcblx0XHRcdHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UpKTtcblx0XHRcdHJldHVybiB0ZXN0T2JqZWN0LmFjdGl2YXRpb25Qcm9taXNlLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRjb25zdCByZWNvbW1lbmRhdGlvbnMgPSB0ZXN0T2JqZWN0LmdldEFsbFJlY29tbWVuZGF0aW9uc1dpdGhSZWFzb24oKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFyZWNvbW1lbmRhdGlvbnNbJ21zLWRvdG5ldHRvb2xzLmNzaGFycCddKTsgLy8gc3RvcmVkIHJlY29tbWVuZGF0aW9uIHRoYXQgaGFzIGJlZW4gZ2xvYmFsbHkgaWdub3JlZFxuXHRcdFx0XHRhc3NlcnQub2socmVjb21tZW5kYXRpb25zWydtcy1weXRob24ucHl0aG9uJ10pOyAvLyBzdG9yZWQgcmVjb21tZW5kYXRpb25cblx0XHRcdFx0YXNzZXJ0Lm9rKHJlY29tbWVuZGF0aW9uc1snbW9ja3B1Ymxpc2hlcjEubW9ja2V4dGVuc2lvbjEnXSk7IC8vIHdvcmtzcGFjZSByZWNvbW1lbmRhdGlvblxuXHRcdFx0XHRhc3NlcnQub2soIXJlY29tbWVuZGF0aW9uc1snbW9ja3B1Ymxpc2hlcjIubW9ja2V4dGVuc2lvbjInXSk7IC8vIHdvcmtzcGFjZSByZWNvbW1lbmRhdGlvbiB0aGF0IGhhcyBiZWVuIGdsb2JhbGx5IGlnbm9yZWRcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KSk7XG5cblx0dGVzdCgnRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZTogTm8gUmVjb21tZW5kYXRpb25zIG9mIHdvcmtzcGFjZSBpZ25vcmVkIHJlY29tbWVuZGF0aW9ucycsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGlnbm9yZWRSZWNvbW1lbmRhdGlvbnMgPSBbJ21zLWRvdG5ldHRvb2xzLmNzaGFycCcsICdtb2NrcHVibGlzaGVyMi5tb2NrZXh0ZW5zaW9uMiddOyAvLyBpZ25vcmUgYSBzdG9yZWQgcmVjb21tZW5kYXRpb24gYW5kIGEgd29ya3NwYWNlIHJlY29tbWVuZGF0aW9uLlxuXHRcdGNvbnN0IHN0b3JlZFJlY29tbWVuZGF0aW9ucyA9ICdbXCJtcy1kb3RuZXR0b29scy5jc2hhcnBcIiwgXCJtcy1weXRob24ucHl0aG9uXCJdJztcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVN0b3JhZ2VTZXJ2aWNlKS5zdG9yZSgnZXh0ZW5zaW9uc0Fzc2lzdGFudC93b3Jrc3BhY2VSZWNvbW1lbmRhdGlvbnNJZ25vcmUnLCB0cnVlLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJU3RvcmFnZVNlcnZpY2UpLnN0b3JlKCdleHRlbnNpb25zQXNzaXN0YW50L3JlY29tbWVuZGF0aW9ucycsIHN0b3JlZFJlY29tbWVuZGF0aW9ucywgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cblx0XHRyZXR1cm4gc2V0VXBGb2xkZXJXb3Jrc3BhY2UoJ215Rm9sZGVyJywgbW9ja1Rlc3REYXRhLnZhbGlkUmVjb21tZW5kZWRFeHRlbnNpb25zLCBpZ25vcmVkUmVjb21tZW5kYXRpb25zKS50aGVuKCgpID0+IHtcblx0XHRcdHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UpKTtcblx0XHRcdHJldHVybiB0ZXN0T2JqZWN0LmFjdGl2YXRpb25Qcm9taXNlLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRjb25zdCByZWNvbW1lbmRhdGlvbnMgPSB0ZXN0T2JqZWN0LmdldEFsbFJlY29tbWVuZGF0aW9uc1dpdGhSZWFzb24oKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFyZWNvbW1lbmRhdGlvbnNbJ21zLWRvdG5ldHRvb2xzLmNzaGFycCddKTsgLy8gc3RvcmVkIHJlY29tbWVuZGF0aW9uIHRoYXQgaGFzIGJlZW4gd29ya3NwYWNlIGlnbm9yZWRcblx0XHRcdFx0YXNzZXJ0Lm9rKHJlY29tbWVuZGF0aW9uc1snbXMtcHl0aG9uLnB5dGhvbiddKTsgLy8gc3RvcmVkIHJlY29tbWVuZGF0aW9uXG5cdFx0XHRcdGFzc2VydC5vayhyZWNvbW1lbmRhdGlvbnNbJ21vY2twdWJsaXNoZXIxLm1vY2tleHRlbnNpb24xJ10pOyAvLyB3b3Jrc3BhY2UgcmVjb21tZW5kYXRpb25cblx0XHRcdFx0YXNzZXJ0Lm9rKCFyZWNvbW1lbmRhdGlvbnNbJ21vY2twdWJsaXNoZXIyLm1vY2tleHRlbnNpb24yJ10pOyAvLyB3b3Jrc3BhY2UgcmVjb21tZW5kYXRpb24gdGhhdCBoYXMgYmVlbiB3b3Jrc3BhY2UgaWdub3JlZFxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pKTtcblxuXHR0ZXN0KCdFeHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlOiBBYmxlIHRvIHJldHJpZXZlIGNvbGxlY3Rpb24gb2YgYWxsIGlnbm9yZWQgcmVjb21tZW5kYXRpb25zJywgYXN5bmMgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cblx0XHRjb25zdCBzdG9yYWdlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJU3RvcmFnZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHdvcmtzcGFjZUlnbm9yZWRSZWNvbW1lbmRhdGlvbnMgPSBbJ21zLWRvdG5ldHRvb2xzLmNzaGFycCddOyAvLyBpZ25vcmUgYSBzdG9yZWQgcmVjb21tZW5kYXRpb24gYW5kIGEgd29ya3NwYWNlIHJlY29tbWVuZGF0aW9uLlxuXHRcdGNvbnN0IHN0b3JlZFJlY29tbWVuZGF0aW9ucyA9ICdbXCJtcy1kb3RuZXR0b29scy5jc2hhcnBcIiwgXCJtcy1weXRob24ucHl0aG9uXCJdJztcblx0XHRjb25zdCBnbG9iYWxseUlnbm9yZWRSZWNvbW1lbmRhdGlvbnMgPSAnW1wibW9ja3B1Ymxpc2hlcjIubW9ja2V4dGVuc2lvbjJcIl0nOyAvLyBpZ25vcmUgYSB3b3Jrc3BhY2UgcmVjb21tZW5kYXRpb24uXG5cdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ2V4dGVuc2lvbnNBc3Npc3RhbnQvd29ya3NwYWNlUmVjb21tZW5kYXRpb25zSWdub3JlJywgdHJ1ZSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZSgnZXh0ZW5zaW9uc0Fzc2lzdGFudC9yZWNvbW1lbmRhdGlvbnMnLCBzdG9yZWRSZWNvbW1lbmRhdGlvbnMsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdHN0b3JhZ2VTZXJ2aWNlLnN0b3JlKCdleHRlbnNpb25zQXNzaXN0YW50L2lnbm9yZWRfcmVjb21tZW5kYXRpb25zJywgZ2xvYmFsbHlJZ25vcmVkUmVjb21tZW5kYXRpb25zLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblxuXHRcdGF3YWl0IHNldFVwRm9sZGVyV29ya3NwYWNlKCdteUZvbGRlcicsIG1vY2tUZXN0RGF0YS52YWxpZFJlY29tbWVuZGVkRXh0ZW5zaW9ucywgd29ya3NwYWNlSWdub3JlZFJlY29tbWVuZGF0aW9ucyk7XG5cdFx0dGVzdE9iamVjdCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZSkpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuYWN0aXZhdGlvblByb21pc2U7XG5cblx0XHRjb25zdCByZWNvbW1lbmRhdGlvbnMgPSB0ZXN0T2JqZWN0LmdldEFsbFJlY29tbWVuZGF0aW9uc1dpdGhSZWFzb24oKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKE9iamVjdC5rZXlzKHJlY29tbWVuZGF0aW9ucyksIFsnbXMtcHl0aG9uLnB5dGhvbicsICdtb2NrcHVibGlzaGVyMS5tb2NrZXh0ZW5zaW9uMSddKTtcblx0fSkpO1xuXG5cdHRlc3QoJ0V4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2U6IEFibGUgdG8gZHluYW1pY2FsbHkgaWdub3JlL3VuaWdub3JlIGdsb2JhbCByZWNvbW1lbmRhdGlvbnMnLCBhc3luYyAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzdG9yYWdlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJU3RvcmFnZVNlcnZpY2UpO1xuXG5cdFx0Y29uc3Qgc3RvcmVkUmVjb21tZW5kYXRpb25zID0gJ1tcIm1zLWRvdG5ldHRvb2xzLmNzaGFycFwiLCBcIm1zLXB5dGhvbi5weXRob25cIl0nO1xuXHRcdGNvbnN0IGdsb2JhbGx5SWdub3JlZFJlY29tbWVuZGF0aW9ucyA9ICdbXCJtb2NrcHVibGlzaGVyMi5tb2NrZXh0ZW5zaW9uMlwiXSc7IC8vIGlnbm9yZSBhIHdvcmtzcGFjZSByZWNvbW1lbmRhdGlvbi5cblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZSgnZXh0ZW5zaW9uc0Fzc2lzdGFudC93b3Jrc3BhY2VSZWNvbW1lbmRhdGlvbnNJZ25vcmUnLCB0cnVlLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdHN0b3JhZ2VTZXJ2aWNlLnN0b3JlKCdleHRlbnNpb25zQXNzaXN0YW50L3JlY29tbWVuZGF0aW9ucycsIHN0b3JlZFJlY29tbWVuZGF0aW9ucywgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ2V4dGVuc2lvbnNBc3Npc3RhbnQvaWdub3JlZF9yZWNvbW1lbmRhdGlvbnMnLCBnbG9iYWxseUlnbm9yZWRSZWNvbW1lbmRhdGlvbnMsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXG5cdFx0YXdhaXQgc2V0VXBGb2xkZXJXb3Jrc3BhY2UoJ215Rm9sZGVyJywgbW9ja1Rlc3REYXRhLnZhbGlkUmVjb21tZW5kZWRFeHRlbnNpb25zKTtcblx0XHRjb25zdCBleHRlbnNpb25JZ25vcmVkUmVjb21tZW5kYXRpb25zU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRXh0ZW5zaW9uSWdub3JlZFJlY29tbWVuZGF0aW9uc1NlcnZpY2UpO1xuXHRcdHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UpKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFjdGl2YXRpb25Qcm9taXNlO1xuXG5cdFx0bGV0IHJlY29tbWVuZGF0aW9ucyA9IHRlc3RPYmplY3QuZ2V0QWxsUmVjb21tZW5kYXRpb25zV2l0aFJlYXNvbigpO1xuXHRcdGFzc2VydC5vayhyZWNvbW1lbmRhdGlvbnNbJ21zLXB5dGhvbi5weXRob24nXSk7XG5cdFx0YXNzZXJ0Lm9rKHJlY29tbWVuZGF0aW9uc1snbW9ja3B1Ymxpc2hlcjEubW9ja2V4dGVuc2lvbjEnXSk7XG5cdFx0YXNzZXJ0Lm9rKCFyZWNvbW1lbmRhdGlvbnNbJ21vY2twdWJsaXNoZXIyLm1vY2tleHRlbnNpb24yJ10pO1xuXG5cdFx0ZXh0ZW5zaW9uSWdub3JlZFJlY29tbWVuZGF0aW9uc1NlcnZpY2UudG9nZ2xlR2xvYmFsSWdub3JlZFJlY29tbWVuZGF0aW9uKCdtb2NrcHVibGlzaGVyMS5tb2NrZXh0ZW5zaW9uMScsIHRydWUpO1xuXG5cdFx0cmVjb21tZW5kYXRpb25zID0gdGVzdE9iamVjdC5nZXRBbGxSZWNvbW1lbmRhdGlvbnNXaXRoUmVhc29uKCk7XG5cdFx0YXNzZXJ0Lm9rKHJlY29tbWVuZGF0aW9uc1snbXMtcHl0aG9uLnB5dGhvbiddKTtcblx0XHRhc3NlcnQub2soIXJlY29tbWVuZGF0aW9uc1snbW9ja3B1Ymxpc2hlcjEubW9ja2V4dGVuc2lvbjEnXSk7XG5cdFx0YXNzZXJ0Lm9rKCFyZWNvbW1lbmRhdGlvbnNbJ21vY2twdWJsaXNoZXIyLm1vY2tleHRlbnNpb24yJ10pO1xuXG5cdFx0ZXh0ZW5zaW9uSWdub3JlZFJlY29tbWVuZGF0aW9uc1NlcnZpY2UudG9nZ2xlR2xvYmFsSWdub3JlZFJlY29tbWVuZGF0aW9uKCdtb2NrcHVibGlzaGVyMS5tb2NrZXh0ZW5zaW9uMScsIGZhbHNlKTtcblxuXHRcdHJlY29tbWVuZGF0aW9ucyA9IHRlc3RPYmplY3QuZ2V0QWxsUmVjb21tZW5kYXRpb25zV2l0aFJlYXNvbigpO1xuXHRcdGFzc2VydC5vayhyZWNvbW1lbmRhdGlvbnNbJ21zLXB5dGhvbi5weXRob24nXSk7XG5cdFx0YXNzZXJ0Lm9rKHJlY29tbWVuZGF0aW9uc1snbW9ja3B1Ymxpc2hlcjEubW9ja2V4dGVuc2lvbjEnXSk7XG5cdFx0YXNzZXJ0Lm9rKCFyZWNvbW1lbmRhdGlvbnNbJ21vY2twdWJsaXNoZXIyLm1vY2tleHRlbnNpb24yJ10pO1xuXHR9KSk7XG5cblx0dGVzdCgndGVzdCBnbG9iYWwgZXh0ZW5zaW9ucyBhcmUgbW9kaWZpZWQgYW5kIHJlY29tbWVuZGF0aW9uIGNoYW5nZSBldmVudCBpcyBmaXJlZCB3aGVuIGFuIGV4dGVuc2lvbiBpcyBpZ25vcmVkJywgYXN5bmMgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc3RvcmFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRjb25zdCBjaGFuZ2VIYW5kbGVyVGFyZ2V0ID0gc2lub24uc3B5KCk7XG5cdFx0Y29uc3QgaWdub3JlZEV4dGVuc2lvbklkID0gJ1NvbWUuRXh0ZW5zaW9uJztcblxuXHRcdHN0b3JhZ2VTZXJ2aWNlLnN0b3JlKCdleHRlbnNpb25zQXNzaXN0YW50L3dvcmtzcGFjZVJlY29tbWVuZGF0aW9uc0lnbm9yZScsIHRydWUsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ2V4dGVuc2lvbnNBc3Npc3RhbnQvaWdub3JlZF9yZWNvbW1lbmRhdGlvbnMnLCAnW1wibXMtdnNjb2RlLnZzY29kZVwiXScsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXG5cdFx0YXdhaXQgc2V0VXBGb2xkZXJXb3Jrc3BhY2UoJ215Rm9sZGVyJywgW10pO1xuXHRcdHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UpKTtcblx0XHRjb25zdCBleHRlbnNpb25JZ25vcmVkUmVjb21tZW5kYXRpb25zU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRXh0ZW5zaW9uSWdub3JlZFJlY29tbWVuZGF0aW9uc1NlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQoZXh0ZW5zaW9uSWdub3JlZFJlY29tbWVuZGF0aW9uc1NlcnZpY2Uub25EaWRDaGFuZ2VHbG9iYWxJZ25vcmVkUmVjb21tZW5kYXRpb24oY2hhbmdlSGFuZGxlclRhcmdldCkpO1xuXHRcdGV4dGVuc2lvbklnbm9yZWRSZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLnRvZ2dsZUdsb2JhbElnbm9yZWRSZWNvbW1lbmRhdGlvbihpZ25vcmVkRXh0ZW5zaW9uSWQsIHRydWUpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuYWN0aXZhdGlvblByb21pc2U7XG5cblx0XHRhc3NlcnQub2soY2hhbmdlSGFuZGxlclRhcmdldC5jYWxsZWRPbmNlKTtcblx0XHRhc3NlcnQub2soY2hhbmdlSGFuZGxlclRhcmdldC5nZXRDYWxsKDApLmNhbGxlZFdpdGhNYXRjaCh7IGV4dGVuc2lvbklkOiBpZ25vcmVkRXh0ZW5zaW9uSWQudG9Mb3dlckNhc2UoKSwgaXNSZWNvbW1lbmRlZDogZmFsc2UgfSkpO1xuXHR9KSk7XG5cblx0dGVzdCgnRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZTogR2V0IGZpbGUgYmFzZWQgcmVjb21tZW5kYXRpb25zIGZyb20gc3RvcmFnZSAob2xkIGZvcm1hdCknLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzdG9yZWRSZWNvbW1lbmRhdGlvbnMgPSAnW1wibXMtZG90bmV0dG9vbHMuY3NoYXJwXCIsIFwibXMtcHl0aG9uLnB5dGhvblwiLCBcIm1zLXZzY29kZS52c2NvZGUtdHlwZXNjcmlwdC10c2xpbnQtcGx1Z2luXCJdJztcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVN0b3JhZ2VTZXJ2aWNlKS5zdG9yZSgnZXh0ZW5zaW9uc0Fzc2lzdGFudC9yZWNvbW1lbmRhdGlvbnMnLCBzdG9yZWRSZWNvbW1lbmRhdGlvbnMsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXG5cdFx0cmV0dXJuIHNldFVwRm9sZGVyV29ya3NwYWNlKCdteUZvbGRlcicsIFtdKS50aGVuKCgpID0+IHtcblx0XHRcdHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UpKTtcblx0XHRcdHJldHVybiB0ZXN0T2JqZWN0LmFjdGl2YXRpb25Qcm9taXNlLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRjb25zdCByZWNvbW1lbmRhdGlvbnMgPSB0ZXN0T2JqZWN0LmdldEZpbGVCYXNlZFJlY29tbWVuZGF0aW9ucygpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVjb21tZW5kYXRpb25zLmxlbmd0aCwgMik7XG5cdFx0XHRcdGFzc2VydC5vayhyZWNvbW1lbmRhdGlvbnMuc29tZShleHRlbnNpb25JZCA9PiBleHRlbnNpb25JZCA9PT0gJ21zLWRvdG5ldHRvb2xzLmNzaGFycCcpKTsgLy8gc3RvcmVkIHJlY29tbWVuZGF0aW9uIHRoYXQgZXhpc3RzIGluIHByb2R1Y3QuZXh0ZW5zaW9uVGlwc1xuXHRcdFx0XHRhc3NlcnQub2socmVjb21tZW5kYXRpb25zLnNvbWUoZXh0ZW5zaW9uSWQgPT4gZXh0ZW5zaW9uSWQgPT09ICdtcy1weXRob24ucHl0aG9uJykpOyAvLyBzdG9yZWQgcmVjb21tZW5kYXRpb24gdGhhdCBleGlzdHMgaW4gcHJvZHVjdC5leHRlbnNpb25JbXBvcnRhbnRUaXBzXG5cdFx0XHRcdGFzc2VydC5vayhyZWNvbW1lbmRhdGlvbnMuZXZlcnkoZXh0ZW5zaW9uSWQgPT4gZXh0ZW5zaW9uSWQgIT09ICdtcy12c2NvZGUudnNjb2RlLXR5cGVzY3JpcHQtdHNsaW50LXBsdWdpbicpKTsgLy8gc3RvcmVkIHJlY29tbWVuZGF0aW9uIHRoYXQgaXMgbm8gbG9uZ2VyIGluIG5laXRoZXIgcHJvZHVjdC5leHRlbnNpb25UaXBzIG5vciBwcm9kdWN0LmV4dGVuc2lvbkltcG9ydGFudFRpcHNcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KSk7XG5cblx0dGVzdCgnRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZTogR2V0IGZpbGUgYmFzZWQgcmVjb21tZW5kYXRpb25zIGZyb20gc3RvcmFnZSAobmV3IGZvcm1hdCknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbWlsbGlTZWNvbmRzSW5BRGF5ID0gMTAwMCAqIDYwICogNjAgKiAyNDtcblx0XHRjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXHRcdGNvbnN0IHRlbkRheXNPbGQgPSAxMCAqIG1pbGxpU2Vjb25kc0luQURheTtcblx0XHRjb25zdCBzdG9yZWRSZWNvbW1lbmRhdGlvbnMgPSBge1wibXMtZG90bmV0dG9vbHMuY3NoYXJwXCI6ICR7bm93fSwgXCJtcy1weXRob24ucHl0aG9uXCI6ICR7bm93fSwgXCJtcy12c2NvZGUudnNjb2RlLXR5cGVzY3JpcHQtdHNsaW50LXBsdWdpblwiOiAke25vd30sIFwibHVrZWhvYmFuLkdvXCI6ICR7dGVuRGF5c09sZH19YDtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVN0b3JhZ2VTZXJ2aWNlKS5zdG9yZSgnZXh0ZW5zaW9uc0Fzc2lzdGFudC9yZWNvbW1lbmRhdGlvbnMnLCBzdG9yZWRSZWNvbW1lbmRhdGlvbnMsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXG5cdFx0YXdhaXQgc2V0VXBGb2xkZXJXb3Jrc3BhY2UoJ215Rm9sZGVyJywgW10pO1xuXHRcdHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UpKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFjdGl2YXRpb25Qcm9taXNlO1xuXG5cdFx0Y29uc3QgcmVjb21tZW5kYXRpb25zID0gdGVzdE9iamVjdC5nZXRGaWxlQmFzZWRSZWNvbW1lbmRhdGlvbnMoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVjb21tZW5kYXRpb25zLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0Lm9rKHJlY29tbWVuZGF0aW9ucy5zb21lKGV4dGVuc2lvbklkID0+IGV4dGVuc2lvbklkID09PSAnbXMtZG90bmV0dG9vbHMuY3NoYXJwJykpOyAvLyBzdG9yZWQgcmVjb21tZW5kYXRpb24gdGhhdCBleGlzdHMgaW4gcHJvZHVjdC5leHRlbnNpb25UaXBzXG5cdFx0YXNzZXJ0Lm9rKHJlY29tbWVuZGF0aW9ucy5zb21lKGV4dGVuc2lvbklkID0+IGV4dGVuc2lvbklkID09PSAnbXMtcHl0aG9uLnB5dGhvbicpKTsgLy8gc3RvcmVkIHJlY29tbWVuZGF0aW9uIHRoYXQgZXhpc3RzIGluIHByb2R1Y3QuZXh0ZW5zaW9uSW1wb3J0YW50VGlwc1xuXHRcdGFzc2VydC5vayhyZWNvbW1lbmRhdGlvbnMuZXZlcnkoZXh0ZW5zaW9uSWQgPT4gZXh0ZW5zaW9uSWQgIT09ICdtcy12c2NvZGUudnNjb2RlLXR5cGVzY3JpcHQtdHNsaW50LXBsdWdpbicpKTsgLy8gc3RvcmVkIHJlY29tbWVuZGF0aW9uIHRoYXQgaXMgbm8gbG9uZ2VyIGluIG5laXRoZXIgcHJvZHVjdC5leHRlbnNpb25UaXBzIG5vciBwcm9kdWN0LmV4dGVuc2lvbkltcG9ydGFudFRpcHNcblx0XHRhc3NlcnQub2socmVjb21tZW5kYXRpb25zLmV2ZXJ5KGV4dGVuc2lvbklkID0+IGV4dGVuc2lvbklkICE9PSAnbHVrZWhvYmFuLkdvJykpOyAvL3N0b3JlZCByZWNvbW1lbmRhdGlvbiB0aGF0IGlzIG9sZGVyIHRoYW4gYSB3ZWVrXG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFdBQVc7QUFDdkIsT0FBTyxZQUFZO0FBQ25CLFlBQVksVUFBVTtBQUN0QjtBQUFBLEVBQ0M7QUFBQSxFQUFzRTtBQUFBLEVBQTZCO0FBQUEsRUFBdUI7QUFBQSxPQUNwSDtBQUNQLFNBQVMsc0NBQXNDLDRDQUE0QztBQUMzRixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLG9CQUFvQixvQkFBb0IsMEJBQTBCO0FBQzNFLFNBQVMsMEJBQTBCLGdDQUFnQztBQUNuRSxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLFdBQVc7QUFDcEIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQ0FBZ0M7QUFFekMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxrQkFBa0IsbUNBQW1DO0FBQzlELFNBQVMsc0NBQXNDO0FBQy9DLFNBQVMsbUJBQW1CO0FBRTVCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNEJBQXFFO0FBQzlFLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsZ0JBQWdCLG1CQUFtQjtBQUM1QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLG1DQUFtQyx3Q0FBd0M7QUFDcEYsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyw4Q0FBOEM7QUFDdkQsU0FBUyxtREFBbUQ7QUFDNUQsU0FBUyxrREFBa0Q7QUFDM0QsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGdCQUFnQixhQUFhO0FBQ3RDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsMEJBQTBCO0FBRW5DLE1BQU0sT0FBTyxJQUFJLEtBQUssT0FBTyxFQUFFLEtBQUssRUFBRSxRQUFRLGVBQWUsQ0FBQztBQUU5RCxNQUFNLHVCQUE0QztBQUFBLEVBQ2pELGtCQUFrQixrQkFBa0I7QUFBQSxJQUNuQyxhQUFhO0FBQUEsSUFDYixTQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsSUFDYixXQUFXO0FBQUEsSUFDWCxzQkFBc0I7QUFBQSxJQUN0QixhQUFhO0FBQUEsSUFDYixjQUFjO0FBQUEsSUFDZCxRQUFRO0FBQUEsSUFDUixhQUFhO0FBQUEsRUFDZCxHQUFHO0FBQUEsSUFDRixjQUFjLENBQUMsT0FBTztBQUFBLEVBQ3ZCLEdBQUc7QUFBQSxJQUNGLFVBQVUsRUFBRSxLQUFLLGdCQUFnQixhQUFhLG9CQUFvQjtBQUFBLElBQ2xFLFFBQVEsRUFBRSxLQUFLLGNBQWMsYUFBYSxrQkFBa0I7QUFBQSxJQUM1RCxXQUFXLEVBQUUsS0FBSyxpQkFBaUIsYUFBYSxvQkFBb0I7QUFBQSxJQUNwRSxVQUFVLEVBQUUsS0FBSyxnQkFBZ0IsYUFBYSxvQkFBb0I7QUFBQSxJQUNsRSxNQUFNLEVBQUUsS0FBSyxZQUFZLGFBQWEsZ0JBQWdCO0FBQUEsSUFDdEQsU0FBUyxFQUFFLEtBQUssZUFBZSxhQUFhLG1CQUFtQjtBQUFBLElBQy9ELFlBQVksRUFBRSxLQUFLLGtCQUFrQixhQUFhLHNCQUFzQjtBQUFBLElBQ3hFLFdBQVcsRUFBRSxLQUFLLGlCQUFpQixhQUFhLHFCQUFxQjtBQUFBLElBQ3JFLGtCQUFrQixDQUFDO0FBQUEsRUFDcEIsQ0FBQztBQUFBLEVBQ0Qsa0JBQWtCLGtCQUFrQjtBQUFBLElBQ25DLGFBQWE7QUFBQSxJQUNiLFNBQVM7QUFBQSxJQUNULGFBQWE7QUFBQSxJQUNiLFdBQVc7QUFBQSxJQUNYLHNCQUFzQjtBQUFBLElBQ3RCLGFBQWE7QUFBQSxJQUNiLGNBQWM7QUFBQSxJQUNkLFFBQVE7QUFBQSxJQUNSLGFBQWE7QUFBQSxFQUNkLEdBQUc7QUFBQSxJQUNGLGNBQWMsQ0FBQyxTQUFTLE9BQU87QUFBQSxFQUNoQyxHQUFHO0FBQUEsSUFDRixVQUFVLEVBQUUsS0FBSyxnQkFBZ0IsYUFBYSxvQkFBb0I7QUFBQSxJQUNsRSxRQUFRLEVBQUUsS0FBSyxjQUFjLGFBQWEsa0JBQWtCO0FBQUEsSUFDNUQsV0FBVyxFQUFFLEtBQUssaUJBQWlCLGFBQWEsb0JBQW9CO0FBQUEsSUFDcEUsVUFBVSxFQUFFLEtBQUssZ0JBQWdCLGFBQWEsb0JBQW9CO0FBQUEsSUFDbEUsTUFBTSxFQUFFLEtBQUssWUFBWSxhQUFhLGdCQUFnQjtBQUFBLElBQ3RELFNBQVMsRUFBRSxLQUFLLGVBQWUsYUFBYSxtQkFBbUI7QUFBQSxJQUMvRCxZQUFZLEVBQUUsS0FBSyxrQkFBa0IsYUFBYSxzQkFBc0I7QUFBQSxJQUN4RSxXQUFXLEVBQUUsS0FBSyxpQkFBaUIsYUFBYSxxQkFBcUI7QUFBQSxJQUNyRSxrQkFBa0IsQ0FBQztBQUFBLEVBQ3BCLENBQUM7QUFDRjtBQUVBLE1BQU0scUJBQXFCO0FBQUEsRUFDMUI7QUFBQSxJQUNDLE1BQU0sY0FBYztBQUFBLElBQ3BCLFlBQVkscUJBQXFCLENBQUMsRUFBRTtBQUFBLElBQ3BDLFVBQVU7QUFBQSxNQUNULE1BQU0scUJBQXFCLENBQUMsRUFBRTtBQUFBLE1BQzlCLFdBQVcscUJBQXFCLENBQUMsRUFBRTtBQUFBLE1BQ25DLFNBQVMscUJBQXFCLENBQUMsRUFBRTtBQUFBLElBQ2xDO0FBQUEsSUFDQSxVQUFVO0FBQUEsSUFDVixNQUFNO0FBQUEsSUFDTixXQUFXO0FBQUEsSUFDWCxjQUFjO0FBQUEsRUFDZjtBQUFBLEVBQ0E7QUFBQSxJQUNDLE1BQU0sY0FBYztBQUFBLElBQ3BCLFlBQVkscUJBQXFCLENBQUMsRUFBRTtBQUFBLElBQ3BDLFVBQVU7QUFBQSxNQUNULE1BQU0scUJBQXFCLENBQUMsRUFBRTtBQUFBLE1BQzlCLFdBQVcscUJBQXFCLENBQUMsRUFBRTtBQUFBLE1BQ25DLFNBQVMscUJBQXFCLENBQUMsRUFBRTtBQUFBLElBQ2xDO0FBQUEsSUFDQSxVQUFVO0FBQUEsSUFDVixNQUFNO0FBQUEsSUFDTixXQUFXO0FBQUEsSUFDWCxjQUFjO0FBQUEsRUFDZjtBQUNEO0FBRUEsTUFBTSxlQUFlO0FBQUEsRUFDcEIsdUJBQXVCO0FBQUEsSUFDdEI7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDRDtBQUFBLEVBQ0EsNEJBQTRCO0FBQUEsSUFDM0I7QUFBQSxJQUNBO0FBQUEsRUFDRDtBQUNEO0FBRUEsU0FBUyxTQUFZLFNBQXlCO0FBQzdDLFNBQU8sRUFBRSxXQUFXLFNBQVMsT0FBTyxRQUFRLFFBQVEsVUFBVSxRQUFRLFFBQVEsU0FBUyxNQUFNLEtBQU07QUFDcEc7QUFFQSxNQUFNLFdBQW9DO0FBQUEsRUFDekMsV0FBVztBQUFBLEVBQ1gsVUFBVTtBQUFBLEVBQ1YsTUFBTTtBQUFBLEVBQ04sU0FBUztBQUFBLEVBQ1QsVUFBVTtBQUFBLEVBQ1YsUUFBUTtBQUFBLEVBQ1IsWUFBWTtBQUFBLEVBQ1osV0FBVztBQUFBLEVBQ1gsa0JBQWtCLENBQUM7QUFDcEI7QUFFQSxTQUFTLGtCQUFrQixNQUFjLGFBQWtCLENBQUMsR0FBRyw2QkFBa0MsQ0FBQyxHQUFHLFNBQWtDLFVBQTZCO0FBQ25LLFFBQU0saUJBQWlCLGtCQUFrQixVQUFVLElBQUk7QUFDdkQsUUFBTSxtQkFBc0MsdUJBQU8sT0FBTyxFQUFFLE1BQU0sV0FBVyxPQUFPLFNBQVMsU0FBUyxvQkFBb0IsQ0FBQyxjQUFjLEdBQUcsWUFBWSxDQUFDLEdBQUcsUUFBUSxDQUFDLEdBQUcsR0FBRyxXQUFXLENBQUM7QUFDdkwsbUJBQWlCLGFBQWEsRUFBRSxHQUFHLGlCQUFpQixZQUFZLGNBQWMsQ0FBQyxHQUFHLGdCQUFnQixHQUFHLDJCQUEyQjtBQUNoSSxtQkFBaUIsU0FBUyxFQUFFLEdBQUcsaUJBQWlCLFFBQVEsR0FBRyxPQUFPO0FBQ2xFLG1CQUFpQixhQUFhLEVBQUUsSUFBSSxzQkFBc0IsaUJBQWlCLFdBQVcsaUJBQWlCLElBQUksR0FBRyxNQUFNLEtBQUssYUFBYSxFQUFFO0FBQ3hJLFNBQTBCO0FBQzNCO0FBRUEsTUFBTSx3Q0FBd0MsTUFBTTtBQUNuRCxNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUVKLFdBQVMsWUFBWTtBQUNwQixvQkFBZ0IsUUFBUTtBQUN4QixVQUFNLFFBQVEsQ0FBQztBQUFBLEVBQ2hCLENBQUM7QUFFRCwwQ0FBd0M7QUFFeEMsUUFBTSxNQUFNO0FBQ1gsc0JBQWtCLElBQUksZ0JBQWdCO0FBQ3RDLDJCQUF1QixnQkFBZ0IsSUFBSSxJQUFJLHlCQUF5QixDQUFDO0FBQ3pFLHNCQUFrQixnQkFBZ0IsSUFBSSxJQUFJLFFBQWMsQ0FBQztBQUN6RCx5QkFBcUIsS0FBSywwQkFBMEIsdUJBQXVCO0FBQzNFLHlCQUFxQixLQUFLLHVCQUF1Qix3QkFBd0I7QUFDekUseUJBQXFCLEtBQUssbUJBQW1CLGdCQUFnQixJQUFJLElBQUkscUJBQXFCLENBQUMsQ0FBQztBQUM1RiwrQkFBMkIsSUFBSSx5QkFBeUI7QUFDeEQseUJBQXFCLEtBQUssdUJBQXVCLHdCQUF3QjtBQUN6RSx5QkFBcUIsS0FBSyxpQkFBaUIsa0JBQWtCO0FBQzdELHlCQUFxQixLQUFLLGFBQWEsY0FBYztBQUNyRCxVQUFNLGNBQWMsSUFBSSxZQUFZLHFCQUFxQixJQUFJLFdBQVcsQ0FBQztBQUN6RSx5QkFBcUIsS0FBSyxjQUFjLGdCQUFnQixJQUFJLFdBQVcsQ0FBQztBQUN4RSxVQUFNLHFCQUFxQixnQkFBZ0IsSUFBSSxJQUFJLDJCQUEyQixDQUFDO0FBQy9FLG9CQUFnQixJQUFJLFlBQVksaUJBQWlCLEtBQUssUUFBUSxrQkFBa0IsQ0FBQztBQUNqRix5QkFBcUIsS0FBSyxxQkFBcUIsZ0JBQWdCLElBQUksSUFBSSxtQkFBbUIscUJBQXFCLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQztBQUNsSSx5QkFBcUIsS0FBSyxzQkFBc0IsSUFBSSx3QkFBd0IsQ0FBQztBQUM3RSx5QkFBcUIsS0FBSyxvQkFBb0IsSUFBSSxzQkFBc0IsQ0FBQztBQUN6RSx5QkFBcUIsS0FBSyxzQ0FBc0M7QUFBQSxNQUMvRCxvQkFBb0IsTUFBTTtBQUFBLE1BQzFCLHdCQUF3QixNQUFNO0FBQUEsTUFDOUIsc0JBQXNCLE1BQU07QUFBQSxNQUM1Qix5QkFBeUIsTUFBTTtBQUFBLE1BQy9CLDhCQUE4QixNQUFNO0FBQUEsTUFDcEMsb0JBQW9CLE1BQU07QUFBQSxNQUMxQixvQ0FBb0MsTUFBTTtBQUFBLE1BQzFDLE1BQU0sZUFBZTtBQUFFLGVBQU8sQ0FBQztBQUFBLE1BQUc7QUFBQSxNQUNsQyxNQUFNLGFBQWE7QUFBRSxlQUFPO0FBQUEsTUFBTTtBQUFBLE1BQ2xDLE1BQU0sK0JBQStCO0FBQUUsZUFBTyxFQUFFLFdBQVcsQ0FBQyxHQUFHLFlBQVksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxHQUFHLGtCQUFrQixDQUFDLEVBQUU7QUFBQSxNQUFHO0FBQUEsTUFDbkgsTUFBTSxvQkFBb0I7QUFBRSxlQUFPLGtCQUFrQixVQUFVLElBQUk7QUFBQSxNQUFHO0FBQUEsSUFDdkUsQ0FBQztBQUNELHlCQUFxQixLQUFLLG1CQUFtQjtBQUFBLE1BQzVDLHVCQUF1QixNQUFNO0FBQUEsTUFDN0IsWUFBWSxDQUFDO0FBQUEsTUFDYixNQUFNLG9DQUFvQztBQUFFLGVBQU87QUFBQSxNQUFNO0FBQUEsSUFDMUQsQ0FBQztBQUNELHlCQUFxQixLQUFLLHNDQUFzQyxnQkFBZ0IsSUFBSSxJQUFJLCtCQUErQixvQkFBb0IsQ0FBQyxDQUFDO0FBQzdJLHlCQUFxQixLQUFLLG1CQUFtQixvQkFBb0I7QUFDakUseUJBQXFCLEtBQUssYUFBYSxnQkFBZ0I7QUFDdkQseUJBQXFCLEtBQUssdUJBQXVCLElBQUkseUJBQXlCLENBQUM7QUFDL0UseUJBQXFCLEtBQUssaUJBQWlCLGdCQUFnQixJQUFJLElBQUksbUJBQW1CLENBQUMsQ0FBQztBQUN4Rix5QkFBcUIsS0FBSyxhQUFhLElBQUksZUFBZSxDQUFDO0FBQzNELHlCQUFxQixLQUFLLGlCQUFpQjtBQUFBLE1BQzFDLDBCQUEwQjtBQUFBLFFBQ3pCLG9CQUFvQjtBQUFBLFVBQ25CLFlBQVk7QUFBQSxZQUNYO0FBQUEsY0FDQyxZQUFZO0FBQUEsY0FDWixXQUFXO0FBQUEsWUFDWjtBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBQUEsUUFDQSx3QkFBd0I7QUFBQSxVQUN2QixZQUFZO0FBQUEsWUFDWDtBQUFBLGNBQ0MsWUFBWTtBQUFBLGNBQ1osV0FBVztBQUFBLFlBQ1o7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLFFBQ0EseUJBQXlCO0FBQUEsVUFDeEIsWUFBWTtBQUFBLFlBQ1g7QUFBQSxjQUNDLFlBQVk7QUFBQSxZQUNiO0FBQUEsVUFDRDtBQUFBLFFBQ0Q7QUFBQSxRQUNBLGdDQUFnQztBQUFBLFVBQy9CLFlBQVk7QUFBQSxZQUNYO0FBQUEsY0FDQyxZQUFZO0FBQUEsWUFDYjtBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBQUEsUUFDQSxnQkFBZ0I7QUFBQSxVQUNmLFlBQVk7QUFBQSxZQUNYO0FBQUEsY0FDQyxZQUFZO0FBQUEsWUFDYjtBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUVELHlCQUFxQixLQUFLLGdCQUFnQixFQUFFLGVBQWUsTUFBTSxNQUFNLE9BQU8sTUFBTSxjQUFjLENBQUM7QUFDbkcseUJBQXFCLElBQUksNkJBQTZCLGdCQUFnQixJQUFJLHFCQUFxQixlQUFlLDBCQUEwQixDQUFDLENBQUM7QUFDMUkseUJBQXFCLEtBQUssdUJBQXVCLGdCQUFnQixJQUFJLHFCQUFxQixlQUFlLHdCQUF3QixDQUFDLENBQUM7QUFFbkksd0JBQW9CLElBQUksUUFBb0I7QUFFNUMseUJBQXFCLEtBQUsscUJBQXFCLENBQUMsQ0FBQztBQUNqRCx5QkFBcUIsWUFBWSw2QkFBNkIsZ0JBQWdCLENBQUMsQ0FBQztBQUNoRix5QkFBcUIsS0FBSywwQkFBMEIsYUFBYSxJQUFJO0FBQ3JFLHlCQUFxQixZQUFZLDBCQUEwQixTQUFTLE1BQXlCLEdBQUcsb0JBQW9CLENBQUM7QUFDckgseUJBQXFCLFlBQVksMEJBQTBCLGlCQUFpQixvQkFBb0I7QUFFaEcsZUFBVztBQUFBLElBRVgsTUFBTSxpQ0FBaUMsd0JBQXdCO0FBQUEsTUFDOUMsT0FBTyxVQUFvQixTQUFpQixTQUEwQixTQUEwQjtBQUMvRyxtQkFBVztBQUNYLHdCQUFnQixLQUFLO0FBQ3JCLGVBQU8sTUFBTSxPQUFPLFVBQVUsU0FBUyxTQUFTLE9BQU87QUFBQSxNQUN4RDtBQUFBLElBQ0Q7QUFFQSx5QkFBcUIsS0FBSyxzQkFBc0IsSUFBSSx5QkFBeUIsQ0FBQztBQUU5RSw2QkFBeUIscUJBQXFCLGtCQUFrQixFQUFFLHVCQUF1QixNQUFNLENBQUM7QUFDaEcseUJBQXFCLEtBQUssZUFBOEI7QUFBQSxNQUN2RCxZQUFpQjtBQUFFLGVBQU8sQ0FBQztBQUFBLE1BQUc7QUFBQSxNQUM5QixjQUFjLGtCQUFrQjtBQUFBLElBQ2pDLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxXQUFTLHFCQUFxQixZQUFvQix1QkFBaUMseUJBQW1DLENBQUMsR0FBa0I7QUFDeEksV0FBTyxZQUFZLFlBQVksdUJBQXVCLHNCQUFzQjtBQUFBLEVBQzdFO0FBRUEsaUJBQWUsWUFBWSxZQUFvQix1QkFBaUMseUJBQW1DLENBQUMsR0FBa0I7QUFDckksVUFBTSxjQUFjLHFCQUFxQixJQUFJLFlBQVk7QUFDekQsVUFBTSxZQUFZLFNBQVMsTUFBTSxVQUFVO0FBQzNDLFVBQU0sdUJBQXVCLFNBQVMsV0FBVyxTQUFTO0FBQzFELFVBQU0sWUFBWSxhQUFhLG9CQUFvQjtBQUNuRCxVQUFNLGFBQWEsU0FBUyxzQkFBc0IsaUJBQWlCO0FBQ25FLFVBQU0sWUFBWSxVQUFVLFlBQVksU0FBUyxXQUFXLEtBQUssVUFBVTtBQUFBLE1BQzFFLG1CQUFtQjtBQUFBLE1BQ25CLDJCQUEyQjtBQUFBLElBQzVCLEdBQUcsTUFBTSxHQUFJLENBQUMsQ0FBQztBQUVmLFVBQU0sY0FBYyxjQUFjLFNBQVM7QUFFM0MseUJBQXFCLEtBQUssY0FBYyxXQUFXO0FBQ25ELHVCQUFtQixJQUFJLG1CQUFtQixXQUFXO0FBQ3JELHlCQUFxQixLQUFLLDBCQUEwQixnQkFBZ0I7QUFDcEUseUJBQXFCLEtBQUssbUNBQW1DLGdCQUFnQixJQUFJLHFCQUFxQixlQUFlLGdDQUFnQyxDQUFDLENBQUM7QUFDdkoseUJBQXFCLEtBQUsseUNBQXlDLGdCQUFnQixJQUFJLHFCQUFxQixlQUFlLHNDQUFzQyxDQUFDLENBQUM7QUFDbksseUJBQXFCLEtBQUssNkNBQTZDLGdCQUFnQixJQUFJLHFCQUFxQixlQUFlLDBDQUEwQyxDQUFDLENBQUM7QUFBQSxFQUM1SztBQUVBLFdBQVMsb0NBQW9DLGlCQUEyQjtBQUN2RSxXQUFPLHFCQUFxQixZQUFZLGVBQWUsRUFBRSxLQUFLLE1BQU07QUFDbkUsbUJBQWEsZ0JBQWdCLElBQUkscUJBQXFCLGVBQWUsK0JBQStCLENBQUM7QUFDckcsYUFBTyxXQUFXLGtCQUFrQixLQUFLLE1BQU07QUFDOUMsZUFBTyxZQUFZLE9BQU8sS0FBSyxXQUFXLGdDQUFnQyxDQUFDLEVBQUUsUUFBUSxnQkFBZ0IsTUFBTTtBQUMzRyxlQUFPLEdBQUcsQ0FBQyxRQUFRO0FBQUEsTUFDcEIsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0Y7QUFFQSxXQUFTLHFEQUFxRCxpQkFBMkI7QUFDeEYsV0FBTyxxQkFBcUIsWUFBWSxhQUFhLDBCQUEwQixFQUFFLEtBQUssTUFBTTtBQUMzRixtQkFBYSxnQkFBZ0IsSUFBSSxxQkFBcUIsZUFBZSwrQkFBK0IsQ0FBQztBQUNyRyxhQUFPLEdBQUcsQ0FBQyxRQUFRO0FBRW5CLGFBQU8sV0FBVyw0QkFBNEIsRUFBRSxLQUFLLE1BQU07QUFDMUQsZUFBTyxZQUFZLE9BQU8sS0FBSyxXQUFXLGdDQUFnQyxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQ3RGLGVBQU8sR0FBRyxDQUFDLFFBQVE7QUFBQSxNQUNwQixDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRjtBQUVBLE9BQUssZ0hBQWdILE1BQU0sbUJBQXlCLEVBQUUsZUFBZSxLQUFLLEdBQUcsWUFBWTtBQUN4TCxVQUFNLGtCQUFrQixNQUFNLElBQUk7QUFDbEMseUJBQXFCLEtBQUssMEJBQTBCLEVBQUUsT0FBTyxpQkFBaUIsV0FBVyxNQUFNLE1BQU0sQ0FBQztBQUV0RyxXQUFPLHFEQUFxRCxhQUFhLDBCQUEwQixFQUNqRyxLQUFLLE1BQU0sT0FBTyxHQUFHLGdCQUFnQixTQUFTLENBQUM7QUFBQSxFQUNsRCxDQUFDLENBQUM7QUFFRixPQUFLLCtHQUErRyxNQUFNLG1CQUF5QixFQUFFLGVBQWUsS0FBSyxHQUFHLFlBQVk7QUFDdkwseUJBQXFCLEtBQUsscUJBQXFCLEVBQUUsaUNBQWlDLENBQUMsSUFBSSxLQUFLLGNBQWMsQ0FBQyxHQUFHLHdCQUF3QixLQUFLLENBQUM7QUFDNUksV0FBTyxxREFBcUQsYUFBYSwwQkFBMEI7QUFBQSxFQUNwRyxDQUFDLENBQUM7QUFFRixPQUFLLGlIQUFpSCxNQUFNLG1CQUF5QixFQUFFLGVBQWUsS0FBSyxHQUFHLFlBQVk7QUFDekwsV0FBTyxvQ0FBb0MsQ0FBQyxDQUFDO0FBQUEsRUFDOUMsQ0FBQyxDQUFDO0FBRUYsT0FBSywrRUFBK0UsTUFBTSxtQkFBeUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBQ3ZKLFVBQU0scUJBQXFCLFlBQVksYUFBYSxxQkFBcUI7QUFDekUsaUJBQWEsZ0JBQWdCLElBQUkscUJBQXFCLGVBQWUsK0JBQStCLENBQUM7QUFFckcsVUFBTSxNQUFNLFVBQVUsZ0JBQWdCLEtBQUs7QUFDM0MsVUFBTSxrQkFBa0IsT0FBTyxLQUFLLFdBQVcsZ0NBQWdDLENBQUM7QUFDaEYsVUFBTSxXQUFXLENBQUMsR0FBRyxhQUFhLDRCQUE0QixtQkFBbUI7QUFDakYsV0FBTyxZQUFZLGdCQUFnQixRQUFRLFNBQVMsTUFBTTtBQUMxRCxhQUFTLFFBQVEsT0FBSztBQUNyQixhQUFPLFlBQVksZ0JBQWdCLFFBQVEsRUFBRSxZQUFZLENBQUMsSUFBSSxJQUFJLElBQUk7QUFBQSxJQUN2RSxDQUFDO0FBQUEsRUFDRixDQUFDLENBQUM7QUFFRixPQUFLLGdIQUFnSCxNQUFNLG1CQUF5QixFQUFFLGVBQWUsS0FBSyxHQUFHLFlBQVk7QUFDeEwseUJBQXFCLFlBQVksNkJBQTZCLGdCQUFnQixrQkFBa0I7QUFDaEcsV0FBTyxvQ0FBb0MsYUFBYSwwQkFBMEI7QUFBQSxFQUNuRixDQUFDLENBQUM7QUFFRixPQUFLLHFJQUFxSSxNQUFNLG1CQUF5QixFQUFFLGVBQWUsS0FBSyxHQUFHLFlBQVk7QUFDN00seUJBQXFCLFlBQVksNkJBQTZCLGdCQUFnQixrQkFBa0I7QUFDaEcsV0FBTyxvQ0FBb0MsYUFBYSwyQkFBMkIsSUFBSSxPQUFLLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFBQSxFQUM3RyxDQUFDLENBQUM7QUFFRixPQUFLLGtIQUFrSCxNQUFNLG1CQUF5QixFQUFFLGVBQWUsS0FBSyxHQUFHLFlBQVk7QUFDMUwsNkJBQXlCLHFCQUFxQixrQkFBa0IsRUFBRSx1QkFBdUIsS0FBSyxDQUFDO0FBQy9GLFdBQU8sb0NBQW9DLGFBQWEsMEJBQTBCO0FBQUEsRUFDbkYsQ0FBQyxDQUFDO0FBRUYsT0FBSyw0SEFBNEgsTUFBTSxtQkFBeUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBQ3BNLDZCQUF5QixxQkFBcUIsa0JBQWtCLEVBQUUsaUNBQWlDLEtBQUssQ0FBQztBQUN6RyxXQUFPLHFCQUFxQixZQUFZLGFBQWEsMEJBQTBCLEVBQUUsS0FBSyxNQUFNO0FBQzNGLG1CQUFhLGdCQUFnQixJQUFJLHFCQUFxQixlQUFlLCtCQUErQixDQUFDO0FBQ3JHLGFBQU8sV0FBVyxrQkFBa0IsS0FBSyxNQUFNO0FBQzlDLGVBQU8sR0FBRyxDQUFDLFFBQVE7QUFBQSxNQUNwQixDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRixDQUFDLENBQUM7QUFFRixPQUFLLHdJQUF3SSxNQUFNLG1CQUF5QixFQUFFLGVBQWUsS0FBSyxHQUFHLFlBQVk7QUFDaE4seUJBQXFCLElBQUksZUFBZSxFQUFFLE1BQU0sc0RBQXNELE1BQU0sYUFBYSxXQUFXLGNBQWMsT0FBTztBQUN6SixXQUFPLG9DQUFvQyxhQUFhLDBCQUEwQjtBQUFBLEVBQ25GLENBQUMsQ0FBQztBQUVGLE9BQUssMkZBQTJGLE1BQU0sbUJBQXlCLEVBQUUsZUFBZSxLQUFLLEdBQUcsWUFBWTtBQUNuSyx5QkFBcUIsSUFBSSxlQUFlLEVBQUUsTUFBTSxzREFBc0QsTUFBTSxhQUFhLFdBQVcsY0FBYyxPQUFPO0FBQ3pKLHlCQUFxQixJQUFJLGVBQWUsRUFBRSxNQUFNLHVDQUF1Qyw4RkFBOEYsYUFBYSxTQUFTLGNBQWMsT0FBTztBQUNoTyx5QkFBcUIsSUFBSSxlQUFlLEVBQUUsTUFBTSwrQ0FBK0MsOERBQThELGFBQWEsU0FBUyxjQUFjLE9BQU87QUFFeE0sV0FBTyxxQkFBcUIsWUFBWSxhQUFhLDBCQUEwQixFQUFFLEtBQUssTUFBTTtBQUMzRixtQkFBYSxnQkFBZ0IsSUFBSSxxQkFBcUIsZUFBZSwrQkFBK0IsQ0FBQztBQUNyRyxhQUFPLFdBQVcsa0JBQWtCLEtBQUssTUFBTTtBQUM5QyxjQUFNLGtCQUFrQixXQUFXLGdDQUFnQztBQUNuRSxlQUFPLEdBQUcsQ0FBQyxnQkFBZ0IsdUJBQXVCLENBQUM7QUFDbkQsZUFBTyxHQUFHLGdCQUFnQixrQkFBa0IsQ0FBQztBQUM3QyxlQUFPLEdBQUcsZ0JBQWdCLCtCQUErQixDQUFDO0FBQzFELGVBQU8sR0FBRyxDQUFDLGdCQUFnQiwrQkFBK0IsQ0FBQztBQUFBLE1BQzVELENBQUM7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNGLENBQUMsQ0FBQztBQUVGLE9BQUssNEZBQTRGLE1BQU0sbUJBQXlCLEVBQUUsZUFBZSxLQUFLLEdBQUcsWUFBWTtBQUNwSyxVQUFNLHlCQUF5QixDQUFDLHlCQUF5QiwrQkFBK0I7QUFDeEYsVUFBTSx3QkFBd0I7QUFDOUIseUJBQXFCLElBQUksZUFBZSxFQUFFLE1BQU0sc0RBQXNELE1BQU0sYUFBYSxXQUFXLGNBQWMsT0FBTztBQUN6Six5QkFBcUIsSUFBSSxlQUFlLEVBQUUsTUFBTSx1Q0FBdUMsdUJBQXVCLGFBQWEsU0FBUyxjQUFjLE9BQU87QUFFekosV0FBTyxxQkFBcUIsWUFBWSxhQUFhLDRCQUE0QixzQkFBc0IsRUFBRSxLQUFLLE1BQU07QUFDbkgsbUJBQWEsZ0JBQWdCLElBQUkscUJBQXFCLGVBQWUsK0JBQStCLENBQUM7QUFDckcsYUFBTyxXQUFXLGtCQUFrQixLQUFLLE1BQU07QUFDOUMsY0FBTSxrQkFBa0IsV0FBVyxnQ0FBZ0M7QUFDbkUsZUFBTyxHQUFHLENBQUMsZ0JBQWdCLHVCQUF1QixDQUFDO0FBQ25ELGVBQU8sR0FBRyxnQkFBZ0Isa0JBQWtCLENBQUM7QUFDN0MsZUFBTyxHQUFHLGdCQUFnQiwrQkFBK0IsQ0FBQztBQUMxRCxlQUFPLEdBQUcsQ0FBQyxnQkFBZ0IsK0JBQStCLENBQUM7QUFBQSxNQUM1RCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRixDQUFDLENBQUM7QUFFRixPQUFLLCtGQUErRixZQUFZLG1CQUF5QixFQUFFLGVBQWUsS0FBSyxHQUFHLFlBQVk7QUFFN0ssVUFBTSxpQkFBaUIscUJBQXFCLElBQUksZUFBZTtBQUMvRCxVQUFNLGtDQUFrQyxDQUFDLHVCQUF1QjtBQUNoRSxVQUFNLHdCQUF3QjtBQUM5QixVQUFNLGlDQUFpQztBQUN2QyxtQkFBZSxNQUFNLHNEQUFzRCxNQUFNLGFBQWEsV0FBVyxjQUFjLE9BQU87QUFDOUgsbUJBQWUsTUFBTSx1Q0FBdUMsdUJBQXVCLGFBQWEsU0FBUyxjQUFjLE9BQU87QUFDOUgsbUJBQWUsTUFBTSwrQ0FBK0MsZ0NBQWdDLGFBQWEsU0FBUyxjQUFjLE9BQU87QUFFL0ksVUFBTSxxQkFBcUIsWUFBWSxhQUFhLDRCQUE0QiwrQkFBK0I7QUFDL0csaUJBQWEsZ0JBQWdCLElBQUkscUJBQXFCLGVBQWUsK0JBQStCLENBQUM7QUFDckcsVUFBTSxXQUFXO0FBRWpCLFVBQU0sa0JBQWtCLFdBQVcsZ0NBQWdDO0FBQ25FLFdBQU8sZ0JBQWdCLE9BQU8sS0FBSyxlQUFlLEdBQUcsQ0FBQyxvQkFBb0IsK0JBQStCLENBQUM7QUFBQSxFQUMzRyxDQUFDLENBQUM7QUFFRixPQUFLLCtGQUErRixZQUFZLG1CQUF5QixFQUFFLGVBQWUsS0FBSyxHQUFHLFlBQVk7QUFDN0ssVUFBTSxpQkFBaUIscUJBQXFCLElBQUksZUFBZTtBQUUvRCxVQUFNLHdCQUF3QjtBQUM5QixVQUFNLGlDQUFpQztBQUN2QyxtQkFBZSxNQUFNLHNEQUFzRCxNQUFNLGFBQWEsV0FBVyxjQUFjLE9BQU87QUFDOUgsbUJBQWUsTUFBTSx1Q0FBdUMsdUJBQXVCLGFBQWEsU0FBUyxjQUFjLE9BQU87QUFDOUgsbUJBQWUsTUFBTSwrQ0FBK0MsZ0NBQWdDLGFBQWEsU0FBUyxjQUFjLE9BQU87QUFFL0ksVUFBTSxxQkFBcUIsWUFBWSxhQUFhLDBCQUEwQjtBQUM5RSxVQUFNLHlDQUF5QyxxQkFBcUIsSUFBSSx1Q0FBdUM7QUFDL0csaUJBQWEsZ0JBQWdCLElBQUkscUJBQXFCLGVBQWUsK0JBQStCLENBQUM7QUFDckcsVUFBTSxXQUFXO0FBRWpCLFFBQUksa0JBQWtCLFdBQVcsZ0NBQWdDO0FBQ2pFLFdBQU8sR0FBRyxnQkFBZ0Isa0JBQWtCLENBQUM7QUFDN0MsV0FBTyxHQUFHLGdCQUFnQiwrQkFBK0IsQ0FBQztBQUMxRCxXQUFPLEdBQUcsQ0FBQyxnQkFBZ0IsK0JBQStCLENBQUM7QUFFM0QsMkNBQXVDLGtDQUFrQyxpQ0FBaUMsSUFBSTtBQUU5RyxzQkFBa0IsV0FBVyxnQ0FBZ0M7QUFDN0QsV0FBTyxHQUFHLGdCQUFnQixrQkFBa0IsQ0FBQztBQUM3QyxXQUFPLEdBQUcsQ0FBQyxnQkFBZ0IsK0JBQStCLENBQUM7QUFDM0QsV0FBTyxHQUFHLENBQUMsZ0JBQWdCLCtCQUErQixDQUFDO0FBRTNELDJDQUF1QyxrQ0FBa0MsaUNBQWlDLEtBQUs7QUFFL0csc0JBQWtCLFdBQVcsZ0NBQWdDO0FBQzdELFdBQU8sR0FBRyxnQkFBZ0Isa0JBQWtCLENBQUM7QUFDN0MsV0FBTyxHQUFHLGdCQUFnQiwrQkFBK0IsQ0FBQztBQUMxRCxXQUFPLEdBQUcsQ0FBQyxnQkFBZ0IsK0JBQStCLENBQUM7QUFBQSxFQUM1RCxDQUFDLENBQUM7QUFFRixPQUFLLDZHQUE2RyxZQUFZLG1CQUF5QixFQUFFLGVBQWUsS0FBSyxHQUFHLFlBQVk7QUFDM0wsVUFBTSxpQkFBaUIscUJBQXFCLElBQUksZUFBZTtBQUMvRCxVQUFNLHNCQUFzQixNQUFNLElBQUk7QUFDdEMsVUFBTSxxQkFBcUI7QUFFM0IsbUJBQWUsTUFBTSxzREFBc0QsTUFBTSxhQUFhLFdBQVcsY0FBYyxPQUFPO0FBQzlILG1CQUFlLE1BQU0sK0NBQStDLHdCQUF3QixhQUFhLFNBQVMsY0FBYyxPQUFPO0FBRXZJLFVBQU0scUJBQXFCLFlBQVksQ0FBQyxDQUFDO0FBQ3pDLGlCQUFhLGdCQUFnQixJQUFJLHFCQUFxQixlQUFlLCtCQUErQixDQUFDO0FBQ3JHLFVBQU0seUNBQXlDLHFCQUFxQixJQUFJLHVDQUF1QztBQUMvRyxvQkFBZ0IsSUFBSSx1Q0FBdUMsdUNBQXVDLG1CQUFtQixDQUFDO0FBQ3RILDJDQUF1QyxrQ0FBa0Msb0JBQW9CLElBQUk7QUFDakcsVUFBTSxXQUFXO0FBRWpCLFdBQU8sR0FBRyxvQkFBb0IsVUFBVTtBQUN4QyxXQUFPLEdBQUcsb0JBQW9CLFFBQVEsQ0FBQyxFQUFFLGdCQUFnQixFQUFFLGFBQWEsbUJBQW1CLFlBQVksR0FBRyxlQUFlLE1BQU0sQ0FBQyxDQUFDO0FBQUEsRUFDbEksQ0FBQyxDQUFDO0FBRUYsT0FBSyw2RkFBNkYsTUFBTSxtQkFBeUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBQ3JLLFVBQU0sd0JBQXdCO0FBQzlCLHlCQUFxQixJQUFJLGVBQWUsRUFBRSxNQUFNLHVDQUF1Qyx1QkFBdUIsYUFBYSxTQUFTLGNBQWMsT0FBTztBQUV6SixXQUFPLHFCQUFxQixZQUFZLENBQUMsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUN0RCxtQkFBYSxnQkFBZ0IsSUFBSSxxQkFBcUIsZUFBZSwrQkFBK0IsQ0FBQztBQUNyRyxhQUFPLFdBQVcsa0JBQWtCLEtBQUssTUFBTTtBQUM5QyxjQUFNLGtCQUFrQixXQUFXLDRCQUE0QjtBQUMvRCxlQUFPLFlBQVksZ0JBQWdCLFFBQVEsQ0FBQztBQUM1QyxlQUFPLEdBQUcsZ0JBQWdCLEtBQUssaUJBQWUsZ0JBQWdCLHVCQUF1QixDQUFDO0FBQ3RGLGVBQU8sR0FBRyxnQkFBZ0IsS0FBSyxpQkFBZSxnQkFBZ0Isa0JBQWtCLENBQUM7QUFDakYsZUFBTyxHQUFHLGdCQUFnQixNQUFNLGlCQUFlLGdCQUFnQiwyQ0FBMkMsQ0FBQztBQUFBLE1BQzVHLENBQUM7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNGLENBQUMsQ0FBQztBQUVGLE9BQUssNkZBQTZGLFlBQVk7QUFDN0csVUFBTSxxQkFBcUIsTUFBTyxLQUFLLEtBQUs7QUFDNUMsVUFBTSxNQUFNLEtBQUssSUFBSTtBQUNyQixVQUFNLGFBQWEsS0FBSztBQUN4QixVQUFNLHdCQUF3Qiw2QkFBNkIsR0FBRyx5QkFBeUIsR0FBRyxrREFBa0QsR0FBRyxxQkFBcUIsVUFBVTtBQUM5Syx5QkFBcUIsSUFBSSxlQUFlLEVBQUUsTUFBTSx1Q0FBdUMsdUJBQXVCLGFBQWEsU0FBUyxjQUFjLE9BQU87QUFFekosVUFBTSxxQkFBcUIsWUFBWSxDQUFDLENBQUM7QUFDekMsaUJBQWEsZ0JBQWdCLElBQUkscUJBQXFCLGVBQWUsK0JBQStCLENBQUM7QUFDckcsVUFBTSxXQUFXO0FBRWpCLFVBQU0sa0JBQWtCLFdBQVcsNEJBQTRCO0FBQy9ELFdBQU8sWUFBWSxnQkFBZ0IsUUFBUSxDQUFDO0FBQzVDLFdBQU8sR0FBRyxnQkFBZ0IsS0FBSyxpQkFBZSxnQkFBZ0IsdUJBQXVCLENBQUM7QUFDdEYsV0FBTyxHQUFHLGdCQUFnQixLQUFLLGlCQUFlLGdCQUFnQixrQkFBa0IsQ0FBQztBQUNqRixXQUFPLEdBQUcsZ0JBQWdCLE1BQU0saUJBQWUsZ0JBQWdCLDJDQUEyQyxDQUFDO0FBQzNHLFdBQU8sR0FBRyxnQkFBZ0IsTUFBTSxpQkFBZSxnQkFBZ0IsY0FBYyxDQUFDO0FBQUEsRUFDL0UsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
