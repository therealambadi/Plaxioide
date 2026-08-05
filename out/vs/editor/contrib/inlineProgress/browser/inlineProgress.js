var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import * as dom from "../../../../base/browser/dom.js";
import { disposableTimeout } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { noBreakWhitespace } from "../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import "./inlineProgressWidget.css";
import { ContentWidgetPositionPreference } from "../../../browser/editorBrowser.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Range } from "../../../common/core/range.js";
import { TrackedRangeStickiness } from "../../../common/model.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
const inlineProgressDecoration = ModelDecorationOptions.register({
  description: "inline-progress-widget",
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
  showIfCollapsed: true,
  after: {
    content: noBreakWhitespace,
    inlineClassName: "inline-editor-progress-decoration",
    inlineClassNameAffectsLetterSpacing: true
  }
});
const _InlineProgressWidget = class _InlineProgressWidget extends Disposable {
  constructor(typeId, editor, range, title, delegate) {
    super();
    this.typeId = typeId;
    this.editor = editor;
    this.range = range;
    this.delegate = delegate;
    this.allowEditorOverflow = false;
    this.suppressMouseDown = true;
    this.create(title);
    this.editor.addContentWidget(this);
    this.editor.layoutContentWidget(this);
  }
  create(title) {
    this.domNode = dom.$(".inline-progress-widget");
    this.domNode.role = "button";
    this.domNode.title = title;
    const iconElement = dom.$("span.icon");
    this.domNode.append(iconElement);
    iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.loading), "codicon-modifier-spin");
    const updateSize = () => {
      const lineHeight = this.editor.getOption(EditorOption.lineHeight);
      this.domNode.style.height = `${lineHeight}px`;
      this.domNode.style.width = `${Math.ceil(0.8 * lineHeight)}px`;
    };
    updateSize();
    this._register(this.editor.onDidChangeConfiguration((c) => {
      if (c.hasChanged(EditorOption.fontSize) || c.hasChanged(EditorOption.lineHeight)) {
        updateSize();
      }
    }));
    this._register(dom.addDisposableListener(this.domNode, dom.EventType.CLICK, (e) => {
      this.delegate.cancel();
    }));
  }
  getId() {
    return _InlineProgressWidget.baseId + "." + this.typeId;
  }
  getDomNode() {
    return this.domNode;
  }
  getPosition() {
    return {
      position: { lineNumber: this.range.startLineNumber, column: this.range.startColumn },
      preference: [ContentWidgetPositionPreference.EXACT]
    };
  }
  dispose() {
    super.dispose();
    this.editor.removeContentWidget(this);
  }
};
_InlineProgressWidget.baseId = "editor.widget.inlineProgressWidget";
let InlineProgressWidget = _InlineProgressWidget;
let InlineProgressManager = class extends Disposable {
  constructor(id, _editor, _instantiationService) {
    super();
    this.id = id;
    this._editor = _editor;
    this._instantiationService = _instantiationService;
    /** Delay before showing the progress widget */
    this._showDelay = 500;
    // ms
    this._showPromise = this._register(new MutableDisposable());
    this._currentWidget = this._register(new MutableDisposable());
    this._operationIdPool = 0;
    this._currentDecorations = _editor.createDecorationsCollection();
  }
  dispose() {
    super.dispose();
    this._currentDecorations.clear();
  }
  async showWhile(position, title, promise, delegate, delayOverride) {
    const operationId = this._operationIdPool++;
    this._currentOperation = operationId;
    this.clear();
    this._showPromise.value = disposableTimeout(() => {
      const range = Range.fromPositions(position);
      const decorationIds = this._currentDecorations.set([{
        range,
        options: inlineProgressDecoration
      }]);
      if (decorationIds.length > 0) {
        this._currentWidget.value = this._instantiationService.createInstance(InlineProgressWidget, this.id, this._editor, range, title, delegate);
      }
    }, delayOverride ?? this._showDelay);
    try {
      return await promise;
    } finally {
      if (this._currentOperation === operationId) {
        this.clear();
        this._currentOperation = void 0;
      }
    }
  }
  clear() {
    this._showPromise.clear();
    this._currentDecorations.clear();
    this._currentWidget.clear();
  }
};
InlineProgressManager = __decorateClass([
  __decorateParam(2, IInstantiationService)
], InlineProgressManager);
export {
  InlineProgressManager
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVQcm9ncmVzcy9icm93c2VyL2lubGluZVByb2dyZXNzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgZGlzcG9zYWJsZVRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgbm9CcmVha1doaXRlc3BhY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgJy4vaW5saW5lUHJvZ3Jlc3NXaWRnZXQuY3NzJztcbmltcG9ydCB7IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UsIElDb2RlRWRpdG9yLCBJQ29udGVudFdpZGdldCwgSUNvbnRlbnRXaWRnZXRQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yRGVjb3JhdGlvbnNDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBUcmFja2VkUmFuZ2VTdGlja2luZXNzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuXG5jb25zdCBpbmxpbmVQcm9ncmVzc0RlY29yYXRpb24gPSBNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHtcblx0ZGVzY3JpcHRpb246ICdpbmxpbmUtcHJvZ3Jlc3Mtd2lkZ2V0Jyxcblx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsXG5cdHNob3dJZkNvbGxhcHNlZDogdHJ1ZSxcblx0YWZ0ZXI6IHtcblx0XHRjb250ZW50OiBub0JyZWFrV2hpdGVzcGFjZSxcblx0XHRpbmxpbmVDbGFzc05hbWU6ICdpbmxpbmUtZWRpdG9yLXByb2dyZXNzLWRlY29yYXRpb24nLFxuXHRcdGlubGluZUNsYXNzTmFtZUFmZmVjdHNMZXR0ZXJTcGFjaW5nOiB0cnVlLFxuXHR9XG59KTtcblxuXG5jbGFzcyBJbmxpbmVQcm9ncmVzc1dpZGdldCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQ29udGVudFdpZGdldCB7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IGJhc2VJZCA9ICdlZGl0b3Iud2lkZ2V0LmlubGluZVByb2dyZXNzV2lkZ2V0JztcblxuXHRhbGxvd0VkaXRvck92ZXJmbG93ID0gZmFsc2U7XG5cdHN1cHByZXNzTW91c2VEb3duID0gdHJ1ZTtcblxuXHRwcml2YXRlIGRvbU5vZGUhOiBIVE1MRWxlbWVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHR5cGVJZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IHJhbmdlOiBSYW5nZSxcblx0XHR0aXRsZTogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZGVsZWdhdGU6IElubGluZVByb2dyZXNzRGVsZWdhdGUsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmNyZWF0ZSh0aXRsZSk7XG5cblx0XHR0aGlzLmVkaXRvci5hZGRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHRcdHRoaXMuZWRpdG9yLmxheW91dENvbnRlbnRXaWRnZXQodGhpcyk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZSh0aXRsZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5kb21Ob2RlID0gZG9tLiQoJy5pbmxpbmUtcHJvZ3Jlc3Mtd2lkZ2V0Jyk7XG5cdFx0dGhpcy5kb21Ob2RlLnJvbGUgPSAnYnV0dG9uJztcblx0XHR0aGlzLmRvbU5vZGUudGl0bGUgPSB0aXRsZTtcblxuXHRcdGNvbnN0IGljb25FbGVtZW50ID0gZG9tLiQoJ3NwYW4uaWNvbicpO1xuXHRcdHRoaXMuZG9tTm9kZS5hcHBlbmQoaWNvbkVsZW1lbnQpO1xuXG5cdFx0aWNvbkVsZW1lbnQuY2xhc3NMaXN0LmFkZCguLi5UaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShDb2RpY29uLmxvYWRpbmcpLCAnY29kaWNvbi1tb2RpZmllci1zcGluJyk7XG5cblx0XHRjb25zdCB1cGRhdGVTaXplID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGluZUhlaWdodCk7XG5cdFx0XHR0aGlzLmRvbU5vZGUuc3R5bGUuaGVpZ2h0ID0gYCR7bGluZUhlaWdodH1weGA7XG5cdFx0XHR0aGlzLmRvbU5vZGUuc3R5bGUud2lkdGggPSBgJHtNYXRoLmNlaWwoMC44ICogbGluZUhlaWdodCl9cHhgO1xuXHRcdH07XG5cdFx0dXBkYXRlU2l6ZSgpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGMgPT4ge1xuXHRcdFx0aWYgKGMuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uZm9udFNpemUpIHx8IGMuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ubGluZUhlaWdodCkpIHtcblx0XHRcdFx0dXBkYXRlU2l6ZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5kb21Ob2RlLCBkb20uRXZlbnRUeXBlLkNMSUNLLCBlID0+IHtcblx0XHRcdHRoaXMuZGVsZWdhdGUuY2FuY2VsKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0Z2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gSW5saW5lUHJvZ3Jlc3NXaWRnZXQuYmFzZUlkICsgJy4nICsgdGhpcy50eXBlSWQ7XG5cdH1cblxuXHRnZXREb21Ob2RlKCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5kb21Ob2RlO1xuXHR9XG5cblx0Z2V0UG9zaXRpb24oKTogSUNvbnRlbnRXaWRnZXRQb3NpdGlvbiB8IG51bGwge1xuXHRcdHJldHVybiB7XG5cdFx0XHRwb3NpdGlvbjogeyBsaW5lTnVtYmVyOiB0aGlzLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgY29sdW1uOiB0aGlzLnJhbmdlLnN0YXJ0Q29sdW1uIH0sXG5cdFx0XHRwcmVmZXJlbmNlOiBbQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5FWEFDVF1cblx0XHR9O1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5lZGl0b3IucmVtb3ZlQ29udGVudFdpZGdldCh0aGlzKTtcblx0fVxufVxuXG5pbnRlcmZhY2UgSW5saW5lUHJvZ3Jlc3NEZWxlZ2F0ZSB7XG5cdGNhbmNlbCgpOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgSW5saW5lUHJvZ3Jlc3NNYW5hZ2VyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0LyoqIERlbGF5IGJlZm9yZSBzaG93aW5nIHRoZSBwcm9ncmVzcyB3aWRnZXQgKi9cblx0cHJpdmF0ZSByZWFkb25seSBfc2hvd0RlbGF5ID0gNTAwOyAvLyBtc1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zaG93UHJvbWlzZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jdXJyZW50RGVjb3JhdGlvbnM6IElFZGl0b3JEZWNvcmF0aW9uc0NvbGxlY3Rpb247XG5cdHByaXZhdGUgcmVhZG9ubHkgX2N1cnJlbnRXaWRnZXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SW5saW5lUHJvZ3Jlc3NXaWRnZXQ+KCkpO1xuXG5cdHByaXZhdGUgX29wZXJhdGlvbklkUG9vbCA9IDA7XG5cdHByaXZhdGUgX2N1cnJlbnRPcGVyYXRpb24/OiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBpZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fY3VycmVudERlY29yYXRpb25zID0gX2VkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9jdXJyZW50RGVjb3JhdGlvbnMuY2xlYXIoKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBzaG93V2hpbGU8Uj4ocG9zaXRpb246IElQb3NpdGlvbiwgdGl0bGU6IHN0cmluZywgcHJvbWlzZTogUHJvbWlzZTxSPiwgZGVsZWdhdGU6IElubGluZVByb2dyZXNzRGVsZWdhdGUsIGRlbGF5T3ZlcnJpZGU/OiBudW1iZXIpOiBQcm9taXNlPFI+IHtcblx0XHRjb25zdCBvcGVyYXRpb25JZCA9IHRoaXMuX29wZXJhdGlvbklkUG9vbCsrO1xuXHRcdHRoaXMuX2N1cnJlbnRPcGVyYXRpb24gPSBvcGVyYXRpb25JZDtcblxuXHRcdHRoaXMuY2xlYXIoKTtcblxuXHRcdHRoaXMuX3Nob3dQcm9taXNlLnZhbHVlID0gZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmFuZ2UgPSBSYW5nZS5mcm9tUG9zaXRpb25zKHBvc2l0aW9uKTtcblx0XHRcdGNvbnN0IGRlY29yYXRpb25JZHMgPSB0aGlzLl9jdXJyZW50RGVjb3JhdGlvbnMuc2V0KFt7XG5cdFx0XHRcdHJhbmdlOiByYW5nZSxcblx0XHRcdFx0b3B0aW9uczogaW5saW5lUHJvZ3Jlc3NEZWNvcmF0aW9uLFxuXHRcdFx0fV0pO1xuXG5cdFx0XHRpZiAoZGVjb3JhdGlvbklkcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnRXaWRnZXQudmFsdWUgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbmxpbmVQcm9ncmVzc1dpZGdldCwgdGhpcy5pZCwgdGhpcy5fZWRpdG9yLCByYW5nZSwgdGl0bGUsIGRlbGVnYXRlKTtcblx0XHRcdH1cblx0XHR9LCBkZWxheU92ZXJyaWRlID8/IHRoaXMuX3Nob3dEZWxheSk7XG5cblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIGF3YWl0IHByb21pc2U7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGlmICh0aGlzLl9jdXJyZW50T3BlcmF0aW9uID09PSBvcGVyYXRpb25JZCkge1xuXHRcdFx0XHR0aGlzLmNsZWFyKCk7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnRPcGVyYXRpb24gPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjbGVhcigpIHtcblx0XHR0aGlzLl9zaG93UHJvbWlzZS5jbGVhcigpO1xuXHRcdHRoaXMuX2N1cnJlbnREZWNvcmF0aW9ucy5jbGVhcigpO1xuXHRcdHRoaXMuX2N1cnJlbnRXaWRnZXQuY2xlYXIoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWSx5QkFBeUI7QUFDOUMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxpQkFBaUI7QUFDMUIsT0FBTztBQUNQLFNBQVMsdUNBQTRGO0FBQ3JHLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsYUFBYTtBQUV0QixTQUFTLDhCQUE4QjtBQUN2QyxTQUFT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
