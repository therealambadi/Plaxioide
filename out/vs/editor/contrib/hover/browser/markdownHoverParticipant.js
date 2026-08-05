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
import { asArray, compareBy, numberComparator } from "../../../../base/common/arrays.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { isEmptyMarkdownString, MarkdownString } from "../../../../base/common/htmlContent.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { MarkdownRenderer } from "../../../browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { DECREASE_HOVER_VERBOSITY_ACTION_ID, INCREASE_HOVER_VERBOSITY_ACTION_ID } from "./hoverActionIds.js";
import { Range } from "../../../common/core/range.js";
import { ILanguageService } from "../../../common/languages/language.js";
import { HoverAnchorType, RenderedHoverParts } from "./hoverTypes.js";
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { HoverVerbosityAction } from "../../../common/languages.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { onUnexpectedExternalError } from "../../../../base/common/errors.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ClickAction, HoverPosition, KeyDownAction } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { IHoverService, WorkbenchHoverDelegate } from "../../../../platform/hover/browser/hover.js";
import { AsyncIterableObject } from "../../../../base/common/async.js";
import { getHoverProviderResultsAsAsyncIterable } from "./getHover.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
const $ = dom.$;
const increaseHoverVerbosityIcon = registerIcon("hover-increase-verbosity", Codicon.add, nls.localize("increaseHoverVerbosity", "Icon for increaseing hover verbosity."));
const decreaseHoverVerbosityIcon = registerIcon("hover-decrease-verbosity", Codicon.remove, nls.localize("decreaseHoverVerbosity", "Icon for decreasing hover verbosity."));
class MarkdownHover {
  constructor(owner, range, contents, isBeforeContent, ordinal, source = void 0) {
    this.owner = owner;
    this.range = range;
    this.contents = contents;
    this.isBeforeContent = isBeforeContent;
    this.ordinal = ordinal;
    this.source = source;
  }
  isValidForHoverAnchor(anchor) {
    return anchor.type === HoverAnchorType.Range && this.range.startColumn <= anchor.range.startColumn && this.range.endColumn >= anchor.range.endColumn;
  }
}
class HoverSource {
  constructor(hover, hoverProvider, hoverPosition) {
    this.hover = hover;
    this.hoverProvider = hoverProvider;
    this.hoverPosition = hoverPosition;
  }
  supportsVerbosityAction(hoverVerbosityAction) {
    switch (hoverVerbosityAction) {
      case HoverVerbosityAction.Increase:
        return this.hover.canIncreaseVerbosity ?? false;
      case HoverVerbosityAction.Decrease:
        return this.hover.canDecreaseVerbosity ?? false;
    }
  }
}
let MarkdownHoverParticipant = class {
  constructor(_editor, _languageService, _openerService, _configurationService, _languageFeaturesService, _keybindingService, _hoverService, _commandService) {
    this._editor = _editor;
    this._languageService = _languageService;
    this._openerService = _openerService;
    this._configurationService = _configurationService;
    this._languageFeaturesService = _languageFeaturesService;
    this._keybindingService = _keybindingService;
    this._hoverService = _hoverService;
    this._commandService = _commandService;
    this.hoverOrdinal = 3;
  }
  createLoadingMessage(anchor) {
    return new MarkdownHover(this, anchor.range, [new MarkdownString().appendText(nls.localize("modesContentHover.loading", "Loading..."))], false, 2e3);
  }
  computeSync(anchor, lineDecorations) {
    if (!this._editor.hasModel() || anchor.type !== HoverAnchorType.Range) {
      return [];
    }
    const model = this._editor.getModel();
    const lineNumber = anchor.range.startLineNumber;
    const maxColumn = model.getLineMaxColumn(lineNumber);
    const result = [];
    let index = 1e3;
    const lineLength = model.getLineLength(lineNumber);
    const languageId = model.getLanguageIdAtPosition(anchor.range.startLineNumber, anchor.range.startColumn);
    const stopRenderingLineAfter = this._editor.getOption(EditorOption.stopRenderingLineAfter);
    const maxTokenizationLineLength = this._configurationService.getValue("editor.maxTokenizationLineLength", {
      overrideIdentifier: languageId
    });
    let stopRenderingMessage = false;
    if (stopRenderingLineAfter >= 0 && lineLength > stopRenderingLineAfter && anchor.range.startColumn >= stopRenderingLineAfter) {
      stopRenderingMessage = true;
      result.push(new MarkdownHover(this, anchor.range, [{
        value: nls.localize("stopped rendering", "Rendering paused for long line for performance reasons. This can be configured via `editor.stopRenderingLineAfter`.")
      }], false, index++));
    }
    if (!stopRenderingMessage && typeof maxTokenizationLineLength === "number" && lineLength >= maxTokenizationLineLength) {
      result.push(new MarkdownHover(this, anchor.range, [{
        value: nls.localize("too many characters", "Tokenization is skipped for long lines for performance reasons. This can be configured via `editor.maxTokenizationLineLength`.")
      }], false, index++));
    }
    let isBeforeContent = false;
    for (const d of lineDecorations) {
      const startColumn = d.range.startLineNumber === lineNumber ? d.range.startColumn : 1;
      const endColumn = d.range.endLineNumber === lineNumber ? d.range.endColumn : maxColumn;
      const hoverMessage = d.options.hoverMessage;
      if (!hoverMessage || isEmptyMarkdownString(hoverMessage)) {
        continue;
      }
      if (d.options.beforeContentClassName) {
        isBeforeContent = true;
      }
      const range = new Range(anchor.range.startLineNumber, startColumn, anchor.range.startLineNumber, endColumn);
      result.push(new MarkdownHover(this, range, asArray(hoverMessage), isBeforeContent, index++));
    }
    return result;
  }
  computeAsync(anchor, lineDecorations, source, token) {
    if (!this._editor.hasModel() || anchor.type !== HoverAnchorType.Range) {
      return AsyncIterableObject.EMPTY;
    }
    const model = this._editor.getModel();
    const hoverProviderRegistry = this._languageFeaturesService.hoverProvider;
    if (!hoverProviderRegistry.has(model)) {
      return AsyncIterableObject.EMPTY;
    }
    const markdownHovers = this._getMarkdownHovers(hoverProviderRegistry, model, anchor, token);
    return markdownHovers;
  }
  _getMarkdownHovers(hoverProviderRegistry, model, anchor, token) {
    const position = anchor.range.getStartPosition();
    const hoverProviderResults = getHoverProviderResultsAsAsyncIterable(hoverProviderRegistry, model, position, token);
    const markdownHovers = hoverProviderResults.filter((item) => !isEmptyMarkdownString(item.hover.contents)).map((item) => {
      const range = item.hover.range ? Range.lift(item.hover.range) : anchor.range;
      const hoverSource = new HoverSource(item.hover, item.provider, position);
      return new MarkdownHover(this, range, item.hover.contents, false, item.ordinal, hoverSource);
    });
    return markdownHovers;
  }
  renderHoverParts(context, hoverParts) {
    this._renderedHoverParts = new MarkdownRenderedHoverParts(
      hoverParts,
      context.fragment,
      this,
      this._editor,
      this._languageService,
      this._openerService,
      this._commandService,
      this._keybindingService,
      this._hoverService,
      this._configurationService,
      context.onContentsChanged
    );
    return this._renderedHoverParts;
  }
  handleScroll(e) {
    this._renderedHoverParts?.handleScroll(e);
  }
  getAccessibleContent(hoverPart) {
    return this._renderedHoverParts?.getAccessibleContent(hoverPart) ?? "";
  }
  doesMarkdownHoverAtIndexSupportVerbosityAction(index, action) {
    return this._renderedHoverParts?.doesMarkdownHoverAtIndexSupportVerbosityAction(index, action) ?? false;
  }
  updateMarkdownHoverVerbosityLevel(action, index) {
    return Promise.resolve(this._renderedHoverParts?.updateMarkdownHoverPartVerbosityLevel(action, index));
  }
};
MarkdownHoverParticipant = __decorateClass([
  __decorateParam(1, ILanguageService),
  __decorateParam(2, IOpenerService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ILanguageFeaturesService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, ICommandService)
], MarkdownHoverParticipant);
class RenderedMarkdownHoverPart {
  constructor(hoverPart, hoverElement, disposables, actionsContainer) {
    this.hoverPart = hoverPart;
    this.hoverElement = hoverElement;
    this.disposables = disposables;
    this.actionsContainer = actionsContainer;
  }
  get hoverAccessibleContent() {
    return this.hoverElement.innerText.trim();
  }
  dispose() {
    this.disposables.dispose();
  }
}
class MarkdownRenderedHoverParts {
  constructor(hoverParts, hoverPartsContainer, _hoverParticipant, _editor, _languageService, _openerService, _commandService, _keybindingService, _hoverService, _configurationService, _onFinishedRendering) {
    this._hoverParticipant = _hoverParticipant;
    this._editor = _editor;
    this._languageService = _languageService;
    this._openerService = _openerService;
    this._commandService = _commandService;
    this._keybindingService = _keybindingService;
    this._hoverService = _hoverService;
    this._configurationService = _configurationService;
    this._onFinishedRendering = _onFinishedRendering;
    this._ongoingHoverOperations = /* @__PURE__ */ new Map();
    this._disposables = new DisposableStore();
    this.renderedHoverParts = this._renderHoverParts(hoverParts, hoverPartsContainer, this._onFinishedRendering);
    this._disposables.add(toDisposable(() => {
      this.renderedHoverParts.forEach((renderedHoverPart) => {
        renderedHoverPart.dispose();
      });
      this._ongoingHoverOperations.forEach((operation) => {
        operation.tokenSource.dispose(true);
      });
    }));
  }
  _renderHoverParts(hoverParts, hoverPartsContainer, onFinishedRendering) {
    hoverParts.sort(compareBy((hover) => hover.ordinal, numberComparator));
    return hoverParts.map((hoverPart) => {
      const renderedHoverPart = this._renderHoverPart(hoverPart, onFinishedRendering);
      hoverPartsContainer.appendChild(renderedHoverPart.hoverElement);
      return renderedHoverPart;
    });
  }
  _renderHoverPart(hoverPart, onFinishedRendering) {
    const renderedMarkdownPart = this._renderMarkdownHover(hoverPart, onFinishedRendering);
    const renderedMarkdownElement = renderedMarkdownPart.hoverElement;
    const hoverSource = hoverPart.source;
    const disposables = new DisposableStore();
    disposables.add(renderedMarkdownPart);
    if (!hoverSource) {
      return new RenderedMarkdownHoverPart(hoverPart, renderedMarkdownElement, disposables);
    }
    const canIncreaseVerbosity = hoverSource.supportsVerbosityAction(HoverVerbosityAction.Increase);
    const canDecreaseVerbosity = hoverSource.supportsVerbosityAction(HoverVerbosityAction.Decrease);
    if (!canIncreaseVerbosity && !canDecreaseVerbosity) {
      return new RenderedMarkdownHoverPart(hoverPart, renderedMarkdownElement, disposables);
    }
    const actionsContainer = $("div.verbosity-actions");
    renderedMarkdownElement.prepend(actionsContainer);
    const actionsContainerInner = $("div.verbosity-actions-inner");
    actionsContainer.append(actionsContainerInner);
    disposables.add(this._renderHoverExpansionAction(actionsContainerInner, HoverVerbosityAction.Increase, canIncreaseVerbosity));
    disposables.add(this._renderHoverExpansionAction(actionsContainerInner, HoverVerbosityAction.Decrease, canDecreaseVerbosity));
    return new RenderedMarkdownHoverPart(hoverPart, renderedMarkdownElement, disposables, actionsContainerInner);
  }
  _renderMarkdownHover(markdownHover, onFinishedRendering) {
    const renderedMarkdownHover = renderMarkdownInContainer(
      this._editor,
      markdownHover,
      this._languageService,
      this._openerService,
      onFinishedRendering
    );
    return renderedMarkdownHover;
  }
  _renderHoverExpansionAction(container, action, actionEnabled) {
    const store = new DisposableStore();
    const isActionIncrease = action === HoverVerbosityAction.Increase;
    const actionElement = dom.append(container, $(ThemeIcon.asCSSSelector(isActionIncrease ? increaseHoverVerbosityIcon : decreaseHoverVerbosityIcon)));
    actionElement.tabIndex = 0;
    const hoverDelegate = new WorkbenchHoverDelegate("mouse", void 0, { target: container, position: { hoverPosition: HoverPosition.LEFT } }, this._configurationService, this._hoverService);
    store.add(this._hoverService.setupManagedHover(hoverDelegate, actionElement, labelForHoverVerbosityAction(this._keybindingService, action)));
    if (!actionEnabled) {
      actionElement.classList.add("disabled");
      return store;
    }
    actionElement.classList.add("enabled");
    const actionFunction = () => this._commandService.executeCommand(action === HoverVerbosityAction.Increase ? INCREASE_HOVER_VERBOSITY_ACTION_ID : DECREASE_HOVER_VERBOSITY_ACTION_ID, { focus: true });
    store.add(new ClickAction(actionElement, actionFunction));
    store.add(new KeyDownAction(actionElement, actionFunction, [KeyCode.Enter, KeyCode.Space]));
    return store;
  }
  handleScroll(e) {
    this.renderedHoverParts.forEach((renderedHoverPart) => {
      const actionsContainerInner = renderedHoverPart.actionsContainer;
      if (!actionsContainerInner) {
        return;
      }
      const hoverElement = renderedHoverPart.hoverElement;
      const topOfHoverScrollPosition = e.scrollTop;
      const bottomOfHoverScrollPosition = topOfHoverScrollPosition + e.height;
      const topOfRenderedPart = hoverElement.offsetTop;
      const hoverElementHeight = hoverElement.clientHeight;
      const bottomOfRenderedPart = topOfRenderedPart + hoverElementHeight;
      const iconsHeight = 22;
      let top;
      if (bottomOfRenderedPart <= bottomOfHoverScrollPosition || topOfRenderedPart >= bottomOfHoverScrollPosition) {
        top = hoverElementHeight - iconsHeight;
      } else {
        top = bottomOfHoverScrollPosition - topOfRenderedPart - iconsHeight;
      }
      actionsContainerInner.style.top = `${top}px`;
    });
  }
  async updateMarkdownHoverPartVerbosityLevel(action, index) {
    const model = this._editor.getModel();
    if (!model) {
      return void 0;
    }
    const hoverRenderedPart = this._getRenderedHoverPartAtIndex(index);
    const hoverSource = hoverRenderedPart?.hoverPart.source;
    if (!hoverRenderedPart || !hoverSource?.supportsVerbosityAction(action)) {
      return void 0;
    }
    const newHover = await this._fetchHover(hoverSource, model, action);
    if (!newHover) {
      return void 0;
    }
    const newHoverSource = new HoverSource(newHover, hoverSource.hoverProvider, hoverSource.hoverPosition);
    const initialHoverPart = hoverRenderedPart.hoverPart;
    const newHoverPart = new MarkdownHover(
      this._hoverParticipant,
      initialHoverPart.range,
      newHover.contents,
      initialHoverPart.isBeforeContent,
      initialHoverPart.ordinal,
      newHoverSource
    );
    const newHoverRenderedPart = this._updateRenderedHoverPart(index, newHoverPart);
    if (!newHoverRenderedPart) {
      return void 0;
    }
    return {
      hoverPart: newHoverPart,
      hoverElement: newHoverRenderedPart.hoverElement
    };
  }
  getAccessibleContent(hoverPart) {
    const renderedHoverPartIndex = this.renderedHoverParts.findIndex((renderedHoverPart2) => renderedHoverPart2.hoverPart === hoverPart);
    if (renderedHoverPartIndex === -1) {
      return void 0;
    }
    const renderedHoverPart = this._getRenderedHoverPartAtIndex(renderedHoverPartIndex);
    if (!renderedHoverPart) {
      return void 0;
    }
    const hoverElementInnerText = renderedHoverPart.hoverElement.innerText;
    const accessibleContent = hoverElementInnerText.replace(/[^\S\n\r]+/gu, " ");
    return accessibleContent;
  }
  doesMarkdownHoverAtIndexSupportVerbosityAction(index, action) {
    const hoverRenderedPart = this._getRenderedHoverPartAtIndex(index);
    const hoverSource = hoverRenderedPart?.hoverPart.source;
    if (!hoverRenderedPart || !hoverSource?.supportsVerbosityAction(action)) {
      return false;
    }
    return true;
  }
  async _fetchHover(hoverSource, model, action) {
    let verbosityDelta = action === HoverVerbosityAction.Increase ? 1 : -1;
    const provider = hoverSource.hoverProvider;
    const ongoingHoverOperation = this._ongoingHoverOperations.get(provider);
    if (ongoingHoverOperation) {
      ongoingHoverOperation.tokenSource.cancel();
      verbosityDelta += ongoingHoverOperation.verbosityDelta;
    }
    const tokenSource = new CancellationTokenSource();
    this._ongoingHoverOperations.set(provider, { verbosityDelta, tokenSource });
    const context = { verbosityRequest: { verbosityDelta, previousHover: hoverSource.hover } };
    let hover;
    try {
      hover = await Promise.resolve(provider.provideHover(model, hoverSource.hoverPosition, tokenSource.token, context));
    } catch (e) {
      onUnexpectedExternalError(e);
    }
    tokenSource.dispose();
    this._ongoingHoverOperations.delete(provider);
    return hover;
  }
  _updateRenderedHoverPart(index, hoverPart) {
    if (index >= this.renderedHoverParts.length || index < 0) {
      return void 0;
    }
    const renderedHoverPart = this._renderHoverPart(hoverPart, this._onFinishedRendering);
    const currentRenderedHoverPart = this.renderedHoverParts[index];
    const currentRenderedMarkdown = currentRenderedHoverPart.hoverElement;
    const renderedMarkdown = renderedHoverPart.hoverElement;
    const renderedChildrenElements = Array.from(renderedMarkdown.children);
    currentRenderedMarkdown.replaceChildren(...renderedChildrenElements);
    const newRenderedHoverPart = new RenderedMarkdownHoverPart(
      hoverPart,
      currentRenderedMarkdown,
      renderedHoverPart.disposables,
      renderedHoverPart.actionsContainer
    );
    currentRenderedHoverPart.dispose();
    this.renderedHoverParts[index] = newRenderedHoverPart;
    return newRenderedHoverPart;
  }
  _getRenderedHoverPartAtIndex(index) {
    return this.renderedHoverParts[index];
  }
  dispose() {
    this._disposables.dispose();
  }
}
function renderMarkdownHovers(context, markdownHovers, editor, languageService, openerService) {
  markdownHovers.sort(compareBy((hover) => hover.ordinal, numberComparator));
  const renderedHoverParts = [];
  for (const markdownHover of markdownHovers) {
    renderedHoverParts.push(renderMarkdownInContainer(
      editor,
      markdownHover,
      languageService,
      openerService,
      context.onContentsChanged
    ));
  }
  return new RenderedHoverParts(renderedHoverParts);
}
function renderMarkdownInContainer(editor, markdownHover, languageService, openerService, onFinishedRendering) {
  const disposables = new DisposableStore();
  const renderedMarkdown = $("div.hover-row");
  const renderedMarkdownContents = $("div.hover-row-contents");
  renderedMarkdown.appendChild(renderedMarkdownContents);
  const markdownStrings = markdownHover.contents;
  for (const markdownString of markdownStrings) {
    if (isEmptyMarkdownString(markdownString)) {
      continue;
    }
    const markdownHoverElement = $("div.markdown-hover");
    const hoverContentsElement = dom.append(markdownHoverElement, $("div.hover-contents"));
    const renderer = new MarkdownRenderer({ editor }, languageService, openerService);
    const renderedContents = disposables.add(renderer.render(markdownString, {
      asyncRenderCallback: () => {
        hoverContentsElement.className = "hover-contents code-hover-contents";
        onFinishedRendering();
      }
    }));
    hoverContentsElement.appendChild(renderedContents.element);
    renderedMarkdownContents.appendChild(markdownHoverElement);
  }
  const renderedHoverPart = {
    hoverPart: markdownHover,
    hoverElement: renderedMarkdown,
    dispose() {
      disposables.dispose();
    }
  };
  return renderedHoverPart;
}
function labelForHoverVerbosityAction(keybindingService, action) {
  switch (action) {
    case HoverVerbosityAction.Increase: {
      const kb = keybindingService.lookupKeybinding(INCREASE_HOVER_VERBOSITY_ACTION_ID);
      return kb ? nls.localize("increaseVerbosityWithKb", "Increase Hover Verbosity ({0})", kb.getLabel()) : nls.localize("increaseVerbosity", "Increase Hover Verbosity");
    }
    case HoverVerbosityAction.Decrease: {
      const kb = keybindingService.lookupKeybinding(DECREASE_HOVER_VERBOSITY_ACTION_ID);
      return kb ? nls.localize("decreaseVerbosityWithKb", "Decrease Hover Verbosity ({0})", kb.getLabel()) : nls.localize("decreaseVerbosity", "Decrease Hover Verbosity");
    }
  }
}
export {
  MarkdownHover,
  MarkdownHoverParticipant,
  labelForHoverVerbosityAction,
  renderMarkdownHovers
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL21hcmtkb3duSG92ZXJQYXJ0aWNpcGFudC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IGFzQXJyYXksIGNvbXBhcmVCeSwgbnVtYmVyQ29tcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nLCBpc0VtcHR5TWFya2Rvd25TdHJpbmcsIE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvd2lkZ2V0L21hcmtkb3duUmVuZGVyZXIvYnJvd3Nlci9tYXJrZG93blJlbmRlcmVyLmpzJztcbmltcG9ydCB7IERFQ1JFQVNFX0hPVkVSX1ZFUkJPU0lUWV9BQ1RJT05fSUQsIElOQ1JFQVNFX0hPVkVSX1ZFUkJPU0lUWV9BQ1RJT05fSUQgfSBmcm9tICcuL2hvdmVyQWN0aW9uSWRzLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJTW9kZWxEZWNvcmF0aW9uLCBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IEhvdmVyQW5jaG9yLCBIb3ZlckFuY2hvclR5cGUsIEhvdmVyUmFuZ2VBbmNob3IsIElFZGl0b3JIb3ZlclBhcnRpY2lwYW50LCBJRWRpdG9ySG92ZXJSZW5kZXJDb250ZXh0LCBJSG92ZXJQYXJ0LCBJUmVuZGVyZWRIb3ZlclBhcnQsIElSZW5kZXJlZEhvdmVyUGFydHMsIFJlbmRlcmVkSG92ZXJQYXJ0cyB9IGZyb20gJy4vaG92ZXJUeXBlcy5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSG92ZXIsIEhvdmVyQ29udGV4dCwgSG92ZXJQcm92aWRlciwgSG92ZXJWZXJib3NpdHlBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVySWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFeHRlcm5hbEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgQ2xpY2tBY3Rpb24sIEhvdmVyUG9zaXRpb24sIEtleURvd25BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJXaWRnZXQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UsIFdvcmtiZW5jaEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IEFzeW5jSXRlcmFibGVPYmplY3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZUZlYXR1cmVSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZUZlYXR1cmVSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBnZXRIb3ZlclByb3ZpZGVyUmVzdWx0c0FzQXN5bmNJdGVyYWJsZSB9IGZyb20gJy4vZ2V0SG92ZXIuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IEhvdmVyU3RhcnRTb3VyY2UgfSBmcm9tICcuL2hvdmVyT3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IFNjcm9sbEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2Nyb2xsYWJsZS5qcyc7XG5cbmNvbnN0ICQgPSBkb20uJDtcbmNvbnN0IGluY3JlYXNlSG92ZXJWZXJib3NpdHlJY29uID0gcmVnaXN0ZXJJY29uKCdob3Zlci1pbmNyZWFzZS12ZXJib3NpdHknLCBDb2RpY29uLmFkZCwgbmxzLmxvY2FsaXplKCdpbmNyZWFzZUhvdmVyVmVyYm9zaXR5JywgJ0ljb24gZm9yIGluY3JlYXNlaW5nIGhvdmVyIHZlcmJvc2l0eS4nKSk7XG5jb25zdCBkZWNyZWFzZUhvdmVyVmVyYm9zaXR5SWNvbiA9IHJlZ2lzdGVySWNvbignaG92ZXItZGVjcmVhc2UtdmVyYm9zaXR5JywgQ29kaWNvbi5yZW1vdmUsIG5scy5sb2NhbGl6ZSgnZGVjcmVhc2VIb3ZlclZlcmJvc2l0eScsICdJY29uIGZvciBkZWNyZWFzaW5nIGhvdmVyIHZlcmJvc2l0eS4nKSk7XG5cbmV4cG9ydCBjbGFzcyBNYXJrZG93bkhvdmVyIGltcGxlbWVudHMgSUhvdmVyUGFydCB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IG93bmVyOiBJRWRpdG9ySG92ZXJQYXJ0aWNpcGFudDxNYXJrZG93bkhvdmVyPixcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmFuZ2U6IFJhbmdlLFxuXHRcdHB1YmxpYyByZWFkb25seSBjb250ZW50czogSU1hcmtkb3duU3RyaW5nW10sXG5cdFx0cHVibGljIHJlYWRvbmx5IGlzQmVmb3JlQ29udGVudDogYm9vbGVhbixcblx0XHRwdWJsaWMgcmVhZG9ubHkgb3JkaW5hbDogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBzb3VyY2U6IEhvdmVyU291cmNlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkLFxuXHQpIHsgfVxuXG5cdHB1YmxpYyBpc1ZhbGlkRm9ySG92ZXJBbmNob3IoYW5jaG9yOiBIb3ZlckFuY2hvcik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAoXG5cdFx0XHRhbmNob3IudHlwZSA9PT0gSG92ZXJBbmNob3JUeXBlLlJhbmdlXG5cdFx0XHQmJiB0aGlzLnJhbmdlLnN0YXJ0Q29sdW1uIDw9IGFuY2hvci5yYW5nZS5zdGFydENvbHVtblxuXHRcdFx0JiYgdGhpcy5yYW5nZS5lbmRDb2x1bW4gPj0gYW5jaG9yLnJhbmdlLmVuZENvbHVtblxuXHRcdCk7XG5cdH1cbn1cblxuY2xhc3MgSG92ZXJTb3VyY2Uge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGhvdmVyOiBIb3Zlcixcblx0XHRyZWFkb25seSBob3ZlclByb3ZpZGVyOiBIb3ZlclByb3ZpZGVyLFxuXHRcdHJlYWRvbmx5IGhvdmVyUG9zaXRpb246IFBvc2l0aW9uLFxuXHQpIHsgfVxuXG5cdHB1YmxpYyBzdXBwb3J0c1ZlcmJvc2l0eUFjdGlvbihob3ZlclZlcmJvc2l0eUFjdGlvbjogSG92ZXJWZXJib3NpdHlBY3Rpb24pOiBib29sZWFuIHtcblx0XHRzd2l0Y2ggKGhvdmVyVmVyYm9zaXR5QWN0aW9uKSB7XG5cdFx0XHRjYXNlIEhvdmVyVmVyYm9zaXR5QWN0aW9uLkluY3JlYXNlOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5ob3Zlci5jYW5JbmNyZWFzZVZlcmJvc2l0eSA/PyBmYWxzZTtcblx0XHRcdGNhc2UgSG92ZXJWZXJib3NpdHlBY3Rpb24uRGVjcmVhc2U6XG5cdFx0XHRcdHJldHVybiB0aGlzLmhvdmVyLmNhbkRlY3JlYXNlVmVyYm9zaXR5ID8/IGZhbHNlO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTWFya2Rvd25Ib3ZlclBhcnRpY2lwYW50IGltcGxlbWVudHMgSUVkaXRvckhvdmVyUGFydGljaXBhbnQ8TWFya2Rvd25Ib3Zlcj4ge1xuXG5cdHB1YmxpYyByZWFkb25seSBob3Zlck9yZGluYWw6IG51bWJlciA9IDM7XG5cblx0cHJpdmF0ZSBfcmVuZGVyZWRIb3ZlclBhcnRzOiBNYXJrZG93blJlbmRlcmVkSG92ZXJQYXJ0cyB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9vcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9rZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdCkgeyB9XG5cblx0cHVibGljIGNyZWF0ZUxvYWRpbmdNZXNzYWdlKGFuY2hvcjogSG92ZXJBbmNob3IpOiBNYXJrZG93bkhvdmVyIHwgbnVsbCB7XG5cdFx0cmV0dXJuIG5ldyBNYXJrZG93bkhvdmVyKHRoaXMsIGFuY2hvci5yYW5nZSwgW25ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZFRleHQobmxzLmxvY2FsaXplKCdtb2Rlc0NvbnRlbnRIb3Zlci5sb2FkaW5nJywgXCJMb2FkaW5nLi4uXCIpKV0sIGZhbHNlLCAyMDAwKTtcblx0fVxuXG5cdHB1YmxpYyBjb21wdXRlU3luYyhhbmNob3I6IEhvdmVyQW5jaG9yLCBsaW5lRGVjb3JhdGlvbnM6IElNb2RlbERlY29yYXRpb25bXSk6IE1hcmtkb3duSG92ZXJbXSB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSB8fCBhbmNob3IudHlwZSAhPT0gSG92ZXJBbmNob3JUeXBlLlJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRjb25zdCBsaW5lTnVtYmVyID0gYW5jaG9yLnJhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0XHRjb25zdCBtYXhDb2x1bW4gPSBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IHJlc3VsdDogTWFya2Rvd25Ib3ZlcltdID0gW107XG5cblx0XHRsZXQgaW5kZXggPSAxMDAwO1xuXG5cdFx0Y29uc3QgbGluZUxlbmd0aCA9IG1vZGVsLmdldExpbmVMZW5ndGgobGluZU51bWJlcik7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9IG1vZGVsLmdldExhbmd1YWdlSWRBdFBvc2l0aW9uKGFuY2hvci5yYW5nZS5zdGFydExpbmVOdW1iZXIsIGFuY2hvci5yYW5nZS5zdGFydENvbHVtbik7XG5cdFx0Y29uc3Qgc3RvcFJlbmRlcmluZ0xpbmVBZnRlciA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnN0b3BSZW5kZXJpbmdMaW5lQWZ0ZXIpO1xuXHRcdGNvbnN0IG1heFRva2VuaXphdGlvbkxpbmVMZW5ndGggPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KCdlZGl0b3IubWF4VG9rZW5pemF0aW9uTGluZUxlbmd0aCcsIHtcblx0XHRcdG92ZXJyaWRlSWRlbnRpZmllcjogbGFuZ3VhZ2VJZFxuXHRcdH0pO1xuXHRcdGxldCBzdG9wUmVuZGVyaW5nTWVzc2FnZSA9IGZhbHNlO1xuXHRcdGlmIChzdG9wUmVuZGVyaW5nTGluZUFmdGVyID49IDAgJiYgbGluZUxlbmd0aCA+IHN0b3BSZW5kZXJpbmdMaW5lQWZ0ZXIgJiYgYW5jaG9yLnJhbmdlLnN0YXJ0Q29sdW1uID49IHN0b3BSZW5kZXJpbmdMaW5lQWZ0ZXIpIHtcblx0XHRcdHN0b3BSZW5kZXJpbmdNZXNzYWdlID0gdHJ1ZTtcblx0XHRcdHJlc3VsdC5wdXNoKG5ldyBNYXJrZG93bkhvdmVyKHRoaXMsIGFuY2hvci5yYW5nZSwgW3tcblx0XHRcdFx0dmFsdWU6IG5scy5sb2NhbGl6ZSgnc3RvcHBlZCByZW5kZXJpbmcnLCBcIlJlbmRlcmluZyBwYXVzZWQgZm9yIGxvbmcgbGluZSBmb3IgcGVyZm9ybWFuY2UgcmVhc29ucy4gVGhpcyBjYW4gYmUgY29uZmlndXJlZCB2aWEgYGVkaXRvci5zdG9wUmVuZGVyaW5nTGluZUFmdGVyYC5cIilcblx0XHRcdH1dLCBmYWxzZSwgaW5kZXgrKykpO1xuXHRcdH1cblx0XHRpZiAoIXN0b3BSZW5kZXJpbmdNZXNzYWdlICYmIHR5cGVvZiBtYXhUb2tlbml6YXRpb25MaW5lTGVuZ3RoID09PSAnbnVtYmVyJyAmJiBsaW5lTGVuZ3RoID49IG1heFRva2VuaXphdGlvbkxpbmVMZW5ndGgpIHtcblx0XHRcdHJlc3VsdC5wdXNoKG5ldyBNYXJrZG93bkhvdmVyKHRoaXMsIGFuY2hvci5yYW5nZSwgW3tcblx0XHRcdFx0dmFsdWU6IG5scy5sb2NhbGl6ZSgndG9vIG1hbnkgY2hhcmFjdGVycycsIFwiVG9rZW5pemF0aW9uIGlzIHNraXBwZWQgZm9yIGxvbmcgbGluZXMgZm9yIHBlcmZvcm1hbmNlIHJlYXNvbnMuIFRoaXMgY2FuIGJlIGNvbmZpZ3VyZWQgdmlhIGBlZGl0b3IubWF4VG9rZW5pemF0aW9uTGluZUxlbmd0aGAuXCIpXG5cdFx0XHR9XSwgZmFsc2UsIGluZGV4KyspKTtcblx0XHR9XG5cblx0XHRsZXQgaXNCZWZvcmVDb250ZW50ID0gZmFsc2U7XG5cblx0XHRmb3IgKGNvbnN0IGQgb2YgbGluZURlY29yYXRpb25zKSB7XG5cdFx0XHRjb25zdCBzdGFydENvbHVtbiA9IChkLnJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gbGluZU51bWJlcikgPyBkLnJhbmdlLnN0YXJ0Q29sdW1uIDogMTtcblx0XHRcdGNvbnN0IGVuZENvbHVtbiA9IChkLnJhbmdlLmVuZExpbmVOdW1iZXIgPT09IGxpbmVOdW1iZXIpID8gZC5yYW5nZS5lbmRDb2x1bW4gOiBtYXhDb2x1bW47XG5cblx0XHRcdGNvbnN0IGhvdmVyTWVzc2FnZSA9IGQub3B0aW9ucy5ob3Zlck1lc3NhZ2U7XG5cdFx0XHRpZiAoIWhvdmVyTWVzc2FnZSB8fCBpc0VtcHR5TWFya2Rvd25TdHJpbmcoaG92ZXJNZXNzYWdlKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGQub3B0aW9ucy5iZWZvcmVDb250ZW50Q2xhc3NOYW1lKSB7XG5cdFx0XHRcdGlzQmVmb3JlQ29udGVudCA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJhbmdlID0gbmV3IFJhbmdlKGFuY2hvci5yYW5nZS5zdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCBhbmNob3IucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBlbmRDb2x1bW4pO1xuXHRcdFx0cmVzdWx0LnB1c2gobmV3IE1hcmtkb3duSG92ZXIodGhpcywgcmFuZ2UsIGFzQXJyYXkoaG92ZXJNZXNzYWdlKSwgaXNCZWZvcmVDb250ZW50LCBpbmRleCsrKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBjb21wdXRlQXN5bmMoYW5jaG9yOiBIb3ZlckFuY2hvciwgbGluZURlY29yYXRpb25zOiBJTW9kZWxEZWNvcmF0aW9uW10sIHNvdXJjZTogSG92ZXJTdGFydFNvdXJjZSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogQXN5bmNJdGVyYWJsZU9iamVjdDxNYXJrZG93bkhvdmVyPiB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSB8fCBhbmNob3IudHlwZSAhPT0gSG92ZXJBbmNob3JUeXBlLlJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gQXN5bmNJdGVyYWJsZU9iamVjdC5FTVBUWTtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXG5cdFx0Y29uc3QgaG92ZXJQcm92aWRlclJlZ2lzdHJ5ID0gdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuaG92ZXJQcm92aWRlcjtcblx0XHRpZiAoIWhvdmVyUHJvdmlkZXJSZWdpc3RyeS5oYXMobW9kZWwpKSB7XG5cdFx0XHRyZXR1cm4gQXN5bmNJdGVyYWJsZU9iamVjdC5FTVBUWTtcblx0XHR9XG5cdFx0Y29uc3QgbWFya2Rvd25Ib3ZlcnMgPSB0aGlzLl9nZXRNYXJrZG93bkhvdmVycyhob3ZlclByb3ZpZGVyUmVnaXN0cnksIG1vZGVsLCBhbmNob3IsIHRva2VuKTtcblx0XHRyZXR1cm4gbWFya2Rvd25Ib3ZlcnM7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRNYXJrZG93bkhvdmVycyhob3ZlclByb3ZpZGVyUmVnaXN0cnk6IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5PEhvdmVyUHJvdmlkZXI+LCBtb2RlbDogSVRleHRNb2RlbCwgYW5jaG9yOiBIb3ZlclJhbmdlQW5jaG9yLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBBc3luY0l0ZXJhYmxlT2JqZWN0PE1hcmtkb3duSG92ZXI+IHtcblx0XHRjb25zdCBwb3NpdGlvbiA9IGFuY2hvci5yYW5nZS5nZXRTdGFydFBvc2l0aW9uKCk7XG5cdFx0Y29uc3QgaG92ZXJQcm92aWRlclJlc3VsdHMgPSBnZXRIb3ZlclByb3ZpZGVyUmVzdWx0c0FzQXN5bmNJdGVyYWJsZShob3ZlclByb3ZpZGVyUmVnaXN0cnksIG1vZGVsLCBwb3NpdGlvbiwgdG9rZW4pO1xuXHRcdGNvbnN0IG1hcmtkb3duSG92ZXJzID0gaG92ZXJQcm92aWRlclJlc3VsdHMuZmlsdGVyKGl0ZW0gPT4gIWlzRW1wdHlNYXJrZG93blN0cmluZyhpdGVtLmhvdmVyLmNvbnRlbnRzKSlcblx0XHRcdC5tYXAoaXRlbSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJhbmdlID0gaXRlbS5ob3Zlci5yYW5nZSA/IFJhbmdlLmxpZnQoaXRlbS5ob3Zlci5yYW5nZSkgOiBhbmNob3IucmFuZ2U7XG5cdFx0XHRcdGNvbnN0IGhvdmVyU291cmNlID0gbmV3IEhvdmVyU291cmNlKGl0ZW0uaG92ZXIsIGl0ZW0ucHJvdmlkZXIsIHBvc2l0aW9uKTtcblx0XHRcdFx0cmV0dXJuIG5ldyBNYXJrZG93bkhvdmVyKHRoaXMsIHJhbmdlLCBpdGVtLmhvdmVyLmNvbnRlbnRzLCBmYWxzZSwgaXRlbS5vcmRpbmFsLCBob3ZlclNvdXJjZSk7XG5cdFx0XHR9KTtcblx0XHRyZXR1cm4gbWFya2Rvd25Ib3ZlcnM7XG5cdH1cblxuXHRwdWJsaWMgcmVuZGVySG92ZXJQYXJ0cyhjb250ZXh0OiBJRWRpdG9ySG92ZXJSZW5kZXJDb250ZXh0LCBob3ZlclBhcnRzOiBNYXJrZG93bkhvdmVyW10pOiBJUmVuZGVyZWRIb3ZlclBhcnRzPE1hcmtkb3duSG92ZXI+IHtcblx0XHR0aGlzLl9yZW5kZXJlZEhvdmVyUGFydHMgPSBuZXcgTWFya2Rvd25SZW5kZXJlZEhvdmVyUGFydHMoXG5cdFx0XHRob3ZlclBhcnRzLFxuXHRcdFx0Y29udGV4dC5mcmFnbWVudCxcblx0XHRcdHRoaXMsXG5cdFx0XHR0aGlzLl9lZGl0b3IsXG5cdFx0XHR0aGlzLl9sYW5ndWFnZVNlcnZpY2UsXG5cdFx0XHR0aGlzLl9vcGVuZXJTZXJ2aWNlLFxuXHRcdFx0dGhpcy5fY29tbWFuZFNlcnZpY2UsXG5cdFx0XHR0aGlzLl9rZXliaW5kaW5nU2VydmljZSxcblx0XHRcdHRoaXMuX2hvdmVyU2VydmljZSxcblx0XHRcdHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdFx0Y29udGV4dC5vbkNvbnRlbnRzQ2hhbmdlZFxuXHRcdCk7XG5cdFx0cmV0dXJuIHRoaXMuX3JlbmRlcmVkSG92ZXJQYXJ0cztcblx0fVxuXG5cdHB1YmxpYyBoYW5kbGVTY3JvbGwoZTogU2Nyb2xsRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLl9yZW5kZXJlZEhvdmVyUGFydHM/LmhhbmRsZVNjcm9sbChlKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRBY2Nlc3NpYmxlQ29udGVudChob3ZlclBhcnQ6IE1hcmtkb3duSG92ZXIpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9yZW5kZXJlZEhvdmVyUGFydHM/LmdldEFjY2Vzc2libGVDb250ZW50KGhvdmVyUGFydCkgPz8gJyc7XG5cdH1cblxuXHRwdWJsaWMgZG9lc01hcmtkb3duSG92ZXJBdEluZGV4U3VwcG9ydFZlcmJvc2l0eUFjdGlvbihpbmRleDogbnVtYmVyLCBhY3Rpb246IEhvdmVyVmVyYm9zaXR5QWN0aW9uKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlbmRlcmVkSG92ZXJQYXJ0cz8uZG9lc01hcmtkb3duSG92ZXJBdEluZGV4U3VwcG9ydFZlcmJvc2l0eUFjdGlvbihpbmRleCwgYWN0aW9uKSA/PyBmYWxzZTtcblx0fVxuXG5cdHB1YmxpYyB1cGRhdGVNYXJrZG93bkhvdmVyVmVyYm9zaXR5TGV2ZWwoYWN0aW9uOiBIb3ZlclZlcmJvc2l0eUFjdGlvbiwgaW5kZXg6IG51bWJlcik6IFByb21pc2U8eyBob3ZlclBhcnQ6IE1hcmtkb3duSG92ZXI7IGhvdmVyRWxlbWVudDogSFRNTEVsZW1lbnQgfSB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fcmVuZGVyZWRIb3ZlclBhcnRzPy51cGRhdGVNYXJrZG93bkhvdmVyUGFydFZlcmJvc2l0eUxldmVsKGFjdGlvbiwgaW5kZXgpKTtcblx0fVxufVxuXG5jbGFzcyBSZW5kZXJlZE1hcmtkb3duSG92ZXJQYXJ0IGltcGxlbWVudHMgSVJlbmRlcmVkSG92ZXJQYXJ0PE1hcmtkb3duSG92ZXI+IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgaG92ZXJQYXJ0OiBNYXJrZG93bkhvdmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBob3ZlckVsZW1lbnQ6IEhUTUxFbGVtZW50LFxuXHRcdHB1YmxpYyByZWFkb25seSBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlLFxuXHRcdHB1YmxpYyByZWFkb25seSBhY3Rpb25zQ29udGFpbmVyPzogSFRNTEVsZW1lbnRcblx0KSB7IH1cblxuXHRnZXQgaG92ZXJBY2Nlc3NpYmxlQ29udGVudCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmhvdmVyRWxlbWVudC5pbm5lclRleHQudHJpbSgpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBNYXJrZG93blJlbmRlcmVkSG92ZXJQYXJ0cyBpbXBsZW1lbnRzIElSZW5kZXJlZEhvdmVyUGFydHM8TWFya2Rvd25Ib3Zlcj4ge1xuXG5cdHB1YmxpYyByZW5kZXJlZEhvdmVyUGFydHM6IFJlbmRlcmVkTWFya2Rvd25Ib3ZlclBhcnRbXTtcblxuXHRwcml2YXRlIF9vbmdvaW5nSG92ZXJPcGVyYXRpb25zOiBNYXA8SG92ZXJQcm92aWRlciwgeyB2ZXJib3NpdHlEZWx0YTogbnVtYmVyOyB0b2tlblNvdXJjZTogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfT4gPSBuZXcgTWFwKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0aG92ZXJQYXJ0czogTWFya2Rvd25Ib3ZlcltdLFxuXHRcdGhvdmVyUGFydHNDb250YWluZXI6IERvY3VtZW50RnJhZ21lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaG92ZXJQYXJ0aWNpcGFudDogTWFya2Rvd25Ib3ZlclBhcnRpY2lwYW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfa2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9ob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9vbkZpbmlzaGVkUmVuZGVyaW5nOiAoKSA9PiB2b2lkLFxuXHQpIHtcblx0XHR0aGlzLnJlbmRlcmVkSG92ZXJQYXJ0cyA9IHRoaXMuX3JlbmRlckhvdmVyUGFydHMoaG92ZXJQYXJ0cywgaG92ZXJQYXJ0c0NvbnRhaW5lciwgdGhpcy5fb25GaW5pc2hlZFJlbmRlcmluZyk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLnJlbmRlcmVkSG92ZXJQYXJ0cy5mb3JFYWNoKHJlbmRlcmVkSG92ZXJQYXJ0ID0+IHtcblx0XHRcdFx0cmVuZGVyZWRIb3ZlclBhcnQuZGlzcG9zZSgpO1xuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLl9vbmdvaW5nSG92ZXJPcGVyYXRpb25zLmZvckVhY2gob3BlcmF0aW9uID0+IHtcblx0XHRcdFx0b3BlcmF0aW9uLnRva2VuU291cmNlLmRpc3Bvc2UodHJ1ZSk7XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZW5kZXJIb3ZlclBhcnRzKFxuXHRcdGhvdmVyUGFydHM6IE1hcmtkb3duSG92ZXJbXSxcblx0XHRob3ZlclBhcnRzQ29udGFpbmVyOiBEb2N1bWVudEZyYWdtZW50LFxuXHRcdG9uRmluaXNoZWRSZW5kZXJpbmc6ICgpID0+IHZvaWQsXG5cdCk6IFJlbmRlcmVkTWFya2Rvd25Ib3ZlclBhcnRbXSB7XG5cdFx0aG92ZXJQYXJ0cy5zb3J0KGNvbXBhcmVCeShob3ZlciA9PiBob3Zlci5vcmRpbmFsLCBudW1iZXJDb21wYXJhdG9yKSk7XG5cdFx0cmV0dXJuIGhvdmVyUGFydHMubWFwKGhvdmVyUGFydCA9PiB7XG5cdFx0XHRjb25zdCByZW5kZXJlZEhvdmVyUGFydCA9IHRoaXMuX3JlbmRlckhvdmVyUGFydChob3ZlclBhcnQsIG9uRmluaXNoZWRSZW5kZXJpbmcpO1xuXHRcdFx0aG92ZXJQYXJ0c0NvbnRhaW5lci5hcHBlbmRDaGlsZChyZW5kZXJlZEhvdmVyUGFydC5ob3ZlckVsZW1lbnQpO1xuXHRcdFx0cmV0dXJuIHJlbmRlcmVkSG92ZXJQYXJ0O1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVySG92ZXJQYXJ0KFxuXHRcdGhvdmVyUGFydDogTWFya2Rvd25Ib3Zlcixcblx0XHRvbkZpbmlzaGVkUmVuZGVyaW5nOiAoKSA9PiB2b2lkXG5cdCk6IFJlbmRlcmVkTWFya2Rvd25Ib3ZlclBhcnQge1xuXG5cdFx0Y29uc3QgcmVuZGVyZWRNYXJrZG93blBhcnQgPSB0aGlzLl9yZW5kZXJNYXJrZG93bkhvdmVyKGhvdmVyUGFydCwgb25GaW5pc2hlZFJlbmRlcmluZyk7XG5cdFx0Y29uc3QgcmVuZGVyZWRNYXJrZG93bkVsZW1lbnQgPSByZW5kZXJlZE1hcmtkb3duUGFydC5ob3ZlckVsZW1lbnQ7XG5cdFx0Y29uc3QgaG92ZXJTb3VyY2UgPSBob3ZlclBhcnQuc291cmNlO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZW5kZXJlZE1hcmtkb3duUGFydCk7XG5cblx0XHRpZiAoIWhvdmVyU291cmNlKSB7XG5cdFx0XHRyZXR1cm4gbmV3IFJlbmRlcmVkTWFya2Rvd25Ib3ZlclBhcnQoaG92ZXJQYXJ0LCByZW5kZXJlZE1hcmtkb3duRWxlbWVudCwgZGlzcG9zYWJsZXMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNhbkluY3JlYXNlVmVyYm9zaXR5ID0gaG92ZXJTb3VyY2Uuc3VwcG9ydHNWZXJib3NpdHlBY3Rpb24oSG92ZXJWZXJib3NpdHlBY3Rpb24uSW5jcmVhc2UpO1xuXHRcdGNvbnN0IGNhbkRlY3JlYXNlVmVyYm9zaXR5ID0gaG92ZXJTb3VyY2Uuc3VwcG9ydHNWZXJib3NpdHlBY3Rpb24oSG92ZXJWZXJib3NpdHlBY3Rpb24uRGVjcmVhc2UpO1xuXG5cdFx0aWYgKCFjYW5JbmNyZWFzZVZlcmJvc2l0eSAmJiAhY2FuRGVjcmVhc2VWZXJib3NpdHkpIHtcblx0XHRcdHJldHVybiBuZXcgUmVuZGVyZWRNYXJrZG93bkhvdmVyUGFydChob3ZlclBhcnQsIHJlbmRlcmVkTWFya2Rvd25FbGVtZW50LCBkaXNwb3NhYmxlcyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aW9uc0NvbnRhaW5lciA9ICQoJ2Rpdi52ZXJib3NpdHktYWN0aW9ucycpO1xuXHRcdHJlbmRlcmVkTWFya2Rvd25FbGVtZW50LnByZXBlbmQoYWN0aW9uc0NvbnRhaW5lcik7XG5cdFx0Y29uc3QgYWN0aW9uc0NvbnRhaW5lcklubmVyID0gJCgnZGl2LnZlcmJvc2l0eS1hY3Rpb25zLWlubmVyJyk7XG5cdFx0YWN0aW9uc0NvbnRhaW5lci5hcHBlbmQoYWN0aW9uc0NvbnRhaW5lcklubmVyKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5fcmVuZGVySG92ZXJFeHBhbnNpb25BY3Rpb24oYWN0aW9uc0NvbnRhaW5lcklubmVyLCBIb3ZlclZlcmJvc2l0eUFjdGlvbi5JbmNyZWFzZSwgY2FuSW5jcmVhc2VWZXJib3NpdHkpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5fcmVuZGVySG92ZXJFeHBhbnNpb25BY3Rpb24oYWN0aW9uc0NvbnRhaW5lcklubmVyLCBIb3ZlclZlcmJvc2l0eUFjdGlvbi5EZWNyZWFzZSwgY2FuRGVjcmVhc2VWZXJib3NpdHkpKTtcblx0XHRyZXR1cm4gbmV3IFJlbmRlcmVkTWFya2Rvd25Ib3ZlclBhcnQoaG92ZXJQYXJ0LCByZW5kZXJlZE1hcmtkb3duRWxlbWVudCwgZGlzcG9zYWJsZXMsIGFjdGlvbnNDb250YWluZXJJbm5lcik7XG5cdH1cblxuXHRwcml2YXRlIF9yZW5kZXJNYXJrZG93bkhvdmVyKFxuXHRcdG1hcmtkb3duSG92ZXI6IE1hcmtkb3duSG92ZXIsXG5cdFx0b25GaW5pc2hlZFJlbmRlcmluZzogKCkgPT4gdm9pZFxuXHQpOiBJUmVuZGVyZWRIb3ZlclBhcnQ8TWFya2Rvd25Ib3Zlcj4ge1xuXHRcdGNvbnN0IHJlbmRlcmVkTWFya2Rvd25Ib3ZlciA9IHJlbmRlck1hcmtkb3duSW5Db250YWluZXIoXG5cdFx0XHR0aGlzLl9lZGl0b3IsXG5cdFx0XHRtYXJrZG93bkhvdmVyLFxuXHRcdFx0dGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdFx0dGhpcy5fb3BlbmVyU2VydmljZSxcblx0XHRcdG9uRmluaXNoZWRSZW5kZXJpbmcsXG5cdFx0KTtcblx0XHRyZXR1cm4gcmVuZGVyZWRNYXJrZG93bkhvdmVyO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVySG92ZXJFeHBhbnNpb25BY3Rpb24oY29udGFpbmVyOiBIVE1MRWxlbWVudCwgYWN0aW9uOiBIb3ZlclZlcmJvc2l0eUFjdGlvbiwgYWN0aW9uRW5hYmxlZDogYm9vbGVhbik6IERpc3Bvc2FibGVTdG9yZSB7XG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgaXNBY3Rpb25JbmNyZWFzZSA9IGFjdGlvbiA9PT0gSG92ZXJWZXJib3NpdHlBY3Rpb24uSW5jcmVhc2U7XG5cdFx0Y29uc3QgYWN0aW9uRWxlbWVudCA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGlzQWN0aW9uSW5jcmVhc2UgPyBpbmNyZWFzZUhvdmVyVmVyYm9zaXR5SWNvbiA6IGRlY3JlYXNlSG92ZXJWZXJib3NpdHlJY29uKSkpO1xuXHRcdGFjdGlvbkVsZW1lbnQudGFiSW5kZXggPSAwO1xuXHRcdGNvbnN0IGhvdmVyRGVsZWdhdGUgPSBuZXcgV29ya2JlbmNoSG92ZXJEZWxlZ2F0ZSgnbW91c2UnLCB1bmRlZmluZWQsIHsgdGFyZ2V0OiBjb250YWluZXIsIHBvc2l0aW9uOiB7IGhvdmVyUG9zaXRpb246IEhvdmVyUG9zaXRpb24uTEVGVCB9IH0sIHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLl9ob3ZlclNlcnZpY2UpO1xuXHRcdHN0b3JlLmFkZCh0aGlzLl9ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoaG92ZXJEZWxlZ2F0ZSwgYWN0aW9uRWxlbWVudCwgbGFiZWxGb3JIb3ZlclZlcmJvc2l0eUFjdGlvbih0aGlzLl9rZXliaW5kaW5nU2VydmljZSwgYWN0aW9uKSkpO1xuXHRcdGlmICghYWN0aW9uRW5hYmxlZCkge1xuXHRcdFx0YWN0aW9uRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdkaXNhYmxlZCcpO1xuXHRcdFx0cmV0dXJuIHN0b3JlO1xuXHRcdH1cblx0XHRhY3Rpb25FbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2VuYWJsZWQnKTtcblx0XHRjb25zdCBhY3Rpb25GdW5jdGlvbiA9ICgpID0+IHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGFjdGlvbiA9PT0gSG92ZXJWZXJib3NpdHlBY3Rpb24uSW5jcmVhc2UgPyBJTkNSRUFTRV9IT1ZFUl9WRVJCT1NJVFlfQUNUSU9OX0lEIDogREVDUkVBU0VfSE9WRVJfVkVSQk9TSVRZX0FDVElPTl9JRCwgeyBmb2N1czogdHJ1ZSB9KTtcblx0XHRzdG9yZS5hZGQobmV3IENsaWNrQWN0aW9uKGFjdGlvbkVsZW1lbnQsIGFjdGlvbkZ1bmN0aW9uKSk7XG5cdFx0c3RvcmUuYWRkKG5ldyBLZXlEb3duQWN0aW9uKGFjdGlvbkVsZW1lbnQsIGFjdGlvbkZ1bmN0aW9uLCBbS2V5Q29kZS5FbnRlciwgS2V5Q29kZS5TcGFjZV0pKTtcblx0XHRyZXR1cm4gc3RvcmU7XG5cdH1cblxuXHRwdWJsaWMgaGFuZGxlU2Nyb2xsKGU6IFNjcm9sbEV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5yZW5kZXJlZEhvdmVyUGFydHMuZm9yRWFjaChyZW5kZXJlZEhvdmVyUGFydCA9PiB7XG5cdFx0XHRjb25zdCBhY3Rpb25zQ29udGFpbmVySW5uZXIgPSByZW5kZXJlZEhvdmVyUGFydC5hY3Rpb25zQ29udGFpbmVyO1xuXHRcdFx0aWYgKCFhY3Rpb25zQ29udGFpbmVySW5uZXIpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaG92ZXJFbGVtZW50ID0gcmVuZGVyZWRIb3ZlclBhcnQuaG92ZXJFbGVtZW50O1xuXHRcdFx0Y29uc3QgdG9wT2ZIb3ZlclNjcm9sbFBvc2l0aW9uID0gZS5zY3JvbGxUb3A7XG5cdFx0XHRjb25zdCBib3R0b21PZkhvdmVyU2Nyb2xsUG9zaXRpb24gPSB0b3BPZkhvdmVyU2Nyb2xsUG9zaXRpb24gKyBlLmhlaWdodDtcblx0XHRcdGNvbnN0IHRvcE9mUmVuZGVyZWRQYXJ0ID0gaG92ZXJFbGVtZW50Lm9mZnNldFRvcDtcblx0XHRcdGNvbnN0IGhvdmVyRWxlbWVudEhlaWdodCA9IGhvdmVyRWxlbWVudC5jbGllbnRIZWlnaHQ7XG5cdFx0XHRjb25zdCBib3R0b21PZlJlbmRlcmVkUGFydCA9IHRvcE9mUmVuZGVyZWRQYXJ0ICsgaG92ZXJFbGVtZW50SGVpZ2h0O1xuXHRcdFx0Y29uc3QgaWNvbnNIZWlnaHQgPSAyMjtcblx0XHRcdGxldCB0b3A6IG51bWJlcjtcblx0XHRcdGlmIChib3R0b21PZlJlbmRlcmVkUGFydCA8PSBib3R0b21PZkhvdmVyU2Nyb2xsUG9zaXRpb24gfHwgdG9wT2ZSZW5kZXJlZFBhcnQgPj0gYm90dG9tT2ZIb3ZlclNjcm9sbFBvc2l0aW9uKSB7XG5cdFx0XHRcdHRvcCA9IGhvdmVyRWxlbWVudEhlaWdodCAtIGljb25zSGVpZ2h0O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dG9wID0gYm90dG9tT2ZIb3ZlclNjcm9sbFBvc2l0aW9uIC0gdG9wT2ZSZW5kZXJlZFBhcnQgLSBpY29uc0hlaWdodDtcblx0XHRcdH1cblx0XHRcdGFjdGlvbnNDb250YWluZXJJbm5lci5zdHlsZS50b3AgPSBgJHt0b3B9cHhgO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHVwZGF0ZU1hcmtkb3duSG92ZXJQYXJ0VmVyYm9zaXR5TGV2ZWwoYWN0aW9uOiBIb3ZlclZlcmJvc2l0eUFjdGlvbiwgaW5kZXg6IG51bWJlcik6IFByb21pc2U8eyBob3ZlclBhcnQ6IE1hcmtkb3duSG92ZXI7IGhvdmVyRWxlbWVudDogSFRNTEVsZW1lbnQgfSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgaG92ZXJSZW5kZXJlZFBhcnQgPSB0aGlzLl9nZXRSZW5kZXJlZEhvdmVyUGFydEF0SW5kZXgoaW5kZXgpO1xuXHRcdGNvbnN0IGhvdmVyU291cmNlID0gaG92ZXJSZW5kZXJlZFBhcnQ/LmhvdmVyUGFydC5zb3VyY2U7XG5cdFx0aWYgKCFob3ZlclJlbmRlcmVkUGFydCB8fCAhaG92ZXJTb3VyY2U/LnN1cHBvcnRzVmVyYm9zaXR5QWN0aW9uKGFjdGlvbikpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IG5ld0hvdmVyID0gYXdhaXQgdGhpcy5fZmV0Y2hIb3Zlcihob3ZlclNvdXJjZSwgbW9kZWwsIGFjdGlvbik7XG5cdFx0aWYgKCFuZXdIb3Zlcikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgbmV3SG92ZXJTb3VyY2UgPSBuZXcgSG92ZXJTb3VyY2UobmV3SG92ZXIsIGhvdmVyU291cmNlLmhvdmVyUHJvdmlkZXIsIGhvdmVyU291cmNlLmhvdmVyUG9zaXRpb24pO1xuXHRcdGNvbnN0IGluaXRpYWxIb3ZlclBhcnQgPSBob3ZlclJlbmRlcmVkUGFydC5ob3ZlclBhcnQ7XG5cdFx0Y29uc3QgbmV3SG92ZXJQYXJ0ID0gbmV3IE1hcmtkb3duSG92ZXIoXG5cdFx0XHR0aGlzLl9ob3ZlclBhcnRpY2lwYW50LFxuXHRcdFx0aW5pdGlhbEhvdmVyUGFydC5yYW5nZSxcblx0XHRcdG5ld0hvdmVyLmNvbnRlbnRzLFxuXHRcdFx0aW5pdGlhbEhvdmVyUGFydC5pc0JlZm9yZUNvbnRlbnQsXG5cdFx0XHRpbml0aWFsSG92ZXJQYXJ0Lm9yZGluYWwsXG5cdFx0XHRuZXdIb3ZlclNvdXJjZVxuXHRcdCk7XG5cdFx0Y29uc3QgbmV3SG92ZXJSZW5kZXJlZFBhcnQgPSB0aGlzLl91cGRhdGVSZW5kZXJlZEhvdmVyUGFydChpbmRleCwgbmV3SG92ZXJQYXJ0KTtcblx0XHRpZiAoIW5ld0hvdmVyUmVuZGVyZWRQYXJ0KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0aG92ZXJQYXJ0OiBuZXdIb3ZlclBhcnQsXG5cdFx0XHRob3ZlckVsZW1lbnQ6IG5ld0hvdmVyUmVuZGVyZWRQYXJ0LmhvdmVyRWxlbWVudFxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgZ2V0QWNjZXNzaWJsZUNvbnRlbnQoaG92ZXJQYXJ0OiBNYXJrZG93bkhvdmVyKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZW5kZXJlZEhvdmVyUGFydEluZGV4ID0gdGhpcy5yZW5kZXJlZEhvdmVyUGFydHMuZmluZEluZGV4KHJlbmRlcmVkSG92ZXJQYXJ0ID0+IHJlbmRlcmVkSG92ZXJQYXJ0LmhvdmVyUGFydCA9PT0gaG92ZXJQYXJ0KTtcblx0XHRpZiAocmVuZGVyZWRIb3ZlclBhcnRJbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHJlbmRlcmVkSG92ZXJQYXJ0ID0gdGhpcy5fZ2V0UmVuZGVyZWRIb3ZlclBhcnRBdEluZGV4KHJlbmRlcmVkSG92ZXJQYXJ0SW5kZXgpO1xuXHRcdGlmICghcmVuZGVyZWRIb3ZlclBhcnQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IGhvdmVyRWxlbWVudElubmVyVGV4dCA9IHJlbmRlcmVkSG92ZXJQYXJ0LmhvdmVyRWxlbWVudC5pbm5lclRleHQ7XG5cdFx0Y29uc3QgYWNjZXNzaWJsZUNvbnRlbnQgPSBob3ZlckVsZW1lbnRJbm5lclRleHQucmVwbGFjZSgvW15cXFNcXG5cXHJdKy9ndSwgJyAnKTtcblx0XHRyZXR1cm4gYWNjZXNzaWJsZUNvbnRlbnQ7XG5cdH1cblxuXHRwdWJsaWMgZG9lc01hcmtkb3duSG92ZXJBdEluZGV4U3VwcG9ydFZlcmJvc2l0eUFjdGlvbihpbmRleDogbnVtYmVyLCBhY3Rpb246IEhvdmVyVmVyYm9zaXR5QWN0aW9uKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgaG92ZXJSZW5kZXJlZFBhcnQgPSB0aGlzLl9nZXRSZW5kZXJlZEhvdmVyUGFydEF0SW5kZXgoaW5kZXgpO1xuXHRcdGNvbnN0IGhvdmVyU291cmNlID0gaG92ZXJSZW5kZXJlZFBhcnQ/LmhvdmVyUGFydC5zb3VyY2U7XG5cdFx0aWYgKCFob3ZlclJlbmRlcmVkUGFydCB8fCAhaG92ZXJTb3VyY2U/LnN1cHBvcnRzVmVyYm9zaXR5QWN0aW9uKGFjdGlvbikpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9mZXRjaEhvdmVyKGhvdmVyU291cmNlOiBIb3ZlclNvdXJjZSwgbW9kZWw6IElUZXh0TW9kZWwsIGFjdGlvbjogSG92ZXJWZXJib3NpdHlBY3Rpb24pOiBQcm9taXNlPEhvdmVyIHwgbnVsbCB8IHVuZGVmaW5lZD4ge1xuXHRcdGxldCB2ZXJib3NpdHlEZWx0YSA9IGFjdGlvbiA9PT0gSG92ZXJWZXJib3NpdHlBY3Rpb24uSW5jcmVhc2UgPyAxIDogLTE7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBob3ZlclNvdXJjZS5ob3ZlclByb3ZpZGVyO1xuXHRcdGNvbnN0IG9uZ29pbmdIb3Zlck9wZXJhdGlvbiA9IHRoaXMuX29uZ29pbmdIb3Zlck9wZXJhdGlvbnMuZ2V0KHByb3ZpZGVyKTtcblx0XHRpZiAob25nb2luZ0hvdmVyT3BlcmF0aW9uKSB7XG5cdFx0XHRvbmdvaW5nSG92ZXJPcGVyYXRpb24udG9rZW5Tb3VyY2UuY2FuY2VsKCk7XG5cdFx0XHR2ZXJib3NpdHlEZWx0YSArPSBvbmdvaW5nSG92ZXJPcGVyYXRpb24udmVyYm9zaXR5RGVsdGE7XG5cdFx0fVxuXHRcdGNvbnN0IHRva2VuU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0dGhpcy5fb25nb2luZ0hvdmVyT3BlcmF0aW9ucy5zZXQocHJvdmlkZXIsIHsgdmVyYm9zaXR5RGVsdGEsIHRva2VuU291cmNlIH0pO1xuXHRcdGNvbnN0IGNvbnRleHQ6IEhvdmVyQ29udGV4dCA9IHsgdmVyYm9zaXR5UmVxdWVzdDogeyB2ZXJib3NpdHlEZWx0YSwgcHJldmlvdXNIb3ZlcjogaG92ZXJTb3VyY2UuaG92ZXIgfSB9O1xuXHRcdGxldCBob3ZlcjogSG92ZXIgfCBudWxsIHwgdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHRob3ZlciA9IGF3YWl0IFByb21pc2UucmVzb2x2ZShwcm92aWRlci5wcm92aWRlSG92ZXIobW9kZWwsIGhvdmVyU291cmNlLmhvdmVyUG9zaXRpb24sIHRva2VuU291cmNlLnRva2VuLCBjb250ZXh0KSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0b25VbmV4cGVjdGVkRXh0ZXJuYWxFcnJvcihlKTtcblx0XHR9XG5cdFx0dG9rZW5Tb3VyY2UuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX29uZ29pbmdIb3Zlck9wZXJhdGlvbnMuZGVsZXRlKHByb3ZpZGVyKTtcblx0XHRyZXR1cm4gaG92ZXI7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVSZW5kZXJlZEhvdmVyUGFydChpbmRleDogbnVtYmVyLCBob3ZlclBhcnQ6IE1hcmtkb3duSG92ZXIpOiBSZW5kZXJlZE1hcmtkb3duSG92ZXJQYXJ0IHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoaW5kZXggPj0gdGhpcy5yZW5kZXJlZEhvdmVyUGFydHMubGVuZ3RoIHx8IGluZGV4IDwgMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgcmVuZGVyZWRIb3ZlclBhcnQgPSB0aGlzLl9yZW5kZXJIb3ZlclBhcnQoaG92ZXJQYXJ0LCB0aGlzLl9vbkZpbmlzaGVkUmVuZGVyaW5nKTtcblx0XHRjb25zdCBjdXJyZW50UmVuZGVyZWRIb3ZlclBhcnQgPSB0aGlzLnJlbmRlcmVkSG92ZXJQYXJ0c1tpbmRleF07XG5cdFx0Y29uc3QgY3VycmVudFJlbmRlcmVkTWFya2Rvd24gPSBjdXJyZW50UmVuZGVyZWRIb3ZlclBhcnQuaG92ZXJFbGVtZW50O1xuXHRcdGNvbnN0IHJlbmRlcmVkTWFya2Rvd24gPSByZW5kZXJlZEhvdmVyUGFydC5ob3ZlckVsZW1lbnQ7XG5cdFx0Y29uc3QgcmVuZGVyZWRDaGlsZHJlbkVsZW1lbnRzID0gQXJyYXkuZnJvbShyZW5kZXJlZE1hcmtkb3duLmNoaWxkcmVuKTtcblx0XHRjdXJyZW50UmVuZGVyZWRNYXJrZG93bi5yZXBsYWNlQ2hpbGRyZW4oLi4ucmVuZGVyZWRDaGlsZHJlbkVsZW1lbnRzKTtcblx0XHRjb25zdCBuZXdSZW5kZXJlZEhvdmVyUGFydCA9IG5ldyBSZW5kZXJlZE1hcmtkb3duSG92ZXJQYXJ0KFxuXHRcdFx0aG92ZXJQYXJ0LFxuXHRcdFx0Y3VycmVudFJlbmRlcmVkTWFya2Rvd24sXG5cdFx0XHRyZW5kZXJlZEhvdmVyUGFydC5kaXNwb3NhYmxlcyxcblx0XHRcdHJlbmRlcmVkSG92ZXJQYXJ0LmFjdGlvbnNDb250YWluZXJcblx0XHQpO1xuXHRcdGN1cnJlbnRSZW5kZXJlZEhvdmVyUGFydC5kaXNwb3NlKCk7XG5cdFx0dGhpcy5yZW5kZXJlZEhvdmVyUGFydHNbaW5kZXhdID0gbmV3UmVuZGVyZWRIb3ZlclBhcnQ7XG5cdFx0cmV0dXJuIG5ld1JlbmRlcmVkSG92ZXJQYXJ0O1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0UmVuZGVyZWRIb3ZlclBhcnRBdEluZGV4KGluZGV4OiBudW1iZXIpOiBSZW5kZXJlZE1hcmtkb3duSG92ZXJQYXJ0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5yZW5kZXJlZEhvdmVyUGFydHNbaW5kZXhdO1xuXHR9XG5cblx0cHVibGljIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJNYXJrZG93bkhvdmVycyhcblx0Y29udGV4dDogSUVkaXRvckhvdmVyUmVuZGVyQ29udGV4dCxcblx0bWFya2Rvd25Ib3ZlcnM6IE1hcmtkb3duSG92ZXJbXSxcblx0ZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0bGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcbik6IElSZW5kZXJlZEhvdmVyUGFydHM8TWFya2Rvd25Ib3Zlcj4ge1xuXG5cdC8vIFNvcnQgaG92ZXIgcGFydHMgdG8ga2VlcCB0aGVtIHN0YWJsZSBzaW5jZSB0aGV5IG1pZ2h0IGNvbWUgaW4gYXN5bmMsIG91dC1vZi1vcmRlclxuXHRtYXJrZG93bkhvdmVycy5zb3J0KGNvbXBhcmVCeShob3ZlciA9PiBob3Zlci5vcmRpbmFsLCBudW1iZXJDb21wYXJhdG9yKSk7XG5cdGNvbnN0IHJlbmRlcmVkSG92ZXJQYXJ0czogSVJlbmRlcmVkSG92ZXJQYXJ0PE1hcmtkb3duSG92ZXI+W10gPSBbXTtcblx0Zm9yIChjb25zdCBtYXJrZG93bkhvdmVyIG9mIG1hcmtkb3duSG92ZXJzKSB7XG5cdFx0cmVuZGVyZWRIb3ZlclBhcnRzLnB1c2gocmVuZGVyTWFya2Rvd25JbkNvbnRhaW5lcihcblx0XHRcdGVkaXRvcixcblx0XHRcdG1hcmtkb3duSG92ZXIsXG5cdFx0XHRsYW5ndWFnZVNlcnZpY2UsXG5cdFx0XHRvcGVuZXJTZXJ2aWNlLFxuXHRcdFx0Y29udGV4dC5vbkNvbnRlbnRzQ2hhbmdlZCxcblx0XHQpKTtcblx0fVxuXHRyZXR1cm4gbmV3IFJlbmRlcmVkSG92ZXJQYXJ0cyhyZW5kZXJlZEhvdmVyUGFydHMpO1xufVxuXG5mdW5jdGlvbiByZW5kZXJNYXJrZG93bkluQ29udGFpbmVyKFxuXHRlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRtYXJrZG93bkhvdmVyOiBNYXJrZG93bkhvdmVyLFxuXHRsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRvbkZpbmlzaGVkUmVuZGVyaW5nOiAoKSA9PiB2b2lkLFxuKTogSVJlbmRlcmVkSG92ZXJQYXJ0PE1hcmtkb3duSG92ZXI+IHtcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGNvbnN0IHJlbmRlcmVkTWFya2Rvd24gPSAkKCdkaXYuaG92ZXItcm93Jyk7XG5cdGNvbnN0IHJlbmRlcmVkTWFya2Rvd25Db250ZW50cyA9ICQoJ2Rpdi5ob3Zlci1yb3ctY29udGVudHMnKTtcblx0cmVuZGVyZWRNYXJrZG93bi5hcHBlbmRDaGlsZChyZW5kZXJlZE1hcmtkb3duQ29udGVudHMpO1xuXHRjb25zdCBtYXJrZG93blN0cmluZ3MgPSBtYXJrZG93bkhvdmVyLmNvbnRlbnRzO1xuXHRmb3IgKGNvbnN0IG1hcmtkb3duU3RyaW5nIG9mIG1hcmtkb3duU3RyaW5ncykge1xuXHRcdGlmIChpc0VtcHR5TWFya2Rvd25TdHJpbmcobWFya2Rvd25TdHJpbmcpKSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cdFx0Y29uc3QgbWFya2Rvd25Ib3ZlckVsZW1lbnQgPSAkKCdkaXYubWFya2Rvd24taG92ZXInKTtcblx0XHRjb25zdCBob3ZlckNvbnRlbnRzRWxlbWVudCA9IGRvbS5hcHBlbmQobWFya2Rvd25Ib3ZlckVsZW1lbnQsICQoJ2Rpdi5ob3Zlci1jb250ZW50cycpKTtcblx0XHRjb25zdCByZW5kZXJlciA9IG5ldyBNYXJrZG93blJlbmRlcmVyKHsgZWRpdG9yIH0sIGxhbmd1YWdlU2VydmljZSwgb3BlbmVyU2VydmljZSk7XG5cblx0XHRjb25zdCByZW5kZXJlZENvbnRlbnRzID0gZGlzcG9zYWJsZXMuYWRkKHJlbmRlcmVyLnJlbmRlcihtYXJrZG93blN0cmluZywge1xuXHRcdFx0YXN5bmNSZW5kZXJDYWxsYmFjazogKCkgPT4ge1xuXHRcdFx0XHRob3ZlckNvbnRlbnRzRWxlbWVudC5jbGFzc05hbWUgPSAnaG92ZXItY29udGVudHMgY29kZS1ob3Zlci1jb250ZW50cyc7XG5cdFx0XHRcdG9uRmluaXNoZWRSZW5kZXJpbmcoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0aG92ZXJDb250ZW50c0VsZW1lbnQuYXBwZW5kQ2hpbGQocmVuZGVyZWRDb250ZW50cy5lbGVtZW50KTtcblx0XHRyZW5kZXJlZE1hcmtkb3duQ29udGVudHMuYXBwZW5kQ2hpbGQobWFya2Rvd25Ib3ZlckVsZW1lbnQpO1xuXHR9XG5cdGNvbnN0IHJlbmRlcmVkSG92ZXJQYXJ0OiBJUmVuZGVyZWRIb3ZlclBhcnQ8TWFya2Rvd25Ib3Zlcj4gPSB7XG5cdFx0aG92ZXJQYXJ0OiBtYXJrZG93bkhvdmVyLFxuXHRcdGhvdmVyRWxlbWVudDogcmVuZGVyZWRNYXJrZG93bixcblx0XHRkaXNwb3NlKCkgeyBkaXNwb3NhYmxlcy5kaXNwb3NlKCk7IH1cblx0fTtcblx0cmV0dXJuIHJlbmRlcmVkSG92ZXJQYXJ0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGFiZWxGb3JIb3ZlclZlcmJvc2l0eUFjdGlvbihrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLCBhY3Rpb246IEhvdmVyVmVyYm9zaXR5QWN0aW9uKTogc3RyaW5nIHtcblx0c3dpdGNoIChhY3Rpb24pIHtcblx0XHRjYXNlIEhvdmVyVmVyYm9zaXR5QWN0aW9uLkluY3JlYXNlOiB7XG5cdFx0XHRjb25zdCBrYiA9IGtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoSU5DUkVBU0VfSE9WRVJfVkVSQk9TSVRZX0FDVElPTl9JRCk7XG5cdFx0XHRyZXR1cm4ga2IgP1xuXHRcdFx0XHRubHMubG9jYWxpemUoJ2luY3JlYXNlVmVyYm9zaXR5V2l0aEtiJywgXCJJbmNyZWFzZSBIb3ZlciBWZXJib3NpdHkgKHswfSlcIiwga2IuZ2V0TGFiZWwoKSkgOlxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2luY3JlYXNlVmVyYm9zaXR5JywgXCJJbmNyZWFzZSBIb3ZlciBWZXJib3NpdHlcIik7XG5cdFx0fVxuXHRcdGNhc2UgSG92ZXJWZXJib3NpdHlBY3Rpb24uRGVjcmVhc2U6IHtcblx0XHRcdGNvbnN0IGtiID0ga2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhERUNSRUFTRV9IT1ZFUl9WRVJCT1NJVFlfQUNUSU9OX0lEKTtcblx0XHRcdHJldHVybiBrYiA/XG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZGVjcmVhc2VWZXJib3NpdHlXaXRoS2InLCBcIkRlY3JlYXNlIEhvdmVyIFZlcmJvc2l0eSAoezB9KVwiLCBrYi5nZXRMYWJlbCgpKSA6XG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZGVjcmVhc2VWZXJib3NpdHknLCBcIkRlY3JlYXNlIEhvdmVyIFZlcmJvc2l0eVwiKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsU0FBUyxXQUFXLHdCQUF3QjtBQUNyRCxTQUE0QiwrQkFBK0I7QUFDM0QsU0FBMEIsdUJBQXVCLHNCQUFzQjtBQUN2RSxTQUFTLGlCQUFpQixvQkFBb0I7QUFDOUMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxvQ0FBb0MsMENBQTBDO0FBR3ZGLFNBQVMsYUFBYTtBQUV0QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFzQixpQkFBNEksMEJBQTBCO0FBQzVMLFlBQVksU0FBUztBQUNyQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLG9CQUFvQjtBQUM3QixTQUE2Qyw0QkFBNEI7QUFDekUsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsYUFBYSxlQUFlLHFCQUFxQjtBQUMxRCxTQUFTLGVBQWU7QUFDeEIs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O0FBQzNDLHVCQUFtQixLQUFLO0FBQUEsTUFDdkI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLFFBQVE7QUFBQSxJQUNULENBQUM7QUFBQSxFQUNGO0FBQ0EsU0FBTyxJQUFJLG1CQUFtQixrQkFBa0I7QUFDakQ7QUFFQSxTQUFTLDBCQUNSLFFBQ0EsZUFDQSxpQkFDQSxlQUNBLHFCQUNvQztBQUNwQyxRQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFDeEMsUUFBTSxtQkFBbUIsRUFBRSxlQUFlO0FBQzFDLFFBQU0sMkJBQTJCLEVBQUUsd0JBQXdCO0FBQzNELG1CQUFpQixZQUFZLHdCQUF3QjtBQUNyRCxRQUFNLGtCQUFrQixjQUFjO0FBQ3RDLGFBQVcsa0JBQWtCLGlCQUFpQjtBQUM3QyxRQUFJLHNCQUFzQixjQUFjLEdBQUc7QUFDMUM7QUFBQSxJQUNEO0FBQ0EsVUFBTSx1QkFBdUIsRUFBRSxvQkFBb0I7QUFDbkQsVUFBTSx1QkFBdUIsSUFBSSxPQUFPLHNCQUFzQixFQUFFLG9CQUFvQixDQUFDO0FBQ3JGLFVBQU0sV0FBVyxJQUFJLGlCQUFpQixFQUFFLE9BQU8sR0FBRyxpQkFBaUIsYUFBYTtBQUVoRixVQUFNLG1CQUFtQixZQUFZLElBQUksU0FBUyxPQUFPLGdCQUFnQjtBQUFBLE1BQ3hFLHFCQUFxQixNQUFNO0FBQzFCLDZCQUFxQixZQUFZO0FBQ2pDLDRCQUFvQjtBQUFBLE1BQ3JCO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFDRix5QkFBcUIsWUFBWSxpQkFBaUIsT0FBTztBQUN6RCw2QkFBeUIsWUFBWSxvQkFBb0I7QUFBQSxFQUMxRDtBQUNBLFFBQU0sb0JBQXVEO0FBQUEsSUFDNUQsV0FBVztBQUFBLElBQ1gsY0FBYztBQUFBLElBQ2QsVUFBVTtBQUFFLGtCQUFZLFFBQVE7QUFBQSxJQUFHO0FBQUEsRUFDcEM7QUFDQSxTQUFPO0FBQ1I7QUFFTyxTQUFTLDZCQUE2QixtQkFBdUMsUUFBc0M7QUFDekgsVUFBUSxRQUFRO0FBQUEsSUFDZixLQUFLLHFCQUFxQixVQUFVO0FBQ25DLFlBQU0sS0FBSyxrQkFBa0IsaUJBQWlCLGtDQUFrQztBQUNoRixhQUFPLEtBQ04sSUFBSSxTQUFTLDJCQUEyQixrQ0FBa0MsR0FBRyxTQUFTLENBQUMsSUFDdkYsSUFBSSxTQUFTLHFCQUFxQiwwQkFBMEI7QUFBQSxJQUM5RDtBQUFBLElBQ0EsS0FBSyxxQkFBcUIsVUFBVTtBQUNuQyxZQUFNLEtBQUssa0JBQWtCLGlCQUFpQixrQ0FBa0M7QUFDaEYsYUFBTyxLQUNOLElBQUksU0FBUywyQkFBMkIsa0NBQWtDLEdBQUcsU0FBUyxDQUFDLElBQ3ZGLElBQUksU0FBUyxxQkFBcUIsMEJBQTBCO0FBQUEsSUFDOUQ7QUFBQSxFQUNEO0FBQ0Q7IiwKICAibmFtZXMiOiBbInJlbmRlcmVkSG92ZXJQYXJ0Il0KfQo=
