import { createFastDomNode } from "../../../base/browser/fastDomNode.js";
import { createTrustedTypesPolicy } from "../../../base/browser/trustedTypes.js";
import { BugIndicatingError } from "../../../base/common/errors.js";
import { EditorOption } from "../../common/config/editorOptions.js";
import { StringBuilder } from "../../common/core/stringBuilder.js";
class RenderedLinesCollection {
  constructor(_lineFactory) {
    this._lineFactory = _lineFactory;
    this._set(1, []);
  }
  flush() {
    this._set(1, []);
  }
  _set(rendLineNumberStart, lines) {
    this._lines = lines;
    this._rendLineNumberStart = rendLineNumberStart;
  }
  _get() {
    return {
      rendLineNumberStart: this._rendLineNumberStart,
      lines: this._lines
    };
  }
  /**
   * @returns Inclusive line number that is inside this collection
   */
  getStartLineNumber() {
    return this._rendLineNumberStart;
  }
  /**
   * @returns Inclusive line number that is inside this collection
   */
  getEndLineNumber() {
    return this._rendLineNumberStart + this._lines.length - 1;
  }
  getCount() {
    return this._lines.length;
  }
  getLine(lineNumber) {
    const lineIndex = lineNumber - this._rendLineNumberStart;
    if (lineIndex < 0 || lineIndex >= this._lines.length) {
      throw new BugIndicatingError("Illegal value for lineNumber");
    }
    return this._lines[lineIndex];
  }
  /**
   * @returns Lines that were removed from this collection
   */
  onLinesDeleted(deleteFromLineNumber, deleteToLineNumber) {
    if (this.getCount() === 0) {
      return null;
    }
    const startLineNumber = this.getStartLineNumber();
    const endLineNumber = this.getEndLineNumber();
    if (deleteToLineNumber < startLineNumber) {
      const deleteCnt = deleteToLineNumber - deleteFromLineNumber + 1;
      this._rendLineNumberStart -= deleteCnt;
      return null;
    }
    if (deleteFromLineNumber > endLineNumber) {
      return null;
    }
    let deleteStartIndex = 0;
    let deleteCount = 0;
    for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
      const lineIndex = lineNumber - this._rendLineNumberStart;
      if (deleteFromLineNumber <= lineNumber && lineNumber <= deleteToLineNumber) {
        if (deleteCount === 0) {
          deleteStartIndex = lineIndex;
          deleteCount = 1;
        } else {
          deleteCount++;
        }
      }
    }
    if (deleteFromLineNumber < startLineNumber) {
      let deleteAboveCount = 0;
      if (deleteToLineNumber < startLineNumber) {
        deleteAboveCount = deleteToLineNumber - deleteFromLineNumber + 1;
      } else {
        deleteAboveCount = startLineNumber - deleteFromLineNumber;
      }
      this._rendLineNumberStart -= deleteAboveCount;
    }
    const deleted = this._lines.splice(deleteStartIndex, deleteCount);
    return deleted;
  }
  onLinesChanged(changeFromLineNumber, changeCount) {
    const changeToLineNumber = changeFromLineNumber + changeCount - 1;
    if (this.getCount() === 0) {
      return false;
    }
    const startLineNumber = this.getStartLineNumber();
    const endLineNumber = this.getEndLineNumber();
    let someoneNotified = false;
    for (let changedLineNumber = changeFromLineNumber; changedLineNumber <= changeToLineNumber; changedLineNumber++) {
      if (changedLineNumber >= startLineNumber && changedLineNumber <= endLineNumber) {
        this._lines[changedLineNumber - this._rendLineNumberStart].onContentChanged();
        someoneNotified = true;
      }
    }
    return someoneNotified;
  }
  onLinesInserted(insertFromLineNumber, insertToLineNumber) {
    if (this.getCount() === 0) {
      return null;
    }
    const insertCnt = insertToLineNumber - insertFromLineNumber + 1;
    const startLineNumber = this.getStartLineNumber();
    const endLineNumber = this.getEndLineNumber();
    if (insertFromLineNumber <= startLineNumber) {
      this._rendLineNumberStart += insertCnt;
      return null;
    }
    if (insertFromLineNumber > endLineNumber) {
      return null;
    }
    if (insertCnt + insertFromLineNumber > endLineNumber) {
      const deleted = this._lines.splice(insertFromLineNumber - this._rendLineNumberStart, endLineNumber - insertFromLineNumber + 1);
      return deleted;
    }
    const newLines = [];
    for (let i = 0; i < insertCnt; i++) {
      newLines[i] = this._lineFactory.createLine();
    }
    const insertIndex = insertFromLineNumber - this._rendLineNumberStart;
    const beforeLines = this._lines.slice(0, insertIndex);
    const afterLines = this._lines.slice(insertIndex, this._lines.length - insertCnt);
    const deletedLines = this._lines.slice(this._lines.length - insertCnt, this._lines.length);
    this._lines = beforeLines.concat(newLines).concat(afterLines);
    return deletedLines;
  }
  onTokensChanged(ranges) {
    if (this.getCount() === 0) {
      return false;
    }
    const startLineNumber = this.getStartLineNumber();
    const endLineNumber = this.getEndLineNumber();
    let notifiedSomeone = false;
    for (let i = 0, len = ranges.length; i < len; i++) {
      const rng = ranges[i];
      if (rng.toLineNumber < startLineNumber || rng.fromLineNumber > endLineNumber) {
        continue;
      }
      const from = Math.max(startLineNumber, rng.fromLineNumber);
      const to = Math.min(endLineNumber, rng.toLineNumber);
      for (let lineNumber = from; lineNumber <= to; lineNumber++) {
        const lineIndex = lineNumber - this._rendLineNumberStart;
        this._lines[lineIndex].onTokensChanged();
        notifiedSomeone = true;
      }
    }
    return notifiedSomeone;
  }
}
class VisibleLinesCollection {
  constructor(_lineFactory) {
    this._lineFactory = _lineFactory;
    this.domNode = this._createDomNode();
    this._linesCollection = new RenderedLinesCollection(this._lineFactory);
  }
  _createDomNode() {
    const domNode = createFastDomNode(document.createElement("div"));
    domNode.setClassName("view-layer");
    domNode.setPosition("absolute");
    domNode.domNode.setAttribute("role", "presentation");
    domNode.domNode.setAttribute("aria-hidden", "true");
    return domNode;
  }
  // ---- begin view event handlers
  onConfigurationChanged(e) {
    if (e.hasChanged(EditorOption.layoutInfo)) {
      return true;
    }
    return false;
  }
  onFlushed(e, flushDom) {
    if (flushDom) {
      const start = this._linesCollection.getStartLineNumber();
      const end = this._linesCollection.getEndLineNumber();
      for (let i = start; i <= end; i++) {
        this._linesCollection.getLine(i).getDomNode()?.remove();
      }
    }
    this._linesCollection.flush();
    return true;
  }
  onLinesChanged(e) {
    return this._linesCollection.onLinesChanged(e.fromLineNumber, e.count);
  }
  onLinesDeleted(e) {
    const deleted = this._linesCollection.onLinesDeleted(e.fromLineNumber, e.toLineNumber);
    if (deleted) {
      for (let i = 0, len = deleted.length; i < len; i++) {
        const lineDomNode = deleted[i].getDomNode();
        lineDomNode?.remove();
      }
    }
    return true;
  }
  onLinesInserted(e) {
    const deleted = this._linesCollection.onLinesInserted(e.fromLineNumber, e.toLineNumber);
    if (deleted) {
      for (let i = 0, len = deleted.length; i < len; i++) {
        const lineDomNode = deleted[i].getDomNode();
        lineDomNode?.remove();
      }
    }
    return true;
  }
  onScrollChanged(e) {
    return e.scrollTopChanged;
  }
  onTokensChanged(e) {
    return this._linesCollection.onTokensChanged(e.ranges);
  }
  onZonesChanged(e) {
    return true;
  }
  // ---- end view event handlers
  getStartLineNumber() {
    return this._linesCollection.getStartLineNumber();
  }
  getEndLineNumber() {
    return this._linesCollection.getEndLineNumber();
  }
  getVisibleLine(lineNumber) {
    return this._linesCollection.getLine(lineNumber);
  }
  renderLines(viewportData) {
    const inp = this._linesCollection._get();
    const renderer = new ViewLayerRenderer(this.domNode.domNode, this._lineFactory, viewportData);
    const ctx = {
      rendLineNumberStart: inp.rendLineNumberStart,
      lines: inp.lines,
      linesLength: inp.lines.length
    };
    const resCtx = renderer.render(ctx, viewportData.startLineNumber, viewportData.endLineNumber, viewportData.relativeVerticalOffset);
    this._linesCollection._set(resCtx.rendLineNumberStart, resCtx.lines);
  }
}
const _ViewLayerRenderer = class _ViewLayerRenderer {
  constructor(_domNode, _lineFactory, _viewportData) {
    this._domNode = _domNode;
    this._lineFactory = _lineFactory;
    this._viewportData = _viewportData;
  }
  render(inContext, startLineNumber, stopLineNumber, deltaTop) {
    const ctx = {
      rendLineNumberStart: inContext.rendLineNumberStart,
      lines: inContext.lines.slice(0),
      linesLength: inContext.linesLength
    };
    if (ctx.rendLineNumberStart + ctx.linesLength - 1 < startLineNumber || stopLineNumber < ctx.rendLineNumberStart) {
      ctx.rendLineNumberStart = startLineNumber;
      ctx.linesLength = stopLineNumber - startLineNumber + 1;
      ctx.lines = [];
      for (let x = startLineNumber; x <= stopLineNumber; x++) {
        ctx.lines[x - startLineNumber] = this._lineFactory.createLine();
      }
      this._finishRendering(ctx, true, deltaTop);
      return ctx;
    }
    this._renderUntouchedLines(
      ctx,
      Math.max(startLineNumber - ctx.rendLineNumberStart, 0),
      Math.min(stopLineNumber - ctx.rendLineNumberStart, ctx.linesLength - 1),
      deltaTop,
      startLineNumber
    );
    if (ctx.rendLineNumberStart > startLineNumber) {
      const fromLineNumber = startLineNumber;
      const toLineNumber = Math.min(stopLineNumber, ctx.rendLineNumberStart - 1);
      if (fromLineNumber <= toLineNumber) {
        this._insertLinesBefore(ctx, fromLineNumber, toLineNumber, deltaTop, startLineNumber);
        ctx.linesLength += toLineNumber - fromLineNumber + 1;
      }
    } else if (ctx.rendLineNumberStart < startLineNumber) {
      const removeCnt = Math.min(ctx.linesLength, startLineNumber - ctx.rendLineNumberStart);
      if (removeCnt > 0) {
        this._removeLinesBefore(ctx, removeCnt);
        ctx.linesLength -= removeCnt;
      }
    }
    ctx.rendLineNumberStart = startLineNumber;
    if (ctx.rendLineNumberStart + ctx.linesLength - 1 < stopLineNumber) {
      const fromLineNumber = ctx.rendLineNumberStart + ctx.linesLength;
      const toLineNumber = stopLineNumber;
      if (fromLineNumber <= toLineNumber) {
        this._insertLinesAfter(ctx, fromLineNumber, toLineNumber, deltaTop, startLineNumber);
        ctx.linesLength += toLineNumber - fromLineNumber + 1;
      }
    } else if (ctx.rendLineNumberStart + ctx.linesLength - 1 > stopLineNumber) {
      const fromLineNumber = Math.max(0, stopLineNumber - ctx.rendLineNumberStart + 1);
      const toLineNumber = ctx.linesLength - 1;
      const removeCnt = toLineNumber - fromLineNumber + 1;
      if (removeCnt > 0) {
        this._removeLinesAfter(ctx, removeCnt);
        ctx.linesLength -= removeCnt;
      }
    }
    this._finishRendering(ctx, false, deltaTop);
    return ctx;
  }
  _renderUntouchedLines(ctx, startIndex, endIndex, deltaTop, deltaLN) {
    const rendLineNumberStart = ctx.rendLineNumberStart;
    const lines = ctx.lines;
    for (let i = startIndex; i <= endIndex; i++) {
      const lineNumber = rendLineNumberStart + i;
      lines[i].layoutLine(lineNumber, deltaTop[lineNumber - deltaLN], this._viewportData.lineHeight);
    }
  }
  _insertLinesBefore(ctx, fromLineNumber, toLineNumber, deltaTop, deltaLN) {
    const newLines = [];
    let newLinesLen = 0;
    for (let lineNumber = fromLineNumber; lineNumber <= toLineNumber; lineNumber++) {
      newLines[newLinesLen++] = this._lineFactory.createLine();
    }
    ctx.lines = newLines.concat(ctx.lines);
  }
  _removeLinesBefore(ctx, removeCount) {
    for (let i = 0; i < removeCount; i++) {
      const lineDomNode = ctx.lines[i].getDomNode();
      lineDomNode?.remove();
    }
    ctx.lines.splice(0, removeCount);
  }
  _insertLinesAfter(ctx, fromLineNumber, toLineNumber, deltaTop, deltaLN) {
    const newLines = [];
    let newLinesLen = 0;
    for (let lineNumber = fromLineNumber; lineNumber <= toLineNumber; lineNumber++) {
      newLines[newLinesLen++] = this._lineFactory.createLine();
    }
    ctx.lines = ctx.lines.concat(newLines);
  }
  _removeLinesAfter(ctx, removeCount) {
    const removeIndex = ctx.linesLength - removeCount;
    for (let i = 0; i < removeCount; i++) {
      const lineDomNode = ctx.lines[removeIndex + i].getDomNode();
      lineDomNode?.remove();
    }
    ctx.lines.splice(removeIndex, removeCount);
  }
  _finishRenderingNewLines(ctx, domNodeIsEmpty, newLinesHTML, wasNew) {
    if (_ViewLayerRenderer._ttPolicy) {
      newLinesHTML = _ViewLayerRenderer._ttPolicy.createHTML(newLinesHTML);
    }
    const lastChild = this._domNode.lastChild;
    if (domNodeIsEmpty || !lastChild) {
      this._domNode.innerHTML = newLinesHTML;
    } else {
      lastChild.insertAdjacentHTML("afterend", newLinesHTML);
    }
    let currChild = this._domNode.lastChild;
    for (let i = ctx.linesLength - 1; i >= 0; i--) {
      const line = ctx.lines[i];
      if (wasNew[i]) {
        line.setDomNode(currChild);
        currChild = currChild.previousSibling;
      }
    }
  }
  _finishRenderingInvalidLines(ctx, invalidLinesHTML, wasInvalid) {
    const hugeDomNode = document.createElement("div");
    if (_ViewLayerRenderer._ttPolicy) {
      invalidLinesHTML = _ViewLayerRenderer._ttPolicy.createHTML(invalidLinesHTML);
    }
    hugeDomNode.innerHTML = invalidLinesHTML;
    for (let i = 0; i < ctx.linesLength; i++) {
      const line = ctx.lines[i];
      if (wasInvalid[i]) {
        const source = hugeDomNode.firstChild;
        const lineDomNode = line.getDomNode();
        lineDomNode.parentNode.replaceChild(source, lineDomNode);
        line.setDomNode(source);
      }
    }
  }
  _finishRendering(ctx, domNodeIsEmpty, deltaTop) {
    const sb = _ViewLayerRenderer._sb;
    const linesLength = ctx.linesLength;
    const lines = ctx.lines;
    const rendLineNumberStart = ctx.rendLineNumberStart;
    const wasNew = [];
    {
      sb.reset();
      let hadNewLine = false;
      for (let i = 0; i < linesLength; i++) {
        const line = lines[i];
        wasNew[i] = false;
        const lineDomNode = line.getDomNode();
        if (lineDomNode) {
          continue;
        }
        const renderResult = line.renderLine(i + rendLineNumberStart, deltaTop[i], this._viewportData.lineHeight, this._viewportData, sb);
        if (!renderResult) {
          continue;
        }
        wasNew[i] = true;
        hadNewLine = true;
      }
      if (hadNewLine) {
        this._finishRenderingNewLines(ctx, domNodeIsEmpty, sb.build(), wasNew);
      }
    }
    {
      sb.reset();
      let hadInvalidLine = false;
      const wasInvalid = [];
      for (let i = 0; i < linesLength; i++) {
        const line = lines[i];
        wasInvalid[i] = false;
        if (wasNew[i]) {
          continue;
        }
        const renderResult = line.renderLine(i + rendLineNumberStart, deltaTop[i], this._viewportData.lineHeight, this._viewportData, sb);
        if (!renderResult) {
          continue;
        }
        wasInvalid[i] = true;
        hadInvalidLine = true;
      }
      if (hadInvalidLine) {
        this._finishRenderingInvalidLines(ctx, sb.build(), wasInvalid);
      }
    }
  }
};
_ViewLayerRenderer._ttPolicy = createTrustedTypesPolicy("editorViewLayer", { createHTML: (value) => value });
_ViewLayerRenderer._sb = new StringBuilder(1e5);
let ViewLayerRenderer = _ViewLayerRenderer;
export {
  RenderedLinesCollection,
  VisibleLinesCollection
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci92aWV3L3ZpZXdMYXllci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEZhc3REb21Ob2RlLCBjcmVhdGVGYXN0RG9tTm9kZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9mYXN0RG9tTm9kZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUcnVzdGVkVHlwZXNQb2xpY3kgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdHJ1c3RlZFR5cGVzLmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgU3RyaW5nQnVpbGRlciB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb3JlL3N0cmluZ0J1aWxkZXIuanMnO1xuaW1wb3J0ICogYXMgdmlld0V2ZW50cyBmcm9tICcuLi8uLi9jb21tb24vdmlld0V2ZW50cy5qcyc7XG5pbXBvcnQgeyBWaWV3cG9ydERhdGEgfSBmcm9tICcuLi8uLi9jb21tb24vdmlld0xheW91dC92aWV3TGluZXNWaWV3cG9ydERhdGEuanMnO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYSB2aXNpYmxlIGxpbmVcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJVmlzaWJsZUxpbmUgZXh0ZW5kcyBJTGluZSB7XG5cdGdldERvbU5vZGUoKTogSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRzZXREb21Ob2RlKGRvbU5vZGU6IEhUTUxFbGVtZW50KTogdm9pZDtcblxuXHQvKipcblx0ICogUmV0dXJuIG51bGwgaWYgdGhlIEhUTUwgc2hvdWxkIG5vdCBiZSB0b3VjaGVkLlxuXHQgKiBSZXR1cm4gdGhlIG5ldyBIVE1MIG90aGVyd2lzZS5cblx0ICovXG5cdHJlbmRlckxpbmUobGluZU51bWJlcjogbnVtYmVyLCBkZWx0YVRvcDogbnVtYmVyLCBsaW5lSGVpZ2h0OiBudW1iZXIsIHZpZXdwb3J0RGF0YTogVmlld3BvcnREYXRhLCBzYjogU3RyaW5nQnVpbGRlcik6IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIExheW91dCB0aGUgbGluZS5cblx0ICovXG5cdGxheW91dExpbmUobGluZU51bWJlcjogbnVtYmVyLCBkZWx0YVRvcDogbnVtYmVyLCBsaW5lSGVpZ2h0OiBudW1iZXIpOiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElMaW5lIHtcblx0b25Db250ZW50Q2hhbmdlZCgpOiB2b2lkO1xuXHRvblRva2Vuc0NoYW5nZWQoKTogdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTGluZUZhY3Rvcnk8VCBleHRlbmRzIElMaW5lPiB7XG5cdGNyZWF0ZUxpbmUoKTogVDtcbn1cblxuZXhwb3J0IGNsYXNzIFJlbmRlcmVkTGluZXNDb2xsZWN0aW9uPFQgZXh0ZW5kcyBJTGluZT4ge1xuXHRwcml2YXRlIF9saW5lcyE6IFRbXTtcblx0cHJpdmF0ZSBfcmVuZExpbmVOdW1iZXJTdGFydCE6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9saW5lRmFjdG9yeTogSUxpbmVGYWN0b3J5PFQ+LFxuXHQpIHtcblx0XHR0aGlzLl9zZXQoMSwgW10pO1xuXHR9XG5cblx0cHVibGljIGZsdXNoKCk6IHZvaWQge1xuXHRcdHRoaXMuX3NldCgxLCBbXSk7XG5cdH1cblxuXHRfc2V0KHJlbmRMaW5lTnVtYmVyU3RhcnQ6IG51bWJlciwgbGluZXM6IFRbXSk6IHZvaWQge1xuXHRcdHRoaXMuX2xpbmVzID0gbGluZXM7XG5cdFx0dGhpcy5fcmVuZExpbmVOdW1iZXJTdGFydCA9IHJlbmRMaW5lTnVtYmVyU3RhcnQ7XG5cdH1cblxuXHRfZ2V0KCk6IHsgcmVuZExpbmVOdW1iZXJTdGFydDogbnVtYmVyOyBsaW5lczogVFtdIH0ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRyZW5kTGluZU51bWJlclN0YXJ0OiB0aGlzLl9yZW5kTGluZU51bWJlclN0YXJ0LFxuXHRcdFx0bGluZXM6IHRoaXMuX2xpbmVzXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmV0dXJucyBJbmNsdXNpdmUgbGluZSBudW1iZXIgdGhhdCBpcyBpbnNpZGUgdGhpcyBjb2xsZWN0aW9uXG5cdCAqL1xuXHRwdWJsaWMgZ2V0U3RhcnRMaW5lTnVtYmVyKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlbmRMaW5lTnVtYmVyU3RhcnQ7XG5cdH1cblxuXHQvKipcblx0ICogQHJldHVybnMgSW5jbHVzaXZlIGxpbmUgbnVtYmVyIHRoYXQgaXMgaW5zaWRlIHRoaXMgY29sbGVjdGlvblxuXHQgKi9cblx0cHVibGljIGdldEVuZExpbmVOdW1iZXIoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVuZExpbmVOdW1iZXJTdGFydCArIHRoaXMuX2xpbmVzLmxlbmd0aCAtIDE7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Q291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXMubGVuZ3RoO1xuXHR9XG5cblx0cHVibGljIGdldExpbmUobGluZU51bWJlcjogbnVtYmVyKTogVCB7XG5cdFx0Y29uc3QgbGluZUluZGV4ID0gbGluZU51bWJlciAtIHRoaXMuX3JlbmRMaW5lTnVtYmVyU3RhcnQ7XG5cdFx0aWYgKGxpbmVJbmRleCA8IDAgfHwgbGluZUluZGV4ID49IHRoaXMuX2xpbmVzLmxlbmd0aCkge1xuXHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcignSWxsZWdhbCB2YWx1ZSBmb3IgbGluZU51bWJlcicpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbGluZXNbbGluZUluZGV4XTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmV0dXJucyBMaW5lcyB0aGF0IHdlcmUgcmVtb3ZlZCBmcm9tIHRoaXMgY29sbGVjdGlvblxuXHQgKi9cblx0cHVibGljIG9uTGluZXNEZWxldGVkKGRlbGV0ZUZyb21MaW5lTnVtYmVyOiBudW1iZXIsIGRlbGV0ZVRvTGluZU51bWJlcjogbnVtYmVyKTogVFtdIHwgbnVsbCB7XG5cdFx0aWYgKHRoaXMuZ2V0Q291bnQoKSA9PT0gMCkge1xuXHRcdFx0Ly8gbm8gbGluZXNcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXJ0TGluZU51bWJlciA9IHRoaXMuZ2V0U3RhcnRMaW5lTnVtYmVyKCk7XG5cdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IHRoaXMuZ2V0RW5kTGluZU51bWJlcigpO1xuXG5cdFx0aWYgKGRlbGV0ZVRvTGluZU51bWJlciA8IHN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0Ly8gZGVsZXRpbmcgYWJvdmUgdGhlIHZpZXdwb3J0XG5cdFx0XHRjb25zdCBkZWxldGVDbnQgPSBkZWxldGVUb0xpbmVOdW1iZXIgLSBkZWxldGVGcm9tTGluZU51bWJlciArIDE7XG5cdFx0XHR0aGlzLl9yZW5kTGluZU51bWJlclN0YXJ0IC09IGRlbGV0ZUNudDtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGlmIChkZWxldGVGcm9tTGluZU51bWJlciA+IGVuZExpbmVOdW1iZXIpIHtcblx0XHRcdC8vIGRlbGV0ZWQgYmVsb3cgdGhlIHZpZXdwb3J0XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHQvLyBSZWNvcmQgd2hhdCBuZWVkcyB0byBiZSBkZWxldGVkXG5cdFx0bGV0IGRlbGV0ZVN0YXJ0SW5kZXggPSAwO1xuXHRcdGxldCBkZWxldGVDb3VudCA9IDA7XG5cdFx0Zm9yIChsZXQgbGluZU51bWJlciA9IHN0YXJ0TGluZU51bWJlcjsgbGluZU51bWJlciA8PSBlbmRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyKyspIHtcblx0XHRcdGNvbnN0IGxpbmVJbmRleCA9IGxpbmVOdW1iZXIgLSB0aGlzLl9yZW5kTGluZU51bWJlclN0YXJ0O1xuXG5cdFx0XHRpZiAoZGVsZXRlRnJvbUxpbmVOdW1iZXIgPD0gbGluZU51bWJlciAmJiBsaW5lTnVtYmVyIDw9IGRlbGV0ZVRvTGluZU51bWJlcikge1xuXHRcdFx0XHQvLyB0aGlzIGlzIGEgbGluZSB0byBiZSBkZWxldGVkXG5cdFx0XHRcdGlmIChkZWxldGVDb3VudCA9PT0gMCkge1xuXHRcdFx0XHRcdC8vIHRoaXMgaXMgdGhlIGZpcnN0IGxpbmUgdG8gYmUgZGVsZXRlZFxuXHRcdFx0XHRcdGRlbGV0ZVN0YXJ0SW5kZXggPSBsaW5lSW5kZXg7XG5cdFx0XHRcdFx0ZGVsZXRlQ291bnQgPSAxO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRlbGV0ZUNvdW50Kys7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBBZGp1c3QgdGhpcy5fcmVuZExpbmVOdW1iZXJTdGFydCBmb3IgbGluZXMgZGVsZXRlZCBhYm92ZVxuXHRcdGlmIChkZWxldGVGcm9tTGluZU51bWJlciA8IHN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0Ly8gU29tZXRoaW5nIHdhcyBkZWxldGVkIGFib3ZlXG5cdFx0XHRsZXQgZGVsZXRlQWJvdmVDb3VudCA9IDA7XG5cblx0XHRcdGlmIChkZWxldGVUb0xpbmVOdW1iZXIgPCBzdGFydExpbmVOdW1iZXIpIHtcblx0XHRcdFx0Ly8gdGhlIGVudGlyZSBkZWxldGVkIGxpbmVzIGFyZSBhYm92ZVxuXHRcdFx0XHRkZWxldGVBYm92ZUNvdW50ID0gZGVsZXRlVG9MaW5lTnVtYmVyIC0gZGVsZXRlRnJvbUxpbmVOdW1iZXIgKyAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGVsZXRlQWJvdmVDb3VudCA9IHN0YXJ0TGluZU51bWJlciAtIGRlbGV0ZUZyb21MaW5lTnVtYmVyO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9yZW5kTGluZU51bWJlclN0YXJ0IC09IGRlbGV0ZUFib3ZlQ291bnQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVsZXRlZCA9IHRoaXMuX2xpbmVzLnNwbGljZShkZWxldGVTdGFydEluZGV4LCBkZWxldGVDb3VudCk7XG5cdFx0cmV0dXJuIGRlbGV0ZWQ7XG5cdH1cblxuXHRwdWJsaWMgb25MaW5lc0NoYW5nZWQoY2hhbmdlRnJvbUxpbmVOdW1iZXI6IG51bWJlciwgY2hhbmdlQ291bnQ6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGNoYW5nZVRvTGluZU51bWJlciA9IGNoYW5nZUZyb21MaW5lTnVtYmVyICsgY2hhbmdlQ291bnQgLSAxO1xuXHRcdGlmICh0aGlzLmdldENvdW50KCkgPT09IDApIHtcblx0XHRcdC8vIG5vIGxpbmVzXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhcnRMaW5lTnVtYmVyID0gdGhpcy5nZXRTdGFydExpbmVOdW1iZXIoKTtcblx0XHRjb25zdCBlbmRMaW5lTnVtYmVyID0gdGhpcy5nZXRFbmRMaW5lTnVtYmVyKCk7XG5cblx0XHRsZXQgc29tZW9uZU5vdGlmaWVkID0gZmFsc2U7XG5cblx0XHRmb3IgKGxldCBjaGFuZ2VkTGluZU51bWJlciA9IGNoYW5nZUZyb21MaW5lTnVtYmVyOyBjaGFuZ2VkTGluZU51bWJlciA8PSBjaGFuZ2VUb0xpbmVOdW1iZXI7IGNoYW5nZWRMaW5lTnVtYmVyKyspIHtcblx0XHRcdGlmIChjaGFuZ2VkTGluZU51bWJlciA+PSBzdGFydExpbmVOdW1iZXIgJiYgY2hhbmdlZExpbmVOdW1iZXIgPD0gZW5kTGluZU51bWJlcikge1xuXHRcdFx0XHQvLyBOb3RpZnkgdGhlIGxpbmVcblx0XHRcdFx0dGhpcy5fbGluZXNbY2hhbmdlZExpbmVOdW1iZXIgLSB0aGlzLl9yZW5kTGluZU51bWJlclN0YXJ0XS5vbkNvbnRlbnRDaGFuZ2VkKCk7XG5cdFx0XHRcdHNvbWVvbmVOb3RpZmllZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHNvbWVvbmVOb3RpZmllZDtcblx0fVxuXG5cdHB1YmxpYyBvbkxpbmVzSW5zZXJ0ZWQoaW5zZXJ0RnJvbUxpbmVOdW1iZXI6IG51bWJlciwgaW5zZXJ0VG9MaW5lTnVtYmVyOiBudW1iZXIpOiBUW10gfCBudWxsIHtcblx0XHRpZiAodGhpcy5nZXRDb3VudCgpID09PSAwKSB7XG5cdFx0XHQvLyBubyBsaW5lc1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5zZXJ0Q250ID0gaW5zZXJ0VG9MaW5lTnVtYmVyIC0gaW5zZXJ0RnJvbUxpbmVOdW1iZXIgKyAxO1xuXHRcdGNvbnN0IHN0YXJ0TGluZU51bWJlciA9IHRoaXMuZ2V0U3RhcnRMaW5lTnVtYmVyKCk7XG5cdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IHRoaXMuZ2V0RW5kTGluZU51bWJlcigpO1xuXG5cdFx0aWYgKGluc2VydEZyb21MaW5lTnVtYmVyIDw9IHN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0Ly8gaW5zZXJ0aW5nIGFib3ZlIHRoZSB2aWV3cG9ydFxuXHRcdFx0dGhpcy5fcmVuZExpbmVOdW1iZXJTdGFydCArPSBpbnNlcnRDbnQ7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAoaW5zZXJ0RnJvbUxpbmVOdW1iZXIgPiBlbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHQvLyBpbnNlcnRpbmcgYmVsb3cgdGhlIHZpZXdwb3J0XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAoaW5zZXJ0Q250ICsgaW5zZXJ0RnJvbUxpbmVOdW1iZXIgPiBlbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHQvLyBpbnNlcnQgaW5zaWRlIHRoZSB2aWV3cG9ydCBpbiBzdWNoIGEgd2F5IHRoYXQgYWxsIHJlbWFpbmluZyBsaW5lcyBhcmUgcHVzaGVkIG91dHNpZGVcblx0XHRcdGNvbnN0IGRlbGV0ZWQgPSB0aGlzLl9saW5lcy5zcGxpY2UoaW5zZXJ0RnJvbUxpbmVOdW1iZXIgLSB0aGlzLl9yZW5kTGluZU51bWJlclN0YXJ0LCBlbmRMaW5lTnVtYmVyIC0gaW5zZXJ0RnJvbUxpbmVOdW1iZXIgKyAxKTtcblx0XHRcdHJldHVybiBkZWxldGVkO1xuXHRcdH1cblxuXHRcdC8vIGluc2VydCBpbnNpZGUgdGhlIHZpZXdwb3J0LCBwdXNoIG91dCBzb21lIGxpbmVzLCBidXQgbm90IGFsbCByZW1haW5pbmcgbGluZXNcblx0XHRjb25zdCBuZXdMaW5lczogVFtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBpbnNlcnRDbnQ7IGkrKykge1xuXHRcdFx0bmV3TGluZXNbaV0gPSB0aGlzLl9saW5lRmFjdG9yeS5jcmVhdGVMaW5lKCk7XG5cdFx0fVxuXHRcdGNvbnN0IGluc2VydEluZGV4ID0gaW5zZXJ0RnJvbUxpbmVOdW1iZXIgLSB0aGlzLl9yZW5kTGluZU51bWJlclN0YXJ0O1xuXHRcdGNvbnN0IGJlZm9yZUxpbmVzID0gdGhpcy5fbGluZXMuc2xpY2UoMCwgaW5zZXJ0SW5kZXgpO1xuXHRcdGNvbnN0IGFmdGVyTGluZXMgPSB0aGlzLl9saW5lcy5zbGljZShpbnNlcnRJbmRleCwgdGhpcy5fbGluZXMubGVuZ3RoIC0gaW5zZXJ0Q250KTtcblx0XHRjb25zdCBkZWxldGVkTGluZXMgPSB0aGlzLl9saW5lcy5zbGljZSh0aGlzLl9saW5lcy5sZW5ndGggLSBpbnNlcnRDbnQsIHRoaXMuX2xpbmVzLmxlbmd0aCk7XG5cblx0XHR0aGlzLl9saW5lcyA9IGJlZm9yZUxpbmVzLmNvbmNhdChuZXdMaW5lcykuY29uY2F0KGFmdGVyTGluZXMpO1xuXG5cdFx0cmV0dXJuIGRlbGV0ZWRMaW5lcztcblx0fVxuXG5cdHB1YmxpYyBvblRva2Vuc0NoYW5nZWQocmFuZ2VzOiB7IGZyb21MaW5lTnVtYmVyOiBudW1iZXI7IHRvTGluZU51bWJlcjogbnVtYmVyIH1bXSk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLmdldENvdW50KCkgPT09IDApIHtcblx0XHRcdC8vIG5vIGxpbmVzXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhcnRMaW5lTnVtYmVyID0gdGhpcy5nZXRTdGFydExpbmVOdW1iZXIoKTtcblx0XHRjb25zdCBlbmRMaW5lTnVtYmVyID0gdGhpcy5nZXRFbmRMaW5lTnVtYmVyKCk7XG5cblx0XHRsZXQgbm90aWZpZWRTb21lb25lID0gZmFsc2U7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHJhbmdlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3Qgcm5nID0gcmFuZ2VzW2ldO1xuXG5cdFx0XHRpZiAocm5nLnRvTGluZU51bWJlciA8IHN0YXJ0TGluZU51bWJlciB8fCBybmcuZnJvbUxpbmVOdW1iZXIgPiBlbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdC8vIHJhbmdlIG91dHNpZGUgdmlld3BvcnRcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGZyb20gPSBNYXRoLm1heChzdGFydExpbmVOdW1iZXIsIHJuZy5mcm9tTGluZU51bWJlcik7XG5cdFx0XHRjb25zdCB0byA9IE1hdGgubWluKGVuZExpbmVOdW1iZXIsIHJuZy50b0xpbmVOdW1iZXIpO1xuXG5cdFx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gZnJvbTsgbGluZU51bWJlciA8PSB0bzsgbGluZU51bWJlcisrKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmVJbmRleCA9IGxpbmVOdW1iZXIgLSB0aGlzLl9yZW5kTGluZU51bWJlclN0YXJ0O1xuXHRcdFx0XHR0aGlzLl9saW5lc1tsaW5lSW5kZXhdLm9uVG9rZW5zQ2hhbmdlZCgpO1xuXHRcdFx0XHRub3RpZmllZFNvbWVvbmUgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBub3RpZmllZFNvbWVvbmU7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFZpc2libGVMaW5lc0NvbGxlY3Rpb248VCBleHRlbmRzIElWaXNpYmxlTGluZT4ge1xuXG5cdHB1YmxpYyByZWFkb25seSBkb21Ob2RlOiBGYXN0RG9tTm9kZTxIVE1MRWxlbWVudD4gPSB0aGlzLl9jcmVhdGVEb21Ob2RlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xpbmVzQ29sbGVjdGlvbjogUmVuZGVyZWRMaW5lc0NvbGxlY3Rpb248VD4gPSBuZXcgUmVuZGVyZWRMaW5lc0NvbGxlY3Rpb248VD4odGhpcy5fbGluZUZhY3RvcnkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xpbmVGYWN0b3J5OiBJTGluZUZhY3Rvcnk8VD5cblx0KSB7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVEb21Ob2RlKCk6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50PiB7XG5cdFx0Y29uc3QgZG9tTm9kZSA9IGNyZWF0ZUZhc3REb21Ob2RlKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKTtcblx0XHRkb21Ob2RlLnNldENsYXNzTmFtZSgndmlldy1sYXllcicpO1xuXHRcdGRvbU5vZGUuc2V0UG9zaXRpb24oJ2Fic29sdXRlJyk7XG5cdFx0ZG9tTm9kZS5kb21Ob2RlLnNldEF0dHJpYnV0ZSgncm9sZScsICdwcmVzZW50YXRpb24nKTtcblx0XHRkb21Ob2RlLmRvbU5vZGUuc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XG5cdFx0cmV0dXJuIGRvbU5vZGU7XG5cdH1cblxuXHQvLyAtLS0tIGJlZ2luIHZpZXcgZXZlbnQgaGFuZGxlcnNcblxuXHRwdWJsaWMgb25Db25maWd1cmF0aW9uQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ubGF5b3V0SW5mbykpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgb25GbHVzaGVkKGU6IHZpZXdFdmVudHMuVmlld0ZsdXNoZWRFdmVudCwgZmx1c2hEb20/OiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0Ly8gTm8gbmVlZCB0byBjbGVhciB0aGUgZG9tIG5vZGUgYmVjYXVzZSBhIGZ1bGwgLmlubmVySFRNTCB3aWxsIG9jY3VyIGluXG5cdFx0Ly8gVmlld0xheWVyUmVuZGVyZXIuX3JlbmRlciwgaG93ZXZlciB0aGUgZmFsbGJhY2sgbWVjaGFuaXNtIGluIHRoZVxuXHRcdC8vIEdQVSByZW5kZXJlciBtYXkgY2F1c2UgdGhpcyB0byBiZSBuZWNlc3NhcnkgYXMgdGhlIC5pbm5lckhUTUwgY2FsbFxuXHRcdC8vIG1heSBub3QgaGFwcGVuIGRlcGVuZGluZyBvbiB0aGUgbmV3IHN0YXRlLCBsZWF2aW5nIHN0YWxlIERPTSBub2Rlc1xuXHRcdC8vIGFyb3VuZC5cblx0XHRpZiAoZmx1c2hEb20pIHtcblx0XHRcdGNvbnN0IHN0YXJ0ID0gdGhpcy5fbGluZXNDb2xsZWN0aW9uLmdldFN0YXJ0TGluZU51bWJlcigpO1xuXHRcdFx0Y29uc3QgZW5kID0gdGhpcy5fbGluZXNDb2xsZWN0aW9uLmdldEVuZExpbmVOdW1iZXIoKTtcblx0XHRcdGZvciAobGV0IGkgPSBzdGFydDsgaSA8PSBlbmQ7IGkrKykge1xuXHRcdFx0XHR0aGlzLl9saW5lc0NvbGxlY3Rpb24uZ2V0TGluZShpKS5nZXREb21Ob2RlKCk/LnJlbW92ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9saW5lc0NvbGxlY3Rpb24uZmx1c2goKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvbkxpbmVzQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdMaW5lc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9saW5lc0NvbGxlY3Rpb24ub25MaW5lc0NoYW5nZWQoZS5mcm9tTGluZU51bWJlciwgZS5jb3VudCk7XG5cdH1cblxuXHRwdWJsaWMgb25MaW5lc0RlbGV0ZWQoZTogdmlld0V2ZW50cy5WaWV3TGluZXNEZWxldGVkRXZlbnQpOiBib29sZWFuIHtcblx0XHRjb25zdCBkZWxldGVkID0gdGhpcy5fbGluZXNDb2xsZWN0aW9uLm9uTGluZXNEZWxldGVkKGUuZnJvbUxpbmVOdW1iZXIsIGUudG9MaW5lTnVtYmVyKTtcblx0XHRpZiAoZGVsZXRlZCkge1xuXHRcdFx0Ly8gUmVtb3ZlIGZyb20gRE9NXG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gZGVsZXRlZC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRjb25zdCBsaW5lRG9tTm9kZSA9IGRlbGV0ZWRbaV0uZ2V0RG9tTm9kZSgpO1xuXHRcdFx0XHRsaW5lRG9tTm9kZT8ucmVtb3ZlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgb25MaW5lc0luc2VydGVkKGU6IHZpZXdFdmVudHMuVmlld0xpbmVzSW5zZXJ0ZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGRlbGV0ZWQgPSB0aGlzLl9saW5lc0NvbGxlY3Rpb24ub25MaW5lc0luc2VydGVkKGUuZnJvbUxpbmVOdW1iZXIsIGUudG9MaW5lTnVtYmVyKTtcblx0XHRpZiAoZGVsZXRlZCkge1xuXHRcdFx0Ly8gUmVtb3ZlIGZyb20gRE9NXG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gZGVsZXRlZC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRjb25zdCBsaW5lRG9tTm9kZSA9IGRlbGV0ZWRbaV0uZ2V0RG9tTm9kZSgpO1xuXHRcdFx0XHRsaW5lRG9tTm9kZT8ucmVtb3ZlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgb25TY3JvbGxDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld1Njcm9sbENoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBlLnNjcm9sbFRvcENoYW5nZWQ7XG5cdH1cblxuXHRwdWJsaWMgb25Ub2tlbnNDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld1Rva2Vuc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9saW5lc0NvbGxlY3Rpb24ub25Ub2tlbnNDaGFuZ2VkKGUucmFuZ2VzKTtcblx0fVxuXG5cdHB1YmxpYyBvblpvbmVzQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdab25lc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Ly8gLS0tLSBlbmQgdmlldyBldmVudCBoYW5kbGVyc1xuXG5cdHB1YmxpYyBnZXRTdGFydExpbmVOdW1iZXIoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXNDb2xsZWN0aW9uLmdldFN0YXJ0TGluZU51bWJlcigpO1xuXHR9XG5cblx0cHVibGljIGdldEVuZExpbmVOdW1iZXIoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXNDb2xsZWN0aW9uLmdldEVuZExpbmVOdW1iZXIoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWaXNpYmxlTGluZShsaW5lTnVtYmVyOiBudW1iZXIpOiBUIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXNDb2xsZWN0aW9uLmdldExpbmUobGluZU51bWJlcik7XG5cdH1cblxuXHRwdWJsaWMgcmVuZGVyTGluZXModmlld3BvcnREYXRhOiBWaWV3cG9ydERhdGEpOiB2b2lkIHtcblxuXHRcdGNvbnN0IGlucCA9IHRoaXMuX2xpbmVzQ29sbGVjdGlvbi5fZ2V0KCk7XG5cblx0XHRjb25zdCByZW5kZXJlciA9IG5ldyBWaWV3TGF5ZXJSZW5kZXJlcjxUPih0aGlzLmRvbU5vZGUuZG9tTm9kZSwgdGhpcy5fbGluZUZhY3RvcnksIHZpZXdwb3J0RGF0YSk7XG5cblx0XHRjb25zdCBjdHg6IElSZW5kZXJlckNvbnRleHQ8VD4gPSB7XG5cdFx0XHRyZW5kTGluZU51bWJlclN0YXJ0OiBpbnAucmVuZExpbmVOdW1iZXJTdGFydCxcblx0XHRcdGxpbmVzOiBpbnAubGluZXMsXG5cdFx0XHRsaW5lc0xlbmd0aDogaW5wLmxpbmVzLmxlbmd0aFxuXHRcdH07XG5cblx0XHQvLyBEZWNpZGUgaWYgdGhpcyByZW5kZXIgd2lsbCBkbyBhIHNpbmdsZSB1cGRhdGUgKHNpbmdsZSBsYXJnZSAuaW5uZXJIVE1MKSBvciBtYW55IHVwZGF0ZXMgKGluc2VydGluZy9yZW1vdmluZyBkb20gbm9kZXMpXG5cdFx0Y29uc3QgcmVzQ3R4ID0gcmVuZGVyZXIucmVuZGVyKGN0eCwgdmlld3BvcnREYXRhLnN0YXJ0TGluZU51bWJlciwgdmlld3BvcnREYXRhLmVuZExpbmVOdW1iZXIsIHZpZXdwb3J0RGF0YS5yZWxhdGl2ZVZlcnRpY2FsT2Zmc2V0KTtcblxuXHRcdHRoaXMuX2xpbmVzQ29sbGVjdGlvbi5fc2V0KHJlc0N0eC5yZW5kTGluZU51bWJlclN0YXJ0LCByZXNDdHgubGluZXMpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJUmVuZGVyZXJDb250ZXh0PFQgZXh0ZW5kcyBJVmlzaWJsZUxpbmU+IHtcblx0cmVuZExpbmVOdW1iZXJTdGFydDogbnVtYmVyO1xuXHRsaW5lczogVFtdO1xuXHRsaW5lc0xlbmd0aDogbnVtYmVyO1xufVxuXG5jbGFzcyBWaWV3TGF5ZXJSZW5kZXJlcjxUIGV4dGVuZHMgSVZpc2libGVMaW5lPiB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3R0UG9saWN5ID0gY3JlYXRlVHJ1c3RlZFR5cGVzUG9saWN5KCdlZGl0b3JWaWV3TGF5ZXInLCB7IGNyZWF0ZUhUTUw6IHZhbHVlID0+IHZhbHVlIH0pO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RvbU5vZGU6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xpbmVGYWN0b3J5OiBJTGluZUZhY3Rvcnk8VD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdmlld3BvcnREYXRhOiBWaWV3cG9ydERhdGEsXG5cdCkge1xuXHR9XG5cblx0cHVibGljIHJlbmRlcihpbkNvbnRleHQ6IElSZW5kZXJlckNvbnRleHQ8VD4sIHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBzdG9wTGluZU51bWJlcjogbnVtYmVyLCBkZWx0YVRvcDogbnVtYmVyW10pOiBJUmVuZGVyZXJDb250ZXh0PFQ+IHtcblxuXHRcdGNvbnN0IGN0eDogSVJlbmRlcmVyQ29udGV4dDxUPiA9IHtcblx0XHRcdHJlbmRMaW5lTnVtYmVyU3RhcnQ6IGluQ29udGV4dC5yZW5kTGluZU51bWJlclN0YXJ0LFxuXHRcdFx0bGluZXM6IGluQ29udGV4dC5saW5lcy5zbGljZSgwKSxcblx0XHRcdGxpbmVzTGVuZ3RoOiBpbkNvbnRleHQubGluZXNMZW5ndGhcblx0XHR9O1xuXG5cdFx0aWYgKChjdHgucmVuZExpbmVOdW1iZXJTdGFydCArIGN0eC5saW5lc0xlbmd0aCAtIDEgPCBzdGFydExpbmVOdW1iZXIpIHx8IChzdG9wTGluZU51bWJlciA8IGN0eC5yZW5kTGluZU51bWJlclN0YXJ0KSkge1xuXHRcdFx0Ly8gVGhlcmUgaXMgbm8gb3ZlcmxhcCB3aGF0c29ldmVyXG5cdFx0XHRjdHgucmVuZExpbmVOdW1iZXJTdGFydCA9IHN0YXJ0TGluZU51bWJlcjtcblx0XHRcdGN0eC5saW5lc0xlbmd0aCA9IHN0b3BMaW5lTnVtYmVyIC0gc3RhcnRMaW5lTnVtYmVyICsgMTtcblx0XHRcdGN0eC5saW5lcyA9IFtdO1xuXHRcdFx0Zm9yIChsZXQgeCA9IHN0YXJ0TGluZU51bWJlcjsgeCA8PSBzdG9wTGluZU51bWJlcjsgeCsrKSB7XG5cdFx0XHRcdGN0eC5saW5lc1t4IC0gc3RhcnRMaW5lTnVtYmVyXSA9IHRoaXMuX2xpbmVGYWN0b3J5LmNyZWF0ZUxpbmUoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2ZpbmlzaFJlbmRlcmluZyhjdHgsIHRydWUsIGRlbHRhVG9wKTtcblx0XHRcdHJldHVybiBjdHg7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIGxpbmVzIHdoaWNoIHdpbGwgcmVtYWluIHVudG91Y2hlZFxuXHRcdHRoaXMuX3JlbmRlclVudG91Y2hlZExpbmVzKFxuXHRcdFx0Y3R4LFxuXHRcdFx0TWF0aC5tYXgoc3RhcnRMaW5lTnVtYmVyIC0gY3R4LnJlbmRMaW5lTnVtYmVyU3RhcnQsIDApLFxuXHRcdFx0TWF0aC5taW4oc3RvcExpbmVOdW1iZXIgLSBjdHgucmVuZExpbmVOdW1iZXJTdGFydCwgY3R4LmxpbmVzTGVuZ3RoIC0gMSksXG5cdFx0XHRkZWx0YVRvcCxcblx0XHRcdHN0YXJ0TGluZU51bWJlclxuXHRcdCk7XG5cblx0XHRpZiAoY3R4LnJlbmRMaW5lTnVtYmVyU3RhcnQgPiBzdGFydExpbmVOdW1iZXIpIHtcblx0XHRcdC8vIEluc2VydCBsaW5lcyBiZWZvcmVcblx0XHRcdGNvbnN0IGZyb21MaW5lTnVtYmVyID0gc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0Y29uc3QgdG9MaW5lTnVtYmVyID0gTWF0aC5taW4oc3RvcExpbmVOdW1iZXIsIGN0eC5yZW5kTGluZU51bWJlclN0YXJ0IC0gMSk7XG5cdFx0XHRpZiAoZnJvbUxpbmVOdW1iZXIgPD0gdG9MaW5lTnVtYmVyKSB7XG5cdFx0XHRcdHRoaXMuX2luc2VydExpbmVzQmVmb3JlKGN0eCwgZnJvbUxpbmVOdW1iZXIsIHRvTGluZU51bWJlciwgZGVsdGFUb3AsIHN0YXJ0TGluZU51bWJlcik7XG5cdFx0XHRcdGN0eC5saW5lc0xlbmd0aCArPSB0b0xpbmVOdW1iZXIgLSBmcm9tTGluZU51bWJlciArIDE7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChjdHgucmVuZExpbmVOdW1iZXJTdGFydCA8IHN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0Ly8gUmVtb3ZlIGxpbmVzIGJlZm9yZVxuXHRcdFx0Y29uc3QgcmVtb3ZlQ250ID0gTWF0aC5taW4oY3R4LmxpbmVzTGVuZ3RoLCBzdGFydExpbmVOdW1iZXIgLSBjdHgucmVuZExpbmVOdW1iZXJTdGFydCk7XG5cdFx0XHRpZiAocmVtb3ZlQ250ID4gMCkge1xuXHRcdFx0XHR0aGlzLl9yZW1vdmVMaW5lc0JlZm9yZShjdHgsIHJlbW92ZUNudCk7XG5cdFx0XHRcdGN0eC5saW5lc0xlbmd0aCAtPSByZW1vdmVDbnQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y3R4LnJlbmRMaW5lTnVtYmVyU3RhcnQgPSBzdGFydExpbmVOdW1iZXI7XG5cblx0XHRpZiAoY3R4LnJlbmRMaW5lTnVtYmVyU3RhcnQgKyBjdHgubGluZXNMZW5ndGggLSAxIDwgc3RvcExpbmVOdW1iZXIpIHtcblx0XHRcdC8vIEluc2VydCBsaW5lcyBhZnRlclxuXHRcdFx0Y29uc3QgZnJvbUxpbmVOdW1iZXIgPSBjdHgucmVuZExpbmVOdW1iZXJTdGFydCArIGN0eC5saW5lc0xlbmd0aDtcblx0XHRcdGNvbnN0IHRvTGluZU51bWJlciA9IHN0b3BMaW5lTnVtYmVyO1xuXG5cdFx0XHRpZiAoZnJvbUxpbmVOdW1iZXIgPD0gdG9MaW5lTnVtYmVyKSB7XG5cdFx0XHRcdHRoaXMuX2luc2VydExpbmVzQWZ0ZXIoY3R4LCBmcm9tTGluZU51bWJlciwgdG9MaW5lTnVtYmVyLCBkZWx0YVRvcCwgc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdFx0Y3R4LmxpbmVzTGVuZ3RoICs9IHRvTGluZU51bWJlciAtIGZyb21MaW5lTnVtYmVyICsgMTtcblx0XHRcdH1cblxuXHRcdH0gZWxzZSBpZiAoY3R4LnJlbmRMaW5lTnVtYmVyU3RhcnQgKyBjdHgubGluZXNMZW5ndGggLSAxID4gc3RvcExpbmVOdW1iZXIpIHtcblx0XHRcdC8vIFJlbW92ZSBsaW5lcyBhZnRlclxuXHRcdFx0Y29uc3QgZnJvbUxpbmVOdW1iZXIgPSBNYXRoLm1heCgwLCBzdG9wTGluZU51bWJlciAtIGN0eC5yZW5kTGluZU51bWJlclN0YXJ0ICsgMSk7XG5cdFx0XHRjb25zdCB0b0xpbmVOdW1iZXIgPSBjdHgubGluZXNMZW5ndGggLSAxO1xuXHRcdFx0Y29uc3QgcmVtb3ZlQ250ID0gdG9MaW5lTnVtYmVyIC0gZnJvbUxpbmVOdW1iZXIgKyAxO1xuXG5cdFx0XHRpZiAocmVtb3ZlQ250ID4gMCkge1xuXHRcdFx0XHR0aGlzLl9yZW1vdmVMaW5lc0FmdGVyKGN0eCwgcmVtb3ZlQ250KTtcblx0XHRcdFx0Y3R4LmxpbmVzTGVuZ3RoIC09IHJlbW92ZUNudDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9maW5pc2hSZW5kZXJpbmcoY3R4LCBmYWxzZSwgZGVsdGFUb3ApO1xuXG5cdFx0cmV0dXJuIGN0eDtcblx0fVxuXG5cdHByaXZhdGUgX3JlbmRlclVudG91Y2hlZExpbmVzKGN0eDogSVJlbmRlcmVyQ29udGV4dDxUPiwgc3RhcnRJbmRleDogbnVtYmVyLCBlbmRJbmRleDogbnVtYmVyLCBkZWx0YVRvcDogbnVtYmVyW10sIGRlbHRhTE46IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IHJlbmRMaW5lTnVtYmVyU3RhcnQgPSBjdHgucmVuZExpbmVOdW1iZXJTdGFydDtcblx0XHRjb25zdCBsaW5lcyA9IGN0eC5saW5lcztcblxuXHRcdGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDw9IGVuZEluZGV4OyBpKyspIHtcblx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSByZW5kTGluZU51bWJlclN0YXJ0ICsgaTtcblx0XHRcdGxpbmVzW2ldLmxheW91dExpbmUobGluZU51bWJlciwgZGVsdGFUb3BbbGluZU51bWJlciAtIGRlbHRhTE5dLCB0aGlzLl92aWV3cG9ydERhdGEubGluZUhlaWdodCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfaW5zZXJ0TGluZXNCZWZvcmUoY3R4OiBJUmVuZGVyZXJDb250ZXh0PFQ+LCBmcm9tTGluZU51bWJlcjogbnVtYmVyLCB0b0xpbmVOdW1iZXI6IG51bWJlciwgZGVsdGFUb3A6IG51bWJlcltdLCBkZWx0YUxOOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBuZXdMaW5lczogVFtdID0gW107XG5cdFx0bGV0IG5ld0xpbmVzTGVuID0gMDtcblx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gZnJvbUxpbmVOdW1iZXI7IGxpbmVOdW1iZXIgPD0gdG9MaW5lTnVtYmVyOyBsaW5lTnVtYmVyKyspIHtcblx0XHRcdG5ld0xpbmVzW25ld0xpbmVzTGVuKytdID0gdGhpcy5fbGluZUZhY3RvcnkuY3JlYXRlTGluZSgpO1xuXHRcdH1cblx0XHRjdHgubGluZXMgPSBuZXdMaW5lcy5jb25jYXQoY3R4LmxpbmVzKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlbW92ZUxpbmVzQmVmb3JlKGN0eDogSVJlbmRlcmVyQ29udGV4dDxUPiwgcmVtb3ZlQ291bnQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcmVtb3ZlQ291bnQ7IGkrKykge1xuXHRcdFx0Y29uc3QgbGluZURvbU5vZGUgPSBjdHgubGluZXNbaV0uZ2V0RG9tTm9kZSgpO1xuXHRcdFx0bGluZURvbU5vZGU/LnJlbW92ZSgpO1xuXHRcdH1cblx0XHRjdHgubGluZXMuc3BsaWNlKDAsIHJlbW92ZUNvdW50KTtcblx0fVxuXG5cdHByaXZhdGUgX2luc2VydExpbmVzQWZ0ZXIoY3R4OiBJUmVuZGVyZXJDb250ZXh0PFQ+LCBmcm9tTGluZU51bWJlcjogbnVtYmVyLCB0b0xpbmVOdW1iZXI6IG51bWJlciwgZGVsdGFUb3A6IG51bWJlcltdLCBkZWx0YUxOOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBuZXdMaW5lczogVFtdID0gW107XG5cdFx0bGV0IG5ld0xpbmVzTGVuID0gMDtcblx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gZnJvbUxpbmVOdW1iZXI7IGxpbmVOdW1iZXIgPD0gdG9MaW5lTnVtYmVyOyBsaW5lTnVtYmVyKyspIHtcblx0XHRcdG5ld0xpbmVzW25ld0xpbmVzTGVuKytdID0gdGhpcy5fbGluZUZhY3RvcnkuY3JlYXRlTGluZSgpO1xuXHRcdH1cblx0XHRjdHgubGluZXMgPSBjdHgubGluZXMuY29uY2F0KG5ld0xpbmVzKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlbW92ZUxpbmVzQWZ0ZXIoY3R4OiBJUmVuZGVyZXJDb250ZXh0PFQ+LCByZW1vdmVDb3VudDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVtb3ZlSW5kZXggPSBjdHgubGluZXNMZW5ndGggLSByZW1vdmVDb3VudDtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcmVtb3ZlQ291bnQ7IGkrKykge1xuXHRcdFx0Y29uc3QgbGluZURvbU5vZGUgPSBjdHgubGluZXNbcmVtb3ZlSW5kZXggKyBpXS5nZXREb21Ob2RlKCk7XG5cdFx0XHRsaW5lRG9tTm9kZT8ucmVtb3ZlKCk7XG5cdFx0fVxuXHRcdGN0eC5saW5lcy5zcGxpY2UocmVtb3ZlSW5kZXgsIHJlbW92ZUNvdW50KTtcblx0fVxuXG5cdHByaXZhdGUgX2ZpbmlzaFJlbmRlcmluZ05ld0xpbmVzKGN0eDogSVJlbmRlcmVyQ29udGV4dDxUPiwgZG9tTm9kZUlzRW1wdHk6IGJvb2xlYW4sIG5ld0xpbmVzSFRNTDogc3RyaW5nIHwgVHJ1c3RlZEhUTUwsIHdhc05ldzogYm9vbGVhbltdKTogdm9pZCB7XG5cdFx0aWYgKFZpZXdMYXllclJlbmRlcmVyLl90dFBvbGljeSkge1xuXHRcdFx0bmV3TGluZXNIVE1MID0gVmlld0xheWVyUmVuZGVyZXIuX3R0UG9saWN5LmNyZWF0ZUhUTUwobmV3TGluZXNIVE1MIGFzIHN0cmluZyk7XG5cdFx0fVxuXHRcdGNvbnN0IGxhc3RDaGlsZCA9IDxIVE1MRWxlbWVudD50aGlzLl9kb21Ob2RlLmxhc3RDaGlsZDtcblx0XHRpZiAoZG9tTm9kZUlzRW1wdHkgfHwgIWxhc3RDaGlsZCkge1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5pbm5lckhUTUwgPSBuZXdMaW5lc0hUTUwgYXMgc3RyaW5nOyAvLyBleHBsYWlucyB0aGUgdWdseSBjYXN0cyAtPiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTA2Mzk2I2lzc3VlY29tbWVudC02OTI2MjUzOTM7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxhc3RDaGlsZC5pbnNlcnRBZGphY2VudEhUTUwoJ2FmdGVyZW5kJywgbmV3TGluZXNIVE1MIGFzIHN0cmluZyk7XG5cdFx0fVxuXG5cdFx0bGV0IGN1cnJDaGlsZCA9IDxIVE1MRWxlbWVudD50aGlzLl9kb21Ob2RlLmxhc3RDaGlsZDtcblx0XHRmb3IgKGxldCBpID0gY3R4LmxpbmVzTGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdGNvbnN0IGxpbmUgPSBjdHgubGluZXNbaV07XG5cdFx0XHRpZiAod2FzTmV3W2ldKSB7XG5cdFx0XHRcdGxpbmUuc2V0RG9tTm9kZShjdXJyQ2hpbGQpO1xuXHRcdFx0XHRjdXJyQ2hpbGQgPSA8SFRNTEVsZW1lbnQ+Y3VyckNoaWxkLnByZXZpb3VzU2libGluZztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9maW5pc2hSZW5kZXJpbmdJbnZhbGlkTGluZXMoY3R4OiBJUmVuZGVyZXJDb250ZXh0PFQ+LCBpbnZhbGlkTGluZXNIVE1MOiBzdHJpbmcgfCBUcnVzdGVkSFRNTCwgd2FzSW52YWxpZDogYm9vbGVhbltdKTogdm9pZCB7XG5cdFx0Y29uc3QgaHVnZURvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuXHRcdGlmIChWaWV3TGF5ZXJSZW5kZXJlci5fdHRQb2xpY3kpIHtcblx0XHRcdGludmFsaWRMaW5lc0hUTUwgPSBWaWV3TGF5ZXJSZW5kZXJlci5fdHRQb2xpY3kuY3JlYXRlSFRNTChpbnZhbGlkTGluZXNIVE1MIGFzIHN0cmluZyk7XG5cdFx0fVxuXHRcdGh1Z2VEb21Ob2RlLmlubmVySFRNTCA9IGludmFsaWRMaW5lc0hUTUwgYXMgc3RyaW5nO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjdHgubGluZXNMZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgbGluZSA9IGN0eC5saW5lc1tpXTtcblx0XHRcdGlmICh3YXNJbnZhbGlkW2ldKSB7XG5cdFx0XHRcdGNvbnN0IHNvdXJjZSA9IDxIVE1MRWxlbWVudD5odWdlRG9tTm9kZS5maXJzdENoaWxkO1xuXHRcdFx0XHRjb25zdCBsaW5lRG9tTm9kZSA9IGxpbmUuZ2V0RG9tTm9kZSgpITtcblx0XHRcdFx0bGluZURvbU5vZGUucGFyZW50Tm9kZSEucmVwbGFjZUNoaWxkKHNvdXJjZSwgbGluZURvbU5vZGUpO1xuXHRcdFx0XHRsaW5lLnNldERvbU5vZGUoc291cmNlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBfc2IgPSBuZXcgU3RyaW5nQnVpbGRlcigxMDAwMDApO1xuXG5cdHByaXZhdGUgX2ZpbmlzaFJlbmRlcmluZyhjdHg6IElSZW5kZXJlckNvbnRleHQ8VD4sIGRvbU5vZGVJc0VtcHR5OiBib29sZWFuLCBkZWx0YVRvcDogbnVtYmVyW10pOiB2b2lkIHtcblxuXHRcdGNvbnN0IHNiID0gVmlld0xheWVyUmVuZGVyZXIuX3NiO1xuXHRcdGNvbnN0IGxpbmVzTGVuZ3RoID0gY3R4LmxpbmVzTGVuZ3RoO1xuXHRcdGNvbnN0IGxpbmVzID0gY3R4LmxpbmVzO1xuXHRcdGNvbnN0IHJlbmRMaW5lTnVtYmVyU3RhcnQgPSBjdHgucmVuZExpbmVOdW1iZXJTdGFydDtcblxuXHRcdGNvbnN0IHdhc05ldzogYm9vbGVhbltdID0gW107XG5cdFx0e1xuXHRcdFx0c2IucmVzZXQoKTtcblx0XHRcdGxldCBoYWROZXdMaW5lID0gZmFsc2U7XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXNMZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBsaW5lID0gbGluZXNbaV07XG5cdFx0XHRcdHdhc05ld1tpXSA9IGZhbHNlO1xuXG5cdFx0XHRcdGNvbnN0IGxpbmVEb21Ob2RlID0gbGluZS5nZXREb21Ob2RlKCk7XG5cdFx0XHRcdGlmIChsaW5lRG9tTm9kZSkge1xuXHRcdFx0XHRcdC8vIGxpbmUgaXMgbm90IG5ld1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmVuZGVyUmVzdWx0ID0gbGluZS5yZW5kZXJMaW5lKGkgKyByZW5kTGluZU51bWJlclN0YXJ0LCBkZWx0YVRvcFtpXSwgdGhpcy5fdmlld3BvcnREYXRhLmxpbmVIZWlnaHQsIHRoaXMuX3ZpZXdwb3J0RGF0YSwgc2IpO1xuXHRcdFx0XHRpZiAoIXJlbmRlclJlc3VsdCkge1xuXHRcdFx0XHRcdC8vIGxpbmUgZG9lcyBub3QgbmVlZCByZW5kZXJpbmdcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHdhc05ld1tpXSA9IHRydWU7XG5cdFx0XHRcdGhhZE5ld0xpbmUgPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaGFkTmV3TGluZSkge1xuXHRcdFx0XHR0aGlzLl9maW5pc2hSZW5kZXJpbmdOZXdMaW5lcyhjdHgsIGRvbU5vZGVJc0VtcHR5LCBzYi5idWlsZCgpLCB3YXNOZXcpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHtcblx0XHRcdHNiLnJlc2V0KCk7XG5cblx0XHRcdGxldCBoYWRJbnZhbGlkTGluZSA9IGZhbHNlO1xuXHRcdFx0Y29uc3Qgd2FzSW52YWxpZDogYm9vbGVhbltdID0gW107XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXNMZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBsaW5lID0gbGluZXNbaV07XG5cdFx0XHRcdHdhc0ludmFsaWRbaV0gPSBmYWxzZTtcblxuXHRcdFx0XHRpZiAod2FzTmV3W2ldKSB7XG5cdFx0XHRcdFx0Ly8gbGluZSB3YXMgbmV3XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCByZW5kZXJSZXN1bHQgPSBsaW5lLnJlbmRlckxpbmUoaSArIHJlbmRMaW5lTnVtYmVyU3RhcnQsIGRlbHRhVG9wW2ldLCB0aGlzLl92aWV3cG9ydERhdGEubGluZUhlaWdodCwgdGhpcy5fdmlld3BvcnREYXRhLCBzYik7XG5cdFx0XHRcdGlmICghcmVuZGVyUmVzdWx0KSB7XG5cdFx0XHRcdFx0Ly8gbGluZSBkb2VzIG5vdCBuZWVkIHJlbmRlcmluZ1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0d2FzSW52YWxpZFtpXSA9IHRydWU7XG5cdFx0XHRcdGhhZEludmFsaWRMaW5lID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGhhZEludmFsaWRMaW5lKSB7XG5cdFx0XHRcdHRoaXMuX2ZpbmlzaFJlbmRlcmluZ0ludmFsaWRMaW5lcyhjdHgsIHNiLmJ1aWxkKCksIHdhc0ludmFsaWQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBc0IseUJBQXlCO0FBQy9DLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMscUJBQXFCO0FBZ0N2QixNQUFNLHdCQUF5QztBQUFBLEVBSXJELFlBQ2tCLGNBQ2hCO0FBRGdCO0FBRWpCLFNBQUssS0FBSyxHQUFHLENBQUMsQ0FBQztBQUFBLEVBQ2hCO0FBQUEsRUFFTyxRQUFjO0FBQ3BCLFNBQUssS0FBSyxHQUFHLENBQUMsQ0FBQztBQUFBLEVBQ2hCO0FBQUEsRUFFQSxLQUFLLHFCQUE2QixPQUFrQjtBQUNuRCxTQUFLLFNBQVM7QUFDZCxTQUFLLHVCQUF1QjtBQUFBLEVBQzdCO0FBQUEsRUFFQSxPQUFvRDtBQUNuRCxXQUFPO0FBQUEsTUFDTixxQkFBcUIsS0FBSztB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
