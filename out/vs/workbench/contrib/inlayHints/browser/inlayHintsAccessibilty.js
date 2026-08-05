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
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { EditorAction2, EditorContributionInstantiation, registerEditorContribution } from "../../../../editor/browser/editorExtensions.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { asCommandLink } from "../../../../editor/contrib/inlayHints/browser/inlayHints.js";
import { InlayHintsController } from "../../../../editor/contrib/inlayHints/browser/inlayHintsController.js";
import { localize, localize2 } from "../../../../nls.js";
import { registerAction2 } from "../../../../platform/actions/common/actions.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { Link } from "../../../../platform/opener/browser/link.js";
let InlayHintsAccessibility = class {
  constructor(_editor, contextKeyService, _accessibilitySignalService, _instaService) {
    this._editor = _editor;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._instaService = _instaService;
    this._sessionDispoosables = new DisposableStore();
    this._ariaElement = document.createElement("span");
    this._ariaElement.style.position = "fixed";
    this._ariaElement.className = "inlayhint-accessibility-element";
    this._ariaElement.tabIndex = 0;
    this._ariaElement.setAttribute("aria-description", localize("description", "Code with Inlay Hint Information"));
    this._ctxIsReading = InlayHintsAccessibility.IsReading.bindTo(contextKeyService);
  }
  static get(editor) {
    return editor.getContribution(InlayHintsAccessibility.ID) ?? void 0;
  }
  dispose() {
    this._sessionDispoosables.dispose();
    this._ctxIsReading.reset();
    this._ariaElement.remove();
  }
  _reset() {
    dom.clearNode(this._ariaElement);
    this._sessionDispoosables.clear();
    this._ctxIsReading.reset();
  }
  async _read(line, hints) {
    this._sessionDispoosables.clear();
    if (!this._ariaElement.isConnected) {
      this._editor.getDomNode()?.appendChild(this._ariaElement);
    }
    if (!this._editor.hasModel() || !this._ariaElement.isConnected) {
      this._ctxIsReading.set(false);
      return;
    }
    const cts = new CancellationTokenSource();
    this._sessionDispoosables.add(cts);
    for (const hint of hints) {
      await hint.resolve(cts.token);
    }
    if (cts.token.isCancellationRequested) {
      return;
    }
    const model = this._editor.getModel();
    const newChildren = [];
    let start = 0;
    let tooLongToRead = false;
    for (const item of hints) {
      const part = model.getValueInRange({ startLineNumber: line, startColumn: start + 1, endLineNumber: line, endColumn: item.hint.position.column });
      if (part.length > 0) {
        newChildren.push(part);
        start = item.hint.position.column - 1;
      }
      if (start > 750) {
        newChildren.push("\u2026");
        tooLongToRead = true;
        break;
      }
      const em = document.createElement("em");
      const { label } = item.hint;
      if (typeof label === "string") {
        em.innerText = label;
      } else {
        for (const part2 of label) {
          if (part2.command) {
            const link = this._instaService.createInstance(
              Link,
              em,
              { href: asCommandLink(part2.command), label: part2.label, title: part2.command.title },
              void 0
            );
            this._sessionDispoosables.add(link);
          } else {
            em.innerText += part2.label;
          }
        }
      }
      newChildren.push(em);
    }
    if (!tooLongToRead) {
      newChildren.push(model.getValueInRange({ startLineNumber: line, startColumn: start + 1, endLineNumber: line, endColumn: Number.MAX_SAFE_INTEGER }));
    }
    dom.reset(this._ariaElement, ...newChildren);
    this._ariaElement.focus();
    this._ctxIsReading.set(true);
    this._sessionDispoosables.add(dom.addDisposableListener(this._ariaElement, "focusout", () => {
      this._reset();
    }));
  }
  startInlayHintsReading() {
    if (!this._editor.hasModel()) {
      return;
    }
    const line = this._editor.getPosition().lineNumber;
    const hints = InlayHintsController.get(this._editor)?.getInlayHintsForLine(line);
    if (!hints || hints.length === 0) {
      this._accessibilitySignalService.playSignal(AccessibilitySignal.noInlayHints);
    } else {
      this._read(line, hints);
    }
  }
  stopInlayHintsReading() {
    this._reset();
    this._editor.focus();
  }
};
InlayHintsAccessibility.IsReading = new RawContextKey("isReadingLineWithInlayHints", false, { type: "boolean", description: localize("isReadingLineWithInlayHints", "Whether the current line and its inlay hints are currently focused") });
InlayHintsAccessibility.ID = "editor.contrib.InlayHintsAccessibility";
InlayHintsAccessibility = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IAccessibilitySignalService),
  __decorateParam(3, IInstantiationService)
], InlayHintsAccessibility);
registerAction2(class StartReadHints extends EditorAction2 {
  constructor() {
    super({
      id: "inlayHints.startReadingLineWithHint",
      title: localize2("read.title", "Read Line with Inline Hints"),
      precondition: EditorContextKeys.hasInlayHintsProvider,
      f1: true
    });
  }
  runEditorCommand(_accessor, editor) {
    const ctrl = InlayHintsAccessibility.get(editor);
    ctrl?.startInlayHintsReading();
  }
});
registerAction2(class StopReadHints extends EditorAction2 {
  constructor() {
    super({
      id: "inlayHints.stopReadingLineWithHint",
      title: localize2("stop.title", "Stop Inlay Hints Reading"),
      precondition: InlayHintsAccessibility.IsReading,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.EditorContrib,
        primary: KeyCode.Escape
      }
    });
  }
  runEditorCommand(_accessor, editor) {
    const ctrl = InlayHintsAccessibility.get(editor);
    ctrl?.stopInlayHintsReading();
  }
});
registerEditorContribution(InlayHintsAccessibility.ID, InlayHintsAccessibility, EditorContributionInstantiation.Lazy);
export {
  InlayHintsAccessibility
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbmxheUhpbnRzL2Jyb3dzZXIvaW5sYXlIaW50c0FjY2Vzc2liaWx0eS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGlvbjIsIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24sIHJlZ2lzdGVyRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElubGF5SGludEl0ZW0sIGFzQ29tbWFuZExpbmsgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9pbmxheUhpbnRzL2Jyb3dzZXIvaW5sYXlIaW50cy5qcyc7XG5pbXBvcnQgeyBJbmxheUhpbnRzQ29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2lubGF5SGludHMvYnJvd3Nlci9pbmxheUhpbnRzQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVNpZ25hbCwgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgTGluayB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9icm93c2VyL2xpbmsuanMnO1xuXG5cbmV4cG9ydCBjbGFzcyBJbmxheUhpbnRzQWNjZXNzaWJpbGl0eSBpbXBsZW1lbnRzIElFZGl0b3JDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJc1JlYWRpbmcgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignaXNSZWFkaW5nTGluZVdpdGhJbmxheUhpbnRzJywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2lzUmVhZGluZ0xpbmVXaXRoSW5sYXlIaW50cycsIFwiV2hldGhlciB0aGUgY3VycmVudCBsaW5lIGFuZCBpdHMgaW5sYXkgaGludHMgYXJlIGN1cnJlbnRseSBmb2N1c2VkXCIpIH0pO1xuXG5cdHN0YXRpYyByZWFkb25seSBJRDogc3RyaW5nID0gJ2VkaXRvci5jb250cmliLklubGF5SGludHNBY2Nlc3NpYmlsaXR5JztcblxuXHRzdGF0aWMgZ2V0KGVkaXRvcjogSUNvZGVFZGl0b3IpOiBJbmxheUhpbnRzQWNjZXNzaWJpbGl0eSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIGVkaXRvci5nZXRDb250cmlidXRpb248SW5sYXlIaW50c0FjY2Vzc2liaWxpdHk+KElubGF5SGludHNBY2Nlc3NpYmlsaXR5LklEKSA/PyB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9hcmlhRWxlbWVudDogSFRNTFNwYW5FbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jdHhJc1JlYWRpbmc6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Nlc3Npb25EaXNwb29zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZTogSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFTZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuX2FyaWFFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdHRoaXMuX2FyaWFFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJztcblx0XHR0aGlzLl9hcmlhRWxlbWVudC5jbGFzc05hbWUgPSAnaW5sYXloaW50LWFjY2Vzc2liaWxpdHktZWxlbWVudCc7XG5cdFx0dGhpcy5fYXJpYUVsZW1lbnQudGFiSW5kZXggPSAwO1xuXHRcdHRoaXMuX2FyaWFFbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1kZXNjcmlwdGlvbicsIGxvY2FsaXplKCdkZXNjcmlwdGlvbicsIFwiQ29kZSB3aXRoIElubGF5IEhpbnQgSW5mb3JtYXRpb25cIikpO1xuXG5cdFx0dGhpcy5fY3R4SXNSZWFkaW5nID0gSW5sYXlIaW50c0FjY2Vzc2liaWxpdHkuSXNSZWFkaW5nLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3Nlc3Npb25EaXNwb29zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2N0eElzUmVhZGluZy5yZXNldCgpO1xuXHRcdHRoaXMuX2FyaWFFbGVtZW50LnJlbW92ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVzZXQoKTogdm9pZCB7XG5cdFx0ZG9tLmNsZWFyTm9kZSh0aGlzLl9hcmlhRWxlbWVudCk7XG5cdFx0dGhpcy5fc2Vzc2lvbkRpc3Bvb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRoaXMuX2N0eElzUmVhZGluZy5yZXNldCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcmVhZChsaW5lOiBudW1iZXIsIGhpbnRzOiBJbmxheUhpbnRJdGVtW10pIHtcblxuXHRcdHRoaXMuX3Nlc3Npb25EaXNwb29zYWJsZXMuY2xlYXIoKTtcblxuXHRcdGlmICghdGhpcy5fYXJpYUVsZW1lbnQuaXNDb25uZWN0ZWQpIHtcblx0XHRcdHRoaXMuX2VkaXRvci5nZXREb21Ob2RlKCk/LmFwcGVuZENoaWxkKHRoaXMuX2FyaWFFbGVtZW50KTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpIHx8ICF0aGlzLl9hcmlhRWxlbWVudC5pc0Nvbm5lY3RlZCkge1xuXHRcdFx0dGhpcy5fY3R4SXNSZWFkaW5nLnNldChmYWxzZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0dGhpcy5fc2Vzc2lvbkRpc3Bvb3NhYmxlcy5hZGQoY3RzKTtcblxuXHRcdGZvciAoY29uc3QgaGludCBvZiBoaW50cykge1xuXHRcdFx0YXdhaXQgaGludC5yZXNvbHZlKGN0cy50b2tlbik7XG5cdFx0fVxuXG5cdFx0aWYgKGN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdC8vIGNvbnN0IHRleHQgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKS5nZXRMaW5lQ29udGVudChsaW5lKTtcblx0XHRjb25zdCBuZXdDaGlsZHJlbjogKHN0cmluZyB8IEhUTUxFbGVtZW50KVtdID0gW107XG5cblx0XHRsZXQgc3RhcnQgPSAwO1xuXHRcdGxldCB0b29Mb25nVG9SZWFkID0gZmFsc2U7XG5cblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgaGludHMpIHtcblxuXHRcdFx0Ly8gdGV4dFxuXHRcdFx0Y29uc3QgcGFydCA9IG1vZGVsLmdldFZhbHVlSW5SYW5nZSh7IHN0YXJ0TGluZU51bWJlcjogbGluZSwgc3RhcnRDb2x1bW46IHN0YXJ0ICsgMSwgZW5kTGluZU51bWJlcjogbGluZSwgZW5kQ29sdW1uOiBpdGVtLmhpbnQucG9zaXRpb24uY29sdW1uIH0pO1xuXHRcdFx0aWYgKHBhcnQubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRuZXdDaGlsZHJlbi5wdXNoKHBhcnQpO1xuXHRcdFx0XHRzdGFydCA9IGl0ZW0uaGludC5wb3NpdGlvbi5jb2x1bW4gLSAxO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBjaGVjayBsZW5ndGhcblx0XHRcdGlmIChzdGFydCA+IDc1MCkge1xuXHRcdFx0XHRuZXdDaGlsZHJlbi5wdXNoKCdcdTIwMjYnKTtcblx0XHRcdFx0dG9vTG9uZ1RvUmVhZCA9IHRydWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBoaW50XG5cdFx0XHRjb25zdCBlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2VtJyk7XG5cdFx0XHRjb25zdCB7IGxhYmVsIH0gPSBpdGVtLmhpbnQ7XG5cdFx0XHRpZiAodHlwZW9mIGxhYmVsID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRlbS5pbm5lclRleHQgPSBsYWJlbDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZvciAoY29uc3QgcGFydCBvZiBsYWJlbCkge1xuXHRcdFx0XHRcdGlmIChwYXJ0LmNvbW1hbmQpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGxpbmsgPSB0aGlzLl9pbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTGluaywgZW0sXG5cdFx0XHRcdFx0XHRcdHsgaHJlZjogYXNDb21tYW5kTGluayhwYXJ0LmNvbW1hbmQpLCBsYWJlbDogcGFydC5sYWJlbCwgdGl0bGU6IHBhcnQuY29tbWFuZC50aXRsZSB9LFxuXHRcdFx0XHRcdFx0XHR1bmRlZmluZWRcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHR0aGlzLl9zZXNzaW9uRGlzcG9vc2FibGVzLmFkZChsaW5rKTtcblxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRlbS5pbm5lclRleHQgKz0gcGFydC5sYWJlbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG5ld0NoaWxkcmVuLnB1c2goZW0pO1xuXHRcdH1cblxuXHRcdC8vIHRyYWlsaW5nIHRleHRcblx0XHRpZiAoIXRvb0xvbmdUb1JlYWQpIHtcblx0XHRcdG5ld0NoaWxkcmVuLnB1c2gobW9kZWwuZ2V0VmFsdWVJblJhbmdlKHsgc3RhcnRMaW5lTnVtYmVyOiBsaW5lLCBzdGFydENvbHVtbjogc3RhcnQgKyAxLCBlbmRMaW5lTnVtYmVyOiBsaW5lLCBlbmRDb2x1bW46IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSIH0pKTtcblx0XHR9XG5cblx0XHRkb20ucmVzZXQodGhpcy5fYXJpYUVsZW1lbnQsIC4uLm5ld0NoaWxkcmVuKTtcblx0XHR0aGlzLl9hcmlhRWxlbWVudC5mb2N1cygpO1xuXHRcdHRoaXMuX2N0eElzUmVhZGluZy5zZXQodHJ1ZSk7XG5cblx0XHQvLyByZXNldCBvbiBibHVyXG5cdFx0dGhpcy5fc2Vzc2lvbkRpc3Bvb3NhYmxlcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9hcmlhRWxlbWVudCwgJ2ZvY3Vzb3V0JywgKCkgPT4ge1xuXHRcdFx0dGhpcy5fcmVzZXQoKTtcblx0XHR9KSk7XG5cdH1cblxuXG5cblx0c3RhcnRJbmxheUhpbnRzUmVhZGluZygpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGxpbmUgPSB0aGlzLl9lZGl0b3IuZ2V0UG9zaXRpb24oKS5saW5lTnVtYmVyO1xuXHRcdGNvbnN0IGhpbnRzID0gSW5sYXlIaW50c0NvbnRyb2xsZXIuZ2V0KHRoaXMuX2VkaXRvcik/LmdldElubGF5SGludHNGb3JMaW5lKGxpbmUpO1xuXHRcdGlmICghaGludHMgfHwgaGludHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLl9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5wbGF5U2lnbmFsKEFjY2Vzc2liaWxpdHlTaWduYWwubm9JbmxheUhpbnRzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcmVhZChsaW5lLCBoaW50cyk7XG5cdFx0fVxuXHR9XG5cblx0c3RvcElubGF5SGludHNSZWFkaW5nKCk6IHZvaWQge1xuXHRcdHRoaXMuX3Jlc2V0KCk7XG5cdFx0dGhpcy5fZWRpdG9yLmZvY3VzKCk7XG5cdH1cbn1cblxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgU3RhcnRSZWFkSGludHMgZXh0ZW5kcyBFZGl0b3JBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2lubGF5SGludHMuc3RhcnRSZWFkaW5nTGluZVdpdGhIaW50Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3JlYWQudGl0bGUnLCBcIlJlYWQgTGluZSB3aXRoIElubGluZSBIaW50c1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMuaGFzSW5sYXlIaW50c1Byb3ZpZGVyLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdHJ1bkVkaXRvckNvbW1hbmQoX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKSB7XG5cdFx0Y29uc3QgY3RybCA9IElubGF5SGludHNBY2Nlc3NpYmlsaXR5LmdldChlZGl0b3IpO1xuXHRcdGN0cmw/LnN0YXJ0SW5sYXlIaW50c1JlYWRpbmcoKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBTdG9wUmVhZEhpbnRzIGV4dGVuZHMgRWRpdG9yQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdpbmxheUhpbnRzLnN0b3BSZWFkaW5nTGluZVdpdGhIaW50Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3N0b3AudGl0bGUnLCBcIlN0b3AgSW5sYXkgSGludHMgUmVhZGluZ1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogSW5sYXlIaW50c0FjY2Vzc2liaWxpdHkuSXNSZWFkaW5nLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuRWRpdG9yQ29tbWFuZChfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpIHtcblx0XHRjb25zdCBjdHJsID0gSW5sYXlIaW50c0FjY2Vzc2liaWxpdHkuZ2V0KGVkaXRvcik7XG5cdFx0Y3RybD8uc3RvcElubGF5SGludHNSZWFkaW5nKCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbihJbmxheUhpbnRzQWNjZXNzaWJpbGl0eS5JRCwgSW5sYXlIaW50c0FjY2Vzc2liaWxpdHksIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24uTGF6eSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFT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
