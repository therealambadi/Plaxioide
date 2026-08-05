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
import { EditorExtensions, EditorsOrder, GroupModelChangeKind, EditorInputCapabilities } from "../../../common/editor.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { dispose, Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { IEditorGroupsService, GroupsOrder } from "../../../services/editor/common/editorGroupsService.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { LinkedMap, Touch, ResourceMap } from "../../../../base/common/map.js";
import { equals } from "../../../../base/common/objects.js";
let EditorsObserver = class extends Disposable {
  constructor(editorGroupsContainer, editorGroupService, storageService) {
    super();
    this.editorGroupService = editorGroupService;
    this.storageService = storageService;
    this.keyMap = /* @__PURE__ */ new Map();
    this.mostRecentEditorsMap = new LinkedMap();
    this.editorsPerResourceCounter = new ResourceMap();
    this._onDidMostRecentlyActiveEditorsChange = this._register(new Emitter());
    this.onDidMostRecentlyActiveEditorsChange = this._onDidMostRecentlyActiveEditorsChange.event;
    this.editorGroupsContainer = editorGroupsContainer ?? editorGroupService;
    this.isScoped = !!editorGroupsContainer;
    this.registerListeners();
    this.loadState();
  }
  get count() {
    return this.mostRecentEditorsMap.size;
  }
  get editors() {
    return [...this.mostRecentEditorsMap.values()];
  }
  hasEditor(editor) {
    const editors = this.editorsPerResourceCounter.get(editor.resource);
    return editors?.has(this.toIdentifier(editor)) ?? false;
  }
  hasEditors(resource) {
    return this.editorsPerResourceCounter.has(resource);
  }
  toIdentifier(arg1, editorId) {
    if (typeof arg1 !== "string") {
      return this.toIdentifier(arg1.typeId, arg1.editorId);
    }
    if (editorId) {
      return `${arg1}/${editorId}`;
    }
    return arg1;
  }
  registerListeners() {
    this._register(this.editorGroupsContainer.onDidAddGroup((group) => this.onGroupAdded(group)));
    this._register(this.editorGroupService.onDidChangeEditorPartOptions((e) => this.onDidChangeEditorPartOptions(e)));
    this._register(this.storageService.onWillSaveState(() => this.saveState()));
  }
  onGroupAdded(group) {
    const groupEditorsMru = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
    for (let i = groupEditorsMru.length - 1; i >= 0; i--) {
      this.addMostRecentEditor(
        group,
        groupEditorsMru[i],
        false,
        true
        /* is new */
      );
    }
    if (this.editorGroupsContainer.activeGroup === group && group.activeEditor) {
      this.addMostRecentEditor(
        group,
        group.activeEditor,
        true,
        false
        /* already added before */
      );
    }
    this.registerGroupListeners(group);
  }
  registerGroupListeners(group) {
    const groupDisposables = new DisposableStore();
    groupDisposables.add(group.onDidModelChange((e) => {
      switch (e.kind) {
        // Group gets active: put active editor as most recent
        case GroupModelChangeKind.GROUP_ACTIVE: {
          if (this.editorGroupsContainer.activeGroup === group && group.activeEditor) {
            this.addMostRecentEditor(
              group,
              group.activeEditor,
              true,
              false
              /* editor already opened */
            );
          }
          break;
        }
        // Editor opens: put it as second most recent
        //
        // Also check for maximum allowed number of editors and
        // start to close oldest ones if needed.
        case GroupModelChangeKind.EDITOR_OPEN: {
          if (e.editor) {
            this.addMostRecentEditor(
              group,
              e.editor,
              false,
              true
              /* is new */
            );
            this.ensureOpenedEditorsLimit({ groupId: group.id, editor: e.editor }, group.id);
          }
          break;
        }
      }
    }));
    groupDisposables.add(group.onDidCloseEditor((e) => {
      this.removeMostRecentEditor(group, e.editor);
    }));
    groupDisposables.add(group.onDidActiveEditorChange((e) => {
      if (e.editor) {
        this.addMostRecentEditor(
          group,
          e.editor,
          this.editorGroupsContainer.activeGroup === group,
          false
          /* editor already opened */
        );
      }
    }));
    Event.once(group.onWillDispose)(() => dispose(groupDisposables));
  }
  onDidChangeEditorPartOptions(event) {
    if (!equals(event.newPartOptions.limit, event.oldPartOptions.limit)) {
      const activeGroup = this.editorGroupsContainer.activeGroup;
      let exclude = void 0;
      if (activeGroup.activeEditor) {
        exclude = { editor: activeGroup.activeEditor, groupId: activeGroup.id };
      }
      this.ensureOpenedEditorsLimit(exclude);
    }
  }
  addMostRecentEditor(group, editor, isActive, isNew) {
    const key = this.ensureKey(group, editor);
    const mostRecentEditor = this.mostRecentEditorsMap.first;
    if (isActive || !mostRecentEditor) {
      this.mostRecentEditorsMap.set(key, key, mostRecentEditor ? Touch.AsOld : void 0);
    } else {
      this.mostRecentEditorsMap.set(
        key,
        key,
        Touch.AsOld
        /* make first */
      );
      this.mostRecentEditorsMap.set(
        mostRecentEditor,
        mostRecentEditor,
        Touch.AsOld
        /* make first */
      );
    }
    if (isNew) {
      this.updateEditorResourcesMap(editor, true);
    }
    this._onDidMostRecentlyActiveEditorsChange.fire();
  }
  updateEditorResourcesMap(editor, add) {
    let resource = void 0;
    let typeId = void 0;
    let editorId = void 0;
    if (editor instanceof SideBySideEditorInput) {
      resource = editor.primary.resource;
      typeId = editor.primary.typeId;
      editorId = editor.primary.editorId;
    } else {
      resource = editor.resource;
      typeId = editor.typeId;
      editorId = editor.editorId;
    }
    if (!resource) {
      return;
    }
    const identifier = this.toIdentifier(typeId, editorId);
    if (add) {
      let editorsPerResource = this.editorsPerResourceCounter.get(resource);
      if (!editorsPerResource) {
        editorsPerResource = /* @__PURE__ */ new Map();
        this.editorsPerResourceCounter.set(resource, editorsPerResource);
      }
      editorsPerResource.set(identifier, (editorsPerResource.get(identifier) ?? 0) + 1);
    } else {
      const editorsPerResource = this.editorsPerResourceCounter.get(resource);
      if (editorsPerResource) {
        const counter = editorsPerResource.get(identifier) ?? 0;
        if (counter > 1) {
          editorsPerResource.set(identifier, counter - 1);
        } else {
          editorsPerResource.delete(identifier);
          if (editorsPerResource.size === 0) {
            this.editorsPerResourceCounter.delete(resource);
          }
        }
      }
    }
  }
  removeMostRecentEditor(group, editor) {
    this.updateEditorResourcesMap(editor, false);
    const key = this.findKey(group, editor);
    if (key) {
      this.mostRecentEditorsMap.delete(key);
      const map = this.keyMap.get(group.id);
      if (map && map.delete(key.editor) && map.size === 0) {
        this.keyMap.delete(group.id);
      }
      this._onDidMostRecentlyActiveEditorsChange.fire();
    }
  }
  findKey(group, editor) {
    const groupMap = this.keyMap.get(group.id);
    if (!groupMap) {
      return void 0;
    }
    return groupMap.get(editor);
  }
  ensureKey(group, editor) {
    let groupMap = this.keyMap.get(group.id);
    if (!groupMap) {
      groupMap = /* @__PURE__ */ new Map();
      this.keyMap.set(group.id, groupMap);
    }
    let key = groupMap.get(editor);
    if (!key) {
      key = { groupId: group.id, editor };
      groupMap.set(editor, key);
    }
    return key;
  }
  async ensureOpenedEditorsLimit(exclude, groupId) {
    if (!this.editorGroupService.partOptions.limit?.enabled || typeof this.editorGroupService.partOptions.limit.value !== "number" || this.editorGroupService.partOptions.limit.value <= 0) {
      return;
    }
    const limit = this.editorGroupService.partOptions.limit.value;
    if (this.editorGroupService.partOptions.limit?.perEditorGroup) {
      if (typeof groupId === "number") {
        const group = this.editorGroupsContainer.getGroup(groupId);
        if (group) {
          await this.doEnsureOpenedEditorsLimit(limit, group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).map((editor) => ({ editor, groupId })), exclude);
        }
      } else {
        for (const group of this.editorGroupsContainer.groups) {
          await this.ensureOpenedEditorsLimit(exclude, group.id);
        }
      }
    } else {
      await this.doEnsureOpenedEditorsLimit(limit, [...this.mostRecentEditorsMap.values()], exclude);
    }
  }
  async doEnsureOpenedEditorsLimit(limit, mostRecentEditors, exclude) {
    let mostRecentEditorsCountingForLimit;
    if (this.editorGroupService.partOptions.limit?.excludeDirty) {
      mostRecentEditorsCountingForLimit = mostRecentEditors.filter(({ editor }) => {
        if (editor.isDirty() && !editor.isSaving() || editor.hasCapability(EditorInputCapabilities.Scratchpad)) {
          return false;
        }
        return true;
      });
    } else {
      mostRecentEditorsCountingForLimit = mostRecentEditors;
    }
    if (limit >= mostRecentEditorsCountingForLimit.length) {
      return;
    }
    const leastRecentlyClosableEditors = mostRecentEditorsCountingForLimit.reverse().filter(({ editor, groupId }) => {
      if (editor.isDirty() && !editor.isSaving() || editor.hasCapability(EditorInputCapabilities.Scratchpad)) {
        return false;
      }
      if (exclude && editor === exclude.editor && groupId === exclude.groupId) {
        return false;
      }
      if (this.editorGroupsContainer.getGroup(groupId)?.isSticky(editor)) {
        return false;
      }
      return true;
    });
    let editorsToCloseCount = mostRecentEditorsCountingForLimit.length - limit;
    const mapGroupToEditorsToClose = /* @__PURE__ */ new Map();
    for (const { groupId, editor } of leastRecentlyClosableEditors) {
      let editorsInGroupToClose = mapGroupToEditorsToClose.get(groupId);
      if (!editorsInGroupToClose) {
        editorsInGroupToClose = [];
        mapGroupToEditorsToClose.set(groupId, editorsInGroupToClose);
      }
      editorsInGroupToClose.push(editor);
      editorsToCloseCount--;
      if (editorsToCloseCount === 0) {
        break;
      }
    }
    for (const [groupId, editors] of mapGroupToEditorsToClose) {
      const group = this.editorGroupsContainer.getGroup(groupId);
      if (group) {
        await group.closeEditors(editors, { preserveFocus: true });
      }
    }
  }
  saveState() {
    if (this.isScoped) {
      return;
    }
    if (this.mostRecentEditorsMap.isEmpty()) {
      this.storageService.remove(EditorsObserver.STORAGE_KEY, StorageScope.WORKSPACE);
    } else {
      this.storageService.store(EditorsObserver.STORAGE_KEY, JSON.stringify(this.serialize()), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
  }
  serialize() {
    const registry = Registry.as(EditorExtensions.EditorFactory);
    const entries = [...this.mostRecentEditorsMap.values()];
    const mapGroupToSerializableEditorsOfGroup = /* @__PURE__ */ new Map();
    return {
      entries: coalesce(entries.map(({ editor, groupId }) => {
        const group = this.editorGroupsContainer.getGroup(groupId);
        if (!group) {
          return void 0;
        }
        let serializableEditorsOfGroup = mapGroupToSerializableEditorsOfGroup.get(group);
        if (!serializableEditorsOfGroup) {
          serializableEditorsOfGroup = group.getEditors(EditorsOrder.SEQUENTIAL).filter((editor2) => {
            const editorSerializer = registry.getEditorSerializer(editor2);
            return editorSerializer?.canSerialize(editor2);
          });
          mapGroupToSerializableEditorsOfGroup.set(group, serializableEditorsOfGroup);
        }
        const index = serializableEditorsOfGroup.indexOf(editor);
        if (index === -1) {
          return void 0;
        }
        return { groupId, index };
      }))
    };
  }
  async loadState() {
    if (this.editorGroupsContainer === this.editorGroupService.mainPart || this.editorGroupsContainer === this.editorGroupService) {
      await this.editorGroupService.whenReady;
    }
    let hasRestorableState = false;
    if (!this.isScoped) {
      const serialized = this.storageService.get(EditorsObserver.STORAGE_KEY, StorageScope.WORKSPACE);
      if (serialized) {
        hasRestorableState = true;
        this.deserialize(JSON.parse(serialized));
      }
    }
    if (!hasRestorableState) {
      const groups = this.editorGroupsContainer.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE);
      for (let i = groups.length - 1; i >= 0; i--) {
        const group = groups[i];
        const groupEditorsMru = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
        for (let i2 = groupEditorsMru.length - 1; i2 >= 0; i2--) {
          this.addMostRecentEditor(
            group,
            groupEditorsMru[i2],
            true,
            true
            /* is new */
          );
        }
      }
    }
    for (const group of this.editorGroupsContainer.groups) {
      this.registerGroupListeners(group);
    }
  }
  deserialize(serialized) {
    const mapValues = [];
    for (const { groupId, index } of serialized.entries) {
      const group = this.editorGroupsContainer.getGroup(groupId);
      if (!group) {
        continue;
      }
      const editor = group.getEditorByIndex(index);
      if (!editor) {
        continue;
      }
      const editorIdentifier = this.ensureKey(group, editor);
      mapValues.push([editorIdentifier, editorIdentifier]);
      this.updateEditorResourcesMap(editor, true);
    }
    this.mostRecentEditorsMap.fromJSON(mapValues);
  }
};
EditorsObserver.STORAGE_KEY = "editors.mru";
EditorsObserver = __decorateClass([
  __decorateParam(1, IEditorGroupsService),
  __decorateParam(2, IStorageService)
], EditorsObserver);
export {
  EditorsObserver
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yc09ic2VydmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSUVkaXRvckZhY3RvcnlSZWdpc3RyeSwgSUVkaXRvcklkZW50aWZpZXIsIEdyb3VwSWRlbnRpZmllciwgRWRpdG9yRXh0ZW5zaW9ucywgSUVkaXRvclBhcnRPcHRpb25zQ2hhbmdlRXZlbnQsIEVkaXRvcnNPcmRlciwgR3JvdXBNb2RlbENoYW5nZUtpbmQsIEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgU2lkZUJ5U2lkZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9zaWRlQnlTaWRlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgZGlzcG9zZSwgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNTZXJ2aWNlLCBJRWRpdG9yR3JvdXAsIEdyb3Vwc09yZGVyLCBJRWRpdG9yR3JvdXBzQ29udGFpbmVyIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGNvYWxlc2NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IExpbmtlZE1hcCwgVG91Y2gsIFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IGVxdWFscyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgSVJlc291cmNlRWRpdG9ySW5wdXRJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcblxuaW50ZXJmYWNlIElTZXJpYWxpemVkRWRpdG9yc0xpc3Qge1xuXHRlbnRyaWVzOiBJU2VyaWFsaXplZEVkaXRvcklkZW50aWZpZXJbXTtcbn1cblxuaW50ZXJmYWNlIElTZXJpYWxpemVkRWRpdG9ySWRlbnRpZmllciB7XG5cdGdyb3VwSWQ6IEdyb3VwSWRlbnRpZmllcjtcblx0aW5kZXg6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBBIG9ic2VydmVyIG9mIG9wZW5lZCBlZGl0b3JzIGFjcm9zcyBhbGwgZWRpdG9yIGdyb3VwcyBieSBtb3N0IHJlY2VudGx5IHVzZWQuXG4gKiBSdWxlczpcbiAqIC0gdGhlIGxhc3QgZWRpdG9yIGluIHRoZSBsaXN0IGlzIHRoZSBvbmUgbW9zdCByZWNlbnRseSBhY3RpdmF0ZWRcbiAqIC0gdGhlIGZpcnN0IGVkaXRvciBpbiB0aGUgbGlzdCBpcyB0aGUgb25lIHRoYXQgd2FzIGFjdGl2YXRlZCB0aGUgbG9uZ2VzdCB0aW1lIGFnb1xuICogLSBhbiBlZGl0b3IgdGhhdCBvcGVucyBpbmFjdGl2ZSB3aWxsIGJlIHBsYWNlZCBiZWhpbmQgdGhlIGN1cnJlbnRseSBhY3RpdmUgZWRpdG9yXG4gKlxuICogVGhlIG9ic2VydmVyIG1heSBzdGFydCB0byBjbG9zZSBlZGl0b3JzIGJhc2VkIG9uIHRoZSB3b3JrYmVuY2guZWRpdG9yLmxpbWl0IHNldHRpbmcuXG4gKi9cbmV4cG9ydCBjbGFzcyBFZGl0b3JzT2JzZXJ2ZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBTVE9SQUdFX0tFWSA9ICdlZGl0b3JzLm1ydSc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBrZXlNYXAgPSBuZXcgTWFwPEdyb3VwSWRlbnRpZmllciwgTWFwPEVkaXRvcklucHV0LCBJRWRpdG9ySWRlbnRpZmllcj4+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgbW9zdFJlY2VudEVkaXRvcnNNYXAgPSBuZXcgTGlua2VkTWFwPElFZGl0b3JJZGVudGlmaWVyLCBJRWRpdG9ySWRlbnRpZmllcj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JzUGVyUmVzb3VyY2VDb3VudGVyID0gbmV3IFJlc291cmNlTWFwPE1hcDxzdHJpbmcgLyogdHlwZUlkL2VkaXRvcklkICovLCBudW1iZXIgLyogY291bnRlciAqLz4+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRNb3N0UmVjZW50bHlBY3RpdmVFZGl0b3JzQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkTW9zdFJlY2VudGx5QWN0aXZlRWRpdG9yc0NoYW5nZSA9IHRoaXMuX29uRGlkTW9zdFJlY2VudGx5QWN0aXZlRWRpdG9yc0NoYW5nZS5ldmVudDtcblxuXHRnZXQgY291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5tb3N0UmVjZW50RWRpdG9yc01hcC5zaXplO1xuXHR9XG5cblx0Z2V0IGVkaXRvcnMoKTogSUVkaXRvcklkZW50aWZpZXJbXSB7XG5cdFx0cmV0dXJuIFsuLi50aGlzLm1vc3RSZWNlbnRFZGl0b3JzTWFwLnZhbHVlcygpXTtcblx0fVxuXG5cdGhhc0VkaXRvcihlZGl0b3I6IElSZXNvdXJjZUVkaXRvcklucHV0SWRlbnRpZmllcik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGVkaXRvcnMgPSB0aGlzLmVkaXRvcnNQZXJSZXNvdXJjZUNvdW50ZXIuZ2V0KGVkaXRvci5yZXNvdXJjZSk7XG5cblx0XHRyZXR1cm4gZWRpdG9ycz8uaGFzKHRoaXMudG9JZGVudGlmaWVyKGVkaXRvcikpID8/IGZhbHNlO1xuXHR9XG5cblx0aGFzRWRpdG9ycyhyZXNvdXJjZTogVVJJKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZWRpdG9yc1BlclJlc291cmNlQ291bnRlci5oYXMocmVzb3VyY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSB0b0lkZW50aWZpZXIodHlwZUlkOiBzdHJpbmcsIGVkaXRvcklkOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBzdHJpbmc7XG5cdHByaXZhdGUgdG9JZGVudGlmaWVyKGVkaXRvcjogSVJlc291cmNlRWRpdG9ySW5wdXRJZGVudGlmaWVyKTogc3RyaW5nO1xuXHRwcml2YXRlIHRvSWRlbnRpZmllcihhcmcxOiBzdHJpbmcgfCBJUmVzb3VyY2VFZGl0b3JJbnB1dElkZW50aWZpZXIsIGVkaXRvcklkPzogc3RyaW5nIHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcblx0XHRpZiAodHlwZW9mIGFyZzEgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy50b0lkZW50aWZpZXIoYXJnMS50eXBlSWQsIGFyZzEuZWRpdG9ySWQpO1xuXHRcdH1cblxuXHRcdGlmIChlZGl0b3JJZCkge1xuXHRcdFx0cmV0dXJuIGAke2FyZzF9LyR7ZWRpdG9ySWR9YDtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJnMTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yR3JvdXBzQ29udGFpbmVyOiBJRWRpdG9yR3JvdXBzQ29udGFpbmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IGlzU2NvcGVkOiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvckdyb3Vwc0NvbnRhaW5lcjogSUVkaXRvckdyb3Vwc0NvbnRhaW5lciB8IHVuZGVmaW5lZCxcblx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgcHJpdmF0ZSBlZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lciA9IGVkaXRvckdyb3Vwc0NvbnRhaW5lciA/PyBlZGl0b3JHcm91cFNlcnZpY2U7XG5cdFx0dGhpcy5pc1Njb3BlZCA9ICEhZWRpdG9yR3JvdXBzQ29udGFpbmVyO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHRcdHRoaXMubG9hZFN0YXRlKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyLm9uRGlkQWRkR3JvdXAoZ3JvdXAgPT4gdGhpcy5vbkdyb3VwQWRkZWQoZ3JvdXApKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3JHcm91cFNlcnZpY2Uub25EaWRDaGFuZ2VFZGl0b3JQYXJ0T3B0aW9ucyhlID0+IHRoaXMub25EaWRDaGFuZ2VFZGl0b3JQYXJ0T3B0aW9ucyhlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc3RvcmFnZVNlcnZpY2Uub25XaWxsU2F2ZVN0YXRlKCgpID0+IHRoaXMuc2F2ZVN0YXRlKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgb25Hcm91cEFkZGVkKGdyb3VwOiBJRWRpdG9yR3JvdXApOiB2b2lkIHtcblxuXHRcdC8vIE1ha2Ugc3VyZSB0byBhZGQgYW55IGFscmVhZHkgZXhpc3RpbmcgZWRpdG9yXG5cdFx0Ly8gb2YgdGhlIG5ldyBncm91cCBpbnRvIG91ciBsaXN0IGluIExSVSBvcmRlclxuXHRcdGNvbnN0IGdyb3VwRWRpdG9yc01ydSA9IGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKTtcblx0XHRmb3IgKGxldCBpID0gZ3JvdXBFZGl0b3JzTXJ1Lmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHR0aGlzLmFkZE1vc3RSZWNlbnRFZGl0b3IoZ3JvdXAsIGdyb3VwRWRpdG9yc01ydVtpXSwgZmFsc2UgLyogaXMgbm90IGFjdGl2ZSAqLywgdHJ1ZSAvKiBpcyBuZXcgKi8pO1xuXHRcdH1cblxuXHRcdC8vIE1ha2Ugc3VyZSB0aGF0IGFjdGl2ZSBlZGl0b3IgaXMgcHV0IGFzIGZpcnN0IGlmIGdyb3VwIGlzIGFjdGl2ZVxuXHRcdGlmICh0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5hY3RpdmVHcm91cCA9PT0gZ3JvdXAgJiYgZ3JvdXAuYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHR0aGlzLmFkZE1vc3RSZWNlbnRFZGl0b3IoZ3JvdXAsIGdyb3VwLmFjdGl2ZUVkaXRvciwgdHJ1ZSAvKiBpcyBhY3RpdmUgKi8sIGZhbHNlIC8qIGFscmVhZHkgYWRkZWQgYmVmb3JlICovKTtcblx0XHR9XG5cblx0XHQvLyBHcm91cCBMaXN0ZW5lcnNcblx0XHR0aGlzLnJlZ2lzdGVyR3JvdXBMaXN0ZW5lcnMoZ3JvdXApO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckdyb3VwTGlzdGVuZXJzKGdyb3VwOiBJRWRpdG9yR3JvdXApOiB2b2lkIHtcblx0XHRjb25zdCBncm91cERpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGdyb3VwRGlzcG9zYWJsZXMuYWRkKGdyb3VwLm9uRGlkTW9kZWxDaGFuZ2UoZSA9PiB7XG5cdFx0XHRzd2l0Y2ggKGUua2luZCkge1xuXG5cdFx0XHRcdC8vIEdyb3VwIGdldHMgYWN0aXZlOiBwdXQgYWN0aXZlIGVkaXRvciBhcyBtb3N0IHJlY2VudFxuXHRcdFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkdST1VQX0FDVElWRToge1xuXHRcdFx0XHRcdGlmICh0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5hY3RpdmVHcm91cCA9PT0gZ3JvdXAgJiYgZ3JvdXAuYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmFkZE1vc3RSZWNlbnRFZGl0b3IoZ3JvdXAsIGdyb3VwLmFjdGl2ZUVkaXRvciwgdHJ1ZSAvKiBpcyBhY3RpdmUgKi8sIGZhbHNlIC8qIGVkaXRvciBhbHJlYWR5IG9wZW5lZCAqLyk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBFZGl0b3Igb3BlbnM6IHB1dCBpdCBhcyBzZWNvbmQgbW9zdCByZWNlbnRcblx0XHRcdFx0Ly9cblx0XHRcdFx0Ly8gQWxzbyBjaGVjayBmb3IgbWF4aW11bSBhbGxvd2VkIG51bWJlciBvZiBlZGl0b3JzIGFuZFxuXHRcdFx0XHQvLyBzdGFydCB0byBjbG9zZSBvbGRlc3Qgb25lcyBpZiBuZWVkZWQuXG5cdFx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX09QRU46IHtcblx0XHRcdFx0XHRpZiAoZS5lZGl0b3IpIHtcblx0XHRcdFx0XHRcdHRoaXMuYWRkTW9zdFJlY2VudEVkaXRvcihncm91cCwgZS5lZGl0b3IsIGZhbHNlIC8qIGlzIG5vdCBhY3RpdmUgKi8sIHRydWUgLyogaXMgbmV3ICovKTtcblx0XHRcdFx0XHRcdHRoaXMuZW5zdXJlT3BlbmVkRWRpdG9yc0xpbWl0KHsgZ3JvdXBJZDogZ3JvdXAuaWQsIGVkaXRvcjogZS5lZGl0b3IgfSwgZ3JvdXAuaWQpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gRWRpdG9yIGNsb3NlczogcmVtb3ZlIGZyb20gcmVjZW50bHkgb3BlbmVkXG5cdFx0Z3JvdXBEaXNwb3NhYmxlcy5hZGQoZ3JvdXAub25EaWRDbG9zZUVkaXRvcihlID0+IHtcblx0XHRcdHRoaXMucmVtb3ZlTW9zdFJlY2VudEVkaXRvcihncm91cCwgZS5lZGl0b3IpO1xuXHRcdH0pKTtcblxuXHRcdC8vIEVkaXRvciBnZXRzIGFjdGl2ZTogcHV0IGFjdGl2ZSBlZGl0b3IgYXMgbW9zdCByZWNlbnRcblx0XHQvLyBpZiBncm91cCBpcyBhY3RpdmUsIG90aGVyd2lzZSBzZWNvbmQgbW9zdCByZWNlbnRcblx0XHRncm91cERpc3Bvc2FibGVzLmFkZChncm91cC5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZShlID0+IHtcblx0XHRcdGlmIChlLmVkaXRvcikge1xuXHRcdFx0XHR0aGlzLmFkZE1vc3RSZWNlbnRFZGl0b3IoZ3JvdXAsIGUuZWRpdG9yLCB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5hY3RpdmVHcm91cCA9PT0gZ3JvdXAsIGZhbHNlIC8qIGVkaXRvciBhbHJlYWR5IG9wZW5lZCAqLyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gTWFrZSBzdXJlIHRvIGNsZWFudXAgb24gZGlzcG9zZVxuXHRcdEV2ZW50Lm9uY2UoZ3JvdXAub25XaWxsRGlzcG9zZSkoKCkgPT4gZGlzcG9zZShncm91cERpc3Bvc2FibGVzKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlRWRpdG9yUGFydE9wdGlvbnMoZXZlbnQ6IElFZGl0b3JQYXJ0T3B0aW9uc0NoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKCFlcXVhbHMoZXZlbnQubmV3UGFydE9wdGlvbnMubGltaXQsIGV2ZW50Lm9sZFBhcnRPcHRpb25zLmxpbWl0KSkge1xuXHRcdFx0Y29uc3QgYWN0aXZlR3JvdXAgPSB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5hY3RpdmVHcm91cDtcblx0XHRcdGxldCBleGNsdWRlOiBJRWRpdG9ySWRlbnRpZmllciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdGlmIChhY3RpdmVHcm91cC5hY3RpdmVFZGl0b3IpIHtcblx0XHRcdFx0ZXhjbHVkZSA9IHsgZWRpdG9yOiBhY3RpdmVHcm91cC5hY3RpdmVFZGl0b3IsIGdyb3VwSWQ6IGFjdGl2ZUdyb3VwLmlkIH07XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuZW5zdXJlT3BlbmVkRWRpdG9yc0xpbWl0KGV4Y2x1ZGUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYWRkTW9zdFJlY2VudEVkaXRvcihncm91cDogSUVkaXRvckdyb3VwLCBlZGl0b3I6IEVkaXRvcklucHV0LCBpc0FjdGl2ZTogYm9vbGVhbiwgaXNOZXc6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBrZXkgPSB0aGlzLmVuc3VyZUtleShncm91cCwgZWRpdG9yKTtcblx0XHRjb25zdCBtb3N0UmVjZW50RWRpdG9yID0gdGhpcy5tb3N0UmVjZW50RWRpdG9yc01hcC5maXJzdDtcblxuXHRcdC8vIEFjdGl2ZSBvciBmaXJzdCBlbnRyeTogYWRkIHRvIGVuZCBvZiBtYXBcblx0XHRpZiAoaXNBY3RpdmUgfHwgIW1vc3RSZWNlbnRFZGl0b3IpIHtcblx0XHRcdHRoaXMubW9zdFJlY2VudEVkaXRvcnNNYXAuc2V0KGtleSwga2V5LCBtb3N0UmVjZW50RWRpdG9yID8gVG91Y2guQXNPbGQgLyogbWFrZSBmaXJzdCAqLyA6IHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0Ly8gT3RoZXJ3aXNlOiBpbnNlcnQgYmVmb3JlIG1vc3QgcmVjZW50XG5cdFx0ZWxzZSB7XG5cdFx0XHQvLyB3ZSBoYXZlIG1vc3QgcmVjZW50IGVkaXRvcnMuIGFzIHN1Y2ggd2Vcblx0XHRcdC8vIHB1dCB0aGlzIG5ld2x5IG9wZW5lZCBlZGl0b3IgcmlnaHQgYmVmb3JlXG5cdFx0XHQvLyB0aGUgY3VycmVudCBtb3N0IHJlY2VudCBvbmUgYmVjYXVzZSBpdCBjYW5ub3Rcblx0XHRcdC8vIGJlIHRoZSBtb3N0IHJlY2VudGx5IGFjdGl2ZSBvbmUgdW5sZXNzXG5cdFx0XHQvLyBpdCBiZWNvbWVzIGFjdGl2ZS4gYnV0IGl0IGlzIHN0aWxsIG1vcmVcblx0XHRcdC8vIGFjdGl2ZSB0aGVuIGFueSBvdGhlciBlZGl0b3IgaW4gdGhlIGxpc3QuXG5cdFx0XHR0aGlzLm1vc3RSZWNlbnRFZGl0b3JzTWFwLnNldChrZXksIGtleSwgVG91Y2guQXNPbGQgLyogbWFrZSBmaXJzdCAqLyk7XG5cdFx0XHR0aGlzLm1vc3RSZWNlbnRFZGl0b3JzTWFwLnNldChtb3N0UmVjZW50RWRpdG9yLCBtb3N0UmVjZW50RWRpdG9yLCBUb3VjaC5Bc09sZCAvKiBtYWtlIGZpcnN0ICovKTtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgaW4gcmVzb3VyY2UgbWFwIGlmIHRoaXMgaXMgYSBuZXcgZWRpdG9yXG5cdFx0aWYgKGlzTmV3KSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUVkaXRvclJlc291cmNlc01hcChlZGl0b3IsIHRydWUpO1xuXHRcdH1cblxuXHRcdC8vIEV2ZW50XG5cdFx0dGhpcy5fb25EaWRNb3N0UmVjZW50bHlBY3RpdmVFZGl0b3JzQ2hhbmdlLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRWRpdG9yUmVzb3VyY2VzTWFwKGVkaXRvcjogRWRpdG9ySW5wdXQsIGFkZDogYm9vbGVhbik6IHZvaWQge1xuXG5cdFx0Ly8gRGlzdGlsbCB0aGUgZWRpdG9yIHJlc291cmNlIGFuZCB0eXBlIGlkIHdpdGggc3VwcG9ydFxuXHRcdC8vIGZvciBzaWRlIGJ5IHNpZGUgZWRpdG9yJ3MgcHJpbWFyeSBzaWRlIHRvby5cblx0XHRsZXQgcmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgdHlwZUlkOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IGVkaXRvcklkOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGVkaXRvciBpbnN0YW5jZW9mIFNpZGVCeVNpZGVFZGl0b3JJbnB1dCkge1xuXHRcdFx0cmVzb3VyY2UgPSBlZGl0b3IucHJpbWFyeS5yZXNvdXJjZTtcblx0XHRcdHR5cGVJZCA9IGVkaXRvci5wcmltYXJ5LnR5cGVJZDtcblx0XHRcdGVkaXRvcklkID0gZWRpdG9yLnByaW1hcnkuZWRpdG9ySWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc291cmNlID0gZWRpdG9yLnJlc291cmNlO1xuXHRcdFx0dHlwZUlkID0gZWRpdG9yLnR5cGVJZDtcblx0XHRcdGVkaXRvcklkID0gZWRpdG9yLmVkaXRvcklkO1xuXHRcdH1cblxuXHRcdGlmICghcmVzb3VyY2UpIHtcblx0XHRcdHJldHVybjsgLy8gcmVxdWlyZSBhIHJlc291cmNlXG5cdFx0fVxuXG5cdFx0Y29uc3QgaWRlbnRpZmllciA9IHRoaXMudG9JZGVudGlmaWVyKHR5cGVJZCwgZWRpdG9ySWQpO1xuXG5cdFx0Ly8gQWRkIGVudHJ5XG5cdFx0aWYgKGFkZCkge1xuXHRcdFx0bGV0IGVkaXRvcnNQZXJSZXNvdXJjZSA9IHRoaXMuZWRpdG9yc1BlclJlc291cmNlQ291bnRlci5nZXQocmVzb3VyY2UpO1xuXHRcdFx0aWYgKCFlZGl0b3JzUGVyUmVzb3VyY2UpIHtcblx0XHRcdFx0ZWRpdG9yc1BlclJlc291cmNlID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblx0XHRcdFx0dGhpcy5lZGl0b3JzUGVyUmVzb3VyY2VDb3VudGVyLnNldChyZXNvdXJjZSwgZWRpdG9yc1BlclJlc291cmNlKTtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yc1BlclJlc291cmNlLnNldChpZGVudGlmaWVyLCAoZWRpdG9yc1BlclJlc291cmNlLmdldChpZGVudGlmaWVyKSA/PyAwKSArIDEpO1xuXHRcdH1cblxuXHRcdC8vIFJlbW92ZSBlbnRyeVxuXHRcdGVsc2Uge1xuXHRcdFx0Y29uc3QgZWRpdG9yc1BlclJlc291cmNlID0gdGhpcy5lZGl0b3JzUGVyUmVzb3VyY2VDb3VudGVyLmdldChyZXNvdXJjZSk7XG5cdFx0XHRpZiAoZWRpdG9yc1BlclJlc291cmNlKSB7XG5cdFx0XHRcdGNvbnN0IGNvdW50ZXIgPSBlZGl0b3JzUGVyUmVzb3VyY2UuZ2V0KGlkZW50aWZpZXIpID8/IDA7XG5cdFx0XHRcdGlmIChjb3VudGVyID4gMSkge1xuXHRcdFx0XHRcdGVkaXRvcnNQZXJSZXNvdXJjZS5zZXQoaWRlbnRpZmllciwgY291bnRlciAtIDEpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGVkaXRvcnNQZXJSZXNvdXJjZS5kZWxldGUoaWRlbnRpZmllcik7XG5cblx0XHRcdFx0XHRpZiAoZWRpdG9yc1BlclJlc291cmNlLnNpemUgPT09IDApIHtcblx0XHRcdFx0XHRcdHRoaXMuZWRpdG9yc1BlclJlc291cmNlQ291bnRlci5kZWxldGUocmVzb3VyY2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVtb3ZlTW9zdFJlY2VudEVkaXRvcihncm91cDogSUVkaXRvckdyb3VwLCBlZGl0b3I6IEVkaXRvcklucHV0KTogdm9pZCB7XG5cblx0XHQvLyBVcGRhdGUgaW4gcmVzb3VyY2UgbWFwXG5cdFx0dGhpcy51cGRhdGVFZGl0b3JSZXNvdXJjZXNNYXAoZWRpdG9yLCBmYWxzZSk7XG5cblx0XHQvLyBVcGRhdGUgaW4gTVJVIGxpc3Rcblx0XHRjb25zdCBrZXkgPSB0aGlzLmZpbmRLZXkoZ3JvdXAsIGVkaXRvcik7XG5cdFx0aWYgKGtleSkge1xuXG5cdFx0XHQvLyBSZW1vdmUgZnJvbSBtb3N0IHJlY2VudCBlZGl0b3JzXG5cdFx0XHR0aGlzLm1vc3RSZWNlbnRFZGl0b3JzTWFwLmRlbGV0ZShrZXkpO1xuXG5cdFx0XHQvLyBSZW1vdmUgZnJvbSBrZXkgbWFwXG5cdFx0XHRjb25zdCBtYXAgPSB0aGlzLmtleU1hcC5nZXQoZ3JvdXAuaWQpO1xuXHRcdFx0aWYgKG1hcCAmJiBtYXAuZGVsZXRlKGtleS5lZGl0b3IpICYmIG1hcC5zaXplID09PSAwKSB7XG5cdFx0XHRcdHRoaXMua2V5TWFwLmRlbGV0ZShncm91cC5pZCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEV2ZW50XG5cdFx0XHR0aGlzLl9vbkRpZE1vc3RSZWNlbnRseUFjdGl2ZUVkaXRvcnNDaGFuZ2UuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZmluZEtleShncm91cDogSUVkaXRvckdyb3VwLCBlZGl0b3I6IEVkaXRvcklucHV0KTogSUVkaXRvcklkZW50aWZpZXIgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGdyb3VwTWFwID0gdGhpcy5rZXlNYXAuZ2V0KGdyb3VwLmlkKTtcblx0XHRpZiAoIWdyb3VwTWFwKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiBncm91cE1hcC5nZXQoZWRpdG9yKTtcblx0fVxuXG5cdHByaXZhdGUgZW5zdXJlS2V5KGdyb3VwOiBJRWRpdG9yR3JvdXAsIGVkaXRvcjogRWRpdG9ySW5wdXQpOiBJRWRpdG9ySWRlbnRpZmllciB7XG5cdFx0bGV0IGdyb3VwTWFwID0gdGhpcy5rZXlNYXAuZ2V0KGdyb3VwLmlkKTtcblx0XHRpZiAoIWdyb3VwTWFwKSB7XG5cdFx0XHRncm91cE1hcCA9IG5ldyBNYXAoKTtcblxuXHRcdFx0dGhpcy5rZXlNYXAuc2V0KGdyb3VwLmlkLCBncm91cE1hcCk7XG5cdFx0fVxuXG5cdFx0bGV0IGtleSA9IGdyb3VwTWFwLmdldChlZGl0b3IpO1xuXHRcdGlmICgha2V5KSB7XG5cdFx0XHRrZXkgPSB7IGdyb3VwSWQ6IGdyb3VwLmlkLCBlZGl0b3IgfTtcblx0XHRcdGdyb3VwTWFwLnNldChlZGl0b3IsIGtleSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGtleTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZW5zdXJlT3BlbmVkRWRpdG9yc0xpbWl0KGV4Y2x1ZGU6IElFZGl0b3JJZGVudGlmaWVyIHwgdW5kZWZpbmVkLCBncm91cElkPzogR3JvdXBJZGVudGlmaWVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKFxuXHRcdFx0IXRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLnBhcnRPcHRpb25zLmxpbWl0Py5lbmFibGVkIHx8XG5cdFx0XHR0eXBlb2YgdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UucGFydE9wdGlvbnMubGltaXQudmFsdWUgIT09ICdudW1iZXInIHx8XG5cdFx0XHR0aGlzLmVkaXRvckdyb3VwU2VydmljZS5wYXJ0T3B0aW9ucy5saW1pdC52YWx1ZSA8PSAwXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm47IC8vIHJldHVybiBlYXJseSBpZiBub3QgZW5hYmxlZCBvciBpbnZhbGlkXG5cdFx0fVxuXG5cdFx0Y29uc3QgbGltaXQgPSB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5wYXJ0T3B0aW9ucy5saW1pdC52YWx1ZTtcblxuXHRcdC8vIEluIGVkaXRvciBncm91cFxuXHRcdGlmICh0aGlzLmVkaXRvckdyb3VwU2VydmljZS5wYXJ0T3B0aW9ucy5saW1pdD8ucGVyRWRpdG9yR3JvdXApIHtcblxuXHRcdFx0Ly8gRm9yIHNwZWNpZmljIGVkaXRvciBncm91cHNcblx0XHRcdGlmICh0eXBlb2YgZ3JvdXBJZCA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5nZXRHcm91cChncm91cElkKTtcblx0XHRcdFx0aWYgKGdyb3VwKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5kb0Vuc3VyZU9wZW5lZEVkaXRvcnNMaW1pdChsaW1pdCwgZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLm1hcChlZGl0b3IgPT4gKHsgZWRpdG9yLCBncm91cElkIH0pKSwgZXhjbHVkZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gRm9yIGFsbCBlZGl0b3IgZ3JvdXBzXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Zm9yIChjb25zdCBncm91cCBvZiB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5ncm91cHMpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmVuc3VyZU9wZW5lZEVkaXRvcnNMaW1pdChleGNsdWRlLCBncm91cC5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBBY3Jvc3MgYWxsIGVkaXRvciBncm91cHNcblx0XHRlbHNlIHtcblx0XHRcdGF3YWl0IHRoaXMuZG9FbnN1cmVPcGVuZWRFZGl0b3JzTGltaXQobGltaXQsIFsuLi50aGlzLm1vc3RSZWNlbnRFZGl0b3JzTWFwLnZhbHVlcygpXSwgZXhjbHVkZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0Vuc3VyZU9wZW5lZEVkaXRvcnNMaW1pdChsaW1pdDogbnVtYmVyLCBtb3N0UmVjZW50RWRpdG9yczogSUVkaXRvcklkZW50aWZpZXJbXSwgZXhjbHVkZT86IElFZGl0b3JJZGVudGlmaWVyKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBDaGVjayBmb3IgYGV4Y2x1ZGVEaXJ0eWAgc2V0dGluZyBhbmQgYXBwbHkgaXQgYnkgZXhjbHVkaW5nXG5cdFx0Ly8gYW55IHJlY2VudCBlZGl0b3IgdGhhdCBpcyBkaXJ0eSBmcm9tIHRoZSBvcGVuZWQgZWRpdG9ycyBsaW1pdFxuXHRcdGxldCBtb3N0UmVjZW50RWRpdG9yc0NvdW50aW5nRm9yTGltaXQ6IElFZGl0b3JJZGVudGlmaWVyW107XG5cdFx0aWYgKHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLnBhcnRPcHRpb25zLmxpbWl0Py5leGNsdWRlRGlydHkpIHtcblx0XHRcdG1vc3RSZWNlbnRFZGl0b3JzQ291bnRpbmdGb3JMaW1pdCA9IG1vc3RSZWNlbnRFZGl0b3JzLmZpbHRlcigoeyBlZGl0b3IgfSkgPT4ge1xuXHRcdFx0XHRpZiAoKGVkaXRvci5pc0RpcnR5KCkgJiYgIWVkaXRvci5pc1NhdmluZygpKSB8fCBlZGl0b3IuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5TY3JhdGNocGFkKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTsgLy8gbm90IGRpcnR5IGVkaXRvcnMgKHVubGVzcyBpbiB0aGUgcHJvY2VzcyBvZiBzYXZpbmcpIG9yIHNjcmF0Y2hwYWRzXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtb3N0UmVjZW50RWRpdG9yc0NvdW50aW5nRm9yTGltaXQgPSBtb3N0UmVjZW50RWRpdG9ycztcblx0XHR9XG5cblx0XHRpZiAobGltaXQgPj0gbW9zdFJlY2VudEVkaXRvcnNDb3VudGluZ0ZvckxpbWl0Lmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuOyAvLyBvbmx5IGlmIG9wZW5lZCBlZGl0b3JzIGV4Y2VlZCBzZXR0aW5nIGFuZCBpcyB2YWxpZCBhbmQgZW5hYmxlZFxuXHRcdH1cblxuXHRcdC8vIEV4dHJhY3QgbGVhc3QgcmVjZW50bHkgdXNlZCBlZGl0b3JzIHRoYXQgY2FuIGJlIGNsb3NlZFxuXHRcdGNvbnN0IGxlYXN0UmVjZW50bHlDbG9zYWJsZUVkaXRvcnMgPSBtb3N0UmVjZW50RWRpdG9yc0NvdW50aW5nRm9yTGltaXQucmV2ZXJzZSgpLmZpbHRlcigoeyBlZGl0b3IsIGdyb3VwSWQgfSkgPT4ge1xuXHRcdFx0aWYgKChlZGl0b3IuaXNEaXJ0eSgpICYmICFlZGl0b3IuaXNTYXZpbmcoKSkgfHwgZWRpdG9yLmhhc0NhcGFiaWxpdHkoRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuU2NyYXRjaHBhZCkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBub3QgZGlydHkgZWRpdG9ycyAodW5sZXNzIGluIHRoZSBwcm9jZXNzIG9mIHNhdmluZykgb3Igc2NyYXRjaHBhZHNcblx0XHRcdH1cblxuXHRcdFx0aWYgKGV4Y2x1ZGUgJiYgZWRpdG9yID09PSBleGNsdWRlLmVkaXRvciAmJiBncm91cElkID09PSBleGNsdWRlLmdyb3VwSWQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBuZXZlciB0aGUgZWRpdG9yIHRoYXQgc2hvdWxkIGJlIGV4Y2x1ZGVkXG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5nZXRHcm91cChncm91cElkKT8uaXNTdGlja3koZWRpdG9yKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vIG5ldmVyIHN0aWNreSBlZGl0b3JzXG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0pO1xuXG5cdFx0Ly8gQ2xvc2UgZWRpdG9ycyB1bnRpbCB3ZSByZWFjaGVkIHRoZSBsaW1pdCBhZ2FpblxuXHRcdGxldCBlZGl0b3JzVG9DbG9zZUNvdW50ID0gbW9zdFJlY2VudEVkaXRvcnNDb3VudGluZ0ZvckxpbWl0Lmxlbmd0aCAtIGxpbWl0O1xuXHRcdGNvbnN0IG1hcEdyb3VwVG9FZGl0b3JzVG9DbG9zZSA9IG5ldyBNYXA8R3JvdXBJZGVudGlmaWVyLCBFZGl0b3JJbnB1dFtdPigpO1xuXHRcdGZvciAoY29uc3QgeyBncm91cElkLCBlZGl0b3IgfSBvZiBsZWFzdFJlY2VudGx5Q2xvc2FibGVFZGl0b3JzKSB7XG5cdFx0XHRsZXQgZWRpdG9yc0luR3JvdXBUb0Nsb3NlID0gbWFwR3JvdXBUb0VkaXRvcnNUb0Nsb3NlLmdldChncm91cElkKTtcblx0XHRcdGlmICghZWRpdG9yc0luR3JvdXBUb0Nsb3NlKSB7XG5cdFx0XHRcdGVkaXRvcnNJbkdyb3VwVG9DbG9zZSA9IFtdO1xuXHRcdFx0XHRtYXBHcm91cFRvRWRpdG9yc1RvQ2xvc2Uuc2V0KGdyb3VwSWQsIGVkaXRvcnNJbkdyb3VwVG9DbG9zZSk7XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvcnNJbkdyb3VwVG9DbG9zZS5wdXNoKGVkaXRvcik7XG5cdFx0XHRlZGl0b3JzVG9DbG9zZUNvdW50LS07XG5cblx0XHRcdGlmIChlZGl0b3JzVG9DbG9zZUNvdW50ID09PSAwKSB7XG5cdFx0XHRcdGJyZWFrOyAvLyBsaW1pdCByZWFjaGVkXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBbZ3JvdXBJZCwgZWRpdG9yc10gb2YgbWFwR3JvdXBUb0VkaXRvcnNUb0Nsb3NlKSB7XG5cdFx0XHRjb25zdCBncm91cCA9IHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyLmdldEdyb3VwKGdyb3VwSWQpO1xuXHRcdFx0aWYgKGdyb3VwKSB7XG5cdFx0XHRcdGF3YWl0IGdyb3VwLmNsb3NlRWRpdG9ycyhlZGl0b3JzLCB7IHByZXNlcnZlRm9jdXM6IHRydWUgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzYXZlU3RhdGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaXNTY29wZWQpIHtcblx0XHRcdHJldHVybjsgLy8gZG8gbm90IHBlcnNpc3Qgc3RhdGUgd2hlbiBzY29wZWRcblx0XHR9XG5cblx0XHRpZiAodGhpcy5tb3N0UmVjZW50RWRpdG9yc01hcC5pc0VtcHR5KCkpIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UucmVtb3ZlKEVkaXRvcnNPYnNlcnZlci5TVE9SQUdFX0tFWSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoRWRpdG9yc09ic2VydmVyLlNUT1JBR0VfS0VZLCBKU09OLnN0cmluZ2lmeSh0aGlzLnNlcmlhbGl6ZSgpKSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNlcmlhbGl6ZSgpOiBJU2VyaWFsaXplZEVkaXRvcnNMaXN0IHtcblx0XHRjb25zdCByZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSk7XG5cblx0XHRjb25zdCBlbnRyaWVzID0gWy4uLnRoaXMubW9zdFJlY2VudEVkaXRvcnNNYXAudmFsdWVzKCldO1xuXHRcdGNvbnN0IG1hcEdyb3VwVG9TZXJpYWxpemFibGVFZGl0b3JzT2ZHcm91cCA9IG5ldyBNYXA8SUVkaXRvckdyb3VwLCBFZGl0b3JJbnB1dFtdPigpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGVudHJpZXM6IGNvYWxlc2NlKGVudHJpZXMubWFwKCh7IGVkaXRvciwgZ3JvdXBJZCB9KSA9PiB7XG5cblx0XHRcdFx0Ly8gRmluZCBncm91cCBmb3IgZW50cnlcblx0XHRcdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5nZXRHcm91cChncm91cElkKTtcblx0XHRcdFx0aWYgKCFncm91cCkge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBGaW5kIHNlcmlhbGl6YWJsZSBlZGl0b3JzIG9mIGdyb3VwXG5cdFx0XHRcdGxldCBzZXJpYWxpemFibGVFZGl0b3JzT2ZHcm91cCA9IG1hcEdyb3VwVG9TZXJpYWxpemFibGVFZGl0b3JzT2ZHcm91cC5nZXQoZ3JvdXApO1xuXHRcdFx0XHRpZiAoIXNlcmlhbGl6YWJsZUVkaXRvcnNPZkdyb3VwKSB7XG5cdFx0XHRcdFx0c2VyaWFsaXphYmxlRWRpdG9yc09mR3JvdXAgPSBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKS5maWx0ZXIoZWRpdG9yID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGVkaXRvclNlcmlhbGl6ZXIgPSByZWdpc3RyeS5nZXRFZGl0b3JTZXJpYWxpemVyKGVkaXRvcik7XG5cblx0XHRcdFx0XHRcdHJldHVybiBlZGl0b3JTZXJpYWxpemVyPy5jYW5TZXJpYWxpemUoZWRpdG9yKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRtYXBHcm91cFRvU2VyaWFsaXphYmxlRWRpdG9yc09mR3JvdXAuc2V0KGdyb3VwLCBzZXJpYWxpemFibGVFZGl0b3JzT2ZHcm91cCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBPbmx5IHN0b3JlIHRoZSBpbmRleCBvZiB0aGUgZWRpdG9yIG9mIHRoYXQgZ3JvdXBcblx0XHRcdFx0Ly8gd2hpY2ggY2FuIGJlIHVuZGVmaW5lZCBpZiB0aGUgZWRpdG9yIGlzIG5vdCBzZXJpYWxpemFibGVcblx0XHRcdFx0Y29uc3QgaW5kZXggPSBzZXJpYWxpemFibGVFZGl0b3JzT2ZHcm91cC5pbmRleE9mKGVkaXRvcik7XG5cdFx0XHRcdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHsgZ3JvdXBJZCwgaW5kZXggfTtcblx0XHRcdH0pKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGxvYWRTdGF0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5lZGl0b3JHcm91cHNDb250YWluZXIgPT09IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLm1haW5QYXJ0IHx8IHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyID09PSB0aGlzLmVkaXRvckdyb3VwU2VydmljZSkge1xuXHRcdFx0YXdhaXQgdGhpcy5lZGl0b3JHcm91cFNlcnZpY2Uud2hlblJlYWR5O1xuXHRcdH1cblxuXHRcdC8vIFByZXZpb3VzIHN0YXRlOiBMb2FkIGVkaXRvcnMgbWFwIGZyb20gcGVyc2lzdGVkIHN0YXRlXG5cdFx0Ly8gdW5sZXNzIHdlIGFyZSBydW5uaW5nIGluIHNjb3BlZCBtb2RlXG5cdFx0bGV0IGhhc1Jlc3RvcmFibGVTdGF0ZSA9IGZhbHNlO1xuXHRcdGlmICghdGhpcy5pc1Njb3BlZCkge1xuXHRcdFx0Y29uc3Qgc2VyaWFsaXplZCA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KEVkaXRvcnNPYnNlcnZlci5TVE9SQUdFX0tFWSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdFx0XHRpZiAoc2VyaWFsaXplZCkge1xuXHRcdFx0XHRoYXNSZXN0b3JhYmxlU3RhdGUgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLmRlc2VyaWFsaXplKEpTT04ucGFyc2Uoc2VyaWFsaXplZCkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIE5vIHByZXZpb3VzIHN0YXRlOiBiZXN0IHdlIGNhbiBkbyBpcyBhZGQgZWFjaCBlZGl0b3Jcblx0XHQvLyBmcm9tIG9sZGVzdCB0byBtb3N0IHJlY2VudGx5IHVzZWQgZWRpdG9yIGdyb3VwXG5cdFx0aWYgKCFoYXNSZXN0b3JhYmxlU3RhdGUpIHtcblx0XHRcdGNvbnN0IGdyb3VwcyA9IHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyLmdldEdyb3VwcyhHcm91cHNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSk7XG5cdFx0XHRmb3IgKGxldCBpID0gZ3JvdXBzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRcdGNvbnN0IGdyb3VwID0gZ3JvdXBzW2ldO1xuXHRcdFx0XHRjb25zdCBncm91cEVkaXRvcnNNcnUgPSBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSk7XG5cdFx0XHRcdGZvciAobGV0IGkgPSBncm91cEVkaXRvcnNNcnUubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdFx0XHR0aGlzLmFkZE1vc3RSZWNlbnRFZGl0b3IoZ3JvdXAsIGdyb3VwRWRpdG9yc01ydVtpXSwgdHJ1ZSAvKiBlbmZvcmNlIGFzIGFjdGl2ZSB0byBwcmVzZXJ2ZSBvcmRlciAqLywgdHJ1ZSAvKiBpcyBuZXcgKi8pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRW5zdXJlIHdlIGxpc3RlbiBvbiBncm91cCBjaGFuZ2VzIGZvciB0aG9zZSB0aGF0IGV4aXN0IG9uIHN0YXJ0dXBcblx0XHRmb3IgKGNvbnN0IGdyb3VwIG9mIHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyLmdyb3Vwcykge1xuXHRcdFx0dGhpcy5yZWdpc3Rlckdyb3VwTGlzdGVuZXJzKGdyb3VwKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGRlc2VyaWFsaXplKHNlcmlhbGl6ZWQ6IElTZXJpYWxpemVkRWRpdG9yc0xpc3QpOiB2b2lkIHtcblx0XHRjb25zdCBtYXBWYWx1ZXM6IFtJRWRpdG9ySWRlbnRpZmllciwgSUVkaXRvcklkZW50aWZpZXJdW10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgeyBncm91cElkLCBpbmRleCB9IG9mIHNlcmlhbGl6ZWQuZW50cmllcykge1xuXG5cdFx0XHQvLyBGaW5kIGdyb3VwIGZvciBlbnRyeVxuXHRcdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5nZXRHcm91cChncm91cElkKTtcblx0XHRcdGlmICghZ3JvdXApIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZpbmQgZWRpdG9yIGZvciBlbnRyeVxuXHRcdFx0Y29uc3QgZWRpdG9yID0gZ3JvdXAuZ2V0RWRpdG9yQnlJbmRleChpbmRleCk7XG5cdFx0XHRpZiAoIWVkaXRvcikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gTWFrZSBzdXJlIGtleSBpcyByZWdpc3RlcmVkIGFzIHdlbGxcblx0XHRcdGNvbnN0IGVkaXRvcklkZW50aWZpZXIgPSB0aGlzLmVuc3VyZUtleShncm91cCwgZWRpdG9yKTtcblx0XHRcdG1hcFZhbHVlcy5wdXNoKFtlZGl0b3JJZGVudGlmaWVyLCBlZGl0b3JJZGVudGlmaWVyXSk7XG5cblx0XHRcdC8vIFVwZGF0ZSBpbiByZXNvdXJjZSBtYXBcblx0XHRcdHRoaXMudXBkYXRlRWRpdG9yUmVzb3VyY2VzTWFwKGVkaXRvciwgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0Ly8gRmlsbCBtYXAgd2l0aCBkZXNlcmlhbGl6ZWQgdmFsdWVzXG5cdFx0dGhpcy5tb3N0UmVjZW50RWRpdG9yc01hcC5mcm9tSlNPTihtYXBWYWx1ZXMpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQXFFLGtCQUFpRCxjQUFjLHNCQUFzQiwrQkFBK0I7QUFFekwsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxTQUFTLFlBQVksdUJBQXVCO0FBQ3JELFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsT0FBTyxlQUFlO0FBQy9CLFNBQVMsc0JBQW9DLG1CQUEyQztBQUN4RixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFdBQVcsT0FBTyxtQkFBbUI7QUFDOUMsU0FBUyxjQUFjO0FBc0JoQixJQUFNLGtCQUFOLGNBQThCLFdBQVc7QUFBQSxFQThDL0MsWUFDQyx1QkFDOEIsb0JBQ0ksZ0JBQ2pDO0FBQ0QsVUFBTTtBQUh3QjtBQUNJO0FBN0NuQyxTQUFpQixTQUFTLG9CQUFJLElBQTBEO0FBQ3hGLFNBQWlCLHVCQUF1QixJQUFJLFVBQWdEO0FBQzVGLFNBQWlCLDRCQUE0QixJQUFJLFlBQXFFO0FBRXRILFNBQWlCLHdDQUF3QyxLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDM0YsU0FBUyx1Q0FBdUMsS0FBSyxzQ0FBc0M7QUE0QzFGLFNBQUssd0JBQXdCLHlCQUF5QjtBQUN0RCxTQUFLLFdBQVcsQ0FBQyxDQUFDO0FBRWxCLFNBQUssa0JBQWtCO0FBQ3ZCLFNB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
