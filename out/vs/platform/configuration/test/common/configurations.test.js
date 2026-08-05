import assert from "assert";
import { Event } from "../../../../base/common/event.js";
import { equals } from "../../../../base/common/objects.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { Extensions } from "../../common/configurationRegistry.js";
import { DefaultConfiguration } from "../../common/configurations.js";
import { NullLogService } from "../../../log/common/log.js";
import { Registry } from "../../../registry/common/platform.js";
suite("DefaultConfiguration", () => {
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  const configurationRegistry = Registry.as(Extensions.Configuration);
  setup(() => reset());
  teardown(() => reset());
  function reset() {
    configurationRegistry.deregisterConfigurations(configurationRegistry.getConfigurations());
    configurationRegistry.deregisterDefaultConfigurations(configurationRegistry.getRegisteredDefaultConfigurations());
  }
  test("Test registering a property before initialize", async () => {
    const testObject = disposables.add(new DefaultConfiguration(new NullLogService()));
    configurationRegistry.registerConfiguration({
      "id": "a",
      "order": 1,
      "title": "a",
      "type": "object",
      "properties": {
        "a": {
          "description": "a",
          "type": "boolean",
          "default": false
        }
      }
    });
    const actual = await testObject.initialize();
    assert.strictEqual(actual.getValue("a"), false);
  });
  test("Test registering a property and do not initialize", async () => {
    const testObject = disposables.add(new DefaultConfiguration(new NullLogService()));
    configurationRegistry.registerConfiguration({
      "id": "a",
      "order": 1,
      "title": "a",
      "type": "object",
      "properties": {
        "a": {
          "description": "a",
          "type": "boolean",
          "default": false
        }
      }
    });
    assert.strictEqual(testObject.configurationModel.getValue("a"), void 0);
  });
  test("Test registering a property after initialize", async () => {
    const testObject = disposables.add(new DefaultConfiguration(new NullLogService()));
    await testObject.initialize();
    const promise = Event.toPromise(testObject.onDidChangeConfiguration);
    configurationRegistry.registerConfiguration({
      "id": "a",
      "order": 1,
      "title": "a",
      "type": "object",
      "properties": {
        "defaultConfiguration.testSetting1": {
          "description": "a",
          "type": "boolean",
          "default": false
        }
      }
    });
    const { defaults: actual, properties } = await promise;
    assert.strictEqual(actual.getValue("defaultConfiguration.testSetting1"), false);
    assert.deepStrictEqual(properties, ["defaultConfiguration.testSetting1"]);
  });
  test("Test registering nested properties", async () => {
    const testObject = disposables.add(new DefaultConfiguration(new NullLogService()));
    configurationRegistry.registerConfiguration({
      "id": "a",
      "order": 1,
      "title": "a",
      "type": "object",
      "properties": {
        "a.b": {
          "description": "1",
          "type": "object",
          "default": {}
        },
        "a.b.c": {
          "description": "2",
          "type": "object",
          "default": "2"
        }
      }
    });
    const actual = await testObject.initialize();
    assert.ok(equals(actual.getValue("a"), { b: { c: "2" } }));
    assert.ok(equals(actual.contents, { "a": { b: { c: "2" } } }));
    assert.deepStrictEqual(actual.keys.sort(), ["a.b", "a.b.c"]);
  });
  test("Test registering the same property again", async () => {
    const testObject = disposables.add(new DefaultConfiguration(new NullLogService()));
    configurationRegistry.registerConfiguration({
      "id": "a",
      "order": 1,
      "title": "a",
      "type": "object",
      "properties": {
        "a": {
          "description": "a",
          "type": "boolean",
          "default": true
        }
      }
    });
    configurationRegistry.registerConfiguration({
      "id": "a",
      "order": 1,
      "title": "a",
      "type": "object",
      "properties": {
        "a": {
          "description": "a",
          "type": "boolean",
          "default": false
        }
      }
    });
    const actual = await testObject.initialize();
    assert.strictEqual(true, actual.getValue("a"));
  });
  test("Test registering an override identifier", async () => {
    const testObject = disposables.add(new DefaultConfiguration(new NullLogService()));
    configurationRegistry.registerDefaultConfigurations([{
      overrides: {
        "[a]": {
          "b": true
        }
      }
    }]);
    const actual = await testObject.initialize();
    assert.ok(equals(actual.getValue("[a]"), { "b": true }));
    assert.ok(equals(actual.contents, { "[a]": { "b": true } }));
    assert.ok(equals(actual.overrides, [{ contents: { "b": true }, identifiers: ["a"], keys: ["b"] }]));
    assert.deepStrictEqual(actual.keys.sort(), ["[a]"]);
    assert.strictEqual(actual.getOverrideValue("b", "a"), true);
  });
  test("Test registering a normal property and override identifier", async () => {
    const testObject = disposables.add(new DefaultConfiguration(new NullLogService()));
    configurationRegistry.registerConfiguration({
      "id": "a",
      "order": 1,
      "title": "a",
      "type": "object",
      "properties": {
        "b": {
          "description": "b",
          "type": "boolean",
          "default": false
        }
      }
    });
    configurationRegistry.registerDefaultConfigurations([{
      overrides: {
        "[a]": {
          "b": true
        }
      }
    }]);
    const actual = await testObject.initialize();
    assert.deepStrictEqual(actual.getValue("b"), false);
    assert.ok(equals(actual.getValue("[a]"), { "b": true }));
    assert.ok(equals(actual.contents, { "b": false, "[a]": { "b": true } }));
    assert.ok(equals(actual.overrides, [{ contents: { "b": true }, identifiers: ["a"], keys: ["b"] }]));
    assert.deepStrictEqual(actual.keys.sort(), ["[a]", "b"]);
    assert.strictEqual(actual.getOverrideValue("b", "a"), true);
  });
  test("Test normal property is registered after override identifier", async () => {
    const testObject = disposables.add(new DefaultConfiguration(new NullLogService()));
    const promise = Event.toPromise(testObject.onDidChangeConfiguration);
    configurationRegistry.registerDefaultConfigurations([{
      overrides: {
        "[a]": {
          "b": true
        }
      }
    }]);
    await testObject.initialize();
    configurationRegistry.registerConfiguration({
      "id": "a",
      "order": 1,
      "title": "a",
      "type": "object",
      "properties": {
        "b": {
          "description": "b",
          "type": "boolean",
          "default": false
        }
      }
    });
    const { defaults: actual, properties } = await promise;
    assert.deepStrictEqual(actual.getValue("b"), false);
    assert.ok(equals(actual.getValue("[a]"), { "b": true }));
    assert.ok(equals(actual.contents, { "b": false, "[a]": { "b": true } }));
    assert.ok(equals(actual.overrides, [{ contents: { "b": true }, identifiers: ["a"], keys: ["b"] }]));
    assert.deepStrictEqual(actual.keys.sort(), ["[a]", "b"]);
    assert.strictEqual(actual.getOverrideValue("b", "a"), true);
    assert.deepStrictEqual(properties, ["b"]);
  });
  test("Test override identifier is registered after property", async () => {
    const testObject = disposables.add(new DefaultConfiguration(new NullLogService()));
    const promise = Event.toPromise(testObject.onDidChangeConfiguration);
    configurationRegistry.registerConfiguration({
      "id": "a",
      "order": 1,
      "title": "a",
      "type": "object",
      "properties": {
        "b": {
          "description": "b",
          "type": "boolean",
          "default": false
        }
      }
    });
    await testObject.initialize();
    configurationRegistry.registerDefaultConfigurations([{
      overrides: {
        "[a]": {
          "b": true
        }
      }
    }]);
    const { defaults: actual, properties } = await promise;
    assert.deepStrictEqual(actual.getValue("b"), false);
    assert.ok(equals(actual.getValue("[a]"), { "b": true }));
    assert.ok(equals(actual.contents, { "b": false, "[a]": { "b": true } }));
    assert.ok(equals(actual.overrides, [{ contents: { "b": true }, identifiers: ["a"], keys: ["b"] }]));
    assert.deepStrictEqual(actual.keys.sort(), ["[a]", "b"]);
    assert.strictEqual(actual.getOverrideValue("b", "a"), true);
    assert.deepStrictEqual(properties, ["[a]"]);
  });
  test("Test register override identifier and property after initialize", async () => {
    const testObject = disposables.add(new DefaultConfiguration(new NullLogService()));
    await testObject.initialize();
    configurationRegistry.registerConfiguration({
      "id": "a",
      "order": 1,
      "title": "a",
      "type": "object",
      "properties": {
        "b": {
          "description": "b",
          "type": "boolean",
          "default": false
        }
      }
    });
    configurationRegistry.registerDefaultConfigurations([{
      overrides: {
        "[a]": {
          "b": true
        }
      }
    }]);
    const actual = testObject.configurationModel;
    assert.deepStrictEqual(actual.getValue("b"), false);
    assert.ok(equals(actual.getValue("[a]"), { "b": true }));
    assert.ok(equals(actual.contents, { "b": false, "[a]": { "b": true } }));
    assert.ok(equals(actual.overrides, [{ contents: { "b": true }, identifiers: ["a"], keys: ["b"] }]));
    assert.deepStrictEqual(actual.keys.sort(), ["[a]", "b"]);
    assert.strictEqual(actual.getOverrideValue("b", "a"), true);
  });
  test("Test deregistering a property", async () => {
    const testObject = disposables.add(new DefaultConfiguration(new NullLogService()));
    const promise = Event.toPromise(testObject.onDidChangeConfiguration);
    const node = {
      "id": "a",
      "order": 1,
      "title": "a",
      "type": "object",
      "properties": {
        "a": {
          "description": "a",
          "type": "boolean",
          "default": false
        }
      }
    };
    configurationRegistry.registerConfiguration(node);
    await testObject.initialize();
    configurationRegistry.deregisterConfigurations([node]);
    const { defaults: actual, properties } = await promise;
    assert.strictEqual(actual.getValue("a"), void 0);
    assert.ok(equals(actual.contents, {}));
    assert.deepStrictEqual(actual.keys, []);
    assert.deepStrictEqual(properties, ["a"]);
  });
  test("Test deregistering an override identifier", async () => {
    const testObject = disposables.add(new DefaultConfiguration(new NullLogService()));
    configurationRegistry.registerConfiguration({
      "id": "a",
      "order": 1,
      "title": "a",
      "type": "object",
      "properties": {
        "b": {
          "description": "b",
          "type": "boolean",
          "default": false
        }
      }
    });
    const node = {
      overrides: {
        "[a]": {
          "b": true
        }
      }
    };
    configurationRegistry.registerDefaultConfigurations([node]);
    await testObject.initialize();
    configurationRegistry.deregisterDefaultConfigurations([node]);
    assert.deepStrictEqual(testObject.configurationModel.getValue("[a]"), void 0);
    assert.ok(equals(testObject.configurationModel.contents, { "b": false }));
    assert.ok(equals(testObject.configurationModel.overrides, []));
    assert.deepStrictEqual(testObject.configurationModel.keys, ["b"]);
    assert.strictEqual(testObject.configurationModel.getOverrideValue("b", "a"), void 0);
  });
  test("Test deregistering a merged language object setting", async () => {
    const testObject = disposables.add(new DefaultConfiguration(new NullLogService()));
    configurationRegistry.registerConfiguration({
      "id": "b",
      "order": 1,
      "title": "b",
      "type": "object",
      "properties": {
        "b": {
          "description": "b",
          "type": "object",
          "default": {}
        }
      }
    });
    const node1 = {
      overrides: {
        "[a]": {
          "b": {
            "aa": "1",
            "bb": "2"
          }
        }
      },
      source: { id: "source1", displayName: "source1" }
    };
    const node2 = {
      overrides: {
        "[a]": {
          "b": {
            "bb": "20",
            "cc": "30"
          }
        }
      },
      source: { id: "source2", displayName: "source2" }
    };
    configurationRegistry.registerDefaultConfigurations([node1]);
    configurationRegistry.registerDefaultConfigurations([node2]);
    await testObject.initialize();
    configurationRegistry.deregisterDefaultConfigurations([node1]);
    assert.ok(equals(testObject.configurationModel.getValue("[a]"), { "b": { "bb": "20", "cc": "30" } }));
    assert.ok(equals(testObject.configurationModel.contents, { "[a]": { "b": { "bb": "20", "cc": "30" } }, "b": {} }));
    assert.ok(equals(testObject.configurationModel.overrides, [{ contents: { "b": { "bb": "20", "cc": "30" } }, identifiers: ["a"], keys: ["b"] }]));
    assert.deepStrictEqual(testObject.configurationModel.keys.sort(), ["[a]", "b"]);
    assert.ok(equals(testObject.configurationModel.getOverrideValue("b", "a"), { "bb": "20", "cc": "30" }));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL2NvbmZpZ3VyYXRpb25zLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGVxdWFscyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zLCBJQ29uZmlndXJhdGlvbk5vZGUsIElDb25maWd1cmF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IERlZmF1bHRDb25maWd1cmF0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbmZpZ3VyYXRpb25zLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuXG5zdWl0ZSgnRGVmYXVsdENvbmZpZ3VyYXRpb24nLCAoKSA9PiB7XG5cblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblx0Y29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKTtcblxuXHRzZXR1cCgoKSA9PiByZXNldCgpKTtcblx0dGVhcmRvd24oKCkgPT4gcmVzZXQoKSk7XG5cblx0ZnVuY3Rpb24gcmVzZXQoKSB7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LmRlcmVnaXN0ZXJDb25maWd1cmF0aW9ucyhjb25maWd1cmF0aW9uUmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvbnMoKSk7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LmRlcmVnaXN0ZXJEZWZhdWx0Q29uZmlndXJhdGlvbnMoY29uZmlndXJhdGlvblJlZ2lzdHJ5LmdldFJlZ2lzdGVyZWREZWZhdWx0Q29uZmlndXJhdGlvbnMoKSk7XG5cdH1cblxuXHR0ZXN0KCdUZXN0IHJlZ2lzdGVyaW5nIGEgcHJvcGVydHkgYmVmb3JlIGluaXRpYWxpemUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRGVmYXVsdENvbmZpZ3VyYXRpb24obmV3IE51bGxMb2dTZXJ2aWNlKCkpKTtcblx0XHRjb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0XHRcdCdpZCc6ICdhJyxcblx0XHRcdCdvcmRlcic6IDEsXG5cdFx0XHQndGl0bGUnOiAnYScsXG5cdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdhJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6ICdhJyxcblx0XHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0XHQnZGVmYXVsdCc6IGZhbHNlLFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgdGVzdE9iamVjdC5pbml0aWFsaXplKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5nZXRWYWx1ZSgnYScpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlc3QgcmVnaXN0ZXJpbmcgYSBwcm9wZXJ0eSBhbmQgZG8gbm90IGluaXRpYWxpemUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRGVmYXVsdENvbmZpZ3VyYXRpb24obmV3IE51bGxMb2dTZXJ2aWNlKCkpKTtcblx0XHRjb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0XHRcdCdpZCc6ICdhJyxcblx0XHRcdCdvcmRlcic6IDEsXG5cdFx0XHQndGl0bGUnOiAnYScsXG5cdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdhJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6ICdhJyxcblx0XHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0XHQnZGVmYXVsdCc6IGZhbHNlLFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmlndXJhdGlvbk1vZGVsLmdldFZhbHVlKCdhJyksIHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlc3QgcmVnaXN0ZXJpbmcgYSBwcm9wZXJ0eSBhZnRlciBpbml0aWFsaXplJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERlZmF1bHRDb25maWd1cmF0aW9uKG5ldyBOdWxsTG9nU2VydmljZSgpKSk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5pbml0aWFsaXplKCk7XG5cdFx0Y29uc3QgcHJvbWlzZSA9IEV2ZW50LnRvUHJvbWlzZSh0ZXN0T2JqZWN0Lm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbik7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQnaWQnOiAnYScsXG5cdFx0XHQnb3JkZXInOiAxLFxuXHRcdFx0J3RpdGxlJzogJ2EnLFxuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnZGVmYXVsdENvbmZpZ3VyYXRpb24udGVzdFNldHRpbmcxJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6ICdhJyxcblx0XHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0XHQnZGVmYXVsdCc6IGZhbHNlLFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0Y29uc3QgeyBkZWZhdWx0czogYWN0dWFsLCBwcm9wZXJ0aWVzIH0gPSBhd2FpdCBwcm9taXNlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2V0VmFsdWUoJ2RlZmF1bHRDb25maWd1cmF0aW9uLnRlc3RTZXR0aW5nMScpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm9wZXJ0aWVzLCBbJ2RlZmF1bHRDb25maWd1cmF0aW9uLnRlc3RTZXR0aW5nMSddKTtcblx0fSk7XG5cblx0dGVzdCgnVGVzdCByZWdpc3RlcmluZyBuZXN0ZWQgcHJvcGVydGllcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBEZWZhdWx0Q29uZmlndXJhdGlvbihuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdFx0J2lkJzogJ2EnLFxuXHRcdFx0J29yZGVyJzogMSxcblx0XHRcdCd0aXRsZSc6ICdhJyxcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J2EuYic6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiAnMScsXG5cdFx0XHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHQnZGVmYXVsdCc6IHt9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnYS5iLmMnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogJzInLFxuXHRcdFx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHRcdFx0J2RlZmF1bHQnOiAnMicsXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IHRlc3RPYmplY3QuaW5pdGlhbGl6ZSgpO1xuXG5cdFx0YXNzZXJ0Lm9rKGVxdWFscyhhY3R1YWwuZ2V0VmFsdWUoJ2EnKSwgeyBiOiB7IGM6ICcyJyB9IH0pKTtcblx0XHRhc3NlcnQub2soZXF1YWxzKGFjdHVhbC5jb250ZW50cywgeyAnYSc6IHsgYjogeyBjOiAnMicgfSB9IH0pKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5rZXlzLnNvcnQoKSwgWydhLmInLCAnYS5iLmMnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlc3QgcmVnaXN0ZXJpbmcgdGhlIHNhbWUgcHJvcGVydHkgYWdhaW4nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRGVmYXVsdENvbmZpZ3VyYXRpb24obmV3IE51bGxMb2dTZXJ2aWNlKCkpKTtcblx0XHRjb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0XHRcdCdpZCc6ICdhJyxcblx0XHRcdCdvcmRlcic6IDEsXG5cdFx0XHQndGl0bGUnOiAnYScsXG5cdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdhJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6ICdhJyxcblx0XHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0XHQnZGVmYXVsdCc6IHRydWUsXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHRjb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0XHRcdCdpZCc6ICdhJyxcblx0XHRcdCdvcmRlcic6IDEsXG5cdFx0XHQndGl0bGUnOiAnYScsXG5cdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdhJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6ICdhJyxcblx0XHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0XHQnZGVmYXVsdCc6IGZhbHNlLFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgdGVzdE9iamVjdC5pbml0aWFsaXplKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRydWUsIGFjdHVhbC5nZXRWYWx1ZSgnYScpKTtcblx0fSk7XG5cblx0dGVzdCgnVGVzdCByZWdpc3RlcmluZyBhbiBvdmVycmlkZSBpZGVudGlmaWVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERlZmF1bHRDb25maWd1cmF0aW9uKG5ldyBOdWxsTG9nU2VydmljZSgpKSk7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKFt7XG5cdFx0XHRvdmVycmlkZXM6IHtcblx0XHRcdFx0J1thXSc6IHtcblx0XHRcdFx0XHQnYic6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1dKTtcblx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCB0ZXN0T2JqZWN0LmluaXRpYWxpemUoKTtcblx0XHRhc3NlcnQub2soZXF1YWxzKGFjdHVhbC5nZXRWYWx1ZSgnW2FdJyksIHsgJ2InOiB0cnVlIH0pKTtcblx0XHRhc3NlcnQub2soZXF1YWxzKGFjdHVhbC5jb250ZW50cywgeyAnW2FdJzogeyAnYic6IHRydWUgfSB9KSk7XG5cdFx0YXNzZXJ0Lm9rKGVxdWFscyhhY3R1YWwub3ZlcnJpZGVzLCBbeyBjb250ZW50czogeyAnYic6IHRydWUgfSwgaWRlbnRpZmllcnM6IFsnYSddLCBrZXlzOiBbJ2InXSB9XSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmtleXMuc29ydCgpLCBbJ1thXSddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmdldE92ZXJyaWRlVmFsdWUoJ2InLCAnYScpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnVGVzdCByZWdpc3RlcmluZyBhIG5vcm1hbCBwcm9wZXJ0eSBhbmQgb3ZlcnJpZGUgaWRlbnRpZmllcicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBEZWZhdWx0Q29uZmlndXJhdGlvbihuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdFx0J2lkJzogJ2EnLFxuXHRcdFx0J29yZGVyJzogMSxcblx0XHRcdCd0aXRsZSc6ICdhJyxcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J2InOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogJ2InLFxuXHRcdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdCdkZWZhdWx0JzogZmFsc2UsXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhbe1xuXHRcdFx0b3ZlcnJpZGVzOiB7XG5cdFx0XHRcdCdbYV0nOiB7XG5cdFx0XHRcdFx0J2InOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XSk7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCB0ZXN0T2JqZWN0LmluaXRpYWxpemUoKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5nZXRWYWx1ZSgnYicpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0Lm9rKGVxdWFscyhhY3R1YWwuZ2V0VmFsdWUoJ1thXScpLCB7ICdiJzogdHJ1ZSB9KSk7XG5cdFx0YXNzZXJ0Lm9rKGVxdWFscyhhY3R1YWwuY29udGVudHMsIHsgJ2InOiBmYWxzZSwgJ1thXSc6IHsgJ2InOiB0cnVlIH0gfSkpO1xuXHRcdGFzc2VydC5vayhlcXVhbHMoYWN0dWFsLm92ZXJyaWRlcywgW3sgY29udGVudHM6IHsgJ2InOiB0cnVlIH0sIGlkZW50aWZpZXJzOiBbJ2EnXSwga2V5czogWydiJ10gfV0pKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5rZXlzLnNvcnQoKSwgWydbYV0nLCAnYiddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmdldE92ZXJyaWRlVmFsdWUoJ2InLCAnYScpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnVGVzdCBub3JtYWwgcHJvcGVydHkgaXMgcmVnaXN0ZXJlZCBhZnRlciBvdmVycmlkZSBpZGVudGlmaWVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERlZmF1bHRDb25maWd1cmF0aW9uKG5ldyBOdWxsTG9nU2VydmljZSgpKSk7XG5cdFx0Y29uc3QgcHJvbWlzZSA9IEV2ZW50LnRvUHJvbWlzZSh0ZXN0T2JqZWN0Lm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbik7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKFt7XG5cdFx0XHRvdmVycmlkZXM6IHtcblx0XHRcdFx0J1thXSc6IHtcblx0XHRcdFx0XHQnYic6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1dKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3QuaW5pdGlhbGl6ZSgpO1xuXG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQnaWQnOiAnYScsXG5cdFx0XHQnb3JkZXInOiAxLFxuXHRcdFx0J3RpdGxlJzogJ2EnLFxuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnYic6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiAnYicsXG5cdFx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZSxcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgeyBkZWZhdWx0czogYWN0dWFsLCBwcm9wZXJ0aWVzIH0gPSBhd2FpdCBwcm9taXNlO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmdldFZhbHVlKCdiJyksIGZhbHNlKTtcblx0XHRhc3NlcnQub2soZXF1YWxzKGFjdHVhbC5nZXRWYWx1ZSgnW2FdJyksIHsgJ2InOiB0cnVlIH0pKTtcblx0XHRhc3NlcnQub2soZXF1YWxzKGFjdHVhbC5jb250ZW50cywgeyAnYic6IGZhbHNlLCAnW2FdJzogeyAnYic6IHRydWUgfSB9KSk7XG5cdFx0YXNzZXJ0Lm9rKGVxdWFscyhhY3R1YWwub3ZlcnJpZGVzLCBbeyBjb250ZW50czogeyAnYic6IHRydWUgfSwgaWRlbnRpZmllcnM6IFsnYSddLCBrZXlzOiBbJ2InXSB9XSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmtleXMuc29ydCgpLCBbJ1thXScsICdiJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2V0T3ZlcnJpZGVWYWx1ZSgnYicsICdhJyksIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocHJvcGVydGllcywgWydiJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXN0IG92ZXJyaWRlIGlkZW50aWZpZXIgaXMgcmVnaXN0ZXJlZCBhZnRlciBwcm9wZXJ0eScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBEZWZhdWx0Q29uZmlndXJhdGlvbihuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHRcdGNvbnN0IHByb21pc2UgPSBFdmVudC50b1Byb21pc2UodGVzdE9iamVjdC5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24pO1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdFx0J2lkJzogJ2EnLFxuXHRcdFx0J29yZGVyJzogMSxcblx0XHRcdCd0aXRsZSc6ICdhJyxcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J2InOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogJ2InLFxuXHRcdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdCdkZWZhdWx0JzogZmFsc2UsXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmluaXRpYWxpemUoKTtcblxuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhbe1xuXHRcdFx0b3ZlcnJpZGVzOiB7XG5cdFx0XHRcdCdbYV0nOiB7XG5cdFx0XHRcdFx0J2InOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XSk7XG5cblx0XHRjb25zdCB7IGRlZmF1bHRzOiBhY3R1YWwsIHByb3BlcnRpZXMgfSA9IGF3YWl0IHByb21pc2U7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0VmFsdWUoJ2InKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5vayhlcXVhbHMoYWN0dWFsLmdldFZhbHVlKCdbYV0nKSwgeyAnYic6IHRydWUgfSkpO1xuXHRcdGFzc2VydC5vayhlcXVhbHMoYWN0dWFsLmNvbnRlbnRzLCB7ICdiJzogZmFsc2UsICdbYV0nOiB7ICdiJzogdHJ1ZSB9IH0pKTtcblx0XHRhc3NlcnQub2soZXF1YWxzKGFjdHVhbC5vdmVycmlkZXMsIFt7IGNvbnRlbnRzOiB7ICdiJzogdHJ1ZSB9LCBpZGVudGlmaWVyczogWydhJ10sIGtleXM6IFsnYiddIH1dKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwua2V5cy5zb3J0KCksIFsnW2FdJywgJ2InXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5nZXRPdmVycmlkZVZhbHVlKCdiJywgJ2EnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm9wZXJ0aWVzLCBbJ1thXSddKTtcblx0fSk7XG5cblx0dGVzdCgnVGVzdCByZWdpc3RlciBvdmVycmlkZSBpZGVudGlmaWVyIGFuZCBwcm9wZXJ0eSBhZnRlciBpbml0aWFsaXplJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERlZmF1bHRDb25maWd1cmF0aW9uKG5ldyBOdWxsTG9nU2VydmljZSgpKSk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmluaXRpYWxpemUoKTtcblxuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdFx0J2lkJzogJ2EnLFxuXHRcdFx0J29yZGVyJzogMSxcblx0XHRcdCd0aXRsZSc6ICdhJyxcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J2InOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogJ2InLFxuXHRcdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdCdkZWZhdWx0JzogZmFsc2UsXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHRjb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJEZWZhdWx0Q29uZmlndXJhdGlvbnMoW3tcblx0XHRcdG92ZXJyaWRlczoge1xuXHRcdFx0XHQnW2FdJzoge1xuXHRcdFx0XHRcdCdiJzogdHJ1ZVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fV0pO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gdGVzdE9iamVjdC5jb25maWd1cmF0aW9uTW9kZWw7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0VmFsdWUoJ2InKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5vayhlcXVhbHMoYWN0dWFsLmdldFZhbHVlKCdbYV0nKSwgeyAnYic6IHRydWUgfSkpO1xuXHRcdGFzc2VydC5vayhlcXVhbHMoYWN0dWFsLmNvbnRlbnRzLCB7ICdiJzogZmFsc2UsICdbYV0nOiB7ICdiJzogdHJ1ZSB9IH0pKTtcblx0XHRhc3NlcnQub2soZXF1YWxzKGFjdHVhbC5vdmVycmlkZXMsIFt7IGNvbnRlbnRzOiB7ICdiJzogdHJ1ZSB9LCBpZGVudGlmaWVyczogWydhJ10sIGtleXM6IFsnYiddIH1dKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwua2V5cy5zb3J0KCksIFsnW2FdJywgJ2InXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5nZXRPdmVycmlkZVZhbHVlKCdiJywgJ2EnKSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlc3QgZGVyZWdpc3RlcmluZyBhIHByb3BlcnR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERlZmF1bHRDb25maWd1cmF0aW9uKG5ldyBOdWxsTG9nU2VydmljZSgpKSk7XG5cdFx0Y29uc3QgcHJvbWlzZSA9IEV2ZW50LnRvUHJvbWlzZSh0ZXN0T2JqZWN0Lm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbik7XG5cdFx0Y29uc3Qgbm9kZTogSUNvbmZpZ3VyYXRpb25Ob2RlID0ge1xuXHRcdFx0J2lkJzogJ2EnLFxuXHRcdFx0J29yZGVyJzogMSxcblx0XHRcdCd0aXRsZSc6ICdhJyxcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J2EnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogJ2EnLFxuXHRcdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdCdkZWZhdWx0JzogZmFsc2UsXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24obm9kZSk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5pbml0aWFsaXplKCk7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LmRlcmVnaXN0ZXJDb25maWd1cmF0aW9ucyhbbm9kZV0pO1xuXG5cdFx0Y29uc3QgeyBkZWZhdWx0czogYWN0dWFsLCBwcm9wZXJ0aWVzIH0gPSBhd2FpdCBwcm9taXNlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2V0VmFsdWUoJ2EnKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQub2soZXF1YWxzKGFjdHVhbC5jb250ZW50cywge30pKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5rZXlzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm9wZXJ0aWVzLCBbJ2EnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlc3QgZGVyZWdpc3RlcmluZyBhbiBvdmVycmlkZSBpZGVudGlmaWVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERlZmF1bHRDb25maWd1cmF0aW9uKG5ldyBOdWxsTG9nU2VydmljZSgpKSk7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQnaWQnOiAnYScsXG5cdFx0XHQnb3JkZXInOiAxLFxuXHRcdFx0J3RpdGxlJzogJ2EnLFxuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnYic6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiAnYicsXG5cdFx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZSxcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGNvbnN0IG5vZGUgPSB7XG5cdFx0XHRvdmVycmlkZXM6IHtcblx0XHRcdFx0J1thXSc6IHtcblx0XHRcdFx0XHQnYic6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKFtub2RlXSk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5pbml0aWFsaXplKCk7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LmRlcmVnaXN0ZXJEZWZhdWx0Q29uZmlndXJhdGlvbnMoW25vZGVdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmlndXJhdGlvbk1vZGVsLmdldFZhbHVlKCdbYV0nKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQub2soZXF1YWxzKHRlc3RPYmplY3QuY29uZmlndXJhdGlvbk1vZGVsLmNvbnRlbnRzLCB7ICdiJzogZmFsc2UgfSkpO1xuXHRcdGFzc2VydC5vayhlcXVhbHModGVzdE9iamVjdC5jb25maWd1cmF0aW9uTW9kZWwub3ZlcnJpZGVzLCBbXSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25maWd1cmF0aW9uTW9kZWwua2V5cywgWydiJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZpZ3VyYXRpb25Nb2RlbC5nZXRPdmVycmlkZVZhbHVlKCdiJywgJ2EnKSwgdW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgnVGVzdCBkZXJlZ2lzdGVyaW5nIGEgbWVyZ2VkIGxhbmd1YWdlIG9iamVjdCBzZXR0aW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERlZmF1bHRDb25maWd1cmF0aW9uKG5ldyBOdWxsTG9nU2VydmljZSgpKSk7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQnaWQnOiAnYicsXG5cdFx0XHQnb3JkZXInOiAxLFxuXHRcdFx0J3RpdGxlJzogJ2InLFxuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnYic6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiAnYicsXG5cdFx0XHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHQnZGVmYXVsdCc6IHt9LFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0Y29uc3Qgbm9kZTEgPSB7XG5cdFx0XHRvdmVycmlkZXM6IHtcblx0XHRcdFx0J1thXSc6IHtcblx0XHRcdFx0XHQnYic6IHtcblx0XHRcdFx0XHRcdCdhYSc6ICcxJyxcblx0XHRcdFx0XHRcdCdiYic6ICcyJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHNvdXJjZTogeyBpZDogJ3NvdXJjZTEnLCBkaXNwbGF5TmFtZTogJ3NvdXJjZTEnIH1cblx0XHR9O1xuXG5cdFx0Y29uc3Qgbm9kZTIgPSB7XG5cdFx0XHRvdmVycmlkZXM6IHtcblx0XHRcdFx0J1thXSc6IHtcblx0XHRcdFx0XHQnYic6IHtcblx0XHRcdFx0XHRcdCdiYic6ICcyMCcsXG5cdFx0XHRcdFx0XHQnY2MnOiAnMzAnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0c291cmNlOiB7IGlkOiAnc291cmNlMicsIGRpc3BsYXlOYW1lOiAnc291cmNlMicgfVxuXHRcdH07XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKFtub2RlMV0pO1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhbbm9kZTJdKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmluaXRpYWxpemUoKTtcblxuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5kZXJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKFtub2RlMV0pO1xuXHRcdGFzc2VydC5vayhlcXVhbHModGVzdE9iamVjdC5jb25maWd1cmF0aW9uTW9kZWwuZ2V0VmFsdWUoJ1thXScpLCB7ICdiJzogeyAnYmInOiAnMjAnLCAnY2MnOiAnMzAnIH0gfSkpO1xuXHRcdGFzc2VydC5vayhlcXVhbHModGVzdE9iamVjdC5jb25maWd1cmF0aW9uTW9kZWwuY29udGVudHMsIHsgJ1thXSc6IHsgJ2InOiB7ICdiYic6ICcyMCcsICdjYyc6ICczMCcgfSB9LCAnYic6IHt9IH0pKTtcblx0XHRhc3NlcnQub2soZXF1YWxzKHRlc3RPYmplY3QuY29uZmlndXJhdGlvbk1vZGVsLm92ZXJyaWRlcywgW3sgY29udGVudHM6IHsgJ2InOiB7ICdiYic6ICcyMCcsICdjYyc6ICczMCcgfSB9LCBpZGVudGlmaWVyczogWydhJ10sIGtleXM6IFsnYiddIH1dKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZpZ3VyYXRpb25Nb2RlbC5rZXlzLnNvcnQoKSwgWydbYV0nLCAnYiddKTtcblx0XHRhc3NlcnQub2soZXF1YWxzKHRlc3RPYmplY3QuY29uZmlndXJhdGlvbk1vZGVsLmdldE92ZXJyaWRlVmFsdWUoJ2InLCAnYScpLCB7ICdiYic6ICcyMCcsICdjYyc6ICczMCcgfSkpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsYUFBYTtBQUN0QixTQUFTLGNBQWM7QUFDdkIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxrQkFBOEQ7QUFDdkUsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBZ0I7QUFFekIsTUFBTSx3QkFBd0IsTUFBTTtBQUVuQyxRQUFNLGNBQWMsd0NBQXdDO0FBQzVELFFBQU0sd0JBQXdCLFNBQVMsR0FBMkIsV0FBVyxhQUFhO0FBRTFGLFFBQU0sTUFBTSxNQUFNLENBQUM7QUFDbkIsV0FBUyxNQUFNLE1BQU0sQ0FBQztBQUV0QixXQUFTLFFBQVE7QUFDaEIsMEJBQXNCLHlCQUF5QixzQkFBc0Isa0JBQWtCLENBQUM7QUFDeEYsMEJBQXNCLGdDQUFnQyxzQkFBc0IsbUNBQW1DLENBQUM7QUFBQSxFQUNqSDtBQUVBLE9BQUssaURBQWlELFlBQVk7QUFDakUsVUFBTSxhQUFhLFlBQVksSUFBSSxJQUFJLHFCQUFxQixJQUFJLGVBQWUsQ0FBQyxDQUFDO0FBQ2pGLDBCQUFzQixzQkFBc0I7QUFBQSxNQUMzQyxNQUFNO0FBQUEsTUFDTixTQUFTO0FBQUEsTUFDVCxTQUFTO0FBQUEsTUFDVCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsUUFDYixLQUFLO0FBQUEsVUFDSixlQUFlO0FBQUEsVUFDZixRQUFRO0FBQUEsVUFDUixXQUFXO0FBQUEsUUFDWjtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFDRCxVQUFNLFNBQVMsTUFBTSxXQUFXLFdBQVc7QUFDM0MsV0FBTyxZQUFZLE9BQU8sU0FBUyxHQUFHLEdBQUcsS0FBSztBQUFBLEVBQy9DLENBQUM7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
