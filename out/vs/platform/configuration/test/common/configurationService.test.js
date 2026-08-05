import assert from "assert";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Event } from "../../../../base/common/event.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { runWithFakedTimers } from "../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { ConfigurationTarget, isConfigured } from "../../common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../common/configurationRegistry.js";
import { ConfigurationService } from "../../common/configurationService.js";
import { FileService } from "../../../files/common/fileService.js";
import { InMemoryFileSystemProvider } from "../../../files/common/inMemoryFilesystemProvider.js";
import { NullLogService } from "../../../log/common/log.js";
import { FilePolicyService } from "../../../policy/common/filePolicyService.js";
import { NullPolicyService } from "../../../policy/common/policy.js";
import { Registry } from "../../../registry/common/platform.js";
suite("ConfigurationService.test.ts", () => {
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  let fileService;
  let settingsResource;
  setup(async () => {
    fileService = disposables.add(new FileService(new NullLogService()));
    const diskFileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
    disposables.add(fileService.registerProvider(Schemas.file, diskFileSystemProvider));
    settingsResource = URI.file("settings.json");
  });
  test("simple", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "foo": "bar" }'));
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    const config = testObject.getValue();
    assert.ok(config);
    assert.strictEqual(config.foo, "bar");
  }));
  test("config gets flattened", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "testworkbench.editor.tabs": true }'));
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    const config = testObject.getValue();
    assert.ok(config);
    assert.ok(config.testworkbench);
    assert.ok(config.testworkbench.editor);
    assert.strictEqual(config.testworkbench.editor.tabs, true);
  }));
  test("error case does not explode", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    await fileService.writeFile(settingsResource, VSBuffer.fromString(",,,,"));
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    const config = testObject.getValue();
    assert.ok(config);
  }));
  test("missing file does not explode", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const testObject = disposables.add(new ConfigurationService(URI.file("__testFile"), fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    const config = testObject.getValue();
    assert.ok(config);
  }));
  test("trigger configuration change event when file does not exist", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    return new Promise((c, e) => {
      disposables.add(Event.filter(testObject.onDidChangeConfiguration, (e2) => e2.source === ConfigurationTarget.USER)(() => {
        assert.strictEqual(testObject.getValue("foo"), "bar");
        c();
      }));
      fileService.writeFile(settingsResource, VSBuffer.fromString('{ "foo": "bar" }')).catch(e);
    });
  }));
  test("trigger configuration change event when file exists", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "foo": "bar" }'));
    await testObject.initialize();
    return new Promise((c) => {
      disposables.add(Event.filter(testObject.onDidChangeConfiguration, (e) => e.source === ConfigurationTarget.USER)(async (e) => {
        assert.strictEqual(testObject.getValue("foo"), "barz");
        c();
      }));
      fileService.writeFile(settingsResource, VSBuffer.fromString('{ "foo": "barz" }'));
    });
  }));
  test("reloadConfiguration", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "foo": "bar" }'));
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    let config = testObject.getValue();
    assert.ok(config);
    assert.strictEqual(config.foo, "bar");
    await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "foo": "changed" }'));
    await testObject.reloadConfiguration();
    config = testObject.getValue();
    assert.ok(config);
    assert.strictEqual(config.foo, "changed");
  }));
  test("model defaults", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
    configurationRegistry.registerConfiguration({
      "id": "_test",
      "type": "object",
      "properties": {
        "configuration.service.testSetting": {
          "type": "string",
          "default": "isSet"
        }
      }
    });
    let testObject = disposables.add(new ConfigurationService(URI.file("__testFile"), fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    let setting = testObject.getValue();
    assert.ok(setting);
    assert.strictEqual(setting.configuration.service.testSetting, "isSet");
    await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "testworkbench.editor.tabs": true }'));
    testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    setting = testObject.getValue();
    assert.ok(setting);
    assert.strictEqual(setting.configuration.service.testSetting, "isSet");
    await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "configuration.service.testSetting": "isChanged" }'));
    await testObject.reloadConfiguration();
    setting = testObject.getValue();
    assert.ok(setting);
    assert.strictEqual(setting.configuration.service.testSetting, "isChanged");
  }));
  test("lookup", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
    configurationRegistry.registerConfiguration({
      "id": "_test",
      "type": "object",
      "properties": {
        "lookup.service.testSetting": {
          "type": "string",
          "default": "isSet"
        }
      }
    });
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    let res = testObject.inspect("something.missing");
    assert.strictEqual(res.value, void 0);
    assert.strictEqual(res.defaultValue, void 0);
    assert.strictEqual(res.userValue, void 0);
    assert.strictEqual(isConfigured(res), false);
    res = testObject.inspect("lookup.service.testSetting");
    assert.strictEqual(res.defaultValue, "isSet");
    assert.strictEqual(res.value, "isSet");
    assert.strictEqual(res.userValue, void 0);
    assert.strictEqual(isConfigured(res), false);
    await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "lookup.service.testSetting": "bar" }'));
    await testObject.reloadConfiguration();
    res = testObject.inspect("lookup.service.testSetting");
    assert.strictEqual(res.defaultValue, "isSet");
    assert.strictEqual(res.userValue, "bar");
    assert.strictEqual(res.value, "bar");
    assert.strictEqual(isConfigured(res), true);
  }));
  test("lookup with null", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
    configurationRegistry.registerConfiguration({
      "id": "_testNull",
      "type": "object",
      "properties": {
        "lookup.service.testNullSetting": {
          "type": "null"
        }
      }
    });
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    let res = testObject.inspect("lookup.service.testNullSetting");
    assert.strictEqual(res.defaultValue, null);
    assert.strictEqual(res.value, null);
    assert.strictEqual(res.userValue, void 0);
    await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "lookup.service.testNullSetting": null }'));
    await testObject.reloadConfiguration();
    res = testObject.inspect("lookup.service.testNullSetting");
    assert.strictEqual(res.defaultValue, null);
    assert.strictEqual(res.value, null);
    assert.strictEqual(res.userValue, null);
  }));
  test("update configuration", async () => {
    const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
    configurationRegistry.registerConfiguration({
      "id": "_test",
      "type": "object",
      "properties": {
        "configurationService.testSetting": {
          "type": "string",
          "default": "isSet"
        }
      }
    });
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    await testObject.updateValue("configurationService.testSetting", "value");
    assert.strictEqual(testObject.getValue("configurationService.testSetting"), "value");
  });
  test("update configuration when exist", async () => {
    const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
    configurationRegistry.registerConfiguration({
      "id": "_test",
      "type": "object",
      "properties": {
        "configurationService.testSetting": {
          "type": "string",
          "default": "isSet"
        }
      }
    });
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    await testObject.updateValue("configurationService.testSetting", "value");
    await testObject.updateValue("configurationService.testSetting", "updatedValue");
    assert.strictEqual(testObject.getValue("configurationService.testSetting"), "updatedValue");
  });
  test("update configuration to default value should remove", async () => {
    const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
    configurationRegistry.registerConfiguration({
      "id": "_test",
      "type": "object",
      "properties": {
        "configurationService.testSetting": {
          "type": "string",
          "default": "isSet"
        }
      }
    });
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    await testObject.updateValue("configurationService.testSetting", "value");
    await testObject.updateValue("configurationService.testSetting", "isSet");
    const inspect = testObject.inspect("configurationService.testSetting");
    assert.strictEqual(inspect.userValue, void 0);
  });
  test("update configuration should remove when undefined is passed", async () => {
    const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
    configurationRegistry.registerConfiguration({
      "id": "_test",
      "type": "object",
      "properties": {
        "configurationService.testSetting": {
          "type": "string",
          "default": "isSet"
        }
      }
    });
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    await testObject.updateValue("configurationService.testSetting", "value");
    await testObject.updateValue("configurationService.testSetting", void 0);
    const inspect = testObject.inspect("configurationService.testSetting");
    assert.strictEqual(inspect.userValue, void 0);
  });
  test("update unknown configuration", async () => {
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    await testObject.updateValue("configurationService.unknownSetting", "value");
    assert.strictEqual(testObject.getValue("configurationService.unknownSetting"), "value");
  });
  test("update configuration in non user target throws error", async () => {
    const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
    configurationRegistry.registerConfiguration({
      "id": "_test",
      "type": "object",
      "properties": {
        "configurationService.testSetting": {
          "type": "string",
          "default": "isSet"
        }
      }
    });
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
    await testObject.initialize();
    try {
      await testObject.updateValue("configurationService.testSetting", "value", ConfigurationTarget.WORKSPACE);
      assert.fail("Should fail with error");
    } catch (e) {
    }
  });
  test("update configuration throws error for policy setting", async () => {
    const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
    configurationRegistry.registerConfiguration({
      "id": "_test",
      "type": "object",
      "properties": {
        "configurationService.policySetting": {
          "type": "string",
          "default": "isSet",
          policy: {
            name: "configurationService.policySetting",
            minimumVersion: "1.0.0"
          }
        }
      }
    });
    const logService = new NullLogService();
    const policyFile = URI.file("policies.json");
    await fileService.writeFile(policyFile, VSBuffer.fromString('{ "configurationService.policySetting": "policyValue" }'));
    const policyService = disposables.add(new FilePolicyService(policyFile, fileService, logService));
    const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, policyService, logService));
    await testObject.initialize();
    try {
      await testObject.updateValue("configurationService.policySetting", "value");
      assert.fail("Should throw error");
    } catch (error) {
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBydW5XaXRoRmFrZWRUaW1lcnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3RpbWVUcmF2ZWxTY2hlZHVsZXIuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0LCBpc0NvbmZpZ3VyZWQgfSBmcm9tICcuLi8uLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLCBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9maWxlcy9jb21tb24vZmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi9maWxlcy9jb21tb24vaW5NZW1vcnlGaWxlc3lzdGVtUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBGaWxlUG9saWN5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BvbGljeS9jb21tb24vZmlsZVBvbGljeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTnVsbFBvbGljeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wb2xpY3kvY29tbW9uL3BvbGljeS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5cbnN1aXRlKCdDb25maWd1cmF0aW9uU2VydmljZS50ZXN0LnRzJywgKCkgPT4ge1xuXG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2U7XG5cdGxldCBzZXR0aW5nc1Jlc291cmNlOiBVUkk7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGZpbGVTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaWxlU2VydmljZShuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHRcdGNvbnN0IGRpc2tGaWxlU3lzdGVtUHJvdmlkZXIgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyKCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChmaWxlU2VydmljZS5yZWdpc3RlclByb3ZpZGVyKFNjaGVtYXMuZmlsZSwgZGlza0ZpbGVTeXN0ZW1Qcm92aWRlcikpO1xuXHRcdHNldHRpbmdzUmVzb3VyY2UgPSBVUkkuZmlsZSgnc2V0dGluZ3MuanNvbicpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW1wbGUnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUoc2V0dGluZ3NSZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZygneyBcImZvb1wiOiBcImJhclwiIH0nKSk7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQ29uZmlndXJhdGlvblNlcnZpY2Uoc2V0dGluZ3NSZXNvdXJjZSwgZmlsZVNlcnZpY2UsIG5ldyBOdWxsUG9saWN5U2VydmljZSgpLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuaW5pdGlhbGl6ZSgpO1xuXHRcdGNvbnN0IGNvbmZpZyA9IHRlc3RPYmplY3QuZ2V0VmFsdWU8e1xuXHRcdFx0Zm9vOiBzdHJpbmc7XG5cdFx0fT4oKTtcblxuXHRcdGFzc2VydC5vayhjb25maWcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb25maWcuZm9vLCAnYmFyJyk7XG5cdH0pKTtcblxuXHR0ZXN0KCdjb25maWcgZ2V0cyBmbGF0dGVuZWQnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUoc2V0dGluZ3NSZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZygneyBcInRlc3R3b3JrYmVuY2guZWRpdG9yLnRhYnNcIjogdHJ1ZSB9JykpO1xuXG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQ29uZmlndXJhdGlvblNlcnZpY2Uoc2V0dGluZ3NSZXNvdXJjZSwgZmlsZVNlcnZpY2UsIG5ldyBOdWxsUG9saWN5U2VydmljZSgpLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuaW5pdGlhbGl6ZSgpO1xuXHRcdGNvbnN0IGNvbmZpZyA9IHRlc3RPYmplY3QuZ2V0VmFsdWU8e1xuXHRcdFx0dGVzdHdvcmtiZW5jaDoge1xuXHRcdFx0XHRlZGl0b3I6IHtcblx0XHRcdFx0XHR0YWJzOiBib29sZWFuO1xuXHRcdFx0XHR9O1xuXHRcdFx0fTtcblx0XHR9PigpO1xuXG5cdFx0YXNzZXJ0Lm9rKGNvbmZpZyk7XG5cdFx0YXNzZXJ0Lm9rKGNvbmZpZy50ZXN0d29ya2JlbmNoKTtcblx0XHRhc3NlcnQub2soY29uZmlnLnRlc3R3b3JrYmVuY2guZWRpdG9yKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29uZmlnLnRlc3R3b3JrYmVuY2guZWRpdG9yLnRhYnMsIHRydWUpO1xuXHR9KSk7XG5cblx0dGVzdCgnZXJyb3IgY2FzZSBkb2VzIG5vdCBleHBsb2RlJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHNldHRpbmdzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoJywsLCwnKSk7XG5cblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBDb25maWd1cmF0aW9uU2VydmljZShzZXR0aW5nc1Jlc291cmNlLCBmaWxlU2VydmljZSwgbmV3IE51bGxQb2xpY3lTZXJ2aWNlKCksIG5ldyBOdWxsTG9nU2VydmljZSgpKSk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5pbml0aWFsaXplKCk7XG5cdFx0Y29uc3QgY29uZmlnID0gdGVzdE9iamVjdC5nZXRWYWx1ZTx7XG5cdFx0XHRmb286IHN0cmluZztcblx0XHR9PigpO1xuXG5cdFx0YXNzZXJ0Lm9rKGNvbmZpZyk7XG5cdH0pKTtcblxuXHR0ZXN0KCdtaXNzaW5nIGZpbGUgZG9lcyBub3QgZXhwbG9kZScsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlcy5hZGQobmV3IENvbmZpZ3VyYXRpb25TZXJ2aWNlKFVSSS5maWxlKCdfX3Rlc3RGaWxlJyksIGZpbGVTZXJ2aWNlLCBuZXcgTnVsbFBvbGljeVNlcnZpY2UoKSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmluaXRpYWxpemUoKTtcblxuXHRcdGNvbnN0IGNvbmZpZyA9IHRlc3RPYmplY3QuZ2V0VmFsdWU8eyBmb286IHN0cmluZyB9PigpO1xuXG5cdFx0YXNzZXJ0Lm9rKGNvbmZpZyk7XG5cdH0pKTtcblxuXHR0ZXN0KCd0cmlnZ2VyIGNvbmZpZ3VyYXRpb24gY2hhbmdlIGV2ZW50IHdoZW4gZmlsZSBkb2VzIG5vdCBleGlzdCcsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlcy5hZGQobmV3IENvbmZpZ3VyYXRpb25TZXJ2aWNlKHNldHRpbmdzUmVzb3VyY2UsIGZpbGVTZXJ2aWNlLCBuZXcgTnVsbFBvbGljeVNlcnZpY2UoKSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmluaXRpYWxpemUoKTtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKGMsIGUpID0+IHtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChFdmVudC5maWx0ZXIodGVzdE9iamVjdC5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24sIGUgPT4gZS5zb3VyY2UgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUikoKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5nZXRWYWx1ZSgnZm9vJyksICdiYXInKTtcblx0XHRcdFx0YygpO1xuXHRcdFx0fSkpO1xuXHRcdFx0ZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHNldHRpbmdzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoJ3sgXCJmb29cIjogXCJiYXJcIiB9JykpLmNhdGNoKGUpO1xuXHRcdH0pO1xuXG5cdH0pKTtcblxuXHR0ZXN0KCd0cmlnZ2VyIGNvbmZpZ3VyYXRpb24gY2hhbmdlIGV2ZW50IHdoZW4gZmlsZSBleGlzdHMnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBDb25maWd1cmF0aW9uU2VydmljZShzZXR0aW5nc1Jlc291cmNlLCBmaWxlU2VydmljZSwgbmV3IE51bGxQb2xpY3lTZXJ2aWNlKCksIG5ldyBOdWxsTG9nU2VydmljZSgpKSk7XG5cdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHNldHRpbmdzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoJ3sgXCJmb29cIjogXCJiYXJcIiB9JykpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuaW5pdGlhbGl6ZSgpO1xuXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChjKSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoRXZlbnQuZmlsdGVyKHRlc3RPYmplY3Qub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLCBlID0+IGUuc291cmNlID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVIpKGFzeW5jIChlKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmdldFZhbHVlKCdmb28nKSwgJ2JhcnonKTtcblx0XHRcdFx0YygpO1xuXHRcdFx0fSkpO1xuXHRcdFx0ZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHNldHRpbmdzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoJ3sgXCJmb29cIjogXCJiYXJ6XCIgfScpKTtcblx0XHR9KTtcblx0fSkpO1xuXG5cdHRlc3QoJ3JlbG9hZENvbmZpZ3VyYXRpb24nLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUoc2V0dGluZ3NSZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZygneyBcImZvb1wiOiBcImJhclwiIH0nKSk7XG5cblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBDb25maWd1cmF0aW9uU2VydmljZShzZXR0aW5nc1Jlc291cmNlLCBmaWxlU2VydmljZSwgbmV3IE51bGxQb2xpY3lTZXJ2aWNlKCksIG5ldyBOdWxsTG9nU2VydmljZSgpKSk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5pbml0aWFsaXplKCk7XG5cdFx0bGV0IGNvbmZpZyA9IHRlc3RPYmplY3QuZ2V0VmFsdWU8e1xuXHRcdFx0Zm9vOiBzdHJpbmc7XG5cdFx0fT4oKTtcblx0XHRhc3NlcnQub2soY29uZmlnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29uZmlnLmZvbywgJ2JhcicpO1xuXHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZShzZXR0aW5nc1Jlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCd7IFwiZm9vXCI6IFwiY2hhbmdlZFwiIH0nKSk7XG5cblx0XHQvLyBmb3JjZSBhIHJlbG9hZCB0byBnZXQgbGF0ZXN0XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5yZWxvYWRDb25maWd1cmF0aW9uKCk7XG5cdFx0Y29uZmlnID0gdGVzdE9iamVjdC5nZXRWYWx1ZTx7XG5cdFx0XHRmb286IHN0cmluZztcblx0XHR9PigpO1xuXHRcdGFzc2VydC5vayhjb25maWcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb25maWcuZm9vLCAnY2hhbmdlZCcpO1xuXHR9KSk7XG5cblx0dGVzdCgnbW9kZWwgZGVmYXVsdHMnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRpbnRlcmZhY2UgSVRlc3RTZXR0aW5nIHtcblx0XHRcdGNvbmZpZ3VyYXRpb246IHtcblx0XHRcdFx0c2VydmljZToge1xuXHRcdFx0XHRcdHRlc3RTZXR0aW5nOiBzdHJpbmc7XG5cdFx0XHRcdH07XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25SZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pO1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdFx0J2lkJzogJ190ZXN0Jyxcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J2NvbmZpZ3VyYXRpb24uc2VydmljZS50ZXN0U2V0dGluZyc6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdCdkZWZhdWx0JzogJ2lzU2V0J1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRsZXQgdGVzdE9iamVjdCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQ29uZmlndXJhdGlvblNlcnZpY2UoVVJJLmZpbGUoJ19fdGVzdEZpbGUnKSwgZmlsZVNlcnZpY2UsIG5ldyBOdWxsUG9saWN5U2VydmljZSgpLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuaW5pdGlhbGl6ZSgpO1xuXHRcdGxldCBzZXR0aW5nID0gdGVzdE9iamVjdC5nZXRWYWx1ZTxJVGVzdFNldHRpbmc+KCk7XG5cblx0XHRhc3NlcnQub2soc2V0dGluZyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNldHRpbmcuY29uZmlndXJhdGlvbi5zZXJ2aWNlLnRlc3RTZXR0aW5nLCAnaXNTZXQnKTtcblxuXHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZShzZXR0aW5nc1Jlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCd7IFwidGVzdHdvcmtiZW5jaC5lZGl0b3IudGFic1wiOiB0cnVlIH0nKSk7XG5cdFx0dGVzdE9iamVjdCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQ29uZmlndXJhdGlvblNlcnZpY2Uoc2V0dGluZ3NSZXNvdXJjZSwgZmlsZVNlcnZpY2UsIG5ldyBOdWxsUG9saWN5U2VydmljZSgpLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuaW5pdGlhbGl6ZSgpO1xuXG5cdFx0c2V0dGluZyA9IHRlc3RPYmplY3QuZ2V0VmFsdWU8SVRlc3RTZXR0aW5nPigpO1xuXG5cdFx0YXNzZXJ0Lm9rKHNldHRpbmcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXR0aW5nLmNvbmZpZ3VyYXRpb24uc2VydmljZS50ZXN0U2V0dGluZywgJ2lzU2V0Jyk7XG5cblx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUoc2V0dGluZ3NSZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZygneyBcImNvbmZpZ3VyYXRpb24uc2VydmljZS50ZXN0U2V0dGluZ1wiOiBcImlzQ2hhbmdlZFwiIH0nKSk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnJlbG9hZENvbmZpZ3VyYXRpb24oKTtcblx0XHRzZXR0aW5nID0gdGVzdE9iamVjdC5nZXRWYWx1ZTxJVGVzdFNldHRpbmc+KCk7XG5cdFx0YXNzZXJ0Lm9rKHNldHRpbmcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXR0aW5nLmNvbmZpZ3VyYXRpb24uc2VydmljZS50ZXN0U2V0dGluZywgJ2lzQ2hhbmdlZCcpO1xuXHR9KSk7XG5cblx0dGVzdCgnbG9va3VwJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbik7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQnaWQnOiAnX3Rlc3QnLFxuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnbG9va3VwLnNlcnZpY2UudGVzdFNldHRpbmcnOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0XHQnZGVmYXVsdCc6ICdpc1NldCdcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQ29uZmlndXJhdGlvblNlcnZpY2Uoc2V0dGluZ3NSZXNvdXJjZSwgZmlsZVNlcnZpY2UsIG5ldyBOdWxsUG9saWN5U2VydmljZSgpLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuaW5pdGlhbGl6ZSgpO1xuXG5cdFx0bGV0IHJlcyA9IHRlc3RPYmplY3QuaW5zcGVjdCgnc29tZXRoaW5nLm1pc3NpbmcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLnZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuZGVmYXVsdFZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMudXNlclZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbmZpZ3VyZWQocmVzKSwgZmFsc2UpO1xuXG5cdFx0cmVzID0gdGVzdE9iamVjdC5pbnNwZWN0KCdsb29rdXAuc2VydmljZS50ZXN0U2V0dGluZycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuZGVmYXVsdFZhbHVlLCAnaXNTZXQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLnZhbHVlLCAnaXNTZXQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLnVzZXJWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb25maWd1cmVkKHJlcyksIGZhbHNlKTtcblxuXHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZShzZXR0aW5nc1Jlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCd7IFwibG9va3VwLnNlcnZpY2UudGVzdFNldHRpbmdcIjogXCJiYXJcIiB9JykpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC5yZWxvYWRDb25maWd1cmF0aW9uKCk7XG5cdFx0cmVzID0gdGVzdE9iamVjdC5pbnNwZWN0KCdsb29rdXAuc2VydmljZS50ZXN0U2V0dGluZycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuZGVmYXVsdFZhbHVlLCAnaXNTZXQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLnVzZXJWYWx1ZSwgJ2JhcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMudmFsdWUsICdiYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb25maWd1cmVkKHJlcyksIHRydWUpO1xuXG5cdH0pKTtcblxuXHR0ZXN0KCdsb29rdXAgd2l0aCBudWxsJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbik7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQnaWQnOiAnX3Rlc3ROdWxsJyxcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J2xvb2t1cC5zZXJ2aWNlLnRlc3ROdWxsU2V0dGluZyc6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdudWxsJyxcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQ29uZmlndXJhdGlvblNlcnZpY2Uoc2V0dGluZ3NSZXNvdXJjZSwgZmlsZVNlcnZpY2UsIG5ldyBOdWxsUG9saWN5U2VydmljZSgpLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuaW5pdGlhbGl6ZSgpO1xuXG5cdFx0bGV0IHJlcyA9IHRlc3RPYmplY3QuaW5zcGVjdCgnbG9va3VwLnNlcnZpY2UudGVzdE51bGxTZXR0aW5nJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5kZWZhdWx0VmFsdWUsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMudmFsdWUsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMudXNlclZhbHVlLCB1bmRlZmluZWQpO1xuXG5cdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHNldHRpbmdzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoJ3sgXCJsb29rdXAuc2VydmljZS50ZXN0TnVsbFNldHRpbmdcIjogbnVsbCB9JykpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC5yZWxvYWRDb25maWd1cmF0aW9uKCk7XG5cblx0XHRyZXMgPSB0ZXN0T2JqZWN0Lmluc3BlY3QoJ2xvb2t1cC5zZXJ2aWNlLnRlc3ROdWxsU2V0dGluZycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuZGVmYXVsdFZhbHVlLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLnZhbHVlLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLnVzZXJWYWx1ZSwgbnVsbCk7XG5cdH0pKTtcblxuXHR0ZXN0KCd1cGRhdGUgY29uZmlndXJhdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihDb25maWd1cmF0aW9uRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKTtcblx0XHRjb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0XHRcdCdpZCc6ICdfdGVzdCcsXG5cdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdjb25maWd1cmF0aW9uU2VydmljZS50ZXN0U2V0dGluZyc6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdCdkZWZhdWx0JzogJ2lzU2V0J1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQ29uZmlndXJhdGlvblNlcnZpY2Uoc2V0dGluZ3NSZXNvdXJjZSwgZmlsZVNlcnZpY2UsIG5ldyBOdWxsUG9saWN5U2VydmljZSgpLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuaW5pdGlhbGl6ZSgpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZSgnY29uZmlndXJhdGlvblNlcnZpY2UudGVzdFNldHRpbmcnLCAndmFsdWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5nZXRWYWx1ZSgnY29uZmlndXJhdGlvblNlcnZpY2UudGVzdFNldHRpbmcnKSwgJ3ZhbHVlJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZSBjb25maWd1cmF0aW9uIHdoZW4gZXhpc3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbik7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQnaWQnOiAnX3Rlc3QnLFxuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnY29uZmlndXJhdGlvblNlcnZpY2UudGVzdFNldHRpbmcnOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0XHQnZGVmYXVsdCc6ICdpc1NldCdcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlcy5hZGQobmV3IENvbmZpZ3VyYXRpb25TZXJ2aWNlKHNldHRpbmdzUmVzb3VyY2UsIGZpbGVTZXJ2aWNlLCBuZXcgTnVsbFBvbGljeVNlcnZpY2UoKSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmluaXRpYWxpemUoKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3QudXBkYXRlVmFsdWUoJ2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnRlc3RTZXR0aW5nJywgJ3ZhbHVlJyk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZSgnY29uZmlndXJhdGlvblNlcnZpY2UudGVzdFNldHRpbmcnLCAndXBkYXRlZFZhbHVlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3QuZ2V0VmFsdWUoJ2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnRlc3RTZXR0aW5nJyksICd1cGRhdGVkVmFsdWUnKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlIGNvbmZpZ3VyYXRpb24gdG8gZGVmYXVsdCB2YWx1ZSBzaG91bGQgcmVtb3ZlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25SZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pO1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdFx0J2lkJzogJ190ZXN0Jyxcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnRlc3RTZXR0aW5nJzoge1xuXHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdFx0J2RlZmF1bHQnOiAnaXNTZXQnXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBDb25maWd1cmF0aW9uU2VydmljZShzZXR0aW5nc1Jlc291cmNlLCBmaWxlU2VydmljZSwgbmV3IE51bGxQb2xpY3lTZXJ2aWNlKCksIG5ldyBOdWxsTG9nU2VydmljZSgpKSk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5pbml0aWFsaXplKCk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnVwZGF0ZVZhbHVlKCdjb25maWd1cmF0aW9uU2VydmljZS50ZXN0U2V0dGluZycsICd2YWx1ZScpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QudXBkYXRlVmFsdWUoJ2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnRlc3RTZXR0aW5nJywgJ2lzU2V0Jyk7XG5cdFx0Y29uc3QgaW5zcGVjdCA9IHRlc3RPYmplY3QuaW5zcGVjdCgnY29uZmlndXJhdGlvblNlcnZpY2UudGVzdFNldHRpbmcnKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnNwZWN0LnVzZXJWYWx1ZSwgdW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlIGNvbmZpZ3VyYXRpb24gc2hvdWxkIHJlbW92ZSB3aGVuIHVuZGVmaW5lZCBpcyBwYXNzZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbik7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQnaWQnOiAnX3Rlc3QnLFxuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnY29uZmlndXJhdGlvblNlcnZpY2UudGVzdFNldHRpbmcnOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0XHQnZGVmYXVsdCc6ICdpc1NldCdcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlcy5hZGQobmV3IENvbmZpZ3VyYXRpb25TZXJ2aWNlKHNldHRpbmdzUmVzb3VyY2UsIGZpbGVTZXJ2aWNlLCBuZXcgTnVsbFBvbGljeVNlcnZpY2UoKSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmluaXRpYWxpemUoKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3QudXBkYXRlVmFsdWUoJ2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnRlc3RTZXR0aW5nJywgJ3ZhbHVlJyk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZSgnY29uZmlndXJhdGlvblNlcnZpY2UudGVzdFNldHRpbmcnLCB1bmRlZmluZWQpO1xuXHRcdGNvbnN0IGluc3BlY3QgPSB0ZXN0T2JqZWN0Lmluc3BlY3QoJ2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnRlc3RTZXR0aW5nJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5zcGVjdC51c2VyVmFsdWUsIHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZSB1bmtub3duIGNvbmZpZ3VyYXRpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQ29uZmlndXJhdGlvblNlcnZpY2Uoc2V0dGluZ3NSZXNvdXJjZSwgZmlsZVNlcnZpY2UsIG5ldyBOdWxsUG9saWN5U2VydmljZSgpLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuaW5pdGlhbGl6ZSgpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZSgnY29uZmlndXJhdGlvblNlcnZpY2UudW5rbm93blNldHRpbmcnLCAndmFsdWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5nZXRWYWx1ZSgnY29uZmlndXJhdGlvblNlcnZpY2UudW5rbm93blNldHRpbmcnKSwgJ3ZhbHVlJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZSBjb25maWd1cmF0aW9uIGluIG5vbiB1c2VyIHRhcmdldCB0aHJvd3MgZXJyb3InLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbik7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQnaWQnOiAnX3Rlc3QnLFxuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnY29uZmlndXJhdGlvblNlcnZpY2UudGVzdFNldHRpbmcnOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0XHQnZGVmYXVsdCc6ICdpc1NldCdcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlcy5hZGQobmV3IENvbmZpZ3VyYXRpb25TZXJ2aWNlKHNldHRpbmdzUmVzb3VyY2UsIGZpbGVTZXJ2aWNlLCBuZXcgTnVsbFBvbGljeVNlcnZpY2UoKSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmluaXRpYWxpemUoKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnVwZGF0ZVZhbHVlKCdjb25maWd1cmF0aW9uU2VydmljZS50ZXN0U2V0dGluZycsICd2YWx1ZScsIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFKTtcblx0XHRcdGFzc2VydC5mYWlsKCdTaG91bGQgZmFpbCB3aXRoIGVycm9yJyk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Ly8gc3VjY2Vlc3Ncblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZSBjb25maWd1cmF0aW9uIHRocm93cyBlcnJvciBmb3IgcG9saWN5IHNldHRpbmcnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbik7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQnaWQnOiAnX3Rlc3QnLFxuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnY29uZmlndXJhdGlvblNlcnZpY2UucG9saWN5U2V0dGluZyc6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdCdkZWZhdWx0JzogJ2lzU2V0Jyxcblx0XHRcdFx0XHRwb2xpY3k6IHtcblx0XHRcdFx0XHRcdG5hbWU6ICdjb25maWd1cmF0aW9uU2VydmljZS5wb2xpY3lTZXR0aW5nJyxcblx0XHRcdFx0XHRcdG1pbmltdW1WZXJzaW9uOiAnMS4wLjAnLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgbG9nU2VydmljZSA9IG5ldyBOdWxsTG9nU2VydmljZSgpO1xuXHRcdGNvbnN0IHBvbGljeUZpbGUgPSBVUkkuZmlsZSgncG9saWNpZXMuanNvbicpO1xuXHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZShwb2xpY3lGaWxlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCd7IFwiY29uZmlndXJhdGlvblNlcnZpY2UucG9saWN5U2V0dGluZ1wiOiBcInBvbGljeVZhbHVlXCIgfScpKTtcblx0XHRjb25zdCBwb2xpY3lTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaWxlUG9saWN5U2VydmljZShwb2xpY3lGaWxlLCBmaWxlU2VydmljZSwgbG9nU2VydmljZSkpO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlcy5hZGQobmV3IENvbmZpZ3VyYXRpb25TZXJ2aWNlKHNldHRpbmdzUmVzb3VyY2UsIGZpbGVTZXJ2aWNlLCBwb2xpY3lTZXJ2aWNlLCBsb2dTZXJ2aWNlKSk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5pbml0aWFsaXplKCk7XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC51cGRhdGVWYWx1ZSgnY29uZmlndXJhdGlvblNlcnZpY2UucG9saWN5U2V0dGluZycsICd2YWx1ZScpO1xuXHRcdFx0YXNzZXJ0LmZhaWwoJ1Nob3VsZCB0aHJvdyBlcnJvcicpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHQvLyBzdWNjZWVzc1xuXHRcdH1cblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsV0FBVztBQUNwQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLCtDQUErQztBQUN4RCxTQUFTLHFCQUFxQixvQkFBb0I7QUFDbEQsU0FBUyxjQUFjLCtCQUF1RDtBQUM5RSxTQUFTLDRCQUE0QjtBQUVyQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGtDQUFrQztBQUMzQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGdCQUFnQjtBQUV6QixNQUFNLGdDQUFnQyxNQUFNO0FBRTNDLFFBQU0sY0FBYyx3Q0FBd0M7QUFFNUQsTUFBSTtBQUNKLE1BQUk7QUFFSixRQUFNLFlBQVk7QUFDakIsa0JBQWMsWUFBWSxJQUFJLElBQUksWUFBWSxJQUFJLGVBQWUsQ0FBQyxDQUFDO0FBQ25FLFVBQU0seUJBQXlCLFlBQVksSUFBSSxJQUFJLDJCQUEyQixDQUFDO0FBQy9FLGdCQUFZLElBQUksWUFBWSxpQkFBaUIsUUFBUSxNQUFNLHNCQUFzQixDQUFDO0FBQ2xGLHVCQUFtQixJQUFJLEtBQUssZUFBZTtBQUFBLEVBQzVDLENBQUM7QUFFRCxPQUFLLFVBQVUsTUFBTSxtQkFBeUIs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
