import assert from "assert";
import * as sinon from "sinon";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { sep } from "../../../../../base/common/path.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { extUriBiasedIgnorePathCase } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Selection } from "../../../../common/core/selection.js";
import { SnippetParser } from "../../browser/snippetParser.js";
import { ClipboardBasedVariableResolver, CompositeSnippetVariableResolver, ModelBasedVariableResolver, SelectionBasedVariableResolver, TimeBasedVariableResolver, WorkspaceBasedVariableResolver } from "../../browser/snippetVariables.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
import { toWorkspaceFolder } from "../../../../../platform/workspace/common/workspace.js";
import { Workspace } from "../../../../../platform/workspace/test/common/testWorkspace.js";
import { toWorkspaceFolders } from "../../../../../platform/workspaces/common/workspaces.js";
suite("Snippet Variables Resolver", function() {
  const labelService = new class extends mock() {
    getUriLabel(uri) {
      return uri.fsPath;
    }
  }();
  let model;
  let resolver;
  setup(function() {
    model = createTextModel([
      "this is line one",
      "this is line two",
      "    this is line three"
    ].join("\n"), void 0, void 0, URI.parse("file:///foo/files/text.txt"));
    resolver = new CompositeSnippetVariableResolver([
      new ModelBasedVariableResolver(labelService, model),
      new SelectionBasedVariableResolver(model, new Selection(1, 1, 1, 1), 0, void 0)
    ]);
  });
  teardown(function() {
    model.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  function assertVariableResolve(resolver2, varName, expected) {
    const snippet = new SnippetParser().parse(`$${varName}`);
    const variable = snippet.children[0];
    variable.resolve(resolver2);
    if (variable.children.length === 0) {
      assert.strictEqual(void 0, expected);
    } else {
      assert.strictEqual(variable.toString(), expected);
    }
  }
  test("editor variables, basics", function() {
    assertVariableResolve(resolver, "TM_FILENAME", "text.txt");
    assertVariableResolve(resolver, "something", void 0);
  });
  test("editor variables, file/dir", function() {
    const disposables = new DisposableStore();
    assertVariableResolve(resolver, "TM_FILENAME", "text.txt");
    if (!isWindows) {
      assertVariableResolve(resolver, "TM_DIRECTORY", "/foo/files");
      assertVariableResolve(resolver, "TM_FILEPATH", "/foo/files/text.txt");
    }
    resolver = new ModelBasedVariableResolver(
      labelService,
      disposables.add(createTextModel("", void 0, void 0, URI.parse("http://www.pb.o/abc/def/ghi")))
    );
    assertVariableResolve(resolver, "TM_FILENAME", "ghi");
    if (!isWindows) {
      assertVariableResolve(resolver, "TM_DIRECTORY", "/abc/def");
      assertVariableResolve(resolver, "TM_FILEPATH", "/abc/def/ghi");
    }
    resolver = new ModelBasedVariableResolver(
      labelService,
      disposables.add(createTextModel("", void 0, void 0, URI.parse("mem:fff.ts")))
    );
    assertVariableResolve(resolver, "TM_DIRECTORY", "");
    assertVariableResolve(resolver, "TM_FILEPATH", "fff.ts");
    disposables.dispose();
  });
  test("Path delimiters in code snippet variables aren't specific to remote OS #76840", function() {
    const labelService2 = new class extends mock() {
      getUriLabel(uri) {
        return uri.fsPath.replace(/\/|\\/g, "|");
      }
    }();
    const model2 = createTextModel([].join("\n"), void 0, void 0, URI.parse("foo:///foo/files/text.txt"));
    const resolver2 = new CompositeSnippetVariableResolver([new ModelBasedVariableResolver(labelService2, model2)]);
    assertVariableResolve(resolver2, "TM_FILEPATH", "|foo|files|text.txt");
    model2.dispose();
  });
  test("editor variables, selection", function() {
    resolver = new SelectionBasedVariableResolver(model, new Selection(1, 2, 2, 3), 0, void 0);
    assertVariableResolve(resolver, "TM_SELECTED_TEXT", "his is line one\nth");
    assertVariableResolve(resolver, "TM_CURRENT_LINE", "this is line two");
    assertVariableResolve(resolver, "TM_LINE_INDEX", "1");
    assertVariableResolve(resolver, "TM_LINE_NUMBER", "2");
    assertVariableResolve(resolver, "CURSOR_INDEX", "0");
    assertVariableResolve(resolver, "CURSOR_NUMBER", "1");
    resolver = new SelectionBasedVariableResolver(model, new Selection(1, 2, 2, 3), 4, void 0);
    assertVariableResolve(resolver, "CURSOR_INDEX", "4");
    assertVariableResolve(resolver, "CURSOR_NUMBER", "5");
    resolver = new SelectionBasedVariableResolver(model, new Selection(2, 3, 1, 2), 0, void 0);
    assertVariableResolve(resolver, "TM_SELECTED_TEXT", "his is line one\nth");
    assertVariableResolve(resolver, "TM_CURRENT_LINE", "this is line one");
    assertVariableResolve(resolver, "TM_LINE_INDEX", "0");
    assertVariableResolve(resolver, "TM_LINE_NUMBER", "1");
    resolver = new SelectionBasedVariableResolver(model, new Selection(1, 2, 1, 2), 0, void 0);
    assertVariableResolve(resolver, "TM_SELECTED_TEXT", void 0);
    assertVariableResolve(resolver, "TM_CURRENT_WORD", "this");
    resolver = new SelectionBasedVariableResolver(model, new Selection(3, 1, 3, 1), 0, void 0);
    assertVariableResolve(resolver, "TM_CURRENT_WORD", void 0);
  });
  test("TextmateSnippet, resolve variable", function() {
    const snippet = new SnippetParser().parse('"$TM_CURRENT_WORD"', true);
    assert.strictEqual(snippet.toString(), '""');
    snippet.resolveVariables(resolver);
    assert.strictEqual(snippet.toString(), '"this"');
  });
  test("TextmateSnippet, resolve variable with default", function() {
    const snippet = new SnippetParser().parse('"${TM_CURRENT_WORD:foo}"', true);
    assert.strictEqual(snippet.toString(), '"foo"');
    snippet.resolveVariables(resolver);
    assert.strictEqual(snippet.toString(), '"this"');
  });
  test("More useful environment variables for snippets, #32737", function() {
    const disposables = new DisposableStore();
    assertVariableResolve(resolver, "TM_FILENAME_BASE", "text");
    resolver = new ModelBasedVariableResolver(
      labelService,
      disposables.add(createTextModel("", void 0, void 0, URI.parse("http://www.pb.o/abc/def/ghi")))
    );
    assertVariableResolve(resolver, "TM_FILENAME_BASE", "ghi");
    resolver = new ModelBasedVariableResolver(
      labelService,
      disposables.add(createTextModel("", void 0, void 0, URI.parse("mem:.git")))
    );
    assertVariableResolve(resolver, "TM_FILENAME_BASE", ".git");
    resolver = new ModelBasedVariableResolver(
      labelService,
      disposables.add(createTextModel("", void 0, void 0, URI.parse("mem:foo.")))
    );
    assertVariableResolve(resolver, "TM_FILENAME_BASE", "foo");
    disposables.dispose();
  });
  function assertVariableResolve2(input, expected, varValue) {
    const snippet = new SnippetParser().parse(input).resolveVariables({ resolve(variable) {
      return varValue || variable.name;
    } });
    const actual = snippet.toString();
    assert.strictEqual(actual, expected);
  }
  test("Variable Snippet Transform", function() {
    const snippet = new SnippetParser().parse("name=${TM_FILENAME/(.*)\\..+$/$1/}", true);
    snippet.resolveVariables(resolver);
    assert.strictEqual(snippet.toString(), "name=text");
    assertVariableResolve2("${ThisIsAVar/([A-Z]).*(Var)/$2/}", "Var");
    assertVariableResolve2("${ThisIsAVar/([A-Z]).*(Var)/$2-${1:/downcase}/}", "Var-t");
    assertVariableResolve2("${Foo/(.*)/${1:+Bar}/img}", "Bar");
    assertVariableResolve2("export default class ${TM_FILENAME/(\\w+)\\.js/$1/g}", "export default class FooFile", "FooFile.js");
    assertVariableResolve2("${foobarfoobar/(foo)/${1:+FAR}/g}", "FARbarFARbar");
    assertVariableResolve2("${foobarfoobar/(foo)/${1:+FAR}/}", "FARbarfoobar");
    assertVariableResolve2("${foobarfoobar/(bazz)/${1:+FAR}/g}", "foobarfoobar");
    assertVariableResolve2("${foobarfoobar/(foo)/${2:+FAR}/g}", "barbar");
  });
  test("Snippet transforms do not handle regex with alternatives or optional matches, #36089", function() {
    assertVariableResolve2(
      "${TM_FILENAME/^(.)|(?:-(.))|(\\.js)/${1:/upcase}${2:/upcase}/g}",
      "MyClass",
      "my-class.js"
    );
    assertVariableResolve2(
      "${TM_FILENAME/^(.)|(?:-(.))|(\\.js)/${1:/upcase}${2:/upcase}/g}",
      "Myclass",
      "myclass.js"
    );
    assertVariableResolve2(
      "${TM_FILENAME/^(.)|(?:-(.))|(\\.js)/${1:/upcase}${2:/upcase}/g}",
      "Myclass.foo",
      "myclass.foo"
    );
    assertVariableResolve2(
      "${TM_FILENAME/^(.)|(?:-(.))|(\\.js)/${1:/upcase}${2:/upcase}/g}",
      "ThisIsAFile",
      "this-is-a-file.js"
    );
    assertVariableResolve2(
      "${TM_FILENAME_BASE/([A-Z][a-z]+)([A-Z][a-z]+$)?/${1:/downcase}-${2:/downcase}/g}",
      "capital-case",
      "CapitalCase"
    );
    assertVariableResolve2(
      "${TM_FILENAME_BASE/([A-Z][a-z]+)([A-Z][a-z]+$)?/${1:/downcase}-${2:/downcase}/g}",
      "capital-case-more",
      "CapitalCaseMore"
    );
  });
  test("Add variable to insert value from clipboard to a snippet #40153", function() {
    assertVariableResolve(new ClipboardBasedVariableResolver(() => void 0, 1, 0, true), "CLIPBOARD", void 0);
    assertVariableResolve(new ClipboardBasedVariableResolver(() => null, 1, 0, true), "CLIPBOARD", void 0);
    assertVariableResolve(new ClipboardBasedVariableResolver(() => "", 1, 0, true), "CLIPBOARD", void 0);
    assertVariableResolve(new ClipboardBasedVariableResolver(() => "foo", 1, 0, true), "CLIPBOARD", "foo");
    assertVariableResolve(new ClipboardBasedVariableResolver(() => "foo", 1, 0, true), "foo", void 0);
    assertVariableResolve(new ClipboardBasedVariableResolver(() => "foo", 1, 0, true), "cLIPBOARD", void 0);
  });
  test("Add variable to insert value from clipboard to a snippet #40153, 2", function() {
    assertVariableResolve(new ClipboardBasedVariableResolver(() => "line1", 1, 2, true), "CLIPBOARD", "line1");
    assertVariableResolve(new ClipboardBasedVariableResolver(() => "line1\nline2\nline3", 1, 2, true), "CLIPBOARD", "line1\nline2\nline3");
    assertVariableResolve(new ClipboardBasedVariableResolver(() => "line1\nline2", 1, 2, true), "CLIPBOARD", "line2");
    resolver = new ClipboardBasedVariableResolver(() => "line1\nline2", 0, 2, true);
    assertVariableResolve(new ClipboardBasedVariableResolver(() => "line1\nline2", 0, 2, true), "CLIPBOARD", "line1");
    assertVariableResolve(new ClipboardBasedVariableResolver(() => "line1\nline2", 0, 2, false), "CLIPBOARD", "line1\nline2");
  });
  function assertVariableResolve3(resolver2, varName) {
    const snippet = new SnippetParser().parse(`$${varName}`);
    const variable = snippet.children[0];
    assert.strictEqual(variable.resolve(resolver2), true, `${varName} failed to resolve`);
  }
  test("Add time variables for snippets #41631, #43140", function() {
    const resolver2 = new TimeBasedVariableResolver();
    assertVariableResolve3(resolver2, "CURRENT_YEAR");
    assertVariableResolve3(resolver2, "CURRENT_YEAR_SHORT");
    assertVariableResolve3(resolver2, "CURRENT_MONTH");
    assertVariableResolve3(resolver2, "CURRENT_DATE");
    assertVariableResolve3(resolver2, "CURRENT_HOUR");
    assertVariableResolve3(resolver2, "CURRENT_MINUTE");
    assertVariableResolve3(resolver2, "CURRENT_SECOND");
    assertVariableResolve3(resolver2, "CURRENT_DAY_NAME");
    assertVariableResolve3(resolver2, "CURRENT_DAY_NAME_SHORT");
    assertVariableResolve3(resolver2, "CURRENT_MONTH_NAME");
    assertVariableResolve3(resolver2, "CURRENT_MONTH_NAME_SHORT");
    assertVariableResolve3(resolver2, "CURRENT_SECONDS_UNIX");
    assertVariableResolve3(resolver2, "CURRENT_TIMEZONE_OFFSET");
  });
  test("Time-based snippet variables resolve to the same values even as time progresses", async function() {
    const snippetText = `
			$CURRENT_YEAR
			$CURRENT_YEAR_SHORT
			$CURRENT_MONTH
			$CURRENT_DATE
			$CURRENT_HOUR
			$CURRENT_MINUTE
			$CURRENT_SECOND
			$CURRENT_DAY_NAME
			$CURRENT_DAY_NAME_SHORT
			$CURRENT_MONTH_NAME
			$CURRENT_MONTH_NAME_SHORT
			$CURRENT_SECONDS_UNIX
			$CURRENT_TIMEZONE_OFFSET
		`;
    const clock = sinon.useFakeTimers();
    try {
      const resolver2 = new TimeBasedVariableResolver();
      const firstResolve = new SnippetParser().parse(snippetText).resolveVariables(resolver2);
      clock.tick(365 * 24 * 3600 * 1e3 + 24 * 3600 * 1e3 + 3661 * 1e3);
      const secondResolve = new SnippetParser().parse(snippetText).resolveVariables(resolver2);
      assert.strictEqual(firstResolve.toString(), secondResolve.toString(), `Time-based snippet variables resolved differently`);
    } finally {
      clock.restore();
    }
  });
  test("creating snippet - format-condition doesn't work #53617", function() {
    const snippet = new SnippetParser().parse("${TM_LINE_NUMBER/(10)/${1:?It is:It is not}/} line 10", true);
    snippet.resolveVariables({ resolve() {
      return "10";
    } });
    assert.strictEqual(snippet.toString(), "It is line 10");
    snippet.resolveVariables({ resolve() {
      return "11";
    } });
    assert.strictEqual(snippet.toString(), "It is not line 10");
  });
  test("Add workspace name and folder variables for snippets #68261", function() {
    let workspace;
    const workspaceService = new class {
      constructor() {
        this._throw = () => {
          throw new Error();
        };
        this.onDidChangeWorkbenchState = this._throw;
        this.onDidChangeWorkspaceName = this._throw;
        this.onWillChangeWorkspaceFolders = this._throw;
        this.onDidChangeWorkspaceFolders = this._throw;
        this.getCompleteWorkspace = this._throw;
        this.getWorkbenchState = this._throw;
        this.getWorkspaceFolder = this._throw;
        this.isCurrentWorkspace = this._throw;
        this.isInsideWorkspace = this._throw;
      }
      getWorkspace() {
        return workspace;
      }
    }();
    const resolver2 = new WorkspaceBasedVariableResolver(workspaceService);
    workspace = new Workspace("");
    assertVariableResolve(resolver2, "WORKSPACE_NAME", void 0);
    assertVariableResolve(resolver2, "WORKSPACE_FOLDER", void 0);
    workspace = new Workspace("", [toWorkspaceFolder(URI.file("/folderName"))]);
    assertVariableResolve(resolver2, "WORKSPACE_NAME", "folderName");
    if (!isWindows) {
      assertVariableResolve(resolver2, "WORKSPACE_FOLDER", "/folderName");
    }
    const workspaceConfigPath = URI.file("testWorkspace.code-workspace");
    workspace = new Workspace("", toWorkspaceFolders([{ path: "folderName" }], workspaceConfigPath, extUriBiasedIgnorePathCase), workspaceConfigPath);
    assertVariableResolve(resolver2, "WORKSPACE_NAME", "testWorkspace");
    if (!isWindows) {
      assertVariableResolve(resolver2, "WORKSPACE_FOLDER", "/");
    }
  });
  test("Add RELATIVE_FILEPATH snippet variable #114208", function() {
    let resolver2;
    const workspaceLabelService = (rootPath) => {
      const labelService2 = new class extends mock() {
        getUriLabel(uri, options = {}) {
          const rootFsPath = URI.file(rootPath).fsPath + sep;
          const fsPath = uri.fsPath;
          if (options.relative && rootPath && fsPath.startsWith(rootFsPath)) {
            return fsPath.substring(rootFsPath.length);
          }
          return fsPath;
        }
      }();
      return labelService2;
    };
    const model2 = createTextModel("", void 0, void 0, URI.parse("file:///foo/files/text.txt"));
    resolver2 = new ModelBasedVariableResolver(
      workspaceLabelService(""),
      model2
    );
    if (!isWindows) {
      assertVariableResolve(resolver2, "RELATIVE_FILEPATH", "/foo/files/text.txt");
    } else {
      assertVariableResolve(resolver2, "RELATIVE_FILEPATH", "\\foo\\files\\text.txt");
    }
    resolver2 = new ModelBasedVariableResolver(
      workspaceLabelService("/foo"),
      model2
    );
    if (!isWindows) {
      assertVariableResolve(resolver2, "RELATIVE_FILEPATH", "files/text.txt");
    } else {
      assertVariableResolve(resolver2, "RELATIVE_FILEPATH", "files\\text.txt");
    }
    model2.dispose();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zbmlwcGV0L3Rlc3QvYnJvd3Nlci9zbmlwcGV0VmFyaWFibGVzLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0ICogYXMgc2lub24gZnJvbSAnc2lub24nO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHNlcCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZXh0VXJpQmlhc2VkSWdub3JlUGF0aENhc2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IG1vY2sgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL21vY2suanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0UGFyc2VyLCBWYXJpYWJsZSwgVmFyaWFibGVSZXNvbHZlciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc25pcHBldFBhcnNlci5qcyc7XG5pbXBvcnQgeyBDbGlwYm9hcmRCYXNlZFZhcmlhYmxlUmVzb2x2ZXIsIENvbXBvc2l0ZVNuaXBwZXRWYXJpYWJsZVJlc29sdmVyLCBNb2RlbEJhc2VkVmFyaWFibGVSZXNvbHZlciwgU2VsZWN0aW9uQmFzZWRWYXJpYWJsZVJlc29sdmVyLCBUaW1lQmFzZWRWYXJpYWJsZVJlc29sdmVyLCBXb3Jrc3BhY2VCYXNlZFZhcmlhYmxlUmVzb2x2ZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL3NuaXBwZXRWYXJpYWJsZXMuanMnO1xuaW1wb3J0IHsgY3JlYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2UsIElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgdG9Xb3Jrc3BhY2VGb2xkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBXb3Jrc3BhY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvdGVzdC9jb21tb24vdGVzdFdvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyB0b1dvcmtzcGFjZUZvbGRlcnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2VzL2NvbW1vbi93b3Jrc3BhY2VzLmpzJztcblxuc3VpdGUoJ1NuaXBwZXQgVmFyaWFibGVzIFJlc29sdmVyJywgZnVuY3Rpb24gKCkge1xuXG5cblx0Y29uc3QgbGFiZWxTZXJ2aWNlID0gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTGFiZWxTZXJ2aWNlPigpIHtcblx0XHRvdmVycmlkZSBnZXRVcmlMYWJlbCh1cmk6IFVSSSkge1xuXHRcdFx0cmV0dXJuIHVyaS5mc1BhdGg7XG5cdFx0fVxuXHR9O1xuXG5cdGxldCBtb2RlbDogVGV4dE1vZGVsO1xuXHRsZXQgcmVzb2x2ZXI6IFZhcmlhYmxlUmVzb2x2ZXI7XG5cblx0c2V0dXAoZnVuY3Rpb24gKCkge1xuXHRcdG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFtcblx0XHRcdCd0aGlzIGlzIGxpbmUgb25lJyxcblx0XHRcdCd0aGlzIGlzIGxpbmUgdHdvJyxcblx0XHRcdCcgICAgdGhpcyBpcyBsaW5lIHRocmVlJ1xuXHRcdF0uam9pbignXFxuJyksIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBVUkkucGFyc2UoJ2ZpbGU6Ly8vZm9vL2ZpbGVzL3RleHQudHh0JykpO1xuXG5cdFx0cmVzb2x2ZXIgPSBuZXcgQ29tcG9zaXRlU25pcHBldFZhcmlhYmxlUmVzb2x2ZXIoW1xuXHRcdFx0bmV3IE1vZGVsQmFzZWRWYXJpYWJsZVJlc29sdmVyKGxhYmVsU2VydmljZSwgbW9kZWwpLFxuXHRcdFx0bmV3IFNlbGVjdGlvbkJhc2VkVmFyaWFibGVSZXNvbHZlcihtb2RlbCwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSwgMCwgdW5kZWZpbmVkKSxcblx0XHRdKTtcblx0fSk7XG5cblx0dGVhcmRvd24oZnVuY3Rpb24gKCkge1xuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblxuXHRmdW5jdGlvbiBhc3NlcnRWYXJpYWJsZVJlc29sdmUocmVzb2x2ZXI6IFZhcmlhYmxlUmVzb2x2ZXIsIHZhck5hbWU6IHN0cmluZywgZXhwZWN0ZWQ/OiBzdHJpbmcpIHtcblx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZShgJCR7dmFyTmFtZX1gKTtcblx0XHRjb25zdCB2YXJpYWJsZSA9IDxWYXJpYWJsZT5zbmlwcGV0LmNoaWxkcmVuWzBdO1xuXHRcdHZhcmlhYmxlLnJlc29sdmUocmVzb2x2ZXIpO1xuXHRcdGlmICh2YXJpYWJsZS5jaGlsZHJlbi5sZW5ndGggPT09IDApIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmRlZmluZWQsIGV4cGVjdGVkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhcmlhYmxlLnRvU3RyaW5nKCksIGV4cGVjdGVkKTtcblx0XHR9XG5cdH1cblxuXHR0ZXN0KCdlZGl0b3IgdmFyaWFibGVzLCBiYXNpY3MnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKHJlc29sdmVyLCAnVE1fRklMRU5BTUUnLCAndGV4dC50eHQnKTtcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUocmVzb2x2ZXIsICdzb21ldGhpbmcnLCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdlZGl0b3IgdmFyaWFibGVzLCBmaWxlL2RpcicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKHJlc29sdmVyLCAnVE1fRklMRU5BTUUnLCAndGV4dC50eHQnKTtcblx0XHRpZiAoIWlzV2luZG93cykge1xuXHRcdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKHJlc29sdmVyLCAnVE1fRElSRUNUT1JZJywgJy9mb28vZmlsZXMnKTtcblx0XHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ1RNX0ZJTEVQQVRIJywgJy9mb28vZmlsZXMvdGV4dC50eHQnKTtcblx0XHR9XG5cblx0XHRyZXNvbHZlciA9IG5ldyBNb2RlbEJhc2VkVmFyaWFibGVSZXNvbHZlcihcblx0XHRcdGxhYmVsU2VydmljZSxcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXh0TW9kZWwoJycsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBVUkkucGFyc2UoJ2h0dHA6Ly93d3cucGIuby9hYmMvZGVmL2doaScpKSlcblx0XHQpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ1RNX0ZJTEVOQU1FJywgJ2doaScpO1xuXHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUocmVzb2x2ZXIsICdUTV9ESVJFQ1RPUlknLCAnL2FiYy9kZWYnKTtcblx0XHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ1RNX0ZJTEVQQVRIJywgJy9hYmMvZGVmL2doaScpO1xuXHRcdH1cblxuXHRcdHJlc29sdmVyID0gbmV3IE1vZGVsQmFzZWRWYXJpYWJsZVJlc29sdmVyKFxuXHRcdFx0bGFiZWxTZXJ2aWNlLFxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZVRleHRNb2RlbCgnJywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIFVSSS5wYXJzZSgnbWVtOmZmZi50cycpKSlcblx0XHQpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ1RNX0RJUkVDVE9SWScsICcnKTtcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUocmVzb2x2ZXIsICdUTV9GSUxFUEFUSCcsICdmZmYudHMnKTtcblxuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnUGF0aCBkZWxpbWl0ZXJzIGluIGNvZGUgc25pcHBldCB2YXJpYWJsZXMgYXJlblxcJ3Qgc3BlY2lmaWMgdG8gcmVtb3RlIE9TICM3Njg0MCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGxhYmVsU2VydmljZSA9IG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUxhYmVsU2VydmljZT4oKSB7XG5cdFx0XHRvdmVycmlkZSBnZXRVcmlMYWJlbCh1cmk6IFVSSSkge1xuXHRcdFx0XHRyZXR1cm4gdXJpLmZzUGF0aC5yZXBsYWNlKC9cXC98XFxcXC9nLCAnfCcpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXS5qb2luKCdcXG4nKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIFVSSS5wYXJzZSgnZm9vOi8vL2Zvby9maWxlcy90ZXh0LnR4dCcpKTtcblxuXHRcdGNvbnN0IHJlc29sdmVyID0gbmV3IENvbXBvc2l0ZVNuaXBwZXRWYXJpYWJsZVJlc29sdmVyKFtuZXcgTW9kZWxCYXNlZFZhcmlhYmxlUmVzb2x2ZXIobGFiZWxTZXJ2aWNlLCBtb2RlbCldKTtcblxuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ1RNX0ZJTEVQQVRIJywgJ3xmb298ZmlsZXN8dGV4dC50eHQnKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZWRpdG9yIHZhcmlhYmxlcywgc2VsZWN0aW9uJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0cmVzb2x2ZXIgPSBuZXcgU2VsZWN0aW9uQmFzZWRWYXJpYWJsZVJlc29sdmVyKG1vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDIsIDIsIDMpLCAwLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ1RNX1NFTEVDVEVEX1RFWFQnLCAnaGlzIGlzIGxpbmUgb25lXFxudGgnKTtcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUocmVzb2x2ZXIsICdUTV9DVVJSRU5UX0xJTkUnLCAndGhpcyBpcyBsaW5lIHR3bycpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ1RNX0xJTkVfSU5ERVgnLCAnMScpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ1RNX0xJTkVfTlVNQkVSJywgJzInKTtcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUocmVzb2x2ZXIsICdDVVJTT1JfSU5ERVgnLCAnMCcpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ0NVUlNPUl9OVU1CRVInLCAnMScpO1xuXG5cdFx0cmVzb2x2ZXIgPSBuZXcgU2VsZWN0aW9uQmFzZWRWYXJpYWJsZVJlc29sdmVyKG1vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDIsIDIsIDMpLCA0LCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ0NVUlNPUl9JTkRFWCcsICc0Jyk7XG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKHJlc29sdmVyLCAnQ1VSU09SX05VTUJFUicsICc1Jyk7XG5cblx0XHRyZXNvbHZlciA9IG5ldyBTZWxlY3Rpb25CYXNlZFZhcmlhYmxlUmVzb2x2ZXIobW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgMywgMSwgMiksIDAsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKHJlc29sdmVyLCAnVE1fU0VMRUNURURfVEVYVCcsICdoaXMgaXMgbGluZSBvbmVcXG50aCcpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ1RNX0NVUlJFTlRfTElORScsICd0aGlzIGlzIGxpbmUgb25lJyk7XG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKHJlc29sdmVyLCAnVE1fTElORV9JTkRFWCcsICcwJyk7XG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKHJlc29sdmVyLCAnVE1fTElORV9OVU1CRVInLCAnMScpO1xuXG5cdFx0cmVzb2x2ZXIgPSBuZXcgU2VsZWN0aW9uQmFzZWRWYXJpYWJsZVJlc29sdmVyKG1vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpLCAwLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ1RNX1NFTEVDVEVEX1RFWFQnLCB1bmRlZmluZWQpO1xuXG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKHJlc29sdmVyLCAnVE1fQ1VSUkVOVF9XT1JEJywgJ3RoaXMnKTtcblxuXHRcdHJlc29sdmVyID0gbmV3IFNlbGVjdGlvbkJhc2VkVmFyaWFibGVSZXNvbHZlcihtb2RlbCwgbmV3IFNlbGVjdGlvbigzLCAxLCAzLCAxKSwgMCwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUocmVzb2x2ZXIsICdUTV9DVVJSRU5UX1dPUkQnLCB1bmRlZmluZWQpO1xuXG5cdH0pO1xuXG5cdHRlc3QoJ1RleHRtYXRlU25pcHBldCwgcmVzb2x2ZSB2YXJpYWJsZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnXCIkVE1fQ1VSUkVOVF9XT1JEXCInLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldC50b1N0cmluZygpLCAnXCJcIicpO1xuXHRcdHNuaXBwZXQucmVzb2x2ZVZhcmlhYmxlcyhyZXNvbHZlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuaXBwZXQudG9TdHJpbmcoKSwgJ1widGhpc1wiJyk7XG5cblx0fSk7XG5cblx0dGVzdCgnVGV4dG1hdGVTbmlwcGV0LCByZXNvbHZlIHZhcmlhYmxlIHdpdGggZGVmYXVsdCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnXCIke1RNX0NVUlJFTlRfV09SRDpmb299XCInLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldC50b1N0cmluZygpLCAnXCJmb29cIicpO1xuXHRcdHNuaXBwZXQucmVzb2x2ZVZhcmlhYmxlcyhyZXNvbHZlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuaXBwZXQudG9TdHJpbmcoKSwgJ1widGhpc1wiJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ01vcmUgdXNlZnVsIGVudmlyb25tZW50IHZhcmlhYmxlcyBmb3Igc25pcHBldHMsICMzMjczNycsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKHJlc29sdmVyLCAnVE1fRklMRU5BTUVfQkFTRScsICd0ZXh0Jyk7XG5cblx0XHRyZXNvbHZlciA9IG5ldyBNb2RlbEJhc2VkVmFyaWFibGVSZXNvbHZlcihcblx0XHRcdGxhYmVsU2VydmljZSxcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXh0TW9kZWwoJycsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBVUkkucGFyc2UoJ2h0dHA6Ly93d3cucGIuby9hYmMvZGVmL2doaScpKSlcblx0XHQpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ1RNX0ZJTEVOQU1FX0JBU0UnLCAnZ2hpJyk7XG5cblx0XHRyZXNvbHZlciA9IG5ldyBNb2RlbEJhc2VkVmFyaWFibGVSZXNvbHZlcihcblx0XHRcdGxhYmVsU2VydmljZSxcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXh0TW9kZWwoJycsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBVUkkucGFyc2UoJ21lbTouZ2l0JykpKVxuXHRcdCk7XG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKHJlc29sdmVyLCAnVE1fRklMRU5BTUVfQkFTRScsICcuZ2l0Jyk7XG5cblx0XHRyZXNvbHZlciA9IG5ldyBNb2RlbEJhc2VkVmFyaWFibGVSZXNvbHZlcihcblx0XHRcdGxhYmVsU2VydmljZSxcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXh0TW9kZWwoJycsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBVUkkucGFyc2UoJ21lbTpmb28uJykpKVxuXHRcdCk7XG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKHJlc29sdmVyLCAnVE1fRklMRU5BTUVfQkFTRScsICdmb28nKTtcblxuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblxuXHRmdW5jdGlvbiBhc3NlcnRWYXJpYWJsZVJlc29sdmUyKGlucHV0OiBzdHJpbmcsIGV4cGVjdGVkOiBzdHJpbmcsIHZhclZhbHVlPzogc3RyaW5nKSB7XG5cdFx0Y29uc3Qgc25pcHBldCA9IG5ldyBTbmlwcGV0UGFyc2VyKCkucGFyc2UoaW5wdXQpXG5cdFx0XHQucmVzb2x2ZVZhcmlhYmxlcyh7IHJlc29sdmUodmFyaWFibGUpIHsgcmV0dXJuIHZhclZhbHVlIHx8IHZhcmlhYmxlLm5hbWU7IH0gfSk7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBzbmlwcGV0LnRvU3RyaW5nKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHR9XG5cblx0dGVzdCgnVmFyaWFibGUgU25pcHBldCBUcmFuc2Zvcm0nLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnbmFtZT0ke1RNX0ZJTEVOQU1FLyguKilcXFxcLi4rJC8kMS99JywgdHJ1ZSk7XG5cdFx0c25pcHBldC5yZXNvbHZlVmFyaWFibGVzKHJlc29sdmVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldC50b1N0cmluZygpLCAnbmFtZT10ZXh0Jyk7XG5cblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUyKCcke1RoaXNJc0FWYXIvKFtBLVpdKS4qKFZhcikvJDIvfScsICdWYXInKTtcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUyKCcke1RoaXNJc0FWYXIvKFtBLVpdKS4qKFZhcikvJDItJHsxOi9kb3duY2FzZX0vfScsICdWYXItdCcpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZTIoJyR7Rm9vLyguKikvJHsxOitCYXJ9L2ltZ30nLCAnQmFyJyk7XG5cblx0XHQvL2h0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8zMzE2MlxuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZTIoJ2V4cG9ydCBkZWZhdWx0IGNsYXNzICR7VE1fRklMRU5BTUUvKFxcXFx3KylcXFxcLmpzLyQxL2d9JywgJ2V4cG9ydCBkZWZhdWx0IGNsYXNzIEZvb0ZpbGUnLCAnRm9vRmlsZS5qcycpO1xuXG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlMignJHtmb29iYXJmb29iYXIvKGZvbykvJHsxOitGQVJ9L2d9JywgJ0ZBUmJhckZBUmJhcicpOyAvLyBnbG9iYWxcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUyKCcke2Zvb2JhcmZvb2Jhci8oZm9vKS8kezE6K0ZBUn0vfScsICdGQVJiYXJmb29iYXInKTsgLy8gZmlyc3QgbWF0Y2hcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUyKCcke2Zvb2JhcmZvb2Jhci8oYmF6eikvJHsxOitGQVJ9L2d9JywgJ2Zvb2JhcmZvb2JhcicpOyAvLyBubyBtYXRjaCwgbm8gZWxzZVxuXHRcdC8vIGFzc2VydFZhcmlhYmxlUmVzb2x2ZTIoJyR7Zm9vYmFyZm9vYmFyLyhiYXp6KS8kezE6K0ZBUn0vZ30nLCAnJyk7IC8vIG5vIG1hdGNoXG5cblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUyKCcke2Zvb2JhcmZvb2Jhci8oZm9vKS8kezI6K0ZBUn0vZ30nLCAnYmFyYmFyJyk7IC8vIGJhZCBncm91cCByZWZlcmVuY2Vcblx0fSk7XG5cblx0dGVzdCgnU25pcHBldCB0cmFuc2Zvcm1zIGRvIG5vdCBoYW5kbGUgcmVnZXggd2l0aCBhbHRlcm5hdGl2ZXMgb3Igb3B0aW9uYWwgbWF0Y2hlcywgIzM2MDg5JywgZnVuY3Rpb24gKCkge1xuXG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlMihcblx0XHRcdCcke1RNX0ZJTEVOQU1FL14oLil8KD86LSguKSl8KFxcXFwuanMpLyR7MTovdXBjYXNlfSR7MjovdXBjYXNlfS9nfScsXG5cdFx0XHQnTXlDbGFzcycsXG5cdFx0XHQnbXktY2xhc3MuanMnXG5cdFx0KTtcblxuXHRcdC8vIG5vIGh5cGhlbnNcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUyKFxuXHRcdFx0JyR7VE1fRklMRU5BTUUvXiguKXwoPzotKC4pKXwoXFxcXC5qcykvJHsxOi91cGNhc2V9JHsyOi91cGNhc2V9L2d9Jyxcblx0XHRcdCdNeWNsYXNzJyxcblx0XHRcdCdteWNsYXNzLmpzJ1xuXHRcdCk7XG5cblx0XHQvLyBub25lIG1hdGNoaW5nIHN1ZmZpeFxuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZTIoXG5cdFx0XHQnJHtUTV9GSUxFTkFNRS9eKC4pfCg/Oi0oLikpfChcXFxcLmpzKS8kezE6L3VwY2FzZX0kezI6L3VwY2FzZX0vZ30nLFxuXHRcdFx0J015Y2xhc3MuZm9vJyxcblx0XHRcdCdteWNsYXNzLmZvbydcblx0XHQpO1xuXG5cdFx0Ly8gbW9yZSB0aGFuIG9uZSBoeXBoZW5cblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUyKFxuXHRcdFx0JyR7VE1fRklMRU5BTUUvXiguKXwoPzotKC4pKXwoXFxcXC5qcykvJHsxOi91cGNhc2V9JHsyOi91cGNhc2V9L2d9Jyxcblx0XHRcdCdUaGlzSXNBRmlsZScsXG5cdFx0XHQndGhpcy1pcy1hLWZpbGUuanMnXG5cdFx0KTtcblxuXHRcdC8vIEtFQkFCIENBU0Vcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUyKFxuXHRcdFx0JyR7VE1fRklMRU5BTUVfQkFTRS8oW0EtWl1bYS16XSspKFtBLVpdW2Etel0rJCk/LyR7MTovZG93bmNhc2V9LSR7MjovZG93bmNhc2V9L2d9Jyxcblx0XHRcdCdjYXBpdGFsLWNhc2UnLFxuXHRcdFx0J0NhcGl0YWxDYXNlJ1xuXHRcdCk7XG5cblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUyKFxuXHRcdFx0JyR7VE1fRklMRU5BTUVfQkFTRS8oW0EtWl1bYS16XSspKFtBLVpdW2Etel0rJCk/LyR7MTovZG93bmNhc2V9LSR7MjovZG93bmNhc2V9L2d9Jyxcblx0XHRcdCdjYXBpdGFsLWNhc2UtbW9yZScsXG5cdFx0XHQnQ2FwaXRhbENhc2VNb3JlJ1xuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0FkZCB2YXJpYWJsZSB0byBpbnNlcnQgdmFsdWUgZnJvbSBjbGlwYm9hcmQgdG8gYSBzbmlwcGV0ICM0MDE1MycsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShuZXcgQ2xpcGJvYXJkQmFzZWRWYXJpYWJsZVJlc29sdmVyKCgpID0+IHVuZGVmaW5lZCwgMSwgMCwgdHJ1ZSksICdDTElQQk9BUkQnLCB1bmRlZmluZWQpO1xuXG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKG5ldyBDbGlwYm9hcmRCYXNlZFZhcmlhYmxlUmVzb2x2ZXIoKCkgPT4gbnVsbCEsIDEsIDAsIHRydWUpLCAnQ0xJUEJPQVJEJywgdW5kZWZpbmVkKTtcblxuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShuZXcgQ2xpcGJvYXJkQmFzZWRWYXJpYWJsZVJlc29sdmVyKCgpID0+ICcnLCAxLCAwLCB0cnVlKSwgJ0NMSVBCT0FSRCcsIHVuZGVmaW5lZCk7XG5cblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUobmV3IENsaXBib2FyZEJhc2VkVmFyaWFibGVSZXNvbHZlcigoKSA9PiAnZm9vJywgMSwgMCwgdHJ1ZSksICdDTElQQk9BUkQnLCAnZm9vJyk7XG5cblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUobmV3IENsaXBib2FyZEJhc2VkVmFyaWFibGVSZXNvbHZlcigoKSA9PiAnZm9vJywgMSwgMCwgdHJ1ZSksICdmb28nLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShuZXcgQ2xpcGJvYXJkQmFzZWRWYXJpYWJsZVJlc29sdmVyKCgpID0+ICdmb28nLCAxLCAwLCB0cnVlKSwgJ2NMSVBCT0FSRCcsIHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0FkZCB2YXJpYWJsZSB0byBpbnNlcnQgdmFsdWUgZnJvbSBjbGlwYm9hcmQgdG8gYSBzbmlwcGV0ICM0MDE1MywgMicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShuZXcgQ2xpcGJvYXJkQmFzZWRWYXJpYWJsZVJlc29sdmVyKCgpID0+ICdsaW5lMScsIDEsIDIsIHRydWUpLCAnQ0xJUEJPQVJEJywgJ2xpbmUxJyk7XG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKG5ldyBDbGlwYm9hcmRCYXNlZFZhcmlhYmxlUmVzb2x2ZXIoKCkgPT4gJ2xpbmUxXFxubGluZTJcXG5saW5lMycsIDEsIDIsIHRydWUpLCAnQ0xJUEJPQVJEJywgJ2xpbmUxXFxubGluZTJcXG5saW5lMycpO1xuXG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKG5ldyBDbGlwYm9hcmRCYXNlZFZhcmlhYmxlUmVzb2x2ZXIoKCkgPT4gJ2xpbmUxXFxubGluZTInLCAxLCAyLCB0cnVlKSwgJ0NMSVBCT0FSRCcsICdsaW5lMicpO1xuXHRcdHJlc29sdmVyID0gbmV3IENsaXBib2FyZEJhc2VkVmFyaWFibGVSZXNvbHZlcigoKSA9PiAnbGluZTFcXG5saW5lMicsIDAsIDIsIHRydWUpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShuZXcgQ2xpcGJvYXJkQmFzZWRWYXJpYWJsZVJlc29sdmVyKCgpID0+ICdsaW5lMVxcbmxpbmUyJywgMCwgMiwgdHJ1ZSksICdDTElQQk9BUkQnLCAnbGluZTEnKTtcblxuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShuZXcgQ2xpcGJvYXJkQmFzZWRWYXJpYWJsZVJlc29sdmVyKCgpID0+ICdsaW5lMVxcbmxpbmUyJywgMCwgMiwgZmFsc2UpLCAnQ0xJUEJPQVJEJywgJ2xpbmUxXFxubGluZTInKTtcblx0fSk7XG5cblxuXHRmdW5jdGlvbiBhc3NlcnRWYXJpYWJsZVJlc29sdmUzKHJlc29sdmVyOiBWYXJpYWJsZVJlc29sdmVyLCB2YXJOYW1lOiBzdHJpbmcpIHtcblx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZShgJCR7dmFyTmFtZX1gKTtcblx0XHRjb25zdCB2YXJpYWJsZSA9IDxWYXJpYWJsZT5zbmlwcGV0LmNoaWxkcmVuWzBdO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhcmlhYmxlLnJlc29sdmUocmVzb2x2ZXIpLCB0cnVlLCBgJHt2YXJOYW1lfSBmYWlsZWQgdG8gcmVzb2x2ZWApO1xuXHR9XG5cblx0dGVzdCgnQWRkIHRpbWUgdmFyaWFibGVzIGZvciBzbmlwcGV0cyAjNDE2MzEsICM0MzE0MCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHJlc29sdmVyID0gbmV3IFRpbWVCYXNlZFZhcmlhYmxlUmVzb2x2ZXI7XG5cblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUzKHJlc29sdmVyLCAnQ1VSUkVOVF9ZRUFSJyk7XG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlMyhyZXNvbHZlciwgJ0NVUlJFTlRfWUVBUl9TSE9SVCcpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZTMocmVzb2x2ZXIsICdDVVJSRU5UX01PTlRIJyk7XG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlMyhyZXNvbHZlciwgJ0NVUlJFTlRfREFURScpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZTMocmVzb2x2ZXIsICdDVVJSRU5UX0hPVVInKTtcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUzKHJlc29sdmVyLCAnQ1VSUkVOVF9NSU5VVEUnKTtcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUzKHJlc29sdmVyLCAnQ1VSUkVOVF9TRUNPTkQnKTtcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUzKHJlc29sdmVyLCAnQ1VSUkVOVF9EQVlfTkFNRScpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZTMocmVzb2x2ZXIsICdDVVJSRU5UX0RBWV9OQU1FX1NIT1JUJyk7XG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlMyhyZXNvbHZlciwgJ0NVUlJFTlRfTU9OVEhfTkFNRScpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZTMocmVzb2x2ZXIsICdDVVJSRU5UX01PTlRIX05BTUVfU0hPUlQnKTtcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUzKHJlc29sdmVyLCAnQ1VSUkVOVF9TRUNPTkRTX1VOSVgnKTtcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUzKHJlc29sdmVyLCAnQ1VSUkVOVF9USU1FWk9ORV9PRkZTRVQnKTtcblx0fSk7XG5cblx0dGVzdCgnVGltZS1iYXNlZCBzbmlwcGV0IHZhcmlhYmxlcyByZXNvbHZlIHRvIHRoZSBzYW1lIHZhbHVlcyBldmVuIGFzIHRpbWUgcHJvZ3Jlc3NlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzbmlwcGV0VGV4dCA9IGBcblx0XHRcdCRDVVJSRU5UX1lFQVJcblx0XHRcdCRDVVJSRU5UX1lFQVJfU0hPUlRcblx0XHRcdCRDVVJSRU5UX01PTlRIXG5cdFx0XHQkQ1VSUkVOVF9EQVRFXG5cdFx0XHQkQ1VSUkVOVF9IT1VSXG5cdFx0XHQkQ1VSUkVOVF9NSU5VVEVcblx0XHRcdCRDVVJSRU5UX1NFQ09ORFxuXHRcdFx0JENVUlJFTlRfREFZX05BTUVcblx0XHRcdCRDVVJSRU5UX0RBWV9OQU1FX1NIT1JUXG5cdFx0XHQkQ1VSUkVOVF9NT05USF9OQU1FXG5cdFx0XHQkQ1VSUkVOVF9NT05USF9OQU1FX1NIT1JUXG5cdFx0XHQkQ1VSUkVOVF9TRUNPTkRTX1VOSVhcblx0XHRcdCRDVVJSRU5UX1RJTUVaT05FX09GRlNFVFxuXHRcdGA7XG5cblx0XHRjb25zdCBjbG9jayA9IHNpbm9uLnVzZUZha2VUaW1lcnMoKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzb2x2ZXIgPSBuZXcgVGltZUJhc2VkVmFyaWFibGVSZXNvbHZlcjtcblxuXHRcdFx0Y29uc3QgZmlyc3RSZXNvbHZlID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZShzbmlwcGV0VGV4dCkucmVzb2x2ZVZhcmlhYmxlcyhyZXNvbHZlcik7XG5cdFx0XHRjbG9jay50aWNrKCgzNjUgKiAyNCAqIDM2MDAgKiAxMDAwKSArICgyNCAqIDM2MDAgKiAxMDAwKSArICgzNjYxICogMTAwMCkpOyAgLy8gMSB5ZWFyICsgMSBkYXkgKyAxIGhvdXIgKyAxIG1pbnV0ZSArIDEgc2Vjb25kXG5cdFx0XHRjb25zdCBzZWNvbmRSZXNvbHZlID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZShzbmlwcGV0VGV4dCkucmVzb2x2ZVZhcmlhYmxlcyhyZXNvbHZlcik7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdFJlc29sdmUudG9TdHJpbmcoKSwgc2Vjb25kUmVzb2x2ZS50b1N0cmluZygpLCBgVGltZS1iYXNlZCBzbmlwcGV0IHZhcmlhYmxlcyByZXNvbHZlZCBkaWZmZXJlbnRseWApO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRjbG9jay5yZXN0b3JlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGluZyBzbmlwcGV0IC0gZm9ybWF0LWNvbmRpdGlvbiBkb2VzblxcJ3Qgd29yayAjNTM2MTcnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnJHtUTV9MSU5FX05VTUJFUi8oMTApLyR7MTo/SXQgaXM6SXQgaXMgbm90fS99IGxpbmUgMTAnLCB0cnVlKTtcblx0XHRzbmlwcGV0LnJlc29sdmVWYXJpYWJsZXMoeyByZXNvbHZlKCkgeyByZXR1cm4gJzEwJzsgfSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldC50b1N0cmluZygpLCAnSXQgaXMgbGluZSAxMCcpO1xuXG5cdFx0c25pcHBldC5yZXNvbHZlVmFyaWFibGVzKHsgcmVzb2x2ZSgpIHsgcmV0dXJuICcxMSc7IH0gfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuaXBwZXQudG9TdHJpbmcoKSwgJ0l0IGlzIG5vdCBsaW5lIDEwJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0FkZCB3b3Jrc3BhY2UgbmFtZSBhbmQgZm9sZGVyIHZhcmlhYmxlcyBmb3Igc25pcHBldHMgIzY4MjYxJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0bGV0IHdvcmtzcGFjZTogSVdvcmtzcGFjZTtcblx0XHRjb25zdCB3b3Jrc3BhY2VTZXJ2aWNlID0gbmV3IGNsYXNzIGltcGxlbWVudHMgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHtcblx0XHRcdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRcdFx0X3Rocm93ID0gKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoKTsgfTtcblx0XHRcdG9uRGlkQ2hhbmdlV29ya2JlbmNoU3RhdGUgPSB0aGlzLl90aHJvdztcblx0XHRcdG9uRGlkQ2hhbmdlV29ya3NwYWNlTmFtZSA9IHRoaXMuX3Rocm93O1xuXHRcdFx0b25XaWxsQ2hhbmdlV29ya3NwYWNlRm9sZGVycyA9IHRoaXMuX3Rocm93O1xuXHRcdFx0b25EaWRDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzID0gdGhpcy5fdGhyb3c7XG5cdFx0XHRnZXRDb21wbGV0ZVdvcmtzcGFjZSA9IHRoaXMuX3Rocm93O1xuXHRcdFx0Z2V0V29ya3NwYWNlKCk6IElXb3Jrc3BhY2UgeyByZXR1cm4gd29ya3NwYWNlOyB9XG5cdFx0XHRnZXRXb3JrYmVuY2hTdGF0ZSA9IHRoaXMuX3Rocm93O1xuXHRcdFx0Z2V0V29ya3NwYWNlRm9sZGVyID0gdGhpcy5fdGhyb3c7XG5cdFx0XHRpc0N1cnJlbnRXb3Jrc3BhY2UgPSB0aGlzLl90aHJvdztcblx0XHRcdGlzSW5zaWRlV29ya3NwYWNlID0gdGhpcy5fdGhyb3c7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHJlc29sdmVyID0gbmV3IFdvcmtzcGFjZUJhc2VkVmFyaWFibGVSZXNvbHZlcih3b3Jrc3BhY2VTZXJ2aWNlKTtcblxuXHRcdC8vIGVtcHR5IHdvcmtzcGFjZVxuXHRcdHdvcmtzcGFjZSA9IG5ldyBXb3Jrc3BhY2UoJycpO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ1dPUktTUEFDRV9OQU1FJywgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUocmVzb2x2ZXIsICdXT1JLU1BBQ0VfRk9MREVSJywgdW5kZWZpbmVkKTtcblxuXHRcdC8vIHNpbmdsZSBmb2xkZXIgd29ya3NwYWNlIHdpdGhvdXQgY29uZmlnXG5cdFx0d29ya3NwYWNlID0gbmV3IFdvcmtzcGFjZSgnJywgW3RvV29ya3NwYWNlRm9sZGVyKFVSSS5maWxlKCcvZm9sZGVyTmFtZScpKV0pO1xuXHRcdGFzc2VydFZhcmlhYmxlUmVzb2x2ZShyZXNvbHZlciwgJ1dPUktTUEFDRV9OQU1FJywgJ2ZvbGRlck5hbWUnKTtcblx0XHRpZiAoIWlzV2luZG93cykge1xuXHRcdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKHJlc29sdmVyLCAnV09SS1NQQUNFX0ZPTERFUicsICcvZm9sZGVyTmFtZScpO1xuXHRcdH1cblxuXHRcdC8vIHdvcmtzcGFjZSB3aXRoIGNvbmZpZ1xuXHRcdGNvbnN0IHdvcmtzcGFjZUNvbmZpZ1BhdGggPSBVUkkuZmlsZSgndGVzdFdvcmtzcGFjZS5jb2RlLXdvcmtzcGFjZScpO1xuXHRcdHdvcmtzcGFjZSA9IG5ldyBXb3Jrc3BhY2UoJycsIHRvV29ya3NwYWNlRm9sZGVycyhbeyBwYXRoOiAnZm9sZGVyTmFtZScgfV0sIHdvcmtzcGFjZUNvbmZpZ1BhdGgsIGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlKSwgd29ya3NwYWNlQ29uZmlnUGF0aCk7XG5cdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKHJlc29sdmVyLCAnV09SS1NQQUNFX05BTUUnLCAndGVzdFdvcmtzcGFjZScpO1xuXHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUocmVzb2x2ZXIsICdXT1JLU1BBQ0VfRk9MREVSJywgJy8nKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ0FkZCBSRUxBVElWRV9GSUxFUEFUSCBzbmlwcGV0IHZhcmlhYmxlICMxMTQyMDgnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRsZXQgcmVzb2x2ZXI6IFZhcmlhYmxlUmVzb2x2ZXI7XG5cblx0XHQvLyBNb2NrIGEgbGFiZWwgc2VydmljZSAob25seSBjb2RlZCBmb3IgZmlsZSB1cmlzKVxuXHRcdGNvbnN0IHdvcmtzcGFjZUxhYmVsU2VydmljZSA9ICgocm9vdFBhdGg6IHN0cmluZyk6IElMYWJlbFNlcnZpY2UgPT4ge1xuXHRcdFx0Y29uc3QgbGFiZWxTZXJ2aWNlID0gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTGFiZWxTZXJ2aWNlPigpIHtcblx0XHRcdFx0b3ZlcnJpZGUgZ2V0VXJpTGFiZWwodXJpOiBVUkksIG9wdGlvbnM6IHsgcmVsYXRpdmU/OiBib29sZWFuIH0gPSB7fSkge1xuXHRcdFx0XHRcdGNvbnN0IHJvb3RGc1BhdGggPSBVUkkuZmlsZShyb290UGF0aCkuZnNQYXRoICsgc2VwO1xuXHRcdFx0XHRcdGNvbnN0IGZzUGF0aCA9IHVyaS5mc1BhdGg7XG5cdFx0XHRcdFx0aWYgKG9wdGlvbnMucmVsYXRpdmUgJiYgcm9vdFBhdGggJiYgZnNQYXRoLnN0YXJ0c1dpdGgocm9vdEZzUGF0aCkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmc1BhdGguc3Vic3RyaW5nKHJvb3RGc1BhdGgubGVuZ3RoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGZzUGF0aDtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHJldHVybiBsYWJlbFNlcnZpY2U7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnJywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIFVSSS5wYXJzZSgnZmlsZTovLy9mb28vZmlsZXMvdGV4dC50eHQnKSk7XG5cblx0XHQvLyBlbXB0eSB3b3Jrc3BhY2Vcblx0XHRyZXNvbHZlciA9IG5ldyBNb2RlbEJhc2VkVmFyaWFibGVSZXNvbHZlcihcblx0XHRcdHdvcmtzcGFjZUxhYmVsU2VydmljZSgnJyksXG5cdFx0XHRtb2RlbFxuXHRcdCk7XG5cblx0XHRpZiAoIWlzV2luZG93cykge1xuXHRcdFx0YXNzZXJ0VmFyaWFibGVSZXNvbHZlKHJlc29sdmVyLCAnUkVMQVRJVkVfRklMRVBBVEgnLCAnL2Zvby9maWxlcy90ZXh0LnR4dCcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUocmVzb2x2ZXIsICdSRUxBVElWRV9GSUxFUEFUSCcsICdcXFxcZm9vXFxcXGZpbGVzXFxcXHRleHQudHh0Jyk7XG5cdFx0fVxuXG5cdFx0Ly8gc2luZ2xlIGZvbGRlciB3b3Jrc3BhY2Vcblx0XHRyZXNvbHZlciA9IG5ldyBNb2RlbEJhc2VkVmFyaWFibGVSZXNvbHZlcihcblx0XHRcdHdvcmtzcGFjZUxhYmVsU2VydmljZSgnL2ZvbycpLFxuXHRcdFx0bW9kZWxcblx0XHQpO1xuXHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUocmVzb2x2ZXIsICdSRUxBVElWRV9GSUxFUEFUSCcsICdmaWxlcy90ZXh0LnR4dCcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhc3NlcnRWYXJpYWJsZVJlc29sdmUocmVzb2x2ZXIsICdSRUxBVElWRV9GSUxFUEFUSCcsICdmaWxlc1xcXFx0ZXh0LnR4dCcpO1xuXHRcdH1cblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUlBLE9BQU8sWUFBWTtBQUNuQixZQUFZLFdBQVc7QUFDdkIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsV0FBVztBQUNwQixTQUFTLFlBQVk7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SSxVQUFVLElBQUksQ0FBQyxrQkFBa0IsSUFBSSxLQUFLLGFBQWEsQ0FBQyxDQUFDLENBQUM7QUFDMUUsMEJBQXNCQSxXQUFVLGtCQUFrQixZQUFZO0FBQzlELFFBQUksQ0FBQyxXQUFXO0FBQ2YsNEJBQXNCQSxXQUFVLG9CQUFvQixhQUFhO0FBQUEsSUFDbEU7QUFHQSxVQUFNLHNCQUFzQixJQUFJLEtBQUssOEJBQThCO0FBQ25FLGdCQUFZLElBQUksVUFBVSxJQUFJLG1CQUFtQixDQUFDLEVBQUUsTUFBTSxhQUFhLENBQUMsR0FBRyxxQkFBcUIsMEJBQTBCLEdBQUcsbUJBQW1CO0FBQ2hKLDBCQUFzQkEsV0FBVSxrQkFBa0IsZUFBZTtBQUNqRSxRQUFJLENBQUMsV0FBVztBQUNmLDRCQUFzQkEsV0FBVSxvQkFBb0IsR0FBRztBQUFBLElBQ3hEO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxrREFBa0QsV0FBWTtBQUVsRSxRQUFJQTtBQUdKLFVBQU0sd0JBQXlCLENBQUMsYUFBb0M7QUFDbkUsWUFBTUMsZ0JBQWUsSUFBSSxjQUFjLEtBQW9CLEVBQUU7QUFBQSxRQUNuRCxZQUFZLEtBQVUsVUFBa0MsQ0FBQyxHQUFHO0FBQ3BFLGdCQUFNLGFBQWEsSUFBSSxLQUFLLFFBQVEsRUFBRSxTQUFTO0FBQy9DLGdCQUFNLFNBQVMsSUFBSTtBQUNuQixjQUFJLFFBQVEsWUFBWSxZQUFZLE9BQU8sV0FBVyxVQUFVLEdBQUc7QUFDbEUsbUJBQU8sT0FBTyxVQUFVLFdBQVcsTUFBTTtBQUFBLFVBQzFDO0FBQ0EsaUJBQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUNBLGFBQU9BO0FBQUEsSUFDUjtBQUVBLFVBQU1DLFNBQVEsZ0JBQWdCLElBQUksUUFBVyxRQUFXLElBQUksTUFBTSw0QkFBNEIsQ0FBQztBQUcvRixJQUFBRixZQUFXLElBQUk7QUFBQSxNQUNkLHNCQUFzQixFQUFFO0FBQUEsTUFDeEJFO0FBQUEsSUFDRDtBQUVBLFFBQUksQ0FBQyxXQUFXO0FBQ2YsNEJBQXNCRixXQUFVLHFCQUFxQixxQkFBcUI7QUFBQSxJQUMzRSxPQUFPO0FBQ04sNEJBQXNCQSxXQUFVLHFCQUFxQix3QkFBd0I7QUFBQSxJQUM5RTtBQUdBLElBQUFBLFlBQVcsSUFBSTtBQUFBLE1BQ2Qsc0JBQXNCLE1BQU07QUFBQSxNQUM1QkU7QUFBQSxJQUNEO0FBQ0EsUUFBSSxDQUFDLFdBQVc7QUFDZiw0QkFBc0JGLFdBQVUscUJBQXFCLGdCQUFnQjtBQUFBLElBQ3RFLE9BQU87QUFDTiw0QkFBc0JBLFdBQVUscUJBQXFCLGlCQUFpQjtBQUFBLElBQ3ZFO0FBRUEsSUFBQUUsT0FBTSxRQUFRO0FBQUEsRUFDZixDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsicmVzb2x2ZXIiLCAibGFiZWxTZXJ2aWNlIiwgIm1vZGVsIl0KfQo=
