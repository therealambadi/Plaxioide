import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { Extensions as ConfigurationExtensions } from "../../common/configurationRegistry.js";
import { Registry } from "../../../registry/common/platform.js";
suite("ConfigurationRegistry", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
  setup(() => reset());
  teardown(() => reset());
  function reset() {
    configurationRegistry.deregisterConfigurations(configurationRegistry.getConfigurations());
    configurationRegistry.deregisterDefaultConfigurations(configurationRegistry.getRegisteredDefaultConfigurations());
  }
  test("configuration override", async () => {
    configurationRegistry.registerConfiguration({
      "id": "_test_default",
      "type": "object",
      "properties": {
        "config": {
          "type": "object"
        }
      }
    });
    configurationRegistry.registerDefaultConfigurations([{ overrides: { "config": { a: 1, b: 2 } } }]);
    configurationRegistry.registerDefaultConfigurations([{ overrides: { "[lang]": { a: 2, c: 3 } } }]);
    assert.deepStrictEqual(configurationRegistry.getConfigurationProperties()["config"].default, { a: 1, b: 2 });
    assert.deepStrictEqual(configurationRegistry.getConfigurationProperties()["[lang]"].default, { a: 2, c: 3 });
  });
  test("configuration override defaults - prevent overriding default value", async () => {
    configurationRegistry.registerConfiguration({
      "id": "_test_default",
      "type": "object",
      "properties": {
        "config.preventDefaultValueOverride": {
          "type": "object",
          default: { a: 0 },
          "disallowConfigurationDefault": true
        }
      }
    });
    configurationRegistry.registerDefaultConfigurations([{ overrides: { "config.preventDefaultValueOverride": { a: 1, b: 2 } } }]);
    assert.deepStrictEqual(configurationRegistry.getConfigurationProperties()["config.preventDefaultValueOverride"].default, { a: 0 });
  });
  test("configuration override defaults - merges defaults", async () => {
    configurationRegistry.registerDefaultConfigurations([{ overrides: { "[lang]": { a: 1, b: 2 } } }]);
    configurationRegistry.registerDefaultConfigurations([{ overrides: { "[lang]": { a: 2, c: 3 } } }]);
    assert.deepStrictEqual(configurationRegistry.getConfigurationProperties()["[lang]"].default, { a: 2, b: 2, c: 3 });
  });
  test("configuration defaults - merge object default overrides", async () => {
    configurationRegistry.registerConfiguration({
      "id": "_test_default",
      "type": "object",
      "properties": {
        "config": {
          "type": "object"
        }
      }
    });
    configurationRegistry.registerDefaultConfigurations([{ overrides: { "config": { a: 1, b: 2 } } }]);
    configurationRegistry.registerDefaultConfigurations([{ overrides: { "config": { a: 2, c: 3 } } }]);
    assert.deepStrictEqual(configurationRegistry.getConfigurationProperties()["config"].default, { a: 2, b: 2, c: 3 });
  });
  test("registering multiple settings with same policy", async () => {
    configurationRegistry.registerConfiguration({
      "id": "_test_default",
      "type": "object",
      "properties": {
        "policy1": {
          "type": "object",
          policy: {
            name: "policy",
            minimumVersion: "1.0.0"
          }
        },
        "policy2": {
          "type": "object",
          policy: {
            name: "policy",
            minimumVersion: "1.0.0"
          }
        }
      }
    });
    const actual = configurationRegistry.getConfigurationProperties();
    assert.ok(actual["policy1"] !== void 0);
    assert.ok(actual["policy2"] === void 0);
  });
  test("configuration defaults - deregister merged object default override", async () => {
    configurationRegistry.registerConfiguration({
      "id": "_test_default",
      "type": "object",
      "properties": {
        "config": {
          "type": "object"
        }
      }
    });
    const overrides1 = [{ overrides: { "config": { a: 1, b: 2 } }, source: { id: "source1", displayName: "source1" } }];
    const overrides2 = [{ overrides: { "config": { a: 2, c: 3 } }, source: { id: "source2", displayName: "source2" } }];
    configurationRegistry.registerDefaultConfigurations(overrides1);
    configurationRegistry.registerDefaultConfigurations(overrides2);
    assert.deepStrictEqual(configurationRegistry.getConfigurationProperties()["config"].default, { a: 2, b: 2, c: 3 });
    configurationRegistry.deregisterDefaultConfigurations(overrides2);
    assert.deepStrictEqual(configurationRegistry.getConfigurationProperties()["config"].default, { a: 1, b: 2 });
    configurationRegistry.deregisterDefaultConfigurations(overrides1);
    assert.deepStrictEqual(configurationRegistry.getConfigurationProperties()["config"].default, {});
  });
  test("configuration defaults - deregister merged object default override without source", async () => {
    configurationRegistry.registerConfiguration({
      "id": "_test_default",
      "type": "object",
      "properties": {
        "config": {
          "type": "object"
        }
      }
    });
    const overrides1 = [{ overrides: { "config": { a: 1, b: 2 } } }];
    const overrides2 = [{ overrides: { "config": { a: 2, c: 3 } } }];
    configurationRegistry.registerDefaultConfigurations(overrides1);
    configurationRegistry.registerDefaultConfigurations(overrides2);
    assert.deepStrictEqual(configurationRegistry.getConfigurationProperties()["config"].default, { a: 2, b: 2, c: 3 });
    configurationRegistry.deregisterDefaultConfigurations(overrides2);
    assert.deepStrictEqual(configurationRegistry.getConfigurationProperties()["config"].default, { a: 1, b: 2 });
    configurationRegistry.deregisterDefaultConfigurations(overrides1);
    assert.deepStrictEqual(configurationRegistry.getConfigurationProperties()["config"].default, {});
  });
  test("configuration defaults - deregister merged object default language overrides", async () => {
    configurationRegistry.registerConfiguration({
      "id": "_test_default",
      "type": "object",
      "properties": {
        "config": {
          "type": "object"
        }
      }
    });
    const overrides1 = [{ overrides: { "[lang]": { "config": { a: 1, b: 2 } } }, source: { id: "source1", displayName: "source1" } }];
    const overrides2 = [{ overrides: { "[lang]": { "config": { a: 2, c: 3 } } }, source: { id: "source2", displayName: "source2" } }];
    configurationRegistry.registerDefaultConfigurations(overrides1);
    configurationRegistry.registerDefaultConfigurations(overrides2);
    assert.deepStrictEqual(configurationRegistry.getConfigurationProperties()["[lang]"].default, { "config": { a: 2, b: 2, c: 3 } });
    configurationRegistry.deregisterDefaultConfigurations(overrides2);
    assert.deepStrictEqual(configurationRegistry.getConfigurationProperties()["[lang]"].default, { "config": { a: 1, b: 2 } });
    configurationRegistry.deregisterDefaultConfigurations(overrides1);
    assert.deepStrictEqual(configurationRegistry.getConfigurationProperties()["[lang]"], void 0);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLCBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5cbnN1aXRlKCdDb25maWd1cmF0aW9uUmVnaXN0cnknLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbik7XG5cblx0c2V0dXAoKCkgPT4gcmVzZXQoKSk7XG5cdHRlYXJkb3duKCgpID0+IHJlc2V0KCkpO1xuXG5cdGZ1bmN0aW9uIHJlc2V0KCkge1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5kZXJlZ2lzdGVyQ29uZmlndXJhdGlvbnMoY29uZmlndXJhdGlvblJlZ2lzdHJ5LmdldENvbmZpZ3VyYXRpb25zKCkpO1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5kZXJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5nZXRSZWdpc3RlcmVkRGVmYXVsdENvbmZpZ3VyYXRpb25zKCkpO1xuXHR9XG5cblx0dGVzdCgnY29uZmlndXJhdGlvbiBvdmVycmlkZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0XHRcdCdpZCc6ICdfdGVzdF9kZWZhdWx0Jyxcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J2NvbmZpZyc6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKFt7IG92ZXJyaWRlczogeyAnY29uZmlnJzogeyBhOiAxLCBiOiAyIH0gfSB9XSk7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKFt7IG92ZXJyaWRlczogeyAnW2xhbmddJzogeyBhOiAyLCBjOiAzIH0gfSB9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5nZXRDb25maWd1cmF0aW9uUHJvcGVydGllcygpWydjb25maWcnXS5kZWZhdWx0LCB7IGE6IDEsIGI6IDIgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb25maWd1cmF0aW9uUmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKVsnW2xhbmddJ10uZGVmYXVsdCwgeyBhOiAyLCBjOiAzIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25maWd1cmF0aW9uIG92ZXJyaWRlIGRlZmF1bHRzIC0gcHJldmVudCBvdmVycmlkaW5nIGRlZmF1bHQgdmFsdWUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQnaWQnOiAnX3Rlc3RfZGVmYXVsdCcsXG5cdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdjb25maWcucHJldmVudERlZmF1bHRWYWx1ZU92ZXJyaWRlJzoge1xuXHRcdFx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHRcdFx0ZGVmYXVsdDogeyBhOiAwIH0sXG5cdFx0XHRcdFx0J2Rpc2FsbG93Q29uZmlndXJhdGlvbkRlZmF1bHQnOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhbeyBvdmVycmlkZXM6IHsgJ2NvbmZpZy5wcmV2ZW50RGVmYXVsdFZhbHVlT3ZlcnJpZGUnOiB7IGE6IDEsIGI6IDIgfSB9IH1dKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29uZmlndXJhdGlvblJlZ2lzdHJ5LmdldENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzKClbJ2NvbmZpZy5wcmV2ZW50RGVmYXVsdFZhbHVlT3ZlcnJpZGUnXS5kZWZhdWx0LCB7IGE6IDAgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbmZpZ3VyYXRpb24gb3ZlcnJpZGUgZGVmYXVsdHMgLSBtZXJnZXMgZGVmYXVsdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKFt7IG92ZXJyaWRlczogeyAnW2xhbmddJzogeyBhOiAxLCBiOiAyIH0gfSB9XSk7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKFt7IG92ZXJyaWRlczogeyAnW2xhbmddJzogeyBhOiAyLCBjOiAzIH0gfSB9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5nZXRDb25maWd1cmF0aW9uUHJvcGVydGllcygpWydbbGFuZ10nXS5kZWZhdWx0LCB7IGE6IDIsIGI6IDIsIGM6IDMgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbmZpZ3VyYXRpb24gZGVmYXVsdHMgLSBtZXJnZSBvYmplY3QgZGVmYXVsdCBvdmVycmlkZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQnaWQnOiAnX3Rlc3RfZGVmYXVsdCcsXG5cdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdjb25maWcnOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhbeyBvdmVycmlkZXM6IHsgJ2NvbmZpZyc6IHsgYTogMSwgYjogMiB9IH0gfV0pO1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhbeyBvdmVycmlkZXM6IHsgJ2NvbmZpZyc6IHsgYTogMiwgYzogMyB9IH0gfV0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb25maWd1cmF0aW9uUmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKVsnY29uZmlnJ10uZGVmYXVsdCwgeyBhOiAyLCBiOiAyLCBjOiAzIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWdpc3RlcmluZyBtdWx0aXBsZSBzZXR0aW5ncyB3aXRoIHNhbWUgcG9saWN5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdFx0J2lkJzogJ190ZXN0X2RlZmF1bHQnLFxuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQncG9saWN5MSc6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0XHRcdHBvbGljeToge1xuXHRcdFx0XHRcdFx0bmFtZTogJ3BvbGljeScsXG5cdFx0XHRcdFx0XHRtaW5pbXVtVmVyc2lvbjogJzEuMC4wJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0J3BvbGljeTInOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRwb2xpY3k6IHtcblx0XHRcdFx0XHRcdG5hbWU6ICdwb2xpY3knLFxuXHRcdFx0XHRcdFx0bWluaW11bVZlcnNpb246ICcxLjAuMCdcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHRjb25zdCBhY3R1YWwgPSBjb25maWd1cmF0aW9uUmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKTtcblx0XHRhc3NlcnQub2soYWN0dWFsWydwb2xpY3kxJ10gIT09IHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbFsncG9saWN5MiddID09PSB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25maWd1cmF0aW9uIGRlZmF1bHRzIC0gZGVyZWdpc3RlciBtZXJnZWQgb2JqZWN0IGRlZmF1bHQgb3ZlcnJpZGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQnaWQnOiAnX3Rlc3RfZGVmYXVsdCcsXG5cdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdjb25maWcnOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgb3ZlcnJpZGVzMSA9IFt7IG92ZXJyaWRlczogeyAnY29uZmlnJzogeyBhOiAxLCBiOiAyIH0gfSwgc291cmNlOiB7IGlkOiAnc291cmNlMScsIGRpc3BsYXlOYW1lOiAnc291cmNlMScgfSB9XTtcblx0XHRjb25zdCBvdmVycmlkZXMyID0gW3sgb3ZlcnJpZGVzOiB7ICdjb25maWcnOiB7IGE6IDIsIGM6IDMgfSB9LCBzb3VyY2U6IHsgaWQ6ICdzb3VyY2UyJywgZGlzcGxheU5hbWU6ICdzb3VyY2UyJyB9IH1dO1xuXG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKG92ZXJyaWRlczEpO1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhvdmVycmlkZXMyKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29uZmlndXJhdGlvblJlZ2lzdHJ5LmdldENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzKClbJ2NvbmZpZyddLmRlZmF1bHQsIHsgYTogMiwgYjogMiwgYzogMyB9KTtcblxuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5kZXJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKG92ZXJyaWRlczIpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb25maWd1cmF0aW9uUmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKVsnY29uZmlnJ10uZGVmYXVsdCwgeyBhOiAxLCBiOiAyIH0pO1xuXG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LmRlcmVnaXN0ZXJEZWZhdWx0Q29uZmlndXJhdGlvbnMob3ZlcnJpZGVzMSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5nZXRDb25maWd1cmF0aW9uUHJvcGVydGllcygpWydjb25maWcnXS5kZWZhdWx0LCB7fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbmZpZ3VyYXRpb24gZGVmYXVsdHMgLSBkZXJlZ2lzdGVyIG1lcmdlZCBvYmplY3QgZGVmYXVsdCBvdmVycmlkZSB3aXRob3V0IHNvdXJjZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0XHRcdCdpZCc6ICdfdGVzdF9kZWZhdWx0Jyxcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J2NvbmZpZyc6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBvdmVycmlkZXMxID0gW3sgb3ZlcnJpZGVzOiB7ICdjb25maWcnOiB7IGE6IDEsIGI6IDIgfSB9IH1dO1xuXHRcdGNvbnN0IG92ZXJyaWRlczIgPSBbeyBvdmVycmlkZXM6IHsgJ2NvbmZpZyc6IHsgYTogMiwgYzogMyB9IH0gfV07XG5cblx0XHRjb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJEZWZhdWx0Q29uZmlndXJhdGlvbnMob3ZlcnJpZGVzMSk7XG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKG92ZXJyaWRlczIpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb25maWd1cmF0aW9uUmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKVsnY29uZmlnJ10uZGVmYXVsdCwgeyBhOiAyLCBiOiAyLCBjOiAzIH0pO1xuXG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LmRlcmVnaXN0ZXJEZWZhdWx0Q29uZmlndXJhdGlvbnMob3ZlcnJpZGVzMik7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5nZXRDb25maWd1cmF0aW9uUHJvcGVydGllcygpWydjb25maWcnXS5kZWZhdWx0LCB7IGE6IDEsIGI6IDIgfSk7XG5cblx0XHRjb25maWd1cmF0aW9uUmVnaXN0cnkuZGVyZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhvdmVycmlkZXMxKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29uZmlndXJhdGlvblJlZ2lzdHJ5LmdldENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzKClbJ2NvbmZpZyddLmRlZmF1bHQsIHt9KTtcblx0fSk7XG5cblx0dGVzdCgnY29uZmlndXJhdGlvbiBkZWZhdWx0cyAtIGRlcmVnaXN0ZXIgbWVyZ2VkIG9iamVjdCBkZWZhdWx0IGxhbmd1YWdlIG92ZXJyaWRlcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0XHRcdCdpZCc6ICdfdGVzdF9kZWZhdWx0Jyxcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J2NvbmZpZyc6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBvdmVycmlkZXMxID0gW3sgb3ZlcnJpZGVzOiB7ICdbbGFuZ10nOiB7ICdjb25maWcnOiB7IGE6IDEsIGI6IDIgfSB9IH0sIHNvdXJjZTogeyBpZDogJ3NvdXJjZTEnLCBkaXNwbGF5TmFtZTogJ3NvdXJjZTEnIH0gfV07XG5cdFx0Y29uc3Qgb3ZlcnJpZGVzMiA9IFt7IG92ZXJyaWRlczogeyAnW2xhbmddJzogeyAnY29uZmlnJzogeyBhOiAyLCBjOiAzIH0gfSB9LCBzb3VyY2U6IHsgaWQ6ICdzb3VyY2UyJywgZGlzcGxheU5hbWU6ICdzb3VyY2UyJyB9IH1dO1xuXG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKG92ZXJyaWRlczEpO1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhvdmVycmlkZXMyKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29uZmlndXJhdGlvblJlZ2lzdHJ5LmdldENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzKClbJ1tsYW5nXSddLmRlZmF1bHQsIHsgJ2NvbmZpZyc6IHsgYTogMiwgYjogMiwgYzogMyB9IH0pO1xuXG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LmRlcmVnaXN0ZXJEZWZhdWx0Q29uZmlndXJhdGlvbnMob3ZlcnJpZGVzMik7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5nZXRDb25maWd1cmF0aW9uUHJvcGVydGllcygpWydbbGFuZ10nXS5kZWZhdWx0LCB7ICdjb25maWcnOiB7IGE6IDEsIGI6IDIgfSB9KTtcblxuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5kZXJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKG92ZXJyaWRlczEpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb25maWd1cmF0aW9uUmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKVsnW2xhbmddJ10sIHVuZGVmaW5lZCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxjQUFjLCtCQUF1RDtBQUM5RSxTQUFTLGdCQUFnQjtBQUV6QixNQUFNLHlCQUF5QixNQUFNO0FBRXBDLDBDQUF3QztBQUV4QyxRQUFNLHdCQUF3QixTQUFTLEdBQTJCLHdCQUF3QixhQUFhO0FBRXZHLFFBQU0sTUFBTSxNQUFNLENBQUM7QUFDbkIsV0FBUyxNQUFNLE1BQU0sQ0FBQztBQUV0QixXQUFTLFFBQVE7QUFDaEIsMEJBQXNCLHlCQUF5QixzQkFBc0Isa0JBQWtCLENBQUM7QUFDeEYsMEJBQXNCLGdDQUFnQyxzQkFBc0IsbUNBQW1DLENBQUM7QUFBQSxFQUNqSDtBQUVBLE9BQUssMEJBQTBCLFlBQVk7QUFDMUMsMEJBQXNCLHNCQUFzQjtBQUFBLE1BQzNDLE1BQU07QUFBQSxNQUNOLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxRQUNiLFVBQVU7QUFBQSxVQUNULFFBQVE7QUFBQSxRQUNUO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUNELDBCQUFzQiw4QkFBOEIsQ0FBQyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ2pHLDBCQUFzQiw4QkFBOEIsQ0FBQyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBRWpHLFdBQU8sZ0JBQWdCLHNCQUFzQiwyQkFBMkIsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUMzRyxXQUFPLGdCQUFnQixzQkFBc0IsMkJBQTJCLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLENBQUM7QUFBQSxFQUM1RyxDQUFDO0FBRUQsT0FBSyxzRUFBc0UsWUFBWTtBQUN0RiwwQkFBc0Isc0JBQXNCO0FBQUEsTUFDM0MsTUFBTTtBQUFBLE1BQ04sUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLFFBQ2Isc0NBQXNDO0FBQUEsVUFDckMsUUFBUTtBQUFBLFVBQ1IsU0FBUyxFQUFFLEdBQUcsRUFBRTtBQUFBLFVBQ2hCLGdDQUFnQztBQUFBLFFBQ2pDO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUVELDBCQUFzQiw4QkFBOEIsQ0FBQyxFQUFFLFdBQVcsRUFBRSxzQ0FBc0MsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFFN0gsV0FBTyxnQkFBZ0Isc0JBQXNCLDJCQUEyQixFQUFFLG9DQUFvQyxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQztBQUFBLEVBQ2xJLENBQUM7QUFFRCxPQUFLLHFEQUFxRCxZQUFZO0FBQ3JFLDBCQUFzQiw4QkFBOEIsQ0FBQyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ2pHLDBCQUFzQiw4QkFBOEIsQ0FBQyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBRWpHLFdBQU8sZ0JBQWdCLHNCQUFzQiwyQkFBMkIsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxFQUFFLENBQUM7QUFBQSxFQUNsSCxDQUFDO0FBRUQsT0FBSywyREFBMkQsWUFBWTtBQUMzRSwwQkFBc0Isc0JBQXNCO0FBQUEsTUFDM0MsTUFBTTtBQUFBLE1BQ04sUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLFFBQ2IsVUFBVTtBQUFBLFVBQ1QsUUFBUTtBQUFBLFFBQ1Q7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBQ0QsMEJBQXNCLDhCQUE4QixDQUFDLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDakcsMEJBQXNCLDhCQUE4QixDQUFDLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFFakcsV0FBTyxnQkFBZ0Isc0JBQXNCLDJCQUEyQixFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUFBLEVBQ2xILENBQUM7QUFFRCxPQUFLLGtEQUFrRCxZQUFZO0FBQ2xFLDBCQUFzQixzQkFBc0I7QUFBQSxNQUMzQyxNQUFNO0FBQUEsTUFDTixRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsUUFDYixXQUFXO0FBQUEsVUFDVixRQUFRO0FBQUEsVUFDUixRQUFRO0FBQUEsWUFDUCxNQUFNO0FBQUEsWUFDTixnQkFBZ0I7QUFBQSxVQUNqQjtBQUFBLFFBQ0Q7QUFBQSxRQUNBLFdBQVc7QUFBQSxVQUNWLFFBQVE7QUFBQSxVQUNSLFFBQVE7QUFBQSxZQUNQLE1BQU07QUFBQSxZQUNOLGdCQUFnQjtBQUFBLFVBQ2pCO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFDRCxVQUFNLFNBQVMsc0JBQXNCLDJCQUEyQjtBQUNoRSxXQUFPLEdBQUcsT0FBTyxTQUFTLE1BQU0sTUFBUztBQUN6QyxXQUFPLEdBQUcsT0FBTyxTQUFTLE1BQU0sTUFBUztBQUFBLEVBQzFDLENBQUM7QUFFRCxPQUFLLHNFQUFzRSxZQUFZO0FBQ3RGLDBCQUFzQixzQkFBc0I7QUFBQSxNQUMzQyxNQUFNO0FBQUEsTUFDTixRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsUUFDYixVQUFVO0FBQUEsVUFDVCxRQUFRO0FBQUEsUUFDVDtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFFRCxVQUFNLGFBQWEsQ0FBQyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxFQUFFLEdBQUcsUUFBUSxFQUFFLElBQUksV0FBVyxhQUFhLFVBQVUsRUFBRSxDQUFDO0FBQ2xILFVBQU0sYUFBYSxDQUFDLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLEVBQUUsR0FBRyxRQUFRLEVBQUUsSUFBSSxXQUFXLGFBQWEsVUFBVSxFQUFFLENBQUM7QUFFbEgsMEJBQXNCLDhCQUE4QixVQUFVO0FBQzlELDBCQUFzQiw4QkFBOEIsVUFBVTtBQUU5RCxXQUFPLGdCQUFnQixzQkFBc0IsMkJBQTJCLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsRUFBRSxDQUFDO0FBRWpILDBCQUFzQixnQ0FBZ0MsVUFBVTtBQUVoRSxXQUFPLGdCQUFnQixzQkFBc0IsMkJBQTJCLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLENBQUM7QUFFM0csMEJBQXNCLGdDQUFnQyxVQUFVO0FBRWhFLFdBQU8sZ0JBQWdCLHNCQUFzQiwyQkFBMkIsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFBQSxFQUNoRyxDQUFDO0FBRUQsT0FBSyxxRkFBcUYsWUFBWTtBQUNyRywwQkFBc0Isc0JBQXNCO0FBQUEsTUFDM0MsTUFBTTtBQUFBLE1BQ04sUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLFFBQ2IsVUFBVTtBQUFBLFVBQ1QsUUFBUTtBQUFBLFFBQ1Q7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBRUQsVUFBTSxhQUFhLENBQUMsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsRUFBRSxFQUFFLENBQUM7QUFDL0QsVUFBTSxhQUFhLENBQUMsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsRUFBRSxFQUFFLENBQUM7QUFFL0QsMEJBQXNCLDhCQUE4QixVQUFVO0FBQzlELDBCQUFzQiw4QkFBOEIsVUFBVTtBQUU5RCxXQUFPLGdCQUFnQixzQkFBc0IsMkJBQTJCLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsRUFBRSxDQUFDO0FBRWpILDBCQUFzQixnQ0FBZ0MsVUFBVTtBQUVoRSxXQUFPLGdCQUFnQixzQkFBc0IsMkJBQTJCLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLENBQUM7QUFFM0csMEJBQXNCLGdDQUFnQyxVQUFVO0FBRWhFLFdBQU8sZ0JBQWdCLHNCQUFzQiwyQkFBMkIsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFBQSxFQUNoRyxDQUFDO0FBRUQsT0FBSyxnRkFBZ0YsWUFBWTtBQUNoRywwQkFBc0Isc0JBQXNCO0FBQUEsTUFDM0MsTUFBTTtBQUFBLE1BQ04sUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLFFBQ2IsVUFBVTtBQUFBLFVBQ1QsUUFBUTtBQUFBLFFBQ1Q7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBRUQsVUFBTSxhQUFhLENBQUMsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLEVBQUUsRUFBRSxHQUFHLFFBQVEsRUFBRSxJQUFJLFdBQVcsYUFBYSxVQUFVLEVBQUUsQ0FBQztBQUNoSSxVQUFNLGFBQWEsQ0FBQyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsUUFBUSxFQUFFLElBQUksV0FBVyxhQUFhLFVBQVUsRUFBRSxDQUFDO0FBRWhJLDBCQUFzQiw4QkFBOEIsVUFBVTtBQUM5RCwwQkFBc0IsOEJBQThCLFVBQVU7QUFFOUQsV0FBTyxnQkFBZ0Isc0JBQXNCLDJCQUEyQixFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxFQUFFLEVBQUUsQ0FBQztBQUUvSCwwQkFBc0IsZ0NBQWdDLFVBQVU7QUFFaEUsV0FBTyxnQkFBZ0Isc0JBQXNCLDJCQUEyQixFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsRUFBRSxDQUFDO0FBRXpILDBCQUFzQixnQ0FBZ0MsVUFBVTtBQUVoRSxXQUFPLGdCQUFnQixzQkFBc0IsMkJBQTJCLEVBQUUsUUFBUSxHQUFHLE1BQVM7QUFBQSxFQUMvRixDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
