import { equalsIfDefined, itemsEquals } from "../../base/common/equals.js";
import { Disposable, DisposableStore, toDisposable } from "../../base/common/lifecycle.js";
import { TransactionImpl, autorun, autorunOpts, derived, derivedOpts, derivedWithSetter, observableFromEvent, observableSignal, observableValue, observableValueOpts } from "../../base/common/observable.js";
import { EditorOption } from "../common/config/editorOptions.js";
import { OffsetRange } from "../common/core/offsetRange.js";
import { Position } from "../common/core/position.js";
import { Selection } from "../common/core/selection.js";
import { ContentWidgetPositionPreference } from "./editorBrowser.js";
import { Point } from "./point.js";
function observableCodeEditor(editor) {
  return ObservableCodeEditor.get(editor);
}
const _ObservableCodeEditor = class _ObservableCodeEditor extends Disposable {
  constructor(editor) {
    super();
    this.editor = editor;
    this._updateCounter = 0;
    this._currentTransaction = void 0;
    this._model = observableValue(this, this.editor.getModel());
    this.model = this._model;
    this.isReadonly = observableFromEvent(this, this.editor.onDidChangeConfiguration, () => this.editor.getOption(EditorOption.readOnly));
    this._versionId = observableValueOpts({ owner: this, lazy: true }, this.editor.getModel()?.getVersionId() ?? null);
    this.versionId = this._versionId;
    this._selections = observableValueOpts(
      { owner: this, equalsFn: equalsIfDefined(itemsEquals(Selection.selectionsEqual)), lazy: true },
      this.editor.getSelections() ?? null
    );
    this.selections = this._selections;
    this.positions = derivedOpts(
      { owner: this, equalsFn: equalsIfDefined(itemsEquals(Position.equals)) },
      (reader) => this.selections.read(reader)?.map((s) => s.getStartPosition()) ?? null
    );
    this.isFocused = observableFromEvent(this, (e) => {
      const d1 = this.editor.onDidFocusEditorWidget(e);
      const d2 = this.editor.onDidBlurEditorWidget(e);
      return {
        dispose() {
          d1.dispose();
          d2.dispose();
        }
      };
    }, () => this.editor.hasWidgetFocus());
    this.isTextFocused = observableFromEvent(this, (e) => {
      const d1 = this.editor.onDidFocusEditorText(e);
      const d2 = this.editor.onDidBlurEditorText(e);
      return {
        dispose() {
          d1.dispose();
          d2.dispose();
        }
      };
    }, () => this.editor.hasTextFocus());
    this.inComposition = observableFromEvent(this, (e) => {
      const d1 = this.editor.onDidCompositionStart(() => {
        e(void 0);
      });
      const d2 = this.editor.onDidCompositionEnd(() => {
        e(void 0);
      });
      return {
        dispose() {
          d1.dispose();
          d2.dispose();
        }
      };
    }, () => this.editor.inComposition);
    this.value = derivedWithSetter(
      this,
      (reader) => {
        this.versionId.read(reader);
        return this.model.read(reader)?.getValue() ?? "";
      },
      (value, tx) => {
        const model = this.model.get();
        if (model !== null) {
          if (value !== model.getValue()) {
            model.setValue(value);
          }
        }
      }
    );
    this.valueIsEmpty = derived(this, (reader) => {
      this.versionId.read(reader);
      return this.editor.getModel()?.getValueLength() === 0;
    });
    this.cursorSelection = derivedOpts({ owner: this, equalsFn: equalsIfDefined(Selection.selectionsEqual) }, (reader) => this.selections.read(reader)?.[0] ?? null);
    this.cursorPosition = derivedOpts({ owner: this, equalsFn: Position.equals }, (reader) => this.selections.read(reader)?.[0]?.getPosition() ?? null);
    this.cursorLineNumber = derived(this, (reader) => this.cursorPosition.read(reader)?.lineNumber ?? null);
    this.onDidType = observableSignal(this);
    this.onDidPaste = observableSignal(this);
    this.scrollTop = observableFromEvent(this.editor.onDidScrollChange, () => this.editor.getScrollTop());
    this.scrollLeft = observableFromEvent(this.editor.onDidScrollChange, () => this.editor.getScrollLeft());
    this.layoutInfo = observableFromEvent(this.editor.onDidLayoutChange, () => this.editor.getLayoutInfo());
    this.layoutInfoContentLeft = this.layoutInfo.map((l) => l.contentLeft);
    this.layoutInfoDecorationsLeft = this.layoutInfo.map((l) => l.decorationsLeft);
    this.layoutInfoWidth = this.layoutInfo.map((l) => l.width);
    this.layoutInfoMinimap = this.layoutInfo.map((l) => l.minimap);
    this.layoutInfoVerticalScrollbarWidth = this.layoutInfo.map((l) => l.verticalScrollbarWidth);
    this.contentWidth = observableFromEvent(this.editor.onDidContentSizeChange, () => this.editor.getContentWidth());
    this._widgetCounter = 0;
    this.openedPeekWidgets = observableValue(this, 0);
    this._register(this.editor.onBeginUpdate(() => this._beginUpdate()));
    this._register(this.editor.onEndUpdate(() => this._endUpdate()));
    this._register(this.editor.onDidChangeModel(() => {
      this._beginUpdate();
      try {
        this._model.set(this.editor.getModel(), this._currentTransaction);
        this._forceUpdate();
      } finally {
        this._endUpdate();
      }
    }));
    this._register(this.editor.onDidType((e) => {
      this._beginUpdate();
      try {
        this._forceUpdate();
        this.onDidType.trigger(this._currentTransaction, e);
      } finally {
        this._endUpdate();
      }
    }));
    this._register(this.editor.onDidPaste((e) => {
      this._beginUpdate();
      try {
        this._forceUpdate();
        this.onDidPaste.trigger(this._currentTransaction, e);
      } finally {
        this._endUpdate();
      }
    }));
    this._register(this.editor.onDidChangeModelContent((e) => {
      this._beginUpdate();
      try {
        this._versionId.set(this.editor.getModel()?.getVersionId() ?? null, this._currentTransaction, e);
        this._forceUpdate();
      } finally {
        this._endUpdate();
      }
    }));
    this._register(this.editor.onDidChangeCursorSelection((e) => {
      this._beginUpdate();
      try {
        this._selections.set(this.editor.getSelections(), this._currentTransaction, e);
        this._forceUpdate();
      } finally {
        this._endUpdate();
      }
    }));
  }
  /**
   * Make sure that editor is not disposed yet!
  */
  static get(editor) {
    let result = _ObservableCodeEditor._map.get(editor);
    if (!result) {
      result = new _ObservableCodeEditor(editor);
      _ObservableCodeEditor._map.set(editor, result);
      const d = editor.onDidDispose(() => {
        const item = _ObservableCodeEditor._map.get(editor);
        if (item) {
          _ObservableCodeEditor._map.delete(editor);
          item.dispose();
          d.dispose();
        }
      });
    }
    return result;
  }
  _beginUpdate() {
    this._updateCounter++;
    if (this._updateCounter === 1) {
      this._currentTransaction = new TransactionImpl(() => {
      });
    }
  }
  _endUpdate() {
    this._updateCounter--;
    if (this._updateCounter === 0) {
      const t = this._currentTransaction;
      this._currentTransaction = void 0;
      t.finish();
    }
  }
  forceUpdate(cb) {
    this._beginUpdate();
    try {
      this._forceUpdate();
      if (!cb) {
        return void 0;
      }
      return cb(this._currentTransaction);
    } finally {
      this._endUpdate();
    }
  }
  _forceUpdate() {
    this._beginUpdate();
    try {
      this._model.set(this.editor.getModel(), this._currentTransaction);
      this._versionId.set(this.editor.getModel()?.getVersionId() ?? null, this._currentTransaction, void 0);
      this._selections.set(this.editor.getSelections(), this._currentTransaction, void 0);
    } finally {
      this._endUpdate();
    }
  }
  getOption(id) {
    return observableFromEvent(this, (cb) => this.editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(id)) {
        cb(void 0);
      }
    }), () => this.editor.getOption(id));
  }
  setDecorations(decorations) {
    const d = new DisposableStore();
    const decorationsCollection = this.editor.createDecorationsCollection();
    d.add(autorunOpts({ owner: this, debugName: () => `Apply decorations from ${decorations.debugName}` }, (reader) => {
      const d2 = decorations.read(reader);
      decorationsCollection.set(d2);
    }));
    d.add({
      dispose: () => {
        decorationsCollection.clear();
      }
    });
    return d;
  }
  createOverlayWidget(widget) {
    const overlayWidgetId = "observableOverlayWidget" + this._widgetCounter++;
    const w = {
      getDomNode: () => widget.domNode,
      getPosition: () => widget.position.get(),
      getId: () => overlayWidgetId,
      allowEditorOverflow: widget.allowEditorOverflow,
      getMinContentWidthInPx: () => widget.minContentWidthInPx.get()
    };
    this.editor.addOverlayWidget(w);
    const d = autorun((reader) => {
      widget.position.read(reader);
      widget.minContentWidthInPx.read(reader);
      this.editor.layoutOverlayWidget(w);
    });
    return toDisposable(() => {
      d.dispose();
      this.editor.removeOverlayWidget(w);
    });
  }
  createContentWidget(widget) {
    const contentWidgetId = "observableContentWidget" + this._widgetCounter++;
    const w = {
      getDomNode: () => widget.domNode,
      getPosition: () => widget.position.get(),
      getId: () => contentWidgetId,
      allowEditorOverflow: widget.allowEditorOverflow
    };
    this.editor.addContentWidget(w);
    const d = autorun((reader) => {
      widget.position.read(reader);
      this.editor.layoutContentWidget(w);
    });
    return toDisposable(() => {
      d.dispose();
      this.editor.removeContentWidget(w);
    });
  }
  observeLineOffsetRange(lineRange, store) {
    const start = this.observePosition(lineRange.map((r) => new Position(r.startLineNumber, 1)), store);
    const end = this.observePosition(lineRange.map((r) => new Position(r.endLineNumberExclusive + 1, 1)), store);
    return derived((reader) => {
      start.read(reader);
      end.read(reader);
      const range = lineRange.read(reader);
      const lineCount = this.model.read(reader)?.getLineCount();
      const s = (typeof lineCount !== "undefined" && range.startLineNumber > lineCount ? this.editor.getBottomForLineNumber(lineCount) : this.editor.getTopForLineNumber(range.startLineNumber)) - this.scrollTop.read(reader);
      const e = range.isEmpty ? s : this.editor.getBottomForLineNumber(range.endLineNumberExclusive - 1) - this.scrollTop.read(reader);
      return new OffsetRange(s, e);
    });
  }
  observePosition(position, store) {
    let pos = position.get();
    const result = observableValueOpts({ owner: this, debugName: () => `topLeftOfPosition${pos?.toString()}`, equalsFn: equalsIfDefined(Point.equals) }, new Point(0, 0));
    const contentWidgetId = `observablePositionWidget` + this._widgetCounter++;
    const domNode = document.createElement("div");
    const w = {
      getDomNode: () => domNode,
      getPosition: () => {
        return pos ? { preference: [ContentWidgetPositionPreference.EXACT], position: position.get() } : null;
      },
      getId: () => contentWidgetId,
      allowEditorOverflow: false,
      afterRender: (position2, coordinate) => {
        const model = this._model.get();
        if (model && pos && pos.lineNumber > model.getLineCount()) {
          result.set(new Point(0, this.editor.getBottomForLineNumber(model.getLineCount()) - this.scrollTop.get()), void 0);
        } else {
          result.set(coordinate ? new Point(coordinate.left, coordinate.top) : null, void 0);
        }
      }
    };
    this.editor.addContentWidget(w);
    store.add(autorun((reader) => {
      pos = position.read(reader);
      this.editor.layoutContentWidget(w);
    }));
    store.add(toDisposable(() => {
      this.editor.removeContentWidget(w);
    }));
    return result;
  }
  isTargetHovered(predicate, store) {
    const isHovered = observableValue("isInjectedTextHovered", false);
    store.add(this.editor.onMouseMove((e) => {
      const val = predicate(e);
      isHovered.set(val, void 0);
    }));
    store.add(this.editor.onMouseLeave((E) => {
      isHovered.set(false, void 0);
    }));
    return isHovered;
  }
};
_ObservableCodeEditor._map = /* @__PURE__ */ new Map();
let ObservableCodeEditor = _ObservableCodeEditor;
export {
  ObservableCodeEditor,
  observableCodeEditor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9vYnNlcnZhYmxlQ29kZUVkaXRvci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGVxdWFsc0lmRGVmaW5lZCwgaXRlbXNFcXVhbHMgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9lcXVhbHMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElPYnNlcnZhYmxlLCBJT2JzZXJ2YWJsZVdpdGhDaGFuZ2UsIElUcmFuc2FjdGlvbiwgVHJhbnNhY3Rpb25JbXBsLCBhdXRvcnVuLCBhdXRvcnVuT3B0cywgZGVyaXZlZCwgZGVyaXZlZE9wdHMsIGRlcml2ZWRXaXRoU2V0dGVyLCBvYnNlcnZhYmxlRnJvbUV2ZW50LCBvYnNlcnZhYmxlU2lnbmFsLCBvYnNlcnZhYmxlVmFsdWUsIG9ic2VydmFibGVWYWx1ZU9wdHMgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiwgRmluZENvbXB1dGVkRWRpdG9yT3B0aW9uVmFsdWVCeUlkIH0gZnJvbSAnLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IExpbmVSYW5nZSB9IGZyb20gJy4uL2NvbW1vbi9jb3JlL2xpbmVSYW5nZS5qcyc7XG5pbXBvcnQgeyBPZmZzZXRSYW5nZSB9IGZyb20gJy4uL2NvbW1vbi9jb3JlL29mZnNldFJhbmdlLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IElDdXJzb3JTZWxlY3Rpb25DaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi9jb21tb24vY3Vyc29yRXZlbnRzLmpzJztcbmltcG9ydCB7IElNb2RlbERlbHRhRGVjb3JhdGlvbiwgSVRleHRNb2RlbCB9IGZyb20gJy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vY29tbW9uL3RleHRNb2RlbEV2ZW50cy5qcyc7XG5pbXBvcnQgeyBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLCBJQ29kZUVkaXRvciwgSUNvbnRlbnRXaWRnZXQsIElDb250ZW50V2lkZ2V0UG9zaXRpb24sIElFZGl0b3JNb3VzZUV2ZW50LCBJT3ZlcmxheVdpZGdldCwgSU92ZXJsYXlXaWRnZXRQb3NpdGlvbiwgSVBhc3RlRXZlbnQgfSBmcm9tICcuL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgUG9pbnQgfSBmcm9tICcuL3BvaW50LmpzJztcblxuLyoqXG4gKiBSZXR1cm5zIGEgZmFjYWRlIGZvciB0aGUgY29kZSBlZGl0b3IgdGhhdCBwcm92aWRlcyBvYnNlcnZhYmxlcyBmb3IgdmFyaW91cyBzdGF0ZXMvZXZlbnRzLlxuKi9cbmV4cG9ydCBmdW5jdGlvbiBvYnNlcnZhYmxlQ29kZUVkaXRvcihlZGl0b3I6IElDb2RlRWRpdG9yKTogT2JzZXJ2YWJsZUNvZGVFZGl0b3Ige1xuXHRyZXR1cm4gT2JzZXJ2YWJsZUNvZGVFZGl0b3IuZ2V0KGVkaXRvcik7XG59XG5cbmV4cG9ydCBjbGFzcyBPYnNlcnZhYmxlQ29kZUVkaXRvciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBfbWFwID0gbmV3IE1hcDxJQ29kZUVkaXRvciwgT2JzZXJ2YWJsZUNvZGVFZGl0b3I+KCk7XG5cblx0LyoqXG5cdCAqIE1ha2Ugc3VyZSB0aGF0IGVkaXRvciBpcyBub3QgZGlzcG9zZWQgeWV0IVxuXHQqL1xuXHRwdWJsaWMgc3RhdGljIGdldChlZGl0b3I6IElDb2RlRWRpdG9yKTogT2JzZXJ2YWJsZUNvZGVFZGl0b3Ige1xuXHRcdGxldCByZXN1bHQgPSBPYnNlcnZhYmxlQ29kZUVkaXRvci5fbWFwLmdldChlZGl0b3IpO1xuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRyZXN1bHQgPSBuZXcgT2JzZXJ2YWJsZUNvZGVFZGl0b3IoZWRpdG9yKTtcblx0XHRcdE9ic2VydmFibGVDb2RlRWRpdG9yLl9tYXAuc2V0KGVkaXRvciwgcmVzdWx0KTtcblx0XHRcdGNvbnN0IGQgPSBlZGl0b3Iub25EaWREaXNwb3NlKCgpID0+IHtcblx0XHRcdFx0Y29uc3QgaXRlbSA9IE9ic2VydmFibGVDb2RlRWRpdG9yLl9tYXAuZ2V0KGVkaXRvcik7XG5cdFx0XHRcdGlmIChpdGVtKSB7XG5cdFx0XHRcdFx0T2JzZXJ2YWJsZUNvZGVFZGl0b3IuX21hcC5kZWxldGUoZWRpdG9yKTtcblx0XHRcdFx0XHRpdGVtLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRkLmRpc3Bvc2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVDb3VudGVyID0gMDtcblx0cHJpdmF0ZSBfY3VycmVudFRyYW5zYWN0aW9uOiBUcmFuc2FjdGlvbkltcGwgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfYmVnaW5VcGRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5fdXBkYXRlQ291bnRlcisrO1xuXHRcdGlmICh0aGlzLl91cGRhdGVDb3VudGVyID09PSAxKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50VHJhbnNhY3Rpb24gPSBuZXcgVHJhbnNhY3Rpb25JbXBsKCgpID0+IHtcblx0XHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBVcGRhdGUgZWRpdG9yIHN0YXRlICovXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9lbmRVcGRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5fdXBkYXRlQ291bnRlci0tO1xuXHRcdGlmICh0aGlzLl91cGRhdGVDb3VudGVyID09PSAwKSB7XG5cdFx0XHRjb25zdCB0ID0gdGhpcy5fY3VycmVudFRyYW5zYWN0aW9uITtcblx0XHRcdHRoaXMuX2N1cnJlbnRUcmFuc2FjdGlvbiA9IHVuZGVmaW5lZDtcblx0XHRcdHQuZmluaXNoKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgZWRpdG9yOiBJQ29kZUVkaXRvcikge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvci5vbkJlZ2luVXBkYXRlKCgpID0+IHRoaXMuX2JlZ2luVXBkYXRlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvci5vbkVuZFVwZGF0ZSgoKSA9PiB0aGlzLl9lbmRVcGRhdGUoKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbCgoKSA9PiB7XG5cdFx0XHR0aGlzLl9iZWdpblVwZGF0ZSgpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5fbW9kZWwuc2V0KHRoaXMuZWRpdG9yLmdldE1vZGVsKCksIHRoaXMuX2N1cnJlbnRUcmFuc2FjdGlvbik7XG5cdFx0XHRcdHRoaXMuX2ZvcmNlVXBkYXRlKCk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLl9lbmRVcGRhdGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvci5vbkRpZFR5cGUoKGUpID0+IHtcblx0XHRcdHRoaXMuX2JlZ2luVXBkYXRlKCk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLl9mb3JjZVVwZGF0ZSgpO1xuXHRcdFx0XHR0aGlzLm9uRGlkVHlwZS50cmlnZ2VyKHRoaXMuX2N1cnJlbnRUcmFuc2FjdGlvbiwgZSk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLl9lbmRVcGRhdGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvci5vbkRpZFBhc3RlKChlKSA9PiB7XG5cdFx0XHR0aGlzLl9iZWdpblVwZGF0ZSgpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5fZm9yY2VVcGRhdGUoKTtcblx0XHRcdFx0dGhpcy5vbkRpZFBhc3RlLnRyaWdnZXIodGhpcy5fY3VycmVudFRyYW5zYWN0aW9uLCBlKTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdHRoaXMuX2VuZFVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KGUgPT4ge1xuXHRcdFx0dGhpcy5fYmVnaW5VcGRhdGUoKTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRoaXMuX3ZlcnNpb25JZC5zZXQodGhpcy5lZGl0b3IuZ2V0TW9kZWwoKT8uZ2V0VmVyc2lvbklkKCkgPz8gbnVsbCwgdGhpcy5fY3VycmVudFRyYW5zYWN0aW9uLCBlKTtcblx0XHRcdFx0dGhpcy5fZm9yY2VVcGRhdGUoKTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdHRoaXMuX2VuZFVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yU2VsZWN0aW9uKGUgPT4ge1xuXHRcdFx0dGhpcy5fYmVnaW5VcGRhdGUoKTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRoaXMuX3NlbGVjdGlvbnMuc2V0KHRoaXMuZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgdGhpcy5fY3VycmVudFRyYW5zYWN0aW9uLCBlKTtcblx0XHRcdFx0dGhpcy5fZm9yY2VVcGRhdGUoKTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdHRoaXMuX2VuZFVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyBmb3JjZVVwZGF0ZSgpOiB2b2lkO1xuXHRwdWJsaWMgZm9yY2VVcGRhdGU8VD4oY2I6ICh0eDogSVRyYW5zYWN0aW9uKSA9PiBUKTogVDtcblx0cHVibGljIGZvcmNlVXBkYXRlPFQ+KGNiPzogKHR4OiBJVHJhbnNhY3Rpb24pID0+IFQpOiBUIHtcblx0XHR0aGlzLl9iZWdpblVwZGF0ZSgpO1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9mb3JjZVVwZGF0ZSgpO1xuXHRcdFx0aWYgKCFjYikgeyByZXR1cm4gdW5kZWZpbmVkIGFzIFQ7IH1cblx0XHRcdHJldHVybiBjYih0aGlzLl9jdXJyZW50VHJhbnNhY3Rpb24hKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5fZW5kVXBkYXRlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZm9yY2VVcGRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5fYmVnaW5VcGRhdGUoKTtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fbW9kZWwuc2V0KHRoaXMuZWRpdG9yLmdldE1vZGVsKCksIHRoaXMuX2N1cnJlbnRUcmFuc2FjdGlvbik7XG5cdFx0XHR0aGlzLl92ZXJzaW9uSWQuc2V0KHRoaXMuZWRpdG9yLmdldE1vZGVsKCk/LmdldFZlcnNpb25JZCgpID8/IG51bGwsIHRoaXMuX2N1cnJlbnRUcmFuc2FjdGlvbiwgdW5kZWZpbmVkKTtcblx0XHRcdHRoaXMuX3NlbGVjdGlvbnMuc2V0KHRoaXMuZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgdGhpcy5fY3VycmVudFRyYW5zYWN0aW9uLCB1bmRlZmluZWQpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9lbmRVcGRhdGUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbCA9IG9ic2VydmFibGVWYWx1ZSh0aGlzLCB0aGlzLmVkaXRvci5nZXRNb2RlbCgpKTtcblx0cHVibGljIHJlYWRvbmx5IG1vZGVsOiBJT2JzZXJ2YWJsZTxJVGV4dE1vZGVsIHwgbnVsbD4gPSB0aGlzLl9tb2RlbDtcblxuXHRwdWJsaWMgcmVhZG9ubHkgaXNSZWFkb25seSA9IG9ic2VydmFibGVGcm9tRXZlbnQodGhpcywgdGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLCAoKSA9PiB0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnJlYWRPbmx5KSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdmVyc2lvbklkID0gb2JzZXJ2YWJsZVZhbHVlT3B0czxudW1iZXIgfCBudWxsLCBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50IHwgdW5kZWZpbmVkPih7IG93bmVyOiB0aGlzLCBsYXp5OiB0cnVlIH0sIHRoaXMuZWRpdG9yLmdldE1vZGVsKCk/LmdldFZlcnNpb25JZCgpID8/IG51bGwpO1xuXHRwdWJsaWMgcmVhZG9ubHkgdmVyc2lvbklkOiBJT2JzZXJ2YWJsZVdpdGhDaGFuZ2U8bnVtYmVyIHwgbnVsbCwgSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCB8IHVuZGVmaW5lZD4gPSB0aGlzLl92ZXJzaW9uSWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc2VsZWN0aW9ucyA9IG9ic2VydmFibGVWYWx1ZU9wdHM8U2VsZWN0aW9uW10gfCBudWxsLCBJQ3Vyc29yU2VsZWN0aW9uQ2hhbmdlZEV2ZW50IHwgdW5kZWZpbmVkPihcblx0XHR7IG93bmVyOiB0aGlzLCBlcXVhbHNGbjogZXF1YWxzSWZEZWZpbmVkKGl0ZW1zRXF1YWxzKFNlbGVjdGlvbi5zZWxlY3Rpb25zRXF1YWwpKSwgbGF6eTogdHJ1ZSB9LFxuXHRcdHRoaXMuZWRpdG9yLmdldFNlbGVjdGlvbnMoKSA/PyBudWxsXG5cdCk7XG5cdHB1YmxpYyByZWFkb25seSBzZWxlY3Rpb25zOiBJT2JzZXJ2YWJsZVdpdGhDaGFuZ2U8U2VsZWN0aW9uW10gfCBudWxsLCBJQ3Vyc29yU2VsZWN0aW9uQ2hhbmdlZEV2ZW50IHwgdW5kZWZpbmVkPiA9IHRoaXMuX3NlbGVjdGlvbnM7XG5cblxuXHRwdWJsaWMgcmVhZG9ubHkgcG9zaXRpb25zID0gZGVyaXZlZE9wdHM8cmVhZG9ubHkgUG9zaXRpb25bXSB8IG51bGw+KFxuXHRcdHsgb3duZXI6IHRoaXMsIGVxdWFsc0ZuOiBlcXVhbHNJZkRlZmluZWQoaXRlbXNFcXVhbHMoUG9zaXRpb24uZXF1YWxzKSkgfSxcblx0XHRyZWFkZXIgPT4gdGhpcy5zZWxlY3Rpb25zLnJlYWQocmVhZGVyKT8ubWFwKHMgPT4gcy5nZXRTdGFydFBvc2l0aW9uKCkpID8/IG51bGxcblx0KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgaXNGb2N1c2VkID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLCBlID0+IHtcblx0XHRjb25zdCBkMSA9IHRoaXMuZWRpdG9yLm9uRGlkRm9jdXNFZGl0b3JXaWRnZXQoZSk7XG5cdFx0Y29uc3QgZDIgPSB0aGlzLmVkaXRvci5vbkRpZEJsdXJFZGl0b3JXaWRnZXQoZSk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRpc3Bvc2UoKSB7XG5cdFx0XHRcdGQxLmRpc3Bvc2UoKTtcblx0XHRcdFx0ZDIuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0sICgpID0+IHRoaXMuZWRpdG9yLmhhc1dpZGdldEZvY3VzKCkpO1xuXG5cdHB1YmxpYyByZWFkb25seSBpc1RleHRGb2N1c2VkID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLCBlID0+IHtcblx0XHRjb25zdCBkMSA9IHRoaXMuZWRpdG9yLm9uRGlkRm9jdXNFZGl0b3JUZXh0KGUpO1xuXHRcdGNvbnN0IGQyID0gdGhpcy5lZGl0b3Iub25EaWRCbHVyRWRpdG9yVGV4dChlKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGlzcG9zZSgpIHtcblx0XHRcdFx0ZDEuZGlzcG9zZSgpO1xuXHRcdFx0XHRkMi5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSwgKCkgPT4gdGhpcy5lZGl0b3IuaGFzVGV4dEZvY3VzKCkpO1xuXG5cdHB1YmxpYyByZWFkb25seSBpbkNvbXBvc2l0aW9uID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLCBlID0+IHtcblx0XHRjb25zdCBkMSA9IHRoaXMuZWRpdG9yLm9uRGlkQ29tcG9zaXRpb25TdGFydCgoKSA9PiB7XG5cdFx0XHRlKHVuZGVmaW5lZCk7XG5cdFx0fSk7XG5cdFx0Y29uc3QgZDIgPSB0aGlzLmVkaXRvci5vbkRpZENvbXBvc2l0aW9uRW5kKCgpID0+IHtcblx0XHRcdGUodW5kZWZpbmVkKTtcblx0XHR9KTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGlzcG9zZSgpIHtcblx0XHRcdFx0ZDEuZGlzcG9zZSgpO1xuXHRcdFx0XHRkMi5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSwgKCkgPT4gdGhpcy5lZGl0b3IuaW5Db21wb3NpdGlvbik7XG5cblx0cHVibGljIHJlYWRvbmx5IHZhbHVlID0gZGVyaXZlZFdpdGhTZXR0ZXIodGhpcyxcblx0XHRyZWFkZXIgPT4geyB0aGlzLnZlcnNpb25JZC5yZWFkKHJlYWRlcik7IHJldHVybiB0aGlzLm1vZGVsLnJlYWQocmVhZGVyKT8uZ2V0VmFsdWUoKSA/PyAnJzsgfSxcblx0XHQodmFsdWUsIHR4KSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMubW9kZWwuZ2V0KCk7XG5cdFx0XHRpZiAobW9kZWwgIT09IG51bGwpIHtcblx0XHRcdFx0aWYgKHZhbHVlICE9PSBtb2RlbC5nZXRWYWx1ZSgpKSB7XG5cdFx0XHRcdFx0bW9kZWwuc2V0VmFsdWUodmFsdWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHQpO1xuXHRwdWJsaWMgcmVhZG9ubHkgdmFsdWVJc0VtcHR5ID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4geyB0aGlzLnZlcnNpb25JZC5yZWFkKHJlYWRlcik7IHJldHVybiB0aGlzLmVkaXRvci5nZXRNb2RlbCgpPy5nZXRWYWx1ZUxlbmd0aCgpID09PSAwOyB9KTtcblx0cHVibGljIHJlYWRvbmx5IGN1cnNvclNlbGVjdGlvbiA9IGRlcml2ZWRPcHRzKHsgb3duZXI6IHRoaXMsIGVxdWFsc0ZuOiBlcXVhbHNJZkRlZmluZWQoU2VsZWN0aW9uLnNlbGVjdGlvbnNFcXVhbCkgfSwgcmVhZGVyID0+IHRoaXMuc2VsZWN0aW9ucy5yZWFkKHJlYWRlcik/LlswXSA/PyBudWxsKTtcblx0cHVibGljIHJlYWRvbmx5IGN1cnNvclBvc2l0aW9uID0gZGVyaXZlZE9wdHMoeyBvd25lcjogdGhpcywgZXF1YWxzRm46IFBvc2l0aW9uLmVxdWFscyB9LCByZWFkZXIgPT4gdGhpcy5zZWxlY3Rpb25zLnJlYWQocmVhZGVyKT8uWzBdPy5nZXRQb3NpdGlvbigpID8/IG51bGwpO1xuXHRwdWJsaWMgcmVhZG9ubHkgY3Vyc29yTGluZU51bWJlciA9IGRlcml2ZWQ8bnVtYmVyIHwgbnVsbD4odGhpcywgcmVhZGVyID0+IHRoaXMuY3Vyc29yUG9zaXRpb24ucmVhZChyZWFkZXIpPy5saW5lTnVtYmVyID8/IG51bGwpO1xuXG5cdHB1YmxpYyByZWFkb25seSBvbkRpZFR5cGUgPSBvYnNlcnZhYmxlU2lnbmFsPHN0cmluZz4odGhpcyk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZFBhc3RlID0gb2JzZXJ2YWJsZVNpZ25hbDxJUGFzdGVFdmVudD4odGhpcyk7XG5cblx0cHVibGljIHJlYWRvbmx5IHNjcm9sbFRvcCA9IG9ic2VydmFibGVGcm9tRXZlbnQodGhpcy5lZGl0b3Iub25EaWRTY3JvbGxDaGFuZ2UsICgpID0+IHRoaXMuZWRpdG9yLmdldFNjcm9sbFRvcCgpKTtcblx0cHVibGljIHJlYWRvbmx5IHNjcm9sbExlZnQgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMuZWRpdG9yLm9uRGlkU2Nyb2xsQ2hhbmdlLCAoKSA9PiB0aGlzLmVkaXRvci5nZXRTY3JvbGxMZWZ0KCkpO1xuXG5cdHB1YmxpYyByZWFkb25seSBsYXlvdXRJbmZvID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLmVkaXRvci5vbkRpZExheW91dENoYW5nZSwgKCkgPT4gdGhpcy5lZGl0b3IuZ2V0TGF5b3V0SW5mbygpKTtcblx0cHVibGljIHJlYWRvbmx5IGxheW91dEluZm9Db250ZW50TGVmdCA9IHRoaXMubGF5b3V0SW5mby5tYXAobCA9PiBsLmNvbnRlbnRMZWZ0KTtcblx0cHVibGljIHJlYWRvbmx5IGxheW91dEluZm9EZWNvcmF0aW9uc0xlZnQgPSB0aGlzLmxheW91dEluZm8ubWFwKGwgPT4gbC5kZWNvcmF0aW9uc0xlZnQpO1xuXHRwdWJsaWMgcmVhZG9ubHkgbGF5b3V0SW5mb1dpZHRoID0gdGhpcy5sYXlvdXRJbmZvLm1hcChsID0+IGwud2lkdGgpO1xuXHRwdWJsaWMgcmVhZG9ubHkgbGF5b3V0SW5mb01pbmltYXAgPSB0aGlzLmxheW91dEluZm8ubWFwKGwgPT4gbC5taW5pbWFwKTtcblx0cHVibGljIHJlYWRvbmx5IGxheW91dEluZm9WZXJ0aWNhbFNjcm9sbGJhcldpZHRoID0gdGhpcy5sYXlvdXRJbmZvLm1hcChsID0+IGwudmVydGljYWxTY3JvbGxiYXJXaWR0aCk7XG5cblx0cHVibGljIHJlYWRvbmx5IGNvbnRlbnRXaWR0aCA9IG9ic2VydmFibGVGcm9tRXZlbnQodGhpcy5lZGl0b3Iub25EaWRDb250ZW50U2l6ZUNoYW5nZSwgKCkgPT4gdGhpcy5lZGl0b3IuZ2V0Q29udGVudFdpZHRoKCkpO1xuXG5cdHB1YmxpYyBnZXRPcHRpb248VCBleHRlbmRzIEVkaXRvck9wdGlvbj4oaWQ6IFQpOiBJT2JzZXJ2YWJsZTxGaW5kQ29tcHV0ZWRFZGl0b3JPcHRpb25WYWx1ZUJ5SWQ8VD4+IHtcblx0XHRyZXR1cm4gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLCBjYiA9PiB0aGlzLmVkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5oYXNDaGFuZ2VkKGlkKSkgeyBjYih1bmRlZmluZWQpOyB9XG5cdFx0fSksICgpID0+IHRoaXMuZWRpdG9yLmdldE9wdGlvbihpZCkpO1xuXHR9XG5cblx0cHVibGljIHNldERlY29yYXRpb25zKGRlY29yYXRpb25zOiBJT2JzZXJ2YWJsZTxJTW9kZWxEZWx0YURlY29yYXRpb25bXT4pOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgZCA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBkZWNvcmF0aW9uc0NvbGxlY3Rpb24gPSB0aGlzLmVkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oKTtcblx0XHRkLmFkZChhdXRvcnVuT3B0cyh7IG93bmVyOiB0aGlzLCBkZWJ1Z05hbWU6ICgpID0+IGBBcHBseSBkZWNvcmF0aW9ucyBmcm9tICR7ZGVjb3JhdGlvbnMuZGVidWdOYW1lfWAgfSwgcmVhZGVyID0+IHtcblx0XHRcdGNvbnN0IGQgPSBkZWNvcmF0aW9ucy5yZWFkKHJlYWRlcik7XG5cdFx0XHRkZWNvcmF0aW9uc0NvbGxlY3Rpb24uc2V0KGQpO1xuXHRcdH0pKTtcblx0XHRkLmFkZCh7XG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdGRlY29yYXRpb25zQ29sbGVjdGlvbi5jbGVhcigpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiBkO1xuXHR9XG5cblx0cHJpdmF0ZSBfd2lkZ2V0Q291bnRlciA9IDA7XG5cblx0cHVibGljIGNyZWF0ZU92ZXJsYXlXaWRnZXQod2lkZ2V0OiBJT2JzZXJ2YWJsZU92ZXJsYXlXaWRnZXQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3Qgb3ZlcmxheVdpZGdldElkID0gJ29ic2VydmFibGVPdmVybGF5V2lkZ2V0JyArICh0aGlzLl93aWRnZXRDb3VudGVyKyspO1xuXHRcdGNvbnN0IHc6IElPdmVybGF5V2lkZ2V0ID0ge1xuXHRcdFx0Z2V0RG9tTm9kZTogKCkgPT4gd2lkZ2V0LmRvbU5vZGUsXG5cdFx0XHRnZXRQb3NpdGlvbjogKCkgPT4gd2lkZ2V0LnBvc2l0aW9uLmdldCgpLFxuXHRcdFx0Z2V0SWQ6ICgpID0+IG92ZXJsYXlXaWRnZXRJZCxcblx0XHRcdGFsbG93RWRpdG9yT3ZlcmZsb3c6IHdpZGdldC5hbGxvd0VkaXRvck92ZXJmbG93LFxuXHRcdFx0Z2V0TWluQ29udGVudFdpZHRoSW5QeDogKCkgPT4gd2lkZ2V0Lm1pbkNvbnRlbnRXaWR0aEluUHguZ2V0KCksXG5cdFx0fTtcblx0XHR0aGlzLmVkaXRvci5hZGRPdmVybGF5V2lkZ2V0KHcpO1xuXHRcdGNvbnN0IGQgPSBhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHR3aWRnZXQucG9zaXRpb24ucmVhZChyZWFkZXIpO1xuXHRcdFx0d2lkZ2V0Lm1pbkNvbnRlbnRXaWR0aEluUHgucmVhZChyZWFkZXIpO1xuXHRcdFx0dGhpcy5lZGl0b3IubGF5b3V0T3ZlcmxheVdpZGdldCh3KTtcblx0XHR9KTtcblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGQuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5lZGl0b3IucmVtb3ZlT3ZlcmxheVdpZGdldCh3KTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBjcmVhdGVDb250ZW50V2lkZ2V0KHdpZGdldDogSU9ic2VydmFibGVDb250ZW50V2lkZ2V0KTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGNvbnRlbnRXaWRnZXRJZCA9ICdvYnNlcnZhYmxlQ29udGVudFdpZGdldCcgKyAodGhpcy5fd2lkZ2V0Q291bnRlcisrKTtcblx0XHRjb25zdCB3OiBJQ29udGVudFdpZGdldCA9IHtcblx0XHRcdGdldERvbU5vZGU6ICgpID0+IHdpZGdldC5kb21Ob2RlLFxuXHRcdFx0Z2V0UG9zaXRpb246ICgpID0+IHdpZGdldC5wb3NpdGlvbi5nZXQoKSxcblx0XHRcdGdldElkOiAoKSA9PiBjb250ZW50V2lkZ2V0SWQsXG5cdFx0XHRhbGxvd0VkaXRvck92ZXJmbG93OiB3aWRnZXQuYWxsb3dFZGl0b3JPdmVyZmxvdyxcblx0XHR9O1xuXHRcdHRoaXMuZWRpdG9yLmFkZENvbnRlbnRXaWRnZXQodyk7XG5cdFx0Y29uc3QgZCA9IGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdHdpZGdldC5wb3NpdGlvbi5yZWFkKHJlYWRlcik7XG5cdFx0XHR0aGlzLmVkaXRvci5sYXlvdXRDb250ZW50V2lkZ2V0KHcpO1xuXHRcdH0pO1xuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0ZC5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLmVkaXRvci5yZW1vdmVDb250ZW50V2lkZ2V0KHcpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIG9ic2VydmVMaW5lT2Zmc2V0UmFuZ2UobGluZVJhbmdlOiBJT2JzZXJ2YWJsZTxMaW5lUmFuZ2U+LCBzdG9yZTogRGlzcG9zYWJsZVN0b3JlKTogSU9ic2VydmFibGU8T2Zmc2V0UmFuZ2U+IHtcblx0XHRjb25zdCBzdGFydCA9IHRoaXMub2JzZXJ2ZVBvc2l0aW9uKGxpbmVSYW5nZS5tYXAociA9PiBuZXcgUG9zaXRpb24oci5zdGFydExpbmVOdW1iZXIsIDEpKSwgc3RvcmUpO1xuXHRcdGNvbnN0IGVuZCA9IHRoaXMub2JzZXJ2ZVBvc2l0aW9uKGxpbmVSYW5nZS5tYXAociA9PiBuZXcgUG9zaXRpb24oci5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlICsgMSwgMSkpLCBzdG9yZSk7XG5cblx0XHRyZXR1cm4gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0c3RhcnQucmVhZChyZWFkZXIpO1xuXHRcdFx0ZW5kLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IHJhbmdlID0gbGluZVJhbmdlLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IGxpbmVDb3VudCA9IHRoaXMubW9kZWwucmVhZChyZWFkZXIpPy5nZXRMaW5lQ291bnQoKTtcblx0XHRcdGNvbnN0IHMgPSAoXG5cdFx0XHRcdCh0eXBlb2YgbGluZUNvdW50ICE9PSAndW5kZWZpbmVkJyAmJiByYW5nZS5zdGFydExpbmVOdW1iZXIgPiBsaW5lQ291bnRcblx0XHRcdFx0XHQ/IHRoaXMuZWRpdG9yLmdldEJvdHRvbUZvckxpbmVOdW1iZXIobGluZUNvdW50KVxuXHRcdFx0XHRcdDogdGhpcy5lZGl0b3IuZ2V0VG9wRm9yTGluZU51bWJlcihyYW5nZS5zdGFydExpbmVOdW1iZXIpXG5cdFx0XHRcdClcblx0XHRcdFx0LSB0aGlzLnNjcm9sbFRvcC5yZWFkKHJlYWRlcilcblx0XHRcdCk7XG5cdFx0XHRjb25zdCBlID0gcmFuZ2UuaXNFbXB0eSA/IHMgOiAodGhpcy5lZGl0b3IuZ2V0Qm90dG9tRm9yTGluZU51bWJlcihyYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIC0gMSkgLSB0aGlzLnNjcm9sbFRvcC5yZWFkKHJlYWRlcikpO1xuXHRcdFx0cmV0dXJuIG5ldyBPZmZzZXRSYW5nZShzLCBlKTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBvYnNlcnZlUG9zaXRpb24ocG9zaXRpb246IElPYnNlcnZhYmxlPFBvc2l0aW9uIHwgbnVsbD4sIHN0b3JlOiBEaXNwb3NhYmxlU3RvcmUpOiBJT2JzZXJ2YWJsZTxQb2ludCB8IG51bGw+IHtcblx0XHRsZXQgcG9zID0gcG9zaXRpb24uZ2V0KCk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gb2JzZXJ2YWJsZVZhbHVlT3B0czxQb2ludCB8IG51bGw+KHsgb3duZXI6IHRoaXMsIGRlYnVnTmFtZTogKCkgPT4gYHRvcExlZnRPZlBvc2l0aW9uJHtwb3M/LnRvU3RyaW5nKCl9YCwgZXF1YWxzRm46IGVxdWFsc0lmRGVmaW5lZChQb2ludC5lcXVhbHMpIH0sIG5ldyBQb2ludCgwLCAwKSk7XG5cdFx0Y29uc3QgY29udGVudFdpZGdldElkID0gYG9ic2VydmFibGVQb3NpdGlvbldpZGdldGAgKyAodGhpcy5fd2lkZ2V0Q291bnRlcisrKTtcblx0XHRjb25zdCBkb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29uc3QgdzogSUNvbnRlbnRXaWRnZXQgPSB7XG5cdFx0XHRnZXREb21Ob2RlOiAoKSA9PiBkb21Ob2RlLFxuXHRcdFx0Z2V0UG9zaXRpb246ICgpID0+IHtcblx0XHRcdFx0cmV0dXJuIHBvcyA/IHsgcHJlZmVyZW5jZTogW0NvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuRVhBQ1RdLCBwb3NpdGlvbjogcG9zaXRpb24uZ2V0KCkgfSA6IG51bGw7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0SWQ6ICgpID0+IGNvbnRlbnRXaWRnZXRJZCxcblx0XHRcdGFsbG93RWRpdG9yT3ZlcmZsb3c6IGZhbHNlLFxuXHRcdFx0YWZ0ZXJSZW5kZXI6IChwb3NpdGlvbiwgY29vcmRpbmF0ZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX21vZGVsLmdldCgpO1xuXHRcdFx0XHRpZiAobW9kZWwgJiYgcG9zICYmIHBvcy5saW5lTnVtYmVyID4gbW9kZWwuZ2V0TGluZUNvdW50KCkpIHtcblx0XHRcdFx0XHQvLyB0aGUgcG9zaXRpb24gaXMgYWZ0ZXIgdGhlIGxhc3QgbGluZVxuXHRcdFx0XHRcdHJlc3VsdC5zZXQobmV3IFBvaW50KDAsIHRoaXMuZWRpdG9yLmdldEJvdHRvbUZvckxpbmVOdW1iZXIobW9kZWwuZ2V0TGluZUNvdW50KCkpIC0gdGhpcy5zY3JvbGxUb3AuZ2V0KCkpLCB1bmRlZmluZWQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc3VsdC5zZXQoY29vcmRpbmF0ZSA/IG5ldyBQb2ludChjb29yZGluYXRlLmxlZnQsIGNvb3JkaW5hdGUudG9wKSA6IG51bGwsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fTtcblx0XHR0aGlzLmVkaXRvci5hZGRDb250ZW50V2lkZ2V0KHcpO1xuXHRcdHN0b3JlLmFkZChhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRwb3MgPSBwb3NpdGlvbi5yZWFkKHJlYWRlcik7XG5cdFx0XHR0aGlzLmVkaXRvci5sYXlvdXRDb250ZW50V2lkZ2V0KHcpO1xuXHRcdH0pKTtcblx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuZWRpdG9yLnJlbW92ZUNvbnRlbnRXaWRnZXQodyk7XG5cdFx0fSkpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgcmVhZG9ubHkgb3BlbmVkUGVla1dpZGdldHMgPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgMCk7XG5cblx0aXNUYXJnZXRIb3ZlcmVkKHByZWRpY2F0ZTogKHRhcmdldDogSUVkaXRvck1vdXNlRXZlbnQpID0+IGJvb2xlYW4sIHN0b3JlOiBEaXNwb3NhYmxlU3RvcmUpOiBJT2JzZXJ2YWJsZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgaXNIb3ZlcmVkID0gb2JzZXJ2YWJsZVZhbHVlKCdpc0luamVjdGVkVGV4dEhvdmVyZWQnLCBmYWxzZSk7XG5cdFx0c3RvcmUuYWRkKHRoaXMuZWRpdG9yLm9uTW91c2VNb3ZlKGUgPT4ge1xuXHRcdFx0Y29uc3QgdmFsID0gcHJlZGljYXRlKGUpO1xuXHRcdFx0aXNIb3ZlcmVkLnNldCh2YWwsIHVuZGVmaW5lZCk7XG5cdFx0fSkpO1xuXG5cdFx0c3RvcmUuYWRkKHRoaXMuZWRpdG9yLm9uTW91c2VMZWF2ZShFID0+IHtcblx0XHRcdGlzSG92ZXJlZC5zZXQoZmFsc2UsIHVuZGVmaW5lZCk7XG5cdFx0fSkpO1xuXHRcdHJldHVybiBpc0hvdmVyZWQ7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElPYnNlcnZhYmxlT3ZlcmxheVdpZGdldCB7XG5cdGdldCBkb21Ob2RlKCk6IEhUTUxFbGVtZW50O1xuXHRyZWFkb25seSBwb3NpdGlvbjogSU9ic2VydmFibGU8SU92ZXJsYXlXaWRnZXRQb3NpdGlvbiB8IG51bGw+O1xuXHRyZWFkb25seSBtaW5Db250ZW50V2lkdGhJblB4OiBJT2JzZXJ2YWJsZTxudW1iZXI+O1xuXHRnZXQgYWxsb3dFZGl0b3JPdmVyZmxvdygpOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgSU9ic2VydmFibGVDb250ZW50V2lkZ2V0IHtcblx0Z2V0IGRvbU5vZGUoKTogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IHBvc2l0aW9uOiBJT2JzZXJ2YWJsZTxJQ29udGVudFdpZGdldFBvc2l0aW9uIHwgbnVsbD47XG5cdGdldCBhbGxvd0VkaXRvck92ZXJmbG93KCk6IGJvb2xlYW47XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGlCQUFpQixtQkFBbUI7QUFDN0MsU0FBUyxZQUFZLGlCQUE4QixvQkFBb0I7QUFDdkUsU0FBMkQsaUJBQWlCLFNBQVMsYUFBYSxTQUFTLGFBQWEsbUJBQW1CLHFCQUFxQixrQkFBa0IsaUJBQWlCLDJCQUEyQjtBQUM5TixTQUFTLG9CQUF1RDtBQUVoRSxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGlCQUFpQjtBQUkxQixTQUFTLHVDQUFvSztBQUM3SyxTQUFTLGFBQWE7QUFLZixTQUFTLHFCQUFxQixRQUEyQztBQUMvRSxTQUFPLHFCQUFxQixJQUFJLE1BQU07QUFDdkM7QUFFTyxNQUFNLHdCQUFOLE1BQU0sOEJBQTZCLFdBQVc7QUFBQSxFQTRDNUMsWUFBNEIsUUFBcUI7QUFDeEQsVUFBTTtBQUQ2QjtBQXJCcEMsU0FBUSxpQkFBaUI7QUFDekIsU0FBUSxzQkFBbUQ7QUFxRzNELFNBQWlCLFNBQVMsZ0JBQWdCLE1BQU0sS0FBSyxPQUFPLFNBQVMsQ0FBQztBQUN0RSxTQUFnQixRQUF3QyxLQUFLO0FBRTdELFNBQWdCLGFBQWEsb0JBQW9CLE1B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
