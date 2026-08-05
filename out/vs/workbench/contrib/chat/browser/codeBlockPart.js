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
import "./codeBlockPart.css";
import * as dom from "../../../../base/browser/dom.js";
import { renderFormattedText } from "../../../../base/browser/formattedTextRenderer.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { combinedDisposable, Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { isEqual } from "../../../../base/common/resources.js";
import { assertType } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { EditorExtensionsRegistry } from "../../../../editor/browser/editorExtensions.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { DiffEditorWidget } from "../../../../editor/browser/widget/diffEditor/diffEditorWidget.js";
import { EDITOR_FONT_DEFAULTS, EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ScrollType } from "../../../../editor/common/editorCommon.js";
import { TextEdit } from "../../../../editor/common/languages.js";
import { EndOfLinePreference } from "../../../../editor/common/model.js";
import { TextModelText } from "../../../../editor/common/model/textModelText.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { DefaultModelSHA1Computer } from "../../../../editor/common/services/modelService.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { BracketMatchingController } from "../../../../editor/contrib/bracketMatching/browser/bracketMatching.js";
import { ColorDetector } from "../../../../editor/contrib/colorPicker/browser/colorDetector.js";
import { ContextMenuController } from "../../../../editor/contrib/contextmenu/browser/contextmenu.js";
import { GotoDefinitionAtPositionEditorContribution } from "../../../../editor/contrib/gotoSymbol/browser/link/goToDefinitionAtPosition.js";
import { ContentHoverController } from "../../../../editor/contrib/hover/browser/contentHoverController.js";
import { GlyphHoverController } from "../../../../editor/contrib/hover/browser/glyphHoverController.js";
import { LinkDetector } from "../../../../editor/contrib/links/browser/links.js";
import { MessageController } from "../../../../editor/contrib/message/browser/messageController.js";
import { ViewportSemanticTokensContribution } from "../../../../editor/contrib/semanticTokens/browser/viewportSemanticTokens.js";
import { SmartSelectController } from "../../../../editor/contrib/smartSelect/browser/smartSelect.js";
import { WordHighlighterContribution } from "../../../../editor/contrib/wordHighlighter/browser/wordHighlighter.js";
import { localize } from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { FileKind } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ResourceLabel } from "../../../browser/labels.js";
import { ResourceContextKey } from "../../../common/contextkeys.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { InspectEditorTokensController } from "../../codeEditor/browser/inspectEditorTokens/inspectEditorTokens.js";
import { MenuPreventer } from "../../codeEditor/browser/menuPreventer.js";
import { SelectionClipboardContributionID } from "../../codeEditor/browser/selectionClipboard.js";
import { getSimpleEditorOptions } from "../../codeEditor/browser/simpleEditorOptions.js";
import { ChatContextKeys } from "../common/chatContextKeys.js";
import { isResponseVM } from "../common/chatViewModel.js";
import { emptyProgressRunner, IEditorProgressService } from "../../../../platform/progress/common/progress.js";
import { SuggestController } from "../../../../editor/contrib/suggest/browser/suggestController.js";
import { SnippetController2 } from "../../../../editor/contrib/snippet/browser/snippetController2.js";
const $ = dom.$;
const localFileLanguageId = "vscode-local-file";
function parseLocalFileData(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error("Could not parse code block local file data");
  }
  let uri;
  try {
    uri = URI.revive(data?.uri);
  } catch (e) {
    throw new Error("Invalid code block local file data URI");
  }
  let range;
  if (data.range) {
    range = new Range(data.range.startLineNumber + 1, data.range.startColumn + 1, data.range.endLineNumber + 1, data.range.endColumn + 1);
  }
  return { uri, range };
}
const defaultCodeblockPadding = 10;
let CodeBlockPart = class extends Disposable {
  constructor(editorOptions, menuId, delegate, overflowWidgetsDomNode, instantiationService, contextKeyService, modelService, configurationService, accessibilityService) {
    super();
    this.editorOptions = editorOptions;
    this.menuId = menuId;
    this.modelService = modelService;
    this.configurationService = configurationService;
    this.accessibilityService = accessibilityService;
    this._onDidChangeContentHeight = this._register(new Emitter());
    this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
    this.currentScrollWidth = 0;
    this.isDisposed = false;
    this.element = $(".interactive-result-code-block");
    this.resourceContextKey = this._register(instantiationService.createInstance(ResourceContextKey));
    this.contextKeyService = this._register(contextKeyService.createScoped(this.element));
    const scopedInstantiationService = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, this.contextKeyService])));
    const editorElement = dom.append(this.element, $(".interactive-result-editor"));
    this.editor = this.createEditor(scopedInstantiationService, editorElement, {
      ...getSimpleEditorOptions(this.configurationService),
      readOnly: true,
      lineNumbers: "off",
      selectOnLineNumbers: true,
      scrollBeyondLastLine: false,
      lineDecorationsWidth: 8,
      dragAndDrop: false,
      padding: { top: this.verticalPadding, bottom: this.verticalPadding },
      mouseWheelZoom: false,
      scrollbar: {
        vertical: "hidden",
        alwaysConsumeMouseWheel: false
      },
      definitionLinkOpensInPeek: false,
      gotoLocation: {
        multiple: "goto",
        multipleDeclarations: "goto",
        multipleDefinitions: "goto",
        multipleImplementations: "goto"
      },
      ariaLabel: localize("chat.codeBlockHelp", "Code block"),
      overflowWidgetsDomNode,
      ...this.getEditorOptionsFromConfig()
    });
    const toolbarElement = dom.append(this.element, $(".interactive-result-code-block-toolbar"));
    const editorScopedService = this.editor.contextKeyService.createScoped(toolbarElement);
    const editorScopedInstantiationService = this._register(scopedInstantiationService.createChild(new ServiceCollection([IContextKeyService, editorScopedService])));
    this.toolbar = this._register(editorScopedInstantiationService.createInstance(MenuWorkbenchToolBar, toolbarElement, menuId, {
      menuOptions: {
        shouldForwardArgs: true
      }
    }));
    const vulnsContainer = dom.append(this.element, $(".interactive-result-vulns"));
    const vulnsHeaderElement = dom.append(vulnsContainer, $(".interactive-result-vulns-header", void 0));
    this.vulnsButton = this._register(new Button(vulnsHeaderElement, {
      buttonBackground: void 0,
      buttonBorder: void 0,
      buttonForeground: void 0,
      buttonHoverBackground: void 0,
      buttonSecondaryBackground: void 0,
      buttonSecondaryForeground: void 0,
      buttonSecondaryHoverBackground: void 0,
      buttonSeparator: void 0,
      supportIcons: true
    }));
    this.vulnsListElement = dom.append(vulnsContainer, $("ul.interactive-result-vulns-list"));
    this._register(this.vulnsButton.onDidClick(() => {
      const element = this.currentCodeBlockData.element;
      element.vulnerabilitiesListExpanded = !element.vulnerabilitiesListExpanded;
      this.vulnsButton.label = this.getVulnerabilitiesLabel();
      this.element.classList.toggle("chat-vulnerabilities-collapsed", !element.vulnerabilitiesListExpanded);
      this._onDidChangeContentHeight.fire();
    }));
    this._register(this.toolbar.onDidChangeDropdownVisibility((e) => {
      toolbarElement.classList.toggle("force-visibility", e);
    }));
    this._configureForScreenReader();
    this._register(this.accessibilityService.onDidChangeScreenReaderOptimized(() => this._configureForScreenReader()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectedKeys.has(AccessibilityVerbositySettingId.Chat)) {
        this._configureForScreenReader();
      }
    }));
    this._register(this.editorOptions.onDidChange(() => {
      this.editor.updateOptions(this.getEditorOptionsFromConfig());
    }));
    this._register(this.editor.onDidScrollChange((e) => {
      this.currentScrollWidth = e.scrollWidth;
    }));
    this._register(this.editor.onDidContentSizeChange((e) => {
      if (e.contentHeightChanged) {
        this._onDidChangeContentHeight.fire();
      }
    }));
    this._register(this.editor.onDidBlurEditorWidget(() => {
      this.element.classList.remove("focused");
      WordHighlighterContribution.get(this.editor)?.stopHighlighting();
      this.clearWidgets();
    }));
    this._register(this.editor.onDidFocusEditorWidget(() => {
      this.element.classList.add("focused");
      WordHighlighterContribution.get(this.editor)?.restoreViewState(true);
    }));
    if (delegate.onDidScroll) {
      this._register(delegate.onDidScroll((e) => {
        this.clearWidgets();
      }));
    }
  }
  get verticalPadding() {
    return this.currentCodeBlockData?.renderOptions?.verticalPadding ?? defaultCodeblockPadding;
  }
  dispose() {
    this.isDisposed = true;
    super.dispose();
  }
  get uri() {
    return this.editor.getModel()?.uri;
  }
  createEditor(instantiationService, parent, options) {
    return this._register(instantiationService.createInstance(CodeEditorWidget, parent, options, {
      isSimpleWidget: false,
      contributions: EditorExtensionsRegistry.getSomeEditorContributions([
        MenuPreventer.ID,
        SelectionClipboardContributionID,
        ContextMenuController.ID,
        WordHighlighterContribution.ID,
        ViewportSemanticTokensContribution.ID,
        BracketMatchingController.ID,
        SmartSelectController.ID,
        ContentHoverController.ID,
        GlyphHoverController.ID,
        MessageController.ID,
        GotoDefinitionAtPositionEditorContribution.ID,
        SuggestController.ID,
        SnippetController2.ID,
        ColorDetector.ID,
        LinkDetector.ID,
        InspectEditorTokensController.ID
      ])
    }));
  }
  focus() {
    this.editor.focus();
  }
  updatePaddingForLayout() {
    const horizontalScrollbarVisible = this.currentScrollWidth > this.editor.getLayoutInfo().contentWidth;
    const scrollbarHeight = this.editor.getLayoutInfo().horizontalScrollbarHeight;
    const bottomPadding = horizontalScrollbarVisible ? Math.max(this.verticalPadding - scrollbarHeight, 2) : this.verticalPadding;
    this.editor.updateOptions({ padding: { top: this.verticalPadding, bottom: bottomPadding } });
  }
  _configureForScreenReader() {
    const toolbarElt = this.toolbar.getElement();
    if (this.accessibilityService.isScreenReaderOptimized()) {
      toolbarElt.style.display = "block";
      toolbarElt.ariaLabel = this.configurationService.getValue(AccessibilityVerbositySettingId.Chat) ? localize("chat.codeBlock.toolbarVerbose", "Toolbar for code block which can be reached via tab") : localize("chat.codeBlock.toolbar", "Code block toolbar");
    } else {
      toolbarElt.style.display = "";
    }
  }
  getEditorOptionsFromConfig() {
    return {
      wordWrap: this.editorOptions.configuration.resultEditor.wordWrap,
      fontLigatures: this.editorOptions.configuration.resultEditor.fontLigatures,
      bracketPairColorization: this.editorOptions.configuration.resultEditor.bracketPairColorization,
      fontFamily: this.editorOptions.configuration.resultEditor.fontFamily === "default" ? EDITOR_FONT_DEFAULTS.fontFamily : this.editorOptions.configuration.resultEditor.fontFamily,
      fontSize: this.editorOptions.configuration.resultEditor.fontSize,
      fontWeight: this.editorOptions.configuration.resultEditor.fontWeight,
      lineHeight: this.editorOptions.configuration.resultEditor.lineHeight,
      ...this.currentCodeBlockData?.renderOptions?.editorOptions
    };
  }
  layout(width) {
    const contentHeight = this.getContentHeight();
    let height = contentHeight;
    if (this.currentCodeBlockData?.renderOptions?.maxHeightInLines) {
      height = Math.min(contentHeight, this.editor.getOption(EditorOption.lineHeight) * this.currentCodeBlockData?.renderOptions?.maxHeightInLines);
    }
    const editorBorder = 2;
    width = width - editorBorder - (this.currentCodeBlockData?.renderOptions?.reserveWidth ?? 0);
    this.editor.layout({ width, height });
    this.updatePaddingForLayout();
  }
  getContentHeight() {
    if (this.currentCodeBlockData?.range) {
      const lineCount = this.currentCodeBlockData.range.endLineNumber - this.currentCodeBlockData.range.startLineNumber + 1;
      const lineHeight = this.editor.getOption(EditorOption.lineHeight);
      return lineCount * lineHeight;
    }
    return this.editor.getContentHeight();
  }
  async render(data, width) {
    this.currentCodeBlockData = data;
    if (data.parentContextKeyService) {
      this.contextKeyService.updateParent(data.parentContextKeyService);
    }
    if (this.getEditorOptionsFromConfig().wordWrap === "on") {
      this.layout(width);
    }
    await this.updateEditor(data);
    if (this.isDisposed) {
      return;
    }
    this.editor.updateOptions({
      ...this.getEditorOptionsFromConfig(),
      ariaLabel: localize("chat.codeBlockLabel", "Code block {0}", data.codeBlockIndex + 1)
    });
    this.layout(width);
    this.toolbar.setAriaLabel(localize("chat.codeBlockToolbarLabel", "Code block {0}", data.codeBlockIndex + 1));
    if (data.renderOptions?.hideToolbar) {
      dom.hide(this.toolbar.getElement());
    } else {
      dom.show(this.toolbar.getElement());
    }
    if (data.vulns?.length && isResponseVM(data.element)) {
      dom.clearNode(this.vulnsListElement);
      this.element.classList.remove("no-vulns");
      this.element.classList.toggle("chat-vulnerabilities-collapsed", !data.element.vulnerabilitiesListExpanded);
      dom.append(this.vulnsListElement, ...data.vulns.map((v) => $("li", void 0, $("span.chat-vuln-title", void 0, v.title), " " + v.description)));
      this.vulnsButton.label = this.getVulnerabilitiesLabel();
    } else {
      this.element.classList.add("no-vulns");
    }
  }
  reset() {
    this.clearWidgets();
  }
  clearWidgets() {
    ContentHoverController.get(this.editor)?.hideContentHover();
    GlyphHoverController.get(this.editor)?.hideGlyphHover();
  }
  async updateEditor(data) {
    const textModel = await data.textModel;
    this.editor.setModel(textModel);
    if (data.range) {
      this.editor.setSelection(data.range);
      this.editor.revealRangeInCenter(data.range, ScrollType.Immediate);
    }
    this.toolbar.context = {
      code: textModel.getTextBuffer().getValueInRange(data.range ?? textModel.getFullModelRange(), EndOfLinePreference.TextDefined),
      codeBlockIndex: data.codeBlockIndex,
      element: data.element,
      languageId: textModel.getLanguageId(),
      codemapperUri: data.codemapperUri
    };
    this.resourceContextKey.set(textModel.uri);
  }
  getVulnerabilitiesLabel() {
    if (!this.currentCodeBlockData || !this.currentCodeBlockData.vulns) {
      return "";
    }
    const referencesLabel = this.currentCodeBlockData.vulns.length > 1 ? localize("vulnerabilitiesPlural", "{0} vulnerabilities", this.currentCodeBlockData.vulns.length) : localize("vulnerabilitiesSingular", "{0} vulnerability", 1);
    const icon = (element) => element.vulnerabilitiesListExpanded ? Codicon.chevronDown : Codicon.chevronRight;
    return `${referencesLabel} $(${icon(this.currentCodeBlockData.element).id})`;
  }
};
CodeBlockPart = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IModelService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IAccessibilityService)
], CodeBlockPart);
let ChatCodeBlockContentProvider = class extends Disposable {
  constructor(textModelService, _modelService) {
    super();
    this._modelService = _modelService;
    this._register(textModelService.registerTextModelContentProvider(Schemas.vscodeChatCodeBlock, this));
  }
  async provideTextContent(resource) {
    const existing = this._modelService.getModel(resource);
    if (existing) {
      return existing;
    }
    return this._modelService.createModel("", null, resource);
  }
};
ChatCodeBlockContentProvider = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, IModelService)
], ChatCodeBlockContentProvider);
let CodeCompareBlockPart = class extends Disposable {
  constructor(options, menuId, delegate, overflowWidgetsDomNode, instantiationService, contextKeyService, modelService, configurationService, accessibilityService, labelService, openerService) {
    super();
    this.options = options;
    this.menuId = menuId;
    this.modelService = modelService;
    this.configurationService = configurationService;
    this.accessibilityService = accessibilityService;
    this.labelService = labelService;
    this.openerService = openerService;
    this._onDidChangeContentHeight = this._register(new Emitter());
    this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
    this._lastDiffEditorViewModel = this._store.add(new MutableDisposable());
    this.currentScrollWidth = 0;
    this.element = $(".interactive-result-code-block");
    this.element.classList.add("compare");
    this.messageElement = dom.append(this.element, $(".message"));
    this.messageElement.setAttribute("role", "status");
    this.messageElement.tabIndex = 0;
    this.contextKeyService = this._register(contextKeyService.createScoped(this.element));
    const scopedInstantiationService = this._register(instantiationService.createChild(new ServiceCollection(
      [IContextKeyService, this.contextKeyService],
      [IEditorProgressService, new class {
        show(_total, _delay) {
          return emptyProgressRunner;
        }
        async showWhile(promise, _delay) {
          await promise;
        }
      }()]
    )));
    const editorHeader = dom.append(this.element, $(".interactive-result-header.show-file-icons"));
    const editorElement = dom.append(this.element, $(".interactive-result-editor"));
    this.diffEditor = this.createDiffEditor(scopedInstantiationService, editorElement, {
      ...getSimpleEditorOptions(this.configurationService),
      lineNumbers: "on",
      selectOnLineNumbers: true,
      scrollBeyondLastLine: false,
      lineDecorationsWidth: 12,
      dragAndDrop: false,
      padding: { top: defaultCodeblockPadding, bottom: defaultCodeblockPadding },
      mouseWheelZoom: false,
      scrollbar: {
        vertical: "hidden",
        alwaysConsumeMouseWheel: false
      },
      definitionLinkOpensInPeek: false,
      gotoLocation: {
        multiple: "goto",
        multipleDeclarations: "goto",
        multipleDefinitions: "goto",
        multipleImplementations: "goto"
      },
      ariaLabel: localize("chat.codeBlockHelp", "Code block"),
      overflowWidgetsDomNode,
      ...this.getEditorOptionsFromConfig()
    });
    this.resourceLabel = this._register(scopedInstantiationService.createInstance(ResourceLabel, editorHeader, { supportIcons: true }));
    const editorScopedService = this.diffEditor.getModifiedEditor().contextKeyService.createScoped(editorHeader);
    const editorScopedInstantiationService = this._register(scopedInstantiationService.createChild(new ServiceCollection([IContextKeyService, editorScopedService])));
    this.toolbar = this._register(editorScopedInstantiationService.createInstance(MenuWorkbenchToolBar, editorHeader, menuId, {
      menuOptions: {
        shouldForwardArgs: true
      }
    }));
    this._configureForScreenReader();
    this._register(this.accessibilityService.onDidChangeScreenReaderOptimized(() => this._configureForScreenReader()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectedKeys.has(AccessibilityVerbositySettingId.Chat)) {
        this._configureForScreenReader();
      }
    }));
    this._register(this.options.onDidChange(() => {
      this.diffEditor.updateOptions(this.getEditorOptionsFromConfig());
    }));
    this._register(this.diffEditor.getModifiedEditor().onDidScrollChange((e) => {
      this.currentScrollWidth = e.scrollWidth;
    }));
    this._register(this.diffEditor.onDidContentSizeChange((e) => {
      if (e.contentHeightChanged) {
        this._onDidChangeContentHeight.fire();
      }
    }));
    this._register(this.diffEditor.getModifiedEditor().onDidBlurEditorWidget(() => {
      this.element.classList.remove("focused");
      WordHighlighterContribution.get(this.diffEditor.getModifiedEditor())?.stopHighlighting();
      this.clearWidgets();
    }));
    this._register(this.diffEditor.getModifiedEditor().onDidFocusEditorWidget(() => {
      this.element.classList.add("focused");
      WordHighlighterContribution.get(this.diffEditor.getModifiedEditor())?.restoreViewState(true);
    }));
    if (delegate.onDidScroll) {
      this._register(delegate.onDidScroll((e) => {
        this.clearWidgets();
      }));
    }
  }
  get uri() {
    return this.diffEditor.getModifiedEditor().getModel()?.uri;
  }
  createDiffEditor(instantiationService, parent, options) {
    const widgetOptions = {
      isSimpleWidget: false,
      contributions: EditorExtensionsRegistry.getSomeEditorContributions([
        MenuPreventer.ID,
        SelectionClipboardContributionID,
        ContextMenuController.ID,
        WordHighlighterContribution.ID,
        ViewportSemanticTokensContribution.ID,
        BracketMatchingController.ID,
        SmartSelectController.ID,
        ContentHoverController.ID,
        GlyphHoverController.ID,
        GotoDefinitionAtPositionEditorContribution.ID
      ])
    };
    return this._register(instantiationService.createInstance(DiffEditorWidget, parent, {
      scrollbar: { useShadows: false, alwaysConsumeMouseWheel: false, ignoreHorizontalScrollbarInContentHeight: true },
      renderMarginRevertIcon: false,
      diffCodeLens: false,
      scrollBeyondLastLine: false,
      stickyScroll: { enabled: false },
      originalAriaLabel: localize("original", "Original"),
      modifiedAriaLabel: localize("modified", "Modified"),
      diffAlgorithm: "advanced",
      readOnly: false,
      isInEmbeddedEditor: true,
      useInlineViewWhenSpaceIsLimited: true,
      experimental: {
        useTrueInlineView: true
      },
      renderSideBySideInlineBreakpoint: 300,
      renderOverviewRuler: false,
      compactMode: true,
      hideUnchangedRegions: { enabled: true, contextLineCount: 1 },
      renderGutterMenu: false,
      lineNumbersMinChars: 1,
      ...options
    }, { originalEditor: widgetOptions, modifiedEditor: widgetOptions }));
  }
  focus() {
    this.diffEditor.focus();
  }
  updatePaddingForLayout() {
    const horizontalScrollbarVisible = this.currentScrollWidth > this.diffEditor.getModifiedEditor().getLayoutInfo().contentWidth;
    const scrollbarHeight = this.diffEditor.getModifiedEditor().getLayoutInfo().horizontalScrollbarHeight;
    const bottomPadding = horizontalScrollbarVisible ? Math.max(defaultCodeblockPadding - scrollbarHeight, 2) : defaultCodeblockPadding;
    this.diffEditor.updateOptions({ padding: { top: defaultCodeblockPadding, bottom: bottomPadding } });
  }
  _configureForScreenReader() {
    const toolbarElt = this.toolbar.getElement();
    if (this.accessibilityService.isScreenReaderOptimized()) {
      toolbarElt.style.display = "block";
      toolbarElt.ariaLabel = this.configurationService.getValue(AccessibilityVerbositySettingId.Chat) ? localize("chat.codeBlock.toolbarVerbose", "Toolbar for code block which can be reached via tab") : localize("chat.codeBlock.toolbar", "Code block toolbar");
    } else {
      toolbarElt.style.display = "";
    }
  }
  getEditorOptionsFromConfig() {
    return {
      wordWrap: this.options.configuration.resultEditor.wordWrap,
      fontLigatures: this.options.configuration.resultEditor.fontLigatures,
      bracketPairColorization: this.options.configuration.resultEditor.bracketPairColorization,
      fontFamily: this.options.configuration.resultEditor.fontFamily === "default" ? EDITOR_FONT_DEFAULTS.fontFamily : this.options.configuration.resultEditor.fontFamily,
      fontSize: this.options.configuration.resultEditor.fontSize,
      fontWeight: this.options.configuration.resultEditor.fontWeight,
      lineHeight: this.options.configuration.resultEditor.lineHeight
    };
  }
  layout(width) {
    const editorBorder = 2;
    const toolbar = dom.getTotalHeight(this.toolbar.getElement());
    const content = this.diffEditor.getModel() ? this.diffEditor.getContentHeight() : dom.getTotalHeight(this.messageElement);
    const dimension = new dom.Dimension(width - editorBorder, toolbar + content);
    this.element.style.height = `${dimension.height}px`;
    this.element.style.width = `${dimension.width}px`;
    this.diffEditor.layout(dimension.with(void 0, content - editorBorder));
    this.updatePaddingForLayout();
  }
  async render(data, width, token) {
    if (data.parentContextKeyService) {
      this.contextKeyService.updateParent(data.parentContextKeyService);
    }
    if (this.options.configuration.resultEditor.wordWrap === "on") {
      this.layout(width);
    }
    await this.updateEditor(data, token);
    this.layout(width);
    this.diffEditor.updateOptions({ ariaLabel: localize("chat.compareCodeBlockLabel", "Code Edits") });
    this.resourceLabel.element.setFile(data.edit.uri, {
      fileKind: FileKind.FILE,
      fileDecorations: { colors: true, badges: false }
    });
  }
  reset() {
    this.clearWidgets();
  }
  clearWidgets() {
    ContentHoverController.get(this.diffEditor.getOriginalEditor())?.hideContentHover();
    ContentHoverController.get(this.diffEditor.getModifiedEditor())?.hideContentHover();
    GlyphHoverController.get(this.diffEditor.getOriginalEditor())?.hideGlyphHover();
    GlyphHoverController.get(this.diffEditor.getModifiedEditor())?.hideGlyphHover();
  }
  async updateEditor(data, token) {
    if (!isResponseVM(data.element)) {
      return;
    }
    const isEditApplied = Boolean(data.edit.state?.applied ?? 0);
    ChatContextKeys.editApplied.bindTo(this.contextKeyService).set(isEditApplied);
    this.element.classList.toggle("no-diff", isEditApplied);
    if (isEditApplied) {
      assertType(data.edit.state?.applied);
      const uriLabel = this.labelService.getUriLabel(data.edit.uri, { relative: true, noPrefix: true });
      let template;
      if (data.edit.state.applied === 1) {
        template = localize("chat.edits.1", "Applied 1 change in [[``{0}``]]", uriLabel);
      } else if (data.edit.state.applied < 0) {
        template = localize("chat.edits.rejected", "Edits in [[``{0}``]] have been rejected", uriLabel);
      } else {
        template = localize("chat.edits.N", "Applied {0} changes in [[``{1}``]]", data.edit.state.applied, uriLabel);
      }
      const message = renderFormattedText(template, {
        renderCodeSegments: true,
        actionHandler: {
          callback: () => {
            this.openerService.open(data.edit.uri, { fromUserGesture: true, allowCommands: false });
          },
          disposables: this._store
        }
      });
      dom.reset(this.messageElement, message);
    }
    const diffData = await data.diffData;
    if (!isEditApplied && diffData) {
      const viewModel = this.diffEditor.createViewModel({
        original: diffData.original,
        modified: diffData.modified
      });
      await viewModel.waitForDiff();
      if (token.isCancellationRequested) {
        return;
      }
      const listener = Event.any(diffData.original.onWillDispose, diffData.modified.onWillDispose)(() => {
        this.diffEditor.setModel(null);
      });
      this.diffEditor.setModel(viewModel);
      this._lastDiffEditorViewModel.value = combinedDisposable(listener, viewModel);
    } else {
      this.diffEditor.setModel(null);
      this._lastDiffEditorViewModel.value = void 0;
      this._onDidChangeContentHeight.fire();
    }
    this.toolbar.context = {
      edit: data.edit,
      element: data.element,
      diffEditor: this.diffEditor
    };
  }
};
CodeCompareBlockPart = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IModelService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IAccessibilityService),
  __decorateParam(9, ILabelService),
  __decorateParam(10, IOpenerService)
], CodeCompareBlockPart);
let DefaultChatTextEditor = class {
  constructor(modelService, editorService, dialogService) {
    this.modelService = modelService;
    this.editorService = editorService;
    this.dialogService = dialogService;
    this._sha1 = new DefaultModelSHA1Computer();
  }
  async apply(response, item, diffEditor) {
    if (!response.response.value.includes(item)) {
      return;
    }
    if (item.state?.applied) {
      return;
    }
    if (!diffEditor) {
      for (const candidate of this.editorService.listDiffEditors()) {
        if (!candidate.getContainerDomNode().isConnected) {
          continue;
        }
        const model = candidate.getModel();
        if (!model || !isEqual(model.original.uri, item.uri) || model.modified.uri.scheme !== Schemas.vscodeChatCodeCompareBlock) {
          diffEditor = candidate;
          break;
        }
      }
    }
    const edits = diffEditor ? await this._applyWithDiffEditor(diffEditor, item) : await this._apply(item);
    response.setEditApplied(item, edits);
  }
  async _applyWithDiffEditor(diffEditor, item) {
    const model = diffEditor.getModel();
    if (!model) {
      return 0;
    }
    const diff = diffEditor.getDiffComputationResult();
    if (!diff || diff.identical) {
      return 0;
    }
    if (!await this._checkSha1(model.original, item)) {
      return 0;
    }
    const modified = new TextModelText(model.modified);
    const edits = diff.changes2.map((i) => i.toRangeMapping().toTextEdit(modified).toSingleEditOperation());
    model.original.pushStackElement();
    model.original.pushEditOperations(null, edits, () => null);
    model.original.pushStackElement();
    return edits.length;
  }
  async _apply(item) {
    const ref = await this.modelService.createModelReference(item.uri);
    try {
      if (!await this._checkSha1(ref.object.textEditorModel, item)) {
        return 0;
      }
      ref.object.textEditorModel.pushStackElement();
      let total = 0;
      for (const group of item.edits) {
        const edits = group.map(TextEdit.asEditOperation);
        ref.object.textEditorModel.pushEditOperations(null, edits, () => null);
        total += edits.length;
      }
      ref.object.textEditorModel.pushStackElement();
      return total;
    } finally {
      ref.dispose();
    }
  }
  async _checkSha1(model, item) {
    if (item.state?.sha1 && this._sha1.computeSHA1(model) && this._sha1.computeSHA1(model) !== item.state.sha1) {
      const result = await this.dialogService.confirm({
        message: localize("interactive.compare.apply.confirm", "The original file has been modified."),
        detail: localize("interactive.compare.apply.confirm.detail", "Do you want to apply the changes anyway?")
      });
      if (!result.confirmed) {
        return false;
      }
    }
    return true;
  }
  discard(response, item) {
    if (!response.response.value.includes(item)) {
      return;
    }
    if (item.state?.applied) {
      return;
    }
    response.setEditApplied(item, -1);
  }
};
DefaultChatTextEditor = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, ICodeEditorService),
  __decorateParam(2, IDialogService)
], DefaultChatTextEditor);
export {
  ChatCodeBlockContentProvider,
  CodeBlockPart,
  CodeCompareBlockPart,
  DefaultChatTextEditor,
  localFileLanguageId,
  parseLocalFileData
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY29kZUJsb2NrUGFydC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9jb2RlQmxvY2tQYXJ0LmNzcyc7XG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IHJlbmRlckZvcm1hdHRlZFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZm9ybWF0dGVkVGV4dFJlbmRlcmVyLmpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGNvbWJpbmVkRGlzcG9zYWJsZSwgRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElFZGl0b3JDb25zdHJ1Y3Rpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvY29uZmlnL2VkaXRvckNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSURpZmZFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckV4dGVuc2lvbnNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCwgSUNvZGVFZGl0b3JXaWRnZXRPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvY29kZUVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvZGlmZkVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBFRElUT1JfRk9OVF9ERUZBVUxUUywgRWRpdG9yT3B0aW9uLCBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTY3JvbGxUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgVGV4dEVkaXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBFbmRPZkxpbmVQcmVmZXJlbmNlLCBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWxUZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWxUZXh0LmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IERlZmF1bHRNb2RlbFNIQTFDb21wdXRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIsIElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQnJhY2tldE1hdGNoaW5nQ29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2JyYWNrZXRNYXRjaGluZy9icm93c2VyL2JyYWNrZXRNYXRjaGluZy5qcyc7XG5pbXBvcnQgeyBDb2xvckRldGVjdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvY29sb3JQaWNrZXIvYnJvd3Nlci9jb2xvckRldGVjdG9yLmpzJztcbmltcG9ydCB7IENvbnRleHRNZW51Q29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2NvbnRleHRtZW51L2Jyb3dzZXIvY29udGV4dG1lbnUuanMnO1xuaW1wb3J0IHsgR290b0RlZmluaXRpb25BdFBvc2l0aW9uRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZ290b1N5bWJvbC9icm93c2VyL2xpbmsvZ29Ub0RlZmluaXRpb25BdFBvc2l0aW9uLmpzJztcbmltcG9ydCB7IENvbnRlbnRIb3ZlckNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL2NvbnRlbnRIb3ZlckNvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgR2x5cGhIb3ZlckNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL2dseXBoSG92ZXJDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IExpbmtEZXRlY3RvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2xpbmtzL2Jyb3dzZXIvbGlua3MuanMnO1xuaW1wb3J0IHsgTWVzc2FnZUNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9tZXNzYWdlL2Jyb3dzZXIvbWVzc2FnZUNvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgVmlld3BvcnRTZW1hbnRpY1Rva2Vuc0NvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3NlbWFudGljVG9rZW5zL2Jyb3dzZXIvdmlld3BvcnRTZW1hbnRpY1Rva2Vucy5qcyc7XG5pbXBvcnQgeyBTbWFydFNlbGVjdENvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zbWFydFNlbGVjdC9icm93c2VyL3NtYXJ0U2VsZWN0LmpzJztcbmltcG9ydCB7IFdvcmRIaWdobGlnaHRlckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3dvcmRIaWdobGlnaHRlci9icm93c2VyL3dvcmRIaWdobGlnaHRlci5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IE1lbnVXb3JrYmVuY2hUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL3Rvb2xiYXIuanMnO1xuaW1wb3J0IHsgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IEZpbGVLaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VMYWJlbCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvbGFiZWxzLmpzJztcbmltcG9ydCB7IFJlc291cmNlQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2liaWxpdHlDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEluc3BlY3RFZGl0b3JUb2tlbnNDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vY29kZUVkaXRvci9icm93c2VyL2luc3BlY3RFZGl0b3JUb2tlbnMvaW5zcGVjdEVkaXRvclRva2Vucy5qcyc7XG5pbXBvcnQgeyBNZW51UHJldmVudGVyIH0gZnJvbSAnLi4vLi4vY29kZUVkaXRvci9icm93c2VyL21lbnVQcmV2ZW50ZXIuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uQ2xpcGJvYXJkQ29udHJpYnV0aW9uSUQgfSBmcm9tICcuLi8uLi9jb2RlRWRpdG9yL2Jyb3dzZXIvc2VsZWN0aW9uQ2xpcGJvYXJkLmpzJztcbmltcG9ydCB7IGdldFNpbXBsZUVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi9jb2RlRWRpdG9yL2Jyb3dzZXIvc2ltcGxlRWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25WdWxuZXJhYmlsaXR5IH0gZnJvbSAnLi4vY29tbW9uL2Fubm90YXRpb25zLmpzJztcbmltcG9ydCB7IENoYXRDb250ZXh0S2V5cyB9IGZyb20gJy4uL2NvbW1vbi9jaGF0Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSUNoYXRSZXNwb25zZU1vZGVsLCBJQ2hhdFRleHRFZGl0R3JvdXAgfSBmcm9tICcuLi9jb21tb24vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IElDaGF0UmVzcG9uc2VWaWV3TW9kZWwsIGlzUmVzcG9uc2VWTSB9IGZyb20gJy4uL2NvbW1vbi9jaGF0Vmlld01vZGVsLmpzJztcbmltcG9ydCB7IENoYXRUcmVlSXRlbSB9IGZyb20gJy4vY2hhdC5qcyc7XG5pbXBvcnQgeyBJQ2hhdFJlbmRlcmVyRGVsZWdhdGUgfSBmcm9tICcuL2NoYXRMaXN0UmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRvck9wdGlvbnMgfSBmcm9tICcuL2NoYXRPcHRpb25zLmpzJztcbmltcG9ydCB7IGVtcHR5UHJvZ3Jlc3NSdW5uZXIsIElFZGl0b3JQcm9ncmVzc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgU3VnZ2VzdENvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdENvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgU25pcHBldENvbnRyb2xsZXIyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvc25pcHBldC9icm93c2VyL3NuaXBwZXRDb250cm9sbGVyMi5qcyc7XG5cbmNvbnN0ICQgPSBkb20uJDtcblxuZXhwb3J0IGludGVyZmFjZSBJQ29kZUJsb2NrRGF0YSB7XG5cdHJlYWRvbmx5IGNvZGVCbG9ja0luZGV4OiBudW1iZXI7XG5cdHJlYWRvbmx5IGNvZGVCbG9ja1BhcnRJbmRleDogbnVtYmVyO1xuXHRyZWFkb25seSBlbGVtZW50OiB1bmtub3duO1xuXG5cdHJlYWRvbmx5IHRleHRNb2RlbDogUHJvbWlzZTxJVGV4dE1vZGVsPjtcblx0cmVhZG9ubHkgbGFuZ3VhZ2VJZDogc3RyaW5nO1xuXG5cdHJlYWRvbmx5IGNvZGVtYXBwZXJVcmk/OiBVUkk7XG5cblx0cmVhZG9ubHkgdnVsbnM/OiByZWFkb25seSBJTWFya2Rvd25WdWxuZXJhYmlsaXR5W107XG5cdHJlYWRvbmx5IHJhbmdlPzogUmFuZ2U7XG5cblx0cmVhZG9ubHkgcGFyZW50Q29udGV4dEtleVNlcnZpY2U/OiBJQ29udGV4dEtleVNlcnZpY2U7XG5cdHJlYWRvbmx5IHJlbmRlck9wdGlvbnM/OiBJQ29kZUJsb2NrUmVuZGVyT3B0aW9ucztcbn1cblxuLyoqXG4gKiBTcGVjaWFsIG1hcmtkb3duIGNvZGUgYmxvY2sgbGFuZ3VhZ2UgaWQgdXNlZCB0byByZW5kZXIgYSBsb2NhbCBmaWxlLlxuICpcbiAqIFRoZSB0ZXh0IG9mIHRoZSBjb2RlIHBhdGggc2hvdWxkIGJlIGEge0BsaW5rIExvY2FsRmlsZUNvZGVCbG9ja0RhdGF9IGpzb24gb2JqZWN0LlxuICovXG5leHBvcnQgY29uc3QgbG9jYWxGaWxlTGFuZ3VhZ2VJZCA9ICd2c2NvZGUtbG9jYWwtZmlsZSc7XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTG9jYWxGaWxlRGF0YSh0ZXh0OiBzdHJpbmcpIHtcblxuXHRpbnRlcmZhY2UgUmF3TG9jYWxGaWxlQ29kZUJsb2NrRGF0YSB7XG5cdFx0cmVhZG9ubHkgdXJpOiBVcmlDb21wb25lbnRzO1xuXHRcdHJlYWRvbmx5IHJhbmdlPzogSVJhbmdlO1xuXHR9XG5cblx0bGV0IGRhdGE6IFJhd0xvY2FsRmlsZUNvZGVCbG9ja0RhdGE7XG5cdHRyeSB7XG5cdFx0ZGF0YSA9IEpTT04ucGFyc2UodGV4dCk7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBwYXJzZSBjb2RlIGJsb2NrIGxvY2FsIGZpbGUgZGF0YScpO1xuXHR9XG5cblx0bGV0IHVyaTogVVJJO1xuXHR0cnkge1xuXHRcdHVyaSA9IFVSSS5yZXZpdmUoZGF0YT8udXJpKTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2RlIGJsb2NrIGxvY2FsIGZpbGUgZGF0YSBVUkknKTtcblx0fVxuXG5cdGxldCByYW5nZTogSVJhbmdlIHwgdW5kZWZpbmVkO1xuXHRpZiAoZGF0YS5yYW5nZSkge1xuXHRcdC8vIE5vdGUgdGhhdCBzaW5jZSB0aGlzIGlzIGNvbWluZyBmcm9tIGV4dGVuc2lvbnMsIHBvc2l0aW9uIGFyZSBhY3R1YWxseSB6ZXJvIGJhc2VkIGFuZCBtdXN0IGJlIGNvbnZlcnRlZC5cblx0XHRyYW5nZSA9IG5ldyBSYW5nZShkYXRhLnJhbmdlLnN0YXJ0TGluZU51bWJlciArIDEsIGRhdGEucmFuZ2Uuc3RhcnRDb2x1bW4gKyAxLCBkYXRhLnJhbmdlLmVuZExpbmVOdW1iZXIgKyAxLCBkYXRhLnJhbmdlLmVuZENvbHVtbiArIDEpO1xuXHR9XG5cblx0cmV0dXJuIHsgdXJpLCByYW5nZSB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb2RlQmxvY2tBY3Rpb25Db250ZXh0IHtcblx0Y29kZTogc3RyaW5nO1xuXHRjb2RlbWFwcGVyVXJpPzogVVJJO1xuXHRsYW5ndWFnZUlkPzogc3RyaW5nO1xuXHRjb2RlQmxvY2tJbmRleDogbnVtYmVyO1xuXHRlbGVtZW50OiB1bmtub3duO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb2RlQmxvY2tSZW5kZXJPcHRpb25zIHtcblx0aGlkZVRvb2xiYXI/OiBib29sZWFuO1xuXHR2ZXJ0aWNhbFBhZGRpbmc/OiBudW1iZXI7XG5cdHJlc2VydmVXaWR0aD86IG51bWJlcjtcblx0ZWRpdG9yT3B0aW9ucz86IElFZGl0b3JPcHRpb25zO1xuXHRtYXhIZWlnaHRJbkxpbmVzPzogbnVtYmVyO1xufVxuXG5jb25zdCBkZWZhdWx0Q29kZWJsb2NrUGFkZGluZyA9IDEwO1xuZXhwb3J0IGNsYXNzIENvZGVCbG9ja1BhcnQgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ29udGVudEhlaWdodCA9IHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudEhlaWdodC5ldmVudDtcblxuXHRwdWJsaWMgcmVhZG9ubHkgZWRpdG9yOiBDb2RlRWRpdG9yV2lkZ2V0O1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgdG9vbGJhcjogTWVudVdvcmtiZW5jaFRvb2xCYXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgZWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSB2dWxuc0J1dHRvbjogQnV0dG9uO1xuXHRwcml2YXRlIHJlYWRvbmx5IHZ1bG5zTGlzdEVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgY3VycmVudENvZGVCbG9ja0RhdGE6IElDb2RlQmxvY2tEYXRhIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGN1cnJlbnRTY3JvbGxXaWR0aCA9IDA7XG5cblx0cHJpdmF0ZSBpc0Rpc3Bvc2VkID0gZmFsc2U7XG5cblx0cHJpdmF0ZSByZXNvdXJjZUNvbnRleHRLZXk6IFJlc291cmNlQ29udGV4dEtleTtcblxuXHRwcml2YXRlIGdldCB2ZXJ0aWNhbFBhZGRpbmcoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5jdXJyZW50Q29kZUJsb2NrRGF0YT8ucmVuZGVyT3B0aW9ucz8udmVydGljYWxQYWRkaW5nID8/IGRlZmF1bHRDb2RlYmxvY2tQYWRkaW5nO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JPcHRpb25zOiBDaGF0RWRpdG9yT3B0aW9ucyxcblx0XHRyZWFkb25seSBtZW51SWQ6IE1lbnVJZCxcblx0XHRkZWxlZ2F0ZTogSUNoYXRSZW5kZXJlckRlbGVnYXRlLFxuXHRcdG92ZXJmbG93V2lkZ2V0c0RvbU5vZGU6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmVsZW1lbnQgPSAkKCcuaW50ZXJhY3RpdmUtcmVzdWx0LWNvZGUtYmxvY2snKTtcblxuXHRcdHRoaXMucmVzb3VyY2VDb250ZXh0S2V5ID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVzb3VyY2VDb250ZXh0S2V5KSk7XG5cdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKGNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZCh0aGlzLmVsZW1lbnQpKTtcblx0XHRjb25zdCBzY29wZWRJbnN0YW50aWF0aW9uU2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlXSkpKTtcblx0XHRjb25zdCBlZGl0b3JFbGVtZW50ID0gZG9tLmFwcGVuZCh0aGlzLmVsZW1lbnQsICQoJy5pbnRlcmFjdGl2ZS1yZXN1bHQtZWRpdG9yJykpO1xuXHRcdHRoaXMuZWRpdG9yID0gdGhpcy5jcmVhdGVFZGl0b3Ioc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UsIGVkaXRvckVsZW1lbnQsIHtcblx0XHRcdC4uLmdldFNpbXBsZUVkaXRvck9wdGlvbnModGhpcy5jb25maWd1cmF0aW9uU2VydmljZSksXG5cdFx0XHRyZWFkT25seTogdHJ1ZSxcblx0XHRcdGxpbmVOdW1iZXJzOiAnb2ZmJyxcblx0XHRcdHNlbGVjdE9uTGluZU51bWJlcnM6IHRydWUsXG5cdFx0XHRzY3JvbGxCZXlvbmRMYXN0TGluZTogZmFsc2UsXG5cdFx0XHRsaW5lRGVjb3JhdGlvbnNXaWR0aDogOCxcblx0XHRcdGRyYWdBbmREcm9wOiBmYWxzZSxcblx0XHRcdHBhZGRpbmc6IHsgdG9wOiB0aGlzLnZlcnRpY2FsUGFkZGluZywgYm90dG9tOiB0aGlzLnZlcnRpY2FsUGFkZGluZyB9LFxuXHRcdFx0bW91c2VXaGVlbFpvb206IGZhbHNlLFxuXHRcdFx0c2Nyb2xsYmFyOiB7XG5cdFx0XHRcdHZlcnRpY2FsOiAnaGlkZGVuJyxcblx0XHRcdFx0YWx3YXlzQ29uc3VtZU1vdXNlV2hlZWw6IGZhbHNlXG5cdFx0XHR9LFxuXHRcdFx0ZGVmaW5pdGlvbkxpbmtPcGVuc0luUGVlazogZmFsc2UsXG5cdFx0XHRnb3RvTG9jYXRpb246IHtcblx0XHRcdFx0bXVsdGlwbGU6ICdnb3RvJyxcblx0XHRcdFx0bXVsdGlwbGVEZWNsYXJhdGlvbnM6ICdnb3RvJyxcblx0XHRcdFx0bXVsdGlwbGVEZWZpbml0aW9uczogJ2dvdG8nLFxuXHRcdFx0XHRtdWx0aXBsZUltcGxlbWVudGF0aW9uczogJ2dvdG8nLFxuXHRcdFx0fSxcblx0XHRcdGFyaWFMYWJlbDogbG9jYWxpemUoJ2NoYXQuY29kZUJsb2NrSGVscCcsICdDb2RlIGJsb2NrJyksXG5cdFx0XHRvdmVyZmxvd1dpZGdldHNEb21Ob2RlLFxuXHRcdFx0Li4udGhpcy5nZXRFZGl0b3JPcHRpb25zRnJvbUNvbmZpZygpLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdG9vbGJhckVsZW1lbnQgPSBkb20uYXBwZW5kKHRoaXMuZWxlbWVudCwgJCgnLmludGVyYWN0aXZlLXJlc3VsdC1jb2RlLWJsb2NrLXRvb2xiYXInKSk7XG5cdFx0Y29uc3QgZWRpdG9yU2NvcGVkU2VydmljZSA9IHRoaXMuZWRpdG9yLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZCh0b29sYmFyRWxlbWVudCk7XG5cdFx0Y29uc3QgZWRpdG9yU2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UgPSB0aGlzLl9yZWdpc3RlcihzY29wZWRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVDaGlsZChuZXcgU2VydmljZUNvbGxlY3Rpb24oW0lDb250ZXh0S2V5U2VydmljZSwgZWRpdG9yU2NvcGVkU2VydmljZV0pKSk7XG5cdFx0dGhpcy50b29sYmFyID0gdGhpcy5fcmVnaXN0ZXIoZWRpdG9yU2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWVudVdvcmtiZW5jaFRvb2xCYXIsIHRvb2xiYXJFbGVtZW50LCBtZW51SWQsIHtcblx0XHRcdG1lbnVPcHRpb25zOiB7XG5cdFx0XHRcdHNob3VsZEZvcndhcmRBcmdzOiB0cnVlXG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgdnVsbnNDb250YWluZXIgPSBkb20uYXBwZW5kKHRoaXMuZWxlbWVudCwgJCgnLmludGVyYWN0aXZlLXJlc3VsdC12dWxucycpKTtcblx0XHRjb25zdCB2dWxuc0hlYWRlckVsZW1lbnQgPSBkb20uYXBwZW5kKHZ1bG5zQ29udGFpbmVyLCAkKCcuaW50ZXJhY3RpdmUtcmVzdWx0LXZ1bG5zLWhlYWRlcicsIHVuZGVmaW5lZCkpO1xuXHRcdHRoaXMudnVsbnNCdXR0b24gPSB0aGlzLl9yZWdpc3RlcihuZXcgQnV0dG9uKHZ1bG5zSGVhZGVyRWxlbWVudCwge1xuXHRcdFx0YnV0dG9uQmFja2dyb3VuZDogdW5kZWZpbmVkLFxuXHRcdFx0YnV0dG9uQm9yZGVyOiB1bmRlZmluZWQsXG5cdFx0XHRidXR0b25Gb3JlZ3JvdW5kOiB1bmRlZmluZWQsXG5cdFx0XHRidXR0b25Ib3ZlckJhY2tncm91bmQ6IHVuZGVmaW5lZCxcblx0XHRcdGJ1dHRvblNlY29uZGFyeUJhY2tncm91bmQ6IHVuZGVmaW5lZCxcblx0XHRcdGJ1dHRvblNlY29uZGFyeUZvcmVncm91bmQ6IHVuZGVmaW5lZCxcblx0XHRcdGJ1dHRvblNlY29uZGFyeUhvdmVyQmFja2dyb3VuZDogdW5kZWZpbmVkLFxuXHRcdFx0YnV0dG9uU2VwYXJhdG9yOiB1bmRlZmluZWQsXG5cdFx0XHRzdXBwb3J0SWNvbnM6IHRydWVcblx0XHR9KSk7XG5cblx0XHR0aGlzLnZ1bG5zTGlzdEVsZW1lbnQgPSBkb20uYXBwZW5kKHZ1bG5zQ29udGFpbmVyLCAkKCd1bC5pbnRlcmFjdGl2ZS1yZXN1bHQtdnVsbnMtbGlzdCcpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudnVsbnNCdXR0b24ub25EaWRDbGljaygoKSA9PiB7XG5cdFx0XHRjb25zdCBlbGVtZW50ID0gdGhpcy5jdXJyZW50Q29kZUJsb2NrRGF0YSEuZWxlbWVudCBhcyBJQ2hhdFJlc3BvbnNlVmlld01vZGVsO1xuXHRcdFx0ZWxlbWVudC52dWxuZXJhYmlsaXRpZXNMaXN0RXhwYW5kZWQgPSAhZWxlbWVudC52dWxuZXJhYmlsaXRpZXNMaXN0RXhwYW5kZWQ7XG5cdFx0XHR0aGlzLnZ1bG5zQnV0dG9uLmxhYmVsID0gdGhpcy5nZXRWdWxuZXJhYmlsaXRpZXNMYWJlbCgpO1xuXHRcdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2NoYXQtdnVsbmVyYWJpbGl0aWVzLWNvbGxhcHNlZCcsICFlbGVtZW50LnZ1bG5lcmFiaWxpdGllc0xpc3RFeHBhbmRlZCk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQuZmlyZSgpO1xuXHRcdFx0Ly8gdGhpcy51cGRhdGVBcmlhTGFiZWwoY29sbGFwc2VCdXR0b24uZWxlbWVudCwgcmVmZXJlbmNlc0xhYmVsLCBlbGVtZW50LnVzZWRSZWZlcmVuY2VzRXhwYW5kZWQpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudG9vbGJhci5vbkRpZENoYW5nZURyb3Bkb3duVmlzaWJpbGl0eShlID0+IHtcblx0XHRcdHRvb2xiYXJFbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2ZvcmNlLXZpc2liaWxpdHknLCBlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9jb25maWd1cmVGb3JTY3JlZW5SZWFkZXIoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmFjY2Vzc2liaWxpdHlTZXJ2aWNlLm9uRGlkQ2hhbmdlU2NyZWVuUmVhZGVyT3B0aW1pemVkKCgpID0+IHRoaXMuX2NvbmZpZ3VyZUZvclNjcmVlblJlYWRlcigpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oKGUpID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdGVkS2V5cy5oYXMoQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZC5DaGF0KSkge1xuXHRcdFx0XHR0aGlzLl9jb25maWd1cmVGb3JTY3JlZW5SZWFkZXIoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvck9wdGlvbnMub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5lZGl0b3IudXBkYXRlT3B0aW9ucyh0aGlzLmdldEVkaXRvck9wdGlvbnNGcm9tQ29uZmlnKCkpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yLm9uRGlkU2Nyb2xsQ2hhbmdlKGUgPT4ge1xuXHRcdFx0dGhpcy5jdXJyZW50U2Nyb2xsV2lkdGggPSBlLnNjcm9sbFdpZHRoO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvci5vbkRpZENvbnRlbnRTaXplQ2hhbmdlKGUgPT4ge1xuXHRcdFx0aWYgKGUuY29udGVudEhlaWdodENoYW5nZWQpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0LmZpcmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3Iub25EaWRCbHVyRWRpdG9yV2lkZ2V0KCgpID0+IHtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdmb2N1c2VkJyk7XG5cdFx0XHRXb3JkSGlnaGxpZ2h0ZXJDb250cmlidXRpb24uZ2V0KHRoaXMuZWRpdG9yKT8uc3RvcEhpZ2hsaWdodGluZygpO1xuXHRcdFx0dGhpcy5jbGVhcldpZGdldHMoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3Iub25EaWRGb2N1c0VkaXRvcldpZGdldCgoKSA9PiB7XG5cdFx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnZm9jdXNlZCcpO1xuXHRcdFx0V29yZEhpZ2hsaWdodGVyQ29udHJpYnV0aW9uLmdldCh0aGlzLmVkaXRvcik/LnJlc3RvcmVWaWV3U3RhdGUodHJ1ZSk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gUGFyZW50IGxpc3Qgc2Nyb2xsZWRcblx0XHRpZiAoZGVsZWdhdGUub25EaWRTY3JvbGwpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGRlbGVnYXRlLm9uRGlkU2Nyb2xsKGUgPT4ge1xuXHRcdFx0XHR0aGlzLmNsZWFyV2lkZ2V0cygpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5pc0Rpc3Bvc2VkID0gdHJ1ZTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRnZXQgdXJpKCk6IFVSSSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZWRpdG9yLmdldE1vZGVsKCk/LnVyaTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlRWRpdG9yKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsIHBhcmVudDogSFRNTEVsZW1lbnQsIG9wdGlvbnM6IFJlYWRvbmx5PElFZGl0b3JDb25zdHJ1Y3Rpb25PcHRpb25zPik6IENvZGVFZGl0b3JXaWRnZXQge1xuXHRcdHJldHVybiB0aGlzLl9yZWdpc3RlcihpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb2RlRWRpdG9yV2lkZ2V0LCBwYXJlbnQsIG9wdGlvbnMsIHtcblx0XHRcdGlzU2ltcGxlV2lkZ2V0OiBmYWxzZSxcblx0XHRcdGNvbnRyaWJ1dGlvbnM6IEVkaXRvckV4dGVuc2lvbnNSZWdpc3RyeS5nZXRTb21lRWRpdG9yQ29udHJpYnV0aW9ucyhbXG5cdFx0XHRcdE1lbnVQcmV2ZW50ZXIuSUQsXG5cdFx0XHRcdFNlbGVjdGlvbkNsaXBib2FyZENvbnRyaWJ1dGlvbklELFxuXHRcdFx0XHRDb250ZXh0TWVudUNvbnRyb2xsZXIuSUQsXG5cblx0XHRcdFx0V29yZEhpZ2hsaWdodGVyQ29udHJpYnV0aW9uLklELFxuXHRcdFx0XHRWaWV3cG9ydFNlbWFudGljVG9rZW5zQ29udHJpYnV0aW9uLklELFxuXHRcdFx0XHRCcmFja2V0TWF0Y2hpbmdDb250cm9sbGVyLklELFxuXHRcdFx0XHRTbWFydFNlbGVjdENvbnRyb2xsZXIuSUQsXG5cdFx0XHRcdENvbnRlbnRIb3ZlckNvbnRyb2xsZXIuSUQsXG5cdFx0XHRcdEdseXBoSG92ZXJDb250cm9sbGVyLklELFxuXHRcdFx0XHRNZXNzYWdlQ29udHJvbGxlci5JRCxcblx0XHRcdFx0R290b0RlZmluaXRpb25BdFBvc2l0aW9uRWRpdG9yQ29udHJpYnV0aW9uLklELFxuXHRcdFx0XHRTdWdnZXN0Q29udHJvbGxlci5JRCxcblx0XHRcdFx0U25pcHBldENvbnRyb2xsZXIyLklELFxuXHRcdFx0XHRDb2xvckRldGVjdG9yLklELFxuXHRcdFx0XHRMaW5rRGV0ZWN0b3IuSUQsXG5cblx0XHRcdFx0SW5zcGVjdEVkaXRvclRva2Vuc0NvbnRyb2xsZXIuSUQsXG5cdFx0XHRdKVxuXHRcdH0pKTtcblx0fVxuXG5cdGZvY3VzKCk6IHZvaWQge1xuXHRcdHRoaXMuZWRpdG9yLmZvY3VzKCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVBhZGRpbmdGb3JMYXlvdXQoKSB7XG5cdFx0Ly8gc2Nyb2xsV2lkdGggPSBcInRoZSB3aWR0aCBvZiB0aGUgY29udGVudCB0aGF0IG5lZWRzIHRvIGJlIHNjcm9sbGVkXCJcblx0XHQvLyBjb250ZW50V2lkdGggPSBcInRoZSB3aWR0aCBvZiB0aGUgYXJlYSB3aGVyZSBjb250ZW50IGlzIGRpc3BsYXllZFwiXG5cdFx0Y29uc3QgaG9yaXpvbnRhbFNjcm9sbGJhclZpc2libGUgPSB0aGlzLmN1cnJlbnRTY3JvbGxXaWR0aCA+IHRoaXMuZWRpdG9yLmdldExheW91dEluZm8oKS5jb250ZW50V2lkdGg7XG5cdFx0Y29uc3Qgc2Nyb2xsYmFySGVpZ2h0ID0gdGhpcy5lZGl0b3IuZ2V0TGF5b3V0SW5mbygpLmhvcml6b250YWxTY3JvbGxiYXJIZWlnaHQ7XG5cdFx0Y29uc3QgYm90dG9tUGFkZGluZyA9IGhvcml6b250YWxTY3JvbGxiYXJWaXNpYmxlID9cblx0XHRcdE1hdGgubWF4KHRoaXMudmVydGljYWxQYWRkaW5nIC0gc2Nyb2xsYmFySGVpZ2h0LCAyKSA6XG5cdFx0XHR0aGlzLnZlcnRpY2FsUGFkZGluZztcblx0XHR0aGlzLmVkaXRvci51cGRhdGVPcHRpb25zKHsgcGFkZGluZzogeyB0b3A6IHRoaXMudmVydGljYWxQYWRkaW5nLCBib3R0b206IGJvdHRvbVBhZGRpbmcgfSB9KTtcblx0fVxuXG5cdHByaXZhdGUgX2NvbmZpZ3VyZUZvclNjcmVlblJlYWRlcigpOiB2b2lkIHtcblx0XHRjb25zdCB0b29sYmFyRWx0ID0gdGhpcy50b29sYmFyLmdldEVsZW1lbnQoKTtcblx0XHRpZiAodGhpcy5hY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpKSB7XG5cdFx0XHR0b29sYmFyRWx0LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdFx0dG9vbGJhckVsdC5hcmlhTGFiZWwgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuQ2hhdCkgPyBsb2NhbGl6ZSgnY2hhdC5jb2RlQmxvY2sudG9vbGJhclZlcmJvc2UnLCAnVG9vbGJhciBmb3IgY29kZSBibG9jayB3aGljaCBjYW4gYmUgcmVhY2hlZCB2aWEgdGFiJykgOiBsb2NhbGl6ZSgnY2hhdC5jb2RlQmxvY2sudG9vbGJhcicsICdDb2RlIGJsb2NrIHRvb2xiYXInKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dG9vbGJhckVsdC5zdHlsZS5kaXNwbGF5ID0gJyc7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRFZGl0b3JPcHRpb25zRnJvbUNvbmZpZygpOiBJRWRpdG9yT3B0aW9ucyB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHdvcmRXcmFwOiB0aGlzLmVkaXRvck9wdGlvbnMuY29uZmlndXJhdGlvbi5yZXN1bHRFZGl0b3Iud29yZFdyYXAsXG5cdFx0XHRmb250TGlnYXR1cmVzOiB0aGlzLmVkaXRvck9wdGlvbnMuY29uZmlndXJhdGlvbi5yZXN1bHRFZGl0b3IuZm9udExpZ2F0dXJlcyxcblx0XHRcdGJyYWNrZXRQYWlyQ29sb3JpemF0aW9uOiB0aGlzLmVkaXRvck9wdGlvbnMuY29uZmlndXJhdGlvbi5yZXN1bHRFZGl0b3IuYnJhY2tldFBhaXJDb2xvcml6YXRpb24sXG5cdFx0XHRmb250RmFtaWx5OiB0aGlzLmVkaXRvck9wdGlvbnMuY29uZmlndXJhdGlvbi5yZXN1bHRFZGl0b3IuZm9udEZhbWlseSA9PT0gJ2RlZmF1bHQnID9cblx0XHRcdFx0RURJVE9SX0ZPTlRfREVGQVVMVFMuZm9udEZhbWlseSA6XG5cdFx0XHRcdHRoaXMuZWRpdG9yT3B0aW9ucy5jb25maWd1cmF0aW9uLnJlc3VsdEVkaXRvci5mb250RmFtaWx5LFxuXHRcdFx0Zm9udFNpemU6IHRoaXMuZWRpdG9yT3B0aW9ucy5jb25maWd1cmF0aW9uLnJlc3VsdEVkaXRvci5mb250U2l6ZSxcblx0XHRcdGZvbnRXZWlnaHQ6IHRoaXMuZWRpdG9yT3B0aW9ucy5jb25maWd1cmF0aW9uLnJlc3VsdEVkaXRvci5mb250V2VpZ2h0LFxuXHRcdFx0bGluZUhlaWdodDogdGhpcy5lZGl0b3JPcHRpb25zLmNvbmZpZ3VyYXRpb24ucmVzdWx0RWRpdG9yLmxpbmVIZWlnaHQsXG5cdFx0XHQuLi50aGlzLmN1cnJlbnRDb2RlQmxvY2tEYXRhPy5yZW5kZXJPcHRpb25zPy5lZGl0b3JPcHRpb25zLFxuXHRcdH07XG5cdH1cblxuXHRsYXlvdXQod2lkdGg6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRlbnRIZWlnaHQgPSB0aGlzLmdldENvbnRlbnRIZWlnaHQoKTtcblxuXHRcdGxldCBoZWlnaHQgPSBjb250ZW50SGVpZ2h0O1xuXHRcdGlmICh0aGlzLmN1cnJlbnRDb2RlQmxvY2tEYXRhPy5yZW5kZXJPcHRpb25zPy5tYXhIZWlnaHRJbkxpbmVzKSB7XG5cdFx0XHRoZWlnaHQgPSBNYXRoLm1pbihjb250ZW50SGVpZ2h0LCB0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpICogdGhpcy5jdXJyZW50Q29kZUJsb2NrRGF0YT8ucmVuZGVyT3B0aW9ucz8ubWF4SGVpZ2h0SW5MaW5lcyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdG9yQm9yZGVyID0gMjtcblx0XHR3aWR0aCA9IHdpZHRoIC0gZWRpdG9yQm9yZGVyIC0gKHRoaXMuY3VycmVudENvZGVCbG9ja0RhdGE/LnJlbmRlck9wdGlvbnM/LnJlc2VydmVXaWR0aCA/PyAwKTtcblx0XHR0aGlzLmVkaXRvci5sYXlvdXQoeyB3aWR0aCwgaGVpZ2h0IH0pO1xuXHRcdHRoaXMudXBkYXRlUGFkZGluZ0ZvckxheW91dCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDb250ZW50SGVpZ2h0KCkge1xuXHRcdGlmICh0aGlzLmN1cnJlbnRDb2RlQmxvY2tEYXRhPy5yYW5nZSkge1xuXHRcdFx0Y29uc3QgbGluZUNvdW50ID0gdGhpcy5jdXJyZW50Q29kZUJsb2NrRGF0YS5yYW5nZS5lbmRMaW5lTnVtYmVyIC0gdGhpcy5jdXJyZW50Q29kZUJsb2NrRGF0YS5yYW5nZS5zdGFydExpbmVOdW1iZXIgKyAxO1xuXHRcdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGluZUhlaWdodCk7XG5cdFx0XHRyZXR1cm4gbGluZUNvdW50ICogbGluZUhlaWdodDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZWRpdG9yLmdldENvbnRlbnRIZWlnaHQoKTtcblx0fVxuXG5cdGFzeW5jIHJlbmRlcihkYXRhOiBJQ29kZUJsb2NrRGF0YSwgd2lkdGg6IG51bWJlcikge1xuXHRcdHRoaXMuY3VycmVudENvZGVCbG9ja0RhdGEgPSBkYXRhO1xuXHRcdGlmIChkYXRhLnBhcmVudENvbnRleHRLZXlTZXJ2aWNlKSB7XG5cdFx0XHR0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLnVwZGF0ZVBhcmVudChkYXRhLnBhcmVudENvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5nZXRFZGl0b3JPcHRpb25zRnJvbUNvbmZpZygpLndvcmRXcmFwID09PSAnb24nKSB7XG5cdFx0XHQvLyBJbml0aWFsaXplIHRoZSBlZGl0b3Igd2l0aCB0aGUgbmV3IHByb3BlciB3aWR0aCBzbyB0aGF0IGdldENvbnRlbnRIZWlnaHRcblx0XHRcdC8vIHdpbGwgYmUgY29tcHV0ZWQgY29ycmVjdGx5IGluIHRoZSBuZXh0IGNhbGwgdG8gbGF5b3V0KClcblx0XHRcdHRoaXMubGF5b3V0KHdpZHRoKTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLnVwZGF0ZUVkaXRvcihkYXRhKTtcblx0XHRpZiAodGhpcy5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5lZGl0b3IudXBkYXRlT3B0aW9ucyh7XG5cdFx0XHQuLi50aGlzLmdldEVkaXRvck9wdGlvbnNGcm9tQ29uZmlnKCksXG5cdFx0XHRhcmlhTGFiZWw6IGxvY2FsaXplKCdjaGF0LmNvZGVCbG9ja0xhYmVsJywgXCJDb2RlIGJsb2NrIHswfVwiLCBkYXRhLmNvZGVCbG9ja0luZGV4ICsgMSksXG5cdFx0fSk7XG5cdFx0dGhpcy5sYXlvdXQod2lkdGgpO1xuXHRcdHRoaXMudG9vbGJhci5zZXRBcmlhTGFiZWwobG9jYWxpemUoJ2NoYXQuY29kZUJsb2NrVG9vbGJhckxhYmVsJywgXCJDb2RlIGJsb2NrIHswfVwiLCBkYXRhLmNvZGVCbG9ja0luZGV4ICsgMSkpO1xuXHRcdGlmIChkYXRhLnJlbmRlck9wdGlvbnM/LmhpZGVUb29sYmFyKSB7XG5cdFx0XHRkb20uaGlkZSh0aGlzLnRvb2xiYXIuZ2V0RWxlbWVudCgpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZG9tLnNob3codGhpcy50b29sYmFyLmdldEVsZW1lbnQoKSk7XG5cdFx0fVxuXG5cdFx0aWYgKGRhdGEudnVsbnM/Lmxlbmd0aCAmJiBpc1Jlc3BvbnNlVk0oZGF0YS5lbGVtZW50KSkge1xuXHRcdFx0ZG9tLmNsZWFyTm9kZSh0aGlzLnZ1bG5zTGlzdEVsZW1lbnQpO1xuXHRcdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ25vLXZ1bG5zJyk7XG5cdFx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnY2hhdC12dWxuZXJhYmlsaXRpZXMtY29sbGFwc2VkJywgIWRhdGEuZWxlbWVudC52dWxuZXJhYmlsaXRpZXNMaXN0RXhwYW5kZWQpO1xuXHRcdFx0ZG9tLmFwcGVuZCh0aGlzLnZ1bG5zTGlzdEVsZW1lbnQsIC4uLmRhdGEudnVsbnMubWFwKHYgPT4gJCgnbGknLCB1bmRlZmluZWQsICQoJ3NwYW4uY2hhdC12dWxuLXRpdGxlJywgdW5kZWZpbmVkLCB2LnRpdGxlKSwgJyAnICsgdi5kZXNjcmlwdGlvbikpKTtcblx0XHRcdHRoaXMudnVsbnNCdXR0b24ubGFiZWwgPSB0aGlzLmdldFZ1bG5lcmFiaWxpdGllc0xhYmVsKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCduby12dWxucycpO1xuXHRcdH1cblx0fVxuXG5cdHJlc2V0KCkge1xuXHRcdHRoaXMuY2xlYXJXaWRnZXRzKCk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyV2lkZ2V0cygpIHtcblx0XHRDb250ZW50SG92ZXJDb250cm9sbGVyLmdldCh0aGlzLmVkaXRvcik/LmhpZGVDb250ZW50SG92ZXIoKTtcblx0XHRHbHlwaEhvdmVyQ29udHJvbGxlci5nZXQodGhpcy5lZGl0b3IpPy5oaWRlR2x5cGhIb3ZlcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVFZGl0b3IoZGF0YTogSUNvZGVCbG9ja0RhdGEpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0ZXh0TW9kZWwgPSBhd2FpdCBkYXRhLnRleHRNb2RlbDtcblx0XHR0aGlzLmVkaXRvci5zZXRNb2RlbCh0ZXh0TW9kZWwpO1xuXHRcdGlmIChkYXRhLnJhbmdlKSB7XG5cdFx0XHR0aGlzLmVkaXRvci5zZXRTZWxlY3Rpb24oZGF0YS5yYW5nZSk7XG5cdFx0XHR0aGlzLmVkaXRvci5yZXZlYWxSYW5nZUluQ2VudGVyKGRhdGEucmFuZ2UsIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblx0XHR9XG5cblx0XHR0aGlzLnRvb2xiYXIuY29udGV4dCA9IHtcblx0XHRcdGNvZGU6IHRleHRNb2RlbC5nZXRUZXh0QnVmZmVyKCkuZ2V0VmFsdWVJblJhbmdlKGRhdGEucmFuZ2UgPz8gdGV4dE1vZGVsLmdldEZ1bGxNb2RlbFJhbmdlKCksIEVuZE9mTGluZVByZWZlcmVuY2UuVGV4dERlZmluZWQpLFxuXHRcdFx0Y29kZUJsb2NrSW5kZXg6IGRhdGEuY29kZUJsb2NrSW5kZXgsXG5cdFx0XHRlbGVtZW50OiBkYXRhLmVsZW1lbnQsXG5cdFx0XHRsYW5ndWFnZUlkOiB0ZXh0TW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpLFxuXHRcdFx0Y29kZW1hcHBlclVyaTogZGF0YS5jb2RlbWFwcGVyVXJpLFxuXHRcdH0gc2F0aXNmaWVzIElDb2RlQmxvY2tBY3Rpb25Db250ZXh0O1xuXHRcdHRoaXMucmVzb3VyY2VDb250ZXh0S2V5LnNldCh0ZXh0TW9kZWwudXJpKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VnVsbmVyYWJpbGl0aWVzTGFiZWwoKTogc3RyaW5nIHtcblx0XHRpZiAoIXRoaXMuY3VycmVudENvZGVCbG9ja0RhdGEgfHwgIXRoaXMuY3VycmVudENvZGVCbG9ja0RhdGEudnVsbnMpIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cblx0XHRjb25zdCByZWZlcmVuY2VzTGFiZWwgPSB0aGlzLmN1cnJlbnRDb2RlQmxvY2tEYXRhLnZ1bG5zLmxlbmd0aCA+IDEgP1xuXHRcdFx0bG9jYWxpemUoJ3Z1bG5lcmFiaWxpdGllc1BsdXJhbCcsIFwiezB9IHZ1bG5lcmFiaWxpdGllc1wiLCB0aGlzLmN1cnJlbnRDb2RlQmxvY2tEYXRhLnZ1bG5zLmxlbmd0aCkgOlxuXHRcdFx0bG9jYWxpemUoJ3Z1bG5lcmFiaWxpdGllc1Npbmd1bGFyJywgXCJ7MH0gdnVsbmVyYWJpbGl0eVwiLCAxKTtcblx0XHRjb25zdCBpY29uID0gKGVsZW1lbnQ6IElDaGF0UmVzcG9uc2VWaWV3TW9kZWwpID0+IGVsZW1lbnQudnVsbmVyYWJpbGl0aWVzTGlzdEV4cGFuZGVkID8gQ29kaWNvbi5jaGV2cm9uRG93biA6IENvZGljb24uY2hldnJvblJpZ2h0O1xuXHRcdHJldHVybiBgJHtyZWZlcmVuY2VzTGFiZWx9ICQoJHtpY29uKHRoaXMuY3VycmVudENvZGVCbG9ja0RhdGEuZWxlbWVudCBhcyBJQ2hhdFJlc3BvbnNlVmlld01vZGVsKS5pZH0pYDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2hhdENvZGVCbG9ja0NvbnRlbnRQcm92aWRlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRleHRNb2RlbFNlcnZpY2UucmVnaXN0ZXJUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIoU2NoZW1hcy52c2NvZGVDaGF0Q29kZUJsb2NrLCB0aGlzKSk7XG5cdH1cblxuXHRhc3luYyBwcm92aWRlVGV4dENvbnRlbnQocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SVRleHRNb2RlbCB8IG51bGw+IHtcblx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMuX21vZGVsU2VydmljZS5nZXRNb2RlbChyZXNvdXJjZSk7XG5cdFx0aWYgKGV4aXN0aW5nKSB7XG5cdFx0XHRyZXR1cm4gZXhpc3Rpbmc7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoJycsIG51bGwsIHJlc291cmNlKTtcblx0fVxufVxuXG4vL1xuXG5leHBvcnQgaW50ZXJmYWNlIElDb2RlQ29tcGFyZUJsb2NrQWN0aW9uQ29udGV4dCB7XG5cdHJlYWRvbmx5IGVsZW1lbnQ6IElDaGF0UmVzcG9uc2VWaWV3TW9kZWw7XG5cdHJlYWRvbmx5IGRpZmZFZGl0b3I6IElEaWZmRWRpdG9yO1xuXHRyZWFkb25seSBlZGl0OiBJQ2hhdFRleHRFZGl0R3JvdXA7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvZGVDb21wYXJlQmxvY2tEaWZmRGF0YSB7XG5cdG1vZGlmaWVkOiBJVGV4dE1vZGVsO1xuXHRvcmlnaW5hbDogSVRleHRNb2RlbDtcblx0b3JpZ2luYWxTaGExOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvZGVDb21wYXJlQmxvY2tEYXRhIHtcblx0cmVhZG9ubHkgZWxlbWVudDogQ2hhdFRyZWVJdGVtO1xuXG5cdHJlYWRvbmx5IGVkaXQ6IElDaGF0VGV4dEVkaXRHcm91cDtcblxuXHRyZWFkb25seSBkaWZmRGF0YTogUHJvbWlzZTxJQ29kZUNvbXBhcmVCbG9ja0RpZmZEYXRhIHwgdW5kZWZpbmVkPjtcblxuXHRyZWFkb25seSBwYXJlbnRDb250ZXh0S2V5U2VydmljZT86IElDb250ZXh0S2V5U2VydmljZTtcblx0Ly8gcmVhZG9ubHkgaGlkZVRvb2xiYXI/OiBib29sZWFuO1xufVxuXG5cbi8vIGxvbmctbGl2ZWQgb2JqZWN0IHRoYXQgc2l0cyBpbiB0aGUgRGlmZlBvb2wgYW5kIHRoYXQgZ2V0cyByZXVzZWRcbmV4cG9ydCBjbGFzcyBDb2RlQ29tcGFyZUJsb2NrUGFydCBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ29udGVudEhlaWdodCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0ID0gdGhpcy5fb25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZTtcblx0cHJpdmF0ZSByZWFkb25seSBkaWZmRWRpdG9yOiBEaWZmRWRpdG9yV2lkZ2V0O1xuXHRwcml2YXRlIHJlYWRvbmx5IHJlc291cmNlTGFiZWw6IFJlc291cmNlTGFiZWw7XG5cdHByaXZhdGUgcmVhZG9ubHkgdG9vbGJhcjogTWVudVdvcmtiZW5jaFRvb2xCYXI7XG5cdHJlYWRvbmx5IGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IG1lc3NhZ2VFbGVtZW50OiBIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9sYXN0RGlmZkVkaXRvclZpZXdNb2RlbCA9IHRoaXMuX3N0b3JlLmFkZChuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgY3VycmVudFNjcm9sbFdpZHRoID0gMDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IENoYXRFZGl0b3JPcHRpb25zLFxuXHRcdHJlYWRvbmx5IG1lbnVJZDogTWVudUlkLFxuXHRcdGRlbGVnYXRlOiBJQ2hhdFJlbmRlcmVyRGVsZWdhdGUsXG5cdFx0b3ZlcmZsb3dXaWRnZXRzRG9tTm9kZTogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuZWxlbWVudCA9ICQoJy5pbnRlcmFjdGl2ZS1yZXN1bHQtY29kZS1ibG9jaycpO1xuXHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdjb21wYXJlJyk7XG5cblx0XHR0aGlzLm1lc3NhZ2VFbGVtZW50ID0gZG9tLmFwcGVuZCh0aGlzLmVsZW1lbnQsICQoJy5tZXNzYWdlJykpO1xuXHRcdHRoaXMubWVzc2FnZUVsZW1lbnQuc2V0QXR0cmlidXRlKCdyb2xlJywgJ3N0YXR1cycpO1xuXHRcdHRoaXMubWVzc2FnZUVsZW1lbnQudGFiSW5kZXggPSAwO1xuXG5cdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKGNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZCh0aGlzLmVsZW1lbnQpKTtcblx0XHRjb25zdCBzY29wZWRJbnN0YW50aWF0aW9uU2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihcblx0XHRcdFtJQ29udGV4dEtleVNlcnZpY2UsIHRoaXMuY29udGV4dEtleVNlcnZpY2VdLFxuXHRcdFx0W0lFZGl0b3JQcm9ncmVzc1NlcnZpY2UsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIElFZGl0b3JQcm9ncmVzc1NlcnZpY2Uge1xuXHRcdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdFx0XHRcdHNob3coX3RvdGFsOiB1bmtub3duLCBfZGVsYXk/OiB1bmtub3duKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGVtcHR5UHJvZ3Jlc3NSdW5uZXI7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXN5bmMgc2hvd1doaWxlKHByb21pc2U6IFByb21pc2U8dW5rbm93bj4sIF9kZWxheT86IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRcdGF3YWl0IHByb21pc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1dLFxuXHRcdCkpKTtcblx0XHRjb25zdCBlZGl0b3JIZWFkZXIgPSBkb20uYXBwZW5kKHRoaXMuZWxlbWVudCwgJCgnLmludGVyYWN0aXZlLXJlc3VsdC1oZWFkZXIuc2hvdy1maWxlLWljb25zJykpO1xuXHRcdGNvbnN0IGVkaXRvckVsZW1lbnQgPSBkb20uYXBwZW5kKHRoaXMuZWxlbWVudCwgJCgnLmludGVyYWN0aXZlLXJlc3VsdC1lZGl0b3InKSk7XG5cdFx0dGhpcy5kaWZmRWRpdG9yID0gdGhpcy5jcmVhdGVEaWZmRWRpdG9yKHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLCBlZGl0b3JFbGVtZW50LCB7XG5cdFx0XHQuLi5nZXRTaW1wbGVFZGl0b3JPcHRpb25zKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpLFxuXHRcdFx0bGluZU51bWJlcnM6ICdvbicsXG5cdFx0XHRzZWxlY3RPbkxpbmVOdW1iZXJzOiB0cnVlLFxuXHRcdFx0c2Nyb2xsQmV5b25kTGFzdExpbmU6IGZhbHNlLFxuXHRcdFx0bGluZURlY29yYXRpb25zV2lkdGg6IDEyLFxuXHRcdFx0ZHJhZ0FuZERyb3A6IGZhbHNlLFxuXHRcdFx0cGFkZGluZzogeyB0b3A6IGRlZmF1bHRDb2RlYmxvY2tQYWRkaW5nLCBib3R0b206IGRlZmF1bHRDb2RlYmxvY2tQYWRkaW5nIH0sXG5cdFx0XHRtb3VzZVdoZWVsWm9vbTogZmFsc2UsXG5cdFx0XHRzY3JvbGxiYXI6IHtcblx0XHRcdFx0dmVydGljYWw6ICdoaWRkZW4nLFxuXHRcdFx0XHRhbHdheXNDb25zdW1lTW91c2VXaGVlbDogZmFsc2Vcblx0XHRcdH0sXG5cdFx0XHRkZWZpbml0aW9uTGlua09wZW5zSW5QZWVrOiBmYWxzZSxcblx0XHRcdGdvdG9Mb2NhdGlvbjoge1xuXHRcdFx0XHRtdWx0aXBsZTogJ2dvdG8nLFxuXHRcdFx0XHRtdWx0aXBsZURlY2xhcmF0aW9uczogJ2dvdG8nLFxuXHRcdFx0XHRtdWx0aXBsZURlZmluaXRpb25zOiAnZ290bycsXG5cdFx0XHRcdG11bHRpcGxlSW1wbGVtZW50YXRpb25zOiAnZ290bycsXG5cdFx0XHR9LFxuXHRcdFx0YXJpYUxhYmVsOiBsb2NhbGl6ZSgnY2hhdC5jb2RlQmxvY2tIZWxwJywgJ0NvZGUgYmxvY2snKSxcblx0XHRcdG92ZXJmbG93V2lkZ2V0c0RvbU5vZGUsXG5cdFx0XHQuLi50aGlzLmdldEVkaXRvck9wdGlvbnNGcm9tQ29uZmlnKCksXG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlc291cmNlTGFiZWwgPSB0aGlzLl9yZWdpc3RlcihzY29wZWRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvdXJjZUxhYmVsLCBlZGl0b3JIZWFkZXIsIHsgc3VwcG9ydEljb25zOiB0cnVlIH0pKTtcblxuXHRcdGNvbnN0IGVkaXRvclNjb3BlZFNlcnZpY2UgPSB0aGlzLmRpZmZFZGl0b3IuZ2V0TW9kaWZpZWRFZGl0b3IoKS5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVTY29wZWQoZWRpdG9ySGVhZGVyKTtcblx0XHRjb25zdCBlZGl0b3JTY29wZWRJbnN0YW50aWF0aW9uU2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCBlZGl0b3JTY29wZWRTZXJ2aWNlXSkpKTtcblx0XHR0aGlzLnRvb2xiYXIgPSB0aGlzLl9yZWdpc3RlcihlZGl0b3JTY29wZWRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51V29ya2JlbmNoVG9vbEJhciwgZWRpdG9ySGVhZGVyLCBtZW51SWQsIHtcblx0XHRcdG1lbnVPcHRpb25zOiB7XG5cdFx0XHRcdHNob3VsZEZvcndhcmRBcmdzOiB0cnVlXG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fY29uZmlndXJlRm9yU2NyZWVuUmVhZGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5hY2Nlc3NpYmlsaXR5U2VydmljZS5vbkRpZENoYW5nZVNjcmVlblJlYWRlck9wdGltaXplZCgoKSA9PiB0aGlzLl9jb25maWd1cmVGb3JTY3JlZW5SZWFkZXIoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RlZEtleXMuaGFzKEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuQ2hhdCkpIHtcblx0XHRcdFx0dGhpcy5fY29uZmlndXJlRm9yU2NyZWVuUmVhZGVyKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vcHRpb25zLm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMuZGlmZkVkaXRvci51cGRhdGVPcHRpb25zKHRoaXMuZ2V0RWRpdG9yT3B0aW9uc0Zyb21Db25maWcoKSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kaWZmRWRpdG9yLmdldE1vZGlmaWVkRWRpdG9yKCkub25EaWRTY3JvbGxDaGFuZ2UoZSA9PiB7XG5cdFx0XHR0aGlzLmN1cnJlbnRTY3JvbGxXaWR0aCA9IGUuc2Nyb2xsV2lkdGg7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZGlmZkVkaXRvci5vbkRpZENvbnRlbnRTaXplQ2hhbmdlKGUgPT4ge1xuXHRcdFx0aWYgKGUuY29udGVudEhlaWdodENoYW5nZWQpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0LmZpcmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kaWZmRWRpdG9yLmdldE1vZGlmaWVkRWRpdG9yKCkub25EaWRCbHVyRWRpdG9yV2lkZ2V0KCgpID0+IHtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdmb2N1c2VkJyk7XG5cdFx0XHRXb3JkSGlnaGxpZ2h0ZXJDb250cmlidXRpb24uZ2V0KHRoaXMuZGlmZkVkaXRvci5nZXRNb2RpZmllZEVkaXRvcigpKT8uc3RvcEhpZ2hsaWdodGluZygpO1xuXHRcdFx0dGhpcy5jbGVhcldpZGdldHMoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kaWZmRWRpdG9yLmdldE1vZGlmaWVkRWRpdG9yKCkub25EaWRGb2N1c0VkaXRvcldpZGdldCgoKSA9PiB7XG5cdFx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnZm9jdXNlZCcpO1xuXHRcdFx0V29yZEhpZ2hsaWdodGVyQ29udHJpYnV0aW9uLmdldCh0aGlzLmRpZmZFZGl0b3IuZ2V0TW9kaWZpZWRFZGl0b3IoKSk/LnJlc3RvcmVWaWV3U3RhdGUodHJ1ZSk7XG5cdFx0fSkpO1xuXG5cblx0XHQvLyBQYXJlbnQgbGlzdCBzY3JvbGxlZFxuXHRcdGlmIChkZWxlZ2F0ZS5vbkRpZFNjcm9sbCkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoZGVsZWdhdGUub25EaWRTY3JvbGwoZSA9PiB7XG5cdFx0XHRcdHRoaXMuY2xlYXJXaWRnZXRzKCk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHVyaSgpOiBVUkkgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmRpZmZFZGl0b3IuZ2V0TW9kaWZpZWRFZGl0b3IoKS5nZXRNb2RlbCgpPy51cmk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZURpZmZFZGl0b3IoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSwgcGFyZW50OiBIVE1MRWxlbWVudCwgb3B0aW9uczogUmVhZG9ubHk8SUVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnM+KTogRGlmZkVkaXRvcldpZGdldCB7XG5cdFx0Y29uc3Qgd2lkZ2V0T3B0aW9uczogSUNvZGVFZGl0b3JXaWRnZXRPcHRpb25zID0ge1xuXHRcdFx0aXNTaW1wbGVXaWRnZXQ6IGZhbHNlLFxuXHRcdFx0Y29udHJpYnV0aW9uczogRWRpdG9yRXh0ZW5zaW9uc1JlZ2lzdHJ5LmdldFNvbWVFZGl0b3JDb250cmlidXRpb25zKFtcblx0XHRcdFx0TWVudVByZXZlbnRlci5JRCxcblx0XHRcdFx0U2VsZWN0aW9uQ2xpcGJvYXJkQ29udHJpYnV0aW9uSUQsXG5cdFx0XHRcdENvbnRleHRNZW51Q29udHJvbGxlci5JRCxcblxuXHRcdFx0XHRXb3JkSGlnaGxpZ2h0ZXJDb250cmlidXRpb24uSUQsXG5cdFx0XHRcdFZpZXdwb3J0U2VtYW50aWNUb2tlbnNDb250cmlidXRpb24uSUQsXG5cdFx0XHRcdEJyYWNrZXRNYXRjaGluZ0NvbnRyb2xsZXIuSUQsXG5cdFx0XHRcdFNtYXJ0U2VsZWN0Q29udHJvbGxlci5JRCxcblx0XHRcdFx0Q29udGVudEhvdmVyQ29udHJvbGxlci5JRCxcblx0XHRcdFx0R2x5cGhIb3ZlckNvbnRyb2xsZXIuSUQsXG5cdFx0XHRcdEdvdG9EZWZpbml0aW9uQXRQb3NpdGlvbkVkaXRvckNvbnRyaWJ1dGlvbi5JRCxcblx0XHRcdF0pXG5cdFx0fTtcblxuXHRcdHJldHVybiB0aGlzLl9yZWdpc3RlcihpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaWZmRWRpdG9yV2lkZ2V0LCBwYXJlbnQsIHtcblx0XHRcdHNjcm9sbGJhcjogeyB1c2VTaGFkb3dzOiBmYWxzZSwgYWx3YXlzQ29uc3VtZU1vdXNlV2hlZWw6IGZhbHNlLCBpZ25vcmVIb3Jpem9udGFsU2Nyb2xsYmFySW5Db250ZW50SGVpZ2h0OiB0cnVlLCB9LFxuXHRcdFx0cmVuZGVyTWFyZ2luUmV2ZXJ0SWNvbjogZmFsc2UsXG5cdFx0XHRkaWZmQ29kZUxlbnM6IGZhbHNlLFxuXHRcdFx0c2Nyb2xsQmV5b25kTGFzdExpbmU6IGZhbHNlLFxuXHRcdFx0c3RpY2t5U2Nyb2xsOiB7IGVuYWJsZWQ6IGZhbHNlIH0sXG5cdFx0XHRvcmlnaW5hbEFyaWFMYWJlbDogbG9jYWxpemUoJ29yaWdpbmFsJywgJ09yaWdpbmFsJyksXG5cdFx0XHRtb2RpZmllZEFyaWFMYWJlbDogbG9jYWxpemUoJ21vZGlmaWVkJywgJ01vZGlmaWVkJyksXG5cdFx0XHRkaWZmQWxnb3JpdGhtOiAnYWR2YW5jZWQnLFxuXHRcdFx0cmVhZE9ubHk6IGZhbHNlLFxuXHRcdFx0aXNJbkVtYmVkZGVkRWRpdG9yOiB0cnVlLFxuXHRcdFx0dXNlSW5saW5lVmlld1doZW5TcGFjZUlzTGltaXRlZDogdHJ1ZSxcblx0XHRcdGV4cGVyaW1lbnRhbDoge1xuXHRcdFx0XHR1c2VUcnVlSW5saW5lVmlldzogdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHRyZW5kZXJTaWRlQnlTaWRlSW5saW5lQnJlYWtwb2ludDogMzAwLFxuXHRcdFx0cmVuZGVyT3ZlcnZpZXdSdWxlcjogZmFsc2UsXG5cdFx0XHRjb21wYWN0TW9kZTogdHJ1ZSxcblx0XHRcdGhpZGVVbmNoYW5nZWRSZWdpb25zOiB7IGVuYWJsZWQ6IHRydWUsIGNvbnRleHRMaW5lQ291bnQ6IDEgfSxcblx0XHRcdHJlbmRlckd1dHRlck1lbnU6IGZhbHNlLFxuXHRcdFx0bGluZU51bWJlcnNNaW5DaGFyczogMSxcblx0XHRcdC4uLm9wdGlvbnNcblx0XHR9LCB7IG9yaWdpbmFsRWRpdG9yOiB3aWRnZXRPcHRpb25zLCBtb2RpZmllZEVkaXRvcjogd2lkZ2V0T3B0aW9ucyB9KSk7XG5cdH1cblxuXHRmb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLmRpZmZFZGl0b3IuZm9jdXMoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlUGFkZGluZ0ZvckxheW91dCgpIHtcblx0XHQvLyBzY3JvbGxXaWR0aCA9IFwidGhlIHdpZHRoIG9mIHRoZSBjb250ZW50IHRoYXQgbmVlZHMgdG8gYmUgc2Nyb2xsZWRcIlxuXHRcdC8vIGNvbnRlbnRXaWR0aCA9IFwidGhlIHdpZHRoIG9mIHRoZSBhcmVhIHdoZXJlIGNvbnRlbnQgaXMgZGlzcGxheWVkXCJcblx0XHRjb25zdCBob3Jpem9udGFsU2Nyb2xsYmFyVmlzaWJsZSA9IHRoaXMuY3VycmVudFNjcm9sbFdpZHRoID4gdGhpcy5kaWZmRWRpdG9yLmdldE1vZGlmaWVkRWRpdG9yKCkuZ2V0TGF5b3V0SW5mbygpLmNvbnRlbnRXaWR0aDtcblx0XHRjb25zdCBzY3JvbGxiYXJIZWlnaHQgPSB0aGlzLmRpZmZFZGl0b3IuZ2V0TW9kaWZpZWRFZGl0b3IoKS5nZXRMYXlvdXRJbmZvKCkuaG9yaXpvbnRhbFNjcm9sbGJhckhlaWdodDtcblx0XHRjb25zdCBib3R0b21QYWRkaW5nID0gaG9yaXpvbnRhbFNjcm9sbGJhclZpc2libGUgP1xuXHRcdFx0TWF0aC5tYXgoZGVmYXVsdENvZGVibG9ja1BhZGRpbmcgLSBzY3JvbGxiYXJIZWlnaHQsIDIpIDpcblx0XHRcdGRlZmF1bHRDb2RlYmxvY2tQYWRkaW5nO1xuXHRcdHRoaXMuZGlmZkVkaXRvci51cGRhdGVPcHRpb25zKHsgcGFkZGluZzogeyB0b3A6IGRlZmF1bHRDb2RlYmxvY2tQYWRkaW5nLCBib3R0b206IGJvdHRvbVBhZGRpbmcgfSB9KTtcblx0fVxuXG5cdHByaXZhdGUgX2NvbmZpZ3VyZUZvclNjcmVlblJlYWRlcigpOiB2b2lkIHtcblx0XHRjb25zdCB0b29sYmFyRWx0ID0gdGhpcy50b29sYmFyLmdldEVsZW1lbnQoKTtcblx0XHRpZiAodGhpcy5hY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpKSB7XG5cdFx0XHR0b29sYmFyRWx0LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdFx0dG9vbGJhckVsdC5hcmlhTGFiZWwgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuQ2hhdCkgPyBsb2NhbGl6ZSgnY2hhdC5jb2RlQmxvY2sudG9vbGJhclZlcmJvc2UnLCAnVG9vbGJhciBmb3IgY29kZSBibG9jayB3aGljaCBjYW4gYmUgcmVhY2hlZCB2aWEgdGFiJykgOiBsb2NhbGl6ZSgnY2hhdC5jb2RlQmxvY2sudG9vbGJhcicsICdDb2RlIGJsb2NrIHRvb2xiYXInKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dG9vbGJhckVsdC5zdHlsZS5kaXNwbGF5ID0gJyc7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRFZGl0b3JPcHRpb25zRnJvbUNvbmZpZygpOiBJRWRpdG9yT3B0aW9ucyB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHdvcmRXcmFwOiB0aGlzLm9wdGlvbnMuY29uZmlndXJhdGlvbi5yZXN1bHRFZGl0b3Iud29yZFdyYXAsXG5cdFx0XHRmb250TGlnYXR1cmVzOiB0aGlzLm9wdGlvbnMuY29uZmlndXJhdGlvbi5yZXN1bHRFZGl0b3IuZm9udExpZ2F0dXJlcyxcblx0XHRcdGJyYWNrZXRQYWlyQ29sb3JpemF0aW9uOiB0aGlzLm9wdGlvbnMuY29uZmlndXJhdGlvbi5yZXN1bHRFZGl0b3IuYnJhY2tldFBhaXJDb2xvcml6YXRpb24sXG5cdFx0XHRmb250RmFtaWx5OiB0aGlzLm9wdGlvbnMuY29uZmlndXJhdGlvbi5yZXN1bHRFZGl0b3IuZm9udEZhbWlseSA9PT0gJ2RlZmF1bHQnID9cblx0XHRcdFx0RURJVE9SX0ZPTlRfREVGQVVMVFMuZm9udEZhbWlseSA6XG5cdFx0XHRcdHRoaXMub3B0aW9ucy5jb25maWd1cmF0aW9uLnJlc3VsdEVkaXRvci5mb250RmFtaWx5LFxuXHRcdFx0Zm9udFNpemU6IHRoaXMub3B0aW9ucy5jb25maWd1cmF0aW9uLnJlc3VsdEVkaXRvci5mb250U2l6ZSxcblx0XHRcdGZvbnRXZWlnaHQ6IHRoaXMub3B0aW9ucy5jb25maWd1cmF0aW9uLnJlc3VsdEVkaXRvci5mb250V2VpZ2h0LFxuXHRcdFx0bGluZUhlaWdodDogdGhpcy5vcHRpb25zLmNvbmZpZ3VyYXRpb24ucmVzdWx0RWRpdG9yLmxpbmVIZWlnaHQsXG5cdFx0fTtcblx0fVxuXG5cdGxheW91dCh3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgZWRpdG9yQm9yZGVyID0gMjtcblxuXHRcdGNvbnN0IHRvb2xiYXIgPSBkb20uZ2V0VG90YWxIZWlnaHQodGhpcy50b29sYmFyLmdldEVsZW1lbnQoKSk7XG5cdFx0Y29uc3QgY29udGVudCA9IHRoaXMuZGlmZkVkaXRvci5nZXRNb2RlbCgpXG5cdFx0XHQ/IHRoaXMuZGlmZkVkaXRvci5nZXRDb250ZW50SGVpZ2h0KClcblx0XHRcdDogZG9tLmdldFRvdGFsSGVpZ2h0KHRoaXMubWVzc2FnZUVsZW1lbnQpO1xuXG5cdFx0Y29uc3QgZGltZW5zaW9uID0gbmV3IGRvbS5EaW1lbnNpb24od2lkdGggLSBlZGl0b3JCb3JkZXIsIHRvb2xiYXIgKyBjb250ZW50KTtcblx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gYCR7ZGltZW5zaW9uLmhlaWdodH1weGA7XG5cdFx0dGhpcy5lbGVtZW50LnN0eWxlLndpZHRoID0gYCR7ZGltZW5zaW9uLndpZHRofXB4YDtcblx0XHR0aGlzLmRpZmZFZGl0b3IubGF5b3V0KGRpbWVuc2lvbi53aXRoKHVuZGVmaW5lZCwgY29udGVudCAtIGVkaXRvckJvcmRlcikpO1xuXHRcdHRoaXMudXBkYXRlUGFkZGluZ0ZvckxheW91dCgpO1xuXHR9XG5cblxuXHRhc3luYyByZW5kZXIoZGF0YTogSUNvZGVDb21wYXJlQmxvY2tEYXRhLCB3aWR0aDogbnVtYmVyLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pIHtcblx0XHRpZiAoZGF0YS5wYXJlbnRDb250ZXh0S2V5U2VydmljZSkge1xuXHRcdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZS51cGRhdGVQYXJlbnQoZGF0YS5wYXJlbnRDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5jb25maWd1cmF0aW9uLnJlc3VsdEVkaXRvci53b3JkV3JhcCA9PT0gJ29uJykge1xuXHRcdFx0Ly8gSW5pdGlhbGl6ZSB0aGUgZWRpdG9yIHdpdGggdGhlIG5ldyBwcm9wZXIgd2lkdGggc28gdGhhdCBnZXRDb250ZW50SGVpZ2h0XG5cdFx0XHQvLyB3aWxsIGJlIGNvbXB1dGVkIGNvcnJlY3RseSBpbiB0aGUgbmV4dCBjYWxsIHRvIGxheW91dCgpXG5cdFx0XHR0aGlzLmxheW91dCh3aWR0aCk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy51cGRhdGVFZGl0b3IoZGF0YSwgdG9rZW4pO1xuXG5cdFx0dGhpcy5sYXlvdXQod2lkdGgpO1xuXHRcdHRoaXMuZGlmZkVkaXRvci51cGRhdGVPcHRpb25zKHsgYXJpYUxhYmVsOiBsb2NhbGl6ZSgnY2hhdC5jb21wYXJlQ29kZUJsb2NrTGFiZWwnLCBcIkNvZGUgRWRpdHNcIikgfSk7XG5cblx0XHR0aGlzLnJlc291cmNlTGFiZWwuZWxlbWVudC5zZXRGaWxlKGRhdGEuZWRpdC51cmksIHtcblx0XHRcdGZpbGVLaW5kOiBGaWxlS2luZC5GSUxFLFxuXHRcdFx0ZmlsZURlY29yYXRpb25zOiB7IGNvbG9yczogdHJ1ZSwgYmFkZ2VzOiBmYWxzZSB9XG5cdFx0fSk7XG5cdH1cblxuXHRyZXNldCgpIHtcblx0XHR0aGlzLmNsZWFyV2lkZ2V0cygpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhcldpZGdldHMoKSB7XG5cdFx0Q29udGVudEhvdmVyQ29udHJvbGxlci5nZXQodGhpcy5kaWZmRWRpdG9yLmdldE9yaWdpbmFsRWRpdG9yKCkpPy5oaWRlQ29udGVudEhvdmVyKCk7XG5cdFx0Q29udGVudEhvdmVyQ29udHJvbGxlci5nZXQodGhpcy5kaWZmRWRpdG9yLmdldE1vZGlmaWVkRWRpdG9yKCkpPy5oaWRlQ29udGVudEhvdmVyKCk7XG5cdFx0R2x5cGhIb3ZlckNvbnRyb2xsZXIuZ2V0KHRoaXMuZGlmZkVkaXRvci5nZXRPcmlnaW5hbEVkaXRvcigpKT8uaGlkZUdseXBoSG92ZXIoKTtcblx0XHRHbHlwaEhvdmVyQ29udHJvbGxlci5nZXQodGhpcy5kaWZmRWRpdG9yLmdldE1vZGlmaWVkRWRpdG9yKCkpPy5oaWRlR2x5cGhIb3ZlcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVFZGl0b3IoZGF0YTogSUNvZGVDb21wYXJlQmxvY2tEYXRhLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdGlmICghaXNSZXNwb25zZVZNKGRhdGEuZWxlbWVudCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBpc0VkaXRBcHBsaWVkID0gQm9vbGVhbihkYXRhLmVkaXQuc3RhdGU/LmFwcGxpZWQgPz8gMCk7XG5cblx0XHRDaGF0Q29udGV4dEtleXMuZWRpdEFwcGxpZWQuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpLnNldChpc0VkaXRBcHBsaWVkKTtcblxuXHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCduby1kaWZmJywgaXNFZGl0QXBwbGllZCk7XG5cblx0XHRpZiAoaXNFZGl0QXBwbGllZCkge1xuXHRcdFx0YXNzZXJ0VHlwZShkYXRhLmVkaXQuc3RhdGU/LmFwcGxpZWQpO1xuXG5cdFx0XHRjb25zdCB1cmlMYWJlbCA9IHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGRhdGEuZWRpdC51cmksIHsgcmVsYXRpdmU6IHRydWUsIG5vUHJlZml4OiB0cnVlIH0pO1xuXG5cdFx0XHRsZXQgdGVtcGxhdGU6IHN0cmluZztcblx0XHRcdGlmIChkYXRhLmVkaXQuc3RhdGUuYXBwbGllZCA9PT0gMSkge1xuXHRcdFx0XHR0ZW1wbGF0ZSA9IGxvY2FsaXplKCdjaGF0LmVkaXRzLjEnLCBcIkFwcGxpZWQgMSBjaGFuZ2UgaW4gW1tgYHswfWBgXV1cIiwgdXJpTGFiZWwpO1xuXHRcdFx0fSBlbHNlIGlmIChkYXRhLmVkaXQuc3RhdGUuYXBwbGllZCA8IDApIHtcblx0XHRcdFx0dGVtcGxhdGUgPSBsb2NhbGl6ZSgnY2hhdC5lZGl0cy5yZWplY3RlZCcsIFwiRWRpdHMgaW4gW1tgYHswfWBgXV0gaGF2ZSBiZWVuIHJlamVjdGVkXCIsIHVyaUxhYmVsKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRlbXBsYXRlID0gbG9jYWxpemUoJ2NoYXQuZWRpdHMuTicsIFwiQXBwbGllZCB7MH0gY2hhbmdlcyBpbiBbW2BgezF9YGBdXVwiLCBkYXRhLmVkaXQuc3RhdGUuYXBwbGllZCwgdXJpTGFiZWwpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtZXNzYWdlID0gcmVuZGVyRm9ybWF0dGVkVGV4dCh0ZW1wbGF0ZSwge1xuXHRcdFx0XHRyZW5kZXJDb2RlU2VnbWVudHM6IHRydWUsXG5cdFx0XHRcdGFjdGlvbkhhbmRsZXI6IHtcblx0XHRcdFx0XHRjYWxsYmFjazogKCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oZGF0YS5lZGl0LnVyaSwgeyBmcm9tVXNlckdlc3R1cmU6IHRydWUsIGFsbG93Q29tbWFuZHM6IGZhbHNlIH0pO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXM6IHRoaXMuX3N0b3JlLFxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0ZG9tLnJlc2V0KHRoaXMubWVzc2FnZUVsZW1lbnQsIG1lc3NhZ2UpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpZmZEYXRhID0gYXdhaXQgZGF0YS5kaWZmRGF0YTtcblxuXHRcdGlmICghaXNFZGl0QXBwbGllZCAmJiBkaWZmRGF0YSkge1xuXHRcdFx0Y29uc3Qgdmlld01vZGVsID0gdGhpcy5kaWZmRWRpdG9yLmNyZWF0ZVZpZXdNb2RlbCh7XG5cdFx0XHRcdG9yaWdpbmFsOiBkaWZmRGF0YS5vcmlnaW5hbCxcblx0XHRcdFx0bW9kaWZpZWQ6IGRpZmZEYXRhLm1vZGlmaWVkXG5cdFx0XHR9KTtcblxuXHRcdFx0YXdhaXQgdmlld01vZGVsLndhaXRGb3JEaWZmKCk7XG5cblx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGxpc3RlbmVyID0gRXZlbnQuYW55KGRpZmZEYXRhLm9yaWdpbmFsLm9uV2lsbERpc3Bvc2UsIGRpZmZEYXRhLm1vZGlmaWVkLm9uV2lsbERpc3Bvc2UpKCgpID0+IHtcblx0XHRcdFx0Ly8gdGhpcyBhIGJpdCB3ZWlyZCBhbmQgYmFzaWNhbGx5IGR1cGxpY2F0ZXMgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvYmxvYi83Y2JjYWZjYmNjODgyOThjZmRjZDAyMzgwMThmYmJiYThlYjY4NTNlL3NyYy92cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9kaWZmRWRpdG9yV2lkZ2V0LnRzI0wzMjhcblx0XHRcdFx0Ly8gd2hpY2ggY2Fubm90IGNhbGwgYHNldE1vZGVsKG51bGwpYCB3aXRob3V0IGZpcnN0IGNvbXBsYWluaW5nXG5cdFx0XHRcdHRoaXMuZGlmZkVkaXRvci5zZXRNb2RlbChudWxsKTtcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5kaWZmRWRpdG9yLnNldE1vZGVsKHZpZXdNb2RlbCk7XG5cdFx0XHR0aGlzLl9sYXN0RGlmZkVkaXRvclZpZXdNb2RlbC52YWx1ZSA9IGNvbWJpbmVkRGlzcG9zYWJsZShsaXN0ZW5lciwgdmlld01vZGVsKTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRpZmZFZGl0b3Iuc2V0TW9kZWwobnVsbCk7XG5cdFx0XHR0aGlzLl9sYXN0RGlmZkVkaXRvclZpZXdNb2RlbC52YWx1ZSA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudEhlaWdodC5maXJlKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy50b29sYmFyLmNvbnRleHQgPSB7XG5cdFx0XHRlZGl0OiBkYXRhLmVkaXQsXG5cdFx0XHRlbGVtZW50OiBkYXRhLmVsZW1lbnQsXG5cdFx0XHRkaWZmRWRpdG9yOiB0aGlzLmRpZmZFZGl0b3IsXG5cdFx0fSBzYXRpc2ZpZXMgSUNvZGVDb21wYXJlQmxvY2tBY3Rpb25Db250ZXh0O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWZhdWx0Q2hhdFRleHRFZGl0b3Ige1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3NoYTEgPSBuZXcgRGVmYXVsdE1vZGVsU0hBMUNvbXB1dGVyKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASUNvZGVFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdGFzeW5jIGFwcGx5KHJlc3BvbnNlOiBJQ2hhdFJlc3BvbnNlTW9kZWwgfCBJQ2hhdFJlc3BvbnNlVmlld01vZGVsLCBpdGVtOiBJQ2hhdFRleHRFZGl0R3JvdXAsIGRpZmZFZGl0b3I6IElEaWZmRWRpdG9yIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHRpZiAoIXJlc3BvbnNlLnJlc3BvbnNlLnZhbHVlLmluY2x1ZGVzKGl0ZW0pKSB7XG5cdFx0XHQvLyBib2dvdXMgaXRlbVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChpdGVtLnN0YXRlPy5hcHBsaWVkKSB7XG5cdFx0XHQvLyBhbHJlYWR5IGFwcGxpZWRcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIWRpZmZFZGl0b3IpIHtcblx0XHRcdGZvciAoY29uc3QgY2FuZGlkYXRlIG9mIHRoaXMuZWRpdG9yU2VydmljZS5saXN0RGlmZkVkaXRvcnMoKSkge1xuXHRcdFx0XHRpZiAoIWNhbmRpZGF0ZS5nZXRDb250YWluZXJEb21Ob2RlKCkuaXNDb25uZWN0ZWQpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBtb2RlbCA9IGNhbmRpZGF0ZS5nZXRNb2RlbCgpO1xuXHRcdFx0XHRpZiAoIW1vZGVsIHx8ICFpc0VxdWFsKG1vZGVsLm9yaWdpbmFsLnVyaSwgaXRlbS51cmkpIHx8IG1vZGVsLm1vZGlmaWVkLnVyaS5zY2hlbWUgIT09IFNjaGVtYXMudnNjb2RlQ2hhdENvZGVDb21wYXJlQmxvY2spIHtcblx0XHRcdFx0XHRkaWZmRWRpdG9yID0gY2FuZGlkYXRlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdHMgPSBkaWZmRWRpdG9yXG5cdFx0XHQ/IGF3YWl0IHRoaXMuX2FwcGx5V2l0aERpZmZFZGl0b3IoZGlmZkVkaXRvciwgaXRlbSlcblx0XHRcdDogYXdhaXQgdGhpcy5fYXBwbHkoaXRlbSk7XG5cblx0XHRyZXNwb25zZS5zZXRFZGl0QXBwbGllZChpdGVtLCBlZGl0cyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9hcHBseVdpdGhEaWZmRWRpdG9yKGRpZmZFZGl0b3I6IElEaWZmRWRpdG9yLCBpdGVtOiBJQ2hhdFRleHRFZGl0R3JvdXApIHtcblx0XHRjb25zdCBtb2RlbCA9IGRpZmZFZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cblx0XHRjb25zdCBkaWZmID0gZGlmZkVkaXRvci5nZXREaWZmQ29tcHV0YXRpb25SZXN1bHQoKTtcblx0XHRpZiAoIWRpZmYgfHwgZGlmZi5pZGVudGljYWwpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXG5cdFx0aWYgKCFhd2FpdCB0aGlzLl9jaGVja1NoYTEobW9kZWwub3JpZ2luYWwsIGl0ZW0pKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RpZmllZCA9IG5ldyBUZXh0TW9kZWxUZXh0KG1vZGVsLm1vZGlmaWVkKTtcblx0XHRjb25zdCBlZGl0cyA9IGRpZmYuY2hhbmdlczIubWFwKGkgPT4gaS50b1JhbmdlTWFwcGluZygpLnRvVGV4dEVkaXQobW9kaWZpZWQpLnRvU2luZ2xlRWRpdE9wZXJhdGlvbigpKTtcblxuXHRcdG1vZGVsLm9yaWdpbmFsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRtb2RlbC5vcmlnaW5hbC5wdXNoRWRpdE9wZXJhdGlvbnMobnVsbCwgZWRpdHMsICgpID0+IG51bGwpO1xuXHRcdG1vZGVsLm9yaWdpbmFsLnB1c2hTdGFja0VsZW1lbnQoKTtcblxuXHRcdHJldHVybiBlZGl0cy5sZW5ndGg7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9hcHBseShpdGVtOiBJQ2hhdFRleHRFZGl0R3JvdXApIHtcblx0XHRjb25zdCByZWYgPSBhd2FpdCB0aGlzLm1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShpdGVtLnVyaSk7XG5cdFx0dHJ5IHtcblxuXHRcdFx0aWYgKCFhd2FpdCB0aGlzLl9jaGVja1NoYTEocmVmLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwsIGl0ZW0pKSB7XG5cdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0fVxuXG5cdFx0XHRyZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbC5wdXNoU3RhY2tFbGVtZW50KCk7XG5cdFx0XHRsZXQgdG90YWwgPSAwO1xuXHRcdFx0Zm9yIChjb25zdCBncm91cCBvZiBpdGVtLmVkaXRzKSB7XG5cdFx0XHRcdGNvbnN0IGVkaXRzID0gZ3JvdXAubWFwKFRleHRFZGl0LmFzRWRpdE9wZXJhdGlvbik7XG5cdFx0XHRcdHJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsLnB1c2hFZGl0T3BlcmF0aW9ucyhudWxsLCBlZGl0cywgKCkgPT4gbnVsbCk7XG5cdFx0XHRcdHRvdGFsICs9IGVkaXRzLmxlbmd0aDtcblx0XHRcdH1cblx0XHRcdHJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRcdHJldHVybiB0b3RhbDtcblxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRyZWYuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2NoZWNrU2hhMShtb2RlbDogSVRleHRNb2RlbCwgaXRlbTogSUNoYXRUZXh0RWRpdEdyb3VwKSB7XG5cdFx0aWYgKGl0ZW0uc3RhdGU/LnNoYTEgJiYgdGhpcy5fc2hhMS5jb21wdXRlU0hBMShtb2RlbCkgJiYgdGhpcy5fc2hhMS5jb21wdXRlU0hBMShtb2RlbCkgIT09IGl0ZW0uc3RhdGUuc2hhMSkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgnaW50ZXJhY3RpdmUuY29tcGFyZS5hcHBseS5jb25maXJtJywgXCJUaGUgb3JpZ2luYWwgZmlsZSBoYXMgYmVlbiBtb2RpZmllZC5cIiksXG5cdFx0XHRcdGRldGFpbDogbG9jYWxpemUoJ2ludGVyYWN0aXZlLmNvbXBhcmUuYXBwbHkuY29uZmlybS5kZXRhaWwnLCBcIkRvIHlvdSB3YW50IHRvIGFwcGx5IHRoZSBjaGFuZ2VzIGFueXdheT9cIiksXG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKCFyZXN1bHQuY29uZmlybWVkKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRkaXNjYXJkKHJlc3BvbnNlOiBJQ2hhdFJlc3BvbnNlTW9kZWwgfCBJQ2hhdFJlc3BvbnNlVmlld01vZGVsLCBpdGVtOiBJQ2hhdFRleHRFZGl0R3JvdXApIHtcblx0XHRpZiAoIXJlc3BvbnNlLnJlc3BvbnNlLnZhbHVlLmluY2x1ZGVzKGl0ZW0pKSB7XG5cdFx0XHQvLyBib2dvdXMgaXRlbVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChpdGVtLnN0YXRlPy5hcHBsaWVkKSB7XG5cdFx0XHQvLyBhbHJlYWR5IGFwcGxpZWRcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXNwb25zZS5zZXRFZGl0QXBwbGllZChpdGVtLCAtMSk7XG5cdH1cblxuXG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU87QUFFUCxZQUFZLFNBQVM7QUFDckIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxjQUFjO0FBRXZCLFNBQVMsZUFBZTtBQUN4QixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLG9CQUFvQixZQUFZLHlCQUF5QjtBQUNsRSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsV0FBMEI7QUFHbkMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx3QkFBa0Q7QUFDM0QsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxzQkFBc0Isb0JBQW9DO0FBQ25FLFNBQWlCLGFBQWE7QUFDOUIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUywyQkFBdUM7QUFDaEQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBb0MseUJBQXlCO0FBQzdELFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsa0RBQWtEO0FBQzNELFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsMENBQTBDO0FBQ25ELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNEJBQTRCO0FBRXJDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMEJBQTBCO0FBQ25D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QUFDaEMsVUFBTSxTQUFTLG1CQUFtQixNQUFNLE9BQU8sTUFBTSxJQUFJO0FBQ3pELFVBQU0sU0FBUyxpQkFBaUI7QUFFaEMsV0FBTyxNQUFNO0FBQUEsRUFDZDtBQUFBLEVBRUEsTUFBYyxPQUFPLE1BQTBCO0FBQzlDLFVBQU0sTUFBTSxNQUFNLEtBQUssYUFBYSxxQkFBcUIsS0FBSyxHQUFHO0FBQ2pFLFFBQUk7QUFFSCxVQUFJLENBQUMsTUFBTSxLQUFLLFdBQVcsSUFBSSxPQUFPLGlCQUFpQixJQUFJLEdBQUc7QUFDN0QsZUFBTztBQUFBLE1BQ1I7QUFFQSxVQUFJLE9BQU8sZ0JBQWdCLGlCQUFpQjtBQUM1QyxVQUFJLFFBQVE7QUFDWixpQkFBVyxTQUFTLEtBQUssT0FBTztBQUMvQixjQUFNLFFBQVEsTUFBTSxJQUFJLFNBQVMsZUFBZTtBQUNoRCxZQUFJLE9BQU8sZ0JBQWdCLG1CQUFtQixNQUFNLE9BQU8sTUFBTSxJQUFJO0FBQ3JFLGlCQUFTLE1BQU07QUFBQSxNQUNoQjtBQUNBLFVBQUksT0FBTyxnQkFBZ0IsaUJBQWlCO0FBQzVDLGFBQU87QUFBQSxJQUVSLFVBQUU7QUFDRCxVQUFJLFFBQVE7QUFBQSxJQUNiO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYyxXQUFXLE9BQW1CLE1BQTBCO0FBQ3JFLFFBQUksS0FBSyxPQUFPLFFBQVEsS0FBSyxNQUFNLFlBQVksS0FBSyxLQUFLLEtBQUssTUFBTSxZQUFZLEtBQUssTUFBTSxLQUFLLE1BQU0sTUFBTTtBQUMzRyxZQUFNLFNBQVMsTUFBTSxLQUFLLGNBQWMsUUFBUTtBQUFBLFFBQy9DLFNBQVMsU0FBUyxxQ0FBcUMsc0NBQXNDO0FBQUEsUUFDN0YsUUFBUSxTQUFTLDRDQUE0QywwQ0FBMEM7QUFBQSxNQUN4RyxDQUFDO0FBRUQsVUFBSSxDQUFDLE9BQU8sV0FBVztBQUN0QixlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsUUFBUSxVQUF1RCxNQUEwQjtBQUN4RixRQUFJLENBQUMsU0FBUyxTQUFTLE1BQU0sU0FBUyxJQUFJLEdBQUc7QUFFNUM7QUFBQSxJQUNEO0FBRUEsUUFBSSxLQUFLLE9BQU8sU0FBUztBQUV4QjtBQUFBLElBQ0Q7QUFFQSxhQUFTLGVBQWUsTUFBTSxFQUFFO0FBQUEsRUFDakM7QUFHRDtBQXhIYSx3QkFBTjtBQUFBLEVBS0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBUFU7IiwKICAibmFtZXMiOiBbXQp9Cg==
