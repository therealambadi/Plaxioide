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
import { Gesture } from "../../../../base/browser/touch.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import "./lightBulbWidget.css";
import { ContentWidgetPositionPreference } from "../../../browser/editorBrowser.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { GlyphMarginLane, TrackedRangeStickiness } from "../../../common/model.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
import { computeIndentLevel } from "../../../common/model/utils.js";
import { autoFixCommandId, quickFixCommandId } from "./codeAction.js";
import * as nls from "../../../../nls.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { Range } from "../../../common/core/range.js";
const GUTTER_LIGHTBULB_ICON = registerIcon("gutter-lightbulb", Codicon.lightBulb, nls.localize("gutterLightbulbWidget", "Icon which spawns code actions menu from the gutter when there is no space in the editor."));
const GUTTER_LIGHTBULB_AUTO_FIX_ICON = registerIcon("gutter-lightbulb-auto-fix", Codicon.lightbulbAutofix, nls.localize("gutterLightbulbAutoFixWidget", "Icon which spawns code actions menu from the gutter when there is no space in the editor and a quick fix is available."));
const GUTTER_LIGHTBULB_AIFIX_ICON = registerIcon("gutter-lightbulb-sparkle", Codicon.lightbulbSparkle, nls.localize("gutterLightbulbAIFixWidget", "Icon which spawns code actions menu from the gutter when there is no space in the editor and an AI fix is available."));
const GUTTER_LIGHTBULB_AIFIX_AUTO_FIX_ICON = registerIcon("gutter-lightbulb-aifix-auto-fix", Codicon.lightbulbSparkleAutofix, nls.localize("gutterLightbulbAIFixAutoFixWidget", "Icon which spawns code actions menu from the gutter when there is no space in the editor and an AI fix and a quick fix is available."));
const GUTTER_SPARKLE_FILLED_ICON = registerIcon("gutter-lightbulb-sparkle-filled", Codicon.sparkleFilled, nls.localize("gutterLightbulbSparkleFilledWidget", "Icon which spawns code actions menu from the gutter when there is no space in the editor and an AI fix and a quick fix is available."));
var LightBulbState;
((LightBulbState2) => {
  let Type;
  ((Type2) => {
    Type2[Type2["Hidden"] = 0] = "Hidden";
    Type2[Type2["Showing"] = 1] = "Showing";
  })(Type = LightBulbState2.Type || (LightBulbState2.Type = {}));
  LightBulbState2.Hidden = { type: 0 /* Hidden */ };
  class Showing {
    constructor(actions, trigger, editorPosition, widgetPosition) {
      this.actions = actions;
      this.trigger = trigger;
      this.editorPosition = editorPosition;
      this.widgetPosition = widgetPosition;
      this.type = 1 /* Showing */;
    }
  }
  LightBulbState2.Showing = Showing;
})(LightBulbState || (LightBulbState = {}));
let LightBulbWidget = class extends Disposable {
  constructor(_editor, _keybindingService) {
    super();
    this._editor = _editor;
    this._keybindingService = _keybindingService;
    this._onClick = this._register(new Emitter());
    this.onClick = this._onClick.event;
    this._state = LightBulbState.Hidden;
    this._gutterState = LightBulbState.Hidden;
    this._iconClasses = [];
    this.lightbulbClasses = [
      "codicon-" + GUTTER_LIGHTBULB_ICON.id,
      "codicon-" + GUTTER_LIGHTBULB_AIFIX_AUTO_FIX_ICON.id,
      "codicon-" + GUTTER_LIGHTBULB_AUTO_FIX_ICON.id,
      "codicon-" + GUTTER_LIGHTBULB_AIFIX_ICON.id,
      "codicon-" + GUTTER_SPARKLE_FILLED_ICON.id
    ];
    this.gutterDecoration = LightBulbWidget.GUTTER_DECORATION;
    this._domNode = dom.$("div.lightBulbWidget");
    this._domNode.role = "listbox";
    this._register(Gesture.ignoreTarget(this._domNode));
    this._editor.addContentWidget(this);
    this._register(this._editor.onDidChangeModelContent((_) => {
      const editorModel = this._editor.getModel();
      if (this.state.type !== 1 /* Showing */ || !editorModel || this.state.editorPosition.lineNumber >= editorModel.getLineCount()) {
        this.hide();
      }
      if (this.gutterState.type !== 1 /* Showing */ || !editorModel || this.gutterState.editorPosition.lineNumber >= editorModel.getLineCount()) {
        this.gutterHide();
      }
    }));
    this._register(dom.addStandardDisposableGenericMouseDownListener(this._domNode, (e) => {
      if (this.state.type !== 1 /* Showing */) {
        return;
      }
      this._editor.focus();
      e.preventDefault();
      const { top, height } = dom.getDomNodePagePosition(this._domNode);
      const lineHeight = this._editor.getOption(EditorOption.lineHeight);
      let pad = Math.floor(lineHeight / 3);
      if (this.state.widgetPosition.position !== null && this.state.widgetPosition.position.lineNumber < this.state.editorPosition.lineNumber) {
        pad += lineHeight;
      }
      this._onClick.fire({
        x: e.posx,
        y: top + height + pad,
        actions: this.state.actions,
        trigger: this.state.trigger
      });
    }));
    this._register(dom.addDisposableListener(this._domNode, "mouseenter", (e) => {
      if ((e.buttons & 1) !== 1) {
        return;
      }
      this.hide();
    }));
    this._register(Event.runAndSubscribe(this._keybindingService.onDidUpdateKeybindings, () => {
      this._preferredKbLabel = this._keybindingService.lookupKeybinding(autoFixCommandId)?.getLabel() ?? void 0;
      this._quickFixKbLabel = this._keybindingService.lookupKeybinding(quickFixCommandId)?.getLabel() ?? void 0;
      this._updateLightBulbTitleAndIcon();
    }));
    this._register(this._editor.onMouseDown(async (e) => {
      if (!e.target.element || !this.lightbulbClasses.some((cls) => e.target.element && e.target.element.classList.contains(cls))) {
        return;
      }
      if (this.gutterState.type !== 1 /* Showing */) {
        return;
      }
      this._editor.focus();
      const { top, height } = dom.getDomNodePagePosition(e.target.element);
      const lineHeight = this._editor.getOption(EditorOption.lineHeight);
      let pad = Math.floor(lineHeight / 3);
      if (this.gutterState.widgetPosition.position !== null && this.gutterState.widgetPosition.position.lineNumber < this.gutterState.editorPosition.lineNumber) {
        pad += lineHeight;
      }
      this._onClick.fire({
        x: e.event.posx,
        y: top + height + pad,
        actions: this.gutterState.actions,
        trigger: this.gutterState.trigger
      });
    }));
  }
  dispose() {
    super.dispose();
    this._editor.removeContentWidget(this);
    if (this._gutterDecorationID) {
      this._removeGutterDecoration(this._gutterDecorationID);
    }
  }
  getId() {
    return "LightBulbWidget";
  }
  getDomNode() {
    return this._domNode;
  }
  getPosition() {
    return this._state.type === 1 /* Showing */ ? this._state.widgetPosition : null;
  }
  update(actions, trigger, atPosition) {
    if (actions.validActions.length <= 0) {
      this.gutterHide();
      return this.hide();
    }
    const hasTextFocus = this._editor.hasTextFocus();
    if (!hasTextFocus) {
      this.gutterHide();
      return this.hide();
    }
    const options = this._editor.getOptions();
    if (!options.get(EditorOption.lightbulb).enabled) {
      this.gutterHide();
      return this.hide();
    }
    const model = this._editor.getModel();
    if (!model) {
      this.gutterHide();
      return this.hide();
    }
    const { lineNumber, column } = model.validatePosition(atPosition);
    const tabSize = model.getOptions().tabSize;
    const fontInfo = this._editor.getOptions().get(EditorOption.fontInfo);
    const lineContent = model.getLineContent(lineNumber);
    const indent = computeIndentLevel(lineContent, tabSize);
    const lineHasSpace = fontInfo.spaceWidth * indent > 22;
    const isFolded = (lineNumber2) => {
      return lineNumber2 > 2 && this._editor.getTopForLineNumber(lineNumber2) === this._editor.getTopForLineNumber(lineNumber2 - 1);
    };
    const currLineDecorations = this._editor.getLineDecorations(lineNumber);
    let hasDecoration = false;
    if (currLineDecorations) {
      for (const decoration of currLineDecorations) {
        const glyphClass = decoration.options.glyphMarginClassName;
        if (glyphClass && !this.lightbulbClasses.some((className) => glyphClass.includes(className))) {
          hasDecoration = true;
          break;
        }
      }
    }
    let effectiveLineNumber = lineNumber;
    let effectiveColumnNumber = 1;
    if (!lineHasSpace) {
      const isLineEmptyOrIndented = (lineNumber2) => {
        const lineContent2 = model.getLineContent(lineNumber2);
        return /^\s*$|^\s+/.test(lineContent2) || lineContent2.length <= effectiveColumnNumber;
      };
      if (lineNumber > 1 && !isFolded(lineNumber - 1)) {
        const lineCount = model.getLineCount();
        const endLine = lineNumber === lineCount;
        const prevLineEmptyOrIndented = lineNumber > 1 && isLineEmptyOrIndented(lineNumber - 1);
        const nextLineEmptyOrIndented = !endLine && isLineEmptyOrIndented(lineNumber + 1);
        const currLineEmptyOrIndented = isLineEmptyOrIndented(lineNumber);
        const notEmpty = !nextLineEmptyOrIndented && !prevLineEmptyOrIndented;
        if (!nextLineEmptyOrIndented && !prevLineEmptyOrIndented && !hasDecoration) {
          this.gutterState = new LightBulbState.Showing(actions, trigger, atPosition, {
            position: { lineNumber: effectiveLineNumber, column: effectiveColumnNumber },
            preference: LightBulbWidget._posPref
          });
          this.renderGutterLightbub();
          return this.hide();
        } else if (prevLineEmptyOrIndented || endLine || prevLineEmptyOrIndented && !currLineEmptyOrIndented) {
          effectiveLineNumber -= 1;
        } else if (nextLineEmptyOrIndented || notEmpty && currLineEmptyOrIndented) {
          effectiveLineNumber += 1;
        }
      } else if (lineNumber === 1 && (lineNumber === model.getLineCount() || !isLineEmptyOrIndented(lineNumber + 1) && !isLineEmptyOrIndented(lineNumber))) {
        this.gutterState = new LightBulbState.Showing(actions, trigger, atPosition, {
          position: { lineNumber: effectiveLineNumber, column: effectiveColumnNumber },
          preference: LightBulbWidget._posPref
        });
        if (hasDecoration) {
          this.gutterHide();
        } else {
          this.renderGutterLightbub();
          return this.hide();
        }
      } else if (lineNumber < model.getLineCount() && !isFolded(lineNumber + 1)) {
        effectiveLineNumber += 1;
      } else if (column * fontInfo.spaceWidth < 22) {
        return this.hide();
      }
      effectiveColumnNumber = /^\S\s*$/.test(model.getLineContent(effectiveLineNumber)) ? 2 : 1;
    }
    this.state = new LightBulbState.Showing(actions, trigger, atPosition, {
      position: { lineNumber: effectiveLineNumber, column: effectiveColumnNumber },
      preference: LightBulbWidget._posPref
    });
    if (this._gutterDecorationID) {
      this._removeGutterDecoration(this._gutterDecorationID);
      this.gutterHide();
    }
    const validActions = actions.validActions;
    const actionKind = actions.validActions[0].action.kind;
    if (validActions.length !== 1 || !actionKind) {
      this._editor.layoutContentWidget(this);
      return;
    }
    this._editor.layoutContentWidget(this);
  }
  hide() {
    if (this.state === LightBulbState.Hidden) {
      return;
    }
    this.state = LightBulbState.Hidden;
    this._editor.layoutContentWidget(this);
  }
  gutterHide() {
    if (this.gutterState === LightBulbState.Hidden) {
      return;
    }
    if (this._gutterDecorationID) {
      this._removeGutterDecoration(this._gutterDecorationID);
    }
    this.gutterState = LightBulbState.Hidden;
  }
  get state() {
    return this._state;
  }
  set state(value) {
    this._state = value;
    this._updateLightBulbTitleAndIcon();
  }
  get gutterState() {
    return this._gutterState;
  }
  set gutterState(value) {
    this._gutterState = value;
    this._updateGutterLightBulbTitleAndIcon();
  }
  _updateLightBulbTitleAndIcon() {
    this._domNode.classList.remove(...this._iconClasses);
    this._iconClasses = [];
    if (this.state.type !== 1 /* Showing */) {
      return;
    }
    let icon;
    let autoRun = false;
    if (this.state.actions.allAIFixes) {
      icon = Codicon.sparkleFilled;
      if (this.state.actions.validActions.length === 1) {
        autoRun = true;
      }
    } else if (this.state.actions.hasAutoFix) {
      if (this.state.actions.hasAIFix) {
        icon = Codicon.lightbulbSparkleAutofix;
      } else {
        icon = Codicon.lightbulbAutofix;
      }
    } else if (this.state.actions.hasAIFix) {
      icon = Codicon.lightbulbSparkle;
    } else {
      icon = Codicon.lightBulb;
    }
    this._updateLightbulbTitle(this.state.actions.hasAutoFix, autoRun);
    this._iconClasses = ThemeIcon.asClassNameArray(icon);
    this._domNode.classList.add(...this._iconClasses);
  }
  _updateGutterLightBulbTitleAndIcon() {
    if (this.gutterState.type !== 1 /* Showing */) {
      return;
    }
    let icon;
    let autoRun = false;
    if (this.gutterState.actions.allAIFixes) {
      icon = GUTTER_SPARKLE_FILLED_ICON;
      if (this.gutterState.actions.validActions.length === 1) {
        autoRun = true;
      }
    } else if (this.gutterState.actions.hasAutoFix) {
      if (this.gutterState.actions.hasAIFix) {
        icon = GUTTER_LIGHTBULB_AIFIX_AUTO_FIX_ICON;
      } else {
        icon = GUTTER_LIGHTBULB_AUTO_FIX_ICON;
      }
    } else if (this.gutterState.actions.hasAIFix) {
      icon = GUTTER_LIGHTBULB_AIFIX_ICON;
    } else {
      icon = GUTTER_LIGHTBULB_ICON;
    }
    this._updateLightbulbTitle(this.gutterState.actions.hasAutoFix, autoRun);
    const GUTTER_DECORATION = ModelDecorationOptions.register({
      description: "codicon-gutter-lightbulb-decoration",
      glyphMarginClassName: ThemeIcon.asClassName(icon),
      glyphMargin: { position: GlyphMarginLane.Left },
      stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
    });
    this.gutterDecoration = GUTTER_DECORATION;
  }
  /* Gutter Helper Functions */
  renderGutterLightbub() {
    const selection = this._editor.getSelection();
    if (!selection) {
      return;
    }
    if (this._gutterDecorationID === void 0) {
      this._addGutterDecoration(selection.startLineNumber);
    } else {
      this._updateGutterDecoration(this._gutterDecorationID, selection.startLineNumber);
    }
  }
  _addGutterDecoration(lineNumber) {
    this._editor.changeDecorations((accessor) => {
      this._gutterDecorationID = accessor.addDecoration(new Range(lineNumber, 0, lineNumber, 0), this.gutterDecoration);
    });
  }
  _removeGutterDecoration(decorationId) {
    this._editor.changeDecorations((accessor) => {
      accessor.removeDecoration(decorationId);
      this._gutterDecorationID = void 0;
    });
  }
  _updateGutterDecoration(decorationId, lineNumber) {
    this._editor.changeDecorations((accessor) => {
      accessor.changeDecoration(decorationId, new Range(lineNumber, 0, lineNumber, 0));
      accessor.changeDecorationOptions(decorationId, this.gutterDecoration);
    });
  }
  _updateLightbulbTitle(autoFix, autoRun) {
    if (this.state.type !== 1 /* Showing */) {
      return;
    }
    if (autoRun) {
      this.title = nls.localize("codeActionAutoRun", "Run: {0}", this.state.actions.validActions[0].action.title);
    } else if (autoFix && this._preferredKbLabel) {
      this.title = nls.localize("preferredcodeActionWithKb", "Show Code Actions. Preferred Quick Fix Available ({0})", this._preferredKbLabel);
    } else if (!autoFix && this._quickFixKbLabel) {
      this.title = nls.localize("codeActionWithKb", "Show Code Actions ({0})", this._quickFixKbLabel);
    } else if (!autoFix) {
      this.title = nls.localize("codeAction", "Show Code Actions");
    }
  }
  set title(value) {
    this._domNode.title = value;
  }
};
LightBulbWidget.GUTTER_DECORATION = ModelDecorationOptions.register({
  description: "codicon-gutter-lightbulb-decoration",
  glyphMarginClassName: ThemeIcon.asClassName(Codicon.lightBulb),
  glyphMargin: { position: GlyphMarginLane.Left },
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
});
LightBulbWidget.ID = "editor.contrib.lightbulbWidget";
LightBulbWidget._posPref = [ContentWidgetPositionPreference.EXACT];
LightBulbWidget = __decorateClass([
  __decorateParam(1, IKeybindingService)
], LightBulbWidget);
export {
  LightBulbWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9jb2RlQWN0aW9uL2Jyb3dzZXIvbGlnaHRCdWxiV2lkZ2V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgR2VzdHVyZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci90b3VjaC5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgJy4vbGlnaHRCdWxiV2lkZ2V0LmNzcyc7XG5pbXBvcnQgeyBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLCBJQ29kZUVkaXRvciwgSUNvbnRlbnRXaWRnZXQsIElDb250ZW50V2lkZ2V0UG9zaXRpb24sIElFZGl0b3JNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBHbHlwaE1hcmdpbkxhbmUsIElNb2RlbERlY29yYXRpb25zQ2hhbmdlQWNjZXNzb3IsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgY29tcHV0ZUluZGVudExldmVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsL3V0aWxzLmpzJztcbmltcG9ydCB7IGF1dG9GaXhDb21tYW5kSWQsIHF1aWNrRml4Q29tbWFuZElkIH0gZnJvbSAnLi9jb2RlQWN0aW9uLmpzJztcbmltcG9ydCB7IENvZGVBY3Rpb25TZXQsIENvZGVBY3Rpb25UcmlnZ2VyIH0gZnJvbSAnLi4vY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlckljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuXG5jb25zdCBHVVRURVJfTElHSFRCVUxCX0lDT04gPSByZWdpc3Rlckljb24oJ2d1dHRlci1saWdodGJ1bGInLCBDb2RpY29uLmxpZ2h0QnVsYiwgbmxzLmxvY2FsaXplKCdndXR0ZXJMaWdodGJ1bGJXaWRnZXQnLCAnSWNvbiB3aGljaCBzcGF3bnMgY29kZSBhY3Rpb25zIG1lbnUgZnJvbSB0aGUgZ3V0dGVyIHdoZW4gdGhlcmUgaXMgbm8gc3BhY2UgaW4gdGhlIGVkaXRvci4nKSk7XG5jb25zdCBHVVRURVJfTElHSFRCVUxCX0FVVE9fRklYX0lDT04gPSByZWdpc3Rlckljb24oJ2d1dHRlci1saWdodGJ1bGItYXV0by1maXgnLCBDb2RpY29uLmxpZ2h0YnVsYkF1dG9maXgsIG5scy5sb2NhbGl6ZSgnZ3V0dGVyTGlnaHRidWxiQXV0b0ZpeFdpZGdldCcsICdJY29uIHdoaWNoIHNwYXducyBjb2RlIGFjdGlvbnMgbWVudSBmcm9tIHRoZSBndXR0ZXIgd2hlbiB0aGVyZSBpcyBubyBzcGFjZSBpbiB0aGUgZWRpdG9yIGFuZCBhIHF1aWNrIGZpeCBpcyBhdmFpbGFibGUuJykpO1xuY29uc3QgR1VUVEVSX0xJR0hUQlVMQl9BSUZJWF9JQ09OID0gcmVnaXN0ZXJJY29uKCdndXR0ZXItbGlnaHRidWxiLXNwYXJrbGUnLCBDb2RpY29uLmxpZ2h0YnVsYlNwYXJrbGUsIG5scy5sb2NhbGl6ZSgnZ3V0dGVyTGlnaHRidWxiQUlGaXhXaWRnZXQnLCAnSWNvbiB3aGljaCBzcGF3bnMgY29kZSBhY3Rpb25zIG1lbnUgZnJvbSB0aGUgZ3V0dGVyIHdoZW4gdGhlcmUgaXMgbm8gc3BhY2UgaW4gdGhlIGVkaXRvciBhbmQgYW4gQUkgZml4IGlzIGF2YWlsYWJsZS4nKSk7XG5jb25zdCBHVVRURVJfTElHSFRCVUxCX0FJRklYX0FVVE9fRklYX0lDT04gPSByZWdpc3Rlckljb24oJ2d1dHRlci1saWdodGJ1bGItYWlmaXgtYXV0by1maXgnLCBDb2RpY29uLmxpZ2h0YnVsYlNwYXJrbGVBdXRvZml4LCBubHMubG9jYWxpemUoJ2d1dHRlckxpZ2h0YnVsYkFJRml4QXV0b0ZpeFdpZGdldCcsICdJY29uIHdoaWNoIHNwYXducyBjb2RlIGFjdGlvbnMgbWVudSBmcm9tIHRoZSBndXR0ZXIgd2hlbiB0aGVyZSBpcyBubyBzcGFjZSBpbiB0aGUgZWRpdG9yIGFuZCBhbiBBSSBmaXggYW5kIGEgcXVpY2sgZml4IGlzIGF2YWlsYWJsZS4nKSk7XG5jb25zdCBHVVRURVJfU1BBUktMRV9GSUxMRURfSUNPTiA9IHJlZ2lzdGVySWNvbignZ3V0dGVyLWxpZ2h0YnVsYi1zcGFya2xlLWZpbGxlZCcsIENvZGljb24uc3BhcmtsZUZpbGxlZCwgbmxzLmxvY2FsaXplKCdndXR0ZXJMaWdodGJ1bGJTcGFya2xlRmlsbGVkV2lkZ2V0JywgJ0ljb24gd2hpY2ggc3Bhd25zIGNvZGUgYWN0aW9ucyBtZW51IGZyb20gdGhlIGd1dHRlciB3aGVuIHRoZXJlIGlzIG5vIHNwYWNlIGluIHRoZSBlZGl0b3IgYW5kIGFuIEFJIGZpeCBhbmQgYSBxdWljayBmaXggaXMgYXZhaWxhYmxlLicpKTtcblxubmFtZXNwYWNlIExpZ2h0QnVsYlN0YXRlIHtcblxuXHRleHBvcnQgY29uc3QgZW51bSBUeXBlIHtcblx0XHRIaWRkZW4sXG5cdFx0U2hvd2luZyxcblx0fVxuXG5cdGV4cG9ydCBjb25zdCBIaWRkZW4gPSB7IHR5cGU6IFR5cGUuSGlkZGVuIH0gYXMgY29uc3Q7XG5cblx0ZXhwb3J0IGNsYXNzIFNob3dpbmcge1xuXHRcdHJlYWRvbmx5IHR5cGUgPSBUeXBlLlNob3dpbmc7XG5cblx0XHRjb25zdHJ1Y3Rvcihcblx0XHRcdHB1YmxpYyByZWFkb25seSBhY3Rpb25zOiBDb2RlQWN0aW9uU2V0LFxuXHRcdFx0cHVibGljIHJlYWRvbmx5IHRyaWdnZXI6IENvZGVBY3Rpb25UcmlnZ2VyLFxuXHRcdFx0cHVibGljIHJlYWRvbmx5IGVkaXRvclBvc2l0aW9uOiBJUG9zaXRpb24sXG5cdFx0XHRwdWJsaWMgcmVhZG9ubHkgd2lkZ2V0UG9zaXRpb246IElDb250ZW50V2lkZ2V0UG9zaXRpb24sXG5cdFx0KSB7IH1cblx0fVxuXG5cdGV4cG9ydCB0eXBlIFN0YXRlID0gdHlwZW9mIEhpZGRlbiB8IFNob3dpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBMaWdodEJ1bGJXaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNvbnRlbnRXaWRnZXQge1xuXHRwcml2YXRlIF9ndXR0ZXJEZWNvcmF0aW9uSUQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBHVVRURVJfREVDT1JBVElPTiA9IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMucmVnaXN0ZXIoe1xuXHRcdGRlc2NyaXB0aW9uOiAnY29kaWNvbi1ndXR0ZXItbGlnaHRidWxiLWRlY29yYXRpb24nLFxuXHRcdGdseXBoTWFyZ2luQ2xhc3NOYW1lOiBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5saWdodEJ1bGIpLFxuXHRcdGdseXBoTWFyZ2luOiB7IHBvc2l0aW9uOiBHbHlwaE1hcmdpbkxhbmUuTGVmdCB9LFxuXHRcdHN0aWNraW5lc3M6IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gJ2VkaXRvci5jb250cmliLmxpZ2h0YnVsYldpZGdldCc7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX3Bvc1ByZWYgPSBbQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5FWEFDVF07XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZG9tTm9kZTogSFRNTEVsZW1lbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25DbGljayA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgcmVhZG9ubHkgeDogbnVtYmVyOyByZWFkb25seSB5OiBudW1iZXI7IHJlYWRvbmx5IGFjdGlvbnM6IENvZGVBY3Rpb25TZXQ7IHJlYWRvbmx5IHRyaWdnZXI6IENvZGVBY3Rpb25UcmlnZ2VyIH0+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25DbGljayA9IHRoaXMuX29uQ2xpY2suZXZlbnQ7XG5cblx0cHJpdmF0ZSBfc3RhdGU6IExpZ2h0QnVsYlN0YXRlLlN0YXRlID0gTGlnaHRCdWxiU3RhdGUuSGlkZGVuO1xuXHRwcml2YXRlIF9ndXR0ZXJTdGF0ZTogTGlnaHRCdWxiU3RhdGUuU3RhdGUgPSBMaWdodEJ1bGJTdGF0ZS5IaWRkZW47XG5cdHByaXZhdGUgX2ljb25DbGFzc2VzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbGlnaHRidWxiQ2xhc3NlcyA9IFtcblx0XHQnY29kaWNvbi0nICsgR1VUVEVSX0xJR0hUQlVMQl9JQ09OLmlkLFxuXHRcdCdjb2RpY29uLScgKyBHVVRURVJfTElHSFRCVUxCX0FJRklYX0FVVE9fRklYX0lDT04uaWQsXG5cdFx0J2NvZGljb24tJyArIEdVVFRFUl9MSUdIVEJVTEJfQVVUT19GSVhfSUNPTi5pZCxcblx0XHQnY29kaWNvbi0nICsgR1VUVEVSX0xJR0hUQlVMQl9BSUZJWF9JQ09OLmlkLFxuXHRcdCdjb2RpY29uLScgKyBHVVRURVJfU1BBUktMRV9GSUxMRURfSUNPTi5pZFxuXHRdO1xuXG5cdHByaXZhdGUgX3ByZWZlcnJlZEtiTGFiZWw/OiBzdHJpbmc7XG5cdHByaXZhdGUgX3F1aWNrRml4S2JMYWJlbD86IHN0cmluZztcblxuXHRwcml2YXRlIGd1dHRlckRlY29yYXRpb246IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgPSBMaWdodEJ1bGJXaWRnZXQuR1VUVEVSX0RFQ09SQVRJT047XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX2RvbU5vZGUgPSBkb20uJCgnZGl2LmxpZ2h0QnVsYldpZGdldCcpO1xuXHRcdHRoaXMuX2RvbU5vZGUucm9sZSA9ICdsaXN0Ym94Jztcblx0XHR0aGlzLl9yZWdpc3RlcihHZXN0dXJlLmlnbm9yZVRhcmdldCh0aGlzLl9kb21Ob2RlKSk7XG5cblx0XHR0aGlzLl9lZGl0b3IuYWRkQ29udGVudFdpZGdldCh0aGlzKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudChfID0+IHtcblx0XHRcdC8vIGNhbmNlbCB3aGVuIHRoZSBsaW5lIGluIHF1ZXN0aW9uIGhhcyBiZWVuIHJlbW92ZWRcblx0XHRcdGNvbnN0IGVkaXRvck1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHRpZiAodGhpcy5zdGF0ZS50eXBlICE9PSBMaWdodEJ1bGJTdGF0ZS5UeXBlLlNob3dpbmcgfHwgIWVkaXRvck1vZGVsIHx8IHRoaXMuc3RhdGUuZWRpdG9yUG9zaXRpb24ubGluZU51bWJlciA+PSBlZGl0b3JNb2RlbC5nZXRMaW5lQ291bnQoKSkge1xuXHRcdFx0XHR0aGlzLmhpZGUoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuZ3V0dGVyU3RhdGUudHlwZSAhPT0gTGlnaHRCdWxiU3RhdGUuVHlwZS5TaG93aW5nIHx8ICFlZGl0b3JNb2RlbCB8fCB0aGlzLmd1dHRlclN0YXRlLmVkaXRvclBvc2l0aW9uLmxpbmVOdW1iZXIgPj0gZWRpdG9yTW9kZWwuZ2V0TGluZUNvdW50KCkpIHtcblx0XHRcdFx0dGhpcy5ndXR0ZXJIaWRlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZFN0YW5kYXJkRGlzcG9zYWJsZUdlbmVyaWNNb3VzZURvd25MaXN0ZW5lcih0aGlzLl9kb21Ob2RlLCBlID0+IHtcblx0XHRcdGlmICh0aGlzLnN0YXRlLnR5cGUgIT09IExpZ2h0QnVsYlN0YXRlLlR5cGUuU2hvd2luZykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIE1ha2Ugc3VyZSB0aGF0IGZvY3VzIC8gY3Vyc29yIGxvY2F0aW9uIGlzIG5vdCBsb3N0IHdoZW4gY2xpY2tpbmcgd2lkZ2V0IGljb25cblx0XHRcdHRoaXMuX2VkaXRvci5mb2N1cygpO1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHQvLyBhIGJpdCBvZiBleHRyYSB3b3JrIHRvIG1ha2Ugc3VyZSB0aGUgbWVudVxuXHRcdFx0Ly8gZG9lc24ndCBjb3ZlciB0aGUgbGluZS10ZXh0XG5cdFx0XHRjb25zdCB7IHRvcCwgaGVpZ2h0IH0gPSBkb20uZ2V0RG9tTm9kZVBhZ2VQb3NpdGlvbih0aGlzLl9kb21Ob2RlKTtcblx0XHRcdGNvbnN0IGxpbmVIZWlnaHQgPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblxuXHRcdFx0bGV0IHBhZCA9IE1hdGguZmxvb3IobGluZUhlaWdodCAvIDMpO1xuXHRcdFx0aWYgKHRoaXMuc3RhdGUud2lkZ2V0UG9zaXRpb24ucG9zaXRpb24gIT09IG51bGwgJiYgdGhpcy5zdGF0ZS53aWRnZXRQb3NpdGlvbi5wb3NpdGlvbi5saW5lTnVtYmVyIDwgdGhpcy5zdGF0ZS5lZGl0b3JQb3NpdGlvbi5saW5lTnVtYmVyKSB7XG5cdFx0XHRcdHBhZCArPSBsaW5lSGVpZ2h0O1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9vbkNsaWNrLmZpcmUoe1xuXHRcdFx0XHR4OiBlLnBvc3gsXG5cdFx0XHRcdHk6IHRvcCArIGhlaWdodCArIHBhZCxcblx0XHRcdFx0YWN0aW9uczogdGhpcy5zdGF0ZS5hY3Rpb25zLFxuXHRcdFx0XHR0cmlnZ2VyOiB0aGlzLnN0YXRlLnRyaWdnZXIsXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2RvbU5vZGUsICdtb3VzZWVudGVyJywgKGU6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdGlmICgoZS5idXR0b25zICYgMSkgIT09IDEpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Ly8gbW91c2UgZW50ZXJzIGxpZ2h0YnVsYiB3aGlsZSB0aGUgcHJpbWFyeS9sZWZ0IGJ1dHRvblxuXHRcdFx0Ly8gaXMgYmVpbmcgcHJlc3NlZCAtPiBoaWRlIHRoZSBsaWdodGJ1bGJcblx0XHRcdHRoaXMuaGlkZSgpO1xuXHRcdH0pKTtcblxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQucnVuQW5kU3Vic2NyaWJlKHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLm9uRGlkVXBkYXRlS2V5YmluZGluZ3MsICgpID0+IHtcblx0XHRcdHRoaXMuX3ByZWZlcnJlZEtiTGFiZWwgPSB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGF1dG9GaXhDb21tYW5kSWQpPy5nZXRMYWJlbCgpID8/IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX3F1aWNrRml4S2JMYWJlbCA9IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcocXVpY2tGaXhDb21tYW5kSWQpPy5nZXRMYWJlbCgpID8/IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX3VwZGF0ZUxpZ2h0QnVsYlRpdGxlQW5kSWNvbigpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbk1vdXNlRG93bihhc3luYyAoZTogSUVkaXRvck1vdXNlRXZlbnQpID0+IHtcblxuXHRcdFx0aWYgKCFlLnRhcmdldC5lbGVtZW50IHx8ICF0aGlzLmxpZ2h0YnVsYkNsYXNzZXMuc29tZShjbHMgPT4gZS50YXJnZXQuZWxlbWVudCAmJiBlLnRhcmdldC5lbGVtZW50LmNsYXNzTGlzdC5jb250YWlucyhjbHMpKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmd1dHRlclN0YXRlLnR5cGUgIT09IExpZ2h0QnVsYlN0YXRlLlR5cGUuU2hvd2luZykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIE1ha2Ugc3VyZSB0aGF0IGZvY3VzIC8gY3Vyc29yIGxvY2F0aW9uIGlzIG5vdCBsb3N0IHdoZW4gY2xpY2tpbmcgd2lkZ2V0IGljb25cblx0XHRcdHRoaXMuX2VkaXRvci5mb2N1cygpO1xuXG5cdFx0XHQvLyBhIGJpdCBvZiBleHRyYSB3b3JrIHRvIG1ha2Ugc3VyZSB0aGUgbWVudVxuXHRcdFx0Ly8gZG9lc24ndCBjb3ZlciB0aGUgbGluZS10ZXh0XG5cdFx0XHRjb25zdCB7IHRvcCwgaGVpZ2h0IH0gPSBkb20uZ2V0RG9tTm9kZVBhZ2VQb3NpdGlvbihlLnRhcmdldC5lbGVtZW50KTtcblx0XHRcdGNvbnN0IGxpbmVIZWlnaHQgPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblxuXHRcdFx0bGV0IHBhZCA9IE1hdGguZmxvb3IobGluZUhlaWdodCAvIDMpO1xuXHRcdFx0aWYgKHRoaXMuZ3V0dGVyU3RhdGUud2lkZ2V0UG9zaXRpb24ucG9zaXRpb24gIT09IG51bGwgJiYgdGhpcy5ndXR0ZXJTdGF0ZS53aWRnZXRQb3NpdGlvbi5wb3NpdGlvbi5saW5lTnVtYmVyIDwgdGhpcy5ndXR0ZXJTdGF0ZS5lZGl0b3JQb3NpdGlvbi5saW5lTnVtYmVyKSB7XG5cdFx0XHRcdHBhZCArPSBsaW5lSGVpZ2h0O1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9vbkNsaWNrLmZpcmUoe1xuXHRcdFx0XHR4OiBlLmV2ZW50LnBvc3gsXG5cdFx0XHRcdHk6IHRvcCArIGhlaWdodCArIHBhZCxcblx0XHRcdFx0YWN0aW9uczogdGhpcy5ndXR0ZXJTdGF0ZS5hY3Rpb25zLFxuXHRcdFx0XHR0cmlnZ2VyOiB0aGlzLmd1dHRlclN0YXRlLnRyaWdnZXIsXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9lZGl0b3IucmVtb3ZlQ29udGVudFdpZGdldCh0aGlzKTtcblx0XHRpZiAodGhpcy5fZ3V0dGVyRGVjb3JhdGlvbklEKSB7XG5cdFx0XHR0aGlzLl9yZW1vdmVHdXR0ZXJEZWNvcmF0aW9uKHRoaXMuX2d1dHRlckRlY29yYXRpb25JRCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gJ0xpZ2h0QnVsYldpZGdldCc7XG5cdH1cblxuXHRnZXREb21Ob2RlKCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5fZG9tTm9kZTtcblx0fVxuXG5cdGdldFBvc2l0aW9uKCk6IElDb250ZW50V2lkZ2V0UG9zaXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RhdGUudHlwZSA9PT0gTGlnaHRCdWxiU3RhdGUuVHlwZS5TaG93aW5nID8gdGhpcy5fc3RhdGUud2lkZ2V0UG9zaXRpb24gOiBudWxsO1xuXHR9XG5cblx0cHVibGljIHVwZGF0ZShhY3Rpb25zOiBDb2RlQWN0aW9uU2V0LCB0cmlnZ2VyOiBDb2RlQWN0aW9uVHJpZ2dlciwgYXRQb3NpdGlvbjogSVBvc2l0aW9uKSB7XG5cdFx0aWYgKGFjdGlvbnMudmFsaWRBY3Rpb25zLmxlbmd0aCA8PSAwKSB7XG5cdFx0XHR0aGlzLmd1dHRlckhpZGUoKTtcblx0XHRcdHJldHVybiB0aGlzLmhpZGUoKTtcblx0XHR9XG5cblx0XHRjb25zdCBoYXNUZXh0Rm9jdXMgPSB0aGlzLl9lZGl0b3IuaGFzVGV4dEZvY3VzKCk7XG5cdFx0aWYgKCFoYXNUZXh0Rm9jdXMpIHtcblx0XHRcdHRoaXMuZ3V0dGVySGlkZSgpO1xuXHRcdFx0cmV0dXJuIHRoaXMuaGlkZSgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9ucygpO1xuXHRcdGlmICghb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxpZ2h0YnVsYikuZW5hYmxlZCkge1xuXHRcdFx0dGhpcy5ndXR0ZXJIaWRlKCk7XG5cdFx0XHRyZXR1cm4gdGhpcy5oaWRlKCk7XG5cdFx0fVxuXG5cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHRoaXMuZ3V0dGVySGlkZSgpO1xuXHRcdFx0cmV0dXJuIHRoaXMuaGlkZSgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgbGluZU51bWJlciwgY29sdW1uIH0gPSBtb2RlbC52YWxpZGF0ZVBvc2l0aW9uKGF0UG9zaXRpb24pO1xuXG5cdFx0Y29uc3QgdGFiU2l6ZSA9IG1vZGVsLmdldE9wdGlvbnMoKS50YWJTaXplO1xuXHRcdGNvbnN0IGZvbnRJbmZvID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbnMoKS5nZXQoRWRpdG9yT3B0aW9uLmZvbnRJbmZvKTtcblx0XHRjb25zdCBsaW5lQ29udGVudCA9IG1vZGVsLmdldExpbmVDb250ZW50KGxpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IGluZGVudCA9IGNvbXB1dGVJbmRlbnRMZXZlbChsaW5lQ29udGVudCwgdGFiU2l6ZSk7XG5cdFx0Y29uc3QgbGluZUhhc1NwYWNlID0gZm9udEluZm8uc3BhY2VXaWR0aCAqIGluZGVudCA+IDIyO1xuXHRcdGNvbnN0IGlzRm9sZGVkID0gKGxpbmVOdW1iZXI6IG51bWJlcikgPT4ge1xuXHRcdFx0cmV0dXJuIGxpbmVOdW1iZXIgPiAyICYmIHRoaXMuX2VkaXRvci5nZXRUb3BGb3JMaW5lTnVtYmVyKGxpbmVOdW1iZXIpID09PSB0aGlzLl9lZGl0b3IuZ2V0VG9wRm9yTGluZU51bWJlcihsaW5lTnVtYmVyIC0gMSk7XG5cdFx0fTtcblxuXHRcdC8vIENoZWNrIGZvciBnbHlwaCBtYXJnaW4gZGVjb3JhdGlvbnMgb2YgYW55IGtpbmRcblx0XHRjb25zdCBjdXJyTGluZURlY29yYXRpb25zID0gdGhpcy5fZWRpdG9yLmdldExpbmVEZWNvcmF0aW9ucyhsaW5lTnVtYmVyKTtcblx0XHRsZXQgaGFzRGVjb3JhdGlvbiA9IGZhbHNlO1xuXHRcdGlmIChjdXJyTGluZURlY29yYXRpb25zKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGRlY29yYXRpb24gb2YgY3VyckxpbmVEZWNvcmF0aW9ucykge1xuXHRcdFx0XHRjb25zdCBnbHlwaENsYXNzID0gZGVjb3JhdGlvbi5vcHRpb25zLmdseXBoTWFyZ2luQ2xhc3NOYW1lO1xuXG5cdFx0XHRcdGlmIChnbHlwaENsYXNzICYmICF0aGlzLmxpZ2h0YnVsYkNsYXNzZXMuc29tZShjbGFzc05hbWUgPT4gZ2x5cGhDbGFzcy5pbmNsdWRlcyhjbGFzc05hbWUpKSkge1xuXHRcdFx0XHRcdGhhc0RlY29yYXRpb24gPSB0cnVlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IGVmZmVjdGl2ZUxpbmVOdW1iZXIgPSBsaW5lTnVtYmVyO1xuXHRcdGxldCBlZmZlY3RpdmVDb2x1bW5OdW1iZXIgPSAxO1xuXHRcdGlmICghbGluZUhhc1NwYWNlKSB7XG5cdFx0XHQvLyBDaGVja3MgaWYgbGluZSBpcyBlbXB0eSBvciBzdGFydHMgd2l0aCBhbnkgYW1vdW50IG9mIHdoaXRlc3BhY2Vcblx0XHRcdGNvbnN0IGlzTGluZUVtcHR5T3JJbmRlbnRlZCA9IChsaW5lTnVtYmVyOiBudW1iZXIpOiBib29sZWFuID0+IHtcblx0XHRcdFx0Y29uc3QgbGluZUNvbnRlbnQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChsaW5lTnVtYmVyKTtcblx0XHRcdFx0cmV0dXJuIC9eXFxzKiR8XlxccysvLnRlc3QobGluZUNvbnRlbnQpIHx8IGxpbmVDb250ZW50Lmxlbmd0aCA8PSBlZmZlY3RpdmVDb2x1bW5OdW1iZXI7XG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAobGluZU51bWJlciA+IDEgJiYgIWlzRm9sZGVkKGxpbmVOdW1iZXIgLSAxKSkge1xuXHRcdFx0XHRjb25zdCBsaW5lQ291bnQgPSBtb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0XHRcdFx0Y29uc3QgZW5kTGluZSA9IGxpbmVOdW1iZXIgPT09IGxpbmVDb3VudDtcblx0XHRcdFx0Y29uc3QgcHJldkxpbmVFbXB0eU9ySW5kZW50ZWQgPSBsaW5lTnVtYmVyID4gMSAmJiBpc0xpbmVFbXB0eU9ySW5kZW50ZWQobGluZU51bWJlciAtIDEpO1xuXHRcdFx0XHRjb25zdCBuZXh0TGluZUVtcHR5T3JJbmRlbnRlZCA9ICFlbmRMaW5lICYmIGlzTGluZUVtcHR5T3JJbmRlbnRlZChsaW5lTnVtYmVyICsgMSk7XG5cdFx0XHRcdGNvbnN0IGN1cnJMaW5lRW1wdHlPckluZGVudGVkID0gaXNMaW5lRW1wdHlPckluZGVudGVkKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRjb25zdCBub3RFbXB0eSA9ICFuZXh0TGluZUVtcHR5T3JJbmRlbnRlZCAmJiAhcHJldkxpbmVFbXB0eU9ySW5kZW50ZWQ7XG5cblx0XHRcdFx0Ly8gY2hlY2sgYWJvdmUgYW5kIGJlbG93LiBpZiBib3RoIGFyZSBibG9ja2VkLCBkaXNwbGF5IGxpZ2h0YnVsYiBpbiB0aGUgZ3V0dGVyLlxuXHRcdFx0XHRpZiAoIW5leHRMaW5lRW1wdHlPckluZGVudGVkICYmICFwcmV2TGluZUVtcHR5T3JJbmRlbnRlZCAmJiAhaGFzRGVjb3JhdGlvbikge1xuXHRcdFx0XHRcdHRoaXMuZ3V0dGVyU3RhdGUgPSBuZXcgTGlnaHRCdWxiU3RhdGUuU2hvd2luZyhhY3Rpb25zLCB0cmlnZ2VyLCBhdFBvc2l0aW9uLCB7XG5cdFx0XHRcdFx0XHRwb3NpdGlvbjogeyBsaW5lTnVtYmVyOiBlZmZlY3RpdmVMaW5lTnVtYmVyLCBjb2x1bW46IGVmZmVjdGl2ZUNvbHVtbk51bWJlciB9LFxuXHRcdFx0XHRcdFx0cHJlZmVyZW5jZTogTGlnaHRCdWxiV2lkZ2V0Ll9wb3NQcmVmXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0dGhpcy5yZW5kZXJHdXR0ZXJMaWdodGJ1YigpO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmhpZGUoKTtcblx0XHRcdFx0fSBlbHNlIGlmIChwcmV2TGluZUVtcHR5T3JJbmRlbnRlZCB8fCBlbmRMaW5lIHx8IChwcmV2TGluZUVtcHR5T3JJbmRlbnRlZCAmJiAhY3VyckxpbmVFbXB0eU9ySW5kZW50ZWQpKSB7XG5cdFx0XHRcdFx0ZWZmZWN0aXZlTGluZU51bWJlciAtPSAxO1xuXHRcdFx0XHR9IGVsc2UgaWYgKG5leHRMaW5lRW1wdHlPckluZGVudGVkIHx8IChub3RFbXB0eSAmJiBjdXJyTGluZUVtcHR5T3JJbmRlbnRlZCkpIHtcblx0XHRcdFx0XHRlZmZlY3RpdmVMaW5lTnVtYmVyICs9IDE7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAobGluZU51bWJlciA9PT0gMSAmJiAobGluZU51bWJlciA9PT0gbW9kZWwuZ2V0TGluZUNvdW50KCkgfHwgIWlzTGluZUVtcHR5T3JJbmRlbnRlZChsaW5lTnVtYmVyICsgMSkgJiYgIWlzTGluZUVtcHR5T3JJbmRlbnRlZChsaW5lTnVtYmVyKSkpIHtcblx0XHRcdFx0Ly8gc3BlY2lhbCBjaGVja3MgZm9yIGZpcnN0IGxpbmUgYmxvY2tlZCB2cy4gbm90IGJsb2NrZWQuXG5cdFx0XHRcdHRoaXMuZ3V0dGVyU3RhdGUgPSBuZXcgTGlnaHRCdWxiU3RhdGUuU2hvd2luZyhhY3Rpb25zLCB0cmlnZ2VyLCBhdFBvc2l0aW9uLCB7XG5cdFx0XHRcdFx0cG9zaXRpb246IHsgbGluZU51bWJlcjogZWZmZWN0aXZlTGluZU51bWJlciwgY29sdW1uOiBlZmZlY3RpdmVDb2x1bW5OdW1iZXIgfSxcblx0XHRcdFx0XHRwcmVmZXJlbmNlOiBMaWdodEJ1bGJXaWRnZXQuX3Bvc1ByZWZcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0aWYgKGhhc0RlY29yYXRpb24pIHtcblx0XHRcdFx0XHR0aGlzLmd1dHRlckhpZGUoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnJlbmRlckd1dHRlckxpZ2h0YnViKCk7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuaGlkZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKChsaW5lTnVtYmVyIDwgbW9kZWwuZ2V0TGluZUNvdW50KCkpICYmICFpc0ZvbGRlZChsaW5lTnVtYmVyICsgMSkpIHtcblx0XHRcdFx0ZWZmZWN0aXZlTGluZU51bWJlciArPSAxO1xuXHRcdFx0fSBlbHNlIGlmIChjb2x1bW4gKiBmb250SW5mby5zcGFjZVdpZHRoIDwgMjIpIHtcblx0XHRcdFx0Ly8gY2Fubm90IHNob3cgbGlnaHRidWxiIGFib3ZlL2JlbG93IGFuZCBzaG93aW5nXG5cdFx0XHRcdC8vIGl0IGlubGluZSB3b3VsZCBvdmVybGF5IHRoZSBjdXJzb3IuLi5cblx0XHRcdFx0cmV0dXJuIHRoaXMuaGlkZSgpO1xuXHRcdFx0fVxuXHRcdFx0ZWZmZWN0aXZlQ29sdW1uTnVtYmVyID0gL15cXFNcXHMqJC8udGVzdChtb2RlbC5nZXRMaW5lQ29udGVudChlZmZlY3RpdmVMaW5lTnVtYmVyKSkgPyAyIDogMTtcblx0XHR9XG5cblx0XHR0aGlzLnN0YXRlID0gbmV3IExpZ2h0QnVsYlN0YXRlLlNob3dpbmcoYWN0aW9ucywgdHJpZ2dlciwgYXRQb3NpdGlvbiwge1xuXHRcdFx0cG9zaXRpb246IHsgbGluZU51bWJlcjogZWZmZWN0aXZlTGluZU51bWJlciwgY29sdW1uOiBlZmZlY3RpdmVDb2x1bW5OdW1iZXIgfSxcblx0XHRcdHByZWZlcmVuY2U6IExpZ2h0QnVsYldpZGdldC5fcG9zUHJlZlxuXHRcdH0pO1xuXG5cdFx0aWYgKHRoaXMuX2d1dHRlckRlY29yYXRpb25JRCkge1xuXHRcdFx0dGhpcy5fcmVtb3ZlR3V0dGVyRGVjb3JhdGlvbih0aGlzLl9ndXR0ZXJEZWNvcmF0aW9uSUQpO1xuXHRcdFx0dGhpcy5ndXR0ZXJIaWRlKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmFsaWRBY3Rpb25zID0gYWN0aW9ucy52YWxpZEFjdGlvbnM7XG5cdFx0Y29uc3QgYWN0aW9uS2luZCA9IGFjdGlvbnMudmFsaWRBY3Rpb25zWzBdLmFjdGlvbi5raW5kO1xuXHRcdGlmICh2YWxpZEFjdGlvbnMubGVuZ3RoICE9PSAxIHx8ICFhY3Rpb25LaW5kKSB7XG5cdFx0XHR0aGlzLl9lZGl0b3IubGF5b3V0Q29udGVudFdpZGdldCh0aGlzKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9lZGl0b3IubGF5b3V0Q29udGVudFdpZGdldCh0aGlzKTtcblx0fVxuXG5cdHB1YmxpYyBoaWRlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnN0YXRlID09PSBMaWdodEJ1bGJTdGF0ZS5IaWRkZW4pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnN0YXRlID0gTGlnaHRCdWxiU3RhdGUuSGlkZGVuO1xuXHRcdHRoaXMuX2VkaXRvci5sYXlvdXRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHR9XG5cblx0cHVibGljIGd1dHRlckhpZGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuZ3V0dGVyU3RhdGUgPT09IExpZ2h0QnVsYlN0YXRlLkhpZGRlbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9ndXR0ZXJEZWNvcmF0aW9uSUQpIHtcblx0XHRcdHRoaXMuX3JlbW92ZUd1dHRlckRlY29yYXRpb24odGhpcy5fZ3V0dGVyRGVjb3JhdGlvbklEKTtcblx0XHR9XG5cblx0XHR0aGlzLmd1dHRlclN0YXRlID0gTGlnaHRCdWxiU3RhdGUuSGlkZGVuO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgc3RhdGUoKTogTGlnaHRCdWxiU3RhdGUuU3RhdGUgeyByZXR1cm4gdGhpcy5fc3RhdGU7IH1cblxuXHRwcml2YXRlIHNldCBzdGF0ZSh2YWx1ZSkge1xuXHRcdHRoaXMuX3N0YXRlID0gdmFsdWU7XG5cdFx0dGhpcy5fdXBkYXRlTGlnaHRCdWxiVGl0bGVBbmRJY29uKCk7XG5cdH1cblxuXHRwcml2YXRlIGdldCBndXR0ZXJTdGF0ZSgpOiBMaWdodEJ1bGJTdGF0ZS5TdGF0ZSB7IHJldHVybiB0aGlzLl9ndXR0ZXJTdGF0ZTsgfVxuXG5cdHByaXZhdGUgc2V0IGd1dHRlclN0YXRlKHZhbHVlKSB7XG5cdFx0dGhpcy5fZ3V0dGVyU3RhdGUgPSB2YWx1ZTtcblx0XHR0aGlzLl91cGRhdGVHdXR0ZXJMaWdodEJ1bGJUaXRsZUFuZEljb24oKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUxpZ2h0QnVsYlRpdGxlQW5kSWNvbigpOiB2b2lkIHtcblx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTGlzdC5yZW1vdmUoLi4udGhpcy5faWNvbkNsYXNzZXMpO1xuXHRcdHRoaXMuX2ljb25DbGFzc2VzID0gW107XG5cdFx0aWYgKHRoaXMuc3RhdGUudHlwZSAhPT0gTGlnaHRCdWxiU3RhdGUuVHlwZS5TaG93aW5nKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGxldCBpY29uOiBUaGVtZUljb247XG5cdFx0bGV0IGF1dG9SdW4gPSBmYWxzZTtcblx0XHRpZiAodGhpcy5zdGF0ZS5hY3Rpb25zLmFsbEFJRml4ZXMpIHtcblx0XHRcdGljb24gPSBDb2RpY29uLnNwYXJrbGVGaWxsZWQ7XG5cdFx0XHRpZiAodGhpcy5zdGF0ZS5hY3Rpb25zLnZhbGlkQWN0aW9ucy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0YXV0b1J1biA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0aGlzLnN0YXRlLmFjdGlvbnMuaGFzQXV0b0ZpeCkge1xuXHRcdFx0aWYgKHRoaXMuc3RhdGUuYWN0aW9ucy5oYXNBSUZpeCkge1xuXHRcdFx0XHRpY29uID0gQ29kaWNvbi5saWdodGJ1bGJTcGFya2xlQXV0b2ZpeDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGljb24gPSBDb2RpY29uLmxpZ2h0YnVsYkF1dG9maXg7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0aGlzLnN0YXRlLmFjdGlvbnMuaGFzQUlGaXgpIHtcblx0XHRcdGljb24gPSBDb2RpY29uLmxpZ2h0YnVsYlNwYXJrbGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGljb24gPSBDb2RpY29uLmxpZ2h0QnVsYjtcblx0XHR9XG5cdFx0dGhpcy5fdXBkYXRlTGlnaHRidWxiVGl0bGUodGhpcy5zdGF0ZS5hY3Rpb25zLmhhc0F1dG9GaXgsIGF1dG9SdW4pO1xuXHRcdHRoaXMuX2ljb25DbGFzc2VzID0gVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoaWNvbik7XG5cdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QuYWRkKC4uLnRoaXMuX2ljb25DbGFzc2VzKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUd1dHRlckxpZ2h0QnVsYlRpdGxlQW5kSWNvbigpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5ndXR0ZXJTdGF0ZS50eXBlICE9PSBMaWdodEJ1bGJTdGF0ZS5UeXBlLlNob3dpbmcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bGV0IGljb246IFRoZW1lSWNvbjtcblx0XHRsZXQgYXV0b1J1biA9IGZhbHNlO1xuXHRcdGlmICh0aGlzLmd1dHRlclN0YXRlLmFjdGlvbnMuYWxsQUlGaXhlcykge1xuXHRcdFx0aWNvbiA9IEdVVFRFUl9TUEFSS0xFX0ZJTExFRF9JQ09OO1xuXHRcdFx0aWYgKHRoaXMuZ3V0dGVyU3RhdGUuYWN0aW9ucy52YWxpZEFjdGlvbnMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdGF1dG9SdW4gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAodGhpcy5ndXR0ZXJTdGF0ZS5hY3Rpb25zLmhhc0F1dG9GaXgpIHtcblx0XHRcdGlmICh0aGlzLmd1dHRlclN0YXRlLmFjdGlvbnMuaGFzQUlGaXgpIHtcblx0XHRcdFx0aWNvbiA9IEdVVFRFUl9MSUdIVEJVTEJfQUlGSVhfQVVUT19GSVhfSUNPTjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGljb24gPSBHVVRURVJfTElHSFRCVUxCX0FVVE9fRklYX0lDT047XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0aGlzLmd1dHRlclN0YXRlLmFjdGlvbnMuaGFzQUlGaXgpIHtcblx0XHRcdGljb24gPSBHVVRURVJfTElHSFRCVUxCX0FJRklYX0lDT047XG5cdFx0fSBlbHNlIHtcblx0XHRcdGljb24gPSBHVVRURVJfTElHSFRCVUxCX0lDT047XG5cdFx0fVxuXHRcdHRoaXMuX3VwZGF0ZUxpZ2h0YnVsYlRpdGxlKHRoaXMuZ3V0dGVyU3RhdGUuYWN0aW9ucy5oYXNBdXRvRml4LCBhdXRvUnVuKTtcblxuXHRcdGNvbnN0IEdVVFRFUl9ERUNPUkFUSU9OID0gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7XG5cdFx0XHRkZXNjcmlwdGlvbjogJ2NvZGljb24tZ3V0dGVyLWxpZ2h0YnVsYi1kZWNvcmF0aW9uJyxcblx0XHRcdGdseXBoTWFyZ2luQ2xhc3NOYW1lOiBUaGVtZUljb24uYXNDbGFzc05hbWUoaWNvbiksXG5cdFx0XHRnbHlwaE1hcmdpbjogeyBwb3NpdGlvbjogR2x5cGhNYXJnaW5MYW5lLkxlZnQgfSxcblx0XHRcdHN0aWNraW5lc3M6IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLFxuXHRcdH0pO1xuXG5cdFx0dGhpcy5ndXR0ZXJEZWNvcmF0aW9uID0gR1VUVEVSX0RFQ09SQVRJT047XG5cdH1cblxuXHQvKiBHdXR0ZXIgSGVscGVyIEZ1bmN0aW9ucyAqL1xuXHRwcml2YXRlIHJlbmRlckd1dHRlckxpZ2h0YnViKCk6IHZvaWQge1xuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb24oKTtcblx0XHRpZiAoIXNlbGVjdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9ndXR0ZXJEZWNvcmF0aW9uSUQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fYWRkR3V0dGVyRGVjb3JhdGlvbihzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fdXBkYXRlR3V0dGVyRGVjb3JhdGlvbih0aGlzLl9ndXR0ZXJEZWNvcmF0aW9uSUQsIHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2FkZEd1dHRlckRlY29yYXRpb24obGluZU51bWJlcjogbnVtYmVyKSB7XG5cdFx0dGhpcy5fZWRpdG9yLmNoYW5nZURlY29yYXRpb25zKChhY2Nlc3NvcjogSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdFx0dGhpcy5fZ3V0dGVyRGVjb3JhdGlvbklEID0gYWNjZXNzb3IuYWRkRGVjb3JhdGlvbihuZXcgUmFuZ2UobGluZU51bWJlciwgMCwgbGluZU51bWJlciwgMCksIHRoaXMuZ3V0dGVyRGVjb3JhdGlvbik7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZW1vdmVHdXR0ZXJEZWNvcmF0aW9uKGRlY29yYXRpb25JZDogc3RyaW5nKSB7XG5cdFx0dGhpcy5fZWRpdG9yLmNoYW5nZURlY29yYXRpb25zKChhY2Nlc3NvcjogSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdFx0YWNjZXNzb3IucmVtb3ZlRGVjb3JhdGlvbihkZWNvcmF0aW9uSWQpO1xuXHRcdFx0dGhpcy5fZ3V0dGVyRGVjb3JhdGlvbklEID0gdW5kZWZpbmVkO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlR3V0dGVyRGVjb3JhdGlvbihkZWNvcmF0aW9uSWQ6IHN0cmluZywgbGluZU51bWJlcjogbnVtYmVyKSB7XG5cdFx0dGhpcy5fZWRpdG9yLmNoYW5nZURlY29yYXRpb25zKChhY2Nlc3NvcjogSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdFx0YWNjZXNzb3IuY2hhbmdlRGVjb3JhdGlvbihkZWNvcmF0aW9uSWQsIG5ldyBSYW5nZShsaW5lTnVtYmVyLCAwLCBsaW5lTnVtYmVyLCAwKSk7XG5cdFx0XHRhY2Nlc3Nvci5jaGFuZ2VEZWNvcmF0aW9uT3B0aW9ucyhkZWNvcmF0aW9uSWQsIHRoaXMuZ3V0dGVyRGVjb3JhdGlvbik7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVMaWdodGJ1bGJUaXRsZShhdXRvRml4OiBib29sZWFuLCBhdXRvUnVuOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuc3RhdGUudHlwZSAhPT0gTGlnaHRCdWxiU3RhdGUuVHlwZS5TaG93aW5nKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChhdXRvUnVuKSB7XG5cdFx0XHR0aGlzLnRpdGxlID0gbmxzLmxvY2FsaXplKCdjb2RlQWN0aW9uQXV0b1J1bicsIFwiUnVuOiB7MH1cIiwgdGhpcy5zdGF0ZS5hY3Rpb25zLnZhbGlkQWN0aW9uc1swXS5hY3Rpb24udGl0bGUpO1xuXHRcdH0gZWxzZSBpZiAoYXV0b0ZpeCAmJiB0aGlzLl9wcmVmZXJyZWRLYkxhYmVsKSB7XG5cdFx0XHR0aGlzLnRpdGxlID0gbmxzLmxvY2FsaXplKCdwcmVmZXJyZWRjb2RlQWN0aW9uV2l0aEtiJywgXCJTaG93IENvZGUgQWN0aW9ucy4gUHJlZmVycmVkIFF1aWNrIEZpeCBBdmFpbGFibGUgKHswfSlcIiwgdGhpcy5fcHJlZmVycmVkS2JMYWJlbCk7XG5cdFx0fSBlbHNlIGlmICghYXV0b0ZpeCAmJiB0aGlzLl9xdWlja0ZpeEtiTGFiZWwpIHtcblx0XHRcdHRoaXMudGl0bGUgPSBubHMubG9jYWxpemUoJ2NvZGVBY3Rpb25XaXRoS2InLCBcIlNob3cgQ29kZSBBY3Rpb25zICh7MH0pXCIsIHRoaXMuX3F1aWNrRml4S2JMYWJlbCk7XG5cdFx0fSBlbHNlIGlmICghYXV0b0ZpeCkge1xuXHRcdFx0dGhpcy50aXRsZSA9IG5scy5sb2NhbGl6ZSgnY29kZUFjdGlvbicsIFwiU2hvdyBDb2RlIEFjdGlvbnNcIik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzZXQgdGl0bGUodmFsdWU6IHN0cmluZykge1xuXHRcdHRoaXMuX2RvbU5vZGUudGl0bGUgPSB2YWx1ZTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUN4QixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGlCQUFpQjtBQUMxQixPQUFPO0FBQ1AsU0FBUyx1Q0FBK0c7QUFDeEgsU0FBUyxvQkFBb0I7QUFFN0IsU0FBUyxpQkFBa0QsOEJBQThCO0FBQ3pGLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsa0JBQWtCLHlCQUF5QjtBQUVwRCxZQUFZLFNBQVM7QUFDckIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxhQUFhO0FBRXRCLE1BQU0sd0JBQXdCLGFBQWEsb0JBQW9CLFFBQVEsV0FBVyxJQUFJLFNBQVMseUJBQXlCLDJGQUEyRixDQUFDO0FBQ3BOLE1BQU0saUNBQWlDLGFBQWEsNkJBQTZCLFFBQVEsa0JBQWtCLElBQUksU0FBUyxnQ0FBZ0Msd0hBQXdILENBQUM7QUFDalIsTUFBTSw4QkFBOEIsYUFBYSw0QkFBNEIsUUFBUSxrQkFBa0IsSUFBSSxTQUFTLDhCQUE4QixzSEFBc0gsQ0FBQztBQUN6USxNQUFNLHVDQUF1QyxhQUFhLG1DQUFtQyxRQUFRLHlCQUF5QixJQUFJLFNBQVMscUNBQXFDLHNJQUFzSSxDQUFDO0FBQ3ZULE1BQU0sNkJBQTZCLGFBQWEsbUNBQW1DLFFBQVEsZUFBZSxJQUFJLFNBQVMsc0NBQXNDLHNJQUFzSSxDQUFDO0FBRXBTLElBQVU7QUFBQSxDQUFWLENBQVVBLG9CQUFWO0FBRVEsTUFBVztBQUFYLElBQVdDLFVBQVg7QUFDTixJQUFBQSxZQUFBO0FBQ0EsSUFBQUEsWUFBQTtBQUFBLEtBRmlCLE9BQUFELGdCQUFBLFNBQUFBLGdCQUFBO0FBS1gsRUFBTUEsZ0JBQUEs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QUssaUJBQWlCO0FBQUEsSUFDeEksV0FBVyxDQUFDLFdBQVcsS0FBSyxrQkFBa0I7QUFDN0MsV0FBSyxRQUFRLElBQUksU0FBUyxvQkFBb0IsMkJBQTJCLEtBQUssZ0JBQWdCO0FBQUEsSUFDL0YsV0FBVyxDQUFDLFNBQVM7QUFDcEIsV0FBSyxRQUFRLElBQUksU0FBUyxjQUFjLG1CQUFtQjtBQUFBLElBQzVEO0FBQUEsRUFDRDtBQUFBLEVBRUEsSUFBWSxNQUFNLE9BQWU7QUFDaEMsU0FBSyxTQUFTLFFBQVE7QUFBQSxFQUN2QjtBQUNEO0FBNWFhLGdCQUdZLG9CQUFvQix1QkFBdUIsU0FBUztBQUFBLEVBQzNFLGFBQWE7QUFBQSxFQUNiLHNCQUFzQixVQUFVLFlBQVksUUFBUSxTQUFTO0FBQUEsRUFDN0QsYUFBYSxFQUFFLFVBQVUsZ0JBQWdCLEtBQUs7QUFBQSxFQUM5QyxZQUFZLHVCQUF1QjtBQUNwQyxDQUFDO0FBUlcsZ0JBVVcsS0FBSztBQVZoQixnQkFZWSxXQUFXLENBQUMsZ0NBQWdDLEtBQUs7QUFaN0Qsa0JBQU47QUFBQSxFQXNDSjtBQUFBLEdBdENVOyIsCiAgIm5hbWVzIjogWyJMaWdodEJ1bGJTdGF0ZSIsICJUeXBlIiwgImxpbmVOdW1iZXIiLCAibGluZUNvbnRlbnQiXQp9Cg==
