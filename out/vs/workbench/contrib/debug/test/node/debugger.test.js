import assert from "assert";
import { join, normalize } from "../../../../../base/common/path.js";
import * as platform from "../../../../../base/common/platform.js";
import { Debugger } from "../../common/debugger.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { URI } from "../../../../../base/common/uri.js";
import { ExecutableDebugAdapter } from "../../node/debugAdapter.js";
import { TestTextResourcePropertiesService } from "../../../../../editor/test/common/services/testTextResourcePropertiesService.js";
import { ExtensionIdentifier, TargetPlatform } from "../../../../../platform/extensions/common/extensions.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("Debug - Debugger", () => {
  let _debugger;
  const extensionFolderPath = "/a/b/c/";
  const debuggerContribution = {
    type: "mock",
    label: "Mock Debug",
    program: "./out/mock/mockDebug.js",
    args: ["arg1", "arg2"],
    configurationAttributes: {
      launch: {
        required: ["program"],
        properties: {
          program: {
            "type": "string",
            "description": "Workspace relative path to a text file.",
            "default": "readme.md"
          }
        }
      }
    },
    variables: null,
    initialConfigurations: [
      {
        name: "Mock-Debug",
        type: "mock",
        request: "launch",
        program: "readme.md"
      }
    ]
  };
  const extensionDescriptor0 = {
    id: "adapter",
    identifier: new ExtensionIdentifier("adapter"),
    name: "myAdapter",
    version: "1.0.0",
    publisher: "vscode",
    extensionLocation: URI.file(extensionFolderPath),
    isBuiltin: false,
    isUserBuiltin: false,
    isUnderDevelopment: false,
    engines: null,
    targetPlatform: TargetPlatform.UNDEFINED,
    contributes: {
      "debuggers": [
        debuggerContribution
      ]
    },
    enabledApiProposals: void 0,
    preRelease: false
  };
  const extensionDescriptor1 = {
    id: "extension1",
    identifier: new ExtensionIdentifier("extension1"),
    name: "extension1",
    version: "1.0.0",
    publisher: "vscode",
    extensionLocation: URI.file("/e1/b/c/"),
    isBuiltin: false,
    isUserBuiltin: false,
    isUnderDevelopment: false,
    engines: null,
    targetPlatform: TargetPlatform.UNDEFINED,
    contributes: {
      "debuggers": [
        {
          type: "mock",
          runtime: "runtime",
          runtimeArgs: ["rarg"],
          program: "mockprogram",
          args: ["parg"]
        }
      ]
    },
    enabledApiProposals: void 0,
    preRelease: false
  };
  const extensionDescriptor2 = {
    id: "extension2",
    identifier: new ExtensionIdentifier("extension2"),
    name: "extension2",
    version: "1.0.0",
    publisher: "vscode",
    extensionLocation: URI.file("/e2/b/c/"),
    isBuiltin: false,
    isUserBuiltin: false,
    isUnderDevelopment: false,
    engines: null,
    targetPlatform: TargetPlatform.UNDEFINED,
    contributes: {
      "debuggers": [
        {
          type: "mock",
          win: {
            runtime: "winRuntime",
            program: "winProgram"
          },
          linux: {
            runtime: "linuxRuntime",
            program: "linuxProgram"
          },
          osx: {
            runtime: "osxRuntime",
            program: "osxProgram"
          }
        }
      ]
    },
    enabledApiProposals: void 0,
    preRelease: false
  };
  const adapterManager = {
    getDebugAdapterDescriptor(session, config) {
      return Promise.resolve(void 0);
    }
  };
  ensureNoDisposablesAreLeakedInTestSuite();
  const configurationService = new TestConfigurationService();
  const testResourcePropertiesService = new TestTextResourcePropertiesService(configurationService);
  setup(() => {
    _debugger = new Debugger(adapterManager, debuggerContribution, extensionDescriptor0, configurationService, testResourcePropertiesService, void 0, void 0, void 0, void 0);
  });
  teardown(() => {
    _debugger = null;
  });
  test("attributes", () => {
    assert.strictEqual(_debugger.type, debuggerContribution.type);
    assert.strictEqual(_debugger.label, debuggerContribution.label);
    const ae = ExecutableDebugAdapter.platformAdapterExecutable([extensionDescriptor0], "mock");
    assert.strictEqual(ae.command, join(extensionFolderPath, debuggerContribution.program));
    assert.deepStrictEqual(ae.args, debuggerContribution.args);
  });
  test("merge platform specific attributes", function() {
    if (!process.versions.electron) {
      this.skip();
    }
    const ae = ExecutableDebugAdapter.platformAdapterExecutable([extensionDescriptor1, extensionDescriptor2], "mock");
    assert.strictEqual(ae.command, platform.isLinux ? "linuxRuntime" : platform.isMacintosh ? "osxRuntime" : "winRuntime");
    const xprogram = platform.isLinux ? "linuxProgram" : platform.isMacintosh ? "osxProgram" : "winProgram";
    assert.deepStrictEqual(ae.args, ["rarg", normalize("/e2/b/c/") + xprogram, "parg"]);
  });
  test("initial config file content", () => {
    const expected = [
      "{",
      "	// Use IntelliSense to learn about possible attributes.",
      "	// Hover to view descriptions of existing attributes.",
      "	// For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387",
      '	"version": "0.2.0",',
      '	"configurations": [',
      "		{",
      '			"name": "Mock-Debug",',
      '			"type": "mock",',
      '			"request": "launch",',
      '			"program": "readme.md"',
      "		}",
      "	]",
      "}"
    ].join(testResourcePropertiesService.getEOL(URI.file("somefile")));
    return _debugger.getInitialConfigurationContent().then((content) => {
      assert.strictEqual(content, expected);
    }, (err) => assert.fail(err));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy90ZXN0L25vZGUvZGVidWdnZXIudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGpvaW4sIG5vcm1hbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSURlYnVnQWRhcHRlckV4ZWN1dGFibGUsIElDb25maWcsIElEZWJ1Z1Nlc3Npb24sIElBZGFwdGVyTWFuYWdlciB9IGZyb20gJy4uLy4uL2NvbW1vbi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z2dlciB9IGZyb20gJy4uLy4uL2NvbW1vbi9kZWJ1Z2dlci5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRXhlY3V0YWJsZURlYnVnQWRhcHRlciB9IGZyb20gJy4uLy4uL25vZGUvZGVidWdBZGFwdGVyLmpzJztcbmltcG9ydCB7IFRlc3RUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci90ZXN0L2NvbW1vbi9zZXJ2aWNlcy90ZXN0VGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciwgSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBUYXJnZXRQbGF0Zm9ybSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cblxuc3VpdGUoJ0RlYnVnIC0gRGVidWdnZXInLCAoKSA9PiB7XG5cdGxldCBfZGVidWdnZXI6IERlYnVnZ2VyO1xuXG5cdGNvbnN0IGV4dGVuc2lvbkZvbGRlclBhdGggPSAnL2EvYi9jLyc7XG5cdGNvbnN0IGRlYnVnZ2VyQ29udHJpYnV0aW9uID0ge1xuXHRcdHR5cGU6ICdtb2NrJyxcblx0XHRsYWJlbDogJ01vY2sgRGVidWcnLFxuXHRcdHByb2dyYW06ICcuL291dC9tb2NrL21vY2tEZWJ1Zy5qcycsXG5cdFx0YXJnczogWydhcmcxJywgJ2FyZzInXSxcblx0XHRjb25maWd1cmF0aW9uQXR0cmlidXRlczoge1xuXHRcdFx0bGF1bmNoOiB7XG5cdFx0XHRcdHJlcXVpcmVkOiBbJ3Byb2dyYW0nXSxcblx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdHByb2dyYW06IHtcblx0XHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiAnV29ya3NwYWNlIHJlbGF0aXZlIHBhdGggdG8gYSB0ZXh0IGZpbGUuJyxcblx0XHRcdFx0XHRcdCdkZWZhdWx0JzogJ3JlYWRtZS5tZCdcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdHZhcmlhYmxlczogbnVsbCEsXG5cdFx0aW5pdGlhbENvbmZpZ3VyYXRpb25zOiBbXG5cdFx0XHR7XG5cdFx0XHRcdG5hbWU6ICdNb2NrLURlYnVnJyxcblx0XHRcdFx0dHlwZTogJ21vY2snLFxuXHRcdFx0XHRyZXF1ZXN0OiAnbGF1bmNoJyxcblx0XHRcdFx0cHJvZ3JhbTogJ3JlYWRtZS5tZCdcblx0XHRcdH1cblx0XHRdXG5cdH07XG5cblx0Y29uc3QgZXh0ZW5zaW9uRGVzY3JpcHRvcjAgPSA8SUV4dGVuc2lvbkRlc2NyaXB0aW9uPntcblx0XHRpZDogJ2FkYXB0ZXInLFxuXHRcdGlkZW50aWZpZXI6IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyKCdhZGFwdGVyJyksXG5cdFx0bmFtZTogJ215QWRhcHRlcicsXG5cdFx0dmVyc2lvbjogJzEuMC4wJyxcblx0XHRwdWJsaXNoZXI6ICd2c2NvZGUnLFxuXHRcdGV4dGVuc2lvbkxvY2F0aW9uOiBVUkkuZmlsZShleHRlbnNpb25Gb2xkZXJQYXRoKSxcblx0XHRpc0J1aWx0aW46IGZhbHNlLFxuXHRcdGlzVXNlckJ1aWx0aW46IGZhbHNlLFxuXHRcdGlzVW5kZXJEZXZlbG9wbWVudDogZmFsc2UsXG5cdFx0ZW5naW5lczogbnVsbCEsXG5cdFx0dGFyZ2V0UGxhdGZvcm06IFRhcmdldFBsYXRmb3JtLlVOREVGSU5FRCxcblx0XHRjb250cmlidXRlczoge1xuXHRcdFx0J2RlYnVnZ2Vycyc6IFtcblx0XHRcdFx0ZGVidWdnZXJDb250cmlidXRpb25cblx0XHRcdF1cblx0XHR9LFxuXHRcdGVuYWJsZWRBcGlQcm9wb3NhbHM6IHVuZGVmaW5lZCxcblx0XHRwcmVSZWxlYXNlOiBmYWxzZSxcblx0fTtcblxuXHRjb25zdCBleHRlbnNpb25EZXNjcmlwdG9yMSA9IHtcblx0XHRpZDogJ2V4dGVuc2lvbjEnLFxuXHRcdGlkZW50aWZpZXI6IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyKCdleHRlbnNpb24xJyksXG5cdFx0bmFtZTogJ2V4dGVuc2lvbjEnLFxuXHRcdHZlcnNpb246ICcxLjAuMCcsXG5cdFx0cHVibGlzaGVyOiAndnNjb2RlJyxcblx0XHRleHRlbnNpb25Mb2NhdGlvbjogVVJJLmZpbGUoJy9lMS9iL2MvJyksXG5cdFx0aXNCdWlsdGluOiBmYWxzZSxcblx0XHRpc1VzZXJCdWlsdGluOiBmYWxzZSxcblx0XHRpc1VuZGVyRGV2ZWxvcG1lbnQ6IGZhbHNlLFxuXHRcdGVuZ2luZXM6IG51bGwhLFxuXHRcdHRhcmdldFBsYXRmb3JtOiBUYXJnZXRQbGF0Zm9ybS5VTkRFRklORUQsXG5cdFx0Y29udHJpYnV0ZXM6IHtcblx0XHRcdCdkZWJ1Z2dlcnMnOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiAnbW9jaycsXG5cdFx0XHRcdFx0cnVudGltZTogJ3J1bnRpbWUnLFxuXHRcdFx0XHRcdHJ1bnRpbWVBcmdzOiBbJ3JhcmcnXSxcblx0XHRcdFx0XHRwcm9ncmFtOiAnbW9ja3Byb2dyYW0nLFxuXHRcdFx0XHRcdGFyZ3M6IFsncGFyZyddXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9LFxuXHRcdGVuYWJsZWRBcGlQcm9wb3NhbHM6IHVuZGVmaW5lZCxcblx0XHRwcmVSZWxlYXNlOiBmYWxzZSxcblx0fTtcblxuXHRjb25zdCBleHRlbnNpb25EZXNjcmlwdG9yMiA9IHtcblx0XHRpZDogJ2V4dGVuc2lvbjInLFxuXHRcdGlkZW50aWZpZXI6IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyKCdleHRlbnNpb24yJyksXG5cdFx0bmFtZTogJ2V4dGVuc2lvbjInLFxuXHRcdHZlcnNpb246ICcxLjAuMCcsXG5cdFx0cHVibGlzaGVyOiAndnNjb2RlJyxcblx0XHRleHRlbnNpb25Mb2NhdGlvbjogVVJJLmZpbGUoJy9lMi9iL2MvJyksXG5cdFx0aXNCdWlsdGluOiBmYWxzZSxcblx0XHRpc1VzZXJCdWlsdGluOiBmYWxzZSxcblx0XHRpc1VuZGVyRGV2ZWxvcG1lbnQ6IGZhbHNlLFxuXHRcdGVuZ2luZXM6IG51bGwhLFxuXHRcdHRhcmdldFBsYXRmb3JtOiBUYXJnZXRQbGF0Zm9ybS5VTkRFRklORUQsXG5cdFx0Y29udHJpYnV0ZXM6IHtcblx0XHRcdCdkZWJ1Z2dlcnMnOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiAnbW9jaycsXG5cdFx0XHRcdFx0d2luOiB7XG5cdFx0XHRcdFx0XHRydW50aW1lOiAnd2luUnVudGltZScsXG5cdFx0XHRcdFx0XHRwcm9ncmFtOiAnd2luUHJvZ3JhbSdcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGxpbnV4OiB7XG5cdFx0XHRcdFx0XHRydW50aW1lOiAnbGludXhSdW50aW1lJyxcblx0XHRcdFx0XHRcdHByb2dyYW06ICdsaW51eFByb2dyYW0nXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRvc3g6IHtcblx0XHRcdFx0XHRcdHJ1bnRpbWU6ICdvc3hSdW50aW1lJyxcblx0XHRcdFx0XHRcdHByb2dyYW06ICdvc3hQcm9ncmFtJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0ZW5hYmxlZEFwaVByb3Bvc2FsczogdW5kZWZpbmVkLFxuXHRcdHByZVJlbGVhc2U6IGZhbHNlLFxuXHR9O1xuXG5cblx0Y29uc3QgYWRhcHRlck1hbmFnZXIgPSA8SUFkYXB0ZXJNYW5hZ2VyPntcblx0XHRnZXREZWJ1Z0FkYXB0ZXJEZXNjcmlwdG9yKHNlc3Npb246IElEZWJ1Z1Nlc3Npb24sIGNvbmZpZzogSUNvbmZpZyk6IFByb21pc2U8SURlYnVnQWRhcHRlckV4ZWN1dGFibGUgfCB1bmRlZmluZWQ+IHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0XHR9XG5cdH07XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCk7XG5cdGNvbnN0IHRlc3RSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlID0gbmV3IFRlc3RUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZShjb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdF9kZWJ1Z2dlciA9IG5ldyBEZWJ1Z2dlcihhZGFwdGVyTWFuYWdlciwgZGVidWdnZXJDb250cmlidXRpb24sIGV4dGVuc2lvbkRlc2NyaXB0b3IwLCBjb25maWd1cmF0aW9uU2VydmljZSwgdGVzdFJlc291cmNlUHJvcGVydGllc1NlcnZpY2UsIHVuZGVmaW5lZCEsIHVuZGVmaW5lZCEsIHVuZGVmaW5lZCEsIHVuZGVmaW5lZCEpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0X2RlYnVnZ2VyID0gbnVsbCE7XG5cdH0pO1xuXG5cdHRlc3QoJ2F0dHJpYnV0ZXMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKF9kZWJ1Z2dlci50eXBlLCBkZWJ1Z2dlckNvbnRyaWJ1dGlvbi50eXBlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoX2RlYnVnZ2VyLmxhYmVsLCBkZWJ1Z2dlckNvbnRyaWJ1dGlvbi5sYWJlbCk7XG5cblx0XHRjb25zdCBhZSA9IEV4ZWN1dGFibGVEZWJ1Z0FkYXB0ZXIucGxhdGZvcm1BZGFwdGVyRXhlY3V0YWJsZShbZXh0ZW5zaW9uRGVzY3JpcHRvcjBdLCAnbW9jaycpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFlIS5jb21tYW5kLCBqb2luKGV4dGVuc2lvbkZvbGRlclBhdGgsIGRlYnVnZ2VyQ29udHJpYnV0aW9uLnByb2dyYW0pKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFlIS5hcmdzLCBkZWJ1Z2dlckNvbnRyaWJ1dGlvbi5hcmdzKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2UgcGxhdGZvcm0gc3BlY2lmaWMgYXR0cmlidXRlcycsIGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoIXByb2Nlc3MudmVyc2lvbnMuZWxlY3Ryb24pIHtcblx0XHRcdHRoaXMuc2tpcCgpOyAvL1RPRE9AZGVidWcgdGhpcyB0ZXN0IGZhaWxzIHdoZW4gcnVuIGluIG5vZGUuanMgZW52aXJvbm1lbnRzXG5cdFx0fVxuXHRcdGNvbnN0IGFlID0gRXhlY3V0YWJsZURlYnVnQWRhcHRlci5wbGF0Zm9ybUFkYXB0ZXJFeGVjdXRhYmxlKFtleHRlbnNpb25EZXNjcmlwdG9yMSwgZXh0ZW5zaW9uRGVzY3JpcHRvcjJdLCAnbW9jaycpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWUuY29tbWFuZCwgcGxhdGZvcm0uaXNMaW51eCA/ICdsaW51eFJ1bnRpbWUnIDogKHBsYXRmb3JtLmlzTWFjaW50b3NoID8gJ29zeFJ1bnRpbWUnIDogJ3dpblJ1bnRpbWUnKSk7XG5cdFx0Y29uc3QgeHByb2dyYW0gPSBwbGF0Zm9ybS5pc0xpbnV4ID8gJ2xpbnV4UHJvZ3JhbScgOiAocGxhdGZvcm0uaXNNYWNpbnRvc2ggPyAnb3N4UHJvZ3JhbScgOiAnd2luUHJvZ3JhbScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWUuYXJncywgWydyYXJnJywgbm9ybWFsaXplKCcvZTIvYi9jLycpICsgeHByb2dyYW0sICdwYXJnJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdpbml0aWFsIGNvbmZpZyBmaWxlIGNvbnRlbnQnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBleHBlY3RlZCA9IFsneycsXG5cdFx0XHQnXHQvLyBVc2UgSW50ZWxsaVNlbnNlIHRvIGxlYXJuIGFib3V0IHBvc3NpYmxlIGF0dHJpYnV0ZXMuJyxcblx0XHRcdCdcdC8vIEhvdmVyIHRvIHZpZXcgZGVzY3JpcHRpb25zIG9mIGV4aXN0aW5nIGF0dHJpYnV0ZXMuJyxcblx0XHRcdCdcdC8vIEZvciBtb3JlIGluZm9ybWF0aW9uLCB2aXNpdDogaHR0cHM6Ly9nby5taWNyb3NvZnQuY29tL2Z3bGluay8/bGlua2lkPTgzMDM4NycsXG5cdFx0XHQnXHRcInZlcnNpb25cIjogXCIwLjIuMFwiLCcsXG5cdFx0XHQnXHRcImNvbmZpZ3VyYXRpb25zXCI6IFsnLFxuXHRcdFx0J1x0XHR7Jyxcblx0XHRcdCdcdFx0XHRcIm5hbWVcIjogXCJNb2NrLURlYnVnXCIsJyxcblx0XHRcdCdcdFx0XHRcInR5cGVcIjogXCJtb2NrXCIsJyxcblx0XHRcdCdcdFx0XHRcInJlcXVlc3RcIjogXCJsYXVuY2hcIiwnLFxuXHRcdFx0J1x0XHRcdFwicHJvZ3JhbVwiOiBcInJlYWRtZS5tZFwiJyxcblx0XHRcdCdcdFx0fScsXG5cdFx0XHQnXHRdJyxcblx0XHRcdCd9J10uam9pbih0ZXN0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZS5nZXRFT0woVVJJLmZpbGUoJ3NvbWVmaWxlJykpKTtcblxuXHRcdHJldHVybiBfZGVidWdnZXIuZ2V0SW5pdGlhbENvbmZpZ3VyYXRpb25Db250ZW50KCkudGhlbihjb250ZW50ID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZW50LCBleHBlY3RlZCk7XG5cdFx0fSwgZXJyID0+IGFzc2VydC5mYWlsKGVycikpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsTUFBTSxpQkFBaUI7QUFDaEMsWUFBWSxjQUFjO0FBRTFCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsV0FBVztBQUNwQixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLHlDQUF5QztBQUNsRCxTQUFTLHFCQUE0QyxzQkFBc0I7QUFDM0UsU0FBUywrQ0FBK0M7QUFHeEQsTUFBTSxvQkFBb0IsTUFBTTtBQUMvQixNQUFJ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
