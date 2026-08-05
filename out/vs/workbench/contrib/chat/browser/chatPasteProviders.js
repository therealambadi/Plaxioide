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
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { createStringDataTransferItem, VSDataTransfer } from "../../../../base/common/dataTransfer.js";
import { HierarchicalKind } from "../../../../base/common/hierarchicalKind.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Mimes } from "../../../../base/common/mime.js";
import { basename, joinPath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { localize } from "../../../../nls.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IExtensionService, isProposedApiEnabled } from "../../../services/extensions/common/extensions.js";
import { IChatWidgetService } from "./chat.js";
import { ChatInputPart } from "./chatInputPart.js";
import { resizeImage } from "./imageUtils.js";
const COPY_MIME_TYPES = "application/vnd.code.additional-editor-data";
let PasteImageProvider = class {
  constructor(chatWidgetService, extensionService, fileService, environmentService, logService) {
    this.chatWidgetService = chatWidgetService;
    this.extensionService = extensionService;
    this.fileService = fileService;
    this.environmentService = environmentService;
    this.logService = logService;
    this.kind = new HierarchicalKind("chat.attach.image");
    this.providedPasteEditKinds = [this.kind];
    this.copyMimeTypes = [];
    this.pasteMimeTypes = ["image/*"];
    this.imagesFolder = joinPath(this.environmentService.workspaceStorageHome, "vscode-chat-images");
    this.cleanupOldImages();
  }
  async provideDocumentPasteEdits(model, ranges, dataTransfer, context, token) {
    if (!this.extensionService.extensions.some((ext) => isProposedApiEnabled(ext, "chatReferenceBinaryData"))) {
      return;
    }
    const supportedMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/bmp",
      "image/gif",
      "image/tiff"
    ];
    let mimeType;
    let imageItem;
    for (const type of supportedMimeTypes) {
      imageItem = dataTransfer.get(type);
      if (imageItem) {
        mimeType = type;
        break;
      }
    }
    if (!imageItem || !mimeType) {
      return;
    }
    const currClipboard = await imageItem.asFile()?.data();
    if (token.isCancellationRequested || !currClipboard) {
      return;
    }
    const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
    if (!widget) {
      return;
    }
    const attachedVariables = widget.attachmentModel.attachments;
    const displayName = localize("pastedImageName", "Pasted Image");
    let tempDisplayName = displayName;
    for (let appendValue = 2; attachedVariables.some((attachment) => attachment.name === tempDisplayName); appendValue++) {
      tempDisplayName = `${displayName} ${appendValue}`;
    }
    const fileReference = await this.createFileForMedia(currClipboard, mimeType);
    if (token.isCancellationRequested || !fileReference) {
      return;
    }
    const scaledImageData = await resizeImage(currClipboard);
    if (token.isCancellationRequested || !scaledImageData) {
      return;
    }
    const scaledImageContext = await getImageAttachContext(scaledImageData, mimeType, token, tempDisplayName, fileReference);
    if (token.isCancellationRequested || !scaledImageContext) {
      return;
    }
    widget.attachmentModel.addContext(scaledImageContext);
    const currentContextIds = widget.attachmentModel.getAttachmentIDs();
    if (currentContextIds.has(scaledImageContext.id)) {
      return;
    }
    const edit = createCustomPasteEdit(model, scaledImageContext, mimeType, this.kind, localize("pastedImageAttachment", "Pasted Image Attachment"), this.chatWidgetService);
    return createEditSession(edit);
  }
  async createFileForMedia(dataTransfer, mimeType) {
    const exists = await this.fileService.exists(this.imagesFolder);
    if (!exists) {
      await this.fileService.createFolder(this.imagesFolder);
    }
    const ext = mimeType.split("/")[1] || "png";
    const filename = `image-${Date.now()}.${ext}`;
    const fileUri = joinPath(this.imagesFolder, filename);
    const buffer = VSBuffer.wrap(dataTransfer);
    await this.fileService.writeFile(fileUri, buffer);
    return fileUri;
  }
  async cleanupOldImages() {
    const exists = await this.fileService.exists(this.imagesFolder);
    if (!exists) {
      return;
    }
    const duration = 7 * 24 * 60 * 60 * 1e3;
    const files = await this.fileService.resolve(this.imagesFolder);
    if (!files.children) {
      return;
    }
    await Promise.all(files.children.map(async (file) => {
      try {
        const timestamp = this.getTimestampFromFilename(file.name);
        if (timestamp && Date.now() - timestamp > duration) {
          await this.fileService.del(file.resource);
        }
      } catch (err) {
        this.logService.error("Failed to clean up old images", err);
      }
    }));
  }
  getTimestampFromFilename(filename) {
    const match = filename.match(/image-(\d+)\./);
    if (match) {
      return parseInt(match[1], 10);
    }
    return void 0;
  }
};
PasteImageProvider = __decorateClass([
  __decorateParam(2, IFileService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, ILogService)
], PasteImageProvider);
async function getImageAttachContext(data, mimeType, token, displayName, resource) {
  const imageHash = await imageToHash(data);
  if (token.isCancellationRequested) {
    return void 0;
  }
  return {
    kind: "image",
    value: data,
    id: imageHash,
    name: displayName,
    isImage: true,
    icon: Codicon.fileMedia,
    mimeType,
    isPasted: true,
    references: [{ reference: resource, kind: "reference" }]
  };
}
async function imageToHash(data) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
function isImage(array) {
  if (array.length < 4) {
    return false;
  }
  const identifier = {
    png: [137, 80, 78, 71, 13, 10, 26, 10],
    jpeg: [255, 216, 255],
    bmp: [66, 77],
    gif: [71, 73, 70, 56],
    tiff: [73, 73, 42, 0]
  };
  return Object.values(identifier).some(
    (signature) => signature.every((byte, index) => array[index] === byte)
  );
}
class CopyTextProvider {
  constructor() {
    this.providedPasteEditKinds = [];
    this.copyMimeTypes = [COPY_MIME_TYPES];
    this.pasteMimeTypes = [];
  }
  async prepareDocumentPaste(model, ranges, dataTransfer, token) {
    if (model.uri.scheme === ChatInputPart.INPUT_SCHEME) {
      return;
    }
    const customDataTransfer = new VSDataTransfer();
    const data = { range: ranges[0], uri: model.uri.toJSON() };
    customDataTransfer.append(COPY_MIME_TYPES, createStringDataTransferItem(JSON.stringify(data)));
    return customDataTransfer;
  }
}
class PasteTextProvider {
  constructor(chatWidgetService, modelService) {
    this.chatWidgetService = chatWidgetService;
    this.modelService = modelService;
    this.kind = new HierarchicalKind("chat.attach.text");
    this.providedPasteEditKinds = [this.kind];
    this.copyMimeTypes = [];
    this.pasteMimeTypes = [COPY_MIME_TYPES];
  }
  async provideDocumentPasteEdits(model, ranges, dataTransfer, context, token) {
    if (model.uri.scheme !== ChatInputPart.INPUT_SCHEME) {
      return;
    }
    const text = dataTransfer.get(Mimes.text);
    const editorData = dataTransfer.get("vscode-editor-data");
    const additionalEditorData = dataTransfer.get(COPY_MIME_TYPES);
    if (!editorData || !text || !additionalEditorData) {
      return;
    }
    const textdata = await text.asString();
    const metadata = JSON.parse(await editorData.asString());
    const additionalData = JSON.parse(await additionalEditorData.asString());
    const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
    if (!widget) {
      return;
    }
    const start = additionalData.range.startLineNumber;
    const end = additionalData.range.endLineNumber;
    if (start === end) {
      const textModel = this.modelService.getModel(URI.revive(additionalData.uri));
      if (!textModel) {
        return;
      }
      const lineContent = textModel.getLineContent(start);
      if (lineContent !== textdata) {
        return;
      }
    }
    const copiedContext = getCopiedContext(textdata, URI.revive(additionalData.uri), metadata.mode, additionalData.range);
    if (token.isCancellationRequested || !copiedContext) {
      return;
    }
    const currentContextIds = widget.attachmentModel.getAttachmentIDs();
    if (currentContextIds.has(copiedContext.id)) {
      return;
    }
    const edit = createCustomPasteEdit(model, copiedContext, Mimes.text, this.kind, localize("pastedCodeAttachment", "Pasted Code Attachment"), this.chatWidgetService);
    edit.yieldTo = [{ kind: HierarchicalKind.Empty.append("text", "plain") }];
    return createEditSession(edit);
  }
}
function getCopiedContext(code, file, language, range) {
  const fileName = basename(file);
  const start = range.startLineNumber;
  const end = range.endLineNumber;
  const resultText = `Copied Selection of Code: 


 From the file: ${fileName} From lines ${start} to ${end} 
 \`\`\`${code}\`\`\``;
  const pastedLines = start === end ? localize("pastedAttachment.oneLine", "1 line") : localize("pastedAttachment.multipleLines", "{0} lines", end + 1 - start);
  return {
    kind: "paste",
    value: resultText,
    id: `${fileName}${start}${end}${range.startColumn}${range.endColumn}`,
    name: `${fileName} ${pastedLines}`,
    icon: Codicon.code,
    pastedLines,
    language,
    fileName: file.toString(),
    copiedFrom: {
      uri: file,
      range
    },
    code,
    references: [{
      reference: file,
      kind: "reference"
    }]
  };
}
function createCustomPasteEdit(model, context, handledMimeType, kind, title, chatWidgetService) {
  const customEdit = {
    resource: model.uri,
    variable: context,
    undo: () => {
      const widget = chatWidgetService.getWidgetByInputUri(model.uri);
      if (!widget) {
        throw new Error("No widget found for undo");
      }
      widget.attachmentModel.delete(context.id);
    },
    redo: () => {
      const widget = chatWidgetService.getWidgetByInputUri(model.uri);
      if (!widget) {
        throw new Error("No widget found for redo");
      }
      widget.attachmentModel.addContext(context);
    },
    metadata: { needsConfirmation: false, label: context.name }
  };
  return {
    insertText: "",
    title,
    kind,
    handledMimeType,
    additionalEdit: {
      edits: [customEdit]
    }
  };
}
function createEditSession(edit) {
  return {
    edits: [edit],
    dispose: () => {
    }
  };
}
let ChatPasteProvidersFeature = class extends Disposable {
  constructor(languageFeaturesService, chatWidgetService, extensionService, fileService, modelService, environmentService, logService) {
    super();
    this._register(languageFeaturesService.documentPasteEditProvider.register({ scheme: ChatInputPart.INPUT_SCHEME, pattern: "*", hasAccessToAllModels: true }, new PasteImageProvider(chatWidgetService, extensionService, fileService, environmentService, logService)));
    this._register(languageFeaturesService.documentPasteEditProvider.register({ scheme: ChatInputPart.INPUT_SCHEME, pattern: "*", hasAccessToAllModels: true }, new PasteTextProvider(chatWidgetService, modelService)));
    this._register(languageFeaturesService.documentPasteEditProvider.register("*", new CopyTextProvider()));
  }
};
ChatPasteProvidersFeature = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IChatWidgetService),
  __decorateParam(2, IExtensionService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IModelService),
  __decorateParam(5, IEnvironmentService),
  __decorateParam(6, ILogService)
], ChatPasteProvidersFeature);
export {
  ChatPasteProvidersFeature,
  CopyTextProvider,
  PasteImageProvider,
  PasteTextProvider,
  imageToHash,
  isImage
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFBhc3RlUHJvdmlkZXJzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTdHJpbmdEYXRhVHJhbnNmZXJJdGVtLCBJRGF0YVRyYW5zZmVySXRlbSwgSVJlYWRvbmx5VlNEYXRhVHJhbnNmZXIsIFZTRGF0YVRyYW5zZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGF0YVRyYW5zZmVyLmpzJztcbmltcG9ydCB7IEhpZXJhcmNoaWNhbEtpbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oaWVyYXJjaGljYWxLaW5kLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTWltZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9taW1lLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IERvY3VtZW50UGFzdGVDb250ZXh0LCBEb2N1bWVudFBhc3RlRWRpdCwgRG9jdW1lbnRQYXN0ZUVkaXRQcm92aWRlciwgRG9jdW1lbnRQYXN0ZUVkaXRzU2Vzc2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlLCBpc1Byb3Bvc2VkQXBpRW5hYmxlZCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNoYXRSZXF1ZXN0UGFzdGVWYXJpYWJsZUVudHJ5LCBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5IH0gZnJvbSAnLi4vY29tbW9uL2NoYXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJQ2hhdFdpZGdldFNlcnZpY2UgfSBmcm9tICcuL2NoYXQuanMnO1xuaW1wb3J0IHsgQ2hhdElucHV0UGFydCB9IGZyb20gJy4vY2hhdElucHV0UGFydC5qcyc7XG5pbXBvcnQgeyByZXNpemVJbWFnZSB9IGZyb20gJy4vaW1hZ2VVdGlscy5qcyc7XG5cbmNvbnN0IENPUFlfTUlNRV9UWVBFUyA9ICdhcHBsaWNhdGlvbi92bmQuY29kZS5hZGRpdGlvbmFsLWVkaXRvci1kYXRhJztcblxuaW50ZXJmYWNlIFNlcmlhbGl6ZWRDb3B5RGF0YSB7XG5cdHJlYWRvbmx5IHVyaTogVXJpQ29tcG9uZW50cztcblx0cmVhZG9ubHkgcmFuZ2U6IElSYW5nZTtcbn1cblxuZXhwb3J0IGNsYXNzIFBhc3RlSW1hZ2VQcm92aWRlciBpbXBsZW1lbnRzIERvY3VtZW50UGFzdGVFZGl0UHJvdmlkZXIge1xuXHRwcml2YXRlIHJlYWRvbmx5IGltYWdlc0ZvbGRlcjogVVJJO1xuXG5cdHB1YmxpYyByZWFkb25seSBraW5kID0gbmV3IEhpZXJhcmNoaWNhbEtpbmQoJ2NoYXQuYXR0YWNoLmltYWdlJyk7XG5cdHB1YmxpYyByZWFkb25seSBwcm92aWRlZFBhc3RlRWRpdEtpbmRzID0gW3RoaXMua2luZF07XG5cblx0cHVibGljIHJlYWRvbmx5IGNvcHlNaW1lVHlwZXMgPSBbXTtcblx0cHVibGljIHJlYWRvbmx5IHBhc3RlTWltZVR5cGVzID0gWydpbWFnZS8qJ107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjaGF0V2lkZ2V0U2VydmljZTogSUNoYXRXaWRnZXRTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuaW1hZ2VzRm9sZGVyID0gam9pblBhdGgodGhpcy5lbnZpcm9ubWVudFNlcnZpY2Uud29ya3NwYWNlU3RvcmFnZUhvbWUsICd2c2NvZGUtY2hhdC1pbWFnZXMnKTtcblx0XHR0aGlzLmNsZWFudXBPbGRJbWFnZXMoKTtcblx0fVxuXG5cdGFzeW5jIHByb3ZpZGVEb2N1bWVudFBhc3RlRWRpdHMobW9kZWw6IElUZXh0TW9kZWwsIHJhbmdlczogcmVhZG9ubHkgSVJhbmdlW10sIGRhdGFUcmFuc2ZlcjogSVJlYWRvbmx5VlNEYXRhVHJhbnNmZXIsIGNvbnRleHQ6IERvY3VtZW50UGFzdGVDb250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPERvY3VtZW50UGFzdGVFZGl0c1Nlc3Npb24gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uU2VydmljZS5leHRlbnNpb25zLnNvbWUoZXh0ID0+IGlzUHJvcG9zZWRBcGlFbmFibGVkKGV4dCwgJ2NoYXRSZWZlcmVuY2VCaW5hcnlEYXRhJykpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3VwcG9ydGVkTWltZVR5cGVzID0gW1xuXHRcdFx0J2ltYWdlL3BuZycsXG5cdFx0XHQnaW1hZ2UvanBlZycsXG5cdFx0XHQnaW1hZ2UvanBnJyxcblx0XHRcdCdpbWFnZS9ibXAnLFxuXHRcdFx0J2ltYWdlL2dpZicsXG5cdFx0XHQnaW1hZ2UvdGlmZidcblx0XHRdO1xuXG5cdFx0bGV0IG1pbWVUeXBlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGltYWdlSXRlbTogSURhdGFUcmFuc2Zlckl0ZW0gfCB1bmRlZmluZWQ7XG5cblx0XHQvLyBGaW5kIHRoZSBmaXJzdCBtYXRjaGluZyBpbWFnZSB0eXBlIGluIHRoZSBkYXRhVHJhbnNmZXJcblx0XHRmb3IgKGNvbnN0IHR5cGUgb2Ygc3VwcG9ydGVkTWltZVR5cGVzKSB7XG5cdFx0XHRpbWFnZUl0ZW0gPSBkYXRhVHJhbnNmZXIuZ2V0KHR5cGUpO1xuXHRcdFx0aWYgKGltYWdlSXRlbSkge1xuXHRcdFx0XHRtaW1lVHlwZSA9IHR5cGU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghaW1hZ2VJdGVtIHx8ICFtaW1lVHlwZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBjdXJyQ2xpcGJvYXJkID0gYXdhaXQgaW1hZ2VJdGVtLmFzRmlsZSgpPy5kYXRhKCk7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkIHx8ICFjdXJyQ2xpcGJvYXJkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd2lkZ2V0ID0gdGhpcy5jaGF0V2lkZ2V0U2VydmljZS5nZXRXaWRnZXRCeUlucHV0VXJpKG1vZGVsLnVyaSk7XG5cdFx0aWYgKCF3aWRnZXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBhdHRhY2hlZFZhcmlhYmxlcyA9IHdpZGdldC5hdHRhY2htZW50TW9kZWwuYXR0YWNobWVudHM7XG5cdFx0Y29uc3QgZGlzcGxheU5hbWUgPSBsb2NhbGl6ZSgncGFzdGVkSW1hZ2VOYW1lJywgJ1Bhc3RlZCBJbWFnZScpO1xuXHRcdGxldCB0ZW1wRGlzcGxheU5hbWUgPSBkaXNwbGF5TmFtZTtcblxuXHRcdGZvciAobGV0IGFwcGVuZFZhbHVlID0gMjsgYXR0YWNoZWRWYXJpYWJsZXMuc29tZShhdHRhY2htZW50ID0+IGF0dGFjaG1lbnQubmFtZSA9PT0gdGVtcERpc3BsYXlOYW1lKTsgYXBwZW5kVmFsdWUrKykge1xuXHRcdFx0dGVtcERpc3BsYXlOYW1lID0gYCR7ZGlzcGxheU5hbWV9ICR7YXBwZW5kVmFsdWV9YDtcblx0XHR9XG5cblx0XHRjb25zdCBmaWxlUmVmZXJlbmNlID0gYXdhaXQgdGhpcy5jcmVhdGVGaWxlRm9yTWVkaWEoY3VyckNsaXBib2FyZCwgbWltZVR5cGUpO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCB8fCAhZmlsZVJlZmVyZW5jZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNjYWxlZEltYWdlRGF0YSA9IGF3YWl0IHJlc2l6ZUltYWdlKGN1cnJDbGlwYm9hcmQpO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCB8fCAhc2NhbGVkSW1hZ2VEYXRhKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2NhbGVkSW1hZ2VDb250ZXh0ID0gYXdhaXQgZ2V0SW1hZ2VBdHRhY2hDb250ZXh0KHNjYWxlZEltYWdlRGF0YSwgbWltZVR5cGUsIHRva2VuLCB0ZW1wRGlzcGxheU5hbWUsIGZpbGVSZWZlcmVuY2UpO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCB8fCAhc2NhbGVkSW1hZ2VDb250ZXh0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0d2lkZ2V0LmF0dGFjaG1lbnRNb2RlbC5hZGRDb250ZXh0KHNjYWxlZEltYWdlQ29udGV4dCk7XG5cblx0XHQvLyBNYWtlIHN1cmUgdG8gYXR0YWNoIG9ubHkgbmV3IGNvbnRleHRzXG5cdFx0Y29uc3QgY3VycmVudENvbnRleHRJZHMgPSB3aWRnZXQuYXR0YWNobWVudE1vZGVsLmdldEF0dGFjaG1lbnRJRHMoKTtcblx0XHRpZiAoY3VycmVudENvbnRleHRJZHMuaGFzKHNjYWxlZEltYWdlQ29udGV4dC5pZCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0ID0gY3JlYXRlQ3VzdG9tUGFzdGVFZGl0KG1vZGVsLCBzY2FsZWRJbWFnZUNvbnRleHQsIG1pbWVUeXBlLCB0aGlzLmtpbmQsIGxvY2FsaXplKCdwYXN0ZWRJbWFnZUF0dGFjaG1lbnQnLCAnUGFzdGVkIEltYWdlIEF0dGFjaG1lbnQnKSwgdGhpcy5jaGF0V2lkZ2V0U2VydmljZSk7XG5cdFx0cmV0dXJuIGNyZWF0ZUVkaXRTZXNzaW9uKGVkaXQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjcmVhdGVGaWxlRm9yTWVkaWEoXG5cdFx0ZGF0YVRyYW5zZmVyOiBVaW50OEFycmF5LFxuXHRcdG1pbWVUeXBlOiBzdHJpbmcsXG5cdCk6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZXhpc3RzID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5leGlzdHModGhpcy5pbWFnZXNGb2xkZXIpO1xuXHRcdGlmICghZXhpc3RzKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmNyZWF0ZUZvbGRlcih0aGlzLmltYWdlc0ZvbGRlcik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXh0ID0gbWltZVR5cGUuc3BsaXQoJy8nKVsxXSB8fCAncG5nJztcblx0XHRjb25zdCBmaWxlbmFtZSA9IGBpbWFnZS0ke0RhdGUubm93KCl9LiR7ZXh0fWA7XG5cdFx0Y29uc3QgZmlsZVVyaSA9IGpvaW5QYXRoKHRoaXMuaW1hZ2VzRm9sZGVyLCBmaWxlbmFtZSk7XG5cblx0XHRjb25zdCBidWZmZXIgPSBWU0J1ZmZlci53cmFwKGRhdGFUcmFuc2Zlcik7XG5cdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUoZmlsZVVyaSwgYnVmZmVyKTtcblxuXHRcdHJldHVybiBmaWxlVXJpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjbGVhbnVwT2xkSW1hZ2VzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGV4aXN0cyA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZXhpc3RzKHRoaXMuaW1hZ2VzRm9sZGVyKTtcblx0XHRpZiAoIWV4aXN0cykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGR1cmF0aW9uID0gNyAqIDI0ICogNjAgKiA2MCAqIDEwMDA7IC8vIDcgZGF5c1xuXHRcdGNvbnN0IGZpbGVzID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZXNvbHZlKHRoaXMuaW1hZ2VzRm9sZGVyKTtcblx0XHRpZiAoIWZpbGVzLmNoaWxkcmVuKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoZmlsZXMuY2hpbGRyZW4ubWFwKGFzeW5jIChmaWxlKSA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCB0aW1lc3RhbXAgPSB0aGlzLmdldFRpbWVzdGFtcEZyb21GaWxlbmFtZShmaWxlLm5hbWUpO1xuXHRcdFx0XHRpZiAodGltZXN0YW1wICYmIChEYXRlLm5vdygpIC0gdGltZXN0YW1wID4gZHVyYXRpb24pKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5kZWwoZmlsZS5yZXNvdXJjZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoJ0ZhaWxlZCB0byBjbGVhbiB1cCBvbGQgaW1hZ2VzJywgZXJyKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGdldFRpbWVzdGFtcEZyb21GaWxlbmFtZShmaWxlbmFtZTogc3RyaW5nKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBtYXRjaCA9IGZpbGVuYW1lLm1hdGNoKC9pbWFnZS0oXFxkKylcXC4vKTtcblx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdHJldHVybiBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEltYWdlQXR0YWNoQ29udGV4dChkYXRhOiBVaW50OEFycmF5LCBtaW1lVHlwZTogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIGRpc3BsYXlOYW1lOiBzdHJpbmcsIHJlc291cmNlOiBVUkkpOiBQcm9taXNlPElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnkgfCB1bmRlZmluZWQ+IHtcblx0Y29uc3QgaW1hZ2VIYXNoID0gYXdhaXQgaW1hZ2VUb0hhc2goZGF0YSk7XG5cdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGtpbmQ6ICdpbWFnZScsXG5cdFx0dmFsdWU6IGRhdGEsXG5cdFx0aWQ6IGltYWdlSGFzaCxcblx0XHRuYW1lOiBkaXNwbGF5TmFtZSxcblx0XHRpc0ltYWdlOiB0cnVlLFxuXHRcdGljb246IENvZGljb24uZmlsZU1lZGlhLFxuXHRcdG1pbWVUeXBlLFxuXHRcdGlzUGFzdGVkOiB0cnVlLFxuXHRcdHJlZmVyZW5jZXM6IFt7IHJlZmVyZW5jZTogcmVzb3VyY2UsIGtpbmQ6ICdyZWZlcmVuY2UnIH1dXG5cdH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpbWFnZVRvSGFzaChkYXRhOiBVaW50OEFycmF5KTogUHJvbWlzZTxzdHJpbmc+IHtcblx0Y29uc3QgaGFzaEJ1ZmZlciA9IGF3YWl0IGNyeXB0by5zdWJ0bGUuZGlnZXN0KCdTSEEtMjU2JywgZGF0YSk7XG5cdGNvbnN0IGhhc2hBcnJheSA9IEFycmF5LmZyb20obmV3IFVpbnQ4QXJyYXkoaGFzaEJ1ZmZlcikpO1xuXHRyZXR1cm4gaGFzaEFycmF5Lm1hcChiID0+IGIudG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDIsICcwJykpLmpvaW4oJycpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNJbWFnZShhcnJheTogVWludDhBcnJheSk6IGJvb2xlYW4ge1xuXHRpZiAoYXJyYXkubGVuZ3RoIDwgNCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8vIE1hZ2ljIG51bWJlcnMgKGlkZW50aWZpY2F0aW9uIGJ5dGVzKSBmb3IgdmFyaW91cyBpbWFnZSBmb3JtYXRzXG5cdGNvbnN0IGlkZW50aWZpZXI6IHsgW2tleTogc3RyaW5nXTogbnVtYmVyW10gfSA9IHtcblx0XHRwbmc6IFsweDg5LCAweDUwLCAweDRFLCAweDQ3LCAweDBELCAweDBBLCAweDFBLCAweDBBXSxcblx0XHRqcGVnOiBbMHhGRiwgMHhEOCwgMHhGRl0sXG5cdFx0Ym1wOiBbMHg0MiwgMHg0RF0sXG5cdFx0Z2lmOiBbMHg0NywgMHg0OSwgMHg0NiwgMHgzOF0sXG5cdFx0dGlmZjogWzB4NDksIDB4NDksIDB4MkEsIDB4MDBdXG5cdH07XG5cblx0cmV0dXJuIE9iamVjdC52YWx1ZXMoaWRlbnRpZmllcikuc29tZSgoc2lnbmF0dXJlKSA9PlxuXHRcdHNpZ25hdHVyZS5ldmVyeSgoYnl0ZSwgaW5kZXgpID0+IGFycmF5W2luZGV4XSA9PT0gYnl0ZSlcblx0KTtcbn1cblxuZXhwb3J0IGNsYXNzIENvcHlUZXh0UHJvdmlkZXIgaW1wbGVtZW50cyBEb2N1bWVudFBhc3RlRWRpdFByb3ZpZGVyIHtcblx0cHVibGljIHJlYWRvbmx5IHByb3ZpZGVkUGFzdGVFZGl0S2luZHMgPSBbXTtcblx0cHVibGljIHJlYWRvbmx5IGNvcHlNaW1lVHlwZXMgPSBbQ09QWV9NSU1FX1RZUEVTXTtcblx0cHVibGljIHJlYWRvbmx5IHBhc3RlTWltZVR5cGVzID0gW107XG5cblx0YXN5bmMgcHJlcGFyZURvY3VtZW50UGFzdGUobW9kZWw6IElUZXh0TW9kZWwsIHJhbmdlczogcmVhZG9ubHkgSVJhbmdlW10sIGRhdGFUcmFuc2ZlcjogSVJlYWRvbmx5VlNEYXRhVHJhbnNmZXIsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dW5kZWZpbmVkIHwgSVJlYWRvbmx5VlNEYXRhVHJhbnNmZXI+IHtcblx0XHRpZiAobW9kZWwudXJpLnNjaGVtZSA9PT0gQ2hhdElucHV0UGFydC5JTlBVVF9TQ0hFTUUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjdXN0b21EYXRhVHJhbnNmZXIgPSBuZXcgVlNEYXRhVHJhbnNmZXIoKTtcblx0XHRjb25zdCBkYXRhOiBTZXJpYWxpemVkQ29weURhdGEgPSB7IHJhbmdlOiByYW5nZXNbMF0sIHVyaTogbW9kZWwudXJpLnRvSlNPTigpIH07XG5cdFx0Y3VzdG9tRGF0YVRyYW5zZmVyLmFwcGVuZChDT1BZX01JTUVfVFlQRVMsIGNyZWF0ZVN0cmluZ0RhdGFUcmFuc2Zlckl0ZW0oSlNPTi5zdHJpbmdpZnkoZGF0YSkpKTtcblx0XHRyZXR1cm4gY3VzdG9tRGF0YVRyYW5zZmVyO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBQYXN0ZVRleHRQcm92aWRlciBpbXBsZW1lbnRzIERvY3VtZW50UGFzdGVFZGl0UHJvdmlkZXIge1xuXG5cdHB1YmxpYyByZWFkb25seSBraW5kID0gbmV3IEhpZXJhcmNoaWNhbEtpbmQoJ2NoYXQuYXR0YWNoLnRleHQnKTtcblx0cHVibGljIHJlYWRvbmx5IHByb3ZpZGVkUGFzdGVFZGl0S2luZHMgPSBbdGhpcy5raW5kXTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgY29weU1pbWVUeXBlcyA9IFtdO1xuXHRwdWJsaWMgcmVhZG9ubHkgcGFzdGVNaW1lVHlwZXMgPSBbQ09QWV9NSU1FX1RZUEVTXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNoYXRXaWRnZXRTZXJ2aWNlOiBJQ2hhdFdpZGdldFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2Vcblx0KSB7IH1cblxuXHRhc3luYyBwcm92aWRlRG9jdW1lbnRQYXN0ZUVkaXRzKG1vZGVsOiBJVGV4dE1vZGVsLCByYW5nZXM6IHJlYWRvbmx5IElSYW5nZVtdLCBkYXRhVHJhbnNmZXI6IElSZWFkb25seVZTRGF0YVRyYW5zZmVyLCBjb250ZXh0OiBEb2N1bWVudFBhc3RlQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxEb2N1bWVudFBhc3RlRWRpdHNTZXNzaW9uIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKG1vZGVsLnVyaS5zY2hlbWUgIT09IENoYXRJbnB1dFBhcnQuSU5QVVRfU0NIRU1FKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHRleHQgPSBkYXRhVHJhbnNmZXIuZ2V0KE1pbWVzLnRleHQpO1xuXHRcdGNvbnN0IGVkaXRvckRhdGEgPSBkYXRhVHJhbnNmZXIuZ2V0KCd2c2NvZGUtZWRpdG9yLWRhdGEnKTtcblx0XHRjb25zdCBhZGRpdGlvbmFsRWRpdG9yRGF0YSA9IGRhdGFUcmFuc2Zlci5nZXQoQ09QWV9NSU1FX1RZUEVTKTtcblxuXHRcdGlmICghZWRpdG9yRGF0YSB8fCAhdGV4dCB8fCAhYWRkaXRpb25hbEVkaXRvckRhdGEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB0ZXh0ZGF0YSA9IGF3YWl0IHRleHQuYXNTdHJpbmcoKTtcblx0XHRjb25zdCBtZXRhZGF0YSA9IEpTT04ucGFyc2UoYXdhaXQgZWRpdG9yRGF0YS5hc1N0cmluZygpKTtcblx0XHRjb25zdCBhZGRpdGlvbmFsRGF0YTogU2VyaWFsaXplZENvcHlEYXRhID0gSlNPTi5wYXJzZShhd2FpdCBhZGRpdGlvbmFsRWRpdG9yRGF0YS5hc1N0cmluZygpKTtcblxuXHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuY2hhdFdpZGdldFNlcnZpY2UuZ2V0V2lkZ2V0QnlJbnB1dFVyaShtb2RlbC51cmkpO1xuXHRcdGlmICghd2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhcnQgPSBhZGRpdGlvbmFsRGF0YS5yYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0Y29uc3QgZW5kID0gYWRkaXRpb25hbERhdGEucmFuZ2UuZW5kTGluZU51bWJlcjtcblx0XHRpZiAoc3RhcnQgPT09IGVuZCkge1xuXHRcdFx0Y29uc3QgdGV4dE1vZGVsID0gdGhpcy5tb2RlbFNlcnZpY2UuZ2V0TW9kZWwoVVJJLnJldml2ZShhZGRpdGlvbmFsRGF0YS51cmkpKTtcblx0XHRcdGlmICghdGV4dE1vZGVsKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgY29waWVkIGxpbmUgdGV4dCBkYXRhIGlzIHRoZSBlbnRpcmUgbGluZSBjb250ZW50LCB0aGVuIHdlIGNhbiBwYXN0ZSBpdCBhcyBhIGNvZGUgYXR0YWNobWVudC4gT3RoZXJ3aXNlLCB3ZSBpZ25vcmUgYW5kIHVzZSBkZWZhdWx0IHBhc3RlIHByb3ZpZGVyLlxuXHRcdFx0Y29uc3QgbGluZUNvbnRlbnQgPSB0ZXh0TW9kZWwuZ2V0TGluZUNvbnRlbnQoc3RhcnQpO1xuXHRcdFx0aWYgKGxpbmVDb250ZW50ICE9PSB0ZXh0ZGF0YSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29waWVkQ29udGV4dCA9IGdldENvcGllZENvbnRleHQodGV4dGRhdGEsIFVSSS5yZXZpdmUoYWRkaXRpb25hbERhdGEudXJpKSwgbWV0YWRhdGEubW9kZSwgYWRkaXRpb25hbERhdGEucmFuZ2UpO1xuXG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkIHx8ICFjb3BpZWRDb250ZXh0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3VycmVudENvbnRleHRJZHMgPSB3aWRnZXQuYXR0YWNobWVudE1vZGVsLmdldEF0dGFjaG1lbnRJRHMoKTtcblx0XHRpZiAoY3VycmVudENvbnRleHRJZHMuaGFzKGNvcGllZENvbnRleHQuaWQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdCA9IGNyZWF0ZUN1c3RvbVBhc3RlRWRpdChtb2RlbCwgY29waWVkQ29udGV4dCwgTWltZXMudGV4dCwgdGhpcy5raW5kLCBsb2NhbGl6ZSgncGFzdGVkQ29kZUF0dGFjaG1lbnQnLCAnUGFzdGVkIENvZGUgQXR0YWNobWVudCcpLCB0aGlzLmNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRlZGl0LnlpZWxkVG8gPSBbeyBraW5kOiBIaWVyYXJjaGljYWxLaW5kLkVtcHR5LmFwcGVuZCgndGV4dCcsICdwbGFpbicpIH1dO1xuXHRcdHJldHVybiBjcmVhdGVFZGl0U2Vzc2lvbihlZGl0KTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRDb3BpZWRDb250ZXh0KGNvZGU6IHN0cmluZywgZmlsZTogVVJJLCBsYW5ndWFnZTogc3RyaW5nLCByYW5nZTogSVJhbmdlKTogSUNoYXRSZXF1ZXN0UGFzdGVWYXJpYWJsZUVudHJ5IHtcblx0Y29uc3QgZmlsZU5hbWUgPSBiYXNlbmFtZShmaWxlKTtcblx0Y29uc3Qgc3RhcnQgPSByYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdGNvbnN0IGVuZCA9IHJhbmdlLmVuZExpbmVOdW1iZXI7XG5cdGNvbnN0IHJlc3VsdFRleHQgPSBgQ29waWVkIFNlbGVjdGlvbiBvZiBDb2RlOiBcXG5cXG5cXG4gRnJvbSB0aGUgZmlsZTogJHtmaWxlTmFtZX0gRnJvbSBsaW5lcyAke3N0YXJ0fSB0byAke2VuZH0gXFxuIFxcYFxcYFxcYCR7Y29kZX1cXGBcXGBcXGBgO1xuXHRjb25zdCBwYXN0ZWRMaW5lcyA9IHN0YXJ0ID09PSBlbmQgPyBsb2NhbGl6ZSgncGFzdGVkQXR0YWNobWVudC5vbmVMaW5lJywgJzEgbGluZScpIDogbG9jYWxpemUoJ3Bhc3RlZEF0dGFjaG1lbnQubXVsdGlwbGVMaW5lcycsICd7MH0gbGluZXMnLCBlbmQgKyAxIC0gc3RhcnQpO1xuXHRyZXR1cm4ge1xuXHRcdGtpbmQ6ICdwYXN0ZScsXG5cdFx0dmFsdWU6IHJlc3VsdFRleHQsXG5cdFx0aWQ6IGAke2ZpbGVOYW1lfSR7c3RhcnR9JHtlbmR9JHtyYW5nZS5zdGFydENvbHVtbn0ke3JhbmdlLmVuZENvbHVtbn1gLFxuXHRcdG5hbWU6IGAke2ZpbGVOYW1lfSAke3Bhc3RlZExpbmVzfWAsXG5cdFx0aWNvbjogQ29kaWNvbi5jb2RlLFxuXHRcdHBhc3RlZExpbmVzLFxuXHRcdGxhbmd1YWdlLFxuXHRcdGZpbGVOYW1lOiBmaWxlLnRvU3RyaW5nKCksXG5cdFx0Y29waWVkRnJvbToge1xuXHRcdFx0dXJpOiBmaWxlLFxuXHRcdFx0cmFuZ2Vcblx0XHR9LFxuXHRcdGNvZGUsXG5cdFx0cmVmZXJlbmNlczogW3tcblx0XHRcdHJlZmVyZW5jZTogZmlsZSxcblx0XHRcdGtpbmQ6ICdyZWZlcmVuY2UnXG5cdFx0fV1cblx0fTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ3VzdG9tUGFzdGVFZGl0KG1vZGVsOiBJVGV4dE1vZGVsLCBjb250ZXh0OiBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5LCBoYW5kbGVkTWltZVR5cGU6IHN0cmluZywga2luZDogSGllcmFyY2hpY2FsS2luZCwgdGl0bGU6IHN0cmluZywgY2hhdFdpZGdldFNlcnZpY2U6IElDaGF0V2lkZ2V0U2VydmljZSk6IERvY3VtZW50UGFzdGVFZGl0IHtcblx0Y29uc3QgY3VzdG9tRWRpdCA9IHtcblx0XHRyZXNvdXJjZTogbW9kZWwudXJpLFxuXHRcdHZhcmlhYmxlOiBjb250ZXh0LFxuXHRcdHVuZG86ICgpID0+IHtcblx0XHRcdGNvbnN0IHdpZGdldCA9IGNoYXRXaWRnZXRTZXJ2aWNlLmdldFdpZGdldEJ5SW5wdXRVcmkobW9kZWwudXJpKTtcblx0XHRcdGlmICghd2lkZ2V0KSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gd2lkZ2V0IGZvdW5kIGZvciB1bmRvJyk7XG5cdFx0XHR9XG5cdFx0XHR3aWRnZXQuYXR0YWNobWVudE1vZGVsLmRlbGV0ZShjb250ZXh0LmlkKTtcblx0XHR9LFxuXHRcdHJlZG86ICgpID0+IHtcblx0XHRcdGNvbnN0IHdpZGdldCA9IGNoYXRXaWRnZXRTZXJ2aWNlLmdldFdpZGdldEJ5SW5wdXRVcmkobW9kZWwudXJpKTtcblx0XHRcdGlmICghd2lkZ2V0KSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gd2lkZ2V0IGZvdW5kIGZvciByZWRvJyk7XG5cdFx0XHR9XG5cdFx0XHR3aWRnZXQuYXR0YWNobWVudE1vZGVsLmFkZENvbnRleHQoY29udGV4dCk7XG5cdFx0fSxcblx0XHRtZXRhZGF0YTogeyBuZWVkc0NvbmZpcm1hdGlvbjogZmFsc2UsIGxhYmVsOiBjb250ZXh0Lm5hbWUgfVxuXHR9O1xuXG5cdHJldHVybiB7XG5cdFx0aW5zZXJ0VGV4dDogJycsXG5cdFx0dGl0bGUsXG5cdFx0a2luZCxcblx0XHRoYW5kbGVkTWltZVR5cGUsXG5cdFx0YWRkaXRpb25hbEVkaXQ6IHtcblx0XHRcdGVkaXRzOiBbY3VzdG9tRWRpdF0sXG5cdFx0fVxuXHR9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVFZGl0U2Vzc2lvbihlZGl0OiBEb2N1bWVudFBhc3RlRWRpdCk6IERvY3VtZW50UGFzdGVFZGl0c1Nlc3Npb24ge1xuXHRyZXR1cm4ge1xuXHRcdGVkaXRzOiBbZWRpdF0sXG5cdFx0ZGlzcG9zZTogKCkgPT4geyB9LFxuXHR9O1xufVxuXG5leHBvcnQgY2xhc3MgQ2hhdFBhc3RlUHJvdmlkZXJzRmVhdHVyZSBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdFx0QElDaGF0V2lkZ2V0U2VydmljZSBjaGF0V2lkZ2V0U2VydmljZTogSUNoYXRXaWRnZXRTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJRW52aXJvbm1lbnRTZXJ2aWNlIGVudmlyb25tZW50U2VydmljZTogSUVudmlyb25tZW50U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRQYXN0ZUVkaXRQcm92aWRlci5yZWdpc3Rlcih7IHNjaGVtZTogQ2hhdElucHV0UGFydC5JTlBVVF9TQ0hFTUUsIHBhdHRlcm46ICcqJywgaGFzQWNjZXNzVG9BbGxNb2RlbHM6IHRydWUgfSwgbmV3IFBhc3RlSW1hZ2VQcm92aWRlcihjaGF0V2lkZ2V0U2VydmljZSwgZXh0ZW5zaW9uU2VydmljZSwgZmlsZVNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSwgbG9nU2VydmljZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFBhc3RlRWRpdFByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiBDaGF0SW5wdXRQYXJ0LklOUFVUX1NDSEVNRSwgcGF0dGVybjogJyonLCBoYXNBY2Nlc3NUb0FsbE1vZGVsczogdHJ1ZSB9LCBuZXcgUGFzdGVUZXh0UHJvdmlkZXIoY2hhdFdpZGdldFNlcnZpY2UsIG1vZGVsU2VydmljZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFBhc3RlRWRpdFByb3ZpZGVyLnJlZ2lzdGVyKCcqJywgbmV3IENvcHlUZXh0UHJvdmlkZXIoKSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUlBLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsZUFBZTtBQUN4QixTQUFTLDhCQUEwRSxzQkFBc0I7QUFDekcsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsVUFBVSxnQkFBZ0I7QUFDbkMsU0FBUyxXQUEwQjtBQUluQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLG1CQUFtQiw0QkFBNEI7QUFFeEQsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxtQkFBbUI7QUFFNUIsTUFBTSxrQkFBa0I7QUFPakIsSUFBTSxxQkFBTixNQUE4RDtBQUFBLEVBU3BFLFlBQ2tCLG1CQUNBLGtCQUNjLGFBQ08sb0JBQ1IsWUFDN0I7QUFMZ0I7QUFDQTtBQUNjO0FBQ087QUFDUjtBQVgvQixTQUFnQixPQUFPLElBQUksaUJBQWlCLG1CQUFtQjtBQUMvRCxTQUFnQix5QkFBeUIsQ0FBQyxLQUFLLElBQUk7QUFFbkQsU0FBZ0IsZ0JBQWdCLENBQUM7QUFDakMsU0FBZ0IsaUJBQWlCLENBQUMsU0FBUztBQVMxQyxTQUFLLGVBQWUsU0FBUyxLQUFLLG1CQUFtQixzQkFBc0Isb0JBQW9CO0FBQy9GLFNBQUssaUJBQWlCO0FBQUEsRUFDdkI7QUFBQSxFQUVBLE1BQU0sMEJBQTBCLE9BQW1CLFFBQTJCLGNBQXVDLFNBQStCLE9BQTBFO0FBQzdOLFFBQUksQ0FBQyxLQUFLLGlCQUFpQixXQUFXLEtBQUssU0FBTyxxQkFBcUIsS0FBSyx5QkFBeUIsQ0FBQyxHQUFHO0FBQ3hHO0FBQUEsSUFDRDtBQUVBLFVBQU0scUJBQXFCO0FBQUEsTUFDMUI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFFQSxRQUFJO0FBQ0osUUFBSTtBQUdKLGVBQVcsUUFBUSxvQkFBb0I7QUFDdEMsa0JBQVksYUFBYSxJQUFJLElBQUk7QUFDakMsVUFBSSxXQUFXO0FBQ2QsbUJBQVc7QUFDWDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsUUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVO0FBQzVCO0FBQUEsSUFDRDtBQUNBLFVBQU0sZ0JBQWdCLE1BQU0sVUFBVSxPQUFPLEdBQUcsS0FBSztBQUNyRCxRQUFJLE1BQU0sMkJBQTJCLENBQUMsZUFBZTtBQUNwRDtBQUFBLElBQ0Q7QUFFQSxVQUFNLFNBQVMsS0FBSyxrQkFBa0Isb0JBQW9CLE1BQU0sR0FBRztBQUNuRSxRQUFJLENBQUMsUUFBUTtBQUNaO0FBQUEsSUFDRDtBQUVBLFVBQU0sb0JBQW9CLE9BQU8sZ0JBQWdCO0FBQ2pELFVBQU0sY0FBYyxTQUFTLG1CQUFtQixjQUFjO0FBQzlELFFBQUksa0JBQWtCO0FBRXRCLGFBQVMsY0FBYyxHQUFHLGtCQUFrQixLQUFLLGdCQUFjLFdBQVcsU0FBUyxlQUFlLEdBQUcsZUFBZTtBQUNuSCx3QkFBa0IsR0FBRyxXQUFXLElBQUksV0FBVztBQUFBLElBQ2hEO0FBRUEsVUFBTSxnQkFBZ0IsTUFBTSxLQUFLLG1CQUFtQixlQUFlLFFBQVE7QUFDM0UsUUFBSSxNQUFNLDJCQUEyQixDQUFDLGVBQWU7QUFDcEQ7QUFBQSxJQUNEO0FBRUEsVUFBTSxrQkFBa0IsTUFBTSxZQUFZLGFBQWE7QUFDdkQsUUFBSSxNQUFNLDJCQUEyQixDQUFDLGlCQUFpQjtBQUN0RDtBQUFBLElBQ0Q7QUFFQSxVQUFNLHFCQUFxQixNQUFNLHNCQUFzQixpQkFBaUIsVUFBVSxPQUFPLGlCQUFpQixhQUFhO0FBQ3ZILFFBQUksTUFBTSwyQkFBMkIsQ0FBQyxvQkFBb0I7QUFDekQ7QUFBQSxJQUNEO0FBRUEsV0FBTyxnQkFBZ0IsV0FBVyxrQkFBa0I7QUFHcEQsVUFBTSxvQkFBb0IsT0FBTyxnQkFBZ0IsaUJBQWlCO0FBQ2xFLFFBQUksa0JBQWtCLElBQUksbUJBQW1CLEVBQUUsR0FBRztBQUNqRDtBQUFBLElBQ0Q7QUFFQSxVQUFNLE9BQU8sc0JBQXNCLE9BQU8sb0JBQW9CLFVBQVUsS0FBSyxNQUFNLFNBQVMseUJBQXlCLHlCQUF5QixHQUFHLEtBQUssaUJBQWlCO0FBQ3ZLLFdBQU8sa0JBQWtCLElBQUk7QUFBQSxFQUM5QjtBQUFBLEVBRUEsTUFBYyxtQkFDYixjQUNBLFVBQzJCO0FBQzNCLFVBQU0sU0FBUyxNQUFNLEtBQUssWUFBWSxPQUFPLEtBQUssWUFBWTtBQUM5RCxRQUFJLENBQUMsUUFBUTtBQUNaLFlBQU0sS0FBSyxZQUFZLGFBQWEsS0FBSyxZQUFZO0FBQUEsSUFDdEQ7QUFFQSxVQUFNLE1BQU0sU0FBUyxNQUFNLEdBQUcsRUFBRSxDQUFDLEtBQUs7QUFDdEMsVUFBTSxXQUFXLFNBQVMsS0FBSyxJQUFJLENBQUMsSUFBSSxHQUFHO0FBQzNDLFVBQU0sVUFBVSxTQUFTLEtBQUssY0FBYyxRQUFRO0FBRXBELFVBQU0sU0FBUyxTQUFTLEtBQUssWUFBWTtBQUN6QyxVQUFNLEtBQUssWUFBWSxVQUFVLFNBQVMsTUFBTTtBQUVoRCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBYyxtQkFBa0M7QUFDL0MsVUFBTSxTQUFTLE1BQU0sS0FBSyxZQUFZLE9BQU8sS0FBSyxZQUFZO0FBQzlELFFBQUksQ0FBQyxRQUFRO0FBQ1o7QUFBQSxJQUNEO0FBRUEsVUFBTSxXQUFXLElBQUksS0FBSyxLQUFLLEtBQUs7QUFDcEMsVUFBTSxRQUFRLE1BQU0sS0FBSyxZQUFZLFFBQVEsS0FBSyxZQUFZO0FBQzlELFFBQUksQ0FBQyxNQUFNLFVBQVU7QUFDcEI7QUFBQSxJQUNEO0FBRUEsVUFBTSxRQUFRLElBQUksTUFBTSxTQUFTLElBQUksT0FBTyxTQUFTO0FBQ3BELFVBQUk7QUFDSCxjQUFNLFlBQVksS0FBSyx5QkFBeUIsS0FBSyxJQUFJO0FBQ3pELFlBQUksYUFBYyxLQUFLLElBQUksSUFBSSxZQUFZLFVBQVc7QUFDckQsZ0JBQU0sS0FBSyxZQUFZLElBQUksS0FBSyxRQUFRO0FBQUEsUUFDekM7QUFBQSxNQUNELFNBQVMsS0FBSztBQUNiLGFBQUssV0FBVyxNQUFNLGlDQUFpQyxHQUFHO0FBQUEsTUFDM0Q7QUFBQSxJQUNELENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVRLHlCQUF5QixVQUFzQztBQUN0RSxVQUFNLFFBQVEsU0FBUyxNQUFNLGVBQWU7QUFDNUMsUUFBSSxPQUFPO0FBQ1YsYUFBTyxTQUFTLE1BQU0sQ0FBQyxHQUFHLEVBQUU7QUFBQSxJQUM3QjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUFoSmEscUJBQU47QUFBQSxFQVlKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWRVO0FBa0piLGVBQWUsc0JBQXNCLE1BQWtCLFVBQWtCLE9BQTBCLGFBQXFCLFVBQStEO0FBQ3RMLFFBQU0sWUFBWSxNQUFNLFlBQVksSUFBSTtBQUN4QyxNQUFJLE1BQU0seUJBQXlCO0FBQ2xDLFdBQU87QUFBQSxFQUNSO0FBRUEsU0FBTztBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsSUFBSTtBQUFBLElBQ0osTUFBTTtBQUFBLElBQ04sU0FBUztBQUFBLElBQ1QsTUFBTSxRQUFRO0FBQUEsSUFDZDtBQUFBLElBQ0EsVUFBVTtBQUFBLElBQ1YsWUFBWSxDQUFDLEVBQUUsV0FBVyxVQUFVLE1BQU0sWUFBWSxDQUFDO0FBQUEsRUFDeEQ7QUFDRDtBQUVBLGVBQXNCLFlBQVksTUFBbUM7QUFDcEUsUUFBTSxhQUFhLE1BQU0sT0FBTyxPQUFPLE9BQU8sV0FBVyxJQUFJO0FBQzdELFFBQU0sWUFBWSxNQUFNLEtBQUssSUFBSSxXQUFXLFVBQVUsQ0FBQztBQUN2RCxTQUFPLFVBQVUsSUFBSSxPQUFLLEVBQUUsU0FBUyxFQUFFLEVBQUUsU0FBUyxHQUFHLEdBQUcsQ0FBQyxFQUFFLEtBQUssRUFBRTtBQUNuRTtBQUVPLFNBQVMsUUFBUSxPQUE0QjtBQUNuRCxNQUFJLE1BQU0sU0FBUyxHQUFHO0FBQ3JCLFdBQU87QUFBQSxFQUNSO0FBR0EsUUFBTSxhQUEwQztBQUFBLElBQy9DLEtBQUssQ0FBQyxLQUFNLElBQU0sSUFBTSxJQUFNLElBQU0sSUFBTSxJQUFNLEVBQUk7QUFBQSxJQUNwRCxNQUFNLENBQUMsS0FBTSxLQUFNLEdBQUk7QUFBQSxJQUN2QixLQUFLLENBQUMsSUFBTSxFQUFJO0FBQUEsSUFDaEIsS0FBSyxDQUFDLElBQU0sSUFBTSxJQUFNLEVBQUk7QUFBQSxJQUM1QixNQUFNLENBQUMsSUFBTSxJQUFNLElBQU0sQ0FBSTtBQUFBLEVBQzlCO0FBRUEsU0FBTyxPQUFPLE9BQU8sVUFBVSxFQUFFO0FBQUEsSUFBSyxDQUFDLGNBQ3RDLFVBQVUsTUFBTSxDQUFDLE1BQU0sVUFBVSxNQUFNLEtBQUssTUFBTSxJQUFJO0FBQUEsRUFDdkQ7QUFDRDtBQUVPLE1BQU0saUJBQXNEO0FBQUEsRUFBNUQ7QUFDTixTQUFnQix5QkFBeUIsQ0FBQztBQUMxQyxTQUFnQixnQkFBZ0IsQ0FBQyxlQUFlO0FBQ2hELFNBQWdCLGlCQUFpQixDQUFDO0FBQUE7QUFBQSxFQUVsQyxNQUFNLHFCQUFxQixPQUFtQixRQUEyQixjQUF1QyxPQUF3RTtBQUN2TCxRQUFJLE1BQU0sSUFBSSxXQUFXLGNBQWMsY0FBYztBQUNwRDtBQUFBLElBQ0Q7QUFFQSxVQUFNLHFCQUFxQixJQUFJLGVBQWU7QUFDOUMsVUFBTSxPQUEyQixFQUFFLE9BQU8sT0FBTyxDQUFDLEdBQUcsS0FBSyxNQUFNLElBQUksT0FBTyxFQUFFO0FBQzdFLHVCQUFtQixPQUFPLGlCQUFpQiw2QkFBNkIsS0FBSyxVQUFVLElBQUksQ0FBQyxDQUFDO0FBQzdGLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUFFTyxNQUFNLGtCQUF1RDtBQUFBLEVBUW5FLFlBQ2tCLG1CQUNBLGNBQ2hCO0FBRmdCO0FBQ0E7QUFSbEIsU0FBZ0IsT0FBTyxJQUFJLGlCQUFpQixrQkFBa0I7QUFDOUQsU0FBZ0IseUJBQXlCLENBQUMsS0FBSyxJQUFJO0FBRW5ELFNBQWdCLGdCQUFnQixDQUFDO0FBQ2pDLFNBQWdCLGlCQUFpQixDQUFDLGVBQWU7QUFBQSxFQUs3QztBQUFBLEVBRUosTUFBTSwwQkFBMEIsT0FBbUIsUUFBMkIsY0FBdUMsU0FBK0IsT0FBMEU7QUFDN04sUUFBSSxNQUFNLElBQUksV0FBVyxjQUFjLGNBQWM7QUFDcEQ7QUFBQSxJQUNEO0FBQ0EsVUFBTSxPQUFPLGFBQWEsSUFBSSxNQUFNLElBQUk7QUFDeEMsVUFBTSxhQUFhLGFBQWEsSUFBSSxvQkFBb0I7QUFDeEQsVUFBTSx1QkFBdUIsYUFBYSxJQUFJLGVBQWU7QUFFN0QsUUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsc0JBQXNCO0FBQ2xEO0FBQUEsSUFDRDtBQUVBLFVBQU0sV0FBVyxNQUFNLEtBQUssU0FBUztBQUNyQyxVQUFNLFdBQVcsS0FBSyxNQUFNLE1BQU0sV0FBVyxTQUFTLENBQUM7QUFDdkQsVUFBTSxpQkFBcUMsS0FBSyxNQUFNLE1BQU0scUJBQXFCLFNBQVMsQ0FBQztBQUUzRixVQUFNLFNBQVMsS0FBSyxrQkFBa0Isb0JBQW9CLE1BQU0sR0FBRztBQUNuRSxRQUFJLENBQUMsUUFBUTtBQUNaO0FBQUEsSUFDRDtBQUVBLFVBQU0sUUFBUSxlQUFlLE1BQU07QUFDbkMsVUFBTSxNQUFNLGVBQWUsTUFBTTtBQUNqQyxRQUFJLFVBQVUsS0FBSztBQUNsQixZQUFNLFlBQVksS0FBSyxhQUFhLFNBQVMsSUFBSSxPQUFPLGVBQWUsR0FBRyxDQUFDO0FBQzNFLFVBQUksQ0FBQyxXQUFXO0FBQ2Y7QUFBQSxNQUNEO0FBR0EsWUFBTSxjQUFjLFVBQVUsZUFBZSxLQUFLO0FBQ2xELFVBQUksZ0JBQWdCLFVBQVU7QUFDN0I7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFVBQU0sZ0JBQWdCLGlCQUFpQixVQUFVLElBQUksT0FBTyxlQUFlLEdBQUcsR0FBRyxTQUFTLE1BQU0sZUFBZSxLQUFLO0FBRXBILFFBQUksTUFBTSwyQkFBMkIsQ0FBQyxlQUFlO0FBQ3BEO0FBQUEsSUFDRDtBQUVBLFVBQU0sb0JBQW9CLE9BQU8sZ0JBQWdCLGlCQUFpQjtBQUNsRSxRQUFJLGtCQUFrQixJQUFJLGNBQWMsRUFBRSxHQUFHO0FBQzVDO0FBQUEsSUFDRDtBQUVBLFVBQU0sT0FBTyxzQkFBc0IsT0FBTyxlQUFlLE1BQU0sTUFBTSxLQUFLLE1BQU0sU0FBUyx3QkFBd0Isd0JBQXdCLEdBQUcsS0FBSyxpQkFBaUI7QUFDbEssU0FBSyxVQUFVLENBQUMsRUFBRSxNQUFNLGlCQUFpQixNQUFNLE9BQU8sUUFBUSxPQUFPLEVBQUUsQ0FBQztBQUN4RSxXQUFPLGtCQUFrQixJQUFJO0FBQUEsRUFDOUI7QUFDRDtBQUVBLFNBQVMsaUJBQWlCLE1BQWMsTUFBVyxVQUFrQixPQUErQztBQUNuSCxRQUFNLFdBQVcsU0FBUyxJQUFJO0FBQzlCLFFBQU0sUUFBUSxNQUFNO0FBQ3BCLFFBQU0sTUFBTSxNQUFNO0FBQ2xCLFFBQU0sYUFBYTtBQUFBO0FBQUE7QUFBQSxrQkFBbUQsUUFBUSxlQUFlLEtBQUssT0FBTyxHQUFHO0FBQUEsU0FBYSxJQUFJO0FBQzdILFFBQU0sY0FBYyxVQUFVLE1BQU0sU0FBUyw0QkFBNEIsUUFBUSxJQUFJLFNBQVMsa0NBQWtDLGFBQWEsTUFBTSxJQUFJLEtBQUs7QUFDNUosU0FBTztBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsSUFBSSxHQUFHLFFBQVEsR0FBRyxLQUFLLEdBQUcsR0FBRyxHQUFHLE1BQU0sV0FBVyxHQUFHLE1BQU0sU0FBUztBQUFBLElBQ25FLE1BQU0sR0FBRyxRQUFRLElBQUksV0FBVztBQUFBLElBQ2hDLE1BQU0sUUFBUTtBQUFBLElBQ2Q7QUFBQSxJQUNBO0FBQUEsSUFDQSxVQUFVLEtBQUssU0FBUztBQUFBLElBQ3hCLFlBQVk7QUFBQSxNQUNYLEtBQUs7QUFBQSxNQUNMO0FBQUEsSUFDRDtBQUFBLElBQ0E7QUFBQSxJQUNBLFlBQVksQ0FBQztBQUFBLE1BQ1osV0FBVztBQUFBLE1BQ1gsTUFBTTtBQUFBLElBQ1AsQ0FBQztBQUFBLEVBQ0Y7QUFDRDtBQUVBLFNBQVMsc0JBQXNCLE9BQW1CLFNBQW9DLGlCQUF5QixNQUF3QixPQUFlLG1CQUEwRDtBQUMvTSxRQUFNLGFBQWE7QUFBQSxJQUNsQixVQUFVLE1BQU07QUFBQSxJQUNoQixVQUFVO0FBQUEsSUFDVixNQUFNLE1BQU07QUFDWCxZQUFNLFNBQVMsa0JBQWtCLG9CQUFvQixNQUFNLEdBQUc7QUFDOUQsVUFBSSxDQUFDLFFBQVE7QUFDWixjQUFNLElBQUksTUFBTSwwQkFBMEI7QUFBQSxNQUMzQztBQUNBLGFBQU8sZ0JBQWdCLE9BQU8sUUFBUSxFQUFFO0FBQUEsSUFDekM7QUFBQSxJQUNBLE1BQU0sTUFBTTtBQUNYLFlBQU0sU0FBUyxrQkFBa0Isb0JBQW9CLE1BQU0sR0FBRztBQUM5RCxVQUFJLENBQUMsUUFBUTtBQUNaLGNBQU0sSUFBSSxNQUFNLDBCQUEwQjtBQUFBLE1BQzNDO0FBQ0EsYUFBTyxnQkFBZ0IsV0FBVyxPQUFPO0FBQUEsSUFDMUM7QUFBQSxJQUNBLFVBQVUsRUFBRSxtQkFBbUIsT0FBTyxPQUFPLFFBQVEsS0FBSztBQUFBLEVBQzNEO0FBRUEsU0FBTztBQUFBLElBQ04sWUFBWTtBQUFBLElBQ1o7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0EsZ0JBQWdCO0FBQUEsTUFDZixPQUFPLENBQUMsVUFBVTtBQUFBLElBQ25CO0FBQUEsRUFDRDtBQUNEO0FBRUEsU0FBUyxrQkFBa0IsTUFBb0Q7QUFDOUUsU0FBTztBQUFBLElBQ04sT0FBTyxDQUFDLElBQUk7QUFBQSxJQUNaLFNBQVMsTUFBTTtBQUFBLElBQUU7QUFBQSxFQUNsQjtBQUNEO0FBRU8sSUFBTSw0QkFBTixjQUF3QyxXQUFXO0FBQUEsRUFDekQsWUFDMkIseUJBQ04sbUJBQ0Qsa0JBQ0wsYUFDQyxjQUNNLG9CQUNSLFlBQ1o7QUFDRCxVQUFNO0FBQ04sU0FBSyxVQUFVLHdCQUF3QiwwQkFBMEIsU0FBUyxFQUFFLFFBQVEsY0FBYyxjQUFjLFNBQVMsS0FBSyxzQkFBc0IsS0FBSyxHQUFHLElBQUksbUJBQW1CLG1CQUFtQixrQkFBa0IsYUFBYSxvQkFBb0IsVUFBVSxDQUFDLENBQUM7QUFDclEsU0FBSyxVQUFVLHdCQUF3QiwwQkFBMEIsU0FBUyxFQUFFLFFBQVEsY0FBYyxjQUFjLFNBQVMsS0FBSyxzQkFBc0IsS0FBSyxHQUFHLElBQUksa0JBQWtCLG1CQUFtQixZQUFZLENBQUMsQ0FBQztBQUNuTixTQUFLLFVBQVUsd0JBQXdCLDBCQUEwQixTQUFTLEtBQUssSUFBSSxpQkFBaUIsQ0FBQyxDQUFDO0FBQUEsRUFDdkc7QUFDRDtBQWZhLDRCQUFOO0FBQUEsRUFFSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBUlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
