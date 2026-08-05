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
import { isHTMLElement, ModifierKeyEmitter } from "../../../../base/browser/dom.js";
import { isNonEmptyArray } from "../../../../base/common/arrays.js";
import { disposableTimeout, RunOnceScheduler } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { LRUCache } from "../../../../base/common/map.js";
import { assertType } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { MouseTargetType } from "../../../browser/editorBrowser.js";
import { DynamicCssRules } from "../../../browser/editorDom.js";
import { StableEditorScrollState } from "../../../browser/stableEditorScroll.js";
import { EditorOption, EDITOR_FONT_DEFAULTS } from "../../../common/config/editorOptions.js";
import { EditOperation } from "../../../common/core/editOperation.js";
import { Range } from "../../../common/core/range.js";
import * as languages from "../../../common/languages.js";
import { InjectedTextCursorStops, TrackedRangeStickiness } from "../../../common/model.js";
import { ModelDecorationInjectedTextOptions } from "../../../common/model/textModel.js";
import { ILanguageFeatureDebounceService } from "../../../common/services/languageFeatureDebounce.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { ITextModelService } from "../../../common/services/resolverService.js";
import { ClickLinkGesture } from "../../gotoSymbol/browser/link/clickLinkGesture.js";
import { InlayHintAnchor, InlayHintsFragments } from "./inlayHints.js";
import { goToDefinitionWithLocation, showGoToContextMenu } from "./inlayHintsLocations.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import * as colors from "../../../../platform/theme/common/colorRegistry.js";
import { themeColorFromId } from "../../../../platform/theme/common/themeService.js";
class InlayHintsCache {
  constructor() {
    this._entries = new LRUCache(50);
  }
  get(model) {
    const key = InlayHintsCache._key(model);
    return this._entries.get(key);
  }
  set(model, value) {
    const key = InlayHintsCache._key(model);
    this._entries.set(key, value);
  }
  static _key(model) {
    return `${model.uri.toString()}/${model.getVersionId()}`;
  }
}
const IInlayHintsCache = createDecorator("IInlayHintsCache");
registerSingleton(IInlayHintsCache, InlayHintsCache, InstantiationType.Delayed);
class RenderedInlayHintLabelPart {
  constructor(item, index) {
    this.item = item;
    this.index = index;
  }
  get part() {
    const label = this.item.hint.label;
    if (typeof label === "string") {
      return { label };
    } else {
      return label[this.index];
    }
  }
}
class ActiveInlayHintInfo {
  constructor(part, hasTriggerModifier) {
    this.part = part;
    this.hasTriggerModifier = hasTriggerModifier;
  }
}
var RenderMode = /* @__PURE__ */ ((RenderMode2) => {
  RenderMode2[RenderMode2["Normal"] = 0] = "Normal";
  RenderMode2[RenderMode2["Invisible"] = 1] = "Invisible";
  return RenderMode2;
})(RenderMode || {});
let InlayHintsController = class {
  constructor(_editor, _languageFeaturesService, _featureDebounce, _inlayHintsCache, _commandService, _notificationService, _instaService) {
    this._editor = _editor;
    this._languageFeaturesService = _languageFeaturesService;
    this._inlayHintsCache = _inlayHintsCache;
    this._commandService = _commandService;
    this._notificationService = _notificationService;
    this._instaService = _instaService;
    this._disposables = new DisposableStore();
    this._sessionDisposables = new DisposableStore();
    this._decorationsMetadata = /* @__PURE__ */ new Map();
    this._ruleFactory = new DynamicCssRules(this._editor);
    this._activeRenderMode = 0 /* Normal */;
    this._debounceInfo = _featureDebounce.for(_languageFeaturesService.inlayHintsProvider, "InlayHint", { min: 25 });
    this._disposables.add(_languageFeaturesService.inlayHintsProvider.onDidChange(() => this._update()));
    this._disposables.add(_editor.onDidChangeModel(() => this._update()));
    this._disposables.add(_editor.onDidChangeModelLanguage(() => this._update()));
    this._disposables.add(_editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.inlayHints)) {
        this._update();
      }
    }));
    this._update();
  }
  static get(editor) {
    return editor.getContribution(InlayHintsController.ID) ?? void 0;
  }
  dispose() {
    this._sessionDisposables.dispose();
    this._removeAllDecorations();
    this._disposables.dispose();
  }
  _update() {
    this._sessionDisposables.clear();
    this._removeAllDecorations();
    const options = this._editor.getOption(EditorOption.inlayHints);
    if (options.enabled === "off") {
      return;
    }
    const model = this._editor.getModel();
    if (!model || !this._languageFeaturesService.inlayHintsProvider.has(model)) {
      return;
    }
    if (options.enabled === "on") {
      this._activeRenderMode = 0 /* Normal */;
    } else {
      let defaultMode;
      let altMode;
      if (options.enabled === "onUnlessPressed") {
        defaultMode = 0 /* Normal */;
        altMode = 1 /* Invisible */;
      } else {
        defaultMode = 1 /* Invisible */;
        altMode = 0 /* Normal */;
      }
      this._activeRenderMode = defaultMode;
      this._sessionDisposables.add(ModifierKeyEmitter.getInstance().event((e) => {
        if (!this._editor.hasModel()) {
          return;
        }
        const newRenderMode = e.altKey && e.ctrlKey && !(e.shiftKey || e.metaKey) ? altMode : defaultMode;
        if (newRenderMode !== this._activeRenderMode) {
          this._activeRenderMode = newRenderMode;
          const model2 = this._editor.getModel();
          const copies = this._copyInlayHintsWithCurrentAnchor(model2);
          this._updateHintsDecorators([model2.getFullModelRange()], copies);
          scheduler.schedule(0);
        }
      }));
    }
    const cached = this._inlayHintsCache.get(model);
    if (cached) {
      this._updateHintsDecorators([model.getFullModelRange()], cached);
    }
    this._sessionDisposables.add(toDisposable(() => {
      if (!model.isDisposed()) {
        this._cacheHintsForFastRestore(model);
      }
    }));
    let cts;
    const watchedProviders = /* @__PURE__ */ new Set();
    const scheduler = new RunOnceScheduler(async () => {
      const t1 = Date.now();
      cts?.dispose(true);
      cts = new CancellationTokenSource();
      const listener = model.onWillDispose(() => cts?.cancel());
      try {
        const myToken = cts.token;
        const inlayHints = await InlayHintsFragments.create(this._languageFeaturesService.inlayHintsProvider, model, this._getHintsRanges(), myToken);
        scheduler.delay = this._debounceInfo.update(model, Date.now() - t1);
        if (myToken.isCancellationRequested) {
          inlayHints.dispose();
          return;
        }
        for (const provider of inlayHints.provider) {
          if (typeof provider.onDidChangeInlayHints === "function" && !watchedProviders.has(provider)) {
            watchedProviders.add(provider);
            this._sessionDisposables.add(provider.onDidChangeInlayHints(() => {
              if (!scheduler.isScheduled()) {
                scheduler.schedule();
              }
            }));
          }
        }
        this._sessionDisposables.add(inlayHints);
        this._updateHintsDecorators(inlayHints.ranges, inlayHints.items);
        this._cacheHintsForFastRestore(model);
      } catch (err) {
        onUnexpectedError(err);
      } finally {
        cts.dispose();
        listener.dispose();
      }
    }, this._debounceInfo.get(model));
    this._sessionDisposables.add(scheduler);
    this._sessionDisposables.add(toDisposable(() => cts?.dispose(true)));
    scheduler.schedule(0);
    this._sessionDisposables.add(this._editor.onDidScrollChange((e) => {
      if (e.scrollTopChanged || !scheduler.isScheduled()) {
        scheduler.schedule();
      }
    }));
    const cursor = this._sessionDisposables.add(new MutableDisposable());
    this._sessionDisposables.add(this._editor.onDidChangeModelContent((e) => {
      cts?.cancel();
      const delay = Math.max(scheduler.delay, 800);
      this._cursorInfo = { position: this._editor.getPosition(), notEarlierThan: Date.now() + delay };
      cursor.value = disposableTimeout(() => scheduler.schedule(0), delay);
      scheduler.schedule();
    }));
    this._sessionDisposables.add(this._editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.inlayHints)) {
        scheduler.schedule();
      }
    }));
    this._sessionDisposables.add(this._installDblClickGesture(() => scheduler.schedule(0)));
    this._sessionDisposables.add(this._installLinkGesture());
    this._sessionDisposables.add(this._installContextMenu());
  }
  _installLinkGesture() {
    const store = new DisposableStore();
    const gesture = store.add(new ClickLinkGesture(this._editor));
    const sessionStore = new DisposableStore();
    store.add(sessionStore);
    store.add(gesture.onMouseMoveOrRelevantKeyDown((e) => {
      const [mouseEvent] = e;
      const labelPart = this._getInlayHintLabelPart(mouseEvent);
      const model = this._editor.getModel();
      if (!labelPart || !model) {
        sessionStore.clear();
        return;
      }
      const cts = new CancellationTokenSource();
      sessionStore.add(toDisposable(() => cts.dispose(true)));
      labelPart.item.resolve(cts.token);
      this._activeInlayHintPart = labelPart.part.command || labelPart.part.location ? new ActiveInlayHintInfo(labelPart, mouseEvent.hasTriggerModifier) : void 0;
      const lineNumber = model.validatePosition(labelPart.item.hint.position).lineNumber;
      const range = new Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber));
      const lineHints = this._getInlineHintsForRange(range);
      this._updateHintsDecorators([range], lineHints);
      sessionStore.add(toDisposable(() => {
        this._activeInlayHintPart = void 0;
        this._updateHintsDecorators([range], lineHints);
      }));
    }));
    store.add(gesture.onCancel(() => sessionStore.clear()));
    store.add(gesture.onExecute(async (e) => {
      const label = this._getInlayHintLabelPart(e);
      if (label) {
        const part = label.part;
        if (part.location) {
          this._instaService.invokeFunction(goToDefinitionWithLocation, e, this._editor, part.location);
        } else if (languages.Command.is(part.command)) {
          await this._invokeCommand(part.command, label.item);
        }
      }
    }));
    return store;
  }
  _getInlineHintsForRange(range) {
    const lineHints = /* @__PURE__ */ new Set();
    for (const data of this._decorationsMetadata.values()) {
      if (range.containsRange(data.item.anchor.range)) {
        lineHints.add(data.item);
      }
    }
    return Array.from(lineHints);
  }
  _installDblClickGesture(updateInlayHints) {
    return this._editor.onMouseUp(async (e) => {
      if (e.event.detail !== 2) {
        return;
      }
      const part = this._getInlayHintLabelPart(e);
      if (!part) {
        return;
      }
      e.event.preventDefault();
      await part.item.resolve(CancellationToken.None);
      if (isNonEmptyArray(part.item.hint.textEdits)) {
        const edits = part.item.hint.textEdits.map((edit) => EditOperation.replace(Range.lift(edit.range), edit.text));
        this._editor.executeEdits("inlayHint.default", edits);
        updateInlayHints();
      }
    });
  }
  _installContextMenu() {
    return this._editor.onContextMenu(async (e) => {
      if (!isHTMLElement(e.event.target)) {
        return;
      }
      const part = this._getInlayHintLabelPart(e);
      if (part) {
        await this._instaService.invokeFunction(showGoToContextMenu, this._editor, e.event.target, part);
      }
    });
  }
  _getInlayHintLabelPart(e) {
    if (e.target.type !== MouseTargetType.CONTENT_TEXT) {
      return void 0;
    }
    const options = e.target.detail.injectedText?.options;
    if (options instanceof ModelDecorationInjectedTextOptions && options?.attachedData instanceof RenderedInlayHintLabelPart) {
      return options.attachedData;
    }
    return void 0;
  }
  async _invokeCommand(command, item) {
    try {
      await this._commandService.executeCommand(command.id, ...command.arguments ?? []);
    } catch (err) {
      this._notificationService.notify({
        severity: Severity.Error,
        source: item.provider.displayName,
        message: err
      });
    }
  }
  _cacheHintsForFastRestore(model) {
    const hints = this._copyInlayHintsWithCurrentAnchor(model);
    this._inlayHintsCache.set(model, hints);
  }
  // return inlay hints but with an anchor that reflects "updates"
  // that happened after receiving them, e.g adding new lines before a hint
  _copyInlayHintsWithCurrentAnchor(model) {
    const items = /* @__PURE__ */ new Map();
    for (const [id, obj] of this._decorationsMetadata) {
      if (items.has(obj.item)) {
        continue;
      }
      const range = model.getDecorationRange(id);
      if (range) {
        const anchor = new InlayHintAnchor(range, obj.item.anchor.direction);
        const copy = obj.item.with({ anchor });
        items.set(obj.item, copy);
      }
    }
    return Array.from(items.values());
  }
  _getHintsRanges() {
    const extra = 30;
    const model = this._editor.getModel();
    const visibleRanges = this._editor.getVisibleRangesPlusViewportAboveBelow();
    const result = [];
    for (const range of visibleRanges.sort(Range.compareRangesUsingStarts)) {
      const extendedRange = model.validateRange(new Range(range.startLineNumber - extra, range.startColumn, range.endLineNumber + extra, range.endColumn));
      if (result.length === 0 || !Range.areIntersectingOrTouching(result[result.length - 1], extendedRange)) {
        result.push(extendedRange);
      } else {
        result[result.length - 1] = Range.plusRange(result[result.length - 1], extendedRange);
      }
    }
    return result;
  }
  _updateHintsDecorators(ranges, items) {
    const itemFixedLengths = /* @__PURE__ */ new Map();
    if (this._cursorInfo && this._cursorInfo.notEarlierThan > Date.now() && ranges.some((range) => range.containsPosition(this._cursorInfo.position))) {
      const { position } = this._cursorInfo;
      this._cursorInfo = void 0;
      const lengths = /* @__PURE__ */ new Map();
      for (const deco of this._editor.getLineDecorations(position.lineNumber) ?? []) {
        const data = this._decorationsMetadata.get(deco.id);
        if (deco.range.startColumn > position.column) {
          continue;
        }
        const opts = data?.decoration.options[data.item.anchor.direction];
        if (opts && opts.attachedData !== InlayHintsController._whitespaceData) {
          const len = lengths.get(data.item) ?? 0;
          lengths.set(data.item, len + opts.content.length);
        }
      }
      const newItemsWithFixedLength = items.filter((item) => item.anchor.range.startLineNumber === position.lineNumber && item.anchor.range.endColumn <= position.column);
      const fixedLengths = Array.from(lengths.values());
      let lastItem;
      while (true) {
        const targetItem = newItemsWithFixedLength.shift();
        const fixedLength = fixedLengths.shift();
        if (!fixedLength && !targetItem) {
          break;
        }
        if (targetItem) {
          itemFixedLengths.set(targetItem, fixedLength ?? 0);
          lastItem = targetItem;
        } else if (lastItem && fixedLength) {
          let len = itemFixedLengths.get(lastItem);
          len += fixedLength;
          len += fixedLengths.reduce((p, c) => p + c, 0);
          fixedLengths.length = 0;
          break;
        }
      }
    }
    const newDecorationsData = [];
    const addInjectedText = (item, ref, content, cursorStops, attachedData) => {
      const opts = {
        content,
        inlineClassNameAffectsLetterSpacing: true,
        inlineClassName: ref.className,
        cursorStops,
        attachedData
      };
      newDecorationsData.push({
        item,
        classNameRef: ref,
        decoration: {
          range: item.anchor.range,
          options: {
            // className: "rangeHighlight", // DEBUG highlight to see to what range a hint is attached
            description: "InlayHint",
            showIfCollapsed: item.anchor.range.isEmpty(),
            // "original" range is empty
            collapseOnReplaceEdit: !item.anchor.range.isEmpty(),
            stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
            [item.anchor.direction]: this._activeRenderMode === 0 /* Normal */ ? opts : void 0
          }
        }
      });
    };
    const addInjectedWhitespace = (item, isLast) => {
      const marginRule = this._ruleFactory.createClassNameRef({
        width: `${fontSize / 3 | 0}px`,
        display: "inline-block"
      });
      addInjectedText(item, marginRule, "\u200A", isLast ? InjectedTextCursorStops.Right : InjectedTextCursorStops.None, InlayHintsController._whitespaceData);
    };
    const { fontSize, fontFamily, padding, isUniform } = this._getLayoutInfo();
    const maxLength = this._editor.getOption(EditorOption.inlayHints).maximumLength;
    const fontFamilyVar = "--code-editorInlayHintsFontFamily";
    this._editor.getContainerDomNode().style.setProperty(fontFamilyVar, fontFamily);
    let currentLineInfo = { line: 0, totalLen: 0 };
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (currentLineInfo.line !== item.anchor.range.startLineNumber) {
        currentLineInfo = { line: item.anchor.range.startLineNumber, totalLen: 0 };
      }
      if (maxLength && currentLineInfo.totalLen > maxLength) {
        continue;
      }
      if (item.hint.paddingLeft) {
        addInjectedWhitespace(item, false);
      }
      const parts = typeof item.hint.label === "string" ? [{ label: item.hint.label }] : item.hint.label;
      const itemFixedLength = itemFixedLengths.get(item);
      let itemActualLength = 0;
      for (let i2 = 0; i2 < parts.length; i2++) {
        const part = parts[i2];
        const isFirst = i2 === 0;
        const isLast = i2 === parts.length - 1;
        const cssProperties = {
          fontSize: `${fontSize}px`,
          fontFamily: `var(${fontFamilyVar}), ${EDITOR_FONT_DEFAULTS.fontFamily}`,
          verticalAlign: isUniform ? "baseline" : "middle",
          unicodeBidi: "isolate"
        };
        if (isNonEmptyArray(item.hint.textEdits)) {
          cssProperties.cursor = "default";
        }
        this._fillInColors(cssProperties, item.hint);
        if ((part.command || part.location) && this._activeInlayHintPart?.part.item === item && this._activeInlayHintPart.part.index === i2) {
          cssProperties.textDecoration = "underline";
          if (this._activeInlayHintPart.hasTriggerModifier) {
            cssProperties.color = themeColorFromId(colors.editorActiveLinkForeground);
            cssProperties.cursor = "pointer";
          }
        }
        let textlabel = part.label;
        currentLineInfo.totalLen += textlabel.length;
        let tooLong = false;
        const over = maxLength !== 0 ? currentLineInfo.totalLen - maxLength : 0;
        if (over > 0) {
          textlabel = textlabel.slice(0, -over) + "\u2026";
          tooLong = true;
        }
        itemActualLength += textlabel.length;
        if (itemFixedLength !== void 0) {
          const overFixedLength = itemActualLength - itemFixedLength;
          if (overFixedLength >= 0) {
            itemActualLength -= overFixedLength;
            textlabel = textlabel.slice(0, -(1 + overFixedLength)) + "\u2026";
            tooLong = true;
          }
        }
        if (padding) {
          if (isFirst && (isLast || tooLong)) {
            cssProperties.padding = `1px ${Math.max(1, fontSize / 4) | 0}px`;
            cssProperties.borderRadius = `${fontSize / 4 | 0}px`;
          } else if (isFirst) {
            cssProperties.padding = `1px 0 1px ${Math.max(1, fontSize / 4) | 0}px`;
            cssProperties.borderRadius = `${fontSize / 4 | 0}px 0 0 ${fontSize / 4 | 0}px`;
          } else if (isLast || tooLong) {
            cssProperties.padding = `1px ${Math.max(1, fontSize / 4) | 0}px 1px 0`;
            cssProperties.borderRadius = `0 ${fontSize / 4 | 0}px ${fontSize / 4 | 0}px 0`;
          } else {
            cssProperties.padding = `1px 0 1px 0`;
          }
        }
        addInjectedText(
          item,
          this._ruleFactory.createClassNameRef(cssProperties),
          fixSpace(textlabel),
          isLast && !item.hint.paddingRight ? InjectedTextCursorStops.Right : InjectedTextCursorStops.None,
          new RenderedInlayHintLabelPart(item, i2)
        );
        if (tooLong) {
          break;
        }
      }
      if (itemFixedLength !== void 0 && itemActualLength < itemFixedLength) {
        const pad = itemFixedLength - itemActualLength;
        addInjectedText(
          item,
          this._ruleFactory.createClassNameRef({}),
          "\u200A".repeat(pad),
          InjectedTextCursorStops.None
        );
      }
      if (item.hint.paddingRight) {
        addInjectedWhitespace(item, true);
      }
      if (newDecorationsData.length > InlayHintsController._MAX_DECORATORS) {
        break;
      }
    }
    const decorationIdsToReplace = [];
    for (const [id, metadata] of this._decorationsMetadata) {
      const range = this._editor.getModel()?.getDecorationRange(id);
      if (range && ranges.some((r) => r.containsRange(range))) {
        decorationIdsToReplace.push(id);
        metadata.classNameRef.dispose();
        this._decorationsMetadata.delete(id);
      }
    }
    const scrollState = StableEditorScrollState.capture(this._editor);
    this._editor.changeDecorations((accessor) => {
      const newDecorationIds = accessor.deltaDecorations(decorationIdsToReplace, newDecorationsData.map((d) => d.decoration));
      for (let i = 0; i < newDecorationIds.length; i++) {
        const data = newDecorationsData[i];
        this._decorationsMetadata.set(newDecorationIds[i], data);
      }
    });
    scrollState.restore(this._editor);
  }
  _fillInColors(props, hint) {
    if (hint.kind === languages.InlayHintKind.Parameter) {
      props.backgroundColor = themeColorFromId(colors.editorInlayHintParameterBackground);
      props.color = themeColorFromId(colors.editorInlayHintParameterForeground);
    } else if (hint.kind === languages.InlayHintKind.Type) {
      props.backgroundColor = themeColorFromId(colors.editorInlayHintTypeBackground);
      props.color = themeColorFromId(colors.editorInlayHintTypeForeground);
    } else {
      props.backgroundColor = themeColorFromId(colors.editorInlayHintBackground);
      props.color = themeColorFromId(colors.editorInlayHintForeground);
    }
  }
  _getLayoutInfo() {
    const options = this._editor.getOption(EditorOption.inlayHints);
    const padding = options.padding;
    const editorFontSize = this._editor.getOption(EditorOption.fontSize);
    const editorFontFamily = this._editor.getOption(EditorOption.fontFamily);
    let fontSize = options.fontSize;
    if (!fontSize || fontSize < 5 || fontSize > editorFontSize) {
      fontSize = editorFontSize;
    }
    const fontFamily = options.fontFamily || editorFontFamily;
    const isUniform = !padding && fontFamily === editorFontFamily && fontSize === editorFontSize;
    return { fontSize, fontFamily, padding, isUniform };
  }
  _removeAllDecorations() {
    this._editor.removeDecorations(Array.from(this._decorationsMetadata.keys()));
    for (const obj of this._decorationsMetadata.values()) {
      obj.classNameRef.dispose();
    }
    this._decorationsMetadata.clear();
  }
  // --- accessibility
  getInlayHintsForLine(line) {
    if (!this._editor.hasModel()) {
      return [];
    }
    const set = /* @__PURE__ */ new Set();
    const result = [];
    for (const deco of this._editor.getLineDecorations(line)) {
      const data = this._decorationsMetadata.get(deco.id);
      if (data && !set.has(data.item.hint)) {
        set.add(data.item.hint);
        result.push(data.item);
      }
    }
    return result;
  }
};
InlayHintsController.ID = "editor.contrib.InlayHints";
InlayHintsController._MAX_DECORATORS = 1500;
InlayHintsController._whitespaceData = {};
InlayHintsController = __decorateClass([
  __decorateParam(1, ILanguageFeaturesService),
  __decorateParam(2, ILanguageFeatureDebounceService),
  __decorateParam(3, IInlayHintsCache),
  __decorateParam(4, ICommandService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IInstantiationService)
], InlayHintsController);
function fixSpace(str) {
  const noBreakWhitespace = "\xA0";
  return str.replace(/[ \t]/g, noBreakWhitespace);
}
CommandsRegistry.registerCommand("_executeInlayHintProvider", async (accessor, ...args) => {
  const [uri, range] = args;
  assertType(URI.isUri(uri));
  assertType(Range.isIRange(range));
  const { inlayHintsProvider } = accessor.get(ILanguageFeaturesService);
  const ref = await accessor.get(ITextModelService).createModelReference(uri);
  try {
    const model = await InlayHintsFragments.create(inlayHintsProvider, ref.object.textEditorModel, [Range.lift(range)], CancellationToken.None);
    const result = model.items.map((i) => i.hint);
    setTimeout(() => model.dispose(), 0);
    return result;
  } finally {
    ref.dispose();
  }
});
export {
  InlayHintsController,
  RenderedInlayHintLabelPart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxheUhpbnRzL2Jyb3dzZXIvaW5sYXlIaW50c0NvbnRyb2xsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBpc0hUTUxFbGVtZW50LCBNb2RpZmllcktleUVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IGlzTm9uRW1wdHlBcnJheSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBkaXNwb3NhYmxlVGltZW91dCwgUnVuT25jZVNjaGVkdWxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IExSVUNhY2hlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IElSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3JhbmdlLmpzJztcbmltcG9ydCB7IGFzc2VydFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUFjdGl2ZUNvZGVFZGl0b3IsIElDb2RlRWRpdG9yLCBJRWRpdG9yTW91c2VFdmVudCwgTW91c2VUYXJnZXRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IENsYXNzTmFtZVJlZmVyZW5jZSwgQ3NzUHJvcGVydGllcywgRHluYW1pY0Nzc1J1bGVzIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JEb20uanMnO1xuaW1wb3J0IHsgU3RhYmxlRWRpdG9yU2Nyb2xsU3RhdGUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3N0YWJsZUVkaXRvclNjcm9sbC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24sIEVESVRPUl9GT05UX0RFRkFVTFRTIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0ICogYXMgbGFuZ3VhZ2VzIGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBJbmplY3RlZFRleHRDdXJzb3JTdG9wcywgSW5qZWN0ZWRUZXh0T3B0aW9ucywgSVRleHRNb2RlbCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBNb2RlbERlY29yYXRpb25JbmplY3RlZFRleHRPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJRmVhdHVyZURlYm91bmNlSW5mb3JtYXRpb24sIElMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENsaWNrTGlua0dlc3R1cmUsIENsaWNrTGlua01vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi9nb3RvU3ltYm9sL2Jyb3dzZXIvbGluay9jbGlja0xpbmtHZXN0dXJlLmpzJztcbmltcG9ydCB7IElubGF5SGludEFuY2hvciwgSW5sYXlIaW50SXRlbSwgSW5sYXlIaW50c0ZyYWdtZW50cyB9IGZyb20gJy4vaW5sYXlIaW50cy5qcyc7XG5pbXBvcnQgeyBnb1RvRGVmaW5pdGlvbldpdGhMb2NhdGlvbiwgc2hvd0dvVG9Db250ZXh0TWVudSB9IGZyb20gJy4vaW5sYXlIaW50c0xvY2F0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5LCBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IsIElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0ICogYXMgY29sb3JzIGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IHRoZW1lQ29sb3JGcm9tSWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuXG4vLyAtLS0gaGludCBjYWNoaW5nIHNlcnZpY2UgKHBlciBzZXNzaW9uKVxuXG5jbGFzcyBJbmxheUhpbnRzQ2FjaGUge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VudHJpZXMgPSBuZXcgTFJVQ2FjaGU8c3RyaW5nLCBJbmxheUhpbnRJdGVtW10+KDUwKTtcblxuXHRnZXQobW9kZWw6IElUZXh0TW9kZWwpOiBJbmxheUhpbnRJdGVtW10gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGtleSA9IElubGF5SGludHNDYWNoZS5fa2V5KG1vZGVsKTtcblx0XHRyZXR1cm4gdGhpcy5fZW50cmllcy5nZXQoa2V5KTtcblx0fVxuXG5cdHNldChtb2RlbDogSVRleHRNb2RlbCwgdmFsdWU6IElubGF5SGludEl0ZW1bXSk6IHZvaWQge1xuXHRcdGNvbnN0IGtleSA9IElubGF5SGludHNDYWNoZS5fa2V5KG1vZGVsKTtcblx0XHR0aGlzLl9lbnRyaWVzLnNldChrZXksIHZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9rZXkobW9kZWw6IElUZXh0TW9kZWwpOiBzdHJpbmcge1xuXHRcdHJldHVybiBgJHttb2RlbC51cmkudG9TdHJpbmcoKX0vJHttb2RlbC5nZXRWZXJzaW9uSWQoKX1gO1xuXHR9XG59XG5cbmludGVyZmFjZSBJSW5sYXlIaW50c0NhY2hlIGV4dGVuZHMgSW5sYXlIaW50c0NhY2hlIHsgfVxuY29uc3QgSUlubGF5SGludHNDYWNoZSA9IGNyZWF0ZURlY29yYXRvcjxJSW5sYXlIaW50c0NhY2hlPignSUlubGF5SGludHNDYWNoZScpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUlubGF5SGludHNDYWNoZSwgSW5sYXlIaW50c0NhY2hlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcblxuLy8gLS0tIHJlbmRlcmVkIGxhYmVsXG5cbmV4cG9ydCBjbGFzcyBSZW5kZXJlZElubGF5SGludExhYmVsUGFydCB7XG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IGl0ZW06IElubGF5SGludEl0ZW0sIHJlYWRvbmx5IGluZGV4OiBudW1iZXIpIHsgfVxuXG5cdGdldCBwYXJ0KCkge1xuXHRcdGNvbnN0IGxhYmVsID0gdGhpcy5pdGVtLmhpbnQubGFiZWw7XG5cdFx0aWYgKHR5cGVvZiBsYWJlbCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiB7IGxhYmVsIH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBsYWJlbFt0aGlzLmluZGV4XTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgQWN0aXZlSW5sYXlIaW50SW5mbyB7XG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IHBhcnQ6IFJlbmRlcmVkSW5sYXlIaW50TGFiZWxQYXJ0LCByZWFkb25seSBoYXNUcmlnZ2VyTW9kaWZpZXI6IGJvb2xlYW4pIHsgfVxufVxuXG50eXBlIElubGF5SGludERlY29yYXRpb25SZW5kZXJJbmZvID0ge1xuXHRpdGVtOiBJbmxheUhpbnRJdGVtO1xuXHRkZWNvcmF0aW9uOiBJTW9kZWxEZWx0YURlY29yYXRpb247XG5cdGNsYXNzTmFtZVJlZjogQ2xhc3NOYW1lUmVmZXJlbmNlO1xufTtcblxuY29uc3QgZW51bSBSZW5kZXJNb2RlIHtcblx0Tm9ybWFsLFxuXHRJbnZpc2libGVcbn1cblxuLy8gLS0tIGNvbnRyb2xsZXJcblxuZXhwb3J0IGNsYXNzIElubGF5SGludHNDb250cm9sbGVyIGltcGxlbWVudHMgSUVkaXRvckNvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEOiBzdHJpbmcgPSAnZWRpdG9yLmNvbnRyaWIuSW5sYXlIaW50cyc7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX01BWF9ERUNPUkFUT1JTID0gMTUwMDtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX3doaXRlc3BhY2VEYXRhID0ge307XG5cblx0c3RhdGljIGdldChlZGl0b3I6IElDb2RlRWRpdG9yKTogSW5sYXlIaW50c0NvbnRyb2xsZXIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBlZGl0b3IuZ2V0Q29udHJpYnV0aW9uPElubGF5SGludHNDb250cm9sbGVyPihJbmxheUhpbnRzQ29udHJvbGxlci5JRCkgPz8gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Nlc3Npb25EaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZGVib3VuY2VJbmZvOiBJRmVhdHVyZURlYm91bmNlSW5mb3JtYXRpb247XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlY29yYXRpb25zTWV0YWRhdGEgPSBuZXcgTWFwPHN0cmluZywgSW5sYXlIaW50RGVjb3JhdGlvblJlbmRlckluZm8+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3J1bGVGYWN0b3J5ID0gbmV3IER5bmFtaWNDc3NSdWxlcyh0aGlzLl9lZGl0b3IpO1xuXG5cdHByaXZhdGUgX2N1cnNvckluZm8/OiB7IHBvc2l0aW9uOiBQb3NpdGlvbjsgbm90RWFybGllclRoYW46IG51bWJlciB9O1xuXHRwcml2YXRlIF9hY3RpdmVSZW5kZXJNb2RlID0gUmVuZGVyTW9kZS5Ob3JtYWw7XG5cdHByaXZhdGUgX2FjdGl2ZUlubGF5SGludFBhcnQ/OiBBY3RpdmVJbmxheUhpbnRJbmZvO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlIF9mZWF0dXJlRGVib3VuY2U6IElMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UsXG5cdFx0QElJbmxheUhpbnRzQ2FjaGUgcHJpdmF0ZSByZWFkb25seSBfaW5sYXlIaW50c0NhY2hlOiBJSW5sYXlIaW50c0NhY2hlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5fZGVib3VuY2VJbmZvID0gX2ZlYXR1cmVEZWJvdW5jZS5mb3IoX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmlubGF5SGludHNQcm92aWRlciwgJ0lubGF5SGludCcsIHsgbWluOiAyNSB9KTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQoX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmlubGF5SGludHNQcm92aWRlci5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLl91cGRhdGUoKSkpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChfZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWwoKCkgPT4gdGhpcy5fdXBkYXRlKCkpKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQoX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2UoKCkgPT4gdGhpcy5fdXBkYXRlKCkpKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQoX2VkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5pbmxheUhpbnRzKSkge1xuXHRcdFx0XHR0aGlzLl91cGRhdGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fdXBkYXRlKCk7XG5cblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fc2Vzc2lvbkRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9yZW1vdmVBbGxEZWNvcmF0aW9ucygpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR0aGlzLl9yZW1vdmVBbGxEZWNvcmF0aW9ucygpO1xuXG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmlubGF5SGludHMpO1xuXHRcdGlmIChvcHRpb25zLmVuYWJsZWQgPT09ICdvZmYnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoIW1vZGVsIHx8ICF0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5pbmxheUhpbnRzUHJvdmlkZXIuaGFzKG1vZGVsKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zLmVuYWJsZWQgPT09ICdvbicpIHtcblx0XHRcdC8vIGRpZmZlcmVudCBcIm9uXCIgbW9kZXM6IGFsd2F5c1xuXHRcdFx0dGhpcy5fYWN0aXZlUmVuZGVyTW9kZSA9IFJlbmRlck1vZGUuTm9ybWFsO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBkaWZmZXJlbnQgXCJvblwiIG1vZGVzOiBvZmZVbmxlc3NQcmVzc2VkLCBvciBvblVubGVzc1ByZXNzZWRcblx0XHRcdGxldCBkZWZhdWx0TW9kZTogUmVuZGVyTW9kZTtcblx0XHRcdGxldCBhbHRNb2RlOiBSZW5kZXJNb2RlO1xuXHRcdFx0aWYgKG9wdGlvbnMuZW5hYmxlZCA9PT0gJ29uVW5sZXNzUHJlc3NlZCcpIHtcblx0XHRcdFx0ZGVmYXVsdE1vZGUgPSBSZW5kZXJNb2RlLk5vcm1hbDtcblx0XHRcdFx0YWx0TW9kZSA9IFJlbmRlck1vZGUuSW52aXNpYmxlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGVmYXVsdE1vZGUgPSBSZW5kZXJNb2RlLkludmlzaWJsZTtcblx0XHRcdFx0YWx0TW9kZSA9IFJlbmRlck1vZGUuTm9ybWFsO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fYWN0aXZlUmVuZGVyTW9kZSA9IGRlZmF1bHRNb2RlO1xuXG5cdFx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuYWRkKE1vZGlmaWVyS2V5RW1pdHRlci5nZXRJbnN0YW5jZSgpLmV2ZW50KGUgPT4ge1xuXHRcdFx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IG5ld1JlbmRlck1vZGUgPSBlLmFsdEtleSAmJiBlLmN0cmxLZXkgJiYgIShlLnNoaWZ0S2V5IHx8IGUubWV0YUtleSkgPyBhbHRNb2RlIDogZGVmYXVsdE1vZGU7XG5cdFx0XHRcdGlmIChuZXdSZW5kZXJNb2RlICE9PSB0aGlzLl9hY3RpdmVSZW5kZXJNb2RlKSB7XG5cdFx0XHRcdFx0dGhpcy5fYWN0aXZlUmVuZGVyTW9kZSA9IG5ld1JlbmRlck1vZGU7XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdFx0XHRjb25zdCBjb3BpZXMgPSB0aGlzLl9jb3B5SW5sYXlIaW50c1dpdGhDdXJyZW50QW5jaG9yKG1vZGVsKTtcblx0XHRcdFx0XHR0aGlzLl91cGRhdGVIaW50c0RlY29yYXRvcnMoW21vZGVsLmdldEZ1bGxNb2RlbFJhbmdlKCldLCBjb3BpZXMpO1xuXHRcdFx0XHRcdHNjaGVkdWxlci5zY2hlZHVsZSgwKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdC8vIGlmZiBwb3NzaWJsZSwgcXVpY2tseSB1cGRhdGUgZnJvbSBjYWNoZVxuXHRcdGNvbnN0IGNhY2hlZCA9IHRoaXMuX2lubGF5SGludHNDYWNoZS5nZXQobW9kZWwpO1xuXHRcdGlmIChjYWNoZWQpIHtcblx0XHRcdHRoaXMuX3VwZGF0ZUhpbnRzRGVjb3JhdG9ycyhbbW9kZWwuZ2V0RnVsbE1vZGVsUmFuZ2UoKV0sIGNhY2hlZCk7XG5cdFx0fVxuXHRcdHRoaXMuX3Nlc3Npb25EaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdC8vIGNhY2hlIGl0ZW1zIHdoZW4gc3dpdGNoaW5nIGZpbGVzIGV0Y1xuXHRcdFx0aWYgKCFtb2RlbC5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdFx0dGhpcy5fY2FjaGVIaW50c0ZvckZhc3RSZXN0b3JlKG1vZGVsKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRsZXQgY3RzOiBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCB3YXRjaGVkUHJvdmlkZXJzID0gbmV3IFNldDxsYW5ndWFnZXMuSW5sYXlIaW50c1Byb3ZpZGVyPigpO1xuXG5cdFx0Y29uc3Qgc2NoZWR1bGVyID0gbmV3IFJ1bk9uY2VTY2hlZHVsZXIoYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdDEgPSBEYXRlLm5vdygpO1xuXG5cdFx0XHRjdHM/LmRpc3Bvc2UodHJ1ZSk7XG5cdFx0XHRjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdGNvbnN0IGxpc3RlbmVyID0gbW9kZWwub25XaWxsRGlzcG9zZSgoKSA9PiBjdHM/LmNhbmNlbCgpKTtcblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgbXlUb2tlbiA9IGN0cy50b2tlbjtcblx0XHRcdFx0Y29uc3QgaW5sYXlIaW50cyA9IGF3YWl0IElubGF5SGludHNGcmFnbWVudHMuY3JlYXRlKHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmlubGF5SGludHNQcm92aWRlciwgbW9kZWwsIHRoaXMuX2dldEhpbnRzUmFuZ2VzKCksIG15VG9rZW4pO1xuXHRcdFx0XHRzY2hlZHVsZXIuZGVsYXkgPSB0aGlzLl9kZWJvdW5jZUluZm8udXBkYXRlKG1vZGVsLCBEYXRlLm5vdygpIC0gdDEpO1xuXHRcdFx0XHRpZiAobXlUb2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdGlubGF5SGludHMuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIGxpc3RlbiB0byBwcm92aWRlciBjaGFuZ2VzXG5cdFx0XHRcdGZvciAoY29uc3QgcHJvdmlkZXIgb2YgaW5sYXlIaW50cy5wcm92aWRlcikge1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgcHJvdmlkZXIub25EaWRDaGFuZ2VJbmxheUhpbnRzID09PSAnZnVuY3Rpb24nICYmICF3YXRjaGVkUHJvdmlkZXJzLmhhcyhwcm92aWRlcikpIHtcblx0XHRcdFx0XHRcdHdhdGNoZWRQcm92aWRlcnMuYWRkKHByb3ZpZGVyKTtcblx0XHRcdFx0XHRcdHRoaXMuX3Nlc3Npb25EaXNwb3NhYmxlcy5hZGQocHJvdmlkZXIub25EaWRDaGFuZ2VJbmxheUhpbnRzKCgpID0+IHtcblx0XHRcdFx0XHRcdFx0aWYgKCFzY2hlZHVsZXIuaXNTY2hlZHVsZWQoKSkgeyAvLyBpZ25vcmUgZXZlbnQgd2hlbiByZXF1ZXN0IGlzIGFscmVhZHkgc2NoZWR1bGVkXG5cdFx0XHRcdFx0XHRcdFx0c2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuYWRkKGlubGF5SGludHMpO1xuXHRcdFx0XHR0aGlzLl91cGRhdGVIaW50c0RlY29yYXRvcnMoaW5sYXlIaW50cy5yYW5nZXMsIGlubGF5SGludHMuaXRlbXMpO1xuXHRcdFx0XHR0aGlzLl9jYWNoZUhpbnRzRm9yRmFzdFJlc3RvcmUobW9kZWwpO1xuXG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyKTtcblxuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0Y3RzLmRpc3Bvc2UoKTtcblx0XHRcdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXG5cdFx0fSwgdGhpcy5fZGVib3VuY2VJbmZvLmdldChtb2RlbCkpO1xuXG5cdFx0dGhpcy5fc2Vzc2lvbkRpc3Bvc2FibGVzLmFkZChzY2hlZHVsZXIpO1xuXHRcdHRoaXMuX3Nlc3Npb25EaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IGN0cz8uZGlzcG9zZSh0cnVlKSkpO1xuXHRcdHNjaGVkdWxlci5zY2hlZHVsZSgwKTtcblxuXHRcdHRoaXMuX3Nlc3Npb25EaXNwb3NhYmxlcy5hZGQodGhpcy5fZWRpdG9yLm9uRGlkU2Nyb2xsQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHQvLyB1cGRhdGUgd2hlbiBzY3JvbGwgcG9zaXRpb24gY2hhbmdlc1xuXHRcdFx0Ly8gdXNlcyBzY3JvbGxUb3BDaGFuZ2VkIGhhcyB3ZWFrIGhldXJpc3RpYyB0byBkaWZmZXJlbmF0aWF0ZSBiZXR3ZWVuIHNjcm9sbGluZyBkdWUgdG9cblx0XHRcdC8vIHR5cGluZyBvciBkdWUgdG8gXCJhY3R1YWxcIiBzY3JvbGxpbmdcblx0XHRcdGlmIChlLnNjcm9sbFRvcENoYW5nZWQgfHwgIXNjaGVkdWxlci5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHRcdHNjaGVkdWxlci5zY2hlZHVsZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGN1cnNvciA9IHRoaXMuX3Nlc3Npb25EaXNwb3NhYmxlcy5hZGQobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRcdHRoaXMuX3Nlc3Npb25EaXNwb3NhYmxlcy5hZGQodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KChlKSA9PiB7XG5cdFx0XHRjdHM/LmNhbmNlbCgpO1xuXG5cdFx0XHQvLyBtYXJrIGN1cnJlbnQgY3Vyc29yIHBvc2l0aW9uIGFuZCB0aW1lIGFmdGVyIHdoaWNoIHRoZSB3aG9sZSBjYW4gYmUgdXBkYXRlZC9yZWRyYXduXG5cdFx0XHRjb25zdCBkZWxheSA9IE1hdGgubWF4KHNjaGVkdWxlci5kZWxheSwgODAwKTtcblx0XHRcdHRoaXMuX2N1cnNvckluZm8gPSB7IHBvc2l0aW9uOiB0aGlzLl9lZGl0b3IuZ2V0UG9zaXRpb24oKSEsIG5vdEVhcmxpZXJUaGFuOiBEYXRlLm5vdygpICsgZGVsYXkgfTtcblx0XHRcdGN1cnNvci52YWx1ZSA9IGRpc3Bvc2FibGVUaW1lb3V0KCgpID0+IHNjaGVkdWxlci5zY2hlZHVsZSgwKSwgZGVsYXkpO1xuXG5cdFx0XHRzY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuYWRkKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5pbmxheUhpbnRzKSkge1xuXHRcdFx0XHRzY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBtb3VzZSBnZXN0dXJlc1xuXHRcdHRoaXMuX3Nlc3Npb25EaXNwb3NhYmxlcy5hZGQodGhpcy5faW5zdGFsbERibENsaWNrR2VzdHVyZSgoKSA9PiBzY2hlZHVsZXIuc2NoZWR1bGUoMCkpKTtcblx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuYWRkKHRoaXMuX2luc3RhbGxMaW5rR2VzdHVyZSgpKTtcblx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuYWRkKHRoaXMuX2luc3RhbGxDb250ZXh0TWVudSgpKTtcblx0fVxuXG5cdHByaXZhdGUgX2luc3RhbGxMaW5rR2VzdHVyZSgpOiBJRGlzcG9zYWJsZSB7XG5cblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBnZXN0dXJlID0gc3RvcmUuYWRkKG5ldyBDbGlja0xpbmtHZXN0dXJlKHRoaXMuX2VkaXRvcikpO1xuXG5cdFx0Ly8gbGV0IHJlbW92ZUhpZ2hsaWdodCA9ICgpID0+IHsgfTtcblxuXHRcdGNvbnN0IHNlc3Npb25TdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRzdG9yZS5hZGQoc2Vzc2lvblN0b3JlKTtcblxuXHRcdHN0b3JlLmFkZChnZXN0dXJlLm9uTW91c2VNb3ZlT3JSZWxldmFudEtleURvd24oZSA9PiB7XG5cdFx0XHRjb25zdCBbbW91c2VFdmVudF0gPSBlO1xuXHRcdFx0Y29uc3QgbGFiZWxQYXJ0ID0gdGhpcy5fZ2V0SW5sYXlIaW50TGFiZWxQYXJ0KG1vdXNlRXZlbnQpO1xuXHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblxuXHRcdFx0aWYgKCFsYWJlbFBhcnQgfHwgIW1vZGVsKSB7XG5cdFx0XHRcdHNlc3Npb25TdG9yZS5jbGVhcigpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIHJlc29sdmUgdGhlIGl0ZW1cblx0XHRcdGNvbnN0IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdFx0c2Vzc2lvblN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gY3RzLmRpc3Bvc2UodHJ1ZSkpKTtcblx0XHRcdGxhYmVsUGFydC5pdGVtLnJlc29sdmUoY3RzLnRva2VuKTtcblxuXHRcdFx0Ly8gcmVuZGVyIGxpbmsgPT4gd2hlbiB0aGUgbW9kaWZpZXIgaXMgcHJlc3NlZCBhbmQgd2hlbiB0aGVyZSBpcyBhIGNvbW1hbmQgb3IgbG9jYXRpb25cblx0XHRcdHRoaXMuX2FjdGl2ZUlubGF5SGludFBhcnQgPSBsYWJlbFBhcnQucGFydC5jb21tYW5kIHx8IGxhYmVsUGFydC5wYXJ0LmxvY2F0aW9uXG5cdFx0XHRcdD8gbmV3IEFjdGl2ZUlubGF5SGludEluZm8obGFiZWxQYXJ0LCBtb3VzZUV2ZW50Lmhhc1RyaWdnZXJNb2RpZmllcilcblx0XHRcdFx0OiB1bmRlZmluZWQ7XG5cblx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBtb2RlbC52YWxpZGF0ZVBvc2l0aW9uKGxhYmVsUGFydC5pdGVtLmhpbnQucG9zaXRpb24pLmxpbmVOdW1iZXI7XG5cdFx0XHRjb25zdCByYW5nZSA9IG5ldyBSYW5nZShsaW5lTnVtYmVyLCAxLCBsaW5lTnVtYmVyLCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpKTtcblx0XHRcdGNvbnN0IGxpbmVIaW50cyA9IHRoaXMuX2dldElubGluZUhpbnRzRm9yUmFuZ2UocmFuZ2UpO1xuXHRcdFx0dGhpcy5fdXBkYXRlSGludHNEZWNvcmF0b3JzKFtyYW5nZV0sIGxpbmVIaW50cyk7XG5cdFx0XHRzZXNzaW9uU3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2FjdGl2ZUlubGF5SGludFBhcnQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZUhpbnRzRGVjb3JhdG9ycyhbcmFuZ2VdLCBsaW5lSGludHMpO1xuXHRcdFx0fSkpO1xuXHRcdH0pKTtcblx0XHRzdG9yZS5hZGQoZ2VzdHVyZS5vbkNhbmNlbCgoKSA9PiBzZXNzaW9uU3RvcmUuY2xlYXIoKSkpO1xuXHRcdHN0b3JlLmFkZChnZXN0dXJlLm9uRXhlY3V0ZShhc3luYyBlID0+IHtcblx0XHRcdGNvbnN0IGxhYmVsID0gdGhpcy5fZ2V0SW5sYXlIaW50TGFiZWxQYXJ0KGUpO1xuXHRcdFx0aWYgKGxhYmVsKSB7XG5cdFx0XHRcdGNvbnN0IHBhcnQgPSBsYWJlbC5wYXJ0O1xuXHRcdFx0XHRpZiAocGFydC5sb2NhdGlvbikge1xuXHRcdFx0XHRcdC8vIGxvY2F0aW9uIC0+IGV4ZWN1dGUgZ28gdG8gZGVmXG5cdFx0XHRcdFx0dGhpcy5faW5zdGFTZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGdvVG9EZWZpbml0aW9uV2l0aExvY2F0aW9uLCBlLCB0aGlzLl9lZGl0b3IgYXMgSUFjdGl2ZUNvZGVFZGl0b3IsIHBhcnQubG9jYXRpb24pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGxhbmd1YWdlcy5Db21tYW5kLmlzKHBhcnQuY29tbWFuZCkpIHtcblx0XHRcdFx0XHQvLyBjb21tYW5kIC0+IGV4ZWN1dGUgaXRcblx0XHRcdFx0XHRhd2FpdCB0aGlzLl9pbnZva2VDb21tYW5kKHBhcnQuY29tbWFuZCwgbGFiZWwuaXRlbSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0cmV0dXJuIHN0b3JlO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0SW5saW5lSGludHNGb3JSYW5nZShyYW5nZTogUmFuZ2UpIHtcblx0XHRjb25zdCBsaW5lSGludHMgPSBuZXcgU2V0PElubGF5SGludEl0ZW0+KCk7XG5cdFx0Zm9yIChjb25zdCBkYXRhIG9mIHRoaXMuX2RlY29yYXRpb25zTWV0YWRhdGEudmFsdWVzKCkpIHtcblx0XHRcdGlmIChyYW5nZS5jb250YWluc1JhbmdlKGRhdGEuaXRlbS5hbmNob3IucmFuZ2UpKSB7XG5cdFx0XHRcdGxpbmVIaW50cy5hZGQoZGF0YS5pdGVtKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIEFycmF5LmZyb20obGluZUhpbnRzKTtcblx0fVxuXG5cdHByaXZhdGUgX2luc3RhbGxEYmxDbGlja0dlc3R1cmUodXBkYXRlSW5sYXlIaW50czogRnVuY3Rpb24pOiBJRGlzcG9zYWJsZSB7XG5cdFx0cmV0dXJuIHRoaXMuX2VkaXRvci5vbk1vdXNlVXAoYXN5bmMgZSA9PiB7XG5cdFx0XHRpZiAoZS5ldmVudC5kZXRhaWwgIT09IDIpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcGFydCA9IHRoaXMuX2dldElubGF5SGludExhYmVsUGFydChlKTtcblx0XHRcdGlmICghcGFydCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRlLmV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRhd2FpdCBwYXJ0Lml0ZW0ucmVzb2x2ZShDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGlmIChpc05vbkVtcHR5QXJyYXkocGFydC5pdGVtLmhpbnQudGV4dEVkaXRzKSkge1xuXHRcdFx0XHRjb25zdCBlZGl0cyA9IHBhcnQuaXRlbS5oaW50LnRleHRFZGl0cy5tYXAoZWRpdCA9PiBFZGl0T3BlcmF0aW9uLnJlcGxhY2UoUmFuZ2UubGlmdChlZGl0LnJhbmdlKSwgZWRpdC50ZXh0KSk7XG5cdFx0XHRcdHRoaXMuX2VkaXRvci5leGVjdXRlRWRpdHMoJ2lubGF5SGludC5kZWZhdWx0JywgZWRpdHMpO1xuXHRcdFx0XHR1cGRhdGVJbmxheUhpbnRzKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9pbnN0YWxsQ29udGV4dE1lbnUoKTogSURpc3Bvc2FibGUge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0b3Iub25Db250ZXh0TWVudShhc3luYyBlID0+IHtcblx0XHRcdGlmICghKGlzSFRNTEVsZW1lbnQoZS5ldmVudC50YXJnZXQpKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBwYXJ0ID0gdGhpcy5fZ2V0SW5sYXlIaW50TGFiZWxQYXJ0KGUpO1xuXHRcdFx0aWYgKHBhcnQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5faW5zdGFTZXJ2aWNlLmludm9rZUZ1bmN0aW9uKHNob3dHb1RvQ29udGV4dE1lbnUsIHRoaXMuX2VkaXRvciwgZS5ldmVudC50YXJnZXQsIHBhcnQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0SW5sYXlIaW50TGFiZWxQYXJ0KGU6IElFZGl0b3JNb3VzZUV2ZW50IHwgQ2xpY2tMaW5rTW91c2VFdmVudCk6IFJlbmRlcmVkSW5sYXlIaW50TGFiZWxQYXJ0IHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoZS50YXJnZXQudHlwZSAhPT0gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfVEVYVCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IGUudGFyZ2V0LmRldGFpbC5pbmplY3RlZFRleHQ/Lm9wdGlvbnM7XG5cdFx0aWYgKG9wdGlvbnMgaW5zdGFuY2VvZiBNb2RlbERlY29yYXRpb25JbmplY3RlZFRleHRPcHRpb25zICYmIG9wdGlvbnM/LmF0dGFjaGVkRGF0YSBpbnN0YW5jZW9mIFJlbmRlcmVkSW5sYXlIaW50TGFiZWxQYXJ0KSB7XG5cdFx0XHRyZXR1cm4gb3B0aW9ucy5hdHRhY2hlZERhdGE7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9pbnZva2VDb21tYW5kKGNvbW1hbmQ6IGxhbmd1YWdlcy5Db21tYW5kLCBpdGVtOiBJbmxheUhpbnRJdGVtKSB7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGNvbW1hbmQuaWQsIC4uLihjb21tYW5kLmFyZ3VtZW50cyA/PyBbXSkpO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoe1xuXHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRcdHNvdXJjZTogaXRlbS5wcm92aWRlci5kaXNwbGF5TmFtZSxcblx0XHRcdFx0bWVzc2FnZTogZXJyXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9jYWNoZUhpbnRzRm9yRmFzdFJlc3RvcmUobW9kZWw6IElUZXh0TW9kZWwpOiB2b2lkIHtcblx0XHRjb25zdCBoaW50cyA9IHRoaXMuX2NvcHlJbmxheUhpbnRzV2l0aEN1cnJlbnRBbmNob3IobW9kZWwpO1xuXHRcdHRoaXMuX2lubGF5SGludHNDYWNoZS5zZXQobW9kZWwsIGhpbnRzKTtcblx0fVxuXG5cdC8vIHJldHVybiBpbmxheSBoaW50cyBidXQgd2l0aCBhbiBhbmNob3IgdGhhdCByZWZsZWN0cyBcInVwZGF0ZXNcIlxuXHQvLyB0aGF0IGhhcHBlbmVkIGFmdGVyIHJlY2VpdmluZyB0aGVtLCBlLmcgYWRkaW5nIG5ldyBsaW5lcyBiZWZvcmUgYSBoaW50XG5cdHByaXZhdGUgX2NvcHlJbmxheUhpbnRzV2l0aEN1cnJlbnRBbmNob3IobW9kZWw6IElUZXh0TW9kZWwpOiBJbmxheUhpbnRJdGVtW10ge1xuXHRcdGNvbnN0IGl0ZW1zID0gbmV3IE1hcDxJbmxheUhpbnRJdGVtLCBJbmxheUhpbnRJdGVtPigpO1xuXHRcdGZvciAoY29uc3QgW2lkLCBvYmpdIG9mIHRoaXMuX2RlY29yYXRpb25zTWV0YWRhdGEpIHtcblx0XHRcdGlmIChpdGVtcy5oYXMob2JqLml0ZW0pKSB7XG5cdFx0XHRcdC8vIGFuIGlubGF5IGl0ZW0gY2FuIGJlIHJlbmRlcmVkIGFzIG11bHRpcGxlIGRlY29yYXRpb25zXG5cdFx0XHRcdC8vIGJ1dCB0aGV5IHdpbGwgYWxsIHVzZXMgdGhlIHNhbWUgcmFuZ2Vcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByYW5nZSA9IG1vZGVsLmdldERlY29yYXRpb25SYW5nZShpZCk7XG5cdFx0XHRpZiAocmFuZ2UpIHtcblx0XHRcdFx0Ly8gdXBkYXRlIHJhbmdlIHdpdGggd2hhdGV2ZXIgdGhlIGVkaXRvciBoYXMgdHdlYWtlZCBpdCB0b1xuXHRcdFx0XHRjb25zdCBhbmNob3IgPSBuZXcgSW5sYXlIaW50QW5jaG9yKHJhbmdlLCBvYmouaXRlbS5hbmNob3IuZGlyZWN0aW9uKTtcblx0XHRcdFx0Y29uc3QgY29weSA9IG9iai5pdGVtLndpdGgoeyBhbmNob3IgfSk7XG5cdFx0XHRcdGl0ZW1zLnNldChvYmouaXRlbSwgY29weSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBBcnJheS5mcm9tKGl0ZW1zLnZhbHVlcygpKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEhpbnRzUmFuZ2VzKCk6IFJhbmdlW10ge1xuXHRcdGNvbnN0IGV4dHJhID0gMzA7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0Y29uc3QgdmlzaWJsZVJhbmdlcyA9IHRoaXMuX2VkaXRvci5nZXRWaXNpYmxlUmFuZ2VzUGx1c1ZpZXdwb3J0QWJvdmVCZWxvdygpO1xuXHRcdGNvbnN0IHJlc3VsdDogUmFuZ2VbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgcmFuZ2Ugb2YgdmlzaWJsZVJhbmdlcy5zb3J0KFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cykpIHtcblx0XHRcdGNvbnN0IGV4dGVuZGVkUmFuZ2UgPSBtb2RlbC52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZShyYW5nZS5zdGFydExpbmVOdW1iZXIgLSBleHRyYSwgcmFuZ2Uuc3RhcnRDb2x1bW4sIHJhbmdlLmVuZExpbmVOdW1iZXIgKyBleHRyYSwgcmFuZ2UuZW5kQ29sdW1uKSk7XG5cdFx0XHRpZiAocmVzdWx0Lmxlbmd0aCA9PT0gMCB8fCAhUmFuZ2UuYXJlSW50ZXJzZWN0aW5nT3JUb3VjaGluZyhyZXN1bHRbcmVzdWx0Lmxlbmd0aCAtIDFdLCBleHRlbmRlZFJhbmdlKSkge1xuXHRcdFx0XHRyZXN1bHQucHVzaChleHRlbmRlZFJhbmdlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc3VsdFtyZXN1bHQubGVuZ3RoIC0gMV0gPSBSYW5nZS5wbHVzUmFuZ2UocmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXSwgZXh0ZW5kZWRSYW5nZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVIaW50c0RlY29yYXRvcnMocmFuZ2VzOiByZWFkb25seSBSYW5nZVtdLCBpdGVtczogcmVhZG9ubHkgSW5sYXlIaW50SXRlbVtdKTogdm9pZCB7XG5cblx0XHRjb25zdCBpdGVtRml4ZWRMZW5ndGhzID0gbmV3IE1hcDxJbmxheUhpbnRJdGVtLCBudW1iZXI+KCk7XG5cblx0XHRpZiAodGhpcy5fY3Vyc29ySW5mb1xuXHRcdFx0JiYgdGhpcy5fY3Vyc29ySW5mby5ub3RFYXJsaWVyVGhhbiA+IERhdGUubm93KClcblx0XHRcdCYmIHJhbmdlcy5zb21lKHJhbmdlID0+IHJhbmdlLmNvbnRhaW5zUG9zaXRpb24odGhpcy5fY3Vyc29ySW5mbyEucG9zaXRpb24pKVxuXHRcdCkge1xuXHRcdFx0Ly8gY29sbGVjdCBpbmxheSBoaW50cyB0aGF0IGFyZSBvbiB0aGUgc2FtZSBsaW5lIGFuZCBiZWZvcmUgdGhlIGN1cnNvci4gVGhvc2UgXCJvbGRcIiBoaW50c1xuXHRcdFx0Ly8gZGVmaW5lIGZpeGVkIGxlbmd0aHMgc28gdGhhdCB0aGUgY3Vyc29yIGRvZXMgbm90IGp1bXAgYmFjayBhbmQgd29ydGggd2hpbGUgdHlwaW5nLlxuXHRcdFx0Y29uc3QgeyBwb3NpdGlvbiB9ID0gdGhpcy5fY3Vyc29ySW5mbztcblx0XHRcdHRoaXMuX2N1cnNvckluZm8gPSB1bmRlZmluZWQ7XG5cblx0XHRcdGNvbnN0IGxlbmd0aHMgPSBuZXcgTWFwPElubGF5SGludEl0ZW0sIG51bWJlcj4oKTtcblxuXHRcdFx0Zm9yIChjb25zdCBkZWNvIG9mIHRoaXMuX2VkaXRvci5nZXRMaW5lRGVjb3JhdGlvbnMocG9zaXRpb24ubGluZU51bWJlcikgPz8gW10pIHtcblxuXHRcdFx0XHRjb25zdCBkYXRhID0gdGhpcy5fZGVjb3JhdGlvbnNNZXRhZGF0YS5nZXQoZGVjby5pZCk7XG5cdFx0XHRcdGlmIChkZWNvLnJhbmdlLnN0YXJ0Q29sdW1uID4gcG9zaXRpb24uY29sdW1uKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3Qgb3B0cyA9IGRhdGE/LmRlY29yYXRpb24ub3B0aW9uc1tkYXRhLml0ZW0uYW5jaG9yLmRpcmVjdGlvbl07XG5cdFx0XHRcdGlmIChvcHRzICYmIG9wdHMuYXR0YWNoZWREYXRhICE9PSBJbmxheUhpbnRzQ29udHJvbGxlci5fd2hpdGVzcGFjZURhdGEpIHtcblx0XHRcdFx0XHRjb25zdCBsZW4gPSBsZW5ndGhzLmdldChkYXRhLml0ZW0pID8/IDA7XG5cdFx0XHRcdFx0bGVuZ3Rocy5zZXQoZGF0YS5pdGVtLCBsZW4gKyBvcHRzLmNvbnRlbnQubGVuZ3RoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cblx0XHRcdC8vIG9uIHRoZSBjdXJzb3IgbGluZSBhbmQgYmVmb3JlIHRoZSBjdXJzb3ItY29sdW1uXG5cdFx0XHRjb25zdCBuZXdJdGVtc1dpdGhGaXhlZExlbmd0aCA9IGl0ZW1zLmZpbHRlcihpdGVtID0+IGl0ZW0uYW5jaG9yLnJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gcG9zaXRpb24ubGluZU51bWJlciAmJiBpdGVtLmFuY2hvci5yYW5nZS5lbmRDb2x1bW4gPD0gcG9zaXRpb24uY29sdW1uKTtcblx0XHRcdGNvbnN0IGZpeGVkTGVuZ3RocyA9IEFycmF5LmZyb20obGVuZ3Rocy52YWx1ZXMoKSk7XG5cblx0XHRcdC8vIG1hdGNoIHVwIGZpeGVkIGxlbmd0aHMgd2l0aCBpdGVtcyBhbmQgZGlzdHJpYnV0ZSB0aGUgcmVtYWluaW5nIGxlbmd0aHMgdG8gdGhlIGxhc3QgaXRlbVxuXHRcdFx0bGV0IGxhc3RJdGVtOiBJbmxheUhpbnRJdGVtIHwgdW5kZWZpbmVkO1xuXHRcdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdFx0Y29uc3QgdGFyZ2V0SXRlbSA9IG5ld0l0ZW1zV2l0aEZpeGVkTGVuZ3RoLnNoaWZ0KCk7XG5cdFx0XHRcdGNvbnN0IGZpeGVkTGVuZ3RoID0gZml4ZWRMZW5ndGhzLnNoaWZ0KCk7XG5cblx0XHRcdFx0aWYgKCFmaXhlZExlbmd0aCAmJiAhdGFyZ2V0SXRlbSkge1xuXHRcdFx0XHRcdGJyZWFrOyAvLyBET05FXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGFyZ2V0SXRlbSkge1xuXHRcdFx0XHRcdGl0ZW1GaXhlZExlbmd0aHMuc2V0KHRhcmdldEl0ZW0sIGZpeGVkTGVuZ3RoID8/IDApO1xuXHRcdFx0XHRcdGxhc3RJdGVtID0gdGFyZ2V0SXRlbTtcblxuXHRcdFx0XHR9IGVsc2UgaWYgKGxhc3RJdGVtICYmIGZpeGVkTGVuZ3RoKSB7XG5cdFx0XHRcdFx0Ly8gc3RpbGwgbGVuZ3RocyBidXQgbm8gbW9yZSBpdGVtLiBnaXZlIGl0IGFsbCB0byB0aGUgbGFzdFxuXHRcdFx0XHRcdGxldCBsZW4gPSBpdGVtRml4ZWRMZW5ndGhzLmdldChsYXN0SXRlbSkhO1xuXHRcdFx0XHRcdGxlbiArPSBmaXhlZExlbmd0aDtcblx0XHRcdFx0XHRsZW4gKz0gZml4ZWRMZW5ndGhzLnJlZHVjZSgocCwgYykgPT4gcCArIGMsIDApO1xuXHRcdFx0XHRcdGZpeGVkTGVuZ3Rocy5sZW5ndGggPSAwO1xuXHRcdFx0XHRcdGJyZWFrOyAvLyBET05FXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyB1dGlscyB0byBjb2xsZWN0L2NyZWF0ZSBpbmplY3RlZCB0ZXh0IGRlY29yYXRpb25zXG5cdFx0Y29uc3QgbmV3RGVjb3JhdGlvbnNEYXRhOiBJbmxheUhpbnREZWNvcmF0aW9uUmVuZGVySW5mb1tdID0gW107XG5cdFx0Y29uc3QgYWRkSW5qZWN0ZWRUZXh0ID0gKGl0ZW06IElubGF5SGludEl0ZW0sIHJlZjogQ2xhc3NOYW1lUmVmZXJlbmNlLCBjb250ZW50OiBzdHJpbmcsIGN1cnNvclN0b3BzOiBJbmplY3RlZFRleHRDdXJzb3JTdG9wcywgYXR0YWNoZWREYXRhPzogUmVuZGVyZWRJbmxheUhpbnRMYWJlbFBhcnQgfCBvYmplY3QpOiB2b2lkID0+IHtcblx0XHRcdGNvbnN0IG9wdHM6IEluamVjdGVkVGV4dE9wdGlvbnMgPSB7XG5cdFx0XHRcdGNvbnRlbnQsXG5cdFx0XHRcdGlubGluZUNsYXNzTmFtZUFmZmVjdHNMZXR0ZXJTcGFjaW5nOiB0cnVlLFxuXHRcdFx0XHRpbmxpbmVDbGFzc05hbWU6IHJlZi5jbGFzc05hbWUsXG5cdFx0XHRcdGN1cnNvclN0b3BzLFxuXHRcdFx0XHRhdHRhY2hlZERhdGFcblx0XHRcdH07XG5cdFx0XHRuZXdEZWNvcmF0aW9uc0RhdGEucHVzaCh7XG5cdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdGNsYXNzTmFtZVJlZjogcmVmLFxuXHRcdFx0XHRkZWNvcmF0aW9uOiB7XG5cdFx0XHRcdFx0cmFuZ2U6IGl0ZW0uYW5jaG9yLnJhbmdlLFxuXHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdC8vIGNsYXNzTmFtZTogXCJyYW5nZUhpZ2hsaWdodFwiLCAvLyBERUJVRyBoaWdobGlnaHQgdG8gc2VlIHRvIHdoYXQgcmFuZ2UgYSBoaW50IGlzIGF0dGFjaGVkXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ0lubGF5SGludCcsXG5cdFx0XHRcdFx0XHRzaG93SWZDb2xsYXBzZWQ6IGl0ZW0uYW5jaG9yLnJhbmdlLmlzRW1wdHkoKSwgLy8gXCJvcmlnaW5hbFwiIHJhbmdlIGlzIGVtcHR5XG5cdFx0XHRcdFx0XHRjb2xsYXBzZU9uUmVwbGFjZUVkaXQ6ICFpdGVtLmFuY2hvci5yYW5nZS5pc0VtcHR5KCksXG5cdFx0XHRcdFx0XHRzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsXG5cdFx0XHRcdFx0XHRbaXRlbS5hbmNob3IuZGlyZWN0aW9uXTogdGhpcy5fYWN0aXZlUmVuZGVyTW9kZSA9PT0gUmVuZGVyTW9kZS5Ob3JtYWwgPyBvcHRzIDogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgYWRkSW5qZWN0ZWRXaGl0ZXNwYWNlID0gKGl0ZW06IElubGF5SGludEl0ZW0sIGlzTGFzdDogYm9vbGVhbik6IHZvaWQgPT4ge1xuXHRcdFx0Y29uc3QgbWFyZ2luUnVsZSA9IHRoaXMuX3J1bGVGYWN0b3J5LmNyZWF0ZUNsYXNzTmFtZVJlZih7XG5cdFx0XHRcdHdpZHRoOiBgJHsoZm9udFNpemUgLyAzKSB8IDB9cHhgLFxuXHRcdFx0XHRkaXNwbGF5OiAnaW5saW5lLWJsb2NrJ1xuXHRcdFx0fSk7XG5cdFx0XHRhZGRJbmplY3RlZFRleHQoaXRlbSwgbWFyZ2luUnVsZSwgJ1xcdTIwMGEnLCBpc0xhc3QgPyBJbmplY3RlZFRleHRDdXJzb3JTdG9wcy5SaWdodCA6IEluamVjdGVkVGV4dEN1cnNvclN0b3BzLk5vbmUsIElubGF5SGludHNDb250cm9sbGVyLl93aGl0ZXNwYWNlRGF0YSk7XG5cdFx0fTtcblxuXG5cdFx0Ly9cblx0XHRjb25zdCB7IGZvbnRTaXplLCBmb250RmFtaWx5LCBwYWRkaW5nLCBpc1VuaWZvcm0gfSA9IHRoaXMuX2dldExheW91dEluZm8oKTtcblx0XHRjb25zdCBtYXhMZW5ndGggPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5pbmxheUhpbnRzKS5tYXhpbXVtTGVuZ3RoO1xuXHRcdGNvbnN0IGZvbnRGYW1pbHlWYXIgPSAnLS1jb2RlLWVkaXRvcklubGF5SGludHNGb250RmFtaWx5Jztcblx0XHR0aGlzLl9lZGl0b3IuZ2V0Q29udGFpbmVyRG9tTm9kZSgpLnN0eWxlLnNldFByb3BlcnR5KGZvbnRGYW1pbHlWYXIsIGZvbnRGYW1pbHkpO1xuXG5cblx0XHR0eXBlIElMaW5lSW5mbyA9IHsgbGluZTogbnVtYmVyOyB0b3RhbExlbjogbnVtYmVyIH07XG5cdFx0bGV0IGN1cnJlbnRMaW5lSW5mbzogSUxpbmVJbmZvID0geyBsaW5lOiAwLCB0b3RhbExlbjogMCB9O1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgaXRlbSA9IGl0ZW1zW2ldO1xuXG5cdFx0XHRpZiAoY3VycmVudExpbmVJbmZvLmxpbmUgIT09IGl0ZW0uYW5jaG9yLnJhbmdlLnN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0XHRjdXJyZW50TGluZUluZm8gPSB7IGxpbmU6IGl0ZW0uYW5jaG9yLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgdG90YWxMZW46IDAgfTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG1heExlbmd0aCAmJiBjdXJyZW50TGluZUluZm8udG90YWxMZW4gPiBtYXhMZW5ndGgpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHdoaXRlc3BhY2UgbGVhZGluZyB0aGUgYWN0dWFsIGxhYmVsXG5cdFx0XHRpZiAoaXRlbS5oaW50LnBhZGRpbmdMZWZ0KSB7XG5cdFx0XHRcdGFkZEluamVjdGVkV2hpdGVzcGFjZShpdGVtLCBmYWxzZSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHRoZSBsYWJlbCB3aXRoIGl0cyBwYXJ0c1xuXHRcdFx0Y29uc3QgcGFydHM6IGxhbmd1YWdlcy5JbmxheUhpbnRMYWJlbFBhcnRbXSA9IHR5cGVvZiBpdGVtLmhpbnQubGFiZWwgPT09ICdzdHJpbmcnXG5cdFx0XHRcdD8gW3sgbGFiZWw6IGl0ZW0uaGludC5sYWJlbCB9XVxuXHRcdFx0XHQ6IGl0ZW0uaGludC5sYWJlbDtcblxuXHRcdFx0Y29uc3QgaXRlbUZpeGVkTGVuZ3RoID0gaXRlbUZpeGVkTGVuZ3Rocy5nZXQoaXRlbSk7XG5cdFx0XHRsZXQgaXRlbUFjdHVhbExlbmd0aCA9IDA7XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgcGFydCA9IHBhcnRzW2ldO1xuXG5cdFx0XHRcdGNvbnN0IGlzRmlyc3QgPSBpID09PSAwO1xuXHRcdFx0XHRjb25zdCBpc0xhc3QgPSBpID09PSBwYXJ0cy5sZW5ndGggLSAxO1xuXG5cdFx0XHRcdGNvbnN0IGNzc1Byb3BlcnRpZXM6IENzc1Byb3BlcnRpZXMgPSB7XG5cdFx0XHRcdFx0Zm9udFNpemU6IGAke2ZvbnRTaXplfXB4YCxcblx0XHRcdFx0XHRmb250RmFtaWx5OiBgdmFyKCR7Zm9udEZhbWlseVZhcn0pLCAke0VESVRPUl9GT05UX0RFRkFVTFRTLmZvbnRGYW1pbHl9YCxcblx0XHRcdFx0XHR2ZXJ0aWNhbEFsaWduOiBpc1VuaWZvcm0gPyAnYmFzZWxpbmUnIDogJ21pZGRsZScsXG5cdFx0XHRcdFx0dW5pY29kZUJpZGk6ICdpc29sYXRlJ1xuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdGlmIChpc05vbkVtcHR5QXJyYXkoaXRlbS5oaW50LnRleHRFZGl0cykpIHtcblx0XHRcdFx0XHRjc3NQcm9wZXJ0aWVzLmN1cnNvciA9ICdkZWZhdWx0Jztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX2ZpbGxJbkNvbG9ycyhjc3NQcm9wZXJ0aWVzLCBpdGVtLmhpbnQpO1xuXG5cdFx0XHRcdGlmICgocGFydC5jb21tYW5kIHx8IHBhcnQubG9jYXRpb24pICYmIHRoaXMuX2FjdGl2ZUlubGF5SGludFBhcnQ/LnBhcnQuaXRlbSA9PT0gaXRlbSAmJiB0aGlzLl9hY3RpdmVJbmxheUhpbnRQYXJ0LnBhcnQuaW5kZXggPT09IGkpIHtcblx0XHRcdFx0XHQvLyBhY3RpdmUgbGluayFcblx0XHRcdFx0XHRjc3NQcm9wZXJ0aWVzLnRleHREZWNvcmF0aW9uID0gJ3VuZGVybGluZSc7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX2FjdGl2ZUlubGF5SGludFBhcnQuaGFzVHJpZ2dlck1vZGlmaWVyKSB7XG5cdFx0XHRcdFx0XHRjc3NQcm9wZXJ0aWVzLmNvbG9yID0gdGhlbWVDb2xvckZyb21JZChjb2xvcnMuZWRpdG9yQWN0aXZlTGlua0ZvcmVncm91bmQpO1xuXHRcdFx0XHRcdFx0Y3NzUHJvcGVydGllcy5jdXJzb3IgPSAncG9pbnRlcic7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGV0IHRleHRsYWJlbCA9IHBhcnQubGFiZWw7XG5cdFx0XHRcdGN1cnJlbnRMaW5lSW5mby50b3RhbExlbiArPSB0ZXh0bGFiZWwubGVuZ3RoO1xuXHRcdFx0XHRsZXQgdG9vTG9uZyA9IGZhbHNlO1xuXHRcdFx0XHRjb25zdCBvdmVyID0gbWF4TGVuZ3RoICE9PSAwID8gKGN1cnJlbnRMaW5lSW5mby50b3RhbExlbiAtIG1heExlbmd0aCkgOiAwO1xuXHRcdFx0XHRpZiAob3ZlciA+IDApIHtcblx0XHRcdFx0XHR0ZXh0bGFiZWwgPSB0ZXh0bGFiZWwuc2xpY2UoMCwgLW92ZXIpICsgJ1x1MjAyNic7XG5cdFx0XHRcdFx0dG9vTG9uZyA9IHRydWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpdGVtQWN0dWFsTGVuZ3RoICs9IHRleHRsYWJlbC5sZW5ndGg7XG5cblx0XHRcdFx0aWYgKGl0ZW1GaXhlZExlbmd0aCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y29uc3Qgb3ZlckZpeGVkTGVuZ3RoID0gaXRlbUFjdHVhbExlbmd0aCAtIGl0ZW1GaXhlZExlbmd0aDtcblx0XHRcdFx0XHRpZiAob3ZlckZpeGVkTGVuZ3RoID49IDApIHtcblx0XHRcdFx0XHRcdC8vIGxvbmdlciB0aGFuIGZpeGVkIGxlbmd0aCwgdHJpbVxuXHRcdFx0XHRcdFx0aXRlbUFjdHVhbExlbmd0aCAtPSBvdmVyRml4ZWRMZW5ndGg7XG5cdFx0XHRcdFx0XHR0ZXh0bGFiZWwgPSB0ZXh0bGFiZWwuc2xpY2UoMCwgLSgxICsgb3ZlckZpeGVkTGVuZ3RoKSkgKyAnXHUyMDI2Jztcblx0XHRcdFx0XHRcdHRvb0xvbmcgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChwYWRkaW5nKSB7XG5cdFx0XHRcdFx0aWYgKGlzRmlyc3QgJiYgKGlzTGFzdCB8fCB0b29Mb25nKSkge1xuXHRcdFx0XHRcdFx0Ly8gb25seSBlbGVtZW50XG5cdFx0XHRcdFx0XHRjc3NQcm9wZXJ0aWVzLnBhZGRpbmcgPSBgMXB4ICR7TWF0aC5tYXgoMSwgZm9udFNpemUgLyA0KSB8IDB9cHhgO1xuXHRcdFx0XHRcdFx0Y3NzUHJvcGVydGllcy5ib3JkZXJSYWRpdXMgPSBgJHsoZm9udFNpemUgLyA0KSB8IDB9cHhgO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoaXNGaXJzdCkge1xuXHRcdFx0XHRcdFx0Ly8gZmlyc3QgZWxlbWVudFxuXHRcdFx0XHRcdFx0Y3NzUHJvcGVydGllcy5wYWRkaW5nID0gYDFweCAwIDFweCAke01hdGgubWF4KDEsIGZvbnRTaXplIC8gNCkgfCAwfXB4YDtcblx0XHRcdFx0XHRcdGNzc1Byb3BlcnRpZXMuYm9yZGVyUmFkaXVzID0gYCR7KGZvbnRTaXplIC8gNCkgfCAwfXB4IDAgMCAkeyhmb250U2l6ZSAvIDQpIHwgMH1weGA7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICgoaXNMYXN0IHx8IHRvb0xvbmcpKSB7XG5cdFx0XHRcdFx0XHQvLyBsYXN0IGVsZW1lbnRcblx0XHRcdFx0XHRcdGNzc1Byb3BlcnRpZXMucGFkZGluZyA9IGAxcHggJHtNYXRoLm1heCgxLCBmb250U2l6ZSAvIDQpIHwgMH1weCAxcHggMGA7XG5cdFx0XHRcdFx0XHRjc3NQcm9wZXJ0aWVzLmJvcmRlclJhZGl1cyA9IGAwICR7KGZvbnRTaXplIC8gNCkgfCAwfXB4ICR7KGZvbnRTaXplIC8gNCkgfCAwfXB4IDBgO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjc3NQcm9wZXJ0aWVzLnBhZGRpbmcgPSBgMXB4IDAgMXB4IDBgO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGFkZEluamVjdGVkVGV4dChcblx0XHRcdFx0XHRpdGVtLFxuXHRcdFx0XHRcdHRoaXMuX3J1bGVGYWN0b3J5LmNyZWF0ZUNsYXNzTmFtZVJlZihjc3NQcm9wZXJ0aWVzKSxcblx0XHRcdFx0XHRmaXhTcGFjZSh0ZXh0bGFiZWwpLFxuXHRcdFx0XHRcdGlzTGFzdCAmJiAhaXRlbS5oaW50LnBhZGRpbmdSaWdodCA/IEluamVjdGVkVGV4dEN1cnNvclN0b3BzLlJpZ2h0IDogSW5qZWN0ZWRUZXh0Q3Vyc29yU3RvcHMuTm9uZSxcblx0XHRcdFx0XHRuZXcgUmVuZGVyZWRJbmxheUhpbnRMYWJlbFBhcnQoaXRlbSwgaSlcblx0XHRcdFx0KTtcblxuXHRcdFx0XHRpZiAodG9vTG9uZykge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpdGVtRml4ZWRMZW5ndGggIT09IHVuZGVmaW5lZCAmJiBpdGVtQWN0dWFsTGVuZ3RoIDwgaXRlbUZpeGVkTGVuZ3RoKSB7XG5cdFx0XHRcdC8vIHNob3J0ZXIgdGhhbiBmaXhlZCBsZW5ndGgsIHBhZFxuXHRcdFx0XHRjb25zdCBwYWQgPSAoaXRlbUZpeGVkTGVuZ3RoIC0gaXRlbUFjdHVhbExlbmd0aCk7XG5cdFx0XHRcdGFkZEluamVjdGVkVGV4dChcblx0XHRcdFx0XHRpdGVtLFxuXHRcdFx0XHRcdHRoaXMuX3J1bGVGYWN0b3J5LmNyZWF0ZUNsYXNzTmFtZVJlZih7fSksXG5cdFx0XHRcdFx0J1xcdTIwMGEnLnJlcGVhdChwYWQpLFxuXHRcdFx0XHRcdEluamVjdGVkVGV4dEN1cnNvclN0b3BzLk5vbmVcblx0XHRcdFx0KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gd2hpdGVzcGFjZSB0cmFpbGluZyB0aGUgYWN0dWFsIGxhYmVsXG5cdFx0XHRpZiAoaXRlbS5oaW50LnBhZGRpbmdSaWdodCkge1xuXHRcdFx0XHRhZGRJbmplY3RlZFdoaXRlc3BhY2UoaXRlbSwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChuZXdEZWNvcmF0aW9uc0RhdGEubGVuZ3RoID4gSW5sYXlIaW50c0NvbnRyb2xsZXIuX01BWF9ERUNPUkFUT1JTKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGNvbGxlY3QgYWxsIGRlY29yYXRpb24gaWRzIHRoYXQgYXJlIGFmZmVjdGVkIGJ5IHRoZSByYW5nZXNcblx0XHQvLyBhbmQgb25seSB1cGRhdGUgdGhvc2UgZGVjb3JhdGlvbnNcblx0XHRjb25zdCBkZWNvcmF0aW9uSWRzVG9SZXBsYWNlOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgW2lkLCBtZXRhZGF0YV0gb2YgdGhpcy5fZGVjb3JhdGlvbnNNZXRhZGF0YSkge1xuXHRcdFx0Y29uc3QgcmFuZ2UgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKT8uZ2V0RGVjb3JhdGlvblJhbmdlKGlkKTtcblx0XHRcdGlmIChyYW5nZSAmJiByYW5nZXMuc29tZShyID0+IHIuY29udGFpbnNSYW5nZShyYW5nZSkpKSB7XG5cdFx0XHRcdGRlY29yYXRpb25JZHNUb1JlcGxhY2UucHVzaChpZCk7XG5cdFx0XHRcdG1ldGFkYXRhLmNsYXNzTmFtZVJlZi5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuX2RlY29yYXRpb25zTWV0YWRhdGEuZGVsZXRlKGlkKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBzY3JvbGxTdGF0ZSA9IFN0YWJsZUVkaXRvclNjcm9sbFN0YXRlLmNhcHR1cmUodGhpcy5fZWRpdG9yKTtcblxuXHRcdHRoaXMuX2VkaXRvci5jaGFuZ2VEZWNvcmF0aW9ucyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRjb25zdCBuZXdEZWNvcmF0aW9uSWRzID0gYWNjZXNzb3IuZGVsdGFEZWNvcmF0aW9ucyhkZWNvcmF0aW9uSWRzVG9SZXBsYWNlLCBuZXdEZWNvcmF0aW9uc0RhdGEubWFwKGQgPT4gZC5kZWNvcmF0aW9uKSk7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG5ld0RlY29yYXRpb25JZHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgZGF0YSA9IG5ld0RlY29yYXRpb25zRGF0YVtpXTtcblx0XHRcdFx0dGhpcy5fZGVjb3JhdGlvbnNNZXRhZGF0YS5zZXQobmV3RGVjb3JhdGlvbklkc1tpXSwgZGF0YSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRzY3JvbGxTdGF0ZS5yZXN0b3JlKHRoaXMuX2VkaXRvcik7XG5cdH1cblxuXHRwcml2YXRlIF9maWxsSW5Db2xvcnMocHJvcHM6IENzc1Byb3BlcnRpZXMsIGhpbnQ6IGxhbmd1YWdlcy5JbmxheUhpbnQpOiB2b2lkIHtcblx0XHRpZiAoaGludC5raW5kID09PSBsYW5ndWFnZXMuSW5sYXlIaW50S2luZC5QYXJhbWV0ZXIpIHtcblx0XHRcdHByb3BzLmJhY2tncm91bmRDb2xvciA9IHRoZW1lQ29sb3JGcm9tSWQoY29sb3JzLmVkaXRvcklubGF5SGludFBhcmFtZXRlckJhY2tncm91bmQpO1xuXHRcdFx0cHJvcHMuY29sb3IgPSB0aGVtZUNvbG9yRnJvbUlkKGNvbG9ycy5lZGl0b3JJbmxheUhpbnRQYXJhbWV0ZXJGb3JlZ3JvdW5kKTtcblx0XHR9IGVsc2UgaWYgKGhpbnQua2luZCA9PT0gbGFuZ3VhZ2VzLklubGF5SGludEtpbmQuVHlwZSkge1xuXHRcdFx0cHJvcHMuYmFja2dyb3VuZENvbG9yID0gdGhlbWVDb2xvckZyb21JZChjb2xvcnMuZWRpdG9ySW5sYXlIaW50VHlwZUJhY2tncm91bmQpO1xuXHRcdFx0cHJvcHMuY29sb3IgPSB0aGVtZUNvbG9yRnJvbUlkKGNvbG9ycy5lZGl0b3JJbmxheUhpbnRUeXBlRm9yZWdyb3VuZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHByb3BzLmJhY2tncm91bmRDb2xvciA9IHRoZW1lQ29sb3JGcm9tSWQoY29sb3JzLmVkaXRvcklubGF5SGludEJhY2tncm91bmQpO1xuXHRcdFx0cHJvcHMuY29sb3IgPSB0aGVtZUNvbG9yRnJvbUlkKGNvbG9ycy5lZGl0b3JJbmxheUhpbnRGb3JlZ3JvdW5kKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRMYXlvdXRJbmZvKCkge1xuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5pbmxheUhpbnRzKTtcblx0XHRjb25zdCBwYWRkaW5nID0gb3B0aW9ucy5wYWRkaW5nO1xuXG5cdFx0Y29uc3QgZWRpdG9yRm9udFNpemUgPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250U2l6ZSk7XG5cdFx0Y29uc3QgZWRpdG9yRm9udEZhbWlseSA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZvbnRGYW1pbHkpO1xuXG5cdFx0bGV0IGZvbnRTaXplID0gb3B0aW9ucy5mb250U2l6ZTtcblx0XHRpZiAoIWZvbnRTaXplIHx8IGZvbnRTaXplIDwgNSB8fCBmb250U2l6ZSA+IGVkaXRvckZvbnRTaXplKSB7XG5cdFx0XHRmb250U2l6ZSA9IGVkaXRvckZvbnRTaXplO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvbnRGYW1pbHkgPSBvcHRpb25zLmZvbnRGYW1pbHkgfHwgZWRpdG9yRm9udEZhbWlseTtcblxuXHRcdGNvbnN0IGlzVW5pZm9ybSA9ICFwYWRkaW5nXG5cdFx0XHQmJiBmb250RmFtaWx5ID09PSBlZGl0b3JGb250RmFtaWx5XG5cdFx0XHQmJiBmb250U2l6ZSA9PT0gZWRpdG9yRm9udFNpemU7XG5cblx0XHRyZXR1cm4geyBmb250U2l6ZSwgZm9udEZhbWlseSwgcGFkZGluZywgaXNVbmlmb3JtIH07XG5cdH1cblxuXHRwcml2YXRlIF9yZW1vdmVBbGxEZWNvcmF0aW9ucygpOiB2b2lkIHtcblx0XHR0aGlzLl9lZGl0b3IucmVtb3ZlRGVjb3JhdGlvbnMoQXJyYXkuZnJvbSh0aGlzLl9kZWNvcmF0aW9uc01ldGFkYXRhLmtleXMoKSkpO1xuXHRcdGZvciAoY29uc3Qgb2JqIG9mIHRoaXMuX2RlY29yYXRpb25zTWV0YWRhdGEudmFsdWVzKCkpIHtcblx0XHRcdG9iai5jbGFzc05hbWVSZWYuZGlzcG9zZSgpO1xuXHRcdH1cblx0XHR0aGlzLl9kZWNvcmF0aW9uc01ldGFkYXRhLmNsZWFyKCk7XG5cdH1cblxuXG5cdC8vIC0tLSBhY2Nlc3NpYmlsaXR5XG5cblx0Z2V0SW5sYXlIaW50c0ZvckxpbmUobGluZTogbnVtYmVyKTogSW5sYXlIaW50SXRlbVtdIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdGNvbnN0IHNldCA9IG5ldyBTZXQ8bGFuZ3VhZ2VzLklubGF5SGludD4oKTtcblx0XHRjb25zdCByZXN1bHQ6IElubGF5SGludEl0ZW1bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZGVjbyBvZiB0aGlzLl9lZGl0b3IuZ2V0TGluZURlY29yYXRpb25zKGxpbmUpKSB7XG5cdFx0XHRjb25zdCBkYXRhID0gdGhpcy5fZGVjb3JhdGlvbnNNZXRhZGF0YS5nZXQoZGVjby5pZCk7XG5cdFx0XHRpZiAoZGF0YSAmJiAhc2V0LmhhcyhkYXRhLml0ZW0uaGludCkpIHtcblx0XHRcdFx0c2V0LmFkZChkYXRhLml0ZW0uaGludCk7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGRhdGEuaXRlbSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuXG4vLyBQcmV2ZW50cyB0aGUgdmlldyBmcm9tIHBvdGVudGlhbGx5IHZpc2libGUgd2hpdGVzcGFjZVxuZnVuY3Rpb24gZml4U3BhY2Uoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRjb25zdCBub0JyZWFrV2hpdGVzcGFjZSA9ICdcXHhhMCc7XG5cdHJldHVybiBzdHIucmVwbGFjZSgvWyBcXHRdL2csIG5vQnJlYWtXaGl0ZXNwYWNlKTtcbn1cblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ19leGVjdXRlSW5sYXlIaW50UHJvdmlkZXInLCBhc3luYyAoYWNjZXNzb3IsIC4uLmFyZ3M6IFtVUkksIElSYW5nZV0pOiBQcm9taXNlPGxhbmd1YWdlcy5JbmxheUhpbnRbXT4gPT4ge1xuXG5cdGNvbnN0IFt1cmksIHJhbmdlXSA9IGFyZ3M7XG5cdGFzc2VydFR5cGUoVVJJLmlzVXJpKHVyaSkpO1xuXHRhc3NlcnRUeXBlKFJhbmdlLmlzSVJhbmdlKHJhbmdlKSk7XG5cblx0Y29uc3QgeyBpbmxheUhpbnRzUHJvdmlkZXIgfSA9IGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRjb25zdCByZWYgPSBhd2FpdCBhY2Nlc3Nvci5nZXQoSVRleHRNb2RlbFNlcnZpY2UpLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKHVyaSk7XG5cdHRyeSB7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCBJbmxheUhpbnRzRnJhZ21lbnRzLmNyZWF0ZShpbmxheUhpbnRzUHJvdmlkZXIsIHJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsLCBbUmFuZ2UubGlmdChyYW5nZSldLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRjb25zdCByZXN1bHQgPSBtb2RlbC5pdGVtcy5tYXAoaSA9PiBpLmhpbnQpO1xuXHRcdHNldFRpbWVvdXQoKCkgPT4gbW9kZWwuZGlzcG9zZSgpLCAwKTsgLy8gZGlzcG9zZSBhZnRlciBzZW5kaW5nIHRvIGV4dCBob3N0XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fSBmaW5hbGx5IHtcblx0XHRyZWYuZGlzcG9zZSgpO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxlQUFlLDBCQUEwQjtBQUNsRCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLG1CQUFtQix3QkFBd0I7QUFDcEQsU0FBUyxtQkFBbUIsK0JBQStCO0FBQzNELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsaUJBQThCLG1CQUFtQixvQkFBb0I7QUFDOUUsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxXQUFXO0FBQ3BCLFNBQTRELHVCQUF1QjtBQUNuRixTQUE0Qyx1QkFBdUI7QUFDbkUsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxjQUFjLDRCQUE0QjtBQUNuRCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGFBQWE7QUFFdEIsWUFBWSxlQUFlO0FBQzNCLFNBQWdDLHlCQUEwRCw4QkFBOEI7QUFDeEgsU0FBUywwQ0FBMEM7QUFDbkQsU0FBc0MsdUNBQXVDO0FBQzdFLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsd0JBQTZDO0FBQ3RELFNBQVMsaUJBQWdDLDJCQUEyQjtBQUNwRSxTQUFTLDRCQUE0QiwyQkFBMkI7QUFDaEUsU0FBUyxrQkFBa0IsdUJBQXVCO0FBQ2xELFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLGlCQUFpQiw2QkFBNkI7QUFDdkQsU0FBUyxzQkFBc0IsZ0JBQWdCO0FBQy9DLFlBQVksWUFBWTtBQUN4QixTQUFTLHdCQUF3QjtBQUtqQyxNQUFNLGdCQUFnQjtBQUFBLEVBQXRCO0FBSUMsU0FBaUIsV0FBVyxJQUFJLFNBQWtDLEVBQUU7QUFBQTtBQUFBLEVBRXBFLElBQUksT0FBZ0Q7QUFDbkQsVUFBTSxNQUFNLGdCQUFnQixLQUFLLEtBQUs7QUFDdEMsV0FBTyxLQUFLLFNBQVMsSUFBSSxHQUFHO0FBQUEsRUFDN0I7QUFBQSxFQUVBLElBQUksT0FBbUIsT0FBOEI7QUFDcEQsVUFBTSxNQUFNLGdCQUFnQixLQUFLLEtBQUs7QUFDdEMsU0FBSyxTQUFTLElBQUksS0FBSyxLQUFLO0FBQUEsRUFDN0I7QUFBQSxFQUVBLE9BQWUsS0FBSyxPQUEyQjtBQUM5QyxXQUFPLEdBQUcsTUFBTSxJQUFJLFNBQVMsQ0FBQyxJQUFJLE1BQU0sYUFBYSxDQUFDO0FBQUEsRUFDdkQ7QUFDRDtBQUdBLE1BQU0sbUJBQW1CLGdCQUFrQyxrQkFBa0I7QUFDN0Usa0JBQWtCLGtCQUFrQixpQkFBaUIsa0JBQWtCLE9BQU87QUFJdkUsTUFBTSwyQkFBMkI7QUFBQSxFQUN2QyxZQUFxQixNQUE4QixPQUFlO0FBQTdDO0FBQThCO0FBQUEsRUFBaUI7QUFBQSxFQUVwRSxJQUFJLE9BQU87QUFDVixVQUFNLFFBQVEsS0FBSyxLQUFLLEtBQUs7QUFDN0IsUUFBSSxPQUFPLFVBQVUsVUFBVTtBQUM5QixhQUFPLEVBQUUsTUFBTTtBQUFBLElBQ2hCLE9BQU87QUFDTixhQUFPLE1BQU0sS0FBSyxLQUFLO0FBQUEsSUFDeEI7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxNQUFNLG9CQUFvQjtBQUFBLEVBQ3pCLFlBQXFCLE1BQTJDLG9CQUE2QjtBQUF4RTtBQUEyQztBQUFBLEVBQStCO0FBQ2hHO0FBUUEsSUFBVyxhQUFYLGtCQUFXQSxnQkFBWDtBQUNDLEVBQUFBLHdCQUFBO0FBQ0EsRUFBQUEsd0JBQUE7QUFGVSxTQUFBQTtBQUFBLEdBQUE7QUFPSixJQUFNLHVCQUFOLE1BQTBEO0FBQUEsRUFxQmhFLFlBQ2tCLFNBQzBCLDBCQUNWLGtCQUNFLGtCQUNELGlCQUNLLHNCQUNDLGVBQ3ZDO0FBUGdCO0FBQzBCO0FBRVI7QUFDRDtBQUNLO0FBQ0M7QUFqQnpDLFNBQWlCLGVBQWUsSUFBSSxnQkFBZ0I7QUFDcEQsU0FBaUIsc0JBQXNCLElBQUksZ0JBQWdCO0FBRTNELFNBQWlCLHVCQUF1QixvQkFBSSxJQUEyQztBQUN2RixTQUFpQixlQUFlLElBQUksZ0JBQWdCLEtBQUssT0FBTztBQUdoRSxTQUFRLG9CQUFvQjtBQVkzQixTQUFLLGdCQUFnQixpQkFBaUIsSUFBSSx5QkFBeUIsb0JBQW9CLGFBQWEsRUFBRSxLQUFLLEdBQUcsQ0FBQztBQUMvRyxTQUFLLGFBQWEsSUFBSSx5QkFBeUIsbUJBQW1CLFlBQVksTUFBTSxLQUFLLFFBQVEsQ0FBQyxDQUFDO0FBQ25HLFNBQUssYUFBYSxJQUFJLFFBQVEsaUJBQWlCLE1BQU0sS0FBSyxRQUFRLENBQUMsQ0FBQztBQUNwRSxTQUFLLGFBQWEsSUFBSSxRQUFRLHlCQUF5QixNQUFNLEtBQUssUUFBUSxDQUFDLENBQUM7QUFDNUUsU0FBSyxhQUFhLElBQUksUUFBUSx5QkFBeUIsT0FBSztBQUMzRCxVQUFJLEVBQUUsV0FBVyxhQUFhLFVBQVUsR0FBRztBQUMxQyxhQUFLLFFBQVE7QUFBQSxNQUNkO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFDRixTQUFLLFFBQVE7QUFBQSxFQUVkO0FBQUEsRUFsQ0EsT0FBTyxJQUFJLFFBQXVEO0FBQ2pFLFdBQU8sT0FBTyxnQkFBc0MscUJBQXFCLEVBQUUsS0FBSztBQUFBLEVBQ2pGO0FBQUEsRUFrQ0EsVUFBZ0I7QUFDZixTQUFLLG9CQUFvQixRQUFRO0FBQ2pDLFNBQUssc0JBQXNCO0FBQzNCLFNBQUssYUFBYSxRQUFRO0FBQUEsRUFDM0I7QUFBQSxFQUVRLFVBQWdCO0FBQ3ZCLFNBQUssb0JBQW9CLE1BQU07QUFDL0IsU0FBSyxzQkFBc0I7QUFFM0IsVUFBTSxVQUFVLEtBQUssUUFBUSxVQUFVLGFBQWEsVUFBVTtBQUM5RCxRQUFJLFFBQVEsWUFBWSxPQUFPO0FBQzlCO0FBQUEsSUFDRDtBQUVBLFVBQU0sUUFBUSxLQUFLLFFBQVEsU0FBUztBQUNwQyxRQUFJLENBQUMsU0FBUyxDQUFDLEtBQUsseUJBQXlCLG1CQUFtQixJQUFJLEtBQUssR0FBRztBQUMzRTtBQUFBLElBQ0Q7QUFFQSxRQUFJLFFBQVEsWUFBWSxNQUFNO0FBRTdCLFdBQUssb0JBQW9CO0FBQUEsSUFDMUIsT0FBTztBQUVOLFVBQUk7QUFDSixVQUFJO0FBQ0osVUFBSSxRQUFRLFlBQVksbUJBQW1CO0FBQzFDLHNCQUFjO0FBQ2Qsa0JBQVU7QUFBQSxNQUNYLE9BQU87QUFDTixzQkFBYztBQUNkLGtCQUFVO0FBQUEsTUFDWDtBQUNBLFdBQUssb0JBQW9CO0FBRXpCLFdBQUssb0JBQW9CLElBQUksbUJBQW1CLFlBQVksRUFBRSxNQUFNLE9BQUs7QUFDeEUsWUFBSSxDQUFDLEtBQUssUUFBUSxTQUFTLEdBQUc7QUFDN0I7QUFBQSxRQUNEO0FBQ0EsY0FBTSxnQkFBZ0IsRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLEVBQUUsWUFBWSxFQUFFLFdBQVcsVUFBVTtBQUN0RixZQUFJLGtCQUFrQixLQUFLLG1CQUFtQjtBQUM3QyxlQUFLLG9CQUFvQjtBQUN6QixnQkFBTUMsU0FBUSxLQUFLLFFBQVEsU0FBUztBQUNwQyxnQkFBTSxTQUFTLEtBQUssaUNBQWlDQSxNQUFLO0FBQzFELGVBQUssdUJBQXVCLENBQUNBLE9BQU0sa0JBQWtCLENBQUMsR0FBRyxNQUFNO0FBQy9ELG9CQUFVLFNBQVMsQ0FBQztBQUFBLFFBQ3JCO0FBQUEsTUFDRCxDQUFDLENBQUM7QUFBQSxJQUNIO0FBR0EsVUFBTSxTQUFTLEtBQUssaUJBQWlCLElBQUksS0FBSztBQUM5QyxRQUFJLFFBQVE7QUFDWCxXQUFLLHVCQUF1QixDQUFDLE1BQU0sa0JBQWtCLENBQUMsR0FBRyxNQUFNO0FBQUEsSUFDaEU7QUFDQSxTQUFLLG9CQUFvQixJQUFJLGFBQWEsTUFBTTtBQUUvQyxVQUFJLENBQUMsTUFBTSxXQUFXLEdBQUc7QUFDeEIsYUFBSywwQkFBMEIsS0FBSztBQUFBLE1BQ3JDO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixRQUFJO0FBQ0osVUFBTSxtQkFBbUIsb0JBQUksSUFBa0M7QUFFL0QsVUFBTSxZQUFZLElBQUksaUJBQWlCLFlBQVk7QUFDbEQsWUFBTSxLQUFLLEtBQUssSUFBSTtBQUVwQixXQUFLLFFBQVEsSUFBSTtBQUNqQixZQUFNLElBQUksd0JBQXdCO0FBQ2xDLFlBQU0sV0FBVyxNQUFNLGNBQWMsTUFBTSxLQUFLLE9BQU8sQ0FBQztBQUV4RCxVQUFJO0FBQ0gsY0FBTSxVQUFVLElBQUk7QUFDcEIsY0FBTSxhQUFhLE1BQU0sb0JBQW9CLE9BQU8sS0FBSyx5QkFBeUIsb0JBQW9CLE9BQU8sS0FBSyxnQkFBZ0IsR0FBRyxPQUFPO0FBQzVJLGtCQUFVLFFBQVEsS0FBSyxjQUFjLE9BQU8sT0FBTyxLQUFLLElBQUksSUFBSSxFQUFFO0FBQ2xFLFlBQUksUUFBUSx5QkFBeUI7QUFDcEMscUJBQVcsUUFBUTtBQUNuQjtBQUFBLFFBQ0Q7QUFHQSxtQkFBVyxZQUFZLFdBQVcsVUFBVTtBQUMzQyxjQUFJLE9BQU8sU0FBUywwQkFBMEIsY0FBYyxDQUFDLGlCQUFpQixJQUFJLFFBQVEsR0FBRztBQUM1Riw2QkFBaUIsSUFBSSxRQUFRO0FBQzdCLGlCQUFLLG9CQUFvQixJQUFJLFNBQVMsc0JBQXNCLE1BQU07QUFDakUsa0JBQUksQ0FBQyxVQUFVLFlBQVksR0FBRztBQUM3QiwwQkFBVSxTQUFTO0FBQUEsY0FDcEI7QUFBQSxZQUNELENBQUMsQ0FBQztBQUFBLFVBQ0g7QUFBQSxRQUNEO0FBRUEsYUFBSyxvQkFBb0IsSUFBSSxVQUFVO0FBQ3ZDLGFBQUssdUJBQXVCLFdBQVcsUUFBUSxXQUFXLEtBQUs7QUFDL0QsYUFBSywwQkFBMEIsS0FBSztBQUFBLE1BRXJDLFNBQVMsS0FBSztBQUNiLDBCQUFrQixHQUFHO0FBQUEsTUFFdEIsVUFBRTtBQUNELFlBQUksUUFBUTtBQUNaLGlCQUFTLFFBQVE7QUFBQSxNQUNsQjtBQUFBLElBRUQsR0FBRyxLQUFLLGNBQWMsSUFBSSxLQUFLLENBQUM7QUFFaEMsU0FBSyxvQkFBb0IsSUFBSSxTQUFTO0FBQ3RDLFNBQUssb0JBQW9CLElBQUksYUFBYSxNQUFNLEtBQUssUUFBUSxJQUFJLENBQUMsQ0FBQztBQUNuRSxjQUFVLFNBQVMsQ0FBQztBQUVwQixTQUFLLG9CQUFvQixJQUFJLEtBQUssUUFBUSxrQkFBa0IsQ0FBQyxNQUFNO0FBSWxFLFVBQUksRUFBRSxvQkFBb0IsQ0FBQyxVQUFVLFlBQVksR0FBRztBQUNuRCxrQkFBVSxTQUFTO0FBQUEsTUFDcEI7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFVBQU0sU0FBUyxLQUFLLG9CQUFvQixJQUFJLElBQUksa0JBQWtCLENBQUM7QUFDbkUsU0FBSyxvQkFBb0IsSUFBSSxLQUFLLFFBQVEsd0JBQXdCLENBQUMsTUFBTTtBQUN4RSxXQUFLLE9BQU87QUFHWixZQUFNLFFBQVEsS0FBSyxJQUFJLFVBQVUsT0FBTyxHQUFHO0FBQzNDLFdBQUssY0FBYyxFQUFFLFVBQVUsS0FBSyxRQUFRLFlBQVksR0FBSSxnQkFBZ0IsS0FBSyxJQUFJLElBQUksTUFBTTtBQUMvRixhQUFPLFFBQVEsa0JBQWtCLE1BQU0sVUFBVSxTQUFTLENBQUMsR0FBRyxLQUFLO0FBRW5FLGdCQUFVLFNBQVM7QUFBQSxJQUNwQixDQUFDLENBQUM7QUFFRixTQUFLLG9CQUFvQixJQUFJLEtBQUssUUFBUSx5QkFBeUIsT0FBSztBQUN2RSxVQUFJLEVBQUUsV0FBVyxhQUFhLFVBQVUsR0FBRztBQUMxQyxrQkFBVSxTQUFTO0FBQUEsTUFDcEI7QUFBQSxJQUNELENBQUMsQ0FBQztBQUdGLFNBQUssb0JBQW9CLElBQUksS0FBSyx3QkFBd0IsTUFBTSxVQUFVLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDdEYsU0FBSyxvQkFBb0IsSUFBSSxLQUFLLG9CQUFvQixDQUFDO0FBQ3ZELFNBQUssb0JBQW9CLElBQUksS0FBSyxvQkFBb0IsQ0FBQztBQUFBLEVBQ3hEO0FBQUEsRUFFUSxzQkFBbUM7QUFFMUMsVUFBTSxRQUFRLElBQUksZ0JBQWdCO0FBQ2xDLFVBQU0sVUFBVSxNQUFNLElBQUksSUFBSSxpQkFBaUIsS0FBSyxPQUFPLENBQUM7QUFJNUQsVUFBTSxlQUFlLElBQUksZ0JBQWdCO0FBQ3pDLFVBQU0sSUFBSSxZQUFZO0FBRXRCLFVBQU0sSUFBSSxRQUFRLDZCQUE2QixPQUFLO0FBQ25ELFlBQU0sQ0FBQyxVQUFVLElBQUk7QUFDckIsWUFBTSxZQUFZLEtBQUssdUJBQXVCLFVBQVU7QUFDeEQsWUFBTSxRQUFRLEtBQUssUUFBUSxTQUFTO0FBRXBDLFVBQUksQ0FBQyxhQUFhLENBQUMsT0FBTztBQUN6QixxQkFBYSxNQUFNO0FBQ25CO0FBQUEsTUFDRDtBQUdBLFlBQU0sTUFBTSxJQUFJLHdCQUF3QjtBQUN4QyxtQkFBYSxJQUFJLGFBQWEsTUFBTSxJQUFJLFFBQVEsSUFBSSxDQUFDLENBQUM7QUFDdEQsZ0JBQVUsS0FBSyxRQUFRLElBQUksS0FBSztBQUdoQyxXQUFLLHVCQUF1QixVQUFVLEtBQUssV0FBVyxVQUFVLEtBQUssV0FDbEUsSUFBSSxvQkFBb0IsV0FBVyxXQUFXLGtCQUFrQixJQUNoRTtBQUVILFlBQU0sYUFBYSxNQUFNLGlCQUFpQixVQUFVLEtBQUssS0FBSyxRQUFRLEVBQUU7QUFDeEUsWUFBTSxRQUFRLElBQUksTUFBTSxZQUFZLEdBQUcsWUFBWSxNQUFNLGlCQUFpQixVQUFVLENBQUM7QUFDckYsWUFBTSxZQUFZLEtBQUssd0JBQXdCLEtBQUs7QUFDcEQsV0FBSyx1QkFBdUIsQ0FBQyxLQUFLLEdBQUcsU0FBUztBQUM5QyxtQkFBYSxJQUFJLGFBQWEsTUFBTTtBQUNuQyxhQUFLLHVCQUF1QjtBQUM1QixhQUFLLHVCQUF1QixDQUFDLEtBQUssR0FBRyxTQUFTO0FBQUEsTUFDL0MsQ0FBQyxDQUFDO0FBQUEsSUFDSCxDQUFDLENBQUM7QUFDRixVQUFNLElBQUksUUFBUSxTQUFTLE1BQU0sYUFBYSxNQUFNLENBQUMsQ0FBQztBQUN0RCxVQUFNLElBQUksUUFBUSxVQUFVLE9BQU0sTUFBSztBQUN0QyxZQUFNLFFBQVEsS0FBSyx1QkFBdUIsQ0FBQztBQUMzQyxVQUFJLE9BQU87QUFDVixjQUFNLE9BQU8sTUFBTTtBQUNuQixZQUFJLEtBQUssVUFBVTtBQUVsQixlQUFLLGNBQWMsZUFBZSw0QkFBNEIsR0FBRyxLQUFLLFNBQThCLEtBQUssUUFBUTtBQUFBLFFBQ2xILFdBQVcsVUFBVSxRQUFRLEdBQUcsS0FBSyxPQUFPLEdBQUc7QUFFOUMsZ0JBQU0sS0FBSyxlQUFlLEtBQUssU0FBUyxNQUFNLElBQUk7QUFBQSxRQUNuRDtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUMsQ0FBQztBQUNGLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSx3QkFBd0IsT0FBYztBQUM3QyxVQUFNLFlBQVksb0JBQUksSUFBbUI7QUFDekMsZUFBVyxRQUFRLEtBQUsscUJBQXFCLE9BQU8sR0FBRztBQUN0RCxVQUFJLE1BQU0sY0FBYyxLQUFLLEtBQUssT0FBTyxLQUFLLEdBQUc7QUFDaEQsa0JBQVUsSUFBSSxLQUFLLElBQUk7QUFBQSxNQUN4QjtBQUFBLElBQ0Q7QUFDQSxXQUFPLE1BQU0sS0FBSyxTQUFTO0FBQUEsRUFDNUI7QUFBQSxFQUVRLHdCQUF3QixrQkFBeUM7QUFDeEUsV0FBTyxLQUFLLFFBQVEsVUFBVSxPQUFNLE1BQUs7QUFDeEMsVUFBSSxFQUFFLE1BQU0sV0FBVyxHQUFHO0FBQ3pCO0FBQUEsTUFDRDtBQUNBLFlBQU0sT0FBTyxLQUFLLHVCQUF1QixDQUFDO0FBQzFDLFVBQUksQ0FBQyxNQUFNO0FBQ1Y7QUFBQSxNQUNEO0FBQ0EsUUFBRSxNQUFNLGVBQWU7QUFDdkIsWUFBTSxLQUFLLEtBQUssUUFBUSxrQkFBa0IsSUFBSTtBQUM5QyxVQUFJLGdCQUFnQixLQUFLLEtBQUssS0FBSyxTQUFTLEdBQUc7QUFDOUMsY0FBTSxRQUFRLEtBQUssS0FBSyxLQUFLLFVBQVUsSUFBSSxVQUFRLGNBQWMsUUFBUSxNQUFNLEtBQUssS0FBSyxLQUFLLEdBQUcsS0FBSyxJQUFJLENBQUM7QUFDM0csYUFBSyxRQUFRLGFBQWEscUJBQXFCLEtBQUs7QUFDcEQseUJBQWlCO0FBQUEsTUFDbEI7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFUSxzQkFBbUM7QUFDMUMsV0FBTyxLQUFLLFFBQVEsY0FBYyxPQUFNLE1BQUs7QUFDNUMsVUFBSSxDQUFFLGNBQWMsRUFBRSxNQUFNLE1BQU0sR0FBSTtBQUNyQztBQUFBLE1BQ0Q7QUFDQSxZQUFNLE9BQU8sS0FBSyx1QkFBdUIsQ0FBQztBQUMxQyxVQUFJLE1BQU07QUFDVCxjQUFNLEtBQUssY0FBYyxlQUFlLHFCQUFxQixLQUFLLFNBQVMsRUFBRSxNQUFNLFFBQVEsSUFBSTtBQUFBLE1BQ2hHO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRVEsdUJBQXVCLEdBQW9GO0FBQ2xILFFBQUksRUFBRSxPQUFPLFNBQVMsZ0JBQWdCLGNBQWM7QUFDbkQsYUFBTztBQUFBLElBQ1I7QUFDQSxVQUFNLFVBQVUsRUFBRSxPQUFPLE9BQU8sY0FBYztBQUM5QyxRQUFJLG1CQUFtQixzQ0FBc0MsU0FBUyx3QkFBd0IsNEJBQTRCO0FBQ3pILGFBQU8sUUFBUTtBQUFBLElBQ2hCO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWMsZUFBZSxTQUE0QixNQUFxQjtBQUM3RSxRQUFJO0FBQ0gsWUFBTSxLQUFLLGdCQUFnQixlQUFlLFFBQVEsSUFBSSxHQUFJLFFBQVEsYUFBYSxDQUFDLENBQUU7QUFBQSxJQUNuRixTQUFTLEtBQUs7QUFDYixXQUFLLHFCQUFxQixPQUFPO0FBQUEsUUFDaEMsVUFBVSxTQUFTO0FBQUEsUUFDbkIsUUFBUSxLQUFLLFNBQVM7QUFBQSxRQUN0QixTQUFTO0FBQUEsTUFDVixDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLDBCQUEwQixPQUF5QjtBQUMxRCxVQUFNLFFBQVEsS0FBSyxpQ0FBaUMsS0FBSztBQUN6RCxTQUFLLGlCQUFpQixJQUFJLE9BQU8sS0FBSztBQUFBLEVBQ3ZDO0FBQUE7QUFBQTtBQUFBLEVBSVEsaUNBQWlDLE9BQW9DO0FBQzVFLFVBQU0sUUFBUSxvQkFBSSxJQUFrQztBQUNwRCxlQUFXLENBQUMsSUFBSSxHQUFHLEtBQUssS0FBSyxzQkFBc0I7QUFDbEQsVUFBSSxNQUFNLElBQUksSUFBSSxJQUFJLEdBQUc7QUFHeEI7QUFBQSxNQUNEO0FBQ0EsWUFBTSxRQUFRLE1BQU0sbUJBQW1CLEVBQUU7QUFDekMsVUFBSSxPQUFPO0FBRVYsY0FBTSxTQUFTLElBQUksZ0JBQWdCLE9BQU8sSUFBSSxLQUFLLE9BQU8sU0FBUztBQUNuRSxjQUFNLE9BQU8sSUFBSSxLQUFLLEtBQUssRUFBRSxPQUFPLENBQUM7QUFDckMsY0FBTSxJQUFJLElBQUksTUFBTSxJQUFJO0FBQUEsTUFDekI7QUFBQSxJQUNEO0FBQ0EsV0FBTyxNQUFNLEtBQUssTUFBTSxPQUFPLENBQUM7QUFBQSxFQUNqQztBQUFBLEVBRVEsa0JBQTJCO0FBQ2xDLFVBQU0sUUFBUTtBQUNkLFVBQU0sUUFBUSxLQUFLLFFBQVEsU0FBUztBQUNwQyxVQUFNLGdCQUFnQixLQUFLLFFBQVEsdUNBQXVDO0FBQzFFLFVBQU0sU0FBa0IsQ0FBQztBQUN6QixlQUFXLFNBQVMsY0FBYyxLQUFLLE1BQU0sd0JBQXdCLEdBQUc7QUFDdkUsWUFBTSxnQkFBZ0IsTUFBTSxjQUFjLElBQUksTUFBTSxNQUFNLGtCQUFrQixPQUFPLE1BQU0sYUFBYSxNQUFNLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDO0FBQ25KLFVBQUksT0FBTyxXQUFXLEtBQUssQ0FBQyxNQUFNLDBCQUEwQixPQUFPLE9BQU8sU0FBUyxDQUFDLEdBQUcsYUFBYSxHQUFHO0FBQ3RHLGVBQU8sS0FBSyxhQUFhO0FBQUEsTUFDMUIsT0FBTztBQUNOLGVBQU8sT0FBTyxTQUFTLENBQUMsSUFBSSxNQUFNLFVBQVUsT0FBTyxPQUFPLFNBQVMsQ0FBQyxHQUFHLGFBQWE7QUFBQSxNQUNyRjtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsdUJBQXVCLFFBQTBCLE9BQXVDO0FBRS9GLFVBQU0sbUJBQW1CLG9CQUFJLElBQTJCO0FBRXhELFFBQUksS0FBSyxlQUNMLEtBQUssWUFBWSxpQkFBaUIsS0FBSyxJQUFJLEtBQzNDLE9BQU8sS0FBSyxXQUFTLE1BQU0saUJBQWlCLEtBQUssWUFBYSxRQUFRLENBQUMsR0FDekU7QUFHRCxZQUFNLEVBQUUsU0FBUyxJQUFJLEtBQUs7QUFDMUIsV0FBSyxjQUFjO0FBRW5CLFlBQU0sVUFBVSxvQkFBSSxJQUEyQjtBQUUvQyxpQkFBVyxRQUFRLEtBQUssUUFBUSxtQkFBbUIsU0FBUyxVQUFVLEtBQUssQ0FBQyxHQUFHO0FBRTlFLGNBQU0sT0FBTyxLQUFLLHFCQUFxQixJQUFJLEtBQUssRUFBRTtBQUNsRCxZQUFJLEtBQUssTUFBTSxjQUFjLFNBQVMsUUFBUTtBQUM3QztBQUFBLFFBQ0Q7QUFDQSxjQUFNLE9BQU8sTUFBTSxXQUFXLFFBQVEsS0FBSyxLQUFLLE9BQU8sU0FBUztBQUNoRSxZQUFJLFFBQVEsS0FBSyxpQkFBaUIscUJBQXFCLGlCQUFpQjtBQUN2RSxnQkFBTSxNQUFNLFFBQVEsSUFBSSxLQUFLLElBQUksS0FBSztBQUN0QyxrQkFBUSxJQUFJLEtBQUssTUFBTSxNQUFNLEtBQUssUUFBUSxNQUFNO0FBQUEsUUFDakQ7QUFBQSxNQUNEO0FBSUEsWUFBTSwwQkFBMEIsTUFBTSxPQUFPLFVBQVEsS0FBSyxPQUFPLE1BQU0sb0JBQW9CLFNBQVMsY0FBYyxLQUFLLE9BQU8sTUFBTSxhQUFhLFNBQVMsTUFBTTtBQUNoSyxZQUFNLGVBQWUsTUFBTSxLQUFLLFFBQVEsT0FBTyxDQUFDO0FBR2hELFVBQUk7QUFDSixhQUFPLE1BQU07QUFDWixjQUFNLGFBQWEsd0JBQXdCLE1BQU07QUFDakQsY0FBTSxjQUFjLGFBQWEsTUFBTTtBQUV2QyxZQUFJLENBQUMsZUFBZSxDQUFDLFlBQVk7QUFDaEM7QUFBQSxRQUNEO0FBRUEsWUFBSSxZQUFZO0FBQ2YsMkJBQWlCLElBQUksWUFBWSxlQUFlLENBQUM7QUFDakQscUJBQVc7QUFBQSxRQUVaLFdBQVcsWUFBWSxhQUFhO0FBRW5DLGNBQUksTUFBTSxpQkFBaUIsSUFBSSxRQUFRO0FBQ3ZDLGlCQUFPO0FBQ1AsaUJBQU8sYUFBYSxPQUFPLENBQUMsR0FBRyxNQUFNLElBQUksR0FBRyxDQUFDO0FBQzdDLHVCQUFhLFNBQVM7QUFDdEI7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFHQSxVQUFNLHFCQUFzRCxDQUFDO0FBQzdELFVBQU0sa0JBQWtCLENBQUMsTUFBcUIsS0FBeUIsU0FBaUIsYUFBc0MsaUJBQTZEO0FBQzFMLFlBQU0sT0FBNEI7QUFBQSxRQUNqQztBQUFBLFFBQ0EscUNBQXFDO0FBQUEsUUFDckMsaUJBQWlCLElBQUk7QUFBQSxRQUNyQjtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQ0EseUJBQW1CLEtBQUs7QUFBQSxRQUN2QjtBQUFBLFFBQ0EsY0FBYztBQUFBLFFBQ2QsWUFBWTtBQUFBLFVBQ1gsT0FBTyxLQUFLLE9BQU87QUFBQSxVQUNuQixTQUFTO0FBQUE7QUFBQSxZQUVSLGFBQWE7QUFBQSxZQUNiLGlCQUFpQixLQUFLLE9BQU8sTUFBTSxRQUFRO0FBQUE7QUFBQSxZQUMzQyx1QkFBdUIsQ0FBQyxLQUFLLE9BQU8sTUFBTSxRQUFRO0FBQUEsWUFDbEQsWUFBWSx1QkFBdUI7QUFBQSxZQUNuQyxDQUFDLEtBQUssT0FBTyxTQUFTLEdBQUcsS0FBSyxzQkFBc0IsaUJBQW9CLE9BQU87QUFBQSxVQUNoRjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGO0FBRUEsVUFBTSx3QkFBd0IsQ0FBQyxNQUFxQixXQUEwQjtBQUM3RSxZQUFNLGFBQWEsS0FBSyxhQUFhLG1CQUFtQjtBQUFBLFFBQ3ZELE9BQU8sR0FBSSxXQUFXLElBQUssQ0FBQztBQUFBLFFBQzVCLFNBQVM7QUFBQSxNQUNWLENBQUM7QUFDRCxzQkFBZ0IsTUFBTSxZQUFZLFVBQVUsU0FBUyx3QkFBd0IsUUFBUSx3QkFBd0IsTUFBTSxxQkFBcUIsZUFBZTtBQUFBLElBQ3hKO0FBSUEsVUFBTSxFQUFFLFVBQVUsWUFBWSxTQUFTLFVBQVUsSUFBSSxLQUFLLGVBQWU7QUFDekUsVUFBTSxZQUFZLEtBQUssUUFBUSxVQUFVLGFBQWEsVUFBVSxFQUFFO0FBQ2xFLFVBQU0sZ0JBQWdCO0FBQ3RCLFNBQUssUUFBUSxvQkFBb0IsRUFBRSxNQUFNLFlBQVksZUFBZSxVQUFVO0FBSTlFLFFBQUksa0JBQTZCLEVBQUUsTUFBTSxHQUFHLFVBQVUsRUFBRTtBQUV4RCxhQUFTLElBQUksR0FBRyxJQUFJLE1BQU0sUUFBUSxLQUFLO0FBQ3RDLFlBQU0sT0FBTyxNQUFNLENBQUM7QUFFcEIsVUFBSSxnQkFBZ0IsU0FBUyxLQUFLLE9BQU8sTUFBTSxpQkFBaUI7QUFDL0QsMEJBQWtCLEVBQUUsTUFBTSxLQUFLLE9BQU8sTUFBTSxpQkFBaUIsVUFBVSxFQUFFO0FBQUEsTUFDMUU7QUFFQSxVQUFJLGFBQWEsZ0JBQWdCLFdBQVcsV0FBVztBQUN0RDtBQUFBLE1BQ0Q7QUFHQSxVQUFJLEtBQUssS0FBSyxhQUFhO0FBQzFCLDhCQUFzQixNQUFNLEtBQUs7QUFBQSxNQUNsQztBQUdBLFlBQU0sUUFBd0MsT0FBTyxLQUFLLEtBQUssVUFBVSxXQUN0RSxDQUFDLEVBQUUsT0FBTyxLQUFLLEtBQUssTUFBTSxDQUFDLElBQzNCLEtBQUssS0FBSztBQUViLFlBQU0sa0JBQWtCLGlCQUFpQixJQUFJLElBQUk7QUFDakQsVUFBSSxtQkFBbUI7QUFFdkIsZUFBU0MsS0FBSSxHQUFHQSxLQUFJLE1BQU0sUUFBUUEsTUFBSztBQUN0QyxjQUFNLE9BQU8sTUFBTUEsRUFBQztBQUVwQixjQUFNLFVBQVVBLE9BQU07QUFDdEIsY0FBTSxTQUFTQSxPQUFNLE1BQU0sU0FBUztBQUVwQyxjQUFNLGdCQUErQjtBQUFBLFVBQ3BDLFVBQVUsR0FBRyxRQUFRO0FBQUEsVUFDckIsWUFBWSxPQUFPLGFBQWEsTUFBTSxxQkFBcUIsVUFBVTtBQUFBLFVBQ3JFLGVBQWUsWUFBWSxhQUFhO0FBQUEsVUFDeEMsYUFBYTtBQUFBLFFBQ2Q7QUFFQSxZQUFJLGdCQUFnQixLQUFLLEtBQUssU0FBUyxHQUFHO0FBQ3pDLHdCQUFjLFNBQVM7QUFBQSxRQUN4QjtBQUVBLGFBQUssY0FBYyxlQUFlLEtBQUssSUFBSTtBQUUzQyxhQUFLLEtBQUssV0FBVyxLQUFLLGFBQWEsS0FBSyxzQkFBc0IsS0FBSyxTQUFTLFFBQVEsS0FBSyxxQkFBcUIsS0FBSyxVQUFVQSxJQUFHO0FBRW5JLHdCQUFjLGlCQUFpQjtBQUMvQixjQUFJLEtBQUsscUJBQXFCLG9CQUFvQjtBQUNqRCwwQkFBYyxRQUFRLGlCQUFpQixPQUFPLDBCQUEwQjtBQUN4RSwwQkFBYyxTQUFTO0FBQUEsVUFDeEI7QUFBQSxRQUNEO0FBRUEsWUFBSSxZQUFZLEtBQUs7QUFDckIsd0JBQWdCLFlBQVksVUFBVTtBQUN0QyxZQUFJLFVBQVU7QUFDZCxjQUFNLE9BQU8sY0FBYyxJQUFLLGdCQUFnQixXQUFXLFlBQWE7QUFDeEUsWUFBSSxPQUFPLEdBQUc7QUFDYixzQkFBWSxVQUFVLE1BQU0sR0FBRyxDQUFDLElBQUksSUFBSTtBQUN4QyxvQkFBVTtBQUFBLFFBQ1g7QUFFQSw0QkFBb0IsVUFBVTtBQUU5QixZQUFJLG9CQUFvQixRQUFXO0FBQ2xDLGdCQUFNLGtCQUFrQixtQkFBbUI7QUFDM0MsY0FBSSxtQkFBbUIsR0FBRztBQUV6QixnQ0FBb0I7QUFDcEIsd0JBQVksVUFBVSxNQUFNLEdBQUcsRUFBRSxJQUFJLGdCQUFnQixJQUFJO0FBQ3pELHNCQUFVO0FBQUEsVUFDWDtBQUFBLFFBQ0Q7QUFFQSxZQUFJLFNBQVM7QUFDWixjQUFJLFlBQVksVUFBVSxVQUFVO0FBRW5DLDBCQUFjLFVBQVUsT0FBTyxLQUFLLElBQUksR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDO0FBQzVELDBCQUFjLGVBQWUsR0FBSSxXQUFXLElBQUssQ0FBQztBQUFBLFVBQ25ELFdBQVcsU0FBUztBQUVuQiwwQkFBYyxVQUFVLGFBQWEsS0FBSyxJQUFJLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQztBQUNsRSwwQkFBYyxlQUFlLEdBQUksV0FBVyxJQUFLLENBQUMsVUFBVyxXQUFXLElBQUssQ0FBQztBQUFBLFVBQy9FLFdBQVksVUFBVSxTQUFVO0FBRS9CLDBCQUFjLFVBQVUsT0FBTyxLQUFLLElBQUksR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDO0FBQzVELDBCQUFjLGVBQWUsS0FBTSxXQUFXLElBQUssQ0FBQyxNQUFPLFdBQVcsSUFBSyxDQUFDO0FBQUEsVUFDN0UsT0FBTztBQUNOLDBCQUFjLFVBQVU7QUFBQSxVQUN6QjtBQUFBLFFBQ0Q7QUFFQTtBQUFBLFVBQ0M7QUFBQSxVQUNBLEtBQUssYUFBYSxtQkFBbUIsYUFBYTtBQUFBLFVBQ2xELFNBQVMsU0FBUztBQUFBLFVBQ2xCLFVBQVUsQ0FBQyxLQUFLLEtBQUssZUFBZSx3QkFBd0IsUUFBUSx3QkFBd0I7QUFBQSxVQUM1RixJQUFJLDJCQUEyQixNQUFNQSxFQUFDO0FBQUEsUUFDdkM7QUFFQSxZQUFJLFNBQVM7QUFDWjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBRUEsVUFBSSxvQkFBb0IsVUFBYSxtQkFBbUIsaUJBQWlCO0FBRXhFLGNBQU0sTUFBTyxrQkFBa0I7QUFDL0I7QUFBQSxVQUNDO0FBQUEsVUFDQSxLQUFLLGFBQWEsbUJBQW1CLENBQUMsQ0FBQztBQUFBLFVBQ3ZDLFNBQVMsT0FBTyxHQUFHO0FBQUEsVUFDbkIsd0JBQXdCO0FBQUEsUUFDekI7QUFBQSxNQUNEO0FBR0EsVUFBSSxLQUFLLEtBQUssY0FBYztBQUMzQiw4QkFBc0IsTUFBTSxJQUFJO0FBQUEsTUFDakM7QUFFQSxVQUFJLG1CQUFtQixTQUFTLHFCQUFxQixpQkFBaUI7QUFDckU7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUlBLFVBQU0seUJBQW1DLENBQUM7QUFDMUMsZUFBVyxDQUFDLElBQUksUUFBUSxLQUFLLEtBQUssc0JBQXNCO0FBQ3ZELFlBQU0sUUFBUSxLQUFLLFFBQVEsU0FBUyxHQUFHLG1CQUFtQixFQUFFO0FBQzVELFVBQUksU0FBUyxPQUFPLEtBQUssT0FBSyxFQUFFLGNBQWMsS0FBSyxDQUFDLEdBQUc7QUFDdEQsK0JBQXVCLEtBQUssRUFBRTtBQUM5QixpQkFBUyxhQUFhLFFBQVE7QUFDOUIsYUFBSyxxQkFBcUIsT0FBTyxFQUFFO0FBQUEsTUFDcEM7QUFBQSxJQUNEO0FBRUEsVUFBTSxjQUFjLHdCQUF3QixRQUFRLEtBQUssT0FBTztBQUVoRSxTQUFLLFFBQVEsa0JBQWtCLGNBQVk7QUFDMUMsWUFBTSxtQkFBbUIsU0FBUyxpQkFBaUIsd0JBQXdCLG1CQUFtQixJQUFJLE9BQUssRUFBRSxVQUFVLENBQUM7QUFDcEgsZUFBUyxJQUFJLEdBQUcsSUFBSSxpQkFBaUIsUUFBUSxLQUFLO0FBQ2pELGNBQU0sT0FBTyxtQkFBbUIsQ0FBQztBQUNqQyxhQUFLLHFCQUFxQixJQUFJLGlCQUFpQixDQUFDLEdBQUcsSUFBSTtBQUFBLE1BQ3hEO0FBQUEsSUFDRCxDQUFDO0FBRUQsZ0JBQVksUUFBUSxLQUFLLE9BQU87QUFBQSxFQUNqQztBQUFBLEVBRVEsY0FBYyxPQUFzQixNQUFpQztBQUM1RSxRQUFJLEtBQUssU0FBUyxVQUFVLGNBQWMsV0FBVztBQUNwRCxZQUFNLGtCQUFrQixpQkFBaUIsT0FBTyxrQ0FBa0M7QUFDbEYsWUFBTSxRQUFRLGlCQUFpQixPQUFPLGtDQUFrQztBQUFBLElBQ3pFLFdBQVcsS0FBSyxTQUFTLFVBQVUsY0FBYyxNQUFNO0FBQ3RELFlBQU0sa0JBQWtCLGlCQUFpQixPQUFPLDZCQUE2QjtBQUM3RSxZQUFNLFFBQVEsaUJBQWlCLE9BQU8sNkJBQTZCO0FBQUEsSUFDcEUsT0FBTztBQUNOLFlBQU0sa0JBQWtCLGlCQUFpQixPQUFPLHlCQUF5QjtBQUN6RSxZQUFNLFFBQVEsaUJBQWlCLE9BQU8seUJBQXlCO0FBQUEsSUFDaEU7QUFBQSxFQUNEO0FBQUEsRUFFUSxpQkFBaUI7QUFDeEIsVUFBTSxVQUFVLEtBQUssUUFBUSxVQUFVLGFBQWEsVUFBVTtBQUM5RCxVQUFNLFVBQVUsUUFBUTtBQUV4QixVQUFNLGlCQUFpQixLQUFLLFFBQVEsVUFBVSxhQUFhLFFBQVE7QUFDbkUsVUFBTSxtQkFBbUIsS0FBSyxRQUFRLFVBQVUsYUFBYSxVQUFVO0FBRXZFLFFBQUksV0FBVyxRQUFRO0FBQ3ZCLFFBQUksQ0FBQyxZQUFZLFdBQVcsS0FBSyxXQUFXLGdCQUFnQjtBQUMzRCxpQkFBVztBQUFBLElBQ1o7QUFFQSxVQUFNLGFBQWEsUUFBUSxjQUFjO0FBRXpDLFVBQU0sWUFBWSxDQUFDLFdBQ2YsZUFBZSxvQkFDZixhQUFhO0FBRWpCLFdBQU8sRUFBRSxVQUFVLFlBQVksU0FBUyxVQUFVO0FBQUEsRUFDbkQ7QUFBQSxFQUVRLHdCQUE4QjtBQUNyQyxTQUFLLFFBQVEsa0JBQWtCLE1BQU0sS0FBSyxLQUFLLHFCQUFxQixLQUFLLENBQUMsQ0FBQztBQUMzRSxlQUFXLE9BQU8sS0FBSyxxQkFBcUIsT0FBTyxHQUFHO0FBQ3JELFVBQUksYUFBYSxRQUFRO0FBQUEsSUFDMUI7QUFDQSxTQUFLLHFCQUFxQixNQUFNO0FBQUEsRUFDakM7QUFBQTtBQUFBLEVBS0EscUJBQXFCLE1BQStCO0FBQ25ELFFBQUksQ0FBQyxLQUFLLFFBQVEsU0FBUyxHQUFHO0FBQzdCLGFBQU8sQ0FBQztBQUFBLElBQ1Q7QUFDQSxVQUFNLE1BQU0sb0JBQUksSUFBeUI7QUFDekMsVUFBTSxTQUEwQixDQUFDO0FBQ2pDLGVBQVcsUUFBUSxLQUFLLFFBQVEsbUJBQW1CLElBQUksR0FBRztBQUN6RCxZQUFNLE9BQU8sS0FBSyxxQkFBcUIsSUFBSSxLQUFLLEVBQUU7QUFDbEQsVUFBSSxRQUFRLENBQUMsSUFBSSxJQUFJLEtBQUssS0FBSyxJQUFJLEdBQUc7QUFDckMsWUFBSSxJQUFJLEtBQUssS0FBSyxJQUFJO0FBQ3RCLGVBQU8sS0FBSyxLQUFLLElBQUk7QUFBQSxNQUN0QjtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBeHBCYSxxQkFFSSxLQUFhO0FBRmpCLHFCQUlZLGtCQUFrQjtBQUo5QixxQkFLWSxrQkFBa0IsQ0FBQztBQUwvQix1QkFBTjtBQUFBLEVBdUJKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQTVCVTtBQTRwQmIsU0FBUyxTQUFTLEtBQXFCO0FBQ3RDLFFBQU0sb0JBQW9CO0FBQzFCLFNBQU8sSUFBSSxRQUFRLFVBQVUsaUJBQWlCO0FBQy9DO0FBRUEsaUJBQWlCLGdCQUFnQiw2QkFBNkIsT0FBTyxhQUFhLFNBQXdEO0FBRXpJLFFBQU0sQ0FBQyxLQUFLLEtBQUssSUFBSTtBQUNyQixhQUFXLElBQUksTUFBTSxHQUFHLENBQUM7QUFDekIsYUFBVyxNQUFNLFNBQVMsS0FBSyxDQUFDO0FBRWhDLFFBQU0sRUFBRSxtQkFBbUIsSUFBSSxTQUFTLElBQUksd0JBQXdCO0FBQ3BFLFFBQU0sTUFBTSxNQUFNLFNBQVMsSUFBSSxpQkFBaUIsRUFBRSxxQkFBcUIsR0FBRztBQUMxRSxNQUFJO0FBQ0gsVUFBTSxRQUFRLE1BQU0sb0JBQW9CLE9BQU8sb0JBQW9CLElBQUksT0FBTyxpQkFBaUIsQ0FBQyxNQUFNLEtBQUssS0FBSyxDQUFDLEdBQUcsa0JBQWtCLElBQUk7QUFDMUksVUFBTSxTQUFTLE1BQU0sTUFBTSxJQUFJLE9BQUssRUFBRSxJQUFJO0FBQzFDLGVBQVcsTUFBTSxNQUFNLFFBQVEsR0FBRyxDQUFDO0FBQ25DLFdBQU87QUFBQSxFQUNSLFVBQUU7QUFDRCxRQUFJLFFBQVE7QUFBQSxFQUNiO0FBQ0QsQ0FBQzsiLAogICJuYW1lcyI6IFsiUmVuZGVyTW9kZSIsICJtb2RlbCIsICJpIl0KfQo=
