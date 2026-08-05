import assert from "assert";
import { TestConfigurationService } from "../../../../platform/configuration/test/common/testConfigurationService.js";
import { TestInstantiationService } from "../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { IModelService } from "../../../common/services/model.js";
import { ILanguageService } from "../../../common/languages/language.js";
import { IConfigurationService, ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { TextResourceConfigurationService } from "../../../common/services/textResourceConfigurationService.js";
import { URI } from "../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
suite("TextResourceConfigurationService - Update", () => {
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  let instantiationService;
  let configurationValue = {};
  let updateArgs;
  const configurationService = new class extends TestConfigurationService {
    inspect() {
      return configurationValue;
    }
    updateValue() {
      updateArgs = [...arguments];
      return Promise.resolve();
    }
  }();
  let language = null;
  let testObject;
  setup(() => {
    instantiationService = disposables.add(new TestInstantiationService());
    instantiationService.stub(IModelService, { getModel() {
      return null;
    } });
    instantiationService.stub(ILanguageService, { guessLanguageIdByFilepathOrFirstLine() {
      return language;
    } });
    instantiationService.stub(IConfigurationService, configurationService);
    testObject = disposables.add(instantiationService.createInstance(TextResourceConfigurationService));
  });
  test("updateValue writes without target and overrides when no language is defined", async () => {
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b");
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: void 0 }, ConfigurationTarget.USER_LOCAL]);
  });
  test("updateValue writes with target and without overrides when no language is defined", async () => {
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b", ConfigurationTarget.USER_LOCAL);
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: void 0 }, ConfigurationTarget.USER_LOCAL]);
  });
  test("updateValue writes into given memory target without overrides", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2" },
      workspaceFolder: { value: "1" }
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b", ConfigurationTarget.MEMORY);
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: void 0 }, ConfigurationTarget.MEMORY]);
  });
  test("updateValue writes into given workspace target without overrides", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2" },
      workspaceFolder: { value: "2" }
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b", ConfigurationTarget.WORKSPACE);
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: void 0 }, ConfigurationTarget.WORKSPACE]);
  });
  test("updateValue writes into given user target without overrides", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2" },
      workspaceFolder: { value: "2" }
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b", ConfigurationTarget.USER);
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: void 0 }, ConfigurationTarget.USER]);
  });
  test("updateValue writes into given workspace folder target with overrides", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2" },
      workspaceFolder: { value: "2", override: "1" },
      overrideIdentifiers: [language]
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b", ConfigurationTarget.WORKSPACE_FOLDER);
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: language }, ConfigurationTarget.WORKSPACE_FOLDER]);
  });
  test("updateValue writes into derived workspace folder target without overrides", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2" },
      workspaceFolder: { value: "2" }
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b");
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: void 0 }, ConfigurationTarget.WORKSPACE_FOLDER]);
  });
  test("updateValue writes into derived workspace folder target with overrides", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2" },
      workspace: { value: "2", override: "1" },
      workspaceFolder: { value: "2", override: "2" },
      overrideIdentifiers: [language]
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b");
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: language }, ConfigurationTarget.WORKSPACE_FOLDER]);
  });
  test("updateValue writes into derived workspace target without overrides", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2" },
      workspace: { value: "2" }
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b");
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: void 0 }, ConfigurationTarget.WORKSPACE]);
  });
  test("updateValue writes into derived workspace target with overrides", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2" },
      workspace: { value: "2", override: "2" },
      overrideIdentifiers: [language]
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b");
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: language }, ConfigurationTarget.WORKSPACE]);
  });
  test("updateValue writes into derived workspace target with overrides and value defined in folder", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1", override: "3" },
      userLocal: { value: "2" },
      workspace: { value: "2", override: "2" },
      workspaceFolder: { value: "2" },
      overrideIdentifiers: [language]
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b");
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: language }, ConfigurationTarget.WORKSPACE]);
  });
  test("updateValue writes into derived user remote target without overrides", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2" },
      userRemote: { value: "2" }
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b");
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: void 0 }, ConfigurationTarget.USER_REMOTE]);
  });
  test("updateValue writes into derived user remote target with overrides", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2" },
      userRemote: { value: "2", override: "3" },
      overrideIdentifiers: [language]
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b");
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: language }, ConfigurationTarget.USER_REMOTE]);
  });
  test("updateValue writes into derived user remote target with overrides and value defined in workspace", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2" },
      userRemote: { value: "2", override: "3" },
      workspace: { value: "3" },
      overrideIdentifiers: [language]
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b");
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: language }, ConfigurationTarget.USER_REMOTE]);
  });
  test("updateValue writes into derived user remote target with overrides and value defined in workspace folder", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2", override: "1" },
      userRemote: { value: "2", override: "3" },
      workspace: { value: "3" },
      workspaceFolder: { value: "3" },
      overrideIdentifiers: [language]
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b");
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: language }, ConfigurationTarget.USER_REMOTE]);
  });
  test("updateValue writes into derived user target without overrides", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2" }
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b");
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: void 0 }, ConfigurationTarget.USER_LOCAL]);
  });
  test("updateValue writes into derived user target with overrides", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2", override: "3" },
      overrideIdentifiers: [language]
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "2");
    assert.deepStrictEqual(updateArgs, ["a", "2", { resource, overrideIdentifier: language }, ConfigurationTarget.USER_LOCAL]);
  });
  test("updateValue writes into derived user target with overrides and value is defined in remote", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2", override: "3" },
      userRemote: { value: "3" },
      overrideIdentifiers: [language]
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "2");
    assert.deepStrictEqual(updateArgs, ["a", "2", { resource, overrideIdentifier: language }, ConfigurationTarget.USER_LOCAL]);
  });
  test("updateValue writes into derived user target with overrides and value is defined in workspace", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" },
      userLocal: { value: "2", override: "3" },
      workspaceValue: { value: "3" },
      overrideIdentifiers: [language]
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "2");
    assert.deepStrictEqual(updateArgs, ["a", "2", { resource, overrideIdentifier: language }, ConfigurationTarget.USER_LOCAL]);
  });
  test("updateValue writes into derived user target with overrides and value is defined in workspace folder", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1", override: "3" },
      userLocal: { value: "2", override: "3" },
      userRemote: { value: "3" },
      workspaceFolderValue: { value: "3" },
      overrideIdentifiers: [language]
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "2");
    assert.deepStrictEqual(updateArgs, ["a", "2", { resource, overrideIdentifier: language }, ConfigurationTarget.USER_LOCAL]);
  });
  test("updateValue writes into derived user target when overridden in default and not in user", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1", override: "3" },
      userLocal: { value: "2" },
      overrideIdentifiers: [language]
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "2");
    assert.deepStrictEqual(updateArgs, ["a", "2", { resource, overrideIdentifier: language }, ConfigurationTarget.USER_LOCAL]);
  });
  test("updateValue when not changed", async () => {
    language = "a";
    configurationValue = {
      default: { value: "1" }
    };
    const resource = URI.file("someFile");
    await testObject.updateValue(resource, "a", "b");
    assert.deepStrictEqual(updateArgs, ["a", "b", { resource, overrideIdentifier: void 0 }, ConfigurationTarget.USER_LOCAL]);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vc2VydmljZXMvdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25WYWx1ZSwgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBDb25maWd1cmF0aW9uVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cblxuc3VpdGUoJ1RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIC0gVXBkYXRlJywgKCkgPT4ge1xuXG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBjb25maWd1cmF0aW9uVmFsdWU6IElDb25maWd1cmF0aW9uVmFsdWU8YW55PiA9IHt9O1xuXHRsZXQgdXBkYXRlQXJnczogYW55W107XG5cdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IGNsYXNzIGV4dGVuZHMgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIHtcblx0XHRvdmVycmlkZSBpbnNwZWN0KCkge1xuXHRcdFx0cmV0dXJuIGNvbmZpZ3VyYXRpb25WYWx1ZTtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgdXBkYXRlVmFsdWUoKSB7XG5cdFx0XHR1cGRhdGVBcmdzID0gWy4uLmFyZ3VtZW50c107XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0fVxuXHR9KCk7XG5cdGxldCBsYW5ndWFnZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdGxldCB0ZXN0T2JqZWN0OiBUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElNb2RlbFNlcnZpY2UsIHsgZ2V0TW9kZWwoKSB7IHJldHVybiBudWxsOyB9IH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUxhbmd1YWdlU2VydmljZSwgeyBndWVzc0xhbmd1YWdlSWRCeUZpbGVwYXRoT3JGaXJzdExpbmUoKSB7IHJldHVybiBsYW5ndWFnZTsgfSB9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb25maWd1cmF0aW9uU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UpKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlVmFsdWUgd3JpdGVzIHdpdGhvdXQgdGFyZ2V0IGFuZCBvdmVycmlkZXMgd2hlbiBubyBsYW5ndWFnZSBpcyBkZWZpbmVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJ3NvbWVGaWxlJyk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZShyZXNvdXJjZSwgJ2EnLCAnYicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodXBkYXRlQXJncywgWydhJywgJ2InLCB7IHJlc291cmNlLCBvdmVycmlkZUlkZW50aWZpZXI6IHVuZGVmaW5lZCB9LCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUxdKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlVmFsdWUgd3JpdGVzIHdpdGggdGFyZ2V0IGFuZCB3aXRob3V0IG92ZXJyaWRlcyB3aGVuIG5vIGxhbmd1YWdlIGlzIGRlZmluZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZSgnc29tZUZpbGUnKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnVwZGF0ZVZhbHVlKHJlc291cmNlLCAnYScsICdiJywgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHVwZGF0ZUFyZ3MsIFsnYScsICdiJywgeyByZXNvdXJjZSwgb3ZlcnJpZGVJZGVudGlmaWVyOiB1bmRlZmluZWQgfSwgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZVZhbHVlIHdyaXRlcyBpbnRvIGdpdmVuIG1lbW9yeSB0YXJnZXQgd2l0aG91dCBvdmVycmlkZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0bGFuZ3VhZ2UgPSAnYSc7XG5cdFx0Y29uZmlndXJhdGlvblZhbHVlID0ge1xuXHRcdFx0ZGVmYXVsdDogeyB2YWx1ZTogJzEnIH0sXG5cdFx0XHR1c2VyTG9jYWw6IHsgdmFsdWU6ICcyJyB9LFxuXHRcdFx0d29ya3NwYWNlRm9sZGVyOiB7IHZhbHVlOiAnMScgfSxcblx0XHR9O1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJ3NvbWVGaWxlJyk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnVwZGF0ZVZhbHVlKHJlc291cmNlLCAnYScsICdiJywgQ29uZmlndXJhdGlvblRhcmdldC5NRU1PUlkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodXBkYXRlQXJncywgWydhJywgJ2InLCB7IHJlc291cmNlLCBvdmVycmlkZUlkZW50aWZpZXI6IHVuZGVmaW5lZCB9LCBDb25maWd1cmF0aW9uVGFyZ2V0Lk1FTU9SWV0pO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVWYWx1ZSB3cml0ZXMgaW50byBnaXZlbiB3b3Jrc3BhY2UgdGFyZ2V0IHdpdGhvdXQgb3ZlcnJpZGVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxhbmd1YWdlID0gJ2EnO1xuXHRcdGNvbmZpZ3VyYXRpb25WYWx1ZSA9IHtcblx0XHRcdGRlZmF1bHQ6IHsgdmFsdWU6ICcxJyB9LFxuXHRcdFx0dXNlckxvY2FsOiB7IHZhbHVlOiAnMicgfSxcblx0XHRcdHdvcmtzcGFjZUZvbGRlcjogeyB2YWx1ZTogJzInIH0sXG5cdFx0fTtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCdzb21lRmlsZScpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZShyZXNvdXJjZSwgJ2EnLCAnYicsIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHVwZGF0ZUFyZ3MsIFsnYScsICdiJywgeyByZXNvdXJjZSwgb3ZlcnJpZGVJZGVudGlmaWVyOiB1bmRlZmluZWQgfSwgQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0VdKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlVmFsdWUgd3JpdGVzIGludG8gZ2l2ZW4gdXNlciB0YXJnZXQgd2l0aG91dCBvdmVycmlkZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0bGFuZ3VhZ2UgPSAnYSc7XG5cdFx0Y29uZmlndXJhdGlvblZhbHVlID0ge1xuXHRcdFx0ZGVmYXVsdDogeyB2YWx1ZTogJzEnIH0sXG5cdFx0XHR1c2VyTG9jYWw6IHsgdmFsdWU6ICcyJyB9LFxuXHRcdFx0d29ya3NwYWNlRm9sZGVyOiB7IHZhbHVlOiAnMicgfSxcblx0XHR9O1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJ3NvbWVGaWxlJyk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnVwZGF0ZVZhbHVlKHJlc291cmNlLCAnYScsICdiJywgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHVwZGF0ZUFyZ3MsIFsnYScsICdiJywgeyByZXNvdXJjZSwgb3ZlcnJpZGVJZGVudGlmaWVyOiB1bmRlZmluZWQgfSwgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZVZhbHVlIHdyaXRlcyBpbnRvIGdpdmVuIHdvcmtzcGFjZSBmb2xkZXIgdGFyZ2V0IHdpdGggb3ZlcnJpZGVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxhbmd1YWdlID0gJ2EnO1xuXHRcdGNvbmZpZ3VyYXRpb25WYWx1ZSA9IHtcblx0XHRcdGRlZmF1bHQ6IHsgdmFsdWU6ICcxJyB9LFxuXHRcdFx0dXNlckxvY2FsOiB7IHZhbHVlOiAnMicgfSxcblx0XHRcdHdvcmtzcGFjZUZvbGRlcjogeyB2YWx1ZTogJzInLCBvdmVycmlkZTogJzEnIH0sXG5cdFx0XHRvdmVycmlkZUlkZW50aWZpZXJzOiBbbGFuZ3VhZ2VdXG5cdFx0fTtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCdzb21lRmlsZScpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZShyZXNvdXJjZSwgJ2EnLCAnYicsIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh1cGRhdGVBcmdzLCBbJ2EnLCAnYicsIHsgcmVzb3VyY2UsIG92ZXJyaWRlSWRlbnRpZmllcjogbGFuZ3VhZ2UgfSwgQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0VfRk9MREVSXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZVZhbHVlIHdyaXRlcyBpbnRvIGRlcml2ZWQgd29ya3NwYWNlIGZvbGRlciB0YXJnZXQgd2l0aG91dCBvdmVycmlkZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0bGFuZ3VhZ2UgPSAnYSc7XG5cdFx0Y29uZmlndXJhdGlvblZhbHVlID0ge1xuXHRcdFx0ZGVmYXVsdDogeyB2YWx1ZTogJzEnIH0sXG5cdFx0XHR1c2VyTG9jYWw6IHsgdmFsdWU6ICcyJyB9LFxuXHRcdFx0d29ya3NwYWNlRm9sZGVyOiB7IHZhbHVlOiAnMicgfSxcblx0XHR9O1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJ3NvbWVGaWxlJyk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnVwZGF0ZVZhbHVlKHJlc291cmNlLCAnYScsICdiJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh1cGRhdGVBcmdzLCBbJ2EnLCAnYicsIHsgcmVzb3VyY2UsIG92ZXJyaWRlSWRlbnRpZmllcjogdW5kZWZpbmVkIH0sIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUl0pO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVWYWx1ZSB3cml0ZXMgaW50byBkZXJpdmVkIHdvcmtzcGFjZSBmb2xkZXIgdGFyZ2V0IHdpdGggb3ZlcnJpZGVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxhbmd1YWdlID0gJ2EnO1xuXHRcdGNvbmZpZ3VyYXRpb25WYWx1ZSA9IHtcblx0XHRcdGRlZmF1bHQ6IHsgdmFsdWU6ICcxJyB9LFxuXHRcdFx0dXNlckxvY2FsOiB7IHZhbHVlOiAnMicgfSxcblx0XHRcdHdvcmtzcGFjZTogeyB2YWx1ZTogJzInLCBvdmVycmlkZTogJzEnIH0sXG5cdFx0XHR3b3Jrc3BhY2VGb2xkZXI6IHsgdmFsdWU6ICcyJywgb3ZlcnJpZGU6ICcyJyB9LFxuXHRcdFx0b3ZlcnJpZGVJZGVudGlmaWVyczogW2xhbmd1YWdlXVxuXHRcdH07XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZSgnc29tZUZpbGUnKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3QudXBkYXRlVmFsdWUocmVzb3VyY2UsICdhJywgJ2InKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHVwZGF0ZUFyZ3MsIFsnYScsICdiJywgeyByZXNvdXJjZSwgb3ZlcnJpZGVJZGVudGlmaWVyOiBsYW5ndWFnZSB9LCBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVJdKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlVmFsdWUgd3JpdGVzIGludG8gZGVyaXZlZCB3b3Jrc3BhY2UgdGFyZ2V0IHdpdGhvdXQgb3ZlcnJpZGVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxhbmd1YWdlID0gJ2EnO1xuXHRcdGNvbmZpZ3VyYXRpb25WYWx1ZSA9IHtcblx0XHRcdGRlZmF1bHQ6IHsgdmFsdWU6ICcxJyB9LFxuXHRcdFx0dXNlckxvY2FsOiB7IHZhbHVlOiAnMicgfSxcblx0XHRcdHdvcmtzcGFjZTogeyB2YWx1ZTogJzInIH0sXG5cdFx0fTtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCdzb21lRmlsZScpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZShyZXNvdXJjZSwgJ2EnLCAnYicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodXBkYXRlQXJncywgWydhJywgJ2InLCB7IHJlc291cmNlLCBvdmVycmlkZUlkZW50aWZpZXI6IHVuZGVmaW5lZCB9LCBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV0pO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVWYWx1ZSB3cml0ZXMgaW50byBkZXJpdmVkIHdvcmtzcGFjZSB0YXJnZXQgd2l0aCBvdmVycmlkZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0bGFuZ3VhZ2UgPSAnYSc7XG5cdFx0Y29uZmlndXJhdGlvblZhbHVlID0ge1xuXHRcdFx0ZGVmYXVsdDogeyB2YWx1ZTogJzEnIH0sXG5cdFx0XHR1c2VyTG9jYWw6IHsgdmFsdWU6ICcyJyB9LFxuXHRcdFx0d29ya3NwYWNlOiB7IHZhbHVlOiAnMicsIG92ZXJyaWRlOiAnMicgfSxcblx0XHRcdG92ZXJyaWRlSWRlbnRpZmllcnM6IFtsYW5ndWFnZV1cblx0XHR9O1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJ3NvbWVGaWxlJyk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnVwZGF0ZVZhbHVlKHJlc291cmNlLCAnYScsICdiJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh1cGRhdGVBcmdzLCBbJ2EnLCAnYicsIHsgcmVzb3VyY2UsIG92ZXJyaWRlSWRlbnRpZmllcjogbGFuZ3VhZ2UgfSwgQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0VdKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlVmFsdWUgd3JpdGVzIGludG8gZGVyaXZlZCB3b3Jrc3BhY2UgdGFyZ2V0IHdpdGggb3ZlcnJpZGVzIGFuZCB2YWx1ZSBkZWZpbmVkIGluIGZvbGRlcicsIGFzeW5jICgpID0+IHtcblx0XHRsYW5ndWFnZSA9ICdhJztcblx0XHRjb25maWd1cmF0aW9uVmFsdWUgPSB7XG5cdFx0XHRkZWZhdWx0OiB7IHZhbHVlOiAnMScsIG92ZXJyaWRlOiAnMycgfSxcblx0XHRcdHVzZXJMb2NhbDogeyB2YWx1ZTogJzInIH0sXG5cdFx0XHR3b3Jrc3BhY2U6IHsgdmFsdWU6ICcyJywgb3ZlcnJpZGU6ICcyJyB9LFxuXHRcdFx0d29ya3NwYWNlRm9sZGVyOiB7IHZhbHVlOiAnMicgfSxcblx0XHRcdG92ZXJyaWRlSWRlbnRpZmllcnM6IFtsYW5ndWFnZV1cblx0XHR9O1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJ3NvbWVGaWxlJyk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnVwZGF0ZVZhbHVlKHJlc291cmNlLCAnYScsICdiJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh1cGRhdGVBcmdzLCBbJ2EnLCAnYicsIHsgcmVzb3VyY2UsIG92ZXJyaWRlSWRlbnRpZmllcjogbGFuZ3VhZ2UgfSwgQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0VdKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlVmFsdWUgd3JpdGVzIGludG8gZGVyaXZlZCB1c2VyIHJlbW90ZSB0YXJnZXQgd2l0aG91dCBvdmVycmlkZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0bGFuZ3VhZ2UgPSAnYSc7XG5cdFx0Y29uZmlndXJhdGlvblZhbHVlID0ge1xuXHRcdFx0ZGVmYXVsdDogeyB2YWx1ZTogJzEnIH0sXG5cdFx0XHR1c2VyTG9jYWw6IHsgdmFsdWU6ICcyJyB9LFxuXHRcdFx0dXNlclJlbW90ZTogeyB2YWx1ZTogJzInIH0sXG5cdFx0fTtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCdzb21lRmlsZScpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZShyZXNvdXJjZSwgJ2EnLCAnYicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodXBkYXRlQXJncywgWydhJywgJ2InLCB7IHJlc291cmNlLCBvdmVycmlkZUlkZW50aWZpZXI6IHVuZGVmaW5lZCB9LCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfUkVNT1RFXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZVZhbHVlIHdyaXRlcyBpbnRvIGRlcml2ZWQgdXNlciByZW1vdGUgdGFyZ2V0IHdpdGggb3ZlcnJpZGVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxhbmd1YWdlID0gJ2EnO1xuXHRcdGNvbmZpZ3VyYXRpb25WYWx1ZSA9IHtcblx0XHRcdGRlZmF1bHQ6IHsgdmFsdWU6ICcxJyB9LFxuXHRcdFx0dXNlckxvY2FsOiB7IHZhbHVlOiAnMicgfSxcblx0XHRcdHVzZXJSZW1vdGU6IHsgdmFsdWU6ICcyJywgb3ZlcnJpZGU6ICczJyB9LFxuXHRcdFx0b3ZlcnJpZGVJZGVudGlmaWVyczogW2xhbmd1YWdlXVxuXHRcdH07XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZSgnc29tZUZpbGUnKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3QudXBkYXRlVmFsdWUocmVzb3VyY2UsICdhJywgJ2InKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHVwZGF0ZUFyZ3MsIFsnYScsICdiJywgeyByZXNvdXJjZSwgb3ZlcnJpZGVJZGVudGlmaWVyOiBsYW5ndWFnZSB9LCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfUkVNT1RFXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZVZhbHVlIHdyaXRlcyBpbnRvIGRlcml2ZWQgdXNlciByZW1vdGUgdGFyZ2V0IHdpdGggb3ZlcnJpZGVzIGFuZCB2YWx1ZSBkZWZpbmVkIGluIHdvcmtzcGFjZScsIGFzeW5jICgpID0+IHtcblx0XHRsYW5ndWFnZSA9ICdhJztcblx0XHRjb25maWd1cmF0aW9uVmFsdWUgPSB7XG5cdFx0XHRkZWZhdWx0OiB7IHZhbHVlOiAnMScgfSxcblx0XHRcdHVzZXJMb2NhbDogeyB2YWx1ZTogJzInIH0sXG5cdFx0XHR1c2VyUmVtb3RlOiB7IHZhbHVlOiAnMicsIG92ZXJyaWRlOiAnMycgfSxcblx0XHRcdHdvcmtzcGFjZTogeyB2YWx1ZTogJzMnIH0sXG5cdFx0XHRvdmVycmlkZUlkZW50aWZpZXJzOiBbbGFuZ3VhZ2VdXG5cdFx0fTtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCdzb21lRmlsZScpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZShyZXNvdXJjZSwgJ2EnLCAnYicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodXBkYXRlQXJncywgWydhJywgJ2InLCB7IHJlc291cmNlLCBvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlIH0sIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9SRU1PVEVdKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlVmFsdWUgd3JpdGVzIGludG8gZGVyaXZlZCB1c2VyIHJlbW90ZSB0YXJnZXQgd2l0aCBvdmVycmlkZXMgYW5kIHZhbHVlIGRlZmluZWQgaW4gd29ya3NwYWNlIGZvbGRlcicsIGFzeW5jICgpID0+IHtcblx0XHRsYW5ndWFnZSA9ICdhJztcblx0XHRjb25maWd1cmF0aW9uVmFsdWUgPSB7XG5cdFx0XHRkZWZhdWx0OiB7IHZhbHVlOiAnMScgfSxcblx0XHRcdHVzZXJMb2NhbDogeyB2YWx1ZTogJzInLCBvdmVycmlkZTogJzEnIH0sXG5cdFx0XHR1c2VyUmVtb3RlOiB7IHZhbHVlOiAnMicsIG92ZXJyaWRlOiAnMycgfSxcblx0XHRcdHdvcmtzcGFjZTogeyB2YWx1ZTogJzMnIH0sXG5cdFx0XHR3b3Jrc3BhY2VGb2xkZXI6IHsgdmFsdWU6ICczJyB9LFxuXHRcdFx0b3ZlcnJpZGVJZGVudGlmaWVyczogW2xhbmd1YWdlXVxuXHRcdH07XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZSgnc29tZUZpbGUnKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3QudXBkYXRlVmFsdWUocmVzb3VyY2UsICdhJywgJ2InKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHVwZGF0ZUFyZ3MsIFsnYScsICdiJywgeyByZXNvdXJjZSwgb3ZlcnJpZGVJZGVudGlmaWVyOiBsYW5ndWFnZSB9LCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfUkVNT1RFXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZVZhbHVlIHdyaXRlcyBpbnRvIGRlcml2ZWQgdXNlciB0YXJnZXQgd2l0aG91dCBvdmVycmlkZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0bGFuZ3VhZ2UgPSAnYSc7XG5cdFx0Y29uZmlndXJhdGlvblZhbHVlID0ge1xuXHRcdFx0ZGVmYXVsdDogeyB2YWx1ZTogJzEnIH0sXG5cdFx0XHR1c2VyTG9jYWw6IHsgdmFsdWU6ICcyJyB9LFxuXHRcdH07XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZSgnc29tZUZpbGUnKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3QudXBkYXRlVmFsdWUocmVzb3VyY2UsICdhJywgJ2InKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHVwZGF0ZUFyZ3MsIFsnYScsICdiJywgeyByZXNvdXJjZSwgb3ZlcnJpZGVJZGVudGlmaWVyOiB1bmRlZmluZWQgfSwgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZVZhbHVlIHdyaXRlcyBpbnRvIGRlcml2ZWQgdXNlciB0YXJnZXQgd2l0aCBvdmVycmlkZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0bGFuZ3VhZ2UgPSAnYSc7XG5cdFx0Y29uZmlndXJhdGlvblZhbHVlID0ge1xuXHRcdFx0ZGVmYXVsdDogeyB2YWx1ZTogJzEnIH0sXG5cdFx0XHR1c2VyTG9jYWw6IHsgdmFsdWU6ICcyJywgb3ZlcnJpZGU6ICczJyB9LFxuXHRcdFx0b3ZlcnJpZGVJZGVudGlmaWVyczogW2xhbmd1YWdlXVxuXHRcdH07XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZSgnc29tZUZpbGUnKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3QudXBkYXRlVmFsdWUocmVzb3VyY2UsICdhJywgJzInKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHVwZGF0ZUFyZ3MsIFsnYScsICcyJywgeyByZXNvdXJjZSwgb3ZlcnJpZGVJZGVudGlmaWVyOiBsYW5ndWFnZSB9LCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUxdKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlVmFsdWUgd3JpdGVzIGludG8gZGVyaXZlZCB1c2VyIHRhcmdldCB3aXRoIG92ZXJyaWRlcyBhbmQgdmFsdWUgaXMgZGVmaW5lZCBpbiByZW1vdGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0bGFuZ3VhZ2UgPSAnYSc7XG5cdFx0Y29uZmlndXJhdGlvblZhbHVlID0ge1xuXHRcdFx0ZGVmYXVsdDogeyB2YWx1ZTogJzEnIH0sXG5cdFx0XHR1c2VyTG9jYWw6IHsgdmFsdWU6ICcyJywgb3ZlcnJpZGU6ICczJyB9LFxuXHRcdFx0dXNlclJlbW90ZTogeyB2YWx1ZTogJzMnIH0sXG5cdFx0XHRvdmVycmlkZUlkZW50aWZpZXJzOiBbbGFuZ3VhZ2VdXG5cdFx0fTtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCdzb21lRmlsZScpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZShyZXNvdXJjZSwgJ2EnLCAnMicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodXBkYXRlQXJncywgWydhJywgJzInLCB7IHJlc291cmNlLCBvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlIH0sIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTF0pO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVWYWx1ZSB3cml0ZXMgaW50byBkZXJpdmVkIHVzZXIgdGFyZ2V0IHdpdGggb3ZlcnJpZGVzIGFuZCB2YWx1ZSBpcyBkZWZpbmVkIGluIHdvcmtzcGFjZScsIGFzeW5jICgpID0+IHtcblx0XHRsYW5ndWFnZSA9ICdhJztcblx0XHRjb25maWd1cmF0aW9uVmFsdWUgPSB7XG5cdFx0XHRkZWZhdWx0OiB7IHZhbHVlOiAnMScgfSxcblx0XHRcdHVzZXJMb2NhbDogeyB2YWx1ZTogJzInLCBvdmVycmlkZTogJzMnIH0sXG5cdFx0XHR3b3Jrc3BhY2VWYWx1ZTogeyB2YWx1ZTogJzMnIH0sXG5cdFx0XHRvdmVycmlkZUlkZW50aWZpZXJzOiBbbGFuZ3VhZ2VdXG5cdFx0fTtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCdzb21lRmlsZScpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZShyZXNvdXJjZSwgJ2EnLCAnMicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodXBkYXRlQXJncywgWydhJywgJzInLCB7IHJlc291cmNlLCBvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlIH0sIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTF0pO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVWYWx1ZSB3cml0ZXMgaW50byBkZXJpdmVkIHVzZXIgdGFyZ2V0IHdpdGggb3ZlcnJpZGVzIGFuZCB2YWx1ZSBpcyBkZWZpbmVkIGluIHdvcmtzcGFjZSBmb2xkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0bGFuZ3VhZ2UgPSAnYSc7XG5cdFx0Y29uZmlndXJhdGlvblZhbHVlID0ge1xuXHRcdFx0ZGVmYXVsdDogeyB2YWx1ZTogJzEnLCBvdmVycmlkZTogJzMnIH0sXG5cdFx0XHR1c2VyTG9jYWw6IHsgdmFsdWU6ICcyJywgb3ZlcnJpZGU6ICczJyB9LFxuXHRcdFx0dXNlclJlbW90ZTogeyB2YWx1ZTogJzMnIH0sXG5cdFx0XHR3b3Jrc3BhY2VGb2xkZXJWYWx1ZTogeyB2YWx1ZTogJzMnIH0sXG5cdFx0XHRvdmVycmlkZUlkZW50aWZpZXJzOiBbbGFuZ3VhZ2VdXG5cdFx0fTtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCdzb21lRmlsZScpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZShyZXNvdXJjZSwgJ2EnLCAnMicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodXBkYXRlQXJncywgWydhJywgJzInLCB7IHJlc291cmNlLCBvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlIH0sIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTF0pO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVWYWx1ZSB3cml0ZXMgaW50byBkZXJpdmVkIHVzZXIgdGFyZ2V0IHdoZW4gb3ZlcnJpZGRlbiBpbiBkZWZhdWx0IGFuZCBub3QgaW4gdXNlcicsIGFzeW5jICgpID0+IHtcblx0XHRsYW5ndWFnZSA9ICdhJztcblx0XHRjb25maWd1cmF0aW9uVmFsdWUgPSB7XG5cdFx0XHRkZWZhdWx0OiB7IHZhbHVlOiAnMScsIG92ZXJyaWRlOiAnMycgfSxcblx0XHRcdHVzZXJMb2NhbDogeyB2YWx1ZTogJzInIH0sXG5cdFx0XHRvdmVycmlkZUlkZW50aWZpZXJzOiBbbGFuZ3VhZ2VdXG5cdFx0fTtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCdzb21lRmlsZScpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZShyZXNvdXJjZSwgJ2EnLCAnMicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodXBkYXRlQXJncywgWydhJywgJzInLCB7IHJlc291cmNlLCBvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlIH0sIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTF0pO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVWYWx1ZSB3aGVuIG5vdCBjaGFuZ2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxhbmd1YWdlID0gJ2EnO1xuXHRcdGNvbmZpZ3VyYXRpb25WYWx1ZSA9IHtcblx0XHRcdGRlZmF1bHQ6IHsgdmFsdWU6ICcxJyB9LFxuXHRcdH07XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZSgnc29tZUZpbGUnKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3QudXBkYXRlVmFsdWUocmVzb3VyY2UsICdhJywgJ2InKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHVwZGF0ZUFyZ3MsIFsnYScsICdiJywgeyByZXNvdXJjZSwgb3ZlcnJpZGVJZGVudGlmaWVyOiB1bmRlZmluZWQgfSwgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMXSk7XG5cdH0pO1xuXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHdCQUF3QjtBQUNqQyxTQUE4Qix1QkFBdUIsMkJBQTJCO0FBQ2hGLFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMsV0FBVztBQUNwQixTQUFTLCtDQUErQztBQUd4RCxNQUFNLDZDQUE2QyxNQUFNO0FBRXhELFFBQU0sY0FBYyx3Q0FBd0M7QUFFNUQsTUFBSTtBQUNKLE1BQUkscUJBQStDLENBQUM7QUFDcEQsTUFBSTtBQUNKLFFBQU0sdUJBQXVCLElBQUksY0FBYyx5QkFBeUI7QUFBQSxJQUM5RCxVQUFVO0FBQ2xCLGFBQU87QUFBQSxJQUNSO0FBQUEsSUFDUyxjQUFjO0FBQ3RCLG1CQUFhLENBQUMs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
