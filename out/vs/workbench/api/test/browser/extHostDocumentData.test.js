import assert from "assert";
import { URI } from "../../../../base/common/uri.js";
import { ExtHostDocumentData } from "../../common/extHostDocumentData.js";
import { Position } from "../../common/extHostTypes.js";
import { Range } from "../../../../editor/common/core/range.js";
import { mock } from "../../../../base/test/common/mock.js";
import * as perfData from "./extHostDocumentData.test.perf-data.js";
import { setDefaultGetWordAtTextConfig } from "../../../../editor/common/core/wordHelper.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
suite("ExtHostDocumentData", () => {
  let data;
  function assertPositionAt(offset, line, character) {
    const position = data.document.positionAt(offset);
    assert.strictEqual(position.line, line);
    assert.strictEqual(position.character, character);
  }
  function assertOffsetAt(line, character, offset) {
    const pos = new Position(line, character);
    const actual = data.document.offsetAt(pos);
    assert.strictEqual(actual, offset);
  }
  setup(function() {
    data = new ExtHostDocumentData(void 0, URI.file(""), [
      "This is line one",
      //16
      "and this is line number two",
      //27
      "it is followed by #3",
      //20
      "and finished with the fourth."
      //29
    ], "\n", 1, "text", false, "utf8");
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("readonly-ness", () => {
    assert.throws(() => data.document.uri = null);
    assert.throws(() => data.document.fileName = "foofile");
    assert.throws(() => data.document.isDirty = false);
    assert.throws(() => data.document.isUntitled = false);
    assert.throws(() => data.document.languageId = "dddd");
    assert.throws(() => data.document.lineCount = 9);
  });
  test("save, when disposed", function() {
    let saved;
    const data2 = new ExtHostDocumentData(new class extends mock() {
      $trySaveDocument(uri) {
        assert.ok(!saved);
        saved = uri;
        return Promise.resolve(true);
      }
    }(), URI.parse("foo:bar"), [], "\n", 1, "text", true, "utf8");
    return data2.document.save().then(() => {
      assert.strictEqual(saved.toString(), "foo:bar");
      data2.dispose();
      return data2.document.save().then(() => {
        assert.ok(false, "expected failure");
      }, (err) => {
        assert.ok(err);
      });
    });
  });
  test("read, when disposed", function() {
    data.dispose();
    const { document } = data;
    assert.strictEqual(document.lineCount, 4);
    assert.strictEqual(document.lineAt(0).text, "This is line one");
  });
  test("lines", () => {
    assert.strictEqual(data.document.lineCount, 4);
    assert.throws(() => data.document.lineAt(-1));
    assert.throws(() => data.document.lineAt(data.document.lineCount));
    assert.throws(() => data.document.lineAt(Number.MAX_VALUE));
    assert.throws(() => data.document.lineAt(Number.MIN_VALUE));
    assert.throws(() => data.document.lineAt(0.8));
    let line = data.document.lineAt(0);
    assert.strictEqual(line.lineNumber, 0);
    assert.strictEqual(line.text.length, 16);
    assert.strictEqual(line.text, "This is line one");
    assert.strictEqual(line.isEmptyOrWhitespace, false);
    assert.strictEqual(line.firstNonWhitespaceCharacterIndex, 0);
    data.onEvents({
      changes: [{
        range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
        rangeOffset: void 0,
        rangeLength: void 0,
        text: "	 "
      }],
      eol: void 0,
      versionId: void 0,
      isRedoing: false,
      isUndoing: false
    });
    assert.strictEqual(line.text, "This is line one");
    assert.strictEqual(line.firstNonWhitespaceCharacterIndex, 0);
    line = data.document.lineAt(0);
    assert.strictEqual(line.text, "	 This is line one");
    assert.strictEqual(line.firstNonWhitespaceCharacterIndex, 2);
  });
  test("line, issue #5704", function() {
    let line = data.document.lineAt(0);
    let { range, rangeIncludingLineBreak } = line;
    assert.strictEqual(range.end.line, 0);
    assert.strictEqual(range.end.character, 16);
    assert.strictEqual(rangeIncludingLineBreak.end.line, 1);
    assert.strictEqual(rangeIncludingLineBreak.end.character, 0);
    line = data.document.lineAt(data.document.lineCount - 1);
    range = line.range;
    rangeIncludingLineBreak = line.rangeIncludingLineBreak;
    assert.strictEqual(range.end.line, 3);
    assert.strictEqual(range.end.character, 29);
    assert.strictEqual(rangeIncludingLineBreak.end.line, 3);
    assert.strictEqual(rangeIncludingLineBreak.end.character, 29);
  });
  test("offsetAt", () => {
    assertOffsetAt(0, 0, 0);
    assertOffsetAt(0, 1, 1);
    assertOffsetAt(0, 16, 16);
    assertOffsetAt(1, 0, 17);
    assertOffsetAt(1, 3, 20);
    assertOffsetAt(2, 0, 45);
    assertOffsetAt(4, 29, 95);
    assertOffsetAt(4, 30, 95);
    assertOffsetAt(4, Number.MAX_VALUE, 95);
    assertOffsetAt(5, 29, 95);
    assertOffsetAt(Number.MAX_VALUE, 29, 95);
    assertOffsetAt(Number.MAX_VALUE, Number.MAX_VALUE, 95);
  });
  test("offsetAt, after remove", function() {
    data.onEvents({
      changes: [{
        range: { startLineNumber: 1, startColumn: 3, endLineNumber: 1, endColumn: 6 },
        rangeOffset: void 0,
        rangeLength: void 0,
        text: ""
      }],
      eol: void 0,
      versionId: void 0,
      isRedoing: false,
      isUndoing: false
    });
    assertOffsetAt(0, 1, 1);
    assertOffsetAt(0, 13, 13);
    assertOffsetAt(1, 0, 14);
  });
  test("offsetAt, after replace", function() {
    data.onEvents({
      changes: [{
        range: { startLineNumber: 1, startColumn: 3, endLineNumber: 1, endColumn: 6 },
        rangeOffset: void 0,
        rangeLength: void 0,
        text: "is could be"
      }],
      eol: void 0,
      versionId: void 0,
      isRedoing: false,
      isUndoing: false
    });
    assertOffsetAt(0, 1, 1);
    assertOffsetAt(0, 24, 24);
    assertOffsetAt(1, 0, 25);
  });
  test("offsetAt, after insert line", function() {
    data.onEvents({
      changes: [{
        range: { startLineNumber: 1, startColumn: 3, endLineNumber: 1, endColumn: 6 },
        rangeOffset: void 0,
        rangeLength: void 0,
        text: "is could be\na line with number"
      }],
      eol: void 0,
      versionId: void 0,
      isRedoing: false,
      isUndoing: false
    });
    assertOffsetAt(0, 1, 1);
    assertOffsetAt(0, 13, 13);
    assertOffsetAt(1, 0, 14);
    assertOffsetAt(1, 18, 13 + 1 + 18);
    assertOffsetAt(1, 29, 13 + 1 + 29);
    assertOffsetAt(2, 0, 13 + 1 + 29 + 1);
  });
  test("offsetAt, after remove line", function() {
    data.onEvents({
      changes: [{
        range: { startLineNumber: 1, startColumn: 3, endLineNumber: 2, endColumn: 6 },
        rangeOffset: void 0,
        rangeLength: void 0,
        text: ""
      }],
      eol: void 0,
      versionId: void 0,
      isRedoing: false,
      isUndoing: false
    });
    assertOffsetAt(0, 1, 1);
    assertOffsetAt(0, 2, 2);
    assertOffsetAt(1, 0, 25);
  });
  test("positionAt", () => {
    assertPositionAt(0, 0, 0);
    assertPositionAt(Number.MIN_VALUE, 0, 0);
    assertPositionAt(1, 0, 1);
    assertPositionAt(16, 0, 16);
    assertPositionAt(17, 1, 0);
    assertPositionAt(20, 1, 3);
    assertPositionAt(45, 2, 0);
    assertPositionAt(95, 3, 29);
    assertPositionAt(96, 3, 29);
    assertPositionAt(99, 3, 29);
    assertPositionAt(Number.MAX_VALUE, 3, 29);
  });
  test("getWordRangeAtPosition", () => {
    data = new ExtHostDocumentData(void 0, URI.file(""), [
      "aaaa bbbb+cccc abc"
    ], "\n", 1, "text", false, "utf8");
    let range = data.document.getWordRangeAtPosition(new Position(0, 2));
    assert.strictEqual(range.start.line, 0);
    assert.strictEqual(range.start.character, 0);
    assert.strictEqual(range.end.line, 0);
    assert.strictEqual(range.end.character, 4);
    assert.throws(() => data.document.getWordRangeAtPosition(new Position(0, 2), /.*/));
    range = data.document.getWordRangeAtPosition(new Position(0, 5), /[a-z+]+/);
    assert.strictEqual(range.start.line, 0);
    assert.strictEqual(range.start.character, 5);
    assert.strictEqual(range.end.line, 0);
    assert.strictEqual(range.end.character, 14);
    range = data.document.getWordRangeAtPosition(new Position(0, 17), /[a-z+]+/);
    assert.strictEqual(range.start.line, 0);
    assert.strictEqual(range.start.character, 15);
    assert.strictEqual(range.end.line, 0);
    assert.strictEqual(range.end.character, 18);
    range = data.document.getWordRangeAtPosition(new Position(0, 11), /yy/);
    assert.strictEqual(range, void 0);
  });
  test("getWordRangeAtPosition doesn't quite use the regex as expected, #29102", function() {
    data = new ExtHostDocumentData(void 0, URI.file(""), [
      "some text here",
      "/** foo bar */",
      "function() {",
      '	"far boo"',
      "}"
    ], "\n", 1, "text", false, "utf8");
    let range = data.document.getWordRangeAtPosition(new Position(0, 0), /\/\*.+\*\//);
    assert.strictEqual(range, void 0);
    range = data.document.getWordRangeAtPosition(new Position(1, 0), /\/\*.+\*\//);
    assert.strictEqual(range.start.line, 1);
    assert.strictEqual(range.start.character, 0);
    assert.strictEqual(range.end.line, 1);
    assert.strictEqual(range.end.character, 14);
    range = data.document.getWordRangeAtPosition(new Position(3, 0), /("|').*\1/);
    assert.strictEqual(range, void 0);
    range = data.document.getWordRangeAtPosition(new Position(3, 1), /("|').*\1/);
    assert.strictEqual(range.start.line, 3);
    assert.strictEqual(range.start.character, 1);
    assert.strictEqual(range.end.line, 3);
    assert.strictEqual(range.end.character, 10);
  });
  test("getWordRangeAtPosition can freeze the extension host #95319", function() {
    const regex = /(https?:\/\/github\.com\/(([^\s]+)\/([^\s]+))\/([^\s]+\/)?(issues|pull)\/([0-9]+))|(([^\s]+)\/([^\s]+))?#([1-9][0-9]*)($|[\s\:\;\-\(\=])/;
    data = new ExtHostDocumentData(void 0, URI.file(""), [
      perfData._$_$_expensive
    ], "\n", 1, "text", false, "utf8");
    const config = setDefaultGetWordAtTextConfig({ maxLen: 1e3, windowSize: 15, timeBudget: 30 });
    try {
      let range = data.document.getWordRangeAtPosition(new Position(0, 1177170), regex);
      assert.strictEqual(range, void 0);
      const pos = new Position(0, 1177170);
      range = data.document.getWordRangeAtPosition(pos);
      assert.ok(range);
      assert.ok(range.contains(pos));
      assert.strictEqual(data.document.getText(range), "TaskDefinition");
    } finally {
      config.dispose();
    }
  });
  test("Rename popup sometimes populates with text on the left side omitted #96013", function() {
    const regex = /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g;
    const line = "int abcdefhijklmnopqwvrstxyz;";
    data = new ExtHostDocumentData(void 0, URI.file(""), [
      line
    ], "\n", 1, "text", false, "utf8");
    const range = data.document.getWordRangeAtPosition(new Position(0, 27), regex);
    assert.strictEqual(range.start.line, 0);
    assert.strictEqual(range.end.line, 0);
    assert.strictEqual(range.start.character, 4);
    assert.strictEqual(range.end.character, 28);
  });
  test("Custom snippet $TM_SELECTED_TEXT not show suggestion #108892", function() {
    data = new ExtHostDocumentData(void 0, URI.file(""), [
      `        <p><span xml:lang="en">Sheldon</span>, soprannominato "<span xml:lang="en">Shelly</span> dalla madre e dalla sorella, \xE8 nato a <span xml:lang="en">Galveston</span>, in <span xml:lang="en">Texas</span>, il 26 febbraio 1980 in un supermercato. \xC8 stato un bambino prodigio, come testimoniato dal suo quoziente d'intelligenza (187, di molto superiore alla norma) e dalla sua rapida carriera scolastica: si \xE8 diplomato all'eta di 11 anni approdando alla stessa et\xE0 alla formazione universitaria e all'et\xE0 di 16 anni ha ottenuto il suo primo dottorato di ricerca. All'inizio della serie e per gran parte di essa vive con il coinquilino Leonard nell'appartamento 4A al 2311 <span xml:lang="en">North Los Robles Avenue</span> di <span xml:lang="en">Pasadena</span>, per poi trasferirsi nell'appartamento di <span xml:lang="en">Penny</span> con <span xml:lang="en">Amy</span> nella decima stagione. Come pi\xF9 volte afferma lui stesso possiede una memoria eidetica e un orecchio assoluto. \xC8 stato educato da una madre estremamente religiosa e, in pi\xF9 occasioni, questo aspetto contrasta con il rigore scientifico di <span xml:lang="en">Sheldon</span>; tuttavia la donna sembra essere l'unica persona in grado di comandarlo a bacchetta.</p>`
    ], "\n", 1, "text", false, "utf8");
    const pos = new Position(0, 55);
    const range = data.document.getWordRangeAtPosition(pos);
    assert.strictEqual(range.start.line, 0);
    assert.strictEqual(range.end.line, 0);
    assert.strictEqual(range.start.character, 47);
    assert.strictEqual(range.end.character, 61);
    assert.strictEqual(data.document.getText(range), "soprannominato");
  });
});
var AssertDocumentLineMappingDirection = /* @__PURE__ */ ((AssertDocumentLineMappingDirection2) => {
  AssertDocumentLineMappingDirection2[AssertDocumentLineMappingDirection2["OffsetToPosition"] = 0] = "OffsetToPosition";
  AssertDocumentLineMappingDirection2[AssertDocumentLineMappingDirection2["PositionToOffset"] = 1] = "PositionToOffset";
  return AssertDocumentLineMappingDirection2;
})(AssertDocumentLineMappingDirection || {});
suite("ExtHostDocumentData updates line mapping", () => {
  function positionToStr(position) {
    return "(" + position.line + "," + position.character + ")";
  }
  function assertDocumentLineMapping(doc, direction) {
    const allText = doc.getText();
    let line = 0, character = 0, previousIsCarriageReturn = false;
    for (let offset = 0; offset <= allText.length; offset++) {
      const position = new Position(line, character + (previousIsCarriageReturn ? -1 : 0));
      if (direction === 0 /* OffsetToPosition */) {
        const actualPosition = doc.document.positionAt(offset);
        assert.strictEqual(positionToStr(actualPosition), positionToStr(position), "positionAt mismatch for offset " + offset);
      } else {
        const expectedOffset = offset + (previousIsCarriageReturn ? -1 : 0);
        const actualOffset = doc.document.offsetAt(position);
        assert.strictEqual(actualOffset, expectedOffset, "offsetAt mismatch for position " + positionToStr(position));
      }
      if (allText.charAt(offset) === "\n") {
        line++;
        character = 0;
      } else {
        character++;
      }
      previousIsCarriageReturn = allText.charAt(offset) === "\r";
    }
  }
  function createChangeEvent(range, text, eol) {
    return {
      changes: [{
        range,
        rangeOffset: void 0,
        rangeLength: void 0,
        text
      }],
      eol,
      versionId: void 0,
      isRedoing: false,
      isUndoing: false
    };
  }
  function testLineMappingDirectionAfterEvents(lines, eol, direction, e) {
    const myDocument = new ExtHostDocumentData(void 0, URI.file(""), lines.slice(0), eol, 1, "text", false, "utf8");
    assertDocumentLineMapping(myDocument, direction);
    myDocument.onEvents(e);
    assertDocumentLineMapping(myDocument, direction);
  }
  function testLineMappingAfterEvents(lines, e) {
    testLineMappingDirectionAfterEvents(lines, "\n", 1 /* PositionToOffset */, e);
    testLineMappingDirectionAfterEvents(lines, "\n", 0 /* OffsetToPosition */, e);
    testLineMappingDirectionAfterEvents(lines, "\r\n", 1 /* PositionToOffset */, e);
    testLineMappingDirectionAfterEvents(lines, "\r\n", 0 /* OffsetToPosition */, e);
  }
  ensureNoDisposablesAreLeakedInTestSuite();
  test("line mapping", () => {
    testLineMappingAfterEvents([
      "This is line one",
      "and this is line number two",
      "it is followed by #3",
      "and finished with the fourth."
    ], { changes: [], eol: void 0, versionId: 7, isRedoing: false, isUndoing: false });
  });
  test("after remove", () => {
    testLineMappingAfterEvents([
      "This is line one",
      "and this is line number two",
      "it is followed by #3",
      "and finished with the fourth."
    ], createChangeEvent(new Range(1, 3, 1, 6), ""));
  });
  test("after replace", () => {
    testLineMappingAfterEvents([
      "This is line one",
      "and this is line number two",
      "it is followed by #3",
      "and finished with the fourth."
    ], createChangeEvent(new Range(1, 3, 1, 6), "is could be"));
  });
  test("after insert line", () => {
    testLineMappingAfterEvents([
      "This is line one",
      "and this is line number two",
      "it is followed by #3",
      "and finished with the fourth."
    ], createChangeEvent(new Range(1, 3, 1, 6), "is could be\na line with number"));
  });
  test("after insert two lines", () => {
    testLineMappingAfterEvents([
      "This is line one",
      "and this is line number two",
      "it is followed by #3",
      "and finished with the fourth."
    ], createChangeEvent(new Range(1, 3, 1, 6), "is could be\na line with number\nyet another line"));
  });
  test("after remove line", () => {
    testLineMappingAfterEvents([
      "This is line one",
      "and this is line number two",
      "it is followed by #3",
      "and finished with the fourth."
    ], createChangeEvent(new Range(1, 3, 2, 6), ""));
  });
  test("after remove two lines", () => {
    testLineMappingAfterEvents([
      "This is line one",
      "and this is line number two",
      "it is followed by #3",
      "and finished with the fourth."
    ], createChangeEvent(new Range(1, 3, 3, 6), ""));
  });
  test("after deleting entire content", () => {
    testLineMappingAfterEvents([
      "This is line one",
      "and this is line number two",
      "it is followed by #3",
      "and finished with the fourth."
    ], createChangeEvent(new Range(1, 3, 4, 30), ""));
  });
  test("after replacing entire content", () => {
    testLineMappingAfterEvents([
      "This is line one",
      "and this is line number two",
      "it is followed by #3",
      "and finished with the fourth."
    ], createChangeEvent(new Range(1, 3, 4, 30), "some new text\nthat\nspans multiple lines"));
  });
  test("after changing EOL to CRLF", () => {
    testLineMappingAfterEvents([
      "This is line one",
      "and this is line number two",
      "it is followed by #3",
      "and finished with the fourth."
    ], createChangeEvent(new Range(1, 1, 1, 1), "", "\r\n"));
  });
  test("after changing EOL to LF", () => {
    testLineMappingAfterEvents([
      "This is line one",
      "and this is line number two",
      "it is followed by #3",
      "and finished with the fourth."
    ], createChangeEvent(new Range(1, 1, 1, 1), "", "\n"));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0RG9jdW1lbnREYXRhLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRXh0SG9zdERvY3VtZW50RGF0YSB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0RG9jdW1lbnREYXRhLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBNYWluVGhyZWFkRG9jdW1lbnRzU2hhcGUgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxDaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL21pcnJvclRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCAqIGFzIHBlcmZEYXRhIGZyb20gJy4vZXh0SG9zdERvY3VtZW50RGF0YS50ZXN0LnBlcmYtZGF0YS5qcyc7XG5pbXBvcnQgeyBzZXREZWZhdWx0R2V0V29yZEF0VGV4dENvbmZpZyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS93b3JkSGVscGVyLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5zdWl0ZSgnRXh0SG9zdERvY3VtZW50RGF0YScsICgpID0+IHtcblxuXHRsZXQgZGF0YTogRXh0SG9zdERvY3VtZW50RGF0YTtcblxuXHRmdW5jdGlvbiBhc3NlcnRQb3NpdGlvbkF0KG9mZnNldDogbnVtYmVyLCBsaW5lOiBudW1iZXIsIGNoYXJhY3RlcjogbnVtYmVyKSB7XG5cdFx0Y29uc3QgcG9zaXRpb24gPSBkYXRhLmRvY3VtZW50LnBvc2l0aW9uQXQob2Zmc2V0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocG9zaXRpb24ubGluZSwgbGluZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBvc2l0aW9uLmNoYXJhY3RlciwgY2hhcmFjdGVyKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFzc2VydE9mZnNldEF0KGxpbmU6IG51bWJlciwgY2hhcmFjdGVyOiBudW1iZXIsIG9mZnNldDogbnVtYmVyKSB7XG5cdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKGxpbmUsIGNoYXJhY3Rlcik7XG5cdFx0Y29uc3QgYWN0dWFsID0gZGF0YS5kb2N1bWVudC5vZmZzZXRBdChwb3MpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIG9mZnNldCk7XG5cdH1cblxuXHRzZXR1cChmdW5jdGlvbiAoKSB7XG5cdFx0ZGF0YSA9IG5ldyBFeHRIb3N0RG9jdW1lbnREYXRhKHVuZGVmaW5lZCEsIFVSSS5maWxlKCcnKSwgW1xuXHRcdFx0J1RoaXMgaXMgbGluZSBvbmUnLCAvLzE2XG5cdFx0XHQnYW5kIHRoaXMgaXMgbGluZSBudW1iZXIgdHdvJywgLy8yN1xuXHRcdFx0J2l0IGlzIGZvbGxvd2VkIGJ5ICMzJywgLy8yMFxuXHRcdFx0J2FuZCBmaW5pc2hlZCB3aXRoIHRoZSBmb3VydGguJywgLy8yOVxuXHRcdF0sICdcXG4nLCAxLCAndGV4dCcsIGZhbHNlLCAndXRmOCcpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdyZWFkb25seS1uZXNzJywgKCkgPT4ge1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gKGRhdGEgYXMgYW55KS5kb2N1bWVudC51cmkgPSBudWxsKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IChkYXRhIGFzIGFueSkuZG9jdW1lbnQuZmlsZU5hbWUgPSAnZm9vZmlsZScpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gKGRhdGEgYXMgYW55KS5kb2N1bWVudC5pc0RpcnR5ID0gZmFsc2UpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gKGRhdGEgYXMgYW55KS5kb2N1bWVudC5pc1VudGl0bGVkID0gZmFsc2UpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gKGRhdGEgYXMgYW55KS5kb2N1bWVudC5sYW5ndWFnZUlkID0gJ2RkZGQnKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IChkYXRhIGFzIGFueSkuZG9jdW1lbnQubGluZUNvdW50ID0gOSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmUsIHdoZW4gZGlzcG9zZWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0bGV0IHNhdmVkOiBVUkk7XG5cdFx0Y29uc3QgZGF0YSA9IG5ldyBFeHRIb3N0RG9jdW1lbnREYXRhKG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZERvY3VtZW50c1NoYXBlPigpIHtcblx0XHRcdG92ZXJyaWRlICR0cnlTYXZlRG9jdW1lbnQodXJpOiBVUkkpIHtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFzYXZlZCk7XG5cdFx0XHRcdHNhdmVkID0gdXJpO1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRydWUpO1xuXHRcdFx0fVxuXHRcdH0sIFVSSS5wYXJzZSgnZm9vOmJhcicpLCBbXSwgJ1xcbicsIDEsICd0ZXh0JywgdHJ1ZSwgJ3V0ZjgnKTtcblxuXHRcdHJldHVybiBkYXRhLmRvY3VtZW50LnNhdmUoKS50aGVuKCgpID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlZC50b1N0cmluZygpLCAnZm9vOmJhcicpO1xuXG5cdFx0XHRkYXRhLmRpc3Bvc2UoKTtcblxuXHRcdFx0cmV0dXJuIGRhdGEuZG9jdW1lbnQuc2F2ZSgpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQub2soZmFsc2UsICdleHBlY3RlZCBmYWlsdXJlJyk7XG5cdFx0XHR9LCBlcnIgPT4ge1xuXHRcdFx0XHRhc3NlcnQub2soZXJyKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWFkLCB3aGVuIGRpc3Bvc2VkJywgZnVuY3Rpb24gKCkge1xuXHRcdGRhdGEuZGlzcG9zZSgpO1xuXG5cdFx0Y29uc3QgeyBkb2N1bWVudCB9ID0gZGF0YTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZG9jdW1lbnQubGluZUNvdW50LCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZG9jdW1lbnQubGluZUF0KDApLnRleHQsICdUaGlzIGlzIGxpbmUgb25lJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xpbmVzJywgKCkgPT4ge1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRhdGEuZG9jdW1lbnQubGluZUNvdW50LCA0KTtcblxuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gZGF0YS5kb2N1bWVudC5saW5lQXQoLTEpKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IGRhdGEuZG9jdW1lbnQubGluZUF0KGRhdGEuZG9jdW1lbnQubGluZUNvdW50KSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBkYXRhLmRvY3VtZW50LmxpbmVBdChOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBkYXRhLmRvY3VtZW50LmxpbmVBdChOdW1iZXIuTUlOX1ZBTFVFKSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBkYXRhLmRvY3VtZW50LmxpbmVBdCgwLjgpKTtcblxuXHRcdGxldCBsaW5lID0gZGF0YS5kb2N1bWVudC5saW5lQXQoMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmUubGluZU51bWJlciwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmUudGV4dC5sZW5ndGgsIDE2KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZS50ZXh0LCAnVGhpcyBpcyBsaW5lIG9uZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lLmlzRW1wdHlPcldoaXRlc3BhY2UsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZS5maXJzdE5vbldoaXRlc3BhY2VDaGFyYWN0ZXJJbmRleCwgMCk7XG5cblx0XHRkYXRhLm9uRXZlbnRzKHtcblx0XHRcdGNoYW5nZXM6IFt7XG5cdFx0XHRcdHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDEsIGVuZExpbmVOdW1iZXI6IDEsIGVuZENvbHVtbjogMSB9LFxuXHRcdFx0XHRyYW5nZU9mZnNldDogdW5kZWZpbmVkISxcblx0XHRcdFx0cmFuZ2VMZW5ndGg6IHVuZGVmaW5lZCEsXG5cdFx0XHRcdHRleHQ6ICdcXHQgJ1xuXHRcdFx0fV0sXG5cdFx0XHRlb2w6IHVuZGVmaW5lZCEsXG5cdFx0XHR2ZXJzaW9uSWQ6IHVuZGVmaW5lZCEsXG5cdFx0XHRpc1JlZG9pbmc6IGZhbHNlLFxuXHRcdFx0aXNVbmRvaW5nOiBmYWxzZSxcblx0XHR9KTtcblxuXHRcdC8vIGxpbmUgZGlkbid0IGNoYW5nZVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lLnRleHQsICdUaGlzIGlzIGxpbmUgb25lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmUuZmlyc3ROb25XaGl0ZXNwYWNlQ2hhcmFjdGVySW5kZXgsIDApO1xuXG5cdFx0Ly8gZmV0Y2ggbGluZSBhZ2FpblxuXHRcdGxpbmUgPSBkYXRhLmRvY3VtZW50LmxpbmVBdCgwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZS50ZXh0LCAnXFx0IFRoaXMgaXMgbGluZSBvbmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZS5maXJzdE5vbldoaXRlc3BhY2VDaGFyYWN0ZXJJbmRleCwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ2xpbmUsIGlzc3VlICM1NzA0JywgZnVuY3Rpb24gKCkge1xuXG5cdFx0bGV0IGxpbmUgPSBkYXRhLmRvY3VtZW50LmxpbmVBdCgwKTtcblx0XHRsZXQgeyByYW5nZSwgcmFuZ2VJbmNsdWRpbmdMaW5lQnJlYWsgfSA9IGxpbmU7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLmVuZC5saW5lLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2UuZW5kLmNoYXJhY3RlciwgMTYpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZUluY2x1ZGluZ0xpbmVCcmVhay5lbmQubGluZSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlSW5jbHVkaW5nTGluZUJyZWFrLmVuZC5jaGFyYWN0ZXIsIDApO1xuXG5cdFx0bGluZSA9IGRhdGEuZG9jdW1lbnQubGluZUF0KGRhdGEuZG9jdW1lbnQubGluZUNvdW50IC0gMSk7XG5cdFx0cmFuZ2UgPSBsaW5lLnJhbmdlO1xuXHRcdHJhbmdlSW5jbHVkaW5nTGluZUJyZWFrID0gbGluZS5yYW5nZUluY2x1ZGluZ0xpbmVCcmVhaztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2UuZW5kLmxpbmUsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZS5lbmQuY2hhcmFjdGVyLCAyOSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlSW5jbHVkaW5nTGluZUJyZWFrLmVuZC5saW5lLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VJbmNsdWRpbmdMaW5lQnJlYWsuZW5kLmNoYXJhY3RlciwgMjkpO1xuXG5cdH0pO1xuXG5cdHRlc3QoJ29mZnNldEF0JywgKCkgPT4ge1xuXHRcdGFzc2VydE9mZnNldEF0KDAsIDAsIDApO1xuXHRcdGFzc2VydE9mZnNldEF0KDAsIDEsIDEpO1xuXHRcdGFzc2VydE9mZnNldEF0KDAsIDE2LCAxNik7XG5cdFx0YXNzZXJ0T2Zmc2V0QXQoMSwgMCwgMTcpO1xuXHRcdGFzc2VydE9mZnNldEF0KDEsIDMsIDIwKTtcblx0XHRhc3NlcnRPZmZzZXRBdCgyLCAwLCA0NSk7XG5cdFx0YXNzZXJ0T2Zmc2V0QXQoNCwgMjksIDk1KTtcblx0XHRhc3NlcnRPZmZzZXRBdCg0LCAzMCwgOTUpO1xuXHRcdGFzc2VydE9mZnNldEF0KDQsIE51bWJlci5NQVhfVkFMVUUsIDk1KTtcblx0XHRhc3NlcnRPZmZzZXRBdCg1LCAyOSwgOTUpO1xuXHRcdGFzc2VydE9mZnNldEF0KE51bWJlci5NQVhfVkFMVUUsIDI5LCA5NSk7XG5cdFx0YXNzZXJ0T2Zmc2V0QXQoTnVtYmVyLk1BWF9WQUxVRSwgTnVtYmVyLk1BWF9WQUxVRSwgOTUpO1xuXHR9KTtcblxuXHR0ZXN0KCdvZmZzZXRBdCwgYWZ0ZXIgcmVtb3ZlJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGF0YS5vbkV2ZW50cyh7XG5cdFx0XHRjaGFuZ2VzOiBbe1xuXHRcdFx0XHRyYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAzLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDYgfSxcblx0XHRcdFx0cmFuZ2VPZmZzZXQ6IHVuZGVmaW5lZCEsXG5cdFx0XHRcdHJhbmdlTGVuZ3RoOiB1bmRlZmluZWQhLFxuXHRcdFx0XHR0ZXh0OiAnJ1xuXHRcdFx0fV0sXG5cdFx0XHRlb2w6IHVuZGVmaW5lZCEsXG5cdFx0XHR2ZXJzaW9uSWQ6IHVuZGVmaW5lZCEsXG5cdFx0XHRpc1JlZG9pbmc6IGZhbHNlLFxuXHRcdFx0aXNVbmRvaW5nOiBmYWxzZSxcblx0XHR9KTtcblxuXHRcdGFzc2VydE9mZnNldEF0KDAsIDEsIDEpO1xuXHRcdGFzc2VydE9mZnNldEF0KDAsIDEzLCAxMyk7XG5cdFx0YXNzZXJ0T2Zmc2V0QXQoMSwgMCwgMTQpO1xuXHR9KTtcblxuXHR0ZXN0KCdvZmZzZXRBdCwgYWZ0ZXIgcmVwbGFjZScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGRhdGEub25FdmVudHMoe1xuXHRcdFx0Y2hhbmdlczogW3tcblx0XHRcdFx0cmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMywgZW5kTGluZU51bWJlcjogMSwgZW5kQ29sdW1uOiA2IH0sXG5cdFx0XHRcdHJhbmdlT2Zmc2V0OiB1bmRlZmluZWQhLFxuXHRcdFx0XHRyYW5nZUxlbmd0aDogdW5kZWZpbmVkISxcblx0XHRcdFx0dGV4dDogJ2lzIGNvdWxkIGJlJ1xuXHRcdFx0fV0sXG5cdFx0XHRlb2w6IHVuZGVmaW5lZCEsXG5cdFx0XHR2ZXJzaW9uSWQ6IHVuZGVmaW5lZCEsXG5cdFx0XHRpc1JlZG9pbmc6IGZhbHNlLFxuXHRcdFx0aXNVbmRvaW5nOiBmYWxzZSxcblx0XHR9KTtcblxuXHRcdGFzc2VydE9mZnNldEF0KDAsIDEsIDEpO1xuXHRcdGFzc2VydE9mZnNldEF0KDAsIDI0LCAyNCk7XG5cdFx0YXNzZXJ0T2Zmc2V0QXQoMSwgMCwgMjUpO1xuXHR9KTtcblxuXHR0ZXN0KCdvZmZzZXRBdCwgYWZ0ZXIgaW5zZXJ0IGxpbmUnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRkYXRhLm9uRXZlbnRzKHtcblx0XHRcdGNoYW5nZXM6IFt7XG5cdFx0XHRcdHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDMsIGVuZExpbmVOdW1iZXI6IDEsIGVuZENvbHVtbjogNiB9LFxuXHRcdFx0XHRyYW5nZU9mZnNldDogdW5kZWZpbmVkISxcblx0XHRcdFx0cmFuZ2VMZW5ndGg6IHVuZGVmaW5lZCEsXG5cdFx0XHRcdHRleHQ6ICdpcyBjb3VsZCBiZVxcbmEgbGluZSB3aXRoIG51bWJlcidcblx0XHRcdH1dLFxuXHRcdFx0ZW9sOiB1bmRlZmluZWQhLFxuXHRcdFx0dmVyc2lvbklkOiB1bmRlZmluZWQhLFxuXHRcdFx0aXNSZWRvaW5nOiBmYWxzZSxcblx0XHRcdGlzVW5kb2luZzogZmFsc2UsXG5cdFx0fSk7XG5cblx0XHRhc3NlcnRPZmZzZXRBdCgwLCAxLCAxKTtcblx0XHRhc3NlcnRPZmZzZXRBdCgwLCAxMywgMTMpO1xuXHRcdGFzc2VydE9mZnNldEF0KDEsIDAsIDE0KTtcblx0XHRhc3NlcnRPZmZzZXRBdCgxLCAxOCwgMTMgKyAxICsgMTgpO1xuXHRcdGFzc2VydE9mZnNldEF0KDEsIDI5LCAxMyArIDEgKyAyOSk7XG5cdFx0YXNzZXJ0T2Zmc2V0QXQoMiwgMCwgMTMgKyAxICsgMjkgKyAxKTtcblx0fSk7XG5cblx0dGVzdCgnb2Zmc2V0QXQsIGFmdGVyIHJlbW92ZSBsaW5lJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGF0YS5vbkV2ZW50cyh7XG5cdFx0XHRjaGFuZ2VzOiBbe1xuXHRcdFx0XHRyYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAzLCBlbmRMaW5lTnVtYmVyOiAyLCBlbmRDb2x1bW46IDYgfSxcblx0XHRcdFx0cmFuZ2VPZmZzZXQ6IHVuZGVmaW5lZCEsXG5cdFx0XHRcdHJhbmdlTGVuZ3RoOiB1bmRlZmluZWQhLFxuXHRcdFx0XHR0ZXh0OiAnJ1xuXHRcdFx0fV0sXG5cdFx0XHRlb2w6IHVuZGVmaW5lZCEsXG5cdFx0XHR2ZXJzaW9uSWQ6IHVuZGVmaW5lZCEsXG5cdFx0XHRpc1JlZG9pbmc6IGZhbHNlLFxuXHRcdFx0aXNVbmRvaW5nOiBmYWxzZSxcblx0XHR9KTtcblxuXHRcdGFzc2VydE9mZnNldEF0KDAsIDEsIDEpO1xuXHRcdGFzc2VydE9mZnNldEF0KDAsIDIsIDIpO1xuXHRcdGFzc2VydE9mZnNldEF0KDEsIDAsIDI1KTtcblx0fSk7XG5cblx0dGVzdCgncG9zaXRpb25BdCcsICgpID0+IHtcblx0XHRhc3NlcnRQb3NpdGlvbkF0KDAsIDAsIDApO1xuXHRcdGFzc2VydFBvc2l0aW9uQXQoTnVtYmVyLk1JTl9WQUxVRSwgMCwgMCk7XG5cdFx0YXNzZXJ0UG9zaXRpb25BdCgxLCAwLCAxKTtcblx0XHRhc3NlcnRQb3NpdGlvbkF0KDE2LCAwLCAxNik7XG5cdFx0YXNzZXJ0UG9zaXRpb25BdCgxNywgMSwgMCk7XG5cdFx0YXNzZXJ0UG9zaXRpb25BdCgyMCwgMSwgMyk7XG5cdFx0YXNzZXJ0UG9zaXRpb25BdCg0NSwgMiwgMCk7XG5cdFx0YXNzZXJ0UG9zaXRpb25BdCg5NSwgMywgMjkpO1xuXHRcdGFzc2VydFBvc2l0aW9uQXQoOTYsIDMsIDI5KTtcblx0XHRhc3NlcnRQb3NpdGlvbkF0KDk5LCAzLCAyOSk7XG5cdFx0YXNzZXJ0UG9zaXRpb25BdChOdW1iZXIuTUFYX1ZBTFVFLCAzLCAyOSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldFdvcmRSYW5nZUF0UG9zaXRpb24nLCAoKSA9PiB7XG5cdFx0ZGF0YSA9IG5ldyBFeHRIb3N0RG9jdW1lbnREYXRhKHVuZGVmaW5lZCEsIFVSSS5maWxlKCcnKSwgW1xuXHRcdFx0J2FhYWEgYmJiYitjY2NjIGFiYydcblx0XHRdLCAnXFxuJywgMSwgJ3RleHQnLCBmYWxzZSwgJ3V0ZjgnKTtcblxuXHRcdGxldCByYW5nZSA9IGRhdGEuZG9jdW1lbnQuZ2V0V29yZFJhbmdlQXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMCwgMikpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2Uuc3RhcnQubGluZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLnN0YXJ0LmNoYXJhY3RlciwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLmVuZC5saW5lLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2UuZW5kLmNoYXJhY3RlciwgNCk7XG5cblx0XHQvLyBpZ25vcmUgYmFkIHJlZ3VsYXIgZXhwcmVzc29uIC8uKi9cblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IGRhdGEuZG9jdW1lbnQuZ2V0V29yZFJhbmdlQXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMCwgMiksIC8uKi8pISk7XG5cblx0XHRyYW5nZSA9IGRhdGEuZG9jdW1lbnQuZ2V0V29yZFJhbmdlQXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMCwgNSksIC9bYS16K10rLykhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZS5zdGFydC5saW5lLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2Uuc3RhcnQuY2hhcmFjdGVyLCA1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2UuZW5kLmxpbmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZS5lbmQuY2hhcmFjdGVyLCAxNCk7XG5cblx0XHRyYW5nZSA9IGRhdGEuZG9jdW1lbnQuZ2V0V29yZFJhbmdlQXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMCwgMTcpLCAvW2EteitdKy8pITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2Uuc3RhcnQubGluZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLnN0YXJ0LmNoYXJhY3RlciwgMTUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZS5lbmQubGluZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLmVuZC5jaGFyYWN0ZXIsIDE4KTtcblxuXHRcdHJhbmdlID0gZGF0YS5kb2N1bWVudC5nZXRXb3JkUmFuZ2VBdFBvc2l0aW9uKG5ldyBQb3NpdGlvbigwLCAxMSksIC95eS8pITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2UsIHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldFdvcmRSYW5nZUF0UG9zaXRpb24gZG9lc25cXCd0IHF1aXRlIHVzZSB0aGUgcmVnZXggYXMgZXhwZWN0ZWQsICMyOTEwMicsIGZ1bmN0aW9uICgpIHtcblx0XHRkYXRhID0gbmV3IEV4dEhvc3REb2N1bWVudERhdGEodW5kZWZpbmVkISwgVVJJLmZpbGUoJycpLCBbXG5cdFx0XHQnc29tZSB0ZXh0IGhlcmUnLFxuXHRcdFx0Jy8qKiBmb28gYmFyICovJyxcblx0XHRcdCdmdW5jdGlvbigpIHsnLFxuXHRcdFx0J1x0XCJmYXIgYm9vXCInLFxuXHRcdFx0J30nXG5cdFx0XSwgJ1xcbicsIDEsICd0ZXh0JywgZmFsc2UsICd1dGY4Jyk7XG5cblx0XHRsZXQgcmFuZ2UgPSBkYXRhLmRvY3VtZW50LmdldFdvcmRSYW5nZUF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDAsIDApLCAvXFwvXFwqLitcXCpcXC8vKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2UsIHVuZGVmaW5lZCk7XG5cblx0XHRyYW5nZSA9IGRhdGEuZG9jdW1lbnQuZ2V0V29yZFJhbmdlQXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMCksIC9cXC9cXCouK1xcKlxcLy8pITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2Uuc3RhcnQubGluZSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLnN0YXJ0LmNoYXJhY3RlciwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLmVuZC5saW5lLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2UuZW5kLmNoYXJhY3RlciwgMTQpO1xuXG5cdFx0cmFuZ2UgPSBkYXRhLmRvY3VtZW50LmdldFdvcmRSYW5nZUF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDMsIDApLCAvKFwifCcpLipcXDEvKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2UsIHVuZGVmaW5lZCk7XG5cblx0XHRyYW5nZSA9IGRhdGEuZG9jdW1lbnQuZ2V0V29yZFJhbmdlQXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMywgMSksIC8oXCJ8JykuKlxcMS8pITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2Uuc3RhcnQubGluZSwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLnN0YXJ0LmNoYXJhY3RlciwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLmVuZC5saW5lLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2UuZW5kLmNoYXJhY3RlciwgMTApO1xuXHR9KTtcblxuXG5cdHRlc3QoJ2dldFdvcmRSYW5nZUF0UG9zaXRpb24gY2FuIGZyZWV6ZSB0aGUgZXh0ZW5zaW9uIGhvc3QgIzk1MzE5JywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgcmVnZXggPSAvKGh0dHBzPzpcXC9cXC9naXRodWJcXC5jb21cXC8oKFteXFxzXSspXFwvKFteXFxzXSspKVxcLyhbXlxcc10rXFwvKT8oaXNzdWVzfHB1bGwpXFwvKFswLTldKykpfCgoW15cXHNdKylcXC8oW15cXHNdKykpPyMoWzEtOV1bMC05XSopKCR8W1xcc1xcOlxcO1xcLVxcKFxcPV0pLztcblxuXHRcdGRhdGEgPSBuZXcgRXh0SG9zdERvY3VtZW50RGF0YSh1bmRlZmluZWQhLCBVUkkuZmlsZSgnJyksIFtcblx0XHRcdHBlcmZEYXRhLl8kXyRfZXhwZW5zaXZlXG5cdFx0XSwgJ1xcbicsIDEsICd0ZXh0JywgZmFsc2UsICd1dGY4Jyk7XG5cblx0XHQvLyB0aGlzIHRlc3Qgb25seSBlbnN1cmVzIHRoYXQgd2UgZXZlbnR1YWxseSBnaXZlIGFuZCB0aW1lb3V0ICh3aGVuIHNlYXJjaGluZyBcImZ1bm55XCIgd29yZHMgYW5kIGxvbmcgbGluZXMpXG5cdFx0Ly8gZm9yIHRoZSBzYWtlIG9mIHNwZWVkeSB0ZXN0cyB3ZSBsb3dlciB0aGUgdGltZUJ1ZGdldCBoZXJlXG5cdFx0Y29uc3QgY29uZmlnID0gc2V0RGVmYXVsdEdldFdvcmRBdFRleHRDb25maWcoeyBtYXhMZW46IDEwMDAsIHdpbmRvd1NpemU6IDE1LCB0aW1lQnVkZ2V0OiAzMCB9KTtcblx0XHR0cnkge1xuXHRcdFx0bGV0IHJhbmdlID0gZGF0YS5kb2N1bWVudC5nZXRXb3JkUmFuZ2VBdFBvc2l0aW9uKG5ldyBQb3NpdGlvbigwLCAxXzE3N18xNzApLCByZWdleCkhO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLCB1bmRlZmluZWQpO1xuXG5cdFx0XHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24oMCwgMTE3NzE3MCk7XG5cdFx0XHRyYW5nZSA9IGRhdGEuZG9jdW1lbnQuZ2V0V29yZFJhbmdlQXRQb3NpdGlvbihwb3MpITtcblx0XHRcdGFzc2VydC5vayhyYW5nZSk7XG5cdFx0XHRhc3NlcnQub2socmFuZ2UuY29udGFpbnMocG9zKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGF0YS5kb2N1bWVudC5nZXRUZXh0KHJhbmdlKSwgJ1Rhc2tEZWZpbml0aW9uJyk7XG5cblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Y29uZmlnLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ1JlbmFtZSBwb3B1cCBzb21ldGltZXMgcG9wdWxhdGVzIHdpdGggdGV4dCBvbiB0aGUgbGVmdCBzaWRlIG9taXR0ZWQgIzk2MDEzJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgcmVnZXggPSAvKC0/XFxkKlxcLlxcZFxcdyopfChbXlxcYFxcflxcIVxcQFxcI1xcJFxcJVxcXlxcJlxcKlxcKFxcKVxcLVxcPVxcK1xcW1xce1xcXVxcfVxcXFxcXHxcXDtcXDpcXCdcXFwiXFwsXFwuXFw8XFw+XFwvXFw/XFxzXSspL2c7XG5cdFx0Y29uc3QgbGluZSA9ICdpbnQgYWJjZGVmaGlqa2xtbm9wcXd2cnN0eHl6Oyc7XG5cblx0XHRkYXRhID0gbmV3IEV4dEhvc3REb2N1bWVudERhdGEodW5kZWZpbmVkISwgVVJJLmZpbGUoJycpLCBbXG5cdFx0XHRsaW5lXG5cdFx0XSwgJ1xcbicsIDEsICd0ZXh0JywgZmFsc2UsICd1dGY4Jyk7XG5cblx0XHRjb25zdCByYW5nZSA9IGRhdGEuZG9jdW1lbnQuZ2V0V29yZFJhbmdlQXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMCwgMjcpLCByZWdleCkhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZS5zdGFydC5saW5lLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2UuZW5kLmxpbmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZS5zdGFydC5jaGFyYWN0ZXIsIDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZS5lbmQuY2hhcmFjdGVyLCAyOCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0N1c3RvbSBzbmlwcGV0ICRUTV9TRUxFQ1RFRF9URVhUIG5vdCBzaG93IHN1Z2dlc3Rpb24gIzEwODg5MicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGRhdGEgPSBuZXcgRXh0SG9zdERvY3VtZW50RGF0YSh1bmRlZmluZWQhLCBVUkkuZmlsZSgnJyksIFtcblx0XHRcdGAgICAgICAgIDxwPjxzcGFuIHhtbDpsYW5nPVwiZW5cIj5TaGVsZG9uPC9zcGFuPiwgc29wcmFubm9taW5hdG8gXCI8c3BhbiB4bWw6bGFuZz1cImVuXCI+U2hlbGx5PC9zcGFuPiBkYWxsYSBtYWRyZSBlIGRhbGxhIHNvcmVsbGEsIFx1MDBFOCBuYXRvIGEgPHNwYW4geG1sOmxhbmc9XCJlblwiPkdhbHZlc3Rvbjwvc3Bhbj4sIGluIDxzcGFuIHhtbDpsYW5nPVwiZW5cIj5UZXhhczwvc3Bhbj4sIGlsIDI2IGZlYmJyYWlvIDE5ODAgaW4gdW4gc3VwZXJtZXJjYXRvLiBcdTAwQzggc3RhdG8gdW4gYmFtYmlubyBwcm9kaWdpbywgY29tZSB0ZXN0aW1vbmlhdG8gZGFsIHN1byBxdW96aWVudGUgZCdpbnRlbGxpZ2VuemEgKDE4NywgZGkgbW9sdG8gc3VwZXJpb3JlIGFsbGEgbm9ybWEpIGUgZGFsbGEgc3VhIHJhcGlkYSBjYXJyaWVyYSBzY29sYXN0aWNhOiBzaSBcdTAwRTggZGlwbG9tYXRvIGFsbCdldGEgZGkgMTEgYW5uaSBhcHByb2RhbmRvIGFsbGEgc3Rlc3NhIGV0XHUwMEUwIGFsbGEgZm9ybWF6aW9uZSB1bml2ZXJzaXRhcmlhIGUgYWxsJ2V0XHUwMEUwIGRpIDE2IGFubmkgaGEgb3R0ZW51dG8gaWwgc3VvIHByaW1vIGRvdHRvcmF0byBkaSByaWNlcmNhLiBBbGwnaW5pemlvIGRlbGxhIHNlcmllIGUgcGVyIGdyYW4gcGFydGUgZGkgZXNzYSB2aXZlIGNvbiBpbCBjb2lucXVpbGlubyBMZW9uYXJkIG5lbGwnYXBwYXJ0YW1lbnRvIDRBIGFsIDIzMTEgPHNwYW4geG1sOmxhbmc9XCJlblwiPk5vcnRoIExvcyBSb2JsZXMgQXZlbnVlPC9zcGFuPiBkaSA8c3BhbiB4bWw6bGFuZz1cImVuXCI+UGFzYWRlbmE8L3NwYW4+LCBwZXIgcG9pIHRyYXNmZXJpcnNpIG5lbGwnYXBwYXJ0YW1lbnRvIGRpIDxzcGFuIHhtbDpsYW5nPVwiZW5cIj5QZW5ueTwvc3Bhbj4gY29uIDxzcGFuIHhtbDpsYW5nPVwiZW5cIj5BbXk8L3NwYW4+IG5lbGxhIGRlY2ltYSBzdGFnaW9uZS4gQ29tZSBwaVx1MDBGOSB2b2x0ZSBhZmZlcm1hIGx1aSBzdGVzc28gcG9zc2llZGUgdW5hIG1lbW9yaWEgZWlkZXRpY2EgZSB1biBvcmVjY2hpbyBhc3NvbHV0by4gXHUwMEM4IHN0YXRvIGVkdWNhdG8gZGEgdW5hIG1hZHJlIGVzdHJlbWFtZW50ZSByZWxpZ2lvc2EgZSwgaW4gcGlcdTAwRjkgb2NjYXNpb25pLCBxdWVzdG8gYXNwZXR0byBjb250cmFzdGEgY29uIGlsIHJpZ29yZSBzY2llbnRpZmljbyBkaSA8c3BhbiB4bWw6bGFuZz1cImVuXCI+U2hlbGRvbjwvc3Bhbj47IHR1dHRhdmlhIGxhIGRvbm5hIHNlbWJyYSBlc3NlcmUgbCd1bmljYSBwZXJzb25hIGluIGdyYWRvIGRpIGNvbWFuZGFybG8gYSBiYWNjaGV0dGEuPC9wPmBcblx0XHRdLCAnXFxuJywgMSwgJ3RleHQnLCBmYWxzZSwgJ3V0ZjgnKTtcblxuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigwLCA1NSk7XG5cdFx0Y29uc3QgcmFuZ2UgPSBkYXRhLmRvY3VtZW50LmdldFdvcmRSYW5nZUF0UG9zaXRpb24ocG9zKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLnN0YXJ0LmxpbmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZS5lbmQubGluZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLnN0YXJ0LmNoYXJhY3RlciwgNDcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZS5lbmQuY2hhcmFjdGVyLCA2MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRhdGEuZG9jdW1lbnQuZ2V0VGV4dChyYW5nZSksICdzb3ByYW5ub21pbmF0bycpO1xuXHR9KTtcbn0pO1xuXG5lbnVtIEFzc2VydERvY3VtZW50TGluZU1hcHBpbmdEaXJlY3Rpb24ge1xuXHRPZmZzZXRUb1Bvc2l0aW9uLFxuXHRQb3NpdGlvblRvT2Zmc2V0XG59XG5cbnN1aXRlKCdFeHRIb3N0RG9jdW1lbnREYXRhIHVwZGF0ZXMgbGluZSBtYXBwaW5nJywgKCkgPT4ge1xuXG5cdGZ1bmN0aW9uIHBvc2l0aW9uVG9TdHIocG9zaXRpb246IHsgbGluZTogbnVtYmVyOyBjaGFyYWN0ZXI6IG51bWJlciB9KTogc3RyaW5nIHtcblx0XHRyZXR1cm4gJygnICsgcG9zaXRpb24ubGluZSArICcsJyArIHBvc2l0aW9uLmNoYXJhY3RlciArICcpJztcblx0fVxuXG5cdGZ1bmN0aW9uIGFzc2VydERvY3VtZW50TGluZU1hcHBpbmcoZG9jOiBFeHRIb3N0RG9jdW1lbnREYXRhLCBkaXJlY3Rpb246IEFzc2VydERvY3VtZW50TGluZU1hcHBpbmdEaXJlY3Rpb24pOiB2b2lkIHtcblx0XHRjb25zdCBhbGxUZXh0ID0gZG9jLmdldFRleHQoKTtcblxuXHRcdGxldCBsaW5lID0gMCwgY2hhcmFjdGVyID0gMCwgcHJldmlvdXNJc0NhcnJpYWdlUmV0dXJuID0gZmFsc2U7XG5cdFx0Zm9yIChsZXQgb2Zmc2V0ID0gMDsgb2Zmc2V0IDw9IGFsbFRleHQubGVuZ3RoOyBvZmZzZXQrKykge1xuXHRcdFx0Ly8gVGhlIHBvc2l0aW9uIGNvb3JkaW5hdGUgc3lzdGVtIGNhbm5vdCBleHByZXNzIHRoZSBwb3NpdGlvbiBiZXR3ZWVuIFxcciBhbmQgXFxuXG5cdFx0XHRjb25zdCBwb3NpdGlvbjogUG9zaXRpb24gPSBuZXcgUG9zaXRpb24obGluZSwgY2hhcmFjdGVyICsgKHByZXZpb3VzSXNDYXJyaWFnZVJldHVybiA/IC0xIDogMCkpO1xuXG5cdFx0XHRpZiAoZGlyZWN0aW9uID09PSBBc3NlcnREb2N1bWVudExpbmVNYXBwaW5nRGlyZWN0aW9uLk9mZnNldFRvUG9zaXRpb24pIHtcblx0XHRcdFx0Y29uc3QgYWN0dWFsUG9zaXRpb24gPSBkb2MuZG9jdW1lbnQucG9zaXRpb25BdChvZmZzZXQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocG9zaXRpb25Ub1N0cihhY3R1YWxQb3NpdGlvbiksIHBvc2l0aW9uVG9TdHIocG9zaXRpb24pLCAncG9zaXRpb25BdCBtaXNtYXRjaCBmb3Igb2Zmc2V0ICcgKyBvZmZzZXQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gVGhlIHBvc2l0aW9uIGNvb3JkaW5hdGUgc3lzdGVtIGNhbm5vdCBleHByZXNzIHRoZSBwb3NpdGlvbiBiZXR3ZWVuIFxcciBhbmQgXFxuXG5cdFx0XHRcdGNvbnN0IGV4cGVjdGVkT2Zmc2V0OiBudW1iZXIgPSBvZmZzZXQgKyAocHJldmlvdXNJc0NhcnJpYWdlUmV0dXJuID8gLTEgOiAwKTtcblx0XHRcdFx0Y29uc3QgYWN0dWFsT2Zmc2V0ID0gZG9jLmRvY3VtZW50Lm9mZnNldEF0KHBvc2l0aW9uKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbE9mZnNldCwgZXhwZWN0ZWRPZmZzZXQsICdvZmZzZXRBdCBtaXNtYXRjaCBmb3IgcG9zaXRpb24gJyArIHBvc2l0aW9uVG9TdHIocG9zaXRpb24pKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGFsbFRleHQuY2hhckF0KG9mZnNldCkgPT09ICdcXG4nKSB7XG5cdFx0XHRcdGxpbmUrKztcblx0XHRcdFx0Y2hhcmFjdGVyID0gMDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNoYXJhY3RlcisrO1xuXHRcdFx0fVxuXG5cdFx0XHRwcmV2aW91c0lzQ2FycmlhZ2VSZXR1cm4gPSAoYWxsVGV4dC5jaGFyQXQob2Zmc2V0KSA9PT0gJ1xccicpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGNyZWF0ZUNoYW5nZUV2ZW50KHJhbmdlOiBSYW5nZSwgdGV4dDogc3RyaW5nLCBlb2w/OiBzdHJpbmcpOiBJTW9kZWxDaGFuZ2VkRXZlbnQge1xuXHRcdHJldHVybiB7XG5cdFx0XHRjaGFuZ2VzOiBbe1xuXHRcdFx0XHRyYW5nZTogcmFuZ2UsXG5cdFx0XHRcdHJhbmdlT2Zmc2V0OiB1bmRlZmluZWQhLFxuXHRcdFx0XHRyYW5nZUxlbmd0aDogdW5kZWZpbmVkISxcblx0XHRcdFx0dGV4dDogdGV4dFxuXHRcdFx0fV0sXG5cdFx0XHRlb2w6IGVvbCEsXG5cdFx0XHR2ZXJzaW9uSWQ6IHVuZGVmaW5lZCEsXG5cdFx0XHRpc1JlZG9pbmc6IGZhbHNlLFxuXHRcdFx0aXNVbmRvaW5nOiBmYWxzZSxcblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gdGVzdExpbmVNYXBwaW5nRGlyZWN0aW9uQWZ0ZXJFdmVudHMobGluZXM6IHN0cmluZ1tdLCBlb2w6IHN0cmluZywgZGlyZWN0aW9uOiBBc3NlcnREb2N1bWVudExpbmVNYXBwaW5nRGlyZWN0aW9uLCBlOiBJTW9kZWxDaGFuZ2VkRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBteURvY3VtZW50ID0gbmV3IEV4dEhvc3REb2N1bWVudERhdGEodW5kZWZpbmVkISwgVVJJLmZpbGUoJycpLCBsaW5lcy5zbGljZSgwKSwgZW9sLCAxLCAndGV4dCcsIGZhbHNlLCAndXRmOCcpO1xuXHRcdGFzc2VydERvY3VtZW50TGluZU1hcHBpbmcobXlEb2N1bWVudCwgZGlyZWN0aW9uKTtcblxuXHRcdG15RG9jdW1lbnQub25FdmVudHMoZSk7XG5cdFx0YXNzZXJ0RG9jdW1lbnRMaW5lTWFwcGluZyhteURvY3VtZW50LCBkaXJlY3Rpb24pO1xuXHR9XG5cblx0ZnVuY3Rpb24gdGVzdExpbmVNYXBwaW5nQWZ0ZXJFdmVudHMobGluZXM6IHN0cmluZ1tdLCBlOiBJTW9kZWxDaGFuZ2VkRXZlbnQpOiB2b2lkIHtcblx0XHR0ZXN0TGluZU1hcHBpbmdEaXJlY3Rpb25BZnRlckV2ZW50cyhsaW5lcywgJ1xcbicsIEFzc2VydERvY3VtZW50TGluZU1hcHBpbmdEaXJlY3Rpb24uUG9zaXRpb25Ub09mZnNldCwgZSk7XG5cdFx0dGVzdExpbmVNYXBwaW5nRGlyZWN0aW9uQWZ0ZXJFdmVudHMobGluZXMsICdcXG4nLCBBc3NlcnREb2N1bWVudExpbmVNYXBwaW5nRGlyZWN0aW9uLk9mZnNldFRvUG9zaXRpb24sIGUpO1xuXG5cdFx0dGVzdExpbmVNYXBwaW5nRGlyZWN0aW9uQWZ0ZXJFdmVudHMobGluZXMsICdcXHJcXG4nLCBBc3NlcnREb2N1bWVudExpbmVNYXBwaW5nRGlyZWN0aW9uLlBvc2l0aW9uVG9PZmZzZXQsIGUpO1xuXHRcdHRlc3RMaW5lTWFwcGluZ0RpcmVjdGlvbkFmdGVyRXZlbnRzKGxpbmVzLCAnXFxyXFxuJywgQXNzZXJ0RG9jdW1lbnRMaW5lTWFwcGluZ0RpcmVjdGlvbi5PZmZzZXRUb1Bvc2l0aW9uLCBlKTtcblx0fVxuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2xpbmUgbWFwcGluZycsICgpID0+IHtcblx0XHR0ZXN0TGluZU1hcHBpbmdBZnRlckV2ZW50cyhbXG5cdFx0XHQnVGhpcyBpcyBsaW5lIG9uZScsXG5cdFx0XHQnYW5kIHRoaXMgaXMgbGluZSBudW1iZXIgdHdvJyxcblx0XHRcdCdpdCBpcyBmb2xsb3dlZCBieSAjMycsXG5cdFx0XHQnYW5kIGZpbmlzaGVkIHdpdGggdGhlIGZvdXJ0aC4nLFxuXHRcdF0sIHsgY2hhbmdlczogW10sIGVvbDogdW5kZWZpbmVkISwgdmVyc2lvbklkOiA3LCBpc1JlZG9pbmc6IGZhbHNlLCBpc1VuZG9pbmc6IGZhbHNlIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhZnRlciByZW1vdmUnLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVNYXBwaW5nQWZ0ZXJFdmVudHMoW1xuXHRcdFx0J1RoaXMgaXMgbGluZSBvbmUnLFxuXHRcdFx0J2FuZCB0aGlzIGlzIGxpbmUgbnVtYmVyIHR3bycsXG5cdFx0XHQnaXQgaXMgZm9sbG93ZWQgYnkgIzMnLFxuXHRcdFx0J2FuZCBmaW5pc2hlZCB3aXRoIHRoZSBmb3VydGguJyxcblx0XHRdLCBjcmVhdGVDaGFuZ2VFdmVudChuZXcgUmFuZ2UoMSwgMywgMSwgNiksICcnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FmdGVyIHJlcGxhY2UnLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVNYXBwaW5nQWZ0ZXJFdmVudHMoW1xuXHRcdFx0J1RoaXMgaXMgbGluZSBvbmUnLFxuXHRcdFx0J2FuZCB0aGlzIGlzIGxpbmUgbnVtYmVyIHR3bycsXG5cdFx0XHQnaXQgaXMgZm9sbG93ZWQgYnkgIzMnLFxuXHRcdFx0J2FuZCBmaW5pc2hlZCB3aXRoIHRoZSBmb3VydGguJyxcblx0XHRdLCBjcmVhdGVDaGFuZ2VFdmVudChuZXcgUmFuZ2UoMSwgMywgMSwgNiksICdpcyBjb3VsZCBiZScpKTtcblx0fSk7XG5cblx0dGVzdCgnYWZ0ZXIgaW5zZXJ0IGxpbmUnLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVNYXBwaW5nQWZ0ZXJFdmVudHMoW1xuXHRcdFx0J1RoaXMgaXMgbGluZSBvbmUnLFxuXHRcdFx0J2FuZCB0aGlzIGlzIGxpbmUgbnVtYmVyIHR3bycsXG5cdFx0XHQnaXQgaXMgZm9sbG93ZWQgYnkgIzMnLFxuXHRcdFx0J2FuZCBmaW5pc2hlZCB3aXRoIHRoZSBmb3VydGguJyxcblx0XHRdLCBjcmVhdGVDaGFuZ2VFdmVudChuZXcgUmFuZ2UoMSwgMywgMSwgNiksICdpcyBjb3VsZCBiZVxcbmEgbGluZSB3aXRoIG51bWJlcicpKTtcblx0fSk7XG5cblx0dGVzdCgnYWZ0ZXIgaW5zZXJ0IHR3byBsaW5lcycsICgpID0+IHtcblx0XHR0ZXN0TGluZU1hcHBpbmdBZnRlckV2ZW50cyhbXG5cdFx0XHQnVGhpcyBpcyBsaW5lIG9uZScsXG5cdFx0XHQnYW5kIHRoaXMgaXMgbGluZSBudW1iZXIgdHdvJyxcblx0XHRcdCdpdCBpcyBmb2xsb3dlZCBieSAjMycsXG5cdFx0XHQnYW5kIGZpbmlzaGVkIHdpdGggdGhlIGZvdXJ0aC4nLFxuXHRcdF0sIGNyZWF0ZUNoYW5nZUV2ZW50KG5ldyBSYW5nZSgxLCAzLCAxLCA2KSwgJ2lzIGNvdWxkIGJlXFxuYSBsaW5lIHdpdGggbnVtYmVyXFxueWV0IGFub3RoZXIgbGluZScpKTtcblx0fSk7XG5cblx0dGVzdCgnYWZ0ZXIgcmVtb3ZlIGxpbmUnLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVNYXBwaW5nQWZ0ZXJFdmVudHMoW1xuXHRcdFx0J1RoaXMgaXMgbGluZSBvbmUnLFxuXHRcdFx0J2FuZCB0aGlzIGlzIGxpbmUgbnVtYmVyIHR3bycsXG5cdFx0XHQnaXQgaXMgZm9sbG93ZWQgYnkgIzMnLFxuXHRcdFx0J2FuZCBmaW5pc2hlZCB3aXRoIHRoZSBmb3VydGguJyxcblx0XHRdLCBjcmVhdGVDaGFuZ2VFdmVudChuZXcgUmFuZ2UoMSwgMywgMiwgNiksICcnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FmdGVyIHJlbW92ZSB0d28gbGluZXMnLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVNYXBwaW5nQWZ0ZXJFdmVudHMoW1xuXHRcdFx0J1RoaXMgaXMgbGluZSBvbmUnLFxuXHRcdFx0J2FuZCB0aGlzIGlzIGxpbmUgbnVtYmVyIHR3bycsXG5cdFx0XHQnaXQgaXMgZm9sbG93ZWQgYnkgIzMnLFxuXHRcdFx0J2FuZCBmaW5pc2hlZCB3aXRoIHRoZSBmb3VydGguJyxcblx0XHRdLCBjcmVhdGVDaGFuZ2VFdmVudChuZXcgUmFuZ2UoMSwgMywgMywgNiksICcnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FmdGVyIGRlbGV0aW5nIGVudGlyZSBjb250ZW50JywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lTWFwcGluZ0FmdGVyRXZlbnRzKFtcblx0XHRcdCdUaGlzIGlzIGxpbmUgb25lJyxcblx0XHRcdCdhbmQgdGhpcyBpcyBsaW5lIG51bWJlciB0d28nLFxuXHRcdFx0J2l0IGlzIGZvbGxvd2VkIGJ5ICMzJyxcblx0XHRcdCdhbmQgZmluaXNoZWQgd2l0aCB0aGUgZm91cnRoLicsXG5cdFx0XSwgY3JlYXRlQ2hhbmdlRXZlbnQobmV3IFJhbmdlKDEsIDMsIDQsIDMwKSwgJycpKTtcblx0fSk7XG5cblx0dGVzdCgnYWZ0ZXIgcmVwbGFjaW5nIGVudGlyZSBjb250ZW50JywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lTWFwcGluZ0FmdGVyRXZlbnRzKFtcblx0XHRcdCdUaGlzIGlzIGxpbmUgb25lJyxcblx0XHRcdCdhbmQgdGhpcyBpcyBsaW5lIG51bWJlciB0d28nLFxuXHRcdFx0J2l0IGlzIGZvbGxvd2VkIGJ5ICMzJyxcblx0XHRcdCdhbmQgZmluaXNoZWQgd2l0aCB0aGUgZm91cnRoLicsXG5cdFx0XSwgY3JlYXRlQ2hhbmdlRXZlbnQobmV3IFJhbmdlKDEsIDMsIDQsIDMwKSwgJ3NvbWUgbmV3IHRleHRcXG50aGF0XFxuc3BhbnMgbXVsdGlwbGUgbGluZXMnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FmdGVyIGNoYW5naW5nIEVPTCB0byBDUkxGJywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lTWFwcGluZ0FmdGVyRXZlbnRzKFtcblx0XHRcdCdUaGlzIGlzIGxpbmUgb25lJyxcblx0XHRcdCdhbmQgdGhpcyBpcyBsaW5lIG51bWJlciB0d28nLFxuXHRcdFx0J2l0IGlzIGZvbGxvd2VkIGJ5ICMzJyxcblx0XHRcdCdhbmQgZmluaXNoZWQgd2l0aCB0aGUgZm91cnRoLicsXG5cdFx0XSwgY3JlYXRlQ2hhbmdlRXZlbnQobmV3IFJhbmdlKDEsIDEsIDEsIDEpLCAnJywgJ1xcclxcbicpKTtcblx0fSk7XG5cblx0dGVzdCgnYWZ0ZXIgY2hhbmdpbmcgRU9MIHRvIExGJywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lTWFwcGluZ0FmdGVyRXZlbnRzKFtcblx0XHRcdCdUaGlzIGlzIGxpbmUgb25lJyxcblx0XHRcdCdhbmQgdGhpcyBpcyBsaW5lIG51bWJlciB0d28nLFxuXHRcdFx0J2l0IGlzIGZvbGxvd2VkIGJ5ICMzJyxcblx0XHRcdCdhbmQgZmluaXNoZWQgd2l0aCB0aGUgZm91cnRoLicsXG5cdFx0XSwgY3JlYXRlQ2hhbmdlRXZlbnQobmV3IFJhbmdlKDEsIDEsIDEsIDEpLCAnJywgJ1xcbicpKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFdBQVc7QUFDcEIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBR3RCLFNBQVMsWUFBWTtBQUNyQixZQUFZLGNBQWM7QUFDMUIsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUywrQ0FBK0M7QUFFeEQsTUFBTSx1QkFBdUIsTUFBTTtBQUVsQyxNQUFJO0FBRUosV0FBUyxpQkFBaUIsUUFBZ0IsTUFBYyxXQUFtQjtBQUMxRSxVQUFNLFdBQVcsS0FBSyxTQUFTLFdBQVcsTUFBTTtBQUNoRCxXQUFPLFlBQVksU0FBUyxNQUFNLElBQUk7QUFDdEMsV0FBTyxZQUFZLFNBQVMsV0FBVyxTQUFTO0FBQUEsRUFDakQ7QUFFQSxXQUFTLGVBQWUsTUFBYyxXQUFtQixRQUFnQjtBQUN4RSxVQUFNLE1BQU0sSUFBSSxTQUFTLE1BQU0sU0FBUztBQUN4QyxVQUFNLFNBQVMsS0FBSyxTQUFTLFNBQVMsR0FBRztBQUN6QyxX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QTtBQUFBLE1BQ0E7QUFBQSxJQUNELEdBQUcsa0JBQWtCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsbURBQW1ELENBQUM7QUFBQSxFQUNqRyxDQUFDO0FBRUQsT0FBSyxxQkFBcUIsTUFBTTtBQUMvQiwrQkFBMkI7QUFBQSxNQUMxQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxrQkFBa0IsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFBQSxFQUNoRCxDQUFDO0FBRUQsT0FBSywwQkFBMEIsTUFBTTtBQUNwQywrQkFBMkI7QUFBQSxNQUMxQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxrQkFBa0IsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFBQSxFQUNoRCxDQUFDO0FBRUQsT0FBSyxpQ0FBaUMsTUFBTTtBQUMzQywrQkFBMkI7QUFBQSxNQUMxQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxrQkFBa0IsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUM7QUFBQSxFQUNqRCxDQUFDO0FBRUQsT0FBSyxrQ0FBa0MsTUFBTTtBQUM1QywrQkFBMkI7QUFBQSxNQUMxQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxrQkFBa0IsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRywyQ0FBMkMsQ0FBQztBQUFBLEVBQzFGLENBQUM7QUFFRCxPQUFLLDhCQUE4QixNQUFNO0FBQ3hDLCtCQUEyQjtBQUFBLE1BQzFCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxHQUFHLGtCQUFrQixJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxDQUFDO0FBQUEsRUFDeEQsQ0FBQztBQUVELE9BQUssNEJBQTRCLE1BQU07QUFDdEMsK0JBQTJCO0FBQUEsTUFDMUI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEdBQUcsa0JBQWtCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUM7QUFBQSxFQUN0RCxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsiZGF0YSIsICJBc3NlcnREb2N1bWVudExpbmVNYXBwaW5nRGlyZWN0aW9uIl0KfQo=
