import assert from "assert";
import { consolidate, groupIntersect, RangeMap } from "../../../../browser/ui/list/rangeMap.js";
import { Range } from "../../../../common/range.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../common/utils.js";
suite("RangeMap", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("intersection", () => {
    assert.deepStrictEqual(Range.intersect({ start: 0, end: 0 }, { start: 0, end: 0 }), { start: 0, end: 0 });
    assert.deepStrictEqual(Range.intersect({ start: 0, end: 0 }, { start: 5, end: 5 }), { start: 0, end: 0 });
    assert.deepStrictEqual(Range.intersect({ start: 0, end: 1 }, { start: 5, end: 6 }), { start: 0, end: 0 });
    assert.deepStrictEqual(Range.intersect({ start: 5, end: 6 }, { start: 0, end: 1 }), { start: 0, end: 0 });
    assert.deepStrictEqual(Range.intersect({ start: 0, end: 5 }, { start: 2, end: 2 }), { start: 0, end: 0 });
    assert.deepStrictEqual(Range.intersect({ start: 0, end: 1 }, { start: 0, end: 1 }), { start: 0, end: 1 });
    assert.deepStrictEqual(Range.intersect({ start: 0, end: 10 }, { start: 0, end: 5 }), { start: 0, end: 5 });
    assert.deepStrictEqual(Range.intersect({ start: 0, end: 5 }, { start: 0, end: 10 }), { start: 0, end: 5 });
    assert.deepStrictEqual(Range.intersect({ start: 0, end: 10 }, { start: 5, end: 10 }), { start: 5, end: 10 });
    assert.deepStrictEqual(Range.intersect({ start: 5, end: 10 }, { start: 0, end: 10 }), { start: 5, end: 10 });
    assert.deepStrictEqual(Range.intersect({ start: 0, end: 10 }, { start: 2, end: 8 }), { start: 2, end: 8 });
    assert.deepStrictEqual(Range.intersect({ start: 2, end: 8 }, { start: 0, end: 10 }), { start: 2, end: 8 });
    assert.deepStrictEqual(Range.intersect({ start: 0, end: 10 }, { start: 5, end: 15 }), { start: 5, end: 10 });
    assert.deepStrictEqual(Range.intersect({ start: 5, end: 15 }, { start: 0, end: 10 }), { start: 5, end: 10 });
  });
  test("multiIntersect", () => {
    assert.deepStrictEqual(
      groupIntersect(
        { start: 0, end: 0 },
        [{ range: { start: 0, end: 10 }, size: 1 }]
      ),
      []
    );
    assert.deepStrictEqual(
      groupIntersect(
        { start: 10, end: 20 },
        [{ range: { start: 0, end: 10 }, size: 1 }]
      ),
      []
    );
    assert.deepStrictEqual(
      groupIntersect(
        { start: 2, end: 8 },
        [{ range: { start: 0, end: 10 }, size: 1 }]
      ),
      [{ range: { start: 2, end: 8 }, size: 1 }]
    );
    assert.deepStrictEqual(
      groupIntersect(
        { start: 2, end: 8 },
        [{ range: { start: 0, end: 10 }, size: 1 }, { range: { start: 10, end: 20 }, size: 5 }]
      ),
      [{ range: { start: 2, end: 8 }, size: 1 }]
    );
    assert.deepStrictEqual(
      groupIntersect(
        { start: 12, end: 18 },
        [{ range: { start: 0, end: 10 }, size: 1 }, { range: { start: 10, end: 20 }, size: 5 }]
      ),
      [{ range: { start: 12, end: 18 }, size: 5 }]
    );
    assert.deepStrictEqual(
      groupIntersect(
        { start: 2, end: 18 },
        [{ range: { start: 0, end: 10 }, size: 1 }, { range: { start: 10, end: 20 }, size: 5 }]
      ),
      [{ range: { start: 2, end: 10 }, size: 1 }, { range: { start: 10, end: 18 }, size: 5 }]
    );
    assert.deepStrictEqual(
      groupIntersect(
        { start: 2, end: 28 },
        [{ range: { start: 0, end: 10 }, size: 1 }, { range: { start: 10, end: 20 }, size: 5 }, { range: { start: 20, end: 30 }, size: 10 }]
      ),
      [{ range: { start: 2, end: 10 }, size: 1 }, { range: { start: 10, end: 20 }, size: 5 }, { range: { start: 20, end: 28 }, size: 10 }]
    );
  });
  test("consolidate", () => {
    assert.deepStrictEqual(consolidate([]), []);
    assert.deepStrictEqual(
      consolidate([{ range: { start: 0, end: 10 }, size: 1 }]),
      [{ range: { start: 0, end: 10 }, size: 1 }]
    );
    assert.deepStrictEqual(
      consolidate([
        { range: { start: 0, end: 10 }, size: 1 },
        { range: { start: 10, end: 20 }, size: 1 }
      ]),
      [{ range: { start: 0, end: 20 }, size: 1 }]
    );
    assert.deepStrictEqual(
      consolidate([
        { range: { start: 0, end: 10 }, size: 1 },
        { range: { start: 10, end: 20 }, size: 1 },
        { range: { start: 20, end: 100 }, size: 1 }
      ]),
      [{ range: { start: 0, end: 100 }, size: 1 }]
    );
    assert.deepStrictEqual(
      consolidate([
        { range: { start: 0, end: 10 }, size: 1 },
        { range: { start: 10, end: 20 }, size: 5 },
        { range: { start: 20, end: 30 }, size: 10 }
      ]),
      [
        { range: { start: 0, end: 10 }, size: 1 },
        { range: { start: 10, end: 20 }, size: 5 },
        { range: { start: 20, end: 30 }, size: 10 }
      ]
    );
    assert.deepStrictEqual(
      consolidate([
        { range: { start: 0, end: 10 }, size: 1 },
        { range: { start: 10, end: 20 }, size: 2 },
        { range: { start: 20, end: 100 }, size: 2 }
      ]),
      [
        { range: { start: 0, end: 10 }, size: 1 },
        { range: { start: 10, end: 100 }, size: 2 }
      ]
    );
  });
  test("empty", () => {
    const rangeMap = new RangeMap();
    assert.strictEqual(rangeMap.size, 0);
    assert.strictEqual(rangeMap.count, 0);
  });
  const one = { size: 1 };
  const two = { size: 2 };
  const three = { size: 3 };
  const five = { size: 5 };
  const ten = { size: 10 };
  test("length & count", () => {
    const rangeMap = new RangeMap();
    rangeMap.splice(0, 0, [one]);
    assert.strictEqual(rangeMap.size, 1);
    assert.strictEqual(rangeMap.count, 1);
  });
  test("length & count #2", () => {
    const rangeMap = new RangeMap();
    rangeMap.splice(0, 0, [one, one, one, one, one]);
    assert.strictEqual(rangeMap.size, 5);
    assert.strictEqual(rangeMap.count, 5);
  });
  test("length & count #3", () => {
    const rangeMap = new RangeMap();
    rangeMap.splice(0, 0, [five]);
    assert.strictEqual(rangeMap.size, 5);
    assert.strictEqual(rangeMap.count, 1);
  });
  test("length & count #4", () => {
    const rangeMap = new RangeMap();
    rangeMap.splice(0, 0, [five, five, five, five, five]);
    assert.strictEqual(rangeMap.size, 25);
    assert.strictEqual(rangeMap.count, 5);
  });
  test("insert", () => {
    const rangeMap = new RangeMap();
    rangeMap.splice(0, 0, [five, five, five, five, five]);
    assert.strictEqual(rangeMap.size, 25);
    assert.strictEqual(rangeMap.count, 5);
    rangeMap.splice(0, 0, [five, five, five, five, five]);
    assert.strictEqual(rangeMap.size, 50);
    assert.strictEqual(rangeMap.count, 10);
    rangeMap.splice(5, 0, [ten, ten]);
    assert.strictEqual(rangeMap.size, 70);
    assert.strictEqual(rangeMap.count, 12);
    rangeMap.splice(12, 0, [{ size: 200 }]);
    assert.strictEqual(rangeMap.size, 270);
    assert.strictEqual(rangeMap.count, 13);
  });
  test("delete", () => {
    const rangeMap = new RangeMap();
    rangeMap.splice(0, 0, [
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five
    ]);
    assert.strictEqual(rangeMap.size, 100);
    assert.strictEqual(rangeMap.count, 20);
    rangeMap.splice(10, 5);
    assert.strictEqual(rangeMap.size, 75);
    assert.strictEqual(rangeMap.count, 15);
    rangeMap.splice(0, 1);
    assert.strictEqual(rangeMap.size, 70);
    assert.strictEqual(rangeMap.count, 14);
    rangeMap.splice(1, 13);
    assert.strictEqual(rangeMap.size, 5);
    assert.strictEqual(rangeMap.count, 1);
    rangeMap.splice(1, 1);
    assert.strictEqual(rangeMap.size, 5);
    assert.strictEqual(rangeMap.count, 1);
  });
  test("insert & delete", () => {
    const rangeMap = new RangeMap();
    assert.strictEqual(rangeMap.size, 0);
    assert.strictEqual(rangeMap.count, 0);
    rangeMap.splice(0, 0, [one]);
    assert.strictEqual(rangeMap.size, 1);
    assert.strictEqual(rangeMap.count, 1);
    rangeMap.splice(0, 1);
    assert.strictEqual(rangeMap.size, 0);
    assert.strictEqual(rangeMap.count, 0);
  });
  test("insert & delete #2", () => {
    const rangeMap = new RangeMap();
    rangeMap.splice(0, 0, [
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one
    ]);
    rangeMap.splice(2, 6);
    assert.strictEqual(rangeMap.count, 4);
    assert.strictEqual(rangeMap.size, 4);
  });
  test("insert & delete #3", () => {
    const rangeMap = new RangeMap();
    rangeMap.splice(0, 0, [
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      two,
      two,
      two,
      two,
      two,
      two,
      two,
      two,
      two,
      two
    ]);
    rangeMap.splice(8, 4);
    assert.strictEqual(rangeMap.count, 16);
    assert.strictEqual(rangeMap.size, 24);
  });
  test("insert & delete #4", () => {
    const rangeMap = new RangeMap();
    rangeMap.splice(0, 0, [
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      two,
      two,
      two,
      two,
      two,
      two,
      two,
      two,
      two,
      two
    ]);
    rangeMap.splice(5, 0, [three, three, three, three, three]);
    assert.strictEqual(rangeMap.count, 25);
    assert.strictEqual(rangeMap.size, 45);
    rangeMap.splice(4, 7);
    assert.strictEqual(rangeMap.count, 18);
    assert.strictEqual(rangeMap.size, 28);
  });
  suite("indexAt, positionAt", () => {
    test("empty", () => {
      const rangeMap = new RangeMap();
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(10), 0);
      assert.strictEqual(rangeMap.indexAt(-1), -1);
      assert.strictEqual(rangeMap.positionAt(0), -1);
      assert.strictEqual(rangeMap.positionAt(10), -1);
      assert.strictEqual(rangeMap.positionAt(-1), -1);
    });
    test("simple", () => {
      const rangeMap = new RangeMap();
      rangeMap.splice(0, 0, [one]);
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(1), 1);
      assert.strictEqual(rangeMap.positionAt(0), 0);
      assert.strictEqual(rangeMap.positionAt(1), -1);
    });
    test("simple #2", () => {
      const rangeMap = new RangeMap();
      rangeMap.splice(0, 0, [ten]);
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(5), 0);
      assert.strictEqual(rangeMap.indexAt(9), 0);
      assert.strictEqual(rangeMap.indexAt(10), 1);
      assert.strictEqual(rangeMap.positionAt(0), 0);
      assert.strictEqual(rangeMap.positionAt(1), -1);
    });
    test("insert", () => {
      const rangeMap = new RangeMap();
      rangeMap.splice(0, 0, [one, one, one, one, one, one, one, one, one, one]);
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(1), 1);
      assert.strictEqual(rangeMap.indexAt(5), 5);
      assert.strictEqual(rangeMap.indexAt(9), 9);
      assert.strictEqual(rangeMap.indexAt(10), 10);
      assert.strictEqual(rangeMap.indexAt(11), 10);
      rangeMap.splice(10, 0, [one, one, one, one, one, one, one, one, one, one]);
      assert.strictEqual(rangeMap.indexAt(10), 10);
      assert.strictEqual(rangeMap.indexAt(19), 19);
      assert.strictEqual(rangeMap.indexAt(20), 20);
      assert.strictEqual(rangeMap.indexAt(21), 20);
      assert.strictEqual(rangeMap.positionAt(0), 0);
      assert.strictEqual(rangeMap.positionAt(1), 1);
      assert.strictEqual(rangeMap.positionAt(19), 19);
      assert.strictEqual(rangeMap.positionAt(20), -1);
    });
    test("delete", () => {
      const rangeMap = new RangeMap();
      rangeMap.splice(0, 0, [one, one, one, one, one, one, one, one, one, one]);
      rangeMap.splice(2, 6);
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(1), 1);
      assert.strictEqual(rangeMap.indexAt(3), 3);
      assert.strictEqual(rangeMap.indexAt(4), 4);
      assert.strictEqual(rangeMap.indexAt(5), 4);
      assert.strictEqual(rangeMap.positionAt(0), 0);
      assert.strictEqual(rangeMap.positionAt(1), 1);
      assert.strictEqual(rangeMap.positionAt(3), 3);
      assert.strictEqual(rangeMap.positionAt(4), -1);
    });
    test("delete #2", () => {
      const rangeMap = new RangeMap();
      rangeMap.splice(0, 0, [ten, ten, ten, ten, ten, ten, ten, ten, ten, ten]);
      rangeMap.splice(2, 6);
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(1), 0);
      assert.strictEqual(rangeMap.indexAt(30), 3);
      assert.strictEqual(rangeMap.indexAt(40), 4);
      assert.strictEqual(rangeMap.indexAt(50), 4);
      assert.strictEqual(rangeMap.positionAt(0), 0);
      assert.strictEqual(rangeMap.positionAt(1), 10);
      assert.strictEqual(rangeMap.positionAt(2), 20);
      assert.strictEqual(rangeMap.positionAt(3), 30);
      assert.strictEqual(rangeMap.positionAt(4), -1);
    });
  });
});
suite("RangeMap with top padding", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("empty", () => {
    const rangeMap = new RangeMap(10);
    assert.strictEqual(rangeMap.size, 10);
    assert.strictEqual(rangeMap.count, 0);
  });
  const one = { size: 1 };
  const five = { size: 5 };
  const ten = { size: 10 };
  test("length & count", () => {
    const rangeMap = new RangeMap(10);
    rangeMap.splice(0, 0, [one]);
    assert.strictEqual(rangeMap.size, 11);
    assert.strictEqual(rangeMap.count, 1);
  });
  test("length & count #2", () => {
    const rangeMap = new RangeMap(10);
    rangeMap.splice(0, 0, [one, one, one, one, one]);
    assert.strictEqual(rangeMap.size, 15);
    assert.strictEqual(rangeMap.count, 5);
  });
  test("length & count #3", () => {
    const rangeMap = new RangeMap(10);
    rangeMap.splice(0, 0, [five]);
    assert.strictEqual(rangeMap.size, 15);
    assert.strictEqual(rangeMap.count, 1);
  });
  test("length & count #4", () => {
    const rangeMap = new RangeMap(10);
    rangeMap.splice(0, 0, [five, five, five, five, five]);
    assert.strictEqual(rangeMap.size, 35);
    assert.strictEqual(rangeMap.count, 5);
  });
  test("insert", () => {
    const rangeMap = new RangeMap(10);
    rangeMap.splice(0, 0, [five, five, five, five, five]);
    assert.strictEqual(rangeMap.size, 35);
    assert.strictEqual(rangeMap.count, 5);
    rangeMap.splice(0, 0, [five, five, five, five, five]);
    assert.strictEqual(rangeMap.size, 60);
    assert.strictEqual(rangeMap.count, 10);
    rangeMap.splice(5, 0, [ten, ten]);
    assert.strictEqual(rangeMap.size, 80);
    assert.strictEqual(rangeMap.count, 12);
    rangeMap.splice(12, 0, [{ size: 200 }]);
    assert.strictEqual(rangeMap.size, 280);
    assert.strictEqual(rangeMap.count, 13);
  });
  suite("indexAt, positionAt", () => {
    test("empty", () => {
      const rangeMap = new RangeMap(10);
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(10), 0);
      assert.strictEqual(rangeMap.indexAt(-1), -1);
      assert.strictEqual(rangeMap.positionAt(0), -1);
      assert.strictEqual(rangeMap.positionAt(10), -1);
      assert.strictEqual(rangeMap.positionAt(-1), -1);
    });
    test("simple", () => {
      const rangeMap = new RangeMap(10);
      rangeMap.splice(0, 0, [one]);
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(1), 0);
      assert.strictEqual(rangeMap.indexAt(10), 0);
      assert.strictEqual(rangeMap.indexAt(11), 1);
      assert.strictEqual(rangeMap.positionAt(0), 10);
      assert.strictEqual(rangeMap.positionAt(1), -1);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvYnJvd3Nlci91aS9saXN0L3JhbmdlTWFwLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBjb25zb2xpZGF0ZSwgZ3JvdXBJbnRlcnNlY3QsIFJhbmdlTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci91aS9saXN0L3JhbmdlTWFwLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3JhbmdlLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi91dGlscy5qcyc7XG5cbnN1aXRlKCdSYW5nZU1hcCcsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdpbnRlcnNlY3Rpb24nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChSYW5nZS5pbnRlcnNlY3QoeyBzdGFydDogMCwgZW5kOiAwIH0sIHsgc3RhcnQ6IDAsIGVuZDogMCB9KSwgeyBzdGFydDogMCwgZW5kOiAwIH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoUmFuZ2UuaW50ZXJzZWN0KHsgc3RhcnQ6IDAsIGVuZDogMCB9LCB7IHN0YXJ0OiA1LCBlbmQ6IDUgfSksIHsgc3RhcnQ6IDAsIGVuZDogMCB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFJhbmdlLmludGVyc2VjdCh7IHN0YXJ0OiAwLCBlbmQ6IDEgfSwgeyBzdGFydDogNSwgZW5kOiA2IH0pLCB7IHN0YXJ0OiAwLCBlbmQ6IDAgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChSYW5nZS5pbnRlcnNlY3QoeyBzdGFydDogNSwgZW5kOiA2IH0sIHsgc3RhcnQ6IDAsIGVuZDogMSB9KSwgeyBzdGFydDogMCwgZW5kOiAwIH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoUmFuZ2UuaW50ZXJzZWN0KHsgc3RhcnQ6IDAsIGVuZDogNSB9LCB7IHN0YXJ0OiAyLCBlbmQ6IDIgfSksIHsgc3RhcnQ6IDAsIGVuZDogMCB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFJhbmdlLmludGVyc2VjdCh7IHN0YXJ0OiAwLCBlbmQ6IDEgfSwgeyBzdGFydDogMCwgZW5kOiAxIH0pLCB7IHN0YXJ0OiAwLCBlbmQ6IDEgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChSYW5nZS5pbnRlcnNlY3QoeyBzdGFydDogMCwgZW5kOiAxMCB9LCB7IHN0YXJ0OiAwLCBlbmQ6IDUgfSksIHsgc3RhcnQ6IDAsIGVuZDogNSB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFJhbmdlLmludGVyc2VjdCh7IHN0YXJ0OiAwLCBlbmQ6IDUgfSwgeyBzdGFydDogMCwgZW5kOiAxMCB9KSwgeyBzdGFydDogMCwgZW5kOiA1IH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoUmFuZ2UuaW50ZXJzZWN0KHsgc3RhcnQ6IDAsIGVuZDogMTAgfSwgeyBzdGFydDogNSwgZW5kOiAxMCB9KSwgeyBzdGFydDogNSwgZW5kOiAxMCB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFJhbmdlLmludGVyc2VjdCh7IHN0YXJ0OiA1LCBlbmQ6IDEwIH0sIHsgc3RhcnQ6IDAsIGVuZDogMTAgfSksIHsgc3RhcnQ6IDUsIGVuZDogMTAgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChSYW5nZS5pbnRlcnNlY3QoeyBzdGFydDogMCwgZW5kOiAxMCB9LCB7IHN0YXJ0OiAyLCBlbmQ6IDggfSksIHsgc3RhcnQ6IDIsIGVuZDogOCB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFJhbmdlLmludGVyc2VjdCh7IHN0YXJ0OiAyLCBlbmQ6IDggfSwgeyBzdGFydDogMCwgZW5kOiAxMCB9KSwgeyBzdGFydDogMiwgZW5kOiA4IH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoUmFuZ2UuaW50ZXJzZWN0KHsgc3RhcnQ6IDAsIGVuZDogMTAgfSwgeyBzdGFydDogNSwgZW5kOiAxNSB9KSwgeyBzdGFydDogNSwgZW5kOiAxMCB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFJhbmdlLmludGVyc2VjdCh7IHN0YXJ0OiA1LCBlbmQ6IDE1IH0sIHsgc3RhcnQ6IDAsIGVuZDogMTAgfSksIHsgc3RhcnQ6IDUsIGVuZDogMTAgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpSW50ZXJzZWN0JywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRncm91cEludGVyc2VjdChcblx0XHRcdFx0eyBzdGFydDogMCwgZW5kOiAwIH0sXG5cdFx0XHRcdFt7IHJhbmdlOiB7IHN0YXJ0OiAwLCBlbmQ6IDEwIH0sIHNpemU6IDEgfV1cblx0XHRcdCksXG5cdFx0XHRbXVxuXHRcdCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0Z3JvdXBJbnRlcnNlY3QoXG5cdFx0XHRcdHsgc3RhcnQ6IDEwLCBlbmQ6IDIwIH0sXG5cdFx0XHRcdFt7IHJhbmdlOiB7IHN0YXJ0OiAwLCBlbmQ6IDEwIH0sIHNpemU6IDEgfV1cblx0XHRcdCksXG5cdFx0XHRbXVxuXHRcdCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0Z3JvdXBJbnRlcnNlY3QoXG5cdFx0XHRcdHsgc3RhcnQ6IDIsIGVuZDogOCB9LFxuXHRcdFx0XHRbeyByYW5nZTogeyBzdGFydDogMCwgZW5kOiAxMCB9LCBzaXplOiAxIH1dXG5cdFx0XHQpLFxuXHRcdFx0W3sgcmFuZ2U6IHsgc3RhcnQ6IDIsIGVuZDogOCB9LCBzaXplOiAxIH1dXG5cdFx0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRncm91cEludGVyc2VjdChcblx0XHRcdFx0eyBzdGFydDogMiwgZW5kOiA4IH0sXG5cdFx0XHRcdFt7IHJhbmdlOiB7IHN0YXJ0OiAwLCBlbmQ6IDEwIH0sIHNpemU6IDEgfSwgeyByYW5nZTogeyBzdGFydDogMTAsIGVuZDogMjAgfSwgc2l6ZTogNSB9XVxuXHRcdFx0KSxcblx0XHRcdFt7IHJhbmdlOiB7IHN0YXJ0OiAyLCBlbmQ6IDggfSwgc2l6ZTogMSB9XVxuXHRcdCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0Z3JvdXBJbnRlcnNlY3QoXG5cdFx0XHRcdHsgc3RhcnQ6IDEyLCBlbmQ6IDE4IH0sXG5cdFx0XHRcdFt7IHJhbmdlOiB7IHN0YXJ0OiAwLCBlbmQ6IDEwIH0sIHNpemU6IDEgfSwgeyByYW5nZTogeyBzdGFydDogMTAsIGVuZDogMjAgfSwgc2l6ZTogNSB9XVxuXHRcdFx0KSxcblx0XHRcdFt7IHJhbmdlOiB7IHN0YXJ0OiAxMiwgZW5kOiAxOCB9LCBzaXplOiA1IH1dXG5cdFx0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRncm91cEludGVyc2VjdChcblx0XHRcdFx0eyBzdGFydDogMiwgZW5kOiAxOCB9LFxuXHRcdFx0XHRbeyByYW5nZTogeyBzdGFydDogMCwgZW5kOiAxMCB9LCBzaXplOiAxIH0sIHsgcmFuZ2U6IHsgc3RhcnQ6IDEwLCBlbmQ6IDIwIH0sIHNpemU6IDUgfV1cblx0XHRcdCksXG5cdFx0XHRbeyByYW5nZTogeyBzdGFydDogMiwgZW5kOiAxMCB9LCBzaXplOiAxIH0sIHsgcmFuZ2U6IHsgc3RhcnQ6IDEwLCBlbmQ6IDE4IH0sIHNpemU6IDUgfV1cblx0XHQpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdGdyb3VwSW50ZXJzZWN0KFxuXHRcdFx0XHR7IHN0YXJ0OiAyLCBlbmQ6IDI4IH0sXG5cdFx0XHRcdFt7IHJhbmdlOiB7IHN0YXJ0OiAwLCBlbmQ6IDEwIH0sIHNpemU6IDEgfSwgeyByYW5nZTogeyBzdGFydDogMTAsIGVuZDogMjAgfSwgc2l6ZTogNSB9LCB7IHJhbmdlOiB7IHN0YXJ0OiAyMCwgZW5kOiAzMCB9LCBzaXplOiAxMCB9XVxuXHRcdFx0KSxcblx0XHRcdFt7IHJhbmdlOiB7IHN0YXJ0OiAyLCBlbmQ6IDEwIH0sIHNpemU6IDEgfSwgeyByYW5nZTogeyBzdGFydDogMTAsIGVuZDogMjAgfSwgc2l6ZTogNSB9LCB7IHJhbmdlOiB7IHN0YXJ0OiAyMCwgZW5kOiAyOCB9LCBzaXplOiAxMCB9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbnNvbGlkYXRlJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29uc29saWRhdGUoW10pLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0Y29uc29saWRhdGUoW3sgcmFuZ2U6IHsgc3RhcnQ6IDAsIGVuZDogMTAgfSwgc2l6ZTogMSB9XSksXG5cdFx0XHRbeyByYW5nZTogeyBzdGFydDogMCwgZW5kOiAxMCB9LCBzaXplOiAxIH1dXG5cdFx0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRjb25zb2xpZGF0ZShbXG5cdFx0XHRcdHsgcmFuZ2U6IHsgc3RhcnQ6IDAsIGVuZDogMTAgfSwgc2l6ZTogMSB9LFxuXHRcdFx0XHR7IHJhbmdlOiB7IHN0YXJ0OiAxMCwgZW5kOiAyMCB9LCBzaXplOiAxIH1cblx0XHRcdF0pLFxuXHRcdFx0W3sgcmFuZ2U6IHsgc3RhcnQ6IDAsIGVuZDogMjAgfSwgc2l6ZTogMSB9XVxuXHRcdCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0Y29uc29saWRhdGUoW1xuXHRcdFx0XHR7IHJhbmdlOiB7IHN0YXJ0OiAwLCBlbmQ6IDEwIH0sIHNpemU6IDEgfSxcblx0XHRcdFx0eyByYW5nZTogeyBzdGFydDogMTAsIGVuZDogMjAgfSwgc2l6ZTogMSB9LFxuXHRcdFx0XHR7IHJhbmdlOiB7IHN0YXJ0OiAyMCwgZW5kOiAxMDAgfSwgc2l6ZTogMSB9XG5cdFx0XHRdKSxcblx0XHRcdFt7IHJhbmdlOiB7IHN0YXJ0OiAwLCBlbmQ6IDEwMCB9LCBzaXplOiAxIH1dXG5cdFx0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRjb25zb2xpZGF0ZShbXG5cdFx0XHRcdHsgcmFuZ2U6IHsgc3RhcnQ6IDAsIGVuZDogMTAgfSwgc2l6ZTogMSB9LFxuXHRcdFx0XHR7IHJhbmdlOiB7IHN0YXJ0OiAxMCwgZW5kOiAyMCB9LCBzaXplOiA1IH0sXG5cdFx0XHRcdHsgcmFuZ2U6IHsgc3RhcnQ6IDIwLCBlbmQ6IDMwIH0sIHNpemU6IDEwIH1cblx0XHRcdF0pLFxuXHRcdFx0W1xuXHRcdFx0XHR7IHJhbmdlOiB7IHN0YXJ0OiAwLCBlbmQ6IDEwIH0sIHNpemU6IDEgfSxcblx0XHRcdFx0eyByYW5nZTogeyBzdGFydDogMTAsIGVuZDogMjAgfSwgc2l6ZTogNSB9LFxuXHRcdFx0XHR7IHJhbmdlOiB7IHN0YXJ0OiAyMCwgZW5kOiAzMCB9LCBzaXplOiAxMCB9XG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRjb25zb2xpZGF0ZShbXG5cdFx0XHRcdHsgcmFuZ2U6IHsgc3RhcnQ6IDAsIGVuZDogMTAgfSwgc2l6ZTogMSB9LFxuXHRcdFx0XHR7IHJhbmdlOiB7IHN0YXJ0OiAxMCwgZW5kOiAyMCB9LCBzaXplOiAyIH0sXG5cdFx0XHRcdHsgcmFuZ2U6IHsgc3RhcnQ6IDIwLCBlbmQ6IDEwMCB9LCBzaXplOiAyIH1cblx0XHRcdF0pLFxuXHRcdFx0W1xuXHRcdFx0XHR7IHJhbmdlOiB7IHN0YXJ0OiAwLCBlbmQ6IDEwIH0sIHNpemU6IDEgfSxcblx0XHRcdFx0eyByYW5nZTogeyBzdGFydDogMTAsIGVuZDogMTAwIH0sIHNpemU6IDIgfVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VtcHR5JywgKCkgPT4ge1xuXHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IFJhbmdlTWFwKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgMCk7XG5cdH0pO1xuXG5cdGNvbnN0IG9uZSA9IHsgc2l6ZTogMSB9O1xuXHRjb25zdCB0d28gPSB7IHNpemU6IDIgfTtcblx0Y29uc3QgdGhyZWUgPSB7IHNpemU6IDMgfTtcblx0Y29uc3QgZml2ZSA9IHsgc2l6ZTogNSB9O1xuXHRjb25zdCB0ZW4gPSB7IHNpemU6IDEwIH07XG5cblx0dGVzdCgnbGVuZ3RoICYgY291bnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmFuZ2VNYXAgPSBuZXcgUmFuZ2VNYXAoKTtcblx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMCwgW29uZV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdsZW5ndGggJiBjb3VudCAjMicsICgpID0+IHtcblx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBSYW5nZU1hcCgpO1xuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbb25lLCBvbmUsIG9uZSwgb25lLCBvbmVdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCA1KTtcblx0fSk7XG5cblx0dGVzdCgnbGVuZ3RoICYgY291bnQgIzMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmFuZ2VNYXAgPSBuZXcgUmFuZ2VNYXAoKTtcblx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMCwgW2ZpdmVdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAxKTtcblx0fSk7XG5cblx0dGVzdCgnbGVuZ3RoICYgY291bnQgIzQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmFuZ2VNYXAgPSBuZXcgUmFuZ2VNYXAoKTtcblx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMCwgW2ZpdmUsIGZpdmUsIGZpdmUsIGZpdmUsIGZpdmVdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgMjUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgNSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCcsICgpID0+IHtcblx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBSYW5nZU1hcCgpO1xuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbZml2ZSwgZml2ZSwgZml2ZSwgZml2ZSwgZml2ZV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCAyNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCA1KTtcblxuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbZml2ZSwgZml2ZSwgZml2ZSwgZml2ZSwgZml2ZV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCA1MCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAxMCk7XG5cblx0XHRyYW5nZU1hcC5zcGxpY2UoNSwgMCwgW3RlbiwgdGVuXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDcwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDEyKTtcblxuXHRcdHJhbmdlTWFwLnNwbGljZSgxMiwgMCwgW3sgc2l6ZTogMjAwIH1dKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgMjcwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDEzKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IFJhbmdlTWFwKCk7XG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDAsIDAsIFtmaXZlLCBmaXZlLCBmaXZlLCBmaXZlLCBmaXZlLFxuXHRcdFx0Zml2ZSwgZml2ZSwgZml2ZSwgZml2ZSwgZml2ZSxcblx0XHRcdGZpdmUsIGZpdmUsIGZpdmUsIGZpdmUsIGZpdmUsXG5cdFx0XHRmaXZlLCBmaXZlLCBmaXZlLCBmaXZlLCBmaXZlXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDEwMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAyMCk7XG5cblx0XHRyYW5nZU1hcC5zcGxpY2UoMTAsIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCA3NSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAxNSk7XG5cblx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDcwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDE0KTtcblxuXHRcdHJhbmdlTWFwLnNwbGljZSgxLCAxMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgMSk7XG5cblx0XHRyYW5nZU1hcC5zcGxpY2UoMSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCAmIGRlbGV0ZScsICgpID0+IHtcblx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBSYW5nZU1hcCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDApO1xuXG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDAsIDAsIFtvbmVdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAxKTtcblxuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAwKTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0ICYgZGVsZXRlICMyJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IFJhbmdlTWFwKCk7XG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDAsIDAsIFtvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSxcblx0XHRcdG9uZSwgb25lLCBvbmUsIG9uZSwgb25lXSk7XG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDIsIDYpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbnNlcnQgJiBkZWxldGUgIzMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmFuZ2VNYXAgPSBuZXcgUmFuZ2VNYXAoKTtcblx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMCwgW29uZSwgb25lLCBvbmUsIG9uZSwgb25lLFxuXHRcdFx0b25lLCBvbmUsIG9uZSwgb25lLCBvbmUsXG5cdFx0XHR0d28sIHR3bywgdHdvLCB0d28sIHR3byxcblx0XHRcdHR3bywgdHdvLCB0d28sIHR3bywgdHdvXSk7XG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDgsIDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgMTYpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCAyNCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCAmIGRlbGV0ZSAjNCcsICgpID0+IHtcblx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBSYW5nZU1hcCgpO1xuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbb25lLCBvbmUsIG9uZSwgb25lLCBvbmUsXG5cdFx0XHRvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSxcblx0XHRcdHR3bywgdHdvLCB0d28sIHR3bywgdHdvLFxuXHRcdFx0dHdvLCB0d28sIHR3bywgdHdvLCB0d29dKTtcblx0XHRyYW5nZU1hcC5zcGxpY2UoNSwgMCwgW3RocmVlLCB0aHJlZSwgdGhyZWUsIHRocmVlLCB0aHJlZV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgMjUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCA0NSk7XG5cblx0XHRyYW5nZU1hcC5zcGxpY2UoNCwgNyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAxOCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDI4KTtcblx0fSk7XG5cblx0c3VpdGUoJ2luZGV4QXQsIHBvc2l0aW9uQXQnLCAoKSA9PiB7XG5cdFx0dGVzdCgnZW1wdHknLCAoKSA9PiB7XG5cdFx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBSYW5nZU1hcCgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoMCksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoMTApLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KC0xKSwgLTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMCksIC0xKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDEwKSwgLTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoLTEpLCAtMSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaW1wbGUnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBSYW5nZU1hcCgpO1xuXHRcdFx0cmFuZ2VNYXAuc3BsaWNlKDAsIDAsIFtvbmVdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDApLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDEpLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDApLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDEpLCAtMSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaW1wbGUgIzInLCAoKSA9PiB7XG5cdFx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBSYW5nZU1hcCgpO1xuXHRcdFx0cmFuZ2VNYXAuc3BsaWNlKDAsIDAsIFt0ZW5dKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDApLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDUpLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDkpLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDEwKSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgwKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgxKSwgLTEpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnaW5zZXJ0JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmFuZ2VNYXAgPSBuZXcgUmFuZ2VNYXAoKTtcblx0XHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbb25lLCBvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSwgb25lXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgwKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgxKSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCg1KSwgNSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCg5KSwgOSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgxMCksIDEwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDExKSwgMTApO1xuXG5cdFx0XHRyYW5nZU1hcC5zcGxpY2UoMTAsIDAsIFtvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSwgb25lLCBvbmVdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDEwKSwgMTApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoMTkpLCAxOSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgyMCksIDIwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDIxKSwgMjApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMCksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMSksIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMTkpLCAxOSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgyMCksIC0xKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2RlbGV0ZScsICgpID0+IHtcblx0XHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IFJhbmdlTWFwKCk7XG5cdFx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMCwgW29uZSwgb25lLCBvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSwgb25lLCBvbmUsIG9uZV0pO1xuXHRcdFx0cmFuZ2VNYXAuc3BsaWNlKDIsIDYpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgwKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgxKSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgzKSwgMyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCg0KSwgNCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCg1KSwgNCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgwKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgxKSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgzKSwgMyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCg0KSwgLTEpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZGVsZXRlICMyJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmFuZ2VNYXAgPSBuZXcgUmFuZ2VNYXAoKTtcblx0XHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbdGVuLCB0ZW4sIHRlbiwgdGVuLCB0ZW4sIHRlbiwgdGVuLCB0ZW4sIHRlbiwgdGVuXSk7XG5cdFx0XHRyYW5nZU1hcC5zcGxpY2UoMiwgNik7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDApLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDEpLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDMwKSwgMyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCg0MCksIDQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoNTApLCA0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDApLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDEpLCAxMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgyKSwgMjApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMyksIDMwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDQpLCAtMSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdSYW5nZU1hcCB3aXRoIHRvcCBwYWRkaW5nJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2VtcHR5JywgKCkgPT4ge1xuXHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IFJhbmdlTWFwKDEwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgMTApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgMCk7XG5cdH0pO1xuXG5cdGNvbnN0IG9uZSA9IHsgc2l6ZTogMSB9O1xuXHRjb25zdCBmaXZlID0geyBzaXplOiA1IH07XG5cdGNvbnN0IHRlbiA9IHsgc2l6ZTogMTAgfTtcblxuXHR0ZXN0KCdsZW5ndGggJiBjb3VudCcsICgpID0+IHtcblx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBSYW5nZU1hcCgxMCk7XG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDAsIDAsIFtvbmVdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgMTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xlbmd0aCAmIGNvdW50ICMyJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IFJhbmdlTWFwKDEwKTtcblx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMCwgW29uZSwgb25lLCBvbmUsIG9uZSwgb25lXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDE1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDUpO1xuXHR9KTtcblxuXHR0ZXN0KCdsZW5ndGggJiBjb3VudCAjMycsICgpID0+IHtcblx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBSYW5nZU1hcCgxMCk7XG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDAsIDAsIFtmaXZlXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDE1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdsZW5ndGggJiBjb3VudCAjNCcsICgpID0+IHtcblx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBSYW5nZU1hcCgxMCk7XG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDAsIDAsIFtmaXZlLCBmaXZlLCBmaXZlLCBmaXZlLCBmaXZlXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDM1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDUpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbnNlcnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmFuZ2VNYXAgPSBuZXcgUmFuZ2VNYXAoMTApO1xuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbZml2ZSwgZml2ZSwgZml2ZSwgZml2ZSwgZml2ZV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCAzNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCA1KTtcblxuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbZml2ZSwgZml2ZSwgZml2ZSwgZml2ZSwgZml2ZV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCA2MCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAxMCk7XG5cblx0XHRyYW5nZU1hcC5zcGxpY2UoNSwgMCwgW3RlbiwgdGVuXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDgwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDEyKTtcblxuXHRcdHJhbmdlTWFwLnNwbGljZSgxMiwgMCwgW3sgc2l6ZTogMjAwIH1dKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgMjgwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDEzKTtcblx0fSk7XG5cblx0c3VpdGUoJ2luZGV4QXQsIHBvc2l0aW9uQXQnLCAoKSA9PiB7XG5cdFx0dGVzdCgnZW1wdHknLCAoKSA9PiB7XG5cdFx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBSYW5nZU1hcCgxMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgwKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgxMCksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoLTEpLCAtMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgwKSwgLTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMTApLCAtMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgtMSksIC0xKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3NpbXBsZScsICgpID0+IHtcblx0XHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IFJhbmdlTWFwKDEwKTtcblx0XHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbb25lXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgwKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgxKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgxMCksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoMTEpLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDApLCAxMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgxKSwgLTEpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsYUFBYSxnQkFBZ0IsZ0JBQWdCO0FBQ3RELFNBQVMsYUFBYTtBQUN0QixTQUFTLCtDQUErQztBQUV4RCxNQUFNLFlBQVksTUFBTTtBQUV2QiwwQ0FBd0M7QUFFeEMsT0FBSyxnQkFBZ0IsTUFBTTtBQUMxQixXQUFPLGdCQUFnQixNQUFNLFVBQVUsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLEdBQUcsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUN4RyxXQUFPLGdCQUFnQixNQUFNLFVBQVUsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLEdBQUcsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUN4RyxXQUFPLGdCQUFnQixNQUFNLFVBQVUsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLEdBQUcsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUN4RyxXQUFPLGdCQUFnQixNQUFNLFVBQVUsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLEdBQUcsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUN4RyxXQUFPLGdCQUFnQixNQUFNLFVBQVUsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLEdBQUcsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUN4RyxXQUFPLGdCQUFnQixNQUFNLFVBQVUsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLEdBQUcsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUN4RyxXQUFPLGdCQUFnQixNQUFNLFVBQVUsRUFBRSxPQUFPLEdBQUcsS0FBSyxHQUFHLEdBQUcsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUN6RyxXQUFPLGdCQUFnQixNQUFNLFVBQVUsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLEdBQUcsRUFBRSxPQUFPLEdBQUcsS0FBSyxHQUFHLENBQUMsR0FBRyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUN6RyxXQUFPLGdCQUFnQixNQUFNLFVBQVUsRUFBRSxPQUFPLEdBQUcsS0FBSyxHQUFHLEdBQUcsRUFBRSxPQUFPLEdBQUcsS0FBSyxHQUFHLENBQUMsR0FBRyxFQUFFLE9BQU8sR0FBRyxLQUFLLEdBQUcsQ0FBQztBQUMzRyxXQUFPLGdCQUFnQixNQUFNLFVBQVUsRUFBRSxPQUFPLEdBQUcsS0FBSyxHQUFHLEdBQUcsRUFBRSxPQUFPLEdBQUcsS0FBSyxHQUFHLENBQUMsR0FBRyxFQUFFLE9BQU8sR0FBRyxLQUFLLEdBQUcsQ0FBQztBQUMzRyxXQUFPLGdCQUFnQixNQUFNLFVBQVUsRUFBRSxPQUFPLEdBQUcsS0FBSyxHQUFHLEdBQUcsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUN6RyxXQUFPLGdCQUFnQixNQUFNLFVBQVUsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLEdBQUcsRUFBRSxPQUFPLEdBQUcsS0FBSyxHQUFHLENBQUMsR0FBRyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUN6RyxXQUFPLGdCQUFnQixNQUFNLFVBQVUsRUFBRSxPQUFPLEdBQUcsS0FBSyxHQUFHLEdBQUcsRUFBRSxPQUFPLEdBQUcsS0FBSyxHQUFHLENBQUMsR0FBRyxFQUFF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
