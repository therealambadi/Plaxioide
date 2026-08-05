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
import { EditorInputCapabilities, DEFAULT_EDITOR_ASSOCIATION, findViewStateForEditor, isResourceEditorInput } from "../../../../common/editor.js";
import { AbstractTextResourceEditorInput } from "../../../../common/editor/textResourceEditorInput.js";
import { BinaryEditorModel } from "../../../../common/editor/binaryEditorModel.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { ITextFileService, TextFileEditorModelState, TextFileResolveReason, TextFileOperationResult } from "../../../../services/textfile/common/textfiles.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { dispose, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { FILE_EDITOR_INPUT_ID, TEXT_FILE_EDITOR_ID, BINARY_FILE_EDITOR_ID } from "../../common/files.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IFilesConfigurationService } from "../../../../services/filesConfiguration/common/filesConfigurationService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { Event } from "../../../../../base/common/event.js";
import { Schemas } from "../../../../../base/common/network.js";
import { createTextBufferFactory } from "../../../../../editor/common/model/textModel.js";
import { IPathService } from "../../../../services/path/common/pathService.js";
import { ITextResourceConfigurationService } from "../../../../../editor/common/services/textResourceConfiguration.js";
import { ICustomEditorLabelService } from "../../../../services/editor/common/customEditorLabelService.js";
var ForceOpenAs = /* @__PURE__ */ ((ForceOpenAs2) => {
  ForceOpenAs2[ForceOpenAs2["None"] = 0] = "None";
  ForceOpenAs2[ForceOpenAs2["Text"] = 1] = "Text";
  ForceOpenAs2[ForceOpenAs2["Binary"] = 2] = "Binary";
  return ForceOpenAs2;
})(ForceOpenAs || {});
let FileEditorInput = class extends AbstractTextResourceEditorInput {
  constructor(resource, preferredResource, preferredName, preferredDescription, preferredEncoding, preferredLanguageId, preferredContents, instantiationService, textFileService, textModelService, labelService, fileService, filesConfigurationService, editorService, pathService, textResourceConfigurationService, customEditorLabelService) {
    super(resource, preferredResource, editorService, textFileService, labelService, fileService, filesConfigurationService, textResourceConfigurationService, customEditorLabelService);
    this.instantiationService = instantiationService;
    this.textModelService = textModelService;
    this.pathService = pathService;
    this.forceOpenAs = 0 /* None */;
    this.model = void 0;
    this.cachedTextFileModelReference = void 0;
    this.modelListeners = this._register(new DisposableStore());
    this.model = this.textFileService.files.get(resource);
    if (preferredName) {
      this.setPreferredName(preferredName);
    }
    if (preferredDescription) {
      this.setPreferredDescription(preferredDescription);
    }
    if (preferredEncoding) {
      this.setPreferredEncoding(preferredEncoding);
    }
    if (preferredLanguageId) {
      this.setPreferredLanguageId(preferredLanguageId);
    }
    if (typeof preferredContents === "string") {
      this.setPreferredContents(preferredContents);
    }
    this._register(this.textFileService.files.onDidCreate((model) => this.onDidCreateTextFileModel(model)));
    if (this.model) {
      this.registerModelListeners(this.model);
    }
  }
  get typeId() {
    return FILE_EDITOR_INPUT_ID;
  }
  get editorId() {
    return DEFAULT_EDITOR_ASSOCIATION.id;
  }
  get capabilities() {
    let capabilities = EditorInputCapabilities.CanSplitInGroup;
    if (this.model) {
      if (this.model.isReadonly()) {
        capabilities |= EditorInputCapabilities.Readonly;
      }
    } else {
      if (this.fileService.hasProvider(this.resource)) {
        if (this.filesConfigurationService.isReadonly(this.resource)) {
          capabilities |= EditorInputCapabilities.Readonly;
        }
      } else {
        capabilities |= EditorInputCapabilities.Untitled;
      }
    }
    if (!(capabilities & EditorInputCapabilities.Readonly)) {
      capabilities |= EditorInputCapabilities.CanDropIntoEditor;
    }
    return capabilities;
  }
  onDidCreateTextFileModel(model) {
    if (isEqual(model.resource, this.resource)) {
      this.model = model;
      this.registerModelListeners(model);
    }
  }
  registerModelListeners(model) {
    this.modelListeners.clear();
    this.modelListeners.add(model.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
    this.modelListeners.add(model.onDidChangeReadonly(() => this._onDidChangeCapabilities.fire()));
    this.modelListeners.add(model.onDidSaveError(() => this._onDidChangeDirty.fire()));
    this.modelListeners.add(Event.once(model.onWillDispose)(() => {
      this.modelListeners.clear();
      this.model = void 0;
    }));
  }
  getName() {
    return this.preferredName || super.getName();
  }
  setPreferredName(name) {
    if (!this.allowLabelOverride()) {
      return;
    }
    if (this.preferredName !== name) {
      this.preferredName = name;
      this._onDidChangeLabel.fire();
    }
  }
  allowLabelOverride() {
    return this.resource.scheme !== this.pathService.defaultUriScheme && this.resource.scheme !== Schemas.vscodeUserData && this.resource.scheme !== Schemas.file && this.resource.scheme !== Schemas.vscodeRemote;
  }
  getPreferredName() {
    return this.preferredName;
  }
  isReadonly() {
    return this.model ? this.model.isReadonly() : this.filesConfigurationService.isReadonly(this.resource);
  }
  getDescription(verbosity) {
    return this.preferredDescription || super.getDescription(verbosity);
  }
  setPreferredDescription(description) {
    if (!this.allowLabelOverride()) {
      return;
    }
    if (this.preferredDescription !== description) {
      this.preferredDescription = description;
      this._onDidChangeLabel.fire();
    }
  }
  getPreferredDescription() {
    return this.preferredDescription;
  }
  getTitle(verbosity) {
    let title = super.getTitle(verbosity);
    const preferredTitle = this.getPreferredTitle();
    if (preferredTitle) {
      title = `${preferredTitle} (${title})`;
    }
    return title;
  }
  getPreferredTitle() {
    if (this.preferredName && this.preferredDescription) {
      return `${this.preferredName} ${this.preferredDescription}`;
    }
    if (this.preferredName || this.preferredDescription) {
      return this.preferredName ?? this.preferredDescription;
    }
    return void 0;
  }
  getEncoding() {
    if (this.model) {
      return this.model.getEncoding();
    }
    return this.preferredEncoding;
  }
  getPreferredEncoding() {
    return this.preferredEncoding;
  }
  async setEncoding(encoding, mode) {
    this.setPreferredEncoding(encoding);
    return this.model?.setEncoding(encoding, mode);
  }
  setPreferredEncoding(encoding) {
    this.preferredEncoding = encoding;
    this.setForceOpenAsText();
  }
  getLanguageId() {
    if (this.model) {
      return this.model.getLanguageId();
    }
    return this.preferredLanguageId;
  }
  getPreferredLanguageId() {
    return this.preferredLanguageId;
  }
  setLanguageId(languageId, source) {
    this.setPreferredLanguageId(languageId);
    this.model?.setLanguageId(languageId, source);
  }
  setPreferredLanguageId(languageId) {
    this.preferredLanguageId = languageId;
    this.setForceOpenAsText();
  }
  setPreferredContents(contents) {
    this.preferredContents = contents;
    this.setForceOpenAsText();
  }
  setForceOpenAsText() {
    this.forceOpenAs = 1 /* Text */;
  }
  setForceOpenAsBinary() {
    this.forceOpenAs = 2 /* Binary */;
  }
  isDirty() {
    return !!this.model?.isDirty();
  }
  isSaving() {
    if (this.model?.hasState(TextFileEditorModelState.SAVED) || this.model?.hasState(TextFileEditorModelState.CONFLICT) || this.model?.hasState(TextFileEditorModelState.ERROR)) {
      return false;
    }
    if (this.filesConfigurationService.hasShortAutoSaveDelay(this)) {
      return true;
    }
    return super.isSaving();
  }
  prefersEditorPane(editorPanes) {
    if (this.forceOpenAs === 2 /* Binary */) {
      return editorPanes.find((editorPane) => editorPane.typeId === BINARY_FILE_EDITOR_ID);
    }
    return editorPanes.find((editorPane) => editorPane.typeId === TEXT_FILE_EDITOR_ID);
  }
  resolve(options) {
    if (this.forceOpenAs === 2 /* Binary */) {
      return this.doResolveAsBinary();
    }
    return this.doResolveAsText(options);
  }
  async doResolveAsText(options) {
    try {
      const preferredContents = this.preferredContents;
      this.preferredContents = void 0;
      await this.textFileService.files.resolve(this.resource, {
        languageId: this.preferredLanguageId,
        encoding: this.preferredEncoding,
        contents: typeof preferredContents === "string" ? createTextBufferFactory(preferredContents) : void 0,
        reload: { async: true },
        // trigger a reload of the model if it exists already but do not wait to show the model
        allowBinary: this.forceOpenAs === 1 /* Text */,
        reason: TextFileResolveReason.EDITOR,
        limits: this.ensureLimits(options)
      });
      if (!this.cachedTextFileModelReference) {
        this.cachedTextFileModelReference = await this.textModelService.createModelReference(this.resource);
      }
      const model = this.cachedTextFileModelReference.object;
      if (this.isDisposed()) {
        this.disposeModelReference();
      }
      return model;
    } catch (error) {
      if (error.textFileOperationResult === TextFileOperationResult.FILE_IS_BINARY) {
        return this.doResolveAsBinary();
      }
      throw error;
    }
  }
  async doResolveAsBinary() {
    const model = this.instantiationService.createInstance(BinaryEditorModel, this.preferredResource, this.getName());
    await model.resolve();
    return model;
  }
  isResolved() {
    return !!this.model;
  }
  async rename(group, target) {
    return {
      editor: {
        resource: target,
        encoding: this.getEncoding(),
        options: {
          viewState: findViewStateForEditor(this, group, this.editorService)
        }
      }
    };
  }
  toUntyped(options) {
    const untypedInput = {
      resource: this.preferredResource,
      forceFile: true,
      options: {
        override: this.editorId
      }
    };
    if (typeof options?.preserveViewState === "number") {
      untypedInput.encoding = this.getEncoding();
      untypedInput.languageId = this.getLanguageId();
      untypedInput.contents = (() => {
        const model = this.textFileService.files.get(this.resource);
        if (model?.isDirty() && !model.textEditorModel.isTooLargeForHeapOperation()) {
          return model.textEditorModel.getValue();
        }
        return void 0;
      })();
      untypedInput.options = {
        ...untypedInput.options,
        viewState: findViewStateForEditor(this, options.preserveViewState, this.editorService)
      };
    }
    return untypedInput;
  }
  matches(otherInput) {
    if (this === otherInput) {
      return true;
    }
    if (otherInput instanceof FileEditorInput) {
      return isEqual(otherInput.resource, this.resource);
    }
    if (isResourceEditorInput(otherInput)) {
      return super.matches(otherInput);
    }
    return false;
  }
  dispose() {
    this.model = void 0;
    this.disposeModelReference();
    super.dispose();
  }
  disposeModelReference() {
    dispose(this.cachedTextFileModelReference);
    this.cachedTextFileModelReference = void 0;
  }
};
FileEditorInput = __decorateClass([
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, ITextFileService),
  __decorateParam(9, ITextModelService),
  __decorateParam(10, ILabelService),
  __decorateParam(11, IFileService),
  __decorateParam(12, IFilesConfigurationService),
  __decorateParam(13, IEditorService),
  __decorateParam(14, IPathService),
  __decorateParam(15, ITextResourceConfigurationService),
  __decorateParam(16, ICustomEditorLabelService)
], FileEditorInput);
export {
  FileEditorInput
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL2VkaXRvcnMvZmlsZUVkaXRvcklucHV0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElGaWxlRWRpdG9ySW5wdXQsIFZlcmJvc2l0eSwgR3JvdXBJZGVudGlmaWVyLCBJTW92ZVJlc3VsdCwgRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMsIElFZGl0b3JEZXNjcmlwdG9yLCBJRWRpdG9yUGFuZSwgSVVudHlwZWRFZGl0b3JJbnB1dCwgREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04sIElVbnR5cGVkRmlsZUVkaXRvcklucHV0LCBmaW5kVmlld1N0YXRlRm9yRWRpdG9yLCBpc1Jlc291cmNlRWRpdG9ySW5wdXQsIElGaWxlRWRpdG9ySW5wdXRPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCwgSVVudHlwZWRFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdFRleHRSZXNvdXJjZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci90ZXh0UmVzb3VyY2VFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJVGV4dFJlc291cmNlRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBCaW5hcnlFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvYmluYXJ5RWRpdG9yTW9kZWwuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElUZXh0RmlsZVNlcnZpY2UsIFRleHRGaWxlRWRpdG9yTW9kZWxTdGF0ZSwgVGV4dEZpbGVSZXNvbHZlUmVhc29uLCBUZXh0RmlsZU9wZXJhdGlvbkVycm9yLCBUZXh0RmlsZU9wZXJhdGlvblJlc3VsdCwgSVRleHRGaWxlRWRpdG9yTW9kZWwsIEVuY29kaW5nTW9kZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3RleHRmaWxlL2NvbW1vbi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmVmZXJlbmNlLCBkaXNwb3NlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBGSUxFX0VESVRPUl9JTlBVVF9JRCwgVEVYVF9GSUxFX0VESVRPUl9JRCwgQklOQVJZX0ZJTEVfRURJVE9SX0lEIH0gZnJvbSAnLi4vLi4vY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9maWxlc0NvbmZpZ3VyYXRpb24vY29tbW9uL2ZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSVBhdGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvcGF0aC9jb21tb24vcGF0aFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IElDdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2N1c3RvbUVkaXRvckxhYmVsU2VydmljZS5qcyc7XG5cbmNvbnN0IGVudW0gRm9yY2VPcGVuQXMge1xuXHROb25lLFxuXHRUZXh0LFxuXHRCaW5hcnlcbn1cblxuLyoqXG4gKiBBIGZpbGUgZWRpdG9yIGlucHV0IGlzIHRoZSBpbnB1dCB0eXBlIGZvciB0aGUgZmlsZSBlZGl0b3Igb2YgZmlsZSBzeXN0ZW0gcmVzb3VyY2VzLlxuICovXG5leHBvcnQgY2xhc3MgRmlsZUVkaXRvcklucHV0IGV4dGVuZHMgQWJzdHJhY3RUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCBpbXBsZW1lbnRzIElGaWxlRWRpdG9ySW5wdXQge1xuXG5cdG92ZXJyaWRlIGdldCB0eXBlSWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gRklMRV9FRElUT1JfSU5QVVRfSUQ7XG5cdH1cblxuXHRvdmVycmlkZSBnZXQgZWRpdG9ySWQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04uaWQ7XG5cdH1cblxuXHRvdmVycmlkZSBnZXQgY2FwYWJpbGl0aWVzKCk6IEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzIHtcblx0XHRsZXQgY2FwYWJpbGl0aWVzID0gRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuQ2FuU3BsaXRJbkdyb3VwO1xuXG5cdFx0aWYgKHRoaXMubW9kZWwpIHtcblx0XHRcdGlmICh0aGlzLm1vZGVsLmlzUmVhZG9ubHkoKSkge1xuXHRcdFx0XHRjYXBhYmlsaXRpZXMgfD0gRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuUmVhZG9ubHk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0aGlzLmZpbGVTZXJ2aWNlLmhhc1Byb3ZpZGVyKHRoaXMucmVzb3VyY2UpKSB7XG5cdFx0XHRcdGlmICh0aGlzLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuaXNSZWFkb25seSh0aGlzLnJlc291cmNlKSkge1xuXHRcdFx0XHRcdGNhcGFiaWxpdGllcyB8PSBFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5SZWFkb25seTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y2FwYWJpbGl0aWVzIHw9IEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLlVudGl0bGVkO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghKGNhcGFiaWxpdGllcyAmIEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLlJlYWRvbmx5KSkge1xuXHRcdFx0Y2FwYWJpbGl0aWVzIHw9IEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLkNhbkRyb3BJbnRvRWRpdG9yO1xuXHRcdH1cblxuXHRcdHJldHVybiBjYXBhYmlsaXRpZXM7XG5cdH1cblxuXHRwcml2YXRlIHByZWZlcnJlZE5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBwcmVmZXJyZWREZXNjcmlwdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHByZWZlcnJlZEVuY29kaW5nOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcHJlZmVycmVkTGFuZ3VhZ2VJZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHByZWZlcnJlZENvbnRlbnRzOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBmb3JjZU9wZW5BczogRm9yY2VPcGVuQXMgPSBGb3JjZU9wZW5Bcy5Ob25lO1xuXG5cdHByaXZhdGUgbW9kZWw6IElUZXh0RmlsZUVkaXRvck1vZGVsIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNhY2hlZFRleHRGaWxlTW9kZWxSZWZlcmVuY2U6IElSZWZlcmVuY2U8SVRleHRGaWxlRWRpdG9yTW9kZWw+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbW9kZWxMaXN0ZW5lcnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlc291cmNlOiBVUkksXG5cdFx0cHJlZmVycmVkUmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCxcblx0XHRwcmVmZXJyZWROYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0cHJlZmVycmVkRGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRwcmVmZXJyZWRFbmNvZGluZzogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdHByZWZlcnJlZExhbmd1YWdlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRwcmVmZXJyZWRDb250ZW50czogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGV4dEZpbGVTZXJ2aWNlIHRleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0TW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSBmaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElQYXRoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHBhdGhTZXJ2aWNlOiBJUGF0aFNlcnZpY2UsXG5cdFx0QElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSB0ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZTogSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlIGN1c3RvbUVkaXRvckxhYmVsU2VydmljZTogSUN1c3RvbUVkaXRvckxhYmVsU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihyZXNvdXJjZSwgcHJlZmVycmVkUmVzb3VyY2UsIGVkaXRvclNlcnZpY2UsIHRleHRGaWxlU2VydmljZSwgbGFiZWxTZXJ2aWNlLCBmaWxlU2VydmljZSwgZmlsZXNDb25maWd1cmF0aW9uU2VydmljZSwgdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsIGN1c3RvbUVkaXRvckxhYmVsU2VydmljZSk7XG5cblx0XHR0aGlzLm1vZGVsID0gdGhpcy50ZXh0RmlsZVNlcnZpY2UuZmlsZXMuZ2V0KHJlc291cmNlKTtcblxuXHRcdGlmIChwcmVmZXJyZWROYW1lKSB7XG5cdFx0XHR0aGlzLnNldFByZWZlcnJlZE5hbWUocHJlZmVycmVkTmFtZSk7XG5cdFx0fVxuXG5cdFx0aWYgKHByZWZlcnJlZERlc2NyaXB0aW9uKSB7XG5cdFx0XHR0aGlzLnNldFByZWZlcnJlZERlc2NyaXB0aW9uKHByZWZlcnJlZERlc2NyaXB0aW9uKTtcblx0XHR9XG5cblx0XHRpZiAocHJlZmVycmVkRW5jb2RpbmcpIHtcblx0XHRcdHRoaXMuc2V0UHJlZmVycmVkRW5jb2RpbmcocHJlZmVycmVkRW5jb2RpbmcpO1xuXHRcdH1cblxuXHRcdGlmIChwcmVmZXJyZWRMYW5ndWFnZUlkKSB7XG5cdFx0XHR0aGlzLnNldFByZWZlcnJlZExhbmd1YWdlSWQocHJlZmVycmVkTGFuZ3VhZ2VJZCk7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBwcmVmZXJyZWRDb250ZW50cyA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRoaXMuc2V0UHJlZmVycmVkQ29udGVudHMocHJlZmVycmVkQ29udGVudHMpO1xuXHRcdH1cblxuXHRcdC8vIEF0dGFjaCB0byBtb2RlbCB0aGF0IG1hdGNoZXMgb3VyIHJlc291cmNlIG9uY2UgY3JlYXRlZFxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudGV4dEZpbGVTZXJ2aWNlLmZpbGVzLm9uRGlkQ3JlYXRlKG1vZGVsID0+IHRoaXMub25EaWRDcmVhdGVUZXh0RmlsZU1vZGVsKG1vZGVsKSkpO1xuXG5cdFx0Ly8gSWYgYSBmaWxlIG1vZGVsIGFscmVhZHkgZXhpc3RzLCBtYWtlIHN1cmUgdG8gd2lyZSBpdCBpblxuXHRcdGlmICh0aGlzLm1vZGVsKSB7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyTW9kZWxMaXN0ZW5lcnModGhpcy5tb2RlbCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENyZWF0ZVRleHRGaWxlTW9kZWwobW9kZWw6IElUZXh0RmlsZUVkaXRvck1vZGVsKTogdm9pZCB7XG5cblx0XHQvLyBPbmNlIHRoZSB0ZXh0IGZpbGUgbW9kZWwgaXMgY3JlYXRlZCwgd2Uga2VlcCBpdCBpbnNpZGVcblx0XHQvLyB0aGUgaW5wdXQgdG8gYmUgYWJsZSB0byBpbXBsZW1lbnQgc29tZSBtZXRob2RzIHByb3Blcmx5XG5cdFx0aWYgKGlzRXF1YWwobW9kZWwucmVzb3VyY2UsIHRoaXMucmVzb3VyY2UpKSB7XG5cdFx0XHR0aGlzLm1vZGVsID0gbW9kZWw7XG5cblx0XHRcdHRoaXMucmVnaXN0ZXJNb2RlbExpc3RlbmVycyhtb2RlbCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlck1vZGVsTGlzdGVuZXJzKG1vZGVsOiBJVGV4dEZpbGVFZGl0b3JNb2RlbCk6IHZvaWQge1xuXG5cdFx0Ly8gQ2xlYXIgYW55IG9sZFxuXHRcdHRoaXMubW9kZWxMaXN0ZW5lcnMuY2xlYXIoKTtcblxuXHRcdC8vIHJlLWVtaXQgc29tZSBldmVudHMgZnJvbSB0aGUgbW9kZWxcblx0XHR0aGlzLm1vZGVsTGlzdGVuZXJzLmFkZChtb2RlbC5vbkRpZENoYW5nZURpcnR5KCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlRGlydHkuZmlyZSgpKSk7XG5cdFx0dGhpcy5tb2RlbExpc3RlbmVycy5hZGQobW9kZWwub25EaWRDaGFuZ2VSZWFkb25seSgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUNhcGFiaWxpdGllcy5maXJlKCkpKTtcblxuXHRcdC8vIGltcG9ydGFudDogdHJlYXQgc2F2ZSBlcnJvcnMgYXMgcG90ZW50aWFsIGRpcnR5IGNoYW5nZSBiZWNhdXNlXG5cdFx0Ly8gYSBmaWxlIHRoYXQgaXMgaW4gc2F2ZSBjb25mbGljdCBvciBlcnJvciB3aWxsIHJlcG9ydCBkaXJ0eSBldmVuXG5cdFx0Ly8gaWYgYXV0byBzYXZlIGlzIHR1cm5lZCBvbi5cblx0XHR0aGlzLm1vZGVsTGlzdGVuZXJzLmFkZChtb2RlbC5vbkRpZFNhdmVFcnJvcigoKSA9PiB0aGlzLl9vbkRpZENoYW5nZURpcnR5LmZpcmUoKSkpO1xuXG5cdFx0Ly8gcmVtb3ZlIG1vZGVsIGFzc29jaWF0aW9uIG9uY2UgaXQgZ2V0cyBkaXNwb3NlZFxuXHRcdHRoaXMubW9kZWxMaXN0ZW5lcnMuYWRkKEV2ZW50Lm9uY2UobW9kZWwub25XaWxsRGlzcG9zZSkoKCkgPT4ge1xuXHRcdFx0dGhpcy5tb2RlbExpc3RlbmVycy5jbGVhcigpO1xuXHRcdFx0dGhpcy5tb2RlbCA9IHVuZGVmaW5lZDtcblx0XHR9KSk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXROYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMucHJlZmVycmVkTmFtZSB8fCBzdXBlci5nZXROYW1lKCk7XG5cdH1cblxuXHRzZXRQcmVmZXJyZWROYW1lKG5hbWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5hbGxvd0xhYmVsT3ZlcnJpZGUoKSkge1xuXHRcdFx0cmV0dXJuOyAvLyBibG9jayBmb3Igc3BlY2lmaWMgc2NoZW1lcyB3ZSBjb25zaWRlciB0byBiZSBvd25pbmdcblx0XHR9XG5cblx0XHRpZiAodGhpcy5wcmVmZXJyZWROYW1lICE9PSBuYW1lKSB7XG5cdFx0XHR0aGlzLnByZWZlcnJlZE5hbWUgPSBuYW1lO1xuXG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUxhYmVsLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFsbG93TGFiZWxPdmVycmlkZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5yZXNvdXJjZS5zY2hlbWUgIT09IHRoaXMucGF0aFNlcnZpY2UuZGVmYXVsdFVyaVNjaGVtZSAmJlxuXHRcdFx0dGhpcy5yZXNvdXJjZS5zY2hlbWUgIT09IFNjaGVtYXMudnNjb2RlVXNlckRhdGEgJiZcblx0XHRcdHRoaXMucmVzb3VyY2Uuc2NoZW1lICE9PSBTY2hlbWFzLmZpbGUgJiZcblx0XHRcdHRoaXMucmVzb3VyY2Uuc2NoZW1lICE9PSBTY2hlbWFzLnZzY29kZVJlbW90ZTtcblx0fVxuXG5cdGdldFByZWZlcnJlZE5hbWUoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5wcmVmZXJyZWROYW1lO1xuXHR9XG5cblx0b3ZlcnJpZGUgaXNSZWFkb25seSgpOiBib29sZWFuIHwgSU1hcmtkb3duU3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbCA/IHRoaXMubW9kZWwuaXNSZWFkb25seSgpIDogdGhpcy5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmlzUmVhZG9ubHkodGhpcy5yZXNvdXJjZSk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXREZXNjcmlwdGlvbih2ZXJib3NpdHk/OiBWZXJib3NpdHkpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnByZWZlcnJlZERlc2NyaXB0aW9uIHx8IHN1cGVyLmdldERlc2NyaXB0aW9uKHZlcmJvc2l0eSk7XG5cdH1cblxuXHRzZXRQcmVmZXJyZWREZXNjcmlwdGlvbihkZXNjcmlwdGlvbjogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmFsbG93TGFiZWxPdmVycmlkZSgpKSB7XG5cdFx0XHRyZXR1cm47IC8vIGJsb2NrIGZvciBzcGVjaWZpYyBzY2hlbWVzIHdlIGNvbnNpZGVyIHRvIGJlIG93bmluZ1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnByZWZlcnJlZERlc2NyaXB0aW9uICE9PSBkZXNjcmlwdGlvbikge1xuXHRcdFx0dGhpcy5wcmVmZXJyZWREZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuXG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUxhYmVsLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRnZXRQcmVmZXJyZWREZXNjcmlwdGlvbigpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnByZWZlcnJlZERlc2NyaXB0aW9uO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0VGl0bGUodmVyYm9zaXR5PzogVmVyYm9zaXR5KTogc3RyaW5nIHtcblx0XHRsZXQgdGl0bGUgPSBzdXBlci5nZXRUaXRsZSh2ZXJib3NpdHkpO1xuXG5cdFx0Y29uc3QgcHJlZmVycmVkVGl0bGUgPSB0aGlzLmdldFByZWZlcnJlZFRpdGxlKCk7XG5cdFx0aWYgKHByZWZlcnJlZFRpdGxlKSB7XG5cdFx0XHR0aXRsZSA9IGAke3ByZWZlcnJlZFRpdGxlfSAoJHt0aXRsZX0pYDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGl0bGU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0UHJlZmVycmVkVGl0bGUoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5wcmVmZXJyZWROYW1lICYmIHRoaXMucHJlZmVycmVkRGVzY3JpcHRpb24pIHtcblx0XHRcdHJldHVybiBgJHt0aGlzLnByZWZlcnJlZE5hbWV9ICR7dGhpcy5wcmVmZXJyZWREZXNjcmlwdGlvbn1gO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnByZWZlcnJlZE5hbWUgfHwgdGhpcy5wcmVmZXJyZWREZXNjcmlwdGlvbikge1xuXHRcdFx0cmV0dXJuIHRoaXMucHJlZmVycmVkTmFtZSA/PyB0aGlzLnByZWZlcnJlZERlc2NyaXB0aW9uO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXRFbmNvZGluZygpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLm1vZGVsKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXRFbmNvZGluZygpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnByZWZlcnJlZEVuY29kaW5nO1xuXHR9XG5cblx0Z2V0UHJlZmVycmVkRW5jb2RpbmcoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5wcmVmZXJyZWRFbmNvZGluZztcblx0fVxuXG5cdGFzeW5jIHNldEVuY29kaW5nKGVuY29kaW5nOiBzdHJpbmcsIG1vZGU6IEVuY29kaW5nTW9kZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuc2V0UHJlZmVycmVkRW5jb2RpbmcoZW5jb2RpbmcpO1xuXG5cdFx0cmV0dXJuIHRoaXMubW9kZWw/LnNldEVuY29kaW5nKGVuY29kaW5nLCBtb2RlKTtcblx0fVxuXG5cdHNldFByZWZlcnJlZEVuY29kaW5nKGVuY29kaW5nOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnByZWZlcnJlZEVuY29kaW5nID0gZW5jb2Rpbmc7XG5cblx0XHQvLyBlbmNvZGluZyBpcyBhIGdvb2QgaGludCB0byBvcGVuIHRoZSBmaWxlIGFzIHRleHRcblx0XHR0aGlzLnNldEZvcmNlT3BlbkFzVGV4dCgpO1xuXHR9XG5cblx0Z2V0TGFuZ3VhZ2VJZCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLm1vZGVsKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXRMYW5ndWFnZUlkKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMucHJlZmVycmVkTGFuZ3VhZ2VJZDtcblx0fVxuXG5cdGdldFByZWZlcnJlZExhbmd1YWdlSWQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5wcmVmZXJyZWRMYW5ndWFnZUlkO1xuXHR9XG5cblx0c2V0TGFuZ3VhZ2VJZChsYW5ndWFnZUlkOiBzdHJpbmcsIHNvdXJjZT86IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuc2V0UHJlZmVycmVkTGFuZ3VhZ2VJZChsYW5ndWFnZUlkKTtcblxuXHRcdHRoaXMubW9kZWw/LnNldExhbmd1YWdlSWQobGFuZ3VhZ2VJZCwgc291cmNlKTtcblx0fVxuXG5cdHNldFByZWZlcnJlZExhbmd1YWdlSWQobGFuZ3VhZ2VJZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5wcmVmZXJyZWRMYW5ndWFnZUlkID0gbGFuZ3VhZ2VJZDtcblxuXHRcdC8vIGxhbmd1YWdlcyBhcmUgYSBnb29kIGhpbnQgdG8gb3BlbiB0aGUgZmlsZSBhcyB0ZXh0XG5cdFx0dGhpcy5zZXRGb3JjZU9wZW5Bc1RleHQoKTtcblx0fVxuXG5cdHNldFByZWZlcnJlZENvbnRlbnRzKGNvbnRlbnRzOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnByZWZlcnJlZENvbnRlbnRzID0gY29udGVudHM7XG5cblx0XHQvLyBjb250ZW50cyBpcyBhIGdvb2QgaGludCB0byBvcGVuIHRoZSBmaWxlIGFzIHRleHRcblx0XHR0aGlzLnNldEZvcmNlT3BlbkFzVGV4dCgpO1xuXHR9XG5cblx0c2V0Rm9yY2VPcGVuQXNUZXh0KCk6IHZvaWQge1xuXHRcdHRoaXMuZm9yY2VPcGVuQXMgPSBGb3JjZU9wZW5Bcy5UZXh0O1xuXHR9XG5cblx0c2V0Rm9yY2VPcGVuQXNCaW5hcnkoKTogdm9pZCB7XG5cdFx0dGhpcy5mb3JjZU9wZW5BcyA9IEZvcmNlT3BlbkFzLkJpbmFyeTtcblx0fVxuXG5cdG92ZXJyaWRlIGlzRGlydHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhKHRoaXMubW9kZWw/LmlzRGlydHkoKSk7XG5cdH1cblxuXHRvdmVycmlkZSBpc1NhdmluZygpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5tb2RlbD8uaGFzU3RhdGUoVGV4dEZpbGVFZGl0b3JNb2RlbFN0YXRlLlNBVkVEKSB8fCB0aGlzLm1vZGVsPy5oYXNTdGF0ZShUZXh0RmlsZUVkaXRvck1vZGVsU3RhdGUuQ09ORkxJQ1QpIHx8IHRoaXMubW9kZWw/Lmhhc1N0YXRlKFRleHRGaWxlRWRpdG9yTW9kZWxTdGF0ZS5FUlJPUikpIHtcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gcmVxdWlyZSB0aGUgbW9kZWwgdG8gYmUgZGlydHkgYW5kIG5vdCBpbiBjb25mbGljdCBvciBlcnJvciBzdGF0ZVxuXHRcdH1cblxuXHRcdC8vIE5vdGU6IGN1cnJlbnRseSBub3QgY2hlY2tpbmcgZm9yIE1vZGVsU3RhdGUuUEVORElOR19TQVZFIGZvciBhIHJlYXNvblxuXHRcdC8vIGJlY2F1c2Ugd2UgY3VycmVudGx5IG1pc3MgYW4gZXZlbnQgZm9yIHRoaXMgc3RhdGUgY2hhbmdlIG9uIGVkaXRvcnNcblx0XHQvLyBhbmQgaXQgY291bGQgcmVzdWx0IGluIGJhZCBVWCB3aGVyZSBhbiBlZGl0b3IgY2FuIGJlIGNsb3NlZCBldmVuIHRob3VnaFxuXHRcdC8vIGl0IHNob3dzIHVwIGFzIGRpcnR5IGFuZCBoYXMgbm90IGZpbmlzaGVkIHNhdmluZyB5ZXQuXG5cblx0XHRpZiAodGhpcy5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmhhc1Nob3J0QXV0b1NhdmVEZWxheSh0aGlzKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7IC8vIGEgc2hvcnQgYXV0byBzYXZlIGlzIGNvbmZpZ3VyZWQsIHRyZWF0IHRoaXMgYXMgYmVpbmcgc2F2ZWRcblx0XHR9XG5cblx0XHRyZXR1cm4gc3VwZXIuaXNTYXZpbmcoKTtcblx0fVxuXG5cdG92ZXJyaWRlIHByZWZlcnNFZGl0b3JQYW5lPFQgZXh0ZW5kcyBJRWRpdG9yRGVzY3JpcHRvcjxJRWRpdG9yUGFuZT4+KGVkaXRvclBhbmVzOiBUW10pOiBUIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5mb3JjZU9wZW5BcyA9PT0gRm9yY2VPcGVuQXMuQmluYXJ5KSB7XG5cdFx0XHRyZXR1cm4gZWRpdG9yUGFuZXMuZmluZChlZGl0b3JQYW5lID0+IGVkaXRvclBhbmUudHlwZUlkID09PSBCSU5BUllfRklMRV9FRElUT1JfSUQpO1xuXHRcdH1cblxuXHRcdHJldHVybiBlZGl0b3JQYW5lcy5maW5kKGVkaXRvclBhbmUgPT4gZWRpdG9yUGFuZS50eXBlSWQgPT09IFRFWFRfRklMRV9FRElUT1JfSUQpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVzb2x2ZShvcHRpb25zPzogSUZpbGVFZGl0b3JJbnB1dE9wdGlvbnMpOiBQcm9taXNlPElUZXh0RmlsZUVkaXRvck1vZGVsIHwgQmluYXJ5RWRpdG9yTW9kZWw+IHtcblxuXHRcdC8vIFJlc29sdmUgYXMgYmluYXJ5XG5cdFx0aWYgKHRoaXMuZm9yY2VPcGVuQXMgPT09IEZvcmNlT3BlbkFzLkJpbmFyeSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG9SZXNvbHZlQXNCaW5hcnkoKTtcblx0XHR9XG5cblx0XHQvLyBSZXNvbHZlIGFzIHRleHRcblx0XHRyZXR1cm4gdGhpcy5kb1Jlc29sdmVBc1RleHQob3B0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvUmVzb2x2ZUFzVGV4dChvcHRpb25zPzogSUZpbGVFZGl0b3JJbnB1dE9wdGlvbnMpOiBQcm9taXNlPElUZXh0RmlsZUVkaXRvck1vZGVsIHwgQmluYXJ5RWRpdG9yTW9kZWw+IHtcblx0XHR0cnkge1xuXG5cdFx0XHQvLyBVbnNldCBwcmVmZXJyZWQgY29udGVudHMgYWZ0ZXIgaGF2aW5nIGFwcGxpZWQgaXQgb25jZVxuXHRcdFx0Ly8gdG8gcHJldmVudCB0aGlzIHByb3BlcnR5IHRvIHN0aWNrLiBXZSBzdGlsbCB3YW50IGZ1dHVyZVxuXHRcdFx0Ly8gYHJlc29sdmVgIGNhbGxzIHRvIGZldGNoIHRoZSBjb250ZW50cyBmcm9tIGRpc2suXG5cdFx0XHRjb25zdCBwcmVmZXJyZWRDb250ZW50cyA9IHRoaXMucHJlZmVycmVkQ29udGVudHM7XG5cdFx0XHR0aGlzLnByZWZlcnJlZENvbnRlbnRzID0gdW5kZWZpbmVkO1xuXG5cdFx0XHQvLyBSZXNvbHZlIHJlc291cmNlIHZpYSB0ZXh0IGZpbGUgc2VydmljZSBhbmQgb25seSBhbGxvd1xuXHRcdFx0Ly8gdG8gb3BlbiBiaW5hcnkgZmlsZXMgaWYgd2UgYXJlIGluc3RydWN0ZWQgc29cblx0XHRcdGF3YWl0IHRoaXMudGV4dEZpbGVTZXJ2aWNlLmZpbGVzLnJlc29sdmUodGhpcy5yZXNvdXJjZSwge1xuXHRcdFx0XHRsYW5ndWFnZUlkOiB0aGlzLnByZWZlcnJlZExhbmd1YWdlSWQsXG5cdFx0XHRcdGVuY29kaW5nOiB0aGlzLnByZWZlcnJlZEVuY29kaW5nLFxuXHRcdFx0XHRjb250ZW50czogdHlwZW9mIHByZWZlcnJlZENvbnRlbnRzID09PSAnc3RyaW5nJyA/IGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KHByZWZlcnJlZENvbnRlbnRzKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0cmVsb2FkOiB7IGFzeW5jOiB0cnVlIH0sIC8vIHRyaWdnZXIgYSByZWxvYWQgb2YgdGhlIG1vZGVsIGlmIGl0IGV4aXN0cyBhbHJlYWR5IGJ1dCBkbyBub3Qgd2FpdCB0byBzaG93IHRoZSBtb2RlbFxuXHRcdFx0XHRhbGxvd0JpbmFyeTogdGhpcy5mb3JjZU9wZW5BcyA9PT0gRm9yY2VPcGVuQXMuVGV4dCxcblx0XHRcdFx0cmVhc29uOiBUZXh0RmlsZVJlc29sdmVSZWFzb24uRURJVE9SLFxuXHRcdFx0XHRsaW1pdHM6IHRoaXMuZW5zdXJlTGltaXRzKG9wdGlvbnMpXG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gVGhpcyBpcyBhIGJpdCB1Z2x5LCBiZWNhdXNlIHdlIGZpcnN0IHJlc29sdmUgdGhlIG1vZGVsIGFuZCB0aGVuIHJlc29sdmUgYSBtb2RlbCByZWZlcmVuY2UuIHRoZSByZWFzb24gYmVpbmcgdGhhdCBiaW5hcnlcblx0XHRcdC8vIG9yIHZlcnkgbGFyZ2UgZmlsZXMgZG8gbm90IHJlc29sdmUgdG8gYSB0ZXh0IGZpbGUgbW9kZWwgYnV0IHNob3VsZCBiZSBvcGVuZWQgYXMgYmluYXJ5IGZpbGVzIHdpdGhvdXQgdGV4dC4gRmlyc3QgY2FsbGluZyBpbnRvXG5cdFx0XHQvLyByZXNvbHZlKCkgZW5zdXJlcyB3ZSBhcmUgbm90IGNyZWF0aW5nIG1vZGVsIHJlZmVyZW5jZXMgZm9yIHRoZXNlIGtpbmQgb2YgcmVzb3VyY2VzLlxuXHRcdFx0Ly8gSW4gYWRkaXRpb24gd2UgaGF2ZSBhIGJpdCBvZiBwYXlsb2FkIHRvIHRha2UgaW50byBhY2NvdW50IChlbmNvZGluZywgcmVsb2FkKSB0aGF0IHRoZSB0ZXh0IHJlc29sdmVyIGRvZXMgbm90IGhhbmRsZSB5ZXQuXG5cdFx0XHRpZiAoIXRoaXMuY2FjaGVkVGV4dEZpbGVNb2RlbFJlZmVyZW5jZSkge1xuXHRcdFx0XHR0aGlzLmNhY2hlZFRleHRGaWxlTW9kZWxSZWZlcmVuY2UgPSBhd2FpdCB0aGlzLnRleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UodGhpcy5yZXNvdXJjZSkgYXMgSVJlZmVyZW5jZTxJVGV4dEZpbGVFZGl0b3JNb2RlbD47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5jYWNoZWRUZXh0RmlsZU1vZGVsUmVmZXJlbmNlLm9iamVjdDtcblxuXHRcdFx0Ly8gSXQgaXMgcG9zc2libGUgdGhhdCB0aGlzIGlucHV0IHdhcyBkaXNwb3NlZCBiZWZvcmUgdGhlIG1vZGVsXG5cdFx0XHQvLyBmaW5pc2hlZCByZXNvbHZpbmcuIEFzIHN1Y2gsIHdlIG5lZWQgdG8gbWFrZSBzdXJlIHRvIGRpc3Bvc2Vcblx0XHRcdC8vIHRoZSBtb2RlbCByZWZlcmVuY2UgdG8gbm90IGxlYWsgaXQuXG5cdFx0XHRpZiAodGhpcy5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdFx0dGhpcy5kaXNwb3NlTW9kZWxSZWZlcmVuY2UoKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG1vZGVsO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cblx0XHRcdC8vIEhhbmRsZSBiaW5hcnkgZmlsZXMgd2l0aCBiaW5hcnkgbW9kZWxcblx0XHRcdGlmICgoPFRleHRGaWxlT3BlcmF0aW9uRXJyb3I+ZXJyb3IpLnRleHRGaWxlT3BlcmF0aW9uUmVzdWx0ID09PSBUZXh0RmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX0lTX0JJTkFSWSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5kb1Jlc29sdmVBc0JpbmFyeSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBCdWJibGUgYW55IG90aGVyIGVycm9yIHVwXG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvUmVzb2x2ZUFzQmluYXJ5KCk6IFByb21pc2U8QmluYXJ5RWRpdG9yTW9kZWw+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQmluYXJ5RWRpdG9yTW9kZWwsIHRoaXMucHJlZmVycmVkUmVzb3VyY2UsIHRoaXMuZ2V0TmFtZSgpKTtcblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cblx0XHRyZXR1cm4gbW9kZWw7XG5cdH1cblxuXHRpc1Jlc29sdmVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMubW9kZWw7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyByZW5hbWUoZ3JvdXA6IEdyb3VwSWRlbnRpZmllciwgdGFyZ2V0OiBVUkkpOiBQcm9taXNlPElNb3ZlUmVzdWx0PiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGVkaXRvcjoge1xuXHRcdFx0XHRyZXNvdXJjZTogdGFyZ2V0LFxuXHRcdFx0XHRlbmNvZGluZzogdGhpcy5nZXRFbmNvZGluZygpLFxuXHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0dmlld1N0YXRlOiBmaW5kVmlld1N0YXRlRm9yRWRpdG9yKHRoaXMsIGdyb3VwLCB0aGlzLmVkaXRvclNlcnZpY2UpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0b3ZlcnJpZGUgdG9VbnR5cGVkKG9wdGlvbnM/OiBJVW50eXBlZEVkaXRvck9wdGlvbnMpOiBJVGV4dFJlc291cmNlRWRpdG9ySW5wdXQge1xuXHRcdGNvbnN0IHVudHlwZWRJbnB1dDogSVVudHlwZWRGaWxlRWRpdG9ySW5wdXQgPSB7XG5cdFx0XHRyZXNvdXJjZTogdGhpcy5wcmVmZXJyZWRSZXNvdXJjZSxcblx0XHRcdGZvcmNlRmlsZTogdHJ1ZSxcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0b3ZlcnJpZGU6IHRoaXMuZWRpdG9ySWRcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aWYgKHR5cGVvZiBvcHRpb25zPy5wcmVzZXJ2ZVZpZXdTdGF0ZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdHVudHlwZWRJbnB1dC5lbmNvZGluZyA9IHRoaXMuZ2V0RW5jb2RpbmcoKTtcblx0XHRcdHVudHlwZWRJbnB1dC5sYW5ndWFnZUlkID0gdGhpcy5nZXRMYW5ndWFnZUlkKCk7XG5cdFx0XHR1bnR5cGVkSW5wdXQuY29udGVudHMgPSAoKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMudGV4dEZpbGVTZXJ2aWNlLmZpbGVzLmdldCh0aGlzLnJlc291cmNlKTtcblx0XHRcdFx0aWYgKG1vZGVsPy5pc0RpcnR5KCkgJiYgIW1vZGVsLnRleHRFZGl0b3JNb2RlbC5pc1Rvb0xhcmdlRm9ySGVhcE9wZXJhdGlvbigpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG1vZGVsLnRleHRFZGl0b3JNb2RlbC5nZXRWYWx1ZSgpOyAvLyBvbmx5IGlmIGRpcnR5IGFuZCBub3QgdG9vIGxhcmdlXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSkoKTtcblxuXHRcdFx0dW50eXBlZElucHV0Lm9wdGlvbnMgPSB7XG5cdFx0XHRcdC4uLnVudHlwZWRJbnB1dC5vcHRpb25zLFxuXHRcdFx0XHR2aWV3U3RhdGU6IGZpbmRWaWV3U3RhdGVGb3JFZGl0b3IodGhpcywgb3B0aW9ucy5wcmVzZXJ2ZVZpZXdTdGF0ZSwgdGhpcy5lZGl0b3JTZXJ2aWNlKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW50eXBlZElucHV0O1xuXHR9XG5cblx0b3ZlcnJpZGUgbWF0Y2hlcyhvdGhlcklucHV0OiBFZGl0b3JJbnB1dCB8IElVbnR5cGVkRWRpdG9ySW5wdXQpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcyA9PT0gb3RoZXJJbnB1dCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKG90aGVySW5wdXQgaW5zdGFuY2VvZiBGaWxlRWRpdG9ySW5wdXQpIHtcblx0XHRcdHJldHVybiBpc0VxdWFsKG90aGVySW5wdXQucmVzb3VyY2UsIHRoaXMucmVzb3VyY2UpO1xuXHRcdH1cblxuXHRcdGlmIChpc1Jlc291cmNlRWRpdG9ySW5wdXQob3RoZXJJbnB1dCkpIHtcblx0XHRcdHJldHVybiBzdXBlci5tYXRjaGVzKG90aGVySW5wdXQpO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cblx0XHQvLyBNb2RlbFxuXHRcdHRoaXMubW9kZWwgPSB1bmRlZmluZWQ7XG5cblx0XHQvLyBNb2RlbCByZWZlcmVuY2Vcblx0XHR0aGlzLmRpc3Bvc2VNb2RlbFJlZmVyZW5jZSgpO1xuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBkaXNwb3NlTW9kZWxSZWZlcmVuY2UoKTogdm9pZCB7XG5cdFx0ZGlzcG9zZSh0aGlzLmNhY2hlZFRleHRGaWxlTW9kZWxSZWZlcmVuY2UpO1xuXHRcdHRoaXMuY2FjaGVkVGV4dEZpbGVNb2RlbFJlZmVyZW5jZSA9IHVuZGVmaW5lZDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFvRSx5QkFBOEUsNEJBQXFELHdCQUF3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
