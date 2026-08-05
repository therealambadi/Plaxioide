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
import * as nls from "../../../../nls.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Range } from "../../../../editor/common/core/range.js";
import { registerEditorContribution, EditorContributionInstantiation } from "../../../../editor/browser/editorExtensions.js";
import { SnippetController2 } from "../../../../editor/contrib/snippet/browser/snippetController2.js";
import { SmartSnippetInserter } from "../common/smartSnippetInserter.js";
import { DefineKeybindingOverlayWidget } from "./keybindingWidgets.js";
import { parseTree } from "../../../../base/common/json.js";
import { WindowsNativeResolvedKeybinding } from "../../../services/keybinding/common/windowsKeyboardMapper.js";
import { themeColorFromId } from "../../../../platform/theme/common/themeService.js";
import { overviewRulerInfo, overviewRulerError } from "../../../../editor/common/core/editorColorRegistry.js";
import { TrackedRangeStickiness, OverviewRulerLane } from "../../../../editor/common/model.js";
import { KeybindingParser } from "../../../../base/common/keybindingParser.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { isEqual } from "../../../../base/common/resources.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { DEFINE_KEYBINDING_EDITOR_CONTRIB_ID } from "../../../services/preferences/common/preferences.js";
const NLS_KB_LAYOUT_ERROR_MESSAGE = nls.localize("defineKeybinding.kbLayoutErrorMessage", "You won't be able to produce this key combination under your current keyboard layout.");
let DefineKeybindingEditorContribution = class extends Disposable {
  constructor(_editor, _instantiationService, _userDataProfileService) {
    super();
    this._editor = _editor;
    this._instantiationService = _instantiationService;
    this._userDataProfileService = _userDataProfileService;
    this._keybindingDecorationRenderer = this._register(new MutableDisposable());
    this._defineWidget = this._register(this._instantiationService.createInstance(DefineKeybindingOverlayWidget, this._editor));
    this._register(this._editor.onDidChangeModel((e) => this._update()));
    this._update();
  }
  _update() {
    this._keybindingDecorationRenderer.value = isInterestingEditorModel(this._editor, this._userDataProfileService) ? this._instantiationService.createInstance(KeybindingEditorDecorationsRenderer, this._editor) : void 0;
  }
  showDefineKeybindingWidget() {
    if (isInterestingEditorModel(this._editor, this._userDataProfileService)) {
      this._defineWidget.start().then((keybinding) => this._onAccepted(keybinding));
    }
  }
  _onAccepted(keybinding) {
    this._editor.focus();
    if (keybinding && this._editor.hasModel()) {
      const regexp = new RegExp(/\\/g);
      const backslash = regexp.test(keybinding);
      if (backslash) {
        keybinding = keybinding.slice(0, -1) + "\\\\";
      }
      let snippetText = [
        "{",
        '	"key": ' + JSON.stringify(keybinding) + ",",
        '	"command": "${1:commandId}",',
        '	"when": "${2:editorTextFocus}"',
        "}$0"
      ].join("\n");
      const smartInsertInfo = SmartSnippetInserter.insertSnippet(this._editor.getModel(), this._editor.getPosition());
      snippetText = smartInsertInfo.prepend + snippetText + smartInsertInfo.append;
      this._editor.setPosition(smartInsertInfo.position);
      SnippetController2.get(this._editor)?.insert(snippetText, { overwriteBefore: 0, overwriteAfter: 0 });
    }
  }
};
DefineKeybindingEditorContribution = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IUserDataProfileService)
], DefineKeybindingEditorContribution);
let KeybindingEditorDecorationsRenderer = class extends Disposable {
  constructor(_editor, _keybindingService) {
    super();
    this._editor = _editor;
    this._keybindingService = _keybindingService;
    this._dec = this._editor.createDecorationsCollection();
    this._updateDecorations = this._register(new RunOnceScheduler(() => this._updateDecorationsNow(), 500));
    const model = assertIsDefined(this._editor.getModel());
    this._register(model.onDidChangeContent(() => this._updateDecorations.schedule()));
    this._register(this._keybindingService.onDidUpdateKeybindings(() => this._updateDecorations.schedule()));
    this._register({
      dispose: () => {
        this._dec.clear();
        this._updateDecorations.cancel();
      }
    });
    this._updateDecorations.schedule();
  }
  _updateDecorationsNow() {
    const model = assertIsDefined(this._editor.getModel());
    const newDecorations = [];
    const root = parseTree(model.getValue());
    if (root && Array.isArray(root.children)) {
      for (let i = 0, len = root.children.length; i < len; i++) {
        const entry = root.children[i];
        const dec = this._getDecorationForEntry(model, entry);
        if (dec !== null) {
          newDecorations.push(dec);
        }
      }
    }
    this._dec.set(newDecorations);
  }
  _getDecorationForEntry(model, entry) {
    if (!Array.isArray(entry.children)) {
      return null;
    }
    for (let i = 0, len = entry.children.length; i < len; i++) {
      const prop = entry.children[i];
      if (prop.type !== "property") {
        continue;
      }
      if (!Array.isArray(prop.children) || prop.children.length !== 2) {
        continue;
      }
      const key = prop.children[0];
      if (key.value !== "key") {
        continue;
      }
      const value = prop.children[1];
      if (value.type !== "string") {
        continue;
      }
      const resolvedKeybindings = this._keybindingService.resolveUserBinding(value.value);
      if (resolvedKeybindings.length === 0) {
        return this._createDecoration(true, null, null, model, value);
      }
      const resolvedKeybinding = resolvedKeybindings[0];
      let usLabel = null;
      if (resolvedKeybinding instanceof WindowsNativeResolvedKeybinding) {
        usLabel = resolvedKeybinding.getUSLabel();
      }
      if (!resolvedKeybinding.isWYSIWYG()) {
        const uiLabel = resolvedKeybinding.getLabel();
        if (typeof uiLabel === "string" && value.value.toLowerCase() === uiLabel.toLowerCase()) {
          return null;
        }
        return this._createDecoration(false, resolvedKeybinding.getLabel(), usLabel, model, value);
      }
      if (/abnt_|oem_/.test(value.value)) {
        return this._createDecoration(false, resolvedKeybinding.getLabel(), usLabel, model, value);
      }
      const expectedUserSettingsLabel = resolvedKeybinding.getUserSettingsLabel();
      if (typeof expectedUserSettingsLabel === "string" && !KeybindingEditorDecorationsRenderer._userSettingsFuzzyEquals(value.value, expectedUserSettingsLabel)) {
        return this._createDecoration(false, resolvedKeybinding.getLabel(), usLabel, model, value);
      }
      return null;
    }
    return null;
  }
  static _userSettingsFuzzyEquals(a, b) {
    a = a.trim().toLowerCase();
    b = b.trim().toLowerCase();
    if (a === b) {
      return true;
    }
    const aKeybinding = KeybindingParser.parseKeybinding(a);
    const bKeybinding = KeybindingParser.parseKeybinding(b);
    if (aKeybinding === null && bKeybinding === null) {
      return true;
    }
    if (!aKeybinding || !bKeybinding) {
      return false;
    }
    return aKeybinding.equals(bKeybinding);
  }
  _createDecoration(isError, uiLabel, usLabel, model, keyNode) {
    let msg;
    let className;
    let overviewRulerColor;
    if (isError) {
      msg = new MarkdownString().appendText(NLS_KB_LAYOUT_ERROR_MESSAGE);
      className = "keybindingError";
      overviewRulerColor = themeColorFromId(overviewRulerError);
    } else {
      if (usLabel && uiLabel !== usLabel) {
        msg = new MarkdownString(
          nls.localize({
            key: "defineKeybinding.kbLayoutLocalAndUSMessage",
            comment: [
              "Please translate maintaining the stars (*) around the placeholders such that they will be rendered in bold.",
              "The placeholders will contain a keyboard combination e.g. Ctrl+Shift+/"
            ]
          }, "**{0}** for your current keyboard layout (**{1}** for US standard).", uiLabel, usLabel)
        );
      } else {
        msg = new MarkdownString(
          nls.localize({
            key: "defineKeybinding.kbLayoutLocalMessage",
            comment: [
              "Please translate maintaining the stars (*) around the placeholder such that it will be rendered in bold.",
              "The placeholder will contain a keyboard combination e.g. Ctrl+Shift+/"
            ]
          }, "**{0}** for your current keyboard layout.", uiLabel)
        );
      }
      className = "keybindingInfo";
      overviewRulerColor = themeColorFromId(overviewRulerInfo);
    }
    const startPosition = model.getPositionAt(keyNode.offset);
    const endPosition = model.getPositionAt(keyNode.offset + keyNode.length);
    const range = new Range(
      startPosition.lineNumber,
      startPosition.column,
      endPosition.lineNumber,
      endPosition.column
    );
    return {
      range,
      options: {
        description: "keybindings-widget",
        stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        className,
        hoverMessage: msg,
        overviewRuler: {
          color: overviewRulerColor,
          position: OverviewRulerLane.Right
        }
      }
    };
  }
};
KeybindingEditorDecorationsRenderer = __decorateClass([
  __decorateParam(1, IKeybindingService)
], KeybindingEditorDecorationsRenderer);
function isInterestingEditorModel(editor, userDataProfileService) {
  const model = editor.getModel();
  if (!model) {
    return false;
  }
  return isEqual(model.uri, userDataProfileService.currentProfile.keybindingsResource);
}
registerEditorContribution(DEFINE_KEYBINDING_EDITOR_CONTRIB_ID, DefineKeybindingEditorContribution, EditorContributionInstantiation.AfterFirstRender);
export {
  KeybindingEditorDecorationsRenderer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL2tleWJpbmRpbmdzRWRpdG9yQ29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24sIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0Q29udHJvbGxlcjIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zbmlwcGV0L2Jyb3dzZXIvc25pcHBldENvbnRyb2xsZXIyLmpzJztcbmltcG9ydCB7IFNtYXJ0U25pcHBldEluc2VydGVyIH0gZnJvbSAnLi4vY29tbW9uL3NtYXJ0U25pcHBldEluc2VydGVyLmpzJztcbmltcG9ydCB7IERlZmluZUtleWJpbmRpbmdPdmVybGF5V2lkZ2V0IH0gZnJvbSAnLi9rZXliaW5kaW5nV2lkZ2V0cy5qcyc7XG5pbXBvcnQgeyBwYXJzZVRyZWUsIE5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uLmpzJztcbmltcG9ydCB7IFdpbmRvd3NOYXRpdmVSZXNvbHZlZEtleWJpbmRpbmcgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9rZXliaW5kaW5nL2NvbW1vbi93aW5kb3dzS2V5Ym9hcmRNYXBwZXIuanMnO1xuaW1wb3J0IHsgdGhlbWVDb2xvckZyb21JZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGhlbWVDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBvdmVydmlld1J1bGVySW5mbywgb3ZlcnZpZXdSdWxlckVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL2VkaXRvckNvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBJVGV4dE1vZGVsLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLCBPdmVydmlld1J1bGVyTGFuZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1BhcnNlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleWJpbmRpbmdQYXJzZXIuanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IERFRklORV9LRVlCSU5ESU5HX0VESVRPUl9DT05UUklCX0lELCBJRGVmaW5lS2V5YmluZGluZ0VkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ByZWZlcmVuY2VzL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yRGVjb3JhdGlvbnNDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuXG5jb25zdCBOTFNfS0JfTEFZT1VUX0VSUk9SX01FU1NBR0UgPSBubHMubG9jYWxpemUoJ2RlZmluZUtleWJpbmRpbmcua2JMYXlvdXRFcnJvck1lc3NhZ2UnLCBcIllvdSB3b24ndCBiZSBhYmxlIHRvIHByb2R1Y2UgdGhpcyBrZXkgY29tYmluYXRpb24gdW5kZXIgeW91ciBjdXJyZW50IGtleWJvYXJkIGxheW91dC5cIik7XG5cbmNsYXNzIERlZmluZUtleWJpbmRpbmdFZGl0b3JDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSURlZmluZUtleWJpbmRpbmdFZGl0b3JDb250cmlidXRpb24ge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdEZWNvcmF0aW9uUmVuZGVyZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8S2V5YmluZGluZ0VkaXRvckRlY29yYXRpb25zUmVuZGVyZXI+KCkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlZmluZVdpZGdldDogRGVmaW5lS2V5YmluZGluZ092ZXJsYXlXaWRnZXQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3VzZXJEYXRhUHJvZmlsZVNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9kZWZpbmVXaWRnZXQgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEZWZpbmVLZXliaW5kaW5nT3ZlcmxheVdpZGdldCwgdGhpcy5fZWRpdG9yKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWwoZSA9PiB0aGlzLl91cGRhdGUoKSkpO1xuXHRcdHRoaXMuX3VwZGF0ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2tleWJpbmRpbmdEZWNvcmF0aW9uUmVuZGVyZXIudmFsdWUgPSBpc0ludGVyZXN0aW5nRWRpdG9yTW9kZWwodGhpcy5fZWRpdG9yLCB0aGlzLl91c2VyRGF0YVByb2ZpbGVTZXJ2aWNlKVxuXHRcdFx0Ly8gRGVjb3JhdGlvbnMgYXJlIHNob3duIGZvciB0aGUgZGVmYXVsdCBrZXliaW5kaW5ncy5qc29uICoqYW5kKiogZm9yIHRoZSB1c2VyIGtleWJpbmRpbmdzLmpzb25cblx0XHRcdD8gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoS2V5YmluZGluZ0VkaXRvckRlY29yYXRpb25zUmVuZGVyZXIsIHRoaXMuX2VkaXRvcilcblx0XHRcdDogdW5kZWZpbmVkO1xuXHR9XG5cblx0c2hvd0RlZmluZUtleWJpbmRpbmdXaWRnZXQoKTogdm9pZCB7XG5cdFx0aWYgKGlzSW50ZXJlc3RpbmdFZGl0b3JNb2RlbCh0aGlzLl9lZGl0b3IsIHRoaXMuX3VzZXJEYXRhUHJvZmlsZVNlcnZpY2UpKSB7XG5cdFx0XHR0aGlzLl9kZWZpbmVXaWRnZXQuc3RhcnQoKS50aGVuKGtleWJpbmRpbmcgPT4gdGhpcy5fb25BY2NlcHRlZChrZXliaW5kaW5nKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfb25BY2NlcHRlZChrZXliaW5kaW5nOiBzdHJpbmcgfCBudWxsKTogdm9pZCB7XG5cdFx0dGhpcy5fZWRpdG9yLmZvY3VzKCk7XG5cdFx0aWYgKGtleWJpbmRpbmcgJiYgdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdGNvbnN0IHJlZ2V4cCA9IG5ldyBSZWdFeHAoL1xcXFwvZyk7XG5cdFx0XHRjb25zdCBiYWNrc2xhc2ggPSByZWdleHAudGVzdChrZXliaW5kaW5nKTtcblx0XHRcdGlmIChiYWNrc2xhc2gpIHtcblx0XHRcdFx0a2V5YmluZGluZyA9IGtleWJpbmRpbmcuc2xpY2UoMCwgLTEpICsgJ1xcXFxcXFxcJztcblx0XHRcdH1cblx0XHRcdGxldCBzbmlwcGV0VGV4dCA9IFtcblx0XHRcdFx0J3snLFxuXHRcdFx0XHQnXFx0XCJrZXlcIjogJyArIEpTT04uc3RyaW5naWZ5KGtleWJpbmRpbmcpICsgJywnLFxuXHRcdFx0XHQnXFx0XCJjb21tYW5kXCI6IFwiJHsxOmNvbW1hbmRJZH1cIiwnLFxuXHRcdFx0XHQnXFx0XCJ3aGVuXCI6IFwiJHsyOmVkaXRvclRleHRGb2N1c31cIicsXG5cdFx0XHRcdCd9JDAnXG5cdFx0XHRdLmpvaW4oJ1xcbicpO1xuXG5cdFx0XHRjb25zdCBzbWFydEluc2VydEluZm8gPSBTbWFydFNuaXBwZXRJbnNlcnRlci5pbnNlcnRTbmlwcGV0KHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpLCB0aGlzLl9lZGl0b3IuZ2V0UG9zaXRpb24oKSk7XG5cdFx0XHRzbmlwcGV0VGV4dCA9IHNtYXJ0SW5zZXJ0SW5mby5wcmVwZW5kICsgc25pcHBldFRleHQgKyBzbWFydEluc2VydEluZm8uYXBwZW5kO1xuXHRcdFx0dGhpcy5fZWRpdG9yLnNldFBvc2l0aW9uKHNtYXJ0SW5zZXJ0SW5mby5wb3NpdGlvbik7XG5cblx0XHRcdFNuaXBwZXRDb250cm9sbGVyMi5nZXQodGhpcy5fZWRpdG9yKT8uaW5zZXJ0KHNuaXBwZXRUZXh0LCB7IG92ZXJ3cml0ZUJlZm9yZTogMCwgb3ZlcndyaXRlQWZ0ZXI6IDAgfSk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBLZXliaW5kaW5nRWRpdG9yRGVjb3JhdGlvbnNSZW5kZXJlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgX3VwZGF0ZURlY29yYXRpb25zOiBSdW5PbmNlU2NoZWR1bGVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWM6IElFZGl0b3JEZWNvcmF0aW9uc0NvbGxlY3Rpb247XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fZGVjID0gdGhpcy5fZWRpdG9yLmNyZWF0ZURlY29yYXRpb25zQ29sbGVjdGlvbigpO1xuXG5cdFx0dGhpcy5fdXBkYXRlRGVjb3JhdGlvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLl91cGRhdGVEZWNvcmF0aW9uc05vdygpLCA1MDApKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gYXNzZXJ0SXNEZWZpbmVkKHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihtb2RlbC5vbkRpZENoYW5nZUNvbnRlbnQoKCkgPT4gdGhpcy5fdXBkYXRlRGVjb3JhdGlvbnMuc2NoZWR1bGUoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLm9uRGlkVXBkYXRlS2V5YmluZGluZ3MoKCkgPT4gdGhpcy5fdXBkYXRlRGVjb3JhdGlvbnMuc2NoZWR1bGUoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5fZGVjLmNsZWFyKCk7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZURlY29yYXRpb25zLmNhbmNlbCgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuX3VwZGF0ZURlY29yYXRpb25zLnNjaGVkdWxlKCk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVEZWNvcmF0aW9uc05vdygpOiB2b2lkIHtcblx0XHRjb25zdCBtb2RlbCA9IGFzc2VydElzRGVmaW5lZCh0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKSk7XG5cblx0XHRjb25zdCBuZXdEZWNvcmF0aW9uczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10gPSBbXTtcblxuXHRcdGNvbnN0IHJvb3QgPSBwYXJzZVRyZWUobW9kZWwuZ2V0VmFsdWUoKSk7XG5cdFx0aWYgKHJvb3QgJiYgQXJyYXkuaXNBcnJheShyb290LmNoaWxkcmVuKSkge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHJvb3QuY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgZW50cnkgPSByb290LmNoaWxkcmVuW2ldO1xuXHRcdFx0XHRjb25zdCBkZWMgPSB0aGlzLl9nZXREZWNvcmF0aW9uRm9yRW50cnkobW9kZWwsIGVudHJ5KTtcblx0XHRcdFx0aWYgKGRlYyAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdG5ld0RlY29yYXRpb25zLnB1c2goZGVjKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2RlYy5zZXQobmV3RGVjb3JhdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0RGVjb3JhdGlvbkZvckVudHJ5KG1vZGVsOiBJVGV4dE1vZGVsLCBlbnRyeTogTm9kZSk6IElNb2RlbERlbHRhRGVjb3JhdGlvbiB8IG51bGwge1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShlbnRyeS5jaGlsZHJlbikpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gZW50cnkuY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHByb3AgPSBlbnRyeS5jaGlsZHJlbltpXTtcblx0XHRcdGlmIChwcm9wLnR5cGUgIT09ICdwcm9wZXJ0eScpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIUFycmF5LmlzQXJyYXkocHJvcC5jaGlsZHJlbikgfHwgcHJvcC5jaGlsZHJlbi5sZW5ndGggIT09IDIpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBrZXkgPSBwcm9wLmNoaWxkcmVuWzBdO1xuXHRcdFx0aWYgKGtleS52YWx1ZSAhPT0gJ2tleScpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB2YWx1ZSA9IHByb3AuY2hpbGRyZW5bMV07XG5cdFx0XHRpZiAodmFsdWUudHlwZSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc29sdmVkS2V5YmluZGluZ3MgPSB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5yZXNvbHZlVXNlckJpbmRpbmcodmFsdWUudmFsdWUpO1xuXHRcdFx0aWYgKHJlc29sdmVkS2V5YmluZGluZ3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9jcmVhdGVEZWNvcmF0aW9uKHRydWUsIG51bGwsIG51bGwsIG1vZGVsLCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZXNvbHZlZEtleWJpbmRpbmcgPSByZXNvbHZlZEtleWJpbmRpbmdzWzBdO1xuXHRcdFx0bGV0IHVzTGFiZWw6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRcdFx0aWYgKHJlc29sdmVkS2V5YmluZGluZyBpbnN0YW5jZW9mIFdpbmRvd3NOYXRpdmVSZXNvbHZlZEtleWJpbmRpbmcpIHtcblx0XHRcdFx0dXNMYWJlbCA9IHJlc29sdmVkS2V5YmluZGluZy5nZXRVU0xhYmVsKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXJlc29sdmVkS2V5YmluZGluZy5pc1dZU0lXWUcoKSkge1xuXHRcdFx0XHRjb25zdCB1aUxhYmVsID0gcmVzb2x2ZWRLZXliaW5kaW5nLmdldExhYmVsKCk7XG5cdFx0XHRcdGlmICh0eXBlb2YgdWlMYWJlbCA9PT0gJ3N0cmluZycgJiYgdmFsdWUudmFsdWUudG9Mb3dlckNhc2UoKSA9PT0gdWlMYWJlbC50b0xvd2VyQ2FzZSgpKSB7XG5cdFx0XHRcdFx0Ly8gY29pbmNpZGVudGFsbHksIHRoaXMgaXMgYWN0dWFsbHkgV1lTSVdZR1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLl9jcmVhdGVEZWNvcmF0aW9uKGZhbHNlLCByZXNvbHZlZEtleWJpbmRpbmcuZ2V0TGFiZWwoKSwgdXNMYWJlbCwgbW9kZWwsIHZhbHVlKTtcblx0XHRcdH1cblx0XHRcdGlmICgvYWJudF98b2VtXy8udGVzdCh2YWx1ZS52YWx1ZSkpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZURlY29yYXRpb24oZmFsc2UsIHJlc29sdmVkS2V5YmluZGluZy5nZXRMYWJlbCgpLCB1c0xhYmVsLCBtb2RlbCwgdmFsdWUpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZXhwZWN0ZWRVc2VyU2V0dGluZ3NMYWJlbCA9IHJlc29sdmVkS2V5YmluZGluZy5nZXRVc2VyU2V0dGluZ3NMYWJlbCgpO1xuXHRcdFx0aWYgKHR5cGVvZiBleHBlY3RlZFVzZXJTZXR0aW5nc0xhYmVsID09PSAnc3RyaW5nJyAmJiAhS2V5YmluZGluZ0VkaXRvckRlY29yYXRpb25zUmVuZGVyZXIuX3VzZXJTZXR0aW5nc0Z1enp5RXF1YWxzKHZhbHVlLnZhbHVlLCBleHBlY3RlZFVzZXJTZXR0aW5nc0xhYmVsKSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlRGVjb3JhdGlvbihmYWxzZSwgcmVzb2x2ZWRLZXliaW5kaW5nLmdldExhYmVsKCksIHVzTGFiZWwsIG1vZGVsLCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRzdGF0aWMgX3VzZXJTZXR0aW5nc0Z1enp5RXF1YWxzKGE6IHN0cmluZywgYjogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0YSA9IGEudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cdFx0YiA9IGIudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cblx0XHRpZiAoYSA9PT0gYikge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYUtleWJpbmRpbmcgPSBLZXliaW5kaW5nUGFyc2VyLnBhcnNlS2V5YmluZGluZyhhKTtcblx0XHRjb25zdCBiS2V5YmluZGluZyA9IEtleWJpbmRpbmdQYXJzZXIucGFyc2VLZXliaW5kaW5nKGIpO1xuXHRcdGlmIChhS2V5YmluZGluZyA9PT0gbnVsbCAmJiBiS2V5YmluZGluZyA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmICghYUtleWJpbmRpbmcgfHwgIWJLZXliaW5kaW5nKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiBhS2V5YmluZGluZy5lcXVhbHMoYktleWJpbmRpbmcpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlRGVjb3JhdGlvbihpc0Vycm9yOiBib29sZWFuLCB1aUxhYmVsOiBzdHJpbmcgfCBudWxsLCB1c0xhYmVsOiBzdHJpbmcgfCBudWxsLCBtb2RlbDogSVRleHRNb2RlbCwga2V5Tm9kZTogTm9kZSk6IElNb2RlbERlbHRhRGVjb3JhdGlvbiB7XG5cdFx0bGV0IG1zZzogTWFya2Rvd25TdHJpbmc7XG5cdFx0bGV0IGNsYXNzTmFtZTogc3RyaW5nO1xuXHRcdGxldCBvdmVydmlld1J1bGVyQ29sb3I6IFRoZW1lQ29sb3I7XG5cblx0XHRpZiAoaXNFcnJvcikge1xuXHRcdFx0Ly8gdGhpcyBpcyB0aGUgZXJyb3IgY2FzZVxuXHRcdFx0bXNnID0gbmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kVGV4dChOTFNfS0JfTEFZT1VUX0VSUk9SX01FU1NBR0UpO1xuXHRcdFx0Y2xhc3NOYW1lID0gJ2tleWJpbmRpbmdFcnJvcic7XG5cdFx0XHRvdmVydmlld1J1bGVyQ29sb3IgPSB0aGVtZUNvbG9yRnJvbUlkKG92ZXJ2aWV3UnVsZXJFcnJvcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIHRoaXMgaXMgdGhlIGluZm8gY2FzZVxuXHRcdFx0aWYgKHVzTGFiZWwgJiYgdWlMYWJlbCAhPT0gdXNMYWJlbCkge1xuXHRcdFx0XHRtc2cgPSBuZXcgTWFya2Rvd25TdHJpbmcoXG5cdFx0XHRcdFx0bmxzLmxvY2FsaXplKHtcblx0XHRcdFx0XHRcdGtleTogJ2RlZmluZUtleWJpbmRpbmcua2JMYXlvdXRMb2NhbEFuZFVTTWVzc2FnZScsXG5cdFx0XHRcdFx0XHRjb21tZW50OiBbXG5cdFx0XHRcdFx0XHRcdCdQbGVhc2UgdHJhbnNsYXRlIG1haW50YWluaW5nIHRoZSBzdGFycyAoKikgYXJvdW5kIHRoZSBwbGFjZWhvbGRlcnMgc3VjaCB0aGF0IHRoZXkgd2lsbCBiZSByZW5kZXJlZCBpbiBib2xkLicsXG5cdFx0XHRcdFx0XHRcdCdUaGUgcGxhY2Vob2xkZXJzIHdpbGwgY29udGFpbiBhIGtleWJvYXJkIGNvbWJpbmF0aW9uIGUuZy4gQ3RybCtTaGlmdCsvJ1xuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH0sIFwiKip7MH0qKiBmb3IgeW91ciBjdXJyZW50IGtleWJvYXJkIGxheW91dCAoKip7MX0qKiBmb3IgVVMgc3RhbmRhcmQpLlwiLCB1aUxhYmVsLCB1c0xhYmVsKVxuXHRcdFx0XHQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bXNnID0gbmV3IE1hcmtkb3duU3RyaW5nKFxuXHRcdFx0XHRcdG5scy5sb2NhbGl6ZSh7XG5cdFx0XHRcdFx0XHRrZXk6ICdkZWZpbmVLZXliaW5kaW5nLmtiTGF5b3V0TG9jYWxNZXNzYWdlJyxcblx0XHRcdFx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0XHRcdFx0J1BsZWFzZSB0cmFuc2xhdGUgbWFpbnRhaW5pbmcgdGhlIHN0YXJzICgqKSBhcm91bmQgdGhlIHBsYWNlaG9sZGVyIHN1Y2ggdGhhdCBpdCB3aWxsIGJlIHJlbmRlcmVkIGluIGJvbGQuJyxcblx0XHRcdFx0XHRcdFx0J1RoZSBwbGFjZWhvbGRlciB3aWxsIGNvbnRhaW4gYSBrZXlib2FyZCBjb21iaW5hdGlvbiBlLmcuIEN0cmwrU2hpZnQrLydcblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9LCBcIioqezB9KiogZm9yIHlvdXIgY3VycmVudCBrZXlib2FyZCBsYXlvdXQuXCIsIHVpTGFiZWwpXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0XHRjbGFzc05hbWUgPSAna2V5YmluZGluZ0luZm8nO1xuXHRcdFx0b3ZlcnZpZXdSdWxlckNvbG9yID0gdGhlbWVDb2xvckZyb21JZChvdmVydmlld1J1bGVySW5mbyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhcnRQb3NpdGlvbiA9IG1vZGVsLmdldFBvc2l0aW9uQXQoa2V5Tm9kZS5vZmZzZXQpO1xuXHRcdGNvbnN0IGVuZFBvc2l0aW9uID0gbW9kZWwuZ2V0UG9zaXRpb25BdChrZXlOb2RlLm9mZnNldCArIGtleU5vZGUubGVuZ3RoKTtcblx0XHRjb25zdCByYW5nZSA9IG5ldyBSYW5nZShcblx0XHRcdHN0YXJ0UG9zaXRpb24ubGluZU51bWJlciwgc3RhcnRQb3NpdGlvbi5jb2x1bW4sXG5cdFx0XHRlbmRQb3NpdGlvbi5saW5lTnVtYmVyLCBlbmRQb3NpdGlvbi5jb2x1bW5cblx0XHQpO1xuXG5cdFx0Ly8gaWNvbiArIGhpZ2hsaWdodCArIG1lc3NhZ2UgZGVjb3JhdGlvblxuXHRcdHJldHVybiB7XG5cdFx0XHRyYW5nZTogcmFuZ2UsXG5cdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAna2V5YmluZGluZ3Mtd2lkZ2V0Jyxcblx0XHRcdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsXG5cdFx0XHRcdGNsYXNzTmFtZTogY2xhc3NOYW1lLFxuXHRcdFx0XHRob3Zlck1lc3NhZ2U6IG1zZyxcblx0XHRcdFx0b3ZlcnZpZXdSdWxlcjoge1xuXHRcdFx0XHRcdGNvbG9yOiBvdmVydmlld1J1bGVyQ29sb3IsXG5cdFx0XHRcdFx0cG9zaXRpb246IE92ZXJ2aWV3UnVsZXJMYW5lLlJpZ2h0XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cbn1cblxuZnVuY3Rpb24gaXNJbnRlcmVzdGluZ0VkaXRvck1vZGVsKGVkaXRvcjogSUNvZGVFZGl0b3IsIHVzZXJEYXRhUHJvZmlsZVNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlKTogYm9vbGVhbiB7XG5cdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdGlmICghbW9kZWwpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0cmV0dXJuIGlzRXF1YWwobW9kZWwudXJpLCB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmtleWJpbmRpbmdzUmVzb3VyY2UpO1xufVxuXG5yZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbihERUZJTkVfS0VZQklORElOR19FRElUT1JfQ09OVFJJQl9JRCwgRGVmaW5lS2V5YmluZGluZ0VkaXRvckNvbnRyaWJ1dGlvbiwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbi5BZnRlckZpcnN0UmVuZGVyKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsWUFBWSx5QkFBeUI7QUFDOUMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsNEJBQTRCLHVDQUF1QztBQUU1RSxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLGlCQUF1QjtBQUNoQyxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLG1CQUFtQiwwQkFBMEI7QUFDdEQsU0FBNEMsd0JBQXdCLHlCQUF5QjtBQUM3RixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUywrQkFBK0I7QUFDeEMsU0FBUywyQ0FBZ0Y7QUFHekYsTUFBTSw4QkFBOEIsSUFBSSxTQUFTLHlDQUF5Qyx1RkFBdUY7QUFFakwsSUFBTSxxQ0FBTixjQUFp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
