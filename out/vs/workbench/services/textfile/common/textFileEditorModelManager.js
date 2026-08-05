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
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { URI } from "../../../../base/common/uri.js";
import { TextFileEditorModel } from "./textFileEditorModel.js";
import { dispose, Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { IFileService, FileOperation, FileChangeType } from "../../../../platform/files/common/files.js";
import { Promises, ResourceQueue } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { TextFileSaveParticipant } from "./textFileSaveParticipant.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IWorkingCopyFileService } from "../../workingCopy/common/workingCopyFileService.js";
import { extname, joinPath } from "../../../../base/common/resources.js";
import { createTextBufferFactoryFromSnapshot } from "../../../../editor/common/model/textModel.js";
import { PLAINTEXT_EXTENSION, PLAINTEXT_LANGUAGE_ID } from "../../../../editor/common/languages/modesRegistry.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
let TextFileEditorModelManager = class extends Disposable {
  constructor(instantiationService, fileService, notificationService, workingCopyFileService, uriIdentityService) {
    super();
    this.instantiationService = instantiationService;
    this.fileService = fileService;
    this.notificationService = notificationService;
    this.workingCopyFileService = workingCopyFileService;
    this.uriIdentityService = uriIdentityService;
    this._onDidCreate = this._register(new Emitter({
      leakWarningThreshold: 500
      /* increased for users with hundreds of inputs opened */
    }));
    this.onDidCreate = this._onDidCreate.event;
    this._onDidResolve = this._register(new Emitter());
    this.onDidResolve = this._onDidResolve.event;
    this._onDidRemove = this._register(new Emitter());
    this.onDidRemove = this._onDidRemove.event;
    this._onDidChangeDirty = this._register(new Emitter());
    this.onDidChangeDirty = this._onDidChangeDirty.event;
    this._onDidChangeReadonly = this._register(new Emitter());
    this.onDidChangeReadonly = this._onDidChangeReadonly.event;
    this._onDidChangeOrphaned = this._register(new Emitter());
    this.onDidChangeOrphaned = this._onDidChangeOrphaned.event;
    this._onDidSaveError = this._register(new Emitter());
    this.onDidSaveError = this._onDidSaveError.event;
    this._onDidSave = this._register(new Emitter());
    this.onDidSave = this._onDidSave.event;
    this._onDidRevert = this._register(new Emitter());
    this.onDidRevert = this._onDidRevert.event;
    this._onDidChangeEncoding = this._register(new Emitter());
    this.onDidChangeEncoding = this._onDidChangeEncoding.event;
    this.mapResourceToModel = new ResourceMap();
    this.mapResourceToModelListeners = new ResourceMap();
    this.mapResourceToDisposeListener = new ResourceMap();
    this.mapResourceToPendingModelResolvers = new ResourceMap();
    this.modelResolveQueue = this._register(new ResourceQueue());
    this.saveErrorHandler = (() => {
      const notificationService = this.notificationService;
      return {
        onSaveError(error, model) {
          notificationService.error(localize({ key: "genericSaveError", comment: ["{0} is the resource that failed to save and {1} the error message"] }, "Failed to save '{0}': {1}", model.name, toErrorMessage(error, false)));
        }
      };
    })();
    this.mapCorrelationIdToModelsToRestore = /* @__PURE__ */ new Map();
    this.saveParticipants = this._register(this.instantiationService.createInstance(TextFileSaveParticipant));
    this.registerListeners();
  }
  get models() {
    return [...this.mapResourceToModel.values()];
  }
  registerListeners() {
    this._register(this.fileService.onDidFilesChange((e) => this.onDidFilesChange(e)));
    this._register(this.fileService.onDidChangeFileSystemProviderCapabilities((e) => this.onDidChangeFileSystemProviderCapabilities(e)));
    this._register(this.fileService.onDidChangeFileSystemProviderRegistrations((e) => this.onDidChangeFileSystemProviderRegistrations(e)));
    this._register(this.workingCopyFileService.onWillRunWorkingCopyFileOperation((e) => this.onWillRunWorkingCopyFileOperation(e)));
    this._register(this.workingCopyFileService.onDidFailWorkingCopyFileOperation((e) => this.onDidFailWorkingCopyFileOperation(e)));
    this._register(this.workingCopyFileService.onDidRunWorkingCopyFileOperation((e) => this.onDidRunWorkingCopyFileOperation(e)));
  }
  onDidFilesChange(e) {
    for (const model of this.models) {
      if (model.isDirty()) {
        continue;
      }
      if (e.contains(model.resource, FileChangeType.UPDATED, FileChangeType.ADDED)) {
        this.queueModelReload(model);
      }
    }
  }
  onDidChangeFileSystemProviderCapabilities(e) {
    this.queueModelReloads(e.scheme);
  }
  onDidChangeFileSystemProviderRegistrations(e) {
    if (!e.added) {
      return;
    }
    this.queueModelReloads(e.scheme);
  }
  queueModelReloads(scheme) {
    for (const model of this.models) {
      if (model.isDirty()) {
        continue;
      }
      if (scheme === model.resource.scheme) {
        this.queueModelReload(model);
      }
    }
  }
  queueModelReload(model) {
    const queueSize = this.modelResolveQueue.queueSize(model.resource);
    if (queueSize <= 1) {
      this.modelResolveQueue.queueFor(model.resource, async () => {
        try {
          await this.reload(model);
        } catch (error) {
          onUnexpectedError(error);
        }
      });
    }
  }
  onWillRunWorkingCopyFileOperation(e) {
    if (e.operation === FileOperation.MOVE || e.operation === FileOperation.COPY) {
      const modelsToRestore = [];
      for (const { source, target } of e.files) {
        if (source) {
          if (this.uriIdentityService.extUri.isEqual(source, target)) {
            continue;
          }
          const sourceModels = [];
          for (const model of this.models) {
            if (this.uriIdentityService.extUri.isEqualOrParent(model.resource, source)) {
              sourceModels.push(model);
            }
          }
          for (const sourceModel of sourceModels) {
            const sourceModelResource = sourceModel.resource;
            let targetModelResource;
            if (this.uriIdentityService.extUri.isEqual(sourceModelResource, source)) {
              targetModelResource = target;
            } else {
              targetModelResource = joinPath(target, sourceModelResource.path.substr(source.path.length + 1));
            }
            const languageId = sourceModel.getLanguageId();
            modelsToRestore.push({
              source: sourceModelResource,
              target: targetModelResource,
              language: languageId ? {
                id: languageId,
                explicit: sourceModel.languageChangeSource === "user"
              } : void 0,
              encoding: sourceModel.getEncoding(),
              snapshot: sourceModel.isDirty() ? sourceModel.createSnapshot() : void 0
            });
          }
        }
      }
      this.mapCorrelationIdToModelsToRestore.set(e.correlationId, modelsToRestore);
    }
  }
  onDidFailWorkingCopyFileOperation(e) {
    if (e.operation === FileOperation.MOVE || e.operation === FileOperation.COPY) {
      const modelsToRestore = this.mapCorrelationIdToModelsToRestore.get(e.correlationId);
      if (modelsToRestore) {
        this.mapCorrelationIdToModelsToRestore.delete(e.correlationId);
        modelsToRestore.forEach((model) => {
          if (model.snapshot) {
            this.get(model.source)?.setDirty(true);
          }
        });
      }
    }
  }
  onDidRunWorkingCopyFileOperation(e) {
    switch (e.operation) {
      // Create: Revert existing models
      case FileOperation.CREATE:
        e.waitUntil((async () => {
          for (const { target } of e.files) {
            const model = this.get(target);
            if (model && !model.isDisposed()) {
              await model.revert();
            }
          }
        })());
        break;
      // Move/Copy: restore models that were resolved before the operation took place
      case FileOperation.MOVE:
      case FileOperation.COPY:
        e.waitUntil((async () => {
          const modelsToRestore = this.mapCorrelationIdToModelsToRestore.get(e.correlationId);
          if (modelsToRestore) {
            this.mapCorrelationIdToModelsToRestore.delete(e.correlationId);
            await Promises.settled(modelsToRestore.map(async (modelToRestore) => {
              const target = this.uriIdentityService.asCanonicalUri(modelToRestore.target);
              const restoredModel = await this.resolve(target, {
                reload: { async: false },
                // enforce a reload
                contents: modelToRestore.snapshot ? createTextBufferFactoryFromSnapshot(modelToRestore.snapshot) : void 0,
                encoding: modelToRestore.encoding
              });
              if (modelToRestore.language?.id && modelToRestore.language.id !== PLAINTEXT_LANGUAGE_ID) {
                if (modelToRestore.language.explicit) {
                  restoredModel.setLanguageId(modelToRestore.language.id);
                } else if (restoredModel.getLanguageId() === PLAINTEXT_LANGUAGE_ID && extname(target) !== PLAINTEXT_EXTENSION) {
                  restoredModel.updateTextEditorModel(void 0, modelToRestore.language.id);
                }
              }
            }));
          }
        })());
        break;
    }
  }
  get(resource) {
    return this.mapResourceToModel.get(resource);
  }
  has(resource) {
    return this.mapResourceToModel.has(resource);
  }
  async reload(model) {
    await this.joinPendingResolves(model.resource);
    if (model.isDirty() || model.isDisposed() || !this.has(model.resource)) {
      return;
    }
    await this.doResolve(model, { reload: { async: false } });
  }
  async resolve(resource, options) {
    const pendingResolve = this.joinPendingResolves(resource);
    if (pendingResolve) {
      await pendingResolve;
    }
    return this.doResolve(resource, options);
  }
  async doResolve(resourceOrModel, options) {
    let model;
    let resource;
    if (URI.isUri(resourceOrModel)) {
      resource = resourceOrModel;
      model = this.get(resource);
    } else {
      resource = resourceOrModel.resource;
      model = resourceOrModel;
    }
    let modelResolve;
    let didCreateModel = false;
    if (model) {
      if (options?.contents) {
        modelResolve = model.resolve(options);
      } else if (options?.reload) {
        if (options.reload.async) {
          modelResolve = Promise.resolve();
          (async () => {
            try {
              await model.resolve(options);
            } catch (error) {
              if (!model.isDisposed()) {
                onUnexpectedError(error);
              }
            }
          })();
        } else {
          modelResolve = model.resolve(options);
        }
      } else {
        modelResolve = Promise.resolve();
      }
    } else {
      didCreateModel = true;
      const newModel = model = this.instantiationService.createInstance(TextFileEditorModel, resource, options ? options.encoding : void 0, options ? options.languageId : void 0);
      modelResolve = model.resolve(options);
      this.registerModel(newModel);
    }
    this.mapResourceToPendingModelResolvers.set(resource, modelResolve);
    this.add(resource, model);
    if (didCreateModel) {
      this._onDidCreate.fire(model);
      if (model.isDirty()) {
        this._onDidChangeDirty.fire(model);
      }
    }
    try {
      await modelResolve;
    } catch (error) {
      if (didCreateModel) {
        model.dispose();
      }
      throw error;
    } finally {
      this.mapResourceToPendingModelResolvers.delete(resource);
    }
    if (options?.languageId) {
      model.setLanguageId(options.languageId);
    }
    if (didCreateModel && model.isDirty()) {
      this._onDidChangeDirty.fire(model);
    }
    return model;
  }
  joinPendingResolves(resource) {
    const pendingModelResolve = this.mapResourceToPendingModelResolvers.get(resource);
    if (!pendingModelResolve) {
      return;
    }
    return this.doJoinPendingResolves(resource);
  }
  async doJoinPendingResolves(resource) {
    let currentModelCopyResolve;
    while (this.mapResourceToPendingModelResolvers.has(resource)) {
      const nextPendingModelResolve = this.mapResourceToPendingModelResolvers.get(resource);
      if (nextPendingModelResolve === currentModelCopyResolve) {
        return;
      }
      currentModelCopyResolve = nextPendingModelResolve;
      try {
        await nextPendingModelResolve;
      } catch (error) {
      }
    }
  }
  registerModel(model) {
    const modelListeners = new DisposableStore();
    modelListeners.add(model.onDidResolve((reason) => this._onDidResolve.fire({ model, reason })));
    modelListeners.add(model.onDidChangeDirty(() => this._onDidChangeDirty.fire(model)));
    modelListeners.add(model.onDidChangeReadonly(() => this._onDidChangeReadonly.fire(model)));
    modelListeners.add(model.onDidChangeOrphaned(() => this._onDidChangeOrphaned.fire(model)));
    modelListeners.add(model.onDidSaveError(() => this._onDidSaveError.fire(model)));
    modelListeners.add(model.onDidSave((e) => this._onDidSave.fire({ model, ...e })));
    modelListeners.add(model.onDidRevert(() => this._onDidRevert.fire(model)));
    modelListeners.add(model.onDidChangeEncoding(() => this._onDidChangeEncoding.fire(model)));
    this.mapResourceToModelListeners.set(model.resource, modelListeners);
  }
  add(resource, model) {
    const knownModel = this.mapResourceToModel.get(resource);
    if (knownModel === model) {
      return;
    }
    const disposeListener = this.mapResourceToDisposeListener.get(resource);
    disposeListener?.dispose();
    this.mapResourceToModel.set(resource, model);
    this.mapResourceToDisposeListener.set(resource, model.onWillDispose(() => this.remove(resource)));
  }
  remove(resource) {
    const removed = this.mapResourceToModel.delete(resource);
    const disposeListener = this.mapResourceToDisposeListener.get(resource);
    if (disposeListener) {
      dispose(disposeListener);
      this.mapResourceToDisposeListener.delete(resource);
    }
    const modelListener = this.mapResourceToModelListeners.get(resource);
    if (modelListener) {
      dispose(modelListener);
      this.mapResourceToModelListeners.delete(resource);
    }
    if (removed) {
      this._onDidRemove.fire(resource);
    }
  }
  addSaveParticipant(participant) {
    return this.saveParticipants.addSaveParticipant(participant);
  }
  runSaveParticipants(model, context, progress, token) {
    return this.saveParticipants.participate(model, context, progress, token);
  }
  //#endregion
  canDispose(model) {
    if (model.isDisposed() || !this.mapResourceToPendingModelResolvers.has(model.resource) && !model.isDirty()) {
      return true;
    }
    return this.doCanDispose(model);
  }
  async doCanDispose(model) {
    const pendingResolve = this.joinPendingResolves(model.resource);
    if (pendingResolve) {
      await pendingResolve;
      return this.canDispose(model);
    }
    if (model.isDirty()) {
      await Event.toPromise(model.onDidChangeDirty);
      return this.canDispose(model);
    }
    return true;
  }
  dispose() {
    super.dispose();
    this.mapResourceToModel.clear();
    this.mapResourceToPendingModelResolvers.clear();
    dispose(this.mapResourceToDisposeListener.values());
    this.mapResourceToDisposeListener.clear();
    dispose(this.mapResourceToModelListeners.values());
    this.mapResourceToModelListeners.clear();
  }
};
TextFileEditorModelManager = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IFileService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IWorkingCopyFileService),
  __decorateParam(4, IUriIdentityService)
], TextFileEditorModelManager);
export {
  TextFileEditorModelManager
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgVGV4dEZpbGVFZGl0b3JNb2RlbCB9IGZyb20gJy4vdGV4dEZpbGVFZGl0b3JNb2RlbC5qcyc7XG5pbXBvcnQgeyBkaXNwb3NlLCBJRGlzcG9zYWJsZSwgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElUZXh0RmlsZUVkaXRvck1vZGVsLCBJVGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXIsIElUZXh0RmlsZUVkaXRvck1vZGVsUmVzb2x2ZU9yQ3JlYXRlT3B0aW9ucywgSVRleHRGaWxlUmVzb2x2ZUV2ZW50LCBJVGV4dEZpbGVTYXZlRXZlbnQsIElUZXh0RmlsZVNhdmVQYXJ0aWNpcGFudCB9IGZyb20gJy4vdGV4dGZpbGVzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlLCBGaWxlQ2hhbmdlc0V2ZW50LCBGaWxlT3BlcmF0aW9uLCBGaWxlQ2hhbmdlVHlwZSwgSUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbkV2ZW50LCBJRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzQ2hhbmdlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgUHJvbWlzZXMsIFJlc291cmNlUXVldWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBUZXh0RmlsZVNhdmVQYXJ0aWNpcGFudCB9IGZyb20gJy4vdGV4dEZpbGVTYXZlUGFydGljaXBhbnQuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZVBhcnRpY2lwYW50Q29udGV4dCwgSVdvcmtpbmdDb3B5RmlsZVNlcnZpY2UsIFdvcmtpbmdDb3B5RmlsZUV2ZW50IH0gZnJvbSAnLi4vLi4vd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5RmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRleHRTbmFwc2hvdCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgam9pblBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnlGcm9tU25hcHNob3QgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBQTEFJTlRFWFRfRVhURU5TSU9OLCBQTEFJTlRFWFRfTEFOR1VBR0VfSUQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9tb2Rlc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzLCBJUHJvZ3Jlc3NTdGVwIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcblxuaW50ZXJmYWNlIElUZXh0RmlsZUVkaXRvck1vZGVsVG9SZXN0b3JlIHtcblx0cmVhZG9ubHkgc291cmNlOiBVUkk7XG5cdHJlYWRvbmx5IHRhcmdldDogVVJJO1xuXHRyZWFkb25seSBzbmFwc2hvdD86IElUZXh0U25hcHNob3Q7XG5cdHJlYWRvbmx5IGxhbmd1YWdlPzoge1xuXHRcdHJlYWRvbmx5IGlkOiBzdHJpbmc7XG5cdFx0cmVhZG9ubHkgZXhwbGljaXQ6IGJvb2xlYW47XG5cdH07XG5cdHJlYWRvbmx5IGVuY29kaW5nPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgVGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENyZWF0ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFRleHRGaWxlRWRpdG9yTW9kZWw+KHsgbGVha1dhcm5pbmdUaHJlc2hvbGQ6IDUwMCAvKiBpbmNyZWFzZWQgZm9yIHVzZXJzIHdpdGggaHVuZHJlZHMgb2YgaW5wdXRzIG9wZW5lZCAqLyB9KSk7XG5cdHJlYWRvbmx5IG9uRGlkQ3JlYXRlID0gdGhpcy5fb25EaWRDcmVhdGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZXNvbHZlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVRleHRGaWxlUmVzb2x2ZUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRSZXNvbHZlID0gdGhpcy5fb25EaWRSZXNvbHZlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVtb3ZlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8VVJJPigpKTtcblx0cmVhZG9ubHkgb25EaWRSZW1vdmUgPSB0aGlzLl9vbkRpZFJlbW92ZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZURpcnR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8VGV4dEZpbGVFZGl0b3JNb2RlbD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRGlydHkgPSB0aGlzLl9vbkRpZENoYW5nZURpcnR5LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUmVhZG9ubHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxUZXh0RmlsZUVkaXRvck1vZGVsPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VSZWFkb25seSA9IHRoaXMuX29uRGlkQ2hhbmdlUmVhZG9ubHkuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VPcnBoYW5lZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFRleHRGaWxlRWRpdG9yTW9kZWw+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZU9ycGhhbmVkID0gdGhpcy5fb25EaWRDaGFuZ2VPcnBoYW5lZC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFNhdmVFcnJvciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFRleHRGaWxlRWRpdG9yTW9kZWw+KCkpO1xuXHRyZWFkb25seSBvbkRpZFNhdmVFcnJvciA9IHRoaXMuX29uRGlkU2F2ZUVycm9yLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU2F2ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElUZXh0RmlsZVNhdmVFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkU2F2ZSA9IHRoaXMuX29uRGlkU2F2ZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJldmVydCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFRleHRGaWxlRWRpdG9yTW9kZWw+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJldmVydCA9IHRoaXMuX29uRGlkUmV2ZXJ0LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlRW5jb2RpbmcgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxUZXh0RmlsZUVkaXRvck1vZGVsPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VFbmNvZGluZyA9IHRoaXMuX29uRGlkQ2hhbmdlRW5jb2RpbmcuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBtYXBSZXNvdXJjZVRvTW9kZWwgPSBuZXcgUmVzb3VyY2VNYXA8VGV4dEZpbGVFZGl0b3JNb2RlbD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBtYXBSZXNvdXJjZVRvTW9kZWxMaXN0ZW5lcnMgPSBuZXcgUmVzb3VyY2VNYXA8SURpc3Bvc2FibGU+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgbWFwUmVzb3VyY2VUb0Rpc3Bvc2VMaXN0ZW5lciA9IG5ldyBSZXNvdXJjZU1hcDxJRGlzcG9zYWJsZT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBtYXBSZXNvdXJjZVRvUGVuZGluZ01vZGVsUmVzb2x2ZXJzID0gbmV3IFJlc291cmNlTWFwPFByb21pc2U8dm9pZD4+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBtb2RlbFJlc29sdmVRdWV1ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSZXNvdXJjZVF1ZXVlKCkpO1xuXG5cdHNhdmVFcnJvckhhbmRsZXIgPSAoKCkgPT4ge1xuXHRcdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSB0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2U7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0b25TYXZlRXJyb3IoZXJyb3I6IEVycm9yLCBtb2RlbDogSVRleHRGaWxlRWRpdG9yTW9kZWwpOiB2b2lkIHtcblx0XHRcdFx0bm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihsb2NhbGl6ZSh7IGtleTogJ2dlbmVyaWNTYXZlRXJyb3InLCBjb21tZW50OiBbJ3swfSBpcyB0aGUgcmVzb3VyY2UgdGhhdCBmYWlsZWQgdG8gc2F2ZSBhbmQgezF9IHRoZSBlcnJvciBtZXNzYWdlJ10gfSwgXCJGYWlsZWQgdG8gc2F2ZSAnezB9JzogezF9XCIsIG1vZGVsLm5hbWUsIHRvRXJyb3JNZXNzYWdlKGVycm9yLCBmYWxzZSkpKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KSgpO1xuXG5cdGdldCBtb2RlbHMoKTogVGV4dEZpbGVFZGl0b3JNb2RlbFtdIHtcblx0XHRyZXR1cm4gWy4uLnRoaXMubWFwUmVzb3VyY2VUb01vZGVsLnZhbHVlcygpXTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya2luZ0NvcHlGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtpbmdDb3B5RmlsZVNlcnZpY2U6IElXb3JraW5nQ29weUZpbGVTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnNhdmVQYXJ0aWNpcGFudHMgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlU2F2ZVBhcnRpY2lwYW50KSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXG5cdFx0Ly8gVXBkYXRlIG1vZGVscyBmcm9tIGZpbGUgY2hhbmdlIGV2ZW50c1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZVNlcnZpY2Uub25EaWRGaWxlc0NoYW5nZShlID0+IHRoaXMub25EaWRGaWxlc0NoYW5nZShlKSkpO1xuXG5cdFx0Ly8gRmlsZSBzeXN0ZW0gcHJvdmlkZXIgY2hhbmdlc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZVNlcnZpY2Uub25EaWRDaGFuZ2VGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMoZSA9PiB0aGlzLm9uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5maWxlU2VydmljZS5vbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbnMoZSA9PiB0aGlzLm9uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyUmVnaXN0cmF0aW9ucyhlKSkpO1xuXG5cdFx0Ly8gV29ya2luZyBjb3B5IG9wZXJhdGlvbnNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtpbmdDb3B5RmlsZVNlcnZpY2Uub25XaWxsUnVuV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uKGUgPT4gdGhpcy5vbldpbGxSdW5Xb3JraW5nQ29weUZpbGVPcGVyYXRpb24oZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtpbmdDb3B5RmlsZVNlcnZpY2Uub25EaWRGYWlsV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uKGUgPT4gdGhpcy5vbkRpZEZhaWxXb3JraW5nQ29weUZpbGVPcGVyYXRpb24oZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtpbmdDb3B5RmlsZVNlcnZpY2Uub25EaWRSdW5Xb3JraW5nQ29weUZpbGVPcGVyYXRpb24oZSA9PiB0aGlzLm9uRGlkUnVuV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uKGUpKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkRmlsZXNDaGFuZ2UoZTogRmlsZUNoYW5nZXNFdmVudCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgbW9kZWwgb2YgdGhpcy5tb2RlbHMpIHtcblx0XHRcdGlmIChtb2RlbC5pc0RpcnR5KCkpIHtcblx0XHRcdFx0Y29udGludWU7IC8vIG5ldmVyIHJlbG9hZCBkaXJ0eSBtb2RlbHNcblx0XHRcdH1cblxuXHRcdFx0Ly8gVHJpZ2dlciBhIG1vZGVsIHJlc29sdmUgZm9yIGFueSB1cGRhdGUgb3IgYWRkIGV2ZW50IHRoYXQgaW1wYWN0c1xuXHRcdFx0Ly8gdGhlIG1vZGVsLiBXZSBhbHNvIGNvbnNpZGVyIHRoZSBhZGRlZCBldmVudCBiZWNhdXNlIGl0IGNvdWxkXG5cdFx0XHQvLyBiZSB0aGF0IGEgZmlsZSB3YXMgYWRkZWQgYW5kIHVwZGF0ZWQgcmlnaHQgYWZ0ZXIuXG5cdFx0XHRpZiAoZS5jb250YWlucyhtb2RlbC5yZXNvdXJjZSwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCwgRmlsZUNoYW5nZVR5cGUuQURERUQpKSB7XG5cdFx0XHRcdHRoaXMucXVldWVNb2RlbFJlbG9hZChtb2RlbCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcyhlOiBJRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzQ2hhbmdlRXZlbnQpOiB2b2lkIHtcblxuXHRcdC8vIFJlc29sdmUgbW9kZWxzIGFnYWluIGZvciBmaWxlIHN5c3RlbXMgdGhhdCBjaGFuZ2VkXG5cdFx0Ly8gY2FwYWJpbGl0aWVzIHRvIGZldGNoIGxhdGVzdCBtZXRhZGF0YSAoZS5nLiByZWFkb25seSlcblx0XHQvLyBpbnRvIGFsbCBtb2RlbHMuXG5cdFx0dGhpcy5xdWV1ZU1vZGVsUmVsb2FkcyhlLnNjaGVtZSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyUmVnaXN0cmF0aW9ucyhlOiBJRmlsZVN5c3RlbVByb3ZpZGVyUmVnaXN0cmF0aW9uRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoIWUuYWRkZWQpIHtcblx0XHRcdHJldHVybjsgLy8gb25seSBpZiBhZGRlZFxuXHRcdH1cblxuXHRcdC8vIFJlc29sdmUgbW9kZWxzIGFnYWluIGZvciBmaWxlIHN5c3RlbXMgdGhhdCByZWdpc3RlcmVkXG5cdFx0Ly8gdG8gYWNjb3VudCBmb3IgY2FwYWJpbGl0eSBjaGFuZ2VzOiBleHRlbnNpb25zIG1heVxuXHRcdC8vIHVucmVnaXN0ZXIgYW5kIHJlZ2lzdGVyIHRoZSBzYW1lIHByb3ZpZGVyIHdpdGggZGlmZmVyZW50XG5cdFx0Ly8gY2FwYWJpbGl0aWVzLCBzbyB3ZSB3YW50IHRvIGVuc3VyZSB0byBmZXRjaCBsYXRlc3Rcblx0XHQvLyBtZXRhZGF0YSAoZS5nLiByZWFkb25seSkgaW50byBhbGwgbW9kZWxzLlxuXHRcdHRoaXMucXVldWVNb2RlbFJlbG9hZHMoZS5zY2hlbWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBxdWV1ZU1vZGVsUmVsb2FkcyhzY2hlbWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgbW9kZWwgb2YgdGhpcy5tb2RlbHMpIHtcblx0XHRcdGlmIChtb2RlbC5pc0RpcnR5KCkpIHtcblx0XHRcdFx0Y29udGludWU7IC8vIG5ldmVyIHJlbG9hZCBkaXJ0eSBtb2RlbHNcblx0XHRcdH1cblxuXHRcdFx0aWYgKHNjaGVtZSA9PT0gbW9kZWwucmVzb3VyY2Uuc2NoZW1lKSB7XG5cdFx0XHRcdHRoaXMucXVldWVNb2RlbFJlbG9hZChtb2RlbCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBxdWV1ZU1vZGVsUmVsb2FkKG1vZGVsOiBUZXh0RmlsZUVkaXRvck1vZGVsKTogdm9pZCB7XG5cblx0XHQvLyBSZXNvbHZlIG1vZGVsIHRvIHVwZGF0ZSAodXNlIGEgcXVldWUgdG8gcHJldmVudCBhY2N1bXVsYXRpb24gb2YgcmVzb2x2ZXNcblx0XHQvLyB3aGVuIHRoZSByZXNvbHZlIGFjdHVhbGx5IHRha2VzIGxvbmcuIEF0IG1vc3Qgd2Ugb25seSB3YW50IHRoZSBxdWV1ZVxuXHRcdC8vIHRvIGhhdmUgYSBzaXplIG9mIDIgKDEgcnVubmluZyByZXNvbHZlIGFuZCAxIHF1ZXVlZCByZXNvbHZlKS5cblx0XHRjb25zdCBxdWV1ZVNpemUgPSB0aGlzLm1vZGVsUmVzb2x2ZVF1ZXVlLnF1ZXVlU2l6ZShtb2RlbC5yZXNvdXJjZSk7XG5cdFx0aWYgKHF1ZXVlU2l6ZSA8PSAxKSB7XG5cdFx0XHR0aGlzLm1vZGVsUmVzb2x2ZVF1ZXVlLnF1ZXVlRm9yKG1vZGVsLnJlc291cmNlLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5yZWxvYWQobW9kZWwpO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycm9yKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBtYXBDb3JyZWxhdGlvbklkVG9Nb2RlbHNUb1Jlc3RvcmUgPSBuZXcgTWFwPG51bWJlciwgSVRleHRGaWxlRWRpdG9yTW9kZWxUb1Jlc3RvcmVbXT4oKTtcblxuXHRwcml2YXRlIG9uV2lsbFJ1bldvcmtpbmdDb3B5RmlsZU9wZXJhdGlvbihlOiBXb3JraW5nQ29weUZpbGVFdmVudCk6IHZvaWQge1xuXG5cdFx0Ly8gTW92ZSAvIENvcHk6IHJlbWVtYmVyIG1vZGVscyB0byByZXN0b3JlIGFmdGVyIHRoZSBvcGVyYXRpb25cblx0XHRpZiAoZS5vcGVyYXRpb24gPT09IEZpbGVPcGVyYXRpb24uTU9WRSB8fCBlLm9wZXJhdGlvbiA9PT0gRmlsZU9wZXJhdGlvbi5DT1BZKSB7XG5cdFx0XHRjb25zdCBtb2RlbHNUb1Jlc3RvcmU6IElUZXh0RmlsZUVkaXRvck1vZGVsVG9SZXN0b3JlW10gPSBbXTtcblxuXHRcdFx0Zm9yIChjb25zdCB7IHNvdXJjZSwgdGFyZ2V0IH0gb2YgZS5maWxlcykge1xuXHRcdFx0XHRpZiAoc291cmNlKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKHNvdXJjZSwgdGFyZ2V0KSkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7IC8vIGlnbm9yZSBpZiByZXNvdXJjZXMgYXJlIGNvbnNpZGVyZWQgZXF1YWxcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBmaW5kIGFsbCBtb2RlbHMgdGhhdCByZWxhdGVkIHRvIHNvdXJjZSAoY2FuIGJlIG1hbnkgaWYgcmVzb3VyY2UgaXMgYSBmb2xkZXIpXG5cdFx0XHRcdFx0Y29uc3Qgc291cmNlTW9kZWxzOiBUZXh0RmlsZUVkaXRvck1vZGVsW10gPSBbXTtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IG1vZGVsIG9mIHRoaXMubW9kZWxzKSB7XG5cdFx0XHRcdFx0XHRpZiAodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWxPclBhcmVudChtb2RlbC5yZXNvdXJjZSwgc291cmNlKSkge1xuXHRcdFx0XHRcdFx0XHRzb3VyY2VNb2RlbHMucHVzaChtb2RlbCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gcmVtZW1iZXIgZWFjaCBzb3VyY2UgbW9kZWwgdG8gcmVzb2x2ZSBhZ2FpbiBhZnRlciBtb3ZlIGlzIGRvbmVcblx0XHRcdFx0XHQvLyB3aXRoIG9wdGlvbmFsIGNvbnRlbnQgdG8gcmVzdG9yZSBpZiBpdCB3YXMgZGlydHlcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHNvdXJjZU1vZGVsIG9mIHNvdXJjZU1vZGVscykge1xuXHRcdFx0XHRcdFx0Y29uc3Qgc291cmNlTW9kZWxSZXNvdXJjZSA9IHNvdXJjZU1vZGVsLnJlc291cmNlO1xuXG5cdFx0XHRcdFx0XHQvLyBJZiB0aGUgc291cmNlIGlzIHRoZSBhY3R1YWwgbW9kZWwsIGp1c3QgdXNlIHRhcmdldCBhcyBuZXcgcmVzb3VyY2Vcblx0XHRcdFx0XHRcdGxldCB0YXJnZXRNb2RlbFJlc291cmNlOiBVUkk7XG5cdFx0XHRcdFx0XHRpZiAodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoc291cmNlTW9kZWxSZXNvdXJjZSwgc291cmNlKSkge1xuXHRcdFx0XHRcdFx0XHR0YXJnZXRNb2RlbFJlc291cmNlID0gdGFyZ2V0O1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBPdGhlcndpc2UgYSBwYXJlbnQgZm9sZGVyIG9mIHRoZSBzb3VyY2UgaXMgYmVpbmcgbW92ZWQsIHNvIHdlIG5lZWRcblx0XHRcdFx0XHRcdC8vIHRvIGNvbXB1dGUgdGhlIHRhcmdldCByZXNvdXJjZSBiYXNlZCBvbiB0aGF0XG5cdFx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGFyZ2V0TW9kZWxSZXNvdXJjZSA9IGpvaW5QYXRoKHRhcmdldCwgc291cmNlTW9kZWxSZXNvdXJjZS5wYXRoLnN1YnN0cihzb3VyY2UucGF0aC5sZW5ndGggKyAxKSk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGNvbnN0IGxhbmd1YWdlSWQgPSBzb3VyY2VNb2RlbC5nZXRMYW5ndWFnZUlkKCk7XG5cdFx0XHRcdFx0XHRtb2RlbHNUb1Jlc3RvcmUucHVzaCh7XG5cdFx0XHRcdFx0XHRcdHNvdXJjZTogc291cmNlTW9kZWxSZXNvdXJjZSxcblx0XHRcdFx0XHRcdFx0dGFyZ2V0OiB0YXJnZXRNb2RlbFJlc291cmNlLFxuXHRcdFx0XHRcdFx0XHRsYW5ndWFnZTogbGFuZ3VhZ2VJZCA/IHtcblx0XHRcdFx0XHRcdFx0XHRpZDogbGFuZ3VhZ2VJZCxcblx0XHRcdFx0XHRcdFx0XHRleHBsaWNpdDogc291cmNlTW9kZWwubGFuZ3VhZ2VDaGFuZ2VTb3VyY2UgPT09ICd1c2VyJ1xuXHRcdFx0XHRcdFx0XHR9IDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRlbmNvZGluZzogc291cmNlTW9kZWwuZ2V0RW5jb2RpbmcoKSxcblx0XHRcdFx0XHRcdFx0c25hcHNob3Q6IHNvdXJjZU1vZGVsLmlzRGlydHkoKSA/IHNvdXJjZU1vZGVsLmNyZWF0ZVNuYXBzaG90KCkgOiB1bmRlZmluZWRcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLm1hcENvcnJlbGF0aW9uSWRUb01vZGVsc1RvUmVzdG9yZS5zZXQoZS5jb3JyZWxhdGlvbklkLCBtb2RlbHNUb1Jlc3RvcmUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRGYWlsV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uKGU6IFdvcmtpbmdDb3B5RmlsZUV2ZW50KTogdm9pZCB7XG5cblx0XHQvLyBNb3ZlIC8gQ29weTogcmVzdG9yZSBkaXJ0eSBmbGFnIG9uIG1vZGVscyB0byByZXN0b3JlIHRoYXQgd2VyZSBkaXJ0eVxuXHRcdGlmICgoZS5vcGVyYXRpb24gPT09IEZpbGVPcGVyYXRpb24uTU9WRSB8fCBlLm9wZXJhdGlvbiA9PT0gRmlsZU9wZXJhdGlvbi5DT1BZKSkge1xuXHRcdFx0Y29uc3QgbW9kZWxzVG9SZXN0b3JlID0gdGhpcy5tYXBDb3JyZWxhdGlvbklkVG9Nb2RlbHNUb1Jlc3RvcmUuZ2V0KGUuY29ycmVsYXRpb25JZCk7XG5cdFx0XHRpZiAobW9kZWxzVG9SZXN0b3JlKSB7XG5cdFx0XHRcdHRoaXMubWFwQ29ycmVsYXRpb25JZFRvTW9kZWxzVG9SZXN0b3JlLmRlbGV0ZShlLmNvcnJlbGF0aW9uSWQpO1xuXG5cdFx0XHRcdG1vZGVsc1RvUmVzdG9yZS5mb3JFYWNoKG1vZGVsID0+IHtcblx0XHRcdFx0XHQvLyBzbmFwc2hvdCBwcmVzZW5jZSBtZWFucyB0aGlzIG1vZGVsIHVzZWQgdG8gYmUgZGlydHkgYW5kIHNvIHdlIHJlc3RvcmUgdGhhdFxuXHRcdFx0XHRcdC8vIGZsYWcuIHdlIGRvIE5PVCBoYXZlIHRvIHJlc3RvcmUgdGhlIGNvbnRlbnQgYmVjYXVzZSB0aGUgbW9kZWwgd2FzIG9ubHkgc29mdFxuXHRcdFx0XHRcdC8vIHJldmVydGVkIGFuZCBkaWQgbm90IGxvb3NlIGl0cyBvcmlnaW5hbCBkaXJ0eSBjb250ZW50cy5cblx0XHRcdFx0XHRpZiAobW9kZWwuc25hcHNob3QpIHtcblx0XHRcdFx0XHRcdHRoaXMuZ2V0KG1vZGVsLnNvdXJjZSk/LnNldERpcnR5KHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZFJ1bldvcmtpbmdDb3B5RmlsZU9wZXJhdGlvbihlOiBXb3JraW5nQ29weUZpbGVFdmVudCk6IHZvaWQge1xuXHRcdHN3aXRjaCAoZS5vcGVyYXRpb24pIHtcblxuXHRcdFx0Ly8gQ3JlYXRlOiBSZXZlcnQgZXhpc3RpbmcgbW9kZWxzXG5cdFx0XHRjYXNlIEZpbGVPcGVyYXRpb24uQ1JFQVRFOlxuXHRcdFx0XHRlLndhaXRVbnRpbCgoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgeyB0YXJnZXQgfSBvZiBlLmZpbGVzKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZ2V0KHRhcmdldCk7XG5cdFx0XHRcdFx0XHRpZiAobW9kZWwgJiYgIW1vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCBtb2RlbC5yZXZlcnQoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKCkpO1xuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Ly8gTW92ZS9Db3B5OiByZXN0b3JlIG1vZGVscyB0aGF0IHdlcmUgcmVzb2x2ZWQgYmVmb3JlIHRoZSBvcGVyYXRpb24gdG9vayBwbGFjZVxuXHRcdFx0Y2FzZSBGaWxlT3BlcmF0aW9uLk1PVkU6XG5cdFx0XHRjYXNlIEZpbGVPcGVyYXRpb24uQ09QWTpcblx0XHRcdFx0ZS53YWl0VW50aWwoKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBtb2RlbHNUb1Jlc3RvcmUgPSB0aGlzLm1hcENvcnJlbGF0aW9uSWRUb01vZGVsc1RvUmVzdG9yZS5nZXQoZS5jb3JyZWxhdGlvbklkKTtcblx0XHRcdFx0XHRpZiAobW9kZWxzVG9SZXN0b3JlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm1hcENvcnJlbGF0aW9uSWRUb01vZGVsc1RvUmVzdG9yZS5kZWxldGUoZS5jb3JyZWxhdGlvbklkKTtcblxuXHRcdFx0XHRcdFx0YXdhaXQgUHJvbWlzZXMuc2V0dGxlZChtb2RlbHNUb1Jlc3RvcmUubWFwKGFzeW5jIG1vZGVsVG9SZXN0b3JlID0+IHtcblxuXHRcdFx0XHRcdFx0XHQvLyBGcm9tIHRoaXMgbW9tZW50IG9uLCBvbmx5IG9wZXJhdGUgb24gdGhlIGNhbm9uaWNhbCByZXNvdXJjZVxuXHRcdFx0XHRcdFx0XHQvLyB0byBmaXggYSBwb3RlbnRpYWwgZGF0YSBsb3NzIGlzc3VlOlxuXHRcdFx0XHRcdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjExMzc0XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHRhcmdldCA9IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmFzQ2Fub25pY2FsVXJpKG1vZGVsVG9SZXN0b3JlLnRhcmdldCk7XG5cblx0XHRcdFx0XHRcdFx0Ly8gcmVzdG9yZSB0aGUgbW9kZWwgYXQgdGhlIHRhcmdldC4gaWYgd2UgaGF2ZSBwcmV2aW91cyBkaXJ0eSBjb250ZW50LCB3ZSBwYXNzIGl0XG5cdFx0XHRcdFx0XHRcdC8vIG92ZXIgdG8gYmUgdXNlZCwgb3RoZXJ3aXNlIHdlIGZvcmNlIGEgcmVsb2FkIGZyb20gZGlzay4gdGhpcyBpcyBpbXBvcnRhbnRcblx0XHRcdFx0XHRcdFx0Ly8gYmVjYXVzZSB3ZSBrbm93IHRoZSBmaWxlIGhhcyBjaGFuZ2VkIG9uIGRpc2sgYWZ0ZXIgdGhlIG1vdmUgYW5kIHRoZSBtb2RlbCBtaWdodFxuXHRcdFx0XHRcdFx0XHQvLyBoYXZlIHN0aWxsIGV4aXN0ZWQgd2l0aCB0aGUgcHJldmlvdXMgc3RhdGUuIHRoaXMgZW5zdXJlcyB0aGF0IHRoZSBtb2RlbCBpcyBub3Rcblx0XHRcdFx0XHRcdFx0Ly8gdHJhY2tpbmcgYSBzdGFsZSBzdGF0ZS5cblx0XHRcdFx0XHRcdFx0Y29uc3QgcmVzdG9yZWRNb2RlbCA9IGF3YWl0IHRoaXMucmVzb2x2ZSh0YXJnZXQsIHtcblx0XHRcdFx0XHRcdFx0XHRyZWxvYWQ6IHsgYXN5bmM6IGZhbHNlIH0sIC8vIGVuZm9yY2UgYSByZWxvYWRcblx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogbW9kZWxUb1Jlc3RvcmUuc25hcHNob3QgPyBjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeUZyb21TbmFwc2hvdChtb2RlbFRvUmVzdG9yZS5zbmFwc2hvdCkgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdFx0ZW5jb2Rpbmc6IG1vZGVsVG9SZXN0b3JlLmVuY29kaW5nXG5cdFx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRcdC8vIHJlc3RvcmUgbW9kZWwgbGFuZ3VhZ2Ugb25seSBpZiBpdCBpcyBzcGVjaWZpY1xuXHRcdFx0XHRcdFx0XHRpZiAobW9kZWxUb1Jlc3RvcmUubGFuZ3VhZ2U/LmlkICYmIG1vZGVsVG9SZXN0b3JlLmxhbmd1YWdlLmlkICE9PSBQTEFJTlRFWFRfTEFOR1VBR0VfSUQpIHtcblxuXHRcdFx0XHRcdFx0XHRcdC8vIGFuIGV4cGxpY2l0bHkgc2V0IGxhbmd1YWdlIGlzIHJlc3RvcmVkIHZpYSBgc2V0TGFuZ3VhZ2VJZGBcblx0XHRcdFx0XHRcdFx0XHQvLyB0byBwcmVzZXJ2ZSBpdCBhcyBleHBsaWNpdGx5IHNldCBieSB0aGUgdXNlci5cblx0XHRcdFx0XHRcdFx0XHQvLyAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIwMzY0OClcblx0XHRcdFx0XHRcdFx0XHRpZiAobW9kZWxUb1Jlc3RvcmUubGFuZ3VhZ2UuZXhwbGljaXQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJlc3RvcmVkTW9kZWwuc2V0TGFuZ3VhZ2VJZChtb2RlbFRvUmVzdG9yZS5sYW5ndWFnZS5pZCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0Ly8gb3RoZXJ3aXNlLCBhIG1vZGVsIGxhbmd1YWdlIGlzIGFwcGxpZWQgdmlhIGxvd2VyIGxldmVsXG5cdFx0XHRcdFx0XHRcdFx0Ly8gQVBJcyB0byBub3QgY29uZnVzZSBpdCB3aXRoIGFuIGV4cGxpY2l0bHkgc2V0IGxhbmd1YWdlLlxuXHRcdFx0XHRcdFx0XHRcdC8vIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTI1Nzk1KVxuXHRcdFx0XHRcdFx0XHRcdGVsc2UgaWYgKHJlc3RvcmVkTW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpID09PSBQTEFJTlRFWFRfTEFOR1VBR0VfSUQgJiYgZXh0bmFtZSh0YXJnZXQpICE9PSBQTEFJTlRFWFRfRVhURU5TSU9OKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXN0b3JlZE1vZGVsLnVwZGF0ZVRleHRFZGl0b3JNb2RlbCh1bmRlZmluZWQsIG1vZGVsVG9SZXN0b3JlLmxhbmd1YWdlLmlkKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKCkpO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdH1cblxuXHRnZXQocmVzb3VyY2U6IFVSSSk6IFRleHRGaWxlRWRpdG9yTW9kZWwgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLm1hcFJlc291cmNlVG9Nb2RlbC5nZXQocmVzb3VyY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYXMocmVzb3VyY2U6IFVSSSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1hcFJlc291cmNlVG9Nb2RlbC5oYXMocmVzb3VyY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWxvYWQobW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIEF3YWl0IGEgcGVuZGluZyBtb2RlbCByZXNvbHZlIGZpcnN0IGJlZm9yZSBwcm9jZWVkaW5nXG5cdFx0Ly8gdG8gZW5zdXJlIHRoYXQgd2UgbmV2ZXIgcmVzb2x2ZSBhIG1vZGVsIG1vcmUgdGhhbiBvbmNlXG5cdFx0Ly8gaW4gcGFyYWxsZWwuXG5cdFx0YXdhaXQgdGhpcy5qb2luUGVuZGluZ1Jlc29sdmVzKG1vZGVsLnJlc291cmNlKTtcblxuXHRcdGlmIChtb2RlbC5pc0RpcnR5KCkgfHwgbW9kZWwuaXNEaXNwb3NlZCgpIHx8ICF0aGlzLmhhcyhtb2RlbC5yZXNvdXJjZSkpIHtcblx0XHRcdHJldHVybjsgLy8gdGhlIG1vZGVsIHBvc3NpYmx5IGdvdCBkaXJ0eSBvciBkaXNwb3NlZCwgc28gcmV0dXJuIGVhcmx5IHRoZW5cblx0XHR9XG5cblx0XHQvLyBUcmlnZ2VyIHJlbG9hZFxuXHRcdGF3YWl0IHRoaXMuZG9SZXNvbHZlKG1vZGVsLCB7IHJlbG9hZDogeyBhc3luYzogZmFsc2UgfSB9KTtcblx0fVxuXG5cdGFzeW5jIHJlc29sdmUocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElUZXh0RmlsZUVkaXRvck1vZGVsUmVzb2x2ZU9yQ3JlYXRlT3B0aW9ucyk6IFByb21pc2U8VGV4dEZpbGVFZGl0b3JNb2RlbD4ge1xuXG5cdFx0Ly8gQXdhaXQgYSBwZW5kaW5nIG1vZGVsIHJlc29sdmUgZmlyc3QgYmVmb3JlIHByb2NlZWRpbmdcblx0XHQvLyB0byBlbnN1cmUgdGhhdCB3ZSBuZXZlciByZXNvbHZlIGEgbW9kZWwgbW9yZSB0aGFuIG9uY2Vcblx0XHQvLyBpbiBwYXJhbGxlbC5cblx0XHRjb25zdCBwZW5kaW5nUmVzb2x2ZSA9IHRoaXMuam9pblBlbmRpbmdSZXNvbHZlcyhyZXNvdXJjZSk7XG5cdFx0aWYgKHBlbmRpbmdSZXNvbHZlKSB7XG5cdFx0XHRhd2FpdCBwZW5kaW5nUmVzb2x2ZTtcblx0XHR9XG5cblx0XHQvLyBUcmlnZ2VyIHJlc29sdmVcblx0XHRyZXR1cm4gdGhpcy5kb1Jlc29sdmUocmVzb3VyY2UsIG9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1Jlc29sdmUocmVzb3VyY2VPck1vZGVsOiBVUkkgfCBUZXh0RmlsZUVkaXRvck1vZGVsLCBvcHRpb25zPzogSVRleHRGaWxlRWRpdG9yTW9kZWxSZXNvbHZlT3JDcmVhdGVPcHRpb25zKTogUHJvbWlzZTxUZXh0RmlsZUVkaXRvck1vZGVsPiB7XG5cdFx0bGV0IG1vZGVsOiBUZXh0RmlsZUVkaXRvck1vZGVsIHwgdW5kZWZpbmVkO1xuXHRcdGxldCByZXNvdXJjZTogVVJJO1xuXHRcdGlmIChVUkkuaXNVcmkocmVzb3VyY2VPck1vZGVsKSkge1xuXHRcdFx0cmVzb3VyY2UgPSByZXNvdXJjZU9yTW9kZWw7XG5cdFx0XHRtb2RlbCA9IHRoaXMuZ2V0KHJlc291cmNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzb3VyY2UgPSByZXNvdXJjZU9yTW9kZWwucmVzb3VyY2U7XG5cdFx0XHRtb2RlbCA9IHJlc291cmNlT3JNb2RlbDtcblx0XHR9XG5cblx0XHRsZXQgbW9kZWxSZXNvbHZlOiBQcm9taXNlPHZvaWQ+O1xuXHRcdGxldCBkaWRDcmVhdGVNb2RlbCA9IGZhbHNlO1xuXG5cdFx0Ly8gTW9kZWwgZXhpc3RzXG5cdFx0aWYgKG1vZGVsKSB7XG5cblx0XHRcdC8vIEFsd2F5cyByZWxvYWQgaWYgY29udGVudHMgYXJlIHByb3ZpZGVkXG5cdFx0XHRpZiAob3B0aW9ucz8uY29udGVudHMpIHtcblx0XHRcdFx0bW9kZWxSZXNvbHZlID0gbW9kZWwucmVzb2x2ZShvcHRpb25zKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVsb2FkIGFzeW5jIG9yIHN5bmMgYmFzZWQgb24gb3B0aW9uc1xuXHRcdFx0ZWxzZSBpZiAob3B0aW9ucz8ucmVsb2FkKSB7XG5cblx0XHRcdFx0Ly8gYXN5bmMgcmVsb2FkOiB0cmlnZ2VyIGEgcmVsb2FkIGJ1dCByZXR1cm4gaW1tZWRpYXRlbHlcblx0XHRcdFx0aWYgKG9wdGlvbnMucmVsb2FkLmFzeW5jKSB7XG5cdFx0XHRcdFx0bW9kZWxSZXNvbHZlID0gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0XHRcdFx0KGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IG1vZGVsLnJlc29sdmUob3B0aW9ucyk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0XHRpZiAoIW1vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0XHRcdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycm9yKTsgLy8gb25seSBsb2cgaWYgdGhlIG1vZGVsIGlzIHN0aWxsIGFyb3VuZFxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSkoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIHN5bmMgcmVsb2FkOiBkbyBub3QgcmV0dXJuIHVudGlsIG1vZGVsIHJlbG9hZGVkXG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdG1vZGVsUmVzb2x2ZSA9IG1vZGVsLnJlc29sdmUob3B0aW9ucyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gRG8gbm90IHJlbG9hZFxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdG1vZGVsUmVzb2x2ZSA9IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIE1vZGVsIGRvZXMgbm90IGV4aXN0XG5cdFx0ZWxzZSB7XG5cdFx0XHRkaWRDcmVhdGVNb2RlbCA9IHRydWU7XG5cblx0XHRcdGNvbnN0IG5ld01vZGVsID0gbW9kZWwgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHJlc291cmNlLCBvcHRpb25zID8gb3B0aW9ucy5lbmNvZGluZyA6IHVuZGVmaW5lZCwgb3B0aW9ucyA/IG9wdGlvbnMubGFuZ3VhZ2VJZCA6IHVuZGVmaW5lZCk7XG5cdFx0XHRtb2RlbFJlc29sdmUgPSBtb2RlbC5yZXNvbHZlKG9wdGlvbnMpO1xuXG5cdFx0XHR0aGlzLnJlZ2lzdGVyTW9kZWwobmV3TW9kZWwpO1xuXHRcdH1cblxuXHRcdC8vIFN0b3JlIHBlbmRpbmcgcmVzb2x2ZXMgdG8gYXZvaWQgcmFjZSBjb25kaXRpb25zXG5cdFx0dGhpcy5tYXBSZXNvdXJjZVRvUGVuZGluZ01vZGVsUmVzb2x2ZXJzLnNldChyZXNvdXJjZSwgbW9kZWxSZXNvbHZlKTtcblxuXHRcdC8vIE1ha2Uga25vd24gdG8gbWFuYWdlciAoaWYgbm90IGFscmVhZHkga25vd24pXG5cdFx0dGhpcy5hZGQocmVzb3VyY2UsIG1vZGVsKTtcblxuXHRcdC8vIEVtaXQgc29tZSBldmVudHMgaWYgd2UgY3JlYXRlZCB0aGUgbW9kZWxcblx0XHRpZiAoZGlkQ3JlYXRlTW9kZWwpIHtcblx0XHRcdHRoaXMuX29uRGlkQ3JlYXRlLmZpcmUobW9kZWwpO1xuXG5cdFx0XHQvLyBJZiB0aGUgbW9kZWwgaXMgZGlydHkgcmlnaHQgZnJvbSB0aGUgYmVnaW5uaW5nLFxuXHRcdFx0Ly8gbWFrZSBzdXJlIHRvIGVtaXQgdGhpcyBhcyBhbiBldmVudFxuXHRcdFx0aWYgKG1vZGVsLmlzRGlydHkoKSkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZURpcnR5LmZpcmUobW9kZWwpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBtb2RlbFJlc29sdmU7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0Ly8gQXV0b21hdGljYWxseSBkaXNwb3NlIHRoZSBtb2RlbCBpZiB3ZSBjcmVhdGVkIGl0XG5cdFx0XHQvLyBiZWNhdXNlIHdlIGNhbm5vdCBkaXNwb3NlIGEgbW9kZWwgd2UgZG8gbm90IG93blxuXHRcdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzODg1MFxuXHRcdFx0aWYgKGRpZENyZWF0ZU1vZGVsKSB7XG5cdFx0XHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdH1cblxuXHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0fSBmaW5hbGx5IHtcblxuXHRcdFx0Ly8gUmVtb3ZlIGZyb20gcGVuZGluZyByZXNvbHZlc1xuXHRcdFx0dGhpcy5tYXBSZXNvdXJjZVRvUGVuZGluZ01vZGVsUmVzb2x2ZXJzLmRlbGV0ZShyZXNvdXJjZSk7XG5cdFx0fVxuXG5cdFx0Ly8gQXBwbHkgbGFuZ3VhZ2UgaWYgcHJvdmlkZWRcblx0XHRpZiAob3B0aW9ucz8ubGFuZ3VhZ2VJZCkge1xuXHRcdFx0bW9kZWwuc2V0TGFuZ3VhZ2VJZChvcHRpb25zLmxhbmd1YWdlSWQpO1xuXHRcdH1cblxuXHRcdC8vIE1vZGVsIGNhbiBiZSBkaXJ0eSBpZiBhIGJhY2t1cCB3YXMgcmVzdG9yZWQsIHNvIHdlIG1ha2Ugc3VyZSB0b1xuXHRcdC8vIGhhdmUgdGhpcyBldmVudCBkZWxpdmVyZWQgaWYgd2UgY3JlYXRlZCB0aGUgbW9kZWwgaGVyZVxuXHRcdGlmIChkaWRDcmVhdGVNb2RlbCAmJiBtb2RlbC5pc0RpcnR5KCkpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGlydHkuZmlyZShtb2RlbCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG1vZGVsO1xuXHR9XG5cblx0cHJpdmF0ZSBqb2luUGVuZGluZ1Jlc29sdmVzKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBwZW5kaW5nTW9kZWxSZXNvbHZlID0gdGhpcy5tYXBSZXNvdXJjZVRvUGVuZGluZ01vZGVsUmVzb2x2ZXJzLmdldChyZXNvdXJjZSk7XG5cdFx0aWYgKCFwZW5kaW5nTW9kZWxSZXNvbHZlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZG9Kb2luUGVuZGluZ1Jlc29sdmVzKHJlc291cmNlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9Kb2luUGVuZGluZ1Jlc29sdmVzKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIFdoaWxlIHdlIGhhdmUgcGVuZGluZyBtb2RlbCByZXNvbHZlcywgZW5zdXJlXG5cdFx0Ly8gdG8gYXdhaXQgdGhlIGxhc3Qgb25lIGZpbmlzaGluZyBiZWZvcmUgcmV0dXJuaW5nLlxuXHRcdC8vIFRoaXMgcHJldmVudHMgYSByYWNlIHdoZW4gbXVsdGlwbGUgY2xpZW50cyBhd2FpdFxuXHRcdC8vIHRoZSBwZW5kaW5nIHJlc29sdmUgYW5kIHRoZW4gYWxsIHRyaWdnZXIgdGhlIHJlc29sdmVcblx0XHQvLyBhdCB0aGUgc2FtZSB0aW1lLlxuXHRcdGxldCBjdXJyZW50TW9kZWxDb3B5UmVzb2x2ZTogUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZDtcblx0XHR3aGlsZSAodGhpcy5tYXBSZXNvdXJjZVRvUGVuZGluZ01vZGVsUmVzb2x2ZXJzLmhhcyhyZXNvdXJjZSkpIHtcblx0XHRcdGNvbnN0IG5leHRQZW5kaW5nTW9kZWxSZXNvbHZlID0gdGhpcy5tYXBSZXNvdXJjZVRvUGVuZGluZ01vZGVsUmVzb2x2ZXJzLmdldChyZXNvdXJjZSk7XG5cdFx0XHRpZiAobmV4dFBlbmRpbmdNb2RlbFJlc29sdmUgPT09IGN1cnJlbnRNb2RlbENvcHlSZXNvbHZlKSB7XG5cdFx0XHRcdHJldHVybjsgLy8gYWxyZWFkeSBhd2FpdGVkIG9uIC0gcmV0dXJuXG5cdFx0XHR9XG5cblx0XHRcdGN1cnJlbnRNb2RlbENvcHlSZXNvbHZlID0gbmV4dFBlbmRpbmdNb2RlbFJlc29sdmU7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBuZXh0UGVuZGluZ01vZGVsUmVzb2x2ZTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdC8vIGlnbm9yZSBhbnkgZXJyb3IgaGVyZSwgaXQgd2lsbCBidWJibGUgdG8gdGhlIG9yaWdpbmFsIHJlcXVlc3RvclxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJNb2RlbChtb2RlbDogVGV4dEZpbGVFZGl0b3JNb2RlbCk6IHZvaWQge1xuXG5cdFx0Ly8gSW5zdGFsbCBtb2RlbCBsaXN0ZW5lcnNcblx0XHRjb25zdCBtb2RlbExpc3RlbmVycyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRtb2RlbExpc3RlbmVycy5hZGQobW9kZWwub25EaWRSZXNvbHZlKHJlYXNvbiA9PiB0aGlzLl9vbkRpZFJlc29sdmUuZmlyZSh7IG1vZGVsLCByZWFzb24gfSkpKTtcblx0XHRtb2RlbExpc3RlbmVycy5hZGQobW9kZWwub25EaWRDaGFuZ2VEaXJ0eSgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZURpcnR5LmZpcmUobW9kZWwpKSk7XG5cdFx0bW9kZWxMaXN0ZW5lcnMuYWRkKG1vZGVsLm9uRGlkQ2hhbmdlUmVhZG9ubHkoKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VSZWFkb25seS5maXJlKG1vZGVsKSkpO1xuXHRcdG1vZGVsTGlzdGVuZXJzLmFkZChtb2RlbC5vbkRpZENoYW5nZU9ycGhhbmVkKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlT3JwaGFuZWQuZmlyZShtb2RlbCkpKTtcblx0XHRtb2RlbExpc3RlbmVycy5hZGQobW9kZWwub25EaWRTYXZlRXJyb3IoKCkgPT4gdGhpcy5fb25EaWRTYXZlRXJyb3IuZmlyZShtb2RlbCkpKTtcblx0XHRtb2RlbExpc3RlbmVycy5hZGQobW9kZWwub25EaWRTYXZlKGUgPT4gdGhpcy5fb25EaWRTYXZlLmZpcmUoeyBtb2RlbCwgLi4uZSB9KSkpO1xuXHRcdG1vZGVsTGlzdGVuZXJzLmFkZChtb2RlbC5vbkRpZFJldmVydCgoKSA9PiB0aGlzLl9vbkRpZFJldmVydC5maXJlKG1vZGVsKSkpO1xuXHRcdG1vZGVsTGlzdGVuZXJzLmFkZChtb2RlbC5vbkRpZENoYW5nZUVuY29kaW5nKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlRW5jb2RpbmcuZmlyZShtb2RlbCkpKTtcblxuXHRcdC8vIEtlZXAgZm9yIGRpc3Bvc2FsXG5cdFx0dGhpcy5tYXBSZXNvdXJjZVRvTW9kZWxMaXN0ZW5lcnMuc2V0KG1vZGVsLnJlc291cmNlLCBtb2RlbExpc3RlbmVycyk7XG5cdH1cblxuXHRhZGQocmVzb3VyY2U6IFVSSSwgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwpOiB2b2lkIHtcblx0XHRjb25zdCBrbm93bk1vZGVsID0gdGhpcy5tYXBSZXNvdXJjZVRvTW9kZWwuZ2V0KHJlc291cmNlKTtcblx0XHRpZiAoa25vd25Nb2RlbCA9PT0gbW9kZWwpIHtcblx0XHRcdHJldHVybjsgLy8gYWxyZWFkeSBjYWNoZWRcblx0XHR9XG5cblx0XHQvLyBkaXNwb3NlIGFueSBwcmV2aW91c2x5IHN0b3JlZCBkaXNwb3NlIGxpc3RlbmVyIGZvciB0aGlzIHJlc291cmNlXG5cdFx0Y29uc3QgZGlzcG9zZUxpc3RlbmVyID0gdGhpcy5tYXBSZXNvdXJjZVRvRGlzcG9zZUxpc3RlbmVyLmdldChyZXNvdXJjZSk7XG5cdFx0ZGlzcG9zZUxpc3RlbmVyPy5kaXNwb3NlKCk7XG5cblx0XHQvLyBzdG9yZSBpbiBjYWNoZSBidXQgcmVtb3ZlIHdoZW4gbW9kZWwgZ2V0cyBkaXNwb3NlZFxuXHRcdHRoaXMubWFwUmVzb3VyY2VUb01vZGVsLnNldChyZXNvdXJjZSwgbW9kZWwpO1xuXHRcdHRoaXMubWFwUmVzb3VyY2VUb0Rpc3Bvc2VMaXN0ZW5lci5zZXQocmVzb3VyY2UsIG1vZGVsLm9uV2lsbERpc3Bvc2UoKCkgPT4gdGhpcy5yZW1vdmUocmVzb3VyY2UpKSk7XG5cdH1cblxuXHRyZW1vdmUocmVzb3VyY2U6IFVSSSk6IHZvaWQge1xuXHRcdGNvbnN0IHJlbW92ZWQgPSB0aGlzLm1hcFJlc291cmNlVG9Nb2RlbC5kZWxldGUocmVzb3VyY2UpO1xuXG5cdFx0Y29uc3QgZGlzcG9zZUxpc3RlbmVyID0gdGhpcy5tYXBSZXNvdXJjZVRvRGlzcG9zZUxpc3RlbmVyLmdldChyZXNvdXJjZSk7XG5cdFx0aWYgKGRpc3Bvc2VMaXN0ZW5lcikge1xuXHRcdFx0ZGlzcG9zZShkaXNwb3NlTGlzdGVuZXIpO1xuXHRcdFx0dGhpcy5tYXBSZXNvdXJjZVRvRGlzcG9zZUxpc3RlbmVyLmRlbGV0ZShyZXNvdXJjZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWxMaXN0ZW5lciA9IHRoaXMubWFwUmVzb3VyY2VUb01vZGVsTGlzdGVuZXJzLmdldChyZXNvdXJjZSk7XG5cdFx0aWYgKG1vZGVsTGlzdGVuZXIpIHtcblx0XHRcdGRpc3Bvc2UobW9kZWxMaXN0ZW5lcik7XG5cdFx0XHR0aGlzLm1hcFJlc291cmNlVG9Nb2RlbExpc3RlbmVycy5kZWxldGUocmVzb3VyY2UpO1xuXHRcdH1cblxuXHRcdGlmIChyZW1vdmVkKSB7XG5cdFx0XHR0aGlzLl9vbkRpZFJlbW92ZS5maXJlKHJlc291cmNlKTtcblx0XHR9XG5cdH1cblxuXHQvLyNyZWdpb24gU2F2ZSBwYXJ0aWNpcGFudHNcblxuXHRwcml2YXRlIHJlYWRvbmx5IHNhdmVQYXJ0aWNpcGFudHM6IFRleHRGaWxlU2F2ZVBhcnRpY2lwYW50O1xuXG5cdGFkZFNhdmVQYXJ0aWNpcGFudChwYXJ0aWNpcGFudDogSVRleHRGaWxlU2F2ZVBhcnRpY2lwYW50KTogSURpc3Bvc2FibGUge1xuXHRcdHJldHVybiB0aGlzLnNhdmVQYXJ0aWNpcGFudHMuYWRkU2F2ZVBhcnRpY2lwYW50KHBhcnRpY2lwYW50KTtcblx0fVxuXG5cdHJ1blNhdmVQYXJ0aWNpcGFudHMobW9kZWw6IElUZXh0RmlsZUVkaXRvck1vZGVsLCBjb250ZXh0OiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZVBhcnRpY2lwYW50Q29udGV4dCwgcHJvZ3Jlc3M6IElQcm9ncmVzczxJUHJvZ3Jlc3NTdGVwPiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuc2F2ZVBhcnRpY2lwYW50cy5wYXJ0aWNpcGF0ZShtb2RlbCwgY29udGV4dCwgcHJvZ3Jlc3MsIHRva2VuKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdGNhbkRpc3Bvc2UobW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwpOiB0cnVlIHwgUHJvbWlzZTx0cnVlPiB7XG5cblx0XHQvLyBxdWljayByZXR1cm4gaWYgbW9kZWwgYWxyZWFkeSBkaXNwb3NlZCBvciBub3QgZGlydHkgYW5kIG5vdCByZXNvbHZpbmdcblx0XHRpZiAoXG5cdFx0XHRtb2RlbC5pc0Rpc3Bvc2VkKCkgfHxcblx0XHRcdCghdGhpcy5tYXBSZXNvdXJjZVRvUGVuZGluZ01vZGVsUmVzb2x2ZXJzLmhhcyhtb2RlbC5yZXNvdXJjZSkgJiYgIW1vZGVsLmlzRGlydHkoKSlcblx0XHQpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIHByb21pc2UgYmFzZWQgcmV0dXJuIGluIGFsbCBvdGhlciBjYXNlc1xuXHRcdHJldHVybiB0aGlzLmRvQ2FuRGlzcG9zZShtb2RlbCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvQ2FuRGlzcG9zZShtb2RlbDogVGV4dEZpbGVFZGl0b3JNb2RlbCk6IFByb21pc2U8dHJ1ZT4ge1xuXG5cdFx0Ly8gQXdhaXQgYW55IHBlbmRpbmcgcmVzb2x2ZXMgZmlyc3QgYmVmb3JlIHByb2NlZWRpbmdcblx0XHRjb25zdCBwZW5kaW5nUmVzb2x2ZSA9IHRoaXMuam9pblBlbmRpbmdSZXNvbHZlcyhtb2RlbC5yZXNvdXJjZSk7XG5cdFx0aWYgKHBlbmRpbmdSZXNvbHZlKSB7XG5cdFx0XHRhd2FpdCBwZW5kaW5nUmVzb2x2ZTtcblxuXHRcdFx0cmV0dXJuIHRoaXMuY2FuRGlzcG9zZShtb2RlbCk7XG5cdFx0fVxuXG5cdFx0Ly8gZGlydHkgbW9kZWw6IHdlIGRvIG5vdCBhbGxvdyB0byBkaXNwb3NlIGRpcnR5IG1vZGVscyB0byBwcmV2ZW50XG5cdFx0Ly8gZGF0YSBsb3NzIGNhc2VzLiBkaXJ0eSBtb2RlbHMgY2FuIG9ubHkgYmUgZGlzcG9zZWQgd2hlbiB0aGV5IGFyZVxuXHRcdC8vIGVpdGhlciBzYXZlZCBvciByZXZlcnRlZFxuXHRcdGlmIChtb2RlbC5pc0RpcnR5KCkpIHtcblx0XHRcdGF3YWl0IEV2ZW50LnRvUHJvbWlzZShtb2RlbC5vbkRpZENoYW5nZURpcnR5KTtcblxuXHRcdFx0cmV0dXJuIHRoaXMuY2FuRGlzcG9zZShtb2RlbCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdC8vIG1vZGVsIGNhY2hlc1xuXHRcdHRoaXMubWFwUmVzb3VyY2VUb01vZGVsLmNsZWFyKCk7XG5cdFx0dGhpcy5tYXBSZXNvdXJjZVRvUGVuZGluZ01vZGVsUmVzb2x2ZXJzLmNsZWFyKCk7XG5cblx0XHQvLyBkaXNwb3NlIHRoZSBkaXNwb3NlIGxpc3RlbmVyc1xuXHRcdGRpc3Bvc2UodGhpcy5tYXBSZXNvdXJjZVRvRGlzcG9zZUxpc3RlbmVyLnZhbHVlcygpKTtcblx0XHR0aGlzLm1hcFJlc291cmNlVG9EaXNwb3NlTGlzdGVuZXIuY2xlYXIoKTtcblxuXHRcdC8vIGRpc3Bvc2UgdGhlIG1vZGVsIGNoYW5nZSBsaXN0ZW5lcnNcblx0XHRkaXNwb3NlKHRoaXMubWFwUmVzb3VyY2VUb01vZGVsTGlzdGVuZXJzLnZhbHVlcygpKTtcblx0XHR0aGlzLm1hcFJlc291cmNlVG9Nb2RlbExpc3RlbmVycy5jbGVhcigpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsT0FBTyxlQUFlO0FBQy9CLFNBQVMsV0FBVztBQUNwQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLFNBQXNCLFlBQVksdUJBQXVCO0FBRWxFLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsY0FBZ0MsZUFBZSxzQkFBd0c7QUFDaEssU0FBUyxVQUFVLHFCQUFxQjtBQUN4QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLCtCQUErQjtBQUV4QyxTQUFTLDRCQUE0QjtBQUNyQyxTQUF1RCwrQkFBcUQ7QUFFNUcsU0FBUyxTQUFTLGdCQUFnQjtBQUNsQyxTQUFTLDJDQUEyQztBQUNwRCxTQUFTLHFCQUFxQiw2QkFBNkI7QUFDM0QsU0FBUywyQkFBMkI7QUFjN0IsSUFBTSw2QkFBTixjQUF5QyxXQUFrRDtBQUFBLEVBcURqRyxZQUN5QyxzQkFDVCxhQUNRLHFCQUNHLHdCQUNKLG9CQUNyQztBQUNELFVBQU07QUFOa0M7QUFDVDtBQUNRO0FBQ0c7QUFDSjtBQXhEdkMsU0FBaUIsZUFBZSxLQUFLLFVB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
