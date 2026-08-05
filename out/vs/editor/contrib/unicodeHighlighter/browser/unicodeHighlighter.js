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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { CharCode } from "../../../../base/common/charCode.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import * as platform from "../../../../base/common/platform.js";
import { InvisibleCharacters, isBasicASCII } from "../../../../base/common/strings.js";
import "./unicodeHighlighter.css";
import { EditorAction, EditorContributionInstantiation, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { inUntrustedWorkspace, EditorOption, unicodeHighlightConfigKeys } from "../../../common/config/editorOptions.js";
import { TrackedRangeStickiness } from "../../../common/model.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
import { UnicodeHighlighterReasonKind, UnicodeTextModelHighlighter } from "../../../common/services/unicodeTextModelHighlighter.js";
import { IEditorWorkerService } from "../../../common/services/editorWorker.js";
import { ILanguageService } from "../../../common/languages/language.js";
import { isModelDecorationInComment, isModelDecorationInString, isModelDecorationVisible } from "../../../common/viewModel/viewModelDecorations.js";
import { HoverAnchorType, HoverParticipantRegistry } from "../../hover/browser/hoverTypes.js";
import { MarkdownHover, renderMarkdownHovers } from "../../hover/browser/markdownHoverParticipant.js";
import { BannerController } from "./bannerController.js";
import * as nls from "../../../../nls.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
const warningIcon = registerIcon("extensions-warning-message", Codicon.warning, nls.localize("warningIcon", "Icon shown with a warning message in the extensions editor."));
let UnicodeHighlighter = class extends Disposable {
  constructor(_editor, _editorWorkerService, _workspaceTrustService, instantiationService) {
    super();
    this._editor = _editor;
    this._editorWorkerService = _editorWorkerService;
    this._workspaceTrustService = _workspaceTrustService;
    this._highlighter = null;
    this._bannerClosed = false;
    this._updateState = (state) => {
      if (state && state.hasMore) {
        if (this._bannerClosed) {
          return;
        }
        const max = Math.max(state.ambiguousCharacterCount, state.nonBasicAsciiCharacterCount, state.invisibleCharacterCount);
        let data;
        if (state.nonBasicAsciiCharacterCount >= max) {
          data = {
            message: nls.localize("unicodeHighlighting.thisDocumentHasManyNonBasicAsciiUnicodeCharacters", "This document contains many non-basic ASCII unicode characters"),
            command: new DisableHighlightingOfNonBasicAsciiCharactersAction()
          };
        } else if (state.ambiguousCharacterCount >= max) {
          data = {
            message: nls.localize("unicodeHighlighting.thisDocumentHasManyAmbiguousUnicodeCharacters", "This document contains many ambiguous unicode characters"),
            command: new DisableHighlightingOfAmbiguousCharactersAction()
          };
        } else if (state.invisibleCharacterCount >= max) {
          data = {
            message: nls.localize("unicodeHighlighting.thisDocumentHasManyInvisibleUnicodeCharacters", "This document contains many invisible unicode characters"),
            command: new DisableHighlightingOfInvisibleCharactersAction()
          };
        } else {
          throw new Error("Unreachable");
        }
        this._bannerController.show({
          id: "unicodeHighlightBanner",
          message: data.message,
          icon: warningIcon,
          actions: [
            {
              label: data.command.shortLabel,
              href: `command:${data.command.desc.id}`
            }
          ],
          onClose: () => {
            this._bannerClosed = true;
          }
        });
      } else {
        this._bannerController.hide();
      }
    };
    this._bannerController = this._register(instantiationService.createInstance(BannerController, _editor));
    this._register(this._editor.onDidChangeModel(() => {
      this._bannerClosed = false;
      this._updateHighlighter();
    }));
    this._options = _editor.getOption(EditorOption.unicodeHighlighting);
    this._register(_workspaceTrustService.onDidChangeTrust((e) => {
      this._updateHighlighter();
    }));
    this._register(_editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.unicodeHighlighting)) {
        this._options = _editor.getOption(EditorOption.unicodeHighlighting);
        this._updateHighlighter();
      }
    }));
    this._updateHighlighter();
  }
  dispose() {
    if (this._highlighter) {
      this._highlighter.dispose();
      this._highlighter = null;
    }
    super.dispose();
  }
  _updateHighlighter() {
    this._updateState(null);
    if (this._highlighter) {
      this._highlighter.dispose();
      this._highlighter = null;
    }
    if (!this._editor.hasModel()) {
      return;
    }
    const options = resolveOptions(this._workspaceTrustService.isWorkspaceTrusted(), this._options);
    if ([
      options.nonBasicASCII,
      options.ambiguousCharacters,
      options.invisibleCharacters
    ].every((option) => option === false)) {
      return;
    }
    const highlightOptions = {
      nonBasicASCII: options.nonBasicASCII,
      ambiguousCharacters: options.ambiguousCharacters,
      invisibleCharacters: options.invisibleCharacters,
      includeComments: options.includeComments,
      includeStrings: options.includeStrings,
      allowedCodePoints: Object.keys(options.allowedCharacters).map((c) => c.codePointAt(0)),
      allowedLocales: Object.keys(options.allowedLocales).map((locale) => {
        if (locale === "_os") {
          const osLocale = new Intl.NumberFormat().resolvedOptions().locale;
          return osLocale;
        } else if (locale === "_vscode") {
          return platform.language;
        }
        return locale;
      })
    };
    if (this._editorWorkerService.canComputeUnicodeHighlights(this._editor.getModel().uri)) {
      this._highlighter = new DocumentUnicodeHighlighter(this._editor, highlightOptions, this._updateState, this._editorWorkerService);
    } else {
      this._highlighter = new ViewportUnicodeHighlighter(this._editor, highlightOptions, this._updateState);
    }
  }
  getDecorationInfo(decoration) {
    if (this._highlighter) {
      return this._highlighter.getDecorationInfo(decoration);
    }
    return null;
  }
};
UnicodeHighlighter.ID = "editor.contrib.unicodeHighlighter";
UnicodeHighlighter = __decorateClass([
  __decorateParam(1, IEditorWorkerService),
  __decorateParam(2, IWorkspaceTrustManagementService),
  __decorateParam(3, IInstantiationService)
], UnicodeHighlighter);
function resolveOptions(trusted, options) {
  return {
    nonBasicASCII: options.nonBasicASCII === inUntrustedWorkspace ? !trusted : options.nonBasicASCII,
    ambiguousCharacters: options.ambiguousCharacters,
    invisibleCharacters: options.invisibleCharacters,
    includeComments: options.includeComments === inUntrustedWorkspace ? !trusted : options.includeComments,
    includeStrings: options.includeStrings === inUntrustedWorkspace ? !trusted : options.includeStrings,
    allowedCharacters: options.allowedCharacters,
    allowedLocales: options.allowedLocales
  };
}
let DocumentUnicodeHighlighter = class extends Disposable {
  constructor(_editor, _options, _updateState, _editorWorkerService) {
    super();
    this._editor = _editor;
    this._options = _options;
    this._updateState = _updateState;
    this._editorWorkerService = _editorWorkerService;
    this._model = this._editor.getModel();
    this._decorations = this._editor.createDecorationsCollection();
    this._updateSoon = this._register(new RunOnceScheduler(() => this._update(), 250));
    this._register(this._editor.onDidChangeModelContent(() => {
      this._updateSoon.schedule();
    }));
    this._updateSoon.schedule();
  }
  dispose() {
    this._decorations.clear();
    super.dispose();
  }
  _update() {
    if (this._model.isDisposed()) {
      return;
    }
    if (!this._model.mightContainNonBasicASCII()) {
      this._decorations.clear();
      return;
    }
    const modelVersionId = this._model.getVersionId();
    this._editorWorkerService.computedUnicodeHighlights(this._model.uri, this._options).then((info) => {
      if (this._model.isDisposed()) {
        return;
      }
      if (this._model.getVersionId() !== modelVersionId) {
        return;
      }
      this._updateState(info);
      const decorations = [];
      if (!info.hasMore) {
        for (const range of info.ranges) {
          decorations.push({
            range,
            options: Decorations.instance.getDecorationFromOptions(this._options)
          });
        }
      }
      this._decorations.set(decorations);
    });
  }
  getDecorationInfo(decoration) {
    if (!this._decorations.has(decoration)) {
      return null;
    }
    const model = this._editor.getModel();
    if (!isModelDecorationVisible(model, decoration)) {
      return null;
    }
    const text = model.getValueInRange(decoration.range);
    return {
      reason: computeReason(text, this._options),
      inComment: isModelDecorationInComment(model, decoration),
      inString: isModelDecorationInString(model, decoration)
    };
  }
};
DocumentUnicodeHighlighter = __decorateClass([
  __decorateParam(3, IEditorWorkerService)
], DocumentUnicodeHighlighter);
class ViewportUnicodeHighlighter extends Disposable {
  constructor(_editor, _options, _updateState) {
    super();
    this._editor = _editor;
    this._options = _options;
    this._updateState = _updateState;
    this._model = this._editor.getModel();
    this._decorations = this._editor.createDecorationsCollection();
    this._updateSoon = this._register(new RunOnceScheduler(() => this._update(), 250));
    this._register(this._editor.onDidLayoutChange(() => {
      this._updateSoon.schedule();
    }));
    this._register(this._editor.onDidScrollChange(() => {
      this._updateSoon.schedule();
    }));
    this._register(this._editor.onDidChangeHiddenAreas(() => {
      this._updateSoon.schedule();
    }));
    this._register(this._editor.onDidChangeModelContent(() => {
      this._updateSoon.schedule();
    }));
    this._updateSoon.schedule();
  }
  dispose() {
    this._decorations.clear();
    super.dispose();
  }
  _update() {
    if (this._model.isDisposed()) {
      return;
    }
    if (!this._model.mightContainNonBasicASCII()) {
      this._decorations.clear();
      return;
    }
    const ranges = this._editor.getVisibleRanges();
    const decorations = [];
    const totalResult = {
      ranges: [],
      ambiguousCharacterCount: 0,
      invisibleCharacterCount: 0,
      nonBasicAsciiCharacterCount: 0,
      hasMore: false
    };
    for (const range of ranges) {
      const result = UnicodeTextModelHighlighter.computeUnicodeHighlights(this._model, this._options, range);
      for (const r of result.ranges) {
        totalResult.ranges.push(r);
      }
      totalResult.ambiguousCharacterCount += totalResult.ambiguousCharacterCount;
      totalResult.invisibleCharacterCount += totalResult.invisibleCharacterCount;
      totalResult.nonBasicAsciiCharacterCount += totalResult.nonBasicAsciiCharacterCount;
      totalResult.hasMore = totalResult.hasMore || result.hasMore;
    }
    if (!totalResult.hasMore) {
      for (const range of totalResult.ranges) {
        decorations.push({ range, options: Decorations.instance.getDecorationFromOptions(this._options) });
      }
    }
    this._updateState(totalResult);
    this._decorations.set(decorations);
  }
  getDecorationInfo(decoration) {
    if (!this._decorations.has(decoration)) {
      return null;
    }
    const model = this._editor.getModel();
    const text = model.getValueInRange(decoration.range);
    if (!isModelDecorationVisible(model, decoration)) {
      return null;
    }
    return {
      reason: computeReason(text, this._options),
      inComment: isModelDecorationInComment(model, decoration),
      inString: isModelDecorationInString(model, decoration)
    };
  }
}
class UnicodeHighlighterHover {
  constructor(owner, range, decoration) {
    this.owner = owner;
    this.range = range;
    this.decoration = decoration;
  }
  isValidForHoverAnchor(anchor) {
    return anchor.type === HoverAnchorType.Range && this.range.startColumn <= anchor.range.startColumn && this.range.endColumn >= anchor.range.endColumn;
  }
}
const configureUnicodeHighlightOptionsStr = nls.localize("unicodeHighlight.configureUnicodeHighlightOptions", "Configure Unicode Highlight Options");
let UnicodeHighlighterHoverParticipant = class {
  constructor(_editor, _languageService, _openerService) {
    this._editor = _editor;
    this._languageService = _languageService;
    this._openerService = _openerService;
    this.hoverOrdinal = 5;
  }
  computeSync(anchor, lineDecorations) {
    if (!this._editor.hasModel() || anchor.type !== HoverAnchorType.Range) {
      return [];
    }
    const model = this._editor.getModel();
    const unicodeHighlighter = this._editor.getContribution(UnicodeHighlighter.ID);
    if (!unicodeHighlighter) {
      return [];
    }
    const result = [];
    const existedReason = /* @__PURE__ */ new Set();
    let index = 300;
    for (const d of lineDecorations) {
      const highlightInfo = unicodeHighlighter.getDecorationInfo(d);
      if (!highlightInfo) {
        continue;
      }
      const char = model.getValueInRange(d.range);
      const codePoint = char.codePointAt(0);
      const codePointStr = formatCodePointMarkdown(codePoint);
      let reason;
      switch (highlightInfo.reason.kind) {
        case UnicodeHighlighterReasonKind.Ambiguous: {
          if (isBasicASCII(highlightInfo.reason.confusableWith)) {
            reason = nls.localize(
              "unicodeHighlight.characterIsAmbiguousASCII",
              "The character {0} could be confused with the ASCII character {1}, which is more common in source code.",
              codePointStr,
              formatCodePointMarkdown(highlightInfo.reason.confusableWith.codePointAt(0))
            );
          } else {
            reason = nls.localize(
              "unicodeHighlight.characterIsAmbiguous",
              "The character {0} could be confused with the character {1}, which is more common in source code.",
              codePointStr,
              formatCodePointMarkdown(highlightInfo.reason.confusableWith.codePointAt(0))
            );
          }
          break;
        }
        case UnicodeHighlighterReasonKind.Invisible:
          reason = nls.localize(
            "unicodeHighlight.characterIsInvisible",
            "The character {0} is invisible.",
            codePointStr
          );
          break;
        case UnicodeHighlighterReasonKind.NonBasicAscii:
          reason = nls.localize(
            "unicodeHighlight.characterIsNonBasicAscii",
            "The character {0} is not a basic ASCII character.",
            codePointStr
          );
          break;
      }
      if (existedReason.has(reason)) {
        continue;
      }
      existedReason.add(reason);
      const adjustSettingsArgs = {
        codePoint,
        reason: highlightInfo.reason,
        inComment: highlightInfo.inComment,
        inString: highlightInfo.inString
      };
      const adjustSettings = nls.localize("unicodeHighlight.adjustSettings", "Adjust settings");
      const uri = `command:${ShowExcludeOptions.ID}?${encodeURIComponent(JSON.stringify(adjustSettingsArgs))}`;
      const markdown = new MarkdownString("", true).appendMarkdown(reason).appendText(" ").appendLink(uri, adjustSettings, configureUnicodeHighlightOptionsStr);
      result.push(new MarkdownHover(this, d.range, [markdown], false, index++));
    }
    return result;
  }
  renderHoverParts(context, hoverParts) {
    return renderMarkdownHovers(context, hoverParts, this._editor, this._languageService, this._openerService);
  }
  getAccessibleContent(hoverPart) {
    return hoverPart.contents.map((c) => c.value).join("\n");
  }
};
UnicodeHighlighterHoverParticipant = __decorateClass([
  __decorateParam(1, ILanguageService),
  __decorateParam(2, IOpenerService)
], UnicodeHighlighterHoverParticipant);
function codePointToHex(codePoint) {
  return `U+${codePoint.toString(16).padStart(4, "0")}`;
}
function formatCodePointMarkdown(codePoint) {
  let value = `\`${codePointToHex(codePoint)}\``;
  if (!InvisibleCharacters.isInvisibleCharacter(codePoint)) {
    value += ` "${`${renderCodePointAsInlineCode(codePoint)}`}"`;
  }
  return value;
}
function renderCodePointAsInlineCode(codePoint) {
  if (codePoint === CharCode.BackTick) {
    return "`` ` ``";
  }
  return "`" + String.fromCodePoint(codePoint) + "`";
}
function computeReason(char, options) {
  return UnicodeTextModelHighlighter.computeUnicodeHighlightReason(char, options);
}
const _Decorations = class _Decorations {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  getDecorationFromOptions(options) {
    return this.getDecoration(!options.includeComments, !options.includeStrings);
  }
  getDecoration(hideInComments, hideInStrings) {
    const key = `${hideInComments}${hideInStrings}`;
    let options = this.map.get(key);
    if (!options) {
      options = ModelDecorationOptions.createDynamic({
        description: "unicode-highlight",
        stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        className: "unicode-highlight",
        showIfCollapsed: true,
        overviewRuler: null,
        minimap: null,
        hideInCommentTokens: hideInComments,
        hideInStringTokens: hideInStrings
      });
      this.map.set(key, options);
    }
    return options;
  }
};
_Decorations.instance = new _Decorations();
let Decorations = _Decorations;
class DisableHighlightingInCommentsAction extends EditorAction {
  constructor() {
    super({
      id: DisableHighlightingOfAmbiguousCharactersAction.ID,
      label: nls.localize2("action.unicodeHighlight.disableHighlightingInComments", "Disable highlighting of characters in comments"),
      precondition: void 0
    });
    this.shortLabel = nls.localize("unicodeHighlight.disableHighlightingInComments.shortLabel", "Disable Highlight In Comments");
  }
  async run(accessor, editor, args) {
    const configurationService = accessor?.get(IConfigurationService);
    if (configurationService) {
      this.runAction(configurationService);
    }
  }
  async runAction(configurationService) {
    await configurationService.updateValue(unicodeHighlightConfigKeys.includeComments, false, ConfigurationTarget.USER);
  }
}
DisableHighlightingInCommentsAction.ID = "editor.action.unicodeHighlight.disableHighlightingInComments";
class DisableHighlightingInStringsAction extends EditorAction {
  constructor() {
    super({
      id: DisableHighlightingOfAmbiguousCharactersAction.ID,
      label: nls.localize2("action.unicodeHighlight.disableHighlightingInStrings", "Disable highlighting of characters in strings"),
      precondition: void 0
    });
    this.shortLabel = nls.localize("unicodeHighlight.disableHighlightingInStrings.shortLabel", "Disable Highlight In Strings");
  }
  async run(accessor, editor, args) {
    const configurationService = accessor?.get(IConfigurationService);
    if (configurationService) {
      this.runAction(configurationService);
    }
  }
  async runAction(configurationService) {
    await configurationService.updateValue(unicodeHighlightConfigKeys.includeStrings, false, ConfigurationTarget.USER);
  }
}
DisableHighlightingInStringsAction.ID = "editor.action.unicodeHighlight.disableHighlightingInStrings";
const _DisableHighlightingOfAmbiguousCharactersAction = class _DisableHighlightingOfAmbiguousCharactersAction extends Action2 {
  constructor() {
    super({
      id: _DisableHighlightingOfAmbiguousCharactersAction.ID,
      title: nls.localize2("action.unicodeHighlight.disableHighlightingOfAmbiguousCharacters", "Disable highlighting of ambiguous characters"),
      precondition: void 0,
      f1: false
    });
    this.shortLabel = nls.localize("unicodeHighlight.disableHighlightingOfAmbiguousCharacters.shortLabel", "Disable Ambiguous Highlight");
  }
  async run(accessor, editor, args) {
    const configurationService = accessor?.get(IConfigurationService);
    if (configurationService) {
      this.runAction(configurationService);
    }
  }
  async runAction(configurationService) {
    await configurationService.updateValue(unicodeHighlightConfigKeys.ambiguousCharacters, false, ConfigurationTarget.USER);
  }
};
_DisableHighlightingOfAmbiguousCharactersAction.ID = "editor.action.unicodeHighlight.disableHighlightingOfAmbiguousCharacters";
let DisableHighlightingOfAmbiguousCharactersAction = _DisableHighlightingOfAmbiguousCharactersAction;
const _DisableHighlightingOfInvisibleCharactersAction = class _DisableHighlightingOfInvisibleCharactersAction extends Action2 {
  constructor() {
    super({
      id: _DisableHighlightingOfInvisibleCharactersAction.ID,
      title: nls.localize2("action.unicodeHighlight.disableHighlightingOfInvisibleCharacters", "Disable highlighting of invisible characters"),
      precondition: void 0,
      f1: false
    });
    this.shortLabel = nls.localize("unicodeHighlight.disableHighlightingOfInvisibleCharacters.shortLabel", "Disable Invisible Highlight");
  }
  async run(accessor, editor, args) {
    const configurationService = accessor?.get(IConfigurationService);
    if (configurationService) {
      this.runAction(configurationService);
    }
  }
  async runAction(configurationService) {
    await configurationService.updateValue(unicodeHighlightConfigKeys.invisibleCharacters, false, ConfigurationTarget.USER);
  }
};
_DisableHighlightingOfInvisibleCharactersAction.ID = "editor.action.unicodeHighlight.disableHighlightingOfInvisibleCharacters";
let DisableHighlightingOfInvisibleCharactersAction = _DisableHighlightingOfInvisibleCharactersAction;
const _DisableHighlightingOfNonBasicAsciiCharactersAction = class _DisableHighlightingOfNonBasicAsciiCharactersAction extends Action2 {
  constructor() {
    super({
      id: _DisableHighlightingOfNonBasicAsciiCharactersAction.ID,
      title: nls.localize2("action.unicodeHighlight.disableHighlightingOfNonBasicAsciiCharacters", "Disable highlighting of non basic ASCII characters"),
      precondition: void 0,
      f1: false
    });
    this.shortLabel = nls.localize("unicodeHighlight.disableHighlightingOfNonBasicAsciiCharacters.shortLabel", "Disable Non ASCII Highlight");
  }
  async run(accessor, editor, args) {
    const configurationService = accessor?.get(IConfigurationService);
    if (configurationService) {
      this.runAction(configurationService);
    }
  }
  async runAction(configurationService) {
    await configurationService.updateValue(unicodeHighlightConfigKeys.nonBasicASCII, false, ConfigurationTarget.USER);
  }
};
_DisableHighlightingOfNonBasicAsciiCharactersAction.ID = "editor.action.unicodeHighlight.disableHighlightingOfNonBasicAsciiCharacters";
let DisableHighlightingOfNonBasicAsciiCharactersAction = _DisableHighlightingOfNonBasicAsciiCharactersAction;
const _ShowExcludeOptions = class _ShowExcludeOptions extends Action2 {
  constructor() {
    super({
      id: _ShowExcludeOptions.ID,
      title: nls.localize2("action.unicodeHighlight.showExcludeOptions", "Show Exclude Options"),
      precondition: void 0,
      f1: false
    });
  }
  async run(accessor, args) {
    const { codePoint, reason, inString, inComment } = args;
    const char = String.fromCodePoint(codePoint);
    const quickPickService = accessor.get(IQuickInputService);
    const configurationService = accessor.get(IConfigurationService);
    function getExcludeCharFromBeingHighlightedLabel(codePoint2) {
      if (InvisibleCharacters.isInvisibleCharacter(codePoint2)) {
        return nls.localize("unicodeHighlight.excludeInvisibleCharFromBeingHighlighted", "Exclude {0} (invisible character) from being highlighted", codePointToHex(codePoint2));
      }
      return nls.localize("unicodeHighlight.excludeCharFromBeingHighlighted", "Exclude {0} from being highlighted", `${codePointToHex(codePoint2)} "${char}"`);
    }
    const options = [];
    if (reason.kind === UnicodeHighlighterReasonKind.Ambiguous) {
      for (const locale of reason.notAmbiguousInLocales) {
        options.push({
          label: nls.localize("unicodeHighlight.allowCommonCharactersInLanguage", 'Allow unicode characters that are more common in the language "{0}".', locale),
          run: async () => {
            excludeLocaleFromBeingHighlighted(configurationService, [locale]);
          }
        });
      }
    }
    options.push(
      {
        label: getExcludeCharFromBeingHighlightedLabel(codePoint),
        run: () => excludeCharFromBeingHighlighted(configurationService, [codePoint])
      }
    );
    if (inComment) {
      const action = new DisableHighlightingInCommentsAction();
      options.push({ label: action.label, run: async () => action.runAction(configurationService) });
    } else if (inString) {
      const action = new DisableHighlightingInStringsAction();
      options.push({ label: action.label, run: async () => action.runAction(configurationService) });
    }
    function getTitle(options2) {
      return typeof options2.desc.title === "string" ? options2.desc.title : options2.desc.title.value;
    }
    if (reason.kind === UnicodeHighlighterReasonKind.Ambiguous) {
      const action = new DisableHighlightingOfAmbiguousCharactersAction();
      options.push({ label: getTitle(action), run: async () => action.runAction(configurationService) });
    } else if (reason.kind === UnicodeHighlighterReasonKind.Invisible) {
      const action = new DisableHighlightingOfInvisibleCharactersAction();
      options.push({ label: getTitle(action), run: async () => action.runAction(configurationService) });
    } else if (reason.kind === UnicodeHighlighterReasonKind.NonBasicAscii) {
      const action = new DisableHighlightingOfNonBasicAsciiCharactersAction();
      options.push({ label: getTitle(action), run: async () => action.runAction(configurationService) });
    } else {
      expectNever(reason);
    }
    const result = await quickPickService.pick(
      options,
      { title: configureUnicodeHighlightOptionsStr }
    );
    if (result) {
      await result.run();
    }
  }
};
_ShowExcludeOptions.ID = "editor.action.unicodeHighlight.showExcludeOptions";
let ShowExcludeOptions = _ShowExcludeOptions;
async function excludeCharFromBeingHighlighted(configurationService, charCodes) {
  const existingValue = configurationService.getValue(unicodeHighlightConfigKeys.allowedCharacters);
  let value;
  if (typeof existingValue === "object" && existingValue) {
    value = existingValue;
  } else {
    value = {};
  }
  for (const charCode of charCodes) {
    value[String.fromCodePoint(charCode)] = true;
  }
  await configurationService.updateValue(unicodeHighlightConfigKeys.allowedCharacters, value, ConfigurationTarget.USER);
}
async function excludeLocaleFromBeingHighlighted(configurationService, locales) {
  const existingValue = configurationService.inspect(unicodeHighlightConfigKeys.allowedLocales).user?.value;
  let value;
  if (typeof existingValue === "object" && existingValue) {
    value = Object.assign({}, existingValue);
  } else {
    value = {};
  }
  for (const locale of locales) {
    value[locale] = true;
  }
  await configurationService.updateValue(unicodeHighlightConfigKeys.allowedLocales, value, ConfigurationTarget.USER);
}
function expectNever(value) {
  throw new Error(`Unexpected value: ${value}`);
}
registerAction2(DisableHighlightingOfAmbiguousCharactersAction);
registerAction2(DisableHighlightingOfInvisibleCharactersAction);
registerAction2(DisableHighlightingOfNonBasicAsciiCharactersAction);
registerAction2(ShowExcludeOptions);
registerEditorContribution(UnicodeHighlighter.ID, UnicodeHighlighter, EditorContributionInstantiation.AfterFirstRender);
HoverParticipantRegistry.register(UnicodeHighlighterHoverParticipant);
export {
  DisableHighlightingInCommentsAction,
  DisableHighlightingInStringsAction,
  DisableHighlightingOfAmbiguousCharactersAction,
  DisableHighlightingOfInvisibleCharactersAction,
  DisableHighlightingOfNonBasicAsciiCharactersAction,
  ShowExcludeOptions,
  UnicodeHighlighter,
  UnicodeHighlighterHover,
  UnicodeHighlighterHoverParticipant,
  warningIcon
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi91bmljb2RlSGlnaGxpZ2h0ZXIvYnJvd3Nlci91bmljb2RlSGlnaGxpZ2h0ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2hhckNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jaGFyQ29kZS5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEludmlzaWJsZUNoYXJhY3RlcnMsIGlzQmFzaWNBU0NJSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0ICcuL3VuaWNvZGVIaWdobGlnaHRlci5jc3MnO1xuaW1wb3J0IHsgSUFjdGl2ZUNvZGVFZGl0b3IsIElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGlvbiwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbiwgcmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24sIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSW5VbnRydXN0ZWRXb3Jrc3BhY2UsIGluVW50cnVzdGVkV29ya3NwYWNlLCBFZGl0b3JPcHRpb24sIEludGVybmFsVW5pY29kZUhpZ2hsaWdodE9wdGlvbnMsIHVuaWNvZGVIaWdobGlnaHRDb25maWdLZXlzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSU1vZGVsRGVjb3JhdGlvbiwgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBJVGV4dE1vZGVsLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IFVuaWNvZGVIaWdobGlnaHRlck9wdGlvbnMsIFVuaWNvZGVIaWdobGlnaHRlclJlYXNvbiwgVW5pY29kZUhpZ2hsaWdodGVyUmVhc29uS2luZCwgVW5pY29kZVRleHRNb2RlbEhpZ2hsaWdodGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL3VuaWNvZGVUZXh0TW9kZWxIaWdobGlnaHRlci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yV29ya2VyU2VydmljZSwgSVVuaWNvZGVIaWdobGlnaHRzUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2VkaXRvcldvcmtlci5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBpc01vZGVsRGVjb3JhdGlvbkluQ29tbWVudCwgaXNNb2RlbERlY29yYXRpb25JblN0cmluZywgaXNNb2RlbERlY29yYXRpb25WaXNpYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC92aWV3TW9kZWxEZWNvcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBIb3ZlckFuY2hvciwgSG92ZXJBbmNob3JUeXBlLCBIb3ZlclBhcnRpY2lwYW50UmVnaXN0cnksIElFZGl0b3JIb3ZlclBhcnRpY2lwYW50LCBJRWRpdG9ySG92ZXJSZW5kZXJDb250ZXh0LCBJSG92ZXJQYXJ0LCBJUmVuZGVyZWRIb3ZlclBhcnRzIH0gZnJvbSAnLi4vLi4vaG92ZXIvYnJvd3Nlci9ob3ZlclR5cGVzLmpzJztcbmltcG9ydCB7IE1hcmtkb3duSG92ZXIsIHJlbmRlck1hcmtkb3duSG92ZXJzIH0gZnJvbSAnLi4vLi4vaG92ZXIvYnJvd3Nlci9tYXJrZG93bkhvdmVyUGFydGljaXBhbnQuanMnO1xuaW1wb3J0IHsgQmFubmVyQ29udHJvbGxlciB9IGZyb20gJy4vYmFubmVyQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25UYXJnZXQsIElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IHJlZ2lzdGVySWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZVRydXN0LmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuXG5leHBvcnQgY29uc3Qgd2FybmluZ0ljb24gPSByZWdpc3Rlckljb24oJ2V4dGVuc2lvbnMtd2FybmluZy1tZXNzYWdlJywgQ29kaWNvbi53YXJuaW5nLCBubHMubG9jYWxpemUoJ3dhcm5pbmdJY29uJywgJ0ljb24gc2hvd24gd2l0aCBhIHdhcm5pbmcgbWVzc2FnZSBpbiB0aGUgZXh0ZW5zaW9ucyBlZGl0b3IuJykpO1xuXG5leHBvcnQgY2xhc3MgVW5pY29kZUhpZ2hsaWdodGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFZGl0b3JDb250cmlidXRpb24ge1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gJ2VkaXRvci5jb250cmliLnVuaWNvZGVIaWdobGlnaHRlcic7XG5cblx0cHJpdmF0ZSBfaGlnaGxpZ2h0ZXI6IERvY3VtZW50VW5pY29kZUhpZ2hsaWdodGVyIHwgVmlld3BvcnRVbmljb2RlSGlnaGxpZ2h0ZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfb3B0aW9uczogSW50ZXJuYWxVbmljb2RlSGlnaGxpZ2h0T3B0aW9ucztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9iYW5uZXJDb250cm9sbGVyOiBCYW5uZXJDb250cm9sbGVyO1xuXHRwcml2YXRlIF9iYW5uZXJDbG9zZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJRWRpdG9yV29ya2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JXb3JrZXJTZXJ2aWNlOiBJRWRpdG9yV29ya2VyU2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd29ya3NwYWNlVHJ1c3RTZXJ2aWNlOiBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9iYW5uZXJDb250cm9sbGVyID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQmFubmVyQ29udHJvbGxlciwgX2VkaXRvcikpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWwoKCkgPT4ge1xuXHRcdFx0dGhpcy5fYmFubmVyQ2xvc2VkID0gZmFsc2U7XG5cdFx0XHR0aGlzLl91cGRhdGVIaWdobGlnaHRlcigpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX29wdGlvbnMgPSBfZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24udW5pY29kZUhpZ2hsaWdodGluZyk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihfd29ya3NwYWNlVHJ1c3RTZXJ2aWNlLm9uRGlkQ2hhbmdlVHJ1c3QoZSA9PiB7XG5cdFx0XHR0aGlzLl91cGRhdGVIaWdobGlnaHRlcigpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKF9lZGl0b3Iub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24udW5pY29kZUhpZ2hsaWdodGluZykpIHtcblx0XHRcdFx0dGhpcy5fb3B0aW9ucyA9IF9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi51bmljb2RlSGlnaGxpZ2h0aW5nKTtcblx0XHRcdFx0dGhpcy5fdXBkYXRlSGlnaGxpZ2h0ZXIoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl91cGRhdGVIaWdobGlnaHRlcigpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2hpZ2hsaWdodGVyKSB7XG5cdFx0XHR0aGlzLl9oaWdobGlnaHRlci5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9oaWdobGlnaHRlciA9IG51bGw7XG5cdFx0fVxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3VwZGF0ZVN0YXRlID0gKHN0YXRlOiBJVW5pY29kZUhpZ2hsaWdodHNSZXN1bHQgfCBudWxsKTogdm9pZCA9PiB7XG5cdFx0aWYgKHN0YXRlICYmIHN0YXRlLmhhc01vcmUpIHtcblx0XHRcdGlmICh0aGlzLl9iYW5uZXJDbG9zZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUaGlzIGRvY3VtZW50IGNvbnRhaW5zIG1hbnkgbm9uLWJhc2ljIEFTQ0lJIGNoYXJhY3RlcnMuXG5cdFx0XHRjb25zdCBtYXggPSBNYXRoLm1heChzdGF0ZS5hbWJpZ3VvdXNDaGFyYWN0ZXJDb3VudCwgc3RhdGUubm9uQmFzaWNBc2NpaUNoYXJhY3RlckNvdW50LCBzdGF0ZS5pbnZpc2libGVDaGFyYWN0ZXJDb3VudCk7XG5cblx0XHRcdGxldCBkYXRhO1xuXHRcdFx0aWYgKHN0YXRlLm5vbkJhc2ljQXNjaWlDaGFyYWN0ZXJDb3VudCA+PSBtYXgpIHtcblx0XHRcdFx0ZGF0YSA9IHtcblx0XHRcdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ3VuaWNvZGVIaWdobGlnaHRpbmcudGhpc0RvY3VtZW50SGFzTWFueU5vbkJhc2ljQXNjaWlVbmljb2RlQ2hhcmFjdGVycycsICdUaGlzIGRvY3VtZW50IGNvbnRhaW5zIG1hbnkgbm9uLWJhc2ljIEFTQ0lJIHVuaWNvZGUgY2hhcmFjdGVycycpLFxuXHRcdFx0XHRcdGNvbW1hbmQ6IG5ldyBEaXNhYmxlSGlnaGxpZ2h0aW5nT2ZOb25CYXNpY0FzY2lpQ2hhcmFjdGVyc0FjdGlvbigpLFxuXHRcdFx0XHR9O1xuXHRcdFx0fSBlbHNlIGlmIChzdGF0ZS5hbWJpZ3VvdXNDaGFyYWN0ZXJDb3VudCA+PSBtYXgpIHtcblx0XHRcdFx0ZGF0YSA9IHtcblx0XHRcdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ3VuaWNvZGVIaWdobGlnaHRpbmcudGhpc0RvY3VtZW50SGFzTWFueUFtYmlndW91c1VuaWNvZGVDaGFyYWN0ZXJzJywgJ1RoaXMgZG9jdW1lbnQgY29udGFpbnMgbWFueSBhbWJpZ3VvdXMgdW5pY29kZSBjaGFyYWN0ZXJzJyksXG5cdFx0XHRcdFx0Y29tbWFuZDogbmV3IERpc2FibGVIaWdobGlnaHRpbmdPZkFtYmlndW91c0NoYXJhY3RlcnNBY3Rpb24oKSxcblx0XHRcdFx0fTtcblx0XHRcdH0gZWxzZSBpZiAoc3RhdGUuaW52aXNpYmxlQ2hhcmFjdGVyQ291bnQgPj0gbWF4KSB7XG5cdFx0XHRcdGRhdGEgPSB7XG5cdFx0XHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCd1bmljb2RlSGlnaGxpZ2h0aW5nLnRoaXNEb2N1bWVudEhhc01hbnlJbnZpc2libGVVbmljb2RlQ2hhcmFjdGVycycsICdUaGlzIGRvY3VtZW50IGNvbnRhaW5zIG1hbnkgaW52aXNpYmxlIHVuaWNvZGUgY2hhcmFjdGVycycpLFxuXHRcdFx0XHRcdGNvbW1hbmQ6IG5ldyBEaXNhYmxlSGlnaGxpZ2h0aW5nT2ZJbnZpc2libGVDaGFyYWN0ZXJzQWN0aW9uKCksXG5cdFx0XHRcdH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VucmVhY2hhYmxlJyk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2Jhbm5lckNvbnRyb2xsZXIuc2hvdyh7XG5cdFx0XHRcdGlkOiAndW5pY29kZUhpZ2hsaWdodEJhbm5lcicsXG5cdFx0XHRcdG1lc3NhZ2U6IGRhdGEubWVzc2FnZSxcblx0XHRcdFx0aWNvbjogd2FybmluZ0ljb24sXG5cdFx0XHRcdGFjdGlvbnM6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsYWJlbDogZGF0YS5jb21tYW5kLnNob3J0TGFiZWwsXG5cdFx0XHRcdFx0XHRocmVmOiBgY29tbWFuZDoke2RhdGEuY29tbWFuZC5kZXNjLmlkfWBcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdG9uQ2xvc2U6ICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9iYW5uZXJDbG9zZWQgPSB0cnVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2Jhbm5lckNvbnRyb2xsZXIuaGlkZSgpO1xuXHRcdH1cblx0fTtcblxuXHRwcml2YXRlIF91cGRhdGVIaWdobGlnaHRlcigpOiB2b2lkIHtcblx0XHR0aGlzLl91cGRhdGVTdGF0ZShudWxsKTtcblxuXHRcdGlmICh0aGlzLl9oaWdobGlnaHRlcikge1xuXHRcdFx0dGhpcy5faGlnaGxpZ2h0ZXIuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5faGlnaGxpZ2h0ZXIgPSBudWxsO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IG9wdGlvbnMgPSByZXNvbHZlT3B0aW9ucyh0aGlzLl93b3Jrc3BhY2VUcnVzdFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdGVkKCksIHRoaXMuX29wdGlvbnMpO1xuXG5cdFx0aWYgKFxuXHRcdFx0W1xuXHRcdFx0XHRvcHRpb25zLm5vbkJhc2ljQVNDSUksXG5cdFx0XHRcdG9wdGlvbnMuYW1iaWd1b3VzQ2hhcmFjdGVycyxcblx0XHRcdFx0b3B0aW9ucy5pbnZpc2libGVDaGFyYWN0ZXJzLFxuXHRcdFx0XS5ldmVyeSgob3B0aW9uKSA9PiBvcHRpb24gPT09IGZhbHNlKVxuXHRcdCkge1xuXHRcdFx0Ly8gRG9uJ3QgZG8gYW55dGhpbmcgaWYgdGhlIGZlYXR1cmUgaXMgZnVsbHkgZGlzYWJsZWRcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBoaWdobGlnaHRPcHRpb25zOiBVbmljb2RlSGlnaGxpZ2h0ZXJPcHRpb25zID0ge1xuXHRcdFx0bm9uQmFzaWNBU0NJSTogb3B0aW9ucy5ub25CYXNpY0FTQ0lJLFxuXHRcdFx0YW1iaWd1b3VzQ2hhcmFjdGVyczogb3B0aW9ucy5hbWJpZ3VvdXNDaGFyYWN0ZXJzLFxuXHRcdFx0aW52aXNpYmxlQ2hhcmFjdGVyczogb3B0aW9ucy5pbnZpc2libGVDaGFyYWN0ZXJzLFxuXHRcdFx0aW5jbHVkZUNvbW1lbnRzOiBvcHRpb25zLmluY2x1ZGVDb21tZW50cyxcblx0XHRcdGluY2x1ZGVTdHJpbmdzOiBvcHRpb25zLmluY2x1ZGVTdHJpbmdzLFxuXHRcdFx0YWxsb3dlZENvZGVQb2ludHM6IE9iamVjdC5rZXlzKG9wdGlvbnMuYWxsb3dlZENoYXJhY3RlcnMpLm1hcChjID0+IGMuY29kZVBvaW50QXQoMCkhKSxcblx0XHRcdGFsbG93ZWRMb2NhbGVzOiBPYmplY3Qua2V5cyhvcHRpb25zLmFsbG93ZWRMb2NhbGVzKS5tYXAobG9jYWxlID0+IHtcblx0XHRcdFx0aWYgKGxvY2FsZSA9PT0gJ19vcycpIHtcblx0XHRcdFx0XHRjb25zdCBvc0xvY2FsZSA9IG5ldyBJbnRsLk51bWJlckZvcm1hdCgpLnJlc29sdmVkT3B0aW9ucygpLmxvY2FsZTtcblx0XHRcdFx0XHRyZXR1cm4gb3NMb2NhbGU7XG5cdFx0XHRcdH0gZWxzZSBpZiAobG9jYWxlID09PSAnX3ZzY29kZScpIHtcblx0XHRcdFx0XHRyZXR1cm4gcGxhdGZvcm0ubGFuZ3VhZ2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGxvY2FsZTtcblx0XHRcdH0pLFxuXHRcdH07XG5cblx0XHRpZiAodGhpcy5fZWRpdG9yV29ya2VyU2VydmljZS5jYW5Db21wdXRlVW5pY29kZUhpZ2hsaWdodHModGhpcy5fZWRpdG9yLmdldE1vZGVsKCkudXJpKSkge1xuXHRcdFx0dGhpcy5faGlnaGxpZ2h0ZXIgPSBuZXcgRG9jdW1lbnRVbmljb2RlSGlnaGxpZ2h0ZXIodGhpcy5fZWRpdG9yLCBoaWdobGlnaHRPcHRpb25zLCB0aGlzLl91cGRhdGVTdGF0ZSwgdGhpcy5fZWRpdG9yV29ya2VyU2VydmljZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2hpZ2hsaWdodGVyID0gbmV3IFZpZXdwb3J0VW5pY29kZUhpZ2hsaWdodGVyKHRoaXMuX2VkaXRvciwgaGlnaGxpZ2h0T3B0aW9ucywgdGhpcy5fdXBkYXRlU3RhdGUpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXREZWNvcmF0aW9uSW5mbyhkZWNvcmF0aW9uOiBJTW9kZWxEZWNvcmF0aW9uKTogVW5pY29kZUhpZ2hsaWdodGVyRGVjb3JhdGlvbkluZm8gfCBudWxsIHtcblx0XHRpZiAodGhpcy5faGlnaGxpZ2h0ZXIpIHtcblx0XHRcdHJldHVybiB0aGlzLl9oaWdobGlnaHRlci5nZXREZWNvcmF0aW9uSW5mbyhkZWNvcmF0aW9uKTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBVbmljb2RlSGlnaGxpZ2h0ZXJEZWNvcmF0aW9uSW5mbyB7XG5cdHJlYXNvbjogVW5pY29kZUhpZ2hsaWdodGVyUmVhc29uO1xuXHRpbkNvbW1lbnQ6IGJvb2xlYW47XG5cdGluU3RyaW5nOiBib29sZWFuO1xufVxuXG50eXBlIFJlc29sdmU8VD4gPVxuXHRUIGV4dGVuZHMgSW5VbnRydXN0ZWRXb3Jrc3BhY2UgPyBuZXZlclxuXHQ6IFQgZXh0ZW5kcyAnYXV0bycgPyBuZXZlciA6IFQ7XG5cbnR5cGUgUmVzb2x2ZWRPcHRpb25zID0geyBbVEtleSBpbiBrZXlvZiBJbnRlcm5hbFVuaWNvZGVIaWdobGlnaHRPcHRpb25zXTogUmVzb2x2ZTxJbnRlcm5hbFVuaWNvZGVIaWdobGlnaHRPcHRpb25zW1RLZXldPiB9O1xuXG5mdW5jdGlvbiByZXNvbHZlT3B0aW9ucyh0cnVzdGVkOiBib29sZWFuLCBvcHRpb25zOiBJbnRlcm5hbFVuaWNvZGVIaWdobGlnaHRPcHRpb25zKTogUmVzb2x2ZWRPcHRpb25zIHtcblx0cmV0dXJuIHtcblx0XHRub25CYXNpY0FTQ0lJOiBvcHRpb25zLm5vbkJhc2ljQVNDSUkgPT09IGluVW50cnVzdGVkV29ya3NwYWNlID8gIXRydXN0ZWQgOiBvcHRpb25zLm5vbkJhc2ljQVNDSUksXG5cdFx0YW1iaWd1b3VzQ2hhcmFjdGVyczogb3B0aW9ucy5hbWJpZ3VvdXNDaGFyYWN0ZXJzLFxuXHRcdGludmlzaWJsZUNoYXJhY3RlcnM6IG9wdGlvbnMuaW52aXNpYmxlQ2hhcmFjdGVycyxcblx0XHRpbmNsdWRlQ29tbWVudHM6IG9wdGlvbnMuaW5jbHVkZUNvbW1lbnRzID09PSBpblVudHJ1c3RlZFdvcmtzcGFjZSA/ICF0cnVzdGVkIDogb3B0aW9ucy5pbmNsdWRlQ29tbWVudHMsXG5cdFx0aW5jbHVkZVN0cmluZ3M6IG9wdGlvbnMuaW5jbHVkZVN0cmluZ3MgPT09IGluVW50cnVzdGVkV29ya3NwYWNlID8gIXRydXN0ZWQgOiBvcHRpb25zLmluY2x1ZGVTdHJpbmdzLFxuXHRcdGFsbG93ZWRDaGFyYWN0ZXJzOiBvcHRpb25zLmFsbG93ZWRDaGFyYWN0ZXJzLFxuXHRcdGFsbG93ZWRMb2NhbGVzOiBvcHRpb25zLmFsbG93ZWRMb2NhbGVzLFxuXHR9O1xufVxuXG5jbGFzcyBEb2N1bWVudFVuaWNvZGVIaWdobGlnaHRlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbDogSVRleHRNb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF91cGRhdGVTb29uOiBSdW5PbmNlU2NoZWR1bGVyO1xuXHRwcml2YXRlIF9kZWNvcmF0aW9ucyA9IHRoaXMuX2VkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29wdGlvbnM6IFVuaWNvZGVIaWdobGlnaHRlck9wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdXBkYXRlU3RhdGU6IChzdGF0ZTogSVVuaWNvZGVIaWdobGlnaHRzUmVzdWx0IHwgbnVsbCkgPT4gdm9pZCxcblx0XHRASUVkaXRvcldvcmtlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yV29ya2VyU2VydmljZTogSUVkaXRvcldvcmtlclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fdXBkYXRlU29vbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHRoaXMuX3VwZGF0ZSgpLCAyNTApKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoKSA9PiB7XG5cdFx0XHR0aGlzLl91cGRhdGVTb29uLnNjaGVkdWxlKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fdXBkYXRlU29vbi5zY2hlZHVsZSgpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5fZGVjb3JhdGlvbnMuY2xlYXIoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX21vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fbW9kZWwubWlnaHRDb250YWluTm9uQmFzaWNBU0NJSSgpKSB7XG5cdFx0XHR0aGlzLl9kZWNvcmF0aW9ucy5jbGVhcigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsVmVyc2lvbklkID0gdGhpcy5fbW9kZWwuZ2V0VmVyc2lvbklkKCk7XG5cdFx0dGhpcy5fZWRpdG9yV29ya2VyU2VydmljZVxuXHRcdFx0LmNvbXB1dGVkVW5pY29kZUhpZ2hsaWdodHModGhpcy5fbW9kZWwudXJpLCB0aGlzLl9vcHRpb25zKVxuXHRcdFx0LnRoZW4oKGluZm8pID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX21vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodGhpcy5fbW9kZWwuZ2V0VmVyc2lvbklkKCkgIT09IG1vZGVsVmVyc2lvbklkKSB7XG5cdFx0XHRcdFx0Ly8gbW9kZWwgY2hhbmdlZCBpbiB0aGUgbWVhbnRpbWVcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fdXBkYXRlU3RhdGUoaW5mbyk7XG5cblx0XHRcdFx0Y29uc3QgZGVjb3JhdGlvbnM6IElNb2RlbERlbHRhRGVjb3JhdGlvbltdID0gW107XG5cdFx0XHRcdGlmICghaW5mby5oYXNNb3JlKSB7XG5cdFx0XHRcdFx0Ly8gRG9uJ3Qgc2hvdyBkZWNvcmF0aW9uIGlmIHRoZXJlIGFyZSB0b28gbWFueS5cblx0XHRcdFx0XHQvLyBJbiB0aGlzIGNhc2UsIGEgYmFubmVyIGlzIHNob3duLlxuXHRcdFx0XHRcdGZvciAoY29uc3QgcmFuZ2Ugb2YgaW5mby5yYW5nZXMpIHtcblx0XHRcdFx0XHRcdGRlY29yYXRpb25zLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRyYW5nZTogcmFuZ2UsXG5cdFx0XHRcdFx0XHRcdG9wdGlvbnM6IERlY29yYXRpb25zLmluc3RhbmNlLmdldERlY29yYXRpb25Gcm9tT3B0aW9ucyh0aGlzLl9vcHRpb25zKSxcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9kZWNvcmF0aW9ucy5zZXQoZGVjb3JhdGlvbnMpO1xuXHRcdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RGVjb3JhdGlvbkluZm8oZGVjb3JhdGlvbjogSU1vZGVsRGVjb3JhdGlvbik6IFVuaWNvZGVIaWdobGlnaHRlckRlY29yYXRpb25JbmZvIHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLl9kZWNvcmF0aW9ucy5oYXMoZGVjb3JhdGlvbikpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmIChcblx0XHRcdCFpc01vZGVsRGVjb3JhdGlvblZpc2libGUobW9kZWwsIGRlY29yYXRpb24pXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Y29uc3QgdGV4dCA9IG1vZGVsLmdldFZhbHVlSW5SYW5nZShkZWNvcmF0aW9uLnJhbmdlKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVhc29uOiBjb21wdXRlUmVhc29uKHRleHQsIHRoaXMuX29wdGlvbnMpISxcblx0XHRcdGluQ29tbWVudDogaXNNb2RlbERlY29yYXRpb25JbkNvbW1lbnQobW9kZWwsIGRlY29yYXRpb24pLFxuXHRcdFx0aW5TdHJpbmc6IGlzTW9kZWxEZWNvcmF0aW9uSW5TdHJpbmcobW9kZWwsIGRlY29yYXRpb24pLFxuXHRcdH07XG5cdH1cbn1cblxuY2xhc3MgVmlld3BvcnRVbmljb2RlSGlnaGxpZ2h0ZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbDogSVRleHRNb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF91cGRhdGVTb29uOiBSdW5PbmNlU2NoZWR1bGVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWNvcmF0aW9ucyA9IHRoaXMuX2VkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29wdGlvbnM6IFVuaWNvZGVIaWdobGlnaHRlck9wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdXBkYXRlU3RhdGU6IChzdGF0ZTogSVVuaWNvZGVIaWdobGlnaHRzUmVzdWx0IHwgbnVsbCkgPT4gdm9pZCxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3VwZGF0ZVNvb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLl91cGRhdGUoKSwgMjUwKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRMYXlvdXRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5fdXBkYXRlU29vbi5zY2hlZHVsZSgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRTY3JvbGxDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5fdXBkYXRlU29vbi5zY2hlZHVsZSgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VIaWRkZW5BcmVhcygoKSA9PiB7XG5cdFx0XHR0aGlzLl91cGRhdGVTb29uLnNjaGVkdWxlKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoKSA9PiB7XG5cdFx0XHR0aGlzLl91cGRhdGVTb29uLnNjaGVkdWxlKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fdXBkYXRlU29vbi5zY2hlZHVsZSgpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5fZGVjb3JhdGlvbnMuY2xlYXIoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX21vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fbW9kZWwubWlnaHRDb250YWluTm9uQmFzaWNBU0NJSSgpKSB7XG5cdFx0XHR0aGlzLl9kZWNvcmF0aW9ucy5jbGVhcigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJhbmdlcyA9IHRoaXMuX2VkaXRvci5nZXRWaXNpYmxlUmFuZ2VzKCk7XG5cdFx0Y29uc3QgZGVjb3JhdGlvbnM6IElNb2RlbERlbHRhRGVjb3JhdGlvbltdID0gW107XG5cdFx0Y29uc3QgdG90YWxSZXN1bHQ6IElVbmljb2RlSGlnaGxpZ2h0c1Jlc3VsdCA9IHtcblx0XHRcdHJhbmdlczogW10sXG5cdFx0XHRhbWJpZ3VvdXNDaGFyYWN0ZXJDb3VudDogMCxcblx0XHRcdGludmlzaWJsZUNoYXJhY3RlckNvdW50OiAwLFxuXHRcdFx0bm9uQmFzaWNBc2NpaUNoYXJhY3RlckNvdW50OiAwLFxuXHRcdFx0aGFzTW9yZTogZmFsc2UsXG5cdFx0fTtcblx0XHRmb3IgKGNvbnN0IHJhbmdlIG9mIHJhbmdlcykge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gVW5pY29kZVRleHRNb2RlbEhpZ2hsaWdodGVyLmNvbXB1dGVVbmljb2RlSGlnaGxpZ2h0cyh0aGlzLl9tb2RlbCwgdGhpcy5fb3B0aW9ucywgcmFuZ2UpO1xuXHRcdFx0Zm9yIChjb25zdCByIG9mIHJlc3VsdC5yYW5nZXMpIHtcblx0XHRcdFx0dG90YWxSZXN1bHQucmFuZ2VzLnB1c2gocik7XG5cdFx0XHR9XG5cdFx0XHR0b3RhbFJlc3VsdC5hbWJpZ3VvdXNDaGFyYWN0ZXJDb3VudCArPSB0b3RhbFJlc3VsdC5hbWJpZ3VvdXNDaGFyYWN0ZXJDb3VudDtcblx0XHRcdHRvdGFsUmVzdWx0LmludmlzaWJsZUNoYXJhY3RlckNvdW50ICs9IHRvdGFsUmVzdWx0LmludmlzaWJsZUNoYXJhY3RlckNvdW50O1xuXHRcdFx0dG90YWxSZXN1bHQubm9uQmFzaWNBc2NpaUNoYXJhY3RlckNvdW50ICs9IHRvdGFsUmVzdWx0Lm5vbkJhc2ljQXNjaWlDaGFyYWN0ZXJDb3VudDtcblx0XHRcdHRvdGFsUmVzdWx0Lmhhc01vcmUgPSB0b3RhbFJlc3VsdC5oYXNNb3JlIHx8IHJlc3VsdC5oYXNNb3JlO1xuXHRcdH1cblxuXHRcdGlmICghdG90YWxSZXN1bHQuaGFzTW9yZSkge1xuXHRcdFx0Ly8gRG9uJ3Qgc2hvdyBkZWNvcmF0aW9ucyBpZiB0aGVyZSBhcmUgdG9vIG1hbnkuXG5cdFx0XHQvLyBBIGJhbm5lciB3aWxsIGJlIHNob3duIGluc3RlYWQuXG5cdFx0XHRmb3IgKGNvbnN0IHJhbmdlIG9mIHRvdGFsUmVzdWx0LnJhbmdlcykge1xuXHRcdFx0XHRkZWNvcmF0aW9ucy5wdXNoKHsgcmFuZ2UsIG9wdGlvbnM6IERlY29yYXRpb25zLmluc3RhbmNlLmdldERlY29yYXRpb25Gcm9tT3B0aW9ucyh0aGlzLl9vcHRpb25zKSB9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fdXBkYXRlU3RhdGUodG90YWxSZXN1bHQpO1xuXG5cdFx0dGhpcy5fZGVjb3JhdGlvbnMuc2V0KGRlY29yYXRpb25zKTtcblx0fVxuXG5cdHB1YmxpYyBnZXREZWNvcmF0aW9uSW5mbyhkZWNvcmF0aW9uOiBJTW9kZWxEZWNvcmF0aW9uKTogVW5pY29kZUhpZ2hsaWdodGVyRGVjb3JhdGlvbkluZm8gfCBudWxsIHtcblx0XHRpZiAoIXRoaXMuX2RlY29yYXRpb25zLmhhcyhkZWNvcmF0aW9uKSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0Y29uc3QgdGV4dCA9IG1vZGVsLmdldFZhbHVlSW5SYW5nZShkZWNvcmF0aW9uLnJhbmdlKTtcblx0XHRpZiAoIWlzTW9kZWxEZWNvcmF0aW9uVmlzaWJsZShtb2RlbCwgZGVjb3JhdGlvbikpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVhc29uOiBjb21wdXRlUmVhc29uKHRleHQsIHRoaXMuX29wdGlvbnMpISxcblx0XHRcdGluQ29tbWVudDogaXNNb2RlbERlY29yYXRpb25JbkNvbW1lbnQobW9kZWwsIGRlY29yYXRpb24pLFxuXHRcdFx0aW5TdHJpbmc6IGlzTW9kZWxEZWNvcmF0aW9uSW5TdHJpbmcobW9kZWwsIGRlY29yYXRpb24pLFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFVuaWNvZGVIaWdobGlnaHRlckhvdmVyIGltcGxlbWVudHMgSUhvdmVyUGFydCB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBvd25lcjogSUVkaXRvckhvdmVyUGFydGljaXBhbnQ8VW5pY29kZUhpZ2hsaWdodGVySG92ZXI+LFxuXHRcdHB1YmxpYyByZWFkb25seSByYW5nZTogUmFuZ2UsXG5cdFx0cHVibGljIHJlYWRvbmx5IGRlY29yYXRpb246IElNb2RlbERlY29yYXRpb25cblx0KSB7IH1cblxuXHRwdWJsaWMgaXNWYWxpZEZvckhvdmVyQW5jaG9yKGFuY2hvcjogSG92ZXJBbmNob3IpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gKFxuXHRcdFx0YW5jaG9yLnR5cGUgPT09IEhvdmVyQW5jaG9yVHlwZS5SYW5nZVxuXHRcdFx0JiYgdGhpcy5yYW5nZS5zdGFydENvbHVtbiA8PSBhbmNob3IucmFuZ2Uuc3RhcnRDb2x1bW5cblx0XHRcdCYmIHRoaXMucmFuZ2UuZW5kQ29sdW1uID49IGFuY2hvci5yYW5nZS5lbmRDb2x1bW5cblx0XHQpO1xuXHR9XG59XG5cbmNvbnN0IGNvbmZpZ3VyZVVuaWNvZGVIaWdobGlnaHRPcHRpb25zU3RyID0gbmxzLmxvY2FsaXplKCd1bmljb2RlSGlnaGxpZ2h0LmNvbmZpZ3VyZVVuaWNvZGVIaWdobGlnaHRPcHRpb25zJywgJ0NvbmZpZ3VyZSBVbmljb2RlIEhpZ2hsaWdodCBPcHRpb25zJyk7XG5cbmV4cG9ydCBjbGFzcyBVbmljb2RlSGlnaGxpZ2h0ZXJIb3ZlclBhcnRpY2lwYW50IGltcGxlbWVudHMgSUVkaXRvckhvdmVyUGFydGljaXBhbnQ8TWFya2Rvd25Ib3Zlcj4ge1xuXG5cdHB1YmxpYyByZWFkb25seSBob3Zlck9yZGluYWw6IG51bWJlciA9IDU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX29wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHQpIHtcblx0fVxuXG5cdGNvbXB1dGVTeW5jKGFuY2hvcjogSG92ZXJBbmNob3IsIGxpbmVEZWNvcmF0aW9uczogSU1vZGVsRGVjb3JhdGlvbltdKTogTWFya2Rvd25Ib3ZlcltdIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpIHx8IGFuY2hvci50eXBlICE9PSBIb3ZlckFuY2hvclR5cGUuUmFuZ2UpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXG5cdFx0Y29uc3QgdW5pY29kZUhpZ2hsaWdodGVyID0gdGhpcy5fZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxVbmljb2RlSGlnaGxpZ2h0ZXI+KFVuaWNvZGVIaWdobGlnaHRlci5JRCk7XG5cdFx0aWYgKCF1bmljb2RlSGlnaGxpZ2h0ZXIpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQ6IE1hcmtkb3duSG92ZXJbXSA9IFtdO1xuXHRcdGNvbnN0IGV4aXN0ZWRSZWFzb24gPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRsZXQgaW5kZXggPSAzMDA7XG5cdFx0Zm9yIChjb25zdCBkIG9mIGxpbmVEZWNvcmF0aW9ucykge1xuXG5cdFx0XHRjb25zdCBoaWdobGlnaHRJbmZvID0gdW5pY29kZUhpZ2hsaWdodGVyLmdldERlY29yYXRpb25JbmZvKGQpO1xuXHRcdFx0aWYgKCFoaWdobGlnaHRJbmZvKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY2hhciA9IG1vZGVsLmdldFZhbHVlSW5SYW5nZShkLnJhbmdlKTtcblx0XHRcdC8vIHRleHQgcmVmZXJzIHRvIGEgc2luZ2xlIGNoYXJhY3Rlci5cblx0XHRcdGNvbnN0IGNvZGVQb2ludCA9IGNoYXIuY29kZVBvaW50QXQoMCkhO1xuXG5cdFx0XHRjb25zdCBjb2RlUG9pbnRTdHIgPSBmb3JtYXRDb2RlUG9pbnRNYXJrZG93bihjb2RlUG9pbnQpO1xuXG5cdFx0XHRsZXQgcmVhc29uOiBzdHJpbmc7XG5cdFx0XHRzd2l0Y2ggKGhpZ2hsaWdodEluZm8ucmVhc29uLmtpbmQpIHtcblx0XHRcdFx0Y2FzZSBVbmljb2RlSGlnaGxpZ2h0ZXJSZWFzb25LaW5kLkFtYmlndW91czoge1xuXHRcdFx0XHRcdGlmIChpc0Jhc2ljQVNDSUkoaGlnaGxpZ2h0SW5mby5yZWFzb24uY29uZnVzYWJsZVdpdGgpKSB7XG5cdFx0XHRcdFx0XHRyZWFzb24gPSBubHMubG9jYWxpemUoXG5cdFx0XHRcdFx0XHRcdCd1bmljb2RlSGlnaGxpZ2h0LmNoYXJhY3RlcklzQW1iaWd1b3VzQVNDSUknLFxuXHRcdFx0XHRcdFx0XHQnVGhlIGNoYXJhY3RlciB7MH0gY291bGQgYmUgY29uZnVzZWQgd2l0aCB0aGUgQVNDSUkgY2hhcmFjdGVyIHsxfSwgd2hpY2ggaXMgbW9yZSBjb21tb24gaW4gc291cmNlIGNvZGUuJyxcblx0XHRcdFx0XHRcdFx0Y29kZVBvaW50U3RyLFxuXHRcdFx0XHRcdFx0XHRmb3JtYXRDb2RlUG9pbnRNYXJrZG93bihoaWdobGlnaHRJbmZvLnJlYXNvbi5jb25mdXNhYmxlV2l0aC5jb2RlUG9pbnRBdCgwKSEpXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZWFzb24gPSBubHMubG9jYWxpemUoXG5cdFx0XHRcdFx0XHRcdCd1bmljb2RlSGlnaGxpZ2h0LmNoYXJhY3RlcklzQW1iaWd1b3VzJyxcblx0XHRcdFx0XHRcdFx0J1RoZSBjaGFyYWN0ZXIgezB9IGNvdWxkIGJlIGNvbmZ1c2VkIHdpdGggdGhlIGNoYXJhY3RlciB7MX0sIHdoaWNoIGlzIG1vcmUgY29tbW9uIGluIHNvdXJjZSBjb2RlLicsXG5cdFx0XHRcdFx0XHRcdGNvZGVQb2ludFN0cixcblx0XHRcdFx0XHRcdFx0Zm9ybWF0Q29kZVBvaW50TWFya2Rvd24oaGlnaGxpZ2h0SW5mby5yZWFzb24uY29uZnVzYWJsZVdpdGguY29kZVBvaW50QXQoMCkhKVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjYXNlIFVuaWNvZGVIaWdobGlnaHRlclJlYXNvbktpbmQuSW52aXNpYmxlOlxuXHRcdFx0XHRcdHJlYXNvbiA9IG5scy5sb2NhbGl6ZShcblx0XHRcdFx0XHRcdCd1bmljb2RlSGlnaGxpZ2h0LmNoYXJhY3RlcklzSW52aXNpYmxlJyxcblx0XHRcdFx0XHRcdCdUaGUgY2hhcmFjdGVyIHswfSBpcyBpbnZpc2libGUuJyxcblx0XHRcdFx0XHRcdGNvZGVQb2ludFN0clxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSBVbmljb2RlSGlnaGxpZ2h0ZXJSZWFzb25LaW5kLk5vbkJhc2ljQXNjaWk6XG5cdFx0XHRcdFx0cmVhc29uID0gbmxzLmxvY2FsaXplKFxuXHRcdFx0XHRcdFx0J3VuaWNvZGVIaWdobGlnaHQuY2hhcmFjdGVySXNOb25CYXNpY0FzY2lpJyxcblx0XHRcdFx0XHRcdCdUaGUgY2hhcmFjdGVyIHswfSBpcyBub3QgYSBiYXNpYyBBU0NJSSBjaGFyYWN0ZXIuJyxcblx0XHRcdFx0XHRcdGNvZGVQb2ludFN0clxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChleGlzdGVkUmVhc29uLmhhcyhyZWFzb24pKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0ZXhpc3RlZFJlYXNvbi5hZGQocmVhc29uKTtcblxuXHRcdFx0Y29uc3QgYWRqdXN0U2V0dGluZ3NBcmdzOiBTaG93RXhjbHVkZU9wdGlvbnNBcmdzID0ge1xuXHRcdFx0XHRjb2RlUG9pbnQ6IGNvZGVQb2ludCxcblx0XHRcdFx0cmVhc29uOiBoaWdobGlnaHRJbmZvLnJlYXNvbixcblx0XHRcdFx0aW5Db21tZW50OiBoaWdobGlnaHRJbmZvLmluQ29tbWVudCxcblx0XHRcdFx0aW5TdHJpbmc6IGhpZ2hsaWdodEluZm8uaW5TdHJpbmcsXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBhZGp1c3RTZXR0aW5ncyA9IG5scy5sb2NhbGl6ZSgndW5pY29kZUhpZ2hsaWdodC5hZGp1c3RTZXR0aW5ncycsICdBZGp1c3Qgc2V0dGluZ3MnKTtcblx0XHRcdGNvbnN0IHVyaSA9IGBjb21tYW5kOiR7U2hvd0V4Y2x1ZGVPcHRpb25zLklEfT8ke2VuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShhZGp1c3RTZXR0aW5nc0FyZ3MpKX1gO1xuXHRcdFx0Y29uc3QgbWFya2Rvd24gPSBuZXcgTWFya2Rvd25TdHJpbmcoJycsIHRydWUpXG5cdFx0XHRcdC5hcHBlbmRNYXJrZG93bihyZWFzb24pXG5cdFx0XHRcdC5hcHBlbmRUZXh0KCcgJylcblx0XHRcdFx0LmFwcGVuZExpbmsodXJpLCBhZGp1c3RTZXR0aW5ncywgY29uZmlndXJlVW5pY29kZUhpZ2hsaWdodE9wdGlvbnNTdHIpO1xuXHRcdFx0cmVzdWx0LnB1c2gobmV3IE1hcmtkb3duSG92ZXIodGhpcywgZC5yYW5nZSwgW21hcmtkb3duXSwgZmFsc2UsIGluZGV4KyspKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyByZW5kZXJIb3ZlclBhcnRzKGNvbnRleHQ6IElFZGl0b3JIb3ZlclJlbmRlckNvbnRleHQsIGhvdmVyUGFydHM6IE1hcmtkb3duSG92ZXJbXSk6IElSZW5kZXJlZEhvdmVyUGFydHM8TWFya2Rvd25Ib3Zlcj4ge1xuXHRcdHJldHVybiByZW5kZXJNYXJrZG93bkhvdmVycyhjb250ZXh0LCBob3ZlclBhcnRzLCB0aGlzLl9lZGl0b3IsIHRoaXMuX2xhbmd1YWdlU2VydmljZSwgdGhpcy5fb3BlbmVyU2VydmljZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QWNjZXNzaWJsZUNvbnRlbnQoaG92ZXJQYXJ0OiBNYXJrZG93bkhvdmVyKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gaG92ZXJQYXJ0LmNvbnRlbnRzLm1hcChjID0+IGMudmFsdWUpLmpvaW4oJ1xcbicpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGNvZGVQb2ludFRvSGV4KGNvZGVQb2ludDogbnVtYmVyKTogc3RyaW5nIHtcblx0cmV0dXJuIGBVKyR7Y29kZVBvaW50LnRvU3RyaW5nKDE2KS5wYWRTdGFydCg0LCAnMCcpfWA7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdENvZGVQb2ludE1hcmtkb3duKGNvZGVQb2ludDogbnVtYmVyKSB7XG5cdGxldCB2YWx1ZSA9IGBcXGAke2NvZGVQb2ludFRvSGV4KGNvZGVQb2ludCl9XFxgYDtcblx0aWYgKCFJbnZpc2libGVDaGFyYWN0ZXJzLmlzSW52aXNpYmxlQ2hhcmFjdGVyKGNvZGVQb2ludCkpIHtcblx0XHQvLyBEb24ndCByZW5kZXIgYW55IGNvbnRyb2wgY2hhcmFjdGVycyBvciBhbnkgaW52aXNpYmxlIGNoYXJhY3RlcnMsIGFzIHRoZXkgY2Fubm90IGJlIHNlZW4gYW55d2F5cy5cblx0XHR2YWx1ZSArPSBgIFwiJHtgJHtyZW5kZXJDb2RlUG9pbnRBc0lubGluZUNvZGUoY29kZVBvaW50KX1gfVwiYDtcblx0fVxuXHRyZXR1cm4gdmFsdWU7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckNvZGVQb2ludEFzSW5saW5lQ29kZShjb2RlUG9pbnQ6IG51bWJlcik6IHN0cmluZyB7XG5cdGlmIChjb2RlUG9pbnQgPT09IENoYXJDb2RlLkJhY2tUaWNrKSB7XG5cdFx0cmV0dXJuICdgYCBgIGBgJztcblx0fVxuXHRyZXR1cm4gJ2AnICsgU3RyaW5nLmZyb21Db2RlUG9pbnQoY29kZVBvaW50KSArICdgJztcbn1cblxuZnVuY3Rpb24gY29tcHV0ZVJlYXNvbihjaGFyOiBzdHJpbmcsIG9wdGlvbnM6IFVuaWNvZGVIaWdobGlnaHRlck9wdGlvbnMpOiBVbmljb2RlSGlnaGxpZ2h0ZXJSZWFzb24gfCBudWxsIHtcblx0cmV0dXJuIFVuaWNvZGVUZXh0TW9kZWxIaWdobGlnaHRlci5jb21wdXRlVW5pY29kZUhpZ2hsaWdodFJlYXNvbihjaGFyLCBvcHRpb25zKTtcbn1cblxuY2xhc3MgRGVjb3JhdGlvbnMge1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGluc3RhbmNlID0gbmV3IERlY29yYXRpb25zKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBtYXAgPSBuZXcgTWFwPHN0cmluZywgTW9kZWxEZWNvcmF0aW9uT3B0aW9ucz4oKTtcblxuXHRnZXREZWNvcmF0aW9uRnJvbU9wdGlvbnMob3B0aW9uczogVW5pY29kZUhpZ2hsaWdodGVyT3B0aW9ucyk6IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMge1xuXHRcdHJldHVybiB0aGlzLmdldERlY29yYXRpb24oIW9wdGlvbnMuaW5jbHVkZUNvbW1lbnRzLCAhb3B0aW9ucy5pbmNsdWRlU3RyaW5ncyk7XG5cdH1cblxuXHRwcml2YXRlIGdldERlY29yYXRpb24oaGlkZUluQ29tbWVudHM6IGJvb2xlYW4sIGhpZGVJblN0cmluZ3M6IGJvb2xlYW4pOiBNb2RlbERlY29yYXRpb25PcHRpb25zIHtcblx0XHRjb25zdCBrZXkgPSBgJHtoaWRlSW5Db21tZW50c30ke2hpZGVJblN0cmluZ3N9YDtcblx0XHRsZXQgb3B0aW9ucyA9IHRoaXMubWFwLmdldChrZXkpO1xuXHRcdGlmICghb3B0aW9ucykge1xuXHRcdFx0b3B0aW9ucyA9IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMuY3JlYXRlRHluYW1pYyh7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAndW5pY29kZS1oaWdobGlnaHQnLFxuXHRcdFx0XHRzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyxcblx0XHRcdFx0Y2xhc3NOYW1lOiAndW5pY29kZS1oaWdobGlnaHQnLFxuXHRcdFx0XHRzaG93SWZDb2xsYXBzZWQ6IHRydWUsXG5cdFx0XHRcdG92ZXJ2aWV3UnVsZXI6IG51bGwsXG5cdFx0XHRcdG1pbmltYXA6IG51bGwsXG5cdFx0XHRcdGhpZGVJbkNvbW1lbnRUb2tlbnM6IGhpZGVJbkNvbW1lbnRzLFxuXHRcdFx0XHRoaWRlSW5TdHJpbmdUb2tlbnM6IGhpZGVJblN0cmluZ3MsXG5cdFx0XHR9KTtcblx0XHRcdHRoaXMubWFwLnNldChrZXksIG9wdGlvbnMpO1xuXHRcdH1cblx0XHRyZXR1cm4gb3B0aW9ucztcblx0fVxufVxuXG5pbnRlcmZhY2UgSURpc2FibGVVbmljb2RlSGlnaGxpZ2h0QWN0aW9uIHtcblx0c2hvcnRMYWJlbDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRGlzYWJsZUhpZ2hsaWdodGluZ0luQ29tbWVudHNBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24gaW1wbGVtZW50cyBJRGlzYWJsZVVuaWNvZGVIaWdobGlnaHRBY3Rpb24ge1xuXHRwdWJsaWMgc3RhdGljIElEID0gJ2VkaXRvci5hY3Rpb24udW5pY29kZUhpZ2hsaWdodC5kaXNhYmxlSGlnaGxpZ2h0aW5nSW5Db21tZW50cyc7XG5cdHB1YmxpYyByZWFkb25seSBzaG9ydExhYmVsID0gbmxzLmxvY2FsaXplKCd1bmljb2RlSGlnaGxpZ2h0LmRpc2FibGVIaWdobGlnaHRpbmdJbkNvbW1lbnRzLnNob3J0TGFiZWwnLCAnRGlzYWJsZSBIaWdobGlnaHQgSW4gQ29tbWVudHMnKTtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IERpc2FibGVIaWdobGlnaHRpbmdPZkFtYmlndW91c0NoYXJhY3RlcnNBY3Rpb24uSUQsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignYWN0aW9uLnVuaWNvZGVIaWdobGlnaHQuZGlzYWJsZUhpZ2hsaWdodGluZ0luQ29tbWVudHMnLCBcIkRpc2FibGUgaGlnaGxpZ2h0aW5nIG9mIGNoYXJhY3RlcnMgaW4gY29tbWVudHNcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciB8IHVuZGVmaW5lZCwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogYW55KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvcj8uZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0aWYgKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKSB7XG5cdFx0XHR0aGlzLnJ1bkFjdGlvbihjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bkFjdGlvbihjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUodW5pY29kZUhpZ2hsaWdodENvbmZpZ0tleXMuaW5jbHVkZUNvbW1lbnRzLCBmYWxzZSwgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRGlzYWJsZUhpZ2hsaWdodGluZ0luU3RyaW5nc0FjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiBpbXBsZW1lbnRzIElEaXNhYmxlVW5pY29kZUhpZ2hsaWdodEFjdGlvbiB7XG5cdHB1YmxpYyBzdGF0aWMgSUQgPSAnZWRpdG9yLmFjdGlvbi51bmljb2RlSGlnaGxpZ2h0LmRpc2FibGVIaWdobGlnaHRpbmdJblN0cmluZ3MnO1xuXHRwdWJsaWMgcmVhZG9ubHkgc2hvcnRMYWJlbCA9IG5scy5sb2NhbGl6ZSgndW5pY29kZUhpZ2hsaWdodC5kaXNhYmxlSGlnaGxpZ2h0aW5nSW5TdHJpbmdzLnNob3J0TGFiZWwnLCAnRGlzYWJsZSBIaWdobGlnaHQgSW4gU3RyaW5ncycpO1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogRGlzYWJsZUhpZ2hsaWdodGluZ09mQW1iaWd1b3VzQ2hhcmFjdGVyc0FjdGlvbi5JRCxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdhY3Rpb24udW5pY29kZUhpZ2hsaWdodC5kaXNhYmxlSGlnaGxpZ2h0aW5nSW5TdHJpbmdzJywgXCJEaXNhYmxlIGhpZ2hsaWdodGluZyBvZiBjaGFyYWN0ZXJzIGluIHN0cmluZ3NcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciB8IHVuZGVmaW5lZCwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogYW55KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvcj8uZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0aWYgKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKSB7XG5cdFx0XHR0aGlzLnJ1bkFjdGlvbihjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bkFjdGlvbihjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUodW5pY29kZUhpZ2hsaWdodENvbmZpZ0tleXMuaW5jbHVkZVN0cmluZ3MsIGZhbHNlLCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVIpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBEaXNhYmxlSGlnaGxpZ2h0aW5nT2ZBbWJpZ3VvdXNDaGFyYWN0ZXJzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiBpbXBsZW1lbnRzIElEaXNhYmxlVW5pY29kZUhpZ2hsaWdodEFjdGlvbiB7XG5cdHB1YmxpYyBzdGF0aWMgSUQgPSAnZWRpdG9yLmFjdGlvbi51bmljb2RlSGlnaGxpZ2h0LmRpc2FibGVIaWdobGlnaHRpbmdPZkFtYmlndW91c0NoYXJhY3RlcnMnO1xuXHRwdWJsaWMgcmVhZG9ubHkgc2hvcnRMYWJlbCA9IG5scy5sb2NhbGl6ZSgndW5pY29kZUhpZ2hsaWdodC5kaXNhYmxlSGlnaGxpZ2h0aW5nT2ZBbWJpZ3VvdXNDaGFyYWN0ZXJzLnNob3J0TGFiZWwnLCAnRGlzYWJsZSBBbWJpZ3VvdXMgSGlnaGxpZ2h0Jyk7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBEaXNhYmxlSGlnaGxpZ2h0aW5nT2ZBbWJpZ3VvdXNDaGFyYWN0ZXJzQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ2FjdGlvbi51bmljb2RlSGlnaGxpZ2h0LmRpc2FibGVIaWdobGlnaHRpbmdPZkFtYmlndW91c0NoYXJhY3RlcnMnLCBcIkRpc2FibGUgaGlnaGxpZ2h0aW5nIG9mIGFtYmlndW91cyBjaGFyYWN0ZXJzXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yIHwgdW5kZWZpbmVkLCBlZGl0b3I6IElDb2RlRWRpdG9yLCBhcmdzOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yPy5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRpZiAoY29uZmlndXJhdGlvblNlcnZpY2UpIHtcblx0XHRcdHRoaXMucnVuQWN0aW9uKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuQWN0aW9uKGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCBjb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZSh1bmljb2RlSGlnaGxpZ2h0Q29uZmlnS2V5cy5hbWJpZ3VvdXNDaGFyYWN0ZXJzLCBmYWxzZSwgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRGlzYWJsZUhpZ2hsaWdodGluZ09mSW52aXNpYmxlQ2hhcmFjdGVyc0FjdGlvbiBleHRlbmRzIEFjdGlvbjIgaW1wbGVtZW50cyBJRGlzYWJsZVVuaWNvZGVIaWdobGlnaHRBY3Rpb24ge1xuXHRwdWJsaWMgc3RhdGljIElEID0gJ2VkaXRvci5hY3Rpb24udW5pY29kZUhpZ2hsaWdodC5kaXNhYmxlSGlnaGxpZ2h0aW5nT2ZJbnZpc2libGVDaGFyYWN0ZXJzJztcblx0cHVibGljIHJlYWRvbmx5IHNob3J0TGFiZWwgPSBubHMubG9jYWxpemUoJ3VuaWNvZGVIaWdobGlnaHQuZGlzYWJsZUhpZ2hsaWdodGluZ09mSW52aXNpYmxlQ2hhcmFjdGVycy5zaG9ydExhYmVsJywgJ0Rpc2FibGUgSW52aXNpYmxlIEhpZ2hsaWdodCcpO1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogRGlzYWJsZUhpZ2hsaWdodGluZ09mSW52aXNpYmxlQ2hhcmFjdGVyc0FjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdhY3Rpb24udW5pY29kZUhpZ2hsaWdodC5kaXNhYmxlSGlnaGxpZ2h0aW5nT2ZJbnZpc2libGVDaGFyYWN0ZXJzJywgXCJEaXNhYmxlIGhpZ2hsaWdodGluZyBvZiBpbnZpc2libGUgY2hhcmFjdGVyc1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciB8IHVuZGVmaW5lZCwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogYW55KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvcj8uZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0aWYgKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKSB7XG5cdFx0XHR0aGlzLnJ1bkFjdGlvbihjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bkFjdGlvbihjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUodW5pY29kZUhpZ2hsaWdodENvbmZpZ0tleXMuaW52aXNpYmxlQ2hhcmFjdGVycywgZmFsc2UsIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERpc2FibGVIaWdobGlnaHRpbmdPZk5vbkJhc2ljQXNjaWlDaGFyYWN0ZXJzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiBpbXBsZW1lbnRzIElEaXNhYmxlVW5pY29kZUhpZ2hsaWdodEFjdGlvbiB7XG5cdHB1YmxpYyBzdGF0aWMgSUQgPSAnZWRpdG9yLmFjdGlvbi51bmljb2RlSGlnaGxpZ2h0LmRpc2FibGVIaWdobGlnaHRpbmdPZk5vbkJhc2ljQXNjaWlDaGFyYWN0ZXJzJztcblx0cHVibGljIHJlYWRvbmx5IHNob3J0TGFiZWwgPSBubHMubG9jYWxpemUoJ3VuaWNvZGVIaWdobGlnaHQuZGlzYWJsZUhpZ2hsaWdodGluZ09mTm9uQmFzaWNBc2NpaUNoYXJhY3RlcnMuc2hvcnRMYWJlbCcsICdEaXNhYmxlIE5vbiBBU0NJSSBIaWdobGlnaHQnKTtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IERpc2FibGVIaWdobGlnaHRpbmdPZk5vbkJhc2ljQXNjaWlDaGFyYWN0ZXJzQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ2FjdGlvbi51bmljb2RlSGlnaGxpZ2h0LmRpc2FibGVIaWdobGlnaHRpbmdPZk5vbkJhc2ljQXNjaWlDaGFyYWN0ZXJzJywgXCJEaXNhYmxlIGhpZ2hsaWdodGluZyBvZiBub24gYmFzaWMgQVNDSUkgY2hhcmFjdGVyc1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciB8IHVuZGVmaW5lZCwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogYW55KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvcj8uZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0aWYgKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKSB7XG5cdFx0XHR0aGlzLnJ1bkFjdGlvbihjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bkFjdGlvbihjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUodW5pY29kZUhpZ2hsaWdodENvbmZpZ0tleXMubm9uQmFzaWNBU0NJSSwgZmFsc2UsIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUik7XG5cdH1cbn1cblxuaW50ZXJmYWNlIFNob3dFeGNsdWRlT3B0aW9uc0FyZ3Mge1xuXHRjb2RlUG9pbnQ6IG51bWJlcjtcblx0cmVhc29uOiBVbmljb2RlSGlnaGxpZ2h0ZXJSZWFzb247XG5cdGluQ29tbWVudDogYm9vbGVhbjtcblx0aW5TdHJpbmc6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBTaG93RXhjbHVkZU9wdGlvbnMgZXh0ZW5kcyBBY3Rpb24yIHtcblx0cHVibGljIHN0YXRpYyBJRCA9ICdlZGl0b3IuYWN0aW9uLnVuaWNvZGVIaWdobGlnaHQuc2hvd0V4Y2x1ZGVPcHRpb25zJztcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFNob3dFeGNsdWRlT3B0aW9ucy5JRCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdhY3Rpb24udW5pY29kZUhpZ2hsaWdodC5zaG93RXhjbHVkZU9wdGlvbnMnLCBcIlNob3cgRXhjbHVkZSBPcHRpb25zXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yIHwgdW5kZWZpbmVkLCBhcmdzOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB7IGNvZGVQb2ludCwgcmVhc29uLCBpblN0cmluZywgaW5Db21tZW50IH0gPSBhcmdzIGFzIFNob3dFeGNsdWRlT3B0aW9uc0FyZ3M7XG5cblx0XHRjb25zdCBjaGFyID0gU3RyaW5nLmZyb21Db2RlUG9pbnQoY29kZVBvaW50KTtcblxuXHRcdGNvbnN0IHF1aWNrUGlja1NlcnZpY2UgPSBhY2Nlc3NvciEuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3NvciEuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRpbnRlcmZhY2UgRXh0ZW5kZWRPcHRpb25zIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0ge1xuXHRcdFx0cnVuKCk6IFByb21pc2U8dm9pZD47XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0RXhjbHVkZUNoYXJGcm9tQmVpbmdIaWdobGlnaHRlZExhYmVsKGNvZGVQb2ludDogbnVtYmVyKSB7XG5cdFx0XHRpZiAoSW52aXNpYmxlQ2hhcmFjdGVycy5pc0ludmlzaWJsZUNoYXJhY3Rlcihjb2RlUG9pbnQpKSB7XG5cdFx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ3VuaWNvZGVIaWdobGlnaHQuZXhjbHVkZUludmlzaWJsZUNoYXJGcm9tQmVpbmdIaWdobGlnaHRlZCcsICdFeGNsdWRlIHswfSAoaW52aXNpYmxlIGNoYXJhY3RlcikgZnJvbSBiZWluZyBoaWdobGlnaHRlZCcsIGNvZGVQb2ludFRvSGV4KGNvZGVQb2ludCkpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgndW5pY29kZUhpZ2hsaWdodC5leGNsdWRlQ2hhckZyb21CZWluZ0hpZ2hsaWdodGVkJywgJ0V4Y2x1ZGUgezB9IGZyb20gYmVpbmcgaGlnaGxpZ2h0ZWQnLCBgJHtjb2RlUG9pbnRUb0hleChjb2RlUG9pbnQpfSBcIiR7Y2hhcn1cImApO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9wdGlvbnM6IEV4dGVuZGVkT3B0aW9uc1tdID0gW107XG5cblx0XHRpZiAocmVhc29uLmtpbmQgPT09IFVuaWNvZGVIaWdobGlnaHRlclJlYXNvbktpbmQuQW1iaWd1b3VzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGxvY2FsZSBvZiByZWFzb24ubm90QW1iaWd1b3VzSW5Mb2NhbGVzKSB7XG5cdFx0XHRcdG9wdGlvbnMucHVzaCh7XG5cdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZShcInVuaWNvZGVIaWdobGlnaHQuYWxsb3dDb21tb25DaGFyYWN0ZXJzSW5MYW5ndWFnZVwiLCBcIkFsbG93IHVuaWNvZGUgY2hhcmFjdGVycyB0aGF0IGFyZSBtb3JlIGNvbW1vbiBpbiB0aGUgbGFuZ3VhZ2UgXFxcInswfVxcXCIuXCIsIGxvY2FsZSksXG5cdFx0XHRcdFx0cnVuOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRleGNsdWRlTG9jYWxlRnJvbUJlaW5nSGlnaGxpZ2h0ZWQoY29uZmlndXJhdGlvblNlcnZpY2UsIFtsb2NhbGVdKTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRvcHRpb25zLnB1c2goXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiBnZXRFeGNsdWRlQ2hhckZyb21CZWluZ0hpZ2hsaWdodGVkTGFiZWwoY29kZVBvaW50KSxcblx0XHRcdFx0cnVuOiAoKSA9PiBleGNsdWRlQ2hhckZyb21CZWluZ0hpZ2hsaWdodGVkKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBbY29kZVBvaW50XSlcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0aWYgKGluQ29tbWVudCkge1xuXHRcdFx0Y29uc3QgYWN0aW9uID0gbmV3IERpc2FibGVIaWdobGlnaHRpbmdJbkNvbW1lbnRzQWN0aW9uKCk7XG5cdFx0XHRvcHRpb25zLnB1c2goeyBsYWJlbDogYWN0aW9uLmxhYmVsLCBydW46IGFzeW5jICgpID0+IGFjdGlvbi5ydW5BY3Rpb24oY29uZmlndXJhdGlvblNlcnZpY2UpIH0pO1xuXHRcdH0gZWxzZSBpZiAoaW5TdHJpbmcpIHtcblx0XHRcdGNvbnN0IGFjdGlvbiA9IG5ldyBEaXNhYmxlSGlnaGxpZ2h0aW5nSW5TdHJpbmdzQWN0aW9uKCk7XG5cdFx0XHRvcHRpb25zLnB1c2goeyBsYWJlbDogYWN0aW9uLmxhYmVsLCBydW46IGFzeW5jICgpID0+IGFjdGlvbi5ydW5BY3Rpb24oY29uZmlndXJhdGlvblNlcnZpY2UpIH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFRpdGxlKG9wdGlvbnM6IEFjdGlvbjIpIHtcblx0XHRcdHJldHVybiB0eXBlb2Ygb3B0aW9ucy5kZXNjLnRpdGxlID09PSAnc3RyaW5nJyA/IG9wdGlvbnMuZGVzYy50aXRsZSA6IG9wdGlvbnMuZGVzYy50aXRsZS52YWx1ZTtcblx0XHR9XG5cblx0XHRpZiAocmVhc29uLmtpbmQgPT09IFVuaWNvZGVIaWdobGlnaHRlclJlYXNvbktpbmQuQW1iaWd1b3VzKSB7XG5cdFx0XHRjb25zdCBhY3Rpb24gPSBuZXcgRGlzYWJsZUhpZ2hsaWdodGluZ09mQW1iaWd1b3VzQ2hhcmFjdGVyc0FjdGlvbigpO1xuXHRcdFx0b3B0aW9ucy5wdXNoKHsgbGFiZWw6IGdldFRpdGxlKGFjdGlvbiksIHJ1bjogYXN5bmMgKCkgPT4gYWN0aW9uLnJ1bkFjdGlvbihjb25maWd1cmF0aW9uU2VydmljZSkgfSk7XG5cdFx0fSBlbHNlIGlmIChyZWFzb24ua2luZCA9PT0gVW5pY29kZUhpZ2hsaWdodGVyUmVhc29uS2luZC5JbnZpc2libGUpIHtcblx0XHRcdGNvbnN0IGFjdGlvbiA9IG5ldyBEaXNhYmxlSGlnaGxpZ2h0aW5nT2ZJbnZpc2libGVDaGFyYWN0ZXJzQWN0aW9uKCk7XG5cdFx0XHRvcHRpb25zLnB1c2goeyBsYWJlbDogZ2V0VGl0bGUoYWN0aW9uKSwgcnVuOiBhc3luYyAoKSA9PiBhY3Rpb24ucnVuQWN0aW9uKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKSB9KTtcblx0XHR9IGVsc2UgaWYgKHJlYXNvbi5raW5kID09PSBVbmljb2RlSGlnaGxpZ2h0ZXJSZWFzb25LaW5kLk5vbkJhc2ljQXNjaWkpIHtcblx0XHRcdGNvbnN0IGFjdGlvbiA9IG5ldyBEaXNhYmxlSGlnaGxpZ2h0aW5nT2ZOb25CYXNpY0FzY2lpQ2hhcmFjdGVyc0FjdGlvbigpO1xuXHRcdFx0b3B0aW9ucy5wdXNoKHsgbGFiZWw6IGdldFRpdGxlKGFjdGlvbiksIHJ1bjogYXN5bmMgKCkgPT4gYWN0aW9uLnJ1bkFjdGlvbihjb25maWd1cmF0aW9uU2VydmljZSkgfSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGV4cGVjdE5ldmVyKHJlYXNvbik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcXVpY2tQaWNrU2VydmljZS5waWNrKFxuXHRcdFx0b3B0aW9ucyxcblx0XHRcdHsgdGl0bGU6IGNvbmZpZ3VyZVVuaWNvZGVIaWdobGlnaHRPcHRpb25zU3RyIH1cblx0XHQpO1xuXG5cdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0YXdhaXQgcmVzdWx0LnJ1bigpO1xuXHRcdH1cblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiBleGNsdWRlQ2hhckZyb21CZWluZ0hpZ2hsaWdodGVkKGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsIGNoYXJDb2RlczogbnVtYmVyW10pIHtcblx0Y29uc3QgZXhpc3RpbmdWYWx1ZSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKHVuaWNvZGVIaWdobGlnaHRDb25maWdLZXlzLmFsbG93ZWRDaGFyYWN0ZXJzKTtcblxuXHRsZXQgdmFsdWU6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+O1xuXHRpZiAoKHR5cGVvZiBleGlzdGluZ1ZhbHVlID09PSAnb2JqZWN0JykgJiYgZXhpc3RpbmdWYWx1ZSkge1xuXHRcdHZhbHVlID0gZXhpc3RpbmdWYWx1ZSBhcyBhbnk7XG5cdH0gZWxzZSB7XG5cdFx0dmFsdWUgPSB7fTtcblx0fVxuXG5cdGZvciAoY29uc3QgY2hhckNvZGUgb2YgY2hhckNvZGVzKSB7XG5cdFx0dmFsdWVbU3RyaW5nLmZyb21Db2RlUG9pbnQoY2hhckNvZGUpXSA9IHRydWU7XG5cdH1cblxuXHRhd2FpdCBjb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZSh1bmljb2RlSGlnaGxpZ2h0Q29uZmlnS2V5cy5hbGxvd2VkQ2hhcmFjdGVycywgdmFsdWUsIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGV4Y2x1ZGVMb2NhbGVGcm9tQmVpbmdIaWdobGlnaHRlZChjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsb2NhbGVzOiBzdHJpbmdbXSkge1xuXHRjb25zdCBleGlzdGluZ1ZhbHVlID0gY29uZmlndXJhdGlvblNlcnZpY2UuaW5zcGVjdCh1bmljb2RlSGlnaGxpZ2h0Q29uZmlnS2V5cy5hbGxvd2VkTG9jYWxlcykudXNlcj8udmFsdWU7XG5cblx0bGV0IHZhbHVlOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPjtcblx0aWYgKCh0eXBlb2YgZXhpc3RpbmdWYWx1ZSA9PT0gJ29iamVjdCcpICYmIGV4aXN0aW5nVmFsdWUpIHtcblx0XHQvLyBDb3B5IHZhbHVlLCBhcyB0aGUgZXhpc3RpbmcgdmFsdWUgaXMgcmVhZCBvbmx5XG5cdFx0dmFsdWUgPSBPYmplY3QuYXNzaWduKHt9LCBleGlzdGluZ1ZhbHVlIGFzIGFueSk7XG5cdH0gZWxzZSB7XG5cdFx0dmFsdWUgPSB7fTtcblx0fVxuXG5cdGZvciAoY29uc3QgbG9jYWxlIG9mIGxvY2FsZXMpIHtcblx0XHR2YWx1ZVtsb2NhbGVdID0gdHJ1ZTtcblx0fVxuXG5cdGF3YWl0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKHVuaWNvZGVIaWdobGlnaHRDb25maWdLZXlzLmFsbG93ZWRMb2NhbGVzLCB2YWx1ZSwgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSKTtcbn1cblxuZnVuY3Rpb24gZXhwZWN0TmV2ZXIodmFsdWU6IG5ldmVyKSB7XG5cdHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCB2YWx1ZTogJHt2YWx1ZX1gKTtcbn1cblxucmVnaXN0ZXJBY3Rpb24yKERpc2FibGVIaWdobGlnaHRpbmdPZkFtYmlndW91c0NoYXJhY3RlcnNBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKERpc2FibGVIaWdobGlnaHRpbmdPZkludmlzaWJsZUNoYXJhY3RlcnNBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKERpc2FibGVIaWdobGlnaHRpbmdPZk5vbkJhc2ljQXNjaWlDaGFyYWN0ZXJzQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihTaG93RXhjbHVkZU9wdGlvbnMpO1xucmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24oVW5pY29kZUhpZ2hsaWdodGVyLklELCBVbmljb2RlSGlnaGxpZ2h0ZXIsIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24uQWZ0ZXJGaXJzdFJlbmRlcik7XG5Ib3ZlclBhcnRpY2lwYW50UmVnaXN0cnkucmVnaXN0ZXIoVW5pY29kZUhpZ2hsaWdodGVySG92ZXJQYXJ0aWNpcGFudCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZUFBZTtBQUN4QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGtCQUFrQjtBQUMzQixZQUFZLGNBQWM7QUFDMUIsU0FBUyxxQkFBcUIsb0JBQW9CO0FBQ2xELE9BQU87QUFFUCxTQUFTLGNBQWMsaUNBQWlDLGtDQUFvRDtBQUM1RyxTQUErQixzQkFBc0IsY0FBK0Msa0NBQWtDO0FBR3RJLFNBQThELDhCQUE4QjtBQUM1RixTQUFTLDhCQUE4QjtBQUN2QyxTQUE4RCw4QkFBOEIsbUNBQW1DO0FBQy9ILFNB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ZUFBZTtBQUN0RSxZQUFNLFNBQVMsSUFBSSxtREFBbUQ7QUFDdEUsY0FBUSxLQUFLLEVBQUUsT0FBTyxTQUFTLE1BQU0sR0FBRyxLQUFLLFlBQVksT0FBTyxVQUFVLG9CQUFvQixFQUFFLENBQUM7QUFBQSxJQUNsRyxPQUFPO0FBQ04sa0JBQVksTUFBTTtBQUFBLElBQ25CO0FBRUEsVUFBTSxTQUFTLE1BQU0saUJBQWlCO0FBQUEsTUFDckM7QUFBQSxNQUNBLEVBQUUsT0FBTyxvQ0FBb0M7QUFBQSxJQUM5QztBQUVBLFFBQUksUUFBUTtBQUNYLFlBQU0sT0FBTyxJQUFJO0FBQUEsSUFDbEI7QUFBQSxFQUNEO0FBQ0Q7QUFwRmEsb0JBQ0UsS0FBSztBQURiLElBQU0scUJBQU47QUFzRlAsZUFBZSxnQ0FBZ0Msc0JBQTZDLFdBQXFCO0FBQ2hILFFBQU0sZ0JBQWdCLHFCQUFxQixTQUFTLDJCQUEyQixpQkFBaUI7QUFFaEcsTUFBSTtBQUNKLE1BQUssT0FBTyxrQkFBa0IsWUFBYSxlQUFlO0FBQ3pELFlBQVE7QUFBQSxFQUNULE9BQU87QUFDTixZQUFRLENBQUM7QUFBQSxFQUNWO0FBRUEsYUFBVyxZQUFZLFdBQVc7QUFDakMsVUFBTSxPQUFPLGNBQWMsUUFBUSxDQUFDLElBQUk7QUFBQSxFQUN6QztBQUVBLFFBQU0scUJBQXFCLFlBQVksMkJBQTJCLG1CQUFtQixPQUFPLG9CQUFvQixJQUFJO0FBQ3JIO0FBRUEsZUFBZSxrQ0FBa0Msc0JBQTZDLFNBQW1CO0FBQ2hILFFBQU0sZ0JBQWdCLHFCQUFxQixRQUFRLDJCQUEyQixjQUFjLEVBQUUsTUFBTTtBQUVwRyxNQUFJO0FBQ0osTUFBSyxPQUFPLGtCQUFrQixZQUFhLGVBQWU7QUFFekQsWUFBUSxPQUFPLE9BQU8sQ0FBQyxHQUFHLGFBQW9CO0FBQUEsRUFDL0MsT0FBTztBQUNOLFlBQVEsQ0FBQztBQUFBLEVBQ1Y7QUFFQSxhQUFXLFVBQVUsU0FBUztBQUM3QixVQUFNLE1BQU0sSUFBSTtBQUFBLEVBQ2pCO0FBRUEsUUFBTSxxQkFBcUIsWUFBWSwyQkFBMkIsZ0JBQWdCLE9BQU8sb0JBQW9CLElBQUk7QUFDbEg7QUFFQSxTQUFTLFlBQVksT0FBYztBQUNsQyxRQUFNLElBQUksTUFBTSxxQkFBcUIsS0FBSyxFQUFFO0FBQzdDO0FBRUEsZ0JBQWdCLDhDQUE4QztBQUM5RCxnQkFBZ0IsOENBQThDO0FBQzlELGdCQUFnQixrREFBa0Q7QUFDbEUsZ0JBQWdCLGtCQUFrQjtBQUNsQywyQkFBMkIsbUJBQW1CLElBQUksb0JBQW9CLGdDQUFnQyxnQkFBZ0I7QUFDdEgseUJBQXlCLFNBQVMsa0NBQWtDOyIsCiAgIm5hbWVzIjogWyJjb2RlUG9pbnQiLCAib3B0aW9ucyJdCn0K
