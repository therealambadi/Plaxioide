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
import * as dom from "../../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../../base/browser/mouseEvent.js";
import { HoverPosition } from "../../../../../base/browser/ui/hover/hoverWidget.js";
import { findLast } from "../../../../../base/common/arraysFind.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { equalsIgnoreCase } from "../../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { getIconClasses } from "../../../../../editor/common/services/getIconClasses.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { getFlatContextMenuActions } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId } from "../../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { FileKind } from "../../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IChatService } from "../../common/chatService.js";
import { isRequestVM, isResponseVM } from "../../common/chatViewModel.js";
import { ChatMarkdownDecorationsRenderer } from "../chatMarkdownDecorationsRenderer.js";
import { CodeBlockPart, localFileLanguageId, parseLocalFileData } from "../codeBlockPart.js";
import "../media/chatCodeBlockPill.css";
import { ResourcePool } from "./chatCollections.js";
const $ = dom.$;
let ChatMarkdownContentPart = class extends Disposable {
  constructor(markdown, context, editorPool, fillInIncompleteTokens = false, codeBlockStartIndex = 0, renderer, currentWidth, codeBlockModelCollection, rendererOptions, contextKeyService, textModelService, instantiationService) {
    super();
    this.markdown = markdown;
    this.editorPool = editorPool;
    this.codeBlockModelCollection = codeBlockModelCollection;
    this.rendererOptions = rendererOptions;
    this.textModelService = textModelService;
    this.instantiationService = instantiationService;
    this.codeblocksPartId = String(++ChatMarkdownContentPart.idPool);
    this.allRefs = [];
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this.codeblocks = [];
    const element = context.element;
    const inUndoStop = findLast(context.content, (e) => e.kind === "undoStop", context.contentIndex)?.id;
    const orderedDisposablesList = [];
    let globalCodeBlockIndexStart = codeBlockStartIndex;
    let thisPartCodeBlockIndexStart = 0;
    const markedOpts = isRequestVM(element) ? {
      gfm: true,
      breaks: true
    } : void 0;
    const result = this._register(renderer.render(markdown.content, {
      fillInIncompleteTokens,
      codeBlockRendererSync: (languageId, text, raw) => {
        const isCodeBlockComplete = !isResponseVM(context.element) || context.element.isComplete || !raw || codeblockHasClosingBackticks(raw);
        if ((!text || text.startsWith("<vscode_codeblock_uri") && !text.includes("\n")) && !isCodeBlockComplete) {
          const hideEmptyCodeblock = $("div");
          hideEmptyCodeblock.style.display = "none";
          return hideEmptyCodeblock;
        }
        const globalIndex = globalCodeBlockIndexStart++;
        const thisPartIndex = thisPartCodeBlockIndexStart++;
        let textModel;
        let range;
        let vulns;
        let codeblockEntry;
        if (equalsIgnoreCase(languageId, localFileLanguageId)) {
          try {
            const parsedBody = parseLocalFileData(text);
            range = parsedBody.range && Range.lift(parsedBody.range);
            textModel = this.textModelService.createModelReference(parsedBody.uri).then((ref) => ref.object.textEditorModel);
          } catch (e) {
            return $("div");
          }
        } else {
          const sessionId = isResponseVM(element) || isRequestVM(element) ? element.sessionId : "";
          const modelEntry = this.codeBlockModelCollection.getOrCreate(sessionId, element, globalIndex);
          const fastUpdateModelEntry = this.codeBlockModelCollection.updateSync(sessionId, element, globalIndex, { text, languageId, isComplete: isCodeBlockComplete });
          vulns = modelEntry.vulns;
          codeblockEntry = fastUpdateModelEntry;
          textModel = modelEntry.model;
        }
        const hideToolbar = isResponseVM(element) && element.errorDetails?.responseIsFiltered;
        const renderOptions = {
          ...this.rendererOptions.codeBlockRenderOptions
        };
        if (hideToolbar !== void 0) {
          renderOptions.hideToolbar = hideToolbar;
        }
        const codeBlockInfo = { languageId, textModel, codeBlockIndex: globalIndex, codeBlockPartIndex: thisPartIndex, element, range, parentContextKeyService: contextKeyService, vulns, codemapperUri: codeblockEntry?.codemapperUri, renderOptions };
        if (element.isCompleteAddedRequest || !codeblockEntry?.codemapperUri || !codeblockEntry.isEdit) {
          const ref = this.renderCodeBlock(codeBlockInfo, text, isCodeBlockComplete, currentWidth);
          this.allRefs.push(ref);
          this._register(ref.object.onDidChangeContentHeight(() => this._onDidChangeHeight.fire()));
          const ownerMarkdownPartId = this.codeblocksPartId;
          const info = new class {
            constructor() {
              this.ownerMarkdownPartId = ownerMarkdownPartId;
              this.codeBlockIndex = globalIndex;
              this.elementId = element.id;
              this.isStreaming = false;
              this.codemapperUri = void 0;
              this.uriPromise = textModel.then((model) => model.uri);
            }
            // will be set async
            get uri() {
              return ref.object.uri;
            }
            focus() {
              ref.object.focus();
            }
          }();
          this.codeblocks.push(info);
          orderedDisposablesList.push(ref);
          return ref.object.element;
        } else {
          const requestId = isRequestVM(element) ? element.id : element.requestId;
          const ref = this.renderCodeBlockPill(element.sessionId, requestId, inUndoStop, codeBlockInfo.codemapperUri, !isCodeBlockComplete);
          if (isResponseVM(codeBlockInfo.element)) {
            this.codeBlockModelCollection.update(codeBlockInfo.element.sessionId, codeBlockInfo.element, codeBlockInfo.codeBlockIndex, { text, languageId: codeBlockInfo.languageId, isComplete: isCodeBlockComplete }).then((e) => {
              this.codeblocks[codeBlockInfo.codeBlockPartIndex].codemapperUri = e.codemapperUri;
              this._onDidChangeHeight.fire();
            });
          }
          this.allRefs.push(ref);
          const ownerMarkdownPartId = this.codeblocksPartId;
          const info = new class {
            constructor() {
              this.ownerMarkdownPartId = ownerMarkdownPartId;
              this.codeBlockIndex = globalIndex;
              this.elementId = element.id;
              this.isStreaming = !isCodeBlockComplete;
              this.codemapperUri = codeblockEntry?.codemapperUri;
              this.uriPromise = Promise.resolve(void 0);
            }
            get uri() {
              return void 0;
            }
            focus() {
              return ref.object.element.focus();
            }
          }();
          this.codeblocks.push(info);
          orderedDisposablesList.push(ref);
          return ref.object.element;
        }
      },
      asyncRenderCallback: () => this._onDidChangeHeight.fire()
    }, markedOpts));
    const markdownDecorationsRenderer = instantiationService.createInstance(ChatMarkdownDecorationsRenderer);
    this._register(markdownDecorationsRenderer.walkTreeAndAnnotateReferenceLinks(markdown, result.element));
    orderedDisposablesList.reverse().forEach((d) => this._register(d));
    this.domNode = result.element;
  }
  renderCodeBlockPill(sessionId, requestId, inUndoStop, codemapperUri, isStreaming) {
    const codeBlock = this.instantiationService.createInstance(CollapsedCodeBlock, sessionId, requestId, inUndoStop);
    if (codemapperUri) {
      codeBlock.render(codemapperUri, isStreaming);
    }
    return {
      object: codeBlock,
      isStale: () => false,
      dispose: () => codeBlock.dispose()
    };
  }
  renderCodeBlock(data, text, isComplete, currentWidth) {
    const ref = this.editorPool.get();
    const editorInfo = ref.object;
    if (isResponseVM(data.element)) {
      this.codeBlockModelCollection.update(data.element.sessionId, data.element, data.codeBlockIndex, { text, languageId: data.languageId, isComplete }).then((e) => {
        this.codeblocks[data.codeBlockPartIndex].codemapperUri = e.codemapperUri;
        this._onDidChangeHeight.fire();
      });
    }
    editorInfo.render(data, currentWidth);
    return ref;
  }
  hasSameContent(other) {
    return other.kind === "markdownContent" && !!(other.content.value === this.markdown.content.value || this.codeblocks.at(-1)?.isStreaming && this.codeblocks.at(-1)?.codemapperUri !== void 0 && other.content.value.lastIndexOf("```") === this.markdown.content.value.lastIndexOf("```"));
  }
  layout(width) {
    this.allRefs.forEach((ref, index) => {
      if (ref.object instanceof CodeBlockPart) {
        ref.object.layout(width);
      } else if (ref.object instanceof CollapsedCodeBlock) {
        const codeblockModel = this.codeblocks[index];
        if (codeblockModel.codemapperUri && ref.object.uri?.toString() !== codeblockModel.codemapperUri.toString()) {
          ref.object.render(codeblockModel.codemapperUri, codeblockModel.isStreaming);
        }
      }
    });
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatMarkdownContentPart.idPool = 0;
ChatMarkdownContentPart = __decorateClass([
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, ITextModelService),
  __decorateParam(11, IInstantiationService)
], ChatMarkdownContentPart);
let EditorPool = class extends Disposable {
  inUse() {
    return this._pool.inUse;
  }
  constructor(options, delegate, overflowWidgetsDomNode, instantiationService) {
    super();
    this._pool = this._register(new ResourcePool(() => {
      return instantiationService.createInstance(CodeBlockPart, options, MenuId.ChatCodeBlock, delegate, overflowWidgetsDomNode);
    }));
  }
  get() {
    const codeBlock = this._pool.get();
    let stale = false;
    return {
      object: codeBlock,
      isStale: () => stale,
      dispose: () => {
        codeBlock.reset();
        stale = true;
        this._pool.release(codeBlock);
      }
    };
  }
};
EditorPool = __decorateClass([
  __decorateParam(3, IInstantiationService)
], EditorPool);
function codeblockHasClosingBackticks(str) {
  str = str.trim();
  return !!str.match(/\n```+$/);
}
let CollapsedCodeBlock = class extends Disposable {
  constructor(sessionId, requestId, inUndoStop, labelService, editorService, modelService, languageService, contextMenuService, contextKeyService, menuService, hoverService, chatService) {
    super();
    this.sessionId = sessionId;
    this.requestId = requestId;
    this.inUndoStop = inUndoStop;
    this.labelService = labelService;
    this.editorService = editorService;
    this.modelService = modelService;
    this.languageService = languageService;
    this.contextMenuService = contextMenuService;
    this.contextKeyService = contextKeyService;
    this.menuService = menuService;
    this.hoverService = hoverService;
    this.chatService = chatService;
    this.hover = this._register(new MutableDisposable());
    this._progressStore = this._store.add(new DisposableStore());
    this.element = $(".chat-codeblock-pill-widget");
    this.element.classList.add("show-file-icons");
    this._register(dom.addDisposableListener(this.element, "click", async () => {
      if (this._currentDiff) {
        this.editorService.openEditor({
          original: { resource: this._currentDiff.originalURI },
          modified: { resource: this._currentDiff.modifiedURI },
          options: { transient: true }
        });
      } else if (this.uri) {
        this.editorService.openEditor({ resource: this.uri });
      }
    }));
    this._register(dom.addDisposableListener(this.element, dom.EventType.CONTEXT_MENU, (domEvent) => {
      const event = new StandardMouseEvent(dom.getWindow(domEvent), domEvent);
      dom.EventHelper.stop(domEvent, true);
      this.contextMenuService.showContextMenu({
        contextKeyService: this.contextKeyService,
        getAnchor: () => event,
        getActions: () => {
          const menu = this.menuService.getMenuActions(MenuId.ChatEditingCodeBlockContext, this.contextKeyService, { arg: { sessionId, requestId, uri: this.uri, stopId: inUndoStop } });
          return getFlatContextMenuActions(menu);
        }
      });
    }));
  }
  get uri() {
    return this._uri;
  }
  render(uri, isStreaming) {
    this._progressStore.clear();
    this._uri = uri;
    const session = this.chatService.getSession(this.sessionId);
    const iconText = this.labelService.getUriBasenameLabel(uri);
    let editSession = session?.editingSessionObs?.promiseResult.get()?.data;
    let modifiedEntry = editSession?.getEntry(uri);
    let modifiedByResponse = modifiedEntry?.isCurrentlyBeingModifiedBy.get();
    const isComplete = !modifiedByResponse || modifiedByResponse.requestId !== this.requestId;
    let iconClasses = [];
    if (isStreaming || !isComplete) {
      const codicon = ThemeIcon.modify(Codicon.loading, "spin");
      iconClasses = ThemeIcon.asClassNameArray(codicon);
    } else {
      const fileKind = uri.path.endsWith("/") ? FileKind.FOLDER : FileKind.FILE;
      iconClasses = getIconClasses(this.modelService, this.languageService, uri, fileKind);
    }
    const iconEl = dom.$("span.icon");
    iconEl.classList.add(...iconClasses);
    const children = [dom.$("span.icon-label", {}, iconText)];
    const labelDetail = dom.$("span.label-detail", {}, "");
    children.push(labelDetail);
    if (isStreaming) {
      labelDetail.textContent = localize("chat.codeblock.generating", "Generating edits...");
    }
    this.element.replaceChildren(iconEl, ...children);
    this.updateTooltip(this.labelService.getUriLabel(uri, { relative: false }));
    const renderDiff = (changes) => {
      const labelAdded = this.element.querySelector(".label-added") ?? this.element.appendChild(dom.$("span.label-added"));
      const labelRemoved = this.element.querySelector(".label-removed") ?? this.element.appendChild(dom.$("span.label-removed"));
      if (changes && !changes?.identical && !changes?.quitEarly) {
        this._currentDiff = changes;
        labelAdded.textContent = `+${changes.added}`;
        labelRemoved.textContent = `-${changes.removed}`;
        const insertionsFragment = changes.added === 1 ? localize("chat.codeblock.insertions.one", "1 insertion") : localize("chat.codeblock.insertions", "{0} insertions", changes.added);
        const deletionsFragment = changes.removed === 1 ? localize("chat.codeblock.deletions.one", "1 deletion") : localize("chat.codeblock.deletions", "{0} deletions", changes.removed);
        const summary = localize("summary", "Edited {0}, {1}, {2}", iconText, insertionsFragment, deletionsFragment);
        this.element.ariaLabel = summary;
        this.updateTooltip(summary);
      }
    };
    let diffBetweenStops;
    this._progressStore.add(autorun((r) => {
      if (!editSession) {
        editSession = session?.editingSessionObs?.promiseResult.read(r)?.data;
        modifiedEntry = editSession?.getEntry(uri);
      }
      modifiedByResponse = modifiedEntry?.isCurrentlyBeingModifiedBy.read(r);
      const isComplete2 = !modifiedByResponse || modifiedByResponse.requestId !== this.requestId;
      const rewriteRatio = modifiedEntry?.rewriteRatio.read(r);
      if (!isStreaming && !isComplete2) {
        const value = rewriteRatio;
        labelDetail.textContent = value === 0 || !value ? localize("chat.codeblock.generating", "Generating edits...") : localize("chat.codeblock.applyingPercentage", "Applying edits ({0}%)...", Math.round(value * 100));
      } else if (!isStreaming && isComplete2) {
        iconEl.classList.remove(...iconClasses);
        const fileKind = uri.path.endsWith("/") ? FileKind.FOLDER : FileKind.FILE;
        iconEl.classList.add(...getIconClasses(this.modelService, this.languageService, uri, fileKind));
        labelDetail.textContent = "";
      }
      if (!diffBetweenStops) {
        diffBetweenStops = modifiedEntry && editSession ? editSession.getEntryDiffBetweenStops(modifiedEntry.modifiedURI, this.requestId, this.inUndoStop) : void 0;
      }
      if (!isStreaming && isComplete2 && diffBetweenStops) {
        renderDiff(diffBetweenStops.read(r));
      }
    }));
  }
  updateTooltip(tooltip) {
    this.tooltip = tooltip;
    if (!this.hover.value) {
      this.hover.value = this.hoverService.setupDelayedHover(this.element, () => ({
        content: this.tooltip,
        appearance: { compact: true, showPointer: true },
        position: { hoverPosition: HoverPosition.BELOW },
        persistence: { hideOnKeyDown: true }
      }));
    }
  }
};
CollapsedCodeBlock = __decorateClass([
  __decorateParam(3, ILabelService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IModelService),
  __decorateParam(6, ILanguageService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IMenuService),
  __decorateParam(10, IHoverService),
  __decorateParam(11, IChatService)
], CollapsedCodeBlock);
export {
  ChatMarkdownContentPart,
  EditorPool
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0TWFya2Rvd25Db250ZW50UGFydC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IEhvdmVyUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJXaWRnZXQuanMnO1xuaW1wb3J0IHsgZmluZExhc3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXNGaW5kLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1biwgSU9ic2VydmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGVxdWFsc0lnbm9yZUNhc2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9tYXJrZG93blJlbmRlcmVyL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgZ2V0SWNvbkNsYXNzZXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2dldEljb25DbGFzc2VzLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgZ2V0RmxhdENvbnRleHRNZW51QWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBJTWVudVNlcnZpY2UsIE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBGaWxlS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duVnVsbmVyYWJpbGl0eSB9IGZyb20gJy4uLy4uL2NvbW1vbi9hbm5vdGF0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdFNlc3Npb25FbnRyeURpZmYgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdEVkaXRpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDaGF0UHJvZ3Jlc3NSZW5kZXJhYmxlUmVzcG9uc2VDb250ZW50IH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJQ2hhdE1hcmtkb3duQ29udGVudCwgSUNoYXRTZXJ2aWNlLCBJQ2hhdFVuZG9TdG9wIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzUmVxdWVzdFZNLCBpc1Jlc3BvbnNlVk0gfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBDb2RlQmxvY2tFbnRyeSwgQ29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvZGVCbG9ja01vZGVsQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ2hhdENvZGVCbG9ja0luZm8gfSBmcm9tICcuLi9jaGF0LmpzJztcbmltcG9ydCB7IElDaGF0UmVuZGVyZXJEZWxlZ2F0ZSB9IGZyb20gJy4uL2NoYXRMaXN0UmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgQ2hhdE1hcmtkb3duRGVjb3JhdGlvbnNSZW5kZXJlciB9IGZyb20gJy4uL2NoYXRNYXJrZG93bkRlY29yYXRpb25zUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi9jaGF0T3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb2RlQmxvY2tQYXJ0LCBJQ29kZUJsb2NrRGF0YSwgSUNvZGVCbG9ja1JlbmRlck9wdGlvbnMsIGxvY2FsRmlsZUxhbmd1YWdlSWQsIHBhcnNlTG9jYWxGaWxlRGF0YSB9IGZyb20gJy4uL2NvZGVCbG9ja1BhcnQuanMnO1xuaW1wb3J0ICcuLi9tZWRpYS9jaGF0Q29kZUJsb2NrUGlsbC5jc3MnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGVSZWZlcmVuY2UsIFJlc291cmNlUG9vbCB9IGZyb20gJy4vY2hhdENvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IElDaGF0Q29udGVudFBhcnQsIElDaGF0Q29udGVudFBhcnRSZW5kZXJDb250ZXh0IH0gZnJvbSAnLi9jaGF0Q29udGVudFBhcnRzLmpzJztcblxuY29uc3QgJCA9IGRvbS4kO1xuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0TWFya2Rvd25Db250ZW50UGFydE9wdGlvbnMge1xuXHRyZWFkb25seSBjb2RlQmxvY2tSZW5kZXJPcHRpb25zPzogSUNvZGVCbG9ja1JlbmRlck9wdGlvbnM7XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0TWFya2Rvd25Db250ZW50UGFydCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQ2hhdENvbnRlbnRQYXJ0IHtcblx0cHJpdmF0ZSBzdGF0aWMgaWRQb29sID0gMDtcblx0cHVibGljIHJlYWRvbmx5IGNvZGVibG9ja3NQYXJ0SWQgPSBTdHJpbmcoKytDaGF0TWFya2Rvd25Db250ZW50UGFydC5pZFBvb2wpO1xuXHRwdWJsaWMgcmVhZG9ubHkgZG9tTm9kZTogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgYWxsUmVmczogSURpc3Bvc2FibGVSZWZlcmVuY2U8Q29kZUJsb2NrUGFydCB8IENvbGxhcHNlZENvZGVCbG9jaz5bXSA9IFtdO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlSGVpZ2h0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZUhlaWdodCA9IHRoaXMuX29uRGlkQ2hhbmdlSGVpZ2h0LmV2ZW50O1xuXG5cdHB1YmxpYyByZWFkb25seSBjb2RlYmxvY2tzOiBJQ2hhdENvZGVCbG9ja0luZm9bXSA9IFtdO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbWFya2Rvd246IElDaGF0TWFya2Rvd25Db250ZW50LFxuXHRcdGNvbnRleHQ6IElDaGF0Q29udGVudFBhcnRSZW5kZXJDb250ZXh0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yUG9vbDogRWRpdG9yUG9vbCxcblx0XHRmaWxsSW5JbmNvbXBsZXRlVG9rZW5zID0gZmFsc2UsXG5cdFx0Y29kZUJsb2NrU3RhcnRJbmRleCA9IDAsXG5cdFx0cmVuZGVyZXI6IE1hcmtkb3duUmVuZGVyZXIsXG5cdFx0Y3VycmVudFdpZHRoOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb2RlQmxvY2tNb2RlbENvbGxlY3Rpb246IENvZGVCbG9ja01vZGVsQ29sbGVjdGlvbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IHJlbmRlcmVyT3B0aW9uczogSUNoYXRNYXJrZG93bkNvbnRlbnRQYXJ0T3B0aW9ucyxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBlbGVtZW50ID0gY29udGV4dC5lbGVtZW50O1xuXHRcdGNvbnN0IGluVW5kb1N0b3AgPSAoZmluZExhc3QoY29udGV4dC5jb250ZW50LCBlID0+IGUua2luZCA9PT0gJ3VuZG9TdG9wJywgY29udGV4dC5jb250ZW50SW5kZXgpIGFzIElDaGF0VW5kb1N0b3AgfCB1bmRlZmluZWQpPy5pZDtcblxuXHRcdC8vIFdlIHJlbGVhc2UgZWRpdG9ycyBpbiBvcmRlciBzbyB0aGF0IGl0J3MgbW9yZSBsaWtlbHkgdGhhdCB0aGUgc2FtZSBlZGl0b3Igd2lsbCBiZSBhc3NpZ25lZCBpZiB0aGlzIGVsZW1lbnQgaXMgcmUtcmVuZGVyZWQgcmlnaHQgYXdheSwgbGlrZSBpdCBvZnRlbiBpcyBkdXJpbmcgcHJvZ3Jlc3NpdmUgcmVuZGVyaW5nXG5cdFx0Y29uc3Qgb3JkZXJlZERpc3Bvc2FibGVzTGlzdDogSURpc3Bvc2FibGVbXSA9IFtdO1xuXG5cdFx0Ly8gTmVlZCB0byB0cmFjayB0aGUgaW5kZXggb2YgdGhlIGNvZGVibG9jayB3aXRoaW4gdGhlIHJlc3BvbnNlIHNvIGl0IGNhbiBoYXZlIGEgdW5pcXVlIElELFxuXHRcdC8vIGFuZCB3aXRoaW4gdGhpcyBwYXJ0IHRvIGZpbmQgaXQgd2l0aGluIHRoZSBjb2RlYmxvY2tzIGFycmF5XG5cdFx0bGV0IGdsb2JhbENvZGVCbG9ja0luZGV4U3RhcnQgPSBjb2RlQmxvY2tTdGFydEluZGV4O1xuXHRcdGxldCB0aGlzUGFydENvZGVCbG9ja0luZGV4U3RhcnQgPSAwO1xuXG5cdFx0Ly8gRG9uJ3Qgc2V0IHRvICdmYWxzZScgZm9yIHJlc3BvbnNlcywgcmVzcGVjdCBkZWZhdWx0c1xuXHRcdGNvbnN0IG1hcmtlZE9wdHMgPSBpc1JlcXVlc3RWTShlbGVtZW50KSA/IHtcblx0XHRcdGdmbTogdHJ1ZSxcblx0XHRcdGJyZWFrczogdHJ1ZSxcblx0XHR9IDogdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fcmVnaXN0ZXIocmVuZGVyZXIucmVuZGVyKG1hcmtkb3duLmNvbnRlbnQsIHtcblx0XHRcdGZpbGxJbkluY29tcGxldGVUb2tlbnMsXG5cdFx0XHRjb2RlQmxvY2tSZW5kZXJlclN5bmM6IChsYW5ndWFnZUlkLCB0ZXh0LCByYXcpID0+IHtcblx0XHRcdFx0Y29uc3QgaXNDb2RlQmxvY2tDb21wbGV0ZSA9ICFpc1Jlc3BvbnNlVk0oY29udGV4dC5lbGVtZW50KSB8fCBjb250ZXh0LmVsZW1lbnQuaXNDb21wbGV0ZSB8fCAhcmF3IHx8IGNvZGVibG9ja0hhc0Nsb3NpbmdCYWNrdGlja3MocmF3KTtcblx0XHRcdFx0aWYgKCghdGV4dCB8fCAodGV4dC5zdGFydHNXaXRoKCc8dnNjb2RlX2NvZGVibG9ja191cmknKSAmJiAhdGV4dC5pbmNsdWRlcygnXFxuJykpKSAmJiAhaXNDb2RlQmxvY2tDb21wbGV0ZSkge1xuXHRcdFx0XHRcdGNvbnN0IGhpZGVFbXB0eUNvZGVibG9jayA9ICQoJ2RpdicpO1xuXHRcdFx0XHRcdGhpZGVFbXB0eUNvZGVibG9jay5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0XHRcdHJldHVybiBoaWRlRW1wdHlDb2RlYmxvY2s7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgZ2xvYmFsSW5kZXggPSBnbG9iYWxDb2RlQmxvY2tJbmRleFN0YXJ0Kys7XG5cdFx0XHRcdGNvbnN0IHRoaXNQYXJ0SW5kZXggPSB0aGlzUGFydENvZGVCbG9ja0luZGV4U3RhcnQrKztcblx0XHRcdFx0bGV0IHRleHRNb2RlbDogUHJvbWlzZTxJVGV4dE1vZGVsPjtcblx0XHRcdFx0bGV0IHJhbmdlOiBSYW5nZSB8IHVuZGVmaW5lZDtcblx0XHRcdFx0bGV0IHZ1bG5zOiByZWFkb25seSBJTWFya2Rvd25WdWxuZXJhYmlsaXR5W10gfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGxldCBjb2RlYmxvY2tFbnRyeTogQ29kZUJsb2NrRW50cnkgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChlcXVhbHNJZ25vcmVDYXNlKGxhbmd1YWdlSWQsIGxvY2FsRmlsZUxhbmd1YWdlSWQpKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGNvbnN0IHBhcnNlZEJvZHkgPSBwYXJzZUxvY2FsRmlsZURhdGEodGV4dCk7XG5cdFx0XHRcdFx0XHRyYW5nZSA9IHBhcnNlZEJvZHkucmFuZ2UgJiYgUmFuZ2UubGlmdChwYXJzZWRCb2R5LnJhbmdlKTtcblx0XHRcdFx0XHRcdHRleHRNb2RlbCA9IHRoaXMudGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShwYXJzZWRCb2R5LnVyaSkudGhlbihyZWYgPT4gcmVmLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdHJldHVybiAkKCdkaXYnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3Qgc2Vzc2lvbklkID0gaXNSZXNwb25zZVZNKGVsZW1lbnQpIHx8IGlzUmVxdWVzdFZNKGVsZW1lbnQpID8gZWxlbWVudC5zZXNzaW9uSWQgOiAnJztcblx0XHRcdFx0XHRjb25zdCBtb2RlbEVudHJ5ID0gdGhpcy5jb2RlQmxvY2tNb2RlbENvbGxlY3Rpb24uZ2V0T3JDcmVhdGUoc2Vzc2lvbklkLCBlbGVtZW50LCBnbG9iYWxJbmRleCk7XG5cdFx0XHRcdFx0Y29uc3QgZmFzdFVwZGF0ZU1vZGVsRW50cnkgPSB0aGlzLmNvZGVCbG9ja01vZGVsQ29sbGVjdGlvbi51cGRhdGVTeW5jKHNlc3Npb25JZCwgZWxlbWVudCwgZ2xvYmFsSW5kZXgsIHsgdGV4dCwgbGFuZ3VhZ2VJZCwgaXNDb21wbGV0ZTogaXNDb2RlQmxvY2tDb21wbGV0ZSB9KTtcblx0XHRcdFx0XHR2dWxucyA9IG1vZGVsRW50cnkudnVsbnM7XG5cdFx0XHRcdFx0Y29kZWJsb2NrRW50cnkgPSBmYXN0VXBkYXRlTW9kZWxFbnRyeTtcblx0XHRcdFx0XHR0ZXh0TW9kZWwgPSBtb2RlbEVudHJ5Lm1vZGVsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgaGlkZVRvb2xiYXIgPSBpc1Jlc3BvbnNlVk0oZWxlbWVudCkgJiYgZWxlbWVudC5lcnJvckRldGFpbHM/LnJlc3BvbnNlSXNGaWx0ZXJlZDtcblx0XHRcdFx0Y29uc3QgcmVuZGVyT3B0aW9ucyA9IHtcblx0XHRcdFx0XHQuLi50aGlzLnJlbmRlcmVyT3B0aW9ucy5jb2RlQmxvY2tSZW5kZXJPcHRpb25zLFxuXHRcdFx0XHR9O1xuXHRcdFx0XHRpZiAoaGlkZVRvb2xiYXIgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJlbmRlck9wdGlvbnMuaGlkZVRvb2xiYXIgPSBoaWRlVG9vbGJhcjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBjb2RlQmxvY2tJbmZvOiBJQ29kZUJsb2NrRGF0YSA9IHsgbGFuZ3VhZ2VJZCwgdGV4dE1vZGVsLCBjb2RlQmxvY2tJbmRleDogZ2xvYmFsSW5kZXgsIGNvZGVCbG9ja1BhcnRJbmRleDogdGhpc1BhcnRJbmRleCwgZWxlbWVudCwgcmFuZ2UsIHBhcmVudENvbnRleHRLZXlTZXJ2aWNlOiBjb250ZXh0S2V5U2VydmljZSwgdnVsbnMsIGNvZGVtYXBwZXJVcmk6IGNvZGVibG9ja0VudHJ5Py5jb2RlbWFwcGVyVXJpLCByZW5kZXJPcHRpb25zIH07XG5cblx0XHRcdFx0aWYgKGVsZW1lbnQuaXNDb21wbGV0ZUFkZGVkUmVxdWVzdCB8fCAhY29kZWJsb2NrRW50cnk/LmNvZGVtYXBwZXJVcmkgfHwgIWNvZGVibG9ja0VudHJ5LmlzRWRpdCkge1xuXHRcdFx0XHRcdGNvbnN0IHJlZiA9IHRoaXMucmVuZGVyQ29kZUJsb2NrKGNvZGVCbG9ja0luZm8sIHRleHQsIGlzQ29kZUJsb2NrQ29tcGxldGUsIGN1cnJlbnRXaWR0aCk7XG5cdFx0XHRcdFx0dGhpcy5hbGxSZWZzLnB1c2gocmVmKTtcblxuXHRcdFx0XHRcdC8vIEF0dGFjaCB0aGlzIGFmdGVyIHVwZGF0aW5nIHRleHQvbGF5b3V0IG9mIHRoZSBlZGl0b3IsIHNvIGl0IHNob3VsZCBvbmx5IGJlIGZpcmVkIHdoZW4gdGhlIHNpemUgdXBkYXRlcyBsYXRlciAoaG9yaXpvbnRhbCBzY3JvbGxiYXIsIHdyYXBwaW5nKVxuXHRcdFx0XHRcdC8vIG5vdCBkdXJpbmcgYSByZW5kZXJFbGVtZW50IE9SIGEgcHJvZ3Jlc3NpdmUgcmVuZGVyICh3aGVuIHdlIHdpbGwgYmUgZmlyaW5nIHRoaXMgZXZlbnQgYW55d2F5IGF0IHRoZSBlbmQgb2YgdGhlIHJlbmRlcilcblx0XHRcdFx0XHR0aGlzLl9yZWdpc3RlcihyZWYub2JqZWN0Lm9uRGlkQ2hhbmdlQ29udGVudEhlaWdodCgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCkpKTtcblxuXHRcdFx0XHRcdGNvbnN0IG93bmVyTWFya2Rvd25QYXJ0SWQgPSB0aGlzLmNvZGVibG9ja3NQYXJ0SWQ7XG5cdFx0XHRcdFx0Y29uc3QgaW5mbzogSUNoYXRDb2RlQmxvY2tJbmZvID0gbmV3IGNsYXNzIGltcGxlbWVudHMgSUNoYXRDb2RlQmxvY2tJbmZvIHtcblx0XHRcdFx0XHRcdHJlYWRvbmx5IG93bmVyTWFya2Rvd25QYXJ0SWQgPSBvd25lck1hcmtkb3duUGFydElkO1xuXHRcdFx0XHRcdFx0cmVhZG9ubHkgY29kZUJsb2NrSW5kZXggPSBnbG9iYWxJbmRleDtcblx0XHRcdFx0XHRcdHJlYWRvbmx5IGVsZW1lbnRJZCA9IGVsZW1lbnQuaWQ7XG5cdFx0XHRcdFx0XHRyZWFkb25seSBpc1N0cmVhbWluZyA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0Y29kZW1hcHBlclVyaSA9IHVuZGVmaW5lZDsgLy8gd2lsbCBiZSBzZXQgYXN5bmNcblx0XHRcdFx0XHRcdHB1YmxpYyBnZXQgdXJpKCkge1xuXHRcdFx0XHRcdFx0XHQvLyBoZXJlIHdlIG11c3QgZG8gYSBnZXR0ZXIgYmVjYXVzZSB0aGUgcmVmLm9iamVjdCBpcyByZW5kZXJlZFxuXHRcdFx0XHRcdFx0XHQvLyBhc3luYyBhbmQgdGhlIHVyaSBtaWdodCBiZSB1bmRlZmluZWQgd2hlbiBpdCdzIHJlYWQgaW1tZWRpYXRlbHlcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHJlZi5vYmplY3QudXJpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmVhZG9ubHkgdXJpUHJvbWlzZSA9IHRleHRNb2RlbC50aGVuKG1vZGVsID0+IG1vZGVsLnVyaSk7XG5cdFx0XHRcdFx0XHRwdWJsaWMgZm9jdXMoKSB7XG5cdFx0XHRcdFx0XHRcdHJlZi5vYmplY3QuZm9jdXMoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KCk7XG5cdFx0XHRcdFx0dGhpcy5jb2RlYmxvY2tzLnB1c2goaW5mbyk7XG5cdFx0XHRcdFx0b3JkZXJlZERpc3Bvc2FibGVzTGlzdC5wdXNoKHJlZik7XG5cdFx0XHRcdFx0cmV0dXJuIHJlZi5vYmplY3QuZWxlbWVudDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCByZXF1ZXN0SWQgPSBpc1JlcXVlc3RWTShlbGVtZW50KSA/IGVsZW1lbnQuaWQgOiBlbGVtZW50LnJlcXVlc3RJZDtcblx0XHRcdFx0XHRjb25zdCByZWYgPSB0aGlzLnJlbmRlckNvZGVCbG9ja1BpbGwoZWxlbWVudC5zZXNzaW9uSWQsIHJlcXVlc3RJZCwgaW5VbmRvU3RvcCwgY29kZUJsb2NrSW5mby5jb2RlbWFwcGVyVXJpLCAhaXNDb2RlQmxvY2tDb21wbGV0ZSk7XG5cdFx0XHRcdFx0aWYgKGlzUmVzcG9uc2VWTShjb2RlQmxvY2tJbmZvLmVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0XHQvLyBUT0RPQGpveWNlZXJobDogcmVtb3ZlIHRoaXMgY29kZSB3aGVuIHdlIGNoYW5nZSB0aGUgY29kZWJsb2NrVXJpIEFQSSB0byBtYWtlIHRoZSBVUkkgYXZhaWxhYmxlIHN5bmNocm9ub3VzbHlcblx0XHRcdFx0XHRcdHRoaXMuY29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uLnVwZGF0ZShjb2RlQmxvY2tJbmZvLmVsZW1lbnQuc2Vzc2lvbklkLCBjb2RlQmxvY2tJbmZvLmVsZW1lbnQsIGNvZGVCbG9ja0luZm8uY29kZUJsb2NrSW5kZXgsIHsgdGV4dCwgbGFuZ3VhZ2VJZDogY29kZUJsb2NrSW5mby5sYW5ndWFnZUlkLCBpc0NvbXBsZXRlOiBpc0NvZGVCbG9ja0NvbXBsZXRlIH0pLnRoZW4oKGUpID0+IHtcblx0XHRcdFx0XHRcdFx0Ly8gVXBkYXRlIHRoZSBleGlzdGluZyBvYmplY3QncyBjb2RlbWFwcGVyVXJpXG5cdFx0XHRcdFx0XHRcdHRoaXMuY29kZWJsb2Nrc1tjb2RlQmxvY2tJbmZvLmNvZGVCbG9ja1BhcnRJbmRleF0uY29kZW1hcHBlclVyaSA9IGUuY29kZW1hcHBlclVyaTtcblx0XHRcdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuYWxsUmVmcy5wdXNoKHJlZik7XG5cdFx0XHRcdFx0Y29uc3Qgb3duZXJNYXJrZG93blBhcnRJZCA9IHRoaXMuY29kZWJsb2Nrc1BhcnRJZDtcblx0XHRcdFx0XHRjb25zdCBpbmZvOiBJQ2hhdENvZGVCbG9ja0luZm8gPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJQ2hhdENvZGVCbG9ja0luZm8ge1xuXHRcdFx0XHRcdFx0cmVhZG9ubHkgb3duZXJNYXJrZG93blBhcnRJZCA9IG93bmVyTWFya2Rvd25QYXJ0SWQ7XG5cdFx0XHRcdFx0XHRyZWFkb25seSBjb2RlQmxvY2tJbmRleCA9IGdsb2JhbEluZGV4O1xuXHRcdFx0XHRcdFx0cmVhZG9ubHkgZWxlbWVudElkID0gZWxlbWVudC5pZDtcblx0XHRcdFx0XHRcdHJlYWRvbmx5IGlzU3RyZWFtaW5nID0gIWlzQ29kZUJsb2NrQ29tcGxldGU7XG5cdFx0XHRcdFx0XHRyZWFkb25seSBjb2RlbWFwcGVyVXJpID0gY29kZWJsb2NrRW50cnk/LmNvZGVtYXBwZXJVcmk7XG5cdFx0XHRcdFx0XHRwdWJsaWMgZ2V0IHVyaSgpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJlYWRvbmx5IHVyaVByb21pc2UgPSBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0XHRcdHB1YmxpYyBmb2N1cygpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHJlZi5vYmplY3QuZWxlbWVudC5mb2N1cygpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0oKTtcblx0XHRcdFx0XHR0aGlzLmNvZGVibG9ja3MucHVzaChpbmZvKTtcblx0XHRcdFx0XHRvcmRlcmVkRGlzcG9zYWJsZXNMaXN0LnB1c2gocmVmKTtcblx0XHRcdFx0XHRyZXR1cm4gcmVmLm9iamVjdC5lbGVtZW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YXN5bmNSZW5kZXJDYWxsYmFjazogKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpLFxuXHRcdH0sIG1hcmtlZE9wdHMpKTtcblxuXHRcdGNvbnN0IG1hcmtkb3duRGVjb3JhdGlvbnNSZW5kZXJlciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRNYXJrZG93bkRlY29yYXRpb25zUmVuZGVyZXIpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG1hcmtkb3duRGVjb3JhdGlvbnNSZW5kZXJlci53YWxrVHJlZUFuZEFubm90YXRlUmVmZXJlbmNlTGlua3MobWFya2Rvd24sIHJlc3VsdC5lbGVtZW50KSk7XG5cblx0XHRvcmRlcmVkRGlzcG9zYWJsZXNMaXN0LnJldmVyc2UoKS5mb3JFYWNoKGQgPT4gdGhpcy5fcmVnaXN0ZXIoZCkpO1xuXHRcdHRoaXMuZG9tTm9kZSA9IHJlc3VsdC5lbGVtZW50O1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJDb2RlQmxvY2tQaWxsKHNlc3Npb25JZDogc3RyaW5nLCByZXF1ZXN0SWQ6IHN0cmluZywgaW5VbmRvU3RvcDogc3RyaW5nIHwgdW5kZWZpbmVkLCBjb2RlbWFwcGVyVXJpOiBVUkkgfCB1bmRlZmluZWQsIGlzU3RyZWFtaW5nOiBib29sZWFuKTogSURpc3Bvc2FibGVSZWZlcmVuY2U8Q29sbGFwc2VkQ29kZUJsb2NrPiB7XG5cdFx0Y29uc3QgY29kZUJsb2NrID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb2xsYXBzZWRDb2RlQmxvY2ssIHNlc3Npb25JZCwgcmVxdWVzdElkLCBpblVuZG9TdG9wKTtcblx0XHRpZiAoY29kZW1hcHBlclVyaSkge1xuXHRcdFx0Y29kZUJsb2NrLnJlbmRlcihjb2RlbWFwcGVyVXJpLCBpc1N0cmVhbWluZyk7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRvYmplY3Q6IGNvZGVCbG9jayxcblx0XHRcdGlzU3RhbGU6ICgpID0+IGZhbHNlLFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4gY29kZUJsb2NrLmRpc3Bvc2UoKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckNvZGVCbG9jayhkYXRhOiBJQ29kZUJsb2NrRGF0YSwgdGV4dDogc3RyaW5nLCBpc0NvbXBsZXRlOiBib29sZWFuLCBjdXJyZW50V2lkdGg6IG51bWJlcik6IElEaXNwb3NhYmxlUmVmZXJlbmNlPENvZGVCbG9ja1BhcnQ+IHtcblx0XHRjb25zdCByZWYgPSB0aGlzLmVkaXRvclBvb2wuZ2V0KCk7XG5cdFx0Y29uc3QgZWRpdG9ySW5mbyA9IHJlZi5vYmplY3Q7XG5cdFx0aWYgKGlzUmVzcG9uc2VWTShkYXRhLmVsZW1lbnQpKSB7XG5cdFx0XHR0aGlzLmNvZGVCbG9ja01vZGVsQ29sbGVjdGlvbi51cGRhdGUoZGF0YS5lbGVtZW50LnNlc3Npb25JZCwgZGF0YS5lbGVtZW50LCBkYXRhLmNvZGVCbG9ja0luZGV4LCB7IHRleHQsIGxhbmd1YWdlSWQ6IGRhdGEubGFuZ3VhZ2VJZCwgaXNDb21wbGV0ZSB9KS50aGVuKChlKSA9PiB7XG5cdFx0XHRcdC8vIFVwZGF0ZSB0aGUgZXhpc3Rpbmcgb2JqZWN0J3MgY29kZW1hcHBlclVyaVxuXHRcdFx0XHR0aGlzLmNvZGVibG9ja3NbZGF0YS5jb2RlQmxvY2tQYXJ0SW5kZXhdLmNvZGVtYXBwZXJVcmkgPSBlLmNvZGVtYXBwZXJVcmk7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlSGVpZ2h0LmZpcmUoKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGVkaXRvckluZm8ucmVuZGVyKGRhdGEsIGN1cnJlbnRXaWR0aCk7XG5cblx0XHRyZXR1cm4gcmVmO1xuXHR9XG5cblx0aGFzU2FtZUNvbnRlbnQob3RoZXI6IElDaGF0UHJvZ3Jlc3NSZW5kZXJhYmxlUmVzcG9uc2VDb250ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIG90aGVyLmtpbmQgPT09ICdtYXJrZG93bkNvbnRlbnQnICYmICEhKG90aGVyLmNvbnRlbnQudmFsdWUgPT09IHRoaXMubWFya2Rvd24uY29udGVudC52YWx1ZVxuXHRcdFx0fHwgdGhpcy5jb2RlYmxvY2tzLmF0KC0xKT8uaXNTdHJlYW1pbmcgJiYgdGhpcy5jb2RlYmxvY2tzLmF0KC0xKT8uY29kZW1hcHBlclVyaSAhPT0gdW5kZWZpbmVkICYmIG90aGVyLmNvbnRlbnQudmFsdWUubGFzdEluZGV4T2YoJ2BgYCcpID09PSB0aGlzLm1hcmtkb3duLmNvbnRlbnQudmFsdWUubGFzdEluZGV4T2YoJ2BgYCcpKTtcblx0fVxuXG5cdGxheW91dCh3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5hbGxSZWZzLmZvckVhY2goKHJlZiwgaW5kZXgpID0+IHtcblx0XHRcdGlmIChyZWYub2JqZWN0IGluc3RhbmNlb2YgQ29kZUJsb2NrUGFydCkge1xuXHRcdFx0XHRyZWYub2JqZWN0LmxheW91dCh3aWR0aCk7XG5cdFx0XHR9IGVsc2UgaWYgKHJlZi5vYmplY3QgaW5zdGFuY2VvZiBDb2xsYXBzZWRDb2RlQmxvY2spIHtcblx0XHRcdFx0Y29uc3QgY29kZWJsb2NrTW9kZWwgPSB0aGlzLmNvZGVibG9ja3NbaW5kZXhdO1xuXHRcdFx0XHRpZiAoY29kZWJsb2NrTW9kZWwuY29kZW1hcHBlclVyaSAmJiByZWYub2JqZWN0LnVyaT8udG9TdHJpbmcoKSAhPT0gY29kZWJsb2NrTW9kZWwuY29kZW1hcHBlclVyaS50b1N0cmluZygpKSB7XG5cdFx0XHRcdFx0cmVmLm9iamVjdC5yZW5kZXIoY29kZWJsb2NrTW9kZWwuY29kZW1hcHBlclVyaSwgY29kZWJsb2NrTW9kZWwuaXNTdHJlYW1pbmcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhZGREaXNwb3NhYmxlKGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZGlzcG9zYWJsZSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEVkaXRvclBvb2wgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9wb29sOiBSZXNvdXJjZVBvb2w8Q29kZUJsb2NrUGFydD47XG5cblx0cHVibGljIGluVXNlKCk6IEl0ZXJhYmxlPENvZGVCbG9ja1BhcnQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fcG9vbC5pblVzZTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdGlvbnM6IENoYXRFZGl0b3JPcHRpb25zLFxuXHRcdGRlbGVnYXRlOiBJQ2hhdFJlbmRlcmVyRGVsZWdhdGUsXG5cdFx0b3ZlcmZsb3dXaWRnZXRzRG9tTm9kZTogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3Bvb2wgPSB0aGlzLl9yZWdpc3RlcihuZXcgUmVzb3VyY2VQb29sKCgpID0+IHtcblx0XHRcdHJldHVybiBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb2RlQmxvY2tQYXJ0LCBvcHRpb25zLCBNZW51SWQuQ2hhdENvZGVCbG9jaywgZGVsZWdhdGUsIG92ZXJmbG93V2lkZ2V0c0RvbU5vZGUpO1xuXHRcdH0pKTtcblx0fVxuXG5cdGdldCgpOiBJRGlzcG9zYWJsZVJlZmVyZW5jZTxDb2RlQmxvY2tQYXJ0PiB7XG5cdFx0Y29uc3QgY29kZUJsb2NrID0gdGhpcy5fcG9vbC5nZXQoKTtcblx0XHRsZXQgc3RhbGUgPSBmYWxzZTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0b2JqZWN0OiBjb2RlQmxvY2ssXG5cdFx0XHRpc1N0YWxlOiAoKSA9PiBzdGFsZSxcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0Y29kZUJsb2NrLnJlc2V0KCk7XG5cdFx0XHRcdHN0YWxlID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5fcG9vbC5yZWxlYXNlKGNvZGVCbG9jayk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxufVxuXG5mdW5jdGlvbiBjb2RlYmxvY2tIYXNDbG9zaW5nQmFja3RpY2tzKHN0cjogc3RyaW5nKTogYm9vbGVhbiB7XG5cdHN0ciA9IHN0ci50cmltKCk7XG5cdHJldHVybiAhIXN0ci5tYXRjaCgvXFxuYGBgKyQvKTtcbn1cblxuY2xhc3MgQ29sbGFwc2VkQ29kZUJsb2NrIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHVibGljIHJlYWRvbmx5IGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgaG92ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgdG9vbHRpcDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX3VyaTogVVJJIHwgdW5kZWZpbmVkO1xuXHRwdWJsaWMgZ2V0IHVyaSgpOiBVUkkgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl91cmk7XG5cdH1cblxuXHRwcml2YXRlIF9jdXJyZW50RGlmZjogSUVkaXRTZXNzaW9uRW50cnlEaWZmIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb2dyZXNzU3RvcmUgPSB0aGlzLl9zdG9yZS5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHNlc3Npb25JZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcmVxdWVzdElkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBpblVuZG9TdG9wOiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElDaGF0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNoYXRTZXJ2aWNlOiBJQ2hhdFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5lbGVtZW50ID0gJCgnLmNoYXQtY29kZWJsb2NrLXBpbGwtd2lkZ2V0Jyk7XG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3Nob3ctZmlsZS1pY29ucycpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5lbGVtZW50LCAnY2xpY2snLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fY3VycmVudERpZmYpIHtcblx0XHRcdFx0dGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRcdG9yaWdpbmFsOiB7IHJlc291cmNlOiB0aGlzLl9jdXJyZW50RGlmZi5vcmlnaW5hbFVSSSB9LFxuXHRcdFx0XHRcdG1vZGlmaWVkOiB7IHJlc291cmNlOiB0aGlzLl9jdXJyZW50RGlmZi5tb2RpZmllZFVSSSB9LFxuXHRcdFx0XHRcdG9wdGlvbnM6IHsgdHJhbnNpZW50OiB0cnVlIH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLnVyaSkge1xuXHRcdFx0XHR0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiB0aGlzLnVyaSB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIGRvbS5FdmVudFR5cGUuQ09OVEVYVF9NRU5VLCBkb21FdmVudCA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQoZG9tLmdldFdpbmRvdyhkb21FdmVudCksIGRvbUV2ZW50KTtcblx0XHRcdGRvbS5FdmVudEhlbHBlci5zdG9wKGRvbUV2ZW50LCB0cnVlKTtcblxuXHRcdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdFx0Y29udGV4dEtleVNlcnZpY2U6IHRoaXMuY29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRcdGdldEFuY2hvcjogKCkgPT4gZXZlbnQsXG5cdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBtZW51ID0gdGhpcy5tZW51U2VydmljZS5nZXRNZW51QWN0aW9ucyhNZW51SWQuQ2hhdEVkaXRpbmdDb2RlQmxvY2tDb250ZXh0LCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLCB7IGFyZzogeyBzZXNzaW9uSWQsIHJlcXVlc3RJZCwgdXJpOiB0aGlzLnVyaSwgc3RvcElkOiBpblVuZG9TdG9wIH0gfSk7XG5cdFx0XHRcdFx0cmV0dXJuIGdldEZsYXRDb250ZXh0TWVudUFjdGlvbnMobWVudSk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cdH1cblxuXHRyZW5kZXIodXJpOiBVUkksIGlzU3RyZWFtaW5nPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX3Byb2dyZXNzU3RvcmUuY2xlYXIoKTtcblxuXHRcdHRoaXMuX3VyaSA9IHVyaTtcblxuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLmNoYXRTZXJ2aWNlLmdldFNlc3Npb24odGhpcy5zZXNzaW9uSWQpO1xuXHRcdGNvbnN0IGljb25UZXh0ID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbCh1cmkpO1xuXG5cdFx0bGV0IGVkaXRTZXNzaW9uID0gc2Vzc2lvbj8uZWRpdGluZ1Nlc3Npb25PYnM/LnByb21pc2VSZXN1bHQuZ2V0KCk/LmRhdGE7XG5cdFx0bGV0IG1vZGlmaWVkRW50cnkgPSBlZGl0U2Vzc2lvbj8uZ2V0RW50cnkodXJpKTtcblx0XHRsZXQgbW9kaWZpZWRCeVJlc3BvbnNlID0gbW9kaWZpZWRFbnRyeT8uaXNDdXJyZW50bHlCZWluZ01vZGlmaWVkQnkuZ2V0KCk7XG5cdFx0Y29uc3QgaXNDb21wbGV0ZSA9ICFtb2RpZmllZEJ5UmVzcG9uc2UgfHwgbW9kaWZpZWRCeVJlc3BvbnNlLnJlcXVlc3RJZCAhPT0gdGhpcy5yZXF1ZXN0SWQ7XG5cblx0XHRsZXQgaWNvbkNsYXNzZXM6IHN0cmluZ1tdID0gW107XG5cdFx0aWYgKGlzU3RyZWFtaW5nIHx8ICFpc0NvbXBsZXRlKSB7XG5cdFx0XHRjb25zdCBjb2RpY29uID0gVGhlbWVJY29uLm1vZGlmeShDb2RpY29uLmxvYWRpbmcsICdzcGluJyk7XG5cdFx0XHRpY29uQ2xhc3NlcyA9IFRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KGNvZGljb24pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBmaWxlS2luZCA9IHVyaS5wYXRoLmVuZHNXaXRoKCcvJykgPyBGaWxlS2luZC5GT0xERVIgOiBGaWxlS2luZC5GSUxFO1xuXHRcdFx0aWNvbkNsYXNzZXMgPSBnZXRJY29uQ2xhc3Nlcyh0aGlzLm1vZGVsU2VydmljZSwgdGhpcy5sYW5ndWFnZVNlcnZpY2UsIHVyaSwgZmlsZUtpbmQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGljb25FbCA9IGRvbS4kKCdzcGFuLmljb24nKTtcblx0XHRpY29uRWwuY2xhc3NMaXN0LmFkZCguLi5pY29uQ2xhc3Nlcyk7XG5cblx0XHRjb25zdCBjaGlsZHJlbiA9IFtkb20uJCgnc3Bhbi5pY29uLWxhYmVsJywge30sIGljb25UZXh0KV07XG5cdFx0Y29uc3QgbGFiZWxEZXRhaWwgPSBkb20uJCgnc3Bhbi5sYWJlbC1kZXRhaWwnLCB7fSwgJycpO1xuXHRcdGNoaWxkcmVuLnB1c2gobGFiZWxEZXRhaWwpO1xuXHRcdGlmIChpc1N0cmVhbWluZykge1xuXHRcdFx0bGFiZWxEZXRhaWwudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgnY2hhdC5jb2RlYmxvY2suZ2VuZXJhdGluZycsIFwiR2VuZXJhdGluZyBlZGl0cy4uLlwiKTtcblx0XHR9XG5cblx0XHR0aGlzLmVsZW1lbnQucmVwbGFjZUNoaWxkcmVuKGljb25FbCwgLi4uY2hpbGRyZW4pO1xuXHRcdHRoaXMudXBkYXRlVG9vbHRpcCh0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbCh1cmksIHsgcmVsYXRpdmU6IGZhbHNlIH0pKTtcblxuXHRcdGNvbnN0IHJlbmRlckRpZmYgPSAoY2hhbmdlczogSUVkaXRTZXNzaW9uRW50cnlEaWZmIHwgdW5kZWZpbmVkKSA9PiB7XG5cdFx0XHRjb25zdCBsYWJlbEFkZGVkID0gdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5sYWJlbC1hZGRlZCcpID8/IHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZChkb20uJCgnc3Bhbi5sYWJlbC1hZGRlZCcpKTtcblx0XHRcdGNvbnN0IGxhYmVsUmVtb3ZlZCA9IHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcubGFiZWwtcmVtb3ZlZCcpID8/IHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZChkb20uJCgnc3Bhbi5sYWJlbC1yZW1vdmVkJykpO1xuXHRcdFx0aWYgKGNoYW5nZXMgJiYgIWNoYW5nZXM/LmlkZW50aWNhbCAmJiAhY2hhbmdlcz8ucXVpdEVhcmx5KSB7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnREaWZmID0gY2hhbmdlcztcblx0XHRcdFx0bGFiZWxBZGRlZC50ZXh0Q29udGVudCA9IGArJHtjaGFuZ2VzLmFkZGVkfWA7XG5cdFx0XHRcdGxhYmVsUmVtb3ZlZC50ZXh0Q29udGVudCA9IGAtJHtjaGFuZ2VzLnJlbW92ZWR9YDtcblx0XHRcdFx0Y29uc3QgaW5zZXJ0aW9uc0ZyYWdtZW50ID0gY2hhbmdlcy5hZGRlZCA9PT0gMSA/IGxvY2FsaXplKCdjaGF0LmNvZGVibG9jay5pbnNlcnRpb25zLm9uZScsIFwiMSBpbnNlcnRpb25cIikgOiBsb2NhbGl6ZSgnY2hhdC5jb2RlYmxvY2suaW5zZXJ0aW9ucycsIFwiezB9IGluc2VydGlvbnNcIiwgY2hhbmdlcy5hZGRlZCk7XG5cdFx0XHRcdGNvbnN0IGRlbGV0aW9uc0ZyYWdtZW50ID0gY2hhbmdlcy5yZW1vdmVkID09PSAxID8gbG9jYWxpemUoJ2NoYXQuY29kZWJsb2NrLmRlbGV0aW9ucy5vbmUnLCBcIjEgZGVsZXRpb25cIikgOiBsb2NhbGl6ZSgnY2hhdC5jb2RlYmxvY2suZGVsZXRpb25zJywgXCJ7MH0gZGVsZXRpb25zXCIsIGNoYW5nZXMucmVtb3ZlZCk7XG5cdFx0XHRcdGNvbnN0IHN1bW1hcnkgPSBsb2NhbGl6ZSgnc3VtbWFyeScsICdFZGl0ZWQgezB9LCB7MX0sIHsyfScsIGljb25UZXh0LCBpbnNlcnRpb25zRnJhZ21lbnQsIGRlbGV0aW9uc0ZyYWdtZW50KTtcblx0XHRcdFx0dGhpcy5lbGVtZW50LmFyaWFMYWJlbCA9IHN1bW1hcnk7XG5cdFx0XHRcdHRoaXMudXBkYXRlVG9vbHRpcChzdW1tYXJ5KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0bGV0IGRpZmZCZXR3ZWVuU3RvcHM6IElPYnNlcnZhYmxlPElFZGl0U2Vzc2lvbkVudHJ5RGlmZiB8IHVuZGVmaW5lZD4gfCB1bmRlZmluZWQ7XG5cblx0XHQvLyBTaG93IGEgcGVyY2VudGFnZSBwcm9ncmVzcyB0aGF0IGlzIGRyaXZlbiBieSB0aGUgcmV3cml0ZVxuXG5cdFx0dGhpcy5fcHJvZ3Jlc3NTdG9yZS5hZGQoYXV0b3J1bihyID0+IHtcblx0XHRcdGlmICghZWRpdFNlc3Npb24pIHtcblx0XHRcdFx0ZWRpdFNlc3Npb24gPSBzZXNzaW9uPy5lZGl0aW5nU2Vzc2lvbk9icz8ucHJvbWlzZVJlc3VsdC5yZWFkKHIpPy5kYXRhO1xuXHRcdFx0XHRtb2RpZmllZEVudHJ5ID0gZWRpdFNlc3Npb24/LmdldEVudHJ5KHVyaSk7XG5cdFx0XHR9XG5cblx0XHRcdG1vZGlmaWVkQnlSZXNwb25zZSA9IG1vZGlmaWVkRW50cnk/LmlzQ3VycmVudGx5QmVpbmdNb2RpZmllZEJ5LnJlYWQocik7XG5cdFx0XHRjb25zdCBpc0NvbXBsZXRlID0gIW1vZGlmaWVkQnlSZXNwb25zZSB8fCBtb2RpZmllZEJ5UmVzcG9uc2UucmVxdWVzdElkICE9PSB0aGlzLnJlcXVlc3RJZDtcblx0XHRcdGNvbnN0IHJld3JpdGVSYXRpbyA9IG1vZGlmaWVkRW50cnk/LnJld3JpdGVSYXRpby5yZWFkKHIpO1xuXG5cdFx0XHRpZiAoIWlzU3RyZWFtaW5nICYmICFpc0NvbXBsZXRlKSB7XG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gcmV3cml0ZVJhdGlvO1xuXHRcdFx0XHRsYWJlbERldGFpbC50ZXh0Q29udGVudCA9IHZhbHVlID09PSAwIHx8ICF2YWx1ZSA/IGxvY2FsaXplKCdjaGF0LmNvZGVibG9jay5nZW5lcmF0aW5nJywgXCJHZW5lcmF0aW5nIGVkaXRzLi4uXCIpIDogbG9jYWxpemUoJ2NoYXQuY29kZWJsb2NrLmFwcGx5aW5nUGVyY2VudGFnZScsIFwiQXBwbHlpbmcgZWRpdHMgKHswfSUpLi4uXCIsIE1hdGgucm91bmQodmFsdWUgKiAxMDApKTtcblx0XHRcdH0gZWxzZSBpZiAoIWlzU3RyZWFtaW5nICYmIGlzQ29tcGxldGUpIHtcblx0XHRcdFx0aWNvbkVsLmNsYXNzTGlzdC5yZW1vdmUoLi4uaWNvbkNsYXNzZXMpO1xuXHRcdFx0XHRjb25zdCBmaWxlS2luZCA9IHVyaS5wYXRoLmVuZHNXaXRoKCcvJykgPyBGaWxlS2luZC5GT0xERVIgOiBGaWxlS2luZC5GSUxFO1xuXHRcdFx0XHRpY29uRWwuY2xhc3NMaXN0LmFkZCguLi5nZXRJY29uQ2xhc3Nlcyh0aGlzLm1vZGVsU2VydmljZSwgdGhpcy5sYW5ndWFnZVNlcnZpY2UsIHVyaSwgZmlsZUtpbmQpKTtcblx0XHRcdFx0bGFiZWxEZXRhaWwudGV4dENvbnRlbnQgPSAnJztcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFkaWZmQmV0d2VlblN0b3BzKSB7XG5cdFx0XHRcdGRpZmZCZXR3ZWVuU3RvcHMgPSBtb2RpZmllZEVudHJ5ICYmIGVkaXRTZXNzaW9uXG5cdFx0XHRcdFx0PyBlZGl0U2Vzc2lvbi5nZXRFbnRyeURpZmZCZXR3ZWVuU3RvcHMobW9kaWZpZWRFbnRyeS5tb2RpZmllZFVSSSwgdGhpcy5yZXF1ZXN0SWQsIHRoaXMuaW5VbmRvU3RvcClcblx0XHRcdFx0XHQ6IHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFpc1N0cmVhbWluZyAmJiBpc0NvbXBsZXRlICYmIGRpZmZCZXR3ZWVuU3RvcHMpIHtcblx0XHRcdFx0cmVuZGVyRGlmZihkaWZmQmV0d2VlblN0b3BzLnJlYWQocikpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlVG9vbHRpcCh0b29sdGlwOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnRvb2x0aXAgPSB0b29sdGlwO1xuXHRcdGlmICghdGhpcy5ob3Zlci52YWx1ZSkge1xuXHRcdFx0dGhpcy5ob3Zlci52YWx1ZSA9IHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwRGVsYXllZEhvdmVyKHRoaXMuZWxlbWVudCwgKCkgPT4gKFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y29udGVudDogdGhpcy50b29sdGlwISxcblx0XHRcdFx0XHRhcHBlYXJhbmNlOiB7IGNvbXBhY3Q6IHRydWUsIHNob3dQb2ludGVyOiB0cnVlIH0sXG5cdFx0XHRcdFx0cG9zaXRpb246IHsgaG92ZXJQb3NpdGlvbjogSG92ZXJQb3NpdGlvbi5CRUxPVyB9LFxuXHRcdFx0XHRcdHBlcnNpc3RlbmNlOiB7IGhpZGVPbktleURvd246IHRydWUgfSxcblx0XHRcdFx0fVxuXHRcdFx0KSk7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWSxpQkFBOEIseUJBQXlCO0FBQzVFLFNBQVMsZUFBNEI7QUFDckMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxpQkFBaUI7QUFHMUIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsY0FBYyxjQUFjO0FBQ3JDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsc0JBQXNCO0FBSS9CLFNBQStCLG9CQUFtQztBQUNsRSxTQUFTLGFBQWEsb0JBQW9CO0FBSTFDLFNBQVMsdUNBQXVDO0FBRWhELFNBQVMsZUFBd0QscUJBQXFCLDBCQUEwQjtBQUNoSCxPQUFPO0FBQ1AsU0FBK0Isb0JBQW9CO0FBR25ELE1BQU0sSUFBSSxJQUFJO0FBTVAsSUFBTSwwQkFBTixjQUFzQyxXQUF1QztBQUFBLEVBV25GLFlBQ2tCLFVBQ2pCLFNBQ2lCLFlBQ2pCLHlCQUF5QixPQUN6QixzQkFBc0IsR0FDdEIsVUFDQSxjQUNpQiwwQkFDQSxpQkFDRyxtQkFDZ0Isa0JBQ0ksc0JBQ3ZDO0FBQ0QsVUFBTTtBQWJXO0FBRUE7QUFLQTtBQUNBO0FBRW1CO0FBQ0k7QUFyQnpDLFNBQWdCLG1CQUFtQixPQUFPLEVBQUUsd0JBQXdCLE1BQU07QUFFMUUsU0FBaUIsVUFBc0UsQ0FBQztBQUV4RixTQUFpQixxQkFBcUIsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQ3hFLFNBQWdCLG9CQUFvQixLQUFLLG1CQUFtQjtBQUU1RCxTQUFnQixhQUFtQyxDQUFDO0FBa0JuRCxVQUFNLFVBQVUsUUFBUTtBQUN4QixVQUFNLGFBQWMsU0FBUyxRQUFRLFNBQVMsT0FBSyxFQUFFLFNBQVMsWUFBWSxRQUFRLFlBQVksR0FBaUM7QUFHL0gsVUFBTSx5QkFBd0MsQ0FBQztBQUkvQyxRQUFJLDRCQUE0QjtBQUNoQyxRQUFJLDhCQUE4QjtBQUdsQyxVQUFNLGFBQWEsWUFBWSxPQUFPLElBQUk7QUFBQSxNQUN6QyxLQUFLO0FBQUEsTUFDTCxRQUFRO0FBQUEsSUFDVCxJQUFJO0FBRUosVUFBTSxTQUFTLEtBQUssVUFBVSxTQUFTLE9BQU8sU0FBUyxTQUFTO0FBQUEsTUFDL0Q7QUFBQSxNQUNBLHVCQUF1QixDQUFDLFlBQVksTUFBTSxRQUFRO0FBQ2pELGNBQU0sc0JBQXNCLENBQUMsYUFBYSxRQUFRLE9BQU8sS0FBSyxRQUFRLFFBQVEsY0FBYyxDQUFDLE9BQU8sNkJBQTZCLEdBQUc7QUFDcEksYUFBSyxDQUFDLFFBQVMsS0FBSyxXQUFXLHVCQUF1QixLQUFLLENBQUMsS0FBSyxTQUFTLElBQUksTUFBTyxDQUFDLHFCQUFxQjtBQUMxRyxnQkFBTSxxQkFBcUIsRUFBRSxLQUFLO0FBQ2xDLDZCQUFtQixNQUFNLFVBQVU7QUFDbkMsaUJBQU87QUFBQSxRQUNSO0FBQ0EsY0FBTSxjQUFjO0FBQ3BCLGNBQU0sZ0JBQWdCO0FBQ3RCLFlBQUk7QUFDSixZQUFJO0FBQ0osWUFBSTtBQUNKLFlBQUk7QUFDSixZQUFJLGlCQUFpQixZQUFZLG1CQUFtQixHQUFHO0FBQ3RELGNBQUk7QUFDSCxrQkFBTSxhQUFhLG1CQUFtQixJQUFJO0FBQzFDLG9CQUFRLFdBQVcsU0FBUyxNQUFNLEtBQUssV0FBVyxLQUFLO0FBQ3ZELHdCQUFZLEtBQUssaUJBQWlCLHFCQUFxQixXQUFXLEdBQUcsRUFBRSxLQUFLLFNBQU8sSUFBSSxPQUFPLGVBQWU7QUFBQSxVQUM5RyxTQUFTLEdBQUc7QUFDWCxtQkFBTyxFQUFFLEtBQUs7QUFBQSxVQUNmO0FBQUEsUUFDRCxPQUFPO0FBQ04sZ0JBQU0sWUFBWSxhQUFhLE9BQU8sS0FBSyxZQUFZLE9BQU8sSUFBSSxRQUFRLFlBQVk7QUFDdEYsZ0JBQU0sYUFBYSxLQUFLLHlCQUF5QixZQUFZLFdBQVcsU0FBUyxXQUFXO0FBQzVGLGdCQUFNLHVCQUF1QixLQUFLLHlCQUF5QixXQUFXLFdBQVcsU0FBUyxhQUFhLEVBQUUsTUFBTSxZQUFZLFlBQVksb0JBQW9CLENBQUM7QUFDNUosa0JBQVEsV0FBVztBQUNuQiwyQkFBaUI7QUFDakIsc0JBQVksV0FBVztBQUFBLFFBQ3hCO0FBRUEsY0FBTSxjQUFjLGFBQWEsT0FBTyxLQUFLLFFBQVEsY0FBYztBQUNuRSxjQUFNLGdCQUFnQjtBQUFBLFVBQ3JCLEdBQUcsS0FBSyxnQkFBZ0I7QUFBQSxRQUN6QjtBQUNBLFlBQUksZ0JBQWdCLFFBQVc7QUFDOUIsd0JBQWMsY0FBYztBQUFBLFFBQzdCO0FBQ0EsY0FBTSxnQkFBZ0MsRUFBRSxZQUFZLFdBQVcsZ0JBQWdCLGFBQWEsb0JBQW9CLGVBQWUsU0FBUyxPQUFPLHlCQUF5QixtQkFBbUIsT0FBTyxlQUFlLGdCQUFnQixlQUFlLGNBQWM7QUFFOVAsWUFBSSxRQUFRLDBCQUEwQixDQUFDLGdCQUFnQixpQkFBaUIsQ0FBQyxlQUFlLFFBQVE7QUFDL0YsZ0JBQU0sTUFBTSxLQUFLLGdCQUFnQixlQUFlLE1BQU0scUJBQXFCLFlBQVk7QUFDdkYsZUFBSyxRQUFRLEtBQUssR0FBRztBQUlyQixlQUFLLFVBQVUsSUFBSSxPQUFPLHlCQUF5QixNQUFNLEtBQUssbUJBQW1CLEtBQUssQ0FBQyxDQUFDO0FBRXhGLGdCQUFNLHNCQUFzQixLQUFLO0FBQ2pDLGdCQUFNLE9BQTJCLElBQUksTUFBb0M7QUFBQSxZQUFwQztBQUNwQyxtQkFBUyxzQkFBc0I7QUFDL0IsbUJBQVMsaUJBQWlCO0FBQzFCLG1CQUFTLFlBQVksUUFBUTtBQUM3QixtQkFBUyxjQUFjO0FBQ3ZCLG1DQUFnQjtBQU1oQixtQkFBUyxhQUFhLFVBQVUsS0FBSyxXQUFTLE1BQU0sR0FBRztBQUFBO0FBQUE7QUFBQSxZQUx2RCxJQUFXLE1BQU07QUFHaEIscUJBQU8sSUFBSSxPQUFPO0FBQUEsWUFDbkI7QUFBQSxZQUVPLFFBQVE7QUFDZCxrQkFBSSxPQUFPLE1BQU07QUFBQSxZQUNsQjtBQUFBLFVBQ0QsRUFBRTtBQUNGLGVBQUssV0FBVyxLQUFLLElBQUk7QUFDekIsaUNBQXVCLEtBQUssR0FBRztBQUMvQixpQkFBTyxJQUFJLE9BQU87QUFBQSxRQUNuQixPQUFPO0FBQ04sZ0JBQU0sWUFBWSxZQUFZLE9BQU8sSUFBSSxRQUFRLEtBQUssUUFBUTtBQUM5RCxnQkFBTSxNQUFNLEtBQUssb0JBQW9CLFFBQVEsV0FBVyxXQUFXLFlBQVksY0FBYyxlQUFlLENBQUMsbUJBQW1CO0FBQ2hJLGNBQUksYUFBYSxjQUFjLE9BQU8sR0FBRztBQUV4QyxpQkFBSyx5QkFBeUIsT0FBTyxjQUFjLFFBQVEsV0FBVyxjQUFjLFNBQVMsY0FBYyxnQkFBZ0IsRUFBRSxNQUFNLFlBQVksY0FBYyxZQUFZLFlBQVksb0JBQW9CLENBQUMsRUFBRSxLQUFLLENBQUMsTUFBTTtBQUV2TixtQkFBSyxXQUFXLGNBQWMsa0JBQWtCLEVBQUUsZ0JBQWdCLEVBQUU7QUFDcEUsbUJBQUssbUJBQW1CLEtBQUs7QUFBQSxZQUM5QixDQUFDO0FBQUEsVUFDRjtBQUNBLGVBQUssUUFBUSxLQUFLLEdBQUc7QUFDckIsZ0JBQU0sc0JBQXNCLEtBQUs7QUFDakMsZ0JBQU0sT0FBMkIsSUFBSSxNQUFvQztBQUFBLFlBQXBDO0FBQ3BDLG1CQUFTLHNCQUFzQjtBQUMvQixtQkFBUyxpQkFBaUI7QUFDMUIsbUJBQVMsWUFBWSxRQUFRO0FBQzdCLG1CQUFTLGNBQWMsQ0FBQztBQUN4QixtQkFBUyxnQkFBZ0IsZ0JBQWdCO0FBSXpDLG1CQUFTLGFBQWEsUUFBUSxRQUFRLE1BQVM7QUFBQTtBQUFBLFlBSC9DLElBQVcsTUFBTTtBQUNoQixxQkFBTztBQUFBLFlBQ1I7QUFBQSxZQUVPLFFBQVE7QUFDZCxxQkFBTyxJQUFJLE9BQU8sUUFBUSxNQUFNO0FBQUEsWUFDakM7QUFBQSxVQUNELEVBQUU7QUFDRixlQUFLLFdBQVcsS0FBSyxJQUFJO0FBQ3pCLGlDQUF1QixLQUFLLEdBQUc7QUFDL0IsaUJBQU8sSUFBSSxPQUFPO0FBQUEsUUFDbkI7QUFBQSxNQUNEO0FBQUEsTUFDQSxxQkFBcUIsTUFBTSxLQUFLLG1CQUFtQixLQUFLO0FBQUEsSUFDekQsR0FBRyxVQUFVLENBQUM7QUFFZCxVQUFNLDhCQUE4QixxQkFBcUIsZUFBZSwrQkFBK0I7QUFDdkcsU0FBSyxVQUFVLDRCQUE0QixrQ0FBa0MsVUFBVSxPQUFPLE9BQU8sQ0FBQztBQUV0RywyQkFBdUIsUUFBUSxFQUFFLFFBQVEsT0FBSyxLQUFLLFVBQVUsQ0FBQyxDQUFDO0FBQy9ELFNBQUssVUFBVSxPQUFPO0FBQUEsRUFDdkI7QUFBQSxFQUVRLG9CQUFvQixXQUFtQixXQUFtQixZQUFnQyxlQUFnQyxhQUFnRTtBQUNqTSxVQUFNLFlBQVksS0FBSyxxQkFBcUIsZUFBZSxvQkFBb0IsV0FBVyxXQUFXLFVBQVU7QUFDL0csUUFBSSxlQUFlO0FBQ2xCLGdCQUFVLE9BQU8sZUFBZSxXQUFXO0FBQUEsSUFDNUM7QUFDQSxXQUFPO0FBQUEsTUFDTixRQUFRO0FBQUEsTUFDUixTQUFTLE1BQU07QUFBQSxNQUNmLFNBQVMsTUFBTSxVQUFVLFFBQVE7QUFBQSxJQUNsQztBQUFBLEVBQ0Q7QUFBQSxFQUVRLGdCQUFnQixNQUFzQixNQUFjLFlBQXFCLGNBQTJEO0FBQzNJLFVBQU0sTUFBTSxLQUFLLFdBQVcsSUFBSTtBQUNoQyxVQUFNLGFBQWEsSUFBSTtBQUN2QixRQUFJLGFBQWEsS0FBSyxPQUFPLEdBQUc7QUFDL0IsV0FBSyx5QkFBeUIsT0FBTyxLQUFLLFFBQVEsV0FBVyxLQUFLLFNBQVMsS0FBSyxnQkFBZ0IsRUFBRSxNQUFNLFlBQVksS0FBSyxZQUFZLFdBQVcsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNO0FBRTlKLGFBQUssV0FBVyxLQUFLLGtCQUFrQixFQUFFLGdCQUFnQixFQUFFO0FBQzNELGFBQUssbUJBQW1CLEtBQUs7QUFBQSxNQUM5QixDQUFDO0FBQUEsSUFDRjtBQUVBLGVBQVcsT0FBTyxNQUFNLFlBQVk7QUFFcEMsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLGVBQWUsT0FBd0Q7QUFDdEUsV0FBTyxNQUFNLFNBQVMscUJBQXFCLENBQUMsRUFBRSxNQUFNLFFBQVEsVUFBVSxLQUFLLFNBQVMsUUFBUSxTQUN4RixLQUFLLFdBQVcsR0FBRyxFQUFFLEdBQUcsZUFBZSxLQUFLLFdBQVcsR0FBRyxFQUFFLEdBQUcsa0JBQWtCLFVBQWEsTUFBTSxRQUFRLE1BQU0sWUFBWSxLQUFLLE1BQU0sS0FBSyxTQUFTLFFBQVEsTUFBTSxZQUFZLEtBQUs7QUFBQSxFQUMzTDtBQUFBLEVBRUEsT0FBTyxPQUFxQjtBQUMzQixTQUFLLFFBQVEsUUFBUSxDQUFDLEtBQUssVUFBVTtBQUNwQyxVQUFJLElBQUksa0JBQWtCLGVBQWU7QUFDeEMsWUFBSSxPQUFPLE9BQU8sS0FBSztBQUFBLE1BQ3hCLFdBQVcsSUFBSSxrQkFBa0Isb0JBQW9CO0FBQ3BELGNBQU0saUJBQWlCLEtBQUssV0FBVyxLQUFLO0FBQzVDLFlBQUksZUFBZSxpQkFBaUIsSUFBSSxPQUFPLEtBQUssU0FBUyxNQUFNLGVBQWUsY0FBYyxTQUFTLEdBQUc7QUFDM0csY0FBSSxPQUFPLE9BQU8sZUFBZSxlQUFlLGVBQWUsV0FBVztBQUFBLFFBQzNFO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLGNBQWMsWUFBK0I7QUFDNUMsU0FBSyxVQUFVLFVBQVU7QUFBQSxFQUMxQjtBQUNEO0FBNU1hLHdCQUNHLFNBQVM7QUFEWiwwQkFBTjtBQUFBLEVBcUJKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQXZCVTtBQThNTixJQUFNLGFBQU4sY0FBeUIsV0FBVztBQUFBLEVBSW5DLFFBQWlDO0FBQ3ZDLFdBQU8sS0FBSyxNQUFNO0FBQUEsRUFDbkI7QUFBQSxFQUVBLFlBQ0MsU0FDQSxVQUNBLHdCQUN1QixzQkFDdEI7QUFDRCxVQUFNO0FBQ04sU0FBSyxRQUFRLEtBQUssVUFBVSxJQUFJLGFBQWEsTUFBTTtBQUNsRCxhQUFPLHFCQUFxQixlQUFlLGVBQWUsU0FBUyxPQUFPLGVBQWUsVUFBVSxzQkFBc0I7QUFBQSxJQUMxSCxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFQSxNQUEyQztBQUMxQyxVQUFNLFlBQVksS0FBSyxNQUFNLElBQUk7QUFDakMsUUFBSSxRQUFRO0FBQ1osV0FBTztBQUFBLE1BQ04sUUFBUTtBQUFBLE1BQ1IsU0FBUyxNQUFNO0FBQUEsTUFDZixTQUFTLE1BQU07QUFDZCxrQkFBVSxNQUFNO0FBQ2hCLGdCQUFRO0FBQ1IsYUFBSyxNQUFNLFFBQVEsU0FBUztBQUFBLE1BQzdCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQWpDYSxhQUFOO0FBQUEsRUFZSjtBQUFBLEdBWlU7QUFtQ2IsU0FBUyw2QkFBNkIsS0FBc0I7QUFDM0QsUUFBTSxJQUFJLEtBQUs7QUFDZixTQUFPLENBQUMsQ0FBQyxJQUFJLE1BQU0sU0FBUztBQUM3QjtBQUVBLElBQU0scUJBQU4sY0FBaUMsV0FBVztBQUFBLEVBZ0IzQyxZQUNrQixXQUNBLFdBQ0EsWUFDZSxjQUNDLGVBQ0QsY0FDRyxpQkFDRyxvQkFDRCxtQkFDTixhQUNDLGNBQ0QsYUFDOUI7QUFDRCxVQUFNO0FBYlc7QUFDQTtBQUNBO0FBQ2U7QUFDQztBQUNEO0FBQ0c7QUFDRztBQUNEO0FBQ047QUFDQztBQUNEO0FBeEJoQyxTQUFpQixRQUFRLEtBQUssVUFBVSxJQUFJLGtCQUFrQixDQUFDO0FBVS9ELFNBQWlCLGlCQUFpQixLQUFLLE9BQU8sSUFBSSxJQUFJLGdCQUFnQixDQUFDO0FBaUJ0RSxTQUFLLFVBQVUsRUFBRSw2QkFBNkI7QUFDOUMsU0FBSyxRQUFRLFVBQVUsSUFBSSxpQkFBaUI7QUFDNUMsU0FBSyxVQUFVLElBQUksc0JBQXNCLEtBQUssU0FBUyxTQUFTLFlBQVk7QUFDM0UsVUFBSSxLQUFLLGNBQWM7QUFDdEIsYUFBSyxjQUFjLFdBQVc7QUFBQSxVQUM3QixVQUFVLEVBQUUsVUFBVSxLQUFLLGFBQWEsWUFBWTtBQUFBLFVBQ3BELFVBQVUsRUFBRSxVQUFVLEtBQUssYUFBYSxZQUFZO0FBQUEsVUFDcEQsU0FBUyxFQUFFLFdBQVcsS0FBSztBQUFBLFFBQzVCLENBQUM7QUFBQSxNQUNGLFdBQVcsS0FBSyxLQUFLO0FBQ3BCLGFBQUssY0FBYyxXQUFXLEVBQUUsVUFBVSxLQUFLLElBQUksQ0FBQztBQUFBLE1BQ3JEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFDRixTQUFLLFVBQVUsSUFBSSxzQkFBc0IsS0FBSyxTQUFTLElBQUksVUFBVSxjQUFjLGNBQVk7QUFDOUYsWUFBTSxRQUFRLElBQUksbUJBQW1CLElBQUksVUFBVSxRQUFRLEdBQUcsUUFBUTtBQUN0RSxVQUFJLFlBQVksS0FBSyxVQUFVLElBQUk7QUFFbkMsV0FBSyxtQkFBbUIsZ0JBQWdCO0FBQUEsUUFDdkMsbUJBQW1CLEtBQUs7QUFBQSxRQUN4QixXQUFXLE1BQU07QUFBQSxRQUNqQixZQUFZLE1BQU07QUFDakIsZ0JBQU0sT0FBTyxLQUFLLFlBQVksZUFBZSxPQUFPLDZCQUE2QixLQUFLLG1CQUFtQixFQUFFLEtBQUssRUFBRSxXQUFXLFdBQVcsS0FBSyxLQUFLLEtBQUssUUFBUSxXQUFXLEVBQUUsQ0FBQztBQUM3SyxpQkFBTywwQkFBMEIsSUFBSTtBQUFBLFFBQ3RDO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFqREEsSUFBVyxNQUF1QjtBQUNqQyxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFpREEsT0FBTyxLQUFVLGFBQTZCO0FBQzdDLFNBQUssZUFBZSxNQUFNO0FBRTFCLFNBQUssT0FBTztBQUVaLFVBQU0sVUFBVSxLQUFLLFlBQVksV0FBVyxLQUFLLFNBQVM7QUFDMUQsVUFBTSxXQUFXLEtBQUssYUFBYSxvQkFBb0IsR0FBRztBQUUxRCxRQUFJLGNBQWMsU0FBUyxtQkFBbUIsY0FBYyxJQUFJLEdBQUc7QUFDbkUsUUFBSSxnQkFBZ0IsYUFBYSxTQUFTLEdBQUc7QUFDN0MsUUFBSSxxQkFBcUIsZUFBZSwyQkFBMkIsSUFBSTtBQUN2RSxVQUFNLGFBQWEsQ0FBQyxzQkFBc0IsbUJBQW1CLGNBQWMsS0FBSztBQUVoRixRQUFJLGNBQXdCLENBQUM7QUFDN0IsUUFBSSxlQUFlLENBQUMsWUFBWTtBQUMvQixZQUFNLFVBQVUsVUFBVSxPQUFPLFFBQVEsU0FBUyxNQUFNO0FBQ3hELG9CQUFjLFVBQVUsaUJBQWlCLE9BQU87QUFBQSxJQUNqRCxPQUFPO0FBQ04sWUFBTSxXQUFXLElBQUksS0FBSyxTQUFTLEdBQUcsSUFBSSxTQUFTLFNBQVMsU0FBUztBQUNyRSxvQkFBYyxlQUFlLEtBQUssY0FBYyxLQUFLLGlCQUFpQixLQUFLLFFBQVE7QUFBQSxJQUNwRjtBQUVBLFVBQU0sU0FBUyxJQUFJLEVBQUUsV0FBVztBQUNoQyxXQUFPLFVBQVUsSUFBSSxHQUFHLFdBQVc7QUFFbkMsVUFBTSxXQUFXLENBQUMsSUFBSSxFQUFFLG1CQUFtQixDQUFDLEdBQUcsUUFBUSxDQUFDO0FBQ3hELFVBQU0sY0FBYyxJQUFJLEVBQUUscUJBQXFCLENBQUMsR0FBRyxFQUFFO0FBQ3JELGFBQVMsS0FBSyxXQUFXO0FBQ3pCLFFBQUksYUFBYTtBQUNoQixrQkFBWSxjQUFjLFNBQVMsNkJBQTZCLHFCQUFxQjtBQUFBLElBQ3RGO0FBRUEsU0FBSyxRQUFRLGdCQUFnQixRQUFRLEdBQUcsUUFBUTtBQUNoRCxTQUFLLGNBQWMsS0FBSyxhQUFhLFlBQVksS0FBSyxFQUFFLFVBQVUsTUFBTSxDQUFDLENBQUM7QUFFMUUsVUFBTSxhQUFhLENBQUMsWUFBK0M7QUFDbEUsWUFBTSxhQUFhLEtBQUssUUFBUSxjQUFjLGNBQWMsS0FBSyxLQUFLLFFBQVEsWUFBWSxJQUFJLEVBQUUsa0JBQWtCLENBQUM7QUFDbkgsWUFBTSxlQUFlLEtBQUssUUFBUSxjQUFjLGdCQUFnQixLQUFLLEtBQUssUUFBUSxZQUFZLElBQUksRUFBRSxvQkFBb0IsQ0FBQztBQUN6SCxVQUFJLFdBQVcsQ0FBQyxTQUFTLGFBQWEsQ0FBQyxTQUFTLFdBQVc7QUFDMUQsYUFBSyxlQUFlO0FBQ3BCLG1CQUFXLGNBQWMsSUFBSSxRQUFRLEtBQUs7QUFDMUMscUJBQWEsY0FBYyxJQUFJLFFBQVEsT0FBTztBQUM5QyxjQUFNLHFCQUFxQixRQUFRLFVBQVUsSUFBSSxTQUFTLGlDQUFpQyxhQUFhLElBQUksU0FBUyw2QkFBNkIsa0JBQWtCLFFBQVEsS0FBSztBQUNqTCxjQUFNLG9CQUFvQixRQUFRLFlBQVksSUFBSSxTQUFTLGdDQUFnQyxZQUFZLElBQUksU0FBUyw0QkFBNEIsaUJBQWlCLFFBQVEsT0FBTztBQUNoTCxjQUFNLFVBQVUsU0FBUyxXQUFXLHdCQUF3QixVQUFVLG9CQUFvQixpQkFBaUI7QUFDM0csYUFBSyxRQUFRLFlBQVk7QUFDekIsYUFBSyxjQUFjLE9BQU87QUFBQSxNQUMzQjtBQUFBLElBQ0Q7QUFFQSxRQUFJO0FBSUosU0FBSyxlQUFlLElBQUksUUFBUSxPQUFLO0FBQ3BDLFVBQUksQ0FBQyxhQUFhO0FBQ2pCLHNCQUFjLFNBQVMsbUJBQW1CLGNBQWMsS0FBSyxDQUFDLEdBQUc7QUFDakUsd0JBQWdCLGFBQWEsU0FBUyxHQUFHO0FBQUEsTUFDMUM7QUFFQSwyQkFBcUIsZUFBZSwyQkFBMkIsS0FBSyxDQUFDO0FBQ3JFLFlBQU1BLGNBQWEsQ0FBQyxzQkFBc0IsbUJBQW1CLGNBQWMsS0FBSztBQUNoRixZQUFNLGVBQWUsZUFBZSxhQUFhLEtBQUssQ0FBQztBQUV2RCxVQUFJLENBQUMsZUFBZSxDQUFDQSxhQUFZO0FBQ2hDLGNBQU0sUUFBUTtBQUNkLG9CQUFZLGNBQWMsVUFBVSxLQUFLLENBQUMsUUFBUSxTQUFTLDZCQUE2QixxQkFBcUIsSUFBSSxTQUFTLHFDQUFxQyw0QkFBNEIsS0FBSyxNQUFNLFFBQVEsR0FBRyxDQUFDO0FBQUEsTUFDbk4sV0FBVyxDQUFDLGVBQWVBLGFBQVk7QUFDdEMsZUFBTyxVQUFVLE9BQU8sR0FBRyxXQUFXO0FBQ3RDLGNBQU0sV0FBVyxJQUFJLEtBQUssU0FBUyxHQUFHLElBQUksU0FBUyxTQUFTLFNBQVM7QUFDckUsZUFBTyxVQUFVLElBQUksR0FBRyxlQUFlLEtBQUssY0FBYyxLQUFLLGlCQUFpQixLQUFLLFFBQVEsQ0FBQztBQUM5RixvQkFBWSxjQUFjO0FBQUEsTUFDM0I7QUFFQSxVQUFJLENBQUMsa0JBQWtCO0FBQ3RCLDJCQUFtQixpQkFBaUIsY0FDakMsWUFBWSx5QkFBeUIsY0FBYyxhQUFhLEtBQUssV0FBVyxLQUFLLFVBQVUsSUFDL0Y7QUFBQSxNQUNKO0FBRUEsVUFBSSxDQUFDLGVBQWVBLGVBQWMsa0JBQWtCO0FBQ25ELG1CQUFXLGlCQUFpQixLQUFLLENBQUMsQ0FBQztBQUFBLE1BQ3BDO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSxjQUFjLFNBQXVCO0FBQzVDLFNBQUssVUFBVTtBQUNmLFFBQUksQ0FBQyxLQUFLLE1BQU0sT0FBTztBQUN0QixXQUFLLE1BQU0sUUFBUSxLQUFLLGFBQWEsa0JBQWtCLEtBQUssU0FBUyxPQUNwRTtBQUFBLFFBQ0MsU0FBUyxLQUFLO0FBQUEsUUFDZCxZQUFZLEVBQUUsU0FBUyxNQUFNLGFBQWEsS0FBSztBQUFBLFFBQy9DLFVBQVUsRUFBRSxlQUFlLGNBQWMsTUFBTTtBQUFBLFFBQy9DLGFBQWEsRUFBRSxlQUFlLEtBQUs7QUFBQSxNQUNwQyxFQUNBO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFDRDtBQTlKTSxxQkFBTjtBQUFBLEVBb0JHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQTVCRzsiLAogICJuYW1lcyI6IFsiaXNDb21wbGV0ZSJdCn0K
