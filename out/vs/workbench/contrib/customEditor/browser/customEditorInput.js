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
import { getWindow } from "../../../../base/browser/dom.js";
import { toAction } from "../../../../base/common/actions.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Schemas } from "../../../../base/common/network.js";
import { basename } from "../../../../base/common/path.js";
import { dirname, isEqual } from "../../../../base/common/resources.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { localize } from "../../../../nls.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IUndoRedoService } from "../../../../platform/undoRedo/common/undoRedo.js";
import { EditorInputCapabilities, Verbosity, createEditorOpenError } from "../../../common/editor.js";
import { ICustomEditorLabelService } from "../../../services/editor/common/customEditorLabelService.js";
import { ICustomEditorService } from "../common/customEditor.js";
import { IWebviewService } from "../../webview/browser/webview.js";
import { IWebviewWorkbenchService, LazilyResolvedWebviewEditorInput } from "../../webviewPanel/browser/webviewWorkbenchService.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IFilesConfigurationService } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { IWorkbenchLayoutService } from "../../../services/layout/browser/layoutService.js";
import { IUntitledTextEditorService } from "../../../services/untitled/common/untitledTextEditorService.js";
let CustomEditorInput = class extends LazilyResolvedWebviewEditorInput {
  constructor(init, webview, options, webviewWorkbenchService, instantiationService, labelService, customEditorService, fileDialogService, undoRedoService, fileService, filesConfigurationService, editorGroupsService, layoutService, customEditorLabelService) {
    super({ providedId: init.viewType, viewType: init.viewType, name: "" }, webview, webviewWorkbenchService);
    this.instantiationService = instantiationService;
    this.labelService = labelService;
    this.customEditorService = customEditorService;
    this.fileDialogService = fileDialogService;
    this.undoRedoService = undoRedoService;
    this.fileService = fileService;
    this.filesConfigurationService = filesConfigurationService;
    this.editorGroupsService = editorGroupsService;
    this.layoutService = layoutService;
    this.customEditorLabelService = customEditorLabelService;
    this._editorName = void 0;
    this._shortDescription = void 0;
    this._mediumDescription = void 0;
    this._longDescription = void 0;
    this._shortTitle = void 0;
    this._mediumTitle = void 0;
    this._longTitle = void 0;
    this._editorResource = init.resource;
    this.oldResource = options.oldResource;
    this._defaultDirtyState = options.startsDirty;
    this._backupId = options.backupId;
    this._untitledDocumentData = options.untitledDocumentData;
    this.registerListeners();
  }
  static create(instantiationService, resource, viewType, group, options) {
    return instantiationService.invokeFunction((accessor) => {
      const untitledString = accessor.get(IUntitledTextEditorService).getValue(resource);
      const untitledDocumentData = untitledString ? VSBuffer.fromString(untitledString) : void 0;
      const webview = accessor.get(IWebviewService).createWebviewOverlay({
        providedViewType: viewType,
        title: void 0,
        options: { customClasses: options?.customClasses },
        contentOptions: {},
        extension: void 0
      });
      const input = instantiationService.createInstance(CustomEditorInput, { resource, viewType }, webview, { untitledDocumentData, oldResource: options?.oldResource });
      if (typeof group !== "undefined") {
        input.updateGroup(group);
      }
      return input;
    });
  }
  get resource() {
    return this._editorResource;
  }
  registerListeners() {
    this._register(this.labelService.onDidChangeFormatters((e) => this.onLabelEvent(e.scheme)));
    this._register(this.fileService.onDidChangeFileSystemProviderRegistrations((e) => this.onLabelEvent(e.scheme)));
    this._register(this.fileService.onDidChangeFileSystemProviderCapabilities((e) => this.onLabelEvent(e.scheme)));
    this._register(this.customEditorLabelService.onDidChange(() => this.updateLabel()));
    this._register(this.filesConfigurationService.onDidChangeReadonly(() => this._onDidChangeCapabilities.fire()));
  }
  onLabelEvent(scheme) {
    if (scheme === this.resource.scheme) {
      this.updateLabel();
    }
  }
  updateLabel() {
    this._editorName = void 0;
    this._shortDescription = void 0;
    this._mediumDescription = void 0;
    this._longDescription = void 0;
    this._shortTitle = void 0;
    this._mediumTitle = void 0;
    this._longTitle = void 0;
    this._onDidChangeLabel.fire();
  }
  get typeId() {
    return CustomEditorInput.typeId;
  }
  get editorId() {
    return this.viewType;
  }
  get capabilities() {
    let capabilities = EditorInputCapabilities.None;
    capabilities |= EditorInputCapabilities.CanDropIntoEditor;
    if (!this.customEditorService.getCustomEditorCapabilities(this.viewType)?.supportsMultipleEditorsPerDocument) {
      capabilities |= EditorInputCapabilities.Singleton;
    }
    if (this._modelRef) {
      if (this._modelRef.object.isReadonly()) {
        capabilities |= EditorInputCapabilities.Readonly;
      }
    } else {
      if (this.filesConfigurationService.isReadonly(this.resource)) {
        capabilities |= EditorInputCapabilities.Readonly;
      }
    }
    if (this.resource.scheme === Schemas.untitled) {
      capabilities |= EditorInputCapabilities.Untitled;
    }
    return capabilities;
  }
  getName() {
    if (typeof this._editorName !== "string") {
      this._editorName = this.customEditorLabelService.getName(this.resource) ?? basename(this.labelService.getUriLabel(this.resource));
    }
    return this._editorName;
  }
  getDescription(verbosity = Verbosity.MEDIUM) {
    switch (verbosity) {
      case Verbosity.SHORT:
        return this.shortDescription;
      case Verbosity.LONG:
        return this.longDescription;
      case Verbosity.MEDIUM:
      default:
        return this.mediumDescription;
    }
  }
  get shortDescription() {
    if (typeof this._shortDescription !== "string") {
      this._shortDescription = this.labelService.getUriBasenameLabel(dirname(this.resource));
    }
    return this._shortDescription;
  }
  get mediumDescription() {
    if (typeof this._mediumDescription !== "string") {
      this._mediumDescription = this.labelService.getUriLabel(dirname(this.resource), { relative: true });
    }
    return this._mediumDescription;
  }
  get longDescription() {
    if (typeof this._longDescription !== "string") {
      this._longDescription = this.labelService.getUriLabel(dirname(this.resource));
    }
    return this._longDescription;
  }
  get shortTitle() {
    if (typeof this._shortTitle !== "string") {
      this._shortTitle = this.getName();
    }
    return this._shortTitle;
  }
  get mediumTitle() {
    if (typeof this._mediumTitle !== "string") {
      this._mediumTitle = this.labelService.getUriLabel(this.resource, { relative: true });
    }
    return this._mediumTitle;
  }
  get longTitle() {
    if (typeof this._longTitle !== "string") {
      this._longTitle = this.labelService.getUriLabel(this.resource);
    }
    return this._longTitle;
  }
  getTitle(verbosity) {
    switch (verbosity) {
      case Verbosity.SHORT:
        return this.shortTitle;
      case Verbosity.LONG:
        return this.longTitle;
      default:
      case Verbosity.MEDIUM:
        return this.mediumTitle;
    }
  }
  matches(other) {
    if (super.matches(other)) {
      return true;
    }
    return this === other || other instanceof CustomEditorInput && this.viewType === other.viewType && isEqual(this.resource, other.resource);
  }
  copy() {
    return CustomEditorInput.create(this.instantiationService, this.resource, this.viewType, this.group, this.webview.options);
  }
  isReadonly() {
    if (!this._modelRef) {
      return this.filesConfigurationService.isReadonly(this.resource);
    }
    return this._modelRef.object.isReadonly();
  }
  isDirty() {
    if (!this._modelRef) {
      return !!this._defaultDirtyState;
    }
    return this._modelRef.object.isDirty();
  }
  async save(groupId, options) {
    if (!this._modelRef) {
      return void 0;
    }
    const target = await this._modelRef.object.saveCustomEditor(options);
    if (!target) {
      return void 0;
    }
    if (!isEqual(target, this.resource)) {
      return { resource: target };
    }
    return this;
  }
  async saveAs(groupId, options) {
    if (!this._modelRef) {
      return void 0;
    }
    const dialogPath = this._editorResource;
    const target = await this.fileDialogService.pickFileToSave(dialogPath, options?.availableFileSystems);
    if (!target) {
      return void 0;
    }
    if (!await this._modelRef.object.saveCustomEditorAs(this._editorResource, target, options)) {
      return void 0;
    }
    return (await this.rename(groupId, target))?.editor;
  }
  async revert(group, options) {
    if (this._modelRef) {
      return this._modelRef.object.revert(options);
    }
    this._defaultDirtyState = false;
    this._onDidChangeDirty.fire();
  }
  async resolve() {
    await super.resolve();
    if (this.isDisposed()) {
      return null;
    }
    if (!this._modelRef) {
      const oldCapabilities = this.capabilities;
      this._modelRef = this._register(assertIsDefined(await this.customEditorService.models.tryRetain(this.resource, this.viewType)));
      this._register(this._modelRef.object.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
      this._register(this._modelRef.object.onDidChangeReadonly(() => this._onDidChangeCapabilities.fire()));
      if (this._untitledDocumentData) {
        this._defaultDirtyState = true;
      }
      if (this.isDirty()) {
        this._onDidChangeDirty.fire();
      }
      if (this.capabilities !== oldCapabilities) {
        this._onDidChangeCapabilities.fire();
      }
    }
    return null;
  }
  async rename(group, newResource) {
    return { editor: { resource: newResource } };
  }
  undo() {
    assertIsDefined(this._modelRef);
    return this.undoRedoService.undo(this.resource);
  }
  redo() {
    assertIsDefined(this._modelRef);
    return this.undoRedoService.redo(this.resource);
  }
  onMove(handler) {
    this._moveHandler = handler;
  }
  transfer(other) {
    if (!super.transfer(other)) {
      return;
    }
    other._moveHandler = this._moveHandler;
    this._moveHandler = void 0;
    return other;
  }
  get backupId() {
    if (this._modelRef) {
      return this._modelRef.object.backupId;
    }
    return this._backupId;
  }
  get untitledDocumentData() {
    return this._untitledDocumentData;
  }
  toUntyped() {
    return {
      resource: this.resource,
      options: {
        override: this.viewType
      }
    };
  }
  claim(claimant, targetWindow, scopedContextKeyService) {
    if (this.doCanMove(targetWindow.vscodeWindowId) !== true) {
      throw createEditorOpenError(localize("editorUnsupportedInWindow", "Unable to open the editor in this window, it contains modifications that can only be saved in the original window."), [
        toAction({
          id: "openInOriginalWindow",
          label: localize("reopenInOriginalWindow", "Open in Original Window"),
          run: async () => {
            const originalPart = this.editorGroupsService.getPart(this.layoutService.getContainer(getWindow(this.webview.container).window));
            const currentPart = this.editorGroupsService.getPart(this.layoutService.getContainer(targetWindow.window));
            currentPart.activeGroup.moveEditor(this, originalPart.activeGroup);
          }
        })
      ], { forceMessage: true });
    }
    return super.claim(claimant, targetWindow, scopedContextKeyService);
  }
  canMove(sourceGroup, targetGroup) {
    const resolvedTargetGroup = this.editorGroupsService.getGroup(targetGroup);
    if (resolvedTargetGroup) {
      const canMove = this.doCanMove(resolvedTargetGroup.windowId);
      if (typeof canMove === "string") {
        return canMove;
      }
    }
    return super.canMove(sourceGroup, targetGroup);
  }
  doCanMove(targetWindowId) {
    if (this.isModified() && this._modelRef?.object.canHotExit === false) {
      const sourceWindowId = getWindow(this.webview.container).vscodeWindowId;
      if (sourceWindowId !== targetWindowId) {
        return localize("editorCannotMove", "Unable to move '{0}': The editor contains changes that can only be saved in its current window.", this.getName());
      }
    }
    return true;
  }
};
CustomEditorInput.typeId = "workbench.editors.webviewEditor";
CustomEditorInput = __decorateClass([
  __decorateParam(3, IWebviewWorkbenchService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, ICustomEditorService),
  __decorateParam(7, IFileDialogService),
  __decorateParam(8, IUndoRedoService),
  __decorateParam(9, IFileService),
  __decorateParam(10, IFilesConfigurationService),
  __decorateParam(11, IEditorGroupsService),
  __decorateParam(12, IWorkbenchLayoutService),
  __decorateParam(13, ICustomEditorLabelService)
], CustomEditorInput);
export {
  CustomEditorInput
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jdXN0b21FZGl0b3IvYnJvd3Nlci9jdXN0b21FZGl0b3JJbnB1dC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGdldFdpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQ29kZVdpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuaW1wb3J0IHsgdG9BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IElSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IGRpcm5hbWUsIGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUZpbGVEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJUmVzb3VyY2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSVVuZG9SZWRvU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuZG9SZWRvL2NvbW1vbi91bmRvUmVkby5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dENhcGFiaWxpdGllcywgR3JvdXBJZGVudGlmaWVyLCBJTW92ZVJlc3VsdCwgSVJldmVydE9wdGlvbnMsIElTYXZlT3B0aW9ucywgSVVudHlwZWRFZGl0b3JJbnB1dCwgVmVyYm9zaXR5LCBjcmVhdGVFZGl0b3JPcGVuRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJQ3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9jdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUN1c3RvbUVkaXRvck1vZGVsLCBJQ3VzdG9tRWRpdG9yU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9jdXN0b21FZGl0b3IuanMnO1xuaW1wb3J0IHsgSU92ZXJsYXlXZWJ2aWV3LCBJV2Vidmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi93ZWJ2aWV3L2Jyb3dzZXIvd2Vidmlldy5qcyc7XG5pbXBvcnQgeyBJV2Vidmlld1dvcmtiZW5jaFNlcnZpY2UsIExhemlseVJlc29sdmVkV2Vidmlld0VkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vd2Vidmlld1BhbmVsL2Jyb3dzZXIvd2Vidmlld1dvcmtiZW5jaFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9maWxlc0NvbmZpZ3VyYXRpb24vY29tbW9uL2ZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaExheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVbnRpdGxlZFRleHRFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdW50aXRsZWQvY29tbW9uL3VudGl0bGVkVGV4dEVkaXRvclNlcnZpY2UuanMnO1xuXG5pbnRlcmZhY2UgQ3VzdG9tRWRpdG9ySW5wdXRJbml0SW5mbyB7XG5cdHJlYWRvbmx5IHJlc291cmNlOiBVUkk7XG5cdHJlYWRvbmx5IHZpZXdUeXBlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBDdXN0b21FZGl0b3JJbnB1dCBleHRlbmRzIExhemlseVJlc29sdmVkV2Vidmlld0VkaXRvcklucHV0IHtcblxuXHRzdGF0aWMgY3JlYXRlKFxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0cmVzb3VyY2U6IFVSSSxcblx0XHR2aWV3VHlwZTogc3RyaW5nLFxuXHRcdGdyb3VwOiBHcm91cElkZW50aWZpZXIgfCB1bmRlZmluZWQsXG5cdFx0b3B0aW9ucz86IHsgcmVhZG9ubHkgY3VzdG9tQ2xhc3Nlcz86IHN0cmluZzsgcmVhZG9ubHkgb2xkUmVzb3VyY2U/OiBVUkkgfSxcblx0KTogRWRpdG9ySW5wdXQge1xuXHRcdHJldHVybiBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiB7XG5cdFx0XHQvLyBJZiBpdCdzIGFuIHVudGl0bGVkIGZpbGUgd2UgbXVzdCBwb3B1bGF0ZSB0aGUgdW50aXRsZWREb2N1bWVudERhdGFcblx0XHRcdGNvbnN0IHVudGl0bGVkU3RyaW5nID0gYWNjZXNzb3IuZ2V0KElVbnRpdGxlZFRleHRFZGl0b3JTZXJ2aWNlKS5nZXRWYWx1ZShyZXNvdXJjZSk7XG5cdFx0XHRjb25zdCB1bnRpdGxlZERvY3VtZW50RGF0YSA9IHVudGl0bGVkU3RyaW5nID8gVlNCdWZmZXIuZnJvbVN0cmluZyh1bnRpdGxlZFN0cmluZykgOiB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCB3ZWJ2aWV3ID0gYWNjZXNzb3IuZ2V0KElXZWJ2aWV3U2VydmljZSkuY3JlYXRlV2Vidmlld092ZXJsYXkoe1xuXHRcdFx0XHRwcm92aWRlZFZpZXdUeXBlOiB2aWV3VHlwZSxcblx0XHRcdFx0dGl0bGU6IHVuZGVmaW5lZCxcblx0XHRcdFx0b3B0aW9uczogeyBjdXN0b21DbGFzc2VzOiBvcHRpb25zPy5jdXN0b21DbGFzc2VzIH0sXG5cdFx0XHRcdGNvbnRlbnRPcHRpb25zOiB7fSxcblx0XHRcdFx0ZXh0ZW5zaW9uOiB1bmRlZmluZWQsXG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IGlucHV0ID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ3VzdG9tRWRpdG9ySW5wdXQsIHsgcmVzb3VyY2UsIHZpZXdUeXBlIH0sIHdlYnZpZXcsIHsgdW50aXRsZWREb2N1bWVudERhdGE6IHVudGl0bGVkRG9jdW1lbnREYXRhLCBvbGRSZXNvdXJjZTogb3B0aW9ucz8ub2xkUmVzb3VyY2UgfSk7XG5cdFx0XHRpZiAodHlwZW9mIGdyb3VwICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0XHRpbnB1dC51cGRhdGVHcm91cChncm91cCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaW5wdXQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIG92ZXJyaWRlIHJlYWRvbmx5IHR5cGVJZCA9ICd3b3JrYmVuY2guZWRpdG9ycy53ZWJ2aWV3RWRpdG9yJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JSZXNvdXJjZTogVVJJO1xuXHRwdWJsaWMgcmVhZG9ubHkgb2xkUmVzb3VyY2U/OiBVUkk7XG5cdHByaXZhdGUgX2RlZmF1bHREaXJ0eVN0YXRlOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2JhY2t1cElkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdW50aXRsZWREb2N1bWVudERhdGE6IFZTQnVmZmVyIHwgdW5kZWZpbmVkO1xuXG5cdG92ZXJyaWRlIGdldCByZXNvdXJjZSgpIHsgcmV0dXJuIHRoaXMuX2VkaXRvclJlc291cmNlOyB9XG5cblx0cHJpdmF0ZSBfbW9kZWxSZWY/OiBJUmVmZXJlbmNlPElDdXN0b21FZGl0b3JNb2RlbD47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0aW5pdDogQ3VzdG9tRWRpdG9ySW5wdXRJbml0SW5mbyxcblx0XHR3ZWJ2aWV3OiBJT3ZlcmxheVdlYnZpZXcsXG5cdFx0b3B0aW9uczogeyBzdGFydHNEaXJ0eT86IGJvb2xlYW47IGJhY2t1cElkPzogc3RyaW5nOyB1bnRpdGxlZERvY3VtZW50RGF0YT86IFZTQnVmZmVyOyByZWFkb25seSBvbGRSZXNvdXJjZT86IFVSSSB9LFxuXHRcdEBJV2Vidmlld1dvcmtiZW5jaFNlcnZpY2Ugd2Vidmlld1dvcmtiZW5jaFNlcnZpY2U6IElXZWJ2aWV3V29ya2JlbmNoU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASUN1c3RvbUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjdXN0b21FZGl0b3JTZXJ2aWNlOiBJQ3VzdG9tRWRpdG9yU2VydmljZSxcblx0XHRASUZpbGVEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZURpYWxvZ1NlcnZpY2U6IElGaWxlRGlhbG9nU2VydmljZSxcblx0XHRASVVuZG9SZWRvU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVuZG9SZWRvU2VydmljZTogSVVuZG9SZWRvU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JHcm91cHNTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSxcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0XHRASUN1c3RvbUVkaXRvckxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGN1c3RvbUVkaXRvckxhYmVsU2VydmljZTogSUN1c3RvbUVkaXRvckxhYmVsU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoeyBwcm92aWRlZElkOiBpbml0LnZpZXdUeXBlLCB2aWV3VHlwZTogaW5pdC52aWV3VHlwZSwgbmFtZTogJycgfSwgd2Vidmlldywgd2Vidmlld1dvcmtiZW5jaFNlcnZpY2UpO1xuXHRcdHRoaXMuX2VkaXRvclJlc291cmNlID0gaW5pdC5yZXNvdXJjZTtcblx0XHR0aGlzLm9sZFJlc291cmNlID0gb3B0aW9ucy5vbGRSZXNvdXJjZTtcblx0XHR0aGlzLl9kZWZhdWx0RGlydHlTdGF0ZSA9IG9wdGlvbnMuc3RhcnRzRGlydHk7XG5cdFx0dGhpcy5fYmFja3VwSWQgPSBvcHRpb25zLmJhY2t1cElkO1xuXHRcdHRoaXMuX3VudGl0bGVkRG9jdW1lbnREYXRhID0gb3B0aW9ucy51bnRpdGxlZERvY3VtZW50RGF0YTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cblx0XHQvLyBDbGVhciBvdXIgbGFiZWxzIG9uIGNlcnRhaW4gbGFiZWwgcmVsYXRlZCBldmVudHNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxhYmVsU2VydmljZS5vbkRpZENoYW5nZUZvcm1hdHRlcnMoZSA9PiB0aGlzLm9uTGFiZWxFdmVudChlLnNjaGVtZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyUmVnaXN0cmF0aW9ucyhlID0+IHRoaXMub25MYWJlbEV2ZW50KGUuc2NoZW1lKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZVNlcnZpY2Uub25EaWRDaGFuZ2VGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMoZSA9PiB0aGlzLm9uTGFiZWxFdmVudChlLnNjaGVtZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmN1c3RvbUVkaXRvckxhYmVsU2VydmljZS5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLnVwZGF0ZUxhYmVsKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VSZWFkb25seSgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUNhcGFiaWxpdGllcy5maXJlKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgb25MYWJlbEV2ZW50KHNjaGVtZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKHNjaGVtZSA9PT0gdGhpcy5yZXNvdXJjZS5zY2hlbWUpIHtcblx0XHRcdHRoaXMudXBkYXRlTGFiZWwoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUxhYmVsKCk6IHZvaWQge1xuXG5cdFx0Ly8gQ2xlYXIgYW55IGNhY2hlZCBsYWJlbHMgZnJvbSBiZWZvcmVcblx0XHR0aGlzLl9lZGl0b3JOYW1lID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3Nob3J0RGVzY3JpcHRpb24gPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fbWVkaXVtRGVzY3JpcHRpb24gPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fbG9uZ0Rlc2NyaXB0aW9uID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3Nob3J0VGl0bGUgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fbWVkaXVtVGl0bGUgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fbG9uZ1RpdGxlID0gdW5kZWZpbmVkO1xuXG5cdFx0Ly8gVHJpZ2dlciByZWNvbXB1dGUgb2YgbGFiZWxcblx0XHR0aGlzLl9vbkRpZENoYW5nZUxhYmVsLmZpcmUoKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBnZXQgdHlwZUlkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIEN1c3RvbUVkaXRvcklucHV0LnR5cGVJZDtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBnZXQgZWRpdG9ySWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMudmlld1R5cGU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZ2V0IGNhcGFiaWxpdGllcygpOiBFZGl0b3JJbnB1dENhcGFiaWxpdGllcyB7XG5cdFx0bGV0IGNhcGFiaWxpdGllcyA9IEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLk5vbmU7XG5cblx0XHRjYXBhYmlsaXRpZXMgfD0gRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuQ2FuRHJvcEludG9FZGl0b3I7XG5cblx0XHRpZiAoIXRoaXMuY3VzdG9tRWRpdG9yU2VydmljZS5nZXRDdXN0b21FZGl0b3JDYXBhYmlsaXRpZXModGhpcy52aWV3VHlwZSk/LnN1cHBvcnRzTXVsdGlwbGVFZGl0b3JzUGVyRG9jdW1lbnQpIHtcblx0XHRcdGNhcGFiaWxpdGllcyB8PSBFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5TaW5nbGV0b247XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX21vZGVsUmVmKSB7XG5cdFx0XHRpZiAodGhpcy5fbW9kZWxSZWYub2JqZWN0LmlzUmVhZG9ubHkoKSkge1xuXHRcdFx0XHRjYXBhYmlsaXRpZXMgfD0gRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuUmVhZG9ubHk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0aGlzLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuaXNSZWFkb25seSh0aGlzLnJlc291cmNlKSkge1xuXHRcdFx0XHRjYXBhYmlsaXRpZXMgfD0gRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuUmVhZG9ubHk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMucmVzb3VyY2Uuc2NoZW1lID09PSBTY2hlbWFzLnVudGl0bGVkKSB7XG5cdFx0XHRjYXBhYmlsaXRpZXMgfD0gRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuVW50aXRsZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNhcGFiaWxpdGllcztcblx0fVxuXG5cdHByaXZhdGUgX2VkaXRvck5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0b3ZlcnJpZGUgZ2V0TmFtZSgpOiBzdHJpbmcge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5fZWRpdG9yTmFtZSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHRoaXMuX2VkaXRvck5hbWUgPSB0aGlzLmN1c3RvbUVkaXRvckxhYmVsU2VydmljZS5nZXROYW1lKHRoaXMucmVzb3VyY2UpID8/IGJhc2VuYW1lKHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHRoaXMucmVzb3VyY2UpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fZWRpdG9yTmFtZTtcblx0fVxuXG5cdG92ZXJyaWRlIGdldERlc2NyaXB0aW9uKHZlcmJvc2l0eSA9IFZlcmJvc2l0eS5NRURJVU0pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHN3aXRjaCAodmVyYm9zaXR5KSB7XG5cdFx0XHRjYXNlIFZlcmJvc2l0eS5TSE9SVDpcblx0XHRcdFx0cmV0dXJuIHRoaXMuc2hvcnREZXNjcmlwdGlvbjtcblx0XHRcdGNhc2UgVmVyYm9zaXR5LkxPTkc6XG5cdFx0XHRcdHJldHVybiB0aGlzLmxvbmdEZXNjcmlwdGlvbjtcblx0XHRcdGNhc2UgVmVyYm9zaXR5Lk1FRElVTTpcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiB0aGlzLm1lZGl1bURlc2NyaXB0aW9uO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3Nob3J0RGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBnZXQgc2hvcnREZXNjcmlwdGlvbigpOiBzdHJpbmcge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5fc2hvcnREZXNjcmlwdGlvbiAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHRoaXMuX3Nob3J0RGVzY3JpcHRpb24gPSB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlCYXNlbmFtZUxhYmVsKGRpcm5hbWUodGhpcy5yZXNvdXJjZSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9zaG9ydERlc2NyaXB0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBfbWVkaXVtRGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBnZXQgbWVkaXVtRGVzY3JpcHRpb24oKTogc3RyaW5nIHtcblx0XHRpZiAodHlwZW9mIHRoaXMuX21lZGl1bURlc2NyaXB0aW9uICE9PSAnc3RyaW5nJykge1xuXHRcdFx0dGhpcy5fbWVkaXVtRGVzY3JpcHRpb24gPSB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChkaXJuYW1lKHRoaXMucmVzb3VyY2UpLCB7IHJlbGF0aXZlOiB0cnVlIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9tZWRpdW1EZXNjcmlwdGlvbjtcblx0fVxuXG5cdHByaXZhdGUgX2xvbmdEZXNjcmlwdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldCBsb25nRGVzY3JpcHRpb24oKTogc3RyaW5nIHtcblx0XHRpZiAodHlwZW9mIHRoaXMuX2xvbmdEZXNjcmlwdGlvbiAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHRoaXMuX2xvbmdEZXNjcmlwdGlvbiA9IHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGRpcm5hbWUodGhpcy5yZXNvdXJjZSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9sb25nRGVzY3JpcHRpb247XG5cdH1cblxuXHRwcml2YXRlIF9zaG9ydFRpdGxlOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZ2V0IHNob3J0VGl0bGUoKTogc3RyaW5nIHtcblx0XHRpZiAodHlwZW9mIHRoaXMuX3Nob3J0VGl0bGUgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLl9zaG9ydFRpdGxlID0gdGhpcy5nZXROYW1lKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3Nob3J0VGl0bGU7XG5cdH1cblxuXHRwcml2YXRlIF9tZWRpdW1UaXRsZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldCBtZWRpdW1UaXRsZSgpOiBzdHJpbmcge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5fbWVkaXVtVGl0bGUgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLl9tZWRpdW1UaXRsZSA9IHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHRoaXMucmVzb3VyY2UsIHsgcmVsYXRpdmU6IHRydWUgfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX21lZGl1bVRpdGxlO1xuXHR9XG5cblx0cHJpdmF0ZSBfbG9uZ1RpdGxlOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZ2V0IGxvbmdUaXRsZSgpOiBzdHJpbmcge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5fbG9uZ1RpdGxlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0dGhpcy5fbG9uZ1RpdGxlID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwodGhpcy5yZXNvdXJjZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2xvbmdUaXRsZTtcblx0fVxuXG5cdG92ZXJyaWRlIGdldFRpdGxlKHZlcmJvc2l0eT86IFZlcmJvc2l0eSk6IHN0cmluZyB7XG5cdFx0c3dpdGNoICh2ZXJib3NpdHkpIHtcblx0XHRcdGNhc2UgVmVyYm9zaXR5LlNIT1JUOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5zaG9ydFRpdGxlO1xuXHRcdFx0Y2FzZSBWZXJib3NpdHkuTE9ORzpcblx0XHRcdFx0cmV0dXJuIHRoaXMubG9uZ1RpdGxlO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdGNhc2UgVmVyYm9zaXR5Lk1FRElVTTpcblx0XHRcdFx0cmV0dXJuIHRoaXMubWVkaXVtVGl0bGU7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIG1hdGNoZXMob3RoZXI6IEVkaXRvcklucHV0IHwgSVVudHlwZWRFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdGlmIChzdXBlci5tYXRjaGVzKG90aGVyKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzID09PSBvdGhlciB8fCAob3RoZXIgaW5zdGFuY2VvZiBDdXN0b21FZGl0b3JJbnB1dFxuXHRcdFx0JiYgdGhpcy52aWV3VHlwZSA9PT0gb3RoZXIudmlld1R5cGVcblx0XHRcdCYmIGlzRXF1YWwodGhpcy5yZXNvdXJjZSwgb3RoZXIucmVzb3VyY2UpKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBjb3B5KCk6IEVkaXRvcklucHV0IHtcblx0XHRyZXR1cm4gQ3VzdG9tRWRpdG9ySW5wdXQuY3JlYXRlKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UsIHRoaXMucmVzb3VyY2UsIHRoaXMudmlld1R5cGUsIHRoaXMuZ3JvdXAsIHRoaXMud2Vidmlldy5vcHRpb25zKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBpc1JlYWRvbmx5KCk6IGJvb2xlYW4gfCBJTWFya2Rvd25TdHJpbmcge1xuXHRcdGlmICghdGhpcy5fbW9kZWxSZWYpIHtcblx0XHRcdHJldHVybiB0aGlzLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuaXNSZWFkb25seSh0aGlzLnJlc291cmNlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsUmVmLm9iamVjdC5pc1JlYWRvbmx5KCk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgaXNEaXJ0eSgpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsUmVmKSB7XG5cdFx0XHRyZXR1cm4gISF0aGlzLl9kZWZhdWx0RGlydHlTdGF0ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsUmVmLm9iamVjdC5pc0RpcnR5KCk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgYXN5bmMgc2F2ZShncm91cElkOiBHcm91cElkZW50aWZpZXIsIG9wdGlvbnM/OiBJU2F2ZU9wdGlvbnMpOiBQcm9taXNlPEVkaXRvcklucHV0IHwgSVVudHlwZWRFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghdGhpcy5fbW9kZWxSZWYpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGFyZ2V0ID0gYXdhaXQgdGhpcy5fbW9kZWxSZWYub2JqZWN0LnNhdmVDdXN0b21FZGl0b3Iob3B0aW9ucyk7XG5cdFx0aWYgKCF0YXJnZXQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7IC8vIHNhdmUgY2FuY2VsbGVkXG5cdFx0fVxuXG5cdFx0Ly8gRGlmZmVyZW50IFVSSXMgPT0gdW50eXBlZCBpbnB1dCByZXR1cm5lZCB0byBhbGxvdyByZXNvbHZlciB0byBwb3NzaWJseSByZXNvbHZlIHRvIGEgZGlmZmVyZW50IGVkaXRvciB0eXBlXG5cdFx0aWYgKCFpc0VxdWFsKHRhcmdldCwgdGhpcy5yZXNvdXJjZSkpIHtcblx0XHRcdHJldHVybiB7IHJlc291cmNlOiB0YXJnZXQgfTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBhc3luYyBzYXZlQXMoZ3JvdXBJZDogR3JvdXBJZGVudGlmaWVyLCBvcHRpb25zPzogSVNhdmVPcHRpb25zKTogUHJvbWlzZTxFZGl0b3JJbnB1dCB8IElVbnR5cGVkRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMuX21vZGVsUmVmKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpYWxvZ1BhdGggPSB0aGlzLl9lZGl0b3JSZXNvdXJjZTtcblx0XHRjb25zdCB0YXJnZXQgPSBhd2FpdCB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLnBpY2tGaWxlVG9TYXZlKGRpYWxvZ1BhdGgsIG9wdGlvbnM/LmF2YWlsYWJsZUZpbGVTeXN0ZW1zKTtcblx0XHRpZiAoIXRhcmdldCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDsgLy8gc2F2ZSBjYW5jZWxsZWRcblx0XHR9XG5cblx0XHRpZiAoIWF3YWl0IHRoaXMuX21vZGVsUmVmLm9iamVjdC5zYXZlQ3VzdG9tRWRpdG9yQXModGhpcy5fZWRpdG9yUmVzb3VyY2UsIHRhcmdldCwgb3B0aW9ucykpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIChhd2FpdCB0aGlzLnJlbmFtZShncm91cElkLCB0YXJnZXQpKT8uZWRpdG9yO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGFzeW5jIHJldmVydChncm91cDogR3JvdXBJZGVudGlmaWVyLCBvcHRpb25zPzogSVJldmVydE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5fbW9kZWxSZWYpIHtcblx0XHRcdHJldHVybiB0aGlzLl9tb2RlbFJlZi5vYmplY3QucmV2ZXJ0KG9wdGlvbnMpO1xuXHRcdH1cblx0XHR0aGlzLl9kZWZhdWx0RGlydHlTdGF0ZSA9IGZhbHNlO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlRGlydHkuZmlyZSgpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGFzeW5jIHJlc29sdmUoKTogUHJvbWlzZTxudWxsPiB7XG5cdFx0YXdhaXQgc3VwZXIucmVzb2x2ZSgpO1xuXG5cdFx0aWYgKHRoaXMuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX21vZGVsUmVmKSB7XG5cdFx0XHRjb25zdCBvbGRDYXBhYmlsaXRpZXMgPSB0aGlzLmNhcGFiaWxpdGllcztcblx0XHRcdHRoaXMuX21vZGVsUmVmID0gdGhpcy5fcmVnaXN0ZXIoYXNzZXJ0SXNEZWZpbmVkKGF3YWl0IHRoaXMuY3VzdG9tRWRpdG9yU2VydmljZS5tb2RlbHMudHJ5UmV0YWluKHRoaXMucmVzb3VyY2UsIHRoaXMudmlld1R5cGUpKSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9tb2RlbFJlZi5vYmplY3Qub25EaWRDaGFuZ2VEaXJ0eSgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZURpcnR5LmZpcmUoKSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbW9kZWxSZWYub2JqZWN0Lm9uRGlkQ2hhbmdlUmVhZG9ubHkoKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VDYXBhYmlsaXRpZXMuZmlyZSgpKSk7XG5cdFx0XHQvLyBJZiB3ZSdyZSBsb2FkaW5nIHVudGl0bGVkIGZpbGUgZGF0YSB3ZSBzaG91bGQgZW5zdXJlIGl0J3MgZGlydHlcblx0XHRcdGlmICh0aGlzLl91bnRpdGxlZERvY3VtZW50RGF0YSkge1xuXHRcdFx0XHR0aGlzLl9kZWZhdWx0RGlydHlTdGF0ZSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5pc0RpcnR5KCkpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEaXJ0eS5maXJlKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5jYXBhYmlsaXRpZXMgIT09IG9sZENhcGFiaWxpdGllcykge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNhcGFiaWxpdGllcy5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgYXN5bmMgcmVuYW1lKGdyb3VwOiBHcm91cElkZW50aWZpZXIsIG5ld1Jlc291cmNlOiBVUkkpOiBQcm9taXNlPElNb3ZlUmVzdWx0IHwgdW5kZWZpbmVkPiB7XG5cdFx0Ly8gV2UgcmV0dXJuIGFuIHVudHlwZWQgZWRpdG9yIGlucHV0IHdoaWNoIGNhbiB0aGVuIGJlIHJlc29sdmVkIGluIHRoZSBlZGl0b3Igc2VydmljZVxuXHRcdHJldHVybiB7IGVkaXRvcjogeyByZXNvdXJjZTogbmV3UmVzb3VyY2UgfSB9O1xuXHR9XG5cblx0cHVibGljIHVuZG8oKTogdm9pZCB8IFByb21pc2U8dm9pZD4ge1xuXHRcdGFzc2VydElzRGVmaW5lZCh0aGlzLl9tb2RlbFJlZik7XG5cdFx0cmV0dXJuIHRoaXMudW5kb1JlZG9TZXJ2aWNlLnVuZG8odGhpcy5yZXNvdXJjZSk7XG5cdH1cblxuXHRwdWJsaWMgcmVkbygpOiB2b2lkIHwgUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXNzZXJ0SXNEZWZpbmVkKHRoaXMuX21vZGVsUmVmKTtcblx0XHRyZXR1cm4gdGhpcy51bmRvUmVkb1NlcnZpY2UucmVkbyh0aGlzLnJlc291cmNlKTtcblx0fVxuXG5cdHByaXZhdGUgX21vdmVIYW5kbGVyPzogKG5ld1Jlc291cmNlOiBVUkkpID0+IHZvaWQ7XG5cblx0cHVibGljIG9uTW92ZShoYW5kbGVyOiAobmV3UmVzb3VyY2U6IFVSSSkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdC8vIFRPRE86IE1vdmUgdGhpcyB0byB0aGUgc2VydmljZVxuXHRcdHRoaXMuX21vdmVIYW5kbGVyID0gaGFuZGxlcjtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB0cmFuc2ZlcihvdGhlcjogQ3VzdG9tRWRpdG9ySW5wdXQpOiBDdXN0b21FZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFzdXBlci50cmFuc2ZlcihvdGhlcikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRvdGhlci5fbW92ZUhhbmRsZXIgPSB0aGlzLl9tb3ZlSGFuZGxlcjtcblx0XHR0aGlzLl9tb3ZlSGFuZGxlciA9IHVuZGVmaW5lZDtcblx0XHRyZXR1cm4gb3RoZXI7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGJhY2t1cElkKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuX21vZGVsUmVmKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbW9kZWxSZWYub2JqZWN0LmJhY2t1cElkO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fYmFja3VwSWQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHVudGl0bGVkRG9jdW1lbnREYXRhKCk6IFZTQnVmZmVyIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fdW50aXRsZWREb2N1bWVudERhdGE7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgdG9VbnR5cGVkKCk6IElSZXNvdXJjZUVkaXRvcklucHV0IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzb3VyY2U6IHRoaXMucmVzb3VyY2UsXG5cdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdG92ZXJyaWRlOiB0aGlzLnZpZXdUeXBlXG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBjbGFpbShjbGFpbWFudDogdW5rbm93biwgdGFyZ2V0V2luZG93OiBDb2RlV2luZG93LCBzY29wZWRDb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuZG9DYW5Nb3ZlKHRhcmdldFdpbmRvdy52c2NvZGVXaW5kb3dJZCkgIT09IHRydWUpIHtcblx0XHRcdHRocm93IGNyZWF0ZUVkaXRvck9wZW5FcnJvcihsb2NhbGl6ZSgnZWRpdG9yVW5zdXBwb3J0ZWRJbldpbmRvdycsIFwiVW5hYmxlIHRvIG9wZW4gdGhlIGVkaXRvciBpbiB0aGlzIHdpbmRvdywgaXQgY29udGFpbnMgbW9kaWZpY2F0aW9ucyB0aGF0IGNhbiBvbmx5IGJlIHNhdmVkIGluIHRoZSBvcmlnaW5hbCB3aW5kb3cuXCIpLCBbXG5cdFx0XHRcdHRvQWN0aW9uKHtcblx0XHRcdFx0XHRpZDogJ29wZW5Jbk9yaWdpbmFsV2luZG93Jyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3Jlb3BlbkluT3JpZ2luYWxXaW5kb3cnLCBcIk9wZW4gaW4gT3JpZ2luYWwgV2luZG93XCIpLFxuXHRcdFx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxQYXJ0ID0gdGhpcy5lZGl0b3JHcm91cHNTZXJ2aWNlLmdldFBhcnQodGhpcy5sYXlvdXRTZXJ2aWNlLmdldENvbnRhaW5lcihnZXRXaW5kb3codGhpcy53ZWJ2aWV3LmNvbnRhaW5lcikud2luZG93KSk7XG5cdFx0XHRcdFx0XHRjb25zdCBjdXJyZW50UGFydCA9IHRoaXMuZWRpdG9yR3JvdXBzU2VydmljZS5nZXRQYXJ0KHRoaXMubGF5b3V0U2VydmljZS5nZXRDb250YWluZXIodGFyZ2V0V2luZG93LndpbmRvdykpO1xuXHRcdFx0XHRcdFx0Y3VycmVudFBhcnQuYWN0aXZlR3JvdXAubW92ZUVkaXRvcih0aGlzLCBvcmlnaW5hbFBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSlcblx0XHRcdF0sIHsgZm9yY2VNZXNzYWdlOiB0cnVlIH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gc3VwZXIuY2xhaW0oY2xhaW1hbnQsIHRhcmdldFdpbmRvdywgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGNhbk1vdmUoc291cmNlR3JvdXA6IEdyb3VwSWRlbnRpZmllciwgdGFyZ2V0R3JvdXA6IEdyb3VwSWRlbnRpZmllcik6IHRydWUgfCBzdHJpbmcge1xuXHRcdGNvbnN0IHJlc29sdmVkVGFyZ2V0R3JvdXAgPSB0aGlzLmVkaXRvckdyb3Vwc1NlcnZpY2UuZ2V0R3JvdXAodGFyZ2V0R3JvdXApO1xuXHRcdGlmIChyZXNvbHZlZFRhcmdldEdyb3VwKSB7XG5cdFx0XHRjb25zdCBjYW5Nb3ZlID0gdGhpcy5kb0Nhbk1vdmUocmVzb2x2ZWRUYXJnZXRHcm91cC53aW5kb3dJZCk7XG5cdFx0XHRpZiAodHlwZW9mIGNhbk1vdmUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdHJldHVybiBjYW5Nb3ZlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBzdXBlci5jYW5Nb3ZlKHNvdXJjZUdyb3VwLCB0YXJnZXRHcm91cCk7XG5cdH1cblxuXHRwcml2YXRlIGRvQ2FuTW92ZSh0YXJnZXRXaW5kb3dJZDogbnVtYmVyKTogdHJ1ZSB8IHN0cmluZyB7XG5cdFx0aWYgKHRoaXMuaXNNb2RpZmllZCgpICYmIHRoaXMuX21vZGVsUmVmPy5vYmplY3QuY2FuSG90RXhpdCA9PT0gZmFsc2UpIHtcblx0XHRcdGNvbnN0IHNvdXJjZVdpbmRvd0lkID0gZ2V0V2luZG93KHRoaXMud2Vidmlldy5jb250YWluZXIpLnZzY29kZVdpbmRvd0lkO1xuXHRcdFx0aWYgKHNvdXJjZVdpbmRvd0lkICE9PSB0YXJnZXRXaW5kb3dJZCkge1xuXG5cdFx0XHRcdC8vIFRoZSBjdXN0b20gZWRpdG9yIGlzIG1vZGlmaWVkLCBub3QgYmFja2VkIGJ5IGEgZmlsZSBhbmQgd2l0aG91dCBhIGJhY2t1cC5cblx0XHRcdFx0Ly8gV2UgaGF2ZSB0byBhc3N1bWUgdGhhdCB0aGUgbW9kaWZpZWQgc3RhdGUgaXMgZW5jbG9zZWQgaW50byB0aGUgd2Vidmlld1xuXHRcdFx0XHQvLyBtYW5hZ2VkIGJ5IGFuIGV4dGVuc2lvbi4gQXMgc3VjaCwgd2UgY2Fubm90IGp1c3QgbW92ZSB0aGUgd2Vidmlld1xuXHRcdFx0XHQvLyBpbnRvIGFub3RoZXIgd2luZG93IGJlY2F1c2UgdGhhdCBtZWFucywgd2UgcG90ZW50YWxseSBsb29zZSB0aGUgbW9kaWZpZWRcblx0XHRcdFx0Ly8gc3RhdGUgYW5kIHRodXMgdHJpZ2dlciBkYXRhIGxvc3MuXG5cblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdlZGl0b3JDYW5ub3RNb3ZlJywgXCJVbmFibGUgdG8gbW92ZSAnezB9JzogVGhlIGVkaXRvciBjb250YWlucyBjaGFuZ2VzIHRoYXQgY2FuIG9ubHkgYmUgc2F2ZWQgaW4gaXRzIGN1cnJlbnQgd2luZG93LlwiLCB0aGlzLmdldE5hbWUoKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxpQkFBaUI7QUFFMUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxnQkFBZ0I7QUFHekIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsU0FBUyxlQUFlO0FBQ2pDLFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsMEJBQTBCO0FBRW5DLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMseUJBQTBHLFdBQVcsNkJBQTZCO0FBRTNKLFNBQVMsaUNBQWlDO0FBQzFDLFNBQTZCLDRCQUE0QjtBQUN6RCxTQUEwQix1QkFBdUI7QUFDakQsU0FBUywwQkFBMEIsd0NBQXdDO0FBQzNFLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsa0NBQWtDO0FBT3BDLElBQU0sb0JBQU4sY0FBZ0MsaUNBQWlDO0FBQUEsRUEwQ3ZFLFlBQ0MsTUFDQSxTQUNBLFNBQzBCLHlCQUNjLHNCQUNSLGNBQ08scUJBQ0YsbUJBQ0YsaUJBQ0osYUFDYywyQkFDTixxQkFDRyxlQUNFLDBCQUMzQztBQUNELFVBQU0sRUFBRSxZQUFZLEtBQUssVUFBVSxVQUFVLEtBQUssVUFBVSxNQUFNLEdBQUcsR0FBRyxTQUFTLHVCQUF1QjtBQVhoRTtBQUNSO0FBQ087QUFDRjtB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
