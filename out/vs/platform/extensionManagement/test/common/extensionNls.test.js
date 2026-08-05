import assert from "assert";
import { deepClone } from "../../../../base/common/objects.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { localizeManifest } from "../../common/extensionNls.js";
import { NullLogger } from "../../../log/common/log.js";
const manifest = {
  name: "test",
  publisher: "test",
  version: "1.0.0",
  engines: {
    vscode: "*"
  },
  contributes: {
    commands: [
      {
        command: "test.command",
        title: "%test.command.title%",
        category: "%test.command.category%"
      }
    ],
    authentication: [
      {
        id: "test.authentication",
        label: "%test.authentication.label%"
      }
    ],
    configuration: {
      // to ensure we test another "title" property
      title: "%test.configuration.title%",
      properties: {
        "test.configuration": {
          type: "string",
          description: "not important"
        }
      }
    }
  }
};
suite("Localize Manifest", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  test("replaces template strings", function() {
    const localizedManifest = localizeManifest(
      store.add(new NullLogger()),
      deepClone(manifest),
      {
        "test.command.title": "Test Command",
        "test.command.category": "Test Category",
        "test.authentication.label": "Test Authentication",
        "test.configuration.title": "Test Configuration"
      }
    );
    assert.strictEqual(localizedManifest.contributes?.commands?.[0].title, "Test Command");
    assert.strictEqual(localizedManifest.contributes?.commands?.[0].category, "Test Category");
    assert.strictEqual(localizedManifest.contributes?.authentication?.[0].label, "Test Authentication");
    assert.strictEqual((localizedManifest.contributes?.configuration).title, "Test Configuration");
  });
  test("replaces template strings with fallback if not found in translations", function() {
    const localizedManifest = localizeManifest(
      store.add(new NullLogger()),
      deepClone(manifest),
      {},
      {
        "test.command.title": "Test Command",
        "test.command.category": "Test Category",
        "test.authentication.label": "Test Authentication",
        "test.configuration.title": "Test Configuration"
      }
    );
    assert.strictEqual(localizedManifest.contributes?.commands?.[0].title, "Test Command");
    assert.strictEqual(localizedManifest.contributes?.commands?.[0].category, "Test Category");
    assert.strictEqual(localizedManifest.contributes?.authentication?.[0].label, "Test Authentication");
    assert.strictEqual((localizedManifest.contributes?.configuration).title, "Test Configuration");
  });
  test("replaces template strings - command title & categories become ILocalizedString", function() {
    const localizedManifest = localizeManifest(
      store.add(new NullLogger()),
      deepClone(manifest),
      {
        "test.command.title": "Befehl test",
        "test.command.category": "Testkategorie",
        "test.authentication.label": "Testauthentifizierung",
        "test.configuration.title": "Testkonfiguration"
      },
      {
        "test.command.title": "Test Command",
        "test.command.category": "Test Category",
        "test.authentication.label": "Test Authentication",
        "test.configuration.title": "Test Configuration"
      }
    );
    const title = localizedManifest.contributes?.commands?.[0].title;
    const category = localizedManifest.contributes?.commands?.[0].category;
    assert.strictEqual(title.value, "Befehl test");
    assert.strictEqual(title.original, "Test Command");
    assert.strictEqual(category.value, "Testkategorie");
    assert.strictEqual(category.original, "Test Category");
    assert.strictEqual(localizedManifest.contributes?.authentication?.[0].label, "Testauthentifizierung");
    assert.strictEqual((localizedManifest.contributes?.configuration).title, "Testkonfiguration");
  });
  test("replaces template strings - is best effort #164630", function() {
    const manifestWithTypo = {
      name: "test",
      publisher: "test",
      version: "1.0.0",
      engines: {
        vscode: "*"
      },
      contributes: {
        authentication: [
          {
            id: "test.authentication",
            // This not existing in the bundle shouldn't cause an error.
            label: "%doesnotexist%"
          }
        ],
        commands: [
          {
            command: "test.command",
            title: "%test.command.title%",
            category: "%test.command.category%"
          }
        ]
      }
    };
    const localizedManifest = localizeManifest(
      store.add(new NullLogger()),
      deepClone(manifestWithTypo),
      {
        "test.command.title": "Test Command",
        "test.command.category": "Test Category"
      }
    );
    assert.strictEqual(localizedManifest.contributes?.commands?.[0].title, "Test Command");
    assert.strictEqual(localizedManifest.contributes?.commands?.[0].category, "Test Category");
    assert.strictEqual(localizedManifest.contributes?.authentication?.[0].label, "%doesnotexist%");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L3Rlc3QvY29tbW9uL2V4dGVuc2lvbk5scy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZGVlcENsb25lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElMb2NhbGl6ZWRTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvbk5vZGUgfSBmcm9tICcuLi8uLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemVNYW5pZmVzdCB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRlbnNpb25ObHMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbk1hbmlmZXN0IH0gZnJvbSAnLi4vLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBOdWxsTG9nZ2VyIH0gZnJvbSAnLi4vLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuXG5jb25zdCBtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0ID0ge1xuXHRuYW1lOiAndGVzdCcsXG5cdHB1Ymxpc2hlcjogJ3Rlc3QnLFxuXHR2ZXJzaW9uOiAnMS4wLjAnLFxuXHRlbmdpbmVzOiB7XG5cdFx0dnNjb2RlOiAnKidcblx0fSxcblx0Y29udHJpYnV0ZXM6IHtcblx0XHRjb21tYW5kczogW1xuXHRcdFx0e1xuXHRcdFx0XHRjb21tYW5kOiAndGVzdC5jb21tYW5kJyxcblx0XHRcdFx0dGl0bGU6ICcldGVzdC5jb21tYW5kLnRpdGxlJScsXG5cdFx0XHRcdGNhdGVnb3J5OiAnJXRlc3QuY29tbWFuZC5jYXRlZ29yeSUnXG5cdFx0XHR9LFxuXHRcdF0sXG5cdFx0YXV0aGVudGljYXRpb246IFtcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICd0ZXN0LmF1dGhlbnRpY2F0aW9uJyxcblx0XHRcdFx0bGFiZWw6ICcldGVzdC5hdXRoZW50aWNhdGlvbi5sYWJlbCUnLFxuXHRcdFx0fVxuXHRcdF0sXG5cdFx0Y29uZmlndXJhdGlvbjoge1xuXHRcdFx0Ly8gdG8gZW5zdXJlIHdlIHRlc3QgYW5vdGhlciBcInRpdGxlXCIgcHJvcGVydHlcblx0XHRcdHRpdGxlOiAnJXRlc3QuY29uZmlndXJhdGlvbi50aXRsZSUnLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHQndGVzdC5jb25maWd1cmF0aW9uJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAnbm90IGltcG9ydGFudCcsXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cbn07XG5cbnN1aXRlKCdMb2NhbGl6ZSBNYW5pZmVzdCcsICgpID0+IHtcblx0Y29uc3Qgc3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblx0dGVzdCgncmVwbGFjZXMgdGVtcGxhdGUgc3RyaW5ncycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBsb2NhbGl6ZWRNYW5pZmVzdCA9IGxvY2FsaXplTWFuaWZlc3QoXG5cdFx0XHRzdG9yZS5hZGQobmV3IE51bGxMb2dnZXIoKSksXG5cdFx0XHRkZWVwQ2xvbmUobWFuaWZlc3QpLFxuXHRcdFx0e1xuXHRcdFx0XHQndGVzdC5jb21tYW5kLnRpdGxlJzogJ1Rlc3QgQ29tbWFuZCcsXG5cdFx0XHRcdCd0ZXN0LmNvbW1hbmQuY2F0ZWdvcnknOiAnVGVzdCBDYXRlZ29yeScsXG5cdFx0XHRcdCd0ZXN0LmF1dGhlbnRpY2F0aW9uLmxhYmVsJzogJ1Rlc3QgQXV0aGVudGljYXRpb24nLFxuXHRcdFx0XHQndGVzdC5jb25maWd1cmF0aW9uLnRpdGxlJzogJ1Rlc3QgQ29uZmlndXJhdGlvbicsXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsb2NhbGl6ZWRNYW5pZmVzdC5jb250cmlidXRlcz8uY29tbWFuZHM/LlswXS50aXRsZSwgJ1Rlc3QgQ29tbWFuZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsb2NhbGl6ZWRNYW5pZmVzdC5jb250cmlidXRlcz8uY29tbWFuZHM/LlswXS5jYXRlZ29yeSwgJ1Rlc3QgQ2F0ZWdvcnknKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobG9jYWxpemVkTWFuaWZlc3QuY29udHJpYnV0ZXM/LmF1dGhlbnRpY2F0aW9uPy5bMF0ubGFiZWwsICdUZXN0IEF1dGhlbnRpY2F0aW9uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChsb2NhbGl6ZWRNYW5pZmVzdC5jb250cmlidXRlcz8uY29uZmlndXJhdGlvbiBhcyBJQ29uZmlndXJhdGlvbk5vZGUpLnRpdGxlLCAnVGVzdCBDb25maWd1cmF0aW9uJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlcGxhY2VzIHRlbXBsYXRlIHN0cmluZ3Mgd2l0aCBmYWxsYmFjayBpZiBub3QgZm91bmQgaW4gdHJhbnNsYXRpb25zJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGxvY2FsaXplZE1hbmlmZXN0ID0gbG9jYWxpemVNYW5pZmVzdChcblx0XHRcdHN0b3JlLmFkZChuZXcgTnVsbExvZ2dlcigpKSxcblx0XHRcdGRlZXBDbG9uZShtYW5pZmVzdCksXG5cdFx0XHR7fSxcblx0XHRcdHtcblx0XHRcdFx0J3Rlc3QuY29tbWFuZC50aXRsZSc6ICdUZXN0IENvbW1hbmQnLFxuXHRcdFx0XHQndGVzdC5jb21tYW5kLmNhdGVnb3J5JzogJ1Rlc3QgQ2F0ZWdvcnknLFxuXHRcdFx0XHQndGVzdC5hdXRoZW50aWNhdGlvbi5sYWJlbCc6ICdUZXN0IEF1dGhlbnRpY2F0aW9uJyxcblx0XHRcdFx0J3Rlc3QuY29uZmlndXJhdGlvbi50aXRsZSc6ICdUZXN0IENvbmZpZ3VyYXRpb24nLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobG9jYWxpemVkTWFuaWZlc3QuY29udHJpYnV0ZXM/LmNvbW1hbmRzPy5bMF0udGl0bGUsICdUZXN0IENvbW1hbmQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobG9jYWxpemVkTWFuaWZlc3QuY29udHJpYnV0ZXM/LmNvbW1hbmRzPy5bMF0uY2F0ZWdvcnksICdUZXN0IENhdGVnb3J5Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxvY2FsaXplZE1hbmlmZXN0LmNvbnRyaWJ1dGVzPy5hdXRoZW50aWNhdGlvbj8uWzBdLmxhYmVsLCAnVGVzdCBBdXRoZW50aWNhdGlvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgobG9jYWxpemVkTWFuaWZlc3QuY29udHJpYnV0ZXM/LmNvbmZpZ3VyYXRpb24gYXMgSUNvbmZpZ3VyYXRpb25Ob2RlKS50aXRsZSwgJ1Rlc3QgQ29uZmlndXJhdGlvbicpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXBsYWNlcyB0ZW1wbGF0ZSBzdHJpbmdzIC0gY29tbWFuZCB0aXRsZSAmIGNhdGVnb3JpZXMgYmVjb21lIElMb2NhbGl6ZWRTdHJpbmcnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbG9jYWxpemVkTWFuaWZlc3QgPSBsb2NhbGl6ZU1hbmlmZXN0KFxuXHRcdFx0c3RvcmUuYWRkKG5ldyBOdWxsTG9nZ2VyKCkpLFxuXHRcdFx0ZGVlcENsb25lKG1hbmlmZXN0KSxcblx0XHRcdHtcblx0XHRcdFx0J3Rlc3QuY29tbWFuZC50aXRsZSc6ICdCZWZlaGwgdGVzdCcsXG5cdFx0XHRcdCd0ZXN0LmNvbW1hbmQuY2F0ZWdvcnknOiAnVGVzdGthdGVnb3JpZScsXG5cdFx0XHRcdCd0ZXN0LmF1dGhlbnRpY2F0aW9uLmxhYmVsJzogJ1Rlc3RhdXRoZW50aWZpemllcnVuZycsXG5cdFx0XHRcdCd0ZXN0LmNvbmZpZ3VyYXRpb24udGl0bGUnOiAnVGVzdGtvbmZpZ3VyYXRpb24nLFxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0J3Rlc3QuY29tbWFuZC50aXRsZSc6ICdUZXN0IENvbW1hbmQnLFxuXHRcdFx0XHQndGVzdC5jb21tYW5kLmNhdGVnb3J5JzogJ1Rlc3QgQ2F0ZWdvcnknLFxuXHRcdFx0XHQndGVzdC5hdXRoZW50aWNhdGlvbi5sYWJlbCc6ICdUZXN0IEF1dGhlbnRpY2F0aW9uJyxcblx0XHRcdFx0J3Rlc3QuY29uZmlndXJhdGlvbi50aXRsZSc6ICdUZXN0IENvbmZpZ3VyYXRpb24nLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHRjb25zdCB0aXRsZSA9IGxvY2FsaXplZE1hbmlmZXN0LmNvbnRyaWJ1dGVzPy5jb21tYW5kcz8uWzBdLnRpdGxlIGFzIElMb2NhbGl6ZWRTdHJpbmc7XG5cdFx0Y29uc3QgY2F0ZWdvcnkgPSBsb2NhbGl6ZWRNYW5pZmVzdC5jb250cmlidXRlcz8uY29tbWFuZHM/LlswXS5jYXRlZ29yeSBhcyBJTG9jYWxpemVkU3RyaW5nO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aXRsZS52YWx1ZSwgJ0JlZmVobCB0ZXN0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRpdGxlLm9yaWdpbmFsLCAnVGVzdCBDb21tYW5kJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhdGVnb3J5LnZhbHVlLCAnVGVzdGthdGVnb3JpZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYXRlZ29yeS5vcmlnaW5hbCwgJ1Rlc3QgQ2F0ZWdvcnknKTtcblxuXHRcdC8vIEV2ZXJ5dGhpbmcgZWxzZSBzdGF5cyBhcyBhIHN0cmluZy5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobG9jYWxpemVkTWFuaWZlc3QuY29udHJpYnV0ZXM/LmF1dGhlbnRpY2F0aW9uPy5bMF0ubGFiZWwsICdUZXN0YXV0aGVudGlmaXppZXJ1bmcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGxvY2FsaXplZE1hbmlmZXN0LmNvbnRyaWJ1dGVzPy5jb25maWd1cmF0aW9uIGFzIElDb25maWd1cmF0aW9uTm9kZSkudGl0bGUsICdUZXN0a29uZmlndXJhdGlvbicpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXBsYWNlcyB0ZW1wbGF0ZSBzdHJpbmdzIC0gaXMgYmVzdCBlZmZvcnQgIzE2NDYzMCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBtYW5pZmVzdFdpdGhUeXBvOiBJRXh0ZW5zaW9uTWFuaWZlc3QgPSB7XG5cdFx0XHRuYW1lOiAndGVzdCcsXG5cdFx0XHRwdWJsaXNoZXI6ICd0ZXN0Jyxcblx0XHRcdHZlcnNpb246ICcxLjAuMCcsXG5cdFx0XHRlbmdpbmVzOiB7XG5cdFx0XHRcdHZzY29kZTogJyonXG5cdFx0XHR9LFxuXHRcdFx0Y29udHJpYnV0ZXM6IHtcblx0XHRcdFx0YXV0aGVudGljYXRpb246IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRpZDogJ3Rlc3QuYXV0aGVudGljYXRpb24nLFxuXHRcdFx0XHRcdFx0Ly8gVGhpcyBub3QgZXhpc3RpbmcgaW4gdGhlIGJ1bmRsZSBzaG91bGRuJ3QgY2F1c2UgYW4gZXJyb3IuXG5cdFx0XHRcdFx0XHRsYWJlbDogJyVkb2Vzbm90ZXhpc3QlJyxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdGNvbW1hbmRzOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0Y29tbWFuZDogJ3Rlc3QuY29tbWFuZCcsXG5cdFx0XHRcdFx0XHR0aXRsZTogJyV0ZXN0LmNvbW1hbmQudGl0bGUlJyxcblx0XHRcdFx0XHRcdGNhdGVnb3J5OiAnJXRlc3QuY29tbWFuZC5jYXRlZ29yeSUnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgbG9jYWxpemVkTWFuaWZlc3QgPSBsb2NhbGl6ZU1hbmlmZXN0KFxuXHRcdFx0c3RvcmUuYWRkKG5ldyBOdWxsTG9nZ2VyKCkpLFxuXHRcdFx0ZGVlcENsb25lKG1hbmlmZXN0V2l0aFR5cG8pLFxuXHRcdFx0e1xuXHRcdFx0XHQndGVzdC5jb21tYW5kLnRpdGxlJzogJ1Rlc3QgQ29tbWFuZCcsXG5cdFx0XHRcdCd0ZXN0LmNvbW1hbmQuY2F0ZWdvcnknOiAnVGVzdCBDYXRlZ29yeSdcblx0XHRcdH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxvY2FsaXplZE1hbmlmZXN0LmNvbnRyaWJ1dGVzPy5jb21tYW5kcz8uWzBdLnRpdGxlLCAnVGVzdCBDb21tYW5kJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxvY2FsaXplZE1hbmlmZXN0LmNvbnRyaWJ1dGVzPy5jb21tYW5kcz8uWzBdLmNhdGVnb3J5LCAnVGVzdCBDYXRlZ29yeScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsb2NhbGl6ZWRNYW5pZmVzdC5jb250cmlidXRlcz8uYXV0aGVudGljYXRpb24/LlswXS5sYWJlbCwgJyVkb2Vzbm90ZXhpc3QlJyk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFL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
