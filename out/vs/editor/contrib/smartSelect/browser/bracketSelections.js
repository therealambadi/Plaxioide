import { LinkedList } from "../../../../base/common/linkedList.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
const _BracketSelectionRangeProvider = class _BracketSelectionRangeProvider {
  async provideSelectionRanges(model, positions) {
    const result = [];
    for (const position of positions) {
      const bucket = [];
      result.push(bucket);
      const ranges = /* @__PURE__ */ new Map();
      await new Promise((resolve) => _BracketSelectionRangeProvider._bracketsRightYield(resolve, 0, model, position, ranges));
      await new Promise((resolve) => _BracketSelectionRangeProvider._bracketsLeftYield(resolve, 0, model, position, ranges, bucket));
    }
    return result;
  }
  static _bracketsRightYield(resolve, round, model, pos, ranges) {
    const counts = /* @__PURE__ */ new Map();
    const t1 = Date.now();
    while (true) {
      if (round >= _BracketSelectionRangeProvider._maxRounds) {
        resolve();
        break;
      }
      if (!pos) {
        resolve();
        break;
      }
      const bracket = model.bracketPairs.findNextBracket(pos);
      if (!bracket) {
        resolve();
        break;
      }
      const d = Date.now() - t1;
      if (d > _BracketSelectionRangeProvider._maxDuration) {
        setTimeout(() => _BracketSelectionRangeProvider._bracketsRightYield(resolve, round + 1, model, pos, ranges));
        break;
      }
      if (bracket.bracketInfo.isOpeningBracket) {
        const key = bracket.bracketInfo.bracketText;
        const val = counts.has(key) ? counts.get(key) : 0;
        counts.set(key, val + 1);
      } else {
        const key = bracket.bracketInfo.getOpeningBrackets()[0].bracketText;
        let val = counts.has(key) ? counts.get(key) : 0;
        val -= 1;
        counts.set(key, Math.max(0, val));
        if (val < 0) {
          let list = ranges.get(key);
          if (!list) {
            list = new LinkedList();
            ranges.set(key, list);
          }
          list.push(bracket.range);
        }
      }
      pos = bracket.range.getEndPosition();
    }
  }
  static _bracketsLeftYield(resolve, round, model, pos, ranges, bucket) {
    const counts = /* @__PURE__ */ new Map();
    const t1 = Date.now();
    while (true) {
      if (round >= _BracketSelectionRangeProvider._maxRounds && ranges.size === 0) {
        resolve();
        break;
      }
      if (!pos) {
        resolve();
        break;
      }
      const bracket = model.bracketPairs.findPrevBracket(pos);
      if (!bracket) {
        resolve();
        break;
      }
      const d = Date.now() - t1;
      if (d > _BracketSelectionRangeProvider._maxDuration) {
        setTimeout(() => _BracketSelectionRangeProvider._bracketsLeftYield(resolve, round + 1, model, pos, ranges, bucket));
        break;
      }
      if (!bracket.bracketInfo.isOpeningBracket) {
        const key = bracket.bracketInfo.getOpeningBrackets()[0].bracketText;
        const val = counts.has(key) ? counts.get(key) : 0;
        counts.set(key, val + 1);
      } else {
        const key = bracket.bracketInfo.bracketText;
        let val = counts.has(key) ? counts.get(key) : 0;
        val -= 1;
        counts.set(key, Math.max(0, val));
        if (val < 0) {
          const list = ranges.get(key);
          if (list) {
            const closing = list.shift();
            if (list.size === 0) {
              ranges.delete(key);
            }
            const innerBracket = Range.fromPositions(bracket.range.getEndPosition(), closing.getStartPosition());
            const outerBracket = Range.fromPositions(bracket.range.getStartPosition(), closing.getEndPosition());
            bucket.push({ range: innerBracket });
            bucket.push({ range: outerBracket });
            _BracketSelectionRangeProvider._addBracketLeading(model, outerBracket, bucket);
          }
        }
      }
      pos = bracket.range.getStartPosition();
    }
  }
  static _addBracketLeading(model, bracket, bucket) {
    if (bracket.startLineNumber === bracket.endLineNumber) {
      return;
    }
    const startLine = bracket.startLineNumber;
    const column = model.getLineFirstNonWhitespaceColumn(startLine);
    if (column !== 0 && column !== bracket.startColumn) {
      bucket.push({ range: Range.fromPositions(new Position(startLine, column), bracket.getEndPosition()) });
      bucket.push({ range: Range.fromPositions(new Position(startLine, 1), bracket.getEndPosition()) });
    }
    const aboveLine = startLine - 1;
    if (aboveLine > 0) {
      const column2 = model.getLineFirstNonWhitespaceColumn(aboveLine);
      if (column2 === bracket.startColumn && column2 !== model.getLineLastNonWhitespaceColumn(aboveLine)) {
        bucket.push({ range: Range.fromPositions(new Position(aboveLine, column2), bracket.getEndPosition()) });
        bucket.push({ range: Range.fromPositions(new Position(aboveLine, 1), bracket.getEndPosition()) });
      }
    }
  }
};
_BracketSelectionRangeProvider._maxDuration = 30;
_BracketSelectionRangeProvider._maxRounds = 2;
let BracketSelectionRangeProvider = _BracketSelectionRangeProvider;
export {
  BracketSelectionRangeProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zbWFydFNlbGVjdC9icm93c2VyL2JyYWNrZXRTZWxlY3Rpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgTGlua2VkTGlzdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpbmtlZExpc3QuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uUmFuZ2UsIFNlbGVjdGlvblJhbmdlUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcblxuZXhwb3J0IGNsYXNzIEJyYWNrZXRTZWxlY3Rpb25SYW5nZVByb3ZpZGVyIGltcGxlbWVudHMgU2VsZWN0aW9uUmFuZ2VQcm92aWRlciB7XG5cblx0YXN5bmMgcHJvdmlkZVNlbGVjdGlvblJhbmdlcyhtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb25zOiBQb3NpdGlvbltdKTogUHJvbWlzZTxTZWxlY3Rpb25SYW5nZVtdW10+IHtcblx0XHRjb25zdCByZXN1bHQ6IFNlbGVjdGlvblJhbmdlW11bXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBwb3NpdGlvbiBvZiBwb3NpdGlvbnMpIHtcblx0XHRcdGNvbnN0IGJ1Y2tldDogU2VsZWN0aW9uUmFuZ2VbXSA9IFtdO1xuXHRcdFx0cmVzdWx0LnB1c2goYnVja2V0KTtcblxuXHRcdFx0Y29uc3QgcmFuZ2VzID0gbmV3IE1hcDxzdHJpbmcsIExpbmtlZExpc3Q8UmFuZ2U+PigpO1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBCcmFja2V0U2VsZWN0aW9uUmFuZ2VQcm92aWRlci5fYnJhY2tldHNSaWdodFlpZWxkKHJlc29sdmUsIDAsIG1vZGVsLCBwb3NpdGlvbiwgcmFuZ2VzKSk7XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IEJyYWNrZXRTZWxlY3Rpb25SYW5nZVByb3ZpZGVyLl9icmFja2V0c0xlZnRZaWVsZChyZXNvbHZlLCAwLCBtb2RlbCwgcG9zaXRpb24sIHJhbmdlcywgYnVja2V0KSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgX21heER1cmF0aW9uID0gMzA7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9tYXhSb3VuZHMgPSAyO1xuXG5cdHByaXZhdGUgc3RhdGljIF9icmFja2V0c1JpZ2h0WWllbGQocmVzb2x2ZTogKCkgPT4gdm9pZCwgcm91bmQ6IG51bWJlciwgbW9kZWw6IElUZXh0TW9kZWwsIHBvczogUG9zaXRpb24sIHJhbmdlczogTWFwPHN0cmluZywgTGlua2VkTGlzdDxSYW5nZT4+KTogdm9pZCB7XG5cdFx0Y29uc3QgY291bnRzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblx0XHRjb25zdCB0MSA9IERhdGUubm93KCk7XG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdGlmIChyb3VuZCA+PSBCcmFja2V0U2VsZWN0aW9uUmFuZ2VQcm92aWRlci5fbWF4Um91bmRzKSB7XG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXBvcykge1xuXHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYnJhY2tldCA9IG1vZGVsLmJyYWNrZXRQYWlycy5maW5kTmV4dEJyYWNrZXQocG9zKTtcblx0XHRcdGlmICghYnJhY2tldCkge1xuXHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZCA9IERhdGUubm93KCkgLSB0MTtcblx0XHRcdGlmIChkID4gQnJhY2tldFNlbGVjdGlvblJhbmdlUHJvdmlkZXIuX21heER1cmF0aW9uKSB7XG5cdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4gQnJhY2tldFNlbGVjdGlvblJhbmdlUHJvdmlkZXIuX2JyYWNrZXRzUmlnaHRZaWVsZChyZXNvbHZlLCByb3VuZCArIDEsIG1vZGVsLCBwb3MsIHJhbmdlcykpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGlmIChicmFja2V0LmJyYWNrZXRJbmZvLmlzT3BlbmluZ0JyYWNrZXQpIHtcblx0XHRcdFx0Y29uc3Qga2V5ID0gYnJhY2tldC5icmFja2V0SW5mby5icmFja2V0VGV4dDtcblx0XHRcdFx0Ly8gd2FpdCBmb3IgY2xvc2luZ1xuXHRcdFx0XHRjb25zdCB2YWwgPSBjb3VudHMuaGFzKGtleSkgPyBjb3VudHMuZ2V0KGtleSkhIDogMDtcblx0XHRcdFx0Y291bnRzLnNldChrZXksIHZhbCArIDEpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3Qga2V5ID0gYnJhY2tldC5icmFja2V0SW5mby5nZXRPcGVuaW5nQnJhY2tldHMoKVswXS5icmFja2V0VGV4dDtcblx0XHRcdFx0Ly8gcHJvY2VzcyBjbG9zaW5nXG5cdFx0XHRcdGxldCB2YWwgPSBjb3VudHMuaGFzKGtleSkgPyBjb3VudHMuZ2V0KGtleSkhIDogMDtcblx0XHRcdFx0dmFsIC09IDE7XG5cdFx0XHRcdGNvdW50cy5zZXQoa2V5LCBNYXRoLm1heCgwLCB2YWwpKTtcblx0XHRcdFx0aWYgKHZhbCA8IDApIHtcblx0XHRcdFx0XHRsZXQgbGlzdCA9IHJhbmdlcy5nZXQoa2V5KTtcblx0XHRcdFx0XHRpZiAoIWxpc3QpIHtcblx0XHRcdFx0XHRcdGxpc3QgPSBuZXcgTGlua2VkTGlzdCgpO1xuXHRcdFx0XHRcdFx0cmFuZ2VzLnNldChrZXksIGxpc3QpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRsaXN0LnB1c2goYnJhY2tldC5yYW5nZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHBvcyA9IGJyYWNrZXQucmFuZ2UuZ2V0RW5kUG9zaXRpb24oKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfYnJhY2tldHNMZWZ0WWllbGQocmVzb2x2ZTogKCkgPT4gdm9pZCwgcm91bmQ6IG51bWJlciwgbW9kZWw6IElUZXh0TW9kZWwsIHBvczogUG9zaXRpb24sIHJhbmdlczogTWFwPHN0cmluZywgTGlua2VkTGlzdDxSYW5nZT4+LCBidWNrZXQ6IFNlbGVjdGlvblJhbmdlW10pOiB2b2lkIHtcblx0XHRjb25zdCBjb3VudHMgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuXHRcdGNvbnN0IHQxID0gRGF0ZS5ub3coKTtcblx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0aWYgKHJvdW5kID49IEJyYWNrZXRTZWxlY3Rpb25SYW5nZVByb3ZpZGVyLl9tYXhSb3VuZHMgJiYgcmFuZ2VzLnNpemUgPT09IDApIHtcblx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGlmICghcG9zKSB7XG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBicmFja2V0ID0gbW9kZWwuYnJhY2tldFBhaXJzLmZpbmRQcmV2QnJhY2tldChwb3MpO1xuXHRcdFx0aWYgKCFicmFja2V0KSB7XG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBkID0gRGF0ZS5ub3coKSAtIHQxO1xuXHRcdFx0aWYgKGQgPiBCcmFja2V0U2VsZWN0aW9uUmFuZ2VQcm92aWRlci5fbWF4RHVyYXRpb24pIHtcblx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiBCcmFja2V0U2VsZWN0aW9uUmFuZ2VQcm92aWRlci5fYnJhY2tldHNMZWZ0WWllbGQocmVzb2x2ZSwgcm91bmQgKyAxLCBtb2RlbCwgcG9zLCByYW5nZXMsIGJ1Y2tldCkpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGlmICghYnJhY2tldC5icmFja2V0SW5mby5pc09wZW5pbmdCcmFja2V0KSB7XG5cdFx0XHRcdGNvbnN0IGtleSA9IGJyYWNrZXQuYnJhY2tldEluZm8uZ2V0T3BlbmluZ0JyYWNrZXRzKClbMF0uYnJhY2tldFRleHQ7XG5cdFx0XHRcdC8vIHdhaXQgZm9yIG9wZW5pbmdcblx0XHRcdFx0Y29uc3QgdmFsID0gY291bnRzLmhhcyhrZXkpID8gY291bnRzLmdldChrZXkpISA6IDA7XG5cdFx0XHRcdGNvdW50cy5zZXQoa2V5LCB2YWwgKyAxKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGtleSA9IGJyYWNrZXQuYnJhY2tldEluZm8uYnJhY2tldFRleHQ7XG5cdFx0XHRcdC8vIG9wZW5pbmdcblx0XHRcdFx0bGV0IHZhbCA9IGNvdW50cy5oYXMoa2V5KSA/IGNvdW50cy5nZXQoa2V5KSEgOiAwO1xuXHRcdFx0XHR2YWwgLT0gMTtcblx0XHRcdFx0Y291bnRzLnNldChrZXksIE1hdGgubWF4KDAsIHZhbCkpO1xuXHRcdFx0XHRpZiAodmFsIDwgMCkge1xuXHRcdFx0XHRcdGNvbnN0IGxpc3QgPSByYW5nZXMuZ2V0KGtleSk7XG5cdFx0XHRcdFx0aWYgKGxpc3QpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNsb3NpbmcgPSBsaXN0LnNoaWZ0KCk7XG5cdFx0XHRcdFx0XHRpZiAobGlzdC5zaXplID09PSAwKSB7XG5cdFx0XHRcdFx0XHRcdHJhbmdlcy5kZWxldGUoa2V5KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNvbnN0IGlubmVyQnJhY2tldCA9IFJhbmdlLmZyb21Qb3NpdGlvbnMoYnJhY2tldC5yYW5nZS5nZXRFbmRQb3NpdGlvbigpLCBjbG9zaW5nIS5nZXRTdGFydFBvc2l0aW9uKCkpO1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3V0ZXJCcmFja2V0ID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyhicmFja2V0LnJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSwgY2xvc2luZyEuZ2V0RW5kUG9zaXRpb24oKSk7XG5cdFx0XHRcdFx0XHRidWNrZXQucHVzaCh7IHJhbmdlOiBpbm5lckJyYWNrZXQgfSk7XG5cdFx0XHRcdFx0XHRidWNrZXQucHVzaCh7IHJhbmdlOiBvdXRlckJyYWNrZXQgfSk7XG5cdFx0XHRcdFx0XHRCcmFja2V0U2VsZWN0aW9uUmFuZ2VQcm92aWRlci5fYWRkQnJhY2tldExlYWRpbmcobW9kZWwsIG91dGVyQnJhY2tldCwgYnVja2V0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHBvcyA9IGJyYWNrZXQucmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9hZGRCcmFja2V0TGVhZGluZyhtb2RlbDogSVRleHRNb2RlbCwgYnJhY2tldDogUmFuZ2UsIGJ1Y2tldDogU2VsZWN0aW9uUmFuZ2VbXSk6IHZvaWQge1xuXHRcdGlmIChicmFja2V0LnN0YXJ0TGluZU51bWJlciA9PT0gYnJhY2tldC5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIHh4eHh4eHh4IHtcblx0XHQvL1xuXHRcdC8vIH1cblx0XHRjb25zdCBzdGFydExpbmUgPSBicmFja2V0LnN0YXJ0TGluZU51bWJlcjtcblx0XHRjb25zdCBjb2x1bW4gPSBtb2RlbC5nZXRMaW5lRmlyc3ROb25XaGl0ZXNwYWNlQ29sdW1uKHN0YXJ0TGluZSk7XG5cdFx0aWYgKGNvbHVtbiAhPT0gMCAmJiBjb2x1bW4gIT09IGJyYWNrZXQuc3RhcnRDb2x1bW4pIHtcblx0XHRcdGJ1Y2tldC5wdXNoKHsgcmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMobmV3IFBvc2l0aW9uKHN0YXJ0TGluZSwgY29sdW1uKSwgYnJhY2tldC5nZXRFbmRQb3NpdGlvbigpKSB9KTtcblx0XHRcdGJ1Y2tldC5wdXNoKHsgcmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMobmV3IFBvc2l0aW9uKHN0YXJ0TGluZSwgMSksIGJyYWNrZXQuZ2V0RW5kUG9zaXRpb24oKSkgfSk7XG5cdFx0fVxuXG5cdFx0Ly8geHh4eHh4eHhcblx0XHQvLyB7XG5cdFx0Ly9cblx0XHQvLyB9XG5cdFx0Y29uc3QgYWJvdmVMaW5lID0gc3RhcnRMaW5lIC0gMTtcblx0XHRpZiAoYWJvdmVMaW5lID4gMCkge1xuXHRcdFx0Y29uc3QgY29sdW1uID0gbW9kZWwuZ2V0TGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNvbHVtbihhYm92ZUxpbmUpO1xuXHRcdFx0aWYgKGNvbHVtbiA9PT0gYnJhY2tldC5zdGFydENvbHVtbiAmJiBjb2x1bW4gIT09IG1vZGVsLmdldExpbmVMYXN0Tm9uV2hpdGVzcGFjZUNvbHVtbihhYm92ZUxpbmUpKSB7XG5cdFx0XHRcdGJ1Y2tldC5wdXNoKHsgcmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMobmV3IFBvc2l0aW9uKGFib3ZlTGluZSwgY29sdW1uKSwgYnJhY2tldC5nZXRFbmRQb3NpdGlvbigpKSB9KTtcblx0XHRcdFx0YnVja2V0LnB1c2goeyByYW5nZTogUmFuZ2UuZnJvbVBvc2l0aW9ucyhuZXcgUG9zaXRpb24oYWJvdmVMaW5lLCAxKSwgYnJhY2tldC5nZXRFbmRQb3NpdGlvbigpKSB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsYUFBYTtBQUlmLE1BQU0saUNBQU4sTUFBTSwrQkFBZ0U7QUFBQSxFQUU1RSxNQUFNLHVCQUF1QixPQUFtQixXQUFvRDtBQUNuRyxVQUFNLFNBQTZCLENBQUM7QUFFcEMsZUFBVyxZQUFZLFdBQVc7QUFDakMsWUFBTSxTQUEyQixDQUFDO0FBQ2xDLGFBQU8sS0FBSyxNQUFNO0FBRWxCLFlBQU0sU0FBUyxvQkFBSSxJQUErQjtBQUNsRCxZQUFNLElBQUksUUFBYyxhQUFXLCtCQUE4QixvQkFBb0IsU0FBUyxHQUFHLE9BQU8sVUFBVSxNQUFNLENBQUM7QUFDekgsWUFBTSxJQUFJLFFBQWMsYUFBVywrQkFBOEIsbUJBQW1CLFNBQVMsR0FBRyxPQUFPLFVBQVUsUUFBUSxNQUFNLENBQUM7QUFBQSxJQUNqSTtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFLQSxPQUFlLG9CQUFvQixTQUFxQixPQUFlLE9BQW1CLEtBQWUsUUFBOEM7QUFDdEosVUFBTSxTQUFTLG9CQUFJLElBQW9CO0FBQ3ZDLFVBQU0sS0FBSyxLQUFLLElBQUk7QUFDcEIsV0FBTyxNQUFNO0FBQ1osVUFBSSxTQUFTLCtCQUE4QixZQUFZO0FBQ3RELGdCQUFRO0FBQ1I7QUFBQSxNQUNEO0FBQ0EsVUFBSSxDQUFDLEtBQUs7QUFDVCxnQkFBUTtBQUNSO0FBQUEsTUFDRDtBQUNBLFlBQU0sVUFBVSxNQUFNLGFBQWEsZ0JBQWdCLEdBQUc7QUFDdEQsVUFBSSxDQUFDLFNBQVM7QUFDYixnQkFBUTtBQUNSO0FBQUEsTUFDRDtBQUNBLFlBQU0sSUFBSSxLQUFLLElBQUksSUFBSTtBQUN2QixVQUFJLElBQUksK0JBQThCLGNBQWM7QUFDbkQs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
