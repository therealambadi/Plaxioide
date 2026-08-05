import assert from "assert";
import { WordCharacterClassifier } from "../../../../common/core/wordCharacterClassifier.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { DefaultEndOfLine, SearchData } from "../../../../common/model.js";
import { PieceTreeTextBufferBuilder } from "../../../../common/model/pieceTreeTextBuffer/pieceTreeTextBufferBuilder.js";
import { NodeColor, SENTINEL } from "../../../../common/model/pieceTreeTextBuffer/rbTreeBase.js";
import { createTextModel } from "../../testTextModel.js";
import { splitLines } from "../../../../../base/common/strings.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ\r\n";
function randomChar() {
  return alphabet[randomInt(alphabet.length)];
}
function randomInt(bound) {
  return Math.floor(Math.random() * bound);
}
function randomStr(len) {
  if (len === null) {
    len = 10;
  }
  return function() {
    let j, ref;
    const results = [];
    for (j = 1, ref = len; 1 <= ref ? j < ref : j > ref; 1 <= ref ? j++ : j--) {
      results.push(randomChar());
    }
    return results;
  }().join("");
}
function trimLineFeed(text) {
  if (text.length === 0) {
    return text;
  }
  if (text.length === 1) {
    if (text.charCodeAt(text.length - 1) === 10 || text.charCodeAt(text.length - 1) === 13) {
      return "";
    }
    return text;
  }
  if (text.charCodeAt(text.length - 1) === 10) {
    if (text.charCodeAt(text.length - 2) === 13) {
      return text.slice(0, -2);
    }
    return text.slice(0, -1);
  }
  if (text.charCodeAt(text.length - 1) === 13) {
    return text.slice(0, -1);
  }
  return text;
}
function testLinesContent(str, pieceTable) {
  const lines = splitLines(str);
  assert.strictEqual(pieceTable.getLineCount(), lines.length);
  assert.strictEqual(pieceTable.getLinesRawContent(), str);
  for (let i = 0; i < lines.length; i++) {
    assert.strictEqual(pieceTable.getLineContent(i + 1), lines[i]);
    assert.strictEqual(
      trimLineFeed(
        pieceTable.getValueInRange(
          new Range(
            i + 1,
            1,
            i + 1,
            lines[i].length + (i === lines.length - 1 ? 1 : 2)
          )
        )
      ),
      lines[i]
    );
  }
}
function testLineStarts(str, pieceTable) {
  const lineStarts = [0];
  const _regex = new RegExp(/\r\n|\r|\n/g);
  _regex.lastIndex = 0;
  let prevMatchStartIndex = -1;
  let prevMatchLength = 0;
  let m;
  do {
    if (prevMatchStartIndex + prevMatchLength === str.length) {
      break;
    }
    m = _regex.exec(str);
    if (!m) {
      break;
    }
    const matchStartIndex = m.index;
    const matchLength = m[0].length;
    if (matchStartIndex === prevMatchStartIndex && matchLength === prevMatchLength) {
      break;
    }
    prevMatchStartIndex = matchStartIndex;
    prevMatchLength = matchLength;
    lineStarts.push(matchStartIndex + matchLength);
  } while (m);
  for (let i = 0; i < lineStarts.length; i++) {
    assert.deepStrictEqual(
      pieceTable.getPositionAt(lineStarts[i]),
      new Position(i + 1, 1)
    );
    assert.strictEqual(pieceTable.getOffsetAt(i + 1, 1), lineStarts[i]);
  }
  for (let i = 1; i < lineStarts.length; i++) {
    const pos = pieceTable.getPositionAt(lineStarts[i] - 1);
    assert.strictEqual(
      pieceTable.getOffsetAt(pos.lineNumber, pos.column),
      lineStarts[i] - 1
    );
  }
}
function createTextBuffer(val, normalizeEOL = true) {
  const bufferBuilder = new PieceTreeTextBufferBuilder();
  for (const chunk of val) {
    bufferBuilder.acceptChunk(chunk);
  }
  const factory = bufferBuilder.finish(normalizeEOL);
  return factory.create(DefaultEndOfLine.LF).textBuffer;
}
function assertTreeInvariants(T) {
  assert(SENTINEL.color === NodeColor.Black);
  assert(SENTINEL.parent === SENTINEL);
  assert(SENTINEL.left === SENTINEL);
  assert(SENTINEL.right === SENTINEL);
  assert(SENTINEL.size_left === 0);
  assert(SENTINEL.lf_left === 0);
  assertValidTree(T);
}
function depth(n) {
  if (n === SENTINEL) {
    return 1;
  }
  assert(depth(n.left) === depth(n.right));
  return (n.color === NodeColor.Black ? 1 : 0) + depth(n.left);
}
function assertValidNode(n) {
  if (n === SENTINEL) {
    return { size: 0, lf_cnt: 0 };
  }
  const l = n.left;
  const r = n.right;
  if (n.color === NodeColor.Red) {
    assert(l.color === NodeColor.Black);
    assert(r.color === NodeColor.Black);
  }
  const actualLeft = assertValidNode(l);
  assert(actualLeft.lf_cnt === n.lf_left);
  assert(actualLeft.size === n.size_left);
  const actualRight = assertValidNode(r);
  return { size: n.size_left + n.piece.length + actualRight.size, lf_cnt: n.lf_left + n.piece.lineFeedCnt + actualRight.lf_cnt };
}
function assertValidTree(T) {
  if (T.root === SENTINEL) {
    return;
  }
  assert(T.root.color === NodeColor.Black);
  assert(depth(T.root.left) === depth(T.root.right));
  assertValidNode(T.root);
}
suite("inserts and deletes", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  test("basic insert/delete", () => {
    const pieceTree = createTextBuffer([
      "This is a document with some text."
    ]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(34, "This is some more text to insert at offset 34.");
    assert.strictEqual(
      pieceTable.getLinesRawContent(),
      "This is a document with some text.This is some more text to insert at offset 34."
    );
    pieceTable.delete(42, 5);
    assert.strictEqual(
      pieceTable.getLinesRawContent(),
      "This is a document with some text.This is more text to insert at offset 34."
    );
    assertTreeInvariants(pieceTable);
  });
  test("more inserts", () => {
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pt = pieceTree.getPieceTree();
    pt.insert(0, "AAA");
    assert.strictEqual(pt.getLinesRawContent(), "AAA");
    pt.insert(0, "BBB");
    assert.strictEqual(pt.getLinesRawContent(), "BBBAAA");
    pt.insert(6, "CCC");
    assert.strictEqual(pt.getLinesRawContent(), "BBBAAACCC");
    pt.insert(5, "DDD");
    assert.strictEqual(pt.getLinesRawContent(), "BBBAADDDACCC");
    assertTreeInvariants(pt);
  });
  test("more deletes", () => {
    const pieceTree = createTextBuffer(["012345678"]);
    ds.add(pieceTree);
    const pt = pieceTree.getPieceTree();
    pt.delete(8, 1);
    assert.strictEqual(pt.getLinesRawContent(), "01234567");
    pt.delete(0, 1);
    assert.strictEqual(pt.getLinesRawContent(), "1234567");
    pt.delete(5, 1);
    assert.strictEqual(pt.getLinesRawContent(), "123457");
    pt.delete(5, 1);
    assert.strictEqual(pt.getLinesRawContent(), "12345");
    pt.delete(0, 5);
    assert.strictEqual(pt.getLinesRawContent(), "");
    assertTreeInvariants(pt);
  });
  test("random test 1", () => {
    let str = "";
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "ceLPHmFzvCtFeHkCBej ");
    str = str.substring(0, 0) + "ceLPHmFzvCtFeHkCBej " + str.substring(0);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    pieceTable.insert(8, "gDCEfNYiBUNkSwtvB K ");
    str = str.substring(0, 8) + "gDCEfNYiBUNkSwtvB K " + str.substring(8);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    pieceTable.insert(38, "cyNcHxjNPPoehBJldLS ");
    str = str.substring(0, 38) + "cyNcHxjNPPoehBJldLS " + str.substring(38);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    pieceTable.insert(59, "ejMx\nOTgWlbpeDExjOk ");
    str = str.substring(0, 59) + "ejMx\nOTgWlbpeDExjOk " + str.substring(59);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    assertTreeInvariants(pieceTable);
  });
  test("random test 2", () => {
    let str = "";
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "VgPG ");
    str = str.substring(0, 0) + "VgPG " + str.substring(0);
    pieceTable.insert(2, "DdWF ");
    str = str.substring(0, 2) + "DdWF " + str.substring(2);
    pieceTable.insert(0, "hUJc ");
    str = str.substring(0, 0) + "hUJc " + str.substring(0);
    pieceTable.insert(8, "lQEq ");
    str = str.substring(0, 8) + "lQEq " + str.substring(8);
    pieceTable.insert(10, "Gbtp ");
    str = str.substring(0, 10) + "Gbtp " + str.substring(10);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    assertTreeInvariants(pieceTable);
  });
  test("random test 3", () => {
    let str = "";
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "gYSz");
    str = str.substring(0, 0) + "gYSz" + str.substring(0);
    pieceTable.insert(1, "mDQe");
    str = str.substring(0, 1) + "mDQe" + str.substring(1);
    pieceTable.insert(1, "DTMQ");
    str = str.substring(0, 1) + "DTMQ" + str.substring(1);
    pieceTable.insert(2, "GGZB");
    str = str.substring(0, 2) + "GGZB" + str.substring(2);
    pieceTable.insert(12, "wXpq");
    str = str.substring(0, 12) + "wXpq" + str.substring(12);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
  });
  test("random delete 1", () => {
    let str = "";
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "vfb");
    str = str.substring(0, 0) + "vfb" + str.substring(0);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    pieceTable.insert(0, "zRq");
    str = str.substring(0, 0) + "zRq" + str.substring(0);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    pieceTable.delete(5, 1);
    str = str.substring(0, 5) + str.substring(5 + 1);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    pieceTable.insert(1, "UNw");
    str = str.substring(0, 1) + "UNw" + str.substring(1);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    pieceTable.delete(4, 3);
    str = str.substring(0, 4) + str.substring(4 + 3);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    pieceTable.delete(1, 4);
    str = str.substring(0, 1) + str.substring(1 + 4);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    pieceTable.delete(0, 1);
    str = str.substring(0, 0) + str.substring(0 + 1);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    assertTreeInvariants(pieceTable);
  });
  test("random delete 2", () => {
    let str = "";
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "IDT");
    str = str.substring(0, 0) + "IDT" + str.substring(0);
    pieceTable.insert(3, "wwA");
    str = str.substring(0, 3) + "wwA" + str.substring(3);
    pieceTable.insert(3, "Gnr");
    str = str.substring(0, 3) + "Gnr" + str.substring(3);
    pieceTable.delete(6, 3);
    str = str.substring(0, 6) + str.substring(6 + 3);
    pieceTable.insert(4, "eHp");
    str = str.substring(0, 4) + "eHp" + str.substring(4);
    pieceTable.insert(1, "UAi");
    str = str.substring(0, 1) + "UAi" + str.substring(1);
    pieceTable.insert(2, "FrR");
    str = str.substring(0, 2) + "FrR" + str.substring(2);
    pieceTable.delete(6, 7);
    str = str.substring(0, 6) + str.substring(6 + 7);
    pieceTable.delete(3, 5);
    str = str.substring(0, 3) + str.substring(3 + 5);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    assertTreeInvariants(pieceTable);
  });
  test("random delete 3", () => {
    let str = "";
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "PqM");
    str = str.substring(0, 0) + "PqM" + str.substring(0);
    pieceTable.delete(1, 2);
    str = str.substring(0, 1) + str.substring(1 + 2);
    pieceTable.insert(1, "zLc");
    str = str.substring(0, 1) + "zLc" + str.substring(1);
    pieceTable.insert(0, "MEX");
    str = str.substring(0, 0) + "MEX" + str.substring(0);
    pieceTable.insert(0, "jZh");
    str = str.substring(0, 0) + "jZh" + str.substring(0);
    pieceTable.insert(8, "GwQ");
    str = str.substring(0, 8) + "GwQ" + str.substring(8);
    pieceTable.delete(5, 6);
    str = str.substring(0, 5) + str.substring(5 + 6);
    pieceTable.insert(4, "ktw");
    str = str.substring(0, 4) + "ktw" + str.substring(4);
    pieceTable.insert(5, "GVu");
    str = str.substring(0, 5) + "GVu" + str.substring(5);
    pieceTable.insert(9, "jdm");
    str = str.substring(0, 9) + "jdm" + str.substring(9);
    pieceTable.insert(15, "na\n");
    str = str.substring(0, 15) + "na\n" + str.substring(15);
    pieceTable.delete(5, 8);
    str = str.substring(0, 5) + str.substring(5 + 8);
    pieceTable.delete(3, 4);
    str = str.substring(0, 3) + str.substring(3 + 4);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    assertTreeInvariants(pieceTable);
  });
  test("random insert/delete \\r bug 1", () => {
    let str = "a";
    const pieceTree = createTextBuffer(["a"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.delete(0, 1);
    str = str.substring(0, 0) + str.substring(0 + 1);
    pieceTable.insert(0, "\r\r\n\n");
    str = str.substring(0, 0) + "\r\r\n\n" + str.substring(0);
    pieceTable.delete(3, 1);
    str = str.substring(0, 3) + str.substring(3 + 1);
    pieceTable.insert(2, "\n\n\ra");
    str = str.substring(0, 2) + "\n\n\ra" + str.substring(2);
    pieceTable.delete(4, 3);
    str = str.substring(0, 4) + str.substring(4 + 3);
    pieceTable.insert(2, "\na\r\r");
    str = str.substring(0, 2) + "\na\r\r" + str.substring(2);
    pieceTable.insert(6, "\ra\n\n");
    str = str.substring(0, 6) + "\ra\n\n" + str.substring(6);
    pieceTable.insert(0, "aa\n\n");
    str = str.substring(0, 0) + "aa\n\n" + str.substring(0);
    pieceTable.insert(5, "\n\na\r");
    str = str.substring(0, 5) + "\n\na\r" + str.substring(5);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    assertTreeInvariants(pieceTable);
  });
  test("random insert/delete \\r bug 2", () => {
    let str = "a";
    const pieceTree = createTextBuffer(["a"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(1, "\naa\r");
    str = str.substring(0, 1) + "\naa\r" + str.substring(1);
    pieceTable.delete(0, 4);
    str = str.substring(0, 0) + str.substring(0 + 4);
    pieceTable.insert(1, "\r\r\na");
    str = str.substring(0, 1) + "\r\r\na" + str.substring(1);
    pieceTable.insert(2, "\n\r\ra");
    str = str.substring(0, 2) + "\n\r\ra" + str.substring(2);
    pieceTable.delete(4, 1);
    str = str.substring(0, 4) + str.substring(4 + 1);
    pieceTable.insert(8, "\r\n\r\r");
    str = str.substring(0, 8) + "\r\n\r\r" + str.substring(8);
    pieceTable.insert(7, "\n\n\na");
    str = str.substring(0, 7) + "\n\n\na" + str.substring(7);
    pieceTable.insert(13, "a\n\na");
    str = str.substring(0, 13) + "a\n\na" + str.substring(13);
    pieceTable.delete(17, 3);
    str = str.substring(0, 17) + str.substring(17 + 3);
    pieceTable.insert(2, "a\ra\n");
    str = str.substring(0, 2) + "a\ra\n" + str.substring(2);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    assertTreeInvariants(pieceTable);
  });
  test("random insert/delete \\r bug 3", () => {
    let str = "a";
    const pieceTree = createTextBuffer(["a"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "\r\na\r");
    str = str.substring(0, 0) + "\r\na\r" + str.substring(0);
    pieceTable.delete(2, 3);
    str = str.substring(0, 2) + str.substring(2 + 3);
    pieceTable.insert(2, "a\r\n\r");
    str = str.substring(0, 2) + "a\r\n\r" + str.substring(2);
    pieceTable.delete(4, 2);
    str = str.substring(0, 4) + str.substring(4 + 2);
    pieceTable.insert(4, "a\n\r\n");
    str = str.substring(0, 4) + "a\n\r\n" + str.substring(4);
    pieceTable.insert(1, "aa\n\r");
    str = str.substring(0, 1) + "aa\n\r" + str.substring(1);
    pieceTable.insert(7, "\na\r\n");
    str = str.substring(0, 7) + "\na\r\n" + str.substring(7);
    pieceTable.insert(5, "\n\na\r");
    str = str.substring(0, 5) + "\n\na\r" + str.substring(5);
    pieceTable.insert(10, "\r\r\n\r");
    str = str.substring(0, 10) + "\r\r\n\r" + str.substring(10);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    pieceTable.delete(21, 3);
    str = str.substring(0, 21) + str.substring(21 + 3);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    assertTreeInvariants(pieceTable);
  });
  test("random insert/delete \\r bug 4s", () => {
    let str = "a";
    const pieceTree = createTextBuffer(["a"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.delete(0, 1);
    str = str.substring(0, 0) + str.substring(0 + 1);
    pieceTable.insert(0, "\naaa");
    str = str.substring(0, 0) + "\naaa" + str.substring(0);
    pieceTable.insert(2, "\n\naa");
    str = str.substring(0, 2) + "\n\naa" + str.substring(2);
    pieceTable.delete(1, 4);
    str = str.substring(0, 1) + str.substring(1 + 4);
    pieceTable.delete(3, 1);
    str = str.substring(0, 3) + str.substring(3 + 1);
    pieceTable.delete(1, 2);
    str = str.substring(0, 1) + str.substring(1 + 2);
    pieceTable.delete(0, 1);
    str = str.substring(0, 0) + str.substring(0 + 1);
    pieceTable.insert(0, "a\n\n\r");
    str = str.substring(0, 0) + "a\n\n\r" + str.substring(0);
    pieceTable.insert(2, "aa\r\n");
    str = str.substring(0, 2) + "aa\r\n" + str.substring(2);
    pieceTable.insert(3, "a\naa");
    str = str.substring(0, 3) + "a\naa" + str.substring(3);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    assertTreeInvariants(pieceTable);
  });
  test("random insert/delete \\r bug 5", () => {
    let str = "";
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "\n\n\n\r");
    str = str.substring(0, 0) + "\n\n\n\r" + str.substring(0);
    pieceTable.insert(1, "\n\n\n\r");
    str = str.substring(0, 1) + "\n\n\n\r" + str.substring(1);
    pieceTable.insert(2, "\n\r\r\r");
    str = str.substring(0, 2) + "\n\r\r\r" + str.substring(2);
    pieceTable.insert(8, "\n\r\n\r");
    str = str.substring(0, 8) + "\n\r\n\r" + str.substring(8);
    pieceTable.delete(5, 2);
    str = str.substring(0, 5) + str.substring(5 + 2);
    pieceTable.insert(4, "\n\r\r\r");
    str = str.substring(0, 4) + "\n\r\r\r" + str.substring(4);
    pieceTable.insert(8, "\n\n\n\r");
    str = str.substring(0, 8) + "\n\n\n\r" + str.substring(8);
    pieceTable.delete(0, 7);
    str = str.substring(0, 0) + str.substring(0 + 7);
    pieceTable.insert(1, "\r\n\r\r");
    str = str.substring(0, 1) + "\r\n\r\r" + str.substring(1);
    pieceTable.insert(15, "\n\r\r\r");
    str = str.substring(0, 15) + "\n\r\r\r" + str.substring(15);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    assertTreeInvariants(pieceTable);
  });
});
suite("prefix sum for line feed", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  test("basic", () => {
    const pieceTree = createTextBuffer(["1\n2\n3\n4"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    assert.strictEqual(pieceTable.getLineCount(), 4);
    assert.deepStrictEqual(pieceTable.getPositionAt(0), new Position(1, 1));
    assert.deepStrictEqual(pieceTable.getPositionAt(1), new Position(1, 2));
    assert.deepStrictEqual(pieceTable.getPositionAt(2), new Position(2, 1));
    assert.deepStrictEqual(pieceTable.getPositionAt(3), new Position(2, 2));
    assert.deepStrictEqual(pieceTable.getPositionAt(4), new Position(3, 1));
    assert.deepStrictEqual(pieceTable.getPositionAt(5), new Position(3, 2));
    assert.deepStrictEqual(pieceTable.getPositionAt(6), new Position(4, 1));
    assert.strictEqual(pieceTable.getOffsetAt(1, 1), 0);
    assert.strictEqual(pieceTable.getOffsetAt(1, 2), 1);
    assert.strictEqual(pieceTable.getOffsetAt(2, 1), 2);
    assert.strictEqual(pieceTable.getOffsetAt(2, 2), 3);
    assert.strictEqual(pieceTable.getOffsetAt(3, 1), 4);
    assert.strictEqual(pieceTable.getOffsetAt(3, 2), 5);
    assert.strictEqual(pieceTable.getOffsetAt(4, 1), 6);
    assertTreeInvariants(pieceTable);
  });
  test("append", () => {
    const pieceTree = createTextBuffer(["a\nb\nc\nde"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(8, "fh\ni\njk");
    assert.strictEqual(pieceTable.getLineCount(), 6);
    assert.deepStrictEqual(pieceTable.getPositionAt(9), new Position(4, 4));
    assert.strictEqual(pieceTable.getOffsetAt(1, 1), 0);
    assertTreeInvariants(pieceTable);
  });
  test("insert", () => {
    const pieceTree = createTextBuffer(["a\nb\nc\nde"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(7, "fh\ni\njk");
    assert.strictEqual(pieceTable.getLineCount(), 6);
    assert.deepStrictEqual(pieceTable.getPositionAt(6), new Position(4, 1));
    assert.deepStrictEqual(pieceTable.getPositionAt(7), new Position(4, 2));
    assert.deepStrictEqual(pieceTable.getPositionAt(8), new Position(4, 3));
    assert.deepStrictEqual(pieceTable.getPositionAt(9), new Position(4, 4));
    assert.deepStrictEqual(pieceTable.getPositionAt(12), new Position(6, 1));
    assert.deepStrictEqual(pieceTable.getPositionAt(13), new Position(6, 2));
    assert.deepStrictEqual(pieceTable.getPositionAt(14), new Position(6, 3));
    assert.strictEqual(pieceTable.getOffsetAt(4, 1), 6);
    assert.strictEqual(pieceTable.getOffsetAt(4, 2), 7);
    assert.strictEqual(pieceTable.getOffsetAt(4, 3), 8);
    assert.strictEqual(pieceTable.getOffsetAt(4, 4), 9);
    assert.strictEqual(pieceTable.getOffsetAt(6, 1), 12);
    assert.strictEqual(pieceTable.getOffsetAt(6, 2), 13);
    assert.strictEqual(pieceTable.getOffsetAt(6, 3), 14);
    assertTreeInvariants(pieceTable);
  });
  test("delete", () => {
    const pieceTree = createTextBuffer(["a\nb\nc\ndefh\ni\njk"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.delete(7, 2);
    assert.strictEqual(pieceTable.getLinesRawContent(), "a\nb\nc\ndh\ni\njk");
    assert.strictEqual(pieceTable.getLineCount(), 6);
    assert.deepStrictEqual(pieceTable.getPositionAt(6), new Position(4, 1));
    assert.deepStrictEqual(pieceTable.getPositionAt(7), new Position(4, 2));
    assert.deepStrictEqual(pieceTable.getPositionAt(8), new Position(4, 3));
    assert.deepStrictEqual(pieceTable.getPositionAt(9), new Position(5, 1));
    assert.deepStrictEqual(pieceTable.getPositionAt(11), new Position(6, 1));
    assert.deepStrictEqual(pieceTable.getPositionAt(12), new Position(6, 2));
    assert.deepStrictEqual(pieceTable.getPositionAt(13), new Position(6, 3));
    assert.strictEqual(pieceTable.getOffsetAt(4, 1), 6);
    assert.strictEqual(pieceTable.getOffsetAt(4, 2), 7);
    assert.strictEqual(pieceTable.getOffsetAt(4, 3), 8);
    assert.strictEqual(pieceTable.getOffsetAt(5, 1), 9);
    assert.strictEqual(pieceTable.getOffsetAt(6, 1), 11);
    assert.strictEqual(pieceTable.getOffsetAt(6, 2), 12);
    assert.strictEqual(pieceTable.getOffsetAt(6, 3), 13);
    assertTreeInvariants(pieceTable);
  });
  test("add+delete 1", () => {
    const pieceTree = createTextBuffer(["a\nb\nc\nde"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(8, "fh\ni\njk");
    pieceTable.delete(7, 2);
    assert.strictEqual(pieceTable.getLinesRawContent(), "a\nb\nc\ndh\ni\njk");
    assert.strictEqual(pieceTable.getLineCount(), 6);
    assert.deepStrictEqual(pieceTable.getPositionAt(6), new Position(4, 1));
    assert.deepStrictEqual(pieceTable.getPositionAt(7), new Position(4, 2));
    assert.deepStrictEqual(pieceTable.getPositionAt(8), new Position(4, 3));
    assert.deepStrictEqual(pieceTable.getPositionAt(9), new Position(5, 1));
    assert.deepStrictEqual(pieceTable.getPositionAt(11), new Position(6, 1));
    assert.deepStrictEqual(pieceTable.getPositionAt(12), new Position(6, 2));
    assert.deepStrictEqual(pieceTable.getPositionAt(13), new Position(6, 3));
    assert.strictEqual(pieceTable.getOffsetAt(4, 1), 6);
    assert.strictEqual(pieceTable.getOffsetAt(4, 2), 7);
    assert.strictEqual(pieceTable.getOffsetAt(4, 3), 8);
    assert.strictEqual(pieceTable.getOffsetAt(5, 1), 9);
    assert.strictEqual(pieceTable.getOffsetAt(6, 1), 11);
    assert.strictEqual(pieceTable.getOffsetAt(6, 2), 12);
    assert.strictEqual(pieceTable.getOffsetAt(6, 3), 13);
    assertTreeInvariants(pieceTable);
  });
  test("insert random bug 1: prefixSumComputer.removeValues(start, cnt) cnt is 1 based.", () => {
    let str = "";
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, " ZX \n Z\nZ\n YZ\nY\nZXX ");
    str = str.substring(0, 0) + " ZX \n Z\nZ\n YZ\nY\nZXX " + str.substring(0);
    pieceTable.insert(14, "X ZZ\nYZZYZXXY Y XY\n ");
    str = str.substring(0, 14) + "X ZZ\nYZZYZXXY Y XY\n " + str.substring(14);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    testLineStarts(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("insert random bug 2: prefixSumComputer initialize does not do deep copy of UInt32Array.", () => {
    let str = "";
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "ZYZ\nYY XY\nX \nZ Y \nZ ");
    str = str.substring(0, 0) + "ZYZ\nYY XY\nX \nZ Y \nZ " + str.substring(0);
    pieceTable.insert(3, "XXY \n\nY Y YYY  ZYXY ");
    str = str.substring(0, 3) + "XXY \n\nY Y YYY  ZYXY " + str.substring(3);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    testLineStarts(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("delete random bug 1: I forgot to update the lineFeedCnt when deletion is on one single piece.", () => {
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "ba\na\nca\nba\ncbab\ncaa ");
    pieceTable.insert(13, "cca\naabb\ncac\nccc\nab ");
    pieceTable.delete(5, 8);
    pieceTable.delete(30, 2);
    pieceTable.insert(24, "cbbacccbac\nbaaab\n\nc ");
    pieceTable.delete(29, 3);
    pieceTable.delete(23, 9);
    pieceTable.delete(21, 5);
    pieceTable.delete(30, 3);
    pieceTable.insert(3, "cb\nac\nc\n\nacc\nbb\nb\nc ");
    pieceTable.delete(19, 5);
    pieceTable.insert(18, "\nbb\n\nacbc\ncbb\nc\nbb\n ");
    pieceTable.insert(65, "cbccbac\nbc\n\nccabba\n ");
    pieceTable.insert(77, "a\ncacb\n\nac\n\n\n\n\nabab ");
    pieceTable.delete(30, 9);
    pieceTable.insert(45, "b\n\nc\nba\n\nbbbba\n\naa\n ");
    pieceTable.insert(82, "ab\nbb\ncabacab\ncbc\na ");
    pieceTable.delete(123, 9);
    pieceTable.delete(71, 2);
    pieceTable.insert(33, "acaa\nacb\n\naa\n\nc\n\n\n\n ");
    const str = pieceTable.getLinesRawContent();
    testLineStarts(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("delete random bug rb tree 1", () => {
    let str = "";
    const pieceTree = createTextBuffer([str]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "YXXZ\n\nYY\n");
    str = str.substring(0, 0) + "YXXZ\n\nYY\n" + str.substring(0);
    pieceTable.delete(0, 5);
    str = str.substring(0, 0) + str.substring(0 + 5);
    pieceTable.insert(0, "ZXYY\nX\nZ\n");
    str = str.substring(0, 0) + "ZXYY\nX\nZ\n" + str.substring(0);
    pieceTable.insert(10, "\nXY\nYXYXY");
    str = str.substring(0, 10) + "\nXY\nYXYXY" + str.substring(10);
    testLineStarts(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("delete random bug rb tree 2", () => {
    let str = "";
    const pieceTree = createTextBuffer([str]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "YXXZ\n\nYY\n");
    str = str.substring(0, 0) + "YXXZ\n\nYY\n" + str.substring(0);
    pieceTable.insert(0, "ZXYY\nX\nZ\n");
    str = str.substring(0, 0) + "ZXYY\nX\nZ\n" + str.substring(0);
    pieceTable.insert(10, "\nXY\nYXYXY");
    str = str.substring(0, 10) + "\nXY\nYXYXY" + str.substring(10);
    pieceTable.insert(8, "YZXY\nZ\nYX");
    str = str.substring(0, 8) + "YZXY\nZ\nYX" + str.substring(8);
    pieceTable.insert(12, "XX\nXXYXYZ");
    str = str.substring(0, 12) + "XX\nXXYXYZ" + str.substring(12);
    pieceTable.delete(0, 4);
    str = str.substring(0, 0) + str.substring(0 + 4);
    testLineStarts(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("delete random bug rb tree 3", () => {
    let str = "";
    const pieceTree = createTextBuffer([str]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "YXXZ\n\nYY\n");
    str = str.substring(0, 0) + "YXXZ\n\nYY\n" + str.substring(0);
    pieceTable.delete(7, 2);
    str = str.substring(0, 7) + str.substring(7 + 2);
    pieceTable.delete(6, 1);
    str = str.substring(0, 6) + str.substring(6 + 1);
    pieceTable.delete(0, 5);
    str = str.substring(0, 0) + str.substring(0 + 5);
    pieceTable.insert(0, "ZXYY\nX\nZ\n");
    str = str.substring(0, 0) + "ZXYY\nX\nZ\n" + str.substring(0);
    pieceTable.insert(10, "\nXY\nYXYXY");
    str = str.substring(0, 10) + "\nXY\nYXYXY" + str.substring(10);
    pieceTable.insert(8, "YZXY\nZ\nYX");
    str = str.substring(0, 8) + "YZXY\nZ\nYX" + str.substring(8);
    pieceTable.insert(12, "XX\nXXYXYZ");
    str = str.substring(0, 12) + "XX\nXXYXYZ" + str.substring(12);
    pieceTable.delete(0, 4);
    str = str.substring(0, 0) + str.substring(0 + 4);
    pieceTable.delete(30, 3);
    str = str.substring(0, 30) + str.substring(30 + 3);
    testLineStarts(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
});
suite("offset 2 position", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  test("random tests bug 1", () => {
    let str = "";
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "huuyYzUfKOENwGgZLqn ");
    str = str.substring(0, 0) + "huuyYzUfKOENwGgZLqn " + str.substring(0);
    pieceTable.delete(18, 2);
    str = str.substring(0, 18) + str.substring(18 + 2);
    pieceTable.delete(3, 1);
    str = str.substring(0, 3) + str.substring(3 + 1);
    pieceTable.delete(12, 4);
    str = str.substring(0, 12) + str.substring(12 + 4);
    pieceTable.insert(3, "hMbnVEdTSdhLlPevXKF ");
    str = str.substring(0, 3) + "hMbnVEdTSdhLlPevXKF " + str.substring(3);
    pieceTable.delete(22, 8);
    str = str.substring(0, 22) + str.substring(22 + 8);
    pieceTable.insert(4, "S umSnYrqOmOAV\nEbZJ ");
    str = str.substring(0, 4) + "S umSnYrqOmOAV\nEbZJ " + str.substring(4);
    testLineStarts(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
});
suite("get text in range", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  test("getContentInRange", () => {
    const pieceTree = createTextBuffer(["a\nb\nc\nde"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(8, "fh\ni\njk");
    pieceTable.delete(7, 2);
    assert.strictEqual(pieceTable.getValueInRange(new Range(1, 1, 1, 3)), "a\n");
    assert.strictEqual(pieceTable.getValueInRange(new Range(2, 1, 2, 3)), "b\n");
    assert.strictEqual(pieceTable.getValueInRange(new Range(3, 1, 3, 3)), "c\n");
    assert.strictEqual(pieceTable.getValueInRange(new Range(4, 1, 4, 4)), "dh\n");
    assert.strictEqual(pieceTable.getValueInRange(new Range(5, 1, 5, 3)), "i\n");
    assert.strictEqual(pieceTable.getValueInRange(new Range(6, 1, 6, 3)), "jk");
    assertTreeInvariants(pieceTable);
  });
  test("random test value in range", () => {
    let str = "";
    const pieceTree = createTextBuffer([str]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "ZXXY");
    str = str.substring(0, 0) + "ZXXY" + str.substring(0);
    pieceTable.insert(1, "XZZY");
    str = str.substring(0, 1) + "XZZY" + str.substring(1);
    pieceTable.insert(5, "\nX\n\n");
    str = str.substring(0, 5) + "\nX\n\n" + str.substring(5);
    pieceTable.insert(3, "\nXX\n");
    str = str.substring(0, 3) + "\nXX\n" + str.substring(3);
    pieceTable.insert(12, "YYYX");
    str = str.substring(0, 12) + "YYYX" + str.substring(12);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random test value in range exception", () => {
    let str = "";
    const pieceTree = createTextBuffer([str]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "XZ\nZ");
    str = str.substring(0, 0) + "XZ\nZ" + str.substring(0);
    pieceTable.delete(0, 3);
    str = str.substring(0, 0) + str.substring(0 + 3);
    pieceTable.delete(0, 1);
    str = str.substring(0, 0) + str.substring(0 + 1);
    pieceTable.insert(0, "ZYX\n");
    str = str.substring(0, 0) + "ZYX\n" + str.substring(0);
    pieceTable.delete(0, 4);
    str = str.substring(0, 0) + str.substring(0 + 4);
    pieceTable.getValueInRange(new Range(1, 1, 1, 1));
    assertTreeInvariants(pieceTable);
  });
  test("random tests bug 1", () => {
    let str = "";
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "huuyYzUfKOENwGgZLqn ");
    str = str.substring(0, 0) + "huuyYzUfKOENwGgZLqn " + str.substring(0);
    pieceTable.delete(18, 2);
    str = str.substring(0, 18) + str.substring(18 + 2);
    pieceTable.delete(3, 1);
    str = str.substring(0, 3) + str.substring(3 + 1);
    pieceTable.delete(12, 4);
    str = str.substring(0, 12) + str.substring(12 + 4);
    pieceTable.insert(3, "hMbnVEdTSdhLlPevXKF ");
    str = str.substring(0, 3) + "hMbnVEdTSdhLlPevXKF " + str.substring(3);
    pieceTable.delete(22, 8);
    str = str.substring(0, 22) + str.substring(22 + 8);
    pieceTable.insert(4, "S umSnYrqOmOAV\nEbZJ ");
    str = str.substring(0, 4) + "S umSnYrqOmOAV\nEbZJ " + str.substring(4);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random tests bug 2", () => {
    let str = "";
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "xfouRDZwdAHjVXJAMV\n ");
    str = str.substring(0, 0) + "xfouRDZwdAHjVXJAMV\n " + str.substring(0);
    pieceTable.insert(16, "dBGndxpFZBEAIKykYYx ");
    str = str.substring(0, 16) + "dBGndxpFZBEAIKykYYx " + str.substring(16);
    pieceTable.delete(7, 6);
    str = str.substring(0, 7) + str.substring(7 + 6);
    pieceTable.delete(9, 7);
    str = str.substring(0, 9) + str.substring(9 + 7);
    pieceTable.delete(17, 6);
    str = str.substring(0, 17) + str.substring(17 + 6);
    pieceTable.delete(0, 4);
    str = str.substring(0, 0) + str.substring(0 + 4);
    pieceTable.insert(9, "qvEFXCNvVkWgvykahYt ");
    str = str.substring(0, 9) + "qvEFXCNvVkWgvykahYt " + str.substring(9);
    pieceTable.delete(4, 6);
    str = str.substring(0, 4) + str.substring(4 + 6);
    pieceTable.insert(11, "OcSChUYT\nzPEBOpsGmR ");
    str = str.substring(0, 11) + "OcSChUYT\nzPEBOpsGmR " + str.substring(11);
    pieceTable.insert(15, "KJCozaXTvkE\nxnqAeTz ");
    str = str.substring(0, 15) + "KJCozaXTvkE\nxnqAeTz " + str.substring(15);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("get line content", () => {
    const pieceTree = createTextBuffer(["1"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    assert.strictEqual(pieceTable.getLineRawContent(1), "1");
    pieceTable.insert(1, "2");
    assert.strictEqual(pieceTable.getLineRawContent(1), "12");
    assertTreeInvariants(pieceTable);
  });
  test("get line content basic", () => {
    const pieceTree = createTextBuffer(["1\n2\n3\n4"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    assert.strictEqual(pieceTable.getLineRawContent(1), "1\n");
    assert.strictEqual(pieceTable.getLineRawContent(2), "2\n");
    assert.strictEqual(pieceTable.getLineRawContent(3), "3\n");
    assert.strictEqual(pieceTable.getLineRawContent(4), "4");
    assertTreeInvariants(pieceTable);
  });
  test("get line content after inserts/deletes", () => {
    const pieceTree = createTextBuffer(["a\nb\nc\nde"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(8, "fh\ni\njk");
    pieceTable.delete(7, 2);
    assert.strictEqual(pieceTable.getLineRawContent(1), "a\n");
    assert.strictEqual(pieceTable.getLineRawContent(2), "b\n");
    assert.strictEqual(pieceTable.getLineRawContent(3), "c\n");
    assert.strictEqual(pieceTable.getLineRawContent(4), "dh\n");
    assert.strictEqual(pieceTable.getLineRawContent(5), "i\n");
    assert.strictEqual(pieceTable.getLineRawContent(6), "jk");
    assertTreeInvariants(pieceTable);
  });
  test("random 1", () => {
    let str = "";
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "J eNnDzQpnlWyjmUu\ny ");
    str = str.substring(0, 0) + "J eNnDzQpnlWyjmUu\ny " + str.substring(0);
    pieceTable.insert(0, "QPEeRAQmRwlJqtZSWhQ ");
    str = str.substring(0, 0) + "QPEeRAQmRwlJqtZSWhQ " + str.substring(0);
    pieceTable.delete(5, 1);
    str = str.substring(0, 5) + str.substring(5 + 1);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random 2", () => {
    let str = "";
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "DZoQ tglPCRHMltejRI ");
    str = str.substring(0, 0) + "DZoQ tglPCRHMltejRI " + str.substring(0);
    pieceTable.insert(10, "JRXiyYqJ qqdcmbfkKX ");
    str = str.substring(0, 10) + "JRXiyYqJ qqdcmbfkKX " + str.substring(10);
    pieceTable.delete(16, 3);
    str = str.substring(0, 16) + str.substring(16 + 3);
    pieceTable.delete(25, 1);
    str = str.substring(0, 25) + str.substring(25 + 1);
    pieceTable.insert(18, "vH\nNlvfqQJPm\nSFkhMc ");
    str = str.substring(0, 18) + "vH\nNlvfqQJPm\nSFkhMc " + str.substring(18);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
});
suite("CRLF", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  test("delete CR in CRLF 1", () => {
    const pieceTree = createTextBuffer([""], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "a\r\nb");
    pieceTable.delete(0, 2);
    assert.strictEqual(pieceTable.getLineCount(), 2);
    assertTreeInvariants(pieceTable);
  });
  test("delete CR in CRLF 2", () => {
    const pieceTree = createTextBuffer([""], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "a\r\nb");
    pieceTable.delete(2, 2);
    assert.strictEqual(pieceTable.getLineCount(), 2);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 1", () => {
    let str = "";
    const pieceTree = createTextBuffer([""], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "\n\n\r\r");
    str = str.substring(0, 0) + "\n\n\r\r" + str.substring(0);
    pieceTable.insert(1, "\r\n\r\n");
    str = str.substring(0, 1) + "\r\n\r\n" + str.substring(1);
    pieceTable.delete(5, 3);
    str = str.substring(0, 5) + str.substring(5 + 3);
    pieceTable.delete(2, 3);
    str = str.substring(0, 2) + str.substring(2 + 3);
    const lines = splitLines(str);
    assert.strictEqual(pieceTable.getLineCount(), lines.length);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 2", () => {
    let str = "";
    const pieceTree = createTextBuffer([""], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "\n\r\n\r");
    str = str.substring(0, 0) + "\n\r\n\r" + str.substring(0);
    pieceTable.insert(2, "\n\r\r\r");
    str = str.substring(0, 2) + "\n\r\r\r" + str.substring(2);
    pieceTable.delete(4, 1);
    str = str.substring(0, 4) + str.substring(4 + 1);
    const lines = splitLines(str);
    assert.strictEqual(pieceTable.getLineCount(), lines.length);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 3", () => {
    let str = "";
    const pieceTree = createTextBuffer([""], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "\n\n\n\r");
    str = str.substring(0, 0) + "\n\n\n\r" + str.substring(0);
    pieceTable.delete(2, 2);
    str = str.substring(0, 2) + str.substring(2 + 2);
    pieceTable.delete(0, 2);
    str = str.substring(0, 0) + str.substring(0 + 2);
    pieceTable.insert(0, "\r\r\r\r");
    str = str.substring(0, 0) + "\r\r\r\r" + str.substring(0);
    pieceTable.insert(2, "\r\n\r\r");
    str = str.substring(0, 2) + "\r\n\r\r" + str.substring(2);
    pieceTable.insert(3, "\r\r\r\n");
    str = str.substring(0, 3) + "\r\r\r\n" + str.substring(3);
    const lines = splitLines(str);
    assert.strictEqual(pieceTable.getLineCount(), lines.length);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 4", () => {
    let str = "";
    const pieceTree = createTextBuffer([""], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "\n\n\n\n");
    str = str.substring(0, 0) + "\n\n\n\n" + str.substring(0);
    pieceTable.delete(3, 1);
    str = str.substring(0, 3) + str.substring(3 + 1);
    pieceTable.insert(1, "\r\r\r\r");
    str = str.substring(0, 1) + "\r\r\r\r" + str.substring(1);
    pieceTable.insert(6, "\r\n\n\r");
    str = str.substring(0, 6) + "\r\n\n\r" + str.substring(6);
    pieceTable.delete(5, 3);
    str = str.substring(0, 5) + str.substring(5 + 3);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 5", () => {
    let str = "";
    const pieceTree = createTextBuffer([""], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "\n\n\n\n");
    str = str.substring(0, 0) + "\n\n\n\n" + str.substring(0);
    pieceTable.delete(3, 1);
    str = str.substring(0, 3) + str.substring(3 + 1);
    pieceTable.insert(0, "\n\r\r\n");
    str = str.substring(0, 0) + "\n\r\r\n" + str.substring(0);
    pieceTable.insert(4, "\n\r\r\n");
    str = str.substring(0, 4) + "\n\r\r\n" + str.substring(4);
    pieceTable.delete(4, 3);
    str = str.substring(0, 4) + str.substring(4 + 3);
    pieceTable.insert(5, "\r\r\n\r");
    str = str.substring(0, 5) + "\r\r\n\r" + str.substring(5);
    pieceTable.insert(12, "\n\n\n\r");
    str = str.substring(0, 12) + "\n\n\n\r" + str.substring(12);
    pieceTable.insert(5, "\r\r\r\n");
    str = str.substring(0, 5) + "\r\r\r\n" + str.substring(5);
    pieceTable.insert(20, "\n\n\r\n");
    str = str.substring(0, 20) + "\n\n\r\n" + str.substring(20);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 6", () => {
    let str = "";
    const pieceTree = createTextBuffer([""], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "\n\r\r\n");
    str = str.substring(0, 0) + "\n\r\r\n" + str.substring(0);
    pieceTable.insert(4, "\r\n\n\r");
    str = str.substring(0, 4) + "\r\n\n\r" + str.substring(4);
    pieceTable.insert(3, "\r\n\n\n");
    str = str.substring(0, 3) + "\r\n\n\n" + str.substring(3);
    pieceTable.delete(4, 8);
    str = str.substring(0, 4) + str.substring(4 + 8);
    pieceTable.insert(4, "\r\n\n\r");
    str = str.substring(0, 4) + "\r\n\n\r" + str.substring(4);
    pieceTable.insert(0, "\r\n\n\r");
    str = str.substring(0, 0) + "\r\n\n\r" + str.substring(0);
    pieceTable.delete(4, 0);
    str = str.substring(0, 4) + str.substring(4 + 0);
    pieceTable.delete(8, 4);
    str = str.substring(0, 8) + str.substring(8 + 4);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 8", () => {
    let str = "";
    const pieceTree = createTextBuffer([""], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "\r\n\n\r");
    str = str.substring(0, 0) + "\r\n\n\r" + str.substring(0);
    pieceTable.delete(1, 0);
    str = str.substring(0, 1) + str.substring(1 + 0);
    pieceTable.insert(3, "\n\n\n\r");
    str = str.substring(0, 3) + "\n\n\n\r" + str.substring(3);
    pieceTable.insert(7, "\n\n\r\n");
    str = str.substring(0, 7) + "\n\n\r\n" + str.substring(7);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 7", () => {
    let str = "";
    const pieceTree = createTextBuffer([""], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "\r\r\n\n");
    str = str.substring(0, 0) + "\r\r\n\n" + str.substring(0);
    pieceTable.insert(4, "\r\n\n\r");
    str = str.substring(0, 4) + "\r\n\n\r" + str.substring(4);
    pieceTable.insert(7, "\n\r\r\r");
    str = str.substring(0, 7) + "\n\r\r\r" + str.substring(7);
    pieceTable.insert(11, "\n\n\r\n");
    str = str.substring(0, 11) + "\n\n\r\n" + str.substring(11);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 10", () => {
    let str = "";
    const pieceTree = createTextBuffer([""], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "qneW");
    str = str.substring(0, 0) + "qneW" + str.substring(0);
    pieceTable.insert(0, "YhIl");
    str = str.substring(0, 0) + "YhIl" + str.substring(0);
    pieceTable.insert(0, "qdsm");
    str = str.substring(0, 0) + "qdsm" + str.substring(0);
    pieceTable.delete(7, 0);
    str = str.substring(0, 7) + str.substring(7 + 0);
    pieceTable.insert(12, "iiPv");
    str = str.substring(0, 12) + "iiPv" + str.substring(12);
    pieceTable.insert(9, "V\rSA");
    str = str.substring(0, 9) + "V\rSA" + str.substring(9);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 9", () => {
    let str = "";
    const pieceTree = createTextBuffer([""], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "\n\n\n\n");
    str = str.substring(0, 0) + "\n\n\n\n" + str.substring(0);
    pieceTable.insert(3, "\n\r\n\r");
    str = str.substring(0, 3) + "\n\r\n\r" + str.substring(3);
    pieceTable.insert(2, "\n\r\n\n");
    str = str.substring(0, 2) + "\n\r\n\n" + str.substring(2);
    pieceTable.insert(0, "\n\n\r\r");
    str = str.substring(0, 0) + "\n\n\r\r" + str.substring(0);
    pieceTable.insert(3, "\r\r\r\r");
    str = str.substring(0, 3) + "\r\r\r\r" + str.substring(3);
    pieceTable.insert(3, "\n\n\r\r");
    str = str.substring(0, 3) + "\n\n\r\r" + str.substring(3);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
});
suite("centralized lineStarts with CRLF", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  test("delete CR in CRLF 1", () => {
    const pieceTree = createTextBuffer(["a\r\nb"], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.delete(2, 2);
    assert.strictEqual(pieceTable.getLineCount(), 2);
    assertTreeInvariants(pieceTable);
  });
  test("delete CR in CRLF 2", () => {
    const pieceTree = createTextBuffer(["a\r\nb"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.delete(0, 2);
    assert.strictEqual(pieceTable.getLineCount(), 2);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 1", () => {
    let str = "\n\n\r\r";
    const pieceTree = createTextBuffer(["\n\n\r\r"], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(1, "\r\n\r\n");
    str = str.substring(0, 1) + "\r\n\r\n" + str.substring(1);
    pieceTable.delete(5, 3);
    str = str.substring(0, 5) + str.substring(5 + 3);
    pieceTable.delete(2, 3);
    str = str.substring(0, 2) + str.substring(2 + 3);
    const lines = splitLines(str);
    assert.strictEqual(pieceTable.getLineCount(), lines.length);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 2", () => {
    let str = "\n\r\n\r";
    const pieceTree = createTextBuffer(["\n\r\n\r"], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(2, "\n\r\r\r");
    str = str.substring(0, 2) + "\n\r\r\r" + str.substring(2);
    pieceTable.delete(4, 1);
    str = str.substring(0, 4) + str.substring(4 + 1);
    const lines = splitLines(str);
    assert.strictEqual(pieceTable.getLineCount(), lines.length);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 3", () => {
    let str = "\n\n\n\r";
    const pieceTree = createTextBuffer(["\n\n\n\r"], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.delete(2, 2);
    str = str.substring(0, 2) + str.substring(2 + 2);
    pieceTable.delete(0, 2);
    str = str.substring(0, 0) + str.substring(0 + 2);
    pieceTable.insert(0, "\r\r\r\r");
    str = str.substring(0, 0) + "\r\r\r\r" + str.substring(0);
    pieceTable.insert(2, "\r\n\r\r");
    str = str.substring(0, 2) + "\r\n\r\r" + str.substring(2);
    pieceTable.insert(3, "\r\r\r\n");
    str = str.substring(0, 3) + "\r\r\r\n" + str.substring(3);
    const lines = splitLines(str);
    assert.strictEqual(pieceTable.getLineCount(), lines.length);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 4", () => {
    let str = "\n\n\n\n";
    const pieceTree = createTextBuffer(["\n\n\n\n"], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.delete(3, 1);
    str = str.substring(0, 3) + str.substring(3 + 1);
    pieceTable.insert(1, "\r\r\r\r");
    str = str.substring(0, 1) + "\r\r\r\r" + str.substring(1);
    pieceTable.insert(6, "\r\n\n\r");
    str = str.substring(0, 6) + "\r\n\n\r" + str.substring(6);
    pieceTable.delete(5, 3);
    str = str.substring(0, 5) + str.substring(5 + 3);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 5", () => {
    let str = "\n\n\n\n";
    const pieceTree = createTextBuffer(["\n\n\n\n"], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.delete(3, 1);
    str = str.substring(0, 3) + str.substring(3 + 1);
    pieceTable.insert(0, "\n\r\r\n");
    str = str.substring(0, 0) + "\n\r\r\n" + str.substring(0);
    pieceTable.insert(4, "\n\r\r\n");
    str = str.substring(0, 4) + "\n\r\r\n" + str.substring(4);
    pieceTable.delete(4, 3);
    str = str.substring(0, 4) + str.substring(4 + 3);
    pieceTable.insert(5, "\r\r\n\r");
    str = str.substring(0, 5) + "\r\r\n\r" + str.substring(5);
    pieceTable.insert(12, "\n\n\n\r");
    str = str.substring(0, 12) + "\n\n\n\r" + str.substring(12);
    pieceTable.insert(5, "\r\r\r\n");
    str = str.substring(0, 5) + "\r\r\r\n" + str.substring(5);
    pieceTable.insert(20, "\n\n\r\n");
    str = str.substring(0, 20) + "\n\n\r\n" + str.substring(20);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 6", () => {
    let str = "\n\r\r\n";
    const pieceTree = createTextBuffer(["\n\r\r\n"], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(4, "\r\n\n\r");
    str = str.substring(0, 4) + "\r\n\n\r" + str.substring(4);
    pieceTable.insert(3, "\r\n\n\n");
    str = str.substring(0, 3) + "\r\n\n\n" + str.substring(3);
    pieceTable.delete(4, 8);
    str = str.substring(0, 4) + str.substring(4 + 8);
    pieceTable.insert(4, "\r\n\n\r");
    str = str.substring(0, 4) + "\r\n\n\r" + str.substring(4);
    pieceTable.insert(0, "\r\n\n\r");
    str = str.substring(0, 0) + "\r\n\n\r" + str.substring(0);
    pieceTable.delete(4, 0);
    str = str.substring(0, 4) + str.substring(4 + 0);
    pieceTable.delete(8, 4);
    str = str.substring(0, 8) + str.substring(8 + 4);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 7", () => {
    let str = "\r\n\n\r";
    const pieceTree = createTextBuffer(["\r\n\n\r"], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.delete(1, 0);
    str = str.substring(0, 1) + str.substring(1 + 0);
    pieceTable.insert(3, "\n\n\n\r");
    str = str.substring(0, 3) + "\n\n\n\r" + str.substring(3);
    pieceTable.insert(7, "\n\n\r\n");
    str = str.substring(0, 7) + "\n\n\r\n" + str.substring(7);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 8", () => {
    let str = "\r\r\n\n";
    const pieceTree = createTextBuffer(["\r\r\n\n"], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(4, "\r\n\n\r");
    str = str.substring(0, 4) + "\r\n\n\r" + str.substring(4);
    pieceTable.insert(7, "\n\r\r\r");
    str = str.substring(0, 7) + "\n\r\r\r" + str.substring(7);
    pieceTable.insert(11, "\n\n\r\n");
    str = str.substring(0, 11) + "\n\n\r\n" + str.substring(11);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 9", () => {
    let str = "qneW";
    const pieceTree = createTextBuffer(["qneW"], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(0, "YhIl");
    str = str.substring(0, 0) + "YhIl" + str.substring(0);
    pieceTable.insert(0, "qdsm");
    str = str.substring(0, 0) + "qdsm" + str.substring(0);
    pieceTable.delete(7, 0);
    str = str.substring(0, 7) + str.substring(7 + 0);
    pieceTable.insert(12, "iiPv");
    str = str.substring(0, 12) + "iiPv" + str.substring(12);
    pieceTable.insert(9, "V\rSA");
    str = str.substring(0, 9) + "V\rSA" + str.substring(9);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random bug 10", () => {
    let str = "\n\n\n\n";
    const pieceTree = createTextBuffer(["\n\n\n\n"], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.insert(3, "\n\r\n\r");
    str = str.substring(0, 3) + "\n\r\n\r" + str.substring(3);
    pieceTable.insert(2, "\n\r\n\n");
    str = str.substring(0, 2) + "\n\r\n\n" + str.substring(2);
    pieceTable.insert(0, "\n\n\r\r");
    str = str.substring(0, 0) + "\n\n\r\r" + str.substring(0);
    pieceTable.insert(3, "\r\r\r\r");
    str = str.substring(0, 3) + "\r\r\r\r" + str.substring(3);
    pieceTable.insert(3, "\n\n\r\r");
    str = str.substring(0, 3) + "\n\n\r\r" + str.substring(3);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random chunk bug 1", () => {
    const pieceTree = createTextBuffer(["\n\r\r\n\n\n\r\n\r"], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    let str = "\n\r\r\n\n\n\r\n\r";
    pieceTable.delete(0, 2);
    str = str.substring(0, 0) + str.substring(0 + 2);
    pieceTable.insert(1, "\r\r\n\n");
    str = str.substring(0, 1) + "\r\r\n\n" + str.substring(1);
    pieceTable.insert(7, "\r\r\r\r");
    str = str.substring(0, 7) + "\r\r\r\r" + str.substring(7);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    testLineStarts(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random chunk bug 2", () => {
    const pieceTree = createTextBuffer([
      "\n\r\n\n\n\r\n\r\n\r\r\n\n\n\r\r\n\r\n"
    ], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    let str = "\n\r\n\n\n\r\n\r\n\r\r\n\n\n\r\r\n\r\n";
    pieceTable.insert(16, "\r\n\r\r");
    str = str.substring(0, 16) + "\r\n\r\r" + str.substring(16);
    pieceTable.insert(13, "\n\n\r\r");
    str = str.substring(0, 13) + "\n\n\r\r" + str.substring(13);
    pieceTable.insert(19, "\n\n\r\n");
    str = str.substring(0, 19) + "\n\n\r\n" + str.substring(19);
    pieceTable.delete(5, 0);
    str = str.substring(0, 5) + str.substring(5 + 0);
    pieceTable.delete(11, 2);
    str = str.substring(0, 11) + str.substring(11 + 2);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    testLineStarts(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random chunk bug 3", () => {
    const pieceTree = createTextBuffer(["\r\n\n\n\n\n\n\r\n"], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    let str = "\r\n\n\n\n\n\n\r\n";
    pieceTable.insert(4, "\n\n\r\n\r\r\n\n\r");
    str = str.substring(0, 4) + "\n\n\r\n\r\r\n\n\r" + str.substring(4);
    pieceTable.delete(4, 4);
    str = str.substring(0, 4) + str.substring(4 + 4);
    pieceTable.insert(11, "\r\n\r\n\n\r\r\n\n");
    str = str.substring(0, 11) + "\r\n\r\n\n\r\r\n\n" + str.substring(11);
    pieceTable.delete(1, 2);
    str = str.substring(0, 1) + str.substring(1 + 2);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    testLineStarts(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random chunk bug 4", () => {
    const pieceTree = createTextBuffer(["\n\r\n\r"], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    let str = "\n\r\n\r";
    pieceTable.insert(4, "\n\n\r\n");
    str = str.substring(0, 4) + "\n\n\r\n" + str.substring(4);
    pieceTable.insert(3, "\r\n\n\n");
    str = str.substring(0, 3) + "\r\n\n\n" + str.substring(3);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    testLineStarts(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
});
suite("random is unsupervised", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  test("splitting large change buffer", function() {
    const pieceTree = createTextBuffer([""], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    let str = "";
    pieceTable.insert(0, "WUZ\nXVZY\n");
    str = str.substring(0, 0) + "WUZ\nXVZY\n" + str.substring(0);
    pieceTable.insert(8, "\r\r\nZXUWVW");
    str = str.substring(0, 8) + "\r\r\nZXUWVW" + str.substring(8);
    pieceTable.delete(10, 7);
    str = str.substring(0, 10) + str.substring(10 + 7);
    pieceTable.delete(10, 1);
    str = str.substring(0, 10) + str.substring(10 + 1);
    pieceTable.insert(4, "VX\r\r\nWZVZ");
    str = str.substring(0, 4) + "VX\r\r\nWZVZ" + str.substring(4);
    pieceTable.delete(11, 3);
    str = str.substring(0, 11) + str.substring(11 + 3);
    pieceTable.delete(12, 4);
    str = str.substring(0, 12) + str.substring(12 + 4);
    pieceTable.delete(8, 0);
    str = str.substring(0, 8) + str.substring(8 + 0);
    pieceTable.delete(10, 2);
    str = str.substring(0, 10) + str.substring(10 + 2);
    pieceTable.insert(0, "VZXXZYZX\r");
    str = str.substring(0, 0) + "VZXXZYZX\r" + str.substring(0);
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    testLineStarts(str, pieceTable);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random insert delete", function() {
    this.timeout(5e5);
    let str = "";
    const pieceTree = createTextBuffer([str], false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    for (let i = 0; i < 1e3; i++) {
      if (Math.random() < 0.6) {
        const text = randomStr(100);
        const pos = randomInt(str.length + 1);
        pieceTable.insert(pos, text);
        str = str.substring(0, pos) + text + str.substring(pos);
      } else {
        const pos = randomInt(str.length);
        const length = Math.min(
          str.length - pos,
          Math.floor(Math.random() * 10)
        );
        pieceTable.delete(pos, length);
        str = str.substring(0, pos) + str.substring(pos + length);
      }
    }
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    testLineStarts(str, pieceTable);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random chunks", function() {
    this.timeout(5e5);
    const chunks = [];
    for (let i = 0; i < 5; i++) {
      chunks.push(randomStr(1e3));
    }
    const pieceTree = createTextBuffer(chunks, false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    let str = chunks.join("");
    for (let i = 0; i < 1e3; i++) {
      if (Math.random() < 0.6) {
        const text = randomStr(100);
        const pos = randomInt(str.length + 1);
        pieceTable.insert(pos, text);
        str = str.substring(0, pos) + text + str.substring(pos);
      } else {
        const pos = randomInt(str.length);
        const length = Math.min(
          str.length - pos,
          Math.floor(Math.random() * 10)
        );
        pieceTable.delete(pos, length);
        str = str.substring(0, pos) + str.substring(pos + length);
      }
    }
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    testLineStarts(str, pieceTable);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("random chunks 2", function() {
    this.timeout(5e5);
    const chunks = [];
    chunks.push(randomStr(1e3));
    const pieceTree = createTextBuffer(chunks, false);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    let str = chunks.join("");
    for (let i = 0; i < 50; i++) {
      if (Math.random() < 0.6) {
        const text = randomStr(30);
        const pos = randomInt(str.length + 1);
        pieceTable.insert(pos, text);
        str = str.substring(0, pos) + text + str.substring(pos);
      } else {
        const pos = randomInt(str.length);
        const length = Math.min(
          str.length - pos,
          Math.floor(Math.random() * 10)
        );
        pieceTable.delete(pos, length);
        str = str.substring(0, pos) + str.substring(pos + length);
      }
      testLinesContent(str, pieceTable);
    }
    assert.strictEqual(pieceTable.getLinesRawContent(), str);
    testLineStarts(str, pieceTable);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
});
suite("buffer api", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  test("equal", () => {
    const a = createTextBuffer(["abc"]);
    const b = createTextBuffer(["ab", "c"]);
    const c = createTextBuffer(["abd"]);
    const d = createTextBuffer(["abcd"]);
    ds.add(a);
    ds.add(b);
    ds.add(c);
    ds.add(d);
    assert(a.getPieceTree().equal(b.getPieceTree()));
    assert(!a.getPieceTree().equal(c.getPieceTree()));
    assert(!a.getPieceTree().equal(d.getPieceTree()));
  });
  test("equal with more chunks", () => {
    const a = createTextBuffer(["ab", "cd", "e"]);
    const b = createTextBuffer(["ab", "c", "de"]);
    ds.add(a);
    ds.add(b);
    assert(a.getPieceTree().equal(b.getPieceTree()));
  });
  test("equal 2, empty buffer", () => {
    const a = createTextBuffer([""]);
    const b = createTextBuffer([""]);
    ds.add(a);
    ds.add(b);
    assert(a.getPieceTree().equal(b.getPieceTree()));
  });
  test("equal 3, empty buffer", () => {
    const a = createTextBuffer(["a"]);
    const b = createTextBuffer([""]);
    ds.add(a);
    ds.add(b);
    assert(!a.getPieceTree().equal(b.getPieceTree()));
  });
  test("getLineCharCode - issue #45735", () => {
    const pieceTree = createTextBuffer(["LINE1\nline2"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    assert.strictEqual(pieceTable.getLineCharCode(1, 0), "L".charCodeAt(0), "L");
    assert.strictEqual(pieceTable.getLineCharCode(1, 1), "I".charCodeAt(0), "I");
    assert.strictEqual(pieceTable.getLineCharCode(1, 2), "N".charCodeAt(0), "N");
    assert.strictEqual(pieceTable.getLineCharCode(1, 3), "E".charCodeAt(0), "E");
    assert.strictEqual(pieceTable.getLineCharCode(1, 4), "1".charCodeAt(0), "1");
    assert.strictEqual(pieceTable.getLineCharCode(1, 5), "\n".charCodeAt(0), "\\n");
    assert.strictEqual(pieceTable.getLineCharCode(2, 0), "l".charCodeAt(0), "l");
    assert.strictEqual(pieceTable.getLineCharCode(2, 1), "i".charCodeAt(0), "i");
    assert.strictEqual(pieceTable.getLineCharCode(2, 2), "n".charCodeAt(0), "n");
    assert.strictEqual(pieceTable.getLineCharCode(2, 3), "e".charCodeAt(0), "e");
    assert.strictEqual(pieceTable.getLineCharCode(2, 4), "2".charCodeAt(0), "2");
  });
  test("getLineCharCode - issue #47733", () => {
    const pieceTree = createTextBuffer(["", "LINE1\n", "line2"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    assert.strictEqual(pieceTable.getLineCharCode(1, 0), "L".charCodeAt(0), "L");
    assert.strictEqual(pieceTable.getLineCharCode(1, 1), "I".charCodeAt(0), "I");
    assert.strictEqual(pieceTable.getLineCharCode(1, 2), "N".charCodeAt(0), "N");
    assert.strictEqual(pieceTable.getLineCharCode(1, 3), "E".charCodeAt(0), "E");
    assert.strictEqual(pieceTable.getLineCharCode(1, 4), "1".charCodeAt(0), "1");
    assert.strictEqual(pieceTable.getLineCharCode(1, 5), "\n".charCodeAt(0), "\\n");
    assert.strictEqual(pieceTable.getLineCharCode(2, 0), "l".charCodeAt(0), "l");
    assert.strictEqual(pieceTable.getLineCharCode(2, 1), "i".charCodeAt(0), "i");
    assert.strictEqual(pieceTable.getLineCharCode(2, 2), "n".charCodeAt(0), "n");
    assert.strictEqual(pieceTable.getLineCharCode(2, 3), "e".charCodeAt(0), "e");
    assert.strictEqual(pieceTable.getLineCharCode(2, 4), "2".charCodeAt(0), "2");
  });
  test("getNearestChunk", () => {
    const pieceTree = createTextBuffer(["012345678"]);
    ds.add(pieceTree);
    const pt = pieceTree.getPieceTree();
    pt.insert(3, "ABC");
    assert.equal(pt.getLineContent(1), "012ABC345678");
    assert.equal(pt.getNearestChunk(3), "ABC");
    assert.equal(pt.getNearestChunk(6), "345678");
    pt.delete(9, 1);
    assert.equal(pt.getLineContent(1), "012ABC34578");
    assert.equal(pt.getNearestChunk(6), "345");
    assert.equal(pt.getNearestChunk(9), "78");
  });
});
suite("search offset cache", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  test("render white space exception", () => {
    const pieceTree = createTextBuffer(["class Name{\n	\n			get() {\n\n			}\n		}"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    let str = "class Name{\n	\n			get() {\n\n			}\n		}";
    pieceTable.insert(12, "s");
    str = str.substring(0, 12) + "s" + str.substring(12);
    pieceTable.insert(13, "e");
    str = str.substring(0, 13) + "e" + str.substring(13);
    pieceTable.insert(14, "t");
    str = str.substring(0, 14) + "t" + str.substring(14);
    pieceTable.insert(15, "()");
    str = str.substring(0, 15) + "()" + str.substring(15);
    pieceTable.delete(16, 1);
    str = str.substring(0, 16) + str.substring(16 + 1);
    pieceTable.insert(17, "()");
    str = str.substring(0, 17) + "()" + str.substring(17);
    pieceTable.delete(18, 1);
    str = str.substring(0, 18) + str.substring(18 + 1);
    pieceTable.insert(18, "}");
    str = str.substring(0, 18) + "}" + str.substring(18);
    pieceTable.insert(12, "\n");
    str = str.substring(0, 12) + "\n" + str.substring(12);
    pieceTable.delete(12, 1);
    str = str.substring(0, 12) + str.substring(12 + 1);
    pieceTable.delete(18, 1);
    str = str.substring(0, 18) + str.substring(18 + 1);
    pieceTable.insert(18, "}");
    str = str.substring(0, 18) + "}" + str.substring(18);
    pieceTable.delete(17, 2);
    str = str.substring(0, 17) + str.substring(17 + 2);
    pieceTable.delete(16, 1);
    str = str.substring(0, 16) + str.substring(16 + 1);
    pieceTable.insert(16, ")");
    str = str.substring(0, 16) + ")" + str.substring(16);
    pieceTable.delete(15, 2);
    str = str.substring(0, 15) + str.substring(15 + 2);
    const content = pieceTable.getLinesRawContent();
    assert(content === str);
  });
  test("Line breaks replacement is not necessary when EOL is normalized", () => {
    const pieceTree = createTextBuffer(["abc"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    let str = "abc";
    pieceTable.insert(3, "def\nabc");
    str = str + "def\nabc";
    testLineStarts(str, pieceTable);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("Line breaks replacement is not necessary when EOL is normalized 2", () => {
    const pieceTree = createTextBuffer(["abc\n"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    let str = "abc\n";
    pieceTable.insert(4, "def\nabc");
    str = str + "def\nabc";
    testLineStarts(str, pieceTable);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("Line breaks replacement is not necessary when EOL is normalized 3", () => {
    const pieceTree = createTextBuffer(["abc\n"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    let str = "abc\n";
    pieceTable.insert(2, "def\nabc");
    str = str.substring(0, 2) + "def\nabc" + str.substring(2);
    testLineStarts(str, pieceTable);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
  test("Line breaks replacement is not necessary when EOL is normalized 4", () => {
    const pieceTree = createTextBuffer(["abc\n"]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    let str = "abc\n";
    pieceTable.insert(3, "def\nabc");
    str = str.substring(0, 3) + "def\nabc" + str.substring(3);
    testLineStarts(str, pieceTable);
    testLinesContent(str, pieceTable);
    assertTreeInvariants(pieceTable);
  });
});
function getValueInSnapshot(snapshot) {
  let ret = "";
  let tmp = snapshot.read();
  while (tmp !== null) {
    ret += tmp;
    tmp = snapshot.read();
  }
  return ret;
}
suite("snapshot", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("bug #45564, piece tree pieces should be immutable", () => {
    const model = createTextModel("\n");
    model.applyEdits([
      {
        range: new Range(2, 1, 2, 1),
        text: "!"
      }
    ]);
    const snapshot = model.createSnapshot();
    const snapshot1 = model.createSnapshot();
    assert.strictEqual(model.getLinesContent().join("\n"), getValueInSnapshot(snapshot));
    model.applyEdits([
      {
        range: new Range(2, 1, 2, 2),
        text: ""
      }
    ]);
    model.applyEdits([
      {
        range: new Range(2, 1, 2, 1),
        text: "!"
      }
    ]);
    assert.strictEqual(model.getLinesContent().join("\n"), getValueInSnapshot(snapshot1));
    model.dispose();
  });
  test("immutable snapshot 1", () => {
    const model = createTextModel("abc\ndef");
    const snapshot = model.createSnapshot();
    model.applyEdits([
      {
        range: new Range(2, 1, 2, 4),
        text: ""
      }
    ]);
    model.applyEdits([
      {
        range: new Range(1, 1, 2, 1),
        text: "abc\ndef"
      }
    ]);
    assert.strictEqual(model.getLinesContent().join("\n"), getValueInSnapshot(snapshot));
    model.dispose();
  });
  test("immutable snapshot 2", () => {
    const model = createTextModel("abc\ndef");
    const snapshot = model.createSnapshot();
    model.applyEdits([
      {
        range: new Range(2, 1, 2, 1),
        text: "!"
      }
    ]);
    model.applyEdits([
      {
        range: new Range(2, 1, 2, 2),
        text: ""
      }
    ]);
    assert.strictEqual(model.getLinesContent().join("\n"), getValueInSnapshot(snapshot));
    model.dispose();
  });
  test("immutable snapshot 3", () => {
    const model = createTextModel("abc\ndef");
    model.applyEdits([
      {
        range: new Range(2, 4, 2, 4),
        text: "!"
      }
    ]);
    const snapshot = model.createSnapshot();
    model.applyEdits([
      {
        range: new Range(2, 5, 2, 5),
        text: "!"
      }
    ]);
    assert.notStrictEqual(model.getLinesContent().join("\n"), getValueInSnapshot(snapshot));
    model.dispose();
  });
});
suite("chunk based search", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  test("#45892. For some cases, the buffer is empty but we still try to search", () => {
    const pieceTree = createTextBuffer([""]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.delete(0, 1);
    const ret = pieceTree.findMatchesLineByLine(new Range(1, 1, 1, 1), new SearchData(/abc/, new WordCharacterClassifier(",./", []), "abc"), true, 1e3);
    assert.strictEqual(ret.length, 0);
  });
  test("#45770. FindInNode should not cross node boundary.", () => {
    const pieceTree = createTextBuffer([
      [
        "balabalababalabalababalabalaba",
        "balabalababalabalababalabalaba",
        "",
        "* [ ] task1",
        "* [x] task2 balabalaba",
        "* [ ] task 3"
      ].join("\n")
    ]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.delete(0, 62);
    pieceTable.delete(16, 1);
    pieceTable.insert(16, " ");
    const ret = pieceTable.findMatchesLineByLine(new Range(1, 1, 4, 13), new SearchData(/\[/gi, new WordCharacterClassifier(",./", []), "["), true, 1e3);
    assert.strictEqual(ret.length, 3);
    assert.deepStrictEqual(ret[0].range, new Range(2, 3, 2, 4));
    assert.deepStrictEqual(ret[1].range, new Range(3, 3, 3, 4));
    assert.deepStrictEqual(ret[2].range, new Range(4, 3, 4, 4));
  });
  test("search searching from the middle", () => {
    const pieceTree = createTextBuffer([
      [
        "def",
        "dbcabc"
      ].join("\n")
    ]);
    ds.add(pieceTree);
    const pieceTable = pieceTree.getPieceTree();
    pieceTable.delete(4, 1);
    let ret = pieceTable.findMatchesLineByLine(new Range(2, 3, 2, 6), new SearchData(/a/gi, null, "a"), true, 1e3);
    assert.strictEqual(ret.length, 1);
    assert.deepStrictEqual(ret[0].range, new Range(2, 3, 2, 4));
    pieceTable.delete(4, 1);
    ret = pieceTable.findMatchesLineByLine(new Range(2, 2, 2, 5), new SearchData(/a/gi, null, "a"), true, 1e3);
    assert.strictEqual(ret.length, 1);
    assert.deepStrictEqual(ret[0].range, new Range(2, 2, 2, 3));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvcGllY2VUcmVlVGV4dEJ1ZmZlci9waWVjZVRyZWVUZXh0QnVmZmVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBXb3JkQ2hhcmFjdGVyQ2xhc3NpZmllciB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3dvcmRDaGFyYWN0ZXJDbGFzc2lmaWVyLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBEZWZhdWx0RW5kT2ZMaW5lLCBJVGV4dFNuYXBzaG90LCBTZWFyY2hEYXRhIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IFBpZWNlVHJlZUJhc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvcGllY2VUcmVlVGV4dEJ1ZmZlci9waWVjZVRyZWVCYXNlLmpzJztcbmltcG9ydCB7IFBpZWNlVHJlZVRleHRCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvcGllY2VUcmVlVGV4dEJ1ZmZlci9waWVjZVRyZWVUZXh0QnVmZmVyLmpzJztcbmltcG9ydCB7IFBpZWNlVHJlZVRleHRCdWZmZXJCdWlsZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsL3BpZWNlVHJlZVRleHRCdWZmZXIvcGllY2VUcmVlVGV4dEJ1ZmZlckJ1aWxkZXIuanMnO1xuaW1wb3J0IHsgTm9kZUNvbG9yLCBTRU5USU5FTCwgVHJlZU5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvcGllY2VUcmVlVGV4dEJ1ZmZlci9yYlRyZWVCYXNlLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uLy4uL3Rlc3RUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgc3BsaXRMaW5lcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbmNvbnN0IGFscGhhYmV0ID0gJ2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpcXHJcXG4nO1xuXG5mdW5jdGlvbiByYW5kb21DaGFyKCkge1xuXHRyZXR1cm4gYWxwaGFiZXRbcmFuZG9tSW50KGFscGhhYmV0Lmxlbmd0aCldO1xufVxuXG5mdW5jdGlvbiByYW5kb21JbnQoYm91bmQ6IG51bWJlcikge1xuXHRyZXR1cm4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogYm91bmQpO1xufVxuXG5mdW5jdGlvbiByYW5kb21TdHIobGVuOiBudW1iZXIpIHtcblx0aWYgKGxlbiA9PT0gbnVsbCkge1xuXHRcdGxlbiA9IDEwO1xuXHR9XG5cdHJldHVybiAoZnVuY3Rpb24gKCkge1xuXHRcdGxldCBqLCByZWY7XG5cdFx0Y29uc3QgcmVzdWx0cyA9IFtdO1xuXHRcdGZvciAoXG5cdFx0XHRqID0gMSwgcmVmID0gbGVuO1xuXHRcdFx0MSA8PSByZWYgPyBqIDwgcmVmIDogaiA+IHJlZjtcblx0XHRcdDEgPD0gcmVmID8gaisrIDogai0tXG5cdFx0KSB7XG5cdFx0XHRyZXN1bHRzLnB1c2gocmFuZG9tQ2hhcigpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdHM7XG5cdH0pKCkuam9pbignJyk7XG59XG5cbmZ1bmN0aW9uIHRyaW1MaW5lRmVlZCh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRpZiAodGV4dC5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4gdGV4dDtcblx0fVxuXG5cdGlmICh0ZXh0Lmxlbmd0aCA9PT0gMSkge1xuXHRcdGlmIChcblx0XHRcdHRleHQuY2hhckNvZGVBdCh0ZXh0Lmxlbmd0aCAtIDEpID09PSAxMCB8fFxuXHRcdFx0dGV4dC5jaGFyQ29kZUF0KHRleHQubGVuZ3RoIC0gMSkgPT09IDEzXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXHRcdHJldHVybiB0ZXh0O1xuXHR9XG5cblx0aWYgKHRleHQuY2hhckNvZGVBdCh0ZXh0Lmxlbmd0aCAtIDEpID09PSAxMCkge1xuXHRcdGlmICh0ZXh0LmNoYXJDb2RlQXQodGV4dC5sZW5ndGggLSAyKSA9PT0gMTMpIHtcblx0XHRcdHJldHVybiB0ZXh0LnNsaWNlKDAsIC0yKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRleHQuc2xpY2UoMCwgLTEpO1xuXHR9XG5cblx0aWYgKHRleHQuY2hhckNvZGVBdCh0ZXh0Lmxlbmd0aCAtIDEpID09PSAxMykge1xuXHRcdHJldHVybiB0ZXh0LnNsaWNlKDAsIC0xKTtcblx0fVxuXG5cdHJldHVybiB0ZXh0O1xufVxuXG4vLyNyZWdpb24gQXNzZXJ0aW9uXG5cbmZ1bmN0aW9uIHRlc3RMaW5lc0NvbnRlbnQoc3RyOiBzdHJpbmcsIHBpZWNlVGFibGU6IFBpZWNlVHJlZUJhc2UpIHtcblx0Y29uc3QgbGluZXMgPSBzcGxpdExpbmVzKHN0cik7XG5cdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVDb3VudCgpLCBsaW5lcy5sZW5ndGgpO1xuXHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lc1Jhd0NvbnRlbnQoKSwgc3RyKTtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVDb250ZW50KGkgKyAxKSwgbGluZXNbaV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHRyaW1MaW5lRmVlZChcblx0XHRcdFx0cGllY2VUYWJsZS5nZXRWYWx1ZUluUmFuZ2UoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKFxuXHRcdFx0XHRcdFx0aSArIDEsXG5cdFx0XHRcdFx0XHQxLFxuXHRcdFx0XHRcdFx0aSArIDEsXG5cdFx0XHRcdFx0XHRsaW5lc1tpXS5sZW5ndGggKyAoaSA9PT0gbGluZXMubGVuZ3RoIC0gMSA/IDEgOiAyKVxuXHRcdFx0XHRcdClcblx0XHRcdFx0KVxuXHRcdFx0KSxcblx0XHRcdGxpbmVzW2ldXG5cdFx0KTtcblx0fVxufVxuXG5mdW5jdGlvbiB0ZXN0TGluZVN0YXJ0cyhzdHI6IHN0cmluZywgcGllY2VUYWJsZTogUGllY2VUcmVlQmFzZSkge1xuXHRjb25zdCBsaW5lU3RhcnRzID0gWzBdO1xuXG5cdC8vIFJlc2V0IHJlZ2V4IHRvIHNlYXJjaCBmcm9tIHRoZSBiZWdpbm5pbmdcblx0Y29uc3QgX3JlZ2V4ID0gbmV3IFJlZ0V4cCgvXFxyXFxufFxccnxcXG4vZyk7XG5cdF9yZWdleC5sYXN0SW5kZXggPSAwO1xuXHRsZXQgcHJldk1hdGNoU3RhcnRJbmRleCA9IC0xO1xuXHRsZXQgcHJldk1hdGNoTGVuZ3RoID0gMDtcblxuXHRsZXQgbTogUmVnRXhwRXhlY0FycmF5IHwgbnVsbDtcblx0ZG8ge1xuXHRcdGlmIChwcmV2TWF0Y2hTdGFydEluZGV4ICsgcHJldk1hdGNoTGVuZ3RoID09PSBzdHIubGVuZ3RoKSB7XG5cdFx0XHQvLyBSZWFjaGVkIHRoZSBlbmQgb2YgdGhlIGxpbmVcblx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdG0gPSBfcmVnZXguZXhlYyhzdHIpO1xuXHRcdGlmICghbSkge1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWF0Y2hTdGFydEluZGV4ID0gbS5pbmRleDtcblx0XHRjb25zdCBtYXRjaExlbmd0aCA9IG1bMF0ubGVuZ3RoO1xuXG5cdFx0aWYgKFxuXHRcdFx0bWF0Y2hTdGFydEluZGV4ID09PSBwcmV2TWF0Y2hTdGFydEluZGV4ICYmXG5cdFx0XHRtYXRjaExlbmd0aCA9PT0gcHJldk1hdGNoTGVuZ3RoXG5cdFx0KSB7XG5cdFx0XHQvLyBFeGl0IGVhcmx5IGlmIHRoZSByZWdleCBtYXRjaGVzIHRoZSBzYW1lIHJhbmdlIHR3aWNlXG5cdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRwcmV2TWF0Y2hTdGFydEluZGV4ID0gbWF0Y2hTdGFydEluZGV4O1xuXHRcdHByZXZNYXRjaExlbmd0aCA9IG1hdGNoTGVuZ3RoO1xuXG5cdFx0bGluZVN0YXJ0cy5wdXNoKG1hdGNoU3RhcnRJbmRleCArIG1hdGNoTGVuZ3RoKTtcblx0fSB3aGlsZSAobSk7XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lU3RhcnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdChsaW5lU3RhcnRzW2ldKSxcblx0XHRcdG5ldyBQb3NpdGlvbihpICsgMSwgMSlcblx0XHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldE9mZnNldEF0KGkgKyAxLCAxKSwgbGluZVN0YXJ0c1tpXSk7XG5cdH1cblxuXHRmb3IgKGxldCBpID0gMTsgaSA8IGxpbmVTdGFydHMubGVuZ3RoOyBpKyspIHtcblx0XHRjb25zdCBwb3MgPSBwaWVjZVRhYmxlLmdldFBvc2l0aW9uQXQobGluZVN0YXJ0c1tpXSAtIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHBpZWNlVGFibGUuZ2V0T2Zmc2V0QXQocG9zLmxpbmVOdW1iZXIsIHBvcy5jb2x1bW4pLFxuXHRcdFx0bGluZVN0YXJ0c1tpXSAtIDFcblx0XHQpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVRleHRCdWZmZXIodmFsOiBzdHJpbmdbXSwgbm9ybWFsaXplRU9MOiBib29sZWFuID0gdHJ1ZSk6IFBpZWNlVHJlZVRleHRCdWZmZXIge1xuXHRjb25zdCBidWZmZXJCdWlsZGVyID0gbmV3IFBpZWNlVHJlZVRleHRCdWZmZXJCdWlsZGVyKCk7XG5cdGZvciAoY29uc3QgY2h1bmsgb2YgdmFsKSB7XG5cdFx0YnVmZmVyQnVpbGRlci5hY2NlcHRDaHVuayhjaHVuayk7XG5cdH1cblx0Y29uc3QgZmFjdG9yeSA9IGJ1ZmZlckJ1aWxkZXIuZmluaXNoKG5vcm1hbGl6ZUVPTCk7XG5cdHJldHVybiAoPFBpZWNlVHJlZVRleHRCdWZmZXI+ZmFjdG9yeS5jcmVhdGUoRGVmYXVsdEVuZE9mTGluZS5MRikudGV4dEJ1ZmZlcik7XG59XG5cbmZ1bmN0aW9uIGFzc2VydFRyZWVJbnZhcmlhbnRzKFQ6IFBpZWNlVHJlZUJhc2UpOiB2b2lkIHtcblx0YXNzZXJ0KFNFTlRJTkVMLmNvbG9yID09PSBOb2RlQ29sb3IuQmxhY2spO1xuXHRhc3NlcnQoU0VOVElORUwucGFyZW50ID09PSBTRU5USU5FTCk7XG5cdGFzc2VydChTRU5USU5FTC5sZWZ0ID09PSBTRU5USU5FTCk7XG5cdGFzc2VydChTRU5USU5FTC5yaWdodCA9PT0gU0VOVElORUwpO1xuXHRhc3NlcnQoU0VOVElORUwuc2l6ZV9sZWZ0ID09PSAwKTtcblx0YXNzZXJ0KFNFTlRJTkVMLmxmX2xlZnQgPT09IDApO1xuXHRhc3NlcnRWYWxpZFRyZWUoVCk7XG59XG5cbmZ1bmN0aW9uIGRlcHRoKG46IFRyZWVOb2RlKTogbnVtYmVyIHtcblx0aWYgKG4gPT09IFNFTlRJTkVMKSB7XG5cdFx0Ly8gVGhlIGxlYWZzIGFyZSBibGFja1xuXHRcdHJldHVybiAxO1xuXHR9XG5cdGFzc2VydChkZXB0aChuLmxlZnQpID09PSBkZXB0aChuLnJpZ2h0KSk7XG5cdHJldHVybiAobi5jb2xvciA9PT0gTm9kZUNvbG9yLkJsYWNrID8gMSA6IDApICsgZGVwdGgobi5sZWZ0KTtcbn1cblxuZnVuY3Rpb24gYXNzZXJ0VmFsaWROb2RlKG46IFRyZWVOb2RlKTogeyBzaXplOiBudW1iZXI7IGxmX2NudDogbnVtYmVyIH0ge1xuXHRpZiAobiA9PT0gU0VOVElORUwpIHtcblx0XHRyZXR1cm4geyBzaXplOiAwLCBsZl9jbnQ6IDAgfTtcblx0fVxuXG5cdGNvbnN0IGwgPSBuLmxlZnQ7XG5cdGNvbnN0IHIgPSBuLnJpZ2h0O1xuXG5cdGlmIChuLmNvbG9yID09PSBOb2RlQ29sb3IuUmVkKSB7XG5cdFx0YXNzZXJ0KGwuY29sb3IgPT09IE5vZGVDb2xvci5CbGFjayk7XG5cdFx0YXNzZXJ0KHIuY29sb3IgPT09IE5vZGVDb2xvci5CbGFjayk7XG5cdH1cblxuXHRjb25zdCBhY3R1YWxMZWZ0ID0gYXNzZXJ0VmFsaWROb2RlKGwpO1xuXHRhc3NlcnQoYWN0dWFsTGVmdC5sZl9jbnQgPT09IG4ubGZfbGVmdCk7XG5cdGFzc2VydChhY3R1YWxMZWZ0LnNpemUgPT09IG4uc2l6ZV9sZWZ0KTtcblx0Y29uc3QgYWN0dWFsUmlnaHQgPSBhc3NlcnRWYWxpZE5vZGUocik7XG5cblx0cmV0dXJuIHsgc2l6ZTogbi5zaXplX2xlZnQgKyBuLnBpZWNlLmxlbmd0aCArIGFjdHVhbFJpZ2h0LnNpemUsIGxmX2NudDogbi5sZl9sZWZ0ICsgbi5waWVjZS5saW5lRmVlZENudCArIGFjdHVhbFJpZ2h0LmxmX2NudCB9O1xufVxuXG5mdW5jdGlvbiBhc3NlcnRWYWxpZFRyZWUoVDogUGllY2VUcmVlQmFzZSk6IHZvaWQge1xuXHRpZiAoVC5yb290ID09PSBTRU5USU5FTCkge1xuXHRcdHJldHVybjtcblx0fVxuXHRhc3NlcnQoVC5yb290LmNvbG9yID09PSBOb2RlQ29sb3IuQmxhY2spO1xuXHRhc3NlcnQoZGVwdGgoVC5yb290LmxlZnQpID09PSBkZXB0aChULnJvb3QucmlnaHQpKTtcblx0YXNzZXJ0VmFsaWROb2RlKFQucm9vdCk7XG59XG5cbi8vI2VuZHJlZ2lvblxuXG5zdWl0ZSgnaW5zZXJ0cyBhbmQgZGVsZXRlcycsICgpID0+IHtcblx0Y29uc3QgZHMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdiYXNpYyBpbnNlcnQvZGVsZXRlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoW1xuXHRcdFx0J1RoaXMgaXMgYSBkb2N1bWVudCB3aXRoIHNvbWUgdGV4dC4nXG5cdFx0XSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblxuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDM0LCAnVGhpcyBpcyBzb21lIG1vcmUgdGV4dCB0byBpbnNlcnQgYXQgb2Zmc2V0IDM0LicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHBpZWNlVGFibGUuZ2V0TGluZXNSYXdDb250ZW50KCksXG5cdFx0XHQnVGhpcyBpcyBhIGRvY3VtZW50IHdpdGggc29tZSB0ZXh0LlRoaXMgaXMgc29tZSBtb3JlIHRleHQgdG8gaW5zZXJ0IGF0IG9mZnNldCAzNC4nXG5cdFx0KTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg0MiwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0cGllY2VUYWJsZS5nZXRMaW5lc1Jhd0NvbnRlbnQoKSxcblx0XHRcdCdUaGlzIGlzIGEgZG9jdW1lbnQgd2l0aCBzb21lIHRleHQuVGhpcyBpcyBtb3JlIHRleHQgdG8gaW5zZXJ0IGF0IG9mZnNldCAzNC4nXG5cdFx0KTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgnbW9yZSBpbnNlcnRzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWycnXSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcHQgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0cHQuaW5zZXJ0KDAsICdBQUEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHQuZ2V0TGluZXNSYXdDb250ZW50KCksICdBQUEnKTtcblx0XHRwdC5pbnNlcnQoMCwgJ0JCQicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwdC5nZXRMaW5lc1Jhd0NvbnRlbnQoKSwgJ0JCQkFBQScpO1xuXHRcdHB0Lmluc2VydCg2LCAnQ0NDJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHB0LmdldExpbmVzUmF3Q29udGVudCgpLCAnQkJCQUFBQ0NDJyk7XG5cdFx0cHQuaW5zZXJ0KDUsICdEREQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHQuZ2V0TGluZXNSYXdDb250ZW50KCksICdCQkJBQUREREFDQ0MnKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vcmUgZGVsZXRlcycsICgpID0+IHtcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnMDEyMzQ1Njc4J10pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHB0ID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXG5cdFx0cHQuZGVsZXRlKDgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwdC5nZXRMaW5lc1Jhd0NvbnRlbnQoKSwgJzAxMjM0NTY3Jyk7XG5cdFx0cHQuZGVsZXRlKDAsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwdC5nZXRMaW5lc1Jhd0NvbnRlbnQoKSwgJzEyMzQ1NjcnKTtcblx0XHRwdC5kZWxldGUoNSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHB0LmdldExpbmVzUmF3Q29udGVudCgpLCAnMTIzNDU3Jyk7XG5cdFx0cHQuZGVsZXRlKDUsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwdC5nZXRMaW5lc1Jhd0NvbnRlbnQoKSwgJzEyMzQ1Jyk7XG5cdFx0cHQuZGVsZXRlKDAsIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwdC5nZXRMaW5lc1Jhd0NvbnRlbnQoKSwgJycpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHB0KTtcblx0fSk7XG5cblx0dGVzdCgncmFuZG9tIHRlc3QgMScsICgpID0+IHtcblx0XHRsZXQgc3RyID0gJyc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJyddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ2NlTFBIbUZ6dkN0RmVIa0NCZWogJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdjZUxQSG1GenZDdEZlSGtDQmVqICcgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDgsICdnRENFZk5ZaUJVTmtTd3R2QiBLICcpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgOCkgKyAnZ0RDRWZOWWlCVU5rU3d0dkIgSyAnICsgc3RyLnN1YnN0cmluZyg4KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lc1Jhd0NvbnRlbnQoKSwgc3RyKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgzOCwgJ2N5TmNIeGpOUFBvZWhCSmxkTFMgJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAzOCkgKyAnY3lOY0h4ak5QUG9laEJKbGRMUyAnICsgc3RyLnN1YnN0cmluZygzOCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZXNSYXdDb250ZW50KCksIHN0cik7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNTksICdlak14XFxuT1RnV2xicGVERXhqT2sgJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA1OSkgKyAnZWpNeFxcbk9UZ1dsYnBlREV4ak9rICcgKyBzdHIuc3Vic3RyaW5nKDU5KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyYW5kb20gdGVzdCAyJywgKCkgPT4ge1xuXHRcdGxldCBzdHIgPSAnJztcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnJ10pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1ZnUEcgJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdWZ1BHICcgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDIsICdEZFdGICcpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMikgKyAnRGRXRiAnICsgc3RyLnN1YnN0cmluZygyKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnaFVKYyAnKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgJ2hVSmMgJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoOCwgJ2xRRXEgJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA4KSArICdsUUVxICcgKyBzdHIuc3Vic3RyaW5nKDgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDEwLCAnR2J0cCAnKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDEwKSArICdHYnRwICcgKyBzdHIuc3Vic3RyaW5nKDEwKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyYW5kb20gdGVzdCAzJywgKCkgPT4ge1xuXHRcdGxldCBzdHIgPSAnJztcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnJ10pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ2dZU3onKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgJ2dZU3onICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgxLCAnbURRZScpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMSkgKyAnbURRZScgKyBzdHIuc3Vic3RyaW5nKDEpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDEsICdEVE1RJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxKSArICdEVE1RJyArIHN0ci5zdWJzdHJpbmcoMSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMiwgJ0dHWkInKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDIpICsgJ0dHWkInICsgc3RyLnN1YnN0cmluZygyKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgxMiwgJ3dYcHEnKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDEyKSArICd3WHBxJyArIHN0ci5zdWJzdHJpbmcoMTIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXHR9KTtcblxuXHR0ZXN0KCdyYW5kb20gZGVsZXRlIDEnLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICcnO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWycnXSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblxuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICd2ZmInKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgJ3ZmYicgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICd6UnEnKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgJ3pScScgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNSwgMSk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA1KSArIHN0ci5zdWJzdHJpbmcoNSArIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMSwgJ1VOdycpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMSkgKyAnVU53JyArIHN0ci5zdWJzdHJpbmcoMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZXNSYXdDb250ZW50KCksIHN0cik7XG5cblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg0LCAzKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDQpICsgc3RyLnN1YnN0cmluZyg0ICsgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZXNSYXdDb250ZW50KCksIHN0cik7XG5cblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgxLCA0KTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDEpICsgc3RyLnN1YnN0cmluZygxICsgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZXNSYXdDb250ZW50KCksIHN0cik7XG5cblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgwLCAxKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgc3RyLnN1YnN0cmluZygwICsgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZXNSYXdDb250ZW50KCksIHN0cik7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JhbmRvbSBkZWxldGUgMicsICgpID0+IHtcblx0XHRsZXQgc3RyID0gJyc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJyddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ0lEVCcpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnSURUJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMywgJ3d3QScpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMykgKyAnd3dBJyArIHN0ci5zdWJzdHJpbmcoMyk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMywgJ0ducicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMykgKyAnR25yJyArIHN0ci5zdWJzdHJpbmcoMyk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNiwgMyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA2KSArIHN0ci5zdWJzdHJpbmcoNiArIDMpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDQsICdlSHAnKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDQpICsgJ2VIcCcgKyBzdHIuc3Vic3RyaW5nKDQpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDEsICdVQWknKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDEpICsgJ1VBaScgKyBzdHIuc3Vic3RyaW5nKDEpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDIsICdGclInKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDIpICsgJ0ZyUicgKyBzdHIuc3Vic3RyaW5nKDIpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDYsIDcpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNikgKyBzdHIuc3Vic3RyaW5nKDYgKyA3KTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgzLCA1KTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDMpICsgc3RyLnN1YnN0cmluZygzICsgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZXNSYXdDb250ZW50KCksIHN0cik7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JhbmRvbSBkZWxldGUgMycsICgpID0+IHtcblx0XHRsZXQgc3RyID0gJyc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJyddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICdQcU0nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgJ1BxTScgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDEsIDIpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMSkgKyBzdHIuc3Vic3RyaW5nKDEgKyAyKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgxLCAnekxjJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxKSArICd6TGMnICsgc3RyLnN1YnN0cmluZygxKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnTUVYJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdNRVgnICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnalpoJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdqWmgnICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCg4LCAnR3dRJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA4KSArICdHd1EnICsgc3RyLnN1YnN0cmluZyg4KTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg1LCA2KTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDUpICsgc3RyLnN1YnN0cmluZyg1ICsgNik7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNCwgJ2t0dycpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNCkgKyAna3R3JyArIHN0ci5zdWJzdHJpbmcoNCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNSwgJ0dWdScpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNSkgKyAnR1Z1JyArIHN0ci5zdWJzdHJpbmcoNSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoOSwgJ2pkbScpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgOSkgKyAnamRtJyArIHN0ci5zdWJzdHJpbmcoOSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMTUsICduYVxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMTUpICsgJ25hXFxuJyArIHN0ci5zdWJzdHJpbmcoMTUpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDUsIDgpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNSkgKyBzdHIuc3Vic3RyaW5nKDUgKyA4KTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgzLCA0KTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDMpICsgc3RyLnN1YnN0cmluZygzICsgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZXNSYXdDb250ZW50KCksIHN0cik7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JhbmRvbSBpbnNlcnQvZGVsZXRlIFxcXFxyIGJ1ZyAxJywgKCkgPT4ge1xuXHRcdGxldCBzdHIgPSAnYSc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJ2EnXSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgwLCAxKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgc3RyLnN1YnN0cmluZygwICsgMSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1xcclxcclxcblxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnXFxyXFxyXFxuXFxuJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMywgMSk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAzKSArIHN0ci5zdWJzdHJpbmcoMyArIDEpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDIsICdcXG5cXG5cXHJhJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyKSArICdcXG5cXG5cXHJhJyArIHN0ci5zdWJzdHJpbmcoMik7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNCwgMyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArIHN0ci5zdWJzdHJpbmcoNCArIDMpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDIsICdcXG5hXFxyXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyKSArICdcXG5hXFxyXFxyJyArIHN0ci5zdWJzdHJpbmcoMik7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNiwgJ1xccmFcXG5cXG4nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDYpICsgJ1xccmFcXG5cXG4nICsgc3RyLnN1YnN0cmluZyg2KTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnYWFcXG5cXG4nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgJ2FhXFxuXFxuJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNSwgJ1xcblxcbmFcXHInKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDUpICsgJ1xcblxcbmFcXHInICsgc3RyLnN1YnN0cmluZyg1KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyYW5kb20gaW5zZXJ0L2RlbGV0ZSBcXFxcciBidWcgMicsICgpID0+IHtcblx0XHRsZXQgc3RyID0gJ2EnO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydhJ10pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMSwgJ1xcbmFhXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxKSArICdcXG5hYVxccicgKyBzdHIuc3Vic3RyaW5nKDEpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDAsIDQpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyBzdHIuc3Vic3RyaW5nKDAgKyA0KTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgxLCAnXFxyXFxyXFxuYScpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMSkgKyAnXFxyXFxyXFxuYScgKyBzdHIuc3Vic3RyaW5nKDEpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDIsICdcXG5cXHJcXHJhJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyKSArICdcXG5cXHJcXHJhJyArIHN0ci5zdWJzdHJpbmcoMik7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNCwgMSk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArIHN0ci5zdWJzdHJpbmcoNCArIDEpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDgsICdcXHJcXG5cXHJcXHInKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDgpICsgJ1xcclxcblxcclxccicgKyBzdHIuc3Vic3RyaW5nKDgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDcsICdcXG5cXG5cXG5hJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA3KSArICdcXG5cXG5cXG5hJyArIHN0ci5zdWJzdHJpbmcoNyk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMTMsICdhXFxuXFxuYScpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMTMpICsgJ2FcXG5cXG5hJyArIHN0ci5zdWJzdHJpbmcoMTMpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDE3LCAzKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDE3KSArIHN0ci5zdWJzdHJpbmcoMTcgKyAzKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgyLCAnYVxccmFcXG4nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDIpICsgJ2FcXHJhXFxuJyArIHN0ci5zdWJzdHJpbmcoMik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lc1Jhd0NvbnRlbnQoKSwgc3RyKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgncmFuZG9tIGluc2VydC9kZWxldGUgXFxcXHIgYnVnIDMnLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICdhJztcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnYSddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICdcXHJcXG5hXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdcXHJcXG5hXFxyJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMiwgMyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyKSArIHN0ci5zdWJzdHJpbmcoMiArIDMpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDIsICdhXFxyXFxuXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyKSArICdhXFxyXFxuXFxyJyArIHN0ci5zdWJzdHJpbmcoMik7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNCwgMik7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArIHN0ci5zdWJzdHJpbmcoNCArIDIpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDQsICdhXFxuXFxyXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArICdhXFxuXFxyXFxuJyArIHN0ci5zdWJzdHJpbmcoNCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMSwgJ2FhXFxuXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxKSArICdhYVxcblxccicgKyBzdHIuc3Vic3RyaW5nKDEpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDcsICdcXG5hXFxyXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA3KSArICdcXG5hXFxyXFxuJyArIHN0ci5zdWJzdHJpbmcoNyk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNSwgJ1xcblxcbmFcXHInKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDUpICsgJ1xcblxcbmFcXHInICsgc3RyLnN1YnN0cmluZyg1KTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgxMCwgJ1xcclxcclxcblxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMTApICsgJ1xcclxcclxcblxccicgKyBzdHIuc3Vic3RyaW5nKDEwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lc1Jhd0NvbnRlbnQoKSwgc3RyKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgyMSwgMyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyMSkgKyBzdHIuc3Vic3RyaW5nKDIxICsgMyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lc1Jhd0NvbnRlbnQoKSwgc3RyKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgncmFuZG9tIGluc2VydC9kZWxldGUgXFxcXHIgYnVnIDRzJywgKCkgPT4ge1xuXHRcdGxldCBzdHIgPSAnYSc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJ2EnXSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgwLCAxKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgc3RyLnN1YnN0cmluZygwICsgMSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1xcbmFhYScpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnXFxuYWFhJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMiwgJ1xcblxcbmFhJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyKSArICdcXG5cXG5hYScgKyBzdHIuc3Vic3RyaW5nKDIpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDEsIDQpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMSkgKyBzdHIuc3Vic3RyaW5nKDEgKyA0KTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgzLCAxKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDMpICsgc3RyLnN1YnN0cmluZygzICsgMSk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMSwgMik7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxKSArIHN0ci5zdWJzdHJpbmcoMSArIDIpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDAsIDEpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyBzdHIuc3Vic3RyaW5nKDAgKyAxKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnYVxcblxcblxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnYVxcblxcblxccicgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDIsICdhYVxcclxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMikgKyAnYWFcXHJcXG4nICsgc3RyLnN1YnN0cmluZygyKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgzLCAnYVxcbmFhJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAzKSArICdhXFxuYWEnICsgc3RyLnN1YnN0cmluZygzKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblx0dGVzdCgncmFuZG9tIGluc2VydC9kZWxldGUgXFxcXHIgYnVnIDUnLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICcnO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWycnXSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnXFxuXFxuXFxuXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdcXG5cXG5cXG5cXHInICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgxLCAnXFxuXFxuXFxuXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxKSArICdcXG5cXG5cXG5cXHInICsgc3RyLnN1YnN0cmluZygxKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgyLCAnXFxuXFxyXFxyXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyKSArICdcXG5cXHJcXHJcXHInICsgc3RyLnN1YnN0cmluZygyKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCg4LCAnXFxuXFxyXFxuXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA4KSArICdcXG5cXHJcXG5cXHInICsgc3RyLnN1YnN0cmluZyg4KTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg1LCAyKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDUpICsgc3RyLnN1YnN0cmluZyg1ICsgMik7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNCwgJ1xcblxcclxcclxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNCkgKyAnXFxuXFxyXFxyXFxyJyArIHN0ci5zdWJzdHJpbmcoNCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoOCwgJ1xcblxcblxcblxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgOCkgKyAnXFxuXFxuXFxuXFxyJyArIHN0ci5zdWJzdHJpbmcoOCk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMCwgNyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArIHN0ci5zdWJzdHJpbmcoMCArIDcpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDEsICdcXHJcXG5cXHJcXHInKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDEpICsgJ1xcclxcblxcclxccicgKyBzdHIuc3Vic3RyaW5nKDEpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDE1LCAnXFxuXFxyXFxyXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxNSkgKyAnXFxuXFxyXFxyXFxyJyArIHN0ci5zdWJzdHJpbmcoMTUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZXNSYXdDb250ZW50KCksIHN0cik7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdwcmVmaXggc3VtIGZvciBsaW5lIGZlZWQnLCAoKSA9PiB7XG5cdGNvbnN0IGRzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnYmFzaWMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJzFcXG4yXFxuM1xcbjQnXSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVDb3VudCgpLCA0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCgwKSwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCgxKSwgbmV3IFBvc2l0aW9uKDEsIDIpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCgyKSwgbmV3IFBvc2l0aW9uKDIsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCgzKSwgbmV3IFBvc2l0aW9uKDIsIDIpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCg0KSwgbmV3IFBvc2l0aW9uKDMsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCg1KSwgbmV3IFBvc2l0aW9uKDMsIDIpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCg2KSwgbmV3IFBvc2l0aW9uKDQsIDEpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldE9mZnNldEF0KDEsIDEpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRPZmZzZXRBdCgxLCAyKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0T2Zmc2V0QXQoMiwgMSksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldE9mZnNldEF0KDIsIDIpLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRPZmZzZXRBdCgzLCAxKSwgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0T2Zmc2V0QXQoMywgMiksIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldE9mZnNldEF0KDQsIDEpLCA2KTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgnYXBwZW5kJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydhXFxuYlxcbmNcXG5kZSddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDgsICdmaFxcbmlcXG5qaycpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZUNvdW50KCksIDYpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRQb3NpdGlvbkF0KDkpLCBuZXcgUG9zaXRpb24oNCwgNCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldE9mZnNldEF0KDEsIDEpLCAwKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0JywgKCkgPT4ge1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydhXFxuYlxcbmNcXG5kZSddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDcsICdmaFxcbmlcXG5qaycpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZUNvdW50KCksIDYpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRQb3NpdGlvbkF0KDYpLCBuZXcgUG9zaXRpb24oNCwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRQb3NpdGlvbkF0KDcpLCBuZXcgUG9zaXRpb24oNCwgMikpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRQb3NpdGlvbkF0KDgpLCBuZXcgUG9zaXRpb24oNCwgMykpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRQb3NpdGlvbkF0KDkpLCBuZXcgUG9zaXRpb24oNCwgNCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRQb3NpdGlvbkF0KDEyKSwgbmV3IFBvc2l0aW9uKDYsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCgxMyksIG5ldyBQb3NpdGlvbig2LCAyKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldFBvc2l0aW9uQXQoMTQpLCBuZXcgUG9zaXRpb24oNiwgMykpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0T2Zmc2V0QXQoNCwgMSksIDYpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldE9mZnNldEF0KDQsIDIpLCA3KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRPZmZzZXRBdCg0LCAzKSwgOCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0T2Zmc2V0QXQoNCwgNCksIDkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldE9mZnNldEF0KDYsIDEpLCAxMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0T2Zmc2V0QXQoNiwgMiksIDEzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRPZmZzZXRBdCg2LCAzKSwgMTQpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJ2FcXG5iXFxuY1xcbmRlZmhcXG5pXFxuamsnXSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblxuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDcsIDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZXNSYXdDb250ZW50KCksICdhXFxuYlxcbmNcXG5kaFxcbmlcXG5qaycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVDb3VudCgpLCA2KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCg2KSwgbmV3IFBvc2l0aW9uKDQsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCg3KSwgbmV3IFBvc2l0aW9uKDQsIDIpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCg4KSwgbmV3IFBvc2l0aW9uKDQsIDMpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCg5KSwgbmV3IFBvc2l0aW9uKDUsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCgxMSksIG5ldyBQb3NpdGlvbig2LCAxKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldFBvc2l0aW9uQXQoMTIpLCBuZXcgUG9zaXRpb24oNiwgMikpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRQb3NpdGlvbkF0KDEzKSwgbmV3IFBvc2l0aW9uKDYsIDMpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldE9mZnNldEF0KDQsIDEpLCA2KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRPZmZzZXRBdCg0LCAyKSwgNyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0T2Zmc2V0QXQoNCwgMyksIDgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldE9mZnNldEF0KDUsIDEpLCA5KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRPZmZzZXRBdCg2LCAxKSwgMTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldE9mZnNldEF0KDYsIDIpLCAxMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0T2Zmc2V0QXQoNiwgMyksIDEzKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgnYWRkK2RlbGV0ZSAxJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydhXFxuYlxcbmNcXG5kZSddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDgsICdmaFxcbmlcXG5qaycpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDcsIDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZXNSYXdDb250ZW50KCksICdhXFxuYlxcbmNcXG5kaFxcbmlcXG5qaycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVDb3VudCgpLCA2KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCg2KSwgbmV3IFBvc2l0aW9uKDQsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCg3KSwgbmV3IFBvc2l0aW9uKDQsIDIpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCg4KSwgbmV3IFBvc2l0aW9uKDQsIDMpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCg5KSwgbmV3IFBvc2l0aW9uKDUsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0UG9zaXRpb25BdCgxMSksIG5ldyBQb3NpdGlvbig2LCAxKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldFBvc2l0aW9uQXQoMTIpLCBuZXcgUG9zaXRpb24oNiwgMikpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRQb3NpdGlvbkF0KDEzKSwgbmV3IFBvc2l0aW9uKDYsIDMpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldE9mZnNldEF0KDQsIDEpLCA2KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRPZmZzZXRBdCg0LCAyKSwgNyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0T2Zmc2V0QXQoNCwgMyksIDgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldE9mZnNldEF0KDUsIDEpLCA5KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRPZmZzZXRBdCg2LCAxKSwgMTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldE9mZnNldEF0KDYsIDIpLCAxMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0T2Zmc2V0QXQoNiwgMyksIDEzKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0IHJhbmRvbSBidWcgMTogcHJlZml4U3VtQ29tcHV0ZXIucmVtb3ZlVmFsdWVzKHN0YXJ0LCBjbnQpIGNudCBpcyAxIGJhc2VkLicsICgpID0+IHtcblx0XHRsZXQgc3RyID0gJyc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJyddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICcgWlggXFxuIFpcXG5aXFxuIFlaXFxuWVxcblpYWCAnKTtcblx0XHRzdHIgPVxuXHRcdFx0c3RyLnN1YnN0cmluZygwLCAwKSArXG5cdFx0XHQnIFpYIFxcbiBaXFxuWlxcbiBZWlxcbllcXG5aWFggJyArXG5cdFx0XHRzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDE0LCAnWCBaWlxcbllaWllaWFhZIFkgWFlcXG4gJyk7XG5cdFx0c3RyID1cblx0XHRcdHN0ci5zdWJzdHJpbmcoMCwgMTQpICsgJ1ggWlpcXG5ZWlpZWlhYWSBZIFhZXFxuICcgKyBzdHIuc3Vic3RyaW5nKDE0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXHRcdHRlc3RMaW5lU3RhcnRzKHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCByYW5kb20gYnVnIDI6IHByZWZpeFN1bUNvbXB1dGVyIGluaXRpYWxpemUgZG9lcyBub3QgZG8gZGVlcCBjb3B5IG9mIFVJbnQzMkFycmF5LicsICgpID0+IHtcblx0XHRsZXQgc3RyID0gJyc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJyddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICdaWVpcXG5ZWSBYWVxcblggXFxuWiBZIFxcblogJyk7XG5cdFx0c3RyID1cblx0XHRcdHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnWllaXFxuWVkgWFlcXG5YIFxcblogWSBcXG5aICcgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDMsICdYWFkgXFxuXFxuWSBZIFlZWSAgWllYWSAnKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDMpICsgJ1hYWSBcXG5cXG5ZIFkgWVlZICBaWVhZICcgKyBzdHIuc3Vic3RyaW5nKDMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZXNSYXdDb250ZW50KCksIHN0cik7XG5cdFx0dGVzdExpbmVTdGFydHMoc3RyLCBwaWVjZVRhYmxlKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlIHJhbmRvbSBidWcgMTogSSBmb3Jnb3QgdG8gdXBkYXRlIHRoZSBsaW5lRmVlZENudCB3aGVuIGRlbGV0aW9uIGlzIG9uIG9uZSBzaW5nbGUgcGllY2UuJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWycnXSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnYmFcXG5hXFxuY2FcXG5iYVxcbmNiYWJcXG5jYWEgJyk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMTMsICdjY2FcXG5hYWJiXFxuY2FjXFxuY2NjXFxuYWIgJyk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNSwgOCk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMzAsIDIpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDI0LCAnY2JiYWNjY2JhY1xcbmJhYWFiXFxuXFxuYyAnKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgyOSwgMyk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMjMsIDkpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDIxLCA1KTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgzMCwgMyk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMywgJ2NiXFxuYWNcXG5jXFxuXFxuYWNjXFxuYmJcXG5iXFxuYyAnKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgxOSwgNSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMTgsICdcXG5iYlxcblxcbmFjYmNcXG5jYmJcXG5jXFxuYmJcXG4gJyk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNjUsICdjYmNjYmFjXFxuYmNcXG5cXG5jY2FiYmFcXG4gJyk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNzcsICdhXFxuY2FjYlxcblxcbmFjXFxuXFxuXFxuXFxuXFxuYWJhYiAnKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgzMCwgOSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNDUsICdiXFxuXFxuY1xcbmJhXFxuXFxuYmJiYmFcXG5cXG5hYVxcbiAnKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCg4MiwgJ2FiXFxuYmJcXG5jYWJhY2FiXFxuY2JjXFxuYSAnKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgxMjMsIDkpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDcxLCAyKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgzMywgJ2FjYWFcXG5hY2JcXG5cXG5hYVxcblxcbmNcXG5cXG5cXG5cXG4gJyk7XG5cblx0XHRjb25zdCBzdHIgPSBwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpO1xuXHRcdHRlc3RMaW5lU3RhcnRzKHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZSByYW5kb20gYnVnIHJiIHRyZWUgMScsICgpID0+IHtcblx0XHRsZXQgc3RyID0gJyc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbc3RyXSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnWVhYWlxcblxcbllZXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdZWFhaXFxuXFxuWVlcXG4nICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgwLCA1KTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgc3RyLnN1YnN0cmluZygwICsgNSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1pYWVlcXG5YXFxuWlxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnWlhZWVxcblhcXG5aXFxuJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMTAsICdcXG5YWVxcbllYWVhZJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxMCkgKyAnXFxuWFlcXG5ZWFlYWScgKyBzdHIuc3Vic3RyaW5nKDEwKTtcblx0XHR0ZXN0TGluZVN0YXJ0cyhzdHIsIHBpZWNlVGFibGUpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGUgcmFuZG9tIGJ1ZyByYiB0cmVlIDInLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICcnO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoW3N0cl0pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1lYWFpcXG5cXG5ZWVxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnWVhYWlxcblxcbllZXFxuJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1pYWVlcXG5YXFxuWlxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnWlhZWVxcblhcXG5aXFxuJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMTAsICdcXG5YWVxcbllYWVhZJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxMCkgKyAnXFxuWFlcXG5ZWFlYWScgKyBzdHIuc3Vic3RyaW5nKDEwKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCg4LCAnWVpYWVxcblpcXG5ZWCcpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgOCkgKyAnWVpYWVxcblpcXG5ZWCcgKyBzdHIuc3Vic3RyaW5nKDgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDEyLCAnWFhcXG5YWFlYWVonKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDEyKSArICdYWFxcblhYWVhZWicgKyBzdHIuc3Vic3RyaW5nKDEyKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgwLCA0KTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgc3RyLnN1YnN0cmluZygwICsgNCk7XG5cblx0XHR0ZXN0TGluZVN0YXJ0cyhzdHIsIHBpZWNlVGFibGUpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGUgcmFuZG9tIGJ1ZyByYiB0cmVlIDMnLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICcnO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoW3N0cl0pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1lYWFpcXG5cXG5ZWVxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnWVhYWlxcblxcbllZXFxuJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNywgMik7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA3KSArIHN0ci5zdWJzdHJpbmcoNyArIDIpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDYsIDEpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNikgKyBzdHIuc3Vic3RyaW5nKDYgKyAxKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgwLCA1KTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgc3RyLnN1YnN0cmluZygwICsgNSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1pYWVlcXG5YXFxuWlxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnWlhZWVxcblhcXG5aXFxuJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMTAsICdcXG5YWVxcbllYWVhZJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxMCkgKyAnXFxuWFlcXG5ZWFlYWScgKyBzdHIuc3Vic3RyaW5nKDEwKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCg4LCAnWVpYWVxcblpcXG5ZWCcpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgOCkgKyAnWVpYWVxcblpcXG5ZWCcgKyBzdHIuc3Vic3RyaW5nKDgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDEyLCAnWFhcXG5YWFlYWVonKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDEyKSArICdYWFxcblhYWVhZWicgKyBzdHIuc3Vic3RyaW5nKDEyKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgwLCA0KTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgc3RyLnN1YnN0cmluZygwICsgNCk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMzAsIDMpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMzApICsgc3RyLnN1YnN0cmluZygzMCArIDMpO1xuXG5cdFx0dGVzdExpbmVTdGFydHMoc3RyLCBwaWVjZVRhYmxlKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ29mZnNldCAyIHBvc2l0aW9uJywgKCkgPT4ge1xuXHRjb25zdCBkcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ3JhbmRvbSB0ZXN0cyBidWcgMScsICgpID0+IHtcblx0XHRsZXQgc3RyID0gJyc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJyddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICdodXV5WXpVZktPRU53R2daTHFuICcpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnaHV1eVl6VWZLT0VOd0dnWkxxbiAnICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgxOCwgMik7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxOCkgKyBzdHIuc3Vic3RyaW5nKDE4ICsgMik7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMywgMSk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAzKSArIHN0ci5zdWJzdHJpbmcoMyArIDEpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDEyLCA0KTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDEyKSArIHN0ci5zdWJzdHJpbmcoMTIgKyA0KTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgzLCAnaE1iblZFZFRTZGhMbFBldlhLRiAnKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDMpICsgJ2hNYm5WRWRUU2RoTGxQZXZYS0YgJyArIHN0ci5zdWJzdHJpbmcoMyk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMjIsIDgpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMjIpICsgc3RyLnN1YnN0cmluZygyMiArIDgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDQsICdTIHVtU25ZcnFPbU9BVlxcbkViWkogJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArICdTIHVtU25ZcnFPbU9BVlxcbkViWkogJyArIHN0ci5zdWJzdHJpbmcoNCk7XG5cblx0XHR0ZXN0TGluZVN0YXJ0cyhzdHIsIHBpZWNlVGFibGUpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnZ2V0IHRleHQgaW4gcmFuZ2UnLCAoKSA9PiB7XG5cdGNvbnN0IGRzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnZ2V0Q29udGVudEluUmFuZ2UnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJ2FcXG5iXFxuY1xcbmRlJ10pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoOCwgJ2ZoXFxuaVxcbmprJyk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNywgMik7XG5cdFx0Ly8gJ2FcXG5iXFxuY1xcbmRoXFxuaVxcbmprJ1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0VmFsdWVJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAxLCAzKSksICdhXFxuJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0VmFsdWVJblJhbmdlKG5ldyBSYW5nZSgyLCAxLCAyLCAzKSksICdiXFxuJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0VmFsdWVJblJhbmdlKG5ldyBSYW5nZSgzLCAxLCAzLCAzKSksICdjXFxuJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0VmFsdWVJblJhbmdlKG5ldyBSYW5nZSg0LCAxLCA0LCA0KSksICdkaFxcbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldFZhbHVlSW5SYW5nZShuZXcgUmFuZ2UoNSwgMSwgNSwgMykpLCAnaVxcbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldFZhbHVlSW5SYW5nZShuZXcgUmFuZ2UoNiwgMSwgNiwgMykpLCAnamsnKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgncmFuZG9tIHRlc3QgdmFsdWUgaW4gcmFuZ2UnLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICcnO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoW3N0cl0pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnWlhYWScpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnWlhYWScgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDEsICdYWlpZJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxKSArICdYWlpZJyArIHN0ci5zdWJzdHJpbmcoMSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNSwgJ1xcblhcXG5cXG4nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDUpICsgJ1xcblhcXG5cXG4nICsgc3RyLnN1YnN0cmluZyg1KTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgzLCAnXFxuWFhcXG4nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDMpICsgJ1xcblhYXFxuJyArIHN0ci5zdWJzdHJpbmcoMyk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMTIsICdZWVlYJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxMikgKyAnWVlZWCcgKyBzdHIuc3Vic3RyaW5nKDEyKTtcblxuXHRcdHRlc3RMaW5lc0NvbnRlbnQoc3RyLCBwaWVjZVRhYmxlKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cdHRlc3QoJ3JhbmRvbSB0ZXN0IHZhbHVlIGluIHJhbmdlIGV4Y2VwdGlvbicsICgpID0+IHtcblx0XHRsZXQgc3RyID0gJyc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbc3RyXSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblxuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICdYWlxcblonKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgJ1haXFxuWicgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDAsIDMpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyBzdHIuc3Vic3RyaW5nKDAgKyAzKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgwLCAxKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgc3RyLnN1YnN0cmluZygwICsgMSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1pZWFxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnWllYXFxuJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMCwgNCk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArIHN0ci5zdWJzdHJpbmcoMCArIDQpO1xuXG5cdFx0cGllY2VUYWJsZS5nZXRWYWx1ZUluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDEsIDEpKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgncmFuZG9tIHRlc3RzIGJ1ZyAxJywgKCkgPT4ge1xuXHRcdGxldCBzdHIgPSAnJztcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnJ10pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ2h1dXlZelVmS09FTndHZ1pMcW4gJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdodXV5WXpVZktPRU53R2daTHFuICcgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDE4LCAyKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDE4KSArIHN0ci5zdWJzdHJpbmcoMTggKyAyKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgzLCAxKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDMpICsgc3RyLnN1YnN0cmluZygzICsgMSk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMTIsIDQpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMTIpICsgc3RyLnN1YnN0cmluZygxMiArIDQpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDMsICdoTWJuVkVkVFNkaExsUGV2WEtGICcpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMykgKyAnaE1iblZFZFRTZGhMbFBldlhLRiAnICsgc3RyLnN1YnN0cmluZygzKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgyMiwgOCk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyMikgKyBzdHIuc3Vic3RyaW5nKDIyICsgOCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNCwgJ1MgdW1TbllycU9tT0FWXFxuRWJaSiAnKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDQpICsgJ1MgdW1TbllycU9tT0FWXFxuRWJaSiAnICsgc3RyLnN1YnN0cmluZyg0KTtcblx0XHR0ZXN0TGluZXNDb250ZW50KHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JhbmRvbSB0ZXN0cyBidWcgMicsICgpID0+IHtcblx0XHRsZXQgc3RyID0gJyc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJyddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICd4Zm91UkRad2RBSGpWWEpBTVZcXG4gJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICd4Zm91UkRad2RBSGpWWEpBTVZcXG4gJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMTYsICdkQkduZHhwRlpCRUFJS3lrWVl4ICcpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMTYpICsgJ2RCR25keHBGWkJFQUlLeWtZWXggJyArIHN0ci5zdWJzdHJpbmcoMTYpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDcsIDYpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNykgKyBzdHIuc3Vic3RyaW5nKDcgKyA2KTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg5LCA3KTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDkpICsgc3RyLnN1YnN0cmluZyg5ICsgNyk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMTcsIDYpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMTcpICsgc3RyLnN1YnN0cmluZygxNyArIDYpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDAsIDQpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyBzdHIuc3Vic3RyaW5nKDAgKyA0KTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCg5LCAncXZFRlhDTnZWa1dndnlrYWhZdCAnKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDkpICsgJ3F2RUZYQ052VmtXZ3Z5a2FoWXQgJyArIHN0ci5zdWJzdHJpbmcoOSk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNCwgNik7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArIHN0ci5zdWJzdHJpbmcoNCArIDYpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDExLCAnT2NTQ2hVWVRcXG56UEVCT3BzR21SICcpO1xuXHRcdHN0ciA9XG5cdFx0XHRzdHIuc3Vic3RyaW5nKDAsIDExKSArICdPY1NDaFVZVFxcbnpQRUJPcHNHbVIgJyArIHN0ci5zdWJzdHJpbmcoMTEpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDE1LCAnS0pDb3phWFR2a0VcXG54bnFBZVR6ICcpO1xuXHRcdHN0ciA9XG5cdFx0XHRzdHIuc3Vic3RyaW5nKDAsIDE1KSArICdLSkNvemFYVHZrRVxcbnhucUFlVHogJyArIHN0ci5zdWJzdHJpbmcoMTUpO1xuXG5cdFx0dGVzdExpbmVzQ29udGVudChzdHIsIHBpZWNlVGFibGUpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXQgbGluZSBjb250ZW50JywgKCkgPT4ge1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWycxJ10pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lUmF3Q29udGVudCgxKSwgJzEnKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgxLCAnMicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVSYXdDb250ZW50KDEpLCAnMTInKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0IGxpbmUgY29udGVudCBiYXNpYycsICgpID0+IHtcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnMVxcbjJcXG4zXFxuNCddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZVJhd0NvbnRlbnQoMSksICcxXFxuJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZVJhd0NvbnRlbnQoMiksICcyXFxuJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZVJhd0NvbnRlbnQoMyksICczXFxuJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZVJhd0NvbnRlbnQoNCksICc0Jyk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldCBsaW5lIGNvbnRlbnQgYWZ0ZXIgaW5zZXJ0cy9kZWxldGVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydhXFxuYlxcbmNcXG5kZSddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDgsICdmaFxcbmlcXG5qaycpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDcsIDIpO1xuXHRcdC8vICdhXFxuYlxcbmNcXG5kaFxcbmlcXG5qaydcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVSYXdDb250ZW50KDEpLCAnYVxcbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVSYXdDb250ZW50KDIpLCAnYlxcbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVSYXdDb250ZW50KDMpLCAnY1xcbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVSYXdDb250ZW50KDQpLCAnZGhcXG4nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lUmF3Q29udGVudCg1KSwgJ2lcXG4nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lUmF3Q29udGVudCg2KSwgJ2prJyk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JhbmRvbSAxJywgKCkgPT4ge1xuXHRcdGxldCBzdHIgPSAnJztcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnJ10pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnSiBlTm5EelFwbmxXeWptVXVcXG55ICcpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnSiBlTm5EelFwbmxXeWptVXVcXG55ICcgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICdRUEVlUkFRbVJ3bEpxdFpTV2hRICcpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnUVBFZVJBUW1Sd2xKcXRaU1doUSAnICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg1LCAxKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDUpICsgc3RyLnN1YnN0cmluZyg1ICsgMSk7XG5cblx0XHR0ZXN0TGluZXNDb250ZW50KHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JhbmRvbSAyJywgKCkgPT4ge1xuXHRcdGxldCBzdHIgPSAnJztcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnJ10pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ0Rab1EgdGdsUENSSE1sdGVqUkkgJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdEWm9RIHRnbFBDUkhNbHRlalJJICcgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDEwLCAnSlJYaXlZcUogcXFkY21iZmtLWCAnKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDEwKSArICdKUlhpeVlxSiBxcWRjbWJma0tYICcgKyBzdHIuc3Vic3RyaW5nKDEwKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgxNiwgMyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxNikgKyBzdHIuc3Vic3RyaW5nKDE2ICsgMyk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMjUsIDEpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMjUpICsgc3RyLnN1YnN0cmluZygyNSArIDEpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDE4LCAndkhcXG5ObHZmcVFKUG1cXG5TRmtoTWMgJyk7XG5cdFx0c3RyID1cblx0XHRcdHN0ci5zdWJzdHJpbmcoMCwgMTgpICsgJ3ZIXFxuTmx2ZnFRSlBtXFxuU0ZraE1jICcgKyBzdHIuc3Vic3RyaW5nKDE4KTtcblxuXHRcdHRlc3RMaW5lc0NvbnRlbnQoc3RyLCBwaWVjZVRhYmxlKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ0NSTEYnLCAoKSA9PiB7XG5cdGNvbnN0IGRzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnZGVsZXRlIENSIGluIENSTEYgMScsICgpID0+IHtcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnJ10sIGZhbHNlKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICdhXFxyXFxuYicpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDAsIDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZUNvdW50KCksIDIpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGUgQ1IgaW4gQ1JMRiAyJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWycnXSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ2FcXHJcXG5iJyk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMiwgMik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lQ291bnQoKSwgMik7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JhbmRvbSBidWcgMScsICgpID0+IHtcblx0XHRsZXQgc3RyID0gJyc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJyddLCBmYWxzZSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnXFxuXFxuXFxyXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdcXG5cXG5cXHJcXHInICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgxLCAnXFxyXFxuXFxyXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxKSArICdcXHJcXG5cXHJcXG4nICsgc3RyLnN1YnN0cmluZygxKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg1LCAzKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDUpICsgc3RyLnN1YnN0cmluZyg1ICsgMyk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMiwgMyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyKSArIHN0ci5zdWJzdHJpbmcoMiArIDMpO1xuXG5cdFx0Y29uc3QgbGluZXMgPSBzcGxpdExpbmVzKHN0cik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZUNvdW50KCksIGxpbmVzLmxlbmd0aCk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXHR0ZXN0KCdyYW5kb20gYnVnIDInLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICcnO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWycnXSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnXFxuXFxyXFxuXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdcXG5cXHJcXG5cXHInICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgyLCAnXFxuXFxyXFxyXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyKSArICdcXG5cXHJcXHJcXHInICsgc3RyLnN1YnN0cmluZygyKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg0LCAxKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDQpICsgc3RyLnN1YnN0cmluZyg0ICsgMSk7XG5cblx0XHRjb25zdCBsaW5lcyA9IHNwbGl0TGluZXMoc3RyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lQ291bnQoKSwgbGluZXMubGVuZ3RoKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cdHRlc3QoJ3JhbmRvbSBidWcgMycsICgpID0+IHtcblx0XHRsZXQgc3RyID0gJyc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJyddLCBmYWxzZSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblxuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICdcXG5cXG5cXG5cXHInKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgJ1xcblxcblxcblxccicgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDIsIDIpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMikgKyBzdHIuc3Vic3RyaW5nKDIgKyAyKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgwLCAyKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgc3RyLnN1YnN0cmluZygwICsgMik7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1xcclxcclxcclxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnXFxyXFxyXFxyXFxyJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMiwgJ1xcclxcblxcclxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMikgKyAnXFxyXFxuXFxyXFxyJyArIHN0ci5zdWJzdHJpbmcoMik7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMywgJ1xcclxcclxcclxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMykgKyAnXFxyXFxyXFxyXFxuJyArIHN0ci5zdWJzdHJpbmcoMyk7XG5cblx0XHRjb25zdCBsaW5lcyA9IHNwbGl0TGluZXMoc3RyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lQ291bnQoKSwgbGluZXMubGVuZ3RoKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cdHRlc3QoJ3JhbmRvbSBidWcgNCcsICgpID0+IHtcblx0XHRsZXQgc3RyID0gJyc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJyddLCBmYWxzZSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblxuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICdcXG5cXG5cXG5cXG4nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgJ1xcblxcblxcblxcbicgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDMsIDEpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMykgKyBzdHIuc3Vic3RyaW5nKDMgKyAxKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgxLCAnXFxyXFxyXFxyXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxKSArICdcXHJcXHJcXHJcXHInICsgc3RyLnN1YnN0cmluZygxKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCg2LCAnXFxyXFxuXFxuXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA2KSArICdcXHJcXG5cXG5cXHInICsgc3RyLnN1YnN0cmluZyg2KTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg1LCAzKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDUpICsgc3RyLnN1YnN0cmluZyg1ICsgMyk7XG5cblx0XHR0ZXN0TGluZXNDb250ZW50KHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXHR0ZXN0KCdyYW5kb20gYnVnIDUnLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICcnO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWycnXSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnXFxuXFxuXFxuXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdcXG5cXG5cXG5cXG4nICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgzLCAxKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDMpICsgc3RyLnN1YnN0cmluZygzICsgMSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1xcblxcclxcclxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnXFxuXFxyXFxyXFxuJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNCwgJ1xcblxcclxcclxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNCkgKyAnXFxuXFxyXFxyXFxuJyArIHN0ci5zdWJzdHJpbmcoNCk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNCwgMyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArIHN0ci5zdWJzdHJpbmcoNCArIDMpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDUsICdcXHJcXHJcXG5cXHInKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDUpICsgJ1xcclxcclxcblxccicgKyBzdHIuc3Vic3RyaW5nKDUpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDEyLCAnXFxuXFxuXFxuXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxMikgKyAnXFxuXFxuXFxuXFxyJyArIHN0ci5zdWJzdHJpbmcoMTIpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDUsICdcXHJcXHJcXHJcXG4nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDUpICsgJ1xcclxcclxcclxcbicgKyBzdHIuc3Vic3RyaW5nKDUpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDIwLCAnXFxuXFxuXFxyXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyMCkgKyAnXFxuXFxuXFxyXFxuJyArIHN0ci5zdWJzdHJpbmcoMjApO1xuXG5cdFx0dGVzdExpbmVzQ29udGVudChzdHIsIHBpZWNlVGFibGUpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblx0dGVzdCgncmFuZG9tIGJ1ZyA2JywgKCkgPT4ge1xuXHRcdGxldCBzdHIgPSAnJztcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnJ10sIGZhbHNlKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1xcblxcclxcclxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnXFxuXFxyXFxyXFxuJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNCwgJ1xcclxcblxcblxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNCkgKyAnXFxyXFxuXFxuXFxyJyArIHN0ci5zdWJzdHJpbmcoNCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMywgJ1xcclxcblxcblxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMykgKyAnXFxyXFxuXFxuXFxuJyArIHN0ci5zdWJzdHJpbmcoMyk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNCwgOCk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArIHN0ci5zdWJzdHJpbmcoNCArIDgpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDQsICdcXHJcXG5cXG5cXHInKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDQpICsgJ1xcclxcblxcblxccicgKyBzdHIuc3Vic3RyaW5nKDQpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICdcXHJcXG5cXG5cXHInKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgJ1xcclxcblxcblxccicgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDQsIDApO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNCkgKyBzdHIuc3Vic3RyaW5nKDQgKyAwKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg4LCA0KTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDgpICsgc3RyLnN1YnN0cmluZyg4ICsgNCk7XG5cblx0XHR0ZXN0TGluZXNDb250ZW50KHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXHR0ZXN0KCdyYW5kb20gYnVnIDgnLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICcnO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWycnXSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnXFxyXFxuXFxuXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdcXHJcXG5cXG5cXHInICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgxLCAwKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDEpICsgc3RyLnN1YnN0cmluZygxICsgMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMywgJ1xcblxcblxcblxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMykgKyAnXFxuXFxuXFxuXFxyJyArIHN0ci5zdWJzdHJpbmcoMyk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNywgJ1xcblxcblxcclxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNykgKyAnXFxuXFxuXFxyXFxuJyArIHN0ci5zdWJzdHJpbmcoNyk7XG5cblx0XHR0ZXN0TGluZXNDb250ZW50KHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXHR0ZXN0KCdyYW5kb20gYnVnIDcnLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICcnO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWycnXSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnXFxyXFxyXFxuXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdcXHJcXHJcXG5cXG4nICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCg0LCAnXFxyXFxuXFxuXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArICdcXHJcXG5cXG5cXHInICsgc3RyLnN1YnN0cmluZyg0KTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCg3LCAnXFxuXFxyXFxyXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA3KSArICdcXG5cXHJcXHJcXHInICsgc3RyLnN1YnN0cmluZyg3KTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgxMSwgJ1xcblxcblxcclxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMTEpICsgJ1xcblxcblxcclxcbicgKyBzdHIuc3Vic3RyaW5nKDExKTtcblx0XHR0ZXN0TGluZXNDb250ZW50KHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JhbmRvbSBidWcgMTAnLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICcnO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWycnXSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAncW5lVycpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAncW5lVycgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDAsICdZaElsJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdZaElsJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ3Fkc20nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgJ3Fkc20nICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg3LCAwKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDcpICsgc3RyLnN1YnN0cmluZyg3ICsgMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMTIsICdpaVB2Jyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxMikgKyAnaWlQdicgKyBzdHIuc3Vic3RyaW5nKDEyKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCg5LCAnVlxcclNBJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA5KSArICdWXFxyU0EnICsgc3RyLnN1YnN0cmluZyg5KTtcblxuXHRcdHRlc3RMaW5lc0NvbnRlbnQoc3RyLCBwaWVjZVRhYmxlKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgncmFuZG9tIGJ1ZyA5JywgKCkgPT4ge1xuXHRcdGxldCBzdHIgPSAnJztcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnJ10sIGZhbHNlKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1xcblxcblxcblxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnXFxuXFxuXFxuXFxuJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMywgJ1xcblxcclxcblxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMykgKyAnXFxuXFxyXFxuXFxyJyArIHN0ci5zdWJzdHJpbmcoMyk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMiwgJ1xcblxcclxcblxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMikgKyAnXFxuXFxyXFxuXFxuJyArIHN0ci5zdWJzdHJpbmcoMik7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1xcblxcblxcclxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnXFxuXFxuXFxyXFxyJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMywgJ1xcclxcclxcclxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMykgKyAnXFxyXFxyXFxyXFxyJyArIHN0ci5zdWJzdHJpbmcoMyk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMywgJ1xcblxcblxcclxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMykgKyAnXFxuXFxuXFxyXFxyJyArIHN0ci5zdWJzdHJpbmcoMyk7XG5cblx0XHR0ZXN0TGluZXNDb250ZW50KHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdjZW50cmFsaXplZCBsaW5lU3RhcnRzIHdpdGggQ1JMRicsICgpID0+IHtcblx0Y29uc3QgZHMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdkZWxldGUgQ1IgaW4gQ1JMRiAxJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydhXFxyXFxuYiddLCBmYWxzZSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgyLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lQ291bnQoKSwgMik7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXHR0ZXN0KCdkZWxldGUgQ1IgaW4gQ1JMRiAyJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydhXFxyXFxuYiddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDAsIDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZUNvdW50KCksIDIpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyYW5kb20gYnVnIDEnLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICdcXG5cXG5cXHJcXHInO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydcXG5cXG5cXHJcXHInXSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgxLCAnXFxyXFxuXFxyXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxKSArICdcXHJcXG5cXHJcXG4nICsgc3RyLnN1YnN0cmluZygxKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg1LCAzKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDUpICsgc3RyLnN1YnN0cmluZyg1ICsgMyk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMiwgMyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyKSArIHN0ci5zdWJzdHJpbmcoMiArIDMpO1xuXG5cdFx0Y29uc3QgbGluZXMgPSBzcGxpdExpbmVzKHN0cik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZUNvdW50KCksIGxpbmVzLmxlbmd0aCk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXHR0ZXN0KCdyYW5kb20gYnVnIDInLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICdcXG5cXHJcXG5cXHInO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydcXG5cXHJcXG5cXHInXSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgyLCAnXFxuXFxyXFxyXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyKSArICdcXG5cXHJcXHJcXHInICsgc3RyLnN1YnN0cmluZygyKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg0LCAxKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDQpICsgc3RyLnN1YnN0cmluZyg0ICsgMSk7XG5cblx0XHRjb25zdCBsaW5lcyA9IHNwbGl0TGluZXMoc3RyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lQ291bnQoKSwgbGluZXMubGVuZ3RoKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgncmFuZG9tIGJ1ZyAzJywgKCkgPT4ge1xuXHRcdGxldCBzdHIgPSAnXFxuXFxuXFxuXFxyJztcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnXFxuXFxuXFxuXFxyJ10sIGZhbHNlKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMiwgMik7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyKSArIHN0ci5zdWJzdHJpbmcoMiArIDIpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDAsIDIpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyBzdHIuc3Vic3RyaW5nKDAgKyAyKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnXFxyXFxyXFxyXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAwKSArICdcXHJcXHJcXHJcXHInICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgyLCAnXFxyXFxuXFxyXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyKSArICdcXHJcXG5cXHJcXHInICsgc3RyLnN1YnN0cmluZygyKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgzLCAnXFxyXFxyXFxyXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAzKSArICdcXHJcXHJcXHJcXG4nICsgc3RyLnN1YnN0cmluZygzKTtcblxuXHRcdGNvbnN0IGxpbmVzID0gc3BsaXRMaW5lcyhzdHIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVDb3VudCgpLCBsaW5lcy5sZW5ndGgpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyYW5kb20gYnVnIDQnLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICdcXG5cXG5cXG5cXG4nO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydcXG5cXG5cXG5cXG4nXSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgzLCAxKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDMpICsgc3RyLnN1YnN0cmluZygzICsgMSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMSwgJ1xcclxcclxcclxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMSkgKyAnXFxyXFxyXFxyXFxyJyArIHN0ci5zdWJzdHJpbmcoMSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNiwgJ1xcclxcblxcblxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNikgKyAnXFxyXFxuXFxuXFxyJyArIHN0ci5zdWJzdHJpbmcoNik7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNSwgMyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA1KSArIHN0ci5zdWJzdHJpbmcoNSArIDMpO1xuXG5cdFx0dGVzdExpbmVzQ29udGVudChzdHIsIHBpZWNlVGFibGUpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyYW5kb20gYnVnIDUnLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICdcXG5cXG5cXG5cXG4nO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydcXG5cXG5cXG5cXG4nXSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgzLCAxKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDMpICsgc3RyLnN1YnN0cmluZygzICsgMSk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1xcblxcclxcclxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnXFxuXFxyXFxyXFxuJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNCwgJ1xcblxcclxcclxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNCkgKyAnXFxuXFxyXFxyXFxuJyArIHN0ci5zdWJzdHJpbmcoNCk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNCwgMyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArIHN0ci5zdWJzdHJpbmcoNCArIDMpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDUsICdcXHJcXHJcXG5cXHInKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDUpICsgJ1xcclxcclxcblxccicgKyBzdHIuc3Vic3RyaW5nKDUpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDEyLCAnXFxuXFxuXFxuXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxMikgKyAnXFxuXFxuXFxuXFxyJyArIHN0ci5zdWJzdHJpbmcoMTIpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDUsICdcXHJcXHJcXHJcXG4nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDUpICsgJ1xcclxcclxcclxcbicgKyBzdHIuc3Vic3RyaW5nKDUpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDIwLCAnXFxuXFxuXFxyXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyMCkgKyAnXFxuXFxuXFxyXFxuJyArIHN0ci5zdWJzdHJpbmcoMjApO1xuXG5cdFx0dGVzdExpbmVzQ29udGVudChzdHIsIHBpZWNlVGFibGUpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyYW5kb20gYnVnIDYnLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICdcXG5cXHJcXHJcXG4nO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydcXG5cXHJcXHJcXG4nXSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCg0LCAnXFxyXFxuXFxuXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArICdcXHJcXG5cXG5cXHInICsgc3RyLnN1YnN0cmluZyg0KTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgzLCAnXFxyXFxuXFxuXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAzKSArICdcXHJcXG5cXG5cXG4nICsgc3RyLnN1YnN0cmluZygzKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg0LCA4KTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDQpICsgc3RyLnN1YnN0cmluZyg0ICsgOCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNCwgJ1xcclxcblxcblxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNCkgKyAnXFxyXFxuXFxuXFxyJyArIHN0ci5zdWJzdHJpbmcoNCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1xcclxcblxcblxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnXFxyXFxuXFxuXFxyJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNCwgMCk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArIHN0ci5zdWJzdHJpbmcoNCArIDApO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDgsIDQpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgOCkgKyBzdHIuc3Vic3RyaW5nKDggKyA0KTtcblxuXHRcdHRlc3RMaW5lc0NvbnRlbnQoc3RyLCBwaWVjZVRhYmxlKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgncmFuZG9tIGJ1ZyA3JywgKCkgPT4ge1xuXHRcdGxldCBzdHIgPSAnXFxyXFxuXFxuXFxyJztcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnXFxyXFxuXFxuXFxyJ10sIGZhbHNlKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMSwgMCk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxKSArIHN0ci5zdWJzdHJpbmcoMSArIDApO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDMsICdcXG5cXG5cXG5cXHInKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDMpICsgJ1xcblxcblxcblxccicgKyBzdHIuc3Vic3RyaW5nKDMpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDcsICdcXG5cXG5cXHJcXG4nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDcpICsgJ1xcblxcblxcclxcbicgKyBzdHIuc3Vic3RyaW5nKDcpO1xuXG5cdFx0dGVzdExpbmVzQ29udGVudChzdHIsIHBpZWNlVGFibGUpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyYW5kb20gYnVnIDgnLCAoKSA9PiB7XG5cdFx0bGV0IHN0ciA9ICdcXHJcXHJcXG5cXG4nO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydcXHJcXHJcXG5cXG4nXSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCg0LCAnXFxyXFxuXFxuXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArICdcXHJcXG5cXG5cXHInICsgc3RyLnN1YnN0cmluZyg0KTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCg3LCAnXFxuXFxyXFxyXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA3KSArICdcXG5cXHJcXHJcXHInICsgc3RyLnN1YnN0cmluZyg3KTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgxMSwgJ1xcblxcblxcclxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMTEpICsgJ1xcblxcblxcclxcbicgKyBzdHIuc3Vic3RyaW5nKDExKTtcblx0XHR0ZXN0TGluZXNDb250ZW50KHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JhbmRvbSBidWcgOScsICgpID0+IHtcblx0XHRsZXQgc3RyID0gJ3FuZVcnO1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydxbmVXJ10sIGZhbHNlKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1loSWwnKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgJ1loSWwnICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAncWRzbScpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAncWRzbScgKyBzdHIuc3Vic3RyaW5nKDApO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDcsIDApO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNykgKyBzdHIuc3Vic3RyaW5nKDcgKyAwKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgxMiwgJ2lpUHYnKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDEyKSArICdpaVB2JyArIHN0ci5zdWJzdHJpbmcoMTIpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDksICdWXFxyU0EnKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDkpICsgJ1ZcXHJTQScgKyBzdHIuc3Vic3RyaW5nKDkpO1xuXG5cdFx0dGVzdExpbmVzQ29udGVudChzdHIsIHBpZWNlVGFibGUpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyYW5kb20gYnVnIDEwJywgKCkgPT4ge1xuXHRcdGxldCBzdHIgPSAnXFxuXFxuXFxuXFxuJztcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnXFxuXFxuXFxuXFxuJ10sIGZhbHNlKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMywgJ1xcblxcclxcblxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMykgKyAnXFxuXFxyXFxuXFxyJyArIHN0ci5zdWJzdHJpbmcoMyk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMiwgJ1xcblxcclxcblxcbicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMikgKyAnXFxuXFxyXFxuXFxuJyArIHN0ci5zdWJzdHJpbmcoMik7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1xcblxcblxcclxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyAnXFxuXFxuXFxyXFxyJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMywgJ1xcclxcclxcclxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMykgKyAnXFxyXFxyXFxyXFxyJyArIHN0ci5zdWJzdHJpbmcoMyk7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMywgJ1xcblxcblxcclxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMykgKyAnXFxuXFxuXFxyXFxyJyArIHN0ci5zdWJzdHJpbmcoMyk7XG5cblx0XHR0ZXN0TGluZXNDb250ZW50KHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JhbmRvbSBjaHVuayBidWcgMScsICgpID0+IHtcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnXFxuXFxyXFxyXFxuXFxuXFxuXFxyXFxuXFxyJ10sIGZhbHNlKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXG5cdFx0bGV0IHN0ciA9ICdcXG5cXHJcXHJcXG5cXG5cXG5cXHJcXG5cXHInO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDAsIDIpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMCkgKyBzdHIuc3Vic3RyaW5nKDAgKyAyKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgxLCAnXFxyXFxyXFxuXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxKSArICdcXHJcXHJcXG5cXG4nICsgc3RyLnN1YnN0cmluZygxKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCg3LCAnXFxyXFxyXFxyXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA3KSArICdcXHJcXHJcXHJcXHInICsgc3RyLnN1YnN0cmluZyg3KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXHRcdHRlc3RMaW5lU3RhcnRzKHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JhbmRvbSBjaHVuayBidWcgMicsICgpID0+IHtcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFtcblx0XHRcdCdcXG5cXHJcXG5cXG5cXG5cXHJcXG5cXHJcXG5cXHJcXHJcXG5cXG5cXG5cXHJcXHJcXG5cXHJcXG4nXG5cdFx0XSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0bGV0IHN0ciA9ICdcXG5cXHJcXG5cXG5cXG5cXHJcXG5cXHJcXG5cXHJcXHJcXG5cXG5cXG5cXHJcXHJcXG5cXHJcXG4nO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDE2LCAnXFxyXFxuXFxyXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxNikgKyAnXFxyXFxuXFxyXFxyJyArIHN0ci5zdWJzdHJpbmcoMTYpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDEzLCAnXFxuXFxuXFxyXFxyJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxMykgKyAnXFxuXFxuXFxyXFxyJyArIHN0ci5zdWJzdHJpbmcoMTMpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDE5LCAnXFxuXFxuXFxyXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxOSkgKyAnXFxuXFxuXFxyXFxuJyArIHN0ci5zdWJzdHJpbmcoMTkpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDUsIDApO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNSkgKyBzdHIuc3Vic3RyaW5nKDUgKyAwKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgxMSwgMik7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxMSkgKyBzdHIuc3Vic3RyaW5nKDExICsgMik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lc1Jhd0NvbnRlbnQoKSwgc3RyKTtcblx0XHR0ZXN0TGluZVN0YXJ0cyhzdHIsIHBpZWNlVGFibGUpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyYW5kb20gY2h1bmsgYnVnIDMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJ1xcclxcblxcblxcblxcblxcblxcblxcclxcbiddLCBmYWxzZSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblx0XHRsZXQgc3RyID0gJ1xcclxcblxcblxcblxcblxcblxcblxcclxcbic7XG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNCwgJ1xcblxcblxcclxcblxcclxcclxcblxcblxccicpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgNCkgKyAnXFxuXFxuXFxyXFxuXFxyXFxyXFxuXFxuXFxyJyArIHN0ci5zdWJzdHJpbmcoNCk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoNCwgNCk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArIHN0ci5zdWJzdHJpbmcoNCArIDQpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDExLCAnXFxyXFxuXFxyXFxuXFxuXFxyXFxyXFxuXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxMSkgKyAnXFxyXFxuXFxyXFxuXFxuXFxyXFxyXFxuXFxuJyArIHN0ci5zdWJzdHJpbmcoMTEpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDEsIDIpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMSkgKyBzdHIuc3Vic3RyaW5nKDEgKyAyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXHRcdHRlc3RMaW5lU3RhcnRzKHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JhbmRvbSBjaHVuayBidWcgNCcsICgpID0+IHtcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnXFxuXFxyXFxuXFxyJ10sIGZhbHNlKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdGxldCBzdHIgPSAnXFxuXFxyXFxuXFxyJztcblx0XHRwaWVjZVRhYmxlLmluc2VydCg0LCAnXFxuXFxuXFxyXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA0KSArICdcXG5cXG5cXHJcXG4nICsgc3RyLnN1YnN0cmluZyg0KTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgzLCAnXFxyXFxuXFxuXFxuJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAzKSArICdcXHJcXG5cXG5cXG4nICsgc3RyLnN1YnN0cmluZygzKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXHRcdHRlc3RMaW5lU3RhcnRzKHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdyYW5kb20gaXMgdW5zdXBlcnZpc2VkJywgKCkgPT4ge1xuXHRjb25zdCBkcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ3NwbGl0dGluZyBsYXJnZSBjaGFuZ2UgYnVmZmVyJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWycnXSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0bGV0IHN0ciA9ICcnO1xuXG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMCwgJ1dVWlxcblhWWllcXG4nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgJ1dVWlxcblhWWllcXG4nICsgc3RyLnN1YnN0cmluZygwKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCg4LCAnXFxyXFxyXFxuWlhVV1ZXJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA4KSArICdcXHJcXHJcXG5aWFVXVlcnICsgc3RyLnN1YnN0cmluZyg4KTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgxMCwgNyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxMCkgKyBzdHIuc3Vic3RyaW5nKDEwICsgNyk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMTAsIDEpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMTApICsgc3RyLnN1YnN0cmluZygxMCArIDEpO1xuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDQsICdWWFxcclxcclxcbldaVlonKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDQpICsgJ1ZYXFxyXFxyXFxuV1pWWicgKyBzdHIuc3Vic3RyaW5nKDQpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDExLCAzKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDExKSArIHN0ci5zdWJzdHJpbmcoMTEgKyAzKTtcblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgxMiwgNCk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxMikgKyBzdHIuc3Vic3RyaW5nKDEyICsgNCk7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoOCwgMCk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCA4KSArIHN0ci5zdWJzdHJpbmcoOCArIDApO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDEwLCAyKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDEwKSArIHN0ci5zdWJzdHJpbmcoMTAgKyAyKTtcblx0XHRwaWVjZVRhYmxlLmluc2VydCgwLCAnVlpYWFpZWlhcXHInKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDApICsgJ1ZaWFhaWVpYXFxyJyArIHN0ci5zdWJzdHJpbmcoMCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lc1Jhd0NvbnRlbnQoKSwgc3RyKTtcblxuXHRcdHRlc3RMaW5lU3RhcnRzKHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0dGVzdExpbmVzQ29udGVudChzdHIsIHBpZWNlVGFibGUpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyYW5kb20gaW5zZXJ0IGRlbGV0ZScsIGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLnRpbWVvdXQoNTAwMDAwKTtcblx0XHRsZXQgc3RyID0gJyc7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbc3RyXSwgZmFsc2UpO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0Ly8gbGV0IG91dHB1dCA9ICcnO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgMTAwMDsgaSsrKSB7XG5cdFx0XHRpZiAoTWF0aC5yYW5kb20oKSA8IDAuNikge1xuXHRcdFx0XHQvLyBpbnNlcnRcblx0XHRcdFx0Y29uc3QgdGV4dCA9IHJhbmRvbVN0cigxMDApO1xuXHRcdFx0XHRjb25zdCBwb3MgPSByYW5kb21JbnQoc3RyLmxlbmd0aCArIDEpO1xuXHRcdFx0XHRwaWVjZVRhYmxlLmluc2VydChwb3MsIHRleHQpO1xuXHRcdFx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIHBvcykgKyB0ZXh0ICsgc3RyLnN1YnN0cmluZyhwb3MpO1xuXHRcdFx0XHQvLyBvdXRwdXQgKz0gYHBpZWNlVGFibGUuaW5zZXJ0KCR7cG9zfSwgJyR7dGV4dC5yZXBsYWNlKC9cXG4vZywgJ1xcXFxuJykucmVwbGFjZSgvXFxyL2csICdcXFxccicpfScpO1xcbmA7XG5cdFx0XHRcdC8vIG91dHB1dCArPSBgc3RyID0gc3RyLnN1YnN0cmluZygwLCAke3Bvc30pICsgJyR7dGV4dC5yZXBsYWNlKC9cXG4vZywgJ1xcXFxuJykucmVwbGFjZSgvXFxyL2csICdcXFxccicpfScgKyBzdHIuc3Vic3RyaW5nKCR7cG9zfSk7XFxuYDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIGRlbGV0ZVxuXHRcdFx0XHRjb25zdCBwb3MgPSByYW5kb21JbnQoc3RyLmxlbmd0aCk7XG5cdFx0XHRcdGNvbnN0IGxlbmd0aCA9IE1hdGgubWluKFxuXHRcdFx0XHRcdHN0ci5sZW5ndGggLSBwb3MsXG5cdFx0XHRcdFx0TWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTApXG5cdFx0XHRcdCk7XG5cdFx0XHRcdHBpZWNlVGFibGUuZGVsZXRlKHBvcywgbGVuZ3RoKTtcblx0XHRcdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCBwb3MpICsgc3RyLnN1YnN0cmluZyhwb3MgKyBsZW5ndGgpO1xuXHRcdFx0XHQvLyBvdXRwdXQgKz0gYHBpZWNlVGFibGUuZGVsZXRlKCR7cG9zfSwgJHtsZW5ndGh9KTtcXG5gO1xuXHRcdFx0XHQvLyBvdXRwdXQgKz0gYHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgJHtwb3N9KSArIHN0ci5zdWJzdHJpbmcoJHtwb3N9ICsgJHtsZW5ndGh9KTtcXG5gXG5cblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gY29uc29sZS5sb2cob3V0cHV0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXG5cdFx0dGVzdExpbmVTdGFydHMoc3RyLCBwaWVjZVRhYmxlKTtcblx0XHR0ZXN0TGluZXNDb250ZW50KHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JhbmRvbSBjaHVua3MnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy50aW1lb3V0KDUwMDAwMCk7XG5cdFx0Y29uc3QgY2h1bmtzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgNTsgaSsrKSB7XG5cdFx0XHRjaHVua3MucHVzaChyYW5kb21TdHIoMTAwMCkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoY2h1bmtzLCBmYWxzZSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblx0XHRsZXQgc3RyID0gY2h1bmtzLmpvaW4oJycpO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxMDAwOyBpKyspIHtcblx0XHRcdGlmIChNYXRoLnJhbmRvbSgpIDwgMC42KSB7XG5cdFx0XHRcdC8vIGluc2VydFxuXHRcdFx0XHRjb25zdCB0ZXh0ID0gcmFuZG9tU3RyKDEwMCk7XG5cdFx0XHRcdGNvbnN0IHBvcyA9IHJhbmRvbUludChzdHIubGVuZ3RoICsgMSk7XG5cdFx0XHRcdHBpZWNlVGFibGUuaW5zZXJ0KHBvcywgdGV4dCk7XG5cdFx0XHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgcG9zKSArIHRleHQgKyBzdHIuc3Vic3RyaW5nKHBvcyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBkZWxldGVcblx0XHRcdFx0Y29uc3QgcG9zID0gcmFuZG9tSW50KHN0ci5sZW5ndGgpO1xuXHRcdFx0XHRjb25zdCBsZW5ndGggPSBNYXRoLm1pbihcblx0XHRcdFx0XHRzdHIubGVuZ3RoIC0gcG9zLFxuXHRcdFx0XHRcdE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwKVxuXHRcdFx0XHQpO1xuXHRcdFx0XHRwaWVjZVRhYmxlLmRlbGV0ZShwb3MsIGxlbmd0aCk7XG5cdFx0XHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgcG9zKSArIHN0ci5zdWJzdHJpbmcocG9zICsgbGVuZ3RoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lc1Jhd0NvbnRlbnQoKSwgc3RyKTtcblx0XHR0ZXN0TGluZVN0YXJ0cyhzdHIsIHBpZWNlVGFibGUpO1xuXHRcdHRlc3RMaW5lc0NvbnRlbnQoc3RyLCBwaWVjZVRhYmxlKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgncmFuZG9tIGNodW5rcyAyJywgZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMudGltZW91dCg1MDAwMDApO1xuXHRcdGNvbnN0IGNodW5rczogc3RyaW5nW10gPSBbXTtcblx0XHRjaHVua3MucHVzaChyYW5kb21TdHIoMTAwMCkpO1xuXG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihjaHVua3MsIGZhbHNlKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdGxldCBzdHIgPSBjaHVua3Muam9pbignJyk7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDUwOyBpKyspIHtcblx0XHRcdGlmIChNYXRoLnJhbmRvbSgpIDwgMC42KSB7XG5cdFx0XHRcdC8vIGluc2VydFxuXHRcdFx0XHRjb25zdCB0ZXh0ID0gcmFuZG9tU3RyKDMwKTtcblx0XHRcdFx0Y29uc3QgcG9zID0gcmFuZG9tSW50KHN0ci5sZW5ndGggKyAxKTtcblx0XHRcdFx0cGllY2VUYWJsZS5pbnNlcnQocG9zLCB0ZXh0KTtcblx0XHRcdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCBwb3MpICsgdGV4dCArIHN0ci5zdWJzdHJpbmcocG9zKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIGRlbGV0ZVxuXHRcdFx0XHRjb25zdCBwb3MgPSByYW5kb21JbnQoc3RyLmxlbmd0aCk7XG5cdFx0XHRcdGNvbnN0IGxlbmd0aCA9IE1hdGgubWluKFxuXHRcdFx0XHRcdHN0ci5sZW5ndGggLSBwb3MsXG5cdFx0XHRcdFx0TWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTApXG5cdFx0XHRcdCk7XG5cdFx0XHRcdHBpZWNlVGFibGUuZGVsZXRlKHBvcywgbGVuZ3RoKTtcblx0XHRcdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCBwb3MpICsgc3RyLnN1YnN0cmluZyhwb3MgKyBsZW5ndGgpO1xuXHRcdFx0fVxuXHRcdFx0dGVzdExpbmVzQ29udGVudChzdHIsIHBpZWNlVGFibGUpO1xuXHRcdH1cblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpLCBzdHIpO1xuXHRcdHRlc3RMaW5lU3RhcnRzKHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0dGVzdExpbmVzQ29udGVudChzdHIsIHBpZWNlVGFibGUpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnYnVmZmVyIGFwaScsICgpID0+IHtcblx0Y29uc3QgZHMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdlcXVhbCcsICgpID0+IHtcblx0XHRjb25zdCBhID0gY3JlYXRlVGV4dEJ1ZmZlcihbJ2FiYyddKTtcblx0XHRjb25zdCBiID0gY3JlYXRlVGV4dEJ1ZmZlcihbJ2FiJywgJ2MnXSk7XG5cdFx0Y29uc3QgYyA9IGNyZWF0ZVRleHRCdWZmZXIoWydhYmQnXSk7XG5cdFx0Y29uc3QgZCA9IGNyZWF0ZVRleHRCdWZmZXIoWydhYmNkJ10pO1xuXHRcdGRzLmFkZChhKTtcblx0XHRkcy5hZGQoYik7XG5cdFx0ZHMuYWRkKGMpO1xuXHRcdGRzLmFkZChkKTtcblxuXHRcdGFzc2VydChhLmdldFBpZWNlVHJlZSgpLmVxdWFsKGIuZ2V0UGllY2VUcmVlKCkpKTtcblx0XHRhc3NlcnQoIWEuZ2V0UGllY2VUcmVlKCkuZXF1YWwoYy5nZXRQaWVjZVRyZWUoKSkpO1xuXHRcdGFzc2VydCghYS5nZXRQaWVjZVRyZWUoKS5lcXVhbChkLmdldFBpZWNlVHJlZSgpKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VxdWFsIHdpdGggbW9yZSBjaHVua3MnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYSA9IGNyZWF0ZVRleHRCdWZmZXIoWydhYicsICdjZCcsICdlJ10pO1xuXHRcdGNvbnN0IGIgPSBjcmVhdGVUZXh0QnVmZmVyKFsnYWInLCAnYycsICdkZSddKTtcblx0XHRkcy5hZGQoYSk7XG5cdFx0ZHMuYWRkKGIpO1xuXHRcdGFzc2VydChhLmdldFBpZWNlVHJlZSgpLmVxdWFsKGIuZ2V0UGllY2VUcmVlKCkpKTtcblx0fSk7XG5cblx0dGVzdCgnZXF1YWwgMiwgZW1wdHkgYnVmZmVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IGEgPSBjcmVhdGVUZXh0QnVmZmVyKFsnJ10pO1xuXHRcdGNvbnN0IGIgPSBjcmVhdGVUZXh0QnVmZmVyKFsnJ10pO1xuXHRcdGRzLmFkZChhKTtcblx0XHRkcy5hZGQoYik7XG5cblx0XHRhc3NlcnQoYS5nZXRQaWVjZVRyZWUoKS5lcXVhbChiLmdldFBpZWNlVHJlZSgpKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VxdWFsIDMsIGVtcHR5IGJ1ZmZlcicsICgpID0+IHtcblx0XHRjb25zdCBhID0gY3JlYXRlVGV4dEJ1ZmZlcihbJ2EnXSk7XG5cdFx0Y29uc3QgYiA9IGNyZWF0ZVRleHRCdWZmZXIoWycnXSk7XG5cdFx0ZHMuYWRkKGEpO1xuXHRcdGRzLmFkZChiKTtcblxuXHRcdGFzc2VydCghYS5nZXRQaWVjZVRyZWUoKS5lcXVhbChiLmdldFBpZWNlVHJlZSgpKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldExpbmVDaGFyQ29kZSAtIGlzc3VlICM0NTczNScsICgpID0+IHtcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnTElORTFcXG5saW5lMiddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVDaGFyQ29kZSgxLCAwKSwgJ0wnLmNoYXJDb2RlQXQoMCksICdMJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZUNoYXJDb2RlKDEsIDEpLCAnSScuY2hhckNvZGVBdCgwKSwgJ0knKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lQ2hhckNvZGUoMSwgMiksICdOJy5jaGFyQ29kZUF0KDApLCAnTicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVDaGFyQ29kZSgxLCAzKSwgJ0UnLmNoYXJDb2RlQXQoMCksICdFJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZUNoYXJDb2RlKDEsIDQpLCAnMScuY2hhckNvZGVBdCgwKSwgJzEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lQ2hhckNvZGUoMSwgNSksICdcXG4nLmNoYXJDb2RlQXQoMCksICdcXFxcbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVDaGFyQ29kZSgyLCAwKSwgJ2wnLmNoYXJDb2RlQXQoMCksICdsJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZUNoYXJDb2RlKDIsIDEpLCAnaScuY2hhckNvZGVBdCgwKSwgJ2knKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lQ2hhckNvZGUoMiwgMiksICduJy5jaGFyQ29kZUF0KDApLCAnbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVDaGFyQ29kZSgyLCAzKSwgJ2UnLmNoYXJDb2RlQXQoMCksICdlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZUNoYXJDb2RlKDIsIDQpLCAnMicuY2hhckNvZGVBdCgwKSwgJzInKTtcblx0fSk7XG5cblxuXHR0ZXN0KCdnZXRMaW5lQ2hhckNvZGUgLSBpc3N1ZSAjNDc3MzMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJycsICdMSU5FMVxcbicsICdsaW5lMiddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVDaGFyQ29kZSgxLCAwKSwgJ0wnLmNoYXJDb2RlQXQoMCksICdMJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZUNoYXJDb2RlKDEsIDEpLCAnSScuY2hhckNvZGVBdCgwKSwgJ0knKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lQ2hhckNvZGUoMSwgMiksICdOJy5jaGFyQ29kZUF0KDApLCAnTicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVDaGFyQ29kZSgxLCAzKSwgJ0UnLmNoYXJDb2RlQXQoMCksICdFJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZUNoYXJDb2RlKDEsIDQpLCAnMScuY2hhckNvZGVBdCgwKSwgJzEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lQ2hhckNvZGUoMSwgNSksICdcXG4nLmNoYXJDb2RlQXQoMCksICdcXFxcbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVDaGFyQ29kZSgyLCAwKSwgJ2wnLmNoYXJDb2RlQXQoMCksICdsJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZUNoYXJDb2RlKDIsIDEpLCAnaScuY2hhckNvZGVBdCgwKSwgJ2knKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGllY2VUYWJsZS5nZXRMaW5lQ2hhckNvZGUoMiwgMiksICduJy5jaGFyQ29kZUF0KDApLCAnbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaWVjZVRhYmxlLmdldExpbmVDaGFyQ29kZSgyLCAzKSwgJ2UnLmNoYXJDb2RlQXQoMCksICdlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBpZWNlVGFibGUuZ2V0TGluZUNoYXJDb2RlKDIsIDQpLCAnMicuY2hhckNvZGVBdCgwKSwgJzInKTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0TmVhcmVzdENodW5rJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWycwMTIzNDU2NzgnXSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcHQgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwdC5pbnNlcnQoMywgJ0FCQycpO1xuXHRcdGFzc2VydC5lcXVhbChwdC5nZXRMaW5lQ29udGVudCgxKSwgJzAxMkFCQzM0NTY3OCcpO1xuXHRcdGFzc2VydC5lcXVhbChwdC5nZXROZWFyZXN0Q2h1bmsoMyksICdBQkMnKTtcblx0XHRhc3NlcnQuZXF1YWwocHQuZ2V0TmVhcmVzdENodW5rKDYpLCAnMzQ1Njc4Jyk7XG5cblx0XHRwdC5kZWxldGUoOSwgMSk7XG5cdFx0YXNzZXJ0LmVxdWFsKHB0LmdldExpbmVDb250ZW50KDEpLCAnMDEyQUJDMzQ1NzgnKTtcblx0XHRhc3NlcnQuZXF1YWwocHQuZ2V0TmVhcmVzdENodW5rKDYpLCAnMzQ1Jyk7XG5cdFx0YXNzZXJ0LmVxdWFsKHB0LmdldE5lYXJlc3RDaHVuayg5KSwgJzc4Jyk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdzZWFyY2ggb2Zmc2V0IGNhY2hlJywgKCkgPT4ge1xuXHRjb25zdCBkcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ3JlbmRlciB3aGl0ZSBzcGFjZSBleGNlcHRpb24nLCAoKSA9PiB7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJ2NsYXNzIE5hbWV7XFxuXFx0XFxuXFx0XFx0XFx0Z2V0KCkge1xcblxcblxcdFxcdFxcdH1cXG5cXHRcXHR9J10pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0bGV0IHN0ciA9ICdjbGFzcyBOYW1le1xcblxcdFxcblxcdFxcdFxcdGdldCgpIHtcXG5cXG5cXHRcXHRcXHR9XFxuXFx0XFx0fSc7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgxMiwgJ3MnKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDEyKSArICdzJyArIHN0ci5zdWJzdHJpbmcoMTIpO1xuXG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMTMsICdlJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxMykgKyAnZScgKyBzdHIuc3Vic3RyaW5nKDEzKTtcblxuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDE0LCAndCcpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMTQpICsgJ3QnICsgc3RyLnN1YnN0cmluZygxNCk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgxNSwgJygpJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxNSkgKyAnKCknICsgc3RyLnN1YnN0cmluZygxNSk7XG5cblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgxNiwgMSk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxNikgKyBzdHIuc3Vic3RyaW5nKDE2ICsgMSk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgxNywgJygpJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxNykgKyAnKCknICsgc3RyLnN1YnN0cmluZygxNyk7XG5cblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgxOCwgMSk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxOCkgKyBzdHIuc3Vic3RyaW5nKDE4ICsgMSk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgxOCwgJ30nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDE4KSArICd9JyArIHN0ci5zdWJzdHJpbmcoMTgpO1xuXG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMTIsICdcXG4nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDEyKSArICdcXG4nICsgc3RyLnN1YnN0cmluZygxMik7XG5cblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgxMiwgMSk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxMikgKyBzdHIuc3Vic3RyaW5nKDEyICsgMSk7XG5cblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgxOCwgMSk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxOCkgKyBzdHIuc3Vic3RyaW5nKDE4ICsgMSk7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgxOCwgJ30nKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDE4KSArICd9JyArIHN0ci5zdWJzdHJpbmcoMTgpO1xuXG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMTcsIDIpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMTcpICsgc3RyLnN1YnN0cmluZygxNyArIDIpO1xuXG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMTYsIDEpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMTYpICsgc3RyLnN1YnN0cmluZygxNiArIDEpO1xuXG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMTYsICcpJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAxNikgKyAnKScgKyBzdHIuc3Vic3RyaW5nKDE2KTtcblxuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDE1LCAyKTtcblx0XHRzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIDE1KSArIHN0ci5zdWJzdHJpbmcoMTUgKyAyKTtcblxuXHRcdGNvbnN0IGNvbnRlbnQgPSBwaWVjZVRhYmxlLmdldExpbmVzUmF3Q29udGVudCgpO1xuXHRcdGFzc2VydChjb250ZW50ID09PSBzdHIpO1xuXHR9KTtcblxuXHR0ZXN0KCdMaW5lIGJyZWFrcyByZXBsYWNlbWVudCBpcyBub3QgbmVjZXNzYXJ5IHdoZW4gRU9MIGlzIG5vcm1hbGl6ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJ2FiYyddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdGxldCBzdHIgPSAnYWJjJztcblxuXHRcdHBpZWNlVGFibGUuaW5zZXJ0KDMsICdkZWZcXG5hYmMnKTtcblx0XHRzdHIgPSBzdHIgKyAnZGVmXFxuYWJjJztcblxuXHRcdHRlc3RMaW5lU3RhcnRzKHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0dGVzdExpbmVzQ29udGVudChzdHIsIHBpZWNlVGFibGUpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdMaW5lIGJyZWFrcyByZXBsYWNlbWVudCBpcyBub3QgbmVjZXNzYXJ5IHdoZW4gRU9MIGlzIG5vcm1hbGl6ZWQgMicsICgpID0+IHtcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnYWJjXFxuJ10pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0bGV0IHN0ciA9ICdhYmNcXG4nO1xuXG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoNCwgJ2RlZlxcbmFiYycpO1xuXHRcdHN0ciA9IHN0ciArICdkZWZcXG5hYmMnO1xuXG5cdFx0dGVzdExpbmVTdGFydHMoc3RyLCBwaWVjZVRhYmxlKTtcblx0XHR0ZXN0TGluZXNDb250ZW50KHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0YXNzZXJ0VHJlZUludmFyaWFudHMocGllY2VUYWJsZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0xpbmUgYnJlYWtzIHJlcGxhY2VtZW50IGlzIG5vdCBuZWNlc3Nhcnkgd2hlbiBFT0wgaXMgbm9ybWFsaXplZCAzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBpZWNlVHJlZSA9IGNyZWF0ZVRleHRCdWZmZXIoWydhYmNcXG4nXSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblx0XHRsZXQgc3RyID0gJ2FiY1xcbic7XG5cblx0XHRwaWVjZVRhYmxlLmluc2VydCgyLCAnZGVmXFxuYWJjJyk7XG5cdFx0c3RyID0gc3RyLnN1YnN0cmluZygwLCAyKSArICdkZWZcXG5hYmMnICsgc3RyLnN1YnN0cmluZygyKTtcblxuXHRcdHRlc3RMaW5lU3RhcnRzKHN0ciwgcGllY2VUYWJsZSk7XG5cdFx0dGVzdExpbmVzQ29udGVudChzdHIsIHBpZWNlVGFibGUpO1xuXHRcdGFzc2VydFRyZWVJbnZhcmlhbnRzKHBpZWNlVGFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdMaW5lIGJyZWFrcyByZXBsYWNlbWVudCBpcyBub3QgbmVjZXNzYXJ5IHdoZW4gRU9MIGlzIG5vcm1hbGl6ZWQgNCcsICgpID0+IHtcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFsnYWJjXFxuJ10pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cdFx0bGV0IHN0ciA9ICdhYmNcXG4nO1xuXG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMywgJ2RlZlxcbmFiYycpO1xuXHRcdHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgMykgKyAnZGVmXFxuYWJjJyArIHN0ci5zdWJzdHJpbmcoMyk7XG5cblx0XHR0ZXN0TGluZVN0YXJ0cyhzdHIsIHBpZWNlVGFibGUpO1xuXHRcdHRlc3RMaW5lc0NvbnRlbnQoc3RyLCBwaWVjZVRhYmxlKTtcblx0XHRhc3NlcnRUcmVlSW52YXJpYW50cyhwaWVjZVRhYmxlKTtcblx0fSk7XG5cbn0pO1xuXG5mdW5jdGlvbiBnZXRWYWx1ZUluU25hcHNob3Qoc25hcHNob3Q6IElUZXh0U25hcHNob3QpIHtcblx0bGV0IHJldCA9ICcnO1xuXHRsZXQgdG1wID0gc25hcHNob3QucmVhZCgpO1xuXG5cdHdoaWxlICh0bXAgIT09IG51bGwpIHtcblx0XHRyZXQgKz0gdG1wO1xuXHRcdHRtcCA9IHNuYXBzaG90LnJlYWQoKTtcblx0fVxuXG5cdHJldHVybiByZXQ7XG59XG5zdWl0ZSgnc25hcHNob3QnLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2J1ZyAjNDU1NjQsIHBpZWNlIHRyZWUgcGllY2VzIHNob3VsZCBiZSBpbW11dGFibGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ1xcbicpO1xuXHRcdG1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0e1xuXHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDIsIDEsIDIsIDEpLFxuXHRcdFx0XHR0ZXh0OiAnISdcblx0XHRcdH1cblx0XHRdKTtcblx0XHRjb25zdCBzbmFwc2hvdCA9IG1vZGVsLmNyZWF0ZVNuYXBzaG90KCk7XG5cdFx0Y29uc3Qgc25hcHNob3QxID0gbW9kZWwuY3JlYXRlU25hcHNob3QoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZXNDb250ZW50KCkuam9pbignXFxuJyksIGdldFZhbHVlSW5TbmFwc2hvdChzbmFwc2hvdCkpO1xuXG5cdFx0bW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHR7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMiwgMSwgMiwgMiksXG5cdFx0XHRcdHRleHQ6ICcnXG5cdFx0XHR9XG5cdFx0XSk7XG5cdFx0bW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHR7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMiwgMSwgMiwgMSksXG5cdFx0XHRcdHRleHQ6ICchJ1xuXHRcdFx0fVxuXHRcdF0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVzQ29udGVudCgpLmpvaW4oJ1xcbicpLCBnZXRWYWx1ZUluU25hcHNob3Qoc25hcHNob3QxKSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ltbXV0YWJsZSBzbmFwc2hvdCAxJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCdhYmNcXG5kZWYnKTtcblx0XHRjb25zdCBzbmFwc2hvdCA9IG1vZGVsLmNyZWF0ZVNuYXBzaG90KCk7XG5cdFx0bW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHR7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMiwgMSwgMiwgNCksXG5cdFx0XHRcdHRleHQ6ICcnXG5cdFx0XHR9XG5cdFx0XSk7XG5cblx0XHRtb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdHtcblx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAyLCAxKSxcblx0XHRcdFx0dGV4dDogJ2FiY1xcbmRlZidcblx0XHRcdH1cblx0XHRdKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lc0NvbnRlbnQoKS5qb2luKCdcXG4nKSwgZ2V0VmFsdWVJblNuYXBzaG90KHNuYXBzaG90KSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ltbXV0YWJsZSBzbmFwc2hvdCAyJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCdhYmNcXG5kZWYnKTtcblx0XHRjb25zdCBzbmFwc2hvdCA9IG1vZGVsLmNyZWF0ZVNuYXBzaG90KCk7XG5cdFx0bW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHR7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMiwgMSwgMiwgMSksXG5cdFx0XHRcdHRleHQ6ICchJ1xuXHRcdFx0fVxuXHRcdF0pO1xuXG5cdFx0bW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHR7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMiwgMSwgMiwgMiksXG5cdFx0XHRcdHRleHQ6ICcnXG5cdFx0XHR9XG5cdFx0XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZXNDb250ZW50KCkuam9pbignXFxuJyksIGdldFZhbHVlSW5TbmFwc2hvdChzbmFwc2hvdCkpO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbW11dGFibGUgc25hcHNob3QgMycsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnYWJjXFxuZGVmJyk7XG5cdFx0bW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHR7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMiwgNCwgMiwgNCksXG5cdFx0XHRcdHRleHQ6ICchJ1xuXHRcdFx0fVxuXHRcdF0pO1xuXHRcdGNvbnN0IHNuYXBzaG90ID0gbW9kZWwuY3JlYXRlU25hcHNob3QoKTtcblx0XHRtb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdHtcblx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgyLCA1LCAyLCA1KSxcblx0XHRcdFx0dGV4dDogJyEnXG5cdFx0XHR9XG5cdFx0XSk7XG5cblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZXNDb250ZW50KCkuam9pbignXFxuJyksIGdldFZhbHVlSW5TbmFwc2hvdChzbmFwc2hvdCkpO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnY2h1bmsgYmFzZWQgc2VhcmNoJywgKCkgPT4ge1xuXHRjb25zdCBkcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJyM0NTg5Mi4gRm9yIHNvbWUgY2FzZXMsIHRoZSBidWZmZXIgaXMgZW1wdHkgYnV0IHdlIHN0aWxsIHRyeSB0byBzZWFyY2gnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcGllY2VUcmVlID0gY3JlYXRlVGV4dEJ1ZmZlcihbJyddKTtcblx0XHRkcy5hZGQocGllY2VUcmVlKTtcblx0XHRjb25zdCBwaWVjZVRhYmxlID0gcGllY2VUcmVlLmdldFBpZWNlVHJlZSgpO1xuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDAsIDEpO1xuXHRcdGNvbnN0IHJldCA9IHBpZWNlVHJlZS5maW5kTWF0Y2hlc0xpbmVCeUxpbmUobmV3IFJhbmdlKDEsIDEsIDEsIDEpLCBuZXcgU2VhcmNoRGF0YSgvYWJjLywgbmV3IFdvcmRDaGFyYWN0ZXJDbGFzc2lmaWVyKCcsLi8nLCBbXSksICdhYmMnKSwgdHJ1ZSwgMTAwMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldC5sZW5ndGgsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCcjNDU3NzAuIEZpbmRJbk5vZGUgc2hvdWxkIG5vdCBjcm9zcyBub2RlIGJvdW5kYXJ5LicsICgpID0+IHtcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFtcblx0XHRcdFtcblx0XHRcdFx0J2JhbGFiYWxhYmFiYWxhYmFsYWJhYmFsYWJhbGFiYScsXG5cdFx0XHRcdCdiYWxhYmFsYWJhYmFsYWJhbGFiYWJhbGFiYWxhYmEnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JyogWyBdIHRhc2sxJyxcblx0XHRcdFx0JyogW3hdIHRhc2syIGJhbGFiYWxhYmEnLFxuXHRcdFx0XHQnKiBbIF0gdGFzayAzJ1xuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdF0pO1xuXHRcdGRzLmFkZChwaWVjZVRyZWUpO1xuXHRcdGNvbnN0IHBpZWNlVGFibGUgPSBwaWVjZVRyZWUuZ2V0UGllY2VUcmVlKCk7XG5cblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSgwLCA2Mik7XG5cdFx0cGllY2VUYWJsZS5kZWxldGUoMTYsIDEpO1xuXG5cdFx0cGllY2VUYWJsZS5pbnNlcnQoMTYsICcgJyk7XG5cdFx0Y29uc3QgcmV0ID0gcGllY2VUYWJsZS5maW5kTWF0Y2hlc0xpbmVCeUxpbmUobmV3IFJhbmdlKDEsIDEsIDQsIDEzKSwgbmV3IFNlYXJjaERhdGEoL1xcWy9naSwgbmV3IFdvcmRDaGFyYWN0ZXJDbGFzc2lmaWVyKCcsLi8nLCBbXSksICdbJyksIHRydWUsIDEwMDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXQubGVuZ3RoLCAzKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmV0WzBdLnJhbmdlLCBuZXcgUmFuZ2UoMiwgMywgMiwgNCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmV0WzFdLnJhbmdlLCBuZXcgUmFuZ2UoMywgMywgMywgNCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmV0WzJdLnJhbmdlLCBuZXcgUmFuZ2UoNCwgMywgNCwgNCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdzZWFyY2ggc2VhcmNoaW5nIGZyb20gdGhlIG1pZGRsZScsICgpID0+IHtcblx0XHRjb25zdCBwaWVjZVRyZWUgPSBjcmVhdGVUZXh0QnVmZmVyKFtcblx0XHRcdFtcblx0XHRcdFx0J2RlZicsXG5cdFx0XHRcdCdkYmNhYmMnXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0XSk7XG5cdFx0ZHMuYWRkKHBpZWNlVHJlZSk7XG5cdFx0Y29uc3QgcGllY2VUYWJsZSA9IHBpZWNlVHJlZS5nZXRQaWVjZVRyZWUoKTtcblxuXHRcdHBpZWNlVGFibGUuZGVsZXRlKDQsIDEpO1xuXHRcdGxldCByZXQgPSBwaWVjZVRhYmxlLmZpbmRNYXRjaGVzTGluZUJ5TGluZShuZXcgUmFuZ2UoMiwgMywgMiwgNiksIG5ldyBTZWFyY2hEYXRhKC9hL2dpLCBudWxsLCAnYScpLCB0cnVlLCAxMDAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmV0Lmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXRbMF0ucmFuZ2UsIG5ldyBSYW5nZSgyLCAzLCAyLCA0KSk7XG5cblx0XHRwaWVjZVRhYmxlLmRlbGV0ZSg0LCAxKTtcblx0XHRyZXQgPSBwaWVjZVRhYmxlLmZpbmRNYXRjaGVzTGluZUJ5TGluZShuZXcgUmFuZ2UoMiwgMiwgMiwgNSksIG5ldyBTZWFyY2hEYXRhKC9hL2dpLCBudWxsLCAnYScpLCB0cnVlLCAxMDAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmV0Lmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXRbMF0ucmFuZ2UsIG5ldyBSYW5nZSgyLCAyLCAyLCAzKSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsa0JBQWlDLGtCQUFrQjtBQUc1RCxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLFdBQVcsZ0JBQTBCO0FBQzlDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsK0NBQStDO0FBRXhELE1BQU0sV0FBVztBQUVqQixTQUFTLGFBQWE7QUFDckIsU0FBTyxTQUFTLFVBQVUsU0FBUyxNQUFNLENBQUM7QUFDM0M7QUFFQSxTQUFTLFVBQVUsT0FBZTtBQUNqQyxTQUFPLEtBQUssTUFBTSxLQUFLLE9BQU8sSUFBSSxLQUFLO0FBQ3hDO0FBRUEsU0FBUyxVQUFVLEtBQWE7QUFDL0IsTUFBSSxRQUFRLE1BQU07QUFDakIsVUFBTTtBQUFBLEVBQ1A7QUFDQSxTQUFRLFdBQVk7QUFDbkIsUUFBSSxHQUFHO0FBQ1AsVUFBTSxVQUFVLENBQUM7QUFDakIsU0FDQyxJQUFJLEdBQUcsTUFBTSxLQUNiLEtBQUssTUFBTSxJQUFJLE1BQU0sSUFBSSxLQUN6QixLQUFLLE1BQU0sTUFBTSxLQUNoQjtBQUNELGNBQVEsS0FBSyxXQUFXLENBQUM7QUFBQSxJQUMxQjtBQUNBLFdBQU87QUFBQSxFQUNSLEVBQUcsRUFBRSxLQUFLLEVBQUU7QUFDYjtBQUVBLFNBQVMsYUFBYSxNQUFzQjtBQUMzQyxNQUFJLEtBQUssV0FBVyxHQUFHO0FB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
