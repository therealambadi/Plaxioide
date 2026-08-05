import * as assert from "assert";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { derivedHandleChanges } from "../../../../base/common/observable.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { observableCodeEditor } from "../../../browser/observableCodeEditor.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { withTestCodeEditor } from "../testCodeEditor.js";
suite("CodeEditorWidget", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function withTestFixture(cb) {
    withEditorSetupTestFixture(void 0, cb);
  }
  function withEditorSetupTestFixture(preSetupCallback, cb) {
    withTestCodeEditor("hello world", {}, (editor, viewModel) => {
      const disposables = new DisposableStore();
      preSetupCallback?.(editor, disposables);
      const obsEditor = observableCodeEditor(editor);
      const log = new Log();
      const derived = derivedHandleChanges(
        {
          createEmptyChangeSummary: () => void 0,
          handleChange: (context) => {
            const obsName = observableName(context.changedObservable, obsEditor);
            log.log(`handle change: ${obsName} ${formatChange(context.change)}`);
            return true;
          }
        },
        (reader) => {
          const versionId = obsEditor.versionId.read(reader);
          const selection = obsEditor.selections.read(reader)?.map((s) => s.toString()).join(", ");
          obsEditor.onDidType.read(reader);
          const str = `running derived: selection: ${selection}, value: ${versionId}`;
          log.log(str);
          return str;
        }
      );
      derived.recomputeInitiallyAndOnChange(disposables);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "running derived: selection: [1,1 -> 1,1], value: 1"
      ]);
      cb({ editor, viewModel, log, derived });
      disposables.dispose();
    });
  }
  test("setPosition", () => withTestFixture(({ editor, log }) => {
    editor.setPosition(new Position(1, 2));
    assert.deepStrictEqual(log.getAndClearEntries(), [
      'handle change: editor.selections {"selection":"[1,2 -> 1,2]","modelVersionId":1,"oldSelections":["[1,1 -> 1,1]"],"oldModelVersionId":1,"source":"api","reason":0}',
      "running derived: selection: [1,2 -> 1,2], value: 1"
    ]);
  }));
  test("keyboard.type", () => withTestFixture(({ editor, log }) => {
    editor.trigger("keyboard", "type", { text: "abc" });
    assert.deepStrictEqual(log.getAndClearEntries(), [
      'handle change: editor.onDidType "abc"',
      'handle change: editor.versionId {"changes":[{"range":"[1,1 -> 1,1]","rangeLength":0,"text":"a","rangeOffset":0}],"eol":"\\n","versionId":2}',
      'handle change: editor.versionId {"changes":[{"range":"[1,2 -> 1,2]","rangeLength":0,"text":"b","rangeOffset":1}],"eol":"\\n","versionId":3}',
      'handle change: editor.versionId {"changes":[{"range":"[1,3 -> 1,3]","rangeLength":0,"text":"c","rangeOffset":2}],"eol":"\\n","versionId":4}',
      'handle change: editor.selections {"selection":"[1,4 -> 1,4]","modelVersionId":4,"oldSelections":["[1,1 -> 1,1]"],"oldModelVersionId":1,"source":"keyboard","reason":0}',
      "running derived: selection: [1,4 -> 1,4], value: 4"
    ]);
  }));
  test("keyboard.type and set position", () => withTestFixture(({ editor, log }) => {
    editor.trigger("keyboard", "type", { text: "abc" });
    assert.deepStrictEqual(log.getAndClearEntries(), [
      'handle change: editor.onDidType "abc"',
      'handle change: editor.versionId {"changes":[{"range":"[1,1 -> 1,1]","rangeLength":0,"text":"a","rangeOffset":0}],"eol":"\\n","versionId":2}',
      'handle change: editor.versionId {"changes":[{"range":"[1,2 -> 1,2]","rangeLength":0,"text":"b","rangeOffset":1}],"eol":"\\n","versionId":3}',
      'handle change: editor.versionId {"changes":[{"range":"[1,3 -> 1,3]","rangeLength":0,"text":"c","rangeOffset":2}],"eol":"\\n","versionId":4}',
      'handle change: editor.selections {"selection":"[1,4 -> 1,4]","modelVersionId":4,"oldSelections":["[1,1 -> 1,1]"],"oldModelVersionId":1,"source":"keyboard","reason":0}',
      "running derived: selection: [1,4 -> 1,4], value: 4"
    ]);
    editor.setPosition(new Position(1, 5), "test");
    assert.deepStrictEqual(log.getAndClearEntries(), [
      'handle change: editor.selections {"selection":"[1,5 -> 1,5]","modelVersionId":4,"oldSelections":["[1,4 -> 1,4]"],"oldModelVersionId":4,"source":"test","reason":0}',
      "running derived: selection: [1,5 -> 1,5], value: 4"
    ]);
  }));
  test("listener interaction (unforced)", () => {
    let derived;
    let log;
    withEditorSetupTestFixture(
      (editor, disposables) => {
        disposables.add(
          editor.onDidChangeModelContent(() => {
            log.log(">>> before get");
            derived.get();
            log.log("<<< after get");
          })
        );
      },
      (args) => {
        const editor = args.editor;
        derived = args.derived;
        log = args.log;
        editor.trigger("keyboard", "type", { text: "a" });
        assert.deepStrictEqual(log.getAndClearEntries(), [
          ">>> before get",
          "<<< after get",
          'handle change: editor.onDidType "a"',
          'handle change: editor.versionId {"changes":[{"range":"[1,1 -> 1,1]","rangeLength":0,"text":"a","rangeOffset":0}],"eol":"\\n","versionId":2}',
          'handle change: editor.selections {"selection":"[1,2 -> 1,2]","modelVersionId":2,"oldSelections":["[1,1 -> 1,1]"],"oldModelVersionId":1,"source":"keyboard","reason":0}',
          "running derived: selection: [1,2 -> 1,2], value: 2"
        ]);
      }
    );
  });
  test("listener interaction ()", () => {
    let derived;
    let log;
    withEditorSetupTestFixture(
      (editor, disposables) => {
        disposables.add(
          editor.onDidChangeModelContent(() => {
            log.log(">>> before forceUpdate");
            observableCodeEditor(editor).forceUpdate();
            log.log(">>> before get");
            derived.get();
            log.log("<<< after get");
          })
        );
      },
      (args) => {
        const editor = args.editor;
        derived = args.derived;
        log = args.log;
        editor.trigger("keyboard", "type", { text: "a" });
        assert.deepStrictEqual(log.getAndClearEntries(), [
          ">>> before forceUpdate",
          ">>> before get",
          "handle change: editor.versionId undefined",
          "running derived: selection: [1,2 -> 1,2], value: 2",
          "<<< after get",
          'handle change: editor.onDidType "a"',
          'handle change: editor.versionId {"changes":[{"range":"[1,1 -> 1,1]","rangeLength":0,"text":"a","rangeOffset":0}],"eol":"\\n","versionId":2}',
          'handle change: editor.selections {"selection":"[1,2 -> 1,2]","modelVersionId":2,"oldSelections":["[1,1 -> 1,1]"],"oldModelVersionId":1,"source":"keyboard","reason":0}',
          "running derived: selection: [1,2 -> 1,2], value: 2"
        ]);
      }
    );
  });
});
class Log {
  constructor() {
    this.entries = [];
  }
  log(message) {
    this.entries.push(message);
  }
  getAndClearEntries() {
    const entries = [...this.entries];
    this.entries.length = 0;
    return entries;
  }
}
function formatChange(change) {
  return JSON.stringify(
    change,
    (key, value) => {
      if (value instanceof Range) {
        return value.toString();
      }
      if (value === false || Array.isArray(value) && value.length === 0) {
        return void 0;
      }
      return value;
    }
  );
}
function observableName(obs, obsEditor) {
  switch (obs) {
    case obsEditor.selections:
      return "editor.selections";
    case obsEditor.versionId:
      return "editor.versionId";
    case obsEditor.onDidType:
      return "editor.onDidType";
    default:
      return "unknown";
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9icm93c2VyL3dpZGdldC9vYnNlcnZhYmxlQ29kZUVkaXRvci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgYXNzZXJ0IGZyb20gXCJhc3NlcnRcIjtcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gXCIuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanNcIjtcbmltcG9ydCB7IElPYnNlcnZhYmxlLCBkZXJpdmVkSGFuZGxlQ2hhbmdlcyB9IGZyb20gXCIuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzXCI7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tIFwiLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qc1wiO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tIFwiLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzXCI7XG5pbXBvcnQgeyBPYnNlcnZhYmxlQ29kZUVkaXRvciwgb2JzZXJ2YWJsZUNvZGVFZGl0b3IgfSBmcm9tIFwiLi4vLi4vLi4vYnJvd3Nlci9vYnNlcnZhYmxlQ29kZUVkaXRvci5qc1wiO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanNcIjtcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzXCI7XG5pbXBvcnQgeyBWaWV3TW9kZWwgfSBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC92aWV3TW9kZWxJbXBsLmpzXCI7XG5pbXBvcnQgeyB3aXRoVGVzdENvZGVFZGl0b3IgfSBmcm9tIFwiLi4vdGVzdENvZGVFZGl0b3IuanNcIjtcblxuc3VpdGUoXCJDb2RlRWRpdG9yV2lkZ2V0XCIsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gd2l0aFRlc3RGaXh0dXJlKFxuXHRcdGNiOiAoYXJnczogeyBlZGl0b3I6IElDb2RlRWRpdG9yOyB2aWV3TW9kZWw6IFZpZXdNb2RlbDsgbG9nOiBMb2c7IGRlcml2ZWQ6IElPYnNlcnZhYmxlPHN0cmluZz4gfSkgPT4gdm9pZFxuXHQpIHtcblx0XHR3aXRoRWRpdG9yU2V0dXBUZXN0Rml4dHVyZSh1bmRlZmluZWQsIGNiKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHdpdGhFZGl0b3JTZXR1cFRlc3RGaXh0dXJlKFxuXHRcdHByZVNldHVwQ2FsbGJhY2s6XG5cdFx0XHR8ICgoZWRpdG9yOiBJQ29kZUVkaXRvciwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSkgPT4gdm9pZClcblx0XHRcdHwgdW5kZWZpbmVkLFxuXHRcdGNiOiAoYXJnczogeyBlZGl0b3I6IElDb2RlRWRpdG9yOyB2aWV3TW9kZWw6IFZpZXdNb2RlbDsgbG9nOiBMb2c7IGRlcml2ZWQ6IElPYnNlcnZhYmxlPHN0cmluZz4gfSkgPT4gdm9pZFxuXHQpIHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoXCJoZWxsbyB3b3JsZFwiLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdHByZVNldHVwQ2FsbGJhY2s/LihlZGl0b3IsIGRpc3Bvc2FibGVzKTtcblx0XHRcdGNvbnN0IG9ic0VkaXRvciA9IG9ic2VydmFibGVDb2RlRWRpdG9yKGVkaXRvcik7XG5cdFx0XHRjb25zdCBsb2cgPSBuZXcgTG9nKCk7XG5cblx0XHRcdGNvbnN0IGRlcml2ZWQgPSBkZXJpdmVkSGFuZGxlQ2hhbmdlcyhcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNyZWF0ZUVtcHR5Q2hhbmdlU3VtbWFyeTogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGhhbmRsZUNoYW5nZTogKGNvbnRleHQpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IG9ic05hbWUgPSBvYnNlcnZhYmxlTmFtZShjb250ZXh0LmNoYW5nZWRPYnNlcnZhYmxlLCBvYnNFZGl0b3IpO1xuXHRcdFx0XHRcdFx0bG9nLmxvZyhgaGFuZGxlIGNoYW5nZTogJHtvYnNOYW1lfSAke2Zvcm1hdENoYW5nZShjb250ZXh0LmNoYW5nZSl9YCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQocmVhZGVyKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgdmVyc2lvbklkID0gb2JzRWRpdG9yLnZlcnNpb25JZC5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gb2JzRWRpdG9yLnNlbGVjdGlvbnMucmVhZChyZWFkZXIpPy5tYXAoKHMpID0+IHMudG9TdHJpbmcoKSkuam9pbihcIiwgXCIpO1xuXHRcdFx0XHRcdG9ic0VkaXRvci5vbkRpZFR5cGUucmVhZChyZWFkZXIpO1xuXG5cdFx0XHRcdFx0Y29uc3Qgc3RyID0gYHJ1bm5pbmcgZGVyaXZlZDogc2VsZWN0aW9uOiAke3NlbGVjdGlvbn0sIHZhbHVlOiAke3ZlcnNpb25JZH1gO1xuXHRcdFx0XHRcdGxvZy5sb2coc3RyKTtcblx0XHRcdFx0XHRyZXR1cm4gc3RyO1xuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXG5cdFx0XHRkZXJpdmVkLnJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlKGRpc3Bvc2FibGVzKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFwicnVubmluZyBkZXJpdmVkOiBzZWxlY3Rpb246IFsxLDEgLT4gMSwxXSwgdmFsdWU6IDFcIixcblx0XHRcdF0pO1xuXG5cdFx0XHRjYih7IGVkaXRvciwgdmlld01vZGVsLCBsb2csIGRlcml2ZWQgfSk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fVxuXG5cdHRlc3QoXCJzZXRQb3NpdGlvblwiLCAoKSA9PlxuXHRcdHdpdGhUZXN0Rml4dHVyZSgoeyBlZGl0b3IsIGxvZyB9KSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDIpKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0J2hhbmRsZSBjaGFuZ2U6IGVkaXRvci5zZWxlY3Rpb25zIHtcInNlbGVjdGlvblwiOlwiWzEsMiAtPiAxLDJdXCIsXCJtb2RlbFZlcnNpb25JZFwiOjEsXCJvbGRTZWxlY3Rpb25zXCI6W1wiWzEsMSAtPiAxLDFdXCJdLFwib2xkTW9kZWxWZXJzaW9uSWRcIjoxLFwic291cmNlXCI6XCJhcGlcIixcInJlYXNvblwiOjB9Jyxcblx0XHRcdFx0XCJydW5uaW5nIGRlcml2ZWQ6IHNlbGVjdGlvbjogWzEsMiAtPiAxLDJdLCB2YWx1ZTogMVwiLFxuXHRcdFx0XSk7XG5cdFx0fSkpO1xuXG5cdHRlc3QoXCJrZXlib2FyZC50eXBlXCIsICgpID0+XG5cdFx0d2l0aFRlc3RGaXh0dXJlKCh7IGVkaXRvciwgbG9nIH0pID0+IHtcblx0XHRcdGVkaXRvci50cmlnZ2VyKFwia2V5Ym9hcmRcIiwgXCJ0eXBlXCIsIHsgdGV4dDogXCJhYmNcIiB9KTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0J2hhbmRsZSBjaGFuZ2U6IGVkaXRvci5vbkRpZFR5cGUgXCJhYmNcIicsXG5cdFx0XHRcdCdoYW5kbGUgY2hhbmdlOiBlZGl0b3IudmVyc2lvbklkIHtcImNoYW5nZXNcIjpbe1wicmFuZ2VcIjpcIlsxLDEgLT4gMSwxXVwiLFwicmFuZ2VMZW5ndGhcIjowLFwidGV4dFwiOlwiYVwiLFwicmFuZ2VPZmZzZXRcIjowfV0sXCJlb2xcIjpcIlxcXFxuXCIsXCJ2ZXJzaW9uSWRcIjoyfScsXG5cdFx0XHRcdCdoYW5kbGUgY2hhbmdlOiBlZGl0b3IudmVyc2lvbklkIHtcImNoYW5nZXNcIjpbe1wicmFuZ2VcIjpcIlsxLDIgLT4gMSwyXVwiLFwicmFuZ2VMZW5ndGhcIjowLFwidGV4dFwiOlwiYlwiLFwicmFuZ2VPZmZzZXRcIjoxfV0sXCJlb2xcIjpcIlxcXFxuXCIsXCJ2ZXJzaW9uSWRcIjozfScsXG5cdFx0XHRcdCdoYW5kbGUgY2hhbmdlOiBlZGl0b3IudmVyc2lvbklkIHtcImNoYW5nZXNcIjpbe1wicmFuZ2VcIjpcIlsxLDMgLT4gMSwzXVwiLFwicmFuZ2VMZW5ndGhcIjowLFwidGV4dFwiOlwiY1wiLFwicmFuZ2VPZmZzZXRcIjoyfV0sXCJlb2xcIjpcIlxcXFxuXCIsXCJ2ZXJzaW9uSWRcIjo0fScsXG5cdFx0XHRcdCdoYW5kbGUgY2hhbmdlOiBlZGl0b3Iuc2VsZWN0aW9ucyB7XCJzZWxlY3Rpb25cIjpcIlsxLDQgLT4gMSw0XVwiLFwibW9kZWxWZXJzaW9uSWRcIjo0LFwib2xkU2VsZWN0aW9uc1wiOltcIlsxLDEgLT4gMSwxXVwiXSxcIm9sZE1vZGVsVmVyc2lvbklkXCI6MSxcInNvdXJjZVwiOlwia2V5Ym9hcmRcIixcInJlYXNvblwiOjB9Jyxcblx0XHRcdFx0J3J1bm5pbmcgZGVyaXZlZDogc2VsZWN0aW9uOiBbMSw0IC0+IDEsNF0sIHZhbHVlOiA0Jyxcblx0XHRcdF0pO1xuXHRcdH0pKTtcblxuXHR0ZXN0KFwia2V5Ym9hcmQudHlwZSBhbmQgc2V0IHBvc2l0aW9uXCIsICgpID0+XG5cdFx0d2l0aFRlc3RGaXh0dXJlKCh7IGVkaXRvciwgbG9nIH0pID0+IHtcblx0XHRcdGVkaXRvci50cmlnZ2VyKFwia2V5Ym9hcmRcIiwgXCJ0eXBlXCIsIHsgdGV4dDogXCJhYmNcIiB9KTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0J2hhbmRsZSBjaGFuZ2U6IGVkaXRvci5vbkRpZFR5cGUgXCJhYmNcIicsXG5cdFx0XHRcdCdoYW5kbGUgY2hhbmdlOiBlZGl0b3IudmVyc2lvbklkIHtcImNoYW5nZXNcIjpbe1wicmFuZ2VcIjpcIlsxLDEgLT4gMSwxXVwiLFwicmFuZ2VMZW5ndGhcIjowLFwidGV4dFwiOlwiYVwiLFwicmFuZ2VPZmZzZXRcIjowfV0sXCJlb2xcIjpcIlxcXFxuXCIsXCJ2ZXJzaW9uSWRcIjoyfScsXG5cdFx0XHRcdCdoYW5kbGUgY2hhbmdlOiBlZGl0b3IudmVyc2lvbklkIHtcImNoYW5nZXNcIjpbe1wicmFuZ2VcIjpcIlsxLDIgLT4gMSwyXVwiLFwicmFuZ2VMZW5ndGhcIjowLFwidGV4dFwiOlwiYlwiLFwicmFuZ2VPZmZzZXRcIjoxfV0sXCJlb2xcIjpcIlxcXFxuXCIsXCJ2ZXJzaW9uSWRcIjozfScsXG5cdFx0XHRcdCdoYW5kbGUgY2hhbmdlOiBlZGl0b3IudmVyc2lvbklkIHtcImNoYW5nZXNcIjpbe1wicmFuZ2VcIjpcIlsxLDMgLT4gMSwzXVwiLFwicmFuZ2VMZW5ndGhcIjowLFwidGV4dFwiOlwiY1wiLFwicmFuZ2VPZmZzZXRcIjoyfV0sXCJlb2xcIjpcIlxcXFxuXCIsXCJ2ZXJzaW9uSWRcIjo0fScsXG5cdFx0XHRcdCdoYW5kbGUgY2hhbmdlOiBlZGl0b3Iuc2VsZWN0aW9ucyB7XCJzZWxlY3Rpb25cIjpcIlsxLDQgLT4gMSw0XVwiLFwibW9kZWxWZXJzaW9uSWRcIjo0LFwib2xkU2VsZWN0aW9uc1wiOltcIlsxLDEgLT4gMSwxXVwiXSxcIm9sZE1vZGVsVmVyc2lvbklkXCI6MSxcInNvdXJjZVwiOlwia2V5Ym9hcmRcIixcInJlYXNvblwiOjB9Jyxcblx0XHRcdFx0J3J1bm5pbmcgZGVyaXZlZDogc2VsZWN0aW9uOiBbMSw0IC0+IDEsNF0sIHZhbHVlOiA0Jyxcblx0XHRcdF0pO1xuXG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDUpLCBcInRlc3RcIik7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdCdoYW5kbGUgY2hhbmdlOiBlZGl0b3Iuc2VsZWN0aW9ucyB7XCJzZWxlY3Rpb25cIjpcIlsxLDUgLT4gMSw1XVwiLFwibW9kZWxWZXJzaW9uSWRcIjo0LFwib2xkU2VsZWN0aW9uc1wiOltcIlsxLDQgLT4gMSw0XVwiXSxcIm9sZE1vZGVsVmVyc2lvbklkXCI6NCxcInNvdXJjZVwiOlwidGVzdFwiLFwicmVhc29uXCI6MH0nLFxuXHRcdFx0XHRcInJ1bm5pbmcgZGVyaXZlZDogc2VsZWN0aW9uOiBbMSw1IC0+IDEsNV0sIHZhbHVlOiA0XCIsXG5cdFx0XHRdKTtcblx0XHR9KSk7XG5cblx0dGVzdChcImxpc3RlbmVyIGludGVyYWN0aW9uICh1bmZvcmNlZClcIiwgKCkgPT4ge1xuXHRcdGxldCBkZXJpdmVkOiBJT2JzZXJ2YWJsZTxzdHJpbmc+O1xuXHRcdGxldCBsb2c6IExvZztcblx0XHR3aXRoRWRpdG9yU2V0dXBUZXN0Rml4dHVyZShcblx0XHRcdChlZGl0b3IsIGRpc3Bvc2FibGVzKSA9PiB7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChcblx0XHRcdFx0XHRlZGl0b3Iub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0bG9nLmxvZyhcIj4+PiBiZWZvcmUgZ2V0XCIpO1xuXHRcdFx0XHRcdFx0ZGVyaXZlZC5nZXQoKTtcblx0XHRcdFx0XHRcdGxvZy5sb2coXCI8PDwgYWZ0ZXIgZ2V0XCIpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdCk7XG5cdFx0XHR9LFxuXHRcdFx0KGFyZ3MpID0+IHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yID0gYXJncy5lZGl0b3I7XG5cdFx0XHRcdGRlcml2ZWQgPSBhcmdzLmRlcml2ZWQ7XG5cdFx0XHRcdGxvZyA9IGFyZ3MubG9nO1xuXG5cdFx0XHRcdGVkaXRvci50cmlnZ2VyKFwia2V5Ym9hcmRcIiwgXCJ0eXBlXCIsIHsgdGV4dDogXCJhXCIgfSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFx0XCI+Pj4gYmVmb3JlIGdldFwiLFxuXHRcdFx0XHRcdFwiPDw8IGFmdGVyIGdldFwiLFxuXHRcdFx0XHRcdCdoYW5kbGUgY2hhbmdlOiBlZGl0b3Iub25EaWRUeXBlIFwiYVwiJyxcblx0XHRcdFx0XHQnaGFuZGxlIGNoYW5nZTogZWRpdG9yLnZlcnNpb25JZCB7XCJjaGFuZ2VzXCI6W3tcInJhbmdlXCI6XCJbMSwxIC0+IDEsMV1cIixcInJhbmdlTGVuZ3RoXCI6MCxcInRleHRcIjpcImFcIixcInJhbmdlT2Zmc2V0XCI6MH1dLFwiZW9sXCI6XCJcXFxcblwiLFwidmVyc2lvbklkXCI6Mn0nLFxuXHRcdFx0XHRcdCdoYW5kbGUgY2hhbmdlOiBlZGl0b3Iuc2VsZWN0aW9ucyB7XCJzZWxlY3Rpb25cIjpcIlsxLDIgLT4gMSwyXVwiLFwibW9kZWxWZXJzaW9uSWRcIjoyLFwib2xkU2VsZWN0aW9uc1wiOltcIlsxLDEgLT4gMSwxXVwiXSxcIm9sZE1vZGVsVmVyc2lvbklkXCI6MSxcInNvdXJjZVwiOlwia2V5Ym9hcmRcIixcInJlYXNvblwiOjB9Jyxcblx0XHRcdFx0XHRcInJ1bm5pbmcgZGVyaXZlZDogc2VsZWN0aW9uOiBbMSwyIC0+IDEsMl0sIHZhbHVlOiAyXCIsXG5cdFx0XHRcdF0pO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoXCJsaXN0ZW5lciBpbnRlcmFjdGlvbiAoKVwiLCAoKSA9PiB7XG5cdFx0bGV0IGRlcml2ZWQ6IElPYnNlcnZhYmxlPHN0cmluZz47XG5cdFx0bGV0IGxvZzogTG9nO1xuXHRcdHdpdGhFZGl0b3JTZXR1cFRlc3RGaXh0dXJlKFxuXHRcdFx0KGVkaXRvciwgZGlzcG9zYWJsZXMpID0+IHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKFxuXHRcdFx0XHRcdGVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoKSA9PiB7XG5cdFx0XHRcdFx0XHRsb2cubG9nKFwiPj4+IGJlZm9yZSBmb3JjZVVwZGF0ZVwiKTtcblx0XHRcdFx0XHRcdG9ic2VydmFibGVDb2RlRWRpdG9yKGVkaXRvcikuZm9yY2VVcGRhdGUoKTtcblxuXHRcdFx0XHRcdFx0bG9nLmxvZyhcIj4+PiBiZWZvcmUgZ2V0XCIpO1xuXHRcdFx0XHRcdFx0ZGVyaXZlZC5nZXQoKTtcblx0XHRcdFx0XHRcdGxvZy5sb2coXCI8PDwgYWZ0ZXIgZ2V0XCIpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdCk7XG5cdFx0XHR9LFxuXHRcdFx0KGFyZ3MpID0+IHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yID0gYXJncy5lZGl0b3I7XG5cdFx0XHRcdGRlcml2ZWQgPSBhcmdzLmRlcml2ZWQ7XG5cdFx0XHRcdGxvZyA9IGFyZ3MubG9nO1xuXG5cdFx0XHRcdGVkaXRvci50cmlnZ2VyKFwia2V5Ym9hcmRcIiwgXCJ0eXBlXCIsIHsgdGV4dDogXCJhXCIgfSk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0XHRcIj4+PiBiZWZvcmUgZm9yY2VVcGRhdGVcIixcblx0XHRcdFx0XHRcIj4+PiBiZWZvcmUgZ2V0XCIsXG5cdFx0XHRcdFx0XCJoYW5kbGUgY2hhbmdlOiBlZGl0b3IudmVyc2lvbklkIHVuZGVmaW5lZFwiLFxuXHRcdFx0XHRcdFwicnVubmluZyBkZXJpdmVkOiBzZWxlY3Rpb246IFsxLDIgLT4gMSwyXSwgdmFsdWU6IDJcIixcblx0XHRcdFx0XHRcIjw8PCBhZnRlciBnZXRcIixcblx0XHRcdFx0XHQnaGFuZGxlIGNoYW5nZTogZWRpdG9yLm9uRGlkVHlwZSBcImFcIicsXG5cdFx0XHRcdFx0J2hhbmRsZSBjaGFuZ2U6IGVkaXRvci52ZXJzaW9uSWQge1wiY2hhbmdlc1wiOlt7XCJyYW5nZVwiOlwiWzEsMSAtPiAxLDFdXCIsXCJyYW5nZUxlbmd0aFwiOjAsXCJ0ZXh0XCI6XCJhXCIsXCJyYW5nZU9mZnNldFwiOjB9XSxcImVvbFwiOlwiXFxcXG5cIixcInZlcnNpb25JZFwiOjJ9Jyxcblx0XHRcdFx0XHQnaGFuZGxlIGNoYW5nZTogZWRpdG9yLnNlbGVjdGlvbnMge1wic2VsZWN0aW9uXCI6XCJbMSwyIC0+IDEsMl1cIixcIm1vZGVsVmVyc2lvbklkXCI6MixcIm9sZFNlbGVjdGlvbnNcIjpbXCJbMSwxIC0+IDEsMV1cIl0sXCJvbGRNb2RlbFZlcnNpb25JZFwiOjEsXCJzb3VyY2VcIjpcImtleWJvYXJkXCIsXCJyZWFzb25cIjowfScsXG5cdFx0XHRcdFx0XCJydW5uaW5nIGRlcml2ZWQ6IHNlbGVjdGlvbjogWzEsMiAtPiAxLDJdLCB2YWx1ZTogMlwiLFxuXHRcdFx0XHRdKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcbn0pO1xuXG5jbGFzcyBMb2cge1xuXHRwcml2YXRlIHJlYWRvbmx5IGVudHJpZXM6IHN0cmluZ1tdID0gW107XG5cdHB1YmxpYyBsb2cobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5lbnRyaWVzLnB1c2gobWVzc2FnZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QW5kQ2xlYXJFbnRyaWVzKCk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCBlbnRyaWVzID0gWy4uLnRoaXMuZW50cmllc107XG5cdFx0dGhpcy5lbnRyaWVzLmxlbmd0aCA9IDA7XG5cdFx0cmV0dXJuIGVudHJpZXM7XG5cdH1cbn1cblxuZnVuY3Rpb24gZm9ybWF0Q2hhbmdlKGNoYW5nZTogdW5rbm93bikge1xuXHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoXG5cdFx0Y2hhbmdlLFxuXHRcdChrZXksIHZhbHVlKSA9PiB7XG5cdFx0XHRpZiAodmFsdWUgaW5zdGFuY2VvZiBSYW5nZSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWUudG9TdHJpbmcoKTtcblx0XHRcdH1cblx0XHRcdGlmIChcblx0XHRcdFx0dmFsdWUgPT09IGZhbHNlIHx8XG5cdFx0XHRcdChBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IDApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdCk7XG59XG5cbmZ1bmN0aW9uIG9ic2VydmFibGVOYW1lKG9iczogSU9ic2VydmFibGU8YW55Piwgb2JzRWRpdG9yOiBPYnNlcnZhYmxlQ29kZUVkaXRvcik6IHN0cmluZyB7XG5cdHN3aXRjaCAob2JzKSB7XG5cdFx0Y2FzZSBvYnNFZGl0b3Iuc2VsZWN0aW9uczpcblx0XHRcdHJldHVybiBcImVkaXRvci5zZWxlY3Rpb25zXCI7XG5cdFx0Y2FzZSBvYnNFZGl0b3IudmVyc2lvbklkOlxuXHRcdFx0cmV0dXJuIFwiZWRpdG9yLnZlcnNpb25JZFwiO1xuXHRcdGNhc2Ugb2JzRWRpdG9yLm9uRGlkVHlwZTpcblx0XHRcdHJldHVybiBcImVkaXRvci5vbkRpZFR5cGVcIjtcblx0XHRkZWZhdWx0OlxuXHRcdFx0cmV0dXJuIFwidW5rbm93blwiO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFlBQVk7QUFDeEIsU0FB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
