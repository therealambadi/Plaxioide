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
import { addDisposableListener, isKeyboardEvent } from "../../../../base/browser/dom.js";
import { DomEmitter } from "../../../../base/browser/event.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { memoize } from "../../../../base/common/decorators.js";
import { illegalArgument, onUnexpectedExternalError } from "../../../../base/common/errors.js";
import { Event } from "../../../../base/common/event.js";
import { visit } from "../../../../base/common/json.js";
import { setProperty } from "../../../../base/common/jsonEdit.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { DisposableStore, MutableDisposable, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { clamp } from "../../../../base/common/numbers.js";
import { basename } from "../../../../base/common/path.js";
import * as env from "../../../../base/common/platform.js";
import * as strings from "../../../../base/common/strings.js";
import { assertType, isDefined } from "../../../../base/common/types.js";
import { Constants } from "../../../../base/common/uint.js";
import { URI } from "../../../../base/common/uri.js";
import { CoreEditingCommands } from "../../../../editor/browser/coreCommands.js";
import { MouseTargetType } from "../../../../editor/browser/editorBrowser.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { EditOperation } from "../../../../editor/common/core/editOperation.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { DEFAULT_WORD_REGEXP } from "../../../../editor/common/core/wordHelper.js";
import { ScrollType } from "../../../../editor/common/editorCommon.js";
import { StandardTokenType } from "../../../../editor/common/encodedTokenAttributes.js";
import { InjectedTextCursorStops } from "../../../../editor/common/model.js";
import { ILanguageFeatureDebounceService } from "../../../../editor/common/services/languageFeatureDebounce.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ContentHoverController } from "../../../../editor/contrib/hover/browser/contentHoverController.js";
import { HoverStartMode, HoverStartSource } from "../../../../editor/contrib/hover/browser/hoverOperation.js";
import * as nls from "../../../../nls.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { registerColor } from "../../../../platform/theme/common/colorRegistry.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { DebugHoverWidget, ShowDebugHoverResult } from "./debugHover.js";
import { ExceptionWidget } from "./exceptionWidget.js";
import { CONTEXT_EXCEPTION_WIDGET_VISIBLE, IDebugService, State } from "../common/debug.js";
import { Expression } from "../common/debugModel.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
const MAX_NUM_INLINE_VALUES = 100;
const MAX_INLINE_DECORATOR_LENGTH = 150;
const MAX_TOKENIZATION_LINE_LEN = 500;
const DEAFULT_INLINE_DEBOUNCE_DELAY = 200;
const debugInlineForeground = registerColor("editor.inlineValuesForeground", {
  dark: "#ffffff80",
  light: "#00000080",
  hcDark: "#ffffff80",
  hcLight: "#00000080"
}, nls.localize("editor.inlineValuesForeground", "Color for the debug inline value text."));
const debugInlineBackground = registerColor("editor.inlineValuesBackground", "#ffc80033", nls.localize("editor.inlineValuesBackground", "Color for the debug inline value background."));
class InlineSegment {
  constructor(column, text) {
    this.column = column;
    this.text = text;
  }
}
function formatHoverContent(contentText) {
  if (contentText.includes(",") && contentText.includes("=")) {
    const customSplit = (text) => {
      const splits = [];
      let equalsFound = 0;
      let start = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === "=") {
          if (equalsFound === 0) {
            equalsFound++;
            continue;
          }
          const commaIndex = text.lastIndexOf(",", i);
          if (commaIndex !== -1 && commaIndex >= start) {
            splits.push(commaIndex);
            start = commaIndex + 1;
          }
          equalsFound++;
        }
      }
      const result = [];
      let s = 0;
      for (const index of splits) {
        result.push(text.substring(s, index).trim());
        s = index + 1;
      }
      if (s < text.length) {
        result.push(text.substring(s).trim());
      }
      return result;
    };
    const pairs = customSplit(contentText);
    const formattedPairs = pairs.map((pair) => {
      const equalsIndex = pair.indexOf("=");
      if (equalsIndex !== -1) {
        const indent = " ".repeat(equalsIndex + 2);
        const [firstLine, ...restLines] = pair.split(/\r?\n/);
        return [firstLine, ...restLines.map((line) => indent + line)].join("\n");
      }
      return pair;
    });
    return new MarkdownString().appendCodeblock("", formattedPairs.join(",\n"));
  }
  return new MarkdownString().appendCodeblock("", contentText);
}
function createInlineValueDecoration(lineNumber, contentText, classNamePrefix, column = Constants.MAX_SAFE_SMALL_INTEGER, viewportMaxCol = MAX_INLINE_DECORATOR_LENGTH) {
  const rawText = contentText;
  if (contentText.length > viewportMaxCol) {
    contentText = contentText.substring(0, viewportMaxCol) + "...";
  }
  return [
    {
      range: {
        startLineNumber: lineNumber,
        endLineNumber: lineNumber,
        startColumn: column,
        endColumn: column
      },
      options: {
        description: `${classNamePrefix}-inline-value-decoration-spacer`,
        after: {
          content: strings.noBreakWhitespace,
          cursorStops: InjectedTextCursorStops.None
        },
        showIfCollapsed: true
      }
    },
    {
      range: {
        startLineNumber: lineNumber,
        endLineNumber: lineNumber,
        startColumn: column,
        endColumn: column
      },
      options: {
        description: `${classNamePrefix}-inline-value-decoration`,
        after: {
          content: replaceWsWithNoBreakWs(contentText),
          inlineClassName: `${classNamePrefix}-inline-value`,
          inlineClassNameAffectsLetterSpacing: true,
          cursorStops: InjectedTextCursorStops.None
        },
        showIfCollapsed: true,
        hoverMessage: formatHoverContent(rawText)
      }
    }
  ];
}
function replaceWsWithNoBreakWs(str) {
  return str.replace(/[ \t\n]/g, strings.noBreakWhitespace);
}
function createInlineValueDecorationsInsideRange(expressions, ranges, model, wordToLineNumbersMap) {
  const nameValueMap = /* @__PURE__ */ new Map();
  for (const expr of expressions) {
    nameValueMap.set(expr.name, expr.value);
    if (nameValueMap.size >= MAX_NUM_INLINE_VALUES) {
      break;
    }
  }
  const lineToNamesMap = /* @__PURE__ */ new Map();
  nameValueMap.forEach((_value, name) => {
    const lineNumbers = wordToLineNumbersMap.get(name);
    if (lineNumbers) {
      for (const lineNumber of lineNumbers) {
        if (ranges.some((r) => lineNumber >= r.startLineNumber && lineNumber <= r.endLineNumber)) {
          if (!lineToNamesMap.has(lineNumber)) {
            lineToNamesMap.set(lineNumber, []);
          }
          if (lineToNamesMap.get(lineNumber).indexOf(name) === -1) {
            lineToNamesMap.get(lineNumber).push(name);
          }
        }
      }
    }
  });
  return [...lineToNamesMap].map(([line, names]) => ({
    line,
    variables: names.sort((first, second) => {
      const content = model.getLineContent(line);
      return content.indexOf(first) - content.indexOf(second);
    }).map((name) => ({ name, value: nameValueMap.get(name) }))
  }));
}
function getWordToLineNumbersMap(model, lineNumber, result) {
  const lineLength = model.getLineLength(lineNumber);
  if (lineLength > MAX_TOKENIZATION_LINE_LEN) {
    return;
  }
  const lineContent = model.getLineContent(lineNumber);
  model.tokenization.forceTokenization(lineNumber);
  const lineTokens = model.tokenization.getLineTokens(lineNumber);
  for (let tokenIndex = 0, tokenCount = lineTokens.getCount(); tokenIndex < tokenCount; tokenIndex++) {
    const tokenType = lineTokens.getStandardTokenType(tokenIndex);
    if (tokenType === StandardTokenType.Other) {
      DEFAULT_WORD_REGEXP.lastIndex = 0;
      const tokenStartOffset = lineTokens.getStartOffset(tokenIndex);
      const tokenEndOffset = lineTokens.getEndOffset(tokenIndex);
      const tokenStr = lineContent.substring(tokenStartOffset, tokenEndOffset);
      const wordMatch = DEFAULT_WORD_REGEXP.exec(tokenStr);
      if (wordMatch) {
        const word = wordMatch[0];
        if (!result.has(word)) {
          result.set(word, []);
        }
        result.get(word).push(lineNumber);
      }
    }
  }
}
let DebugEditorContribution = class {
  constructor(editor, debugService, instantiationService, commandService, configurationService, hostService, uriIdentityService, contextKeyService, languageFeaturesService, featureDebounceService) {
    this.editor = editor;
    this.debugService = debugService;
    this.instantiationService = instantiationService;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.hostService = hostService;
    this.uriIdentityService = uriIdentityService;
    this.languageFeaturesService = languageFeaturesService;
    this.mouseDown = false;
    this.gutterIsHovered = false;
    this.altListener = new MutableDisposable();
    this.altPressed = false;
    this.displayedStore = new DisposableStore();
    // Holds a Disposable that prevents the default editor hover behavior while it exists.
    this.defaultHoverLockout = new MutableDisposable();
    this.oldDecorations = this.editor.createDecorationsCollection();
    this.debounceInfo = featureDebounceService.for(languageFeaturesService.inlineValuesProvider, "InlineValues", { min: DEAFULT_INLINE_DEBOUNCE_DELAY });
    this.hoverWidget = this.instantiationService.createInstance(DebugHoverWidget, this.editor);
    this.toDispose = [this.defaultHoverLockout, this.altListener, this.displayedStore];
    this.registerListeners();
    this.exceptionWidgetVisible = CONTEXT_EXCEPTION_WIDGET_VISIBLE.bindTo(contextKeyService);
    this.toggleExceptionWidget();
  }
  registerListeners() {
    this.toDispose.push(this.debugService.getViewModel().onDidFocusStackFrame((e) => this.onFocusStackFrame(e.stackFrame)));
    this.toDispose.push(this.editor.onMouseDown((e) => this.onEditorMouseDown(e)));
    this.toDispose.push(this.editor.onMouseUp(() => this.mouseDown = false));
    this.toDispose.push(this.editor.onMouseMove((e) => this.onEditorMouseMove(e)));
    this.toDispose.push(this.editor.onMouseLeave((e) => {
      const hoverDomNode = this.hoverWidget.getDomNode();
      if (!hoverDomNode) {
        return;
      }
      const rect = hoverDomNode.getBoundingClientRect();
      if (e.event.posx < rect.left || e.event.posx > rect.right || e.event.posy < rect.top || e.event.posy > rect.bottom) {
        this.hideHoverWidget();
      }
    }));
    this.toDispose.push(this.editor.onKeyDown((e) => this.onKeyDown(e)));
    this.toDispose.push(this.editor.onDidChangeModelContent(() => {
      this._wordToLineNumbersMap = void 0;
      this.updateInlineValuesScheduler.schedule();
    }));
    this.toDispose.push(this.debugService.getViewModel().onWillUpdateViews(() => this.updateInlineValuesScheduler.schedule()));
    this.toDispose.push(this.debugService.getViewModel().onDidEvaluateLazyExpression(() => this.updateInlineValuesScheduler.schedule()));
    this.toDispose.push(this.editor.onDidChangeModel(async () => {
      this.addDocumentListeners();
      this.toggleExceptionWidget();
      this.hideHoverWidget();
      this._wordToLineNumbersMap = void 0;
      const stackFrame = this.debugService.getViewModel().focusedStackFrame;
      await this.updateInlineValueDecorations(stackFrame);
    }));
    this.toDispose.push(this.editor.onDidScrollChange(() => {
      this.hideHoverWidget();
      const model = this.editor.getModel();
      if (model && this.languageFeaturesService.inlineValuesProvider.has(model)) {
        this.updateInlineValuesScheduler.schedule();
      }
    }));
    this.toDispose.push(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.hover")) {
        this.updateHoverConfiguration();
      }
    }));
    this.toDispose.push(this.debugService.onDidChangeState((state) => {
      if (state !== State.Stopped) {
        this.toggleExceptionWidget();
      }
    }));
    this.updateHoverConfiguration();
  }
  updateHoverConfiguration() {
    const model = this.editor.getModel();
    if (model) {
      this.editorHoverOptions = this.configurationService.getValue("editor.hover", {
        resource: model.uri,
        overrideIdentifier: model.getLanguageId()
      });
    }
  }
  addDocumentListeners() {
    const stackFrame = this.debugService.getViewModel().focusedStackFrame;
    const model = this.editor.getModel();
    if (model) {
      this.applyDocumentListeners(model, stackFrame);
    }
  }
  applyDocumentListeners(model, stackFrame) {
    if (!stackFrame || !this.uriIdentityService.extUri.isEqual(model.uri, stackFrame.source.uri)) {
      this.altListener.clear();
      return;
    }
    const ownerDocument = this.editor.getContainerDomNode().ownerDocument;
    this.altListener.value = addDisposableListener(ownerDocument, "keydown", (keydownEvent) => {
      const standardKeyboardEvent = new StandardKeyboardEvent(keydownEvent);
      if (standardKeyboardEvent.keyCode === KeyCode.Alt) {
        this.altPressed = true;
        const debugHoverWasVisible = this.hoverWidget.isVisible();
        this.hoverWidget.hide();
        this.defaultHoverLockout.clear();
        if (debugHoverWasVisible && this.hoverPosition) {
          this.showEditorHover(this.hoverPosition.position, false);
        }
        const onKeyUp = new DomEmitter(ownerDocument, "keyup");
        const listener = Event.any(this.hostService.onDidChangeFocus, onKeyUp.event)((keyupEvent) => {
          let standardKeyboardEvent2 = void 0;
          if (isKeyboardEvent(keyupEvent)) {
            standardKeyboardEvent2 = new StandardKeyboardEvent(keyupEvent);
          }
          if (!standardKeyboardEvent2 || standardKeyboardEvent2.keyCode === KeyCode.Alt) {
            this.altPressed = false;
            this.preventDefaultEditorHover();
            listener.dispose();
            onKeyUp.dispose();
          }
        });
      }
    });
  }
  async showHover(position, focus, mouseEvent) {
    this.preventDefaultEditorHover();
    const sf = this.debugService.getViewModel().focusedStackFrame;
    const model = this.editor.getModel();
    if (sf && model && this.uriIdentityService.extUri.isEqual(sf.source.uri, model.uri)) {
      const result = await this.hoverWidget.showAt(position, focus, mouseEvent);
      if (result === ShowDebugHoverResult.NOT_AVAILABLE) {
        this.showEditorHover(position, focus);
      }
    } else {
      this.showEditorHover(position, focus);
    }
  }
  preventDefaultEditorHover() {
    if (this.defaultHoverLockout.value || this.editorHoverOptions?.enabled === false) {
      return;
    }
    const hoverController = this.editor.getContribution(ContentHoverController.ID);
    hoverController?.hideContentHover();
    this.editor.updateOptions({ hover: { enabled: false } });
    this.defaultHoverLockout.value = {
      dispose: () => {
        this.editor.updateOptions({
          hover: { enabled: this.editorHoverOptions?.enabled ?? true }
        });
      }
    };
  }
  showEditorHover(position, focus) {
    const hoverController = this.editor.getContribution(ContentHoverController.ID);
    const range = new Range(position.lineNumber, position.column, position.lineNumber, position.column);
    this.defaultHoverLockout.clear();
    hoverController?.showContentHover(range, HoverStartMode.Immediate, HoverStartSource.Mouse, focus);
  }
  async onFocusStackFrame(sf) {
    const model = this.editor.getModel();
    if (model) {
      this.applyDocumentListeners(model, sf);
      if (sf && this.uriIdentityService.extUri.isEqual(sf.source.uri, model.uri)) {
        await this.toggleExceptionWidget();
      } else {
        this.hideHoverWidget();
      }
    }
    await this.updateInlineValueDecorations(sf);
  }
  get hoverDelay() {
    const baseDelay = this.editorHoverOptions?.delay || 0;
    const delayFactor = clamp(2 - (baseDelay - 300) / 600, 1, 2);
    return baseDelay * delayFactor;
  }
  get showHoverScheduler() {
    const scheduler = new RunOnceScheduler(() => {
      if (this.hoverPosition && !this.altPressed) {
        this.showHover(this.hoverPosition.position, false, this.hoverPosition.event);
      }
    }, this.hoverDelay);
    this.toDispose.push(scheduler);
    return scheduler;
  }
  hideHoverWidget() {
    if (this.hoverWidget.willBeVisible()) {
      this.hoverWidget.hide();
    }
    this.showHoverScheduler.cancel();
    this.defaultHoverLockout.clear();
  }
  // hover business
  onEditorMouseDown(mouseEvent) {
    this.mouseDown = true;
    if (mouseEvent.target.type === MouseTargetType.CONTENT_WIDGET && mouseEvent.target.detail === DebugHoverWidget.ID) {
      return;
    }
    this.hideHoverWidget();
  }
  onEditorMouseMove(mouseEvent) {
    if (this.debugService.state !== State.Stopped) {
      return;
    }
    const target = mouseEvent.target;
    const stopKey = env.isMacintosh ? "metaKey" : "ctrlKey";
    if (!this.altPressed) {
      if (target.type === MouseTargetType.GUTTER_GLYPH_MARGIN) {
        this.defaultHoverLockout.clear();
        this.gutterIsHovered = true;
      } else if (this.gutterIsHovered) {
        this.gutterIsHovered = false;
        this.updateHoverConfiguration();
      }
    }
    if (target.type === MouseTargetType.CONTENT_WIDGET && target.detail === DebugHoverWidget.ID || this.hoverWidget.isInSafeTriangle(mouseEvent.event.posx, mouseEvent.event.posy)) {
      const sticky = this.editorHoverOptions?.sticky ?? true;
      if (sticky || this.hoverWidget.isShowingComplexValue || mouseEvent.event[stopKey]) {
        return;
      }
    }
    if (target.type === MouseTargetType.CONTENT_TEXT) {
      if (target.position && !Position.equals(target.position, this.hoverPosition?.position || null) && !this.hoverWidget.isInSafeTriangle(mouseEvent.event.posx, mouseEvent.event.posy)) {
        this.hoverPosition = { position: target.position, event: mouseEvent.event };
        this.preventDefaultEditorHover();
        this.showHoverScheduler.schedule(this.hoverDelay);
      }
    } else if (!this.mouseDown) {
      this.hideHoverWidget();
    }
  }
  onKeyDown(e) {
    const stopKey = env.isMacintosh ? KeyCode.Meta : KeyCode.Ctrl;
    if (e.keyCode !== stopKey && e.keyCode !== KeyCode.Alt) {
      this.hideHoverWidget();
    }
  }
  // end hover business
  // exception widget
  async toggleExceptionWidget() {
    const model = this.editor.getModel();
    const focusedSf = this.debugService.getViewModel().focusedStackFrame;
    const callStack = focusedSf ? focusedSf.thread.getCallStack() : null;
    if (!model || !focusedSf || !callStack || callStack.length === 0) {
      this.closeExceptionWidget();
      return;
    }
    const exceptionSf = callStack.find((sf) => !!(sf && sf.source && sf.source.available && sf.source.presentationHint !== "deemphasize"));
    if (!exceptionSf || exceptionSf !== focusedSf) {
      this.closeExceptionWidget();
      return;
    }
    const sameUri = this.uriIdentityService.extUri.isEqual(exceptionSf.source.uri, model.uri);
    if (this.exceptionWidget && !sameUri) {
      this.closeExceptionWidget();
    } else if (sameUri) {
      const exceptionInfo = await focusedSf.thread.exceptionInfo;
      if (exceptionInfo) {
        this.showExceptionWidget(exceptionInfo, this.debugService.getViewModel().focusedSession, exceptionSf.range.startLineNumber, exceptionSf.range.startColumn);
      }
    }
  }
  showExceptionWidget(exceptionInfo, debugSession, lineNumber, column) {
    if (this.exceptionWidget) {
      this.exceptionWidget.dispose();
    }
    this.exceptionWidget = this.instantiationService.createInstance(ExceptionWidget, this.editor, exceptionInfo, debugSession);
    this.exceptionWidget.show({ lineNumber, column }, 0);
    this.exceptionWidget.focus();
    this.editor.revealRangeInCenter({
      startLineNumber: lineNumber,
      startColumn: column,
      endLineNumber: lineNumber,
      endColumn: column
    });
    this.exceptionWidgetVisible.set(true);
  }
  closeExceptionWidget() {
    if (this.exceptionWidget) {
      const shouldFocusEditor = this.exceptionWidget.hasFocus();
      this.exceptionWidget.dispose();
      this.exceptionWidget = void 0;
      this.exceptionWidgetVisible.set(false);
      if (shouldFocusEditor) {
        this.editor.focus();
      }
    }
  }
  async addLaunchConfiguration() {
    const model = this.editor.getModel();
    if (!model) {
      return;
    }
    let configurationsArrayPosition;
    let lastProperty;
    const getConfigurationPosition = () => {
      let depthInArray = 0;
      visit(model.getValue(), {
        onObjectProperty: (property) => {
          lastProperty = property;
        },
        onArrayBegin: (offset) => {
          if (lastProperty === "configurations" && depthInArray === 0) {
            configurationsArrayPosition = model.getPositionAt(offset + 1);
          }
          depthInArray++;
        },
        onArrayEnd: () => {
          depthInArray--;
        }
      });
    };
    getConfigurationPosition();
    if (!configurationsArrayPosition) {
      const { tabSize, insertSpaces } = model.getOptions();
      const eol = model.getEOL();
      const edit = basename(model.uri.fsPath) === "launch.json" ? setProperty(model.getValue(), ["configurations"], [], { tabSize, insertSpaces, eol })[0] : setProperty(model.getValue(), ["launch"], { "configurations": [] }, { tabSize, insertSpaces, eol })[0];
      const startPosition = model.getPositionAt(edit.offset);
      const lineNumber = startPosition.lineNumber;
      const range = new Range(lineNumber, startPosition.column, lineNumber, model.getLineMaxColumn(lineNumber));
      model.pushEditOperations(null, [EditOperation.replace(range, edit.content)], () => null);
      getConfigurationPosition();
    }
    if (!configurationsArrayPosition) {
      return;
    }
    this.editor.focus();
    const insertLine = (position) => {
      if (model.getLineLastNonWhitespaceColumn(position.lineNumber) > position.column) {
        this.editor.setPosition(position);
        CoreEditingCommands.LineBreakInsert.runEditorCommand(null, this.editor, null);
      }
      this.editor.setPosition(position);
      return this.commandService.executeCommand("editor.action.insertLineAfter");
    };
    await insertLine(configurationsArrayPosition);
    await this.commandService.executeCommand("editor.action.triggerSuggest");
  }
  get removeInlineValuesScheduler() {
    return new RunOnceScheduler(
      () => {
        this.displayedStore.clear();
        this.oldDecorations.clear();
      },
      100
    );
  }
  get updateInlineValuesScheduler() {
    const model = this.editor.getModel();
    return new RunOnceScheduler(
      async () => await this.updateInlineValueDecorations(this.debugService.getViewModel().focusedStackFrame),
      model ? this.debounceInfo.get(model) : DEAFULT_INLINE_DEBOUNCE_DELAY
    );
  }
  async updateInlineValueDecorations(stackFrame) {
    const var_value_format = "{0} = {1}";
    const separator = ", ";
    const model = this.editor.getModel();
    const inlineValuesSetting = this.configurationService.getValue("debug").inlineValues;
    const inlineValuesTurnedOn = inlineValuesSetting === true || inlineValuesSetting === "on" || inlineValuesSetting === "auto" && model && this.languageFeaturesService.inlineValuesProvider.has(model);
    if (!inlineValuesTurnedOn || !model || !stackFrame || model.uri.toString() !== stackFrame.source.uri.toString()) {
      if (!this.removeInlineValuesScheduler.isScheduled()) {
        this.removeInlineValuesScheduler.schedule();
      }
      return;
    }
    this.removeInlineValuesScheduler.cancel();
    this.displayedStore.clear();
    const viewRanges = this.editor.getVisibleRangesPlusViewportAboveBelow();
    let allDecorations;
    const cts = new CancellationTokenSource();
    this.displayedStore.add(toDisposable(() => cts.dispose(true)));
    if (this.languageFeaturesService.inlineValuesProvider.has(model)) {
      const findVariable = async (_key, caseSensitiveLookup) => {
        const scopes = await stackFrame.getMostSpecificScopes(stackFrame.range);
        const key = caseSensitiveLookup ? _key : _key.toLowerCase();
        for (const scope of scopes) {
          const variables = await scope.getChildren();
          const found = variables.find((v) => caseSensitiveLookup ? v.name === key : v.name.toLowerCase() === key);
          if (found) {
            return found.value;
          }
        }
        return void 0;
      };
      const ctx = {
        frameId: stackFrame.frameId,
        stoppedLocation: new Range(stackFrame.range.startLineNumber, stackFrame.range.startColumn + 1, stackFrame.range.endLineNumber, stackFrame.range.endColumn + 1)
      };
      const providers = this.languageFeaturesService.inlineValuesProvider.ordered(model).reverse();
      allDecorations = [];
      const lineDecorations = /* @__PURE__ */ new Map();
      const promises = providers.flatMap((provider) => viewRanges.map((range) => Promise.resolve(provider.provideInlineValues(model, range, ctx, cts.token)).then(async (result) => {
        if (result) {
          for (const iv of result) {
            let text = void 0;
            switch (iv.type) {
              case "text":
                text = iv.text;
                break;
              case "variable": {
                let va = iv.variableName;
                if (!va) {
                  const lineContent = model.getLineContent(iv.range.startLineNumber);
                  va = lineContent.substring(iv.range.startColumn - 1, iv.range.endColumn - 1);
                }
                const value = await findVariable(va, iv.caseSensitiveLookup);
                if (value) {
                  text = strings.format(var_value_format, va, value);
                }
                break;
              }
              case "expression": {
                let expr = iv.expression;
                if (!expr) {
                  const lineContent = model.getLineContent(iv.range.startLineNumber);
                  expr = lineContent.substring(iv.range.startColumn - 1, iv.range.endColumn - 1);
                }
                if (expr) {
                  const expression = new Expression(expr);
                  await expression.evaluate(stackFrame.thread.session, stackFrame, "watch", true);
                  if (expression.available) {
                    text = strings.format(var_value_format, expr, expression.value);
                  }
                }
                break;
              }
            }
            if (text) {
              const line = iv.range.startLineNumber;
              let lineSegments = lineDecorations.get(line);
              if (!lineSegments) {
                lineSegments = [];
                lineDecorations.set(line, lineSegments);
              }
              if (!lineSegments.some((iv2) => iv2.text === text)) {
                lineSegments.push(new InlineSegment(iv.range.startColumn, text));
              }
            }
          }
        }
      }, (err) => {
        onUnexpectedExternalError(err);
      })));
      const startTime = Date.now();
      await Promise.all(promises);
      this.updateInlineValuesScheduler.delay = this.debounceInfo.update(model, Date.now() - startTime);
      lineDecorations.forEach((segments, line) => {
        if (segments.length > 0) {
          segments = segments.sort((a, b) => a.column - b.column);
          const text = segments.map((s) => s.text).join(separator);
          const editorWidth = this.editor.getLayoutInfo().width;
          const fontInfo = this.editor.getOption(EditorOption.fontInfo);
          const viewportMaxCol = Math.floor((editorWidth - 50) / fontInfo.typicalHalfwidthCharacterWidth);
          allDecorations.push(...createInlineValueDecoration(line, text, "debug", void 0, viewportMaxCol));
        }
      });
    } else {
      const scopes = await stackFrame.getMostSpecificScopes(stackFrame.range);
      const scopesWithVariables = await Promise.all(scopes.map(async (scope) => ({ scope, variables: await scope.getChildren() })));
      const valuesPerLine = /* @__PURE__ */ new Map();
      for (const { scope, variables } of scopesWithVariables) {
        let scopeRange = new Range(0, 0, stackFrame.range.startLineNumber, stackFrame.range.startColumn);
        if (scope.range) {
          scopeRange = scopeRange.setStartPosition(scope.range.startLineNumber, scope.range.startColumn);
        }
        const ownRanges = viewRanges.map((r) => r.intersectRanges(scopeRange)).filter(isDefined);
        this._wordToLineNumbersMap ??= new WordsToLineNumbersCache(model);
        for (const range of ownRanges) {
          this._wordToLineNumbersMap.ensureRangePopulated(range);
        }
        const mapped = createInlineValueDecorationsInsideRange(variables, ownRanges, model, this._wordToLineNumbersMap.value);
        for (const { line, variables: variables2 } of mapped) {
          let values = valuesPerLine.get(line);
          if (!values) {
            values = /* @__PURE__ */ new Map();
            valuesPerLine.set(line, values);
          }
          for (const { name, value } of variables2) {
            if (!values.has(name)) {
              values.set(name, value);
            }
          }
        }
      }
      allDecorations = [...valuesPerLine.entries()].flatMap(([line, values]) => {
        const text = [...values].map(([n, v]) => `${n} = ${v}`).join(", ");
        const editorWidth = this.editor.getLayoutInfo().width;
        const fontInfo = this.editor.getOption(EditorOption.fontInfo);
        const viewportMaxCol = Math.floor((editorWidth - 50) / fontInfo.typicalHalfwidthCharacterWidth);
        return createInlineValueDecoration(line, text, "debug", void 0, viewportMaxCol);
      });
    }
    if (cts.token.isCancellationRequested) {
      return;
    }
    let preservePosition;
    if (this.editor.getOption(EditorOption.wordWrap) !== "off") {
      const position = this.editor.getPosition();
      if (position && this.editor.getVisibleRanges().some((r) => r.containsPosition(position))) {
        preservePosition = { position, top: this.editor.getTopForPosition(position.lineNumber, position.column) };
      }
    }
    this.oldDecorations.set(allDecorations);
    if (preservePosition) {
      const top = this.editor.getTopForPosition(preservePosition.position.lineNumber, preservePosition.position.column);
      this.editor.setScrollTop(this.editor.getScrollTop() - (preservePosition.top - top), ScrollType.Immediate);
    }
  }
  dispose() {
    if (this.hoverWidget) {
      this.hoverWidget.dispose();
    }
    if (this.configurationWidget) {
      this.configurationWidget.dispose();
    }
    this.toDispose = dispose(this.toDispose);
  }
};
__decorateClass([
  memoize
], DebugEditorContribution.prototype, "showHoverScheduler", 1);
__decorateClass([
  memoize
], DebugEditorContribution.prototype, "removeInlineValuesScheduler", 1);
__decorateClass([
  memoize
], DebugEditorContribution.prototype, "updateInlineValuesScheduler", 1);
DebugEditorContribution = __decorateClass([
  __decorateParam(1, IDebugService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IHostService),
  __decorateParam(6, IUriIdentityService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, ILanguageFeaturesService),
  __decorateParam(9, ILanguageFeatureDebounceService)
], DebugEditorContribution);
class WordsToLineNumbersCache {
  constructor(model) {
    this.model = model;
    this.value = /* @__PURE__ */ new Map();
    this.intervals = new Uint8Array(Math.ceil(model.getLineCount() / 8));
  }
  /** Ensures that variables names in the given range have been identified. */
  ensureRangePopulated(range) {
    for (let lineNumber = range.startLineNumber; lineNumber <= range.endLineNumber; lineNumber++) {
      const bin = lineNumber >> 3;
      const bit = 1 << (lineNumber & 7);
      if (!(this.intervals[bin] & bit)) {
        getWordToLineNumbersMap(this.model, lineNumber, this.value);
        this.intervals[bin] |= bit;
      }
    }
  }
}
CommandsRegistry.registerCommand(
  "_executeInlineValueProvider",
  async (accessor, uri, iRange, context) => {
    assertType(URI.isUri(uri));
    assertType(Range.isIRange(iRange));
    if (!context || typeof context.frameId !== "number" || !Range.isIRange(context.stoppedLocation)) {
      throw illegalArgument("context");
    }
    const model = accessor.get(IModelService).getModel(uri);
    if (!model) {
      throw illegalArgument("uri");
    }
    const range = Range.lift(iRange);
    const { inlineValuesProvider } = accessor.get(ILanguageFeaturesService);
    const providers = inlineValuesProvider.ordered(model);
    const providerResults = await Promise.all(providers.map((provider) => provider.provideInlineValues(model, range, context, CancellationToken.None)));
    return providerResults.flat().filter(isDefined);
  }
);
export {
  DebugEditorContribution,
  createInlineValueDecoration,
  debugInlineBackground,
  debugInlineForeground,
  formatHoverContent
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnRWRpdG9yQ29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgYWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBpc0tleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IERvbUVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZXZlbnQuanMnO1xuaW1wb3J0IHsgSUtleWJvYXJkRXZlbnQsIFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IElNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21vdXNlRXZlbnQuanMnO1xuaW1wb3J0IHsgUnVuT25jZVNjaGVkdWxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBtZW1vaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyBpbGxlZ2FsQXJndW1lbnQsIG9uVW5leHBlY3RlZEV4dGVybmFsRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyB2aXNpdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb24uanMnO1xuaW1wb3J0IHsgc2V0UHJvcGVydHkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uRWRpdC5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUsIGRpc3Bvc2UsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjbGFtcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL251bWJlcnMuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCAqIGFzIGVudiBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgKiBhcyBzdHJpbmdzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgYXNzZXJ0VHlwZSwgaXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgQ29uc3RhbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdWludC5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgQ29yZUVkaXRpbmdDb21tYW5kcyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2NvcmVDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciwgSUVkaXRvck1vdXNlRXZlbnQsIElQYXJ0aWFsRWRpdG9yTW91c2VFdmVudCwgTW91c2VUYXJnZXRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24sIElFZGl0b3JIb3Zlck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UsIFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IERFRkFVTFRfV09SRF9SRUdFWFAgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvd29yZEhlbHBlci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yRGVjb3JhdGlvbnNDb2xsZWN0aW9uLCBTY3JvbGxUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRUb2tlblR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VuY29kZWRUb2tlbkF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0IHsgSW5saW5lVmFsdWUsIElubGluZVZhbHVlQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElNb2RlbERlbHRhRGVjb3JhdGlvbiwgSVRleHRNb2RlbCwgSW5qZWN0ZWRUZXh0Q3Vyc29yU3RvcHMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElGZWF0dXJlRGVib3VuY2VJbmZvcm1hdGlvbiwgSUxhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IENvbnRlbnRIb3ZlckNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL2NvbnRlbnRIb3ZlckNvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgSG92ZXJTdGFydE1vZGUsIEhvdmVyU3RhcnRTb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL2hvdmVyT3BlcmF0aW9uLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSwgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckNvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBGbG9hdGluZ0VkaXRvckNsaWNrV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9jb2RlZWRpdG9yLmpzJztcbmltcG9ydCB7IERlYnVnSG92ZXJXaWRnZXQsIFNob3dEZWJ1Z0hvdmVyUmVzdWx0IH0gZnJvbSAnLi9kZWJ1Z0hvdmVyLmpzJztcbmltcG9ydCB7IEV4Y2VwdGlvbldpZGdldCB9IGZyb20gJy4vZXhjZXB0aW9uV2lkZ2V0LmpzJztcbmltcG9ydCB7IENPTlRFWFRfRVhDRVBUSU9OX1dJREdFVF9WSVNJQkxFLCBJRGVidWdDb25maWd1cmF0aW9uLCBJRGVidWdFZGl0b3JDb250cmlidXRpb24sIElEZWJ1Z1NlcnZpY2UsIElEZWJ1Z1Nlc3Npb24sIElFeGNlcHRpb25JbmZvLCBJRXhwcmVzc2lvbiwgSVN0YWNrRnJhbWUsIFN0YXRlIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnLmpzJztcbmltcG9ydCB7IEV4cHJlc3Npb24gfSBmcm9tICcuLi9jb21tb24vZGVidWdNb2RlbC5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcblxuY29uc3QgTUFYX05VTV9JTkxJTkVfVkFMVUVTID0gMTAwOyAvLyBKUyBHbG9iYWwgc2NvcGUgY2FuIGhhdmUgNzAwKyBlbnRyaWVzLiBXZSB3YW50IHRvIGxpbWl0IG91cnNlbHZlcyBmb3IgcGVyZiByZWFzb25zXG5jb25zdCBNQVhfSU5MSU5FX0RFQ09SQVRPUl9MRU5HVEggPSAxNTA7IC8vIE1heCBzdHJpbmcgbGVuZ3RoIG9mIGVhY2ggaW5saW5lIGRlY29yYXRvciB3aGVuIGRlYnVnZ2luZy4gSWYgZXhjZWVkZWQgLi4uIGlzIGFkZGVkXG5jb25zdCBNQVhfVE9LRU5JWkFUSU9OX0xJTkVfTEVOID0gNTAwOyAvLyBJZiBsaW5lIGlzIHRvbyBsb25nLCB0aGVuIGlubGluZSB2YWx1ZXMgZm9yIHRoZSBsaW5lIGFyZSBza2lwcGVkXG5cbmNvbnN0IERFQUZVTFRfSU5MSU5FX0RFQk9VTkNFX0RFTEFZID0gMjAwO1xuXG5leHBvcnQgY29uc3QgZGVidWdJbmxpbmVGb3JlZ3JvdW5kID0gcmVnaXN0ZXJDb2xvcignZWRpdG9yLmlubGluZVZhbHVlc0ZvcmVncm91bmQnLCB7XG5cdGRhcms6ICcjZmZmZmZmODAnLFxuXHRsaWdodDogJyMwMDAwMDA4MCcsXG5cdGhjRGFyazogJyNmZmZmZmY4MCcsXG5cdGhjTGlnaHQ6ICcjMDAwMDAwODAnXG59LCBubHMubG9jYWxpemUoJ2VkaXRvci5pbmxpbmVWYWx1ZXNGb3JlZ3JvdW5kJywgXCJDb2xvciBmb3IgdGhlIGRlYnVnIGlubGluZSB2YWx1ZSB0ZXh0LlwiKSk7XG5cbmV4cG9ydCBjb25zdCBkZWJ1Z0lubGluZUJhY2tncm91bmQgPSByZWdpc3RlckNvbG9yKCdlZGl0b3IuaW5saW5lVmFsdWVzQmFja2dyb3VuZCcsICcjZmZjODAwMzMnLCBubHMubG9jYWxpemUoJ2VkaXRvci5pbmxpbmVWYWx1ZXNCYWNrZ3JvdW5kJywgXCJDb2xvciBmb3IgdGhlIGRlYnVnIGlubGluZSB2YWx1ZSBiYWNrZ3JvdW5kLlwiKSk7XG5cbmNsYXNzIElubGluZVNlZ21lbnQge1xuXHRjb25zdHJ1Y3RvcihwdWJsaWMgY29sdW1uOiBudW1iZXIsIHB1YmxpYyB0ZXh0OiBzdHJpbmcpIHtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0SG92ZXJDb250ZW50KGNvbnRlbnRUZXh0OiBzdHJpbmcpOiBNYXJrZG93blN0cmluZyB7XG5cdGlmIChjb250ZW50VGV4dC5pbmNsdWRlcygnLCcpICYmIGNvbnRlbnRUZXh0LmluY2x1ZGVzKCc9JykpIHtcblx0XHQvLyBDdXN0b20gc3BsaXQ6IGZvciBlYWNoIGVxdWFscyBzaWduIGFmdGVyIHRoZSBmaXJzdCwgYmFja3RyYWNrIHRvIHRoZSBuZWFyZXN0IGNvbW1hXG5cdFx0Y29uc3QgY3VzdG9tU3BsaXQgPSAodGV4dDogc3RyaW5nKTogc3RyaW5nW10gPT4ge1xuXHRcdFx0Y29uc3Qgc3BsaXRzOiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0bGV0IGVxdWFsc0ZvdW5kID0gMDtcblx0XHRcdGxldCBzdGFydCA9IDA7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKHRleHRbaV0gPT09ICc9Jykge1xuXHRcdFx0XHRcdGlmIChlcXVhbHNGb3VuZCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0ZXF1YWxzRm91bmQrKztcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBjb21tYUluZGV4ID0gdGV4dC5sYXN0SW5kZXhPZignLCcsIGkpO1xuXHRcdFx0XHRcdGlmIChjb21tYUluZGV4ICE9PSAtMSAmJiBjb21tYUluZGV4ID49IHN0YXJ0KSB7XG5cdFx0XHRcdFx0XHRzcGxpdHMucHVzaChjb21tYUluZGV4KTtcblx0XHRcdFx0XHRcdHN0YXJ0ID0gY29tbWFJbmRleCArIDE7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVxdWFsc0ZvdW5kKys7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblx0XHRcdGxldCBzID0gMDtcblx0XHRcdGZvciAoY29uc3QgaW5kZXggb2Ygc3BsaXRzKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHRleHQuc3Vic3RyaW5nKHMsIGluZGV4KS50cmltKCkpO1xuXHRcdFx0XHRzID0gaW5kZXggKyAxO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHMgPCB0ZXh0Lmxlbmd0aCkge1xuXHRcdFx0XHRyZXN1bHQucHVzaCh0ZXh0LnN1YnN0cmluZyhzKS50cmltKCkpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9O1xuXG5cdFx0Y29uc3QgcGFpcnMgPSBjdXN0b21TcGxpdChjb250ZW50VGV4dCk7XG5cdFx0Y29uc3QgZm9ybWF0dGVkUGFpcnMgPSBwYWlycy5tYXAocGFpciA9PiB7XG5cdFx0XHRjb25zdCBlcXVhbHNJbmRleCA9IHBhaXIuaW5kZXhPZignPScpO1xuXHRcdFx0aWYgKGVxdWFsc0luZGV4ICE9PSAtMSkge1xuXHRcdFx0XHRjb25zdCBpbmRlbnQgPSAnICcucmVwZWF0KGVxdWFsc0luZGV4ICsgMik7XG5cdFx0XHRcdGNvbnN0IFtmaXJzdExpbmUsIC4uLnJlc3RMaW5lc10gPSBwYWlyLnNwbGl0KC9cXHI/XFxuLyk7XG5cdFx0XHRcdHJldHVybiBbZmlyc3RMaW5lLCAuLi5yZXN0TGluZXMubWFwKGxpbmUgPT4gaW5kZW50ICsgbGluZSldLmpvaW4oJ1xcbicpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHBhaXI7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIG5ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZENvZGVibG9jaygnJywgZm9ybWF0dGVkUGFpcnMuam9pbignLFxcbicpKTtcblx0fVxuXHRyZXR1cm4gbmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kQ29kZWJsb2NrKCcnLCBjb250ZW50VGV4dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJbmxpbmVWYWx1ZURlY29yYXRpb24obGluZU51bWJlcjogbnVtYmVyLCBjb250ZW50VGV4dDogc3RyaW5nLCBjbGFzc05hbWVQcmVmaXg6IHN0cmluZywgY29sdW1uID0gQ29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVIsIHZpZXdwb3J0TWF4Q29sOiBudW1iZXIgPSBNQVhfSU5MSU5FX0RFQ09SQVRPUl9MRU5HVEgpOiBJTW9kZWxEZWx0YURlY29yYXRpb25bXSB7XG5cdGNvbnN0IHJhd1RleHQgPSBjb250ZW50VGV4dDsgLy8gc3RvcmUgcmF3IHRleHQgZm9yIGhvdmVyIG1lc3NhZ2VcblxuXHQvLyBUcnVuY2F0ZSBjb250ZW50VGV4dCBpZiBpdCBleGNlZWRzIHRoZSB2aWV3cG9ydCBtYXggY29sdW1uXG5cdGlmIChjb250ZW50VGV4dC5sZW5ndGggPiB2aWV3cG9ydE1heENvbCkge1xuXHRcdGNvbnRlbnRUZXh0ID0gY29udGVudFRleHQuc3Vic3RyaW5nKDAsIHZpZXdwb3J0TWF4Q29sKSArICcuLi4nO1xuXHR9XG5cblx0cmV0dXJuIFtcblx0XHR7XG5cdFx0XHRyYW5nZToge1xuXHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IGxpbmVOdW1iZXIsXG5cdFx0XHRcdGVuZExpbmVOdW1iZXI6IGxpbmVOdW1iZXIsXG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiBjb2x1bW4sXG5cdFx0XHRcdGVuZENvbHVtbjogY29sdW1uXG5cdFx0XHR9LFxuXHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogYCR7Y2xhc3NOYW1lUHJlZml4fS1pbmxpbmUtdmFsdWUtZGVjb3JhdGlvbi1zcGFjZXJgLFxuXHRcdFx0XHRhZnRlcjoge1xuXHRcdFx0XHRcdGNvbnRlbnQ6IHN0cmluZ3Mubm9CcmVha1doaXRlc3BhY2UsXG5cdFx0XHRcdFx0Y3Vyc29yU3RvcHM6IEluamVjdGVkVGV4dEN1cnNvclN0b3BzLk5vbmVcblx0XHRcdFx0fSxcblx0XHRcdFx0c2hvd0lmQ29sbGFwc2VkOiB0cnVlLFxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0cmFuZ2U6IHtcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBsaW5lTnVtYmVyLFxuXHRcdFx0XHRlbmRMaW5lTnVtYmVyOiBsaW5lTnVtYmVyLFxuXHRcdFx0XHRzdGFydENvbHVtbjogY29sdW1uLFxuXHRcdFx0XHRlbmRDb2x1bW46IGNvbHVtblxuXHRcdFx0fSxcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IGAke2NsYXNzTmFtZVByZWZpeH0taW5saW5lLXZhbHVlLWRlY29yYXRpb25gLFxuXHRcdFx0XHRhZnRlcjoge1xuXHRcdFx0XHRcdGNvbnRlbnQ6IHJlcGxhY2VXc1dpdGhOb0JyZWFrV3MoY29udGVudFRleHQpLFxuXHRcdFx0XHRcdGlubGluZUNsYXNzTmFtZTogYCR7Y2xhc3NOYW1lUHJlZml4fS1pbmxpbmUtdmFsdWVgLFxuXHRcdFx0XHRcdGlubGluZUNsYXNzTmFtZUFmZmVjdHNMZXR0ZXJTcGFjaW5nOiB0cnVlLFxuXHRcdFx0XHRcdGN1cnNvclN0b3BzOiBJbmplY3RlZFRleHRDdXJzb3JTdG9wcy5Ob25lXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHNob3dJZkNvbGxhcHNlZDogdHJ1ZSxcblx0XHRcdFx0aG92ZXJNZXNzYWdlOiBmb3JtYXRIb3ZlckNvbnRlbnQocmF3VGV4dClcblx0XHRcdH1cblx0XHR9LFxuXHRdO1xufVxuXG5mdW5jdGlvbiByZXBsYWNlV3NXaXRoTm9CcmVha1dzKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIHN0ci5yZXBsYWNlKC9bIFxcdFxcbl0vZywgc3RyaW5ncy5ub0JyZWFrV2hpdGVzcGFjZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUlubGluZVZhbHVlRGVjb3JhdGlvbnNJbnNpZGVSYW5nZShleHByZXNzaW9uczogUmVhZG9ubHlBcnJheTxJRXhwcmVzc2lvbj4sIHJhbmdlczogUmFuZ2VbXSwgbW9kZWw6IElUZXh0TW9kZWwsIHdvcmRUb0xpbmVOdW1iZXJzTWFwOiBNYXA8c3RyaW5nLCBudW1iZXJbXT4pIHtcblx0Y29uc3QgbmFtZVZhbHVlTWFwID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0Zm9yIChjb25zdCBleHByIG9mIGV4cHJlc3Npb25zKSB7XG5cdFx0bmFtZVZhbHVlTWFwLnNldChleHByLm5hbWUsIGV4cHIudmFsdWUpO1xuXHRcdC8vIExpbWl0IHRoZSBzaXplIG9mIG1hcC4gVG9vIGxhcmdlIGNhbiBoYXZlIGEgcGVyZiBpbXBhY3Rcblx0XHRpZiAobmFtZVZhbHVlTWFwLnNpemUgPj0gTUFYX05VTV9JTkxJTkVfVkFMVUVTKSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdH1cblxuXHRjb25zdCBsaW5lVG9OYW1lc01hcDogTWFwPG51bWJlciwgc3RyaW5nW10+ID0gbmV3IE1hcDxudW1iZXIsIHN0cmluZ1tdPigpO1xuXG5cdC8vIENvbXB1dGUgdW5pcXVlIHNldCBvZiBuYW1lcyBvbiBlYWNoIGxpbmVcblx0bmFtZVZhbHVlTWFwLmZvckVhY2goKF92YWx1ZSwgbmFtZSkgPT4ge1xuXHRcdGNvbnN0IGxpbmVOdW1iZXJzID0gd29yZFRvTGluZU51bWJlcnNNYXAuZ2V0KG5hbWUpO1xuXHRcdGlmIChsaW5lTnVtYmVycykge1xuXHRcdFx0Zm9yIChjb25zdCBsaW5lTnVtYmVyIG9mIGxpbmVOdW1iZXJzKSB7XG5cdFx0XHRcdGlmIChyYW5nZXMuc29tZShyID0+IGxpbmVOdW1iZXIgPj0gci5zdGFydExpbmVOdW1iZXIgJiYgbGluZU51bWJlciA8PSByLmVuZExpbmVOdW1iZXIpKSB7XG5cdFx0XHRcdFx0aWYgKCFsaW5lVG9OYW1lc01hcC5oYXMobGluZU51bWJlcikpIHtcblx0XHRcdFx0XHRcdGxpbmVUb05hbWVzTWFwLnNldChsaW5lTnVtYmVyLCBbXSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGxpbmVUb05hbWVzTWFwLmdldChsaW5lTnVtYmVyKSEuaW5kZXhPZihuYW1lKSA9PT0gLTEpIHtcblx0XHRcdFx0XHRcdGxpbmVUb05hbWVzTWFwLmdldChsaW5lTnVtYmVyKSEucHVzaChuYW1lKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdC8vIENvbXB1dGUgZGVjb3JhdG9ycyBmb3IgZWFjaCBsaW5lXG5cdHJldHVybiBbLi4ubGluZVRvTmFtZXNNYXBdLm1hcCgoW2xpbmUsIG5hbWVzXSkgPT4gKHtcblx0XHRsaW5lLFxuXHRcdHZhcmlhYmxlczogbmFtZXMuc29ydCgoZmlyc3QsIHNlY29uZCkgPT4ge1xuXHRcdFx0Y29uc3QgY29udGVudCA9IG1vZGVsLmdldExpbmVDb250ZW50KGxpbmUpO1xuXHRcdFx0cmV0dXJuIGNvbnRlbnQuaW5kZXhPZihmaXJzdCkgLSBjb250ZW50LmluZGV4T2Yoc2Vjb25kKTtcblx0XHR9KS5tYXAobmFtZSA9PiAoeyBuYW1lLCB2YWx1ZTogbmFtZVZhbHVlTWFwLmdldChuYW1lKSEgfSkpXG5cdH0pKTtcbn1cblxuZnVuY3Rpb24gZ2V0V29yZFRvTGluZU51bWJlcnNNYXAobW9kZWw6IElUZXh0TW9kZWwsIGxpbmVOdW1iZXI6IG51bWJlciwgcmVzdWx0OiBNYXA8c3RyaW5nLCBudW1iZXJbXT4pIHtcblx0Y29uc3QgbGluZUxlbmd0aCA9IG1vZGVsLmdldExpbmVMZW5ndGgobGluZU51bWJlcik7XG5cdC8vIElmIGxpbmUgaXMgdG9vIGxvbmcgdGhlbiBza2lwIHRoZSBsaW5lXG5cdGlmIChsaW5lTGVuZ3RoID4gTUFYX1RPS0VOSVpBVElPTl9MSU5FX0xFTikge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IGxpbmVDb250ZW50ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZU51bWJlcik7XG5cdG1vZGVsLnRva2VuaXphdGlvbi5mb3JjZVRva2VuaXphdGlvbihsaW5lTnVtYmVyKTtcblx0Y29uc3QgbGluZVRva2VucyA9IG1vZGVsLnRva2VuaXphdGlvbi5nZXRMaW5lVG9rZW5zKGxpbmVOdW1iZXIpO1xuXHRmb3IgKGxldCB0b2tlbkluZGV4ID0gMCwgdG9rZW5Db3VudCA9IGxpbmVUb2tlbnMuZ2V0Q291bnQoKTsgdG9rZW5JbmRleCA8IHRva2VuQ291bnQ7IHRva2VuSW5kZXgrKykge1xuXHRcdGNvbnN0IHRva2VuVHlwZSA9IGxpbmVUb2tlbnMuZ2V0U3RhbmRhcmRUb2tlblR5cGUodG9rZW5JbmRleCk7XG5cblx0XHQvLyBUb2tlbiBpcyBhIHdvcmQgYW5kIG5vdCBhIGNvbW1lbnRcblx0XHRpZiAodG9rZW5UeXBlID09PSBTdGFuZGFyZFRva2VuVHlwZS5PdGhlcikge1xuXHRcdFx0REVGQVVMVF9XT1JEX1JFR0VYUC5sYXN0SW5kZXggPSAwOyAvLyBXZSBhc3N1bWUgdG9rZW5zIHdpbGwgdXN1YWxseSBtYXAgMToxIHRvIHdvcmRzIGlmIHRoZXkgbWF0Y2hcblxuXHRcdFx0Y29uc3QgdG9rZW5TdGFydE9mZnNldCA9IGxpbmVUb2tlbnMuZ2V0U3RhcnRPZmZzZXQodG9rZW5JbmRleCk7XG5cdFx0XHRjb25zdCB0b2tlbkVuZE9mZnNldCA9IGxpbmVUb2tlbnMuZ2V0RW5kT2Zmc2V0KHRva2VuSW5kZXgpO1xuXHRcdFx0Y29uc3QgdG9rZW5TdHIgPSBsaW5lQ29udGVudC5zdWJzdHJpbmcodG9rZW5TdGFydE9mZnNldCwgdG9rZW5FbmRPZmZzZXQpO1xuXHRcdFx0Y29uc3Qgd29yZE1hdGNoID0gREVGQVVMVF9XT1JEX1JFR0VYUC5leGVjKHRva2VuU3RyKTtcblxuXHRcdFx0aWYgKHdvcmRNYXRjaCkge1xuXG5cdFx0XHRcdGNvbnN0IHdvcmQgPSB3b3JkTWF0Y2hbMF07XG5cdFx0XHRcdGlmICghcmVzdWx0Lmhhcyh3b3JkKSkge1xuXHRcdFx0XHRcdHJlc3VsdC5zZXQod29yZCwgW10pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmVzdWx0LmdldCh3b3JkKSEucHVzaChsaW5lTnVtYmVyKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERlYnVnRWRpdG9yQ29udHJpYnV0aW9uIGltcGxlbWVudHMgSURlYnVnRWRpdG9yQ29udHJpYnV0aW9uIHtcblxuXHRwcml2YXRlIHRvRGlzcG9zZTogSURpc3Bvc2FibGVbXTtcblx0cHJpdmF0ZSBob3ZlcldpZGdldDogRGVidWdIb3ZlcldpZGdldDtcblx0cHJpdmF0ZSBob3ZlclBvc2l0aW9uPzogeyBwb3NpdGlvbjogUG9zaXRpb247IGV2ZW50OiBJTW91c2VFdmVudCB9O1xuXHRwcml2YXRlIG1vdXNlRG93biA9IGZhbHNlO1xuXHRwcml2YXRlIGV4Y2VwdGlvbldpZGdldFZpc2libGU6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGd1dHRlcklzSG92ZXJlZCA9IGZhbHNlO1xuXG5cdHByaXZhdGUgZXhjZXB0aW9uV2lkZ2V0OiBFeGNlcHRpb25XaWRnZXQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgY29uZmlndXJhdGlvbldpZGdldDogRmxvYXRpbmdFZGl0b3JDbGlja1dpZGdldCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBhbHRMaXN0ZW5lciA9IG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpO1xuXHRwcml2YXRlIGFsdFByZXNzZWQgPSBmYWxzZTtcblx0cHJpdmF0ZSBvbGREZWNvcmF0aW9uczogSUVkaXRvckRlY29yYXRpb25zQ29sbGVjdGlvbjtcblx0cHJpdmF0ZSByZWFkb25seSBkaXNwbGF5ZWRTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSBlZGl0b3JIb3Zlck9wdGlvbnM6IElFZGl0b3JIb3Zlck9wdGlvbnMgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGVib3VuY2VJbmZvOiBJRmVhdHVyZURlYm91bmNlSW5mb3JtYXRpb247XG5cblx0Ly8gSG9sZHMgYSBEaXNwb3NhYmxlIHRoYXQgcHJldmVudHMgdGhlIGRlZmF1bHQgZWRpdG9yIGhvdmVyIGJlaGF2aW9yIHdoaWxlIGl0IGV4aXN0cy5cblx0cHJpdmF0ZSByZWFkb25seSBkZWZhdWx0SG92ZXJMb2Nrb3V0ID0gbmV3IE11dGFibGVEaXNwb3NhYmxlKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJRGVidWdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0XHRASUxhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZSBmZWF0dXJlRGVib3VuY2VTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMub2xkRGVjb3JhdGlvbnMgPSB0aGlzLmVkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oKTtcblx0XHR0aGlzLmRlYm91bmNlSW5mbyA9IGZlYXR1cmVEZWJvdW5jZVNlcnZpY2UuZm9yKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmlubGluZVZhbHVlc1Byb3ZpZGVyLCAnSW5saW5lVmFsdWVzJywgeyBtaW46IERFQUZVTFRfSU5MSU5FX0RFQk9VTkNFX0RFTEFZIH0pO1xuXHRcdHRoaXMuaG92ZXJXaWRnZXQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERlYnVnSG92ZXJXaWRnZXQsIHRoaXMuZWRpdG9yKTtcblx0XHR0aGlzLnRvRGlzcG9zZSA9IFt0aGlzLmRlZmF1bHRIb3ZlckxvY2tvdXQsIHRoaXMuYWx0TGlzdGVuZXIsIHRoaXMuZGlzcGxheWVkU3RvcmVdO1xuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0XHR0aGlzLmV4Y2VwdGlvbldpZGdldFZpc2libGUgPSBDT05URVhUX0VYQ0VQVElPTl9XSURHRVRfVklTSUJMRS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMudG9nZ2xlRXhjZXB0aW9uV2lkZ2V0KCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkub25EaWRGb2N1c1N0YWNrRnJhbWUoZSA9PiB0aGlzLm9uRm9jdXNTdGFja0ZyYW1lKGUuc3RhY2tGcmFtZSkpKTtcblxuXHRcdC8vIGhvdmVyIGxpc3RlbmVycyAmIGhvdmVyIHdpZGdldFxuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5lZGl0b3Iub25Nb3VzZURvd24oKGU6IElFZGl0b3JNb3VzZUV2ZW50KSA9PiB0aGlzLm9uRWRpdG9yTW91c2VEb3duKGUpKSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmVkaXRvci5vbk1vdXNlVXAoKCkgPT4gdGhpcy5tb3VzZURvd24gPSBmYWxzZSkpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5lZGl0b3Iub25Nb3VzZU1vdmUoKGU6IElFZGl0b3JNb3VzZUV2ZW50KSA9PiB0aGlzLm9uRWRpdG9yTW91c2VNb3ZlKGUpKSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmVkaXRvci5vbk1vdXNlTGVhdmUoKGU6IElQYXJ0aWFsRWRpdG9yTW91c2VFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgaG92ZXJEb21Ob2RlID0gdGhpcy5ob3ZlcldpZGdldC5nZXREb21Ob2RlKCk7XG5cdFx0XHRpZiAoIWhvdmVyRG9tTm9kZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlY3QgPSBob3ZlckRvbU5vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHQvLyBPbmx5IGhpZGUgdGhlIGhvdmVyIHdpZGdldCBpZiB0aGUgZWRpdG9yIG1vdXNlIGxlYXZlIGV2ZW50IGlzIG91dHNpZGUgdGhlIGhvdmVyIHdpZGdldCAjMzUyOFxuXHRcdFx0aWYgKGUuZXZlbnQucG9zeCA8IHJlY3QubGVmdCB8fCBlLmV2ZW50LnBvc3ggPiByZWN0LnJpZ2h0IHx8IGUuZXZlbnQucG9zeSA8IHJlY3QudG9wIHx8IGUuZXZlbnQucG9zeSA+IHJlY3QuYm90dG9tKSB7XG5cdFx0XHRcdHRoaXMuaGlkZUhvdmVyV2lkZ2V0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5lZGl0b3Iub25LZXlEb3duKChlOiBJS2V5Ym9hcmRFdmVudCkgPT4gdGhpcy5vbktleURvd24oZSkpKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KCgpID0+IHtcblx0XHRcdHRoaXMuX3dvcmRUb0xpbmVOdW1iZXJzTWFwID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy51cGRhdGVJbmxpbmVWYWx1ZXNTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5vbldpbGxVcGRhdGVWaWV3cygoKSA9PiB0aGlzLnVwZGF0ZUlubGluZVZhbHVlc1NjaGVkdWxlci5zY2hlZHVsZSgpKSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5vbkRpZEV2YWx1YXRlTGF6eUV4cHJlc3Npb24oKCkgPT4gdGhpcy51cGRhdGVJbmxpbmVWYWx1ZXNTY2hlZHVsZXIuc2NoZWR1bGUoKSkpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbChhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLmFkZERvY3VtZW50TGlzdGVuZXJzKCk7XG5cdFx0XHR0aGlzLnRvZ2dsZUV4Y2VwdGlvbldpZGdldCgpO1xuXHRcdFx0dGhpcy5oaWRlSG92ZXJXaWRnZXQoKTtcblx0XHRcdHRoaXMuX3dvcmRUb0xpbmVOdW1iZXJzTWFwID0gdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3Qgc3RhY2tGcmFtZSA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTdGFja0ZyYW1lO1xuXHRcdFx0YXdhaXQgdGhpcy51cGRhdGVJbmxpbmVWYWx1ZURlY29yYXRpb25zKHN0YWNrRnJhbWUpO1xuXHRcdH0pKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuZWRpdG9yLm9uRGlkU2Nyb2xsQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMuaGlkZUhvdmVyV2lkZ2V0KCk7XG5cblx0XHRcdC8vIElubGluZSB2YWx1ZSBwcm92aWRlciBzaG91bGQgZ2V0IGNhbGxlZCBvbiB2aWV3IHBvcnQgY2hhbmdlXG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHRpZiAobW9kZWwgJiYgdGhpcy5sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5pbmxpbmVWYWx1ZXNQcm92aWRlci5oYXMobW9kZWwpKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlSW5saW5lVmFsdWVzU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oKGUpID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3IuaG92ZXInKSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUhvdmVyQ29uZmlndXJhdGlvbigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuZGVidWdTZXJ2aWNlLm9uRGlkQ2hhbmdlU3RhdGUoKHN0YXRlOiBTdGF0ZSkgPT4ge1xuXHRcdFx0aWYgKHN0YXRlICE9PSBTdGF0ZS5TdG9wcGVkKSB7XG5cdFx0XHRcdHRoaXMudG9nZ2xlRXhjZXB0aW9uV2lkZ2V0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy51cGRhdGVIb3ZlckNvbmZpZ3VyYXRpb24oKTtcblx0fVxuXG5cdHByaXZhdGUgX3dvcmRUb0xpbmVOdW1iZXJzTWFwOiBXb3Jkc1RvTGluZU51bWJlcnNDYWNoZSB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHVwZGF0ZUhvdmVyQ29uZmlndXJhdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHR0aGlzLmVkaXRvckhvdmVyT3B0aW9ucyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SUVkaXRvckhvdmVyT3B0aW9ucz4oJ2VkaXRvci5ob3ZlcicsIHtcblx0XHRcdFx0cmVzb3VyY2U6IG1vZGVsLnVyaSxcblx0XHRcdFx0b3ZlcnJpZGVJZGVudGlmaWVyOiBtb2RlbC5nZXRMYW5ndWFnZUlkKClcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYWRkRG9jdW1lbnRMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RhY2tGcmFtZSA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTdGFja0ZyYW1lO1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAobW9kZWwpIHtcblx0XHRcdHRoaXMuYXBwbHlEb2N1bWVudExpc3RlbmVycyhtb2RlbCwgc3RhY2tGcmFtZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhcHBseURvY3VtZW50TGlzdGVuZXJzKG1vZGVsOiBJVGV4dE1vZGVsLCBzdGFja0ZyYW1lOiBJU3RhY2tGcmFtZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmICghc3RhY2tGcmFtZSB8fCAhdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwobW9kZWwudXJpLCBzdGFja0ZyYW1lLnNvdXJjZS51cmkpKSB7XG5cdFx0XHR0aGlzLmFsdExpc3RlbmVyLmNsZWFyKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3duZXJEb2N1bWVudCA9IHRoaXMuZWRpdG9yLmdldENvbnRhaW5lckRvbU5vZGUoKS5vd25lckRvY3VtZW50O1xuXG5cdFx0Ly8gV2hlbiB0aGUgYWx0IGtleSBpcyBwcmVzc2VkIHNob3cgcmVndWxhciBlZGl0b3IgaG92ZXIgYW5kIGhpZGUgdGhlIGRlYnVnIGhvdmVyICM4NDU2MVxuXHRcdHRoaXMuYWx0TGlzdGVuZXIudmFsdWUgPSBhZGREaXNwb3NhYmxlTGlzdGVuZXIob3duZXJEb2N1bWVudCwgJ2tleWRvd24nLCBrZXlkb3duRXZlbnQgPT4ge1xuXHRcdFx0Y29uc3Qgc3RhbmRhcmRLZXlib2FyZEV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChrZXlkb3duRXZlbnQpO1xuXHRcdFx0aWYgKHN0YW5kYXJkS2V5Ym9hcmRFdmVudC5rZXlDb2RlID09PSBLZXlDb2RlLkFsdCkge1xuXHRcdFx0XHR0aGlzLmFsdFByZXNzZWQgPSB0cnVlO1xuXHRcdFx0XHRjb25zdCBkZWJ1Z0hvdmVyV2FzVmlzaWJsZSA9IHRoaXMuaG92ZXJXaWRnZXQuaXNWaXNpYmxlKCk7XG5cdFx0XHRcdHRoaXMuaG92ZXJXaWRnZXQuaGlkZSgpO1xuXHRcdFx0XHR0aGlzLmRlZmF1bHRIb3ZlckxvY2tvdXQuY2xlYXIoKTtcblxuXHRcdFx0XHRpZiAoZGVidWdIb3Zlcldhc1Zpc2libGUgJiYgdGhpcy5ob3ZlclBvc2l0aW9uKSB7XG5cdFx0XHRcdFx0Ly8gSWYgdGhlIGRlYnVnIGhvdmVyIHdhcyB2aXNpYmxlIGltbWVkaWF0ZWx5IHNob3cgdGhlIGVkaXRvciBob3ZlciBmb3IgdGhlIGFsdCB0cmFuc2l0aW9uIHRvIGJlIHNtb290aFxuXHRcdFx0XHRcdHRoaXMuc2hvd0VkaXRvckhvdmVyKHRoaXMuaG92ZXJQb3NpdGlvbi5wb3NpdGlvbiwgZmFsc2UpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgb25LZXlVcCA9IG5ldyBEb21FbWl0dGVyKG93bmVyRG9jdW1lbnQsICdrZXl1cCcpO1xuXHRcdFx0XHRjb25zdCBsaXN0ZW5lciA9IEV2ZW50LmFueTxLZXlib2FyZEV2ZW50IHwgYm9vbGVhbj4odGhpcy5ob3N0U2VydmljZS5vbkRpZENoYW5nZUZvY3VzLCBvbktleVVwLmV2ZW50KShrZXl1cEV2ZW50ID0+IHtcblx0XHRcdFx0XHRsZXQgc3RhbmRhcmRLZXlib2FyZEV2ZW50ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGlmIChpc0tleWJvYXJkRXZlbnQoa2V5dXBFdmVudCkpIHtcblx0XHRcdFx0XHRcdHN0YW5kYXJkS2V5Ym9hcmRFdmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoa2V5dXBFdmVudCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICghc3RhbmRhcmRLZXlib2FyZEV2ZW50IHx8IHN0YW5kYXJkS2V5Ym9hcmRFdmVudC5rZXlDb2RlID09PSBLZXlDb2RlLkFsdCkge1xuXHRcdFx0XHRcdFx0dGhpcy5hbHRQcmVzc2VkID0gZmFsc2U7XG5cdFx0XHRcdFx0XHR0aGlzLnByZXZlbnREZWZhdWx0RWRpdG9ySG92ZXIoKTtcblx0XHRcdFx0XHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdG9uS2V5VXAuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBzaG93SG92ZXIocG9zaXRpb246IFBvc2l0aW9uLCBmb2N1czogYm9vbGVhbiwgbW91c2VFdmVudD86IElNb3VzZUV2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gbm9ybWFsbHkgd2lsbCBhbHJlYWR5IGJlIHNldCBpbiBgc2hvd0hvdmVyU2NoZWR1bGVyYCwgYnV0IHB1YmxpYyBjYWxsZXJzIG1heSBoaXQgdGhpcyBkaXJlY3RseTpcblx0XHR0aGlzLnByZXZlbnREZWZhdWx0RWRpdG9ySG92ZXIoKTtcblxuXHRcdGNvbnN0IHNmID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFN0YWNrRnJhbWU7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmIChzZiAmJiBtb2RlbCAmJiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChzZi5zb3VyY2UudXJpLCBtb2RlbC51cmkpKSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmhvdmVyV2lkZ2V0LnNob3dBdChwb3NpdGlvbiwgZm9jdXMsIG1vdXNlRXZlbnQpO1xuXHRcdFx0aWYgKHJlc3VsdCA9PT0gU2hvd0RlYnVnSG92ZXJSZXN1bHQuTk9UX0FWQUlMQUJMRSkge1xuXHRcdFx0XHQvLyBXaGVuIG5vIGV4cHJlc3Npb24gYXZhaWxhYmxlIGZhbGxiYWNrIHRvIGVkaXRvciBob3ZlclxuXHRcdFx0XHR0aGlzLnNob3dFZGl0b3JIb3Zlcihwb3NpdGlvbiwgZm9jdXMpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNob3dFZGl0b3JIb3Zlcihwb3NpdGlvbiwgZm9jdXMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcHJldmVudERlZmF1bHRFZGl0b3JIb3ZlcigpIHtcblx0XHRpZiAodGhpcy5kZWZhdWx0SG92ZXJMb2Nrb3V0LnZhbHVlIHx8IHRoaXMuZWRpdG9ySG92ZXJPcHRpb25zPy5lbmFibGVkID09PSBmYWxzZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhvdmVyQ29udHJvbGxlciA9IHRoaXMuZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxDb250ZW50SG92ZXJDb250cm9sbGVyPihDb250ZW50SG92ZXJDb250cm9sbGVyLklEKTtcblx0XHRob3ZlckNvbnRyb2xsZXI/LmhpZGVDb250ZW50SG92ZXIoKTtcblxuXHRcdHRoaXMuZWRpdG9yLnVwZGF0ZU9wdGlvbnMoeyBob3ZlcjogeyBlbmFibGVkOiBmYWxzZSB9IH0pO1xuXHRcdHRoaXMuZGVmYXVsdEhvdmVyTG9ja291dC52YWx1ZSA9IHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5lZGl0b3IudXBkYXRlT3B0aW9ucyh7XG5cdFx0XHRcdFx0aG92ZXI6IHsgZW5hYmxlZDogdGhpcy5lZGl0b3JIb3Zlck9wdGlvbnM/LmVuYWJsZWQgPz8gdHJ1ZSB9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHNob3dFZGl0b3JIb3Zlcihwb3NpdGlvbjogUG9zaXRpb24sIGZvY3VzOiBib29sZWFuKSB7XG5cdFx0Y29uc3QgaG92ZXJDb250cm9sbGVyID0gdGhpcy5lZGl0b3IuZ2V0Q29udHJpYnV0aW9uPENvbnRlbnRIb3ZlckNvbnRyb2xsZXI+KENvbnRlbnRIb3ZlckNvbnRyb2xsZXIuSUQpO1xuXHRcdGNvbnN0IHJhbmdlID0gbmV3IFJhbmdlKHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uKTtcblx0XHQvLyBlbmFibGUgdGhlIGVkaXRvciBob3Zlciwgb3RoZXJ3aXNlIHRoZSBjb250ZW50IGNvbnRyb2xsZXIgd2lsbCBzZWUgaXRcblx0XHQvLyBhcyBkaXNhYmxlZCBhbmQgaGlkZSBpdCBvbiB0aGUgZmlyc3QgbW91c2UgbW92ZSAoIzE5MzE0OSlcblx0XHR0aGlzLmRlZmF1bHRIb3ZlckxvY2tvdXQuY2xlYXIoKTtcblx0XHRob3ZlckNvbnRyb2xsZXI/LnNob3dDb250ZW50SG92ZXIocmFuZ2UsIEhvdmVyU3RhcnRNb2RlLkltbWVkaWF0ZSwgSG92ZXJTdGFydFNvdXJjZS5Nb3VzZSwgZm9jdXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvbkZvY3VzU3RhY2tGcmFtZShzZjogSVN0YWNrRnJhbWUgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHR0aGlzLmFwcGx5RG9jdW1lbnRMaXN0ZW5lcnMobW9kZWwsIHNmKTtcblx0XHRcdGlmIChzZiAmJiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChzZi5zb3VyY2UudXJpLCBtb2RlbC51cmkpKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMudG9nZ2xlRXhjZXB0aW9uV2lkZ2V0KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmhpZGVIb3ZlcldpZGdldCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMudXBkYXRlSW5saW5lVmFsdWVEZWNvcmF0aW9ucyhzZik7XG5cdH1cblxuXHRwcml2YXRlIGdldCBob3ZlckRlbGF5KCkge1xuXHRcdGNvbnN0IGJhc2VEZWxheSA9IHRoaXMuZWRpdG9ySG92ZXJPcHRpb25zPy5kZWxheSB8fCAwO1xuXG5cdFx0Ly8gaGV1cmlzdGljIHRvIGdldCBhICdnb29kJyBidXQgY29uZmlndXJhYmxlIGRlbGF5IGZvciBldmFsdWF0aW9uLiBUaGVcblx0XHQvLyBkZWJ1ZyBob3ZlciBjYW4gYmUgdmVyeSBsYXJnZSwgc28gd2UgdGVuZCB0byBiZSBtb3JlIGNvbnNlcnZhdGl2ZSBhYm91dFxuXHRcdC8vIHdoZW4gdG8gc2hvdyBpdCAoIzE4MDYyMSkuIFdpdGggdGhpcyBlcXVhdGlvbjpcblx0XHQvLyAtIGRlZmF1bHQgMzAwbXMgaG92ZXIgPT4gKiAyICAgPSA2MDBtc1xuXHRcdC8vIC0gc2hvcnQgICAxMDBtcyBob3ZlciA9PiAqIDIgICA9IDIwMG1zXG5cdFx0Ly8gLSBsb25nZXIgIDYwMG1zIGhvdmVyID0+ICogMS41ID0gOTAwbXNcblx0XHQvLyAtIGxvbmcgICAxMDAwbXMgaG92ZXIgPT4gKiAxLjAgPSAxMDAwbXNcblx0XHRjb25zdCBkZWxheUZhY3RvciA9IGNsYW1wKDIgLSAoYmFzZURlbGF5IC0gMzAwKSAvIDYwMCwgMSwgMik7XG5cblx0XHRyZXR1cm4gYmFzZURlbGF5ICogZGVsYXlGYWN0b3I7XG5cdH1cblxuXHRAbWVtb2l6ZVxuXHRwcml2YXRlIGdldCBzaG93SG92ZXJTY2hlZHVsZXIoKSB7XG5cdFx0Y29uc3Qgc2NoZWR1bGVyID0gbmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuaG92ZXJQb3NpdGlvbiAmJiAhdGhpcy5hbHRQcmVzc2VkKSB7XG5cdFx0XHRcdHRoaXMuc2hvd0hvdmVyKHRoaXMuaG92ZXJQb3NpdGlvbi5wb3NpdGlvbiwgZmFsc2UsIHRoaXMuaG92ZXJQb3NpdGlvbi5ldmVudCk7XG5cdFx0XHR9XG5cdFx0fSwgdGhpcy5ob3ZlckRlbGF5KTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHNjaGVkdWxlcik7XG5cblx0XHRyZXR1cm4gc2NoZWR1bGVyO1xuXHR9XG5cblx0cHJpdmF0ZSBoaWRlSG92ZXJXaWRnZXQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaG92ZXJXaWRnZXQud2lsbEJlVmlzaWJsZSgpKSB7XG5cdFx0XHR0aGlzLmhvdmVyV2lkZ2V0LmhpZGUoKTtcblx0XHR9XG5cdFx0dGhpcy5zaG93SG92ZXJTY2hlZHVsZXIuY2FuY2VsKCk7XG5cdFx0dGhpcy5kZWZhdWx0SG92ZXJMb2Nrb3V0LmNsZWFyKCk7XG5cdH1cblxuXHQvLyBob3ZlciBidXNpbmVzc1xuXG5cdHByaXZhdGUgb25FZGl0b3JNb3VzZURvd24obW91c2VFdmVudDogSUVkaXRvck1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLm1vdXNlRG93biA9IHRydWU7XG5cdFx0aWYgKG1vdXNlRXZlbnQudGFyZ2V0LnR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5DT05URU5UX1dJREdFVCAmJiBtb3VzZUV2ZW50LnRhcmdldC5kZXRhaWwgPT09IERlYnVnSG92ZXJXaWRnZXQuSUQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmhpZGVIb3ZlcldpZGdldCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkVkaXRvck1vdXNlTW92ZShtb3VzZUV2ZW50OiBJRWRpdG9yTW91c2VFdmVudCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmRlYnVnU2VydmljZS5zdGF0ZSAhPT0gU3RhdGUuU3RvcHBlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRhcmdldCA9IG1vdXNlRXZlbnQudGFyZ2V0O1xuXHRcdGNvbnN0IHN0b3BLZXkgPSBlbnYuaXNNYWNpbnRvc2ggPyAnbWV0YUtleScgOiAnY3RybEtleSc7XG5cblx0XHRpZiAoIXRoaXMuYWx0UHJlc3NlZCkge1xuXHRcdFx0aWYgKHRhcmdldC50eXBlID09PSBNb3VzZVRhcmdldFR5cGUuR1VUVEVSX0dMWVBIX01BUkdJTikge1xuXHRcdFx0XHR0aGlzLmRlZmF1bHRIb3ZlckxvY2tvdXQuY2xlYXIoKTtcblx0XHRcdFx0dGhpcy5ndXR0ZXJJc0hvdmVyZWQgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLmd1dHRlcklzSG92ZXJlZCkge1xuXHRcdFx0XHR0aGlzLmd1dHRlcklzSG92ZXJlZCA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUhvdmVyQ29uZmlndXJhdGlvbigpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdCh0YXJnZXQudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfV0lER0VUICYmIHRhcmdldC5kZXRhaWwgPT09IERlYnVnSG92ZXJXaWRnZXQuSUQpXG5cdFx0XHR8fCB0aGlzLmhvdmVyV2lkZ2V0LmlzSW5TYWZlVHJpYW5nbGUobW91c2VFdmVudC5ldmVudC5wb3N4LCBtb3VzZUV2ZW50LmV2ZW50LnBvc3kpXG5cdFx0KSB7XG5cdFx0XHQvLyBtb3VzZSBtb3ZlZCBvbiB0b3Agb2YgZGVidWcgaG92ZXIgd2lkZ2V0XG5cblx0XHRcdGNvbnN0IHN0aWNreSA9IHRoaXMuZWRpdG9ySG92ZXJPcHRpb25zPy5zdGlja3kgPz8gdHJ1ZTtcblx0XHRcdGlmIChzdGlja3kgfHwgdGhpcy5ob3ZlcldpZGdldC5pc1Nob3dpbmdDb21wbGV4VmFsdWUgfHwgbW91c2VFdmVudC5ldmVudFtzdG9wS2V5XSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRhcmdldC50eXBlID09PSBNb3VzZVRhcmdldFR5cGUuQ09OVEVOVF9URVhUKSB7XG5cdFx0XHRpZiAodGFyZ2V0LnBvc2l0aW9uICYmICFQb3NpdGlvbi5lcXVhbHModGFyZ2V0LnBvc2l0aW9uLCB0aGlzLmhvdmVyUG9zaXRpb24/LnBvc2l0aW9uIHx8IG51bGwpICYmICF0aGlzLmhvdmVyV2lkZ2V0LmlzSW5TYWZlVHJpYW5nbGUobW91c2VFdmVudC5ldmVudC5wb3N4LCBtb3VzZUV2ZW50LmV2ZW50LnBvc3kpKSB7XG5cdFx0XHRcdHRoaXMuaG92ZXJQb3NpdGlvbiA9IHsgcG9zaXRpb246IHRhcmdldC5wb3NpdGlvbiwgZXZlbnQ6IG1vdXNlRXZlbnQuZXZlbnQgfTtcblx0XHRcdFx0Ly8gRGlzYWJsZSB0aGUgZWRpdG9yIGhvdmVyIGR1cmluZyB0aGUgcmVxdWVzdCB0byBhdm9pZCBmbGlja2VyaW5nXG5cdFx0XHRcdHRoaXMucHJldmVudERlZmF1bHRFZGl0b3JIb3ZlcigpO1xuXHRcdFx0XHR0aGlzLnNob3dIb3ZlclNjaGVkdWxlci5zY2hlZHVsZSh0aGlzLmhvdmVyRGVsYXkpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoIXRoaXMubW91c2VEb3duKSB7XG5cdFx0XHQvLyBEbyBub3QgaGlkZSBkZWJ1ZyBob3ZlciB3aGVuIHRoZSBtb3VzZSBpcyBwcmVzc2VkIGJlY2F1c2UgaXQgdXN1YWxseSBsZWFkcyB0byBhY2NpZGVudGFsIGNsb3NpbmcgIzY0NjIwXG5cdFx0XHR0aGlzLmhpZGVIb3ZlcldpZGdldCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25LZXlEb3duKGU6IElLZXlib2FyZEV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RvcEtleSA9IGVudi5pc01hY2ludG9zaCA/IEtleUNvZGUuTWV0YSA6IEtleUNvZGUuQ3RybDtcblx0XHRpZiAoZS5rZXlDb2RlICE9PSBzdG9wS2V5ICYmIGUua2V5Q29kZSAhPT0gS2V5Q29kZS5BbHQpIHtcblx0XHRcdC8vIGRvIG5vdCBoaWRlIGhvdmVyIHdoZW4gQ3RybC9NZXRhIGlzIHByZXNzZWQsIGFuZCBhbHQgaXMgaGFuZGxlZCBzZXBhcmF0ZWx5XG5cdFx0XHR0aGlzLmhpZGVIb3ZlcldpZGdldCgpO1xuXHRcdH1cblx0fVxuXHQvLyBlbmQgaG92ZXIgYnVzaW5lc3NcblxuXHQvLyBleGNlcHRpb24gd2lkZ2V0XG5cdHByaXZhdGUgYXN5bmMgdG9nZ2xlRXhjZXB0aW9uV2lkZ2V0KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIFRvZ2dsZXMgZXhjZXB0aW9uIHdpZGdldCBiYXNlZCBvbiB0aGUgc3RhdGUgb2YgdGhlIGN1cnJlbnQgZWRpdG9yIG1vZGVsIGFuZCBkZWJ1ZyBzdGFjayBmcmFtZVxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRjb25zdCBmb2N1c2VkU2YgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU3RhY2tGcmFtZTtcblx0XHRjb25zdCBjYWxsU3RhY2sgPSBmb2N1c2VkU2YgPyBmb2N1c2VkU2YudGhyZWFkLmdldENhbGxTdGFjaygpIDogbnVsbDtcblx0XHRpZiAoIW1vZGVsIHx8ICFmb2N1c2VkU2YgfHwgIWNhbGxTdGFjayB8fCBjYWxsU3RhY2subGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLmNsb3NlRXhjZXB0aW9uV2lkZ2V0KCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gRmlyc3QgY2FsbCBzdGFjayBmcmFtZSB0aGF0IGlzIGF2YWlsYWJsZSBpcyB0aGUgZnJhbWUgd2hlcmUgZXhjZXB0aW9uIGhhcyBiZWVuIHRocm93blxuXHRcdGNvbnN0IGV4Y2VwdGlvblNmID0gY2FsbFN0YWNrLmZpbmQoc2YgPT4gISEoc2YgJiYgc2Yuc291cmNlICYmIHNmLnNvdXJjZS5hdmFpbGFibGUgJiYgc2Yuc291cmNlLnByZXNlbnRhdGlvbkhpbnQgIT09ICdkZWVtcGhhc2l6ZScpKTtcblx0XHRpZiAoIWV4Y2VwdGlvblNmIHx8IGV4Y2VwdGlvblNmICE9PSBmb2N1c2VkU2YpIHtcblx0XHRcdHRoaXMuY2xvc2VFeGNlcHRpb25XaWRnZXQoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzYW1lVXJpID0gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoZXhjZXB0aW9uU2Yuc291cmNlLnVyaSwgbW9kZWwudXJpKTtcblx0XHRpZiAodGhpcy5leGNlcHRpb25XaWRnZXQgJiYgIXNhbWVVcmkpIHtcblx0XHRcdHRoaXMuY2xvc2VFeGNlcHRpb25XaWRnZXQoKTtcblx0XHR9IGVsc2UgaWYgKHNhbWVVcmkpIHtcblx0XHRcdGNvbnN0IGV4Y2VwdGlvbkluZm8gPSBhd2FpdCBmb2N1c2VkU2YudGhyZWFkLmV4Y2VwdGlvbkluZm87XG5cdFx0XHRpZiAoZXhjZXB0aW9uSW5mbykge1xuXHRcdFx0XHR0aGlzLnNob3dFeGNlcHRpb25XaWRnZXQoZXhjZXB0aW9uSW5mbywgdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFNlc3Npb24sIGV4Y2VwdGlvblNmLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgZXhjZXB0aW9uU2YucmFuZ2Uuc3RhcnRDb2x1bW4pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2hvd0V4Y2VwdGlvbldpZGdldChleGNlcHRpb25JbmZvOiBJRXhjZXB0aW9uSW5mbywgZGVidWdTZXNzaW9uOiBJRGVidWdTZXNzaW9uIHwgdW5kZWZpbmVkLCBsaW5lTnVtYmVyOiBudW1iZXIsIGNvbHVtbjogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuZXhjZXB0aW9uV2lkZ2V0KSB7XG5cdFx0XHR0aGlzLmV4Y2VwdGlvbldpZGdldC5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5leGNlcHRpb25XaWRnZXQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4Y2VwdGlvbldpZGdldCwgdGhpcy5lZGl0b3IsIGV4Y2VwdGlvbkluZm8sIGRlYnVnU2Vzc2lvbik7XG5cdFx0dGhpcy5leGNlcHRpb25XaWRnZXQuc2hvdyh7IGxpbmVOdW1iZXIsIGNvbHVtbiB9LCAwKTtcblx0XHR0aGlzLmV4Y2VwdGlvbldpZGdldC5mb2N1cygpO1xuXHRcdHRoaXMuZWRpdG9yLnJldmVhbFJhbmdlSW5DZW50ZXIoe1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBsaW5lTnVtYmVyLFxuXHRcdFx0c3RhcnRDb2x1bW46IGNvbHVtbixcblx0XHRcdGVuZExpbmVOdW1iZXI6IGxpbmVOdW1iZXIsXG5cdFx0XHRlbmRDb2x1bW46IGNvbHVtbixcblx0XHR9KTtcblx0XHR0aGlzLmV4Y2VwdGlvbldpZGdldFZpc2libGUuc2V0KHRydWUpO1xuXHR9XG5cblx0Y2xvc2VFeGNlcHRpb25XaWRnZXQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuZXhjZXB0aW9uV2lkZ2V0KSB7XG5cdFx0XHRjb25zdCBzaG91bGRGb2N1c0VkaXRvciA9IHRoaXMuZXhjZXB0aW9uV2lkZ2V0Lmhhc0ZvY3VzKCk7XG5cdFx0XHR0aGlzLmV4Y2VwdGlvbldpZGdldC5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLmV4Y2VwdGlvbldpZGdldCA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuZXhjZXB0aW9uV2lkZ2V0VmlzaWJsZS5zZXQoZmFsc2UpO1xuXHRcdFx0aWYgKHNob3VsZEZvY3VzRWRpdG9yKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yLmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgYWRkTGF1bmNoQ29uZmlndXJhdGlvbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBjb25maWd1cmF0aW9uc0FycmF5UG9zaXRpb246IFBvc2l0aW9uIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBsYXN0UHJvcGVydHk6IHN0cmluZztcblxuXHRcdGNvbnN0IGdldENvbmZpZ3VyYXRpb25Qb3NpdGlvbiA9ICgpID0+IHtcblx0XHRcdGxldCBkZXB0aEluQXJyYXkgPSAwO1xuXHRcdFx0dmlzaXQobW9kZWwuZ2V0VmFsdWUoKSwge1xuXHRcdFx0XHRvbk9iamVjdFByb3BlcnR5OiAocHJvcGVydHk6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRcdGxhc3RQcm9wZXJ0eSA9IHByb3BlcnR5O1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRvbkFycmF5QmVnaW46IChvZmZzZXQ6IG51bWJlcikgPT4ge1xuXHRcdFx0XHRcdGlmIChsYXN0UHJvcGVydHkgPT09ICdjb25maWd1cmF0aW9ucycgJiYgZGVwdGhJbkFycmF5ID09PSAwKSB7XG5cdFx0XHRcdFx0XHRjb25maWd1cmF0aW9uc0FycmF5UG9zaXRpb24gPSBtb2RlbC5nZXRQb3NpdGlvbkF0KG9mZnNldCArIDEpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRkZXB0aEluQXJyYXkrKztcblx0XHRcdFx0fSxcblx0XHRcdFx0b25BcnJheUVuZDogKCkgPT4ge1xuXHRcdFx0XHRcdGRlcHRoSW5BcnJheS0tO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9O1xuXG5cdFx0Z2V0Q29uZmlndXJhdGlvblBvc2l0aW9uKCk7XG5cblx0XHRpZiAoIWNvbmZpZ3VyYXRpb25zQXJyYXlQb3NpdGlvbikge1xuXHRcdFx0Ly8gXCJjb25maWd1cmF0aW9uc1wiIGFycmF5IGRvZXNuJ3QgZXhpc3QuIEFkZCBpdCBoZXJlLlxuXHRcdFx0Y29uc3QgeyB0YWJTaXplLCBpbnNlcnRTcGFjZXMgfSA9IG1vZGVsLmdldE9wdGlvbnMoKTtcblx0XHRcdGNvbnN0IGVvbCA9IG1vZGVsLmdldEVPTCgpO1xuXHRcdFx0Y29uc3QgZWRpdCA9IChiYXNlbmFtZShtb2RlbC51cmkuZnNQYXRoKSA9PT0gJ2xhdW5jaC5qc29uJykgP1xuXHRcdFx0XHRzZXRQcm9wZXJ0eShtb2RlbC5nZXRWYWx1ZSgpLCBbJ2NvbmZpZ3VyYXRpb25zJ10sIFtdLCB7IHRhYlNpemUsIGluc2VydFNwYWNlcywgZW9sIH0pWzBdIDpcblx0XHRcdFx0c2V0UHJvcGVydHkobW9kZWwuZ2V0VmFsdWUoKSwgWydsYXVuY2gnXSwgeyAnY29uZmlndXJhdGlvbnMnOiBbXSB9LCB7IHRhYlNpemUsIGluc2VydFNwYWNlcywgZW9sIH0pWzBdO1xuXHRcdFx0Y29uc3Qgc3RhcnRQb3NpdGlvbiA9IG1vZGVsLmdldFBvc2l0aW9uQXQoZWRpdC5vZmZzZXQpO1xuXHRcdFx0Y29uc3QgbGluZU51bWJlciA9IHN0YXJ0UG9zaXRpb24ubGluZU51bWJlcjtcblx0XHRcdGNvbnN0IHJhbmdlID0gbmV3IFJhbmdlKGxpbmVOdW1iZXIsIHN0YXJ0UG9zaXRpb24uY29sdW1uLCBsaW5lTnVtYmVyLCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpKTtcblx0XHRcdG1vZGVsLnB1c2hFZGl0T3BlcmF0aW9ucyhudWxsLCBbRWRpdE9wZXJhdGlvbi5yZXBsYWNlKHJhbmdlLCBlZGl0LmNvbnRlbnQpXSwgKCkgPT4gbnVsbCk7XG5cdFx0XHQvLyBHbyB0aHJvdWdoIHRoZSBmaWxlIGFnYWluIHNpbmNlIHdlJ3ZlIGVkaXRlZCBpdFxuXHRcdFx0Z2V0Q29uZmlndXJhdGlvblBvc2l0aW9uKCk7XG5cdFx0fVxuXHRcdGlmICghY29uZmlndXJhdGlvbnNBcnJheVBvc2l0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5lZGl0b3IuZm9jdXMoKTtcblxuXHRcdGNvbnN0IGluc2VydExpbmUgPSAocG9zaXRpb246IFBvc2l0aW9uKTogUHJvbWlzZTxhbnk+ID0+IHtcblx0XHRcdC8vIENoZWNrIGlmIHRoZXJlIGFyZSBtb3JlIGNoYXJhY3RlcnMgb24gYSBsaW5lIGFmdGVyIGEgXCJjb25maWd1cmF0aW9uc1wiOiBbLCBpZiB5ZXMgZW50ZXIgYSBuZXdsaW5lXG5cdFx0XHRpZiAobW9kZWwuZ2V0TGluZUxhc3ROb25XaGl0ZXNwYWNlQ29sdW1uKHBvc2l0aW9uLmxpbmVOdW1iZXIpID4gcG9zaXRpb24uY29sdW1uKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yLnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5MaW5lQnJlYWtJbnNlcnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCB0aGlzLmVkaXRvciwgbnVsbCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmVkaXRvci5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG5cdFx0XHRyZXR1cm4gdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnZWRpdG9yLmFjdGlvbi5pbnNlcnRMaW5lQWZ0ZXInKTtcblx0XHR9O1xuXG5cdFx0YXdhaXQgaW5zZXJ0TGluZShjb25maWd1cmF0aW9uc0FycmF5UG9zaXRpb24pO1xuXHRcdGF3YWl0IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ2VkaXRvci5hY3Rpb24udHJpZ2dlclN1Z2dlc3QnKTtcblx0fVxuXG5cdC8vIElubGluZSBEZWNvcmF0aW9uc1xuXG5cdEBtZW1vaXplXG5cdHByaXZhdGUgZ2V0IHJlbW92ZUlubGluZVZhbHVlc1NjaGVkdWxlcigpOiBSdW5PbmNlU2NoZWR1bGVyIHtcblx0XHRyZXR1cm4gbmV3IFJ1bk9uY2VTY2hlZHVsZXIoXG5cdFx0XHQoKSA9PiB7XG5cdFx0XHRcdHRoaXMuZGlzcGxheWVkU3RvcmUuY2xlYXIoKTtcblx0XHRcdFx0dGhpcy5vbGREZWNvcmF0aW9ucy5jbGVhcigpO1xuXHRcdFx0fSxcblx0XHRcdDEwMFxuXHRcdCk7XG5cdH1cblxuXHRAbWVtb2l6ZVxuXHRwcml2YXRlIGdldCB1cGRhdGVJbmxpbmVWYWx1ZXNTY2hlZHVsZXIoKTogUnVuT25jZVNjaGVkdWxlciB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdHJldHVybiBuZXcgUnVuT25jZVNjaGVkdWxlcihcblx0XHRcdGFzeW5jICgpID0+IGF3YWl0IHRoaXMudXBkYXRlSW5saW5lVmFsdWVEZWNvcmF0aW9ucyh0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU3RhY2tGcmFtZSksXG5cdFx0XHRtb2RlbCA/IHRoaXMuZGVib3VuY2VJbmZvLmdldChtb2RlbCkgOiBERUFGVUxUX0lOTElORV9ERUJPVU5DRV9ERUxBWVxuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZUlubGluZVZhbHVlRGVjb3JhdGlvbnMoc3RhY2tGcmFtZTogSVN0YWNrRnJhbWUgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdGNvbnN0IHZhcl92YWx1ZV9mb3JtYXQgPSAnezB9ID0gezF9Jztcblx0XHRjb25zdCBzZXBhcmF0b3IgPSAnLCAnO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IGlubGluZVZhbHVlc1NldHRpbmcgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElEZWJ1Z0NvbmZpZ3VyYXRpb24+KCdkZWJ1ZycpLmlubGluZVZhbHVlcztcblx0XHRjb25zdCBpbmxpbmVWYWx1ZXNUdXJuZWRPbiA9IGlubGluZVZhbHVlc1NldHRpbmcgPT09IHRydWUgfHwgaW5saW5lVmFsdWVzU2V0dGluZyA9PT0gJ29uJyB8fCAoaW5saW5lVmFsdWVzU2V0dGluZyA9PT0gJ2F1dG8nICYmIG1vZGVsICYmIHRoaXMubGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuaW5saW5lVmFsdWVzUHJvdmlkZXIuaGFzKG1vZGVsKSk7XG5cdFx0aWYgKCFpbmxpbmVWYWx1ZXNUdXJuZWRPbiB8fCAhbW9kZWwgfHwgIXN0YWNrRnJhbWUgfHwgbW9kZWwudXJpLnRvU3RyaW5nKCkgIT09IHN0YWNrRnJhbWUuc291cmNlLnVyaS50b1N0cmluZygpKSB7XG5cdFx0XHRpZiAoIXRoaXMucmVtb3ZlSW5saW5lVmFsdWVzU2NoZWR1bGVyLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdFx0dGhpcy5yZW1vdmVJbmxpbmVWYWx1ZXNTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnJlbW92ZUlubGluZVZhbHVlc1NjaGVkdWxlci5jYW5jZWwoKTtcblx0XHR0aGlzLmRpc3BsYXllZFN0b3JlLmNsZWFyKCk7XG5cblx0XHRjb25zdCB2aWV3UmFuZ2VzID0gdGhpcy5lZGl0b3IuZ2V0VmlzaWJsZVJhbmdlc1BsdXNWaWV3cG9ydEFib3ZlQmVsb3coKTtcblx0XHRsZXQgYWxsRGVjb3JhdGlvbnM6IElNb2RlbERlbHRhRGVjb3JhdGlvbltdO1xuXG5cdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0dGhpcy5kaXNwbGF5ZWRTdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IGN0cy5kaXNwb3NlKHRydWUpKSk7XG5cblx0XHRpZiAodGhpcy5sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5pbmxpbmVWYWx1ZXNQcm92aWRlci5oYXMobW9kZWwpKSB7XG5cblx0XHRcdGNvbnN0IGZpbmRWYXJpYWJsZSA9IGFzeW5jIChfa2V5OiBzdHJpbmcsIGNhc2VTZW5zaXRpdmVMb29rdXA6IGJvb2xlYW4pOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRjb25zdCBzY29wZXMgPSBhd2FpdCBzdGFja0ZyYW1lLmdldE1vc3RTcGVjaWZpY1Njb3BlcyhzdGFja0ZyYW1lLnJhbmdlKTtcblx0XHRcdFx0Y29uc3Qga2V5ID0gY2FzZVNlbnNpdGl2ZUxvb2t1cCA/IF9rZXkgOiBfa2V5LnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRcdGZvciAoY29uc3Qgc2NvcGUgb2Ygc2NvcGVzKSB7XG5cdFx0XHRcdFx0Y29uc3QgdmFyaWFibGVzID0gYXdhaXQgc2NvcGUuZ2V0Q2hpbGRyZW4oKTtcblx0XHRcdFx0XHRjb25zdCBmb3VuZCA9IHZhcmlhYmxlcy5maW5kKHYgPT4gY2FzZVNlbnNpdGl2ZUxvb2t1cCA/ICh2Lm5hbWUgPT09IGtleSkgOiAodi5uYW1lLnRvTG93ZXJDYXNlKCkgPT09IGtleSkpO1xuXHRcdFx0XHRcdGlmIChmb3VuZCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZvdW5kLnZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgY3R4OiBJbmxpbmVWYWx1ZUNvbnRleHQgPSB7XG5cdFx0XHRcdGZyYW1lSWQ6IHN0YWNrRnJhbWUuZnJhbWVJZCxcblx0XHRcdFx0c3RvcHBlZExvY2F0aW9uOiBuZXcgUmFuZ2Uoc3RhY2tGcmFtZS5yYW5nZS5zdGFydExpbmVOdW1iZXIsIHN0YWNrRnJhbWUucmFuZ2Uuc3RhcnRDb2x1bW4gKyAxLCBzdGFja0ZyYW1lLnJhbmdlLmVuZExpbmVOdW1iZXIsIHN0YWNrRnJhbWUucmFuZ2UuZW5kQ29sdW1uICsgMSlcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHByb3ZpZGVycyA9IHRoaXMubGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuaW5saW5lVmFsdWVzUHJvdmlkZXIub3JkZXJlZChtb2RlbCkucmV2ZXJzZSgpO1xuXG5cdFx0XHRhbGxEZWNvcmF0aW9ucyA9IFtdO1xuXHRcdFx0Y29uc3QgbGluZURlY29yYXRpb25zID0gbmV3IE1hcDxudW1iZXIsIElubGluZVNlZ21lbnRbXT4oKTtcblxuXHRcdFx0Y29uc3QgcHJvbWlzZXMgPSBwcm92aWRlcnMuZmxhdE1hcChwcm92aWRlciA9PiB2aWV3UmFuZ2VzLm1hcChyYW5nZSA9PiBQcm9taXNlLnJlc29sdmUocHJvdmlkZXIucHJvdmlkZUlubGluZVZhbHVlcyhtb2RlbCwgcmFuZ2UsIGN0eCwgY3RzLnRva2VuKSkudGhlbihhc3luYyAocmVzdWx0KSA9PiB7XG5cdFx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGl2IG9mIHJlc3VsdCkge1xuXG5cdFx0XHRcdFx0XHRsZXQgdGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0c3dpdGNoIChpdi50eXBlKSB7XG5cdFx0XHRcdFx0XHRcdGNhc2UgJ3RleHQnOlxuXHRcdFx0XHRcdFx0XHRcdHRleHQgPSBpdi50ZXh0O1xuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRjYXNlICd2YXJpYWJsZSc6IHtcblx0XHRcdFx0XHRcdFx0XHRsZXQgdmEgPSBpdi52YXJpYWJsZU5hbWU7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKCF2YSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgbGluZUNvbnRlbnQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChpdi5yYW5nZS5zdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdFx0XHRcdFx0dmEgPSBsaW5lQ29udGVudC5zdWJzdHJpbmcoaXYucmFuZ2Uuc3RhcnRDb2x1bW4gLSAxLCBpdi5yYW5nZS5lbmRDb2x1bW4gLSAxKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCBmaW5kVmFyaWFibGUodmEsIGl2LmNhc2VTZW5zaXRpdmVMb29rdXApO1xuXHRcdFx0XHRcdFx0XHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGV4dCA9IHN0cmluZ3MuZm9ybWF0KHZhcl92YWx1ZV9mb3JtYXQsIHZhLCB2YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGNhc2UgJ2V4cHJlc3Npb24nOiB7XG5cdFx0XHRcdFx0XHRcdFx0bGV0IGV4cHIgPSBpdi5leHByZXNzaW9uO1xuXHRcdFx0XHRcdFx0XHRcdGlmICghZXhwcikge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgbGluZUNvbnRlbnQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChpdi5yYW5nZS5zdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdFx0XHRcdFx0ZXhwciA9IGxpbmVDb250ZW50LnN1YnN0cmluZyhpdi5yYW5nZS5zdGFydENvbHVtbiAtIDEsIGl2LnJhbmdlLmVuZENvbHVtbiAtIDEpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRpZiAoZXhwcikge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgZXhwcmVzc2lvbiA9IG5ldyBFeHByZXNzaW9uKGV4cHIpO1xuXHRcdFx0XHRcdFx0XHRcdFx0YXdhaXQgZXhwcmVzc2lvbi5ldmFsdWF0ZShzdGFja0ZyYW1lLnRocmVhZC5zZXNzaW9uLCBzdGFja0ZyYW1lLCAnd2F0Y2gnLCB0cnVlKTtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChleHByZXNzaW9uLmF2YWlsYWJsZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR0ZXh0ID0gc3RyaW5ncy5mb3JtYXQodmFyX3ZhbHVlX2Zvcm1hdCwgZXhwciwgZXhwcmVzc2lvbi52YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmICh0ZXh0KSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxpbmUgPSBpdi5yYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRcdFx0XHRcdGxldCBsaW5lU2VnbWVudHMgPSBsaW5lRGVjb3JhdGlvbnMuZ2V0KGxpbmUpO1xuXHRcdFx0XHRcdFx0XHRpZiAoIWxpbmVTZWdtZW50cykge1xuXHRcdFx0XHRcdFx0XHRcdGxpbmVTZWdtZW50cyA9IFtdO1xuXHRcdFx0XHRcdFx0XHRcdGxpbmVEZWNvcmF0aW9ucy5zZXQobGluZSwgbGluZVNlZ21lbnRzKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRpZiAoIWxpbmVTZWdtZW50cy5zb21lKGl2ID0+IGl2LnRleHQgPT09IHRleHQpKSB7XHQvLyBkZS1kdXBlXG5cdFx0XHRcdFx0XHRcdFx0bGluZVNlZ21lbnRzLnB1c2gobmV3IElubGluZVNlZ21lbnQoaXYucmFuZ2Uuc3RhcnRDb2x1bW4sIHRleHQpKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSwgZXJyID0+IHtcblx0XHRcdFx0b25VbmV4cGVjdGVkRXh0ZXJuYWxFcnJvcihlcnIpO1xuXHRcdFx0fSkpKTtcblxuXHRcdFx0Y29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcblxuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuXG5cdFx0XHQvLyB1cGRhdGUgZGVib3VuY2UgaW5mb1xuXHRcdFx0dGhpcy51cGRhdGVJbmxpbmVWYWx1ZXNTY2hlZHVsZXIuZGVsYXkgPSB0aGlzLmRlYm91bmNlSW5mby51cGRhdGUobW9kZWwsIERhdGUubm93KCkgLSBzdGFydFRpbWUpO1xuXG5cdFx0XHQvLyBzb3J0IGxpbmUgc2VnbWVudHMgYW5kIGNvbmNhdGVuYXRlIHRoZW0gaW50byBhIGRlY29yYXRpb25cblxuXHRcdFx0bGluZURlY29yYXRpb25zLmZvckVhY2goKHNlZ21lbnRzLCBsaW5lKSA9PiB7XG5cdFx0XHRcdGlmIChzZWdtZW50cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0c2VnbWVudHMgPSBzZWdtZW50cy5zb3J0KChhLCBiKSA9PiBhLmNvbHVtbiAtIGIuY29sdW1uKTtcblx0XHRcdFx0XHRjb25zdCB0ZXh0ID0gc2VnbWVudHMubWFwKHMgPT4gcy50ZXh0KS5qb2luKHNlcGFyYXRvcik7XG5cdFx0XHRcdFx0Y29uc3QgZWRpdG9yV2lkdGggPSB0aGlzLmVkaXRvci5nZXRMYXlvdXRJbmZvKCkud2lkdGg7XG5cdFx0XHRcdFx0Y29uc3QgZm9udEluZm8gPSB0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZvbnRJbmZvKTtcblx0XHRcdFx0XHRjb25zdCB2aWV3cG9ydE1heENvbCA9IE1hdGguZmxvb3IoKGVkaXRvcldpZHRoIC0gNTApIC8gZm9udEluZm8udHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoKTtcblx0XHRcdFx0XHRhbGxEZWNvcmF0aW9ucy5wdXNoKC4uLmNyZWF0ZUlubGluZVZhbHVlRGVjb3JhdGlvbihsaW5lLCB0ZXh0LCAnZGVidWcnLCB1bmRlZmluZWQsIHZpZXdwb3J0TWF4Q29sKSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIG9sZCBcIm9uZS1zaXplLWZpdHMtYWxsXCIgc3RyYXRlZ3lcblxuXHRcdFx0Y29uc3Qgc2NvcGVzID0gYXdhaXQgc3RhY2tGcmFtZS5nZXRNb3N0U3BlY2lmaWNTY29wZXMoc3RhY2tGcmFtZS5yYW5nZSk7XG5cdFx0XHRjb25zdCBzY29wZXNXaXRoVmFyaWFibGVzID0gYXdhaXQgUHJvbWlzZS5hbGwoc2NvcGVzLm1hcChhc3luYyBzY29wZSA9PlxuXHRcdFx0XHQoeyBzY29wZSwgdmFyaWFibGVzOiBhd2FpdCBzY29wZS5nZXRDaGlsZHJlbigpIH0pKSk7XG5cblx0XHRcdC8vIE1hcCBvZiBpbmxpbmUgdmFsdWVzIHBlciBsaW5lIHRoYXQncyBwb3B1bGF0ZWQgaW4gc2NvcGUgb3JkZXIsIGZyb21cblx0XHRcdC8vIG5hcnJvd2VzdCB0byB3aWRlc3QuIFRoaXMgaXMgZG9uZSB0byBhdm9pZCBkdXBsaWNhdGluZyB2YWx1ZXMgaWZcblx0XHRcdC8vIHRoZXkgYXBwZWFyIGluIG11bHRpcGxlIHNjb3BlcyBvciBhcmUgc2hhZG93ZWQgKCMxMjk3NzAsICMyMTczMjYpXG5cdFx0XHRjb25zdCB2YWx1ZXNQZXJMaW5lID0gbmV3IE1hcDwvKiBsaW5lICovbnVtYmVyLCBNYXA8LyogdmFyICovc3RyaW5nLCAvKiB2YWx1ZSAqLyBzdHJpbmc+PigpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHsgc2NvcGUsIHZhcmlhYmxlcyB9IG9mIHNjb3Blc1dpdGhWYXJpYWJsZXMpIHtcblx0XHRcdFx0bGV0IHNjb3BlUmFuZ2UgPSBuZXcgUmFuZ2UoMCwgMCwgc3RhY2tGcmFtZS5yYW5nZS5zdGFydExpbmVOdW1iZXIsIHN0YWNrRnJhbWUucmFuZ2Uuc3RhcnRDb2x1bW4pO1xuXHRcdFx0XHRpZiAoc2NvcGUucmFuZ2UpIHtcblx0XHRcdFx0XHRzY29wZVJhbmdlID0gc2NvcGVSYW5nZS5zZXRTdGFydFBvc2l0aW9uKHNjb3BlLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgc2NvcGUucmFuZ2Uuc3RhcnRDb2x1bW4pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgb3duUmFuZ2VzID0gdmlld1Jhbmdlcy5tYXAociA9PiByLmludGVyc2VjdFJhbmdlcyhzY29wZVJhbmdlKSkuZmlsdGVyKGlzRGVmaW5lZCk7XG5cdFx0XHRcdHRoaXMuX3dvcmRUb0xpbmVOdW1iZXJzTWFwID8/PSBuZXcgV29yZHNUb0xpbmVOdW1iZXJzQ2FjaGUobW9kZWwpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHJhbmdlIG9mIG93blJhbmdlcykge1xuXHRcdFx0XHRcdHRoaXMuX3dvcmRUb0xpbmVOdW1iZXJzTWFwLmVuc3VyZVJhbmdlUG9wdWxhdGVkKHJhbmdlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IG1hcHBlZCA9IGNyZWF0ZUlubGluZVZhbHVlRGVjb3JhdGlvbnNJbnNpZGVSYW5nZSh2YXJpYWJsZXMsIG93blJhbmdlcywgbW9kZWwsIHRoaXMuX3dvcmRUb0xpbmVOdW1iZXJzTWFwLnZhbHVlKTtcblx0XHRcdFx0Zm9yIChjb25zdCB7IGxpbmUsIHZhcmlhYmxlcyB9IG9mIG1hcHBlZCkge1xuXHRcdFx0XHRcdGxldCB2YWx1ZXMgPSB2YWx1ZXNQZXJMaW5lLmdldChsaW5lKTtcblx0XHRcdFx0XHRpZiAoIXZhbHVlcykge1xuXHRcdFx0XHRcdFx0dmFsdWVzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0XHRcdFx0XHRcdHZhbHVlc1BlckxpbmUuc2V0KGxpbmUsIHZhbHVlcyk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Zm9yIChjb25zdCB7IG5hbWUsIHZhbHVlIH0gb2YgdmFyaWFibGVzKSB7XG5cdFx0XHRcdFx0XHRpZiAoIXZhbHVlcy5oYXMobmFtZSkpIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzLnNldChuYW1lLCB2YWx1ZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGFsbERlY29yYXRpb25zID0gWy4uLnZhbHVlc1BlckxpbmUuZW50cmllcygpXS5mbGF0TWFwKChbbGluZSwgdmFsdWVzXSkgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0ID0gWy4uLnZhbHVlc10ubWFwKChbbiwgdl0pID0+IGAke259ID0gJHt2fWApLmpvaW4oJywgJyk7XG5cdFx0XHRcdGNvbnN0IGVkaXRvcldpZHRoID0gdGhpcy5lZGl0b3IuZ2V0TGF5b3V0SW5mbygpLndpZHRoO1xuXHRcdFx0XHRjb25zdCBmb250SW5mbyA9IHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZm9udEluZm8pO1xuXHRcdFx0XHRjb25zdCB2aWV3cG9ydE1heENvbCA9IE1hdGguZmxvb3IoKGVkaXRvcldpZHRoIC0gNTApIC8gZm9udEluZm8udHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoKTtcblx0XHRcdFx0cmV0dXJuIGNyZWF0ZUlubGluZVZhbHVlRGVjb3JhdGlvbihsaW5lLCB0ZXh0LCAnZGVidWcnLCB1bmRlZmluZWQsIHZpZXdwb3J0TWF4Q29sKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmIChjdHMudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBJZiB3b3JkIHdyYXAgaXMgb24sIGFwcGxpY2F0aW9uIG9mIGlubGluZSBkZWNvcmF0aW9ucyBtYXkgY2hhbmdlIHRoZSBzY3JvbGwgcG9zaXRpb24uXG5cdFx0Ly8gRW5zdXJlIHRoZSBjdXJzb3IgbWFpbnRhaW5zIGl0cyB2ZXJ0aWNhbCBwb3NpdGlvbiByZWxhdGl2ZSB0byB0aGUgdmlld3BvcnQgd2hlblxuXHRcdC8vIHdlIGFwcGx5IGRlY29yYXRpb25zLlxuXHRcdGxldCBwcmVzZXJ2ZVBvc2l0aW9uOiB7IHBvc2l0aW9uOiBQb3NpdGlvbjsgdG9wOiBudW1iZXIgfSB8IHVuZGVmaW5lZDtcblx0XHRpZiAodGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi53b3JkV3JhcCkgIT09ICdvZmYnKSB7XG5cdFx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMuZWRpdG9yLmdldFBvc2l0aW9uKCk7XG5cdFx0XHRpZiAocG9zaXRpb24gJiYgdGhpcy5lZGl0b3IuZ2V0VmlzaWJsZVJhbmdlcygpLnNvbWUociA9PiByLmNvbnRhaW5zUG9zaXRpb24ocG9zaXRpb24pKSkge1xuXHRcdFx0XHRwcmVzZXJ2ZVBvc2l0aW9uID0geyBwb3NpdGlvbiwgdG9wOiB0aGlzLmVkaXRvci5nZXRUb3BGb3JQb3NpdGlvbihwb3NpdGlvbi5saW5lTnVtYmVyLCBwb3NpdGlvbi5jb2x1bW4pIH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5vbGREZWNvcmF0aW9ucy5zZXQoYWxsRGVjb3JhdGlvbnMpO1xuXG5cdFx0aWYgKHByZXNlcnZlUG9zaXRpb24pIHtcblx0XHRcdGNvbnN0IHRvcCA9IHRoaXMuZWRpdG9yLmdldFRvcEZvclBvc2l0aW9uKHByZXNlcnZlUG9zaXRpb24ucG9zaXRpb24ubGluZU51bWJlciwgcHJlc2VydmVQb3NpdGlvbi5wb3NpdGlvbi5jb2x1bW4pO1xuXHRcdFx0dGhpcy5lZGl0b3Iuc2V0U2Nyb2xsVG9wKHRoaXMuZWRpdG9yLmdldFNjcm9sbFRvcCgpIC0gKHByZXNlcnZlUG9zaXRpb24udG9wIC0gdG9wKSwgU2Nyb2xsVHlwZS5JbW1lZGlhdGUpO1xuXHRcdH1cblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaG92ZXJXaWRnZXQpIHtcblx0XHRcdHRoaXMuaG92ZXJXaWRnZXQuZGlzcG9zZSgpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uV2lkZ2V0KSB7XG5cdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25XaWRnZXQuZGlzcG9zZSgpO1xuXHRcdH1cblx0XHR0aGlzLnRvRGlzcG9zZSA9IGRpc3Bvc2UodGhpcy50b0Rpc3Bvc2UpO1xuXHR9XG59XG5cbmNsYXNzIFdvcmRzVG9MaW5lTnVtYmVyc0NhY2hlIHtcblx0Ly8gd2UgdXNlIHRoaXMgYXMgYW4gYXJyYXkgb2YgYml0cyB3aGVyZSBlYWNoIDEgYml0IGlzIGEgbGluZSBudW1iZXIgdGhhdCdzIGJlZW4gcGFyc2VkXG5cdHByaXZhdGUgcmVhZG9ubHkgaW50ZXJ2YWxzOiBVaW50OEFycmF5O1xuXHRwdWJsaWMgcmVhZG9ubHkgdmFsdWUgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyW10+KCk7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBtb2RlbDogSVRleHRNb2RlbCkge1xuXHRcdHRoaXMuaW50ZXJ2YWxzID0gbmV3IFVpbnQ4QXJyYXkoTWF0aC5jZWlsKG1vZGVsLmdldExpbmVDb3VudCgpIC8gOCkpO1xuXHR9XG5cblx0LyoqIEVuc3VyZXMgdGhhdCB2YXJpYWJsZXMgbmFtZXMgaW4gdGhlIGdpdmVuIHJhbmdlIGhhdmUgYmVlbiBpZGVudGlmaWVkLiAqL1xuXHRwdWJsaWMgZW5zdXJlUmFuZ2VQb3B1bGF0ZWQocmFuZ2U6IFJhbmdlKSB7XG5cdFx0Zm9yIChsZXQgbGluZU51bWJlciA9IHJhbmdlLnN0YXJ0TGluZU51bWJlcjsgbGluZU51bWJlciA8PSByYW5nZS5lbmRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyKyspIHtcblx0XHRcdGNvbnN0IGJpbiA9IGxpbmVOdW1iZXIgPj4gMzsgIC8qIE1hdGguZmxvb3IoaSAvIDgpICovXG5cdFx0XHRjb25zdCBiaXQgPSAxIDw8IChsaW5lTnVtYmVyICYgMGIxMTEpOyAvKiAxIDw8IChpICUgOCkgKi9cblx0XHRcdGlmICghKHRoaXMuaW50ZXJ2YWxzW2Jpbl0gJiBiaXQpKSB7XG5cdFx0XHRcdGdldFdvcmRUb0xpbmVOdW1iZXJzTWFwKHRoaXMubW9kZWwsIGxpbmVOdW1iZXIsIHRoaXMudmFsdWUpO1xuXHRcdFx0XHR0aGlzLmludGVydmFsc1tiaW5dIHw9IGJpdDtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZChcblx0J19leGVjdXRlSW5saW5lVmFsdWVQcm92aWRlcicsXG5cdGFzeW5jIChcblx0XHRhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcixcblx0XHR1cmk6IFVSSSxcblx0XHRpUmFuZ2U6IElSYW5nZSxcblx0XHRjb250ZXh0OiBJbmxpbmVWYWx1ZUNvbnRleHRcblx0KTogUHJvbWlzZTxJbmxpbmVWYWx1ZVtdIHwgbnVsbD4gPT4ge1xuXHRcdGFzc2VydFR5cGUoVVJJLmlzVXJpKHVyaSkpO1xuXHRcdGFzc2VydFR5cGUoUmFuZ2UuaXNJUmFuZ2UoaVJhbmdlKSk7XG5cblx0XHRpZiAoIWNvbnRleHQgfHwgdHlwZW9mIGNvbnRleHQuZnJhbWVJZCAhPT0gJ251bWJlcicgfHwgIVJhbmdlLmlzSVJhbmdlKGNvbnRleHQuc3RvcHBlZExvY2F0aW9uKSkge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCdjb250ZXh0Jyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSBhY2Nlc3Nvci5nZXQoSU1vZGVsU2VydmljZSkuZ2V0TW9kZWwodXJpKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoJ3VyaScpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJhbmdlID0gUmFuZ2UubGlmdChpUmFuZ2UpO1xuXHRcdGNvbnN0IHsgaW5saW5lVmFsdWVzUHJvdmlkZXIgfSA9IGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRcdGNvbnN0IHByb3ZpZGVycyA9IGlubGluZVZhbHVlc1Byb3ZpZGVyLm9yZGVyZWQobW9kZWwpO1xuXHRcdGNvbnN0IHByb3ZpZGVyUmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKHByb3ZpZGVycy5tYXAocHJvdmlkZXIgPT4gcHJvdmlkZXIucHJvdmlkZUlubGluZVZhbHVlcyhtb2RlbCwgcmFuZ2UsIGNvbnRleHQsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKSk7XG5cdFx0cmV0dXJuIHByb3ZpZGVyUmVzdWx0cy5mbGF0KCkuZmlsdGVyKGlzRGVmaW5lZCk7XG5cdH0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHVCQUF1Qix1QkFBdUI7QUFDdkQsU0FBUyxrQkFBa0I7QUFDM0IsU0FBeUIsNkJBQTZCO0FBRXRELFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsbUJBQW1CLCtCQUErQjtBQUMzRCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUIsaUNBQWlDO0FBQzNELFNBQVMsYUFBYTtBQUN0QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQThCLG1CQUFtQixTQUFTLG9CQUFvQjtBQUN2RixTQUFTLGFBQWE7QUFDdEIsU0FBUyxnQkFBZ0I7QUFDekIsWUFBWSxTQUFTO0FBQ3JCLFlBQVksYUFBYTtBQUN6QixTQUFTLFlBQVksaUJBQWlCO0FBQ3RDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsV0FBVztBQUNwQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFtRSx1QkFBdUI7QUFDMUYsU0FBUyxvQkFBeUM7QUFDbEQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBaUIsYUFBYTtBQUM5QixTQUFTLDJCQUEyQjtBQUNwQyxTQUF1QyxrQkFBa0I7QUFDekQsU0FBUyx5QkFBeUI7QUFFbEMsU0FBNEMsK0JBQStCO0FBQzNFLFNBQXNDLHVDQUF1QztBQUM3RSxTQUFTLGdDQUFnQztBQUN6QyxT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UUFDQSxZQUNtQztBQUNuQyxlQUFXLElBQUksTUFBTSxHQUFHLENBQUM7QUFDekIsZUFBVyxNQUFNLFNBQVMsTUFBTSxDQUFDO0FBRWpDLFFBQUksQ0FBQyxXQUFXLE9BQU8sUUFBUSxZQUFZLFlBQVksQ0FBQyxNQUFNLFNBQVMsUUFBUSxlQUFlLEdBQUc7QUFDaEcsWUFBTSxnQkFBZ0IsU0FBUztBQUFBLElBQ2hDO0FBRUEsVUFBTSxRQUFRLFNBQVMsSUFBSSxhQUFhLEVBQUUsU0FBUyxHQUFHO0FBQ3RELFFBQUksQ0FBQyxPQUFPO0FBQ1gsWUFBTSxnQkFBZ0IsS0FBSztBQUFBLElBQzVCO0FBRUEsVUFBTSxRQUFRLE1BQU0sS0FBSyxNQUFNO0FBQy9CLFVBQU0sRUFBRSxxQkFBcUIsSUFBSSxTQUFTLElBQUksd0JBQXdCO0FBQ3RFLFVBQU0sWUFBWSxxQkFBcUIsUUFBUSxLQUFLO0FBQ3BELFVBQU0sa0JBQWtCLE1BQU0sUUFBUSxJQUFJLFVBQVUsSUFBSSxjQUFZLFNBQVMsb0JBQW9CLE9BQU8sT0FBTyxTQUFTLGtCQUFrQixJQUFJLENBQUMsQ0FBQztBQUNoSixXQUFPLGdCQUFnQixLQUFLLEVBQUUsT0FBTyxTQUFTO0FBQUEsRUFDL0M7QUFBQzsiLAogICJuYW1lcyI6IFsic3RhbmRhcmRLZXlib2FyZEV2ZW50IiwgIml2IiwgInZhcmlhYmxlcyJdCn0K
