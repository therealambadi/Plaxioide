import { TrackedRangeStickiness } from "../model.js";
var ClassName = /* @__PURE__ */ ((ClassName2) => {
  ClassName2["EditorHintDecoration"] = "squiggly-hint";
  ClassName2["EditorInfoDecoration"] = "squiggly-info";
  ClassName2["EditorWarningDecoration"] = "squiggly-warning";
  ClassName2["EditorErrorDecoration"] = "squiggly-error";
  ClassName2["EditorUnnecessaryDecoration"] = "squiggly-unnecessary";
  ClassName2["EditorUnnecessaryInlineDecoration"] = "squiggly-inline-unnecessary";
  ClassName2["EditorDeprecatedInlineDecoration"] = "squiggly-inline-deprecated";
  return ClassName2;
})(ClassName || {});
var NodeColor = /* @__PURE__ */ ((NodeColor2) => {
  NodeColor2[NodeColor2["Black"] = 0] = "Black";
  NodeColor2[NodeColor2["Red"] = 1] = "Red";
  return NodeColor2;
})(NodeColor || {});
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["ColorMask"] = 1] = "ColorMask";
  Constants2[Constants2["ColorMaskInverse"] = 254] = "ColorMaskInverse";
  Constants2[Constants2["ColorOffset"] = 0] = "ColorOffset";
  Constants2[Constants2["IsVisitedMask"] = 2] = "IsVisitedMask";
  Constants2[Constants2["IsVisitedMaskInverse"] = 253] = "IsVisitedMaskInverse";
  Constants2[Constants2["IsVisitedOffset"] = 1] = "IsVisitedOffset";
  Constants2[Constants2["IsForValidationMask"] = 4] = "IsForValidationMask";
  Constants2[Constants2["IsForValidationMaskInverse"] = 251] = "IsForValidationMaskInverse";
  Constants2[Constants2["IsForValidationOffset"] = 2] = "IsForValidationOffset";
  Constants2[Constants2["StickinessMask"] = 24] = "StickinessMask";
  Constants2[Constants2["StickinessMaskInverse"] = 231] = "StickinessMaskInverse";
  Constants2[Constants2["StickinessOffset"] = 3] = "StickinessOffset";
  Constants2[Constants2["CollapseOnReplaceEditMask"] = 32] = "CollapseOnReplaceEditMask";
  Constants2[Constants2["CollapseOnReplaceEditMaskInverse"] = 223] = "CollapseOnReplaceEditMaskInverse";
  Constants2[Constants2["CollapseOnReplaceEditOffset"] = 5] = "CollapseOnReplaceEditOffset";
  Constants2[Constants2["IsMarginMask"] = 64] = "IsMarginMask";
  Constants2[Constants2["IsMarginMaskInverse"] = 191] = "IsMarginMaskInverse";
  Constants2[Constants2["IsMarginOffset"] = 6] = "IsMarginOffset";
  Constants2[Constants2["MIN_SAFE_DELTA"] = -1073741824] = "MIN_SAFE_DELTA";
  Constants2[Constants2["MAX_SAFE_DELTA"] = 1073741824] = "MAX_SAFE_DELTA";
  return Constants2;
})(Constants || {});
function getNodeColor(node) {
  return (node.metadata & 1 /* ColorMask */) >>> 0 /* ColorOffset */;
}
function setNodeColor(node, color) {
  node.metadata = node.metadata & 254 /* ColorMaskInverse */ | color << 0 /* ColorOffset */;
}
function getNodeIsVisited(node) {
  return (node.metadata & 2 /* IsVisitedMask */) >>> 1 /* IsVisitedOffset */ === 1;
}
function setNodeIsVisited(node, value) {
  node.metadata = node.metadata & 253 /* IsVisitedMaskInverse */ | (value ? 1 : 0) << 1 /* IsVisitedOffset */;
}
function getNodeIsForValidation(node) {
  return (node.metadata & 4 /* IsForValidationMask */) >>> 2 /* IsForValidationOffset */ === 1;
}
function setNodeIsForValidation(node, value) {
  node.metadata = node.metadata & 251 /* IsForValidationMaskInverse */ | (value ? 1 : 0) << 2 /* IsForValidationOffset */;
}
function getNodeIsInGlyphMargin(node) {
  return (node.metadata & 64 /* IsMarginMask */) >>> 6 /* IsMarginOffset */ === 1;
}
function setNodeIsInGlyphMargin(node, value) {
  node.metadata = node.metadata & 191 /* IsMarginMaskInverse */ | (value ? 1 : 0) << 6 /* IsMarginOffset */;
}
function getNodeStickiness(node) {
  return (node.metadata & 24 /* StickinessMask */) >>> 3 /* StickinessOffset */;
}
function _setNodeStickiness(node, stickiness) {
  node.metadata = node.metadata & 231 /* StickinessMaskInverse */ | stickiness << 3 /* StickinessOffset */;
}
function getCollapseOnReplaceEdit(node) {
  return (node.metadata & 32 /* CollapseOnReplaceEditMask */) >>> 5 /* CollapseOnReplaceEditOffset */ === 1;
}
function setCollapseOnReplaceEdit(node, value) {
  node.metadata = node.metadata & 223 /* CollapseOnReplaceEditMaskInverse */ | (value ? 1 : 0) << 5 /* CollapseOnReplaceEditOffset */;
}
function setNodeStickiness(node, stickiness) {
  _setNodeStickiness(node, stickiness);
}
class IntervalNode {
  constructor(id, start, end) {
    this.metadata = 0;
    this.parent = this;
    this.left = this;
    this.right = this;
    setNodeColor(this, 1 /* Red */);
    this.start = start;
    this.end = end;
    this.delta = 0;
    this.maxEnd = end;
    this.id = id;
    this.ownerId = 0;
    this.options = null;
    setNodeIsForValidation(this, false);
    setNodeIsInGlyphMargin(this, false);
    _setNodeStickiness(this, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges);
    setCollapseOnReplaceEdit(this, false);
    this.cachedVersionId = 0;
    this.cachedAbsoluteStart = start;
    this.cachedAbsoluteEnd = end;
    this.range = null;
    setNodeIsVisited(this, false);
  }
  reset(versionId, start, end, range) {
    this.start = start;
    this.end = end;
    this.maxEnd = end;
    this.cachedVersionId = versionId;
    this.cachedAbsoluteStart = start;
    this.cachedAbsoluteEnd = end;
    this.range = range;
  }
  setOptions(options) {
    this.options = options;
    const className = this.options.className;
    setNodeIsForValidation(this, className === "squiggly-error" /* EditorErrorDecoration */ || className === "squiggly-warning" /* EditorWarningDecoration */ || className === "squiggly-info" /* EditorInfoDecoration */);
    setNodeIsInGlyphMargin(this, this.options.glyphMarginClassName !== null);
    _setNodeStickiness(this, this.options.stickiness);
    setCollapseOnReplaceEdit(this, this.options.collapseOnReplaceEdit);
  }
  setCachedOffsets(absoluteStart, absoluteEnd, cachedVersionId) {
    if (this.cachedVersionId !== cachedVersionId) {
      this.range = null;
    }
    this.cachedVersionId = cachedVersionId;
    this.cachedAbsoluteStart = absoluteStart;
    this.cachedAbsoluteEnd = absoluteEnd;
  }
  detach() {
    this.parent = null;
    this.left = null;
    this.right = null;
  }
}
const SENTINEL = new IntervalNode(null, 0, 0);
SENTINEL.parent = SENTINEL;
SENTINEL.left = SENTINEL;
SENTINEL.right = SENTINEL;
setNodeColor(SENTINEL, 0 /* Black */);
class IntervalTree {
  constructor() {
    this.root = SENTINEL;
    this.requestNormalizeDelta = false;
  }
  intervalSearch(start, end, filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations) {
    if (this.root === SENTINEL) {
      return [];
    }
    return intervalSearch(this, start, end, filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations);
  }
  search(filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations) {
    if (this.root === SENTINEL) {
      return [];
    }
    return search(this, filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations);
  }
  /**
   * Will not set `cachedAbsoluteStart` nor `cachedAbsoluteEnd` on the returned nodes!
   */
  collectNodesFromOwner(ownerId) {
    return collectNodesFromOwner(this, ownerId);
  }
  /**
   * Will not set `cachedAbsoluteStart` nor `cachedAbsoluteEnd` on the returned nodes!
   */
  collectNodesPostOrder() {
    return collectNodesPostOrder(this);
  }
  insert(node) {
    rbTreeInsert(this, node);
    this._normalizeDeltaIfNecessary();
  }
  delete(node) {
    rbTreeDelete(this, node);
    this._normalizeDeltaIfNecessary();
  }
  resolveNode(node, cachedVersionId) {
    const initialNode = node;
    let delta = 0;
    while (node !== this.root) {
      if (node === node.parent.right) {
        delta += node.parent.delta;
      }
      node = node.parent;
    }
    const nodeStart = initialNode.start + delta;
    const nodeEnd = initialNode.end + delta;
    initialNode.setCachedOffsets(nodeStart, nodeEnd, cachedVersionId);
  }
  acceptReplace(offset, length, textLength, forceMoveMarkers) {
    const nodesOfInterest = searchForEditing(this, offset, offset + length);
    for (let i = 0, len = nodesOfInterest.length; i < len; i++) {
      const node = nodesOfInterest[i];
      rbTreeDelete(this, node);
    }
    this._normalizeDeltaIfNecessary();
    noOverlapReplace(this, offset, offset + length, textLength);
    this._normalizeDeltaIfNecessary();
    for (let i = 0, len = nodesOfInterest.length; i < len; i++) {
      const node = nodesOfInterest[i];
      node.start = node.cachedAbsoluteStart;
      node.end = node.cachedAbsoluteEnd;
      nodeAcceptEdit(node, offset, offset + length, textLength, forceMoveMarkers);
      node.maxEnd = node.end;
      rbTreeInsert(this, node);
    }
    this._normalizeDeltaIfNecessary();
  }
  getAllInOrder() {
    return search(this, 0, false, 0, false);
  }
  _normalizeDeltaIfNecessary() {
    if (!this.requestNormalizeDelta) {
      return;
    }
    this.requestNormalizeDelta = false;
    normalizeDelta(this);
  }
}
function normalizeDelta(T) {
  let node = T.root;
  let delta = 0;
  while (node !== SENTINEL) {
    if (node.left !== SENTINEL && !getNodeIsVisited(node.left)) {
      node = node.left;
      continue;
    }
    if (node.right !== SENTINEL && !getNodeIsVisited(node.right)) {
      delta += node.delta;
      node = node.right;
      continue;
    }
    node.start = delta + node.start;
    node.end = delta + node.end;
    node.delta = 0;
    recomputeMaxEnd(node);
    setNodeIsVisited(node, true);
    setNodeIsVisited(node.left, false);
    setNodeIsVisited(node.right, false);
    if (node === node.parent.right) {
      delta -= node.parent.delta;
    }
    node = node.parent;
  }
  setNodeIsVisited(T.root, false);
}
var MarkerMoveSemantics = /* @__PURE__ */ ((MarkerMoveSemantics2) => {
  MarkerMoveSemantics2[MarkerMoveSemantics2["MarkerDefined"] = 0] = "MarkerDefined";
  MarkerMoveSemantics2[MarkerMoveSemantics2["ForceMove"] = 1] = "ForceMove";
  MarkerMoveSemantics2[MarkerMoveSemantics2["ForceStay"] = 2] = "ForceStay";
  return MarkerMoveSemantics2;
})(MarkerMoveSemantics || {});
function adjustMarkerBeforeColumn(markerOffset, markerStickToPreviousCharacter, checkOffset, moveSemantics) {
  if (markerOffset < checkOffset) {
    return true;
  }
  if (markerOffset > checkOffset) {
    return false;
  }
  if (moveSemantics === 1 /* ForceMove */) {
    return false;
  }
  if (moveSemantics === 2 /* ForceStay */) {
    return true;
  }
  return markerStickToPreviousCharacter;
}
function nodeAcceptEdit(node, start, end, textLength, forceMoveMarkers) {
  const nodeStickiness = getNodeStickiness(node);
  const startStickToPreviousCharacter = nodeStickiness === TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges || nodeStickiness === TrackedRangeStickiness.GrowsOnlyWhenTypingBefore;
  const endStickToPreviousCharacter = nodeStickiness === TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges || nodeStickiness === TrackedRangeStickiness.GrowsOnlyWhenTypingBefore;
  const deletingCnt = end - start;
  const insertingCnt = textLength;
  const commonLength = Math.min(deletingCnt, insertingCnt);
  const nodeStart = node.start;
  let startDone = false;
  const nodeEnd = node.end;
  let endDone = false;
  if (start <= nodeStart && nodeEnd <= end && getCollapseOnReplaceEdit(node)) {
    node.start = start;
    startDone = true;
    node.end = start;
    endDone = true;
  }
  {
    const moveSemantics = forceMoveMarkers ? 1 /* ForceMove */ : deletingCnt > 0 ? 2 /* ForceStay */ : 0 /* MarkerDefined */;
    if (!startDone && adjustMarkerBeforeColumn(nodeStart, startStickToPreviousCharacter, start, moveSemantics)) {
      startDone = true;
    }
    if (!endDone && adjustMarkerBeforeColumn(nodeEnd, endStickToPreviousCharacter, start, moveSemantics)) {
      endDone = true;
    }
  }
  if (commonLength > 0 && !forceMoveMarkers) {
    const moveSemantics = deletingCnt > insertingCnt ? 2 /* ForceStay */ : 0 /* MarkerDefined */;
    if (!startDone && adjustMarkerBeforeColumn(nodeStart, startStickToPreviousCharacter, start + commonLength, moveSemantics)) {
      startDone = true;
    }
    if (!endDone && adjustMarkerBeforeColumn(nodeEnd, endStickToPreviousCharacter, start + commonLength, moveSemantics)) {
      endDone = true;
    }
  }
  {
    const moveSemantics = forceMoveMarkers ? 1 /* ForceMove */ : 0 /* MarkerDefined */;
    if (!startDone && adjustMarkerBeforeColumn(nodeStart, startStickToPreviousCharacter, end, moveSemantics)) {
      node.start = start + insertingCnt;
      startDone = true;
    }
    if (!endDone && adjustMarkerBeforeColumn(nodeEnd, endStickToPreviousCharacter, end, moveSemantics)) {
      node.end = start + insertingCnt;
      endDone = true;
    }
  }
  const deltaColumn = insertingCnt - deletingCnt;
  if (!startDone) {
    node.start = Math.max(0, nodeStart + deltaColumn);
  }
  if (!endDone) {
    node.end = Math.max(0, nodeEnd + deltaColumn);
  }
  if (node.start > node.end) {
    node.end = node.start;
  }
}
function searchForEditing(T, start, end) {
  let node = T.root;
  let delta = 0;
  let nodeMaxEnd = 0;
  let nodeStart = 0;
  let nodeEnd = 0;
  const result = [];
  let resultLen = 0;
  while (node !== SENTINEL) {
    if (getNodeIsVisited(node)) {
      setNodeIsVisited(node.left, false);
      setNodeIsVisited(node.right, false);
      if (node === node.parent.right) {
        delta -= node.parent.delta;
      }
      node = node.parent;
      continue;
    }
    if (!getNodeIsVisited(node.left)) {
      nodeMaxEnd = delta + node.maxEnd;
      if (nodeMaxEnd < start) {
        setNodeIsVisited(node, true);
        continue;
      }
      if (node.left !== SENTINEL) {
        node = node.left;
        continue;
      }
    }
    nodeStart = delta + node.start;
    if (nodeStart > end) {
      setNodeIsVisited(node, true);
      continue;
    }
    nodeEnd = delta + node.end;
    if (nodeEnd >= start) {
      node.setCachedOffsets(nodeStart, nodeEnd, 0);
      result[resultLen++] = node;
    }
    setNodeIsVisited(node, true);
    if (node.right !== SENTINEL && !getNodeIsVisited(node.right)) {
      delta += node.delta;
      node = node.right;
      continue;
    }
  }
  setNodeIsVisited(T.root, false);
  return result;
}
function noOverlapReplace(T, start, end, textLength) {
  let node = T.root;
  let delta = 0;
  let nodeMaxEnd = 0;
  let nodeStart = 0;
  const editDelta = textLength - (end - start);
  while (node !== SENTINEL) {
    if (getNodeIsVisited(node)) {
      setNodeIsVisited(node.left, false);
      setNodeIsVisited(node.right, false);
      if (node === node.parent.right) {
        delta -= node.parent.delta;
      }
      recomputeMaxEnd(node);
      node = node.parent;
      continue;
    }
    if (!getNodeIsVisited(node.left)) {
      nodeMaxEnd = delta + node.maxEnd;
      if (nodeMaxEnd < start) {
        setNodeIsVisited(node, true);
        continue;
      }
      if (node.left !== SENTINEL) {
        node = node.left;
        continue;
      }
    }
    nodeStart = delta + node.start;
    if (nodeStart > end) {
      node.start += editDelta;
      node.end += editDelta;
      node.delta += editDelta;
      if (node.delta < -1073741824 /* MIN_SAFE_DELTA */ || node.delta > 1073741824 /* MAX_SAFE_DELTA */) {
        T.requestNormalizeDelta = true;
      }
      setNodeIsVisited(node, true);
      continue;
    }
    setNodeIsVisited(node, true);
    if (node.right !== SENTINEL && !getNodeIsVisited(node.right)) {
      delta += node.delta;
      node = node.right;
      continue;
    }
  }
  setNodeIsVisited(T.root, false);
}
function collectNodesFromOwner(T, ownerId) {
  let node = T.root;
  const result = [];
  let resultLen = 0;
  while (node !== SENTINEL) {
    if (getNodeIsVisited(node)) {
      setNodeIsVisited(node.left, false);
      setNodeIsVisited(node.right, false);
      node = node.parent;
      continue;
    }
    if (node.left !== SENTINEL && !getNodeIsVisited(node.left)) {
      node = node.left;
      continue;
    }
    if (node.ownerId === ownerId) {
      result[resultLen++] = node;
    }
    setNodeIsVisited(node, true);
    if (node.right !== SENTINEL && !getNodeIsVisited(node.right)) {
      node = node.right;
      continue;
    }
  }
  setNodeIsVisited(T.root, false);
  return result;
}
function collectNodesPostOrder(T) {
  let node = T.root;
  const result = [];
  let resultLen = 0;
  while (node !== SENTINEL) {
    if (getNodeIsVisited(node)) {
      setNodeIsVisited(node.left, false);
      setNodeIsVisited(node.right, false);
      node = node.parent;
      continue;
    }
    if (node.left !== SENTINEL && !getNodeIsVisited(node.left)) {
      node = node.left;
      continue;
    }
    if (node.right !== SENTINEL && !getNodeIsVisited(node.right)) {
      node = node.right;
      continue;
    }
    result[resultLen++] = node;
    setNodeIsVisited(node, true);
  }
  setNodeIsVisited(T.root, false);
  return result;
}
function search(T, filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations) {
  let node = T.root;
  let delta = 0;
  let nodeStart = 0;
  let nodeEnd = 0;
  const result = [];
  let resultLen = 0;
  while (node !== SENTINEL) {
    if (getNodeIsVisited(node)) {
      setNodeIsVisited(node.left, false);
      setNodeIsVisited(node.right, false);
      if (node === node.parent.right) {
        delta -= node.parent.delta;
      }
      node = node.parent;
      continue;
    }
    if (node.left !== SENTINEL && !getNodeIsVisited(node.left)) {
      node = node.left;
      continue;
    }
    nodeStart = delta + node.start;
    nodeEnd = delta + node.end;
    node.setCachedOffsets(nodeStart, nodeEnd, cachedVersionId);
    let include = true;
    if (filterOwnerId && node.ownerId && node.ownerId !== filterOwnerId) {
      include = false;
    }
    if (filterOutValidation && getNodeIsForValidation(node)) {
      include = false;
    }
    if (onlyMarginDecorations && !getNodeIsInGlyphMargin(node)) {
      include = false;
    }
    if (include) {
      result[resultLen++] = node;
    }
    setNodeIsVisited(node, true);
    if (node.right !== SENTINEL && !getNodeIsVisited(node.right)) {
      delta += node.delta;
      node = node.right;
      continue;
    }
  }
  setNodeIsVisited(T.root, false);
  return result;
}
function intervalSearch(T, intervalStart, intervalEnd, filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations) {
  let node = T.root;
  let delta = 0;
  let nodeMaxEnd = 0;
  let nodeStart = 0;
  let nodeEnd = 0;
  const result = [];
  let resultLen = 0;
  while (node !== SENTINEL) {
    if (getNodeIsVisited(node)) {
      setNodeIsVisited(node.left, false);
      setNodeIsVisited(node.right, false);
      if (node === node.parent.right) {
        delta -= node.parent.delta;
      }
      node = node.parent;
      continue;
    }
    if (!getNodeIsVisited(node.left)) {
      nodeMaxEnd = delta + node.maxEnd;
      if (nodeMaxEnd < intervalStart) {
        setNodeIsVisited(node, true);
        continue;
      }
      if (node.left !== SENTINEL) {
        node = node.left;
        continue;
      }
    }
    nodeStart = delta + node.start;
    if (nodeStart > intervalEnd) {
      setNodeIsVisited(node, true);
      continue;
    }
    nodeEnd = delta + node.end;
    if (nodeEnd >= intervalStart) {
      node.setCachedOffsets(nodeStart, nodeEnd, cachedVersionId);
      let include = true;
      if (filterOwnerId && node.ownerId && node.ownerId !== filterOwnerId) {
        include = false;
      }
      if (filterOutValidation && getNodeIsForValidation(node)) {
        include = false;
      }
      if (onlyMarginDecorations && !getNodeIsInGlyphMargin(node)) {
        include = false;
      }
      if (include) {
        result[resultLen++] = node;
      }
    }
    setNodeIsVisited(node, true);
    if (node.right !== SENTINEL && !getNodeIsVisited(node.right)) {
      delta += node.delta;
      node = node.right;
      continue;
    }
  }
  setNodeIsVisited(T.root, false);
  return result;
}
function rbTreeInsert(T, newNode) {
  if (T.root === SENTINEL) {
    newNode.parent = SENTINEL;
    newNode.left = SENTINEL;
    newNode.right = SENTINEL;
    setNodeColor(newNode, 0 /* Black */);
    T.root = newNode;
    return T.root;
  }
  treeInsert(T, newNode);
  recomputeMaxEndWalkToRoot(newNode.parent);
  let x = newNode;
  while (x !== T.root && getNodeColor(x.parent) === 1 /* Red */) {
    if (x.parent === x.parent.parent.left) {
      const y = x.parent.parent.right;
      if (getNodeColor(y) === 1 /* Red */) {
        setNodeColor(x.parent, 0 /* Black */);
        setNodeColor(y, 0 /* Black */);
        setNodeColor(x.parent.parent, 1 /* Red */);
        x = x.parent.parent;
      } else {
        if (x === x.parent.right) {
          x = x.parent;
          leftRotate(T, x);
        }
        setNodeColor(x.parent, 0 /* Black */);
        setNodeColor(x.parent.parent, 1 /* Red */);
        rightRotate(T, x.parent.parent);
      }
    } else {
      const y = x.parent.parent.left;
      if (getNodeColor(y) === 1 /* Red */) {
        setNodeColor(x.parent, 0 /* Black */);
        setNodeColor(y, 0 /* Black */);
        setNodeColor(x.parent.parent, 1 /* Red */);
        x = x.parent.parent;
      } else {
        if (x === x.parent.left) {
          x = x.parent;
          rightRotate(T, x);
        }
        setNodeColor(x.parent, 0 /* Black */);
        setNodeColor(x.parent.parent, 1 /* Red */);
        leftRotate(T, x.parent.parent);
      }
    }
  }
  setNodeColor(T.root, 0 /* Black */);
  return newNode;
}
function treeInsert(T, z) {
  let delta = 0;
  let x = T.root;
  const zAbsoluteStart = z.start;
  const zAbsoluteEnd = z.end;
  while (true) {
    const cmp = intervalCompare(zAbsoluteStart, zAbsoluteEnd, x.start + delta, x.end + delta);
    if (cmp < 0) {
      if (x.left === SENTINEL) {
        z.start -= delta;
        z.end -= delta;
        z.maxEnd -= delta;
        x.left = z;
        break;
      } else {
        x = x.left;
      }
    } else {
      if (x.right === SENTINEL) {
        z.start -= delta + x.delta;
        z.end -= delta + x.delta;
        z.maxEnd -= delta + x.delta;
        x.right = z;
        break;
      } else {
        delta += x.delta;
        x = x.right;
      }
    }
  }
  z.parent = x;
  z.left = SENTINEL;
  z.right = SENTINEL;
  setNodeColor(z, 1 /* Red */);
}
function rbTreeDelete(T, z) {
  let x;
  let y;
  if (z.left === SENTINEL) {
    x = z.right;
    y = z;
    x.delta += z.delta;
    if (x.delta < -1073741824 /* MIN_SAFE_DELTA */ || x.delta > 1073741824 /* MAX_SAFE_DELTA */) {
      T.requestNormalizeDelta = true;
    }
    x.start += z.delta;
    x.end += z.delta;
  } else if (z.right === SENTINEL) {
    x = z.left;
    y = z;
  } else {
    y = leftest(z.right);
    x = y.right;
    x.start += y.delta;
    x.end += y.delta;
    x.delta += y.delta;
    if (x.delta < -1073741824 /* MIN_SAFE_DELTA */ || x.delta > 1073741824 /* MAX_SAFE_DELTA */) {
      T.requestNormalizeDelta = true;
    }
    y.start += z.delta;
    y.end += z.delta;
    y.delta = z.delta;
    if (y.delta < -1073741824 /* MIN_SAFE_DELTA */ || y.delta > 1073741824 /* MAX_SAFE_DELTA */) {
      T.requestNormalizeDelta = true;
    }
  }
  if (y === T.root) {
    T.root = x;
    setNodeColor(x, 0 /* Black */);
    z.detach();
    resetSentinel();
    recomputeMaxEnd(x);
    T.root.parent = SENTINEL;
    return;
  }
  const yWasRed = getNodeColor(y) === 1 /* Red */;
  if (y === y.parent.left) {
    y.parent.left = x;
  } else {
    y.parent.right = x;
  }
  if (y === z) {
    x.parent = y.parent;
  } else {
    if (y.parent === z) {
      x.parent = y;
    } else {
      x.parent = y.parent;
    }
    y.left = z.left;
    y.right = z.right;
    y.parent = z.parent;
    setNodeColor(y, getNodeColor(z));
    if (z === T.root) {
      T.root = y;
    } else {
      if (z === z.parent.left) {
        z.parent.left = y;
      } else {
        z.parent.right = y;
      }
    }
    if (y.left !== SENTINEL) {
      y.left.parent = y;
    }
    if (y.right !== SENTINEL) {
      y.right.parent = y;
    }
  }
  z.detach();
  if (yWasRed) {
    recomputeMaxEndWalkToRoot(x.parent);
    if (y !== z) {
      recomputeMaxEndWalkToRoot(y);
      recomputeMaxEndWalkToRoot(y.parent);
    }
    resetSentinel();
    return;
  }
  recomputeMaxEndWalkToRoot(x);
  recomputeMaxEndWalkToRoot(x.parent);
  if (y !== z) {
    recomputeMaxEndWalkToRoot(y);
    recomputeMaxEndWalkToRoot(y.parent);
  }
  let w;
  while (x !== T.root && getNodeColor(x) === 0 /* Black */) {
    if (x === x.parent.left) {
      w = x.parent.right;
      if (getNodeColor(w) === 1 /* Red */) {
        setNodeColor(w, 0 /* Black */);
        setNodeColor(x.parent, 1 /* Red */);
        leftRotate(T, x.parent);
        w = x.parent.right;
      }
      if (getNodeColor(w.left) === 0 /* Black */ && getNodeColor(w.right) === 0 /* Black */) {
        setNodeColor(w, 1 /* Red */);
        x = x.parent;
      } else {
        if (getNodeColor(w.right) === 0 /* Black */) {
          setNodeColor(w.left, 0 /* Black */);
          setNodeColor(w, 1 /* Red */);
          rightRotate(T, w);
          w = x.parent.right;
        }
        setNodeColor(w, getNodeColor(x.parent));
        setNodeColor(x.parent, 0 /* Black */);
        setNodeColor(w.right, 0 /* Black */);
        leftRotate(T, x.parent);
        x = T.root;
      }
    } else {
      w = x.parent.left;
      if (getNodeColor(w) === 1 /* Red */) {
        setNodeColor(w, 0 /* Black */);
        setNodeColor(x.parent, 1 /* Red */);
        rightRotate(T, x.parent);
        w = x.parent.left;
      }
      if (getNodeColor(w.left) === 0 /* Black */ && getNodeColor(w.right) === 0 /* Black */) {
        setNodeColor(w, 1 /* Red */);
        x = x.parent;
      } else {
        if (getNodeColor(w.left) === 0 /* Black */) {
          setNodeColor(w.right, 0 /* Black */);
          setNodeColor(w, 1 /* Red */);
          leftRotate(T, w);
          w = x.parent.left;
        }
        setNodeColor(w, getNodeColor(x.parent));
        setNodeColor(x.parent, 0 /* Black */);
        setNodeColor(w.left, 0 /* Black */);
        rightRotate(T, x.parent);
        x = T.root;
      }
    }
  }
  setNodeColor(x, 0 /* Black */);
  resetSentinel();
}
function leftest(node) {
  while (node.left !== SENTINEL) {
    node = node.left;
  }
  return node;
}
function resetSentinel() {
  SENTINEL.parent = SENTINEL;
  SENTINEL.delta = 0;
  SENTINEL.start = 0;
  SENTINEL.end = 0;
}
function leftRotate(T, x) {
  const y = x.right;
  y.delta += x.delta;
  if (y.delta < -1073741824 /* MIN_SAFE_DELTA */ || y.delta > 1073741824 /* MAX_SAFE_DELTA */) {
    T.requestNormalizeDelta = true;
  }
  y.start += x.delta;
  y.end += x.delta;
  x.right = y.left;
  if (y.left !== SENTINEL) {
    y.left.parent = x;
  }
  y.parent = x.parent;
  if (x.parent === SENTINEL) {
    T.root = y;
  } else if (x === x.parent.left) {
    x.parent.left = y;
  } else {
    x.parent.right = y;
  }
  y.left = x;
  x.parent = y;
  recomputeMaxEnd(x);
  recomputeMaxEnd(y);
}
function rightRotate(T, y) {
  const x = y.left;
  y.delta -= x.delta;
  if (y.delta < -1073741824 /* MIN_SAFE_DELTA */ || y.delta > 1073741824 /* MAX_SAFE_DELTA */) {
    T.requestNormalizeDelta = true;
  }
  y.start -= x.delta;
  y.end -= x.delta;
  y.left = x.right;
  if (x.right !== SENTINEL) {
    x.right.parent = y;
  }
  x.parent = y.parent;
  if (y.parent === SENTINEL) {
    T.root = x;
  } else if (y === y.parent.right) {
    y.parent.right = x;
  } else {
    y.parent.left = x;
  }
  x.right = y;
  y.parent = x;
  recomputeMaxEnd(y);
  recomputeMaxEnd(x);
}
function computeMaxEnd(node) {
  let maxEnd = node.end;
  if (node.left !== SENTINEL) {
    const leftMaxEnd = node.left.maxEnd;
    if (leftMaxEnd > maxEnd) {
      maxEnd = leftMaxEnd;
    }
  }
  if (node.right !== SENTINEL) {
    const rightMaxEnd = node.right.maxEnd + node.delta;
    if (rightMaxEnd > maxEnd) {
      maxEnd = rightMaxEnd;
    }
  }
  return maxEnd;
}
function recomputeMaxEnd(node) {
  node.maxEnd = computeMaxEnd(node);
}
function recomputeMaxEndWalkToRoot(node) {
  while (node !== SENTINEL) {
    const maxEnd = computeMaxEnd(node);
    if (node.maxEnd === maxEnd) {
      return;
    }
    node.maxEnd = maxEnd;
    node = node.parent;
  }
}
function intervalCompare(aStart, aEnd, bStart, bEnd) {
  if (aStart === bStart) {
    return aEnd - bEnd;
  }
  return aStart - bStart;
}
export {
  ClassName,
  IntervalNode,
  IntervalTree,
  NodeColor,
  SENTINEL,
  getNodeColor,
  intervalCompare,
  nodeAcceptEdit,
  recomputeMaxEnd,
  setNodeStickiness
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL21vZGVsL2ludGVydmFsVHJlZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBUcmFja2VkUmFuZ2VTdGlja2luZXNzLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzIGFzIEFjdHVhbFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBNb2RlbERlY29yYXRpb25PcHRpb25zIH0gZnJvbSAnLi90ZXh0TW9kZWwuanMnO1xuXG4vL1xuLy8gVGhlIHJlZC1ibGFjayB0cmVlIGlzIGJhc2VkIG9uIHRoZSBcIkludHJvZHVjdGlvbiB0byBBbGdvcml0aG1zXCIgYnkgQ29ybWVuLCBMZWlzZXJzb24gYW5kIFJpdmVzdC5cbi8vXG5cbmV4cG9ydCBjb25zdCBlbnVtIENsYXNzTmFtZSB7XG5cdEVkaXRvckhpbnREZWNvcmF0aW9uID0gJ3NxdWlnZ2x5LWhpbnQnLFxuXHRFZGl0b3JJbmZvRGVjb3JhdGlvbiA9ICdzcXVpZ2dseS1pbmZvJyxcblx0RWRpdG9yV2FybmluZ0RlY29yYXRpb24gPSAnc3F1aWdnbHktd2FybmluZycsXG5cdEVkaXRvckVycm9yRGVjb3JhdGlvbiA9ICdzcXVpZ2dseS1lcnJvcicsXG5cdEVkaXRvclVubmVjZXNzYXJ5RGVjb3JhdGlvbiA9ICdzcXVpZ2dseS11bm5lY2Vzc2FyeScsXG5cdEVkaXRvclVubmVjZXNzYXJ5SW5saW5lRGVjb3JhdGlvbiA9ICdzcXVpZ2dseS1pbmxpbmUtdW5uZWNlc3NhcnknLFxuXHRFZGl0b3JEZXByZWNhdGVkSW5saW5lRGVjb3JhdGlvbiA9ICdzcXVpZ2dseS1pbmxpbmUtZGVwcmVjYXRlZCdcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gTm9kZUNvbG9yIHtcblx0QmxhY2sgPSAwLFxuXHRSZWQgPSAxLFxufVxuXG5jb25zdCBlbnVtIENvbnN0YW50cyB7XG5cdENvbG9yTWFzayA9IDBiMDAwMDAwMDEsXG5cdENvbG9yTWFza0ludmVyc2UgPSAwYjExMTExMTEwLFxuXHRDb2xvck9mZnNldCA9IDAsXG5cblx0SXNWaXNpdGVkTWFzayA9IDBiMDAwMDAwMTAsXG5cdElzVmlzaXRlZE1hc2tJbnZlcnNlID0gMGIxMTExMTEwMSxcblx0SXNWaXNpdGVkT2Zmc2V0ID0gMSxcblxuXHRJc0ZvclZhbGlkYXRpb25NYXNrID0gMGIwMDAwMDEwMCxcblx0SXNGb3JWYWxpZGF0aW9uTWFza0ludmVyc2UgPSAwYjExMTExMDExLFxuXHRJc0ZvclZhbGlkYXRpb25PZmZzZXQgPSAyLFxuXG5cdFN0aWNraW5lc3NNYXNrID0gMGIwMDAxMTAwMCxcblx0U3RpY2tpbmVzc01hc2tJbnZlcnNlID0gMGIxMTEwMDExMSxcblx0U3RpY2tpbmVzc09mZnNldCA9IDMsXG5cblx0Q29sbGFwc2VPblJlcGxhY2VFZGl0TWFzayA9IDBiMDAxMDAwMDAsXG5cdENvbGxhcHNlT25SZXBsYWNlRWRpdE1hc2tJbnZlcnNlID0gMGIxMTAxMTExMSxcblx0Q29sbGFwc2VPblJlcGxhY2VFZGl0T2Zmc2V0ID0gNSxcblxuXHRJc01hcmdpbk1hc2sgPSAwYjAxMDAwMDAwLFxuXHRJc01hcmdpbk1hc2tJbnZlcnNlID0gMGIxMDExMTExMSxcblx0SXNNYXJnaW5PZmZzZXQgPSA2LFxuXG5cdC8qKlxuXHQgKiBEdWUgdG8gaG93IGRlbGV0aW9uIHdvcmtzIChpbiBvcmRlciB0byBhdm9pZCBhbHdheXMgd2Fsa2luZyB0aGUgcmlnaHQgc3VidHJlZSBvZiB0aGUgZGVsZXRlZCBub2RlKSxcblx0ICogdGhlIGRlbHRhcyBmb3Igbm9kZXMgY2FuIGdyb3cgYW5kIHNocmluayBkcmFtYXRpY2FsbHkuIEl0IGhhcyBiZWVuIG9ic2VydmVkLCBpbiBwcmFjdGljZSwgdGhhdCB1bmxlc3Ncblx0ICogdGhlIGRlbHRhcyBhcmUgY29ycmVjdGVkLCBpbnRlZ2VyIG92ZXJmbG93IHdpbGwgb2NjdXIuXG5cdCAqXG5cdCAqIFRoZSBpbnRlZ2VyIG92ZXJmbG93IG9jY3VycyB3aGVuIDUzIGJpdHMgYXJlIHVzZWQgaW4gdGhlIG51bWJlcnMsIGJ1dCB3ZSB3aWxsIHRyeSB0byBhdm9pZCBpdCBhc1xuXHQgKiBhIG5vZGUncyBkZWx0YSBnZXRzIGJlbG93IGEgbmVnYXRpdmUgMzAgYml0cyBudW1iZXIuXG5cdCAqXG5cdCAqIE1JTiBTTUkgKFNNYWxsIEludGVnZXIpIGFzIGRlZmluZWQgaW4gdjguXG5cdCAqIG9uZSBiaXQgaXMgbG9zdCBmb3IgYm94aW5nL3VuYm94aW5nIGZsYWcuXG5cdCAqIG9uZSBiaXQgaXMgbG9zdCBmb3Igc2lnbiBmbGFnLlxuXHQgKiBTZWUgaHR0cHM6Ly90aGliYXVsdGxhdXJlbnMuZ2l0aHViLmlvL2phdmFzY3JpcHQvMjAxMy8wNC8yOS9ob3ctdGhlLXY4LWVuZ2luZS13b3Jrcy8jdGFnZ2VkLXZhbHVlc1xuXHQgKi9cblx0TUlOX1NBRkVfREVMVEEgPSAtKDEgPDwgMzApLFxuXHQvKipcblx0ICogTUFYIFNNSSAoU01hbGwgSW50ZWdlcikgYXMgZGVmaW5lZCBpbiB2OC5cblx0ICogb25lIGJpdCBpcyBsb3N0IGZvciBib3hpbmcvdW5ib3hpbmcgZmxhZy5cblx0ICogb25lIGJpdCBpcyBsb3N0IGZvciBzaWduIGZsYWcuXG5cdCAqIFNlZSBodHRwczovL3RoaWJhdWx0bGF1cmVucy5naXRodWIuaW8vamF2YXNjcmlwdC8yMDEzLzA0LzI5L2hvdy10aGUtdjgtZW5naW5lLXdvcmtzLyN0YWdnZWQtdmFsdWVzXG5cdCAqL1xuXHRNQVhfU0FGRV9ERUxUQSA9IDEgPDwgMzAsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXROb2RlQ29sb3Iobm9kZTogSW50ZXJ2YWxOb2RlKTogTm9kZUNvbG9yIHtcblx0cmV0dXJuICgobm9kZS5tZXRhZGF0YSAmIENvbnN0YW50cy5Db2xvck1hc2spID4+PiBDb25zdGFudHMuQ29sb3JPZmZzZXQpO1xufVxuZnVuY3Rpb24gc2V0Tm9kZUNvbG9yKG5vZGU6IEludGVydmFsTm9kZSwgY29sb3I6IE5vZGVDb2xvcik6IHZvaWQge1xuXHRub2RlLm1ldGFkYXRhID0gKFxuXHRcdChub2RlLm1ldGFkYXRhICYgQ29uc3RhbnRzLkNvbG9yTWFza0ludmVyc2UpIHwgKGNvbG9yIDw8IENvbnN0YW50cy5Db2xvck9mZnNldClcblx0KTtcbn1cbmZ1bmN0aW9uIGdldE5vZGVJc1Zpc2l0ZWQobm9kZTogSW50ZXJ2YWxOb2RlKTogYm9vbGVhbiB7XG5cdHJldHVybiAoKG5vZGUubWV0YWRhdGEgJiBDb25zdGFudHMuSXNWaXNpdGVkTWFzaykgPj4+IENvbnN0YW50cy5Jc1Zpc2l0ZWRPZmZzZXQpID09PSAxO1xufVxuZnVuY3Rpb24gc2V0Tm9kZUlzVmlzaXRlZChub2RlOiBJbnRlcnZhbE5vZGUsIHZhbHVlOiBib29sZWFuKTogdm9pZCB7XG5cdG5vZGUubWV0YWRhdGEgPSAoXG5cdFx0KG5vZGUubWV0YWRhdGEgJiBDb25zdGFudHMuSXNWaXNpdGVkTWFza0ludmVyc2UpIHwgKCh2YWx1ZSA/IDEgOiAwKSA8PCBDb25zdGFudHMuSXNWaXNpdGVkT2Zmc2V0KVxuXHQpO1xufVxuZnVuY3Rpb24gZ2V0Tm9kZUlzRm9yVmFsaWRhdGlvbihub2RlOiBJbnRlcnZhbE5vZGUpOiBib29sZWFuIHtcblx0cmV0dXJuICgobm9kZS5tZXRhZGF0YSAmIENvbnN0YW50cy5Jc0ZvclZhbGlkYXRpb25NYXNrKSA+Pj4gQ29uc3RhbnRzLklzRm9yVmFsaWRhdGlvbk9mZnNldCkgPT09IDE7XG59XG5mdW5jdGlvbiBzZXROb2RlSXNGb3JWYWxpZGF0aW9uKG5vZGU6IEludGVydmFsTm9kZSwgdmFsdWU6IGJvb2xlYW4pOiB2b2lkIHtcblx0bm9kZS5tZXRhZGF0YSA9IChcblx0XHQobm9kZS5tZXRhZGF0YSAmIENvbnN0YW50cy5Jc0ZvclZhbGlkYXRpb25NYXNrSW52ZXJzZSkgfCAoKHZhbHVlID8gMSA6IDApIDw8IENvbnN0YW50cy5Jc0ZvclZhbGlkYXRpb25PZmZzZXQpXG5cdCk7XG59XG5mdW5jdGlvbiBnZXROb2RlSXNJbkdseXBoTWFyZ2luKG5vZGU6IEludGVydmFsTm9kZSk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gKChub2RlLm1ldGFkYXRhICYgQ29uc3RhbnRzLklzTWFyZ2luTWFzaykgPj4+IENvbnN0YW50cy5Jc01hcmdpbk9mZnNldCkgPT09IDE7XG59XG5mdW5jdGlvbiBzZXROb2RlSXNJbkdseXBoTWFyZ2luKG5vZGU6IEludGVydmFsTm9kZSwgdmFsdWU6IGJvb2xlYW4pOiB2b2lkIHtcblx0bm9kZS5tZXRhZGF0YSA9IChcblx0XHQobm9kZS5tZXRhZGF0YSAmIENvbnN0YW50cy5Jc01hcmdpbk1hc2tJbnZlcnNlKSB8ICgodmFsdWUgPyAxIDogMCkgPDwgQ29uc3RhbnRzLklzTWFyZ2luT2Zmc2V0KVxuXHQpO1xufVxuZnVuY3Rpb24gZ2V0Tm9kZVN0aWNraW5lc3Mobm9kZTogSW50ZXJ2YWxOb2RlKTogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcyB7XG5cdHJldHVybiAoKG5vZGUubWV0YWRhdGEgJiBDb25zdGFudHMuU3RpY2tpbmVzc01hc2spID4+PiBDb25zdGFudHMuU3RpY2tpbmVzc09mZnNldCk7XG59XG5mdW5jdGlvbiBfc2V0Tm9kZVN0aWNraW5lc3Mobm9kZTogSW50ZXJ2YWxOb2RlLCBzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzKTogdm9pZCB7XG5cdG5vZGUubWV0YWRhdGEgPSAoXG5cdFx0KG5vZGUubWV0YWRhdGEgJiBDb25zdGFudHMuU3RpY2tpbmVzc01hc2tJbnZlcnNlKSB8IChzdGlja2luZXNzIDw8IENvbnN0YW50cy5TdGlja2luZXNzT2Zmc2V0KVxuXHQpO1xufVxuZnVuY3Rpb24gZ2V0Q29sbGFwc2VPblJlcGxhY2VFZGl0KG5vZGU6IEludGVydmFsTm9kZSk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gKChub2RlLm1ldGFkYXRhICYgQ29uc3RhbnRzLkNvbGxhcHNlT25SZXBsYWNlRWRpdE1hc2spID4+PiBDb25zdGFudHMuQ29sbGFwc2VPblJlcGxhY2VFZGl0T2Zmc2V0KSA9PT0gMTtcbn1cbmZ1bmN0aW9uIHNldENvbGxhcHNlT25SZXBsYWNlRWRpdChub2RlOiBJbnRlcnZhbE5vZGUsIHZhbHVlOiBib29sZWFuKTogdm9pZCB7XG5cdG5vZGUubWV0YWRhdGEgPSAoXG5cdFx0KG5vZGUubWV0YWRhdGEgJiBDb25zdGFudHMuQ29sbGFwc2VPblJlcGxhY2VFZGl0TWFza0ludmVyc2UpIHwgKCh2YWx1ZSA/IDEgOiAwKSA8PCBDb25zdGFudHMuQ29sbGFwc2VPblJlcGxhY2VFZGl0T2Zmc2V0KVxuXHQpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHNldE5vZGVTdGlja2luZXNzKG5vZGU6IEludGVydmFsTm9kZSwgc3RpY2tpbmVzczogQWN0dWFsVHJhY2tlZFJhbmdlU3RpY2tpbmVzcyk6IHZvaWQge1xuXHRfc2V0Tm9kZVN0aWNraW5lc3Mobm9kZSwgPG51bWJlcj5zdGlja2luZXNzKTtcbn1cblxuZXhwb3J0IGNsYXNzIEludGVydmFsTm9kZSB7XG5cblx0LyoqXG5cdCAqIGNvbnRhaW5zIGJpbmFyeSBlbmNvZGVkIGluZm9ybWF0aW9uIGZvciBjb2xvciwgdmlzaXRlZCwgaXNGb3JWYWxpZGF0aW9uIGFuZCBzdGlja2luZXNzLlxuXHQgKi9cblx0cHVibGljIG1ldGFkYXRhOiBudW1iZXI7XG5cblx0cHVibGljIHBhcmVudDogSW50ZXJ2YWxOb2RlO1xuXHRwdWJsaWMgbGVmdDogSW50ZXJ2YWxOb2RlO1xuXHRwdWJsaWMgcmlnaHQ6IEludGVydmFsTm9kZTtcblxuXHRwdWJsaWMgc3RhcnQ6IG51bWJlcjtcblx0cHVibGljIGVuZDogbnVtYmVyO1xuXHRwdWJsaWMgZGVsdGE6IG51bWJlcjtcblx0cHVibGljIG1heEVuZDogbnVtYmVyO1xuXG5cdHB1YmxpYyBpZDogc3RyaW5nO1xuXHRwdWJsaWMgb3duZXJJZDogbnVtYmVyO1xuXHRwdWJsaWMgb3B0aW9uczogTW9kZWxEZWNvcmF0aW9uT3B0aW9ucztcblxuXHRwdWJsaWMgY2FjaGVkVmVyc2lvbklkOiBudW1iZXI7XG5cdHB1YmxpYyBjYWNoZWRBYnNvbHV0ZVN0YXJ0OiBudW1iZXI7XG5cdHB1YmxpYyBjYWNoZWRBYnNvbHV0ZUVuZDogbnVtYmVyO1xuXHRwdWJsaWMgcmFuZ2U6IFJhbmdlIHwgbnVsbDtcblxuXHRjb25zdHJ1Y3RvcihpZDogc3RyaW5nLCBzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlcikge1xuXHRcdHRoaXMubWV0YWRhdGEgPSAwO1xuXG5cdFx0dGhpcy5wYXJlbnQgPSB0aGlzO1xuXHRcdHRoaXMubGVmdCA9IHRoaXM7XG5cdFx0dGhpcy5yaWdodCA9IHRoaXM7XG5cdFx0c2V0Tm9kZUNvbG9yKHRoaXMsIE5vZGVDb2xvci5SZWQpO1xuXG5cdFx0dGhpcy5zdGFydCA9IHN0YXJ0O1xuXHRcdHRoaXMuZW5kID0gZW5kO1xuXHRcdC8vIEZPUkNFX09WRVJGTE9XSU5HX1RFU1Q6IHRoaXMuZGVsdGEgPSBzdGFydDtcblx0XHR0aGlzLmRlbHRhID0gMDtcblx0XHR0aGlzLm1heEVuZCA9IGVuZDtcblxuXHRcdHRoaXMuaWQgPSBpZDtcblx0XHR0aGlzLm93bmVySWQgPSAwO1xuXHRcdHRoaXMub3B0aW9ucyA9IG51bGwhO1xuXHRcdHNldE5vZGVJc0ZvclZhbGlkYXRpb24odGhpcywgZmFsc2UpO1xuXHRcdHNldE5vZGVJc0luR2x5cGhNYXJnaW4odGhpcywgZmFsc2UpO1xuXHRcdF9zZXROb2RlU3RpY2tpbmVzcyh0aGlzLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyk7XG5cdFx0c2V0Q29sbGFwc2VPblJlcGxhY2VFZGl0KHRoaXMsIGZhbHNlKTtcblxuXHRcdHRoaXMuY2FjaGVkVmVyc2lvbklkID0gMDtcblx0XHR0aGlzLmNhY2hlZEFic29sdXRlU3RhcnQgPSBzdGFydDtcblx0XHR0aGlzLmNhY2hlZEFic29sdXRlRW5kID0gZW5kO1xuXHRcdHRoaXMucmFuZ2UgPSBudWxsO1xuXG5cdFx0c2V0Tm9kZUlzVmlzaXRlZCh0aGlzLCBmYWxzZSk7XG5cdH1cblxuXHRwdWJsaWMgcmVzZXQodmVyc2lvbklkOiBudW1iZXIsIHN0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyLCByYW5nZTogUmFuZ2UpOiB2b2lkIHtcblx0XHR0aGlzLnN0YXJ0ID0gc3RhcnQ7XG5cdFx0dGhpcy5lbmQgPSBlbmQ7XG5cdFx0dGhpcy5tYXhFbmQgPSBlbmQ7XG5cdFx0dGhpcy5jYWNoZWRWZXJzaW9uSWQgPSB2ZXJzaW9uSWQ7XG5cdFx0dGhpcy5jYWNoZWRBYnNvbHV0ZVN0YXJ0ID0gc3RhcnQ7XG5cdFx0dGhpcy5jYWNoZWRBYnNvbHV0ZUVuZCA9IGVuZDtcblx0XHR0aGlzLnJhbmdlID0gcmFuZ2U7XG5cdH1cblxuXHRwdWJsaWMgc2V0T3B0aW9ucyhvcHRpb25zOiBNb2RlbERlY29yYXRpb25PcHRpb25zKSB7XG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0XHRjb25zdCBjbGFzc05hbWUgPSB0aGlzLm9wdGlvbnMuY2xhc3NOYW1lO1xuXHRcdHNldE5vZGVJc0ZvclZhbGlkYXRpb24odGhpcywgKFxuXHRcdFx0Y2xhc3NOYW1lID09PSBDbGFzc05hbWUuRWRpdG9yRXJyb3JEZWNvcmF0aW9uXG5cdFx0XHR8fCBjbGFzc05hbWUgPT09IENsYXNzTmFtZS5FZGl0b3JXYXJuaW5nRGVjb3JhdGlvblxuXHRcdFx0fHwgY2xhc3NOYW1lID09PSBDbGFzc05hbWUuRWRpdG9ySW5mb0RlY29yYXRpb25cblx0XHQpKTtcblx0XHRzZXROb2RlSXNJbkdseXBoTWFyZ2luKHRoaXMsIHRoaXMub3B0aW9ucy5nbHlwaE1hcmdpbkNsYXNzTmFtZSAhPT0gbnVsbCk7XG5cdFx0X3NldE5vZGVTdGlja2luZXNzKHRoaXMsIDxudW1iZXI+dGhpcy5vcHRpb25zLnN0aWNraW5lc3MpO1xuXHRcdHNldENvbGxhcHNlT25SZXBsYWNlRWRpdCh0aGlzLCB0aGlzLm9wdGlvbnMuY29sbGFwc2VPblJlcGxhY2VFZGl0KTtcblx0fVxuXG5cdHB1YmxpYyBzZXRDYWNoZWRPZmZzZXRzKGFic29sdXRlU3RhcnQ6IG51bWJlciwgYWJzb2x1dGVFbmQ6IG51bWJlciwgY2FjaGVkVmVyc2lvbklkOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jYWNoZWRWZXJzaW9uSWQgIT09IGNhY2hlZFZlcnNpb25JZCkge1xuXHRcdFx0dGhpcy5yYW5nZSA9IG51bGw7XG5cdFx0fVxuXHRcdHRoaXMuY2FjaGVkVmVyc2lvbklkID0gY2FjaGVkVmVyc2lvbklkO1xuXHRcdHRoaXMuY2FjaGVkQWJzb2x1dGVTdGFydCA9IGFic29sdXRlU3RhcnQ7XG5cdFx0dGhpcy5jYWNoZWRBYnNvbHV0ZUVuZCA9IGFic29sdXRlRW5kO1xuXHR9XG5cblx0cHVibGljIGRldGFjaCgpOiB2b2lkIHtcblx0XHR0aGlzLnBhcmVudCA9IG51bGwhO1xuXHRcdHRoaXMubGVmdCA9IG51bGwhO1xuXHRcdHRoaXMucmlnaHQgPSBudWxsITtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgU0VOVElORUw6IEludGVydmFsTm9kZSA9IG5ldyBJbnRlcnZhbE5vZGUobnVsbCEsIDAsIDApO1xuU0VOVElORUwucGFyZW50ID0gU0VOVElORUw7XG5TRU5USU5FTC5sZWZ0ID0gU0VOVElORUw7XG5TRU5USU5FTC5yaWdodCA9IFNFTlRJTkVMO1xuc2V0Tm9kZUNvbG9yKFNFTlRJTkVMLCBOb2RlQ29sb3IuQmxhY2spO1xuXG5leHBvcnQgY2xhc3MgSW50ZXJ2YWxUcmVlIHtcblxuXHRwdWJsaWMgcm9vdDogSW50ZXJ2YWxOb2RlO1xuXHRwdWJsaWMgcmVxdWVzdE5vcm1hbGl6ZURlbHRhOiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMucm9vdCA9IFNFTlRJTkVMO1xuXHRcdHRoaXMucmVxdWVzdE5vcm1hbGl6ZURlbHRhID0gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgaW50ZXJ2YWxTZWFyY2goc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIsIGZpbHRlck93bmVySWQ6IG51bWJlciwgZmlsdGVyT3V0VmFsaWRhdGlvbjogYm9vbGVhbiwgY2FjaGVkVmVyc2lvbklkOiBudW1iZXIsIG9ubHlNYXJnaW5EZWNvcmF0aW9uczogYm9vbGVhbik6IEludGVydmFsTm9kZVtdIHtcblx0XHRpZiAodGhpcy5yb290ID09PSBTRU5USU5FTCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0XHRyZXR1cm4gaW50ZXJ2YWxTZWFyY2godGhpcywgc3RhcnQsIGVuZCwgZmlsdGVyT3duZXJJZCwgZmlsdGVyT3V0VmFsaWRhdGlvbiwgY2FjaGVkVmVyc2lvbklkLCBvbmx5TWFyZ2luRGVjb3JhdGlvbnMpO1xuXHR9XG5cblx0cHVibGljIHNlYXJjaChmaWx0ZXJPd25lcklkOiBudW1iZXIsIGZpbHRlck91dFZhbGlkYXRpb246IGJvb2xlYW4sIGNhY2hlZFZlcnNpb25JZDogbnVtYmVyLCBvbmx5TWFyZ2luRGVjb3JhdGlvbnM6IGJvb2xlYW4pOiBJbnRlcnZhbE5vZGVbXSB7XG5cdFx0aWYgKHRoaXMucm9vdCA9PT0gU0VOVElORUwpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0cmV0dXJuIHNlYXJjaCh0aGlzLCBmaWx0ZXJPd25lcklkLCBmaWx0ZXJPdXRWYWxpZGF0aW9uLCBjYWNoZWRWZXJzaW9uSWQsIG9ubHlNYXJnaW5EZWNvcmF0aW9ucyk7XG5cdH1cblxuXHQvKipcblx0ICogV2lsbCBub3Qgc2V0IGBjYWNoZWRBYnNvbHV0ZVN0YXJ0YCBub3IgYGNhY2hlZEFic29sdXRlRW5kYCBvbiB0aGUgcmV0dXJuZWQgbm9kZXMhXG5cdCAqL1xuXHRwdWJsaWMgY29sbGVjdE5vZGVzRnJvbU93bmVyKG93bmVySWQ6IG51bWJlcik6IEludGVydmFsTm9kZVtdIHtcblx0XHRyZXR1cm4gY29sbGVjdE5vZGVzRnJvbU93bmVyKHRoaXMsIG93bmVySWQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFdpbGwgbm90IHNldCBgY2FjaGVkQWJzb2x1dGVTdGFydGAgbm9yIGBjYWNoZWRBYnNvbHV0ZUVuZGAgb24gdGhlIHJldHVybmVkIG5vZGVzIVxuXHQgKi9cblx0cHVibGljIGNvbGxlY3ROb2Rlc1Bvc3RPcmRlcigpOiBJbnRlcnZhbE5vZGVbXSB7XG5cdFx0cmV0dXJuIGNvbGxlY3ROb2Rlc1Bvc3RPcmRlcih0aGlzKTtcblx0fVxuXG5cdHB1YmxpYyBpbnNlcnQobm9kZTogSW50ZXJ2YWxOb2RlKTogdm9pZCB7XG5cdFx0cmJUcmVlSW5zZXJ0KHRoaXMsIG5vZGUpO1xuXHRcdHRoaXMuX25vcm1hbGl6ZURlbHRhSWZOZWNlc3NhcnkoKTtcblx0fVxuXG5cdHB1YmxpYyBkZWxldGUobm9kZTogSW50ZXJ2YWxOb2RlKTogdm9pZCB7XG5cdFx0cmJUcmVlRGVsZXRlKHRoaXMsIG5vZGUpO1xuXHRcdHRoaXMuX25vcm1hbGl6ZURlbHRhSWZOZWNlc3NhcnkoKTtcblx0fVxuXG5cdHB1YmxpYyByZXNvbHZlTm9kZShub2RlOiBJbnRlcnZhbE5vZGUsIGNhY2hlZFZlcnNpb25JZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgaW5pdGlhbE5vZGUgPSBub2RlO1xuXHRcdGxldCBkZWx0YSA9IDA7XG5cdFx0d2hpbGUgKG5vZGUgIT09IHRoaXMucm9vdCkge1xuXHRcdFx0aWYgKG5vZGUgPT09IG5vZGUucGFyZW50LnJpZ2h0KSB7XG5cdFx0XHRcdGRlbHRhICs9IG5vZGUucGFyZW50LmRlbHRhO1xuXHRcdFx0fVxuXHRcdFx0bm9kZSA9IG5vZGUucGFyZW50O1xuXHRcdH1cblxuXHRcdGNvbnN0IG5vZGVTdGFydCA9IGluaXRpYWxOb2RlLnN0YXJ0ICsgZGVsdGE7XG5cdFx0Y29uc3Qgbm9kZUVuZCA9IGluaXRpYWxOb2RlLmVuZCArIGRlbHRhO1xuXHRcdGluaXRpYWxOb2RlLnNldENhY2hlZE9mZnNldHMobm9kZVN0YXJ0LCBub2RlRW5kLCBjYWNoZWRWZXJzaW9uSWQpO1xuXHR9XG5cblx0cHVibGljIGFjY2VwdFJlcGxhY2Uob2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCB0ZXh0TGVuZ3RoOiBudW1iZXIsIGZvcmNlTW92ZU1hcmtlcnM6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHQvLyBPdXIgc3RyYXRlZ3kgaXMgdG8gcmVtb3ZlIGFsbCBkaXJlY3RseSBpbXBhY3RlZCBub2RlcywgYW5kIHRoZW4gYWRkIHRoZW0gYmFjayB0byB0aGUgdHJlZS5cblxuXHRcdC8vICgxKSBjb2xsZWN0IGFsbCBub2RlcyB0aGF0IGFyZSBpbnRlcnNlY3RpbmcgdGhpcyBlZGl0IGFzIG5vZGVzIG9mIGludGVyZXN0XG5cdFx0Y29uc3Qgbm9kZXNPZkludGVyZXN0ID0gc2VhcmNoRm9yRWRpdGluZyh0aGlzLCBvZmZzZXQsIG9mZnNldCArIGxlbmd0aCk7XG5cblx0XHQvLyAoMikgcmVtb3ZlIGFsbCBub2RlcyB0aGF0IGFyZSBpbnRlcnNlY3RpbmcgdGhpcyBlZGl0XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IG5vZGVzT2ZJbnRlcmVzdC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3Qgbm9kZSA9IG5vZGVzT2ZJbnRlcmVzdFtpXTtcblx0XHRcdHJiVHJlZURlbGV0ZSh0aGlzLCBub2RlKTtcblx0XHR9XG5cdFx0dGhpcy5fbm9ybWFsaXplRGVsdGFJZk5lY2Vzc2FyeSgpO1xuXG5cdFx0Ly8gKDMpIGVkaXQgYWxsIHRyZWUgbm9kZXMgZXhjZXB0IHRoZSBub2RlcyBvZiBpbnRlcmVzdFxuXHRcdG5vT3ZlcmxhcFJlcGxhY2UodGhpcywgb2Zmc2V0LCBvZmZzZXQgKyBsZW5ndGgsIHRleHRMZW5ndGgpO1xuXHRcdHRoaXMuX25vcm1hbGl6ZURlbHRhSWZOZWNlc3NhcnkoKTtcblxuXHRcdC8vICg0KSBlZGl0IHRoZSBub2RlcyBvZiBpbnRlcmVzdCBhbmQgaW5zZXJ0IHRoZW0gYmFjayBpbiB0aGUgdHJlZVxuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBub2Rlc09mSW50ZXJlc3QubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IG5vZGUgPSBub2Rlc09mSW50ZXJlc3RbaV07XG5cdFx0XHRub2RlLnN0YXJ0ID0gbm9kZS5jYWNoZWRBYnNvbHV0ZVN0YXJ0O1xuXHRcdFx0bm9kZS5lbmQgPSBub2RlLmNhY2hlZEFic29sdXRlRW5kO1xuXHRcdFx0bm9kZUFjY2VwdEVkaXQobm9kZSwgb2Zmc2V0LCAob2Zmc2V0ICsgbGVuZ3RoKSwgdGV4dExlbmd0aCwgZm9yY2VNb3ZlTWFya2Vycyk7XG5cdFx0XHRub2RlLm1heEVuZCA9IG5vZGUuZW5kO1xuXHRcdFx0cmJUcmVlSW5zZXJ0KHRoaXMsIG5vZGUpO1xuXHRcdH1cblx0XHR0aGlzLl9ub3JtYWxpemVEZWx0YUlmTmVjZXNzYXJ5KCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QWxsSW5PcmRlcigpOiBJbnRlcnZhbE5vZGVbXSB7XG5cdFx0cmV0dXJuIHNlYXJjaCh0aGlzLCAwLCBmYWxzZSwgMCwgZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBfbm9ybWFsaXplRGVsdGFJZk5lY2Vzc2FyeSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMucmVxdWVzdE5vcm1hbGl6ZURlbHRhKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMucmVxdWVzdE5vcm1hbGl6ZURlbHRhID0gZmFsc2U7XG5cdFx0bm9ybWFsaXplRGVsdGEodGhpcyk7XG5cdH1cbn1cblxuLy8jcmVnaW9uIERlbHRhIE5vcm1hbGl6YXRpb25cbmZ1bmN0aW9uIG5vcm1hbGl6ZURlbHRhKFQ6IEludGVydmFsVHJlZSk6IHZvaWQge1xuXHRsZXQgbm9kZSA9IFQucm9vdDtcblx0bGV0IGRlbHRhID0gMDtcblx0d2hpbGUgKG5vZGUgIT09IFNFTlRJTkVMKSB7XG5cblx0XHRpZiAobm9kZS5sZWZ0ICE9PSBTRU5USU5FTCAmJiAhZ2V0Tm9kZUlzVmlzaXRlZChub2RlLmxlZnQpKSB7XG5cdFx0XHQvLyBnbyBsZWZ0XG5cdFx0XHRub2RlID0gbm9kZS5sZWZ0O1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0aWYgKG5vZGUucmlnaHQgIT09IFNFTlRJTkVMICYmICFnZXROb2RlSXNWaXNpdGVkKG5vZGUucmlnaHQpKSB7XG5cdFx0XHQvLyBnbyByaWdodFxuXHRcdFx0ZGVsdGEgKz0gbm9kZS5kZWx0YTtcblx0XHRcdG5vZGUgPSBub2RlLnJpZ2h0O1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0Ly8gaGFuZGxlIGN1cnJlbnQgbm9kZVxuXHRcdG5vZGUuc3RhcnQgPSBkZWx0YSArIG5vZGUuc3RhcnQ7XG5cdFx0bm9kZS5lbmQgPSBkZWx0YSArIG5vZGUuZW5kO1xuXHRcdG5vZGUuZGVsdGEgPSAwO1xuXHRcdHJlY29tcHV0ZU1heEVuZChub2RlKTtcblxuXHRcdHNldE5vZGVJc1Zpc2l0ZWQobm9kZSwgdHJ1ZSk7XG5cblx0XHQvLyBnb2luZyB1cCBmcm9tIHRoaXMgbm9kZVxuXHRcdHNldE5vZGVJc1Zpc2l0ZWQobm9kZS5sZWZ0LCBmYWxzZSk7XG5cdFx0c2V0Tm9kZUlzVmlzaXRlZChub2RlLnJpZ2h0LCBmYWxzZSk7XG5cdFx0aWYgKG5vZGUgPT09IG5vZGUucGFyZW50LnJpZ2h0KSB7XG5cdFx0XHRkZWx0YSAtPSBub2RlLnBhcmVudC5kZWx0YTtcblx0XHR9XG5cdFx0bm9kZSA9IG5vZGUucGFyZW50O1xuXHR9XG5cblx0c2V0Tm9kZUlzVmlzaXRlZChULnJvb3QsIGZhbHNlKTtcbn1cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gRWRpdGluZ1xuXG5jb25zdCBlbnVtIE1hcmtlck1vdmVTZW1hbnRpY3Mge1xuXHRNYXJrZXJEZWZpbmVkID0gMCxcblx0Rm9yY2VNb3ZlID0gMSxcblx0Rm9yY2VTdGF5ID0gMlxufVxuXG5mdW5jdGlvbiBhZGp1c3RNYXJrZXJCZWZvcmVDb2x1bW4obWFya2VyT2Zmc2V0OiBudW1iZXIsIG1hcmtlclN0aWNrVG9QcmV2aW91c0NoYXJhY3RlcjogYm9vbGVhbiwgY2hlY2tPZmZzZXQ6IG51bWJlciwgbW92ZVNlbWFudGljczogTWFya2VyTW92ZVNlbWFudGljcyk6IGJvb2xlYW4ge1xuXHRpZiAobWFya2VyT2Zmc2V0IDwgY2hlY2tPZmZzZXQpIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRpZiAobWFya2VyT2Zmc2V0ID4gY2hlY2tPZmZzZXQpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKG1vdmVTZW1hbnRpY3MgPT09IE1hcmtlck1vdmVTZW1hbnRpY3MuRm9yY2VNb3ZlKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdGlmIChtb3ZlU2VtYW50aWNzID09PSBNYXJrZXJNb3ZlU2VtYW50aWNzLkZvcmNlU3RheSkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHJldHVybiBtYXJrZXJTdGlja1RvUHJldmlvdXNDaGFyYWN0ZXI7XG59XG5cbi8qKlxuICogVGhpcyBpcyBhIGxvdCBtb3JlIGNvbXBsaWNhdGVkIHRoYW4gc3RyaWN0bHkgbmVjZXNzYXJ5IHRvIG1haW50YWluIHRoZSBzYW1lIGJlaGF2aW91clxuICogYXMgd2hlbiBkZWNvcmF0aW9ucyB3ZXJlIGltcGxlbWVudGVkIHVzaW5nIHR3byBtYXJrZXJzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbm9kZUFjY2VwdEVkaXQobm9kZTogSW50ZXJ2YWxOb2RlLCBzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlciwgdGV4dExlbmd0aDogbnVtYmVyLCBmb3JjZU1vdmVNYXJrZXJzOiBib29sZWFuKTogdm9pZCB7XG5cdGNvbnN0IG5vZGVTdGlja2luZXNzID0gZ2V0Tm9kZVN0aWNraW5lc3Mobm9kZSk7XG5cdGNvbnN0IHN0YXJ0U3RpY2tUb1ByZXZpb3VzQ2hhcmFjdGVyID0gKFxuXHRcdG5vZGVTdGlja2luZXNzID09PSBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXNcblx0XHR8fCBub2RlU3RpY2tpbmVzcyA9PT0gVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlXG5cdCk7XG5cdGNvbnN0IGVuZFN0aWNrVG9QcmV2aW91c0NoYXJhY3RlciA9IChcblx0XHRub2RlU3RpY2tpbmVzcyA9PT0gVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXNcblx0XHR8fCBub2RlU3RpY2tpbmVzcyA9PT0gVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlXG5cdCk7XG5cblx0Y29uc3QgZGVsZXRpbmdDbnQgPSAoZW5kIC0gc3RhcnQpO1xuXHRjb25zdCBpbnNlcnRpbmdDbnQgPSB0ZXh0TGVuZ3RoO1xuXHRjb25zdCBjb21tb25MZW5ndGggPSBNYXRoLm1pbihkZWxldGluZ0NudCwgaW5zZXJ0aW5nQ250KTtcblxuXHRjb25zdCBub2RlU3RhcnQgPSBub2RlLnN0YXJ0O1xuXHRsZXQgc3RhcnREb25lID0gZmFsc2U7XG5cblx0Y29uc3Qgbm9kZUVuZCA9IG5vZGUuZW5kO1xuXHRsZXQgZW5kRG9uZSA9IGZhbHNlO1xuXG5cdGlmIChzdGFydCA8PSBub2RlU3RhcnQgJiYgbm9kZUVuZCA8PSBlbmQgJiYgZ2V0Q29sbGFwc2VPblJlcGxhY2VFZGl0KG5vZGUpKSB7XG5cdFx0Ly8gVGhpcyBlZGl0IGVuY29tcGFzc2VzIHRoZSBlbnRpcmUgZGVjb3JhdGlvbiByYW5nZVxuXHRcdC8vIGFuZCB0aGUgZGVjb3JhdGlvbiBoYXMgYXNrZWQgdG8gYmVjb21lIGNvbGxhcHNlZFxuXHRcdG5vZGUuc3RhcnQgPSBzdGFydDtcblx0XHRzdGFydERvbmUgPSB0cnVlO1xuXHRcdG5vZGUuZW5kID0gc3RhcnQ7XG5cdFx0ZW5kRG9uZSA9IHRydWU7XG5cdH1cblxuXHR7XG5cdFx0Y29uc3QgbW92ZVNlbWFudGljcyA9IGZvcmNlTW92ZU1hcmtlcnMgPyBNYXJrZXJNb3ZlU2VtYW50aWNzLkZvcmNlTW92ZSA6IChkZWxldGluZ0NudCA+IDAgPyBNYXJrZXJNb3ZlU2VtYW50aWNzLkZvcmNlU3RheSA6IE1hcmtlck1vdmVTZW1hbnRpY3MuTWFya2VyRGVmaW5lZCk7XG5cdFx0aWYgKCFzdGFydERvbmUgJiYgYWRqdXN0TWFya2VyQmVmb3JlQ29sdW1uKG5vZGVTdGFydCwgc3RhcnRTdGlja1RvUHJldmlvdXNDaGFyYWN0ZXIsIHN0YXJ0LCBtb3ZlU2VtYW50aWNzKSkge1xuXHRcdFx0c3RhcnREb25lID0gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKCFlbmREb25lICYmIGFkanVzdE1hcmtlckJlZm9yZUNvbHVtbihub2RlRW5kLCBlbmRTdGlja1RvUHJldmlvdXNDaGFyYWN0ZXIsIHN0YXJ0LCBtb3ZlU2VtYW50aWNzKSkge1xuXHRcdFx0ZW5kRG9uZSA9IHRydWU7XG5cdFx0fVxuXHR9XG5cblx0aWYgKGNvbW1vbkxlbmd0aCA+IDAgJiYgIWZvcmNlTW92ZU1hcmtlcnMpIHtcblx0XHRjb25zdCBtb3ZlU2VtYW50aWNzID0gKGRlbGV0aW5nQ250ID4gaW5zZXJ0aW5nQ250ID8gTWFya2VyTW92ZVNlbWFudGljcy5Gb3JjZVN0YXkgOiBNYXJrZXJNb3ZlU2VtYW50aWNzLk1hcmtlckRlZmluZWQpO1xuXHRcdGlmICghc3RhcnREb25lICYmIGFkanVzdE1hcmtlckJlZm9yZUNvbHVtbihub2RlU3RhcnQsIHN0YXJ0U3RpY2tUb1ByZXZpb3VzQ2hhcmFjdGVyLCBzdGFydCArIGNvbW1vbkxlbmd0aCwgbW92ZVNlbWFudGljcykpIHtcblx0XHRcdHN0YXJ0RG9uZSA9IHRydWU7XG5cdFx0fVxuXHRcdGlmICghZW5kRG9uZSAmJiBhZGp1c3RNYXJrZXJCZWZvcmVDb2x1bW4obm9kZUVuZCwgZW5kU3RpY2tUb1ByZXZpb3VzQ2hhcmFjdGVyLCBzdGFydCArIGNvbW1vbkxlbmd0aCwgbW92ZVNlbWFudGljcykpIHtcblx0XHRcdGVuZERvbmUgPSB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdHtcblx0XHRjb25zdCBtb3ZlU2VtYW50aWNzID0gZm9yY2VNb3ZlTWFya2VycyA/IE1hcmtlck1vdmVTZW1hbnRpY3MuRm9yY2VNb3ZlIDogTWFya2VyTW92ZVNlbWFudGljcy5NYXJrZXJEZWZpbmVkO1xuXHRcdGlmICghc3RhcnREb25lICYmIGFkanVzdE1hcmtlckJlZm9yZUNvbHVtbihub2RlU3RhcnQsIHN0YXJ0U3RpY2tUb1ByZXZpb3VzQ2hhcmFjdGVyLCBlbmQsIG1vdmVTZW1hbnRpY3MpKSB7XG5cdFx0XHRub2RlLnN0YXJ0ID0gc3RhcnQgKyBpbnNlcnRpbmdDbnQ7XG5cdFx0XHRzdGFydERvbmUgPSB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIWVuZERvbmUgJiYgYWRqdXN0TWFya2VyQmVmb3JlQ29sdW1uKG5vZGVFbmQsIGVuZFN0aWNrVG9QcmV2aW91c0NoYXJhY3RlciwgZW5kLCBtb3ZlU2VtYW50aWNzKSkge1xuXHRcdFx0bm9kZS5lbmQgPSBzdGFydCArIGluc2VydGluZ0NudDtcblx0XHRcdGVuZERvbmUgPSB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdC8vIEZpbmlzaFxuXHRjb25zdCBkZWx0YUNvbHVtbiA9IChpbnNlcnRpbmdDbnQgLSBkZWxldGluZ0NudCk7XG5cdGlmICghc3RhcnREb25lKSB7XG5cdFx0bm9kZS5zdGFydCA9IE1hdGgubWF4KDAsIG5vZGVTdGFydCArIGRlbHRhQ29sdW1uKTtcblx0fVxuXHRpZiAoIWVuZERvbmUpIHtcblx0XHRub2RlLmVuZCA9IE1hdGgubWF4KDAsIG5vZGVFbmQgKyBkZWx0YUNvbHVtbik7XG5cdH1cblxuXHRpZiAobm9kZS5zdGFydCA+IG5vZGUuZW5kKSB7XG5cdFx0bm9kZS5lbmQgPSBub2RlLnN0YXJ0O1xuXHR9XG59XG5cbmZ1bmN0aW9uIHNlYXJjaEZvckVkaXRpbmcoVDogSW50ZXJ2YWxUcmVlLCBzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlcik6IEludGVydmFsTm9kZVtdIHtcblx0Ly8gaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSW50ZXJ2YWxfdHJlZSNBdWdtZW50ZWRfdHJlZVxuXHQvLyBOb3csIGl0IGlzIGtub3duIHRoYXQgdHdvIGludGVydmFscyBBIGFuZCBCIG92ZXJsYXAgb25seSB3aGVuIGJvdGhcblx0Ly8gQS5sb3cgPD0gQi5oaWdoIGFuZCBBLmhpZ2ggPj0gQi5sb3cuIFdoZW4gc2VhcmNoaW5nIHRoZSB0cmVlcyBmb3Jcblx0Ly8gbm9kZXMgb3ZlcmxhcHBpbmcgd2l0aCBhIGdpdmVuIGludGVydmFsLCB5b3UgY2FuIGltbWVkaWF0ZWx5IHNraXA6XG5cdC8vICBhKSBhbGwgbm9kZXMgdG8gdGhlIHJpZ2h0IG9mIG5vZGVzIHdob3NlIGxvdyB2YWx1ZSBpcyBwYXN0IHRoZSBlbmQgb2YgdGhlIGdpdmVuIGludGVydmFsLlxuXHQvLyAgYikgYWxsIG5vZGVzIHRoYXQgaGF2ZSB0aGVpciBtYXhpbXVtICdoaWdoJyB2YWx1ZSBiZWxvdyB0aGUgc3RhcnQgb2YgdGhlIGdpdmVuIGludGVydmFsLlxuXHRsZXQgbm9kZSA9IFQucm9vdDtcblx0bGV0IGRlbHRhID0gMDtcblx0bGV0IG5vZGVNYXhFbmQgPSAwO1xuXHRsZXQgbm9kZVN0YXJ0ID0gMDtcblx0bGV0IG5vZGVFbmQgPSAwO1xuXHRjb25zdCByZXN1bHQ6IEludGVydmFsTm9kZVtdID0gW107XG5cdGxldCByZXN1bHRMZW4gPSAwO1xuXHR3aGlsZSAobm9kZSAhPT0gU0VOVElORUwpIHtcblx0XHRpZiAoZ2V0Tm9kZUlzVmlzaXRlZChub2RlKSkge1xuXHRcdFx0Ly8gZ29pbmcgdXAgZnJvbSB0aGlzIG5vZGVcblx0XHRcdHNldE5vZGVJc1Zpc2l0ZWQobm9kZS5sZWZ0LCBmYWxzZSk7XG5cdFx0XHRzZXROb2RlSXNWaXNpdGVkKG5vZGUucmlnaHQsIGZhbHNlKTtcblx0XHRcdGlmIChub2RlID09PSBub2RlLnBhcmVudC5yaWdodCkge1xuXHRcdFx0XHRkZWx0YSAtPSBub2RlLnBhcmVudC5kZWx0YTtcblx0XHRcdH1cblx0XHRcdG5vZGUgPSBub2RlLnBhcmVudDtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdGlmICghZ2V0Tm9kZUlzVmlzaXRlZChub2RlLmxlZnQpKSB7XG5cdFx0XHQvLyBmaXJzdCB0aW1lIHNlZWluZyB0aGlzIG5vZGVcblx0XHRcdG5vZGVNYXhFbmQgPSBkZWx0YSArIG5vZGUubWF4RW5kO1xuXHRcdFx0aWYgKG5vZGVNYXhFbmQgPCBzdGFydCkge1xuXHRcdFx0XHQvLyBjb3ZlciBjYXNlIGIpIGZyb20gYWJvdmVcblx0XHRcdFx0Ly8gdGhlcmUgaXMgbm8gbmVlZCB0byBzZWFyY2ggdGhpcyBub2RlIG9yIGl0cyBjaGlsZHJlblxuXHRcdFx0XHRzZXROb2RlSXNWaXNpdGVkKG5vZGUsIHRydWUpO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG5vZGUubGVmdCAhPT0gU0VOVElORUwpIHtcblx0XHRcdFx0Ly8gZ28gbGVmdFxuXHRcdFx0XHRub2RlID0gbm9kZS5sZWZ0O1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBoYW5kbGUgY3VycmVudCBub2RlXG5cdFx0bm9kZVN0YXJ0ID0gZGVsdGEgKyBub2RlLnN0YXJ0O1xuXHRcdGlmIChub2RlU3RhcnQgPiBlbmQpIHtcblx0XHRcdC8vIGNvdmVyIGNhc2UgYSkgZnJvbSBhYm92ZVxuXHRcdFx0Ly8gdGhlcmUgaXMgbm8gbmVlZCB0byBzZWFyY2ggdGhpcyBub2RlIG9yIGl0cyByaWdodCBzdWJ0cmVlXG5cdFx0XHRzZXROb2RlSXNWaXNpdGVkKG5vZGUsIHRydWUpO1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0bm9kZUVuZCA9IGRlbHRhICsgbm9kZS5lbmQ7XG5cdFx0aWYgKG5vZGVFbmQgPj0gc3RhcnQpIHtcblx0XHRcdG5vZGUuc2V0Q2FjaGVkT2Zmc2V0cyhub2RlU3RhcnQsIG5vZGVFbmQsIDApO1xuXHRcdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IG5vZGU7XG5cdFx0fVxuXHRcdHNldE5vZGVJc1Zpc2l0ZWQobm9kZSwgdHJ1ZSk7XG5cblx0XHRpZiAobm9kZS5yaWdodCAhPT0gU0VOVElORUwgJiYgIWdldE5vZGVJc1Zpc2l0ZWQobm9kZS5yaWdodCkpIHtcblx0XHRcdC8vIGdvIHJpZ2h0XG5cdFx0XHRkZWx0YSArPSBub2RlLmRlbHRhO1xuXHRcdFx0bm9kZSA9IG5vZGUucmlnaHQ7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cdH1cblxuXHRzZXROb2RlSXNWaXNpdGVkKFQucm9vdCwgZmFsc2UpO1xuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIG5vT3ZlcmxhcFJlcGxhY2UoVDogSW50ZXJ2YWxUcmVlLCBzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlciwgdGV4dExlbmd0aDogbnVtYmVyKTogdm9pZCB7XG5cdC8vIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0ludGVydmFsX3RyZWUjQXVnbWVudGVkX3RyZWVcblx0Ly8gTm93LCBpdCBpcyBrbm93biB0aGF0IHR3byBpbnRlcnZhbHMgQSBhbmQgQiBvdmVybGFwIG9ubHkgd2hlbiBib3RoXG5cdC8vIEEubG93IDw9IEIuaGlnaCBhbmQgQS5oaWdoID49IEIubG93LiBXaGVuIHNlYXJjaGluZyB0aGUgdHJlZXMgZm9yXG5cdC8vIG5vZGVzIG92ZXJsYXBwaW5nIHdpdGggYSBnaXZlbiBpbnRlcnZhbCwgeW91IGNhbiBpbW1lZGlhdGVseSBza2lwOlxuXHQvLyAgYSkgYWxsIG5vZGVzIHRvIHRoZSByaWdodCBvZiBub2RlcyB3aG9zZSBsb3cgdmFsdWUgaXMgcGFzdCB0aGUgZW5kIG9mIHRoZSBnaXZlbiBpbnRlcnZhbC5cblx0Ly8gIGIpIGFsbCBub2RlcyB0aGF0IGhhdmUgdGhlaXIgbWF4aW11bSAnaGlnaCcgdmFsdWUgYmVsb3cgdGhlIHN0YXJ0IG9mIHRoZSBnaXZlbiBpbnRlcnZhbC5cblx0bGV0IG5vZGUgPSBULnJvb3Q7XG5cdGxldCBkZWx0YSA9IDA7XG5cdGxldCBub2RlTWF4RW5kID0gMDtcblx0bGV0IG5vZGVTdGFydCA9IDA7XG5cdGNvbnN0IGVkaXREZWx0YSA9ICh0ZXh0TGVuZ3RoIC0gKGVuZCAtIHN0YXJ0KSk7XG5cdHdoaWxlIChub2RlICE9PSBTRU5USU5FTCkge1xuXHRcdGlmIChnZXROb2RlSXNWaXNpdGVkKG5vZGUpKSB7XG5cdFx0XHQvLyBnb2luZyB1cCBmcm9tIHRoaXMgbm9kZVxuXHRcdFx0c2V0Tm9kZUlzVmlzaXRlZChub2RlLmxlZnQsIGZhbHNlKTtcblx0XHRcdHNldE5vZGVJc1Zpc2l0ZWQobm9kZS5yaWdodCwgZmFsc2UpO1xuXHRcdFx0aWYgKG5vZGUgPT09IG5vZGUucGFyZW50LnJpZ2h0KSB7XG5cdFx0XHRcdGRlbHRhIC09IG5vZGUucGFyZW50LmRlbHRhO1xuXHRcdFx0fVxuXHRcdFx0cmVjb21wdXRlTWF4RW5kKG5vZGUpO1xuXHRcdFx0bm9kZSA9IG5vZGUucGFyZW50O1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0aWYgKCFnZXROb2RlSXNWaXNpdGVkKG5vZGUubGVmdCkpIHtcblx0XHRcdC8vIGZpcnN0IHRpbWUgc2VlaW5nIHRoaXMgbm9kZVxuXHRcdFx0bm9kZU1heEVuZCA9IGRlbHRhICsgbm9kZS5tYXhFbmQ7XG5cdFx0XHRpZiAobm9kZU1heEVuZCA8IHN0YXJ0KSB7XG5cdFx0XHRcdC8vIGNvdmVyIGNhc2UgYikgZnJvbSBhYm92ZVxuXHRcdFx0XHQvLyB0aGVyZSBpcyBubyBuZWVkIHRvIHNlYXJjaCB0aGlzIG5vZGUgb3IgaXRzIGNoaWxkcmVuXG5cdFx0XHRcdHNldE5vZGVJc1Zpc2l0ZWQobm9kZSwgdHJ1ZSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAobm9kZS5sZWZ0ICE9PSBTRU5USU5FTCkge1xuXHRcdFx0XHQvLyBnbyBsZWZ0XG5cdFx0XHRcdG5vZGUgPSBub2RlLmxlZnQ7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGhhbmRsZSBjdXJyZW50IG5vZGVcblx0XHRub2RlU3RhcnQgPSBkZWx0YSArIG5vZGUuc3RhcnQ7XG5cdFx0aWYgKG5vZGVTdGFydCA+IGVuZCkge1xuXHRcdFx0bm9kZS5zdGFydCArPSBlZGl0RGVsdGE7XG5cdFx0XHRub2RlLmVuZCArPSBlZGl0RGVsdGE7XG5cdFx0XHRub2RlLmRlbHRhICs9IGVkaXREZWx0YTtcblx0XHRcdGlmIChub2RlLmRlbHRhIDwgQ29uc3RhbnRzLk1JTl9TQUZFX0RFTFRBIHx8IG5vZGUuZGVsdGEgPiBDb25zdGFudHMuTUFYX1NBRkVfREVMVEEpIHtcblx0XHRcdFx0VC5yZXF1ZXN0Tm9ybWFsaXplRGVsdGEgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Ly8gY292ZXIgY2FzZSBhKSBmcm9tIGFib3ZlXG5cdFx0XHQvLyB0aGVyZSBpcyBubyBuZWVkIHRvIHNlYXJjaCB0aGlzIG5vZGUgb3IgaXRzIHJpZ2h0IHN1YnRyZWVcblx0XHRcdHNldE5vZGVJc1Zpc2l0ZWQobm9kZSwgdHJ1ZSk7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cblx0XHRzZXROb2RlSXNWaXNpdGVkKG5vZGUsIHRydWUpO1xuXG5cdFx0aWYgKG5vZGUucmlnaHQgIT09IFNFTlRJTkVMICYmICFnZXROb2RlSXNWaXNpdGVkKG5vZGUucmlnaHQpKSB7XG5cdFx0XHQvLyBnbyByaWdodFxuXHRcdFx0ZGVsdGEgKz0gbm9kZS5kZWx0YTtcblx0XHRcdG5vZGUgPSBub2RlLnJpZ2h0O1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXHR9XG5cblx0c2V0Tm9kZUlzVmlzaXRlZChULnJvb3QsIGZhbHNlKTtcbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBTZWFyY2hpbmdcblxuZnVuY3Rpb24gY29sbGVjdE5vZGVzRnJvbU93bmVyKFQ6IEludGVydmFsVHJlZSwgb3duZXJJZDogbnVtYmVyKTogSW50ZXJ2YWxOb2RlW10ge1xuXHRsZXQgbm9kZSA9IFQucm9vdDtcblx0Y29uc3QgcmVzdWx0OiBJbnRlcnZhbE5vZGVbXSA9IFtdO1xuXHRsZXQgcmVzdWx0TGVuID0gMDtcblx0d2hpbGUgKG5vZGUgIT09IFNFTlRJTkVMKSB7XG5cdFx0aWYgKGdldE5vZGVJc1Zpc2l0ZWQobm9kZSkpIHtcblx0XHRcdC8vIGdvaW5nIHVwIGZyb20gdGhpcyBub2RlXG5cdFx0XHRzZXROb2RlSXNWaXNpdGVkKG5vZGUubGVmdCwgZmFsc2UpO1xuXHRcdFx0c2V0Tm9kZUlzVmlzaXRlZChub2RlLnJpZ2h0LCBmYWxzZSk7XG5cdFx0XHRub2RlID0gbm9kZS5wYXJlbnQ7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cblx0XHRpZiAobm9kZS5sZWZ0ICE9PSBTRU5USU5FTCAmJiAhZ2V0Tm9kZUlzVmlzaXRlZChub2RlLmxlZnQpKSB7XG5cdFx0XHQvLyBnbyBsZWZ0XG5cdFx0XHRub2RlID0gbm9kZS5sZWZ0O1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0Ly8gaGFuZGxlIGN1cnJlbnQgbm9kZVxuXHRcdGlmIChub2RlLm93bmVySWQgPT09IG93bmVySWQpIHtcblx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSBub2RlO1xuXHRcdH1cblxuXHRcdHNldE5vZGVJc1Zpc2l0ZWQobm9kZSwgdHJ1ZSk7XG5cblx0XHRpZiAobm9kZS5yaWdodCAhPT0gU0VOVElORUwgJiYgIWdldE5vZGVJc1Zpc2l0ZWQobm9kZS5yaWdodCkpIHtcblx0XHRcdC8vIGdvIHJpZ2h0XG5cdFx0XHRub2RlID0gbm9kZS5yaWdodDtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblx0fVxuXG5cdHNldE5vZGVJc1Zpc2l0ZWQoVC5yb290LCBmYWxzZSk7XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gY29sbGVjdE5vZGVzUG9zdE9yZGVyKFQ6IEludGVydmFsVHJlZSk6IEludGVydmFsTm9kZVtdIHtcblx0bGV0IG5vZGUgPSBULnJvb3Q7XG5cdGNvbnN0IHJlc3VsdDogSW50ZXJ2YWxOb2RlW10gPSBbXTtcblx0bGV0IHJlc3VsdExlbiA9IDA7XG5cdHdoaWxlIChub2RlICE9PSBTRU5USU5FTCkge1xuXHRcdGlmIChnZXROb2RlSXNWaXNpdGVkKG5vZGUpKSB7XG5cdFx0XHQvLyBnb2luZyB1cCBmcm9tIHRoaXMgbm9kZVxuXHRcdFx0c2V0Tm9kZUlzVmlzaXRlZChub2RlLmxlZnQsIGZhbHNlKTtcblx0XHRcdHNldE5vZGVJc1Zpc2l0ZWQobm9kZS5yaWdodCwgZmFsc2UpO1xuXHRcdFx0bm9kZSA9IG5vZGUucGFyZW50O1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0aWYgKG5vZGUubGVmdCAhPT0gU0VOVElORUwgJiYgIWdldE5vZGVJc1Zpc2l0ZWQobm9kZS5sZWZ0KSkge1xuXHRcdFx0Ly8gZ28gbGVmdFxuXHRcdFx0bm9kZSA9IG5vZGUubGVmdDtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdGlmIChub2RlLnJpZ2h0ICE9PSBTRU5USU5FTCAmJiAhZ2V0Tm9kZUlzVmlzaXRlZChub2RlLnJpZ2h0KSkge1xuXHRcdFx0Ly8gZ28gcmlnaHRcblx0XHRcdG5vZGUgPSBub2RlLnJpZ2h0O1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0Ly8gaGFuZGxlIGN1cnJlbnQgbm9kZVxuXHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSBub2RlO1xuXHRcdHNldE5vZGVJc1Zpc2l0ZWQobm9kZSwgdHJ1ZSk7XG5cdH1cblxuXHRzZXROb2RlSXNWaXNpdGVkKFQucm9vdCwgZmFsc2UpO1xuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHNlYXJjaChUOiBJbnRlcnZhbFRyZWUsIGZpbHRlck93bmVySWQ6IG51bWJlciwgZmlsdGVyT3V0VmFsaWRhdGlvbjogYm9vbGVhbiwgY2FjaGVkVmVyc2lvbklkOiBudW1iZXIsIG9ubHlNYXJnaW5EZWNvcmF0aW9uczogYm9vbGVhbik6IEludGVydmFsTm9kZVtdIHtcblx0bGV0IG5vZGUgPSBULnJvb3Q7XG5cdGxldCBkZWx0YSA9IDA7XG5cdGxldCBub2RlU3RhcnQgPSAwO1xuXHRsZXQgbm9kZUVuZCA9IDA7XG5cdGNvbnN0IHJlc3VsdDogSW50ZXJ2YWxOb2RlW10gPSBbXTtcblx0bGV0IHJlc3VsdExlbiA9IDA7XG5cdHdoaWxlIChub2RlICE9PSBTRU5USU5FTCkge1xuXHRcdGlmIChnZXROb2RlSXNWaXNpdGVkKG5vZGUpKSB7XG5cdFx0XHQvLyBnb2luZyB1cCBmcm9tIHRoaXMgbm9kZVxuXHRcdFx0c2V0Tm9kZUlzVmlzaXRlZChub2RlLmxlZnQsIGZhbHNlKTtcblx0XHRcdHNldE5vZGVJc1Zpc2l0ZWQobm9kZS5yaWdodCwgZmFsc2UpO1xuXHRcdFx0aWYgKG5vZGUgPT09IG5vZGUucGFyZW50LnJpZ2h0KSB7XG5cdFx0XHRcdGRlbHRhIC09IG5vZGUucGFyZW50LmRlbHRhO1xuXHRcdFx0fVxuXHRcdFx0bm9kZSA9IG5vZGUucGFyZW50O1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0aWYgKG5vZGUubGVmdCAhPT0gU0VOVElORUwgJiYgIWdldE5vZGVJc1Zpc2l0ZWQobm9kZS5sZWZ0KSkge1xuXHRcdFx0Ly8gZ28gbGVmdFxuXHRcdFx0bm9kZSA9IG5vZGUubGVmdDtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdC8vIGhhbmRsZSBjdXJyZW50IG5vZGVcblx0XHRub2RlU3RhcnQgPSBkZWx0YSArIG5vZGUuc3RhcnQ7XG5cdFx0bm9kZUVuZCA9IGRlbHRhICsgbm9kZS5lbmQ7XG5cblx0XHRub2RlLnNldENhY2hlZE9mZnNldHMobm9kZVN0YXJ0LCBub2RlRW5kLCBjYWNoZWRWZXJzaW9uSWQpO1xuXG5cdFx0bGV0IGluY2x1ZGUgPSB0cnVlO1xuXHRcdGlmIChmaWx0ZXJPd25lcklkICYmIG5vZGUub3duZXJJZCAmJiBub2RlLm93bmVySWQgIT09IGZpbHRlck93bmVySWQpIHtcblx0XHRcdGluY2x1ZGUgPSBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKGZpbHRlck91dFZhbGlkYXRpb24gJiYgZ2V0Tm9kZUlzRm9yVmFsaWRhdGlvbihub2RlKSkge1xuXHRcdFx0aW5jbHVkZSA9IGZhbHNlO1xuXHRcdH1cblx0XHRpZiAob25seU1hcmdpbkRlY29yYXRpb25zICYmICFnZXROb2RlSXNJbkdseXBoTWFyZ2luKG5vZGUpKSB7XG5cdFx0XHRpbmNsdWRlID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKGluY2x1ZGUpIHtcblx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSBub2RlO1xuXHRcdH1cblxuXHRcdHNldE5vZGVJc1Zpc2l0ZWQobm9kZSwgdHJ1ZSk7XG5cblx0XHRpZiAobm9kZS5yaWdodCAhPT0gU0VOVElORUwgJiYgIWdldE5vZGVJc1Zpc2l0ZWQobm9kZS5yaWdodCkpIHtcblx0XHRcdC8vIGdvIHJpZ2h0XG5cdFx0XHRkZWx0YSArPSBub2RlLmRlbHRhO1xuXHRcdFx0bm9kZSA9IG5vZGUucmlnaHQ7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cdH1cblxuXHRzZXROb2RlSXNWaXNpdGVkKFQucm9vdCwgZmFsc2UpO1xuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGludGVydmFsU2VhcmNoKFQ6IEludGVydmFsVHJlZSwgaW50ZXJ2YWxTdGFydDogbnVtYmVyLCBpbnRlcnZhbEVuZDogbnVtYmVyLCBmaWx0ZXJPd25lcklkOiBudW1iZXIsIGZpbHRlck91dFZhbGlkYXRpb246IGJvb2xlYW4sIGNhY2hlZFZlcnNpb25JZDogbnVtYmVyLCBvbmx5TWFyZ2luRGVjb3JhdGlvbnM6IGJvb2xlYW4pOiBJbnRlcnZhbE5vZGVbXSB7XG5cdC8vIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0ludGVydmFsX3RyZWUjQXVnbWVudGVkX3RyZWVcblx0Ly8gTm93LCBpdCBpcyBrbm93biB0aGF0IHR3byBpbnRlcnZhbHMgQSBhbmQgQiBvdmVybGFwIG9ubHkgd2hlbiBib3RoXG5cdC8vIEEubG93IDw9IEIuaGlnaCBhbmQgQS5oaWdoID49IEIubG93LiBXaGVuIHNlYXJjaGluZyB0aGUgdHJlZXMgZm9yXG5cdC8vIG5vZGVzIG92ZXJsYXBwaW5nIHdpdGggYSBnaXZlbiBpbnRlcnZhbCwgeW91IGNhbiBpbW1lZGlhdGVseSBza2lwOlxuXHQvLyAgYSkgYWxsIG5vZGVzIHRvIHRoZSByaWdodCBvZiBub2RlcyB3aG9zZSBsb3cgdmFsdWUgaXMgcGFzdCB0aGUgZW5kIG9mIHRoZSBnaXZlbiBpbnRlcnZhbC5cblx0Ly8gIGIpIGFsbCBub2RlcyB0aGF0IGhhdmUgdGhlaXIgbWF4aW11bSAnaGlnaCcgdmFsdWUgYmVsb3cgdGhlIHN0YXJ0IG9mIHRoZSBnaXZlbiBpbnRlcnZhbC5cblxuXHRsZXQgbm9kZSA9IFQucm9vdDtcblx0bGV0IGRlbHRhID0gMDtcblx0bGV0IG5vZGVNYXhFbmQgPSAwO1xuXHRsZXQgbm9kZVN0YXJ0ID0gMDtcblx0bGV0IG5vZGVFbmQgPSAwO1xuXHRjb25zdCByZXN1bHQ6IEludGVydmFsTm9kZVtdID0gW107XG5cdGxldCByZXN1bHRMZW4gPSAwO1xuXHR3aGlsZSAobm9kZSAhPT0gU0VOVElORUwpIHtcblx0XHRpZiAoZ2V0Tm9kZUlzVmlzaXRlZChub2RlKSkge1xuXHRcdFx0Ly8gZ29pbmcgdXAgZnJvbSB0aGlzIG5vZGVcblx0XHRcdHNldE5vZGVJc1Zpc2l0ZWQobm9kZS5sZWZ0LCBmYWxzZSk7XG5cdFx0XHRzZXROb2RlSXNWaXNpdGVkKG5vZGUucmlnaHQsIGZhbHNlKTtcblx0XHRcdGlmIChub2RlID09PSBub2RlLnBhcmVudC5yaWdodCkge1xuXHRcdFx0XHRkZWx0YSAtPSBub2RlLnBhcmVudC5kZWx0YTtcblx0XHRcdH1cblx0XHRcdG5vZGUgPSBub2RlLnBhcmVudDtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdGlmICghZ2V0Tm9kZUlzVmlzaXRlZChub2RlLmxlZnQpKSB7XG5cdFx0XHQvLyBmaXJzdCB0aW1lIHNlZWluZyB0aGlzIG5vZGVcblx0XHRcdG5vZGVNYXhFbmQgPSBkZWx0YSArIG5vZGUubWF4RW5kO1xuXHRcdFx0aWYgKG5vZGVNYXhFbmQgPCBpbnRlcnZhbFN0YXJ0KSB7XG5cdFx0XHRcdC8vIGNvdmVyIGNhc2UgYikgZnJvbSBhYm92ZVxuXHRcdFx0XHQvLyB0aGVyZSBpcyBubyBuZWVkIHRvIHNlYXJjaCB0aGlzIG5vZGUgb3IgaXRzIGNoaWxkcmVuXG5cdFx0XHRcdHNldE5vZGVJc1Zpc2l0ZWQobm9kZSwgdHJ1ZSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAobm9kZS5sZWZ0ICE9PSBTRU5USU5FTCkge1xuXHRcdFx0XHQvLyBnbyBsZWZ0XG5cdFx0XHRcdG5vZGUgPSBub2RlLmxlZnQ7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGhhbmRsZSBjdXJyZW50IG5vZGVcblx0XHRub2RlU3RhcnQgPSBkZWx0YSArIG5vZGUuc3RhcnQ7XG5cdFx0aWYgKG5vZGVTdGFydCA+IGludGVydmFsRW5kKSB7XG5cdFx0XHQvLyBjb3ZlciBjYXNlIGEpIGZyb20gYWJvdmVcblx0XHRcdC8vIHRoZXJlIGlzIG5vIG5lZWQgdG8gc2VhcmNoIHRoaXMgbm9kZSBvciBpdHMgcmlnaHQgc3VidHJlZVxuXHRcdFx0c2V0Tm9kZUlzVmlzaXRlZChub2RlLCB0cnVlKTtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdG5vZGVFbmQgPSBkZWx0YSArIG5vZGUuZW5kO1xuXG5cdFx0aWYgKG5vZGVFbmQgPj0gaW50ZXJ2YWxTdGFydCkge1xuXHRcdFx0Ly8gVGhlcmUgaXMgb3ZlcmxhcFxuXHRcdFx0bm9kZS5zZXRDYWNoZWRPZmZzZXRzKG5vZGVTdGFydCwgbm9kZUVuZCwgY2FjaGVkVmVyc2lvbklkKTtcblxuXHRcdFx0bGV0IGluY2x1ZGUgPSB0cnVlO1xuXHRcdFx0aWYgKGZpbHRlck93bmVySWQgJiYgbm9kZS5vd25lcklkICYmIG5vZGUub3duZXJJZCAhPT0gZmlsdGVyT3duZXJJZCkge1xuXHRcdFx0XHRpbmNsdWRlID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZmlsdGVyT3V0VmFsaWRhdGlvbiAmJiBnZXROb2RlSXNGb3JWYWxpZGF0aW9uKG5vZGUpKSB7XG5cdFx0XHRcdGluY2x1ZGUgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmIChvbmx5TWFyZ2luRGVjb3JhdGlvbnMgJiYgIWdldE5vZGVJc0luR2x5cGhNYXJnaW4obm9kZSkpIHtcblx0XHRcdFx0aW5jbHVkZSA9IGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5jbHVkZSkge1xuXHRcdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gbm9kZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRzZXROb2RlSXNWaXNpdGVkKG5vZGUsIHRydWUpO1xuXG5cdFx0aWYgKG5vZGUucmlnaHQgIT09IFNFTlRJTkVMICYmICFnZXROb2RlSXNWaXNpdGVkKG5vZGUucmlnaHQpKSB7XG5cdFx0XHQvLyBnbyByaWdodFxuXHRcdFx0ZGVsdGEgKz0gbm9kZS5kZWx0YTtcblx0XHRcdG5vZGUgPSBub2RlLnJpZ2h0O1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXHR9XG5cblx0c2V0Tm9kZUlzVmlzaXRlZChULnJvb3QsIGZhbHNlKTtcblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIEluc2VydGlvblxuZnVuY3Rpb24gcmJUcmVlSW5zZXJ0KFQ6IEludGVydmFsVHJlZSwgbmV3Tm9kZTogSW50ZXJ2YWxOb2RlKTogSW50ZXJ2YWxOb2RlIHtcblx0aWYgKFQucm9vdCA9PT0gU0VOVElORUwpIHtcblx0XHRuZXdOb2RlLnBhcmVudCA9IFNFTlRJTkVMO1xuXHRcdG5ld05vZGUubGVmdCA9IFNFTlRJTkVMO1xuXHRcdG5ld05vZGUucmlnaHQgPSBTRU5USU5FTDtcblx0XHRzZXROb2RlQ29sb3IobmV3Tm9kZSwgTm9kZUNvbG9yLkJsYWNrKTtcblx0XHRULnJvb3QgPSBuZXdOb2RlO1xuXHRcdHJldHVybiBULnJvb3Q7XG5cdH1cblxuXHR0cmVlSW5zZXJ0KFQsIG5ld05vZGUpO1xuXG5cdHJlY29tcHV0ZU1heEVuZFdhbGtUb1Jvb3QobmV3Tm9kZS5wYXJlbnQpO1xuXG5cdC8vIHJlcGFpciB0cmVlXG5cdGxldCB4ID0gbmV3Tm9kZTtcblx0d2hpbGUgKHggIT09IFQucm9vdCAmJiBnZXROb2RlQ29sb3IoeC5wYXJlbnQpID09PSBOb2RlQ29sb3IuUmVkKSB7XG5cdFx0aWYgKHgucGFyZW50ID09PSB4LnBhcmVudC5wYXJlbnQubGVmdCkge1xuXHRcdFx0Y29uc3QgeSA9IHgucGFyZW50LnBhcmVudC5yaWdodDtcblxuXHRcdFx0aWYgKGdldE5vZGVDb2xvcih5KSA9PT0gTm9kZUNvbG9yLlJlZCkge1xuXHRcdFx0XHRzZXROb2RlQ29sb3IoeC5wYXJlbnQsIE5vZGVDb2xvci5CbGFjayk7XG5cdFx0XHRcdHNldE5vZGVDb2xvcih5LCBOb2RlQ29sb3IuQmxhY2spO1xuXHRcdFx0XHRzZXROb2RlQ29sb3IoeC5wYXJlbnQucGFyZW50LCBOb2RlQ29sb3IuUmVkKTtcblx0XHRcdFx0eCA9IHgucGFyZW50LnBhcmVudDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICh4ID09PSB4LnBhcmVudC5yaWdodCkge1xuXHRcdFx0XHRcdHggPSB4LnBhcmVudDtcblx0XHRcdFx0XHRsZWZ0Um90YXRlKFQsIHgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNldE5vZGVDb2xvcih4LnBhcmVudCwgTm9kZUNvbG9yLkJsYWNrKTtcblx0XHRcdFx0c2V0Tm9kZUNvbG9yKHgucGFyZW50LnBhcmVudCwgTm9kZUNvbG9yLlJlZCk7XG5cdFx0XHRcdHJpZ2h0Um90YXRlKFQsIHgucGFyZW50LnBhcmVudCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHkgPSB4LnBhcmVudC5wYXJlbnQubGVmdDtcblxuXHRcdFx0aWYgKGdldE5vZGVDb2xvcih5KSA9PT0gTm9kZUNvbG9yLlJlZCkge1xuXHRcdFx0XHRzZXROb2RlQ29sb3IoeC5wYXJlbnQsIE5vZGVDb2xvci5CbGFjayk7XG5cdFx0XHRcdHNldE5vZGVDb2xvcih5LCBOb2RlQ29sb3IuQmxhY2spO1xuXHRcdFx0XHRzZXROb2RlQ29sb3IoeC5wYXJlbnQucGFyZW50LCBOb2RlQ29sb3IuUmVkKTtcblx0XHRcdFx0eCA9IHgucGFyZW50LnBhcmVudDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICh4ID09PSB4LnBhcmVudC5sZWZ0KSB7XG5cdFx0XHRcdFx0eCA9IHgucGFyZW50O1xuXHRcdFx0XHRcdHJpZ2h0Um90YXRlKFQsIHgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNldE5vZGVDb2xvcih4LnBhcmVudCwgTm9kZUNvbG9yLkJsYWNrKTtcblx0XHRcdFx0c2V0Tm9kZUNvbG9yKHgucGFyZW50LnBhcmVudCwgTm9kZUNvbG9yLlJlZCk7XG5cdFx0XHRcdGxlZnRSb3RhdGUoVCwgeC5wYXJlbnQucGFyZW50KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRzZXROb2RlQ29sb3IoVC5yb290LCBOb2RlQ29sb3IuQmxhY2spO1xuXG5cdHJldHVybiBuZXdOb2RlO1xufVxuXG5mdW5jdGlvbiB0cmVlSW5zZXJ0KFQ6IEludGVydmFsVHJlZSwgejogSW50ZXJ2YWxOb2RlKTogdm9pZCB7XG5cdGxldCBkZWx0YTogbnVtYmVyID0gMDtcblx0bGV0IHggPSBULnJvb3Q7XG5cdGNvbnN0IHpBYnNvbHV0ZVN0YXJ0ID0gei5zdGFydDtcblx0Y29uc3QgekFic29sdXRlRW5kID0gei5lbmQ7XG5cdHdoaWxlICh0cnVlKSB7XG5cdFx0Y29uc3QgY21wID0gaW50ZXJ2YWxDb21wYXJlKHpBYnNvbHV0ZVN0YXJ0LCB6QWJzb2x1dGVFbmQsIHguc3RhcnQgKyBkZWx0YSwgeC5lbmQgKyBkZWx0YSk7XG5cdFx0aWYgKGNtcCA8IDApIHtcblx0XHRcdC8vIHRoaXMgbm9kZSBzaG91bGQgYmUgaW5zZXJ0ZWQgdG8gdGhlIGxlZnRcblx0XHRcdC8vID0+IGl0IGlzIG5vdCBhZmZlY3RlZCBieSB0aGUgbm9kZSdzIGRlbHRhXG5cdFx0XHRpZiAoeC5sZWZ0ID09PSBTRU5USU5FTCkge1xuXHRcdFx0XHR6LnN0YXJ0IC09IGRlbHRhO1xuXHRcdFx0XHR6LmVuZCAtPSBkZWx0YTtcblx0XHRcdFx0ei5tYXhFbmQgLT0gZGVsdGE7XG5cdFx0XHRcdHgubGVmdCA9IHo7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0eCA9IHgubGVmdDtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gdGhpcyBub2RlIHNob3VsZCBiZSBpbnNlcnRlZCB0byB0aGUgcmlnaHRcblx0XHRcdC8vID0+IGl0IGlzIG5vdCBhZmZlY3RlZCBieSB0aGUgbm9kZSdzIGRlbHRhXG5cdFx0XHRpZiAoeC5yaWdodCA9PT0gU0VOVElORUwpIHtcblx0XHRcdFx0ei5zdGFydCAtPSAoZGVsdGEgKyB4LmRlbHRhKTtcblx0XHRcdFx0ei5lbmQgLT0gKGRlbHRhICsgeC5kZWx0YSk7XG5cdFx0XHRcdHoubWF4RW5kIC09IChkZWx0YSArIHguZGVsdGEpO1xuXHRcdFx0XHR4LnJpZ2h0ID0gejtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkZWx0YSArPSB4LmRlbHRhO1xuXHRcdFx0XHR4ID0geC5yaWdodDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHR6LnBhcmVudCA9IHg7XG5cdHoubGVmdCA9IFNFTlRJTkVMO1xuXHR6LnJpZ2h0ID0gU0VOVElORUw7XG5cdHNldE5vZGVDb2xvcih6LCBOb2RlQ29sb3IuUmVkKTtcbn1cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gRGVsZXRpb25cbmZ1bmN0aW9uIHJiVHJlZURlbGV0ZShUOiBJbnRlcnZhbFRyZWUsIHo6IEludGVydmFsTm9kZSk6IHZvaWQge1xuXG5cdGxldCB4OiBJbnRlcnZhbE5vZGU7XG5cdGxldCB5OiBJbnRlcnZhbE5vZGU7XG5cblx0Ly8gUkItREVMRVRFIGV4Y2VwdCB3ZSBkb24ndCBzd2FwIHogYW5kIHkgaW4gY2FzZSBjKVxuXHQvLyBpLmUuIHdlIGFsd2F5cyBkZWxldGUgd2hhdCdzIHBvaW50ZWQgYXQgYnkgei5cblxuXHRpZiAoei5sZWZ0ID09PSBTRU5USU5FTCkge1xuXHRcdHggPSB6LnJpZ2h0O1xuXHRcdHkgPSB6O1xuXG5cdFx0Ly8geCdzIGRlbHRhIGlzIG5vIGxvbmdlciBpbmZsdWVuY2VkIGJ5IHoncyBkZWx0YVxuXHRcdHguZGVsdGEgKz0gei5kZWx0YTtcblx0XHRpZiAoeC5kZWx0YSA8IENvbnN0YW50cy5NSU5fU0FGRV9ERUxUQSB8fCB4LmRlbHRhID4gQ29uc3RhbnRzLk1BWF9TQUZFX0RFTFRBKSB7XG5cdFx0XHRULnJlcXVlc3ROb3JtYWxpemVEZWx0YSA9IHRydWU7XG5cdFx0fVxuXHRcdHguc3RhcnQgKz0gei5kZWx0YTtcblx0XHR4LmVuZCArPSB6LmRlbHRhO1xuXG5cdH0gZWxzZSBpZiAoei5yaWdodCA9PT0gU0VOVElORUwpIHtcblx0XHR4ID0gei5sZWZ0O1xuXHRcdHkgPSB6O1xuXG5cdH0gZWxzZSB7XG5cdFx0eSA9IGxlZnRlc3Qoei5yaWdodCk7XG5cdFx0eCA9IHkucmlnaHQ7XG5cblx0XHQvLyB5J3MgZGVsdGEgaXMgbm8gbG9uZ2VyIGluZmx1ZW5jZWQgYnkgeidzIGRlbHRhLFxuXHRcdC8vIGJ1dCB3ZSBkb24ndCB3YW50IHRvIHdhbGsgdGhlIGVudGlyZSByaWdodC1oYW5kLXNpZGUgc3VidHJlZSBvZiB4LlxuXHRcdC8vIHdlIHRoZXJlZm9yZSBtYWludGFpbiB6J3MgZGVsdGEgaW4geSwgYW5kIGFkanVzdCBvbmx5IHhcblx0XHR4LnN0YXJ0ICs9IHkuZGVsdGE7XG5cdFx0eC5lbmQgKz0geS5kZWx0YTtcblx0XHR4LmRlbHRhICs9IHkuZGVsdGE7XG5cdFx0aWYgKHguZGVsdGEgPCBDb25zdGFudHMuTUlOX1NBRkVfREVMVEEgfHwgeC5kZWx0YSA+IENvbnN0YW50cy5NQVhfU0FGRV9ERUxUQSkge1xuXHRcdFx0VC5yZXF1ZXN0Tm9ybWFsaXplRGVsdGEgPSB0cnVlO1xuXHRcdH1cblxuXHRcdHkuc3RhcnQgKz0gei5kZWx0YTtcblx0XHR5LmVuZCArPSB6LmRlbHRhO1xuXHRcdHkuZGVsdGEgPSB6LmRlbHRhO1xuXHRcdGlmICh5LmRlbHRhIDwgQ29uc3RhbnRzLk1JTl9TQUZFX0RFTFRBIHx8IHkuZGVsdGEgPiBDb25zdGFudHMuTUFYX1NBRkVfREVMVEEpIHtcblx0XHRcdFQucmVxdWVzdE5vcm1hbGl6ZURlbHRhID0gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRpZiAoeSA9PT0gVC5yb290KSB7XG5cdFx0VC5yb290ID0geDtcblx0XHRzZXROb2RlQ29sb3IoeCwgTm9kZUNvbG9yLkJsYWNrKTtcblxuXHRcdHouZGV0YWNoKCk7XG5cdFx0cmVzZXRTZW50aW5lbCgpO1xuXHRcdHJlY29tcHV0ZU1heEVuZCh4KTtcblx0XHRULnJvb3QucGFyZW50ID0gU0VOVElORUw7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgeVdhc1JlZCA9IChnZXROb2RlQ29sb3IoeSkgPT09IE5vZGVDb2xvci5SZWQpO1xuXG5cdGlmICh5ID09PSB5LnBhcmVudC5sZWZ0KSB7XG5cdFx0eS5wYXJlbnQubGVmdCA9IHg7XG5cdH0gZWxzZSB7XG5cdFx0eS5wYXJlbnQucmlnaHQgPSB4O1xuXHR9XG5cblx0aWYgKHkgPT09IHopIHtcblx0XHR4LnBhcmVudCA9IHkucGFyZW50O1xuXHR9IGVsc2Uge1xuXG5cdFx0aWYgKHkucGFyZW50ID09PSB6KSB7XG5cdFx0XHR4LnBhcmVudCA9IHk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHgucGFyZW50ID0geS5wYXJlbnQ7XG5cdFx0fVxuXG5cdFx0eS5sZWZ0ID0gei5sZWZ0O1xuXHRcdHkucmlnaHQgPSB6LnJpZ2h0O1xuXHRcdHkucGFyZW50ID0gei5wYXJlbnQ7XG5cdFx0c2V0Tm9kZUNvbG9yKHksIGdldE5vZGVDb2xvcih6KSk7XG5cblx0XHRpZiAoeiA9PT0gVC5yb290KSB7XG5cdFx0XHRULnJvb3QgPSB5O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoeiA9PT0gei5wYXJlbnQubGVmdCkge1xuXHRcdFx0XHR6LnBhcmVudC5sZWZ0ID0geTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHoucGFyZW50LnJpZ2h0ID0geTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoeS5sZWZ0ICE9PSBTRU5USU5FTCkge1xuXHRcdFx0eS5sZWZ0LnBhcmVudCA9IHk7XG5cdFx0fVxuXHRcdGlmICh5LnJpZ2h0ICE9PSBTRU5USU5FTCkge1xuXHRcdFx0eS5yaWdodC5wYXJlbnQgPSB5O1xuXHRcdH1cblx0fVxuXG5cdHouZGV0YWNoKCk7XG5cblx0aWYgKHlXYXNSZWQpIHtcblx0XHRyZWNvbXB1dGVNYXhFbmRXYWxrVG9Sb290KHgucGFyZW50KTtcblx0XHRpZiAoeSAhPT0geikge1xuXHRcdFx0cmVjb21wdXRlTWF4RW5kV2Fsa1RvUm9vdCh5KTtcblx0XHRcdHJlY29tcHV0ZU1heEVuZFdhbGtUb1Jvb3QoeS5wYXJlbnQpO1xuXHRcdH1cblx0XHRyZXNldFNlbnRpbmVsKCk7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cmVjb21wdXRlTWF4RW5kV2Fsa1RvUm9vdCh4KTtcblx0cmVjb21wdXRlTWF4RW5kV2Fsa1RvUm9vdCh4LnBhcmVudCk7XG5cdGlmICh5ICE9PSB6KSB7XG5cdFx0cmVjb21wdXRlTWF4RW5kV2Fsa1RvUm9vdCh5KTtcblx0XHRyZWNvbXB1dGVNYXhFbmRXYWxrVG9Sb290KHkucGFyZW50KTtcblx0fVxuXG5cdC8vIFJCLURFTEVURS1GSVhVUFxuXHRsZXQgdzogSW50ZXJ2YWxOb2RlO1xuXHR3aGlsZSAoeCAhPT0gVC5yb290ICYmIGdldE5vZGVDb2xvcih4KSA9PT0gTm9kZUNvbG9yLkJsYWNrKSB7XG5cblx0XHRpZiAoeCA9PT0geC5wYXJlbnQubGVmdCkge1xuXHRcdFx0dyA9IHgucGFyZW50LnJpZ2h0O1xuXG5cdFx0XHRpZiAoZ2V0Tm9kZUNvbG9yKHcpID09PSBOb2RlQ29sb3IuUmVkKSB7XG5cdFx0XHRcdHNldE5vZGVDb2xvcih3LCBOb2RlQ29sb3IuQmxhY2spO1xuXHRcdFx0XHRzZXROb2RlQ29sb3IoeC5wYXJlbnQsIE5vZGVDb2xvci5SZWQpO1xuXHRcdFx0XHRsZWZ0Um90YXRlKFQsIHgucGFyZW50KTtcblx0XHRcdFx0dyA9IHgucGFyZW50LnJpZ2h0O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZ2V0Tm9kZUNvbG9yKHcubGVmdCkgPT09IE5vZGVDb2xvci5CbGFjayAmJiBnZXROb2RlQ29sb3Iody5yaWdodCkgPT09IE5vZGVDb2xvci5CbGFjaykge1xuXHRcdFx0XHRzZXROb2RlQ29sb3IodywgTm9kZUNvbG9yLlJlZCk7XG5cdFx0XHRcdHggPSB4LnBhcmVudDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChnZXROb2RlQ29sb3Iody5yaWdodCkgPT09IE5vZGVDb2xvci5CbGFjaykge1xuXHRcdFx0XHRcdHNldE5vZGVDb2xvcih3LmxlZnQsIE5vZGVDb2xvci5CbGFjayk7XG5cdFx0XHRcdFx0c2V0Tm9kZUNvbG9yKHcsIE5vZGVDb2xvci5SZWQpO1xuXHRcdFx0XHRcdHJpZ2h0Um90YXRlKFQsIHcpO1xuXHRcdFx0XHRcdHcgPSB4LnBhcmVudC5yaWdodDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHNldE5vZGVDb2xvcih3LCBnZXROb2RlQ29sb3IoeC5wYXJlbnQpKTtcblx0XHRcdFx0c2V0Tm9kZUNvbG9yKHgucGFyZW50LCBOb2RlQ29sb3IuQmxhY2spO1xuXHRcdFx0XHRzZXROb2RlQ29sb3Iody5yaWdodCwgTm9kZUNvbG9yLkJsYWNrKTtcblx0XHRcdFx0bGVmdFJvdGF0ZShULCB4LnBhcmVudCk7XG5cdFx0XHRcdHggPSBULnJvb3Q7XG5cdFx0XHR9XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0dyA9IHgucGFyZW50LmxlZnQ7XG5cblx0XHRcdGlmIChnZXROb2RlQ29sb3IodykgPT09IE5vZGVDb2xvci5SZWQpIHtcblx0XHRcdFx0c2V0Tm9kZUNvbG9yKHcsIE5vZGVDb2xvci5CbGFjayk7XG5cdFx0XHRcdHNldE5vZGVDb2xvcih4LnBhcmVudCwgTm9kZUNvbG9yLlJlZCk7XG5cdFx0XHRcdHJpZ2h0Um90YXRlKFQsIHgucGFyZW50KTtcblx0XHRcdFx0dyA9IHgucGFyZW50LmxlZnQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChnZXROb2RlQ29sb3Iody5sZWZ0KSA9PT0gTm9kZUNvbG9yLkJsYWNrICYmIGdldE5vZGVDb2xvcih3LnJpZ2h0KSA9PT0gTm9kZUNvbG9yLkJsYWNrKSB7XG5cdFx0XHRcdHNldE5vZGVDb2xvcih3LCBOb2RlQ29sb3IuUmVkKTtcblx0XHRcdFx0eCA9IHgucGFyZW50O1xuXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoZ2V0Tm9kZUNvbG9yKHcubGVmdCkgPT09IE5vZGVDb2xvci5CbGFjaykge1xuXHRcdFx0XHRcdHNldE5vZGVDb2xvcih3LnJpZ2h0LCBOb2RlQ29sb3IuQmxhY2spO1xuXHRcdFx0XHRcdHNldE5vZGVDb2xvcih3LCBOb2RlQ29sb3IuUmVkKTtcblx0XHRcdFx0XHRsZWZ0Um90YXRlKFQsIHcpO1xuXHRcdFx0XHRcdHcgPSB4LnBhcmVudC5sZWZ0O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c2V0Tm9kZUNvbG9yKHcsIGdldE5vZGVDb2xvcih4LnBhcmVudCkpO1xuXHRcdFx0XHRzZXROb2RlQ29sb3IoeC5wYXJlbnQsIE5vZGVDb2xvci5CbGFjayk7XG5cdFx0XHRcdHNldE5vZGVDb2xvcih3LmxlZnQsIE5vZGVDb2xvci5CbGFjayk7XG5cdFx0XHRcdHJpZ2h0Um90YXRlKFQsIHgucGFyZW50KTtcblx0XHRcdFx0eCA9IFQucm9vdDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRzZXROb2RlQ29sb3IoeCwgTm9kZUNvbG9yLkJsYWNrKTtcblx0cmVzZXRTZW50aW5lbCgpO1xufVxuXG5mdW5jdGlvbiBsZWZ0ZXN0KG5vZGU6IEludGVydmFsTm9kZSk6IEludGVydmFsTm9kZSB7XG5cdHdoaWxlIChub2RlLmxlZnQgIT09IFNFTlRJTkVMKSB7XG5cdFx0bm9kZSA9IG5vZGUubGVmdDtcblx0fVxuXHRyZXR1cm4gbm9kZTtcbn1cblxuZnVuY3Rpb24gcmVzZXRTZW50aW5lbCgpOiB2b2lkIHtcblx0U0VOVElORUwucGFyZW50ID0gU0VOVElORUw7XG5cdFNFTlRJTkVMLmRlbHRhID0gMDsgLy8gb3B0aW9uYWxcblx0U0VOVElORUwuc3RhcnQgPSAwOyAvLyBvcHRpb25hbFxuXHRTRU5USU5FTC5lbmQgPSAwOyAvLyBvcHRpb25hbFxufVxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBSb3RhdGlvbnNcbmZ1bmN0aW9uIGxlZnRSb3RhdGUoVDogSW50ZXJ2YWxUcmVlLCB4OiBJbnRlcnZhbE5vZGUpOiB2b2lkIHtcblx0Y29uc3QgeSA9IHgucmlnaHQ7XHRcdFx0XHQvLyBzZXQgeS5cblxuXHR5LmRlbHRhICs9IHguZGVsdGE7XHRcdFx0XHQvLyB5J3MgZGVsdGEgaXMgbm8gbG9uZ2VyIGluZmx1ZW5jZWQgYnkgeCdzIGRlbHRhXG5cdGlmICh5LmRlbHRhIDwgQ29uc3RhbnRzLk1JTl9TQUZFX0RFTFRBIHx8IHkuZGVsdGEgPiBDb25zdGFudHMuTUFYX1NBRkVfREVMVEEpIHtcblx0XHRULnJlcXVlc3ROb3JtYWxpemVEZWx0YSA9IHRydWU7XG5cdH1cblx0eS5zdGFydCArPSB4LmRlbHRhO1xuXHR5LmVuZCArPSB4LmRlbHRhO1xuXG5cdHgucmlnaHQgPSB5LmxlZnQ7XHRcdFx0XHQvLyB0dXJuIHkncyBsZWZ0IHN1YnRyZWUgaW50byB4J3MgcmlnaHQgc3VidHJlZS5cblx0aWYgKHkubGVmdCAhPT0gU0VOVElORUwpIHtcblx0XHR5LmxlZnQucGFyZW50ID0geDtcblx0fVxuXHR5LnBhcmVudCA9IHgucGFyZW50O1x0XHRcdC8vIGxpbmsgeCdzIHBhcmVudCB0byB5LlxuXHRpZiAoeC5wYXJlbnQgPT09IFNFTlRJTkVMKSB7XG5cdFx0VC5yb290ID0geTtcblx0fSBlbHNlIGlmICh4ID09PSB4LnBhcmVudC5sZWZ0KSB7XG5cdFx0eC5wYXJlbnQubGVmdCA9IHk7XG5cdH0gZWxzZSB7XG5cdFx0eC5wYXJlbnQucmlnaHQgPSB5O1xuXHR9XG5cblx0eS5sZWZ0ID0geDtcdFx0XHRcdFx0XHQvLyBwdXQgeCBvbiB5J3MgbGVmdC5cblx0eC5wYXJlbnQgPSB5O1xuXG5cdHJlY29tcHV0ZU1heEVuZCh4KTtcblx0cmVjb21wdXRlTWF4RW5kKHkpO1xufVxuXG5mdW5jdGlvbiByaWdodFJvdGF0ZShUOiBJbnRlcnZhbFRyZWUsIHk6IEludGVydmFsTm9kZSk6IHZvaWQge1xuXHRjb25zdCB4ID0geS5sZWZ0O1xuXG5cdHkuZGVsdGEgLT0geC5kZWx0YTtcblx0aWYgKHkuZGVsdGEgPCBDb25zdGFudHMuTUlOX1NBRkVfREVMVEEgfHwgeS5kZWx0YSA+IENvbnN0YW50cy5NQVhfU0FGRV9ERUxUQSkge1xuXHRcdFQucmVxdWVzdE5vcm1hbGl6ZURlbHRhID0gdHJ1ZTtcblx0fVxuXHR5LnN0YXJ0IC09IHguZGVsdGE7XG5cdHkuZW5kIC09IHguZGVsdGE7XG5cblx0eS5sZWZ0ID0geC5yaWdodDtcblx0aWYgKHgucmlnaHQgIT09IFNFTlRJTkVMKSB7XG5cdFx0eC5yaWdodC5wYXJlbnQgPSB5O1xuXHR9XG5cdHgucGFyZW50ID0geS5wYXJlbnQ7XG5cdGlmICh5LnBhcmVudCA9PT0gU0VOVElORUwpIHtcblx0XHRULnJvb3QgPSB4O1xuXHR9IGVsc2UgaWYgKHkgPT09IHkucGFyZW50LnJpZ2h0KSB7XG5cdFx0eS5wYXJlbnQucmlnaHQgPSB4O1xuXHR9IGVsc2Uge1xuXHRcdHkucGFyZW50LmxlZnQgPSB4O1xuXHR9XG5cblx0eC5yaWdodCA9IHk7XG5cdHkucGFyZW50ID0geDtcblxuXHRyZWNvbXB1dGVNYXhFbmQoeSk7XG5cdHJlY29tcHV0ZU1heEVuZCh4KTtcbn1cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gbWF4IGVuZCBjb21wdXRhdGlvblxuXG5mdW5jdGlvbiBjb21wdXRlTWF4RW5kKG5vZGU6IEludGVydmFsTm9kZSk6IG51bWJlciB7XG5cdGxldCBtYXhFbmQgPSBub2RlLmVuZDtcblx0aWYgKG5vZGUubGVmdCAhPT0gU0VOVElORUwpIHtcblx0XHRjb25zdCBsZWZ0TWF4RW5kID0gbm9kZS5sZWZ0Lm1heEVuZDtcblx0XHRpZiAobGVmdE1heEVuZCA+IG1heEVuZCkge1xuXHRcdFx0bWF4RW5kID0gbGVmdE1heEVuZDtcblx0XHR9XG5cdH1cblx0aWYgKG5vZGUucmlnaHQgIT09IFNFTlRJTkVMKSB7XG5cdFx0Y29uc3QgcmlnaHRNYXhFbmQgPSBub2RlLnJpZ2h0Lm1heEVuZCArIG5vZGUuZGVsdGE7XG5cdFx0aWYgKHJpZ2h0TWF4RW5kID4gbWF4RW5kKSB7XG5cdFx0XHRtYXhFbmQgPSByaWdodE1heEVuZDtcblx0XHR9XG5cdH1cblx0cmV0dXJuIG1heEVuZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlY29tcHV0ZU1heEVuZChub2RlOiBJbnRlcnZhbE5vZGUpOiB2b2lkIHtcblx0bm9kZS5tYXhFbmQgPSBjb21wdXRlTWF4RW5kKG5vZGUpO1xufVxuXG5mdW5jdGlvbiByZWNvbXB1dGVNYXhFbmRXYWxrVG9Sb290KG5vZGU6IEludGVydmFsTm9kZSk6IHZvaWQge1xuXHR3aGlsZSAobm9kZSAhPT0gU0VOVElORUwpIHtcblxuXHRcdGNvbnN0IG1heEVuZCA9IGNvbXB1dGVNYXhFbmQobm9kZSk7XG5cblx0XHRpZiAobm9kZS5tYXhFbmQgPT09IG1heEVuZCkge1xuXHRcdFx0Ly8gbm8gbmVlZCB0byBnbyBmdXJ0aGVyXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bm9kZS5tYXhFbmQgPSBtYXhFbmQ7XG5cdFx0bm9kZSA9IG5vZGUucGFyZW50O1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gdXRpbHNcbmV4cG9ydCBmdW5jdGlvbiBpbnRlcnZhbENvbXBhcmUoYVN0YXJ0OiBudW1iZXIsIGFFbmQ6IG51bWJlciwgYlN0YXJ0OiBudW1iZXIsIGJFbmQ6IG51bWJlcik6IG51bWJlciB7XG5cdGlmIChhU3RhcnQgPT09IGJTdGFydCkge1xuXHRcdHJldHVybiBhRW5kIC0gYkVuZDtcblx0fVxuXHRyZXR1cm4gYVN0YXJ0IC0gYlN0YXJ0O1xufVxuLy8jZW5kcmVnaW9uXG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLDhCQUFzRjtBQU94RixJQUFXLFlBQVgsa0JBQVdBLGVBQVg7QUFDTixFQUFBQSxXQUFBLDBCQUF1QjtBQUN2QixFQUFBQSxXQUFBLDBCQUF1QjtBQUN2QixFQUFBQSxXQUFBLDZCQUEwQjtBQUMxQixFQUFBQSxXQUFBLDJCQUF3QjtBQUN4QixFQUFBQSxXQUFBLGlDQUE4QjtBQUM5QixFQUFBQSxXQUFBLHVDQUFvQztBQUNwQyxFQUFBQSxXQUFBLHNDQUFtQztBQVBsQixTQUFBQTtBQUFBLEdBQUE7QUFVWCxJQUFXLFlBQVgsa0JBQVdDLGVBQVg7QUFDTixFQUFBQSxzQkFBQSxXQUFRLEtBQVI7QUFDQSxFQUFBQSxzQkFBQSxTQUFNLEtBQU47QUFGaUIsU0FBQUE7QUFBQSxHQUFBO0FBS2xCLElBQVcsWUFBWCxrQkFBV0MsZUFBWDtBQUNDLEVBQUFBLHNCQUFBLGVBQVksS0FBWjtBQUNBLEVBQUFBLHNCQUFBLHNCQUFtQixPQUFuQjtBQUNBLEVBQUFBLHNCQUFB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QU8sT0FBTztBQUNoQyxNQUFFLE9BQU8sUUFBUTtBQUFBLEVBQ2xCLE9BQU87QUFDTixNQUFFLE9BQU8sT0FBTztBQUFBLEVBQ2pCO0FBRUEsSUFBRSxRQUFRO0FBQ1YsSUFBRSxTQUFTO0FBRVgsa0JBQWdCLENBQUM7QUFDakIsa0JBQWdCLENBQUM7QUFDbEI7QUFLQSxTQUFTLGNBQWMsTUFBNEI7QUFDbEQsTUFBSSxTQUFTLEtBQUs7QUFDbEIsTUFBSSxLQUFLLFNBQVMsVUFBVTtBQUMzQixVQUFNLGFBQWEsS0FBSyxLQUFLO0FBQzdCLFFBQUksYUFBYSxRQUFRO0FBQ3hCLGVBQVM7QUFBQSxJQUNWO0FBQUEsRUFDRDtBQUNBLE1BQUksS0FBSyxVQUFVLFVBQVU7QUFDNUIsVUFBTSxjQUFjLEtBQUssTUFBTSxTQUFTLEtBQUs7QUFDN0MsUUFBSSxjQUFjLFFBQVE7QUFDekIsZUFBUztBQUFBLElBQ1Y7QUFBQSxFQUNEO0FBQ0EsU0FBTztBQUNSO0FBRU8sU0FBUyxnQkFBZ0IsTUFBMEI7QUFDekQsT0FBSyxTQUFTLGNBQWMsSUFBSTtBQUNqQztBQUVBLFNBQVMsMEJBQTBCLE1BQTBCO0FBQzVELFNBQU8sU0FBUyxVQUFVO0FBRXpCLFVBQU0sU0FBUyxjQUFjLElBQUk7QUFFakMsUUFBSSxLQUFLLFdBQVcsUUFBUTtBQUUzQjtBQUFBLElBQ0Q7QUFFQSxTQUFLLFNBQVM7QUFDZCxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQ0Q7QUFLTyxTQUFTLGdCQUFnQixRQUFnQixNQUFjLFFBQWdCLE1BQXNCO0FBQ25HLE1BQUksV0FBVyxRQUFRO0FBQ3RCLFdBQU8sT0FBTztBQUFBLEVBQ2Y7QUFDQSxTQUFPLFNBQVM7QUFDakI7IiwKICAibmFtZXMiOiBbIkNsYXNzTmFtZSIsICJOb2RlQ29sb3IiLCAiQ29uc3RhbnRzIiwgIk1hcmtlck1vdmVTZW1hbnRpY3MiXQp9Cg==
