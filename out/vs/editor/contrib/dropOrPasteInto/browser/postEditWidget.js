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
import { Button } from "../../../../base/browser/ui/button/button.js";
import { raceCancellationError } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { ActionListItemKind } from "../../../../platform/actionWidget/browser/actionList.js";
import { IActionWidgetService } from "../../../../platform/actionWidget/browser/actionWidget.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { ContentWidgetPositionPreference } from "../../../browser/editorBrowser.js";
import { IBulkEditService } from "../../../browser/services/bulkEditService.js";
import { TrackedRangeStickiness } from "../../../common/model.js";
import { CodeEditorStateFlag, EditorStateCancellationTokenSource } from "../../editorState/browser/editorState.js";
import { createCombinedWorkspaceEdit } from "./edit.js";
import "./postEditWidget.css";
let PostEditWidget = class extends Disposable {
  constructor(typeId, editor, visibleContext, showCommand, range, edits, onSelectNewEdit, additionalActions, contextKeyService, _keybindingService, _actionWidgetService) {
    super();
    this.typeId = typeId;
    this.editor = editor;
    this.showCommand = showCommand;
    this.range = range;
    this.edits = edits;
    this.onSelectNewEdit = onSelectNewEdit;
    this.additionalActions = additionalActions;
    this._keybindingService = _keybindingService;
    this._actionWidgetService = _actionWidgetService;
    this.allowEditorOverflow = true;
    this.suppressMouseDown = true;
    this.create();
    this.visibleContext = visibleContext.bindTo(contextKeyService);
    this.visibleContext.set(true);
    this._register(toDisposable(() => this.visibleContext.reset()));
    this.editor.addContentWidget(this);
    this.editor.layoutContentWidget(this);
    this._register(toDisposable(() => this.editor.removeContentWidget(this)));
    this._register(this.editor.onDidChangeCursorPosition((e) => {
      this.dispose();
    }));
    this._register(Event.runAndSubscribe(_keybindingService.onDidUpdateKeybindings, () => {
      this._updateButtonTitle();
    }));
  }
  _updateButtonTitle() {
    const binding = this._keybindingService.lookupKeybinding(this.showCommand.id)?.getLabel();
    this.button.element.title = this.showCommand.label + (binding ? ` (${binding})` : "");
  }
  create() {
    this.domNode = dom.$(".post-edit-widget");
    this.button = this._register(new Button(this.domNode, {
      supportIcons: true
    }));
    this.button.label = "$(insert)";
    this._register(dom.addDisposableListener(this.domNode, dom.EventType.CLICK, () => this.showSelector()));
  }
  getId() {
    return PostEditWidget.baseId + "." + this.typeId;
  }
  getDomNode() {
    return this.domNode;
  }
  getPosition() {
    return {
      position: this.range.getEndPosition(),
      preference: [ContentWidgetPositionPreference.BELOW]
    };
  }
  showSelector() {
    const pos = dom.getDomNodePagePosition(this.button.element);
    const anchor = { x: pos.left + pos.width, y: pos.top + pos.height };
    this._actionWidgetService.show(
      "postEditWidget",
      false,
      this.edits.allEdits.map((edit, i) => {
        return {
          kind: ActionListItemKind.Action,
          item: edit,
          label: edit.title,
          disabled: false,
          canPreview: false,
          group: { title: "", icon: ThemeIcon.fromId(i === this.edits.activeEditIndex ? Codicon.check.id : Codicon.blank.id) }
        };
      }),
      {
        onHide: () => {
          this.editor.focus();
        },
        onSelect: (item) => {
          this._actionWidgetService.hide(false);
          const i = this.edits.allEdits.findIndex((edit) => edit === item);
          if (i !== this.edits.activeEditIndex) {
            return this.onSelectNewEdit(i);
          }
        }
      },
      anchor,
      this.editor.getDomNode() ?? void 0,
      this.additionalActions
    );
  }
};
PostEditWidget.baseId = "editor.widget.postEditWidget";
PostEditWidget = __decorateClass([
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, IActionWidgetService)
], PostEditWidget);
let PostEditWidgetManager = class extends Disposable {
  constructor(_id, _editor, _visibleContext, _showCommand, _getAdditionalActions, _instantiationService, _bulkEditService, _notificationService) {
    super();
    this._id = _id;
    this._editor = _editor;
    this._visibleContext = _visibleContext;
    this._showCommand = _showCommand;
    this._getAdditionalActions = _getAdditionalActions;
    this._instantiationService = _instantiationService;
    this._bulkEditService = _bulkEditService;
    this._notificationService = _notificationService;
    this._currentWidget = this._register(new MutableDisposable());
    this._register(Event.any(
      _editor.onDidChangeModel,
      _editor.onDidChangeModelContent
    )(() => this.clear()));
  }
  async applyEditAndShowIfNeeded(ranges, edits, canShowWidget, resolve, token) {
    if (!ranges.length || !this._editor.hasModel()) {
      return;
    }
    const model = this._editor.getModel();
    const edit = edits.allEdits.at(edits.activeEditIndex);
    if (!edit) {
      return;
    }
    const onDidSelectEdit = async (newEditIndex) => {
      const model2 = this._editor.getModel();
      if (!model2) {
        return;
      }
      await model2.undo();
      this.applyEditAndShowIfNeeded(ranges, { activeEditIndex: newEditIndex, allEdits: edits.allEdits }, canShowWidget, resolve, token);
    };
    const handleError = (e, message) => {
      if (isCancellationError(e)) {
        return;
      }
      this._notificationService.error(message);
      if (canShowWidget) {
        this.show(ranges[0], edits, onDidSelectEdit);
      }
    };
    const editorStateCts = new EditorStateCancellationTokenSource(this._editor, CodeEditorStateFlag.Value | CodeEditorStateFlag.Selection, void 0, token);
    let resolvedEdit;
    try {
      resolvedEdit = await raceCancellationError(resolve(edit, editorStateCts.token), editorStateCts.token);
    } catch (e) {
      return handleError(e, localize("resolveError", "Error resolving edit '{0}':\n{1}", edit.title, toErrorMessage(e)));
    } finally {
      editorStateCts.dispose();
    }
    if (token.isCancellationRequested) {
      return;
    }
    const combinedWorkspaceEdit = createCombinedWorkspaceEdit(model.uri, ranges, resolvedEdit);
    const primaryRange = ranges[0];
    const editTrackingDecoration = model.deltaDecorations([], [{
      range: primaryRange,
      options: { description: "paste-line-suffix", stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges }
    }]);
    this._editor.focus();
    let editResult;
    let editRange;
    try {
      editResult = await this._bulkEditService.apply(combinedWorkspaceEdit, { editor: this._editor, token });
      editRange = model.getDecorationRange(editTrackingDecoration[0]);
    } catch (e) {
      return handleError(e, localize("applyError", "Error applying edit '{0}':\n{1}", edit.title, toErrorMessage(e)));
    } finally {
      model.deltaDecorations(editTrackingDecoration, []);
    }
    if (token.isCancellationRequested) {
      return;
    }
    if (canShowWidget && editResult.isApplied && edits.allEdits.length > 1) {
      this.show(editRange ?? primaryRange, edits, onDidSelectEdit);
    }
  }
  show(range, edits, onDidSelectEdit) {
    this.clear();
    if (this._editor.hasModel()) {
      this._currentWidget.value = this._instantiationService.createInstance(PostEditWidget, this._id, this._editor, this._visibleContext, this._showCommand, range, edits, onDidSelectEdit, this._getAdditionalActions());
    }
  }
  clear() {
    this._currentWidget.clear();
  }
  tryShowSelector() {
    this._currentWidget.value?.showSelector();
  }
};
PostEditWidgetManager = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IBulkEditService),
  __decorateParam(7, INotificationService)
], PostEditWidgetManager);
export {
  PostEditWidgetManager
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9kcm9wT3JQYXN0ZUludG8vYnJvd3Nlci9wb3N0RWRpdFdpZGdldC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IElBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IHJhY2VDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyB0b0Vycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5pbXBvcnQgeyBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uTGlzdEl0ZW1LaW5kLCBJQWN0aW9uTGlzdEl0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25XaWRnZXQvYnJvd3Nlci9hY3Rpb25MaXN0LmpzJztcbmltcG9ydCB7IElBY3Rpb25XaWRnZXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uV2lkZ2V0L2Jyb3dzZXIvYWN0aW9uV2lkZ2V0LmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UsIElDb2RlRWRpdG9yLCBJQ29udGVudFdpZGdldCwgSUNvbnRlbnRXaWRnZXRQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJQnVsa0VkaXRSZXN1bHQsIElCdWxrRWRpdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3NlcnZpY2VzL2J1bGtFZGl0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IERvY3VtZW50RHJvcEVkaXQsIERvY3VtZW50UGFzdGVFZGl0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBUcmFja2VkUmFuZ2VTdGlja2luZXNzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IENvZGVFZGl0b3JTdGF0ZUZsYWcsIEVkaXRvclN0YXRlQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi9lZGl0b3JTdGF0ZS9icm93c2VyL2VkaXRvclN0YXRlLmpzJztcbmltcG9ydCB7IGNyZWF0ZUNvbWJpbmVkV29ya3NwYWNlRWRpdCB9IGZyb20gJy4vZWRpdC5qcyc7XG5pbXBvcnQgJy4vcG9zdEVkaXRXaWRnZXQuY3NzJztcblxuXG5pbnRlcmZhY2UgRWRpdFNldDxFZGl0IGV4dGVuZHMgRG9jdW1lbnRQYXN0ZUVkaXQgfCBEb2N1bWVudERyb3BFZGl0PiB7XG5cdHJlYWRvbmx5IGFjdGl2ZUVkaXRJbmRleDogbnVtYmVyO1xuXHRyZWFkb25seSBhbGxFZGl0czogUmVhZG9ubHlBcnJheTxFZGl0Pjtcbn1cblxuaW50ZXJmYWNlIFNob3dDb21tYW5kIHtcblx0cmVhZG9ubHkgaWQ6IHN0cmluZztcblx0cmVhZG9ubHkgbGFiZWw6IHN0cmluZztcbn1cblxuY2xhc3MgUG9zdEVkaXRXaWRnZXQ8VCBleHRlbmRzIERvY3VtZW50UGFzdGVFZGl0IHwgRG9jdW1lbnREcm9wRWRpdD4gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNvbnRlbnRXaWRnZXQge1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBiYXNlSWQgPSAnZWRpdG9yLndpZGdldC5wb3N0RWRpdFdpZGdldCc7XG5cblx0cmVhZG9ubHkgYWxsb3dFZGl0b3JPdmVyZmxvdyA9IHRydWU7XG5cdHJlYWRvbmx5IHN1cHByZXNzTW91c2VEb3duID0gdHJ1ZTtcblxuXHRwcml2YXRlIGRvbU5vZGUhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBidXR0b24hOiBCdXR0b247XG5cblx0cHJpdmF0ZSByZWFkb25seSB2aXNpYmxlQ29udGV4dDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSB0eXBlSWQ6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0dmlzaWJsZUNvbnRleHQ6IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBzaG93Q29tbWFuZDogU2hvd0NvbW1hbmQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSByYW5nZTogUmFuZ2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0czogRWRpdFNldDxUPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IG9uU2VsZWN0TmV3RWRpdDogKGVkaXRJbmRleDogbnVtYmVyKSA9PiB2b2lkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgYWRkaXRpb25hbEFjdGlvbnM6IHJlYWRvbmx5IElBY3Rpb25bXSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9rZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQWN0aW9uV2lkZ2V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9hY3Rpb25XaWRnZXRTZXJ2aWNlOiBJQWN0aW9uV2lkZ2V0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuY3JlYXRlKCk7XG5cblx0XHR0aGlzLnZpc2libGVDb250ZXh0ID0gdmlzaWJsZUNvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnZpc2libGVDb250ZXh0LnNldCh0cnVlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy52aXNpYmxlQ29udGV4dC5yZXNldCgpKSk7XG5cblx0XHR0aGlzLmVkaXRvci5hZGRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHRcdHRoaXMuZWRpdG9yLmxheW91dENvbnRlbnRXaWRnZXQodGhpcyk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCgpID0+IHRoaXMuZWRpdG9yLnJlbW92ZUNvbnRlbnRXaWRnZXQodGhpcykpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvci5vbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uKGUgPT4ge1xuXHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQucnVuQW5kU3Vic2NyaWJlKF9rZXliaW5kaW5nU2VydmljZS5vbkRpZFVwZGF0ZUtleWJpbmRpbmdzLCAoKSA9PiB7XG5cdFx0XHR0aGlzLl91cGRhdGVCdXR0b25UaXRsZSgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUJ1dHRvblRpdGxlKCkge1xuXHRcdGNvbnN0IGJpbmRpbmcgPSB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKHRoaXMuc2hvd0NvbW1hbmQuaWQpPy5nZXRMYWJlbCgpO1xuXHRcdHRoaXMuYnV0dG9uLmVsZW1lbnQudGl0bGUgPSB0aGlzLnNob3dDb21tYW5kLmxhYmVsICsgKGJpbmRpbmcgPyBgICgke2JpbmRpbmd9KWAgOiAnJyk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLmRvbU5vZGUgPSBkb20uJCgnLnBvc3QtZWRpdC13aWRnZXQnKTtcblxuXHRcdHRoaXMuYnV0dG9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEJ1dHRvbih0aGlzLmRvbU5vZGUsIHtcblx0XHRcdHN1cHBvcnRJY29uczogdHJ1ZSxcblx0XHR9KSk7XG5cdFx0dGhpcy5idXR0b24ubGFiZWwgPSAnJChpbnNlcnQpJztcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5kb21Ob2RlLCBkb20uRXZlbnRUeXBlLkNMSUNLLCAoKSA9PiB0aGlzLnNob3dTZWxlY3RvcigpKSk7XG5cdH1cblxuXHRnZXRJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBQb3N0RWRpdFdpZGdldC5iYXNlSWQgKyAnLicgKyB0aGlzLnR5cGVJZDtcblx0fVxuXG5cdGdldERvbU5vZGUoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLmRvbU5vZGU7XG5cdH1cblxuXHRnZXRQb3NpdGlvbigpOiBJQ29udGVudFdpZGdldFBvc2l0aW9uIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHBvc2l0aW9uOiB0aGlzLnJhbmdlLmdldEVuZFBvc2l0aW9uKCksXG5cdFx0XHRwcmVmZXJlbmNlOiBbQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5CRUxPV11cblx0XHR9O1xuXHR9XG5cblx0c2hvd1NlbGVjdG9yKCkge1xuXHRcdGNvbnN0IHBvcyA9IGRvbS5nZXREb21Ob2RlUGFnZVBvc2l0aW9uKHRoaXMuYnV0dG9uLmVsZW1lbnQpO1xuXHRcdGNvbnN0IGFuY2hvciA9IHsgeDogcG9zLmxlZnQgKyBwb3Mud2lkdGgsIHk6IHBvcy50b3AgKyBwb3MuaGVpZ2h0IH07XG5cblx0XHR0aGlzLl9hY3Rpb25XaWRnZXRTZXJ2aWNlLnNob3coJ3Bvc3RFZGl0V2lkZ2V0JywgZmFsc2UsXG5cdFx0XHR0aGlzLmVkaXRzLmFsbEVkaXRzLm1hcCgoZWRpdCwgaSk6IElBY3Rpb25MaXN0SXRlbTxUPiA9PiB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0a2luZDogQWN0aW9uTGlzdEl0ZW1LaW5kLkFjdGlvbixcblx0XHRcdFx0XHRpdGVtOiBlZGl0LFxuXHRcdFx0XHRcdGxhYmVsOiBlZGl0LnRpdGxlLFxuXHRcdFx0XHRcdGRpc2FibGVkOiBmYWxzZSxcblx0XHRcdFx0XHRjYW5QcmV2aWV3OiBmYWxzZSxcblx0XHRcdFx0XHRncm91cDogeyB0aXRsZTogJycsIGljb246IFRoZW1lSWNvbi5mcm9tSWQoaSA9PT0gdGhpcy5lZGl0cy5hY3RpdmVFZGl0SW5kZXggPyBDb2RpY29uLmNoZWNrLmlkIDogQ29kaWNvbi5ibGFuay5pZCkgfSxcblx0XHRcdFx0fTtcblx0XHRcdH0pLCB7XG5cdFx0XHRvbkhpZGU6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5lZGl0b3IuZm9jdXMoKTtcblx0XHRcdH0sXG5cdFx0XHRvblNlbGVjdDogKGl0ZW0pID0+IHtcblx0XHRcdFx0dGhpcy5fYWN0aW9uV2lkZ2V0U2VydmljZS5oaWRlKGZhbHNlKTtcblxuXHRcdFx0XHRjb25zdCBpID0gdGhpcy5lZGl0cy5hbGxFZGl0cy5maW5kSW5kZXgoZWRpdCA9PiBlZGl0ID09PSBpdGVtKTtcblx0XHRcdFx0aWYgKGkgIT09IHRoaXMuZWRpdHMuYWN0aXZlRWRpdEluZGV4KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMub25TZWxlY3ROZXdFZGl0KGkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdH0sIGFuY2hvciwgdGhpcy5lZGl0b3IuZ2V0RG9tTm9kZSgpID8/IHVuZGVmaW5lZCwgdGhpcy5hZGRpdGlvbmFsQWN0aW9ucyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFBvc3RFZGl0V2lkZ2V0TWFuYWdlcjxUIGV4dGVuZHMgRG9jdW1lbnRQYXN0ZUVkaXQgfCBEb2N1bWVudERyb3BFZGl0PiBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2N1cnJlbnRXaWRnZXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8UG9zdEVkaXRXaWRnZXQ8VD4+KCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2lkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF92aXNpYmxlQ29udGV4dDogUmF3Q29udGV4dEtleTxib29sZWFuPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9zaG93Q29tbWFuZDogU2hvd0NvbW1hbmQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZ2V0QWRkaXRpb25hbEFjdGlvbnM6ICgpID0+IHJlYWRvbmx5IElBY3Rpb25bXSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElCdWxrRWRpdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYnVsa0VkaXRTZXJ2aWNlOiBJQnVsa0VkaXRTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9ub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmFueShcblx0XHRcdF9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbCxcblx0XHRcdF9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQsXG5cdFx0KSgoKSA9PiB0aGlzLmNsZWFyKCkpKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBhcHBseUVkaXRBbmRTaG93SWZOZWVkZWQocmFuZ2VzOiByZWFkb25seSBSYW5nZVtdLCBlZGl0czogRWRpdFNldDxUPiwgY2FuU2hvd1dpZGdldDogYm9vbGVhbiwgcmVzb2x2ZTogKGVkaXQ6IFQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikgPT4gUHJvbWlzZTxUPiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSB7XG5cdFx0aWYgKCFyYW5nZXMubGVuZ3RoIHx8ICF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0Y29uc3QgZWRpdCA9IGVkaXRzLmFsbEVkaXRzLmF0KGVkaXRzLmFjdGl2ZUVkaXRJbmRleCk7XG5cdFx0aWYgKCFlZGl0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb25EaWRTZWxlY3RFZGl0ID0gYXN5bmMgKG5ld0VkaXRJbmRleDogbnVtYmVyKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IG1vZGVsLnVuZG8oKTtcblx0XHRcdHRoaXMuYXBwbHlFZGl0QW5kU2hvd0lmTmVlZGVkKHJhbmdlcywgeyBhY3RpdmVFZGl0SW5kZXg6IG5ld0VkaXRJbmRleCwgYWxsRWRpdHM6IGVkaXRzLmFsbEVkaXRzIH0sIGNhblNob3dXaWRnZXQsIHJlc29sdmUsIHRva2VuKTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgaGFuZGxlRXJyb3IgPSAoZTogRXJyb3IsIG1lc3NhZ2U6IHN0cmluZykgPT4ge1xuXHRcdFx0aWYgKGlzQ2FuY2VsbGF0aW9uRXJyb3IoZSkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKG1lc3NhZ2UpO1xuXHRcdFx0aWYgKGNhblNob3dXaWRnZXQpIHtcblx0XHRcdFx0dGhpcy5zaG93KHJhbmdlc1swXSwgZWRpdHMsIG9uRGlkU2VsZWN0RWRpdCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IGVkaXRvclN0YXRlQ3RzID0gbmV3IEVkaXRvclN0YXRlQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UodGhpcy5fZWRpdG9yLCBDb2RlRWRpdG9yU3RhdGVGbGFnLlZhbHVlIHwgQ29kZUVkaXRvclN0YXRlRmxhZy5TZWxlY3Rpb24sIHVuZGVmaW5lZCwgdG9rZW4pO1xuXHRcdGxldCByZXNvbHZlZEVkaXQ6IFQ7XG5cdFx0dHJ5IHtcblx0XHRcdHJlc29sdmVkRWRpdCA9IGF3YWl0IHJhY2VDYW5jZWxsYXRpb25FcnJvcihyZXNvbHZlKGVkaXQsIGVkaXRvclN0YXRlQ3RzLnRva2VuKSwgZWRpdG9yU3RhdGVDdHMudG9rZW4pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHJldHVybiBoYW5kbGVFcnJvcihlLCBsb2NhbGl6ZSgncmVzb2x2ZUVycm9yJywgXCJFcnJvciByZXNvbHZpbmcgZWRpdCAnezB9JzpcXG57MX1cIiwgZWRpdC50aXRsZSwgdG9FcnJvck1lc3NhZ2UoZSkpKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0ZWRpdG9yU3RhdGVDdHMuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbWJpbmVkV29ya3NwYWNlRWRpdCA9IGNyZWF0ZUNvbWJpbmVkV29ya3NwYWNlRWRpdChtb2RlbC51cmksIHJhbmdlcywgcmVzb2x2ZWRFZGl0KTtcblxuXHRcdC8vIFVzZSBhIGRlY29yYXRpb24gdG8gdHJhY2sgZWRpdHMgYXJvdW5kIHRoZSB0cmlnZ2VyIHJhbmdlXG5cdFx0Y29uc3QgcHJpbWFyeVJhbmdlID0gcmFuZ2VzWzBdO1xuXHRcdGNvbnN0IGVkaXRUcmFja2luZ0RlY29yYXRpb24gPSBtb2RlbC5kZWx0YURlY29yYXRpb25zKFtdLCBbe1xuXHRcdFx0cmFuZ2U6IHByaW1hcnlSYW5nZSxcblx0XHRcdG9wdGlvbnM6IHsgZGVzY3JpcHRpb246ICdwYXN0ZS1saW5lLXN1ZmZpeCcsIHN0aWNraW5lc3M6IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyB9XG5cdFx0fV0pO1xuXG5cdFx0dGhpcy5fZWRpdG9yLmZvY3VzKCk7XG5cdFx0bGV0IGVkaXRSZXN1bHQ6IElCdWxrRWRpdFJlc3VsdDtcblx0XHRsZXQgZWRpdFJhbmdlOiBSYW5nZSB8IG51bGw7XG5cdFx0dHJ5IHtcblx0XHRcdGVkaXRSZXN1bHQgPSBhd2FpdCB0aGlzLl9idWxrRWRpdFNlcnZpY2UuYXBwbHkoY29tYmluZWRXb3Jrc3BhY2VFZGl0LCB7IGVkaXRvcjogdGhpcy5fZWRpdG9yLCB0b2tlbiB9KTtcblx0XHRcdGVkaXRSYW5nZSA9IG1vZGVsLmdldERlY29yYXRpb25SYW5nZShlZGl0VHJhY2tpbmdEZWNvcmF0aW9uWzBdKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gaGFuZGxlRXJyb3IoZSwgbG9jYWxpemUoJ2FwcGx5RXJyb3InLCBcIkVycm9yIGFwcGx5aW5nIGVkaXQgJ3swfSc6XFxuezF9XCIsIGVkaXQudGl0bGUsIHRvRXJyb3JNZXNzYWdlKGUpKSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdG1vZGVsLmRlbHRhRGVjb3JhdGlvbnMoZWRpdFRyYWNraW5nRGVjb3JhdGlvbiwgW10pO1xuXHRcdH1cblxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChjYW5TaG93V2lkZ2V0ICYmIGVkaXRSZXN1bHQuaXNBcHBsaWVkICYmIGVkaXRzLmFsbEVkaXRzLmxlbmd0aCA+IDEpIHtcblx0XHRcdHRoaXMuc2hvdyhlZGl0UmFuZ2UgPz8gcHJpbWFyeVJhbmdlLCBlZGl0cywgb25EaWRTZWxlY3RFZGl0KTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc2hvdyhyYW5nZTogUmFuZ2UsIGVkaXRzOiBFZGl0U2V0PFQ+LCBvbkRpZFNlbGVjdEVkaXQ6IChuZXdJbmRleDogbnVtYmVyKSA9PiB2b2lkKSB7XG5cdFx0dGhpcy5jbGVhcigpO1xuXG5cdFx0aWYgKHRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50V2lkZ2V0LnZhbHVlID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUG9zdEVkaXRXaWRnZXQ8VD4sIHRoaXMuX2lkLCB0aGlzLl9lZGl0b3IsIHRoaXMuX3Zpc2libGVDb250ZXh0LCB0aGlzLl9zaG93Q29tbWFuZCwgcmFuZ2UsIGVkaXRzLCBvbkRpZFNlbGVjdEVkaXQsIHRoaXMuX2dldEFkZGl0aW9uYWxBY3Rpb25zKCkpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBjbGVhcigpIHtcblx0XHR0aGlzLl9jdXJyZW50V2lkZ2V0LmNsZWFyKCk7XG5cdH1cblxuXHRwdWJsaWMgdHJ5U2hvd1NlbGVjdG9yKCkge1xuXHRcdHRoaXMuX2N1cnJlbnRXaWRnZXQudmFsdWU/LnNob3dTZWxlY3RvcigpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLGNBQWM7QUFFdkIsU0FBUyw2QkFBNkI7QUFFdEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMkJBQTJCO0FBQ3BD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
