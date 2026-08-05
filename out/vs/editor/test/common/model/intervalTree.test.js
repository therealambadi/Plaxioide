import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { TrackedRangeStickiness } from "../../../common/model.js";
import { IntervalNode, IntervalTree, NodeColor, SENTINEL, getNodeColor, intervalCompare, nodeAcceptEdit, setNodeStickiness } from "../../../common/model/intervalTree.js";
const GENERATE_TESTS = false;
const TEST_COUNT = GENERATE_TESTS ? 1e4 : 0;
const PRINT_TREE = false;
const MIN_INTERVAL_START = 1;
const MAX_INTERVAL_END = 100;
const MIN_INSERTS = 1;
const MAX_INSERTS = 30;
const MIN_CHANGE_CNT = 10;
const MAX_CHANGE_CNT = 20;
suite("IntervalTree 1", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  class Interval {
    constructor(start, end) {
      this._intervalBrand = void 0;
      this.start = start;
      this.end = end;
    }
  }
  class Oracle {
    constructor() {
      this.intervals = [];
    }
    insert(interval) {
      this.intervals.push(interval);
      this.intervals.sort((a, b) => {
        if (a.start === b.start) {
          return a.end - b.end;
        }
        return a.start - b.start;
      });
      return interval;
    }
    delete(interval) {
      for (let i = 0, len = this.intervals.length; i < len; i++) {
        if (this.intervals[i] === interval) {
          this.intervals.splice(i, 1);
          return;
        }
      }
    }
    search(interval) {
      const result = [];
      for (let i = 0, len = this.intervals.length; i < len; i++) {
        const int = this.intervals[i];
        if (int.start <= interval.end && int.end >= interval.start) {
          result.push(int);
        }
      }
      return result;
    }
  }
  class TestState {
    constructor() {
      this._oracle = new Oracle();
      this._tree = new IntervalTree();
      this._lastNodeId = -1;
      this._treeNodes = [];
      this._oracleNodes = [];
    }
    acceptOp(op) {
      if (op.type === "insert") {
        if (PRINT_TREE) {
          console.log(`insert: {${JSON.stringify(new Interval(op.begin, op.end))}}`);
        }
        const nodeId = ++this._lastNodeId;
        this._treeNodes[nodeId] = new IntervalNode(null, op.begin, op.end);
        this._tree.insert(this._treeNodes[nodeId]);
        this._oracleNodes[nodeId] = this._oracle.insert(new Interval(op.begin, op.end));
      } else if (op.type === "delete") {
        if (PRINT_TREE) {
          console.log(`delete: {${JSON.stringify(this._oracleNodes[op.id])}}`);
        }
        this._tree.delete(this._treeNodes[op.id]);
        this._oracle.delete(this._oracleNodes[op.id]);
        this._treeNodes[op.id] = null;
        this._oracleNodes[op.id] = null;
      } else if (op.type === "change") {
        this._tree.delete(this._treeNodes[op.id]);
        this._treeNodes[op.id].reset(0, op.begin, op.end, null);
        this._tree.insert(this._treeNodes[op.id]);
        this._oracle.delete(this._oracleNodes[op.id]);
        this._oracleNodes[op.id].start = op.begin;
        this._oracleNodes[op.id].end = op.end;
        this._oracle.insert(this._oracleNodes[op.id]);
      } else {
        const actualNodes = this._tree.intervalSearch(op.begin, op.end, 0, false, 0, false);
        const actual2 = actualNodes.map((n) => new Interval(n.cachedAbsoluteStart, n.cachedAbsoluteEnd));
        const expected2 = this._oracle.search(new Interval(op.begin, op.end));
        assert.deepStrictEqual(actual2, expected2);
        return;
      }
      if (PRINT_TREE) {
        printTree(this._tree);
      }
      assertTreeInvariants(this._tree);
      const actual = this._tree.getAllInOrder().map((n) => new Interval(n.cachedAbsoluteStart, n.cachedAbsoluteEnd));
      const expected = this._oracle.intervals;
      assert.deepStrictEqual(actual, expected);
    }
    getExistingNodeId(index) {
      let currIndex = -1;
      for (let i = 0; i < this._treeNodes.length; i++) {
        if (this._treeNodes[i] === null) {
          continue;
        }
        currIndex++;
        if (currIndex === index) {
          return i;
        }
      }
      throw new Error("unexpected");
    }
  }
  function testIntervalTree(ops) {
    const state = new TestState();
    for (let i = 0; i < ops.length; i++) {
      state.acceptOp(ops[i]);
    }
  }
  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function getRandomRange(min, max) {
    const begin = getRandomInt(min, max);
    let length;
    if (getRandomInt(1, 10) <= 2) {
      length = getRandomInt(0, max - begin);
    } else {
      length = getRandomInt(0, Math.min(max - begin, 10));
    }
    return [begin, begin + length];
  }
  class AutoTest {
    constructor() {
      this._ops = [];
      this._state = new TestState();
      this._insertCnt = getRandomInt(MIN_INSERTS, MAX_INSERTS);
      this._changeCnt = getRandomInt(MIN_CHANGE_CNT, MAX_CHANGE_CNT);
      this._deleteCnt = 0;
    }
    _doRandomInsert() {
      const range = getRandomRange(MIN_INTERVAL_START, MAX_INTERVAL_END);
      this._run({
        type: "insert",
        begin: range[0],
        end: range[1]
      });
    }
    _doRandomDelete() {
      const idx = getRandomInt(Math.floor(this._deleteCnt / 2), this._deleteCnt - 1);
      this._run({
        type: "delete",
        id: this._state.getExistingNodeId(idx)
      });
    }
    _doRandomChange() {
      const idx = getRandomInt(0, this._deleteCnt - 1);
      const range = getRandomRange(MIN_INTERVAL_START, MAX_INTERVAL_END);
      this._run({
        type: "change",
        id: this._state.getExistingNodeId(idx),
        begin: range[0],
        end: range[1]
      });
    }
    run() {
      while (this._insertCnt > 0 || this._deleteCnt > 0 || this._changeCnt > 0) {
        if (this._insertCnt > 0) {
          this._doRandomInsert();
          this._insertCnt--;
          this._deleteCnt++;
        } else if (this._changeCnt > 0) {
          this._doRandomChange();
          this._changeCnt--;
        } else {
          this._doRandomDelete();
          this._deleteCnt--;
        }
        const searchRange = getRandomRange(MIN_INTERVAL_START, MAX_INTERVAL_END);
        this._run({
          type: "search",
          begin: searchRange[0],
          end: searchRange[1]
        });
      }
    }
    _run(op) {
      this._ops.push(op);
      this._state.acceptOp(op);
    }
    print() {
      console.log(`testIntervalTree(${JSON.stringify(this._ops)})`);
    }
  }
  suite("generated", () => {
    test("gen01", () => {
      testIntervalTree([
        { type: "insert", begin: 28, end: 35 },
        { type: "insert", begin: 52, end: 54 },
        { type: "insert", begin: 63, end: 69 }
      ]);
    });
    test("gen02", () => {
      testIntervalTree([
        { type: "insert", begin: 80, end: 89 },
        { type: "insert", begin: 92, end: 100 },
        { type: "insert", begin: 99, end: 99 }
      ]);
    });
    test("gen03", () => {
      testIntervalTree([
        { type: "insert", begin: 89, end: 96 },
        { type: "insert", begin: 71, end: 74 },
        { type: "delete", id: 1 }
      ]);
    });
    test("gen04", () => {
      testIntervalTree([
        { type: "insert", begin: 44, end: 46 },
        { type: "insert", begin: 85, end: 88 },
        { type: "delete", id: 0 }
      ]);
    });
    test("gen05", () => {
      testIntervalTree([
        { type: "insert", begin: 82, end: 90 },
        { type: "insert", begin: 69, end: 73 },
        { type: "delete", id: 0 },
        { type: "delete", id: 1 }
      ]);
    });
    test("gen06", () => {
      testIntervalTree([
        { type: "insert", begin: 41, end: 63 },
        { type: "insert", begin: 98, end: 98 },
        { type: "insert", begin: 47, end: 51 },
        { type: "delete", id: 2 }
      ]);
    });
    test("gen07", () => {
      testIntervalTree([
        { type: "insert", begin: 24, end: 26 },
        { type: "insert", begin: 11, end: 28 },
        { type: "insert", begin: 27, end: 30 },
        { type: "insert", begin: 80, end: 85 },
        { type: "delete", id: 1 }
      ]);
    });
    test("gen08", () => {
      testIntervalTree([
        { type: "insert", begin: 100, end: 100 },
        { type: "insert", begin: 100, end: 100 }
      ]);
    });
    test("gen09", () => {
      testIntervalTree([
        { type: "insert", begin: 58, end: 65 },
        { type: "insert", begin: 82, end: 96 },
        { type: "insert", begin: 58, end: 65 }
      ]);
    });
    test("gen10", () => {
      testIntervalTree([
        { type: "insert", begin: 32, end: 40 },
        { type: "insert", begin: 25, end: 29 },
        { type: "insert", begin: 24, end: 32 }
      ]);
    });
    test("gen11", () => {
      testIntervalTree([
        { type: "insert", begin: 25, end: 70 },
        { type: "insert", begin: 99, end: 100 },
        { type: "insert", begin: 46, end: 51 },
        { type: "insert", begin: 57, end: 57 },
        { type: "delete", id: 2 }
      ]);
    });
    test("gen12", () => {
      testIntervalTree([
        { type: "insert", begin: 20, end: 26 },
        { type: "insert", begin: 10, end: 18 },
        { type: "insert", begin: 99, end: 99 },
        { type: "insert", begin: 37, end: 59 },
        { type: "delete", id: 2 }
      ]);
    });
    test("gen13", () => {
      testIntervalTree([
        { type: "insert", begin: 3, end: 91 },
        { type: "insert", begin: 57, end: 57 },
        { type: "insert", begin: 35, end: 44 },
        { type: "insert", begin: 72, end: 81 },
        { type: "delete", id: 2 }
      ]);
    });
    test("gen14", () => {
      testIntervalTree([
        { type: "insert", begin: 58, end: 61 },
        { type: "insert", begin: 34, end: 35 },
        { type: "insert", begin: 56, end: 62 },
        { type: "insert", begin: 69, end: 78 },
        { type: "delete", id: 0 }
      ]);
    });
    test("gen15", () => {
      testIntervalTree([
        { type: "insert", begin: 63, end: 69 },
        { type: "insert", begin: 17, end: 24 },
        { type: "insert", begin: 3, end: 13 },
        { type: "insert", begin: 84, end: 94 },
        { type: "insert", begin: 18, end: 23 },
        { type: "insert", begin: 96, end: 98 },
        { type: "delete", id: 1 }
      ]);
    });
    test("gen16", () => {
      testIntervalTree([
        { type: "insert", begin: 27, end: 27 },
        { type: "insert", begin: 42, end: 87 },
        { type: "insert", begin: 42, end: 49 },
        { type: "insert", begin: 69, end: 71 },
        { type: "insert", begin: 20, end: 27 },
        { type: "insert", begin: 8, end: 9 },
        { type: "insert", begin: 42, end: 49 },
        { type: "delete", id: 1 }
      ]);
    });
    test("gen17", () => {
      testIntervalTree([
        { type: "insert", begin: 21, end: 23 },
        { type: "insert", begin: 83, end: 87 },
        { type: "insert", begin: 56, end: 58 },
        { type: "insert", begin: 1, end: 55 },
        { type: "insert", begin: 56, end: 59 },
        { type: "insert", begin: 58, end: 60 },
        { type: "insert", begin: 56, end: 65 },
        { type: "delete", id: 1 },
        { type: "delete", id: 0 },
        { type: "delete", id: 6 }
      ]);
    });
    test("gen18", () => {
      testIntervalTree([
        { type: "insert", begin: 25, end: 25 },
        { type: "insert", begin: 67, end: 79 },
        { type: "delete", id: 0 },
        { type: "search", begin: 65, end: 75 }
      ]);
    });
    test("force delta overflow", () => {
      testIntervalTree([
        { type: "insert", begin: 686081138593427, end: 733009856502260 },
        { type: "insert", begin: 591031326181669, end: 591031326181672 },
        { type: "insert", begin: 940037682731896, end: 940037682731903 },
        { type: "insert", begin: 598413641151120, end: 598413641151128 },
        { type: "insert", begin: 800564156553344, end: 800564156553351 },
        { type: "insert", begin: 894198957565481, end: 894198957565491 }
      ]);
    });
  });
  for (let i = 0; i < TEST_COUNT; i++) {
    if (i % 100 === 0) {
      console.log(`TEST ${i + 1}/${TEST_COUNT}`);
    }
    const test2 = new AutoTest();
    try {
      test2.run();
    } catch (err) {
      console.log(err);
      test2.print();
      return;
    }
  }
  suite("searching", () => {
    function createCormenTree() {
      const r = new IntervalTree();
      const data = [
        [16, 21],
        [8, 9],
        [25, 30],
        [5, 8],
        [15, 23],
        [17, 19],
        [26, 26],
        [0, 3],
        [6, 10],
        [19, 20]
      ];
      data.forEach((int) => {
        const node = new IntervalNode(null, int[0], int[1]);
        r.insert(node);
      });
      return r;
    }
    const T = createCormenTree();
    function assertIntervalSearch(start, end, expected) {
      const actualNodes = T.intervalSearch(start, end, 0, false, 0, false);
      const actual = actualNodes.map((n) => [n.cachedAbsoluteStart, n.cachedAbsoluteEnd]);
      assert.deepStrictEqual(actual, expected);
    }
    test("cormen 1->2", () => {
      assertIntervalSearch(
        1,
        2,
        [
          [0, 3]
        ]
      );
    });
    test("cormen 4->8", () => {
      assertIntervalSearch(
        4,
        8,
        [
          [5, 8],
          [6, 10],
          [8, 9]
        ]
      );
    });
    test("cormen 10->15", () => {
      assertIntervalSearch(
        10,
        15,
        [
          [6, 10],
          [15, 23]
        ]
      );
    });
    test("cormen 21->25", () => {
      assertIntervalSearch(
        21,
        25,
        [
          [15, 23],
          [16, 21],
          [25, 30]
        ]
      );
    });
    test("cormen 24->24", () => {
      assertIntervalSearch(
        24,
        24,
        []
      );
    });
  });
});
suite("IntervalTree 2", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function assertNodeAcceptEdit(msg, nodeStart, nodeEnd, nodeStickiness, start, end, textLength, forceMoveMarkers, expectedNodeStart, expectedNodeEnd) {
    const node = new IntervalNode("", nodeStart, nodeEnd);
    setNodeStickiness(node, nodeStickiness);
    nodeAcceptEdit(node, start, end, textLength, forceMoveMarkers);
    assert.deepStrictEqual([node.start, node.end], [expectedNodeStart, expectedNodeEnd], msg);
  }
  test("nodeAcceptEdit", () => {
    {
      assertNodeAcceptEdit("A.000", 0, 0, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 0, 0, 0, false, 0, 0);
      assertNodeAcceptEdit("A.001", 0, 0, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 0, 0, 0, false, 0, 0);
      assertNodeAcceptEdit("A.002", 0, 0, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 0, 0, 0, false, 0, 0);
      assertNodeAcceptEdit("A.003", 0, 0, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 0, 0, 0, false, 0, 0);
      assertNodeAcceptEdit("A.004", 0, 0, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 0, 0, 0, true, 0, 0);
      assertNodeAcceptEdit("A.005", 0, 0, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 0, 0, 0, true, 0, 0);
      assertNodeAcceptEdit("A.006", 0, 0, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 0, 0, 0, true, 0, 0);
      assertNodeAcceptEdit("A.007", 0, 0, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 0, 0, 0, true, 0, 0);
      assertNodeAcceptEdit("A.008", 0, 0, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 0, 0, 1, false, 0, 1);
      assertNodeAcceptEdit("A.009", 0, 0, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 0, 0, 1, false, 1, 1);
      assertNodeAcceptEdit("A.010", 0, 0, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 0, 0, 1, false, 0, 0);
      assertNodeAcceptEdit("A.011", 0, 0, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 0, 0, 1, false, 1, 1);
      assertNodeAcceptEdit("A.012", 0, 0, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 0, 0, 1, true, 1, 1);
      assertNodeAcceptEdit("A.013", 0, 0, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 0, 0, 1, true, 1, 1);
      assertNodeAcceptEdit("A.014", 0, 0, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 0, 0, 1, true, 1, 1);
      assertNodeAcceptEdit("A.015", 0, 0, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 0, 0, 1, true, 1, 1);
    }
    {
      assertNodeAcceptEdit("B.000", 0, 5, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 0, 0, 0, false, 0, 5);
      assertNodeAcceptEdit("B.001", 0, 5, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 0, 0, 0, false, 0, 5);
      assertNodeAcceptEdit("B.002", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 0, 0, 0, false, 0, 5);
      assertNodeAcceptEdit("B.003", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 0, 0, 0, false, 0, 5);
      assertNodeAcceptEdit("B.004", 0, 5, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 0, 0, 0, true, 0, 5);
      assertNodeAcceptEdit("B.005", 0, 5, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 0, 0, 0, true, 0, 5);
      assertNodeAcceptEdit("B.006", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 0, 0, 0, true, 0, 5);
      assertNodeAcceptEdit("B.007", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 0, 0, 0, true, 0, 5);
      assertNodeAcceptEdit("B.008", 0, 5, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 0, 0, 1, false, 0, 6);
      assertNodeAcceptEdit("B.009", 0, 5, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 0, 0, 1, false, 1, 6);
      assertNodeAcceptEdit("B.010", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 0, 0, 1, false, 0, 6);
      assertNodeAcceptEdit("B.011", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 0, 0, 1, false, 1, 6);
      assertNodeAcceptEdit("B.012", 0, 5, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 0, 0, 1, true, 1, 6);
      assertNodeAcceptEdit("B.013", 0, 5, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 0, 0, 1, true, 1, 6);
      assertNodeAcceptEdit("B.014", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 0, 0, 1, true, 1, 6);
      assertNodeAcceptEdit("B.015", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 0, 0, 1, true, 1, 6);
      assertNodeAcceptEdit("B.016", 0, 5, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 2, 2, 1, false, 0, 6);
      assertNodeAcceptEdit("B.017", 0, 5, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 2, 2, 1, false, 0, 6);
      assertNodeAcceptEdit("B.018", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 2, 2, 1, false, 0, 6);
      assertNodeAcceptEdit("B.019", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 2, 2, 1, false, 0, 6);
      assertNodeAcceptEdit("B.020", 0, 5, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 2, 2, 1, true, 0, 6);
      assertNodeAcceptEdit("B.021", 0, 5, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 2, 2, 1, true, 0, 6);
      assertNodeAcceptEdit("B.022", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 2, 2, 1, true, 0, 6);
      assertNodeAcceptEdit("B.023", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 2, 2, 1, true, 0, 6);
      assertNodeAcceptEdit("B.024", 0, 5, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 5, 5, 1, false, 0, 6);
      assertNodeAcceptEdit("B.025", 0, 5, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 5, 5, 1, false, 0, 5);
      assertNodeAcceptEdit("B.026", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 5, 5, 1, false, 0, 5);
      assertNodeAcceptEdit("B.027", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 5, 5, 1, false, 0, 6);
      assertNodeAcceptEdit("B.028", 0, 5, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 5, 5, 1, true, 0, 6);
      assertNodeAcceptEdit("B.029", 0, 5, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 5, 5, 1, true, 0, 6);
      assertNodeAcceptEdit("B.030", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 5, 5, 1, true, 0, 6);
      assertNodeAcceptEdit("B.031", 0, 5, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 5, 5, 1, true, 0, 6);
      assertNodeAcceptEdit("B.032", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 4, 5, 2, false, 5, 11);
      assertNodeAcceptEdit("B.033", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 4, 5, 2, false, 6, 11);
      assertNodeAcceptEdit("B.034", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 4, 5, 2, false, 5, 11);
      assertNodeAcceptEdit("B.035", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 4, 5, 2, false, 6, 11);
      assertNodeAcceptEdit("B.036", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 4, 5, 2, true, 6, 11);
      assertNodeAcceptEdit("B.037", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 4, 5, 2, true, 6, 11);
      assertNodeAcceptEdit("B.038", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 4, 5, 2, true, 6, 11);
      assertNodeAcceptEdit("B.039", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 4, 5, 2, true, 6, 11);
      assertNodeAcceptEdit("B.040", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 3, 5, 1, false, 4, 9);
      assertNodeAcceptEdit("B.041", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 3, 5, 1, false, 4, 9);
      assertNodeAcceptEdit("B.042", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 3, 5, 1, false, 4, 9);
      assertNodeAcceptEdit("B.043", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 3, 5, 1, false, 4, 9);
      assertNodeAcceptEdit("B.044", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 3, 5, 1, true, 4, 9);
      assertNodeAcceptEdit("B.045", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 3, 5, 1, true, 4, 9);
      assertNodeAcceptEdit("B.046", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 3, 5, 1, true, 4, 9);
      assertNodeAcceptEdit("B.047", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 3, 5, 1, true, 4, 9);
      assertNodeAcceptEdit("B.048", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 4, 6, 3, false, 5, 11);
      assertNodeAcceptEdit("B.049", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 4, 6, 3, false, 5, 11);
      assertNodeAcceptEdit("B.050", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 4, 6, 3, false, 5, 11);
      assertNodeAcceptEdit("B.051", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 4, 6, 3, false, 5, 11);
      assertNodeAcceptEdit("B.052", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 4, 6, 3, true, 7, 11);
      assertNodeAcceptEdit("B.053", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 4, 6, 3, true, 7, 11);
      assertNodeAcceptEdit("B.054", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 4, 6, 3, true, 7, 11);
      assertNodeAcceptEdit("B.055", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 4, 6, 3, true, 7, 11);
      assertNodeAcceptEdit("B.056", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 4, 6, 1, false, 5, 9);
      assertNodeAcceptEdit("B.057", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 4, 6, 1, false, 5, 9);
      assertNodeAcceptEdit("B.058", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 4, 6, 1, false, 5, 9);
      assertNodeAcceptEdit("B.059", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 4, 6, 1, false, 5, 9);
      assertNodeAcceptEdit("B.060", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 4, 6, 1, true, 5, 9);
      assertNodeAcceptEdit("B.061", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 4, 6, 1, true, 5, 9);
      assertNodeAcceptEdit("B.062", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 4, 6, 1, true, 5, 9);
      assertNodeAcceptEdit("B.063", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 4, 6, 1, true, 5, 9);
      assertNodeAcceptEdit("B.064", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 5, 6, 2, false, 5, 11);
      assertNodeAcceptEdit("B.065", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 5, 6, 2, false, 5, 11);
      assertNodeAcceptEdit("B.066", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 5, 6, 2, false, 5, 11);
      assertNodeAcceptEdit("B.067", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 5, 6, 2, false, 5, 11);
      assertNodeAcceptEdit("B.068", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 5, 6, 2, true, 7, 11);
      assertNodeAcceptEdit("B.069", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 5, 6, 2, true, 7, 11);
      assertNodeAcceptEdit("B.070", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 5, 6, 2, true, 7, 11);
      assertNodeAcceptEdit("B.071", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 5, 6, 2, true, 7, 11);
      assertNodeAcceptEdit("B.072", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 5, 7, 1, false, 5, 9);
      assertNodeAcceptEdit("B.073", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 5, 7, 1, false, 5, 9);
      assertNodeAcceptEdit("B.074", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 5, 7, 1, false, 5, 9);
      assertNodeAcceptEdit("B.075", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 5, 7, 1, false, 5, 9);
      assertNodeAcceptEdit("B.076", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 5, 7, 1, true, 6, 9);
      assertNodeAcceptEdit("B.077", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 5, 7, 1, true, 6, 9);
      assertNodeAcceptEdit("B.078", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 5, 7, 1, true, 6, 9);
      assertNodeAcceptEdit("B.079", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 5, 7, 1, true, 6, 9);
      assertNodeAcceptEdit("B.080", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 9, 10, 2, false, 5, 11);
      assertNodeAcceptEdit("B.081", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 9, 10, 2, false, 5, 10);
      assertNodeAcceptEdit("B.082", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 9, 10, 2, false, 5, 10);
      assertNodeAcceptEdit("B.083", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 9, 10, 2, false, 5, 11);
      assertNodeAcceptEdit("B.084", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 9, 10, 2, true, 5, 11);
      assertNodeAcceptEdit("B.085", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 9, 10, 2, true, 5, 11);
      assertNodeAcceptEdit("B.086", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 9, 10, 2, true, 5, 11);
      assertNodeAcceptEdit("B.087", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 9, 10, 2, true, 5, 11);
      assertNodeAcceptEdit("B.088", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 8, 10, 1, false, 5, 9);
      assertNodeAcceptEdit("B.089", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 8, 10, 1, false, 5, 9);
      assertNodeAcceptEdit("B.090", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 8, 10, 1, false, 5, 9);
      assertNodeAcceptEdit("B.091", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 8, 10, 1, false, 5, 9);
      assertNodeAcceptEdit("B.092", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 8, 10, 1, true, 5, 9);
      assertNodeAcceptEdit("B.093", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 8, 10, 1, true, 5, 9);
      assertNodeAcceptEdit("B.094", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 8, 10, 1, true, 5, 9);
      assertNodeAcceptEdit("B.095", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 8, 10, 1, true, 5, 9);
      assertNodeAcceptEdit("B.096", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 9, 11, 3, false, 5, 10);
      assertNodeAcceptEdit("B.097", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 9, 11, 3, false, 5, 10);
      assertNodeAcceptEdit("B.098", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 9, 11, 3, false, 5, 10);
      assertNodeAcceptEdit("B.099", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 9, 11, 3, false, 5, 10);
      assertNodeAcceptEdit("B.100", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 9, 11, 3, true, 5, 12);
      assertNodeAcceptEdit("B.101", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 9, 11, 3, true, 5, 12);
      assertNodeAcceptEdit("B.102", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 9, 11, 3, true, 5, 12);
      assertNodeAcceptEdit("B.103", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 9, 11, 3, true, 5, 12);
      assertNodeAcceptEdit("B.104", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 9, 11, 1, false, 5, 10);
      assertNodeAcceptEdit("B.105", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 9, 11, 1, false, 5, 10);
      assertNodeAcceptEdit("B.106", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 9, 11, 1, false, 5, 10);
      assertNodeAcceptEdit("B.107", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 9, 11, 1, false, 5, 10);
      assertNodeAcceptEdit("B.108", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 9, 11, 1, true, 5, 10);
      assertNodeAcceptEdit("B.109", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 9, 11, 1, true, 5, 10);
      assertNodeAcceptEdit("B.110", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 9, 11, 1, true, 5, 10);
      assertNodeAcceptEdit("B.111", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 9, 11, 1, true, 5, 10);
      assertNodeAcceptEdit("B.112", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 10, 11, 3, false, 5, 10);
      assertNodeAcceptEdit("B.113", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 10, 11, 3, false, 5, 10);
      assertNodeAcceptEdit("B.114", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 10, 11, 3, false, 5, 10);
      assertNodeAcceptEdit("B.115", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 10, 11, 3, false, 5, 10);
      assertNodeAcceptEdit("B.116", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 10, 11, 3, true, 5, 13);
      assertNodeAcceptEdit("B.117", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 10, 11, 3, true, 5, 13);
      assertNodeAcceptEdit("B.118", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 10, 11, 3, true, 5, 13);
      assertNodeAcceptEdit("B.119", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 10, 11, 3, true, 5, 13);
      assertNodeAcceptEdit("B.120", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 10, 12, 1, false, 5, 10);
      assertNodeAcceptEdit("B.121", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 10, 12, 1, false, 5, 10);
      assertNodeAcceptEdit("B.122", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 10, 12, 1, false, 5, 10);
      assertNodeAcceptEdit("B.123", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 10, 12, 1, false, 5, 10);
      assertNodeAcceptEdit("B.124", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 10, 12, 1, true, 5, 11);
      assertNodeAcceptEdit("B.125", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 10, 12, 1, true, 5, 11);
      assertNodeAcceptEdit("B.126", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 10, 12, 1, true, 5, 11);
      assertNodeAcceptEdit("B.127", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 10, 12, 1, true, 5, 11);
      assertNodeAcceptEdit("B.128", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 4, 5, 0, false, 4, 9);
      assertNodeAcceptEdit("B.129", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 4, 5, 0, false, 4, 9);
      assertNodeAcceptEdit("B.130", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 4, 5, 0, false, 4, 9);
      assertNodeAcceptEdit("B.131", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 4, 5, 0, false, 4, 9);
      assertNodeAcceptEdit("B.132", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 4, 5, 0, true, 4, 9);
      assertNodeAcceptEdit("B.133", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 4, 5, 0, true, 4, 9);
      assertNodeAcceptEdit("B.134", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 4, 5, 0, true, 4, 9);
      assertNodeAcceptEdit("B.135", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 4, 5, 0, true, 4, 9);
      assertNodeAcceptEdit("B.136", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 4, 6, 0, false, 4, 8);
      assertNodeAcceptEdit("B.137", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 4, 6, 0, false, 4, 8);
      assertNodeAcceptEdit("B.138", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 4, 6, 0, false, 4, 8);
      assertNodeAcceptEdit("B.139", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 4, 6, 0, false, 4, 8);
      assertNodeAcceptEdit("B.140", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 4, 6, 0, true, 4, 8);
      assertNodeAcceptEdit("B.141", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 4, 6, 0, true, 4, 8);
      assertNodeAcceptEdit("B.142", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 4, 6, 0, true, 4, 8);
      assertNodeAcceptEdit("B.143", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 4, 6, 0, true, 4, 8);
      assertNodeAcceptEdit("B.144", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 5, 6, 0, false, 5, 9);
      assertNodeAcceptEdit("B.145", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 5, 6, 0, false, 5, 9);
      assertNodeAcceptEdit("B.146", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 5, 6, 0, false, 5, 9);
      assertNodeAcceptEdit("B.147", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 5, 6, 0, false, 5, 9);
      assertNodeAcceptEdit("B.148", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 5, 6, 0, true, 5, 9);
      assertNodeAcceptEdit("B.149", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 5, 6, 0, true, 5, 9);
      assertNodeAcceptEdit("B.150", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 5, 6, 0, true, 5, 9);
      assertNodeAcceptEdit("B.151", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 5, 6, 0, true, 5, 9);
      assertNodeAcceptEdit("B.152", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 9, 10, 0, false, 5, 9);
      assertNodeAcceptEdit("B.153", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 9, 10, 0, false, 5, 9);
      assertNodeAcceptEdit("B.154", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 9, 10, 0, false, 5, 9);
      assertNodeAcceptEdit("B.155", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 9, 10, 0, false, 5, 9);
      assertNodeAcceptEdit("B.156", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 9, 10, 0, true, 5, 9);
      assertNodeAcceptEdit("B.157", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 9, 10, 0, true, 5, 9);
      assertNodeAcceptEdit("B.158", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 9, 10, 0, true, 5, 9);
      assertNodeAcceptEdit("B.159", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 9, 10, 0, true, 5, 9);
      assertNodeAcceptEdit("B.160", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 9, 11, 0, false, 5, 9);
      assertNodeAcceptEdit("B.161", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 9, 11, 0, false, 5, 9);
      assertNodeAcceptEdit("B.162", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 9, 11, 0, false, 5, 9);
      assertNodeAcceptEdit("B.163", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 9, 11, 0, false, 5, 9);
      assertNodeAcceptEdit("B.164", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 9, 11, 0, true, 5, 9);
      assertNodeAcceptEdit("B.165", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 9, 11, 0, true, 5, 9);
      assertNodeAcceptEdit("B.166", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 9, 11, 0, true, 5, 9);
      assertNodeAcceptEdit("B.167", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 9, 11, 0, true, 5, 9);
      assertNodeAcceptEdit("B.168", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 10, 11, 0, false, 5, 10);
      assertNodeAcceptEdit("B.169", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 10, 11, 0, false, 5, 10);
      assertNodeAcceptEdit("B.170", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 10, 11, 0, false, 5, 10);
      assertNodeAcceptEdit("B.171", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 10, 11, 0, false, 5, 10);
      assertNodeAcceptEdit("B.172", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 10, 11, 0, true, 5, 10);
      assertNodeAcceptEdit("B.173", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 10, 11, 0, true, 5, 10);
      assertNodeAcceptEdit("B.174", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 10, 11, 0, true, 5, 10);
      assertNodeAcceptEdit("B.175", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 10, 11, 0, true, 5, 10);
      assertNodeAcceptEdit("B.176", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 5, 10, 3, false, 5, 8);
      assertNodeAcceptEdit("B.177", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 5, 10, 3, false, 5, 8);
      assertNodeAcceptEdit("B.178", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 5, 10, 3, false, 5, 8);
      assertNodeAcceptEdit("B.179", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 5, 10, 3, false, 5, 8);
      assertNodeAcceptEdit("B.180", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 5, 10, 3, true, 8, 8);
      assertNodeAcceptEdit("B.181", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 5, 10, 3, true, 8, 8);
      assertNodeAcceptEdit("B.182", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 5, 10, 3, true, 8, 8);
      assertNodeAcceptEdit("B.183", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 5, 10, 3, true, 8, 8);
      assertNodeAcceptEdit("B.184", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 5, 10, 7, false, 5, 12);
      assertNodeAcceptEdit("B.185", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 5, 10, 7, false, 5, 10);
      assertNodeAcceptEdit("B.186", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 5, 10, 7, false, 5, 10);
      assertNodeAcceptEdit("B.187", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 5, 10, 7, false, 5, 12);
      assertNodeAcceptEdit("B.188", 5, 10, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, 5, 10, 7, true, 12, 12);
      assertNodeAcceptEdit("B.189", 5, 10, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, 5, 10, 7, true, 12, 12);
      assertNodeAcceptEdit("B.190", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingBefore, 5, 10, 7, true, 12, 12);
      assertNodeAcceptEdit("B.191", 5, 10, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter, 5, 10, 7, true, 12, 12);
    }
  });
});
function printTree(T) {
  if (T.root === SENTINEL) {
    console.log(`~~ empty`);
    return;
  }
  const out = [];
  _printTree(T, T.root, "", 0, out);
  console.log(out.join(""));
}
function _printTree(T, n, indent, delta, out) {
  out.push(`${indent}[${getNodeColor(n) === NodeColor.Red ? "R" : "B"},${n.delta}, ${n.start}->${n.end}, ${n.maxEnd}] : {${delta + n.start}->${delta + n.end}}, maxEnd: ${n.maxEnd + delta}
`);
  if (n.left !== SENTINEL) {
    _printTree(T, n.left, indent + "    ", delta, out);
  } else {
    out.push(`${indent}    NIL
`);
  }
  if (n.right !== SENTINEL) {
    _printTree(T, n.right, indent + "    ", delta + n.delta, out);
  } else {
    out.push(`${indent}    NIL
`);
  }
}
function assertTreeInvariants(T) {
  assert(getNodeColor(SENTINEL) === NodeColor.Black);
  assert(SENTINEL.parent === SENTINEL);
  assert(SENTINEL.left === SENTINEL);
  assert(SENTINEL.right === SENTINEL);
  assert(SENTINEL.start === 0);
  assert(SENTINEL.end === 0);
  assert(SENTINEL.delta === 0);
  assert(T.root.parent === SENTINEL);
  assertValidTree(T);
}
function depth(n) {
  if (n === SENTINEL) {
    return 1;
  }
  assert(depth(n.left) === depth(n.right));
  return (getNodeColor(n) === NodeColor.Black ? 1 : 0) + depth(n.left);
}
function assertValidNode(n, delta) {
  if (n === SENTINEL) {
    return;
  }
  const l = n.left;
  const r = n.right;
  if (getNodeColor(n) === NodeColor.Red) {
    assert(getNodeColor(l) === NodeColor.Black);
    assert(getNodeColor(r) === NodeColor.Black);
  }
  let expectedMaxEnd = n.end;
  if (l !== SENTINEL) {
    assert(intervalCompare(l.start + delta, l.end + delta, n.start + delta, n.end + delta) <= 0);
    expectedMaxEnd = Math.max(expectedMaxEnd, l.maxEnd);
  }
  if (r !== SENTINEL) {
    assert(intervalCompare(n.start + delta, n.end + delta, r.start + delta + n.delta, r.end + delta + n.delta) <= 0);
    expectedMaxEnd = Math.max(expectedMaxEnd, r.maxEnd + n.delta);
  }
  assert(n.maxEnd === expectedMaxEnd);
  assertValidNode(l, delta);
  assertValidNode(r, delta + n.delta);
}
function assertValidTree(T) {
  if (T.root === SENTINEL) {
    return;
  }
  assert(getNodeColor(T.root) === NodeColor.Black);
  assert(depth(T.root.left) === depth(T.root.right));
  assertValidNode(T.root, 0);
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvaW50ZXJ2YWxUcmVlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSW50ZXJ2YWxOb2RlLCBJbnRlcnZhbFRyZWUsIE5vZGVDb2xvciwgU0VOVElORUwsIGdldE5vZGVDb2xvciwgaW50ZXJ2YWxDb21wYXJlLCBub2RlQWNjZXB0RWRpdCwgc2V0Tm9kZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvaW50ZXJ2YWxUcmVlLmpzJztcblxuY29uc3QgR0VORVJBVEVfVEVTVFMgPSBmYWxzZTtcbmNvbnN0IFRFU1RfQ09VTlQgPSBHRU5FUkFURV9URVNUUyA/IDEwMDAwIDogMDtcbmNvbnN0IFBSSU5UX1RSRUUgPSBmYWxzZTtcbmNvbnN0IE1JTl9JTlRFUlZBTF9TVEFSVCA9IDE7XG5jb25zdCBNQVhfSU5URVJWQUxfRU5EID0gMTAwO1xuY29uc3QgTUlOX0lOU0VSVFMgPSAxO1xuY29uc3QgTUFYX0lOU0VSVFMgPSAzMDtcbmNvbnN0IE1JTl9DSEFOR0VfQ05UID0gMTA7XG5jb25zdCBNQVhfQ0hBTkdFX0NOVCA9IDIwO1xuXG5zdWl0ZSgnSW50ZXJ2YWxUcmVlIDEnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y2xhc3MgSW50ZXJ2YWwge1xuXHRcdF9pbnRlcnZhbEJyYW5kOiB2b2lkID0gdW5kZWZpbmVkO1xuXG5cdFx0cHVibGljIHN0YXJ0OiBudW1iZXI7XG5cdFx0cHVibGljIGVuZDogbnVtYmVyO1xuXG5cdFx0Y29uc3RydWN0b3Ioc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIpIHtcblx0XHRcdHRoaXMuc3RhcnQgPSBzdGFydDtcblx0XHRcdHRoaXMuZW5kID0gZW5kO1xuXHRcdH1cblx0fVxuXG5cdGNsYXNzIE9yYWNsZSB7XG5cdFx0cHVibGljIGludGVydmFsczogSW50ZXJ2YWxbXTtcblxuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0dGhpcy5pbnRlcnZhbHMgPSBbXTtcblx0XHR9XG5cblx0XHRwdWJsaWMgaW5zZXJ0KGludGVydmFsOiBJbnRlcnZhbCk6IEludGVydmFsIHtcblx0XHRcdHRoaXMuaW50ZXJ2YWxzLnB1c2goaW50ZXJ2YWwpO1xuXHRcdFx0dGhpcy5pbnRlcnZhbHMuc29ydCgoYSwgYikgPT4ge1xuXHRcdFx0XHRpZiAoYS5zdGFydCA9PT0gYi5zdGFydCkge1xuXHRcdFx0XHRcdHJldHVybiBhLmVuZCAtIGIuZW5kO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBhLnN0YXJ0IC0gYi5zdGFydDtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIGludGVydmFsO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBkZWxldGUoaW50ZXJ2YWw6IEludGVydmFsKTogdm9pZCB7XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5pbnRlcnZhbHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0aWYgKHRoaXMuaW50ZXJ2YWxzW2ldID09PSBpbnRlcnZhbCkge1xuXHRcdFx0XHRcdHRoaXMuaW50ZXJ2YWxzLnNwbGljZShpLCAxKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRwdWJsaWMgc2VhcmNoKGludGVydmFsOiBJbnRlcnZhbCk6IEludGVydmFsW10ge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBJbnRlcnZhbFtdID0gW107XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5pbnRlcnZhbHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgaW50ID0gdGhpcy5pbnRlcnZhbHNbaV07XG5cdFx0XHRcdGlmIChpbnQuc3RhcnQgPD0gaW50ZXJ2YWwuZW5kICYmIGludC5lbmQgPj0gaW50ZXJ2YWwuc3RhcnQpIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaChpbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0fVxuXG5cdGNsYXNzIFRlc3RTdGF0ZSB7XG5cdFx0cHJpdmF0ZSBfb3JhY2xlOiBPcmFjbGUgPSBuZXcgT3JhY2xlKCk7XG5cdFx0cHJpdmF0ZSBfdHJlZTogSW50ZXJ2YWxUcmVlID0gbmV3IEludGVydmFsVHJlZSgpO1xuXHRcdHByaXZhdGUgX2xhc3ROb2RlSWQgPSAtMTtcblx0XHRwcml2YXRlIF90cmVlTm9kZXM6IEFycmF5PEludGVydmFsTm9kZSB8IG51bGw+ID0gW107XG5cdFx0cHJpdmF0ZSBfb3JhY2xlTm9kZXM6IEFycmF5PEludGVydmFsIHwgbnVsbD4gPSBbXTtcblxuXHRcdHB1YmxpYyBhY2NlcHRPcChvcDogSU9wZXJhdGlvbik6IHZvaWQge1xuXG5cdFx0XHRpZiAob3AudHlwZSA9PT0gJ2luc2VydCcpIHtcblx0XHRcdFx0aWYgKFBSSU5UX1RSRUUpIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhgaW5zZXJ0OiB7JHtKU09OLnN0cmluZ2lmeShuZXcgSW50ZXJ2YWwob3AuYmVnaW4sIG9wLmVuZCkpfX1gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBub2RlSWQgPSAoKyt0aGlzLl9sYXN0Tm9kZUlkKTtcblx0XHRcdFx0dGhpcy5fdHJlZU5vZGVzW25vZGVJZF0gPSBuZXcgSW50ZXJ2YWxOb2RlKG51bGwhLCBvcC5iZWdpbiwgb3AuZW5kKTtcblx0XHRcdFx0dGhpcy5fdHJlZS5pbnNlcnQodGhpcy5fdHJlZU5vZGVzW25vZGVJZF0hKTtcblx0XHRcdFx0dGhpcy5fb3JhY2xlTm9kZXNbbm9kZUlkXSA9IHRoaXMuX29yYWNsZS5pbnNlcnQobmV3IEludGVydmFsKG9wLmJlZ2luLCBvcC5lbmQpKTtcblx0XHRcdH0gZWxzZSBpZiAob3AudHlwZSA9PT0gJ2RlbGV0ZScpIHtcblx0XHRcdFx0aWYgKFBSSU5UX1RSRUUpIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhgZGVsZXRlOiB7JHtKU09OLnN0cmluZ2lmeSh0aGlzLl9vcmFjbGVOb2Rlc1tvcC5pZF0pfX1gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl90cmVlLmRlbGV0ZSh0aGlzLl90cmVlTm9kZXNbb3AuaWRdISk7XG5cdFx0XHRcdHRoaXMuX29yYWNsZS5kZWxldGUodGhpcy5fb3JhY2xlTm9kZXNbb3AuaWRdISk7XG5cblx0XHRcdFx0dGhpcy5fdHJlZU5vZGVzW29wLmlkXSA9IG51bGw7XG5cdFx0XHRcdHRoaXMuX29yYWNsZU5vZGVzW29wLmlkXSA9IG51bGw7XG5cdFx0XHR9IGVsc2UgaWYgKG9wLnR5cGUgPT09ICdjaGFuZ2UnKSB7XG5cblx0XHRcdFx0dGhpcy5fdHJlZS5kZWxldGUodGhpcy5fdHJlZU5vZGVzW29wLmlkXSEpO1xuXHRcdFx0XHR0aGlzLl90cmVlTm9kZXNbb3AuaWRdIS5yZXNldCgwLCBvcC5iZWdpbiwgb3AuZW5kLCBudWxsISk7XG5cdFx0XHRcdHRoaXMuX3RyZWUuaW5zZXJ0KHRoaXMuX3RyZWVOb2Rlc1tvcC5pZF0hKTtcblxuXHRcdFx0XHR0aGlzLl9vcmFjbGUuZGVsZXRlKHRoaXMuX29yYWNsZU5vZGVzW29wLmlkXSEpO1xuXHRcdFx0XHR0aGlzLl9vcmFjbGVOb2Rlc1tvcC5pZF0hLnN0YXJ0ID0gb3AuYmVnaW47XG5cdFx0XHRcdHRoaXMuX29yYWNsZU5vZGVzW29wLmlkXSEuZW5kID0gb3AuZW5kO1xuXHRcdFx0XHR0aGlzLl9vcmFjbGUuaW5zZXJ0KHRoaXMuX29yYWNsZU5vZGVzW29wLmlkXSEpO1xuXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBhY3R1YWxOb2RlcyA9IHRoaXMuX3RyZWUuaW50ZXJ2YWxTZWFyY2gob3AuYmVnaW4sIG9wLmVuZCwgMCwgZmFsc2UsIDAsIGZhbHNlKTtcblx0XHRcdFx0Y29uc3QgYWN0dWFsID0gYWN0dWFsTm9kZXMubWFwKG4gPT4gbmV3IEludGVydmFsKG4uY2FjaGVkQWJzb2x1dGVTdGFydCwgbi5jYWNoZWRBYnNvbHV0ZUVuZCkpO1xuXHRcdFx0XHRjb25zdCBleHBlY3RlZCA9IHRoaXMuX29yYWNsZS5zZWFyY2gobmV3IEludGVydmFsKG9wLmJlZ2luLCBvcC5lbmQpKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoUFJJTlRfVFJFRSkge1xuXHRcdFx0XHRwcmludFRyZWUodGhpcy5fdHJlZSk7XG5cdFx0XHR9XG5cblx0XHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHRoaXMuX3RyZWUpO1xuXG5cdFx0XHRjb25zdCBhY3R1YWwgPSB0aGlzLl90cmVlLmdldEFsbEluT3JkZXIoKS5tYXAobiA9PiBuZXcgSW50ZXJ2YWwobi5jYWNoZWRBYnNvbHV0ZVN0YXJ0LCBuLmNhY2hlZEFic29sdXRlRW5kKSk7XG5cdFx0XHRjb25zdCBleHBlY3RlZCA9IHRoaXMuX29yYWNsZS5pbnRlcnZhbHM7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBnZXRFeGlzdGluZ05vZGVJZChpbmRleDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRcdGxldCBjdXJySW5kZXggPSAtMTtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fdHJlZU5vZGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmICh0aGlzLl90cmVlTm9kZXNbaV0gPT09IG51bGwpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjdXJySW5kZXgrKztcblx0XHRcdFx0aWYgKGN1cnJJbmRleCA9PT0gaW5kZXgpIHtcblx0XHRcdFx0XHRyZXR1cm4gaTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCd1bmV4cGVjdGVkJyk7XG5cdFx0fVxuXHR9XG5cblx0aW50ZXJmYWNlIElJbnNlcnRPcGVyYXRpb24ge1xuXHRcdHR5cGU6ICdpbnNlcnQnO1xuXHRcdGJlZ2luOiBudW1iZXI7XG5cdFx0ZW5kOiBudW1iZXI7XG5cdH1cblxuXHRpbnRlcmZhY2UgSURlbGV0ZU9wZXJhdGlvbiB7XG5cdFx0dHlwZTogJ2RlbGV0ZSc7XG5cdFx0aWQ6IG51bWJlcjtcblx0fVxuXG5cdGludGVyZmFjZSBJQ2hhbmdlT3BlcmF0aW9uIHtcblx0XHR0eXBlOiAnY2hhbmdlJztcblx0XHRpZDogbnVtYmVyO1xuXHRcdGJlZ2luOiBudW1iZXI7XG5cdFx0ZW5kOiBudW1iZXI7XG5cdH1cblxuXHRpbnRlcmZhY2UgSVNlYXJjaE9wZXJhdGlvbiB7XG5cdFx0dHlwZTogJ3NlYXJjaCc7XG5cdFx0YmVnaW46IG51bWJlcjtcblx0XHRlbmQ6IG51bWJlcjtcblx0fVxuXG5cdHR5cGUgSU9wZXJhdGlvbiA9IElJbnNlcnRPcGVyYXRpb24gfCBJRGVsZXRlT3BlcmF0aW9uIHwgSUNoYW5nZU9wZXJhdGlvbiB8IElTZWFyY2hPcGVyYXRpb247XG5cblx0ZnVuY3Rpb24gdGVzdEludGVydmFsVHJlZShvcHM6IElPcGVyYXRpb25bXSk6IHZvaWQge1xuXHRcdGNvbnN0IHN0YXRlID0gbmV3IFRlc3RTdGF0ZSgpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgb3BzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRzdGF0ZS5hY2NlcHRPcChvcHNbaV0pO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGdldFJhbmRvbUludChtaW46IG51bWJlciwgbWF4OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluICsgMSkpICsgbWluO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0UmFuZG9tUmFuZ2UobWluOiBudW1iZXIsIG1heDogbnVtYmVyKTogW251bWJlciwgbnVtYmVyXSB7XG5cdFx0Y29uc3QgYmVnaW4gPSBnZXRSYW5kb21JbnQobWluLCBtYXgpO1xuXHRcdGxldCBsZW5ndGg6IG51bWJlcjtcblx0XHRpZiAoZ2V0UmFuZG9tSW50KDEsIDEwKSA8PSAyKSB7XG5cdFx0XHQvLyBsYXJnZSByYW5nZVxuXHRcdFx0bGVuZ3RoID0gZ2V0UmFuZG9tSW50KDAsIG1heCAtIGJlZ2luKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gc21hbGwgcmFuZ2Vcblx0XHRcdGxlbmd0aCA9IGdldFJhbmRvbUludCgwLCBNYXRoLm1pbihtYXggLSBiZWdpbiwgMTApKTtcblx0XHR9XG5cdFx0cmV0dXJuIFtiZWdpbiwgYmVnaW4gKyBsZW5ndGhdO1xuXHR9XG5cblx0Y2xhc3MgQXV0b1Rlc3Qge1xuXHRcdHByaXZhdGUgX29wczogSU9wZXJhdGlvbltdID0gW107XG5cdFx0cHJpdmF0ZSBfc3RhdGU6IFRlc3RTdGF0ZSA9IG5ldyBUZXN0U3RhdGUoKTtcblx0XHRwcml2YXRlIF9pbnNlcnRDbnQ6IG51bWJlcjtcblx0XHRwcml2YXRlIF9kZWxldGVDbnQ6IG51bWJlcjtcblx0XHRwcml2YXRlIF9jaGFuZ2VDbnQ6IG51bWJlcjtcblxuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0dGhpcy5faW5zZXJ0Q250ID0gZ2V0UmFuZG9tSW50KE1JTl9JTlNFUlRTLCBNQVhfSU5TRVJUUyk7XG5cdFx0XHR0aGlzLl9jaGFuZ2VDbnQgPSBnZXRSYW5kb21JbnQoTUlOX0NIQU5HRV9DTlQsIE1BWF9DSEFOR0VfQ05UKTtcblx0XHRcdHRoaXMuX2RlbGV0ZUNudCA9IDA7XG5cdFx0fVxuXG5cdFx0cHJpdmF0ZSBfZG9SYW5kb21JbnNlcnQoKTogdm9pZCB7XG5cdFx0XHRjb25zdCByYW5nZSA9IGdldFJhbmRvbVJhbmdlKE1JTl9JTlRFUlZBTF9TVEFSVCwgTUFYX0lOVEVSVkFMX0VORCk7XG5cdFx0XHR0aGlzLl9ydW4oe1xuXHRcdFx0XHR0eXBlOiAnaW5zZXJ0Jyxcblx0XHRcdFx0YmVnaW46IHJhbmdlWzBdLFxuXHRcdFx0XHRlbmQ6IHJhbmdlWzFdXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRwcml2YXRlIF9kb1JhbmRvbURlbGV0ZSgpOiB2b2lkIHtcblx0XHRcdGNvbnN0IGlkeCA9IGdldFJhbmRvbUludChNYXRoLmZsb29yKHRoaXMuX2RlbGV0ZUNudCAvIDIpLCB0aGlzLl9kZWxldGVDbnQgLSAxKTtcblx0XHRcdHRoaXMuX3J1bih7XG5cdFx0XHRcdHR5cGU6ICdkZWxldGUnLFxuXHRcdFx0XHRpZDogdGhpcy5fc3RhdGUuZ2V0RXhpc3RpbmdOb2RlSWQoaWR4KVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cHJpdmF0ZSBfZG9SYW5kb21DaGFuZ2UoKTogdm9pZCB7XG5cdFx0XHRjb25zdCBpZHggPSBnZXRSYW5kb21JbnQoMCwgdGhpcy5fZGVsZXRlQ250IC0gMSk7XG5cdFx0XHRjb25zdCByYW5nZSA9IGdldFJhbmRvbVJhbmdlKE1JTl9JTlRFUlZBTF9TVEFSVCwgTUFYX0lOVEVSVkFMX0VORCk7XG5cdFx0XHR0aGlzLl9ydW4oe1xuXHRcdFx0XHR0eXBlOiAnY2hhbmdlJyxcblx0XHRcdFx0aWQ6IHRoaXMuX3N0YXRlLmdldEV4aXN0aW5nTm9kZUlkKGlkeCksXG5cdFx0XHRcdGJlZ2luOiByYW5nZVswXSxcblx0XHRcdFx0ZW5kOiByYW5nZVsxXVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cHVibGljIHJ1bigpIHtcblx0XHRcdHdoaWxlICh0aGlzLl9pbnNlcnRDbnQgPiAwIHx8IHRoaXMuX2RlbGV0ZUNudCA+IDAgfHwgdGhpcy5fY2hhbmdlQ250ID4gMCkge1xuXHRcdFx0XHRpZiAodGhpcy5faW5zZXJ0Q250ID4gMCkge1xuXHRcdFx0XHRcdHRoaXMuX2RvUmFuZG9tSW5zZXJ0KCk7XG5cdFx0XHRcdFx0dGhpcy5faW5zZXJ0Q250LS07XG5cdFx0XHRcdFx0dGhpcy5fZGVsZXRlQ250Kys7XG5cdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5fY2hhbmdlQ250ID4gMCkge1xuXHRcdFx0XHRcdHRoaXMuX2RvUmFuZG9tQ2hhbmdlKCk7XG5cdFx0XHRcdFx0dGhpcy5fY2hhbmdlQ250LS07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fZG9SYW5kb21EZWxldGUoKTtcblx0XHRcdFx0XHR0aGlzLl9kZWxldGVDbnQtLTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIExldCdzIGFsc28gc2VhcmNoIGZvciBzb21ldGhpbmcuLi5cblx0XHRcdFx0Y29uc3Qgc2VhcmNoUmFuZ2UgPSBnZXRSYW5kb21SYW5nZShNSU5fSU5URVJWQUxfU1RBUlQsIE1BWF9JTlRFUlZBTF9FTkQpO1xuXHRcdFx0XHR0aGlzLl9ydW4oe1xuXHRcdFx0XHRcdHR5cGU6ICdzZWFyY2gnLFxuXHRcdFx0XHRcdGJlZ2luOiBzZWFyY2hSYW5nZVswXSxcblx0XHRcdFx0XHRlbmQ6IHNlYXJjaFJhbmdlWzFdXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHByaXZhdGUgX3J1bihvcDogSU9wZXJhdGlvbik6IHZvaWQge1xuXHRcdFx0dGhpcy5fb3BzLnB1c2gob3ApO1xuXHRcdFx0dGhpcy5fc3RhdGUuYWNjZXB0T3Aob3ApO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBwcmludCgpOiB2b2lkIHtcblx0XHRcdGNvbnNvbGUubG9nKGB0ZXN0SW50ZXJ2YWxUcmVlKCR7SlNPTi5zdHJpbmdpZnkodGhpcy5fb3BzKX0pYCk7XG5cdFx0fVxuXG5cdH1cblxuXHRzdWl0ZSgnZ2VuZXJhdGVkJywgKCkgPT4ge1xuXHRcdHRlc3QoJ2dlbjAxJywgKCkgPT4ge1xuXHRcdFx0dGVzdEludGVydmFsVHJlZShbXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiAyOCwgZW5kOiAzNSB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogNTIsIGVuZDogNTQgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDYzLCBlbmQ6IDY5IH1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZ2VuMDInLCAoKSA9PiB7XG5cdFx0XHR0ZXN0SW50ZXJ2YWxUcmVlKFtcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDgwLCBlbmQ6IDg5IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA5MiwgZW5kOiAxMDAgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDk5LCBlbmQ6IDk5IH1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZ2VuMDMnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0SW50ZXJ2YWxUcmVlKFtcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDg5LCBlbmQ6IDk2IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA3MSwgZW5kOiA3NCB9LFxuXHRcdFx0XHR7IHR5cGU6ICdkZWxldGUnLCBpZDogMSB9XG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2dlbjA0JywgKCkgPT4ge1xuXHRcdFx0dGVzdEludGVydmFsVHJlZShbXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA0NCwgZW5kOiA0NiB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogODUsIGVuZDogODggfSxcblx0XHRcdFx0eyB0eXBlOiAnZGVsZXRlJywgaWQ6IDAgfVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnZW4wNScsICgpID0+IHtcblx0XHRcdHRlc3RJbnRlcnZhbFRyZWUoW1xuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogODIsIGVuZDogOTAgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDY5LCBlbmQ6IDczIH0sXG5cdFx0XHRcdHsgdHlwZTogJ2RlbGV0ZScsIGlkOiAwIH0sXG5cdFx0XHRcdHsgdHlwZTogJ2RlbGV0ZScsIGlkOiAxIH1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZ2VuMDYnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0SW50ZXJ2YWxUcmVlKFtcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDQxLCBlbmQ6IDYzIH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA5OCwgZW5kOiA5OCB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogNDcsIGVuZDogNTEgfSxcblx0XHRcdFx0eyB0eXBlOiAnZGVsZXRlJywgaWQ6IDIgfVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnZW4wNycsICgpID0+IHtcblx0XHRcdHRlc3RJbnRlcnZhbFRyZWUoW1xuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogMjQsIGVuZDogMjYgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDExLCBlbmQ6IDI4IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiAyNywgZW5kOiAzMCB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogODAsIGVuZDogODUgfSxcblx0XHRcdFx0eyB0eXBlOiAnZGVsZXRlJywgaWQ6IDEgfVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnZW4wOCcsICgpID0+IHtcblx0XHRcdHRlc3RJbnRlcnZhbFRyZWUoW1xuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogMTAwLCBlbmQ6IDEwMCB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogMTAwLCBlbmQ6IDEwMCB9XG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2dlbjA5JywgKCkgPT4ge1xuXHRcdFx0dGVzdEludGVydmFsVHJlZShbXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA1OCwgZW5kOiA2NSB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogODIsIGVuZDogOTYgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDU4LCBlbmQ6IDY1IH1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZ2VuMTAnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0SW50ZXJ2YWxUcmVlKFtcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDMyLCBlbmQ6IDQwIH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiAyNSwgZW5kOiAyOSB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogMjQsIGVuZDogMzIgfVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnZW4xMScsICgpID0+IHtcblx0XHRcdHRlc3RJbnRlcnZhbFRyZWUoW1xuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogMjUsIGVuZDogNzAgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDk5LCBlbmQ6IDEwMCB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogNDYsIGVuZDogNTEgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDU3LCBlbmQ6IDU3IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2RlbGV0ZScsIGlkOiAyIH1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZ2VuMTInLCAoKSA9PiB7XG5cdFx0XHR0ZXN0SW50ZXJ2YWxUcmVlKFtcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDIwLCBlbmQ6IDI2IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiAxMCwgZW5kOiAxOCB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogOTksIGVuZDogOTkgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDM3LCBlbmQ6IDU5IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2RlbGV0ZScsIGlkOiAyIH1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZ2VuMTMnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0SW50ZXJ2YWxUcmVlKFtcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDMsIGVuZDogOTEgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDU3LCBlbmQ6IDU3IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiAzNSwgZW5kOiA0NCB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogNzIsIGVuZDogODEgfSxcblx0XHRcdFx0eyB0eXBlOiAnZGVsZXRlJywgaWQ6IDIgfVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnZW4xNCcsICgpID0+IHtcblx0XHRcdHRlc3RJbnRlcnZhbFRyZWUoW1xuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogNTgsIGVuZDogNjEgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDM0LCBlbmQ6IDM1IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA1NiwgZW5kOiA2MiB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogNjksIGVuZDogNzggfSxcblx0XHRcdFx0eyB0eXBlOiAnZGVsZXRlJywgaWQ6IDAgfVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnZW4xNScsICgpID0+IHtcblx0XHRcdHRlc3RJbnRlcnZhbFRyZWUoW1xuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogNjMsIGVuZDogNjkgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDE3LCBlbmQ6IDI0IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiAzLCBlbmQ6IDEzIH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA4NCwgZW5kOiA5NCB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogMTgsIGVuZDogMjMgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDk2LCBlbmQ6IDk4IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2RlbGV0ZScsIGlkOiAxIH1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZ2VuMTYnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0SW50ZXJ2YWxUcmVlKFtcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDI3LCBlbmQ6IDI3IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA0MiwgZW5kOiA4NyB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogNDIsIGVuZDogNDkgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDY5LCBlbmQ6IDcxIH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiAyMCwgZW5kOiAyNyB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogOCwgZW5kOiA5IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA0MiwgZW5kOiA0OSB9LFxuXHRcdFx0XHR7IHR5cGU6ICdkZWxldGUnLCBpZDogMSB9XG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2dlbjE3JywgKCkgPT4ge1xuXHRcdFx0dGVzdEludGVydmFsVHJlZShbXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiAyMSwgZW5kOiAyMyB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogODMsIGVuZDogODcgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDU2LCBlbmQ6IDU4IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiAxLCBlbmQ6IDU1IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA1NiwgZW5kOiA1OSB9LFxuXHRcdFx0XHR7IHR5cGU6ICdpbnNlcnQnLCBiZWdpbjogNTgsIGVuZDogNjAgfSxcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDU2LCBlbmQ6IDY1IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2RlbGV0ZScsIGlkOiAxIH0sXG5cdFx0XHRcdHsgdHlwZTogJ2RlbGV0ZScsIGlkOiAwIH0sXG5cdFx0XHRcdHsgdHlwZTogJ2RlbGV0ZScsIGlkOiA2IH1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZ2VuMTgnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0SW50ZXJ2YWxUcmVlKFtcblx0XHRcdFx0eyB0eXBlOiAnaW5zZXJ0JywgYmVnaW46IDI1LCBlbmQ6IDI1IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA2NywgZW5kOiA3OSB9LFxuXHRcdFx0XHR7IHR5cGU6ICdkZWxldGUnLCBpZDogMCB9LFxuXHRcdFx0XHR7IHR5cGU6ICdzZWFyY2gnLCBiZWdpbjogNjUsIGVuZDogNzUgfVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdmb3JjZSBkZWx0YSBvdmVyZmxvdycsICgpID0+IHtcblx0XHRcdC8vIFNlYXJjaCB0aGUgSW50ZXJ2YWxOb2RlIGN0b3IgZm9yIEZPUkNFX09WRVJGTE9XSU5HX1RFU1Rcblx0XHRcdC8vIHRvIGZvcmNlIHRoYXQgdGhpcyB0ZXN0IGxlYWRzIHRvIGEgZGVsdGEgbm9ybWFsaXphdGlvblxuXHRcdFx0dGVzdEludGVydmFsVHJlZShbXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA2ODYwODExMzg1OTM0MjcsIGVuZDogNzMzMDA5ODU2NTAyMjYwIH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA1OTEwMzEzMjYxODE2NjksIGVuZDogNTkxMDMxMzI2MTgxNjcyIH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA5NDAwMzc2ODI3MzE4OTYsIGVuZDogOTQwMDM3NjgyNzMxOTAzIH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA1OTg0MTM2NDExNTExMjAsIGVuZDogNTk4NDEzNjQxMTUxMTI4IH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA4MDA1NjQxNTY1NTMzNDQsIGVuZDogODAwNTY0MTU2NTUzMzUxIH0sXG5cdFx0XHRcdHsgdHlwZTogJ2luc2VydCcsIGJlZ2luOiA4OTQxOTg5NTc1NjU0ODEsIGVuZDogODk0MTk4OTU3NTY1NDkxIH1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHQvLyBURVNUX0NPVU5UID0gMDtcblx0Ly8gUFJJTlRfVFJFRSA9IHRydWU7XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBURVNUX0NPVU5UOyBpKyspIHtcblx0XHRpZiAoaSAlIDEwMCA9PT0gMCkge1xuXHRcdFx0Y29uc29sZS5sb2coYFRFU1QgJHtpICsgMX0vJHtURVNUX0NPVU5UfWApO1xuXHRcdH1cblx0XHRjb25zdCB0ZXN0ID0gbmV3IEF1dG9UZXN0KCk7XG5cblx0XHR0cnkge1xuXHRcdFx0dGVzdC5ydW4oKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdGNvbnNvbGUubG9nKGVycik7XG5cdFx0XHR0ZXN0LnByaW50KCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0c3VpdGUoJ3NlYXJjaGluZycsICgpID0+IHtcblxuXHRcdGZ1bmN0aW9uIGNyZWF0ZUNvcm1lblRyZWUoKTogSW50ZXJ2YWxUcmVlIHtcblx0XHRcdGNvbnN0IHIgPSBuZXcgSW50ZXJ2YWxUcmVlKCk7XG5cdFx0XHRjb25zdCBkYXRhOiBbbnVtYmVyLCBudW1iZXJdW10gPSBbXG5cdFx0XHRcdFsxNiwgMjFdLFxuXHRcdFx0XHRbOCwgOV0sXG5cdFx0XHRcdFsyNSwgMzBdLFxuXHRcdFx0XHRbNSwgOF0sXG5cdFx0XHRcdFsxNSwgMjNdLFxuXHRcdFx0XHRbMTcsIDE5XSxcblx0XHRcdFx0WzI2LCAyNl0sXG5cdFx0XHRcdFswLCAzXSxcblx0XHRcdFx0WzYsIDEwXSxcblx0XHRcdFx0WzE5LCAyMF1cblx0XHRcdF07XG5cdFx0XHRkYXRhLmZvckVhY2goKGludCkgPT4ge1xuXHRcdFx0XHRjb25zdCBub2RlID0gbmV3IEludGVydmFsTm9kZShudWxsISwgaW50WzBdLCBpbnRbMV0pO1xuXHRcdFx0XHRyLmluc2VydChub2RlKTtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHI7XG5cdFx0fVxuXG5cdFx0Y29uc3QgVCA9IGNyZWF0ZUNvcm1lblRyZWUoKTtcblxuXHRcdGZ1bmN0aW9uIGFzc2VydEludGVydmFsU2VhcmNoKHN0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyLCBleHBlY3RlZDogW251bWJlciwgbnVtYmVyXVtdKTogdm9pZCB7XG5cdFx0XHRjb25zdCBhY3R1YWxOb2RlcyA9IFQuaW50ZXJ2YWxTZWFyY2goc3RhcnQsIGVuZCwgMCwgZmFsc2UsIDAsIGZhbHNlKTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IGFjdHVhbE5vZGVzLm1hcCgobikgPT4gPFtudW1iZXIsIG51bWJlcl0+W24uY2FjaGVkQWJzb2x1dGVTdGFydCwgbi5jYWNoZWRBYnNvbHV0ZUVuZF0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0XHR9XG5cblx0XHR0ZXN0KCdjb3JtZW4gMS0+MicsICgpID0+IHtcblx0XHRcdGFzc2VydEludGVydmFsU2VhcmNoKFxuXHRcdFx0XHQxLCAyLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0WzAsIDNdLFxuXHRcdFx0XHRdXG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnY29ybWVuIDQtPjgnLCAoKSA9PiB7XG5cdFx0XHRhc3NlcnRJbnRlcnZhbFNlYXJjaChcblx0XHRcdFx0NCwgOCxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdFs1LCA4XSxcblx0XHRcdFx0XHRbNiwgMTBdLFxuXHRcdFx0XHRcdFs4LCA5XSxcblx0XHRcdFx0XVxuXHRcdFx0KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2Nvcm1lbiAxMC0+MTUnLCAoKSA9PiB7XG5cdFx0XHRhc3NlcnRJbnRlcnZhbFNlYXJjaChcblx0XHRcdFx0MTAsIDE1LFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0WzYsIDEwXSxcblx0XHRcdFx0XHRbMTUsIDIzXSxcblx0XHRcdFx0XVxuXHRcdFx0KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2Nvcm1lbiAyMS0+MjUnLCAoKSA9PiB7XG5cdFx0XHRhc3NlcnRJbnRlcnZhbFNlYXJjaChcblx0XHRcdFx0MjEsIDI1LFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0WzE1LCAyM10sXG5cdFx0XHRcdFx0WzE2LCAyMV0sXG5cdFx0XHRcdFx0WzI1LCAzMF0sXG5cdFx0XHRcdF1cblx0XHRcdCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdjb3JtZW4gMjQtPjI0JywgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0SW50ZXJ2YWxTZWFyY2goXG5cdFx0XHRcdDI0LCAyNCxcblx0XHRcdFx0W1xuXHRcdFx0XHRdXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnSW50ZXJ2YWxUcmVlIDInLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gYXNzZXJ0Tm9kZUFjY2VwdEVkaXQobXNnOiBzdHJpbmcsIG5vZGVTdGFydDogbnVtYmVyLCBub2RlRW5kOiBudW1iZXIsIG5vZGVTdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLCBzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlciwgdGV4dExlbmd0aDogbnVtYmVyLCBmb3JjZU1vdmVNYXJrZXJzOiBib29sZWFuLCBleHBlY3RlZE5vZGVTdGFydDogbnVtYmVyLCBleHBlY3RlZE5vZGVFbmQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IG5vZGUgPSBuZXcgSW50ZXJ2YWxOb2RlKCcnLCBub2RlU3RhcnQsIG5vZGVFbmQpO1xuXHRcdHNldE5vZGVTdGlja2luZXNzKG5vZGUsIG5vZGVTdGlja2luZXNzKTtcblx0XHRub2RlQWNjZXB0RWRpdChub2RlLCBzdGFydCwgZW5kLCB0ZXh0TGVuZ3RoLCBmb3JjZU1vdmVNYXJrZXJzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFtub2RlLnN0YXJ0LCBub2RlLmVuZF0sIFtleHBlY3RlZE5vZGVTdGFydCwgZXhwZWN0ZWROb2RlRW5kXSwgbXNnKTtcblx0fVxuXG5cdHRlc3QoJ25vZGVBY2NlcHRFZGl0JywgKCkgPT4ge1xuXHRcdC8vIEEuIGNvbGxhcHNlZCBkZWNvcmF0aW9uXG5cdFx0e1xuXHRcdFx0Ly8gbm8tb3Bcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdBLjAwMCcsIDAsIDAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgMCwgMCwgMCwgZmFsc2UsIDAsIDApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0EuMDAxJywgMCwgMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDAsIDAsIDAsIGZhbHNlLCAwLCAwKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdBLjAwMicsIDAsIDAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgMCwgMCwgMCwgZmFsc2UsIDAsIDApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0EuMDAzJywgMCwgMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDAsIDAsIDAsIGZhbHNlLCAwLCAwKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdBLjAwNCcsIDAsIDAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgMCwgMCwgMCwgdHJ1ZSwgMCwgMCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQS4wMDUnLCAwLCAwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgMCwgMCwgMCwgdHJ1ZSwgMCwgMCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQS4wMDYnLCAwLCAwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDAsIDAsIDAsIHRydWUsIDAsIDApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0EuMDA3JywgMCwgMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDAsIDAsIDAsIHRydWUsIDAsIDApO1xuXHRcdFx0Ly8gaW5zZXJ0aW9uXG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQS4wMDgnLCAwLCAwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDAsIDAsIDEsIGZhbHNlLCAwLCAxKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdBLjAwOScsIDAsIDAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCAwLCAwLCAxLCBmYWxzZSwgMSwgMSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQS4wMTAnLCAwLCAwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDAsIDAsIDEsIGZhbHNlLCAwLCAwKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdBLjAxMScsIDAsIDAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCAwLCAwLCAxLCBmYWxzZSwgMSwgMSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQS4wMTInLCAwLCAwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDAsIDAsIDEsIHRydWUsIDEsIDEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0EuMDEzJywgMCwgMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDAsIDAsIDEsIHRydWUsIDEsIDEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0EuMDE0JywgMCwgMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlLCAwLCAwLCAxLCB0cnVlLCAxLCAxKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdBLjAxNScsIDAsIDAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCAwLCAwLCAxLCB0cnVlLCAxLCAxKTtcblx0XHR9XG5cblx0XHQvLyBCLiBub24gY29sbGFwc2VkIGRlY29yYXRpb25cblx0XHR7XG5cdFx0XHQvLyBuby1vcFxuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDAwJywgMCwgNSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCAwLCAwLCAwLCBmYWxzZSwgMCwgNSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wMDEnLCAwLCA1LCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgMCwgMCwgMCwgZmFsc2UsIDAsIDUpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDAyJywgMCwgNSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlLCAwLCAwLCAwLCBmYWxzZSwgMCwgNSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wMDMnLCAwLCA1LCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgMCwgMCwgMCwgZmFsc2UsIDAsIDUpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDA0JywgMCwgNSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCAwLCAwLCAwLCB0cnVlLCAwLCA1KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjAwNScsIDAsIDUsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCAwLCAwLCAwLCB0cnVlLCAwLCA1KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjAwNicsIDAsIDUsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgMCwgMCwgMCwgdHJ1ZSwgMCwgNSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wMDcnLCAwLCA1LCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgMCwgMCwgMCwgdHJ1ZSwgMCwgNSk7XG5cdFx0XHQvLyBpbnNlcnRpb24gYXQgc3RhcnRcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjAwOCcsIDAsIDUsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgMCwgMCwgMSwgZmFsc2UsIDAsIDYpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDA5JywgMCwgNSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDAsIDAsIDEsIGZhbHNlLCAxLCA2KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjAxMCcsIDAsIDUsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgMCwgMCwgMSwgZmFsc2UsIDAsIDYpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDExJywgMCwgNSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDAsIDAsIDEsIGZhbHNlLCAxLCA2KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjAxMicsIDAsIDUsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgMCwgMCwgMSwgdHJ1ZSwgMSwgNik7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wMTMnLCAwLCA1LCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgMCwgMCwgMSwgdHJ1ZSwgMSwgNik7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wMTQnLCAwLCA1LCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDAsIDAsIDEsIHRydWUsIDEsIDYpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDE1JywgMCwgNSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDAsIDAsIDEsIHRydWUsIDEsIDYpO1xuXHRcdFx0Ly8gaW5zZXJ0aW9uIGluIG1pZGRsZVxuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDE2JywgMCwgNSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCAyLCAyLCAxLCBmYWxzZSwgMCwgNik7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wMTcnLCAwLCA1LCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgMiwgMiwgMSwgZmFsc2UsIDAsIDYpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDE4JywgMCwgNSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlLCAyLCAyLCAxLCBmYWxzZSwgMCwgNik7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wMTknLCAwLCA1LCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgMiwgMiwgMSwgZmFsc2UsIDAsIDYpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDIwJywgMCwgNSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCAyLCAyLCAxLCB0cnVlLCAwLCA2KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjAyMScsIDAsIDUsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCAyLCAyLCAxLCB0cnVlLCAwLCA2KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjAyMicsIDAsIDUsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgMiwgMiwgMSwgdHJ1ZSwgMCwgNik7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wMjMnLCAwLCA1LCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgMiwgMiwgMSwgdHJ1ZSwgMCwgNik7XG5cdFx0XHQvLyBpbnNlcnRpb24gYXQgZW5kXG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wMjQnLCAwLCA1LCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDUsIDUsIDEsIGZhbHNlLCAwLCA2KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjAyNScsIDAsIDUsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA1LCA1LCAxLCBmYWxzZSwgMCwgNSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wMjYnLCAwLCA1LCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDUsIDUsIDEsIGZhbHNlLCAwLCA1KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjAyNycsIDAsIDUsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA1LCA1LCAxLCBmYWxzZSwgMCwgNik7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wMjgnLCAwLCA1LCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDUsIDUsIDEsIHRydWUsIDAsIDYpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDI5JywgMCwgNSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDUsIDUsIDEsIHRydWUsIDAsIDYpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDMwJywgMCwgNSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlLCA1LCA1LCAxLCB0cnVlLCAwLCA2KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjAzMScsIDAsIDUsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA1LCA1LCAxLCB0cnVlLCAwLCA2KTtcblxuXHRcdFx0Ly8gcmVwbGFjZSB3aXRoIGxhcmdlciB0ZXh0IHVudGlsIHN0YXJ0XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wMzInLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA0LCA1LCAyLCBmYWxzZSwgNSwgMTEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDMzJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA0LCA1LCAyLCBmYWxzZSwgNiwgMTEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDM0JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgNCwgNSwgMiwgZmFsc2UsIDUsIDExKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjAzNScsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgNCwgNSwgMiwgZmFsc2UsIDYsIDExKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjAzNicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDQsIDUsIDIsIHRydWUsIDYsIDExKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjAzNycsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgNCwgNSwgMiwgdHJ1ZSwgNiwgMTEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDM4JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgNCwgNSwgMiwgdHJ1ZSwgNiwgMTEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDM5JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA0LCA1LCAyLCB0cnVlLCA2LCAxMSk7XG5cdFx0XHQvLyByZXBsYWNlIHdpdGggc21hbGxlciB0ZXh0IHVudGlsIHN0YXJ0XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wNDAnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCAzLCA1LCAxLCBmYWxzZSwgNCwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wNDEnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDMsIDUsIDEsIGZhbHNlLCA0LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA0MicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDMsIDUsIDEsIGZhbHNlLCA0LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA0MycsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgMywgNSwgMSwgZmFsc2UsIDQsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDQ0JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgMywgNSwgMSwgdHJ1ZSwgNCwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wNDUnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDMsIDUsIDEsIHRydWUsIDQsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDQ2JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgMywgNSwgMSwgdHJ1ZSwgNCwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wNDcnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDMsIDUsIDEsIHRydWUsIDQsIDkpO1xuXG5cdFx0XHQvLyByZXBsYWNlIHdpdGggbGFyZ2VyIHRleHQgc2VsZWN0IHN0YXJ0XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wNDgnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA0LCA2LCAzLCBmYWxzZSwgNSwgMTEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDQ5JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA0LCA2LCAzLCBmYWxzZSwgNSwgMTEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDUwJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgNCwgNiwgMywgZmFsc2UsIDUsIDExKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA1MScsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgNCwgNiwgMywgZmFsc2UsIDUsIDExKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA1MicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDQsIDYsIDMsIHRydWUsIDcsIDExKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA1MycsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgNCwgNiwgMywgdHJ1ZSwgNywgMTEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDU0JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgNCwgNiwgMywgdHJ1ZSwgNywgMTEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDU1JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA0LCA2LCAzLCB0cnVlLCA3LCAxMSk7XG5cdFx0XHQvLyByZXBsYWNlIHdpdGggc21hbGxlciB0ZXh0IHNlbGVjdCBzdGFydFxuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDU2JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgNCwgNiwgMSwgZmFsc2UsIDUsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDU3JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA0LCA2LCAxLCBmYWxzZSwgNSwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wNTgnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlLCA0LCA2LCAxLCBmYWxzZSwgNSwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wNTknLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDQsIDYsIDEsIGZhbHNlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA2MCcsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDQsIDYsIDEsIHRydWUsIDUsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDYxJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA0LCA2LCAxLCB0cnVlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA2MicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDQsIDYsIDEsIHRydWUsIDUsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDYzJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA0LCA2LCAxLCB0cnVlLCA1LCA5KTtcblxuXHRcdFx0Ly8gcmVwbGFjZSB3aXRoIGxhcmdlciB0ZXh0IGZyb20gc3RhcnRcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA2NCcsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDUsIDYsIDIsIGZhbHNlLCA1LCAxMSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wNjUnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDUsIDYsIDIsIGZhbHNlLCA1LCAxMSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wNjYnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlLCA1LCA2LCAyLCBmYWxzZSwgNSwgMTEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDY3JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA1LCA2LCAyLCBmYWxzZSwgNSwgMTEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDY4JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgNSwgNiwgMiwgdHJ1ZSwgNywgMTEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDY5JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA1LCA2LCAyLCB0cnVlLCA3LCAxMSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wNzAnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlLCA1LCA2LCAyLCB0cnVlLCA3LCAxMSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wNzEnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDUsIDYsIDIsIHRydWUsIDcsIDExKTtcblx0XHRcdC8vIHJlcGxhY2Ugd2l0aCBzbWFsbGVyIHRleHQgZnJvbSBzdGFydFxuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDcyJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgNSwgNywgMSwgZmFsc2UsIDUsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDczJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA1LCA3LCAxLCBmYWxzZSwgNSwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wNzQnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlLCA1LCA3LCAxLCBmYWxzZSwgNSwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wNzUnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDUsIDcsIDEsIGZhbHNlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA3NicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDUsIDcsIDEsIHRydWUsIDYsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDc3JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA1LCA3LCAxLCB0cnVlLCA2LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA3OCcsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDUsIDcsIDEsIHRydWUsIDYsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDc5JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA1LCA3LCAxLCB0cnVlLCA2LCA5KTtcblxuXHRcdFx0Ly8gcmVwbGFjZSB3aXRoIGxhcmdlciB0ZXh0IHRvIGVuZFxuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDgwJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgOSwgMTAsIDIsIGZhbHNlLCA1LCAxMSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wODEnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDksIDEwLCAyLCBmYWxzZSwgNSwgMTApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDgyJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgOSwgMTAsIDIsIGZhbHNlLCA1LCAxMCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wODMnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDksIDEwLCAyLCBmYWxzZSwgNSwgMTEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDg0JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgOSwgMTAsIDIsIHRydWUsIDUsIDExKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA4NScsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgOSwgMTAsIDIsIHRydWUsIDUsIDExKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA4NicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDksIDEwLCAyLCB0cnVlLCA1LCAxMSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wODcnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDksIDEwLCAyLCB0cnVlLCA1LCAxMSk7XG5cdFx0XHQvLyByZXBsYWNlIHdpdGggc21hbGxlciB0ZXh0IHRvIGVuZFxuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDg4JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgOCwgMTAsIDEsIGZhbHNlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA4OScsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgOCwgMTAsIDEsIGZhbHNlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA5MCcsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDgsIDEwLCAxLCBmYWxzZSwgNSwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wOTEnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDgsIDEwLCAxLCBmYWxzZSwgNSwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wOTInLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA4LCAxMCwgMSwgdHJ1ZSwgNSwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wOTMnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDgsIDEwLCAxLCB0cnVlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA5NCcsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDgsIDEwLCAxLCB0cnVlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjA5NScsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgOCwgMTAsIDEsIHRydWUsIDUsIDkpO1xuXG5cdFx0XHQvLyByZXBsYWNlIHdpdGggbGFyZ2VyIHRleHQgc2VsZWN0IGVuZFxuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDk2JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgOSwgMTEsIDMsIGZhbHNlLCA1LCAxMCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wOTcnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDksIDExLCAzLCBmYWxzZSwgNSwgMTApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMDk4JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgOSwgMTEsIDMsIGZhbHNlLCA1LCAxMCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4wOTknLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDksIDExLCAzLCBmYWxzZSwgNSwgMTApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTAwJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgOSwgMTEsIDMsIHRydWUsIDUsIDEyKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjEwMScsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgOSwgMTEsIDMsIHRydWUsIDUsIDEyKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjEwMicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDksIDExLCAzLCB0cnVlLCA1LCAxMik7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xMDMnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDksIDExLCAzLCB0cnVlLCA1LCAxMik7XG5cdFx0XHQvLyByZXBsYWNlIHdpdGggc21hbGxlciB0ZXh0IHNlbGVjdCBlbmRcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjEwNCcsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDksIDExLCAxLCBmYWxzZSwgNSwgMTApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTA1JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA5LCAxMSwgMSwgZmFsc2UsIDUsIDEwKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjEwNicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDksIDExLCAxLCBmYWxzZSwgNSwgMTApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTA3JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA5LCAxMSwgMSwgZmFsc2UsIDUsIDEwKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjEwOCcsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDksIDExLCAxLCB0cnVlLCA1LCAxMCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xMDknLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDksIDExLCAxLCB0cnVlLCA1LCAxMCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xMTAnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlLCA5LCAxMSwgMSwgdHJ1ZSwgNSwgMTApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTExJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA5LCAxMSwgMSwgdHJ1ZSwgNSwgMTApO1xuXG5cdFx0XHQvLyByZXBsYWNlIHdpdGggbGFyZ2VyIHRleHQgZnJvbSBlbmRcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjExMicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDEwLCAxMSwgMywgZmFsc2UsIDUsIDEwKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjExMycsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgMTAsIDExLCAzLCBmYWxzZSwgNSwgMTApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTE0JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgMTAsIDExLCAzLCBmYWxzZSwgNSwgMTApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTE1JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCAxMCwgMTEsIDMsIGZhbHNlLCA1LCAxMCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xMTYnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCAxMCwgMTEsIDMsIHRydWUsIDUsIDEzKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjExNycsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgMTAsIDExLCAzLCB0cnVlLCA1LCAxMyk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xMTgnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlLCAxMCwgMTEsIDMsIHRydWUsIDUsIDEzKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjExOScsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgMTAsIDExLCAzLCB0cnVlLCA1LCAxMyk7XG5cdFx0XHQvLyByZXBsYWNlIHdpdGggc21hbGxlciB0ZXh0IGZyb20gZW5kXG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xMjAnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCAxMCwgMTIsIDEsIGZhbHNlLCA1LCAxMCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xMjEnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDEwLCAxMiwgMSwgZmFsc2UsIDUsIDEwKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjEyMicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDEwLCAxMiwgMSwgZmFsc2UsIDUsIDEwKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjEyMycsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgMTAsIDEyLCAxLCBmYWxzZSwgNSwgMTApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTI0JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgMTAsIDEyLCAxLCB0cnVlLCA1LCAxMSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xMjUnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDEwLCAxMiwgMSwgdHJ1ZSwgNSwgMTEpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTI2JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgMTAsIDEyLCAxLCB0cnVlLCA1LCAxMSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xMjcnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDEwLCAxMiwgMSwgdHJ1ZSwgNSwgMTEpO1xuXG5cdFx0XHQvLyBkZWxldGUgdW50aWwgc3RhcnRcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjEyOCcsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDQsIDUsIDAsIGZhbHNlLCA0LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjEyOScsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgNCwgNSwgMCwgZmFsc2UsIDQsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTMwJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgNCwgNSwgMCwgZmFsc2UsIDQsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTMxJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA0LCA1LCAwLCBmYWxzZSwgNCwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xMzInLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA0LCA1LCAwLCB0cnVlLCA0LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjEzMycsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgNCwgNSwgMCwgdHJ1ZSwgNCwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xMzQnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlLCA0LCA1LCAwLCB0cnVlLCA0LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjEzNScsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgNCwgNSwgMCwgdHJ1ZSwgNCwgOSk7XG5cblx0XHRcdC8vIGRlbGV0ZSBzZWxlY3Qgc3RhcnRcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjEzNicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDQsIDYsIDAsIGZhbHNlLCA0LCA4KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjEzNycsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgNCwgNiwgMCwgZmFsc2UsIDQsIDgpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTM4JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgNCwgNiwgMCwgZmFsc2UsIDQsIDgpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTM5JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA0LCA2LCAwLCBmYWxzZSwgNCwgOCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xNDAnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA0LCA2LCAwLCB0cnVlLCA0LCA4KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE0MScsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgNCwgNiwgMCwgdHJ1ZSwgNCwgOCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xNDInLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlLCA0LCA2LCAwLCB0cnVlLCA0LCA4KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE0MycsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgNCwgNiwgMCwgdHJ1ZSwgNCwgOCk7XG5cblx0XHRcdC8vIGRlbGV0ZSBmcm9tIHN0YXJ0XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xNDQnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA1LCA2LCAwLCBmYWxzZSwgNSwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xNDUnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDUsIDYsIDAsIGZhbHNlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE0NicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDUsIDYsIDAsIGZhbHNlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE0NycsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgNSwgNiwgMCwgZmFsc2UsIDUsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTQ4JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgNSwgNiwgMCwgdHJ1ZSwgNSwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xNDknLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDUsIDYsIDAsIHRydWUsIDUsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTUwJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgNSwgNiwgMCwgdHJ1ZSwgNSwgOSk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xNTEnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDUsIDYsIDAsIHRydWUsIDUsIDkpO1xuXG5cdFx0XHQvLyBkZWxldGUgdG8gZW5kXG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xNTInLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA5LCAxMCwgMCwgZmFsc2UsIDUsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTUzJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA5LCAxMCwgMCwgZmFsc2UsIDUsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTU0JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgOSwgMTAsIDAsIGZhbHNlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE1NScsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgOSwgMTAsIDAsIGZhbHNlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE1NicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDksIDEwLCAwLCB0cnVlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE1NycsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgOSwgMTAsIDAsIHRydWUsIDUsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTU4JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgOSwgMTAsIDAsIHRydWUsIDUsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTU5JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA5LCAxMCwgMCwgdHJ1ZSwgNSwgOSk7XG5cblx0XHRcdC8vIGRlbGV0ZSBzZWxlY3QgZW5kXG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xNjAnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA5LCAxMSwgMCwgZmFsc2UsIDUsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTYxJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA5LCAxMSwgMCwgZmFsc2UsIDUsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTYyJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgOSwgMTEsIDAsIGZhbHNlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE2MycsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgOSwgMTEsIDAsIGZhbHNlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE2NCcsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDksIDExLCAwLCB0cnVlLCA1LCA5KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE2NScsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgOSwgMTEsIDAsIHRydWUsIDUsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTY2JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZSwgOSwgMTEsIDAsIHRydWUsIDUsIDkpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTY3JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA5LCAxMSwgMCwgdHJ1ZSwgNSwgOSk7XG5cblx0XHRcdC8vIGRlbGV0ZSBmcm9tIGVuZFxuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTY4JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgMTAsIDExLCAwLCBmYWxzZSwgNSwgMTApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTY5JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCAxMCwgMTEsIDAsIGZhbHNlLCA1LCAxMCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xNzAnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlLCAxMCwgMTEsIDAsIGZhbHNlLCA1LCAxMCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xNzEnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDEwLCAxMSwgMCwgZmFsc2UsIDUsIDEwKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE3MicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDEwLCAxMSwgMCwgdHJ1ZSwgNSwgMTApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTczJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCAxMCwgMTEsIDAsIHRydWUsIDUsIDEwKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE3NCcsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDEwLCAxMSwgMCwgdHJ1ZSwgNSwgMTApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTc1JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCAxMCwgMTEsIDAsIHRydWUsIDUsIDEwKTtcblxuXHRcdFx0Ly8gcmVwbGFjZSB3aXRoIGxhcmdlciB0ZXh0IGVudGlyZVxuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTc2JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgNSwgMTAsIDMsIGZhbHNlLCA1LCA4KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE3NycsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgNSwgMTAsIDMsIGZhbHNlLCA1LCA4KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE3OCcsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDUsIDEwLCAzLCBmYWxzZSwgNSwgOCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xNzknLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIsIDUsIDEwLCAzLCBmYWxzZSwgNSwgOCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xODAnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA1LCAxMCwgMywgdHJ1ZSwgOCwgOCk7XG5cdFx0XHRhc3NlcnROb2RlQWNjZXB0RWRpdCgnQi4xODEnLCA1LCAxMCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDUsIDEwLCAzLCB0cnVlLCA4LCA4KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE4MicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDUsIDEwLCAzLCB0cnVlLCA4LCA4KTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE4MycsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlciwgNSwgMTAsIDMsIHRydWUsIDgsIDgpO1xuXHRcdFx0Ly8gcmVwbGFjZSB3aXRoIHNtYWxsZXIgdGV4dCBlbnRpcmVcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE4NCcsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDUsIDEwLCA3LCBmYWxzZSwgNSwgMTIpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTg1JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA1LCAxMCwgNywgZmFsc2UsIDUsIDEwKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE4NicsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDUsIDEwLCA3LCBmYWxzZSwgNSwgMTApO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTg3JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA1LCAxMCwgNywgZmFsc2UsIDUsIDEyKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE4OCcsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIDUsIDEwLCA3LCB0cnVlLCAxMiwgMTIpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTg5JywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCA1LCAxMCwgNywgdHJ1ZSwgMTIsIDEyKTtcblx0XHRcdGFzc2VydE5vZGVBY2NlcHRFZGl0KCdCLjE5MCcsIDUsIDEwLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUsIDUsIDEwLCA3LCB0cnVlLCAxMiwgMTIpO1xuXHRcdFx0YXNzZXJ0Tm9kZUFjY2VwdEVkaXQoJ0IuMTkxJywgNSwgMTAsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyLCA1LCAxMCwgNywgdHJ1ZSwgMTIsIDEyKTtcblxuXHRcdH1cblx0fSk7XG59KTtcblxuZnVuY3Rpb24gcHJpbnRUcmVlKFQ6IEludGVydmFsVHJlZSk6IHZvaWQge1xuXHRpZiAoVC5yb290ID09PSBTRU5USU5FTCkge1xuXHRcdGNvbnNvbGUubG9nKGB+fiBlbXB0eWApO1xuXHRcdHJldHVybjtcblx0fVxuXHRjb25zdCBvdXQ6IHN0cmluZ1tdID0gW107XG5cdF9wcmludFRyZWUoVCwgVC5yb290LCAnJywgMCwgb3V0KTtcblx0Y29uc29sZS5sb2cob3V0LmpvaW4oJycpKTtcbn1cblxuZnVuY3Rpb24gX3ByaW50VHJlZShUOiBJbnRlcnZhbFRyZWUsIG46IEludGVydmFsTm9kZSwgaW5kZW50OiBzdHJpbmcsIGRlbHRhOiBudW1iZXIsIG91dDogc3RyaW5nW10pOiB2b2lkIHtcblx0b3V0LnB1c2goYCR7aW5kZW50fVske2dldE5vZGVDb2xvcihuKSA9PT0gTm9kZUNvbG9yLlJlZCA/ICdSJyA6ICdCJ30sJHtuLmRlbHRhfSwgJHtuLnN0YXJ0fS0+JHtuLmVuZH0sICR7bi5tYXhFbmR9XSA6IHske2RlbHRhICsgbi5zdGFydH0tPiR7ZGVsdGEgKyBuLmVuZH19LCBtYXhFbmQ6ICR7bi5tYXhFbmQgKyBkZWx0YX1cXG5gKTtcblx0aWYgKG4ubGVmdCAhPT0gU0VOVElORUwpIHtcblx0XHRfcHJpbnRUcmVlKFQsIG4ubGVmdCwgaW5kZW50ICsgJyAgICAnLCBkZWx0YSwgb3V0KTtcblx0fSBlbHNlIHtcblx0XHRvdXQucHVzaChgJHtpbmRlbnR9ICAgIE5JTFxcbmApO1xuXHR9XG5cdGlmIChuLnJpZ2h0ICE9PSBTRU5USU5FTCkge1xuXHRcdF9wcmludFRyZWUoVCwgbi5yaWdodCwgaW5kZW50ICsgJyAgICAnLCBkZWx0YSArIG4uZGVsdGEsIG91dCk7XG5cdH0gZWxzZSB7XG5cdFx0b3V0LnB1c2goYCR7aW5kZW50fSAgICBOSUxcXG5gKTtcblx0fVxufVxuXG4vLyNyZWdpb24gQXNzZXJ0aW9uXG5cbmZ1bmN0aW9uIGFzc2VydFRyZWVJbnZhcmlhbnRzKFQ6IEludGVydmFsVHJlZSk6IHZvaWQge1xuXHRhc3NlcnQoZ2V0Tm9kZUNvbG9yKFNFTlRJTkVMKSA9PT0gTm9kZUNvbG9yLkJsYWNrKTtcblx0YXNzZXJ0KFNFTlRJTkVMLnBhcmVudCA9PT0gU0VOVElORUwpO1xuXHRhc3NlcnQoU0VOVElORUwubGVmdCA9PT0gU0VOVElORUwpO1xuXHRhc3NlcnQoU0VOVElORUwucmlnaHQgPT09IFNFTlRJTkVMKTtcblx0YXNzZXJ0KFNFTlRJTkVMLnN0YXJ0ID09PSAwKTtcblx0YXNzZXJ0KFNFTlRJTkVMLmVuZCA9PT0gMCk7XG5cdGFzc2VydChTRU5USU5FTC5kZWx0YSA9PT0gMCk7XG5cdGFzc2VydChULnJvb3QucGFyZW50ID09PSBTRU5USU5FTCk7XG5cdGFzc2VydFZhbGlkVHJlZShUKTtcbn1cblxuZnVuY3Rpb24gZGVwdGgobjogSW50ZXJ2YWxOb2RlKTogbnVtYmVyIHtcblx0aWYgKG4gPT09IFNFTlRJTkVMKSB7XG5cdFx0Ly8gVGhlIGxlYWZzIGFyZSBibGFja1xuXHRcdHJldHVybiAxO1xuXHR9XG5cdGFzc2VydChkZXB0aChuLmxlZnQpID09PSBkZXB0aChuLnJpZ2h0KSk7XG5cdHJldHVybiAoZ2V0Tm9kZUNvbG9yKG4pID09PSBOb2RlQ29sb3IuQmxhY2sgPyAxIDogMCkgKyBkZXB0aChuLmxlZnQpO1xufVxuXG5mdW5jdGlvbiBhc3NlcnRWYWxpZE5vZGUobjogSW50ZXJ2YWxOb2RlLCBkZWx0YTogbnVtYmVyKTogdm9pZCB7XG5cdGlmIChuID09PSBTRU5USU5FTCkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IGwgPSBuLmxlZnQ7XG5cdGNvbnN0IHIgPSBuLnJpZ2h0O1xuXG5cdGlmIChnZXROb2RlQ29sb3IobikgPT09IE5vZGVDb2xvci5SZWQpIHtcblx0XHRhc3NlcnQoZ2V0Tm9kZUNvbG9yKGwpID09PSBOb2RlQ29sb3IuQmxhY2spO1xuXHRcdGFzc2VydChnZXROb2RlQ29sb3IocikgPT09IE5vZGVDb2xvci5CbGFjayk7XG5cdH1cblxuXHRsZXQgZXhwZWN0ZWRNYXhFbmQgPSBuLmVuZDtcblx0aWYgKGwgIT09IFNFTlRJTkVMKSB7XG5cdFx0YXNzZXJ0KGludGVydmFsQ29tcGFyZShsLnN0YXJ0ICsgZGVsdGEsIGwuZW5kICsgZGVsdGEsIG4uc3RhcnQgKyBkZWx0YSwgbi5lbmQgKyBkZWx0YSkgPD0gMCk7XG5cdFx0ZXhwZWN0ZWRNYXhFbmQgPSBNYXRoLm1heChleHBlY3RlZE1heEVuZCwgbC5tYXhFbmQpO1xuXHR9XG5cdGlmIChyICE9PSBTRU5USU5FTCkge1xuXHRcdGFzc2VydChpbnRlcnZhbENvbXBhcmUobi5zdGFydCArIGRlbHRhLCBuLmVuZCArIGRlbHRhLCByLnN0YXJ0ICsgZGVsdGEgKyBuLmRlbHRhLCByLmVuZCArIGRlbHRhICsgbi5kZWx0YSkgPD0gMCk7XG5cdFx0ZXhwZWN0ZWRNYXhFbmQgPSBNYXRoLm1heChleHBlY3RlZE1heEVuZCwgci5tYXhFbmQgKyBuLmRlbHRhKTtcblx0fVxuXHRhc3NlcnQobi5tYXhFbmQgPT09IGV4cGVjdGVkTWF4RW5kKTtcblxuXHRhc3NlcnRWYWxpZE5vZGUobCwgZGVsdGEpO1xuXHRhc3NlcnRWYWxpZE5vZGUociwgZGVsdGEgKyBuLmRlbHRhKTtcbn1cblxuZnVuY3Rpb24gYXNzZXJ0VmFsaWRUcmVlKFQ6IEludGVydmFsVHJlZSk6IHZvaWQge1xuXHRpZiAoVC5yb290ID09PSBTRU5USU5FTCkge1xuXHRcdHJldHVybjtcblx0fVxuXHRhc3NlcnQoZ2V0Tm9kZUNvbG9yKFQucm9vdCkgPT09IE5vZGVDb2xvci5CbGFjayk7XG5cdGFzc2VydChkZXB0aChULnJvb3QubGVmdCkgPT09IGRlcHRoKFQucm9vdC5yaWdodCkpO1xuXHRhc3NlcnRWYWxpZE5vZGUoVC5yb290LCAwKTtcbn1cblxuLy8jZW5kcmVnaW9uXG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxjQUFjLGNBQWMsV0FBVyxVQUFVLGNBQWMsaUJBQWlCLGdCQUFnQix5QkFBeUI7QUFFbEksTUFBTSxpQkFBaUI7QUFDdkIsTUFBTSxhQUFhLGlCQUFpQixNQUFRO0FBQzVDLE1BQU0sYUFBYTtBQUNuQixNQUFNLHFCQUFxQjtBQUMzQixNQUFNLG1CQUFtQjtBQUN6QixNQUFNLGNBQWM7QUFDcEIsTUFBTSxjQUFjO0FBQ3BCLE1BQU0saUJBQWlCO0FBQ3ZCLE1BQU0saUJBQWlCO0FBRXZCLE1BQU0sa0JBQWtCLE1BQU07QUFFN0IsMENBQXdDO0FBQUEsRUFFeEMsTUFBTSxTQUFTO0FBQUEsSUFNZCxZQUFZLE9BQWUsS0FBYTtBQUx4Qyw0QkFBdUI7QUFNdEIsV0FBSyxRQUFRO0FBQ2IsV0FBSyxNQUFNO0FBQUEsSUFDWjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQU0sT0FBTztBQUFBLElBR1osY0FBYztBQUNiLFdBQUssWUFBWSxDQUFDO0FBQUEsSUFDbkI7QUFBQSxJQUVPLE9BQU8sVUFBOEI7QUFDM0MsV0FBSyxVQUFVLEtBQUssUUFBUTtBQUM1QixXQUFLLFVBQVUsS0FBSyxDQUFDLEdBQUcsTUFBTTtBQUM3QixZQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU87QUFDeEIsaUJBQU8sRUFBRSxNQUFNLEVBQUU7QUFBQSxRQUNsQjtBQUNBLGVBQU8sRUFBRSxRQUFRLEVBQUU7QUFBQSxNQUNwQixDQUFD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QUE2QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUN6RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUV4RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUN6RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUN6RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUFBLElBQ3pHO0FBR0E7QUFFQywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUN6RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUN6RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUV4RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUN6RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUN6RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUV4RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUN6RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUN6RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUV4RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUN6RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUN6RywyQkFBcUIsU0FBUyxHQUFHLEdBQUcsdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUd4RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsRUFBRTtBQUMvRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsRUFBRTtBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsRUFBRTtBQUM1RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsRUFBRTtBQUMzRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUMzRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUUxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUd6RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsRUFBRTtBQUMvRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsRUFBRTtBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsRUFBRTtBQUM1RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsRUFBRTtBQUMzRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUMzRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUUxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUd6RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsRUFBRTtBQUMvRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsRUFBRTtBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsRUFBRTtBQUM1RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsRUFBRTtBQUMzRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUMzRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUUxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxN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QUFNLEdBQUcsRUFBRTtBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixJQUFJLElBQUksR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUc1RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUd6RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUd6RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUMxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUd6RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLElBQUksR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMvRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLElBQUksR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLElBQUksR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLElBQUksR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUM3RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUcxRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDhCQUE4QixHQUFHLElBQUksR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMvRywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDZCQUE2QixHQUFHLElBQUksR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM5RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDJCQUEyQixHQUFHLElBQUksR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM1RywyQkFBcUIsU0FBUyxHQUFHLElBQUksdUJBQXVCLDBCQUEwQixHQUFHLElBQUksR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUMzRywyQkFBcUIsU0FBUyxHQUFH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LE1BQUksTUFBTSxVQUFVO0FBQ25CLFdBQU8sZ0JBQWdCLEVBQUUsUUFBUSxPQUFPLEVBQUUsTUFBTSxPQUFPLEVBQUUsUUFBUSxRQUFRLEVBQUUsT0FBTyxFQUFFLE1BQU0sUUFBUSxFQUFFLEtBQUssS0FBSyxDQUFDO0FBQy9HLHFCQUFpQixLQUFLLElBQUksZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLEtBQUs7QUFBQSxFQUM3RDtBQUNBLFNBQU8sRUFBRSxXQUFXLGNBQWM7QUFFbEMsa0JBQWdCLEdBQUcsS0FBSztBQUN4QixrQkFBZ0IsR0FBRyxRQUFRLEVBQUUsS0FBSztBQUNuQztBQUVBLFNBQVMsZ0JBQWdCLEdBQXVCO0FBQy9DLE1BQUksRUFBRSxTQUFTLFVBQVU7QUFDeEI7QUFBQSxFQUNEO0FBQ0EsU0FBTyxhQUFhLEVBQUUsSUFBSSxNQUFNLFVBQVUsS0FBSztBQUMvQyxTQUFPLE1BQU0sRUFBRSxLQUFLLElBQUksTUFBTSxNQUFNLEVBQUUsS0FBSyxLQUFLLENBQUM7QUFDakQsa0JBQWdCLEVBQUUsTUFBTSxDQUFDO0FBQzFCOyIsCiAgIm5hbWVzIjogWyJhY3R1YWwiLCAiZXhwZWN0ZWQiLCAidGVzdCJdCn0K
