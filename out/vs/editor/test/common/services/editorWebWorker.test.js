import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { Range } from "../../../common/core/range.js";
import { EditorWorker } from "../../../common/services/editorWebWorker.js";
suite("EditorWebWorker", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  class WorkerWithModels extends EditorWorker {
    getModel(uri) {
      return this._getModel(uri);
    }
    addModel(lines, eol = "\n") {
      const uri = "test:file#" + Date.now();
      this.$acceptNewModel({
        url: uri,
        versionId: 1,
        lines,
        EOL: eol
      });
      return this._getModel(uri);
    }
  }
  let worker;
  let model;
  setup(() => {
    worker = new WorkerWithModels();
    model = worker.addModel([
      "This is line one",
      //16
      "and this is line number two",
      //27
      "it is followed by #3",
      //20
      "and finished with the fourth."
      //29
    ]);
  });
  function assertPositionAt(offset, line, column) {
    const position = model.positionAt(offset);
    assert.strictEqual(position.lineNumber, line);
    assert.strictEqual(position.column, column);
  }
  function assertOffsetAt(lineNumber, column, offset) {
    const actual = model.offsetAt({ lineNumber, column });
    assert.strictEqual(actual, offset);
  }
  test("ICommonModel#offsetAt", () => {
    assertOffsetAt(1, 1, 0);
    assertOffsetAt(1, 2, 1);
    assertOffsetAt(1, 17, 16);
    assertOffsetAt(2, 1, 17);
    assertOffsetAt(2, 4, 20);
    assertOffsetAt(3, 1, 45);
    assertOffsetAt(5, 30, 95);
    assertOffsetAt(5, 31, 95);
    assertOffsetAt(5, Number.MAX_VALUE, 95);
    assertOffsetAt(6, 30, 95);
    assertOffsetAt(Number.MAX_VALUE, 30, 95);
    assertOffsetAt(Number.MAX_VALUE, Number.MAX_VALUE, 95);
  });
  test("ICommonModel#positionAt", () => {
    assertPositionAt(0, 1, 1);
    assertPositionAt(Number.MIN_VALUE, 1, 1);
    assertPositionAt(1, 1, 2);
    assertPositionAt(16, 1, 17);
    assertPositionAt(17, 2, 1);
    assertPositionAt(20, 2, 4);
    assertPositionAt(45, 3, 1);
    assertPositionAt(95, 4, 30);
    assertPositionAt(96, 4, 30);
    assertPositionAt(99, 4, 30);
    assertPositionAt(Number.MAX_VALUE, 4, 30);
  });
  test("ICommonModel#validatePosition, issue #15882", function() {
    const model2 = worker.addModel(['{"id": "0001","type": "donut","name": "Cake","image":{"url": "images/0001.jpg","width": 200,"height": 200},"thumbnail":{"url": "images/thumbnails/0001.jpg","width": 32,"height": 32}}']);
    assert.strictEqual(model2.offsetAt({ lineNumber: 1, column: 2 }), 1);
  });
  test("MoreMinimal", () => {
    return worker.$computeMoreMinimalEdits(model.uri.toString(), [{ text: "This is line One", range: new Range(1, 1, 1, 17) }], false).then((edits) => {
      assert.strictEqual(edits.length, 1);
      const [first] = edits;
      assert.strictEqual(first.text, "O");
      assert.deepStrictEqual(first.range, { startLineNumber: 1, startColumn: 14, endLineNumber: 1, endColumn: 15 });
    });
  });
  test("MoreMinimal, merge adjacent edits", async function() {
    const model2 = worker.addModel([
      "one",
      "two",
      "three",
      "four",
      "five"
    ], "\n");
    const newEdits = await worker.$computeMoreMinimalEdits(model2.uri.toString(), [
      {
        range: new Range(1, 1, 2, 1),
        text: "one\ntwo\nthree\n"
      },
      {
        range: new Range(2, 1, 3, 1),
        text: ""
      },
      {
        range: new Range(3, 1, 4, 1),
        text: ""
      },
      {
        range: new Range(4, 2, 4, 3),
        text: "4"
      },
      {
        range: new Range(5, 3, 5, 5),
        text: "5"
      }
    ], false);
    assert.strictEqual(newEdits.length, 2);
    assert.strictEqual(newEdits[0].text, "4");
    assert.strictEqual(newEdits[1].text, "5");
  });
  test("MoreMinimal, issue #15385 newline changes only", function() {
    const model2 = worker.addModel([
      "{",
      '	"a":1',
      "}"
    ], "\n");
    return worker.$computeMoreMinimalEdits(model2.uri.toString(), [{ text: '{\r\n	"a":1\r\n}', range: new Range(1, 1, 3, 2) }], false).then((edits) => {
      assert.strictEqual(edits.length, 0);
    });
  });
  test("MoreMinimal, issue #15385 newline changes and other", function() {
    const model2 = worker.addModel([
      "{",
      '	"a":1',
      "}"
    ], "\n");
    return worker.$computeMoreMinimalEdits(model2.uri.toString(), [{ text: '{\r\n	"b":1\r\n}', range: new Range(1, 1, 3, 2) }], false).then((edits) => {
      assert.strictEqual(edits.length, 1);
      const [first] = edits;
      assert.strictEqual(first.text, "b");
      assert.deepStrictEqual(first.range, { startLineNumber: 2, startColumn: 3, endLineNumber: 2, endColumn: 4 });
    });
  });
  test("MoreMinimal, issue #15385 newline changes and other 2/2", function() {
    const model2 = worker.addModel([
      "package main",
      // 1
      "func foo() {",
      // 2
      "}"
      // 3
    ]);
    return worker.$computeMoreMinimalEdits(model2.uri.toString(), [{ text: "\n", range: new Range(3, 2, 4, 1e3) }], false).then((edits) => {
      assert.strictEqual(edits.length, 1);
      const [first] = edits;
      assert.strictEqual(first.text, "\n");
      assert.deepStrictEqual(first.range, { startLineNumber: 3, startColumn: 2, endLineNumber: 3, endColumn: 2 });
    });
  });
  async function testEdits(lines, edits) {
    const model2 = worker.addModel(lines);
    const smallerEdits = await worker.$computeHumanReadableDiff(
      model2.uri.toString(),
      edits,
      { ignoreTrimWhitespace: false, maxComputationTimeMs: 0, computeMoves: false }
    );
    const t1 = applyEdits(model2.getValue(), edits);
    const t2 = applyEdits(model2.getValue(), smallerEdits);
    assert.deepStrictEqual(t1, t2);
    return smallerEdits.map((e) => ({ range: Range.lift(e.range).toString(), text: e.text }));
  }
  test("computeHumanReadableDiff 1", async () => {
    assert.deepStrictEqual(
      await testEdits(
        [
          "function test() {}"
        ],
        [{
          text: "\n/** Some Comment */\n",
          range: new Range(1, 1, 1, 1)
        }]
      ),
      [{ range: "[1,1 -> 1,1]", text: "\n/** Some Comment */\n" }]
    );
  });
  test("computeHumanReadableDiff 2", async () => {
    assert.deepStrictEqual(
      await testEdits(
        [
          "function test() {}"
        ],
        [{
          text: "function test(myParam: number) { console.log(myParam); }",
          range: new Range(1, 1, 1, Number.MAX_SAFE_INTEGER)
        }]
      ),
      [{ range: "[1,15 -> 1,15]", text: "myParam: number" }, { range: "[1,18 -> 1,18]", text: " console.log(myParam); " }]
    );
  });
  test("computeHumanReadableDiff 3", async () => {
    assert.deepStrictEqual(
      await testEdits(
        [
          "",
          "",
          "",
          ""
        ],
        [{
          text: "function test(myParam: number) { console.log(myParam); }\n\n",
          range: new Range(2, 1, 3, 20)
        }]
      ),
      [{ range: "[2,1 -> 2,1]", text: "function test(myParam: number) { console.log(myParam); }\n" }]
    );
  });
  test("computeHumanReadableDiff 4", async () => {
    assert.deepStrictEqual(
      await testEdits(
        [
          "function algorithm() {}"
        ],
        [{
          text: "function alm() {}",
          range: new Range(1, 1, 1, Number.MAX_SAFE_INTEGER)
        }]
      ),
      [{ range: "[1,10 -> 1,19]", text: "alm" }]
    );
  });
  test('[Bug] Getting Message "Overlapping ranges are not allowed" and nothing happens with Inline-Chat ', async function() {
    await testEdits(
      "const API = require('../src/api');\n\ndescribe('API', () => {\n  let api;\n  let database;\n\n  beforeAll(() => {\n    database = {\n      getAllBooks: jest.fn(),\n      getBooksByAuthor: jest.fn(),\n      getBooksByTitle: jest.fn(),\n    };\n    api = new API(database);\n  });\n\n  describe('GET /books', () => {\n    it('should return all books', async () => {\n      const mockBooks = [{ title: 'Book 1' }, { title: 'Book 2' }];\n      database.getAllBooks.mockResolvedValue(mockBooks);\n\n      const req = {};\n      const res = {\n        json: jest.fn(),\n      };\n\n      await api.register({\n        get: (path, handler) => {\n          if (path === '/books') {\n            handler(req, res);\n          }\n        },\n      });\n\n      expect(database.getAllBooks).toHaveBeenCalled();\n      expect(res.json).toHaveBeenCalledWith(mockBooks);\n    });\n  });\n\n  describe('GET /books/author/:author', () => {\n    it('should return books by author', async () => {\n      const mockAuthor = 'John Doe';\n      const mockBooks = [{ title: 'Book 1', author: mockAuthor }, { title: 'Book 2', author: mockAuthor }];\n      database.getBooksByAuthor.mockResolvedValue(mockBooks);\n\n      const req = {\n        params: {\n          author: mockAuthor,\n        },\n      };\n      const res = {\n        json: jest.fn(),\n      };\n\n      await api.register({\n        get: (path, handler) => {\n          if (path === `/books/author/${mockAuthor}`) {\n            handler(req, res);\n          }\n        },\n      });\n\n      expect(database.getBooksByAuthor).toHaveBeenCalledWith(mockAuthor);\n      expect(res.json).toHaveBeenCalledWith(mockBooks);\n    });\n  });\n\n  describe('GET /books/title/:title', () => {\n    it('should return books by title', async () => {\n      const mockTitle = 'Book 1';\n      const mockBooks = [{ title: mockTitle, author: 'John Doe' }];\n      database.getBooksByTitle.mockResolvedValue(mockBooks);\n\n      const req = {\n        params: {\n          title: mockTitle,\n        },\n      };\n      const res = {\n        json: jest.fn(),\n      };\n\n      await api.register({\n        get: (path, handler) => {\n          if (path === `/books/title/${mockTitle}`) {\n            handler(req, res);\n          }\n        },\n      });\n\n      expect(database.getBooksByTitle).toHaveBeenCalledWith(mockTitle);\n      expect(res.json).toHaveBeenCalledWith(mockBooks);\n    });\n  });\n});\n".split("\n"),
      [{
        range: { startLineNumber: 1, startColumn: 1, endLineNumber: 96, endColumn: 1 },
        text: `const request = require('supertest');
const API = require('../src/api');

describe('API', () => {
  let api;
  let database;

  beforeAll(() => {
    database = {
      getAllBooks: jest.fn(),
      getBooksByAuthor: jest.fn(),
      getBooksByTitle: jest.fn(),
    };
    api = new API(database);
  });

  describe('GET /books', () => {
    it('should return all books', async () => {
      const mockBooks = [{ title: 'Book 1' }, { title: 'Book 2' }];
      database.getAllBooks.mockResolvedValue(mockBooks);

      const response = await request(api.app).get('/books');

      expect(database.getAllBooks).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBooks);
    });
  });

  describe('GET /books/author/:author', () => {
    it('should return books by author', async () => {
      const mockAuthor = 'John Doe';
      const mockBooks = [{ title: 'Book 1', author: mockAuthor }, { title: 'Book 2', author: mockAuthor }];
      database.getBooksByAuthor.mockResolvedValue(mockBooks);

      const response = await request(api.app).get(\`/books/author/\${mockAuthor}\`);

      expect(database.getBooksByAuthor).toHaveBeenCalledWith(mockAuthor);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBooks);
    });
  });

  describe('GET /books/title/:title', () => {
    it('should return books by title', async () => {
      const mockTitle = 'Book 1';
      const mockBooks = [{ title: mockTitle, author: 'John Doe' }];
      database.getBooksByTitle.mockResolvedValue(mockBooks);

      const response = await request(api.app).get(\`/books/title/\${mockTitle}\`);

      expect(database.getBooksByTitle).toHaveBeenCalledWith(mockTitle);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBooks);
    });
  });
});
`
      }]
    );
  });
  test("ICommonModel#getValueInRange, issue #17424", function() {
    const model2 = worker.addModel([
      "package main",
      // 1
      "func foo() {",
      // 2
      "}"
      // 3
    ]);
    const value = model2.getValueInRange({ startLineNumber: 3, startColumn: 1, endLineNumber: 4, endColumn: 1 });
    assert.strictEqual(value, "}");
  });
  test("textualSuggest, issue #17785", function() {
    const model2 = worker.addModel([
      "foobar",
      // 1
      "f f"
      // 2
    ]);
    return worker.$textualSuggest([model2.uri.toString()], "f", "[a-z]+", "img").then((result) => {
      if (!result) {
        assert.ok(false);
      }
      assert.strictEqual(result.words.length, 1);
      assert.strictEqual(typeof result.duration, "number");
      assert.strictEqual(result.words[0], "foobar");
    });
  });
  test("get words via iterator, issue #46930", function() {
    const model2 = worker.addModel([
      "one line",
      // 1
      "two line",
      // 2
      "",
      "past empty",
      "single",
      "",
      "and now we are done"
    ]);
    const words = [...model2.words(/[a-z]+/img)];
    assert.deepStrictEqual(words, ["one", "line", "two", "line", "past", "empty", "single", "and", "now", "we", "are", "done"]);
  });
});
function applyEdits(text, edits) {
  const transformer = new PositionOffsetTransformer(text);
  const offsetEdits = edits.map((e) => {
    const range = Range.lift(e.range);
    return {
      startOffset: transformer.getOffset(range.getStartPosition()),
      endOffset: transformer.getOffset(range.getEndPosition()),
      text: e.text
    };
  });
  offsetEdits.sort((a, b) => b.startOffset - a.startOffset);
  for (const edit of offsetEdits) {
    text = text.substring(0, edit.startOffset) + edit.text + text.substring(edit.endOffset);
  }
  return text;
}
class PositionOffsetTransformer {
  constructor(text) {
    this.text = text;
    this.lineStartOffsetByLineIdx = [];
    this.lineStartOffsetByLineIdx.push(0);
    for (let i = 0; i < text.length; i++) {
      if (text.charAt(i) === "\n") {
        this.lineStartOffsetByLineIdx.push(i + 1);
      }
    }
    this.lineStartOffsetByLineIdx.push(text.length + 1);
  }
  getOffset(position) {
    const maxLineOffset = position.lineNumber >= this.lineStartOffsetByLineIdx.length ? this.text.length : this.lineStartOffsetByLineIdx[position.lineNumber] - 1;
    return Math.min(this.lineStartOffsetByLineIdx[position.lineNumber - 1] + position.column - 1, maxLineOffset);
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vc2VydmljZXMvZWRpdG9yV2ViV29ya2VyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JXb3JrZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvZWRpdG9yV2ViV29ya2VyLmpzJztcbmltcG9ydCB7IElDb21tb25Nb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy90ZXh0TW9kZWxTeW5jL3RleHRNb2RlbFN5bmMuaW1wbC5qcyc7XG5cbnN1aXRlKCdFZGl0b3JXZWJXb3JrZXInLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y2xhc3MgV29ya2VyV2l0aE1vZGVscyBleHRlbmRzIEVkaXRvcldvcmtlciB7XG5cblx0XHRnZXRNb2RlbCh1cmk6IHN0cmluZykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2dldE1vZGVsKHVyaSk7XG5cdFx0fVxuXG5cdFx0YWRkTW9kZWwobGluZXM6IHN0cmluZ1tdLCBlb2w6IHN0cmluZyA9ICdcXG4nKSB7XG5cdFx0XHRjb25zdCB1cmkgPSAndGVzdDpmaWxlIycgKyBEYXRlLm5vdygpO1xuXHRcdFx0dGhpcy4kYWNjZXB0TmV3TW9kZWwoe1xuXHRcdFx0XHR1cmw6IHVyaSxcblx0XHRcdFx0dmVyc2lvbklkOiAxLFxuXHRcdFx0XHRsaW5lczogbGluZXMsXG5cdFx0XHRcdEVPTDogZW9sXG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiB0aGlzLl9nZXRNb2RlbCh1cmkpITtcblx0XHR9XG5cdH1cblxuXHRsZXQgd29ya2VyOiBXb3JrZXJXaXRoTW9kZWxzO1xuXHRsZXQgbW9kZWw6IElDb21tb25Nb2RlbDtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0d29ya2VyID0gbmV3IFdvcmtlcldpdGhNb2RlbHMoKTtcblx0XHRtb2RlbCA9IHdvcmtlci5hZGRNb2RlbChbXG5cdFx0XHQnVGhpcyBpcyBsaW5lIG9uZScsIC8vMTZcblx0XHRcdCdhbmQgdGhpcyBpcyBsaW5lIG51bWJlciB0d28nLCAvLzI3XG5cdFx0XHQnaXQgaXMgZm9sbG93ZWQgYnkgIzMnLCAvLzIwXG5cdFx0XHQnYW5kIGZpbmlzaGVkIHdpdGggdGhlIGZvdXJ0aC4nLCAvLzI5XG5cdFx0XSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGFzc2VydFBvc2l0aW9uQXQob2Zmc2V0OiBudW1iZXIsIGxpbmU6IG51bWJlciwgY29sdW1uOiBudW1iZXIpIHtcblx0XHRjb25zdCBwb3NpdGlvbiA9IG1vZGVsLnBvc2l0aW9uQXQob2Zmc2V0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocG9zaXRpb24ubGluZU51bWJlciwgbGluZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBvc2l0aW9uLmNvbHVtbiwgY29sdW1uKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFzc2VydE9mZnNldEF0KGxpbmVOdW1iZXI6IG51bWJlciwgY29sdW1uOiBudW1iZXIsIG9mZnNldDogbnVtYmVyKSB7XG5cdFx0Y29uc3QgYWN0dWFsID0gbW9kZWwub2Zmc2V0QXQoeyBsaW5lTnVtYmVyLCBjb2x1bW4gfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgb2Zmc2V0KTtcblx0fVxuXG5cdHRlc3QoJ0lDb21tb25Nb2RlbCNvZmZzZXRBdCcsICgpID0+IHtcblx0XHRhc3NlcnRPZmZzZXRBdCgxLCAxLCAwKTtcblx0XHRhc3NlcnRPZmZzZXRBdCgxLCAyLCAxKTtcblx0XHRhc3NlcnRPZmZzZXRBdCgxLCAxNywgMTYpO1xuXHRcdGFzc2VydE9mZnNldEF0KDIsIDEsIDE3KTtcblx0XHRhc3NlcnRPZmZzZXRBdCgyLCA0LCAyMCk7XG5cdFx0YXNzZXJ0T2Zmc2V0QXQoMywgMSwgNDUpO1xuXHRcdGFzc2VydE9mZnNldEF0KDUsIDMwLCA5NSk7XG5cdFx0YXNzZXJ0T2Zmc2V0QXQoNSwgMzEsIDk1KTtcblx0XHRhc3NlcnRPZmZzZXRBdCg1LCBOdW1iZXIuTUFYX1ZBTFVFLCA5NSk7XG5cdFx0YXNzZXJ0T2Zmc2V0QXQoNiwgMzAsIDk1KTtcblx0XHRhc3NlcnRPZmZzZXRBdChOdW1iZXIuTUFYX1ZBTFVFLCAzMCwgOTUpO1xuXHRcdGFzc2VydE9mZnNldEF0KE51bWJlci5NQVhfVkFMVUUsIE51bWJlci5NQVhfVkFMVUUsIDk1KTtcblx0fSk7XG5cblx0dGVzdCgnSUNvbW1vbk1vZGVsI3Bvc2l0aW9uQXQnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UG9zaXRpb25BdCgwLCAxLCAxKTtcblx0XHRhc3NlcnRQb3NpdGlvbkF0KE51bWJlci5NSU5fVkFMVUUsIDEsIDEpO1xuXHRcdGFzc2VydFBvc2l0aW9uQXQoMSwgMSwgMik7XG5cdFx0YXNzZXJ0UG9zaXRpb25BdCgxNiwgMSwgMTcpO1xuXHRcdGFzc2VydFBvc2l0aW9uQXQoMTcsIDIsIDEpO1xuXHRcdGFzc2VydFBvc2l0aW9uQXQoMjAsIDIsIDQpO1xuXHRcdGFzc2VydFBvc2l0aW9uQXQoNDUsIDMsIDEpO1xuXHRcdGFzc2VydFBvc2l0aW9uQXQoOTUsIDQsIDMwKTtcblx0XHRhc3NlcnRQb3NpdGlvbkF0KDk2LCA0LCAzMCk7XG5cdFx0YXNzZXJ0UG9zaXRpb25BdCg5OSwgNCwgMzApO1xuXHRcdGFzc2VydFBvc2l0aW9uQXQoTnVtYmVyLk1BWF9WQUxVRSwgNCwgMzApO1xuXHR9KTtcblxuXHR0ZXN0KCdJQ29tbW9uTW9kZWwjdmFsaWRhdGVQb3NpdGlvbiwgaXNzdWUgIzE1ODgyJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG1vZGVsID0gd29ya2VyLmFkZE1vZGVsKFsne1wiaWRcIjogXCIwMDAxXCIsXCJ0eXBlXCI6IFwiZG9udXRcIixcIm5hbWVcIjogXCJDYWtlXCIsXCJpbWFnZVwiOntcInVybFwiOiBcImltYWdlcy8wMDAxLmpwZ1wiLFwid2lkdGhcIjogMjAwLFwiaGVpZ2h0XCI6IDIwMH0sXCJ0aHVtYm5haWxcIjp7XCJ1cmxcIjogXCJpbWFnZXMvdGh1bWJuYWlscy8wMDAxLmpwZ1wiLFwid2lkdGhcIjogMzIsXCJoZWlnaHRcIjogMzJ9fSddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwub2Zmc2V0QXQoeyBsaW5lTnVtYmVyOiAxLCBjb2x1bW46IDIgfSksIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdNb3JlTWluaW1hbCcsICgpID0+IHtcblxuXHRcdHJldHVybiB3b3JrZXIuJGNvbXB1dGVNb3JlTWluaW1hbEVkaXRzKG1vZGVsLnVyaS50b1N0cmluZygpLCBbeyB0ZXh0OiAnVGhpcyBpcyBsaW5lIE9uZScsIHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMTcpIH1dLCBmYWxzZSkudGhlbihlZGl0cyA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdHMubGVuZ3RoLCAxKTtcblx0XHRcdGNvbnN0IFtmaXJzdF0gPSBlZGl0cztcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC50ZXh0LCAnTycpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXJzdC5yYW5nZSwgeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxNCwgZW5kTGluZU51bWJlcjogMSwgZW5kQ29sdW1uOiAxNSB9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnTW9yZU1pbmltYWwsIG1lcmdlIGFkamFjZW50IGVkaXRzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB3b3JrZXIuYWRkTW9kZWwoW1xuXHRcdFx0J29uZScsXG5cdFx0XHQndHdvJyxcblx0XHRcdCd0aHJlZScsXG5cdFx0XHQnZm91cicsXG5cdFx0XHQnZml2ZSdcblx0XHRdLCAnXFxuJyk7XG5cblxuXHRcdGNvbnN0IG5ld0VkaXRzID0gYXdhaXQgd29ya2VyLiRjb21wdXRlTW9yZU1pbmltYWxFZGl0cyhtb2RlbC51cmkudG9TdHJpbmcoKSwgW1xuXHRcdFx0e1xuXHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDEsIDEsIDIsIDEpLFxuXHRcdFx0XHR0ZXh0OiAnb25lXFxudHdvXFxudGhyZWVcXG4nLFxuXHRcdFx0fSwge1xuXHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDIsIDEsIDMsIDEpLFxuXHRcdFx0XHR0ZXh0OiAnJyxcblx0XHRcdH0sIHtcblx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgzLCAxLCA0LCAxKSxcblx0XHRcdFx0dGV4dDogJycsXG5cdFx0XHR9LCB7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoNCwgMiwgNCwgMyksXG5cdFx0XHRcdHRleHQ6ICc0Jyxcblx0XHRcdH0sIHtcblx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSg1LCAzLCA1LCA1KSxcblx0XHRcdFx0dGV4dDogJzUnLFxuXHRcdFx0fVxuXHRcdF0sIGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXdFZGl0cy5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXdFZGl0c1swXS50ZXh0LCAnNCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXdFZGl0c1sxXS50ZXh0LCAnNScpO1xuXHR9KTtcblxuXHR0ZXN0KCdNb3JlTWluaW1hbCwgaXNzdWUgIzE1Mzg1IG5ld2xpbmUgY2hhbmdlcyBvbmx5JywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB3b3JrZXIuYWRkTW9kZWwoW1xuXHRcdFx0J3snLFxuXHRcdFx0J1xcdFwiYVwiOjEnLFxuXHRcdFx0J30nXG5cdFx0XSwgJ1xcbicpO1xuXG5cdFx0cmV0dXJuIHdvcmtlci4kY29tcHV0ZU1vcmVNaW5pbWFsRWRpdHMobW9kZWwudXJpLnRvU3RyaW5nKCksIFt7IHRleHQ6ICd7XFxyXFxuXFx0XCJhXCI6MVxcclxcbn0nLCByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDMsIDIpIH1dLCBmYWxzZSkudGhlbihlZGl0cyA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdHMubGVuZ3RoLCAwKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnTW9yZU1pbmltYWwsIGlzc3VlICMxNTM4NSBuZXdsaW5lIGNoYW5nZXMgYW5kIG90aGVyJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB3b3JrZXIuYWRkTW9kZWwoW1xuXHRcdFx0J3snLFxuXHRcdFx0J1xcdFwiYVwiOjEnLFxuXHRcdFx0J30nXG5cdFx0XSwgJ1xcbicpO1xuXG5cdFx0cmV0dXJuIHdvcmtlci4kY29tcHV0ZU1vcmVNaW5pbWFsRWRpdHMobW9kZWwudXJpLnRvU3RyaW5nKCksIFt7IHRleHQ6ICd7XFxyXFxuXFx0XCJiXCI6MVxcclxcbn0nLCByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDMsIDIpIH1dLCBmYWxzZSkudGhlbihlZGl0cyA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdHMubGVuZ3RoLCAxKTtcblx0XHRcdGNvbnN0IFtmaXJzdF0gPSBlZGl0cztcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC50ZXh0LCAnYicpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXJzdC5yYW5nZSwgeyBzdGFydExpbmVOdW1iZXI6IDIsIHN0YXJ0Q29sdW1uOiAzLCBlbmRMaW5lTnVtYmVyOiAyLCBlbmRDb2x1bW46IDQgfSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ01vcmVNaW5pbWFsLCBpc3N1ZSAjMTUzODUgbmV3bGluZSBjaGFuZ2VzIGFuZCBvdGhlciAyLzInLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBtb2RlbCA9IHdvcmtlci5hZGRNb2RlbChbXG5cdFx0XHQncGFja2FnZSBtYWluJyxcdC8vIDFcblx0XHRcdCdmdW5jIGZvbygpIHsnLFx0Ly8gMlxuXHRcdFx0J30nXHRcdFx0XHQvLyAzXG5cdFx0XSk7XG5cblx0XHRyZXR1cm4gd29ya2VyLiRjb21wdXRlTW9yZU1pbmltYWxFZGl0cyhtb2RlbC51cmkudG9TdHJpbmcoKSwgW3sgdGV4dDogJ1xcbicsIHJhbmdlOiBuZXcgUmFuZ2UoMywgMiwgNCwgMTAwMCkgfV0sIGZhbHNlKS50aGVuKGVkaXRzID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0cy5sZW5ndGgsIDEpO1xuXHRcdFx0Y29uc3QgW2ZpcnN0XSA9IGVkaXRzO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnRleHQsICdcXG4nKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmlyc3QucmFuZ2UsIHsgc3RhcnRMaW5lTnVtYmVyOiAzLCBzdGFydENvbHVtbjogMiwgZW5kTGluZU51bWJlcjogMywgZW5kQ29sdW1uOiAyIH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRhc3luYyBmdW5jdGlvbiB0ZXN0RWRpdHMobGluZXM6IHN0cmluZ1tdLCBlZGl0czogVGV4dEVkaXRbXSk6IFByb21pc2U8dW5rbm93bj4ge1xuXHRcdGNvbnN0IG1vZGVsID0gd29ya2VyLmFkZE1vZGVsKGxpbmVzKTtcblxuXHRcdGNvbnN0IHNtYWxsZXJFZGl0cyA9IGF3YWl0IHdvcmtlci4kY29tcHV0ZUh1bWFuUmVhZGFibGVEaWZmKFxuXHRcdFx0bW9kZWwudXJpLnRvU3RyaW5nKCksXG5cdFx0XHRlZGl0cyxcblx0XHRcdHsgaWdub3JlVHJpbVdoaXRlc3BhY2U6IGZhbHNlLCBtYXhDb21wdXRhdGlvblRpbWVNczogMCwgY29tcHV0ZU1vdmVzOiBmYWxzZSB9XG5cdFx0KTtcblxuXHRcdGNvbnN0IHQxID0gYXBwbHlFZGl0cyhtb2RlbC5nZXRWYWx1ZSgpLCBlZGl0cyk7XG5cdFx0Y29uc3QgdDIgPSBhcHBseUVkaXRzKG1vZGVsLmdldFZhbHVlKCksIHNtYWxsZXJFZGl0cyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0MSwgdDIpO1xuXG5cdFx0cmV0dXJuIHNtYWxsZXJFZGl0cy5tYXAoZSA9PiAoeyByYW5nZTogUmFuZ2UubGlmdChlLnJhbmdlKS50b1N0cmluZygpLCB0ZXh0OiBlLnRleHQgfSkpO1xuXHR9XG5cblxuXHR0ZXN0KCdjb21wdXRlSHVtYW5SZWFkYWJsZURpZmYgMScsIGFzeW5jICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0YXdhaXQgdGVzdEVkaXRzKFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0J2Z1bmN0aW9uIHRlc3QoKSB7fSdcblx0XHRcdFx0XSxcblx0XHRcdFx0W3tcblx0XHRcdFx0XHR0ZXh0OiBcIlxcbi8qKiBTb21lIENvbW1lbnQgKi9cXG5cIixcblx0XHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEpXG5cdFx0XHRcdH1dKSxcblx0XHRcdChbeyByYW5nZTogXCJbMSwxIC0+IDEsMV1cIiwgdGV4dDogXCJcXG4vKiogU29tZSBDb21tZW50ICovXFxuXCIgfV0pXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnY29tcHV0ZUh1bWFuUmVhZGFibGVEaWZmIDInLCBhc3luYyAoKSA9PiB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdGF3YWl0IHRlc3RFZGl0cyhcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdmdW5jdGlvbiB0ZXN0KCkge30nXG5cdFx0XHRcdF0sXG5cdFx0XHRcdFt7XG5cdFx0XHRcdFx0dGV4dDogJ2Z1bmN0aW9uIHRlc3QobXlQYXJhbTogbnVtYmVyKSB7IGNvbnNvbGUubG9nKG15UGFyYW0pOyB9Jyxcblx0XHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKVxuXHRcdFx0XHR9XSksXG5cdFx0XHQoW3sgcmFuZ2U6ICdbMSwxNSAtPiAxLDE1XScsIHRleHQ6ICdteVBhcmFtOiBudW1iZXInIH0sIHsgcmFuZ2U6ICdbMSwxOCAtPiAxLDE4XScsIHRleHQ6ICcgY29uc29sZS5sb2cobXlQYXJhbSk7ICcgfV0pXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnY29tcHV0ZUh1bWFuUmVhZGFibGVEaWZmIDMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdGF3YWl0IHRlc3RFZGl0cyhcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCcnXG5cdFx0XHRcdF0sXG5cdFx0XHRcdFt7XG5cdFx0XHRcdFx0dGV4dDogJ2Z1bmN0aW9uIHRlc3QobXlQYXJhbTogbnVtYmVyKSB7IGNvbnNvbGUubG9nKG15UGFyYW0pOyB9XFxuXFxuJyxcblx0XHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDIsIDEsIDMsIDIwKVxuXHRcdFx0XHR9XSksXG5cdFx0XHQoW3sgcmFuZ2U6ICdbMiwxIC0+IDIsMV0nLCB0ZXh0OiAnZnVuY3Rpb24gdGVzdChteVBhcmFtOiBudW1iZXIpIHsgY29uc29sZS5sb2cobXlQYXJhbSk7IH1cXG4nIH1dKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbXB1dGVIdW1hblJlYWRhYmxlRGlmZiA0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRhd2FpdCB0ZXN0RWRpdHMoXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnZnVuY3Rpb24gYWxnb3JpdGhtKCkge30nLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbe1xuXHRcdFx0XHRcdHRleHQ6ICdmdW5jdGlvbiBhbG0oKSB7fScsXG5cdFx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUilcblx0XHRcdFx0fV0pLFxuXHRcdFx0KFt7IHJhbmdlOiBcIlsxLDEwIC0+IDEsMTldXCIsIHRleHQ6IFwiYWxtXCIgfV0pXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnW0J1Z10gR2V0dGluZyBNZXNzYWdlIFwiT3ZlcmxhcHBpbmcgcmFuZ2VzIGFyZSBub3QgYWxsb3dlZFwiIGFuZCBub3RoaW5nIGhhcHBlbnMgd2l0aCBJbmxpbmUtQ2hhdCAnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgdGVzdEVkaXRzKChcImNvbnN0IEFQSSA9IHJlcXVpcmUoJy4uL3NyYy9hcGknKTtcXG5cXG5kZXNjcmliZSgnQVBJJywgKCkgPT4ge1xcbiAgbGV0IGFwaTtcXG4gIGxldCBkYXRhYmFzZTtcXG5cXG4gIGJlZm9yZUFsbCgoKSA9PiB7XFxuICAgIGRhdGFiYXNlID0ge1xcbiAgICAgIGdldEFsbEJvb2tzOiBqZXN0LmZuKCksXFxuICAgICAgZ2V0Qm9va3NCeUF1dGhvcjogamVzdC5mbigpLFxcbiAgICAgIGdldEJvb2tzQnlUaXRsZTogamVzdC5mbigpLFxcbiAgICB9O1xcbiAgICBhcGkgPSBuZXcgQVBJKGRhdGFiYXNlKTtcXG4gIH0pO1xcblxcbiAgZGVzY3JpYmUoJ0dFVCAvYm9va3MnLCAoKSA9PiB7XFxuICAgIGl0KCdzaG91bGQgcmV0dXJuIGFsbCBib29rcycsIGFzeW5jICgpID0+IHtcXG4gICAgICBjb25zdCBtb2NrQm9va3MgPSBbeyB0aXRsZTogJ0Jvb2sgMScgfSwgeyB0aXRsZTogJ0Jvb2sgMicgfV07XFxuICAgICAgZGF0YWJhc2UuZ2V0QWxsQm9va3MubW9ja1Jlc29sdmVkVmFsdWUobW9ja0Jvb2tzKTtcXG5cXG4gICAgICBjb25zdCByZXEgPSB7fTtcXG4gICAgICBjb25zdCByZXMgPSB7XFxuICAgICAgICBqc29uOiBqZXN0LmZuKCksXFxuICAgICAgfTtcXG5cXG4gICAgICBhd2FpdCBhcGkucmVnaXN0ZXIoe1xcbiAgICAgICAgZ2V0OiAocGF0aCwgaGFuZGxlcikgPT4ge1xcbiAgICAgICAgICBpZiAocGF0aCA9PT0gJy9ib29rcycpIHtcXG4gICAgICAgICAgICBoYW5kbGVyKHJlcSwgcmVzKTtcXG4gICAgICAgICAgfVxcbiAgICAgICAgfSxcXG4gICAgICB9KTtcXG5cXG4gICAgICBleHBlY3QoZGF0YWJhc2UuZ2V0QWxsQm9va3MpLnRvSGF2ZUJlZW5DYWxsZWQoKTtcXG4gICAgICBleHBlY3QocmVzLmpzb24pLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKG1vY2tCb29rcyk7XFxuICAgIH0pO1xcbiAgfSk7XFxuXFxuICBkZXNjcmliZSgnR0VUIC9ib29rcy9hdXRob3IvOmF1dGhvcicsICgpID0+IHtcXG4gICAgaXQoJ3Nob3VsZCByZXR1cm4gYm9va3MgYnkgYXV0aG9yJywgYXN5bmMgKCkgPT4ge1xcbiAgICAgIGNvbnN0IG1vY2tBdXRob3IgPSAnSm9obiBEb2UnO1xcbiAgICAgIGNvbnN0IG1vY2tCb29rcyA9IFt7IHRpdGxlOiAnQm9vayAxJywgYXV0aG9yOiBtb2NrQXV0aG9yIH0sIHsgdGl0bGU6ICdCb29rIDInLCBhdXRob3I6IG1vY2tBdXRob3IgfV07XFxuICAgICAgZGF0YWJhc2UuZ2V0Qm9va3NCeUF1dGhvci5tb2NrUmVzb2x2ZWRWYWx1ZShtb2NrQm9va3MpO1xcblxcbiAgICAgIGNvbnN0IHJlcSA9IHtcXG4gICAgICAgIHBhcmFtczoge1xcbiAgICAgICAgICBhdXRob3I6IG1vY2tBdXRob3IsXFxuICAgICAgICB9LFxcbiAgICAgIH07XFxuICAgICAgY29uc3QgcmVzID0ge1xcbiAgICAgICAganNvbjogamVzdC5mbigpLFxcbiAgICAgIH07XFxuXFxuICAgICAgYXdhaXQgYXBpLnJlZ2lzdGVyKHtcXG4gICAgICAgIGdldDogKHBhdGgsIGhhbmRsZXIpID0+IHtcXG4gICAgICAgICAgaWYgKHBhdGggPT09IGAvYm9va3MvYXV0aG9yLyR7bW9ja0F1dGhvcn1gKSB7XFxuICAgICAgICAgICAgaGFuZGxlcihyZXEsIHJlcyk7XFxuICAgICAgICAgIH1cXG4gICAgICAgIH0sXFxuICAgICAgfSk7XFxuXFxuICAgICAgZXhwZWN0KGRhdGFiYXNlLmdldEJvb2tzQnlBdXRob3IpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKG1vY2tBdXRob3IpO1xcbiAgICAgIGV4cGVjdChyZXMuanNvbikudG9IYXZlQmVlbkNhbGxlZFdpdGgobW9ja0Jvb2tzKTtcXG4gICAgfSk7XFxuICB9KTtcXG5cXG4gIGRlc2NyaWJlKCdHRVQgL2Jvb2tzL3RpdGxlLzp0aXRsZScsICgpID0+IHtcXG4gICAgaXQoJ3Nob3VsZCByZXR1cm4gYm9va3MgYnkgdGl0bGUnLCBhc3luYyAoKSA9PiB7XFxuICAgICAgY29uc3QgbW9ja1RpdGxlID0gJ0Jvb2sgMSc7XFxuICAgICAgY29uc3QgbW9ja0Jvb2tzID0gW3sgdGl0bGU6IG1vY2tUaXRsZSwgYXV0aG9yOiAnSm9obiBEb2UnIH1dO1xcbiAgICAgIGRhdGFiYXNlLmdldEJvb2tzQnlUaXRsZS5tb2NrUmVzb2x2ZWRWYWx1ZShtb2NrQm9va3MpO1xcblxcbiAgICAgIGNvbnN0IHJlcSA9IHtcXG4gICAgICAgIHBhcmFtczoge1xcbiAgICAgICAgICB0aXRsZTogbW9ja1RpdGxlLFxcbiAgICAgICAgfSxcXG4gICAgICB9O1xcbiAgICAgIGNvbnN0IHJlcyA9IHtcXG4gICAgICAgIGpzb246IGplc3QuZm4oKSxcXG4gICAgICB9O1xcblxcbiAgICAgIGF3YWl0IGFwaS5yZWdpc3Rlcih7XFxuICAgICAgICBnZXQ6IChwYXRoLCBoYW5kbGVyKSA9PiB7XFxuICAgICAgICAgIGlmIChwYXRoID09PSBgL2Jvb2tzL3RpdGxlLyR7bW9ja1RpdGxlfWApIHtcXG4gICAgICAgICAgICBoYW5kbGVyKHJlcSwgcmVzKTtcXG4gICAgICAgICAgfVxcbiAgICAgICAgfSxcXG4gICAgICB9KTtcXG5cXG4gICAgICBleHBlY3QoZGF0YWJhc2UuZ2V0Qm9va3NCeVRpdGxlKS50b0hhdmVCZWVuQ2FsbGVkV2l0aChtb2NrVGl0bGUpO1xcbiAgICAgIGV4cGVjdChyZXMuanNvbikudG9IYXZlQmVlbkNhbGxlZFdpdGgobW9ja0Jvb2tzKTtcXG4gICAgfSk7XFxuICB9KTtcXG59KTtcXG5cIikuc3BsaXQoJ1xcbicpLFxuXHRcdFx0W3tcblx0XHRcdFx0cmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogOTYsIGVuZENvbHVtbjogMSB9LFxuXHRcdFx0XHR0ZXh0OiBgY29uc3QgcmVxdWVzdCA9IHJlcXVpcmUoJ3N1cGVydGVzdCcpO1xcbmNvbnN0IEFQSSA9IHJlcXVpcmUoJy4uL3NyYy9hcGknKTtcXG5cXG5kZXNjcmliZSgnQVBJJywgKCkgPT4ge1xcbiAgbGV0IGFwaTtcXG4gIGxldCBkYXRhYmFzZTtcXG5cXG4gIGJlZm9yZUFsbCgoKSA9PiB7XFxuICAgIGRhdGFiYXNlID0ge1xcbiAgICAgIGdldEFsbEJvb2tzOiBqZXN0LmZuKCksXFxuICAgICAgZ2V0Qm9va3NCeUF1dGhvcjogamVzdC5mbigpLFxcbiAgICAgIGdldEJvb2tzQnlUaXRsZTogamVzdC5mbigpLFxcbiAgICB9O1xcbiAgICBhcGkgPSBuZXcgQVBJKGRhdGFiYXNlKTtcXG4gIH0pO1xcblxcbiAgZGVzY3JpYmUoJ0dFVCAvYm9va3MnLCAoKSA9PiB7XFxuICAgIGl0KCdzaG91bGQgcmV0dXJuIGFsbCBib29rcycsIGFzeW5jICgpID0+IHtcXG4gICAgICBjb25zdCBtb2NrQm9va3MgPSBbeyB0aXRsZTogJ0Jvb2sgMScgfSwgeyB0aXRsZTogJ0Jvb2sgMicgfV07XFxuICAgICAgZGF0YWJhc2UuZ2V0QWxsQm9va3MubW9ja1Jlc29sdmVkVmFsdWUobW9ja0Jvb2tzKTtcXG5cXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3QoYXBpLmFwcCkuZ2V0KCcvYm9va3MnKTtcXG5cXG4gICAgICBleHBlY3QoZGF0YWJhc2UuZ2V0QWxsQm9va3MpLnRvSGF2ZUJlZW5DYWxsZWQoKTtcXG4gICAgICBleHBlY3QocmVzcG9uc2Uuc3RhdHVzKS50b0JlKDIwMCk7XFxuICAgICAgZXhwZWN0KHJlc3BvbnNlLmJvZHkpLnRvRXF1YWwobW9ja0Jvb2tzKTtcXG4gICAgfSk7XFxuICB9KTtcXG5cXG4gIGRlc2NyaWJlKCdHRVQgL2Jvb2tzL2F1dGhvci86YXV0aG9yJywgKCkgPT4ge1xcbiAgICBpdCgnc2hvdWxkIHJldHVybiBib29rcyBieSBhdXRob3InLCBhc3luYyAoKSA9PiB7XFxuICAgICAgY29uc3QgbW9ja0F1dGhvciA9ICdKb2huIERvZSc7XFxuICAgICAgY29uc3QgbW9ja0Jvb2tzID0gW3sgdGl0bGU6ICdCb29rIDEnLCBhdXRob3I6IG1vY2tBdXRob3IgfSwgeyB0aXRsZTogJ0Jvb2sgMicsIGF1dGhvcjogbW9ja0F1dGhvciB9XTtcXG4gICAgICBkYXRhYmFzZS5nZXRCb29rc0J5QXV0aG9yLm1vY2tSZXNvbHZlZFZhbHVlKG1vY2tCb29rcyk7XFxuXFxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0KGFwaS5hcHApLmdldChcXGAvYm9va3MvYXV0aG9yL1xcJHttb2NrQXV0aG9yfVxcYCk7XFxuXFxuICAgICAgZXhwZWN0KGRhdGFiYXNlLmdldEJvb2tzQnlBdXRob3IpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKG1vY2tBdXRob3IpO1xcbiAgICAgIGV4cGVjdChyZXNwb25zZS5zdGF0dXMpLnRvQmUoMjAwKTtcXG4gICAgICBleHBlY3QocmVzcG9uc2UuYm9keSkudG9FcXVhbChtb2NrQm9va3MpO1xcbiAgICB9KTtcXG4gIH0pO1xcblxcbiAgZGVzY3JpYmUoJ0dFVCAvYm9va3MvdGl0bGUvOnRpdGxlJywgKCkgPT4ge1xcbiAgICBpdCgnc2hvdWxkIHJldHVybiBib29rcyBieSB0aXRsZScsIGFzeW5jICgpID0+IHtcXG4gICAgICBjb25zdCBtb2NrVGl0bGUgPSAnQm9vayAxJztcXG4gICAgICBjb25zdCBtb2NrQm9va3MgPSBbeyB0aXRsZTogbW9ja1RpdGxlLCBhdXRob3I6ICdKb2huIERvZScgfV07XFxuICAgICAgZGF0YWJhc2UuZ2V0Qm9va3NCeVRpdGxlLm1vY2tSZXNvbHZlZFZhbHVlKG1vY2tCb29rcyk7XFxuXFxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0KGFwaS5hcHApLmdldChcXGAvYm9va3MvdGl0bGUvXFwke21vY2tUaXRsZX1cXGApO1xcblxcbiAgICAgIGV4cGVjdChkYXRhYmFzZS5nZXRCb29rc0J5VGl0bGUpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKG1vY2tUaXRsZSk7XFxuICAgICAgZXhwZWN0KHJlc3BvbnNlLnN0YXR1cykudG9CZSgyMDApO1xcbiAgICAgIGV4cGVjdChyZXNwb25zZS5ib2R5KS50b0VxdWFsKG1vY2tCb29rcyk7XFxuICAgIH0pO1xcbiAgfSk7XFxufSk7XFxuYCxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnSUNvbW1vbk1vZGVsI2dldFZhbHVlSW5SYW5nZSwgaXNzdWUgIzE3NDI0JywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB3b3JrZXIuYWRkTW9kZWwoW1xuXHRcdFx0J3BhY2thZ2UgbWFpbicsXHQvLyAxXG5cdFx0XHQnZnVuYyBmb28oKSB7JyxcdC8vIDJcblx0XHRcdCd9J1x0XHRcdFx0Ly8gM1xuXHRcdF0pO1xuXG5cdFx0Y29uc3QgdmFsdWUgPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2UoeyBzdGFydExpbmVOdW1iZXI6IDMsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiA0LCBlbmRDb2x1bW46IDEgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLCAnfScpO1xuXHR9KTtcblxuXG5cdHRlc3QoJ3RleHR1YWxTdWdnZXN0LCBpc3N1ZSAjMTc3ODUnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBtb2RlbCA9IHdvcmtlci5hZGRNb2RlbChbXG5cdFx0XHQnZm9vYmFyJyxcdC8vIDFcblx0XHRcdCdmIGYnXHQvLyAyXG5cdFx0XSk7XG5cblx0XHRyZXR1cm4gd29ya2VyLiR0ZXh0dWFsU3VnZ2VzdChbbW9kZWwudXJpLnRvU3RyaW5nKCldLCAnZicsICdbYS16XSsnLCAnaW1nJykudGhlbigocmVzdWx0KSA9PiB7XG5cdFx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0XHRhc3NlcnQub2soZmFsc2UpO1xuXHRcdFx0fVxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC53b3Jkcy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiByZXN1bHQuZHVyYXRpb24sICdudW1iZXInKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQud29yZHNbMF0sICdmb29iYXInKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0IHdvcmRzIHZpYSBpdGVyYXRvciwgaXNzdWUgIzQ2OTMwJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB3b3JrZXIuYWRkTW9kZWwoW1xuXHRcdFx0J29uZSBsaW5lJyxcdC8vIDFcblx0XHRcdCd0d28gbGluZScsXHQvLyAyXG5cdFx0XHQnJyxcblx0XHRcdCdwYXN0IGVtcHR5Jyxcblx0XHRcdCdzaW5nbGUnLFxuXHRcdFx0JycsXG5cdFx0XHQnYW5kIG5vdyB3ZSBhcmUgZG9uZSdcblx0XHRdKTtcblxuXHRcdGNvbnN0IHdvcmRzOiBzdHJpbmdbXSA9IFsuLi5tb2RlbC53b3JkcygvW2Etel0rL2ltZyldO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh3b3JkcywgWydvbmUnLCAnbGluZScsICd0d28nLCAnbGluZScsICdwYXN0JywgJ2VtcHR5JywgJ3NpbmdsZScsICdhbmQnLCAnbm93JywgJ3dlJywgJ2FyZScsICdkb25lJ10pO1xuXHR9KTtcbn0pO1xuXG5mdW5jdGlvbiBhcHBseUVkaXRzKHRleHQ6IHN0cmluZywgZWRpdHM6IHsgcmFuZ2U6IElSYW5nZTsgdGV4dDogc3RyaW5nIH1bXSk6IHN0cmluZyB7XG5cdGNvbnN0IHRyYW5zZm9ybWVyID0gbmV3IFBvc2l0aW9uT2Zmc2V0VHJhbnNmb3JtZXIodGV4dCk7XG5cdGNvbnN0IG9mZnNldEVkaXRzID0gZWRpdHMubWFwKGUgPT4ge1xuXHRcdGNvbnN0IHJhbmdlID0gUmFuZ2UubGlmdChlLnJhbmdlKTtcblx0XHRyZXR1cm4gKHtcblx0XHRcdHN0YXJ0T2Zmc2V0OiB0cmFuc2Zvcm1lci5nZXRPZmZzZXQocmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpKSxcblx0XHRcdGVuZE9mZnNldDogdHJhbnNmb3JtZXIuZ2V0T2Zmc2V0KHJhbmdlLmdldEVuZFBvc2l0aW9uKCkpLFxuXHRcdFx0dGV4dDogZS50ZXh0XG5cdFx0fSk7XG5cdH0pO1xuXG5cdG9mZnNldEVkaXRzLnNvcnQoKGEsIGIpID0+IGIuc3RhcnRPZmZzZXQgLSBhLnN0YXJ0T2Zmc2V0KTtcblxuXHRmb3IgKGNvbnN0IGVkaXQgb2Ygb2Zmc2V0RWRpdHMpIHtcblx0XHR0ZXh0ID0gdGV4dC5zdWJzdHJpbmcoMCwgZWRpdC5zdGFydE9mZnNldCkgKyBlZGl0LnRleHQgKyB0ZXh0LnN1YnN0cmluZyhlZGl0LmVuZE9mZnNldCk7XG5cdH1cblxuXHRyZXR1cm4gdGV4dDtcbn1cblxuY2xhc3MgUG9zaXRpb25PZmZzZXRUcmFuc2Zvcm1lciB7XG5cdHByaXZhdGUgcmVhZG9ubHkgbGluZVN0YXJ0T2Zmc2V0QnlMaW5lSWR4OiBudW1iZXJbXTtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHRleHQ6IHN0cmluZykge1xuXHRcdHRoaXMubGluZVN0YXJ0T2Zmc2V0QnlMaW5lSWR4ID0gW107XG5cdFx0dGhpcy5saW5lU3RhcnRPZmZzZXRCeUxpbmVJZHgucHVzaCgwKTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmICh0ZXh0LmNoYXJBdChpKSA9PT0gJ1xcbicpIHtcblx0XHRcdFx0dGhpcy5saW5lU3RhcnRPZmZzZXRCeUxpbmVJZHgucHVzaChpICsgMSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMubGluZVN0YXJ0T2Zmc2V0QnlMaW5lSWR4LnB1c2godGV4dC5sZW5ndGggKyAxKTtcblx0fVxuXG5cdGdldE9mZnNldChwb3NpdGlvbjogUG9zaXRpb24pOiBudW1iZXIge1xuXHRcdGNvbnN0IG1heExpbmVPZmZzZXQgPSBwb3NpdGlvbi5saW5lTnVtYmVyID49IHRoaXMubGluZVN0YXJ0T2Zmc2V0QnlMaW5lSWR4Lmxlbmd0aCA/IHRoaXMudGV4dC5sZW5ndGggOiAodGhpcy5saW5lU3RhcnRPZmZzZXRCeUxpbmVJZHhbcG9zaXRpb24ubGluZU51bWJlcl0gLSAxKTtcblx0XHRyZXR1cm4gTWF0aC5taW4odGhpcy5saW5lU3RhcnRPZmZzZXRCeUxpbmVJZHhbcG9zaXRpb24ubGluZU51bWJlciAtIDFdICsgcG9zaXRpb24uY29sdW1uIC0gMSwgbWF4TGluZU9mZnNldCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLCtDQUErQztBQUV4RCxTQUFpQixhQUFhO0FBRTlCLFNBQVMsb0JBQW9CO0FBRzdCLE1BQU0sbUJBQW1CLE1BQU07QUFFOUIsMENBQXdDO0FBQUEsRUFFeEMsTUFBTSx5QkFBeUIsYUFBYTtBQUFBLElBRTNDLFNBQVMsS0FBYTtBQUNyQixhQUFPLEtBQUssVUFBVSxHQUFHO0FBQUEsSUFDMUI7QUFBQSxJQUVBLFNBQVMsT0FBaUIsTUFBYyxNQUFNO0FBQzdDLFlBQU0sTUFBTSxlQUFlLEtBQUssSUFBSTtBQUNwQyxXQUFLLGdCQUFnQjtBQUFBLFFBQ3BCLEtBQUs7QUFBQSxRQUNMLFdBQVc7QUFBQSxRQUNYO0FBQUEsUUFDQSxLQUFLO0FBQUEsTUFDTixDQUFDO0FBQ0QsYUFBTyxLQUFLLFVBQVUsR0FBRztBQUFBLElBQzFCO0FBQUEsRUFDRDtBQUVBLE1BQUk7QUFDSixNQUFJO0FBRUosUUFBTSxNQUFNO0FBQ1gsYUFBUyxJQUFJLGlCQUFpQjtBQUM5QixZQUFRLE9BQU8sU0FBUztBQUFBLE1BQ3ZCO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxXQUFTLGlCQUFpQixRQUFnQixNQUFjLFFBQWdCO0FBQ3ZFLFVBQU0sV0FBVyxNQUFNLFdBQVcsTUFBTTtBQUN4QyxXQUFPLFlBQVksU0FBUyxZQUFZLElBQUk7QUFDNUMsV0FBTyxZQUFZLFNBQVMsUUFBUSxNQUFNO0FBQUEsRUFDM0M7QUFFQSxXQUFTLGVBQWUsWUFBb0IsUUFBZ0IsUUFBZ0I7QUFDM0UsVUFBTSxTQUFTLE1BQU0sU0FBUyxFQUFFLFlBQVksT0FBTyxDQUFDO0FBQ3BELFdBQU8sWUFBWSxRQUFRLE1BQU07QUFBQSxFQUNsQztBQUVBLE9BQUsseUJBQXlCLE1BQU07QUFDbkMsbUJBQWUsR0FBRyxHQUFHLENBQUM7QUFDdEIsbUJBQWUsR0FBRyxHQUFHLENBQUM7QUFDdEIsbUJBQWUsR0FBRyxJQUFJLEVBQUU7QUFDeEIsbUJBQWUsR0FBRyxHQUFHLEVBQUU7QUFDdkIsbUJBQWUsR0FBRyxHQUFHLEVBQUU7QUFDdkIsbUJBQWUsR0FBRyxHQUFHLEVBQUU7QUFDdkIsbUJBQWUsR0FBRyxJQUFJLEVBQUU7QUFDeEIsbUJBQWUsR0FBRyxJQUFJLEVBQUU7QUFDeEIsbUJBQWUsR0FBRyxPQUFPLFdBQVcsRUFBRTtBQUN0QyxtQkFBZSxHQUFHLElBQUksRUFBRTtBQUN4QixtQkFBZSxPQUFPLFdBQVcsSUFBSSxFQUFFO0FBQ3ZDLG1CQUFlLE9BQU8sV0FBVyxPQUFPLFdBQVcsRUFBRTtBQUFBLEVBQ3RELENBQUM7QUFFRCxPQUFLLDJCQUEyQixNQUFNO0FBQ3JDLHFCQUFpQixHQUFHLEdBQUcsQ0FBQztBQUN4QixxQkFBaUIsT0FBTyxXQUFXLEdBQUcsQ0FBQztBQUN2QyxxQkFBaUIsR0FBRyxHQUFHLENBQUM7QUFDeEIscUJBQWlCLElBQUksR0FBRyxFQUFFO0FBQzFCLHFCQUFpQixJQUFJLEdBQUcsQ0FBQztBQUN6QixxQkFBaUIsSUFBSSxHQUFHLENBQUM7QUFDekIscUJBQWlCLElBQUksR0FBRyxDQUFDO0FBQ3pCLHFCQUFpQixJQUFJLEdBQUcsRUFBRTtBQUMxQixxQkFBaUIsSUFBSSxHQUFHLEVBQUU7QUFDMUIscUJBQWlCLElBQUksR0FBRyxFQUFFO0FBQzFCLHFCQUFpQixPQUFPLFdBQVcsR0FBRyxFQUFFO0FBQUEsRUFDekMsQ0FBQztBQUVELE9BQUssK0NBQStDLFdBQVk7QUFDL0QsVUFBTUEsU0FBUSxPQUFPLFNBQVMsQ0FBQyx3TEFBd0wsQ0FBQztBQUN4TixXQUFPLFlBQVlBLE9BQU0sU0FBUyxFQUFFLFlBQVksR0FBRyxRQUFRLEVBQUUsQ0FBQyxHQUFHLENBQUM7QUFBQSxFQUNuRSxDQUFDO0FBRUQsT0FBSyxlQUFlLE1BQU07QUFFekIsV0FBTyxPQUFPLHlCQUF5QixNQUFNLElBQUksU0FBUyxHQUFHLENBQUMsRUFBRSxNQUFNLG9CQUFvQixPQUFPLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEtBQUssRUFBRSxLQUFLLFdBQVM7QUFDaEosYUFBTyxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBQ2xDLFlBQU0sQ0FBQyxLQUFLLElBQUk7QUFDaEIsYUFBTyxZQUFZLE1BQU0sTUFBTSxHQUFHO0FBQ2xDLGFBQU8sZ0JBQWdCLE1BQU0sT0FBTyxFQUFFLGlCQUFpQixHQUFHLGFBQWEsSUFBSSxlQUFlLEdBQUcsV0FBVyxHQUFHLENBQUM7QUFBQSxJQUM3RyxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxxQ0FBcUMsaUJBQWtCO0FBRTNELFVBQU1BLFNBQVEsT0FBTyxTQUFTO0FBQUEsTUFDN0I7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxHQUFHLElBQUk7QUFHUCxVQUFNLFdBQVcsTUFBTSxPQUFPLHlCQUF5QkEsT0FBTSxJQUFJLFNBQVMsR0FBRztBQUFBLE1BQzVFO0FBQUEsUUFDQyxPQUFPLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDM0IsTUFBTTtBQUFBLE1BQ1A7QUFBQSxNQUFHO0FBQUEsUUFDRixPQUFPLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDM0IsTUFBTTtBQUFBLE1BQ1A7QUFBQSxNQUFHO0FBQUEsUUFDRixPQUFPLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDM0IsTUFBTTtBQUFBLE1BQ1A7QUFBQSxNQUFHO0FBQUEsUUFDRixPQUFPLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDM0IsTUFBTTtBQUFBLE1BQ1A7QUFBQSxNQUFHO0FBQUEsUUFDRixPQUFPLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDM0IsTUFBTTtBQUFBLE1BQ1A7QUFBQSxJQUNELEdBQUcsS0FBSztBQUVSLFdBQU8sWUFBWSxTQUFTLFFBQVEsQ0FBQztBQUNyQyxXQUFPLFlBQVksU0FBUyxDQUFDLEVBQUUsTUFBTSxHQUFHO0FBQ3hDLFdBQU8sWUFBWSxTQUFTLENBQUMsRUFBRSxNQUFNLEdBQUc7QUFBQSxFQUN6QyxDQUFDO0FBRUQsT0FBSyxrREFBa0QsV0FBWTtBQUVsRSxVQUFNQSxTQUFRLE9BQU8sU0FBUztBQUFBLE1BQzdCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEdBQUcsSUFBSTtBQUVQLFdBQU8sT0FBTyx5QkFBeUJBLE9BQU0sSUFBSSxTQUFTLEdBQUcsQ0FBQyxFQUFFLE1BQU0sb0JBQXFCLE9BQU8sSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxFQUFFLEtBQUssV0FBUztBQUNoSixhQUFPLFlBQVksTUFBTSxRQUFRLENBQUM7QUFBQSxJQUNuQyxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyx1REFBdUQsV0FBWTtBQUV2RSxVQUFNQSxTQUFRLE9BQU8sU0FBUztBQUFBLE1BQzdCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEdBQUcsSUFBSTtBQUVQLFdBQU8sT0FBTyx5QkFBeUJBLE9BQU0sSUFBSSxTQUFTLEdBQUcsQ0FBQyxFQUFFLE1BQU0sb0JBQXFCLE9BQU8sSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxFQUFFLEtBQUssV0FBUztBQUNoSixhQUFPLFlBQVksTUFBTSxRQUFRLENBQUM7QUFDbEMsWUFBTSxDQUFDLEtBQUssSUFBSTtBQUNoQixhQUFPLFlBQVksTUFBTSxNQUFNLEdBQUc7QUFDbEMsYUFBTyxnQkFBZ0IsTUFBTSxPQUFPLEVBQUUsaUJBQWlCLEdBQUcsYUFBYSxHQUFHLGVBQWUsR0FBRyxXQUFXLEVBQUUsQ0FBQztBQUFBLElBQzNHLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDJEQUEyRCxXQUFZO0FBRTNFLFVBQU1BLFNBQVEsT0FBTyxTQUFTO0FBQUEsTUFDN0I7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLElBQ0QsQ0FBQztBQUVELFdBQU8sT0FBTyx5QkFBeUJBLE9BQU0sSUFBSSxTQUFTLEdBQUcsQ0FBQyxFQUFFLE1BQU0sTUFBTSxPQUFPLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxHQUFJLEVBQUUsQ0FBQyxHQUFHLEtBQUssRUFBRSxLQUFLLFdBQVM7QUFDcEksYUFBTyxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBQ2xDLFlBQU0sQ0FBQyxLQUFLLElBQUk7QUFDaEIsYUFBTyxZQUFZLE1BQU0sTUFBTSxJQUFJO0FBQ25DLGFBQU8sZ0JBQWdCLE1BQU0sT0FBTyxFQUFFLGlCQUFpQixHQUFHLGFBQWEsR0FBRyxlQUFlLEdBQUcsV0FBVyxFQUFFLENBQUM7QUFBQSxJQUMzRyxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsaUJBQWUsVUFBVSxPQUFpQixPQUFxQztBQUM5RSxVQUFNQSxTQUFRLE9BQU8sU0FBUyxLQUFLO0FBRW5DLFVBQU0sZUFBZSxNQUFNLE9BQU87QUFBQSxNQUNqQ0EsT0FBTSxJQUFJLFNBQVM7QUFBQSxNQUNuQjtBQUFBLE1BQ0EsRUFBRSxzQkFBc0IsT0FBTyxzQkFBc0IsR0FBRyxjQUFjLE1BQU07QUFBQSxJQUM3RTtBQUVBLFVBQU0sS0FBSyxXQUFXQSxPQUFNLFNBQVMsR0FBRyxLQUFLO0FBQzdDLFVBQU0sS0FBSyxXQUFXQSxPQUFNLFNBQVMsR0FBRyxZQUFZO0FBQ3BELFdBQU8sZ0JBQWdCLElBQUksRUFBRTtBQUU3QixXQUFPLGFBQWEsSUFBSSxRQUFNLEVBQUUsT0FBTyxNQUFNLEtBQUssRUFBRSxLQUFLLEVBQUUsU0FBUyxHQUFHLE1BQU0sRUFBRSxLQUFLLEVBQUU7QUFBQSxFQUN2RjtBQUdBLE9BQUssOEJBQThCLFlBQVk7QUFDOUMsV0FBTztBQUFBLE1BQ04sTUFBTTtBQUFBLFFBQ0w7QUFBQSxVQUNDO0FBQUEsUUFDRDtBQUFBLFFBQ0EsQ0FBQztBQUFBLFVBQ0EsTUFBTTtBQUFBLFVBQ04sT0FBTyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQzVCLENBQUM7QUFBQSxNQUFDO0FBQUEsTUFDRixDQUFDLEVBQUUsT0FBTyxnQkFBZ0IsTUFBTSwwQkFBMEIsQ0FBQztBQUFBLElBQzdEO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyw4QkFBOEIsWUFBWTtBQUM5QyxXQUFPO0FBQUEsTUFDTixNQUFNO0FBQUEsUUFDTDtBQUFBLFVBQ0M7QUFBQSxRQUNEO0FBQUEsUUFDQSxDQUFDO0FBQUEsVUFDQSxNQUFNO0FBQUEsVUFDTixPQUFPLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxPQUFPLGdCQUFnQjtBQUFBLFFBQ2xELENBQUM7QUFBQSxNQUFDO0FBQUEsTUFDRixDQUFDLEVBQUUsT0FBTyxrQkFBa0IsTUFBTSxrQkFBa0IsR0FBRyxFQUFFLE9BQU8sa0JBQWtCLE1BQU0sMEJBQTBCLENBQUM7QUFBQSxJQUNySDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssOEJBQThCLFlBQVk7QUFDOUMsV0FBTztBQUFBLE1BQ04sTUFBTTtBQUFBLFFBQ0w7QUFBQSxVQUNDO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsUUFDRDtBQUFBLFFBQ0EsQ0FBQztBQUFBLFVBQ0EsTUFBTTtBQUFBLFVBQ04sT0FBTyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQzdCLENBQUM7QUFBQSxNQUFDO0FBQUEsTUFDRixDQUFDLEVBQUUsT0FBTyxnQkFBZ0IsTUFBTSw2REFBNkQsQ0FBQztBQUFBLElBQ2hHO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyw4QkFBOEIsWUFBWTtBQUM5QyxXQUFPO0FBQUEsTUFDTixNQUFNO0FBQUEsUUFDTDtBQUFBLFVBQ0M7QUFBQSxRQUNEO0FBQUEsUUFDQSxDQUFDO0FBQUEsVUFDQSxNQUFNO0FBQUEsVUFDTixPQUFPLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxPQUFPLGdCQUFnQjtBQUFBLFFBQ2xELENBQUM7QUFBQSxNQUFDO0FBQUEsTUFDRixDQUFDLEVBQUUsT0FBTyxrQkFBa0IsTUFBTSxNQUFNLENBQUM7QUFBQSxJQUMzQztBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssb0dBQW9HLGlCQUFrQjtBQUMxSCxVQUFNO0FBQUEsTUFBVyw2NEVBQTg0RSxNQUFNLElBQUk7QUFBQSxNQUN4NkUsQ0FBQztBQUFBLFFBQ0EsT0FBTyxFQUFFLGlCQUFpQixHQUFHLGFBQWEsR0FBRyxlQUFlLElBQUksV0FBVyxFQUFFO0FBQUEsUUFDN0UsTUFBTTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BQ1AsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDhDQUE4QyxXQUFZO0FBRTlELFVBQU1BLFNBQVEsT0FBTyxTQUFTO0FBQUEsTUFDN0I7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLElBQ0QsQ0FBQztBQUVELFVBQU0sUUFBUUEsT0FBTSxnQkFBZ0IsRUFBRSxpQkFBaUIsR0FBRyxhQUFhLEdBQUcsZUFBZSxHQUFHLFdBQVcsRUFBRSxDQUFDO0FBQzFHLFdBQU8sWUFBWSxPQUFPLEdBQUc7QUFBQSxFQUM5QixDQUFDO0FBR0QsT0FBSyxnQ0FBZ0MsV0FBWTtBQUVoRCxVQUFNQSxTQUFRLE9BQU8sU0FBUztBQUFBLE1BQzdCO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxJQUNELENBQUM7QUFFRCxXQUFPLE9BQU8sZ0JBQWdCLENBQUNBLE9BQU0sSUFBSSxTQUFTLENBQUMsR0FBRyxLQUFLLFVBQVUsS0FBSyxFQUFFLEtBQUssQ0FBQyxXQUFXO0FBQzVGLFVBQUksQ0FBQyxRQUFRO0FBQ1osZUFBTyxHQUFHLEtBQUs7QUFBQSxNQUNoQjtBQUNBLGFBQU8sWUFBWSxPQUFPLE1BQU0sUUFBUSxDQUFDO0FBQ3pDLGFBQU8sWUFBWSxPQUFPLE9BQU8sVUFBVSxRQUFRO0FBQ25ELGFBQU8sWUFBWSxPQUFPLE1BQU0sQ0FBQyxHQUFHLFFBQVE7QUFBQSxJQUM3QyxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyx3Q0FBd0MsV0FBWTtBQUV4RCxVQUFNQSxTQUFRLE9BQU8sU0FBUztBQUFBLE1BQzdCO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsQ0FBQztBQUVELFVBQU0sUUFBa0IsQ0FBQyxHQUFHQSxPQUFNLE1BQU0sV0FBVyxDQUFDO0FBRXBELFdBQU8sZ0JBQWdCLE9BQU8sQ0FBQyxPQUFPLFFBQVEsT0FBTyxRQUFRLFFBQVEsU0FBUyxVQUFVLE9BQU8sT0FBTyxNQUFNLE9BQU8sTUFBTSxDQUFDO0FBQUEsRUFDM0gsQ0FBQztBQUNGLENBQUM7QUFFRCxTQUFTLFdBQVcsTUFBYyxPQUFrRDtBQUNuRixRQUFNLGNBQWMsSUFBSSwwQkFBMEIsSUFBSTtBQUN0RCxRQUFNLGNBQWMsTUFBTSxJQUFJLE9BQUs7QUFDbEMsVUFBTSxRQUFRLE1BQU0sS0FBSyxFQUFFLEtBQUs7QUFDaEMsV0FBUTtBQUFBLE1BQ1AsYUFBYSxZQUFZLFVBQVUsTUFBTSxpQkFBaUIsQ0FBQztBQUFBLE1BQzNELFdBQVcsWUFBWSxVQUFVLE1BQU0sZUFBZSxDQUFDO0FBQUEsTUFDdkQsTUFBTSxFQUFFO0FBQUEsSUFDVDtBQUFBLEVBQ0QsQ0FBQztBQUVELGNBQVksS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLGNBQWMsRUFBRSxXQUFXO0FBRXhELGFBQVcsUUFBUSxhQUFhO0FBQy9CLFdBQU8sS0FBSyxVQUFVLEdBQUcsS0FBSyxXQUFXLElBQUksS0FBSyxPQUFPLEtBQUssVUFBVSxLQUFLLFNBQVM7QUFBQSxFQUN2RjtBQUVBLFNBQU87QUFDUjtBQUVBLE1BQU0sMEJBQTBCO0FBQUEsRUFHL0IsWUFBNkIsTUFBYztBQUFkO0FBQzVCLFNBQUssMkJBQTJCLENBQUM7QUFDakMsU0FBSyx5QkFBeUIsS0FBSyxDQUFDO0FBQ3BDLGFBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxRQUFRLEtBQUs7QUFDckMsVUFBSSxLQUFLLE9BQU8sQ0FBQyxNQUFNLE1BQU07QUFDNUIsYUFBSyx5QkFBeUIsS0FBSyxJQUFJLENBQUM7QUFBQSxNQUN6QztBQUFBLElBQ0Q7QUFDQSxTQUFLLHlCQUF5QixLQUFLLEtBQUssU0FBUyxDQUFDO0FBQUEsRUFDbkQ7QUFBQSxFQUVBLFVBQVUsVUFBNEI7QUFDckMsVUFBTSxnQkFBZ0IsU0FBUyxjQUFjLEtBQUsseUJBQXlCLFNBQVMsS0FBSyxLQUFLLFNBQVUsS0FBSyx5QkFBeUIsU0FBUyxVQUFVLElBQUk7QUFDN0osV0FBTyxLQUFLLElBQUksS0FBSyx5QkFBeUIsU0FBUyxhQUFhLENBQUMsSUFBSSxTQUFTLFNBQVMsR0FBRyxhQUFhO0FBQUEsRUFDNUc7QUFDRDsiLAogICJuYW1lcyI6IFsibW9kZWwiXQp9Cg==
