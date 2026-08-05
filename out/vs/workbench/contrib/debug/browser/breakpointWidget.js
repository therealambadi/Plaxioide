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
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { SelectBox } from "../../../../base/browser/ui/selectBox/selectBox.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import * as lifecycle from "../../../../base/common/lifecycle.js";
import { URI as uri } from "../../../../base/common/uri.js";
import { EditorCommand, registerEditorCommand } from "../../../../editor/browser/editorExtensions.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { CompletionItemKind } from "../../../../editor/common/languages.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../editor/common/languages/modesRegistry.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { CompletionOptions, provideSuggestionItems } from "../../../../editor/contrib/suggest/browser/suggest.js";
import { ZoneWidget } from "../../../../editor/contrib/zoneWidget/browser/zoneWidget.js";
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService, createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { defaultButtonStyles, defaultSelectBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { editorForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { getSimpleCodeEditorWidgetOptions, getSimpleEditorOptions } from "../../codeEditor/browser/simpleEditorOptions.js";
import { BREAKPOINT_EDITOR_CONTRIBUTION_ID, CONTEXT_BREAKPOINT_WIDGET_VISIBLE, CONTEXT_IN_BREAKPOINT_WIDGET, BreakpointWidgetContext as Context, DEBUG_SCHEME, IDebugService } from "../common/debug.js";
import "./media/breakpointWidget.css";
const $ = dom.$;
const IPrivateBreakpointWidgetService = createDecorator("privateBreakpointWidgetService");
const DECORATION_KEY = "breakpointwidgetdecoration";
function isPositionInCurlyBracketBlock(input) {
  const model = input.getModel();
  const bracketPairs = model.bracketPairs.getBracketPairsInRange(Range.fromPositions(input.getPosition()));
  return bracketPairs.some((p) => p.openingBracketInfo.bracketText === "{");
}
function createDecorations(theme, placeHolder) {
  const transparentForeground = theme.getColor(editorForeground)?.transparent(0.4);
  return [{
    range: {
      startLineNumber: 0,
      endLineNumber: 0,
      startColumn: 0,
      endColumn: 1
    },
    renderOptions: {
      after: {
        contentText: placeHolder,
        color: transparentForeground ? transparentForeground.toString() : void 0
      }
    }
  }];
}
let BreakpointWidget = class extends ZoneWidget {
  constructor(editor, lineNumber, column, context, contextViewService, debugService, themeService, instantiationService, modelService, codeEditorService, _configurationService, languageFeaturesService, keybindingService, labelService, textModelService, hoverService) {
    super(editor, { showFrame: true, showArrow: false, frameWidth: 1, isAccessible: true });
    this.lineNumber = lineNumber;
    this.column = column;
    this.contextViewService = contextViewService;
    this.debugService = debugService;
    this.themeService = themeService;
    this.instantiationService = instantiationService;
    this.modelService = modelService;
    this.codeEditorService = codeEditorService;
    this._configurationService = _configurationService;
    this.languageFeaturesService = languageFeaturesService;
    this.keybindingService = keybindingService;
    this.labelService = labelService;
    this.textModelService = textModelService;
    this.hoverService = hoverService;
    this.conditionInput = "";
    this.hitCountInput = "";
    this.logMessageInput = "";
    this.toDispose = [];
    const model = this.editor.getModel();
    if (model) {
      const uri2 = model.uri;
      const breakpoints = this.debugService.getModel().getBreakpoints({ lineNumber: this.lineNumber, column: this.column, uri: uri2 });
      this.breakpoint = breakpoints.length ? breakpoints[0] : void 0;
    }
    if (context === void 0) {
      if (this.breakpoint && !this.breakpoint.condition && !this.breakpoint.hitCondition && this.breakpoint.logMessage) {
        this.context = Context.LOG_MESSAGE;
      } else if (this.breakpoint && !this.breakpoint.condition && this.breakpoint.hitCondition) {
        this.context = Context.HIT_COUNT;
      } else if (this.breakpoint && this.breakpoint.triggeredBy) {
        this.context = Context.TRIGGER_POINT;
      } else {
        this.context = Context.CONDITION;
      }
    } else {
      this.context = context;
    }
    this.toDispose.push(this.debugService.getModel().onDidChangeBreakpoints((e) => {
      if (this.breakpoint && e && e.removed && e.removed.indexOf(this.breakpoint) >= 0) {
        this.dispose();
      }
    }));
    this.codeEditorService.registerDecorationType("breakpoint-widget", DECORATION_KEY, {});
    this.create();
  }
  get placeholder() {
    const acceptString = this.keybindingService.lookupKeybinding(AcceptBreakpointWidgetInputAction.ID)?.getLabel() || "Enter";
    const closeString = this.keybindingService.lookupKeybinding(CloseBreakpointWidgetCommand.ID)?.getLabel() || "Escape";
    switch (this.context) {
      case Context.LOG_MESSAGE:
        return nls.localize("breakpointWidgetLogMessagePlaceholder", "Message to log when breakpoint is hit. Expressions within {} are interpolated. '{0}' to accept, '{1}' to cancel.", acceptString, closeString);
      case Context.HIT_COUNT:
        return nls.localize("breakpointWidgetHitCountPlaceholder", "Break when hit count condition is met. '{0}' to accept, '{1}' to cancel.", acceptString, closeString);
      default:
        return nls.localize("breakpointWidgetExpressionPlaceholder", "Break when expression evaluates to true. '{0}' to accept, '{1}' to cancel.", acceptString, closeString);
    }
  }
  getInputValue(breakpoint) {
    switch (this.context) {
      case Context.LOG_MESSAGE:
        return breakpoint && breakpoint.logMessage ? breakpoint.logMessage : this.logMessageInput;
      case Context.HIT_COUNT:
        return breakpoint && breakpoint.hitCondition ? breakpoint.hitCondition : this.hitCountInput;
      default:
        return breakpoint && breakpoint.condition ? breakpoint.condition : this.conditionInput;
    }
  }
  rememberInput() {
    if (this.context !== Context.TRIGGER_POINT) {
      const value = this.input.getModel().getValue();
      switch (this.context) {
        case Context.LOG_MESSAGE:
          this.logMessageInput = value;
          break;
        case Context.HIT_COUNT:
          this.hitCountInput = value;
          break;
        default:
          this.conditionInput = value;
      }
    }
  }
  setInputMode() {
    if (this.editor.hasModel()) {
      const languageId = this.context === Context.LOG_MESSAGE ? PLAINTEXT_LANGUAGE_ID : this.editor.getModel().getLanguageId();
      this.input.getModel().setLanguage(languageId);
    }
  }
  show(rangeOrPos) {
    const lineNum = this.input.getModel().getLineCount();
    super.show(rangeOrPos, lineNum + 1);
  }
  fitHeightToContent() {
    const lineNum = this.input.getModel().getLineCount();
    this._relayout(lineNum + 1);
  }
  _fillContainer(container) {
    this.setCssClass("breakpoint-widget");
    const selectBox = new SelectBox([
      { text: nls.localize("expression", "Expression") },
      { text: nls.localize("hitCount", "Hit Count") },
      { text: nls.localize("logMessage", "Log Message") },
      { text: nls.localize("triggeredBy", "Wait for Breakpoint") }
    ], this.context, this.contextViewService, defaultSelectBoxStyles, { ariaLabel: nls.localize("breakpointType", "Breakpoint Type") });
    this.selectContainer = $(".breakpoint-select-container");
    selectBox.render(dom.append(container, this.selectContainer));
    selectBox.onDidSelect((e) => {
      this.rememberInput();
      this.context = e.index;
      this.updateContextInput();
    });
    this.createModesInput(container);
    this.inputContainer = $(".inputContainer");
    this.toDispose.push(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.inputContainer, this.placeholder));
    this.createBreakpointInput(dom.append(container, this.inputContainer));
    this.input.getModel().setValue(this.getInputValue(this.breakpoint));
    this.toDispose.push(this.input.getModel().onDidChangeContent(() => {
      this.fitHeightToContent();
    }));
    this.input.setPosition({ lineNumber: 1, column: this.input.getModel().getLineMaxColumn(1) });
    this.createTriggerBreakpointInput(container);
    this.updateContextInput();
    setTimeout(() => this.focusInput(), 150);
  }
  createModesInput(container) {
    const modes = this.debugService.getModel().getBreakpointModes("source");
    if (modes.length <= 1) {
      return;
    }
    const sb = this.selectModeBox = new SelectBox(
      [
        { text: nls.localize("bpMode", "Mode"), isDisabled: true },
        ...modes.map((mode) => ({ text: mode.label, description: mode.description }))
      ],
      modes.findIndex((m) => m.mode === this.breakpoint?.mode) + 1,
      this.contextViewService,
      defaultSelectBoxStyles
    );
    this.toDispose.push(sb);
    this.toDispose.push(sb.onDidSelect((e) => {
      this.modeInput = modes[e.index - 1];
    }));
    const modeWrapper = $(".select-mode-container");
    const selectionWrapper = $(".select-box-container");
    dom.append(modeWrapper, selectionWrapper);
    sb.render(selectionWrapper);
    dom.append(container, modeWrapper);
  }
  createTriggerBreakpointInput(container) {
    const breakpoints = this.debugService.getModel().getBreakpoints().filter((bp) => bp !== this.breakpoint && !bp.logMessage);
    const breakpointOptions = [
      { text: nls.localize("noTriggerByBreakpoint", "None"), isDisabled: true },
      ...breakpoints.map((bp) => ({
        text: `${this.labelService.getUriLabel(bp.uri, { relative: true })}: ${bp.lineNumber}`,
        description: nls.localize("triggerByLoading", "Loading...")
      }))
    ];
    const index = breakpoints.findIndex((bp) => this.breakpoint?.triggeredBy === bp.getId());
    for (const [i, bp] of breakpoints.entries()) {
      this.textModelService.createModelReference(bp.uri).then((ref) => {
        try {
          breakpointOptions[i + 1].description = ref.object.textEditorModel.getLineContent(bp.lineNumber).trim();
        } finally {
          ref.dispose();
        }
      }).catch(() => {
        breakpointOptions[i + 1].description = nls.localize("noBpSource", "Could not load source.");
      });
    }
    const selectBreakpointBox = this.selectBreakpointBox = new SelectBox(breakpointOptions, index + 1, this.contextViewService, defaultSelectBoxStyles, { ariaLabel: nls.localize("selectBreakpoint", "Select breakpoint") });
    selectBreakpointBox.onDidSelect((e) => {
      if (e.index === 0) {
        this.triggeredByBreakpointInput = void 0;
      } else {
        this.triggeredByBreakpointInput = breakpoints[e.index - 1];
      }
    });
    this.toDispose.push(selectBreakpointBox);
    this.selectBreakpointContainer = $(".select-breakpoint-container");
    this.toDispose.push(dom.addDisposableListener(this.selectBreakpointContainer, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Escape)) {
        this.close(false);
      }
    }));
    const selectionWrapper = $(".select-box-container");
    dom.append(this.selectBreakpointContainer, selectionWrapper);
    selectBreakpointBox.render(selectionWrapper);
    dom.append(container, this.selectBreakpointContainer);
    const closeButton = new Button(this.selectBreakpointContainer, defaultButtonStyles);
    closeButton.label = nls.localize("ok", "OK");
    this.toDispose.push(closeButton.onDidClick(() => this.close(true)));
    this.toDispose.push(closeButton);
  }
  updateContextInput() {
    if (this.context === Context.TRIGGER_POINT) {
      this.inputContainer.hidden = true;
      this.selectBreakpointContainer.hidden = false;
    } else {
      this.inputContainer.hidden = false;
      this.selectBreakpointContainer.hidden = true;
      this.setInputMode();
      const value = this.getInputValue(this.breakpoint);
      this.input.getModel().setValue(value);
      this.focusInput();
    }
  }
  _doLayout(heightInPixel, widthInPixel) {
    this.heightInPx = heightInPixel;
    this.input.layout({ height: heightInPixel, width: widthInPixel - 113 });
    this.centerInputVertically();
  }
  _onWidth(widthInPixel) {
    if (typeof this.heightInPx === "number") {
      this._doLayout(this.heightInPx, widthInPixel);
    }
  }
  createBreakpointInput(container) {
    const scopedInstatiationService = this.instantiationService.createChild(new ServiceCollection(
      [IPrivateBreakpointWidgetService, this]
    ));
    this.toDispose.push(scopedInstatiationService);
    const options = this.createEditorOptions();
    const codeEditorWidgetOptions = getSimpleCodeEditorWidgetOptions();
    this.input = scopedInstatiationService.createInstance(CodeEditorWidget, container, options, codeEditorWidgetOptions);
    CONTEXT_IN_BREAKPOINT_WIDGET.bindTo(this.input.contextKeyService).set(true);
    const model = this.modelService.createModel("", null, uri.parse(`${DEBUG_SCHEME}:${this.editor.getId()}:breakpointinput`), true);
    if (this.editor.hasModel()) {
      model.setLanguage(this.editor.getModel().getLanguageId());
    }
    this.input.setModel(model);
    this.setInputMode();
    this.toDispose.push(model);
    const setDecorations = () => {
      const value = this.input.getModel().getValue();
      const decorations = !!value ? [] : createDecorations(this.themeService.getColorTheme(), this.placeholder);
      this.input.setDecorationsByType("breakpoint-widget", DECORATION_KEY, decorations);
    };
    this.input.getModel().onDidChangeContent(() => setDecorations());
    this.themeService.onDidColorThemeChange(() => setDecorations());
    this.toDispose.push(this.languageFeaturesService.completionProvider.register({ scheme: DEBUG_SCHEME, hasAccessToAllModels: true }, {
      _debugDisplayName: "breakpointWidget",
      provideCompletionItems: (model2, position, _context, token) => {
        let suggestionsPromise;
        const underlyingModel = this.editor.getModel();
        if (underlyingModel && (this.context === Context.CONDITION || this.context === Context.LOG_MESSAGE && isPositionInCurlyBracketBlock(this.input))) {
          suggestionsPromise = provideSuggestionItems(this.languageFeaturesService.completionProvider, underlyingModel, new Position(this.lineNumber, 1), new CompletionOptions(void 0, (/* @__PURE__ */ new Set()).add(CompletionItemKind.Snippet)), _context, token).then((suggestions) => {
            let overwriteBefore = 0;
            if (this.context === Context.CONDITION) {
              overwriteBefore = position.column - 1;
            } else {
              const value = this.input.getModel().getValue();
              while (position.column - 2 - overwriteBefore >= 0 && value[position.column - 2 - overwriteBefore] !== "{" && value[position.column - 2 - overwriteBefore] !== " ") {
                overwriteBefore++;
              }
            }
            return {
              suggestions: suggestions.items.map((s) => {
                s.completion.range = Range.fromPositions(position.delta(0, -overwriteBefore), position);
                return s.completion;
              })
            };
          });
        } else {
          suggestionsPromise = Promise.resolve({ suggestions: [] });
        }
        return suggestionsPromise;
      }
    }));
    this.toDispose.push(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.fontSize") || e.affectsConfiguration("editor.lineHeight")) {
        this.input.updateOptions(this.createEditorOptions());
        this.centerInputVertically();
      }
    }));
  }
  createEditorOptions() {
    const editorConfig = this._configurationService.getValue("editor");
    const options = getSimpleEditorOptions(this._configurationService);
    options.fontSize = editorConfig.fontSize;
    options.fontFamily = editorConfig.fontFamily;
    options.lineHeight = editorConfig.lineHeight;
    options.fontLigatures = editorConfig.fontLigatures;
    options.ariaLabel = this.placeholder;
    return options;
  }
  centerInputVertically() {
    if (this.container && typeof this.heightInPx === "number") {
      const lineHeight = this.input.getOption(EditorOption.lineHeight);
      const lineNum = this.input.getModel().getLineCount();
      const newTopMargin = (this.heightInPx - lineNum * lineHeight) / 2;
      this.inputContainer.style.marginTop = newTopMargin + "px";
    }
  }
  close(success) {
    if (success) {
      let condition = void 0;
      let hitCondition = void 0;
      let logMessage = void 0;
      let triggeredBy = void 0;
      let mode = void 0;
      let modeLabel = void 0;
      this.rememberInput();
      if (this.conditionInput || this.context === Context.CONDITION) {
        condition = this.conditionInput;
      }
      if (this.hitCountInput || this.context === Context.HIT_COUNT) {
        hitCondition = this.hitCountInput;
      }
      if (this.logMessageInput || this.context === Context.LOG_MESSAGE) {
        logMessage = this.logMessageInput;
      }
      if (this.selectModeBox) {
        mode = this.modeInput?.mode;
        modeLabel = this.modeInput?.label;
      }
      if (this.context === Context.TRIGGER_POINT) {
        condition = void 0;
        hitCondition = void 0;
        logMessage = void 0;
        triggeredBy = this.triggeredByBreakpointInput?.getId();
      }
      if (this.breakpoint) {
        const data = /* @__PURE__ */ new Map();
        data.set(this.breakpoint.getId(), {
          condition,
          hitCondition,
          logMessage,
          triggeredBy,
          mode,
          modeLabel
        });
        this.debugService.updateBreakpoints(this.breakpoint.originalUri, data, false).then(void 0, onUnexpectedError);
      } else {
        const model = this.editor.getModel();
        if (model) {
          this.debugService.addBreakpoints(model.uri, [{
            lineNumber: this.lineNumber,
            column: this.column,
            enabled: true,
            condition,
            hitCondition,
            logMessage,
            triggeredBy,
            mode,
            modeLabel
          }]);
        }
      }
    }
    this.dispose();
  }
  focusInput() {
    if (this.context === Context.TRIGGER_POINT) {
      this.selectBreakpointBox.focus();
    } else {
      this.input.focus();
    }
  }
  dispose() {
    super.dispose();
    this.input.dispose();
    lifecycle.dispose(this.toDispose);
    setTimeout(() => this.editor.focus(), 0);
  }
};
BreakpointWidget = __decorateClass([
  __decorateParam(4, IContextViewService),
  __decorateParam(5, IDebugService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IModelService),
  __decorateParam(9, ICodeEditorService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, ILanguageFeaturesService),
  __decorateParam(12, IKeybindingService),
  __decorateParam(13, ILabelService),
  __decorateParam(14, ITextModelService),
  __decorateParam(15, IHoverService)
], BreakpointWidget);
const _AcceptBreakpointWidgetInputAction = class _AcceptBreakpointWidgetInputAction extends EditorCommand {
  constructor() {
    super({
      id: _AcceptBreakpointWidgetInputAction.ID,
      precondition: CONTEXT_BREAKPOINT_WIDGET_VISIBLE,
      kbOpts: {
        kbExpr: CONTEXT_IN_BREAKPOINT_WIDGET,
        primary: KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  runEditorCommand(accessor, editor) {
    accessor.get(IPrivateBreakpointWidgetService).close(true);
  }
};
_AcceptBreakpointWidgetInputAction.ID = "breakpointWidget.action.acceptInput";
let AcceptBreakpointWidgetInputAction = _AcceptBreakpointWidgetInputAction;
const _CloseBreakpointWidgetCommand = class _CloseBreakpointWidgetCommand extends EditorCommand {
  constructor() {
    super({
      id: _CloseBreakpointWidgetCommand.ID,
      precondition: CONTEXT_BREAKPOINT_WIDGET_VISIBLE,
      kbOpts: {
        kbExpr: EditorContextKeys.textInputFocus,
        primary: KeyCode.Escape,
        secondary: [KeyMod.Shift | KeyCode.Escape],
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  runEditorCommand(accessor, editor, args) {
    const debugContribution = editor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID);
    if (debugContribution) {
      return debugContribution.closeBreakpointWidget();
    }
    accessor.get(IPrivateBreakpointWidgetService).close(false);
  }
};
_CloseBreakpointWidgetCommand.ID = "closeBreakpointWidget";
let CloseBreakpointWidgetCommand = _CloseBreakpointWidgetCommand;
registerEditorCommand(new AcceptBreakpointWidgetInputAction());
registerEditorCommand(new CloseBreakpointWidgetCommand());
export {
  BreakpointWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2JyZWFrcG9pbnRXaWRnZXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYnV0dG9uL2J1dHRvbi5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBJU2VsZWN0T3B0aW9uSXRlbSwgU2VsZWN0Qm94IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3NlbGVjdEJveC9zZWxlY3RCb3guanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0ICogYXMgbGlmZWN5Y2xlIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgYXMgdXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElBY3RpdmVDb2RlRWRpdG9yLCBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29tbWFuZCwgU2VydmljZXNBY2Nlc3NvciwgcmVnaXN0ZXJFZGl0b3JDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvY29kZUVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24sIElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSURlY29yYXRpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IENvbXBsZXRpb25Db250ZXh0LCBDb21wbGV0aW9uSXRlbUtpbmQsIENvbXBsZXRpb25MaXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgUExBSU5URVhUX0xBTkdVQUdFX0lEIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbW9kZXNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb21wbGV0aW9uT3B0aW9ucywgcHJvdmlkZVN1Z2dlc3Rpb25JdGVtcyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3N1Z2dlc3QvYnJvd3Nlci9zdWdnZXN0LmpzJztcbmltcG9ydCB7IFpvbmVXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi96b25lV2lkZ2V0L2Jyb3dzZXIvem9uZVdpZGdldC5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRWaWV3U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IGRlZmF1bHRCdXR0b25TdHlsZXMsIGRlZmF1bHRTZWxlY3RCb3hTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgZWRpdG9yRm9yZWdyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElDb2xvclRoZW1lLCBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXRTaW1wbGVDb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucywgZ2V0U2ltcGxlRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uL2NvZGVFZGl0b3IvYnJvd3Nlci9zaW1wbGVFZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IEJSRUFLUE9JTlRfRURJVE9SX0NPTlRSSUJVVElPTl9JRCwgQ09OVEVYVF9CUkVBS1BPSU5UX1dJREdFVF9WSVNJQkxFLCBDT05URVhUX0lOX0JSRUFLUE9JTlRfV0lER0VULCBCcmVha3BvaW50V2lkZ2V0Q29udGV4dCBhcyBDb250ZXh0LCBERUJVR19TQ0hFTUUsIElCcmVha3BvaW50LCBJQnJlYWtwb2ludEVkaXRvckNvbnRyaWJ1dGlvbiwgSUJyZWFrcG9pbnRVcGRhdGVEYXRhLCBJRGVidWdTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnLmpzJztcbmltcG9ydCAnLi9tZWRpYS9icmVha3BvaW50V2lkZ2V0LmNzcyc7XG5cbmNvbnN0ICQgPSBkb20uJDtcbmNvbnN0IElQcml2YXRlQnJlYWtwb2ludFdpZGdldFNlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SVByaXZhdGVCcmVha3BvaW50V2lkZ2V0U2VydmljZT4oJ3ByaXZhdGVCcmVha3BvaW50V2lkZ2V0U2VydmljZScpO1xuaW50ZXJmYWNlIElQcml2YXRlQnJlYWtwb2ludFdpZGdldFNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdGNsb3NlKHN1Y2Nlc3M6IGJvb2xlYW4pOiB2b2lkO1xufVxuY29uc3QgREVDT1JBVElPTl9LRVkgPSAnYnJlYWtwb2ludHdpZGdldGRlY29yYXRpb24nO1xuXG5mdW5jdGlvbiBpc1Bvc2l0aW9uSW5DdXJseUJyYWNrZXRCbG9jayhpbnB1dDogSUFjdGl2ZUNvZGVFZGl0b3IpOiBib29sZWFuIHtcblx0Y29uc3QgbW9kZWwgPSBpbnB1dC5nZXRNb2RlbCgpO1xuXHRjb25zdCBicmFja2V0UGFpcnMgPSBtb2RlbC5icmFja2V0UGFpcnMuZ2V0QnJhY2tldFBhaXJzSW5SYW5nZShSYW5nZS5mcm9tUG9zaXRpb25zKGlucHV0LmdldFBvc2l0aW9uKCkpKTtcblx0cmV0dXJuIGJyYWNrZXRQYWlycy5zb21lKHAgPT4gcC5vcGVuaW5nQnJhY2tldEluZm8uYnJhY2tldFRleHQgPT09ICd7Jyk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZURlY29yYXRpb25zKHRoZW1lOiBJQ29sb3JUaGVtZSwgcGxhY2VIb2xkZXI6IHN0cmluZyk6IElEZWNvcmF0aW9uT3B0aW9uc1tdIHtcblx0Y29uc3QgdHJhbnNwYXJlbnRGb3JlZ3JvdW5kID0gdGhlbWUuZ2V0Q29sb3IoZWRpdG9yRm9yZWdyb3VuZCk/LnRyYW5zcGFyZW50KDAuNCk7XG5cdHJldHVybiBbe1xuXHRcdHJhbmdlOiB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDAsXG5cdFx0XHRlbmRMaW5lTnVtYmVyOiAwLFxuXHRcdFx0c3RhcnRDb2x1bW46IDAsXG5cdFx0XHRlbmRDb2x1bW46IDFcblx0XHR9LFxuXHRcdHJlbmRlck9wdGlvbnM6IHtcblx0XHRcdGFmdGVyOiB7XG5cdFx0XHRcdGNvbnRlbnRUZXh0OiBwbGFjZUhvbGRlcixcblx0XHRcdFx0Y29sb3I6IHRyYW5zcGFyZW50Rm9yZWdyb3VuZCA/IHRyYW5zcGFyZW50Rm9yZWdyb3VuZC50b1N0cmluZygpIDogdW5kZWZpbmVkXG5cdFx0XHR9XG5cdFx0fVxuXHR9XTtcbn1cblxuZXhwb3J0IGNsYXNzIEJyZWFrcG9pbnRXaWRnZXQgZXh0ZW5kcyBab25lV2lkZ2V0IGltcGxlbWVudHMgSVByaXZhdGVCcmVha3BvaW50V2lkZ2V0U2VydmljZSB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgc2VsZWN0Q29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgaW5wdXRDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBzZWxlY3RCcmVha3BvaW50Q29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgaW5wdXQhOiBJQWN0aXZlQ29kZUVkaXRvcjtcblx0cHJpdmF0ZSBzZWxlY3RCcmVha3BvaW50Qm94ITogU2VsZWN0Qm94O1xuXHRwcml2YXRlIHNlbGVjdE1vZGVCb3g/OiBTZWxlY3RCb3g7XG5cdHByaXZhdGUgdG9EaXNwb3NlOiBsaWZlY3ljbGUuSURpc3Bvc2FibGVbXTtcblx0cHJpdmF0ZSBjb25kaXRpb25JbnB1dCA9ICcnO1xuXHRwcml2YXRlIGhpdENvdW50SW5wdXQgPSAnJztcblx0cHJpdmF0ZSBsb2dNZXNzYWdlSW5wdXQgPSAnJztcblx0cHJpdmF0ZSBtb2RlSW5wdXQ/OiBEZWJ1Z1Byb3RvY29sLkJyZWFrcG9pbnRNb2RlO1xuXHRwcml2YXRlIGJyZWFrcG9pbnQ6IElCcmVha3BvaW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNvbnRleHQ6IENvbnRleHQ7XG5cdHByaXZhdGUgaGVpZ2h0SW5QeDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHRyaWdnZXJlZEJ5QnJlYWtwb2ludElucHV0OiBJQnJlYWtwb2ludCB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3RvcihlZGl0b3I6IElDb2RlRWRpdG9yLCBwcml2YXRlIGxpbmVOdW1iZXI6IG51bWJlciwgcHJpdmF0ZSBjb2x1bW46IG51bWJlciB8IHVuZGVmaW5lZCwgY29udGV4dDogQ29udGV4dCB8IHVuZGVmaW5lZCxcblx0XHRASUNvbnRleHRWaWV3U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0XHRASURlYnVnU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASUNvZGVFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoZWRpdG9yLCB7IHNob3dGcmFtZTogdHJ1ZSwgc2hvd0Fycm93OiBmYWxzZSwgZnJhbWVXaWR0aDogMSwgaXNBY2Nlc3NpYmxlOiB0cnVlIH0pO1xuXG5cdFx0dGhpcy50b0Rpc3Bvc2UgPSBbXTtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHRjb25zdCB1cmkgPSBtb2RlbC51cmk7XG5cdFx0XHRjb25zdCBicmVha3BvaW50cyA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0QnJlYWtwb2ludHMoeyBsaW5lTnVtYmVyOiB0aGlzLmxpbmVOdW1iZXIsIGNvbHVtbjogdGhpcy5jb2x1bW4sIHVyaSB9KTtcblx0XHRcdHRoaXMuYnJlYWtwb2ludCA9IGJyZWFrcG9pbnRzLmxlbmd0aCA/IGJyZWFrcG9pbnRzWzBdIDogdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmIChjb250ZXh0ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmICh0aGlzLmJyZWFrcG9pbnQgJiYgIXRoaXMuYnJlYWtwb2ludC5jb25kaXRpb24gJiYgIXRoaXMuYnJlYWtwb2ludC5oaXRDb25kaXRpb24gJiYgdGhpcy5icmVha3BvaW50LmxvZ01lc3NhZ2UpIHtcblx0XHRcdFx0dGhpcy5jb250ZXh0ID0gQ29udGV4dC5MT0dfTUVTU0FHRTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5icmVha3BvaW50ICYmICF0aGlzLmJyZWFrcG9pbnQuY29uZGl0aW9uICYmIHRoaXMuYnJlYWtwb2ludC5oaXRDb25kaXRpb24pIHtcblx0XHRcdFx0dGhpcy5jb250ZXh0ID0gQ29udGV4dC5ISVRfQ09VTlQ7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuYnJlYWtwb2ludCAmJiB0aGlzLmJyZWFrcG9pbnQudHJpZ2dlcmVkQnkpIHtcblx0XHRcdFx0dGhpcy5jb250ZXh0ID0gQ29udGV4dC5UUklHR0VSX1BPSU5UO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5jb250ZXh0ID0gQ29udGV4dC5DT05ESVRJT047XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG5cdFx0fVxuXG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLm9uRGlkQ2hhbmdlQnJlYWtwb2ludHMoZSA9PiB7XG5cdFx0XHRpZiAodGhpcy5icmVha3BvaW50ICYmIGUgJiYgZS5yZW1vdmVkICYmIGUucmVtb3ZlZC5pbmRleE9mKHRoaXMuYnJlYWtwb2ludCkgPj0gMCkge1xuXHRcdFx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5jb2RlRWRpdG9yU2VydmljZS5yZWdpc3RlckRlY29yYXRpb25UeXBlKCdicmVha3BvaW50LXdpZGdldCcsIERFQ09SQVRJT05fS0VZLCB7fSk7XG5cblx0XHR0aGlzLmNyZWF0ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgcGxhY2Vob2xkZXIoKTogc3RyaW5nIHtcblx0XHRjb25zdCBhY2NlcHRTdHJpbmcgPSB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoQWNjZXB0QnJlYWtwb2ludFdpZGdldElucHV0QWN0aW9uLklEKT8uZ2V0TGFiZWwoKSB8fCAnRW50ZXInO1xuXHRcdGNvbnN0IGNsb3NlU3RyaW5nID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKENsb3NlQnJlYWtwb2ludFdpZGdldENvbW1hbmQuSUQpPy5nZXRMYWJlbCgpIHx8ICdFc2NhcGUnO1xuXHRcdHN3aXRjaCAodGhpcy5jb250ZXh0KSB7XG5cdFx0XHRjYXNlIENvbnRleHQuTE9HX01FU1NBR0U6XG5cdFx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ2JyZWFrcG9pbnRXaWRnZXRMb2dNZXNzYWdlUGxhY2Vob2xkZXInLCBcIk1lc3NhZ2UgdG8gbG9nIHdoZW4gYnJlYWtwb2ludCBpcyBoaXQuIEV4cHJlc3Npb25zIHdpdGhpbiB7fSBhcmUgaW50ZXJwb2xhdGVkLiAnezB9JyB0byBhY2NlcHQsICd7MX0nIHRvIGNhbmNlbC5cIiwgYWNjZXB0U3RyaW5nLCBjbG9zZVN0cmluZyk7XG5cdFx0XHRjYXNlIENvbnRleHQuSElUX0NPVU5UOlxuXHRcdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdicmVha3BvaW50V2lkZ2V0SGl0Q291bnRQbGFjZWhvbGRlcicsIFwiQnJlYWsgd2hlbiBoaXQgY291bnQgY29uZGl0aW9uIGlzIG1ldC4gJ3swfScgdG8gYWNjZXB0LCAnezF9JyB0byBjYW5jZWwuXCIsIGFjY2VwdFN0cmluZywgY2xvc2VTdHJpbmcpO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnYnJlYWtwb2ludFdpZGdldEV4cHJlc3Npb25QbGFjZWhvbGRlcicsIFwiQnJlYWsgd2hlbiBleHByZXNzaW9uIGV2YWx1YXRlcyB0byB0cnVlLiAnezB9JyB0byBhY2NlcHQsICd7MX0nIHRvIGNhbmNlbC5cIiwgYWNjZXB0U3RyaW5nLCBjbG9zZVN0cmluZyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRJbnB1dFZhbHVlKGJyZWFrcG9pbnQ6IElCcmVha3BvaW50IHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKHRoaXMuY29udGV4dCkge1xuXHRcdFx0Y2FzZSBDb250ZXh0LkxPR19NRVNTQUdFOlxuXHRcdFx0XHRyZXR1cm4gYnJlYWtwb2ludCAmJiBicmVha3BvaW50LmxvZ01lc3NhZ2UgPyBicmVha3BvaW50LmxvZ01lc3NhZ2UgOiB0aGlzLmxvZ01lc3NhZ2VJbnB1dDtcblx0XHRcdGNhc2UgQ29udGV4dC5ISVRfQ09VTlQ6XG5cdFx0XHRcdHJldHVybiBicmVha3BvaW50ICYmIGJyZWFrcG9pbnQuaGl0Q29uZGl0aW9uID8gYnJlYWtwb2ludC5oaXRDb25kaXRpb24gOiB0aGlzLmhpdENvdW50SW5wdXQ7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gYnJlYWtwb2ludCAmJiBicmVha3BvaW50LmNvbmRpdGlvbiA/IGJyZWFrcG9pbnQuY29uZGl0aW9uIDogdGhpcy5jb25kaXRpb25JbnB1dDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbWVtYmVySW5wdXQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY29udGV4dCAhPT0gQ29udGV4dC5UUklHR0VSX1BPSU5UKSB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuaW5wdXQuZ2V0TW9kZWwoKS5nZXRWYWx1ZSgpO1xuXHRcdFx0c3dpdGNoICh0aGlzLmNvbnRleHQpIHtcblx0XHRcdFx0Y2FzZSBDb250ZXh0LkxPR19NRVNTQUdFOlxuXHRcdFx0XHRcdHRoaXMubG9nTWVzc2FnZUlucHV0ID0gdmFsdWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgQ29udGV4dC5ISVRfQ09VTlQ6XG5cdFx0XHRcdFx0dGhpcy5oaXRDb3VudElucHV0ID0gdmFsdWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0dGhpcy5jb25kaXRpb25JbnB1dCA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2V0SW5wdXRNb2RlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHQvLyBVc2UgcGxhaW50ZXh0IGxhbmd1YWdlIGZvciBsb2cgbWVzc2FnZXMsIG90aGVyd2lzZSByZXNwZWN0IHVuZGVybHlpbmcgZWRpdG9yIGxhbmd1YWdlICMxMjU2MTlcblx0XHRcdGNvbnN0IGxhbmd1YWdlSWQgPSB0aGlzLmNvbnRleHQgPT09IENvbnRleHQuTE9HX01FU1NBR0UgPyBQTEFJTlRFWFRfTEFOR1VBR0VfSUQgOiB0aGlzLmVkaXRvci5nZXRNb2RlbCgpLmdldExhbmd1YWdlSWQoKTtcblx0XHRcdHRoaXMuaW5wdXQuZ2V0TW9kZWwoKS5zZXRMYW5ndWFnZShsYW5ndWFnZUlkKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBzaG93KHJhbmdlT3JQb3M6IElSYW5nZSB8IElQb3NpdGlvbik6IHZvaWQge1xuXHRcdGNvbnN0IGxpbmVOdW0gPSB0aGlzLmlucHV0LmdldE1vZGVsKCkuZ2V0TGluZUNvdW50KCk7XG5cdFx0c3VwZXIuc2hvdyhyYW5nZU9yUG9zLCBsaW5lTnVtICsgMSk7XG5cdH1cblxuXHRmaXRIZWlnaHRUb0NvbnRlbnQoKTogdm9pZCB7XG5cdFx0Y29uc3QgbGluZU51bSA9IHRoaXMuaW5wdXQuZ2V0TW9kZWwoKS5nZXRMaW5lQ291bnQoKTtcblx0XHR0aGlzLl9yZWxheW91dChsaW5lTnVtICsgMSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2ZpbGxDb250YWluZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuc2V0Q3NzQ2xhc3MoJ2JyZWFrcG9pbnQtd2lkZ2V0Jyk7XG5cdFx0Y29uc3Qgc2VsZWN0Qm94ID0gbmV3IFNlbGVjdEJveChbXG5cdFx0XHR7IHRleHQ6IG5scy5sb2NhbGl6ZSgnZXhwcmVzc2lvbicsIFwiRXhwcmVzc2lvblwiKSB9LFxuXHRcdFx0eyB0ZXh0OiBubHMubG9jYWxpemUoJ2hpdENvdW50JywgXCJIaXQgQ291bnRcIikgfSxcblx0XHRcdHsgdGV4dDogbmxzLmxvY2FsaXplKCdsb2dNZXNzYWdlJywgXCJMb2cgTWVzc2FnZVwiKSB9LFxuXHRcdFx0eyB0ZXh0OiBubHMubG9jYWxpemUoJ3RyaWdnZXJlZEJ5JywgXCJXYWl0IGZvciBCcmVha3BvaW50XCIpIH0sXG5cdFx0XSBzYXRpc2ZpZXMgSVNlbGVjdE9wdGlvbkl0ZW1bXSwgdGhpcy5jb250ZXh0LCB0aGlzLmNvbnRleHRWaWV3U2VydmljZSwgZGVmYXVsdFNlbGVjdEJveFN0eWxlcywgeyBhcmlhTGFiZWw6IG5scy5sb2NhbGl6ZSgnYnJlYWtwb2ludFR5cGUnLCAnQnJlYWtwb2ludCBUeXBlJykgfSk7XG5cdFx0dGhpcy5zZWxlY3RDb250YWluZXIgPSAkKCcuYnJlYWtwb2ludC1zZWxlY3QtY29udGFpbmVyJyk7XG5cdFx0c2VsZWN0Qm94LnJlbmRlcihkb20uYXBwZW5kKGNvbnRhaW5lciwgdGhpcy5zZWxlY3RDb250YWluZXIpKTtcblx0XHRzZWxlY3RCb3gub25EaWRTZWxlY3QoZSA9PiB7XG5cdFx0XHR0aGlzLnJlbWVtYmVySW5wdXQoKTtcblx0XHRcdHRoaXMuY29udGV4dCA9IGUuaW5kZXg7XG5cdFx0XHR0aGlzLnVwZGF0ZUNvbnRleHRJbnB1dCgpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5jcmVhdGVNb2Rlc0lucHV0KGNvbnRhaW5lcik7XG5cblx0XHR0aGlzLmlucHV0Q29udGFpbmVyID0gJCgnLmlucHV0Q29udGFpbmVyJyk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgdGhpcy5pbnB1dENvbnRhaW5lciwgdGhpcy5wbGFjZWhvbGRlcikpO1xuXHRcdHRoaXMuY3JlYXRlQnJlYWtwb2ludElucHV0KGRvbS5hcHBlbmQoY29udGFpbmVyLCB0aGlzLmlucHV0Q29udGFpbmVyKSk7XG5cblx0XHR0aGlzLmlucHV0LmdldE1vZGVsKCkuc2V0VmFsdWUodGhpcy5nZXRJbnB1dFZhbHVlKHRoaXMuYnJlYWtwb2ludCkpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5pbnB1dC5nZXRNb2RlbCgpLm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiB7XG5cdFx0XHR0aGlzLmZpdEhlaWdodFRvQ29udGVudCgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLmlucHV0LnNldFBvc2l0aW9uKHsgbGluZU51bWJlcjogMSwgY29sdW1uOiB0aGlzLmlucHV0LmdldE1vZGVsKCkuZ2V0TGluZU1heENvbHVtbigxKSB9KTtcblxuXHRcdHRoaXMuY3JlYXRlVHJpZ2dlckJyZWFrcG9pbnRJbnB1dChjb250YWluZXIpO1xuXG5cdFx0dGhpcy51cGRhdGVDb250ZXh0SW5wdXQoKTtcblx0XHQvLyBEdWUgdG8gYW4gZWxlY3Ryb24gYnVnIHdlIGhhdmUgdG8gZG8gdGhlIHRpbWVvdXQsIG90aGVyd2lzZSB3ZSBkbyBub3QgZ2V0IGZvY3VzXG5cdFx0c2V0VGltZW91dCgoKSA9PiB0aGlzLmZvY3VzSW5wdXQoKSwgMTUwKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlTW9kZXNJbnB1dChjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3QgbW9kZXMgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldEJyZWFrcG9pbnRNb2Rlcygnc291cmNlJyk7XG5cdFx0aWYgKG1vZGVzLmxlbmd0aCA8PSAxKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2IgPSB0aGlzLnNlbGVjdE1vZGVCb3ggPSBuZXcgU2VsZWN0Qm94KFxuXHRcdFx0W1xuXHRcdFx0XHR7IHRleHQ6IG5scy5sb2NhbGl6ZSgnYnBNb2RlJywgJ01vZGUnKSwgaXNEaXNhYmxlZDogdHJ1ZSB9LFxuXHRcdFx0XHQuLi5tb2Rlcy5tYXAobW9kZSA9PiAoeyB0ZXh0OiBtb2RlLmxhYmVsLCBkZXNjcmlwdGlvbjogbW9kZS5kZXNjcmlwdGlvbiB9KSksXG5cdFx0XHRdLFxuXHRcdFx0bW9kZXMuZmluZEluZGV4KG0gPT4gbS5tb2RlID09PSB0aGlzLmJyZWFrcG9pbnQ/Lm1vZGUpICsgMSxcblx0XHRcdHRoaXMuY29udGV4dFZpZXdTZXJ2aWNlLFxuXHRcdFx0ZGVmYXVsdFNlbGVjdEJveFN0eWxlcyxcblx0XHQpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2goc2IpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2goc2Iub25EaWRTZWxlY3QoZSA9PiB7XG5cdFx0XHR0aGlzLm1vZGVJbnB1dCA9IG1vZGVzW2UuaW5kZXggLSAxXTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCBtb2RlV3JhcHBlciA9ICQoJy5zZWxlY3QtbW9kZS1jb250YWluZXInKTtcblx0XHRjb25zdCBzZWxlY3Rpb25XcmFwcGVyID0gJCgnLnNlbGVjdC1ib3gtY29udGFpbmVyJyk7XG5cdFx0ZG9tLmFwcGVuZChtb2RlV3JhcHBlciwgc2VsZWN0aW9uV3JhcHBlcik7XG5cdFx0c2IucmVuZGVyKHNlbGVjdGlvbldyYXBwZXIpO1xuXHRcdGRvbS5hcHBlbmQoY29udGFpbmVyLCBtb2RlV3JhcHBlcik7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVRyaWdnZXJCcmVha3BvaW50SW5wdXQoY29udGFpbmVyOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IGJyZWFrcG9pbnRzID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRCcmVha3BvaW50cygpLmZpbHRlcihicCA9PiBicCAhPT0gdGhpcy5icmVha3BvaW50ICYmICFicC5sb2dNZXNzYWdlKTtcblx0XHRjb25zdCBicmVha3BvaW50T3B0aW9uczogSVNlbGVjdE9wdGlvbkl0ZW1bXSA9IFtcblx0XHRcdHsgdGV4dDogbmxzLmxvY2FsaXplKCdub1RyaWdnZXJCeUJyZWFrcG9pbnQnLCAnTm9uZScpLCBpc0Rpc2FibGVkOiB0cnVlIH0sXG5cdFx0XHQuLi5icmVha3BvaW50cy5tYXAoYnAgPT4gKHtcblx0XHRcdFx0dGV4dDogYCR7dGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoYnAudXJpLCB7IHJlbGF0aXZlOiB0cnVlIH0pfTogJHticC5saW5lTnVtYmVyfWAsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3RyaWdnZXJCeUxvYWRpbmcnLCAnTG9hZGluZy4uLicpXG5cdFx0XHR9KSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGluZGV4ID0gYnJlYWtwb2ludHMuZmluZEluZGV4KChicCkgPT4gdGhpcy5icmVha3BvaW50Py50cmlnZ2VyZWRCeSA9PT0gYnAuZ2V0SWQoKSk7XG5cdFx0Zm9yIChjb25zdCBbaSwgYnBdIG9mIGJyZWFrcG9pbnRzLmVudHJpZXMoKSkge1xuXHRcdFx0dGhpcy50ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKGJwLnVyaSkudGhlbihyZWYgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGJyZWFrcG9pbnRPcHRpb25zW2kgKyAxXS5kZXNjcmlwdGlvbiA9IHJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsLmdldExpbmVDb250ZW50KGJwLmxpbmVOdW1iZXIpLnRyaW0oKTtcblx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRyZWYuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KS5jYXRjaCgoKSA9PiB7XG5cdFx0XHRcdGJyZWFrcG9pbnRPcHRpb25zW2kgKyAxXS5kZXNjcmlwdGlvbiA9IG5scy5sb2NhbGl6ZSgnbm9CcFNvdXJjZScsICdDb3VsZCBub3QgbG9hZCBzb3VyY2UuJyk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCBzZWxlY3RCcmVha3BvaW50Qm94ID0gdGhpcy5zZWxlY3RCcmVha3BvaW50Qm94ID0gbmV3IFNlbGVjdEJveChicmVha3BvaW50T3B0aW9ucywgaW5kZXggKyAxLCB0aGlzLmNvbnRleHRWaWV3U2VydmljZSwgZGVmYXVsdFNlbGVjdEJveFN0eWxlcywgeyBhcmlhTGFiZWw6IG5scy5sb2NhbGl6ZSgnc2VsZWN0QnJlYWtwb2ludCcsICdTZWxlY3QgYnJlYWtwb2ludCcpIH0pO1xuXHRcdHNlbGVjdEJyZWFrcG9pbnRCb3gub25EaWRTZWxlY3QoZSA9PiB7XG5cdFx0XHRpZiAoZS5pbmRleCA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLnRyaWdnZXJlZEJ5QnJlYWtwb2ludElucHV0ID0gdW5kZWZpbmVkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy50cmlnZ2VyZWRCeUJyZWFrcG9pbnRJbnB1dCA9IGJyZWFrcG9pbnRzW2UuaW5kZXggLSAxXTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHNlbGVjdEJyZWFrcG9pbnRCb3gpO1xuXHRcdHRoaXMuc2VsZWN0QnJlYWtwb2ludENvbnRhaW5lciA9ICQoJy5zZWxlY3QtYnJlYWtwb2ludC1jb250YWluZXInKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5zZWxlY3RCcmVha3BvaW50Q29udGFpbmVyLCBkb20uRXZlbnRUeXBlLktFWV9ET1dOLCBlID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5Fc2NhcGUpKSB7XG5cdFx0XHRcdHRoaXMuY2xvc2UoZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHNlbGVjdGlvbldyYXBwZXIgPSAkKCcuc2VsZWN0LWJveC1jb250YWluZXInKTtcblx0XHRkb20uYXBwZW5kKHRoaXMuc2VsZWN0QnJlYWtwb2ludENvbnRhaW5lciwgc2VsZWN0aW9uV3JhcHBlcik7XG5cdFx0c2VsZWN0QnJlYWtwb2ludEJveC5yZW5kZXIoc2VsZWN0aW9uV3JhcHBlcik7XG5cblx0XHRkb20uYXBwZW5kKGNvbnRhaW5lciwgdGhpcy5zZWxlY3RCcmVha3BvaW50Q29udGFpbmVyKTtcblxuXHRcdGNvbnN0IGNsb3NlQnV0dG9uID0gbmV3IEJ1dHRvbih0aGlzLnNlbGVjdEJyZWFrcG9pbnRDb250YWluZXIsIGRlZmF1bHRCdXR0b25TdHlsZXMpO1xuXHRcdGNsb3NlQnV0dG9uLmxhYmVsID0gbmxzLmxvY2FsaXplKCdvaycsIFwiT0tcIik7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaChjbG9zZUJ1dHRvbi5vbkRpZENsaWNrKCgpID0+IHRoaXMuY2xvc2UodHJ1ZSkpKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKGNsb3NlQnV0dG9uKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ29udGV4dElucHV0KCkge1xuXHRcdGlmICh0aGlzLmNvbnRleHQgPT09IENvbnRleHQuVFJJR0dFUl9QT0lOVCkge1xuXHRcdFx0dGhpcy5pbnB1dENvbnRhaW5lci5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0dGhpcy5zZWxlY3RCcmVha3BvaW50Q29udGFpbmVyLmhpZGRlbiA9IGZhbHNlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmlucHV0Q29udGFpbmVyLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0dGhpcy5zZWxlY3RCcmVha3BvaW50Q29udGFpbmVyLmhpZGRlbiA9IHRydWU7XG5cdFx0XHR0aGlzLnNldElucHV0TW9kZSgpO1xuXHRcdFx0Y29uc3QgdmFsdWUgPSB0aGlzLmdldElucHV0VmFsdWUodGhpcy5icmVha3BvaW50KTtcblx0XHRcdHRoaXMuaW5wdXQuZ2V0TW9kZWwoKS5zZXRWYWx1ZSh2YWx1ZSk7XG5cdFx0XHR0aGlzLmZvY3VzSW5wdXQoKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX2RvTGF5b3V0KGhlaWdodEluUGl4ZWw6IG51bWJlciwgd2lkdGhJblBpeGVsOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLmhlaWdodEluUHggPSBoZWlnaHRJblBpeGVsO1xuXHRcdHRoaXMuaW5wdXQubGF5b3V0KHsgaGVpZ2h0OiBoZWlnaHRJblBpeGVsLCB3aWR0aDogd2lkdGhJblBpeGVsIC0gMTEzIH0pO1xuXHRcdHRoaXMuY2VudGVySW5wdXRWZXJ0aWNhbGx5KCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX29uV2lkdGgod2lkdGhJblBpeGVsOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodHlwZW9mIHRoaXMuaGVpZ2h0SW5QeCA9PT0gJ251bWJlcicpIHtcblx0XHRcdHRoaXMuX2RvTGF5b3V0KHRoaXMuaGVpZ2h0SW5QeCwgd2lkdGhJblBpeGVsKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUJyZWFrcG9pbnRJbnB1dChjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29uc3Qgc2NvcGVkSW5zdGF0aWF0aW9uU2VydmljZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlQ2hpbGQobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFxuXHRcdFx0W0lQcml2YXRlQnJlYWtwb2ludFdpZGdldFNlcnZpY2UsIHRoaXNdXG5cdFx0KSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaChzY29wZWRJbnN0YXRpYXRpb25TZXJ2aWNlKTtcblxuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLmNyZWF0ZUVkaXRvck9wdGlvbnMoKTtcblx0XHRjb25zdCBjb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucyA9IGdldFNpbXBsZUNvZGVFZGl0b3JXaWRnZXRPcHRpb25zKCk7XG5cdFx0dGhpcy5pbnB1dCA9IDxJQWN0aXZlQ29kZUVkaXRvcj5zY29wZWRJbnN0YXRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvZGVFZGl0b3JXaWRnZXQsIGNvbnRhaW5lciwgb3B0aW9ucywgY29kZUVkaXRvcldpZGdldE9wdGlvbnMpO1xuXG5cdFx0Q09OVEVYVF9JTl9CUkVBS1BPSU5UX1dJREdFVC5iaW5kVG8odGhpcy5pbnB1dC5jb250ZXh0S2V5U2VydmljZSkuc2V0KHRydWUpO1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoJycsIG51bGwsIHVyaS5wYXJzZShgJHtERUJVR19TQ0hFTUV9OiR7dGhpcy5lZGl0b3IuZ2V0SWQoKX06YnJlYWtwb2ludGlucHV0YCksIHRydWUpO1xuXHRcdGlmICh0aGlzLmVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRtb2RlbC5zZXRMYW5ndWFnZSh0aGlzLmVkaXRvci5nZXRNb2RlbCgpLmdldExhbmd1YWdlSWQoKSk7XG5cdFx0fVxuXHRcdHRoaXMuaW5wdXQuc2V0TW9kZWwobW9kZWwpO1xuXHRcdHRoaXMuc2V0SW5wdXRNb2RlKCk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaChtb2RlbCk7XG5cdFx0Y29uc3Qgc2V0RGVjb3JhdGlvbnMgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuaW5wdXQuZ2V0TW9kZWwoKS5nZXRWYWx1ZSgpO1xuXHRcdFx0Y29uc3QgZGVjb3JhdGlvbnMgPSAhIXZhbHVlID8gW10gOiBjcmVhdGVEZWNvcmF0aW9ucyh0aGlzLnRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCksIHRoaXMucGxhY2Vob2xkZXIpO1xuXHRcdFx0dGhpcy5pbnB1dC5zZXREZWNvcmF0aW9uc0J5VHlwZSgnYnJlYWtwb2ludC13aWRnZXQnLCBERUNPUkFUSU9OX0tFWSwgZGVjb3JhdGlvbnMpO1xuXHRcdH07XG5cdFx0dGhpcy5pbnB1dC5nZXRNb2RlbCgpLm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiBzZXREZWNvcmF0aW9ucygpKTtcblx0XHR0aGlzLnRoZW1lU2VydmljZS5vbkRpZENvbG9yVGhlbWVDaGFuZ2UoKCkgPT4gc2V0RGVjb3JhdGlvbnMoKSk7XG5cblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMubGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiBERUJVR19TQ0hFTUUsIGhhc0FjY2Vzc1RvQWxsTW9kZWxzOiB0cnVlIH0sIHtcblx0XHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiAnYnJlYWtwb2ludFdpZGdldCcsXG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zOiAobW9kZWw6IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbiwgX2NvbnRleHQ6IENvbXBsZXRpb25Db250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPENvbXBsZXRpb25MaXN0PiA9PiB7XG5cdFx0XHRcdGxldCBzdWdnZXN0aW9uc1Byb21pc2U6IFByb21pc2U8Q29tcGxldGlvbkxpc3Q+O1xuXHRcdFx0XHRjb25zdCB1bmRlcmx5aW5nTW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdFx0XHRpZiAodW5kZXJseWluZ01vZGVsICYmICh0aGlzLmNvbnRleHQgPT09IENvbnRleHQuQ09ORElUSU9OIHx8ICh0aGlzLmNvbnRleHQgPT09IENvbnRleHQuTE9HX01FU1NBR0UgJiYgaXNQb3NpdGlvbkluQ3VybHlCcmFja2V0QmxvY2sodGhpcy5pbnB1dCkpKSkge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zUHJvbWlzZSA9IHByb3ZpZGVTdWdnZXN0aW9uSXRlbXModGhpcy5sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb21wbGV0aW9uUHJvdmlkZXIsIHVuZGVybHlpbmdNb2RlbCwgbmV3IFBvc2l0aW9uKHRoaXMubGluZU51bWJlciwgMSksIG5ldyBDb21wbGV0aW9uT3B0aW9ucyh1bmRlZmluZWQsIG5ldyBTZXQ8Q29tcGxldGlvbkl0ZW1LaW5kPigpLmFkZChDb21wbGV0aW9uSXRlbUtpbmQuU25pcHBldCkpLCBfY29udGV4dCwgdG9rZW4pLnRoZW4oc3VnZ2VzdGlvbnMgPT4ge1xuXG5cdFx0XHRcdFx0XHRsZXQgb3ZlcndyaXRlQmVmb3JlID0gMDtcblx0XHRcdFx0XHRcdGlmICh0aGlzLmNvbnRleHQgPT09IENvbnRleHQuQ09ORElUSU9OKSB7XG5cdFx0XHRcdFx0XHRcdG92ZXJ3cml0ZUJlZm9yZSA9IHBvc2l0aW9uLmNvbHVtbiAtIDE7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHQvLyBJbnNpZGUgdGhlIGN1cnJseSBicmFja2V0cywgbmVlZCB0byBjb3VudCBob3cgbWFueSB1c2VmdWwgY2hhcmFjdGVycyBhcmUgYmVoaW5kIHRoZSBwb3NpdGlvbiBzbyB0aGV5IHdvdWxkIGFsbCBiZSB0YWtlbiBpbnRvIGFjY291bnRcblx0XHRcdFx0XHRcdFx0Y29uc3QgdmFsdWUgPSB0aGlzLmlucHV0LmdldE1vZGVsKCkuZ2V0VmFsdWUoKTtcblx0XHRcdFx0XHRcdFx0d2hpbGUgKChwb3NpdGlvbi5jb2x1bW4gLSAyIC0gb3ZlcndyaXRlQmVmb3JlID49IDApICYmIHZhbHVlW3Bvc2l0aW9uLmNvbHVtbiAtIDIgLSBvdmVyd3JpdGVCZWZvcmVdICE9PSAneycgJiYgdmFsdWVbcG9zaXRpb24uY29sdW1uIC0gMiAtIG92ZXJ3cml0ZUJlZm9yZV0gIT09ICcgJykge1xuXHRcdFx0XHRcdFx0XHRcdG92ZXJ3cml0ZUJlZm9yZSsrO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBzdWdnZXN0aW9ucy5pdGVtcy5tYXAocyA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0cy5jb21wbGV0aW9uLnJhbmdlID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3NpdGlvbi5kZWx0YSgwLCAtb3ZlcndyaXRlQmVmb3JlKSwgcG9zaXRpb24pO1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBzLmNvbXBsZXRpb247XG5cdFx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zUHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSh7IHN1Z2dlc3Rpb25zOiBbXSB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBzdWdnZXN0aW9uc1Byb21pc2U7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oKGUpID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3IuZm9udFNpemUnKSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3IubGluZUhlaWdodCcpKSB7XG5cdFx0XHRcdHRoaXMuaW5wdXQudXBkYXRlT3B0aW9ucyh0aGlzLmNyZWF0ZUVkaXRvck9wdGlvbnMoKSk7XG5cdFx0XHRcdHRoaXMuY2VudGVySW5wdXRWZXJ0aWNhbGx5KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVFZGl0b3JPcHRpb25zKCk6IElFZGl0b3JPcHRpb25zIHtcblx0XHRjb25zdCBlZGl0b3JDb25maWcgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRWRpdG9yT3B0aW9ucz4oJ2VkaXRvcicpO1xuXHRcdGNvbnN0IG9wdGlvbnMgPSBnZXRTaW1wbGVFZGl0b3JPcHRpb25zKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRvcHRpb25zLmZvbnRTaXplID0gZWRpdG9yQ29uZmlnLmZvbnRTaXplO1xuXHRcdG9wdGlvbnMuZm9udEZhbWlseSA9IGVkaXRvckNvbmZpZy5mb250RmFtaWx5O1xuXHRcdG9wdGlvbnMubGluZUhlaWdodCA9IGVkaXRvckNvbmZpZy5saW5lSGVpZ2h0O1xuXHRcdG9wdGlvbnMuZm9udExpZ2F0dXJlcyA9IGVkaXRvckNvbmZpZy5mb250TGlnYXR1cmVzO1xuXHRcdG9wdGlvbnMuYXJpYUxhYmVsID0gdGhpcy5wbGFjZWhvbGRlcjtcblx0XHRyZXR1cm4gb3B0aW9ucztcblx0fVxuXG5cdHByaXZhdGUgY2VudGVySW5wdXRWZXJ0aWNhbGx5KCkge1xuXHRcdGlmICh0aGlzLmNvbnRhaW5lciAmJiB0eXBlb2YgdGhpcy5oZWlnaHRJblB4ID09PSAnbnVtYmVyJykge1xuXHRcdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMuaW5wdXQuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHRcdGNvbnN0IGxpbmVOdW0gPSB0aGlzLmlucHV0LmdldE1vZGVsKCkuZ2V0TGluZUNvdW50KCk7XG5cdFx0XHRjb25zdCBuZXdUb3BNYXJnaW4gPSAodGhpcy5oZWlnaHRJblB4IC0gbGluZU51bSAqIGxpbmVIZWlnaHQpIC8gMjtcblx0XHRcdHRoaXMuaW5wdXRDb250YWluZXIuc3R5bGUubWFyZ2luVG9wID0gbmV3VG9wTWFyZ2luICsgJ3B4Jztcblx0XHR9XG5cdH1cblxuXHRjbG9zZShzdWNjZXNzOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHN1Y2Nlc3MpIHtcblx0XHRcdC8vIGlmIHRoZXJlIGlzIGFscmVhZHkgYSBicmVha3BvaW50IG9uIHRoaXMgbG9jYXRpb24gLSByZW1vdmUgaXQuXG5cblx0XHRcdGxldCBjb25kaXRpb246IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdGxldCBoaXRDb25kaXRpb246IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdGxldCBsb2dNZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgdHJpZ2dlcmVkQnk6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdGxldCBtb2RlOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgbW9kZUxhYmVsOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRcdHRoaXMucmVtZW1iZXJJbnB1dCgpO1xuXG5cdFx0XHRpZiAodGhpcy5jb25kaXRpb25JbnB1dCB8fCB0aGlzLmNvbnRleHQgPT09IENvbnRleHQuQ09ORElUSU9OKSB7XG5cdFx0XHRcdGNvbmRpdGlvbiA9IHRoaXMuY29uZGl0aW9uSW5wdXQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5oaXRDb3VudElucHV0IHx8IHRoaXMuY29udGV4dCA9PT0gQ29udGV4dC5ISVRfQ09VTlQpIHtcblx0XHRcdFx0aGl0Q29uZGl0aW9uID0gdGhpcy5oaXRDb3VudElucHV0O1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMubG9nTWVzc2FnZUlucHV0IHx8IHRoaXMuY29udGV4dCA9PT0gQ29udGV4dC5MT0dfTUVTU0FHRSkge1xuXHRcdFx0XHRsb2dNZXNzYWdlID0gdGhpcy5sb2dNZXNzYWdlSW5wdXQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5zZWxlY3RNb2RlQm94KSB7XG5cdFx0XHRcdG1vZGUgPSB0aGlzLm1vZGVJbnB1dD8ubW9kZTtcblx0XHRcdFx0bW9kZUxhYmVsID0gdGhpcy5tb2RlSW5wdXQ/LmxhYmVsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuY29udGV4dCA9PT0gQ29udGV4dC5UUklHR0VSX1BPSU5UKSB7XG5cdFx0XHRcdC8vIGN1cnJlbnRseSwgdHJpZ2dlciBwb2ludHMgZG9uJ3Qgc3VwcG9ydCBhZGRpdGlvbmFsIGNvbmRpdGlvbnM6XG5cdFx0XHRcdGNvbmRpdGlvbiA9IHVuZGVmaW5lZDtcblx0XHRcdFx0aGl0Q29uZGl0aW9uID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRsb2dNZXNzYWdlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0cmlnZ2VyZWRCeSA9IHRoaXMudHJpZ2dlcmVkQnlCcmVha3BvaW50SW5wdXQ/LmdldElkKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmJyZWFrcG9pbnQpIHtcblx0XHRcdFx0Y29uc3QgZGF0YSA9IG5ldyBNYXA8c3RyaW5nLCBJQnJlYWtwb2ludFVwZGF0ZURhdGE+KCk7XG5cdFx0XHRcdGRhdGEuc2V0KHRoaXMuYnJlYWtwb2ludC5nZXRJZCgpLCB7XG5cdFx0XHRcdFx0Y29uZGl0aW9uLFxuXHRcdFx0XHRcdGhpdENvbmRpdGlvbixcblx0XHRcdFx0XHRsb2dNZXNzYWdlLFxuXHRcdFx0XHRcdHRyaWdnZXJlZEJ5LFxuXHRcdFx0XHRcdG1vZGUsXG5cdFx0XHRcdFx0bW9kZUxhYmVsLFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2UudXBkYXRlQnJlYWtwb2ludHModGhpcy5icmVha3BvaW50Lm9yaWdpbmFsVXJpLCBkYXRhLCBmYWxzZSkudGhlbih1bmRlZmluZWQsIG9uVW5leHBlY3RlZEVycm9yKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2UuYWRkQnJlYWtwb2ludHMobW9kZWwudXJpLCBbe1xuXHRcdFx0XHRcdFx0bGluZU51bWJlcjogdGhpcy5saW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0Y29sdW1uOiB0aGlzLmNvbHVtbixcblx0XHRcdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdFx0XHRjb25kaXRpb24sXG5cdFx0XHRcdFx0XHRoaXRDb25kaXRpb24sXG5cdFx0XHRcdFx0XHRsb2dNZXNzYWdlLFxuXHRcdFx0XHRcdFx0dHJpZ2dlcmVkQnksXG5cdFx0XHRcdFx0XHRtb2RlLFxuXHRcdFx0XHRcdFx0bW9kZUxhYmVsLFxuXHRcdFx0XHRcdH1dKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBmb2N1c0lucHV0KCkge1xuXHRcdGlmICh0aGlzLmNvbnRleHQgPT09IENvbnRleHQuVFJJR0dFUl9QT0lOVCkge1xuXHRcdFx0dGhpcy5zZWxlY3RCcmVha3BvaW50Qm94LmZvY3VzKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuaW5wdXQuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLmlucHV0LmRpc3Bvc2UoKTtcblx0XHRsaWZlY3ljbGUuZGlzcG9zZSh0aGlzLnRvRGlzcG9zZSk7XG5cdFx0c2V0VGltZW91dCgoKSA9PiB0aGlzLmVkaXRvci5mb2N1cygpLCAwKTtcblx0fVxufVxuXG5jbGFzcyBBY2NlcHRCcmVha3BvaW50V2lkZ2V0SW5wdXRBY3Rpb24gZXh0ZW5kcyBFZGl0b3JDb21tYW5kIHtcblx0c3RhdGljIElEID0gJ2JyZWFrcG9pbnRXaWRnZXQuYWN0aW9uLmFjY2VwdElucHV0Jztcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEFjY2VwdEJyZWFrcG9pbnRXaWRnZXRJbnB1dEFjdGlvbi5JRCxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9CUkVBS1BPSU5UX1dJREdFVF9WSVNJQkxFLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogQ09OVEVYVF9JTl9CUkVBS1BPSU5UX1dJREdFVCxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bkVkaXRvckNvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblx0XHRhY2Nlc3Nvci5nZXQoSVByaXZhdGVCcmVha3BvaW50V2lkZ2V0U2VydmljZSkuY2xvc2UodHJ1ZSk7XG5cdH1cbn1cblxuY2xhc3MgQ2xvc2VCcmVha3BvaW50V2lkZ2V0Q29tbWFuZCBleHRlbmRzIEVkaXRvckNvbW1hbmQge1xuXHRzdGF0aWMgSUQgPSAnY2xvc2VCcmVha3BvaW50V2lkZ2V0Jztcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENsb3NlQnJlYWtwb2ludFdpZGdldENvbW1hbmQuSUQsXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfQlJFQUtQT0lOVF9XSURHRVRfVklTSUJMRSxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZSxcblx0XHRcdFx0c2Vjb25kYXJ5OiBbS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5Fc2NhcGVdLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogYW55KTogdm9pZCB7XG5cdFx0Y29uc3QgZGVidWdDb250cmlidXRpb24gPSBlZGl0b3IuZ2V0Q29udHJpYnV0aW9uPElCcmVha3BvaW50RWRpdG9yQ29udHJpYnV0aW9uPihCUkVBS1BPSU5UX0VESVRPUl9DT05UUklCVVRJT05fSUQpO1xuXHRcdGlmIChkZWJ1Z0NvbnRyaWJ1dGlvbikge1xuXHRcdFx0Ly8gaWYgZm9jdXMgaXMgaW4gb3V0ZXIgZWRpdG9yIHdlIG5lZWQgdG8gdXNlIHRoZSBkZWJ1ZyBjb250cmlidXRpb24gdG8gY2xvc2Vcblx0XHRcdHJldHVybiBkZWJ1Z0NvbnRyaWJ1dGlvbi5jbG9zZUJyZWFrcG9pbnRXaWRnZXQoKTtcblx0XHR9XG5cblx0XHRhY2Nlc3Nvci5nZXQoSVByaXZhdGVCcmVha3BvaW50V2lkZ2V0U2VydmljZSkuY2xvc2UoZmFsc2UpO1xuXHR9XG59XG5cbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQWNjZXB0QnJlYWtwb2ludFdpZGdldElucHV0QWN0aW9uKCkpO1xucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBDbG9zZUJyZWFrcG9pbnRXaWRnZXRDb21tYW5kKCkpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsK0JBQStCO0FBQ3hDLFNBQTRCLGlCQUFpQjtBQUU3QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFNBQVMsY0FBYztBQUNoQyxZQUFZLGVBQWU7QUFDM0IsU0FBUyxP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
