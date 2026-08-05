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
import { URI } from "../../../../base/common/uri.js";
import { Emitter } from "../../../../base/common/event.js";
import { basename } from "../../../../base/common/resources.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ChatPromptAttachmentsCollection } from "./chatAttachmentModel/chatPromptAttachmentsCollection.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { resizeImage } from "./imageUtils.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { localize } from "../../../../nls.js";
let ChatAttachmentModel = class extends Disposable {
  constructor(initService, fileService, dialogService) {
    super();
    this.initService = initService;
    this.fileService = fileService;
    this.dialogService = dialogService;
    this._attachments = /* @__PURE__ */ new Map();
    this._onDidChangeContext = this._register(new Emitter());
    this.onDidChangeContext = this._onDidChangeContext.event;
    this.promptInstructions = this._register(
      this.initService.createInstance(ChatPromptAttachmentsCollection)
    ).onUpdate(() => {
      this._onDidChangeContext.fire();
    });
  }
  get attachments() {
    return Array.from(this._attachments.values());
  }
  get size() {
    return this._attachments.size;
  }
  get fileAttachments() {
    return this.attachments.reduce((acc, file) => {
      if (file.isFile && URI.isUri(file.value)) {
        acc.push(file.value);
      }
      return acc;
    }, []);
  }
  getAttachmentIDs() {
    return new Set(this._attachments.keys());
  }
  clear() {
    this._attachments.clear();
    this._onDidChangeContext.fire();
  }
  delete(...variableEntryIds) {
    for (const variableEntryId of variableEntryIds) {
      this._attachments.delete(variableEntryId);
    }
    this._onDidChangeContext.fire();
  }
  async addFile(uri, range) {
    if (/\.(png|jpe?g|gif|bmp|webp)$/i.test(uri.path)) {
      this.addContext(await this.asImageVariableEntry(uri));
      return;
    }
    this.addContext(this.asVariableEntry(uri, range));
  }
  addFolder(uri) {
    this.addContext({
      value: uri,
      id: uri.toString(),
      name: basename(uri),
      isFile: false,
      isDirectory: true
    });
  }
  asVariableEntry(uri, range) {
    return {
      value: range ? { uri, range } : uri,
      id: uri.toString() + (range?.toString() ?? ""),
      name: basename(uri),
      isFile: true
    };
  }
  async asImageVariableEntry(uri) {
    const fileName = basename(uri);
    const readFile = await this.fileService.readFile(uri);
    if (readFile.size > 30 * 1024 * 1024) {
      this.dialogService.error(localize("imageTooLarge", "Image is too large"), localize("imageTooLargeMessage", "The image {0} is too large to be attached.", fileName));
      throw new Error("Image is too large");
    }
    const resizedImage = await resizeImage(readFile.value.buffer);
    return {
      id: uri.toString(),
      name: fileName,
      fullName: uri.path,
      value: resizedImage,
      isImage: true,
      isFile: false,
      references: [{ reference: uri, kind: "reference" }]
    };
  }
  addContext(...attachments) {
    let hasAdded = false;
    for (const attachment of attachments) {
      if (!this._attachments.has(attachment.id)) {
        this._attachments.set(attachment.id, attachment);
        hasAdded = true;
      }
    }
    if (hasAdded) {
      this._onDidChangeContext.fire();
    }
  }
  clearAndSetContext(...attachments) {
    this.clear();
    this.addContext(...attachments);
  }
};
ChatAttachmentModel = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IDialogService)
], ChatAttachmentModel);
export {
  ChatAttachmentModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEF0dGFjaG1lbnRNb2RlbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSB9IGZyb20gJy4uL2NvbW1vbi9jaGF0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBDaGF0UHJvbXB0QXR0YWNobWVudHNDb2xsZWN0aW9uIH0gZnJvbSAnLi9jaGF0QXR0YWNobWVudE1vZGVsL2NoYXRQcm9tcHRBdHRhY2htZW50c0NvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IHJlc2l6ZUltYWdlIH0gZnJvbSAnLi9pbWFnZVV0aWxzLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBDaGF0QXR0YWNobWVudE1vZGVsIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdC8qKlxuXHQgKiBDb2xsZWN0aW9uIG9uIHByb21wdCBpbnN0cnVjdGlvbiBhdHRhY2htZW50cy5cblx0ICovXG5cdHB1YmxpYyByZWFkb25seSBwcm9tcHRJbnN0cnVjdGlvbnM6IENoYXRQcm9tcHRBdHRhY2htZW50c0NvbGxlY3Rpb247XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluaXRTZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnByb21wdEluc3RydWN0aW9ucyA9IHRoaXMuX3JlZ2lzdGVyKFxuXHRcdFx0dGhpcy5pbml0U2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0UHJvbXB0QXR0YWNobWVudHNDb2xsZWN0aW9uKSxcblx0XHQpLm9uVXBkYXRlKCgpID0+IHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGV4dC5maXJlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9hdHRhY2htZW50cyA9IG5ldyBNYXA8c3RyaW5nLCBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5PigpO1xuXHRnZXQgYXR0YWNobWVudHMoKTogUmVhZG9ubHlBcnJheTxJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5PiB7XG5cdFx0cmV0dXJuIEFycmF5LmZyb20odGhpcy5fYXR0YWNobWVudHMudmFsdWVzKCkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9vbkRpZENoYW5nZUNvbnRleHQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb250ZXh0ID0gdGhpcy5fb25EaWRDaGFuZ2VDb250ZXh0LmV2ZW50O1xuXG5cdGdldCBzaXplKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2F0dGFjaG1lbnRzLnNpemU7XG5cdH1cblxuXHRnZXQgZmlsZUF0dGFjaG1lbnRzKCk6IFVSSVtdIHtcblx0XHRyZXR1cm4gdGhpcy5hdHRhY2htZW50cy5yZWR1Y2U8VVJJW10+KChhY2MsIGZpbGUpID0+IHtcblx0XHRcdGlmIChmaWxlLmlzRmlsZSAmJiBVUkkuaXNVcmkoZmlsZS52YWx1ZSkpIHtcblx0XHRcdFx0YWNjLnB1c2goZmlsZS52YWx1ZSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYWNjO1xuXHRcdH0sIFtdKTtcblx0fVxuXG5cdGdldEF0dGFjaG1lbnRJRHMoKSB7XG5cdFx0cmV0dXJuIG5ldyBTZXQodGhpcy5fYXR0YWNobWVudHMua2V5cygpKTtcblx0fVxuXG5cdGNsZWFyKCk6IHZvaWQge1xuXHRcdHRoaXMuX2F0dGFjaG1lbnRzLmNsZWFyKCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZXh0LmZpcmUoKTtcblx0fVxuXG5cdGRlbGV0ZSguLi52YXJpYWJsZUVudHJ5SWRzOiBzdHJpbmdbXSkge1xuXHRcdGZvciAoY29uc3QgdmFyaWFibGVFbnRyeUlkIG9mIHZhcmlhYmxlRW50cnlJZHMpIHtcblx0XHRcdHRoaXMuX2F0dGFjaG1lbnRzLmRlbGV0ZSh2YXJpYWJsZUVudHJ5SWQpO1xuXHRcdH1cblx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbnRleHQuZmlyZSgpO1xuXHR9XG5cblx0YXN5bmMgYWRkRmlsZSh1cmk6IFVSSSwgcmFuZ2U/OiBJUmFuZ2UpIHtcblx0XHRpZiAoL1xcLihwbmd8anBlP2d8Z2lmfGJtcHx3ZWJwKSQvaS50ZXN0KHVyaS5wYXRoKSkge1xuXHRcdFx0dGhpcy5hZGRDb250ZXh0KGF3YWl0IHRoaXMuYXNJbWFnZVZhcmlhYmxlRW50cnkodXJpKSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5hZGRDb250ZXh0KHRoaXMuYXNWYXJpYWJsZUVudHJ5KHVyaSwgcmFuZ2UpKTtcblx0fVxuXG5cdGFkZEZvbGRlcih1cmk6IFVSSSkge1xuXHRcdHRoaXMuYWRkQ29udGV4dCh7XG5cdFx0XHR2YWx1ZTogdXJpLFxuXHRcdFx0aWQ6IHVyaS50b1N0cmluZygpLFxuXHRcdFx0bmFtZTogYmFzZW5hbWUodXJpKSxcblx0XHRcdGlzRmlsZTogZmFsc2UsXG5cdFx0XHRpc0RpcmVjdG9yeTogdHJ1ZSxcblx0XHR9KTtcblx0fVxuXG5cdGFzVmFyaWFibGVFbnRyeSh1cmk6IFVSSSwgcmFuZ2U/OiBJUmFuZ2UpOiBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dmFsdWU6IHJhbmdlID8geyB1cmksIHJhbmdlIH0gOiB1cmksXG5cdFx0XHRpZDogdXJpLnRvU3RyaW5nKCkgKyAocmFuZ2U/LnRvU3RyaW5nKCkgPz8gJycpLFxuXHRcdFx0bmFtZTogYmFzZW5hbWUodXJpKSxcblx0XHRcdGlzRmlsZTogdHJ1ZSxcblx0XHR9O1xuXHR9XG5cblx0YXN5bmMgYXNJbWFnZVZhcmlhYmxlRW50cnkodXJpOiBVUkkpOiBQcm9taXNlPElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnk+IHtcblx0XHRjb25zdCBmaWxlTmFtZSA9IGJhc2VuYW1lKHVyaSk7XG5cdFx0Y29uc3QgcmVhZEZpbGUgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKHVyaSk7XG5cdFx0aWYgKHJlYWRGaWxlLnNpemUgPiAzMCAqIDEwMjQgKiAxMDI0KSB7IC8vIDMwIE1CXG5cdFx0XHR0aGlzLmRpYWxvZ1NlcnZpY2UuZXJyb3IobG9jYWxpemUoJ2ltYWdlVG9vTGFyZ2UnLCAnSW1hZ2UgaXMgdG9vIGxhcmdlJyksIGxvY2FsaXplKCdpbWFnZVRvb0xhcmdlTWVzc2FnZScsICdUaGUgaW1hZ2UgezB9IGlzIHRvbyBsYXJnZSB0byBiZSBhdHRhY2hlZC4nLCBmaWxlTmFtZSkpO1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbWFnZSBpcyB0b28gbGFyZ2UnKTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzaXplZEltYWdlID0gYXdhaXQgcmVzaXplSW1hZ2UocmVhZEZpbGUudmFsdWUuYnVmZmVyKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aWQ6IHVyaS50b1N0cmluZygpLFxuXHRcdFx0bmFtZTogZmlsZU5hbWUsXG5cdFx0XHRmdWxsTmFtZTogdXJpLnBhdGgsXG5cdFx0XHR2YWx1ZTogcmVzaXplZEltYWdlLFxuXHRcdFx0aXNJbWFnZTogdHJ1ZSxcblx0XHRcdGlzRmlsZTogZmFsc2UsXG5cdFx0XHRyZWZlcmVuY2VzOiBbeyByZWZlcmVuY2U6IHVyaSwga2luZDogJ3JlZmVyZW5jZScgfV1cblx0XHR9O1xuXHR9XG5cblx0YWRkQ29udGV4dCguLi5hdHRhY2htZW50czogSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeVtdKSB7XG5cdFx0bGV0IGhhc0FkZGVkID0gZmFsc2U7XG5cblx0XHRmb3IgKGNvbnN0IGF0dGFjaG1lbnQgb2YgYXR0YWNobWVudHMpIHtcblx0XHRcdGlmICghdGhpcy5fYXR0YWNobWVudHMuaGFzKGF0dGFjaG1lbnQuaWQpKSB7XG5cdFx0XHRcdHRoaXMuX2F0dGFjaG1lbnRzLnNldChhdHRhY2htZW50LmlkLCBhdHRhY2htZW50KTtcblx0XHRcdFx0aGFzQWRkZWQgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChoYXNBZGRlZCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZXh0LmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRjbGVhckFuZFNldENvbnRleHQoLi4uYXR0YWNobWVudHM6IElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnlbXSkge1xuXHRcdHRoaXMuY2xlYXIoKTtcblx0XHR0aGlzLmFkZENvbnRleHQoLi4uYXR0YWNobWVudHMpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsV0FBVztBQUNwQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBZ0I7QUFFbEIsSUFBTSxzQkFBTixjQUFrQyxXQUFXO0FBQUEsRUFNbkQsWUFDeUMsYUFDVCxhQUNFLGVBQ2hDO0FBQ0QsVUFBTTtBQUprQztBQUNUO0FBQ0U7QUFXbEMsU0FBUSxlQUFlLG9CQUFJLElBQXVDO0FBS2xFLFNBQVUsc0JBQXNCLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUNsRSxTQUFTLHFCQUFxQixLQUFLLG9CQUFvQjtBQWJ0RCxTQUFLLHFCQUFxQixLQUFLO0FBQUEsTUFDOUIsS0FBSyxZQUFZLGVBQWUsK0JBQStCO0FBQUEsSUFDaEUsRUFBRSxTQUFTLE1BQU07QUFDaEIsV0FBSyxvQkFBb0IsS0FBSztBQUFBLElBQy9CLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFHQSxJQUFJLGNBQXdEO0FBQzNELFdBQU8sTUFBTSxLQUFLLEtBQUssYUFBYSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBS0EsSUFBSSxPQUFlO0FBQ2xCLFdBQU8sS0FBSyxhQUFhO0FBQUEsRUFDMUI7QUFBQSxFQUVBLElBQUksa0JBQXlCO0FBQzVCLFdBQU8sS0FBSyxZQUFZLE9BQWMsQ0FBQyxLQUFLLFNBQVM7QUFDcEQsVUFBSSxLQUFLLFVBQVUsSUFBSSxNQUFNLEtBQUssS0FBSyxHQUFHO0FBQ3pDLFlBQUksS0FBSyxLQUFLLEtBQUs7QUFBQSxNQUNwQjtBQUNBLGFBQU87QUFBQSxJQUNSLEdBQUcsQ0FBQyxDQUFDO0FBQUEsRUFDTjtBQUFBLEVBRUEsbUJBQW1CO0FBQ2xCLFdBQU8sSUFBSSxJQUFJLEtBQUssYUFBYSxLQUFLLENBQUM7QUFBQSxFQUN4QztBQUFBLEVBRUEsUUFBYztBQUNiLFNBQUssYUFBYSxNQUFNO0FBQ3hCLFNBQUssb0JBQW9CLEtBQUs7QUFBQSxFQUMvQjtBQUFBLEVBRUEsVUFBVSxrQkFBNEI7QUFDckMsZUFBVyxtQkFBbUIsa0JBQWtCO0FBQy9DLFdBQUssYUFBYSxPQUFPLGVBQWU7QUFBQSxJQUN6QztBQUNBLFNBQUssb0JBQW9CLEtBQUs7QUFBQSxFQUMvQjtBQUFBLEVBRUEsTUFBTSxRQUFRLEtBQVUsT0FBZ0I7QUFDdkMsUUFBSSwrQkFBK0IsS0FBSyxJQUFJLElBQUksR0FBRztBQUNsRCxXQUFLLFdBQVcsTUFBTSxLQUFLLHFCQUFxQixHQUFHLENBQUM7QUFDcEQ7QUFBQSxJQUNEO0FBRUEsU0FBSyxXQUFXLEtBQUssZ0JBQWdCLEtBQUssS0FBSyxDQUFDO0FBQUEsRUFDakQ7QUFBQSxFQUVBLFVBQVUsS0FBVTtBQUNuQixTQUFLLFdBQVc7QUFBQSxNQUNmLE9BQU87QUFBQSxNQUNQLElBQUksSUFBSSxTQUFTO0FBQUEsTUFDakIsTUFBTSxTQUFTLEdBQUc7QUFBQSxNQUNsQixRQUFRO0FBQUEsTUFDUixhQUFhO0FBQUEsSUFDZCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsZ0JBQWdCLEtBQVUsT0FBMkM7QUFDcEUsV0FBTztBQUFBLE1BQ04sT0FBTyxRQUFRLEVBQUUsS0FBSyxNQUFNLElBQUk7QUFBQSxNQUNoQyxJQUFJLElBQUksU0FBUyxLQUFLLE9BQU8sU0FBUyxLQUFLO0FBQUEsTUFDM0MsTUFBTSxTQUFTLEdBQUc7QUFBQSxNQUNsQixRQUFRO0FBQUEsSUFDVDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQU0scUJBQXFCLEtBQThDO0FBQ3hFLFVBQU0sV0FBVyxTQUFTLEdBQUc7QUFDN0IsVUFBTSxXQUFXLE1BQU0sS0FBSyxZQUFZLFNBQVMsR0FBRztBQUNwRCxRQUFJLFNBQVMsT0FBTyxLQUFLLE9BQU8sTUFBTTtBQUNyQyxXQUFLLGNBQWMsTUFBTSxTQUFTLGlCQUFpQixvQkFBb0IsR0FBRyxTQUFTLHdCQUF3Qiw4Q0FBOEMsUUFBUSxDQUFDO0FBQ2xLLFlBQU0sSUFBSSxNQUFNLG9CQUFvQjtBQUFBLElBQ3JDO0FBQ0EsVUFBTSxlQUFlLE1BQU0sWUFBWSxTQUFTLE1BQU0sTUFBTTtBQUM1RCxXQUFPO0FBQUEsTUFDTixJQUFJLElBQUksU0FBUztBQUFBLE1BQ2pCLE1BQU07QUFBQSxNQUNOLFVBQVUsSUFBSTtBQUFBLE1BQ2QsT0FBTztBQUFBLE1BQ1AsU0FBUztBQUFBLE1BQ1QsUUFBUTtBQUFBLE1BQ1IsWUFBWSxDQUFDLEVBQUUsV0FBVyxLQUFLLE1BQU0sWUFBWSxDQUFDO0FBQUEsSUFDbkQ7QUFBQSxFQUNEO0FBQUEsRUFFQSxjQUFjLGFBQTBDO0FBQ3ZELFFBQUksV0FBVztBQUVmLGVBQVcsY0FBYyxhQUFhO0FBQ3JDLFVBQUksQ0FBQyxLQUFLLGFBQWEsSUFBSSxXQUFXLEVBQUUsR0FBRztBQUMxQyxhQUFLLGFBQWEsSUFBSSxXQUFXLElBQUksVUFBVTtBQUMvQyxtQkFBVztBQUFBLE1BQ1o7QUFBQSxJQUNEO0FBRUEsUUFBSSxVQUFVO0FBQ2IsV0FBSyxvQkFBb0IsS0FBSztBQUFBLElBQy9CO0FBQUEsRUFDRDtBQUFBLEVBRUEsc0JBQXNCLGFBQTBDO0FBQy9ELFNBQUssTUFBTTtBQUNYLFNBQUssV0FBVyxHQUFHLFdBQVc7QUFBQSxFQUMvQjtBQUNEO0FBM0hhLHNCQUFOO0FBQUEsRUFPSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FUVTsiLAogICJuYW1lcyI6IFtdCn0K
