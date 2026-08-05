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
import { createInstantHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { basename, dirname } from "../../../../../base/common/path.js";
import { URI } from "../../../../../base/common/uri.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { getFlatContextMenuActions } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { fillInSymbolsDragData } from "../../../../../platform/dnd/browser/dnd.js";
import { FileKind, IFileService } from "../../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { FolderThemeIcon, IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { fillEditorsDragData } from "../../../../browser/dnd.js";
import { ResourceLabels } from "../../../../browser/labels.js";
import { ResourceContextKey } from "../../../../common/contextkeys.js";
import { revealInSideBarCommand } from "../../../files/browser/fileActions.contribution.js";
import { isImageVariableEntry, isPasteVariableEntry } from "../../common/chatModel.js";
import { ChatResponseReferencePartStatusKind } from "../../common/chatService.js";
import { convertUint8ArrayToString } from "../imageUtils.js";
const chatAttachmentResourceContextKey = new RawContextKey("chatAttachmentResource", void 0, { type: "URI", description: localize("resource", "The full value of the chat attachment resource, including scheme and path") });
let ChatAttachmentsContentPart = class extends Disposable {
  constructor(variables, contentReferences = [], domNode = dom.$(".chat-attached-context"), contextKeyService, instantiationService, openerService, hoverService, commandService, themeService, labelService) {
    super();
    this.variables = variables;
    this.contentReferences = contentReferences;
    this.domNode = domNode;
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    this.openerService = openerService;
    this.hoverService = hoverService;
    this.commandService = commandService;
    this.themeService = themeService;
    this.labelService = labelService;
    this.attachedContextDisposables = this._register(new DisposableStore());
    this._onDidChangeVisibility = this._register(new Emitter());
    this._contextResourceLabels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this._onDidChangeVisibility.event }));
    this.initAttachedContext(domNode);
    if (!domNode.childElementCount) {
      this.domNode = void 0;
    }
  }
  // TODO@joyceerhl adopt chat attachment widgets
  initAttachedContext(container) {
    dom.clearNode(container);
    this.attachedContextDisposables.clear();
    const hoverDelegate = this.attachedContextDisposables.add(createInstantHoverDelegate());
    this.variables.forEach(async (attachment) => {
      let resource = URI.isUri(attachment.value) ? attachment.value : attachment.value && typeof attachment.value === "object" && "uri" in attachment.value && URI.isUri(attachment.value.uri) ? attachment.value.uri : void 0;
      let range = attachment.value && typeof attachment.value === "object" && "range" in attachment.value && Range.isIRange(attachment.value.range) ? attachment.value.range : void 0;
      const widget = dom.append(container, dom.$(".chat-attached-context-attachment.show-file-icons"));
      const label = this._contextResourceLabels.create(widget, { supportIcons: true, hoverDelegate, hoverTargetOverride: widget });
      this.attachedContextDisposables.add(label);
      const correspondingContentReference = this.contentReferences.find((ref) => typeof ref.reference === "object" && "variableName" in ref.reference && ref.reference.variableName === attachment.name || URI.isUri(ref.reference) && basename(ref.reference.path) === attachment.name);
      const isAttachmentOmitted = correspondingContentReference?.options?.status?.kind === ChatResponseReferencePartStatusKind.Omitted;
      const isAttachmentPartialOrOmitted = isAttachmentOmitted || correspondingContentReference?.options?.status?.kind === ChatResponseReferencePartStatusKind.Partial;
      let ariaLabel;
      if (resource && (attachment.isFile || attachment.isDirectory)) {
        const fileBasename = basename(resource.path);
        const fileDirname = dirname(resource.path);
        const friendlyName = `${fileBasename} ${fileDirname}`;
        if (isAttachmentOmitted) {
          ariaLabel = range ? localize("chat.omittedFileAttachmentWithRange", "Omitted: {0}, line {1} to line {2}.", friendlyName, range.startLineNumber, range.endLineNumber) : localize("chat.omittedFileAttachment", "Omitted: {0}.", friendlyName);
        } else if (isAttachmentPartialOrOmitted) {
          ariaLabel = range ? localize("chat.partialFileAttachmentWithRange", "Partially attached: {0}, line {1} to line {2}.", friendlyName, range.startLineNumber, range.endLineNumber) : localize("chat.partialFileAttachment", "Partially attached: {0}.", friendlyName);
        } else {
          ariaLabel = range ? localize("chat.fileAttachmentWithRange3", "Attached: {0}, line {1} to line {2}.", friendlyName, range.startLineNumber, range.endLineNumber) : localize("chat.fileAttachment3", "Attached: {0}.", friendlyName);
        }
        if (attachment.isOmitted) {
          this.customAttachment(widget, friendlyName, hoverDelegate, ariaLabel, isAttachmentOmitted);
        } else {
          const fileOptions = {
            hidePath: true,
            title: correspondingContentReference?.options?.status?.description
          };
          label.setFile(resource, attachment.isFile ? {
            ...fileOptions,
            fileKind: FileKind.FILE,
            range
          } : {
            ...fileOptions,
            fileKind: FileKind.FOLDER,
            icon: !this.themeService.getFileIconTheme().hasFolderIcons ? FolderThemeIcon : void 0
          });
        }
        this.instantiationService.invokeFunction((accessor) => {
          if (resource) {
            this.attachedContextDisposables.add(hookUpResourceAttachmentDragAndContextMenu(accessor, widget, resource));
          }
        });
      } else if (attachment.isImage) {
        ariaLabel = localize("chat.imageAttachment", "Attached image, {0}", attachment.name);
        const isURL = isImageVariableEntry(attachment) && attachment.isURL;
        const hoverElement = this.customAttachment(widget, attachment.name, hoverDelegate, ariaLabel, isAttachmentOmitted, attachment.isImage, isURL, attachment.value);
        if (attachment.references) {
          widget.style.cursor = "pointer";
          const clickHandler = () => {
            if (attachment.references && URI.isUri(attachment.references[0].reference)) {
              this.openResource(attachment.references[0].reference, false, void 0);
            }
          };
          this.attachedContextDisposables.add(dom.addDisposableListener(widget, "click", clickHandler));
        }
        if (!isAttachmentPartialOrOmitted) {
          const buffer = attachment.value;
          this.createImageElements(buffer, widget, hoverElement);
          this.attachedContextDisposables.add(this.hoverService.setupManagedHover(hoverDelegate, widget, hoverElement, { trapFocus: false }));
        }
        widget.style.position = "relative";
      } else if (isPasteVariableEntry(attachment)) {
        ariaLabel = localize("chat.attachment", "Attached context, {0}", attachment.name);
        const classNames = ["file-icon", `${attachment.language}-lang-file-icon`];
        if (attachment.copiedFrom) {
          resource = attachment.copiedFrom.uri;
          range = attachment.copiedFrom.range;
          const filename = basename(resource.path);
          label.setLabel(filename, void 0, { extraClasses: classNames });
        } else {
          label.setLabel(attachment.fileName, void 0, { extraClasses: classNames });
        }
        widget.appendChild(dom.$("span.attachment-additional-info", {}, `Pasted ${attachment.pastedLines}`));
        widget.style.position = "relative";
        const hoverContent = {
          markdown: {
            value: `**${attachment.copiedFrom ? this.labelService.getUriLabel(attachment.copiedFrom.uri, { relative: true }) : attachment.fileName}**

---

\`\`\`${attachment.language}
${attachment.code}
\`\`\``
          },
          markdownNotSupportedFallback: attachment.code
        };
        if (!this.attachedContextDisposables.isDisposed) {
          this.attachedContextDisposables.add(this.hoverService.setupManagedHover(hoverDelegate, widget, hoverContent, { trapFocus: true }));
          const resource2 = attachment.copiedFrom?.uri;
          if (resource2) {
            this.attachedContextDisposables.add(this.instantiationService.invokeFunction((accessor) => hookUpResourceAttachmentDragAndContextMenu(accessor, widget, resource2)));
          }
        }
      } else {
        const attachmentLabel = attachment.fullName ?? attachment.name;
        const withIcon = attachment.icon?.id ? `$(${attachment.icon.id}) ${attachmentLabel}` : attachmentLabel;
        label.setLabel(withIcon, correspondingContentReference?.options?.status?.description);
        ariaLabel = localize("chat.attachment3", "Attached context: {0}.", attachment.name);
      }
      if (attachment.kind === "symbol") {
        const scopedContextKeyService = this.attachedContextDisposables.add(this.contextKeyService.createScoped(widget));
        this.attachedContextDisposables.add(this.instantiationService.invokeFunction((accessor) => hookUpSymbolAttachmentDragAndContextMenu(accessor, widget, scopedContextKeyService, { ...attachment, kind: attachment.symbolKind }, MenuId.ChatInputSymbolAttachmentContext)));
      }
      if (isAttachmentPartialOrOmitted) {
        widget.classList.add("warning");
      }
      const description = correspondingContentReference?.options?.status?.description;
      if (isAttachmentPartialOrOmitted) {
        ariaLabel = `${ariaLabel}${description ? ` ${description}` : ""}`;
        for (const selector of [".monaco-icon-suffix-container", ".monaco-icon-name-container"]) {
          const element = label.element.querySelector(selector);
          if (element) {
            element.classList.add("warning");
          }
        }
      }
      if (this.attachedContextDisposables.isDisposed) {
        return;
      }
      if (resource) {
        widget.style.cursor = "pointer";
        if (!this.attachedContextDisposables.isDisposed) {
          this.attachedContextDisposables.add(dom.addDisposableListener(widget, dom.EventType.CLICK, async (e) => {
            dom.EventHelper.stop(e, true);
            if (attachment.isDirectory) {
              this.openResource(resource, true);
            } else {
              this.openResource(resource, false, range);
            }
          }));
        }
      }
      widget.ariaLabel = ariaLabel;
      widget.tabIndex = 0;
    });
  }
  customAttachment(widget, friendlyName, hoverDelegate, ariaLabel, isAttachmentOmitted, isImage, isURL, value) {
    const pillIcon = dom.$("div.chat-attached-context-pill", {}, dom.$(isAttachmentOmitted ? "span.codicon.codicon-warning" : "span.codicon.codicon-file-media"));
    const textLabel = dom.$("span.chat-attached-context-custom-text", {}, friendlyName);
    widget.appendChild(pillIcon);
    widget.appendChild(textLabel);
    const hoverElement = dom.$("div.chat-attached-context-hover");
    hoverElement.setAttribute("aria-label", ariaLabel);
    if (isURL && !isAttachmentOmitted && value) {
      hoverElement.textContent = localize("chat.imageAttachmentHover", "{0}", convertUint8ArrayToString(value));
      this.attachedContextDisposables.add(this.hoverService.setupManagedHover(hoverDelegate, widget, hoverElement, { trapFocus: true }));
    }
    if (isAttachmentOmitted) {
      widget.classList.add("warning");
      hoverElement.textContent = localize("chat.fileAttachmentHover", "Selected model does not support this {0} type.", isImage ? "image" : "file");
      this.attachedContextDisposables.add(this.hoverService.setupManagedHover(hoverDelegate, widget, hoverElement, { trapFocus: true }));
    }
    return hoverElement;
  }
  openResource(resource, isDirectory, range) {
    if (isDirectory) {
      this.commandService.executeCommand(revealInSideBarCommand.id, resource);
      return;
    }
    const openTextEditorOptions = range ? { selection: range } : void 0;
    const options = {
      fromUserGesture: true,
      editorOptions: openTextEditorOptions
    };
    this.openerService.open(resource, options);
  }
  // Helper function to create and replace image
  async createImageElements(buffer, widget, hoverElement) {
    const blob = new Blob([buffer], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const img = dom.$("img.chat-attached-context-image", { src: url, alt: "" });
    const pillImg = dom.$("img.chat-attached-context-pill-image", { src: url, alt: "" });
    const pill = dom.$("div.chat-attached-context-pill", {}, pillImg);
    const existingPill = widget.querySelector(".chat-attached-context-pill");
    if (existingPill) {
      existingPill.replaceWith(pill);
    }
    hoverElement.appendChild(img);
    img.onload = () => {
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      const pillIcon = dom.$("div.chat-attached-context-pill", {}, dom.$("span.codicon.codicon-file-media"));
      const pill2 = dom.$("div.chat-attached-context-pill", {}, pillIcon);
      const existingPill2 = widget.querySelector(".chat-attached-context-pill");
      if (existingPill2) {
        existingPill2.replaceWith(pill2);
      }
    };
  }
};
ChatAttachmentsContentPart = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IOpenerService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, ILabelService)
], ChatAttachmentsContentPart);
function hookUpResourceAttachmentDragAndContextMenu(accessor, widget, resource) {
  const contextKeyService = accessor.get(IContextKeyService);
  const instantiationService = accessor.get(IInstantiationService);
  const store = new DisposableStore();
  const scopedContextKeyService = store.add(contextKeyService.createScoped(widget));
  store.add(setResourceContext(accessor, scopedContextKeyService, resource));
  widget.draggable = true;
  store.add(dom.addDisposableListener(widget, "dragstart", (e) => {
    instantiationService.invokeFunction((accessor2) => fillEditorsDragData(accessor2, [resource], e));
    e.dataTransfer?.setDragImage(widget, 0, 0);
  }));
  store.add(addBasicContextMenu(accessor, widget, scopedContextKeyService, MenuId.ChatInputResourceAttachmentContext, resource));
  return store;
}
function hookUpSymbolAttachmentDragAndContextMenu(accessor, widget, scopedContextKeyService, attachment, contextMenuId) {
  const instantiationService = accessor.get(IInstantiationService);
  const languageFeaturesService = accessor.get(ILanguageFeaturesService);
  const textModelService = accessor.get(ITextModelService);
  const store = new DisposableStore();
  store.add(setResourceContext(accessor, scopedContextKeyService, attachment.value.uri));
  const chatResourceContext = chatAttachmentResourceContextKey.bindTo(scopedContextKeyService);
  chatResourceContext.set(attachment.value.uri.toString());
  widget.draggable = true;
  store.add(dom.addDisposableListener(widget, "dragstart", (e) => {
    instantiationService.invokeFunction((accessor2) => fillEditorsDragData(accessor2, [{ resource: attachment.value.uri, selection: attachment.value.range }], e));
    fillInSymbolsDragData([{
      fsPath: attachment.value.uri.fsPath,
      range: attachment.value.range,
      name: attachment.name,
      kind: attachment.kind
    }], e);
    e.dataTransfer?.setDragImage(widget, 0, 0);
  }));
  const providerContexts = [
    [EditorContextKeys.hasDefinitionProvider.bindTo(scopedContextKeyService), languageFeaturesService.definitionProvider],
    [EditorContextKeys.hasReferenceProvider.bindTo(scopedContextKeyService), languageFeaturesService.referenceProvider],
    [EditorContextKeys.hasImplementationProvider.bindTo(scopedContextKeyService), languageFeaturesService.implementationProvider],
    [EditorContextKeys.hasTypeDefinitionProvider.bindTo(scopedContextKeyService), languageFeaturesService.typeDefinitionProvider]
  ];
  const updateContextKeys = async () => {
    const modelRef = await textModelService.createModelReference(attachment.value.uri);
    try {
      const model = modelRef.object.textEditorModel;
      for (const [contextKey, registry] of providerContexts) {
        contextKey.set(registry.has(model));
      }
    } finally {
      modelRef.dispose();
    }
  };
  store.add(addBasicContextMenu(accessor, widget, scopedContextKeyService, contextMenuId, attachment.value, updateContextKeys));
  return store;
}
function setResourceContext(accessor, scopedContextKeyService, resource) {
  const fileService = accessor.get(IFileService);
  const languageService = accessor.get(ILanguageService);
  const modelService = accessor.get(IModelService);
  const resourceContextKey = new ResourceContextKey(scopedContextKeyService, fileService, languageService, modelService);
  resourceContextKey.set(resource);
  return resourceContextKey;
}
function addBasicContextMenu(accessor, widget, scopedContextKeyService, menuId, arg, updateContextKeys) {
  const contextMenuService = accessor.get(IContextMenuService);
  const menuService = accessor.get(IMenuService);
  return dom.addDisposableListener(widget, dom.EventType.CONTEXT_MENU, async (domEvent) => {
    const event = new StandardMouseEvent(dom.getWindow(domEvent), domEvent);
    dom.EventHelper.stop(domEvent, true);
    try {
      await updateContextKeys?.();
    } catch (e) {
      console.error(e);
    }
    contextMenuService.showContextMenu({
      contextKeyService: scopedContextKeyService,
      getAnchor: () => event,
      getActions: () => {
        const menu = menuService.getMenuActions(menuId, scopedContextKeyService, { arg });
        return getFlatContextMenuActions(menu);
      }
    });
  });
}
export {
  ChatAttachmentsContentPart,
  chatAttachmentResourceContextKey,
  hookUpResourceAttachmentDragAndContextMenu,
  hookUpSymbolAttachmentDragAndContextMenu
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0QXR0YWNobWVudHNDb250ZW50UGFydC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IElNYW5hZ2VkSG92ZXJUb29sdGlwTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVJbnN0YW50SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZUZlYXR1cmVSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBMb2NhdGlvbiwgU3ltYm9sS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBnZXRGbGF0Q29udGV4dE1lbnVBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IElNZW51U2VydmljZSwgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSwgSVNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBmaWxsSW5TeW1ib2xzRHJhZ0RhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9kbmQvYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgSVRleHRFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRmlsZUtpbmQsIElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UsIE9wZW5JbnRlcm5hbE9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBGb2xkZXJUaGVtZUljb24sIElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGZpbGxFZGl0b3JzRHJhZ0RhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUxhYmVscyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvbGFiZWxzLmpzJztcbmltcG9ydCB7IFJlc291cmNlQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyByZXZlYWxJblNpZGVCYXJDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vZmlsZXMvYnJvd3Nlci9maWxlQWN0aW9ucy5jb250cmlidXRpb24uanMnO1xuaW1wb3J0IHsgSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSwgaXNJbWFnZVZhcmlhYmxlRW50cnksIGlzUGFzdGVWYXJpYWJsZUVudHJ5IH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBDaGF0UmVzcG9uc2VSZWZlcmVuY2VQYXJ0U3RhdHVzS2luZCwgSUNoYXRDb250ZW50UmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGNvbnZlcnRVaW50OEFycmF5VG9TdHJpbmcgfSBmcm9tICcuLi9pbWFnZVV0aWxzLmpzJztcblxuZXhwb3J0IGNvbnN0IGNoYXRBdHRhY2htZW50UmVzb3VyY2VDb250ZXh0S2V5ID0gbmV3IFJhd0NvbnRleHRLZXk8c3RyaW5nPignY2hhdEF0dGFjaG1lbnRSZXNvdXJjZScsIHVuZGVmaW5lZCwgeyB0eXBlOiAnVVJJJywgZGVzY3JpcHRpb246IGxvY2FsaXplKCdyZXNvdXJjZScsIFwiVGhlIGZ1bGwgdmFsdWUgb2YgdGhlIGNoYXQgYXR0YWNobWVudCByZXNvdXJjZSwgaW5jbHVkaW5nIHNjaGVtZSBhbmQgcGF0aFwiKSB9KTtcblxuXG5leHBvcnQgY2xhc3MgQ2hhdEF0dGFjaG1lbnRzQ29udGVudFBhcnQgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBhdHRhY2hlZENvbnRleHREaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VWaXNpYmlsaXR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRSZXNvdXJjZUxhYmVscyA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVzb3VyY2VMYWJlbHMsIHsgb25EaWRDaGFuZ2VWaXNpYmlsaXR5OiB0aGlzLl9vbkRpZENoYW5nZVZpc2liaWxpdHkuZXZlbnQgfSkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdmFyaWFibGVzOiBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5W10sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250ZW50UmVmZXJlbmNlczogUmVhZG9ubHlBcnJheTxJQ2hhdENvbnRlbnRSZWZlcmVuY2U+ID0gW10sXG5cdFx0cHVibGljIHJlYWRvbmx5IGRvbU5vZGU6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkID0gZG9tLiQoJy5jaGF0LWF0dGFjaGVkLWNvbnRleHQnKSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuaW5pdEF0dGFjaGVkQ29udGV4dChkb21Ob2RlKTtcblx0XHRpZiAoIWRvbU5vZGUuY2hpbGRFbGVtZW50Q291bnQpIHtcblx0XHRcdHRoaXMuZG9tTm9kZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHQvLyBUT0RPQGpveWNlZXJobCBhZG9wdCBjaGF0IGF0dGFjaG1lbnQgd2lkZ2V0c1xuXHRwcml2YXRlIGluaXRBdHRhY2hlZENvbnRleHQoY29udGFpbmVyOiBIVE1MRWxlbWVudCkge1xuXHRcdGRvbS5jbGVhck5vZGUoY29udGFpbmVyKTtcblx0XHR0aGlzLmF0dGFjaGVkQ29udGV4dERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0Y29uc3QgaG92ZXJEZWxlZ2F0ZSA9IHRoaXMuYXR0YWNoZWRDb250ZXh0RGlzcG9zYWJsZXMuYWRkKGNyZWF0ZUluc3RhbnRIb3ZlckRlbGVnYXRlKCkpO1xuXG5cdFx0dGhpcy52YXJpYWJsZXMuZm9yRWFjaChhc3luYyAoYXR0YWNobWVudCkgPT4ge1xuXHRcdFx0bGV0IHJlc291cmNlID0gVVJJLmlzVXJpKGF0dGFjaG1lbnQudmFsdWUpID8gYXR0YWNobWVudC52YWx1ZSA6IGF0dGFjaG1lbnQudmFsdWUgJiYgdHlwZW9mIGF0dGFjaG1lbnQudmFsdWUgPT09ICdvYmplY3QnICYmICd1cmknIGluIGF0dGFjaG1lbnQudmFsdWUgJiYgVVJJLmlzVXJpKGF0dGFjaG1lbnQudmFsdWUudXJpKSA/IGF0dGFjaG1lbnQudmFsdWUudXJpIDogdW5kZWZpbmVkO1xuXHRcdFx0bGV0IHJhbmdlID0gYXR0YWNobWVudC52YWx1ZSAmJiB0eXBlb2YgYXR0YWNobWVudC52YWx1ZSA9PT0gJ29iamVjdCcgJiYgJ3JhbmdlJyBpbiBhdHRhY2htZW50LnZhbHVlICYmIFJhbmdlLmlzSVJhbmdlKGF0dGFjaG1lbnQudmFsdWUucmFuZ2UpID8gYXR0YWNobWVudC52YWx1ZS5yYW5nZSA6IHVuZGVmaW5lZDtcblxuXHRcdFx0Y29uc3Qgd2lkZ2V0ID0gZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCcuY2hhdC1hdHRhY2hlZC1jb250ZXh0LWF0dGFjaG1lbnQuc2hvdy1maWxlLWljb25zJykpO1xuXHRcdFx0Y29uc3QgbGFiZWwgPSB0aGlzLl9jb250ZXh0UmVzb3VyY2VMYWJlbHMuY3JlYXRlKHdpZGdldCwgeyBzdXBwb3J0SWNvbnM6IHRydWUsIGhvdmVyRGVsZWdhdGUsIGhvdmVyVGFyZ2V0T3ZlcnJpZGU6IHdpZGdldCB9KTtcblx0XHRcdHRoaXMuYXR0YWNoZWRDb250ZXh0RGlzcG9zYWJsZXMuYWRkKGxhYmVsKTtcblxuXHRcdFx0Y29uc3QgY29ycmVzcG9uZGluZ0NvbnRlbnRSZWZlcmVuY2UgPSB0aGlzLmNvbnRlbnRSZWZlcmVuY2VzLmZpbmQoKHJlZikgPT4gKHR5cGVvZiByZWYucmVmZXJlbmNlID09PSAnb2JqZWN0JyAmJiAndmFyaWFibGVOYW1lJyBpbiByZWYucmVmZXJlbmNlICYmIHJlZi5yZWZlcmVuY2UudmFyaWFibGVOYW1lID09PSBhdHRhY2htZW50Lm5hbWUpIHx8IChVUkkuaXNVcmkocmVmLnJlZmVyZW5jZSkgJiYgYmFzZW5hbWUocmVmLnJlZmVyZW5jZS5wYXRoKSA9PT0gYXR0YWNobWVudC5uYW1lKSk7XG5cdFx0XHRjb25zdCBpc0F0dGFjaG1lbnRPbWl0dGVkID0gY29ycmVzcG9uZGluZ0NvbnRlbnRSZWZlcmVuY2U/Lm9wdGlvbnM/LnN0YXR1cz8ua2luZCA9PT0gQ2hhdFJlc3BvbnNlUmVmZXJlbmNlUGFydFN0YXR1c0tpbmQuT21pdHRlZDtcblx0XHRcdGNvbnN0IGlzQXR0YWNobWVudFBhcnRpYWxPck9taXR0ZWQgPSBpc0F0dGFjaG1lbnRPbWl0dGVkIHx8IGNvcnJlc3BvbmRpbmdDb250ZW50UmVmZXJlbmNlPy5vcHRpb25zPy5zdGF0dXM/LmtpbmQgPT09IENoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnRTdGF0dXNLaW5kLlBhcnRpYWw7XG5cblx0XHRcdGxldCBhcmlhTGFiZWw6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRcdFx0aWYgKHJlc291cmNlICYmIChhdHRhY2htZW50LmlzRmlsZSB8fCBhdHRhY2htZW50LmlzRGlyZWN0b3J5KSkge1xuXHRcdFx0XHRjb25zdCBmaWxlQmFzZW5hbWUgPSBiYXNlbmFtZShyZXNvdXJjZS5wYXRoKTtcblx0XHRcdFx0Y29uc3QgZmlsZURpcm5hbWUgPSBkaXJuYW1lKHJlc291cmNlLnBhdGgpO1xuXHRcdFx0XHRjb25zdCBmcmllbmRseU5hbWUgPSBgJHtmaWxlQmFzZW5hbWV9ICR7ZmlsZURpcm5hbWV9YDtcblxuXHRcdFx0XHRpZiAoaXNBdHRhY2htZW50T21pdHRlZCkge1xuXHRcdFx0XHRcdGFyaWFMYWJlbCA9IHJhbmdlID8gbG9jYWxpemUoJ2NoYXQub21pdHRlZEZpbGVBdHRhY2htZW50V2l0aFJhbmdlJywgXCJPbWl0dGVkOiB7MH0sIGxpbmUgezF9IHRvIGxpbmUgezJ9LlwiLCBmcmllbmRseU5hbWUsIHJhbmdlLnN0YXJ0TGluZU51bWJlciwgcmFuZ2UuZW5kTGluZU51bWJlcikgOiBsb2NhbGl6ZSgnY2hhdC5vbWl0dGVkRmlsZUF0dGFjaG1lbnQnLCBcIk9taXR0ZWQ6IHswfS5cIiwgZnJpZW5kbHlOYW1lKTtcblx0XHRcdFx0fSBlbHNlIGlmIChpc0F0dGFjaG1lbnRQYXJ0aWFsT3JPbWl0dGVkKSB7XG5cdFx0XHRcdFx0YXJpYUxhYmVsID0gcmFuZ2UgPyBsb2NhbGl6ZSgnY2hhdC5wYXJ0aWFsRmlsZUF0dGFjaG1lbnRXaXRoUmFuZ2UnLCBcIlBhcnRpYWxseSBhdHRhY2hlZDogezB9LCBsaW5lIHsxfSB0byBsaW5lIHsyfS5cIiwgZnJpZW5kbHlOYW1lLCByYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLmVuZExpbmVOdW1iZXIpIDogbG9jYWxpemUoJ2NoYXQucGFydGlhbEZpbGVBdHRhY2htZW50JywgXCJQYXJ0aWFsbHkgYXR0YWNoZWQ6IHswfS5cIiwgZnJpZW5kbHlOYW1lKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhcmlhTGFiZWwgPSByYW5nZSA/IGxvY2FsaXplKCdjaGF0LmZpbGVBdHRhY2htZW50V2l0aFJhbmdlMycsIFwiQXR0YWNoZWQ6IHswfSwgbGluZSB7MX0gdG8gbGluZSB7Mn0uXCIsIGZyaWVuZGx5TmFtZSwgcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCByYW5nZS5lbmRMaW5lTnVtYmVyKSA6IGxvY2FsaXplKCdjaGF0LmZpbGVBdHRhY2htZW50MycsIFwiQXR0YWNoZWQ6IHswfS5cIiwgZnJpZW5kbHlOYW1lKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChhdHRhY2htZW50LmlzT21pdHRlZCkge1xuXHRcdFx0XHRcdHRoaXMuY3VzdG9tQXR0YWNobWVudCh3aWRnZXQsIGZyaWVuZGx5TmFtZSwgaG92ZXJEZWxlZ2F0ZSwgYXJpYUxhYmVsLCBpc0F0dGFjaG1lbnRPbWl0dGVkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBmaWxlT3B0aW9ucyA9IHtcblx0XHRcdFx0XHRcdGhpZGVQYXRoOiB0cnVlLFxuXHRcdFx0XHRcdFx0dGl0bGU6IGNvcnJlc3BvbmRpbmdDb250ZW50UmVmZXJlbmNlPy5vcHRpb25zPy5zdGF0dXM/LmRlc2NyaXB0aW9uXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRsYWJlbC5zZXRGaWxlKHJlc291cmNlLCBhdHRhY2htZW50LmlzRmlsZSA/IHtcblx0XHRcdFx0XHRcdC4uLmZpbGVPcHRpb25zLFxuXHRcdFx0XHRcdFx0ZmlsZUtpbmQ6IEZpbGVLaW5kLkZJTEUsXG5cdFx0XHRcdFx0XHRyYW5nZSxcblx0XHRcdFx0XHR9IDoge1xuXHRcdFx0XHRcdFx0Li4uZmlsZU9wdGlvbnMsXG5cdFx0XHRcdFx0XHRmaWxlS2luZDogRmlsZUtpbmQuRk9MREVSLFxuXHRcdFx0XHRcdFx0aWNvbjogIXRoaXMudGhlbWVTZXJ2aWNlLmdldEZpbGVJY29uVGhlbWUoKS5oYXNGb2xkZXJJY29ucyA/IEZvbGRlclRoZW1lSWNvbiA6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0aWYgKHJlc291cmNlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmF0dGFjaGVkQ29udGV4dERpc3Bvc2FibGVzLmFkZChob29rVXBSZXNvdXJjZUF0dGFjaG1lbnREcmFnQW5kQ29udGV4dE1lbnUoYWNjZXNzb3IsIHdpZGdldCwgcmVzb3VyY2UpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIGlmIChhdHRhY2htZW50LmlzSW1hZ2UpIHtcblx0XHRcdFx0YXJpYUxhYmVsID0gbG9jYWxpemUoJ2NoYXQuaW1hZ2VBdHRhY2htZW50JywgXCJBdHRhY2hlZCBpbWFnZSwgezB9XCIsIGF0dGFjaG1lbnQubmFtZSk7XG5cblx0XHRcdFx0Y29uc3QgaXNVUkwgPSBpc0ltYWdlVmFyaWFibGVFbnRyeShhdHRhY2htZW50KSAmJiBhdHRhY2htZW50LmlzVVJMO1xuXHRcdFx0XHRjb25zdCBob3ZlckVsZW1lbnQgPSB0aGlzLmN1c3RvbUF0dGFjaG1lbnQod2lkZ2V0LCBhdHRhY2htZW50Lm5hbWUsIGhvdmVyRGVsZWdhdGUsIGFyaWFMYWJlbCwgaXNBdHRhY2htZW50T21pdHRlZCwgYXR0YWNobWVudC5pc0ltYWdlLCBpc1VSTCwgYXR0YWNobWVudC52YWx1ZSBhcyBVaW50OEFycmF5KTtcblxuXHRcdFx0XHRpZiAoYXR0YWNobWVudC5yZWZlcmVuY2VzKSB7XG5cdFx0XHRcdFx0d2lkZ2V0LnN0eWxlLmN1cnNvciA9ICdwb2ludGVyJztcblx0XHRcdFx0XHRjb25zdCBjbGlja0hhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoYXR0YWNobWVudC5yZWZlcmVuY2VzICYmIFVSSS5pc1VyaShhdHRhY2htZW50LnJlZmVyZW5jZXNbMF0ucmVmZXJlbmNlKSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLm9wZW5SZXNvdXJjZShhdHRhY2htZW50LnJlZmVyZW5jZXNbMF0ucmVmZXJlbmNlLCBmYWxzZSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHRoaXMuYXR0YWNoZWRDb250ZXh0RGlzcG9zYWJsZXMuYWRkKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIod2lkZ2V0LCAnY2xpY2snLCBjbGlja0hhbmRsZXIpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghaXNBdHRhY2htZW50UGFydGlhbE9yT21pdHRlZCkge1xuXHRcdFx0XHRcdGNvbnN0IGJ1ZmZlciA9IGF0dGFjaG1lbnQudmFsdWUgYXMgVWludDhBcnJheTtcblx0XHRcdFx0XHR0aGlzLmNyZWF0ZUltYWdlRWxlbWVudHMoYnVmZmVyLCB3aWRnZXQsIGhvdmVyRWxlbWVudCk7XG5cdFx0XHRcdFx0dGhpcy5hdHRhY2hlZENvbnRleHREaXNwb3NhYmxlcy5hZGQodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoaG92ZXJEZWxlZ2F0ZSwgd2lkZ2V0LCBob3ZlckVsZW1lbnQsIHsgdHJhcEZvY3VzOiBmYWxzZSB9KSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0d2lkZ2V0LnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcblx0XHRcdH0gZWxzZSBpZiAoaXNQYXN0ZVZhcmlhYmxlRW50cnkoYXR0YWNobWVudCkpIHtcblx0XHRcdFx0YXJpYUxhYmVsID0gbG9jYWxpemUoJ2NoYXQuYXR0YWNobWVudCcsIFwiQXR0YWNoZWQgY29udGV4dCwgezB9XCIsIGF0dGFjaG1lbnQubmFtZSk7XG5cblx0XHRcdFx0Y29uc3QgY2xhc3NOYW1lcyA9IFsnZmlsZS1pY29uJywgYCR7YXR0YWNobWVudC5sYW5ndWFnZX0tbGFuZy1maWxlLWljb25gXTtcblx0XHRcdFx0aWYgKGF0dGFjaG1lbnQuY29waWVkRnJvbSkge1xuXHRcdFx0XHRcdHJlc291cmNlID0gYXR0YWNobWVudC5jb3BpZWRGcm9tLnVyaTtcblx0XHRcdFx0XHRyYW5nZSA9IGF0dGFjaG1lbnQuY29waWVkRnJvbS5yYW5nZTtcblx0XHRcdFx0XHRjb25zdCBmaWxlbmFtZSA9IGJhc2VuYW1lKHJlc291cmNlLnBhdGgpO1xuXHRcdFx0XHRcdGxhYmVsLnNldExhYmVsKGZpbGVuYW1lLCB1bmRlZmluZWQsIHsgZXh0cmFDbGFzc2VzOiBjbGFzc05hbWVzIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGxhYmVsLnNldExhYmVsKGF0dGFjaG1lbnQuZmlsZU5hbWUsIHVuZGVmaW5lZCwgeyBleHRyYUNsYXNzZXM6IGNsYXNzTmFtZXMgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0d2lkZ2V0LmFwcGVuZENoaWxkKGRvbS4kKCdzcGFuLmF0dGFjaG1lbnQtYWRkaXRpb25hbC1pbmZvJywge30sIGBQYXN0ZWQgJHthdHRhY2htZW50LnBhc3RlZExpbmVzfWApKTtcblxuXHRcdFx0XHR3aWRnZXQuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuXG5cdFx0XHRcdGNvbnN0IGhvdmVyQ29udGVudDogSU1hbmFnZWRIb3ZlclRvb2x0aXBNYXJrZG93blN0cmluZyA9IHtcblx0XHRcdFx0XHRtYXJrZG93bjoge1xuXHRcdFx0XHRcdFx0dmFsdWU6IGAqKiR7YXR0YWNobWVudC5jb3BpZWRGcm9tID8gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoYXR0YWNobWVudC5jb3BpZWRGcm9tLnVyaSwgeyByZWxhdGl2ZTogdHJ1ZSB9KSA6IGF0dGFjaG1lbnQuZmlsZU5hbWV9KipcXG5cXG4tLS1cXG5cXG5cXGBcXGBcXGAke2F0dGFjaG1lbnQubGFuZ3VhZ2V9XFxuJHthdHRhY2htZW50LmNvZGV9XFxuXFxgXFxgXFxgYCxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdG1hcmtkb3duTm90U3VwcG9ydGVkRmFsbGJhY2s6IGF0dGFjaG1lbnQuY29kZSxcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRpZiAoIXRoaXMuYXR0YWNoZWRDb250ZXh0RGlzcG9zYWJsZXMuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdHRoaXMuYXR0YWNoZWRDb250ZXh0RGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGhvdmVyRGVsZWdhdGUsIHdpZGdldCwgaG92ZXJDb250ZW50LCB7IHRyYXBGb2N1czogdHJ1ZSB9KSk7XG5cblx0XHRcdFx0XHRjb25zdCByZXNvdXJjZSA9IGF0dGFjaG1lbnQuY29waWVkRnJvbT8udXJpO1xuXHRcdFx0XHRcdGlmIChyZXNvdXJjZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5hdHRhY2hlZENvbnRleHREaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBob29rVXBSZXNvdXJjZUF0dGFjaG1lbnREcmFnQW5kQ29udGV4dE1lbnUoYWNjZXNzb3IsIHdpZGdldCwgcmVzb3VyY2UpKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBhdHRhY2htZW50TGFiZWwgPSBhdHRhY2htZW50LmZ1bGxOYW1lID8/IGF0dGFjaG1lbnQubmFtZTtcblx0XHRcdFx0Y29uc3Qgd2l0aEljb24gPSBhdHRhY2htZW50Lmljb24/LmlkID8gYCQoJHthdHRhY2htZW50Lmljb24uaWR9KSAke2F0dGFjaG1lbnRMYWJlbH1gIDogYXR0YWNobWVudExhYmVsO1xuXHRcdFx0XHRsYWJlbC5zZXRMYWJlbCh3aXRoSWNvbiwgY29ycmVzcG9uZGluZ0NvbnRlbnRSZWZlcmVuY2U/Lm9wdGlvbnM/LnN0YXR1cz8uZGVzY3JpcHRpb24pO1xuXG5cdFx0XHRcdGFyaWFMYWJlbCA9IGxvY2FsaXplKCdjaGF0LmF0dGFjaG1lbnQzJywgXCJBdHRhY2hlZCBjb250ZXh0OiB7MH0uXCIsIGF0dGFjaG1lbnQubmFtZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhdHRhY2htZW50LmtpbmQgPT09ICdzeW1ib2wnKSB7XG5cdFx0XHRcdGNvbnN0IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlID0gdGhpcy5hdHRhY2hlZENvbnRleHREaXNwb3NhYmxlcy5hZGQodGhpcy5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVTY29wZWQod2lkZ2V0KSk7XG5cdFx0XHRcdHRoaXMuYXR0YWNoZWRDb250ZXh0RGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gaG9va1VwU3ltYm9sQXR0YWNobWVudERyYWdBbmRDb250ZXh0TWVudShhY2Nlc3Nvciwgd2lkZ2V0LCBzY29wZWRDb250ZXh0S2V5U2VydmljZSwgeyAuLi5hdHRhY2htZW50LCBraW5kOiBhdHRhY2htZW50LnN5bWJvbEtpbmQgfSwgTWVudUlkLkNoYXRJbnB1dFN5bWJvbEF0dGFjaG1lbnRDb250ZXh0KSkpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaXNBdHRhY2htZW50UGFydGlhbE9yT21pdHRlZCkge1xuXHRcdFx0XHR3aWRnZXQuY2xhc3NMaXN0LmFkZCgnd2FybmluZycpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZGVzY3JpcHRpb24gPSBjb3JyZXNwb25kaW5nQ29udGVudFJlZmVyZW5jZT8ub3B0aW9ucz8uc3RhdHVzPy5kZXNjcmlwdGlvbjtcblx0XHRcdGlmIChpc0F0dGFjaG1lbnRQYXJ0aWFsT3JPbWl0dGVkKSB7XG5cdFx0XHRcdGFyaWFMYWJlbCA9IGAke2FyaWFMYWJlbH0ke2Rlc2NyaXB0aW9uID8gYCAke2Rlc2NyaXB0aW9ufWAgOiAnJ31gO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNlbGVjdG9yIG9mIFsnLm1vbmFjby1pY29uLXN1ZmZpeC1jb250YWluZXInLCAnLm1vbmFjby1pY29uLW5hbWUtY29udGFpbmVyJ10pIHtcblx0XHRcdFx0XHRjb25zdCBlbGVtZW50ID0gbGFiZWwuZWxlbWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcblx0XHRcdFx0XHRpZiAoZWxlbWVudCkge1xuXHRcdFx0XHRcdFx0ZWxlbWVudC5jbGFzc0xpc3QuYWRkKCd3YXJuaW5nJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmF0dGFjaGVkQ29udGV4dERpc3Bvc2FibGVzLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVzb3VyY2UpIHtcblx0XHRcdFx0d2lkZ2V0LnN0eWxlLmN1cnNvciA9ICdwb2ludGVyJztcblx0XHRcdFx0aWYgKCF0aGlzLmF0dGFjaGVkQ29udGV4dERpc3Bvc2FibGVzLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHR0aGlzLmF0dGFjaGVkQ29udGV4dERpc3Bvc2FibGVzLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHdpZGdldCwgZG9tLkV2ZW50VHlwZS5DTElDSywgYXN5bmMgKGU6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdFx0XHRcdGRvbS5FdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXHRcdFx0XHRcdFx0aWYgKGF0dGFjaG1lbnQuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5vcGVuUmVzb3VyY2UocmVzb3VyY2UsIHRydWUpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5vcGVuUmVzb3VyY2UocmVzb3VyY2UsIGZhbHNlLCByYW5nZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHdpZGdldC5hcmlhTGFiZWwgPSBhcmlhTGFiZWw7XG5cdFx0XHR3aWRnZXQudGFiSW5kZXggPSAwO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBjdXN0b21BdHRhY2htZW50KHdpZGdldDogSFRNTEVsZW1lbnQsIGZyaWVuZGx5TmFtZTogc3RyaW5nLCBob3ZlckRlbGVnYXRlOiBJSG92ZXJEZWxlZ2F0ZSwgYXJpYUxhYmVsOiBzdHJpbmcsIGlzQXR0YWNobWVudE9taXR0ZWQ6IGJvb2xlYW4sIGlzSW1hZ2U/OiBib29sZWFuLCBpc1VSTD86IGJvb2xlYW4sIHZhbHVlPzogVWludDhBcnJheSk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCBwaWxsSWNvbiA9IGRvbS4kKCdkaXYuY2hhdC1hdHRhY2hlZC1jb250ZXh0LXBpbGwnLCB7fSwgZG9tLiQoaXNBdHRhY2htZW50T21pdHRlZCA/ICdzcGFuLmNvZGljb24uY29kaWNvbi13YXJuaW5nJyA6ICdzcGFuLmNvZGljb24uY29kaWNvbi1maWxlLW1lZGlhJykpO1xuXHRcdGNvbnN0IHRleHRMYWJlbCA9IGRvbS4kKCdzcGFuLmNoYXQtYXR0YWNoZWQtY29udGV4dC1jdXN0b20tdGV4dCcsIHt9LCBmcmllbmRseU5hbWUpO1xuXHRcdHdpZGdldC5hcHBlbmRDaGlsZChwaWxsSWNvbik7XG5cdFx0d2lkZ2V0LmFwcGVuZENoaWxkKHRleHRMYWJlbCk7XG5cblx0XHRjb25zdCBob3ZlckVsZW1lbnQgPSBkb20uJCgnZGl2LmNoYXQtYXR0YWNoZWQtY29udGV4dC1ob3ZlcicpO1xuXHRcdGhvdmVyRWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBhcmlhTGFiZWwpO1xuXG5cdFx0aWYgKGlzVVJMICYmICFpc0F0dGFjaG1lbnRPbWl0dGVkICYmIHZhbHVlKSB7XG5cdFx0XHRob3ZlckVsZW1lbnQudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgnY2hhdC5pbWFnZUF0dGFjaG1lbnRIb3ZlcicsIFwiezB9XCIsIGNvbnZlcnRVaW50OEFycmF5VG9TdHJpbmcodmFsdWUpKTtcblx0XHRcdHRoaXMuYXR0YWNoZWRDb250ZXh0RGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGhvdmVyRGVsZWdhdGUsIHdpZGdldCwgaG92ZXJFbGVtZW50LCB7IHRyYXBGb2N1czogdHJ1ZSB9KSk7XG5cdFx0fVxuXG5cblx0XHRpZiAoaXNBdHRhY2htZW50T21pdHRlZCkge1xuXHRcdFx0d2lkZ2V0LmNsYXNzTGlzdC5hZGQoJ3dhcm5pbmcnKTtcblx0XHRcdGhvdmVyRWxlbWVudC50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdjaGF0LmZpbGVBdHRhY2htZW50SG92ZXInLCBcIlNlbGVjdGVkIG1vZGVsIGRvZXMgbm90IHN1cHBvcnQgdGhpcyB7MH0gdHlwZS5cIiwgaXNJbWFnZSA/ICdpbWFnZScgOiAnZmlsZScpO1xuXHRcdFx0dGhpcy5hdHRhY2hlZENvbnRleHREaXNwb3NhYmxlcy5hZGQodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoaG92ZXJEZWxlZ2F0ZSwgd2lkZ2V0LCBob3ZlckVsZW1lbnQsIHsgdHJhcEZvY3VzOiB0cnVlIH0pKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gaG92ZXJFbGVtZW50O1xuXHR9XG5cblx0cHJpdmF0ZSBvcGVuUmVzb3VyY2UocmVzb3VyY2U6IFVSSSwgaXNEaXJlY3Rvcnk6IHRydWUpOiB2b2lkO1xuXHRwcml2YXRlIG9wZW5SZXNvdXJjZShyZXNvdXJjZTogVVJJLCBpc0RpcmVjdG9yeTogZmFsc2UsIHJhbmdlOiBJUmFuZ2UgfCB1bmRlZmluZWQpOiB2b2lkO1xuXHRwcml2YXRlIG9wZW5SZXNvdXJjZShyZXNvdXJjZTogVVJJLCBpc0RpcmVjdG9yeT86IGJvb2xlYW4sIHJhbmdlPzogSVJhbmdlKTogdm9pZCB7XG5cdFx0aWYgKGlzRGlyZWN0b3J5KSB7XG5cdFx0XHQvLyBSZXZlYWwgRGlyZWN0b3J5IGluIGV4cGxvcmVyXG5cdFx0XHR0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKHJldmVhbEluU2lkZUJhckNvbW1hbmQuaWQsIHJlc291cmNlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBPcGVuIGZpbGUgaW4gZWRpdG9yXG5cdFx0Y29uc3Qgb3BlblRleHRFZGl0b3JPcHRpb25zOiBJVGV4dEVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQgPSByYW5nZSA/IHsgc2VsZWN0aW9uOiByYW5nZSB9IDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG9wdGlvbnM6IE9wZW5JbnRlcm5hbE9wdGlvbnMgPSB7XG5cdFx0XHRmcm9tVXNlckdlc3R1cmU6IHRydWUsXG5cdFx0XHRlZGl0b3JPcHRpb25zOiBvcGVuVGV4dEVkaXRvck9wdGlvbnMsXG5cdFx0fTtcblx0XHR0aGlzLm9wZW5lclNlcnZpY2Uub3BlbihyZXNvdXJjZSwgb3B0aW9ucyk7XG5cdH1cblxuXHQvLyBIZWxwZXIgZnVuY3Rpb24gdG8gY3JlYXRlIGFuZCByZXBsYWNlIGltYWdlXG5cdHByaXZhdGUgYXN5bmMgY3JlYXRlSW1hZ2VFbGVtZW50cyhidWZmZXI6IEFycmF5QnVmZmVyIHwgVWludDhBcnJheSwgd2lkZ2V0OiBIVE1MRWxlbWVudCwgaG92ZXJFbGVtZW50OiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbYnVmZmVyXSwgeyB0eXBlOiAnaW1hZ2UvcG5nJyB9KTtcblx0XHRjb25zdCB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuXHRcdGNvbnN0IGltZyA9IGRvbS4kKCdpbWcuY2hhdC1hdHRhY2hlZC1jb250ZXh0LWltYWdlJywgeyBzcmM6IHVybCwgYWx0OiAnJyB9KTtcblx0XHRjb25zdCBwaWxsSW1nID0gZG9tLiQoJ2ltZy5jaGF0LWF0dGFjaGVkLWNvbnRleHQtcGlsbC1pbWFnZScsIHsgc3JjOiB1cmwsIGFsdDogJycgfSk7XG5cdFx0Y29uc3QgcGlsbCA9IGRvbS4kKCdkaXYuY2hhdC1hdHRhY2hlZC1jb250ZXh0LXBpbGwnLCB7fSwgcGlsbEltZyk7XG5cblx0XHRjb25zdCBleGlzdGluZ1BpbGwgPSB3aWRnZXQucXVlcnlTZWxlY3RvcignLmNoYXQtYXR0YWNoZWQtY29udGV4dC1waWxsJyk7XG5cdFx0aWYgKGV4aXN0aW5nUGlsbCkge1xuXHRcdFx0ZXhpc3RpbmdQaWxsLnJlcGxhY2VXaXRoKHBpbGwpO1xuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSBob3ZlciBpbWFnZVxuXHRcdGhvdmVyRWxlbWVudC5hcHBlbmRDaGlsZChpbWcpO1xuXG5cdFx0aW1nLm9ubG9hZCA9ICgpID0+IHtcblx0XHRcdFVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcblx0XHR9O1xuXG5cdFx0aW1nLm9uZXJyb3IgPSAoKSA9PiB7XG5cdFx0XHQvLyByZXNldCB0byBvcmlnaW5hbCBpY29uIG9uIGVycm9yIG9yIGludmFsaWQgaW1hZ2Vcblx0XHRcdGNvbnN0IHBpbGxJY29uID0gZG9tLiQoJ2Rpdi5jaGF0LWF0dGFjaGVkLWNvbnRleHQtcGlsbCcsIHt9LCBkb20uJCgnc3Bhbi5jb2RpY29uLmNvZGljb24tZmlsZS1tZWRpYScpKTtcblx0XHRcdGNvbnN0IHBpbGwgPSBkb20uJCgnZGl2LmNoYXQtYXR0YWNoZWQtY29udGV4dC1waWxsJywge30sIHBpbGxJY29uKTtcblx0XHRcdGNvbnN0IGV4aXN0aW5nUGlsbCA9IHdpZGdldC5xdWVyeVNlbGVjdG9yKCcuY2hhdC1hdHRhY2hlZC1jb250ZXh0LXBpbGwnKTtcblx0XHRcdGlmIChleGlzdGluZ1BpbGwpIHtcblx0XHRcdFx0ZXhpc3RpbmdQaWxsLnJlcGxhY2VXaXRoKHBpbGwpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhvb2tVcFJlc291cmNlQXR0YWNobWVudERyYWdBbmRDb250ZXh0TWVudShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgd2lkZ2V0OiBIVE1MRWxlbWVudCwgcmVzb3VyY2U6IFVSSSk6IElEaXNwb3NhYmxlIHtcblx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKTtcblx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblxuXHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHQvLyBDb250ZXh0XG5cdGNvbnN0IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlID0gc3RvcmUuYWRkKGNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZCh3aWRnZXQpKTtcblx0c3RvcmUuYWRkKHNldFJlc291cmNlQ29udGV4dChhY2Nlc3Nvciwgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UsIHJlc291cmNlKSk7XG5cblx0Ly8gRHJhZyBhbmQgZHJvcFxuXHR3aWRnZXQuZHJhZ2dhYmxlID0gdHJ1ZTtcblx0c3RvcmUuYWRkKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIod2lkZ2V0LCAnZHJhZ3N0YXJ0JywgZSA9PiB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gZmlsbEVkaXRvcnNEcmFnRGF0YShhY2Nlc3NvciwgW3Jlc291cmNlXSwgZSkpO1xuXHRcdGUuZGF0YVRyYW5zZmVyPy5zZXREcmFnSW1hZ2Uod2lkZ2V0LCAwLCAwKTtcblx0fSkpO1xuXG5cdC8vIENvbnRleHQgbWVudVxuXHRzdG9yZS5hZGQoYWRkQmFzaWNDb250ZXh0TWVudShhY2Nlc3Nvciwgd2lkZ2V0LCBzY29wZWRDb250ZXh0S2V5U2VydmljZSwgTWVudUlkLkNoYXRJbnB1dFJlc291cmNlQXR0YWNobWVudENvbnRleHQsIHJlc291cmNlKSk7XG5cblx0cmV0dXJuIHN0b3JlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaG9va1VwU3ltYm9sQXR0YWNobWVudERyYWdBbmRDb250ZXh0TWVudShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgd2lkZ2V0OiBIVE1MRWxlbWVudCwgc2NvcGVkQ29udGV4dEtleVNlcnZpY2U6IElTY29wZWRDb250ZXh0S2V5U2VydmljZSwgYXR0YWNobWVudDogeyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBMb2NhdGlvbjsga2luZDogU3ltYm9sS2luZCB9LCBjb250ZXh0TWVudUlkOiBNZW51SWQpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSk7XG5cdGNvbnN0IHRleHRNb2RlbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRleHRNb2RlbFNlcnZpY2UpO1xuXG5cdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdC8vIENvbnRleHRcblx0c3RvcmUuYWRkKHNldFJlc291cmNlQ29udGV4dChhY2Nlc3Nvciwgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UsIGF0dGFjaG1lbnQudmFsdWUudXJpKSk7XG5cblx0Y29uc3QgY2hhdFJlc291cmNlQ29udGV4dCA9IGNoYXRBdHRhY2htZW50UmVzb3VyY2VDb250ZXh0S2V5LmJpbmRUbyhzY29wZWRDb250ZXh0S2V5U2VydmljZSk7XG5cdGNoYXRSZXNvdXJjZUNvbnRleHQuc2V0KGF0dGFjaG1lbnQudmFsdWUudXJpLnRvU3RyaW5nKCkpO1xuXG5cdC8vIERyYWcgYW5kIGRyb3Bcblx0d2lkZ2V0LmRyYWdnYWJsZSA9IHRydWU7XG5cdHN0b3JlLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHdpZGdldCwgJ2RyYWdzdGFydCcsIGUgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IGZpbGxFZGl0b3JzRHJhZ0RhdGEoYWNjZXNzb3IsIFt7IHJlc291cmNlOiBhdHRhY2htZW50LnZhbHVlLnVyaSwgc2VsZWN0aW9uOiBhdHRhY2htZW50LnZhbHVlLnJhbmdlIH1dLCBlKSk7XG5cblx0XHRmaWxsSW5TeW1ib2xzRHJhZ0RhdGEoW3tcblx0XHRcdGZzUGF0aDogYXR0YWNobWVudC52YWx1ZS51cmkuZnNQYXRoLFxuXHRcdFx0cmFuZ2U6IGF0dGFjaG1lbnQudmFsdWUucmFuZ2UsXG5cdFx0XHRuYW1lOiBhdHRhY2htZW50Lm5hbWUsXG5cdFx0XHRraW5kOiBhdHRhY2htZW50LmtpbmQsXG5cdFx0fV0sIGUpO1xuXG5cdFx0ZS5kYXRhVHJhbnNmZXI/LnNldERyYWdJbWFnZSh3aWRnZXQsIDAsIDApO1xuXHR9KSk7XG5cblx0Ly8gQ29udGV4dCBtZW51XG5cdGNvbnN0IHByb3ZpZGVyQ29udGV4dHM6IFJlYWRvbmx5QXJyYXk8W0lDb250ZXh0S2V5PGJvb2xlYW4+LCBMYW5ndWFnZUZlYXR1cmVSZWdpc3RyeTx1bmtub3duPl0+ID0gW1xuXHRcdFtFZGl0b3JDb250ZXh0S2V5cy5oYXNEZWZpbml0aW9uUHJvdmlkZXIuYmluZFRvKHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKSwgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZGVmaW5pdGlvblByb3ZpZGVyXSxcblx0XHRbRWRpdG9yQ29udGV4dEtleXMuaGFzUmVmZXJlbmNlUHJvdmlkZXIuYmluZFRvKHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKSwgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UucmVmZXJlbmNlUHJvdmlkZXJdLFxuXHRcdFtFZGl0b3JDb250ZXh0S2V5cy5oYXNJbXBsZW1lbnRhdGlvblByb3ZpZGVyLmJpbmRUbyhzY29wZWRDb250ZXh0S2V5U2VydmljZSksIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmltcGxlbWVudGF0aW9uUHJvdmlkZXJdLFxuXHRcdFtFZGl0b3JDb250ZXh0S2V5cy5oYXNUeXBlRGVmaW5pdGlvblByb3ZpZGVyLmJpbmRUbyhzY29wZWRDb250ZXh0S2V5U2VydmljZSksIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLnR5cGVEZWZpbml0aW9uUHJvdmlkZXJdLFxuXHRdO1xuXG5cdGNvbnN0IHVwZGF0ZUNvbnRleHRLZXlzID0gYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsUmVmID0gYXdhaXQgdGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShhdHRhY2htZW50LnZhbHVlLnVyaSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gbW9kZWxSZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbDtcblx0XHRcdGZvciAoY29uc3QgW2NvbnRleHRLZXksIHJlZ2lzdHJ5XSBvZiBwcm92aWRlckNvbnRleHRzKSB7XG5cdFx0XHRcdGNvbnRleHRLZXkuc2V0KHJlZ2lzdHJ5Lmhhcyhtb2RlbCkpO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRtb2RlbFJlZi5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9O1xuXHRzdG9yZS5hZGQoYWRkQmFzaWNDb250ZXh0TWVudShhY2Nlc3Nvciwgd2lkZ2V0LCBzY29wZWRDb250ZXh0S2V5U2VydmljZSwgY29udGV4dE1lbnVJZCwgYXR0YWNobWVudC52YWx1ZSwgdXBkYXRlQ29udGV4dEtleXMpKTtcblxuXHRyZXR1cm4gc3RvcmU7XG59XG5cbmZ1bmN0aW9uIHNldFJlc291cmNlQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgc2NvcGVkQ29udGV4dEtleVNlcnZpY2U6IElTY29wZWRDb250ZXh0S2V5U2VydmljZSwgcmVzb3VyY2U6IFVSSSkge1xuXHRjb25zdCBmaWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZVNlcnZpY2UpO1xuXHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cdGNvbnN0IG1vZGVsU2VydmljZSA9IGFjY2Vzc29yLmdldChJTW9kZWxTZXJ2aWNlKTtcblxuXHRjb25zdCByZXNvdXJjZUNvbnRleHRLZXkgPSBuZXcgUmVzb3VyY2VDb250ZXh0S2V5KHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLCBmaWxlU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlLCBtb2RlbFNlcnZpY2UpO1xuXHRyZXNvdXJjZUNvbnRleHRLZXkuc2V0KHJlc291cmNlKTtcblx0cmV0dXJuIHJlc291cmNlQ29udGV4dEtleTtcbn1cblxuZnVuY3Rpb24gYWRkQmFzaWNDb250ZXh0TWVudShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgd2lkZ2V0OiBIVE1MRWxlbWVudCwgc2NvcGVkQ29udGV4dEtleVNlcnZpY2U6IElTY29wZWRDb250ZXh0S2V5U2VydmljZSwgbWVudUlkOiBNZW51SWQsIGFyZzogYW55LCB1cGRhdGVDb250ZXh0S2V5cz86ICgpID0+IFByb21pc2U8dm9pZD4pOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGNvbnRleHRNZW51U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29udGV4dE1lbnVTZXJ2aWNlKTtcblx0Y29uc3QgbWVudVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU1lbnVTZXJ2aWNlKTtcblxuXHRyZXR1cm4gZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih3aWRnZXQsIGRvbS5FdmVudFR5cGUuQ09OVEVYVF9NRU5VLCBhc3luYyBkb21FdmVudCA9PiB7XG5cdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRNb3VzZUV2ZW50KGRvbS5nZXRXaW5kb3coZG9tRXZlbnQpLCBkb21FdmVudCk7XG5cdFx0ZG9tLkV2ZW50SGVscGVyLnN0b3AoZG9tRXZlbnQsIHRydWUpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHVwZGF0ZUNvbnRleHRLZXlzPy4oKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGUpO1xuXHRcdH1cblxuXHRcdGNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0Y29udGV4dEtleVNlcnZpY2U6IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBldmVudCxcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHtcblx0XHRcdFx0Y29uc3QgbWVudSA9IG1lbnVTZXJ2aWNlLmdldE1lbnVBY3Rpb25zKG1lbnVJZCwgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UsIHsgYXJnIH0pO1xuXHRcdFx0XHRyZXR1cm4gZ2V0Rmxh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VyxNQUFNLGlCQUFpQixxQkFBcUIsV0FBVyxNQUFNLEdBQUc7QUFDakYsUUFBSTtBQUNILFlBQU0sUUFBUSxTQUFTLE9BQU87QUFDOUIsaUJBQVcsQ0FBQyxZQUFZLFFBQVEsS0FBSyxrQkFBa0I7QUFDdEQsbUJBQVcsSUFBSSxTQUFTLElBQUksS0FBSyxDQUFDO0FBQUEsTUFDbkM7QUFBQSxJQUNELFVBQUU7QUFDRCxlQUFTLFFBQVE7QUFBQSxJQUNsQjtBQUFBLEVBQ0Q7QUFDQSxRQUFNLElBQUksb0JBQW9CLFVBQVUsUUFBUSx5QkFBeUIsZUFBZSxXQUFXLE9BQU8saUJBQWlCLENBQUM7QUFFNUgsU0FBTztBQUNSO0FBRUEsU0FBUyxtQkFBbUIsVUFBNEIseUJBQW1ELFVBQWU7QUFDekgsUUFBTSxjQUFjLFNBQVMsSUFBSSxZQUFZO0FBQzdDLFFBQU0sa0JBQWtCLFNBQVMsSUFBSSxnQkFBZ0I7QUFDckQsUUFBTSxlQUFlLFNBQVMsSUFBSSxhQUFhO0FBRS9DLFFBQU0scUJBQXFCLElBQUksbUJBQW1CLHlCQUF5QixhQUFhLGlCQUFpQixZQUFZO0FBQ3JILHFCQUFtQixJQUFJLFFBQVE7QUFDL0IsU0FBTztBQUNSO0FBRUEsU0FBUyxvQkFBb0IsVUFBNEIsUUFBcUIseUJBQW1ELFFBQWdCLEtBQVUsbUJBQXNEO0FBQ2hOLFFBQU0scUJBQXFCLFNBQVMsSUFBSSxtQkFBbUI7QUFDM0QsUUFBTSxjQUFjLFNBQVMsSUFBSSxZQUFZO0FBRTdDLFNBQU8sSUFBSSxzQkFBc0IsUUFBUSxJQUFJLFVBQVUsY0FBYyxPQUFNLGFBQVk7QUFDdEYsVUFBTSxRQUFRLElBQUksbUJBQW1CLElBQUksVUFBVSxRQUFRLEdBQUcsUUFBUTtBQUN0RSxRQUFJLFlBQVksS0FBSyxVQUFVLElBQUk7QUFFbkMsUUFBSTtBQUNILFlBQU0sb0JBQW9CO0FBQUEsSUFDM0IsU0FBUyxHQUFHO0FBQ1gsY0FBUSxNQUFNLENBQUM7QUFBQSxJQUNoQjtBQUVBLHVCQUFtQixnQkFBZ0I7QUFBQSxNQUNsQyxtQkFBbUI7QUFBQSxNQUNuQixXQUFXLE1BQU07QUFBQSxNQUNqQixZQUFZLE1BQU07QUFDakIsY0FBTSxPQUFPLFlBQVksZUFBZSxRQUFRLHlCQUF5QixFQUFFLElBQUksQ0FBQztBQUNoRixlQUFPLDBCQUEwQixJQUFJO0FBQUEsTUFDdEM7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRjsiLAogICJuYW1lcyI6IFsicmVzb3VyY2UiLCAicGlsbCIsICJleGlzdGluZ1BpbGwiLCAiYWNjZXNzb3IiXQp9Cg==
