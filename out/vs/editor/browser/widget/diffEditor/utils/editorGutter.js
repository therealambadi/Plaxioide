import { h, reset } from "../../../../../base/browser/dom.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, observableFromEvent, observableSignal, observableSignalFromEvent, observableValue, transaction } from "../../../../../base/common/observable.js";
import { LineRange } from "../../../../common/core/lineRange.js";
import { OffsetRange } from "../../../../common/core/offsetRange.js";
class EditorGutter extends Disposable {
  constructor(_editor, _domNode, itemProvider) {
    super();
    this._editor = _editor;
    this._domNode = _domNode;
    this.itemProvider = itemProvider;
    this.scrollTop = observableFromEvent(
      this,
      this._editor.onDidScrollChange,
      (e) => (
        /** @description editor.onDidScrollChange */
        this._editor.getScrollTop()
      )
    );
    this.isScrollTopZero = this.scrollTop.map((scrollTop) => (
      /** @description isScrollTopZero */
      scrollTop === 0
    ));
    this.modelAttached = observableFromEvent(
      this,
      this._editor.onDidChangeModel,
      (e) => (
        /** @description editor.onDidChangeModel */
        this._editor.hasModel()
      )
    );
    this.editorOnDidChangeViewZones = observableSignalFromEvent("onDidChangeViewZones", this._editor.onDidChangeViewZones);
    this.editorOnDidContentSizeChange = observableSignalFromEvent("onDidContentSizeChange", this._editor.onDidContentSizeChange);
    this.domNodeSizeChanged = observableSignal("domNodeSizeChanged");
    this.views = /* @__PURE__ */ new Map();
    this._domNode.className = "gutter monaco-editor";
    const scrollDecoration = this._domNode.appendChild(
      h("div.scroll-decoration", { role: "presentation", ariaHidden: "true", style: { width: "100%" } }).root
    );
    const o = new ResizeObserver(() => {
      transaction((tx) => {
        this.domNodeSizeChanged.trigger(tx);
      });
    });
    o.observe(this._domNode);
    this._register(toDisposable(() => o.disconnect()));
    this._register(autorun((reader) => {
      scrollDecoration.className = this.isScrollTopZero.read(reader) ? "" : "scroll-decoration";
    }));
    this._register(autorun((reader) => (
      /** @description EditorGutter.Render */
      this.render(reader)
    )));
  }
  dispose() {
    super.dispose();
    reset(this._domNode);
  }
  render(reader) {
    if (!this.modelAttached.read(reader)) {
      return;
    }
    this.domNodeSizeChanged.read(reader);
    this.editorOnDidChangeViewZones.read(reader);
    this.editorOnDidContentSizeChange.read(reader);
    const scrollTop = this.scrollTop.read(reader);
    const visibleRanges = this._editor.getVisibleRanges();
    const unusedIds = new Set(this.views.keys());
    const viewRange = OffsetRange.ofStartAndLength(0, this._domNode.clientHeight);
    if (!viewRange.isEmpty) {
      for (const visibleRange of visibleRanges) {
        const visibleRange2 = new LineRange(
          visibleRange.startLineNumber,
          visibleRange.endLineNumber + 1
        );
        const gutterItems = this.itemProvider.getIntersectingGutterItems(
          visibleRange2,
          reader
        );
        transaction((tx) => {
          for (const gutterItem of gutterItems) {
            if (!gutterItem.range.intersect(visibleRange2)) {
              continue;
            }
            unusedIds.delete(gutterItem.id);
            let view = this.views.get(gutterItem.id);
            if (!view) {
              const viewDomNode = document.createElement("div");
              this._domNode.appendChild(viewDomNode);
              const gutterItemObs = observableValue("item", gutterItem);
              const itemView = this.itemProvider.createView(
                gutterItemObs,
                viewDomNode
              );
              view = new ManagedGutterItemView(gutterItemObs, itemView, viewDomNode);
              this.views.set(gutterItem.id, view);
            } else {
              view.item.set(gutterItem, tx);
            }
            const top = gutterItem.range.startLineNumber <= this._editor.getModel().getLineCount() ? this._editor.getTopForLineNumber(gutterItem.range.startLineNumber, true) - scrollTop : this._editor.getBottomForLineNumber(gutterItem.range.startLineNumber - 1, false) - scrollTop;
            const bottom = gutterItem.range.endLineNumberExclusive === 1 ? Math.max(top, this._editor.getTopForLineNumber(gutterItem.range.startLineNumber, false) - scrollTop) : Math.max(top, this._editor.getBottomForLineNumber(gutterItem.range.endLineNumberExclusive - 1, true) - scrollTop);
            const height = bottom - top;
            view.domNode.style.top = `${top}px`;
            view.domNode.style.height = `${height}px`;
            view.gutterItemView.layout(OffsetRange.ofStartAndLength(top, height), viewRange);
          }
        });
      }
    }
    for (const id of unusedIds) {
      const view = this.views.get(id);
      view.gutterItemView.dispose();
      view.domNode.remove();
      this.views.delete(id);
    }
  }
}
class ManagedGutterItemView {
  constructor(item, gutterItemView, domNode) {
    this.item = item;
    this.gutterItemView = gutterItemView;
    this.domNode = domNode;
  }
}
export {
  EditorGutter
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci91dGlscy9lZGl0b3JHdXR0ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBoLCByZXNldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuLCBJT2JzZXJ2YWJsZSwgSVJlYWRlciwgSVNldHRhYmxlT2JzZXJ2YWJsZSwgb2JzZXJ2YWJsZUZyb21FdmVudCwgb2JzZXJ2YWJsZVNpZ25hbCwgb2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudCwgb2JzZXJ2YWJsZVZhbHVlLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uL2NvZGVFZGl0b3IvY29kZUVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBMaW5lUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9saW5lUmFuZ2UuanMnO1xuaW1wb3J0IHsgT2Zmc2V0UmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9vZmZzZXRSYW5nZS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBFZGl0b3JHdXR0ZXI8VCBleHRlbmRzIElHdXR0ZXJJdGVtSW5mbyA9IElHdXR0ZXJJdGVtSW5mbz4gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBzY3JvbGxUb3AgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMsXG5cdFx0dGhpcy5fZWRpdG9yLm9uRGlkU2Nyb2xsQ2hhbmdlLFxuXHRcdChlKSA9PiAvKiogQGRlc2NyaXB0aW9uIGVkaXRvci5vbkRpZFNjcm9sbENoYW5nZSAqLyB0aGlzLl9lZGl0b3IuZ2V0U2Nyb2xsVG9wKClcblx0KTtcblx0cHJpdmF0ZSByZWFkb25seSBpc1Njcm9sbFRvcFplcm8gPSB0aGlzLnNjcm9sbFRvcC5tYXAoKHNjcm9sbFRvcCkgPT4gLyoqIEBkZXNjcmlwdGlvbiBpc1Njcm9sbFRvcFplcm8gKi8gc2Nyb2xsVG9wID09PSAwKTtcblx0cHJpdmF0ZSByZWFkb25seSBtb2RlbEF0dGFjaGVkID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLFxuXHRcdHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsLFxuXHRcdChlKSA9PiAvKiogQGRlc2NyaXB0aW9uIGVkaXRvci5vbkRpZENoYW5nZU1vZGVsICovIHRoaXMuX2VkaXRvci5oYXNNb2RlbCgpXG5cdCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JPbkRpZENoYW5nZVZpZXdab25lcyA9IG9ic2VydmFibGVTaWduYWxGcm9tRXZlbnQoJ29uRGlkQ2hhbmdlVmlld1pvbmVzJywgdGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlVmlld1pvbmVzKTtcblx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JPbkRpZENvbnRlbnRTaXplQ2hhbmdlID0gb2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudCgnb25EaWRDb250ZW50U2l6ZUNoYW5nZScsIHRoaXMuX2VkaXRvci5vbkRpZENvbnRlbnRTaXplQ2hhbmdlKTtcblx0cHJpdmF0ZSByZWFkb25seSBkb21Ob2RlU2l6ZUNoYW5nZWQgPSBvYnNlcnZhYmxlU2lnbmFsKCdkb21Ob2RlU2l6ZUNoYW5nZWQnKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IENvZGVFZGl0b3JXaWRnZXQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9tTm9kZTogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBpdGVtUHJvdmlkZXI6IElHdXR0ZXJJdGVtUHJvdmlkZXI8VD5cblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTmFtZSA9ICdndXR0ZXIgbW9uYWNvLWVkaXRvcic7XG5cdFx0Y29uc3Qgc2Nyb2xsRGVjb3JhdGlvbiA9IHRoaXMuX2RvbU5vZGUuYXBwZW5kQ2hpbGQoXG5cdFx0XHRoKCdkaXYuc2Nyb2xsLWRlY29yYXRpb24nLCB7IHJvbGU6ICdwcmVzZW50YXRpb24nLCBhcmlhSGlkZGVuOiAndHJ1ZScsIHN0eWxlOiB7IHdpZHRoOiAnMTAwJScgfSB9KVxuXHRcdFx0XHQucm9vdFxuXHRcdCk7XG5cblx0XHRjb25zdCBvID0gbmV3IFJlc2l6ZU9ic2VydmVyKCgpID0+IHtcblx0XHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBSZXNpemVPYnNlcnZlcjogc2l6ZSBjaGFuZ2VkICovXG5cdFx0XHRcdHRoaXMuZG9tTm9kZVNpemVDaGFuZ2VkLnRyaWdnZXIodHgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0by5vYnNlcnZlKHRoaXMuX2RvbU5vZGUpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiBvLmRpc2Nvbm5lY3QoKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiB1cGRhdGUgc2Nyb2xsIGRlY29yYXRpb24gKi9cblx0XHRcdHNjcm9sbERlY29yYXRpb24uY2xhc3NOYW1lID0gdGhpcy5pc1Njcm9sbFRvcFplcm8ucmVhZChyZWFkZXIpID8gJycgOiAnc2Nyb2xsLWRlY29yYXRpb24nO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IC8qKiBAZGVzY3JpcHRpb24gRWRpdG9yR3V0dGVyLlJlbmRlciAqLyB0aGlzLnJlbmRlcihyZWFkZXIpKSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdHJlc2V0KHRoaXMuX2RvbU5vZGUpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSB2aWV3cyA9IG5ldyBNYXA8c3RyaW5nLCBNYW5hZ2VkR3V0dGVySXRlbVZpZXc+KCk7XG5cblx0cHJpdmF0ZSByZW5kZXIocmVhZGVyOiBJUmVhZGVyKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLm1vZGVsQXR0YWNoZWQucmVhZChyZWFkZXIpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5kb21Ob2RlU2l6ZUNoYW5nZWQucmVhZChyZWFkZXIpO1xuXHRcdHRoaXMuZWRpdG9yT25EaWRDaGFuZ2VWaWV3Wm9uZXMucmVhZChyZWFkZXIpO1xuXHRcdHRoaXMuZWRpdG9yT25EaWRDb250ZW50U2l6ZUNoYW5nZS5yZWFkKHJlYWRlcik7XG5cblx0XHRjb25zdCBzY3JvbGxUb3AgPSB0aGlzLnNjcm9sbFRvcC5yZWFkKHJlYWRlcik7XG5cblx0XHRjb25zdCB2aXNpYmxlUmFuZ2VzID0gdGhpcy5fZWRpdG9yLmdldFZpc2libGVSYW5nZXMoKTtcblx0XHRjb25zdCB1bnVzZWRJZHMgPSBuZXcgU2V0KHRoaXMudmlld3Mua2V5cygpKTtcblxuXHRcdGNvbnN0IHZpZXdSYW5nZSA9IE9mZnNldFJhbmdlLm9mU3RhcnRBbmRMZW5ndGgoMCwgdGhpcy5fZG9tTm9kZS5jbGllbnRIZWlnaHQpO1xuXG5cdFx0aWYgKCF2aWV3UmFuZ2UuaXNFbXB0eSkge1xuXHRcdFx0Zm9yIChjb25zdCB2aXNpYmxlUmFuZ2Ugb2YgdmlzaWJsZVJhbmdlcykge1xuXHRcdFx0XHRjb25zdCB2aXNpYmxlUmFuZ2UyID0gbmV3IExpbmVSYW5nZShcblx0XHRcdFx0XHR2aXNpYmxlUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdHZpc2libGVSYW5nZS5lbmRMaW5lTnVtYmVyICsgMVxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdGNvbnN0IGd1dHRlckl0ZW1zID0gdGhpcy5pdGVtUHJvdmlkZXIuZ2V0SW50ZXJzZWN0aW5nR3V0dGVySXRlbXMoXG5cdFx0XHRcdFx0dmlzaWJsZVJhbmdlMixcblx0XHRcdFx0XHRyZWFkZXJcblx0XHRcdFx0KTtcblxuXHRcdFx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHRcdFx0LyoqIEVkaXRvckd1dHRlci5yZW5kZXIgKi9cblxuXHRcdFx0XHRcdGZvciAoY29uc3QgZ3V0dGVySXRlbSBvZiBndXR0ZXJJdGVtcykge1xuXHRcdFx0XHRcdFx0aWYgKCFndXR0ZXJJdGVtLnJhbmdlLmludGVyc2VjdCh2aXNpYmxlUmFuZ2UyKSkge1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0dW51c2VkSWRzLmRlbGV0ZShndXR0ZXJJdGVtLmlkKTtcblx0XHRcdFx0XHRcdGxldCB2aWV3ID0gdGhpcy52aWV3cy5nZXQoZ3V0dGVySXRlbS5pZCk7XG5cdFx0XHRcdFx0XHRpZiAoIXZpZXcpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3Qgdmlld0RvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5fZG9tTm9kZS5hcHBlbmRDaGlsZCh2aWV3RG9tTm9kZSk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGd1dHRlckl0ZW1PYnMgPSBvYnNlcnZhYmxlVmFsdWUoJ2l0ZW0nLCBndXR0ZXJJdGVtKTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgaXRlbVZpZXcgPSB0aGlzLml0ZW1Qcm92aWRlci5jcmVhdGVWaWV3KFxuXHRcdFx0XHRcdFx0XHRcdGd1dHRlckl0ZW1PYnMsXG5cdFx0XHRcdFx0XHRcdFx0dmlld0RvbU5vZGVcblx0XHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRcdFx0dmlldyA9IG5ldyBNYW5hZ2VkR3V0dGVySXRlbVZpZXcoZ3V0dGVySXRlbU9icywgaXRlbVZpZXcsIHZpZXdEb21Ob2RlKTtcblx0XHRcdFx0XHRcdFx0dGhpcy52aWV3cy5zZXQoZ3V0dGVySXRlbS5pZCwgdmlldyk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR2aWV3Lml0ZW0uc2V0KGd1dHRlckl0ZW0sIHR4KTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Y29uc3QgdG9wID1cblx0XHRcdFx0XHRcdFx0Z3V0dGVySXRlbS5yYW5nZS5zdGFydExpbmVOdW1iZXIgPD0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb3VudCgpXG5cdFx0XHRcdFx0XHRcdFx0PyB0aGlzLl9lZGl0b3IuZ2V0VG9wRm9yTGluZU51bWJlcihndXR0ZXJJdGVtLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgdHJ1ZSkgLSBzY3JvbGxUb3Bcblx0XHRcdFx0XHRcdFx0XHQ6IHRoaXMuX2VkaXRvci5nZXRCb3R0b21Gb3JMaW5lTnVtYmVyKGd1dHRlckl0ZW0ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyIC0gMSwgZmFsc2UpIC0gc2Nyb2xsVG9wO1xuXHRcdFx0XHRcdFx0Y29uc3QgYm90dG9tID1cblx0XHRcdFx0XHRcdFx0Z3V0dGVySXRlbS5yYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlID09PSAxID9cblx0XHRcdFx0XHRcdFx0XHRNYXRoLm1heCh0b3AsIHRoaXMuX2VkaXRvci5nZXRUb3BGb3JMaW5lTnVtYmVyKGd1dHRlckl0ZW0ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBmYWxzZSkgLSBzY3JvbGxUb3ApXG5cdFx0XHRcdFx0XHRcdFx0OiBNYXRoLm1heCh0b3AsIHRoaXMuX2VkaXRvci5nZXRCb3R0b21Gb3JMaW5lTnVtYmVyKGd1dHRlckl0ZW0ucmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSAtIDEsIHRydWUpIC0gc2Nyb2xsVG9wKTtcblxuXHRcdFx0XHRcdFx0Y29uc3QgaGVpZ2h0ID0gYm90dG9tIC0gdG9wO1xuXHRcdFx0XHRcdFx0dmlldy5kb21Ob2RlLnN0eWxlLnRvcCA9IGAke3RvcH1weGA7XG5cdFx0XHRcdFx0XHR2aWV3LmRvbU5vZGUuc3R5bGUuaGVpZ2h0ID0gYCR7aGVpZ2h0fXB4YDtcblxuXHRcdFx0XHRcdFx0dmlldy5ndXR0ZXJJdGVtVmlldy5sYXlvdXQoT2Zmc2V0UmFuZ2Uub2ZTdGFydEFuZExlbmd0aCh0b3AsIGhlaWdodCksIHZpZXdSYW5nZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGlkIG9mIHVudXNlZElkcykge1xuXHRcdFx0Y29uc3QgdmlldyA9IHRoaXMudmlld3MuZ2V0KGlkKSE7XG5cdFx0XHR2aWV3Lmd1dHRlckl0ZW1WaWV3LmRpc3Bvc2UoKTtcblx0XHRcdHZpZXcuZG9tTm9kZS5yZW1vdmUoKTtcblx0XHRcdHRoaXMudmlld3MuZGVsZXRlKGlkKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgTWFuYWdlZEd1dHRlckl0ZW1WaWV3IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGl0ZW06IElTZXR0YWJsZU9ic2VydmFibGU8SUd1dHRlckl0ZW1JbmZvPixcblx0XHRwdWJsaWMgcmVhZG9ubHkgZ3V0dGVySXRlbVZpZXc6IElHdXR0ZXJJdGVtVmlldyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgZG9tTm9kZTogSFRNTERpdkVsZW1lbnQsXG5cdCkgeyB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUd1dHRlckl0ZW1Qcm92aWRlcjxUSXRlbSBleHRlbmRzIElHdXR0ZXJJdGVtSW5mbz4ge1xuXHRnZXRJbnRlcnNlY3RpbmdHdXR0ZXJJdGVtcyhyYW5nZTogTGluZVJhbmdlLCByZWFkZXI6IElSZWFkZXIpOiBUSXRlbVtdO1xuXG5cdGNyZWF0ZVZpZXcoaXRlbTogSU9ic2VydmFibGU8VEl0ZW0+LCB0YXJnZXQ6IEhUTUxFbGVtZW50KTogSUd1dHRlckl0ZW1WaWV3O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElHdXR0ZXJJdGVtSW5mbyB7XG5cdGlkOiBzdHJpbmc7XG5cdHJhbmdlOiBMaW5lUmFuZ2U7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUd1dHRlckl0ZW1WaWV3IGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXHRsYXlvdXQoaXRlbVJhbmdlOiBPZmZzZXRSYW5nZSwgdmlld1JhbmdlOiBPZmZzZXRSYW5nZSk6IHZvaWQ7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLEdBQUcsYUFBYTtBQUN6QixTQUFTLFlBQXlCLG9CQUFvQjtBQUN0RCxTQUFTLFNBQW9ELHFCQUFxQixrQkFBa0IsMkJBQTJCLGlCQUFpQixtQkFBbUI7QUFFbkssU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxtQkFBbUI7QUFFckIsTUFBTSxxQkFBa0UsV0FBVztBQUFBLEVBZXpGLFlBQ2tCLFNBQ0EsVUFDQSxjQUNoQjtBQUNELFVBQU07QUFKVztBQUNBO0FBQ0E7QUFqQmxCLFNBQWlCLFlBQVk7QUFBQSxNQUFvQjtBQUFBLE1BQ2hELEtBQUssUUFBUTtBQUFBLE1BQ2IsQ0FBQztBQUFBO0FBQUEsUUFBbUQsS0FBSyxRQUFRLGFBQWE7QUFBQTtBQUFBLElBQy9FO0FBQ0EsU0FBaUIsa0JBQWtCLEtBQUssVUFB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
