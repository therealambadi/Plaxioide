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
import { DataTransfers } from "../../../../base/browser/dnd.js";
import { $, DragAndDropObserver } from "../../../../base/browser/dom.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { UriList } from "../../../../base/common/dataTransfer.js";
import { Mimes } from "../../../../base/common/mime.js";
import { basename } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { SymbolKinds } from "../../../../editor/common/languages.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../nls.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { CodeDataTransfers, containsDragType, extractEditorsDropData, extractMarkerDropData, extractSymbolDropData } from "../../../../platform/dnd/browser/dnd.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { ISharedWebContentExtractorService } from "../../../../platform/webContentExtractor/common/webContentExtractor.js";
import { isUntitledResourceEditorInput } from "../../../common/editor.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IExtensionService, isProposedApiEnabled } from "../../../services/extensions/common/extensions.js";
import { UntitledTextEditorInput } from "../../../services/untitled/common/untitledTextEditorInput.js";
import { IDiagnosticVariableEntryFilterData } from "../common/chatModel.js";
import { IChatWidgetService } from "./chat.js";
import { imageToHash } from "./chatPasteProviders.js";
import { resizeImage } from "./imageUtils.js";
var ChatDragAndDropType = /* @__PURE__ */ ((ChatDragAndDropType2) => {
  ChatDragAndDropType2[ChatDragAndDropType2["FILE_INTERNAL"] = 0] = "FILE_INTERNAL";
  ChatDragAndDropType2[ChatDragAndDropType2["FILE_EXTERNAL"] = 1] = "FILE_EXTERNAL";
  ChatDragAndDropType2[ChatDragAndDropType2["FOLDER"] = 2] = "FOLDER";
  ChatDragAndDropType2[ChatDragAndDropType2["IMAGE"] = 3] = "IMAGE";
  ChatDragAndDropType2[ChatDragAndDropType2["SYMBOL"] = 4] = "SYMBOL";
  ChatDragAndDropType2[ChatDragAndDropType2["HTML"] = 5] = "HTML";
  ChatDragAndDropType2[ChatDragAndDropType2["MARKER"] = 6] = "MARKER";
  return ChatDragAndDropType2;
})(ChatDragAndDropType || {});
let ChatDragAndDrop = class extends Themable {
  constructor(attachmentModel, styles, themeService, extensionService, fileService, editorService, dialogService, textModelService, webContentExtractorService, chatWidgetService, logService) {
    super(themeService);
    this.attachmentModel = attachmentModel;
    this.styles = styles;
    this.extensionService = extensionService;
    this.fileService = fileService;
    this.editorService = editorService;
    this.dialogService = dialogService;
    this.textModelService = textModelService;
    this.webContentExtractorService = webContentExtractorService;
    this.chatWidgetService = chatWidgetService;
    this.logService = logService;
    this.overlays = /* @__PURE__ */ new Map();
    this.overlayTextBackground = "";
    this.currentActiveTarget = void 0;
    this.updateStyles();
  }
  addOverlay(target, overlayContainer) {
    this.removeOverlay(target);
    const { overlay, disposable } = this.createOverlay(target, overlayContainer);
    this.overlays.set(target, { overlay, disposable });
  }
  removeOverlay(target) {
    if (this.currentActiveTarget === target) {
      this.currentActiveTarget = void 0;
    }
    const existingOverlay = this.overlays.get(target);
    if (existingOverlay) {
      existingOverlay.overlay.remove();
      existingOverlay.disposable.dispose();
      this.overlays.delete(target);
    }
  }
  createOverlay(target, overlayContainer) {
    const overlay = document.createElement("div");
    overlay.classList.add("chat-dnd-overlay");
    this.updateOverlayStyles(overlay);
    overlayContainer.appendChild(overlay);
    const disposable = new DragAndDropObserver(target, {
      onDragOver: (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (target === this.currentActiveTarget) {
          return;
        }
        if (this.currentActiveTarget) {
          this.setOverlay(this.currentActiveTarget, void 0);
        }
        this.currentActiveTarget = target;
        this.onDragEnter(e, target);
      },
      onDragLeave: (e) => {
        if (target === this.currentActiveTarget) {
          this.currentActiveTarget = void 0;
        }
        this.onDragLeave(e, target);
      },
      onDrop: (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (target !== this.currentActiveTarget) {
          return;
        }
        this.currentActiveTarget = void 0;
        this.onDrop(e, target);
      }
    });
    return { overlay, disposable };
  }
  onDragEnter(e, target) {
    const estimatedDropType = this.guessDropType(e);
    this.updateDropFeedback(e, target, estimatedDropType);
  }
  onDragLeave(e, target) {
    this.updateDropFeedback(e, target, void 0);
  }
  onDrop(e, target) {
    this.updateDropFeedback(e, target, void 0);
    this.drop(e);
  }
  async drop(e) {
    const contexts = await this.getAttachContext(e);
    if (contexts.length === 0) {
      return;
    }
    this.attachmentModel.addContext(...contexts);
  }
  updateDropFeedback(e, target, dropType) {
    const showOverlay = dropType !== void 0;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = showOverlay ? "copy" : "none";
    }
    this.setOverlay(target, dropType);
  }
  guessDropType(e) {
    if (this.isImageDnd(e)) {
      return this.extensionService.extensions.some((ext) => isProposedApiEnabled(ext, "chatReferenceBinaryData")) ? 3 /* IMAGE */ : void 0;
    } else if (containsDragType(e, "text/html")) {
      return 5 /* HTML */;
    } else if (containsDragType(e, CodeDataTransfers.SYMBOLS)) {
      return 4 /* SYMBOL */;
    } else if (containsDragType(e, CodeDataTransfers.MARKERS)) {
      return 6 /* MARKER */;
    } else if (containsDragType(e, DataTransfers.FILES)) {
      return 1 /* FILE_EXTERNAL */;
    } else if (containsDragType(e, DataTransfers.INTERNAL_URI_LIST)) {
      return 0 /* FILE_INTERNAL */;
    } else if (containsDragType(e, Mimes.uriList, CodeDataTransfers.FILES, DataTransfers.RESOURCES)) {
      return 2 /* FOLDER */;
    }
    return void 0;
  }
  isDragEventSupported(e) {
    const dropType = this.guessDropType(e);
    return dropType !== void 0;
  }
  getDropTypeName(type) {
    switch (type) {
      case 0 /* FILE_INTERNAL */:
        return localize("file", "File");
      case 1 /* FILE_EXTERNAL */:
        return localize("file", "File");
      case 2 /* FOLDER */:
        return localize("folder", "Folder");
      case 3 /* IMAGE */:
        return localize("image", "Image");
      case 4 /* SYMBOL */:
        return localize("symbol", "Symbol");
      case 6 /* MARKER */:
        return localize("problem", "Problem");
      case 5 /* HTML */:
        return localize("url", "URL");
    }
  }
  isImageDnd(e) {
    if (containsDragType(e, "image")) {
      return true;
    }
    if (containsDragType(e, DataTransfers.FILES)) {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        return file.type.startsWith("image/");
      }
      const items = e.dataTransfer?.items;
      if (items && items.length > 0) {
        const item = items[0];
        return item.type.startsWith("image/");
      }
    }
    return false;
  }
  async getAttachContext(e) {
    if (!this.isDragEventSupported(e)) {
      return [];
    }
    const markerData = extractMarkerDropData(e);
    if (markerData) {
      return this.resolveMarkerAttachContext(markerData);
    }
    if (containsDragType(e, CodeDataTransfers.SYMBOLS)) {
      const data = extractSymbolDropData(e);
      return this.resolveSymbolsAttachContext(data);
    }
    const editorDragData = extractEditorsDropData(e);
    if (editorDragData.length === 0 && !containsDragType(e, DataTransfers.INTERNAL_URI_LIST) && containsDragType(e, Mimes.uriList) && (containsDragType(e, Mimes.html) || containsDragType(e, Mimes.text))) {
      return this.resolveHTMLAttachContext(e);
    }
    return coalesce(await Promise.all(editorDragData.map((editorInput) => {
      return this.resolveAttachContext(editorInput);
    })));
  }
  async resolveAttachContext(editorInput) {
    const imageContext = await getImageAttachContext(editorInput, this.fileService, this.dialogService);
    if (imageContext) {
      return this.extensionService.extensions.some((ext) => isProposedApiEnabled(ext, "chatReferenceBinaryData")) ? imageContext : void 0;
    }
    return await this.getEditorAttachContext(editorInput);
  }
  async getEditorAttachContext(editor) {
    if (isUntitledResourceEditorInput(editor)) {
      return await this.resolveUntitledAttachContext(editor);
    }
    if (!editor.resource) {
      return void 0;
    }
    let stat;
    try {
      stat = await this.fileService.stat(editor.resource);
    } catch {
      return void 0;
    }
    if (!stat.isDirectory && !stat.isFile) {
      return void 0;
    }
    return await getResourceAttachContext(editor.resource, stat.isDirectory, this.textModelService);
  }
  async resolveUntitledAttachContext(editor) {
    if (editor.resource) {
      return await getResourceAttachContext(editor.resource, false, this.textModelService);
    }
    const openUntitledEditors = this.editorService.editors.filter((editor2) => editor2 instanceof UntitledTextEditorInput);
    for (const canidate of openUntitledEditors) {
      const model = await canidate.resolve();
      const contents = model.textEditorModel?.getValue();
      if (contents === editor.contents) {
        return await getResourceAttachContext(canidate.resource, false, this.textModelService);
      }
    }
    return void 0;
  }
  resolveSymbolsAttachContext(symbols) {
    return symbols.map((symbol) => {
      const resource = URI.file(symbol.fsPath);
      return {
        kind: "symbol",
        id: symbolId(resource, symbol.range),
        value: { uri: resource, range: symbol.range },
        symbolKind: symbol.kind,
        fullName: `$(${SymbolKinds.toIcon(symbol.kind).id}) ${symbol.name}`,
        name: symbol.name
      };
    });
  }
  async downloadImageAsUint8Array(url) {
    try {
      const extractedImages = await this.webContentExtractorService.readImage(URI.parse(url), CancellationToken.None);
      if (extractedImages) {
        return extractedImages.buffer;
      }
    } catch (error) {
      this.logService.warn("Fetch failed:", error);
    }
    const selection = this.chatWidgetService.lastFocusedWidget?.inputEditor.getSelection();
    if (selection && this.chatWidgetService.lastFocusedWidget) {
      this.chatWidgetService.lastFocusedWidget.inputEditor.executeEdits("chatInsertUrl", [{ range: selection, text: url }]);
    }
    this.logService.warn(`Image URLs must end in .jpg, .png, .gif, .webp, or .bmp. Failed to fetch image from this URL: ${url}`);
    return void 0;
  }
  async resolveHTMLAttachContext(e) {
    const displayName = localize("dragAndDroppedImageName", "Image from URL");
    let finalDisplayName = displayName;
    for (let appendValue = 2; this.attachmentModel.attachments.some((attachment) => attachment.name === finalDisplayName); appendValue++) {
      finalDisplayName = `${displayName} ${appendValue}`;
    }
    const dataFromFile = await this.extractImageFromFile(e);
    if (dataFromFile) {
      return [await this.createImageVariable(await resizeImage(dataFromFile), finalDisplayName)];
    }
    const dataFromUrl = await this.extractImageFromUrl(e);
    const variableEntries = [];
    if (dataFromUrl) {
      for (const url of dataFromUrl) {
        if (/^data:image\/[a-z]+;base64,/.test(url)) {
          variableEntries.push(await this.createImageVariable(await resizeImage(url), finalDisplayName, URI.parse(url)));
        } else if (/^https?:\/\/.+/.test(url)) {
          const imageData = await this.downloadImageAsUint8Array(url);
          if (imageData) {
            variableEntries.push(await this.createImageVariable(await resizeImage(imageData), finalDisplayName, URI.parse(url), url));
          }
        }
      }
    }
    return variableEntries;
  }
  async createImageVariable(data, name, uri, id) {
    return {
      id: id || await imageToHash(data),
      name,
      value: data,
      isImage: true,
      isFile: false,
      isDirectory: false,
      references: uri ? [{ reference: uri, kind: "reference" }] : []
    };
  }
  resolveMarkerAttachContext(markers) {
    return markers.map((marker) => {
      let filter;
      if (!("severity" in marker)) {
        filter = { filterUri: URI.revive(marker.uri), filterSeverity: MarkerSeverity.Warning };
      } else {
        filter = IDiagnosticVariableEntryFilterData.fromMarker(marker);
      }
      return IDiagnosticVariableEntryFilterData.toEntry(filter);
    });
  }
  setOverlay(target, type) {
    this.overlayText?.remove();
    this.overlayText = void 0;
    const { overlay } = this.overlays.get(target);
    if (type !== void 0) {
      const iconAndtextElements = renderLabelWithIcons(`$(${Codicon.attach.id}) ${this.getOverlayText(type)}`);
      const htmlElements = iconAndtextElements.map((element) => {
        if (typeof element === "string") {
          return $("span.overlay-text", void 0, element);
        }
        return element;
      });
      this.overlayText = $("span.attach-context-overlay-text", void 0, ...htmlElements);
      this.overlayText.style.backgroundColor = this.overlayTextBackground;
      overlay.appendChild(this.overlayText);
    }
    overlay.classList.toggle("visible", type !== void 0);
  }
  getOverlayText(type) {
    const typeName = this.getDropTypeName(type);
    return localize("attacAsContext", "Attach {0} as Context", typeName);
  }
  updateOverlayStyles(overlay) {
    overlay.style.backgroundColor = this.getColor(this.styles.overlayBackground) || "";
    overlay.style.color = this.getColor(this.styles.listForeground) || "";
  }
  updateStyles() {
    this.overlays.forEach((overlay) => this.updateOverlayStyles(overlay.overlay));
    this.overlayTextBackground = this.getColor(this.styles.listBackground) || "";
  }
  async extractImageFromFile(e) {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        try {
          const buffer = await file.arrayBuffer();
          return new Uint8Array(buffer);
        } catch (error) {
          this.logService.error("Error reading file:", error);
          return void 0;
        }
      }
    }
    return void 0;
  }
  async extractImageFromUrl(e) {
    const textUrl = e.dataTransfer?.getData("text/uri-list");
    if (textUrl) {
      try {
        const uris = UriList.parse(textUrl);
        if (uris.length > 0) {
          return uris;
        }
      } catch (error) {
        this.logService.error("Error parsing URI list:", error);
        return void 0;
      }
    }
    return void 0;
  }
};
ChatDragAndDrop = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, IFileService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IDialogService),
  __decorateParam(7, ITextModelService),
  __decorateParam(8, ISharedWebContentExtractorService),
  __decorateParam(9, IChatWidgetService),
  __decorateParam(10, ILogService)
], ChatDragAndDrop);
async function getResourceAttachContext(resource, isDirectory, textModelService) {
  let isOmitted = false;
  if (!isDirectory) {
    try {
      const createdModel = await textModelService.createModelReference(resource);
      createdModel.dispose();
    } catch {
      isOmitted = true;
    }
    if (/\.(svg)$/i.test(resource.path)) {
      isOmitted = true;
    }
  }
  return {
    value: resource,
    id: resource.toString(),
    name: basename(resource),
    isFile: !isDirectory,
    isDirectory,
    isOmitted
  };
}
async function getImageAttachContext(editor, fileService, dialogService) {
  if (!editor.resource) {
    return void 0;
  }
  if (/\.(png|jpg|jpeg|gif|webp)$/i.test(editor.resource.path)) {
    const fileName = basename(editor.resource);
    const readFile = await fileService.readFile(editor.resource);
    if (readFile.size > 30 * 1024 * 1024) {
      dialogService.error(localize("imageTooLarge", "Image is too large"), localize("imageTooLargeMessage", "The image {0} is too large to be attached.", fileName));
      throw new Error("Image is too large");
    }
    const resizedImage = await resizeImage(readFile.value.buffer);
    return {
      id: editor.resource.toString(),
      name: fileName,
      fullName: editor.resource.path,
      value: resizedImage,
      icon: Codicon.fileMedia,
      isImage: true,
      isFile: false,
      references: [{ reference: editor.resource, kind: "reference" }]
    };
  }
  return void 0;
}
function symbolId(resource, range) {
  let rangePart = "";
  if (range) {
    rangePart = `:${range.startLineNumber}`;
    if (range.startLineNumber !== range.endLineNumber) {
      rangePart += `-${range.endLineNumber}`;
    }
  }
  return resource.fsPath + rangePart;
}
export {
  ChatDragAndDrop
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdERyYWdBbmREcm9wLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGF0YVRyYW5zZmVycyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgJCwgRHJhZ0FuZERyb3BPYnNlcnZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgcmVuZGVyTGFiZWxXaXRoSWNvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaWNvbkxhYmVsL2ljb25MYWJlbHMuanMnO1xuaW1wb3J0IHsgY29hbGVzY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFVyaUxpc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kYXRhVHJhbnNmZXIuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTWltZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9taW1lLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU3ltYm9sS2luZHMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBDb2RlRGF0YVRyYW5zZmVycywgY29udGFpbnNEcmFnVHlwZSwgRG9jdW1lbnRTeW1ib2xUcmFuc2ZlckRhdGEsIGV4dHJhY3RFZGl0b3JzRHJvcERhdGEsIGV4dHJhY3RNYXJrZXJEcm9wRGF0YSwgZXh0cmFjdFN5bWJvbERyb3BEYXRhLCBJRHJhZ2dlZFJlc291cmNlRWRpdG9ySW5wdXQsIE1hcmtlclRyYW5zZmVyRGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RuZC9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBNYXJrZXJTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSwgVGhlbWFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTaGFyZWRXZWJDb250ZW50RXh0cmFjdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dlYkNvbnRlbnRFeHRyYWN0b3IvY29tbW9uL3dlYkNvbnRlbnRFeHRyYWN0b3IuanMnO1xuaW1wb3J0IHsgaXNVbnRpdGxlZFJlc291cmNlRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSwgaXNQcm9wb3NlZEFwaUVuYWJsZWQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFVudGl0bGVkVGV4dEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdW50aXRsZWQvY29tbW9uL3VudGl0bGVkVGV4dEVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnksIElEaWFnbm9zdGljVmFyaWFibGVFbnRyeSwgSURpYWdub3N0aWNWYXJpYWJsZUVudHJ5RmlsdGVyRGF0YSwgSVN5bWJvbFZhcmlhYmxlRW50cnkgfSBmcm9tICcuLi9jb21tb24vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IElDaGF0V2lkZ2V0U2VydmljZSB9IGZyb20gJy4vY2hhdC5qcyc7XG5pbXBvcnQgeyBDaGF0QXR0YWNobWVudE1vZGVsIH0gZnJvbSAnLi9jaGF0QXR0YWNobWVudE1vZGVsLmpzJztcbmltcG9ydCB7IElDaGF0SW5wdXRTdHlsZXMgfSBmcm9tICcuL2NoYXRJbnB1dFBhcnQuanMnO1xuaW1wb3J0IHsgaW1hZ2VUb0hhc2ggfSBmcm9tICcuL2NoYXRQYXN0ZVByb3ZpZGVycy5qcyc7XG5pbXBvcnQgeyByZXNpemVJbWFnZSB9IGZyb20gJy4vaW1hZ2VVdGlscy5qcyc7XG5cbmVudW0gQ2hhdERyYWdBbmREcm9wVHlwZSB7XG5cdEZJTEVfSU5URVJOQUwsXG5cdEZJTEVfRVhURVJOQUwsXG5cdEZPTERFUixcblx0SU1BR0UsXG5cdFNZTUJPTCxcblx0SFRNTCxcblx0TUFSS0VSLFxufVxuXG5leHBvcnQgY2xhc3MgQ2hhdERyYWdBbmREcm9wIGV4dGVuZHMgVGhlbWFibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgb3ZlcmxheXM6IE1hcDxIVE1MRWxlbWVudCwgeyBvdmVybGF5OiBIVE1MRWxlbWVudDsgZGlzcG9zYWJsZTogSURpc3Bvc2FibGUgfT4gPSBuZXcgTWFwKCk7XG5cdHByaXZhdGUgb3ZlcmxheVRleHQ/OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBvdmVybGF5VGV4dEJhY2tncm91bmQ6IHN0cmluZyA9ICcnO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgYXR0YWNobWVudE1vZGVsOiBDaGF0QXR0YWNobWVudE1vZGVsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgc3R5bGVzOiBJQ2hhdElucHV0U3R5bGVzLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0TW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASVNoYXJlZFdlYkNvbnRlbnRFeHRyYWN0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd2ViQ29udGVudEV4dHJhY3RvclNlcnZpY2U6IElTaGFyZWRXZWJDb250ZW50RXh0cmFjdG9yU2VydmljZSxcblx0XHRASUNoYXRXaWRnZXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdFdpZGdldFNlcnZpY2U6IElDaGF0V2lkZ2V0U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIodGhlbWVTZXJ2aWNlKTtcblxuXHRcdHRoaXMudXBkYXRlU3R5bGVzKCk7XG5cdH1cblxuXHRhZGRPdmVybGF5KHRhcmdldDogSFRNTEVsZW1lbnQsIG92ZXJsYXlDb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5yZW1vdmVPdmVybGF5KHRhcmdldCk7XG5cblx0XHRjb25zdCB7IG92ZXJsYXksIGRpc3Bvc2FibGUgfSA9IHRoaXMuY3JlYXRlT3ZlcmxheSh0YXJnZXQsIG92ZXJsYXlDb250YWluZXIpO1xuXHRcdHRoaXMub3ZlcmxheXMuc2V0KHRhcmdldCwgeyBvdmVybGF5LCBkaXNwb3NhYmxlIH0pO1xuXHR9XG5cblx0cmVtb3ZlT3ZlcmxheSh0YXJnZXQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY3VycmVudEFjdGl2ZVRhcmdldCA9PT0gdGFyZ2V0KSB7XG5cdFx0XHR0aGlzLmN1cnJlbnRBY3RpdmVUYXJnZXQgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXhpc3RpbmdPdmVybGF5ID0gdGhpcy5vdmVybGF5cy5nZXQodGFyZ2V0KTtcblx0XHRpZiAoZXhpc3RpbmdPdmVybGF5KSB7XG5cdFx0XHRleGlzdGluZ092ZXJsYXkub3ZlcmxheS5yZW1vdmUoKTtcblx0XHRcdGV4aXN0aW5nT3ZlcmxheS5kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMub3ZlcmxheXMuZGVsZXRlKHRhcmdldCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjdXJyZW50QWN0aXZlVGFyZ2V0OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjcmVhdGVPdmVybGF5KHRhcmdldDogSFRNTEVsZW1lbnQsIG92ZXJsYXlDb250YWluZXI6IEhUTUxFbGVtZW50KTogeyBvdmVybGF5OiBIVE1MRWxlbWVudDsgZGlzcG9zYWJsZTogSURpc3Bvc2FibGUgfSB7XG5cdFx0Y29uc3Qgb3ZlcmxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdG92ZXJsYXkuY2xhc3NMaXN0LmFkZCgnY2hhdC1kbmQtb3ZlcmxheScpO1xuXHRcdHRoaXMudXBkYXRlT3ZlcmxheVN0eWxlcyhvdmVybGF5KTtcblx0XHRvdmVybGF5Q29udGFpbmVyLmFwcGVuZENoaWxkKG92ZXJsYXkpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IG5ldyBEcmFnQW5kRHJvcE9ic2VydmVyKHRhcmdldCwge1xuXHRcdFx0b25EcmFnT3ZlcjogKGUpID0+IHtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHRcdGlmICh0YXJnZXQgPT09IHRoaXMuY3VycmVudEFjdGl2ZVRhcmdldCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aGlzLmN1cnJlbnRBY3RpdmVUYXJnZXQpIHtcblx0XHRcdFx0XHR0aGlzLnNldE92ZXJsYXkodGhpcy5jdXJyZW50QWN0aXZlVGFyZ2V0LCB1bmRlZmluZWQpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5jdXJyZW50QWN0aXZlVGFyZ2V0ID0gdGFyZ2V0O1xuXG5cdFx0XHRcdHRoaXMub25EcmFnRW50ZXIoZSwgdGFyZ2V0KTtcblxuXHRcdFx0fSxcblx0XHRcdG9uRHJhZ0xlYXZlOiAoZSkgPT4ge1xuXHRcdFx0XHRpZiAodGFyZ2V0ID09PSB0aGlzLmN1cnJlbnRBY3RpdmVUYXJnZXQpIHtcblx0XHRcdFx0XHR0aGlzLmN1cnJlbnRBY3RpdmVUYXJnZXQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLm9uRHJhZ0xlYXZlKGUsIHRhcmdldCk7XG5cdFx0XHR9LFxuXHRcdFx0b25Ecm9wOiAoZSkgPT4ge1xuXHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdFx0aWYgKHRhcmdldCAhPT0gdGhpcy5jdXJyZW50QWN0aXZlVGFyZ2V0KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5jdXJyZW50QWN0aXZlVGFyZ2V0ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLm9uRHJvcChlLCB0YXJnZXQpO1xuXHRcdFx0fSxcblx0XHR9KTtcblxuXHRcdHJldHVybiB7IG92ZXJsYXksIGRpc3Bvc2FibGUgfTtcblx0fVxuXG5cdHByaXZhdGUgb25EcmFnRW50ZXIoZTogRHJhZ0V2ZW50LCB0YXJnZXQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgZXN0aW1hdGVkRHJvcFR5cGUgPSB0aGlzLmd1ZXNzRHJvcFR5cGUoZSk7XG5cdFx0dGhpcy51cGRhdGVEcm9wRmVlZGJhY2soZSwgdGFyZ2V0LCBlc3RpbWF0ZWREcm9wVHlwZSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRHJhZ0xlYXZlKGU6IERyYWdFdmVudCwgdGFyZ2V0OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMudXBkYXRlRHJvcEZlZWRiYWNrKGUsIHRhcmdldCwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdHByaXZhdGUgb25Ecm9wKGU6IERyYWdFdmVudCwgdGFyZ2V0OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMudXBkYXRlRHJvcEZlZWRiYWNrKGUsIHRhcmdldCwgdW5kZWZpbmVkKTtcblx0XHR0aGlzLmRyb3AoZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRyb3AoZTogRHJhZ0V2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29udGV4dHMgPSBhd2FpdCB0aGlzLmdldEF0dGFjaENvbnRleHQoZSk7XG5cdFx0aWYgKGNvbnRleHRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuYXR0YWNobWVudE1vZGVsLmFkZENvbnRleHQoLi4uY29udGV4dHMpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVEcm9wRmVlZGJhY2soZTogRHJhZ0V2ZW50LCB0YXJnZXQ6IEhUTUxFbGVtZW50LCBkcm9wVHlwZTogQ2hhdERyYWdBbmREcm9wVHlwZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IHNob3dPdmVybGF5ID0gZHJvcFR5cGUgIT09IHVuZGVmaW5lZDtcblx0XHRpZiAoZS5kYXRhVHJhbnNmZXIpIHtcblx0XHRcdGUuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSBzaG93T3ZlcmxheSA/ICdjb3B5JyA6ICdub25lJztcblx0XHR9XG5cblx0XHR0aGlzLnNldE92ZXJsYXkodGFyZ2V0LCBkcm9wVHlwZSk7XG5cdH1cblxuXHRwcml2YXRlIGd1ZXNzRHJvcFR5cGUoZTogRHJhZ0V2ZW50KTogQ2hhdERyYWdBbmREcm9wVHlwZSB8IHVuZGVmaW5lZCB7XG5cdFx0Ly8gVGhpcyBpcyBhbiBlc3N0aW1hdGlvbiBiYXNlZCBvbiB0aGUgZGF0YXRyYW5zZmVyIHR5cGVzL2l0ZW1zXG5cdFx0aWYgKHRoaXMuaXNJbWFnZURuZChlKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uU2VydmljZS5leHRlbnNpb25zLnNvbWUoZXh0ID0+IGlzUHJvcG9zZWRBcGlFbmFibGVkKGV4dCwgJ2NoYXRSZWZlcmVuY2VCaW5hcnlEYXRhJykpID8gQ2hhdERyYWdBbmREcm9wVHlwZS5JTUFHRSA6IHVuZGVmaW5lZDtcblx0XHR9IGVsc2UgaWYgKGNvbnRhaW5zRHJhZ1R5cGUoZSwgJ3RleHQvaHRtbCcpKSB7XG5cdFx0XHRyZXR1cm4gQ2hhdERyYWdBbmREcm9wVHlwZS5IVE1MO1xuXHRcdH0gZWxzZSBpZiAoY29udGFpbnNEcmFnVHlwZShlLCBDb2RlRGF0YVRyYW5zZmVycy5TWU1CT0xTKSkge1xuXHRcdFx0cmV0dXJuIENoYXREcmFnQW5kRHJvcFR5cGUuU1lNQk9MO1xuXHRcdH0gZWxzZSBpZiAoY29udGFpbnNEcmFnVHlwZShlLCBDb2RlRGF0YVRyYW5zZmVycy5NQVJLRVJTKSkge1xuXHRcdFx0cmV0dXJuIENoYXREcmFnQW5kRHJvcFR5cGUuTUFSS0VSO1xuXHRcdH0gZWxzZSBpZiAoY29udGFpbnNEcmFnVHlwZShlLCBEYXRhVHJhbnNmZXJzLkZJTEVTKSkge1xuXHRcdFx0cmV0dXJuIENoYXREcmFnQW5kRHJvcFR5cGUuRklMRV9FWFRFUk5BTDtcblx0XHR9IGVsc2UgaWYgKGNvbnRhaW5zRHJhZ1R5cGUoZSwgRGF0YVRyYW5zZmVycy5JTlRFUk5BTF9VUklfTElTVCkpIHtcblx0XHRcdHJldHVybiBDaGF0RHJhZ0FuZERyb3BUeXBlLkZJTEVfSU5URVJOQUw7XG5cdFx0fSBlbHNlIGlmIChjb250YWluc0RyYWdUeXBlKGUsIE1pbWVzLnVyaUxpc3QsIENvZGVEYXRhVHJhbnNmZXJzLkZJTEVTLCBEYXRhVHJhbnNmZXJzLlJFU09VUkNFUykpIHtcblx0XHRcdHJldHVybiBDaGF0RHJhZ0FuZERyb3BUeXBlLkZPTERFUjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBpc0RyYWdFdmVudFN1cHBvcnRlZChlOiBEcmFnRXZlbnQpOiBib29sZWFuIHtcblx0XHQvLyBpZiBndWVzc2VkIGRyb3AgdHlwZSBpcyB1bmRlZmluZWQsIGl0IG1lYW5zIHRoZSBkcm9wIGlzIG5vdCBzdXBwb3J0ZWRcblx0XHRjb25zdCBkcm9wVHlwZSA9IHRoaXMuZ3Vlc3NEcm9wVHlwZShlKTtcblx0XHRyZXR1cm4gZHJvcFR5cGUgIT09IHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RHJvcFR5cGVOYW1lKHR5cGU6IENoYXREcmFnQW5kRHJvcFR5cGUpOiBzdHJpbmcge1xuXHRcdHN3aXRjaCAodHlwZSkge1xuXHRcdFx0Y2FzZSBDaGF0RHJhZ0FuZERyb3BUeXBlLkZJTEVfSU5URVJOQUw6IHJldHVybiBsb2NhbGl6ZSgnZmlsZScsICdGaWxlJyk7XG5cdFx0XHRjYXNlIENoYXREcmFnQW5kRHJvcFR5cGUuRklMRV9FWFRFUk5BTDogcmV0dXJuIGxvY2FsaXplKCdmaWxlJywgJ0ZpbGUnKTtcblx0XHRcdGNhc2UgQ2hhdERyYWdBbmREcm9wVHlwZS5GT0xERVI6IHJldHVybiBsb2NhbGl6ZSgnZm9sZGVyJywgJ0ZvbGRlcicpO1xuXHRcdFx0Y2FzZSBDaGF0RHJhZ0FuZERyb3BUeXBlLklNQUdFOiByZXR1cm4gbG9jYWxpemUoJ2ltYWdlJywgJ0ltYWdlJyk7XG5cdFx0XHRjYXNlIENoYXREcmFnQW5kRHJvcFR5cGUuU1lNQk9MOiByZXR1cm4gbG9jYWxpemUoJ3N5bWJvbCcsICdTeW1ib2wnKTtcblx0XHRcdGNhc2UgQ2hhdERyYWdBbmREcm9wVHlwZS5NQVJLRVI6IHJldHVybiBsb2NhbGl6ZSgncHJvYmxlbScsICdQcm9ibGVtJyk7XG5cdFx0XHRjYXNlIENoYXREcmFnQW5kRHJvcFR5cGUuSFRNTDogcmV0dXJuIGxvY2FsaXplKCd1cmwnLCAnVVJMJyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBpc0ltYWdlRG5kKGU6IERyYWdFdmVudCk6IGJvb2xlYW4ge1xuXHRcdC8vIEltYWdlIGRldGVjdGlvbiBzaG91bGQgbm90IGhhdmUgZmFsc2UgcG9zaXRpdmVzLCBvbmx5IGZhbHNlIG5lZ2F0aXZlcyBhcmUgYWxsb3dlZFxuXHRcdGlmIChjb250YWluc0RyYWdUeXBlKGUsICdpbWFnZScpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAoY29udGFpbnNEcmFnVHlwZShlLCBEYXRhVHJhbnNmZXJzLkZJTEVTKSkge1xuXHRcdFx0Y29uc3QgZmlsZXMgPSBlLmRhdGFUcmFuc2Zlcj8uZmlsZXM7XG5cdFx0XHRpZiAoZmlsZXMgJiYgZmlsZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRjb25zdCBmaWxlID0gZmlsZXNbMF07XG5cdFx0XHRcdHJldHVybiBmaWxlLnR5cGUuc3RhcnRzV2l0aCgnaW1hZ2UvJyk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGl0ZW1zID0gZS5kYXRhVHJhbnNmZXI/Lml0ZW1zO1xuXHRcdFx0aWYgKGl0ZW1zICYmIGl0ZW1zLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Y29uc3QgaXRlbSA9IGl0ZW1zWzBdO1xuXHRcdFx0XHRyZXR1cm4gaXRlbS50eXBlLnN0YXJ0c1dpdGgoJ2ltYWdlLycpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0QXR0YWNoQ29udGV4dChlOiBEcmFnRXZlbnQpOiBQcm9taXNlPElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnlbXT4ge1xuXHRcdGlmICghdGhpcy5pc0RyYWdFdmVudFN1cHBvcnRlZChlKSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1hcmtlckRhdGEgPSBleHRyYWN0TWFya2VyRHJvcERhdGEoZSk7XG5cdFx0aWYgKG1hcmtlckRhdGEpIHtcblx0XHRcdHJldHVybiB0aGlzLnJlc29sdmVNYXJrZXJBdHRhY2hDb250ZXh0KG1hcmtlckRhdGEpO1xuXHRcdH1cblxuXHRcdGlmIChjb250YWluc0RyYWdUeXBlKGUsIENvZGVEYXRhVHJhbnNmZXJzLlNZTUJPTFMpKSB7XG5cdFx0XHRjb25zdCBkYXRhID0gZXh0cmFjdFN5bWJvbERyb3BEYXRhKGUpO1xuXHRcdFx0cmV0dXJuIHRoaXMucmVzb2x2ZVN5bWJvbHNBdHRhY2hDb250ZXh0KGRhdGEpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRvckRyYWdEYXRhID0gZXh0cmFjdEVkaXRvcnNEcm9wRGF0YShlKTtcblx0XHRpZiAoZWRpdG9yRHJhZ0RhdGEubGVuZ3RoID09PSAwICYmICFjb250YWluc0RyYWdUeXBlKGUsIERhdGFUcmFuc2ZlcnMuSU5URVJOQUxfVVJJX0xJU1QpICYmIGNvbnRhaW5zRHJhZ1R5cGUoZSwgTWltZXMudXJpTGlzdCkgJiYgKChjb250YWluc0RyYWdUeXBlKGUsIE1pbWVzLmh0bWwpIHx8IGNvbnRhaW5zRHJhZ1R5cGUoZSwgTWltZXMudGV4dCkpKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMucmVzb2x2ZUhUTUxBdHRhY2hDb250ZXh0KGUpO1xuXHRcdH1cblxuXHRcdHJldHVybiBjb2FsZXNjZShhd2FpdCBQcm9taXNlLmFsbChlZGl0b3JEcmFnRGF0YS5tYXAoZWRpdG9ySW5wdXQgPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMucmVzb2x2ZUF0dGFjaENvbnRleHQoZWRpdG9ySW5wdXQpO1xuXHRcdH0pKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlc29sdmVBdHRhY2hDb250ZXh0KGVkaXRvcklucHV0OiBJRHJhZ2dlZFJlc291cmNlRWRpdG9ySW5wdXQpOiBQcm9taXNlPElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnkgfCB1bmRlZmluZWQ+IHtcblx0XHQvLyBJbWFnZVxuXHRcdGNvbnN0IGltYWdlQ29udGV4dCA9IGF3YWl0IGdldEltYWdlQXR0YWNoQ29udGV4dChlZGl0b3JJbnB1dCwgdGhpcy5maWxlU2VydmljZSwgdGhpcy5kaWFsb2dTZXJ2aWNlKTtcblx0XHRpZiAoaW1hZ2VDb250ZXh0KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25TZXJ2aWNlLmV4dGVuc2lvbnMuc29tZShleHQgPT4gaXNQcm9wb3NlZEFwaUVuYWJsZWQoZXh0LCAnY2hhdFJlZmVyZW5jZUJpbmFyeURhdGEnKSkgPyBpbWFnZUNvbnRleHQgOiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gRmlsZVxuXHRcdHJldHVybiBhd2FpdCB0aGlzLmdldEVkaXRvckF0dGFjaENvbnRleHQoZWRpdG9ySW5wdXQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRFZGl0b3JBdHRhY2hDb250ZXh0KGVkaXRvcjogRWRpdG9ySW5wdXQgfCBJRHJhZ2dlZFJlc291cmNlRWRpdG9ySW5wdXQpOiBQcm9taXNlPElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnkgfCB1bmRlZmluZWQ+IHtcblxuXHRcdC8vIHVudGl0bGVkIGVkaXRvclxuXHRcdGlmIChpc1VudGl0bGVkUmVzb3VyY2VFZGl0b3JJbnB1dChlZGl0b3IpKSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5yZXNvbHZlVW50aXRsZWRBdHRhY2hDb250ZXh0KGVkaXRvcik7XG5cdFx0fVxuXG5cdFx0aWYgKCFlZGl0b3IucmVzb3VyY2UpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0bGV0IHN0YXQ7XG5cdFx0dHJ5IHtcblx0XHRcdHN0YXQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnN0YXQoZWRpdG9yLnJlc291cmNlKTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKCFzdGF0LmlzRGlyZWN0b3J5ICYmICFzdGF0LmlzRmlsZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXdhaXQgZ2V0UmVzb3VyY2VBdHRhY2hDb250ZXh0KGVkaXRvci5yZXNvdXJjZSwgc3RhdC5pc0RpcmVjdG9yeSwgdGhpcy50ZXh0TW9kZWxTZXJ2aWNlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZVVudGl0bGVkQXR0YWNoQ29udGV4dChlZGl0b3I6IElEcmFnZ2VkUmVzb3VyY2VFZGl0b3JJbnB1dCk6IFByb21pc2U8SUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSB8IHVuZGVmaW5lZD4ge1xuXHRcdC8vIElmIHRoZSByZXNvdXJjZSBpcyBrbm93biwgd2UgY2FuIHVzZSBpdCBkaXJlY3RseVxuXHRcdGlmIChlZGl0b3IucmVzb3VyY2UpIHtcblx0XHRcdHJldHVybiBhd2FpdCBnZXRSZXNvdXJjZUF0dGFjaENvbnRleHQoZWRpdG9yLnJlc291cmNlLCBmYWxzZSwgdGhpcy50ZXh0TW9kZWxTZXJ2aWNlKTtcblx0XHR9XG5cblx0XHQvLyBPdGhlcndpc2UsIHdlIG5lZWQgdG8gY2hlY2sgaWYgdGhlIGNvbnRlbnRzIGFyZSBhbHJlYWR5IG9wZW4gaW4gYW5vdGhlciBlZGl0b3Jcblx0XHRjb25zdCBvcGVuVW50aXRsZWRFZGl0b3JzID0gdGhpcy5lZGl0b3JTZXJ2aWNlLmVkaXRvcnMuZmlsdGVyKGVkaXRvciA9PiBlZGl0b3IgaW5zdGFuY2VvZiBVbnRpdGxlZFRleHRFZGl0b3JJbnB1dCkgYXMgVW50aXRsZWRUZXh0RWRpdG9ySW5wdXRbXTtcblx0XHRmb3IgKGNvbnN0IGNhbmlkYXRlIG9mIG9wZW5VbnRpdGxlZEVkaXRvcnMpIHtcblx0XHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgY2FuaWRhdGUucmVzb2x2ZSgpO1xuXHRcdFx0Y29uc3QgY29udGVudHMgPSBtb2RlbC50ZXh0RWRpdG9yTW9kZWw/LmdldFZhbHVlKCk7XG5cdFx0XHRpZiAoY29udGVudHMgPT09IGVkaXRvci5jb250ZW50cykge1xuXHRcdFx0XHRyZXR1cm4gYXdhaXQgZ2V0UmVzb3VyY2VBdHRhY2hDb250ZXh0KGNhbmlkYXRlLnJlc291cmNlLCBmYWxzZSwgdGhpcy50ZXh0TW9kZWxTZXJ2aWNlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlU3ltYm9sc0F0dGFjaENvbnRleHQoc3ltYm9sczogRG9jdW1lbnRTeW1ib2xUcmFuc2ZlckRhdGFbXSk6IElTeW1ib2xWYXJpYWJsZUVudHJ5W10ge1xuXHRcdHJldHVybiBzeW1ib2xzLm1hcChzeW1ib2wgPT4ge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZShzeW1ib2wuZnNQYXRoKTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGtpbmQ6ICdzeW1ib2wnLFxuXHRcdFx0XHRpZDogc3ltYm9sSWQocmVzb3VyY2UsIHN5bWJvbC5yYW5nZSksXG5cdFx0XHRcdHZhbHVlOiB7IHVyaTogcmVzb3VyY2UsIHJhbmdlOiBzeW1ib2wucmFuZ2UgfSxcblx0XHRcdFx0c3ltYm9sS2luZDogc3ltYm9sLmtpbmQsXG5cdFx0XHRcdGZ1bGxOYW1lOiBgJCgke1N5bWJvbEtpbmRzLnRvSWNvbihzeW1ib2wua2luZCkuaWR9KSAke3N5bWJvbC5uYW1lfWAsXG5cdFx0XHRcdG5hbWU6IHN5bWJvbC5uYW1lLFxuXHRcdFx0fTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG93bmxvYWRJbWFnZUFzVWludDhBcnJheSh1cmw6IHN0cmluZyk6IFByb21pc2U8VWludDhBcnJheSB8IHVuZGVmaW5lZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBleHRyYWN0ZWRJbWFnZXMgPSBhd2FpdCB0aGlzLndlYkNvbnRlbnRFeHRyYWN0b3JTZXJ2aWNlLnJlYWRJbWFnZShVUkkucGFyc2UodXJsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRpZiAoZXh0cmFjdGVkSW1hZ2VzKSB7XG5cdFx0XHRcdHJldHVybiBleHRyYWN0ZWRJbWFnZXMuYnVmZmVyO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybignRmV0Y2ggZmFpbGVkOicsIGVycm9yKTtcblx0XHR9XG5cblx0XHQvLyBUT0RPOiB1c2UgZG5kIHByb3ZpZGVyIHRvIGluc2VydCB0ZXh0IEBqdXN0c2NoZW5cblx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLmNoYXRXaWRnZXRTZXJ2aWNlLmxhc3RGb2N1c2VkV2lkZ2V0Py5pbnB1dEVkaXRvci5nZXRTZWxlY3Rpb24oKTtcblx0XHRpZiAoc2VsZWN0aW9uICYmIHRoaXMuY2hhdFdpZGdldFNlcnZpY2UubGFzdEZvY3VzZWRXaWRnZXQpIHtcblx0XHRcdHRoaXMuY2hhdFdpZGdldFNlcnZpY2UubGFzdEZvY3VzZWRXaWRnZXQuaW5wdXRFZGl0b3IuZXhlY3V0ZUVkaXRzKCdjaGF0SW5zZXJ0VXJsJywgW3sgcmFuZ2U6IHNlbGVjdGlvbiwgdGV4dDogdXJsIH1dKTtcblx0XHR9XG5cblx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybihgSW1hZ2UgVVJMcyBtdXN0IGVuZCBpbiAuanBnLCAucG5nLCAuZ2lmLCAud2VicCwgb3IgLmJtcC4gRmFpbGVkIHRvIGZldGNoIGltYWdlIGZyb20gdGhpcyBVUkw6ICR7dXJsfWApO1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlc29sdmVIVE1MQXR0YWNoQ29udGV4dChlOiBEcmFnRXZlbnQpOiBQcm9taXNlPElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnlbXT4ge1xuXHRcdGNvbnN0IGRpc3BsYXlOYW1lID0gbG9jYWxpemUoJ2RyYWdBbmREcm9wcGVkSW1hZ2VOYW1lJywgJ0ltYWdlIGZyb20gVVJMJyk7XG5cdFx0bGV0IGZpbmFsRGlzcGxheU5hbWUgPSBkaXNwbGF5TmFtZTtcblxuXHRcdGZvciAobGV0IGFwcGVuZFZhbHVlID0gMjsgdGhpcy5hdHRhY2htZW50TW9kZWwuYXR0YWNobWVudHMuc29tZShhdHRhY2htZW50ID0+IGF0dGFjaG1lbnQubmFtZSA9PT0gZmluYWxEaXNwbGF5TmFtZSk7IGFwcGVuZFZhbHVlKyspIHtcblx0XHRcdGZpbmFsRGlzcGxheU5hbWUgPSBgJHtkaXNwbGF5TmFtZX0gJHthcHBlbmRWYWx1ZX1gO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRhdGFGcm9tRmlsZSA9IGF3YWl0IHRoaXMuZXh0cmFjdEltYWdlRnJvbUZpbGUoZSk7XG5cdFx0aWYgKGRhdGFGcm9tRmlsZSkge1xuXHRcdFx0cmV0dXJuIFthd2FpdCB0aGlzLmNyZWF0ZUltYWdlVmFyaWFibGUoYXdhaXQgcmVzaXplSW1hZ2UoZGF0YUZyb21GaWxlKSwgZmluYWxEaXNwbGF5TmFtZSldO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRhdGFGcm9tVXJsID0gYXdhaXQgdGhpcy5leHRyYWN0SW1hZ2VGcm9tVXJsKGUpO1xuXHRcdGNvbnN0IHZhcmlhYmxlRW50cmllczogSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeVtdID0gW107XG5cdFx0aWYgKGRhdGFGcm9tVXJsKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHVybCBvZiBkYXRhRnJvbVVybCkge1xuXHRcdFx0XHRpZiAoL15kYXRhOmltYWdlXFwvW2Etel0rO2Jhc2U2NCwvLnRlc3QodXJsKSkge1xuXHRcdFx0XHRcdHZhcmlhYmxlRW50cmllcy5wdXNoKGF3YWl0IHRoaXMuY3JlYXRlSW1hZ2VWYXJpYWJsZShhd2FpdCByZXNpemVJbWFnZSh1cmwpLCBmaW5hbERpc3BsYXlOYW1lLCBVUkkucGFyc2UodXJsKSkpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKC9eaHR0cHM/OlxcL1xcLy4rLy50ZXN0KHVybCkpIHtcblx0XHRcdFx0XHRjb25zdCBpbWFnZURhdGEgPSBhd2FpdCB0aGlzLmRvd25sb2FkSW1hZ2VBc1VpbnQ4QXJyYXkodXJsKTtcblx0XHRcdFx0XHRpZiAoaW1hZ2VEYXRhKSB7XG5cdFx0XHRcdFx0XHR2YXJpYWJsZUVudHJpZXMucHVzaChhd2FpdCB0aGlzLmNyZWF0ZUltYWdlVmFyaWFibGUoYXdhaXQgcmVzaXplSW1hZ2UoaW1hZ2VEYXRhKSwgZmluYWxEaXNwbGF5TmFtZSwgVVJJLnBhcnNlKHVybCksIHVybCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB2YXJpYWJsZUVudHJpZXM7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNyZWF0ZUltYWdlVmFyaWFibGUoZGF0YTogVWludDhBcnJheSwgbmFtZTogc3RyaW5nLCB1cmk/OiBVUkksIGlkPzogc3RyaW5nLCk6IFByb21pc2U8SUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeT4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRpZDogaWQgfHwgYXdhaXQgaW1hZ2VUb0hhc2goZGF0YSksXG5cdFx0XHRuYW1lOiBuYW1lLFxuXHRcdFx0dmFsdWU6IGRhdGEsXG5cdFx0XHRpc0ltYWdlOiB0cnVlLFxuXHRcdFx0aXNGaWxlOiBmYWxzZSxcblx0XHRcdGlzRGlyZWN0b3J5OiBmYWxzZSxcblx0XHRcdHJlZmVyZW5jZXM6IHVyaSA/IFt7IHJlZmVyZW5jZTogdXJpLCBraW5kOiAncmVmZXJlbmNlJyB9XSA6IFtdXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgcmVzb2x2ZU1hcmtlckF0dGFjaENvbnRleHQobWFya2VyczogTWFya2VyVHJhbnNmZXJEYXRhW10pOiBJRGlhZ25vc3RpY1ZhcmlhYmxlRW50cnlbXSB7XG5cdFx0cmV0dXJuIG1hcmtlcnMubWFwKChtYXJrZXIpOiBJRGlhZ25vc3RpY1ZhcmlhYmxlRW50cnkgPT4ge1xuXHRcdFx0bGV0IGZpbHRlcjogSURpYWdub3N0aWNWYXJpYWJsZUVudHJ5RmlsdGVyRGF0YTtcblx0XHRcdGlmICghKCdzZXZlcml0eScgaW4gbWFya2VyKSkge1xuXHRcdFx0XHRmaWx0ZXIgPSB7IGZpbHRlclVyaTogVVJJLnJldml2ZShtYXJrZXIudXJpKSwgZmlsdGVyU2V2ZXJpdHk6IE1hcmtlclNldmVyaXR5Lldhcm5pbmcgfTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZpbHRlciA9IElEaWFnbm9zdGljVmFyaWFibGVFbnRyeUZpbHRlckRhdGEuZnJvbU1hcmtlcihtYXJrZXIpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gSURpYWdub3N0aWNWYXJpYWJsZUVudHJ5RmlsdGVyRGF0YS50b0VudHJ5KGZpbHRlcik7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHNldE92ZXJsYXkodGFyZ2V0OiBIVE1MRWxlbWVudCwgdHlwZTogQ2hhdERyYWdBbmREcm9wVHlwZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdC8vIFJlbW92ZSBhbnkgcHJldmlvdXMgb3ZlcmxheSB0ZXh0XG5cdFx0dGhpcy5vdmVybGF5VGV4dD8ucmVtb3ZlKCk7XG5cdFx0dGhpcy5vdmVybGF5VGV4dCA9IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IHsgb3ZlcmxheSB9ID0gdGhpcy5vdmVybGF5cy5nZXQodGFyZ2V0KSE7XG5cdFx0aWYgKHR5cGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Ly8gUmVuZGVyIHRoZSBvdmVybGF5IHRleHRcblxuXHRcdFx0Y29uc3QgaWNvbkFuZHRleHRFbGVtZW50cyA9IHJlbmRlckxhYmVsV2l0aEljb25zKGAkKCR7Q29kaWNvbi5hdHRhY2guaWR9KSAke3RoaXMuZ2V0T3ZlcmxheVRleHQodHlwZSl9YCk7XG5cdFx0XHRjb25zdCBodG1sRWxlbWVudHMgPSBpY29uQW5kdGV4dEVsZW1lbnRzLm1hcChlbGVtZW50ID0+IHtcblx0XHRcdFx0aWYgKHR5cGVvZiBlbGVtZW50ID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdHJldHVybiAkKCdzcGFuLm92ZXJsYXktdGV4dCcsIHVuZGVmaW5lZCwgZWxlbWVudCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGVsZW1lbnQ7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5vdmVybGF5VGV4dCA9ICQoJ3NwYW4uYXR0YWNoLWNvbnRleHQtb3ZlcmxheS10ZXh0JywgdW5kZWZpbmVkLCAuLi5odG1sRWxlbWVudHMpO1xuXHRcdFx0dGhpcy5vdmVybGF5VGV4dC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSB0aGlzLm92ZXJsYXlUZXh0QmFja2dyb3VuZDtcblx0XHRcdG92ZXJsYXkuYXBwZW5kQ2hpbGQodGhpcy5vdmVybGF5VGV4dCk7XG5cdFx0fVxuXG5cdFx0b3ZlcmxheS5jbGFzc0xpc3QudG9nZ2xlKCd2aXNpYmxlJywgdHlwZSAhPT0gdW5kZWZpbmVkKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0T3ZlcmxheVRleHQodHlwZTogQ2hhdERyYWdBbmREcm9wVHlwZSk6IHN0cmluZyB7XG5cdFx0Y29uc3QgdHlwZU5hbWUgPSB0aGlzLmdldERyb3BUeXBlTmFtZSh0eXBlKTtcblx0XHRyZXR1cm4gbG9jYWxpemUoJ2F0dGFjQXNDb250ZXh0JywgJ0F0dGFjaCB7MH0gYXMgQ29udGV4dCcsIHR5cGVOYW1lKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlT3ZlcmxheVN0eWxlcyhvdmVybGF5OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdG92ZXJsYXkuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gdGhpcy5nZXRDb2xvcih0aGlzLnN0eWxlcy5vdmVybGF5QmFja2dyb3VuZCkgfHwgJyc7XG5cdFx0b3ZlcmxheS5zdHlsZS5jb2xvciA9IHRoaXMuZ2V0Q29sb3IodGhpcy5zdHlsZXMubGlzdEZvcmVncm91bmQpIHx8ICcnO1xuXHR9XG5cblx0b3ZlcnJpZGUgdXBkYXRlU3R5bGVzKCk6IHZvaWQge1xuXHRcdHRoaXMub3ZlcmxheXMuZm9yRWFjaChvdmVybGF5ID0+IHRoaXMudXBkYXRlT3ZlcmxheVN0eWxlcyhvdmVybGF5Lm92ZXJsYXkpKTtcblx0XHR0aGlzLm92ZXJsYXlUZXh0QmFja2dyb3VuZCA9IHRoaXMuZ2V0Q29sb3IodGhpcy5zdHlsZXMubGlzdEJhY2tncm91bmQpIHx8ICcnO1xuXHR9XG5cblxuXG5cdHByaXZhdGUgYXN5bmMgZXh0cmFjdEltYWdlRnJvbUZpbGUoZTogRHJhZ0V2ZW50KTogUHJvbWlzZTxVaW50OEFycmF5IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZmlsZXMgPSBlLmRhdGFUcmFuc2Zlcj8uZmlsZXM7XG5cdFx0aWYgKGZpbGVzICYmIGZpbGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdGNvbnN0IGZpbGUgPSBmaWxlc1swXTtcblx0XHRcdGlmIChmaWxlLnR5cGUuc3RhcnRzV2l0aCgnaW1hZ2UvJykpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBidWZmZXIgPSBhd2FpdCBmaWxlLmFycmF5QnVmZmVyKCk7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBVaW50OEFycmF5KGJ1ZmZlcik7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKCdFcnJvciByZWFkaW5nIGZpbGU6JywgZXJyb3IpO1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBleHRyYWN0SW1hZ2VGcm9tVXJsKGU6IERyYWdFdmVudCk6IFByb21pc2U8c3RyaW5nW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCB0ZXh0VXJsID0gZS5kYXRhVHJhbnNmZXI/LmdldERhdGEoJ3RleHQvdXJpLWxpc3QnKTtcblx0XHRpZiAodGV4dFVybCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgdXJpcyA9IFVyaUxpc3QucGFyc2UodGV4dFVybCk7XG5cdFx0XHRcdGlmICh1cmlzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRyZXR1cm4gdXJpcztcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKCdFcnJvciBwYXJzaW5nIFVSSSBsaXN0OicsIGVycm9yKTtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRSZXNvdXJjZUF0dGFjaENvbnRleHQocmVzb3VyY2U6IFVSSSwgaXNEaXJlY3Rvcnk6IGJvb2xlYW4sIHRleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlKTogUHJvbWlzZTxJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5IHwgdW5kZWZpbmVkPiB7XG5cdGxldCBpc09taXR0ZWQgPSBmYWxzZTtcblxuXHRpZiAoIWlzRGlyZWN0b3J5KSB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGNyZWF0ZWRNb2RlbCA9IGF3YWl0IHRleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UocmVzb3VyY2UpO1xuXHRcdFx0Y3JlYXRlZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdGlzT21pdHRlZCA9IHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKC9cXC4oc3ZnKSQvaS50ZXN0KHJlc291cmNlLnBhdGgpKSB7XG5cdFx0XHRpc09taXR0ZWQgPSB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB7XG5cdFx0dmFsdWU6IHJlc291cmNlLFxuXHRcdGlkOiByZXNvdXJjZS50b1N0cmluZygpLFxuXHRcdG5hbWU6IGJhc2VuYW1lKHJlc291cmNlKSxcblx0XHRpc0ZpbGU6ICFpc0RpcmVjdG9yeSxcblx0XHRpc0RpcmVjdG9yeSxcblx0XHRpc09taXR0ZWRcblx0fTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0SW1hZ2VBdHRhY2hDb250ZXh0KGVkaXRvcjogRWRpdG9ySW5wdXQgfCBJRHJhZ2dlZFJlc291cmNlRWRpdG9ySW5wdXQsIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsIGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlKTogUHJvbWlzZTxJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5IHwgdW5kZWZpbmVkPiB7XG5cdGlmICghZWRpdG9yLnJlc291cmNlKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGlmICgvXFwuKHBuZ3xqcGd8anBlZ3xnaWZ8d2VicCkkL2kudGVzdChlZGl0b3IucmVzb3VyY2UucGF0aCkpIHtcblx0XHRjb25zdCBmaWxlTmFtZSA9IGJhc2VuYW1lKGVkaXRvci5yZXNvdXJjZSk7XG5cdFx0Y29uc3QgcmVhZEZpbGUgPSBhd2FpdCBmaWxlU2VydmljZS5yZWFkRmlsZShlZGl0b3IucmVzb3VyY2UpO1xuXHRcdGlmIChyZWFkRmlsZS5zaXplID4gMzAgKiAxMDI0ICogMTAyNCkgeyAvLyAzMCBNQlxuXHRcdFx0ZGlhbG9nU2VydmljZS5lcnJvcihsb2NhbGl6ZSgnaW1hZ2VUb29MYXJnZScsICdJbWFnZSBpcyB0b28gbGFyZ2UnKSwgbG9jYWxpemUoJ2ltYWdlVG9vTGFyZ2VNZXNzYWdlJywgJ1RoZSBpbWFnZSB7MH0gaXMgdG9vIGxhcmdlIHRvIGJlIGF0dGFjaGVkLicsIGZpbGVOYW1lKSk7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ltYWdlIGlzIHRvbyBsYXJnZScpO1xuXHRcdH1cblx0XHRjb25zdCByZXNpemVkSW1hZ2UgPSBhd2FpdCByZXNpemVJbWFnZShyZWFkRmlsZS52YWx1ZS5idWZmZXIpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRpZDogZWRpdG9yLnJlc291cmNlLnRvU3RyaW5nKCksXG5cdFx0XHRuYW1lOiBmaWxlTmFtZSxcblx0XHRcdGZ1bGxOYW1lOiBlZGl0b3IucmVzb3VyY2UucGF0aCxcblx0XHRcdHZhbHVlOiByZXNpemVkSW1hZ2UsXG5cdFx0XHRpY29uOiBDb2RpY29uLmZpbGVNZWRpYSxcblx0XHRcdGlzSW1hZ2U6IHRydWUsXG5cdFx0XHRpc0ZpbGU6IGZhbHNlLFxuXHRcdFx0cmVmZXJlbmNlczogW3sgcmVmZXJlbmNlOiBlZGl0b3IucmVzb3VyY2UsIGtpbmQ6ICdyZWZlcmVuY2UnIH1dXG5cdFx0fTtcblx0fVxuXG5cdHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIHN5bWJvbElkKHJlc291cmNlOiBVUkksIHJhbmdlPzogSVJhbmdlKTogc3RyaW5nIHtcblx0bGV0IHJhbmdlUGFydCA9ICcnO1xuXHRpZiAocmFuZ2UpIHtcblx0XHRyYW5nZVBhcnQgPSBgOiR7cmFuZ2Uuc3RhcnRMaW5lTnVtYmVyfWA7XG5cdFx0aWYgKHJhbmdlLnN0YXJ0TGluZU51bWJlciAhPT0gcmFuZ2UuZW5kTGluZU51bWJlcikge1xuXHRcdFx0cmFuZ2VQYXJ0ICs9IGAtJHtyYW5nZS5lbmRMaW5lTnVtYmVyfWA7XG5cdFx0fVxuXHR9XG5cdHJldHVybiByZXNvdXJjZS5mc1BhdGggKyByYW5nZVBhcnQ7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsR0FBRywyQkFBMkI7QUFDdkMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUV4QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxXQUFXO0FBRXBCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsbUJBQW1CLGtCQUE4Qyx3QkFBd0IsdUJBQXVCLDZCQUE4RTtBQUN2TSxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQjtBQUM1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bUJBQWEsUUFBUTtBQUFBLElBQ3RCLFFBQVE7QUFDUCxrQkFBWTtBQUFBLElBQ2I7QUFFQSxRQUFJLFlBQVksS0FBSyxTQUFTLElBQUksR0FBRztBQUNwQyxrQkFBWTtBQUFBLElBQ2I7QUFBQSxFQUNEO0FBRUEsU0FBTztBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsSUFBSSxTQUFTLFNBQVM7QUFBQSxJQUN0QixNQUFNLFNBQVMsUUFBUTtBQUFBLElBQ3ZCLFFBQVEsQ0FBQztBQUFBLElBQ1Q7QUFBQSxJQUNBO0FBQUEsRUFDRDtBQUNEO0FBRUEsZUFBZSxzQkFBc0IsUUFBbUQsYUFBMkIsZUFBK0U7QUFDak0sTUFBSSxDQUFDLE9BQU8sVUFBVTtBQUNyQixXQUFPO0FBQUEsRUFDUjtBQUVBLE1BQUksOEJBQThCLEtBQUssT0FBTyxTQUFTLElBQUksR0FBRztBQUM3RCxVQUFNLFdBQVcsU0FBUyxPQUFPLFFBQVE7QUFDekMsVUFBTSxXQUFXLE1BQU0sWUFBWSxTQUFTLE9BQU8sUUFBUTtBQUMzRCxRQUFJLFNBQVMsT0FBTyxLQUFLLE9BQU8sTUFBTTtBQUNyQyxvQkFBYyxNQUFNLFNBQVMsaUJBQWlCLG9CQUFvQixHQUFHLFNBQVMsd0JBQXdCLDhDQUE4QyxRQUFRLENBQUM7QUFDN0osWUFBTSxJQUFJLE1BQU0sb0JBQW9CO0FBQUEsSUFDckM7QUFDQSxVQUFNLGVBQWUsTUFBTSxZQUFZLFNBQVMsTUFBTSxNQUFNO0FBQzVELFdBQU87QUFBQSxNQUNOLElBQUksT0FBTyxTQUFTLFNBQVM7QUFBQSxNQUM3QixNQUFNO0FBQUEsTUFDTixVQUFVLE9BQU8sU0FBUztBQUFBLE1BQzFCLE9BQU87QUFBQSxNQUNQLE1BQU0sUUFBUTtBQUFBLE1BQ2QsU0FBUztBQUFBLE1BQ1QsUUFBUTtBQUFBLE1BQ1IsWUFBWSxDQUFDLEVBQUUsV0FBVyxPQUFPLFVBQVUsTUFBTSxZQUFZLENBQUM7QUFBQSxJQUMvRDtBQUFBLEVBQ0Q7QUFFQSxTQUFPO0FBQ1I7QUFFQSxTQUFTLFNBQVMsVUFBZSxPQUF3QjtBQUN4RCxNQUFJLFlBQVk7QUFDaEIsTUFBSSxPQUFPO0FBQ1YsZ0JBQVksSUFBSSxNQUFNLGVBQWU7QUFDckMsUUFBSSxNQUFNLG9CQUFvQixNQUFNLGVBQWU7QUFDbEQsbUJBQWEsSUFBSSxNQUFNLGFBQWE7QUFBQSxJQUNyQztBQUFBLEVBQ0Q7QUFDQSxTQUFPLFNBQVMsU0FBUztBQUMxQjsiLAogICJuYW1lcyI6IFsiQ2hhdERyYWdBbmREcm9wVHlwZSIsICJlZGl0b3IiXQp9Cg==
