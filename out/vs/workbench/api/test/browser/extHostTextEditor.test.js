import assert from "assert";
import { Lazy } from "../../../../base/common/lazy.js";
import { URI } from "../../../../base/common/uri.js";
import { mock } from "../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { RenderLineNumbersType, TextEditorCursorStyle } from "../../../../editor/common/config/editorOptions.js";
import { NullLogService } from "../../../../platform/log/common/log.js";
import { ExtHostDocumentData } from "../../common/extHostDocumentData.js";
import { ExtHostTextEditor, ExtHostTextEditorOptions } from "../../common/extHostTextEditor.js";
import { Range, TextEditorLineNumbersStyle } from "../../common/extHostTypes.js";
suite("ExtHostTextEditor", () => {
  let editor;
  const doc = new ExtHostDocumentData(void 0, URI.file(""), [
    "aaaa bbbb+cccc abc"
  ], "\n", 1, "text", false, "utf8");
  setup(() => {
    editor = new ExtHostTextEditor("fake", null, new NullLogService(), new Lazy(() => doc.document), [], { cursorStyle: TextEditorCursorStyle.Line, insertSpaces: true, lineNumbers: 1, tabSize: 4, indentSize: 4, originalIndentSize: "tabSize" }, [], 1);
  });
  test("disposed editor", () => {
    assert.ok(editor.value.document);
    editor._acceptViewColumn(3);
    assert.strictEqual(3, editor.value.viewColumn);
    editor.dispose();
    assert.throws(() => editor._acceptViewColumn(2));
    assert.strictEqual(3, editor.value.viewColumn);
    assert.ok(editor.value.document);
    assert.throws(() => editor._acceptOptions(null));
    assert.throws(() => editor._acceptSelections([]));
  });
  test("API [bug]: registerTextEditorCommand clears redo stack even if no edits are made #55163", async function() {
    let applyCount = 0;
    const editor2 = new ExtHostTextEditor(
      "edt1",
      new class extends mock() {
        $tryApplyEdits() {
          applyCount += 1;
          return Promise.resolve(true);
        }
      }(),
      new NullLogService(),
      new Lazy(() => doc.document),
      [],
      { cursorStyle: TextEditorCursorStyle.Line, insertSpaces: true, lineNumbers: 1, tabSize: 4, indentSize: 4, originalIndentSize: "tabSize" },
      [],
      1
    );
    await editor2.value.edit((edit) => {
    });
    assert.strictEqual(applyCount, 0);
    await editor2.value.edit((edit) => {
      edit.setEndOfLine(1);
    });
    assert.strictEqual(applyCount, 1);
    await editor2.value.edit((edit) => {
      edit.delete(new Range(0, 0, 1, 1));
    });
    assert.strictEqual(applyCount, 2);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
suite("ExtHostTextEditorOptions", () => {
  let opts;
  let calls = [];
  setup(() => {
    calls = [];
    const mockProxy = {
      dispose: void 0,
      $trySetOptions: (id, options) => {
        assert.strictEqual(id, "1");
        calls.push(options);
        return Promise.resolve(void 0);
      },
      $tryShowTextDocument: void 0,
      $registerTextEditorDecorationType: void 0,
      $removeTextEditorDecorationType: void 0,
      $tryShowEditor: void 0,
      $tryHideEditor: void 0,
      $trySetDecorations: void 0,
      $trySetDecorationsFast: void 0,
      $tryRevealRange: void 0,
      $trySetSelections: void 0,
      $tryApplyEdits: void 0,
      $tryInsertSnippet: void 0,
      $getDiffInformation: void 0
    };
    opts = new ExtHostTextEditorOptions(mockProxy, "1", {
      tabSize: 4,
      indentSize: 4,
      originalIndentSize: "tabSize",
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    }, new NullLogService());
  });
  teardown(() => {
    opts = null;
    calls = null;
  });
  function assertState(opts2, expected) {
    const actual = {
      tabSize: opts2.value.tabSize,
      indentSize: opts2.value.indentSize,
      insertSpaces: opts2.value.insertSpaces,
      cursorStyle: opts2.value.cursorStyle,
      lineNumbers: opts2.value.lineNumbers
    };
    assert.deepStrictEqual(actual, expected);
  }
  test("can set tabSize to the same value", () => {
    opts.value.tabSize = 4;
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, []);
  });
  test("can change tabSize to positive integer", () => {
    opts.value.tabSize = 1;
    assertState(opts, {
      tabSize: 1,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ tabSize: 1 }]);
  });
  test("can change tabSize to positive float", () => {
    opts.value.tabSize = 2.3;
    assertState(opts, {
      tabSize: 2,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ tabSize: 2 }]);
  });
  test("can change tabSize to a string number", () => {
    opts.value.tabSize = "2";
    assertState(opts, {
      tabSize: 2,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ tabSize: 2 }]);
  });
  test("tabSize can request indentation detection", () => {
    opts.value.tabSize = "auto";
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ tabSize: "auto" }]);
  });
  test("ignores invalid tabSize 1", () => {
    opts.value.tabSize = null;
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, []);
  });
  test("ignores invalid tabSize 2", () => {
    opts.value.tabSize = -5;
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, []);
  });
  test("ignores invalid tabSize 3", () => {
    opts.value.tabSize = "hello";
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, []);
  });
  test("ignores invalid tabSize 4", () => {
    opts.value.tabSize = "-17";
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, []);
  });
  test("can set indentSize to the same value", () => {
    opts.value.indentSize = 4;
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ indentSize: 4 }]);
  });
  test("can change indentSize to positive integer", () => {
    opts.value.indentSize = 1;
    assertState(opts, {
      tabSize: 4,
      indentSize: 1,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ indentSize: 1 }]);
  });
  test("can change indentSize to positive float", () => {
    opts.value.indentSize = 2.3;
    assertState(opts, {
      tabSize: 4,
      indentSize: 2,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ indentSize: 2 }]);
  });
  test("can change indentSize to a string number", () => {
    opts.value.indentSize = "2";
    assertState(opts, {
      tabSize: 4,
      indentSize: 2,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ indentSize: 2 }]);
  });
  test("indentSize can request to use tabSize", () => {
    opts.value.indentSize = "tabSize";
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ indentSize: "tabSize" }]);
  });
  test("indentSize cannot request indentation detection", () => {
    opts.value.indentSize = "auto";
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, []);
  });
  test("ignores invalid indentSize 1", () => {
    opts.value.indentSize = null;
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, []);
  });
  test("ignores invalid indentSize 2", () => {
    opts.value.indentSize = -5;
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, []);
  });
  test("ignores invalid indentSize 3", () => {
    opts.value.indentSize = "hello";
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, []);
  });
  test("ignores invalid indentSize 4", () => {
    opts.value.indentSize = "-17";
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, []);
  });
  test("can set insertSpaces to the same value", () => {
    opts.value.insertSpaces = false;
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, []);
  });
  test("can set insertSpaces to boolean", () => {
    opts.value.insertSpaces = true;
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: true,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ insertSpaces: true }]);
  });
  test("can set insertSpaces to false string", () => {
    opts.value.insertSpaces = "false";
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, []);
  });
  test("can set insertSpaces to truey", () => {
    opts.value.insertSpaces = "hello";
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: true,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ insertSpaces: true }]);
  });
  test("insertSpaces can request indentation detection", () => {
    opts.value.insertSpaces = "auto";
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ insertSpaces: "auto" }]);
  });
  test("can set cursorStyle to same value", () => {
    opts.value.cursorStyle = TextEditorCursorStyle.Line;
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, []);
  });
  test("can change cursorStyle", () => {
    opts.value.cursorStyle = TextEditorCursorStyle.Block;
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Block,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ cursorStyle: TextEditorCursorStyle.Block }]);
  });
  test("can set lineNumbers to same value", () => {
    opts.value.lineNumbers = TextEditorLineNumbersStyle.On;
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, []);
  });
  test("can change lineNumbers", () => {
    opts.value.lineNumbers = TextEditorLineNumbersStyle.Off;
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.Off
    });
    assert.deepStrictEqual(calls, [{ lineNumbers: RenderLineNumbersType.Off }]);
  });
  test("can do bulk updates 0", () => {
    opts.assign({
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: TextEditorLineNumbersStyle.On
    });
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ indentSize: 4 }]);
  });
  test("can do bulk updates 1", () => {
    opts.assign({
      tabSize: "auto",
      insertSpaces: true
    });
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: true,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ tabSize: "auto", insertSpaces: true }]);
  });
  test("can do bulk updates 2", () => {
    opts.assign({
      tabSize: 3,
      insertSpaces: "auto"
    });
    assertState(opts, {
      tabSize: 3,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Line,
      lineNumbers: RenderLineNumbersType.On
    });
    assert.deepStrictEqual(calls, [{ tabSize: 3, insertSpaces: "auto" }]);
  });
  test("can do bulk updates 3", () => {
    opts.assign({
      cursorStyle: TextEditorCursorStyle.Block,
      lineNumbers: TextEditorLineNumbersStyle.Relative
    });
    assertState(opts, {
      tabSize: 4,
      indentSize: 4,
      insertSpaces: false,
      cursorStyle: TextEditorCursorStyle.Block,
      lineNumbers: RenderLineNumbersType.Relative
    });
    assert.deepStrictEqual(calls, [{ cursorStyle: TextEditorCursorStyle.Block, lineNumbers: RenderLineNumbersType.Relative }]);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0VGV4dEVkaXRvci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IExhenkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYXp5LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgUmVuZGVyTGluZU51bWJlcnNUeXBlLCBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVJlc29sdmVkVGV4dEVkaXRvckNvbmZpZ3VyYXRpb24sIElUZXh0RWRpdG9yQ29uZmlndXJhdGlvblVwZGF0ZSwgTWFpblRocmVhZFRleHRFZGl0b3JzU2hhcGUgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0RG9jdW1lbnREYXRhIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3REb2N1bWVudERhdGEuanMnO1xuaW1wb3J0IHsgRXh0SG9zdFRleHRFZGl0b3IsIEV4dEhvc3RUZXh0RWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0VGV4dEVkaXRvci5qcyc7XG5pbXBvcnQgeyBSYW5nZSwgVGV4dEVkaXRvckxpbmVOdW1iZXJzU3R5bGUgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdFR5cGVzLmpzJztcblxuc3VpdGUoJ0V4dEhvc3RUZXh0RWRpdG9yJywgKCkgPT4ge1xuXG5cdGxldCBlZGl0b3I6IEV4dEhvc3RUZXh0RWRpdG9yO1xuXHRjb25zdCBkb2MgPSBuZXcgRXh0SG9zdERvY3VtZW50RGF0YSh1bmRlZmluZWQhLCBVUkkuZmlsZSgnJyksIFtcblx0XHQnYWFhYSBiYmJiK2NjY2MgYWJjJ1xuXHRdLCAnXFxuJywgMSwgJ3RleHQnLCBmYWxzZSwgJ3V0ZjgnKTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZWRpdG9yID0gbmV3IEV4dEhvc3RUZXh0RWRpdG9yKCdmYWtlJywgbnVsbCEsIG5ldyBOdWxsTG9nU2VydmljZSgpLCBuZXcgTGF6eSgoKSA9PiBkb2MuZG9jdW1lbnQpLCBbXSwgeyBjdXJzb3JTdHlsZTogVGV4dEVkaXRvckN1cnNvclN0eWxlLkxpbmUsIGluc2VydFNwYWNlczogdHJ1ZSwgbGluZU51bWJlcnM6IDEsIHRhYlNpemU6IDQsIGluZGVudFNpemU6IDQsIG9yaWdpbmFsSW5kZW50U2l6ZTogJ3RhYlNpemUnIH0sIFtdLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnZGlzcG9zZWQgZWRpdG9yJywgKCkgPT4ge1xuXG5cdFx0YXNzZXJ0Lm9rKGVkaXRvci52YWx1ZS5kb2N1bWVudCk7XG5cdFx0ZWRpdG9yLl9hY2NlcHRWaWV3Q29sdW1uKDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgzLCBlZGl0b3IudmFsdWUudmlld0NvbHVtbik7XG5cblx0XHRlZGl0b3IuZGlzcG9zZSgpO1xuXG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBlZGl0b3IuX2FjY2VwdFZpZXdDb2x1bW4oMikpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgzLCBlZGl0b3IudmFsdWUudmlld0NvbHVtbik7XG5cblx0XHRhc3NlcnQub2soZWRpdG9yLnZhbHVlLmRvY3VtZW50KTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IGVkaXRvci5fYWNjZXB0T3B0aW9ucyhudWxsISkpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gZWRpdG9yLl9hY2NlcHRTZWxlY3Rpb25zKFtdKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0FQSSBbYnVnXTogcmVnaXN0ZXJUZXh0RWRpdG9yQ29tbWFuZCBjbGVhcnMgcmVkbyBzdGFjayBldmVuIGlmIG5vIGVkaXRzIGFyZSBtYWRlICM1NTE2MycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgYXBwbHlDb3VudCA9IDA7XG5cdFx0Y29uc3QgZWRpdG9yID0gbmV3IEV4dEhvc3RUZXh0RWRpdG9yKCdlZHQxJyxcblx0XHRcdG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZFRleHRFZGl0b3JzU2hhcGU+KCkge1xuXHRcdFx0XHRvdmVycmlkZSAkdHJ5QXBwbHlFZGl0cygpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRcdFx0XHRhcHBseUNvdW50ICs9IDE7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgbmV3IE51bGxMb2dTZXJ2aWNlKCksIG5ldyBMYXp5KCgpID0+IGRvYy5kb2N1bWVudCksIFtdLCB7IGN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZSwgaW5zZXJ0U3BhY2VzOiB0cnVlLCBsaW5lTnVtYmVyczogMSwgdGFiU2l6ZTogNCwgaW5kZW50U2l6ZTogNCwgb3JpZ2luYWxJbmRlbnRTaXplOiAndGFiU2l6ZScgfSwgW10sIDEpO1xuXG5cdFx0YXdhaXQgZWRpdG9yLnZhbHVlLmVkaXQoZWRpdCA9PiB7IH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUNvdW50LCAwKTtcblxuXHRcdGF3YWl0IGVkaXRvci52YWx1ZS5lZGl0KGVkaXQgPT4geyBlZGl0LnNldEVuZE9mTGluZSgxKTsgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGx5Q291bnQsIDEpO1xuXG5cdFx0YXdhaXQgZWRpdG9yLnZhbHVlLmVkaXQoZWRpdCA9PiB7IGVkaXQuZGVsZXRlKG5ldyBSYW5nZSgwLCAwLCAxLCAxKSk7IH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUNvdW50LCAyKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcblxuc3VpdGUoJ0V4dEhvc3RUZXh0RWRpdG9yT3B0aW9ucycsICgpID0+IHtcblxuXHRsZXQgb3B0czogRXh0SG9zdFRleHRFZGl0b3JPcHRpb25zO1xuXHRsZXQgY2FsbHM6IElUZXh0RWRpdG9yQ29uZmlndXJhdGlvblVwZGF0ZVtdID0gW107XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGNhbGxzID0gW107XG5cdFx0Y29uc3QgbW9ja1Byb3h5OiBNYWluVGhyZWFkVGV4dEVkaXRvcnNTaGFwZSA9IHtcblx0XHRcdGRpc3Bvc2U6IHVuZGVmaW5lZCEsXG5cdFx0XHQkdHJ5U2V0T3B0aW9uczogKGlkOiBzdHJpbmcsIG9wdGlvbnM6IElUZXh0RWRpdG9yQ29uZmlndXJhdGlvblVwZGF0ZSkgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaWQsICcxJyk7XG5cdFx0XHRcdGNhbGxzLnB1c2gob3B0aW9ucyk7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdH0sXG5cdFx0XHQkdHJ5U2hvd1RleHREb2N1bWVudDogdW5kZWZpbmVkISxcblx0XHRcdCRyZWdpc3RlclRleHRFZGl0b3JEZWNvcmF0aW9uVHlwZTogdW5kZWZpbmVkISxcblx0XHRcdCRyZW1vdmVUZXh0RWRpdG9yRGVjb3JhdGlvblR5cGU6IHVuZGVmaW5lZCEsXG5cdFx0XHQkdHJ5U2hvd0VkaXRvcjogdW5kZWZpbmVkISxcblx0XHRcdCR0cnlIaWRlRWRpdG9yOiB1bmRlZmluZWQhLFxuXHRcdFx0JHRyeVNldERlY29yYXRpb25zOiB1bmRlZmluZWQhLFxuXHRcdFx0JHRyeVNldERlY29yYXRpb25zRmFzdDogdW5kZWZpbmVkISxcblx0XHRcdCR0cnlSZXZlYWxSYW5nZTogdW5kZWZpbmVkISxcblx0XHRcdCR0cnlTZXRTZWxlY3Rpb25zOiB1bmRlZmluZWQhLFxuXHRcdFx0JHRyeUFwcGx5RWRpdHM6IHVuZGVmaW5lZCEsXG5cdFx0XHQkdHJ5SW5zZXJ0U25pcHBldDogdW5kZWZpbmVkISxcblx0XHRcdCRnZXREaWZmSW5mb3JtYXRpb246IHVuZGVmaW5lZCFcblx0XHR9O1xuXHRcdG9wdHMgPSBuZXcgRXh0SG9zdFRleHRFZGl0b3JPcHRpb25zKG1vY2tQcm94eSwgJzEnLCB7XG5cdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0aW5kZW50U2l6ZTogNCxcblx0XHRcdG9yaWdpbmFsSW5kZW50U2l6ZTogJ3RhYlNpemUnLFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdGN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZSxcblx0XHRcdGxpbmVOdW1iZXJzOiBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT25cblx0XHR9LCBuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRvcHRzID0gbnVsbCE7XG5cdFx0Y2FsbHMgPSBudWxsITtcblx0fSk7XG5cblx0ZnVuY3Rpb24gYXNzZXJ0U3RhdGUob3B0czogRXh0SG9zdFRleHRFZGl0b3JPcHRpb25zLCBleHBlY3RlZDogT21pdDxJUmVzb2x2ZWRUZXh0RWRpdG9yQ29uZmlndXJhdGlvbiwgJ29yaWdpbmFsSW5kZW50U2l6ZSc+KTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0dWFsID0ge1xuXHRcdFx0dGFiU2l6ZTogb3B0cy52YWx1ZS50YWJTaXplLFxuXHRcdFx0aW5kZW50U2l6ZTogb3B0cy52YWx1ZS5pbmRlbnRTaXplLFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiBvcHRzLnZhbHVlLmluc2VydFNwYWNlcyxcblx0XHRcdGN1cnNvclN0eWxlOiBvcHRzLnZhbHVlLmN1cnNvclN0eWxlLFxuXHRcdFx0bGluZU51bWJlcnM6IG9wdHMudmFsdWUubGluZU51bWJlcnNcblx0XHR9O1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG5cdH1cblxuXHR0ZXN0KCdjYW4gc2V0IHRhYlNpemUgdG8gdGhlIHNhbWUgdmFsdWUnLCAoKSA9PiB7XG5cdFx0b3B0cy52YWx1ZS50YWJTaXplID0gNDtcblx0XHRhc3NlcnRTdGF0ZShvcHRzLCB7XG5cdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0aW5kZW50U2l6ZTogNCxcblx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHRjdXJzb3JTdHlsZTogVGV4dEVkaXRvckN1cnNvclN0eWxlLkxpbmUsXG5cdFx0XHRsaW5lTnVtYmVyczogUmVuZGVyTGluZU51bWJlcnNUeXBlLk9uXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdjYW4gY2hhbmdlIHRhYlNpemUgdG8gcG9zaXRpdmUgaW50ZWdlcicsICgpID0+IHtcblx0XHRvcHRzLnZhbHVlLnRhYlNpemUgPSAxO1xuXHRcdGFzc2VydFN0YXRlKG9wdHMsIHtcblx0XHRcdHRhYlNpemU6IDEsXG5cdFx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdGN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZSxcblx0XHRcdGxpbmVOdW1iZXJzOiBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT25cblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbeyB0YWJTaXplOiAxIH1dKTtcblx0fSk7XG5cblx0dGVzdCgnY2FuIGNoYW5nZSB0YWJTaXplIHRvIHBvc2l0aXZlIGZsb2F0JywgKCkgPT4ge1xuXHRcdG9wdHMudmFsdWUudGFiU2l6ZSA9IDIuMztcblx0XHRhc3NlcnRTdGF0ZShvcHRzLCB7XG5cdFx0XHR0YWJTaXplOiAyLFxuXHRcdFx0aW5kZW50U2l6ZTogNCxcblx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHRjdXJzb3JTdHlsZTogVGV4dEVkaXRvckN1cnNvclN0eWxlLkxpbmUsXG5cdFx0XHRsaW5lTnVtYmVyczogUmVuZGVyTGluZU51bWJlcnNUeXBlLk9uXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgW3sgdGFiU2l6ZTogMiB9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbiBjaGFuZ2UgdGFiU2l6ZSB0byBhIHN0cmluZyBudW1iZXInLCAoKSA9PiB7XG5cdFx0b3B0cy52YWx1ZS50YWJTaXplID0gJzInO1xuXHRcdGFzc2VydFN0YXRlKG9wdHMsIHtcblx0XHRcdHRhYlNpemU6IDIsXG5cdFx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdGN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZSxcblx0XHRcdGxpbmVOdW1iZXJzOiBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT25cblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbeyB0YWJTaXplOiAyIH1dKTtcblx0fSk7XG5cblx0dGVzdCgndGFiU2l6ZSBjYW4gcmVxdWVzdCBpbmRlbnRhdGlvbiBkZXRlY3Rpb24nLCAoKSA9PiB7XG5cdFx0b3B0cy52YWx1ZS50YWJTaXplID0gJ2F1dG8nO1xuXHRcdGFzc2VydFN0YXRlKG9wdHMsIHtcblx0XHRcdHRhYlNpemU6IDQsXG5cdFx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdGN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZSxcblx0XHRcdGxpbmVOdW1iZXJzOiBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT25cblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbeyB0YWJTaXplOiAnYXV0bycgfV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpZ25vcmVzIGludmFsaWQgdGFiU2l6ZSAxJywgKCkgPT4ge1xuXHRcdG9wdHMudmFsdWUudGFiU2l6ZSA9IG51bGwhO1xuXHRcdGFzc2VydFN0YXRlKG9wdHMsIHtcblx0XHRcdHRhYlNpemU6IDQsXG5cdFx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdGN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZSxcblx0XHRcdGxpbmVOdW1iZXJzOiBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT25cblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lnbm9yZXMgaW52YWxpZCB0YWJTaXplIDInLCAoKSA9PiB7XG5cdFx0b3B0cy52YWx1ZS50YWJTaXplID0gLTU7XG5cdFx0YXNzZXJ0U3RhdGUob3B0cywge1xuXHRcdFx0dGFiU2l6ZTogNCxcblx0XHRcdGluZGVudFNpemU6IDQsXG5cdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0Y3Vyc29yU3R5bGU6IFRleHRFZGl0b3JDdXJzb3JTdHlsZS5MaW5lLFxuXHRcdFx0bGluZU51bWJlcnM6IFJlbmRlckxpbmVOdW1iZXJzVHlwZS5PblxuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnaWdub3JlcyBpbnZhbGlkIHRhYlNpemUgMycsICgpID0+IHtcblx0XHRvcHRzLnZhbHVlLnRhYlNpemUgPSAnaGVsbG8nO1xuXHRcdGFzc2VydFN0YXRlKG9wdHMsIHtcblx0XHRcdHRhYlNpemU6IDQsXG5cdFx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdGN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZSxcblx0XHRcdGxpbmVOdW1iZXJzOiBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT25cblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lnbm9yZXMgaW52YWxpZCB0YWJTaXplIDQnLCAoKSA9PiB7XG5cdFx0b3B0cy52YWx1ZS50YWJTaXplID0gJy0xNyc7XG5cdFx0YXNzZXJ0U3RhdGUob3B0cywge1xuXHRcdFx0dGFiU2l6ZTogNCxcblx0XHRcdGluZGVudFNpemU6IDQsXG5cdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0Y3Vyc29yU3R5bGU6IFRleHRFZGl0b3JDdXJzb3JTdHlsZS5MaW5lLFxuXHRcdFx0bGluZU51bWJlcnM6IFJlbmRlckxpbmVOdW1iZXJzVHlwZS5PblxuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnY2FuIHNldCBpbmRlbnRTaXplIHRvIHRoZSBzYW1lIHZhbHVlJywgKCkgPT4ge1xuXHRcdG9wdHMudmFsdWUuaW5kZW50U2l6ZSA9IDQ7XG5cdFx0YXNzZXJ0U3RhdGUob3B0cywge1xuXHRcdFx0dGFiU2l6ZTogNCxcblx0XHRcdGluZGVudFNpemU6IDQsXG5cdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0Y3Vyc29yU3R5bGU6IFRleHRFZGl0b3JDdXJzb3JTdHlsZS5MaW5lLFxuXHRcdFx0bGluZU51bWJlcnM6IFJlbmRlckxpbmVOdW1iZXJzVHlwZS5PblxuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFt7IGluZGVudFNpemU6IDQgfV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjYW4gY2hhbmdlIGluZGVudFNpemUgdG8gcG9zaXRpdmUgaW50ZWdlcicsICgpID0+IHtcblx0XHRvcHRzLnZhbHVlLmluZGVudFNpemUgPSAxO1xuXHRcdGFzc2VydFN0YXRlKG9wdHMsIHtcblx0XHRcdHRhYlNpemU6IDQsXG5cdFx0XHRpbmRlbnRTaXplOiAxLFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdGN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZSxcblx0XHRcdGxpbmVOdW1iZXJzOiBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT25cblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbeyBpbmRlbnRTaXplOiAxIH1dKTtcblx0fSk7XG5cblx0dGVzdCgnY2FuIGNoYW5nZSBpbmRlbnRTaXplIHRvIHBvc2l0aXZlIGZsb2F0JywgKCkgPT4ge1xuXHRcdG9wdHMudmFsdWUuaW5kZW50U2l6ZSA9IDIuMztcblx0XHRhc3NlcnRTdGF0ZShvcHRzLCB7XG5cdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0aW5kZW50U2l6ZTogMixcblx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHRjdXJzb3JTdHlsZTogVGV4dEVkaXRvckN1cnNvclN0eWxlLkxpbmUsXG5cdFx0XHRsaW5lTnVtYmVyczogUmVuZGVyTGluZU51bWJlcnNUeXBlLk9uXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgW3sgaW5kZW50U2l6ZTogMiB9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbiBjaGFuZ2UgaW5kZW50U2l6ZSB0byBhIHN0cmluZyBudW1iZXInLCAoKSA9PiB7XG5cdFx0b3B0cy52YWx1ZS5pbmRlbnRTaXplID0gPGFueT4nMic7XG5cdFx0YXNzZXJ0U3RhdGUob3B0cywge1xuXHRcdFx0dGFiU2l6ZTogNCxcblx0XHRcdGluZGVudFNpemU6IDIsXG5cdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0Y3Vyc29yU3R5bGU6IFRleHRFZGl0b3JDdXJzb3JTdHlsZS5MaW5lLFxuXHRcdFx0bGluZU51bWJlcnM6IFJlbmRlckxpbmVOdW1iZXJzVHlwZS5PblxuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFt7IGluZGVudFNpemU6IDIgfV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpbmRlbnRTaXplIGNhbiByZXF1ZXN0IHRvIHVzZSB0YWJTaXplJywgKCkgPT4ge1xuXHRcdG9wdHMudmFsdWUuaW5kZW50U2l6ZSA9ICd0YWJTaXplJztcblx0XHRhc3NlcnRTdGF0ZShvcHRzLCB7XG5cdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0aW5kZW50U2l6ZTogNCxcblx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHRjdXJzb3JTdHlsZTogVGV4dEVkaXRvckN1cnNvclN0eWxlLkxpbmUsXG5cdFx0XHRsaW5lTnVtYmVyczogUmVuZGVyTGluZU51bWJlcnNUeXBlLk9uXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgW3sgaW5kZW50U2l6ZTogJ3RhYlNpemUnIH1dKTtcblx0fSk7XG5cblx0dGVzdCgnaW5kZW50U2l6ZSBjYW5ub3QgcmVxdWVzdCBpbmRlbnRhdGlvbiBkZXRlY3Rpb24nLCAoKSA9PiB7XG5cdFx0b3B0cy52YWx1ZS5pbmRlbnRTaXplID0gPGFueT4nYXV0byc7XG5cdFx0YXNzZXJ0U3RhdGUob3B0cywge1xuXHRcdFx0dGFiU2l6ZTogNCxcblx0XHRcdGluZGVudFNpemU6IDQsXG5cdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0Y3Vyc29yU3R5bGU6IFRleHRFZGl0b3JDdXJzb3JTdHlsZS5MaW5lLFxuXHRcdFx0bGluZU51bWJlcnM6IFJlbmRlckxpbmVOdW1iZXJzVHlwZS5PblxuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnaWdub3JlcyBpbnZhbGlkIGluZGVudFNpemUgMScsICgpID0+IHtcblx0XHRvcHRzLnZhbHVlLmluZGVudFNpemUgPSBudWxsITtcblx0XHRhc3NlcnRTdGF0ZShvcHRzLCB7XG5cdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0aW5kZW50U2l6ZTogNCxcblx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHRjdXJzb3JTdHlsZTogVGV4dEVkaXRvckN1cnNvclN0eWxlLkxpbmUsXG5cdFx0XHRsaW5lTnVtYmVyczogUmVuZGVyTGluZU51bWJlcnNUeXBlLk9uXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdpZ25vcmVzIGludmFsaWQgaW5kZW50U2l6ZSAyJywgKCkgPT4ge1xuXHRcdG9wdHMudmFsdWUuaW5kZW50U2l6ZSA9IC01O1xuXHRcdGFzc2VydFN0YXRlKG9wdHMsIHtcblx0XHRcdHRhYlNpemU6IDQsXG5cdFx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdGN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZSxcblx0XHRcdGxpbmVOdW1iZXJzOiBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT25cblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lnbm9yZXMgaW52YWxpZCBpbmRlbnRTaXplIDMnLCAoKSA9PiB7XG5cdFx0b3B0cy52YWx1ZS5pbmRlbnRTaXplID0gPGFueT4naGVsbG8nO1xuXHRcdGFzc2VydFN0YXRlKG9wdHMsIHtcblx0XHRcdHRhYlNpemU6IDQsXG5cdFx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdGN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZSxcblx0XHRcdGxpbmVOdW1iZXJzOiBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT25cblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lnbm9yZXMgaW52YWxpZCBpbmRlbnRTaXplIDQnLCAoKSA9PiB7XG5cdFx0b3B0cy52YWx1ZS5pbmRlbnRTaXplID0gPGFueT4nLTE3Jztcblx0XHRhc3NlcnRTdGF0ZShvcHRzLCB7XG5cdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0aW5kZW50U2l6ZTogNCxcblx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHRjdXJzb3JTdHlsZTogVGV4dEVkaXRvckN1cnNvclN0eWxlLkxpbmUsXG5cdFx0XHRsaW5lTnVtYmVyczogUmVuZGVyTGluZU51bWJlcnNUeXBlLk9uXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdjYW4gc2V0IGluc2VydFNwYWNlcyB0byB0aGUgc2FtZSB2YWx1ZScsICgpID0+IHtcblx0XHRvcHRzLnZhbHVlLmluc2VydFNwYWNlcyA9IGZhbHNlO1xuXHRcdGFzc2VydFN0YXRlKG9wdHMsIHtcblx0XHRcdHRhYlNpemU6IDQsXG5cdFx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdGN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZSxcblx0XHRcdGxpbmVOdW1iZXJzOiBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT25cblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbiBzZXQgaW5zZXJ0U3BhY2VzIHRvIGJvb2xlYW4nLCAoKSA9PiB7XG5cdFx0b3B0cy52YWx1ZS5pbnNlcnRTcGFjZXMgPSB0cnVlO1xuXHRcdGFzc2VydFN0YXRlKG9wdHMsIHtcblx0XHRcdHRhYlNpemU6IDQsXG5cdFx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiB0cnVlLFxuXHRcdFx0Y3Vyc29yU3R5bGU6IFRleHRFZGl0b3JDdXJzb3JTdHlsZS5MaW5lLFxuXHRcdFx0bGluZU51bWJlcnM6IFJlbmRlckxpbmVOdW1iZXJzVHlwZS5PblxuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFt7IGluc2VydFNwYWNlczogdHJ1ZSB9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbiBzZXQgaW5zZXJ0U3BhY2VzIHRvIGZhbHNlIHN0cmluZycsICgpID0+IHtcblx0XHRvcHRzLnZhbHVlLmluc2VydFNwYWNlcyA9ICdmYWxzZSc7XG5cdFx0YXNzZXJ0U3RhdGUob3B0cywge1xuXHRcdFx0dGFiU2l6ZTogNCxcblx0XHRcdGluZGVudFNpemU6IDQsXG5cdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0Y3Vyc29yU3R5bGU6IFRleHRFZGl0b3JDdXJzb3JTdHlsZS5MaW5lLFxuXHRcdFx0bGluZU51bWJlcnM6IFJlbmRlckxpbmVOdW1iZXJzVHlwZS5PblxuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnY2FuIHNldCBpbnNlcnRTcGFjZXMgdG8gdHJ1ZXknLCAoKSA9PiB7XG5cdFx0b3B0cy52YWx1ZS5pbnNlcnRTcGFjZXMgPSAnaGVsbG8nO1xuXHRcdGFzc2VydFN0YXRlKG9wdHMsIHtcblx0XHRcdHRhYlNpemU6IDQsXG5cdFx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiB0cnVlLFxuXHRcdFx0Y3Vyc29yU3R5bGU6IFRleHRFZGl0b3JDdXJzb3JTdHlsZS5MaW5lLFxuXHRcdFx0bGluZU51bWJlcnM6IFJlbmRlckxpbmVOdW1iZXJzVHlwZS5PblxuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFt7IGluc2VydFNwYWNlczogdHJ1ZSB9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydFNwYWNlcyBjYW4gcmVxdWVzdCBpbmRlbnRhdGlvbiBkZXRlY3Rpb24nLCAoKSA9PiB7XG5cdFx0b3B0cy52YWx1ZS5pbnNlcnRTcGFjZXMgPSAnYXV0byc7XG5cdFx0YXNzZXJ0U3RhdGUob3B0cywge1xuXHRcdFx0dGFiU2l6ZTogNCxcblx0XHRcdGluZGVudFNpemU6IDQsXG5cdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0Y3Vyc29yU3R5bGU6IFRleHRFZGl0b3JDdXJzb3JTdHlsZS5MaW5lLFxuXHRcdFx0bGluZU51bWJlcnM6IFJlbmRlckxpbmVOdW1iZXJzVHlwZS5PblxuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFt7IGluc2VydFNwYWNlczogJ2F1dG8nIH1dKTtcblx0fSk7XG5cblx0dGVzdCgnY2FuIHNldCBjdXJzb3JTdHlsZSB0byBzYW1lIHZhbHVlJywgKCkgPT4ge1xuXHRcdG9wdHMudmFsdWUuY3Vyc29yU3R5bGUgPSBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZTtcblx0XHRhc3NlcnRTdGF0ZShvcHRzLCB7XG5cdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0aW5kZW50U2l6ZTogNCxcblx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHRjdXJzb3JTdHlsZTogVGV4dEVkaXRvckN1cnNvclN0eWxlLkxpbmUsXG5cdFx0XHRsaW5lTnVtYmVyczogUmVuZGVyTGluZU51bWJlcnNUeXBlLk9uXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdjYW4gY2hhbmdlIGN1cnNvclN0eWxlJywgKCkgPT4ge1xuXHRcdG9wdHMudmFsdWUuY3Vyc29yU3R5bGUgPSBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuQmxvY2s7XG5cdFx0YXNzZXJ0U3RhdGUob3B0cywge1xuXHRcdFx0dGFiU2l6ZTogNCxcblx0XHRcdGluZGVudFNpemU6IDQsXG5cdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0Y3Vyc29yU3R5bGU6IFRleHRFZGl0b3JDdXJzb3JTdHlsZS5CbG9jayxcblx0XHRcdGxpbmVOdW1iZXJzOiBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT25cblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbeyBjdXJzb3JTdHlsZTogVGV4dEVkaXRvckN1cnNvclN0eWxlLkJsb2NrIH1dKTtcblx0fSk7XG5cblx0dGVzdCgnY2FuIHNldCBsaW5lTnVtYmVycyB0byBzYW1lIHZhbHVlJywgKCkgPT4ge1xuXHRcdG9wdHMudmFsdWUubGluZU51bWJlcnMgPSBUZXh0RWRpdG9yTGluZU51bWJlcnNTdHlsZS5Pbjtcblx0XHRhc3NlcnRTdGF0ZShvcHRzLCB7XG5cdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0aW5kZW50U2l6ZTogNCxcblx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHRjdXJzb3JTdHlsZTogVGV4dEVkaXRvckN1cnNvclN0eWxlLkxpbmUsXG5cdFx0XHRsaW5lTnVtYmVyczogUmVuZGVyTGluZU51bWJlcnNUeXBlLk9uXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdjYW4gY2hhbmdlIGxpbmVOdW1iZXJzJywgKCkgPT4ge1xuXHRcdG9wdHMudmFsdWUubGluZU51bWJlcnMgPSBUZXh0RWRpdG9yTGluZU51bWJlcnNTdHlsZS5PZmY7XG5cdFx0YXNzZXJ0U3RhdGUob3B0cywge1xuXHRcdFx0dGFiU2l6ZTogNCxcblx0XHRcdGluZGVudFNpemU6IDQsXG5cdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0Y3Vyc29yU3R5bGU6IFRleHRFZGl0b3JDdXJzb3JTdHlsZS5MaW5lLFxuXHRcdFx0bGluZU51bWJlcnM6IFJlbmRlckxpbmVOdW1iZXJzVHlwZS5PZmZcblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbeyBsaW5lTnVtYmVyczogUmVuZGVyTGluZU51bWJlcnNUeXBlLk9mZiB9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbiBkbyBidWxrIHVwZGF0ZXMgMCcsICgpID0+IHtcblx0XHRvcHRzLmFzc2lnbih7XG5cdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0aW5kZW50U2l6ZTogNCxcblx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHRjdXJzb3JTdHlsZTogVGV4dEVkaXRvckN1cnNvclN0eWxlLkxpbmUsXG5cdFx0XHRsaW5lTnVtYmVyczogVGV4dEVkaXRvckxpbmVOdW1iZXJzU3R5bGUuT25cblx0XHR9KTtcblx0XHRhc3NlcnRTdGF0ZShvcHRzLCB7XG5cdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0aW5kZW50U2l6ZTogNCxcblx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHRjdXJzb3JTdHlsZTogVGV4dEVkaXRvckN1cnNvclN0eWxlLkxpbmUsXG5cdFx0XHRsaW5lTnVtYmVyczogUmVuZGVyTGluZU51bWJlcnNUeXBlLk9uXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgW3sgaW5kZW50U2l6ZTogNCB9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbiBkbyBidWxrIHVwZGF0ZXMgMScsICgpID0+IHtcblx0XHRvcHRzLmFzc2lnbih7XG5cdFx0XHR0YWJTaXplOiAnYXV0bycsXG5cdFx0XHRpbnNlcnRTcGFjZXM6IHRydWVcblx0XHR9KTtcblx0XHRhc3NlcnRTdGF0ZShvcHRzLCB7XG5cdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0aW5kZW50U2l6ZTogNCxcblx0XHRcdGluc2VydFNwYWNlczogdHJ1ZSxcblx0XHRcdGN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZSxcblx0XHRcdGxpbmVOdW1iZXJzOiBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT25cblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbeyB0YWJTaXplOiAnYXV0bycsIGluc2VydFNwYWNlczogdHJ1ZSB9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbiBkbyBidWxrIHVwZGF0ZXMgMicsICgpID0+IHtcblx0XHRvcHRzLmFzc2lnbih7XG5cdFx0XHR0YWJTaXplOiAzLFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiAnYXV0bydcblx0XHR9KTtcblx0XHRhc3NlcnRTdGF0ZShvcHRzLCB7XG5cdFx0XHR0YWJTaXplOiAzLFxuXHRcdFx0aW5kZW50U2l6ZTogNCxcblx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHRjdXJzb3JTdHlsZTogVGV4dEVkaXRvckN1cnNvclN0eWxlLkxpbmUsXG5cdFx0XHRsaW5lTnVtYmVyczogUmVuZGVyTGluZU51bWJlcnNUeXBlLk9uXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgW3sgdGFiU2l6ZTogMywgaW5zZXJ0U3BhY2VzOiAnYXV0bycgfV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjYW4gZG8gYnVsayB1cGRhdGVzIDMnLCAoKSA9PiB7XG5cdFx0b3B0cy5hc3NpZ24oe1xuXHRcdFx0Y3Vyc29yU3R5bGU6IFRleHRFZGl0b3JDdXJzb3JTdHlsZS5CbG9jayxcblx0XHRcdGxpbmVOdW1iZXJzOiBUZXh0RWRpdG9yTGluZU51bWJlcnNTdHlsZS5SZWxhdGl2ZVxuXHRcdH0pO1xuXHRcdGFzc2VydFN0YXRlKG9wdHMsIHtcblx0XHRcdHRhYlNpemU6IDQsXG5cdFx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdGN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuQmxvY2ssXG5cdFx0XHRsaW5lTnVtYmVyczogUmVuZGVyTGluZU51bWJlcnNUeXBlLlJlbGF0aXZlXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgW3sgY3Vyc29yU3R5bGU6IFRleHRFZGl0b3JDdXJzb3JTdHlsZS5CbG9jaywgbGluZU51bWJlcnM6IFJlbmRlckxpbmVOdW1iZXJzVHlwZS5SZWxhdGl2ZSB9XSk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsV0FBVztBQUNwQixTQUFTLFlBQVk7QUFDckIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyx1QkFBdUIsNkJBQTZCO0FBQzdELFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsbUJBQW1CLGdDQUFnQztBQUM1RCxTQUFTLE9BQU8sa0NBQWtDO0FBRWxELE1BQU0scUJBQXFCLE1BQU07QUFFaEMsTUFBSTtBQUNKLFFBQU0sTUFBTSxJQUFJLG9CQUFvQixRQUFZLElBQUksS0FBSyxFQUFFLEdBQUc7QUFBQSxJQUM3RDtBQUFBLEVBQ0QsR0FBRyxNQUFNLEdBQUcsUUFBUSxPQUFPLE1BQU07QUFFakMsUUFBTSxNQUFNO0FBQ1gsYUFBUyxJQUFJLGtCQUFrQixRQUFRLE1BQU8sSUFBSSxlQUFlLEdBQUcsSUFBSSxL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
