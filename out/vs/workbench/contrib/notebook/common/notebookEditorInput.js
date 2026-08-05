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
import * as glob from "../../../../base/common/glob.js";
import { EditorInputCapabilities, Verbosity, isResourceEditorInput } from "../../../common/editor.js";
import { INotebookService, SimpleNotebookProviderInfo } from "./notebookService.js";
import { isEqual, joinPath } from "../../../../base/common/resources.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { INotebookEditorModelResolverService } from "./notebookEditorModelResolverService.js";
import { CellEditType, CellUri } from "./notebookCommon.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { Schemas } from "../../../../base/common/network.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { AbstractResourceEditorInput } from "../../../common/editor/resourceEditorInput.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { IFilesConfigurationService } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { localize } from "../../../../nls.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { ICustomEditorLabelService } from "../../../services/editor/common/customEditorLabelService.js";
let NotebookEditorInput = class extends AbstractResourceEditorInput {
  constructor(resource, preferredResource, viewType, options, _notebookService, _notebookModelResolverService, _fileDialogService, labelService, fileService, filesConfigurationService, extensionService, editorService, textResourceConfigurationService, customEditorLabelService) {
    super(resource, preferredResource, labelService, fileService, filesConfigurationService, textResourceConfigurationService, customEditorLabelService);
    this.viewType = viewType;
    this.options = options;
    this._notebookService = _notebookService;
    this._notebookModelResolverService = _notebookModelResolverService;
    this._fileDialogService = _fileDialogService;
    this.editorModelReference = null;
    this._defaultDirtyState = false;
    this._defaultDirtyState = !!options.startDirty;
    this._sideLoadedListener = _notebookService.onDidAddNotebookDocument((e) => {
      if (e.viewType === this.viewType && e.uri.toString() === this.resource.toString()) {
        this.resolve().catch(onUnexpectedError);
      }
    });
    this._register(extensionService.onWillStop((e) => {
      if (!e.auto && !this.isDirty()) {
        return;
      }
      const reason = e.auto ? localize("vetoAutoExtHostRestart", "An extension provided notebook for '{0}' is still open that would close otherwise.", this.getName()) : localize("vetoExtHostRestart", "An extension provided notebook for '{0}' could not be saved.", this.getName());
      e.veto((async () => {
        const editors = editorService.findEditors(this);
        if (e.auto) {
          return true;
        }
        if (editors.length > 0) {
          const result = await editorService.save(editors[0]);
          if (result.success) {
            return false;
          }
        }
        return true;
      })(), reason);
    }));
  }
  static getOrCreate(instantiationService, resource, preferredResource, viewType, options = {}) {
    const editor = instantiationService.createInstance(NotebookEditorInput, resource, preferredResource, viewType, options);
    if (preferredResource) {
      editor.setPreferredResource(preferredResource);
    }
    return editor;
  }
  dispose() {
    this._sideLoadedListener.dispose();
    this.editorModelReference?.dispose();
    this.editorModelReference = null;
    super.dispose();
  }
  get typeId() {
    return NotebookEditorInput.ID;
  }
  get editorId() {
    return this.viewType;
  }
  get capabilities() {
    let capabilities = EditorInputCapabilities.None;
    if (this.resource.scheme === Schemas.untitled) {
      capabilities |= EditorInputCapabilities.Untitled;
    }
    if (this.editorModelReference) {
      if (this.editorModelReference.object.isReadonly()) {
        capabilities |= EditorInputCapabilities.Readonly;
      }
    } else {
      if (this.filesConfigurationService.isReadonly(this.resource)) {
        capabilities |= EditorInputCapabilities.Readonly;
      }
    }
    if (!(capabilities & EditorInputCapabilities.Readonly)) {
      capabilities |= EditorInputCapabilities.CanDropIntoEditor;
    }
    return capabilities;
  }
  getDescription(verbosity = Verbosity.MEDIUM) {
    if (!this.hasCapability(EditorInputCapabilities.Untitled) || this.editorModelReference?.object.hasAssociatedFilePath()) {
      return super.getDescription(verbosity);
    }
    return void 0;
  }
  isReadonly() {
    if (!this.editorModelReference) {
      return this.filesConfigurationService.isReadonly(this.resource);
    }
    return this.editorModelReference.object.isReadonly();
  }
  isDirty() {
    if (!this.editorModelReference) {
      return this._defaultDirtyState;
    }
    return this.editorModelReference.object.isDirty();
  }
  isSaving() {
    const model = this.editorModelReference?.object;
    if (!model || !model.isDirty() || model.hasErrorState || this.hasCapability(EditorInputCapabilities.Untitled)) {
      return false;
    }
    return this.filesConfigurationService.hasShortAutoSaveDelay(this);
  }
  async save(group, options) {
    if (this.editorModelReference) {
      if (this.hasCapability(EditorInputCapabilities.Untitled)) {
        return this.saveAs(group, options);
      } else {
        await this.editorModelReference.object.save(options);
      }
      return this;
    }
    return void 0;
  }
  async saveAs(group, options) {
    if (!this.editorModelReference) {
      return void 0;
    }
    const provider = this._notebookService.getContributedNotebookType(this.viewType);
    if (!provider) {
      return void 0;
    }
    const pathCandidate = this.hasCapability(EditorInputCapabilities.Untitled) ? await this._suggestName(provider, this.labelService.getUriBasenameLabel(this.resource)) : this.editorModelReference.object.resource;
    let target;
    if (this.editorModelReference.object.hasAssociatedFilePath()) {
      target = pathCandidate;
    } else {
      target = await this._fileDialogService.pickFileToSave(pathCandidate, options?.availableFileSystems);
      if (!target) {
        return void 0;
      }
    }
    if (!provider.matches(target)) {
      const patterns = provider.selectors.map((pattern) => {
        if (typeof pattern === "string") {
          return pattern;
        }
        if (glob.isRelativePattern(pattern)) {
          return `${pattern} (base ${pattern.base})`;
        }
        if (pattern.exclude) {
          return `${pattern.include} (exclude: ${pattern.exclude})`;
        } else {
          return `${pattern.include}`;
        }
      }).join(", ");
      throw new Error(`File name ${target} is not supported by ${provider.providerDisplayName}.

Please make sure the file name matches following patterns:
${patterns}`);
    }
    return await this.editorModelReference.object.saveAs(target);
  }
  async _suggestName(provider, suggestedFilename) {
    const firstSelector = provider.selectors[0];
    let selectorStr = firstSelector && typeof firstSelector === "string" ? firstSelector : void 0;
    if (!selectorStr && firstSelector) {
      const include = firstSelector.include;
      if (typeof include === "string") {
        selectorStr = include;
      }
    }
    if (selectorStr) {
      const matches = /^\*\.([A-Za-z_-]*)$/.exec(selectorStr);
      if (matches && matches.length > 1) {
        const fileExt = matches[1];
        if (!suggestedFilename.endsWith(fileExt)) {
          return joinPath(await this._fileDialogService.defaultFilePath(), suggestedFilename + "." + fileExt);
        }
      }
    }
    return joinPath(await this._fileDialogService.defaultFilePath(), suggestedFilename);
  }
  // called when users rename a notebook document
  async rename(group, target) {
    if (this.editorModelReference) {
      return { editor: { resource: target }, options: { override: this.viewType } };
    }
    return void 0;
  }
  async revert(_group, options) {
    if (this.editorModelReference && this.editorModelReference.object.isDirty()) {
      await this.editorModelReference.object.revert(options);
    }
  }
  async resolve(_options, perf) {
    if (!await this._notebookService.canResolve(this.viewType)) {
      return null;
    }
    perf?.mark("extensionActivated");
    this._sideLoadedListener.dispose();
    if (!this.editorModelReference) {
      const scratchpad = this.capabilities & EditorInputCapabilities.Scratchpad ? true : false;
      const ref = await this._notebookModelResolverService.resolve(this.resource, this.viewType, { limits: this.ensureLimits(_options), scratchpad, viewType: this.editorId });
      if (this.editorModelReference) {
        ref.dispose();
        return this.editorModelReference.object;
      }
      this.editorModelReference = ref;
      if (this.isDisposed()) {
        this.editorModelReference.dispose();
        this.editorModelReference = null;
        return null;
      }
      this._register(this.editorModelReference.object.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
      this._register(this.editorModelReference.object.onDidChangeReadonly(() => this._onDidChangeCapabilities.fire()));
      this._register(this.editorModelReference.object.onDidRevertUntitled(() => this.dispose()));
      if (this.editorModelReference.object.isDirty()) {
        this._onDidChangeDirty.fire();
      }
    } else {
      this.editorModelReference.object.load({ limits: this.ensureLimits(_options) });
    }
    if (this.options._backupId) {
      const info = await this._notebookService.withNotebookDataProvider(this.editorModelReference.object.notebook.viewType);
      if (!(info instanceof SimpleNotebookProviderInfo)) {
        throw new Error("CANNOT open file notebook with this provider");
      }
      const data = await info.serializer.dataToNotebook(VSBuffer.fromString(JSON.stringify({ __webview_backup: this.options._backupId })));
      this.editorModelReference.object.notebook.applyEdits([
        {
          editType: CellEditType.Replace,
          index: 0,
          count: this.editorModelReference.object.notebook.length,
          cells: data.cells
        }
      ], true, void 0, () => void 0, void 0, false);
      if (this.options._workingCopy) {
        this.options._backupId = void 0;
        this.options._workingCopy = void 0;
        this.options.startDirty = void 0;
      }
    }
    return this.editorModelReference.object;
  }
  toUntyped() {
    return {
      resource: this.resource,
      options: {
        override: this.viewType
      }
    };
  }
  matches(otherInput) {
    if (super.matches(otherInput)) {
      return true;
    }
    if (otherInput instanceof NotebookEditorInput) {
      return this.viewType === otherInput.viewType && isEqual(this.resource, otherInput.resource);
    }
    if (isResourceEditorInput(otherInput) && otherInput.resource.scheme === CellUri.scheme) {
      return isEqual(this.resource, CellUri.parse(otherInput.resource)?.notebook);
    }
    return false;
  }
};
NotebookEditorInput.ID = "workbench.input.notebook";
NotebookEditorInput = __decorateClass([
  __decorateParam(4, INotebookService),
  __decorateParam(5, INotebookEditorModelResolverService),
  __decorateParam(6, IFileDialogService),
  __decorateParam(7, ILabelService),
  __decorateParam(8, IFileService),
  __decorateParam(9, IFilesConfigurationService),
  __decorateParam(10, IExtensionService),
  __decorateParam(11, IEditorService),
  __decorateParam(12, ITextResourceConfigurationService),
  __decorateParam(13, ICustomEditorLabelService)
], NotebookEditorInput);
function isCompositeNotebookEditorInput(thing) {
  return !!thing && typeof thing === "object" && Array.isArray(thing.editorInputs) && thing.editorInputs.every((input) => input instanceof NotebookEditorInput);
}
function isNotebookEditorInput(thing) {
  return !!thing && typeof thing === "object" && thing.typeId === NotebookEditorInput.ID;
}
export {
  NotebookEditorInput,
  isCompositeNotebookEditorInput,
  isNotebookEditorInput
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tFZGl0b3JJbnB1dC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZ2xvYi5qcyc7XG5pbXBvcnQgeyBHcm91cElkZW50aWZpZXIsIElTYXZlT3B0aW9ucywgSU1vdmVSZXN1bHQsIElSZXZlcnRPcHRpb25zLCBFZGl0b3JJbnB1dENhcGFiaWxpdGllcywgVmVyYm9zaXR5LCBJVW50eXBlZEVkaXRvcklucHV0LCBJRmlsZUxpbWl0ZWRFZGl0b3JJbnB1dE9wdGlvbnMsIGlzUmVzb3VyY2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElOb3RlYm9va1NlcnZpY2UsIFNpbXBsZU5vdGVib29rUHJvdmlkZXJJbmZvIH0gZnJvbSAnLi9ub3RlYm9va1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGlzRXF1YWwsIGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUZpbGVEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFZGl0b3JNb2RlbFJlc29sdmVyU2VydmljZSB9IGZyb20gJy4vbm90ZWJvb2tFZGl0b3JNb2RlbFJlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgSVJlZmVyZW5jZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdFR5cGUsIENlbGxVcmksIElSZXNvbHZlZE5vdGVib29rRWRpdG9yTW9kZWwgfSBmcm9tICcuL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEFic3RyYWN0UmVzb3VyY2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvcmVzb3VyY2VFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJUmVzb3VyY2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUlkZW50aWZpZXIgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tQcm92aWRlckluZm8gfSBmcm9tICcuL25vdGVib29rUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tQZXJmTWFya3MgfSBmcm9tICcuL25vdGVib29rUGVyZm9ybWFuY2UuanMnO1xuaW1wb3J0IHsgSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9maWxlc0NvbmZpZ3VyYXRpb24vY29tbW9uL2ZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvdGV4dFJlc291cmNlQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9jdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVib29rRWRpdG9ySW5wdXRPcHRpb25zIHtcblx0c3RhcnREaXJ0eT86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBiYWNrdXBJZCBmb3Igd2Vidmlld1xuXHQgKi9cblx0X2JhY2t1cElkPzogc3RyaW5nO1xuXHRfd29ya2luZ0NvcHk/OiBJV29ya2luZ0NvcHlJZGVudGlmaWVyO1xufVxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tFZGl0b3JJbnB1dCBleHRlbmRzIEFic3RyYWN0UmVzb3VyY2VFZGl0b3JJbnB1dCB7XG5cblx0c3RhdGljIGdldE9yQ3JlYXRlKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsIHJlc291cmNlOiBVUkksIHByZWZlcnJlZFJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQsIHZpZXdUeXBlOiBzdHJpbmcsIG9wdGlvbnM6IE5vdGVib29rRWRpdG9ySW5wdXRPcHRpb25zID0ge30pIHtcblx0XHRjb25zdCBlZGl0b3IgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va0VkaXRvcklucHV0LCByZXNvdXJjZSwgcHJlZmVycmVkUmVzb3VyY2UsIHZpZXdUeXBlLCBvcHRpb25zKTtcblx0XHRpZiAocHJlZmVycmVkUmVzb3VyY2UpIHtcblx0XHRcdGVkaXRvci5zZXRQcmVmZXJyZWRSZXNvdXJjZShwcmVmZXJyZWRSZXNvdXJjZSk7XG5cdFx0fVxuXHRcdHJldHVybiBlZGl0b3I7XG5cdH1cblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQ6IHN0cmluZyA9ICd3b3JrYmVuY2guaW5wdXQubm90ZWJvb2snO1xuXG5cdHByb3RlY3RlZCBlZGl0b3JNb2RlbFJlZmVyZW5jZTogSVJlZmVyZW5jZTxJUmVzb2x2ZWROb3RlYm9va0VkaXRvck1vZGVsPiB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9zaWRlTG9hZGVkTGlzdGVuZXI6IElEaXNwb3NhYmxlO1xuXHRwcml2YXRlIF9kZWZhdWx0RGlydHlTdGF0ZTogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlc291cmNlOiBVUkksXG5cdFx0cHJlZmVycmVkUmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgdmlld1R5cGU6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgb3B0aW9uczogTm90ZWJvb2tFZGl0b3JJbnB1dE9wdGlvbnMsXG5cdFx0QElOb3RlYm9va1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tTZXJ2aWNlOiBJTm90ZWJvb2tTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tFZGl0b3JNb2RlbFJlc29sdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9ub3RlYm9va01vZGVsUmVzb2x2ZXJTZXJ2aWNlOiBJTm90ZWJvb2tFZGl0b3JNb2RlbFJlc29sdmVyU2VydmljZSxcblx0XHRASUZpbGVEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2ZpbGVEaWFsb2dTZXJ2aWNlOiBJRmlsZURpYWxvZ1NlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgZmlsZXNDb25maWd1cmF0aW9uU2VydmljZTogSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElDdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UgY3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlOiBJQ3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKHJlc291cmNlLCBwcmVmZXJyZWRSZXNvdXJjZSwgbGFiZWxTZXJ2aWNlLCBmaWxlU2VydmljZSwgZmlsZXNDb25maWd1cmF0aW9uU2VydmljZSwgdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsIGN1c3RvbUVkaXRvckxhYmVsU2VydmljZSk7XG5cdFx0dGhpcy5fZGVmYXVsdERpcnR5U3RhdGUgPSAhIW9wdGlvbnMuc3RhcnREaXJ0eTtcblxuXHRcdC8vIEF1dG9tYXRpY2FsbHkgcmVzb2x2ZSB0aGlzIGlucHV0IHdoZW4gdGhlIFwid2FudGVkXCIgbW9kZWwgY29tZXMgdG8gbGlmZSB2aWFcblx0XHQvLyBzb21lIG90aGVyIHdheS4gVGhpcyBoYXBwZW5zIG9ubHkgb25jZSBwZXIgaW5wdXQgYW5kIHJlc29sdmUgZGlzcG9zZXNcblx0XHQvLyB0aGlzIGxpc3RlbmVyXG5cdFx0dGhpcy5fc2lkZUxvYWRlZExpc3RlbmVyID0gX25vdGVib29rU2VydmljZS5vbkRpZEFkZE5vdGVib29rRG9jdW1lbnQoZSA9PiB7XG5cdFx0XHRpZiAoZS52aWV3VHlwZSA9PT0gdGhpcy52aWV3VHlwZSAmJiBlLnVyaS50b1N0cmluZygpID09PSB0aGlzLnJlc291cmNlLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0dGhpcy5yZXNvbHZlKCkuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZXh0ZW5zaW9uU2VydmljZS5vbldpbGxTdG9wKGUgPT4ge1xuXHRcdFx0aWYgKCFlLmF1dG8gJiYgIXRoaXMuaXNEaXJ0eSgpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmVhc29uID0gZS5hdXRvXG5cdFx0XHRcdD8gbG9jYWxpemUoJ3ZldG9BdXRvRXh0SG9zdFJlc3RhcnQnLCBcIkFuIGV4dGVuc2lvbiBwcm92aWRlZCBub3RlYm9vayBmb3IgJ3swfScgaXMgc3RpbGwgb3BlbiB0aGF0IHdvdWxkIGNsb3NlIG90aGVyd2lzZS5cIiwgdGhpcy5nZXROYW1lKCkpXG5cdFx0XHRcdDogbG9jYWxpemUoJ3ZldG9FeHRIb3N0UmVzdGFydCcsIFwiQW4gZXh0ZW5zaW9uIHByb3ZpZGVkIG5vdGVib29rIGZvciAnezB9JyBjb3VsZCBub3QgYmUgc2F2ZWQuXCIsIHRoaXMuZ2V0TmFtZSgpKTtcblxuXHRcdFx0ZS52ZXRvKChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvcnMgPSBlZGl0b3JTZXJ2aWNlLmZpbmRFZGl0b3JzKHRoaXMpO1xuXHRcdFx0XHRpZiAoZS5hdXRvKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGVkaXRvcnMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGVkaXRvclNlcnZpY2Uuc2F2ZShlZGl0b3JzWzBdKTtcblx0XHRcdFx0XHRpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTsgLy8gRG9uJ3QgVmV0b1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gVmV0b1xuXHRcdFx0fSkoKSwgcmVhc29uKTtcblx0XHR9KSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHRoaXMuX3NpZGVMb2FkZWRMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5lZGl0b3JNb2RlbFJlZmVyZW5jZT8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuZWRpdG9yTW9kZWxSZWZlcmVuY2UgPSBudWxsO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGdldCB0eXBlSWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gTm90ZWJvb2tFZGl0b3JJbnB1dC5JRDtcblx0fVxuXG5cdG92ZXJyaWRlIGdldCBlZGl0b3JJZCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnZpZXdUeXBlO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0IGNhcGFiaWxpdGllcygpOiBFZGl0b3JJbnB1dENhcGFiaWxpdGllcyB7XG5cdFx0bGV0IGNhcGFiaWxpdGllcyA9IEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLk5vbmU7XG5cblx0XHRpZiAodGhpcy5yZXNvdXJjZS5zY2hlbWUgPT09IFNjaGVtYXMudW50aXRsZWQpIHtcblx0XHRcdGNhcGFiaWxpdGllcyB8PSBFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5VbnRpdGxlZDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5lZGl0b3JNb2RlbFJlZmVyZW5jZSkge1xuXHRcdFx0aWYgKHRoaXMuZWRpdG9yTW9kZWxSZWZlcmVuY2Uub2JqZWN0LmlzUmVhZG9ubHkoKSkge1xuXHRcdFx0XHRjYXBhYmlsaXRpZXMgfD0gRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuUmVhZG9ubHk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0aGlzLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuaXNSZWFkb25seSh0aGlzLnJlc291cmNlKSkge1xuXHRcdFx0XHRjYXBhYmlsaXRpZXMgfD0gRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuUmVhZG9ubHk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCEoY2FwYWJpbGl0aWVzICYgRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuUmVhZG9ubHkpKSB7XG5cdFx0XHRjYXBhYmlsaXRpZXMgfD0gRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuQ2FuRHJvcEludG9FZGl0b3I7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNhcGFiaWxpdGllcztcblx0fVxuXG5cdG92ZXJyaWRlIGdldERlc2NyaXB0aW9uKHZlcmJvc2l0eSA9IFZlcmJvc2l0eS5NRURJVU0pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGhpcy5oYXNDYXBhYmlsaXR5KEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLlVudGl0bGVkKSB8fCB0aGlzLmVkaXRvck1vZGVsUmVmZXJlbmNlPy5vYmplY3QuaGFzQXNzb2NpYXRlZEZpbGVQYXRoKCkpIHtcblx0XHRcdHJldHVybiBzdXBlci5nZXREZXNjcmlwdGlvbih2ZXJib3NpdHkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7IC8vIG5vIGRlc2NyaXB0aW9uIGZvciB1bnRpdGxlZCBub3RlYm9va3Mgd2l0aG91dCBhc3NvY2lhdGVkIGZpbGUgcGF0aFxuXHR9XG5cblx0b3ZlcnJpZGUgaXNSZWFkb25seSgpOiBib29sZWFuIHwgSU1hcmtkb3duU3RyaW5nIHtcblx0XHRpZiAoIXRoaXMuZWRpdG9yTW9kZWxSZWZlcmVuY2UpIHtcblx0XHRcdHJldHVybiB0aGlzLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuaXNSZWFkb25seSh0aGlzLnJlc291cmNlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZWRpdG9yTW9kZWxSZWZlcmVuY2Uub2JqZWN0LmlzUmVhZG9ubHkoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGlzRGlydHkoKSB7XG5cdFx0aWYgKCF0aGlzLmVkaXRvck1vZGVsUmVmZXJlbmNlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZGVmYXVsdERpcnR5U3RhdGU7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmVkaXRvck1vZGVsUmVmZXJlbmNlLm9iamVjdC5pc0RpcnR5KCk7XG5cdH1cblxuXHRvdmVycmlkZSBpc1NhdmluZygpOiBib29sZWFuIHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZWRpdG9yTW9kZWxSZWZlcmVuY2U/Lm9iamVjdDtcblx0XHRpZiAoIW1vZGVsIHx8ICFtb2RlbC5pc0RpcnR5KCkgfHwgbW9kZWwuaGFzRXJyb3JTdGF0ZSB8fCB0aGlzLmhhc0NhcGFiaWxpdHkoRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuVW50aXRsZWQpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIHJlcXVpcmUgdGhlIG1vZGVsIHRvIGJlIGRpcnR5LCBmaWxlLWJhY2tlZCBhbmQgbm90IGluIGFuIGVycm9yIHN0YXRlXG5cdFx0fVxuXG5cdFx0Ly8gaWYgYSBzaG9ydCBhdXRvIHNhdmUgaXMgY29uZmlndXJlZCwgdHJlYXQgdGhpcyBhcyBiZWluZyBzYXZlZFxuXHRcdHJldHVybiB0aGlzLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuaGFzU2hvcnRBdXRvU2F2ZURlbGF5KHRoaXMpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgc2F2ZShncm91cDogR3JvdXBJZGVudGlmaWVyLCBvcHRpb25zPzogSVNhdmVPcHRpb25zKTogUHJvbWlzZTxFZGl0b3JJbnB1dCB8IElVbnR5cGVkRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAodGhpcy5lZGl0b3JNb2RlbFJlZmVyZW5jZSkge1xuXG5cdFx0XHRpZiAodGhpcy5oYXNDYXBhYmlsaXR5KEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLlVudGl0bGVkKSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zYXZlQXMoZ3JvdXAsIG9wdGlvbnMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5lZGl0b3JNb2RlbFJlZmVyZW5jZS5vYmplY3Quc2F2ZShvcHRpb25zKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHNhdmVBcyhncm91cDogR3JvdXBJZGVudGlmaWVyLCBvcHRpb25zPzogSVNhdmVPcHRpb25zKTogUHJvbWlzZTxJVW50eXBlZEVkaXRvcklucHV0IHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLmVkaXRvck1vZGVsUmVmZXJlbmNlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5fbm90ZWJvb2tTZXJ2aWNlLmdldENvbnRyaWJ1dGVkTm90ZWJvb2tUeXBlKHRoaXMudmlld1R5cGUpO1xuXG5cdFx0aWYgKCFwcm92aWRlcikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBwYXRoQ2FuZGlkYXRlID0gdGhpcy5oYXNDYXBhYmlsaXR5KEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLlVudGl0bGVkKSA/IGF3YWl0IHRoaXMuX3N1Z2dlc3ROYW1lKHByb3ZpZGVyLCB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlCYXNlbmFtZUxhYmVsKHRoaXMucmVzb3VyY2UpKSA6IHRoaXMuZWRpdG9yTW9kZWxSZWZlcmVuY2Uub2JqZWN0LnJlc291cmNlO1xuXHRcdGxldCB0YXJnZXQ6IFVSSSB8IHVuZGVmaW5lZDtcblx0XHRpZiAodGhpcy5lZGl0b3JNb2RlbFJlZmVyZW5jZS5vYmplY3QuaGFzQXNzb2NpYXRlZEZpbGVQYXRoKCkpIHtcblx0XHRcdHRhcmdldCA9IHBhdGhDYW5kaWRhdGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRhcmdldCA9IGF3YWl0IHRoaXMuX2ZpbGVEaWFsb2dTZXJ2aWNlLnBpY2tGaWxlVG9TYXZlKHBhdGhDYW5kaWRhdGUsIG9wdGlvbnM/LmF2YWlsYWJsZUZpbGVTeXN0ZW1zKTtcblx0XHRcdGlmICghdGFyZ2V0KSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7IC8vIHNhdmUgY2FuY2VsbGVkXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFwcm92aWRlci5tYXRjaGVzKHRhcmdldCkpIHtcblx0XHRcdGNvbnN0IHBhdHRlcm5zID0gcHJvdmlkZXIuc2VsZWN0b3JzLm1hcChwYXR0ZXJuID0+IHtcblx0XHRcdFx0aWYgKHR5cGVvZiBwYXR0ZXJuID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdHJldHVybiBwYXR0ZXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGdsb2IuaXNSZWxhdGl2ZVBhdHRlcm4ocGF0dGVybikpIHtcblx0XHRcdFx0XHRyZXR1cm4gYCR7cGF0dGVybn0gKGJhc2UgJHtwYXR0ZXJuLmJhc2V9KWA7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAocGF0dGVybi5leGNsdWRlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGAke3BhdHRlcm4uaW5jbHVkZX0gKGV4Y2x1ZGU6ICR7cGF0dGVybi5leGNsdWRlfSlgO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBgJHtwYXR0ZXJuLmluY2x1ZGV9YDtcblx0XHRcdFx0fVxuXG5cdFx0XHR9KS5qb2luKCcsICcpO1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBGaWxlIG5hbWUgJHt0YXJnZXR9IGlzIG5vdCBzdXBwb3J0ZWQgYnkgJHtwcm92aWRlci5wcm92aWRlckRpc3BsYXlOYW1lfS5cXG5cXG5QbGVhc2UgbWFrZSBzdXJlIHRoZSBmaWxlIG5hbWUgbWF0Y2hlcyBmb2xsb3dpbmcgcGF0dGVybnM6XFxuJHtwYXR0ZXJuc31gKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5lZGl0b3JNb2RlbFJlZmVyZW5jZS5vYmplY3Quc2F2ZUFzKHRhcmdldCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9zdWdnZXN0TmFtZShwcm92aWRlcjogTm90ZWJvb2tQcm92aWRlckluZm8sIHN1Z2dlc3RlZEZpbGVuYW1lOiBzdHJpbmcpIHtcblx0XHQvLyBndWVzcyBmaWxlIGV4dGVuc2lvbnNcblx0XHRjb25zdCBmaXJzdFNlbGVjdG9yID0gcHJvdmlkZXIuc2VsZWN0b3JzWzBdO1xuXHRcdGxldCBzZWxlY3RvclN0ciA9IGZpcnN0U2VsZWN0b3IgJiYgdHlwZW9mIGZpcnN0U2VsZWN0b3IgPT09ICdzdHJpbmcnID8gZmlyc3RTZWxlY3RvciA6IHVuZGVmaW5lZDtcblx0XHRpZiAoIXNlbGVjdG9yU3RyICYmIGZpcnN0U2VsZWN0b3IpIHtcblx0XHRcdGNvbnN0IGluY2x1ZGUgPSAoZmlyc3RTZWxlY3RvciBhcyB7IGluY2x1ZGU/OiBzdHJpbmcgfSkuaW5jbHVkZTtcblx0XHRcdGlmICh0eXBlb2YgaW5jbHVkZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0c2VsZWN0b3JTdHIgPSBpbmNsdWRlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChzZWxlY3RvclN0cikge1xuXHRcdFx0Y29uc3QgbWF0Y2hlcyA9IC9eXFwqXFwuKFtBLVphLXpfLV0qKSQvLmV4ZWMoc2VsZWN0b3JTdHIpO1xuXHRcdFx0aWYgKG1hdGNoZXMgJiYgbWF0Y2hlcy5sZW5ndGggPiAxKSB7XG5cdFx0XHRcdGNvbnN0IGZpbGVFeHQgPSBtYXRjaGVzWzFdO1xuXHRcdFx0XHRpZiAoIXN1Z2dlc3RlZEZpbGVuYW1lLmVuZHNXaXRoKGZpbGVFeHQpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGpvaW5QYXRoKGF3YWl0IHRoaXMuX2ZpbGVEaWFsb2dTZXJ2aWNlLmRlZmF1bHRGaWxlUGF0aCgpLCBzdWdnZXN0ZWRGaWxlbmFtZSArICcuJyArIGZpbGVFeHQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGpvaW5QYXRoKGF3YWl0IHRoaXMuX2ZpbGVEaWFsb2dTZXJ2aWNlLmRlZmF1bHRGaWxlUGF0aCgpLCBzdWdnZXN0ZWRGaWxlbmFtZSk7XG5cdH1cblxuXHQvLyBjYWxsZWQgd2hlbiB1c2VycyByZW5hbWUgYSBub3RlYm9vayBkb2N1bWVudFxuXHRvdmVycmlkZSBhc3luYyByZW5hbWUoZ3JvdXA6IEdyb3VwSWRlbnRpZmllciwgdGFyZ2V0OiBVUkkpOiBQcm9taXNlPElNb3ZlUmVzdWx0IHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKHRoaXMuZWRpdG9yTW9kZWxSZWZlcmVuY2UpIHtcblx0XHRcdHJldHVybiB7IGVkaXRvcjogeyByZXNvdXJjZTogdGFyZ2V0IH0sIG9wdGlvbnM6IHsgb3ZlcnJpZGU6IHRoaXMudmlld1R5cGUgfSB9O1xuXG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyByZXZlcnQoX2dyb3VwOiBHcm91cElkZW50aWZpZXIsIG9wdGlvbnM/OiBJUmV2ZXJ0T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmVkaXRvck1vZGVsUmVmZXJlbmNlICYmIHRoaXMuZWRpdG9yTW9kZWxSZWZlcmVuY2Uub2JqZWN0LmlzRGlydHkoKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5lZGl0b3JNb2RlbFJlZmVyZW5jZS5vYmplY3QucmV2ZXJ0KG9wdGlvbnMpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJlc29sdmUoX29wdGlvbnM/OiBJRmlsZUxpbWl0ZWRFZGl0b3JJbnB1dE9wdGlvbnMsIHBlcmY/OiBOb3RlYm9va1BlcmZNYXJrcyk6IFByb21pc2U8SVJlc29sdmVkTm90ZWJvb2tFZGl0b3JNb2RlbCB8IG51bGw+IHtcblx0XHRpZiAoIWF3YWl0IHRoaXMuX25vdGVib29rU2VydmljZS5jYW5SZXNvbHZlKHRoaXMudmlld1R5cGUpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRwZXJmPy5tYXJrKCdleHRlbnNpb25BY3RpdmF0ZWQnKTtcblxuXHRcdC8vIHdlIGFyZSBub3cgbG9hZGluZyB0aGUgbm90ZWJvb2sgYW5kIGRvbid0IG5lZWQgdG8gbGlzdGVuIHRvXG5cdFx0Ly8gXCJvdGhlclwiIGxvYWRpbmcgYW55bW9yZVxuXHRcdHRoaXMuX3NpZGVMb2FkZWRMaXN0ZW5lci5kaXNwb3NlKCk7XG5cblx0XHRpZiAoIXRoaXMuZWRpdG9yTW9kZWxSZWZlcmVuY2UpIHtcblx0XHRcdGNvbnN0IHNjcmF0Y2hwYWQgPSB0aGlzLmNhcGFiaWxpdGllcyAmIEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLlNjcmF0Y2hwYWQgPyB0cnVlIDogZmFsc2U7XG5cdFx0XHRjb25zdCByZWYgPSBhd2FpdCB0aGlzLl9ub3RlYm9va01vZGVsUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmUodGhpcy5yZXNvdXJjZSwgdGhpcy52aWV3VHlwZSwgeyBsaW1pdHM6IHRoaXMuZW5zdXJlTGltaXRzKF9vcHRpb25zKSwgc2NyYXRjaHBhZCwgdmlld1R5cGU6IHRoaXMuZWRpdG9ySWQgfSk7XG5cdFx0XHRpZiAodGhpcy5lZGl0b3JNb2RlbFJlZmVyZW5jZSkge1xuXHRcdFx0XHQvLyBSZS1lbnRyYW50LCBkb3VibGUgcmVzb2x2ZSBoYXBwZW5lZC4gRGlzcG9zZSB0aGUgYWRkaXRpb24gcmVmZXJlbmNlcyBhbmQgcHJvY2VlZFxuXHRcdFx0XHQvLyB3aXRoIHRoZSB0cnV0aC5cblx0XHRcdFx0cmVmLmRpc3Bvc2UoKTtcblx0XHRcdFx0cmV0dXJuICg8SVJlZmVyZW5jZTxJUmVzb2x2ZWROb3RlYm9va0VkaXRvck1vZGVsPj50aGlzLmVkaXRvck1vZGVsUmVmZXJlbmNlKS5vYmplY3Q7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmVkaXRvck1vZGVsUmVmZXJlbmNlID0gcmVmO1xuXHRcdFx0aWYgKHRoaXMuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yTW9kZWxSZWZlcmVuY2UuZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLmVkaXRvck1vZGVsUmVmZXJlbmNlID0gbnVsbDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvck1vZGVsUmVmZXJlbmNlLm9iamVjdC5vbkRpZENoYW5nZURpcnR5KCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlRGlydHkuZmlyZSgpKSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvck1vZGVsUmVmZXJlbmNlLm9iamVjdC5vbkRpZENoYW5nZVJlYWRvbmx5KCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlQ2FwYWJpbGl0aWVzLmZpcmUoKSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3JNb2RlbFJlZmVyZW5jZS5vYmplY3Qub25EaWRSZXZlcnRVbnRpdGxlZCgoKSA9PiB0aGlzLmRpc3Bvc2UoKSkpO1xuXHRcdFx0aWYgKHRoaXMuZWRpdG9yTW9kZWxSZWZlcmVuY2Uub2JqZWN0LmlzRGlydHkoKSkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZURpcnR5LmZpcmUoKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5lZGl0b3JNb2RlbFJlZmVyZW5jZS5vYmplY3QubG9hZCh7IGxpbWl0czogdGhpcy5lbnN1cmVMaW1pdHMoX29wdGlvbnMpIH0pO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLm9wdGlvbnMuX2JhY2t1cElkKSB7XG5cdFx0XHRjb25zdCBpbmZvID0gYXdhaXQgdGhpcy5fbm90ZWJvb2tTZXJ2aWNlLndpdGhOb3RlYm9va0RhdGFQcm92aWRlcih0aGlzLmVkaXRvck1vZGVsUmVmZXJlbmNlLm9iamVjdC5ub3RlYm9vay52aWV3VHlwZSk7XG5cdFx0XHRpZiAoIShpbmZvIGluc3RhbmNlb2YgU2ltcGxlTm90ZWJvb2tQcm92aWRlckluZm8pKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignQ0FOTk9UIG9wZW4gZmlsZSBub3RlYm9vayB3aXRoIHRoaXMgcHJvdmlkZXInKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IGluZm8uc2VyaWFsaXplci5kYXRhVG9Ob3RlYm9vayhWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KHsgX193ZWJ2aWV3X2JhY2t1cDogdGhpcy5vcHRpb25zLl9iYWNrdXBJZCB9KSkpO1xuXHRcdFx0dGhpcy5lZGl0b3JNb2RlbFJlZmVyZW5jZS5vYmplY3Qubm90ZWJvb2suYXBwbHlFZGl0cyhbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsXG5cdFx0XHRcdFx0aW5kZXg6IDAsXG5cdFx0XHRcdFx0Y291bnQ6IHRoaXMuZWRpdG9yTW9kZWxSZWZlcmVuY2Uub2JqZWN0Lm5vdGVib29rLmxlbmd0aCxcblx0XHRcdFx0XHRjZWxsczogZGF0YS5jZWxsc1xuXHRcdFx0XHR9XG5cdFx0XHRdLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cblx0XHRcdGlmICh0aGlzLm9wdGlvbnMuX3dvcmtpbmdDb3B5KSB7XG5cdFx0XHRcdHRoaXMub3B0aW9ucy5fYmFja3VwSWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMub3B0aW9ucy5fd29ya2luZ0NvcHkgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMub3B0aW9ucy5zdGFydERpcnR5ID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmVkaXRvck1vZGVsUmVmZXJlbmNlLm9iamVjdDtcblx0fVxuXG5cdG92ZXJyaWRlIHRvVW50eXBlZCgpOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc291cmNlOiB0aGlzLnJlc291cmNlLFxuXHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRvdmVycmlkZTogdGhpcy52aWV3VHlwZVxuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRvdmVycmlkZSBtYXRjaGVzKG90aGVySW5wdXQ6IEVkaXRvcklucHV0IHwgSVVudHlwZWRFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdGlmIChzdXBlci5tYXRjaGVzKG90aGVySW5wdXQpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKG90aGVySW5wdXQgaW5zdGFuY2VvZiBOb3RlYm9va0VkaXRvcklucHV0KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy52aWV3VHlwZSA9PT0gb3RoZXJJbnB1dC52aWV3VHlwZSAmJiBpc0VxdWFsKHRoaXMucmVzb3VyY2UsIG90aGVySW5wdXQucmVzb3VyY2UpO1xuXHRcdH1cblx0XHRpZiAoaXNSZXNvdXJjZUVkaXRvcklucHV0KG90aGVySW5wdXQpICYmIG90aGVySW5wdXQucmVzb3VyY2Uuc2NoZW1lID09PSBDZWxsVXJpLnNjaGVtZSkge1xuXHRcdFx0cmV0dXJuIGlzRXF1YWwodGhpcy5yZXNvdXJjZSwgQ2VsbFVyaS5wYXJzZShvdGhlcklucHV0LnJlc291cmNlKT8ubm90ZWJvb2spO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29tcG9zaXRlTm90ZWJvb2tFZGl0b3JJbnB1dCB7XG5cdHJlYWRvbmx5IGVkaXRvcklucHV0czogTm90ZWJvb2tFZGl0b3JJbnB1dFtdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNDb21wb3NpdGVOb3RlYm9va0VkaXRvcklucHV0KHRoaW5nOiB1bmtub3duKTogdGhpbmcgaXMgSUNvbXBvc2l0ZU5vdGVib29rRWRpdG9ySW5wdXQge1xuXHRyZXR1cm4gISF0aGluZ1xuXHRcdCYmIHR5cGVvZiB0aGluZyA9PT0gJ29iamVjdCdcblx0XHQmJiBBcnJheS5pc0FycmF5KCg8SUNvbXBvc2l0ZU5vdGVib29rRWRpdG9ySW5wdXQ+dGhpbmcpLmVkaXRvcklucHV0cylcblx0XHQmJiAoKDxJQ29tcG9zaXRlTm90ZWJvb2tFZGl0b3JJbnB1dD50aGluZykuZWRpdG9ySW5wdXRzLmV2ZXJ5KGlucHV0ID0+IGlucHV0IGluc3RhbmNlb2YgTm90ZWJvb2tFZGl0b3JJbnB1dCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNOb3RlYm9va0VkaXRvcklucHV0KHRoaW5nOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCk6IHRoaW5nIGlzIE5vdGVib29rRWRpdG9ySW5wdXQge1xuXHRyZXR1cm4gISF0aGluZ1xuXHRcdCYmIHR5cGVvZiB0aGluZyA9PT0gJ29iamVjdCdcblx0XHQmJiB0aGluZy50eXBlSWQgPT09IE5vdGVib29rRWRpdG9ySW5wdXQuSUQ7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksVUFBVTtBQUN0QixTQUFxRSx5QkFBeUIsV0FBZ0UsNkJBQTZCO0FBRTNMLFNBQVMsa0JBQWtCLGtDQUFrQztBQUU3RCxTQUFTLFNBQVMsZ0JBQWdCO0FBRWxDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsMkNBQTJDO0FBRXBELFNBQVMsY0FBYyxlQUE2QztBQUNwRSxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxtQ0FBbUM7QUFFNUMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxnQkFBZ0I7QUFJekIsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxzQkFBc0I7QUFFL0IsU0FBUyx5Q0FBeUM7QUFDbEQsU0FBUyxpQ0FBaUM7QUFXbkMsSUFBTSxzQkFBTixjQUFrQyw0QkFBNEI7QUFBQSxFQWdCcEUsWUFDQyxVQUNBLG1CQUNnQixVQUNBLFNBQ21CLGtCQUNtQiwrQkFDakIsb0JBQ3RCLGNBQ0QsYUFDYywyQkFDVCxrQkFDSCxlQUNtQixrQ0FDUiwwQkFDMUI7QUFDRCxVQUFNLFVBQVUsbUJBQW1CLGNBQWMsYUFBYSwyQkFBMkIsa0NBQWtDLHdCQUF3QjtBQWJuSTtBQUNBO0FBQ21CO0FBQ21CO0FBQ2pCO0FBWHRDLFNBQVUsdUJBQXdFO0FBRWxGLFNBQVEscUJBQThCO0FBbUJyQyxTQUFLLHFCQUFxQixDQUFDLENBQUMsUUFBUTtBQUtwQyxTQUFLLHNCQUFzQixpQkFBaUIseUJBQXlCLE9BQUs7QUFDekUsVUFBSSxFQUFFLGFBQWEsS0FBSyxZQUFZLEVBQUUsSUFBSSxTQUFTLE1BQU0sS0FBSyxTQUFTLFNBQVMsR0FBRztBQUNsRixhQUFLLFFBQVEsRUFB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
