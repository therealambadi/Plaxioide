import assert from "assert";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { TrimTrailingWhitespaceCommand, trimTrailingWhitespace } from "../../../common/commands/trimTrailingWhitespaceCommand.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { MetadataConsts, StandardTokenType } from "../../../common/encodedTokenAttributes.js";
import { EncodedTokenizationResult, TokenizationRegistry } from "../../../common/languages.js";
import { ILanguageService } from "../../../common/languages/language.js";
import { NullState } from "../../../common/languages/nullTokenize.js";
import { getEditOperation } from "../testCommand.js";
import { createModelServices, instantiateTextModel, withEditorModel } from "../../common/testTextModel.js";
function createInsertDeleteSingleEditOp(text, positionLineNumber, positionColumn, selectionLineNumber = positionLineNumber, selectionColumn = positionColumn) {
  return {
    range: new Range(selectionLineNumber, selectionColumn, positionLineNumber, positionColumn),
    text
  };
}
function createSingleEditOp(text, positionLineNumber, positionColumn, selectionLineNumber = positionLineNumber, selectionColumn = positionColumn) {
  return {
    range: new Range(selectionLineNumber, selectionColumn, positionLineNumber, positionColumn),
    text,
    forceMoveMarkers: false
  };
}
function assertTrimTrailingWhitespaceCommand(text, expected) {
  return withEditorModel(text, (model) => {
    const op = new TrimTrailingWhitespaceCommand(new Selection(1, 1, 1, 1), [], true);
    const actual = getEditOperation(model, op);
    assert.deepStrictEqual(actual, expected);
  });
}
function assertTrimTrailingWhitespace(text, cursors, expected) {
  return withEditorModel(text, (model) => {
    const actual = trimTrailingWhitespace(model, cursors, true);
    assert.deepStrictEqual(actual, expected);
  });
}
suite("Editor Commands - Trim Trailing Whitespace Command", () => {
  let disposables;
  setup(() => {
    disposables = new DisposableStore();
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("remove trailing whitespace", function() {
    assertTrimTrailingWhitespaceCommand([""], []);
    assertTrimTrailingWhitespaceCommand(["text"], []);
    assertTrimTrailingWhitespaceCommand(["text   "], [createSingleEditOp(null, 1, 5, 1, 8)]);
    assertTrimTrailingWhitespaceCommand(["text	   "], [createSingleEditOp(null, 1, 5, 1, 9)]);
    assertTrimTrailingWhitespaceCommand(["	   "], [createSingleEditOp(null, 1, 1, 1, 5)]);
    assertTrimTrailingWhitespaceCommand(["text	"], [createSingleEditOp(null, 1, 5, 1, 6)]);
    assertTrimTrailingWhitespaceCommand([
      "some text	",
      "some more text",
      "	  ",
      "even more text  ",
      "and some mixed	   	"
    ], [
      createSingleEditOp(null, 1, 10, 1, 11),
      createSingleEditOp(null, 3, 1, 3, 4),
      createSingleEditOp(null, 4, 15, 4, 17),
      createSingleEditOp(null, 5, 15, 5, 20)
    ]);
    assertTrimTrailingWhitespace(["text   "], [new Position(1, 1), new Position(1, 2), new Position(1, 3)], [createInsertDeleteSingleEditOp(null, 1, 5, 1, 8)]);
    assertTrimTrailingWhitespace(["text   "], [new Position(1, 1), new Position(1, 5)], [createInsertDeleteSingleEditOp(null, 1, 5, 1, 8)]);
    assertTrimTrailingWhitespace(["text   "], [new Position(1, 1), new Position(1, 5), new Position(1, 6)], [createInsertDeleteSingleEditOp(null, 1, 6, 1, 8)]);
    assertTrimTrailingWhitespace([
      "some text	",
      "some more text",
      "	  ",
      "even more text  ",
      "and some mixed	   	"
    ], [], [
      createInsertDeleteSingleEditOp(null, 1, 10, 1, 11),
      createInsertDeleteSingleEditOp(null, 3, 1, 3, 4),
      createInsertDeleteSingleEditOp(null, 4, 15, 4, 17),
      createInsertDeleteSingleEditOp(null, 5, 15, 5, 20)
    ]);
    assertTrimTrailingWhitespace([
      "some text	",
      "some more text",
      "	  ",
      "even more text  ",
      "and some mixed	   	"
    ], [new Position(1, 11), new Position(3, 2), new Position(5, 1), new Position(4, 1), new Position(5, 10)], [
      createInsertDeleteSingleEditOp(null, 3, 2, 3, 4),
      createInsertDeleteSingleEditOp(null, 4, 15, 4, 17),
      createInsertDeleteSingleEditOp(null, 5, 15, 5, 20)
    ]);
  });
  test("skips strings and regex if configured", function() {
    const instantiationService = createModelServices(disposables);
    const languageService = instantiationService.get(ILanguageService);
    const languageId = "testLanguageId";
    const languageIdCodec = languageService.languageIdCodec;
    disposables.add(languageService.registerLanguage({ id: languageId }));
    const encodedLanguageId = languageIdCodec.encodeLanguageId(languageId);
    const otherMetadata = (encodedLanguageId << MetadataConsts.LANGUAGEID_OFFSET | StandardTokenType.Other << MetadataConsts.TOKEN_TYPE_OFFSET | MetadataConsts.BALANCED_BRACKETS_MASK) >>> 0;
    const stringMetadata = (encodedLanguageId << MetadataConsts.LANGUAGEID_OFFSET | StandardTokenType.String << MetadataConsts.TOKEN_TYPE_OFFSET | MetadataConsts.BALANCED_BRACKETS_MASK) >>> 0;
    const tokenizationSupport = {
      getInitialState: () => NullState,
      tokenize: void 0,
      tokenizeEncoded: (line, hasEOL, state) => {
        switch (line) {
          case "const a = `  ": {
            const tokens = new Uint32Array([
              0,
              otherMetadata,
              10,
              stringMetadata
            ]);
            return new EncodedTokenizationResult(tokens, state);
          }
          case "  a string  ": {
            const tokens = new Uint32Array([
              0,
              stringMetadata
            ]);
            return new EncodedTokenizationResult(tokens, state);
          }
          case "`;  ": {
            const tokens = new Uint32Array([
              0,
              stringMetadata,
              1,
              otherMetadata
            ]);
            return new EncodedTokenizationResult(tokens, state);
          }
        }
        throw new Error(`Unexpected`);
      }
    };
    disposables.add(TokenizationRegistry.register(languageId, tokenizationSupport));
    const model = disposables.add(instantiateTextModel(
      instantiationService,
      [
        "const a = `  ",
        "  a string  ",
        "`;  "
      ].join("\n"),
      languageId
    ));
    model.tokenization.forceTokenization(1);
    model.tokenization.forceTokenization(2);
    model.tokenization.forceTokenization(3);
    const op = new TrimTrailingWhitespaceCommand(new Selection(1, 1, 1, 1), [], false);
    const actual = getEditOperation(model, op);
    assert.deepStrictEqual(actual, [createSingleEditOp(null, 3, 3, 3, 5)]);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9icm93c2VyL2NvbW1hbmRzL3RyaW1UcmFpbGluZ1doaXRlc3BhY2VDb21tYW5kLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBUcmltVHJhaWxpbmdXaGl0ZXNwYWNlQ29tbWFuZCwgdHJpbVRyYWlsaW5nV2hpdGVzcGFjZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb21tYW5kcy90cmltVHJhaWxpbmdXaGl0ZXNwYWNlQ29tbWFuZC5qcyc7XG5pbXBvcnQgeyBJU2luZ2xlRWRpdE9wZXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBNZXRhZGF0YUNvbnN0cywgU3RhbmRhcmRUb2tlblR5cGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZW5jb2RlZFRva2VuQXR0cmlidXRlcy5qcyc7XG5pbXBvcnQgeyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0LCBJVG9rZW5pemF0aW9uU3VwcG9ydCwgVG9rZW5pemF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IE51bGxTdGF0ZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbnVsbFRva2VuaXplLmpzJztcbmltcG9ydCB7IGdldEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi90ZXN0Q29tbWFuZC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVNb2RlbFNlcnZpY2VzLCBpbnN0YW50aWF0ZVRleHRNb2RlbCwgd2l0aEVkaXRvck1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rlc3RUZXh0TW9kZWwuanMnO1xuXG4vKipcbiAqIENyZWF0ZSBzaW5nbGUgZWRpdCBvcGVyYXRpb25cbiAqL1xuZnVuY3Rpb24gY3JlYXRlSW5zZXJ0RGVsZXRlU2luZ2xlRWRpdE9wKHRleHQ6IHN0cmluZyB8IG51bGwsIHBvc2l0aW9uTGluZU51bWJlcjogbnVtYmVyLCBwb3NpdGlvbkNvbHVtbjogbnVtYmVyLCBzZWxlY3Rpb25MaW5lTnVtYmVyOiBudW1iZXIgPSBwb3NpdGlvbkxpbmVOdW1iZXIsIHNlbGVjdGlvbkNvbHVtbjogbnVtYmVyID0gcG9zaXRpb25Db2x1bW4pOiBJU2luZ2xlRWRpdE9wZXJhdGlvbiB7XG5cdHJldHVybiB7XG5cdFx0cmFuZ2U6IG5ldyBSYW5nZShzZWxlY3Rpb25MaW5lTnVtYmVyLCBzZWxlY3Rpb25Db2x1bW4sIHBvc2l0aW9uTGluZU51bWJlciwgcG9zaXRpb25Db2x1bW4pLFxuXHRcdHRleHQ6IHRleHRcblx0fTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgc2luZ2xlIGVkaXQgb3BlcmF0aW9uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVNpbmdsZUVkaXRPcCh0ZXh0OiBzdHJpbmcgfCBudWxsLCBwb3NpdGlvbkxpbmVOdW1iZXI6IG51bWJlciwgcG9zaXRpb25Db2x1bW46IG51bWJlciwgc2VsZWN0aW9uTGluZU51bWJlcjogbnVtYmVyID0gcG9zaXRpb25MaW5lTnVtYmVyLCBzZWxlY3Rpb25Db2x1bW46IG51bWJlciA9IHBvc2l0aW9uQ29sdW1uKTogSVNpbmdsZUVkaXRPcGVyYXRpb24ge1xuXHRyZXR1cm4ge1xuXHRcdHJhbmdlOiBuZXcgUmFuZ2Uoc2VsZWN0aW9uTGluZU51bWJlciwgc2VsZWN0aW9uQ29sdW1uLCBwb3NpdGlvbkxpbmVOdW1iZXIsIHBvc2l0aW9uQ29sdW1uKSxcblx0XHR0ZXh0OiB0ZXh0LFxuXHRcdGZvcmNlTW92ZU1hcmtlcnM6IGZhbHNlXG5cdH07XG59XG5cbmZ1bmN0aW9uIGFzc2VydFRyaW1UcmFpbGluZ1doaXRlc3BhY2VDb21tYW5kKHRleHQ6IHN0cmluZ1tdLCBleHBlY3RlZDogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSk6IHZvaWQge1xuXHRyZXR1cm4gd2l0aEVkaXRvck1vZGVsKHRleHQsIChtb2RlbCkgPT4ge1xuXHRcdGNvbnN0IG9wID0gbmV3IFRyaW1UcmFpbGluZ1doaXRlc3BhY2VDb21tYW5kKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksIFtdLCB0cnVlKTtcblx0XHRjb25zdCBhY3R1YWwgPSBnZXRFZGl0T3BlcmF0aW9uKG1vZGVsLCBvcCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fSk7XG59XG5cbmZ1bmN0aW9uIGFzc2VydFRyaW1UcmFpbGluZ1doaXRlc3BhY2UodGV4dDogc3RyaW5nW10sIGN1cnNvcnM6IFBvc2l0aW9uW10sIGV4cGVjdGVkOiBJU2luZ2xlRWRpdE9wZXJhdGlvbltdKTogdm9pZCB7XG5cdHJldHVybiB3aXRoRWRpdG9yTW9kZWwodGV4dCwgKG1vZGVsKSA9PiB7XG5cdFx0Y29uc3QgYWN0dWFsID0gdHJpbVRyYWlsaW5nV2hpdGVzcGFjZShtb2RlbCwgY3Vyc29ycywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fSk7XG59XG5cbnN1aXRlKCdFZGl0b3IgQ29tbWFuZHMgLSBUcmltIFRyYWlsaW5nIFdoaXRlc3BhY2UgQ29tbWFuZCcsICgpID0+IHtcblxuXHRsZXQgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ3JlbW92ZSB0cmFpbGluZyB3aGl0ZXNwYWNlJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydFRyaW1UcmFpbGluZ1doaXRlc3BhY2VDb21tYW5kKFsnJ10sIFtdKTtcblx0XHRhc3NlcnRUcmltVHJhaWxpbmdXaGl0ZXNwYWNlQ29tbWFuZChbJ3RleHQnXSwgW10pO1xuXHRcdGFzc2VydFRyaW1UcmFpbGluZ1doaXRlc3BhY2VDb21tYW5kKFsndGV4dCAgICddLCBbY3JlYXRlU2luZ2xlRWRpdE9wKG51bGwsIDEsIDUsIDEsIDgpXSk7XG5cdFx0YXNzZXJ0VHJpbVRyYWlsaW5nV2hpdGVzcGFjZUNvbW1hbmQoWyd0ZXh0XFx0ICAgJ10sIFtjcmVhdGVTaW5nbGVFZGl0T3AobnVsbCwgMSwgNSwgMSwgOSldKTtcblx0XHRhc3NlcnRUcmltVHJhaWxpbmdXaGl0ZXNwYWNlQ29tbWFuZChbJ1xcdCAgICddLCBbY3JlYXRlU2luZ2xlRWRpdE9wKG51bGwsIDEsIDEsIDEsIDUpXSk7XG5cdFx0YXNzZXJ0VHJpbVRyYWlsaW5nV2hpdGVzcGFjZUNvbW1hbmQoWyd0ZXh0XFx0J10sIFtjcmVhdGVTaW5nbGVFZGl0T3AobnVsbCwgMSwgNSwgMSwgNildKTtcblx0XHRhc3NlcnRUcmltVHJhaWxpbmdXaGl0ZXNwYWNlQ29tbWFuZChbXG5cdFx0XHQnc29tZSB0ZXh0XFx0Jyxcblx0XHRcdCdzb21lIG1vcmUgdGV4dCcsXG5cdFx0XHQnXFx0ICAnLFxuXHRcdFx0J2V2ZW4gbW9yZSB0ZXh0ICAnLFxuXHRcdFx0J2FuZCBzb21lIG1peGVkXFx0ICAgXFx0J1xuXHRcdF0sIFtcblx0XHRcdGNyZWF0ZVNpbmdsZUVkaXRPcChudWxsLCAxLCAxMCwgMSwgMTEpLFxuXHRcdFx0Y3JlYXRlU2luZ2xlRWRpdE9wKG51bGwsIDMsIDEsIDMsIDQpLFxuXHRcdFx0Y3JlYXRlU2luZ2xlRWRpdE9wKG51bGwsIDQsIDE1LCA0LCAxNyksXG5cdFx0XHRjcmVhdGVTaW5nbGVFZGl0T3AobnVsbCwgNSwgMTUsIDUsIDIwKVxuXHRcdF0pO1xuXG5cblx0XHRhc3NlcnRUcmltVHJhaWxpbmdXaGl0ZXNwYWNlKFsndGV4dCAgICddLCBbbmV3IFBvc2l0aW9uKDEsIDEpLCBuZXcgUG9zaXRpb24oMSwgMiksIG5ldyBQb3NpdGlvbigxLCAzKV0sIFtjcmVhdGVJbnNlcnREZWxldGVTaW5nbGVFZGl0T3AobnVsbCwgMSwgNSwgMSwgOCldKTtcblx0XHRhc3NlcnRUcmltVHJhaWxpbmdXaGl0ZXNwYWNlKFsndGV4dCAgICddLCBbbmV3IFBvc2l0aW9uKDEsIDEpLCBuZXcgUG9zaXRpb24oMSwgNSldLCBbY3JlYXRlSW5zZXJ0RGVsZXRlU2luZ2xlRWRpdE9wKG51bGwsIDEsIDUsIDEsIDgpXSk7XG5cdFx0YXNzZXJ0VHJpbVRyYWlsaW5nV2hpdGVzcGFjZShbJ3RleHQgICAnXSwgW25ldyBQb3NpdGlvbigxLCAxKSwgbmV3IFBvc2l0aW9uKDEsIDUpLCBuZXcgUG9zaXRpb24oMSwgNildLCBbY3JlYXRlSW5zZXJ0RGVsZXRlU2luZ2xlRWRpdE9wKG51bGwsIDEsIDYsIDEsIDgpXSk7XG5cdFx0YXNzZXJ0VHJpbVRyYWlsaW5nV2hpdGVzcGFjZShbXG5cdFx0XHQnc29tZSB0ZXh0XFx0Jyxcblx0XHRcdCdzb21lIG1vcmUgdGV4dCcsXG5cdFx0XHQnXFx0ICAnLFxuXHRcdFx0J2V2ZW4gbW9yZSB0ZXh0ICAnLFxuXHRcdFx0J2FuZCBzb21lIG1peGVkXFx0ICAgXFx0J1xuXHRcdF0sIFtdLCBbXG5cdFx0XHRjcmVhdGVJbnNlcnREZWxldGVTaW5nbGVFZGl0T3AobnVsbCwgMSwgMTAsIDEsIDExKSxcblx0XHRcdGNyZWF0ZUluc2VydERlbGV0ZVNpbmdsZUVkaXRPcChudWxsLCAzLCAxLCAzLCA0KSxcblx0XHRcdGNyZWF0ZUluc2VydERlbGV0ZVNpbmdsZUVkaXRPcChudWxsLCA0LCAxNSwgNCwgMTcpLFxuXHRcdFx0Y3JlYXRlSW5zZXJ0RGVsZXRlU2luZ2xlRWRpdE9wKG51bGwsIDUsIDE1LCA1LCAyMClcblx0XHRdKTtcblx0XHRhc3NlcnRUcmltVHJhaWxpbmdXaGl0ZXNwYWNlKFtcblx0XHRcdCdzb21lIHRleHRcXHQnLFxuXHRcdFx0J3NvbWUgbW9yZSB0ZXh0Jyxcblx0XHRcdCdcXHQgICcsXG5cdFx0XHQnZXZlbiBtb3JlIHRleHQgICcsXG5cdFx0XHQnYW5kIHNvbWUgbWl4ZWRcXHQgICBcXHQnXG5cdFx0XSwgW25ldyBQb3NpdGlvbigxLCAxMSksIG5ldyBQb3NpdGlvbigzLCAyKSwgbmV3IFBvc2l0aW9uKDUsIDEpLCBuZXcgUG9zaXRpb24oNCwgMSksIG5ldyBQb3NpdGlvbig1LCAxMCldLCBbXG5cdFx0XHRjcmVhdGVJbnNlcnREZWxldGVTaW5nbGVFZGl0T3AobnVsbCwgMywgMiwgMywgNCksXG5cdFx0XHRjcmVhdGVJbnNlcnREZWxldGVTaW5nbGVFZGl0T3AobnVsbCwgNCwgMTUsIDQsIDE3KSxcblx0XHRcdGNyZWF0ZUluc2VydERlbGV0ZVNpbmdsZUVkaXRPcChudWxsLCA1LCAxNSwgNSwgMjApXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NraXBzIHN0cmluZ3MgYW5kIHJlZ2V4IGlmIGNvbmZpZ3VyZWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBjcmVhdGVNb2RlbFNlcnZpY2VzKGRpc3Bvc2FibGVzKTtcblx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9ICd0ZXN0TGFuZ3VhZ2VJZCc7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VJZENvZGVjID0gbGFuZ3VhZ2VTZXJ2aWNlLmxhbmd1YWdlSWRDb2RlYztcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2UoeyBpZDogbGFuZ3VhZ2VJZCB9KSk7XG5cdFx0Y29uc3QgZW5jb2RlZExhbmd1YWdlSWQgPSBsYW5ndWFnZUlkQ29kZWMuZW5jb2RlTGFuZ3VhZ2VJZChsYW5ndWFnZUlkKTtcblxuXHRcdGNvbnN0IG90aGVyTWV0YWRhdGEgPSAoXG5cdFx0XHQoZW5jb2RlZExhbmd1YWdlSWQgPDwgTWV0YWRhdGFDb25zdHMuTEFOR1VBR0VJRF9PRkZTRVQpXG5cdFx0XHR8IChTdGFuZGFyZFRva2VuVHlwZS5PdGhlciA8PCBNZXRhZGF0YUNvbnN0cy5UT0tFTl9UWVBFX09GRlNFVClcblx0XHRcdHwgKE1ldGFkYXRhQ29uc3RzLkJBTEFOQ0VEX0JSQUNLRVRTX01BU0spXG5cdFx0KSA+Pj4gMDtcblx0XHRjb25zdCBzdHJpbmdNZXRhZGF0YSA9IChcblx0XHRcdChlbmNvZGVkTGFuZ3VhZ2VJZCA8PCBNZXRhZGF0YUNvbnN0cy5MQU5HVUFHRUlEX09GRlNFVClcblx0XHRcdHwgKFN0YW5kYXJkVG9rZW5UeXBlLlN0cmluZyA8PCBNZXRhZGF0YUNvbnN0cy5UT0tFTl9UWVBFX09GRlNFVClcblx0XHRcdHwgKE1ldGFkYXRhQ29uc3RzLkJBTEFOQ0VEX0JSQUNLRVRTX01BU0spXG5cdFx0KSA+Pj4gMDtcblxuXHRcdGNvbnN0IHRva2VuaXphdGlvblN1cHBvcnQ6IElUb2tlbml6YXRpb25TdXBwb3J0ID0ge1xuXHRcdFx0Z2V0SW5pdGlhbFN0YXRlOiAoKSA9PiBOdWxsU3RhdGUsXG5cdFx0XHR0b2tlbml6ZTogdW5kZWZpbmVkISxcblx0XHRcdHRva2VuaXplRW5jb2RlZDogKGxpbmUsIGhhc0VPTCwgc3RhdGUpID0+IHtcblx0XHRcdFx0c3dpdGNoIChsaW5lKSB7XG5cdFx0XHRcdFx0Y2FzZSAnY29uc3QgYSA9IGAgICc6IHtcblx0XHRcdFx0XHRcdGNvbnN0IHRva2VucyA9IG5ldyBVaW50MzJBcnJheShbXG5cdFx0XHRcdFx0XHRcdDAsIG90aGVyTWV0YWRhdGEsXG5cdFx0XHRcdFx0XHRcdDEwLCBzdHJpbmdNZXRhZGF0YSxcblx0XHRcdFx0XHRcdF0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0KHRva2Vucywgc3RhdGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjYXNlICcgIGEgc3RyaW5nICAnOiB7XG5cdFx0XHRcdFx0XHRjb25zdCB0b2tlbnMgPSBuZXcgVWludDMyQXJyYXkoW1xuXHRcdFx0XHRcdFx0XHQwLCBzdHJpbmdNZXRhZGF0YSxcblx0XHRcdFx0XHRcdF0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0KHRva2Vucywgc3RhdGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjYXNlICdgOyAgJzoge1xuXHRcdFx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbmV3IFVpbnQzMkFycmF5KFtcblx0XHRcdFx0XHRcdFx0MCwgc3RyaW5nTWV0YWRhdGEsXG5cdFx0XHRcdFx0XHRcdDEsIG90aGVyTWV0YWRhdGFcblx0XHRcdFx0XHRcdF0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0KHRva2Vucywgc3RhdGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWRgKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKFRva2VuaXphdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKGxhbmd1YWdlSWQsIHRva2VuaXphdGlvblN1cHBvcnQpKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0XHRbXG5cdFx0XHRcdCdjb25zdCBhID0gYCAgJyxcblx0XHRcdFx0JyAgYSBzdHJpbmcgICcsXG5cdFx0XHRcdCdgOyAgJyxcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHRsYW5ndWFnZUlkXG5cdFx0KSk7XG5cblx0XHRtb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24oMSk7XG5cdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKDIpO1xuXHRcdG1vZGVsLnRva2VuaXphdGlvbi5mb3JjZVRva2VuaXphdGlvbigzKTtcblxuXHRcdGNvbnN0IG9wID0gbmV3IFRyaW1UcmFpbGluZ1doaXRlc3BhY2VDb21tYW5kKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksIFtdLCBmYWxzZSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gZ2V0RWRpdE9wZXJhdGlvbihtb2RlbCwgb3ApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBbY3JlYXRlU2luZ2xlRWRpdE9wKG51bGwsIDMsIDMsIDMsIDUpXSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUywrQkFBK0IsOEJBQThCO0FBRXRFLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGdCQUFnQix5QkFBeUI7QUFDbEQsU0FBUywyQkFBaUQsNEJBQTRCO0FBQ3RGLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMscUJBQXFCLHNCQUFzQix1QkFBdUI7QUFLM0UsU0FBUywrQkFBK0IsTUFBcUIsb0JBQTRCLGdCQUF3QixzQkFBOEIsb0JBQW9CLGtCQUEwQixnQkFBc0M7QUFDbE8sU0FBTztBQUFBLElBQ04sT0FBTyxJQUFJLE1BQU0scUJBQXFCLGlCQUFpQixvQkFBb0IsY0FBYztBQUFBLElBQ3pGO0FBQUEsRUFDRDtBQUNEO0FBS0EsU0FBUyxtQkFBbUIsTUFBcUIsb0JBQTRCLGdCQUF3QixzQkFBOEIsb0JBQW9CLGtCQUEwQixnQkFBc0M7QUFDdE4sU0FBTztBQUFBLElBQ04sT0FBTyxJQUFJLE1BQU0scUJBQXFCLGlCQUFpQixvQkFBb0IsY0FBYztBQUFBLElBQ3pGO0FBQUEsSUFDQSxrQkFBa0I7QUFBQSxFQUNuQjtBQUNEO0FBRUEsU0FBUyxvQ0FBb0MsTUFBZ0IsVUFBd0M7QUFDcEcsU0FBTyxnQkFBZ0IsTUFBTSxDQUFDLFVBQVU7QUFDdkMsVUFBTSxLQUFLLElBQUksOEJBQThCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUk7QUFDaEYsVUFBTSxTQUFTLGlCQUFpQixPQUFPLEVBQUU7QUFDekMsV0FB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
