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
import { DataTransfers } from "../../base/browser/dnd.js";
import { DragAndDropObserver, EventType, addDisposableListener, onDidRegisterWindow } from "../../base/browser/dom.js";
import { coalesce } from "../../base/common/arrays.js";
import { UriList } from "../../base/common/dataTransfer.js";
import { Emitter, Event } from "../../base/common/event.js";
import { Disposable, DisposableStore, markAsSingleton } from "../../base/common/lifecycle.js";
import { stringify } from "../../base/common/marshalling.js";
import { Mimes } from "../../base/common/mime.js";
import { FileAccess, Schemas } from "../../base/common/network.js";
import { isWindows } from "../../base/common/platform.js";
import { basename, isEqual } from "../../base/common/resources.js";
import { URI } from "../../base/common/uri.js";
import { CodeDataTransfers, Extensions, LocalSelectionTransfer, createDraggedEditorInputFromRawResourcesData, extractEditorsAndFilesDropData } from "../../platform/dnd/browser/dnd.js";
import { IFileService } from "../../platform/files/common/files.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../platform/label/common/label.js";
import { extractSelection, withSelection } from "../../platform/opener/common/opener.js";
import { Registry } from "../../platform/registry/common/platform.js";
import { IWorkspaceContextService, hasWorkspaceFileExtension, isTemporaryWorkspace } from "../../platform/workspace/common/workspace.js";
import { IWorkspacesService } from "../../platform/workspaces/common/workspaces.js";
import { EditorResourceAccessor, isEditorIdentifier, isResourceDiffEditorInput, isResourceMergeEditorInput, isResourceSideBySideEditorInput } from "../common/editor.js";
import { IEditorService } from "../services/editor/common/editorService.js";
import { IHostService } from "../services/host/browser/host.js";
import { ITextFileService } from "../services/textfile/common/textfiles.js";
import { IWorkspaceEditingService } from "../services/workspaces/common/workspaceEditing.js";
import { mainWindow } from "../../base/browser/window.js";
import { BroadcastDataChannel } from "../../base/browser/broadcast.js";
class DraggedEditorIdentifier {
  constructor(identifier) {
    this.identifier = identifier;
  }
}
class DraggedEditorGroupIdentifier {
  constructor(identifier) {
    this.identifier = identifier;
  }
}
async function extractTreeDropData(dataTransfer) {
  const editors = [];
  const resourcesKey = Mimes.uriList.toLowerCase();
  if (dataTransfer.has(resourcesKey)) {
    try {
      const asString = await dataTransfer.get(resourcesKey)?.asString();
      const rawResourcesData = JSON.stringify(UriList.parse(asString ?? ""));
      editors.push(...createDraggedEditorInputFromRawResourcesData(rawResourcesData));
    } catch (error) {
    }
  }
  return editors;
}
let ResourcesDropHandler = class {
  constructor(options, fileService, workspacesService, editorService, workspaceEditingService, hostService, contextService, instantiationService) {
    this.options = options;
    this.fileService = fileService;
    this.workspacesService = workspacesService;
    this.editorService = editorService;
    this.workspaceEditingService = workspaceEditingService;
    this.hostService = hostService;
    this.contextService = contextService;
    this.instantiationService = instantiationService;
  }
  async handleDrop(event, targetWindow, resolveTargetGroup, afterDrop, options) {
    const editors = await this.instantiationService.invokeFunction((accessor) => extractEditorsAndFilesDropData(accessor, event));
    if (!editors.length) {
      return;
    }
    await this.hostService.focus(targetWindow);
    if (this.options.allowWorkspaceOpen) {
      const localFilesAllowedToOpenAsWorkspace = coalesce(editors.filter((editor) => editor.allowWorkspaceOpen && editor.resource?.scheme === Schemas.file).map((editor) => editor.resource));
      if (localFilesAllowedToOpenAsWorkspace.length > 0) {
        const isWorkspaceOpening = await this.handleWorkspaceDrop(localFilesAllowedToOpenAsWorkspace);
        if (isWorkspaceOpening) {
          return;
        }
      }
    }
    const externalLocalFiles = coalesce(editors.filter((editor) => editor.isExternal && editor.resource?.scheme === Schemas.file).map((editor) => editor.resource));
    if (externalLocalFiles.length) {
      this.workspacesService.addRecentlyOpened(externalLocalFiles.map((resource) => ({ fileUri: resource })));
    }
    const targetGroup = resolveTargetGroup?.();
    await this.editorService.openEditors(editors.map((editor) => ({
      ...editor,
      resource: editor.resource,
      options: {
        ...editor.options,
        ...options,
        pinned: true
      }
    })), targetGroup, { validateTrust: true });
    afterDrop?.(targetGroup);
  }
  async handleWorkspaceDrop(resources) {
    const toOpen = [];
    const folderURIs = [];
    await Promise.all(resources.map(async (resource) => {
      if (hasWorkspaceFileExtension(resource)) {
        toOpen.push({ workspaceUri: resource });
        return;
      }
      try {
        const stat = await this.fileService.stat(resource);
        if (stat.isDirectory) {
          toOpen.push({ folderUri: stat.resource });
          folderURIs.push({ uri: stat.resource });
        }
      } catch (error) {
      }
    }));
    if (toOpen.length === 0) {
      return false;
    }
    if (toOpen.length > folderURIs.length || folderURIs.length === 1) {
      await this.hostService.openWindow(toOpen);
    } else if (isTemporaryWorkspace(this.contextService.getWorkspace())) {
      await this.workspaceEditingService.addFolders(folderURIs);
    } else {
      await this.workspaceEditingService.createAndEnterWorkspace(folderURIs);
    }
    return true;
  }
};
ResourcesDropHandler = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, IWorkspacesService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IWorkspaceEditingService),
  __decorateParam(5, IHostService),
  __decorateParam(6, IWorkspaceContextService),
  __decorateParam(7, IInstantiationService)
], ResourcesDropHandler);
function fillEditorsDragData(accessor, resourcesOrEditors, event, options) {
  if (resourcesOrEditors.length === 0 || !event.dataTransfer) {
    return;
  }
  const textFileService = accessor.get(ITextFileService);
  const editorService = accessor.get(IEditorService);
  const fileService = accessor.get(IFileService);
  const labelService = accessor.get(ILabelService);
  const resources = coalesce(resourcesOrEditors.map((resourceOrEditor) => {
    if (URI.isUri(resourceOrEditor)) {
      return { resource: resourceOrEditor };
    }
    if (isEditorIdentifier(resourceOrEditor)) {
      if (URI.isUri(resourceOrEditor.editor.resource)) {
        return { resource: resourceOrEditor.editor.resource };
      }
      return void 0;
    }
    return { ...resourceOrEditor, resource: resourceOrEditor.selection ? withSelection(resourceOrEditor.resource, resourceOrEditor.selection) : resourceOrEditor.resource };
  }));
  const fileSystemResources = resources.filter(({ resource }) => fileService.hasProvider(resource));
  if (!options?.disableStandardTransfer) {
    const lineDelimiter = isWindows ? "\r\n" : "\n";
    event.dataTransfer.setData(DataTransfers.TEXT, fileSystemResources.map(({ resource }) => labelService.getUriLabel(resource, { noPrefix: true })).join(lineDelimiter));
    const firstFile = fileSystemResources.find(({ isDirectory }) => !isDirectory);
    if (firstFile) {
      const firstFileUri = FileAccess.uriToFileUri(firstFile.resource);
      if (firstFileUri.scheme === Schemas.file) {
        event.dataTransfer.setData(DataTransfers.DOWNLOAD_URL, [Mimes.binary, basename(firstFile.resource), firstFileUri.toString()].join(":"));
      }
    }
  }
  const files = fileSystemResources.filter(({ isDirectory }) => !isDirectory);
  if (files.length) {
    event.dataTransfer.setData(DataTransfers.RESOURCES, JSON.stringify(files.map(({ resource }) => resource.toString())));
  }
  const contributions = Registry.as(Extensions.DragAndDropContribution).getAll();
  for (const contribution of contributions) {
    contribution.setData(resources, event);
  }
  const draggedEditors = [];
  for (const resourceOrEditor of resourcesOrEditors) {
    let editor = void 0;
    if (isEditorIdentifier(resourceOrEditor)) {
      const untypedEditor = resourceOrEditor.editor.toUntyped({ preserveViewState: resourceOrEditor.groupId });
      if (untypedEditor) {
        editor = { ...untypedEditor, resource: EditorResourceAccessor.getCanonicalUri(untypedEditor) };
      }
    } else if (URI.isUri(resourceOrEditor)) {
      const { selection, uri } = extractSelection(resourceOrEditor);
      editor = { resource: uri, options: selection ? { selection } : void 0 };
    } else if (!resourceOrEditor.isDirectory) {
      editor = {
        resource: resourceOrEditor.resource,
        options: {
          selection: resourceOrEditor.selection
        }
      };
    }
    if (!editor) {
      continue;
    }
    {
      const resource = editor.resource;
      if (resource) {
        const textFileModel = textFileService.files.get(resource);
        if (textFileModel) {
          if (typeof editor.languageId !== "string") {
            editor.languageId = textFileModel.getLanguageId();
          }
          if (typeof editor.encoding !== "string") {
            editor.encoding = textFileModel.getEncoding();
          }
          if (typeof editor.contents !== "string" && textFileModel.isDirty() && !textFileModel.textEditorModel.isTooLargeForHeapOperation()) {
            editor.contents = textFileModel.textEditorModel.getValue();
          }
        }
        if (!editor.options?.viewState) {
          editor.options = {
            ...editor.options,
            viewState: (() => {
              for (const visibleEditorPane of editorService.visibleEditorPanes) {
                if (isEqual(visibleEditorPane.input.resource, resource)) {
                  const viewState = visibleEditorPane.getViewState();
                  if (viewState) {
                    return viewState;
                  }
                }
              }
              return void 0;
            })()
          };
        }
      }
    }
    draggedEditors.push(editor);
  }
  if (draggedEditors.length) {
    event.dataTransfer.setData(CodeDataTransfers.EDITORS, stringify(draggedEditors));
    const uriListEntries = [];
    for (const editor of draggedEditors) {
      if (editor.resource) {
        uriListEntries.push(editor.options?.selection ? withSelection(editor.resource, editor.options.selection) : editor.resource);
      } else if (isResourceDiffEditorInput(editor)) {
        if (editor.modified.resource) {
          uriListEntries.push(editor.modified.resource);
        }
      } else if (isResourceSideBySideEditorInput(editor)) {
        if (editor.primary.resource) {
          uriListEntries.push(editor.primary.resource);
        }
      } else if (isResourceMergeEditorInput(editor)) {
        uriListEntries.push(editor.result.resource);
      }
    }
    if (!options?.disableStandardTransfer) {
      event.dataTransfer.setData(Mimes.uriList, UriList.create(uriListEntries.slice(0, 1)));
    }
    event.dataTransfer.setData(DataTransfers.INTERNAL_URI_LIST, UriList.create(uriListEntries));
  }
}
class CompositeDragAndDropData {
  constructor(type, id) {
    this.type = type;
    this.id = id;
  }
  update(dataTransfer) {
  }
  getData() {
    return { type: this.type, id: this.id };
  }
}
class DraggedCompositeIdentifier {
  constructor(compositeId) {
    this.compositeId = compositeId;
  }
  get id() {
    return this.compositeId;
  }
}
class DraggedViewIdentifier {
  constructor(viewId) {
    this.viewId = viewId;
  }
  get id() {
    return this.viewId;
  }
}
class CompositeDragAndDropObserver extends Disposable {
  constructor() {
    super();
    this.transferData = LocalSelectionTransfer.getInstance();
    this.onDragStart = this._register(new Emitter());
    this.onDragEnd = this._register(new Emitter());
    this._register(this.onDragEnd.event((e) => {
      const id = e.dragAndDropData.getData().id;
      const type = e.dragAndDropData.getData().type;
      const data = this.readDragData(type);
      if (data?.getData().id === id) {
        this.transferData.clearData(type === "view" ? DraggedViewIdentifier.prototype : DraggedCompositeIdentifier.prototype);
      }
    }));
  }
  static get INSTANCE() {
    if (!CompositeDragAndDropObserver.instance) {
      CompositeDragAndDropObserver.instance = new CompositeDragAndDropObserver();
      markAsSingleton(CompositeDragAndDropObserver.instance);
    }
    return CompositeDragAndDropObserver.instance;
  }
  readDragData(type) {
    if (this.transferData.hasData(type === "view" ? DraggedViewIdentifier.prototype : DraggedCompositeIdentifier.prototype)) {
      const data = this.transferData.getData(type === "view" ? DraggedViewIdentifier.prototype : DraggedCompositeIdentifier.prototype);
      if (data && data[0]) {
        return new CompositeDragAndDropData(type, data[0].id);
      }
    }
    return void 0;
  }
  writeDragData(id, type) {
    this.transferData.setData([type === "view" ? new DraggedViewIdentifier(id) : new DraggedCompositeIdentifier(id)], type === "view" ? DraggedViewIdentifier.prototype : DraggedCompositeIdentifier.prototype);
  }
  registerTarget(element, callbacks) {
    const disposableStore = new DisposableStore();
    disposableStore.add(new DragAndDropObserver(element, {
      onDragEnter: (e) => {
        e.preventDefault();
        if (callbacks.onDragEnter) {
          const data = this.readDragData("composite") || this.readDragData("view");
          if (data) {
            callbacks.onDragEnter({ eventData: e, dragAndDropData: data });
          }
        }
      },
      onDragLeave: (e) => {
        const data = this.readDragData("composite") || this.readDragData("view");
        if (callbacks.onDragLeave && data) {
          callbacks.onDragLeave({ eventData: e, dragAndDropData: data });
        }
      },
      onDrop: (e) => {
        if (callbacks.onDrop) {
          const data = this.readDragData("composite") || this.readDragData("view");
          if (!data) {
            return;
          }
          callbacks.onDrop({ eventData: e, dragAndDropData: data });
          this.onDragEnd.fire({ eventData: e, dragAndDropData: data });
        }
      },
      onDragOver: (e) => {
        e.preventDefault();
        if (callbacks.onDragOver) {
          const data = this.readDragData("composite") || this.readDragData("view");
          if (!data) {
            return;
          }
          callbacks.onDragOver({ eventData: e, dragAndDropData: data });
        }
      }
    }));
    if (callbacks.onDragStart) {
      this.onDragStart.event((e) => {
        callbacks.onDragStart(e);
      }, this, disposableStore);
    }
    if (callbacks.onDragEnd) {
      this.onDragEnd.event((e) => {
        callbacks.onDragEnd(e);
      }, this, disposableStore);
    }
    return this._register(disposableStore);
  }
  registerDraggable(element, draggedItemProvider, callbacks) {
    element.draggable = true;
    const disposableStore = new DisposableStore();
    disposableStore.add(new DragAndDropObserver(element, {
      onDragStart: (e) => {
        const { id, type } = draggedItemProvider();
        this.writeDragData(id, type);
        e.dataTransfer?.setDragImage(element, 0, 0);
        this.onDragStart.fire({ eventData: e, dragAndDropData: this.readDragData(type) });
      },
      onDragEnd: (e) => {
        const { type } = draggedItemProvider();
        const data = this.readDragData(type);
        if (!data) {
          return;
        }
        this.onDragEnd.fire({ eventData: e, dragAndDropData: data });
      },
      onDragEnter: (e) => {
        if (callbacks.onDragEnter) {
          const data = this.readDragData("composite") || this.readDragData("view");
          if (!data) {
            return;
          }
          if (data) {
            callbacks.onDragEnter({ eventData: e, dragAndDropData: data });
          }
        }
      },
      onDragLeave: (e) => {
        const data = this.readDragData("composite") || this.readDragData("view");
        if (!data) {
          return;
        }
        callbacks.onDragLeave?.({ eventData: e, dragAndDropData: data });
      },
      onDrop: (e) => {
        if (callbacks.onDrop) {
          const data = this.readDragData("composite") || this.readDragData("view");
          if (!data) {
            return;
          }
          callbacks.onDrop({ eventData: e, dragAndDropData: data });
          this.onDragEnd.fire({ eventData: e, dragAndDropData: data });
        }
      },
      onDragOver: (e) => {
        if (callbacks.onDragOver) {
          const data = this.readDragData("composite") || this.readDragData("view");
          if (!data) {
            return;
          }
          callbacks.onDragOver({ eventData: e, dragAndDropData: data });
        }
      }
    }));
    if (callbacks.onDragStart) {
      this.onDragStart.event((e) => {
        callbacks.onDragStart(e);
      }, this, disposableStore);
    }
    if (callbacks.onDragEnd) {
      this.onDragEnd.event((e) => {
        callbacks.onDragEnd(e);
      }, this, disposableStore);
    }
    return this._register(disposableStore);
  }
}
function toggleDropEffect(dataTransfer, dropEffect, shouldHaveIt) {
  if (!dataTransfer) {
    return;
  }
  dataTransfer.dropEffect = shouldHaveIt ? dropEffect : "none";
}
let ResourceListDnDHandler = class {
  constructor(toResource, instantiationService) {
    this.toResource = toResource;
    this.instantiationService = instantiationService;
  }
  getDragURI(element) {
    const resource = this.toResource(element);
    return resource ? resource.toString() : null;
  }
  getDragLabel(elements) {
    const resources = coalesce(elements.map(this.toResource));
    return resources.length === 1 ? basename(resources[0]) : resources.length > 1 ? String(resources.length) : void 0;
  }
  onDragStart(data, originalEvent) {
    const resources = [];
    const elements = data.elements;
    for (const element of elements) {
      const resource = this.toResource(element);
      if (resource) {
        resources.push(resource);
      }
    }
    this.onWillDragElements(elements, originalEvent);
    if (resources.length) {
      this.instantiationService.invokeFunction((accessor) => fillEditorsDragData(accessor, resources, originalEvent));
    }
  }
  onWillDragElements(elements, originalEvent) {
  }
  onDragOver(data, targetElement, targetIndex, targetSector, originalEvent) {
    return false;
  }
  drop(data, targetElement, targetIndex, targetSector, originalEvent) {
  }
  dispose() {
  }
};
ResourceListDnDHandler = __decorateClass([
  __decorateParam(1, IInstantiationService)
], ResourceListDnDHandler);
const _GlobalWindowDraggedOverTracker = class _GlobalWindowDraggedOverTracker extends Disposable {
  constructor() {
    super();
    this.broadcaster = this._register(new BroadcastDataChannel(_GlobalWindowDraggedOverTracker.CHANNEL_NAME));
    this.draggedOver = false;
    this.registerListeners();
  }
  registerListeners() {
    this._register(Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => {
      disposables.add(addDisposableListener(window, EventType.DRAG_OVER, () => this.markDraggedOver(false), true));
      disposables.add(addDisposableListener(window, EventType.DRAG_LEAVE, () => this.clearDraggedOver(false), true));
    }, { window: mainWindow, disposables: this._store }));
    this._register(this.broadcaster.onDidReceiveData((data) => {
      if (data === true) {
        this.markDraggedOver(true);
      } else {
        this.clearDraggedOver(true);
      }
    }));
  }
  get isDraggedOver() {
    return this.draggedOver;
  }
  markDraggedOver(fromBroadcast) {
    if (this.draggedOver === true) {
      return;
    }
    this.draggedOver = true;
    if (!fromBroadcast) {
      this.broadcaster.postData(true);
    }
  }
  clearDraggedOver(fromBroadcast) {
    if (this.draggedOver === false) {
      return;
    }
    this.draggedOver = false;
    if (!fromBroadcast) {
      this.broadcaster.postData(false);
    }
  }
};
_GlobalWindowDraggedOverTracker.CHANNEL_NAME = "monaco-workbench-global-dragged-over";
let GlobalWindowDraggedOverTracker = _GlobalWindowDraggedOverTracker;
const globalDraggedOverTracker = new GlobalWindowDraggedOverTracker();
function isWindowDraggedOver() {
  return globalDraggedOverTracker.isDraggedOver;
}
export {
  CompositeDragAndDropData,
  CompositeDragAndDropObserver,
  DraggedCompositeIdentifier,
  DraggedEditorGroupIdentifier,
  DraggedEditorIdentifier,
  DraggedViewIdentifier,
  ResourceListDnDHandler,
  ResourcesDropHandler,
  extractTreeDropData,
  fillEditorsDragData,
  isWindowDraggedOver,
  toggleDropEffect
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9kbmQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEYXRhVHJhbnNmZXJzLCBJRHJhZ0FuZERyb3BEYXRhIH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyBEcmFnQW5kRHJvcE9ic2VydmVyLCBFdmVudFR5cGUsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgb25EaWRSZWdpc3RlcldpbmRvdyB9IGZyb20gJy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRHJhZ01vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBJTGlzdERyYWdBbmREcm9wIH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBFbGVtZW50c0RyYWdBbmREcm9wRGF0YSwgTGlzdFZpZXdUYXJnZXRTZWN0b3IgfSBmcm9tICcuLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0Vmlldy5qcyc7XG5pbXBvcnQgeyBJVHJlZURyYWdPdmVyUmVhY3Rpb24gfSBmcm9tICcuLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS90cmVlLmpzJztcbmltcG9ydCB7IGNvYWxlc2NlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IFVyaUxpc3QsIFZTRGF0YVRyYW5zZmVyIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vZGF0YVRyYW5zZmVyLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgbWFya0FzU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHN0cmluZ2lmeSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nLmpzJztcbmltcG9ydCB7IE1pbWVzIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbWltZS5qcyc7XG5pbXBvcnQgeyBGaWxlQWNjZXNzLCBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgaXNFcXVhbCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgQ29kZURhdGFUcmFuc2ZlcnMsIEV4dGVuc2lvbnMsIElEcmFnQW5kRHJvcENvbnRyaWJ1dGlvblJlZ2lzdHJ5LCBJRHJhZ2dlZFJlc291cmNlRWRpdG9ySW5wdXQsIElSZXNvdXJjZVN0YXQsIExvY2FsU2VsZWN0aW9uVHJhbnNmZXIsIGNyZWF0ZURyYWdnZWRFZGl0b3JJbnB1dEZyb21SYXdSZXNvdXJjZXNEYXRhLCBleHRyYWN0RWRpdG9yc0FuZEZpbGVzRHJvcERhdGEgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9kbmQvYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBleHRyYWN0U2VsZWN0aW9uLCB3aXRoU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVdpbmRvd09wZW5hYmxlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vd2luZG93L2NvbW1vbi93aW5kb3cuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBoYXNXb3Jrc3BhY2VGaWxlRXh0ZW5zaW9uLCBpc1RlbXBvcmFyeVdvcmtzcGFjZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VGb2xkZXJDcmVhdGlvbkRhdGEsIElXb3Jrc3BhY2VzU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZXMvY29tbW9uL3dvcmtzcGFjZXMuanMnO1xuaW1wb3J0IHsgRWRpdG9yUmVzb3VyY2VBY2Nlc3NvciwgR3JvdXBJZGVudGlmaWVyLCBJRWRpdG9ySWRlbnRpZmllciwgaXNFZGl0b3JJZGVudGlmaWVyLCBpc1Jlc291cmNlRGlmZkVkaXRvcklucHV0LCBpc1Jlc291cmNlTWVyZ2VFZGl0b3JJbnB1dCwgaXNSZXNvdXJjZVNpZGVCeVNpZGVFZGl0b3JJbnB1dCB9IGZyb20gJy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3VwIH0gZnJvbSAnLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IElUZXh0RmlsZVNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dGZpbGVzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VFZGl0aW5nU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL3dvcmtzcGFjZXMvY29tbW9uL3dvcmtzcGFjZUVkaXRpbmcuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBCcm9hZGNhc3REYXRhQ2hhbm5lbCB9IGZyb20gJy4uLy4uL2Jhc2UvYnJvd3Nlci9icm9hZGNhc3QuanMnO1xuXG4vLyNyZWdpb24gRWRpdG9yIC8gUmVzb3VyY2VzIERORFxuXG5leHBvcnQgY2xhc3MgRHJhZ2dlZEVkaXRvcklkZW50aWZpZXIge1xuXG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IGlkZW50aWZpZXI6IElFZGl0b3JJZGVudGlmaWVyKSB7IH1cbn1cblxuZXhwb3J0IGNsYXNzIERyYWdnZWRFZGl0b3JHcm91cElkZW50aWZpZXIge1xuXG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IGlkZW50aWZpZXI6IEdyb3VwSWRlbnRpZmllcikgeyB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleHRyYWN0VHJlZURyb3BEYXRhKGRhdGFUcmFuc2ZlcjogVlNEYXRhVHJhbnNmZXIpOiBQcm9taXNlPEFycmF5PElEcmFnZ2VkUmVzb3VyY2VFZGl0b3JJbnB1dD4+IHtcblx0Y29uc3QgZWRpdG9yczogSURyYWdnZWRSZXNvdXJjZUVkaXRvcklucHV0W10gPSBbXTtcblx0Y29uc3QgcmVzb3VyY2VzS2V5ID0gTWltZXMudXJpTGlzdC50b0xvd2VyQ2FzZSgpO1xuXG5cdC8vIERhdGEgVHJhbnNmZXI6IFJlc291cmNlc1xuXHRpZiAoZGF0YVRyYW5zZmVyLmhhcyhyZXNvdXJjZXNLZXkpKSB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGFzU3RyaW5nID0gYXdhaXQgZGF0YVRyYW5zZmVyLmdldChyZXNvdXJjZXNLZXkpPy5hc1N0cmluZygpO1xuXHRcdFx0Y29uc3QgcmF3UmVzb3VyY2VzRGF0YSA9IEpTT04uc3RyaW5naWZ5KFVyaUxpc3QucGFyc2UoYXNTdHJpbmcgPz8gJycpKTtcblx0XHRcdGVkaXRvcnMucHVzaCguLi5jcmVhdGVEcmFnZ2VkRWRpdG9ySW5wdXRGcm9tUmF3UmVzb3VyY2VzRGF0YShyYXdSZXNvdXJjZXNEYXRhKSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8vIEludmFsaWQgdHJhbnNmZXJcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gZWRpdG9ycztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUmVzb3VyY2VzRHJvcEhhbmRsZXJPcHRpb25zIHtcblxuXHQvKipcblx0ICogV2hldGhlciB3ZSBwcm9iZSBmb3IgdGhlIGRyb3BwZWQgcmVzb3VyY2UgdG8gYmUgYSB3b3Jrc3BhY2Vcblx0ICogKGkuZS4gY29kZS13b3Jrc3BhY2UgZmlsZSBvciBldmVuIGEgZm9sZGVyKSwgYWxsb3dpbmcgdG9cblx0ICogb3BlbiBpdCBhcyB3b3Jrc3BhY2UgaW5zdGVhZCBvZiBvcGVuaW5nIGFzIGVkaXRvci5cblx0ICovXG5cdHJlYWRvbmx5IGFsbG93V29ya3NwYWNlT3BlbjogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBTaGFyZWQgZnVuY3Rpb24gYWNyb3NzIHNvbWUgY29tcG9uZW50cyB0byBoYW5kbGUgZHJhZyAmIGRyb3Agb2YgcmVzb3VyY2VzLlxuICogRS5nLiBvZiBmb2xkZXJzIGFuZCB3b3Jrc3BhY2UgZmlsZXMgdG8gb3BlbiB0aGVtIGluIHRoZSB3aW5kb3cgaW5zdGVhZCBvZlxuICogdGhlIGVkaXRvciBvciB0byBoYW5kbGUgZGlydHkgZWRpdG9ycyBiZWluZyBkcm9wcGVkIGJldHdlZW4gaW5zdGFuY2VzIG9mIENvZGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZXNvdXJjZXNEcm9wSGFuZGxlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBvcHRpb25zOiBJUmVzb3VyY2VzRHJvcEhhbmRsZXJPcHRpb25zLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VzU2VydmljZTogSVdvcmtzcGFjZXNTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlRWRpdGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VFZGl0aW5nU2VydmljZTogSVdvcmtzcGFjZUVkaXRpbmdTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdCkge1xuXHR9XG5cblx0YXN5bmMgaGFuZGxlRHJvcChldmVudDogRHJhZ0V2ZW50LCB0YXJnZXRXaW5kb3c6IFdpbmRvdywgcmVzb2x2ZVRhcmdldEdyb3VwPzogKCkgPT4gSUVkaXRvckdyb3VwIHwgdW5kZWZpbmVkLCBhZnRlckRyb3A/OiAodGFyZ2V0R3JvdXA6IElFZGl0b3JHcm91cCB8IHVuZGVmaW5lZCkgPT4gdm9pZCwgb3B0aW9ucz86IElFZGl0b3JPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9ycyA9IGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gZXh0cmFjdEVkaXRvcnNBbmRGaWxlc0Ryb3BEYXRhKGFjY2Vzc29yLCBldmVudCkpO1xuXHRcdGlmICghZWRpdG9ycy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBNYWtlIHRoZSB3aW5kb3cgYWN0aXZlIHRvIGhhbmRsZSB0aGUgZHJvcCBwcm9wZXJseSB3aXRoaW5cblx0XHRhd2FpdCB0aGlzLmhvc3RTZXJ2aWNlLmZvY3VzKHRhcmdldFdpbmRvdyk7XG5cblx0XHQvLyBDaGVjayBmb3Igd29ya3NwYWNlIGZpbGUgLyBmb2xkZXIgYmVpbmcgZHJvcHBlZCBpZiB3ZSBhcmUgYWxsb3dlZCB0byBkbyBzb1xuXHRcdGlmICh0aGlzLm9wdGlvbnMuYWxsb3dXb3Jrc3BhY2VPcGVuKSB7XG5cdFx0XHRjb25zdCBsb2NhbEZpbGVzQWxsb3dlZFRvT3BlbkFzV29ya3NwYWNlID0gY29hbGVzY2UoZWRpdG9ycy5maWx0ZXIoZWRpdG9yID0+IGVkaXRvci5hbGxvd1dvcmtzcGFjZU9wZW4gJiYgZWRpdG9yLnJlc291cmNlPy5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkubWFwKGVkaXRvciA9PiBlZGl0b3IucmVzb3VyY2UpKTtcblx0XHRcdGlmIChsb2NhbEZpbGVzQWxsb3dlZFRvT3BlbkFzV29ya3NwYWNlLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Y29uc3QgaXNXb3Jrc3BhY2VPcGVuaW5nID0gYXdhaXQgdGhpcy5oYW5kbGVXb3Jrc3BhY2VEcm9wKGxvY2FsRmlsZXNBbGxvd2VkVG9PcGVuQXNXb3Jrc3BhY2UpO1xuXHRcdFx0XHRpZiAoaXNXb3Jrc3BhY2VPcGVuaW5nKSB7XG5cdFx0XHRcdFx0cmV0dXJuOyAvLyByZXR1cm4gZWFybHkgaWYgdGhlIGRyb3Agb3BlcmF0aW9uIHJlc3VsdGVkIGluIHRoaXMgd2luZG93IGNoYW5naW5nIHRvIGEgd29ya3NwYWNlXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBBZGQgZXh0ZXJuYWwgb25lcyB0byByZWNlbnRseSBvcGVuIGxpc3QgdW5sZXNzIGRyb3BwZWQgcmVzb3VyY2UgaXMgYSB3b3Jrc3BhY2Vcblx0XHRjb25zdCBleHRlcm5hbExvY2FsRmlsZXMgPSBjb2FsZXNjZShlZGl0b3JzLmZpbHRlcihlZGl0b3IgPT4gZWRpdG9yLmlzRXh0ZXJuYWwgJiYgZWRpdG9yLnJlc291cmNlPy5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkubWFwKGVkaXRvciA9PiBlZGl0b3IucmVzb3VyY2UpKTtcblx0XHRpZiAoZXh0ZXJuYWxMb2NhbEZpbGVzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy53b3Jrc3BhY2VzU2VydmljZS5hZGRSZWNlbnRseU9wZW5lZChleHRlcm5hbExvY2FsRmlsZXMubWFwKHJlc291cmNlID0+ICh7IGZpbGVVcmk6IHJlc291cmNlIH0pKSk7XG5cdFx0fVxuXG5cdFx0Ly8gT3BlbiBpbiBFZGl0b3Jcblx0XHRjb25zdCB0YXJnZXRHcm91cCA9IHJlc29sdmVUYXJnZXRHcm91cD8uKCk7XG5cdFx0YXdhaXQgdGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3JzKGVkaXRvcnMubWFwKGVkaXRvciA9PiAoe1xuXHRcdFx0Li4uZWRpdG9yLFxuXHRcdFx0cmVzb3VyY2U6IGVkaXRvci5yZXNvdXJjZSxcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0Li4uZWRpdG9yLm9wdGlvbnMsXG5cdFx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRcdHBpbm5lZDogdHJ1ZVxuXHRcdFx0fVxuXHRcdH0pKSwgdGFyZ2V0R3JvdXAsIHsgdmFsaWRhdGVUcnVzdDogdHJ1ZSB9KTtcblxuXHRcdC8vIEZpbmlzaCB3aXRoIHByb3ZpZGVkIGZ1bmN0aW9uXG5cdFx0YWZ0ZXJEcm9wPy4odGFyZ2V0R3JvdXApO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVXb3Jrc3BhY2VEcm9wKHJlc291cmNlczogVVJJW10pOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCB0b09wZW46IElXaW5kb3dPcGVuYWJsZVtdID0gW107XG5cdFx0Y29uc3QgZm9sZGVyVVJJczogSVdvcmtzcGFjZUZvbGRlckNyZWF0aW9uRGF0YVtdID0gW107XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbChyZXNvdXJjZXMubWFwKGFzeW5jIHJlc291cmNlID0+IHtcblxuXHRcdFx0Ly8gQ2hlY2sgZm9yIFdvcmtzcGFjZVxuXHRcdFx0aWYgKGhhc1dvcmtzcGFjZUZpbGVFeHRlbnNpb24ocmVzb3VyY2UpKSB7XG5cdFx0XHRcdHRvT3Blbi5wdXNoKHsgd29ya3NwYWNlVXJpOiByZXNvdXJjZSB9KTtcblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIENoZWNrIGZvciBGb2xkZXJcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHN0YXQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnN0YXQocmVzb3VyY2UpO1xuXHRcdFx0XHRpZiAoc3RhdC5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRcdHRvT3Blbi5wdXNoKHsgZm9sZGVyVXJpOiBzdGF0LnJlc291cmNlIH0pO1xuXHRcdFx0XHRcdGZvbGRlclVSSXMucHVzaCh7IHVyaTogc3RhdC5yZXNvdXJjZSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0Ly8gSWdub3JlIGVycm9yXG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gUmV0dXJuIGVhcmx5IGlmIG5vIGV4dGVybmFsIHJlc291cmNlIGlzIGEgZm9sZGVyIG9yIHdvcmtzcGFjZVxuXHRcdGlmICh0b09wZW4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gT3BlbiBpbiBzZXBhcmF0ZSB3aW5kb3dzIGlmIHdlIGRyb3Agd29ya3NwYWNlcyBvciBqdXN0IG9uZSBmb2xkZXJcblx0XHRpZiAodG9PcGVuLmxlbmd0aCA+IGZvbGRlclVSSXMubGVuZ3RoIHx8IGZvbGRlclVSSXMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmhvc3RTZXJ2aWNlLm9wZW5XaW5kb3codG9PcGVuKTtcblx0XHR9XG5cblx0XHQvLyBBZGQgdG8gd29ya3NwYWNlIGlmIHdlIGFyZSBpbiBhIHRlbXBvcmFyeSB3b3Jrc3BhY2Vcblx0XHRlbHNlIGlmIChpc1RlbXBvcmFyeVdvcmtzcGFjZSh0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpKSkge1xuXHRcdFx0YXdhaXQgdGhpcy53b3Jrc3BhY2VFZGl0aW5nU2VydmljZS5hZGRGb2xkZXJzKGZvbGRlclVSSXMpO1xuXHRcdH1cblxuXHRcdC8vIEZpbmFsbHksIGVudGVyIHVudGl0bGVkIHdvcmtzcGFjZSB3aGVuIGRyb3BwaW5nID4xIGZvbGRlcnNcblx0XHRlbHNlIHtcblx0XHRcdGF3YWl0IHRoaXMud29ya3NwYWNlRWRpdGluZ1NlcnZpY2UuY3JlYXRlQW5kRW50ZXJXb3Jrc3BhY2UoZm9sZGVyVVJJcyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbGxFZGl0b3JzRHJhZ0RhdGEoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHJlc291cmNlczogVVJJW10sIGV2ZW50OiBEcmFnTW91c2VFdmVudCB8IERyYWdFdmVudCwgb3B0aW9ucz86IHsgZGlzYWJsZVN0YW5kYXJkVHJhbnNmZXI6IGJvb2xlYW4gfSk6IHZvaWQ7XG5leHBvcnQgZnVuY3Rpb24gZmlsbEVkaXRvcnNEcmFnRGF0YShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgcmVzb3VyY2VzOiBJUmVzb3VyY2VTdGF0W10sIGV2ZW50OiBEcmFnTW91c2VFdmVudCB8IERyYWdFdmVudCwgb3B0aW9ucz86IHsgZGlzYWJsZVN0YW5kYXJkVHJhbnNmZXI6IGJvb2xlYW4gfSk6IHZvaWQ7XG5leHBvcnQgZnVuY3Rpb24gZmlsbEVkaXRvcnNEcmFnRGF0YShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yczogSUVkaXRvcklkZW50aWZpZXJbXSwgZXZlbnQ6IERyYWdNb3VzZUV2ZW50IHwgRHJhZ0V2ZW50LCBvcHRpb25zPzogeyBkaXNhYmxlU3RhbmRhcmRUcmFuc2ZlcjogYm9vbGVhbiB9KTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiBmaWxsRWRpdG9yc0RyYWdEYXRhKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCByZXNvdXJjZXNPckVkaXRvcnM6IEFycmF5PFVSSSB8IElSZXNvdXJjZVN0YXQgfCBJRWRpdG9ySWRlbnRpZmllcj4sIGV2ZW50OiBEcmFnTW91c2VFdmVudCB8IERyYWdFdmVudCwgb3B0aW9ucz86IHsgZGlzYWJsZVN0YW5kYXJkVHJhbnNmZXI6IGJvb2xlYW4gfSk6IHZvaWQge1xuXHRpZiAocmVzb3VyY2VzT3JFZGl0b3JzLmxlbmd0aCA9PT0gMCB8fCAhZXZlbnQuZGF0YVRyYW5zZmVyKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgdGV4dEZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZXh0RmlsZVNlcnZpY2UpO1xuXHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0Y29uc3QgZmlsZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0Y29uc3QgbGFiZWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYWJlbFNlcnZpY2UpO1xuXG5cdC8vIEV4dHJhY3QgcmVzb3VyY2VzIGZyb20gVVJJcyBvciBFZGl0b3JzIHRoYXRcblx0Ly8gY2FuIGJlIGhhbmRsZWQgYnkgdGhlIGZpbGUgc2VydmljZVxuXHRjb25zdCByZXNvdXJjZXMgPSBjb2FsZXNjZShyZXNvdXJjZXNPckVkaXRvcnMubWFwKChyZXNvdXJjZU9yRWRpdG9yKTogSVJlc291cmNlU3RhdCB8IHVuZGVmaW5lZCA9PiB7XG5cdFx0aWYgKFVSSS5pc1VyaShyZXNvdXJjZU9yRWRpdG9yKSkge1xuXHRcdFx0cmV0dXJuIHsgcmVzb3VyY2U6IHJlc291cmNlT3JFZGl0b3IgfTtcblx0XHR9XG5cblx0XHRpZiAoaXNFZGl0b3JJZGVudGlmaWVyKHJlc291cmNlT3JFZGl0b3IpKSB7XG5cdFx0XHRpZiAoVVJJLmlzVXJpKHJlc291cmNlT3JFZGl0b3IuZWRpdG9yLnJlc291cmNlKSkge1xuXHRcdFx0XHRyZXR1cm4geyByZXNvdXJjZTogcmVzb3VyY2VPckVkaXRvci5lZGl0b3IucmVzb3VyY2UgfTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDsgLy8gZWRpdG9yIHdpdGhvdXQgcmVzb3VyY2Vcblx0XHR9XG5cblx0XHRyZXR1cm4geyAuLi5yZXNvdXJjZU9yRWRpdG9yLCByZXNvdXJjZTogcmVzb3VyY2VPckVkaXRvci5zZWxlY3Rpb24gPyB3aXRoU2VsZWN0aW9uKHJlc291cmNlT3JFZGl0b3IucmVzb3VyY2UsIHJlc291cmNlT3JFZGl0b3Iuc2VsZWN0aW9uKSA6IHJlc291cmNlT3JFZGl0b3IucmVzb3VyY2UgfTtcblx0fSkpO1xuXG5cdGNvbnN0IGZpbGVTeXN0ZW1SZXNvdXJjZXMgPSByZXNvdXJjZXMuZmlsdGVyKCh7IHJlc291cmNlIH0pID0+IGZpbGVTZXJ2aWNlLmhhc1Byb3ZpZGVyKHJlc291cmNlKSk7XG5cdGlmICghb3B0aW9ucz8uZGlzYWJsZVN0YW5kYXJkVHJhbnNmZXIpIHtcblxuXHRcdC8vIFRleHQ6IGFsbG93cyB0byBwYXN0ZSBpbnRvIHRleHQtY2FwYWJsZSBhcmVhc1xuXHRcdGNvbnN0IGxpbmVEZWxpbWl0ZXIgPSBpc1dpbmRvd3MgPyAnXFxyXFxuJyA6ICdcXG4nO1xuXHRcdGV2ZW50LmRhdGFUcmFuc2Zlci5zZXREYXRhKERhdGFUcmFuc2ZlcnMuVEVYVCwgZmlsZVN5c3RlbVJlc291cmNlcy5tYXAoKHsgcmVzb3VyY2UgfSkgPT4gbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHJlc291cmNlLCB7IG5vUHJlZml4OiB0cnVlIH0pKS5qb2luKGxpbmVEZWxpbWl0ZXIpKTtcblxuXHRcdC8vIERvd25sb2FkIFVSTDogZW5hYmxlcyBzdXBwb3J0IHRvIGRyYWcgYSB0YWIgYXMgZmlsZSB0byBkZXNrdG9wXG5cdFx0Ly8gUmVxdWlyZW1lbnRzOlxuXHRcdC8vIC0gQ2hyb21lL0VkZ2Ugb25seVxuXHRcdC8vIC0gb25seSBhIHNpbmdsZSBmaWxlIGlzIHN1cHBvcnRlZFxuXHRcdC8vIC0gb25seSBmaWxlOi8gcmVzb3VyY2VzIGFyZSBzdXBwb3J0ZWRcblx0XHRjb25zdCBmaXJzdEZpbGUgPSBmaWxlU3lzdGVtUmVzb3VyY2VzLmZpbmQoKHsgaXNEaXJlY3RvcnkgfSkgPT4gIWlzRGlyZWN0b3J5KTtcblx0XHRpZiAoZmlyc3RGaWxlKSB7XG5cdFx0XHRjb25zdCBmaXJzdEZpbGVVcmkgPSBGaWxlQWNjZXNzLnVyaVRvRmlsZVVyaShmaXJzdEZpbGUucmVzb3VyY2UpOyAvLyBlbmZvcmNlIGBmaWxlOmAgVVJJc1xuXHRcdFx0aWYgKGZpcnN0RmlsZVVyaS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0XHRldmVudC5kYXRhVHJhbnNmZXIuc2V0RGF0YShEYXRhVHJhbnNmZXJzLkRPV05MT0FEX1VSTCwgW01pbWVzLmJpbmFyeSwgYmFzZW5hbWUoZmlyc3RGaWxlLnJlc291cmNlKSwgZmlyc3RGaWxlVXJpLnRvU3RyaW5nKCldLmpvaW4oJzonKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gUmVzb3VyY2UgVVJMczogYWxsb3dzIHRvIGRyb3AgbXVsdGlwbGUgZmlsZSByZXNvdXJjZXMgdG8gYSB0YXJnZXQgaW4gVlMgQ29kZVxuXHRjb25zdCBmaWxlcyA9IGZpbGVTeXN0ZW1SZXNvdXJjZXMuZmlsdGVyKCh7IGlzRGlyZWN0b3J5IH0pID0+ICFpc0RpcmVjdG9yeSk7XG5cdGlmIChmaWxlcy5sZW5ndGgpIHtcblx0XHRldmVudC5kYXRhVHJhbnNmZXIuc2V0RGF0YShEYXRhVHJhbnNmZXJzLlJFU09VUkNFUywgSlNPTi5zdHJpbmdpZnkoZmlsZXMubWFwKCh7IHJlc291cmNlIH0pID0+IHJlc291cmNlLnRvU3RyaW5nKCkpKSk7XG5cdH1cblxuXHQvLyBDb250cmlidXRpb25zXG5cdGNvbnN0IGNvbnRyaWJ1dGlvbnMgPSBSZWdpc3RyeS5hczxJRHJhZ0FuZERyb3BDb250cmlidXRpb25SZWdpc3RyeT4oRXh0ZW5zaW9ucy5EcmFnQW5kRHJvcENvbnRyaWJ1dGlvbikuZ2V0QWxsKCk7XG5cdGZvciAoY29uc3QgY29udHJpYnV0aW9uIG9mIGNvbnRyaWJ1dGlvbnMpIHtcblx0XHRjb250cmlidXRpb24uc2V0RGF0YShyZXNvdXJjZXMsIGV2ZW50KTtcblx0fVxuXG5cdC8vIEVkaXRvcnM6IGVuYWJsZXMgY3Jvc3Mgd2luZG93IERORCBvZiBlZGl0b3JzXG5cdC8vIGludG8gdGhlIGVkaXRvciBhcmVhIHdoaWxlIHByZXNlcmluZyBVSSBzdGF0ZVxuXHRjb25zdCBkcmFnZ2VkRWRpdG9yczogSURyYWdnZWRSZXNvdXJjZUVkaXRvcklucHV0W10gPSBbXTtcblxuXHRmb3IgKGNvbnN0IHJlc291cmNlT3JFZGl0b3Igb2YgcmVzb3VyY2VzT3JFZGl0b3JzKSB7XG5cblx0XHQvLyBFeHRyYWN0IHJlc291cmNlIGVkaXRvciBmcm9tIHByb3ZpZGVkIG9iamVjdCBvciBVUklcblx0XHRsZXQgZWRpdG9yOiBJRHJhZ2dlZFJlc291cmNlRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGlzRWRpdG9ySWRlbnRpZmllcihyZXNvdXJjZU9yRWRpdG9yKSkge1xuXHRcdFx0Y29uc3QgdW50eXBlZEVkaXRvciA9IHJlc291cmNlT3JFZGl0b3IuZWRpdG9yLnRvVW50eXBlZCh7IHByZXNlcnZlVmlld1N0YXRlOiByZXNvdXJjZU9yRWRpdG9yLmdyb3VwSWQgfSk7XG5cdFx0XHRpZiAodW50eXBlZEVkaXRvcikge1xuXHRcdFx0XHRlZGl0b3IgPSB7IC4uLnVudHlwZWRFZGl0b3IsIHJlc291cmNlOiBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldENhbm9uaWNhbFVyaSh1bnR5cGVkRWRpdG9yKSB9O1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoVVJJLmlzVXJpKHJlc291cmNlT3JFZGl0b3IpKSB7XG5cdFx0XHRjb25zdCB7IHNlbGVjdGlvbiwgdXJpIH0gPSBleHRyYWN0U2VsZWN0aW9uKHJlc291cmNlT3JFZGl0b3IpO1xuXHRcdFx0ZWRpdG9yID0geyByZXNvdXJjZTogdXJpLCBvcHRpb25zOiBzZWxlY3Rpb24gPyB7IHNlbGVjdGlvbiB9IDogdW5kZWZpbmVkIH07XG5cdFx0fSBlbHNlIGlmICghcmVzb3VyY2VPckVkaXRvci5pc0RpcmVjdG9yeSkge1xuXHRcdFx0ZWRpdG9yID0ge1xuXHRcdFx0XHRyZXNvdXJjZTogcmVzb3VyY2VPckVkaXRvci5yZXNvdXJjZSxcblx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdHNlbGVjdGlvbjogcmVzb3VyY2VPckVkaXRvci5zZWxlY3Rpb24sXG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKCFlZGl0b3IpIHtcblx0XHRcdGNvbnRpbnVlOyAvLyBza2lwIG92ZXIgZWRpdG9ycyB0aGF0IGNhbm5vdCBiZSB0cmFuc2ZlcnJlZCB2aWEgZG5kXG5cdFx0fVxuXG5cdFx0Ly8gRmlsbCBpbiBzb21lIHByb3BlcnRpZXMgaWYgdGhleSBhcmUgbm90IHRoZXJlIGFscmVhZHkgYnkgYWNjZXNzaW5nXG5cdFx0Ly8gc29tZSB3ZWxsIGtub3duIHRoaW5ncyBmcm9tIHRoZSB0ZXh0IGZpbGUgdW5pdmVyc2UuXG5cdFx0Ly8gVGhpcyBpcyBub3QgaWRlYWwgZm9yIGN1c3RvbSBlZGl0b3JzLCBidXQgdGhvc2UgaGF2ZSBhIGNoYW5jZSB0b1xuXHRcdC8vIHByb3ZpZGUgZXZlcnl0aGluZyBmcm9tIHRoZSBgdG9VbnR5cGVkYCBtZXRob2QuXG5cdFx0e1xuXHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBlZGl0b3IucmVzb3VyY2U7XG5cdFx0XHRpZiAocmVzb3VyY2UpIHtcblx0XHRcdFx0Y29uc3QgdGV4dEZpbGVNb2RlbCA9IHRleHRGaWxlU2VydmljZS5maWxlcy5nZXQocmVzb3VyY2UpO1xuXHRcdFx0XHRpZiAodGV4dEZpbGVNb2RlbCkge1xuXG5cdFx0XHRcdFx0Ly8gbGFuZ3VhZ2Vcblx0XHRcdFx0XHRpZiAodHlwZW9mIGVkaXRvci5sYW5ndWFnZUlkICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0ZWRpdG9yLmxhbmd1YWdlSWQgPSB0ZXh0RmlsZU1vZGVsLmdldExhbmd1YWdlSWQoKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBlbmNvZGluZ1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgZWRpdG9yLmVuY29kaW5nICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0ZWRpdG9yLmVuY29kaW5nID0gdGV4dEZpbGVNb2RlbC5nZXRFbmNvZGluZygpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIGNvbnRlbnRzIChvbmx5IGlmIGRpcnR5IGFuZCBub3QgdG9vIGxhcmdlKVxuXHRcdFx0XHRcdGlmICh0eXBlb2YgZWRpdG9yLmNvbnRlbnRzICE9PSAnc3RyaW5nJyAmJiB0ZXh0RmlsZU1vZGVsLmlzRGlydHkoKSAmJiAhdGV4dEZpbGVNb2RlbC50ZXh0RWRpdG9yTW9kZWwuaXNUb29MYXJnZUZvckhlYXBPcGVyYXRpb24oKSkge1xuXHRcdFx0XHRcdFx0ZWRpdG9yLmNvbnRlbnRzID0gdGV4dEZpbGVNb2RlbC50ZXh0RWRpdG9yTW9kZWwuZ2V0VmFsdWUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyB2aWV3U3RhdGVcblx0XHRcdFx0aWYgKCFlZGl0b3Iub3B0aW9ucz8udmlld1N0YXRlKSB7XG5cdFx0XHRcdFx0ZWRpdG9yLm9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0XHQuLi5lZGl0b3Iub3B0aW9ucyxcblx0XHRcdFx0XHRcdHZpZXdTdGF0ZTogKCgpID0+IHtcblx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCB2aXNpYmxlRWRpdG9yUGFuZSBvZiBlZGl0b3JTZXJ2aWNlLnZpc2libGVFZGl0b3JQYW5lcykge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChpc0VxdWFsKHZpc2libGVFZGl0b3JQYW5lLmlucHV0LnJlc291cmNlLCByZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IHZpZXdTdGF0ZSA9IHZpc2libGVFZGl0b3JQYW5lLmdldFZpZXdTdGF0ZSgpO1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKHZpZXdTdGF0ZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdmlld1N0YXRlO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHR9KSgpXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEFkZCBhcyBkcmFnZ2VkIGVkaXRvclxuXHRcdGRyYWdnZWRFZGl0b3JzLnB1c2goZWRpdG9yKTtcblx0fVxuXG5cdGlmIChkcmFnZ2VkRWRpdG9ycy5sZW5ndGgpIHtcblx0XHRldmVudC5kYXRhVHJhbnNmZXIuc2V0RGF0YShDb2RlRGF0YVRyYW5zZmVycy5FRElUT1JTLCBzdHJpbmdpZnkoZHJhZ2dlZEVkaXRvcnMpKTtcblxuXHRcdC8vIEFkZCBhIFVSSSBsaXN0IGVudHJ5XG5cdFx0Y29uc3QgdXJpTGlzdEVudHJpZXM6IFVSSVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgZHJhZ2dlZEVkaXRvcnMpIHtcblx0XHRcdGlmIChlZGl0b3IucmVzb3VyY2UpIHtcblx0XHRcdFx0dXJpTGlzdEVudHJpZXMucHVzaChlZGl0b3Iub3B0aW9ucz8uc2VsZWN0aW9uID8gd2l0aFNlbGVjdGlvbihlZGl0b3IucmVzb3VyY2UsIGVkaXRvci5vcHRpb25zLnNlbGVjdGlvbikgOiBlZGl0b3IucmVzb3VyY2UpO1xuXHRcdFx0fSBlbHNlIGlmIChpc1Jlc291cmNlRGlmZkVkaXRvcklucHV0KGVkaXRvcikpIHtcblx0XHRcdFx0aWYgKGVkaXRvci5tb2RpZmllZC5yZXNvdXJjZSkge1xuXHRcdFx0XHRcdHVyaUxpc3RFbnRyaWVzLnB1c2goZWRpdG9yLm1vZGlmaWVkLnJlc291cmNlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChpc1Jlc291cmNlU2lkZUJ5U2lkZUVkaXRvcklucHV0KGVkaXRvcikpIHtcblx0XHRcdFx0aWYgKGVkaXRvci5wcmltYXJ5LnJlc291cmNlKSB7XG5cdFx0XHRcdFx0dXJpTGlzdEVudHJpZXMucHVzaChlZGl0b3IucHJpbWFyeS5yZXNvdXJjZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoaXNSZXNvdXJjZU1lcmdlRWRpdG9ySW5wdXQoZWRpdG9yKSkge1xuXHRcdFx0XHR1cmlMaXN0RW50cmllcy5wdXNoKGVkaXRvci5yZXN1bHQucmVzb3VyY2UpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIER1ZSB0byBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD0yMzk3NDUsIHdlIGNhbiBvbmx5IHNldFxuXHRcdC8vIGEgc2luZ2xlIHVyaSBmb3IgdGhlIHJlYWwgYHRleHQvdXJpLWxpc3RgIHR5cGUuIE90aGVyd2lzZSBhbGwgdXJpcyBlbmQgdXAgam9pbmVkIHRvZ2V0aGVyXG5cdFx0Ly8gSG93ZXZlciB3ZSB3cml0ZSB0aGUgZnVsbCB1cmktbGlzdCB0byBhbiBpbnRlcm5hbCB0eXBlIHNvIHRoYXQgb3RoZXIgcGFydHMgb2YgVlMgQ29kZVxuXHRcdC8vIGNhbiB1c2UgdGhlIGZ1bGwgbGlzdC5cblx0XHRpZiAoIW9wdGlvbnM/LmRpc2FibGVTdGFuZGFyZFRyYW5zZmVyKSB7XG5cdFx0XHRldmVudC5kYXRhVHJhbnNmZXIuc2V0RGF0YShNaW1lcy51cmlMaXN0LCBVcmlMaXN0LmNyZWF0ZSh1cmlMaXN0RW50cmllcy5zbGljZSgwLCAxKSkpO1xuXHRcdH1cblx0XHRldmVudC5kYXRhVHJhbnNmZXIuc2V0RGF0YShEYXRhVHJhbnNmZXJzLklOVEVSTkFMX1VSSV9MSVNULCBVcmlMaXN0LmNyZWF0ZSh1cmlMaXN0RW50cmllcykpO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gQ29tcG9zaXRlcyBETkRcblxuZXhwb3J0IHR5cGUgQmVmb3JlMkQgPSB7XG5cdHJlYWRvbmx5IHZlcnRpY2FsbHlCZWZvcmU6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGhvcml6b250YWxseUJlZm9yZTogYm9vbGVhbjtcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbXBvc2l0ZURyYWdBbmREcm9wIHtcblx0ZHJvcChkYXRhOiBJRHJhZ0FuZERyb3BEYXRhLCB0YXJnZXQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50LCBiZWZvcmU/OiBCZWZvcmUyRCk6IHZvaWQ7XG5cdG9uRHJhZ092ZXIoZGF0YTogSURyYWdBbmREcm9wRGF0YSwgdGFyZ2V0OiBzdHJpbmcgfCB1bmRlZmluZWQsIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IGJvb2xlYW47XG5cdG9uRHJhZ0VudGVyKGRhdGE6IElEcmFnQW5kRHJvcERhdGEsIHRhcmdldDogc3RyaW5nIHwgdW5kZWZpbmVkLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb21wb3NpdGVEcmFnQW5kRHJvcE9ic2VydmVyQ2FsbGJhY2tzIHtcblx0b25EcmFnRW50ZXI/OiAoZTogSURyYWdnZWRDb21wb3NpdGVEYXRhKSA9PiB2b2lkO1xuXHRvbkRyYWdMZWF2ZT86IChlOiBJRHJhZ2dlZENvbXBvc2l0ZURhdGEpID0+IHZvaWQ7XG5cdG9uRHJvcD86IChlOiBJRHJhZ2dlZENvbXBvc2l0ZURhdGEpID0+IHZvaWQ7XG5cdG9uRHJhZ092ZXI/OiAoZTogSURyYWdnZWRDb21wb3NpdGVEYXRhKSA9PiB2b2lkO1xuXHRvbkRyYWdTdGFydD86IChlOiBJRHJhZ2dlZENvbXBvc2l0ZURhdGEpID0+IHZvaWQ7XG5cdG9uRHJhZ0VuZD86IChlOiBJRHJhZ2dlZENvbXBvc2l0ZURhdGEpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBDb21wb3NpdGVEcmFnQW5kRHJvcERhdGEgaW1wbGVtZW50cyBJRHJhZ0FuZERyb3BEYXRhIHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHR5cGU6ICd2aWV3JyB8ICdjb21wb3NpdGUnLCBwcml2YXRlIGlkOiBzdHJpbmcpIHsgfVxuXG5cdHVwZGF0ZShkYXRhVHJhbnNmZXI6IERhdGFUcmFuc2Zlcik6IHZvaWQge1xuXHRcdC8vIG5vLW9wXG5cdH1cblxuXHRnZXREYXRhKCk6IHtcblx0XHR0eXBlOiAndmlldycgfCAnY29tcG9zaXRlJztcblx0XHRpZDogc3RyaW5nO1xuXHR9IHtcblx0XHRyZXR1cm4geyB0eXBlOiB0aGlzLnR5cGUsIGlkOiB0aGlzLmlkIH07XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRHJhZ2dlZENvbXBvc2l0ZURhdGEge1xuXHRyZWFkb25seSBldmVudERhdGE6IERyYWdFdmVudDtcblx0cmVhZG9ubHkgZHJhZ0FuZERyb3BEYXRhOiBDb21wb3NpdGVEcmFnQW5kRHJvcERhdGE7XG59XG5cbmV4cG9ydCBjbGFzcyBEcmFnZ2VkQ29tcG9zaXRlSWRlbnRpZmllciB7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBjb21wb3NpdGVJZDogc3RyaW5nKSB7IH1cblxuXHRnZXQgaWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5jb21wb3NpdGVJZDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRHJhZ2dlZFZpZXdJZGVudGlmaWVyIHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHZpZXdJZDogc3RyaW5nKSB7IH1cblxuXHRnZXQgaWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3SWQ7XG5cdH1cbn1cblxuZXhwb3J0IHR5cGUgVmlld1R5cGUgPSAnY29tcG9zaXRlJyB8ICd2aWV3JztcblxuZXhwb3J0IGNsYXNzIENvbXBvc2l0ZURyYWdBbmREcm9wT2JzZXJ2ZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHN0YXRpYyBpbnN0YW5jZTogQ29tcG9zaXRlRHJhZ0FuZERyb3BPYnNlcnZlciB8IHVuZGVmaW5lZDtcblxuXHRzdGF0aWMgZ2V0IElOU1RBTkNFKCk6IENvbXBvc2l0ZURyYWdBbmREcm9wT2JzZXJ2ZXIge1xuXHRcdGlmICghQ29tcG9zaXRlRHJhZ0FuZERyb3BPYnNlcnZlci5pbnN0YW5jZSkge1xuXHRcdFx0Q29tcG9zaXRlRHJhZ0FuZERyb3BPYnNlcnZlci5pbnN0YW5jZSA9IG5ldyBDb21wb3NpdGVEcmFnQW5kRHJvcE9ic2VydmVyKCk7XG5cdFx0XHRtYXJrQXNTaW5nbGV0b24oQ29tcG9zaXRlRHJhZ0FuZERyb3BPYnNlcnZlci5pbnN0YW5jZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIENvbXBvc2l0ZURyYWdBbmREcm9wT2JzZXJ2ZXIuaW5zdGFuY2U7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IHRyYW5zZmVyRGF0YSA9IExvY2FsU2VsZWN0aW9uVHJhbnNmZXIuZ2V0SW5zdGFuY2U8RHJhZ2dlZENvbXBvc2l0ZUlkZW50aWZpZXIgfCBEcmFnZ2VkVmlld0lkZW50aWZpZXI+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBvbkRyYWdTdGFydCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElEcmFnZ2VkQ29tcG9zaXRlRGF0YT4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgb25EcmFnRW5kID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SURyYWdnZWRDb21wb3NpdGVEYXRhPigpKTtcblxuXHRwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRHJhZ0VuZC5ldmVudChlID0+IHtcblx0XHRcdGNvbnN0IGlkID0gZS5kcmFnQW5kRHJvcERhdGEuZ2V0RGF0YSgpLmlkO1xuXHRcdFx0Y29uc3QgdHlwZSA9IGUuZHJhZ0FuZERyb3BEYXRhLmdldERhdGEoKS50eXBlO1xuXHRcdFx0Y29uc3QgZGF0YSA9IHRoaXMucmVhZERyYWdEYXRhKHR5cGUpO1xuXHRcdFx0aWYgKGRhdGE/LmdldERhdGEoKS5pZCA9PT0gaWQpIHtcblx0XHRcdFx0dGhpcy50cmFuc2ZlckRhdGEuY2xlYXJEYXRhKHR5cGUgPT09ICd2aWV3JyA/IERyYWdnZWRWaWV3SWRlbnRpZmllci5wcm90b3R5cGUgOiBEcmFnZ2VkQ29tcG9zaXRlSWRlbnRpZmllci5wcm90b3R5cGUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZERyYWdEYXRhKHR5cGU6IFZpZXdUeXBlKTogQ29tcG9zaXRlRHJhZ0FuZERyb3BEYXRhIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy50cmFuc2ZlckRhdGEuaGFzRGF0YSh0eXBlID09PSAndmlldycgPyBEcmFnZ2VkVmlld0lkZW50aWZpZXIucHJvdG90eXBlIDogRHJhZ2dlZENvbXBvc2l0ZUlkZW50aWZpZXIucHJvdG90eXBlKSkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IHRoaXMudHJhbnNmZXJEYXRhLmdldERhdGEodHlwZSA9PT0gJ3ZpZXcnID8gRHJhZ2dlZFZpZXdJZGVudGlmaWVyLnByb3RvdHlwZSA6IERyYWdnZWRDb21wb3NpdGVJZGVudGlmaWVyLnByb3RvdHlwZSk7XG5cdFx0XHRpZiAoZGF0YSAmJiBkYXRhWzBdKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgQ29tcG9zaXRlRHJhZ0FuZERyb3BEYXRhKHR5cGUsIGRhdGFbMF0uaWQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIHdyaXRlRHJhZ0RhdGEoaWQ6IHN0cmluZywgdHlwZTogVmlld1R5cGUpOiB2b2lkIHtcblx0XHR0aGlzLnRyYW5zZmVyRGF0YS5zZXREYXRhKFt0eXBlID09PSAndmlldycgPyBuZXcgRHJhZ2dlZFZpZXdJZGVudGlmaWVyKGlkKSA6IG5ldyBEcmFnZ2VkQ29tcG9zaXRlSWRlbnRpZmllcihpZCldLCB0eXBlID09PSAndmlldycgPyBEcmFnZ2VkVmlld0lkZW50aWZpZXIucHJvdG90eXBlIDogRHJhZ2dlZENvbXBvc2l0ZUlkZW50aWZpZXIucHJvdG90eXBlKTtcblx0fVxuXG5cdHJlZ2lzdGVyVGFyZ2V0KGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjYWxsYmFja3M6IElDb21wb3NpdGVEcmFnQW5kRHJvcE9ic2VydmVyQ2FsbGJhY2tzKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBEcmFnQW5kRHJvcE9ic2VydmVyKGVsZW1lbnQsIHtcblx0XHRcdG9uRHJhZ0VudGVyOiBlID0+IHtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHRcdGlmIChjYWxsYmFja3Mub25EcmFnRW50ZXIpIHtcblx0XHRcdFx0XHRjb25zdCBkYXRhID0gdGhpcy5yZWFkRHJhZ0RhdGEoJ2NvbXBvc2l0ZScpIHx8IHRoaXMucmVhZERyYWdEYXRhKCd2aWV3Jyk7XG5cdFx0XHRcdFx0aWYgKGRhdGEpIHtcblx0XHRcdFx0XHRcdGNhbGxiYWNrcy5vbkRyYWdFbnRlcih7IGV2ZW50RGF0YTogZSwgZHJhZ0FuZERyb3BEYXRhOiBkYXRhIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdG9uRHJhZ0xlYXZlOiBlID0+IHtcblx0XHRcdFx0Y29uc3QgZGF0YSA9IHRoaXMucmVhZERyYWdEYXRhKCdjb21wb3NpdGUnKSB8fCB0aGlzLnJlYWREcmFnRGF0YSgndmlldycpO1xuXHRcdFx0XHRpZiAoY2FsbGJhY2tzLm9uRHJhZ0xlYXZlICYmIGRhdGEpIHtcblx0XHRcdFx0XHRjYWxsYmFja3Mub25EcmFnTGVhdmUoeyBldmVudERhdGE6IGUsIGRyYWdBbmREcm9wRGF0YTogZGF0YSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdG9uRHJvcDogZSA9PiB7XG5cdFx0XHRcdGlmIChjYWxsYmFja3Mub25Ecm9wKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGF0YSA9IHRoaXMucmVhZERyYWdEYXRhKCdjb21wb3NpdGUnKSB8fCB0aGlzLnJlYWREcmFnRGF0YSgndmlldycpO1xuXHRcdFx0XHRcdGlmICghZGF0YSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNhbGxiYWNrcy5vbkRyb3AoeyBldmVudERhdGE6IGUsIGRyYWdBbmREcm9wRGF0YTogZGF0YSB9KTtcblxuXHRcdFx0XHRcdC8vIEZpcmUgZHJhZyBldmVudCBpbiBjYXNlIGRyb3AgaGFuZGxlciBkZXN0cm95cyB0aGUgZHJhZ2dlZCBlbGVtZW50XG5cdFx0XHRcdFx0dGhpcy5vbkRyYWdFbmQuZmlyZSh7IGV2ZW50RGF0YTogZSwgZHJhZ0FuZERyb3BEYXRhOiBkYXRhIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0b25EcmFnT3ZlcjogZSA9PiB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0XHRpZiAoY2FsbGJhY2tzLm9uRHJhZ092ZXIpIHtcblx0XHRcdFx0XHRjb25zdCBkYXRhID0gdGhpcy5yZWFkRHJhZ0RhdGEoJ2NvbXBvc2l0ZScpIHx8IHRoaXMucmVhZERyYWdEYXRhKCd2aWV3Jyk7XG5cdFx0XHRcdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y2FsbGJhY2tzLm9uRHJhZ092ZXIoeyBldmVudERhdGE6IGUsIGRyYWdBbmREcm9wRGF0YTogZGF0YSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGlmIChjYWxsYmFja3Mub25EcmFnU3RhcnQpIHtcblx0XHRcdHRoaXMub25EcmFnU3RhcnQuZXZlbnQoZSA9PiB7XG5cdFx0XHRcdGNhbGxiYWNrcy5vbkRyYWdTdGFydCEoZSk7XG5cdFx0XHR9LCB0aGlzLCBkaXNwb3NhYmxlU3RvcmUpO1xuXHRcdH1cblxuXHRcdGlmIChjYWxsYmFja3Mub25EcmFnRW5kKSB7XG5cdFx0XHR0aGlzLm9uRHJhZ0VuZC5ldmVudChlID0+IHtcblx0XHRcdFx0Y2FsbGJhY2tzLm9uRHJhZ0VuZCEoZSk7XG5cdFx0XHR9LCB0aGlzLCBkaXNwb3NhYmxlU3RvcmUpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9yZWdpc3RlcihkaXNwb3NhYmxlU3RvcmUpO1xuXHR9XG5cblx0cmVnaXN0ZXJEcmFnZ2FibGUoZWxlbWVudDogSFRNTEVsZW1lbnQsIGRyYWdnZWRJdGVtUHJvdmlkZXI6ICgpID0+IHsgdHlwZTogVmlld1R5cGU7IGlkOiBzdHJpbmcgfSwgY2FsbGJhY2tzOiBJQ29tcG9zaXRlRHJhZ0FuZERyb3BPYnNlcnZlckNhbGxiYWNrcyk6IElEaXNwb3NhYmxlIHtcblx0XHRlbGVtZW50LmRyYWdnYWJsZSA9IHRydWU7XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBEcmFnQW5kRHJvcE9ic2VydmVyKGVsZW1lbnQsIHtcblx0XHRcdG9uRHJhZ1N0YXJ0OiBlID0+IHtcblx0XHRcdFx0Y29uc3QgeyBpZCwgdHlwZSB9ID0gZHJhZ2dlZEl0ZW1Qcm92aWRlcigpO1xuXHRcdFx0XHR0aGlzLndyaXRlRHJhZ0RhdGEoaWQsIHR5cGUpO1xuXG5cdFx0XHRcdGUuZGF0YVRyYW5zZmVyPy5zZXREcmFnSW1hZ2UoZWxlbWVudCwgMCwgMCk7XG5cblx0XHRcdFx0dGhpcy5vbkRyYWdTdGFydC5maXJlKHsgZXZlbnREYXRhOiBlLCBkcmFnQW5kRHJvcERhdGE6IHRoaXMucmVhZERyYWdEYXRhKHR5cGUpISB9KTtcblx0XHRcdH0sXG5cdFx0XHRvbkRyYWdFbmQ6IGUgPT4ge1xuXHRcdFx0XHRjb25zdCB7IHR5cGUgfSA9IGRyYWdnZWRJdGVtUHJvdmlkZXIoKTtcblx0XHRcdFx0Y29uc3QgZGF0YSA9IHRoaXMucmVhZERyYWdEYXRhKHR5cGUpO1xuXHRcdFx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLm9uRHJhZ0VuZC5maXJlKHsgZXZlbnREYXRhOiBlLCBkcmFnQW5kRHJvcERhdGE6IGRhdGEgfSk7XG5cdFx0XHR9LFxuXHRcdFx0b25EcmFnRW50ZXI6IGUgPT4ge1xuXHRcdFx0XHRpZiAoY2FsbGJhY2tzLm9uRHJhZ0VudGVyKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGF0YSA9IHRoaXMucmVhZERyYWdEYXRhKCdjb21wb3NpdGUnKSB8fCB0aGlzLnJlYWREcmFnRGF0YSgndmlldycpO1xuXHRcdFx0XHRcdGlmICghZGF0YSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChkYXRhKSB7XG5cdFx0XHRcdFx0XHRjYWxsYmFja3Mub25EcmFnRW50ZXIoeyBldmVudERhdGE6IGUsIGRyYWdBbmREcm9wRGF0YTogZGF0YSB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRvbkRyYWdMZWF2ZTogZSA9PiB7XG5cdFx0XHRcdGNvbnN0IGRhdGEgPSB0aGlzLnJlYWREcmFnRGF0YSgnY29tcG9zaXRlJykgfHwgdGhpcy5yZWFkRHJhZ0RhdGEoJ3ZpZXcnKTtcblx0XHRcdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y2FsbGJhY2tzLm9uRHJhZ0xlYXZlPy4oeyBldmVudERhdGE6IGUsIGRyYWdBbmREcm9wRGF0YTogZGF0YSB9KTtcblx0XHRcdH0sXG5cdFx0XHRvbkRyb3A6IGUgPT4ge1xuXHRcdFx0XHRpZiAoY2FsbGJhY2tzLm9uRHJvcCkge1xuXHRcdFx0XHRcdGNvbnN0IGRhdGEgPSB0aGlzLnJlYWREcmFnRGF0YSgnY29tcG9zaXRlJykgfHwgdGhpcy5yZWFkRHJhZ0RhdGEoJ3ZpZXcnKTtcblx0XHRcdFx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjYWxsYmFja3Mub25Ecm9wKHsgZXZlbnREYXRhOiBlLCBkcmFnQW5kRHJvcERhdGE6IGRhdGEgfSk7XG5cblx0XHRcdFx0XHQvLyBGaXJlIGRyYWcgZXZlbnQgaW4gY2FzZSBkcm9wIGhhbmRsZXIgZGVzdHJveXMgdGhlIGRyYWdnZWQgZWxlbWVudFxuXHRcdFx0XHRcdHRoaXMub25EcmFnRW5kLmZpcmUoeyBldmVudERhdGE6IGUsIGRyYWdBbmREcm9wRGF0YTogZGF0YSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdG9uRHJhZ092ZXI6IGUgPT4ge1xuXHRcdFx0XHRpZiAoY2FsbGJhY2tzLm9uRHJhZ092ZXIpIHtcblx0XHRcdFx0XHRjb25zdCBkYXRhID0gdGhpcy5yZWFkRHJhZ0RhdGEoJ2NvbXBvc2l0ZScpIHx8IHRoaXMucmVhZERyYWdEYXRhKCd2aWV3Jyk7XG5cdFx0XHRcdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y2FsbGJhY2tzLm9uRHJhZ092ZXIoeyBldmVudERhdGE6IGUsIGRyYWdBbmREcm9wRGF0YTogZGF0YSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGlmIChjYWxsYmFja3Mub25EcmFnU3RhcnQpIHtcblx0XHRcdHRoaXMub25EcmFnU3RhcnQuZXZlbnQoZSA9PiB7XG5cdFx0XHRcdGNhbGxiYWNrcy5vbkRyYWdTdGFydCEoZSk7XG5cdFx0XHR9LCB0aGlzLCBkaXNwb3NhYmxlU3RvcmUpO1xuXHRcdH1cblxuXHRcdGlmIChjYWxsYmFja3Mub25EcmFnRW5kKSB7XG5cdFx0XHR0aGlzLm9uRHJhZ0VuZC5ldmVudChlID0+IHtcblx0XHRcdFx0Y2FsbGJhY2tzLm9uRHJhZ0VuZCEoZSk7XG5cdFx0XHR9LCB0aGlzLCBkaXNwb3NhYmxlU3RvcmUpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9yZWdpc3RlcihkaXNwb3NhYmxlU3RvcmUpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b2dnbGVEcm9wRWZmZWN0KGRhdGFUcmFuc2ZlcjogRGF0YVRyYW5zZmVyIHwgbnVsbCwgZHJvcEVmZmVjdDogJ25vbmUnIHwgJ2NvcHknIHwgJ2xpbmsnIHwgJ21vdmUnLCBzaG91bGRIYXZlSXQ6IGJvb2xlYW4pIHtcblx0aWYgKCFkYXRhVHJhbnNmZXIpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRkYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9IHNob3VsZEhhdmVJdCA/IGRyb3BFZmZlY3QgOiAnbm9uZSc7XG59XG5cbmV4cG9ydCBjbGFzcyBSZXNvdXJjZUxpc3REbkRIYW5kbGVyPFQ+IGltcGxlbWVudHMgSUxpc3REcmFnQW5kRHJvcDxUPiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdG9SZXNvdXJjZTogKGU6IFQpID0+IFVSSSB8IG51bGwsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7IH1cblxuXHRnZXREcmFnVVJJKGVsZW1lbnQ6IFQpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRoaXMudG9SZXNvdXJjZShlbGVtZW50KTtcblx0XHRyZXR1cm4gcmVzb3VyY2UgPyByZXNvdXJjZS50b1N0cmluZygpIDogbnVsbDtcblx0fVxuXG5cdGdldERyYWdMYWJlbChlbGVtZW50czogVFtdKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZXNvdXJjZXMgPSBjb2FsZXNjZShlbGVtZW50cy5tYXAodGhpcy50b1Jlc291cmNlKSk7XG5cdFx0cmV0dXJuIHJlc291cmNlcy5sZW5ndGggPT09IDEgPyBiYXNlbmFtZShyZXNvdXJjZXNbMF0pIDogcmVzb3VyY2VzLmxlbmd0aCA+IDEgPyBTdHJpbmcocmVzb3VyY2VzLmxlbmd0aCkgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRvbkRyYWdTdGFydChkYXRhOiBJRHJhZ0FuZERyb3BEYXRhLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCByZXNvdXJjZXM6IFVSSVtdID0gW107XG5cdFx0Y29uc3QgZWxlbWVudHMgPSAoZGF0YSBhcyBFbGVtZW50c0RyYWdBbmREcm9wRGF0YTxUPikuZWxlbWVudHM7XG5cdFx0Zm9yIChjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG5cdFx0XHRjb25zdCByZXNvdXJjZSA9IHRoaXMudG9SZXNvdXJjZShlbGVtZW50KTtcblx0XHRcdGlmIChyZXNvdXJjZSkge1xuXHRcdFx0XHRyZXNvdXJjZXMucHVzaChyZXNvdXJjZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMub25XaWxsRHJhZ0VsZW1lbnRzKGVsZW1lbnRzLCBvcmlnaW5hbEV2ZW50KTtcblx0XHRpZiAocmVzb3VyY2VzLmxlbmd0aCkge1xuXHRcdFx0Ly8gQXBwbHkgc29tZSBkYXRhdHJhbnNmZXIgdHlwZXMgdG8gYWxsb3cgZm9yIGRyYWdnaW5nIHRoZSBlbGVtZW50IG91dHNpZGUgb2YgdGhlIGFwcGxpY2F0aW9uXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IGZpbGxFZGl0b3JzRHJhZ0RhdGEoYWNjZXNzb3IsIHJlc291cmNlcywgb3JpZ2luYWxFdmVudCkpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvbldpbGxEcmFnRWxlbWVudHMoZWxlbWVudHM6IHJlYWRvbmx5IFRbXSwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG5cdFx0Ly8gbm9vcFxuXHR9XG5cblx0b25EcmFnT3ZlcihkYXRhOiBJRHJhZ0FuZERyb3BEYXRhLCB0YXJnZXRFbGVtZW50OiBULCB0YXJnZXRJbmRleDogbnVtYmVyLCB0YXJnZXRTZWN0b3I6IExpc3RWaWV3VGFyZ2V0U2VjdG9yIHwgdW5kZWZpbmVkLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiBib29sZWFuIHwgSVRyZWVEcmFnT3ZlclJlYWN0aW9uIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRkcm9wKGRhdGE6IElEcmFnQW5kRHJvcERhdGEsIHRhcmdldEVsZW1lbnQ6IFQsIHRhcmdldEluZGV4OiBudW1iZXIsIHRhcmdldFNlY3RvcjogTGlzdFZpZXdUYXJnZXRTZWN0b3IgfCB1bmRlZmluZWQsIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IHZvaWQgeyB9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHsgfVxufVxuXG4vLyNlbmRyZWdpb25cblxuY2xhc3MgR2xvYmFsV2luZG93RHJhZ2dlZE92ZXJUcmFja2VyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQ0hBTk5FTF9OQU1FID0gJ21vbmFjby13b3JrYmVuY2gtZ2xvYmFsLWRyYWdnZWQtb3Zlcic7XG5cblx0cHJpdmF0ZSByZWFkb25seSBicm9hZGNhc3RlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBCcm9hZGNhc3REYXRhQ2hhbm5lbDxib29sZWFuPihHbG9iYWxXaW5kb3dEcmFnZ2VkT3ZlclRyYWNrZXIuQ0hBTk5FTF9OQU1FKSk7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQucnVuQW5kU3Vic2NyaWJlKG9uRGlkUmVnaXN0ZXJXaW5kb3csICh7IHdpbmRvdywgZGlzcG9zYWJsZXMgfSkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih3aW5kb3csIEV2ZW50VHlwZS5EUkFHX09WRVIsICgpID0+IHRoaXMubWFya0RyYWdnZWRPdmVyKGZhbHNlKSwgdHJ1ZSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih3aW5kb3csIEV2ZW50VHlwZS5EUkFHX0xFQVZFLCAoKSA9PiB0aGlzLmNsZWFyRHJhZ2dlZE92ZXIoZmFsc2UpLCB0cnVlKSk7XG5cdFx0fSwgeyB3aW5kb3c6IG1haW5XaW5kb3csIGRpc3Bvc2FibGVzOiB0aGlzLl9zdG9yZSB9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmJyb2FkY2FzdGVyLm9uRGlkUmVjZWl2ZURhdGEoZGF0YSA9PiB7XG5cdFx0XHRpZiAoZGF0YSA9PT0gdHJ1ZSkge1xuXHRcdFx0XHR0aGlzLm1hcmtEcmFnZ2VkT3Zlcih0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuY2xlYXJEcmFnZ2VkT3Zlcih0cnVlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGRyYWdnZWRPdmVyID0gZmFsc2U7XG5cdGdldCBpc0RyYWdnZWRPdmVyKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5kcmFnZ2VkT3ZlcjsgfVxuXG5cdHByaXZhdGUgbWFya0RyYWdnZWRPdmVyKGZyb21Ccm9hZGNhc3Q6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5kcmFnZ2VkT3ZlciA9PT0gdHJ1ZSkge1xuXHRcdFx0cmV0dXJuOyAvLyBhbHJhZHkgbWFya2VkXG5cdFx0fVxuXG5cdFx0dGhpcy5kcmFnZ2VkT3ZlciA9IHRydWU7XG5cblx0XHRpZiAoIWZyb21Ccm9hZGNhc3QpIHtcblx0XHRcdHRoaXMuYnJvYWRjYXN0ZXIucG9zdERhdGEodHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckRyYWdnZWRPdmVyKGZyb21Ccm9hZGNhc3Q6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5kcmFnZ2VkT3ZlciA9PT0gZmFsc2UpIHtcblx0XHRcdHJldHVybjsgLy8gYWxyYWR5IGNsZWFyZWRcblx0XHR9XG5cblx0XHR0aGlzLmRyYWdnZWRPdmVyID0gZmFsc2U7XG5cblx0XHRpZiAoIWZyb21Ccm9hZGNhc3QpIHtcblx0XHRcdHRoaXMuYnJvYWRjYXN0ZXIucG9zdERhdGEoZmFsc2UpO1xuXHRcdH1cblx0fVxufVxuXG5jb25zdCBnbG9iYWxEcmFnZ2VkT3ZlclRyYWNrZXIgPSBuZXcgR2xvYmFsV2luZG93RHJhZ2dlZE92ZXJUcmFja2VyKCk7XG5cbi8qKlxuICogUmV0dXJucyB3aGV0aGVyIHRoZSB3b3JrYmVuY2ggaXMgY3VycmVudGx5IGRyYWdnZWQgb3ZlciBpbiBhbnkgb2ZcbiAqIHRoZSBvcGVuZWQgd2luZG93cyAobWFpbiB3aW5kb3dzIGFuZCBhdXhpbGlhcnkgd2luZG93cykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1dpbmRvd0RyYWdnZWRPdmVyKCk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gZ2xvYmFsRHJhZ2dlZE92ZXJUcmFja2VyLmlzRHJhZ2dlZE92ZXI7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMscUJBQXVDO0FBQ2hELFNBQVMscUJBQXFCLFdBQVcsdUJBQXVCLDJCQUEyQjtBQUszRixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGVBQStCO0FBQ3hDLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsWUFBWSxpQkFBOEIsdUJBQXVCO0FBQzFFLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsYUFBYTtBQUN0QixTQUFTLFlBQVksZUFBZTtBQUNwQyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLFVBQVUsZUFBZTtBQUNsQyxTQUFTLFdBQVc7QUFDcEIsU0FBUyxtQkFBbUIsWUFBMEYsd0JBQXdCLDhDQUE4QyxzQ0FBc0M7QUFDbE8sU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw2QkFBK0M7QUFDeEQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxrQkFBa0IscUJBQXFCO0FBQ2hELFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsMEJBQTBCLDJCQUEyQiw0QkFBNEI7QUFDMUYsU0FBdUMsMEJBQTBCO0FBQ2pFLFNBQVMsd0JBQTRELG9CQUFvQiwyQkFBMkIsNEJBQTRCLHVDQUF1QztBQUV2TCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGdDQUFnQztBQUV6QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLDRCQUE0QjtBQUk5QixNQUFNLHdCQUF3QjtBQUFBLEVBRXBDLFlBQXFCLFlBQStCO0FBQS9CO0FBQUEsRUFBaUM7QUFDdkQ7QUFFTyxNQUFNLDZCQUE2QjtBQUFBLEVBRXpDLFlBQXFCLFlBQTZCO0FBQTdCO0FBQUEsRUFBK0I7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
