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
import { localize } from "../../../../nls.js";
import { toBufferOrReadable, TextFileOperationError, TextFileOperationResult, stringToSnapshot, TextFileEditorModelState } from "../common/textfiles.js";
import { SaveSourceRegistry } from "../../../common/editor.js";
import { ILifecycleService } from "../../lifecycle/common/lifecycle.js";
import { IFileService, FileOperationResult } from "../../../../platform/files/common/files.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { extname as pathExtname } from "../../../../base/common/path.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IUntitledTextEditorService } from "../../untitled/common/untitledTextEditorService.js";
import { UntitledTextEditorModel } from "../../untitled/common/untitledTextEditorModel.js";
import { TextFileEditorModelManager } from "../common/textFileEditorModelManager.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Schemas } from "../../../../base/common/network.js";
import { createTextBufferFactoryFromSnapshot, createTextBufferFactoryFromStream } from "../../../../editor/common/model/textModel.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { joinPath, dirname, basename, toLocalResource, extname, isEqual } from "../../../../base/common/resources.js";
import { IDialogService, IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { bufferToStream } from "../../../../base/common/buffer.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../editor/common/languages/modesRegistry.js";
import { IFilesConfigurationService } from "../../filesConfiguration/common/filesConfigurationService.js";
import { BaseTextEditorModel } from "../../../common/editor/textEditorModel.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { IPathService } from "../../path/common/pathService.js";
import { IWorkingCopyFileService } from "../../workingCopy/common/workingCopyFileService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService, WORKSPACE_EXTENSION } from "../../../../platform/workspace/common/workspace.js";
import { UTF8, UTF8_with_bom, UTF16be, UTF16le, encodingExists, toEncodeReadable, toDecodeStream, DecodeStreamErrorKind } from "../common/encoding.js";
import { consumeStream } from "../../../../base/common/stream.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { IElevatedFileService } from "../../files/common/elevatedFileService.js";
import { IDecorationsService } from "../../decorations/common/decorations.js";
import { Emitter } from "../../../../base/common/event.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { listErrorForeground } from "../../../../platform/theme/common/colorRegistry.js";
let AbstractTextFileService = class extends Disposable {
  constructor(fileService, untitledTextEditorService, lifecycleService, instantiationService, modelService, environmentService, dialogService, fileDialogService, textResourceConfigurationService, filesConfigurationService, codeEditorService, pathService, workingCopyFileService, uriIdentityService, languageService, logService, elevatedFileService, decorationsService) {
    super();
    this.fileService = fileService;
    this.lifecycleService = lifecycleService;
    this.instantiationService = instantiationService;
    this.modelService = modelService;
    this.environmentService = environmentService;
    this.dialogService = dialogService;
    this.fileDialogService = fileDialogService;
    this.textResourceConfigurationService = textResourceConfigurationService;
    this.filesConfigurationService = filesConfigurationService;
    this.codeEditorService = codeEditorService;
    this.pathService = pathService;
    this.workingCopyFileService = workingCopyFileService;
    this.uriIdentityService = uriIdentityService;
    this.languageService = languageService;
    this.logService = logService;
    this.elevatedFileService = elevatedFileService;
    this.decorationsService = decorationsService;
    this.files = this._register(this.instantiationService.createInstance(TextFileEditorModelManager));
    this.untitled = untitledTextEditorService;
    this.provideDecorations();
  }
  //#region decorations
  provideDecorations() {
    const provider = this._register(new class extends Disposable {
      constructor(files) {
        super();
        this.files = files;
        this.label = localize("textFileModelDecorations", "Text File Model Decorations");
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.registerListeners();
      }
      registerListeners() {
        this._register(this.files.onDidResolve(({ model }) => {
          if (model.isReadonly() || model.hasState(TextFileEditorModelState.ORPHAN)) {
            this._onDidChange.fire([model.resource]);
          }
        }));
        this._register(this.files.onDidRemove((modelUri) => this._onDidChange.fire([modelUri])));
        this._register(this.files.onDidChangeReadonly((model) => this._onDidChange.fire([model.resource])));
        this._register(this.files.onDidChangeOrphaned((model) => this._onDidChange.fire([model.resource])));
      }
      provideDecorations(uri) {
        const model = this.files.get(uri);
        if (!model || model.isDisposed()) {
          return void 0;
        }
        const isReadonly = model.isReadonly();
        const isOrphaned = model.hasState(TextFileEditorModelState.ORPHAN);
        if (isReadonly && isOrphaned) {
          return {
            color: listErrorForeground,
            letter: Codicon.lockSmall,
            strikethrough: true,
            tooltip: localize("readonlyAndDeleted", "Deleted, Read-only")
          };
        } else if (isReadonly) {
          return {
            letter: Codicon.lockSmall,
            tooltip: localize("readonly", "Read-only")
          };
        } else if (isOrphaned) {
          return {
            color: listErrorForeground,
            strikethrough: true,
            tooltip: localize("deleted", "Deleted")
          };
        }
        return void 0;
      }
    }(this.files));
    this._register(this.decorationsService.registerDecorationsProvider(provider));
  }
  get encoding() {
    if (!this._encoding) {
      this._encoding = this._register(this.instantiationService.createInstance(EncodingOracle));
    }
    return this._encoding;
  }
  async read(resource, options) {
    const [bufferStream, decoder] = await this.doRead(resource, {
      ...options,
      // optimization: since we know that the caller does not
      // care about buffering, we indicate this to the reader.
      // this reduces all the overhead the buffered reading
      // has (open, read, close) if the provider supports
      // unbuffered reading.
      preferUnbuffered: true
    });
    return {
      ...bufferStream,
      encoding: decoder.detected.encoding || UTF8,
      value: await consumeStream(decoder.stream, (strings) => strings.join(""))
    };
  }
  async readStream(resource, options) {
    const [bufferStream, decoder] = await this.doRead(resource, options);
    return {
      ...bufferStream,
      encoding: decoder.detected.encoding || UTF8,
      value: await createTextBufferFactoryFromStream(decoder.stream)
    };
  }
  async doRead(resource, options) {
    const cts = new CancellationTokenSource();
    let bufferStream;
    if (options?.preferUnbuffered) {
      const content = await this.fileService.readFile(resource, options, cts.token);
      bufferStream = {
        ...content,
        value: bufferToStream(content.value)
      };
    } else {
      bufferStream = await this.fileService.readFileStream(resource, options, cts.token);
    }
    try {
      const decoder = await this.doGetDecodedStream(resource, bufferStream.value, options);
      return [bufferStream, decoder];
    } catch (error) {
      cts.dispose(true);
      if (error.decodeStreamErrorKind === DecodeStreamErrorKind.STREAM_IS_BINARY) {
        throw new TextFileOperationError(localize("fileBinaryError", "File seems to be binary and cannot be opened as text"), TextFileOperationResult.FILE_IS_BINARY, options);
      } else {
        throw error;
      }
    }
  }
  async create(operations, undoInfo) {
    const operationsWithContents = await Promise.all(operations.map(async (operation) => {
      const contents = await this.getEncodedReadable(operation.resource, operation.value);
      return {
        resource: operation.resource,
        contents,
        overwrite: operation.options?.overwrite
      };
    }));
    return this.workingCopyFileService.create(operationsWithContents, CancellationToken.None, undoInfo);
  }
  async write(resource, value, options) {
    const readable = await this.getEncodedReadable(resource, value, options);
    if (options?.writeElevated && this.elevatedFileService.isSupported(resource)) {
      return this.elevatedFileService.writeFileElevated(resource, readable, options);
    }
    return this.fileService.writeFile(resource, readable, options);
  }
  getEncoding(resource) {
    const model = resource.scheme === Schemas.untitled ? this.untitled.get(resource) : this.files.get(resource);
    return model?.getEncoding() ?? this.encoding.getUnvalidatedEncodingForResource(resource);
  }
  async getEncodedReadable(resource, value, options) {
    const { encoding, addBOM } = await this.encoding.getWriteEncoding(resource, options);
    if (encoding === UTF8 && !addBOM) {
      return typeof value === "undefined" ? void 0 : toBufferOrReadable(value);
    }
    value = value || "";
    const snapshot = typeof value === "string" ? stringToSnapshot(value) : value;
    return toEncodeReadable(snapshot, encoding, { addBOM });
  }
  async getDecodedStream(resource, value, options) {
    return (await this.doGetDecodedStream(resource, value, options)).stream;
  }
  doGetDecodedStream(resource, stream, options) {
    return toDecodeStream(stream, {
      acceptTextOnly: options?.acceptTextOnly ?? false,
      guessEncoding: options?.autoGuessEncoding || this.textResourceConfigurationService.getValue(resource, "files.autoGuessEncoding"),
      candidateGuessEncodings: options?.candidateGuessEncodings || this.textResourceConfigurationService.getValue(resource, "files.candidateGuessEncodings"),
      overwriteEncoding: async (detectedEncoding) => {
        const { encoding } = await this.encoding.getPreferredReadEncoding(resource, options, detectedEncoding ?? void 0);
        return encoding;
      }
    });
  }
  //#endregion
  //#region save
  async save(resource, options) {
    if (resource.scheme === Schemas.untitled) {
      const model = this.untitled.get(resource);
      if (model) {
        let targetUri;
        if (model.hasAssociatedFilePath) {
          targetUri = await this.suggestSavePath(resource);
        } else {
          targetUri = await this.fileDialogService.pickFileToSave(await this.suggestSavePath(resource), options?.availableFileSystems);
        }
        if (targetUri) {
          return this.saveAs(resource, targetUri, options);
        }
      }
    } else {
      const model = this.files.get(resource);
      if (model) {
        return await model.save(options) ? resource : void 0;
      }
    }
    return void 0;
  }
  async saveAs(source, target, options) {
    if (!target) {
      target = await this.fileDialogService.pickFileToSave(await this.suggestSavePath(options?.suggestedTarget ?? source), options?.availableFileSystems);
    }
    if (!target) {
      return;
    }
    if (this.filesConfigurationService.isReadonly(target)) {
      const confirmed = await this.confirmMakeWriteable(target);
      if (!confirmed) {
        return;
      } else {
        this.filesConfigurationService.updateReadonly(target, false);
      }
    }
    if (isEqual(source, target)) {
      return this.save(source, {
        ...options,
        force: true
        /* force to save, even if not dirty (https://github.com/microsoft/vscode/issues/99619) */
      });
    }
    if (this.fileService.hasProvider(source) && this.uriIdentityService.extUri.isEqual(source, target) && await this.fileService.exists(source)) {
      await this.workingCopyFileService.move([{ file: { source, target } }], CancellationToken.None);
      const success = await this.save(source, options);
      if (!success) {
        await this.save(target, options);
      }
      return target;
    }
    return this.doSaveAs(source, target, options);
  }
  async doSaveAs(source, target, options) {
    let success = false;
    const textFileModel = this.files.get(source);
    if (textFileModel?.isResolved()) {
      success = await this.doSaveAsTextFile(textFileModel, source, target, options);
    } else if (this.fileService.hasProvider(source)) {
      await this.fileService.copy(source, target, true);
      success = true;
    } else {
      const textModel = this.modelService.getModel(source);
      if (textModel) {
        success = await this.doSaveAsTextFile(textModel, source, target, options);
      }
    }
    if (!success) {
      return void 0;
    }
    try {
      await this.revert(source);
    } catch (error) {
      this.logService.error(error);
    }
    if (source.scheme === Schemas.untitled) {
      this.untitled.notifyDidSave(source, target);
    }
    return target;
  }
  async doSaveAsTextFile(sourceModel, source, target, options) {
    let sourceModelEncoding = void 0;
    const sourceModelWithEncodingSupport = sourceModel;
    if (typeof sourceModelWithEncodingSupport.getEncoding === "function") {
      sourceModelEncoding = sourceModelWithEncodingSupport.getEncoding();
    }
    let targetExists = false;
    let targetModel = this.files.get(target);
    if (targetModel?.isResolved()) {
      targetExists = true;
    } else {
      targetExists = await this.fileService.exists(target);
      if (!targetExists) {
        await this.create([{ resource: target, value: "" }]);
      }
      try {
        targetModel = await this.files.resolve(target, { encoding: sourceModelEncoding });
      } catch (error) {
        if (targetExists) {
          if (error.textFileOperationResult === TextFileOperationResult.FILE_IS_BINARY || error.fileOperationResult === FileOperationResult.FILE_TOO_LARGE) {
            await this.fileService.del(target);
            return this.doSaveAsTextFile(sourceModel, source, target, options);
          }
        }
        throw error;
      }
    }
    let write;
    if (sourceModel instanceof UntitledTextEditorModel && sourceModel.hasAssociatedFilePath && targetExists && this.uriIdentityService.extUri.isEqual(target, toLocalResource(sourceModel.resource, this.environmentService.remoteAuthority, this.pathService.defaultUriScheme))) {
      write = await this.confirmOverwrite(target);
    } else {
      write = true;
    }
    if (!write) {
      return false;
    }
    let sourceTextModel = void 0;
    if (sourceModel instanceof BaseTextEditorModel) {
      if (sourceModel.isResolved()) {
        sourceTextModel = sourceModel.textEditorModel ?? void 0;
      }
    } else {
      sourceTextModel = sourceModel;
    }
    let targetTextModel = void 0;
    if (targetModel.isResolved()) {
      targetTextModel = targetModel.textEditorModel;
    }
    if (sourceTextModel && targetTextModel) {
      targetModel.updatePreferredEncoding(sourceModelEncoding);
      this.modelService.updateModel(targetTextModel, createTextBufferFactoryFromSnapshot(sourceTextModel.createSnapshot()));
      const sourceLanguageId = sourceTextModel.getLanguageId();
      const targetLanguageId = targetTextModel.getLanguageId();
      if (sourceLanguageId !== PLAINTEXT_LANGUAGE_ID && targetLanguageId === PLAINTEXT_LANGUAGE_ID) {
        targetTextModel.setLanguage(sourceLanguageId);
      }
      const sourceTransientProperties = this.codeEditorService.getTransientModelProperties(sourceTextModel);
      if (sourceTransientProperties) {
        for (const [key, value] of sourceTransientProperties) {
          this.codeEditorService.setTransientModelProperty(targetTextModel, key, value);
        }
      }
    }
    if (!options?.source) {
      options = {
        ...options,
        source: targetExists ? AbstractTextFileService.TEXTFILE_SAVE_REPLACE_SOURCE : AbstractTextFileService.TEXTFILE_SAVE_CREATE_SOURCE
      };
    }
    return targetModel.save({
      ...options,
      from: source
    });
  }
  async confirmOverwrite(resource) {
    const { confirmed } = await this.dialogService.confirm({
      type: "warning",
      message: localize("confirmOverwrite", "'{0}' already exists. Do you want to replace it?", basename(resource)),
      detail: localize("overwriteIrreversible", "A file or folder with the name '{0}' already exists in the folder '{1}'. Replacing it will overwrite its current contents.", basename(resource), basename(dirname(resource))),
      primaryButton: localize({ key: "replaceButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Replace")
    });
    return confirmed;
  }
  async confirmMakeWriteable(resource) {
    const { confirmed } = await this.dialogService.confirm({
      type: "warning",
      message: localize("confirmMakeWriteable", "'{0}' is marked as read-only. Do you want to save anyway?", basename(resource)),
      detail: localize("confirmMakeWriteableDetail", "Paths can be configured as read-only via settings."),
      primaryButton: localize({ key: "makeWriteableButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Save Anyway")
    });
    return confirmed;
  }
  async suggestSavePath(resource) {
    if (this.fileService.hasProvider(resource)) {
      return resource;
    }
    const remoteAuthority = this.environmentService.remoteAuthority;
    const defaultFilePath = await this.fileDialogService.defaultFilePath();
    let suggestedFilename = void 0;
    if (resource.scheme === Schemas.untitled) {
      const model = this.untitled.get(resource);
      if (model) {
        if (model.hasAssociatedFilePath) {
          return toLocalResource(resource, remoteAuthority, this.pathService.defaultUriScheme);
        }
        let nameCandidate;
        if (await this.pathService.hasValidBasename(joinPath(defaultFilePath, model.name), model.name)) {
          nameCandidate = model.name;
        } else {
          nameCandidate = basename(resource);
        }
        const languageId = model.getLanguageId();
        if (languageId && languageId !== PLAINTEXT_LANGUAGE_ID) {
          suggestedFilename = this.suggestFilename(languageId, nameCandidate);
        } else {
          suggestedFilename = nameCandidate;
        }
      }
    }
    if (!suggestedFilename) {
      suggestedFilename = basename(resource);
    }
    return joinPath(defaultFilePath, suggestedFilename);
  }
  suggestFilename(languageId, untitledName) {
    const languageName = this.languageService.getLanguageName(languageId);
    if (!languageName) {
      return untitledName;
    }
    const untitledExtension = pathExtname(untitledName);
    const extensions = this.languageService.getExtensions(languageId);
    if (extensions.includes(untitledExtension)) {
      return untitledName;
    }
    const primaryExtension = extensions.at(0);
    if (primaryExtension) {
      if (untitledExtension) {
        return `${untitledName.substring(0, untitledName.indexOf(untitledExtension))}${primaryExtension}`;
      }
      return `${untitledName}${primaryExtension}`;
    }
    const filenames = this.languageService.getFilenames(languageId);
    if (filenames.includes(untitledName)) {
      return untitledName;
    }
    return filenames.at(0) ?? untitledName;
  }
  //#endregion
  //#region revert
  async revert(resource, options) {
    if (resource.scheme === Schemas.untitled) {
      const model = this.untitled.get(resource);
      if (model) {
        return model.revert(options);
      }
    } else {
      const model = this.files.get(resource);
      if (model && (model.isDirty() || options?.force)) {
        return model.revert(options);
      }
    }
  }
  //#endregion
  //#region dirty
  isDirty(resource) {
    const model = resource.scheme === Schemas.untitled ? this.untitled.get(resource) : this.files.get(resource);
    if (model) {
      return model.isDirty();
    }
    return false;
  }
  //#endregion
};
AbstractTextFileService.TEXTFILE_SAVE_CREATE_SOURCE = SaveSourceRegistry.registerSource("textFileCreate.source", localize("textFileCreate.source", "File Created"));
AbstractTextFileService.TEXTFILE_SAVE_REPLACE_SOURCE = SaveSourceRegistry.registerSource("textFileOverwrite.source", localize("textFileOverwrite.source", "File Replaced"));
AbstractTextFileService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IUntitledTextEditorService),
  __decorateParam(2, ILifecycleService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IModelService),
  __decorateParam(5, IWorkbenchEnvironmentService),
  __decorateParam(6, IDialogService),
  __decorateParam(7, IFileDialogService),
  __decorateParam(8, ITextResourceConfigurationService),
  __decorateParam(9, IFilesConfigurationService),
  __decorateParam(10, ICodeEditorService),
  __decorateParam(11, IPathService),
  __decorateParam(12, IWorkingCopyFileService),
  __decorateParam(13, IUriIdentityService),
  __decorateParam(14, ILanguageService),
  __decorateParam(15, ILogService),
  __decorateParam(16, IElevatedFileService),
  __decorateParam(17, IDecorationsService)
], AbstractTextFileService);
let EncodingOracle = class extends Disposable {
  constructor(textResourceConfigurationService, environmentService, contextService, uriIdentityService) {
    super();
    this.textResourceConfigurationService = textResourceConfigurationService;
    this.environmentService = environmentService;
    this.contextService = contextService;
    this.uriIdentityService = uriIdentityService;
    this._encodingOverrides = this.getDefaultEncodingOverrides();
    this.registerListeners();
  }
  get encodingOverrides() {
    return this._encodingOverrides;
  }
  set encodingOverrides(value) {
    this._encodingOverrides = value;
  }
  registerListeners() {
    this._register(this.contextService.onDidChangeWorkspaceFolders(() => this.encodingOverrides = this.getDefaultEncodingOverrides()));
  }
  getDefaultEncodingOverrides() {
    const defaultEncodingOverrides = [];
    defaultEncodingOverrides.push({ parent: this.environmentService.userRoamingDataHome, encoding: UTF8 });
    defaultEncodingOverrides.push({ extension: WORKSPACE_EXTENSION, encoding: UTF8 });
    defaultEncodingOverrides.push({ parent: this.environmentService.untitledWorkspacesHome, encoding: UTF8 });
    this.contextService.getWorkspace().folders.forEach((folder) => {
      defaultEncodingOverrides.push({ parent: joinPath(folder.uri, ".vscode"), encoding: UTF8 });
    });
    return defaultEncodingOverrides;
  }
  async getWriteEncoding(resource, options) {
    const { encoding, hasBOM } = await this.getPreferredWriteEncoding(resource, options ? options.encoding : void 0);
    return { encoding, addBOM: hasBOM };
  }
  async getPreferredWriteEncoding(resource, preferredEncoding) {
    const resourceEncoding = await this.getValidatedEncodingForResource(resource, preferredEncoding);
    return {
      encoding: resourceEncoding,
      hasBOM: resourceEncoding === UTF16be || resourceEncoding === UTF16le || resourceEncoding === UTF8_with_bom
      // enforce BOM for certain encodings
    };
  }
  async getPreferredReadEncoding(resource, options, detectedEncoding) {
    let preferredEncoding;
    if (options?.encoding) {
      if (detectedEncoding === UTF8_with_bom && options.encoding === UTF8) {
        preferredEncoding = UTF8_with_bom;
      } else {
        preferredEncoding = options.encoding;
      }
    } else if (typeof detectedEncoding === "string") {
      preferredEncoding = detectedEncoding;
    } else if (this.textResourceConfigurationService.getValue(resource, "files.encoding") === UTF8_with_bom) {
      preferredEncoding = UTF8;
    }
    const encoding = await this.getValidatedEncodingForResource(resource, preferredEncoding);
    return {
      encoding,
      hasBOM: encoding === UTF16be || encoding === UTF16le || encoding === UTF8_with_bom
      // enforce BOM for certain encodings
    };
  }
  getUnvalidatedEncodingForResource(resource, preferredEncoding) {
    let fileEncoding;
    const override = this.getEncodingOverride(resource);
    if (override) {
      fileEncoding = override;
    } else if (preferredEncoding) {
      fileEncoding = preferredEncoding;
    } else {
      fileEncoding = this.textResourceConfigurationService.getValue(resource, "files.encoding");
    }
    return fileEncoding || UTF8;
  }
  async getValidatedEncodingForResource(resource, preferredEncoding) {
    let fileEncoding = this.getUnvalidatedEncodingForResource(resource, preferredEncoding);
    if (fileEncoding !== UTF8 && !await encodingExists(fileEncoding)) {
      fileEncoding = UTF8;
    }
    return fileEncoding;
  }
  getEncodingOverride(resource) {
    if (resource && this.encodingOverrides?.length) {
      for (const override of this.encodingOverrides) {
        if (override.parent && this.uriIdentityService.extUri.isEqualOrParent(resource, override.parent)) {
          return override.encoding;
        }
        if (override.extension && extname(resource) === `.${override.extension}`) {
          return override.encoding;
        }
      }
    }
    return void 0;
  }
};
EncodingOracle = __decorateClass([
  __decorateParam(0, ITextResourceConfigurationService),
  __decorateParam(1, IWorkbenchEnvironmentService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IUriIdentityService)
], EncodingOracle);
export {
  AbstractTextFileService,
  EncodingOracle
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dGZpbGUvYnJvd3Nlci90ZXh0RmlsZVNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUVuY29kaW5nU3VwcG9ydCwgSVRleHRGaWxlU2VydmljZSwgSVRleHRGaWxlU3RyZWFtQ29udGVudCwgSVRleHRGaWxlQ29udGVudCwgSVJlc291cmNlRW5jb2RpbmdzLCBJUmVhZFRleHRGaWxlT3B0aW9ucywgSVdyaXRlVGV4dEZpbGVPcHRpb25zLCB0b0J1ZmZlck9yUmVhZGFibGUsIFRleHRGaWxlT3BlcmF0aW9uRXJyb3IsIFRleHRGaWxlT3BlcmF0aW9uUmVzdWx0LCBJVGV4dEZpbGVTYXZlT3B0aW9ucywgSVRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyLCBJUmVzb3VyY2VFbmNvZGluZywgc3RyaW5nVG9TbmFwc2hvdCwgSVRleHRGaWxlU2F2ZUFzT3B0aW9ucywgSVJlYWRUZXh0RmlsZUVuY29kaW5nT3B0aW9ucywgVGV4dEZpbGVFZGl0b3JNb2RlbFN0YXRlIH0gZnJvbSAnLi4vY29tbW9uL3RleHRmaWxlcy5qcyc7XG5pbXBvcnQgeyBJUmV2ZXJ0T3B0aW9ucywgU2F2ZVNvdXJjZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uLy4uL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSwgRmlsZU9wZXJhdGlvbkVycm9yLCBGaWxlT3BlcmF0aW9uUmVzdWx0LCBJRmlsZVN0YXRXaXRoTWV0YWRhdGEsIElDcmVhdGVGaWxlT3B0aW9ucywgSUZpbGVTdHJlYW1Db250ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZXh0bmFtZSBhcyBwYXRoRXh0bmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVudGl0bGVkVGV4dEVkaXRvclNlcnZpY2UsIElVbnRpdGxlZFRleHRFZGl0b3JNb2RlbE1hbmFnZXIgfSBmcm9tICcuLi8uLi91bnRpdGxlZC9jb21tb24vdW50aXRsZWRUZXh0RWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBVbnRpdGxlZFRleHRFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uL3VudGl0bGVkL2NvbW1vbi91bnRpdGxlZFRleHRFZGl0b3JNb2RlbC5qcyc7XG5pbXBvcnQgeyBUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlciB9IGZyb20gJy4uL2NvbW1vbi90ZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5RnJvbVNuYXBzaG90LCBjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeUZyb21TdHJlYW0gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBqb2luUGF0aCwgZGlybmFtZSwgYmFzZW5hbWUsIHRvTG9jYWxSZXNvdXJjZSwgZXh0bmFtZSwgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSwgSUZpbGVEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciwgVlNCdWZmZXJSZWFkYWJsZSwgYnVmZmVyVG9TdHJlYW0sIFZTQnVmZmVyUmVhZGFibGVTdHJlYW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgSVRleHRTbmFwc2hvdCwgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFBMQUlOVEVYVF9MQU5HVUFHRV9JRCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL21vZGVzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9maWxlc0NvbmZpZ3VyYXRpb24vY29tbW9uL2ZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVJlc29sdmVkVGV4dEVkaXRvck1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQmFzZVRleHRFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvdGV4dEVkaXRvck1vZGVsLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQYXRoU2VydmljZSB9IGZyb20gJy4uLy4uL3BhdGgvY29tbW9uL3BhdGhTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUZpbGVTZXJ2aWNlLCBJRmlsZU9wZXJhdGlvblVuZG9SZWRvSW5mbywgSUNyZWF0ZUZpbGVPcGVyYXRpb24gfSBmcm9tICcuLi8uLi93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHlGaWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgV09SS1NQQUNFX0VYVEVOU0lPTiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFVURjgsIFVURjhfd2l0aF9ib20sIFVURjE2YmUsIFVURjE2bGUsIGVuY29kaW5nRXhpc3RzLCB0b0VuY29kZVJlYWRhYmxlLCB0b0RlY29kZVN0cmVhbSwgSURlY29kZVN0cmVhbVJlc3VsdCwgRGVjb2RlU3RyZWFtRXJyb3IsIERlY29kZVN0cmVhbUVycm9yS2luZCB9IGZyb20gJy4uL2NvbW1vbi9lbmNvZGluZy5qcyc7XG5pbXBvcnQgeyBjb25zdW1lU3RyZWFtLCBSZWFkYWJsZVN0cmVhbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmVhbS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSUVsZXZhdGVkRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9maWxlcy9jb21tb24vZWxldmF0ZWRGaWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRGVjb3JhdGlvbkRhdGEsIElEZWNvcmF0aW9uc1Byb3ZpZGVyLCBJRGVjb3JhdGlvbnNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZGVjb3JhdGlvbnMvY29tbW9uL2RlY29yYXRpb25zLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgbGlzdEVycm9yRm9yZWdyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0VGV4dEZpbGVTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUZXh0RmlsZVNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFRFWFRGSUxFX1NBVkVfQ1JFQVRFX1NPVVJDRSA9IFNhdmVTb3VyY2VSZWdpc3RyeS5yZWdpc3RlclNvdXJjZSgndGV4dEZpbGVDcmVhdGUuc291cmNlJywgbG9jYWxpemUoJ3RleHRGaWxlQ3JlYXRlLnNvdXJjZScsIFwiRmlsZSBDcmVhdGVkXCIpKTtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgVEVYVEZJTEVfU0FWRV9SRVBMQUNFX1NPVVJDRSA9IFNhdmVTb3VyY2VSZWdpc3RyeS5yZWdpc3RlclNvdXJjZSgndGV4dEZpbGVPdmVyd3JpdGUuc291cmNlJywgbG9jYWxpemUoJ3RleHRGaWxlT3ZlcndyaXRlLnNvdXJjZScsIFwiRmlsZSBSZXBsYWNlZFwiKSk7XG5cblx0cmVhZG9ubHkgZmlsZXM6IElUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlcjtcblxuXHRyZWFkb25seSB1bnRpdGxlZDogSVVudGl0bGVkVGV4dEVkaXRvck1vZGVsTWFuYWdlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUZpbGVTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJVW50aXRsZWRUZXh0RWRpdG9yU2VydmljZSB1bnRpdGxlZFRleHRFZGl0b3JTZXJ2aWNlOiBJVW50aXRsZWRUZXh0RWRpdG9yTW9kZWxNYW5hZ2VyLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJRmlsZURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlRGlhbG9nU2VydmljZTogSUZpbGVEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBmaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvZGVFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASVBhdGhTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcGF0aFNlcnZpY2U6IElQYXRoU2VydmljZSxcblx0XHRASVdvcmtpbmdDb3B5RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3JraW5nQ29weUZpbGVTZXJ2aWNlOiBJV29ya2luZ0NvcHlGaWxlU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRWxldmF0ZWRGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVsZXZhdGVkRmlsZVNlcnZpY2U6IElFbGV2YXRlZEZpbGVTZXJ2aWNlLFxuXHRcdEBJRGVjb3JhdGlvbnNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGVjb3JhdGlvbnNTZXJ2aWNlOiBJRGVjb3JhdGlvbnNTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmZpbGVzID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlcikpO1xuXHRcdHRoaXMudW50aXRsZWQgPSB1bnRpdGxlZFRleHRFZGl0b3JTZXJ2aWNlO1xuXG5cdFx0dGhpcy5wcm92aWRlRGVjb3JhdGlvbnMoKTtcblx0fVxuXG5cdC8vI3JlZ2lvbiBkZWNvcmF0aW9uc1xuXG5cdHByaXZhdGUgcHJvdmlkZURlY29yYXRpb25zKCk6IHZvaWQge1xuXG5cdFx0Ly8gVGV4dCBmaWxlIG1vZGVsIGRlY29yYXRpb25zXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgY2xhc3MgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSURlY29yYXRpb25zUHJvdmlkZXIge1xuXG5cdFx0XHRyZWFkb25seSBsYWJlbCA9IGxvY2FsaXplKCd0ZXh0RmlsZU1vZGVsRGVjb3JhdGlvbnMnLCBcIlRleHQgRmlsZSBNb2RlbCBEZWNvcmF0aW9uc1wiKTtcblxuXHRcdFx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxVUklbXT4oKSk7XG5cdFx0XHRyZWFkb25seSBvbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdFx0XHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGZpbGVzOiBJVGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXIpIHtcblx0XHRcdFx0c3VwZXIoKTtcblxuXHRcdFx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdFx0XHR9XG5cblx0XHRcdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cblx0XHRcdFx0Ly8gQ3JlYXRlc1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVzLm9uRGlkUmVzb2x2ZSgoeyBtb2RlbCB9KSA9PiB7XG5cdFx0XHRcdFx0aWYgKG1vZGVsLmlzUmVhZG9ubHkoKSB8fCBtb2RlbC5oYXNTdGF0ZShUZXh0RmlsZUVkaXRvck1vZGVsU3RhdGUuT1JQSEFOKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZShbbW9kZWwucmVzb3VyY2VdKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblxuXHRcdFx0XHQvLyBSZW1vdmFsczogb25jZSBhIHRleHQgZmlsZSBtb2RlbCBpcyBubyBsb25nZXJcblx0XHRcdFx0Ly8gdW5kZXIgb3VyIGNvbnRyb2wsIG1ha2Ugc3VyZSB0byBzaWduYWwgdGhpcyBhc1xuXHRcdFx0XHQvLyBkZWNvcmF0aW9uIGNoYW5nZSBiZWNhdXNlIGZyb20gdGhpcyBwb2ludCBvbiB3ZVxuXHRcdFx0XHQvLyBoYXZlIG5vIHdheSBvZiB1cGRhdGluZyB0aGUgZGVjb3JhdGlvbiBhbnltb3JlLlxuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVzLm9uRGlkUmVtb3ZlKG1vZGVsVXJpID0+IHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoW21vZGVsVXJpXSkpKTtcblxuXHRcdFx0XHQvLyBDaGFuZ2VzXG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZXMub25EaWRDaGFuZ2VSZWFkb25seShtb2RlbCA9PiB0aGlzLl9vbkRpZENoYW5nZS5maXJlKFttb2RlbC5yZXNvdXJjZV0pKSk7XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZXMub25EaWRDaGFuZ2VPcnBoYW5lZChtb2RlbCA9PiB0aGlzLl9vbkRpZENoYW5nZS5maXJlKFttb2RlbC5yZXNvdXJjZV0pKSk7XG5cdFx0XHR9XG5cblx0XHRcdHByb3ZpZGVEZWNvcmF0aW9ucyh1cmk6IFVSSSk6IElEZWNvcmF0aW9uRGF0YSB8IHVuZGVmaW5lZCB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5maWxlcy5nZXQodXJpKTtcblx0XHRcdFx0aWYgKCFtb2RlbCB8fCBtb2RlbC5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgaXNSZWFkb25seSA9IG1vZGVsLmlzUmVhZG9ubHkoKTtcblx0XHRcdFx0Y29uc3QgaXNPcnBoYW5lZCA9IG1vZGVsLmhhc1N0YXRlKFRleHRGaWxlRWRpdG9yTW9kZWxTdGF0ZS5PUlBIQU4pO1xuXG5cdFx0XHRcdC8vIFJlYWRvbmx5ICsgT3JwaGFuZWRcblx0XHRcdFx0aWYgKGlzUmVhZG9ubHkgJiYgaXNPcnBoYW5lZCkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRjb2xvcjogbGlzdEVycm9yRm9yZWdyb3VuZCxcblx0XHRcdFx0XHRcdGxldHRlcjogQ29kaWNvbi5sb2NrU21hbGwsXG5cdFx0XHRcdFx0XHRzdHJpa2V0aHJvdWdoOiB0cnVlLFxuXHRcdFx0XHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ3JlYWRvbmx5QW5kRGVsZXRlZCcsIFwiRGVsZXRlZCwgUmVhZC1vbmx5XCIpLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBSZWFkb25seVxuXHRcdFx0XHRlbHNlIGlmIChpc1JlYWRvbmx5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGxldHRlcjogQ29kaWNvbi5sb2NrU21hbGwsXG5cdFx0XHRcdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgncmVhZG9ubHknLCBcIlJlYWQtb25seVwiKSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gT3JwaGFuZWRcblx0XHRcdFx0ZWxzZSBpZiAoaXNPcnBoYW5lZCkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRjb2xvcjogbGlzdEVycm9yRm9yZWdyb3VuZCxcblx0XHRcdFx0XHRcdHN0cmlrZXRocm91Z2g6IHRydWUsXG5cdFx0XHRcdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnZGVsZXRlZCcsIFwiRGVsZXRlZFwiKSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KHRoaXMuZmlsZXMpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZGVjb3JhdGlvbnNTZXJ2aWNlLnJlZ2lzdGVyRGVjb3JhdGlvbnNQcm92aWRlcihwcm92aWRlcikpO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIHRleHQgZmlsZSByZWFkIC8gd3JpdGUgLyBjcmVhdGVcblxuXHRwcml2YXRlIF9lbmNvZGluZzogRW5jb2RpbmdPcmFjbGUgfCB1bmRlZmluZWQ7XG5cblx0Z2V0IGVuY29kaW5nKCk6IEVuY29kaW5nT3JhY2xlIHtcblx0XHRpZiAoIXRoaXMuX2VuY29kaW5nKSB7XG5cdFx0XHR0aGlzLl9lbmNvZGluZyA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRW5jb2RpbmdPcmFjbGUpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fZW5jb2Rpbmc7XG5cdH1cblxuXHRhc3luYyByZWFkKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJUmVhZFRleHRGaWxlT3B0aW9ucyk6IFByb21pc2U8SVRleHRGaWxlQ29udGVudD4ge1xuXHRcdGNvbnN0IFtidWZmZXJTdHJlYW0sIGRlY29kZXJdID0gYXdhaXQgdGhpcy5kb1JlYWQocmVzb3VyY2UsIHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHQvLyBvcHRpbWl6YXRpb246IHNpbmNlIHdlIGtub3cgdGhhdCB0aGUgY2FsbGVyIGRvZXMgbm90XG5cdFx0XHQvLyBjYXJlIGFib3V0IGJ1ZmZlcmluZywgd2UgaW5kaWNhdGUgdGhpcyB0byB0aGUgcmVhZGVyLlxuXHRcdFx0Ly8gdGhpcyByZWR1Y2VzIGFsbCB0aGUgb3ZlcmhlYWQgdGhlIGJ1ZmZlcmVkIHJlYWRpbmdcblx0XHRcdC8vIGhhcyAob3BlbiwgcmVhZCwgY2xvc2UpIGlmIHRoZSBwcm92aWRlciBzdXBwb3J0c1xuXHRcdFx0Ly8gdW5idWZmZXJlZCByZWFkaW5nLlxuXHRcdFx0cHJlZmVyVW5idWZmZXJlZDogdHJ1ZVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdC4uLmJ1ZmZlclN0cmVhbSxcblx0XHRcdGVuY29kaW5nOiBkZWNvZGVyLmRldGVjdGVkLmVuY29kaW5nIHx8IFVURjgsXG5cdFx0XHR2YWx1ZTogYXdhaXQgY29uc3VtZVN0cmVhbShkZWNvZGVyLnN0cmVhbSwgc3RyaW5ncyA9PiBzdHJpbmdzLmpvaW4oJycpKVxuXHRcdH07XG5cdH1cblxuXHRhc3luYyByZWFkU3RyZWFtKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJUmVhZFRleHRGaWxlT3B0aW9ucyk6IFByb21pc2U8SVRleHRGaWxlU3RyZWFtQ29udGVudD4ge1xuXHRcdGNvbnN0IFtidWZmZXJTdHJlYW0sIGRlY29kZXJdID0gYXdhaXQgdGhpcy5kb1JlYWQocmVzb3VyY2UsIG9wdGlvbnMpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdC4uLmJ1ZmZlclN0cmVhbSxcblx0XHRcdGVuY29kaW5nOiBkZWNvZGVyLmRldGVjdGVkLmVuY29kaW5nIHx8IFVURjgsXG5cdFx0XHR2YWx1ZTogYXdhaXQgY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnlGcm9tU3RyZWFtKGRlY29kZXIuc3RyZWFtKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvUmVhZChyZXNvdXJjZTogVVJJLCBvcHRpb25zPzogSVJlYWRUZXh0RmlsZU9wdGlvbnMgJiB7IHByZWZlclVuYnVmZmVyZWQ/OiBib29sZWFuIH0pOiBQcm9taXNlPFtJRmlsZVN0cmVhbUNvbnRlbnQsIElEZWNvZGVTdHJlYW1SZXN1bHRdPiB7XG5cdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cblx0XHQvLyByZWFkIHN0cmVhbSByYXcgKGVpdGhlciBidWZmZXJlZCBvciB1bmJ1ZmZlcmVkKVxuXHRcdGxldCBidWZmZXJTdHJlYW06IElGaWxlU3RyZWFtQ29udGVudDtcblx0XHRpZiAob3B0aW9ucz8ucHJlZmVyVW5idWZmZXJlZCkge1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVhZEZpbGUocmVzb3VyY2UsIG9wdGlvbnMsIGN0cy50b2tlbik7XG5cdFx0XHRidWZmZXJTdHJlYW0gPSB7XG5cdFx0XHRcdC4uLmNvbnRlbnQsXG5cdFx0XHRcdHZhbHVlOiBidWZmZXJUb1N0cmVhbShjb250ZW50LnZhbHVlKVxuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YnVmZmVyU3RyZWFtID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZVN0cmVhbShyZXNvdXJjZSwgb3B0aW9ucywgY3RzLnRva2VuKTtcblx0XHR9XG5cblx0XHQvLyByZWFkIHRocm91Z2ggZW5jb2RpbmcgbGlicmFyeVxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBkZWNvZGVyID0gYXdhaXQgdGhpcy5kb0dldERlY29kZWRTdHJlYW0ocmVzb3VyY2UsIGJ1ZmZlclN0cmVhbS52YWx1ZSwgb3B0aW9ucyk7XG5cblx0XHRcdHJldHVybiBbYnVmZmVyU3RyZWFtLCBkZWNvZGVyXTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXG5cdFx0XHQvLyBNYWtlIHN1cmUgdG8gY2FuY2VsIHJlYWRpbmcgb24gZXJyb3IgdG9cblx0XHRcdC8vIHN0b3AgZmlsZSBzZXJ2aWNlIGFjdGl2aXR5IGFzIHNvb24gYXNcblx0XHRcdC8vIHBvc3NpYmxlLiBXaGVuIGZvciBleGFtcGxlIGEgbGFyZ2UgYmluYXJ5XG5cdFx0XHQvLyBmaWxlIGlzIHJlYWQgd2Ugd2FudCB0byBjYW5jZWwgdGhlIHJlYWRcblx0XHRcdC8vIGluc3RhbnRseS5cblx0XHRcdC8vIFJlZnM6XG5cdFx0XHQvLyAtIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMzg4MDVcblx0XHRcdC8vIC0gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzMjc3MVxuXHRcdFx0Y3RzLmRpc3Bvc2UodHJ1ZSk7XG5cblx0XHRcdC8vIHNwZWNpYWwgdHJlYXRtZW50IGZvciBzdHJlYW1zIHRoYXQgYXJlIGJpbmFyeVxuXHRcdFx0aWYgKCg8RGVjb2RlU3RyZWFtRXJyb3I+ZXJyb3IpLmRlY29kZVN0cmVhbUVycm9yS2luZCA9PT0gRGVjb2RlU3RyZWFtRXJyb3JLaW5kLlNUUkVBTV9JU19CSU5BUlkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IFRleHRGaWxlT3BlcmF0aW9uRXJyb3IobG9jYWxpemUoJ2ZpbGVCaW5hcnlFcnJvcicsIFwiRmlsZSBzZWVtcyB0byBiZSBiaW5hcnkgYW5kIGNhbm5vdCBiZSBvcGVuZWQgYXMgdGV4dFwiKSwgVGV4dEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9JU19CSU5BUlksIG9wdGlvbnMpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyByZS10aHJvdyBhbnkgb3RoZXIgZXJyb3IgYXMgaXQgaXNcblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRhc3luYyBjcmVhdGUob3BlcmF0aW9uczogeyByZXNvdXJjZTogVVJJOyB2YWx1ZT86IHN0cmluZyB8IElUZXh0U25hcHNob3Q7IG9wdGlvbnM/OiBJQ3JlYXRlRmlsZU9wdGlvbnMgfVtdLCB1bmRvSW5mbz86IElGaWxlT3BlcmF0aW9uVW5kb1JlZG9JbmZvKTogUHJvbWlzZTxyZWFkb25seSBJRmlsZVN0YXRXaXRoTWV0YWRhdGFbXT4ge1xuXHRcdGNvbnN0IG9wZXJhdGlvbnNXaXRoQ29udGVudHM6IElDcmVhdGVGaWxlT3BlcmF0aW9uW10gPSBhd2FpdCBQcm9taXNlLmFsbChvcGVyYXRpb25zLm1hcChhc3luYyBvcGVyYXRpb24gPT4ge1xuXHRcdFx0Y29uc3QgY29udGVudHMgPSBhd2FpdCB0aGlzLmdldEVuY29kZWRSZWFkYWJsZShvcGVyYXRpb24ucmVzb3VyY2UsIG9wZXJhdGlvbi52YWx1ZSk7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyZXNvdXJjZTogb3BlcmF0aW9uLnJlc291cmNlLFxuXHRcdFx0XHRjb250ZW50cyxcblx0XHRcdFx0b3ZlcndyaXRlOiBvcGVyYXRpb24ub3B0aW9ucz8ub3ZlcndyaXRlXG5cdFx0XHR9O1xuXHRcdH0pKTtcblxuXHRcdHJldHVybiB0aGlzLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuY3JlYXRlKG9wZXJhdGlvbnNXaXRoQ29udGVudHMsIENhbmNlbGxhdGlvblRva2VuLk5vbmUsIHVuZG9JbmZvKTtcblx0fVxuXG5cdGFzeW5jIHdyaXRlKHJlc291cmNlOiBVUkksIHZhbHVlOiBzdHJpbmcgfCBJVGV4dFNuYXBzaG90LCBvcHRpb25zPzogSVdyaXRlVGV4dEZpbGVPcHRpb25zKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGE+IHtcblx0XHRjb25zdCByZWFkYWJsZSA9IGF3YWl0IHRoaXMuZ2V0RW5jb2RlZFJlYWRhYmxlKHJlc291cmNlLCB2YWx1ZSwgb3B0aW9ucyk7XG5cblx0XHRpZiAob3B0aW9ucz8ud3JpdGVFbGV2YXRlZCAmJiB0aGlzLmVsZXZhdGVkRmlsZVNlcnZpY2UuaXNTdXBwb3J0ZWQocmVzb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5lbGV2YXRlZEZpbGVTZXJ2aWNlLndyaXRlRmlsZUVsZXZhdGVkKHJlc291cmNlLCByZWFkYWJsZSwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHJlc291cmNlLCByZWFkYWJsZSwgb3B0aW9ucyk7XG5cdH1cblxuXHRnZXRFbmNvZGluZyhyZXNvdXJjZTogVVJJKTogc3RyaW5nIHtcblx0XHRjb25zdCBtb2RlbCA9IHJlc291cmNlLnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCA/IHRoaXMudW50aXRsZWQuZ2V0KHJlc291cmNlKSA6IHRoaXMuZmlsZXMuZ2V0KHJlc291cmNlKTtcblx0XHRyZXR1cm4gbW9kZWw/LmdldEVuY29kaW5nKCkgPz8gdGhpcy5lbmNvZGluZy5nZXRVbnZhbGlkYXRlZEVuY29kaW5nRm9yUmVzb3VyY2UocmVzb3VyY2UpO1xuXHR9XG5cblx0YXN5bmMgZ2V0RW5jb2RlZFJlYWRhYmxlKHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQsIHZhbHVlOiBJVGV4dFNuYXBzaG90KTogUHJvbWlzZTxWU0J1ZmZlclJlYWRhYmxlPjtcblx0YXN5bmMgZ2V0RW5jb2RlZFJlYWRhYmxlKHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQsIHZhbHVlOiBzdHJpbmcpOiBQcm9taXNlPFZTQnVmZmVyIHwgVlNCdWZmZXJSZWFkYWJsZT47XG5cdGFzeW5jIGdldEVuY29kZWRSZWFkYWJsZShyZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkLCB2YWx1ZT86IElUZXh0U25hcHNob3QpOiBQcm9taXNlPFZTQnVmZmVyUmVhZGFibGUgfCB1bmRlZmluZWQ+O1xuXHRhc3luYyBnZXRFbmNvZGVkUmVhZGFibGUocmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCwgdmFsdWU/OiBzdHJpbmcpOiBQcm9taXNlPFZTQnVmZmVyIHwgVlNCdWZmZXJSZWFkYWJsZSB8IHVuZGVmaW5lZD47XG5cdGFzeW5jIGdldEVuY29kZWRSZWFkYWJsZShyZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkLCB2YWx1ZT86IHN0cmluZyB8IElUZXh0U25hcHNob3QpOiBQcm9taXNlPFZTQnVmZmVyIHwgVlNCdWZmZXJSZWFkYWJsZSB8IHVuZGVmaW5lZD47XG5cdGFzeW5jIGdldEVuY29kZWRSZWFkYWJsZShyZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkLCB2YWx1ZTogc3RyaW5nIHwgSVRleHRTbmFwc2hvdCwgb3B0aW9ucz86IElXcml0ZVRleHRGaWxlT3B0aW9ucyk6IFByb21pc2U8VlNCdWZmZXIgfCBWU0J1ZmZlclJlYWRhYmxlPjtcblx0YXN5bmMgZ2V0RW5jb2RlZFJlYWRhYmxlKHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQsIHZhbHVlPzogc3RyaW5nIHwgSVRleHRTbmFwc2hvdCwgb3B0aW9ucz86IElXcml0ZVRleHRGaWxlT3B0aW9ucyk6IFByb21pc2U8VlNCdWZmZXIgfCBWU0J1ZmZlclJlYWRhYmxlIHwgdW5kZWZpbmVkPiB7XG5cblx0XHQvLyBjaGVjayBmb3IgZW5jb2Rpbmdcblx0XHRjb25zdCB7IGVuY29kaW5nLCBhZGRCT00gfSA9IGF3YWl0IHRoaXMuZW5jb2RpbmcuZ2V0V3JpdGVFbmNvZGluZyhyZXNvdXJjZSwgb3B0aW9ucyk7XG5cblx0XHQvLyB3aGVuIGVuY29kaW5nIGlzIHN0YW5kYXJkIHNraXAgZW5jb2Rpbmcgc3RlcFxuXHRcdGlmIChlbmNvZGluZyA9PT0gVVRGOCAmJiAhYWRkQk9NKSB7XG5cdFx0XHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJ1xuXHRcdFx0XHQ/IHVuZGVmaW5lZFxuXHRcdFx0XHQ6IHRvQnVmZmVyT3JSZWFkYWJsZSh2YWx1ZSk7XG5cdFx0fVxuXG5cdFx0Ly8gb3RoZXJ3aXNlIGNyZWF0ZSBlbmNvZGVkIHJlYWRhYmxlXG5cdFx0dmFsdWUgPSB2YWx1ZSB8fCAnJztcblx0XHRjb25zdCBzbmFwc2hvdCA9IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyBzdHJpbmdUb1NuYXBzaG90KHZhbHVlKSA6IHZhbHVlO1xuXHRcdHJldHVybiB0b0VuY29kZVJlYWRhYmxlKHNuYXBzaG90LCBlbmNvZGluZywgeyBhZGRCT00gfSk7XG5cdH1cblxuXHRhc3luYyBnZXREZWNvZGVkU3RyZWFtKHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQsIHZhbHVlOiBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtLCBvcHRpb25zPzogSVJlYWRUZXh0RmlsZUVuY29kaW5nT3B0aW9ucyk6IFByb21pc2U8UmVhZGFibGVTdHJlYW08c3RyaW5nPj4ge1xuXHRcdHJldHVybiAoYXdhaXQgdGhpcy5kb0dldERlY29kZWRTdHJlYW0ocmVzb3VyY2UsIHZhbHVlLCBvcHRpb25zKSkuc3RyZWFtO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0dldERlY29kZWRTdHJlYW0ocmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCwgc3RyZWFtOiBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtLCBvcHRpb25zPzogSVJlYWRUZXh0RmlsZUVuY29kaW5nT3B0aW9ucyk6IFByb21pc2U8SURlY29kZVN0cmVhbVJlc3VsdD4ge1xuXG5cdFx0Ly8gcmVhZCB0aHJvdWdoIGVuY29kaW5nIGxpYnJhcnlcblx0XHRyZXR1cm4gdG9EZWNvZGVTdHJlYW0oc3RyZWFtLCB7XG5cdFx0XHRhY2NlcHRUZXh0T25seTogb3B0aW9ucz8uYWNjZXB0VGV4dE9ubHkgPz8gZmFsc2UsXG5cdFx0XHRndWVzc0VuY29kaW5nOlxuXHRcdFx0XHRvcHRpb25zPy5hdXRvR3Vlc3NFbmNvZGluZyB8fFxuXHRcdFx0XHR0aGlzLnRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKHJlc291cmNlLCAnZmlsZXMuYXV0b0d1ZXNzRW5jb2RpbmcnKSxcblx0XHRcdGNhbmRpZGF0ZUd1ZXNzRW5jb2RpbmdzOlxuXHRcdFx0XHRvcHRpb25zPy5jYW5kaWRhdGVHdWVzc0VuY29kaW5ncyB8fFxuXHRcdFx0XHR0aGlzLnRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKHJlc291cmNlLCAnZmlsZXMuY2FuZGlkYXRlR3Vlc3NFbmNvZGluZ3MnKSxcblx0XHRcdG92ZXJ3cml0ZUVuY29kaW5nOiBhc3luYyBkZXRlY3RlZEVuY29kaW5nID0+IHtcblx0XHRcdFx0Y29uc3QgeyBlbmNvZGluZyB9ID0gYXdhaXQgdGhpcy5lbmNvZGluZy5nZXRQcmVmZXJyZWRSZWFkRW5jb2RpbmcocmVzb3VyY2UsIG9wdGlvbnMsIGRldGVjdGVkRW5jb2RpbmcgPz8gdW5kZWZpbmVkKTtcblxuXHRcdFx0XHRyZXR1cm4gZW5jb2Rpbmc7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXG5cdC8vI3JlZ2lvbiBzYXZlXG5cblx0YXN5bmMgc2F2ZShyZXNvdXJjZTogVVJJLCBvcHRpb25zPzogSVRleHRGaWxlU2F2ZU9wdGlvbnMpOiBQcm9taXNlPFVSSSB8IHVuZGVmaW5lZD4ge1xuXG5cdFx0Ly8gVW50aXRsZWRcblx0XHRpZiAocmVzb3VyY2Uuc2NoZW1lID09PSBTY2hlbWFzLnVudGl0bGVkKSB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMudW50aXRsZWQuZ2V0KHJlc291cmNlKTtcblx0XHRcdGlmIChtb2RlbCkge1xuXHRcdFx0XHRsZXQgdGFyZ2V0VXJpOiBVUkkgfCB1bmRlZmluZWQ7XG5cblx0XHRcdFx0Ly8gVW50aXRsZWQgd2l0aCBhc3NvY2lhdGVkIGZpbGUgcGF0aCBkb24ndCBuZWVkIHRvIHByb21wdFxuXHRcdFx0XHRpZiAobW9kZWwuaGFzQXNzb2NpYXRlZEZpbGVQYXRoKSB7XG5cdFx0XHRcdFx0dGFyZ2V0VXJpID0gYXdhaXQgdGhpcy5zdWdnZXN0U2F2ZVBhdGgocmVzb3VyY2UpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gT3RoZXJ3aXNlIGFzayB1c2VyXG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHRhcmdldFVyaSA9IGF3YWl0IHRoaXMuZmlsZURpYWxvZ1NlcnZpY2UucGlja0ZpbGVUb1NhdmUoYXdhaXQgdGhpcy5zdWdnZXN0U2F2ZVBhdGgocmVzb3VyY2UpLCBvcHRpb25zPy5hdmFpbGFibGVGaWxlU3lzdGVtcyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTYXZlIGFzIGlmIHRhcmdldCBwcm92aWRlZFxuXHRcdFx0XHRpZiAodGFyZ2V0VXJpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2F2ZUFzKHJlc291cmNlLCB0YXJnZXRVcmksIG9wdGlvbnMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRmlsZVxuXHRcdGVsc2Uge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmZpbGVzLmdldChyZXNvdXJjZSk7XG5cdFx0XHRpZiAobW9kZWwpIHtcblx0XHRcdFx0cmV0dXJuIGF3YWl0IG1vZGVsLnNhdmUob3B0aW9ucykgPyByZXNvdXJjZSA6IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0YXN5bmMgc2F2ZUFzKHNvdXJjZTogVVJJLCB0YXJnZXQ/OiBVUkksIG9wdGlvbnM/OiBJVGV4dEZpbGVTYXZlQXNPcHRpb25zKTogUHJvbWlzZTxVUkkgfCB1bmRlZmluZWQ+IHtcblxuXHRcdC8vIEdldCB0byB0YXJnZXQgcmVzb3VyY2Vcblx0XHRpZiAoIXRhcmdldCkge1xuXHRcdFx0dGFyZ2V0ID0gYXdhaXQgdGhpcy5maWxlRGlhbG9nU2VydmljZS5waWNrRmlsZVRvU2F2ZShhd2FpdCB0aGlzLnN1Z2dlc3RTYXZlUGF0aChvcHRpb25zPy5zdWdnZXN0ZWRUYXJnZXQgPz8gc291cmNlKSwgb3B0aW9ucz8uYXZhaWxhYmxlRmlsZVN5c3RlbXMpO1xuXHRcdH1cblxuXHRcdGlmICghdGFyZ2V0KSB7XG5cdFx0XHRyZXR1cm47IC8vIHVzZXIgY2FuY2VsZWRcblx0XHR9XG5cblx0XHQvLyBFbnN1cmUgdGFyZ2V0IGlzIG5vdCBtYXJrZWQgYXMgcmVhZG9ubHkgYW5kIHByb21wdCBvdGhlcndpc2Vcblx0XHRpZiAodGhpcy5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmlzUmVhZG9ubHkodGFyZ2V0KSkge1xuXHRcdFx0Y29uc3QgY29uZmlybWVkID0gYXdhaXQgdGhpcy5jb25maXJtTWFrZVdyaXRlYWJsZSh0YXJnZXQpO1xuXHRcdFx0aWYgKCFjb25maXJtZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVJlYWRvbmx5KHRhcmdldCwgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEp1c3Qgc2F2ZSBpZiB0YXJnZXQgaXMgc2FtZSBhcyBtb2RlbHMgb3duIHJlc291cmNlXG5cdFx0aWYgKGlzRXF1YWwoc291cmNlLCB0YXJnZXQpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zYXZlKHNvdXJjZSwgeyAuLi5vcHRpb25zLCBmb3JjZTogdHJ1ZSAgLyogZm9yY2UgdG8gc2F2ZSwgZXZlbiBpZiBub3QgZGlydHkgKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy85OTYxOSkgKi8gfSk7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIHRhcmdldCBpcyBkaWZmZXJlbnQgYnV0IG9mIHNhbWUgaWRlbnRpdHksIHdlXG5cdFx0Ly8gbW92ZSB0aGUgc291cmNlIHRvIHRoZSB0YXJnZXQsIGtub3dpbmcgdGhhdCB0aGVcblx0XHQvLyB1bmRlcmx5aW5nIGZpbGUgc3lzdGVtIGNhbm5vdCBoYXZlIGJvdGggYW5kIHRoZW4gc2F2ZS5cblx0XHQvLyBIb3dldmVyLCB0aGlzIHdpbGwgb25seSB3b3JrIGlmIHRoZSBzb3VyY2UgZXhpc3RzXG5cdFx0Ly8gYW5kIGlzIG5vdCBvcnBoYW5lZCwgc28gd2UgbmVlZCB0byBjaGVjayB0aGF0IHRvby5cblx0XHRpZiAodGhpcy5maWxlU2VydmljZS5oYXNQcm92aWRlcihzb3VyY2UpICYmIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKHNvdXJjZSwgdGFyZ2V0KSAmJiAoYXdhaXQgdGhpcy5maWxlU2VydmljZS5leGlzdHMoc291cmNlKSkpIHtcblx0XHRcdGF3YWl0IHRoaXMud29ya2luZ0NvcHlGaWxlU2VydmljZS5tb3ZlKFt7IGZpbGU6IHsgc291cmNlLCB0YXJnZXQgfSB9XSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRcdC8vIEF0IHRoaXMgcG9pbnQgd2UgZG9uJ3Qga25vdyB3aGV0aGVyIHdlIGhhdmUgYVxuXHRcdFx0Ly8gbW9kZWwgZm9yIHRoZSBzb3VyY2Ugb3IgdGhlIHRhcmdldCBVUkkgc28gd2Vcblx0XHRcdC8vIHNpbXBseSB0cnkgdG8gc2F2ZSB3aXRoIGJvdGggcmVzb3VyY2VzLlxuXHRcdFx0Y29uc3Qgc3VjY2VzcyA9IGF3YWl0IHRoaXMuc2F2ZShzb3VyY2UsIG9wdGlvbnMpO1xuXHRcdFx0aWYgKCFzdWNjZXNzKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc2F2ZSh0YXJnZXQsIG9wdGlvbnMpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdGFyZ2V0O1xuXHRcdH1cblxuXHRcdC8vIERvIGl0XG5cdFx0cmV0dXJuIHRoaXMuZG9TYXZlQXMoc291cmNlLCB0YXJnZXQsIG9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1NhdmVBcyhzb3VyY2U6IFVSSSwgdGFyZ2V0OiBVUkksIG9wdGlvbnM/OiBJVGV4dEZpbGVTYXZlT3B0aW9ucyk6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7XG5cdFx0bGV0IHN1Y2Nlc3MgPSBmYWxzZTtcblxuXHRcdC8vIElmIHRoZSBzb3VyY2UgaXMgYW4gZXhpc3RpbmcgdGV4dCBmaWxlIG1vZGVsLCB3ZSBjYW4gZGlyZWN0bHlcblx0XHQvLyB1c2UgdGhhdCBtb2RlbCB0byBjb3B5IHRoZSBjb250ZW50cyB0byB0aGUgdGFyZ2V0IGRlc3RpbmF0aW9uXG5cdFx0Y29uc3QgdGV4dEZpbGVNb2RlbCA9IHRoaXMuZmlsZXMuZ2V0KHNvdXJjZSk7XG5cdFx0aWYgKHRleHRGaWxlTW9kZWw/LmlzUmVzb2x2ZWQoKSkge1xuXHRcdFx0c3VjY2VzcyA9IGF3YWl0IHRoaXMuZG9TYXZlQXNUZXh0RmlsZSh0ZXh0RmlsZU1vZGVsLCBzb3VyY2UsIHRhcmdldCwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0Ly8gT3RoZXJ3aXNlIGlmIHRoZSBzb3VyY2UgY2FuIGJlIGhhbmRsZWQgYnkgdGhlIGZpbGUgc2VydmljZVxuXHRcdC8vIHdlIGNhbiBzaW1wbHkgaW52b2tlIHRoZSBjb3B5KCkgZnVuY3Rpb24gdG8gc2F2ZSBhc1xuXHRcdGVsc2UgaWYgKHRoaXMuZmlsZVNlcnZpY2UuaGFzUHJvdmlkZXIoc291cmNlKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5jb3B5KHNvdXJjZSwgdGFyZ2V0LCB0cnVlKTtcblxuXHRcdFx0c3VjY2VzcyA9IHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gRmluYWxseSB3ZSBzaW1wbHkgY2hlY2sgaWYgd2UgY2FuIGZpbmQgYSBlZGl0b3IgbW9kZWwgdGhhdFxuXHRcdC8vIHdvdWxkIGdpdmUgdXMgYWNjZXNzIHRvIHRoZSBjb250ZW50cy5cblx0XHRlbHNlIHtcblx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IHRoaXMubW9kZWxTZXJ2aWNlLmdldE1vZGVsKHNvdXJjZSk7XG5cdFx0XHRpZiAodGV4dE1vZGVsKSB7XG5cdFx0XHRcdHN1Y2Nlc3MgPSBhd2FpdCB0aGlzLmRvU2F2ZUFzVGV4dEZpbGUodGV4dE1vZGVsLCBzb3VyY2UsIHRhcmdldCwgb3B0aW9ucyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFzdWNjZXNzKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIFJldmVydCB0aGUgc291cmNlXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMucmV2ZXJ0KHNvdXJjZSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0Ly8gSXQgaXMgcG9zc2libGUgdGhhdCByZXZlcnRpbmcgdGhlIHNvdXJjZSBmYWlscywgZm9yIGV4YW1wbGVcblx0XHRcdC8vIHdoZW4gYSByZW1vdGUgaXMgZGlzY29ubmVjdGVkIGFuZCB3ZSBjYW5ub3QgcmVhZCBpdCBhbnltb3JlLlxuXHRcdFx0Ly8gSG93ZXZlciwgdGhpcyBzaG91bGQgbm90IGludGVycnVwdCB0aGUgXCJTYXZlIEFzXCIgZmxvdywgc29cblx0XHRcdC8vIHdlIGdyYWNlZnVsbHkgY2F0Y2ggdGhlIGVycm9yIGFuZCBqdXN0IGxvZyBpdC5cblxuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHR9XG5cblx0XHQvLyBFdmVudHNcblx0XHRpZiAoc291cmNlLnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCkge1xuXHRcdFx0dGhpcy51bnRpdGxlZC5ub3RpZnlEaWRTYXZlKHNvdXJjZSwgdGFyZ2V0KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGFyZ2V0O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1NhdmVBc1RleHRGaWxlKHNvdXJjZU1vZGVsOiBJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWwgfCBJVGV4dE1vZGVsLCBzb3VyY2U6IFVSSSwgdGFyZ2V0OiBVUkksIG9wdGlvbnM/OiBJVGV4dEZpbGVTYXZlT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXG5cdFx0Ly8gRmluZCBzb3VyY2UgZW5jb2RpbmcgaWYgYW55XG5cdFx0bGV0IHNvdXJjZU1vZGVsRW5jb2Rpbmc6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRjb25zdCBzb3VyY2VNb2RlbFdpdGhFbmNvZGluZ1N1cHBvcnQgPSAoc291cmNlTW9kZWwgYXMgdW5rbm93biBhcyBJRW5jb2RpbmdTdXBwb3J0KTtcblx0XHRpZiAodHlwZW9mIHNvdXJjZU1vZGVsV2l0aEVuY29kaW5nU3VwcG9ydC5nZXRFbmNvZGluZyA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0c291cmNlTW9kZWxFbmNvZGluZyA9IHNvdXJjZU1vZGVsV2l0aEVuY29kaW5nU3VwcG9ydC5nZXRFbmNvZGluZygpO1xuXHRcdH1cblxuXHRcdC8vIFByZWZlciBhbiBleGlzdGluZyBtb2RlbCBpZiBpdCBpcyBhbHJlYWR5IHJlc29sdmVkIGZvciB0aGUgZ2l2ZW4gdGFyZ2V0IHJlc291cmNlXG5cdFx0bGV0IHRhcmdldEV4aXN0czogYm9vbGVhbiA9IGZhbHNlO1xuXHRcdGxldCB0YXJnZXRNb2RlbCA9IHRoaXMuZmlsZXMuZ2V0KHRhcmdldCk7XG5cdFx0aWYgKHRhcmdldE1vZGVsPy5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdHRhcmdldEV4aXN0cyA9IHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gT3RoZXJ3aXNlIGNyZWF0ZSB0aGUgdGFyZ2V0IGZpbGUgZW1wdHkgaWYgaXQgZG9lcyBub3QgZXhpc3QgYWxyZWFkeSBhbmQgcmVzb2x2ZSBpdCBmcm9tIHRoZXJlXG5cdFx0ZWxzZSB7XG5cdFx0XHR0YXJnZXRFeGlzdHMgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmV4aXN0cyh0YXJnZXQpO1xuXG5cdFx0XHQvLyBjcmVhdGUgdGFyZ2V0IGZpbGUgYWRob2MgaWYgaXQgZG9lcyBub3QgZXhpc3QgeWV0XG5cdFx0XHRpZiAoIXRhcmdldEV4aXN0cykge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmNyZWF0ZShbeyByZXNvdXJjZTogdGFyZ2V0LCB2YWx1ZTogJycgfV0pO1xuXHRcdFx0fVxuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0YXJnZXRNb2RlbCA9IGF3YWl0IHRoaXMuZmlsZXMucmVzb2x2ZSh0YXJnZXQsIHsgZW5jb2Rpbmc6IHNvdXJjZU1vZGVsRW5jb2RpbmcgfSk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHQvLyBpZiB0aGUgdGFyZ2V0IGFscmVhZHkgZXhpc3RzIGFuZCB3YXMgbm90IGNyZWF0ZWQgYnkgdXMsIGl0IGlzIHBvc3NpYmxlXG5cdFx0XHRcdC8vIHRoYXQgd2UgY2Fubm90IHJlc29sdmUgdGhlIHRhcmdldCBhcyB0ZXh0IG1vZGVsIGlmIGl0IGlzIGJpbmFyeSBvciB0b29cblx0XHRcdFx0Ly8gbGFyZ2UuIGluIHRoYXQgY2FzZSB3ZSBoYXZlIHRvIGRlbGV0ZSB0aGUgdGFyZ2V0IGZpbGUgZmlyc3QgYW5kIHRoZW5cblx0XHRcdFx0Ly8gcmUtcnVuIHRoZSBvcGVyYXRpb24uXG5cdFx0XHRcdGlmICh0YXJnZXRFeGlzdHMpIHtcblx0XHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0XHQoPFRleHRGaWxlT3BlcmF0aW9uRXJyb3I+ZXJyb3IpLnRleHRGaWxlT3BlcmF0aW9uUmVzdWx0ID09PSBUZXh0RmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX0lTX0JJTkFSWSB8fFxuXHRcdFx0XHRcdFx0KDxGaWxlT3BlcmF0aW9uRXJyb3I+ZXJyb3IpLmZpbGVPcGVyYXRpb25SZXN1bHQgPT09IEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9UT09fTEFSR0Vcblx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZGVsKHRhcmdldCk7XG5cblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLmRvU2F2ZUFzVGV4dEZpbGUoc291cmNlTW9kZWwsIHNvdXJjZSwgdGFyZ2V0LCBvcHRpb25zKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBDb25maXJtIHRvIG92ZXJ3cml0ZSBpZiB3ZSBoYXZlIGFuIHVudGl0bGVkIGZpbGUgd2l0aCBhc3NvY2lhdGVkIGZpbGUgd2hlcmVcblx0XHQvLyB0aGUgZmlsZSBhY3R1YWxseSBleGlzdHMgb24gZGlzayBhbmQgd2UgYXJlIGluc3RydWN0ZWQgdG8gc2F2ZSB0byB0aGF0IGZpbGVcblx0XHQvLyBwYXRoLiBUaGlzIGNhbiBoYXBwZW4gaWYgdGhlIGZpbGUgd2FzIGNyZWF0ZWQgYWZ0ZXIgdGhlIHVudGl0bGVkIGZpbGUgd2FzIG9wZW5lZC5cblx0XHQvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzY3OTQ2XG5cdFx0bGV0IHdyaXRlOiBib29sZWFuO1xuXHRcdGlmIChzb3VyY2VNb2RlbCBpbnN0YW5jZW9mIFVudGl0bGVkVGV4dEVkaXRvck1vZGVsICYmIHNvdXJjZU1vZGVsLmhhc0Fzc29jaWF0ZWRGaWxlUGF0aCAmJiB0YXJnZXRFeGlzdHMgJiYgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwodGFyZ2V0LCB0b0xvY2FsUmVzb3VyY2Uoc291cmNlTW9kZWwucmVzb3VyY2UsIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSwgdGhpcy5wYXRoU2VydmljZS5kZWZhdWx0VXJpU2NoZW1lKSkpIHtcblx0XHRcdHdyaXRlID0gYXdhaXQgdGhpcy5jb25maXJtT3ZlcndyaXRlKHRhcmdldCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHdyaXRlID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAoIXdyaXRlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0bGV0IHNvdXJjZVRleHRNb2RlbDogSVRleHRNb2RlbCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAoc291cmNlTW9kZWwgaW5zdGFuY2VvZiBCYXNlVGV4dEVkaXRvck1vZGVsKSB7XG5cdFx0XHRpZiAoc291cmNlTW9kZWwuaXNSZXNvbHZlZCgpKSB7XG5cdFx0XHRcdHNvdXJjZVRleHRNb2RlbCA9IHNvdXJjZU1vZGVsLnRleHRFZGl0b3JNb2RlbCA/PyB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHNvdXJjZVRleHRNb2RlbCA9IHNvdXJjZU1vZGVsIGFzIElUZXh0TW9kZWw7XG5cdFx0fVxuXG5cdFx0bGV0IHRhcmdldFRleHRNb2RlbDogSVRleHRNb2RlbCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAodGFyZ2V0TW9kZWwuaXNSZXNvbHZlZCgpKSB7XG5cdFx0XHR0YXJnZXRUZXh0TW9kZWwgPSB0YXJnZXRNb2RlbC50ZXh0RWRpdG9yTW9kZWw7XG5cdFx0fVxuXG5cdFx0Ly8gdGFrZSBvdmVyIG1vZGVsIHZhbHVlLCBlbmNvZGluZyBhbmQgbGFuZ3VhZ2UgKG9ubHkgaWYgbW9yZSBzcGVjaWZpYykgZnJvbSBzb3VyY2UgbW9kZWxcblx0XHRpZiAoc291cmNlVGV4dE1vZGVsICYmIHRhcmdldFRleHRNb2RlbCkge1xuXG5cdFx0XHQvLyBlbmNvZGluZ1xuXHRcdFx0dGFyZ2V0TW9kZWwudXBkYXRlUHJlZmVycmVkRW5jb2Rpbmcoc291cmNlTW9kZWxFbmNvZGluZyk7XG5cblx0XHRcdC8vIGNvbnRlbnRcblx0XHRcdHRoaXMubW9kZWxTZXJ2aWNlLnVwZGF0ZU1vZGVsKHRhcmdldFRleHRNb2RlbCwgY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnlGcm9tU25hcHNob3Qoc291cmNlVGV4dE1vZGVsLmNyZWF0ZVNuYXBzaG90KCkpKTtcblxuXHRcdFx0Ly8gbGFuZ3VhZ2Vcblx0XHRcdGNvbnN0IHNvdXJjZUxhbmd1YWdlSWQgPSBzb3VyY2VUZXh0TW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpO1xuXHRcdFx0Y29uc3QgdGFyZ2V0TGFuZ3VhZ2VJZCA9IHRhcmdldFRleHRNb2RlbC5nZXRMYW5ndWFnZUlkKCk7XG5cdFx0XHRpZiAoc291cmNlTGFuZ3VhZ2VJZCAhPT0gUExBSU5URVhUX0xBTkdVQUdFX0lEICYmIHRhcmdldExhbmd1YWdlSWQgPT09IFBMQUlOVEVYVF9MQU5HVUFHRV9JRCkge1xuXHRcdFx0XHR0YXJnZXRUZXh0TW9kZWwuc2V0TGFuZ3VhZ2Uoc291cmNlTGFuZ3VhZ2VJZCk7IC8vIG9ubHkgdXNlIGlmIG1vcmUgc3BlY2lmaWMgdGhhbiBwbGFpbi90ZXh0XG5cdFx0XHR9XG5cblx0XHRcdC8vIHRyYW5zaWVudCBwcm9wZXJ0aWVzXG5cdFx0XHRjb25zdCBzb3VyY2VUcmFuc2llbnRQcm9wZXJ0aWVzID0gdGhpcy5jb2RlRWRpdG9yU2VydmljZS5nZXRUcmFuc2llbnRNb2RlbFByb3BlcnRpZXMoc291cmNlVGV4dE1vZGVsKTtcblx0XHRcdGlmIChzb3VyY2VUcmFuc2llbnRQcm9wZXJ0aWVzKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIHNvdXJjZVRyYW5zaWVudFByb3BlcnRpZXMpIHtcblx0XHRcdFx0XHR0aGlzLmNvZGVFZGl0b3JTZXJ2aWNlLnNldFRyYW5zaWVudE1vZGVsUHJvcGVydHkodGFyZ2V0VGV4dE1vZGVsLCBrZXksIHZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIHNldCBzb3VyY2Ugb3B0aW9ucyBkZXBlbmRpbmcgb24gdGFyZ2V0IGV4aXN0cyBvciBub3Rcblx0XHRpZiAoIW9wdGlvbnM/LnNvdXJjZSkge1xuXHRcdFx0b3B0aW9ucyA9IHtcblx0XHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdFx0c291cmNlOiB0YXJnZXRFeGlzdHMgPyBBYnN0cmFjdFRleHRGaWxlU2VydmljZS5URVhURklMRV9TQVZFX1JFUExBQ0VfU09VUkNFIDogQWJzdHJhY3RUZXh0RmlsZVNlcnZpY2UuVEVYVEZJTEVfU0FWRV9DUkVBVEVfU09VUkNFXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIHNhdmUgbW9kZWxcblx0XHRyZXR1cm4gdGFyZ2V0TW9kZWwuc2F2ZSh7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0ZnJvbTogc291cmNlXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNvbmZpcm1PdmVyd3JpdGUocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IHsgY29uZmlybWVkIH0gPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHR0eXBlOiAnd2FybmluZycsXG5cdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgnY29uZmlybU92ZXJ3cml0ZScsIFwiJ3swfScgYWxyZWFkeSBleGlzdHMuIERvIHlvdSB3YW50IHRvIHJlcGxhY2UgaXQ/XCIsIGJhc2VuYW1lKHJlc291cmNlKSksXG5cdFx0XHRkZXRhaWw6IGxvY2FsaXplKCdvdmVyd3JpdGVJcnJldmVyc2libGUnLCBcIkEgZmlsZSBvciBmb2xkZXIgd2l0aCB0aGUgbmFtZSAnezB9JyBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgZm9sZGVyICd7MX0nLiBSZXBsYWNpbmcgaXQgd2lsbCBvdmVyd3JpdGUgaXRzIGN1cnJlbnQgY29udGVudHMuXCIsIGJhc2VuYW1lKHJlc291cmNlKSwgYmFzZW5hbWUoZGlybmFtZShyZXNvdXJjZSkpKSxcblx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAncmVwbGFjZUJ1dHRvbkxhYmVsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUmVwbGFjZVwiKSxcblx0XHR9KTtcblxuXHRcdHJldHVybiBjb25maXJtZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNvbmZpcm1NYWtlV3JpdGVhYmxlKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2NvbmZpcm1NYWtlV3JpdGVhYmxlJywgXCInezB9JyBpcyBtYXJrZWQgYXMgcmVhZC1vbmx5LiBEbyB5b3Ugd2FudCB0byBzYXZlIGFueXdheT9cIiwgYmFzZW5hbWUocmVzb3VyY2UpKSxcblx0XHRcdGRldGFpbDogbG9jYWxpemUoJ2NvbmZpcm1NYWtlV3JpdGVhYmxlRGV0YWlsJywgXCJQYXRocyBjYW4gYmUgY29uZmlndXJlZCBhcyByZWFkLW9ubHkgdmlhIHNldHRpbmdzLlwiKSxcblx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAnbWFrZVdyaXRlYWJsZUJ1dHRvbkxhYmVsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmU2F2ZSBBbnl3YXlcIilcblx0XHR9KTtcblxuXHRcdHJldHVybiBjb25maXJtZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHN1Z2dlc3RTYXZlUGF0aChyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxVUkk+IHtcblxuXHRcdC8vIEp1c3QgdGFrZSB0aGUgcmVzb3VyY2UgYXMgaXMgaWYgdGhlIGZpbGUgc2VydmljZSBjYW4gaGFuZGxlIGl0XG5cdFx0aWYgKHRoaXMuZmlsZVNlcnZpY2UuaGFzUHJvdmlkZXIocmVzb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm4gcmVzb3VyY2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVtb3RlQXV0aG9yaXR5ID0gdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5O1xuXHRcdGNvbnN0IGRlZmF1bHRGaWxlUGF0aCA9IGF3YWl0IHRoaXMuZmlsZURpYWxvZ1NlcnZpY2UuZGVmYXVsdEZpbGVQYXRoKCk7XG5cblx0XHQvLyBPdGhlcndpc2UgdHJ5IHRvIHN1Z2dlc3QgYSBwYXRoIHRoYXQgY2FuIGJlIHNhdmVkXG5cdFx0bGV0IHN1Z2dlc3RlZEZpbGVuYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKHJlc291cmNlLnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCkge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLnVudGl0bGVkLmdldChyZXNvdXJjZSk7XG5cdFx0XHRpZiAobW9kZWwpIHtcblxuXHRcdFx0XHQvLyBVbnRpdGxlZCB3aXRoIGFzc29jaWF0ZWQgZmlsZSBwYXRoXG5cdFx0XHRcdGlmIChtb2RlbC5oYXNBc3NvY2lhdGVkRmlsZVBhdGgpIHtcblx0XHRcdFx0XHRyZXR1cm4gdG9Mb2NhbFJlc291cmNlKHJlc291cmNlLCByZW1vdGVBdXRob3JpdHksIHRoaXMucGF0aFNlcnZpY2UuZGVmYXVsdFVyaVNjaGVtZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBVbnRpdGxlZCB3aXRob3V0IGFzc29jaWF0ZWQgZmlsZSBwYXRoOiB1c2UgbmFtZVxuXHRcdFx0XHQvLyBvZiB1bnRpdGxlZCBtb2RlbCBpZiBpdCBpcyBhIHZhbGlkIHBhdGggbmFtZSBhbmRcblx0XHRcdFx0Ly8gZmlndXJlIG91dCB0aGUgZmlsZSBleHRlbnNpb24gZnJvbSB0aGUgbW9kZSBpZiBhbnkuXG5cblx0XHRcdFx0bGV0IG5hbWVDYW5kaWRhdGU6IHN0cmluZztcblx0XHRcdFx0aWYgKGF3YWl0IHRoaXMucGF0aFNlcnZpY2UuaGFzVmFsaWRCYXNlbmFtZShqb2luUGF0aChkZWZhdWx0RmlsZVBhdGgsIG1vZGVsLm5hbWUpLCBtb2RlbC5uYW1lKSkge1xuXHRcdFx0XHRcdG5hbWVDYW5kaWRhdGUgPSBtb2RlbC5uYW1lO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG5hbWVDYW5kaWRhdGUgPSBiYXNlbmFtZShyZXNvdXJjZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBsYW5ndWFnZUlkID0gbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpO1xuXHRcdFx0XHRpZiAobGFuZ3VhZ2VJZCAmJiBsYW5ndWFnZUlkICE9PSBQTEFJTlRFWFRfTEFOR1VBR0VfSUQpIHtcblx0XHRcdFx0XHRzdWdnZXN0ZWRGaWxlbmFtZSA9IHRoaXMuc3VnZ2VzdEZpbGVuYW1lKGxhbmd1YWdlSWQsIG5hbWVDYW5kaWRhdGUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHN1Z2dlc3RlZEZpbGVuYW1lID0gbmFtZUNhbmRpZGF0ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEZhbGxiYWNrIHRvIGJhc2VuYW1lIG9mIHJlc291cmNlXG5cdFx0aWYgKCFzdWdnZXN0ZWRGaWxlbmFtZSkge1xuXHRcdFx0c3VnZ2VzdGVkRmlsZW5hbWUgPSBiYXNlbmFtZShyZXNvdXJjZSk7XG5cdFx0fVxuXG5cdFx0Ly8gVHJ5IHRvIHBsYWNlIHdoZXJlIGxhc3QgYWN0aXZlIGZpbGUgd2FzIGlmIGFueVxuXHRcdC8vIE90aGVyd2lzZSBmYWxsYmFjayB0byB1c2VyIGhvbWVcblx0XHRyZXR1cm4gam9pblBhdGgoZGVmYXVsdEZpbGVQYXRoLCBzdWdnZXN0ZWRGaWxlbmFtZSk7XG5cdH1cblxuXHRzdWdnZXN0RmlsZW5hbWUobGFuZ3VhZ2VJZDogc3RyaW5nLCB1bnRpdGxlZE5hbWU6IHN0cmluZykge1xuXHRcdGNvbnN0IGxhbmd1YWdlTmFtZSA9IHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmdldExhbmd1YWdlTmFtZShsYW5ndWFnZUlkKTtcblx0XHRpZiAoIWxhbmd1YWdlTmFtZSkge1xuXHRcdFx0cmV0dXJuIHVudGl0bGVkTmFtZTsgLy8gdW5rbm93biBsYW5ndWFnZSwgc28gd2UgY2Fubm90IHN1Z2dlc3QgYSBiZXR0ZXIgbmFtZVxuXHRcdH1cblxuXHRcdGNvbnN0IHVudGl0bGVkRXh0ZW5zaW9uID0gcGF0aEV4dG5hbWUodW50aXRsZWROYW1lKTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbnMgPSB0aGlzLmxhbmd1YWdlU2VydmljZS5nZXRFeHRlbnNpb25zKGxhbmd1YWdlSWQpO1xuXHRcdGlmIChleHRlbnNpb25zLmluY2x1ZGVzKHVudGl0bGVkRXh0ZW5zaW9uKSkge1xuXHRcdFx0cmV0dXJuIHVudGl0bGVkTmFtZTsgLy8gcHJlc2VydmUgZXh0ZW5zaW9uIGlmIGl0IGlzIGNvbXBhdGlibGUgd2l0aCB0aGUgbW9kZVxuXHRcdH1cblxuXHRcdGNvbnN0IHByaW1hcnlFeHRlbnNpb24gPSBleHRlbnNpb25zLmF0KDApO1xuXHRcdGlmIChwcmltYXJ5RXh0ZW5zaW9uKSB7XG5cdFx0XHRpZiAodW50aXRsZWRFeHRlbnNpb24pIHtcblx0XHRcdFx0cmV0dXJuIGAke3VudGl0bGVkTmFtZS5zdWJzdHJpbmcoMCwgdW50aXRsZWROYW1lLmluZGV4T2YodW50aXRsZWRFeHRlbnNpb24pKX0ke3ByaW1hcnlFeHRlbnNpb259YDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGAke3VudGl0bGVkTmFtZX0ke3ByaW1hcnlFeHRlbnNpb259YDtcblx0XHR9XG5cblx0XHRjb25zdCBmaWxlbmFtZXMgPSB0aGlzLmxhbmd1YWdlU2VydmljZS5nZXRGaWxlbmFtZXMobGFuZ3VhZ2VJZCk7XG5cdFx0aWYgKGZpbGVuYW1lcy5pbmNsdWRlcyh1bnRpdGxlZE5hbWUpKSB7XG5cdFx0XHRyZXR1cm4gdW50aXRsZWROYW1lOyAvLyBwcmVzZXJ2ZSBuYW1lIGlmIGl0IGlzIGNvbXBhdGlibGUgd2l0aCB0aGUgbW9kZVxuXHRcdH1cblxuXHRcdHJldHVybiBmaWxlbmFtZXMuYXQoMCkgPz8gdW50aXRsZWROYW1lO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIHJldmVydFxuXG5cdGFzeW5jIHJldmVydChyZXNvdXJjZTogVVJJLCBvcHRpb25zPzogSVJldmVydE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIFVudGl0bGVkXG5cdFx0aWYgKHJlc291cmNlLnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCkge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLnVudGl0bGVkLmdldChyZXNvdXJjZSk7XG5cdFx0XHRpZiAobW9kZWwpIHtcblx0XHRcdFx0cmV0dXJuIG1vZGVsLnJldmVydChvcHRpb25zKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBGaWxlXG5cdFx0ZWxzZSB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZmlsZXMuZ2V0KHJlc291cmNlKTtcblx0XHRcdGlmIChtb2RlbCAmJiAobW9kZWwuaXNEaXJ0eSgpIHx8IG9wdGlvbnM/LmZvcmNlKSkge1xuXHRcdFx0XHRyZXR1cm4gbW9kZWwucmV2ZXJ0KG9wdGlvbnMpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBkaXJ0eVxuXG5cdGlzRGlydHkocmVzb3VyY2U6IFVSSSk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IG1vZGVsID0gcmVzb3VyY2Uuc2NoZW1lID09PSBTY2hlbWFzLnVudGl0bGVkID8gdGhpcy51bnRpdGxlZC5nZXQocmVzb3VyY2UpIDogdGhpcy5maWxlcy5nZXQocmVzb3VyY2UpO1xuXHRcdGlmIChtb2RlbCkge1xuXHRcdFx0cmV0dXJuIG1vZGVsLmlzRGlydHkoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRW5jb2RpbmdPdmVycmlkZSB7XG5cdHBhcmVudD86IFVSSTtcblx0ZXh0ZW5zaW9uPzogc3RyaW5nO1xuXHRlbmNvZGluZzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRW5jb2RpbmdPcmFjbGUgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVJlc291cmNlRW5jb2RpbmdzIHtcblxuXHRwcml2YXRlIF9lbmNvZGluZ092ZXJyaWRlczogSUVuY29kaW5nT3ZlcnJpZGVbXTtcblx0cHJvdGVjdGVkIGdldCBlbmNvZGluZ092ZXJyaWRlcygpOiBJRW5jb2RpbmdPdmVycmlkZVtdIHsgcmV0dXJuIHRoaXMuX2VuY29kaW5nT3ZlcnJpZGVzOyB9XG5cdHByb3RlY3RlZCBzZXQgZW5jb2RpbmdPdmVycmlkZXModmFsdWU6IElFbmNvZGluZ092ZXJyaWRlW10pIHsgdGhpcy5fZW5jb2RpbmdPdmVycmlkZXMgPSB2YWx1ZTsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSB0ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZTogSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9lbmNvZGluZ092ZXJyaWRlcyA9IHRoaXMuZ2V0RGVmYXVsdEVuY29kaW5nT3ZlcnJpZGVzKCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXG5cdFx0Ly8gV29ya3NwYWNlIEZvbGRlciBDaGFuZ2Vcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRleHRTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVycygoKSA9PiB0aGlzLmVuY29kaW5nT3ZlcnJpZGVzID0gdGhpcy5nZXREZWZhdWx0RW5jb2RpbmdPdmVycmlkZXMoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXREZWZhdWx0RW5jb2RpbmdPdmVycmlkZXMoKTogSUVuY29kaW5nT3ZlcnJpZGVbXSB7XG5cdFx0Y29uc3QgZGVmYXVsdEVuY29kaW5nT3ZlcnJpZGVzOiBJRW5jb2RpbmdPdmVycmlkZVtdID0gW107XG5cblx0XHQvLyBHbG9iYWwgc2V0dGluZ3Ncblx0XHRkZWZhdWx0RW5jb2RpbmdPdmVycmlkZXMucHVzaCh7IHBhcmVudDogdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UudXNlclJvYW1pbmdEYXRhSG9tZSwgZW5jb2Rpbmc6IFVURjggfSk7XG5cblx0XHQvLyBXb3Jrc3BhY2UgZmlsZXMgKHZpYSBleHRlbnNpb24gYW5kIHZpYSB1bnRpdGxlZCB3b3Jrc3BhY2VzIGxvY2F0aW9uKVxuXHRcdGRlZmF1bHRFbmNvZGluZ092ZXJyaWRlcy5wdXNoKHsgZXh0ZW5zaW9uOiBXT1JLU1BBQ0VfRVhURU5TSU9OLCBlbmNvZGluZzogVVRGOCB9KTtcblx0XHRkZWZhdWx0RW5jb2RpbmdPdmVycmlkZXMucHVzaCh7IHBhcmVudDogdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UudW50aXRsZWRXb3Jrc3BhY2VzSG9tZSwgZW5jb2Rpbmc6IFVURjggfSk7XG5cblx0XHQvLyBGb2xkZXIgU2V0dGluZ3Ncblx0XHR0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMuZm9yRWFjaChmb2xkZXIgPT4ge1xuXHRcdFx0ZGVmYXVsdEVuY29kaW5nT3ZlcnJpZGVzLnB1c2goeyBwYXJlbnQ6IGpvaW5QYXRoKGZvbGRlci51cmksICcudnNjb2RlJyksIGVuY29kaW5nOiBVVEY4IH0pO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGRlZmF1bHRFbmNvZGluZ092ZXJyaWRlcztcblx0fVxuXG5cdGFzeW5jIGdldFdyaXRlRW5jb2RpbmcocmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCwgb3B0aW9ucz86IElXcml0ZVRleHRGaWxlT3B0aW9ucyk6IFByb21pc2U8eyBlbmNvZGluZzogc3RyaW5nOyBhZGRCT006IGJvb2xlYW4gfT4ge1xuXHRcdGNvbnN0IHsgZW5jb2RpbmcsIGhhc0JPTSB9ID0gYXdhaXQgdGhpcy5nZXRQcmVmZXJyZWRXcml0ZUVuY29kaW5nKHJlc291cmNlLCBvcHRpb25zID8gb3B0aW9ucy5lbmNvZGluZyA6IHVuZGVmaW5lZCk7XG5cblx0XHRyZXR1cm4geyBlbmNvZGluZywgYWRkQk9NOiBoYXNCT00gfTtcblx0fVxuXG5cdGFzeW5jIGdldFByZWZlcnJlZFdyaXRlRW5jb2RpbmcocmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCwgcHJlZmVycmVkRW5jb2Rpbmc/OiBzdHJpbmcpOiBQcm9taXNlPElSZXNvdXJjZUVuY29kaW5nPiB7XG5cdFx0Y29uc3QgcmVzb3VyY2VFbmNvZGluZyA9IGF3YWl0IHRoaXMuZ2V0VmFsaWRhdGVkRW5jb2RpbmdGb3JSZXNvdXJjZShyZXNvdXJjZSwgcHJlZmVycmVkRW5jb2RpbmcpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGVuY29kaW5nOiByZXNvdXJjZUVuY29kaW5nLFxuXHRcdFx0aGFzQk9NOiByZXNvdXJjZUVuY29kaW5nID09PSBVVEYxNmJlIHx8IHJlc291cmNlRW5jb2RpbmcgPT09IFVURjE2bGUgfHwgcmVzb3VyY2VFbmNvZGluZyA9PT0gVVRGOF93aXRoX2JvbSAvLyBlbmZvcmNlIEJPTSBmb3IgY2VydGFpbiBlbmNvZGluZ3Ncblx0XHR9O1xuXHR9XG5cblx0YXN5bmMgZ2V0UHJlZmVycmVkUmVhZEVuY29kaW5nKHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQsIG9wdGlvbnM/OiBJUmVhZFRleHRGaWxlRW5jb2RpbmdPcHRpb25zLCBkZXRlY3RlZEVuY29kaW5nPzogc3RyaW5nKTogUHJvbWlzZTxJUmVzb3VyY2VFbmNvZGluZz4ge1xuXHRcdGxldCBwcmVmZXJyZWRFbmNvZGluZzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdFx0Ly8gRW5jb2RpbmcgcGFzc2VkIGluIGFzIG9wdGlvblxuXHRcdGlmIChvcHRpb25zPy5lbmNvZGluZykge1xuXHRcdFx0aWYgKGRldGVjdGVkRW5jb2RpbmcgPT09IFVURjhfd2l0aF9ib20gJiYgb3B0aW9ucy5lbmNvZGluZyA9PT0gVVRGOCkge1xuXHRcdFx0XHRwcmVmZXJyZWRFbmNvZGluZyA9IFVURjhfd2l0aF9ib207IC8vIGluZGljYXRlIHRoZSBmaWxlIGhhcyBCT00gaWYgd2UgYXJlIHRvIHJlc29sdmUgd2l0aCBVVEYgOFxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cHJlZmVycmVkRW5jb2RpbmcgPSBvcHRpb25zLmVuY29kaW5nOyAvLyBnaXZlIHBhc3NlZCBpbiBlbmNvZGluZyBoaWdoZXN0IHByaW9yaXR5XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRW5jb2RpbmcgZGV0ZWN0ZWRcblx0XHRlbHNlIGlmICh0eXBlb2YgZGV0ZWN0ZWRFbmNvZGluZyA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHByZWZlcnJlZEVuY29kaW5nID0gZGV0ZWN0ZWRFbmNvZGluZztcblx0XHR9XG5cblx0XHQvLyBFbmNvZGluZyBjb25maWd1cmVkXG5cdFx0ZWxzZSBpZiAodGhpcy50ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShyZXNvdXJjZSwgJ2ZpbGVzLmVuY29kaW5nJykgPT09IFVURjhfd2l0aF9ib20pIHtcblx0XHRcdHByZWZlcnJlZEVuY29kaW5nID0gVVRGODsgLy8gaWYgd2UgZGlkIG5vdCBkZXRlY3QgVVRGIDggQk9NIGJlZm9yZSwgdGhpcyBjYW4gb25seSBiZSBVVEYgOCB0aGVuXG5cdFx0fVxuXG5cdFx0Y29uc3QgZW5jb2RpbmcgPSBhd2FpdCB0aGlzLmdldFZhbGlkYXRlZEVuY29kaW5nRm9yUmVzb3VyY2UocmVzb3VyY2UsIHByZWZlcnJlZEVuY29kaW5nKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRlbmNvZGluZyxcblx0XHRcdGhhc0JPTTogZW5jb2RpbmcgPT09IFVURjE2YmUgfHwgZW5jb2RpbmcgPT09IFVURjE2bGUgfHwgZW5jb2RpbmcgPT09IFVURjhfd2l0aF9ib20gLy8gZW5mb3JjZSBCT00gZm9yIGNlcnRhaW4gZW5jb2RpbmdzXG5cdFx0fTtcblx0fVxuXG5cdGdldFVudmFsaWRhdGVkRW5jb2RpbmdGb3JSZXNvdXJjZShyZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkLCBwcmVmZXJyZWRFbmNvZGluZz86IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0bGV0IGZpbGVFbmNvZGluZzogc3RyaW5nO1xuXG5cdFx0Y29uc3Qgb3ZlcnJpZGUgPSB0aGlzLmdldEVuY29kaW5nT3ZlcnJpZGUocmVzb3VyY2UpO1xuXHRcdGlmIChvdmVycmlkZSkge1xuXHRcdFx0ZmlsZUVuY29kaW5nID0gb3ZlcnJpZGU7IC8vIGVuY29kaW5nIG92ZXJyaWRlIGFsd2F5cyB3aW5zXG5cdFx0fSBlbHNlIGlmIChwcmVmZXJyZWRFbmNvZGluZykge1xuXHRcdFx0ZmlsZUVuY29kaW5nID0gcHJlZmVycmVkRW5jb2Rpbmc7IC8vIHByZWZlcnJlZCBlbmNvZGluZyBjb21lcyBzZWNvbmRcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZmlsZUVuY29kaW5nID0gdGhpcy50ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShyZXNvdXJjZSwgJ2ZpbGVzLmVuY29kaW5nJyk7IC8vIGFuZCBsYXN0IHdlIGNoZWNrIGZvciBzZXR0aW5nc1xuXHRcdH1cblxuXHRcdHJldHVybiBmaWxlRW5jb2RpbmcgfHwgVVRGODtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0VmFsaWRhdGVkRW5jb2RpbmdGb3JSZXNvdXJjZShyZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkLCBwcmVmZXJyZWRFbmNvZGluZz86IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0bGV0IGZpbGVFbmNvZGluZyA9IHRoaXMuZ2V0VW52YWxpZGF0ZWRFbmNvZGluZ0ZvclJlc291cmNlKHJlc291cmNlLCBwcmVmZXJyZWRFbmNvZGluZyk7XG5cdFx0aWYgKGZpbGVFbmNvZGluZyAhPT0gVVRGOCAmJiAhKGF3YWl0IGVuY29kaW5nRXhpc3RzKGZpbGVFbmNvZGluZykpKSB7XG5cdFx0XHRmaWxlRW5jb2RpbmcgPSBVVEY4O1xuXHRcdH1cblxuXHRcdHJldHVybiBmaWxlRW5jb2Rpbmc7XG5cdH1cblxuXHRwcml2YXRlIGdldEVuY29kaW5nT3ZlcnJpZGUocmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHJlc291cmNlICYmIHRoaXMuZW5jb2RpbmdPdmVycmlkZXM/Lmxlbmd0aCkge1xuXHRcdFx0Zm9yIChjb25zdCBvdmVycmlkZSBvZiB0aGlzLmVuY29kaW5nT3ZlcnJpZGVzKSB7XG5cblx0XHRcdFx0Ly8gY2hlY2sgaWYgdGhlIHJlc291cmNlIGlzIGNoaWxkIG9mIGVuY29kaW5nIG92ZXJyaWRlIHBhdGhcblx0XHRcdFx0aWYgKG92ZXJyaWRlLnBhcmVudCAmJiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbE9yUGFyZW50KHJlc291cmNlLCBvdmVycmlkZS5wYXJlbnQpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG92ZXJyaWRlLmVuY29kaW5nO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gY2hlY2sgaWYgdGhlIHJlc291cmNlIGV4dGVuc2lvbiBpcyBlcXVhbCB0byBlbmNvZGluZyBvdmVycmlkZVxuXHRcdFx0XHRpZiAob3ZlcnJpZGUuZXh0ZW5zaW9uICYmIGV4dG5hbWUocmVzb3VyY2UpID09PSBgLiR7b3ZlcnJpZGUuZXh0ZW5zaW9ufWApIHtcblx0XHRcdFx0XHRyZXR1cm4gb3ZlcnJpZGUuZW5jb2Rpbmc7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQXdKLG9CQUFvQix3QkFBd0IseUJBQStGLGtCQUF3RSxnQ0FBZ0M7QUFDM1ksU0FBeUIsMEJBQTBCO0FBQ25ELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsY0FBa0MsMkJBQTBGO0FBQ3JJLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsV0FBVyxtQkFBbUI7QUFDdkMsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxrQ0FBbUU7QUFDNUUsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMscUNBQXFDLHlDQUF5QztBQUN2RixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLFVBQVUsU0FBUyxVQUFVLGlCQUFpQixTQUFTLGVBQWU7QUFDL0UsU0FBUyxnQkFBZ0IsMEJBQTBCO0FBQ25ELFNBQXFDLHNCQUE4QztBQUVuRixTQUFTLHlDQUF5QztBQUNsRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGtDQUFrQztBQUUzQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLCtCQUFpRjtBQUMxRixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDBCQUEwQiwyQkFBMkI7QUFDOUQsU0FBUyxNQUFNLGVBQWUsU0FBUyxTQUFTLGdCQUFnQixrQkFBa0IsZ0JBQXdELDZCQUE2QjtBQUN2SyxTQUFTLHFCQUFxQztBQUM5QyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLG1CQUFtQiwrQkFBK0I7QUFDM0QsU0FBUyw0QkFBNEI7QUFDckMsU0FBZ0QsMkJBQTJCO0FBQzNFLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWU7QUFDeEIsU0FBUywyQkFBMkI7QUFFN0IsSUFBZSwwQkFBZixjQUErQyxXQUF1QztBQUFBLEVBVzVGLFlBQ2tDLGFBQ0wsMkJBQ1Usa0JBQ0ksc0JBQ1YsY0FDaUIsb0JBQ2hCLGVBQ0ksbUJBQ2lCLGtDQUNQLDJCQUNWLG1CQUNOLGFBQ1csd0JBQ0osb0JBQ0gsaUJBQ0gsWUFDTyxxQkFDRCxvQkFDckM7QUFDRCxVQUFNO0FBbkIyQjtBQUVLO0FBQ0k7QUFDVjtBQUNpQjtBQUNoQjtBQUNJO0FBQ2lCO0FBQ1A7QUFDVjtBQUNOO0FBQ1c7QUFDSjtBQUNIO0FBQ0g7QUFDTztBQUNEO0FBSXRDLFNBQUssUUFBUSxLQUFLLFVBQVUsS0FBSyxxQkFBcUIsZUFBZSwwQkFBMEIsQ0FBQztBQUNoRyxTQUFLLFdBQVc7QUFFaEIsU0FBSyxtQkFBbUI7QUFBQSxFQUN6QjtBQUFBO0FBQUEsRUFJUSxxQkFBMkI7QUFHbEMsVUFBTSxXQUFXLEtBQUssVUFBVSxJQUFJLGNBQWMsV0FBMkM7QUFBQSxNQU81RixZQUE2QixPQUFvQztBQUNoRSxjQUFNO0FBRHNCO0FBTDdCLGFBQVMsUUFBUSxTQUFTLDRCQUE0Qiw2QkFBNkI7QUFFbkYsYUFBaUIsZUFBZSxLQUFLLFVBQVUsSUFBSSxRQUFlLENBQUM7QUFDbkUsYUFBUyxjQUFjLEtBQUssYUFBYTtBQUt4QyxhQUFLLGtCQUFrQjtBQUFBLE1BQ3hCO0FBQUEsTUFFUSxvQkFBMEI7QUFHakMsYUFBSyxVQUFVLEtBQUssTUFBTSxhQUFhLENBQUMsRUFBRSxNQUFNLE1BQU07QUFDckQsY0FBSSxNQUFNLFdBQVcsS0FBSyxNQUFNLFNBQVMseUJBQXlCLE1BQU0sR0FBRztBQUMxRSxpQkFBSyxhQUFhLEtBQUssQ0FBQyxNQUFNLFFBQVEsQ0FBQztBQUFBLFVBQ3hDO0FBQUEsUUFDRCxDQUFDLENBQUM7QUFNRixhQUFLLFVBQVUsS0FBSyxNQUFNLFlBQVksY0FBWSxLQUFLLGFBQWEsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFHckYsYUFBSyxVQUFVLEtBQUssTUFBTSxvQkFBb0IsV0FBUyxLQUFLLGFBQWEsS0FBSyxDQUFDLE1BQU0sUUFBUSxDQUFDLENBQUMsQ0FBQztBQUNoRyxhQUFLLFVBQVUsS0FBSyxNQUFNLG9CQUFvQixXQUFTLEtBQUssYUFBYSxLQUFLLENBQUMsTUFBTSxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQUEsTUFDakc7QUFBQSxNQUVBLG1CQUFtQixLQUF1QztBQUN6RCxjQUFNLFFBQVEsS0FBSyxNQUFNLElBQUksR0FBRztBQUNoQyxZQUFJLENBQUMsU0FBUyxNQUFNLFdBQVcsR0FBRztBQUNqQyxpQkFBTztBQUFBLFFBQ1I7QUFFQSxjQUFNLGFBQWEsTUFBTSxXQUFXO0FBQ3BDLGNBQU0sYUFBYSxNQUFNLFNBQVMseUJBQXlCLE1BQU07QUFHakUsWUFBSSxjQUFjLFlBQVk7QUFDN0IsaUJBQU87QUFBQSxZQUNOLE9BQU87QUFBQSxZQUNQLFFBQVEsUUFBUTtBQUFBLFlBQ2hCLGVBQWU7QUFBQSxZQUNmLFNBQVMsU0FBUyxzQkFBc0Isb0JBQW9CO0FBQUEsVUFDN0Q7QUFBQSxRQUNELFdBR1MsWUFBWTtBQUNwQixpQkFBTztBQUFBLFlBQ04sUUFBUSxRQUFRO0FBQUEsWUFDaEIsU0FBUyxTQUFTLFlBQVksV0FBVztBQUFBLFVBQzFDO0FBQUEsUUFDRCxXQUdTLFlBQVk7QUFDcEIsaUJBQU87QUFBQSxZQUNOLE9BQU87QUFBQSxZQUNQLGVBQWU7QUFBQSxZQUNmLFNBQVMsU0FBUyxXQUFXLFNBQVM7QUFBQSxVQUN2QztBQUFBLFFBQ0Q7QUFFQSxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0QsRUFBRSxLQUFLLEtBQUssQ0FBQztBQUViLFNBQUssVUFBVSxLQUFLLG1CQUFtQiw0QkFBNEIsUUFBUSxDQUFDO0FBQUEsRUFDN0U7QUFBQSxFQVFBLElBQUksV0FBMkI7QUFDOUIsUUFBSSxDQUFDLEtBQUssV0FBVztBQUNwQixXQUFLLFlBQVksS0FBSyxVQUFVLEtBQUsscUJBQXFCLGVBQWUsY0FBYyxDQUFDO0FBQUEsSUFDekY7QUFFQSxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxNQUFNLEtBQUssVUFBZSxTQUEyRDtBQUNwRixVQUFNLENBQUMsY0FBYyxPQUFPLElBQUksTUFBTSxLQUFLLE9BQU8sVUFBVTtBQUFBLE1BQzNELEdBQUc7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFNSCxrQkFBa0I7QUFBQSxJQUNuQixDQUFDO0FBRUQsV0FBTztBQUFBLE1BQ04sR0FBRztBQUFBLE1BQ0gsVUFBVSxRQUFRLFNBQVMsWUFBWTtBQUFBLE1BQ3ZDLE9BQU8sTUFBTSxjQUFjLFFBQVEsUUFBUSxhQUFXLFFBQVEsS0FBSyxFQUFFLENBQUM7QUFBQSxJQUN2RTtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQU0sV0FBVyxVQUFlLFNBQWlFO0FBQ2hHLFVBQU0sQ0FBQyxjQUFjLE9BQU8sSUFBSSxNQUFNLEtBQUssT0FBTyxVQUFVLE9BQU87QUFFbkUsV0FBTztBQUFBLE1BQ04sR0FBRztBQUFBLE1BQ0gsVUFBVSxRQUFRLFNBQVMsWUFBWTtBQUFBLE1BQ3ZDLE9BQU8sTUFBTSxrQ0FBa0MsUUFBUSxNQUFNO0FBQUEsSUFDOUQ7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFjLE9BQU8sVUFBZSxTQUFxSDtBQUN4SixVQUFNLE1BQU0sSUFBSSx3QkFBd0I7QUFHeEMsUUFBSTtBQUNKLFFBQUksU0FBUyxrQkFBa0I7QUFDOUIsWUFBTSxVQUFVLE1BQU0sS0FBSyxZQUFZLFNBQVMsVUFBVSxTQUFTLElBQUksS0FBSztBQUM1RSxxQkFBZTtBQUFBLFFBQ2QsR0FBRztBQUFBLFFBQ0gsT0FBTyxlQUFlLFFBQVEsS0FBSztBQUFBLE1BQ3BDO0FBQUEsSUFDRCxPQUFPO0FBQ04scUJBQWUsTUFBTSxLQUFLLFlBQVksZUFBZSxVQUFVLFNBQVMsSUFBSSxLQUFLO0FBQUEsSUFDbEY7QUFHQSxRQUFJO0FBQ0gsWUFBTSxVQUFVLE1BQU0sS0FBSyxtQkFBbUIsVUFBVSxhQUFhLE9BQU8sT0FBTztBQUVuRixhQUFPLENBQUMsY0FBYyxPQUFPO0FBQUEsSUFDOUIsU0FBUyxPQUFPO0FBVWYsVUFBSSxRQUFRLElBQUk7QUFHaEIsVUFBd0IsTUFBTywwQkFBMEIsc0JBQXNCLGtCQUFrQjtBQUNoRyxjQUFNLElBQUksdUJBQXVCLFNBQVMsbUJBQW1CLHNEQUFzRCxHQUFHLHdCQUF3QixnQkFBZ0IsT0FBTztBQUFBLE1BQ3RLLE9BR0s7QUFDSixjQUFNO0FBQUEsTUFDUDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFNLE9BQU8sWUFBK0YsVUFBa0Y7QUFDN0wsVUFBTSx5QkFBaUQsTUFBTSxRQUFRLElBQUksV0FBVyxJQUFJLE9BQU0sY0FBYTtBQUMxRyxZQUFNLFdBQVcsTUFBTSxLQUFLLG1CQUFtQixVQUFVLFVBQVUsVUFBVSxLQUFLO0FBQ2xGLGFBQU87QUFBQSxRQUNOLFVBQVUsVUFBVTtBQUFBLFFBQ3BCO0FBQUEsUUFDQSxXQUFXLFVBQVUsU0FBUztBQUFBLE1BQy9CO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixXQUFPLEtBQUssdUJBQXVCLE9BQU8sd0JBQXdCLGtCQUFrQixNQUFNLFFBQVE7QUFBQSxFQUNuRztBQUFBLEVBRUEsTUFBTSxNQUFNLFVBQWUsT0FBK0IsU0FBaUU7QUFDMUgsVUFBTSxXQUFXLE1BQU0sS0FBSyxtQkFBbUIsVUFBVSxPQUFPLE9BQU87QUFFdkUsUUFBSSxTQUFTLGlCQUFpQixLQUFLLG9CQUFvQixZQUFZLFFBQVEsR0FBRztBQUM3RSxhQUFPLEtBQUssb0JBQW9CLGtCQUFrQixVQUFVLFVBQVUsT0FBTztBQUFBLElBQzlFO0FBRUEsV0FBTyxLQUFLLFlBQVksVUFBVSxVQUFVLFVBQVUsT0FBTztBQUFBLEVBQzlEO0FBQUEsRUFFQSxZQUFZLFVBQXVCO0FBQ2xDLFVBQU0sUUFBUSxTQUFTLFdBQVcsUUFBUSxXQUFXLEtBQUssU0FBUyxJQUFJLFFBQVEsSUFBSSxLQUFLLE1BQU0sSUFBSSxRQUFRO0FBQzFHLFdBQU8sT0FBTyxZQUFZLEtBQUssS0FBSyxTQUFTLGtDQUFrQyxRQUFRO0FBQUEsRUFDeEY7QUFBQSxFQVFBLE1BQU0sbUJBQW1CLFVBQTJCLE9BQWdDLFNBQW1GO0FBR3RLLFVBQU0sRUFBRSxVQUFVLE9BQU8sSUFBSSxNQUFNLEtBQUssU0FBUyxpQkFBaUIsVUFBVSxPQUFPO0FBR25GLFFBQUksYUFBYSxRQUFRLENBQUMsUUFBUTtBQUNqQyxhQUFPLE9BQU8sVUFBVSxjQUNyQixTQUNBLG1CQUFtQixLQUFLO0FBQUEsSUFDNUI7QUFHQSxZQUFRLFNBQVM7QUFDakIsVUFBTSxXQUFXLE9BQU8sVUFBVSxXQUFXLGlCQUFpQixLQUFLLElBQUk7QUFDdkUsV0FBTyxpQkFBaUIsVUFBVSxVQUFVLEVBQUUsT0FBTyxDQUFDO0FBQUEsRUFDdkQ7QUFBQSxFQUVBLE1BQU0saUJBQWlCLFVBQTJCLE9BQStCLFNBQXlFO0FBQ3pKLFlBQVEsTUFBTSxLQUFLLG1CQUFtQixVQUFVLE9BQU8sT0FBTyxHQUFHO0FBQUEsRUFDbEU7QUFBQSxFQUVRLG1CQUFtQixVQUEyQixRQUFnQyxTQUFzRTtBQUczSixXQUFPLGVBQWUsUUFBUTtBQUFBLE1BQzdCLGdCQUFnQixTQUFTLGtCQUFrQjtBQUFBLE1BQzNDLGVBQ0MsU0FBUyxxQkFDVCxLQUFLLGlDQUFpQyxTQUFTLFVBQVUseUJBQXlCO0FBQUEsTUFDbkYseUJBQ0MsU0FBUywyQkFDVCxLQUFLLGlDQUFpQyxTQUFTLFVBQVUsK0JBQStCO0FBQUEsTUFDekYsbUJBQW1CLE9BQU0scUJBQW9CO0FBQzVDLGNBQU0sRUFBRSxTQUFTLElBQUksTUFBTSxLQUFLLFNBQVMseUJBQXlCLFVBQVUsU0FBUyxvQkFBb0IsTUFBUztBQUVsSCxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQTtBQUFBO0FBQUEsRUFPQSxNQUFNLEtBQUssVUFBZSxTQUEwRDtBQUduRixRQUFJLFNBQVMsV0FBVyxRQUFRLFVBQVU7QUFDekMsWUFBTSxRQUFRLEtBQUssU0FBUyxJQUFJLFFBQVE7QUFDeEMsVUFBSSxPQUFPO0FBQ1YsWUFBSTtBQUdKLFlBQUksTUFBTSx1QkFBdUI7QUFDaEMsc0JBQVksTUFBTSxLQUFLLGdCQUFnQixRQUFRO0FBQUEsUUFDaEQsT0FHSztBQUNKLHNCQUFZLE1BQU0sS0FBSyxrQkFBa0IsZUFBZSxNQUFNLEtBQUssZ0JBQWdCLFFBQVEsR0FBRyxTQUFTLG9CQUFvQjtBQUFBLFFBQzVIO0FBR0EsWUFBSSxXQUFXO0FBQ2QsaUJBQU8sS0FBSyxPQUFPLFVBQVUsV0FBVyxPQUFPO0FBQUEsUUFDaEQ7QUFBQSxNQUNEO0FBQUEsSUFDRCxPQUdLO0FBQ0osWUFBTSxRQUFRLEtBQUssTUFBTSxJQUFJLFFBQVE7QUFDckMsVUFBSSxPQUFPO0FBQ1YsZUFBTyxNQUFNLE1BQU0sS0FBSyxPQUFPLElBQUksV0FBVztBQUFBLE1BQy9DO0FBQUEsSUFDRDtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxNQUFNLE9BQU8sUUFBYSxRQUFjLFNBQTREO0FBR25HLFFBQUksQ0FBQyxRQUFRO0FBQ1osZUFBUyxNQUFNLEtBQUssa0JBQWtCLGVBQWUsTUFBTSxLQUFLLGdCQUFnQixTQUFTLG1CQUFtQixNQUFNLEdBQUcsU0FBUyxvQkFBb0I7QUFBQSxJQUNuSjtBQUVBLFFBQUksQ0FBQyxRQUFRO0FBQ1o7QUFBQSxJQUNEO0FBR0EsUUFBSSxLQUFLLDBCQUEwQixXQUFXLE1BQU0sR0FBRztBQUN0RCxZQUFNLFlBQVksTUFBTSxLQUFLLHFCQUFxQixNQUFNO0FBQ3hELFVBQUksQ0FBQyxXQUFXO0FBQ2Y7QUFBQSxNQUNELE9BQU87QUFDTixhQUFLLDBCQUEwQixlQUFlLFFBQVEsS0FBSztBQUFBLE1BQzVEO0FBQUEsSUFDRDtBQUdBLFFBQUksUUFBUSxRQUFRLE1BQU0sR0FBRztBQUM1QixhQUFPLEtBQUssS0FBSyxRQUFRO0FBQUEsUUFBRSxHQUFHO0FBQUEsUUFBUyxPQUFPO0FBQUE7QUFBQSxNQUFnRyxDQUFDO0FBQUEsSUFDaEo7QUFPQSxRQUFJLEtBQUssWUFBWSxZQUFZLE1BQU0sS0FBSyxLQUFLLG1CQUFtQixPQUFPLFFBQVEsUUFBUSxNQUFNLEtBQU0sTUFBTSxLQUFLLFlBQVksT0FBTyxNQUFNLEdBQUk7QUFDOUksWUFBTSxLQUFLLHVCQUF1QixLQUFLLENBQUMsRUFBRSxNQUFNLEVBQUUsUUFBUSxPQUFPLEVBQUUsQ0FBQyxHQUFHLGtCQUFrQixJQUFJO0FBSzdGLFlBQU0sVUFBVSxNQUFNLEtBQUssS0FBSyxRQUFRLE9BQU87QUFDL0MsVUFBSSxDQUFDLFNBQVM7QUFDYixjQUFNLEtBQUssS0FBSyxRQUFRLE9BQU87QUFBQSxNQUNoQztBQUVBLGFBQU87QUFBQSxJQUNSO0FBR0EsV0FBTyxLQUFLLFNBQVMsUUFBUSxRQUFRLE9BQU87QUFBQSxFQUM3QztBQUFBLEVBRUEsTUFBYyxTQUFTLFFBQWEsUUFBYSxTQUEwRDtBQUMxRyxRQUFJLFVBQVU7QUFJZCxVQUFNLGdCQUFnQixLQUFLLE1BQU0sSUFBSSxNQUFNO0FBQzNDLFFBQUksZUFBZSxXQUFXLEdBQUc7QUFDaEMsZ0JBQVUsTUFBTSxLQUFLLGlCQUFpQixlQUFlLFFBQVEsUUFBUSxPQUFPO0FBQUEsSUFDN0UsV0FJUyxLQUFLLFlBQVksWUFBWSxNQUFNLEdBQUc7QUFDOUMsWUFBTSxLQUFLLFlBQVksS0FBSyxRQUFRLFFBQVEsSUFBSTtBQUVoRCxnQkFBVTtBQUFBLElBQ1gsT0FJSztBQUNKLFlBQU0sWUFBWSxLQUFLLGFBQWEsU0FBUyxNQUFNO0FBQ25ELFVBQUksV0FBVztBQUNkLGtCQUFVLE1BQU0sS0FBSyxpQkFBaUIsV0FBVyxRQUFRLFFBQVEsT0FBTztBQUFBLE1BQ3pFO0FBQUEsSUFDRDtBQUVBLFFBQUksQ0FBQyxTQUFTO0FBQ2IsYUFBTztBQUFBLElBQ1I7QUFHQSxRQUFJO0FBQ0gsWUFBTSxLQUFLLE9BQU8sTUFBTTtBQUFBLElBQ3pCLFNBQVMsT0FBTztBQU9mLFdBQUssV0FBVyxNQUFNLEtBQUs7QUFBQSxJQUM1QjtBQUdBLFFBQUksT0FBTyxXQUFXLFFBQVEsVUFBVTtBQUN2QyxXQUFLLFNBQVMsY0FBYyxRQUFRLE1BQU07QUFBQSxJQUMzQztBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxNQUFjLGlCQUFpQixhQUFvRCxRQUFhLFFBQWEsU0FBa0Q7QUFHOUosUUFBSSxzQkFBMEM7QUFDOUMsVUFBTSxpQ0FBa0M7QUFDeEMsUUFBSSxPQUFPLCtCQUErQixnQkFBZ0IsWUFBWTtBQUNyRSw0QkFBc0IsK0JBQStCLFlBQVk7QUFBQSxJQUNsRTtBQUdBLFFBQUksZUFBd0I7QUFDNUIsUUFBSSxjQUFjLEtBQUssTUFBTSxJQUFJLE1BQU07QUFDdkMsUUFBSSxhQUFhLFdBQVcsR0FBRztBQUM5QixxQkFBZTtBQUFBLElBQ2hCLE9BR0s7QUFDSixxQkFBZSxNQUFNLEtBQUssWUFBWSxPQUFPLE1BQU07QUFHbkQsVUFBSSxDQUFDLGNBQWM7QUFDbEIsY0FBTSxLQUFLLE9BQU8sQ0FBQyxFQUFFLFVBQVUsUUFBUSxPQUFPLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDcEQ7QUFFQSxVQUFJO0FBQ0gsc0JBQWMsTUFBTSxLQUFLLE1BQU0sUUFBUSxRQUFRLEVBQUUsVUFBVSxvQkFBb0IsQ0FBQztBQUFBLE1BQ2pGLFNBQVMsT0FBTztBQUtmLFlBQUksY0FBYztBQUNqQixjQUMwQixNQUFPLDRCQUE0Qix3QkFBd0Isa0JBQy9ELE1BQU8sd0JBQXdCLG9CQUFvQixnQkFDdkU7QUFDRCxrQkFBTSxLQUFLLFlBQVksSUFBSSxNQUFNO0FBRWpDLG1CQUFPLEtBQUssaUJBQWlCLGFBQWEsUUFBUSxRQUFRLE9BQU87QUFBQSxVQUNsRTtBQUFBLFFBQ0Q7QUFFQSxjQUFNO0FBQUEsTUFDUDtBQUFBLElBQ0Q7QUFNQSxRQUFJO0FBQ0osUUFBSSx1QkFBdUIsMkJBQTJCLFlBQVkseUJBQXlCLGdCQUFnQixLQUFLLG1CQUFtQixPQUFPLFFBQVEsUUFBUSxnQkFBZ0IsWUFBWSxVQUFVLEtBQUssbUJBQW1CLGlCQUFpQixLQUFLLFlBQVksZ0JBQWdCLENBQUMsR0FBRztBQUM3USxjQUFRLE1BQU0sS0FBSyxpQkFBaUIsTUFBTTtBQUFBLElBQzNDLE9BQU87QUFDTixjQUFRO0FBQUEsSUFDVDtBQUVBLFFBQUksQ0FBQyxPQUFPO0FBQ1gsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLGtCQUEwQztBQUM5QyxRQUFJLHVCQUF1QixxQkFBcUI7QUFDL0MsVUFBSSxZQUFZLFdBQVcsR0FBRztBQUM3QiwwQkFBa0IsWUFBWSxtQkFBbUI7QUFBQSxNQUNsRDtBQUFBLElBQ0QsT0FBTztBQUNOLHdCQUFrQjtBQUFBLElBQ25CO0FBRUEsUUFBSSxrQkFBMEM7QUFDOUMsUUFBSSxZQUFZLFdBQVcsR0FBRztBQUM3Qix3QkFBa0IsWUFBWTtBQUFBLElBQy9CO0FBR0EsUUFBSSxtQkFBbUIsaUJBQWlCO0FBR3ZDLGtCQUFZLHdCQUF3QixtQkFBbUI7QUFHdkQsV0FBSyxhQUFhLFlBQVksaUJBQWlCLG9DQUFvQyxnQkFBZ0IsZUFBZSxDQUFDLENBQUM7QUFHcEgsWUFBTSxtQkFBbUIsZ0JBQWdCLGNBQWM7QUFDdkQsWUFBTSxtQkFBbUIsZ0JBQWdCLGNBQWM7QUFDdkQsVUFBSSxxQkFBcUIseUJBQXlCLHFCQUFxQix1QkFBdUI7QUFDN0Ysd0JBQWdCLFlBQVksZ0JBQWdCO0FBQUEsTUFDN0M7QUFHQSxZQUFNLDRCQUE0QixLQUFLLGtCQUFrQiw0QkFBNEIsZUFBZTtBQUNwRyxVQUFJLDJCQUEyQjtBQUM5QixtQkFBVyxDQUFDLEtBQUssS0FBSyxLQUFLLDJCQUEyQjtBQUNyRCxlQUFLLGtCQUFrQiwwQkFBMEIsaUJBQWlCLEtBQUssS0FBSztBQUFBLFFBQzdFO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFHQSxRQUFJLENBQUMsU0FBUyxRQUFRO0FBQ3JCLGdCQUFVO0FBQUEsUUFDVCxHQUFHO0FBQUEsUUFDSCxRQUFRLGVBQWUsd0JBQXdCLCtCQUErQix3QkFBd0I7QUFBQSxNQUN2RztBQUFBLElBQ0Q7QUFHQSxXQUFPLFlBQVksS0FBSztBQUFBLE1BQ3ZCLEdBQUc7QUFBQSxNQUNILE1BQU07QUFBQSxJQUNQLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFjLGlCQUFpQixVQUFpQztBQUMvRCxVQUFNLEVBQUUsVUFBVSxJQUFJLE1BQU0sS0FBSyxjQUFjLFFBQVE7QUFBQSxNQUN0RCxNQUFNO0FBQUEsTUFDTixTQUFTLFNBQVMsb0JBQW9CLG9EQUFvRCxTQUFTLFFBQVEsQ0FBQztBQUFBLE1BQzVHLFFBQVEsU0FBUyx5QkFBeUIsOEhBQThILFNBQVMsUUFBUSxHQUFHLFNBQVMsUUFBUSxRQUFRLENBQUMsQ0FBQztBQUFBLE1BQ3ZOLGVBQWUsU0FBUyxFQUFFLEtBQUssc0JBQXNCLFNBQVMsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLFdBQVc7QUFBQSxJQUN2RyxDQUFDO0FBRUQsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWMscUJBQXFCLFVBQWlDO0FBQ25FLFVBQU0sRUFBRSxVQUFVLElBQUksTUFBTSxLQUFLLGNBQWMsUUFBUTtBQUFBLE1BQ3RELE1BQU07QUFBQSxNQUNOLFNBQVMsU0FBUyx3QkFBd0IsNkRBQTZELFNBQVMsUUFBUSxDQUFDO0FBQUEsTUFDekgsUUFBUSxTQUFTLDhCQUE4QixvREFBb0Q7QUFBQSxNQUNuRyxlQUFlLFNBQVMsRUFBRSxLQUFLLDRCQUE0QixTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxlQUFlO0FBQUEsSUFDakgsQ0FBQztBQUVELFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxNQUFjLGdCQUFnQixVQUE2QjtBQUcxRCxRQUFJLEtBQUssWUFBWSxZQUFZLFFBQVEsR0FBRztBQUMzQyxhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sa0JBQWtCLEtBQUssbUJBQW1CO0FBQ2hELFVBQU0sa0JBQWtCLE1BQU0sS0FBSyxrQkFBa0IsZ0JBQWdCO0FBR3JFLFFBQUksb0JBQXdDO0FBQzVDLFFBQUksU0FBUyxXQUFXLFFBQVEsVUFBVTtBQUN6QyxZQUFNLFFBQVEsS0FBSyxTQUFTLElBQUksUUFBUTtBQUN4QyxVQUFJLE9BQU87QUFHVixZQUFJLE1BQU0sdUJBQXVCO0FBQ2hDLGlCQUFPLGdCQUFnQixVQUFVLGlCQUFpQixLQUFLLFlBQVksZ0JBQWdCO0FBQUEsUUFDcEY7QUFNQSxZQUFJO0FBQ0osWUFBSSxNQUFNLEtBQUssWUFBWSxpQkFBaUIsU0FBUyxpQkFBaUIsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLEdBQUc7QUFDL0YsMEJBQWdCLE1BQU07QUFBQSxRQUN2QixPQUFPO0FBQ04sMEJBQWdCLFNBQVMsUUFBUTtBQUFBLFFBQ2xDO0FBRUEsY0FBTSxhQUFhLE1BQU0sY0FBYztBQUN2QyxZQUFJLGNBQWMsZUFBZSx1QkFBdUI7QUFDdkQsOEJBQW9CLEtBQUssZ0JBQWdCLFlBQVksYUFBYTtBQUFBLFFBQ25FLE9BQU87QUFDTiw4QkFBb0I7QUFBQSxRQUNyQjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBR0EsUUFBSSxDQUFDLG1CQUFtQjtBQUN2QiwwQkFBb0IsU0FBUyxRQUFRO0FBQUEsSUFDdEM7QUFJQSxXQUFPLFNBQVMsaUJBQWlCLGlCQUFpQjtBQUFBLEVBQ25EO0FBQUEsRUFFQSxnQkFBZ0IsWUFBb0IsY0FBc0I7QUFDekQsVUFBTSxlQUFlLEtBQUssZ0JBQWdCLGdCQUFnQixVQUFVO0FBQ3BFLFFBQUksQ0FBQyxjQUFjO0FBQ2xCLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxvQkFBb0IsWUFBWSxZQUFZO0FBRWxELFVBQU0sYUFBYSxLQUFLLGdCQUFnQixjQUFjLFVBQVU7QUFDaEUsUUFBSSxXQUFXLFNBQVMsaUJBQWlCLEdBQUc7QUFDM0MsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLG1CQUFtQixXQUFXLEdBQUcsQ0FBQztBQUN4QyxRQUFJLGtCQUFrQjtBQUNyQixVQUFJLG1CQUFtQjtBQUN0QixlQUFPLEdBQUcsYUFBYSxVQUFVLEdBQUcsYUFBYSxRQUFRLGlCQUFpQixDQUFDLENBQUMsR0FBRyxnQkFBZ0I7QUFBQSxNQUNoRztBQUVBLGFBQU8sR0FBRyxZQUFZLEdBQUcsZ0JBQWdCO0FBQUEsSUFDMUM7QUFFQSxVQUFNLFlBQVksS0FBSyxnQkFBZ0IsYUFBYSxVQUFVO0FBQzlELFFBQUksVUFBVSxTQUFTLFlBQVksR0FBRztBQUNyQyxhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU8sVUFBVSxHQUFHLENBQUMsS0FBSztBQUFBLEVBQzNCO0FBQUE7QUFBQTtBQUFBLEVBTUEsTUFBTSxPQUFPLFVBQWUsU0FBeUM7QUFHcEUsUUFBSSxTQUFTLFdBQVcsUUFBUSxVQUFVO0FBQ3pDLFlBQU0sUUFBUSxLQUFLLFNBQVMsSUFBSSxRQUFRO0FBQ3hDLFVBQUksT0FBTztBQUNWLGVBQU8sTUFBTSxPQUFPLE9BQU87QUFBQSxNQUM1QjtBQUFBLElBQ0QsT0FHSztBQUNKLFlBQU0sUUFBUSxLQUFLLE1BQU0sSUFBSSxRQUFRO0FBQ3JDLFVBQUksVUFBVSxNQUFNLFFBQVEsS0FBSyxTQUFTLFFBQVE7QUFDakQsZUFBTyxNQUFNLE9BQU8sT0FBTztBQUFBLE1BQzVCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUEsRUFNQSxRQUFRLFVBQXdCO0FBQy9CLFVBQU0sUUFBUSxTQUFTLFdBQVcsUUFBUSxXQUFXLEtBQUssU0FBUyxJQUFJLFFBQVEsSUFBSSxLQUFLLE1BQU0sSUFBSSxRQUFRO0FBQzFHLFFBQUksT0FBTztBQUNWLGFBQU8sTUFBTSxRQUFRO0FBQUEsSUFDdEI7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBO0FBR0Q7QUF2cUJzQix3QkFJRyw4QkFBOEIsbUJBQW1CLGVBQWUseUJBQXlCLFNBQVMseUJBQXlCLGNBQWMsQ0FBQztBQUo3SSx3QkFLRywrQkFBK0IsbUJBQW1CLGVBQWUsNEJBQTRCLFNBQVMsNEJBQTRCLGVBQWUsQ0FBQztBQUxySiwwQkFBZjtBQUFBLEVBWUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBN0JtQjtBQStxQmYsSUFBTSxpQkFBTixjQUE2QixXQUF5QztBQUFBLEVBTTVFLFlBQzRDLGtDQUNMLG9CQUNKLGdCQUNJLG9CQUNyQztBQUNELFVBQU07QUFMcUM7QUFDTDtBQUNKO0FBQ0k7QUFJdEMsU0FBSyxxQkFBcUIsS0FBSyw0QkFBNEI7QUFFM0QsU0FBSyxrQkFBa0I7QUFBQSxFQUN4QjtBQUFBLEVBZEEsSUFBYyxvQkFBeUM7QUFBRSxXQUFPLEtBQUs7QUFBQSxFQUFvQjtBQUFBLEVBQ3pGLElBQWMsa0JBQWtCLE9BQTRCO0FBQUUsU0FBSyxxQkFBcUI7QUFBQSxFQUFPO0FBQUEsRUFldkYsb0JBQTBCO0FBR2pDLFNBQUssVUFBVSxLQUFLLGVBQWUsNEJBQTRCLE1BQU0sS0FBSyxvQkFBb0IsS0FBSyw0QkFBNEIsQ0FBQyxDQUFDO0FBQUEsRUFDbEk7QUFBQSxFQUVRLDhCQUFtRDtBQUMxRCxVQUFNLDJCQUFnRCxDQUFDO0FBR3ZELDZCQUF5QixLQUFLLEVBQUUsUUFBUSxLQUFLLG1CQUFtQixxQkFBcUIsVUFBVSxLQUFLLENBQUM7QUFHckcsNkJBQXlCLEtBQUssRUFBRSxXQUFXLHFCQUFxQixVQUFVLEtBQUssQ0FBQztBQUNoRiw2QkFBeUIsS0FBSyxFQUFFLFFBQVEsS0FBSyxtQkFBbUIsd0JBQXdCLFVBQVUsS0FBSyxDQUFDO0FBR3hHLFNBQUssZUFBZSxhQUFhLEVBQUUsUUFBUSxRQUFRLFlBQVU7QUFDNUQsK0JBQXlCLEtBQUssRUFBRSxRQUFRLFNBQVMsT0FBTyxLQUFLLFNBQVMsR0FBRyxVQUFVLEtBQUssQ0FBQztBQUFBLElBQzFGLENBQUM7QUFFRCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBTSxpQkFBaUIsVUFBMkIsU0FBaUY7QUFDbEksVUFBTSxFQUFFLFVBQVUsT0FBTyxJQUFJLE1BQU0sS0FBSywwQkFBMEIsVUFBVSxVQUFVLFFBQVEsV0FBVyxNQUFTO0FBRWxILFdBQU8sRUFBRSxVQUFVLFFBQVEsT0FBTztBQUFBLEVBQ25DO0FBQUEsRUFFQSxNQUFNLDBCQUEwQixVQUEyQixtQkFBd0Q7QUFDbEgsVUFBTSxtQkFBbUIsTUFBTSxLQUFLLGdDQUFnQyxVQUFVLGlCQUFpQjtBQUUvRixXQUFPO0FBQUEsTUFDTixVQUFVO0FBQUEsTUFDVixRQUFRLHFCQUFxQixXQUFXLHFCQUFxQixXQUFXLHFCQUFxQjtBQUFBO0FBQUEsSUFDOUY7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFNLHlCQUF5QixVQUEyQixTQUF3QyxrQkFBdUQ7QUFDeEosUUFBSTtBQUdKLFFBQUksU0FBUyxVQUFVO0FBQ3RCLFVBQUkscUJBQXFCLGlCQUFpQixRQUFRLGFBQWEsTUFBTTtBQUNwRSw0QkFBb0I7QUFBQSxNQUNyQixPQUFPO0FBQ04sNEJBQW9CLFFBQVE7QUFBQSxNQUM3QjtBQUFBLElBQ0QsV0FHUyxPQUFPLHFCQUFxQixVQUFVO0FBQzlDLDBCQUFvQjtBQUFBLElBQ3JCLFdBR1MsS0FBSyxpQ0FBaUMsU0FBUyxVQUFVLGdCQUFnQixNQUFNLGVBQWU7QUFDdEcsMEJBQW9CO0FBQUEsSUFDckI7QUFFQSxVQUFNLFdBQVcsTUFBTSxLQUFLLGdDQUFnQyxVQUFVLGlCQUFpQjtBQUV2RixXQUFPO0FBQUEsTUFDTjtBQUFBLE1BQ0EsUUFBUSxhQUFhLFdBQVcsYUFBYSxXQUFXLGFBQWE7QUFBQTtBQUFBLElBQ3RFO0FBQUEsRUFDRDtBQUFBLEVBRUEsa0NBQWtDLFVBQTJCLG1CQUFvQztBQUNoRyxRQUFJO0FBRUosVUFBTSxXQUFXLEtBQUssb0JBQW9CLFFBQVE7QUFDbEQsUUFBSSxVQUFVO0FBQ2IscUJBQWU7QUFBQSxJQUNoQixXQUFXLG1CQUFtQjtBQUM3QixxQkFBZTtBQUFBLElBQ2hCLE9BQU87QUFDTixxQkFBZSxLQUFLLGlDQUFpQyxTQUFTLFVBQVUsZ0JBQWdCO0FBQUEsSUFDekY7QUFFQSxXQUFPLGdCQUFnQjtBQUFBLEVBQ3hCO0FBQUEsRUFFQSxNQUFjLGdDQUFnQyxVQUEyQixtQkFBNkM7QUFDckgsUUFBSSxlQUFlLEtBQUssa0NBQWtDLFVBQVUsaUJBQWlCO0FBQ3JGLFFBQUksaUJBQWlCLFFBQVEsQ0FBRSxNQUFNLGVBQWUsWUFBWSxHQUFJO0FBQ25FLHFCQUFlO0FBQUEsSUFDaEI7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsb0JBQW9CLFVBQStDO0FBQzFFLFFBQUksWUFBWSxLQUFLLG1CQUFtQixRQUFRO0FBQy9DLGlCQUFXLFlBQVksS0FBSyxtQkFBbUI7QUFHOUMsWUFBSSxTQUFTLFVBQVUsS0FBSyxtQkFBbUIsT0FBTyxnQkFBZ0IsVUFBVSxTQUFTLE1BQU0sR0FBRztBQUNqRyxpQkFBTyxTQUFTO0FBQUEsUUFDakI7QUFHQSxZQUFJLFNBQVMsYUFBYSxRQUFRLFFBQVEsTUFBTSxJQUFJLFNBQVMsU0FBUyxJQUFJO0FBQ3pFLGlCQUFPLFNBQVM7QUFBQSxRQUNqQjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQWxJYSxpQkFBTjtBQUFBLEVBT0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVZVOyIsCiAgIm5hbWVzIjogW10KfQo=
