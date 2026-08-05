import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { TextLength } from "../../../../../editor/common/core/textLength.js";
import { DocumentRangeMap, RangeMapping } from "../../browser/model/mapping.js";
suite("merge editor mapping", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("DocumentRangeMap", () => {
    const documentMap = createDocumentRangeMap([
      "1:3",
      ["0:2", "0:3"],
      "1:1",
      ["1:2", "3:3"],
      "0:2",
      ["0:2", "0:3"]
    ]);
    test("map", () => assert.deepStrictEqual(documentMap.rangeMappings.map((m) => m.toString()), [
      "[2:4, 2:6) -> [2:4, 2:7)",
      "[3:2, 4:3) -> [3:2, 6:4)",
      "[4:5, 4:7) -> [6:6, 6:9)"
    ]));
    function f() {
      return documentMap.project(parsePos(this.test.title)).toString();
    }
    test("1:1", function() {
      assert.deepStrictEqual(f.apply(this), "[1:1, 1:1) -> [1:1, 1:1)");
    });
    test("2:3", function() {
      assert.deepStrictEqual(f.apply(this), "[2:3, 2:3) -> [2:3, 2:3)");
    });
    test("2:4", function() {
      assert.deepStrictEqual(f.apply(this), "[2:4, 2:6) -> [2:4, 2:7)");
    });
    test("2:5", function() {
      assert.deepStrictEqual(f.apply(this), "[2:4, 2:6) -> [2:4, 2:7)");
    });
    test("2:6", function() {
      assert.deepStrictEqual(f.apply(this), "[2:6, 2:6) -> [2:7, 2:7)");
    });
    test("2:7", function() {
      assert.deepStrictEqual(f.apply(this), "[2:7, 2:7) -> [2:8, 2:8)");
    });
    test("3:1", function() {
      assert.deepStrictEqual(f.apply(this), "[3:1, 3:1) -> [3:1, 3:1)");
    });
    test("3:2", function() {
      assert.deepStrictEqual(f.apply(this), "[3:2, 4:3) -> [3:2, 6:4)");
    });
    test("4:2", function() {
      assert.deepStrictEqual(f.apply(this), "[3:2, 4:3) -> [3:2, 6:4)");
    });
    test("4:3", function() {
      assert.deepStrictEqual(f.apply(this), "[4:3, 4:3) -> [6:4, 6:4)");
    });
    test("4:4", function() {
      assert.deepStrictEqual(f.apply(this), "[4:4, 4:4) -> [6:5, 6:5)");
    });
    test("4:5", function() {
      assert.deepStrictEqual(f.apply(this), "[4:5, 4:7) -> [6:6, 6:9)");
    });
  });
});
function parsePos(str) {
  const [lineCount, columnCount] = str.split(":");
  return new Position(parseInt(lineCount, 10), parseInt(columnCount, 10));
}
function parseLengthObj(str) {
  const [lineCount, columnCount] = str.split(":");
  return new TextLength(parseInt(lineCount, 10), parseInt(columnCount, 10));
}
function toPosition(length) {
  return new Position(length.lineCount + 1, length.columnCount + 1);
}
function createDocumentRangeMap(items) {
  const mappings = [];
  let lastLen1 = new TextLength(0, 0);
  let lastLen2 = new TextLength(0, 0);
  for (const item of items) {
    if (typeof item === "string") {
      const len = parseLengthObj(item);
      lastLen1 = lastLen1.add(len);
      lastLen2 = lastLen2.add(len);
    } else {
      const len1 = parseLengthObj(item[0]);
      const len2 = parseLengthObj(item[1]);
      mappings.push(new RangeMapping(
        Range.fromPositions(toPosition(lastLen1), toPosition(lastLen1.add(len1))),
        Range.fromPositions(toPosition(lastLen2), toPosition(lastLen2.add(len2)))
      ));
      lastLen1 = lastLen1.add(len1);
      lastLen2 = lastLen2.add(len2);
    }
  }
  return new DocumentRangeMap(mappings, lastLen1.lineCount);
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci90ZXN0L2Jyb3dzZXIvbWFwcGluZy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBUZXh0TGVuZ3RoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3RleHRMZW5ndGguanMnO1xuaW1wb3J0IHsgRG9jdW1lbnRSYW5nZU1hcCwgUmFuZ2VNYXBwaW5nIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9tb2RlbC9tYXBwaW5nLmpzJztcblxuc3VpdGUoJ21lcmdlIGVkaXRvciBtYXBwaW5nJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRzdWl0ZSgnRG9jdW1lbnRSYW5nZU1hcCcsICgpID0+IHtcblx0XHRjb25zdCBkb2N1bWVudE1hcCA9IGNyZWF0ZURvY3VtZW50UmFuZ2VNYXAoW1xuXHRcdFx0JzE6MycsXG5cdFx0XHRbJzA6MicsICcwOjMnXSxcblx0XHRcdCcxOjEnLFxuXHRcdFx0WycxOjInLCAnMzozJ10sXG5cdFx0XHQnMDoyJyxcblx0XHRcdFsnMDoyJywgJzA6MyddLFxuXHRcdF0pO1xuXG5cdFx0dGVzdCgnbWFwJywgKCkgPT4gYXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChkb2N1bWVudE1hcC5yYW5nZU1hcHBpbmdzLm1hcChtID0+IG0udG9TdHJpbmcoKSksIFtcblx0XHRcdCdbMjo0LCAyOjYpIC0+IFsyOjQsIDI6NyknLFxuXHRcdFx0J1szOjIsIDQ6MykgLT4gWzM6MiwgNjo0KScsXG5cdFx0XHQnWzQ6NSwgNDo3KSAtPiBbNjo2LCA2OjkpJ1xuXHRcdF0pKTtcblxuXHRcdGZ1bmN0aW9uIGYodGhpczogTW9jaGEuQ29udGV4dCkge1xuXHRcdFx0cmV0dXJuIGRvY3VtZW50TWFwLnByb2plY3QocGFyc2VQb3ModGhpcy50ZXN0IS50aXRsZSkpLnRvU3RyaW5nKCk7XG5cdFx0fVxuXG5cdFx0dGVzdCgnMToxJywgZnVuY3Rpb24gKCkgeyBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGYuYXBwbHkodGhpcyksICdbMToxLCAxOjEpIC0+IFsxOjEsIDE6MSknKTsgfSk7XG5cdFx0dGVzdCgnMjozJywgZnVuY3Rpb24gKCkgeyBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGYuYXBwbHkodGhpcyksICdbMjozLCAyOjMpIC0+IFsyOjMsIDI6MyknKTsgfSk7XG5cdFx0dGVzdCgnMjo0JywgZnVuY3Rpb24gKCkgeyBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGYuYXBwbHkodGhpcyksICdbMjo0LCAyOjYpIC0+IFsyOjQsIDI6NyknKTsgfSk7XG5cdFx0dGVzdCgnMjo1JywgZnVuY3Rpb24gKCkgeyBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGYuYXBwbHkodGhpcyksICdbMjo0LCAyOjYpIC0+IFsyOjQsIDI6NyknKTsgfSk7XG5cdFx0dGVzdCgnMjo2JywgZnVuY3Rpb24gKCkgeyBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGYuYXBwbHkodGhpcyksICdbMjo2LCAyOjYpIC0+IFsyOjcsIDI6NyknKTsgfSk7XG5cdFx0dGVzdCgnMjo3JywgZnVuY3Rpb24gKCkgeyBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGYuYXBwbHkodGhpcyksICdbMjo3LCAyOjcpIC0+IFsyOjgsIDI6OCknKTsgfSk7XG5cdFx0dGVzdCgnMzoxJywgZnVuY3Rpb24gKCkgeyBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGYuYXBwbHkodGhpcyksICdbMzoxLCAzOjEpIC0+IFszOjEsIDM6MSknKTsgfSk7XG5cdFx0dGVzdCgnMzoyJywgZnVuY3Rpb24gKCkgeyBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGYuYXBwbHkodGhpcyksICdbMzoyLCA0OjMpIC0+IFszOjIsIDY6NCknKTsgfSk7XG5cdFx0dGVzdCgnNDoyJywgZnVuY3Rpb24gKCkgeyBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGYuYXBwbHkodGhpcyksICdbMzoyLCA0OjMpIC0+IFszOjIsIDY6NCknKTsgfSk7XG5cdFx0dGVzdCgnNDozJywgZnVuY3Rpb24gKCkgeyBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGYuYXBwbHkodGhpcyksICdbNDozLCA0OjMpIC0+IFs2OjQsIDY6NCknKTsgfSk7XG5cdFx0dGVzdCgnNDo0JywgZnVuY3Rpb24gKCkgeyBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGYuYXBwbHkodGhpcyksICdbNDo0LCA0OjQpIC0+IFs2OjUsIDY6NSknKTsgfSk7XG5cdFx0dGVzdCgnNDo1JywgZnVuY3Rpb24gKCkgeyBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGYuYXBwbHkodGhpcyksICdbNDo1LCA0OjcpIC0+IFs2OjYsIDY6OSknKTsgfSk7XG5cdH0pO1xufSk7XG5cbmZ1bmN0aW9uIHBhcnNlUG9zKHN0cjogc3RyaW5nKTogUG9zaXRpb24ge1xuXHRjb25zdCBbbGluZUNvdW50LCBjb2x1bW5Db3VudF0gPSBzdHIuc3BsaXQoJzonKTtcblx0cmV0dXJuIG5ldyBQb3NpdGlvbihwYXJzZUludChsaW5lQ291bnQsIDEwKSwgcGFyc2VJbnQoY29sdW1uQ291bnQsIDEwKSk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlTGVuZ3RoT2JqKHN0cjogc3RyaW5nKTogVGV4dExlbmd0aCB7XG5cdGNvbnN0IFtsaW5lQ291bnQsIGNvbHVtbkNvdW50XSA9IHN0ci5zcGxpdCgnOicpO1xuXHRyZXR1cm4gbmV3IFRleHRMZW5ndGgocGFyc2VJbnQobGluZUNvdW50LCAxMCksIHBhcnNlSW50KGNvbHVtbkNvdW50LCAxMCkpO1xufVxuXG5mdW5jdGlvbiB0b1Bvc2l0aW9uKGxlbmd0aDogVGV4dExlbmd0aCk6IFBvc2l0aW9uIHtcblx0cmV0dXJuIG5ldyBQb3NpdGlvbihsZW5ndGgubGluZUNvdW50ICsgMSwgbGVuZ3RoLmNvbHVtbkNvdW50ICsgMSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZURvY3VtZW50UmFuZ2VNYXAoaXRlbXM6IChbc3RyaW5nLCBzdHJpbmddIHwgc3RyaW5nKVtdKSB7XG5cdGNvbnN0IG1hcHBpbmdzOiBSYW5nZU1hcHBpbmdbXSA9IFtdO1xuXHRsZXQgbGFzdExlbjEgPSBuZXcgVGV4dExlbmd0aCgwLCAwKTtcblx0bGV0IGxhc3RMZW4yID0gbmV3IFRleHRMZW5ndGgoMCwgMCk7XG5cdGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuXHRcdGlmICh0eXBlb2YgaXRlbSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGNvbnN0IGxlbiA9IHBhcnNlTGVuZ3RoT2JqKGl0ZW0pO1xuXHRcdFx0bGFzdExlbjEgPSBsYXN0TGVuMS5hZGQobGVuKTtcblx0XHRcdGxhc3RMZW4yID0gbGFzdExlbjIuYWRkKGxlbik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGxlbjEgPSBwYXJzZUxlbmd0aE9iaihpdGVtWzBdKTtcblx0XHRcdGNvbnN0IGxlbjIgPSBwYXJzZUxlbmd0aE9iaihpdGVtWzFdKTtcblx0XHRcdG1hcHBpbmdzLnB1c2gobmV3IFJhbmdlTWFwcGluZyhcblx0XHRcdFx0UmFuZ2UuZnJvbVBvc2l0aW9ucyh0b1Bvc2l0aW9uKGxhc3RMZW4xKSwgdG9Qb3NpdGlvbihsYXN0TGVuMS5hZGQobGVuMSkpKSxcblx0XHRcdFx0UmFuZ2UuZnJvbVBvc2l0aW9ucyh0b1Bvc2l0aW9uKGxhc3RMZW4yKSwgdG9Qb3NpdGlvbihsYXN0TGVuMi5hZGQobGVuMikpKSxcblx0XHRcdCkpO1xuXHRcdFx0bGFzdExlbjEgPSBsYXN0TGVuMS5hZGQobGVuMSk7XG5cdFx0XHRsYXN0TGVuMiA9IGxhc3RMZW4yLmFkZChsZW4yKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gbmV3IERvY3VtZW50UmFuZ2VNYXAobWFwcGluZ3MsIGxhc3RMZW4xLmxpbmVDb3VudCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsa0JBQWtCLG9CQUFvQjtBQUUvQyxNQUFNLHdCQUF3QixNQUFNO0FBQ25DLDBDQUF3QztBQUV4QyxRQUFNLG9CQUFvQixNQUFNO0FBQy9CLFVBQU0sY0FBYyx1QkFBdUI7QUFBQSxNQUMxQztBQUFBLE1BQ0EsQ0FBQyxPQUFPLEtBQUs7QUFBQSxNQUNiO0FBQUEsTUFDQSxDQUFDLE9BQU8sS0FBSztBQUFBLE1BQ2I7QUFBQSxNQUNBLENBQUMsT0FBTyxLQUFLO0FBQUEsSUFDZCxDQUFDO0FB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
