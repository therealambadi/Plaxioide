import * as assert from "assert";
import { findSectionHeaders } from "../../../common/services/findSectionHeaders.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
class TestSectionHeaderFinderTarget {
  constructor(lines) {
    this.lines = lines;
  }
  getLineCount() {
    return this.lines.length;
  }
  getLineContent(lineNumber) {
    return this.lines[lineNumber - 1];
  }
}
suite("FindSectionHeaders", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("finds simple section headers", () => {
    const model = new TestSectionHeaderFinderTarget([
      "regular line",
      "MARK: My Section",
      "another line",
      "MARK: Another Section",
      "last line"
    ]);
    const options = {
      findRegionSectionHeaders: false,
      findMarkSectionHeaders: true,
      markSectionHeaderRegex: "MARK:\\s*(?<label>.*)$"
    };
    const headers = findSectionHeaders(model, options);
    assert.strictEqual(headers.length, 2);
    assert.strictEqual(headers[0].text, "My Section");
    assert.strictEqual(headers[0].range.startLineNumber, 2);
    assert.strictEqual(headers[0].range.endLineNumber, 2);
    assert.strictEqual(headers[1].text, "Another Section");
    assert.strictEqual(headers[1].range.startLineNumber, 4);
    assert.strictEqual(headers[1].range.endLineNumber, 4);
  });
  test("finds section headers with separators", () => {
    const model = new TestSectionHeaderFinderTarget([
      "regular line",
      "MARK: -My Section",
      "another line",
      "MARK: - Another Section",
      "last line"
    ]);
    const options = {
      findRegionSectionHeaders: false,
      findMarkSectionHeaders: true,
      markSectionHeaderRegex: "MARK:\\s*(?<separator>-?)\\s*(?<label>.*)$"
    };
    const headers = findSectionHeaders(model, options);
    assert.strictEqual(headers.length, 2);
    assert.strictEqual(headers[0].text, "My Section");
    assert.strictEqual(headers[0].hasSeparatorLine, true);
    assert.strictEqual(headers[1].text, "Another Section");
    assert.strictEqual(headers[1].hasSeparatorLine, true);
  });
  test("finds multi-line section headers with separators", () => {
    const model = new TestSectionHeaderFinderTarget([
      "regular line",
      "// ==========",
      "// My Section",
      "// ==========",
      "code...",
      "// ==========",
      "// Another Section",
      "// ==========",
      "more code..."
    ]);
    const options = {
      findRegionSectionHeaders: false,
      findMarkSectionHeaders: true,
      markSectionHeaderRegex: "^// =+\\n^// (?<label>[^\\n]+?)\\n^// =+$"
    };
    const headers = findSectionHeaders(model, options);
    assert.strictEqual(headers.length, 2);
    assert.strictEqual(headers[0].text, "My Section");
    assert.strictEqual(headers[0].range.startLineNumber, 2);
    assert.strictEqual(headers[0].range.endLineNumber, 4);
    assert.strictEqual(headers[1].text, "Another Section");
    assert.strictEqual(headers[1].range.startLineNumber, 6);
    assert.strictEqual(headers[1].range.endLineNumber, 8);
  });
  test("handles overlapping multi-line section headers correctly", () => {
    const model = new TestSectionHeaderFinderTarget([
      "// ==========",
      "// Section 1",
      "// ==========",
      "// ==========",
      // This line starts another header
      "// Section 2",
      "// =========="
    ]);
    const options = {
      findRegionSectionHeaders: false,
      findMarkSectionHeaders: true,
      markSectionHeaderRegex: "^// =+\\n^// (?<label>[^\\n]+?)\\n^// =+$"
    };
    const headers = findSectionHeaders(model, options);
    assert.strictEqual(headers.length, 2);
    assert.strictEqual(headers[0].text, "Section 1");
    assert.strictEqual(headers[0].range.startLineNumber, 1);
    assert.strictEqual(headers[0].range.endLineNumber, 3);
    assert.strictEqual(headers[1].text, "Section 2");
    assert.strictEqual(headers[1].range.startLineNumber, 4);
    assert.strictEqual(headers[1].range.endLineNumber, 6);
  });
  test("section headers must be in comments when specified", () => {
    const model = new TestSectionHeaderFinderTarget([
      "// ==========",
      "// Section 1",
      // This one is in a comment
      "// ==========",
      "==========",
      // This one isn't
      "Section 2",
      "=========="
    ]);
    const options = {
      findRegionSectionHeaders: false,
      findMarkSectionHeaders: true,
      markSectionHeaderRegex: "^(?:// )?=+\\n^(?:// )?(?<label>[^\\n]+?)\\n^(?:// )?=+$"
    };
    const headers = findSectionHeaders(model, options);
    assert.strictEqual(headers[0].shouldBeInComments, true);
  });
  test("handles section headers at chunk boundaries", () => {
    const lines = [];
    for (let i = 0; i < 150; i++) {
      lines.push("line " + i);
    }
    lines[97] = "// ==========";
    lines[98] = "// Section 1";
    lines[99] = "// ==========";
    lines[100] = "// ==========";
    lines[101] = "// Section 2";
    lines[102] = "// ==========";
    const model = new TestSectionHeaderFinderTarget(lines);
    const options = {
      findRegionSectionHeaders: false,
      findMarkSectionHeaders: true,
      markSectionHeaderRegex: "^// =+\\n^// (?<label>[^\\n]+?)\\n^// =+$"
    };
    const headers = findSectionHeaders(model, options);
    assert.strictEqual(headers.length, 2);
    assert.strictEqual(headers[0].text, "Section 1");
    assert.strictEqual(headers[0].range.startLineNumber, 98);
    assert.strictEqual(headers[0].range.endLineNumber, 100);
    assert.strictEqual(headers[1].text, "Section 2");
    assert.strictEqual(headers[1].range.startLineNumber, 101);
    assert.strictEqual(headers[1].range.endLineNumber, 103);
  });
  test("correctly advances past matches without infinite loop", () => {
    const model = new TestSectionHeaderFinderTarget([
      "// ==========",
      "// Section 1",
      "// ==========",
      "some code",
      "// ==========",
      "// Section 2",
      "// ==========",
      "more code",
      "// ==========",
      "// Section 3",
      "// =========="
    ]);
    const options = {
      findRegionSectionHeaders: false,
      findMarkSectionHeaders: true,
      markSectionHeaderRegex: "^// =+\\n^// (?<label>[^\\n]+?)\\n^// =+$"
    };
    const headers = findSectionHeaders(model, options);
    assert.strictEqual(headers.length, 3, "Should find all three section headers");
    assert.strictEqual(headers[0].text, "Section 1");
    assert.strictEqual(headers[1].text, "Section 2");
    assert.strictEqual(headers[2].text, "Section 3");
  });
  test("handles consecutive section headers correctly", () => {
    const model = new TestSectionHeaderFinderTarget([
      "// ==========",
      "// Section 1",
      "// ==========",
      "// ==========",
      // This line is both the end of Section 1 and start of Section 2
      "// Section 2",
      "// =========="
    ]);
    const options = {
      findRegionSectionHeaders: false,
      findMarkSectionHeaders: true,
      markSectionHeaderRegex: "^// =+\\n^// (?<label>[^\\n]+?)\\n^// =+$"
    };
    const headers = findSectionHeaders(model, options);
    assert.strictEqual(headers.length, 2, "Should find both section headers");
    assert.strictEqual(headers[0].text, "Section 1");
    assert.strictEqual(headers[1].text, "Section 2");
  });
  test("handles nested separators correctly", () => {
    const model = new TestSectionHeaderFinderTarget([
      "// ==============",
      "// Major Section",
      "// ==============",
      "",
      "// ----------",
      "// Subsection",
      "// ----------"
    ]);
    const options = {
      findRegionSectionHeaders: false,
      findMarkSectionHeaders: true,
      markSectionHeaderRegex: "^// [-=]+\\n^// (?<label>[^\\n]+?)\\n^// [-=]+$"
    };
    const headers = findSectionHeaders(model, options);
    assert.strictEqual(headers.length, 2, "Should find both section headers");
    assert.strictEqual(headers[0].text, "Major Section");
    assert.strictEqual(headers[1].text, "Subsection");
  });
  test("handles section headers at chunk boundaries correctly", () => {
    const lines = [];
    for (let i = 0; i < 97; i++) {
      lines.push(`line ${i}`);
    }
    lines.push("// ==========");
    lines.push("// Section 1");
    lines.push("// ==========");
    lines.push("// ==========");
    lines.push("// Section 2");
    lines.push("// ==========");
    for (let i = 103; i < 150; i++) {
      lines.push(`line ${i}`);
    }
    const model = new TestSectionHeaderFinderTarget(lines);
    const options = {
      findRegionSectionHeaders: false,
      findMarkSectionHeaders: true,
      markSectionHeaderRegex: "^// =+\\n^// (?<label>[^\\n]+?)\\n^// =+$"
    };
    const headers = findSectionHeaders(model, options);
    assert.strictEqual(headers.length, 2, "Should find both section headers across chunk boundary");
    assert.strictEqual(headers[0].text, "Section 1");
    assert.strictEqual(headers[0].range.startLineNumber, 98);
    assert.strictEqual(headers[0].range.endLineNumber, 100);
    assert.strictEqual(headers[1].text, "Section 2");
    assert.strictEqual(headers[1].range.startLineNumber, 101);
    assert.strictEqual(headers[1].range.endLineNumber, 103);
  });
  test("handles overlapping section headers without duplicates", () => {
    const model = new TestSectionHeaderFinderTarget([
      "// ==========",
      // Line 1
      "// Section 1",
      // Line 2 - This is part of first header
      "// ==========",
      // Line 3 - This is the end of first
      "// Section 2",
      // Line 4 - This is not a header
      "// ==========",
      // Line 5
      "// ==========",
      // Line 6 - Start of second header
      "// Section 3",
      // Line 7
      "// ==========="
      // Line 8
    ]);
    const options = {
      findRegionSectionHeaders: false,
      findMarkSectionHeaders: true,
      markSectionHeaderRegex: "^// =+\\n^// (?<label>[^\\n]+?)\\n^// =+$"
    };
    const headers = findSectionHeaders(model, options);
    assert.strictEqual(headers.length, 2);
    assert.strictEqual(headers[0].text, "Section 1");
    assert.strictEqual(headers[0].range.startLineNumber, 1);
    assert.strictEqual(headers[0].range.endLineNumber, 3);
    assert.strictEqual(headers[1].text, "Section 3");
    assert.strictEqual(headers[1].range.startLineNumber, 6);
    assert.strictEqual(headers[1].range.endLineNumber, 8);
  });
  test("handles partially overlapping multiline section headers correctly", () => {
    const model = new TestSectionHeaderFinderTarget([
      "// ================",
      // Line 1
      "// Major Section 1",
      // Line 2
      "// ================",
      // Line 3
      "// --------",
      // Line 4 - Start of subsection that overlaps with end of major section
      "// Subsection 1.1",
      // Line 5
      "// --------",
      // Line 6
      "// ================",
      // Line 7
      "// Major Section 2",
      // Line 8
      "// ================"
      // Line 9
    ]);
    const options = {
      findRegionSectionHeaders: false,
      findMarkSectionHeaders: true,
      markSectionHeaderRegex: "^// [-=]+\\n^// (?<label>[^\\n]+?)\\n^// [-=]+$"
    };
    const headers = findSectionHeaders(model, options);
    assert.strictEqual(headers.length, 3);
    assert.strictEqual(headers[0].text, "Major Section 1");
    assert.strictEqual(headers[0].range.startLineNumber, 1);
    assert.strictEqual(headers[0].range.endLineNumber, 3);
    assert.strictEqual(headers[1].text, "Subsection 1.1");
    assert.strictEqual(headers[1].range.startLineNumber, 4);
    assert.strictEqual(headers[1].range.endLineNumber, 6);
    assert.strictEqual(headers[2].text, "Major Section 2");
    assert.strictEqual(headers[2].range.startLineNumber, 7);
    assert.strictEqual(headers[2].range.endLineNumber, 9);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vc2VydmljZXMvZmluZFNlY3Rpb25IZWFkZXJzLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IEZpbmRTZWN0aW9uSGVhZGVyT3B0aW9ucywgSVNlY3Rpb25IZWFkZXJGaW5kZXJUYXJnZXQsIGZpbmRTZWN0aW9uSGVhZGVycyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9maW5kU2VjdGlvbkhlYWRlcnMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbmNsYXNzIFRlc3RTZWN0aW9uSGVhZGVyRmluZGVyVGFyZ2V0IGltcGxlbWVudHMgSVNlY3Rpb25IZWFkZXJGaW5kZXJUYXJnZXQge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGxpbmVzOiBzdHJpbmdbXSkgeyB9XG5cblx0Z2V0TGluZUNvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMubGluZXMubGVuZ3RoO1xuXHR9XG5cblx0Z2V0TGluZUNvbnRlbnQobGluZU51bWJlcjogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5saW5lc1tsaW5lTnVtYmVyIC0gMV07XG5cdH1cbn1cblxuc3VpdGUoJ0ZpbmRTZWN0aW9uSGVhZGVycycsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdmaW5kcyBzaW1wbGUgc2VjdGlvbiBoZWFkZXJzJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gbmV3IFRlc3RTZWN0aW9uSGVhZGVyRmluZGVyVGFyZ2V0KFtcblx0XHRcdCdyZWd1bGFyIGxpbmUnLFxuXHRcdFx0J01BUks6IE15IFNlY3Rpb24nLFxuXHRcdFx0J2Fub3RoZXIgbGluZScsXG5cdFx0XHQnTUFSSzogQW5vdGhlciBTZWN0aW9uJyxcblx0XHRcdCdsYXN0IGxpbmUnXG5cdFx0XSk7XG5cblx0XHRjb25zdCBvcHRpb25zOiBGaW5kU2VjdGlvbkhlYWRlck9wdGlvbnMgPSB7XG5cdFx0XHRmaW5kUmVnaW9uU2VjdGlvbkhlYWRlcnM6IGZhbHNlLFxuXHRcdFx0ZmluZE1hcmtTZWN0aW9uSGVhZGVyczogdHJ1ZSxcblx0XHRcdG1hcmtTZWN0aW9uSGVhZGVyUmVnZXg6ICdNQVJLOlxcXFxzKig/PGxhYmVsPi4qKSQnXG5cdFx0fTtcblxuXHRcdGNvbnN0IGhlYWRlcnMgPSBmaW5kU2VjdGlvbkhlYWRlcnMobW9kZWwsIG9wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzLmxlbmd0aCwgMik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1swXS50ZXh0LCAnTXkgU2VjdGlvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzBdLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMF0ucmFuZ2UuZW5kTGluZU51bWJlciwgMik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1sxXS50ZXh0LCAnQW5vdGhlciBTZWN0aW9uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMV0ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1sxXS5yYW5nZS5lbmRMaW5lTnVtYmVyLCA0KTtcblx0fSk7XG5cblx0dGVzdCgnZmluZHMgc2VjdGlvbiBoZWFkZXJzIHdpdGggc2VwYXJhdG9ycycsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IG5ldyBUZXN0U2VjdGlvbkhlYWRlckZpbmRlclRhcmdldChbXG5cdFx0XHQncmVndWxhciBsaW5lJyxcblx0XHRcdCdNQVJLOiAtTXkgU2VjdGlvbicsXG5cdFx0XHQnYW5vdGhlciBsaW5lJyxcblx0XHRcdCdNQVJLOiAtIEFub3RoZXIgU2VjdGlvbicsXG5cdFx0XHQnbGFzdCBsaW5lJ1xuXHRcdF0pO1xuXG5cdFx0Y29uc3Qgb3B0aW9uczogRmluZFNlY3Rpb25IZWFkZXJPcHRpb25zID0ge1xuXHRcdFx0ZmluZFJlZ2lvblNlY3Rpb25IZWFkZXJzOiBmYWxzZSxcblx0XHRcdGZpbmRNYXJrU2VjdGlvbkhlYWRlcnM6IHRydWUsXG5cdFx0XHRtYXJrU2VjdGlvbkhlYWRlclJlZ2V4OiAnTUFSSzpcXFxccyooPzxzZXBhcmF0b3I+LT8pXFxcXHMqKD88bGFiZWw+LiopJCdcblx0XHR9O1xuXG5cdFx0Y29uc3QgaGVhZGVycyA9IGZpbmRTZWN0aW9uSGVhZGVycyhtb2RlbCwgb3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnMubGVuZ3RoLCAyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzBdLnRleHQsICdNeSBTZWN0aW9uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMF0uaGFzU2VwYXJhdG9yTGluZSwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1sxXS50ZXh0LCAnQW5vdGhlciBTZWN0aW9uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMV0uaGFzU2VwYXJhdG9yTGluZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbmRzIG11bHRpLWxpbmUgc2VjdGlvbiBoZWFkZXJzIHdpdGggc2VwYXJhdG9ycycsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IG5ldyBUZXN0U2VjdGlvbkhlYWRlckZpbmRlclRhcmdldChbXG5cdFx0XHQncmVndWxhciBsaW5lJyxcblx0XHRcdCcvLyA9PT09PT09PT09Jyxcblx0XHRcdCcvLyBNeSBTZWN0aW9uJyxcblx0XHRcdCcvLyA9PT09PT09PT09Jyxcblx0XHRcdCdjb2RlLi4uJyxcblx0XHRcdCcvLyA9PT09PT09PT09Jyxcblx0XHRcdCcvLyBBbm90aGVyIFNlY3Rpb24nLFxuXHRcdFx0Jy8vID09PT09PT09PT0nLFxuXHRcdFx0J21vcmUgY29kZS4uLidcblx0XHRdKTtcblxuXHRcdGNvbnN0IG9wdGlvbnM6IEZpbmRTZWN0aW9uSGVhZGVyT3B0aW9ucyA9IHtcblx0XHRcdGZpbmRSZWdpb25TZWN0aW9uSGVhZGVyczogZmFsc2UsXG5cdFx0XHRmaW5kTWFya1NlY3Rpb25IZWFkZXJzOiB0cnVlLFxuXHRcdFx0bWFya1NlY3Rpb25IZWFkZXJSZWdleDogJ15cXC9cXC8gPStcXFxcbl5cXC9cXC8gKD88bGFiZWw+W15cXFxcbl0rPylcXFxcbl5cXC9cXC8gPSskJ1xuXHRcdH07XG5cblx0XHRjb25zdCBoZWFkZXJzID0gZmluZFNlY3Rpb25IZWFkZXJzKG1vZGVsLCBvcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVycy5sZW5ndGgsIDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMF0udGV4dCwgJ015IFNlY3Rpb24nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1swXS5yYW5nZS5zdGFydExpbmVOdW1iZXIsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzBdLnJhbmdlLmVuZExpbmVOdW1iZXIsIDQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMV0udGV4dCwgJ0Fub3RoZXIgU2VjdGlvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzFdLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgNik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMV0ucmFuZ2UuZW5kTGluZU51bWJlciwgOCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2hhbmRsZXMgb3ZlcmxhcHBpbmcgbXVsdGktbGluZSBzZWN0aW9uIGhlYWRlcnMgY29ycmVjdGx5JywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gbmV3IFRlc3RTZWN0aW9uSGVhZGVyRmluZGVyVGFyZ2V0KFtcblx0XHRcdCcvLyA9PT09PT09PT09Jyxcblx0XHRcdCcvLyBTZWN0aW9uIDEnLFxuXHRcdFx0Jy8vID09PT09PT09PT0nLFxuXHRcdFx0Jy8vID09PT09PT09PT0nLCAvLyBUaGlzIGxpbmUgc3RhcnRzIGFub3RoZXIgaGVhZGVyXG5cdFx0XHQnLy8gU2VjdGlvbiAyJyxcblx0XHRcdCcvLyA9PT09PT09PT09Jyxcblx0XHRdKTtcblxuXHRcdGNvbnN0IG9wdGlvbnM6IEZpbmRTZWN0aW9uSGVhZGVyT3B0aW9ucyA9IHtcblx0XHRcdGZpbmRSZWdpb25TZWN0aW9uSGVhZGVyczogZmFsc2UsXG5cdFx0XHRmaW5kTWFya1NlY3Rpb25IZWFkZXJzOiB0cnVlLFxuXHRcdFx0bWFya1NlY3Rpb25IZWFkZXJSZWdleDogJ15cXC9cXC8gPStcXFxcbl5cXC9cXC8gKD88bGFiZWw+W15cXFxcbl0rPylcXFxcbl5cXC9cXC8gPSskJ1xuXHRcdH07XG5cblx0XHRjb25zdCBoZWFkZXJzID0gZmluZFNlY3Rpb25IZWFkZXJzKG1vZGVsLCBvcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVycy5sZW5ndGgsIDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMF0udGV4dCwgJ1NlY3Rpb24gMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzBdLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMF0ucmFuZ2UuZW5kTGluZU51bWJlciwgMyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1sxXS50ZXh0LCAnU2VjdGlvbiAyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMV0ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1sxXS5yYW5nZS5lbmRMaW5lTnVtYmVyLCA2KTtcblx0fSk7XG5cblx0dGVzdCgnc2VjdGlvbiBoZWFkZXJzIG11c3QgYmUgaW4gY29tbWVudHMgd2hlbiBzcGVjaWZpZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgVGVzdFNlY3Rpb25IZWFkZXJGaW5kZXJUYXJnZXQoW1xuXHRcdFx0Jy8vID09PT09PT09PT0nLFxuXHRcdFx0Jy8vIFNlY3Rpb24gMScsICAvLyBUaGlzIG9uZSBpcyBpbiBhIGNvbW1lbnRcblx0XHRcdCcvLyA9PT09PT09PT09Jyxcblx0XHRcdCc9PT09PT09PT09JywgICAgLy8gVGhpcyBvbmUgaXNuJ3Rcblx0XHRcdCdTZWN0aW9uIDInLFxuXHRcdFx0Jz09PT09PT09PT0nXG5cdFx0XSk7XG5cblx0XHRjb25zdCBvcHRpb25zOiBGaW5kU2VjdGlvbkhlYWRlck9wdGlvbnMgPSB7XG5cdFx0XHRmaW5kUmVnaW9uU2VjdGlvbkhlYWRlcnM6IGZhbHNlLFxuXHRcdFx0ZmluZE1hcmtTZWN0aW9uSGVhZGVyczogdHJ1ZSxcblx0XHRcdG1hcmtTZWN0aW9uSGVhZGVyUmVnZXg6ICdeKD86XFwvXFwvICk/PStcXFxcbl4oPzpcXC9cXC8gKT8oPzxsYWJlbD5bXlxcXFxuXSs/KVxcXFxuXig/OlxcL1xcLyApPz0rJCdcblx0XHR9O1xuXG5cdFx0Ly8gQm90aCBwYXR0ZXJucyBtYXRjaCwgYnV0IHRoZSBzZWNvbmQgb25lIHNob3VsZCBiZSBmaWx0ZXJlZCBvdXQgYnkgdGhlIHRva2VuIGNoZWNrXG5cdFx0Y29uc3QgaGVhZGVycyA9IGZpbmRTZWN0aW9uSGVhZGVycyhtb2RlbCwgb3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMF0uc2hvdWxkQmVJbkNvbW1lbnRzLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnaGFuZGxlcyBzZWN0aW9uIGhlYWRlcnMgYXQgY2h1bmsgYm91bmRhcmllcycsICgpID0+IHtcblx0XHQvLyBDcmVhdGUgZW5vdWdoIGxpbmVzIHRvIGVuc3VyZSB3ZSBjcm9zcyBjaHVuayBib3VuZGFyaWVzXG5cdFx0Y29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxNTA7IGkrKykge1xuXHRcdFx0bGluZXMucHVzaCgnbGluZSAnICsgaSk7XG5cdFx0fVxuXG5cdFx0Ly8gQWRkIGhlYWRlcnMgbmVhciB0aGUgY2h1bmsgYm91bmRhcnkgKGNodW5rIHNpemUgaXMgMTAwKVxuXHRcdGxpbmVzWzk3XSA9ICcvLyA9PT09PT09PT09Jztcblx0XHRsaW5lc1s5OF0gPSAnLy8gU2VjdGlvbiAxJztcblx0XHRsaW5lc1s5OV0gPSAnLy8gPT09PT09PT09PSc7XG5cdFx0bGluZXNbMTAwXSA9ICcvLyA9PT09PT09PT09Jztcblx0XHRsaW5lc1sxMDFdID0gJy8vIFNlY3Rpb24gMic7XG5cdFx0bGluZXNbMTAyXSA9ICcvLyA9PT09PT09PT09JztcblxuXHRcdGNvbnN0IG1vZGVsID0gbmV3IFRlc3RTZWN0aW9uSGVhZGVyRmluZGVyVGFyZ2V0KGxpbmVzKTtcblxuXHRcdGNvbnN0IG9wdGlvbnM6IEZpbmRTZWN0aW9uSGVhZGVyT3B0aW9ucyA9IHtcblx0XHRcdGZpbmRSZWdpb25TZWN0aW9uSGVhZGVyczogZmFsc2UsXG5cdFx0XHRmaW5kTWFya1NlY3Rpb25IZWFkZXJzOiB0cnVlLFxuXHRcdFx0bWFya1NlY3Rpb25IZWFkZXJSZWdleDogJ15cXC9cXC8gPStcXFxcbl5cXC9cXC8gKD88bGFiZWw+W15cXFxcbl0rPylcXFxcbl5cXC9cXC8gPSskJ1xuXHRcdH07XG5cblx0XHRjb25zdCBoZWFkZXJzID0gZmluZFNlY3Rpb25IZWFkZXJzKG1vZGVsLCBvcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVycy5sZW5ndGgsIDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMF0udGV4dCwgJ1NlY3Rpb24gMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzBdLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgOTgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzBdLnJhbmdlLmVuZExpbmVOdW1iZXIsIDEwMCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1sxXS50ZXh0LCAnU2VjdGlvbiAyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMV0ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAxMDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzFdLnJhbmdlLmVuZExpbmVOdW1iZXIsIDEwMyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvcnJlY3RseSBhZHZhbmNlcyBwYXN0IG1hdGNoZXMgd2l0aG91dCBpbmZpbml0ZSBsb29wJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gbmV3IFRlc3RTZWN0aW9uSGVhZGVyRmluZGVyVGFyZ2V0KFtcblx0XHRcdCcvLyA9PT09PT09PT09Jyxcblx0XHRcdCcvLyBTZWN0aW9uIDEnLFxuXHRcdFx0Jy8vID09PT09PT09PT0nLFxuXHRcdFx0J3NvbWUgY29kZScsXG5cdFx0XHQnLy8gPT09PT09PT09PScsXG5cdFx0XHQnLy8gU2VjdGlvbiAyJyxcblx0XHRcdCcvLyA9PT09PT09PT09Jyxcblx0XHRcdCdtb3JlIGNvZGUnLFxuXHRcdFx0Jy8vID09PT09PT09PT0nLFxuXHRcdFx0Jy8vIFNlY3Rpb24gMycsXG5cdFx0XHQnLy8gPT09PT09PT09PScsXG5cdFx0XSk7XG5cblx0XHRjb25zdCBvcHRpb25zOiBGaW5kU2VjdGlvbkhlYWRlck9wdGlvbnMgPSB7XG5cdFx0XHRmaW5kUmVnaW9uU2VjdGlvbkhlYWRlcnM6IGZhbHNlLFxuXHRcdFx0ZmluZE1hcmtTZWN0aW9uSGVhZGVyczogdHJ1ZSxcblx0XHRcdG1hcmtTZWN0aW9uSGVhZGVyUmVnZXg6ICdeXFwvXFwvID0rXFxcXG5eXFwvXFwvICg/PGxhYmVsPlteXFxcXG5dKz8pXFxcXG5eXFwvXFwvID0rJCdcblx0XHR9O1xuXG5cdFx0Y29uc3QgaGVhZGVycyA9IGZpbmRTZWN0aW9uSGVhZGVycyhtb2RlbCwgb3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnMubGVuZ3RoLCAzLCAnU2hvdWxkIGZpbmQgYWxsIHRocmVlIHNlY3Rpb24gaGVhZGVycycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzBdLnRleHQsICdTZWN0aW9uIDEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1sxXS50ZXh0LCAnU2VjdGlvbiAyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMl0udGV4dCwgJ1NlY3Rpb24gMycpO1xuXHR9KTtcblxuXHR0ZXN0KCdoYW5kbGVzIGNvbnNlY3V0aXZlIHNlY3Rpb24gaGVhZGVycyBjb3JyZWN0bHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgVGVzdFNlY3Rpb25IZWFkZXJGaW5kZXJUYXJnZXQoW1xuXHRcdFx0Jy8vID09PT09PT09PT0nLFxuXHRcdFx0Jy8vIFNlY3Rpb24gMScsXG5cdFx0XHQnLy8gPT09PT09PT09PScsXG5cdFx0XHQnLy8gPT09PT09PT09PScsIC8vIFRoaXMgbGluZSBpcyBib3RoIHRoZSBlbmQgb2YgU2VjdGlvbiAxIGFuZCBzdGFydCBvZiBTZWN0aW9uIDJcblx0XHRcdCcvLyBTZWN0aW9uIDInLFxuXHRcdFx0Jy8vID09PT09PT09PT0nLFxuXHRcdF0pO1xuXG5cdFx0Y29uc3Qgb3B0aW9uczogRmluZFNlY3Rpb25IZWFkZXJPcHRpb25zID0ge1xuXHRcdFx0ZmluZFJlZ2lvblNlY3Rpb25IZWFkZXJzOiBmYWxzZSxcblx0XHRcdGZpbmRNYXJrU2VjdGlvbkhlYWRlcnM6IHRydWUsXG5cdFx0XHRtYXJrU2VjdGlvbkhlYWRlclJlZ2V4OiAnXlxcL1xcLyA9K1xcXFxuXlxcL1xcLyAoPzxsYWJlbD5bXlxcXFxuXSs/KVxcXFxuXlxcL1xcLyA9KyQnXG5cdFx0fTtcblxuXHRcdGNvbnN0IGhlYWRlcnMgPSBmaW5kU2VjdGlvbkhlYWRlcnMobW9kZWwsIG9wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzLmxlbmd0aCwgMiwgJ1Nob3VsZCBmaW5kIGJvdGggc2VjdGlvbiBoZWFkZXJzJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMF0udGV4dCwgJ1NlY3Rpb24gMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzFdLnRleHQsICdTZWN0aW9uIDInKTtcblx0fSk7XG5cblx0dGVzdCgnaGFuZGxlcyBuZXN0ZWQgc2VwYXJhdG9ycyBjb3JyZWN0bHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgVGVzdFNlY3Rpb25IZWFkZXJGaW5kZXJUYXJnZXQoW1xuXHRcdFx0Jy8vID09PT09PT09PT09PT09Jyxcblx0XHRcdCcvLyBNYWpvciBTZWN0aW9uJyxcblx0XHRcdCcvLyA9PT09PT09PT09PT09PScsXG5cdFx0XHQnJyxcblx0XHRcdCcvLyAtLS0tLS0tLS0tJyxcblx0XHRcdCcvLyBTdWJzZWN0aW9uJyxcblx0XHRcdCcvLyAtLS0tLS0tLS0tJyxcblx0XHRdKTtcblxuXHRcdGNvbnN0IG9wdGlvbnM6IEZpbmRTZWN0aW9uSGVhZGVyT3B0aW9ucyA9IHtcblx0XHRcdGZpbmRSZWdpb25TZWN0aW9uSGVhZGVyczogZmFsc2UsXG5cdFx0XHRmaW5kTWFya1NlY3Rpb25IZWFkZXJzOiB0cnVlLFxuXHRcdFx0bWFya1NlY3Rpb25IZWFkZXJSZWdleDogJ15cXC9cXC8gWy09XStcXFxcbl5cXC9cXC8gKD88bGFiZWw+W15cXFxcbl0rPylcXFxcbl5cXC9cXC8gWy09XSskJ1xuXHRcdH07XG5cblx0XHRjb25zdCBoZWFkZXJzID0gZmluZFNlY3Rpb25IZWFkZXJzKG1vZGVsLCBvcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVycy5sZW5ndGgsIDIsICdTaG91bGQgZmluZCBib3RoIHNlY3Rpb24gaGVhZGVycycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzBdLnRleHQsICdNYWpvciBTZWN0aW9uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMV0udGV4dCwgJ1N1YnNlY3Rpb24nKTtcblx0fSk7XG5cblx0dGVzdCgnaGFuZGxlcyBzZWN0aW9uIGhlYWRlcnMgYXQgY2h1bmsgYm91bmRhcmllcyBjb3JyZWN0bHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Ly8gRmlsbCB1cCB0byBuZWFyIHRoZSBjaHVuayBib3VuZGFyeSAoY2h1bmsgc2l6ZSBpcyAxMDApXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCA5NzsgaSsrKSB7XG5cdFx0XHRsaW5lcy5wdXNoKGBsaW5lICR7aX1gKTtcblx0XHR9XG5cblx0XHQvLyBBZGQgYSBzZWN0aW9uIGhlYWRlciB0aGF0IHdvdWxkIGNyb3NzIHRoZSBjaHVuayBib3VuZGFyeVxuXHRcdGxpbmVzLnB1c2goJy8vID09PT09PT09PT0nKTsgIC8vIGxpbmUgOTdcblx0XHRsaW5lcy5wdXNoKCcvLyBTZWN0aW9uIDEnKTsgLy8gbGluZSA5OFxuXHRcdGxpbmVzLnB1c2goJy8vID09PT09PT09PT0nKTsgLy8gbGluZSA5OVxuXHRcdGxpbmVzLnB1c2goJy8vID09PT09PT09PT0nKTsgLy8gbGluZSAxMDAgKGNodW5rIGJvdW5kYXJ5KVxuXHRcdGxpbmVzLnB1c2goJy8vIFNlY3Rpb24gMicpOyAvLyBsaW5lIDEwMVxuXHRcdGxpbmVzLnB1c2goJy8vID09PT09PT09PT0nKTsgLy8gbGluZSAxMDJcblxuXHRcdC8vIEFkZCBtb3JlIGNvbnRlbnQgYWZ0ZXJcblx0XHRmb3IgKGxldCBpID0gMTAzOyBpIDwgMTUwOyBpKyspIHtcblx0XHRcdGxpbmVzLnB1c2goYGxpbmUgJHtpfWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsID0gbmV3IFRlc3RTZWN0aW9uSGVhZGVyRmluZGVyVGFyZ2V0KGxpbmVzKTtcblxuXHRcdGNvbnN0IG9wdGlvbnM6IEZpbmRTZWN0aW9uSGVhZGVyT3B0aW9ucyA9IHtcblx0XHRcdGZpbmRSZWdpb25TZWN0aW9uSGVhZGVyczogZmFsc2UsXG5cdFx0XHRmaW5kTWFya1NlY3Rpb25IZWFkZXJzOiB0cnVlLFxuXHRcdFx0bWFya1NlY3Rpb25IZWFkZXJSZWdleDogJ15cXC9cXC8gPStcXFxcbl5cXC9cXC8gKD88bGFiZWw+W15cXFxcbl0rPylcXFxcbl5cXC9cXC8gPSskJ1xuXHRcdH07XG5cblx0XHRjb25zdCBoZWFkZXJzID0gZmluZFNlY3Rpb25IZWFkZXJzKG1vZGVsLCBvcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVycy5sZW5ndGgsIDIsICdTaG91bGQgZmluZCBib3RoIHNlY3Rpb24gaGVhZGVycyBhY3Jvc3MgY2h1bmsgYm91bmRhcnknKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzBdLnRleHQsICdTZWN0aW9uIDEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1swXS5yYW5nZS5zdGFydExpbmVOdW1iZXIsIDk4KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1swXS5yYW5nZS5lbmRMaW5lTnVtYmVyLCAxMDApO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMV0udGV4dCwgJ1NlY3Rpb24gMicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzFdLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgMTAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1sxXS5yYW5nZS5lbmRMaW5lTnVtYmVyLCAxMDMpO1xuXHR9KTtcblxuXHR0ZXN0KCdoYW5kbGVzIG92ZXJsYXBwaW5nIHNlY3Rpb24gaGVhZGVycyB3aXRob3V0IGR1cGxpY2F0ZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgVGVzdFNlY3Rpb25IZWFkZXJGaW5kZXJUYXJnZXQoW1xuXHRcdFx0Jy8vID09PT09PT09PT0nLCAgLy8gTGluZSAxXG5cdFx0XHQnLy8gU2VjdGlvbiAxJywgICAvLyBMaW5lIDIgLSBUaGlzIGlzIHBhcnQgb2YgZmlyc3QgaGVhZGVyXG5cdFx0XHQnLy8gPT09PT09PT09PScsICAvLyBMaW5lIDMgLSBUaGlzIGlzIHRoZSBlbmQgb2YgZmlyc3Rcblx0XHRcdCcvLyBTZWN0aW9uIDInLCAgIC8vIExpbmUgNCAtIFRoaXMgaXMgbm90IGEgaGVhZGVyXG5cdFx0XHQnLy8gPT09PT09PT09PScsICAvLyBMaW5lIDVcblx0XHRcdCcvLyA9PT09PT09PT09JywgIC8vIExpbmUgNiAtIFN0YXJ0IG9mIHNlY29uZCBoZWFkZXJcblx0XHRcdCcvLyBTZWN0aW9uIDMnLCAgIC8vIExpbmUgN1xuXHRcdFx0Jy8vID09PT09PT09PT09JyAgLy8gTGluZSA4XG5cdFx0XSk7XG5cblx0XHRjb25zdCBvcHRpb25zOiBGaW5kU2VjdGlvbkhlYWRlck9wdGlvbnMgPSB7XG5cdFx0XHRmaW5kUmVnaW9uU2VjdGlvbkhlYWRlcnM6IGZhbHNlLFxuXHRcdFx0ZmluZE1hcmtTZWN0aW9uSGVhZGVyczogdHJ1ZSxcblx0XHRcdG1hcmtTZWN0aW9uSGVhZGVyUmVnZXg6ICdeXFwvXFwvID0rXFxcXG5eXFwvXFwvICg/PGxhYmVsPlteXFxcXG5dKz8pXFxcXG5eXFwvXFwvID0rJCdcblx0XHR9O1xuXG5cdFx0Y29uc3QgaGVhZGVycyA9IGZpbmRTZWN0aW9uSGVhZGVycyhtb2RlbCwgb3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnMubGVuZ3RoLCAyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzBdLnRleHQsICdTZWN0aW9uIDEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1swXS5yYW5nZS5zdGFydExpbmVOdW1iZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzBdLnJhbmdlLmVuZExpbmVOdW1iZXIsIDMpO1xuXG5cdFx0Ly8gYXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMV0udGV4dCwgJ1NlY3Rpb24gMicpO1xuXHRcdC8vIGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzFdLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgMyk7XG5cdFx0Ly8gYXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMV0ucmFuZ2UuZW5kTGluZU51bWJlciwgNSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1sxXS50ZXh0LCAnU2VjdGlvbiAzJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMV0ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCA2KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1sxXS5yYW5nZS5lbmRMaW5lTnVtYmVyLCA4KTtcblx0fSk7XG5cblx0dGVzdCgnaGFuZGxlcyBwYXJ0aWFsbHkgb3ZlcmxhcHBpbmcgbXVsdGlsaW5lIHNlY3Rpb24gaGVhZGVycyBjb3JyZWN0bHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgVGVzdFNlY3Rpb25IZWFkZXJGaW5kZXJUYXJnZXQoW1xuXHRcdFx0Jy8vID09PT09PT09PT09PT09PT0nLCAgLy8gTGluZSAxXG5cdFx0XHQnLy8gTWFqb3IgU2VjdGlvbiAxJywgICAvLyBMaW5lIDJcblx0XHRcdCcvLyA9PT09PT09PT09PT09PT09JywgIC8vIExpbmUgM1xuXHRcdFx0Jy8vIC0tLS0tLS0tJywgICAgICAgICAvLyBMaW5lIDQgLSBTdGFydCBvZiBzdWJzZWN0aW9uIHRoYXQgb3ZlcmxhcHMgd2l0aCBlbmQgb2YgbWFqb3Igc2VjdGlvblxuXHRcdFx0Jy8vIFN1YnNlY3Rpb24gMS4xJywgICAvLyBMaW5lIDVcblx0XHRcdCcvLyAtLS0tLS0tLScsICAgICAgICAgLy8gTGluZSA2XG5cdFx0XHQnLy8gPT09PT09PT09PT09PT09PScsICAvLyBMaW5lIDdcblx0XHRcdCcvLyBNYWpvciBTZWN0aW9uIDInLCAgIC8vIExpbmUgOFxuXHRcdFx0Jy8vID09PT09PT09PT09PT09PT0nLCAgLy8gTGluZSA5XG5cdFx0XSk7XG5cblx0XHRjb25zdCBvcHRpb25zOiBGaW5kU2VjdGlvbkhlYWRlck9wdGlvbnMgPSB7XG5cdFx0XHRmaW5kUmVnaW9uU2VjdGlvbkhlYWRlcnM6IGZhbHNlLFxuXHRcdFx0ZmluZE1hcmtTZWN0aW9uSGVhZGVyczogdHJ1ZSxcblx0XHRcdG1hcmtTZWN0aW9uSGVhZGVyUmVnZXg6ICdeXFwvXFwvIFstPV0rXFxcXG5eXFwvXFwvICg/PGxhYmVsPlteXFxcXG5dKz8pXFxcXG5eXFwvXFwvIFstPV0rJCdcblx0XHR9O1xuXG5cdFx0Y29uc3QgaGVhZGVycyA9IGZpbmRTZWN0aW9uSGVhZGVycyhtb2RlbCwgb3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnMubGVuZ3RoLCAzKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzBdLnRleHQsICdNYWpvciBTZWN0aW9uIDEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1swXS5yYW5nZS5zdGFydExpbmVOdW1iZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzBdLnJhbmdlLmVuZExpbmVOdW1iZXIsIDMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMV0udGV4dCwgJ1N1YnNlY3Rpb24gMS4xJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlYWRlcnNbMV0ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1sxXS5yYW5nZS5lbmRMaW5lTnVtYmVyLCA2KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzJdLnRleHQsICdNYWpvciBTZWN0aW9uIDInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyc1syXS5yYW5nZS5zdGFydExpbmVOdW1iZXIsIDcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXJzWzJdLnJhbmdlLmVuZExpbmVOdW1iZXIsIDkpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxZQUFZO0FBQ3hCLFNBQStELDBCQUEwQjtBQUN6RixTQUFTLCtDQUErQztBQUV4RCxNQUFNLDhCQUFvRTtBQUFBLEVBQ3pFLFlBQTZCLE9BQWlCO0FBQWpCO0FBQUEsRUFBbUI7QUFBQSxFQUVoRCxlQUF1QjtBQUN0QixXQUFPLEtBQUssTUFBTTtBQUFBLEVBQ25CO0FBQUEsRUFFQSxlQUFlLFlBQTRCO0FBQzFDLFdBQU8sS0FBSyxNQUFNLGFBQWEsQ0FBQztBQUFBLEVBQ2pDO0FBQ0Q7QUFFQSxNQUFNLHNCQUFzQixNQUFNO0FBRWpDLDBDQUF3QztBQUV4QyxPQUFLLGdDQUFnQyxNQUFNO0FBQzFDLFVBQU0sUUFBUSxJQUFJLDhCQUE4QjtBQUFBLE1BQy9DO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsQ0FBQztBQUVELFVBQU0sVUFBb0M7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LEVBQUUsTUFBTSxXQUFXO0FBQy9DLFdBQU8sWUFBWSxRQUFRLENBQUMsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3RELFdBQU8sWUFBWSxRQUFRLENBQUMsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQU1wRCxXQUFPLFlBQVksUUFBUSxDQUFDLEVBQUUsTUFBTSxXQUFXO0FBQy9DLFdBQU8sWUFBWSxRQUFRLENBQUMsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3RELFdBQU8sWUFBWSxRQUFRLENBQUMsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUFBLEVBQ3JELENBQUM7QUFFRCxPQUFLLHFFQUFxRSxNQUFNO0FBQy9FLFVBQU0sUUFBUSxJQUFJLDhCQUE4QjtBQUFBLE1BQy9DO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxJQUNELENBQUM7QUFFRCxVQUFNLFVBQW9DO0FBQUEsTUFDekMsMEJBQTBCO0FBQUEsTUFDMUIsd0JBQXdCO0FBQUEsTUFDeEIsd0JBQXdCO0FBQUEsSUFDekI7QUFFQSxVQUFNLFVBQVUsbUJBQW1CLE9BQU8sT0FBTztBQUNqRCxXQUFPLFlBQVksUUFBUSxRQUFRLENBQUM7QUFFcEMsV0FBTyxZQUFZLFFBQVEsQ0FBQyxFQUFFLE1BQU0saUJBQWlCO0FBQ3JELFdBQU8sWUFBWSxRQUFRLENBQUMsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3RELFdBQU8sWUFBWSxRQUFRLENBQUMsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUVwRCxXQUFPLFlBQVksUUFBUSxDQUFDLEVBQUUsTUFBTSxnQkFBZ0I7QUFDcEQsV0FBTyxZQUFZLFFBQVEsQ0FBQyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDdEQsV0FBTyxZQUFZLFFBQVEsQ0FBQyxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRXBELFdBQU8sWUFBWSxRQUFRLENBQUMsRUFBRSxNQUFNLGlCQUFpQjtBQUNyRCxXQUFPLFlBQVksUUFBUSxDQUFDLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUN0RCxXQUFPLFlBQVksUUFBUSxDQUFDLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFBQSxFQUNyRCxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
