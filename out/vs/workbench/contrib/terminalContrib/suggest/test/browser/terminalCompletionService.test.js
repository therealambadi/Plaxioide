import { URI } from "../../../../../../base/common/uri.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { TerminalCompletionService } from "../../browser/terminalCompletionService.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import assert, { fail } from "assert";
import { isWindows } from "../../../../../../base/common/platform.js";
import { TestInstantiationService } from "../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { createFileStat } from "../../../../../test/common/workbenchTestServices.js";
import { TestConfigurationService } from "../../../../../../platform/configuration/test/common/testConfigurationService.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { TerminalCapabilityStore } from "../../../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js";
import { ShellEnvDetectionCapability } from "../../../../../../platform/terminal/common/capabilities/shellEnvDetectionCapability.js";
import { TerminalCapability } from "../../../../../../platform/terminal/common/capabilities/capabilities.js";
import { TerminalCompletionItemKind } from "../../browser/terminalCompletionItem.js";
import { count } from "../../../../../../base/common/strings.js";
const pathSeparator = isWindows ? "\\" : "/";
function assertCompletions(actual, expected, expectedConfig) {
  assert.deepStrictEqual(
    actual?.map((e) => ({
      label: e.label,
      detail: e.detail ?? "",
      kind: e.kind ?? TerminalCompletionItemKind.Folder,
      replacementIndex: e.replacementIndex,
      replacementLength: e.replacementLength
    })),
    expected.map((e) => ({
      label: e.label.replaceAll("/", pathSeparator),
      detail: e.detail ? e.detail.replaceAll("/", pathSeparator) : "",
      kind: e.kind ?? TerminalCompletionItemKind.Folder,
      replacementIndex: expectedConfig.replacementIndex,
      replacementLength: expectedConfig.replacementLength
    }))
  );
}
function assertPartialCompletionsExist(actual, expectedPartial, expectedConfig) {
  if (!actual) {
    fail();
  }
  const expectedMapped = expectedPartial.map((e) => ({
    label: e.label.replaceAll("/", pathSeparator),
    detail: e.detail ? e.detail.replaceAll("/", pathSeparator) : "",
    kind: e.kind ?? TerminalCompletionItemKind.Folder,
    replacementIndex: expectedConfig.replacementIndex,
    replacementLength: expectedConfig.replacementLength
  }));
  for (const expectedItem of expectedMapped) {
    assert.deepStrictEqual(actual.map((e) => ({
      label: e.label,
      detail: e.detail ?? "",
      kind: e.kind ?? TerminalCompletionItemKind.Folder,
      replacementIndex: e.replacementIndex,
      replacementLength: e.replacementLength
    })).find((e) => e.detail === expectedItem.detail), expectedItem);
  }
}
const testEnv = {
  HOME: "/home/user",
  USERPROFILE: "/home/user"
};
let homeDir = isWindows ? testEnv["USERPROFILE"] : testEnv["HOME"];
if (!homeDir.endsWith("/")) {
  homeDir += "/";
}
const standardTidleItem = Object.freeze({ label: "~", detail: homeDir });
suite("TerminalCompletionService", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let instantiationService;
  let configurationService;
  let capabilities;
  let validResources;
  let childResources;
  let terminalCompletionService;
  const provider = "testProvider";
  setup(() => {
    instantiationService = store.add(new TestInstantiationService());
    configurationService = new TestConfigurationService();
    instantiationService.stub(IConfigurationService, configurationService);
    instantiationService.stub(IFileService, {
      async stat(resource) {
        if (!validResources.map((e) => e.path).includes(resource.path)) {
          throw new Error("Doesn't exist");
        }
        return createFileStat(resource);
      },
      async resolve(resource, options) {
        const children = childResources.filter((child) => {
          const childFsPath = child.resource.path.replace(/\/$/, "");
          const parentFsPath = resource.path.replace(/\/$/, "");
          return childFsPath.startsWith(parentFsPath) && count(childFsPath, "/") === count(parentFsPath, "/") + 1;
        });
        return createFileStat(resource, void 0, void 0, void 0, children);
      }
    });
    terminalCompletionService = store.add(instantiationService.createInstance(TerminalCompletionService));
    terminalCompletionService.processEnv = testEnv;
    validResources = [];
    childResources = [];
    capabilities = store.add(new TerminalCapabilityStore());
  });
  suite("resolveResources should return undefined", () => {
    test("if cwd is not provided", async () => {
      const resourceRequestConfig = { pathSeparator };
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "cd ", 3, provider, capabilities);
      assert(!result);
    });
    test("if neither filesRequested nor foldersRequested are true", async () => {
      const resourceRequestConfig = {
        cwd: URI.parse("file:///test"),
        pathSeparator
      };
      validResources = [URI.parse("file:///test")];
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "cd ", 3, provider, capabilities);
      assert(!result);
    });
  });
  suite("resolveResources should return folder completions", () => {
    setup(() => {
      validResources = [URI.parse("file:///test")];
      childResources = [
        { resource: URI.parse("file:///test/folder1/"), isDirectory: true, isFile: false },
        { resource: URI.parse("file:///test/file1.txt"), isDirectory: false, isFile: true }
      ];
    });
    test("| should return root-level completions", async () => {
      const resourceRequestConfig = {
        cwd: URI.parse("file:///test"),
        foldersRequested: true,
        pathSeparator
      };
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "", 1, provider, capabilities);
      assertCompletions(result, [
        { label: ".", detail: "/test/" },
        { label: "./folder1/", detail: "/test/folder1/" },
        { label: "../", detail: "/" },
        standardTidleItem
      ], { replacementIndex: 1, replacementLength: 0 });
    });
    test("./| should return folder completions", async () => {
      const resourceRequestConfig = {
        cwd: URI.parse("file:///test"),
        foldersRequested: true,
        pathSeparator
      };
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "./", 3, provider, capabilities);
      assertCompletions(result, [
        { label: "./", detail: "/test/" },
        { label: "./folder1/", detail: "/test/folder1/" },
        { label: "./../", detail: "/" }
      ], { replacementIndex: 1, replacementLength: 2 });
    });
    test("cd ./| should return folder completions", async () => {
      const resourceRequestConfig = {
        cwd: URI.parse("file:///test"),
        foldersRequested: true,
        pathSeparator
      };
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "cd ./", 5, provider, capabilities);
      assertCompletions(result, [
        { label: "./", detail: "/test/" },
        { label: "./folder1/", detail: "/test/folder1/" },
        { label: "./../", detail: "/" }
      ], { replacementIndex: 3, replacementLength: 2 });
    });
    test("cd ./f| should return folder completions", async () => {
      const resourceRequestConfig = {
        cwd: URI.parse("file:///test"),
        foldersRequested: true,
        pathSeparator
      };
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "cd ./f", 6, provider, capabilities);
      assertCompletions(result, [
        { label: "./", detail: "/test/" },
        { label: "./folder1/", detail: "/test/folder1/" },
        { label: "./../", detail: "/" }
      ], { replacementIndex: 3, replacementLength: 3 });
    });
  });
  suite("resolveResources should handle file and folder completion requests correctly", () => {
    setup(() => {
      validResources = [URI.parse("file:///test")];
      childResources = [
        { resource: URI.parse("file:///test/.hiddenFile"), isFile: true },
        { resource: URI.parse("file:///test/.hiddenFolder/"), isDirectory: true },
        { resource: URI.parse("file:///test/folder1/"), isDirectory: true },
        { resource: URI.parse("file:///test/file1.txt"), isFile: true }
      ];
    });
    test("./| should handle hidden files and folders", async () => {
      const resourceRequestConfig = {
        cwd: URI.parse("file:///test"),
        foldersRequested: true,
        filesRequested: true,
        pathSeparator
      };
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "./", 2, provider, capabilities);
      assertCompletions(result, [
        { label: "./", detail: "/test/" },
        { label: "./.hiddenFile", detail: "/test/.hiddenFile", kind: TerminalCompletionItemKind.File },
        { label: "./.hiddenFolder/", detail: "/test/.hiddenFolder/" },
        { label: "./folder1/", detail: "/test/folder1/" },
        { label: "./file1.txt", detail: "/test/file1.txt", kind: TerminalCompletionItemKind.File },
        { label: "./../", detail: "/" }
      ], { replacementIndex: 0, replacementLength: 2 });
    });
    test("./h| should handle hidden files and folders", async () => {
      const resourceRequestConfig = {
        cwd: URI.parse("file:///test"),
        foldersRequested: true,
        filesRequested: true,
        pathSeparator
      };
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "./h", 3, provider, capabilities);
      assertCompletions(result, [
        { label: "./", detail: "/test/" },
        { label: "./.hiddenFile", detail: "/test/.hiddenFile", kind: TerminalCompletionItemKind.File },
        { label: "./.hiddenFolder/", detail: "/test/.hiddenFolder/" },
        { label: "./folder1/", detail: "/test/folder1/" },
        { label: "./file1.txt", detail: "/test/file1.txt", kind: TerminalCompletionItemKind.File },
        { label: "./../", detail: "/" }
      ], { replacementIndex: 0, replacementLength: 3 });
    });
  });
  suite("~ -> $HOME", () => {
    let resourceRequestConfig;
    let shellEnvDetection;
    setup(() => {
      shellEnvDetection = store.add(new ShellEnvDetectionCapability());
      shellEnvDetection.setEnvironment({
        HOME: "/home",
        USERPROFILE: "/home"
      }, true);
      capabilities.add(TerminalCapability.ShellEnvDetection, shellEnvDetection);
      resourceRequestConfig = {
        cwd: URI.parse("file:///test/folder1"),
        // Updated to reflect home directory
        filesRequested: true,
        foldersRequested: true,
        pathSeparator
      };
      validResources = [
        URI.parse("file:///test"),
        URI.parse("file:///test/folder1"),
        URI.parse("file:///home"),
        URI.parse("file:///home/vscode"),
        URI.parse("file:///home/vscode/foo"),
        URI.parse("file:///home/vscode/bar.txt")
      ];
      childResources = [
        { resource: URI.parse("file:///home/vscode"), isDirectory: true },
        { resource: URI.parse("file:///home/vscode/foo"), isDirectory: true },
        { resource: URI.parse("file:///home/vscode/bar.txt"), isFile: true }
      ];
    });
    test("~| should return completion for ~", async () => {
      assertPartialCompletionsExist(await terminalCompletionService.resolveResources(resourceRequestConfig, "~", 1, provider, capabilities), [
        { label: "~", detail: "/home/" }
      ], { replacementIndex: 0, replacementLength: 1 });
    });
    test("~/| should return folder completions relative to $HOME", async () => {
      assertCompletions(await terminalCompletionService.resolveResources(resourceRequestConfig, "~/", 2, provider, capabilities), [
        { label: "~/", detail: "/home/" },
        { label: "~/vscode/", detail: "/home/vscode/" }
      ], { replacementIndex: 0, replacementLength: 2 });
    });
    test("~/vscode/| should return folder completions relative to $HOME/vscode", async () => {
      assertCompletions(await terminalCompletionService.resolveResources(resourceRequestConfig, "~/vscode/", 9, provider, capabilities), [
        { label: "~/vscode/", detail: "/home/vscode/" },
        { label: "~/vscode/foo/", detail: "/home/vscode/foo/" },
        { label: "~/vscode/bar.txt", detail: "/home/vscode/bar.txt", kind: TerminalCompletionItemKind.File }
      ], { replacementIndex: 0, replacementLength: 9 });
    });
  });
  suite("resolveResources edge cases and advanced scenarios", () => {
    setup(() => {
      validResources = [];
      childResources = [];
    });
    if (isWindows) {
      test("C:/Foo/| absolute paths on Windows", async () => {
        const resourceRequestConfig = {
          cwd: URI.parse("file:///C:"),
          foldersRequested: true,
          pathSeparator
        };
        validResources = [URI.parse("file:///C:/Foo")];
        childResources = [
          { resource: URI.parse("file:///C:/Foo/Bar"), isDirectory: true, isFile: false },
          { resource: URI.parse("file:///C:/Foo/Baz.txt"), isDirectory: false, isFile: true }
        ];
        const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "C:/Foo/", 7, provider, capabilities);
        assertCompletions(result, [
          { label: "C:/Foo/", detail: "C:/Foo/" },
          { label: "C:/Foo/Bar/", detail: "C:/Foo/Bar/" }
        ], { replacementIndex: 0, replacementLength: 7 });
      });
      test("c:/foo/| case insensitivity on Windows", async () => {
        const resourceRequestConfig = {
          cwd: URI.parse("file:///c:"),
          foldersRequested: true,
          pathSeparator
        };
        validResources = [URI.parse("file:///c:/foo")];
        childResources = [
          { resource: URI.parse("file:///c:/foo/Bar"), isDirectory: true, isFile: false }
        ];
        const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "c:/foo/", 7, provider, capabilities);
        assertCompletions(result, [
          // Note that the detail is normalizes drive letters to capital case intentionally
          { label: "c:/foo/", detail: "C:/foo/" },
          { label: "c:/foo/Bar/", detail: "C:/foo/Bar/" }
        ], { replacementIndex: 0, replacementLength: 7 });
      });
    } else {
      test("/foo/| absolute paths NOT on Windows", async () => {
        const resourceRequestConfig = {
          cwd: URI.parse("file:///"),
          foldersRequested: true,
          pathSeparator
        };
        validResources = [URI.parse("file:///foo")];
        childResources = [
          { resource: URI.parse("file:///foo/Bar"), isDirectory: true, isFile: false },
          { resource: URI.parse("file:///foo/Baz.txt"), isDirectory: false, isFile: true }
        ];
        const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "/foo/", 5, provider, capabilities);
        assertCompletions(result, [
          { label: "/foo/", detail: "/foo/" },
          { label: "/foo/Bar/", detail: "/foo/Bar/" }
        ], { replacementIndex: 0, replacementLength: 5 });
      });
    }
    if (isWindows) {
      test(".\\folder | Case insensitivity should resolve correctly on Windows", async () => {
        const resourceRequestConfig = {
          cwd: URI.parse("file:///C:/test"),
          foldersRequested: true,
          pathSeparator: "\\"
        };
        validResources = [URI.parse("file:///C:/test")];
        childResources = [
          { resource: URI.parse("file:///C:/test/FolderA/"), isDirectory: true },
          { resource: URI.parse("file:///C:/test/anotherFolder/"), isDirectory: true }
        ];
        const result = await terminalCompletionService.resolveResources(resourceRequestConfig, ".\\folder", 8, provider, capabilities);
        assertCompletions(result, [
          { label: ".\\", detail: "C:\\test\\" },
          { label: ".\\FolderA\\", detail: "C:\\test\\FolderA\\" },
          { label: ".\\anotherFolder\\", detail: "C:\\test\\anotherFolder\\" },
          { label: ".\\..\\", detail: "C:\\" }
        ], { replacementIndex: 0, replacementLength: 8 });
      });
    } else {
      test("./folder | Case sensitivity should resolve correctly on Mac/Unix", async () => {
        const resourceRequestConfig = {
          cwd: URI.parse("file:///test"),
          foldersRequested: true,
          pathSeparator: "/"
        };
        validResources = [URI.parse("file:///test")];
        childResources = [
          { resource: URI.parse("file:///test/FolderA/"), isDirectory: true },
          { resource: URI.parse("file:///test/foldera/"), isDirectory: true }
        ];
        const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "./folder", 8, provider, capabilities);
        assertCompletions(result, [
          { label: "./", detail: "/test/" },
          { label: "./FolderA/", detail: "/test/FolderA/" },
          { label: "./foldera/", detail: "/test/foldera/" },
          { label: "./../", detail: "/" }
        ], { replacementIndex: 0, replacementLength: 8 });
      });
    }
    test("| Empty input should resolve to current directory", async () => {
      const resourceRequestConfig = {
        cwd: URI.parse("file:///test"),
        foldersRequested: true,
        pathSeparator
      };
      validResources = [URI.parse("file:///test")];
      childResources = [
        { resource: URI.parse("file:///test/folder1/"), isDirectory: true },
        { resource: URI.parse("file:///test/folder2/"), isDirectory: true }
      ];
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "", 0, provider, capabilities);
      assertCompletions(result, [
        { label: ".", detail: "/test/" },
        { label: "./folder1/", detail: "/test/folder1/" },
        { label: "./folder2/", detail: "/test/folder2/" },
        { label: "../", detail: "/" },
        standardTidleItem
      ], { replacementIndex: 0, replacementLength: 0 });
    });
    test("./| should handle large directories with many results gracefully", async () => {
      const resourceRequestConfig = {
        cwd: URI.parse("file:///test"),
        foldersRequested: true,
        pathSeparator
      };
      validResources = [URI.parse("file:///test")];
      childResources = Array.from({ length: 1e3 }, (_, i) => ({
        resource: URI.parse(`file:///test/folder${i}/`),
        isDirectory: true
      }));
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "./", 2, provider, capabilities);
      assert(result);
      assert.strictEqual(result?.length, 1002);
      assert.strictEqual(result[0].label, `.${pathSeparator}`);
      assert.strictEqual(result.at(-1)?.label, `.${pathSeparator}..${pathSeparator}`);
    });
    test("./folder| should include current folder with trailing / is missing", async () => {
      const resourceRequestConfig = {
        cwd: URI.parse("file:///test"),
        foldersRequested: true,
        pathSeparator
      };
      validResources = [URI.parse("file:///test")];
      childResources = [
        { resource: URI.parse("file:///test/folder1/"), isDirectory: true },
        { resource: URI.parse("file:///test/folder2/"), isDirectory: true }
      ];
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "./folder1", 10, provider, capabilities);
      assertCompletions(result, [
        { label: "./", detail: "/test/" },
        { label: "./folder1/", detail: "/test/folder1/" },
        { label: "./folder2/", detail: "/test/folder2/" },
        { label: "./../", detail: "/" }
      ], { replacementIndex: 1, replacementLength: 9 });
    });
    test("folder/| should normalize current and parent folders", async () => {
      const resourceRequestConfig = {
        cwd: URI.parse("file:///test"),
        foldersRequested: true,
        pathSeparator
      };
      validResources = [
        URI.parse("file:///"),
        URI.parse("file:///test"),
        URI.parse("file:///test/folder1"),
        URI.parse("file:///test/folder2")
      ];
      childResources = [
        { resource: URI.parse("file:///test/folder1/"), isDirectory: true },
        { resource: URI.parse("file:///test/folder2/"), isDirectory: true }
      ];
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "test/", 5, provider, capabilities);
      assertCompletions(result, [
        { label: "./test/", detail: "/test/" },
        { label: "./test/folder1/", detail: "/test/folder1/" },
        { label: "./test/folder2/", detail: "/test/folder2/" },
        { label: "./test/../", detail: "/" }
      ], { replacementIndex: 0, replacementLength: 5 });
    });
  });
  suite("cdpath", () => {
    let shellEnvDetection;
    setup(() => {
      validResources = [URI.parse("file:///test")];
      childResources = [
        { resource: URI.parse("file:///cdpath_value/folder1/"), isDirectory: true },
        { resource: URI.parse("file:///cdpath_value/file1.txt"), isFile: true }
      ];
      shellEnvDetection = store.add(new ShellEnvDetectionCapability());
      shellEnvDetection.setEnvironment({ CDPATH: "/cdpath_value" }, true);
      capabilities.add(TerminalCapability.ShellEnvDetection, shellEnvDetection);
    });
    test("cd | should show paths from $CDPATH (relative)", async () => {
      configurationService.setUserConfiguration("terminal.integrated.suggest.cdPath", "relative");
      const resourceRequestConfig = {
        cwd: URI.parse("file:///test"),
        foldersRequested: true,
        filesRequested: true,
        pathSeparator
      };
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "cd ", 3, provider, capabilities);
      assertPartialCompletionsExist(result, [
        { label: "folder1", detail: "CDPATH /cdpath_value/folder1/" }
      ], { replacementIndex: 3, replacementLength: 0 });
    });
    test("cd | should show paths from $CDPATH (absolute)", async () => {
      configurationService.setUserConfiguration("terminal.integrated.suggest.cdPath", "absolute");
      const resourceRequestConfig = {
        cwd: URI.parse("file:///test"),
        foldersRequested: true,
        filesRequested: true,
        pathSeparator
      };
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "cd ", 3, provider, capabilities);
      assertPartialCompletionsExist(result, [
        { label: "/cdpath_value/folder1/", detail: "CDPATH" }
      ], { replacementIndex: 3, replacementLength: 0 });
    });
    test("cd | should support pulling from multiple paths in $CDPATH", async () => {
      configurationService.setUserConfiguration("terminal.integrated.suggest.cdPath", "relative");
      const pathPrefix = isWindows ? "c:\\" : "/";
      const delimeter = isWindows ? ";" : ":";
      const separator = isWindows ? "\\" : "/";
      shellEnvDetection.setEnvironment({ CDPATH: `${pathPrefix}cdpath1_value${delimeter}${pathPrefix}cdpath2_value${separator}inner_dir` }, true);
      const uriPathPrefix = isWindows ? "file:///c:/" : "file:///";
      validResources = [
        URI.parse(`${uriPathPrefix}test`),
        URI.parse(`${uriPathPrefix}cdpath1_value`),
        URI.parse(`${uriPathPrefix}cdpath2_value`),
        URI.parse(`${uriPathPrefix}cdpath2_value/inner_dir`)
      ];
      childResources = [
        { resource: URI.parse(`${uriPathPrefix}cdpath1_value/folder1/`), isDirectory: true },
        { resource: URI.parse(`${uriPathPrefix}cdpath1_value/folder2/`), isDirectory: true },
        { resource: URI.parse(`${uriPathPrefix}cdpath1_value/file1.txt`), isFile: true },
        { resource: URI.parse(`${uriPathPrefix}cdpath2_value/inner_dir/folder1/`), isDirectory: true },
        { resource: URI.parse(`${uriPathPrefix}cdpath2_value/inner_dir/folder2/`), isDirectory: true },
        { resource: URI.parse(`${uriPathPrefix}cdpath2_value/inner_dir/file1.txt`), isFile: true }
      ];
      const resourceRequestConfig = {
        cwd: URI.parse(`${uriPathPrefix}test`),
        foldersRequested: true,
        filesRequested: true,
        pathSeparator
      };
      const result = await terminalCompletionService.resolveResources(resourceRequestConfig, "cd ", 3, provider, capabilities);
      const finalPrefix = isWindows ? "C:\\" : "/";
      assertPartialCompletionsExist(result, [
        { label: "folder1", detail: `CDPATH ${finalPrefix}cdpath1_value/folder1/` },
        { label: "folder2", detail: `CDPATH ${finalPrefix}cdpath1_value/folder2/` },
        { label: "folder1", detail: `CDPATH ${finalPrefix}cdpath2_value/inner_dir/folder1/` },
        { label: "folder2", detail: `CDPATH ${finalPrefix}cdpath2_value/inner_dir/folder2/` }
      ], { replacementIndex: 3, replacementLength: 0 });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvc3VnZ2VzdC90ZXN0L2Jyb3dzZXIvdGVybWluYWxDb21wbGV0aW9uU2VydmljZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSwgSUZpbGVTdGF0V2l0aE1ldGFkYXRhLCBJUmVzb2x2ZU1ldGFkYXRhRmlsZU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb21wbGV0aW9uU2VydmljZSwgVGVybWluYWxSZXNvdXJjZVJlcXVlc3RDb25maWcgfSBmcm9tICcuLi8uLi9icm93c2VyL3Rlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgYXNzZXJ0LCB7IGZhaWwgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgaXNXaW5kb3dzLCB0eXBlIElQcm9jZXNzRW52aXJvbm1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBjcmVhdGVGaWxlU3RhdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy90ZXJtaW5hbENhcGFiaWxpdHlTdG9yZS5qcyc7XG5pbXBvcnQgeyBTaGVsbEVudkRldGVjdGlvbkNhcGFiaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL3NoZWxsRW52RGV0ZWN0aW9uQ2FwYWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENhcGFiaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxDb21wbGV0aW9uLCBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdGVybWluYWxDb21wbGV0aW9uSXRlbS5qcyc7XG5pbXBvcnQgeyBjb3VudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuXG5jb25zdCBwYXRoU2VwYXJhdG9yID0gaXNXaW5kb3dzID8gJ1xcXFwnIDogJy8nO1xuXG5pbnRlcmZhY2UgSUFzc2VydGlvblRlcm1pbmFsQ29tcGxldGlvbiB7XG5cdGxhYmVsOiBzdHJpbmc7XG5cdGRldGFpbD86IHN0cmluZztcblx0a2luZD86IFRlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kO1xufVxuXG5pbnRlcmZhY2UgSUFzc2VydGlvbkNvbW1hbmRMaW5lQ29uZmlnIHtcblx0cmVwbGFjZW1lbnRJbmRleDogbnVtYmVyO1xuXHRyZXBsYWNlbWVudExlbmd0aDogbnVtYmVyO1xufVxuXG4vKipcbiAqIEFzc2VydCB0aGUgc2V0IG9mIGNvbXBsZXRpb25zIGV4aXN0IGV4YWN0bHksIGluY2x1ZGluZyB0aGVpciBvcmRlci5cbiAqL1xuZnVuY3Rpb24gYXNzZXJ0Q29tcGxldGlvbnMoYWN0dWFsOiBJVGVybWluYWxDb21wbGV0aW9uW10gfCB1bmRlZmluZWQsIGV4cGVjdGVkOiBJQXNzZXJ0aW9uVGVybWluYWxDb21wbGV0aW9uW10sIGV4cGVjdGVkQ29uZmlnOiBJQXNzZXJ0aW9uQ29tbWFuZExpbmVDb25maWcpIHtcblx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRhY3R1YWw/Lm1hcChlID0+ICh7XG5cdFx0XHRsYWJlbDogZS5sYWJlbCxcblx0XHRcdGRldGFpbDogZS5kZXRhaWwgPz8gJycsXG5cdFx0XHRraW5kOiBlLmtpbmQgPz8gVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyLFxuXHRcdFx0cmVwbGFjZW1lbnRJbmRleDogZS5yZXBsYWNlbWVudEluZGV4LFxuXHRcdFx0cmVwbGFjZW1lbnRMZW5ndGg6IGUucmVwbGFjZW1lbnRMZW5ndGgsXG5cdFx0fSkpLCBleHBlY3RlZC5tYXAoZSA9PiAoe1xuXHRcdFx0bGFiZWw6IGUubGFiZWwucmVwbGFjZUFsbCgnLycsIHBhdGhTZXBhcmF0b3IpLFxuXHRcdFx0ZGV0YWlsOiBlLmRldGFpbCA/IGUuZGV0YWlsLnJlcGxhY2VBbGwoJy8nLCBwYXRoU2VwYXJhdG9yKSA6ICcnLFxuXHRcdFx0a2luZDogZS5raW5kID8/IFRlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLkZvbGRlcixcblx0XHRcdHJlcGxhY2VtZW50SW5kZXg6IGV4cGVjdGVkQ29uZmlnLnJlcGxhY2VtZW50SW5kZXgsXG5cdFx0XHRyZXBsYWNlbWVudExlbmd0aDogZXhwZWN0ZWRDb25maWcucmVwbGFjZW1lbnRMZW5ndGgsXG5cdFx0fSkpXG5cdCk7XG59XG5cbi8qKlxuICogQXNzZXJ0IGEgc2V0IG9mIGNvbXBsZXRpb25zIGV4aXN0IHdpdGhpbiB0aGUgYWN0dWFsIHNldC5cbiAqL1xuZnVuY3Rpb24gYXNzZXJ0UGFydGlhbENvbXBsZXRpb25zRXhpc3QoYWN0dWFsOiBJVGVybWluYWxDb21wbGV0aW9uW10gfCB1bmRlZmluZWQsIGV4cGVjdGVkUGFydGlhbDogSUFzc2VydGlvblRlcm1pbmFsQ29tcGxldGlvbltdLCBleHBlY3RlZENvbmZpZzogSUFzc2VydGlvbkNvbW1hbmRMaW5lQ29uZmlnKSB7XG5cdGlmICghYWN0dWFsKSB7XG5cdFx0ZmFpbCgpO1xuXHR9XG5cdGNvbnN0IGV4cGVjdGVkTWFwcGVkID0gZXhwZWN0ZWRQYXJ0aWFsLm1hcChlID0+ICh7XG5cdFx0bGFiZWw6IGUubGFiZWwucmVwbGFjZUFsbCgnLycsIHBhdGhTZXBhcmF0b3IpLFxuXHRcdGRldGFpbDogZS5kZXRhaWwgPyBlLmRldGFpbC5yZXBsYWNlQWxsKCcvJywgcGF0aFNlcGFyYXRvcikgOiAnJyxcblx0XHRraW5kOiBlLmtpbmQgPz8gVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyLFxuXHRcdHJlcGxhY2VtZW50SW5kZXg6IGV4cGVjdGVkQ29uZmlnLnJlcGxhY2VtZW50SW5kZXgsXG5cdFx0cmVwbGFjZW1lbnRMZW5ndGg6IGV4cGVjdGVkQ29uZmlnLnJlcGxhY2VtZW50TGVuZ3RoLFxuXHR9KSk7XG5cdGZvciAoY29uc3QgZXhwZWN0ZWRJdGVtIG9mIGV4cGVjdGVkTWFwcGVkKSB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubWFwKGUgPT4gKHtcblx0XHRcdGxhYmVsOiBlLmxhYmVsLFxuXHRcdFx0ZGV0YWlsOiBlLmRldGFpbCA/PyAnJyxcblx0XHRcdGtpbmQ6IGUua2luZCA/PyBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5Gb2xkZXIsXG5cdFx0XHRyZXBsYWNlbWVudEluZGV4OiBlLnJlcGxhY2VtZW50SW5kZXgsXG5cdFx0XHRyZXBsYWNlbWVudExlbmd0aDogZS5yZXBsYWNlbWVudExlbmd0aCxcblx0XHR9KSkuZmluZChlID0+IGUuZGV0YWlsID09PSBleHBlY3RlZEl0ZW0uZGV0YWlsKSwgZXhwZWN0ZWRJdGVtKTtcblx0fVxufVxuXG5jb25zdCB0ZXN0RW52OiBJUHJvY2Vzc0Vudmlyb25tZW50ID0ge1xuXHRIT01FOiAnL2hvbWUvdXNlcicsXG5cdFVTRVJQUk9GSUxFOiAnL2hvbWUvdXNlcidcbn07XG5cbmxldCBob21lRGlyID0gaXNXaW5kb3dzID8gdGVzdEVudlsnVVNFUlBST0ZJTEUnXSA6IHRlc3RFbnZbJ0hPTUUnXTtcbmlmICghaG9tZURpciEuZW5kc1dpdGgoJy8nKSkge1xuXHRob21lRGlyICs9ICcvJztcbn1cbmNvbnN0IHN0YW5kYXJkVGlkbGVJdGVtID0gT2JqZWN0LmZyZWV6ZSh7IGxhYmVsOiAnficsIGRldGFpbDogaG9tZURpciB9KTtcblxuc3VpdGUoJ1Rlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UnLCAoKSA9PiB7XG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgY29uZmlndXJhdGlvblNlcnZpY2U6IFRlc3RDb25maWd1cmF0aW9uU2VydmljZTtcblx0bGV0IGNhcGFiaWxpdGllczogVGVybWluYWxDYXBhYmlsaXR5U3RvcmU7XG5cdGxldCB2YWxpZFJlc291cmNlczogVVJJW107XG5cdGxldCBjaGlsZFJlc291cmNlczogeyByZXNvdXJjZTogVVJJOyBpc0ZpbGU/OiBib29sZWFuOyBpc0RpcmVjdG9yeT86IGJvb2xlYW4gfVtdO1xuXHRsZXQgdGVybWluYWxDb21wbGV0aW9uU2VydmljZTogVGVybWluYWxDb21wbGV0aW9uU2VydmljZTtcblx0Y29uc3QgcHJvdmlkZXIgPSAndGVzdFByb3ZpZGVyJztcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdG9yZS5hZGQobmV3IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSgpKTtcblx0XHRjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb25maWd1cmF0aW9uU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUZpbGVTZXJ2aWNlLCB7XG5cdFx0XHRhc3luYyBzdGF0KHJlc291cmNlKSB7XG5cdFx0XHRcdGlmICghdmFsaWRSZXNvdXJjZXMubWFwKGUgPT4gZS5wYXRoKS5pbmNsdWRlcyhyZXNvdXJjZS5wYXRoKSkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignRG9lc25cXCd0IGV4aXN0Jyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGNyZWF0ZUZpbGVTdGF0KHJlc291cmNlKTtcblx0XHRcdH0sXG5cdFx0XHRhc3luYyByZXNvbHZlKHJlc291cmNlOiBVUkksIG9wdGlvbnM6IElSZXNvbHZlTWV0YWRhdGFGaWxlT3B0aW9ucyk6IFByb21pc2U8SUZpbGVTdGF0V2l0aE1ldGFkYXRhPiB7XG5cdFx0XHRcdGNvbnN0IGNoaWxkcmVuID0gY2hpbGRSZXNvdXJjZXMuZmlsdGVyKGNoaWxkID0+IHtcblx0XHRcdFx0XHRjb25zdCBjaGlsZEZzUGF0aCA9IGNoaWxkLnJlc291cmNlLnBhdGgucmVwbGFjZSgvXFwvJC8sICcnKTtcblx0XHRcdFx0XHRjb25zdCBwYXJlbnRGc1BhdGggPSByZXNvdXJjZS5wYXRoLnJlcGxhY2UoL1xcLyQvLCAnJyk7XG5cdFx0XHRcdFx0cmV0dXJuIChcblx0XHRcdFx0XHRcdGNoaWxkRnNQYXRoLnN0YXJ0c1dpdGgocGFyZW50RnNQYXRoKSAmJlxuXHRcdFx0XHRcdFx0Y291bnQoY2hpbGRGc1BhdGgsICcvJykgPT09IGNvdW50KHBhcmVudEZzUGF0aCwgJy8nKSArIDFcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuIGNyZWF0ZUZpbGVTdGF0KHJlc291cmNlLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBjaGlsZHJlbik7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdHRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxDb21wbGV0aW9uU2VydmljZSkpO1xuXHRcdHRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UucHJvY2Vzc0VudiA9IHRlc3RFbnY7XG5cdFx0dmFsaWRSZXNvdXJjZXMgPSBbXTtcblx0XHRjaGlsZFJlc291cmNlcyA9IFtdO1xuXHRcdGNhcGFiaWxpdGllcyA9IHN0b3JlLmFkZChuZXcgVGVybWluYWxDYXBhYmlsaXR5U3RvcmUoKSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdyZXNvbHZlUmVzb3VyY2VzIHNob3VsZCByZXR1cm4gdW5kZWZpbmVkJywgKCkgPT4ge1xuXHRcdHRlc3QoJ2lmIGN3ZCBpcyBub3QgcHJvdmlkZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCByZXNvdXJjZVJlcXVlc3RDb25maWc6IFRlcm1pbmFsUmVzb3VyY2VSZXF1ZXN0Q29uZmlnID0geyBwYXRoU2VwYXJhdG9yIH07XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLnJlc29sdmVSZXNvdXJjZXMocmVzb3VyY2VSZXF1ZXN0Q29uZmlnLCAnY2QgJywgMywgcHJvdmlkZXIsIGNhcGFiaWxpdGllcyk7XG5cdFx0XHRhc3NlcnQoIXJlc3VsdCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpZiBuZWl0aGVyIGZpbGVzUmVxdWVzdGVkIG5vciBmb2xkZXJzUmVxdWVzdGVkIGFyZSB0cnVlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VSZXF1ZXN0Q29uZmlnOiBUZXJtaW5hbFJlc291cmNlUmVxdWVzdENvbmZpZyA9IHtcblx0XHRcdFx0Y3dkOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vdGVzdCcpLFxuXHRcdFx0XHRwYXRoU2VwYXJhdG9yXG5cdFx0XHR9O1xuXHRcdFx0dmFsaWRSZXNvdXJjZXMgPSBbVVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QnKV07XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLnJlc29sdmVSZXNvdXJjZXMocmVzb3VyY2VSZXF1ZXN0Q29uZmlnLCAnY2QgJywgMywgcHJvdmlkZXIsIGNhcGFiaWxpdGllcyk7XG5cdFx0XHRhc3NlcnQoIXJlc3VsdCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdyZXNvbHZlUmVzb3VyY2VzIHNob3VsZCByZXR1cm4gZm9sZGVyIGNvbXBsZXRpb25zJywgKCkgPT4ge1xuXHRcdHNldHVwKCgpID0+IHtcblx0XHRcdHZhbGlkUmVzb3VyY2VzID0gW1VSSS5wYXJzZSgnZmlsZTovLy90ZXN0JyldO1xuXHRcdFx0Y2hpbGRSZXNvdXJjZXMgPSBbXG5cdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovLy90ZXN0L2ZvbGRlcjEvJyksIGlzRGlyZWN0b3J5OiB0cnVlLCBpc0ZpbGU6IGZhbHNlIH0sXG5cdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovLy90ZXN0L2ZpbGUxLnR4dCcpLCBpc0RpcmVjdG9yeTogZmFsc2UsIGlzRmlsZTogdHJ1ZSB9LFxuXHRcdFx0XTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3wgc2hvdWxkIHJldHVybiByb290LWxldmVsIGNvbXBsZXRpb25zJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VSZXF1ZXN0Q29uZmlnOiBUZXJtaW5hbFJlc291cmNlUmVxdWVzdENvbmZpZyA9IHtcblx0XHRcdFx0Y3dkOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vdGVzdCcpLFxuXHRcdFx0XHRmb2xkZXJzUmVxdWVzdGVkOiB0cnVlLFxuXHRcdFx0XHRwYXRoU2VwYXJhdG9yXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGVybWluYWxDb21wbGV0aW9uU2VydmljZS5yZXNvbHZlUmVzb3VyY2VzKHJlc291cmNlUmVxdWVzdENvbmZpZywgJycsIDEsIHByb3ZpZGVyLCBjYXBhYmlsaXRpZXMpO1xuXG5cdFx0XHRhc3NlcnRDb21wbGV0aW9ucyhyZXN1bHQsIFtcblx0XHRcdFx0eyBsYWJlbDogJy4nLCBkZXRhaWw6ICcvdGVzdC8nIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICcuL2ZvbGRlcjEvJywgZGV0YWlsOiAnL3Rlc3QvZm9sZGVyMS8nIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICcuLi8nLCBkZXRhaWw6ICcvJyB9LFxuXHRcdFx0XHRzdGFuZGFyZFRpZGxlSXRlbSxcblx0XHRcdF0sIHsgcmVwbGFjZW1lbnRJbmRleDogMSwgcmVwbGFjZW1lbnRMZW5ndGg6IDAgfSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCcuL3wgc2hvdWxkIHJldHVybiBmb2xkZXIgY29tcGxldGlvbnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCByZXNvdXJjZVJlcXVlc3RDb25maWc6IFRlcm1pbmFsUmVzb3VyY2VSZXF1ZXN0Q29uZmlnID0ge1xuXHRcdFx0XHRjd2Q6IFVSSS5wYXJzZSgnZmlsZTovLy90ZXN0JyksXG5cdFx0XHRcdGZvbGRlcnNSZXF1ZXN0ZWQ6IHRydWUsXG5cdFx0XHRcdHBhdGhTZXBhcmF0b3Jcblx0XHRcdH07XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLnJlc29sdmVSZXNvdXJjZXMocmVzb3VyY2VSZXF1ZXN0Q29uZmlnLCAnLi8nLCAzLCBwcm92aWRlciwgY2FwYWJpbGl0aWVzKTtcblxuXHRcdFx0YXNzZXJ0Q29tcGxldGlvbnMocmVzdWx0LCBbXG5cdFx0XHRcdHsgbGFiZWw6ICcuLycsIGRldGFpbDogJy90ZXN0LycgfSxcblx0XHRcdFx0eyBsYWJlbDogJy4vZm9sZGVyMS8nLCBkZXRhaWw6ICcvdGVzdC9mb2xkZXIxLycgfSxcblx0XHRcdFx0eyBsYWJlbDogJy4vLi4vJywgZGV0YWlsOiAnLycgfSxcblx0XHRcdF0sIHsgcmVwbGFjZW1lbnRJbmRleDogMSwgcmVwbGFjZW1lbnRMZW5ndGg6IDIgfSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdjZCAuL3wgc2hvdWxkIHJldHVybiBmb2xkZXIgY29tcGxldGlvbnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCByZXNvdXJjZVJlcXVlc3RDb25maWc6IFRlcm1pbmFsUmVzb3VyY2VSZXF1ZXN0Q29uZmlnID0ge1xuXHRcdFx0XHRjd2Q6IFVSSS5wYXJzZSgnZmlsZTovLy90ZXN0JyksXG5cdFx0XHRcdGZvbGRlcnNSZXF1ZXN0ZWQ6IHRydWUsXG5cdFx0XHRcdHBhdGhTZXBhcmF0b3Jcblx0XHRcdH07XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLnJlc29sdmVSZXNvdXJjZXMocmVzb3VyY2VSZXF1ZXN0Q29uZmlnLCAnY2QgLi8nLCA1LCBwcm92aWRlciwgY2FwYWJpbGl0aWVzKTtcblxuXHRcdFx0YXNzZXJ0Q29tcGxldGlvbnMocmVzdWx0LCBbXG5cdFx0XHRcdHsgbGFiZWw6ICcuLycsIGRldGFpbDogJy90ZXN0LycgfSxcblx0XHRcdFx0eyBsYWJlbDogJy4vZm9sZGVyMS8nLCBkZXRhaWw6ICcvdGVzdC9mb2xkZXIxLycgfSxcblx0XHRcdFx0eyBsYWJlbDogJy4vLi4vJywgZGV0YWlsOiAnLycgfSxcblx0XHRcdF0sIHsgcmVwbGFjZW1lbnRJbmRleDogMywgcmVwbGFjZW1lbnRMZW5ndGg6IDIgfSk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnY2QgLi9mfCBzaG91bGQgcmV0dXJuIGZvbGRlciBjb21wbGV0aW9ucycsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHJlc291cmNlUmVxdWVzdENvbmZpZzogVGVybWluYWxSZXNvdXJjZVJlcXVlc3RDb25maWcgPSB7XG5cdFx0XHRcdGN3ZDogVVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QnKSxcblx0XHRcdFx0Zm9sZGVyc1JlcXVlc3RlZDogdHJ1ZSxcblx0XHRcdFx0cGF0aFNlcGFyYXRvclxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UucmVzb2x2ZVJlc291cmNlcyhyZXNvdXJjZVJlcXVlc3RDb25maWcsICdjZCAuL2YnLCA2LCBwcm92aWRlciwgY2FwYWJpbGl0aWVzKTtcblxuXHRcdFx0YXNzZXJ0Q29tcGxldGlvbnMocmVzdWx0LCBbXG5cdFx0XHRcdHsgbGFiZWw6ICcuLycsIGRldGFpbDogJy90ZXN0LycgfSxcblx0XHRcdFx0eyBsYWJlbDogJy4vZm9sZGVyMS8nLCBkZXRhaWw6ICcvdGVzdC9mb2xkZXIxLycgfSxcblx0XHRcdFx0eyBsYWJlbDogJy4vLi4vJywgZGV0YWlsOiAnLycgfSxcblx0XHRcdF0sIHsgcmVwbGFjZW1lbnRJbmRleDogMywgcmVwbGFjZW1lbnRMZW5ndGg6IDMgfSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdyZXNvbHZlUmVzb3VyY2VzIHNob3VsZCBoYW5kbGUgZmlsZSBhbmQgZm9sZGVyIGNvbXBsZXRpb24gcmVxdWVzdHMgY29ycmVjdGx5JywgKCkgPT4ge1xuXHRcdHNldHVwKCgpID0+IHtcblx0XHRcdHZhbGlkUmVzb3VyY2VzID0gW1VSSS5wYXJzZSgnZmlsZTovLy90ZXN0JyldO1xuXHRcdFx0Y2hpbGRSZXNvdXJjZXMgPSBbXG5cdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovLy90ZXN0Ly5oaWRkZW5GaWxlJyksIGlzRmlsZTogdHJ1ZSB9LFxuXHRcdFx0XHR7IHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vdGVzdC8uaGlkZGVuRm9sZGVyLycpLCBpc0RpcmVjdG9yeTogdHJ1ZSB9LFxuXHRcdFx0XHR7IHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vdGVzdC9mb2xkZXIxLycpLCBpc0RpcmVjdG9yeTogdHJ1ZSB9LFxuXHRcdFx0XHR7IHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vdGVzdC9maWxlMS50eHQnKSwgaXNGaWxlOiB0cnVlIH0sXG5cdFx0XHRdO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnLi98IHNob3VsZCBoYW5kbGUgaGlkZGVuIGZpbGVzIGFuZCBmb2xkZXJzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VSZXF1ZXN0Q29uZmlnOiBUZXJtaW5hbFJlc291cmNlUmVxdWVzdENvbmZpZyA9IHtcblx0XHRcdFx0Y3dkOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vdGVzdCcpLFxuXHRcdFx0XHRmb2xkZXJzUmVxdWVzdGVkOiB0cnVlLFxuXHRcdFx0XHRmaWxlc1JlcXVlc3RlZDogdHJ1ZSxcblx0XHRcdFx0cGF0aFNlcGFyYXRvclxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UucmVzb2x2ZVJlc291cmNlcyhyZXNvdXJjZVJlcXVlc3RDb25maWcsICcuLycsIDIsIHByb3ZpZGVyLCBjYXBhYmlsaXRpZXMpO1xuXG5cdFx0XHRhc3NlcnRDb21wbGV0aW9ucyhyZXN1bHQsIFtcblx0XHRcdFx0eyBsYWJlbDogJy4vJywgZGV0YWlsOiAnL3Rlc3QvJyB9LFxuXHRcdFx0XHR7IGxhYmVsOiAnLi8uaGlkZGVuRmlsZScsIGRldGFpbDogJy90ZXN0Ly5oaWRkZW5GaWxlJywga2luZDogVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuRmlsZSB9LFxuXHRcdFx0XHR7IGxhYmVsOiAnLi8uaGlkZGVuRm9sZGVyLycsIGRldGFpbDogJy90ZXN0Ly5oaWRkZW5Gb2xkZXIvJyB9LFxuXHRcdFx0XHR7IGxhYmVsOiAnLi9mb2xkZXIxLycsIGRldGFpbDogJy90ZXN0L2ZvbGRlcjEvJyB9LFxuXHRcdFx0XHR7IGxhYmVsOiAnLi9maWxlMS50eHQnLCBkZXRhaWw6ICcvdGVzdC9maWxlMS50eHQnLCBraW5kOiBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5GaWxlIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICcuLy4uLycsIGRldGFpbDogJy8nIH0sXG5cdFx0XHRdLCB7IHJlcGxhY2VtZW50SW5kZXg6IDAsIHJlcGxhY2VtZW50TGVuZ3RoOiAyIH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnLi9ofCBzaG91bGQgaGFuZGxlIGhpZGRlbiBmaWxlcyBhbmQgZm9sZGVycycsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHJlc291cmNlUmVxdWVzdENvbmZpZzogVGVybWluYWxSZXNvdXJjZVJlcXVlc3RDb25maWcgPSB7XG5cdFx0XHRcdGN3ZDogVVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QnKSxcblx0XHRcdFx0Zm9sZGVyc1JlcXVlc3RlZDogdHJ1ZSxcblx0XHRcdFx0ZmlsZXNSZXF1ZXN0ZWQ6IHRydWUsXG5cdFx0XHRcdHBhdGhTZXBhcmF0b3Jcblx0XHRcdH07XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLnJlc29sdmVSZXNvdXJjZXMocmVzb3VyY2VSZXF1ZXN0Q29uZmlnLCAnLi9oJywgMywgcHJvdmlkZXIsIGNhcGFiaWxpdGllcyk7XG5cblx0XHRcdGFzc2VydENvbXBsZXRpb25zKHJlc3VsdCwgW1xuXHRcdFx0XHR7IGxhYmVsOiAnLi8nLCBkZXRhaWw6ICcvdGVzdC8nIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICcuLy5oaWRkZW5GaWxlJywgZGV0YWlsOiAnL3Rlc3QvLmhpZGRlbkZpbGUnLCBraW5kOiBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5GaWxlIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICcuLy5oaWRkZW5Gb2xkZXIvJywgZGV0YWlsOiAnL3Rlc3QvLmhpZGRlbkZvbGRlci8nIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICcuL2ZvbGRlcjEvJywgZGV0YWlsOiAnL3Rlc3QvZm9sZGVyMS8nIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICcuL2ZpbGUxLnR4dCcsIGRldGFpbDogJy90ZXN0L2ZpbGUxLnR4dCcsIGtpbmQ6IFRlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLkZpbGUgfSxcblx0XHRcdFx0eyBsYWJlbDogJy4vLi4vJywgZGV0YWlsOiAnLycgfSxcblx0XHRcdF0sIHsgcmVwbGFjZW1lbnRJbmRleDogMCwgcmVwbGFjZW1lbnRMZW5ndGg6IDMgfSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCd+IC0+ICRIT01FJywgKCkgPT4ge1xuXHRcdGxldCByZXNvdXJjZVJlcXVlc3RDb25maWc6IFRlcm1pbmFsUmVzb3VyY2VSZXF1ZXN0Q29uZmlnO1xuXHRcdGxldCBzaGVsbEVudkRldGVjdGlvbjogU2hlbGxFbnZEZXRlY3Rpb25DYXBhYmlsaXR5O1xuXG5cdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0c2hlbGxFbnZEZXRlY3Rpb24gPSBzdG9yZS5hZGQobmV3IFNoZWxsRW52RGV0ZWN0aW9uQ2FwYWJpbGl0eSgpKTtcblx0XHRcdHNoZWxsRW52RGV0ZWN0aW9uLnNldEVudmlyb25tZW50KHtcblx0XHRcdFx0SE9NRTogJy9ob21lJyxcblx0XHRcdFx0VVNFUlBST0ZJTEU6ICcvaG9tZSdcblx0XHRcdH0sIHRydWUpO1xuXHRcdFx0Y2FwYWJpbGl0aWVzLmFkZChUZXJtaW5hbENhcGFiaWxpdHkuU2hlbGxFbnZEZXRlY3Rpb24sIHNoZWxsRW52RGV0ZWN0aW9uKTtcblxuXHRcdFx0cmVzb3VyY2VSZXF1ZXN0Q29uZmlnID0ge1xuXHRcdFx0XHRjd2Q6IFVSSS5wYXJzZSgnZmlsZTovLy90ZXN0L2ZvbGRlcjEnKSwvLyBVcGRhdGVkIHRvIHJlZmxlY3QgaG9tZSBkaXJlY3Rvcnlcblx0XHRcdFx0ZmlsZXNSZXF1ZXN0ZWQ6IHRydWUsXG5cdFx0XHRcdGZvbGRlcnNSZXF1ZXN0ZWQ6IHRydWUsXG5cdFx0XHRcdHBhdGhTZXBhcmF0b3Jcblx0XHRcdH07XG5cdFx0XHR2YWxpZFJlc291cmNlcyA9IFtcblx0XHRcdFx0VVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QnKSxcblx0XHRcdFx0VVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QvZm9sZGVyMScpLFxuXHRcdFx0XHRVUkkucGFyc2UoJ2ZpbGU6Ly8vaG9tZScpLFxuXHRcdFx0XHRVUkkucGFyc2UoJ2ZpbGU6Ly8vaG9tZS92c2NvZGUnKSxcblx0XHRcdFx0VVJJLnBhcnNlKCdmaWxlOi8vL2hvbWUvdnNjb2RlL2ZvbycpLFxuXHRcdFx0XHRVUkkucGFyc2UoJ2ZpbGU6Ly8vaG9tZS92c2NvZGUvYmFyLnR4dCcpLFxuXHRcdFx0XTtcblx0XHRcdGNoaWxkUmVzb3VyY2VzID0gW1xuXHRcdFx0XHR7IHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vaG9tZS92c2NvZGUnKSwgaXNEaXJlY3Rvcnk6IHRydWUgfSxcblx0XHRcdFx0eyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vL2hvbWUvdnNjb2RlL2ZvbycpLCBpc0RpcmVjdG9yeTogdHJ1ZSB9LFxuXHRcdFx0XHR7IHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vaG9tZS92c2NvZGUvYmFyLnR4dCcpLCBpc0ZpbGU6IHRydWUgfSxcblx0XHRcdF07XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd+fCBzaG91bGQgcmV0dXJuIGNvbXBsZXRpb24gZm9yIH4nLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhc3NlcnRQYXJ0aWFsQ29tcGxldGlvbnNFeGlzdChhd2FpdCB0ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLnJlc29sdmVSZXNvdXJjZXMocmVzb3VyY2VSZXF1ZXN0Q29uZmlnLCAnficsIDEsIHByb3ZpZGVyLCBjYXBhYmlsaXRpZXMpLCBbXG5cdFx0XHRcdHsgbGFiZWw6ICd+JywgZGV0YWlsOiAnL2hvbWUvJyB9LFxuXHRcdFx0XSwgeyByZXBsYWNlbWVudEluZGV4OiAwLCByZXBsYWNlbWVudExlbmd0aDogMSB9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ34vfCBzaG91bGQgcmV0dXJuIGZvbGRlciBjb21wbGV0aW9ucyByZWxhdGl2ZSB0byAkSE9NRScsIGFzeW5jICgpID0+IHtcblx0XHRcdGFzc2VydENvbXBsZXRpb25zKGF3YWl0IHRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UucmVzb2x2ZVJlc291cmNlcyhyZXNvdXJjZVJlcXVlc3RDb25maWcsICd+LycsIDIsIHByb3ZpZGVyLCBjYXBhYmlsaXRpZXMpLCBbXG5cdFx0XHRcdHsgbGFiZWw6ICd+LycsIGRldGFpbDogJy9ob21lLycgfSxcblx0XHRcdFx0eyBsYWJlbDogJ34vdnNjb2RlLycsIGRldGFpbDogJy9ob21lL3ZzY29kZS8nIH0sXG5cdFx0XHRdLCB7IHJlcGxhY2VtZW50SW5kZXg6IDAsIHJlcGxhY2VtZW50TGVuZ3RoOiAyIH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnfi92c2NvZGUvfCBzaG91bGQgcmV0dXJuIGZvbGRlciBjb21wbGV0aW9ucyByZWxhdGl2ZSB0byAkSE9NRS92c2NvZGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhc3NlcnRDb21wbGV0aW9ucyhhd2FpdCB0ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLnJlc29sdmVSZXNvdXJjZXMocmVzb3VyY2VSZXF1ZXN0Q29uZmlnLCAnfi92c2NvZGUvJywgOSwgcHJvdmlkZXIsIGNhcGFiaWxpdGllcyksIFtcblx0XHRcdFx0eyBsYWJlbDogJ34vdnNjb2RlLycsIGRldGFpbDogJy9ob21lL3ZzY29kZS8nIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICd+L3ZzY29kZS9mb28vJywgZGV0YWlsOiAnL2hvbWUvdnNjb2RlL2Zvby8nIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICd+L3ZzY29kZS9iYXIudHh0JywgZGV0YWlsOiAnL2hvbWUvdnNjb2RlL2Jhci50eHQnLCBraW5kOiBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5GaWxlIH0sXG5cdFx0XHRdLCB7IHJlcGxhY2VtZW50SW5kZXg6IDAsIHJlcGxhY2VtZW50TGVuZ3RoOiA5IH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgncmVzb2x2ZVJlc291cmNlcyBlZGdlIGNhc2VzIGFuZCBhZHZhbmNlZCBzY2VuYXJpb3MnLCAoKSA9PiB7XG5cdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0dmFsaWRSZXNvdXJjZXMgPSBbXTtcblx0XHRcdGNoaWxkUmVzb3VyY2VzID0gW107XG5cdFx0fSk7XG5cblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHR0ZXN0KCdDOi9Gb28vfCBhYnNvbHV0ZSBwYXRocyBvbiBXaW5kb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCByZXNvdXJjZVJlcXVlc3RDb25maWc6IFRlcm1pbmFsUmVzb3VyY2VSZXF1ZXN0Q29uZmlnID0ge1xuXHRcdFx0XHRcdGN3ZDogVVJJLnBhcnNlKCdmaWxlOi8vL0M6JyksXG5cdFx0XHRcdFx0Zm9sZGVyc1JlcXVlc3RlZDogdHJ1ZSxcblx0XHRcdFx0XHRwYXRoU2VwYXJhdG9yXG5cdFx0XHRcdH07XG5cdFx0XHRcdHZhbGlkUmVzb3VyY2VzID0gW1VSSS5wYXJzZSgnZmlsZTovLy9DOi9Gb28nKV07XG5cdFx0XHRcdGNoaWxkUmVzb3VyY2VzID0gW1xuXHRcdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovLy9DOi9Gb28vQmFyJyksIGlzRGlyZWN0b3J5OiB0cnVlLCBpc0ZpbGU6IGZhbHNlIH0sXG5cdFx0XHRcdFx0eyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vL0M6L0Zvby9CYXoudHh0JyksIGlzRGlyZWN0b3J5OiBmYWxzZSwgaXNGaWxlOiB0cnVlIH1cblx0XHRcdFx0XTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGVybWluYWxDb21wbGV0aW9uU2VydmljZS5yZXNvbHZlUmVzb3VyY2VzKHJlc291cmNlUmVxdWVzdENvbmZpZywgJ0M6L0Zvby8nLCA3LCBwcm92aWRlciwgY2FwYWJpbGl0aWVzKTtcblxuXHRcdFx0XHRhc3NlcnRDb21wbGV0aW9ucyhyZXN1bHQsIFtcblx0XHRcdFx0XHR7IGxhYmVsOiAnQzovRm9vLycsIGRldGFpbDogJ0M6L0Zvby8nIH0sXG5cdFx0XHRcdFx0eyBsYWJlbDogJ0M6L0Zvby9CYXIvJywgZGV0YWlsOiAnQzovRm9vL0Jhci8nIH0sXG5cdFx0XHRcdF0sIHsgcmVwbGFjZW1lbnRJbmRleDogMCwgcmVwbGFjZW1lbnRMZW5ndGg6IDcgfSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2M6L2Zvby98IGNhc2UgaW5zZW5zaXRpdml0eSBvbiBXaW5kb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCByZXNvdXJjZVJlcXVlc3RDb25maWc6IFRlcm1pbmFsUmVzb3VyY2VSZXF1ZXN0Q29uZmlnID0ge1xuXHRcdFx0XHRcdGN3ZDogVVJJLnBhcnNlKCdmaWxlOi8vL2M6JyksXG5cdFx0XHRcdFx0Zm9sZGVyc1JlcXVlc3RlZDogdHJ1ZSxcblx0XHRcdFx0XHRwYXRoU2VwYXJhdG9yXG5cdFx0XHRcdH07XG5cdFx0XHRcdHZhbGlkUmVzb3VyY2VzID0gW1VSSS5wYXJzZSgnZmlsZTovLy9jOi9mb28nKV07XG5cdFx0XHRcdGNoaWxkUmVzb3VyY2VzID0gW1xuXHRcdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovLy9jOi9mb28vQmFyJyksIGlzRGlyZWN0b3J5OiB0cnVlLCBpc0ZpbGU6IGZhbHNlIH1cblx0XHRcdFx0XTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGVybWluYWxDb21wbGV0aW9uU2VydmljZS5yZXNvbHZlUmVzb3VyY2VzKHJlc291cmNlUmVxdWVzdENvbmZpZywgJ2M6L2Zvby8nLCA3LCBwcm92aWRlciwgY2FwYWJpbGl0aWVzKTtcblxuXHRcdFx0XHRhc3NlcnRDb21wbGV0aW9ucyhyZXN1bHQsIFtcblx0XHRcdFx0XHQvLyBOb3RlIHRoYXQgdGhlIGRldGFpbCBpcyBub3JtYWxpemVzIGRyaXZlIGxldHRlcnMgdG8gY2FwaXRhbCBjYXNlIGludGVudGlvbmFsbHlcblx0XHRcdFx0XHR7IGxhYmVsOiAnYzovZm9vLycsIGRldGFpbDogJ0M6L2Zvby8nIH0sXG5cdFx0XHRcdFx0eyBsYWJlbDogJ2M6L2Zvby9CYXIvJywgZGV0YWlsOiAnQzovZm9vL0Jhci8nIH0sXG5cdFx0XHRcdF0sIHsgcmVwbGFjZW1lbnRJbmRleDogMCwgcmVwbGFjZW1lbnRMZW5ndGg6IDcgfSk7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGVzdCgnL2Zvby98IGFic29sdXRlIHBhdGhzIE5PVCBvbiBXaW5kb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCByZXNvdXJjZVJlcXVlc3RDb25maWc6IFRlcm1pbmFsUmVzb3VyY2VSZXF1ZXN0Q29uZmlnID0ge1xuXHRcdFx0XHRcdGN3ZDogVVJJLnBhcnNlKCdmaWxlOi8vLycpLFxuXHRcdFx0XHRcdGZvbGRlcnNSZXF1ZXN0ZWQ6IHRydWUsXG5cdFx0XHRcdFx0cGF0aFNlcGFyYXRvclxuXHRcdFx0XHR9O1xuXHRcdFx0XHR2YWxpZFJlc291cmNlcyA9IFtVUkkucGFyc2UoJ2ZpbGU6Ly8vZm9vJyldO1xuXHRcdFx0XHRjaGlsZFJlc291cmNlcyA9IFtcblx0XHRcdFx0XHR7IHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vZm9vL0JhcicpLCBpc0RpcmVjdG9yeTogdHJ1ZSwgaXNGaWxlOiBmYWxzZSB9LFxuXHRcdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovLy9mb28vQmF6LnR4dCcpLCBpc0RpcmVjdG9yeTogZmFsc2UsIGlzRmlsZTogdHJ1ZSB9XG5cdFx0XHRcdF07XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UucmVzb2x2ZVJlc291cmNlcyhyZXNvdXJjZVJlcXVlc3RDb25maWcsICcvZm9vLycsIDUsIHByb3ZpZGVyLCBjYXBhYmlsaXRpZXMpO1xuXG5cdFx0XHRcdGFzc2VydENvbXBsZXRpb25zKHJlc3VsdCwgW1xuXHRcdFx0XHRcdHsgbGFiZWw6ICcvZm9vLycsIGRldGFpbDogJy9mb28vJyB9LFxuXHRcdFx0XHRcdHsgbGFiZWw6ICcvZm9vL0Jhci8nLCBkZXRhaWw6ICcvZm9vL0Jhci8nIH0sXG5cdFx0XHRcdF0sIHsgcmVwbGFjZW1lbnRJbmRleDogMCwgcmVwbGFjZW1lbnRMZW5ndGg6IDUgfSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHR0ZXN0KCcuXFxcXGZvbGRlciB8IENhc2UgaW5zZW5zaXRpdml0eSBzaG91bGQgcmVzb2x2ZSBjb3JyZWN0bHkgb24gV2luZG93cycsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzb3VyY2VSZXF1ZXN0Q29uZmlnOiBUZXJtaW5hbFJlc291cmNlUmVxdWVzdENvbmZpZyA9IHtcblx0XHRcdFx0XHRjd2Q6IFVSSS5wYXJzZSgnZmlsZTovLy9DOi90ZXN0JyksXG5cdFx0XHRcdFx0Zm9sZGVyc1JlcXVlc3RlZDogdHJ1ZSxcblx0XHRcdFx0XHRwYXRoU2VwYXJhdG9yOiAnXFxcXCdcblx0XHRcdFx0fTtcblxuXHRcdFx0XHR2YWxpZFJlc291cmNlcyA9IFtVUkkucGFyc2UoJ2ZpbGU6Ly8vQzovdGVzdCcpXTtcblx0XHRcdFx0Y2hpbGRSZXNvdXJjZXMgPSBbXG5cdFx0XHRcdFx0eyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vL0M6L3Rlc3QvRm9sZGVyQS8nKSwgaXNEaXJlY3Rvcnk6IHRydWUgfSxcblx0XHRcdFx0XHR7IHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vQzovdGVzdC9hbm90aGVyRm9sZGVyLycpLCBpc0RpcmVjdG9yeTogdHJ1ZSB9XG5cdFx0XHRcdF07XG5cblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGVybWluYWxDb21wbGV0aW9uU2VydmljZS5yZXNvbHZlUmVzb3VyY2VzKHJlc291cmNlUmVxdWVzdENvbmZpZywgJy5cXFxcZm9sZGVyJywgOCwgcHJvdmlkZXIsIGNhcGFiaWxpdGllcyk7XG5cblx0XHRcdFx0YXNzZXJ0Q29tcGxldGlvbnMocmVzdWx0LCBbXG5cdFx0XHRcdFx0eyBsYWJlbDogJy5cXFxcJywgZGV0YWlsOiAnQzpcXFxcdGVzdFxcXFwnIH0sXG5cdFx0XHRcdFx0eyBsYWJlbDogJy5cXFxcRm9sZGVyQVxcXFwnLCBkZXRhaWw6ICdDOlxcXFx0ZXN0XFxcXEZvbGRlckFcXFxcJyB9LFxuXHRcdFx0XHRcdHsgbGFiZWw6ICcuXFxcXGFub3RoZXJGb2xkZXJcXFxcJywgZGV0YWlsOiAnQzpcXFxcdGVzdFxcXFxhbm90aGVyRm9sZGVyXFxcXCcgfSxcblx0XHRcdFx0XHR7IGxhYmVsOiAnLlxcXFwuLlxcXFwnLCBkZXRhaWw6ICdDOlxcXFwnIH0sXG5cdFx0XHRcdF0sIHsgcmVwbGFjZW1lbnRJbmRleDogMCwgcmVwbGFjZW1lbnRMZW5ndGg6IDggfSk7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGVzdCgnLi9mb2xkZXIgfCBDYXNlIHNlbnNpdGl2aXR5IHNob3VsZCByZXNvbHZlIGNvcnJlY3RseSBvbiBNYWMvVW5peCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzb3VyY2VSZXF1ZXN0Q29uZmlnOiBUZXJtaW5hbFJlc291cmNlUmVxdWVzdENvbmZpZyA9IHtcblx0XHRcdFx0XHRjd2Q6IFVSSS5wYXJzZSgnZmlsZTovLy90ZXN0JyksXG5cdFx0XHRcdFx0Zm9sZGVyc1JlcXVlc3RlZDogdHJ1ZSxcblx0XHRcdFx0XHRwYXRoU2VwYXJhdG9yOiAnLydcblx0XHRcdFx0fTtcblx0XHRcdFx0dmFsaWRSZXNvdXJjZXMgPSBbVVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QnKV07XG5cdFx0XHRcdGNoaWxkUmVzb3VyY2VzID0gW1xuXHRcdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovLy90ZXN0L0ZvbGRlckEvJyksIGlzRGlyZWN0b3J5OiB0cnVlIH0sXG5cdFx0XHRcdFx0eyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QvZm9sZGVyYS8nKSwgaXNEaXJlY3Rvcnk6IHRydWUgfVxuXHRcdFx0XHRdO1xuXG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UucmVzb2x2ZVJlc291cmNlcyhyZXNvdXJjZVJlcXVlc3RDb25maWcsICcuL2ZvbGRlcicsIDgsIHByb3ZpZGVyLCBjYXBhYmlsaXRpZXMpO1xuXG5cdFx0XHRcdGFzc2VydENvbXBsZXRpb25zKHJlc3VsdCwgW1xuXHRcdFx0XHRcdHsgbGFiZWw6ICcuLycsIGRldGFpbDogJy90ZXN0LycgfSxcblx0XHRcdFx0XHR7IGxhYmVsOiAnLi9Gb2xkZXJBLycsIGRldGFpbDogJy90ZXN0L0ZvbGRlckEvJyB9LFxuXHRcdFx0XHRcdHsgbGFiZWw6ICcuL2ZvbGRlcmEvJywgZGV0YWlsOiAnL3Rlc3QvZm9sZGVyYS8nIH0sXG5cdFx0XHRcdFx0eyBsYWJlbDogJy4vLi4vJywgZGV0YWlsOiAnLycgfVxuXHRcdFx0XHRdLCB7IHJlcGxhY2VtZW50SW5kZXg6IDAsIHJlcGxhY2VtZW50TGVuZ3RoOiA4IH0pO1xuXHRcdFx0fSk7XG5cblx0XHR9XG5cdFx0dGVzdCgnfCBFbXB0eSBpbnB1dCBzaG91bGQgcmVzb2x2ZSB0byBjdXJyZW50IGRpcmVjdG9yeScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHJlc291cmNlUmVxdWVzdENvbmZpZzogVGVybWluYWxSZXNvdXJjZVJlcXVlc3RDb25maWcgPSB7XG5cdFx0XHRcdGN3ZDogVVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QnKSxcblx0XHRcdFx0Zm9sZGVyc1JlcXVlc3RlZDogdHJ1ZSxcblx0XHRcdFx0cGF0aFNlcGFyYXRvclxuXHRcdFx0fTtcblx0XHRcdHZhbGlkUmVzb3VyY2VzID0gW1VSSS5wYXJzZSgnZmlsZTovLy90ZXN0JyldO1xuXHRcdFx0Y2hpbGRSZXNvdXJjZXMgPSBbXG5cdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovLy90ZXN0L2ZvbGRlcjEvJyksIGlzRGlyZWN0b3J5OiB0cnVlIH0sXG5cdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovLy90ZXN0L2ZvbGRlcjIvJyksIGlzRGlyZWN0b3J5OiB0cnVlIH1cblx0XHRcdF07XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLnJlc29sdmVSZXNvdXJjZXMocmVzb3VyY2VSZXF1ZXN0Q29uZmlnLCAnJywgMCwgcHJvdmlkZXIsIGNhcGFiaWxpdGllcyk7XG5cblx0XHRcdGFzc2VydENvbXBsZXRpb25zKHJlc3VsdCwgW1xuXHRcdFx0XHR7IGxhYmVsOiAnLicsIGRldGFpbDogJy90ZXN0LycgfSxcblx0XHRcdFx0eyBsYWJlbDogJy4vZm9sZGVyMS8nLCBkZXRhaWw6ICcvdGVzdC9mb2xkZXIxLycgfSxcblx0XHRcdFx0eyBsYWJlbDogJy4vZm9sZGVyMi8nLCBkZXRhaWw6ICcvdGVzdC9mb2xkZXIyLycgfSxcblx0XHRcdFx0eyBsYWJlbDogJy4uLycsIGRldGFpbDogJy8nIH0sXG5cdFx0XHRcdHN0YW5kYXJkVGlkbGVJdGVtLFxuXHRcdFx0XSwgeyByZXBsYWNlbWVudEluZGV4OiAwLCByZXBsYWNlbWVudExlbmd0aDogMCB9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJy4vfCBzaG91bGQgaGFuZGxlIGxhcmdlIGRpcmVjdG9yaWVzIHdpdGggbWFueSByZXN1bHRzIGdyYWNlZnVsbHknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCByZXNvdXJjZVJlcXVlc3RDb25maWc6IFRlcm1pbmFsUmVzb3VyY2VSZXF1ZXN0Q29uZmlnID0ge1xuXHRcdFx0XHRjd2Q6IFVSSS5wYXJzZSgnZmlsZTovLy90ZXN0JyksXG5cdFx0XHRcdGZvbGRlcnNSZXF1ZXN0ZWQ6IHRydWUsXG5cdFx0XHRcdHBhdGhTZXBhcmF0b3Jcblx0XHRcdH07XG5cdFx0XHR2YWxpZFJlc291cmNlcyA9IFtVUkkucGFyc2UoJ2ZpbGU6Ly8vdGVzdCcpXTtcblx0XHRcdGNoaWxkUmVzb3VyY2VzID0gQXJyYXkuZnJvbSh7IGxlbmd0aDogMTAwMCB9LCAoXywgaSkgPT4gKHtcblx0XHRcdFx0cmVzb3VyY2U6IFVSSS5wYXJzZShgZmlsZTovLy90ZXN0L2ZvbGRlciR7aX0vYCksXG5cdFx0XHRcdGlzRGlyZWN0b3J5OiB0cnVlXG5cdFx0XHR9KSk7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLnJlc29sdmVSZXNvdXJjZXMocmVzb3VyY2VSZXF1ZXN0Q29uZmlnLCAnLi8nLCAyLCBwcm92aWRlciwgY2FwYWJpbGl0aWVzKTtcblxuXHRcdFx0YXNzZXJ0KHJlc3VsdCk7XG5cdFx0XHQvLyBpbmNsdWRlcyB0aGUgMTAwMCBmb2xkZXJzICsgLi8gYW5kIC4vLi4vXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Py5sZW5ndGgsIDEwMDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdFswXS5sYWJlbCwgYC4ke3BhdGhTZXBhcmF0b3J9YCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmF0KC0xKT8ubGFiZWwsIGAuJHtwYXRoU2VwYXJhdG9yfS4uJHtwYXRoU2VwYXJhdG9yfWApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnLi9mb2xkZXJ8IHNob3VsZCBpbmNsdWRlIGN1cnJlbnQgZm9sZGVyIHdpdGggdHJhaWxpbmcgLyBpcyBtaXNzaW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VSZXF1ZXN0Q29uZmlnOiBUZXJtaW5hbFJlc291cmNlUmVxdWVzdENvbmZpZyA9IHtcblx0XHRcdFx0Y3dkOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vdGVzdCcpLFxuXHRcdFx0XHRmb2xkZXJzUmVxdWVzdGVkOiB0cnVlLFxuXHRcdFx0XHRwYXRoU2VwYXJhdG9yXG5cdFx0XHR9O1xuXHRcdFx0dmFsaWRSZXNvdXJjZXMgPSBbVVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QnKV07XG5cdFx0XHRjaGlsZFJlc291cmNlcyA9IFtcblx0XHRcdFx0eyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QvZm9sZGVyMS8nKSwgaXNEaXJlY3Rvcnk6IHRydWUgfSxcblx0XHRcdFx0eyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QvZm9sZGVyMi8nKSwgaXNEaXJlY3Rvcnk6IHRydWUgfVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UucmVzb2x2ZVJlc291cmNlcyhyZXNvdXJjZVJlcXVlc3RDb25maWcsICcuL2ZvbGRlcjEnLCAxMCwgcHJvdmlkZXIsIGNhcGFiaWxpdGllcyk7XG5cblx0XHRcdGFzc2VydENvbXBsZXRpb25zKHJlc3VsdCwgW1xuXHRcdFx0XHR7IGxhYmVsOiAnLi8nLCBkZXRhaWw6ICcvdGVzdC8nIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICcuL2ZvbGRlcjEvJywgZGV0YWlsOiAnL3Rlc3QvZm9sZGVyMS8nIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICcuL2ZvbGRlcjIvJywgZGV0YWlsOiAnL3Rlc3QvZm9sZGVyMi8nIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICcuLy4uLycsIGRldGFpbDogJy8nIH1cblx0XHRcdF0sIHsgcmVwbGFjZW1lbnRJbmRleDogMSwgcmVwbGFjZW1lbnRMZW5ndGg6IDkgfSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdmb2xkZXIvfCBzaG91bGQgbm9ybWFsaXplIGN1cnJlbnQgYW5kIHBhcmVudCBmb2xkZXJzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VSZXF1ZXN0Q29uZmlnOiBUZXJtaW5hbFJlc291cmNlUmVxdWVzdENvbmZpZyA9IHtcblx0XHRcdFx0Y3dkOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vdGVzdCcpLFxuXHRcdFx0XHRmb2xkZXJzUmVxdWVzdGVkOiB0cnVlLFxuXHRcdFx0XHRwYXRoU2VwYXJhdG9yXG5cdFx0XHR9O1xuXHRcdFx0dmFsaWRSZXNvdXJjZXMgPSBbXG5cdFx0XHRcdFVSSS5wYXJzZSgnZmlsZTovLy8nKSxcblx0XHRcdFx0VVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QnKSxcblx0XHRcdFx0VVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QvZm9sZGVyMScpLFxuXHRcdFx0XHRVUkkucGFyc2UoJ2ZpbGU6Ly8vdGVzdC9mb2xkZXIyJyksXG5cdFx0XHRdO1xuXHRcdFx0Y2hpbGRSZXNvdXJjZXMgPSBbXG5cdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovLy90ZXN0L2ZvbGRlcjEvJyksIGlzRGlyZWN0b3J5OiB0cnVlIH0sXG5cdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovLy90ZXN0L2ZvbGRlcjIvJyksIGlzRGlyZWN0b3J5OiB0cnVlIH1cblx0XHRcdF07XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLnJlc29sdmVSZXNvdXJjZXMocmVzb3VyY2VSZXF1ZXN0Q29uZmlnLCAndGVzdC8nLCA1LCBwcm92aWRlciwgY2FwYWJpbGl0aWVzKTtcblxuXHRcdFx0YXNzZXJ0Q29tcGxldGlvbnMocmVzdWx0LCBbXG5cdFx0XHRcdHsgbGFiZWw6ICcuL3Rlc3QvJywgZGV0YWlsOiAnL3Rlc3QvJyB9LFxuXHRcdFx0XHR7IGxhYmVsOiAnLi90ZXN0L2ZvbGRlcjEvJywgZGV0YWlsOiAnL3Rlc3QvZm9sZGVyMS8nIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICcuL3Rlc3QvZm9sZGVyMi8nLCBkZXRhaWw6ICcvdGVzdC9mb2xkZXIyLycgfSxcblx0XHRcdFx0eyBsYWJlbDogJy4vdGVzdC8uLi8nLCBkZXRhaWw6ICcvJyB9XG5cdFx0XHRdLCB7IHJlcGxhY2VtZW50SW5kZXg6IDAsIHJlcGxhY2VtZW50TGVuZ3RoOiA1IH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnY2RwYXRoJywgKCkgPT4ge1xuXHRcdGxldCBzaGVsbEVudkRldGVjdGlvbjogU2hlbGxFbnZEZXRlY3Rpb25DYXBhYmlsaXR5O1xuXG5cdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0dmFsaWRSZXNvdXJjZXMgPSBbVVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QnKV07XG5cdFx0XHRjaGlsZFJlc291cmNlcyA9IFtcblx0XHRcdFx0eyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vL2NkcGF0aF92YWx1ZS9mb2xkZXIxLycpLCBpc0RpcmVjdG9yeTogdHJ1ZSB9LFxuXHRcdFx0XHR7IHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vY2RwYXRoX3ZhbHVlL2ZpbGUxLnR4dCcpLCBpc0ZpbGU6IHRydWUgfSxcblx0XHRcdF07XG5cblx0XHRcdHNoZWxsRW52RGV0ZWN0aW9uID0gc3RvcmUuYWRkKG5ldyBTaGVsbEVudkRldGVjdGlvbkNhcGFiaWxpdHkoKSk7XG5cdFx0XHRzaGVsbEVudkRldGVjdGlvbi5zZXRFbnZpcm9ubWVudCh7IENEUEFUSDogJy9jZHBhdGhfdmFsdWUnIH0sIHRydWUpO1xuXHRcdFx0Y2FwYWJpbGl0aWVzLmFkZChUZXJtaW5hbENhcGFiaWxpdHkuU2hlbGxFbnZEZXRlY3Rpb24sIHNoZWxsRW52RGV0ZWN0aW9uKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2NkIHwgc2hvdWxkIHNob3cgcGF0aHMgZnJvbSAkQ0RQQVRIIChyZWxhdGl2ZSknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZS5zZXRVc2VyQ29uZmlndXJhdGlvbigndGVybWluYWwuaW50ZWdyYXRlZC5zdWdnZXN0LmNkUGF0aCcsICdyZWxhdGl2ZScpO1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VSZXF1ZXN0Q29uZmlnOiBUZXJtaW5hbFJlc291cmNlUmVxdWVzdENvbmZpZyA9IHtcblx0XHRcdFx0Y3dkOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vdGVzdCcpLFxuXHRcdFx0XHRmb2xkZXJzUmVxdWVzdGVkOiB0cnVlLFxuXHRcdFx0XHRmaWxlc1JlcXVlc3RlZDogdHJ1ZSxcblx0XHRcdFx0cGF0aFNlcGFyYXRvclxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UucmVzb2x2ZVJlc291cmNlcyhyZXNvdXJjZVJlcXVlc3RDb25maWcsICdjZCAnLCAzLCBwcm92aWRlciwgY2FwYWJpbGl0aWVzKTtcblxuXHRcdFx0YXNzZXJ0UGFydGlhbENvbXBsZXRpb25zRXhpc3QocmVzdWx0LCBbXG5cdFx0XHRcdHsgbGFiZWw6ICdmb2xkZXIxJywgZGV0YWlsOiAnQ0RQQVRIIC9jZHBhdGhfdmFsdWUvZm9sZGVyMS8nIH0sXG5cdFx0XHRdLCB7IHJlcGxhY2VtZW50SW5kZXg6IDMsIHJlcGxhY2VtZW50TGVuZ3RoOiAwIH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnY2QgfCBzaG91bGQgc2hvdyBwYXRocyBmcm9tICRDRFBBVEggKGFic29sdXRlKScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnNldFVzZXJDb25maWd1cmF0aW9uKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnN1Z2dlc3QuY2RQYXRoJywgJ2Fic29sdXRlJyk7XG5cdFx0XHRjb25zdCByZXNvdXJjZVJlcXVlc3RDb25maWc6IFRlcm1pbmFsUmVzb3VyY2VSZXF1ZXN0Q29uZmlnID0ge1xuXHRcdFx0XHRjd2Q6IFVSSS5wYXJzZSgnZmlsZTovLy90ZXN0JyksXG5cdFx0XHRcdGZvbGRlcnNSZXF1ZXN0ZWQ6IHRydWUsXG5cdFx0XHRcdGZpbGVzUmVxdWVzdGVkOiB0cnVlLFxuXHRcdFx0XHRwYXRoU2VwYXJhdG9yXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGVybWluYWxDb21wbGV0aW9uU2VydmljZS5yZXNvbHZlUmVzb3VyY2VzKHJlc291cmNlUmVxdWVzdENvbmZpZywgJ2NkICcsIDMsIHByb3ZpZGVyLCBjYXBhYmlsaXRpZXMpO1xuXG5cdFx0XHRhc3NlcnRQYXJ0aWFsQ29tcGxldGlvbnNFeGlzdChyZXN1bHQsIFtcblx0XHRcdFx0eyBsYWJlbDogJy9jZHBhdGhfdmFsdWUvZm9sZGVyMS8nLCBkZXRhaWw6ICdDRFBBVEgnIH0sXG5cdFx0XHRdLCB7IHJlcGxhY2VtZW50SW5kZXg6IDMsIHJlcGxhY2VtZW50TGVuZ3RoOiAwIH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnY2QgfCBzaG91bGQgc3VwcG9ydCBwdWxsaW5nIGZyb20gbXVsdGlwbGUgcGF0aHMgaW4gJENEUEFUSCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnNldFVzZXJDb25maWd1cmF0aW9uKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnN1Z2dlc3QuY2RQYXRoJywgJ3JlbGF0aXZlJyk7XG5cdFx0XHRjb25zdCBwYXRoUHJlZml4ID0gaXNXaW5kb3dzID8gJ2M6XFxcXCcgOiAnLyc7XG5cdFx0XHRjb25zdCBkZWxpbWV0ZXIgPSBpc1dpbmRvd3MgPyAnOycgOiAnOic7XG5cdFx0XHRjb25zdCBzZXBhcmF0b3IgPSBpc1dpbmRvd3MgPyAnXFxcXCcgOiAnLyc7XG5cdFx0XHRzaGVsbEVudkRldGVjdGlvbi5zZXRFbnZpcm9ubWVudCh7IENEUEFUSDogYCR7cGF0aFByZWZpeH1jZHBhdGgxX3ZhbHVlJHtkZWxpbWV0ZXJ9JHtwYXRoUHJlZml4fWNkcGF0aDJfdmFsdWUke3NlcGFyYXRvcn1pbm5lcl9kaXJgIH0sIHRydWUpO1xuXG5cdFx0XHRjb25zdCB1cmlQYXRoUHJlZml4ID0gaXNXaW5kb3dzID8gJ2ZpbGU6Ly8vYzovJyA6ICdmaWxlOi8vLyc7XG5cdFx0XHR2YWxpZFJlc291cmNlcyA9IFtcblx0XHRcdFx0VVJJLnBhcnNlKGAke3VyaVBhdGhQcmVmaXh9dGVzdGApLFxuXHRcdFx0XHRVUkkucGFyc2UoYCR7dXJpUGF0aFByZWZpeH1jZHBhdGgxX3ZhbHVlYCksXG5cdFx0XHRcdFVSSS5wYXJzZShgJHt1cmlQYXRoUHJlZml4fWNkcGF0aDJfdmFsdWVgKSxcblx0XHRcdFx0VVJJLnBhcnNlKGAke3VyaVBhdGhQcmVmaXh9Y2RwYXRoMl92YWx1ZS9pbm5lcl9kaXJgKVxuXHRcdFx0XTtcblx0XHRcdGNoaWxkUmVzb3VyY2VzID0gW1xuXHRcdFx0XHR7IHJlc291cmNlOiBVUkkucGFyc2UoYCR7dXJpUGF0aFByZWZpeH1jZHBhdGgxX3ZhbHVlL2ZvbGRlcjEvYCksIGlzRGlyZWN0b3J5OiB0cnVlIH0sXG5cdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZShgJHt1cmlQYXRoUHJlZml4fWNkcGF0aDFfdmFsdWUvZm9sZGVyMi9gKSwgaXNEaXJlY3Rvcnk6IHRydWUgfSxcblx0XHRcdFx0eyByZXNvdXJjZTogVVJJLnBhcnNlKGAke3VyaVBhdGhQcmVmaXh9Y2RwYXRoMV92YWx1ZS9maWxlMS50eHRgKSwgaXNGaWxlOiB0cnVlIH0sXG5cdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZShgJHt1cmlQYXRoUHJlZml4fWNkcGF0aDJfdmFsdWUvaW5uZXJfZGlyL2ZvbGRlcjEvYCksIGlzRGlyZWN0b3J5OiB0cnVlIH0sXG5cdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZShgJHt1cmlQYXRoUHJlZml4fWNkcGF0aDJfdmFsdWUvaW5uZXJfZGlyL2ZvbGRlcjIvYCksIGlzRGlyZWN0b3J5OiB0cnVlIH0sXG5cdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5wYXJzZShgJHt1cmlQYXRoUHJlZml4fWNkcGF0aDJfdmFsdWUvaW5uZXJfZGlyL2ZpbGUxLnR4dGApLCBpc0ZpbGU6IHRydWUgfSxcblx0XHRcdF07XG5cblx0XHRcdGNvbnN0IHJlc291cmNlUmVxdWVzdENvbmZpZzogVGVybWluYWxSZXNvdXJjZVJlcXVlc3RDb25maWcgPSB7XG5cdFx0XHRcdGN3ZDogVVJJLnBhcnNlKGAke3VyaVBhdGhQcmVmaXh9dGVzdGApLFxuXHRcdFx0XHRmb2xkZXJzUmVxdWVzdGVkOiB0cnVlLFxuXHRcdFx0XHRmaWxlc1JlcXVlc3RlZDogdHJ1ZSxcblx0XHRcdFx0cGF0aFNlcGFyYXRvclxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UucmVzb2x2ZVJlc291cmNlcyhyZXNvdXJjZVJlcXVlc3RDb25maWcsICdjZCAnLCAzLCBwcm92aWRlciwgY2FwYWJpbGl0aWVzKTtcblxuXHRcdFx0Y29uc3QgZmluYWxQcmVmaXggPSBpc1dpbmRvd3MgPyAnQzpcXFxcJyA6ICcvJztcblx0XHRcdGFzc2VydFBhcnRpYWxDb21wbGV0aW9uc0V4aXN0KHJlc3VsdCwgW1xuXHRcdFx0XHR7IGxhYmVsOiAnZm9sZGVyMScsIGRldGFpbDogYENEUEFUSCAke2ZpbmFsUHJlZml4fWNkcGF0aDFfdmFsdWUvZm9sZGVyMS9gIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICdmb2xkZXIyJywgZGV0YWlsOiBgQ0RQQVRIICR7ZmluYWxQcmVmaXh9Y2RwYXRoMV92YWx1ZS9mb2xkZXIyL2AgfSxcblx0XHRcdFx0eyBsYWJlbDogJ2ZvbGRlcjEnLCBkZXRhaWw6IGBDRFBBVEggJHtmaW5hbFByZWZpeH1jZHBhdGgyX3ZhbHVlL2lubmVyX2Rpci9mb2xkZXIxL2AgfSxcblx0XHRcdFx0eyBsYWJlbDogJ2ZvbGRlcjInLCBkZXRhaWw6IGBDRFBBVEggJHtmaW5hbFByZWZpeH1jZHBhdGgyX3ZhbHVlL2lubmVyX2Rpci9mb2xkZXIyL2AgfSxcblx0XHRcdF0sIHsgcmVwbGFjZW1lbnRJbmRleDogMywgcmVwbGFjZW1lbnRMZW5ndGg6IDAgfSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLFdBQVc7QUFDcEIsU0FBUyxvQkFBd0U7QUFDakYsU0FBUyxpQ0FBZ0U7QUFDekUsU0FBUywrQ0FBK0M7QUFDeEQsT0FBTyxVQUFVLFlBQVk7QUFDN0IsU0FBUyxpQkFBMkM7QUFDcEQsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUywwQkFBMEI7QUFDbkMsU0FBOEIsa0NBQWtDO0FBQ2hFLFNBQVMsYUFBYTtBQUV0QixNQUFNLGdCQUFnQixZQUFZLE9BQU87QUFnQnpDLFNBQVMsa0JBQWtCLFFBQTJDLFVBQTBDLGdCQUE2QztBQUM1SixTQUFPO0FBQUEsSUFDTixRQUFRLElBQUksUUFBTTtBQUFBLE1BQ2pCLE9BQU8sRUFBRTtBQUFBLE1BQ1QsUUFBUSxFQUFFLFVBQVU7QUFBQSxNQUNwQixNQUFNLEVBQUUsUUFBUSwyQkFBMkI7QUFBQSxNQUMzQyxrQkFBa0IsRUFBRTtBQUFBLE1BQ3BCLG1CQUFtQixFQUFFO0FBQUEsSUFDdEIsRUFBRTtBQUFBLElBQUcsU0FBUyxJQUFJLFFBQU07QUFBQSxNQUN2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
