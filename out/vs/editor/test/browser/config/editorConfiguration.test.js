import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { migrateOptions } from "../../../browser/config/migrateOptions.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { EditorZoom } from "../../../common/config/editorZoom.js";
import { TestConfiguration } from "./testConfiguration.js";
import { AccessibilitySupport } from "../../../../platform/accessibility/common/accessibility.js";
suite("Common Editor Config", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Zoom Level", () => {
    const zoom = EditorZoom;
    zoom.setZoomLevel(0);
    assert.strictEqual(zoom.getZoomLevel(), 0);
    zoom.setZoomLevel(-0);
    assert.strictEqual(zoom.getZoomLevel(), 0);
    zoom.setZoomLevel(5);
    assert.strictEqual(zoom.getZoomLevel(), 5);
    zoom.setZoomLevel(-1);
    assert.strictEqual(zoom.getZoomLevel(), -1);
    zoom.setZoomLevel(9);
    assert.strictEqual(zoom.getZoomLevel(), 9);
    zoom.setZoomLevel(-9);
    assert.strictEqual(zoom.getZoomLevel(), -5);
    zoom.setZoomLevel(20);
    assert.strictEqual(zoom.getZoomLevel(), 20);
    zoom.setZoomLevel(-10);
    assert.strictEqual(zoom.getZoomLevel(), -5);
    zoom.setZoomLevel(9.1);
    assert.strictEqual(zoom.getZoomLevel(), 9.1);
    zoom.setZoomLevel(-9.1);
    assert.strictEqual(zoom.getZoomLevel(), -5);
    zoom.setZoomLevel(Infinity);
    assert.strictEqual(zoom.getZoomLevel(), 20);
    zoom.setZoomLevel(Number.NEGATIVE_INFINITY);
    assert.strictEqual(zoom.getZoomLevel(), -5);
  });
  class TestWrappingConfiguration extends TestConfiguration {
    _readEnvConfiguration() {
      return {
        extraEditorClassName: "",
        outerWidth: 1e3,
        outerHeight: 100,
        emptySelectionClipboard: true,
        pixelRatio: 1,
        accessibilitySupport: AccessibilitySupport.Unknown
      };
    }
  }
  function assertWrapping(config, isViewportWrapping, wrappingColumn) {
    const options = config.options;
    const wrappingInfo = options.get(EditorOption.wrappingInfo);
    assert.strictEqual(wrappingInfo.isViewportWrapping, isViewportWrapping);
    assert.strictEqual(wrappingInfo.wrappingColumn, wrappingColumn);
  }
  test("wordWrap default", () => {
    const config = new TestWrappingConfiguration({});
    assertWrapping(config, false, -1);
    config.dispose();
  });
  test("wordWrap compat false", () => {
    const config = new TestWrappingConfiguration({
      wordWrap: false
    });
    assertWrapping(config, false, -1);
    config.dispose();
  });
  test("wordWrap compat true", () => {
    const config = new TestWrappingConfiguration({
      wordWrap: true
    });
    assertWrapping(config, true, 80);
    config.dispose();
  });
  test("wordWrap on", () => {
    const config = new TestWrappingConfiguration({
      wordWrap: "on"
    });
    assertWrapping(config, true, 80);
    config.dispose();
  });
  test("wordWrap on without minimap", () => {
    const config = new TestWrappingConfiguration({
      wordWrap: "on",
      minimap: {
        enabled: false
      }
    });
    assertWrapping(config, true, 88);
    config.dispose();
  });
  test("wordWrap on does not use wordWrapColumn", () => {
    const config = new TestWrappingConfiguration({
      wordWrap: "on",
      wordWrapColumn: 10
    });
    assertWrapping(config, true, 80);
    config.dispose();
  });
  test("wordWrap off", () => {
    const config = new TestWrappingConfiguration({
      wordWrap: "off"
    });
    assertWrapping(config, false, -1);
    config.dispose();
  });
  test("wordWrap off does not use wordWrapColumn", () => {
    const config = new TestWrappingConfiguration({
      wordWrap: "off",
      wordWrapColumn: 10
    });
    assertWrapping(config, false, -1);
    config.dispose();
  });
  test("wordWrap wordWrapColumn uses default wordWrapColumn", () => {
    const config = new TestWrappingConfiguration({
      wordWrap: "wordWrapColumn"
    });
    assertWrapping(config, false, 80);
    config.dispose();
  });
  test("wordWrap wordWrapColumn uses wordWrapColumn", () => {
    const config = new TestWrappingConfiguration({
      wordWrap: "wordWrapColumn",
      wordWrapColumn: 100
    });
    assertWrapping(config, false, 100);
    config.dispose();
  });
  test("wordWrap wordWrapColumn validates wordWrapColumn", () => {
    const config = new TestWrappingConfiguration({
      wordWrap: "wordWrapColumn",
      wordWrapColumn: -1
    });
    assertWrapping(config, false, 1);
    config.dispose();
  });
  test("wordWrap bounded uses default wordWrapColumn", () => {
    const config = new TestWrappingConfiguration({
      wordWrap: "bounded"
    });
    assertWrapping(config, true, 80);
    config.dispose();
  });
  test("wordWrap bounded uses wordWrapColumn", () => {
    const config = new TestWrappingConfiguration({
      wordWrap: "bounded",
      wordWrapColumn: 40
    });
    assertWrapping(config, true, 40);
    config.dispose();
  });
  test("wordWrap bounded validates wordWrapColumn", () => {
    const config = new TestWrappingConfiguration({
      wordWrap: "bounded",
      wordWrapColumn: -1
    });
    assertWrapping(config, true, 1);
    config.dispose();
  });
  test("issue #53152: Cannot assign to read only property 'enabled' of object", () => {
    const hoverOptions = {};
    Object.defineProperty(hoverOptions, "enabled", {
      writable: false,
      value: true
    });
    const config = new TestConfiguration({ hover: hoverOptions });
    assert.strictEqual(config.options.get(EditorOption.hover).enabled, true);
    config.updateOptions({ hover: { enabled: false } });
    assert.strictEqual(config.options.get(EditorOption.hover).enabled, false);
    config.dispose();
  });
  test("does not emit event when nothing changes", () => {
    const config = new TestConfiguration({ glyphMargin: true, roundedSelection: false });
    let event = null;
    const disposable = config.onDidChange((e) => event = e);
    assert.strictEqual(config.options.get(EditorOption.glyphMargin), true);
    config.updateOptions({ glyphMargin: true });
    config.updateOptions({ roundedSelection: false });
    assert.strictEqual(event, null);
    config.dispose();
    disposable.dispose();
  });
  test("issue #94931: Unable to open source file", () => {
    const config = new TestConfiguration({ quickSuggestions: null });
    const actual = config.options.get(EditorOption.quickSuggestions);
    assert.deepStrictEqual(actual, {
      other: "on",
      comments: "off",
      strings: "off"
    });
    config.dispose();
  });
  test("issue #102920: Can't snap or split view with JSON files", () => {
    const config = new TestConfiguration({ quickSuggestions: null });
    config.updateOptions({ quickSuggestions: { strings: true } });
    const actual = config.options.get(EditorOption.quickSuggestions);
    assert.deepStrictEqual(actual, {
      other: "on",
      comments: "off",
      strings: "on"
    });
    config.dispose();
  });
  test("issue #151926: Untyped editor options apply", () => {
    const config = new TestConfiguration({});
    config.updateOptions({ unicodeHighlight: { allowedCharacters: { "x": true } } });
    const actual = config.options.get(EditorOption.unicodeHighlighting);
    assert.deepStrictEqual(
      actual,
      {
        nonBasicASCII: "inUntrustedWorkspace",
        invisibleCharacters: true,
        ambiguousCharacters: true,
        includeComments: "inUntrustedWorkspace",
        includeStrings: "inUntrustedWorkspace",
        allowedCharacters: { "x": true },
        allowedLocales: { "_os": true, "_vscode": true }
      }
    );
    config.dispose();
  });
});
suite("migrateOptions", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function migrate(options) {
    migrateOptions(options);
    return options;
  }
  test("wordWrap", () => {
    assert.deepStrictEqual(migrate({ wordWrap: true }), { wordWrap: "on" });
    assert.deepStrictEqual(migrate({ wordWrap: false }), { wordWrap: "off" });
  });
  test("lineNumbers", () => {
    assert.deepStrictEqual(migrate({ lineNumbers: true }), { lineNumbers: "on" });
    assert.deepStrictEqual(migrate({ lineNumbers: false }), { lineNumbers: "off" });
  });
  test("autoClosingBrackets", () => {
    assert.deepStrictEqual(migrate({ autoClosingBrackets: false }), { autoClosingBrackets: "never", autoClosingQuotes: "never", autoSurround: "never" });
  });
  test("cursorBlinking", () => {
    assert.deepStrictEqual(migrate({ cursorBlinking: "visible" }), { cursorBlinking: "solid" });
  });
  test("renderWhitespace", () => {
    assert.deepStrictEqual(migrate({ renderWhitespace: true }), { renderWhitespace: "boundary" });
    assert.deepStrictEqual(migrate({ renderWhitespace: false }), { renderWhitespace: "none" });
  });
  test("renderLineHighlight", () => {
    assert.deepStrictEqual(migrate({ renderLineHighlight: true }), { renderLineHighlight: "line" });
    assert.deepStrictEqual(migrate({ renderLineHighlight: false }), { renderLineHighlight: "none" });
  });
  test("acceptSuggestionOnEnter", () => {
    assert.deepStrictEqual(migrate({ acceptSuggestionOnEnter: true }), { acceptSuggestionOnEnter: "on" });
    assert.deepStrictEqual(migrate({ acceptSuggestionOnEnter: false }), { acceptSuggestionOnEnter: "off" });
  });
  test("tabCompletion", () => {
    assert.deepStrictEqual(migrate({ tabCompletion: true }), { tabCompletion: "onlySnippets" });
    assert.deepStrictEqual(migrate({ tabCompletion: false }), { tabCompletion: "off" });
  });
  test("suggest.filteredTypes", () => {
    assert.deepStrictEqual(
      migrate({
        suggest: {
          filteredTypes: {
            method: false,
            function: false,
            constructor: false,
            deprecated: false,
            field: false,
            variable: false,
            class: false,
            struct: false,
            interface: false,
            module: false,
            property: false,
            event: false,
            operator: false,
            unit: false,
            value: false,
            constant: false,
            enum: false,
            enumMember: false,
            keyword: false,
            text: false,
            color: false,
            file: false,
            reference: false,
            folder: false,
            typeParameter: false,
            snippet: false
          }
        }
      }),
      {
        suggest: {
          filteredTypes: void 0,
          showMethods: false,
          showFunctions: false,
          showConstructors: false,
          showDeprecated: false,
          showFields: false,
          showVariables: false,
          showClasses: false,
          showStructs: false,
          showInterfaces: false,
          showModules: false,
          showProperties: false,
          showEvents: false,
          showOperators: false,
          showUnits: false,
          showValues: false,
          showConstants: false,
          showEnums: false,
          showEnumMembers: false,
          showKeywords: false,
          showWords: false,
          showColors: false,
          showFiles: false,
          showReferences: false,
          showFolders: false,
          showTypeParameters: false,
          showSnippets: false
        }
      }
    );
  });
  test("quickSuggestions", () => {
    assert.deepStrictEqual(migrate({ quickSuggestions: true }), { quickSuggestions: { comments: "on", strings: "on", other: "on" } });
    assert.deepStrictEqual(migrate({ quickSuggestions: false }), { quickSuggestions: { comments: "off", strings: "off", other: "off" } });
    assert.deepStrictEqual(migrate({ quickSuggestions: { comments: "on", strings: "off" } }), { quickSuggestions: { comments: "on", strings: "off" } });
  });
  test("hover", () => {
    assert.deepStrictEqual(migrate({ hover: true }), { hover: { enabled: true } });
    assert.deepStrictEqual(migrate({ hover: false }), { hover: { enabled: false } });
  });
  test("parameterHints", () => {
    assert.deepStrictEqual(migrate({ parameterHints: true }), { parameterHints: { enabled: true } });
    assert.deepStrictEqual(migrate({ parameterHints: false }), { parameterHints: { enabled: false } });
  });
  test("autoIndent", () => {
    assert.deepStrictEqual(migrate({ autoIndent: true }), { autoIndent: "full" });
    assert.deepStrictEqual(migrate({ autoIndent: false }), { autoIndent: "advanced" });
  });
  test("matchBrackets", () => {
    assert.deepStrictEqual(migrate({ matchBrackets: true }), { matchBrackets: "always" });
    assert.deepStrictEqual(migrate({ matchBrackets: false }), { matchBrackets: "never" });
  });
  test("renderIndentGuides, highlightActiveIndentGuide", () => {
    assert.deepStrictEqual(migrate({ renderIndentGuides: true }), { renderIndentGuides: void 0, guides: { indentation: true } });
    assert.deepStrictEqual(migrate({ renderIndentGuides: false }), { renderIndentGuides: void 0, guides: { indentation: false } });
    assert.deepStrictEqual(migrate({ highlightActiveIndentGuide: true }), { highlightActiveIndentGuide: void 0, guides: { highlightActiveIndentation: true } });
    assert.deepStrictEqual(migrate({ highlightActiveIndentGuide: false }), { highlightActiveIndentGuide: void 0, guides: { highlightActiveIndentation: false } });
  });
  test("migration does not overwrite new setting", () => {
    assert.deepStrictEqual(migrate({ renderIndentGuides: true, guides: { indentation: false } }), { renderIndentGuides: void 0, guides: { indentation: false } });
    assert.deepStrictEqual(migrate({ highlightActiveIndentGuide: true, guides: { highlightActiveIndentation: false } }), { highlightActiveIndentGuide: void 0, guides: { highlightActiveIndentation: false } });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9icm93c2VyL2NvbmZpZy9lZGl0b3JDb25maWd1cmF0aW9uLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElFbnZDb25maWd1cmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9jb25maWcvZWRpdG9yQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBtaWdyYXRlT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvY29uZmlnL21pZ3JhdGVPcHRpb25zLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQsIEVkaXRvck9wdGlvbiwgSUVkaXRvckhvdmVyT3B0aW9ucywgSVF1aWNrU3VnZ2VzdGlvbnNPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IEVkaXRvclpvb20gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvclpvb20uanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb24gfSBmcm9tICcuL3Rlc3RDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlTdXBwb3J0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5cbnN1aXRlKCdDb21tb24gRWRpdG9yIENvbmZpZycsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdab29tIExldmVsJywgKCkgPT4ge1xuXG5cdFx0Ly9ab29tIGxldmVscyBhcmUgZGVmaW5lZCB0byBnbyBiZXR3ZWVuIC01LCAyMCBpbmNsdXNpdmVcblx0XHRjb25zdCB6b29tID0gRWRpdG9yWm9vbTtcblxuXHRcdHpvb20uc2V0Wm9vbUxldmVsKDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh6b29tLmdldFpvb21MZXZlbCgpLCAwKTtcblxuXHRcdHpvb20uc2V0Wm9vbUxldmVsKC0wKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoem9vbS5nZXRab29tTGV2ZWwoKSwgMCk7XG5cblx0XHR6b29tLnNldFpvb21MZXZlbCg1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoem9vbS5nZXRab29tTGV2ZWwoKSwgNSk7XG5cblx0XHR6b29tLnNldFpvb21MZXZlbCgtMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHpvb20uZ2V0Wm9vbUxldmVsKCksIC0xKTtcblxuXHRcdHpvb20uc2V0Wm9vbUxldmVsKDkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh6b29tLmdldFpvb21MZXZlbCgpLCA5KTtcblxuXHRcdHpvb20uc2V0Wm9vbUxldmVsKC05KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoem9vbS5nZXRab29tTGV2ZWwoKSwgLTUpO1xuXG5cdFx0em9vbS5zZXRab29tTGV2ZWwoMjApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh6b29tLmdldFpvb21MZXZlbCgpLCAyMCk7XG5cblx0XHR6b29tLnNldFpvb21MZXZlbCgtMTApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh6b29tLmdldFpvb21MZXZlbCgpLCAtNSk7XG5cblx0XHR6b29tLnNldFpvb21MZXZlbCg5LjEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh6b29tLmdldFpvb21MZXZlbCgpLCA5LjEpO1xuXG5cdFx0em9vbS5zZXRab29tTGV2ZWwoLTkuMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHpvb20uZ2V0Wm9vbUxldmVsKCksIC01KTtcblxuXHRcdHpvb20uc2V0Wm9vbUxldmVsKEluZmluaXR5KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoem9vbS5nZXRab29tTGV2ZWwoKSwgMjApO1xuXG5cdFx0em9vbS5zZXRab29tTGV2ZWwoTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoem9vbS5nZXRab29tTGV2ZWwoKSwgLTUpO1xuXHR9KTtcblxuXHRjbGFzcyBUZXN0V3JhcHBpbmdDb25maWd1cmF0aW9uIGV4dGVuZHMgVGVzdENvbmZpZ3VyYXRpb24ge1xuXHRcdHByb3RlY3RlZCBvdmVycmlkZSBfcmVhZEVudkNvbmZpZ3VyYXRpb24oKTogSUVudkNvbmZpZ3VyYXRpb24ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0cmFFZGl0b3JDbGFzc05hbWU6ICcnLFxuXHRcdFx0XHRvdXRlcldpZHRoOiAxMDAwLFxuXHRcdFx0XHRvdXRlckhlaWdodDogMTAwLFxuXHRcdFx0XHRlbXB0eVNlbGVjdGlvbkNsaXBib2FyZDogdHJ1ZSxcblx0XHRcdFx0cGl4ZWxSYXRpbzogMSxcblx0XHRcdFx0YWNjZXNzaWJpbGl0eVN1cHBvcnQ6IEFjY2Vzc2liaWxpdHlTdXBwb3J0LlVua25vd25cblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gYXNzZXJ0V3JhcHBpbmcoY29uZmlnOiBUZXN0Q29uZmlndXJhdGlvbiwgaXNWaWV3cG9ydFdyYXBwaW5nOiBib29sZWFuLCB3cmFwcGluZ0NvbHVtbjogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IGNvbmZpZy5vcHRpb25zO1xuXHRcdGNvbnN0IHdyYXBwaW5nSW5mbyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi53cmFwcGluZ0luZm8pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3cmFwcGluZ0luZm8uaXNWaWV3cG9ydFdyYXBwaW5nLCBpc1ZpZXdwb3J0V3JhcHBpbmcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3cmFwcGluZ0luZm8ud3JhcHBpbmdDb2x1bW4sIHdyYXBwaW5nQ29sdW1uKTtcblx0fVxuXG5cdHRlc3QoJ3dvcmRXcmFwIGRlZmF1bHQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlnID0gbmV3IFRlc3RXcmFwcGluZ0NvbmZpZ3VyYXRpb24oe30pO1xuXHRcdGFzc2VydFdyYXBwaW5nKGNvbmZpZywgZmFsc2UsIC0xKTtcblx0XHRjb25maWcuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCd3b3JkV3JhcCBjb21wYXQgZmFsc2UnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlnID0gbmV3IFRlc3RXcmFwcGluZ0NvbmZpZ3VyYXRpb24oe1xuXHRcdFx0d29yZFdyYXA6IDxhbnk+ZmFsc2Vcblx0XHR9KTtcblx0XHRhc3NlcnRXcmFwcGluZyhjb25maWcsIGZhbHNlLCAtMSk7XG5cdFx0Y29uZmlnLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnd29yZFdyYXAgY29tcGF0IHRydWUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlnID0gbmV3IFRlc3RXcmFwcGluZ0NvbmZpZ3VyYXRpb24oe1xuXHRcdFx0d29yZFdyYXA6IDxhbnk+dHJ1ZVxuXHRcdH0pO1xuXHRcdGFzc2VydFdyYXBwaW5nKGNvbmZpZywgdHJ1ZSwgODApO1xuXHRcdGNvbmZpZy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dvcmRXcmFwIG9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZyA9IG5ldyBUZXN0V3JhcHBpbmdDb25maWd1cmF0aW9uKHtcblx0XHRcdHdvcmRXcmFwOiAnb24nXG5cdFx0fSk7XG5cdFx0YXNzZXJ0V3JhcHBpbmcoY29uZmlnLCB0cnVlLCA4MCk7XG5cdFx0Y29uZmlnLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnd29yZFdyYXAgb24gd2l0aG91dCBtaW5pbWFwJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZyA9IG5ldyBUZXN0V3JhcHBpbmdDb25maWd1cmF0aW9uKHtcblx0XHRcdHdvcmRXcmFwOiAnb24nLFxuXHRcdFx0bWluaW1hcDoge1xuXHRcdFx0XHRlbmFibGVkOiBmYWxzZVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGFzc2VydFdyYXBwaW5nKGNvbmZpZywgdHJ1ZSwgODgpO1xuXHRcdGNvbmZpZy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dvcmRXcmFwIG9uIGRvZXMgbm90IHVzZSB3b3JkV3JhcENvbHVtbicsICgpID0+IHtcblx0XHRjb25zdCBjb25maWcgPSBuZXcgVGVzdFdyYXBwaW5nQ29uZmlndXJhdGlvbih7XG5cdFx0XHR3b3JkV3JhcDogJ29uJyxcblx0XHRcdHdvcmRXcmFwQ29sdW1uOiAxMFxuXHRcdH0pO1xuXHRcdGFzc2VydFdyYXBwaW5nKGNvbmZpZywgdHJ1ZSwgODApO1xuXHRcdGNvbmZpZy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dvcmRXcmFwIG9mZicsICgpID0+IHtcblx0XHRjb25zdCBjb25maWcgPSBuZXcgVGVzdFdyYXBwaW5nQ29uZmlndXJhdGlvbih7XG5cdFx0XHR3b3JkV3JhcDogJ29mZidcblx0XHR9KTtcblx0XHRhc3NlcnRXcmFwcGluZyhjb25maWcsIGZhbHNlLCAtMSk7XG5cdFx0Y29uZmlnLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnd29yZFdyYXAgb2ZmIGRvZXMgbm90IHVzZSB3b3JkV3JhcENvbHVtbicsICgpID0+IHtcblx0XHRjb25zdCBjb25maWcgPSBuZXcgVGVzdFdyYXBwaW5nQ29uZmlndXJhdGlvbih7XG5cdFx0XHR3b3JkV3JhcDogJ29mZicsXG5cdFx0XHR3b3JkV3JhcENvbHVtbjogMTBcblx0XHR9KTtcblx0XHRhc3NlcnRXcmFwcGluZyhjb25maWcsIGZhbHNlLCAtMSk7XG5cdFx0Y29uZmlnLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnd29yZFdyYXAgd29yZFdyYXBDb2x1bW4gdXNlcyBkZWZhdWx0IHdvcmRXcmFwQ29sdW1uJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZyA9IG5ldyBUZXN0V3JhcHBpbmdDb25maWd1cmF0aW9uKHtcblx0XHRcdHdvcmRXcmFwOiAnd29yZFdyYXBDb2x1bW4nXG5cdFx0fSk7XG5cdFx0YXNzZXJ0V3JhcHBpbmcoY29uZmlnLCBmYWxzZSwgODApO1xuXHRcdGNvbmZpZy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dvcmRXcmFwIHdvcmRXcmFwQ29sdW1uIHVzZXMgd29yZFdyYXBDb2x1bW4nLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlnID0gbmV3IFRlc3RXcmFwcGluZ0NvbmZpZ3VyYXRpb24oe1xuXHRcdFx0d29yZFdyYXA6ICd3b3JkV3JhcENvbHVtbicsXG5cdFx0XHR3b3JkV3JhcENvbHVtbjogMTAwXG5cdFx0fSk7XG5cdFx0YXNzZXJ0V3JhcHBpbmcoY29uZmlnLCBmYWxzZSwgMTAwKTtcblx0XHRjb25maWcuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCd3b3JkV3JhcCB3b3JkV3JhcENvbHVtbiB2YWxpZGF0ZXMgd29yZFdyYXBDb2x1bW4nLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlnID0gbmV3IFRlc3RXcmFwcGluZ0NvbmZpZ3VyYXRpb24oe1xuXHRcdFx0d29yZFdyYXA6ICd3b3JkV3JhcENvbHVtbicsXG5cdFx0XHR3b3JkV3JhcENvbHVtbjogLTFcblx0XHR9KTtcblx0XHRhc3NlcnRXcmFwcGluZyhjb25maWcsIGZhbHNlLCAxKTtcblx0XHRjb25maWcuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCd3b3JkV3JhcCBib3VuZGVkIHVzZXMgZGVmYXVsdCB3b3JkV3JhcENvbHVtbicsICgpID0+IHtcblx0XHRjb25zdCBjb25maWcgPSBuZXcgVGVzdFdyYXBwaW5nQ29uZmlndXJhdGlvbih7XG5cdFx0XHR3b3JkV3JhcDogJ2JvdW5kZWQnXG5cdFx0fSk7XG5cdFx0YXNzZXJ0V3JhcHBpbmcoY29uZmlnLCB0cnVlLCA4MCk7XG5cdFx0Y29uZmlnLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnd29yZFdyYXAgYm91bmRlZCB1c2VzIHdvcmRXcmFwQ29sdW1uJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZyA9IG5ldyBUZXN0V3JhcHBpbmdDb25maWd1cmF0aW9uKHtcblx0XHRcdHdvcmRXcmFwOiAnYm91bmRlZCcsXG5cdFx0XHR3b3JkV3JhcENvbHVtbjogNDBcblx0XHR9KTtcblx0XHRhc3NlcnRXcmFwcGluZyhjb25maWcsIHRydWUsIDQwKTtcblx0XHRjb25maWcuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCd3b3JkV3JhcCBib3VuZGVkIHZhbGlkYXRlcyB3b3JkV3JhcENvbHVtbicsICgpID0+IHtcblx0XHRjb25zdCBjb25maWcgPSBuZXcgVGVzdFdyYXBwaW5nQ29uZmlndXJhdGlvbih7XG5cdFx0XHR3b3JkV3JhcDogJ2JvdW5kZWQnLFxuXHRcdFx0d29yZFdyYXBDb2x1bW46IC0xXG5cdFx0fSk7XG5cdFx0YXNzZXJ0V3JhcHBpbmcoY29uZmlnLCB0cnVlLCAxKTtcblx0XHRjb25maWcuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNTMxNTI6IENhbm5vdCBhc3NpZ24gdG8gcmVhZCBvbmx5IHByb3BlcnR5IFxcJ2VuYWJsZWRcXCcgb2Ygb2JqZWN0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGhvdmVyT3B0aW9uczogSUVkaXRvckhvdmVyT3B0aW9ucyA9IHt9O1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShob3Zlck9wdGlvbnMsICdlbmFibGVkJywge1xuXHRcdFx0d3JpdGFibGU6IGZhbHNlLFxuXHRcdFx0dmFsdWU6IHRydWVcblx0XHR9KTtcblx0XHRjb25zdCBjb25maWcgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb24oeyBob3ZlcjogaG92ZXJPcHRpb25zIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbmZpZy5vcHRpb25zLmdldChFZGl0b3JPcHRpb24uaG92ZXIpLmVuYWJsZWQsIHRydWUpO1xuXHRcdGNvbmZpZy51cGRhdGVPcHRpb25zKHsgaG92ZXI6IHsgZW5hYmxlZDogZmFsc2UgfSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29uZmlnLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5ob3ZlcikuZW5hYmxlZCwgZmFsc2UpO1xuXG5cdFx0Y29uZmlnLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgZW1pdCBldmVudCB3aGVuIG5vdGhpbmcgY2hhbmdlcycsICgpID0+IHtcblx0XHRjb25zdCBjb25maWcgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb24oeyBnbHlwaE1hcmdpbjogdHJ1ZSwgcm91bmRlZFNlbGVjdGlvbjogZmFsc2UgfSk7XG5cdFx0bGV0IGV2ZW50OiBDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50IHwgbnVsbCA9IG51bGw7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGNvbmZpZy5vbkRpZENoYW5nZShlID0+IGV2ZW50ID0gZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbmZpZy5vcHRpb25zLmdldChFZGl0b3JPcHRpb24uZ2x5cGhNYXJnaW4pLCB0cnVlKTtcblxuXHRcdGNvbmZpZy51cGRhdGVPcHRpb25zKHsgZ2x5cGhNYXJnaW46IHRydWUgfSk7XG5cdFx0Y29uZmlnLnVwZGF0ZU9wdGlvbnMoeyByb3VuZGVkU2VsZWN0aW9uOiBmYWxzZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQsIG51bGwpO1xuXHRcdGNvbmZpZy5kaXNwb3NlKCk7XG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM5NDkzMTogVW5hYmxlIHRvIG9wZW4gc291cmNlIGZpbGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlnID0gbmV3IFRlc3RDb25maWd1cmF0aW9uKHsgcXVpY2tTdWdnZXN0aW9uczogbnVsbCEgfSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gPFJlYWRvbmx5PFJlcXVpcmVkPElRdWlja1N1Z2dlc3Rpb25zT3B0aW9ucz4+PmNvbmZpZy5vcHRpb25zLmdldChFZGl0b3JPcHRpb24ucXVpY2tTdWdnZXN0aW9ucyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIHtcblx0XHRcdG90aGVyOiAnb24nLFxuXHRcdFx0Y29tbWVudHM6ICdvZmYnLFxuXHRcdFx0c3RyaW5nczogJ29mZidcblx0XHR9KTtcblx0XHRjb25maWcuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTAyOTIwOiBDYW5cXCd0IHNuYXAgb3Igc3BsaXQgdmlldyB3aXRoIEpTT04gZmlsZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlnID0gbmV3IFRlc3RDb25maWd1cmF0aW9uKHsgcXVpY2tTdWdnZXN0aW9uczogbnVsbCEgfSk7XG5cdFx0Y29uZmlnLnVwZGF0ZU9wdGlvbnMoeyBxdWlja1N1Z2dlc3Rpb25zOiB7IHN0cmluZ3M6IHRydWUgfSB9KTtcblx0XHRjb25zdCBhY3R1YWwgPSA8UmVhZG9ubHk8UmVxdWlyZWQ8SVF1aWNrU3VnZ2VzdGlvbnNPcHRpb25zPj4+Y29uZmlnLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5xdWlja1N1Z2dlc3Rpb25zKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwge1xuXHRcdFx0b3RoZXI6ICdvbicsXG5cdFx0XHRjb21tZW50czogJ29mZicsXG5cdFx0XHRzdHJpbmdzOiAnb24nXG5cdFx0fSk7XG5cdFx0Y29uZmlnLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE1MTkyNjogVW50eXBlZCBlZGl0b3Igb3B0aW9ucyBhcHBseScsICgpID0+IHtcblx0XHRjb25zdCBjb25maWcgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb24oe30pO1xuXHRcdGNvbmZpZy51cGRhdGVPcHRpb25zKHsgdW5pY29kZUhpZ2hsaWdodDogeyBhbGxvd2VkQ2hhcmFjdGVyczogeyAneCc6IHRydWUgfSB9IH0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IGNvbmZpZy5vcHRpb25zLmdldChFZGl0b3JPcHRpb24udW5pY29kZUhpZ2hsaWdodGluZyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsXG5cdFx0XHR7XG5cdFx0XHRcdG5vbkJhc2ljQVNDSUk6IFwiaW5VbnRydXN0ZWRXb3Jrc3BhY2VcIixcblx0XHRcdFx0aW52aXNpYmxlQ2hhcmFjdGVyczogdHJ1ZSxcblx0XHRcdFx0YW1iaWd1b3VzQ2hhcmFjdGVyczogdHJ1ZSxcblx0XHRcdFx0aW5jbHVkZUNvbW1lbnRzOiBcImluVW50cnVzdGVkV29ya3NwYWNlXCIsXG5cdFx0XHRcdGluY2x1ZGVTdHJpbmdzOiBcImluVW50cnVzdGVkV29ya3NwYWNlXCIsXG5cdFx0XHRcdGFsbG93ZWRDaGFyYWN0ZXJzOiB7IFwieFwiOiB0cnVlIH0sXG5cdFx0XHRcdGFsbG93ZWRMb2NhbGVzOiB7IFwiX29zXCI6IHRydWUsIFwiX3ZzY29kZVwiOiB0cnVlIH1cblx0XHRcdH1cblx0XHQpO1xuXHRcdGNvbmZpZy5kaXNwb3NlKCk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdtaWdyYXRlT3B0aW9ucycsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRmdW5jdGlvbiBtaWdyYXRlKG9wdGlvbnM6IGFueSk6IGFueSB7XG5cdFx0bWlncmF0ZU9wdGlvbnMob3B0aW9ucyk7XG5cdFx0cmV0dXJuIG9wdGlvbnM7XG5cdH1cblxuXHR0ZXN0KCd3b3JkV3JhcCcsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1pZ3JhdGUoeyB3b3JkV3JhcDogdHJ1ZSB9KSwgeyB3b3JkV3JhcDogJ29uJyB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1pZ3JhdGUoeyB3b3JkV3JhcDogZmFsc2UgfSksIHsgd29yZFdyYXA6ICdvZmYnIH0pO1xuXHR9KTtcblx0dGVzdCgnbGluZU51bWJlcnMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtaWdyYXRlKHsgbGluZU51bWJlcnM6IHRydWUgfSksIHsgbGluZU51bWJlcnM6ICdvbicgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtaWdyYXRlKHsgbGluZU51bWJlcnM6IGZhbHNlIH0pLCB7IGxpbmVOdW1iZXJzOiAnb2ZmJyB9KTtcblx0fSk7XG5cdHRlc3QoJ2F1dG9DbG9zaW5nQnJhY2tldHMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtaWdyYXRlKHsgYXV0b0Nsb3NpbmdCcmFja2V0czogZmFsc2UgfSksIHsgYXV0b0Nsb3NpbmdCcmFja2V0czogJ25ldmVyJywgYXV0b0Nsb3NpbmdRdW90ZXM6ICduZXZlcicsIGF1dG9TdXJyb3VuZDogJ25ldmVyJyB9KTtcblx0fSk7XG5cdHRlc3QoJ2N1cnNvckJsaW5raW5nJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWlncmF0ZSh7IGN1cnNvckJsaW5raW5nOiAndmlzaWJsZScgfSksIHsgY3Vyc29yQmxpbmtpbmc6ICdzb2xpZCcgfSk7XG5cdH0pO1xuXHR0ZXN0KCdyZW5kZXJXaGl0ZXNwYWNlJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWlncmF0ZSh7IHJlbmRlcldoaXRlc3BhY2U6IHRydWUgfSksIHsgcmVuZGVyV2hpdGVzcGFjZTogJ2JvdW5kYXJ5JyB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1pZ3JhdGUoeyByZW5kZXJXaGl0ZXNwYWNlOiBmYWxzZSB9KSwgeyByZW5kZXJXaGl0ZXNwYWNlOiAnbm9uZScgfSk7XG5cdH0pO1xuXHR0ZXN0KCdyZW5kZXJMaW5lSGlnaGxpZ2h0JywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWlncmF0ZSh7IHJlbmRlckxpbmVIaWdobGlnaHQ6IHRydWUgfSksIHsgcmVuZGVyTGluZUhpZ2hsaWdodDogJ2xpbmUnIH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWlncmF0ZSh7IHJlbmRlckxpbmVIaWdobGlnaHQ6IGZhbHNlIH0pLCB7IHJlbmRlckxpbmVIaWdobGlnaHQ6ICdub25lJyB9KTtcblx0fSk7XG5cdHRlc3QoJ2FjY2VwdFN1Z2dlc3Rpb25PbkVudGVyJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWlncmF0ZSh7IGFjY2VwdFN1Z2dlc3Rpb25PbkVudGVyOiB0cnVlIH0pLCB7IGFjY2VwdFN1Z2dlc3Rpb25PbkVudGVyOiAnb24nIH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWlncmF0ZSh7IGFjY2VwdFN1Z2dlc3Rpb25PbkVudGVyOiBmYWxzZSB9KSwgeyBhY2NlcHRTdWdnZXN0aW9uT25FbnRlcjogJ29mZicgfSk7XG5cdH0pO1xuXHR0ZXN0KCd0YWJDb21wbGV0aW9uJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWlncmF0ZSh7IHRhYkNvbXBsZXRpb246IHRydWUgfSksIHsgdGFiQ29tcGxldGlvbjogJ29ubHlTbmlwcGV0cycgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtaWdyYXRlKHsgdGFiQ29tcGxldGlvbjogZmFsc2UgfSksIHsgdGFiQ29tcGxldGlvbjogJ29mZicgfSk7XG5cdH0pO1xuXHR0ZXN0KCdzdWdnZXN0LmZpbHRlcmVkVHlwZXMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdG1pZ3JhdGUoe1xuXHRcdFx0XHRzdWdnZXN0OiB7XG5cdFx0XHRcdFx0ZmlsdGVyZWRUeXBlczoge1xuXHRcdFx0XHRcdFx0bWV0aG9kOiBmYWxzZSxcblx0XHRcdFx0XHRcdGZ1bmN0aW9uOiBmYWxzZSxcblx0XHRcdFx0XHRcdGNvbnN0cnVjdG9yOiBmYWxzZSxcblx0XHRcdFx0XHRcdGRlcHJlY2F0ZWQ6IGZhbHNlLFxuXHRcdFx0XHRcdFx0ZmllbGQ6IGZhbHNlLFxuXHRcdFx0XHRcdFx0dmFyaWFibGU6IGZhbHNlLFxuXHRcdFx0XHRcdFx0Y2xhc3M6IGZhbHNlLFxuXHRcdFx0XHRcdFx0c3RydWN0OiBmYWxzZSxcblx0XHRcdFx0XHRcdGludGVyZmFjZTogZmFsc2UsXG5cdFx0XHRcdFx0XHRtb2R1bGU6IGZhbHNlLFxuXHRcdFx0XHRcdFx0cHJvcGVydHk6IGZhbHNlLFxuXHRcdFx0XHRcdFx0ZXZlbnQ6IGZhbHNlLFxuXHRcdFx0XHRcdFx0b3BlcmF0b3I6IGZhbHNlLFxuXHRcdFx0XHRcdFx0dW5pdDogZmFsc2UsXG5cdFx0XHRcdFx0XHR2YWx1ZTogZmFsc2UsXG5cdFx0XHRcdFx0XHRjb25zdGFudDogZmFsc2UsXG5cdFx0XHRcdFx0XHRlbnVtOiBmYWxzZSxcblx0XHRcdFx0XHRcdGVudW1NZW1iZXI6IGZhbHNlLFxuXHRcdFx0XHRcdFx0a2V5d29yZDogZmFsc2UsXG5cdFx0XHRcdFx0XHR0ZXh0OiBmYWxzZSxcblx0XHRcdFx0XHRcdGNvbG9yOiBmYWxzZSxcblx0XHRcdFx0XHRcdGZpbGU6IGZhbHNlLFxuXHRcdFx0XHRcdFx0cmVmZXJlbmNlOiBmYWxzZSxcblx0XHRcdFx0XHRcdGZvbGRlcjogZmFsc2UsXG5cdFx0XHRcdFx0XHR0eXBlUGFyYW1ldGVyOiBmYWxzZSxcblx0XHRcdFx0XHRcdHNuaXBwZXQ6IGZhbHNlLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSksIHtcblx0XHRcdHN1Z2dlc3Q6IHtcblx0XHRcdFx0ZmlsdGVyZWRUeXBlczogdW5kZWZpbmVkLFxuXHRcdFx0XHRzaG93TWV0aG9kczogZmFsc2UsXG5cdFx0XHRcdHNob3dGdW5jdGlvbnM6IGZhbHNlLFxuXHRcdFx0XHRzaG93Q29uc3RydWN0b3JzOiBmYWxzZSxcblx0XHRcdFx0c2hvd0RlcHJlY2F0ZWQ6IGZhbHNlLFxuXHRcdFx0XHRzaG93RmllbGRzOiBmYWxzZSxcblx0XHRcdFx0c2hvd1ZhcmlhYmxlczogZmFsc2UsXG5cdFx0XHRcdHNob3dDbGFzc2VzOiBmYWxzZSxcblx0XHRcdFx0c2hvd1N0cnVjdHM6IGZhbHNlLFxuXHRcdFx0XHRzaG93SW50ZXJmYWNlczogZmFsc2UsXG5cdFx0XHRcdHNob3dNb2R1bGVzOiBmYWxzZSxcblx0XHRcdFx0c2hvd1Byb3BlcnRpZXM6IGZhbHNlLFxuXHRcdFx0XHRzaG93RXZlbnRzOiBmYWxzZSxcblx0XHRcdFx0c2hvd09wZXJhdG9yczogZmFsc2UsXG5cdFx0XHRcdHNob3dVbml0czogZmFsc2UsXG5cdFx0XHRcdHNob3dWYWx1ZXM6IGZhbHNlLFxuXHRcdFx0XHRzaG93Q29uc3RhbnRzOiBmYWxzZSxcblx0XHRcdFx0c2hvd0VudW1zOiBmYWxzZSxcblx0XHRcdFx0c2hvd0VudW1NZW1iZXJzOiBmYWxzZSxcblx0XHRcdFx0c2hvd0tleXdvcmRzOiBmYWxzZSxcblx0XHRcdFx0c2hvd1dvcmRzOiBmYWxzZSxcblx0XHRcdFx0c2hvd0NvbG9yczogZmFsc2UsXG5cdFx0XHRcdHNob3dGaWxlczogZmFsc2UsXG5cdFx0XHRcdHNob3dSZWZlcmVuY2VzOiBmYWxzZSxcblx0XHRcdFx0c2hvd0ZvbGRlcnM6IGZhbHNlLFxuXHRcdFx0XHRzaG93VHlwZVBhcmFtZXRlcnM6IGZhbHNlLFxuXHRcdFx0XHRzaG93U25pcHBldHM6IGZhbHNlLFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblx0dGVzdCgncXVpY2tTdWdnZXN0aW9ucycsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1pZ3JhdGUoeyBxdWlja1N1Z2dlc3Rpb25zOiB0cnVlIH0pLCB7IHF1aWNrU3VnZ2VzdGlvbnM6IHsgY29tbWVudHM6ICdvbicsIHN0cmluZ3M6ICdvbicsIG90aGVyOiAnb24nIH0gfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtaWdyYXRlKHsgcXVpY2tTdWdnZXN0aW9uczogZmFsc2UgfSksIHsgcXVpY2tTdWdnZXN0aW9uczogeyBjb21tZW50czogJ29mZicsIHN0cmluZ3M6ICdvZmYnLCBvdGhlcjogJ29mZicgfSB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1pZ3JhdGUoeyBxdWlja1N1Z2dlc3Rpb25zOiB7IGNvbW1lbnRzOiAnb24nLCBzdHJpbmdzOiAnb2ZmJyB9IH0pLCB7IHF1aWNrU3VnZ2VzdGlvbnM6IHsgY29tbWVudHM6ICdvbicsIHN0cmluZ3M6ICdvZmYnIH0gfSk7XG5cdH0pO1xuXHR0ZXN0KCdob3ZlcicsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1pZ3JhdGUoeyBob3ZlcjogdHJ1ZSB9KSwgeyBob3ZlcjogeyBlbmFibGVkOiB0cnVlIH0gfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtaWdyYXRlKHsgaG92ZXI6IGZhbHNlIH0pLCB7IGhvdmVyOiB7IGVuYWJsZWQ6IGZhbHNlIH0gfSk7XG5cdH0pO1xuXHR0ZXN0KCdwYXJhbWV0ZXJIaW50cycsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1pZ3JhdGUoeyBwYXJhbWV0ZXJIaW50czogdHJ1ZSB9KSwgeyBwYXJhbWV0ZXJIaW50czogeyBlbmFibGVkOiB0cnVlIH0gfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtaWdyYXRlKHsgcGFyYW1ldGVySGludHM6IGZhbHNlIH0pLCB7IHBhcmFtZXRlckhpbnRzOiB7IGVuYWJsZWQ6IGZhbHNlIH0gfSk7XG5cdH0pO1xuXHR0ZXN0KCdhdXRvSW5kZW50JywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWlncmF0ZSh7IGF1dG9JbmRlbnQ6IHRydWUgfSksIHsgYXV0b0luZGVudDogJ2Z1bGwnIH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWlncmF0ZSh7IGF1dG9JbmRlbnQ6IGZhbHNlIH0pLCB7IGF1dG9JbmRlbnQ6ICdhZHZhbmNlZCcgfSk7XG5cdH0pO1xuXHR0ZXN0KCdtYXRjaEJyYWNrZXRzJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWlncmF0ZSh7IG1hdGNoQnJhY2tldHM6IHRydWUgfSksIHsgbWF0Y2hCcmFja2V0czogJ2Fsd2F5cycgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtaWdyYXRlKHsgbWF0Y2hCcmFja2V0czogZmFsc2UgfSksIHsgbWF0Y2hCcmFja2V0czogJ25ldmVyJyB9KTtcblx0fSk7XG5cdHRlc3QoJ3JlbmRlckluZGVudEd1aWRlcywgaGlnaGxpZ2h0QWN0aXZlSW5kZW50R3VpZGUnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtaWdyYXRlKHsgcmVuZGVySW5kZW50R3VpZGVzOiB0cnVlIH0pLCB7IHJlbmRlckluZGVudEd1aWRlczogdW5kZWZpbmVkLCBndWlkZXM6IHsgaW5kZW50YXRpb246IHRydWUgfSB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1pZ3JhdGUoeyByZW5kZXJJbmRlbnRHdWlkZXM6IGZhbHNlIH0pLCB7IHJlbmRlckluZGVudEd1aWRlczogdW5kZWZpbmVkLCBndWlkZXM6IHsgaW5kZW50YXRpb246IGZhbHNlIH0gfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtaWdyYXRlKHsgaGlnaGxpZ2h0QWN0aXZlSW5kZW50R3VpZGU6IHRydWUgfSksIHsgaGlnaGxpZ2h0QWN0aXZlSW5kZW50R3VpZGU6IHVuZGVmaW5lZCwgZ3VpZGVzOiB7IGhpZ2hsaWdodEFjdGl2ZUluZGVudGF0aW9uOiB0cnVlIH0gfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtaWdyYXRlKHsgaGlnaGxpZ2h0QWN0aXZlSW5kZW50R3VpZGU6IGZhbHNlIH0pLCB7IGhpZ2hsaWdodEFjdGl2ZUluZGVudEd1aWRlOiB1bmRlZmluZWQsIGd1aWRlczogeyBoaWdobGlnaHRBY3RpdmVJbmRlbnRhdGlvbjogZmFsc2UgfSB9KTtcblx0fSk7XG5cblx0dGVzdCgnbWlncmF0aW9uIGRvZXMgbm90IG92ZXJ3cml0ZSBuZXcgc2V0dGluZycsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1pZ3JhdGUoeyByZW5kZXJJbmRlbnRHdWlkZXM6IHRydWUsIGd1aWRlczogeyBpbmRlbnRhdGlvbjogZmFsc2UgfSB9KSwgeyByZW5kZXJJbmRlbnRHdWlkZXM6IHVuZGVmaW5lZCwgZ3VpZGVzOiB7IGluZGVudGF0aW9uOiBmYWxzZSB9IH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWlncmF0ZSh7IGhpZ2hsaWdodEFjdGl2ZUluZGVudEd1aWRlOiB0cnVlLCBndWlkZXM6IHsgaGlnaGxpZ2h0QWN0aXZlSW5kZW50YXRpb246IGZhbHNlIH0gfSksIHsgaGlnaGxpZ2h0QWN0aXZlSW5kZW50R3VpZGU6IHVuZGVmaW5lZCwgZ3VpZGVzOiB7IGhpZ2hsaWdodEFjdGl2ZUluZGVudGF0aW9uOiBmYWxzZSB9IH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBRXhELFNBQVMsc0JBQXNCO0FBQy9CLFNBQW9DLG9CQUFtRTtBQUN2RyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDRC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QUEsTUFDTixRQUFRO0FBQUEsUUFDUCxTQUFTO0FBQUEsVUFDUixlQUFlO0FBQUEsWUFDZCxRQUFRO0FBQUEsWUFDUixVQUFVO0FBQUEsWUFDVixhQUFhO0FBQUEsWUFDYixZQUFZO0FBQUEsWUFDWixPQUFPO0FBQUEsWUFDUCxVQUFVO0FBQUEsWUFDVixPQUFPO0FBQUEsWUFDUCxRQUFRO0FBQUEsWUFDUixXQUFXO0FBQUEsWUFDWCxRQUFRO0FBQUEsWUFDUixVQUFVO0FBQUEsWUFDVixPQUFPO0FBQUEsWUFDUCxVQUFVO0FBQUEsWUFDVixNQUFNO0FBQUEsWUFDTixPQUFPO0FBQUEsWUFDUCxVQUFVO0FBQUEsWUFDVixNQUFNO0FBQUEsWUFDTixZQUFZO0FBQUEsWUFDWixTQUFTO0FBQUEsWUFDVCxNQUFNO0FBQUEsWUFDTixPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsWUFDTixXQUFXO0FBQUEsWUFDWCxRQUFRO0FBQUEsWUFDUixlQUFlO0FBQUEsWUFDZixTQUFTO0FBQUEsVUFDVjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFBQSxNQUFHO0FBQUEsUUFDSixTQUFTO0FBQUEsVUFDUixlQUFlO0FBQUEsVUFDZixhQUFhO0FBQUEsVUFDYixlQUFlO0FBQUEsVUFDZixrQkFBa0I7QUFBQSxVQUNsQixnQkFBZ0I7QUFBQSxVQUNoQixZQUFZO0FBQUEsVUFDWixlQUFlO0FBQUEsVUFDZixhQUFhO0FBQUEsVUFDYixhQUFhO0FBQUEsVUFDYixnQkFBZ0I7QUFBQSxVQUNoQixhQUFhO0FBQUEsVUFDYixnQkFBZ0I7QUFBQSxVQUNoQixZQUFZO0FBQUEsVUFDWixlQUFlO0FBQUEsVUFDZixXQUFXO0FBQUEsVUFDWCxZQUFZO0FBQUEsVUFDWixlQUFlO0FBQUEsVUFDZixXQUFXO0FBQUEsVUFDWCxpQkFBaUI7QUFBQSxVQUNqQixjQUFjO0FBQUEsVUFDZCxXQUFXO0FBQUEsVUFDWCxZQUFZO0FBQUEsVUFDWixXQUFXO0FBQUEsVUFDWCxnQkFBZ0I7QUFBQSxVQUNoQixhQUFhO0FBQUEsVUFDYixvQkFB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
