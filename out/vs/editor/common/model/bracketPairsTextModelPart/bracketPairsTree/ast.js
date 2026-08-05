import { BugIndicatingError } from "../../../../../base/common/errors.js";
import { CursorColumns } from "../../../core/cursorColumns.js";
import { lengthAdd, lengthGetLineCount, lengthToObj, lengthZero } from "./length.js";
import { SmallImmutableSet } from "./smallImmutableSet.js";
var AstNodeKind = /* @__PURE__ */ ((AstNodeKind2) => {
  AstNodeKind2[AstNodeKind2["Text"] = 0] = "Text";
  AstNodeKind2[AstNodeKind2["Bracket"] = 1] = "Bracket";
  AstNodeKind2[AstNodeKind2["Pair"] = 2] = "Pair";
  AstNodeKind2[AstNodeKind2["UnexpectedClosingBracket"] = 3] = "UnexpectedClosingBracket";
  AstNodeKind2[AstNodeKind2["List"] = 4] = "List";
  return AstNodeKind2;
})(AstNodeKind || {});
class BaseAstNode {
  /**
   * The length of the entire node, which should equal the sum of lengths of all children.
  */
  get length() {
    return this._length;
  }
  constructor(length) {
    this._length = length;
  }
}
class PairAstNode extends BaseAstNode {
  constructor(length, openingBracket, child, closingBracket, missingOpeningBracketIds) {
    super(length);
    this.openingBracket = openingBracket;
    this.child = child;
    this.closingBracket = closingBracket;
    this.missingOpeningBracketIds = missingOpeningBracketIds;
  }
  static create(openingBracket, child, closingBracket) {
    let length = openingBracket.length;
    if (child) {
      length = lengthAdd(length, child.length);
    }
    if (closingBracket) {
      length = lengthAdd(length, closingBracket.length);
    }
    return new PairAstNode(length, openingBracket, child, closingBracket, child ? child.missingOpeningBracketIds : SmallImmutableSet.getEmpty());
  }
  get kind() {
    return 2 /* Pair */;
  }
  get listHeight() {
    return 0;
  }
  get childrenLength() {
    return 3;
  }
  getChild(idx) {
    switch (idx) {
      case 0:
        return this.openingBracket;
      case 1:
        return this.child;
      case 2:
        return this.closingBracket;
    }
    throw new Error("Invalid child index");
  }
  /**
   * Avoid using this property, it allocates an array!
  */
  get children() {
    const result = [];
    result.push(this.openingBracket);
    if (this.child) {
      result.push(this.child);
    }
    if (this.closingBracket) {
      result.push(this.closingBracket);
    }
    return result;
  }
  canBeReused(openBracketIds) {
    if (this.closingBracket === null) {
      return false;
    }
    if (openBracketIds.intersects(this.missingOpeningBracketIds)) {
      return false;
    }
    return true;
  }
  flattenLists() {
    return PairAstNode.create(
      this.openingBracket.flattenLists(),
      this.child && this.child.flattenLists(),
      this.closingBracket && this.closingBracket.flattenLists()
    );
  }
  deepClone() {
    return new PairAstNode(
      this.length,
      this.openingBracket.deepClone(),
      this.child && this.child.deepClone(),
      this.closingBracket && this.closingBracket.deepClone(),
      this.missingOpeningBracketIds
    );
  }
  computeMinIndentation(offset, textModel) {
    return this.child ? this.child.computeMinIndentation(lengthAdd(offset, this.openingBracket.length), textModel) : Number.MAX_SAFE_INTEGER;
  }
}
class ListAstNode extends BaseAstNode {
  /**
   * Use ListAstNode.create.
  */
  constructor(length, listHeight, _missingOpeningBracketIds) {
    super(length);
    this.listHeight = listHeight;
    this._missingOpeningBracketIds = _missingOpeningBracketIds;
    this.cachedMinIndentation = -1;
  }
  /**
   * This method uses more memory-efficient list nodes that can only store 2 or 3 children.
  */
  static create23(item1, item2, item3, immutable = false) {
    let length = item1.length;
    let missingBracketIds = item1.missingOpeningBracketIds;
    if (item1.listHeight !== item2.listHeight) {
      throw new Error("Invalid list heights");
    }
    length = lengthAdd(length, item2.length);
    missingBracketIds = missingBracketIds.merge(item2.missingOpeningBracketIds);
    if (item3) {
      if (item1.listHeight !== item3.listHeight) {
        throw new Error("Invalid list heights");
      }
      length = lengthAdd(length, item3.length);
      missingBracketIds = missingBracketIds.merge(item3.missingOpeningBracketIds);
    }
    return immutable ? new Immutable23ListAstNode(length, item1.listHeight + 1, item1, item2, item3, missingBracketIds) : new TwoThreeListAstNode(length, item1.listHeight + 1, item1, item2, item3, missingBracketIds);
  }
  static create(items, immutable = false) {
    if (items.length === 0) {
      return this.getEmpty();
    } else {
      let length = items[0].length;
      let unopenedBrackets = items[0].missingOpeningBracketIds;
      for (let i = 1; i < items.length; i++) {
        length = lengthAdd(length, items[i].length);
        unopenedBrackets = unopenedBrackets.merge(items[i].missingOpeningBracketIds);
      }
      return immutable ? new ImmutableArrayListAstNode(length, items[0].listHeight + 1, items, unopenedBrackets) : new ArrayListAstNode(length, items[0].listHeight + 1, items, unopenedBrackets);
    }
  }
  static getEmpty() {
    return new ImmutableArrayListAstNode(lengthZero, 0, [], SmallImmutableSet.getEmpty());
  }
  get kind() {
    return 4 /* List */;
  }
  get missingOpeningBracketIds() {
    return this._missingOpeningBracketIds;
  }
  throwIfImmutable() {
  }
  makeLastElementMutable() {
    this.throwIfImmutable();
    const childCount = this.childrenLength;
    if (childCount === 0) {
      return void 0;
    }
    const lastChild = this.getChild(childCount - 1);
    const mutable = lastChild.kind === 4 /* List */ ? lastChild.toMutable() : lastChild;
    if (lastChild !== mutable) {
      this.setChild(childCount - 1, mutable);
    }
    return mutable;
  }
  makeFirstElementMutable() {
    this.throwIfImmutable();
    const childCount = this.childrenLength;
    if (childCount === 0) {
      return void 0;
    }
    const firstChild = this.getChild(0);
    const mutable = firstChild.kind === 4 /* List */ ? firstChild.toMutable() : firstChild;
    if (firstChild !== mutable) {
      this.setChild(0, mutable);
    }
    return mutable;
  }
  canBeReused(openBracketIds) {
    if (openBracketIds.intersects(this.missingOpeningBracketIds)) {
      return false;
    }
    if (this.childrenLength === 0) {
      return false;
    }
    let lastChild = this;
    while (lastChild.kind === 4 /* List */) {
      const lastLength = lastChild.childrenLength;
      if (lastLength === 0) {
        throw new BugIndicatingError();
      }
      lastChild = lastChild.getChild(lastLength - 1);
    }
    return lastChild.canBeReused(openBracketIds);
  }
  handleChildrenChanged() {
    this.throwIfImmutable();
    const count = this.childrenLength;
    let length = this.getChild(0).length;
    let unopenedBrackets = this.getChild(0).missingOpeningBracketIds;
    for (let i = 1; i < count; i++) {
      const child = this.getChild(i);
      length = lengthAdd(length, child.length);
      unopenedBrackets = unopenedBrackets.merge(child.missingOpeningBracketIds);
    }
    this._length = length;
    this._missingOpeningBracketIds = unopenedBrackets;
    this.cachedMinIndentation = -1;
  }
  flattenLists() {
    const items = [];
    for (const c of this.children) {
      const normalized = c.flattenLists();
      if (normalized.kind === 4 /* List */) {
        items.push(...normalized.children);
      } else {
        items.push(normalized);
      }
    }
    return ListAstNode.create(items);
  }
  computeMinIndentation(offset, textModel) {
    if (this.cachedMinIndentation !== -1) {
      return this.cachedMinIndentation;
    }
    let minIndentation = Number.MAX_SAFE_INTEGER;
    let childOffset = offset;
    for (let i = 0; i < this.childrenLength; i++) {
      const child = this.getChild(i);
      if (child) {
        minIndentation = Math.min(minIndentation, child.computeMinIndentation(childOffset, textModel));
        childOffset = lengthAdd(childOffset, child.length);
      }
    }
    this.cachedMinIndentation = minIndentation;
    return minIndentation;
  }
}
class TwoThreeListAstNode extends ListAstNode {
  constructor(length, listHeight, _item1, _item2, _item3, missingOpeningBracketIds) {
    super(length, listHeight, missingOpeningBracketIds);
    this._item1 = _item1;
    this._item2 = _item2;
    this._item3 = _item3;
  }
  get childrenLength() {
    return this._item3 !== null ? 3 : 2;
  }
  getChild(idx) {
    switch (idx) {
      case 0:
        return this._item1;
      case 1:
        return this._item2;
      case 2:
        return this._item3;
    }
    throw new Error("Invalid child index");
  }
  setChild(idx, node) {
    switch (idx) {
      case 0:
        this._item1 = node;
        return;
      case 1:
        this._item2 = node;
        return;
      case 2:
        this._item3 = node;
        return;
    }
    throw new Error("Invalid child index");
  }
  get children() {
    return this._item3 ? [this._item1, this._item2, this._item3] : [this._item1, this._item2];
  }
  get item1() {
    return this._item1;
  }
  get item2() {
    return this._item2;
  }
  get item3() {
    return this._item3;
  }
  deepClone() {
    return new TwoThreeListAstNode(
      this.length,
      this.listHeight,
      this._item1.deepClone(),
      this._item2.deepClone(),
      this._item3 ? this._item3.deepClone() : null,
      this.missingOpeningBracketIds
    );
  }
  appendChildOfSameHeight(node) {
    if (this._item3) {
      throw new Error("Cannot append to a full (2,3) tree node");
    }
    this.throwIfImmutable();
    this._item3 = node;
    this.handleChildrenChanged();
  }
  unappendChild() {
    if (!this._item3) {
      throw new Error("Cannot remove from a non-full (2,3) tree node");
    }
    this.throwIfImmutable();
    const result = this._item3;
    this._item3 = null;
    this.handleChildrenChanged();
    return result;
  }
  prependChildOfSameHeight(node) {
    if (this._item3) {
      throw new Error("Cannot prepend to a full (2,3) tree node");
    }
    this.throwIfImmutable();
    this._item3 = this._item2;
    this._item2 = this._item1;
    this._item1 = node;
    this.handleChildrenChanged();
  }
  unprependChild() {
    if (!this._item3) {
      throw new Error("Cannot remove from a non-full (2,3) tree node");
    }
    this.throwIfImmutable();
    const result = this._item1;
    this._item1 = this._item2;
    this._item2 = this._item3;
    this._item3 = null;
    this.handleChildrenChanged();
    return result;
  }
  toMutable() {
    return this;
  }
}
class Immutable23ListAstNode extends TwoThreeListAstNode {
  toMutable() {
    return new TwoThreeListAstNode(this.length, this.listHeight, this.item1, this.item2, this.item3, this.missingOpeningBracketIds);
  }
  throwIfImmutable() {
    throw new Error("this instance is immutable");
  }
}
class ArrayListAstNode extends ListAstNode {
  constructor(length, listHeight, _children, missingOpeningBracketIds) {
    super(length, listHeight, missingOpeningBracketIds);
    this._children = _children;
  }
  get childrenLength() {
    return this._children.length;
  }
  getChild(idx) {
    return this._children[idx];
  }
  setChild(idx, child) {
    this._children[idx] = child;
  }
  get children() {
    return this._children;
  }
  deepClone() {
    const children = new Array(this._children.length);
    for (let i = 0; i < this._children.length; i++) {
      children[i] = this._children[i].deepClone();
    }
    return new ArrayListAstNode(this.length, this.listHeight, children, this.missingOpeningBracketIds);
  }
  appendChildOfSameHeight(node) {
    this.throwIfImmutable();
    this._children.push(node);
    this.handleChildrenChanged();
  }
  unappendChild() {
    this.throwIfImmutable();
    const item = this._children.pop();
    this.handleChildrenChanged();
    return item;
  }
  prependChildOfSameHeight(node) {
    this.throwIfImmutable();
    this._children.unshift(node);
    this.handleChildrenChanged();
  }
  unprependChild() {
    this.throwIfImmutable();
    const item = this._children.shift();
    this.handleChildrenChanged();
    return item;
  }
  toMutable() {
    return this;
  }
}
class ImmutableArrayListAstNode extends ArrayListAstNode {
  toMutable() {
    return new ArrayListAstNode(this.length, this.listHeight, [...this.children], this.missingOpeningBracketIds);
  }
  throwIfImmutable() {
    throw new Error("this instance is immutable");
  }
}
const emptyArray = [];
class ImmutableLeafAstNode extends BaseAstNode {
  get listHeight() {
    return 0;
  }
  get childrenLength() {
    return 0;
  }
  getChild(idx) {
    return null;
  }
  get children() {
    return emptyArray;
  }
  flattenLists() {
    return this;
  }
  deepClone() {
    return this;
  }
}
class TextAstNode extends ImmutableLeafAstNode {
  get kind() {
    return 0 /* Text */;
  }
  get missingOpeningBracketIds() {
    return SmallImmutableSet.getEmpty();
  }
  canBeReused(_openedBracketIds) {
    return true;
  }
  computeMinIndentation(offset, textModel) {
    const start = lengthToObj(offset);
    const startLineNumber = (start.columnCount === 0 ? start.lineCount : start.lineCount + 1) + 1;
    const endLineNumber = lengthGetLineCount(lengthAdd(offset, this.length)) + 1;
    let result = Number.MAX_SAFE_INTEGER;
    for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
      const firstNonWsColumn = textModel.getLineFirstNonWhitespaceColumn(lineNumber);
      const lineContent = textModel.getLineContent(lineNumber);
      if (firstNonWsColumn === 0) {
        continue;
      }
      const visibleColumn = CursorColumns.visibleColumnFromColumn(lineContent, firstNonWsColumn, textModel.getOptions().tabSize);
      result = Math.min(result, visibleColumn);
    }
    return result;
  }
}
class BracketAstNode extends ImmutableLeafAstNode {
  constructor(length, bracketInfo, bracketIds) {
    super(length);
    this.bracketInfo = bracketInfo;
    this.bracketIds = bracketIds;
  }
  static create(length, bracketInfo, bracketIds) {
    const node = new BracketAstNode(length, bracketInfo, bracketIds);
    return node;
  }
  get kind() {
    return 1 /* Bracket */;
  }
  get missingOpeningBracketIds() {
    return SmallImmutableSet.getEmpty();
  }
  get text() {
    return this.bracketInfo.bracketText;
  }
  get languageId() {
    return this.bracketInfo.languageId;
  }
  canBeReused(_openedBracketIds) {
    return false;
  }
  computeMinIndentation(offset, textModel) {
    return Number.MAX_SAFE_INTEGER;
  }
}
class InvalidBracketAstNode extends ImmutableLeafAstNode {
  get kind() {
    return 3 /* UnexpectedClosingBracket */;
  }
  constructor(closingBrackets, length) {
    super(length);
    this.missingOpeningBracketIds = closingBrackets;
  }
  canBeReused(openedBracketIds) {
    return !openedBracketIds.intersects(this.missingOpeningBracketIds);
  }
  computeMinIndentation(offset, textModel) {
    return Number.MAX_SAFE_INTEGER;
  }
}
export {
  AstNodeKind,
  BracketAstNode,
  InvalidBracketAstNode,
  ListAstNode,
  PairAstNode,
  TextAstNode
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL21vZGVsL2JyYWNrZXRQYWlyc1RleHRNb2RlbFBhcnQvYnJhY2tldFBhaXJzVHJlZS9hc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBCdWdJbmRpY2F0aW5nRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgQ3Vyc29yQ29sdW1ucyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvY3Vyc29yQ29sdW1ucy5qcyc7XG5pbXBvcnQgeyBCcmFja2V0S2luZCB9IGZyb20gJy4uLy4uLy4uL2xhbmd1YWdlcy9zdXBwb3J0cy9sYW5ndWFnZUJyYWNrZXRzQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vbW9kZWwuanMnO1xuaW1wb3J0IHsgTGVuZ3RoLCBsZW5ndGhBZGQsIGxlbmd0aEdldExpbmVDb3VudCwgbGVuZ3RoVG9PYmosIGxlbmd0aFplcm8gfSBmcm9tICcuL2xlbmd0aC5qcyc7XG5pbXBvcnQgeyBTbWFsbEltbXV0YWJsZVNldCB9IGZyb20gJy4vc21hbGxJbW11dGFibGVTZXQuanMnO1xuaW1wb3J0IHsgT3BlbmluZ0JyYWNrZXRJZCB9IGZyb20gJy4vdG9rZW5pemVyLmpzJztcblxuZXhwb3J0IGNvbnN0IGVudW0gQXN0Tm9kZUtpbmQge1xuXHRUZXh0ID0gMCxcblx0QnJhY2tldCA9IDEsXG5cdFBhaXIgPSAyLFxuXHRVbmV4cGVjdGVkQ2xvc2luZ0JyYWNrZXQgPSAzLFxuXHRMaXN0ID0gNCxcbn1cblxuZXhwb3J0IHR5cGUgQXN0Tm9kZSA9IFBhaXJBc3ROb2RlIHwgTGlzdEFzdE5vZGUgfCBCcmFja2V0QXN0Tm9kZSB8IEludmFsaWRCcmFja2V0QXN0Tm9kZSB8IFRleHRBc3ROb2RlO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIGZvciBhbGwgQVNUIG5vZGVzLlxuKi9cbmFic3RyYWN0IGNsYXNzIEJhc2VBc3ROb2RlIHtcblx0cHVibGljIGFic3RyYWN0IHJlYWRvbmx5IGtpbmQ6IEFzdE5vZGVLaW5kO1xuXG5cdHB1YmxpYyBhYnN0cmFjdCByZWFkb25seSBjaGlsZHJlbkxlbmd0aDogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBNaWdodCByZXR1cm4gbnVsbCBldmVuIGlmIHtAbGluayBpZHh9IGlzIHNtYWxsZXIgdGhhbiB7QGxpbmsgQmFzZUFzdE5vZGUuY2hpbGRyZW5MZW5ndGh9LlxuXHQqL1xuXHRwdWJsaWMgYWJzdHJhY3QgZ2V0Q2hpbGQoaWR4OiBudW1iZXIpOiBBc3ROb2RlIHwgbnVsbDtcblxuXHQvKipcblx0ICogVHJ5IHRvIGF2b2lkIHVzaW5nIHRoaXMgcHJvcGVydHksIGFzIGltcGxlbWVudGF0aW9ucyBtaWdodCBuZWVkIHRvIGFsbG9jYXRlIHRoZSByZXN1bHRpbmcgYXJyYXkuXG5cdCovXG5cdHB1YmxpYyBhYnN0cmFjdCByZWFkb25seSBjaGlsZHJlbjogcmVhZG9ubHkgQXN0Tm9kZVtdO1xuXG5cdC8qKlxuXHQgKiBSZXByZXNlbnRzIHRoZSBzZXQgb2YgYWxsIChwb3RlbnRpYWxseSkgbWlzc2luZyBvcGVuaW5nIGJyYWNrZXQgaWRzIGluIHRoaXMgbm9kZS5cblx0ICogRS5nLiBpbiBgeyBdICkgfWAgdGhhdCBzZXQgaXMge2BbYCwgYChgIH0uXG5cdCovXG5cdHB1YmxpYyBhYnN0cmFjdCByZWFkb25seSBtaXNzaW5nT3BlbmluZ0JyYWNrZXRJZHM6IFNtYWxsSW1tdXRhYmxlU2V0PE9wZW5pbmdCcmFja2V0SWQ+O1xuXG5cdC8qKlxuXHQgKiBJbiBjYXNlIG9mIGEgbGlzdCwgZGV0ZXJtaW5lcyB0aGUgaGVpZ2h0IG9mIHRoZSAoMiwzKSB0cmVlLlxuXHQqL1xuXHRwdWJsaWMgYWJzdHJhY3QgcmVhZG9ubHkgbGlzdEhlaWdodDogbnVtYmVyO1xuXG5cdHByb3RlY3RlZCBfbGVuZ3RoOiBMZW5ndGg7XG5cblx0LyoqXG5cdCAqIFRoZSBsZW5ndGggb2YgdGhlIGVudGlyZSBub2RlLCB3aGljaCBzaG91bGQgZXF1YWwgdGhlIHN1bSBvZiBsZW5ndGhzIG9mIGFsbCBjaGlsZHJlbi5cblx0Ki9cblx0cHVibGljIGdldCBsZW5ndGgoKTogTGVuZ3RoIHtcblx0XHRyZXR1cm4gdGhpcy5fbGVuZ3RoO1xuXHR9XG5cblx0cHVibGljIGNvbnN0cnVjdG9yKGxlbmd0aDogTGVuZ3RoKSB7XG5cdFx0dGhpcy5fbGVuZ3RoID0gbGVuZ3RoO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSBvcGVuQnJhY2tldElkcyBUaGUgc2V0IG9mIGFsbCBvcGVuaW5nIGJyYWNrZXRzIHRoYXQgaGF2ZSBub3QgeWV0IGJlZW4gY2xvc2VkLlxuXHQgKi9cblx0cHVibGljIGFic3RyYWN0IGNhbkJlUmV1c2VkKFxuXHRcdG9wZW5CcmFja2V0SWRzOiBTbWFsbEltbXV0YWJsZVNldDxPcGVuaW5nQnJhY2tldElkPlxuXHQpOiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBGbGF0dGVucyBhbGwgbGlzdHMgaW4gdGhpcyBBU1QuIE9ubHkgZm9yIGRlYnVnZ2luZy5cblx0ICovXG5cdHB1YmxpYyBhYnN0cmFjdCBmbGF0dGVuTGlzdHMoKTogQXN0Tm9kZTtcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIGRlZXAgY2xvbmUuXG5cdCAqL1xuXHRwdWJsaWMgYWJzdHJhY3QgZGVlcENsb25lKCk6IEFzdE5vZGU7XG5cblx0cHVibGljIGFic3RyYWN0IGNvbXB1dGVNaW5JbmRlbnRhdGlvbihvZmZzZXQ6IExlbmd0aCwgdGV4dE1vZGVsOiBJVGV4dE1vZGVsKTogbnVtYmVyO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBicmFja2V0IHBhaXIgaW5jbHVkaW5nIGl0cyBjaGlsZCAoZS5nLiBgeyAuLi4gfWApLlxuICogTWlnaHQgYmUgdW5jbG9zZWQuXG4gKiBJbW11dGFibGUsIGlmIGFsbCBjaGlsZHJlbiBhcmUgaW1tdXRhYmxlLlxuKi9cbmV4cG9ydCBjbGFzcyBQYWlyQXN0Tm9kZSBleHRlbmRzIEJhc2VBc3ROb2RlIHtcblx0cHVibGljIHN0YXRpYyBjcmVhdGUoXG5cdFx0b3BlbmluZ0JyYWNrZXQ6IEJyYWNrZXRBc3ROb2RlLFxuXHRcdGNoaWxkOiBBc3ROb2RlIHwgbnVsbCxcblx0XHRjbG9zaW5nQnJhY2tldDogQnJhY2tldEFzdE5vZGUgfCBudWxsXG5cdCkge1xuXHRcdGxldCBsZW5ndGggPSBvcGVuaW5nQnJhY2tldC5sZW5ndGg7XG5cdFx0aWYgKGNoaWxkKSB7XG5cdFx0XHRsZW5ndGggPSBsZW5ndGhBZGQobGVuZ3RoLCBjaGlsZC5sZW5ndGgpO1xuXHRcdH1cblx0XHRpZiAoY2xvc2luZ0JyYWNrZXQpIHtcblx0XHRcdGxlbmd0aCA9IGxlbmd0aEFkZChsZW5ndGgsIGNsb3NpbmdCcmFja2V0Lmxlbmd0aCk7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgUGFpckFzdE5vZGUobGVuZ3RoLCBvcGVuaW5nQnJhY2tldCwgY2hpbGQsIGNsb3NpbmdCcmFja2V0LCBjaGlsZCA/IGNoaWxkLm1pc3NpbmdPcGVuaW5nQnJhY2tldElkcyA6IFNtYWxsSW1tdXRhYmxlU2V0LmdldEVtcHR5KCkpO1xuXHR9XG5cblx0cHVibGljIGdldCBraW5kKCk6IEFzdE5vZGVLaW5kLlBhaXIge1xuXHRcdHJldHVybiBBc3ROb2RlS2luZC5QYWlyO1xuXHR9XG5cdHB1YmxpYyBnZXQgbGlzdEhlaWdodCgpIHtcblx0XHRyZXR1cm4gMDtcblx0fVxuXHRwdWJsaWMgZ2V0IGNoaWxkcmVuTGVuZ3RoKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIDM7XG5cdH1cblx0cHVibGljIGdldENoaWxkKGlkeDogbnVtYmVyKTogQXN0Tm9kZSB8IG51bGwge1xuXHRcdHN3aXRjaCAoaWR4KSB7XG5cdFx0XHRjYXNlIDA6IHJldHVybiB0aGlzLm9wZW5pbmdCcmFja2V0O1xuXHRcdFx0Y2FzZSAxOiByZXR1cm4gdGhpcy5jaGlsZDtcblx0XHRcdGNhc2UgMjogcmV0dXJuIHRoaXMuY2xvc2luZ0JyYWNrZXQ7XG5cdFx0fVxuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjaGlsZCBpbmRleCcpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEF2b2lkIHVzaW5nIHRoaXMgcHJvcGVydHksIGl0IGFsbG9jYXRlcyBhbiBhcnJheSFcblx0Ki9cblx0cHVibGljIGdldCBjaGlsZHJlbigpIHtcblx0XHRjb25zdCByZXN1bHQ6IEFzdE5vZGVbXSA9IFtdO1xuXHRcdHJlc3VsdC5wdXNoKHRoaXMub3BlbmluZ0JyYWNrZXQpO1xuXHRcdGlmICh0aGlzLmNoaWxkKSB7XG5cdFx0XHRyZXN1bHQucHVzaCh0aGlzLmNoaWxkKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuY2xvc2luZ0JyYWNrZXQpIHtcblx0XHRcdHJlc3VsdC5wdXNoKHRoaXMuY2xvc2luZ0JyYWNrZXQpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBjb25zdHJ1Y3Rvcihcblx0XHRsZW5ndGg6IExlbmd0aCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgb3BlbmluZ0JyYWNrZXQ6IEJyYWNrZXRBc3ROb2RlLFxuXHRcdHB1YmxpYyByZWFkb25seSBjaGlsZDogQXN0Tm9kZSB8IG51bGwsXG5cdFx0cHVibGljIHJlYWRvbmx5IGNsb3NpbmdCcmFja2V0OiBCcmFja2V0QXN0Tm9kZSB8IG51bGwsXG5cdFx0cHVibGljIHJlYWRvbmx5IG1pc3NpbmdPcGVuaW5nQnJhY2tldElkczogU21hbGxJbW11dGFibGVTZXQ8T3BlbmluZ0JyYWNrZXRJZD5cblx0KSB7XG5cdFx0c3VwZXIobGVuZ3RoKTtcblx0fVxuXG5cdHB1YmxpYyBjYW5CZVJldXNlZChvcGVuQnJhY2tldElkczogU21hbGxJbW11dGFibGVTZXQ8T3BlbmluZ0JyYWNrZXRJZD4pIHtcblx0XHRpZiAodGhpcy5jbG9zaW5nQnJhY2tldCA9PT0gbnVsbCkge1xuXHRcdFx0Ly8gVW5jbG9zZWQgcGFpciBhc3Qgbm9kZXMgb25seVxuXHRcdFx0Ly8gZW5kIGF0IHRoZSBlbmQgb2YgdGhlIGRvY3VtZW50XG5cdFx0XHQvLyBvciB3aGVuIGEgcGFyZW50IG5vZGUgaXMgY2xvc2VkLlxuXG5cdFx0XHQvLyBUaGlzIGNvdWxkIGJlIGltcHJvdmVkOlxuXHRcdFx0Ly8gT25seSByZXR1cm4gZmFsc2UgaWYgc29tZSBuZXh0IHRva2VuIGlzIG5laXRoZXIgXCJ1bmRlZmluZWRcIiBub3IgYSBicmFja2V0IHRoYXQgY2xvc2VzIGEgcGFyZW50LlxuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKG9wZW5CcmFja2V0SWRzLmludGVyc2VjdHModGhpcy5taXNzaW5nT3BlbmluZ0JyYWNrZXRJZHMpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgZmxhdHRlbkxpc3RzKCk6IFBhaXJBc3ROb2RlIHtcblx0XHRyZXR1cm4gUGFpckFzdE5vZGUuY3JlYXRlKFxuXHRcdFx0dGhpcy5vcGVuaW5nQnJhY2tldC5mbGF0dGVuTGlzdHMoKSxcblx0XHRcdHRoaXMuY2hpbGQgJiYgdGhpcy5jaGlsZC5mbGF0dGVuTGlzdHMoKSxcblx0XHRcdHRoaXMuY2xvc2luZ0JyYWNrZXQgJiYgdGhpcy5jbG9zaW5nQnJhY2tldC5mbGF0dGVuTGlzdHMoKVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgZGVlcENsb25lKCk6IFBhaXJBc3ROb2RlIHtcblx0XHRyZXR1cm4gbmV3IFBhaXJBc3ROb2RlKFxuXHRcdFx0dGhpcy5sZW5ndGgsXG5cdFx0XHR0aGlzLm9wZW5pbmdCcmFja2V0LmRlZXBDbG9uZSgpLFxuXHRcdFx0dGhpcy5jaGlsZCAmJiB0aGlzLmNoaWxkLmRlZXBDbG9uZSgpLFxuXHRcdFx0dGhpcy5jbG9zaW5nQnJhY2tldCAmJiB0aGlzLmNsb3NpbmdCcmFja2V0LmRlZXBDbG9uZSgpLFxuXHRcdFx0dGhpcy5taXNzaW5nT3BlbmluZ0JyYWNrZXRJZHNcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIGNvbXB1dGVNaW5JbmRlbnRhdGlvbihvZmZzZXQ6IExlbmd0aCwgdGV4dE1vZGVsOiBJVGV4dE1vZGVsKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5jaGlsZCA/IHRoaXMuY2hpbGQuY29tcHV0ZU1pbkluZGVudGF0aW9uKGxlbmd0aEFkZChvZmZzZXQsIHRoaXMub3BlbmluZ0JyYWNrZXQubGVuZ3RoKSwgdGV4dE1vZGVsKSA6IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuXHR9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBMaXN0QXN0Tm9kZSBleHRlbmRzIEJhc2VBc3ROb2RlIHtcblx0LyoqXG5cdCAqIFRoaXMgbWV0aG9kIHVzZXMgbW9yZSBtZW1vcnktZWZmaWNpZW50IGxpc3Qgbm9kZXMgdGhhdCBjYW4gb25seSBzdG9yZSAyIG9yIDMgY2hpbGRyZW4uXG5cdCovXG5cdHB1YmxpYyBzdGF0aWMgY3JlYXRlMjMoaXRlbTE6IEFzdE5vZGUsIGl0ZW0yOiBBc3ROb2RlLCBpdGVtMzogQXN0Tm9kZSB8IG51bGwsIGltbXV0YWJsZTogYm9vbGVhbiA9IGZhbHNlKTogTGlzdEFzdE5vZGUge1xuXHRcdGxldCBsZW5ndGggPSBpdGVtMS5sZW5ndGg7XG5cdFx0bGV0IG1pc3NpbmdCcmFja2V0SWRzID0gaXRlbTEubWlzc2luZ09wZW5pbmdCcmFja2V0SWRzO1xuXG5cdFx0aWYgKGl0ZW0xLmxpc3RIZWlnaHQgIT09IGl0ZW0yLmxpc3RIZWlnaHQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBsaXN0IGhlaWdodHMnKTtcblx0XHR9XG5cblx0XHRsZW5ndGggPSBsZW5ndGhBZGQobGVuZ3RoLCBpdGVtMi5sZW5ndGgpO1xuXHRcdG1pc3NpbmdCcmFja2V0SWRzID0gbWlzc2luZ0JyYWNrZXRJZHMubWVyZ2UoaXRlbTIubWlzc2luZ09wZW5pbmdCcmFja2V0SWRzKTtcblxuXHRcdGlmIChpdGVtMykge1xuXHRcdFx0aWYgKGl0ZW0xLmxpc3RIZWlnaHQgIT09IGl0ZW0zLmxpc3RIZWlnaHQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGxpc3QgaGVpZ2h0cycpO1xuXHRcdFx0fVxuXHRcdFx0bGVuZ3RoID0gbGVuZ3RoQWRkKGxlbmd0aCwgaXRlbTMubGVuZ3RoKTtcblx0XHRcdG1pc3NpbmdCcmFja2V0SWRzID0gbWlzc2luZ0JyYWNrZXRJZHMubWVyZ2UoaXRlbTMubWlzc2luZ09wZW5pbmdCcmFja2V0SWRzKTtcblx0XHR9XG5cdFx0cmV0dXJuIGltbXV0YWJsZVxuXHRcdFx0PyBuZXcgSW1tdXRhYmxlMjNMaXN0QXN0Tm9kZShsZW5ndGgsIGl0ZW0xLmxpc3RIZWlnaHQgKyAxLCBpdGVtMSwgaXRlbTIsIGl0ZW0zLCBtaXNzaW5nQnJhY2tldElkcylcblx0XHRcdDogbmV3IFR3b1RocmVlTGlzdEFzdE5vZGUobGVuZ3RoLCBpdGVtMS5saXN0SGVpZ2h0ICsgMSwgaXRlbTEsIGl0ZW0yLCBpdGVtMywgbWlzc2luZ0JyYWNrZXRJZHMpO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBjcmVhdGUoaXRlbXM6IEFzdE5vZGVbXSwgaW1tdXRhYmxlOiBib29sZWFuID0gZmFsc2UpOiBMaXN0QXN0Tm9kZSB7XG5cdFx0aWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0RW1wdHkoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGV0IGxlbmd0aCA9IGl0ZW1zWzBdLmxlbmd0aDtcblx0XHRcdGxldCB1bm9wZW5lZEJyYWNrZXRzID0gaXRlbXNbMF0ubWlzc2luZ09wZW5pbmdCcmFja2V0SWRzO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRsZW5ndGggPSBsZW5ndGhBZGQobGVuZ3RoLCBpdGVtc1tpXS5sZW5ndGgpO1xuXHRcdFx0XHR1bm9wZW5lZEJyYWNrZXRzID0gdW5vcGVuZWRCcmFja2V0cy5tZXJnZShpdGVtc1tpXS5taXNzaW5nT3BlbmluZ0JyYWNrZXRJZHMpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGltbXV0YWJsZVxuXHRcdFx0XHQ/IG5ldyBJbW11dGFibGVBcnJheUxpc3RBc3ROb2RlKGxlbmd0aCwgaXRlbXNbMF0ubGlzdEhlaWdodCArIDEsIGl0ZW1zLCB1bm9wZW5lZEJyYWNrZXRzKVxuXHRcdFx0XHQ6IG5ldyBBcnJheUxpc3RBc3ROb2RlKGxlbmd0aCwgaXRlbXNbMF0ubGlzdEhlaWdodCArIDEsIGl0ZW1zLCB1bm9wZW5lZEJyYWNrZXRzKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGdldEVtcHR5KCkge1xuXHRcdHJldHVybiBuZXcgSW1tdXRhYmxlQXJyYXlMaXN0QXN0Tm9kZShsZW5ndGhaZXJvLCAwLCBbXSwgU21hbGxJbW11dGFibGVTZXQuZ2V0RW1wdHkoKSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGtpbmQoKTogQXN0Tm9kZUtpbmQuTGlzdCB7XG5cdFx0cmV0dXJuIEFzdE5vZGVLaW5kLkxpc3Q7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG1pc3NpbmdPcGVuaW5nQnJhY2tldElkcygpOiBTbWFsbEltbXV0YWJsZVNldDxPcGVuaW5nQnJhY2tldElkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX21pc3NpbmdPcGVuaW5nQnJhY2tldElkcztcblx0fVxuXG5cdHByaXZhdGUgY2FjaGVkTWluSW5kZW50YXRpb246IG51bWJlciA9IC0xO1xuXG5cdC8qKlxuXHQgKiBVc2UgTGlzdEFzdE5vZGUuY3JlYXRlLlxuXHQqL1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRsZW5ndGg6IExlbmd0aCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbGlzdEhlaWdodDogbnVtYmVyLFxuXHRcdHByaXZhdGUgX21pc3NpbmdPcGVuaW5nQnJhY2tldElkczogU21hbGxJbW11dGFibGVTZXQ8T3BlbmluZ0JyYWNrZXRJZD5cblx0KSB7XG5cdFx0c3VwZXIobGVuZ3RoKTtcblx0fVxuXG5cdHByb3RlY3RlZCB0aHJvd0lmSW1tdXRhYmxlKCk6IHZvaWQge1xuXHRcdC8vIE5PT1Bcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBzZXRDaGlsZChpZHg6IG51bWJlciwgY2hpbGQ6IEFzdE5vZGUpOiB2b2lkO1xuXG5cdHB1YmxpYyBtYWtlTGFzdEVsZW1lbnRNdXRhYmxlKCk6IEFzdE5vZGUgfCB1bmRlZmluZWQge1xuXHRcdHRoaXMudGhyb3dJZkltbXV0YWJsZSgpO1xuXHRcdGNvbnN0IGNoaWxkQ291bnQgPSB0aGlzLmNoaWxkcmVuTGVuZ3RoO1xuXHRcdGlmIChjaGlsZENvdW50ID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBsYXN0Q2hpbGQgPSB0aGlzLmdldENoaWxkKGNoaWxkQ291bnQgLSAxKSE7XG5cdFx0Y29uc3QgbXV0YWJsZSA9IGxhc3RDaGlsZC5raW5kID09PSBBc3ROb2RlS2luZC5MaXN0ID8gbGFzdENoaWxkLnRvTXV0YWJsZSgpIDogbGFzdENoaWxkO1xuXHRcdGlmIChsYXN0Q2hpbGQgIT09IG11dGFibGUpIHtcblx0XHRcdHRoaXMuc2V0Q2hpbGQoY2hpbGRDb3VudCAtIDEsIG11dGFibGUpO1xuXHRcdH1cblx0XHRyZXR1cm4gbXV0YWJsZTtcblx0fVxuXG5cdHB1YmxpYyBtYWtlRmlyc3RFbGVtZW50TXV0YWJsZSgpOiBBc3ROb2RlIHwgdW5kZWZpbmVkIHtcblx0XHR0aGlzLnRocm93SWZJbW11dGFibGUoKTtcblx0XHRjb25zdCBjaGlsZENvdW50ID0gdGhpcy5jaGlsZHJlbkxlbmd0aDtcblx0XHRpZiAoY2hpbGRDb3VudCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgZmlyc3RDaGlsZCA9IHRoaXMuZ2V0Q2hpbGQoMCkhO1xuXHRcdGNvbnN0IG11dGFibGUgPSBmaXJzdENoaWxkLmtpbmQgPT09IEFzdE5vZGVLaW5kLkxpc3QgPyBmaXJzdENoaWxkLnRvTXV0YWJsZSgpIDogZmlyc3RDaGlsZDtcblx0XHRpZiAoZmlyc3RDaGlsZCAhPT0gbXV0YWJsZSkge1xuXHRcdFx0dGhpcy5zZXRDaGlsZCgwLCBtdXRhYmxlKTtcblx0XHR9XG5cdFx0cmV0dXJuIG11dGFibGU7XG5cdH1cblxuXHRwdWJsaWMgY2FuQmVSZXVzZWQob3BlbkJyYWNrZXRJZHM6IFNtYWxsSW1tdXRhYmxlU2V0PE9wZW5pbmdCcmFja2V0SWQ+KTogYm9vbGVhbiB7XG5cdFx0aWYgKG9wZW5CcmFja2V0SWRzLmludGVyc2VjdHModGhpcy5taXNzaW5nT3BlbmluZ0JyYWNrZXRJZHMpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hpbGRyZW5MZW5ndGggPT09IDApIHtcblx0XHRcdC8vIERvbid0IHJldXNlIGVtcHR5IGxpc3RzLlxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGxldCBsYXN0Q2hpbGQ6IExpc3RBc3ROb2RlID0gdGhpcztcblx0XHR3aGlsZSAobGFzdENoaWxkLmtpbmQgPT09IEFzdE5vZGVLaW5kLkxpc3QpIHtcblx0XHRcdGNvbnN0IGxhc3RMZW5ndGggPSBsYXN0Q2hpbGQuY2hpbGRyZW5MZW5ndGg7XG5cdFx0XHRpZiAobGFzdExlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHQvLyBFbXB0eSBsaXN0cyBzaG91bGQgbmV2ZXIgYmUgY29udGFpbmVkIGluIG90aGVyIGxpc3RzLlxuXHRcdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCk7XG5cdFx0XHR9XG5cdFx0XHRsYXN0Q2hpbGQgPSBsYXN0Q2hpbGQuZ2V0Q2hpbGQobGFzdExlbmd0aCAtIDEpIGFzIExpc3RBc3ROb2RlO1xuXHRcdH1cblxuXHRcdHJldHVybiBsYXN0Q2hpbGQuY2FuQmVSZXVzZWQob3BlbkJyYWNrZXRJZHMpO1xuXHR9XG5cblx0cHVibGljIGhhbmRsZUNoaWxkcmVuQ2hhbmdlZCgpOiB2b2lkIHtcblx0XHR0aGlzLnRocm93SWZJbW11dGFibGUoKTtcblxuXHRcdGNvbnN0IGNvdW50ID0gdGhpcy5jaGlsZHJlbkxlbmd0aDtcblxuXHRcdGxldCBsZW5ndGggPSB0aGlzLmdldENoaWxkKDApIS5sZW5ndGg7XG5cdFx0bGV0IHVub3BlbmVkQnJhY2tldHMgPSB0aGlzLmdldENoaWxkKDApIS5taXNzaW5nT3BlbmluZ0JyYWNrZXRJZHM7XG5cblx0XHRmb3IgKGxldCBpID0gMTsgaSA8IGNvdW50OyBpKyspIHtcblx0XHRcdGNvbnN0IGNoaWxkID0gdGhpcy5nZXRDaGlsZChpKSE7XG5cdFx0XHRsZW5ndGggPSBsZW5ndGhBZGQobGVuZ3RoLCBjaGlsZC5sZW5ndGgpO1xuXHRcdFx0dW5vcGVuZWRCcmFja2V0cyA9IHVub3BlbmVkQnJhY2tldHMubWVyZ2UoY2hpbGQubWlzc2luZ09wZW5pbmdCcmFja2V0SWRzKTtcblx0XHR9XG5cblx0XHR0aGlzLl9sZW5ndGggPSBsZW5ndGg7XG5cdFx0dGhpcy5fbWlzc2luZ09wZW5pbmdCcmFja2V0SWRzID0gdW5vcGVuZWRCcmFja2V0cztcblx0XHR0aGlzLmNhY2hlZE1pbkluZGVudGF0aW9uID0gLTE7XG5cdH1cblxuXHRwdWJsaWMgZmxhdHRlbkxpc3RzKCk6IExpc3RBc3ROb2RlIHtcblx0XHRjb25zdCBpdGVtczogQXN0Tm9kZVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBjIG9mIHRoaXMuY2hpbGRyZW4pIHtcblx0XHRcdGNvbnN0IG5vcm1hbGl6ZWQgPSBjLmZsYXR0ZW5MaXN0cygpO1xuXHRcdFx0aWYgKG5vcm1hbGl6ZWQua2luZCA9PT0gQXN0Tm9kZUtpbmQuTGlzdCkge1xuXHRcdFx0XHRpdGVtcy5wdXNoKC4uLm5vcm1hbGl6ZWQuY2hpbGRyZW4pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aXRlbXMucHVzaChub3JtYWxpemVkKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIExpc3RBc3ROb2RlLmNyZWF0ZShpdGVtcyk7XG5cdH1cblxuXHRwdWJsaWMgY29tcHV0ZU1pbkluZGVudGF0aW9uKG9mZnNldDogTGVuZ3RoLCB0ZXh0TW9kZWw6IElUZXh0TW9kZWwpOiBudW1iZXIge1xuXHRcdGlmICh0aGlzLmNhY2hlZE1pbkluZGVudGF0aW9uICE9PSAtMSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuY2FjaGVkTWluSW5kZW50YXRpb247XG5cdFx0fVxuXG5cdFx0bGV0IG1pbkluZGVudGF0aW9uID0gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7XG5cdFx0bGV0IGNoaWxkT2Zmc2V0ID0gb2Zmc2V0O1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbkxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBjaGlsZCA9IHRoaXMuZ2V0Q2hpbGQoaSk7XG5cdFx0XHRpZiAoY2hpbGQpIHtcblx0XHRcdFx0bWluSW5kZW50YXRpb24gPSBNYXRoLm1pbihtaW5JbmRlbnRhdGlvbiwgY2hpbGQuY29tcHV0ZU1pbkluZGVudGF0aW9uKGNoaWxkT2Zmc2V0LCB0ZXh0TW9kZWwpKTtcblx0XHRcdFx0Y2hpbGRPZmZzZXQgPSBsZW5ndGhBZGQoY2hpbGRPZmZzZXQsIGNoaWxkLmxlbmd0aCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5jYWNoZWRNaW5JbmRlbnRhdGlvbiA9IG1pbkluZGVudGF0aW9uO1xuXHRcdHJldHVybiBtaW5JbmRlbnRhdGlvbjtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgc2hhbGxvdyBjbG9uZSB0aGF0IGlzIG11dGFibGUsIG9yIGl0c2VsZiBpZiBpdCBpcyBhbHJlYWR5IG11dGFibGUuXG5cdCAqL1xuXHRwdWJsaWMgYWJzdHJhY3QgdG9NdXRhYmxlKCk6IExpc3RBc3ROb2RlO1xuXG5cdHB1YmxpYyBhYnN0cmFjdCBhcHBlbmRDaGlsZE9mU2FtZUhlaWdodChub2RlOiBBc3ROb2RlKTogdm9pZDtcblx0cHVibGljIGFic3RyYWN0IHVuYXBwZW5kQ2hpbGQoKTogQXN0Tm9kZSB8IHVuZGVmaW5lZDtcblx0cHVibGljIGFic3RyYWN0IHByZXBlbmRDaGlsZE9mU2FtZUhlaWdodChub2RlOiBBc3ROb2RlKTogdm9pZDtcblx0cHVibGljIGFic3RyYWN0IHVucHJlcGVuZENoaWxkKCk6IEFzdE5vZGUgfCB1bmRlZmluZWQ7XG59XG5cbmNsYXNzIFR3b1RocmVlTGlzdEFzdE5vZGUgZXh0ZW5kcyBMaXN0QXN0Tm9kZSB7XG5cdHB1YmxpYyBnZXQgY2hpbGRyZW5MZW5ndGgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5faXRlbTMgIT09IG51bGwgPyAzIDogMjtcblx0fVxuXHRwdWJsaWMgZ2V0Q2hpbGQoaWR4OiBudW1iZXIpOiBBc3ROb2RlIHwgbnVsbCB7XG5cdFx0c3dpdGNoIChpZHgpIHtcblx0XHRcdGNhc2UgMDogcmV0dXJuIHRoaXMuX2l0ZW0xO1xuXHRcdFx0Y2FzZSAxOiByZXR1cm4gdGhpcy5faXRlbTI7XG5cdFx0XHRjYXNlIDI6IHJldHVybiB0aGlzLl9pdGVtMztcblx0XHR9XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNoaWxkIGluZGV4Jyk7XG5cdH1cblx0cHJvdGVjdGVkIHNldENoaWxkKGlkeDogbnVtYmVyLCBub2RlOiBBc3ROb2RlKTogdm9pZCB7XG5cdFx0c3dpdGNoIChpZHgpIHtcblx0XHRcdGNhc2UgMDogdGhpcy5faXRlbTEgPSBub2RlOyByZXR1cm47XG5cdFx0XHRjYXNlIDE6IHRoaXMuX2l0ZW0yID0gbm9kZTsgcmV0dXJuO1xuXHRcdFx0Y2FzZSAyOiB0aGlzLl9pdGVtMyA9IG5vZGU7IHJldHVybjtcblx0XHR9XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNoaWxkIGluZGV4Jyk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGNoaWxkcmVuKCk6IHJlYWRvbmx5IEFzdE5vZGVbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2l0ZW0zID8gW3RoaXMuX2l0ZW0xLCB0aGlzLl9pdGVtMiwgdGhpcy5faXRlbTNdIDogW3RoaXMuX2l0ZW0xLCB0aGlzLl9pdGVtMl07XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGl0ZW0xKCk6IEFzdE5vZGUge1xuXHRcdHJldHVybiB0aGlzLl9pdGVtMTtcblx0fVxuXHRwdWJsaWMgZ2V0IGl0ZW0yKCk6IEFzdE5vZGUge1xuXHRcdHJldHVybiB0aGlzLl9pdGVtMjtcblx0fVxuXHRwdWJsaWMgZ2V0IGl0ZW0zKCk6IEFzdE5vZGUgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5faXRlbTM7XG5cdH1cblxuXHRwdWJsaWMgY29uc3RydWN0b3IoXG5cdFx0bGVuZ3RoOiBMZW5ndGgsXG5cdFx0bGlzdEhlaWdodDogbnVtYmVyLFxuXHRcdHByaXZhdGUgX2l0ZW0xOiBBc3ROb2RlLFxuXHRcdHByaXZhdGUgX2l0ZW0yOiBBc3ROb2RlLFxuXHRcdHByaXZhdGUgX2l0ZW0zOiBBc3ROb2RlIHwgbnVsbCxcblx0XHRtaXNzaW5nT3BlbmluZ0JyYWNrZXRJZHM6IFNtYWxsSW1tdXRhYmxlU2V0PE9wZW5pbmdCcmFja2V0SWQ+XG5cdCkge1xuXHRcdHN1cGVyKGxlbmd0aCwgbGlzdEhlaWdodCwgbWlzc2luZ09wZW5pbmdCcmFja2V0SWRzKTtcblx0fVxuXG5cdHB1YmxpYyBkZWVwQ2xvbmUoKTogTGlzdEFzdE5vZGUge1xuXHRcdHJldHVybiBuZXcgVHdvVGhyZWVMaXN0QXN0Tm9kZShcblx0XHRcdHRoaXMubGVuZ3RoLFxuXHRcdFx0dGhpcy5saXN0SGVpZ2h0LFxuXHRcdFx0dGhpcy5faXRlbTEuZGVlcENsb25lKCksXG5cdFx0XHR0aGlzLl9pdGVtMi5kZWVwQ2xvbmUoKSxcblx0XHRcdHRoaXMuX2l0ZW0zID8gdGhpcy5faXRlbTMuZGVlcENsb25lKCkgOiBudWxsLFxuXHRcdFx0dGhpcy5taXNzaW5nT3BlbmluZ0JyYWNrZXRJZHNcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIGFwcGVuZENoaWxkT2ZTYW1lSGVpZ2h0KG5vZGU6IEFzdE5vZGUpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXRlbTMpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IGFwcGVuZCB0byBhIGZ1bGwgKDIsMykgdHJlZSBub2RlJyk7XG5cdFx0fVxuXHRcdHRoaXMudGhyb3dJZkltbXV0YWJsZSgpO1xuXHRcdHRoaXMuX2l0ZW0zID0gbm9kZTtcblx0XHR0aGlzLmhhbmRsZUNoaWxkcmVuQ2hhbmdlZCgpO1xuXHR9XG5cblx0cHVibGljIHVuYXBwZW5kQ2hpbGQoKTogQXN0Tm9kZSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLl9pdGVtMykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgcmVtb3ZlIGZyb20gYSBub24tZnVsbCAoMiwzKSB0cmVlIG5vZGUnKTtcblx0XHR9XG5cdFx0dGhpcy50aHJvd0lmSW1tdXRhYmxlKCk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5faXRlbTM7XG5cdFx0dGhpcy5faXRlbTMgPSBudWxsO1xuXHRcdHRoaXMuaGFuZGxlQ2hpbGRyZW5DaGFuZ2VkKCk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBwcmVwZW5kQ2hpbGRPZlNhbWVIZWlnaHQobm9kZTogQXN0Tm9kZSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pdGVtMykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgcHJlcGVuZCB0byBhIGZ1bGwgKDIsMykgdHJlZSBub2RlJyk7XG5cdFx0fVxuXHRcdHRoaXMudGhyb3dJZkltbXV0YWJsZSgpO1xuXHRcdHRoaXMuX2l0ZW0zID0gdGhpcy5faXRlbTI7XG5cdFx0dGhpcy5faXRlbTIgPSB0aGlzLl9pdGVtMTtcblx0XHR0aGlzLl9pdGVtMSA9IG5vZGU7XG5cdFx0dGhpcy5oYW5kbGVDaGlsZHJlbkNoYW5nZWQoKTtcblx0fVxuXG5cdHB1YmxpYyB1bnByZXBlbmRDaGlsZCgpOiBBc3ROb2RlIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuX2l0ZW0zKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCByZW1vdmUgZnJvbSBhIG5vbi1mdWxsICgyLDMpIHRyZWUgbm9kZScpO1xuXHRcdH1cblx0XHR0aGlzLnRocm93SWZJbW11dGFibGUoKTtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9pdGVtMTtcblx0XHR0aGlzLl9pdGVtMSA9IHRoaXMuX2l0ZW0yO1xuXHRcdHRoaXMuX2l0ZW0yID0gdGhpcy5faXRlbTM7XG5cdFx0dGhpcy5faXRlbTMgPSBudWxsO1xuXG5cdFx0dGhpcy5oYW5kbGVDaGlsZHJlbkNoYW5nZWQoKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0b3ZlcnJpZGUgdG9NdXRhYmxlKCk6IExpc3RBc3ROb2RlIHtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxufVxuXG4vKipcbiAqIEltbXV0YWJsZSwgaWYgYWxsIGNoaWxkcmVuIGFyZSBpbW11dGFibGUuXG4qL1xuY2xhc3MgSW1tdXRhYmxlMjNMaXN0QXN0Tm9kZSBleHRlbmRzIFR3b1RocmVlTGlzdEFzdE5vZGUge1xuXHRvdmVycmlkZSB0b011dGFibGUoKTogTGlzdEFzdE5vZGUge1xuXHRcdHJldHVybiBuZXcgVHdvVGhyZWVMaXN0QXN0Tm9kZSh0aGlzLmxlbmd0aCwgdGhpcy5saXN0SGVpZ2h0LCB0aGlzLml0ZW0xLCB0aGlzLml0ZW0yLCB0aGlzLml0ZW0zLCB0aGlzLm1pc3NpbmdPcGVuaW5nQnJhY2tldElkcyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdGhyb3dJZkltbXV0YWJsZSgpOiB2b2lkIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ3RoaXMgaW5zdGFuY2UgaXMgaW1tdXRhYmxlJyk7XG5cdH1cbn1cblxuLyoqXG4gKiBGb3IgZGVidWdnaW5nLlxuKi9cbmNsYXNzIEFycmF5TGlzdEFzdE5vZGUgZXh0ZW5kcyBMaXN0QXN0Tm9kZSB7XG5cdGdldCBjaGlsZHJlbkxlbmd0aCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7XG5cdH1cblx0Z2V0Q2hpbGQoaWR4OiBudW1iZXIpOiBBc3ROb2RlIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuX2NoaWxkcmVuW2lkeF07XG5cdH1cblx0cHJvdGVjdGVkIHNldENoaWxkKGlkeDogbnVtYmVyLCBjaGlsZDogQXN0Tm9kZSk6IHZvaWQge1xuXHRcdHRoaXMuX2NoaWxkcmVuW2lkeF0gPSBjaGlsZDtcblx0fVxuXHRnZXQgY2hpbGRyZW4oKTogcmVhZG9ubHkgQXN0Tm9kZVtdIHtcblx0XHRyZXR1cm4gdGhpcy5fY2hpbGRyZW47XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRsZW5ndGg6IExlbmd0aCxcblx0XHRsaXN0SGVpZ2h0OiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY2hpbGRyZW46IEFzdE5vZGVbXSxcblx0XHRtaXNzaW5nT3BlbmluZ0JyYWNrZXRJZHM6IFNtYWxsSW1tdXRhYmxlU2V0PE9wZW5pbmdCcmFja2V0SWQ+XG5cdCkge1xuXHRcdHN1cGVyKGxlbmd0aCwgbGlzdEhlaWdodCwgbWlzc2luZ09wZW5pbmdCcmFja2V0SWRzKTtcblx0fVxuXG5cdGRlZXBDbG9uZSgpOiBMaXN0QXN0Tm9kZSB7XG5cdFx0Y29uc3QgY2hpbGRyZW4gPSBuZXcgQXJyYXk8QXN0Tm9kZT4odGhpcy5fY2hpbGRyZW4ubGVuZ3RoKTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjaGlsZHJlbltpXSA9IHRoaXMuX2NoaWxkcmVuW2ldLmRlZXBDbG9uZSgpO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IEFycmF5TGlzdEFzdE5vZGUodGhpcy5sZW5ndGgsIHRoaXMubGlzdEhlaWdodCwgY2hpbGRyZW4sIHRoaXMubWlzc2luZ09wZW5pbmdCcmFja2V0SWRzKTtcblx0fVxuXG5cdHB1YmxpYyBhcHBlbmRDaGlsZE9mU2FtZUhlaWdodChub2RlOiBBc3ROb2RlKTogdm9pZCB7XG5cdFx0dGhpcy50aHJvd0lmSW1tdXRhYmxlKCk7XG5cdFx0dGhpcy5fY2hpbGRyZW4ucHVzaChub2RlKTtcblx0XHR0aGlzLmhhbmRsZUNoaWxkcmVuQ2hhbmdlZCgpO1xuXHR9XG5cblx0cHVibGljIHVuYXBwZW5kQ2hpbGQoKTogQXN0Tm9kZSB8IHVuZGVmaW5lZCB7XG5cdFx0dGhpcy50aHJvd0lmSW1tdXRhYmxlKCk7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2NoaWxkcmVuLnBvcCgpO1xuXHRcdHRoaXMuaGFuZGxlQ2hpbGRyZW5DaGFuZ2VkKCk7XG5cdFx0cmV0dXJuIGl0ZW07XG5cdH1cblxuXHRwdWJsaWMgcHJlcGVuZENoaWxkT2ZTYW1lSGVpZ2h0KG5vZGU6IEFzdE5vZGUpOiB2b2lkIHtcblx0XHR0aGlzLnRocm93SWZJbW11dGFibGUoKTtcblx0XHR0aGlzLl9jaGlsZHJlbi51bnNoaWZ0KG5vZGUpO1xuXHRcdHRoaXMuaGFuZGxlQ2hpbGRyZW5DaGFuZ2VkKCk7XG5cdH1cblxuXHRwdWJsaWMgdW5wcmVwZW5kQ2hpbGQoKTogQXN0Tm9kZSB8IHVuZGVmaW5lZCB7XG5cdFx0dGhpcy50aHJvd0lmSW1tdXRhYmxlKCk7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2NoaWxkcmVuLnNoaWZ0KCk7XG5cdFx0dGhpcy5oYW5kbGVDaGlsZHJlbkNoYW5nZWQoKTtcblx0XHRyZXR1cm4gaXRlbTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSB0b011dGFibGUoKTogTGlzdEFzdE5vZGUge1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG59XG5cbi8qKlxuICogSW1tdXRhYmxlLCBpZiBhbGwgY2hpbGRyZW4gYXJlIGltbXV0YWJsZS5cbiovXG5jbGFzcyBJbW11dGFibGVBcnJheUxpc3RBc3ROb2RlIGV4dGVuZHMgQXJyYXlMaXN0QXN0Tm9kZSB7XG5cdG92ZXJyaWRlIHRvTXV0YWJsZSgpOiBMaXN0QXN0Tm9kZSB7XG5cdFx0cmV0dXJuIG5ldyBBcnJheUxpc3RBc3ROb2RlKHRoaXMubGVuZ3RoLCB0aGlzLmxpc3RIZWlnaHQsIFsuLi50aGlzLmNoaWxkcmVuXSwgdGhpcy5taXNzaW5nT3BlbmluZ0JyYWNrZXRJZHMpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHRocm93SWZJbW11dGFibGUoKTogdm9pZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCd0aGlzIGluc3RhbmNlIGlzIGltbXV0YWJsZScpO1xuXHR9XG59XG5cbmNvbnN0IGVtcHR5QXJyYXk6IHJlYWRvbmx5IEFzdE5vZGVbXSA9IFtdO1xuXG5hYnN0cmFjdCBjbGFzcyBJbW11dGFibGVMZWFmQXN0Tm9kZSBleHRlbmRzIEJhc2VBc3ROb2RlIHtcblx0cHVibGljIGdldCBsaXN0SGVpZ2h0KCkge1xuXHRcdHJldHVybiAwO1xuXHR9XG5cdHB1YmxpYyBnZXQgY2hpbGRyZW5MZW5ndGgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gMDtcblx0fVxuXHRwdWJsaWMgZ2V0Q2hpbGQoaWR4OiBudW1iZXIpOiBBc3ROb2RlIHwgbnVsbCB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblx0cHVibGljIGdldCBjaGlsZHJlbigpOiByZWFkb25seSBBc3ROb2RlW10ge1xuXHRcdHJldHVybiBlbXB0eUFycmF5O1xuXHR9XG5cblx0cHVibGljIGZsYXR0ZW5MaXN0cygpOiB0aGlzICYgQXN0Tm9kZSB7XG5cdFx0cmV0dXJuIHRoaXMgYXMgdGhpcyAmIEFzdE5vZGU7XG5cdH1cblx0cHVibGljIGRlZXBDbG9uZSgpOiB0aGlzICYgQXN0Tm9kZSB7XG5cdFx0cmV0dXJuIHRoaXMgYXMgdGhpcyAmIEFzdE5vZGU7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRleHRBc3ROb2RlIGV4dGVuZHMgSW1tdXRhYmxlTGVhZkFzdE5vZGUge1xuXHRwdWJsaWMgZ2V0IGtpbmQoKTogQXN0Tm9kZUtpbmQuVGV4dCB7XG5cdFx0cmV0dXJuIEFzdE5vZGVLaW5kLlRleHQ7XG5cdH1cblx0cHVibGljIGdldCBtaXNzaW5nT3BlbmluZ0JyYWNrZXRJZHMoKTogU21hbGxJbW11dGFibGVTZXQ8T3BlbmluZ0JyYWNrZXRJZD4ge1xuXHRcdHJldHVybiBTbWFsbEltbXV0YWJsZVNldC5nZXRFbXB0eSgpO1xuXHR9XG5cblx0cHVibGljIGNhbkJlUmV1c2VkKF9vcGVuZWRCcmFja2V0SWRzOiBTbWFsbEltbXV0YWJsZVNldDxPcGVuaW5nQnJhY2tldElkPikge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIGNvbXB1dGVNaW5JbmRlbnRhdGlvbihvZmZzZXQ6IExlbmd0aCwgdGV4dE1vZGVsOiBJVGV4dE1vZGVsKTogbnVtYmVyIHtcblx0XHRjb25zdCBzdGFydCA9IGxlbmd0aFRvT2JqKG9mZnNldCk7XG5cdFx0Ly8gVGV4dCBhc3Qgbm9kZXMgZG9uJ3QgaGF2ZSBwYXJ0aWFsIGluZGVudGF0aW9uIChlbnN1cmVkIGJ5IHRoZSB0b2tlbml6ZXIpLlxuXHRcdC8vIFRodXMsIGlmIHRoaXMgdGV4dCBub2RlIGRvZXMgbm90IHN0YXJ0IGF0IGNvbHVtbiAwLCB0aGUgZmlyc3QgbGluZSBjYW5ub3QgaGF2ZSBhbnkgaW5kZW50YXRpb24gYXQgYWxsLlxuXHRcdGNvbnN0IHN0YXJ0TGluZU51bWJlciA9IChzdGFydC5jb2x1bW5Db3VudCA9PT0gMCA/IHN0YXJ0LmxpbmVDb3VudCA6IHN0YXJ0LmxpbmVDb3VudCArIDEpICsgMTtcblx0XHRjb25zdCBlbmRMaW5lTnVtYmVyID0gbGVuZ3RoR2V0TGluZUNvdW50KGxlbmd0aEFkZChvZmZzZXQsIHRoaXMubGVuZ3RoKSkgKyAxO1xuXG5cdFx0bGV0IHJlc3VsdCA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuXG5cdFx0Zm9yIChsZXQgbGluZU51bWJlciA9IHN0YXJ0TGluZU51bWJlcjsgbGluZU51bWJlciA8PSBlbmRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyKyspIHtcblx0XHRcdGNvbnN0IGZpcnN0Tm9uV3NDb2x1bW4gPSB0ZXh0TW9kZWwuZ2V0TGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNvbHVtbihsaW5lTnVtYmVyKTtcblx0XHRcdGNvbnN0IGxpbmVDb250ZW50ID0gdGV4dE1vZGVsLmdldExpbmVDb250ZW50KGxpbmVOdW1iZXIpO1xuXHRcdFx0aWYgKGZpcnN0Tm9uV3NDb2x1bW4gPT09IDApIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHZpc2libGVDb2x1bW4gPSBDdXJzb3JDb2x1bW5zLnZpc2libGVDb2x1bW5Gcm9tQ29sdW1uKGxpbmVDb250ZW50LCBmaXJzdE5vbldzQ29sdW1uLCB0ZXh0TW9kZWwuZ2V0T3B0aW9ucygpLnRhYlNpemUpITtcblx0XHRcdHJlc3VsdCA9IE1hdGgubWluKHJlc3VsdCwgdmlzaWJsZUNvbHVtbik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQnJhY2tldEFzdE5vZGUgZXh0ZW5kcyBJbW11dGFibGVMZWFmQXN0Tm9kZSB7XG5cdHB1YmxpYyBzdGF0aWMgY3JlYXRlKFxuXHRcdGxlbmd0aDogTGVuZ3RoLFxuXHRcdGJyYWNrZXRJbmZvOiBCcmFja2V0S2luZCxcblx0XHRicmFja2V0SWRzOiBTbWFsbEltbXV0YWJsZVNldDxPcGVuaW5nQnJhY2tldElkPlxuXHQpOiBCcmFja2V0QXN0Tm9kZSB7XG5cdFx0Y29uc3Qgbm9kZSA9IG5ldyBCcmFja2V0QXN0Tm9kZShsZW5ndGgsIGJyYWNrZXRJbmZvLCBicmFja2V0SWRzKTtcblx0XHRyZXR1cm4gbm9kZTtcblx0fVxuXG5cdHB1YmxpYyBnZXQga2luZCgpOiBBc3ROb2RlS2luZC5CcmFja2V0IHtcblx0XHRyZXR1cm4gQXN0Tm9kZUtpbmQuQnJhY2tldDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgbWlzc2luZ09wZW5pbmdCcmFja2V0SWRzKCk6IFNtYWxsSW1tdXRhYmxlU2V0PE9wZW5pbmdCcmFja2V0SWQ+IHtcblx0XHRyZXR1cm4gU21hbGxJbW11dGFibGVTZXQuZ2V0RW1wdHkoKTtcblx0fVxuXG5cdHByaXZhdGUgY29uc3RydWN0b3IoXG5cdFx0bGVuZ3RoOiBMZW5ndGgsXG5cdFx0cHVibGljIHJlYWRvbmx5IGJyYWNrZXRJbmZvOiBCcmFja2V0S2luZCxcblx0XHQvKipcblx0XHQgKiBJbiBjYXNlIG9mIGEgb3BlbmluZyBicmFja2V0LCB0aGlzIGlzIHRoZSBpZCBvZiB0aGUgb3BlbmluZyBicmFja2V0LlxuXHRcdCAqIEluIGNhc2Ugb2YgYSBjbG9zaW5nIGJyYWNrZXQsIHRoaXMgY29udGFpbnMgdGhlIGlkcyBvZiBhbGwgb3BlbmluZyBicmFja2V0cyBpdCBjYW4gY2xvc2UuXG5cdFx0Ki9cblx0XHRwdWJsaWMgcmVhZG9ubHkgYnJhY2tldElkczogU21hbGxJbW11dGFibGVTZXQ8T3BlbmluZ0JyYWNrZXRJZD5cblx0KSB7XG5cdFx0c3VwZXIobGVuZ3RoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgdGV4dCgpIHtcblx0XHRyZXR1cm4gdGhpcy5icmFja2V0SW5mby5icmFja2V0VGV4dDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgbGFuZ3VhZ2VJZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5icmFja2V0SW5mby5sYW5ndWFnZUlkO1xuXHR9XG5cblx0cHVibGljIGNhbkJlUmV1c2VkKF9vcGVuZWRCcmFja2V0SWRzOiBTbWFsbEltbXV0YWJsZVNldDxPcGVuaW5nQnJhY2tldElkPikge1xuXHRcdC8vIFRoZXNlIG5vZGVzIGNvdWxkIGJlIHJldXNlZCxcblx0XHQvLyBidXQgbm90IGluIGEgZ2VuZXJhbCB3YXkuXG5cdFx0Ly8gVGhlaXIgcGFyZW50IG1heSBiZSByZXVzZWQuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHVibGljIGNvbXB1dGVNaW5JbmRlbnRhdGlvbihvZmZzZXQ6IExlbmd0aCwgdGV4dE1vZGVsOiBJVGV4dE1vZGVsKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEludmFsaWRCcmFja2V0QXN0Tm9kZSBleHRlbmRzIEltbXV0YWJsZUxlYWZBc3ROb2RlIHtcblx0cHVibGljIGdldCBraW5kKCk6IEFzdE5vZGVLaW5kLlVuZXhwZWN0ZWRDbG9zaW5nQnJhY2tldCB7XG5cdFx0cmV0dXJuIEFzdE5vZGVLaW5kLlVuZXhwZWN0ZWRDbG9zaW5nQnJhY2tldDtcblx0fVxuXG5cdHB1YmxpYyByZWFkb25seSBtaXNzaW5nT3BlbmluZ0JyYWNrZXRJZHM6IFNtYWxsSW1tdXRhYmxlU2V0PE9wZW5pbmdCcmFja2V0SWQ+O1xuXG5cdHB1YmxpYyBjb25zdHJ1Y3RvcihjbG9zaW5nQnJhY2tldHM6IFNtYWxsSW1tdXRhYmxlU2V0PE9wZW5pbmdCcmFja2V0SWQ+LCBsZW5ndGg6IExlbmd0aCkge1xuXHRcdHN1cGVyKGxlbmd0aCk7XG5cdFx0dGhpcy5taXNzaW5nT3BlbmluZ0JyYWNrZXRJZHMgPSBjbG9zaW5nQnJhY2tldHM7XG5cdH1cblxuXHRwdWJsaWMgY2FuQmVSZXVzZWQob3BlbmVkQnJhY2tldElkczogU21hbGxJbW11dGFibGVTZXQ8T3BlbmluZ0JyYWNrZXRJZD4pIHtcblx0XHRyZXR1cm4gIW9wZW5lZEJyYWNrZXRJZHMuaW50ZXJzZWN0cyh0aGlzLm1pc3NpbmdPcGVuaW5nQnJhY2tldElkcyk7XG5cdH1cblxuXHRwdWJsaWMgY29tcHV0ZU1pbkluZGVudGF0aW9uKG9mZnNldDogTGVuZ3RoLCB0ZXh0TW9kZWw6IElUZXh0TW9kZWwpOiBudW1iZXIge1xuXHRcdHJldHVybiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUjtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxxQkFBcUI7QUFHOUIsU0FBaUIsV0FBVyxvQkFBb0IsYUFBYSxrQkFBa0I7QUFDL0UsU0FBUyx5QkFBeUI7QUFHM0IsSUFBVyxjQUFYLGtCQUFXQSxpQkFBWDtBQUNOLEVBQUFBLDBCQUFBLFVBQU8sS0FBUDtBQUNBLEVBQUFBLDBCQUFBLGFBQVUsS0FBVjtBQUNBLEVBQUFBLDBCQUFBLFVBQU8sS0FBUDtBQUNBLEVBQUFBLDBCQUFBLDhCQUEyQixLQUEzQjtBQUNBLEVBQUFBLDBCQUFBLFVBQU8sS0FBUDtBQUxpQixTQUFBQTtBQUFBLEdBQUE7QUFhbEIsTUFBZSxZQUFZO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUErQjFCLElBQVcsU0FBaUI7QUFDM0IsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRU8sWUFBWSxRQUFnQjtBQUNsQyxTQUFLLFVBQVU7QUFBQSxFQUNoQjtBQW9CRDtBQU9PLE1BQU0sb0JBQW9CLFlBQVk7QUFBQSxFQWlEcEMsWUFDUCxRQUNnQixnQkFDQSxPQUNBLGdCQUNBLDBCQUNmO0FBQ0QsVUFBTSxNQUFNO0FBTEk7QUFDQTtBQUNBO0FBQ0E7QUFBQSxFQUdqQjtBQUFBLEVBeERBLE9BQWMsT0FDYixnQkFDQSxPQUNBLGdCQUNDO0FBQ0QsUUFBSSxTQUFTLGVBQWU7QUFDNUIsUUFBSSxPQUFPO0FBQ1YsZUFBUyxVQUFVLFFBQVEsTUFBTSxNQUFNO0FBQUEsSUFDeEM7QUFDQSxRQUFJLGdCQUFnQjtBQUNuQixlQUFTLFVBQVUsUUFBUSxlQUFlLE1BQU07QUFBQSxJQUNqRDtBQUNBLFdBQU8sSUFBSSxZQUFZLFFBQVEsZ0JBQWdCLE9BQU8sZ0JBQWdCLFFBQVEsTUFBTSwyQkFBMkIsa0JBQWtCLFNBQVMsQ0FBQztBQUFB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
