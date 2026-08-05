import assert from "assert";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { TestDialogService } from "../../../../platform/dialogs/test/common/testDialogService.js";
import { TestInstantiationService } from "../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { TestNotificationService } from "../../../../platform/notification/test/common/testNotificationService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { MainThreadAuthentication } from "../../browser/mainThreadAuthentication.js";
import { ExtHostContext, MainContext } from "../../common/extHost.protocol.js";
import { ExtHostAuthentication } from "../../common/extHostAuthentication.js";
import { IActivityService } from "../../../services/activity/common/activity.js";
import { AuthenticationService } from "../../../services/authentication/browser/authenticationService.js";
import { IAuthenticationExtensionsService, IAuthenticationService } from "../../../services/authentication/common/authentication.js";
import { IExtensionService, nullExtensionDescription as extensionDescription } from "../../../services/extensions/common/extensions.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { TestRPCProtocol } from "../common/testRPCProtocol.js";
import { TestEnvironmentService, TestQuickInputService, TestRemoteAgentService } from "../../../test/browser/workbenchTestServices.js";
import { TestActivityService, TestExtensionService, TestProductService, TestStorageService } from "../../../test/common/workbenchTestServices.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { AuthenticationAccessService, IAuthenticationAccessService } from "../../../services/authentication/browser/authenticationAccessService.js";
import { AuthenticationUsageService, IAuthenticationUsageService } from "../../../services/authentication/browser/authenticationUsageService.js";
import { AuthenticationExtensionsService } from "../../../services/authentication/browser/authenticationExtensionsService.js";
import { ILogService, NullLogService } from "../../../../platform/log/common/log.js";
class AuthQuickPick {
  constructor() {
    this.items = [];
  }
  get selectedItems() {
    return this.items;
  }
  onDidAccept(listener) {
    this.listener = listener;
  }
  onDidHide(listener) {
  }
  dispose() {
  }
  show() {
    this.listener({
      inBackground: false
    });
  }
}
class AuthTestQuickInputService extends TestQuickInputService {
  createQuickPick() {
    return new AuthQuickPick();
  }
}
class TestAuthProvider {
  constructor(authProviderName) {
    this.authProviderName = authProviderName;
    this.id = 1;
    this.sessions = /* @__PURE__ */ new Map();
    this.onDidChangeSessions = () => {
      return { dispose() {
      } };
    };
  }
  async getSessions(scopes) {
    if (!scopes) {
      return [...this.sessions.values()];
    }
    if (scopes[0] === "return multiple") {
      return [...this.sessions.values()];
    }
    const sessions = this.sessions.get(scopes.join(" "));
    return sessions ? [sessions] : [];
  }
  async createSession(scopes) {
    const scopesStr = scopes.join(" ");
    const session = {
      scopes,
      id: `${this.id}`,
      account: {
        label: this.authProviderName,
        id: `${this.id}`
      },
      accessToken: Math.random() + ""
    };
    this.sessions.set(scopesStr, session);
    this.id++;
    return session;
  }
  async removeSession(sessionId) {
    this.sessions.delete(sessionId);
  }
}
suite("ExtHostAuthentication", () => {
  let disposables;
  let extHostAuthentication;
  let instantiationService;
  suiteSetup(async () => {
    instantiationService = new TestInstantiationService();
    instantiationService.stub(ILogService, new NullLogService());
    instantiationService.stub(IDialogService, new TestDialogService({ confirmed: true }));
    instantiationService.stub(IStorageService, new TestStorageService());
    instantiationService.stub(IQuickInputService, new AuthTestQuickInputService());
    instantiationService.stub(IExtensionService, new TestExtensionService());
    instantiationService.stub(IActivityService, new TestActivityService());
    instantiationService.stub(IRemoteAgentService, new TestRemoteAgentService());
    instantiationService.stub(INotificationService, new TestNotificationService());
    instantiationService.stub(ITelemetryService, NullTelemetryService);
    instantiationService.stub(IBrowserWorkbenchEnvironmentService, TestEnvironmentService);
    instantiationService.stub(IProductService, TestProductService);
    instantiationService.stub(IAuthenticationAccessService, instantiationService.createInstance(AuthenticationAccessService));
    instantiationService.stub(IAuthenticationService, instantiationService.createInstance(AuthenticationService));
    instantiationService.stub(IAuthenticationUsageService, instantiationService.createInstance(AuthenticationUsageService));
    const rpcProtocol = new TestRPCProtocol();
    instantiationService.stub(IAuthenticationExtensionsService, instantiationService.createInstance(AuthenticationExtensionsService));
    rpcProtocol.set(MainContext.MainThreadAuthentication, instantiationService.createInstance(MainThreadAuthentication, rpcProtocol));
    extHostAuthentication = new ExtHostAuthentication(rpcProtocol);
    rpcProtocol.set(ExtHostContext.ExtHostAuthentication, extHostAuthentication);
  });
  setup(async () => {
    disposables = new DisposableStore();
    disposables.add(extHostAuthentication.registerAuthenticationProvider("test", "test provider", new TestAuthProvider("test")));
    disposables.add(extHostAuthentication.registerAuthenticationProvider(
      "test-multiple",
      "test multiple provider",
      new TestAuthProvider("test-multiple"),
      { supportsMultipleAccounts: true }
    ));
  });
  suiteTeardown(() => {
    instantiationService.dispose();
  });
  teardown(() => {
    disposables.dispose();
  });
  test("createIfNone - true", async () => {
    const scopes = ["foo"];
    const session = await extHostAuthentication.getSession(
      extensionDescription,
      "test",
      scopes,
      {
        createIfNone: true
      }
    );
    assert.strictEqual(session?.id, "1");
    assert.strictEqual(session?.scopes[0], "foo");
  });
  test("createIfNone - false", async () => {
    const scopes = ["foo"];
    const nosession = await extHostAuthentication.getSession(
      extensionDescription,
      "test",
      scopes,
      {}
    );
    assert.strictEqual(nosession, void 0);
    const session = await extHostAuthentication.getSession(
      extensionDescription,
      "test",
      scopes,
      {
        createIfNone: true
      }
    );
    assert.strictEqual(session?.id, "1");
    assert.strictEqual(session?.scopes[0], "foo");
    const session2 = await extHostAuthentication.getSession(
      extensionDescription,
      "test",
      scopes,
      {}
    );
    assert.strictEqual(session2?.id, session.id);
    assert.strictEqual(session2?.scopes[0], session.scopes[0]);
    assert.strictEqual(session2?.accessToken, session.accessToken);
  });
  test("silent - true", async () => {
    const scopes = ["foo"];
    const nosession = await extHostAuthentication.getSession(
      extensionDescription,
      "test",
      scopes,
      {
        silent: true
      }
    );
    assert.strictEqual(nosession, void 0);
    const session = await extHostAuthentication.getSession(
      extensionDescription,
      "test",
      scopes,
      {
        createIfNone: true
      }
    );
    assert.strictEqual(session?.id, "1");
    assert.strictEqual(session?.scopes[0], "foo");
    const session2 = await extHostAuthentication.getSession(
      extensionDescription,
      "test",
      scopes,
      {
        silent: true
      }
    );
    assert.strictEqual(session.id, session2?.id);
    assert.strictEqual(session.scopes[0], session2?.scopes[0]);
  });
  test("forceNewSession - true - existing session", async () => {
    const scopes = ["foo"];
    const session1 = await extHostAuthentication.getSession(
      extensionDescription,
      "test",
      scopes,
      {
        createIfNone: true
      }
    );
    const session2 = await extHostAuthentication.getSession(
      extensionDescription,
      "test",
      scopes,
      {
        forceNewSession: true
      }
    );
    assert.strictEqual(session2?.id, "2");
    assert.strictEqual(session2?.scopes[0], "foo");
    assert.notStrictEqual(session1.accessToken, session2?.accessToken);
  });
  test("forceNewSession - true - no existing session", async () => {
    const scopes = ["foo"];
    const session = await extHostAuthentication.getSession(
      extensionDescription,
      "test",
      scopes,
      {
        forceNewSession: true
      }
    );
    assert.strictEqual(session?.id, "1");
    assert.strictEqual(session?.scopes[0], "foo");
  });
  test("forceNewSession - detail", async () => {
    const scopes = ["foo"];
    const session1 = await extHostAuthentication.getSession(
      extensionDescription,
      "test",
      scopes,
      {
        createIfNone: true
      }
    );
    const session2 = await extHostAuthentication.getSession(
      extensionDescription,
      "test",
      scopes,
      {
        forceNewSession: { detail: "bar" }
      }
    );
    assert.strictEqual(session2?.id, "2");
    assert.strictEqual(session2?.scopes[0], "foo");
    assert.notStrictEqual(session1.accessToken, session2?.accessToken);
  });
  test("clearSessionPreference - true", async () => {
    const scopes = ["foo"];
    const session = await extHostAuthentication.getSession(
      extensionDescription,
      "test-multiple",
      scopes,
      {
        createIfNone: true
      }
    );
    assert.strictEqual(session?.id, "1");
    assert.strictEqual(session?.scopes[0], scopes[0]);
    const scopes2 = ["bar"];
    const session2 = await extHostAuthentication.getSession(
      extensionDescription,
      "test-multiple",
      scopes2,
      {
        createIfNone: true
      }
    );
    assert.strictEqual(session2?.id, "2");
    assert.strictEqual(session2?.scopes[0], scopes2[0]);
    const session3 = await extHostAuthentication.getSession(
      extensionDescription,
      "test-multiple",
      ["return multiple"],
      {
        clearSessionPreference: true,
        createIfNone: true
      }
    );
    assert.strictEqual(session3?.id, session.id);
    assert.strictEqual(session3?.scopes[0], session.scopes[0]);
    assert.strictEqual(session3?.accessToken, session.accessToken);
  });
  test("silently getting session should return a session (if any) regardless of preference - fixes #137819", async () => {
    const scopes = ["foo"];
    const session = await extHostAuthentication.getSession(
      extensionDescription,
      "test-multiple",
      scopes,
      {
        createIfNone: true
      }
    );
    assert.strictEqual(session?.id, "1");
    assert.strictEqual(session?.scopes[0], scopes[0]);
    const scopes2 = ["bar"];
    const session2 = await extHostAuthentication.getSession(
      extensionDescription,
      "test-multiple",
      scopes2,
      {
        createIfNone: true
      }
    );
    assert.strictEqual(session2?.id, "2");
    assert.strictEqual(session2?.scopes[0], scopes2[0]);
    const shouldBeSession1 = await extHostAuthentication.getSession(
      extensionDescription,
      "test-multiple",
      scopes,
      {}
    );
    assert.strictEqual(shouldBeSession1?.id, session.id);
    assert.strictEqual(shouldBeSession1?.scopes[0], session.scopes[0]);
    assert.strictEqual(shouldBeSession1?.accessToken, session.accessToken);
    const shouldBeSession2 = await extHostAuthentication.getSession(
      extensionDescription,
      "test-multiple",
      scopes2,
      {}
    );
    assert.strictEqual(shouldBeSession2?.id, session2.id);
    assert.strictEqual(shouldBeSession2?.scopes[0], session2.scopes[0]);
    assert.strictEqual(shouldBeSession2?.accessToken, session2.accessToken);
  });
  test("createIfNone and forceNewSession", async () => {
    try {
      await extHostAuthentication.getSession(
        extensionDescription,
        "test",
        ["foo"],
        {
          createIfNone: true,
          forceNewSession: true
        }
      );
      assert.fail("should have thrown an Error.");
    } catch (e) {
      assert.ok(e);
    }
  });
  test("forceNewSession and silent", async () => {
    try {
      await extHostAuthentication.getSession(
        extensionDescription,
        "test",
        ["foo"],
        {
          forceNewSession: true,
          silent: true
        }
      );
      assert.fail("should have thrown an Error.");
    } catch (e) {
      assert.ok(e);
    }
  });
  test("createIfNone and silent", async () => {
    try {
      await extHostAuthentication.getSession(
        extensionDescription,
        "test",
        ["foo"],
        {
          createIfNone: true,
          silent: true
        }
      );
      assert.fail("should have thrown an Error.");
    } catch (e) {
      assert.ok(e);
    }
  });
  test("Can get multiple sessions (with different scopes) in one extension", async () => {
    let session = await extHostAuthentication.getSession(
      extensionDescription,
      "test-multiple",
      ["foo"],
      {
        createIfNone: true
      }
    );
    session = await extHostAuthentication.getSession(
      extensionDescription,
      "test-multiple",
      ["bar"],
      {
        createIfNone: true
      }
    );
    assert.strictEqual(session?.id, "2");
    assert.strictEqual(session?.scopes[0], "bar");
    session = await extHostAuthentication.getSession(
      extensionDescription,
      "test-multiple",
      ["foo"],
      {
        createIfNone: false
      }
    );
    assert.strictEqual(session?.id, "1");
    assert.strictEqual(session?.scopes[0], "foo");
  });
  test("Can get multiple sessions (from different providers) in one extension", async () => {
    let session = await extHostAuthentication.getSession(
      extensionDescription,
      "test-multiple",
      ["foo"],
      {
        createIfNone: true
      }
    );
    session = await extHostAuthentication.getSession(
      extensionDescription,
      "test",
      ["foo"],
      {
        createIfNone: true
      }
    );
    assert.strictEqual(session?.id, "1");
    assert.strictEqual(session?.scopes[0], "foo");
    assert.strictEqual(session?.account.label, "test");
    const session2 = await extHostAuthentication.getSession(
      extensionDescription,
      "test-multiple",
      ["foo"],
      {
        createIfNone: false
      }
    );
    assert.strictEqual(session2?.id, "1");
    assert.strictEqual(session2?.scopes[0], "foo");
    assert.strictEqual(session2?.account.label, "test-multiple");
  });
  test("Can get multiple sessions (from different providers) in one extension at the same time", async () => {
    const sessionP = extHostAuthentication.getSession(
      extensionDescription,
      "test",
      ["foo"],
      {
        createIfNone: true
      }
    );
    const session2P = extHostAuthentication.getSession(
      extensionDescription,
      "test-multiple",
      ["foo"],
      {
        createIfNone: true
      }
    );
    const session = await sessionP;
    assert.strictEqual(session?.id, "1");
    assert.strictEqual(session?.scopes[0], "foo");
    assert.strictEqual(session?.account.label, "test");
    const session2 = await session2P;
    assert.strictEqual(session2?.id, "1");
    assert.strictEqual(session2?.scopes[0], "foo");
    assert.strictEqual(session2?.account.label, "test-multiple");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0QXV0aGVudGljYXRpb24uaW50ZWdyYXRpb25UZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBUZXN0RGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvdGVzdC9jb21tb24vdGVzdERpYWxvZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Tm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Tm90aWZpY2F0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dEhpZGVFdmVudCwgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrRGlkQWNjZXB0RXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBOdWxsVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5VXRpbHMuanMnO1xuaW1wb3J0IHsgTWFpblRocmVhZEF1dGhlbnRpY2F0aW9uIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9tYWluVGhyZWFkQXV0aGVudGljYXRpb24uanMnO1xuaW1wb3J0IHsgRXh0SG9zdENvbnRleHQsIE1haW5Db250ZXh0IH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgRXh0SG9zdEF1dGhlbnRpY2F0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RBdXRoZW50aWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQWN0aXZpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYWN0aXZpdHkvY29tbW9uL2FjdGl2aXR5LmpzJztcbmltcG9ydCB7IEF1dGhlbnRpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvYXV0aGVudGljYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElBdXRoZW50aWNhdGlvbkV4dGVuc2lvbnNTZXJ2aWNlLCBJQXV0aGVudGljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYXV0aGVudGljYXRpb24vY29tbW9uL2F1dGhlbnRpY2F0aW9uLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlLCBudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24gYXMgZXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0UlBDUHJvdG9jb2wgfSBmcm9tICcuLi9jb21tb24vdGVzdFJQQ1Byb3RvY29sLmpzJztcbmltcG9ydCB7IFRlc3RFbnZpcm9ubWVudFNlcnZpY2UsIFRlc3RRdWlja0lucHV0U2VydmljZSwgVGVzdFJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgVGVzdEFjdGl2aXR5U2VydmljZSwgVGVzdEV4dGVuc2lvblNlcnZpY2UsIFRlc3RQcm9kdWN0U2VydmljZSwgVGVzdFN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vdGVzdC9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB0eXBlIHsgQXV0aGVudGljYXRpb25Qcm92aWRlciwgQXV0aGVudGljYXRpb25TZXNzaW9uIH0gZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvYnJvd3Nlci9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQXV0aGVudGljYXRpb25BY2Nlc3NTZXJ2aWNlLCBJQXV0aGVudGljYXRpb25BY2Nlc3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYXV0aGVudGljYXRpb24vYnJvd3Nlci9hdXRoZW50aWNhdGlvbkFjY2Vzc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQXV0aGVudGljYXRpb25Vc2FnZVNlcnZpY2UsIElBdXRoZW50aWNhdGlvblVzYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvYXV0aGVudGljYXRpb25Vc2FnZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQXV0aGVudGljYXRpb25FeHRlbnNpb25zU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvYXV0aGVudGljYXRpb25FeHRlbnNpb25zU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5cbmNsYXNzIEF1dGhRdWlja1BpY2sge1xuXHRwcml2YXRlIGxpc3RlbmVyOiAoKGU6IElRdWlja1BpY2tEaWRBY2NlcHRFdmVudCkgPT4gYW55KSB8IHVuZGVmaW5lZDtcblx0cHVibGljIGl0ZW1zID0gW107XG5cdHB1YmxpYyBnZXQgc2VsZWN0ZWRJdGVtcygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuaXRlbXM7XG5cdH1cblxuXHRvbkRpZEFjY2VwdChsaXN0ZW5lcjogKGU6IElRdWlja1BpY2tEaWRBY2NlcHRFdmVudCkgPT4gYW55KSB7XG5cdFx0dGhpcy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuXHR9XG5cdG9uRGlkSGlkZShsaXN0ZW5lcjogKGU6IElRdWlja0lucHV0SGlkZUV2ZW50KSA9PiBhbnkpIHtcblxuXHR9XG5cdGRpc3Bvc2UoKSB7XG5cblx0fVxuXHRzaG93KCkge1xuXHRcdHRoaXMubGlzdGVuZXIhKHtcblx0XHRcdGluQmFja2dyb3VuZDogZmFsc2Vcblx0XHR9KTtcblx0fVxufVxuY2xhc3MgQXV0aFRlc3RRdWlja0lucHV0U2VydmljZSBleHRlbmRzIFRlc3RRdWlja0lucHV0U2VydmljZSB7XG5cdG92ZXJyaWRlIGNyZWF0ZVF1aWNrUGljaygpIHtcblx0XHRyZXR1cm4gPGFueT5uZXcgQXV0aFF1aWNrUGljaygpO1xuXHR9XG59XG5cbmNsYXNzIFRlc3RBdXRoUHJvdmlkZXIgaW1wbGVtZW50cyBBdXRoZW50aWNhdGlvblByb3ZpZGVyIHtcblx0cHJpdmF0ZSBpZCA9IDE7XG5cdHByaXZhdGUgc2Vzc2lvbnMgPSBuZXcgTWFwPHN0cmluZywgQXV0aGVudGljYXRpb25TZXNzaW9uPigpO1xuXHRvbkRpZENoYW5nZVNlc3Npb25zID0gKCkgPT4geyByZXR1cm4geyBkaXNwb3NlKCkgeyB9IH07IH07XG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgYXV0aFByb3ZpZGVyTmFtZTogc3RyaW5nKSB7IH1cblx0YXN5bmMgZ2V0U2Vzc2lvbnMoc2NvcGVzPzogcmVhZG9ubHkgc3RyaW5nW10pOiBQcm9taXNlPEF1dGhlbnRpY2F0aW9uU2Vzc2lvbltdPiB7XG5cdFx0aWYgKCFzY29wZXMpIHtcblx0XHRcdHJldHVybiBbLi4udGhpcy5zZXNzaW9ucy52YWx1ZXMoKV07XG5cdFx0fVxuXG5cdFx0aWYgKHNjb3Blc1swXSA9PT0gJ3JldHVybiBtdWx0aXBsZScpIHtcblx0XHRcdHJldHVybiBbLi4udGhpcy5zZXNzaW9ucy52YWx1ZXMoKV07XG5cdFx0fVxuXHRcdGNvbnN0IHNlc3Npb25zID0gdGhpcy5zZXNzaW9ucy5nZXQoc2NvcGVzLmpvaW4oJyAnKSk7XG5cdFx0cmV0dXJuIHNlc3Npb25zID8gW3Nlc3Npb25zXSA6IFtdO1xuXHR9XG5cdGFzeW5jIGNyZWF0ZVNlc3Npb24oc2NvcGVzOiByZWFkb25seSBzdHJpbmdbXSk6IFByb21pc2U8QXV0aGVudGljYXRpb25TZXNzaW9uPiB7XG5cdFx0Y29uc3Qgc2NvcGVzU3RyID0gc2NvcGVzLmpvaW4oJyAnKTtcblx0XHRjb25zdCBzZXNzaW9uID0ge1xuXHRcdFx0c2NvcGVzLFxuXHRcdFx0aWQ6IGAke3RoaXMuaWR9YCxcblx0XHRcdGFjY291bnQ6IHtcblx0XHRcdFx0bGFiZWw6IHRoaXMuYXV0aFByb3ZpZGVyTmFtZSxcblx0XHRcdFx0aWQ6IGAke3RoaXMuaWR9YCxcblx0XHRcdH0sXG5cdFx0XHRhY2Nlc3NUb2tlbjogTWF0aC5yYW5kb20oKSArICcnLFxuXHRcdH07XG5cdFx0dGhpcy5zZXNzaW9ucy5zZXQoc2NvcGVzU3RyLCBzZXNzaW9uKTtcblx0XHR0aGlzLmlkKys7XG5cdFx0cmV0dXJuIHNlc3Npb247XG5cdH1cblx0YXN5bmMgcmVtb3ZlU2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuc2Vzc2lvbnMuZGVsZXRlKHNlc3Npb25JZCk7XG5cdH1cblxufVxuXG5zdWl0ZSgnRXh0SG9zdEF1dGhlbnRpY2F0aW9uJywgKCkgPT4ge1xuXHRsZXQgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblxuXHRsZXQgZXh0SG9zdEF1dGhlbnRpY2F0aW9uOiBFeHRIb3N0QXV0aGVudGljYXRpb247XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXG5cdHN1aXRlU2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUxvZ1NlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElEaWFsb2dTZXJ2aWNlLCBuZXcgVGVzdERpYWxvZ1NlcnZpY2UoeyBjb25maXJtZWQ6IHRydWUgfSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVN0b3JhZ2VTZXJ2aWNlLCBuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVF1aWNrSW5wdXRTZXJ2aWNlLCBuZXcgQXV0aFRlc3RRdWlja0lucHV0U2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFeHRlbnNpb25TZXJ2aWNlLCBuZXcgVGVzdEV4dGVuc2lvblNlcnZpY2UoKSk7XG5cblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElBY3Rpdml0eVNlcnZpY2UsIG5ldyBUZXN0QWN0aXZpdHlTZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVJlbW90ZUFnZW50U2VydmljZSwgbmV3IFRlc3RSZW1vdGVBZ2VudFNlcnZpY2UoKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTm90aWZpY2F0aW9uU2VydmljZSwgbmV3IFRlc3ROb3RpZmljYXRpb25TZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRlbGVtZXRyeVNlcnZpY2UsIE51bGxUZWxlbWV0cnlTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLCBUZXN0RW52aXJvbm1lbnRTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElQcm9kdWN0U2VydmljZSwgVGVzdFByb2R1Y3RTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElBdXRoZW50aWNhdGlvbkFjY2Vzc1NlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEF1dGhlbnRpY2F0aW9uQWNjZXNzU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUF1dGhlbnRpY2F0aW9uU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQXV0aGVudGljYXRpb25TZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQXV0aGVudGljYXRpb25Vc2FnZVNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEF1dGhlbnRpY2F0aW9uVXNhZ2VTZXJ2aWNlKSk7XG5cdFx0Y29uc3QgcnBjUHJvdG9jb2wgPSBuZXcgVGVzdFJQQ1Byb3RvY29sKCk7XG5cblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElBdXRoZW50aWNhdGlvbkV4dGVuc2lvbnNTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShBdXRoZW50aWNhdGlvbkV4dGVuc2lvbnNTZXJ2aWNlKSk7XG5cdFx0cnBjUHJvdG9jb2wuc2V0KE1haW5Db250ZXh0Lk1haW5UaHJlYWRBdXRoZW50aWNhdGlvbiwgaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWFpblRocmVhZEF1dGhlbnRpY2F0aW9uLCBycGNQcm90b2NvbCkpO1xuXHRcdGV4dEhvc3RBdXRoZW50aWNhdGlvbiA9IG5ldyBFeHRIb3N0QXV0aGVudGljYXRpb24ocnBjUHJvdG9jb2wpO1xuXHRcdHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0QXV0aGVudGljYXRpb24sIGV4dEhvc3RBdXRoZW50aWNhdGlvbik7XG5cdH0pO1xuXG5cdHNldHVwKGFzeW5jICgpID0+IHtcblx0XHRkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdEF1dGhlbnRpY2F0aW9uLnJlZ2lzdGVyQXV0aGVudGljYXRpb25Qcm92aWRlcigndGVzdCcsICd0ZXN0IHByb3ZpZGVyJywgbmV3IFRlc3RBdXRoUHJvdmlkZXIoJ3Rlc3QnKSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0QXV0aGVudGljYXRpb24ucmVnaXN0ZXJBdXRoZW50aWNhdGlvblByb3ZpZGVyKFxuXHRcdFx0J3Rlc3QtbXVsdGlwbGUnLFxuXHRcdFx0J3Rlc3QgbXVsdGlwbGUgcHJvdmlkZXInLFxuXHRcdFx0bmV3IFRlc3RBdXRoUHJvdmlkZXIoJ3Rlc3QtbXVsdGlwbGUnKSxcblx0XHRcdHsgc3VwcG9ydHNNdWx0aXBsZUFjY291bnRzOiB0cnVlIH0pKTtcblx0fSk7XG5cblx0c3VpdGVUZWFyZG93bigoKSA9PiB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVJZk5vbmUgLSB0cnVlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNjb3BlcyA9IFsnZm9vJ107XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGV4dEhvc3RBdXRoZW50aWNhdGlvbi5nZXRTZXNzaW9uKFxuXHRcdFx0ZXh0ZW5zaW9uRGVzY3JpcHRpb24sXG5cdFx0XHQndGVzdCcsXG5cdFx0XHRzY29wZXMsXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUlmTm9uZTogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24/LmlkLCAnMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uPy5zY29wZXNbMF0sICdmb28nKTtcblx0fSk7XG5cblx0dGVzdCgnY3JlYXRlSWZOb25lIC0gZmFsc2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc2NvcGVzID0gWydmb28nXTtcblx0XHRjb25zdCBub3Nlc3Npb24gPSBhd2FpdCBleHRIb3N0QXV0aGVudGljYXRpb24uZ2V0U2Vzc2lvbihcblx0XHRcdGV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdFx0J3Rlc3QnLFxuXHRcdFx0c2NvcGVzLFxuXHRcdFx0e30pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3Nlc3Npb24sIHVuZGVmaW5lZCk7XG5cblx0XHQvLyBOb3cgY3JlYXRlIHRoZSBzZXNzaW9uXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGV4dEhvc3RBdXRoZW50aWNhdGlvbi5nZXRTZXNzaW9uKFxuXHRcdFx0ZXh0ZW5zaW9uRGVzY3JpcHRpb24sXG5cdFx0XHQndGVzdCcsXG5cdFx0XHRzY29wZXMsXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUlmTm9uZTogdHJ1ZVxuXHRcdFx0fSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbj8uaWQsICcxJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24/LnNjb3Blc1swXSwgJ2ZvbycpO1xuXG5cdFx0Y29uc3Qgc2Vzc2lvbjIgPSBhd2FpdCBleHRIb3N0QXV0aGVudGljYXRpb24uZ2V0U2Vzc2lvbihcblx0XHRcdGV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdFx0J3Rlc3QnLFxuXHRcdFx0c2NvcGVzLFxuXHRcdFx0e30pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24yPy5pZCwgc2Vzc2lvbi5pZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24yPy5zY29wZXNbMF0sIHNlc3Npb24uc2NvcGVzWzBdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbjI/LmFjY2Vzc1Rva2VuLCBzZXNzaW9uLmFjY2Vzc1Rva2VuKTtcblx0fSk7XG5cblx0Ly8gc2hvdWxkIGJlaGF2ZSB0aGUgc2FtZSBhcyBjcmVhdGVJZk5vbmU6IGZhbHNlXG5cdHRlc3QoJ3NpbGVudCAtIHRydWUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc2NvcGVzID0gWydmb28nXTtcblx0XHRjb25zdCBub3Nlc3Npb24gPSBhd2FpdCBleHRIb3N0QXV0aGVudGljYXRpb24uZ2V0U2Vzc2lvbihcblx0XHRcdGV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdFx0J3Rlc3QnLFxuXHRcdFx0c2NvcGVzLFxuXHRcdFx0e1xuXHRcdFx0XHRzaWxlbnQ6IHRydWVcblx0XHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3Nlc3Npb24sIHVuZGVmaW5lZCk7XG5cblx0XHQvLyBOb3cgY3JlYXRlIHRoZSBzZXNzaW9uXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGV4dEhvc3RBdXRoZW50aWNhdGlvbi5nZXRTZXNzaW9uKFxuXHRcdFx0ZXh0ZW5zaW9uRGVzY3JpcHRpb24sXG5cdFx0XHQndGVzdCcsXG5cdFx0XHRzY29wZXMsXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUlmTm9uZTogdHJ1ZVxuXHRcdFx0fSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbj8uaWQsICcxJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24/LnNjb3Blc1swXSwgJ2ZvbycpO1xuXG5cdFx0Y29uc3Qgc2Vzc2lvbjIgPSBhd2FpdCBleHRIb3N0QXV0aGVudGljYXRpb24uZ2V0U2Vzc2lvbihcblx0XHRcdGV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdFx0J3Rlc3QnLFxuXHRcdFx0c2NvcGVzLFxuXHRcdFx0e1xuXHRcdFx0XHRzaWxlbnQ6IHRydWVcblx0XHRcdH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaWQsIHNlc3Npb24yPy5pZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uc2NvcGVzWzBdLCBzZXNzaW9uMj8uc2NvcGVzWzBdKTtcblx0fSk7XG5cblx0dGVzdCgnZm9yY2VOZXdTZXNzaW9uIC0gdHJ1ZSAtIGV4aXN0aW5nIHNlc3Npb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc2NvcGVzID0gWydmb28nXTtcblx0XHRjb25zdCBzZXNzaW9uMSA9IGF3YWl0IGV4dEhvc3RBdXRoZW50aWNhdGlvbi5nZXRTZXNzaW9uKFxuXHRcdFx0ZXh0ZW5zaW9uRGVzY3JpcHRpb24sXG5cdFx0XHQndGVzdCcsXG5cdFx0XHRzY29wZXMsXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUlmTm9uZTogdHJ1ZVxuXHRcdFx0fSk7XG5cblx0XHQvLyBOb3cgY3JlYXRlIHRoZSBzZXNzaW9uXG5cdFx0Y29uc3Qgc2Vzc2lvbjIgPSBhd2FpdCBleHRIb3N0QXV0aGVudGljYXRpb24uZ2V0U2Vzc2lvbihcblx0XHRcdGV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdFx0J3Rlc3QnLFxuXHRcdFx0c2NvcGVzLFxuXHRcdFx0e1xuXHRcdFx0XHRmb3JjZU5ld1Nlc3Npb246IHRydWVcblx0XHRcdH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24yPy5pZCwgJzInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbjI/LnNjb3Blc1swXSwgJ2ZvbycpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChzZXNzaW9uMS5hY2Nlc3NUb2tlbiwgc2Vzc2lvbjI/LmFjY2Vzc1Rva2VuKTtcblx0fSk7XG5cblx0Ly8gU2hvdWxkIGJlaGF2ZSBsaWtlIGNyZWF0ZUlmTm9uZTogdHJ1ZVxuXHR0ZXN0KCdmb3JjZU5ld1Nlc3Npb24gLSB0cnVlIC0gbm8gZXhpc3Rpbmcgc2Vzc2lvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzY29wZXMgPSBbJ2ZvbyddO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBhd2FpdCBleHRIb3N0QXV0aGVudGljYXRpb24uZ2V0U2Vzc2lvbihcblx0XHRcdGV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdFx0J3Rlc3QnLFxuXHRcdFx0c2NvcGVzLFxuXHRcdFx0e1xuXHRcdFx0XHRmb3JjZU5ld1Nlc3Npb246IHRydWVcblx0XHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uPy5pZCwgJzEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbj8uc2NvcGVzWzBdLCAnZm9vJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZvcmNlTmV3U2Vzc2lvbiAtIGRldGFpbCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzY29wZXMgPSBbJ2ZvbyddO1xuXHRcdGNvbnN0IHNlc3Npb24xID0gYXdhaXQgZXh0SG9zdEF1dGhlbnRpY2F0aW9uLmdldFNlc3Npb24oXG5cdFx0XHRleHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRcdCd0ZXN0Jyxcblx0XHRcdHNjb3Blcyxcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlSWZOb25lOiB0cnVlXG5cdFx0XHR9KTtcblxuXHRcdC8vIE5vdyBjcmVhdGUgdGhlIHNlc3Npb25cblx0XHRjb25zdCBzZXNzaW9uMiA9IGF3YWl0IGV4dEhvc3RBdXRoZW50aWNhdGlvbi5nZXRTZXNzaW9uKFxuXHRcdFx0ZXh0ZW5zaW9uRGVzY3JpcHRpb24sXG5cdFx0XHQndGVzdCcsXG5cdFx0XHRzY29wZXMsXG5cdFx0XHR7XG5cdFx0XHRcdGZvcmNlTmV3U2Vzc2lvbjogeyBkZXRhaWw6ICdiYXInIH1cblx0XHRcdH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24yPy5pZCwgJzInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbjI/LnNjb3Blc1swXSwgJ2ZvbycpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChzZXNzaW9uMS5hY2Nlc3NUb2tlbiwgc2Vzc2lvbjI/LmFjY2Vzc1Rva2VuKTtcblx0fSk7XG5cblx0Ly8jcmVnaW9uIE11bHRpLUFjY291bnQgQXV0aFByb3ZpZGVyXG5cblx0dGVzdCgnY2xlYXJTZXNzaW9uUHJlZmVyZW5jZSAtIHRydWUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc2NvcGVzID0gWydmb28nXTtcblx0XHQvLyBOb3cgY3JlYXRlIHRoZSBzZXNzaW9uXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGV4dEhvc3RBdXRoZW50aWNhdGlvbi5nZXRTZXNzaW9uKFxuXHRcdFx0ZXh0ZW5zaW9uRGVzY3JpcHRpb24sXG5cdFx0XHQndGVzdC1tdWx0aXBsZScsXG5cdFx0XHRzY29wZXMsXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUlmTm9uZTogdHJ1ZVxuXHRcdFx0fSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbj8uaWQsICcxJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24/LnNjb3Blc1swXSwgc2NvcGVzWzBdKTtcblxuXHRcdGNvbnN0IHNjb3BlczIgPSBbJ2JhciddO1xuXHRcdGNvbnN0IHNlc3Npb24yID0gYXdhaXQgZXh0SG9zdEF1dGhlbnRpY2F0aW9uLmdldFNlc3Npb24oXG5cdFx0XHRleHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRcdCd0ZXN0LW11bHRpcGxlJyxcblx0XHRcdHNjb3BlczIsXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUlmTm9uZTogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24yPy5pZCwgJzInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbjI/LnNjb3Blc1swXSwgc2NvcGVzMlswXSk7XG5cblx0XHRjb25zdCBzZXNzaW9uMyA9IGF3YWl0IGV4dEhvc3RBdXRoZW50aWNhdGlvbi5nZXRTZXNzaW9uKFxuXHRcdFx0ZXh0ZW5zaW9uRGVzY3JpcHRpb24sXG5cdFx0XHQndGVzdC1tdWx0aXBsZScsXG5cdFx0XHRbJ3JldHVybiBtdWx0aXBsZSddLFxuXHRcdFx0e1xuXHRcdFx0XHRjbGVhclNlc3Npb25QcmVmZXJlbmNlOiB0cnVlLFxuXHRcdFx0XHRjcmVhdGVJZk5vbmU6IHRydWVcblx0XHRcdH0pO1xuXG5cdFx0Ly8gY2xlYXJpbmcgc2Vzc2lvbiBwcmVmZXJlbmNlIGNhdXNlcyB1cyB0byBnZXQgdGhlIGZpcnN0IHNlc3Npb25cblx0XHQvLyBiZWNhdXNlIGl0IHdvdWxkIG5vcm1hbGx5IHNob3cgYSBxdWljayBwaWNrIGZvciB0aGUgdXNlciB0byBjaG9vc2Vcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbjM/LmlkLCBzZXNzaW9uLmlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbjM/LnNjb3Blc1swXSwgc2Vzc2lvbi5zY29wZXNbMF0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uMz8uYWNjZXNzVG9rZW4sIHNlc3Npb24uYWNjZXNzVG9rZW4pO1xuXHR9KTtcblxuXHR0ZXN0KCdzaWxlbnRseSBnZXR0aW5nIHNlc3Npb24gc2hvdWxkIHJldHVybiBhIHNlc3Npb24gKGlmIGFueSkgcmVnYXJkbGVzcyBvZiBwcmVmZXJlbmNlIC0gZml4ZXMgIzEzNzgxOScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzY29wZXMgPSBbJ2ZvbyddO1xuXHRcdC8vIE5vdyBjcmVhdGUgdGhlIHNlc3Npb25cblx0XHRjb25zdCBzZXNzaW9uID0gYXdhaXQgZXh0SG9zdEF1dGhlbnRpY2F0aW9uLmdldFNlc3Npb24oXG5cdFx0XHRleHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRcdCd0ZXN0LW11bHRpcGxlJyxcblx0XHRcdHNjb3Blcyxcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlSWZOb25lOiB0cnVlXG5cdFx0XHR9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uPy5pZCwgJzEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbj8uc2NvcGVzWzBdLCBzY29wZXNbMF0pO1xuXG5cdFx0Y29uc3Qgc2NvcGVzMiA9IFsnYmFyJ107XG5cdFx0Y29uc3Qgc2Vzc2lvbjIgPSBhd2FpdCBleHRIb3N0QXV0aGVudGljYXRpb24uZ2V0U2Vzc2lvbihcblx0XHRcdGV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdFx0J3Rlc3QtbXVsdGlwbGUnLFxuXHRcdFx0c2NvcGVzMixcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlSWZOb25lOiB0cnVlXG5cdFx0XHR9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbjI/LmlkLCAnMicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uMj8uc2NvcGVzWzBdLCBzY29wZXMyWzBdKTtcblxuXHRcdGNvbnN0IHNob3VsZEJlU2Vzc2lvbjEgPSBhd2FpdCBleHRIb3N0QXV0aGVudGljYXRpb24uZ2V0U2Vzc2lvbihcblx0XHRcdGV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdFx0J3Rlc3QtbXVsdGlwbGUnLFxuXHRcdFx0c2NvcGVzLFxuXHRcdFx0e30pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG91bGRCZVNlc3Npb24xPy5pZCwgc2Vzc2lvbi5pZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3VsZEJlU2Vzc2lvbjE/LnNjb3Blc1swXSwgc2Vzc2lvbi5zY29wZXNbMF0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG91bGRCZVNlc3Npb24xPy5hY2Nlc3NUb2tlbiwgc2Vzc2lvbi5hY2Nlc3NUb2tlbik7XG5cblx0XHRjb25zdCBzaG91bGRCZVNlc3Npb24yID0gYXdhaXQgZXh0SG9zdEF1dGhlbnRpY2F0aW9uLmdldFNlc3Npb24oXG5cdFx0XHRleHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRcdCd0ZXN0LW11bHRpcGxlJyxcblx0XHRcdHNjb3BlczIsXG5cdFx0XHR7fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3VsZEJlU2Vzc2lvbjI/LmlkLCBzZXNzaW9uMi5pZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3VsZEJlU2Vzc2lvbjI/LnNjb3Blc1swXSwgc2Vzc2lvbjIuc2NvcGVzWzBdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvdWxkQmVTZXNzaW9uMj8uYWNjZXNzVG9rZW4sIHNlc3Npb24yLmFjY2Vzc1Rva2VuKTtcblx0fSk7XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIGVycm9yIGNhc2VzXG5cblx0dGVzdCgnY3JlYXRlSWZOb25lIGFuZCBmb3JjZU5ld1Nlc3Npb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IGV4dEhvc3RBdXRoZW50aWNhdGlvbi5nZXRTZXNzaW9uKFxuXHRcdFx0XHRleHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRcdFx0J3Rlc3QnLFxuXHRcdFx0XHRbJ2ZvbyddLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y3JlYXRlSWZOb25lOiB0cnVlLFxuXHRcdFx0XHRcdGZvcmNlTmV3U2Vzc2lvbjogdHJ1ZVxuXHRcdFx0XHR9KTtcblx0XHRcdGFzc2VydC5mYWlsKCdzaG91bGQgaGF2ZSB0aHJvd24gYW4gRXJyb3IuJyk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0YXNzZXJ0Lm9rKGUpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnZm9yY2VOZXdTZXNzaW9uIGFuZCBzaWxlbnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IGV4dEhvc3RBdXRoZW50aWNhdGlvbi5nZXRTZXNzaW9uKFxuXHRcdFx0XHRleHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRcdFx0J3Rlc3QnLFxuXHRcdFx0XHRbJ2ZvbyddLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Zm9yY2VOZXdTZXNzaW9uOiB0cnVlLFxuXHRcdFx0XHRcdHNpbGVudDogdHJ1ZVxuXHRcdFx0XHR9KTtcblx0XHRcdGFzc2VydC5mYWlsKCdzaG91bGQgaGF2ZSB0aHJvd24gYW4gRXJyb3IuJyk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0YXNzZXJ0Lm9rKGUpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnY3JlYXRlSWZOb25lIGFuZCBzaWxlbnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IGV4dEhvc3RBdXRoZW50aWNhdGlvbi5nZXRTZXNzaW9uKFxuXHRcdFx0XHRleHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRcdFx0J3Rlc3QnLFxuXHRcdFx0XHRbJ2ZvbyddLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y3JlYXRlSWZOb25lOiB0cnVlLFxuXHRcdFx0XHRcdHNpbGVudDogdHJ1ZVxuXHRcdFx0XHR9KTtcblx0XHRcdGFzc2VydC5mYWlsKCdzaG91bGQgaGF2ZSB0aHJvd24gYW4gRXJyb3IuJyk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0YXNzZXJ0Lm9rKGUpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnQ2FuIGdldCBtdWx0aXBsZSBzZXNzaW9ucyAod2l0aCBkaWZmZXJlbnQgc2NvcGVzKSBpbiBvbmUgZXh0ZW5zaW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxldCBzZXNzaW9uOiBBdXRoZW50aWNhdGlvblNlc3Npb24gfCB1bmRlZmluZWQgPSBhd2FpdCBleHRIb3N0QXV0aGVudGljYXRpb24uZ2V0U2Vzc2lvbihcblx0XHRcdGV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdFx0J3Rlc3QtbXVsdGlwbGUnLFxuXHRcdFx0Wydmb28nXSxcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlSWZOb25lOiB0cnVlXG5cdFx0XHR9KTtcblx0XHRzZXNzaW9uID0gYXdhaXQgZXh0SG9zdEF1dGhlbnRpY2F0aW9uLmdldFNlc3Npb24oXG5cdFx0XHRleHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRcdCd0ZXN0LW11bHRpcGxlJyxcblx0XHRcdFsnYmFyJ10sXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUlmTm9uZTogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24/LmlkLCAnMicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uPy5zY29wZXNbMF0sICdiYXInKTtcblxuXHRcdHNlc3Npb24gPSBhd2FpdCBleHRIb3N0QXV0aGVudGljYXRpb24uZ2V0U2Vzc2lvbihcblx0XHRcdGV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdFx0J3Rlc3QtbXVsdGlwbGUnLFxuXHRcdFx0Wydmb28nXSxcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlSWZOb25lOiBmYWxzZVxuXHRcdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24/LmlkLCAnMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uPy5zY29wZXNbMF0sICdmb28nKTtcblx0fSk7XG5cblx0dGVzdCgnQ2FuIGdldCBtdWx0aXBsZSBzZXNzaW9ucyAoZnJvbSBkaWZmZXJlbnQgcHJvdmlkZXJzKSBpbiBvbmUgZXh0ZW5zaW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxldCBzZXNzaW9uOiBBdXRoZW50aWNhdGlvblNlc3Npb24gfCB1bmRlZmluZWQgPSBhd2FpdCBleHRIb3N0QXV0aGVudGljYXRpb24uZ2V0U2Vzc2lvbihcblx0XHRcdGV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdFx0J3Rlc3QtbXVsdGlwbGUnLFxuXHRcdFx0Wydmb28nXSxcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlSWZOb25lOiB0cnVlXG5cdFx0XHR9KTtcblx0XHRzZXNzaW9uID0gYXdhaXQgZXh0SG9zdEF1dGhlbnRpY2F0aW9uLmdldFNlc3Npb24oXG5cdFx0XHRleHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRcdCd0ZXN0Jyxcblx0XHRcdFsnZm9vJ10sXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUlmTm9uZTogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24/LmlkLCAnMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uPy5zY29wZXNbMF0sICdmb28nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbj8uYWNjb3VudC5sYWJlbCwgJ3Rlc3QnKTtcblxuXHRcdGNvbnN0IHNlc3Npb24yID0gYXdhaXQgZXh0SG9zdEF1dGhlbnRpY2F0aW9uLmdldFNlc3Npb24oXG5cdFx0XHRleHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRcdCd0ZXN0LW11bHRpcGxlJyxcblx0XHRcdFsnZm9vJ10sXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUlmTm9uZTogZmFsc2Vcblx0XHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uMj8uaWQsICcxJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24yPy5zY29wZXNbMF0sICdmb28nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbjI/LmFjY291bnQubGFiZWwsICd0ZXN0LW11bHRpcGxlJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NhbiBnZXQgbXVsdGlwbGUgc2Vzc2lvbnMgKGZyb20gZGlmZmVyZW50IHByb3ZpZGVycykgaW4gb25lIGV4dGVuc2lvbiBhdCB0aGUgc2FtZSB0aW1lJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNlc3Npb25QOiBQcm9taXNlPEF1dGhlbnRpY2F0aW9uU2Vzc2lvbiB8IHVuZGVmaW5lZD4gPSBleHRIb3N0QXV0aGVudGljYXRpb24uZ2V0U2Vzc2lvbihcblx0XHRcdGV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdFx0J3Rlc3QnLFxuXHRcdFx0Wydmb28nXSxcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlSWZOb25lOiB0cnVlXG5cdFx0XHR9KTtcblx0XHRjb25zdCBzZXNzaW9uMlA6IFByb21pc2U8QXV0aGVudGljYXRpb25TZXNzaW9uIHwgdW5kZWZpbmVkPiA9IGV4dEhvc3RBdXRoZW50aWNhdGlvbi5nZXRTZXNzaW9uKFxuXHRcdFx0ZXh0ZW5zaW9uRGVzY3JpcHRpb24sXG5cdFx0XHQndGVzdC1tdWx0aXBsZScsXG5cdFx0XHRbJ2ZvbyddLFxuXHRcdFx0e1xuXHRcdFx0XHRjcmVhdGVJZk5vbmU6IHRydWVcblx0XHRcdH0pO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBhd2FpdCBzZXNzaW9uUDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbj8uaWQsICcxJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24/LnNjb3Blc1swXSwgJ2ZvbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uPy5hY2NvdW50LmxhYmVsLCAndGVzdCcpO1xuXG5cdFx0Y29uc3Qgc2Vzc2lvbjIgPSBhd2FpdCBzZXNzaW9uMlA7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24yPy5pZCwgJzEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbjI/LnNjb3Blc1swXSwgJ2ZvbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uMj8uYWNjb3VudC5sYWJlbCwgJ3Rlc3QtbXVsdGlwbGUnKTtcblx0fSk7XG5cblxuXHQvLyNlbmRyZWdpb25cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQStCLDBCQUFvRDtBQUNuRixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGdCQUFnQixtQkFBbUI7QUFDNUMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxrQ0FBa0MsOEJBQThCO0FBQ3pFLFNBQVMsbUJBQW1CLDRCQUE0Qiw0QkFBNEI7QUFDcEYsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx3QkFBd0IsdUJBQXVCLDhCQUE4QjtBQUN0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
