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
import { status } from "../../../../base/browser/ui/aria/aria.js";
import { KeybindingLabel } from "../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { OS } from "../../../../base/common/platform.js";
import { ContentWidgetPositionPreference } from "../../../../editor/browser/editorBrowser.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { ReplEditorSettings } from "./interactiveCommon.js";
let ReplInputHintContentWidget = class extends Disposable {
  constructor(editor, configurationService, keybindingService) {
    super();
    this.editor = editor;
    this.configurationService = configurationService;
    this.keybindingService = keybindingService;
    this.ariaLabel = "";
    this._register(this.editor.onDidChangeConfiguration((e) => {
      if (this.domNode && e.hasChanged(EditorOption.fontInfo)) {
        this.editor.applyFontInfo(this.domNode);
      }
    }));
    const onDidFocusEditorText = Event.debounce(this.editor.onDidFocusEditorText, () => void 0, 500);
    this._register(onDidFocusEditorText(() => {
      if (this.editor.hasTextFocus() && this.ariaLabel && configurationService.getValue(AccessibilityVerbositySettingId.ReplEditor)) {
        status(this.ariaLabel);
      }
    }));
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ReplEditorSettings.executeWithShiftEnter)) {
        this.setHint();
      }
    }));
    this.editor.addContentWidget(this);
  }
  getId() {
    return ReplInputHintContentWidget.ID;
  }
  getPosition() {
    return {
      position: { lineNumber: 1, column: 1 },
      preference: [ContentWidgetPositionPreference.EXACT]
    };
  }
  getDomNode() {
    if (!this.domNode) {
      this.domNode = dom.$(".empty-editor-hint");
      this.domNode.style.width = "max-content";
      this.domNode.style.paddingLeft = "4px";
      this.setHint();
      this._register(dom.addDisposableListener(this.domNode, "click", () => {
        this.editor.focus();
      }));
      this.editor.applyFontInfo(this.domNode);
    }
    return this.domNode;
  }
  setHint() {
    if (!this.domNode) {
      return;
    }
    while (this.domNode.firstChild) {
      this.domNode.removeChild(this.domNode.firstChild);
    }
    const hintElement = dom.$("div.empty-hint-text");
    hintElement.style.cursor = "text";
    hintElement.style.whiteSpace = "nowrap";
    const keybinding = this.getKeybinding();
    const keybindingHintLabel = keybinding?.getLabel();
    if (keybinding && keybindingHintLabel) {
      const actionPart = localize("emptyHintText", "Press {0} to execute. ", keybindingHintLabel);
      const [before, after] = actionPart.split(keybindingHintLabel).map((fragment) => {
        const hintPart = dom.$("span", void 0, fragment);
        hintPart.style.fontStyle = "italic";
        return hintPart;
      });
      hintElement.appendChild(before);
      const label = new KeybindingLabel(hintElement, OS);
      label.set(keybinding);
      label.element.style.width = "min-content";
      label.element.style.display = "inline";
      hintElement.appendChild(after);
      this.domNode.append(hintElement);
      const helpKeybinding = this.keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getLabel();
      const helpInfo = helpKeybinding ? localize("ReplInputAriaLabelHelp", "Use {0} for accessibility help. ", helpKeybinding) : localize("ReplInputAriaLabelHelpNoKb", "Run the Open Accessibility Help command for more information. ");
      this.ariaLabel = actionPart.concat(helpInfo, localize("disableHint", " Toggle {0} in settings to disable this hint.", AccessibilityVerbositySettingId.ReplEditor));
    }
  }
  getKeybinding() {
    const keybindings = this.keybindingService.lookupKeybindings("interactive.execute");
    const shiftEnterConfig = this.configurationService.getValue(ReplEditorSettings.executeWithShiftEnter);
    const hasEnterChord = (kb, modifier = "") => {
      const chords = kb.getDispatchChords();
      const chord = modifier + "Enter";
      const chordAlt = modifier + "[Enter]";
      return chords.length === 1 && (chords[0] === chord || chords[0] === chordAlt);
    };
    if (shiftEnterConfig) {
      const keybinding = keybindings.find((kb) => hasEnterChord(kb, "shift+"));
      if (keybinding) {
        return keybinding;
      }
    } else {
      let keybinding = keybindings.find((kb) => hasEnterChord(kb));
      if (keybinding) {
        return keybinding;
      }
      keybinding = this.keybindingService.lookupKeybindings("python.execInREPLEnter").find((kb) => hasEnterChord(kb));
      if (keybinding) {
        return keybinding;
      }
    }
    return keybindings?.[0];
  }
  dispose() {
    super.dispose();
    this.editor.removeContentWidget(this);
  }
};
ReplInputHintContentWidget.ID = "replInput.widget.emptyHint";
ReplInputHintContentWidget = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IKeybindingService)
], ReplInputHintContentWidget);
export {
  ReplInputHintContentWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbnRlcmFjdGl2ZS9icm93c2VyL3JlcGxJbnB1dEhpbnRDb250ZW50V2lkZ2V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgc3RhdHVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nTGFiZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkva2V5YmluZGluZ0xhYmVsL2tleWJpbmRpbmdMYWJlbC5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFJlc29sdmVkS2V5YmluZGluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleWJpbmRpbmdzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgT1MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLCBJQ29kZUVkaXRvciwgSUNvbnRlbnRXaWRnZXQsIElDb250ZW50V2lkZ2V0UG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQsIEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQgfSBmcm9tICcuLi8uLi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eUNvbW1hbmRJZCB9IGZyb20gJy4uLy4uL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHlDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBSZXBsRWRpdG9yU2V0dGluZ3MgfSBmcm9tICcuL2ludGVyYWN0aXZlQ29tbW9uLmpzJztcblxuXG5leHBvcnQgY2xhc3MgUmVwbElucHV0SGludENvbnRlbnRXaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNvbnRlbnRXaWRnZXQge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IElEID0gJ3JlcGxJbnB1dC53aWRnZXQuZW1wdHlIaW50JztcblxuXHRwcml2YXRlIGRvbU5vZGU6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGFyaWFMYWJlbDogc3RyaW5nID0gJyc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKChlOiBDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50KSA9PiB7XG5cdFx0XHRpZiAodGhpcy5kb21Ob2RlICYmIGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uZm9udEluZm8pKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yLmFwcGx5Rm9udEluZm8odGhpcy5kb21Ob2RlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0Y29uc3Qgb25EaWRGb2N1c0VkaXRvclRleHQgPSBFdmVudC5kZWJvdW5jZSh0aGlzLmVkaXRvci5vbkRpZEZvY3VzRWRpdG9yVGV4dCwgKCkgPT4gdW5kZWZpbmVkLCA1MDApO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG9uRGlkRm9jdXNFZGl0b3JUZXh0KCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmVkaXRvci5oYXNUZXh0Rm9jdXMoKSAmJiB0aGlzLmFyaWFMYWJlbCAmJiBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkLlJlcGxFZGl0b3IpKSB7XG5cdFx0XHRcdHN0YXR1cyh0aGlzLmFyaWFMYWJlbCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFJlcGxFZGl0b3JTZXR0aW5ncy5leGVjdXRlV2l0aFNoaWZ0RW50ZXIpKSB7XG5cdFx0XHRcdHRoaXMuc2V0SGludCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLmVkaXRvci5hZGRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHR9XG5cblx0Z2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gUmVwbElucHV0SGludENvbnRlbnRXaWRnZXQuSUQ7XG5cdH1cblxuXHRnZXRQb3NpdGlvbigpOiBJQ29udGVudFdpZGdldFBvc2l0aW9uIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHBvc2l0aW9uOiB7IGxpbmVOdW1iZXI6IDEsIGNvbHVtbjogMSB9LFxuXHRcdFx0cHJlZmVyZW5jZTogW0NvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuRVhBQ1RdXG5cdFx0fTtcblx0fVxuXG5cdGdldERvbU5vZGUoKTogSFRNTEVsZW1lbnQge1xuXHRcdGlmICghdGhpcy5kb21Ob2RlKSB7XG5cdFx0XHR0aGlzLmRvbU5vZGUgPSBkb20uJCgnLmVtcHR5LWVkaXRvci1oaW50Jyk7XG5cdFx0XHR0aGlzLmRvbU5vZGUuc3R5bGUud2lkdGggPSAnbWF4LWNvbnRlbnQnO1xuXHRcdFx0dGhpcy5kb21Ob2RlLnN0eWxlLnBhZGRpbmdMZWZ0ID0gJzRweCc7XG5cblx0XHRcdHRoaXMuc2V0SGludCgpO1xuXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZG9tTm9kZSwgJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmVkaXRvci5mb2N1cygpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLmVkaXRvci5hcHBseUZvbnRJbmZvKHRoaXMuZG9tTm9kZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZG9tTm9kZTtcblx0fVxuXG5cdHByaXZhdGUgc2V0SGludCgpIHtcblx0XHRpZiAoIXRoaXMuZG9tTm9kZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR3aGlsZSAodGhpcy5kb21Ob2RlLmZpcnN0Q2hpbGQpIHtcblx0XHRcdHRoaXMuZG9tTm9kZS5yZW1vdmVDaGlsZCh0aGlzLmRvbU5vZGUuZmlyc3RDaGlsZCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGludEVsZW1lbnQgPSBkb20uJCgnZGl2LmVtcHR5LWhpbnQtdGV4dCcpO1xuXHRcdGhpbnRFbGVtZW50LnN0eWxlLmN1cnNvciA9ICd0ZXh0Jztcblx0XHRoaW50RWxlbWVudC5zdHlsZS53aGl0ZVNwYWNlID0gJ25vd3JhcCc7XG5cblx0XHRjb25zdCBrZXliaW5kaW5nID0gdGhpcy5nZXRLZXliaW5kaW5nKCk7XG5cdFx0Y29uc3Qga2V5YmluZGluZ0hpbnRMYWJlbCA9IGtleWJpbmRpbmc/LmdldExhYmVsKCk7XG5cblx0XHRpZiAoa2V5YmluZGluZyAmJiBrZXliaW5kaW5nSGludExhYmVsKSB7XG5cdFx0XHRjb25zdCBhY3Rpb25QYXJ0ID0gbG9jYWxpemUoJ2VtcHR5SGludFRleHQnLCAnUHJlc3MgezB9IHRvIGV4ZWN1dGUuICcsIGtleWJpbmRpbmdIaW50TGFiZWwpO1xuXG5cdFx0XHRjb25zdCBbYmVmb3JlLCBhZnRlcl0gPSBhY3Rpb25QYXJ0LnNwbGl0KGtleWJpbmRpbmdIaW50TGFiZWwpLm1hcCgoZnJhZ21lbnQpID0+IHtcblx0XHRcdFx0Y29uc3QgaGludFBhcnQgPSBkb20uJCgnc3BhbicsIHVuZGVmaW5lZCwgZnJhZ21lbnQpO1xuXHRcdFx0XHRoaW50UGFydC5zdHlsZS5mb250U3R5bGUgPSAnaXRhbGljJztcblx0XHRcdFx0cmV0dXJuIGhpbnRQYXJ0O1xuXHRcdFx0fSk7XG5cblx0XHRcdGhpbnRFbGVtZW50LmFwcGVuZENoaWxkKGJlZm9yZSk7XG5cblx0XHRcdGNvbnN0IGxhYmVsID0gbmV3IEtleWJpbmRpbmdMYWJlbChoaW50RWxlbWVudCwgT1MpO1xuXHRcdFx0bGFiZWwuc2V0KGtleWJpbmRpbmcpO1xuXHRcdFx0bGFiZWwuZWxlbWVudC5zdHlsZS53aWR0aCA9ICdtaW4tY29udGVudCc7XG5cdFx0XHRsYWJlbC5lbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcblxuXHRcdFx0aGludEVsZW1lbnQuYXBwZW5kQ2hpbGQoYWZ0ZXIpO1xuXHRcdFx0dGhpcy5kb21Ob2RlLmFwcGVuZChoaW50RWxlbWVudCk7XG5cblx0XHRcdGNvbnN0IGhlbHBLZXliaW5kaW5nID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKEFjY2Vzc2liaWxpdHlDb21tYW5kSWQuT3BlbkFjY2Vzc2liaWxpdHlIZWxwKT8uZ2V0TGFiZWwoKTtcblx0XHRcdGNvbnN0IGhlbHBJbmZvID0gaGVscEtleWJpbmRpbmdcblx0XHRcdFx0PyBsb2NhbGl6ZSgnUmVwbElucHV0QXJpYUxhYmVsSGVscCcsIFwiVXNlIHswfSBmb3IgYWNjZXNzaWJpbGl0eSBoZWxwLiBcIiwgaGVscEtleWJpbmRpbmcpXG5cdFx0XHRcdDogbG9jYWxpemUoJ1JlcGxJbnB1dEFyaWFMYWJlbEhlbHBOb0tiJywgXCJSdW4gdGhlIE9wZW4gQWNjZXNzaWJpbGl0eSBIZWxwIGNvbW1hbmQgZm9yIG1vcmUgaW5mb3JtYXRpb24uIFwiKTtcblxuXHRcdFx0dGhpcy5hcmlhTGFiZWwgPSBhY3Rpb25QYXJ0LmNvbmNhdChoZWxwSW5mbywgbG9jYWxpemUoJ2Rpc2FibGVIaW50JywgJyBUb2dnbGUgezB9IGluIHNldHRpbmdzIHRvIGRpc2FibGUgdGhpcyBoaW50LicsIEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuUmVwbEVkaXRvcikpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0S2V5YmluZGluZygpIHtcblx0XHRjb25zdCBrZXliaW5kaW5ncyA9IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZ3MoJ2ludGVyYWN0aXZlLmV4ZWN1dGUnKTtcblx0XHRjb25zdCBzaGlmdEVudGVyQ29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShSZXBsRWRpdG9yU2V0dGluZ3MuZXhlY3V0ZVdpdGhTaGlmdEVudGVyKTtcblx0XHRjb25zdCBoYXNFbnRlckNob3JkID0gKGtiOiBSZXNvbHZlZEtleWJpbmRpbmcsIG1vZGlmaWVyOiBzdHJpbmcgPSAnJykgPT4ge1xuXHRcdFx0Y29uc3QgY2hvcmRzID0ga2IuZ2V0RGlzcGF0Y2hDaG9yZHMoKTtcblx0XHRcdGNvbnN0IGNob3JkID0gbW9kaWZpZXIgKyAnRW50ZXInO1xuXHRcdFx0Y29uc3QgY2hvcmRBbHQgPSBtb2RpZmllciArICdbRW50ZXJdJztcblx0XHRcdHJldHVybiBjaG9yZHMubGVuZ3RoID09PSAxICYmIChjaG9yZHNbMF0gPT09IGNob3JkIHx8IGNob3Jkc1swXSA9PT0gY2hvcmRBbHQpO1xuXHRcdH07XG5cblx0XHRpZiAoc2hpZnRFbnRlckNvbmZpZykge1xuXHRcdFx0Y29uc3Qga2V5YmluZGluZyA9IGtleWJpbmRpbmdzLmZpbmQoa2IgPT4gaGFzRW50ZXJDaG9yZChrYiwgJ3NoaWZ0KycpKTtcblx0XHRcdGlmIChrZXliaW5kaW5nKSB7XG5cdFx0XHRcdHJldHVybiBrZXliaW5kaW5nO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRsZXQga2V5YmluZGluZyA9IGtleWJpbmRpbmdzLmZpbmQoa2IgPT4gaGFzRW50ZXJDaG9yZChrYikpO1xuXHRcdFx0aWYgKGtleWJpbmRpbmcpIHtcblx0XHRcdFx0cmV0dXJuIGtleWJpbmRpbmc7XG5cdFx0XHR9XG5cdFx0XHRrZXliaW5kaW5nID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5ncygncHl0aG9uLmV4ZWNJblJFUExFbnRlcicpXG5cdFx0XHRcdC5maW5kKGtiID0+IGhhc0VudGVyQ2hvcmQoa2IpKTtcblx0XHRcdGlmIChrZXliaW5kaW5nKSB7XG5cdFx0XHRcdHJldHVybiBrZXliaW5kaW5nO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBrZXliaW5kaW5ncz8uWzBdO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5lZGl0b3IucmVtb3ZlQ29udGVudFdpZGdldCh0aGlzKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsYUFBYTtBQUV0QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLFVBQVU7QUFDbkIsU0FBUyx1Q0FBNEY7QUFDckcsU0FBb0Msb0JBQW9CO0FBQ3hELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsdUNBQXVDO0FBQ2hELFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsMEJBQTBCO0FBRzVCLElBQU0sNkJBQU4sY0FBeUMsV0FBcUM7QUFBQSxFQU9wRixZQUNrQixRQUN1QixzQkFDSCxtQkFDcEM7QUFDRCxVQUFNO0FBSlc7QUFDdUI7QUFDSDtBQUx0QyxTQUFRLFlBQW9CO0FBUzNCLFNBQUssVUFBVSxLQUFLLE9BQU8seUJBQXlCLENBQUMsTUFBaUM7QUFDckYsVUFBSSxLQUFLLFdBQVcsRUFBRSxXQUFXLGFBQWEsUUFBUSxHQUFHO0FBQ3hELGFBQUssT0FBTyxjQUFjLEtBQUssT0FBTztBQUFBLE1BQ3ZDO0FBQUEsSUFDRCxDQUFDLENB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
