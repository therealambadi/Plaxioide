import { findLast } from "../../../../base/common/arraysFind.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, autorunHandleChanges, autorunOpts, autorunWithStore, observableValue, transaction } from "../../../../base/common/observable.js";
import { ElementSizeObserver } from "../../config/elementSizeObserver.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { TextLength } from "../../../common/core/textLength.js";
function joinCombine(arr1, arr2, keySelector, combine) {
  if (arr1.length === 0) {
    return arr2;
  }
  if (arr2.length === 0) {
    return arr1;
  }
  const result = [];
  let i = 0;
  let j = 0;
  while (i < arr1.length && j < arr2.length) {
    const val1 = arr1[i];
    const val2 = arr2[j];
    const key1 = keySelector(val1);
    const key2 = keySelector(val2);
    if (key1 < key2) {
      result.push(val1);
      i++;
    } else if (key1 > key2) {
      result.push(val2);
      j++;
    } else {
      result.push(combine(val1, val2));
      i++;
      j++;
    }
  }
  while (i < arr1.length) {
    result.push(arr1[i]);
    i++;
  }
  while (j < arr2.length) {
    result.push(arr2[j]);
    j++;
  }
  return result;
}
function applyObservableDecorations(editor, decorations) {
  const d = new DisposableStore();
  const decorationsCollection = editor.createDecorationsCollection();
  d.add(autorunOpts({ debugName: () => `Apply decorations from ${decorations.debugName}` }, (reader) => {
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
function appendRemoveOnDispose(parent, child) {
  parent.appendChild(child);
  return toDisposable(() => {
    child.remove();
  });
}
function prependRemoveOnDispose(parent, child) {
  parent.prepend(child);
  return toDisposable(() => {
    child.remove();
  });
}
class ObservableElementSizeObserver extends Disposable {
  constructor(element, dimension) {
    super();
    this._automaticLayout = false;
    this.elementSizeObserver = this._register(new ElementSizeObserver(element, dimension));
    this._width = observableValue(this, this.elementSizeObserver.getWidth());
    this._height = observableValue(this, this.elementSizeObserver.getHeight());
    this._register(this.elementSizeObserver.onDidChange((e) => transaction((tx) => {
      this._width.set(this.elementSizeObserver.getWidth(), tx);
      this._height.set(this.elementSizeObserver.getHeight(), tx);
    })));
  }
  get width() {
    return this._width;
  }
  get height() {
    return this._height;
  }
  get automaticLayout() {
    return this._automaticLayout;
  }
  observe(dimension) {
    this.elementSizeObserver.observe(dimension);
  }
  setAutomaticLayout(automaticLayout) {
    this._automaticLayout = automaticLayout;
    if (automaticLayout) {
      this.elementSizeObserver.startObserving();
    } else {
      this.elementSizeObserver.stopObserving();
    }
  }
}
function animatedObservable(targetWindow, base, store) {
  let targetVal = base.get();
  let startVal = targetVal;
  let curVal = targetVal;
  const result = observableValue("animatedValue", targetVal);
  let animationStartMs = -1;
  const durationMs = 300;
  let animationFrame = void 0;
  store.add(autorunHandleChanges({
    createEmptyChangeSummary: () => ({ animate: false }),
    handleChange: (ctx, s) => {
      if (ctx.didChange(base)) {
        s.animate = s.animate || ctx.change;
      }
      return true;
    }
  }, (reader, s) => {
    if (animationFrame !== void 0) {
      targetWindow.cancelAnimationFrame(animationFrame);
      animationFrame = void 0;
    }
    startVal = curVal;
    targetVal = base.read(reader);
    animationStartMs = Date.now() - (s.animate ? 0 : durationMs);
    update();
  }));
  function update() {
    const passedMs = Date.now() - animationStartMs;
    curVal = Math.floor(easeOutExpo(passedMs, startVal, targetVal - startVal, durationMs));
    if (passedMs < durationMs) {
      animationFrame = targetWindow.requestAnimationFrame(update);
    } else {
      curVal = targetVal;
    }
    result.set(curVal, void 0);
  }
  return result;
}
function easeOutExpo(t, b, c, d) {
  return t === d ? b + c : c * (-Math.pow(2, -10 * t / d) + 1) + b;
}
function deepMerge(source1, source2) {
  const result = {};
  for (const key in source1) {
    result[key] = source1[key];
  }
  for (const key in source2) {
    const source2Value = source2[key];
    if (typeof result[key] === "object" && source2Value && typeof source2Value === "object") {
      result[key] = deepMerge(result[key], source2Value);
    } else {
      result[key] = source2Value;
    }
  }
  return result;
}
class ViewZoneOverlayWidget extends Disposable {
  constructor(editor, viewZone, htmlElement) {
    super();
    this._register(new ManagedOverlayWidget(editor, htmlElement));
    this._register(applyStyle(htmlElement, {
      height: viewZone.actualHeight,
      top: viewZone.actualTop
    }));
  }
}
class PlaceholderViewZone {
  constructor(_afterLineNumber, heightInPx) {
    this._afterLineNumber = _afterLineNumber;
    this.heightInPx = heightInPx;
    this.domNode = document.createElement("div");
    this._actualTop = observableValue(this, void 0);
    this._actualHeight = observableValue(this, void 0);
    this.actualTop = this._actualTop;
    this.actualHeight = this._actualHeight;
    this.showInHiddenAreas = true;
    this.onChange = this._afterLineNumber;
    this.onDomNodeTop = (top) => {
      this._actualTop.set(top, void 0);
    };
    this.onComputedHeight = (height) => {
      this._actualHeight.set(height, void 0);
    };
  }
  get afterLineNumber() {
    return this._afterLineNumber.get();
  }
}
const _ManagedOverlayWidget = class _ManagedOverlayWidget {
  constructor(_editor, _domElement) {
    this._editor = _editor;
    this._domElement = _domElement;
    this._overlayWidgetId = `managedOverlayWidget-${_ManagedOverlayWidget._counter++}`;
    this._overlayWidget = {
      getId: () => this._overlayWidgetId,
      getDomNode: () => this._domElement,
      getPosition: () => null
    };
    this._editor.addOverlayWidget(this._overlayWidget);
  }
  dispose() {
    this._editor.removeOverlayWidget(this._overlayWidget);
  }
};
_ManagedOverlayWidget._counter = 0;
let ManagedOverlayWidget = _ManagedOverlayWidget;
function applyStyle(domNode, style) {
  return autorun((reader) => {
    for (let [key, val] of Object.entries(style)) {
      if (val && typeof val === "object" && "read" in val) {
        val = val.read(reader);
      }
      if (typeof val === "number") {
        val = `${val}px`;
      }
      key = key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
      domNode.style[key] = val;
    }
  });
}
function applyViewZones(editor, viewZones, setIsUpdating, zoneIds) {
  const store = new DisposableStore();
  const lastViewZoneIds = [];
  store.add(autorunWithStore((reader, store2) => {
    const curViewZones = viewZones.read(reader);
    const viewZonIdsPerViewZone = /* @__PURE__ */ new Map();
    const viewZoneIdPerOnChangeObservable = /* @__PURE__ */ new Map();
    if (setIsUpdating) {
      setIsUpdating(true);
    }
    editor.changeViewZones((a) => {
      for (const id of lastViewZoneIds) {
        a.removeZone(id);
        zoneIds?.delete(id);
      }
      lastViewZoneIds.length = 0;
      for (const z of curViewZones) {
        const id = a.addZone(z);
        if (z.setZoneId) {
          z.setZoneId(id);
        }
        lastViewZoneIds.push(id);
        zoneIds?.add(id);
        viewZonIdsPerViewZone.set(z, id);
      }
    });
    if (setIsUpdating) {
      setIsUpdating(false);
    }
    store2.add(autorunHandleChanges({
      createEmptyChangeSummary() {
        return { zoneIds: [] };
      },
      handleChange(context, changeSummary) {
        const id = viewZoneIdPerOnChangeObservable.get(context.changedObservable);
        if (id !== void 0) {
          changeSummary.zoneIds.push(id);
        }
        return true;
      }
    }, (reader2, changeSummary) => {
      for (const vz of curViewZones) {
        if (vz.onChange) {
          viewZoneIdPerOnChangeObservable.set(vz.onChange, viewZonIdsPerViewZone.get(vz));
          vz.onChange.read(reader2);
        }
      }
      if (setIsUpdating) {
        setIsUpdating(true);
      }
      editor.changeViewZones((a) => {
        for (const id of changeSummary.zoneIds) {
          a.layoutZone(id);
        }
      });
      if (setIsUpdating) {
        setIsUpdating(false);
      }
    }));
  }));
  store.add({
    dispose() {
      if (setIsUpdating) {
        setIsUpdating(true);
      }
      editor.changeViewZones((a) => {
        for (const id of lastViewZoneIds) {
          a.removeZone(id);
        }
      });
      zoneIds?.clear();
      if (setIsUpdating) {
        setIsUpdating(false);
      }
    }
  });
  return store;
}
class DisposableCancellationTokenSource extends CancellationTokenSource {
  dispose() {
    super.dispose(true);
  }
}
function translatePosition(posInOriginal, mappings) {
  const mapping = findLast(mappings, (m) => m.original.startLineNumber <= posInOriginal.lineNumber);
  if (!mapping) {
    return Range.fromPositions(posInOriginal);
  }
  if (mapping.original.endLineNumberExclusive <= posInOriginal.lineNumber) {
    const newLineNumber = posInOriginal.lineNumber - mapping.original.endLineNumberExclusive + mapping.modified.endLineNumberExclusive;
    return Range.fromPositions(new Position(newLineNumber, posInOriginal.column));
  }
  if (!mapping.innerChanges) {
    return Range.fromPositions(new Position(mapping.modified.startLineNumber, 1));
  }
  const innerMapping = findLast(mapping.innerChanges, (m) => m.originalRange.getStartPosition().isBeforeOrEqual(posInOriginal));
  if (!innerMapping) {
    const newLineNumber = posInOriginal.lineNumber - mapping.original.startLineNumber + mapping.modified.startLineNumber;
    return Range.fromPositions(new Position(newLineNumber, posInOriginal.column));
  }
  if (innerMapping.originalRange.containsPosition(posInOriginal)) {
    return innerMapping.modifiedRange;
  } else {
    const l = lengthBetweenPositions(innerMapping.originalRange.getEndPosition(), posInOriginal);
    return Range.fromPositions(l.addToPosition(innerMapping.modifiedRange.getEndPosition()));
  }
}
function lengthBetweenPositions(position1, position2) {
  if (position1.lineNumber === position2.lineNumber) {
    return new TextLength(0, position2.column - position1.column);
  } else {
    return new TextLength(position2.lineNumber - position1.lineNumber, position2.column - 1);
  }
}
function filterWithPrevious(arr, filter) {
  let prev;
  return arr.filter((cur) => {
    const result = filter(cur, prev);
    prev = cur;
    return result;
  });
}
class RefCounted {
  static create(value, debugOwner = void 0) {
    return new BaseRefCounted(value, value, debugOwner);
  }
  static createWithDisposable(value, disposable, debugOwner = void 0) {
    const store = new DisposableStore();
    store.add(disposable);
    store.add(value);
    return new BaseRefCounted(value, store, debugOwner);
  }
  static createOfNonDisposable(value, disposable, debugOwner = void 0) {
    return new BaseRefCounted(value, disposable, debugOwner);
  }
}
class BaseRefCounted extends RefCounted {
  constructor(object, _disposable, _debugOwner) {
    super();
    this.object = object;
    this._disposable = _disposable;
    this._debugOwner = _debugOwner;
    this._refCount = 1;
    this._isDisposed = false;
    this._owners = [];
    if (_debugOwner) {
      this._addOwner(_debugOwner);
    }
  }
  _addOwner(debugOwner) {
    if (debugOwner) {
      this._owners.push(debugOwner);
    }
  }
  createNewRef(debugOwner) {
    this._refCount++;
    if (debugOwner) {
      this._addOwner(debugOwner);
    }
    return new ClonedRefCounted(this, debugOwner);
  }
  dispose() {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._decreaseRefCount(this._debugOwner);
  }
  _decreaseRefCount(debugOwner) {
    this._refCount--;
    if (this._refCount === 0) {
      this._disposable.dispose();
    }
    if (debugOwner) {
      const idx = this._owners.indexOf(debugOwner);
      if (idx !== -1) {
        this._owners.splice(idx, 1);
      }
    }
  }
}
class ClonedRefCounted extends RefCounted {
  constructor(_base, _debugOwner) {
    super();
    this._base = _base;
    this._debugOwner = _debugOwner;
    this._isDisposed = false;
  }
  get object() {
    return this._base.object;
  }
  createNewRef(debugOwner) {
    return this._base.createNewRef(debugOwner);
  }
  dispose() {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._base._decreaseRefCount(this._debugOwner);
  }
}
export {
  DisposableCancellationTokenSource,
  ManagedOverlayWidget,
  ObservableElementSizeObserver,
  PlaceholderViewZone,
  RefCounted,
  ViewZoneOverlayWidget,
  animatedObservable,
  appendRemoveOnDispose,
  applyObservableDecorations,
  applyStyle,
  applyViewZones,
  deepMerge,
  filterWithPrevious,
  joinCombine,
  prependRemoveOnDispose,
  translatePosition
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci91dGlscy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElEaW1lbnNpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IGZpbmRMYXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzRmluZC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBJUmVmZXJlbmNlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU9ic2VydmFibGUsIElPYnNlcnZhYmxlV2l0aENoYW5nZSwgSVNldHRhYmxlT2JzZXJ2YWJsZSwgYXV0b3J1biwgYXV0b3J1bkhhbmRsZUNoYW5nZXMsIGF1dG9ydW5PcHRzLCBhdXRvcnVuV2l0aFN0b3JlLCBvYnNlcnZhYmxlVmFsdWUsIHRyYW5zYWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBFbGVtZW50U2l6ZU9ic2VydmVyIH0gZnJvbSAnLi4vLi4vY29uZmlnL2VsZW1lbnRTaXplT2JzZXJ2ZXIuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIElPdmVybGF5V2lkZ2V0LCBJVmlld1pvbmUgfSBmcm9tICcuLi8uLi9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZGlmZi9yYW5nZU1hcHBpbmcuanMnO1xuaW1wb3J0IHsgSU1vZGVsRGVsdGFEZWNvcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IFRleHRMZW5ndGggfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS90ZXh0TGVuZ3RoLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIGpvaW5Db21iaW5lPFQ+KGFycjE6IHJlYWRvbmx5IFRbXSwgYXJyMjogcmVhZG9ubHkgVFtdLCBrZXlTZWxlY3RvcjogKHZhbDogVCkgPT4gbnVtYmVyLCBjb21iaW5lOiAodjE6IFQsIHYyOiBUKSA9PiBUKTogcmVhZG9ubHkgVFtdIHtcblx0aWYgKGFycjEubGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIGFycjI7XG5cdH1cblx0aWYgKGFycjIubGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIGFycjE7XG5cdH1cblxuXHRjb25zdCByZXN1bHQ6IFRbXSA9IFtdO1xuXHRsZXQgaSA9IDA7XG5cdGxldCBqID0gMDtcblx0d2hpbGUgKGkgPCBhcnIxLmxlbmd0aCAmJiBqIDwgYXJyMi5sZW5ndGgpIHtcblx0XHRjb25zdCB2YWwxID0gYXJyMVtpXTtcblx0XHRjb25zdCB2YWwyID0gYXJyMltqXTtcblx0XHRjb25zdCBrZXkxID0ga2V5U2VsZWN0b3IodmFsMSk7XG5cdFx0Y29uc3Qga2V5MiA9IGtleVNlbGVjdG9yKHZhbDIpO1xuXG5cdFx0aWYgKGtleTEgPCBrZXkyKSB7XG5cdFx0XHRyZXN1bHQucHVzaCh2YWwxKTtcblx0XHRcdGkrKztcblx0XHR9IGVsc2UgaWYgKGtleTEgPiBrZXkyKSB7XG5cdFx0XHRyZXN1bHQucHVzaCh2YWwyKTtcblx0XHRcdGorKztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzdWx0LnB1c2goY29tYmluZSh2YWwxLCB2YWwyKSk7XG5cdFx0XHRpKys7XG5cdFx0XHRqKys7XG5cdFx0fVxuXHR9XG5cdHdoaWxlIChpIDwgYXJyMS5sZW5ndGgpIHtcblx0XHRyZXN1bHQucHVzaChhcnIxW2ldKTtcblx0XHRpKys7XG5cdH1cblx0d2hpbGUgKGogPCBhcnIyLmxlbmd0aCkge1xuXHRcdHJlc3VsdC5wdXNoKGFycjJbal0pO1xuXHRcdGorKztcblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG4vLyBUT0RPIG1ha2UgdXRpbGl0eVxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5T2JzZXJ2YWJsZURlY29yYXRpb25zKGVkaXRvcjogSUNvZGVFZGl0b3IsIGRlY29yYXRpb25zOiBJT2JzZXJ2YWJsZTxJTW9kZWxEZWx0YURlY29yYXRpb25bXT4pOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGQgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGNvbnN0IGRlY29yYXRpb25zQ29sbGVjdGlvbiA9IGVkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oKTtcblx0ZC5hZGQoYXV0b3J1bk9wdHMoeyBkZWJ1Z05hbWU6ICgpID0+IGBBcHBseSBkZWNvcmF0aW9ucyBmcm9tICR7ZGVjb3JhdGlvbnMuZGVidWdOYW1lfWAgfSwgcmVhZGVyID0+IHtcblx0XHRjb25zdCBkID0gZGVjb3JhdGlvbnMucmVhZChyZWFkZXIpO1xuXHRcdGRlY29yYXRpb25zQ29sbGVjdGlvbi5zZXQoZCk7XG5cdH0pKTtcblx0ZC5hZGQoe1xuXHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdGRlY29yYXRpb25zQ29sbGVjdGlvbi5jbGVhcigpO1xuXHRcdH1cblx0fSk7XG5cdHJldHVybiBkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwZW5kUmVtb3ZlT25EaXNwb3NlKHBhcmVudDogSFRNTEVsZW1lbnQsIGNoaWxkOiBIVE1MRWxlbWVudCkge1xuXHRwYXJlbnQuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuXHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRjaGlsZC5yZW1vdmUoKTtcblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVwZW5kUmVtb3ZlT25EaXNwb3NlKHBhcmVudDogSFRNTEVsZW1lbnQsIGNoaWxkOiBIVE1MRWxlbWVudCkge1xuXHRwYXJlbnQucHJlcGVuZChjaGlsZCk7XG5cdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdGNoaWxkLnJlbW92ZSgpO1xuXHR9KTtcbn1cblxuZXhwb3J0IGNsYXNzIE9ic2VydmFibGVFbGVtZW50U2l6ZU9ic2VydmVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgZWxlbWVudFNpemVPYnNlcnZlcjogRWxlbWVudFNpemVPYnNlcnZlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF93aWR0aDogSVNldHRhYmxlT2JzZXJ2YWJsZTxudW1iZXI+O1xuXHRwdWJsaWMgZ2V0IHdpZHRoKCk6IElPYnNlcnZhYmxlPG51bWJlcj4geyByZXR1cm4gdGhpcy5fd2lkdGg7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9oZWlnaHQ6IElTZXR0YWJsZU9ic2VydmFibGU8bnVtYmVyPjtcblx0cHVibGljIGdldCBoZWlnaHQoKTogSU9ic2VydmFibGU8bnVtYmVyPiB7IHJldHVybiB0aGlzLl9oZWlnaHQ7IH1cblxuXHRwcml2YXRlIF9hdXRvbWF0aWNMYXlvdXQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHVibGljIGdldCBhdXRvbWF0aWNMYXlvdXQoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9hdXRvbWF0aWNMYXlvdXQ7IH1cblxuXHRjb25zdHJ1Y3RvcihlbGVtZW50OiBIVE1MRWxlbWVudCB8IG51bGwsIGRpbWVuc2lvbjogSURpbWVuc2lvbiB8IHVuZGVmaW5lZCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmVsZW1lbnRTaXplT2JzZXJ2ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRWxlbWVudFNpemVPYnNlcnZlcihlbGVtZW50LCBkaW1lbnNpb24pKTtcblx0XHR0aGlzLl93aWR0aCA9IG9ic2VydmFibGVWYWx1ZSh0aGlzLCB0aGlzLmVsZW1lbnRTaXplT2JzZXJ2ZXIuZ2V0V2lkdGgoKSk7XG5cdFx0dGhpcy5faGVpZ2h0ID0gb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIHRoaXMuZWxlbWVudFNpemVPYnNlcnZlci5nZXRIZWlnaHQoKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVsZW1lbnRTaXplT2JzZXJ2ZXIub25EaWRDaGFuZ2UoZSA9PiB0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIFNldCB3aWR0aC9oZWlnaHQgZnJvbSBlbGVtZW50U2l6ZU9ic2VydmVyICovXG5cdFx0XHR0aGlzLl93aWR0aC5zZXQodGhpcy5lbGVtZW50U2l6ZU9ic2VydmVyLmdldFdpZHRoKCksIHR4KTtcblx0XHRcdHRoaXMuX2hlaWdodC5zZXQodGhpcy5lbGVtZW50U2l6ZU9ic2VydmVyLmdldEhlaWdodCgpLCB0eCk7XG5cdFx0fSkpKTtcblx0fVxuXG5cdHB1YmxpYyBvYnNlcnZlKGRpbWVuc2lvbj86IElEaW1lbnNpb24pOiB2b2lkIHtcblx0XHR0aGlzLmVsZW1lbnRTaXplT2JzZXJ2ZXIub2JzZXJ2ZShkaW1lbnNpb24pO1xuXHR9XG5cblx0cHVibGljIHNldEF1dG9tYXRpY0xheW91dChhdXRvbWF0aWNMYXlvdXQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLl9hdXRvbWF0aWNMYXlvdXQgPSBhdXRvbWF0aWNMYXlvdXQ7XG5cdFx0aWYgKGF1dG9tYXRpY0xheW91dCkge1xuXHRcdFx0dGhpcy5lbGVtZW50U2l6ZU9ic2VydmVyLnN0YXJ0T2JzZXJ2aW5nKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZWxlbWVudFNpemVPYnNlcnZlci5zdG9wT2JzZXJ2aW5nKCk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhbmltYXRlZE9ic2VydmFibGUodGFyZ2V0V2luZG93OiBXaW5kb3csIGJhc2U6IElPYnNlcnZhYmxlV2l0aENoYW5nZTxudW1iZXIsIGJvb2xlYW4+LCBzdG9yZTogRGlzcG9zYWJsZVN0b3JlKTogSU9ic2VydmFibGU8bnVtYmVyPiB7XG5cdGxldCB0YXJnZXRWYWwgPSBiYXNlLmdldCgpO1xuXHRsZXQgc3RhcnRWYWwgPSB0YXJnZXRWYWw7XG5cdGxldCBjdXJWYWwgPSB0YXJnZXRWYWw7XG5cdGNvbnN0IHJlc3VsdCA9IG9ic2VydmFibGVWYWx1ZSgnYW5pbWF0ZWRWYWx1ZScsIHRhcmdldFZhbCk7XG5cblx0bGV0IGFuaW1hdGlvblN0YXJ0TXM6IG51bWJlciA9IC0xO1xuXHRjb25zdCBkdXJhdGlvbk1zID0gMzAwO1xuXHRsZXQgYW5pbWF0aW9uRnJhbWU6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRzdG9yZS5hZGQoYXV0b3J1bkhhbmRsZUNoYW5nZXMoe1xuXHRcdGNyZWF0ZUVtcHR5Q2hhbmdlU3VtbWFyeTogKCkgPT4gKHsgYW5pbWF0ZTogZmFsc2UgfSksXG5cdFx0aGFuZGxlQ2hhbmdlOiAoY3R4LCBzKSA9PiB7XG5cdFx0XHRpZiAoY3R4LmRpZENoYW5nZShiYXNlKSkge1xuXHRcdFx0XHRzLmFuaW1hdGUgPSBzLmFuaW1hdGUgfHwgY3R4LmNoYW5nZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0fSwgKHJlYWRlciwgcykgPT4ge1xuXHRcdC8qKiBAZGVzY3JpcHRpb24gdXBkYXRlIHZhbHVlICovXG5cdFx0aWYgKGFuaW1hdGlvbkZyYW1lICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRhcmdldFdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZShhbmltYXRpb25GcmFtZSk7XG5cdFx0XHRhbmltYXRpb25GcmFtZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRzdGFydFZhbCA9IGN1clZhbDtcblx0XHR0YXJnZXRWYWwgPSBiYXNlLnJlYWQocmVhZGVyKTtcblx0XHRhbmltYXRpb25TdGFydE1zID0gRGF0ZS5ub3coKSAtIChzLmFuaW1hdGUgPyAwIDogZHVyYXRpb25Ncyk7XG5cblx0XHR1cGRhdGUoKTtcblx0fSkpO1xuXG5cdGZ1bmN0aW9uIHVwZGF0ZSgpIHtcblx0XHRjb25zdCBwYXNzZWRNcyA9IERhdGUubm93KCkgLSBhbmltYXRpb25TdGFydE1zO1xuXHRcdGN1clZhbCA9IE1hdGguZmxvb3IoZWFzZU91dEV4cG8ocGFzc2VkTXMsIHN0YXJ0VmFsLCB0YXJnZXRWYWwgLSBzdGFydFZhbCwgZHVyYXRpb25NcykpO1xuXG5cdFx0aWYgKHBhc3NlZE1zIDwgZHVyYXRpb25Ncykge1xuXHRcdFx0YW5pbWF0aW9uRnJhbWUgPSB0YXJnZXRXaW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGN1clZhbCA9IHRhcmdldFZhbDtcblx0XHR9XG5cblx0XHRyZXN1bHQuc2V0KGN1clZhbCwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGVhc2VPdXRFeHBvKHQ6IG51bWJlciwgYjogbnVtYmVyLCBjOiBudW1iZXIsIGQ6IG51bWJlcik6IG51bWJlciB7XG5cdHJldHVybiB0ID09PSBkID8gYiArIGMgOiBjICogKC1NYXRoLnBvdygyLCAtMTAgKiB0IC8gZCkgKyAxKSArIGI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWVwTWVyZ2U8VCBleHRlbmRzIHt9Pihzb3VyY2UxOiBULCBzb3VyY2UyOiBQYXJ0aWFsPFQ+KTogVCB7XG5cdGNvbnN0IHJlc3VsdCA9IHt9IGFzIGFueSBhcyBUO1xuXHRmb3IgKGNvbnN0IGtleSBpbiBzb3VyY2UxKSB7XG5cdFx0cmVzdWx0W2tleV0gPSBzb3VyY2UxW2tleV07XG5cdH1cblx0Zm9yIChjb25zdCBrZXkgaW4gc291cmNlMikge1xuXHRcdGNvbnN0IHNvdXJjZTJWYWx1ZSA9IHNvdXJjZTJba2V5XTtcblx0XHRpZiAodHlwZW9mIHJlc3VsdFtrZXldID09PSAnb2JqZWN0JyAmJiBzb3VyY2UyVmFsdWUgJiYgdHlwZW9mIHNvdXJjZTJWYWx1ZSA9PT0gJ29iamVjdCcpIHtcblx0XHRcdHJlc3VsdFtrZXldID0gZGVlcE1lcmdlPGFueT4ocmVzdWx0W2tleV0sIHNvdXJjZTJWYWx1ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc3VsdFtrZXldID0gc291cmNlMlZhbHVlIGFzIGFueTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFZpZXdab25lT3ZlcmxheVdpZGdldCBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHZpZXdab25lOiBQbGFjZWhvbGRlclZpZXdab25lLFxuXHRcdGh0bWxFbGVtZW50OiBIVE1MRWxlbWVudCxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKG5ldyBNYW5hZ2VkT3ZlcmxheVdpZGdldChlZGl0b3IsIGh0bWxFbGVtZW50KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXBwbHlTdHlsZShodG1sRWxlbWVudCwge1xuXHRcdFx0aGVpZ2h0OiB2aWV3Wm9uZS5hY3R1YWxIZWlnaHQsXG5cdFx0XHR0b3A6IHZpZXdab25lLmFjdHVhbFRvcCxcblx0XHR9KSk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJT2JzZXJ2YWJsZVZpZXdab25lIGV4dGVuZHMgSVZpZXdab25lIHtcblx0Ly8gQ2F1c2VzIHRoZSB2aWV3IHpvbmUgdG8gcmVsYXlvdXQuXG5cdG9uQ2hhbmdlPzogSU9ic2VydmFibGU8dW5rbm93bj47XG5cblx0Ly8gVGVsbHMgYSB2aWV3IHpvbmUgaXRzIGlkLlxuXHRzZXRab25lSWQ/KHpvbmVJZDogc3RyaW5nKTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIFBsYWNlaG9sZGVyVmlld1pvbmUgaW1wbGVtZW50cyBJT2JzZXJ2YWJsZVZpZXdab25lIHtcblx0cHVibGljIHJlYWRvbmx5IGRvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3R1YWxUb3AgPSBvYnNlcnZhYmxlVmFsdWU8bnVtYmVyIHwgdW5kZWZpbmVkPih0aGlzLCB1bmRlZmluZWQpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3R1YWxIZWlnaHQgPSBvYnNlcnZhYmxlVmFsdWU8bnVtYmVyIHwgdW5kZWZpbmVkPih0aGlzLCB1bmRlZmluZWQpO1xuXG5cdHB1YmxpYyByZWFkb25seSBhY3R1YWxUb3A6IElPYnNlcnZhYmxlPG51bWJlciB8IHVuZGVmaW5lZD4gPSB0aGlzLl9hY3R1YWxUb3A7XG5cdHB1YmxpYyByZWFkb25seSBhY3R1YWxIZWlnaHQ6IElPYnNlcnZhYmxlPG51bWJlciB8IHVuZGVmaW5lZD4gPSB0aGlzLl9hY3R1YWxIZWlnaHQ7XG5cblx0cHVibGljIHJlYWRvbmx5IHNob3dJbkhpZGRlbkFyZWFzID0gdHJ1ZTtcblxuXHRwdWJsaWMgZ2V0IGFmdGVyTGluZU51bWJlcigpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5fYWZ0ZXJMaW5lTnVtYmVyLmdldCgpOyB9XG5cblx0cHVibGljIHJlYWRvbmx5IG9uQ2hhbmdlPzogSU9ic2VydmFibGU8dW5rbm93bj4gPSB0aGlzLl9hZnRlckxpbmVOdW1iZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfYWZ0ZXJMaW5lTnVtYmVyOiBJT2JzZXJ2YWJsZTxudW1iZXI+LFxuXHRcdHB1YmxpYyByZWFkb25seSBoZWlnaHRJblB4OiBudW1iZXIsXG5cdCkge1xuXHR9XG5cblx0b25Eb21Ob2RlVG9wID0gKHRvcDogbnVtYmVyKSA9PiB7XG5cdFx0dGhpcy5fYWN0dWFsVG9wLnNldCh0b3AsIHVuZGVmaW5lZCk7XG5cdH07XG5cblx0b25Db21wdXRlZEhlaWdodCA9IChoZWlnaHQ6IG51bWJlcikgPT4ge1xuXHRcdHRoaXMuX2FjdHVhbEhlaWdodC5zZXQoaGVpZ2h0LCB1bmRlZmluZWQpO1xuXHR9O1xufVxuXG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VkT3ZlcmxheVdpZGdldCBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBzdGF0aWMgX2NvdW50ZXIgPSAwO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vdmVybGF5V2lkZ2V0SWQgPSBgbWFuYWdlZE92ZXJsYXlXaWRnZXQtJHtNYW5hZ2VkT3ZlcmxheVdpZGdldC5fY291bnRlcisrfWA7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb3ZlcmxheVdpZGdldDogSU92ZXJsYXlXaWRnZXQgPSB7XG5cdFx0Z2V0SWQ6ICgpID0+IHRoaXMuX292ZXJsYXlXaWRnZXRJZCxcblx0XHRnZXREb21Ob2RlOiAoKSA9PiB0aGlzLl9kb21FbGVtZW50LFxuXHRcdGdldFBvc2l0aW9uOiAoKSA9PiBudWxsXG5cdH07XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kb21FbGVtZW50OiBIVE1MRWxlbWVudCxcblx0KSB7XG5cdFx0dGhpcy5fZWRpdG9yLmFkZE92ZXJsYXlXaWRnZXQodGhpcy5fb3ZlcmxheVdpZGdldCk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2VkaXRvci5yZW1vdmVPdmVybGF5V2lkZ2V0KHRoaXMuX292ZXJsYXlXaWRnZXQpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ1NTU3R5bGUge1xuXHRoZWlnaHQ6IG51bWJlciB8IHN0cmluZztcblx0d2lkdGg6IG51bWJlciB8IHN0cmluZztcblx0dG9wOiBudW1iZXIgfCBzdHJpbmc7XG5cdHZpc2liaWxpdHk6ICd2aXNpYmxlJyB8ICdoaWRkZW4nIHwgJ2NvbGxhcHNlJztcblx0ZGlzcGxheTogJ2Jsb2NrJyB8ICdpbmxpbmUnIHwgJ2lubGluZS1ibG9jaycgfCAnZmxleCcgfCAnbm9uZSc7XG5cdHBhZGRpbmdMZWZ0OiBudW1iZXIgfCBzdHJpbmc7XG5cdHBhZGRpbmdSaWdodDogbnVtYmVyIHwgc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlTdHlsZShkb21Ob2RlOiBIVE1MRWxlbWVudCwgc3R5bGU6IFBhcnRpYWw8eyBbVEtleSBpbiBrZXlvZiBDU1NTdHlsZV06IENTU1N0eWxlW1RLZXldIHwgSU9ic2VydmFibGU8Q1NTU3R5bGVbVEtleV0gfCB1bmRlZmluZWQ+IHwgdW5kZWZpbmVkIH0+KSB7XG5cdHJldHVybiBhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0LyoqIEBkZXNjcmlwdGlvbiBhcHBseVN0eWxlICovXG5cdFx0Zm9yIChsZXQgW2tleSwgdmFsXSBvZiBPYmplY3QuZW50cmllcyhzdHlsZSkpIHtcblx0XHRcdGlmICh2YWwgJiYgdHlwZW9mIHZhbCA9PT0gJ29iamVjdCcgJiYgJ3JlYWQnIGluIHZhbCkge1xuXHRcdFx0XHR2YWwgPSB2YWwucmVhZChyZWFkZXIpIGFzIGFueTtcblx0XHRcdH1cblx0XHRcdGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHR2YWwgPSBgJHt2YWx9cHhgO1xuXHRcdFx0fVxuXHRcdFx0a2V5ID0ga2V5LnJlcGxhY2UoL1tBLVpdL2csIG0gPT4gJy0nICsgbS50b0xvd2VyQ2FzZSgpKTtcblx0XHRcdGRvbU5vZGUuc3R5bGVba2V5IGFzIGFueV0gPSB2YWwgYXMgYW55O1xuXHRcdH1cblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseVZpZXdab25lcyhlZGl0b3I6IElDb2RlRWRpdG9yLCB2aWV3Wm9uZXM6IElPYnNlcnZhYmxlPElPYnNlcnZhYmxlVmlld1pvbmVbXT4sIHNldElzVXBkYXRpbmc/OiAoaXNVcGRhdGluZ1ZpZXdab25lczogYm9vbGVhbikgPT4gdm9pZCwgem9uZUlkcz86IFNldDxzdHJpbmc+KTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0Y29uc3QgbGFzdFZpZXdab25lSWRzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdHN0b3JlLmFkZChhdXRvcnVuV2l0aFN0b3JlKChyZWFkZXIsIHN0b3JlKSA9PiB7XG5cdFx0LyoqIEBkZXNjcmlwdGlvbiBhcHBseVZpZXdab25lcyAqL1xuXHRcdGNvbnN0IGN1clZpZXdab25lcyA9IHZpZXdab25lcy5yZWFkKHJlYWRlcik7XG5cblx0XHRjb25zdCB2aWV3Wm9uSWRzUGVyVmlld1pvbmUgPSBuZXcgTWFwPElPYnNlcnZhYmxlVmlld1pvbmUsIHN0cmluZz4oKTtcblx0XHRjb25zdCB2aWV3Wm9uZUlkUGVyT25DaGFuZ2VPYnNlcnZhYmxlID0gbmV3IE1hcDxJT2JzZXJ2YWJsZTx1bmtub3duPiwgc3RyaW5nPigpO1xuXG5cdFx0Ly8gQWRkL3JlbW92ZSB2aWV3IHpvbmVzXG5cdFx0aWYgKHNldElzVXBkYXRpbmcpIHsgc2V0SXNVcGRhdGluZyh0cnVlKTsgfVxuXHRcdGVkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGlkIG9mIGxhc3RWaWV3Wm9uZUlkcykgeyBhLnJlbW92ZVpvbmUoaWQpOyB6b25lSWRzPy5kZWxldGUoaWQpOyB9XG5cdFx0XHRsYXN0Vmlld1pvbmVJZHMubGVuZ3RoID0gMDtcblxuXHRcdFx0Zm9yIChjb25zdCB6IG9mIGN1clZpZXdab25lcykge1xuXHRcdFx0XHRjb25zdCBpZCA9IGEuYWRkWm9uZSh6KTtcblx0XHRcdFx0aWYgKHouc2V0Wm9uZUlkKSB7XG5cdFx0XHRcdFx0ei5zZXRab25lSWQoaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxhc3RWaWV3Wm9uZUlkcy5wdXNoKGlkKTtcblx0XHRcdFx0em9uZUlkcz8uYWRkKGlkKTtcblx0XHRcdFx0dmlld1pvbklkc1BlclZpZXdab25lLnNldCh6LCBpZCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0aWYgKHNldElzVXBkYXRpbmcpIHsgc2V0SXNVcGRhdGluZyhmYWxzZSk7IH1cblxuXHRcdC8vIExheW91dCB6b25lIG9uIGNoYW5nZVxuXHRcdHN0b3JlLmFkZChhdXRvcnVuSGFuZGxlQ2hhbmdlcyh7XG5cdFx0XHRjcmVhdGVFbXB0eUNoYW5nZVN1bW1hcnkoKSB7XG5cdFx0XHRcdHJldHVybiB7IHpvbmVJZHM6IFtdIGFzIHN0cmluZ1tdIH07XG5cdFx0XHR9LFxuXHRcdFx0aGFuZGxlQ2hhbmdlKGNvbnRleHQsIGNoYW5nZVN1bW1hcnkpIHtcblx0XHRcdFx0Y29uc3QgaWQgPSB2aWV3Wm9uZUlkUGVyT25DaGFuZ2VPYnNlcnZhYmxlLmdldChjb250ZXh0LmNoYW5nZWRPYnNlcnZhYmxlKTtcblx0XHRcdFx0aWYgKGlkICE9PSB1bmRlZmluZWQpIHsgY2hhbmdlU3VtbWFyeS56b25lSWRzLnB1c2goaWQpOyB9XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSxcblx0XHR9LCAocmVhZGVyLCBjaGFuZ2VTdW1tYXJ5KSA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIGxheW91dFpvbmUgb24gY2hhbmdlICovXG5cdFx0XHRmb3IgKGNvbnN0IHZ6IG9mIGN1clZpZXdab25lcykge1xuXHRcdFx0XHRpZiAodnoub25DaGFuZ2UpIHtcblx0XHRcdFx0XHR2aWV3Wm9uZUlkUGVyT25DaGFuZ2VPYnNlcnZhYmxlLnNldCh2ei5vbkNoYW5nZSwgdmlld1pvbklkc1BlclZpZXdab25lLmdldCh2eikhKTtcblx0XHRcdFx0XHR2ei5vbkNoYW5nZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChzZXRJc1VwZGF0aW5nKSB7IHNldElzVXBkYXRpbmcodHJ1ZSk7IH1cblx0XHRcdGVkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYSA9PiB7IGZvciAoY29uc3QgaWQgb2YgY2hhbmdlU3VtbWFyeS56b25lSWRzKSB7IGEubGF5b3V0Wm9uZShpZCk7IH0gfSk7XG5cdFx0XHRpZiAoc2V0SXNVcGRhdGluZykgeyBzZXRJc1VwZGF0aW5nKGZhbHNlKTsgfVxuXHRcdH0pKTtcblx0fSkpO1xuXG5cdHN0b3JlLmFkZCh7XG5cdFx0ZGlzcG9zZSgpIHtcblx0XHRcdGlmIChzZXRJc1VwZGF0aW5nKSB7IHNldElzVXBkYXRpbmcodHJ1ZSk7IH1cblx0XHRcdGVkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYSA9PiB7IGZvciAoY29uc3QgaWQgb2YgbGFzdFZpZXdab25lSWRzKSB7IGEucmVtb3ZlWm9uZShpZCk7IH0gfSk7XG5cdFx0XHR6b25lSWRzPy5jbGVhcigpO1xuXHRcdFx0aWYgKHNldElzVXBkYXRpbmcpIHsgc2V0SXNVcGRhdGluZyhmYWxzZSk7IH1cblx0XHR9XG5cdH0pO1xuXG5cdHJldHVybiBzdG9yZTtcbn1cblxuZXhwb3J0IGNsYXNzIERpc3Bvc2FibGVDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSBleHRlbmRzIENhbmNlbGxhdGlvblRva2VuU291cmNlIHtcblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0c3VwZXIuZGlzcG9zZSh0cnVlKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNsYXRlUG9zaXRpb24ocG9zSW5PcmlnaW5hbDogUG9zaXRpb24sIG1hcHBpbmdzOiBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmdbXSk6IFJhbmdlIHtcblx0Y29uc3QgbWFwcGluZyA9IGZpbmRMYXN0KG1hcHBpbmdzLCBtID0+IG0ub3JpZ2luYWwuc3RhcnRMaW5lTnVtYmVyIDw9IHBvc0luT3JpZ2luYWwubGluZU51bWJlcik7XG5cdGlmICghbWFwcGluZykge1xuXHRcdC8vIE5vIGNoYW5nZXMgYmVmb3JlIHRoZSBwb3NpdGlvblxuXHRcdHJldHVybiBSYW5nZS5mcm9tUG9zaXRpb25zKHBvc0luT3JpZ2luYWwpO1xuXHR9XG5cblx0aWYgKG1hcHBpbmcub3JpZ2luYWwuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSA8PSBwb3NJbk9yaWdpbmFsLmxpbmVOdW1iZXIpIHtcblx0XHRjb25zdCBuZXdMaW5lTnVtYmVyID0gcG9zSW5PcmlnaW5hbC5saW5lTnVtYmVyIC0gbWFwcGluZy5vcmlnaW5hbC5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlICsgbWFwcGluZy5tb2RpZmllZC5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlO1xuXHRcdHJldHVybiBSYW5nZS5mcm9tUG9zaXRpb25zKG5ldyBQb3NpdGlvbihuZXdMaW5lTnVtYmVyLCBwb3NJbk9yaWdpbmFsLmNvbHVtbikpO1xuXHR9XG5cblx0aWYgKCFtYXBwaW5nLmlubmVyQ2hhbmdlcykge1xuXHRcdC8vIE9ubHkgZm9yIGxlZ2FjeSBhbGdvcml0aG1cblx0XHRyZXR1cm4gUmFuZ2UuZnJvbVBvc2l0aW9ucyhuZXcgUG9zaXRpb24obWFwcGluZy5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIsIDEpKTtcblx0fVxuXG5cdGNvbnN0IGlubmVyTWFwcGluZyA9IGZpbmRMYXN0KG1hcHBpbmcuaW5uZXJDaGFuZ2VzLCBtID0+IG0ub3JpZ2luYWxSYW5nZS5nZXRTdGFydFBvc2l0aW9uKCkuaXNCZWZvcmVPckVxdWFsKHBvc0luT3JpZ2luYWwpKTtcblx0aWYgKCFpbm5lck1hcHBpbmcpIHtcblx0XHRjb25zdCBuZXdMaW5lTnVtYmVyID0gcG9zSW5PcmlnaW5hbC5saW5lTnVtYmVyIC0gbWFwcGluZy5vcmlnaW5hbC5zdGFydExpbmVOdW1iZXIgKyBtYXBwaW5nLm1vZGlmaWVkLnN0YXJ0TGluZU51bWJlcjtcblx0XHRyZXR1cm4gUmFuZ2UuZnJvbVBvc2l0aW9ucyhuZXcgUG9zaXRpb24obmV3TGluZU51bWJlciwgcG9zSW5PcmlnaW5hbC5jb2x1bW4pKTtcblx0fVxuXG5cdGlmIChpbm5lck1hcHBpbmcub3JpZ2luYWxSYW5nZS5jb250YWluc1Bvc2l0aW9uKHBvc0luT3JpZ2luYWwpKSB7XG5cdFx0cmV0dXJuIGlubmVyTWFwcGluZy5tb2RpZmllZFJhbmdlO1xuXHR9IGVsc2Uge1xuXHRcdGNvbnN0IGwgPSBsZW5ndGhCZXR3ZWVuUG9zaXRpb25zKGlubmVyTWFwcGluZy5vcmlnaW5hbFJhbmdlLmdldEVuZFBvc2l0aW9uKCksIHBvc0luT3JpZ2luYWwpO1xuXHRcdHJldHVybiBSYW5nZS5mcm9tUG9zaXRpb25zKGwuYWRkVG9Qb3NpdGlvbihpbm5lck1hcHBpbmcubW9kaWZpZWRSYW5nZS5nZXRFbmRQb3NpdGlvbigpKSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gbGVuZ3RoQmV0d2VlblBvc2l0aW9ucyhwb3NpdGlvbjE6IFBvc2l0aW9uLCBwb3NpdGlvbjI6IFBvc2l0aW9uKTogVGV4dExlbmd0aCB7XG5cdGlmIChwb3NpdGlvbjEubGluZU51bWJlciA9PT0gcG9zaXRpb24yLmxpbmVOdW1iZXIpIHtcblx0XHRyZXR1cm4gbmV3IFRleHRMZW5ndGgoMCwgcG9zaXRpb24yLmNvbHVtbiAtIHBvc2l0aW9uMS5jb2x1bW4pO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBuZXcgVGV4dExlbmd0aChwb3NpdGlvbjIubGluZU51bWJlciAtIHBvc2l0aW9uMS5saW5lTnVtYmVyLCBwb3NpdGlvbjIuY29sdW1uIC0gMSk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbHRlcldpdGhQcmV2aW91czxUPihhcnI6IFRbXSwgZmlsdGVyOiAoY3VyOiBULCBwcmV2OiBUIHwgdW5kZWZpbmVkKSA9PiBib29sZWFuKTogVFtdIHtcblx0bGV0IHByZXY6IFQgfCB1bmRlZmluZWQ7XG5cdHJldHVybiBhcnIuZmlsdGVyKGN1ciA9PiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gZmlsdGVyKGN1ciwgcHJldik7XG5cdFx0cHJldiA9IGN1cjtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9KTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUmVmQ291bnRlZCBleHRlbmRzIElEaXNwb3NhYmxlIHtcblx0Y3JlYXRlTmV3UmVmKCk6IHRoaXM7XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBSZWZDb3VudGVkPFQ+IGltcGxlbWVudHMgSURpc3Bvc2FibGUsIElSZWZlcmVuY2U8VD4ge1xuXHRwdWJsaWMgc3RhdGljIGNyZWF0ZTxUIGV4dGVuZHMgSURpc3Bvc2FibGU+KHZhbHVlOiBULCBkZWJ1Z093bmVyOiBvYmplY3QgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQpOiBSZWZDb3VudGVkPFQ+IHtcblx0XHRyZXR1cm4gbmV3IEJhc2VSZWZDb3VudGVkKHZhbHVlLCB2YWx1ZSwgZGVidWdPd25lcik7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGNyZWF0ZVdpdGhEaXNwb3NhYmxlPFQgZXh0ZW5kcyBJRGlzcG9zYWJsZT4odmFsdWU6IFQsIGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlLCBkZWJ1Z093bmVyOiBvYmplY3QgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQpOiBSZWZDb3VudGVkPFQ+IHtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRzdG9yZS5hZGQoZGlzcG9zYWJsZSk7XG5cdFx0c3RvcmUuYWRkKHZhbHVlKTtcblx0XHRyZXR1cm4gbmV3IEJhc2VSZWZDb3VudGVkKHZhbHVlLCBzdG9yZSwgZGVidWdPd25lcik7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGNyZWF0ZU9mTm9uRGlzcG9zYWJsZTxUPih2YWx1ZTogVCwgZGlzcG9zYWJsZTogSURpc3Bvc2FibGUsIGRlYnVnT3duZXI6IG9iamVjdCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCk6IFJlZkNvdW50ZWQ8VD4ge1xuXHRcdHJldHVybiBuZXcgQmFzZVJlZkNvdW50ZWQodmFsdWUsIGRpc3Bvc2FibGUsIGRlYnVnT3duZXIpO1xuXHR9XG5cblx0cHVibGljIGFic3RyYWN0IGNyZWF0ZU5ld1JlZihkZWJ1Z093bmVyPzogb2JqZWN0IHwgdW5kZWZpbmVkKTogUmVmQ291bnRlZDxUPjtcblxuXHRwdWJsaWMgYWJzdHJhY3QgZGlzcG9zZSgpOiB2b2lkO1xuXG5cdHB1YmxpYyBhYnN0cmFjdCBnZXQgb2JqZWN0KCk6IFQ7XG59XG5cbmNsYXNzIEJhc2VSZWZDb3VudGVkPFQ+IGV4dGVuZHMgUmVmQ291bnRlZDxUPiB7XG5cdHByaXZhdGUgX3JlZkNvdW50ID0gMTtcblx0cHJpdmF0ZSBfaXNEaXNwb3NlZCA9IGZhbHNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vd25lcnM6IG9iamVjdFtdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIG92ZXJyaWRlIHJlYWRvbmx5IG9iamVjdDogVCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kZWJ1Z093bmVyOiBvYmplY3QgfCB1bmRlZmluZWQsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRpZiAoX2RlYnVnT3duZXIpIHtcblx0XHRcdHRoaXMuX2FkZE93bmVyKF9kZWJ1Z093bmVyKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9hZGRPd25lcihkZWJ1Z093bmVyOiBvYmplY3QgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAoZGVidWdPd25lcikge1xuXHRcdFx0dGhpcy5fb3duZXJzLnB1c2goZGVidWdPd25lcik7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGNyZWF0ZU5ld1JlZihkZWJ1Z093bmVyPzogb2JqZWN0IHwgdW5kZWZpbmVkKTogUmVmQ291bnRlZDxUPiB7XG5cdFx0dGhpcy5fcmVmQ291bnQrKztcblx0XHRpZiAoZGVidWdPd25lcikge1xuXHRcdFx0dGhpcy5fYWRkT3duZXIoZGVidWdPd25lcik7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgQ2xvbmVkUmVmQ291bnRlZCh0aGlzLCBkZWJ1Z093bmVyKTtcblx0fVxuXG5cdHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7IHJldHVybjsgfVxuXHRcdHRoaXMuX2lzRGlzcG9zZWQgPSB0cnVlO1xuXHRcdHRoaXMuX2RlY3JlYXNlUmVmQ291bnQodGhpcy5fZGVidWdPd25lcik7XG5cdH1cblxuXHRwdWJsaWMgX2RlY3JlYXNlUmVmQ291bnQoZGVidWdPd25lcj86IG9iamVjdCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZkNvdW50LS07XG5cdFx0aWYgKHRoaXMuX3JlZkNvdW50ID09PSAwKSB7XG5cdFx0XHR0aGlzLl9kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHR9XG5cblx0XHRpZiAoZGVidWdPd25lcikge1xuXHRcdFx0Y29uc3QgaWR4ID0gdGhpcy5fb3duZXJzLmluZGV4T2YoZGVidWdPd25lcik7XG5cdFx0XHRpZiAoaWR4ICE9PSAtMSkge1xuXHRcdFx0XHR0aGlzLl9vd25lcnMuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIENsb25lZFJlZkNvdW50ZWQ8VD4gZXh0ZW5kcyBSZWZDb3VudGVkPFQ+IHtcblx0cHJpdmF0ZSBfaXNEaXNwb3NlZCA9IGZhbHNlO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9iYXNlOiBCYXNlUmVmQ291bnRlZDxUPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kZWJ1Z093bmVyOiBvYmplY3QgfCB1bmRlZmluZWQsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG9iamVjdCgpOiBUIHsgcmV0dXJuIHRoaXMuX2Jhc2Uub2JqZWN0OyB9XG5cblx0cHVibGljIGNyZWF0ZU5ld1JlZihkZWJ1Z093bmVyPzogb2JqZWN0IHwgdW5kZWZpbmVkKTogUmVmQ291bnRlZDxUPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2Jhc2UuY3JlYXRlTmV3UmVmKGRlYnVnT3duZXIpO1xuXHR9XG5cblx0cHVibGljIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQpIHsgcmV0dXJuOyB9XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0dGhpcy5fYmFzZS5fZGVjcmVhc2VSZWZDb3VudCh0aGlzLl9kZWJ1Z093bmVyKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxZQUFZLGlCQUEwQyxvQkFBb0I7QUFDbkYsU0FBa0UsU0FBUyxzQkFBc0IsYUFBYSxrQkFBa0IsaUJBQWlCLG1CQUFtQjtBQUNwSyxTQUFTLDJCQUEyQjtBQUVwQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFHdEIsU0FBUyxrQkFBa0I7QUFFcEIsU0FBUyxZQUFlLE1BQW9CLE1BQW9CLGFBQWlDLFNBQTRDO0FBQ25KLE1BQUksS0FBSyxXQUFXLEdBQUc7QUFDdEIsV0FBTztBQUFBLEVBQ1I7QUFDQSxNQUFJLEtBQUssV0FBVyxHQUFHO0FBQ3RCLFdBQU87QUFBQSxFQUNSO0FBRUEsUUFBTSxTQUFjLENBQUM7QUFDckIsTUFBSSxJQUFJO0FBQ1IsTUFBSSxJQUFJO0FBQ1IsU0FBTyxJQUFJLEtBQUssVUFBVSxJQUFJLEtBQUssUUFBUTtBQUMxQyxVQUFNLE9BQU8sS0FBSyxDQUFDO0FBQ25CLFVBQU0sT0FBTyxLQUFLLENBQUM7QUFDbkIsVUFBTSxPQUFPLFlBQVksSUFBSTtBQUM3QixVQUFNLE9BQU8sWUFBWSxJQUFJ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SSxlQUFlLE9BQU8sT0FBTyxVQUFVO0FBQUEsRUFDbkQ7QUFBQSxFQUVBLE9BQWMsc0JBQXlCLE9BQVUsWUFBeUIsYUFBaUMsUUFBMEI7QUFDcEksV0FBTyxJQUFJLGVBQWUsT0FBTyxZQUFZLFVBQVU7QUFBQSxFQUN4RDtBQU9EO0FBRUEsTUFBTSx1QkFBMEIsV0FBYztBQUFBLEVBSzdDLFlBQzBCLFFBQ1IsYUFDQSxhQUNoQjtBQUNELFVBQU07QUFKbUI7QUFDUjtBQUNBO0FBUGxCLFNBQVEsWUFBWTtBQUNwQixTQUFRLGNBQWM7QUFDdEIsU0FBaUIsVUFBb0IsQ0FBQztBQVNyQyxRQUFJLGFBQWE7QUFDaEIsV0FBSyxVQUFVLFdBQVc7QUFBQSxJQUMzQjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLFVBQVUsWUFBZ0M7QUFDakQsUUFBSSxZQUFZO0FBQ2YsV0FBSyxRQUFRLEtBQUssVUFBVTtBQUFBLElBQzdCO0FBQUEsRUFDRDtBQUFBLEVBRU8sYUFBYSxZQUFnRDtBQUNuRSxTQUFLO0FBQ0wsUUFBSSxZQUFZO0FBQ2YsV0FBSyxVQUFVLFVBQVU7QUFBQSxJQUMxQjtBQUNBLFdBQU8sSUFBSSxpQkFBaUIsTUFBTSxVQUFVO0FBQUEsRUFDN0M7QUFBQSxFQUVPLFVBQWdCO0FBQ3RCLFFBQUksS0FBSyxhQUFhO0FBQUU7QUFBQSxJQUFRO0FBQ2hDLFNBQUssY0FBYztBQUNuQixTQUFLLGtCQUFrQixLQUFLLFdBQVc7QUFBQSxFQUN4QztBQUFBLEVBRU8sa0JBQWtCLFlBQXVDO0FBQy9ELFNBQUs7QUFDTCxRQUFJLEtBQUssY0FBYyxHQUFHO0FBQ3pCLFdBQUssWUFBWSxRQUFRO0FBQUEsSUFDMUI7QUFFQSxRQUFJLFlBQVk7QUFDZixZQUFNLE1BQU0sS0FBSyxRQUFRLFFBQVEsVUFBVTtBQUMzQyxVQUFJLFFBQVEsSUFBSTtBQUNmLGFBQUssUUFBUSxPQUFPLEtBQUssQ0FBQztBQUFBLE1BQzNCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQUVBLE1BQU0seUJBQTRCLFdBQWM7QUFBQSxFQUUvQyxZQUNrQixPQUNBLGFBQ2hCO0FBQ0QsVUFBTTtBQUhXO0FBQ0E7QUFIbEIsU0FBUSxjQUFjO0FBQUEsRUFNdEI7QUFBQSxFQUVBLElBQVcsU0FBWTtBQUFFLFdBQU8sS0FBSyxNQUFNO0FBQUEsRUFBUTtBQUFBLEVBRTVDLGFBQWEsWUFBZ0Q7QUFDbkUsV0FBTyxLQUFLLE1BQU0sYUFBYSxVQUFVO0FBQUEsRUFDMUM7QUFBQSxFQUVPLFVBQWdCO0FBQ3RCLFFBQUksS0FBSyxhQUFhO0FBQUU7QUFBQSxJQUFRO0FBQ2hDLFNBQUssY0FBYztBQUNuQixTQUFLLE1BQU0sa0JBQWtCLEtBQUssV0FBVztBQUFBLEVBQzlDO0FBQ0Q7IiwKICAibmFtZXMiOiBbImQiLCAic3RvcmUiLCAicmVhZGVyIl0KfQo=
