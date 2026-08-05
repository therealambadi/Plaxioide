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
import * as domStylesheetsJs from "../../../../base/browser/domStylesheets.js";
import * as aria from "../../../../base/browser/ui/aria/aria.js";
import { MOUSE_CURSOR_TEXT_CSS_CLASS_NAME } from "../../../../base/browser/ui/mouseCursor/mouseCursor.js";
import { RunOnceScheduler, timeout } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { memoize } from "../../../../base/common/decorators.js";
import { Emitter } from "../../../../base/common/event.js";
import { HistoryNavigator } from "../../../../base/common/history.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { removeAnsiEscapeCodes } from "../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI as uri } from "../../../../base/common/uri.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { EditorAction, registerEditorAction } from "../../../../editor/browser/editorExtensions.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { EDITOR_FONT_DEFAULTS, EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Range } from "../../../../editor/common/core/range.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { CompletionItemInsertTextRule, CompletionItemKind, CompletionItemKinds } from "../../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITextResourcePropertiesService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { SuggestController } from "../../../../editor/contrib/suggest/browser/suggestController.js";
import { localize, localize2 } from "../../../../nls.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { getFlatContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, IMenuService, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { registerAndCreateHistoryNavigationContext } from "../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { WorkbenchAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { editorForeground, resolveColorValue } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { registerNavigableContainer } from "../../../browser/actions/widgetNavigationCommands.js";
import { FilterViewPane, ViewAction } from "../../../browser/parts/views/viewPane.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { getSimpleCodeEditorWidgetOptions, getSimpleEditorOptions } from "../../codeEditor/browser/simpleEditorOptions.js";
import { CONTEXT_DEBUG_STATE, CONTEXT_IN_DEBUG_REPL, CONTEXT_MULTI_SESSION_REPL, DEBUG_SCHEME, IDebugService, REPL_VIEW_ID, State, getStateLabel } from "../common/debug.js";
import { Variable } from "../common/debugModel.js";
import { ReplEvaluationResult, ReplGroup } from "../common/replModel.js";
import { FocusSessionActionViewItem } from "./debugActionViewItems.js";
import { DEBUG_COMMAND_CATEGORY, FOCUS_REPL_ID } from "./debugCommands.js";
import { DebugExpressionRenderer } from "./debugExpressionRenderer.js";
import { debugConsoleClearAll, debugConsoleEvaluationPrompt } from "./debugIcons.js";
import "./media/repl.css";
import { ReplFilter } from "./replFilter.js";
import { ReplAccessibilityProvider, ReplDataSource, ReplDelegate, ReplEvaluationInputsRenderer, ReplEvaluationResultsRenderer, ReplGroupRenderer, ReplOutputElementRenderer, ReplRawObjectsRenderer, ReplVariablesRenderer } from "./replViewer.js";
const $ = dom.$;
const HISTORY_STORAGE_KEY = "debug.repl.history";
const FILTER_HISTORY_STORAGE_KEY = "debug.repl.filterHistory";
const FILTER_VALUE_STORAGE_KEY = "debug.repl.filterValue";
const DECORATION_KEY = "replinputdecoration";
function revealLastElement(tree) {
  tree.scrollTop = tree.scrollHeight - tree.renderHeight;
}
const sessionsToIgnore = /* @__PURE__ */ new Set();
const identityProvider = { getId: (element) => element.getId() };
let Repl = class extends FilterViewPane {
  constructor(options, debugService, instantiationService, storageService, themeService, modelService, contextKeyService, codeEditorService, viewDescriptorService, contextMenuService, configurationService, textResourcePropertiesService, editorService, keybindingService, openerService, hoverService, menuService, languageFeaturesService, logService) {
    const filterText = storageService.get(FILTER_VALUE_STORAGE_KEY, StorageScope.WORKSPACE, "");
    super({
      ...options,
      filterOptions: {
        placeholder: localize({ key: "workbench.debug.filter.placeholder", comment: ["Text in the brackets after e.g. is not localizable"] }, "Filter (e.g. text, !exclude, \\escape)"),
        text: filterText,
        history: JSON.parse(storageService.get(FILTER_HISTORY_STORAGE_KEY, StorageScope.WORKSPACE, "[]"))
      }
    }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.debugService = debugService;
    this.storageService = storageService;
    this.modelService = modelService;
    this.configurationService = configurationService;
    this.textResourcePropertiesService = textResourcePropertiesService;
    this.editorService = editorService;
    this.keybindingService = keybindingService;
    this.languageFeaturesService = languageFeaturesService;
    this.logService = logService;
    this.previousTreeScrollHeight = 0;
    this.styleChangedWhenInvisible = false;
    this.modelChangeListener = Disposable.None;
    this.findIsOpen = false;
    this.menu = menuService.createMenu(MenuId.DebugConsoleContext, contextKeyService);
    this._register(this.menu);
    this.history = this._register(new HistoryNavigator(new Set(JSON.parse(this.storageService.get(HISTORY_STORAGE_KEY, StorageScope.WORKSPACE, "[]"))), 100));
    this.filter = new ReplFilter();
    this.filter.filterQuery = filterText;
    this.multiSessionRepl = CONTEXT_MULTI_SESSION_REPL.bindTo(contextKeyService);
    this.replOptions = this._register(this.instantiationService.createInstance(ReplOptions, this.id, () => this.getLocationBasedColors().background));
    this._register(this.replOptions.onDidChange(() => this.onDidStyleChange()));
    codeEditorService.registerDecorationType("repl-decoration", DECORATION_KEY, {});
    this.multiSessionRepl.set(this.isMultiSessionView);
    this.registerListeners();
  }
  registerListeners() {
    if (this.debugService.getViewModel().focusedSession) {
      this.onDidFocusSession(this.debugService.getViewModel().focusedSession);
    }
    this._register(this.debugService.getViewModel().onDidFocusSession((session) => {
      this.onDidFocusSession(session);
    }));
    this._register(this.debugService.getViewModel().onDidEvaluateLazyExpression(async (e) => {
      if (e instanceof Variable && this.tree?.hasNode(e)) {
        await this.tree.updateChildren(e, false, true);
        await this.tree.expand(e);
      }
    }));
    this._register(this.debugService.onWillNewSession(async (newSession) => {
      const input = this.tree?.getInput();
      if (!input || input.state === State.Inactive) {
        await this.selectSession(newSession);
      }
      this.multiSessionRepl.set(this.isMultiSessionView);
    }));
    this._register(this.debugService.onDidEndSession(async () => {
      await Promise.resolve();
      this.multiSessionRepl.set(this.isMultiSessionView);
    }));
    this._register(this.themeService.onDidColorThemeChange(() => {
      this.refreshReplElements(false);
      if (this.isVisible()) {
        this.updateInputDecoration();
      }
    }));
    this._register(this.onDidChangeBodyVisibility((visible) => {
      if (!visible) {
        return;
      }
      if (!this.model) {
        this.model = this.modelService.getModel(Repl.URI) || this.modelService.createModel("", null, Repl.URI, true);
      }
      const focusedSession = this.debugService.getViewModel().focusedSession;
      if (this.tree && this.tree.getInput() !== focusedSession) {
        this.onDidFocusSession(focusedSession);
      }
      this.setMode();
      this.replInput.setModel(this.model);
      this.updateInputDecoration();
      this.refreshReplElements(true);
      if (this.styleChangedWhenInvisible) {
        this.styleChangedWhenInvisible = false;
        this.tree?.updateChildren(void 0, true, false);
        this.onDidStyleChange();
      }
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("debug.console.wordWrap") && this.tree) {
        this.tree.dispose();
        this.treeContainer.innerText = "";
        dom.clearNode(this.treeContainer);
        this.createReplTree();
      }
      if (e.affectsConfiguration("debug.console.acceptSuggestionOnEnter")) {
        const config = this.configurationService.getValue("debug");
        this.replInput.updateOptions({
          acceptSuggestionOnEnter: config.console.acceptSuggestionOnEnter === "on" ? "on" : "off"
        });
      }
    }));
    this._register(this.editorService.onDidActiveEditorChange(() => {
      this.setMode();
    }));
    this._register(this.filterWidget.onDidChangeFilterText(() => {
      this.filter.filterQuery = this.filterWidget.getFilterText();
      if (this.tree) {
        this.tree.refilter();
        revealLastElement(this.tree);
      }
    }));
  }
  async onDidFocusSession(session) {
    if (session) {
      sessionsToIgnore.delete(session);
      this.completionItemProvider?.dispose();
      if (session.capabilities.supportsCompletionsRequest) {
        this.completionItemProvider = this.languageFeaturesService.completionProvider.register({ scheme: DEBUG_SCHEME, pattern: "**/replinput", hasAccessToAllModels: true }, {
          _debugDisplayName: "debugConsole",
          triggerCharacters: session.capabilities.completionTriggerCharacters || ["."],
          provideCompletionItems: async (_, position, _context, token) => {
            this.setHistoryNavigationEnablement(false);
            const model = this.replInput.getModel();
            if (model) {
              const text = model.getValue();
              const focusedStackFrame = this.debugService.getViewModel().focusedStackFrame;
              const frameId = focusedStackFrame ? focusedStackFrame.frameId : void 0;
              const response = await session.completions(frameId, focusedStackFrame?.thread.threadId || 0, text, position, token);
              const suggestions = [];
              const computeRange = (length) => Range.fromPositions(position.delta(0, -length), position);
              if (response && response.body && response.body.targets) {
                response.body.targets.forEach((item) => {
                  if (item && item.label) {
                    let insertTextRules = void 0;
                    let insertText = item.text || item.label;
                    if (typeof item.selectionStart === "number") {
                      insertTextRules = CompletionItemInsertTextRule.InsertAsSnippet;
                      const selectionLength = typeof item.selectionLength === "number" ? item.selectionLength : 0;
                      const placeholder = selectionLength > 0 ? "${1:" + insertText.substring(item.selectionStart, item.selectionStart + selectionLength) + "}$0" : "$0";
                      insertText = insertText.substring(0, item.selectionStart) + placeholder + insertText.substring(item.selectionStart + selectionLength);
                    }
                    suggestions.push({
                      label: item.label,
                      insertText,
                      detail: item.detail,
                      kind: CompletionItemKinds.fromString(item.type || "property"),
                      filterText: item.start && item.length ? text.substring(item.start, item.start + item.length).concat(item.label) : void 0,
                      range: computeRange(item.length || 0),
                      sortText: item.sortText,
                      insertTextRules
                    });
                  }
                });
              }
              if (this.configurationService.getValue("debug").console.historySuggestions) {
                const history = this.history.getHistory();
                const idxLength = String(history.length).length;
                history.forEach((h, i) => suggestions.push({
                  label: h,
                  insertText: h,
                  kind: CompletionItemKind.Text,
                  range: computeRange(h.length),
                  sortText: "ZZZ" + String(history.length - i).padStart(idxLength, "0")
                }));
              }
              return { suggestions };
            }
            return Promise.resolve({ suggestions: [] });
          }
        });
      }
    }
    await this.selectSession();
  }
  getFilterStats() {
    return {
      total: this.tree?.getNode().children.length ?? 0,
      filtered: this.tree?.getNode().children.filter((c) => c.visible).length ?? 0
    };
  }
  get isReadonly() {
    const session = this.tree?.getInput();
    if (session && session.state !== State.Inactive) {
      return false;
    }
    return true;
  }
  showPreviousValue() {
    if (!this.isReadonly) {
      this.navigateHistory(true);
    }
  }
  showNextValue() {
    if (!this.isReadonly) {
      this.navigateHistory(false);
    }
  }
  focusFilter() {
    this.filterWidget.focus();
  }
  openFind() {
    this.tree?.openFind();
  }
  setMode() {
    if (!this.isVisible()) {
      return;
    }
    const activeEditorControl = this.editorService.activeTextEditorControl;
    if (isCodeEditor(activeEditorControl)) {
      this.modelChangeListener.dispose();
      this.modelChangeListener = activeEditorControl.onDidChangeModelLanguage(() => this.setMode());
      if (this.model && activeEditorControl.hasModel()) {
        this.model.setLanguage(activeEditorControl.getModel().getLanguageId());
      }
    }
  }
  onDidStyleChange() {
    if (!this.isVisible()) {
      this.styleChangedWhenInvisible = true;
      return;
    }
    if (this.styleElement) {
      this.replInput.updateOptions({
        fontSize: this.replOptions.replConfiguration.fontSize,
        lineHeight: this.replOptions.replConfiguration.lineHeight,
        fontFamily: this.replOptions.replConfiguration.fontFamily === "default" ? EDITOR_FONT_DEFAULTS.fontFamily : this.replOptions.replConfiguration.fontFamily
      });
      const replInputLineHeight = this.replInput.getOption(EditorOption.lineHeight);
      this.styleElement.textContent = `
				.repl .repl-input-wrapper .repl-input-chevron {
					line-height: ${replInputLineHeight}px
				}

				.repl .repl-input-wrapper .monaco-editor .lines-content {
					background-color: ${this.replOptions.replConfiguration.backgroundColor};
				}
			`;
      const cssFontFamily = this.replOptions.replConfiguration.fontFamily === "default" ? "var(--monaco-monospace-font)" : this.replOptions.replConfiguration.fontFamily;
      this.container.style.setProperty(`--vscode-repl-font-family`, cssFontFamily);
      this.container.style.setProperty(`--vscode-repl-font-size`, `${this.replOptions.replConfiguration.fontSize}px`);
      this.container.style.setProperty(`--vscode-repl-font-size-for-twistie`, `${this.replOptions.replConfiguration.fontSizeForTwistie}px`);
      this.container.style.setProperty(`--vscode-repl-line-height`, this.replOptions.replConfiguration.cssLineHeight);
      this.tree?.rerender();
      if (this.bodyContentDimension) {
        this.layoutBodyContent(this.bodyContentDimension.height, this.bodyContentDimension.width);
      }
    }
  }
  navigateHistory(previous) {
    const historyInput = (previous ? this.history.previous() ?? this.history.first() : this.history.next()) ?? "";
    this.replInput.setValue(historyInput);
    aria.status(historyInput);
    this.replInput.setPosition({ lineNumber: 1, column: historyInput.length + 1 });
    this.setHistoryNavigationEnablement(true);
  }
  async selectSession(session) {
    const treeInput = this.tree?.getInput();
    if (!session) {
      const focusedSession = this.debugService.getViewModel().focusedSession;
      if (focusedSession) {
        session = focusedSession;
      } else if (!treeInput || sessionsToIgnore.has(treeInput)) {
        session = this.debugService.getModel().getSessions(true).find((s) => !sessionsToIgnore.has(s));
      }
    }
    if (session) {
      this.replElementsChangeListener?.dispose();
      this.replElementsChangeListener = session.onDidChangeReplElements(() => {
        this.refreshReplElements(session.getReplElements().length === 0);
      });
      if (this.tree && treeInput !== session) {
        try {
          await this.tree.setInput(session);
        } catch (err) {
          this.logService.error(err);
        }
        revealLastElement(this.tree);
      }
    }
    this.replInput?.updateOptions({ readOnly: this.isReadonly });
    this.updateInputDecoration();
  }
  async clearRepl() {
    const session = this.tree?.getInput();
    if (session) {
      session.removeReplExpressions();
      if (session.state === State.Inactive) {
        sessionsToIgnore.add(session);
        await this.selectSession();
        this.multiSessionRepl.set(this.isMultiSessionView);
      }
    }
    this.replInput.focus();
  }
  acceptReplInput() {
    const session = this.tree?.getInput();
    if (session && !this.isReadonly) {
      session.addReplExpression(this.debugService.getViewModel().focusedStackFrame, this.replInput.getValue());
      revealLastElement(this.tree);
      this.history.add(this.replInput.getValue());
      this.replInput.setValue("");
      if (this.bodyContentDimension) {
        this.layoutBodyContent(this.bodyContentDimension.height, this.bodyContentDimension.width);
      }
    }
  }
  sendReplInput(input) {
    const session = this.tree?.getInput();
    if (session && !this.isReadonly) {
      session.addReplExpression(this.debugService.getViewModel().focusedStackFrame, input);
      revealLastElement(this.tree);
      this.history.add(input);
    }
  }
  getVisibleContent() {
    let text = "";
    if (this.model && this.tree) {
      const lineDelimiter = this.textResourcePropertiesService.getEOL(this.model.uri);
      const traverseAndAppend = (node) => {
        node.children.forEach((child) => {
          if (child.visible) {
            text += child.element.toString().trimRight() + lineDelimiter;
            if (!child.collapsed && child.children.length) {
              traverseAndAppend(child);
            }
          }
        });
      };
      traverseAndAppend(this.tree.getNode());
    }
    return removeAnsiEscapeCodes(text);
  }
  layoutBodyContent(height, width) {
    this.bodyContentDimension = new dom.Dimension(width, height);
    const replInputHeight = Math.min(this.replInput.getContentHeight(), height);
    if (this.tree) {
      const lastElementVisible = this.tree.scrollTop + this.tree.renderHeight >= this.tree.scrollHeight;
      const treeHeight = height - replInputHeight;
      this.tree.getHTMLElement().style.height = `${treeHeight}px`;
      this.tree.layout(treeHeight, width);
      if (lastElementVisible) {
        revealLastElement(this.tree);
      }
    }
    this.replInputContainer.style.height = `${replInputHeight}px`;
    this.replInput.layout({ width: width - 30, height: replInputHeight });
  }
  collapseAll() {
    this.tree?.collapseAll();
  }
  getDebugSession() {
    return this.tree?.getInput();
  }
  getReplInput() {
    return this.replInput;
  }
  getReplDataSource() {
    return this.replDataSource;
  }
  getFocusedElement() {
    return this.tree?.getFocus()?.[0];
  }
  focusTree() {
    this.tree?.domFocus();
  }
  async focus() {
    super.focus();
    await timeout(0);
    this.replInput.focus();
  }
  createActionViewItem(action) {
    if (action.id === selectReplCommandId) {
      const session = (this.tree ? this.tree.getInput() : void 0) ?? this.debugService.getViewModel().focusedSession;
      return this.instantiationService.createInstance(SelectReplActionViewItem, action, session);
    }
    return super.createActionViewItem(action);
  }
  get isMultiSessionView() {
    return this.debugService.getModel().getSessions(true).filter((s) => s.hasSeparateRepl() && !sessionsToIgnore.has(s)).length > 1;
  }
  get refreshScheduler() {
    const autoExpanded = /* @__PURE__ */ new Set();
    return new RunOnceScheduler(async () => {
      if (!this.tree || !this.tree.getInput() || !this.isVisible()) {
        return;
      }
      await this.tree.updateChildren(void 0, true, false, { diffIdentityProvider: identityProvider });
      const session = this.tree.getInput();
      if (session) {
        const autoExpandElements = async (elements) => {
          for (const element of elements) {
            if (element instanceof ReplGroup) {
              if (element.autoExpand && !autoExpanded.has(element.getId())) {
                autoExpanded.add(element.getId());
                await this.tree.expand(element);
              }
              if (!this.tree.isCollapsed(element)) {
                await autoExpandElements(element.getChildren());
              }
            }
          }
        };
        await autoExpandElements(session.getReplElements());
      }
      const { total, filtered } = this.getFilterStats();
      this.filterWidget.updateBadge(total === filtered || total === 0 ? void 0 : localize("showing filtered repl lines", "Showing {0} of {1}", filtered, total));
    }, Repl.REFRESH_DELAY);
  }
  // --- Creation
  render() {
    super.render();
    this._register(registerNavigableContainer({
      name: "repl",
      focusNotifiers: [this, this.filterWidget],
      focusNextWidget: () => {
        const element = this.tree?.getHTMLElement();
        if (this.filterWidget.hasFocus()) {
          this.tree?.domFocus();
        } else if (element && dom.isActiveElement(element)) {
          this.focus();
        }
      },
      focusPreviousWidget: () => {
        const element = this.tree?.getHTMLElement();
        if (this.replInput.hasTextFocus()) {
          this.tree?.domFocus();
        } else if (element && dom.isActiveElement(element)) {
          this.focusFilter();
        }
      }
    }));
  }
  renderBody(parent) {
    super.renderBody(parent);
    this.container = dom.append(parent, $(".repl"));
    this.treeContainer = dom.append(this.container, $(`.repl-tree.${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`));
    this.createReplInput(this.container);
    this.createReplTree();
  }
  createReplTree() {
    this.replDelegate = new ReplDelegate(this.configurationService, this.replOptions);
    const wordWrap = this.configurationService.getValue("debug").console.wordWrap;
    this.treeContainer.classList.toggle("word-wrap", wordWrap);
    const expressionRenderer = this.instantiationService.createInstance(DebugExpressionRenderer);
    this.replDataSource = new ReplDataSource();
    const tree = this.tree = this.instantiationService.createInstance(
      WorkbenchAsyncDataTree,
      "DebugRepl",
      this.treeContainer,
      this.replDelegate,
      [
        this.instantiationService.createInstance(ReplVariablesRenderer, expressionRenderer),
        this.instantiationService.createInstance(ReplOutputElementRenderer, expressionRenderer),
        new ReplEvaluationInputsRenderer(),
        this.instantiationService.createInstance(ReplGroupRenderer, expressionRenderer),
        new ReplEvaluationResultsRenderer(expressionRenderer),
        new ReplRawObjectsRenderer(expressionRenderer)
      ],
      this.replDataSource,
      {
        filter: this.filter,
        accessibilityProvider: new ReplAccessibilityProvider(),
        identityProvider,
        userSelection: true,
        mouseSupport: false,
        findWidgetEnabled: true,
        keyboardNavigationLabelProvider: { getKeyboardNavigationLabel: (e) => e.toString(true) },
        horizontalScrolling: !wordWrap,
        setRowLineHeight: false,
        supportDynamicHeights: wordWrap,
        overrideStyles: this.getLocationBasedColors().listOverrideStyles
      }
    );
    this._register(tree.onDidChangeContentHeight(() => {
      if (tree.scrollHeight !== this.previousTreeScrollHeight) {
        const lastElementWasVisible = tree.scrollTop + tree.renderHeight >= this.previousTreeScrollHeight - 2;
        if (lastElementWasVisible) {
          setTimeout(() => {
            revealLastElement(tree);
          }, 0);
        }
      }
      this.previousTreeScrollHeight = tree.scrollHeight;
    }));
    this._register(tree.onContextMenu((e) => this.onContextMenu(e)));
    this._register(tree.onDidChangeFindOpenState((open) => this.findIsOpen = open));
    let lastSelectedString;
    this._register(tree.onMouseClick(() => {
      if (this.findIsOpen) {
        return;
      }
      const selection = dom.getWindow(this.treeContainer).getSelection();
      if (!selection || selection.type !== "Range" || lastSelectedString === selection.toString()) {
        this.replInput.focus();
      }
      lastSelectedString = selection ? selection.toString() : "";
    }));
    this.selectSession();
    this.styleElement = domStylesheetsJs.createStyleSheet(this.container);
    this.onDidStyleChange();
  }
  createReplInput(container) {
    this.replInputContainer = dom.append(container, $(".repl-input-wrapper"));
    dom.append(this.replInputContainer, $(".repl-input-chevron" + ThemeIcon.asCSSSelector(debugConsoleEvaluationPrompt)));
    const { historyNavigationBackwardsEnablement, historyNavigationForwardsEnablement } = this._register(registerAndCreateHistoryNavigationContext(this.scopedContextKeyService, this));
    this.setHistoryNavigationEnablement = (enabled) => {
      historyNavigationBackwardsEnablement.set(enabled);
      historyNavigationForwardsEnablement.set(enabled);
    };
    CONTEXT_IN_DEBUG_REPL.bindTo(this.scopedContextKeyService).set(true);
    this.scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, this.scopedContextKeyService])));
    const options = getSimpleEditorOptions(this.configurationService);
    options.readOnly = true;
    options.suggest = { showStatusBar: true };
    const config = this.configurationService.getValue("debug");
    options.acceptSuggestionOnEnter = config.console.acceptSuggestionOnEnter === "on" ? "on" : "off";
    options.ariaLabel = this.getAriaLabel();
    this.replInput = this.scopedInstantiationService.createInstance(CodeEditorWidget, this.replInputContainer, options, getSimpleCodeEditorWidgetOptions());
    let lastContentHeight = -1;
    this._register(this.replInput.onDidChangeModelContent(() => {
      const model = this.replInput.getModel();
      this.setHistoryNavigationEnablement(!!model && model.getValue() === "");
      const contentHeight = this.replInput.getContentHeight();
      if (contentHeight !== lastContentHeight) {
        lastContentHeight = contentHeight;
        if (this.bodyContentDimension) {
          this.layoutBodyContent(this.bodyContentDimension.height, this.bodyContentDimension.width);
        }
      }
    }));
    this._register(this.replInput.onDidFocusEditorText(() => this.updateInputDecoration()));
    this._register(this.replInput.onDidBlurEditorText(() => this.updateInputDecoration()));
    this._register(dom.addStandardDisposableListener(this.replInputContainer, dom.EventType.FOCUS, () => this.replInputContainer.classList.add("synthetic-focus")));
    this._register(dom.addStandardDisposableListener(this.replInputContainer, dom.EventType.BLUR, () => this.replInputContainer.classList.remove("synthetic-focus")));
  }
  getAriaLabel() {
    let ariaLabel = localize("debugConsole", "Debug Console");
    if (!this.configurationService.getValue(AccessibilityVerbositySettingId.Debug)) {
      return ariaLabel;
    }
    const keybinding = this.keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getAriaLabel();
    if (keybinding) {
      ariaLabel = localize("commentLabelWithKeybinding", "{0}, use ({1}) for accessibility help", ariaLabel, keybinding);
    } else {
      ariaLabel = localize("commentLabelWithKeybindingNoKeybinding", "{0}, run the command Open Accessibility Help which is currently not triggerable via keybinding.", ariaLabel);
    }
    return ariaLabel;
  }
  onContextMenu(e) {
    const actions = getFlatContextMenuActions(this.menu.getActions({ arg: e.element, shouldForwardArgs: false }));
    this.contextMenuService.showContextMenu({
      getAnchor: () => e.anchor,
      getActions: () => actions,
      getActionsContext: () => e.element
    });
  }
  // --- Update
  refreshReplElements(noDelay) {
    if (this.tree && this.isVisible()) {
      if (this.refreshScheduler.isScheduled()) {
        return;
      }
      this.refreshScheduler.schedule(noDelay ? 0 : void 0);
    }
  }
  updateInputDecoration() {
    if (!this.replInput) {
      return;
    }
    const decorations = [];
    if (this.isReadonly && this.replInput.hasTextFocus() && !this.replInput.getValue()) {
      const transparentForeground = resolveColorValue(editorForeground, this.themeService.getColorTheme())?.transparent(0.4);
      decorations.push({
        range: {
          startLineNumber: 0,
          endLineNumber: 0,
          startColumn: 0,
          endColumn: 1
        },
        renderOptions: {
          after: {
            contentText: localize("startDebugFirst", "Please start a debug session to evaluate expressions"),
            color: transparentForeground ? transparentForeground.toString() : void 0
          }
        }
      });
    }
    this.replInput.setDecorationsByType("repl-decoration", DECORATION_KEY, decorations);
  }
  saveState() {
    const replHistory = this.history.getHistory();
    if (replHistory.length) {
      this.storageService.store(HISTORY_STORAGE_KEY, JSON.stringify(replHistory), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(HISTORY_STORAGE_KEY, StorageScope.WORKSPACE);
    }
    const filterHistory = this.filterWidget.getHistory();
    if (filterHistory.length) {
      this.storageService.store(FILTER_HISTORY_STORAGE_KEY, JSON.stringify(filterHistory), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(FILTER_HISTORY_STORAGE_KEY, StorageScope.WORKSPACE);
    }
    const filterValue = this.filterWidget.getFilterText();
    if (filterValue) {
      this.storageService.store(FILTER_VALUE_STORAGE_KEY, filterValue, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(FILTER_VALUE_STORAGE_KEY, StorageScope.WORKSPACE);
    }
    super.saveState();
  }
  dispose() {
    this.replInput?.dispose();
    this.replElementsChangeListener?.dispose();
    this.refreshScheduler.dispose();
    this.modelChangeListener.dispose();
    super.dispose();
  }
};
Repl.REFRESH_DELAY = 50;
// delay in ms to refresh the repl for new elements to show
Repl.URI = uri.parse(`${DEBUG_SCHEME}:replinput`);
__decorateClass([
  memoize
], Repl.prototype, "refreshScheduler", 1);
Repl = __decorateClass([
  __decorateParam(1, IDebugService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IModelService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, ICodeEditorService),
  __decorateParam(8, IViewDescriptorService),
  __decorateParam(9, IContextMenuService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, ITextResourcePropertiesService),
  __decorateParam(12, IEditorService),
  __decorateParam(13, IKeybindingService),
  __decorateParam(14, IOpenerService),
  __decorateParam(15, IHoverService),
  __decorateParam(16, IMenuService),
  __decorateParam(17, ILanguageFeaturesService),
  __decorateParam(18, ILogService)
], Repl);
let ReplOptions = class extends Disposable {
  constructor(viewId, backgroundColorDelegate, configurationService, themeService, viewDescriptorService) {
    super();
    this.backgroundColorDelegate = backgroundColorDelegate;
    this.configurationService = configurationService;
    this.themeService = themeService;
    this.viewDescriptorService = viewDescriptorService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._register(this.themeService.onDidColorThemeChange((e) => this.update()));
    this._register(this.viewDescriptorService.onDidChangeLocation((e) => {
      if (e.views.some((v) => v.id === viewId)) {
        this.update();
      }
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("debug.console.lineHeight") || e.affectsConfiguration("debug.console.fontSize") || e.affectsConfiguration("debug.console.fontFamily")) {
        this.update();
      }
    }));
    this.update();
  }
  get replConfiguration() {
    return this._replConfig;
  }
  update() {
    const debugConsole = this.configurationService.getValue("debug").console;
    this._replConfig = {
      fontSize: debugConsole.fontSize,
      fontFamily: debugConsole.fontFamily,
      lineHeight: debugConsole.lineHeight ? debugConsole.lineHeight : ReplOptions.lineHeightEm * debugConsole.fontSize,
      cssLineHeight: debugConsole.lineHeight ? `${debugConsole.lineHeight}px` : `${ReplOptions.lineHeightEm}em`,
      backgroundColor: this.themeService.getColorTheme().getColor(this.backgroundColorDelegate()),
      fontSizeForTwistie: debugConsole.fontSize * ReplOptions.lineHeightEm / 2 - 8
    };
    this._onDidChange.fire();
  }
};
ReplOptions.lineHeightEm = 1.4;
ReplOptions = __decorateClass([
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, IViewDescriptorService)
], ReplOptions);
class AcceptReplInputAction extends EditorAction {
  constructor() {
    super({
      id: "repl.action.acceptInput",
      label: localize2({ key: "actions.repl.acceptInput", comment: ["Apply input from the debug console input box"] }, "Debug Console: Accept Input"),
      precondition: CONTEXT_IN_DEBUG_REPL,
      kbOpts: {
        kbExpr: EditorContextKeys.textInputFocus,
        primary: KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor, editor) {
    SuggestController.get(editor)?.cancelSuggestWidget();
    const repl = getReplView(accessor.get(IViewsService));
    repl?.acceptReplInput();
  }
}
class FilterReplAction extends ViewAction {
  constructor() {
    super({
      viewId: REPL_VIEW_ID,
      id: "repl.action.filter",
      title: localize("repl.action.filter", "Debug Console: Focus Filter"),
      precondition: CONTEXT_IN_DEBUG_REPL,
      keybinding: [{
        when: EditorContextKeys.textInputFocus,
        primary: KeyMod.CtrlCmd | KeyCode.KeyF,
        weight: KeybindingWeight.EditorContrib
      }]
    });
  }
  runInView(accessor, repl) {
    repl.focusFilter();
  }
}
class FindReplAction extends ViewAction {
  constructor() {
    super({
      viewId: REPL_VIEW_ID,
      id: "repl.action.find",
      title: localize("repl.action.find", "Debug Console: Focus Find"),
      precondition: CONTEXT_IN_DEBUG_REPL,
      keybinding: [{
        when: ContextKeyExpr.or(CONTEXT_IN_DEBUG_REPL, ContextKeyExpr.equals("focusedView", "workbench.panel.repl.view")),
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyF,
        weight: KeybindingWeight.EditorContrib
      }],
      icon: Codicon.search,
      menu: [{
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", REPL_VIEW_ID),
        order: 15
      }, {
        id: MenuId.DebugConsoleContext,
        group: "z_commands",
        order: 25
      }]
    });
  }
  runInView(accessor, view) {
    view.openFind();
  }
}
class ReplCopyAllAction extends EditorAction {
  constructor() {
    super({
      id: "repl.action.copyAll",
      label: localize("actions.repl.copyAll", "Debug: Console Copy All"),
      alias: "Debug Console Copy All",
      precondition: CONTEXT_IN_DEBUG_REPL
    });
  }
  run(accessor, editor) {
    const clipboardService = accessor.get(IClipboardService);
    const repl = getReplView(accessor.get(IViewsService));
    if (repl) {
      return clipboardService.writeText(repl.getVisibleContent());
    }
  }
}
registerEditorAction(AcceptReplInputAction);
registerEditorAction(ReplCopyAllAction);
registerAction2(FilterReplAction);
registerAction2(FindReplAction);
class SelectReplActionViewItem extends FocusSessionActionViewItem {
  getSessions() {
    return this.debugService.getModel().getSessions(true).filter((s) => s.hasSeparateRepl() && !sessionsToIgnore.has(s));
  }
  mapFocusedSessionToSelected(focusedSession) {
    while (focusedSession.parentSession && !focusedSession.hasSeparateRepl()) {
      focusedSession = focusedSession.parentSession;
    }
    return focusedSession;
  }
}
function getReplView(viewsService) {
  return viewsService.getActiveViewWithId(REPL_VIEW_ID) ?? void 0;
}
const selectReplCommandId = "workbench.action.debug.selectRepl";
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: selectReplCommandId,
      viewId: REPL_VIEW_ID,
      title: localize("selectRepl", "Select Debug Console"),
      f1: false,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", REPL_VIEW_ID), CONTEXT_MULTI_SESSION_REPL),
        order: 20
      }
    });
  }
  async runInView(accessor, view, session) {
    const debugService = accessor.get(IDebugService);
    if (session && session.state !== State.Inactive && session !== debugService.getViewModel().focusedSession) {
      if (session.state !== State.Stopped) {
        const stopppedChildSession = debugService.getModel().getSessions().find((s) => s.parentSession === session && s.state === State.Stopped);
        if (stopppedChildSession) {
          session = stopppedChildSession;
        }
      }
      await debugService.focusStackFrame(void 0, void 0, session, { explicit: true });
    }
    await view.selectSession(session);
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "workbench.debug.panel.action.clearReplAction",
      viewId: REPL_VIEW_ID,
      title: localize2("clearRepl", "Clear Console"),
      metadata: {
        description: localize2("clearRepl.descriotion", "Clears all program output from your debug REPL")
      },
      f1: true,
      icon: debugConsoleClearAll,
      menu: [{
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", REPL_VIEW_ID),
        order: 30
      }, {
        id: MenuId.DebugConsoleContext,
        group: "z_commands",
        order: 20
      }],
      keybinding: [{
        primary: 0,
        mac: { primary: KeyMod.CtrlCmd | KeyCode.KeyK },
        // Weight is higher than work workbench contributions so the keybinding remains
        // highest priority when chords are registered afterwards
        weight: KeybindingWeight.WorkbenchContrib + 1,
        when: ContextKeyExpr.equals("focusedView", "workbench.panel.repl.view")
      }]
    });
  }
  runInView(_accessor, view) {
    const accessibilitySignalService = _accessor.get(IAccessibilitySignalService);
    view.clearRepl();
    accessibilitySignalService.playSignal(AccessibilitySignal.clear);
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "debug.collapseRepl",
      title: localize("collapse", "Collapse All"),
      viewId: REPL_VIEW_ID,
      menu: {
        id: MenuId.DebugConsoleContext,
        group: "z_commands",
        order: 10
      }
    });
  }
  runInView(_accessor, view) {
    view.collapseAll();
    view.focus();
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "debug.replPaste",
      title: localize("paste", "Paste"),
      viewId: REPL_VIEW_ID,
      precondition: CONTEXT_DEBUG_STATE.notEqualsTo(getStateLabel(State.Inactive)),
      menu: {
        id: MenuId.DebugConsoleContext,
        group: "2_cutcopypaste",
        order: 30
      }
    });
  }
  async runInView(accessor, view) {
    const clipboardService = accessor.get(IClipboardService);
    const clipboardText = await clipboardService.readText();
    if (clipboardText) {
      const replInput = view.getReplInput();
      replInput.setValue(replInput.getValue().concat(clipboardText));
      view.focus();
      const model = replInput.getModel();
      const lineNumber = model ? model.getLineCount() : 0;
      const column = model?.getLineMaxColumn(lineNumber);
      if (typeof lineNumber === "number" && typeof column === "number") {
        replInput.setPosition({ lineNumber, column });
      }
    }
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "workbench.debug.action.copyAll",
      title: localize("copyAll", "Copy All"),
      viewId: REPL_VIEW_ID,
      menu: {
        id: MenuId.DebugConsoleContext,
        group: "2_cutcopypaste",
        order: 20
      }
    });
  }
  async runInView(accessor, view) {
    const clipboardService = accessor.get(IClipboardService);
    await clipboardService.writeText(view.getVisibleContent());
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "debug.replCopy",
      title: localize("copy", "Copy"),
      menu: {
        id: MenuId.DebugConsoleContext,
        group: "2_cutcopypaste",
        order: 10
      }
    });
  }
  async run(accessor, element) {
    const clipboardService = accessor.get(IClipboardService);
    const debugService = accessor.get(IDebugService);
    const nativeSelection = dom.getActiveWindow().getSelection();
    const selectedText = nativeSelection?.toString();
    if (selectedText && selectedText.length > 0) {
      return clipboardService.writeText(selectedText);
    } else if (element) {
      return clipboardService.writeText(await this.tryEvaluateAndCopy(debugService, element) || element.toString());
    }
  }
  async tryEvaluateAndCopy(debugService, element) {
    if (!(element instanceof ReplEvaluationResult)) {
      return;
    }
    const stackFrame = debugService.getViewModel().focusedStackFrame;
    const session = debugService.getViewModel().focusedSession;
    if (!stackFrame || !session || !session.capabilities.supportsClipboardContext) {
      return;
    }
    try {
      const evaluation = await session.evaluate(element.originalExpression, stackFrame.frameId, "clipboard");
      return evaluation?.body.result;
    } catch (e) {
      return;
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: FOCUS_REPL_ID,
      category: DEBUG_COMMAND_CATEGORY,
      title: localize2({ comment: ["Debug is a noun in this context, not a verb."], key: "debugFocusConsole" }, "Focus on Debug Console View")
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const repl = await viewsService.openView(REPL_VIEW_ID);
    await repl?.focus();
  }
});
export {
  Repl,
  getReplView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL3JlcGwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgKiBhcyBkb21TdHlsZXNoZWV0c0pzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb21TdHlsZXNoZWV0cy5qcyc7XG5pbXBvcnQgeyBJSGlzdG9yeU5hdmlnYXRpb25XaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvaGlzdG9yeS5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgKiBhcyBhcmlhIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgTU9VU0VfQ1VSU09SX1RFWFRfQ1NTX0NMQVNTX05BTUUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbW91c2VDdXJzb3IvbW91c2VDdXJzb3IuanMnO1xuaW1wb3J0IHsgSUFzeW5jRGF0YVNvdXJjZSwgSVRyZWVDb250ZXh0TWVudUV2ZW50LCBJVHJlZU5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS90cmVlLmpzJztcbmltcG9ydCB7IElBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIsIHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgbWVtb2l6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RlY29yYXRvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEZ1enp5U2NvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IEhpc3RvcnlOYXZpZ2F0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oaXN0b3J5LmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHJlbW92ZUFuc2lFc2NhcGVDb2RlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IFVSSSBhcyB1cmkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIGlzQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yQWN0aW9uLCByZWdpc3RlckVkaXRvckFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2NvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgRURJVE9SX0ZPTlRfREVGQVVMVFMsIEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSURlY29yYXRpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IENvbXBsZXRpb25Db250ZXh0LCBDb21wbGV0aW9uSXRlbSwgQ29tcGxldGlvbkl0ZW1JbnNlcnRUZXh0UnVsZSwgQ29tcGxldGlvbkl0ZW1LaW5kLCBDb21wbGV0aW9uSXRlbUtpbmRzLCBDb21wbGV0aW9uTGlzdCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJVGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgU3VnZ2VzdENvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdENvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5U2lnbmFsLCBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5U2lnbmFsL2Jyb3dzZXIvYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZ2V0RmxhdENvbnRleHRNZW51QWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBJTWVudSwgSU1lbnVTZXJ2aWNlLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJBbmRDcmVhdGVIaXN0b3J5TmF2aWdhdGlvbkNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9oaXN0b3J5L2Jyb3dzZXIvY29udGV4dFNjb3BlZEhpc3RvcnlXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoQXN5bmNEYXRhVHJlZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IGVkaXRvckZvcmVncm91bmQsIHJlc29sdmVDb2xvclZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJOYXZpZ2FibGVDb250YWluZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2FjdGlvbnMvd2lkZ2V0TmF2aWdhdGlvbkNvbW1hbmRzLmpzJztcbmltcG9ydCB7IEZpbHRlclZpZXdQYW5lLCBJVmlld1BhbmVPcHRpb25zLCBWaWV3QWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQgfSBmcm9tICcuLi8uLi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eUNvbW1hbmRJZCB9IGZyb20gJy4uLy4uL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHlDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBnZXRTaW1wbGVDb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucywgZ2V0U2ltcGxlRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uL2NvZGVFZGl0b3IvYnJvd3Nlci9zaW1wbGVFZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IENPTlRFWFRfREVCVUdfU1RBVEUsIENPTlRFWFRfSU5fREVCVUdfUkVQTCwgQ09OVEVYVF9NVUxUSV9TRVNTSU9OX1JFUEwsIERFQlVHX1NDSEVNRSwgSURlYnVnQ29uZmlndXJhdGlvbiwgSURlYnVnU2VydmljZSwgSURlYnVnU2Vzc2lvbiwgSVJlcGxDb25maWd1cmF0aW9uLCBJUmVwbEVsZW1lbnQsIElSZXBsT3B0aW9ucywgUkVQTF9WSUVXX0lELCBTdGF0ZSwgZ2V0U3RhdGVMYWJlbCB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBWYXJpYWJsZSB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Z01vZGVsLmpzJztcbmltcG9ydCB7IFJlcGxFdmFsdWF0aW9uUmVzdWx0LCBSZXBsR3JvdXAgfSBmcm9tICcuLi9jb21tb24vcmVwbE1vZGVsLmpzJztcbmltcG9ydCB7IEZvY3VzU2Vzc2lvbkFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi9kZWJ1Z0FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBERUJVR19DT01NQU5EX0NBVEVHT1JZLCBGT0NVU19SRVBMX0lEIH0gZnJvbSAnLi9kZWJ1Z0NvbW1hbmRzLmpzJztcbmltcG9ydCB7IERlYnVnRXhwcmVzc2lvblJlbmRlcmVyIH0gZnJvbSAnLi9kZWJ1Z0V4cHJlc3Npb25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBkZWJ1Z0NvbnNvbGVDbGVhckFsbCwgZGVidWdDb25zb2xlRXZhbHVhdGlvblByb21wdCB9IGZyb20gJy4vZGVidWdJY29ucy5qcyc7XG5pbXBvcnQgJy4vbWVkaWEvcmVwbC5jc3MnO1xuaW1wb3J0IHsgUmVwbEZpbHRlciB9IGZyb20gJy4vcmVwbEZpbHRlci5qcyc7XG5pbXBvcnQgeyBSZXBsQWNjZXNzaWJpbGl0eVByb3ZpZGVyLCBSZXBsRGF0YVNvdXJjZSwgUmVwbERlbGVnYXRlLCBSZXBsRXZhbHVhdGlvbklucHV0c1JlbmRlcmVyLCBSZXBsRXZhbHVhdGlvblJlc3VsdHNSZW5kZXJlciwgUmVwbEdyb3VwUmVuZGVyZXIsIFJlcGxPdXRwdXRFbGVtZW50UmVuZGVyZXIsIFJlcGxSYXdPYmplY3RzUmVuZGVyZXIsIFJlcGxWYXJpYWJsZXNSZW5kZXJlciB9IGZyb20gJy4vcmVwbFZpZXdlci5qcyc7XG5cbmNvbnN0ICQgPSBkb20uJDtcblxuY29uc3QgSElTVE9SWV9TVE9SQUdFX0tFWSA9ICdkZWJ1Zy5yZXBsLmhpc3RvcnknO1xuY29uc3QgRklMVEVSX0hJU1RPUllfU1RPUkFHRV9LRVkgPSAnZGVidWcucmVwbC5maWx0ZXJIaXN0b3J5JztcbmNvbnN0IEZJTFRFUl9WQUxVRV9TVE9SQUdFX0tFWSA9ICdkZWJ1Zy5yZXBsLmZpbHRlclZhbHVlJztcbmNvbnN0IERFQ09SQVRJT05fS0VZID0gJ3JlcGxpbnB1dGRlY29yYXRpb24nO1xuXG5mdW5jdGlvbiByZXZlYWxMYXN0RWxlbWVudCh0cmVlOiBXb3JrYmVuY2hBc3luY0RhdGFUcmVlPGFueSwgYW55LCBhbnk+KSB7XG5cdHRyZWUuc2Nyb2xsVG9wID0gdHJlZS5zY3JvbGxIZWlnaHQgLSB0cmVlLnJlbmRlckhlaWdodDtcblx0Ly8gdHJlZS5zY3JvbGxUb3AgPSAxZTY7XG59XG5cbmNvbnN0IHNlc3Npb25zVG9JZ25vcmUgPSBuZXcgU2V0PElEZWJ1Z1Nlc3Npb24+KCk7XG5jb25zdCBpZGVudGl0eVByb3ZpZGVyID0geyBnZXRJZDogKGVsZW1lbnQ6IElSZXBsRWxlbWVudCkgPT4gZWxlbWVudC5nZXRJZCgpIH07XG5cbmV4cG9ydCBjbGFzcyBSZXBsIGV4dGVuZHMgRmlsdGVyVmlld1BhbmUgaW1wbGVtZW50cyBJSGlzdG9yeU5hdmlnYXRpb25XaWRnZXQge1xuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBSRUZSRVNIX0RFTEFZID0gNTA7IC8vIGRlbGF5IGluIG1zIHRvIHJlZnJlc2ggdGhlIHJlcGwgZm9yIG5ldyBlbGVtZW50cyB0byBzaG93XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFVSSSA9IHVyaS5wYXJzZShgJHtERUJVR19TQ0hFTUV9OnJlcGxpbnB1dGApO1xuXG5cdHByaXZhdGUgaGlzdG9yeTogSGlzdG9yeU5hdmlnYXRvcjxzdHJpbmc+O1xuXHRwcml2YXRlIHRyZWU/OiBXb3JrYmVuY2hBc3luY0RhdGFUcmVlPElEZWJ1Z1Nlc3Npb24sIElSZXBsRWxlbWVudCwgRnV6enlTY29yZT47XG5cdHByaXZhdGUgcmVwbE9wdGlvbnM6IFJlcGxPcHRpb25zO1xuXHRwcml2YXRlIHByZXZpb3VzVHJlZVNjcm9sbEhlaWdodDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSByZXBsRGVsZWdhdGUhOiBSZXBsRGVsZWdhdGU7XG5cdHByaXZhdGUgY29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgdHJlZUNvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlcGxJbnB1dCE6IENvZGVFZGl0b3JXaWRnZXQ7XG5cdHByaXZhdGUgcmVwbElucHV0Q29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgYm9keUNvbnRlbnREaW1lbnNpb246IGRvbS5EaW1lbnNpb24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgbW9kZWw6IElUZXh0TW9kZWwgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgc2V0SGlzdG9yeU5hdmlnYXRpb25FbmFibGVtZW50ITogKGVuYWJsZWQ6IGJvb2xlYW4pID0+IHZvaWQ7XG5cdHByaXZhdGUgc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UhOiBJSW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdHByaXZhdGUgcmVwbEVsZW1lbnRzQ2hhbmdlTGlzdGVuZXI6IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHN0eWxlRWxlbWVudDogSFRNTFN0eWxlRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBzdHlsZUNoYW5nZWRXaGVuSW52aXNpYmxlOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgY29tcGxldGlvbkl0ZW1Qcm92aWRlcjogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgbW9kZWxDaGFuZ2VMaXN0ZW5lcjogSURpc3Bvc2FibGUgPSBEaXNwb3NhYmxlLk5vbmU7XG5cdHByaXZhdGUgZmlsdGVyOiBSZXBsRmlsdGVyO1xuXHRwcml2YXRlIG11bHRpU2Vzc2lvblJlcGw6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIG1lbnU6IElNZW51O1xuXHRwcml2YXRlIHJlcGxEYXRhU291cmNlOiBJQXN5bmNEYXRhU291cmNlPElEZWJ1Z1Nlc3Npb24sIElSZXBsRWxlbWVudD4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZmluZElzT3BlbjogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdGlvbnM6IElWaWV3UGFuZU9wdGlvbnMsXG5cdFx0QElEZWJ1Z1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb2RlRWRpdG9yU2VydmljZSBjb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2U6IElUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByb3RlY3RlZCBvdmVycmlkZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRjb25zdCBmaWx0ZXJUZXh0ID0gc3RvcmFnZVNlcnZpY2UuZ2V0KEZJTFRFUl9WQUxVRV9TVE9SQUdFX0tFWSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgJycpO1xuXHRcdHN1cGVyKHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRmaWx0ZXJPcHRpb25zOiB7XG5cdFx0XHRcdHBsYWNlaG9sZGVyOiBsb2NhbGl6ZSh7IGtleTogJ3dvcmtiZW5jaC5kZWJ1Zy5maWx0ZXIucGxhY2Vob2xkZXInLCBjb21tZW50OiBbJ1RleHQgaW4gdGhlIGJyYWNrZXRzIGFmdGVyIGUuZy4gaXMgbm90IGxvY2FsaXphYmxlJ10gfSwgXCJGaWx0ZXIgKGUuZy4gdGV4dCwgIWV4Y2x1ZGUsIFxcXFxlc2NhcGUpXCIpLFxuXHRcdFx0XHR0ZXh0OiBmaWx0ZXJUZXh0LFxuXHRcdFx0XHRoaXN0b3J5OiBKU09OLnBhcnNlKHN0b3JhZ2VTZXJ2aWNlLmdldChGSUxURVJfSElTVE9SWV9TVE9SQUdFX0tFWSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgJ1tdJykpIGFzIHN0cmluZ1tdLFxuXHRcdFx0fVxuXHRcdH0sIGtleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgb3BlbmVyU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXG5cdFx0dGhpcy5tZW51ID0gbWVudVNlcnZpY2UuY3JlYXRlTWVudShNZW51SWQuRGVidWdDb25zb2xlQ29udGV4dCwgY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubWVudSk7XG5cdFx0dGhpcy5oaXN0b3J5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEhpc3RvcnlOYXZpZ2F0b3IobmV3IFNldChKU09OLnBhcnNlKHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KEhJU1RPUllfU1RPUkFHRV9LRVksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsICdbXScpKSksIDEwMCkpO1xuXHRcdHRoaXMuZmlsdGVyID0gbmV3IFJlcGxGaWx0ZXIoKTtcblx0XHR0aGlzLmZpbHRlci5maWx0ZXJRdWVyeSA9IGZpbHRlclRleHQ7XG5cdFx0dGhpcy5tdWx0aVNlc3Npb25SZXBsID0gQ09OVEVYVF9NVUxUSV9TRVNTSU9OX1JFUEwuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnJlcGxPcHRpb25zID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXBsT3B0aW9ucywgdGhpcy5pZCwgKCkgPT4gdGhpcy5nZXRMb2NhdGlvbkJhc2VkQ29sb3JzKCkuYmFja2dyb3VuZCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucmVwbE9wdGlvbnMub25EaWRDaGFuZ2UoKCkgPT4gdGhpcy5vbkRpZFN0eWxlQ2hhbmdlKCkpKTtcblxuXHRcdGNvZGVFZGl0b3JTZXJ2aWNlLnJlZ2lzdGVyRGVjb3JhdGlvblR5cGUoJ3JlcGwtZGVjb3JhdGlvbicsIERFQ09SQVRJT05fS0VZLCB7fSk7XG5cdFx0dGhpcy5tdWx0aVNlc3Npb25SZXBsLnNldCh0aGlzLmlzTXVsdGlTZXNzaW9uVmlldyk7XG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFNlc3Npb24pIHtcblx0XHRcdHRoaXMub25EaWRGb2N1c1Nlc3Npb24odGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFNlc3Npb24pO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLm9uRGlkRm9jdXNTZXNzaW9uKHNlc3Npb24gPT4ge1xuXHRcdFx0dGhpcy5vbkRpZEZvY3VzU2Vzc2lvbihzZXNzaW9uKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkub25EaWRFdmFsdWF0ZUxhenlFeHByZXNzaW9uKGFzeW5jIGUgPT4ge1xuXHRcdFx0aWYgKGUgaW5zdGFuY2VvZiBWYXJpYWJsZSAmJiB0aGlzLnRyZWU/Lmhhc05vZGUoZSkpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy50cmVlLnVwZGF0ZUNoaWxkcmVuKGUsIGZhbHNlLCB0cnVlKTtcblx0XHRcdFx0YXdhaXQgdGhpcy50cmVlLmV4cGFuZChlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWJ1Z1NlcnZpY2Uub25XaWxsTmV3U2Vzc2lvbihhc3luYyBuZXdTZXNzaW9uID0+IHtcblx0XHRcdC8vIE5lZWQgdG8gbGlzdGVuIHRvIG91dHB1dCBldmVudHMgZm9yIHNlc3Npb25zIHdoaWNoIGFyZSBub3QgeWV0IGZ1bGx5IGluaXRpYWxpc2VkXG5cdFx0XHRjb25zdCBpbnB1dCA9IHRoaXMudHJlZT8uZ2V0SW5wdXQoKTtcblx0XHRcdGlmICghaW5wdXQgfHwgaW5wdXQuc3RhdGUgPT09IFN0YXRlLkluYWN0aXZlKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc2VsZWN0U2Vzc2lvbihuZXdTZXNzaW9uKTtcblx0XHRcdH1cblx0XHRcdHRoaXMubXVsdGlTZXNzaW9uUmVwbC5zZXQodGhpcy5pc011bHRpU2Vzc2lvblZpZXcpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmRlYnVnU2VydmljZS5vbkRpZEVuZFNlc3Npb24oYXN5bmMgKCkgPT4ge1xuXHRcdFx0Ly8gVXBkYXRlIHZpZXcsIHNpbmNlIG9ycGhhbmVkIHNlc3Npb25zIG1pZ2h0IG5vdyBiZSBzZXBhcmF0ZVxuXHRcdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7IC8vIGFsbG93IG90aGVyIGxpc3RlbmVycyB0byBnbyBmaXJzdCwgc28gc2Vzc2lvbnMgY2FuIHVwZGF0ZSBwYXJlbnRzXG5cdFx0XHR0aGlzLm11bHRpU2Vzc2lvblJlcGwuc2V0KHRoaXMuaXNNdWx0aVNlc3Npb25WaWV3KTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50aGVtZVNlcnZpY2Uub25EaWRDb2xvclRoZW1lQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMucmVmcmVzaFJlcGxFbGVtZW50cyhmYWxzZSk7XG5cdFx0XHRpZiAodGhpcy5pc1Zpc2libGUoKSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUlucHV0RGVjb3JhdGlvbigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkQ2hhbmdlQm9keVZpc2liaWxpdHkodmlzaWJsZSA9PiB7XG5cdFx0XHRpZiAoIXZpc2libGUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF0aGlzLm1vZGVsKSB7XG5cdFx0XHRcdHRoaXMubW9kZWwgPSB0aGlzLm1vZGVsU2VydmljZS5nZXRNb2RlbChSZXBsLlVSSSkgfHwgdGhpcy5tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoJycsIG51bGwsIFJlcGwuVVJJLCB0cnVlKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZm9jdXNlZFNlc3Npb24gPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblx0XHRcdGlmICh0aGlzLnRyZWUgJiYgdGhpcy50cmVlLmdldElucHV0KCkgIT09IGZvY3VzZWRTZXNzaW9uKSB7XG5cdFx0XHRcdHRoaXMub25EaWRGb2N1c1Nlc3Npb24oZm9jdXNlZFNlc3Npb24pO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnNldE1vZGUoKTtcblx0XHRcdHRoaXMucmVwbElucHV0LnNldE1vZGVsKHRoaXMubW9kZWwpO1xuXHRcdFx0dGhpcy51cGRhdGVJbnB1dERlY29yYXRpb24oKTtcblx0XHRcdHRoaXMucmVmcmVzaFJlcGxFbGVtZW50cyh0cnVlKTtcblxuXHRcdFx0aWYgKHRoaXMuc3R5bGVDaGFuZ2VkV2hlbkludmlzaWJsZSkge1xuXHRcdFx0XHR0aGlzLnN0eWxlQ2hhbmdlZFdoZW5JbnZpc2libGUgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy50cmVlPy51cGRhdGVDaGlsZHJlbih1bmRlZmluZWQsIHRydWUsIGZhbHNlKTtcblx0XHRcdFx0dGhpcy5vbkRpZFN0eWxlQ2hhbmdlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2RlYnVnLmNvbnNvbGUud29yZFdyYXAnKSAmJiB0aGlzLnRyZWUpIHtcblx0XHRcdFx0dGhpcy50cmVlLmRpc3Bvc2UoKTtcblx0XHRcdFx0dGhpcy50cmVlQ29udGFpbmVyLmlubmVyVGV4dCA9ICcnO1xuXHRcdFx0XHRkb20uY2xlYXJOb2RlKHRoaXMudHJlZUNvbnRhaW5lcik7XG5cdFx0XHRcdHRoaXMuY3JlYXRlUmVwbFRyZWUoKTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdkZWJ1Zy5jb25zb2xlLmFjY2VwdFN1Z2dlc3Rpb25PbkVudGVyJykpIHtcblx0XHRcdFx0Y29uc3QgY29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRGVidWdDb25maWd1cmF0aW9uPignZGVidWcnKTtcblx0XHRcdFx0dGhpcy5yZXBsSW5wdXQudXBkYXRlT3B0aW9ucyh7XG5cdFx0XHRcdFx0YWNjZXB0U3VnZ2VzdGlvbk9uRW50ZXI6IGNvbmZpZy5jb25zb2xlLmFjY2VwdFN1Z2dlc3Rpb25PbkVudGVyID09PSAnb24nID8gJ29uJyA6ICdvZmYnXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yU2VydmljZS5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLnNldE1vZGUoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbHRlcldpZGdldC5vbkRpZENoYW5nZUZpbHRlclRleHQoKCkgPT4ge1xuXHRcdFx0dGhpcy5maWx0ZXIuZmlsdGVyUXVlcnkgPSB0aGlzLmZpbHRlcldpZGdldC5nZXRGaWx0ZXJUZXh0KCk7XG5cdFx0XHRpZiAodGhpcy50cmVlKSB7XG5cdFx0XHRcdHRoaXMudHJlZS5yZWZpbHRlcigpO1xuXHRcdFx0XHRyZXZlYWxMYXN0RWxlbWVudCh0aGlzLnRyZWUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb25EaWRGb2N1c1Nlc3Npb24oc2Vzc2lvbjogSURlYnVnU2Vzc2lvbiB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChzZXNzaW9uKSB7XG5cdFx0XHRzZXNzaW9uc1RvSWdub3JlLmRlbGV0ZShzZXNzaW9uKTtcblx0XHRcdHRoaXMuY29tcGxldGlvbkl0ZW1Qcm92aWRlcj8uZGlzcG9zZSgpO1xuXHRcdFx0aWYgKHNlc3Npb24uY2FwYWJpbGl0aWVzLnN1cHBvcnRzQ29tcGxldGlvbnNSZXF1ZXN0KSB7XG5cdFx0XHRcdHRoaXMuY29tcGxldGlvbkl0ZW1Qcm92aWRlciA9IHRoaXMubGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiBERUJVR19TQ0hFTUUsIHBhdHRlcm46ICcqKi9yZXBsaW5wdXQnLCBoYXNBY2Nlc3NUb0FsbE1vZGVsczogdHJ1ZSB9LCB7XG5cdFx0XHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICdkZWJ1Z0NvbnNvbGUnLFxuXHRcdFx0XHRcdHRyaWdnZXJDaGFyYWN0ZXJzOiBzZXNzaW9uLmNhcGFiaWxpdGllcy5jb21wbGV0aW9uVHJpZ2dlckNoYXJhY3RlcnMgfHwgWycuJ10sXG5cdFx0XHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtczogYXN5bmMgKF86IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbiwgX2NvbnRleHQ6IENvbXBsZXRpb25Db250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPENvbXBsZXRpb25MaXN0PiA9PiB7XG5cdFx0XHRcdFx0XHQvLyBEaXNhYmxlIGhpc3RvcnkgbmF2aWdhdGlvbiBiZWNhdXNlIHVwIGFuZCBkb3duIGFyZSB1c2VkIHRvIG5hdmlnYXRlIHRocm91Z2ggdGhlIHN1Z2dlc3Qgd2lkZ2V0XG5cdFx0XHRcdFx0XHR0aGlzLnNldEhpc3RvcnlOYXZpZ2F0aW9uRW5hYmxlbWVudChmYWxzZSk7XG5cblx0XHRcdFx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5yZXBsSW5wdXQuZ2V0TW9kZWwoKTtcblx0XHRcdFx0XHRcdGlmIChtb2RlbCkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCB0ZXh0ID0gbW9kZWwuZ2V0VmFsdWUoKTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZm9jdXNlZFN0YWNrRnJhbWUgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU3RhY2tGcmFtZTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZnJhbWVJZCA9IGZvY3VzZWRTdGFja0ZyYW1lID8gZm9jdXNlZFN0YWNrRnJhbWUuZnJhbWVJZCA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBzZXNzaW9uLmNvbXBsZXRpb25zKGZyYW1lSWQsIGZvY3VzZWRTdGFja0ZyYW1lPy50aHJlYWQudGhyZWFkSWQgfHwgMCwgdGV4dCwgcG9zaXRpb24sIHRva2VuKTtcblxuXHRcdFx0XHRcdFx0XHRjb25zdCBzdWdnZXN0aW9uczogQ29tcGxldGlvbkl0ZW1bXSA9IFtdO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBjb21wdXRlUmFuZ2UgPSAobGVuZ3RoOiBudW1iZXIpID0+IFJhbmdlLmZyb21Qb3NpdGlvbnMocG9zaXRpb24uZGVsdGEoMCwgLWxlbmd0aCksIHBvc2l0aW9uKTtcblx0XHRcdFx0XHRcdFx0aWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlLmJvZHkgJiYgcmVzcG9uc2UuYm9keS50YXJnZXRzKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmVzcG9uc2UuYm9keS50YXJnZXRzLmZvckVhY2goaXRlbSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoaXRlbSAmJiBpdGVtLmxhYmVsKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGxldCBpbnNlcnRUZXh0UnVsZXM6IENvbXBsZXRpb25JdGVtSW5zZXJ0VGV4dFJ1bGUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGxldCBpbnNlcnRUZXh0ID0gaXRlbS50ZXh0IHx8IGl0ZW0ubGFiZWw7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgaXRlbS5zZWxlY3Rpb25TdGFydCA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBJZiBhIGRlYnVnIGNvbXBsZXRpb24gaXRlbSBzZXRzIGEgc2VsZWN0aW9uIHdlIG5lZWQgdG8gdXNlIHNuaXBwZXRzIHRvIG1ha2Ugc3VyZSB0aGUgc2VsZWN0aW9uIGlzIHNlbGVjdGVkICM5MDk3NFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGluc2VydFRleHRSdWxlcyA9IENvbXBsZXRpb25JdGVtSW5zZXJ0VGV4dFJ1bGUuSW5zZXJ0QXNTbmlwcGV0O1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IHNlbGVjdGlvbkxlbmd0aCA9IHR5cGVvZiBpdGVtLnNlbGVjdGlvbkxlbmd0aCA9PT0gJ251bWJlcicgPyBpdGVtLnNlbGVjdGlvbkxlbmd0aCA6IDA7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgcGxhY2Vob2xkZXIgPSBzZWxlY3Rpb25MZW5ndGggPiAwID8gJyR7MTonICsgaW5zZXJ0VGV4dC5zdWJzdHJpbmcoaXRlbS5zZWxlY3Rpb25TdGFydCwgaXRlbS5zZWxlY3Rpb25TdGFydCArIHNlbGVjdGlvbkxlbmd0aCkgKyAnfSQwJyA6ICckMCc7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0aW5zZXJ0VGV4dCA9IGluc2VydFRleHQuc3Vic3RyaW5nKDAsIGl0ZW0uc2VsZWN0aW9uU3RhcnQpICsgcGxhY2Vob2xkZXIgKyBpbnNlcnRUZXh0LnN1YnN0cmluZyhpdGVtLnNlbGVjdGlvblN0YXJ0ICsgc2VsZWN0aW9uTGVuZ3RoKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHN1Z2dlc3Rpb25zLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGxhYmVsOiBpdGVtLmxhYmVsLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGluc2VydFRleHQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGV0YWlsOiBpdGVtLmRldGFpbCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmRzLmZyb21TdHJpbmcoaXRlbS50eXBlIHx8ICdwcm9wZXJ0eScpLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGZpbHRlclRleHQ6IChpdGVtLnN0YXJ0ICYmIGl0ZW0ubGVuZ3RoKSA/IHRleHQuc3Vic3RyaW5nKGl0ZW0uc3RhcnQsIGl0ZW0uc3RhcnQgKyBpdGVtLmxlbmd0aCkuY29uY2F0KGl0ZW0ubGFiZWwpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHJhbmdlOiBjb21wdXRlUmFuZ2UoaXRlbS5sZW5ndGggfHwgMCksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0c29ydFRleHQ6IGl0ZW0uc29ydFRleHQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0aW5zZXJ0VGV4dFJ1bGVzXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SURlYnVnQ29uZmlndXJhdGlvbj4oJ2RlYnVnJykuY29uc29sZS5oaXN0b3J5U3VnZ2VzdGlvbnMpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBoaXN0b3J5ID0gdGhpcy5oaXN0b3J5LmdldEhpc3RvcnkoKTtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBpZHhMZW5ndGggPSBTdHJpbmcoaGlzdG9yeS5sZW5ndGgpLmxlbmd0aDtcblx0XHRcdFx0XHRcdFx0XHRoaXN0b3J5LmZvckVhY2goKGgsIGkpID0+IHN1Z2dlc3Rpb25zLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdFx0bGFiZWw6IGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiBoLFxuXHRcdFx0XHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlRleHQsXG5cdFx0XHRcdFx0XHRcdFx0XHRyYW5nZTogY29tcHV0ZVJhbmdlKGgubGVuZ3RoKSxcblx0XHRcdFx0XHRcdFx0XHRcdHNvcnRUZXh0OiAnWlpaJyArIFN0cmluZyhoaXN0b3J5Lmxlbmd0aCAtIGkpLnBhZFN0YXJ0KGlkeExlbmd0aCwgJzAnKVxuXHRcdFx0XHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdHJldHVybiB7IHN1Z2dlc3Rpb25zIH07XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoeyBzdWdnZXN0aW9uczogW10gfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLnNlbGVjdFNlc3Npb24oKTtcblx0fVxuXG5cdGdldEZpbHRlclN0YXRzKCk6IHsgdG90YWw6IG51bWJlcjsgZmlsdGVyZWQ6IG51bWJlciB9IHtcblx0XHQvLyBUaGlzIGNvdWxkIGJlIGNhbGxlZCBiZWZvcmUgdGhlIHRyZWUgaXMgY3JlYXRlZCB3aGVuIHNldHRpbmcgdGhpcy5maWx0ZXJTdGF0ZS5maWx0ZXJUZXh0IHZhbHVlXG5cdFx0cmV0dXJuIHtcblx0XHRcdHRvdGFsOiB0aGlzLnRyZWU/LmdldE5vZGUoKS5jaGlsZHJlbi5sZW5ndGggPz8gMCxcblx0XHRcdGZpbHRlcmVkOiB0aGlzLnRyZWU/LmdldE5vZGUoKS5jaGlsZHJlbi5maWx0ZXIoYyA9PiBjLnZpc2libGUpLmxlbmd0aCA/PyAwXG5cdFx0fTtcblx0fVxuXG5cdGdldCBpc1JlYWRvbmx5KCk6IGJvb2xlYW4ge1xuXHRcdC8vIERvIG5vdCBhbGxvdyB0byBlZGl0IGluYWN0aXZlIHNlc3Npb25zXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMudHJlZT8uZ2V0SW5wdXQoKTtcblx0XHRpZiAoc2Vzc2lvbiAmJiBzZXNzaW9uLnN0YXRlICE9PSBTdGF0ZS5JbmFjdGl2ZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0c2hvd1ByZXZpb3VzVmFsdWUoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmlzUmVhZG9ubHkpIHtcblx0XHRcdHRoaXMubmF2aWdhdGVIaXN0b3J5KHRydWUpO1xuXHRcdH1cblx0fVxuXG5cdHNob3dOZXh0VmFsdWUoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmlzUmVhZG9ubHkpIHtcblx0XHRcdHRoaXMubmF2aWdhdGVIaXN0b3J5KGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHRmb2N1c0ZpbHRlcigpOiB2b2lkIHtcblx0XHR0aGlzLmZpbHRlcldpZGdldC5mb2N1cygpO1xuXHR9XG5cblx0b3BlbkZpbmQoKTogdm9pZCB7XG5cdFx0dGhpcy50cmVlPy5vcGVuRmluZCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRNb2RlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5pc1Zpc2libGUoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZUVkaXRvckNvbnRyb2wgPSB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w7XG5cdFx0aWYgKGlzQ29kZUVkaXRvcihhY3RpdmVFZGl0b3JDb250cm9sKSkge1xuXHRcdFx0dGhpcy5tb2RlbENoYW5nZUxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMubW9kZWxDaGFuZ2VMaXN0ZW5lciA9IGFjdGl2ZUVkaXRvckNvbnRyb2wub25EaWRDaGFuZ2VNb2RlbExhbmd1YWdlKCgpID0+IHRoaXMuc2V0TW9kZSgpKTtcblx0XHRcdGlmICh0aGlzLm1vZGVsICYmIGFjdGl2ZUVkaXRvckNvbnRyb2wuaGFzTW9kZWwoKSkge1xuXHRcdFx0XHR0aGlzLm1vZGVsLnNldExhbmd1YWdlKGFjdGl2ZUVkaXRvckNvbnRyb2wuZ2V0TW9kZWwoKS5nZXRMYW5ndWFnZUlkKCkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRTdHlsZUNoYW5nZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaXNWaXNpYmxlKCkpIHtcblx0XHRcdHRoaXMuc3R5bGVDaGFuZ2VkV2hlbkludmlzaWJsZSA9IHRydWU7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLnN0eWxlRWxlbWVudCkge1xuXHRcdFx0dGhpcy5yZXBsSW5wdXQudXBkYXRlT3B0aW9ucyh7XG5cdFx0XHRcdGZvbnRTaXplOiB0aGlzLnJlcGxPcHRpb25zLnJlcGxDb25maWd1cmF0aW9uLmZvbnRTaXplLFxuXHRcdFx0XHRsaW5lSGVpZ2h0OiB0aGlzLnJlcGxPcHRpb25zLnJlcGxDb25maWd1cmF0aW9uLmxpbmVIZWlnaHQsXG5cdFx0XHRcdGZvbnRGYW1pbHk6IHRoaXMucmVwbE9wdGlvbnMucmVwbENvbmZpZ3VyYXRpb24uZm9udEZhbWlseSA9PT0gJ2RlZmF1bHQnID8gRURJVE9SX0ZPTlRfREVGQVVMVFMuZm9udEZhbWlseSA6IHRoaXMucmVwbE9wdGlvbnMucmVwbENvbmZpZ3VyYXRpb24uZm9udEZhbWlseVxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHJlcGxJbnB1dExpbmVIZWlnaHQgPSB0aGlzLnJlcGxJbnB1dC5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpO1xuXG5cdFx0XHQvLyBTZXQgdGhlIGZvbnQgc2l6ZSwgZm9udCBmYW1pbHksIGxpbmUgaGVpZ2h0IGFuZCBhbGlnbiB0aGUgdHdpc3RpZSB0byBiZSBjZW50ZXJlZCwgYW5kIGlucHV0IHRoZW1lIGNvbG9yXG5cdFx0XHR0aGlzLnN0eWxlRWxlbWVudC50ZXh0Q29udGVudCA9IGBcblx0XHRcdFx0LnJlcGwgLnJlcGwtaW5wdXQtd3JhcHBlciAucmVwbC1pbnB1dC1jaGV2cm9uIHtcblx0XHRcdFx0XHRsaW5lLWhlaWdodDogJHtyZXBsSW5wdXRMaW5lSGVpZ2h0fXB4XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQucmVwbCAucmVwbC1pbnB1dC13cmFwcGVyIC5tb25hY28tZWRpdG9yIC5saW5lcy1jb250ZW50IHtcblx0XHRcdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiAke3RoaXMucmVwbE9wdGlvbnMucmVwbENvbmZpZ3VyYXRpb24uYmFja2dyb3VuZENvbG9yfTtcblx0XHRcdFx0fVxuXHRcdFx0YDtcblx0XHRcdGNvbnN0IGNzc0ZvbnRGYW1pbHkgPSB0aGlzLnJlcGxPcHRpb25zLnJlcGxDb25maWd1cmF0aW9uLmZvbnRGYW1pbHkgPT09ICdkZWZhdWx0JyA/ICd2YXIoLS1tb25hY28tbW9ub3NwYWNlLWZvbnQpJyA6IHRoaXMucmVwbE9wdGlvbnMucmVwbENvbmZpZ3VyYXRpb24uZm9udEZhbWlseTtcblx0XHRcdHRoaXMuY29udGFpbmVyLnN0eWxlLnNldFByb3BlcnR5KGAtLXZzY29kZS1yZXBsLWZvbnQtZmFtaWx5YCwgY3NzRm9udEZhbWlseSk7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eShgLS12c2NvZGUtcmVwbC1mb250LXNpemVgLCBgJHt0aGlzLnJlcGxPcHRpb25zLnJlcGxDb25maWd1cmF0aW9uLmZvbnRTaXplfXB4YCk7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eShgLS12c2NvZGUtcmVwbC1mb250LXNpemUtZm9yLXR3aXN0aWVgLCBgJHt0aGlzLnJlcGxPcHRpb25zLnJlcGxDb25maWd1cmF0aW9uLmZvbnRTaXplRm9yVHdpc3RpZX1weGApO1xuXHRcdFx0dGhpcy5jb250YWluZXIuc3R5bGUuc2V0UHJvcGVydHkoYC0tdnNjb2RlLXJlcGwtbGluZS1oZWlnaHRgLCB0aGlzLnJlcGxPcHRpb25zLnJlcGxDb25maWd1cmF0aW9uLmNzc0xpbmVIZWlnaHQpO1xuXG5cdFx0XHR0aGlzLnRyZWU/LnJlcmVuZGVyKCk7XG5cblx0XHRcdGlmICh0aGlzLmJvZHlDb250ZW50RGltZW5zaW9uKSB7XG5cdFx0XHRcdHRoaXMubGF5b3V0Qm9keUNvbnRlbnQodGhpcy5ib2R5Q29udGVudERpbWVuc2lvbi5oZWlnaHQsIHRoaXMuYm9keUNvbnRlbnREaW1lbnNpb24ud2lkdGgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgbmF2aWdhdGVIaXN0b3J5KHByZXZpb3VzOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgaGlzdG9yeUlucHV0ID0gKHByZXZpb3VzID9cblx0XHRcdCh0aGlzLmhpc3RvcnkucHJldmlvdXMoKSA/PyB0aGlzLmhpc3RvcnkuZmlyc3QoKSkgOiB0aGlzLmhpc3RvcnkubmV4dCgpKVxuXHRcdFx0Pz8gJyc7XG5cdFx0dGhpcy5yZXBsSW5wdXQuc2V0VmFsdWUoaGlzdG9yeUlucHV0KTtcblx0XHRhcmlhLnN0YXR1cyhoaXN0b3J5SW5wdXQpO1xuXHRcdC8vIGFsd2F5cyBsZWF2ZSBjdXJzb3IgYXQgdGhlIGVuZC5cblx0XHR0aGlzLnJlcGxJbnB1dC5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IDEsIGNvbHVtbjogaGlzdG9yeUlucHV0Lmxlbmd0aCArIDEgfSk7XG5cdFx0dGhpcy5zZXRIaXN0b3J5TmF2aWdhdGlvbkVuYWJsZW1lbnQodHJ1ZSk7XG5cdH1cblxuXHRhc3luYyBzZWxlY3RTZXNzaW9uKHNlc3Npb24/OiBJRGVidWdTZXNzaW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdHJlZUlucHV0ID0gdGhpcy50cmVlPy5nZXRJbnB1dCgpO1xuXHRcdGlmICghc2Vzc2lvbikge1xuXHRcdFx0Y29uc3QgZm9jdXNlZFNlc3Npb24gPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblx0XHRcdC8vIElmIHRoZXJlIGlzIGEgZm9jdXNlZFNlc3Npb24gZm9jdXMgb24gdGhhdCBvbmUsIG90aGVyd2lzZSBqdXN0IHNob3cgYW55IG90aGVyIG5vdCBpZ25vcmVkIHNlc3Npb25cblx0XHRcdGlmIChmb2N1c2VkU2Vzc2lvbikge1xuXHRcdFx0XHRzZXNzaW9uID0gZm9jdXNlZFNlc3Npb247XG5cdFx0XHR9IGVsc2UgaWYgKCF0cmVlSW5wdXQgfHwgc2Vzc2lvbnNUb0lnbm9yZS5oYXModHJlZUlucHV0KSkge1xuXHRcdFx0XHRzZXNzaW9uID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRTZXNzaW9ucyh0cnVlKS5maW5kKHMgPT4gIXNlc3Npb25zVG9JZ25vcmUuaGFzKHMpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHNlc3Npb24pIHtcblx0XHRcdHRoaXMucmVwbEVsZW1lbnRzQ2hhbmdlTGlzdGVuZXI/LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMucmVwbEVsZW1lbnRzQ2hhbmdlTGlzdGVuZXIgPSBzZXNzaW9uLm9uRGlkQ2hhbmdlUmVwbEVsZW1lbnRzKCgpID0+IHtcblx0XHRcdFx0dGhpcy5yZWZyZXNoUmVwbEVsZW1lbnRzKHNlc3Npb24uZ2V0UmVwbEVsZW1lbnRzKCkubGVuZ3RoID09PSAwKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAodGhpcy50cmVlICYmIHRyZWVJbnB1dCAhPT0gc2Vzc2lvbikge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMudHJlZS5zZXRJbnB1dChzZXNzaW9uKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0Ly8gSWdub3JlIGVycm9yIGJlY2F1c2UgdGhpcyBtYXkgaGFwcGVuIG11bHRpcGxlIHRpbWVzIHdoaWxlIHJlZnJlc2hpbmcsXG5cdFx0XHRcdFx0Ly8gdGhlbiBjaGFuZ2luZyB0aGUgcm9vdCBtYXkgZmFpbC4gTG9nIHRvIGhlbHAgd2l0aCBkZWJ1Z2dpbmcgaWYgbmVlZGVkLlxuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnIpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldmVhbExhc3RFbGVtZW50KHRoaXMudHJlZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5yZXBsSW5wdXQ/LnVwZGF0ZU9wdGlvbnMoeyByZWFkT25seTogdGhpcy5pc1JlYWRvbmx5IH0pO1xuXHRcdHRoaXMudXBkYXRlSW5wdXREZWNvcmF0aW9uKCk7XG5cdH1cblxuXHRhc3luYyBjbGVhclJlcGwoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMudHJlZT8uZ2V0SW5wdXQoKTtcblx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0c2Vzc2lvbi5yZW1vdmVSZXBsRXhwcmVzc2lvbnMoKTtcblx0XHRcdGlmIChzZXNzaW9uLnN0YXRlID09PSBTdGF0ZS5JbmFjdGl2ZSkge1xuXHRcdFx0XHQvLyBJZ25vcmUgaW5hY3RpdmUgc2Vzc2lvbnMgd2hpY2ggZ290IGNsZWFyZWQgLSBzbyB0aGV5IGFyZSBub3Qgc2hvd24gYW55IG1vcmVcblx0XHRcdFx0c2Vzc2lvbnNUb0lnbm9yZS5hZGQoc2Vzc2lvbik7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc2VsZWN0U2Vzc2lvbigpO1xuXHRcdFx0XHR0aGlzLm11bHRpU2Vzc2lvblJlcGwuc2V0KHRoaXMuaXNNdWx0aVNlc3Npb25WaWV3KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5yZXBsSW5wdXQuZm9jdXMoKTtcblx0fVxuXG5cdGFjY2VwdFJlcGxJbnB1dCgpOiB2b2lkIHtcblx0XHRjb25zdCBzZXNzaW9uID0gdGhpcy50cmVlPy5nZXRJbnB1dCgpO1xuXHRcdGlmIChzZXNzaW9uICYmICF0aGlzLmlzUmVhZG9ubHkpIHtcblx0XHRcdHNlc3Npb24uYWRkUmVwbEV4cHJlc3Npb24odGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFN0YWNrRnJhbWUsIHRoaXMucmVwbElucHV0LmdldFZhbHVlKCkpO1xuXHRcdFx0cmV2ZWFsTGFzdEVsZW1lbnQodGhpcy50cmVlISk7XG5cdFx0XHR0aGlzLmhpc3RvcnkuYWRkKHRoaXMucmVwbElucHV0LmdldFZhbHVlKCkpO1xuXHRcdFx0dGhpcy5yZXBsSW5wdXQuc2V0VmFsdWUoJycpO1xuXHRcdFx0aWYgKHRoaXMuYm9keUNvbnRlbnREaW1lbnNpb24pIHtcblx0XHRcdFx0Ly8gVHJpZ2dlciBhIGxheW91dCB0byBzaHJpbmsgYSBwb3RlbnRpYWwgbXVsdGkgbGluZSBpbnB1dFxuXHRcdFx0XHR0aGlzLmxheW91dEJvZHlDb250ZW50KHRoaXMuYm9keUNvbnRlbnREaW1lbnNpb24uaGVpZ2h0LCB0aGlzLmJvZHlDb250ZW50RGltZW5zaW9uLndpZHRoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRzZW5kUmVwbElucHV0KGlucHV0OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBzZXNzaW9uID0gdGhpcy50cmVlPy5nZXRJbnB1dCgpO1xuXHRcdGlmIChzZXNzaW9uICYmICF0aGlzLmlzUmVhZG9ubHkpIHtcblx0XHRcdHNlc3Npb24uYWRkUmVwbEV4cHJlc3Npb24odGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFN0YWNrRnJhbWUsIGlucHV0KTtcblx0XHRcdHJldmVhbExhc3RFbGVtZW50KHRoaXMudHJlZSEpO1xuXHRcdFx0dGhpcy5oaXN0b3J5LmFkZChpbnB1dCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0VmlzaWJsZUNvbnRlbnQoKTogc3RyaW5nIHtcblx0XHRsZXQgdGV4dCA9ICcnO1xuXHRcdGlmICh0aGlzLm1vZGVsICYmIHRoaXMudHJlZSkge1xuXHRcdFx0Y29uc3QgbGluZURlbGltaXRlciA9IHRoaXMudGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2UuZ2V0RU9MKHRoaXMubW9kZWwudXJpKTtcblx0XHRcdGNvbnN0IHRyYXZlcnNlQW5kQXBwZW5kID0gKG5vZGU6IElUcmVlTm9kZTxJUmVwbEVsZW1lbnQsIEZ1enp5U2NvcmU+KSA9PiB7XG5cdFx0XHRcdG5vZGUuY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiB7XG5cdFx0XHRcdFx0aWYgKGNoaWxkLnZpc2libGUpIHtcblx0XHRcdFx0XHRcdHRleHQgKz0gY2hpbGQuZWxlbWVudC50b1N0cmluZygpLnRyaW1SaWdodCgpICsgbGluZURlbGltaXRlcjtcblx0XHRcdFx0XHRcdGlmICghY2hpbGQuY29sbGFwc2VkICYmIGNoaWxkLmNoaWxkcmVuLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0XHR0cmF2ZXJzZUFuZEFwcGVuZChjaGlsZCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH07XG5cdFx0XHR0cmF2ZXJzZUFuZEFwcGVuZCh0aGlzLnRyZWUuZ2V0Tm9kZSgpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVtb3ZlQW5zaUVzY2FwZUNvZGVzKHRleHQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGxheW91dEJvZHlDb250ZW50KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5ib2R5Q29udGVudERpbWVuc2lvbiA9IG5ldyBkb20uRGltZW5zaW9uKHdpZHRoLCBoZWlnaHQpO1xuXHRcdGNvbnN0IHJlcGxJbnB1dEhlaWdodCA9IE1hdGgubWluKHRoaXMucmVwbElucHV0LmdldENvbnRlbnRIZWlnaHQoKSwgaGVpZ2h0KTtcblx0XHRpZiAodGhpcy50cmVlKSB7XG5cdFx0XHRjb25zdCBsYXN0RWxlbWVudFZpc2libGUgPSB0aGlzLnRyZWUuc2Nyb2xsVG9wICsgdGhpcy50cmVlLnJlbmRlckhlaWdodCA+PSB0aGlzLnRyZWUuc2Nyb2xsSGVpZ2h0O1xuXHRcdFx0Y29uc3QgdHJlZUhlaWdodCA9IGhlaWdodCAtIHJlcGxJbnB1dEhlaWdodDtcblx0XHRcdHRoaXMudHJlZS5nZXRIVE1MRWxlbWVudCgpLnN0eWxlLmhlaWdodCA9IGAke3RyZWVIZWlnaHR9cHhgO1xuXHRcdFx0dGhpcy50cmVlLmxheW91dCh0cmVlSGVpZ2h0LCB3aWR0aCk7XG5cdFx0XHRpZiAobGFzdEVsZW1lbnRWaXNpYmxlKSB7XG5cdFx0XHRcdHJldmVhbExhc3RFbGVtZW50KHRoaXMudHJlZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMucmVwbElucHV0Q29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGAke3JlcGxJbnB1dEhlaWdodH1weGA7XG5cblx0XHR0aGlzLnJlcGxJbnB1dC5sYXlvdXQoeyB3aWR0aDogd2lkdGggLSAzMCwgaGVpZ2h0OiByZXBsSW5wdXRIZWlnaHQgfSk7XG5cdH1cblxuXHRjb2xsYXBzZUFsbCgpOiB2b2lkIHtcblx0XHR0aGlzLnRyZWU/LmNvbGxhcHNlQWxsKCk7XG5cdH1cblxuXHRnZXREZWJ1Z1Nlc3Npb24oKTogSURlYnVnU2Vzc2lvbiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZT8uZ2V0SW5wdXQoKTtcblx0fVxuXG5cdGdldFJlcGxJbnB1dCgpOiBDb2RlRWRpdG9yV2lkZ2V0IHtcblx0XHRyZXR1cm4gdGhpcy5yZXBsSW5wdXQ7XG5cdH1cblxuXHRnZXRSZXBsRGF0YVNvdXJjZSgpOiBJQXN5bmNEYXRhU291cmNlPElEZWJ1Z1Nlc3Npb24sIElSZXBsRWxlbWVudD4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnJlcGxEYXRhU291cmNlO1xuXHR9XG5cblx0Z2V0Rm9jdXNlZEVsZW1lbnQoKTogSVJlcGxFbGVtZW50IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy50cmVlPy5nZXRGb2N1cygpPy5bMF07XG5cdH1cblxuXHRmb2N1c1RyZWUoKTogdm9pZCB7XG5cdFx0dGhpcy50cmVlPy5kb21Gb2N1cygpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgZm9jdXMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0c3VwZXIuZm9jdXMoKTtcblx0XHRhd2FpdCB0aW1lb3V0KDApOyAvLyB3YWl0IGEgdGFzayBmb3IgdGhlIHJlcGwgdG8gZ2V0IGF0dGFjaGVkIHRvIHRoZSBET00sICM4MzM4N1xuXHRcdHRoaXMucmVwbElucHV0LmZvY3VzKCk7XG5cdH1cblxuXHRvdmVycmlkZSBjcmVhdGVBY3Rpb25WaWV3SXRlbShhY3Rpb246IElBY3Rpb24pOiBJQWN0aW9uVmlld0l0ZW0gfCB1bmRlZmluZWQge1xuXHRcdGlmIChhY3Rpb24uaWQgPT09IHNlbGVjdFJlcGxDb21tYW5kSWQpIHtcblx0XHRcdGNvbnN0IHNlc3Npb24gPSAodGhpcy50cmVlID8gdGhpcy50cmVlLmdldElucHV0KCkgOiB1bmRlZmluZWQpID8/IHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTZXNzaW9uO1xuXHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2VsZWN0UmVwbEFjdGlvblZpZXdJdGVtLCBhY3Rpb24sIHNlc3Npb24pO1xuXHRcdH1cblxuXHRcdHJldHVybiBzdXBlci5jcmVhdGVBY3Rpb25WaWV3SXRlbShhY3Rpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgaXNNdWx0aVNlc3Npb25WaWV3KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldFNlc3Npb25zKHRydWUpLmZpbHRlcihzID0+IHMuaGFzU2VwYXJhdGVSZXBsKCkgJiYgIXNlc3Npb25zVG9JZ25vcmUuaGFzKHMpKS5sZW5ndGggPiAxO1xuXHR9XG5cblx0Ly8gLS0tIENhY2hlZCBsb2NhbHNcblxuXHRAbWVtb2l6ZVxuXHRwcml2YXRlIGdldCByZWZyZXNoU2NoZWR1bGVyKCk6IFJ1bk9uY2VTY2hlZHVsZXIge1xuXHRcdGNvbnN0IGF1dG9FeHBhbmRlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdHJldHVybiBuZXcgUnVuT25jZVNjaGVkdWxlcihhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMudHJlZSB8fCAhdGhpcy50cmVlLmdldElucHV0KCkgfHwgIXRoaXMuaXNWaXNpYmxlKCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCB0aGlzLnRyZWUudXBkYXRlQ2hpbGRyZW4odW5kZWZpbmVkLCB0cnVlLCBmYWxzZSwgeyBkaWZmSWRlbnRpdHlQcm92aWRlcjogaWRlbnRpdHlQcm92aWRlciB9KTtcblxuXHRcdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMudHJlZS5nZXRJbnB1dCgpO1xuXHRcdFx0aWYgKHNlc3Npb24pIHtcblx0XHRcdFx0Ly8gQXV0b21hdGljYWxseSBleHBhbmQgcmVwbCBncm91cCBlbGVtZW50cyB3aGVuIHNwZWNpZmllZFxuXHRcdFx0XHRjb25zdCBhdXRvRXhwYW5kRWxlbWVudHMgPSBhc3luYyAoZWxlbWVudHM6IElSZXBsRWxlbWVudFtdKSA9PiB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG5cdFx0XHRcdFx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFJlcGxHcm91cCkge1xuXHRcdFx0XHRcdFx0XHRpZiAoZWxlbWVudC5hdXRvRXhwYW5kICYmICFhdXRvRXhwYW5kZWQuaGFzKGVsZW1lbnQuZ2V0SWQoKSkpIHtcblx0XHRcdFx0XHRcdFx0XHRhdXRvRXhwYW5kZWQuYWRkKGVsZW1lbnQuZ2V0SWQoKSk7XG5cdFx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy50cmVlIS5leHBhbmQoZWxlbWVudCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKCF0aGlzLnRyZWUhLmlzQ29sbGFwc2VkKGVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gUmVwbCBncm91cHMgY2FuIGhhdmUgY2hpbGRyZW4gd2hpY2ggYXJlIHJlcGwgZ3JvdXBzIHRodXMgd2UgbWlnaHQgbmVlZCB0byBleHBhbmQgdGhvc2UgYXMgd2VsbFxuXHRcdFx0XHRcdFx0XHRcdGF3YWl0IGF1dG9FeHBhbmRFbGVtZW50cyhlbGVtZW50LmdldENoaWxkcmVuKCkpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRhd2FpdCBhdXRvRXhwYW5kRWxlbWVudHMoc2Vzc2lvbi5nZXRSZXBsRWxlbWVudHMoKSk7XG5cdFx0XHR9XG5cdFx0XHQvLyBSZXBsIGVsZW1lbnRzIGNvdW50IGNoYW5nZWQsIG5lZWQgdG8gdXBkYXRlIGZpbHRlciBzdGF0cyBvbiB0aGUgYmFkZ2Vcblx0XHRcdGNvbnN0IHsgdG90YWwsIGZpbHRlcmVkIH0gPSB0aGlzLmdldEZpbHRlclN0YXRzKCk7XG5cdFx0XHR0aGlzLmZpbHRlcldpZGdldC51cGRhdGVCYWRnZSh0b3RhbCA9PT0gZmlsdGVyZWQgfHwgdG90YWwgPT09IDAgPyB1bmRlZmluZWQgOiBsb2NhbGl6ZSgnc2hvd2luZyBmaWx0ZXJlZCByZXBsIGxpbmVzJywgXCJTaG93aW5nIHswfSBvZiB7MX1cIiwgZmlsdGVyZWQsIHRvdGFsKSk7XG5cdFx0fSwgUmVwbC5SRUZSRVNIX0RFTEFZKTtcblx0fVxuXG5cdC8vIC0tLSBDcmVhdGlvblxuXG5cdG92ZXJyaWRlIHJlbmRlcigpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXIoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3Rlck5hdmlnYWJsZUNvbnRhaW5lcih7XG5cdFx0XHRuYW1lOiAncmVwbCcsXG5cdFx0XHRmb2N1c05vdGlmaWVyczogW3RoaXMsIHRoaXMuZmlsdGVyV2lkZ2V0XSxcblx0XHRcdGZvY3VzTmV4dFdpZGdldDogKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBlbGVtZW50ID0gdGhpcy50cmVlPy5nZXRIVE1MRWxlbWVudCgpO1xuXHRcdFx0XHRpZiAodGhpcy5maWx0ZXJXaWRnZXQuaGFzRm9jdXMoKSkge1xuXHRcdFx0XHRcdHRoaXMudHJlZT8uZG9tRm9jdXMoKTtcblx0XHRcdFx0fSBlbHNlIGlmIChlbGVtZW50ICYmIGRvbS5pc0FjdGl2ZUVsZW1lbnQoZWxlbWVudCkpIHtcblx0XHRcdFx0XHR0aGlzLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmb2N1c1ByZXZpb3VzV2lkZ2V0OiAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGVsZW1lbnQgPSB0aGlzLnRyZWU/LmdldEhUTUxFbGVtZW50KCk7XG5cdFx0XHRcdGlmICh0aGlzLnJlcGxJbnB1dC5oYXNUZXh0Rm9jdXMoKSkge1xuXHRcdFx0XHRcdHRoaXMudHJlZT8uZG9tRm9jdXMoKTtcblx0XHRcdFx0fSBlbHNlIGlmIChlbGVtZW50ICYmIGRvbS5pc0FjdGl2ZUVsZW1lbnQoZWxlbWVudCkpIHtcblx0XHRcdFx0XHR0aGlzLmZvY3VzRmlsdGVyKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyQm9keShwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyQm9keShwYXJlbnQpO1xuXHRcdHRoaXMuY29udGFpbmVyID0gZG9tLmFwcGVuZChwYXJlbnQsICQoJy5yZXBsJykpO1xuXHRcdHRoaXMudHJlZUNvbnRhaW5lciA9IGRvbS5hcHBlbmQodGhpcy5jb250YWluZXIsICQoYC5yZXBsLXRyZWUuJHtNT1VTRV9DVVJTT1JfVEVYVF9DU1NfQ0xBU1NfTkFNRX1gKSk7XG5cdFx0dGhpcy5jcmVhdGVSZXBsSW5wdXQodGhpcy5jb250YWluZXIpO1xuXHRcdHRoaXMuY3JlYXRlUmVwbFRyZWUoKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlUmVwbFRyZWUoKTogdm9pZCB7XG5cdFx0dGhpcy5yZXBsRGVsZWdhdGUgPSBuZXcgUmVwbERlbGVnYXRlKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIHRoaXMucmVwbE9wdGlvbnMpO1xuXHRcdGNvbnN0IHdvcmRXcmFwID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRGVidWdDb25maWd1cmF0aW9uPignZGVidWcnKS5jb25zb2xlLndvcmRXcmFwO1xuXHRcdHRoaXMudHJlZUNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCd3b3JkLXdyYXAnLCB3b3JkV3JhcCk7XG5cdFx0Y29uc3QgZXhwcmVzc2lvblJlbmRlcmVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEZWJ1Z0V4cHJlc3Npb25SZW5kZXJlcik7XG5cdFx0dGhpcy5yZXBsRGF0YVNvdXJjZSA9IG5ldyBSZXBsRGF0YVNvdXJjZSgpO1xuXG5cdFx0Y29uc3QgdHJlZSA9IHRoaXMudHJlZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRXb3JrYmVuY2hBc3luY0RhdGFUcmVlPElEZWJ1Z1Nlc3Npb24sIElSZXBsRWxlbWVudCwgRnV6enlTY29yZT4sXG5cdFx0XHQnRGVidWdSZXBsJyxcblx0XHRcdHRoaXMudHJlZUNvbnRhaW5lcixcblx0XHRcdHRoaXMucmVwbERlbGVnYXRlLFxuXHRcdFx0W1xuXHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlcGxWYXJpYWJsZXNSZW5kZXJlciwgZXhwcmVzc2lvblJlbmRlcmVyKSxcblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXBsT3V0cHV0RWxlbWVudFJlbmRlcmVyLCBleHByZXNzaW9uUmVuZGVyZXIpLFxuXHRcdFx0XHRuZXcgUmVwbEV2YWx1YXRpb25JbnB1dHNSZW5kZXJlcigpLFxuXHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlcGxHcm91cFJlbmRlcmVyLCBleHByZXNzaW9uUmVuZGVyZXIpLFxuXHRcdFx0XHRuZXcgUmVwbEV2YWx1YXRpb25SZXN1bHRzUmVuZGVyZXIoZXhwcmVzc2lvblJlbmRlcmVyKSxcblx0XHRcdFx0bmV3IFJlcGxSYXdPYmplY3RzUmVuZGVyZXIoZXhwcmVzc2lvblJlbmRlcmVyKSxcblx0XHRcdF0sXG5cdFx0XHR0aGlzLnJlcGxEYXRhU291cmNlLFxuXHRcdFx0e1xuXHRcdFx0XHRmaWx0ZXI6IHRoaXMuZmlsdGVyLFxuXHRcdFx0XHRhY2Nlc3NpYmlsaXR5UHJvdmlkZXI6IG5ldyBSZXBsQWNjZXNzaWJpbGl0eVByb3ZpZGVyKCksXG5cdFx0XHRcdGlkZW50aXR5UHJvdmlkZXIsXG5cdFx0XHRcdHVzZXJTZWxlY3Rpb246IHRydWUsXG5cdFx0XHRcdG1vdXNlU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRcdGZpbmRXaWRnZXRFbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRrZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyOiB7IGdldEtleWJvYXJkTmF2aWdhdGlvbkxhYmVsOiAoZTogSVJlcGxFbGVtZW50KSA9PiBlLnRvU3RyaW5nKHRydWUpIH0sXG5cdFx0XHRcdGhvcml6b250YWxTY3JvbGxpbmc6ICF3b3JkV3JhcCxcblx0XHRcdFx0c2V0Um93TGluZUhlaWdodDogZmFsc2UsXG5cdFx0XHRcdHN1cHBvcnREeW5hbWljSGVpZ2h0czogd29yZFdyYXAsXG5cdFx0XHRcdG92ZXJyaWRlU3R5bGVzOiB0aGlzLmdldExvY2F0aW9uQmFzZWRDb2xvcnMoKS5saXN0T3ZlcnJpZGVTdHlsZXNcblx0XHRcdH0pO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodHJlZS5vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQoKCkgPT4ge1xuXHRcdFx0aWYgKHRyZWUuc2Nyb2xsSGVpZ2h0ICE9PSB0aGlzLnByZXZpb3VzVHJlZVNjcm9sbEhlaWdodCkge1xuXHRcdFx0XHQvLyBEdWUgdG8gcm91bmRpbmcsIHRoZSBzY3JvbGxUb3AgKyByZW5kZXJIZWlnaHQgd2lsbCBub3QgZXhhY3RseSBtYXRjaCB0aGUgc2Nyb2xsSGVpZ2h0LlxuXHRcdFx0XHQvLyBDb25zaWRlciB0aGUgdHJlZSB0byBiZSBzY3JvbGxlZCBhbGwgdGhlIHdheSBkb3duIGlmIGl0IGlzIHdpdGhpbiAycHggb2YgdGhlIGJvdHRvbS5cblx0XHRcdFx0Y29uc3QgbGFzdEVsZW1lbnRXYXNWaXNpYmxlID0gdHJlZS5zY3JvbGxUb3AgKyB0cmVlLnJlbmRlckhlaWdodCA+PSB0aGlzLnByZXZpb3VzVHJlZVNjcm9sbEhlaWdodCAtIDI7XG5cdFx0XHRcdGlmIChsYXN0RWxlbWVudFdhc1Zpc2libGUpIHtcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRcdC8vIENhbid0IHNldCBzY3JvbGxUb3AgZHVyaW5nIHRoaXMgZXZlbnQgbGlzdGVuZXIsIHRoZSBsaXN0IG1pZ2h0IG92ZXJ3cml0ZSB0aGUgY2hhbmdlXG5cdFx0XHRcdFx0XHRyZXZlYWxMYXN0RWxlbWVudCh0cmVlKTtcblx0XHRcdFx0XHR9LCAwKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnByZXZpb3VzVHJlZVNjcm9sbEhlaWdodCA9IHRyZWUuc2Nyb2xsSGVpZ2h0O1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRyZWUub25Db250ZXh0TWVudShlID0+IHRoaXMub25Db250ZXh0TWVudShlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRyZWUub25EaWRDaGFuZ2VGaW5kT3BlblN0YXRlKChvcGVuKSA9PiB0aGlzLmZpbmRJc09wZW4gPSBvcGVuKSk7XG5cblx0XHRsZXQgbGFzdFNlbGVjdGVkU3RyaW5nOiBzdHJpbmc7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodHJlZS5vbk1vdXNlQ2xpY2soKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuZmluZElzT3Blbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBzZWxlY3Rpb24gPSBkb20uZ2V0V2luZG93KHRoaXMudHJlZUNvbnRhaW5lcikuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRpZiAoIXNlbGVjdGlvbiB8fCBzZWxlY3Rpb24udHlwZSAhPT0gJ1JhbmdlJyB8fCBsYXN0U2VsZWN0ZWRTdHJpbmcgPT09IHNlbGVjdGlvbi50b1N0cmluZygpKSB7XG5cdFx0XHRcdC8vIG9ubHkgZm9jdXMgdGhlIGlucHV0IGlmIHRoZSB1c2VyIGlzIG5vdCBjdXJyZW50bHkgc2VsZWN0aW5nIGFuZCBmaW5kIGlzbid0IG9wZW4uXG5cdFx0XHRcdHRoaXMucmVwbElucHV0LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0XHRsYXN0U2VsZWN0ZWRTdHJpbmcgPSBzZWxlY3Rpb24gPyBzZWxlY3Rpb24udG9TdHJpbmcoKSA6ICcnO1xuXHRcdH0pKTtcblx0XHQvLyBNYWtlIHN1cmUgdG8gc2VsZWN0IHRoZSBzZXNzaW9uIGlmIGRlYnVnZ2luZyBpcyBhbHJlYWR5IGFjdGl2ZVxuXHRcdHRoaXMuc2VsZWN0U2Vzc2lvbigpO1xuXHRcdHRoaXMuc3R5bGVFbGVtZW50ID0gZG9tU3R5bGVzaGVldHNKcy5jcmVhdGVTdHlsZVNoZWV0KHRoaXMuY29udGFpbmVyKTtcblx0XHR0aGlzLm9uRGlkU3R5bGVDaGFuZ2UoKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlUmVwbElucHV0KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLnJlcGxJbnB1dENvbnRhaW5lciA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCcucmVwbC1pbnB1dC13cmFwcGVyJykpO1xuXHRcdGRvbS5hcHBlbmQodGhpcy5yZXBsSW5wdXRDb250YWluZXIsICQoJy5yZXBsLWlucHV0LWNoZXZyb24nICsgVGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoZGVidWdDb25zb2xlRXZhbHVhdGlvblByb21wdCkpKTtcblxuXHRcdGNvbnN0IHsgaGlzdG9yeU5hdmlnYXRpb25CYWNrd2FyZHNFbmFibGVtZW50LCBoaXN0b3J5TmF2aWdhdGlvbkZvcndhcmRzRW5hYmxlbWVudCB9ID0gdGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBbmRDcmVhdGVIaXN0b3J5TmF2aWdhdGlvbkNvbnRleHQodGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZSwgdGhpcykpO1xuXHRcdHRoaXMuc2V0SGlzdG9yeU5hdmlnYXRpb25FbmFibGVtZW50ID0gZW5hYmxlZCA9PiB7XG5cdFx0XHRoaXN0b3J5TmF2aWdhdGlvbkJhY2t3YXJkc0VuYWJsZW1lbnQuc2V0KGVuYWJsZWQpO1xuXHRcdFx0aGlzdG9yeU5hdmlnYXRpb25Gb3J3YXJkc0VuYWJsZW1lbnQuc2V0KGVuYWJsZWQpO1xuXHRcdH07XG5cdFx0Q09OVEVYVF9JTl9ERUJVR19SRVBMLmJpbmRUbyh0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKS5zZXQodHJ1ZSk7XG5cblx0XHR0aGlzLnNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVDaGlsZChuZXcgU2VydmljZUNvbGxlY3Rpb24oW0lDb250ZXh0S2V5U2VydmljZSwgdGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZV0pKSk7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IGdldFNpbXBsZUVkaXRvck9wdGlvbnModGhpcy5jb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0b3B0aW9ucy5yZWFkT25seSA9IHRydWU7XG5cdFx0b3B0aW9ucy5zdWdnZXN0ID0geyBzaG93U3RhdHVzQmFyOiB0cnVlIH07XG5cdFx0Y29uc3QgY29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRGVidWdDb25maWd1cmF0aW9uPignZGVidWcnKTtcblx0XHRvcHRpb25zLmFjY2VwdFN1Z2dlc3Rpb25PbkVudGVyID0gY29uZmlnLmNvbnNvbGUuYWNjZXB0U3VnZ2VzdGlvbk9uRW50ZXIgPT09ICdvbicgPyAnb24nIDogJ29mZic7XG5cdFx0b3B0aW9ucy5hcmlhTGFiZWwgPSB0aGlzLmdldEFyaWFMYWJlbCgpO1xuXG5cdFx0dGhpcy5yZXBsSW5wdXQgPSB0aGlzLnNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvZGVFZGl0b3JXaWRnZXQsIHRoaXMucmVwbElucHV0Q29udGFpbmVyLCBvcHRpb25zLCBnZXRTaW1wbGVDb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucygpKTtcblxuXHRcdGxldCBsYXN0Q29udGVudEhlaWdodCA9IC0xO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucmVwbElucHV0Lm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KCgpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5yZXBsSW5wdXQuZ2V0TW9kZWwoKTtcblx0XHRcdHRoaXMuc2V0SGlzdG9yeU5hdmlnYXRpb25FbmFibGVtZW50KCEhbW9kZWwgJiYgbW9kZWwuZ2V0VmFsdWUoKSA9PT0gJycpO1xuXG5cdFx0XHRjb25zdCBjb250ZW50SGVpZ2h0ID0gdGhpcy5yZXBsSW5wdXQuZ2V0Q29udGVudEhlaWdodCgpO1xuXHRcdFx0aWYgKGNvbnRlbnRIZWlnaHQgIT09IGxhc3RDb250ZW50SGVpZ2h0KSB7XG5cdFx0XHRcdGxhc3RDb250ZW50SGVpZ2h0ID0gY29udGVudEhlaWdodDtcblx0XHRcdFx0aWYgKHRoaXMuYm9keUNvbnRlbnREaW1lbnNpb24pIHtcblx0XHRcdFx0XHR0aGlzLmxheW91dEJvZHlDb250ZW50KHRoaXMuYm9keUNvbnRlbnREaW1lbnNpb24uaGVpZ2h0LCB0aGlzLmJvZHlDb250ZW50RGltZW5zaW9uLndpZHRoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHQvLyBXZSBhZGQgdGhlIGlucHV0IGRlY29yYXRpb24gb25seSB3aGVuIHRoZSBmb2N1cyBpcyBpbiB0aGUgaW5wdXQgIzYxMTI2XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5yZXBsSW5wdXQub25EaWRGb2N1c0VkaXRvclRleHQoKCkgPT4gdGhpcy51cGRhdGVJbnB1dERlY29yYXRpb24oKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucmVwbElucHV0Lm9uRGlkQmx1ckVkaXRvclRleHQoKCkgPT4gdGhpcy51cGRhdGVJbnB1dERlY29yYXRpb24oKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMucmVwbElucHV0Q29udGFpbmVyLCBkb20uRXZlbnRUeXBlLkZPQ1VTLCAoKSA9PiB0aGlzLnJlcGxJbnB1dENvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdzeW50aGV0aWMtZm9jdXMnKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnJlcGxJbnB1dENvbnRhaW5lciwgZG9tLkV2ZW50VHlwZS5CTFVSLCAoKSA9PiB0aGlzLnJlcGxJbnB1dENvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdzeW50aGV0aWMtZm9jdXMnKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRBcmlhTGFiZWwoKTogc3RyaW5nIHtcblx0XHRsZXQgYXJpYUxhYmVsID0gbG9jYWxpemUoJ2RlYnVnQ29uc29sZScsIFwiRGVidWcgQ29uc29sZVwiKTtcblx0XHRpZiAoIXRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZC5EZWJ1ZykpIHtcblx0XHRcdHJldHVybiBhcmlhTGFiZWw7XG5cdFx0fVxuXHRcdGNvbnN0IGtleWJpbmRpbmcgPSB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoQWNjZXNzaWJpbGl0eUNvbW1hbmRJZC5PcGVuQWNjZXNzaWJpbGl0eUhlbHApPy5nZXRBcmlhTGFiZWwoKTtcblx0XHRpZiAoa2V5YmluZGluZykge1xuXHRcdFx0YXJpYUxhYmVsID0gbG9jYWxpemUoJ2NvbW1lbnRMYWJlbFdpdGhLZXliaW5kaW5nJywgXCJ7MH0sIHVzZSAoezF9KSBmb3IgYWNjZXNzaWJpbGl0eSBoZWxwXCIsIGFyaWFMYWJlbCwga2V5YmluZGluZyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFyaWFMYWJlbCA9IGxvY2FsaXplKCdjb21tZW50TGFiZWxXaXRoS2V5YmluZGluZ05vS2V5YmluZGluZycsIFwiezB9LCBydW4gdGhlIGNvbW1hbmQgT3BlbiBBY2Nlc3NpYmlsaXR5IEhlbHAgd2hpY2ggaXMgY3VycmVudGx5IG5vdCB0cmlnZ2VyYWJsZSB2aWEga2V5YmluZGluZy5cIiwgYXJpYUxhYmVsKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJpYUxhYmVsO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkNvbnRleHRNZW51KGU6IElUcmVlQ29udGV4dE1lbnVFdmVudDxJUmVwbEVsZW1lbnQ+KTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0aW9ucyA9IGdldEZsYXRDb250ZXh0TWVudUFjdGlvbnModGhpcy5tZW51LmdldEFjdGlvbnMoeyBhcmc6IGUuZWxlbWVudCwgc2hvdWxkRm9yd2FyZEFyZ3M6IGZhbHNlIH0pKTtcblx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBlLmFuY2hvcixcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IGFjdGlvbnMsXG5cdFx0XHRnZXRBY3Rpb25zQ29udGV4dDogKCkgPT4gZS5lbGVtZW50XG5cdFx0fSk7XG5cdH1cblxuXHQvLyAtLS0gVXBkYXRlXG5cblx0cHJpdmF0ZSByZWZyZXNoUmVwbEVsZW1lbnRzKG5vRGVsYXk6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy50cmVlICYmIHRoaXMuaXNWaXNpYmxlKCkpIHtcblx0XHRcdGlmICh0aGlzLnJlZnJlc2hTY2hlZHVsZXIuaXNTY2hlZHVsZWQoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMucmVmcmVzaFNjaGVkdWxlci5zY2hlZHVsZShub0RlbGF5ID8gMCA6IHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVJbnB1dERlY29yYXRpb24oKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnJlcGxJbnB1dCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlY29yYXRpb25zOiBJRGVjb3JhdGlvbk9wdGlvbnNbXSA9IFtdO1xuXHRcdGlmICh0aGlzLmlzUmVhZG9ubHkgJiYgdGhpcy5yZXBsSW5wdXQuaGFzVGV4dEZvY3VzKCkgJiYgIXRoaXMucmVwbElucHV0LmdldFZhbHVlKCkpIHtcblx0XHRcdGNvbnN0IHRyYW5zcGFyZW50Rm9yZWdyb3VuZCA9IHJlc29sdmVDb2xvclZhbHVlKGVkaXRvckZvcmVncm91bmQsIHRoaXMudGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKSk/LnRyYW5zcGFyZW50KDAuNCk7XG5cdFx0XHRkZWNvcmF0aW9ucy5wdXNoKHtcblx0XHRcdFx0cmFuZ2U6IHtcblx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDAsXG5cdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogMCxcblx0XHRcdFx0XHRzdGFydENvbHVtbjogMCxcblx0XHRcdFx0XHRlbmRDb2x1bW46IDFcblx0XHRcdFx0fSxcblx0XHRcdFx0cmVuZGVyT3B0aW9uczoge1xuXHRcdFx0XHRcdGFmdGVyOiB7XG5cdFx0XHRcdFx0XHRjb250ZW50VGV4dDogbG9jYWxpemUoJ3N0YXJ0RGVidWdGaXJzdCcsIFwiUGxlYXNlIHN0YXJ0IGEgZGVidWcgc2Vzc2lvbiB0byBldmFsdWF0ZSBleHByZXNzaW9uc1wiKSxcblx0XHRcdFx0XHRcdGNvbG9yOiB0cmFuc3BhcmVudEZvcmVncm91bmQgPyB0cmFuc3BhcmVudEZvcmVncm91bmQudG9TdHJpbmcoKSA6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5yZXBsSW5wdXQuc2V0RGVjb3JhdGlvbnNCeVR5cGUoJ3JlcGwtZGVjb3JhdGlvbicsIERFQ09SQVRJT05fS0VZLCBkZWNvcmF0aW9ucyk7XG5cdH1cblxuXHRvdmVycmlkZSBzYXZlU3RhdGUoKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVwbEhpc3RvcnkgPSB0aGlzLmhpc3RvcnkuZ2V0SGlzdG9yeSgpO1xuXHRcdGlmIChyZXBsSGlzdG9yeS5sZW5ndGgpIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoSElTVE9SWV9TVE9SQUdFX0tFWSwgSlNPTi5zdHJpbmdpZnkocmVwbEhpc3RvcnkpLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShISVNUT1JZX1NUT1JBR0VfS0VZLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0XHR9XG5cdFx0Y29uc3QgZmlsdGVySGlzdG9yeSA9IHRoaXMuZmlsdGVyV2lkZ2V0LmdldEhpc3RvcnkoKTtcblx0XHRpZiAoZmlsdGVySGlzdG9yeS5sZW5ndGgpIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoRklMVEVSX0hJU1RPUllfU1RPUkFHRV9LRVksIEpTT04uc3RyaW5naWZ5KGZpbHRlckhpc3RvcnkpLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShGSUxURVJfSElTVE9SWV9TVE9SQUdFX0tFWSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdFx0fVxuXHRcdGNvbnN0IGZpbHRlclZhbHVlID0gdGhpcy5maWx0ZXJXaWRnZXQuZ2V0RmlsdGVyVGV4dCgpO1xuXHRcdGlmIChmaWx0ZXJWYWx1ZSkge1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShGSUxURVJfVkFMVUVfU1RPUkFHRV9LRVksIGZpbHRlclZhbHVlLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShGSUxURVJfVkFMVUVfU1RPUkFHRV9LRVksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXHRcdH1cblxuXHRcdHN1cGVyLnNhdmVTdGF0ZSgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLnJlcGxJbnB1dD8uZGlzcG9zZSgpOyAvLyBEaXNwb3NlZCBiZWZvcmUgcmVuZGVyZWQ/ICMxNzQ1NThcblx0XHR0aGlzLnJlcGxFbGVtZW50c0NoYW5nZUxpc3RlbmVyPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5yZWZyZXNoU2NoZWR1bGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLm1vZGVsQ2hhbmdlTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBSZXBsT3B0aW9ucyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJUmVwbE9wdGlvbnMge1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBsaW5lSGVpZ2h0RW0gPSAxLjQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2UgPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIF9yZXBsQ29uZmlnITogSVJlcGxDb25maWd1cmF0aW9uO1xuXHRwdWJsaWMgZ2V0IHJlcGxDb25maWd1cmF0aW9uKCk6IElSZXBsQ29uZmlndXJhdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlcGxDb25maWc7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR2aWV3SWQ6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGJhY2tncm91bmRDb2xvckRlbGVnYXRlOiAoKSA9PiBzdHJpbmcsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudGhlbWVTZXJ2aWNlLm9uRGlkQ29sb3JUaGVtZUNoYW5nZShlID0+IHRoaXMudXBkYXRlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5vbkRpZENoYW5nZUxvY2F0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUudmlld3Muc29tZSh2ID0+IHYuaWQgPT09IHZpZXdJZCkpIHtcblx0XHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZGVidWcuY29uc29sZS5saW5lSGVpZ2h0JykgfHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZGVidWcuY29uc29sZS5mb250U2l6ZScpIHx8IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2RlYnVnLmNvbnNvbGUuZm9udEZhbWlseScpKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZSgpIHtcblx0XHRjb25zdCBkZWJ1Z0NvbnNvbGUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElEZWJ1Z0NvbmZpZ3VyYXRpb24+KCdkZWJ1ZycpLmNvbnNvbGU7XG5cdFx0dGhpcy5fcmVwbENvbmZpZyA9IHtcblx0XHRcdGZvbnRTaXplOiBkZWJ1Z0NvbnNvbGUuZm9udFNpemUsXG5cdFx0XHRmb250RmFtaWx5OiBkZWJ1Z0NvbnNvbGUuZm9udEZhbWlseSxcblx0XHRcdGxpbmVIZWlnaHQ6IGRlYnVnQ29uc29sZS5saW5lSGVpZ2h0ID8gZGVidWdDb25zb2xlLmxpbmVIZWlnaHQgOiBSZXBsT3B0aW9ucy5saW5lSGVpZ2h0RW0gKiBkZWJ1Z0NvbnNvbGUuZm9udFNpemUsXG5cdFx0XHRjc3NMaW5lSGVpZ2h0OiBkZWJ1Z0NvbnNvbGUubGluZUhlaWdodCA/IGAke2RlYnVnQ29uc29sZS5saW5lSGVpZ2h0fXB4YCA6IGAke1JlcGxPcHRpb25zLmxpbmVIZWlnaHRFbX1lbWAsXG5cdFx0XHRiYWNrZ3JvdW5kQ29sb3I6IHRoaXMudGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKS5nZXRDb2xvcih0aGlzLmJhY2tncm91bmRDb2xvckRlbGVnYXRlKCkpLFxuXHRcdFx0Zm9udFNpemVGb3JUd2lzdGllOiBkZWJ1Z0NvbnNvbGUuZm9udFNpemUgKiBSZXBsT3B0aW9ucy5saW5lSGVpZ2h0RW0gLyAyIC0gOFxuXHRcdH07XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSgpO1xuXHR9XG59XG5cbi8vIFJlcGwgYWN0aW9ucyBhbmQgY29tbWFuZHNcblxuY2xhc3MgQWNjZXB0UmVwbElucHV0QWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3JlcGwuYWN0aW9uLmFjY2VwdElucHV0Jyxcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZTIoeyBrZXk6ICdhY3Rpb25zLnJlcGwuYWNjZXB0SW5wdXQnLCBjb21tZW50OiBbJ0FwcGx5IGlucHV0IGZyb20gdGhlIGRlYnVnIGNvbnNvbGUgaW5wdXQgYm94J10gfSwgXCJEZWJ1ZyBDb25zb2xlOiBBY2NlcHQgSW5wdXRcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfSU5fREVCVUdfUkVQTCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVudGVyLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB8IFByb21pc2U8dm9pZD4ge1xuXHRcdFN1Z2dlc3RDb250cm9sbGVyLmdldChlZGl0b3IpPy5jYW5jZWxTdWdnZXN0V2lkZ2V0KCk7XG5cdFx0Y29uc3QgcmVwbCA9IGdldFJlcGxWaWV3KGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKSk7XG5cdFx0cmVwbD8uYWNjZXB0UmVwbElucHV0KCk7XG5cdH1cbn1cblxuY2xhc3MgRmlsdGVyUmVwbEFjdGlvbiBleHRlbmRzIFZpZXdBY3Rpb248UmVwbD4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdHZpZXdJZDogUkVQTF9WSUVXX0lELFxuXHRcdFx0aWQ6ICdyZXBsLmFjdGlvbi5maWx0ZXInLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdyZXBsLmFjdGlvbi5maWx0ZXInLCBcIkRlYnVnIENvbnNvbGU6IEZvY3VzIEZpbHRlclwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9JTl9ERUJVR19SRVBMLFxuXHRcdFx0a2V5YmluZGluZzogW3tcblx0XHRcdFx0d2hlbjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlGLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bkluVmlldyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgcmVwbDogUmVwbCk6IHZvaWQgfCBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXBsLmZvY3VzRmlsdGVyKCk7XG5cdH1cbn1cblxuXG5jbGFzcyBGaW5kUmVwbEFjdGlvbiBleHRlbmRzIFZpZXdBY3Rpb248UmVwbD4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdHZpZXdJZDogUkVQTF9WSUVXX0lELFxuXHRcdFx0aWQ6ICdyZXBsLmFjdGlvbi5maW5kJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgncmVwbC5hY3Rpb24uZmluZCcsIFwiRGVidWcgQ29uc29sZTogRm9jdXMgRmluZFwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9JTl9ERUJVR19SRVBMLFxuXHRcdFx0a2V5YmluZGluZzogW3tcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoQ09OVEVYVF9JTl9ERUJVR19SRVBMLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2ZvY3VzZWRWaWV3JywgJ3dvcmtiZW5jaC5wYW5lbC5yZXBsLnZpZXcnKSksXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuS2V5Rixcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1dLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5zZWFyY2gsXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgUkVQTF9WSUVXX0lEKSxcblx0XHRcdFx0b3JkZXI6IDE1XG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRGVidWdDb25zb2xlQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICd6X2NvbW1hbmRzJyxcblx0XHRcdFx0b3JkZXI6IDI1XG5cdFx0XHR9XSxcblx0XHR9KTtcblx0fVxuXG5cdHJ1bkluVmlldyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdmlldzogUmVwbCk6IHZvaWQgfCBQcm9taXNlPHZvaWQ+IHtcblx0XHR2aWV3Lm9wZW5GaW5kKCk7XG5cdH1cbn1cblxuY2xhc3MgUmVwbENvcHlBbGxBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAncmVwbC5hY3Rpb24uY29weUFsbCcsXG5cdFx0XHRsYWJlbDogbG9jYWxpemUoJ2FjdGlvbnMucmVwbC5jb3B5QWxsJywgXCJEZWJ1ZzogQ29uc29sZSBDb3B5IEFsbFwiKSxcblx0XHRcdGFsaWFzOiAnRGVidWcgQ29uc29sZSBDb3B5IEFsbCcsXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfSU5fREVCVUdfUkVQTCxcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQgfCBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjbGlwYm9hcmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDbGlwYm9hcmRTZXJ2aWNlKTtcblx0XHRjb25zdCByZXBsID0gZ2V0UmVwbFZpZXcoYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpKTtcblx0XHRpZiAocmVwbCkge1xuXHRcdFx0cmV0dXJuIGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KHJlcGwuZ2V0VmlzaWJsZUNvbnRlbnQoKSk7XG5cdFx0fVxuXHR9XG59XG5cbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEFjY2VwdFJlcGxJbnB1dEFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihSZXBsQ29weUFsbEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoRmlsdGVyUmVwbEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoRmluZFJlcGxBY3Rpb24pO1xuXG5jbGFzcyBTZWxlY3RSZXBsQWN0aW9uVmlld0l0ZW0gZXh0ZW5kcyBGb2N1c1Nlc3Npb25BY3Rpb25WaWV3SXRlbSB7XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldFNlc3Npb25zKCk6IFJlYWRvbmx5QXJyYXk8SURlYnVnU2Vzc2lvbj4ge1xuXHRcdHJldHVybiB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldFNlc3Npb25zKHRydWUpLmZpbHRlcihzID0+IHMuaGFzU2VwYXJhdGVSZXBsKCkgJiYgIXNlc3Npb25zVG9JZ25vcmUuaGFzKHMpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBtYXBGb2N1c2VkU2Vzc2lvblRvU2VsZWN0ZWQoZm9jdXNlZFNlc3Npb246IElEZWJ1Z1Nlc3Npb24pOiBJRGVidWdTZXNzaW9uIHtcblx0XHR3aGlsZSAoZm9jdXNlZFNlc3Npb24ucGFyZW50U2Vzc2lvbiAmJiAhZm9jdXNlZFNlc3Npb24uaGFzU2VwYXJhdGVSZXBsKCkpIHtcblx0XHRcdGZvY3VzZWRTZXNzaW9uID0gZm9jdXNlZFNlc3Npb24ucGFyZW50U2Vzc2lvbjtcblx0XHR9XG5cdFx0cmV0dXJuIGZvY3VzZWRTZXNzaW9uO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZXBsVmlldyh2aWV3c1NlcnZpY2U6IElWaWV3c1NlcnZpY2UpOiBSZXBsIHwgdW5kZWZpbmVkIHtcblx0cmV0dXJuIHZpZXdzU2VydmljZS5nZXRBY3RpdmVWaWV3V2l0aElkKFJFUExfVklFV19JRCkgYXMgUmVwbCA/PyB1bmRlZmluZWQ7XG59XG5cbmNvbnN0IHNlbGVjdFJlcGxDb21tYW5kSWQgPSAnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5zZWxlY3RSZXBsJztcbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIFZpZXdBY3Rpb248UmVwbD4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogc2VsZWN0UmVwbENvbW1hbmRJZCxcblx0XHRcdHZpZXdJZDogUkVQTF9WSUVXX0lELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzZWxlY3RSZXBsJywgXCJTZWxlY3QgRGVidWcgQ29uc29sZVwiKSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBSRVBMX1ZJRVdfSUQpLCBDT05URVhUX01VTFRJX1NFU1NJT05fUkVQTCksXG5cdFx0XHRcdG9yZGVyOiAyMFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuSW5WaWV3KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3OiBSZXBsLCBzZXNzaW9uOiBJRGVidWdTZXNzaW9uIHwgdW5kZWZpbmVkKSB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdC8vIElmIHNlc3Npb24gaXMgYWxyZWFkeSB0aGUgZm9jdXNlZCBzZXNzaW9uIHdlIG5lZWQgdG8gbWFudWFseSB1cGRhdGUgdGhlIHRyZWUgc2luY2UgdmlldyBtb2RlbCB3aWxsIG5vdCBzZW5kIGEgZm9jdXNlZCBjaGFuZ2UgZXZlbnRcblx0XHRpZiAoc2Vzc2lvbiAmJiBzZXNzaW9uLnN0YXRlICE9PSBTdGF0ZS5JbmFjdGl2ZSAmJiBzZXNzaW9uICE9PSBkZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFNlc3Npb24pIHtcblx0XHRcdGlmIChzZXNzaW9uLnN0YXRlICE9PSBTdGF0ZS5TdG9wcGVkKSB7XG5cdFx0XHRcdC8vIEZvY3VzIGNoaWxkIHNlc3Npb24gaW5zdGVhZCBpZiBpdCBpcyBzdG9wcGVkICMxMTI1OTVcblx0XHRcdFx0Y29uc3Qgc3RvcHBwZWRDaGlsZFNlc3Npb24gPSBkZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRTZXNzaW9ucygpLmZpbmQocyA9PiBzLnBhcmVudFNlc3Npb24gPT09IHNlc3Npb24gJiYgcy5zdGF0ZSA9PT0gU3RhdGUuU3RvcHBlZCk7XG5cdFx0XHRcdGlmIChzdG9wcHBlZENoaWxkU2Vzc2lvbikge1xuXHRcdFx0XHRcdHNlc3Npb24gPSBzdG9wcHBlZENoaWxkU2Vzc2lvbjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0YXdhaXQgZGVidWdTZXJ2aWNlLmZvY3VzU3RhY2tGcmFtZSh1bmRlZmluZWQsIHVuZGVmaW5lZCwgc2Vzc2lvbiwgeyBleHBsaWNpdDogdHJ1ZSB9KTtcblx0XHR9XG5cdFx0Ly8gTmVlZCB0byBzZWxlY3QgdGhlIHNlc3Npb24gaW4gdGhlIHZpZXcgc2luY2UgdGhlIGZvY3Vzc2VkIHNlc3Npb24gbWlnaHQgbm90IGhhdmUgY2hhbmdlZFxuXHRcdGF3YWl0IHZpZXcuc2VsZWN0U2Vzc2lvbihzZXNzaW9uKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIFZpZXdBY3Rpb248UmVwbD4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5kZWJ1Zy5wYW5lbC5hY3Rpb24uY2xlYXJSZXBsQWN0aW9uJyxcblx0XHRcdHZpZXdJZDogUkVQTF9WSUVXX0lELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignY2xlYXJSZXBsJywgJ0NsZWFyIENvbnNvbGUnKSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZTIoJ2NsZWFyUmVwbC5kZXNjcmlvdGlvbicsICdDbGVhcnMgYWxsIHByb2dyYW0gb3V0cHV0IGZyb20geW91ciBkZWJ1ZyBSRVBMJylcblx0XHRcdH0sXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGljb246IGRlYnVnQ29uc29sZUNsZWFyQWxsLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIFJFUExfVklFV19JRCksXG5cdFx0XHRcdG9yZGVyOiAzMFxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLkRlYnVnQ29uc29sZUNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnel9jb21tYW5kcycsXG5cdFx0XHRcdG9yZGVyOiAyMFxuXHRcdFx0fV0sXG5cdFx0XHRrZXliaW5kaW5nOiBbe1xuXHRcdFx0XHRwcmltYXJ5OiAwLFxuXHRcdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUsgfSxcblx0XHRcdFx0Ly8gV2VpZ2h0IGlzIGhpZ2hlciB0aGFuIHdvcmsgd29ya2JlbmNoIGNvbnRyaWJ1dGlvbnMgc28gdGhlIGtleWJpbmRpbmcgcmVtYWluc1xuXHRcdFx0XHQvLyBoaWdoZXN0IHByaW9yaXR5IHdoZW4gY2hvcmRzIGFyZSByZWdpc3RlcmVkIGFmdGVyd2FyZHNcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAxLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2ZvY3VzZWRWaWV3JywgJ3dvcmtiZW5jaC5wYW5lbC5yZXBsLnZpZXcnKVxuXHRcdFx0fV0sXG5cdFx0fSk7XG5cdH1cblxuXHRydW5JblZpZXcoX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3OiBSZXBsKTogdm9pZCB7XG5cdFx0Y29uc3QgYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UgPSBfYWNjZXNzb3IuZ2V0KElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSk7XG5cdFx0dmlldy5jbGVhclJlcGwoKTtcblx0XHRhY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5wbGF5U2lnbmFsKEFjY2Vzc2liaWxpdHlTaWduYWwuY2xlYXIpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxSZXBsPiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZGVidWcuY29sbGFwc2VSZXBsJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnY29sbGFwc2UnLCBcIkNvbGxhcHNlIEFsbFwiKSxcblx0XHRcdHZpZXdJZDogUkVQTF9WSUVXX0lELFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkRlYnVnQ29uc29sZUNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnel9jb21tYW5kcycsXG5cdFx0XHRcdG9yZGVyOiAxMFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuSW5WaWV3KF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdmlldzogUmVwbCk6IHZvaWQge1xuXHRcdHZpZXcuY29sbGFwc2VBbGwoKTtcblx0XHR2aWV3LmZvY3VzKCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBWaWV3QWN0aW9uPFJlcGw+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdkZWJ1Zy5yZXBsUGFzdGUnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdwYXN0ZScsIFwiUGFzdGVcIiksXG5cdFx0XHR2aWV3SWQ6IFJFUExfVklFV19JRCxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9ERUJVR19TVEFURS5ub3RFcXVhbHNUbyhnZXRTdGF0ZUxhYmVsKFN0YXRlLkluYWN0aXZlKSksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRGVidWdDb25zb2xlQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICcyX2N1dGNvcHlwYXN0ZScsXG5cdFx0XHRcdG9yZGVyOiAzMFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuSW5WaWV3KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3OiBSZXBsKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY2xpcGJvYXJkU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2xpcGJvYXJkU2VydmljZSk7XG5cdFx0Y29uc3QgY2xpcGJvYXJkVGV4dCA9IGF3YWl0IGNsaXBib2FyZFNlcnZpY2UucmVhZFRleHQoKTtcblx0XHRpZiAoY2xpcGJvYXJkVGV4dCkge1xuXHRcdFx0Y29uc3QgcmVwbElucHV0ID0gdmlldy5nZXRSZXBsSW5wdXQoKTtcblx0XHRcdHJlcGxJbnB1dC5zZXRWYWx1ZShyZXBsSW5wdXQuZ2V0VmFsdWUoKS5jb25jYXQoY2xpcGJvYXJkVGV4dCkpO1xuXHRcdFx0dmlldy5mb2N1cygpO1xuXHRcdFx0Y29uc3QgbW9kZWwgPSByZXBsSW5wdXQuZ2V0TW9kZWwoKTtcblx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBtb2RlbCA/IG1vZGVsLmdldExpbmVDb3VudCgpIDogMDtcblx0XHRcdGNvbnN0IGNvbHVtbiA9IG1vZGVsPy5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpO1xuXHRcdFx0aWYgKHR5cGVvZiBsaW5lTnVtYmVyID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgY29sdW1uID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRyZXBsSW5wdXQuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyLCBjb2x1bW4gfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxSZXBsPiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmRlYnVnLmFjdGlvbi5jb3B5QWxsJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnY29weUFsbCcsIFwiQ29weSBBbGxcIiksXG5cdFx0XHR2aWV3SWQ6IFJFUExfVklFV19JRCxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5EZWJ1Z0NvbnNvbGVDb250ZXh0LFxuXHRcdFx0XHRncm91cDogJzJfY3V0Y29weXBhc3RlJyxcblx0XHRcdFx0b3JkZXI6IDIwXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5JblZpZXcoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IFJlcGwpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjbGlwYm9hcmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDbGlwYm9hcmRTZXJ2aWNlKTtcblx0XHRhd2FpdCBjbGlwYm9hcmRTZXJ2aWNlLndyaXRlVGV4dCh2aWV3LmdldFZpc2libGVDb250ZW50KCkpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZGVidWcucmVwbENvcHknLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjb3B5JywgXCJDb3B5XCIpLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkRlYnVnQ29uc29sZUNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnMl9jdXRjb3B5cGFzdGUnLFxuXHRcdFx0XHRvcmRlcjogMTBcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWxlbWVudDogSVJlcGxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY2xpcGJvYXJkU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2xpcGJvYXJkU2VydmljZSk7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGNvbnN0IG5hdGl2ZVNlbGVjdGlvbiA9IGRvbS5nZXRBY3RpdmVXaW5kb3coKS5nZXRTZWxlY3Rpb24oKTtcblx0XHRjb25zdCBzZWxlY3RlZFRleHQgPSBuYXRpdmVTZWxlY3Rpb24/LnRvU3RyaW5nKCk7XG5cdFx0aWYgKHNlbGVjdGVkVGV4dCAmJiBzZWxlY3RlZFRleHQubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuIGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KHNlbGVjdGVkVGV4dCk7XG5cdFx0fSBlbHNlIGlmIChlbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQoYXdhaXQgdGhpcy50cnlFdmFsdWF0ZUFuZENvcHkoZGVidWdTZXJ2aWNlLCBlbGVtZW50KSB8fCBlbGVtZW50LnRvU3RyaW5nKCkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdHJ5RXZhbHVhdGVBbmRDb3B5KGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSwgZWxlbWVudDogSVJlcGxFbGVtZW50KTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHQvLyB0b2RvOiB3ZSBzaG91bGQgZXhwYW5kIERBUCB0byBhbGxvdyBjb3B5aW5nIG1vcmUgdHlwZXMgaGVyZSAoIzE4Nzc4NClcblx0XHRpZiAoIShlbGVtZW50IGluc3RhbmNlb2YgUmVwbEV2YWx1YXRpb25SZXN1bHQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhY2tGcmFtZSA9IGRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU3RhY2tGcmFtZTtcblx0XHRjb25zdCBzZXNzaW9uID0gZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTZXNzaW9uO1xuXHRcdGlmICghc3RhY2tGcmFtZSB8fCAhc2Vzc2lvbiB8fCAhc2Vzc2lvbi5jYXBhYmlsaXRpZXMuc3VwcG9ydHNDbGlwYm9hcmRDb250ZXh0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGV2YWx1YXRpb24gPSBhd2FpdCBzZXNzaW9uLmV2YWx1YXRlKGVsZW1lbnQub3JpZ2luYWxFeHByZXNzaW9uLCBzdGFja0ZyYW1lLmZyYW1lSWQsICdjbGlwYm9hcmQnKTtcblx0XHRcdHJldHVybiBldmFsdWF0aW9uPy5ib2R5LnJlc3VsdDtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBGT0NVU19SRVBMX0lELFxuXHRcdFx0Y2F0ZWdvcnk6IERFQlVHX0NPTU1BTkRfQ0FURUdPUlksXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKHsgY29tbWVudDogWydEZWJ1ZyBpcyBhIG5vdW4gaW4gdGhpcyBjb250ZXh0LCBub3QgYSB2ZXJiLiddLCBrZXk6ICdkZWJ1Z0ZvY3VzQ29uc29sZScgfSwgXCJGb2N1cyBvbiBEZWJ1ZyBDb25zb2xlIFZpZXdcIiksXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCB2aWV3c1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdFx0Y29uc3QgcmVwbCA9IGF3YWl0IHZpZXdzU2VydmljZS5vcGVuVmlldzxSZXBsPihSRVBMX1ZJRVdfSUQpO1xuXHRcdGF3YWl0IHJlcGw/LmZvY3VzKCk7XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsWUFBWSxzQkFBc0I7QUFHbEMsWUFBWSxVQUFVO0FBQ3RCLFNBQVMsd0NBQXdDO0FBR2pELFNBQVMsa0JBQWtCLGVBQWU7QUFFMUMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWU7QUFFeEIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxTQUFTLGNBQWM7QUFDaEMsU0FBUyxrQkFBK0I7QUFDeEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxP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
