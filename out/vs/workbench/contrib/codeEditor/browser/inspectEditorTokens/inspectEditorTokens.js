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
import "./inspectEditorTokens.css";
import * as nls from "../../../../../nls.js";
import * as dom from "../../../../../base/browser/dom.js";
import { CharCode } from "../../../../../base/common/charCode.js";
import { Color } from "../../../../../base/common/color.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { ContentWidgetPositionPreference } from "../../../../../editor/browser/editorBrowser.js";
import { EditorAction, registerEditorAction, registerEditorContribution, EditorContributionInstantiation } from "../../../../../editor/browser/editorExtensions.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { TreeSitterTokenizationRegistry } from "../../../../../editor/common/languages.js";
import { FontStyle, ColorId, StandardTokenType, TokenMetadata } from "../../../../../editor/common/encodedTokenAttributes.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { findMatchingThemeRule } from "../../../../services/textMate/common/TMHelper.js";
import { ITextMateTokenizationService } from "../../../../services/textMate/browser/textMateTokenizationFeature.js";
import { IWorkbenchThemeService } from "../../../../services/themes/common/workbenchThemeService.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { SemanticTokenRule } from "../../../../../platform/theme/common/tokenClassificationRegistry.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { SEMANTIC_HIGHLIGHTING_SETTING_ID } from "../../../../../editor/contrib/semanticTokens/common/semanticTokensConfig.js";
import { Schemas } from "../../../../../base/common/network.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
import { ITreeSitterParserService } from "../../../../../editor/common/services/treeSitterParserService.js";
const $ = dom.$;
let InspectEditorTokensController = class extends Disposable {
  static get(editor) {
    return editor.getContribution(InspectEditorTokensController.ID);
  }
  constructor(editor, textMateService, treeSitterService, languageService, themeService, notificationService, configurationService, languageFeaturesService) {
    super();
    this._editor = editor;
    this._textMateService = textMateService;
    this._treeSitterService = treeSitterService;
    this._themeService = themeService;
    this._languageService = languageService;
    this._notificationService = notificationService;
    this._configurationService = configurationService;
    this._languageFeaturesService = languageFeaturesService;
    this._widget = null;
    this._register(this._editor.onDidChangeModel((e) => this.stop()));
    this._register(this._editor.onDidChangeModelLanguage((e) => this.stop()));
    this._register(this._editor.onKeyUp((e) => e.keyCode === KeyCode.Escape && this.stop()));
  }
  dispose() {
    this.stop();
    super.dispose();
  }
  launch() {
    if (this._widget) {
      return;
    }
    if (!this._editor.hasModel()) {
      return;
    }
    if (this._editor.getModel().uri.scheme === Schemas.vscodeNotebookCell) {
      return;
    }
    this._widget = new InspectEditorTokensWidget(this._editor, this._textMateService, this._treeSitterService, this._languageService, this._themeService, this._notificationService, this._configurationService, this._languageFeaturesService);
  }
  stop() {
    if (this._widget) {
      this._widget.dispose();
      this._widget = null;
    }
  }
  toggle() {
    if (!this._widget) {
      this.launch();
    } else {
      this.stop();
    }
  }
};
InspectEditorTokensController.ID = "editor.contrib.inspectEditorTokens";
InspectEditorTokensController = __decorateClass([
  __decorateParam(1, ITextMateTokenizationService),
  __decorateParam(2, ITreeSitterParserService),
  __decorateParam(3, ILanguageService),
  __decorateParam(4, IWorkbenchThemeService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, ILanguageFeaturesService)
], InspectEditorTokensController);
class InspectEditorTokens extends EditorAction {
  constructor() {
    super({
      id: "editor.action.inspectTMScopes",
      label: nls.localize2("inspectEditorTokens", "Developer: Inspect Editor Tokens and Scopes"),
      precondition: void 0
    });
  }
  run(accessor, editor) {
    const controller = InspectEditorTokensController.get(editor);
    controller?.toggle();
  }
}
function renderTokenText(tokenText) {
  if (tokenText.length > 40) {
    tokenText = tokenText.substr(0, 20) + "\u2026" + tokenText.substr(tokenText.length - 20);
  }
  let result = "";
  for (let charIndex = 0, len = tokenText.length; charIndex < len; charIndex++) {
    const charCode = tokenText.charCodeAt(charIndex);
    switch (charCode) {
      case CharCode.Tab:
        result += "\u2192";
        break;
      case CharCode.Space:
        result += "\xB7";
        break;
      default:
        result += String.fromCharCode(charCode);
    }
  }
  return result;
}
const _InspectEditorTokensWidget = class _InspectEditorTokensWidget extends Disposable {
  constructor(editor, textMateService, treeSitterService, languageService, themeService, notificationService, configurationService, languageFeaturesService) {
    super();
    // Editor.IContentWidget.allowEditorOverflow
    this.allowEditorOverflow = true;
    this._isDisposed = false;
    this._editor = editor;
    this._languageService = languageService;
    this._themeService = themeService;
    this._textMateService = textMateService;
    this._treeSitterService = treeSitterService;
    this._notificationService = notificationService;
    this._configurationService = configurationService;
    this._languageFeaturesService = languageFeaturesService;
    this._model = this._editor.getModel();
    this._domNode = document.createElement("div");
    this._domNode.className = "token-inspect-widget";
    this._currentRequestCancellationTokenSource = new CancellationTokenSource();
    this._beginCompute(this._editor.getPosition());
    this._register(this._editor.onDidChangeCursorPosition((e) => this._beginCompute(this._editor.getPosition())));
    this._register(themeService.onDidColorThemeChange((_) => this._beginCompute(this._editor.getPosition())));
    this._register(configurationService.onDidChangeConfiguration((e) => e.affectsConfiguration("editor.semanticHighlighting.enabled") && this._beginCompute(this._editor.getPosition())));
    this._editor.addContentWidget(this);
  }
  dispose() {
    this._isDisposed = true;
    this._editor.removeContentWidget(this);
    this._currentRequestCancellationTokenSource.cancel();
    super.dispose();
  }
  getId() {
    return _InspectEditorTokensWidget._ID;
  }
  _beginCompute(position) {
    const grammar = this._textMateService.createTokenizer(this._model.getLanguageId());
    const semanticTokens = this._computeSemanticTokens(position);
    const tree = this._treeSitterService.getParseResult(this._model);
    dom.clearNode(this._domNode);
    this._domNode.appendChild(document.createTextNode(nls.localize("inspectTMScopesWidget.loading", "Loading...")));
    Promise.all([grammar, semanticTokens]).then(([grammar2, semanticTokens2]) => {
      if (this._isDisposed) {
        return;
      }
      this._compute(grammar2, semanticTokens2, tree, position);
      this._domNode.style.maxWidth = `${Math.max(this._editor.getLayoutInfo().width * 0.66, 500)}px`;
      this._editor.layoutContentWidget(this);
    }, (err) => {
      this._notificationService.warn(err);
      setTimeout(() => {
        InspectEditorTokensController.get(this._editor)?.stop();
      });
    });
  }
  _isSemanticColoringEnabled() {
    const setting = this._configurationService.getValue(SEMANTIC_HIGHLIGHTING_SETTING_ID, { overrideIdentifier: this._model.getLanguageId(), resource: this._model.uri })?.enabled;
    if (typeof setting === "boolean") {
      return setting;
    }
    return this._themeService.getColorTheme().semanticHighlighting;
  }
  _compute(grammar, semanticTokens, tree, position) {
    const textMateTokenInfo = grammar && this._getTokensAtPosition(grammar, position);
    const semanticTokenInfo = semanticTokens && this._getSemanticTokenAtPosition(semanticTokens, position);
    const treeSitterTokenInfo = tree && this._getTreeSitterTokenAtPosition(tree, position);
    if (!textMateTokenInfo && !semanticTokenInfo && !treeSitterTokenInfo) {
      dom.reset(this._domNode, "No grammar or semantic tokens available.");
      return;
    }
    const tmMetadata = textMateTokenInfo?.metadata;
    const semMetadata = semanticTokenInfo?.metadata;
    const semTokenText = semanticTokenInfo && renderTokenText(this._model.getValueInRange(semanticTokenInfo.range));
    const tmTokenText = textMateTokenInfo && renderTokenText(this._model.getLineContent(position.lineNumber).substring(textMateTokenInfo.token.startIndex, textMateTokenInfo.token.endIndex));
    const tokenText = semTokenText || tmTokenText || "";
    dom.reset(
      this._domNode,
      $(
        "h2.tiw-token",
        void 0,
        tokenText,
        $("span.tiw-token-length", void 0, `${tokenText.length} ${tokenText.length === 1 ? "char" : "chars"}`)
      )
    );
    dom.append(this._domNode, $("hr.tiw-metadata-separator", { "style": "clear:both" }));
    dom.append(this._domNode, $(
      "table.tiw-metadata-table",
      void 0,
      $(
        "tbody",
        void 0,
        $(
          "tr",
          void 0,
          $("td.tiw-metadata-key", void 0, "language"),
          $("td.tiw-metadata-value", void 0, tmMetadata?.languageId || "")
        ),
        $(
          "tr",
          void 0,
          $("td.tiw-metadata-key", void 0, "standard token type"),
          $("td.tiw-metadata-value", void 0, this._tokenTypeToString(tmMetadata?.tokenType || StandardTokenType.Other))
        ),
        ...this._formatMetadata(semMetadata, tmMetadata)
      )
    ));
    if (semanticTokenInfo) {
      dom.append(this._domNode, $("hr.tiw-metadata-separator"));
      const table = dom.append(this._domNode, $("table.tiw-metadata-table", void 0));
      const tbody = dom.append(table, $(
        "tbody",
        void 0,
        $(
          "tr",
          void 0,
          $("td.tiw-metadata-key", void 0, "semantic token type"),
          $("td.tiw-metadata-value", void 0, semanticTokenInfo.type)
        )
      ));
      if (semanticTokenInfo.modifiers.length) {
        dom.append(tbody, $(
          "tr",
          void 0,
          $("td.tiw-metadata-key", void 0, "modifiers"),
          $("td.tiw-metadata-value", void 0, semanticTokenInfo.modifiers.join(" "))
        ));
      }
      if (semanticTokenInfo.metadata) {
        const properties = ["foreground", "bold", "italic", "underline", "strikethrough"];
        const propertiesByDefValue = {};
        const allDefValues = new Array();
        for (const property of properties) {
          if (semanticTokenInfo.metadata[property] !== void 0) {
            const definition = semanticTokenInfo.definitions[property];
            const defValue = this._renderTokenStyleDefinition(definition, property);
            const defValueStr = defValue.map((el) => dom.isHTMLElement(el) ? el.outerHTML : el).join();
            let properties2 = propertiesByDefValue[defValueStr];
            if (!properties2) {
              propertiesByDefValue[defValueStr] = properties2 = [];
              allDefValues.push([defValue, defValueStr]);
            }
            properties2.push(property);
          }
        }
        for (const [defValue, defValueStr] of allDefValues) {
          dom.append(tbody, $(
            "tr",
            void 0,
            $("td.tiw-metadata-key", void 0, propertiesByDefValue[defValueStr].join(", ")),
            $("td.tiw-metadata-value", void 0, ...defValue)
          ));
        }
      }
    }
    if (textMateTokenInfo) {
      const theme = this._themeService.getColorTheme();
      dom.append(this._domNode, $("hr.tiw-metadata-separator"));
      const table = dom.append(this._domNode, $("table.tiw-metadata-table"));
      const tbody = dom.append(table, $("tbody"));
      if (tmTokenText && tmTokenText !== tokenText) {
        dom.append(tbody, $(
          "tr",
          void 0,
          $("td.tiw-metadata-key", void 0, "textmate token"),
          $("td.tiw-metadata-value", void 0, `${tmTokenText} (${tmTokenText.length})`)
        ));
      }
      const scopes = new Array();
      for (let i = textMateTokenInfo.token.scopes.length - 1; i >= 0; i--) {
        scopes.push(textMateTokenInfo.token.scopes[i]);
        if (i > 0) {
          scopes.push($("br"));
        }
      }
      dom.append(tbody, $(
        "tr",
        void 0,
        $("td.tiw-metadata-key", void 0, "textmate scopes"),
        $("td.tiw-metadata-value.tiw-metadata-scopes", void 0, ...scopes)
      ));
      const matchingRule = findMatchingThemeRule(theme, textMateTokenInfo.token.scopes, false);
      const semForeground = semanticTokenInfo?.metadata?.foreground;
      if (matchingRule) {
        if (semForeground !== textMateTokenInfo.metadata.foreground) {
          let defValue = $(
            "code.tiw-theme-selector",
            void 0,
            matchingRule.rawSelector,
            $("br"),
            JSON.stringify(matchingRule.settings, null, "	")
          );
          if (semForeground) {
            defValue = $("s", void 0, defValue);
          }
          dom.append(tbody, $(
            "tr",
            void 0,
            $("td.tiw-metadata-key", void 0, "foreground"),
            $("td.tiw-metadata-value", void 0, defValue)
          ));
        }
      } else if (!semForeground) {
        dom.append(tbody, $(
          "tr",
          void 0,
          $("td.tiw-metadata-key", void 0, "foreground"),
          $("td.tiw-metadata-value", void 0, "No theme selector")
        ));
      }
    }
    if (treeSitterTokenInfo) {
      const lastTokenInfo = treeSitterTokenInfo[treeSitterTokenInfo.length - 1];
      dom.append(this._domNode, $("hr.tiw-metadata-separator"));
      const table = dom.append(this._domNode, $("table.tiw-metadata-table"));
      const tbody = dom.append(table, $("tbody"));
      dom.append(tbody, $(
        "tr",
        void 0,
        $("td.tiw-metadata-key", void 0, `tree-sitter token ${lastTokenInfo.id}`),
        $("td.tiw-metadata-value", void 0, `${lastTokenInfo.text}`)
      ));
      const scopes = new Array();
      let i = treeSitterTokenInfo.length - 1;
      let node = treeSitterTokenInfo[i];
      while (node.parent || i > 0) {
        scopes.push(node.type);
        node = node.parent ?? treeSitterTokenInfo[--i];
        if (node) {
          scopes.push($("br"));
        }
      }
      dom.append(tbody, $(
        "tr",
        void 0,
        $("td.tiw-metadata-key", void 0, "tree-sitter tree"),
        $("td.tiw-metadata-value.tiw-metadata-scopes", void 0, ...scopes)
      ));
      const tokenizationSupport = TreeSitterTokenizationRegistry.get(this._model.getLanguageId());
      const captures = tokenizationSupport?.captureAtPosition(position.lineNumber, position.column, this._model);
      if (captures && captures.length > 0) {
        dom.append(tbody, $(
          "tr",
          void 0,
          $("td.tiw-metadata-key", void 0, "foreground"),
          $("td.tiw-metadata-value", void 0, captures.map((cap) => cap.name).join(" "))
        ));
      }
    }
  }
  _formatMetadata(semantic, tm) {
    const elements = new Array();
    function render(property) {
      const value = semantic?.[property] || tm?.[property];
      if (value !== void 0) {
        const semanticStyle = semantic?.[property] ? "tiw-metadata-semantic" : "";
        elements.push($(
          "tr",
          void 0,
          $("td.tiw-metadata-key", void 0, property),
          $(`td.tiw-metadata-value.${semanticStyle}`, void 0, value)
        ));
      }
      return value;
    }
    const foreground = render("foreground");
    const background = render("background");
    if (foreground && background) {
      const backgroundColor = Color.fromHex(background), foregroundColor = Color.fromHex(foreground);
      if (backgroundColor.isOpaque()) {
        elements.push($(
          "tr",
          void 0,
          $("td.tiw-metadata-key", void 0, "contrast ratio"),
          $("td.tiw-metadata-value", void 0, backgroundColor.getContrastRatio(foregroundColor.makeOpaque(backgroundColor)).toFixed(2))
        ));
      } else {
        elements.push($(
          "tr",
          void 0,
          $("td.tiw-metadata-key", void 0, "Contrast ratio cannot be precise for background colors that use transparency"),
          $("td.tiw-metadata-value")
        ));
      }
    }
    const fontStyleLabels = new Array();
    function addStyle(key) {
      let label;
      if (semantic && semantic[key]) {
        label = $("span.tiw-metadata-semantic", void 0, key);
      } else if (tm && tm[key]) {
        label = key;
      }
      if (label) {
        if (fontStyleLabels.length) {
          fontStyleLabels.push(" ");
        }
        fontStyleLabels.push(label);
      }
    }
    addStyle("bold");
    addStyle("italic");
    addStyle("underline");
    addStyle("strikethrough");
    if (fontStyleLabels.length) {
      elements.push($(
        "tr",
        void 0,
        $("td.tiw-metadata-key", void 0, "font style"),
        $("td.tiw-metadata-value", void 0, ...fontStyleLabels)
      ));
    }
    return elements;
  }
  _decodeMetadata(metadata) {
    const colorMap = this._themeService.getColorTheme().tokenColorMap;
    const languageId = TokenMetadata.getLanguageId(metadata);
    const tokenType = TokenMetadata.getTokenType(metadata);
    const fontStyle = TokenMetadata.getFontStyle(metadata);
    const foreground = TokenMetadata.getForeground(metadata);
    const background = TokenMetadata.getBackground(metadata);
    return {
      languageId: this._languageService.languageIdCodec.decodeLanguageId(languageId),
      tokenType,
      bold: fontStyle & FontStyle.Bold ? true : void 0,
      italic: fontStyle & FontStyle.Italic ? true : void 0,
      underline: fontStyle & FontStyle.Underline ? true : void 0,
      strikethrough: fontStyle & FontStyle.Strikethrough ? true : void 0,
      foreground: colorMap[foreground],
      background: colorMap[background]
    };
  }
  _tokenTypeToString(tokenType) {
    switch (tokenType) {
      case StandardTokenType.Other:
        return "Other";
      case StandardTokenType.Comment:
        return "Comment";
      case StandardTokenType.String:
        return "String";
      case StandardTokenType.RegEx:
        return "RegEx";
      default:
        return "??";
    }
  }
  _getTokensAtPosition(grammar, position) {
    const lineNumber = position.lineNumber;
    const stateBeforeLine = this._getStateBeforeLine(grammar, lineNumber);
    const tokenizationResult1 = grammar.tokenizeLine(this._model.getLineContent(lineNumber), stateBeforeLine);
    const tokenizationResult2 = grammar.tokenizeLine2(this._model.getLineContent(lineNumber), stateBeforeLine);
    let token1Index = 0;
    for (let i = tokenizationResult1.tokens.length - 1; i >= 0; i--) {
      const t = tokenizationResult1.tokens[i];
      if (position.column - 1 >= t.startIndex) {
        token1Index = i;
        break;
      }
    }
    let token2Index = 0;
    for (let i = tokenizationResult2.tokens.length >>> 1; i >= 0; i--) {
      if (position.column - 1 >= tokenizationResult2.tokens[i << 1]) {
        token2Index = i;
        break;
      }
    }
    return {
      token: tokenizationResult1.tokens[token1Index],
      metadata: this._decodeMetadata(tokenizationResult2.tokens[(token2Index << 1) + 1])
    };
  }
  _getStateBeforeLine(grammar, lineNumber) {
    let state = null;
    for (let i = 1; i < lineNumber; i++) {
      const tokenizationResult = grammar.tokenizeLine(this._model.getLineContent(i), state);
      state = tokenizationResult.ruleStack;
    }
    return state;
  }
  isSemanticTokens(token) {
    return token && token.data;
  }
  async _computeSemanticTokens(position) {
    if (!this._isSemanticColoringEnabled()) {
      return null;
    }
    const tokenProviders = this._languageFeaturesService.documentSemanticTokensProvider.ordered(this._model);
    if (tokenProviders.length) {
      const provider = tokenProviders[0];
      const tokens = await Promise.resolve(provider.provideDocumentSemanticTokens(this._model, null, this._currentRequestCancellationTokenSource.token));
      if (this.isSemanticTokens(tokens)) {
        return { tokens, legend: provider.getLegend() };
      }
    }
    const rangeTokenProviders = this._languageFeaturesService.documentRangeSemanticTokensProvider.ordered(this._model);
    if (rangeTokenProviders.length) {
      const provider = rangeTokenProviders[0];
      const lineNumber = position.lineNumber;
      const range = new Range(lineNumber, 1, lineNumber, this._model.getLineMaxColumn(lineNumber));
      const tokens = await Promise.resolve(provider.provideDocumentRangeSemanticTokens(this._model, range, this._currentRequestCancellationTokenSource.token));
      if (this.isSemanticTokens(tokens)) {
        return { tokens, legend: provider.getLegend() };
      }
    }
    return null;
  }
  _getSemanticTokenAtPosition(semanticTokens, pos) {
    const tokenData = semanticTokens.tokens.data;
    const defaultLanguage = this._model.getLanguageId();
    let lastLine = 0;
    let lastCharacter = 0;
    const posLine = pos.lineNumber - 1, posCharacter = pos.column - 1;
    for (let i = 0; i < tokenData.length; i += 5) {
      const lineDelta = tokenData[i], charDelta = tokenData[i + 1], len = tokenData[i + 2], typeIdx = tokenData[i + 3], modSet = tokenData[i + 4];
      const line = lastLine + lineDelta;
      const character = lineDelta === 0 ? lastCharacter + charDelta : charDelta;
      if (posLine === line && character <= posCharacter && posCharacter < character + len) {
        const type = semanticTokens.legend.tokenTypes[typeIdx] || "not in legend (ignored)";
        const modifiers = [];
        let modifierSet = modSet;
        for (let modifierIndex = 0; modifierSet > 0 && modifierIndex < semanticTokens.legend.tokenModifiers.length; modifierIndex++) {
          if (modifierSet & 1) {
            modifiers.push(semanticTokens.legend.tokenModifiers[modifierIndex]);
          }
          modifierSet = modifierSet >> 1;
        }
        if (modifierSet > 0) {
          modifiers.push("not in legend (ignored)");
        }
        const range = new Range(line + 1, character + 1, line + 1, character + 1 + len);
        const definitions = {};
        const colorMap = this._themeService.getColorTheme().tokenColorMap;
        const theme = this._themeService.getColorTheme();
        const tokenStyle = theme.getTokenStyleMetadata(type, modifiers, defaultLanguage, true, definitions);
        let metadata = void 0;
        if (tokenStyle) {
          metadata = {
            languageId: void 0,
            tokenType: StandardTokenType.Other,
            bold: tokenStyle?.bold,
            italic: tokenStyle?.italic,
            underline: tokenStyle?.underline,
            strikethrough: tokenStyle?.strikethrough,
            foreground: colorMap[tokenStyle?.foreground || ColorId.None],
            background: void 0
          };
        }
        return { type, modifiers, range, metadata, definitions };
      }
      lastLine = line;
      lastCharacter = character;
    }
    return null;
  }
  _walkTreeforPosition(cursor, pos) {
    const offset = this._model.getOffsetAt(pos);
    cursor.gotoFirstChild();
    let goChild = false;
    let lastGoodNode = null;
    do {
      if (cursor.currentNode.startIndex <= offset && offset < cursor.currentNode.endIndex) {
        goChild = true;
        lastGoodNode = cursor.currentNode;
      } else {
        goChild = false;
      }
    } while (goChild ? cursor.gotoFirstChild() : cursor.gotoNextSibling());
    return lastGoodNode;
  }
  _getTreeSitterTokenAtPosition(textModelTreeSitter, pos) {
    let tree = textModelTreeSitter.parseResult;
    if (!tree?.tree) {
      return null;
    }
    const nodes = [];
    do {
      const cursor = tree.tree.walk();
      const node = this._walkTreeforPosition(cursor, pos);
      if (node) {
        nodes.push(node);
        tree = textModelTreeSitter.getInjection(node.startIndex, tree.languageId);
      } else {
        tree = void 0;
      }
    } while (tree?.tree);
    return nodes.length > 0 ? nodes : null;
  }
  _renderTokenStyleDefinition(definition, property) {
    const elements = new Array();
    if (definition === void 0) {
      return elements;
    }
    const theme = this._themeService.getColorTheme();
    if (Array.isArray(definition)) {
      const scopesDefinition = {};
      theme.resolveScopes(definition, scopesDefinition);
      const matchingRule = scopesDefinition[property];
      if (matchingRule && scopesDefinition.scope) {
        const scopes = $("ul.tiw-metadata-values");
        const strScopes = Array.isArray(matchingRule.scope) ? matchingRule.scope : [String(matchingRule.scope)];
        for (const strScope of strScopes) {
          scopes.appendChild($("li.tiw-metadata-value.tiw-metadata-scopes", void 0, strScope));
        }
        elements.push(
          scopesDefinition.scope.join(" "),
          scopes,
          $("code.tiw-theme-selector", void 0, JSON.stringify(matchingRule.settings, null, "	"))
        );
        return elements;
      }
      return elements;
    } else if (SemanticTokenRule.is(definition)) {
      const scope = theme.getTokenStylingRuleScope(definition);
      if (scope === "setting") {
        elements.push(`User settings: ${definition.selector.id} - ${this._renderStyleProperty(definition.style, property)}`);
        return elements;
      } else if (scope === "theme") {
        elements.push(`Color theme: ${definition.selector.id} - ${this._renderStyleProperty(definition.style, property)}`);
        return elements;
      }
      return elements;
    } else {
      const style = theme.resolveTokenStyleValue(definition);
      elements.push(`Default: ${style ? this._renderStyleProperty(style, property) : ""}`);
      return elements;
    }
  }
  _renderStyleProperty(style, property) {
    switch (property) {
      case "foreground":
        return style.foreground ? Color.Format.CSS.formatHexA(style.foreground, true) : "";
      default:
        return style[property] !== void 0 ? String(style[property]) : "";
    }
  }
  getDomNode() {
    return this._domNode;
  }
  getPosition() {
    return {
      position: this._editor.getPosition(),
      preference: [ContentWidgetPositionPreference.BELOW, ContentWidgetPositionPreference.ABOVE]
    };
  }
};
_InspectEditorTokensWidget._ID = "editor.contrib.inspectEditorTokensWidget";
let InspectEditorTokensWidget = _InspectEditorTokensWidget;
registerEditorContribution(InspectEditorTokensController.ID, InspectEditorTokensController, EditorContributionInstantiation.Lazy);
registerEditorAction(InspectEditorTokens);
export {
  InspectEditorTokensController
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvaW5zcGVjdEVkaXRvclRva2Vucy9pbnNwZWN0RWRpdG9yVG9rZW5zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL2luc3BlY3RFZGl0b3JUb2tlbnMuY3NzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQ2hhckNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jaGFyQ29kZS5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UsIElBY3RpdmVDb2RlRWRpdG9yLCBJQ29kZUVkaXRvciwgSUNvbnRlbnRXaWRnZXQsIElDb250ZW50V2lkZ2V0UG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGlvbiwgU2VydmljZXNBY2Nlc3NvciwgcmVnaXN0ZXJFZGl0b3JBY3Rpb24sIHJlZ2lzdGVyRWRpdG9yQ29udHJpYnV0aW9uLCBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgU2VtYW50aWNUb2tlbnNMZWdlbmQsIFNlbWFudGljVG9rZW5zLCBUcmVlU2l0dGVyVG9rZW5pemF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBGb250U3R5bGUsIENvbG9ySWQsIFN0YW5kYXJkVG9rZW5UeXBlLCBUb2tlbk1ldGFkYXRhIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IGZpbmRNYXRjaGluZ1RoZW1lUnVsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3RleHRNYXRlL2NvbW1vbi9UTUhlbHBlci5qcyc7XG5pbXBvcnQgeyBJVGV4dE1hdGVUb2tlbml6YXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvdGV4dE1hdGUvYnJvd3Nlci90ZXh0TWF0ZVRva2VuaXphdGlvbkZlYXR1cmUuanMnO1xuaW1wb3J0IHR5cGUgeyBJR3JhbW1hciwgSVRva2VuLCBTdGF0ZVN0YWNrIH0gZnJvbSAndnNjb2RlLXRleHRtYXRlJztcbmltcG9ydCB7IElXb3JrYmVuY2hUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy90aGVtZXMvY29tbW9uL3dvcmtiZW5jaFRoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2xvclRoZW1lRGF0YSwgVG9rZW5TdHlsZURlZmluaXRpb25zLCBUb2tlblN0eWxlRGVmaW5pdGlvbiwgVGV4dE1hdGVUaGVtaW5nUnVsZURlZmluaXRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvdGhlbWVzL2NvbW1vbi9jb2xvclRoZW1lRGF0YS5qcyc7XG5pbXBvcnQgeyBTZW1hbnRpY1Rva2VuUnVsZSwgVG9rZW5TdHlsZURhdGEsIFRva2VuU3R5bGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgU0VNQU5USUNfSElHSExJR0hUSU5HX1NFVFRJTkdfSUQsIElFZGl0b3JTZW1hbnRpY0hpZ2hsaWdodGluZ09wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zZW1hbnRpY1Rva2Vucy9jb21tb24vc2VtYW50aWNUb2tlbnNDb25maWcuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxUcmVlU2l0dGVyLCBJVHJlZVNpdHRlclBhcnNlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3RyZWVTaXR0ZXJQYXJzZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB0eXBlICogYXMgUGFyc2VyIGZyb20gJ0B2c2NvZGUvdHJlZS1zaXR0ZXItd2FzbSc7XG5cbmNvbnN0ICQgPSBkb20uJDtcblxuZXhwb3J0IGNsYXNzIEluc3BlY3RFZGl0b3JUb2tlbnNDb250cm9sbGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFZGl0b3JDb250cmlidXRpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmNvbnRyaWIuaW5zcGVjdEVkaXRvclRva2Vucyc7XG5cblx0cHVibGljIHN0YXRpYyBnZXQoZWRpdG9yOiBJQ29kZUVkaXRvcik6IEluc3BlY3RFZGl0b3JUb2tlbnNDb250cm9sbGVyIHwgbnVsbCB7XG5cdFx0cmV0dXJuIGVkaXRvci5nZXRDb250cmlidXRpb248SW5zcGVjdEVkaXRvclRva2Vuc0NvbnRyb2xsZXI+KEluc3BlY3RFZGl0b3JUb2tlbnNDb250cm9sbGVyLklEKTtcblx0fVxuXG5cdHByaXZhdGUgX2VkaXRvcjogSUNvZGVFZGl0b3I7XG5cdHByaXZhdGUgX3RleHRNYXRlU2VydmljZTogSVRleHRNYXRlVG9rZW5pemF0aW9uU2VydmljZTtcblx0cHJpdmF0ZSBfdHJlZVNpdHRlclNlcnZpY2U6IElUcmVlU2l0dGVyUGFyc2VyU2VydmljZTtcblx0cHJpdmF0ZSBfdGhlbWVTZXJ2aWNlOiBJV29ya2JlbmNoVGhlbWVTZXJ2aWNlO1xuXHRwcml2YXRlIF9sYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2U7XG5cdHByaXZhdGUgX25vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlO1xuXHRwcml2YXRlIF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlO1xuXHRwcml2YXRlIF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlO1xuXHRwcml2YXRlIF93aWRnZXQ6IEluc3BlY3RFZGl0b3JUb2tlbnNXaWRnZXQgfCBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElUZXh0TWF0ZVRva2VuaXphdGlvblNlcnZpY2UgdGV4dE1hdGVTZXJ2aWNlOiBJVGV4dE1hdGVUb2tlbml6YXRpb25TZXJ2aWNlLFxuXHRcdEBJVHJlZVNpdHRlclBhcnNlclNlcnZpY2UgdHJlZVNpdHRlclNlcnZpY2U6IElUcmVlU2l0dGVyUGFyc2VyU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJV29ya2JlbmNoVGhlbWVTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fZWRpdG9yID0gZWRpdG9yO1xuXHRcdHRoaXMuX3RleHRNYXRlU2VydmljZSA9IHRleHRNYXRlU2VydmljZTtcblx0XHR0aGlzLl90cmVlU2l0dGVyU2VydmljZSA9IHRyZWVTaXR0ZXJTZXJ2aWNlO1xuXHRcdHRoaXMuX3RoZW1lU2VydmljZSA9IHRoZW1lU2VydmljZTtcblx0XHR0aGlzLl9sYW5ndWFnZVNlcnZpY2UgPSBsYW5ndWFnZVNlcnZpY2U7XG5cdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZSA9IG5vdGlmaWNhdGlvblNlcnZpY2U7XG5cdFx0dGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UgPSBjb25maWd1cmF0aW9uU2VydmljZTtcblx0XHR0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlO1xuXHRcdHRoaXMuX3dpZGdldCA9IG51bGw7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbCgoZSkgPT4gdGhpcy5zdG9wKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbExhbmd1YWdlKChlKSA9PiB0aGlzLnN0b3AoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbktleVVwKChlKSA9PiBlLmtleUNvZGUgPT09IEtleUNvZGUuRXNjYXBlICYmIHRoaXMuc3RvcCgpKSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLnN0b3AoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwdWJsaWMgbGF1bmNoKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl93aWRnZXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fZWRpdG9yLmdldE1vZGVsKCkudXJpLnNjaGVtZSA9PT0gU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGwpIHtcblx0XHRcdC8vIGRpc2FibGUgaW4gbm90ZWJvb2tzXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3dpZGdldCA9IG5ldyBJbnNwZWN0RWRpdG9yVG9rZW5zV2lkZ2V0KHRoaXMuX2VkaXRvciwgdGhpcy5fdGV4dE1hdGVTZXJ2aWNlLCB0aGlzLl90cmVlU2l0dGVyU2VydmljZSwgdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLCB0aGlzLl90aGVtZVNlcnZpY2UsIHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UsIHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZSk7XG5cdH1cblxuXHRwdWJsaWMgc3RvcCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fd2lkZ2V0KSB7XG5cdFx0XHR0aGlzLl93aWRnZXQuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fd2lkZ2V0ID0gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgdG9nZ2xlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fd2lkZ2V0KSB7XG5cdFx0XHR0aGlzLmxhdW5jaCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnN0b3AoKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgSW5zcGVjdEVkaXRvclRva2VucyBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLmluc3BlY3RUTVNjb3BlcycsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignaW5zcGVjdEVkaXRvclRva2VucycsIFwiRGV2ZWxvcGVyOiBJbnNwZWN0IEVkaXRvciBUb2tlbnMgYW5kIFNjb3Blc1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Y29uc3QgY29udHJvbGxlciA9IEluc3BlY3RFZGl0b3JUb2tlbnNDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGNvbnRyb2xsZXI/LnRvZ2dsZSgpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJVGV4dE1hdGVUb2tlbkluZm8ge1xuXHR0b2tlbjogSVRva2VuO1xuXHRtZXRhZGF0YTogSURlY29kZWRNZXRhZGF0YTtcbn1cblxuaW50ZXJmYWNlIElTZW1hbnRpY1Rva2VuSW5mbyB7XG5cdHR5cGU6IHN0cmluZztcblx0bW9kaWZpZXJzOiBzdHJpbmdbXTtcblx0cmFuZ2U6IFJhbmdlO1xuXHRtZXRhZGF0YT86IElEZWNvZGVkTWV0YWRhdGE7XG5cdGRlZmluaXRpb25zOiBUb2tlblN0eWxlRGVmaW5pdGlvbnM7XG59XG5cbmludGVyZmFjZSBJRGVjb2RlZE1ldGFkYXRhIHtcblx0bGFuZ3VhZ2VJZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHR0b2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlO1xuXHRib2xkOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRpdGFsaWM6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdHVuZGVybGluZTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0c3RyaWtldGhyb3VnaDogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0Zm9yZWdyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRiYWNrZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIHJlbmRlclRva2VuVGV4dCh0b2tlblRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdGlmICh0b2tlblRleHQubGVuZ3RoID4gNDApIHtcblx0XHR0b2tlblRleHQgPSB0b2tlblRleHQuc3Vic3RyKDAsIDIwKSArICdcdTIwMjYnICsgdG9rZW5UZXh0LnN1YnN0cih0b2tlblRleHQubGVuZ3RoIC0gMjApO1xuXHR9XG5cdGxldCByZXN1bHQ6IHN0cmluZyA9ICcnO1xuXHRmb3IgKGxldCBjaGFySW5kZXggPSAwLCBsZW4gPSB0b2tlblRleHQubGVuZ3RoOyBjaGFySW5kZXggPCBsZW47IGNoYXJJbmRleCsrKSB7XG5cdFx0Y29uc3QgY2hhckNvZGUgPSB0b2tlblRleHQuY2hhckNvZGVBdChjaGFySW5kZXgpO1xuXHRcdHN3aXRjaCAoY2hhckNvZGUpIHtcblx0XHRcdGNhc2UgQ2hhckNvZGUuVGFiOlxuXHRcdFx0XHRyZXN1bHQgKz0gJ1xcdTIxOTInOyAvLyAmcmFycjtcblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgQ2hhckNvZGUuU3BhY2U6XG5cdFx0XHRcdHJlc3VsdCArPSAnXFx1MDBCNyc7IC8vICZtaWRkb3Q7XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXN1bHQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShjaGFyQ29kZSk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbnR5cGUgU2VtYW50aWNUb2tlbnNSZXN1bHQgPSB7IHRva2VuczogU2VtYW50aWNUb2tlbnM7IGxlZ2VuZDogU2VtYW50aWNUb2tlbnNMZWdlbmQgfTtcblxuY2xhc3MgSW5zcGVjdEVkaXRvclRva2Vuc1dpZGdldCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQ29udGVudFdpZGdldCB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX0lEID0gJ2VkaXRvci5jb250cmliLmluc3BlY3RFZGl0b3JUb2tlbnNXaWRnZXQnO1xuXG5cdC8vIEVkaXRvci5JQ29udGVudFdpZGdldC5hbGxvd0VkaXRvck92ZXJmbG93XG5cdHB1YmxpYyByZWFkb25seSBhbGxvd0VkaXRvck92ZXJmbG93ID0gdHJ1ZTtcblxuXHRwcml2YXRlIF9pc0Rpc3Bvc2VkOiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVdvcmtiZW5jaFRoZW1lU2VydmljZTtcblx0cHJpdmF0ZSByZWFkb25seSBfdGV4dE1hdGVTZXJ2aWNlOiBJVGV4dE1hdGVUb2tlbml6YXRpb25TZXJ2aWNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF90cmVlU2l0dGVyU2VydmljZTogSVRyZWVTaXR0ZXJQYXJzZXJTZXJ2aWNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9ub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZTtcblx0cHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZTtcblx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZTtcblx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IElUZXh0TW9kZWw7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RvbU5vZGU6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jdXJyZW50UmVxdWVzdENhbmNlbGxhdGlvblRva2VuU291cmNlOiBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRlZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yLFxuXHRcdHRleHRNYXRlU2VydmljZTogSVRleHRNYXRlVG9rZW5pemF0aW9uU2VydmljZSxcblx0XHR0cmVlU2l0dGVyU2VydmljZTogSVRyZWVTaXR0ZXJQYXJzZXJTZXJ2aWNlLFxuXHRcdGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHR0aGVtZVNlcnZpY2U6IElXb3JrYmVuY2hUaGVtZVNlcnZpY2UsXG5cdFx0bm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IGZhbHNlO1xuXHRcdHRoaXMuX2VkaXRvciA9IGVkaXRvcjtcblx0XHR0aGlzLl9sYW5ndWFnZVNlcnZpY2UgPSBsYW5ndWFnZVNlcnZpY2U7XG5cdFx0dGhpcy5fdGhlbWVTZXJ2aWNlID0gdGhlbWVTZXJ2aWNlO1xuXHRcdHRoaXMuX3RleHRNYXRlU2VydmljZSA9IHRleHRNYXRlU2VydmljZTtcblx0XHR0aGlzLl90cmVlU2l0dGVyU2VydmljZSA9IHRyZWVTaXR0ZXJTZXJ2aWNlO1xuXHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UgPSBub3RpZmljYXRpb25TZXJ2aWNlO1xuXHRcdHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlID0gY29uZmlndXJhdGlvblNlcnZpY2U7XG5cdFx0dGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgPSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTtcblx0XHR0aGlzLl9tb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdHRoaXMuX2RvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTmFtZSA9ICd0b2tlbi1pbnNwZWN0LXdpZGdldCc7XG5cdFx0dGhpcy5fY3VycmVudFJlcXVlc3RDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdHRoaXMuX2JlZ2luQ29tcHV0ZSh0aGlzLl9lZGl0b3IuZ2V0UG9zaXRpb24oKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24oKGUpID0+IHRoaXMuX2JlZ2luQ29tcHV0ZSh0aGlzLl9lZGl0b3IuZ2V0UG9zaXRpb24oKSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGVtZVNlcnZpY2Uub25EaWRDb2xvclRoZW1lQ2hhbmdlKF8gPT4gdGhpcy5fYmVnaW5Db21wdXRlKHRoaXMuX2VkaXRvci5nZXRQb3NpdGlvbigpKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2VkaXRvci5zZW1hbnRpY0hpZ2hsaWdodGluZy5lbmFibGVkJykgJiYgdGhpcy5fYmVnaW5Db21wdXRlKHRoaXMuX2VkaXRvci5nZXRQb3NpdGlvbigpKSkpO1xuXHRcdHRoaXMuX2VkaXRvci5hZGRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0dGhpcy5fZWRpdG9yLnJlbW92ZUNvbnRlbnRXaWRnZXQodGhpcyk7XG5cdFx0dGhpcy5fY3VycmVudFJlcXVlc3RDYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5jYW5jZWwoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gSW5zcGVjdEVkaXRvclRva2Vuc1dpZGdldC5fSUQ7XG5cdH1cblxuXHRwcml2YXRlIF9iZWdpbkNvbXB1dGUocG9zaXRpb246IFBvc2l0aW9uKTogdm9pZCB7XG5cdFx0Y29uc3QgZ3JhbW1hciA9IHRoaXMuX3RleHRNYXRlU2VydmljZS5jcmVhdGVUb2tlbml6ZXIodGhpcy5fbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpKTtcblx0XHRjb25zdCBzZW1hbnRpY1Rva2VucyA9IHRoaXMuX2NvbXB1dGVTZW1hbnRpY1Rva2Vucyhwb3NpdGlvbik7XG5cdFx0Y29uc3QgdHJlZSA9IHRoaXMuX3RyZWVTaXR0ZXJTZXJ2aWNlLmdldFBhcnNlUmVzdWx0KHRoaXMuX21vZGVsKTtcblxuXHRcdGRvbS5jbGVhck5vZGUodGhpcy5fZG9tTm9kZSk7XG5cdFx0dGhpcy5fZG9tTm9kZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShubHMubG9jYWxpemUoJ2luc3BlY3RUTVNjb3Blc1dpZGdldC5sb2FkaW5nJywgXCJMb2FkaW5nLi4uXCIpKSk7XG5cblx0XHRQcm9taXNlLmFsbChbZ3JhbW1hciwgc2VtYW50aWNUb2tlbnNdKS50aGVuKChbZ3JhbW1hciwgc2VtYW50aWNUb2tlbnNdKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9jb21wdXRlKGdyYW1tYXIsIHNlbWFudGljVG9rZW5zLCB0cmVlLCBwb3NpdGlvbik7XG5cdFx0XHR0aGlzLl9kb21Ob2RlLnN0eWxlLm1heFdpZHRoID0gYCR7TWF0aC5tYXgodGhpcy5fZWRpdG9yLmdldExheW91dEluZm8oKS53aWR0aCAqIDAuNjYsIDUwMCl9cHhgO1xuXHRcdFx0dGhpcy5fZWRpdG9yLmxheW91dENvbnRlbnRXaWRnZXQodGhpcyk7XG5cdFx0fSwgKGVycikgPT4ge1xuXHRcdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS53YXJuKGVycik7XG5cblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRJbnNwZWN0RWRpdG9yVG9rZW5zQ29udHJvbGxlci5nZXQodGhpcy5fZWRpdG9yKT8uc3RvcCgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0fVxuXG5cdHByaXZhdGUgX2lzU2VtYW50aWNDb2xvcmluZ0VuYWJsZWQoKSB7XG5cdFx0Y29uc3Qgc2V0dGluZyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElFZGl0b3JTZW1hbnRpY0hpZ2hsaWdodGluZ09wdGlvbnM+KFNFTUFOVElDX0hJR0hMSUdIVElOR19TRVRUSU5HX0lELCB7IG92ZXJyaWRlSWRlbnRpZmllcjogdGhpcy5fbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpLCByZXNvdXJjZTogdGhpcy5fbW9kZWwudXJpIH0pPy5lbmFibGVkO1xuXHRcdGlmICh0eXBlb2Ygc2V0dGluZyA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHRyZXR1cm4gc2V0dGluZztcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkuc2VtYW50aWNIaWdobGlnaHRpbmc7XG5cdH1cblxuXHRwcml2YXRlIF9jb21wdXRlKGdyYW1tYXI6IElHcmFtbWFyIHwgbnVsbCwgc2VtYW50aWNUb2tlbnM6IFNlbWFudGljVG9rZW5zUmVzdWx0IHwgbnVsbCwgdHJlZTogSVRleHRNb2RlbFRyZWVTaXR0ZXIgfCB1bmRlZmluZWQsIHBvc2l0aW9uOiBQb3NpdGlvbikge1xuXHRcdGNvbnN0IHRleHRNYXRlVG9rZW5JbmZvID0gZ3JhbW1hciAmJiB0aGlzLl9nZXRUb2tlbnNBdFBvc2l0aW9uKGdyYW1tYXIsIHBvc2l0aW9uKTtcblx0XHRjb25zdCBzZW1hbnRpY1Rva2VuSW5mbyA9IHNlbWFudGljVG9rZW5zICYmIHRoaXMuX2dldFNlbWFudGljVG9rZW5BdFBvc2l0aW9uKHNlbWFudGljVG9rZW5zLCBwb3NpdGlvbik7XG5cdFx0Y29uc3QgdHJlZVNpdHRlclRva2VuSW5mbyA9IHRyZWUgJiYgdGhpcy5fZ2V0VHJlZVNpdHRlclRva2VuQXRQb3NpdGlvbih0cmVlLCBwb3NpdGlvbik7XG5cdFx0aWYgKCF0ZXh0TWF0ZVRva2VuSW5mbyAmJiAhc2VtYW50aWNUb2tlbkluZm8gJiYgIXRyZWVTaXR0ZXJUb2tlbkluZm8pIHtcblx0XHRcdGRvbS5yZXNldCh0aGlzLl9kb21Ob2RlLCAnTm8gZ3JhbW1hciBvciBzZW1hbnRpYyB0b2tlbnMgYXZhaWxhYmxlLicpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRtTWV0YWRhdGEgPSB0ZXh0TWF0ZVRva2VuSW5mbz8ubWV0YWRhdGE7XG5cdFx0Y29uc3Qgc2VtTWV0YWRhdGEgPSBzZW1hbnRpY1Rva2VuSW5mbz8ubWV0YWRhdGE7XG5cblx0XHRjb25zdCBzZW1Ub2tlblRleHQgPSBzZW1hbnRpY1Rva2VuSW5mbyAmJiByZW5kZXJUb2tlblRleHQodGhpcy5fbW9kZWwuZ2V0VmFsdWVJblJhbmdlKHNlbWFudGljVG9rZW5JbmZvLnJhbmdlKSk7XG5cdFx0Y29uc3QgdG1Ub2tlblRleHQgPSB0ZXh0TWF0ZVRva2VuSW5mbyAmJiByZW5kZXJUb2tlblRleHQodGhpcy5fbW9kZWwuZ2V0TGluZUNvbnRlbnQocG9zaXRpb24ubGluZU51bWJlcikuc3Vic3RyaW5nKHRleHRNYXRlVG9rZW5JbmZvLnRva2VuLnN0YXJ0SW5kZXgsIHRleHRNYXRlVG9rZW5JbmZvLnRva2VuLmVuZEluZGV4KSk7XG5cblx0XHRjb25zdCB0b2tlblRleHQgPSBzZW1Ub2tlblRleHQgfHwgdG1Ub2tlblRleHQgfHwgJyc7XG5cblx0XHRkb20ucmVzZXQodGhpcy5fZG9tTm9kZSxcblx0XHRcdCQoJ2gyLnRpdy10b2tlbicsIHVuZGVmaW5lZCxcblx0XHRcdFx0dG9rZW5UZXh0LFxuXHRcdFx0XHQkKCdzcGFuLnRpdy10b2tlbi1sZW5ndGgnLCB1bmRlZmluZWQsIGAke3Rva2VuVGV4dC5sZW5ndGh9ICR7dG9rZW5UZXh0Lmxlbmd0aCA9PT0gMSA/ICdjaGFyJyA6ICdjaGFycyd9YCkpKTtcblx0XHRkb20uYXBwZW5kKHRoaXMuX2RvbU5vZGUsICQoJ2hyLnRpdy1tZXRhZGF0YS1zZXBhcmF0b3InLCB7ICdzdHlsZSc6ICdjbGVhcjpib3RoJyB9KSk7XG5cdFx0ZG9tLmFwcGVuZCh0aGlzLl9kb21Ob2RlLCAkKCd0YWJsZS50aXctbWV0YWRhdGEtdGFibGUnLCB1bmRlZmluZWQsXG5cdFx0XHQkKCd0Ym9keScsIHVuZGVmaW5lZCxcblx0XHRcdFx0JCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0JCgndGQudGl3LW1ldGFkYXRhLWtleScsIHVuZGVmaW5lZCwgJ2xhbmd1YWdlJyksXG5cdFx0XHRcdFx0JCgndGQudGl3LW1ldGFkYXRhLXZhbHVlJywgdW5kZWZpbmVkLCB0bU1ldGFkYXRhPy5sYW5ndWFnZUlkIHx8ICcnKVxuXHRcdFx0XHQpLFxuXHRcdFx0XHQkKCd0cicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEta2V5JywgdW5kZWZpbmVkLCAnc3RhbmRhcmQgdG9rZW4gdHlwZScgYXMgc3RyaW5nKSxcblx0XHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEtdmFsdWUnLCB1bmRlZmluZWQsIHRoaXMuX3Rva2VuVHlwZVRvU3RyaW5nKHRtTWV0YWRhdGE/LnRva2VuVHlwZSB8fCBTdGFuZGFyZFRva2VuVHlwZS5PdGhlcikpXG5cdFx0XHRcdCksXG5cdFx0XHRcdC4uLnRoaXMuX2Zvcm1hdE1ldGFkYXRhKHNlbU1ldGFkYXRhLCB0bU1ldGFkYXRhKVxuXHRcdFx0KVxuXHRcdCkpO1xuXG5cdFx0aWYgKHNlbWFudGljVG9rZW5JbmZvKSB7XG5cdFx0XHRkb20uYXBwZW5kKHRoaXMuX2RvbU5vZGUsICQoJ2hyLnRpdy1tZXRhZGF0YS1zZXBhcmF0b3InKSk7XG5cdFx0XHRjb25zdCB0YWJsZSA9IGRvbS5hcHBlbmQodGhpcy5fZG9tTm9kZSwgJCgndGFibGUudGl3LW1ldGFkYXRhLXRhYmxlJywgdW5kZWZpbmVkKSk7XG5cdFx0XHRjb25zdCB0Ym9keSA9IGRvbS5hcHBlbmQodGFibGUsICQoJ3Rib2R5JywgdW5kZWZpbmVkLFxuXHRcdFx0XHQkKCd0cicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEta2V5JywgdW5kZWZpbmVkLCAnc2VtYW50aWMgdG9rZW4gdHlwZScgYXMgc3RyaW5nKSxcblx0XHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEtdmFsdWUnLCB1bmRlZmluZWQsIHNlbWFudGljVG9rZW5JbmZvLnR5cGUpXG5cdFx0XHRcdClcblx0XHRcdCkpO1xuXHRcdFx0aWYgKHNlbWFudGljVG9rZW5JbmZvLm1vZGlmaWVycy5sZW5ndGgpIHtcblx0XHRcdFx0ZG9tLmFwcGVuZCh0Ym9keSwgJCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0JCgndGQudGl3LW1ldGFkYXRhLWtleScsIHVuZGVmaW5lZCwgJ21vZGlmaWVycycpLFxuXHRcdFx0XHRcdCQoJ3RkLnRpdy1tZXRhZGF0YS12YWx1ZScsIHVuZGVmaW5lZCwgc2VtYW50aWNUb2tlbkluZm8ubW9kaWZpZXJzLmpvaW4oJyAnKSksXG5cdFx0XHRcdCkpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHNlbWFudGljVG9rZW5JbmZvLm1ldGFkYXRhKSB7XG5cdFx0XHRcdGNvbnN0IHByb3BlcnRpZXM6IChrZXlvZiBUb2tlblN0eWxlRGF0YSlbXSA9IFsnZm9yZWdyb3VuZCcsICdib2xkJywgJ2l0YWxpYycsICd1bmRlcmxpbmUnLCAnc3RyaWtldGhyb3VnaCddO1xuXHRcdFx0XHRjb25zdCBwcm9wZXJ0aWVzQnlEZWZWYWx1ZTogeyBbcnVsZTogc3RyaW5nXTogc3RyaW5nW10gfSA9IHt9O1xuXHRcdFx0XHRjb25zdCBhbGxEZWZWYWx1ZXMgPSBuZXcgQXJyYXk8W0FycmF5PEhUTUxFbGVtZW50IHwgc3RyaW5nPiwgc3RyaW5nXT4oKTsgLy8gcmVtZW1iZXIgdGhlIG9yZGVyXG5cdFx0XHRcdC8vIGZpcnN0IGNvbGxlY3QgdG8gZGV0ZWN0IHdoZW4gdGhlIHNhbWUgcnVsZSBpcyB1c2VkIGZvciBtdWx0aXBsZSBwcm9wZXJ0aWVzXG5cdFx0XHRcdGZvciAoY29uc3QgcHJvcGVydHkgb2YgcHJvcGVydGllcykge1xuXHRcdFx0XHRcdGlmIChzZW1hbnRpY1Rva2VuSW5mby5tZXRhZGF0YVtwcm9wZXJ0eV0gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgZGVmaW5pdGlvbiA9IHNlbWFudGljVG9rZW5JbmZvLmRlZmluaXRpb25zW3Byb3BlcnR5XTtcblx0XHRcdFx0XHRcdGNvbnN0IGRlZlZhbHVlID0gdGhpcy5fcmVuZGVyVG9rZW5TdHlsZURlZmluaXRpb24oZGVmaW5pdGlvbiwgcHJvcGVydHkpO1xuXHRcdFx0XHRcdFx0Y29uc3QgZGVmVmFsdWVTdHIgPSBkZWZWYWx1ZS5tYXAoZWwgPT4gZG9tLmlzSFRNTEVsZW1lbnQoZWwpID8gZWwub3V0ZXJIVE1MIDogZWwpLmpvaW4oKTtcblx0XHRcdFx0XHRcdGxldCBwcm9wZXJ0aWVzID0gcHJvcGVydGllc0J5RGVmVmFsdWVbZGVmVmFsdWVTdHJdO1xuXHRcdFx0XHRcdFx0aWYgKCFwcm9wZXJ0aWVzKSB7XG5cdFx0XHRcdFx0XHRcdHByb3BlcnRpZXNCeURlZlZhbHVlW2RlZlZhbHVlU3RyXSA9IHByb3BlcnRpZXMgPSBbXTtcblx0XHRcdFx0XHRcdFx0YWxsRGVmVmFsdWVzLnB1c2goW2RlZlZhbHVlLCBkZWZWYWx1ZVN0cl0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cHJvcGVydGllcy5wdXNoKHByb3BlcnR5KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yIChjb25zdCBbZGVmVmFsdWUsIGRlZlZhbHVlU3RyXSBvZiBhbGxEZWZWYWx1ZXMpIHtcblx0XHRcdFx0XHRkb20uYXBwZW5kKHRib2R5LCAkKCd0cicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdCQoJ3RkLnRpdy1tZXRhZGF0YS1rZXknLCB1bmRlZmluZWQsIHByb3BlcnRpZXNCeURlZlZhbHVlW2RlZlZhbHVlU3RyXS5qb2luKCcsICcpKSxcblx0XHRcdFx0XHRcdCQoJ3RkLnRpdy1tZXRhZGF0YS12YWx1ZScsIHVuZGVmaW5lZCwgLi4uZGVmVmFsdWUpXG5cdFx0XHRcdFx0KSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGV4dE1hdGVUb2tlbkluZm8pIHtcblx0XHRcdGNvbnN0IHRoZW1lID0gdGhpcy5fdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKTtcblx0XHRcdGRvbS5hcHBlbmQodGhpcy5fZG9tTm9kZSwgJCgnaHIudGl3LW1ldGFkYXRhLXNlcGFyYXRvcicpKTtcblx0XHRcdGNvbnN0IHRhYmxlID0gZG9tLmFwcGVuZCh0aGlzLl9kb21Ob2RlLCAkKCd0YWJsZS50aXctbWV0YWRhdGEtdGFibGUnKSk7XG5cdFx0XHRjb25zdCB0Ym9keSA9IGRvbS5hcHBlbmQodGFibGUsICQoJ3Rib2R5JykpO1xuXG5cdFx0XHRpZiAodG1Ub2tlblRleHQgJiYgdG1Ub2tlblRleHQgIT09IHRva2VuVGV4dCkge1xuXHRcdFx0XHRkb20uYXBwZW5kKHRib2R5LCAkKCd0cicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEta2V5JywgdW5kZWZpbmVkLCAndGV4dG1hdGUgdG9rZW4nIGFzIHN0cmluZyksXG5cdFx0XHRcdFx0JCgndGQudGl3LW1ldGFkYXRhLXZhbHVlJywgdW5kZWZpbmVkLCBgJHt0bVRva2VuVGV4dH0gKCR7dG1Ub2tlblRleHQubGVuZ3RofSlgKVxuXHRcdFx0XHQpKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHNjb3BlcyA9IG5ldyBBcnJheTxIVE1MRWxlbWVudCB8IHN0cmluZz4oKTtcblx0XHRcdGZvciAobGV0IGkgPSB0ZXh0TWF0ZVRva2VuSW5mby50b2tlbi5zY29wZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdFx0c2NvcGVzLnB1c2godGV4dE1hdGVUb2tlbkluZm8udG9rZW4uc2NvcGVzW2ldKTtcblx0XHRcdFx0aWYgKGkgPiAwKSB7XG5cdFx0XHRcdFx0c2NvcGVzLnB1c2goJCgnYnInKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGRvbS5hcHBlbmQodGJvZHksICQoJ3RyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEta2V5JywgdW5kZWZpbmVkLCAndGV4dG1hdGUgc2NvcGVzJyBhcyBzdHJpbmcpLFxuXHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEtdmFsdWUudGl3LW1ldGFkYXRhLXNjb3BlcycsIHVuZGVmaW5lZCwgLi4uc2NvcGVzKSxcblx0XHRcdCkpO1xuXG5cdFx0XHRjb25zdCBtYXRjaGluZ1J1bGUgPSBmaW5kTWF0Y2hpbmdUaGVtZVJ1bGUodGhlbWUsIHRleHRNYXRlVG9rZW5JbmZvLnRva2VuLnNjb3BlcywgZmFsc2UpO1xuXHRcdFx0Y29uc3Qgc2VtRm9yZWdyb3VuZCA9IHNlbWFudGljVG9rZW5JbmZvPy5tZXRhZGF0YT8uZm9yZWdyb3VuZDtcblx0XHRcdGlmIChtYXRjaGluZ1J1bGUpIHtcblx0XHRcdFx0aWYgKHNlbUZvcmVncm91bmQgIT09IHRleHRNYXRlVG9rZW5JbmZvLm1ldGFkYXRhLmZvcmVncm91bmQpIHtcblx0XHRcdFx0XHRsZXQgZGVmVmFsdWUgPSAkKCdjb2RlLnRpdy10aGVtZS1zZWxlY3RvcicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdG1hdGNoaW5nUnVsZS5yYXdTZWxlY3RvciwgJCgnYnInKSwgSlNPTi5zdHJpbmdpZnkobWF0Y2hpbmdSdWxlLnNldHRpbmdzLCBudWxsLCAnXFx0JykpO1xuXHRcdFx0XHRcdGlmIChzZW1Gb3JlZ3JvdW5kKSB7XG5cdFx0XHRcdFx0XHRkZWZWYWx1ZSA9ICQoJ3MnLCB1bmRlZmluZWQsIGRlZlZhbHVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZG9tLmFwcGVuZCh0Ym9keSwgJCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEta2V5JywgdW5kZWZpbmVkLCAnZm9yZWdyb3VuZCcpLFxuXHRcdFx0XHRcdFx0JCgndGQudGl3LW1ldGFkYXRhLXZhbHVlJywgdW5kZWZpbmVkLCBkZWZWYWx1ZSksXG5cdFx0XHRcdFx0KSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoIXNlbUZvcmVncm91bmQpIHtcblx0XHRcdFx0ZG9tLmFwcGVuZCh0Ym9keSwgJCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0JCgndGQudGl3LW1ldGFkYXRhLWtleScsIHVuZGVmaW5lZCwgJ2ZvcmVncm91bmQnKSxcblx0XHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEtdmFsdWUnLCB1bmRlZmluZWQsICdObyB0aGVtZSBzZWxlY3RvcicgYXMgc3RyaW5nKSxcblx0XHRcdFx0KSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRyZWVTaXR0ZXJUb2tlbkluZm8pIHtcblx0XHRcdGNvbnN0IGxhc3RUb2tlbkluZm8gPSB0cmVlU2l0dGVyVG9rZW5JbmZvW3RyZWVTaXR0ZXJUb2tlbkluZm8ubGVuZ3RoIC0gMV07XG5cdFx0XHRkb20uYXBwZW5kKHRoaXMuX2RvbU5vZGUsICQoJ2hyLnRpdy1tZXRhZGF0YS1zZXBhcmF0b3InKSk7XG5cdFx0XHRjb25zdCB0YWJsZSA9IGRvbS5hcHBlbmQodGhpcy5fZG9tTm9kZSwgJCgndGFibGUudGl3LW1ldGFkYXRhLXRhYmxlJykpO1xuXHRcdFx0Y29uc3QgdGJvZHkgPSBkb20uYXBwZW5kKHRhYmxlLCAkKCd0Ym9keScpKTtcblxuXHRcdFx0ZG9tLmFwcGVuZCh0Ym9keSwgJCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdCQoJ3RkLnRpdy1tZXRhZGF0YS1rZXknLCB1bmRlZmluZWQsIGB0cmVlLXNpdHRlciB0b2tlbiAke2xhc3RUb2tlbkluZm8uaWR9YCBhcyBzdHJpbmcpLFxuXHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEtdmFsdWUnLCB1bmRlZmluZWQsIGAke2xhc3RUb2tlbkluZm8udGV4dH1gKVxuXHRcdFx0KSk7XG5cdFx0XHRjb25zdCBzY29wZXMgPSBuZXcgQXJyYXk8SFRNTEVsZW1lbnQgfCBzdHJpbmc+KCk7XG5cdFx0XHRsZXQgaSA9IHRyZWVTaXR0ZXJUb2tlbkluZm8ubGVuZ3RoIC0gMTtcblx0XHRcdGxldCBub2RlID0gdHJlZVNpdHRlclRva2VuSW5mb1tpXTtcblx0XHRcdHdoaWxlIChub2RlLnBhcmVudCB8fCBpID4gMCkge1xuXHRcdFx0XHRzY29wZXMucHVzaChub2RlLnR5cGUpO1xuXHRcdFx0XHRub2RlID0gbm9kZS5wYXJlbnQgPz8gdHJlZVNpdHRlclRva2VuSW5mb1stLWldO1xuXHRcdFx0XHRpZiAobm9kZSkge1xuXHRcdFx0XHRcdHNjb3Blcy5wdXNoKCQoJ2JyJykpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGRvbS5hcHBlbmQodGJvZHksICQoJ3RyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEta2V5JywgdW5kZWZpbmVkLCAndHJlZS1zaXR0ZXIgdHJlZScgYXMgc3RyaW5nKSxcblx0XHRcdFx0JCgndGQudGl3LW1ldGFkYXRhLXZhbHVlLnRpdy1tZXRhZGF0YS1zY29wZXMnLCB1bmRlZmluZWQsIC4uLnNjb3BlcyksXG5cdFx0XHQpKTtcblxuXHRcdFx0Y29uc3QgdG9rZW5pemF0aW9uU3VwcG9ydCA9IFRyZWVTaXR0ZXJUb2tlbml6YXRpb25SZWdpc3RyeS5nZXQodGhpcy5fbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpKTtcblx0XHRcdGNvbnN0IGNhcHR1cmVzID0gdG9rZW5pemF0aW9uU3VwcG9ydD8uY2FwdHVyZUF0UG9zaXRpb24ocG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uLCB0aGlzLl9tb2RlbCk7XG5cdFx0XHRpZiAoY2FwdHVyZXMgJiYgY2FwdHVyZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRkb20uYXBwZW5kKHRib2R5LCAkKCd0cicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEta2V5JywgdW5kZWZpbmVkLCAnZm9yZWdyb3VuZCcpLFxuXHRcdFx0XHRcdCQoJ3RkLnRpdy1tZXRhZGF0YS12YWx1ZScsIHVuZGVmaW5lZCwgY2FwdHVyZXMubWFwKGNhcCA9PiBjYXAubmFtZSkuam9pbignICcpKSxcblx0XHRcdFx0KSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZm9ybWF0TWV0YWRhdGEoc2VtYW50aWM/OiBJRGVjb2RlZE1ldGFkYXRhLCB0bT86IElEZWNvZGVkTWV0YWRhdGEpOiBBcnJheTxIVE1MRWxlbWVudCB8IHN0cmluZz4ge1xuXHRcdGNvbnN0IGVsZW1lbnRzID0gbmV3IEFycmF5PEhUTUxFbGVtZW50IHwgc3RyaW5nPigpO1xuXG5cdFx0ZnVuY3Rpb24gcmVuZGVyKHByb3BlcnR5OiAnZm9yZWdyb3VuZCcgfCAnYmFja2dyb3VuZCcpIHtcblx0XHRcdGNvbnN0IHZhbHVlID0gc2VtYW50aWM/Lltwcm9wZXJ0eV0gfHwgdG0/Lltwcm9wZXJ0eV07XG5cdFx0XHRpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjb25zdCBzZW1hbnRpY1N0eWxlID0gc2VtYW50aWM/Lltwcm9wZXJ0eV0gPyAndGl3LW1ldGFkYXRhLXNlbWFudGljJyA6ICcnO1xuXHRcdFx0XHRlbGVtZW50cy5wdXNoKCQoJ3RyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdCQoJ3RkLnRpdy1tZXRhZGF0YS1rZXknLCB1bmRlZmluZWQsIHByb3BlcnR5KSxcblx0XHRcdFx0XHQkKGB0ZC50aXctbWV0YWRhdGEtdmFsdWUuJHtzZW1hbnRpY1N0eWxlfWAsIHVuZGVmaW5lZCwgdmFsdWUpXG5cdFx0XHRcdCkpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvcmVncm91bmQgPSByZW5kZXIoJ2ZvcmVncm91bmQnKTtcblx0XHRjb25zdCBiYWNrZ3JvdW5kID0gcmVuZGVyKCdiYWNrZ3JvdW5kJyk7XG5cdFx0aWYgKGZvcmVncm91bmQgJiYgYmFja2dyb3VuZCkge1xuXHRcdFx0Y29uc3QgYmFja2dyb3VuZENvbG9yID0gQ29sb3IuZnJvbUhleChiYWNrZ3JvdW5kKSwgZm9yZWdyb3VuZENvbG9yID0gQ29sb3IuZnJvbUhleChmb3JlZ3JvdW5kKTtcblx0XHRcdGlmIChiYWNrZ3JvdW5kQ29sb3IuaXNPcGFxdWUoKSkge1xuXHRcdFx0XHRlbGVtZW50cy5wdXNoKCQoJ3RyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdCQoJ3RkLnRpdy1tZXRhZGF0YS1rZXknLCB1bmRlZmluZWQsICdjb250cmFzdCByYXRpbycgYXMgc3RyaW5nKSxcblx0XHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEtdmFsdWUnLCB1bmRlZmluZWQsIGJhY2tncm91bmRDb2xvci5nZXRDb250cmFzdFJhdGlvKGZvcmVncm91bmRDb2xvci5tYWtlT3BhcXVlKGJhY2tncm91bmRDb2xvcikpLnRvRml4ZWQoMikpXG5cdFx0XHRcdCkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZWxlbWVudHMucHVzaCgkKCd0cicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEta2V5JywgdW5kZWZpbmVkLCAnQ29udHJhc3QgcmF0aW8gY2Fubm90IGJlIHByZWNpc2UgZm9yIGJhY2tncm91bmQgY29sb3JzIHRoYXQgdXNlIHRyYW5zcGFyZW5jeScgYXMgc3RyaW5nKSxcblx0XHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEtdmFsdWUnKVxuXHRcdFx0XHQpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBmb250U3R5bGVMYWJlbHMgPSBuZXcgQXJyYXk8SFRNTEVsZW1lbnQgfCBzdHJpbmc+KCk7XG5cblx0XHRmdW5jdGlvbiBhZGRTdHlsZShrZXk6ICdib2xkJyB8ICdpdGFsaWMnIHwgJ3VuZGVybGluZScgfCAnc3RyaWtldGhyb3VnaCcpIHtcblx0XHRcdGxldCBsYWJlbDogSFRNTEVsZW1lbnQgfCBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoc2VtYW50aWMgJiYgc2VtYW50aWNba2V5XSkge1xuXHRcdFx0XHRsYWJlbCA9ICQoJ3NwYW4udGl3LW1ldGFkYXRhLXNlbWFudGljJywgdW5kZWZpbmVkLCBrZXkpO1xuXHRcdFx0fSBlbHNlIGlmICh0bSAmJiB0bVtrZXldKSB7XG5cdFx0XHRcdGxhYmVsID0ga2V5O1xuXHRcdFx0fVxuXHRcdFx0aWYgKGxhYmVsKSB7XG5cdFx0XHRcdGlmIChmb250U3R5bGVMYWJlbHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Zm9udFN0eWxlTGFiZWxzLnB1c2goJyAnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmb250U3R5bGVMYWJlbHMucHVzaChsYWJlbCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGFkZFN0eWxlKCdib2xkJyk7XG5cdFx0YWRkU3R5bGUoJ2l0YWxpYycpO1xuXHRcdGFkZFN0eWxlKCd1bmRlcmxpbmUnKTtcblx0XHRhZGRTdHlsZSgnc3RyaWtldGhyb3VnaCcpO1xuXHRcdGlmIChmb250U3R5bGVMYWJlbHMubGVuZ3RoKSB7XG5cdFx0XHRlbGVtZW50cy5wdXNoKCQoJ3RyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHQkKCd0ZC50aXctbWV0YWRhdGEta2V5JywgdW5kZWZpbmVkLCAnZm9udCBzdHlsZScgYXMgc3RyaW5nKSxcblx0XHRcdFx0JCgndGQudGl3LW1ldGFkYXRhLXZhbHVlJywgdW5kZWZpbmVkLCAuLi5mb250U3R5bGVMYWJlbHMpXG5cdFx0XHQpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGVsZW1lbnRzO1xuXHR9XG5cblx0cHJpdmF0ZSBfZGVjb2RlTWV0YWRhdGEobWV0YWRhdGE6IG51bWJlcik6IElEZWNvZGVkTWV0YWRhdGEge1xuXHRcdGNvbnN0IGNvbG9yTWFwID0gdGhpcy5fdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKS50b2tlbkNvbG9yTWFwO1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSBUb2tlbk1ldGFkYXRhLmdldExhbmd1YWdlSWQobWV0YWRhdGEpO1xuXHRcdGNvbnN0IHRva2VuVHlwZSA9IFRva2VuTWV0YWRhdGEuZ2V0VG9rZW5UeXBlKG1ldGFkYXRhKTtcblx0XHRjb25zdCBmb250U3R5bGUgPSBUb2tlbk1ldGFkYXRhLmdldEZvbnRTdHlsZShtZXRhZGF0YSk7XG5cdFx0Y29uc3QgZm9yZWdyb3VuZCA9IFRva2VuTWV0YWRhdGEuZ2V0Rm9yZWdyb3VuZChtZXRhZGF0YSk7XG5cdFx0Y29uc3QgYmFja2dyb3VuZCA9IFRva2VuTWV0YWRhdGEuZ2V0QmFja2dyb3VuZChtZXRhZGF0YSk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxhbmd1YWdlSWQ6IHRoaXMuX2xhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWMuZGVjb2RlTGFuZ3VhZ2VJZChsYW5ndWFnZUlkKSxcblx0XHRcdHRva2VuVHlwZTogdG9rZW5UeXBlLFxuXHRcdFx0Ym9sZDogKGZvbnRTdHlsZSAmIEZvbnRTdHlsZS5Cb2xkKSA/IHRydWUgOiB1bmRlZmluZWQsXG5cdFx0XHRpdGFsaWM6IChmb250U3R5bGUgJiBGb250U3R5bGUuSXRhbGljKSA/IHRydWUgOiB1bmRlZmluZWQsXG5cdFx0XHR1bmRlcmxpbmU6IChmb250U3R5bGUgJiBGb250U3R5bGUuVW5kZXJsaW5lKSA/IHRydWUgOiB1bmRlZmluZWQsXG5cdFx0XHRzdHJpa2V0aHJvdWdoOiAoZm9udFN0eWxlICYgRm9udFN0eWxlLlN0cmlrZXRocm91Z2gpID8gdHJ1ZSA6IHVuZGVmaW5lZCxcblx0XHRcdGZvcmVncm91bmQ6IGNvbG9yTWFwW2ZvcmVncm91bmRdLFxuXHRcdFx0YmFja2dyb3VuZDogY29sb3JNYXBbYmFja2dyb3VuZF1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfdG9rZW5UeXBlVG9TdHJpbmcodG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZSk6IHN0cmluZyB7XG5cdFx0c3dpdGNoICh0b2tlblR5cGUpIHtcblx0XHRcdGNhc2UgU3RhbmRhcmRUb2tlblR5cGUuT3RoZXI6IHJldHVybiAnT3RoZXInO1xuXHRcdFx0Y2FzZSBTdGFuZGFyZFRva2VuVHlwZS5Db21tZW50OiByZXR1cm4gJ0NvbW1lbnQnO1xuXHRcdFx0Y2FzZSBTdGFuZGFyZFRva2VuVHlwZS5TdHJpbmc6IHJldHVybiAnU3RyaW5nJztcblx0XHRcdGNhc2UgU3RhbmRhcmRUb2tlblR5cGUuUmVnRXg6IHJldHVybiAnUmVnRXgnO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuICc/Pyc7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0VG9rZW5zQXRQb3NpdGlvbihncmFtbWFyOiBJR3JhbW1hciwgcG9zaXRpb246IFBvc2l0aW9uKTogSVRleHRNYXRlVG9rZW5JbmZvIHtcblx0XHRjb25zdCBsaW5lTnVtYmVyID0gcG9zaXRpb24ubGluZU51bWJlcjtcblx0XHRjb25zdCBzdGF0ZUJlZm9yZUxpbmUgPSB0aGlzLl9nZXRTdGF0ZUJlZm9yZUxpbmUoZ3JhbW1hciwgbGluZU51bWJlcik7XG5cblx0XHRjb25zdCB0b2tlbml6YXRpb25SZXN1bHQxID0gZ3JhbW1hci50b2tlbml6ZUxpbmUodGhpcy5fbW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZU51bWJlciksIHN0YXRlQmVmb3JlTGluZSk7XG5cdFx0Y29uc3QgdG9rZW5pemF0aW9uUmVzdWx0MiA9IGdyYW1tYXIudG9rZW5pemVMaW5lMih0aGlzLl9tb2RlbC5nZXRMaW5lQ29udGVudChsaW5lTnVtYmVyKSwgc3RhdGVCZWZvcmVMaW5lKTtcblxuXHRcdGxldCB0b2tlbjFJbmRleCA9IDA7XG5cdFx0Zm9yIChsZXQgaSA9IHRva2VuaXphdGlvblJlc3VsdDEudG9rZW5zLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRjb25zdCB0ID0gdG9rZW5pemF0aW9uUmVzdWx0MS50b2tlbnNbaV07XG5cdFx0XHRpZiAocG9zaXRpb24uY29sdW1uIC0gMSA+PSB0LnN0YXJ0SW5kZXgpIHtcblx0XHRcdFx0dG9rZW4xSW5kZXggPSBpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgdG9rZW4ySW5kZXggPSAwO1xuXHRcdGZvciAobGV0IGkgPSAodG9rZW5pemF0aW9uUmVzdWx0Mi50b2tlbnMubGVuZ3RoID4+PiAxKTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdGlmIChwb3NpdGlvbi5jb2x1bW4gLSAxID49IHRva2VuaXphdGlvblJlc3VsdDIudG9rZW5zWyhpIDw8IDEpXSkge1xuXHRcdFx0XHR0b2tlbjJJbmRleCA9IGk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHR0b2tlbjogdG9rZW5pemF0aW9uUmVzdWx0MS50b2tlbnNbdG9rZW4xSW5kZXhdLFxuXHRcdFx0bWV0YWRhdGE6IHRoaXMuX2RlY29kZU1ldGFkYXRhKHRva2VuaXphdGlvblJlc3VsdDIudG9rZW5zWyh0b2tlbjJJbmRleCA8PCAxKSArIDFdKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIF9nZXRTdGF0ZUJlZm9yZUxpbmUoZ3JhbW1hcjogSUdyYW1tYXIsIGxpbmVOdW1iZXI6IG51bWJlcik6IFN0YXRlU3RhY2sgfCBudWxsIHtcblx0XHRsZXQgc3RhdGU6IFN0YXRlU3RhY2sgfCBudWxsID0gbnVsbDtcblxuXHRcdGZvciAobGV0IGkgPSAxOyBpIDwgbGluZU51bWJlcjsgaSsrKSB7XG5cdFx0XHRjb25zdCB0b2tlbml6YXRpb25SZXN1bHQgPSBncmFtbWFyLnRva2VuaXplTGluZSh0aGlzLl9tb2RlbC5nZXRMaW5lQ29udGVudChpKSwgc3RhdGUpO1xuXHRcdFx0c3RhdGUgPSB0b2tlbml6YXRpb25SZXN1bHQucnVsZVN0YWNrO1xuXHRcdH1cblxuXHRcdHJldHVybiBzdGF0ZTtcblx0fVxuXG5cdHByaXZhdGUgaXNTZW1hbnRpY1Rva2Vucyh0b2tlbjogYW55KTogdG9rZW4gaXMgU2VtYW50aWNUb2tlbnMge1xuXHRcdHJldHVybiB0b2tlbiAmJiB0b2tlbi5kYXRhO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfY29tcHV0ZVNlbWFudGljVG9rZW5zKHBvc2l0aW9uOiBQb3NpdGlvbik6IFByb21pc2U8U2VtYW50aWNUb2tlbnNSZXN1bHQgfCBudWxsPiB7XG5cdFx0aWYgKCF0aGlzLl9pc1NlbWFudGljQ29sb3JpbmdFbmFibGVkKCkpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRva2VuUHJvdmlkZXJzID0gdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyLm9yZGVyZWQodGhpcy5fbW9kZWwpO1xuXHRcdGlmICh0b2tlblByb3ZpZGVycy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IHByb3ZpZGVyID0gdG9rZW5Qcm92aWRlcnNbMF07XG5cdFx0XHRjb25zdCB0b2tlbnMgPSBhd2FpdCBQcm9taXNlLnJlc29sdmUocHJvdmlkZXIucHJvdmlkZURvY3VtZW50U2VtYW50aWNUb2tlbnModGhpcy5fbW9kZWwsIG51bGwsIHRoaXMuX2N1cnJlbnRSZXF1ZXN0Q2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UudG9rZW4pKTtcblx0XHRcdGlmICh0aGlzLmlzU2VtYW50aWNUb2tlbnModG9rZW5zKSkge1xuXHRcdFx0XHRyZXR1cm4geyB0b2tlbnMsIGxlZ2VuZDogcHJvdmlkZXIuZ2V0TGVnZW5kKCkgfTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgcmFuZ2VUb2tlblByb3ZpZGVycyA9IHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50UmFuZ2VTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyLm9yZGVyZWQodGhpcy5fbW9kZWwpO1xuXHRcdGlmIChyYW5nZVRva2VuUHJvdmlkZXJzLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgcHJvdmlkZXIgPSByYW5nZVRva2VuUHJvdmlkZXJzWzBdO1xuXHRcdFx0Y29uc3QgbGluZU51bWJlciA9IHBvc2l0aW9uLmxpbmVOdW1iZXI7XG5cdFx0XHRjb25zdCByYW5nZSA9IG5ldyBSYW5nZShsaW5lTnVtYmVyLCAxLCBsaW5lTnVtYmVyLCB0aGlzLl9tb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpKTtcblx0XHRcdGNvbnN0IHRva2VucyA9IGF3YWl0IFByb21pc2UucmVzb2x2ZShwcm92aWRlci5wcm92aWRlRG9jdW1lbnRSYW5nZVNlbWFudGljVG9rZW5zKHRoaXMuX21vZGVsLCByYW5nZSwgdGhpcy5fY3VycmVudFJlcXVlc3RDYW5jZWxsYXRpb25Ub2tlblNvdXJjZS50b2tlbikpO1xuXHRcdFx0aWYgKHRoaXMuaXNTZW1hbnRpY1Rva2Vucyh0b2tlbnMpKSB7XG5cdFx0XHRcdHJldHVybiB7IHRva2VucywgbGVnZW5kOiBwcm92aWRlci5nZXRMZWdlbmQoKSB9O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgX2dldFNlbWFudGljVG9rZW5BdFBvc2l0aW9uKHNlbWFudGljVG9rZW5zOiBTZW1hbnRpY1Rva2Vuc1Jlc3VsdCwgcG9zOiBQb3NpdGlvbik6IElTZW1hbnRpY1Rva2VuSW5mbyB8IG51bGwge1xuXHRcdGNvbnN0IHRva2VuRGF0YSA9IHNlbWFudGljVG9rZW5zLnRva2Vucy5kYXRhO1xuXHRcdGNvbnN0IGRlZmF1bHRMYW5ndWFnZSA9IHRoaXMuX21vZGVsLmdldExhbmd1YWdlSWQoKTtcblx0XHRsZXQgbGFzdExpbmUgPSAwO1xuXHRcdGxldCBsYXN0Q2hhcmFjdGVyID0gMDtcblx0XHRjb25zdCBwb3NMaW5lID0gcG9zLmxpbmVOdW1iZXIgLSAxLCBwb3NDaGFyYWN0ZXIgPSBwb3MuY29sdW1uIC0gMTsgLy8gdG8gMC1iYXNlZCBwb3NpdGlvblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdG9rZW5EYXRhLmxlbmd0aDsgaSArPSA1KSB7XG5cdFx0XHRjb25zdCBsaW5lRGVsdGEgPSB0b2tlbkRhdGFbaV0sIGNoYXJEZWx0YSA9IHRva2VuRGF0YVtpICsgMV0sIGxlbiA9IHRva2VuRGF0YVtpICsgMl0sIHR5cGVJZHggPSB0b2tlbkRhdGFbaSArIDNdLCBtb2RTZXQgPSB0b2tlbkRhdGFbaSArIDRdO1xuXHRcdFx0Y29uc3QgbGluZSA9IGxhc3RMaW5lICsgbGluZURlbHRhOyAvLyAwLWJhc2VkXG5cdFx0XHRjb25zdCBjaGFyYWN0ZXIgPSBsaW5lRGVsdGEgPT09IDAgPyBsYXN0Q2hhcmFjdGVyICsgY2hhckRlbHRhIDogY2hhckRlbHRhOyAvLyAwLWJhc2VkXG5cdFx0XHRpZiAocG9zTGluZSA9PT0gbGluZSAmJiBjaGFyYWN0ZXIgPD0gcG9zQ2hhcmFjdGVyICYmIHBvc0NoYXJhY3RlciA8IGNoYXJhY3RlciArIGxlbikge1xuXHRcdFx0XHRjb25zdCB0eXBlID0gc2VtYW50aWNUb2tlbnMubGVnZW5kLnRva2VuVHlwZXNbdHlwZUlkeF0gfHwgJ25vdCBpbiBsZWdlbmQgKGlnbm9yZWQpJztcblx0XHRcdFx0Y29uc3QgbW9kaWZpZXJzID0gW107XG5cdFx0XHRcdGxldCBtb2RpZmllclNldCA9IG1vZFNldDtcblx0XHRcdFx0Zm9yIChsZXQgbW9kaWZpZXJJbmRleCA9IDA7IG1vZGlmaWVyU2V0ID4gMCAmJiBtb2RpZmllckluZGV4IDwgc2VtYW50aWNUb2tlbnMubGVnZW5kLnRva2VuTW9kaWZpZXJzLmxlbmd0aDsgbW9kaWZpZXJJbmRleCsrKSB7XG5cdFx0XHRcdFx0aWYgKG1vZGlmaWVyU2V0ICYgMSkge1xuXHRcdFx0XHRcdFx0bW9kaWZpZXJzLnB1c2goc2VtYW50aWNUb2tlbnMubGVnZW5kLnRva2VuTW9kaWZpZXJzW21vZGlmaWVySW5kZXhdKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bW9kaWZpZXJTZXQgPSBtb2RpZmllclNldCA+PiAxO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChtb2RpZmllclNldCA+IDApIHtcblx0XHRcdFx0XHRtb2RpZmllcnMucHVzaCgnbm90IGluIGxlZ2VuZCAoaWdub3JlZCknKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCByYW5nZSA9IG5ldyBSYW5nZShsaW5lICsgMSwgY2hhcmFjdGVyICsgMSwgbGluZSArIDEsIGNoYXJhY3RlciArIDEgKyBsZW4pO1xuXHRcdFx0XHRjb25zdCBkZWZpbml0aW9ucyA9IHt9O1xuXHRcdFx0XHRjb25zdCBjb2xvck1hcCA9IHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkudG9rZW5Db2xvck1hcDtcblx0XHRcdFx0Y29uc3QgdGhlbWUgPSB0aGlzLl90aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpIGFzIENvbG9yVGhlbWVEYXRhO1xuXHRcdFx0XHRjb25zdCB0b2tlblN0eWxlID0gdGhlbWUuZ2V0VG9rZW5TdHlsZU1ldGFkYXRhKHR5cGUsIG1vZGlmaWVycywgZGVmYXVsdExhbmd1YWdlLCB0cnVlLCBkZWZpbml0aW9ucyk7XG5cblx0XHRcdFx0bGV0IG1ldGFkYXRhOiBJRGVjb2RlZE1ldGFkYXRhIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAodG9rZW5TdHlsZSkge1xuXHRcdFx0XHRcdG1ldGFkYXRhID0ge1xuXHRcdFx0XHRcdFx0bGFuZ3VhZ2VJZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0dG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlcixcblx0XHRcdFx0XHRcdGJvbGQ6IHRva2VuU3R5bGU/LmJvbGQsXG5cdFx0XHRcdFx0XHRpdGFsaWM6IHRva2VuU3R5bGU/Lml0YWxpYyxcblx0XHRcdFx0XHRcdHVuZGVybGluZTogdG9rZW5TdHlsZT8udW5kZXJsaW5lLFxuXHRcdFx0XHRcdFx0c3RyaWtldGhyb3VnaDogdG9rZW5TdHlsZT8uc3RyaWtldGhyb3VnaCxcblx0XHRcdFx0XHRcdGZvcmVncm91bmQ6IGNvbG9yTWFwW3Rva2VuU3R5bGU/LmZvcmVncm91bmQgfHwgQ29sb3JJZC5Ob25lXSxcblx0XHRcdFx0XHRcdGJhY2tncm91bmQ6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4geyB0eXBlLCBtb2RpZmllcnMsIHJhbmdlLCBtZXRhZGF0YSwgZGVmaW5pdGlvbnMgfTtcblx0XHRcdH1cblx0XHRcdGxhc3RMaW5lID0gbGluZTtcblx0XHRcdGxhc3RDaGFyYWN0ZXIgPSBjaGFyYWN0ZXI7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBfd2Fsa1RyZWVmb3JQb3NpdGlvbihjdXJzb3I6IFBhcnNlci5UcmVlQ3Vyc29yLCBwb3M6IFBvc2l0aW9uKTogUGFyc2VyLk5vZGUgfCBudWxsIHtcblx0XHRjb25zdCBvZmZzZXQgPSB0aGlzLl9tb2RlbC5nZXRPZmZzZXRBdChwb3MpO1xuXHRcdGN1cnNvci5nb3RvRmlyc3RDaGlsZCgpO1xuXHRcdGxldCBnb0NoaWxkOiBib29sZWFuID0gZmFsc2U7XG5cdFx0bGV0IGxhc3RHb29kTm9kZTogUGFyc2VyLk5vZGUgfCBudWxsID0gbnVsbDtcblx0XHRkbyB7XG5cdFx0XHRpZiAoY3Vyc29yLmN1cnJlbnROb2RlLnN0YXJ0SW5kZXggPD0gb2Zmc2V0ICYmIG9mZnNldCA8IGN1cnNvci5jdXJyZW50Tm9kZS5lbmRJbmRleCkge1xuXHRcdFx0XHRnb0NoaWxkID0gdHJ1ZTtcblx0XHRcdFx0bGFzdEdvb2ROb2RlID0gY3Vyc29yLmN1cnJlbnROb2RlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Z29DaGlsZCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0gd2hpbGUgKGdvQ2hpbGQgPyBjdXJzb3IuZ290b0ZpcnN0Q2hpbGQoKSA6IGN1cnNvci5nb3RvTmV4dFNpYmxpbmcoKSk7XG5cdFx0cmV0dXJuIGxhc3RHb29kTm9kZTtcblx0fVxuXG5cdHByaXZhdGUgX2dldFRyZWVTaXR0ZXJUb2tlbkF0UG9zaXRpb24odGV4dE1vZGVsVHJlZVNpdHRlcjogSVRleHRNb2RlbFRyZWVTaXR0ZXIsIHBvczogUG9zaXRpb24pOiBQYXJzZXIuTm9kZVtdIHwgbnVsbCB7XG5cdFx0bGV0IHRyZWUgPSB0ZXh0TW9kZWxUcmVlU2l0dGVyLnBhcnNlUmVzdWx0O1xuXHRcdGlmICghdHJlZT8udHJlZSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IG5vZGVzOiBQYXJzZXIuTm9kZVtdID0gW107XG5cdFx0ZG8ge1xuXHRcdFx0Y29uc3QgY3Vyc29yID0gdHJlZS50cmVlLndhbGsoKTtcblx0XHRcdGNvbnN0IG5vZGUgPSB0aGlzLl93YWxrVHJlZWZvclBvc2l0aW9uKGN1cnNvciwgcG9zKTtcblx0XHRcdGlmIChub2RlKSB7XG5cdFx0XHRcdG5vZGVzLnB1c2gobm9kZSk7XG5cdFx0XHRcdHRyZWUgPSB0ZXh0TW9kZWxUcmVlU2l0dGVyLmdldEluamVjdGlvbihub2RlLnN0YXJ0SW5kZXgsIHRyZWUubGFuZ3VhZ2VJZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0cmVlID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0gd2hpbGUgKHRyZWU/LnRyZWUpO1xuXHRcdHJldHVybiBub2Rlcy5sZW5ndGggPiAwID8gbm9kZXMgOiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyVG9rZW5TdHlsZURlZmluaXRpb24oZGVmaW5pdGlvbjogVG9rZW5TdHlsZURlZmluaXRpb24gfCB1bmRlZmluZWQsIHByb3BlcnR5OiBrZXlvZiBUb2tlblN0eWxlRGF0YSk6IEFycmF5PEhUTUxFbGVtZW50IHwgc3RyaW5nPiB7XG5cdFx0Y29uc3QgZWxlbWVudHMgPSBuZXcgQXJyYXk8SFRNTEVsZW1lbnQgfCBzdHJpbmc+KCk7XG5cdFx0aWYgKGRlZmluaXRpb24gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnRzO1xuXHRcdH1cblx0XHRjb25zdCB0aGVtZSA9IHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkgYXMgQ29sb3JUaGVtZURhdGE7XG5cblx0XHRpZiAoQXJyYXkuaXNBcnJheShkZWZpbml0aW9uKSkge1xuXHRcdFx0Y29uc3Qgc2NvcGVzRGVmaW5pdGlvbjogVGV4dE1hdGVUaGVtaW5nUnVsZURlZmluaXRpb25zID0ge307XG5cdFx0XHR0aGVtZS5yZXNvbHZlU2NvcGVzKGRlZmluaXRpb24sIHNjb3Blc0RlZmluaXRpb24pO1xuXHRcdFx0Y29uc3QgbWF0Y2hpbmdSdWxlID0gc2NvcGVzRGVmaW5pdGlvbltwcm9wZXJ0eV07XG5cdFx0XHRpZiAobWF0Y2hpbmdSdWxlICYmIHNjb3Blc0RlZmluaXRpb24uc2NvcGUpIHtcblx0XHRcdFx0Y29uc3Qgc2NvcGVzID0gJCgndWwudGl3LW1ldGFkYXRhLXZhbHVlcycpO1xuXHRcdFx0XHRjb25zdCBzdHJTY29wZXMgPSBBcnJheS5pc0FycmF5KG1hdGNoaW5nUnVsZS5zY29wZSkgPyBtYXRjaGluZ1J1bGUuc2NvcGUgOiBbU3RyaW5nKG1hdGNoaW5nUnVsZS5zY29wZSldO1xuXG5cdFx0XHRcdGZvciAoY29uc3Qgc3RyU2NvcGUgb2Ygc3RyU2NvcGVzKSB7XG5cdFx0XHRcdFx0c2NvcGVzLmFwcGVuZENoaWxkKCQoJ2xpLnRpdy1tZXRhZGF0YS12YWx1ZS50aXctbWV0YWRhdGEtc2NvcGVzJywgdW5kZWZpbmVkLCBzdHJTY29wZSkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZWxlbWVudHMucHVzaChcblx0XHRcdFx0XHRzY29wZXNEZWZpbml0aW9uLnNjb3BlLmpvaW4oJyAnKSxcblx0XHRcdFx0XHRzY29wZXMsXG5cdFx0XHRcdFx0JCgnY29kZS50aXctdGhlbWUtc2VsZWN0b3InLCB1bmRlZmluZWQsIEpTT04uc3RyaW5naWZ5KG1hdGNoaW5nUnVsZS5zZXR0aW5ncywgbnVsbCwgJ1xcdCcpKSk7XG5cdFx0XHRcdHJldHVybiBlbGVtZW50cztcblx0XHRcdH1cblx0XHRcdHJldHVybiBlbGVtZW50cztcblx0XHR9IGVsc2UgaWYgKFNlbWFudGljVG9rZW5SdWxlLmlzKGRlZmluaXRpb24pKSB7XG5cdFx0XHRjb25zdCBzY29wZSA9IHRoZW1lLmdldFRva2VuU3R5bGluZ1J1bGVTY29wZShkZWZpbml0aW9uKTtcblx0XHRcdGlmIChzY29wZSA9PT0gJ3NldHRpbmcnKSB7XG5cdFx0XHRcdGVsZW1lbnRzLnB1c2goYFVzZXIgc2V0dGluZ3M6ICR7ZGVmaW5pdGlvbi5zZWxlY3Rvci5pZH0gLSAke3RoaXMuX3JlbmRlclN0eWxlUHJvcGVydHkoZGVmaW5pdGlvbi5zdHlsZSwgcHJvcGVydHkpfWApO1xuXHRcdFx0XHRyZXR1cm4gZWxlbWVudHM7XG5cdFx0XHR9IGVsc2UgaWYgKHNjb3BlID09PSAndGhlbWUnKSB7XG5cdFx0XHRcdGVsZW1lbnRzLnB1c2goYENvbG9yIHRoZW1lOiAke2RlZmluaXRpb24uc2VsZWN0b3IuaWR9IC0gJHt0aGlzLl9yZW5kZXJTdHlsZVByb3BlcnR5KGRlZmluaXRpb24uc3R5bGUsIHByb3BlcnR5KX1gKTtcblx0XHRcdFx0cmV0dXJuIGVsZW1lbnRzO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGVsZW1lbnRzO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBzdHlsZSA9IHRoZW1lLnJlc29sdmVUb2tlblN0eWxlVmFsdWUoZGVmaW5pdGlvbik7XG5cdFx0XHRlbGVtZW50cy5wdXNoKGBEZWZhdWx0OiAke3N0eWxlID8gdGhpcy5fcmVuZGVyU3R5bGVQcm9wZXJ0eShzdHlsZSwgcHJvcGVydHkpIDogJyd9YCk7XG5cdFx0XHRyZXR1cm4gZWxlbWVudHM7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyU3R5bGVQcm9wZXJ0eShzdHlsZTogVG9rZW5TdHlsZSwgcHJvcGVydHk6IGtleW9mIFRva2VuU3R5bGVEYXRhKSB7XG5cdFx0c3dpdGNoIChwcm9wZXJ0eSkge1xuXHRcdFx0Y2FzZSAnZm9yZWdyb3VuZCc6IHJldHVybiBzdHlsZS5mb3JlZ3JvdW5kID8gQ29sb3IuRm9ybWF0LkNTUy5mb3JtYXRIZXhBKHN0eWxlLmZvcmVncm91bmQsIHRydWUpIDogJyc7XG5cdFx0XHRkZWZhdWx0OiByZXR1cm4gc3R5bGVbcHJvcGVydHldICE9PSB1bmRlZmluZWQgPyBTdHJpbmcoc3R5bGVbcHJvcGVydHldKSA6ICcnO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXREb21Ob2RlKCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5fZG9tTm9kZTtcblx0fVxuXG5cdHB1YmxpYyBnZXRQb3NpdGlvbigpOiBJQ29udGVudFdpZGdldFBvc2l0aW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cG9zaXRpb246IHRoaXMuX2VkaXRvci5nZXRQb3NpdGlvbigpLFxuXHRcdFx0cHJlZmVyZW5jZTogW0NvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQkVMT1csIENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQUJPVkVdXG5cdFx0fTtcblx0fVxufVxuXG5yZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbihJbnNwZWN0RWRpdG9yVG9rZW5zQ29udHJvbGxlci5JRCwgSW5zcGVjdEVkaXRvclRva2Vuc0NvbnRyb2xsZXIsIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24uTGF6eSk7XG5yZWdpc3RlckVkaXRvckFjdGlvbihJbnNwZWN0RWRpdG9yVG9rZW5zKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFlBQVksU0FBUztBQUNyQixZQUFZLFNBQVM7QUFDckIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHVDQUErRztBQUN4SCxTQUFTLGNBQWdDLHNCQUFzQiw0QkFBNEIsdUNBQXVDO0FBRWxJLFNBQVMsYUFBYTtBQUd0QixTQUErQyxzQ0FBc0M7QUFDckYsU0FBUyxXQUFXLFNBQVMsbUJBQW1CLHFCQUFxQjtBQUNy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RSxFQUFFO0FBQ25GLGFBQU87QUFBQSxJQUNSO0FBQUEsRUFDRDtBQUFBLEVBRVEscUJBQXFCLE9BQW1CLFVBQWdDO0FBQy9FLFlBQVEsVUFBVTtBQUFBLE1BQ2pCLEtBQUs7QUFBYyxlQUFPLE1BQU0sYUFBYSxNQUFNLE9BQU8sSUFBSSxXQUFXLE1BQU0sWUFBWSxJQUFJLElBQUk7QUFBQSxNQUNuRztBQUFTLGVBQU8sTUFBTSxRQUFRLE1BQU0sU0FBWSxPQUFPLE1BQU0sUUFBUSxDQUFDLElBQUk7QUFBQSxJQUMzRTtBQUFBLEVBQ0Q7QUFBQSxFQUVPLGFBQTBCO0FBQ2hDLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVPLGNBQXNDO0FBQzVDLFdBQU87QUFBQSxNQUNOLFVBQVUsS0FBSyxRQUFRLFlBQVk7QUFBQSxNQUNuQyxZQUFZLENBQUMsZ0NBQWdDLE9BQU8sZ0NBQWdDLEtBQUs7QUFBQSxJQUMxRjtBQUFBLEVBQ0Q7QUFDRDtBQW5qQk0sMkJBRW1CLE1BQU07QUFGL0IsSUFBTSw0QkFBTjtBQXFqQkEsMkJBQTJCLDhCQUE4QixJQUFJLCtCQUErQixnQ0FBZ0MsSUFBSTtBQUNoSSxxQkFBcUIsbUJBQW1COyIsCiAgIm5hbWVzIjogWyJncmFtbWFyIiwgInNlbWFudGljVG9rZW5zIiwgInByb3BlcnRpZXMiXQp9Cg==
