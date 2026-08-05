class ListNode {
  constructor(height) {
    this.height = height;
    this._children = [];
    this._length = 0;
  }
  get children() {
    return this._children;
  }
  get length() {
    return this._length;
  }
  static create(node1, node2) {
    const list = new ListNode(node1.height + 1);
    list.appendChild(node1);
    list.appendChild(node2);
    return list;
  }
  canAppendChild() {
    return this._children.length < 3;
  }
  appendChild(node) {
    if (!this.canAppendChild()) {
      throw new Error("Cannot insert more than 3 children in a ListNode");
    }
    this._children.push(node);
    this._length += node.length;
    this._updateParentLength(node.length);
    if (!isLeaf(node)) {
      node.parent = this;
    }
  }
  _updateParentLength(delta) {
    let updateParent = this.parent;
    while (updateParent) {
      updateParent._length += delta;
      updateParent = updateParent.parent;
    }
  }
  unappendChild() {
    const child = this._children.pop();
    this._length -= child.length;
    this._updateParentLength(-child.length);
    return child;
  }
  prependChild(node) {
    if (this._children.length >= 3) {
      throw new Error("Cannot prepend more than 3 children in a ListNode");
    }
    this._children.unshift(node);
    this._length += node.length;
    this._updateParentLength(node.length);
    if (!isLeaf(node)) {
      node.parent = this;
    }
  }
  unprependChild() {
    const child = this._children.shift();
    this._length -= child.length;
    this._updateParentLength(-child.length);
    return child;
  }
  lastChild() {
    return this._children[this._children.length - 1];
  }
  dispose() {
    this._children.splice(0, this._children.length);
  }
}
var TokenQuality = /* @__PURE__ */ ((TokenQuality2) => {
  TokenQuality2[TokenQuality2["None"] = 0] = "None";
  TokenQuality2[TokenQuality2["ViewportGuess"] = 1] = "ViewportGuess";
  TokenQuality2[TokenQuality2["EditGuess"] = 2] = "EditGuess";
  TokenQuality2[TokenQuality2["Accurate"] = 3] = "Accurate";
  return TokenQuality2;
})(TokenQuality || {});
function isLeaf(node) {
  return node.token !== void 0;
}
function append(node, nodeToAppend) {
  let curNode = node;
  const parents = [];
  let nodeToAppendOfCorrectHeight;
  while (true) {
    if (nodeToAppend.height === curNode.height) {
      nodeToAppendOfCorrectHeight = nodeToAppend;
      break;
    }
    if (isLeaf(curNode)) {
      throw new Error("unexpected");
    }
    parents.push(curNode);
    curNode = curNode.lastChild();
  }
  for (let i = parents.length - 1; i >= 0; i--) {
    const parent = parents[i];
    if (nodeToAppendOfCorrectHeight) {
      if (parent.children.length >= 3) {
        const newList = ListNode.create(parent.unappendChild(), nodeToAppendOfCorrectHeight);
        nodeToAppendOfCorrectHeight = newList;
      } else {
        parent.appendChild(nodeToAppendOfCorrectHeight);
        nodeToAppendOfCorrectHeight = void 0;
      }
    }
  }
  if (nodeToAppendOfCorrectHeight) {
    const newList = new ListNode(nodeToAppendOfCorrectHeight.height + 1);
    newList.appendChild(node);
    newList.appendChild(nodeToAppendOfCorrectHeight);
    return newList;
  } else {
    return node;
  }
}
function prepend(list, nodeToAppend) {
  let curNode = list;
  const parents = [];
  while (nodeToAppend.height !== curNode.height) {
    if (isLeaf(curNode)) {
      throw new Error("unexpected");
    }
    parents.push(curNode);
    curNode = curNode.children[0];
  }
  let nodeToPrependOfCorrectHeight = nodeToAppend;
  for (let i = parents.length - 1; i >= 0; i--) {
    const parent = parents[i];
    if (nodeToPrependOfCorrectHeight) {
      if (parent.children.length >= 3) {
        nodeToPrependOfCorrectHeight = ListNode.create(nodeToPrependOfCorrectHeight, parent.unprependChild());
      } else {
        parent.prependChild(nodeToPrependOfCorrectHeight);
        nodeToPrependOfCorrectHeight = void 0;
      }
    }
  }
  if (nodeToPrependOfCorrectHeight) {
    return ListNode.create(nodeToPrependOfCorrectHeight, list);
  } else {
    return list;
  }
}
function concat(node1, node2) {
  if (node1.height === node2.height) {
    return ListNode.create(node1, node2);
  } else if (node1.height > node2.height) {
    return append(node1, node2);
  } else {
    return prepend(node2, node1);
  }
}
class TokenStore {
  constructor(_textModel) {
    this._textModel = _textModel;
    this._root = this.createEmptyRoot();
  }
  get root() {
    return this._root;
  }
  createEmptyRoot() {
    return {
      length: this._textModel.getValueLength(),
      token: 0,
      height: 0,
      tokenQuality: 0 /* None */
    };
  }
  /**
   *
   * @param update all the tokens for the document in sequence
   */
  buildStore(tokens, tokenQuality) {
    this._root = this.createFromUpdates(tokens, tokenQuality);
  }
  createFromUpdates(tokens, tokenQuality) {
    if (tokens.length === 0) {
      return this.createEmptyRoot();
    }
    let newRoot = {
      length: tokens[0].length,
      token: tokens[0].token,
      height: 0,
      tokenQuality
    };
    for (let j = 1; j < tokens.length; j++) {
      newRoot = append(newRoot, { length: tokens[j].length, token: tokens[j].token, height: 0, tokenQuality });
    }
    return newRoot;
  }
  /**
   *
   * @param tokens tokens are in sequence in the document.
   */
  update(length, tokens, tokenQuality) {
    if (tokens.length === 0) {
      return;
    }
    this.replace(length, tokens[0].startOffsetInclusive, tokens, tokenQuality);
  }
  delete(length, startOffset) {
    this.replace(length, startOffset, [], 2 /* EditGuess */);
  }
  /**
   *
   * @param tokens tokens are in sequence in the document.
   */
  replace(length, updateOffsetStart, tokens, tokenQuality) {
    const firstUnchangedOffsetAfterUpdate = updateOffsetStart + length;
    const precedingNodes = [];
    const postcedingNodes = [];
    const stack = [{ node: this._root, offset: 0 }];
    while (stack.length > 0) {
      const node = stack.pop();
      const currentOffset = node.offset;
      if (currentOffset < updateOffsetStart && currentOffset + node.node.length <= updateOffsetStart) {
        if (!isLeaf(node.node)) {
          node.node.parent = void 0;
        }
        precedingNodes.push(node.node);
        continue;
      } else if (isLeaf(node.node) && currentOffset < updateOffsetStart) {
        precedingNodes.push({ length: updateOffsetStart - currentOffset, token: node.node.token, height: 0, tokenQuality: node.node.tokenQuality });
      }
      if (updateOffsetStart <= currentOffset && currentOffset + node.node.length <= firstUnchangedOffsetAfterUpdate) {
        continue;
      }
      if (currentOffset >= firstUnchangedOffsetAfterUpdate) {
        if (!isLeaf(node.node)) {
          node.node.parent = void 0;
        }
        postcedingNodes.push(node.node);
        continue;
      } else if (isLeaf(node.node) && currentOffset + node.node.length > firstUnchangedOffsetAfterUpdate) {
        postcedingNodes.push({ length: currentOffset + node.node.length - firstUnchangedOffsetAfterUpdate, token: node.node.token, height: 0, tokenQuality: node.node.tokenQuality });
        continue;
      }
      if (!isLeaf(node.node)) {
        let childOffset = currentOffset + node.node.length;
        for (let i = node.node.children.length - 1; i >= 0; i--) {
          childOffset -= node.node.children[i].length;
          stack.push({ node: node.node.children[i], offset: childOffset });
        }
      }
    }
    let allNodes;
    if (tokens.length > 0) {
      allNodes = precedingNodes.concat(this.createFromUpdates(tokens, tokenQuality), postcedingNodes);
    } else {
      allNodes = precedingNodes.concat(postcedingNodes);
    }
    let newRoot = allNodes[0];
    for (let i = 1; i < allNodes.length; i++) {
      newRoot = concat(newRoot, allNodes[i]);
    }
    this._root = newRoot ?? this.createEmptyRoot();
  }
  /**
   *
   * @param startOffsetInclusive
   * @param endOffsetExclusive
   * @param visitor Return true from visitor to exit early
   * @returns
   */
  traverseInOrderInRange(startOffsetInclusive, endOffsetExclusive, visitor) {
    const stack = [{ node: this._root, offset: 0 }];
    while (stack.length > 0) {
      const { node, offset } = stack.pop();
      const nodeEnd = offset + node.length;
      if (nodeEnd <= startOffsetInclusive || offset >= endOffsetExclusive) {
        continue;
      }
      if (visitor(node, offset)) {
        return;
      }
      if (!isLeaf(node)) {
        let childOffset = offset + node.length;
        for (let i = node.children.length - 1; i >= 0; i--) {
          childOffset -= node.children[i].length;
          stack.push({ node: node.children[i], offset: childOffset });
        }
      }
    }
  }
  getTokenAt(offset) {
    let result;
    this.traverseInOrderInRange(offset, this._root.length, (node, offset2) => {
      if (isLeaf(node)) {
        result = { token: node.token, startOffsetInclusive: offset2, length: node.length };
        return true;
      }
      return false;
    });
    return result;
  }
  getTokensInRange(startOffsetInclusive, endOffsetExclusive) {
    const result = [];
    this.traverseInOrderInRange(startOffsetInclusive, endOffsetExclusive, (node, offset) => {
      if (isLeaf(node)) {
        let clippedLength = node.length;
        let clippedOffset = offset;
        if (offset < startOffsetInclusive && offset + node.length > endOffsetExclusive) {
          clippedOffset = startOffsetInclusive;
          clippedLength = endOffsetExclusive - startOffsetInclusive;
        } else if (offset < startOffsetInclusive) {
          clippedLength -= startOffsetInclusive - offset;
          clippedOffset = startOffsetInclusive;
        } else if (offset + node.length > endOffsetExclusive) {
          clippedLength -= offset + node.length - endOffsetExclusive;
        }
        result.push({ token: node.token, startOffsetInclusive: clippedOffset, length: clippedLength });
      }
      return false;
    });
    return result;
  }
  markForRefresh(startOffsetInclusive, endOffsetExclusive) {
    this.traverseInOrderInRange(startOffsetInclusive, endOffsetExclusive, (node) => {
      if (isLeaf(node)) {
        node.tokenQuality = 0 /* None */;
      }
      return false;
    });
  }
  rangeHasTokens(startOffsetInclusive, endOffsetExclusive, minimumTokenQuality) {
    let hasAny = true;
    this.traverseInOrderInRange(startOffsetInclusive, endOffsetExclusive, (node) => {
      if (isLeaf(node) && node.tokenQuality < minimumTokenQuality) {
        hasAny = false;
      }
      return false;
    });
    return hasAny;
  }
  rangeNeedsRefresh(startOffsetInclusive, endOffsetExclusive) {
    let needsRefresh = false;
    this.traverseInOrderInRange(startOffsetInclusive, endOffsetExclusive, (node) => {
      if (isLeaf(node) && node.tokenQuality !== 3 /* Accurate */) {
        needsRefresh = true;
      }
      return false;
    });
    return needsRefresh;
  }
  getNeedsRefresh() {
    const result = [];
    this.traverseInOrderInRange(0, this._textModel.getValueLength(), (node, offset) => {
      if (isLeaf(node) && node.tokenQuality !== 3 /* Accurate */) {
        if (result.length > 0 && result[result.length - 1].endOffset === offset) {
          result[result.length - 1].endOffset += node.length;
        } else {
          result.push({ startOffset: offset, endOffset: offset + node.length });
        }
      }
      return false;
    });
    return result;
  }
  deepCopy() {
    const newStore = new TokenStore(this._textModel);
    newStore._root = this._copyNodeIterative(this._root);
    return newStore;
  }
  _copyNodeIterative(root) {
    const newRoot = isLeaf(root) ? { length: root.length, token: root.token, tokenQuality: root.tokenQuality, height: root.height } : new ListNode(root.height);
    const stack = [[root, newRoot]];
    while (stack.length > 0) {
      const [oldNode, clonedNode] = stack.pop();
      if (!isLeaf(oldNode)) {
        for (const child of oldNode.children) {
          const childCopy = isLeaf(child) ? { length: child.length, token: child.token, tokenQuality: child.tokenQuality, height: child.height } : new ListNode(child.height);
          clonedNode.appendChild(childCopy);
          stack.push([child, childCopy]);
        }
      }
    }
    return newRoot;
  }
  /**
   * Returns a string representation of the token tree using an iterative approach
   */
  printTree(root = this._root) {
    const result = [];
    const stack = [[root, 0]];
    while (stack.length > 0) {
      const [node, depth] = stack.pop();
      const indent = "  ".repeat(depth);
      if (isLeaf(node)) {
        result.push(`${indent}Leaf(length: ${node.length}, token: ${node.token}, refresh: ${node.tokenQuality})
`);
      } else {
        result.push(`${indent}List(length: ${node.length})
`);
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push([node.children[i], depth + 1]);
        }
      }
    }
    return result.join("");
  }
  dispose() {
    const stack = [[this._root, false]];
    while (stack.length > 0) {
      const [node, visited] = stack.pop();
      if (isLeaf(node)) {
      } else if (!visited) {
        stack.push([node, true]);
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push([node.children[i], false]);
        }
      } else {
        node.dispose();
        node.parent = void 0;
      }
    }
    this._root = void 0;
  }
}
export {
  TokenQuality,
  TokenStore
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL21vZGVsL3Rva2VuU3RvcmUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vbW9kZWwuanMnO1xuXG5jbGFzcyBMaXN0Tm9kZSBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblx0cGFyZW50PzogTGlzdE5vZGU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NoaWxkcmVuOiBOb2RlW10gPSBbXTtcblx0Z2V0IGNoaWxkcmVuKCk6IFJlYWRvbmx5QXJyYXk8Tm9kZT4geyByZXR1cm4gdGhpcy5fY2hpbGRyZW47IH1cblxuXHRwcml2YXRlIF9sZW5ndGg6IG51bWJlciA9IDA7XG5cdGdldCBsZW5ndGgoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX2xlbmd0aDsgfVxuXG5cdGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBoZWlnaHQ6IG51bWJlcikgeyB9XG5cblx0c3RhdGljIGNyZWF0ZShub2RlMTogTm9kZSwgbm9kZTI6IE5vZGUpIHtcblx0XHRjb25zdCBsaXN0ID0gbmV3IExpc3ROb2RlKG5vZGUxLmhlaWdodCArIDEpO1xuXHRcdGxpc3QuYXBwZW5kQ2hpbGQobm9kZTEpO1xuXHRcdGxpc3QuYXBwZW5kQ2hpbGQobm9kZTIpO1xuXHRcdHJldHVybiBsaXN0O1xuXHR9XG5cblx0Y2FuQXBwZW5kQ2hpbGQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2NoaWxkcmVuLmxlbmd0aCA8IDM7XG5cdH1cblxuXHRhcHBlbmRDaGlsZChub2RlOiBOb2RlKSB7XG5cdFx0aWYgKCF0aGlzLmNhbkFwcGVuZENoaWxkKCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IGluc2VydCBtb3JlIHRoYW4gMyBjaGlsZHJlbiBpbiBhIExpc3ROb2RlJyk7XG5cdFx0fVxuXHRcdHRoaXMuX2NoaWxkcmVuLnB1c2gobm9kZSk7XG5cblx0XHR0aGlzLl9sZW5ndGggKz0gbm9kZS5sZW5ndGg7XG5cdFx0dGhpcy5fdXBkYXRlUGFyZW50TGVuZ3RoKG5vZGUubGVuZ3RoKTtcblx0XHRpZiAoIWlzTGVhZihub2RlKSkge1xuXHRcdFx0bm9kZS5wYXJlbnQgPSB0aGlzO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVBhcmVudExlbmd0aChkZWx0YTogbnVtYmVyKSB7XG5cdFx0bGV0IHVwZGF0ZVBhcmVudCA9IHRoaXMucGFyZW50O1xuXHRcdHdoaWxlICh1cGRhdGVQYXJlbnQpIHtcblx0XHRcdHVwZGF0ZVBhcmVudC5fbGVuZ3RoICs9IGRlbHRhO1xuXHRcdFx0dXBkYXRlUGFyZW50ID0gdXBkYXRlUGFyZW50LnBhcmVudDtcblx0XHR9XG5cdH1cblxuXHR1bmFwcGVuZENoaWxkKCk6IE5vZGUge1xuXHRcdGNvbnN0IGNoaWxkID0gdGhpcy5fY2hpbGRyZW4ucG9wKCkhO1xuXHRcdHRoaXMuX2xlbmd0aCAtPSBjaGlsZC5sZW5ndGg7XG5cdFx0dGhpcy5fdXBkYXRlUGFyZW50TGVuZ3RoKC1jaGlsZC5sZW5ndGgpO1xuXHRcdHJldHVybiBjaGlsZDtcblx0fVxuXG5cdHByZXBlbmRDaGlsZChub2RlOiBOb2RlKSB7XG5cdFx0aWYgKHRoaXMuX2NoaWxkcmVuLmxlbmd0aCA+PSAzKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBwcmVwZW5kIG1vcmUgdGhhbiAzIGNoaWxkcmVuIGluIGEgTGlzdE5vZGUnKTtcblx0XHR9XG5cdFx0dGhpcy5fY2hpbGRyZW4udW5zaGlmdChub2RlKTtcblxuXHRcdHRoaXMuX2xlbmd0aCArPSBub2RlLmxlbmd0aDtcblx0XHR0aGlzLl91cGRhdGVQYXJlbnRMZW5ndGgobm9kZS5sZW5ndGgpO1xuXHRcdGlmICghaXNMZWFmKG5vZGUpKSB7XG5cdFx0XHRub2RlLnBhcmVudCA9IHRoaXM7XG5cdFx0fVxuXHR9XG5cblx0dW5wcmVwZW5kQ2hpbGQoKTogTm9kZSB7XG5cdFx0Y29uc3QgY2hpbGQgPSB0aGlzLl9jaGlsZHJlbi5zaGlmdCgpITtcblx0XHR0aGlzLl9sZW5ndGggLT0gY2hpbGQubGVuZ3RoO1xuXHRcdHRoaXMuX3VwZGF0ZVBhcmVudExlbmd0aCgtY2hpbGQubGVuZ3RoKTtcblx0XHRyZXR1cm4gY2hpbGQ7XG5cdH1cblxuXHRsYXN0Q2hpbGQoKTogTm9kZSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NoaWxkcmVuW3RoaXMuX2NoaWxkcmVuLmxlbmd0aCAtIDFdO1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9jaGlsZHJlbi5zcGxpY2UoMCwgdGhpcy5fY2hpbGRyZW4ubGVuZ3RoKTtcblx0fVxufVxuXG5leHBvcnQgZW51bSBUb2tlblF1YWxpdHkge1xuXHROb25lID0gMCxcblx0Vmlld3BvcnRHdWVzcyA9IDEsXG5cdEVkaXRHdWVzcyA9IDIsXG5cdEFjY3VyYXRlID0gM1xufVxuXG50eXBlIE5vZGUgPSBMaXN0Tm9kZSB8IExlYWZOb2RlO1xuXG5pbnRlcmZhY2UgTGVhZk5vZGUge1xuXHRyZWFkb25seSBsZW5ndGg6IG51bWJlcjtcblx0dG9rZW46IG51bWJlcjtcblx0dG9rZW5RdWFsaXR5OiBUb2tlblF1YWxpdHk7XG5cdGhlaWdodDogMDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUb2tlblVwZGF0ZSB7XG5cdHJlYWRvbmx5IHN0YXJ0T2Zmc2V0SW5jbHVzaXZlOiBudW1iZXI7XG5cdHJlYWRvbmx5IGxlbmd0aDogbnVtYmVyO1xuXHRyZWFkb25seSB0b2tlbjogbnVtYmVyO1xufVxuXG5mdW5jdGlvbiBpc0xlYWYobm9kZTogTm9kZSk6IG5vZGUgaXMgTGVhZk5vZGUge1xuXHRyZXR1cm4gKG5vZGUgYXMgTGVhZk5vZGUpLnRva2VuICE9PSB1bmRlZmluZWQ7XG59XG5cbi8vIEhlYXZpbHkgaW5zcGlyZWQgYnkgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvYmxvYi80ZWIyNjU4ZDU5MmNiNjExNGE3YTM5MzY1NTU3NDE3NmNjNzkwYzViL3NyYy92cy9lZGl0b3IvY29tbW9uL21vZGVsL2JyYWNrZXRQYWlyc1RleHRNb2RlbFBhcnQvYnJhY2tldFBhaXJzVHJlZS9jb25jYXQyM1RyZWVzLnRzI0wxMDgtTDEwOVxuZnVuY3Rpb24gYXBwZW5kKG5vZGU6IE5vZGUsIG5vZGVUb0FwcGVuZDogTm9kZSk6IE5vZGUge1xuXHRsZXQgY3VyTm9kZSA9IG5vZGU7XG5cdGNvbnN0IHBhcmVudHM6IExpc3ROb2RlW10gPSBbXTtcblx0bGV0IG5vZGVUb0FwcGVuZE9mQ29ycmVjdEhlaWdodDogTm9kZSB8IHVuZGVmaW5lZDtcblx0d2hpbGUgKHRydWUpIHtcblx0XHRpZiAobm9kZVRvQXBwZW5kLmhlaWdodCA9PT0gY3VyTm9kZS5oZWlnaHQpIHtcblx0XHRcdG5vZGVUb0FwcGVuZE9mQ29ycmVjdEhlaWdodCA9IG5vZGVUb0FwcGVuZDtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdGlmIChpc0xlYWYoY3VyTm9kZSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcigndW5leHBlY3RlZCcpO1xuXHRcdH1cblx0XHRwYXJlbnRzLnB1c2goY3VyTm9kZSk7XG5cdFx0Y3VyTm9kZSA9IGN1ck5vZGUubGFzdENoaWxkKCk7XG5cdH1cblx0Zm9yIChsZXQgaSA9IHBhcmVudHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRjb25zdCBwYXJlbnQgPSBwYXJlbnRzW2ldO1xuXHRcdGlmIChub2RlVG9BcHBlbmRPZkNvcnJlY3RIZWlnaHQpIHtcblx0XHRcdC8vIENhbiB3ZSB0YWtlIHRoZSBlbGVtZW50P1xuXHRcdFx0aWYgKHBhcmVudC5jaGlsZHJlbi5sZW5ndGggPj0gMykge1xuXHRcdFx0XHQvLyB3ZSBuZWVkIHRvIHNwbGl0IHRvIG1haW50YWluICgyLDMpLXRyZWUgcHJvcGVydHkuXG5cdFx0XHRcdC8vIFNlbmQgdGhlIHRoaXJkIGVsZW1lbnQgKyB0aGUgbmV3IGVsZW1lbnQgdG8gdGhlIHBhcmVudC5cblx0XHRcdFx0Y29uc3QgbmV3TGlzdCA9IExpc3ROb2RlLmNyZWF0ZShwYXJlbnQudW5hcHBlbmRDaGlsZCgpISwgbm9kZVRvQXBwZW5kT2ZDb3JyZWN0SGVpZ2h0KTtcblx0XHRcdFx0bm9kZVRvQXBwZW5kT2ZDb3JyZWN0SGVpZ2h0ID0gbmV3TGlzdDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHBhcmVudC5hcHBlbmRDaGlsZChub2RlVG9BcHBlbmRPZkNvcnJlY3RIZWlnaHQpO1xuXHRcdFx0XHRub2RlVG9BcHBlbmRPZkNvcnJlY3RIZWlnaHQgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGlmIChub2RlVG9BcHBlbmRPZkNvcnJlY3RIZWlnaHQpIHtcblx0XHRjb25zdCBuZXdMaXN0ID0gbmV3IExpc3ROb2RlKG5vZGVUb0FwcGVuZE9mQ29ycmVjdEhlaWdodC5oZWlnaHQgKyAxKTtcblx0XHRuZXdMaXN0LmFwcGVuZENoaWxkKG5vZGUpO1xuXHRcdG5ld0xpc3QuYXBwZW5kQ2hpbGQobm9kZVRvQXBwZW5kT2ZDb3JyZWN0SGVpZ2h0KTtcblx0XHRyZXR1cm4gbmV3TGlzdDtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gbm9kZTtcblx0fVxufVxuXG5mdW5jdGlvbiBwcmVwZW5kKGxpc3Q6IE5vZGUsIG5vZGVUb0FwcGVuZDogTm9kZSk6IE5vZGUge1xuXHRsZXQgY3VyTm9kZSA9IGxpc3Q7XG5cdGNvbnN0IHBhcmVudHM6IExpc3ROb2RlW10gPSBbXTtcblx0d2hpbGUgKG5vZGVUb0FwcGVuZC5oZWlnaHQgIT09IGN1ck5vZGUuaGVpZ2h0KSB7XG5cdFx0aWYgKGlzTGVhZihjdXJOb2RlKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCd1bmV4cGVjdGVkJyk7XG5cdFx0fVxuXHRcdHBhcmVudHMucHVzaChjdXJOb2RlKTtcblx0XHQvLyBhc3NlcnQgMiA8PSBjdXJOb2RlLmNoaWxkcmVuRmFzdC5sZW5ndGggPD0gM1xuXHRcdGN1ck5vZGUgPSBjdXJOb2RlLmNoaWxkcmVuWzBdIGFzIExpc3ROb2RlO1xuXHR9XG5cdGxldCBub2RlVG9QcmVwZW5kT2ZDb3JyZWN0SGVpZ2h0OiBOb2RlIHwgdW5kZWZpbmVkID0gbm9kZVRvQXBwZW5kO1xuXHQvLyBhc3NlcnQgbm9kZVRvQXBwZW5kT2ZDb3JyZWN0SGVpZ2h0IS5saXN0SGVpZ2h0ID09PSBjdXJOb2RlLmxpc3RIZWlnaHRcblx0Zm9yIChsZXQgaSA9IHBhcmVudHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRjb25zdCBwYXJlbnQgPSBwYXJlbnRzW2ldO1xuXHRcdGlmIChub2RlVG9QcmVwZW5kT2ZDb3JyZWN0SGVpZ2h0KSB7XG5cdFx0XHQvLyBDYW4gd2UgdGFrZSB0aGUgZWxlbWVudD9cblx0XHRcdGlmIChwYXJlbnQuY2hpbGRyZW4ubGVuZ3RoID49IDMpIHtcblx0XHRcdFx0Ly8gd2UgbmVlZCB0byBzcGxpdCB0byBtYWludGFpbiAoMiwzKS10cmVlIHByb3BlcnR5LlxuXHRcdFx0XHQvLyBTZW5kIHRoZSB0aGlyZCBlbGVtZW50ICsgdGhlIG5ldyBlbGVtZW50IHRvIHRoZSBwYXJlbnQuXG5cdFx0XHRcdG5vZGVUb1ByZXBlbmRPZkNvcnJlY3RIZWlnaHQgPSBMaXN0Tm9kZS5jcmVhdGUobm9kZVRvUHJlcGVuZE9mQ29ycmVjdEhlaWdodCwgcGFyZW50LnVucHJlcGVuZENoaWxkKCkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cGFyZW50LnByZXBlbmRDaGlsZChub2RlVG9QcmVwZW5kT2ZDb3JyZWN0SGVpZ2h0KTtcblx0XHRcdFx0bm9kZVRvUHJlcGVuZE9mQ29ycmVjdEhlaWdodCA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0aWYgKG5vZGVUb1ByZXBlbmRPZkNvcnJlY3RIZWlnaHQpIHtcblx0XHRyZXR1cm4gTGlzdE5vZGUuY3JlYXRlKG5vZGVUb1ByZXBlbmRPZkNvcnJlY3RIZWlnaHQsIGxpc3QpO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBsaXN0O1xuXHR9XG59XG5cbmZ1bmN0aW9uIGNvbmNhdChub2RlMTogTm9kZSwgbm9kZTI6IE5vZGUpOiBOb2RlIHtcblx0aWYgKG5vZGUxLmhlaWdodCA9PT0gbm9kZTIuaGVpZ2h0KSB7XG5cdFx0cmV0dXJuIExpc3ROb2RlLmNyZWF0ZShub2RlMSwgbm9kZTIpO1xuXHR9XG5cdGVsc2UgaWYgKG5vZGUxLmhlaWdodCA+IG5vZGUyLmhlaWdodCkge1xuXHRcdC8vIG5vZGUxIGlzIHRoZSB0cmVlIHdlIHdhbnQgdG8gaW5zZXJ0IGludG9cblx0XHRyZXR1cm4gYXBwZW5kKG5vZGUxLCBub2RlMik7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIHByZXBlbmQobm9kZTIsIG5vZGUxKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVG9rZW5TdG9yZSBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBfcm9vdDogTm9kZTtcblx0Z2V0IHJvb3QoKTogTm9kZSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Jvb3Q7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IF90ZXh0TW9kZWw6IElUZXh0TW9kZWwpIHtcblx0XHR0aGlzLl9yb290ID0gdGhpcy5jcmVhdGVFbXB0eVJvb3QoKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlRW1wdHlSb290KCk6IE5vZGUge1xuXHRcdHJldHVybiB7XG5cdFx0XHRsZW5ndGg6IHRoaXMuX3RleHRNb2RlbC5nZXRWYWx1ZUxlbmd0aCgpLFxuXHRcdFx0dG9rZW46IDAsXG5cdFx0XHRoZWlnaHQ6IDAsXG5cdFx0XHR0b2tlblF1YWxpdHk6IFRva2VuUXVhbGl0eS5Ob25lXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0gdXBkYXRlIGFsbCB0aGUgdG9rZW5zIGZvciB0aGUgZG9jdW1lbnQgaW4gc2VxdWVuY2Vcblx0ICovXG5cdGJ1aWxkU3RvcmUodG9rZW5zOiBUb2tlblVwZGF0ZVtdLCB0b2tlblF1YWxpdHk6IFRva2VuUXVhbGl0eSk6IHZvaWQge1xuXHRcdHRoaXMuX3Jvb3QgPSB0aGlzLmNyZWF0ZUZyb21VcGRhdGVzKHRva2VucywgdG9rZW5RdWFsaXR5KTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlRnJvbVVwZGF0ZXModG9rZW5zOiBUb2tlblVwZGF0ZVtdLCB0b2tlblF1YWxpdHk6IFRva2VuUXVhbGl0eSk6IE5vZGUge1xuXHRcdGlmICh0b2tlbnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jcmVhdGVFbXB0eVJvb3QoKTtcblx0XHR9XG5cdFx0bGV0IG5ld1Jvb3Q6IE5vZGUgPSB7XG5cdFx0XHRsZW5ndGg6IHRva2Vuc1swXS5sZW5ndGgsXG5cdFx0XHR0b2tlbjogdG9rZW5zWzBdLnRva2VuLFxuXHRcdFx0aGVpZ2h0OiAwLFxuXHRcdFx0dG9rZW5RdWFsaXR5XG5cdFx0fTtcblx0XHRmb3IgKGxldCBqID0gMTsgaiA8IHRva2Vucy5sZW5ndGg7IGorKykge1xuXHRcdFx0bmV3Um9vdCA9IGFwcGVuZChuZXdSb290LCB7IGxlbmd0aDogdG9rZW5zW2pdLmxlbmd0aCwgdG9rZW46IHRva2Vuc1tqXS50b2tlbiwgaGVpZ2h0OiAwLCB0b2tlblF1YWxpdHkgfSk7XG5cdFx0fVxuXHRcdHJldHVybiBuZXdSb290O1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB0b2tlbnMgdG9rZW5zIGFyZSBpbiBzZXF1ZW5jZSBpbiB0aGUgZG9jdW1lbnQuXG5cdCAqL1xuXHR1cGRhdGUobGVuZ3RoOiBudW1iZXIsIHRva2VuczogVG9rZW5VcGRhdGVbXSwgdG9rZW5RdWFsaXR5OiBUb2tlblF1YWxpdHkpIHtcblx0XHRpZiAodG9rZW5zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnJlcGxhY2UobGVuZ3RoLCB0b2tlbnNbMF0uc3RhcnRPZmZzZXRJbmNsdXNpdmUsIHRva2VucywgdG9rZW5RdWFsaXR5KTtcblx0fVxuXG5cdGRlbGV0ZShsZW5ndGg6IG51bWJlciwgc3RhcnRPZmZzZXQ6IG51bWJlcikge1xuXHRcdHRoaXMucmVwbGFjZShsZW5ndGgsIHN0YXJ0T2Zmc2V0LCBbXSwgVG9rZW5RdWFsaXR5LkVkaXRHdWVzcyk7XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHRva2VucyB0b2tlbnMgYXJlIGluIHNlcXVlbmNlIGluIHRoZSBkb2N1bWVudC5cblx0ICovXG5cdHByaXZhdGUgcmVwbGFjZShsZW5ndGg6IG51bWJlciwgdXBkYXRlT2Zmc2V0U3RhcnQ6IG51bWJlciwgdG9rZW5zOiBUb2tlblVwZGF0ZVtdLCB0b2tlblF1YWxpdHk6IFRva2VuUXVhbGl0eSkge1xuXHRcdGNvbnN0IGZpcnN0VW5jaGFuZ2VkT2Zmc2V0QWZ0ZXJVcGRhdGUgPSB1cGRhdGVPZmZzZXRTdGFydCArIGxlbmd0aDtcblx0XHQvLyBGaW5kIHRoZSBsYXN0IHVuY2hhbmdlZCBub2RlIHByZWNlZGluZyB0aGUgdXBkYXRlXG5cdFx0Y29uc3QgcHJlY2VkaW5nTm9kZXM6IE5vZGVbXSA9IFtdO1xuXHRcdC8vIEZpbmQgdGhlIGZpcnN0IHVuY2hhbmdlZCBub2RlIGFmdGVyIHRoZSB1cGRhdGVcblx0XHRjb25zdCBwb3N0Y2VkaW5nTm9kZXM6IE5vZGVbXSA9IFtdO1xuXHRcdGNvbnN0IHN0YWNrOiB7IG5vZGU6IE5vZGU7IG9mZnNldDogbnVtYmVyIH1bXSA9IFt7IG5vZGU6IHRoaXMuX3Jvb3QsIG9mZnNldDogMCB9XTtcblxuXHRcdHdoaWxlIChzdGFjay5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBub2RlID0gc3RhY2sucG9wKCkhO1xuXHRcdFx0Y29uc3QgY3VycmVudE9mZnNldCA9IG5vZGUub2Zmc2V0O1xuXG5cdFx0XHRpZiAoY3VycmVudE9mZnNldCA8IHVwZGF0ZU9mZnNldFN0YXJ0ICYmIGN1cnJlbnRPZmZzZXQgKyBub2RlLm5vZGUubGVuZ3RoIDw9IHVwZGF0ZU9mZnNldFN0YXJ0KSB7XG5cdFx0XHRcdGlmICghaXNMZWFmKG5vZGUubm9kZSkpIHtcblx0XHRcdFx0XHRub2RlLm5vZGUucGFyZW50ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHByZWNlZGluZ05vZGVzLnB1c2gobm9kZS5ub2RlKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9IGVsc2UgaWYgKGlzTGVhZihub2RlLm5vZGUpICYmIChjdXJyZW50T2Zmc2V0IDwgdXBkYXRlT2Zmc2V0U3RhcnQpKSB7XG5cdFx0XHRcdC8vIFdlIGhhdmUgYSBwYXJ0aWFsIHByZWNlZGluZyBub2RlXG5cdFx0XHRcdHByZWNlZGluZ05vZGVzLnB1c2goeyBsZW5ndGg6IHVwZGF0ZU9mZnNldFN0YXJ0IC0gY3VycmVudE9mZnNldCwgdG9rZW46IG5vZGUubm9kZS50b2tlbiwgaGVpZ2h0OiAwLCB0b2tlblF1YWxpdHk6IG5vZGUubm9kZS50b2tlblF1YWxpdHkgfSk7XG5cdFx0XHRcdC8vIE5vZGUgY291bGQgYWxzbyBiZSBwb3N0Y2VlZGluZywgc28gZG9uJ3QgY29udGludWVcblx0XHRcdH1cblxuXHRcdFx0aWYgKCh1cGRhdGVPZmZzZXRTdGFydCA8PSBjdXJyZW50T2Zmc2V0KSAmJiAoY3VycmVudE9mZnNldCArIG5vZGUubm9kZS5sZW5ndGggPD0gZmlyc3RVbmNoYW5nZWRPZmZzZXRBZnRlclVwZGF0ZSkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjdXJyZW50T2Zmc2V0ID49IGZpcnN0VW5jaGFuZ2VkT2Zmc2V0QWZ0ZXJVcGRhdGUpIHtcblx0XHRcdFx0aWYgKCFpc0xlYWYobm9kZS5ub2RlKSkge1xuXHRcdFx0XHRcdG5vZGUubm9kZS5wYXJlbnQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0cG9zdGNlZGluZ05vZGVzLnB1c2gobm9kZS5ub2RlKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9IGVsc2UgaWYgKGlzTGVhZihub2RlLm5vZGUpICYmIChjdXJyZW50T2Zmc2V0ICsgbm9kZS5ub2RlLmxlbmd0aCA+IGZpcnN0VW5jaGFuZ2VkT2Zmc2V0QWZ0ZXJVcGRhdGUpKSB7XG5cdFx0XHRcdC8vIHdlIGhhdmUgYSBwYXJ0aWFsIHBvc3RjZWVkaW5nIG5vZGVcblx0XHRcdFx0cG9zdGNlZGluZ05vZGVzLnB1c2goeyBsZW5ndGg6IGN1cnJlbnRPZmZzZXQgKyBub2RlLm5vZGUubGVuZ3RoIC0gZmlyc3RVbmNoYW5nZWRPZmZzZXRBZnRlclVwZGF0ZSwgdG9rZW46IG5vZGUubm9kZS50b2tlbiwgaGVpZ2h0OiAwLCB0b2tlblF1YWxpdHk6IG5vZGUubm9kZS50b2tlblF1YWxpdHkgfSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWlzTGVhZihub2RlLm5vZGUpKSB7XG5cdFx0XHRcdC8vIFB1c2ggY2hpbGRyZW4gaW4gcmV2ZXJzZSBvcmRlciB0byBwcm9jZXNzIHRoZW0gbGVmdC10by1yaWdodCB3aGVuIHBvcHBpbmdcblx0XHRcdFx0bGV0IGNoaWxkT2Zmc2V0ID0gY3VycmVudE9mZnNldCArIG5vZGUubm9kZS5sZW5ndGg7XG5cdFx0XHRcdGZvciAobGV0IGkgPSBub2RlLm5vZGUuY2hpbGRyZW4ubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdFx0XHRjaGlsZE9mZnNldCAtPSBub2RlLm5vZGUuY2hpbGRyZW5baV0ubGVuZ3RoO1xuXHRcdFx0XHRcdHN0YWNrLnB1c2goeyBub2RlOiBub2RlLm5vZGUuY2hpbGRyZW5baV0sIG9mZnNldDogY2hpbGRPZmZzZXQgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgYWxsTm9kZXM6IE5vZGVbXTtcblx0XHRpZiAodG9rZW5zLmxlbmd0aCA+IDApIHtcblx0XHRcdGFsbE5vZGVzID0gcHJlY2VkaW5nTm9kZXMuY29uY2F0KHRoaXMuY3JlYXRlRnJvbVVwZGF0ZXModG9rZW5zLCB0b2tlblF1YWxpdHkpLCBwb3N0Y2VkaW5nTm9kZXMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhbGxOb2RlcyA9IHByZWNlZGluZ05vZGVzLmNvbmNhdChwb3N0Y2VkaW5nTm9kZXMpO1xuXHRcdH1cblx0XHRsZXQgbmV3Um9vdDogTm9kZSA9IGFsbE5vZGVzWzBdO1xuXHRcdGZvciAobGV0IGkgPSAxOyBpIDwgYWxsTm9kZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdG5ld1Jvb3QgPSBjb25jYXQobmV3Um9vdCwgYWxsTm9kZXNbaV0pO1xuXHRcdH1cblxuXHRcdHRoaXMuX3Jvb3QgPSBuZXdSb290ID8/IHRoaXMuY3JlYXRlRW1wdHlSb290KCk7XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHN0YXJ0T2Zmc2V0SW5jbHVzaXZlXG5cdCAqIEBwYXJhbSBlbmRPZmZzZXRFeGNsdXNpdmVcblx0ICogQHBhcmFtIHZpc2l0b3IgUmV0dXJuIHRydWUgZnJvbSB2aXNpdG9yIHRvIGV4aXQgZWFybHlcblx0ICogQHJldHVybnNcblx0ICovXG5cdHByaXZhdGUgdHJhdmVyc2VJbk9yZGVySW5SYW5nZShzdGFydE9mZnNldEluY2x1c2l2ZTogbnVtYmVyLCBlbmRPZmZzZXRFeGNsdXNpdmU6IG51bWJlciwgdmlzaXRvcjogKG5vZGU6IE5vZGUsIG9mZnNldDogbnVtYmVyKSA9PiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RhY2s6IHsgbm9kZTogTm9kZTsgb2Zmc2V0OiBudW1iZXIgfVtdID0gW3sgbm9kZTogdGhpcy5fcm9vdCwgb2Zmc2V0OiAwIH1dO1xuXG5cdFx0d2hpbGUgKHN0YWNrLmxlbmd0aCA+IDApIHtcblx0XHRcdGNvbnN0IHsgbm9kZSwgb2Zmc2V0IH0gPSBzdGFjay5wb3AoKSE7XG5cdFx0XHRjb25zdCBub2RlRW5kID0gb2Zmc2V0ICsgbm9kZS5sZW5ndGg7XG5cblx0XHRcdC8vIFNraXAgbm9kZXMgdGhhdCBhcmUgY29tcGxldGVseSBiZWZvcmUgb3IgYWZ0ZXIgdGhlIHJhbmdlXG5cdFx0XHRpZiAobm9kZUVuZCA8PSBzdGFydE9mZnNldEluY2x1c2l2ZSB8fCBvZmZzZXQgPj0gZW5kT2Zmc2V0RXhjbHVzaXZlKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodmlzaXRvcihub2RlLCBvZmZzZXQpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFpc0xlYWYobm9kZSkpIHtcblx0XHRcdFx0Ly8gUHVzaCBjaGlsZHJlbiBpbiByZXZlcnNlIG9yZGVyIHRvIHByb2Nlc3MgdGhlbSBsZWZ0LXRvLXJpZ2h0IHdoZW4gcG9wcGluZ1xuXHRcdFx0XHRsZXQgY2hpbGRPZmZzZXQgPSBvZmZzZXQgKyBub2RlLmxlbmd0aDtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IG5vZGUuY2hpbGRyZW4ubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdFx0XHRjaGlsZE9mZnNldCAtPSBub2RlLmNoaWxkcmVuW2ldLmxlbmd0aDtcblx0XHRcdFx0XHRzdGFjay5wdXNoKHsgbm9kZTogbm9kZS5jaGlsZHJlbltpXSwgb2Zmc2V0OiBjaGlsZE9mZnNldCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGdldFRva2VuQXQob2Zmc2V0OiBudW1iZXIpOiBUb2tlblVwZGF0ZSB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IHJlc3VsdDogVG9rZW5VcGRhdGUgfCB1bmRlZmluZWQ7XG5cdFx0dGhpcy50cmF2ZXJzZUluT3JkZXJJblJhbmdlKG9mZnNldCwgdGhpcy5fcm9vdC5sZW5ndGgsIChub2RlLCBvZmZzZXQpID0+IHtcblx0XHRcdGlmIChpc0xlYWYobm9kZSkpIHtcblx0XHRcdFx0cmVzdWx0ID0geyB0b2tlbjogbm9kZS50b2tlbiwgc3RhcnRPZmZzZXRJbmNsdXNpdmU6IG9mZnNldCwgbGVuZ3RoOiBub2RlLmxlbmd0aCB9O1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9KTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0Z2V0VG9rZW5zSW5SYW5nZShzdGFydE9mZnNldEluY2x1c2l2ZTogbnVtYmVyLCBlbmRPZmZzZXRFeGNsdXNpdmU6IG51bWJlcik6IFRva2VuVXBkYXRlW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogeyB0b2tlbjogbnVtYmVyOyBzdGFydE9mZnNldEluY2x1c2l2ZTogbnVtYmVyOyBsZW5ndGg6IG51bWJlciB9W10gPSBbXTtcblx0XHR0aGlzLnRyYXZlcnNlSW5PcmRlckluUmFuZ2Uoc3RhcnRPZmZzZXRJbmNsdXNpdmUsIGVuZE9mZnNldEV4Y2x1c2l2ZSwgKG5vZGUsIG9mZnNldCkgPT4ge1xuXHRcdFx0aWYgKGlzTGVhZihub2RlKSkge1xuXHRcdFx0XHRsZXQgY2xpcHBlZExlbmd0aCA9IG5vZGUubGVuZ3RoO1xuXHRcdFx0XHRsZXQgY2xpcHBlZE9mZnNldCA9IG9mZnNldDtcblx0XHRcdFx0aWYgKChvZmZzZXQgPCBzdGFydE9mZnNldEluY2x1c2l2ZSkgJiYgKG9mZnNldCArIG5vZGUubGVuZ3RoID4gZW5kT2Zmc2V0RXhjbHVzaXZlKSkge1xuXHRcdFx0XHRcdGNsaXBwZWRPZmZzZXQgPSBzdGFydE9mZnNldEluY2x1c2l2ZTtcblx0XHRcdFx0XHRjbGlwcGVkTGVuZ3RoID0gZW5kT2Zmc2V0RXhjbHVzaXZlIC0gc3RhcnRPZmZzZXRJbmNsdXNpdmU7XG5cdFx0XHRcdH0gZWxzZSBpZiAob2Zmc2V0IDwgc3RhcnRPZmZzZXRJbmNsdXNpdmUpIHtcblx0XHRcdFx0XHRjbGlwcGVkTGVuZ3RoIC09IChzdGFydE9mZnNldEluY2x1c2l2ZSAtIG9mZnNldCk7XG5cdFx0XHRcdFx0Y2xpcHBlZE9mZnNldCA9IHN0YXJ0T2Zmc2V0SW5jbHVzaXZlO1xuXHRcdFx0XHR9IGVsc2UgaWYgKG9mZnNldCArIG5vZGUubGVuZ3RoID4gZW5kT2Zmc2V0RXhjbHVzaXZlKSB7XG5cdFx0XHRcdFx0Y2xpcHBlZExlbmd0aCAtPSAob2Zmc2V0ICsgbm9kZS5sZW5ndGggLSBlbmRPZmZzZXRFeGNsdXNpdmUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHsgdG9rZW46IG5vZGUudG9rZW4sIHN0YXJ0T2Zmc2V0SW5jbHVzaXZlOiBjbGlwcGVkT2Zmc2V0LCBsZW5ndGg6IGNsaXBwZWRMZW5ndGggfSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdG1hcmtGb3JSZWZyZXNoKHN0YXJ0T2Zmc2V0SW5jbHVzaXZlOiBudW1iZXIsIGVuZE9mZnNldEV4Y2x1c2l2ZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy50cmF2ZXJzZUluT3JkZXJJblJhbmdlKHN0YXJ0T2Zmc2V0SW5jbHVzaXZlLCBlbmRPZmZzZXRFeGNsdXNpdmUsIChub2RlKSA9PiB7XG5cdFx0XHRpZiAoaXNMZWFmKG5vZGUpKSB7XG5cdFx0XHRcdG5vZGUudG9rZW5RdWFsaXR5ID0gVG9rZW5RdWFsaXR5Lk5vbmU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSk7XG5cdH1cblxuXHRyYW5nZUhhc1Rva2VucyhzdGFydE9mZnNldEluY2x1c2l2ZTogbnVtYmVyLCBlbmRPZmZzZXRFeGNsdXNpdmU6IG51bWJlciwgbWluaW11bVRva2VuUXVhbGl0eTogVG9rZW5RdWFsaXR5KTogYm9vbGVhbiB7XG5cdFx0bGV0IGhhc0FueSA9IHRydWU7XG5cdFx0dGhpcy50cmF2ZXJzZUluT3JkZXJJblJhbmdlKHN0YXJ0T2Zmc2V0SW5jbHVzaXZlLCBlbmRPZmZzZXRFeGNsdXNpdmUsIChub2RlKSA9PiB7XG5cdFx0XHRpZiAoaXNMZWFmKG5vZGUpICYmIChub2RlLnRva2VuUXVhbGl0eSA8IG1pbmltdW1Ub2tlblF1YWxpdHkpKSB7XG5cdFx0XHRcdGhhc0FueSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0pO1xuXHRcdHJldHVybiBoYXNBbnk7XG5cdH1cblxuXHRyYW5nZU5lZWRzUmVmcmVzaChzdGFydE9mZnNldEluY2x1c2l2ZTogbnVtYmVyLCBlbmRPZmZzZXRFeGNsdXNpdmU6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdGxldCBuZWVkc1JlZnJlc2ggPSBmYWxzZTtcblx0XHR0aGlzLnRyYXZlcnNlSW5PcmRlckluUmFuZ2Uoc3RhcnRPZmZzZXRJbmNsdXNpdmUsIGVuZE9mZnNldEV4Y2x1c2l2ZSwgKG5vZGUpID0+IHtcblx0XHRcdGlmIChpc0xlYWYobm9kZSkgJiYgKG5vZGUudG9rZW5RdWFsaXR5ICE9PSBUb2tlblF1YWxpdHkuQWNjdXJhdGUpKSB7XG5cdFx0XHRcdG5lZWRzUmVmcmVzaCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIG5lZWRzUmVmcmVzaDtcblx0fVxuXG5cdGdldE5lZWRzUmVmcmVzaCgpOiB7IHN0YXJ0T2Zmc2V0OiBudW1iZXI7IGVuZE9mZnNldDogbnVtYmVyIH1bXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiB7IHN0YXJ0T2Zmc2V0OiBudW1iZXI7IGVuZE9mZnNldDogbnVtYmVyIH1bXSA9IFtdO1xuXG5cdFx0dGhpcy50cmF2ZXJzZUluT3JkZXJJblJhbmdlKDAsIHRoaXMuX3RleHRNb2RlbC5nZXRWYWx1ZUxlbmd0aCgpLCAobm9kZSwgb2Zmc2V0KSA9PiB7XG5cdFx0XHRpZiAoaXNMZWFmKG5vZGUpICYmIChub2RlLnRva2VuUXVhbGl0eSAhPT0gVG9rZW5RdWFsaXR5LkFjY3VyYXRlKSkge1xuXHRcdFx0XHRpZiAoKHJlc3VsdC5sZW5ndGggPiAwKSAmJiAocmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXS5lbmRPZmZzZXQgPT09IG9mZnNldCkpIHtcblx0XHRcdFx0XHRyZXN1bHRbcmVzdWx0Lmxlbmd0aCAtIDFdLmVuZE9mZnNldCArPSBub2RlLmxlbmd0aDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaCh7IHN0YXJ0T2Zmc2V0OiBvZmZzZXQsIGVuZE9mZnNldDogb2Zmc2V0ICsgbm9kZS5sZW5ndGggfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9KTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGRlZXBDb3B5KCk6IFRva2VuU3RvcmUge1xuXHRcdGNvbnN0IG5ld1N0b3JlID0gbmV3IFRva2VuU3RvcmUodGhpcy5fdGV4dE1vZGVsKTtcblx0XHRuZXdTdG9yZS5fcm9vdCA9IHRoaXMuX2NvcHlOb2RlSXRlcmF0aXZlKHRoaXMuX3Jvb3QpO1xuXHRcdHJldHVybiBuZXdTdG9yZTtcblx0fVxuXG5cdHByaXZhdGUgX2NvcHlOb2RlSXRlcmF0aXZlKHJvb3Q6IE5vZGUpOiBOb2RlIHtcblx0XHRjb25zdCBuZXdSb290ID0gaXNMZWFmKHJvb3QpXG5cdFx0XHQ/IHsgbGVuZ3RoOiByb290Lmxlbmd0aCwgdG9rZW46IHJvb3QudG9rZW4sIHRva2VuUXVhbGl0eTogcm9vdC50b2tlblF1YWxpdHksIGhlaWdodDogcm9vdC5oZWlnaHQgfVxuXHRcdFx0OiBuZXcgTGlzdE5vZGUocm9vdC5oZWlnaHQpO1xuXG5cdFx0Y29uc3Qgc3RhY2s6IEFycmF5PFtOb2RlLCBOb2RlXT4gPSBbW3Jvb3QsIG5ld1Jvb3RdXTtcblxuXHRcdHdoaWxlIChzdGFjay5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBbb2xkTm9kZSwgY2xvbmVkTm9kZV0gPSBzdGFjay5wb3AoKSE7XG5cdFx0XHRpZiAoIWlzTGVhZihvbGROb2RlKSkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIG9sZE5vZGUuY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRjb25zdCBjaGlsZENvcHkgPSBpc0xlYWYoY2hpbGQpXG5cdFx0XHRcdFx0XHQ/IHsgbGVuZ3RoOiBjaGlsZC5sZW5ndGgsIHRva2VuOiBjaGlsZC50b2tlbiwgdG9rZW5RdWFsaXR5OiBjaGlsZC50b2tlblF1YWxpdHksIGhlaWdodDogY2hpbGQuaGVpZ2h0IH1cblx0XHRcdFx0XHRcdDogbmV3IExpc3ROb2RlKGNoaWxkLmhlaWdodCk7XG5cblx0XHRcdFx0XHQoY2xvbmVkTm9kZSBhcyBMaXN0Tm9kZSkuYXBwZW5kQ2hpbGQoY2hpbGRDb3B5KTtcblx0XHRcdFx0XHRzdGFjay5wdXNoKFtjaGlsZCwgY2hpbGRDb3B5XSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3Um9vdDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSB0b2tlbiB0cmVlIHVzaW5nIGFuIGl0ZXJhdGl2ZSBhcHByb2FjaFxuXHQgKi9cblx0cHJpbnRUcmVlKHJvb3Q6IE5vZGUgPSB0aGlzLl9yb290KTogc3RyaW5nIHtcblx0XHRjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3Qgc3RhY2s6IEFycmF5PFtOb2RlLCBudW1iZXJdPiA9IFtbcm9vdCwgMF1dO1xuXG5cdFx0d2hpbGUgKHN0YWNrLmxlbmd0aCA+IDApIHtcblx0XHRcdGNvbnN0IFtub2RlLCBkZXB0aF0gPSBzdGFjay5wb3AoKSE7XG5cdFx0XHRjb25zdCBpbmRlbnQgPSAnICAnLnJlcGVhdChkZXB0aCk7XG5cblx0XHRcdGlmIChpc0xlYWYobm9kZSkpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goYCR7aW5kZW50fUxlYWYobGVuZ3RoOiAke25vZGUubGVuZ3RofSwgdG9rZW46ICR7bm9kZS50b2tlbn0sIHJlZnJlc2g6ICR7bm9kZS50b2tlblF1YWxpdHl9KVxcbmApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goYCR7aW5kZW50fUxpc3QobGVuZ3RoOiAke25vZGUubGVuZ3RofSlcXG5gKTtcblx0XHRcdFx0Ly8gUHVzaCBjaGlsZHJlbiBpbiByZXZlcnNlIG9yZGVyIHNvIHRoZXkgZ2V0IHByb2Nlc3NlZCBsZWZ0LXRvLXJpZ2h0XG5cdFx0XHRcdGZvciAobGV0IGkgPSBub2RlLmNoaWxkcmVuLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRcdFx0c3RhY2sucHVzaChbbm9kZS5jaGlsZHJlbltpXSwgZGVwdGggKyAxXSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0LmpvaW4oJycpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRjb25zdCBzdGFjazogQXJyYXk8W05vZGUsIGJvb2xlYW5dPiA9IFtbdGhpcy5fcm9vdCwgZmFsc2VdXTtcblx0XHR3aGlsZSAoc3RhY2subGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3QgW25vZGUsIHZpc2l0ZWRdID0gc3RhY2sucG9wKCkhO1xuXHRcdFx0aWYgKGlzTGVhZihub2RlKSkge1xuXHRcdFx0XHQvLyBsZWFmIG5vZGUgZG9lcyBub3QgbmVlZCB0byBiZSBkaXNwb3NlZFxuXHRcdFx0fSBlbHNlIGlmICghdmlzaXRlZCkge1xuXHRcdFx0XHRzdGFjay5wdXNoKFtub2RlLCB0cnVlXSk7XG5cdFx0XHRcdGZvciAobGV0IGkgPSBub2RlLmNoaWxkcmVuLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRcdFx0c3RhY2sucHVzaChbbm9kZS5jaGlsZHJlbltpXSwgZmFsc2VdKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bm9kZS5kaXNwb3NlKCk7XG5cdFx0XHRcdG5vZGUucGFyZW50ID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9yb290ID0gdW5kZWZpbmVkITtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBUUEsTUFBTSxTQUFnQztBQUFBLEVBUXJDLFlBQTRCLFFBQWdCO0FBQWhCO0FBTjVCLFNBQWlCLFlBQW9CLENBQUM7QUFHdEMsU0FBUSxVQUFrQjtBQUFBLEVBR29CO0FBQUEsRUFMOUMsSUFBSSxXQUFnQztBQUFFLFdBQU8sS0FBSztBQUFBLEVBQVc7QUFBQSxFQUc3RCxJQUFJLFNBQWlCO0FBQUUsV0FBTyxLQUFLO0FBQUEsRUFBUztBQUFBLEVBSTVDLE9BQU8sT0FBTyxPQUFhLE9BQWE7QUFDdkMsVUFBTSxPQUFPLElBQUksU0FBUyxNQUFNLFNBQVMsQ0FBQztBQUMxQyxTQUFLLFlBQVksS0FBSztBQUN0QixTQUFLLFlBQVksS0FBSztBQUN0QixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsaUJBQTBCO0FBQ3pCLFdBQU8sS0FBSyxVQUFVLFNBQVM7QUFBQSxFQUNoQztBQUFBLEVBRUEsWUFBWSxNQUFZO0FBQ3ZCLFFBQUksQ0FBQyxLQUFLLGVBQWUsR0FBRztBQUMzQixZQUFNLElBQUksTUFBTSxrREFBa0Q7QUFBQSxJQUNuRTtBQUNBLFNBQUssVUFBVSxLQUFLLElBQUk7QUFFeEIsU0FBSyxXQUFXLEtBQUs7QUFDckIsU0FBSyxvQkFBb0IsS0FBSyxNQUFNO0FBQ3BDLFFBQUksQ0FBQyxPQUFPLElBQUksR0FBRztBQUNsQixXQUFLLFNBQVM7QUFBQSxJQUNmO0FBQUEsRUFDRDtBQUFBLEVBRVEsb0JBQW9CLE9BQWU7QUFDMUMsUUFBSSxlQUFlLEtBQUs7QUFDeEIsV0FBTyxjQUFj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
