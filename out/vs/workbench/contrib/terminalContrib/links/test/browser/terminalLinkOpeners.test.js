import { deepStrictEqual } from "assert";
import { Schemas } from "../../../../../../base/common/network.js";
import { OperatingSystem } from "../../../../../../base/common/platform.js";
import { URI } from "../../../../../../base/common/uri.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { FileService } from "../../../../../../platform/files/common/fileService.js";
import { TestInstantiationService } from "../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { ILogService, NullLogService } from "../../../../../../platform/log/common/log.js";
import { IQuickInputService } from "../../../../../../platform/quickinput/common/quickInput.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
import { CommandDetectionCapability } from "../../../../../../platform/terminal/common/capabilities/commandDetectionCapability.js";
import { TerminalBuiltinLinkType } from "../../browser/links.js";
import { TerminalLocalFileLinkOpener, TerminalLocalFolderInWorkspaceLinkOpener, TerminalSearchLinkOpener } from "../../browser/terminalLinkOpeners.js";
import { TerminalCapability } from "../../../../../../platform/terminal/common/capabilities/capabilities.js";
import { TerminalCapabilityStore } from "../../../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../../../services/environment/common/environmentService.js";
import { TestContextService } from "../../../../../test/common/workbenchTestServices.js";
import { ISearchService } from "../../../../../services/search/common/search.js";
import { SearchService } from "../../../../../services/search/common/searchService.js";
import { ITerminalLogService } from "../../../../../../platform/terminal/common/terminal.js";
import { importAMDNodeModule } from "../../../../../../amdX.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { TerminalCommand } from "../../../../../../platform/terminal/common/capabilities/commandDetection/terminalCommand.js";
class TestCommandDetectionCapability extends CommandDetectionCapability {
  setCommands(commands) {
    this._commands = commands;
  }
}
class TestFileService extends FileService {
  constructor() {
    super(...arguments);
    this._files = "*";
  }
  async stat(resource) {
    if (this._files === "*" || this._files.some((e) => e.toString() === resource.toString())) {
      return { isFile: true, isDirectory: false, isSymbolicLink: false };
    }
    throw new Error("ENOENT");
  }
  setFiles(files) {
    this._files = files;
  }
}
class TestSearchService extends SearchService {
  async fileSearch(query) {
    return this._searchResult;
  }
  setSearchResult(result) {
    this._searchResult = result;
  }
}
class TestTerminalSearchLinkOpener extends TerminalSearchLinkOpener {
  setFileQueryBuilder(value) {
    this._fileQueryBuilder = value;
  }
}
suite("Workbench - TerminalLinkOpeners", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let instantiationService;
  let fileService;
  let searchService;
  let activationResult;
  let xterm;
  setup(async () => {
    instantiationService = store.add(new TestInstantiationService());
    fileService = store.add(new TestFileService(new NullLogService()));
    searchService = store.add(new TestSearchService(null, null, null, null, null, null, null));
    instantiationService.set(IFileService, fileService);
    instantiationService.set(ILogService, new NullLogService());
    instantiationService.set(ISearchService, searchService);
    instantiationService.set(IWorkspaceContextService, new TestContextService());
    instantiationService.stub(ITerminalLogService, new NullLogService());
    instantiationService.stub(IWorkbenchEnvironmentService, {
      remoteAuthority: void 0
    });
    activationResult = void 0;
    instantiationService.stub(IQuickInputService, {
      quickAccess: {
        show(link) {
          activationResult = { link, source: "search" };
        }
      }
    });
    instantiationService.stub(IEditorService, {
      async openEditor(editor) {
        activationResult = {
          source: "editor",
          link: editor.resource?.toString()
        };
        if (editor.options?.selection && (editor.options.selection.startColumn !== 1 || editor.options.selection.startLineNumber !== 1)) {
          activationResult.selection = editor.options.selection;
        }
      }
    });
    const TerminalCtor = (await importAMDNodeModule("@xterm/xterm", "lib/xterm.js")).Terminal;
    xterm = store.add(new TerminalCtor({ allowProposedApi: true }));
  });
  suite("TerminalSearchLinkOpener", () => {
    let opener;
    let capabilities;
    let commandDetection;
    let localFileOpener;
    setup(() => {
      capabilities = store.add(new TerminalCapabilityStore());
      commandDetection = store.add(instantiationService.createInstance(TestCommandDetectionCapability, xterm));
      capabilities.add(TerminalCapability.CommandDetection, commandDetection);
    });
    test("should open single exact match against cwd when searching if it exists when command detection cwd is available", async () => {
      localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
      const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
      opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "/initial/cwd", localFileOpener, localFolderOpener, () => OperatingSystem.Linux);
      commandDetection.setCommands([new TerminalCommand(xterm, {
        command: "",
        commandLineConfidence: "low",
        exitCode: 0,
        commandStartLineContent: "",
        markProperties: {},
        isTrusted: true,
        cwd: "/initial/cwd",
        timestamp: 0,
        duration: 0,
        executedX: void 0,
        startX: void 0,
        marker: {
          line: 0
        }
      })]);
      fileService.setFiles([
        URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo/bar.txt" }),
        URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo2/bar.txt" })
      ]);
      await opener.open({
        text: "foo/bar.txt",
        bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
        type: TerminalBuiltinLinkType.Search
      });
      deepStrictEqual(activationResult, {
        link: "file:///initial/cwd/foo/bar.txt",
        source: "editor"
      });
    });
    test("should open single exact match against cwd for paths containing a separator when searching if it exists, even when command detection isn't available", async () => {
      localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
      const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
      opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "/initial/cwd", localFileOpener, localFolderOpener, () => OperatingSystem.Linux);
      fileService.setFiles([
        URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo/bar.txt" }),
        URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo2/bar.txt" })
      ]);
      await opener.open({
        text: "foo/bar.txt",
        bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
        type: TerminalBuiltinLinkType.Search
      });
      deepStrictEqual(activationResult, {
        link: "file:///initial/cwd/foo/bar.txt",
        source: "editor"
      });
    });
    test("should open single exact match against any folder for paths not containing a separator when there is a single search result, even when command detection isn't available", async () => {
      localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
      const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
      opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "/initial/cwd", localFileOpener, localFolderOpener, () => OperatingSystem.Linux);
      capabilities.remove(TerminalCapability.CommandDetection);
      opener.setFileQueryBuilder({ file: () => null });
      fileService.setFiles([
        URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo/bar.txt" }),
        URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo2/baz.txt" })
      ]);
      searchService.setSearchResult({
        messages: [],
        results: [
          { resource: URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo/bar.txt" }) }
        ]
      });
      await opener.open({
        text: "bar.txt",
        bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
        type: TerminalBuiltinLinkType.Search
      });
      deepStrictEqual(activationResult, {
        link: "file:///initial/cwd/foo/bar.txt",
        source: "editor"
      });
    });
    test("should open single exact match against any folder for paths not containing a separator when there are multiple search results, even when command detection isn't available", async () => {
      localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
      const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
      opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "/initial/cwd", localFileOpener, localFolderOpener, () => OperatingSystem.Linux);
      capabilities.remove(TerminalCapability.CommandDetection);
      opener.setFileQueryBuilder({ file: () => null });
      fileService.setFiles([
        URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo/bar.txt" }),
        URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo/bar.test.txt" }),
        URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo2/bar.test.txt" })
      ]);
      searchService.setSearchResult({
        messages: [],
        results: [
          { resource: URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo/bar.txt" }) },
          { resource: URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo/bar.test.txt" }) },
          { resource: URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo2/bar.test.txt" }) }
        ]
      });
      await opener.open({
        text: "bar.txt",
        bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
        type: TerminalBuiltinLinkType.Search
      });
      deepStrictEqual(activationResult, {
        link: "file:///initial/cwd/foo/bar.txt",
        source: "editor"
      });
    });
    test("should not open single exact match for paths not containing a when command detection isn't available", async () => {
      localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
      const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
      opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "/initial/cwd", localFileOpener, localFolderOpener, () => OperatingSystem.Linux);
      fileService.setFiles([
        URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo/bar.txt" }),
        URI.from({ scheme: Schemas.file, path: "/initial/cwd/foo2/bar.txt" })
      ]);
      await opener.open({
        text: "bar.txt",
        bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
        type: TerminalBuiltinLinkType.Search
      });
      deepStrictEqual(activationResult, {
        link: "bar.txt",
        source: "search"
      });
    });
    suite("macOS/Linux", () => {
      setup(() => {
        localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
        const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
        opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "", localFileOpener, localFolderOpener, () => OperatingSystem.Linux);
      });
      test("should apply the cwd to the link only when the file exists and cwdDetection is enabled", async () => {
        const cwd = "/Users/home/folder";
        const absoluteFile = "/Users/home/folder/file.txt";
        fileService.setFiles([
          URI.from({ scheme: Schemas.file, path: absoluteFile }),
          URI.from({ scheme: Schemas.file, path: "/Users/home/folder/other/file.txt" })
        ]);
        commandDetection.setCommands([new TerminalCommand(xterm, {
          command: "",
          commandLineConfidence: "low",
          isTrusted: true,
          cwd,
          timestamp: 0,
          duration: 0,
          executedX: void 0,
          startX: void 0,
          marker: {
            line: 0
          },
          exitCode: 0,
          commandStartLineContent: "",
          markProperties: {}
        })]);
        await opener.open({
          text: "file.txt",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///Users/home/folder/file.txt",
          source: "editor"
        });
        commandDetection.setCommands([]);
        opener.setFileQueryBuilder({ file: () => null });
        searchService.setSearchResult({
          messages: [],
          results: [
            { resource: URI.from({ scheme: Schemas.file, path: "file:///Users/home/folder/file.txt" }) },
            { resource: URI.from({ scheme: Schemas.file, path: "file:///Users/home/folder/other/file.txt" }) }
          ]
        });
        await opener.open({
          text: "file.txt",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file.txt",
          source: "search"
        });
      });
      test("should extract column and/or line numbers from links in a workspace containing spaces", async () => {
        localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
        const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
        opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "/space folder", localFileOpener, localFolderOpener, () => OperatingSystem.Linux);
        fileService.setFiles([
          URI.from({ scheme: Schemas.file, path: "/space folder/foo/bar.txt" })
        ]);
        await opener.open({
          text: "./foo/bar.txt:10:5",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///space%20folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 5,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: "./foo/bar.txt:10",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///space%20folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 1,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
      });
      test("should extract column and/or line numbers from links and remove trailing periods", async () => {
        localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
        const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
        opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "/folder", localFileOpener, localFolderOpener, () => OperatingSystem.Linux);
        fileService.setFiles([
          URI.from({ scheme: Schemas.file, path: "/folder/foo/bar.txt" })
        ]);
        await opener.open({
          text: "./foo/bar.txt.",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///folder/foo/bar.txt",
          source: "editor"
        });
        await opener.open({
          text: "./foo/bar.txt:10:5.",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 5,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: "./foo/bar.txt:10.",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 1,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
      });
      test("should extract column and/or line numbers from links and remove grepped lines", async () => {
        localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
        const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
        opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "/folder", localFileOpener, localFolderOpener, () => OperatingSystem.Linux);
        fileService.setFiles([
          URI.from({ scheme: Schemas.file, path: "/folder/foo/bar.txt" })
        ]);
        await opener.open({
          text: "./foo/bar.txt:10:5:import { ILoveVSCode } from './foo/bar.ts';",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 5,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: "./foo/bar.txt:10:import { ILoveVSCode } from './foo/bar.ts';",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 1,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
      });
      test("should extract column and/or line numbers from links and remove grepped lines incl singular spaces", async () => {
        localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
        const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
        opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "/folder", localFileOpener, localFolderOpener, () => OperatingSystem.Linux);
        fileService.setFiles([
          URI.from({ scheme: Schemas.file, path: "/folder/foo/bar.txt" })
        ]);
        await opener.open({
          text: "./foo/bar.txt:10:5: ",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 5,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: "./foo/bar.txt:10: ",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 1,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
      });
      test("should extract line numbers from links and remove ruby stack traces", async () => {
        localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
        const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
        opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "/folder", localFileOpener, localFolderOpener, () => OperatingSystem.Linux);
        fileService.setFiles([
          URI.from({ scheme: Schemas.file, path: "/folder/foo/bar.rb" })
        ]);
        await opener.open({
          text: "./foo/bar.rb:30:in `<main>`",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///folder/foo/bar.rb",
          source: "editor",
          selection: {
            startColumn: 1,
            startLineNumber: 30,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
      });
    });
    suite("Windows", () => {
      setup(() => {
        localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
        const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
        opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "", localFileOpener, localFolderOpener, () => OperatingSystem.Windows);
      });
      test("should apply the cwd to the link only when the file exists and cwdDetection is enabled", async () => {
        localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
        const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
        opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "c:\\Users", localFileOpener, localFolderOpener, () => OperatingSystem.Windows);
        const cwd = "c:\\Users\\home\\folder";
        const absoluteFile = "c:\\Users\\home\\folder\\file.txt";
        fileService.setFiles([
          URI.file("/c:/Users/home/folder/file.txt")
        ]);
        commandDetection.setCommands([new TerminalCommand(xterm, {
          exitCode: 0,
          commandStartLineContent: "",
          markProperties: {},
          command: "",
          commandLineConfidence: "low",
          isTrusted: true,
          cwd,
          executedX: void 0,
          startX: void 0,
          timestamp: 0,
          duration: 0,
          marker: {
            line: 0
          }
        })]);
        await opener.open({
          text: "file.txt",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/Users/home/folder/file.txt",
          source: "editor"
        });
        commandDetection.setCommands([]);
        opener.setFileQueryBuilder({ file: () => null });
        searchService.setSearchResult({
          messages: [],
          results: [
            { resource: URI.file(absoluteFile) },
            { resource: URI.file("/c:/Users/home/folder/other/file.txt") }
          ]
        });
        await opener.open({
          text: "file.txt",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file.txt",
          source: "search"
        });
      });
      test("should extract column and/or line numbers from links in a workspace containing spaces", async () => {
        localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
        const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
        opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "c:/space folder", localFileOpener, localFolderOpener, () => OperatingSystem.Windows);
        fileService.setFiles([
          URI.from({ scheme: Schemas.file, path: "c:/space folder/foo/bar.txt" })
        ]);
        await opener.open({
          text: "./foo/bar.txt:10:5",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/space%20folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 5,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: "./foo/bar.txt:10",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/space%20folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 1,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: ".\\foo\\bar.txt:10:5",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/space%20folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 5,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: ".\\foo\\bar.txt:10",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/space%20folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 1,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
      });
      test("should extract column and/or line numbers from links and remove trailing periods", async () => {
        localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
        const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
        opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "c:/folder", localFileOpener, localFolderOpener, () => OperatingSystem.Windows);
        fileService.setFiles([
          URI.from({ scheme: Schemas.file, path: "c:/folder/foo/bar.txt" })
        ]);
        await opener.open({
          text: "./foo/bar.txt.",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.txt",
          source: "editor"
        });
        await opener.open({
          text: "./foo/bar.txt:10:5.",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 5,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: "./foo/bar.txt:10.",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 1,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: ".\\foo\\bar.txt.",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.txt",
          source: "editor"
        });
        await opener.open({
          text: ".\\foo\\bar.txt:2:5.",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 5,
            startLineNumber: 2,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: ".\\foo\\bar.txt:2.",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 1,
            startLineNumber: 2,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
      });
      test("should extract column and/or line numbers from links and remove grepped lines", async () => {
        localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
        const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
        opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "c:/folder", localFileOpener, localFolderOpener, () => OperatingSystem.Windows);
        fileService.setFiles([
          URI.from({ scheme: Schemas.file, path: "c:/folder/foo/bar.txt" })
        ]);
        await opener.open({
          text: "./foo/bar.txt:10:5:import { ILoveVSCode } from './foo/bar.ts';",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 5,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: "./foo/bar.txt:10:import { ILoveVSCode } from './foo/bar.ts';",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 1,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: ".\\foo\\bar.txt:10:5:import { ILoveVSCode } from './foo/bar.ts';",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 5,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: ".\\foo\\bar.txt:10:import { ILoveVSCode } from './foo/bar.ts';",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 1,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
      });
      test("should extract column and/or line numbers from links and remove grepped lines incl singular spaces", async () => {
        localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
        const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
        opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "c:/folder", localFileOpener, localFolderOpener, () => OperatingSystem.Windows);
        fileService.setFiles([
          URI.from({ scheme: Schemas.file, path: "c:/folder/foo/bar.txt" })
        ]);
        await opener.open({
          text: "./foo/bar.txt:10:5: ",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 5,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: "./foo/bar.txt:10: ",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 1,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: ".\\foo\\bar.txt:10:5: ",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 5,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: ".\\foo\\bar.txt:10: ",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.txt",
          source: "editor",
          selection: {
            startColumn: 1,
            startLineNumber: 10,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
      });
      test("should extract line numbers from links and remove ruby stack traces", async () => {
        localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
        const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
        opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, "c:/folder", localFileOpener, localFolderOpener, () => OperatingSystem.Windows);
        fileService.setFiles([
          URI.from({ scheme: Schemas.file, path: "c:/folder/foo/bar.rb" })
        ]);
        await opener.open({
          text: "./foo/bar.rb:30:in `<main>`",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.rb",
          source: "editor",
          selection: {
            startColumn: 1,
            // Since Ruby doesn't appear to put columns in stack traces, this should be 1
            startLineNumber: 30,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
        await opener.open({
          text: ".\\foo\\bar.rb:30:in `<main>`",
          bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
          type: TerminalBuiltinLinkType.Search
        });
        deepStrictEqual(activationResult, {
          link: "file:///c%3A/folder/foo/bar.rb",
          source: "editor",
          selection: {
            startColumn: 1,
            // Since Ruby doesn't appear to put columns in stack traces, this should be 1
            startLineNumber: 30,
            endColumn: void 0,
            endLineNumber: void 0
          }
        });
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvdGVzdC9icm93c2VyL3Rlcm1pbmFsTGlua09wZW5lcnMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGRlZXBTdHJpY3RFcXVhbCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBPcGVyYXRpbmdTeXN0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVRleHRFZGl0b3JTZWxlY3Rpb24sIElUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSwgSUZpbGVTdGF0V2l0aFBhcnRpYWxNZXRhZGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IENvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvbGlua3MuanMnO1xuaW1wb3J0IHsgVGVybWluYWxMb2NhbEZpbGVMaW5rT3BlbmVyLCBUZXJtaW5hbExvY2FsRm9sZGVySW5Xb3Jrc3BhY2VMaW5rT3BlbmVyLCBUZXJtaW5hbFNlYXJjaExpbmtPcGVuZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL3Rlcm1pbmFsTGlua09wZW5lcnMuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDYXBhYmlsaXR5LCBJWHRlcm1NYXJrZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvdGVybWluYWxDYXBhYmlsaXR5U3RvcmUuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdENvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB0eXBlIHsgVGVybWluYWwgfSBmcm9tICdAeHRlcm0veHRlcm0nO1xuaW1wb3J0IHsgSUZpbGVRdWVyeSwgSVNlYXJjaENvbXBsZXRlLCBJU2VhcmNoU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vc2VhcmNoLmpzJztcbmltcG9ydCB7IFNlYXJjaFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9zZXJ2aWNlcy9zZWFyY2gvY29tbW9uL3NlYXJjaFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBpbXBvcnRBTUROb2RlTW9kdWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYW1kWC5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsQ29tbWFuZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvY29tbWFuZERldGVjdGlvbi90ZXJtaW5hbENvbW1hbmQuanMnO1xuXG5pbnRlcmZhY2UgSVRlcm1pbmFsTGlua0FjdGl2YXRpb25SZXN1bHQge1xuXHRzb3VyY2U6ICdlZGl0b3InIHwgJ3NlYXJjaCc7XG5cdGxpbms6IHN0cmluZztcblx0c2VsZWN0aW9uPzogSVRleHRFZGl0b3JTZWxlY3Rpb247XG59XG5cbmNsYXNzIFRlc3RDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSBleHRlbmRzIENvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5IHtcblx0c2V0Q29tbWFuZHMoY29tbWFuZHM6IFRlcm1pbmFsQ29tbWFuZFtdKSB7XG5cdFx0dGhpcy5fY29tbWFuZHMgPSBjb21tYW5kcztcblx0fVxufVxuXG5jbGFzcyBUZXN0RmlsZVNlcnZpY2UgZXh0ZW5kcyBGaWxlU2VydmljZSB7XG5cdHByaXZhdGUgX2ZpbGVzOiBVUklbXSB8ICcqJyA9ICcqJztcblx0b3ZlcnJpZGUgYXN5bmMgc3RhdChyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoUGFydGlhbE1ldGFkYXRhPiB7XG5cdFx0aWYgKHRoaXMuX2ZpbGVzID09PSAnKicgfHwgdGhpcy5fZmlsZXMuc29tZShlID0+IGUudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UudG9TdHJpbmcoKSkpIHtcblx0XHRcdHJldHVybiB7IGlzRmlsZTogdHJ1ZSwgaXNEaXJlY3Rvcnk6IGZhbHNlLCBpc1N5bWJvbGljTGluazogZmFsc2UgfSBhcyBJRmlsZVN0YXRXaXRoUGFydGlhbE1ldGFkYXRhO1xuXHRcdH1cblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0VOT0VOVCcpO1xuXHR9XG5cdHNldEZpbGVzKGZpbGVzOiBVUklbXSB8ICcqJyk6IHZvaWQge1xuXHRcdHRoaXMuX2ZpbGVzID0gZmlsZXM7XG5cdH1cbn1cblxuY2xhc3MgVGVzdFNlYXJjaFNlcnZpY2UgZXh0ZW5kcyBTZWFyY2hTZXJ2aWNlIHtcblx0cHJpdmF0ZSBfc2VhcmNoUmVzdWx0OiBJU2VhcmNoQ29tcGxldGUgfCB1bmRlZmluZWQ7XG5cdG92ZXJyaWRlIGFzeW5jIGZpbGVTZWFyY2gocXVlcnk6IElGaWxlUXVlcnkpOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT4ge1xuXHRcdHJldHVybiB0aGlzLl9zZWFyY2hSZXN1bHQhO1xuXHR9XG5cdHNldFNlYXJjaFJlc3VsdChyZXN1bHQ6IElTZWFyY2hDb21wbGV0ZSkge1xuXHRcdHRoaXMuX3NlYXJjaFJlc3VsdCA9IHJlc3VsdDtcblx0fVxufVxuXG5jbGFzcyBUZXN0VGVybWluYWxTZWFyY2hMaW5rT3BlbmVyIGV4dGVuZHMgVGVybWluYWxTZWFyY2hMaW5rT3BlbmVyIHtcblx0c2V0RmlsZVF1ZXJ5QnVpbGRlcih2YWx1ZTogYW55KSB7XG5cdFx0dGhpcy5fZmlsZVF1ZXJ5QnVpbGRlciA9IHZhbHVlO1xuXHR9XG59XG5cbnN1aXRlKCdXb3JrYmVuY2ggLSBUZXJtaW5hbExpbmtPcGVuZXJzJywgKCkgPT4ge1xuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgZmlsZVNlcnZpY2U6IFRlc3RGaWxlU2VydmljZTtcblx0bGV0IHNlYXJjaFNlcnZpY2U6IFRlc3RTZWFyY2hTZXJ2aWNlO1xuXHRsZXQgYWN0aXZhdGlvblJlc3VsdDogSVRlcm1pbmFsTGlua0FjdGl2YXRpb25SZXN1bHQgfCB1bmRlZmluZWQ7XG5cdGxldCB4dGVybTogVGVybWluYWw7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKSk7XG5cdFx0ZmlsZVNlcnZpY2UgPSBzdG9yZS5hZGQobmV3IFRlc3RGaWxlU2VydmljZShuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHRcdHNlYXJjaFNlcnZpY2UgPSBzdG9yZS5hZGQobmV3IFRlc3RTZWFyY2hTZXJ2aWNlKG51bGwhLCBudWxsISwgbnVsbCEsIG51bGwhLCBudWxsISwgbnVsbCEsIG51bGwhKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc2V0KElGaWxlU2VydmljZSwgZmlsZVNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJTG9nU2VydmljZSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJU2VhcmNoU2VydmljZSwgc2VhcmNoU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc2V0KElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgbmV3IFRlc3RDb250ZXh0U2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZXJtaW5hbExvZ1NlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsIHtcblx0XHRcdHJlbW90ZUF1dGhvcml0eTogdW5kZWZpbmVkXG5cdFx0fSBhcyBQYXJ0aWFsPElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2U+KTtcblx0XHQvLyBBbGxvdyBpbnRlcmNlcHRpbmcgbGluayBhY3RpdmF0aW9uc1xuXHRcdGFjdGl2YXRpb25SZXN1bHQgPSB1bmRlZmluZWQ7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJUXVpY2tJbnB1dFNlcnZpY2UsIHtcblx0XHRcdHF1aWNrQWNjZXNzOiB7XG5cdFx0XHRcdHNob3cobGluazogc3RyaW5nKSB7XG5cdFx0XHRcdFx0YWN0aXZhdGlvblJlc3VsdCA9IHsgbGluaywgc291cmNlOiAnc2VhcmNoJyB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBhcyBQYXJ0aWFsPElRdWlja0lucHV0U2VydmljZT4pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvclNlcnZpY2UsIHtcblx0XHRcdGFzeW5jIG9wZW5FZGl0b3IoZWRpdG9yOiBJVGV4dFJlc291cmNlRWRpdG9ySW5wdXQpOiBQcm9taXNlPGFueT4ge1xuXHRcdFx0XHRhY3RpdmF0aW9uUmVzdWx0ID0ge1xuXHRcdFx0XHRcdHNvdXJjZTogJ2VkaXRvcicsXG5cdFx0XHRcdFx0bGluazogZWRpdG9yLnJlc291cmNlPy50b1N0cmluZygpXG5cdFx0XHRcdH07XG5cdFx0XHRcdC8vIE9ubHkgYXNzZXJ0IG9uIHNlbGVjdGlvbiBpZiBpdCdzIG5vdCB0aGUgZGVmYXVsdCB2YWx1ZVxuXHRcdFx0XHRpZiAoZWRpdG9yLm9wdGlvbnM/LnNlbGVjdGlvbiAmJiAoZWRpdG9yLm9wdGlvbnMuc2VsZWN0aW9uLnN0YXJ0Q29sdW1uICE9PSAxIHx8IGVkaXRvci5vcHRpb25zLnNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIgIT09IDEpKSB7XG5cdFx0XHRcdFx0YWN0aXZhdGlvblJlc3VsdC5zZWxlY3Rpb24gPSBlZGl0b3Iub3B0aW9ucy5zZWxlY3Rpb247XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGFzIFBhcnRpYWw8SUVkaXRvclNlcnZpY2U+KTtcblx0XHRjb25zdCBUZXJtaW5hbEN0b3IgPSAoYXdhaXQgaW1wb3J0QU1ETm9kZU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAeHRlcm0veHRlcm0nKT4oJ0B4dGVybS94dGVybScsICdsaWIveHRlcm0uanMnKSkuVGVybWluYWw7XG5cdFx0eHRlcm0gPSBzdG9yZS5hZGQobmV3IFRlcm1pbmFsQ3Rvcih7IGFsbG93UHJvcG9zZWRBcGk6IHRydWUgfSkpO1xuXHR9KTtcblxuXHRzdWl0ZSgnVGVybWluYWxTZWFyY2hMaW5rT3BlbmVyJywgKCkgPT4ge1xuXHRcdGxldCBvcGVuZXI6IFRlc3RUZXJtaW5hbFNlYXJjaExpbmtPcGVuZXI7XG5cdFx0bGV0IGNhcGFiaWxpdGllczogVGVybWluYWxDYXBhYmlsaXR5U3RvcmU7XG5cdFx0bGV0IGNvbW1hbmREZXRlY3Rpb246IFRlc3RDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eTtcblx0XHRsZXQgbG9jYWxGaWxlT3BlbmVyOiBUZXJtaW5hbExvY2FsRmlsZUxpbmtPcGVuZXI7XG5cblx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRjYXBhYmlsaXRpZXMgPSBzdG9yZS5hZGQobmV3IFRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlKCkpO1xuXHRcdFx0Y29tbWFuZERldGVjdGlvbiA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0Q29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHksIHh0ZXJtKSk7XG5cdFx0XHRjYXBhYmlsaXRpZXMuYWRkKFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uLCBjb21tYW5kRGV0ZWN0aW9uKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBvcGVuIHNpbmdsZSBleGFjdCBtYXRjaCBhZ2FpbnN0IGN3ZCB3aGVuIHNlYXJjaGluZyBpZiBpdCBleGlzdHMgd2hlbiBjb21tYW5kIGRldGVjdGlvbiBjd2QgaXMgYXZhaWxhYmxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0bG9jYWxGaWxlT3BlbmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZpbGVMaW5rT3BlbmVyKTtcblx0XHRcdGNvbnN0IGxvY2FsRm9sZGVyT3BlbmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZvbGRlckluV29ya3NwYWNlTGlua09wZW5lcik7XG5cdFx0XHRvcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VGVybWluYWxTZWFyY2hMaW5rT3BlbmVyLCBjYXBhYmlsaXRpZXMsICcvaW5pdGlhbC9jd2QnLCBsb2NhbEZpbGVPcGVuZXIsIGxvY2FsRm9sZGVyT3BlbmVyLCAoKSA9PiBPcGVyYXRpbmdTeXN0ZW0uTGludXgpO1xuXHRcdFx0Ly8gU2V0IGEgZmFrZSBkZXRlY3RlZCBjb21tYW5kIHN0YXJ0aW5nIGFzIGxpbmUgMCB0byBlc3RhYmxpc2ggdGhlIGN3ZFxuXHRcdFx0Y29tbWFuZERldGVjdGlvbi5zZXRDb21tYW5kcyhbbmV3IFRlcm1pbmFsQ29tbWFuZCh4dGVybSwge1xuXHRcdFx0XHRjb21tYW5kOiAnJyxcblx0XHRcdFx0Y29tbWFuZExpbmVDb25maWRlbmNlOiAnbG93Jyxcblx0XHRcdFx0ZXhpdENvZGU6IDAsXG5cdFx0XHRcdGNvbW1hbmRTdGFydExpbmVDb250ZW50OiAnJyxcblx0XHRcdFx0bWFya1Byb3BlcnRpZXM6IHt9LFxuXHRcdFx0XHRpc1RydXN0ZWQ6IHRydWUsXG5cdFx0XHRcdGN3ZDogJy9pbml0aWFsL2N3ZCcsXG5cdFx0XHRcdHRpbWVzdGFtcDogMCxcblx0XHRcdFx0ZHVyYXRpb246IDAsXG5cdFx0XHRcdGV4ZWN1dGVkWDogdW5kZWZpbmVkLFxuXHRcdFx0XHRzdGFydFg6IHVuZGVmaW5lZCxcblx0XHRcdFx0bWFya2VyOiB7XG5cdFx0XHRcdFx0bGluZTogMFxuXHRcdFx0XHR9IGFzIFBhcnRpYWw8SVh0ZXJtTWFya2VyPiBhcyBhbnksXG5cdFx0XHR9KV0pO1xuXHRcdFx0ZmlsZVNlcnZpY2Uuc2V0RmlsZXMoW1xuXHRcdFx0XHRVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBwYXRoOiAnL2luaXRpYWwvY3dkL2Zvby9iYXIudHh0JyB9KSxcblx0XHRcdFx0VVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMuZmlsZSwgcGF0aDogJy9pbml0aWFsL2N3ZC9mb28yL2Jhci50eHQnIH0pXG5cdFx0XHRdKTtcblx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0dGV4dDogJ2Zvby9iYXIudHh0Jyxcblx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0fSk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRsaW5rOiAnZmlsZTovLy9pbml0aWFsL2N3ZC9mb28vYmFyLnR4dCcsXG5cdFx0XHRcdHNvdXJjZTogJ2VkaXRvcidcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIG9wZW4gc2luZ2xlIGV4YWN0IG1hdGNoIGFnYWluc3QgY3dkIGZvciBwYXRocyBjb250YWluaW5nIGEgc2VwYXJhdG9yIHdoZW4gc2VhcmNoaW5nIGlmIGl0IGV4aXN0cywgZXZlbiB3aGVuIGNvbW1hbmQgZGV0ZWN0aW9uIGlzblxcJ3QgYXZhaWxhYmxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0bG9jYWxGaWxlT3BlbmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZpbGVMaW5rT3BlbmVyKTtcblx0XHRcdGNvbnN0IGxvY2FsRm9sZGVyT3BlbmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZvbGRlckluV29ya3NwYWNlTGlua09wZW5lcik7XG5cdFx0XHRvcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VGVybWluYWxTZWFyY2hMaW5rT3BlbmVyLCBjYXBhYmlsaXRpZXMsICcvaW5pdGlhbC9jd2QnLCBsb2NhbEZpbGVPcGVuZXIsIGxvY2FsRm9sZGVyT3BlbmVyLCAoKSA9PiBPcGVyYXRpbmdTeXN0ZW0uTGludXgpO1xuXHRcdFx0ZmlsZVNlcnZpY2Uuc2V0RmlsZXMoW1xuXHRcdFx0XHRVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBwYXRoOiAnL2luaXRpYWwvY3dkL2Zvby9iYXIudHh0JyB9KSxcblx0XHRcdFx0VVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMuZmlsZSwgcGF0aDogJy9pbml0aWFsL2N3ZC9mb28yL2Jhci50eHQnIH0pXG5cdFx0XHRdKTtcblx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0dGV4dDogJ2Zvby9iYXIudHh0Jyxcblx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0fSk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRsaW5rOiAnZmlsZTovLy9pbml0aWFsL2N3ZC9mb28vYmFyLnR4dCcsXG5cdFx0XHRcdHNvdXJjZTogJ2VkaXRvcidcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIG9wZW4gc2luZ2xlIGV4YWN0IG1hdGNoIGFnYWluc3QgYW55IGZvbGRlciBmb3IgcGF0aHMgbm90IGNvbnRhaW5pbmcgYSBzZXBhcmF0b3Igd2hlbiB0aGVyZSBpcyBhIHNpbmdsZSBzZWFyY2ggcmVzdWx0LCBldmVuIHdoZW4gY29tbWFuZCBkZXRlY3Rpb24gaXNuXFwndCBhdmFpbGFibGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRsb2NhbEZpbGVPcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvY2FsRmlsZUxpbmtPcGVuZXIpO1xuXHRcdFx0Y29uc3QgbG9jYWxGb2xkZXJPcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvY2FsRm9sZGVySW5Xb3Jrc3BhY2VMaW5rT3BlbmVyKTtcblx0XHRcdG9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RUZXJtaW5hbFNlYXJjaExpbmtPcGVuZXIsIGNhcGFiaWxpdGllcywgJy9pbml0aWFsL2N3ZCcsIGxvY2FsRmlsZU9wZW5lciwgbG9jYWxGb2xkZXJPcGVuZXIsICgpID0+IE9wZXJhdGluZ1N5c3RlbS5MaW51eCk7XG5cdFx0XHRjYXBhYmlsaXRpZXMucmVtb3ZlKFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKTtcblx0XHRcdG9wZW5lci5zZXRGaWxlUXVlcnlCdWlsZGVyKHsgZmlsZTogKCkgPT4gbnVsbCEgfSk7XG5cdFx0XHRmaWxlU2VydmljZS5zZXRGaWxlcyhbXG5cdFx0XHRcdFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6ICcvaW5pdGlhbC9jd2QvZm9vL2Jhci50eHQnIH0pLFxuXHRcdFx0XHRVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBwYXRoOiAnL2luaXRpYWwvY3dkL2ZvbzIvYmF6LnR4dCcgfSlcblx0XHRcdF0pO1xuXHRcdFx0c2VhcmNoU2VydmljZS5zZXRTZWFyY2hSZXN1bHQoe1xuXHRcdFx0XHRtZXNzYWdlczogW10sXG5cdFx0XHRcdHJlc3VsdHM6IFtcblx0XHRcdFx0XHR7IHJlc291cmNlOiBVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBwYXRoOiAnL2luaXRpYWwvY3dkL2Zvby9iYXIudHh0JyB9KSB9XG5cdFx0XHRcdF1cblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgb3BlbmVyLm9wZW4oe1xuXHRcdFx0XHR0ZXh0OiAnYmFyLnR4dCcsXG5cdFx0XHRcdGJ1ZmZlclJhbmdlOiB7IHN0YXJ0OiB7IHg6IDEsIHk6IDEgfSwgZW5kOiB7IHg6IDgsIHk6IDEgfSB9LFxuXHRcdFx0XHR0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5TZWFyY2hcblx0XHRcdH0pO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKGFjdGl2YXRpb25SZXN1bHQsIHtcblx0XHRcdFx0bGluazogJ2ZpbGU6Ly8vaW5pdGlhbC9jd2QvZm9vL2Jhci50eHQnLFxuXHRcdFx0XHRzb3VyY2U6ICdlZGl0b3InXG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBvcGVuIHNpbmdsZSBleGFjdCBtYXRjaCBhZ2FpbnN0IGFueSBmb2xkZXIgZm9yIHBhdGhzIG5vdCBjb250YWluaW5nIGEgc2VwYXJhdG9yIHdoZW4gdGhlcmUgYXJlIG11bHRpcGxlIHNlYXJjaCByZXN1bHRzLCBldmVuIHdoZW4gY29tbWFuZCBkZXRlY3Rpb24gaXNuXFwndCBhdmFpbGFibGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRsb2NhbEZpbGVPcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvY2FsRmlsZUxpbmtPcGVuZXIpO1xuXHRcdFx0Y29uc3QgbG9jYWxGb2xkZXJPcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvY2FsRm9sZGVySW5Xb3Jrc3BhY2VMaW5rT3BlbmVyKTtcblx0XHRcdG9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RUZXJtaW5hbFNlYXJjaExpbmtPcGVuZXIsIGNhcGFiaWxpdGllcywgJy9pbml0aWFsL2N3ZCcsIGxvY2FsRmlsZU9wZW5lciwgbG9jYWxGb2xkZXJPcGVuZXIsICgpID0+IE9wZXJhdGluZ1N5c3RlbS5MaW51eCk7XG5cdFx0XHRjYXBhYmlsaXRpZXMucmVtb3ZlKFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKTtcblx0XHRcdG9wZW5lci5zZXRGaWxlUXVlcnlCdWlsZGVyKHsgZmlsZTogKCkgPT4gbnVsbCEgfSk7XG5cdFx0XHRmaWxlU2VydmljZS5zZXRGaWxlcyhbXG5cdFx0XHRcdFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6ICcvaW5pdGlhbC9jd2QvZm9vL2Jhci50eHQnIH0pLFxuXHRcdFx0XHRVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBwYXRoOiAnL2luaXRpYWwvY3dkL2Zvby9iYXIudGVzdC50eHQnIH0pLFxuXHRcdFx0XHRVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBwYXRoOiAnL2luaXRpYWwvY3dkL2ZvbzIvYmFyLnRlc3QudHh0JyB9KVxuXHRcdFx0XSk7XG5cdFx0XHRzZWFyY2hTZXJ2aWNlLnNldFNlYXJjaFJlc3VsdCh7XG5cdFx0XHRcdG1lc3NhZ2VzOiBbXSxcblx0XHRcdFx0cmVzdWx0czogW1xuXHRcdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6ICcvaW5pdGlhbC9jd2QvZm9vL2Jhci50eHQnIH0pIH0sXG5cdFx0XHRcdFx0eyByZXNvdXJjZTogVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMuZmlsZSwgcGF0aDogJy9pbml0aWFsL2N3ZC9mb28vYmFyLnRlc3QudHh0JyB9KSB9LFxuXHRcdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6ICcvaW5pdGlhbC9jd2QvZm9vMi9iYXIudGVzdC50eHQnIH0pIH1cblx0XHRcdFx0XVxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCBvcGVuZXIub3Blbih7XG5cdFx0XHRcdHRleHQ6ICdiYXIudHh0Jyxcblx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0fSk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRsaW5rOiAnZmlsZTovLy9pbml0aWFsL2N3ZC9mb28vYmFyLnR4dCcsXG5cdFx0XHRcdHNvdXJjZTogJ2VkaXRvcidcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIG5vdCBvcGVuIHNpbmdsZSBleGFjdCBtYXRjaCBmb3IgcGF0aHMgbm90IGNvbnRhaW5pbmcgYSB3aGVuIGNvbW1hbmQgZGV0ZWN0aW9uIGlzblxcJ3QgYXZhaWxhYmxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0bG9jYWxGaWxlT3BlbmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZpbGVMaW5rT3BlbmVyKTtcblx0XHRcdGNvbnN0IGxvY2FsRm9sZGVyT3BlbmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZvbGRlckluV29ya3NwYWNlTGlua09wZW5lcik7XG5cdFx0XHRvcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VGVybWluYWxTZWFyY2hMaW5rT3BlbmVyLCBjYXBhYmlsaXRpZXMsICcvaW5pdGlhbC9jd2QnLCBsb2NhbEZpbGVPcGVuZXIsIGxvY2FsRm9sZGVyT3BlbmVyLCAoKSA9PiBPcGVyYXRpbmdTeXN0ZW0uTGludXgpO1xuXHRcdFx0ZmlsZVNlcnZpY2Uuc2V0RmlsZXMoW1xuXHRcdFx0XHRVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBwYXRoOiAnL2luaXRpYWwvY3dkL2Zvby9iYXIudHh0JyB9KSxcblx0XHRcdFx0VVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMuZmlsZSwgcGF0aDogJy9pbml0aWFsL2N3ZC9mb28yL2Jhci50eHQnIH0pXG5cdFx0XHRdKTtcblx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0dGV4dDogJ2Jhci50eHQnLFxuXHRcdFx0XHRidWZmZXJSYW5nZTogeyBzdGFydDogeyB4OiAxLCB5OiAxIH0sIGVuZDogeyB4OiA4LCB5OiAxIH0gfSxcblx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoXG5cdFx0XHR9KTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChhY3RpdmF0aW9uUmVzdWx0LCB7XG5cdFx0XHRcdGxpbms6ICdiYXIudHh0Jyxcblx0XHRcdFx0c291cmNlOiAnc2VhcmNoJ1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRzdWl0ZSgnbWFjT1MvTGludXgnLCAoKSA9PiB7XG5cdFx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRcdGxvY2FsRmlsZU9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTG9jYWxGaWxlTGlua09wZW5lcik7XG5cdFx0XHRcdGNvbnN0IGxvY2FsRm9sZGVyT3BlbmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZvbGRlckluV29ya3NwYWNlTGlua09wZW5lcik7XG5cdFx0XHRcdG9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RUZXJtaW5hbFNlYXJjaExpbmtPcGVuZXIsIGNhcGFiaWxpdGllcywgJycsIGxvY2FsRmlsZU9wZW5lciwgbG9jYWxGb2xkZXJPcGVuZXIsICgpID0+IE9wZXJhdGluZ1N5c3RlbS5MaW51eCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnc2hvdWxkIGFwcGx5IHRoZSBjd2QgdG8gdGhlIGxpbmsgb25seSB3aGVuIHRoZSBmaWxlIGV4aXN0cyBhbmQgY3dkRGV0ZWN0aW9uIGlzIGVuYWJsZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGN3ZCA9ICcvVXNlcnMvaG9tZS9mb2xkZXInO1xuXHRcdFx0XHRjb25zdCBhYnNvbHV0ZUZpbGUgPSAnL1VzZXJzL2hvbWUvZm9sZGVyL2ZpbGUudHh0Jztcblx0XHRcdFx0ZmlsZVNlcnZpY2Uuc2V0RmlsZXMoW1xuXHRcdFx0XHRcdFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6IGFic29sdXRlRmlsZSB9KSxcblx0XHRcdFx0XHRVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBwYXRoOiAnL1VzZXJzL2hvbWUvZm9sZGVyL290aGVyL2ZpbGUudHh0JyB9KVxuXHRcdFx0XHRdKTtcblxuXHRcdFx0XHQvLyBTZXQgYSBmYWtlIGRldGVjdGVkIGNvbW1hbmQgc3RhcnRpbmcgYXMgbGluZSAwIHRvIGVzdGFibGlzaCB0aGUgY3dkXG5cdFx0XHRcdGNvbW1hbmREZXRlY3Rpb24uc2V0Q29tbWFuZHMoW25ldyBUZXJtaW5hbENvbW1hbmQoeHRlcm0sIHtcblx0XHRcdFx0XHRjb21tYW5kOiAnJyxcblx0XHRcdFx0XHRjb21tYW5kTGluZUNvbmZpZGVuY2U6ICdsb3cnLFxuXHRcdFx0XHRcdGlzVHJ1c3RlZDogdHJ1ZSxcblx0XHRcdFx0XHRjd2QsXG5cdFx0XHRcdFx0dGltZXN0YW1wOiAwLFxuXHRcdFx0XHRcdGR1cmF0aW9uOiAwLFxuXHRcdFx0XHRcdGV4ZWN1dGVkWDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHN0YXJ0WDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdG1hcmtlcjoge1xuXHRcdFx0XHRcdFx0bGluZTogMFxuXHRcdFx0XHRcdH0gYXMgUGFydGlhbDxJWHRlcm1NYXJrZXI+IGFzIGFueSxcblx0XHRcdFx0XHRleGl0Q29kZTogMCxcblx0XHRcdFx0XHRjb21tYW5kU3RhcnRMaW5lQ29udGVudDogJycsXG5cdFx0XHRcdFx0bWFya1Byb3BlcnRpZXM6IHt9XG5cdFx0XHRcdH0pXSk7XG5cdFx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0XHR0ZXh0OiAnZmlsZS50eHQnLFxuXHRcdFx0XHRcdGJ1ZmZlclJhbmdlOiB7IHN0YXJ0OiB7IHg6IDEsIHk6IDEgfSwgZW5kOiB7IHg6IDgsIHk6IDEgfSB9LFxuXHRcdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKGFjdGl2YXRpb25SZXN1bHQsIHtcblx0XHRcdFx0XHRsaW5rOiAnZmlsZTovLy9Vc2Vycy9ob21lL2ZvbGRlci9maWxlLnR4dCcsXG5cdFx0XHRcdFx0c291cmNlOiAnZWRpdG9yJ1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHQvLyBDbGVhciBkZXRlY3RlZCBjb21tYW5kcyBhbmQgZW5zdXJlIHRoZSBzYW1lIHJlcXVlc3QgcmVzdWx0cyBpbiBhIHNlYXJjaCBzaW5jZSB0aGVyZSBhcmUgMiBtYXRjaGVzXG5cdFx0XHRcdGNvbW1hbmREZXRlY3Rpb24uc2V0Q29tbWFuZHMoW10pO1xuXHRcdFx0XHRvcGVuZXIuc2V0RmlsZVF1ZXJ5QnVpbGRlcih7IGZpbGU6ICgpID0+IG51bGwhIH0pO1xuXHRcdFx0XHRzZWFyY2hTZXJ2aWNlLnNldFNlYXJjaFJlc3VsdCh7XG5cdFx0XHRcdFx0bWVzc2FnZXM6IFtdLFxuXHRcdFx0XHRcdHJlc3VsdHM6IFtcblx0XHRcdFx0XHRcdHsgcmVzb3VyY2U6IFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6ICdmaWxlOi8vL1VzZXJzL2hvbWUvZm9sZGVyL2ZpbGUudHh0JyB9KSB9LFxuXHRcdFx0XHRcdFx0eyByZXNvdXJjZTogVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMuZmlsZSwgcGF0aDogJ2ZpbGU6Ly8vVXNlcnMvaG9tZS9mb2xkZXIvb3RoZXIvZmlsZS50eHQnIH0pIH1cblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhd2FpdCBvcGVuZXIub3Blbih7XG5cdFx0XHRcdFx0dGV4dDogJ2ZpbGUudHh0Jyxcblx0XHRcdFx0XHRidWZmZXJSYW5nZTogeyBzdGFydDogeyB4OiAxLCB5OiAxIH0sIGVuZDogeyB4OiA4LCB5OiAxIH0gfSxcblx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5TZWFyY2hcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChhY3RpdmF0aW9uUmVzdWx0LCB7XG5cdFx0XHRcdFx0bGluazogJ2ZpbGUudHh0Jyxcblx0XHRcdFx0XHRzb3VyY2U6ICdzZWFyY2gnXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ3Nob3VsZCBleHRyYWN0IGNvbHVtbiBhbmQvb3IgbGluZSBudW1iZXJzIGZyb20gbGlua3MgaW4gYSB3b3Jrc3BhY2UgY29udGFpbmluZyBzcGFjZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGxvY2FsRmlsZU9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTG9jYWxGaWxlTGlua09wZW5lcik7XG5cdFx0XHRcdGNvbnN0IGxvY2FsRm9sZGVyT3BlbmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZvbGRlckluV29ya3NwYWNlTGlua09wZW5lcik7XG5cdFx0XHRcdG9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RUZXJtaW5hbFNlYXJjaExpbmtPcGVuZXIsIGNhcGFiaWxpdGllcywgJy9zcGFjZSBmb2xkZXInLCBsb2NhbEZpbGVPcGVuZXIsIGxvY2FsRm9sZGVyT3BlbmVyLCAoKSA9PiBPcGVyYXRpbmdTeXN0ZW0uTGludXgpO1xuXHRcdFx0XHRmaWxlU2VydmljZS5zZXRGaWxlcyhbXG5cdFx0XHRcdFx0VVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMuZmlsZSwgcGF0aDogJy9zcGFjZSBmb2xkZXIvZm9vL2Jhci50eHQnIH0pXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRhd2FpdCBvcGVuZXIub3Blbih7XG5cdFx0XHRcdFx0dGV4dDogJy4vZm9vL2Jhci50eHQ6MTA6NScsXG5cdFx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRcdGxpbms6ICdmaWxlOi8vL3NwYWNlJTIwZm9sZGVyL2Zvby9iYXIudHh0Jyxcblx0XHRcdFx0XHRzb3VyY2U6ICdlZGl0b3InLFxuXHRcdFx0XHRcdHNlbGVjdGlvbjoge1xuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IDUsXG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDEwLFxuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0YXdhaXQgb3BlbmVyLm9wZW4oe1xuXHRcdFx0XHRcdHRleHQ6ICcuL2Zvby9iYXIudHh0OjEwJyxcblx0XHRcdFx0XHRidWZmZXJSYW5nZTogeyBzdGFydDogeyB4OiAxLCB5OiAxIH0sIGVuZDogeyB4OiA4LCB5OiAxIH0gfSxcblx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5TZWFyY2hcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChhY3RpdmF0aW9uUmVzdWx0LCB7XG5cdFx0XHRcdFx0bGluazogJ2ZpbGU6Ly8vc3BhY2UlMjBmb2xkZXIvZm9vL2Jhci50eHQnLFxuXHRcdFx0XHRcdHNvdXJjZTogJ2VkaXRvcicsXG5cdFx0XHRcdFx0c2VsZWN0aW9uOiB7XG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMTAsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ3Nob3VsZCBleHRyYWN0IGNvbHVtbiBhbmQvb3IgbGluZSBudW1iZXJzIGZyb20gbGlua3MgYW5kIHJlbW92ZSB0cmFpbGluZyBwZXJpb2RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRsb2NhbEZpbGVPcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvY2FsRmlsZUxpbmtPcGVuZXIpO1xuXHRcdFx0XHRjb25zdCBsb2NhbEZvbGRlck9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTG9jYWxGb2xkZXJJbldvcmtzcGFjZUxpbmtPcGVuZXIpO1xuXHRcdFx0XHRvcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VGVybWluYWxTZWFyY2hMaW5rT3BlbmVyLCBjYXBhYmlsaXRpZXMsICcvZm9sZGVyJywgbG9jYWxGaWxlT3BlbmVyLCBsb2NhbEZvbGRlck9wZW5lciwgKCkgPT4gT3BlcmF0aW5nU3lzdGVtLkxpbnV4KTtcblx0XHRcdFx0ZmlsZVNlcnZpY2Uuc2V0RmlsZXMoW1xuXHRcdFx0XHRcdFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6ICcvZm9sZGVyL2Zvby9iYXIudHh0JyB9KVxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXdhaXQgb3BlbmVyLm9wZW4oe1xuXHRcdFx0XHRcdHRleHQ6ICcuL2Zvby9iYXIudHh0LicsXG5cdFx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRcdGxpbms6ICdmaWxlOi8vL2ZvbGRlci9mb28vYmFyLnR4dCcsXG5cdFx0XHRcdFx0c291cmNlOiAnZWRpdG9yJyxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0XHR0ZXh0OiAnLi9mb28vYmFyLnR4dDoxMDo1LicsXG5cdFx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRcdGxpbms6ICdmaWxlOi8vL2ZvbGRlci9mb28vYmFyLnR4dCcsXG5cdFx0XHRcdFx0c291cmNlOiAnZWRpdG9yJyxcblx0XHRcdFx0XHRzZWxlY3Rpb246IHtcblx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiA1LFxuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxMCxcblx0XHRcdFx0XHRcdGVuZENvbHVtbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0XHR0ZXh0OiAnLi9mb28vYmFyLnR4dDoxMC4nLFxuXHRcdFx0XHRcdGJ1ZmZlclJhbmdlOiB7IHN0YXJ0OiB7IHg6IDEsIHk6IDEgfSwgZW5kOiB7IHg6IDgsIHk6IDEgfSB9LFxuXHRcdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKGFjdGl2YXRpb25SZXN1bHQsIHtcblx0XHRcdFx0XHRsaW5rOiAnZmlsZTovLy9mb2xkZXIvZm9vL2Jhci50eHQnLFxuXHRcdFx0XHRcdHNvdXJjZTogJ2VkaXRvcicsXG5cdFx0XHRcdFx0c2VsZWN0aW9uOiB7XG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMTAsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ3Nob3VsZCBleHRyYWN0IGNvbHVtbiBhbmQvb3IgbGluZSBudW1iZXJzIGZyb20gbGlua3MgYW5kIHJlbW92ZSBncmVwcGVkIGxpbmVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRsb2NhbEZpbGVPcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvY2FsRmlsZUxpbmtPcGVuZXIpO1xuXHRcdFx0XHRjb25zdCBsb2NhbEZvbGRlck9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTG9jYWxGb2xkZXJJbldvcmtzcGFjZUxpbmtPcGVuZXIpO1xuXHRcdFx0XHRvcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VGVybWluYWxTZWFyY2hMaW5rT3BlbmVyLCBjYXBhYmlsaXRpZXMsICcvZm9sZGVyJywgbG9jYWxGaWxlT3BlbmVyLCBsb2NhbEZvbGRlck9wZW5lciwgKCkgPT4gT3BlcmF0aW5nU3lzdGVtLkxpbnV4KTtcblx0XHRcdFx0ZmlsZVNlcnZpY2Uuc2V0RmlsZXMoW1xuXHRcdFx0XHRcdFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6ICcvZm9sZGVyL2Zvby9iYXIudHh0JyB9KVxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXdhaXQgb3BlbmVyLm9wZW4oe1xuXHRcdFx0XHRcdHRleHQ6ICcuL2Zvby9iYXIudHh0OjEwOjU6aW1wb3J0IHsgSUxvdmVWU0NvZGUgfSBmcm9tIFxcJy4vZm9vL2Jhci50c1xcJzsnLFxuXHRcdFx0XHRcdGJ1ZmZlclJhbmdlOiB7IHN0YXJ0OiB7IHg6IDEsIHk6IDEgfSwgZW5kOiB7IHg6IDgsIHk6IDEgfSB9LFxuXHRcdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKGFjdGl2YXRpb25SZXN1bHQsIHtcblx0XHRcdFx0XHRsaW5rOiAnZmlsZTovLy9mb2xkZXIvZm9vL2Jhci50eHQnLFxuXHRcdFx0XHRcdHNvdXJjZTogJ2VkaXRvcicsXG5cdFx0XHRcdFx0c2VsZWN0aW9uOiB7XG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogNSxcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMTAsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhd2FpdCBvcGVuZXIub3Blbih7XG5cdFx0XHRcdFx0dGV4dDogJy4vZm9vL2Jhci50eHQ6MTA6aW1wb3J0IHsgSUxvdmVWU0NvZGUgfSBmcm9tIFxcJy4vZm9vL2Jhci50c1xcJzsnLFxuXHRcdFx0XHRcdGJ1ZmZlclJhbmdlOiB7IHN0YXJ0OiB7IHg6IDEsIHk6IDEgfSwgZW5kOiB7IHg6IDgsIHk6IDEgfSB9LFxuXHRcdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKGFjdGl2YXRpb25SZXN1bHQsIHtcblx0XHRcdFx0XHRsaW5rOiAnZmlsZTovLy9mb2xkZXIvZm9vL2Jhci50eHQnLFxuXHRcdFx0XHRcdHNvdXJjZTogJ2VkaXRvcicsXG5cdFx0XHRcdFx0c2VsZWN0aW9uOiB7XG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMTAsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIFRlc3QgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL3B1bGwvMjAwOTE5I2Rpc2N1c3Npb25fcjE0MjgxMjQxOTZcblx0XHRcdHRlc3QoJ3Nob3VsZCBleHRyYWN0IGNvbHVtbiBhbmQvb3IgbGluZSBudW1iZXJzIGZyb20gbGlua3MgYW5kIHJlbW92ZSBncmVwcGVkIGxpbmVzIGluY2wgc2luZ3VsYXIgc3BhY2VzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRsb2NhbEZpbGVPcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvY2FsRmlsZUxpbmtPcGVuZXIpO1xuXHRcdFx0XHRjb25zdCBsb2NhbEZvbGRlck9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTG9jYWxGb2xkZXJJbldvcmtzcGFjZUxpbmtPcGVuZXIpO1xuXHRcdFx0XHRvcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VGVybWluYWxTZWFyY2hMaW5rT3BlbmVyLCBjYXBhYmlsaXRpZXMsICcvZm9sZGVyJywgbG9jYWxGaWxlT3BlbmVyLCBsb2NhbEZvbGRlck9wZW5lciwgKCkgPT4gT3BlcmF0aW5nU3lzdGVtLkxpbnV4KTtcblx0XHRcdFx0ZmlsZVNlcnZpY2Uuc2V0RmlsZXMoW1xuXHRcdFx0XHRcdFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6ICcvZm9sZGVyL2Zvby9iYXIudHh0JyB9KVxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXdhaXQgb3BlbmVyLm9wZW4oe1xuXHRcdFx0XHRcdHRleHQ6ICcuL2Zvby9iYXIudHh0OjEwOjU6ICcsXG5cdFx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRcdGxpbms6ICdmaWxlOi8vL2ZvbGRlci9mb28vYmFyLnR4dCcsXG5cdFx0XHRcdFx0c291cmNlOiAnZWRpdG9yJyxcblx0XHRcdFx0XHRzZWxlY3Rpb246IHtcblx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiA1LFxuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxMCxcblx0XHRcdFx0XHRcdGVuZENvbHVtbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0XHR0ZXh0OiAnLi9mb28vYmFyLnR4dDoxMDogJyxcblx0XHRcdFx0XHRidWZmZXJSYW5nZTogeyBzdGFydDogeyB4OiAxLCB5OiAxIH0sIGVuZDogeyB4OiA4LCB5OiAxIH0gfSxcblx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5TZWFyY2hcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChhY3RpdmF0aW9uUmVzdWx0LCB7XG5cdFx0XHRcdFx0bGluazogJ2ZpbGU6Ly8vZm9sZGVyL2Zvby9iYXIudHh0Jyxcblx0XHRcdFx0XHRzb3VyY2U6ICdlZGl0b3InLFxuXHRcdFx0XHRcdHNlbGVjdGlvbjoge1xuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDEwLFxuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdzaG91bGQgZXh0cmFjdCBsaW5lIG51bWJlcnMgZnJvbSBsaW5rcyBhbmQgcmVtb3ZlIHJ1Ynkgc3RhY2sgdHJhY2VzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRsb2NhbEZpbGVPcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvY2FsRmlsZUxpbmtPcGVuZXIpO1xuXHRcdFx0XHRjb25zdCBsb2NhbEZvbGRlck9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTG9jYWxGb2xkZXJJbldvcmtzcGFjZUxpbmtPcGVuZXIpO1xuXHRcdFx0XHRvcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VGVybWluYWxTZWFyY2hMaW5rT3BlbmVyLCBjYXBhYmlsaXRpZXMsICcvZm9sZGVyJywgbG9jYWxGaWxlT3BlbmVyLCBsb2NhbEZvbGRlck9wZW5lciwgKCkgPT4gT3BlcmF0aW5nU3lzdGVtLkxpbnV4KTtcblx0XHRcdFx0ZmlsZVNlcnZpY2Uuc2V0RmlsZXMoW1xuXHRcdFx0XHRcdFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6ICcvZm9sZGVyL2Zvby9iYXIucmInIH0pXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRhd2FpdCBvcGVuZXIub3Blbih7XG5cdFx0XHRcdFx0dGV4dDogJy4vZm9vL2Jhci5yYjozMDppbiBgPG1haW4+YCcsXG5cdFx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRcdGxpbms6ICdmaWxlOi8vL2ZvbGRlci9mb28vYmFyLnJiJyxcblx0XHRcdFx0XHRzb3VyY2U6ICdlZGl0b3InLFxuXHRcdFx0XHRcdHNlbGVjdGlvbjoge1xuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDMwLFxuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0fSk7XG5cblx0XHRzdWl0ZSgnV2luZG93cycsICgpID0+IHtcblx0XHRcdHNldHVwKCgpID0+IHtcblx0XHRcdFx0bG9jYWxGaWxlT3BlbmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZpbGVMaW5rT3BlbmVyKTtcblx0XHRcdFx0Y29uc3QgbG9jYWxGb2xkZXJPcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvY2FsRm9sZGVySW5Xb3Jrc3BhY2VMaW5rT3BlbmVyKTtcblx0XHRcdFx0b3BlbmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFRlcm1pbmFsU2VhcmNoTGlua09wZW5lciwgY2FwYWJpbGl0aWVzLCAnJywgbG9jYWxGaWxlT3BlbmVyLCBsb2NhbEZvbGRlck9wZW5lciwgKCkgPT4gT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ3Nob3VsZCBhcHBseSB0aGUgY3dkIHRvIHRoZSBsaW5rIG9ubHkgd2hlbiB0aGUgZmlsZSBleGlzdHMgYW5kIGN3ZERldGVjdGlvbiBpcyBlbmFibGVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRsb2NhbEZpbGVPcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvY2FsRmlsZUxpbmtPcGVuZXIpO1xuXHRcdFx0XHRjb25zdCBsb2NhbEZvbGRlck9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTG9jYWxGb2xkZXJJbldvcmtzcGFjZUxpbmtPcGVuZXIpO1xuXHRcdFx0XHRvcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VGVybWluYWxTZWFyY2hMaW5rT3BlbmVyLCBjYXBhYmlsaXRpZXMsICdjOlxcXFxVc2VycycsIGxvY2FsRmlsZU9wZW5lciwgbG9jYWxGb2xkZXJPcGVuZXIsICgpID0+IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzKTtcblxuXHRcdFx0XHRjb25zdCBjd2QgPSAnYzpcXFxcVXNlcnNcXFxcaG9tZVxcXFxmb2xkZXInO1xuXHRcdFx0XHRjb25zdCBhYnNvbHV0ZUZpbGUgPSAnYzpcXFxcVXNlcnNcXFxcaG9tZVxcXFxmb2xkZXJcXFxcZmlsZS50eHQnO1xuXG5cdFx0XHRcdGZpbGVTZXJ2aWNlLnNldEZpbGVzKFtcblx0XHRcdFx0XHRVUkkuZmlsZSgnL2M6L1VzZXJzL2hvbWUvZm9sZGVyL2ZpbGUudHh0Jylcblx0XHRcdFx0XSk7XG5cblx0XHRcdFx0Ly8gU2V0IGEgZmFrZSBkZXRlY3RlZCBjb21tYW5kIHN0YXJ0aW5nIGFzIGxpbmUgMCB0byBlc3RhYmxpc2ggdGhlIGN3ZFxuXHRcdFx0XHRjb21tYW5kRGV0ZWN0aW9uLnNldENvbW1hbmRzKFtuZXcgVGVybWluYWxDb21tYW5kKHh0ZXJtLCB7XG5cdFx0XHRcdFx0ZXhpdENvZGU6IDAsXG5cdFx0XHRcdFx0Y29tbWFuZFN0YXJ0TGluZUNvbnRlbnQ6ICcnLFxuXHRcdFx0XHRcdG1hcmtQcm9wZXJ0aWVzOiB7fSxcblx0XHRcdFx0XHRjb21tYW5kOiAnJyxcblx0XHRcdFx0XHRjb21tYW5kTGluZUNvbmZpZGVuY2U6ICdsb3cnLFxuXHRcdFx0XHRcdGlzVHJ1c3RlZDogdHJ1ZSxcblx0XHRcdFx0XHRjd2QsXG5cdFx0XHRcdFx0ZXhlY3V0ZWRYOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0c3RhcnRYOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0dGltZXN0YW1wOiAwLFxuXHRcdFx0XHRcdGR1cmF0aW9uOiAwLFxuXHRcdFx0XHRcdG1hcmtlcjoge1xuXHRcdFx0XHRcdFx0bGluZTogMFxuXHRcdFx0XHRcdH0gYXMgUGFydGlhbDxJWHRlcm1NYXJrZXI+IGFzIGFueSxcblx0XHRcdFx0fSldKTtcblx0XHRcdFx0YXdhaXQgb3BlbmVyLm9wZW4oe1xuXHRcdFx0XHRcdHRleHQ6ICdmaWxlLnR4dCcsXG5cdFx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRcdGxpbms6ICdmaWxlOi8vL2MlM0EvVXNlcnMvaG9tZS9mb2xkZXIvZmlsZS50eHQnLFxuXHRcdFx0XHRcdHNvdXJjZTogJ2VkaXRvcidcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Ly8gQ2xlYXIgZGV0ZWN0ZWQgY29tbWFuZHMgYW5kIGVuc3VyZSB0aGUgc2FtZSByZXF1ZXN0IHJlc3VsdHMgaW4gYSBzZWFyY2hcblx0XHRcdFx0Y29tbWFuZERldGVjdGlvbi5zZXRDb21tYW5kcyhbXSk7XG5cdFx0XHRcdG9wZW5lci5zZXRGaWxlUXVlcnlCdWlsZGVyKHsgZmlsZTogKCkgPT4gbnVsbCEgfSk7XG5cdFx0XHRcdHNlYXJjaFNlcnZpY2Uuc2V0U2VhcmNoUmVzdWx0KHtcblx0XHRcdFx0XHRtZXNzYWdlczogW10sXG5cdFx0XHRcdFx0cmVzdWx0czogW1xuXHRcdFx0XHRcdFx0eyByZXNvdXJjZTogVVJJLmZpbGUoYWJzb2x1dGVGaWxlKSB9LFxuXHRcdFx0XHRcdFx0eyByZXNvdXJjZTogVVJJLmZpbGUoJy9jOi9Vc2Vycy9ob21lL2ZvbGRlci9vdGhlci9maWxlLnR4dCcpIH1cblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhd2FpdCBvcGVuZXIub3Blbih7XG5cdFx0XHRcdFx0dGV4dDogJ2ZpbGUudHh0Jyxcblx0XHRcdFx0XHRidWZmZXJSYW5nZTogeyBzdGFydDogeyB4OiAxLCB5OiAxIH0sIGVuZDogeyB4OiA4LCB5OiAxIH0gfSxcblx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5TZWFyY2hcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChhY3RpdmF0aW9uUmVzdWx0LCB7XG5cdFx0XHRcdFx0bGluazogJ2ZpbGUudHh0Jyxcblx0XHRcdFx0XHRzb3VyY2U6ICdzZWFyY2gnXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ3Nob3VsZCBleHRyYWN0IGNvbHVtbiBhbmQvb3IgbGluZSBudW1iZXJzIGZyb20gbGlua3MgaW4gYSB3b3Jrc3BhY2UgY29udGFpbmluZyBzcGFjZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGxvY2FsRmlsZU9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTG9jYWxGaWxlTGlua09wZW5lcik7XG5cdFx0XHRcdGNvbnN0IGxvY2FsRm9sZGVyT3BlbmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZvbGRlckluV29ya3NwYWNlTGlua09wZW5lcik7XG5cdFx0XHRcdG9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RUZXJtaW5hbFNlYXJjaExpbmtPcGVuZXIsIGNhcGFiaWxpdGllcywgJ2M6L3NwYWNlIGZvbGRlcicsIGxvY2FsRmlsZU9wZW5lciwgbG9jYWxGb2xkZXJPcGVuZXIsICgpID0+IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzKTtcblx0XHRcdFx0ZmlsZVNlcnZpY2Uuc2V0RmlsZXMoW1xuXHRcdFx0XHRcdFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6ICdjOi9zcGFjZSBmb2xkZXIvZm9vL2Jhci50eHQnIH0pXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRhd2FpdCBvcGVuZXIub3Blbih7XG5cdFx0XHRcdFx0dGV4dDogJy4vZm9vL2Jhci50eHQ6MTA6NScsXG5cdFx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRcdGxpbms6ICdmaWxlOi8vL2MlM0Evc3BhY2UlMjBmb2xkZXIvZm9vL2Jhci50eHQnLFxuXHRcdFx0XHRcdHNvdXJjZTogJ2VkaXRvcicsXG5cdFx0XHRcdFx0c2VsZWN0aW9uOiB7XG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogNSxcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMTAsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhd2FpdCBvcGVuZXIub3Blbih7XG5cdFx0XHRcdFx0dGV4dDogJy4vZm9vL2Jhci50eHQ6MTAnLFxuXHRcdFx0XHRcdGJ1ZmZlclJhbmdlOiB7IHN0YXJ0OiB7IHg6IDEsIHk6IDEgfSwgZW5kOiB7IHg6IDgsIHk6IDEgfSB9LFxuXHRcdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKGFjdGl2YXRpb25SZXN1bHQsIHtcblx0XHRcdFx0XHRsaW5rOiAnZmlsZTovLy9jJTNBL3NwYWNlJTIwZm9sZGVyL2Zvby9iYXIudHh0Jyxcblx0XHRcdFx0XHRzb3VyY2U6ICdlZGl0b3InLFxuXHRcdFx0XHRcdHNlbGVjdGlvbjoge1xuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDEwLFxuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0YXdhaXQgb3BlbmVyLm9wZW4oe1xuXHRcdFx0XHRcdHRleHQ6ICcuXFxcXGZvb1xcXFxiYXIudHh0OjEwOjUnLFxuXHRcdFx0XHRcdGJ1ZmZlclJhbmdlOiB7IHN0YXJ0OiB7IHg6IDEsIHk6IDEgfSwgZW5kOiB7IHg6IDgsIHk6IDEgfSB9LFxuXHRcdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKGFjdGl2YXRpb25SZXN1bHQsIHtcblx0XHRcdFx0XHRsaW5rOiAnZmlsZTovLy9jJTNBL3NwYWNlJTIwZm9sZGVyL2Zvby9iYXIudHh0Jyxcblx0XHRcdFx0XHRzb3VyY2U6ICdlZGl0b3InLFxuXHRcdFx0XHRcdHNlbGVjdGlvbjoge1xuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IDUsXG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDEwLFxuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0YXdhaXQgb3BlbmVyLm9wZW4oe1xuXHRcdFx0XHRcdHRleHQ6ICcuXFxcXGZvb1xcXFxiYXIudHh0OjEwJyxcblx0XHRcdFx0XHRidWZmZXJSYW5nZTogeyBzdGFydDogeyB4OiAxLCB5OiAxIH0sIGVuZDogeyB4OiA4LCB5OiAxIH0gfSxcblx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5TZWFyY2hcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChhY3RpdmF0aW9uUmVzdWx0LCB7XG5cdFx0XHRcdFx0bGluazogJ2ZpbGU6Ly8vYyUzQS9zcGFjZSUyMGZvbGRlci9mb28vYmFyLnR4dCcsXG5cdFx0XHRcdFx0c291cmNlOiAnZWRpdG9yJyxcblx0XHRcdFx0XHRzZWxlY3Rpb246IHtcblx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxMCxcblx0XHRcdFx0XHRcdGVuZENvbHVtbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnc2hvdWxkIGV4dHJhY3QgY29sdW1uIGFuZC9vciBsaW5lIG51bWJlcnMgZnJvbSBsaW5rcyBhbmQgcmVtb3ZlIHRyYWlsaW5nIHBlcmlvZHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGxvY2FsRmlsZU9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTG9jYWxGaWxlTGlua09wZW5lcik7XG5cdFx0XHRcdGNvbnN0IGxvY2FsRm9sZGVyT3BlbmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZvbGRlckluV29ya3NwYWNlTGlua09wZW5lcik7XG5cdFx0XHRcdG9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RUZXJtaW5hbFNlYXJjaExpbmtPcGVuZXIsIGNhcGFiaWxpdGllcywgJ2M6L2ZvbGRlcicsIGxvY2FsRmlsZU9wZW5lciwgbG9jYWxGb2xkZXJPcGVuZXIsICgpID0+IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzKTtcblx0XHRcdFx0ZmlsZVNlcnZpY2Uuc2V0RmlsZXMoW1xuXHRcdFx0XHRcdFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6ICdjOi9mb2xkZXIvZm9vL2Jhci50eHQnIH0pXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRhd2FpdCBvcGVuZXIub3Blbih7XG5cdFx0XHRcdFx0dGV4dDogJy4vZm9vL2Jhci50eHQuJyxcblx0XHRcdFx0XHRidWZmZXJSYW5nZTogeyBzdGFydDogeyB4OiAxLCB5OiAxIH0sIGVuZDogeyB4OiA4LCB5OiAxIH0gfSxcblx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5TZWFyY2hcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChhY3RpdmF0aW9uUmVzdWx0LCB7XG5cdFx0XHRcdFx0bGluazogJ2ZpbGU6Ly8vYyUzQS9mb2xkZXIvZm9vL2Jhci50eHQnLFxuXHRcdFx0XHRcdHNvdXJjZTogJ2VkaXRvcicsXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhd2FpdCBvcGVuZXIub3Blbih7XG5cdFx0XHRcdFx0dGV4dDogJy4vZm9vL2Jhci50eHQ6MTA6NS4nLFxuXHRcdFx0XHRcdGJ1ZmZlclJhbmdlOiB7IHN0YXJ0OiB7IHg6IDEsIHk6IDEgfSwgZW5kOiB7IHg6IDgsIHk6IDEgfSB9LFxuXHRcdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKGFjdGl2YXRpb25SZXN1bHQsIHtcblx0XHRcdFx0XHRsaW5rOiAnZmlsZTovLy9jJTNBL2ZvbGRlci9mb28vYmFyLnR4dCcsXG5cdFx0XHRcdFx0c291cmNlOiAnZWRpdG9yJyxcblx0XHRcdFx0XHRzZWxlY3Rpb246IHtcblx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiA1LFxuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxMCxcblx0XHRcdFx0XHRcdGVuZENvbHVtbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0XHR0ZXh0OiAnLi9mb28vYmFyLnR4dDoxMC4nLFxuXHRcdFx0XHRcdGJ1ZmZlclJhbmdlOiB7IHN0YXJ0OiB7IHg6IDEsIHk6IDEgfSwgZW5kOiB7IHg6IDgsIHk6IDEgfSB9LFxuXHRcdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKGFjdGl2YXRpb25SZXN1bHQsIHtcblx0XHRcdFx0XHRsaW5rOiAnZmlsZTovLy9jJTNBL2ZvbGRlci9mb28vYmFyLnR4dCcsXG5cdFx0XHRcdFx0c291cmNlOiAnZWRpdG9yJyxcblx0XHRcdFx0XHRzZWxlY3Rpb246IHtcblx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxMCxcblx0XHRcdFx0XHRcdGVuZENvbHVtbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0XHR0ZXh0OiAnLlxcXFxmb29cXFxcYmFyLnR4dC4nLFxuXHRcdFx0XHRcdGJ1ZmZlclJhbmdlOiB7IHN0YXJ0OiB7IHg6IDEsIHk6IDEgfSwgZW5kOiB7IHg6IDgsIHk6IDEgfSB9LFxuXHRcdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKGFjdGl2YXRpb25SZXN1bHQsIHtcblx0XHRcdFx0XHRsaW5rOiAnZmlsZTovLy9jJTNBL2ZvbGRlci9mb28vYmFyLnR4dCcsXG5cdFx0XHRcdFx0c291cmNlOiAnZWRpdG9yJyxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0XHR0ZXh0OiAnLlxcXFxmb29cXFxcYmFyLnR4dDoyOjUuJyxcblx0XHRcdFx0XHRidWZmZXJSYW5nZTogeyBzdGFydDogeyB4OiAxLCB5OiAxIH0sIGVuZDogeyB4OiA4LCB5OiAxIH0gfSxcblx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5TZWFyY2hcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChhY3RpdmF0aW9uUmVzdWx0LCB7XG5cdFx0XHRcdFx0bGluazogJ2ZpbGU6Ly8vYyUzQS9mb2xkZXIvZm9vL2Jhci50eHQnLFxuXHRcdFx0XHRcdHNvdXJjZTogJ2VkaXRvcicsXG5cdFx0XHRcdFx0c2VsZWN0aW9uOiB7XG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogNSxcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMixcblx0XHRcdFx0XHRcdGVuZENvbHVtbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0XHR0ZXh0OiAnLlxcXFxmb29cXFxcYmFyLnR4dDoyLicsXG5cdFx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRcdGxpbms6ICdmaWxlOi8vL2MlM0EvZm9sZGVyL2Zvby9iYXIudHh0Jyxcblx0XHRcdFx0XHRzb3VyY2U6ICdlZGl0b3InLFxuXHRcdFx0XHRcdHNlbGVjdGlvbjoge1xuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDIsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ3Nob3VsZCBleHRyYWN0IGNvbHVtbiBhbmQvb3IgbGluZSBudW1iZXJzIGZyb20gbGlua3MgYW5kIHJlbW92ZSBncmVwcGVkIGxpbmVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRsb2NhbEZpbGVPcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvY2FsRmlsZUxpbmtPcGVuZXIpO1xuXHRcdFx0XHRjb25zdCBsb2NhbEZvbGRlck9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTG9jYWxGb2xkZXJJbldvcmtzcGFjZUxpbmtPcGVuZXIpO1xuXHRcdFx0XHRvcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VGVybWluYWxTZWFyY2hMaW5rT3BlbmVyLCBjYXBhYmlsaXRpZXMsICdjOi9mb2xkZXInLCBsb2NhbEZpbGVPcGVuZXIsIGxvY2FsRm9sZGVyT3BlbmVyLCAoKSA9PiBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cyk7XG5cdFx0XHRcdGZpbGVTZXJ2aWNlLnNldEZpbGVzKFtcblx0XHRcdFx0XHRVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBwYXRoOiAnYzovZm9sZGVyL2Zvby9iYXIudHh0JyB9KVxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXdhaXQgb3BlbmVyLm9wZW4oe1xuXHRcdFx0XHRcdHRleHQ6ICcuL2Zvby9iYXIudHh0OjEwOjU6aW1wb3J0IHsgSUxvdmVWU0NvZGUgfSBmcm9tIFxcJy4vZm9vL2Jhci50c1xcJzsnLFxuXHRcdFx0XHRcdGJ1ZmZlclJhbmdlOiB7IHN0YXJ0OiB7IHg6IDEsIHk6IDEgfSwgZW5kOiB7IHg6IDgsIHk6IDEgfSB9LFxuXHRcdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKGFjdGl2YXRpb25SZXN1bHQsIHtcblx0XHRcdFx0XHRsaW5rOiAnZmlsZTovLy9jJTNBL2ZvbGRlci9mb28vYmFyLnR4dCcsXG5cdFx0XHRcdFx0c291cmNlOiAnZWRpdG9yJyxcblx0XHRcdFx0XHRzZWxlY3Rpb246IHtcblx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiA1LFxuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxMCxcblx0XHRcdFx0XHRcdGVuZENvbHVtbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0XHR0ZXh0OiAnLi9mb28vYmFyLnR4dDoxMDppbXBvcnQgeyBJTG92ZVZTQ29kZSB9IGZyb20gXFwnLi9mb28vYmFyLnRzXFwnOycsXG5cdFx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRcdGxpbms6ICdmaWxlOi8vL2MlM0EvZm9sZGVyL2Zvby9iYXIudHh0Jyxcblx0XHRcdFx0XHRzb3VyY2U6ICdlZGl0b3InLFxuXHRcdFx0XHRcdHNlbGVjdGlvbjoge1xuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDEwLFxuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0YXdhaXQgb3BlbmVyLm9wZW4oe1xuXHRcdFx0XHRcdHRleHQ6ICcuXFxcXGZvb1xcXFxiYXIudHh0OjEwOjU6aW1wb3J0IHsgSUxvdmVWU0NvZGUgfSBmcm9tIFxcJy4vZm9vL2Jhci50c1xcJzsnLFxuXHRcdFx0XHRcdGJ1ZmZlclJhbmdlOiB7IHN0YXJ0OiB7IHg6IDEsIHk6IDEgfSwgZW5kOiB7IHg6IDgsIHk6IDEgfSB9LFxuXHRcdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKGFjdGl2YXRpb25SZXN1bHQsIHtcblx0XHRcdFx0XHRsaW5rOiAnZmlsZTovLy9jJTNBL2ZvbGRlci9mb28vYmFyLnR4dCcsXG5cdFx0XHRcdFx0c291cmNlOiAnZWRpdG9yJyxcblx0XHRcdFx0XHRzZWxlY3Rpb246IHtcblx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiA1LFxuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxMCxcblx0XHRcdFx0XHRcdGVuZENvbHVtbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0XHR0ZXh0OiAnLlxcXFxmb29cXFxcYmFyLnR4dDoxMDppbXBvcnQgeyBJTG92ZVZTQ29kZSB9IGZyb20gXFwnLi9mb28vYmFyLnRzXFwnOycsXG5cdFx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRcdGxpbms6ICdmaWxlOi8vL2MlM0EvZm9sZGVyL2Zvby9iYXIudHh0Jyxcblx0XHRcdFx0XHRzb3VyY2U6ICdlZGl0b3InLFxuXHRcdFx0XHRcdHNlbGVjdGlvbjoge1xuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDEwLFxuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHQvLyBUZXN0IGZvciBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9wdWxsLzIwMDkxOSNkaXNjdXNzaW9uX3IxNDI4MTI0MTk2XG5cdFx0XHR0ZXN0KCdzaG91bGQgZXh0cmFjdCBjb2x1bW4gYW5kL29yIGxpbmUgbnVtYmVycyBmcm9tIGxpbmtzIGFuZCByZW1vdmUgZ3JlcHBlZCBsaW5lcyBpbmNsIHNpbmd1bGFyIHNwYWNlcycsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0bG9jYWxGaWxlT3BlbmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZpbGVMaW5rT3BlbmVyKTtcblx0XHRcdFx0Y29uc3QgbG9jYWxGb2xkZXJPcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvY2FsRm9sZGVySW5Xb3Jrc3BhY2VMaW5rT3BlbmVyKTtcblx0XHRcdFx0b3BlbmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFRlcm1pbmFsU2VhcmNoTGlua09wZW5lciwgY2FwYWJpbGl0aWVzLCAnYzovZm9sZGVyJywgbG9jYWxGaWxlT3BlbmVyLCBsb2NhbEZvbGRlck9wZW5lciwgKCkgPT4gT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MpO1xuXHRcdFx0XHRmaWxlU2VydmljZS5zZXRGaWxlcyhbXG5cdFx0XHRcdFx0VVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMuZmlsZSwgcGF0aDogJ2M6L2ZvbGRlci9mb28vYmFyLnR4dCcgfSlcblx0XHRcdFx0XSk7XG5cdFx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0XHR0ZXh0OiAnLi9mb28vYmFyLnR4dDoxMDo1OiAnLFxuXHRcdFx0XHRcdGJ1ZmZlclJhbmdlOiB7IHN0YXJ0OiB7IHg6IDEsIHk6IDEgfSwgZW5kOiB7IHg6IDgsIHk6IDEgfSB9LFxuXHRcdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKGFjdGl2YXRpb25SZXN1bHQsIHtcblx0XHRcdFx0XHRsaW5rOiAnZmlsZTovLy9jJTNBL2ZvbGRlci9mb28vYmFyLnR4dCcsXG5cdFx0XHRcdFx0c291cmNlOiAnZWRpdG9yJyxcblx0XHRcdFx0XHRzZWxlY3Rpb246IHtcblx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiA1LFxuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxMCxcblx0XHRcdFx0XHRcdGVuZENvbHVtbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGF3YWl0IG9wZW5lci5vcGVuKHtcblx0XHRcdFx0XHR0ZXh0OiAnLi9mb28vYmFyLnR4dDoxMDogJyxcblx0XHRcdFx0XHRidWZmZXJSYW5nZTogeyBzdGFydDogeyB4OiAxLCB5OiAxIH0sIGVuZDogeyB4OiA4LCB5OiAxIH0gfSxcblx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5TZWFyY2hcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChhY3RpdmF0aW9uUmVzdWx0LCB7XG5cdFx0XHRcdFx0bGluazogJ2ZpbGU6Ly8vYyUzQS9mb2xkZXIvZm9vL2Jhci50eHQnLFxuXHRcdFx0XHRcdHNvdXJjZTogJ2VkaXRvcicsXG5cdFx0XHRcdFx0c2VsZWN0aW9uOiB7XG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMTAsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhd2FpdCBvcGVuZXIub3Blbih7XG5cdFx0XHRcdFx0dGV4dDogJy5cXFxcZm9vXFxcXGJhci50eHQ6MTA6NTogJyxcblx0XHRcdFx0XHRidWZmZXJSYW5nZTogeyBzdGFydDogeyB4OiAxLCB5OiAxIH0sIGVuZDogeyB4OiA4LCB5OiAxIH0gfSxcblx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5TZWFyY2hcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChhY3RpdmF0aW9uUmVzdWx0LCB7XG5cdFx0XHRcdFx0bGluazogJ2ZpbGU6Ly8vYyUzQS9mb2xkZXIvZm9vL2Jhci50eHQnLFxuXHRcdFx0XHRcdHNvdXJjZTogJ2VkaXRvcicsXG5cdFx0XHRcdFx0c2VsZWN0aW9uOiB7XG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogNSxcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMTAsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhd2FpdCBvcGVuZXIub3Blbih7XG5cdFx0XHRcdFx0dGV4dDogJy5cXFxcZm9vXFxcXGJhci50eHQ6MTA6ICcsXG5cdFx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRcdGxpbms6ICdmaWxlOi8vL2MlM0EvZm9sZGVyL2Zvby9iYXIudHh0Jyxcblx0XHRcdFx0XHRzb3VyY2U6ICdlZGl0b3InLFxuXHRcdFx0XHRcdHNlbGVjdGlvbjoge1xuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDEwLFxuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdzaG91bGQgZXh0cmFjdCBsaW5lIG51bWJlcnMgZnJvbSBsaW5rcyBhbmQgcmVtb3ZlIHJ1Ynkgc3RhY2sgdHJhY2VzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRsb2NhbEZpbGVPcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvY2FsRmlsZUxpbmtPcGVuZXIpO1xuXHRcdFx0XHRjb25zdCBsb2NhbEZvbGRlck9wZW5lciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTG9jYWxGb2xkZXJJbldvcmtzcGFjZUxpbmtPcGVuZXIpO1xuXHRcdFx0XHRvcGVuZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VGVybWluYWxTZWFyY2hMaW5rT3BlbmVyLCBjYXBhYmlsaXRpZXMsICdjOi9mb2xkZXInLCBsb2NhbEZpbGVPcGVuZXIsIGxvY2FsRm9sZGVyT3BlbmVyLCAoKSA9PiBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cyk7XG5cdFx0XHRcdGZpbGVTZXJ2aWNlLnNldEZpbGVzKFtcblx0XHRcdFx0XHRVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBwYXRoOiAnYzovZm9sZGVyL2Zvby9iYXIucmInIH0pXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRhd2FpdCBvcGVuZXIub3Blbih7XG5cdFx0XHRcdFx0dGV4dDogJy4vZm9vL2Jhci5yYjozMDppbiBgPG1haW4+YCcsXG5cdFx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRcdGxpbms6ICdmaWxlOi8vL2MlM0EvZm9sZGVyL2Zvby9iYXIucmInLFxuXHRcdFx0XHRcdHNvdXJjZTogJ2VkaXRvcicsXG5cdFx0XHRcdFx0c2VsZWN0aW9uOiB7XG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogMSwgLy8gU2luY2UgUnVieSBkb2Vzbid0IGFwcGVhciB0byBwdXQgY29sdW1ucyBpbiBzdGFjayB0cmFjZXMsIHRoaXMgc2hvdWxkIGJlIDFcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMzAsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhd2FpdCBvcGVuZXIub3Blbih7XG5cdFx0XHRcdFx0dGV4dDogJy5cXFxcZm9vXFxcXGJhci5yYjozMDppbiBgPG1haW4+YCcsXG5cdFx0XHRcdFx0YnVmZmVyUmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogOCwgeTogMSB9IH0sXG5cdFx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoYWN0aXZhdGlvblJlc3VsdCwge1xuXHRcdFx0XHRcdGxpbms6ICdmaWxlOi8vL2MlM0EvZm9sZGVyL2Zvby9iYXIucmInLFxuXHRcdFx0XHRcdHNvdXJjZTogJ2VkaXRvcicsXG5cdFx0XHRcdFx0c2VsZWN0aW9uOiB7XG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogMSwgLy8gU2luY2UgUnVieSBkb2Vzbid0IGFwcGVhciB0byBwdXQgY29sdW1ucyBpbiBzdGFjayB0cmFjZXMsIHRoaXMgc2hvdWxkIGJlIDFcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMzAsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxXQUFXO0FBRXBCLFNBQVMsb0JBQWtEO0FBQzNELFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsYUFBYSxzQkFBc0I7QUFD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QUFBQSxZQUNiLGlCQUFpQjtBQUFBLFlBQ2pCLFdBQVc7QUFBQSxZQUNYLGVBQWU7QUFBQSxVQUNoQjtBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0YsQ0FBQztBQUVELFdBQUssdUVBQXVFLFlBQVk7QUFDdkYsMEJBQWtCLHFCQUFxQixlQUFlLDJCQUEyQjtBQUNqRixjQUFNLG9CQUFvQixxQkFBcUIsZUFBZSx3Q0FBd0M7QUFDdEcsaUJBQVMscUJBQXFCLGVBQWUsOEJBQThCLGNBQWMsYUFBYSxpQkFBaUIsbUJBQW1CLE1BQU0sZ0JBQWdCLE9BQU87QUFDdkssb0JBQVksU0FBUztBQUFBLFVBQ3BCLElBQUksS0FBSyxFQUFFLFFBQVEsUUFBUSxNQUFNLE1BQU0sdUJBQXVCLENBQUM7QUFBQSxRQUNoRSxDQUFDO0FBQ0QsY0FBTSxPQUFPLEtBQUs7QUFBQSxVQUNqQixNQUFNO0FBQUEsVUFDTixhQUFhLEVBQUUsT0FBTyxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxLQUFLLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxFQUFFO0FBQUEsVUFDMUQsTUFBTSx3QkFBd0I7QUFBQSxRQUMvQixDQUFDO0FBQ0Qsd0JBQWdCLGtCQUFrQjtBQUFBLFVBQ2pDLE1BQU07QUFBQSxVQUNOLFFBQVE7QUFBQSxVQUNSLFdBQVc7QUFBQSxZQUNWLGFBQWE7QUFBQTtBQUFBLFlBQ2IsaUJBQWlCO0FBQUEsWUFDakIsV0FBVztBQUFBLFlBQ1gsZUFBZTtBQUFBLFVBQ2hCO0FBQUEsUUFDRCxDQUFDO0FBQ0QsY0FBTSxPQUFPLEtBQUs7QUFBQSxVQUNqQixNQUFNO0FBQUEsVUFDTixhQUFhLEVBQUUsT0FBTyxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxLQUFLLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxFQUFFO0FBQUEsVUFDMUQsTUFBTSx3QkFBd0I7QUFBQSxRQUMvQixDQUFDO0FBQ0Qsd0JBQWdCLGtCQUFrQjtBQUFBLFVBQ2pDLE1BQU07QUFBQSxVQUNOLFFBQVE7QUFBQSxVQUNSLFdBQVc7QUFBQSxZQUNWLGFBQWE7QUFBQTtBQUFBLFlBQ2IsaUJBQWlCO0FBQUEsWUFDakIsV0FBVztBQUFBLFlBQ1gsZUFBZTtBQUFBLFVBQ2hCO0FBQUEsUUFDRCxDQUFDO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRixDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
