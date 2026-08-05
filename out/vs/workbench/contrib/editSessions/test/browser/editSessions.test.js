import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { FileService } from "../../../../../platform/files/common/fileService.js";
import { Schemas } from "../../../../../base/common/network.js";
import { InMemoryFileSystemProvider } from "../../../../../platform/files/common/inMemoryFilesystemProvider.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { NullLogService } from "../../../../../platform/log/common/log.js";
import { EditSessionsContribution } from "../../browser/editSessions.contribution.js";
import { ProgressService } from "../../../../services/progress/browser/progressService.js";
import { IProgressService } from "../../../../../platform/progress/common/progress.js";
import { ISCMService } from "../../../scm/common/scm.js";
import { SCMService } from "../../../scm/common/scmService.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../../platform/workspace/common/workspace.js";
import { mock } from "../../../../../base/test/common/mock.js";
import * as sinon from "sinon";
import assert from "assert";
import { ChangeType, FileType, IEditSessionsLogService, IEditSessionsStorageService } from "../../common/editSessions.js";
import { URI } from "../../../../../base/common/uri.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { TestNotificationService } from "../../../../../platform/notification/test/common/testNotificationService.js";
import { TestEnvironmentService } from "../../../../test/browser/workbenchTestServices.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { Event } from "../../../../../base/common/event.js";
import { IViewDescriptorService } from "../../../../common/views.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { ILifecycleService } from "../../../../services/lifecycle/common/lifecycle.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { IRemoteAgentService } from "../../../../services/remote/common/remoteAgentService.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { IEditSessionIdentityService } from "../../../../../platform/workspace/common/editSessions.js";
import { IUserDataProfilesService } from "../../../../../platform/userDataProfile/common/userDataProfile.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { TestStorageService } from "../../../../test/common/workbenchTestServices.js";
import { IUriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentity.js";
import { UriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentityService.js";
import { IWorkspaceIdentityService, WorkspaceIdentityService } from "../../../../services/workspaces/common/workspaceIdentityService.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
const folderName = "test-folder";
const folderUri = URI.file(`/${folderName}`);
suite("Edit session sync", () => {
  let instantiationService;
  let editSessionsContribution;
  let fileService;
  let sandbox;
  const disposables = new DisposableStore();
  suiteSetup(() => {
    sandbox = sinon.createSandbox();
    instantiationService = new TestInstantiationService();
    const logService = new NullLogService();
    fileService = disposables.add(new FileService(logService));
    const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
    fileService.registerProvider(Schemas.file, fileSystemProvider);
    instantiationService.stub(IEditSessionsLogService, logService);
    instantiationService.stub(IFileService, fileService);
    instantiationService.stub(ILifecycleService, new class extends mock() {
      constructor() {
        super(...arguments);
        this.onWillShutdown = Event.None;
      }
    }());
    instantiationService.stub(INotificationService, new TestNotificationService());
    instantiationService.stub(IProductService, { "editSessions.store": { url: "https://test.com", canSwitch: true, authenticationProviders: {} } });
    instantiationService.stub(IStorageService, new TestStorageService());
    instantiationService.stub(IUriIdentityService, new UriIdentityService(fileService));
    instantiationService.stub(IEditSessionsStorageService, new class extends mock() {
      constructor() {
        super(...arguments);
        this.onDidSignIn = Event.None;
        this.onDidSignOut = Event.None;
      }
    }());
    instantiationService.stub(IExtensionService, new class extends mock() {
      constructor() {
        super(...arguments);
        this.onDidChangeExtensions = Event.None;
      }
    }());
    instantiationService.stub(IProgressService, ProgressService);
    instantiationService.stub(ISCMService, SCMService);
    instantiationService.stub(IEnvironmentService, TestEnvironmentService);
    instantiationService.stub(ITelemetryService, NullTelemetryService);
    instantiationService.stub(IDialogService, new class extends mock() {
      async prompt(prompt) {
        const result = prompt.buttons?.[0].run({ checkboxChecked: false });
        return { result };
      }
      async confirm() {
        return { confirmed: false };
      }
    }());
    instantiationService.stub(IRemoteAgentService, new class extends mock() {
      async getEnvironment() {
        return null;
      }
    }());
    instantiationService.stub(IConfigurationService, new TestConfigurationService({ workbench: { experimental: { editSessions: { enabled: true } } } }));
    instantiationService.stub(IWorkspaceContextService, new class extends mock() {
      getWorkspace() {
        return {
          id: "workspace-id",
          folders: [{
            uri: folderUri,
            name: folderName,
            index: 0,
            toResource: (relativePath) => joinPath(folderUri, relativePath)
          }]
        };
      }
      getWorkbenchState() {
        return WorkbenchState.FOLDER;
      }
    }());
    instantiationService.stub(ISCMService, "_repositories", /* @__PURE__ */ new Map());
    instantiationService.stub(IContextKeyService, new MockContextKeyService());
    instantiationService.stub(IThemeService, new class extends mock() {
      constructor() {
        super(...arguments);
        this.onDidColorThemeChange = Event.None;
        this.onDidFileIconThemeChange = Event.None;
      }
    }());
    instantiationService.stub(IViewDescriptorService, {
      onDidChangeLocation: Event.None
    });
    instantiationService.stub(ITextModelService, new class extends mock() {
      constructor() {
        super(...arguments);
        this.registerTextModelContentProvider = () => ({ dispose: () => {
        } });
      }
    }());
    instantiationService.stub(IEditorService, new class extends mock() {
      constructor() {
        super(...arguments);
        this.saveAll = async (_options) => {
          return { success: true, editors: [] };
        };
      }
    }());
    instantiationService.stub(IEditSessionIdentityService, new class extends mock() {
      async getEditSessionIdentifier() {
        return "test-identity";
      }
    }());
    instantiationService.set(IWorkspaceIdentityService, instantiationService.createInstance(WorkspaceIdentityService));
    instantiationService.stub(IUserDataProfilesService, new class extends mock() {
      constructor() {
        super(...arguments);
        this.defaultProfile = {
          id: "default",
          name: "Default",
          isDefault: true,
          location: URI.file("location"),
          globalStorageHome: URI.file("globalStorageHome"),
          settingsResource: URI.file("settingsResource"),
          keybindingsResource: URI.file("keybindingsResource"),
          tasksResource: URI.file("tasksResource"),
          snippetsHome: URI.file("snippetsHome"),
          promptsHome: URI.file("promptsHome"),
          extensionsResource: URI.file("extensionsResource"),
          cacheHome: URI.file("cacheHome")
        };
      }
    }());
    editSessionsContribution = instantiationService.createInstance(EditSessionsContribution);
  });
  teardown(() => {
    sinon.restore();
    disposables.clear();
  });
  suiteTeardown(() => {
    disposables.dispose();
  });
  test("Can apply edit session", async function() {
    const fileUri = joinPath(folderUri, "dir1", "README.md");
    const fileContents = "# readme";
    const editSession = {
      version: 1,
      folders: [
        {
          name: folderName,
          workingChanges: [
            {
              relativeFilePath: "dir1/README.md",
              fileType: FileType.File,
              contents: fileContents,
              type: ChangeType.Addition
            }
          ]
        }
      ]
    };
    const readStub = sandbox.stub().returns({ content: JSON.stringify(editSession), ref: "0" });
    instantiationService.stub(IEditSessionsStorageService, "read", readStub);
    await fileService.createFolder(folderUri);
    await editSessionsContribution.resumeEditSession();
    assert.equal((await fileService.readFile(fileUri)).value.toString(), fileContents);
  });
  test("Edit session not stored if there are no edits", async function() {
    const writeStub = sandbox.stub();
    instantiationService.stub(IEditSessionsStorageService, "write", writeStub);
    await fileService.createFolder(folderUri);
    await editSessionsContribution.storeEditSession(true, CancellationToken.None);
    assert.equal(writeStub.called, false);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9lZGl0U2Vzc2lvbnMvdGVzdC9icm93c2VyL2VkaXRTZXNzaW9ucy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9pbk1lbW9yeUZpbGVzeXN0ZW1Qcm92aWRlci5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IEVkaXRTZXNzaW9uc0NvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvZWRpdFNlc3Npb25zLmNvbnRyaWJ1dGlvbi5qcyc7XG5pbXBvcnQgeyBQcm9ncmVzc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9wcm9ncmVzcy9icm93c2VyL3Byb2dyZXNzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IElTQ01TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2NtL2NvbW1vbi9zY20uanMnO1xuaW1wb3J0IHsgU0NNU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NjbS9jb21tb24vc2NtU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgV29ya2JlbmNoU3RhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCAqIGFzIHNpbm9uIGZyb20gJ3Npbm9uJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IENoYW5nZVR5cGUsIEZpbGVUeXBlLCBJRWRpdFNlc3Npb25zTG9nU2VydmljZSwgSUVkaXRTZXNzaW9uc1N0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2VkaXRTZXNzaW9ucy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgam9pblBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Tm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Tm90aWZpY2F0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0RW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IE1vY2tDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvdGVzdC9jb21tb24vbW9ja0tleWJpbmRpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSwgSVByb21wdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UsIElTYXZlQWxsRWRpdG9yc09wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBOdWxsVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5VXRpbHMuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdFNlc3Npb25JZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL2VkaXRTZXNzaW9ucy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IFRlc3RTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IFVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUlkZW50aXR5U2VydmljZSwgV29ya3NwYWNlSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvd29ya3NwYWNlcy9jb21tb24vd29ya3NwYWNlSWRlbnRpdHlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5jb25zdCBmb2xkZXJOYW1lID0gJ3Rlc3QtZm9sZGVyJztcbmNvbnN0IGZvbGRlclVyaSA9IFVSSS5maWxlKGAvJHtmb2xkZXJOYW1lfWApO1xuXG5zdWl0ZSgnRWRpdCBzZXNzaW9uIHN5bmMnLCAoKSA9PiB7XG5cblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBlZGl0U2Vzc2lvbnNDb250cmlidXRpb246IEVkaXRTZXNzaW9uc0NvbnRyaWJ1dGlvbjtcblx0bGV0IGZpbGVTZXJ2aWNlOiBGaWxlU2VydmljZTtcblx0bGV0IHNhbmRib3g6IHNpbm9uLlNpbm9uU2FuZGJveDtcblxuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRzdWl0ZVNldHVwKCgpID0+IHtcblxuXHRcdHNhbmRib3ggPSBzaW5vbi5jcmVhdGVTYW5kYm94KCk7XG5cblx0XHRpbnN0YW50aWF0aW9uU2VydmljZSA9IG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKTtcblxuXHRcdC8vIFNldCB1cCBmaWxlc3lzdGVtXG5cdFx0Y29uc3QgbG9nU2VydmljZSA9IG5ldyBOdWxsTG9nU2VydmljZSgpO1xuXHRcdGZpbGVTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaWxlU2VydmljZShsb2dTZXJ2aWNlKSk7XG5cdFx0Y29uc3QgZmlsZVN5c3RlbVByb3ZpZGVyID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlcigpKTtcblx0XHRmaWxlU2VydmljZS5yZWdpc3RlclByb3ZpZGVyKFNjaGVtYXMuZmlsZSwgZmlsZVN5c3RlbVByb3ZpZGVyKTtcblxuXHRcdC8vIFN0dWIgb3V0IGFsbCBzZXJ2aWNlc1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRTZXNzaW9uc0xvZ1NlcnZpY2UsIGxvZ1NlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUZpbGVTZXJ2aWNlLCBmaWxlU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTGlmZWN5Y2xlU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTGlmZWN5Y2xlU2VydmljZT4oKSB7XG5cdFx0XHRvdmVycmlkZSBvbldpbGxTaHV0ZG93biA9IEV2ZW50Lk5vbmU7XG5cdFx0fSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTm90aWZpY2F0aW9uU2VydmljZSwgbmV3IFRlc3ROb3RpZmljYXRpb25TZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVByb2R1Y3RTZXJ2aWNlLCB7ICdlZGl0U2Vzc2lvbnMuc3RvcmUnOiB7IHVybDogJ2h0dHBzOi8vdGVzdC5jb20nLCBjYW5Td2l0Y2g6IHRydWUsIGF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzOiB7fSB9IH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVN0b3JhZ2VTZXJ2aWNlLCBuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVVyaUlkZW50aXR5U2VydmljZSwgbmV3IFVyaUlkZW50aXR5U2VydmljZShmaWxlU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRTZXNzaW9uc1N0b3JhZ2VTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElFZGl0U2Vzc2lvbnNTdG9yYWdlU2VydmljZT4oKSB7XG5cdFx0XHRvdmVycmlkZSBvbkRpZFNpZ25JbiA9IEV2ZW50Lk5vbmU7XG5cdFx0XHRvdmVycmlkZSBvbkRpZFNpZ25PdXQgPSBFdmVudC5Ob25lO1xuXHRcdH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUV4dGVuc2lvblNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dGVuc2lvblNlcnZpY2U+KCkge1xuXHRcdFx0b3ZlcnJpZGUgb25EaWRDaGFuZ2VFeHRlbnNpb25zID0gRXZlbnQuTm9uZTtcblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElQcm9ncmVzc1NlcnZpY2UsIFByb2dyZXNzU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU0NNU2VydmljZSwgU0NNU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRW52aXJvbm1lbnRTZXJ2aWNlLCBUZXN0RW52aXJvbm1lbnRTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZWxlbWV0cnlTZXJ2aWNlLCBOdWxsVGVsZW1ldHJ5U2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRGlhbG9nU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRGlhbG9nU2VydmljZT4oKSB7XG5cdFx0XHRvdmVycmlkZSBhc3luYyBwcm9tcHQocHJvbXB0OiBJUHJvbXB0PGFueT4pIHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gcHJvbXB0LmJ1dHRvbnM/LlswXS5ydW4oeyBjaGVja2JveENoZWNrZWQ6IGZhbHNlIH0pO1xuXHRcdFx0XHRyZXR1cm4geyByZXN1bHQgfTtcblx0XHRcdH1cblx0XHRcdG92ZXJyaWRlIGFzeW5jIGNvbmZpcm0oKSB7XG5cdFx0XHRcdHJldHVybiB7IGNvbmZpcm1lZDogZmFsc2UgfTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElSZW1vdGVBZ2VudFNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SVJlbW90ZUFnZW50U2VydmljZT4oKSB7XG5cdFx0XHRvdmVycmlkZSBhc3luYyBnZXRFbnZpcm9ubWVudCgpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29uZmlndXJhdGlvblNlcnZpY2UsIG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoeyB3b3JrYmVuY2g6IHsgZXhwZXJpbWVudGFsOiB7IGVkaXRTZXNzaW9uczogeyBlbmFibGVkOiB0cnVlIH0gfSB9IH0pKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJV29ya3NwYWNlQ29udGV4dFNlcnZpY2U+KCkge1xuXHRcdFx0b3ZlcnJpZGUgZ2V0V29ya3NwYWNlKCkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGlkOiAnd29ya3NwYWNlLWlkJyxcblx0XHRcdFx0XHRmb2xkZXJzOiBbe1xuXHRcdFx0XHRcdFx0dXJpOiBmb2xkZXJVcmksXG5cdFx0XHRcdFx0XHRuYW1lOiBmb2xkZXJOYW1lLFxuXHRcdFx0XHRcdFx0aW5kZXg6IDAsXG5cdFx0XHRcdFx0XHR0b1Jlc291cmNlOiAocmVsYXRpdmVQYXRoOiBzdHJpbmcpID0+IGpvaW5QYXRoKGZvbGRlclVyaSwgcmVsYXRpdmVQYXRoKVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRvdmVycmlkZSBnZXRXb3JrYmVuY2hTdGF0ZSgpIHtcblx0XHRcdFx0cmV0dXJuIFdvcmtiZW5jaFN0YXRlLkZPTERFUjtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIFN0dWIgcmVwb3NpdG9yaWVzXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU0NNU2VydmljZSwgJ19yZXBvc2l0b3JpZXMnLCBuZXcgTWFwKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnRleHRLZXlTZXJ2aWNlLCBuZXcgTW9ja0NvbnRleHRLZXlTZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRoZW1lU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJVGhlbWVTZXJ2aWNlPigpIHtcblx0XHRcdG92ZXJyaWRlIG9uRGlkQ29sb3JUaGVtZUNoYW5nZSA9IEV2ZW50Lk5vbmU7XG5cdFx0XHRvdmVycmlkZSBvbkRpZEZpbGVJY29uVGhlbWVDaGFuZ2UgPSBFdmVudC5Ob25lO1xuXHRcdH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdEZXNjcmlwdG9yU2VydmljZSwge1xuXHRcdFx0b25EaWRDaGFuZ2VMb2NhdGlvbjogRXZlbnQuTm9uZVxuXHRcdH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRleHRNb2RlbFNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SVRleHRNb2RlbFNlcnZpY2U+KCkge1xuXHRcdFx0b3ZlcnJpZGUgcmVnaXN0ZXJUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIgPSAoKSA9PiAoeyBkaXNwb3NlOiAoKSA9PiB7IH0gfSk7XG5cdFx0fSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRWRpdG9yU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRWRpdG9yU2VydmljZT4oKSB7XG5cdFx0XHRvdmVycmlkZSBzYXZlQWxsID0gYXN5bmMgKF9vcHRpb25zOiBJU2F2ZUFsbEVkaXRvcnNPcHRpb25zKSA9PiB7IHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGVkaXRvcnM6IFtdIH07IH07XG5cdFx0fSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRWRpdFNlc3Npb25JZGVudGl0eVNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUVkaXRTZXNzaW9uSWRlbnRpdHlTZXJ2aWNlPigpIHtcblx0XHRcdG92ZXJyaWRlIGFzeW5jIGdldEVkaXRTZXNzaW9uSWRlbnRpZmllcigpIHtcblx0XHRcdFx0cmV0dXJuICd0ZXN0LWlkZW50aXR5Jztcblx0XHRcdH1cblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zZXQoSVdvcmtzcGFjZUlkZW50aXR5U2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya3NwYWNlSWRlbnRpdHlTZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlPigpIHtcblx0XHRcdG92ZXJyaWRlIGRlZmF1bHRQcm9maWxlID0ge1xuXHRcdFx0XHRpZDogJ2RlZmF1bHQnLFxuXHRcdFx0XHRuYW1lOiAnRGVmYXVsdCcsXG5cdFx0XHRcdGlzRGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0bG9jYXRpb246IFVSSS5maWxlKCdsb2NhdGlvbicpLFxuXHRcdFx0XHRnbG9iYWxTdG9yYWdlSG9tZTogVVJJLmZpbGUoJ2dsb2JhbFN0b3JhZ2VIb21lJyksXG5cdFx0XHRcdHNldHRpbmdzUmVzb3VyY2U6IFVSSS5maWxlKCdzZXR0aW5nc1Jlc291cmNlJyksXG5cdFx0XHRcdGtleWJpbmRpbmdzUmVzb3VyY2U6IFVSSS5maWxlKCdrZXliaW5kaW5nc1Jlc291cmNlJyksXG5cdFx0XHRcdHRhc2tzUmVzb3VyY2U6IFVSSS5maWxlKCd0YXNrc1Jlc291cmNlJyksXG5cdFx0XHRcdHNuaXBwZXRzSG9tZTogVVJJLmZpbGUoJ3NuaXBwZXRzSG9tZScpLFxuXHRcdFx0XHRwcm9tcHRzSG9tZTogVVJJLmZpbGUoJ3Byb21wdHNIb21lJyksXG5cdFx0XHRcdGV4dGVuc2lvbnNSZXNvdXJjZTogVVJJLmZpbGUoJ2V4dGVuc2lvbnNSZXNvdXJjZScpLFxuXHRcdFx0XHRjYWNoZUhvbWU6IFVSSS5maWxlKCdjYWNoZUhvbWUnKSxcblx0XHRcdH07XG5cdFx0fSk7XG5cblx0XHRlZGl0U2Vzc2lvbnNDb250cmlidXRpb24gPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFZGl0U2Vzc2lvbnNDb250cmlidXRpb24pO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0c2lub24ucmVzdG9yZSgpO1xuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH0pO1xuXG5cdHN1aXRlVGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnQ2FuIGFwcGx5IGVkaXQgc2Vzc2lvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBmaWxlVXJpID0gam9pblBhdGgoZm9sZGVyVXJpLCAnZGlyMScsICdSRUFETUUubWQnKTtcblx0XHRjb25zdCBmaWxlQ29udGVudHMgPSAnIyByZWFkbWUnO1xuXHRcdGNvbnN0IGVkaXRTZXNzaW9uID0ge1xuXHRcdFx0dmVyc2lvbjogMSxcblx0XHRcdGZvbGRlcnM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG5hbWU6IGZvbGRlck5hbWUsXG5cdFx0XHRcdFx0d29ya2luZ0NoYW5nZXM6IFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0cmVsYXRpdmVGaWxlUGF0aDogJ2RpcjEvUkVBRE1FLm1kJyxcblx0XHRcdFx0XHRcdFx0ZmlsZVR5cGU6IEZpbGVUeXBlLkZpbGUsXG5cdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiBmaWxlQ29udGVudHMsXG5cdFx0XHRcdFx0XHRcdHR5cGU6IENoYW5nZVR5cGUuQWRkaXRpb25cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRdXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXG5cdFx0Ly8gU3R1YiBzeW5jIHNlcnZpY2UgdG8gcmV0dXJuIGVkaXQgc2Vzc2lvbiBkYXRhXG5cdFx0Y29uc3QgcmVhZFN0dWIgPSBzYW5kYm94LnN0dWIoKS5yZXR1cm5zKHsgY29udGVudDogSlNPTi5zdHJpbmdpZnkoZWRpdFNlc3Npb24pLCByZWY6ICcwJyB9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFZGl0U2Vzc2lvbnNTdG9yYWdlU2VydmljZSwgJ3JlYWQnLCByZWFkU3R1Yik7XG5cblx0XHQvLyBDcmVhdGUgcm9vdCBmb2xkZXJcblx0XHRhd2FpdCBmaWxlU2VydmljZS5jcmVhdGVGb2xkZXIoZm9sZGVyVXJpKTtcblxuXHRcdC8vIFJlc3VtZSBlZGl0IHNlc3Npb25cblx0XHRhd2FpdCBlZGl0U2Vzc2lvbnNDb250cmlidXRpb24ucmVzdW1lRWRpdFNlc3Npb24oKTtcblxuXHRcdC8vIFZlcmlmeSBlZGl0IHNlc3Npb24gd2FzIGNvcnJlY3RseSBhcHBsaWVkXG5cdFx0YXNzZXJ0LmVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5yZWFkRmlsZShmaWxlVXJpKSkudmFsdWUudG9TdHJpbmcoKSwgZmlsZUNvbnRlbnRzKTtcblx0fSk7XG5cblx0dGVzdCgnRWRpdCBzZXNzaW9uIG5vdCBzdG9yZWQgaWYgdGhlcmUgYXJlIG5vIGVkaXRzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHdyaXRlU3R1YiA9IHNhbmRib3guc3R1YigpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRTZXNzaW9uc1N0b3JhZ2VTZXJ2aWNlLCAnd3JpdGUnLCB3cml0ZVN0dWIpO1xuXG5cdFx0Ly8gQ3JlYXRlIHJvb3QgZm9sZGVyXG5cdFx0YXdhaXQgZmlsZVNlcnZpY2UuY3JlYXRlRm9sZGVyKGZvbGRlclVyaSk7XG5cblx0XHRhd2FpdCBlZGl0U2Vzc2lvbnNDb250cmlidXRpb24uc3RvcmVFZGl0U2Vzc2lvbih0cnVlLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblxuXHRcdC8vIFZlcmlmeSB0aGF0IHdlIGRpZCBub3QgYXR0ZW1wdCB0byB3cml0ZSB0aGUgZWRpdCBzZXNzaW9uXG5cdFx0YXNzZXJ0LmVxdWFsKHdyaXRlU3R1Yi5jYWxsZWQsIGZhbHNlKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGtDQUFrQztBQUMzQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDBCQUEwQixzQkFBc0I7QUFDekQsU0FBUyxZQUFZO0FBQ3JCLFlBQVksV0FBVztBQUN2QixPQUFPLFlBQVk7QUFDbkIsU0FBUyxZQUFZLFVBQVUseUJBQXlCLG1DQUFtQztBQUMzRixTQUFTLFdBQVc7QUFDcEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMs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
