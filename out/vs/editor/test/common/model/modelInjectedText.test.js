import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { EditOperation } from "../../../common/core/editOperation.js";
import { Range } from "../../../common/core/range.js";
import { InternalModelContentChangeEvent, LineInjectedText, RawContentChangedType } from "../../../common/textModelEvents.js";
import { createTextModel } from "../testTextModel.js";
suite("Editor Model - Injected Text Events", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  test("Basic", () => {
    const thisModel = store.add(createTextModel("First Line\nSecond Line"));
    const recordedChanges = new Array();
    store.add(thisModel.onDidChangeContentOrInjectedText((e) => {
      const changes = e instanceof InternalModelContentChangeEvent ? e.rawContentChangedEvent.changes : e.changes;
      for (const change of changes) {
        recordedChanges.push(mapChange(change));
      }
    }));
    let decorations = thisModel.deltaDecorations([], [{
      options: {
        after: { content: "injected1" },
        description: "test1",
        showIfCollapsed: true
      },
      range: new Range(1, 1, 1, 1)
    }]);
    assert.deepStrictEqual(recordedChanges.splice(0), [
      {
        kind: "lineChanged",
        line: "[injected1]First Line",
        lineNumber: 1
      }
    ]);
    decorations = thisModel.deltaDecorations(decorations, [{
      options: {
        after: { content: "injected1" },
        description: "test1",
        showIfCollapsed: true
      },
      range: new Range(2, 1, 2, 1)
    }, {
      options: {
        after: { content: "injected2" },
        description: "test2",
        showIfCollapsed: true
      },
      range: new Range(2, 2, 2, 2)
    }]);
    assert.deepStrictEqual(recordedChanges.splice(0), [
      {
        kind: "lineChanged",
        line: "First Line",
        lineNumber: 1
      },
      {
        kind: "lineChanged",
        line: "[injected1]S[injected2]econd Line",
        lineNumber: 2
      }
    ]);
    thisModel.applyEdits([EditOperation.replace(new Range(2, 2, 2, 2), "Hello")]);
    assert.deepStrictEqual(recordedChanges.splice(0), [
      {
        kind: "lineChanged",
        line: "[injected1]SHello[injected2]econd Line",
        lineNumber: 2
      }
    ]);
    thisModel.pushEditOperations(null, [EditOperation.replace(new Range(2, 2, 2, 2), "\n\n\n")], null);
    assert.deepStrictEqual(thisModel.getAllDecorations(void 0).map((d) => ({ description: d.options.description, range: d.range.toString() })), [
      {
        "description": "test1",
        "range": "[2,1 -> 2,1]"
      },
      {
        "description": "test2",
        "range": "[2,2 -> 5,6]"
      }
    ]);
    assert.deepStrictEqual(recordedChanges.splice(0), [
      {
        kind: "lineChanged",
        line: "[injected1]S",
        lineNumber: 2
      },
      {
        fromLineNumber: 3,
        kind: "linesInserted",
        lines: [
          "",
          "",
          "Hello[injected2]econd Line"
        ]
      }
    ]);
    thisModel.pushEditOperations(null, [EditOperation.replace(new Range(3, 1, 5, 1), "\n\n\n\n\n\n\n\n\n\n\n\n\n")], null);
    assert.deepStrictEqual(recordedChanges.splice(0), [
      {
        "kind": "lineChanged",
        "line": "",
        "lineNumber": 5
      },
      {
        "kind": "lineChanged",
        "line": "",
        "lineNumber": 4
      },
      {
        "kind": "lineChanged",
        "line": "",
        "lineNumber": 3
      },
      {
        "fromLineNumber": 6,
        "kind": "linesInserted",
        "lines": [
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "Hello[injected2]econd Line"
        ]
      }
    ]);
    assert.strictEqual(thisModel.undo(), void 0);
    assert.deepStrictEqual(recordedChanges.splice(0), [
      {
        kind: "lineChanged",
        line: "[injected1]SHello[injected2]econd Line",
        lineNumber: 2
      },
      {
        kind: "linesDeleted"
      }
    ]);
  });
});
function mapChange(change) {
  if (change.changeType === RawContentChangedType.LineChanged) {
    (change.injectedText || []).every((e) => {
      assert.deepStrictEqual(e.lineNumber, change.lineNumber);
    });
    return {
      kind: "lineChanged",
      line: getDetail(change.detail, change.injectedText),
      lineNumber: change.lineNumber
    };
  } else if (change.changeType === RawContentChangedType.LinesInserted) {
    return {
      kind: "linesInserted",
      lines: change.detail.map((e, idx) => getDetail(e, change.injectedTexts[idx])),
      fromLineNumber: change.fromLineNumber
    };
  } else if (change.changeType === RawContentChangedType.LinesDeleted) {
    return {
      kind: "linesDeleted"
    };
  } else if (change.changeType === RawContentChangedType.EOLChanged) {
    return {
      kind: "eolChanged"
    };
  } else if (change.changeType === RawContentChangedType.Flush) {
    return {
      kind: "flush"
    };
  }
  return { kind: "unknown" };
}
function getDetail(line, injectedTexts) {
  return LineInjectedText.applyInjectedText(line, (injectedTexts || []).map((t) => t.withText(`[${t.options.content}]`)));
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvbW9kZWxJbmplY3RlZFRleHQudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgRWRpdE9wZXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJbnRlcm5hbE1vZGVsQ29udGVudENoYW5nZUV2ZW50LCBMaW5lSW5qZWN0ZWRUZXh0LCBNb2RlbFJhd0NoYW5nZSwgUmF3Q29udGVudENoYW5nZWRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RleHRNb2RlbEV2ZW50cy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi90ZXN0VGV4dE1vZGVsLmpzJztcblxuc3VpdGUoJ0VkaXRvciBNb2RlbCAtIEluamVjdGVkIFRleHQgRXZlbnRzJywgKCkgPT4ge1xuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ0Jhc2ljJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRoaXNNb2RlbCA9IHN0b3JlLmFkZChjcmVhdGVUZXh0TW9kZWwoJ0ZpcnN0IExpbmVcXG5TZWNvbmQgTGluZScpKTtcblxuXHRcdGNvbnN0IHJlY29yZGVkQ2hhbmdlcyA9IG5ldyBBcnJheTx1bmtub3duPigpO1xuXG5cdFx0c3RvcmUuYWRkKHRoaXNNb2RlbC5vbkRpZENoYW5nZUNvbnRlbnRPckluamVjdGVkVGV4dCgoZSkgPT4ge1xuXHRcdFx0Y29uc3QgY2hhbmdlcyA9IChlIGluc3RhbmNlb2YgSW50ZXJuYWxNb2RlbENvbnRlbnRDaGFuZ2VFdmVudCA/IGUucmF3Q29udGVudENoYW5nZWRFdmVudC5jaGFuZ2VzIDogZS5jaGFuZ2VzKTtcblx0XHRcdGZvciAoY29uc3QgY2hhbmdlIG9mIGNoYW5nZXMpIHtcblx0XHRcdFx0cmVjb3JkZWRDaGFuZ2VzLnB1c2gobWFwQ2hhbmdlKGNoYW5nZSkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIEluaXRpYWwgZGVjb3JhdGlvblxuXHRcdGxldCBkZWNvcmF0aW9ucyA9IHRoaXNNb2RlbC5kZWx0YURlY29yYXRpb25zKFtdLCBbe1xuXHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRhZnRlcjogeyBjb250ZW50OiAnaW5qZWN0ZWQxJyB9LFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogJ3Rlc3QxJyxcblx0XHRcdFx0c2hvd0lmQ29sbGFwc2VkOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxKSxcblx0XHR9XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWNvcmRlZENoYW5nZXMuc3BsaWNlKDApLCBbXG5cdFx0XHR7XG5cdFx0XHRcdGtpbmQ6ICdsaW5lQ2hhbmdlZCcsXG5cdFx0XHRcdGxpbmU6ICdbaW5qZWN0ZWQxXUZpcnN0IExpbmUnLFxuXHRcdFx0XHRsaW5lTnVtYmVyOiAxLFxuXHRcdFx0fVxuXHRcdF0pO1xuXG5cdFx0Ly8gRGVjb3JhdGlvbiBjaGFuZ2Vcblx0XHRkZWNvcmF0aW9ucyA9IHRoaXNNb2RlbC5kZWx0YURlY29yYXRpb25zKGRlY29yYXRpb25zLCBbe1xuXHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRhZnRlcjogeyBjb250ZW50OiAnaW5qZWN0ZWQxJyB9LFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogJ3Rlc3QxJyxcblx0XHRcdFx0c2hvd0lmQ29sbGFwc2VkOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgyLCAxLCAyLCAxKSxcblx0XHR9LCB7XG5cdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdGFmdGVyOiB7IGNvbnRlbnQ6ICdpbmplY3RlZDInIH0sXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAndGVzdDInLFxuXHRcdFx0XHRzaG93SWZDb2xsYXBzZWQ6IHRydWVcblx0XHRcdH0sXG5cdFx0XHRyYW5nZTogbmV3IFJhbmdlKDIsIDIsIDIsIDIpLFxuXHRcdH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlY29yZGVkQ2hhbmdlcy5zcGxpY2UoMCksIFtcblx0XHRcdHtcblx0XHRcdFx0a2luZDogJ2xpbmVDaGFuZ2VkJyxcblx0XHRcdFx0bGluZTogJ0ZpcnN0IExpbmUnLFxuXHRcdFx0XHRsaW5lTnVtYmVyOiAxLFxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0a2luZDogJ2xpbmVDaGFuZ2VkJyxcblx0XHRcdFx0bGluZTogJ1tpbmplY3RlZDFdU1tpbmplY3RlZDJdZWNvbmQgTGluZScsXG5cdFx0XHRcdGxpbmVOdW1iZXI6IDIsXG5cdFx0XHR9XG5cdFx0XSk7XG5cblx0XHQvLyBTaW1wbGUgSW5zZXJ0XG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24ucmVwbGFjZShuZXcgUmFuZ2UoMiwgMiwgMiwgMiksICdIZWxsbycpXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWNvcmRlZENoYW5nZXMuc3BsaWNlKDApLCBbXG5cdFx0XHR7XG5cdFx0XHRcdGtpbmQ6ICdsaW5lQ2hhbmdlZCcsXG5cdFx0XHRcdGxpbmU6ICdbaW5qZWN0ZWQxXVNIZWxsb1tpbmplY3RlZDJdZWNvbmQgTGluZScsXG5cdFx0XHRcdGxpbmVOdW1iZXI6IDIsXG5cdFx0XHR9XG5cdFx0XSk7XG5cblx0XHQvLyBNdWx0aS1MaW5lIEluc2VydFxuXHRcdHRoaXNNb2RlbC5wdXNoRWRpdE9wZXJhdGlvbnMobnVsbCwgW0VkaXRPcGVyYXRpb24ucmVwbGFjZShuZXcgUmFuZ2UoMiwgMiwgMiwgMiksICdcXG5cXG5cXG4nKV0sIG51bGwpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGhpc01vZGVsLmdldEFsbERlY29yYXRpb25zKHVuZGVmaW5lZCkubWFwKGQgPT4gKHsgZGVzY3JpcHRpb246IGQub3B0aW9ucy5kZXNjcmlwdGlvbiwgcmFuZ2U6IGQucmFuZ2UudG9TdHJpbmcoKSB9KSksIFt7XG5cdFx0XHQnZGVzY3JpcHRpb24nOiAndGVzdDEnLFxuXHRcdFx0J3JhbmdlJzogJ1syLDEgLT4gMiwxXSdcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdkZXNjcmlwdGlvbic6ICd0ZXN0MicsXG5cdFx0XHQncmFuZ2UnOiAnWzIsMiAtPiA1LDZdJ1xuXHRcdH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlY29yZGVkQ2hhbmdlcy5zcGxpY2UoMCksIFtcblx0XHRcdHtcblx0XHRcdFx0a2luZDogJ2xpbmVDaGFuZ2VkJyxcblx0XHRcdFx0bGluZTogJ1tpbmplY3RlZDFdUycsXG5cdFx0XHRcdGxpbmVOdW1iZXI6IDIsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRmcm9tTGluZU51bWJlcjogMyxcblx0XHRcdFx0a2luZDogJ2xpbmVzSW5zZXJ0ZWQnLFxuXHRcdFx0XHRsaW5lczogW1xuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCdIZWxsb1tpbmplY3RlZDJdZWNvbmQgTGluZScsXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHRdKTtcblxuXG5cdFx0Ly8gTXVsdGktTGluZSBSZXBsYWNlXG5cdFx0dGhpc01vZGVsLnB1c2hFZGl0T3BlcmF0aW9ucyhudWxsLCBbRWRpdE9wZXJhdGlvbi5yZXBsYWNlKG5ldyBSYW5nZSgzLCAxLCA1LCAxKSwgJ1xcblxcblxcblxcblxcblxcblxcblxcblxcblxcblxcblxcblxcbicpXSwgbnVsbCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWNvcmRlZENoYW5nZXMuc3BsaWNlKDApLCBbXG5cdFx0XHR7XG5cdFx0XHRcdCdraW5kJzogJ2xpbmVDaGFuZ2VkJyxcblx0XHRcdFx0J2xpbmUnOiAnJyxcblx0XHRcdFx0J2xpbmVOdW1iZXInOiA1LFxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0J2tpbmQnOiAnbGluZUNoYW5nZWQnLFxuXHRcdFx0XHQnbGluZSc6ICcnLFxuXHRcdFx0XHQnbGluZU51bWJlcic6IDQsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHQna2luZCc6ICdsaW5lQ2hhbmdlZCcsXG5cdFx0XHRcdCdsaW5lJzogJycsXG5cdFx0XHRcdCdsaW5lTnVtYmVyJzogMyxcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdCdmcm9tTGluZU51bWJlcic6IDYsXG5cdFx0XHRcdCdraW5kJzogJ2xpbmVzSW5zZXJ0ZWQnLFxuXHRcdFx0XHQnbGluZXMnOiBbXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0J0hlbGxvW2luamVjdGVkMl1lY29uZCBMaW5lJyxcblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdF0pO1xuXG5cdFx0Ly8gTXVsdGktTGluZSBSZXBsYWNlIHVuZG9cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpc01vZGVsLnVuZG8oKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlY29yZGVkQ2hhbmdlcy5zcGxpY2UoMCksIFtcblx0XHRcdHtcblx0XHRcdFx0a2luZDogJ2xpbmVDaGFuZ2VkJyxcblx0XHRcdFx0bGluZTogJ1tpbmplY3RlZDFdU0hlbGxvW2luamVjdGVkMl1lY29uZCBMaW5lJyxcblx0XHRcdFx0bGluZU51bWJlcjogMixcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGtpbmQ6ICdsaW5lc0RlbGV0ZWQnLFxuXHRcdFx0fVxuXHRcdF0pO1xuXHR9KTtcbn0pO1xuXG5mdW5jdGlvbiBtYXBDaGFuZ2UoY2hhbmdlOiBNb2RlbFJhd0NoYW5nZSk6IHVua25vd24ge1xuXHRpZiAoY2hhbmdlLmNoYW5nZVR5cGUgPT09IFJhd0NvbnRlbnRDaGFuZ2VkVHlwZS5MaW5lQ2hhbmdlZCkge1xuXHRcdChjaGFuZ2UuaW5qZWN0ZWRUZXh0IHx8IFtdKS5ldmVyeShlID0+IHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZS5saW5lTnVtYmVyLCBjaGFuZ2UubGluZU51bWJlcik7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0a2luZDogJ2xpbmVDaGFuZ2VkJyxcblx0XHRcdGxpbmU6IGdldERldGFpbChjaGFuZ2UuZGV0YWlsLCBjaGFuZ2UuaW5qZWN0ZWRUZXh0KSxcblx0XHRcdGxpbmVOdW1iZXI6IGNoYW5nZS5saW5lTnVtYmVyLFxuXHRcdH07XG5cdH0gZWxzZSBpZiAoY2hhbmdlLmNoYW5nZVR5cGUgPT09IFJhd0NvbnRlbnRDaGFuZ2VkVHlwZS5MaW5lc0luc2VydGVkKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGtpbmQ6ICdsaW5lc0luc2VydGVkJyxcblx0XHRcdGxpbmVzOiBjaGFuZ2UuZGV0YWlsLm1hcCgoZSwgaWR4KSA9PiBnZXREZXRhaWwoZSwgY2hhbmdlLmluamVjdGVkVGV4dHNbaWR4XSkpLFxuXHRcdFx0ZnJvbUxpbmVOdW1iZXI6IGNoYW5nZS5mcm9tTGluZU51bWJlclxuXHRcdH07XG5cdH0gZWxzZSBpZiAoY2hhbmdlLmNoYW5nZVR5cGUgPT09IFJhd0NvbnRlbnRDaGFuZ2VkVHlwZS5MaW5lc0RlbGV0ZWQpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0a2luZDogJ2xpbmVzRGVsZXRlZCcsXG5cdFx0fTtcblx0fSBlbHNlIGlmIChjaGFuZ2UuY2hhbmdlVHlwZSA9PT0gUmF3Q29udGVudENoYW5nZWRUeXBlLkVPTENoYW5nZWQpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0a2luZDogJ2VvbENoYW5nZWQnXG5cdFx0fTtcblx0fSBlbHNlIGlmIChjaGFuZ2UuY2hhbmdlVHlwZSA9PT0gUmF3Q29udGVudENoYW5nZWRUeXBlLkZsdXNoKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGtpbmQ6ICdmbHVzaCdcblx0XHR9O1xuXHR9XG5cdHJldHVybiB7IGtpbmQ6ICd1bmtub3duJyB9O1xufVxuXG5mdW5jdGlvbiBnZXREZXRhaWwobGluZTogc3RyaW5nLCBpbmplY3RlZFRleHRzOiBMaW5lSW5qZWN0ZWRUZXh0W10gfCBudWxsKTogc3RyaW5nIHtcblx0cmV0dXJuIExpbmVJbmplY3RlZFRleHQuYXBwbHlJbmplY3RlZFRleHQobGluZSwgKGluamVjdGVkVGV4dHMgfHwgW10pLm1hcCh0ID0+IHQud2l0aFRleHQoYFske3Qub3B0aW9ucy5jb250ZW50fV1gKSkpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMscUJB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
