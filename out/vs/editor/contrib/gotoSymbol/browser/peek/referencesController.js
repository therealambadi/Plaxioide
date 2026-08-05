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
import { createCancelablePromise } from "../../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ICodeEditorService } from "../../../../browser/services/codeEditorService.js";
import { EditorOption } from "../../../../common/config/editorOptions.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { PeekContext } from "../../../peekView/browser/peekView.js";
import { getOuterEditor } from "../../../../browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import * as nls from "../../../../../nls.js";
import { CommandsRegistry } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { TextEditorSelectionSource } from "../../../../../platform/editor/common/editor.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IListService, WorkbenchListFocusContextKey, WorkbenchTreeElementCanCollapse, WorkbenchTreeElementCanExpand } from "../../../../../platform/list/browser/listService.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { OneReference } from "../referencesModel.js";
import { LayoutData, ReferenceWidget } from "./referencesWidget.js";
import { EditorContextKeys } from "../../../../common/editorContextKeys.js";
import { InputFocusedContext } from "../../../../../platform/contextkey/common/contextkeys.js";
const ctxReferenceSearchVisible = new RawContextKey("referenceSearchVisible", false, nls.localize("referenceSearchVisible", "Whether reference peek is visible, like 'Peek References' or 'Peek Definition'"));
let ReferencesController = class {
  constructor(_defaultTreeKeyboardSupport, _editor, contextKeyService, _editorService, _notificationService, _instantiationService, _storageService, _configurationService) {
    this._defaultTreeKeyboardSupport = _defaultTreeKeyboardSupport;
    this._editor = _editor;
    this._editorService = _editorService;
    this._notificationService = _notificationService;
    this._instantiationService = _instantiationService;
    this._storageService = _storageService;
    this._configurationService = _configurationService;
    this._disposables = new DisposableStore();
    this._requestIdPool = 0;
    this._ignoreModelChangeEvent = false;
    this._referenceSearchVisible = ctxReferenceSearchVisible.bindTo(contextKeyService);
  }
  static get(editor) {
    return editor.getContribution(ReferencesController.ID);
  }
  dispose() {
    this._referenceSearchVisible.reset();
    this._disposables.dispose();
    this._widget?.dispose();
    this._model?.dispose();
    this._widget = void 0;
    this._model = void 0;
  }
  toggleWidget(range, modelPromise, peekMode) {
    let widgetPosition;
    if (this._widget) {
      widgetPosition = this._widget.position;
    }
    this.closeWidget();
    if (!!widgetPosition && range.containsPosition(widgetPosition)) {
      return;
    }
    this._peekMode = peekMode;
    this._referenceSearchVisible.set(true);
    this._disposables.add(this._editor.onDidChangeModelLanguage(() => {
      this.closeWidget();
    }));
    this._disposables.add(this._editor.onDidChangeModel(() => {
      if (!this._ignoreModelChangeEvent) {
        this.closeWidget();
      }
    }));
    const storageKey = "peekViewLayout";
    const data = LayoutData.fromJSON(this._storageService.get(storageKey, StorageScope.PROFILE, "{}"));
    this._widget = this._instantiationService.createInstance(ReferenceWidget, this._editor, this._defaultTreeKeyboardSupport, data);
    this._widget.setTitle(nls.localize("labelLoading", "Loading..."));
    this._widget.show(range);
    this._disposables.add(this._widget.onDidClose(() => {
      modelPromise.cancel();
      if (this._widget) {
        this._storageService.store(storageKey, JSON.stringify(this._widget.layoutData), StorageScope.PROFILE, StorageTarget.MACHINE);
        if (!this._widget.isClosing) {
          this.closeWidget();
        }
        this._widget = void 0;
      } else {
        this.closeWidget();
      }
    }));
    this._disposables.add(this._widget.onDidSelectReference((event) => {
      const { element, kind } = event;
      if (!element) {
        return;
      }
      switch (kind) {
        case "open":
          if (event.source !== "editor" || !this._configurationService.getValue("editor.stablePeek")) {
            this.openReference(element, false, false);
          }
          break;
        case "side":
          this.openReference(element, true, false);
          break;
        case "goto":
          if (peekMode) {
            this._gotoReference(element, true);
          } else {
            this.openReference(element, false, true);
          }
          break;
      }
    }));
    const requestId = ++this._requestIdPool;
    modelPromise.then((model) => {
      if (requestId !== this._requestIdPool || !this._widget) {
        model.dispose();
        return void 0;
      }
      this._model?.dispose();
      this._model = model;
      return this._widget.setModel(this._model).then(() => {
        if (this._widget && this._model && this._editor.hasModel()) {
          if (!this._model.isEmpty) {
            this._widget.setMetaTitle(nls.localize("metaTitle.N", "{0} ({1})", this._model.title, this._model.references.length));
          } else {
            this._widget.setMetaTitle("");
          }
          const uri = this._editor.getModel().uri;
          const pos = new Position(range.startLineNumber, range.startColumn);
          const selection = this._model.nearestReference(uri, pos);
          if (selection) {
            return this._widget.setSelection(selection).then(() => {
              if (this._widget && this._editor.getOption(EditorOption.peekWidgetDefaultFocus) === "editor") {
                this._widget.focusOnPreviewEditor();
              }
            });
          }
        }
        return void 0;
      });
    }, (error) => {
      this._notificationService.error(error);
    });
  }
  changeFocusBetweenPreviewAndReferences() {
    if (!this._widget) {
      return;
    }
    if (this._widget.isPreviewEditorFocused()) {
      this._widget.focusOnReferenceTree();
    } else {
      this._widget.focusOnPreviewEditor();
    }
  }
  async goToNextOrPreviousReference(fwd) {
    if (!this._editor.hasModel() || !this._model || !this._widget) {
      return;
    }
    const currentPosition = this._widget.position;
    if (!currentPosition) {
      return;
    }
    const source = this._model.nearestReference(this._editor.getModel().uri, currentPosition);
    if (!source) {
      return;
    }
    const target = this._model.nextOrPreviousReference(source, fwd);
    const editorFocus = this._editor.hasTextFocus();
    const previewEditorFocus = this._widget.isPreviewEditorFocused();
    await this._widget.setSelection(target);
    await this._gotoReference(target, false);
    if (editorFocus) {
      this._editor.focus();
    } else if (this._widget && previewEditorFocus) {
      this._widget.focusOnPreviewEditor();
    }
  }
  async revealReference(reference) {
    if (!this._editor.hasModel() || !this._model || !this._widget) {
      return;
    }
    await this._widget.revealReference(reference);
  }
  closeWidget(focusEditor = true) {
    this._widget?.dispose();
    this._model?.dispose();
    this._referenceSearchVisible.reset();
    this._disposables.clear();
    this._widget = void 0;
    this._model = void 0;
    if (focusEditor) {
      this._editor.focus();
    }
    this._requestIdPool += 1;
  }
  _gotoReference(ref, pinned) {
    this._widget?.hide();
    this._ignoreModelChangeEvent = true;
    const range = Range.lift(ref.range).collapseToStart();
    return this._editorService.openCodeEditor({
      resource: ref.uri,
      options: { selection: range, selectionSource: TextEditorSelectionSource.JUMP, pinned }
    }, this._editor).then((openedEditor) => {
      this._ignoreModelChangeEvent = false;
      if (!openedEditor || !this._widget) {
        this.closeWidget();
        return;
      }
      if (this._editor === openedEditor) {
        this._widget.show(range);
        this._widget.focusOnReferenceTree();
      } else {
        const other = ReferencesController.get(openedEditor);
        const model = this._model.clone();
        this.closeWidget();
        openedEditor.focus();
        other?.toggleWidget(
          range,
          createCancelablePromise((_) => Promise.resolve(model)),
          this._peekMode ?? false
        );
      }
    }, (err) => {
      this._ignoreModelChangeEvent = false;
      onUnexpectedError(err);
    });
  }
  openReference(ref, sideBySide, pinned) {
    if (!sideBySide) {
      this.closeWidget();
    }
    const { uri, range } = ref;
    this._editorService.openCodeEditor({
      resource: uri,
      options: { selection: range, selectionSource: TextEditorSelectionSource.JUMP, pinned }
    }, this._editor, sideBySide);
  }
};
ReferencesController.ID = "editor.contrib.referencesController";
ReferencesController = __decorateClass([
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, ICodeEditorService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IConfigurationService)
], ReferencesController);
function withController(accessor, fn) {
  const outerEditor = getOuterEditor(accessor);
  if (!outerEditor) {
    return;
  }
  const controller = ReferencesController.get(outerEditor);
  if (controller) {
    fn(controller);
  }
}
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "togglePeekWidgetFocus",
  weight: KeybindingWeight.EditorContrib,
  primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.F2),
  when: ContextKeyExpr.or(ctxReferenceSearchVisible, PeekContext.inPeekEditor),
  handler(accessor) {
    withController(accessor, (controller) => {
      controller.changeFocusBetweenPreviewAndReferences();
    });
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "goToNextReference",
  weight: KeybindingWeight.EditorContrib - 10,
  primary: KeyCode.F4,
  secondary: [KeyCode.F12],
  when: ContextKeyExpr.or(ctxReferenceSearchVisible, PeekContext.inPeekEditor),
  handler(accessor) {
    withController(accessor, (controller) => {
      controller.goToNextOrPreviousReference(true);
    });
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "goToPreviousReference",
  weight: KeybindingWeight.EditorContrib - 10,
  primary: KeyMod.Shift | KeyCode.F4,
  secondary: [KeyMod.Shift | KeyCode.F12],
  when: ContextKeyExpr.or(ctxReferenceSearchVisible, PeekContext.inPeekEditor),
  handler(accessor) {
    withController(accessor, (controller) => {
      controller.goToNextOrPreviousReference(false);
    });
  }
});
CommandsRegistry.registerCommandAlias("goToNextReferenceFromEmbeddedEditor", "goToNextReference");
CommandsRegistry.registerCommandAlias("goToPreviousReferenceFromEmbeddedEditor", "goToPreviousReference");
CommandsRegistry.registerCommandAlias("closeReferenceSearchEditor", "closeReferenceSearch");
CommandsRegistry.registerCommand(
  "closeReferenceSearch",
  (accessor) => withController(accessor, (controller) => controller.closeWidget())
);
KeybindingsRegistry.registerKeybindingRule({
  id: "closeReferenceSearch",
  weight: KeybindingWeight.EditorContrib - 101,
  primary: KeyCode.Escape,
  secondary: [KeyMod.Shift | KeyCode.Escape],
  when: ContextKeyExpr.and(PeekContext.inPeekEditor, ContextKeyExpr.not("config.editor.stablePeek"))
});
KeybindingsRegistry.registerKeybindingRule({
  id: "closeReferenceSearch",
  weight: KeybindingWeight.WorkbenchContrib + 50,
  primary: KeyCode.Escape,
  secondary: [KeyMod.Shift | KeyCode.Escape],
  when: ContextKeyExpr.and(
    ctxReferenceSearchVisible,
    ContextKeyExpr.not("config.editor.stablePeek"),
    ContextKeyExpr.or(
      EditorContextKeys.editorTextFocus,
      InputFocusedContext.negate()
    )
  )
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "revealReference",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.Enter,
  mac: {
    primary: KeyCode.Enter,
    secondary: [KeyMod.CtrlCmd | KeyCode.DownArrow]
  },
  when: ContextKeyExpr.and(ctxReferenceSearchVisible, WorkbenchListFocusContextKey, WorkbenchTreeElementCanCollapse.negate(), WorkbenchTreeElementCanExpand.negate()),
  handler(accessor) {
    const listService = accessor.get(IListService);
    const focus = listService.lastFocusedList?.getFocus();
    if (Array.isArray(focus) && focus[0] instanceof OneReference) {
      withController(accessor, (controller) => controller.revealReference(focus[0]));
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "openReferenceToSide",
  weight: KeybindingWeight.EditorContrib,
  primary: KeyMod.CtrlCmd | KeyCode.Enter,
  mac: {
    primary: KeyMod.WinCtrl | KeyCode.Enter
  },
  when: ContextKeyExpr.and(ctxReferenceSearchVisible, WorkbenchListFocusContextKey, WorkbenchTreeElementCanCollapse.negate(), WorkbenchTreeElementCanExpand.negate()),
  handler(accessor) {
    const listService = accessor.get(IListService);
    const focus = listService.lastFocusedList?.getFocus();
    if (Array.isArray(focus) && focus[0] instanceof OneReference) {
      withController(accessor, (controller) => controller.openReference(focus[0], true, true));
    }
  }
});
CommandsRegistry.registerCommand("openReference", (accessor) => {
  const listService = accessor.get(IListService);
  const focus = listService.lastFocusedList?.getFocus();
  if (Array.isArray(focus) && focus[0] instanceof OneReference) {
    withController(accessor, (controller) => controller.openReference(focus[0], false, true));
  }
});
export {
  ReferencesController,
  ctxReferenceSearchVisible
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9nb3RvU3ltYm9sL2Jyb3dzZXIvcGVlay9yZWZlcmVuY2VzQ29udHJvbGxlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGFibGVQcm9taXNlLCBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEtleUNob3JkLCBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElFZGl0b3JDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IExvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBQZWVrQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uL3BlZWtWaWV3L2Jyb3dzZXIvcGVla1ZpZXcuanMnO1xuaW1wb3J0IHsgZ2V0T3V0ZXJFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2VtYmVkZGVkQ29kZUVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSwgUmF3Q29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgVGV4dEVkaXRvclNlbGVjdGlvblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ3NSZWdpc3RyeSwgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUxpc3RTZXJ2aWNlLCBXb3JrYmVuY2hMaXN0Rm9jdXNDb250ZXh0S2V5LCBXb3JrYmVuY2hUcmVlRWxlbWVudENhbkNvbGxhcHNlLCBXb3JrYmVuY2hUcmVlRWxlbWVudENhbkV4cGFuZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBPbmVSZWZlcmVuY2UsIFJlZmVyZW5jZXNNb2RlbCB9IGZyb20gJy4uL3JlZmVyZW5jZXNNb2RlbC5qcyc7XG5pbXBvcnQgeyBMYXlvdXREYXRhLCBSZWZlcmVuY2VXaWRnZXQgfSBmcm9tICcuL3JlZmVyZW5jZXNXaWRnZXQuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSW5wdXRGb2N1c2VkQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXlzLmpzJztcblxuZXhwb3J0IGNvbnN0IGN0eFJlZmVyZW5jZVNlYXJjaFZpc2libGUgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPigncmVmZXJlbmNlU2VhcmNoVmlzaWJsZScsIGZhbHNlLCBubHMubG9jYWxpemUoJ3JlZmVyZW5jZVNlYXJjaFZpc2libGUnLCBcIldoZXRoZXIgcmVmZXJlbmNlIHBlZWsgaXMgdmlzaWJsZSwgbGlrZSAnUGVlayBSZWZlcmVuY2VzJyBvciAnUGVlayBEZWZpbml0aW9uJ1wiKSk7XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBSZWZlcmVuY2VzQ29udHJvbGxlciBpbXBsZW1lbnRzIElFZGl0b3JDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuY29udHJpYi5yZWZlcmVuY2VzQ29udHJvbGxlcic7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSBfd2lkZ2V0PzogUmVmZXJlbmNlV2lkZ2V0O1xuXHRwcml2YXRlIF9tb2RlbD86IFJlZmVyZW5jZXNNb2RlbDtcblx0cHJpdmF0ZSBfcGVla01vZGU/OiBib29sZWFuO1xuXHRwcml2YXRlIF9yZXF1ZXN0SWRQb29sID0gMDtcblx0cHJpdmF0ZSBfaWdub3JlTW9kZWxDaGFuZ2VFdmVudCA9IGZhbHNlO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlZmVyZW5jZVNlYXJjaFZpc2libGU6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHN0YXRpYyBnZXQoZWRpdG9yOiBJQ29kZUVkaXRvcik6IFJlZmVyZW5jZXNDb250cm9sbGVyIHwgbnVsbCB7XG5cdFx0cmV0dXJuIGVkaXRvci5nZXRDb250cmlidXRpb248UmVmZXJlbmNlc0NvbnRyb2xsZXI+KFJlZmVyZW5jZXNDb250cm9sbGVyLklEKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RlZmF1bHRUcmVlS2V5Ym9hcmRTdXBwb3J0OiBib29sZWFuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9ub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cblx0XHR0aGlzLl9yZWZlcmVuY2VTZWFyY2hWaXNpYmxlID0gY3R4UmVmZXJlbmNlU2VhcmNoVmlzaWJsZS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWZlcmVuY2VTZWFyY2hWaXNpYmxlLnJlc2V0KCk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3dpZGdldD8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX21vZGVsPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fd2lkZ2V0ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX21vZGVsID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0dG9nZ2xlV2lkZ2V0KHJhbmdlOiBSYW5nZSwgbW9kZWxQcm9taXNlOiBDYW5jZWxhYmxlUHJvbWlzZTxSZWZlcmVuY2VzTW9kZWw+LCBwZWVrTW9kZTogYm9vbGVhbik6IHZvaWQge1xuXG5cdFx0Ly8gY2xvc2UgY3VycmVudCB3aWRnZXQgYW5kIHJldHVybiBlYXJseSBpcyBwb3NpdGlvbiBkaWRuJ3QgY2hhbmdlXG5cdFx0bGV0IHdpZGdldFBvc2l0aW9uOiBQb3NpdGlvbiB8IHVuZGVmaW5lZDtcblx0XHRpZiAodGhpcy5fd2lkZ2V0KSB7XG5cdFx0XHR3aWRnZXRQb3NpdGlvbiA9IHRoaXMuX3dpZGdldC5wb3NpdGlvbjtcblx0XHR9XG5cdFx0dGhpcy5jbG9zZVdpZGdldCgpO1xuXHRcdGlmICghIXdpZGdldFBvc2l0aW9uICYmIHJhbmdlLmNvbnRhaW5zUG9zaXRpb24od2lkZ2V0UG9zaXRpb24pKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fcGVla01vZGUgPSBwZWVrTW9kZTtcblx0XHR0aGlzLl9yZWZlcmVuY2VTZWFyY2hWaXNpYmxlLnNldCh0cnVlKTtcblxuXHRcdC8vIGNsb3NlIHRoZSB3aWRnZXQgb24gbW9kZWwvbW9kZSBjaGFuZ2VzXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2UoKCkgPT4geyB0aGlzLmNsb3NlV2lkZ2V0KCk7IH0pKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWwoKCkgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLl9pZ25vcmVNb2RlbENoYW5nZUV2ZW50KSB7XG5cdFx0XHRcdHRoaXMuY2xvc2VXaWRnZXQoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0Y29uc3Qgc3RvcmFnZUtleSA9ICdwZWVrVmlld0xheW91dCc7XG5cdFx0Y29uc3QgZGF0YSA9IExheW91dERhdGEuZnJvbUpTT04odGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0KHN0b3JhZ2VLZXksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCAne30nKSk7XG5cdFx0dGhpcy5fd2lkZ2V0ID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVmZXJlbmNlV2lkZ2V0LCB0aGlzLl9lZGl0b3IsIHRoaXMuX2RlZmF1bHRUcmVlS2V5Ym9hcmRTdXBwb3J0LCBkYXRhKTtcblx0XHR0aGlzLl93aWRnZXQuc2V0VGl0bGUobmxzLmxvY2FsaXplKCdsYWJlbExvYWRpbmcnLCBcIkxvYWRpbmcuLi5cIikpO1xuXHRcdHRoaXMuX3dpZGdldC5zaG93KHJhbmdlKTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl93aWRnZXQub25EaWRDbG9zZSgoKSA9PiB7XG5cdFx0XHRtb2RlbFByb21pc2UuY2FuY2VsKCk7XG5cdFx0XHRpZiAodGhpcy5fd2lkZ2V0KSB7XG5cdFx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKHN0b3JhZ2VLZXksIEpTT04uc3RyaW5naWZ5KHRoaXMuX3dpZGdldC5sYXlvdXREYXRhKSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0XHRcdGlmICghdGhpcy5fd2lkZ2V0LmlzQ2xvc2luZykge1xuXHRcdFx0XHRcdC8vIHRvIHByZXZlbnQgY2FsbGluZyB0aGlzIHRvbyBtYW55IHRpbWVzLCBjaGVjayB3aGV0aGVyIGl0IHdhcyBhbHJlYWR5IGNsb3NpbmcuXG5cdFx0XHRcdFx0dGhpcy5jbG9zZVdpZGdldCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3dpZGdldCA9IHVuZGVmaW5lZDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuY2xvc2VXaWRnZXQoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fd2lkZ2V0Lm9uRGlkU2VsZWN0UmVmZXJlbmNlKGV2ZW50ID0+IHtcblx0XHRcdGNvbnN0IHsgZWxlbWVudCwga2luZCB9ID0gZXZlbnQ7XG5cdFx0XHRpZiAoIWVsZW1lbnQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c3dpdGNoIChraW5kKSB7XG5cdFx0XHRcdGNhc2UgJ29wZW4nOlxuXHRcdFx0XHRcdGlmIChldmVudC5zb3VyY2UgIT09ICdlZGl0b3InIHx8ICF0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnZWRpdG9yLnN0YWJsZVBlZWsnKSkge1xuXHRcdFx0XHRcdFx0Ly8gd2hlbiBzdGFibGUgcGVlayBpcyBjb25maWd1cmVkIHdlIGRvbid0IGNsb3NlXG5cdFx0XHRcdFx0XHQvLyB0aGUgcGVlayB3aW5kb3cgb24gc2VsZWN0aW5nIHRoZSBlZGl0b3Jcblx0XHRcdFx0XHRcdHRoaXMub3BlblJlZmVyZW5jZShlbGVtZW50LCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnc2lkZSc6XG5cdFx0XHRcdFx0dGhpcy5vcGVuUmVmZXJlbmNlKGVsZW1lbnQsIHRydWUsIGZhbHNlKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnZ290byc6XG5cdFx0XHRcdFx0aWYgKHBlZWtNb2RlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9nb3RvUmVmZXJlbmNlKGVsZW1lbnQsIHRydWUpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLm9wZW5SZWZlcmVuY2UoZWxlbWVudCwgZmFsc2UsIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCByZXF1ZXN0SWQgPSArK3RoaXMuX3JlcXVlc3RJZFBvb2w7XG5cblx0XHRtb2RlbFByb21pc2UudGhlbihtb2RlbCA9PiB7XG5cblx0XHRcdC8vIHN0aWxsIGN1cnJlbnQgcmVxdWVzdD8gd2lkZ2V0IHN0aWxsIG9wZW4/XG5cdFx0XHRpZiAocmVxdWVzdElkICE9PSB0aGlzLl9yZXF1ZXN0SWRQb29sIHx8ICF0aGlzLl93aWRnZXQpIHtcblx0XHRcdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9tb2RlbD8uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fbW9kZWwgPSBtb2RlbDtcblxuXHRcdFx0Ly8gc2hvdyB3aWRnZXRcblx0XHRcdHJldHVybiB0aGlzLl93aWRnZXQuc2V0TW9kZWwodGhpcy5fbW9kZWwpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5fd2lkZ2V0ICYmIHRoaXMuX21vZGVsICYmIHRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7IC8vIG1pZ2h0IGhhdmUgYmVlbiBjbG9zZWRcblxuXHRcdFx0XHRcdC8vIHNldCB0aXRsZVxuXHRcdFx0XHRcdGlmICghdGhpcy5fbW9kZWwuaXNFbXB0eSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fd2lkZ2V0LnNldE1ldGFUaXRsZShubHMubG9jYWxpemUoJ21ldGFUaXRsZS5OJywgXCJ7MH0gKHsxfSlcIiwgdGhpcy5fbW9kZWwudGl0bGUsIHRoaXMuX21vZGVsLnJlZmVyZW5jZXMubGVuZ3RoKSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuX3dpZGdldC5zZXRNZXRhVGl0bGUoJycpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIHNldCAnYmVzdCcgc2VsZWN0aW9uXG5cdFx0XHRcdFx0Y29uc3QgdXJpID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkudXJpO1xuXHRcdFx0XHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbihyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uKTtcblx0XHRcdFx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLl9tb2RlbC5uZWFyZXN0UmVmZXJlbmNlKHVyaSwgcG9zKTtcblx0XHRcdFx0XHRpZiAoc2VsZWN0aW9uKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fd2lkZ2V0LnNldFNlbGVjdGlvbihzZWxlY3Rpb24pLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRpZiAodGhpcy5fd2lkZ2V0ICYmIHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnBlZWtXaWRnZXREZWZhdWx0Rm9jdXMpID09PSAnZWRpdG9yJykge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuX3dpZGdldC5mb2N1c09uUHJldmlld0VkaXRvcigpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0pO1xuXG5cdFx0fSwgZXJyb3IgPT4ge1xuXHRcdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0fSk7XG5cdH1cblxuXHRjaGFuZ2VGb2N1c0JldHdlZW5QcmV2aWV3QW5kUmVmZXJlbmNlcygpIHtcblx0XHRpZiAoIXRoaXMuX3dpZGdldCkge1xuXHRcdFx0Ly8gY2FuIGJlIGNhbGxlZCB3aGlsZSBzdGlsbCByZXNvbHZpbmcuLi5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX3dpZGdldC5pc1ByZXZpZXdFZGl0b3JGb2N1c2VkKCkpIHtcblx0XHRcdHRoaXMuX3dpZGdldC5mb2N1c09uUmVmZXJlbmNlVHJlZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl93aWRnZXQuZm9jdXNPblByZXZpZXdFZGl0b3IoKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBnb1RvTmV4dE9yUHJldmlvdXNSZWZlcmVuY2UoZndkOiBib29sZWFuKSB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSB8fCAhdGhpcy5fbW9kZWwgfHwgIXRoaXMuX3dpZGdldCkge1xuXHRcdFx0Ly8gY2FuIGJlIGNhbGxlZCB3aGlsZSBzdGlsbCByZXNvbHZpbmcuLi5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgY3VycmVudFBvc2l0aW9uID0gdGhpcy5fd2lkZ2V0LnBvc2l0aW9uO1xuXHRcdGlmICghY3VycmVudFBvc2l0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHNvdXJjZSA9IHRoaXMuX21vZGVsLm5lYXJlc3RSZWZlcmVuY2UodGhpcy5fZWRpdG9yLmdldE1vZGVsKCkudXJpLCBjdXJyZW50UG9zaXRpb24pO1xuXHRcdGlmICghc291cmNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHRhcmdldCA9IHRoaXMuX21vZGVsLm5leHRPclByZXZpb3VzUmVmZXJlbmNlKHNvdXJjZSwgZndkKTtcblx0XHRjb25zdCBlZGl0b3JGb2N1cyA9IHRoaXMuX2VkaXRvci5oYXNUZXh0Rm9jdXMoKTtcblx0XHRjb25zdCBwcmV2aWV3RWRpdG9yRm9jdXMgPSB0aGlzLl93aWRnZXQuaXNQcmV2aWV3RWRpdG9yRm9jdXNlZCgpO1xuXHRcdGF3YWl0IHRoaXMuX3dpZGdldC5zZXRTZWxlY3Rpb24odGFyZ2V0KTtcblx0XHRhd2FpdCB0aGlzLl9nb3RvUmVmZXJlbmNlKHRhcmdldCwgZmFsc2UpO1xuXHRcdGlmIChlZGl0b3JGb2N1cykge1xuXHRcdFx0dGhpcy5fZWRpdG9yLmZvY3VzKCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl93aWRnZXQgJiYgcHJldmlld0VkaXRvckZvY3VzKSB7XG5cdFx0XHR0aGlzLl93aWRnZXQuZm9jdXNPblByZXZpZXdFZGl0b3IoKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyByZXZlYWxSZWZlcmVuY2UocmVmZXJlbmNlOiBPbmVSZWZlcmVuY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpIHx8ICF0aGlzLl9tb2RlbCB8fCAhdGhpcy5fd2lkZ2V0KSB7XG5cdFx0XHQvLyBjYW4gYmUgY2FsbGVkIHdoaWxlIHN0aWxsIHJlc29sdmluZy4uLlxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuX3dpZGdldC5yZXZlYWxSZWZlcmVuY2UocmVmZXJlbmNlKTtcblx0fVxuXG5cdGNsb3NlV2lkZ2V0KGZvY3VzRWRpdG9yID0gdHJ1ZSk6IHZvaWQge1xuXHRcdHRoaXMuX3dpZGdldD8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX21vZGVsPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fcmVmZXJlbmNlU2VhcmNoVmlzaWJsZS5yZXNldCgpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5fd2lkZ2V0ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX21vZGVsID0gdW5kZWZpbmVkO1xuXHRcdGlmIChmb2N1c0VkaXRvcikge1xuXHRcdFx0dGhpcy5fZWRpdG9yLmZvY3VzKCk7XG5cdFx0fVxuXHRcdHRoaXMuX3JlcXVlc3RJZFBvb2wgKz0gMTsgLy8gQ2FuY2VsIHBlbmRpbmcgcmVxdWVzdHNcblx0fVxuXG5cdHByaXZhdGUgX2dvdG9SZWZlcmVuY2UocmVmOiBMb2NhdGlvbiwgcGlubmVkOiBib29sZWFuKTogUHJvbWlzZTxhbnk+IHtcblx0XHR0aGlzLl93aWRnZXQ/LmhpZGUoKTtcblxuXHRcdHRoaXMuX2lnbm9yZU1vZGVsQ2hhbmdlRXZlbnQgPSB0cnVlO1xuXHRcdGNvbnN0IHJhbmdlID0gUmFuZ2UubGlmdChyZWYucmFuZ2UpLmNvbGxhcHNlVG9TdGFydCgpO1xuXG5cdFx0cmV0dXJuIHRoaXMuX2VkaXRvclNlcnZpY2Uub3BlbkNvZGVFZGl0b3Ioe1xuXHRcdFx0cmVzb3VyY2U6IHJlZi51cmksXG5cdFx0XHRvcHRpb25zOiB7IHNlbGVjdGlvbjogcmFuZ2UsIHNlbGVjdGlvblNvdXJjZTogVGV4dEVkaXRvclNlbGVjdGlvblNvdXJjZS5KVU1QLCBwaW5uZWQgfVxuXHRcdH0sIHRoaXMuX2VkaXRvcikudGhlbihvcGVuZWRFZGl0b3IgPT4ge1xuXHRcdFx0dGhpcy5faWdub3JlTW9kZWxDaGFuZ2VFdmVudCA9IGZhbHNlO1xuXG5cdFx0XHRpZiAoIW9wZW5lZEVkaXRvciB8fCAhdGhpcy5fd2lkZ2V0KSB7XG5cdFx0XHRcdC8vIHNvbWV0aGluZyB3ZW50IHdyb25nLi4uXG5cdFx0XHRcdHRoaXMuY2xvc2VXaWRnZXQoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5fZWRpdG9yID09PSBvcGVuZWRFZGl0b3IpIHtcblx0XHRcdFx0Ly9cblx0XHRcdFx0dGhpcy5fd2lkZ2V0LnNob3cocmFuZ2UpO1xuXHRcdFx0XHR0aGlzLl93aWRnZXQuZm9jdXNPblJlZmVyZW5jZVRyZWUoKTtcblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gd2Ugb3BlbmVkIGEgZGlmZmVyZW50IGVkaXRvciBpbnN0YW5jZSB3aGljaCBtZWFucyBhIGRpZmZlcmVudCBjb250cm9sbGVyIGluc3RhbmNlLlxuXHRcdFx0XHQvLyB0aGVyZWZvcmUgd2Ugc3RvcCB3aXRoIHRoaXMgY29udHJvbGxlciBhbmQgY29udGludWUgd2l0aCB0aGUgb3RoZXJcblx0XHRcdFx0Y29uc3Qgb3RoZXIgPSBSZWZlcmVuY2VzQ29udHJvbGxlci5nZXQob3BlbmVkRWRpdG9yKTtcblx0XHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9tb2RlbCEuY2xvbmUoKTtcblxuXHRcdFx0XHR0aGlzLmNsb3NlV2lkZ2V0KCk7XG5cdFx0XHRcdG9wZW5lZEVkaXRvci5mb2N1cygpO1xuXG5cdFx0XHRcdG90aGVyPy50b2dnbGVXaWRnZXQoXG5cdFx0XHRcdFx0cmFuZ2UsXG5cdFx0XHRcdFx0Y3JlYXRlQ2FuY2VsYWJsZVByb21pc2UoXyA9PiBQcm9taXNlLnJlc29sdmUobW9kZWwpKSxcblx0XHRcdFx0XHR0aGlzLl9wZWVrTW9kZSA/PyBmYWxzZVxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXG5cdFx0fSwgKGVycikgPT4ge1xuXHRcdFx0dGhpcy5faWdub3JlTW9kZWxDaGFuZ2VFdmVudCA9IGZhbHNlO1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyKTtcblx0XHR9KTtcblx0fVxuXG5cdG9wZW5SZWZlcmVuY2UocmVmOiBMb2NhdGlvbiwgc2lkZUJ5U2lkZTogYm9vbGVhbiwgcGlubmVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Ly8gY2xlYXIgc3RhZ2Vcblx0XHRpZiAoIXNpZGVCeVNpZGUpIHtcblx0XHRcdHRoaXMuY2xvc2VXaWRnZXQoKTtcblx0XHR9XG5cblx0XHRjb25zdCB7IHVyaSwgcmFuZ2UgfSA9IHJlZjtcblx0XHR0aGlzLl9lZGl0b3JTZXJ2aWNlLm9wZW5Db2RlRWRpdG9yKHtcblx0XHRcdHJlc291cmNlOiB1cmksXG5cdFx0XHRvcHRpb25zOiB7IHNlbGVjdGlvbjogcmFuZ2UsIHNlbGVjdGlvblNvdXJjZTogVGV4dEVkaXRvclNlbGVjdGlvblNvdXJjZS5KVU1QLCBwaW5uZWQgfVxuXHRcdH0sIHRoaXMuX2VkaXRvciwgc2lkZUJ5U2lkZSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gd2l0aENvbnRyb2xsZXIoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGZuOiAoY29udHJvbGxlcjogUmVmZXJlbmNlc0NvbnRyb2xsZXIpID0+IHZvaWQpOiB2b2lkIHtcblx0Y29uc3Qgb3V0ZXJFZGl0b3IgPSBnZXRPdXRlckVkaXRvcihhY2Nlc3Nvcik7XG5cdGlmICghb3V0ZXJFZGl0b3IpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0Y29uc3QgY29udHJvbGxlciA9IFJlZmVyZW5jZXNDb250cm9sbGVyLmdldChvdXRlckVkaXRvcik7XG5cdGlmIChjb250cm9sbGVyKSB7XG5cdFx0Zm4oY29udHJvbGxlcik7XG5cdH1cbn1cblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiAndG9nZ2xlUGVla1dpZGdldEZvY3VzJyxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIsXG5cdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlDb2RlLkYyKSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoY3R4UmVmZXJlbmNlU2VhcmNoVmlzaWJsZSwgUGVla0NvbnRleHQuaW5QZWVrRWRpdG9yKSxcblx0aGFuZGxlcihhY2Nlc3Nvcikge1xuXHRcdHdpdGhDb250cm9sbGVyKGFjY2Vzc29yLCBjb250cm9sbGVyID0+IHtcblx0XHRcdGNvbnRyb2xsZXIuY2hhbmdlRm9jdXNCZXR3ZWVuUHJldmlld0FuZFJlZmVyZW5jZXMoKTtcblx0XHR9KTtcblx0fVxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ2dvVG9OZXh0UmVmZXJlbmNlJyxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIgLSAxMCxcblx0cHJpbWFyeTogS2V5Q29kZS5GNCxcblx0c2Vjb25kYXJ5OiBbS2V5Q29kZS5GMTJdLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihjdHhSZWZlcmVuY2VTZWFyY2hWaXNpYmxlLCBQZWVrQ29udGV4dC5pblBlZWtFZGl0b3IpLFxuXHRoYW5kbGVyKGFjY2Vzc29yKSB7XG5cdFx0d2l0aENvbnRyb2xsZXIoYWNjZXNzb3IsIGNvbnRyb2xsZXIgPT4ge1xuXHRcdFx0Y29udHJvbGxlci5nb1RvTmV4dE9yUHJldmlvdXNSZWZlcmVuY2UodHJ1ZSk7XG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6ICdnb1RvUHJldmlvdXNSZWZlcmVuY2UnLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYiAtIDEwLFxuXHRwcmltYXJ5OiBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkY0LFxuXHRzZWNvbmRhcnk6IFtLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkYxMl0sXG5cdHdoZW46IENvbnRleHRLZXlFeHByLm9yKGN0eFJlZmVyZW5jZVNlYXJjaFZpc2libGUsIFBlZWtDb250ZXh0LmluUGVla0VkaXRvciksXG5cdGhhbmRsZXIoYWNjZXNzb3IpIHtcblx0XHR3aXRoQ29udHJvbGxlcihhY2Nlc3NvciwgY29udHJvbGxlciA9PiB7XG5cdFx0XHRjb250cm9sbGVyLmdvVG9OZXh0T3JQcmV2aW91c1JlZmVyZW5jZShmYWxzZSk7XG5cdFx0fSk7XG5cdH1cbn0pO1xuXG4vLyBjb21tYW5kcyB0aGF0IGFyZW4ndCBuZWVkZWQgYW55bW9yZSBiZWNhdXNlIHRoZXJlIGlzIG5vdyBDb250ZXh0S2V5RXhwci5PUlxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbGlhcygnZ29Ub05leHRSZWZlcmVuY2VGcm9tRW1iZWRkZWRFZGl0b3InLCAnZ29Ub05leHRSZWZlcmVuY2UnKTtcbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQWxpYXMoJ2dvVG9QcmV2aW91c1JlZmVyZW5jZUZyb21FbWJlZGRlZEVkaXRvcicsICdnb1RvUHJldmlvdXNSZWZlcmVuY2UnKTtcblxuLy8gY2xvc2VcbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQWxpYXMoJ2Nsb3NlUmVmZXJlbmNlU2VhcmNoRWRpdG9yJywgJ2Nsb3NlUmVmZXJlbmNlU2VhcmNoJyk7XG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZChcblx0J2Nsb3NlUmVmZXJlbmNlU2VhcmNoJyxcblx0YWNjZXNzb3IgPT4gd2l0aENvbnRyb2xsZXIoYWNjZXNzb3IsIGNvbnRyb2xsZXIgPT4gY29udHJvbGxlci5jbG9zZVdpZGdldCgpKVxuKTtcbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiAnY2xvc2VSZWZlcmVuY2VTZWFyY2gnLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYiAtIDEwMSxcblx0cHJpbWFyeTogS2V5Q29kZS5Fc2NhcGUsXG5cdHNlY29uZGFyeTogW0tleU1vZC5TaGlmdCB8IEtleUNvZGUuRXNjYXBlXSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFBlZWtDb250ZXh0LmluUGVla0VkaXRvciwgQ29udGV4dEtleUV4cHIubm90KCdjb25maWcuZWRpdG9yLnN0YWJsZVBlZWsnKSlcbn0pO1xuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlcktleWJpbmRpbmdSdWxlKHtcblx0aWQ6ICdjbG9zZVJlZmVyZW5jZVNlYXJjaCcsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgNTAsXG5cdHByaW1hcnk6IEtleUNvZGUuRXNjYXBlLFxuXHRzZWNvbmRhcnk6IFtLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkVzY2FwZV0sXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRjdHhSZWZlcmVuY2VTZWFyY2hWaXNpYmxlLFxuXHRcdENvbnRleHRLZXlFeHByLm5vdCgnY29uZmlnLmVkaXRvci5zdGFibGVQZWVrJyksXG5cdFx0Q29udGV4dEtleUV4cHIub3IoXG5cdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRJbnB1dEZvY3VzZWRDb250ZXh0Lm5lZ2F0ZSgpXG5cdFx0KVxuXHQpXG59KTtcblxuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6ICdyZXZlYWxSZWZlcmVuY2UnLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0cHJpbWFyeTogS2V5Q29kZS5FbnRlcixcblx0bWFjOiB7XG5cdFx0cHJpbWFyeTogS2V5Q29kZS5FbnRlcixcblx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93XVxuXHR9LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoY3R4UmVmZXJlbmNlU2VhcmNoVmlzaWJsZSwgV29ya2JlbmNoTGlzdEZvY3VzQ29udGV4dEtleSwgV29ya2JlbmNoVHJlZUVsZW1lbnRDYW5Db2xsYXBzZS5uZWdhdGUoKSwgV29ya2JlbmNoVHJlZUVsZW1lbnRDYW5FeHBhbmQubmVnYXRlKCkpLFxuXHRoYW5kbGVyKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3QgbGlzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKTtcblx0XHRjb25zdCBmb2N1cyA9IDxhbnlbXT5saXN0U2VydmljZS5sYXN0Rm9jdXNlZExpc3Q/LmdldEZvY3VzKCk7XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoZm9jdXMpICYmIGZvY3VzWzBdIGluc3RhbmNlb2YgT25lUmVmZXJlbmNlKSB7XG5cdFx0XHR3aXRoQ29udHJvbGxlcihhY2Nlc3NvciwgY29udHJvbGxlciA9PiBjb250cm9sbGVyLnJldmVhbFJlZmVyZW5jZShmb2N1c1swXSkpO1xuXHRcdH1cblx0fVxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ29wZW5SZWZlcmVuY2VUb1NpZGUnLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYixcblx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVudGVyLFxuXHRtYWM6IHtcblx0XHRwcmltYXJ5OiBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuRW50ZXJcblx0fSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKGN0eFJlZmVyZW5jZVNlYXJjaFZpc2libGUsIFdvcmtiZW5jaExpc3RGb2N1c0NvbnRleHRLZXksIFdvcmtiZW5jaFRyZWVFbGVtZW50Q2FuQ29sbGFwc2UubmVnYXRlKCksIFdvcmtiZW5jaFRyZWVFbGVtZW50Q2FuRXhwYW5kLm5lZ2F0ZSgpKSxcblx0aGFuZGxlcihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGxpc3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSk7XG5cdFx0Y29uc3QgZm9jdXMgPSA8YW55W10+bGlzdFNlcnZpY2UubGFzdEZvY3VzZWRMaXN0Py5nZXRGb2N1cygpO1xuXHRcdGlmIChBcnJheS5pc0FycmF5KGZvY3VzKSAmJiBmb2N1c1swXSBpbnN0YW5jZW9mIE9uZVJlZmVyZW5jZSkge1xuXHRcdFx0d2l0aENvbnRyb2xsZXIoYWNjZXNzb3IsIGNvbnRyb2xsZXIgPT4gY29udHJvbGxlci5vcGVuUmVmZXJlbmNlKGZvY3VzWzBdLCB0cnVlLCB0cnVlKSk7XG5cdFx0fVxuXHR9XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ29wZW5SZWZlcmVuY2UnLCAoYWNjZXNzb3IpID0+IHtcblx0Y29uc3QgbGlzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKTtcblx0Y29uc3QgZm9jdXMgPSA8YW55W10+bGlzdFNlcnZpY2UubGFzdEZvY3VzZWRMaXN0Py5nZXRGb2N1cygpO1xuXHRpZiAoQXJyYXkuaXNBcnJheShmb2N1cykgJiYgZm9jdXNbMF0gaW5zdGFuY2VvZiBPbmVSZWZlcmVuY2UpIHtcblx0XHR3aXRoQ29udHJvbGxlcihhY2Nlc3NvciwgY29udHJvbGxlciA9PiBjb250cm9sbGVyLm9wZW5SZWZlcmVuY2UoZm9jdXNbMF0sIGZhbHNlLCB0cnVlKSk7XG5cdH1cbn0pO1xuIl0sCiAgIm1h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
