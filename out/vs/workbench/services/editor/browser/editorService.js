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
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { SideBySideEditor, isEditorInputWithOptions, SaveReason, EditorsOrder, EditorResourceAccessor, EditorInputCapabilities, isResourceDiffEditorInput, isResourceEditorInput, isEditorInput, isEditorInputWithOptionsAndGroup, isResourceMergeEditorInput } from "../../../common/editor.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { ResourceMap, ResourceSet } from "../../../../base/common/map.js";
import { IFileService, FileOperation, FileChangesEvent, FileChangeType } from "../../../../platform/files/common/files.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { URI } from "../../../../base/common/uri.js";
import { joinPath } from "../../../../base/common/resources.js";
import { DiffEditorInput } from "../../../common/editor/diffEditorInput.js";
import { SideBySideEditor as SideBySideEditorPane } from "../../../browser/parts/editor/sideBySideEditor.js";
import { IEditorGroupsService, GroupsOrder, isEditorReplacement } from "../common/editorGroupsService.js";
import { IEditorService, isPreferredGroup } from "../common/editorService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Disposable, dispose, DisposableStore } from "../../../../base/common/lifecycle.js";
import { coalesce, distinct } from "../../../../base/common/arrays.js";
import { isCodeEditor, isDiffEditor, isCompositeEditor } from "../../../../editor/browser/editorBrowser.js";
import { registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { isUndefined } from "../../../../base/common/types.js";
import { EditorsObserver } from "../../../browser/parts/editor/editorsObserver.js";
import { Promises, timeout } from "../../../../base/common/async.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { indexOfPath } from "../../../../base/common/extpath.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IEditorResolverService, ResolvedStatus } from "../common/editorResolverService.js";
import { IWorkspaceTrustRequestService, WorkspaceTrustUriResponse } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IHostService } from "../../host/browser/host.js";
import { findGroup } from "../common/editorGroupFinder.js";
import { ITextEditorService } from "../../textfile/common/textEditorService.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
let EditorService = class extends Disposable {
  constructor(editorGroupsContainer, editorGroupService, instantiationService, fileService, configurationService, contextService, uriIdentityService, editorResolverService, workspaceTrustRequestService, hostService, textEditorService) {
    super();
    this.editorGroupService = editorGroupService;
    this.instantiationService = instantiationService;
    this.fileService = fileService;
    this.configurationService = configurationService;
    this.contextService = contextService;
    this.uriIdentityService = uriIdentityService;
    this.editorResolverService = editorResolverService;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
    this.hostService = hostService;
    this.textEditorService = textEditorService;
    //#region events
    this._onDidActiveEditorChange = this._register(new Emitter());
    this.onDidActiveEditorChange = this._onDidActiveEditorChange.event;
    this._onDidVisibleEditorsChange = this._register(new Emitter());
    this.onDidVisibleEditorsChange = this._onDidVisibleEditorsChange.event;
    this._onDidEditorsChange = this._register(new Emitter());
    this.onDidEditorsChange = this._onDidEditorsChange.event;
    this._onWillOpenEditor = this._register(new Emitter());
    this.onWillOpenEditor = this._onWillOpenEditor.event;
    this._onDidCloseEditor = this._register(new Emitter());
    this.onDidCloseEditor = this._onDidCloseEditor.event;
    this._onDidOpenEditorFail = this._register(new Emitter());
    this.onDidOpenEditorFail = this._onDidOpenEditorFail.event;
    this._onDidMostRecentlyActiveEditorsChange = this._register(new Emitter());
    this.onDidMostRecentlyActiveEditorsChange = this._onDidMostRecentlyActiveEditorsChange.event;
    //#region Editor & group event handlers
    this.lastActiveEditor = void 0;
    //#endregion
    //#region Visible Editors Change: Install file watchers for out of workspace resources that became visible
    this.activeOutOfWorkspaceWatchers = new ResourceMap();
    this.closeOnFileDelete = false;
    this.editorGroupsContainer = editorGroupsContainer ?? editorGroupService;
    this.editorsObserver = this._register(this.instantiationService.createInstance(EditorsObserver, this.editorGroupsContainer));
    this.onConfigurationUpdated();
    this.registerListeners();
  }
  createScoped(editorGroupsContainer, disposables) {
    return disposables.add(new EditorService(editorGroupsContainer === "main" ? this.editorGroupService.mainPart : editorGroupsContainer, this.editorGroupService, this.instantiationService, this.fileService, this.configurationService, this.contextService, this.uriIdentityService, this.editorResolverService, this.workspaceTrustRequestService, this.hostService, this.textEditorService));
  }
  registerListeners() {
    if (this.editorGroupsContainer === this.editorGroupService.mainPart || this.editorGroupsContainer === this.editorGroupService) {
      this.editorGroupService.whenReady.then(() => this.onEditorGroupsReady());
    } else {
      this.onEditorGroupsReady();
    }
    this._register(this.editorGroupsContainer.onDidChangeActiveGroup((group) => this.handleActiveEditorChange(group)));
    this._register(this.editorGroupsContainer.onDidAddGroup((group) => this.registerGroupListeners(group)));
    this._register(this.editorsObserver.onDidMostRecentlyActiveEditorsChange(() => this._onDidMostRecentlyActiveEditorsChange.fire()));
    this._register(this.onDidVisibleEditorsChange(() => this.handleVisibleEditorsChange()));
    this._register(this.fileService.onDidRunOperation((e) => this.onDidRunFileOperation(e)));
    this._register(this.fileService.onDidFilesChange((e) => this.onDidFilesChange(e)));
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationUpdated(e)));
  }
  onEditorGroupsReady() {
    for (const group of this.editorGroupsContainer.groups) {
      this.registerGroupListeners(group);
    }
    if (this.activeEditor) {
      this.doHandleActiveEditorChangeEvent();
      this._onDidVisibleEditorsChange.fire();
    }
  }
  handleActiveEditorChange(group) {
    if (group !== this.editorGroupsContainer.activeGroup) {
      return;
    }
    if (!this.lastActiveEditor && !group.activeEditor) {
      return;
    }
    this.doHandleActiveEditorChangeEvent();
  }
  doHandleActiveEditorChangeEvent() {
    const activeGroup = this.editorGroupsContainer.activeGroup;
    this.lastActiveEditor = activeGroup.activeEditor ?? void 0;
    this._onDidActiveEditorChange.fire();
  }
  registerGroupListeners(group) {
    const groupDisposables = new DisposableStore();
    groupDisposables.add(group.onDidModelChange((e) => {
      this._onDidEditorsChange.fire({ groupId: group.id, event: e });
    }));
    groupDisposables.add(group.onDidActiveEditorChange(() => {
      this.handleActiveEditorChange(group);
      this._onDidVisibleEditorsChange.fire();
    }));
    groupDisposables.add(group.onWillOpenEditor((e) => {
      this._onWillOpenEditor.fire(e);
    }));
    groupDisposables.add(group.onDidCloseEditor((e) => {
      this._onDidCloseEditor.fire(e);
    }));
    groupDisposables.add(group.onDidOpenEditorFail((editor) => {
      this._onDidOpenEditorFail.fire({ editor, groupId: group.id });
    }));
    Event.once(group.onWillDispose)(() => {
      dispose(groupDisposables);
    });
  }
  handleVisibleEditorsChange() {
    const visibleOutOfWorkspaceResources = new ResourceSet();
    for (const editor of this.visibleEditors) {
      const resources = distinct(coalesce([
        EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY }),
        EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.SECONDARY })
      ]), (resource) => resource.toString());
      for (const resource of resources) {
        if (this.fileService.hasProvider(resource) && !this.contextService.isInsideWorkspace(resource)) {
          visibleOutOfWorkspaceResources.add(resource);
        }
      }
    }
    for (const resource of this.activeOutOfWorkspaceWatchers.keys()) {
      if (!visibleOutOfWorkspaceResources.has(resource)) {
        dispose(this.activeOutOfWorkspaceWatchers.get(resource));
        this.activeOutOfWorkspaceWatchers.delete(resource);
      }
    }
    for (const resource of visibleOutOfWorkspaceResources.keys()) {
      if (!this.activeOutOfWorkspaceWatchers.get(resource)) {
        const disposable = this.fileService.watch(resource);
        this.activeOutOfWorkspaceWatchers.set(resource, disposable);
      }
    }
  }
  //#endregion
  //#region File Changes: Move & Deletes to move or close opend editors
  async onDidRunFileOperation(e) {
    if (e.isOperation(FileOperation.MOVE)) {
      this.handleMovedFile(e.resource, e.target.resource);
    }
    if (e.isOperation(FileOperation.DELETE) || e.isOperation(FileOperation.MOVE)) {
      this.handleDeletedFile(e.resource, false, e.target ? e.target.resource : void 0);
    }
  }
  onDidFilesChange(e) {
    if (e.gotDeleted()) {
      this.handleDeletedFile(e, true);
    }
  }
  async handleMovedFile(source, target) {
    for (const group of this.editorGroupsContainer.groups) {
      const replacements = [];
      for (const editor of group.editors) {
        const resource = editor.resource;
        if (!resource || !this.uriIdentityService.extUri.isEqualOrParent(resource, source)) {
          continue;
        }
        let targetResource;
        if (this.uriIdentityService.extUri.isEqual(source, resource)) {
          targetResource = target;
        } else {
          const index = indexOfPath(resource.path, source.path, this.uriIdentityService.extUri.ignorePathCasing(resource));
          targetResource = joinPath(target, resource.path.substr(index + source.path.length + 1));
        }
        const moveResult = await editor.rename(group.id, targetResource);
        if (!moveResult) {
          return;
        }
        const optionOverrides = {
          preserveFocus: true,
          pinned: group.isPinned(editor),
          sticky: group.isSticky(editor),
          index: group.getIndexOfEditor(editor),
          inactive: !group.isActive(editor)
        };
        if (isEditorInput(moveResult.editor)) {
          replacements.push({
            editor,
            replacement: moveResult.editor,
            options: {
              ...moveResult.options,
              ...optionOverrides
            }
          });
        } else {
          replacements.push({
            editor,
            replacement: {
              ...moveResult.editor,
              options: {
                ...moveResult.editor.options,
                ...optionOverrides
              }
            }
          });
        }
      }
      if (replacements.length) {
        this.replaceEditors(replacements, group);
      }
    }
  }
  onConfigurationUpdated(e) {
    if (e && !e.affectsConfiguration("workbench.editor.closeOnFileDelete")) {
      return;
    }
    const configuration = this.configurationService.getValue();
    if (typeof configuration.workbench?.editor?.closeOnFileDelete === "boolean") {
      this.closeOnFileDelete = configuration.workbench.editor.closeOnFileDelete;
    } else {
      this.closeOnFileDelete = false;
    }
  }
  handleDeletedFile(arg1, isExternal, movedTo) {
    for (const editor of this.getAllNonDirtyEditors({ includeUntitled: false, supportSideBySide: true })) {
      (async () => {
        const resource = editor.resource;
        if (!resource) {
          return;
        }
        if (this.closeOnFileDelete || !isExternal) {
          if (movedTo && this.uriIdentityService.extUri.isEqualOrParent(resource, movedTo)) {
            return;
          }
          let matches = false;
          if (arg1 instanceof FileChangesEvent) {
            matches = arg1.contains(resource, FileChangeType.DELETED);
          } else {
            matches = this.uriIdentityService.extUri.isEqualOrParent(resource, arg1);
          }
          if (!matches) {
            return;
          }
          let exists = false;
          if (isExternal && this.fileService.hasProvider(resource)) {
            await timeout(100);
            exists = await this.fileService.exists(resource);
          }
          if (!exists && !editor.isDisposed()) {
            editor.dispose();
          }
        }
      })();
    }
  }
  getAllNonDirtyEditors(options) {
    const editors = [];
    function conditionallyAddEditor(editor) {
      if (editor.hasCapability(EditorInputCapabilities.Untitled) && !options.includeUntitled) {
        return;
      }
      if (editor.isDirty()) {
        return;
      }
      editors.push(editor);
    }
    for (const editor of this.editors) {
      if (options.supportSideBySide && editor instanceof SideBySideEditorInput) {
        conditionallyAddEditor(editor.primary);
        conditionallyAddEditor(editor.secondary);
      } else {
        conditionallyAddEditor(editor);
      }
    }
    return editors;
  }
  get activeEditorPane() {
    return this.editorGroupsContainer.activeGroup?.activeEditorPane;
  }
  get activeTextEditorControl() {
    const activeEditorPane = this.activeEditorPane;
    if (activeEditorPane) {
      const activeControl = activeEditorPane.getControl();
      if (isCodeEditor(activeControl) || isDiffEditor(activeControl)) {
        return activeControl;
      }
      if (isCompositeEditor(activeControl) && isCodeEditor(activeControl.activeCodeEditor)) {
        return activeControl.activeCodeEditor;
      }
    }
    return void 0;
  }
  get activeTextEditorLanguageId() {
    let activeCodeEditor = void 0;
    const activeTextEditorControl = this.activeTextEditorControl;
    if (isDiffEditor(activeTextEditorControl)) {
      activeCodeEditor = activeTextEditorControl.getModifiedEditor();
    } else {
      activeCodeEditor = activeTextEditorControl;
    }
    return activeCodeEditor?.getModel()?.getLanguageId();
  }
  get count() {
    return this.editorsObserver.count;
  }
  get editors() {
    return this.getEditors(EditorsOrder.SEQUENTIAL).map(({ editor }) => editor);
  }
  getEditors(order, options) {
    switch (order) {
      // MRU
      case EditorsOrder.MOST_RECENTLY_ACTIVE:
        if (options?.excludeSticky) {
          return this.editorsObserver.editors.filter(({ groupId, editor }) => !this.editorGroupsContainer.getGroup(groupId)?.isSticky(editor));
        }
        return this.editorsObserver.editors;
      // Sequential
      case EditorsOrder.SEQUENTIAL: {
        const editors = [];
        for (const group of this.editorGroupsContainer.getGroups(GroupsOrder.GRID_APPEARANCE)) {
          editors.push(...group.getEditors(EditorsOrder.SEQUENTIAL, options).map((editor) => ({ editor, groupId: group.id })));
        }
        return editors;
      }
    }
  }
  get activeEditor() {
    const activeGroup = this.editorGroupsContainer.activeGroup;
    return activeGroup ? activeGroup.activeEditor ?? void 0 : void 0;
  }
  get visibleEditorPanes() {
    return coalesce(this.editorGroupsContainer.groups.map((group) => group.activeEditorPane));
  }
  get visibleTextEditorControls() {
    return this.doGetVisibleTextEditorControls(this.visibleEditorPanes);
  }
  doGetVisibleTextEditorControls(editorPanes) {
    const visibleTextEditorControls = [];
    for (const editorPane of editorPanes) {
      const controls = [];
      if (editorPane instanceof SideBySideEditorPane) {
        controls.push(editorPane.getPrimaryEditorPane()?.getControl());
        controls.push(editorPane.getSecondaryEditorPane()?.getControl());
      } else {
        controls.push(editorPane.getControl());
      }
      for (const control of controls) {
        if (isCodeEditor(control) || isDiffEditor(control)) {
          visibleTextEditorControls.push(control);
        }
      }
    }
    return visibleTextEditorControls;
  }
  getVisibleTextEditorControls(order) {
    return this.doGetVisibleTextEditorControls(coalesce(this.editorGroupsContainer.getGroups(order === EditorsOrder.SEQUENTIAL ? GroupsOrder.GRID_APPEARANCE : GroupsOrder.MOST_RECENTLY_ACTIVE).map((group) => group.activeEditorPane)));
  }
  get visibleEditors() {
    return coalesce(this.editorGroupsContainer.groups.map((group) => group.activeEditor));
  }
  async openEditor(editor, optionsOrPreferredGroup, preferredGroup) {
    let typedEditor = void 0;
    let options = isEditorInput(editor) ? optionsOrPreferredGroup : editor.options;
    let group = void 0;
    if (isPreferredGroup(optionsOrPreferredGroup)) {
      preferredGroup = optionsOrPreferredGroup;
    }
    if (!isEditorInput(editor)) {
      const resolvedEditor = await this.editorResolverService.resolveEditor(editor, preferredGroup);
      if (resolvedEditor === ResolvedStatus.ABORT) {
        return;
      }
      if (isEditorInputWithOptionsAndGroup(resolvedEditor)) {
        typedEditor = resolvedEditor.editor;
        options = resolvedEditor.options;
        group = resolvedEditor.group;
      }
    }
    if (!typedEditor) {
      typedEditor = isEditorInput(editor) ? editor : await this.textEditorService.resolveTextEditor(editor);
    }
    if (!group) {
      let activation = void 0;
      const findGroupResult = this.instantiationService.invokeFunction(findGroup, { editor: typedEditor, options }, preferredGroup);
      if (findGroupResult instanceof Promise) {
        [group, activation] = await findGroupResult;
      } else {
        [group, activation] = findGroupResult;
      }
      if (activation) {
        options = { ...options, activation };
      }
    }
    return group.openEditor(typedEditor, options);
  }
  async openEditors(editors, preferredGroup, options) {
    if (options?.validateTrust) {
      const editorsTrusted = await this.handleWorkspaceTrust(editors);
      if (!editorsTrusted) {
        return [];
      }
    }
    const mapGroupToTypedEditors = /* @__PURE__ */ new Map();
    for (const editor of editors) {
      let typedEditor = void 0;
      let group = void 0;
      if (!isEditorInputWithOptions(editor)) {
        const resolvedEditor = await this.editorResolverService.resolveEditor(editor, preferredGroup);
        if (resolvedEditor === ResolvedStatus.ABORT) {
          continue;
        }
        if (isEditorInputWithOptionsAndGroup(resolvedEditor)) {
          typedEditor = resolvedEditor;
          group = resolvedEditor.group;
        }
      }
      if (!typedEditor) {
        typedEditor = isEditorInputWithOptions(editor) ? editor : { editor: await this.textEditorService.resolveTextEditor(editor), options: editor.options };
      }
      if (!group) {
        const findGroupResult = this.instantiationService.invokeFunction(findGroup, typedEditor, preferredGroup);
        if (findGroupResult instanceof Promise) {
          [group] = await findGroupResult;
        } else {
          [group] = findGroupResult;
        }
      }
      let targetGroupEditors = mapGroupToTypedEditors.get(group);
      if (!targetGroupEditors) {
        targetGroupEditors = [];
        mapGroupToTypedEditors.set(group, targetGroupEditors);
      }
      targetGroupEditors.push(typedEditor);
    }
    const result = [];
    for (const [group, editors2] of mapGroupToTypedEditors) {
      result.push(group.openEditors(editors2));
    }
    return coalesce(await Promises.settled(result));
  }
  async handleWorkspaceTrust(editors) {
    const { resources, diffMode, mergeMode } = this.extractEditorResources(editors);
    const trustResult = await this.workspaceTrustRequestService.requestOpenFilesTrust(resources);
    switch (trustResult) {
      case WorkspaceTrustUriResponse.Open:
        return true;
      case WorkspaceTrustUriResponse.OpenInNewWindow:
        await this.hostService.openWindow(resources.map((resource) => ({ fileUri: resource })), { forceNewWindow: true, diffMode, mergeMode });
        return false;
      case WorkspaceTrustUriResponse.Cancel:
        return false;
    }
  }
  extractEditorResources(editors) {
    const resources = new ResourceSet();
    let diffMode = false;
    let mergeMode = false;
    for (const editor of editors) {
      if (isEditorInputWithOptions(editor)) {
        const resource = EditorResourceAccessor.getOriginalUri(editor.editor, { supportSideBySide: SideBySideEditor.BOTH });
        if (URI.isUri(resource)) {
          resources.add(resource);
        } else if (resource) {
          if (resource.primary) {
            resources.add(resource.primary);
          }
          if (resource.secondary) {
            resources.add(resource.secondary);
          }
          diffMode = editor.editor instanceof DiffEditorInput;
        }
      } else {
        if (isResourceMergeEditorInput(editor)) {
          if (URI.isUri(editor.input1)) {
            resources.add(editor.input1.resource);
          }
          if (URI.isUri(editor.input2)) {
            resources.add(editor.input2.resource);
          }
          if (URI.isUri(editor.base)) {
            resources.add(editor.base.resource);
          }
          if (URI.isUri(editor.result)) {
            resources.add(editor.result.resource);
          }
          mergeMode = true;
        }
        if (isResourceDiffEditorInput(editor)) {
          if (URI.isUri(editor.original.resource)) {
            resources.add(editor.original.resource);
          }
          if (URI.isUri(editor.modified.resource)) {
            resources.add(editor.modified.resource);
          }
          diffMode = true;
        } else if (isResourceEditorInput(editor)) {
          resources.add(editor.resource);
        }
      }
    }
    return {
      resources: Array.from(resources.keys()),
      diffMode,
      mergeMode
    };
  }
  //#endregion
  //#region isOpened() / isVisible()
  isOpened(editor) {
    return this.editorsObserver.hasEditor({
      resource: this.uriIdentityService.asCanonicalUri(editor.resource),
      typeId: editor.typeId,
      editorId: editor.editorId
    });
  }
  isVisible(editor) {
    for (const group of this.editorGroupsContainer.groups) {
      if (group.activeEditor?.matches(editor)) {
        return true;
      }
    }
    return false;
  }
  //#endregion
  //#region closeEditor()
  async closeEditor({ editor, groupId }, options) {
    const group = this.editorGroupsContainer.getGroup(groupId);
    await group?.closeEditor(editor, options);
  }
  //#endregion
  //#region closeEditors()
  async closeEditors(editors, options) {
    const mapGroupToEditors = /* @__PURE__ */ new Map();
    for (const { editor, groupId } of editors) {
      const group = this.editorGroupsContainer.getGroup(groupId);
      if (!group) {
        continue;
      }
      let editors2 = mapGroupToEditors.get(group);
      if (!editors2) {
        editors2 = [];
        mapGroupToEditors.set(group, editors2);
      }
      editors2.push(editor);
    }
    for (const [group, editors2] of mapGroupToEditors) {
      await group.closeEditors(editors2, options);
    }
  }
  findEditors(arg1, options, arg2) {
    const resource = URI.isUri(arg1) ? arg1 : arg1.resource;
    const typeId = URI.isUri(arg1) ? void 0 : arg1.typeId;
    if (options?.supportSideBySide !== SideBySideEditor.ANY && options?.supportSideBySide !== SideBySideEditor.SECONDARY) {
      if (!this.editorsObserver.hasEditors(resource)) {
        if (URI.isUri(arg1) || isUndefined(arg2)) {
          return [];
        }
        return void 0;
      }
    }
    if (!isUndefined(arg2)) {
      const targetGroup = typeof arg2 === "number" ? this.editorGroupsContainer.getGroup(arg2) : arg2;
      if (URI.isUri(arg1)) {
        if (!targetGroup) {
          return [];
        }
        return targetGroup.findEditors(resource, options);
      } else {
        if (!targetGroup) {
          return void 0;
        }
        const editors = targetGroup.findEditors(resource, options);
        for (const editor of editors) {
          if (editor.typeId === typeId) {
            return editor;
          }
        }
        return void 0;
      }
    } else {
      const result = [];
      for (const group of this.editorGroupsContainer.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
        const editors = [];
        if (URI.isUri(arg1)) {
          editors.push(...this.findEditors(arg1, options, group));
        } else {
          const editor = this.findEditors(arg1, options, group);
          if (editor) {
            editors.push(editor);
          }
        }
        result.push(...editors.map((editor) => ({ editor, groupId: group.id })));
      }
      return result;
    }
  }
  async replaceEditors(replacements, group) {
    const targetGroup = typeof group === "number" ? this.editorGroupsContainer.getGroup(group) : group;
    const typedReplacements = [];
    for (const replacement of replacements) {
      let typedReplacement = void 0;
      if (!isEditorInput(replacement.replacement)) {
        const resolvedEditor = await this.editorResolverService.resolveEditor(
          replacement.replacement,
          targetGroup
        );
        if (resolvedEditor === ResolvedStatus.ABORT) {
          continue;
        }
        if (isEditorInputWithOptionsAndGroup(resolvedEditor)) {
          typedReplacement = {
            editor: replacement.editor,
            replacement: resolvedEditor.editor,
            options: resolvedEditor.options,
            forceReplaceDirty: replacement.forceReplaceDirty
          };
        }
      }
      if (!typedReplacement) {
        typedReplacement = {
          editor: replacement.editor,
          replacement: isEditorReplacement(replacement) ? replacement.replacement : await this.textEditorService.resolveTextEditor(replacement.replacement),
          options: isEditorReplacement(replacement) ? replacement.options : replacement.replacement.options,
          forceReplaceDirty: replacement.forceReplaceDirty
        };
      }
      typedReplacements.push(typedReplacement);
    }
    return targetGroup?.replaceEditors(typedReplacements);
  }
  //#endregion
  //#region save/revert
  async save(editors, options) {
    if (!Array.isArray(editors)) {
      editors = [editors];
    }
    const uniqueEditors = this.getUniqueEditors(editors);
    const editorsToSaveParallel = [];
    const editorsToSaveSequentially = [];
    if (options?.saveAs) {
      editorsToSaveSequentially.push(...uniqueEditors);
    } else {
      for (const { groupId, editor } of uniqueEditors) {
        if (editor.hasCapability(EditorInputCapabilities.Untitled)) {
          editorsToSaveSequentially.push({ groupId, editor });
        } else {
          editorsToSaveParallel.push({ groupId, editor });
        }
      }
    }
    const saveResults = await Promises.settled(editorsToSaveParallel.map(({ groupId, editor }) => {
      if (options?.reason === SaveReason.EXPLICIT) {
        this.editorGroupsContainer.getGroup(groupId)?.pinEditor(editor);
      }
      return editor.save(groupId, options);
    }));
    for (const { groupId, editor } of editorsToSaveSequentially) {
      if (editor.isDisposed()) {
        continue;
      }
      const editorPane = await this.openEditor(editor, groupId);
      const editorOptions = {
        pinned: true,
        viewState: editorPane?.getViewState()
      };
      const result = options?.saveAs ? await editor.saveAs(groupId, options) : await editor.save(groupId, options);
      saveResults.push(result);
      if (!result) {
        break;
      }
      if (!editor.matches(result)) {
        const targetGroups = editor.hasCapability(EditorInputCapabilities.Untitled) ? this.editorGroupsContainer.groups.map((group) => group.id) : [groupId];
        for (const targetGroup of targetGroups) {
          if (result instanceof EditorInput) {
            await this.replaceEditors([{ editor, replacement: result, options: editorOptions }], targetGroup);
          } else {
            await this.replaceEditors([{ editor, replacement: { ...result, options: editorOptions } }], targetGroup);
          }
        }
      }
    }
    return {
      success: saveResults.every((result) => !!result),
      editors: coalesce(saveResults)
    };
  }
  saveAll(options) {
    return this.save(this.getAllModifiedEditors(options), options);
  }
  async revert(editors, options) {
    if (!Array.isArray(editors)) {
      editors = [editors];
    }
    const uniqueEditors = this.getUniqueEditors(editors);
    await Promises.settled(uniqueEditors.map(async ({ groupId, editor }) => {
      this.editorGroupsContainer.getGroup(groupId)?.pinEditor(editor);
      return editor.revert(groupId, options);
    }));
    return !uniqueEditors.some(({ editor }) => editor.isDirty());
  }
  async revertAll(options) {
    return this.revert(this.getAllModifiedEditors(options), options);
  }
  getAllModifiedEditors(options) {
    const editors = [];
    for (const group of this.editorGroupsContainer.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
      for (const editor of group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)) {
        if (!editor.isModified()) {
          continue;
        }
        if ((typeof options?.includeUntitled === "boolean" || !options?.includeUntitled?.includeScratchpad) && editor.hasCapability(EditorInputCapabilities.Scratchpad)) {
          continue;
        }
        if (!options?.includeUntitled && editor.hasCapability(EditorInputCapabilities.Untitled)) {
          continue;
        }
        if (options?.excludeSticky && group.isSticky(editor)) {
          continue;
        }
        editors.push({ groupId: group.id, editor });
      }
    }
    return editors;
  }
  getUniqueEditors(editors) {
    const uniqueEditors = [];
    for (const { editor, groupId } of editors) {
      if (uniqueEditors.some((uniqueEditor) => uniqueEditor.editor.matches(editor))) {
        continue;
      }
      uniqueEditors.push({ editor, groupId });
    }
    return uniqueEditors;
  }
  //#endregion
  dispose() {
    super.dispose();
    this.activeOutOfWorkspaceWatchers.forEach((disposable) => dispose(disposable));
    this.activeOutOfWorkspaceWatchers.clear();
  }
};
EditorService = __decorateClass([
  __decorateParam(1, IEditorGroupsService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, IUriIdentityService),
  __decorateParam(7, IEditorResolverService),
  __decorateParam(8, IWorkspaceTrustRequestService),
  __decorateParam(9, IHostService),
  __decorateParam(10, ITextEditorService)
], EditorService);
registerSingleton(IEditorService, new SyncDescriptor(EditorService, [void 0], false));
export {
  EditorService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZWRpdG9yL2Jyb3dzZXIvZWRpdG9yU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVJlc291cmNlRWRpdG9ySW5wdXQsIElFZGl0b3JPcHRpb25zLCBFZGl0b3JBY3RpdmF0aW9uLCBJUmVzb3VyY2VFZGl0b3JJbnB1dElkZW50aWZpZXIsIElUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IFNpZGVCeVNpZGVFZGl0b3IsIElFZGl0b3JQYW5lLCBHcm91cElkZW50aWZpZXIsIElVbnRpdGxlZFRleHRSZXNvdXJjZUVkaXRvcklucHV0LCBJUmVzb3VyY2VEaWZmRWRpdG9ySW5wdXQsIEVkaXRvcklucHV0V2l0aE9wdGlvbnMsIGlzRWRpdG9ySW5wdXRXaXRoT3B0aW9ucywgSUVkaXRvcklkZW50aWZpZXIsIElFZGl0b3JDbG9zZUV2ZW50LCBJVGV4dERpZmZFZGl0b3JQYW5lLCBJUmV2ZXJ0T3B0aW9ucywgU2F2ZVJlYXNvbiwgRWRpdG9yc09yZGVyLCBJV29ya2JlbmNoRWRpdG9yQ29uZmlndXJhdGlvbiwgRWRpdG9yUmVzb3VyY2VBY2Nlc3NvciwgSVZpc2libGVFZGl0b3JQYW5lLCBFZGl0b3JJbnB1dENhcGFiaWxpdGllcywgaXNSZXNvdXJjZURpZmZFZGl0b3JJbnB1dCwgSVVudHlwZWRFZGl0b3JJbnB1dCwgaXNSZXNvdXJjZUVkaXRvcklucHV0LCBpc0VkaXRvcklucHV0LCBpc0VkaXRvcklucHV0V2l0aE9wdGlvbnNBbmRHcm91cCwgSUZpbmRFZGl0b3JPcHRpb25zLCBpc1Jlc291cmNlTWVyZ2VFZGl0b3JJbnB1dCwgSUVkaXRvcldpbGxPcGVuRXZlbnQsIElFZGl0b3JDb250cm9sIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgU2lkZUJ5U2lkZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9zaWRlQnlTaWRlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAsIFJlc291cmNlU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSwgRmlsZU9wZXJhdGlvbkV2ZW50LCBGaWxlT3BlcmF0aW9uLCBGaWxlQ2hhbmdlc0V2ZW50LCBGaWxlQ2hhbmdlVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2RpZmZFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBTaWRlQnlTaWRlRWRpdG9yIGFzIFNpZGVCeVNpZGVFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3Ivc2lkZUJ5U2lkZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSwgSUVkaXRvckdyb3VwLCBHcm91cHNPcmRlciwgSUVkaXRvclJlcGxhY2VtZW50LCBpc0VkaXRvclJlcGxhY2VtZW50LCBJQ2xvc2VFZGl0b3JPcHRpb25zLCBJRWRpdG9yR3JvdXBzQ29udGFpbmVyIH0gZnJvbSAnLi4vY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVudHlwZWRFZGl0b3JSZXBsYWNlbWVudCwgSUVkaXRvclNlcnZpY2UsIElTYXZlRWRpdG9yc09wdGlvbnMsIElTYXZlQWxsRWRpdG9yc09wdGlvbnMsIElSZXZlcnRBbGxFZGl0b3JzT3B0aW9ucywgSUJhc2VTYXZlUmV2ZXJ0QWxsRWRpdG9yT3B0aW9ucywgSU9wZW5FZGl0b3JzT3B0aW9ucywgUHJlZmVycmVkR3JvdXAsIGlzUHJlZmVycmVkR3JvdXAsIElFZGl0b3JzQ2hhbmdlRXZlbnQsIElTYXZlRWRpdG9yc1Jlc3VsdCB9IGZyb20gJy4uL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQsIElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIGRpc3Bvc2UsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSwgZGlzdGluY3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgaXNDb2RlRWRpdG9yLCBpc0RpZmZFZGl0b3IsIElDb2RlRWRpdG9yLCBJRGlmZkVkaXRvciwgaXNDb21wb3NpdGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cFZpZXcsIEVkaXRvclNlcnZpY2VJbXBsIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBpc1VuZGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IEVkaXRvcnNPYnNlcnZlciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvcnNPYnNlcnZlci5qcyc7XG5pbXBvcnQgeyBQcm9taXNlcywgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IGluZGV4T2ZQYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXh0cGF0aC5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElFZGl0b3JSZXNvbHZlclNlcnZpY2UsIFJlc29sdmVkU3RhdHVzIH0gZnJvbSAnLi4vY29tbW9uL2VkaXRvclJlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZSwgV29ya3NwYWNlVHJ1c3RVcmlSZXNwb25zZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlVHJ1c3QuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgZmluZEdyb3VwIH0gZnJvbSAnLi4vY29tbW9uL2VkaXRvckdyb3VwRmluZGVyLmpzJztcbmltcG9ydCB7IElUZXh0RWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL3RleHRmaWxlL2NvbW1vbi90ZXh0RWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcblxuZXhwb3J0IGNsYXNzIEVkaXRvclNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgRWRpdG9yU2VydmljZUltcGwge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdC8vI3JlZ2lvbiBldmVudHNcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSA9IHRoaXMuX29uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkVmlzaWJsZUVkaXRvcnNDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRWaXNpYmxlRWRpdG9yc0NoYW5nZSA9IHRoaXMuX29uRGlkVmlzaWJsZUVkaXRvcnNDaGFuZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRFZGl0b3JzQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUVkaXRvcnNDaGFuZ2VFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRWRpdG9yc0NoYW5nZSA9IHRoaXMuX29uRGlkRWRpdG9yc0NoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbldpbGxPcGVuRWRpdG9yID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUVkaXRvcldpbGxPcGVuRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbldpbGxPcGVuRWRpdG9yID0gdGhpcy5fb25XaWxsT3BlbkVkaXRvci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENsb3NlRWRpdG9yID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUVkaXRvckNsb3NlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENsb3NlRWRpdG9yID0gdGhpcy5fb25EaWRDbG9zZUVkaXRvci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZE9wZW5FZGl0b3JGYWlsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUVkaXRvcklkZW50aWZpZXI+KCkpO1xuXHRyZWFkb25seSBvbkRpZE9wZW5FZGl0b3JGYWlsID0gdGhpcy5fb25EaWRPcGVuRWRpdG9yRmFpbC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZE1vc3RSZWNlbnRseUFjdGl2ZUVkaXRvcnNDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRNb3N0UmVjZW50bHlBY3RpdmVFZGl0b3JzQ2hhbmdlID0gdGhpcy5fb25EaWRNb3N0UmVjZW50bHlBY3RpdmVFZGl0b3JzQ2hhbmdlLmV2ZW50O1xuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yR3JvdXBzQ29udGFpbmVyOiBJRWRpdG9yR3JvdXBzQ29udGFpbmVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvckdyb3Vwc0NvbnRhaW5lcjogSUVkaXRvckdyb3Vwc0NvbnRhaW5lciB8IHVuZGVmaW5lZCxcblx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlOiBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2U6IElXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJVGV4dEVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0RWRpdG9yU2VydmljZTogSVRleHRFZGl0b3JTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lciA9IGVkaXRvckdyb3Vwc0NvbnRhaW5lciA/PyBlZGl0b3JHcm91cFNlcnZpY2U7XG5cdFx0dGhpcy5lZGl0b3JzT2JzZXJ2ZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRvcnNPYnNlcnZlciwgdGhpcy5lZGl0b3JHcm91cHNDb250YWluZXIpKTtcblxuXHRcdHRoaXMub25Db25maWd1cmF0aW9uVXBkYXRlZCgpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0Y3JlYXRlU2NvcGVkKGVkaXRvckdyb3Vwc0NvbnRhaW5lcjogSUVkaXRvckdyb3Vwc0NvbnRhaW5lciB8ICdtYWluJywgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IElFZGl0b3JTZXJ2aWNlIHtcblx0XHRyZXR1cm4gZGlzcG9zYWJsZXMuYWRkKG5ldyBFZGl0b3JTZXJ2aWNlKGVkaXRvckdyb3Vwc0NvbnRhaW5lciA9PT0gJ21haW4nID8gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UubWFpblBhcnQgOiBlZGl0b3JHcm91cHNDb250YWluZXIsIHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLCB0aGlzLmZpbGVTZXJ2aWNlLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLmNvbnRleHRTZXJ2aWNlLCB0aGlzLnVyaUlkZW50aXR5U2VydmljZSwgdGhpcy5lZGl0b3JSZXNvbHZlclNlcnZpY2UsIHRoaXMud29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZSwgdGhpcy5ob3N0U2VydmljZSwgdGhpcy50ZXh0RWRpdG9yU2VydmljZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblxuXHRcdC8vIEVkaXRvciAmIGdyb3VwIGNoYW5nZXNcblx0XHRpZiAodGhpcy5lZGl0b3JHcm91cHNDb250YWluZXIgPT09IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLm1haW5QYXJ0IHx8IHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyID09PSB0aGlzLmVkaXRvckdyb3VwU2VydmljZSkge1xuXHRcdFx0dGhpcy5lZGl0b3JHcm91cFNlcnZpY2Uud2hlblJlYWR5LnRoZW4oKCkgPT4gdGhpcy5vbkVkaXRvckdyb3Vwc1JlYWR5KCkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm9uRWRpdG9yR3JvdXBzUmVhZHkoKTtcblx0XHR9XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3JHcm91cHNDb250YWluZXIub25EaWRDaGFuZ2VBY3RpdmVHcm91cChncm91cCA9PiB0aGlzLmhhbmRsZUFjdGl2ZUVkaXRvckNoYW5nZShncm91cCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5vbkRpZEFkZEdyb3VwKGdyb3VwID0+IHRoaXMucmVnaXN0ZXJHcm91cExpc3RlbmVycyhncm91cCBhcyBJRWRpdG9yR3JvdXBWaWV3KSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yc09ic2VydmVyLm9uRGlkTW9zdFJlY2VudGx5QWN0aXZlRWRpdG9yc0NoYW5nZSgoKSA9PiB0aGlzLl9vbkRpZE1vc3RSZWNlbnRseUFjdGl2ZUVkaXRvcnNDaGFuZ2UuZmlyZSgpKSk7XG5cblx0XHQvLyBPdXQgb2Ygd29ya3NwYWNlIGZpbGUgd2F0Y2hlcnNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkVmlzaWJsZUVkaXRvcnNDaGFuZ2UoKCkgPT4gdGhpcy5oYW5kbGVWaXNpYmxlRWRpdG9yc0NoYW5nZSgpKSk7XG5cblx0XHQvLyBGaWxlIGNoYW5nZXMgJiBvcGVyYXRpb25zXG5cdFx0Ly8gTm90ZTogdGhlcmUgaXMgc29tZSBkdXBsaWNhdGlvbiB3aXRoIHRoZSB0d28gZmlsZSBldmVudCBoYW5kbGVycy0gU2luY2Ugd2UgY2Fubm90IGFsd2F5cyByZWx5IG9uIHRoZSBkaXNrIGV2ZW50c1xuXHRcdC8vIGNhcnJ5aW5nIGFsbCBuZWNlc3NhcnkgZGF0YSBpbiBhbGwgZW52aXJvbm1lbnRzLCB3ZSBhbHNvIHVzZSB0aGUgZmlsZSBvcGVyYXRpb24gZXZlbnRzIHRvIG1ha2Ugc3VyZSBvcGVyYXRpb25zIGFyZSBoYW5kbGVkLlxuXHRcdC8vIEluIGFueSBjYXNlIHRoZXJlIGlzIG5vIGd1YXJhbnRlZSBpZiB0aGUgbG9jYWwgZXZlbnQgaXMgZmlyZWQgZmlyc3Qgb3IgdGhlIGRpc2sgb25lLiBUaHVzLCBjb2RlIG11c3QgaGFuZGxlIHRoZSBjYXNlXG5cdFx0Ly8gdGhhdCB0aGUgZXZlbnQgb3JkZXJpbmcgaXMgcmFuZG9tIGFzIHdlbGwgYXMgbWlnaHQgbm90IGNhcnJ5IGFsbCBpbmZvcm1hdGlvbiBuZWVkZWQuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5maWxlU2VydmljZS5vbkRpZFJ1bk9wZXJhdGlvbihlID0+IHRoaXMub25EaWRSdW5GaWxlT3BlcmF0aW9uKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5maWxlU2VydmljZS5vbkRpZEZpbGVzQ2hhbmdlKGUgPT4gdGhpcy5vbkRpZEZpbGVzQ2hhbmdlKGUpKSk7XG5cblx0XHQvLyBDb25maWd1cmF0aW9uXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB0aGlzLm9uQ29uZmlndXJhdGlvblVwZGF0ZWQoZSkpKTtcblx0fVxuXG5cdC8vI3JlZ2lvbiBFZGl0b3IgJiBncm91cCBldmVudCBoYW5kbGVyc1xuXG5cdHByaXZhdGUgbGFzdEFjdGl2ZUVkaXRvcjogRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBvbkVkaXRvckdyb3Vwc1JlYWR5KCk6IHZvaWQge1xuXG5cdFx0Ly8gUmVnaXN0ZXIgbGlzdGVuZXJzIHRvIGVhY2ggb3BlbmVkIGdyb3VwXG5cdFx0Zm9yIChjb25zdCBncm91cCBvZiB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5ncm91cHMpIHtcblx0XHRcdHRoaXMucmVnaXN0ZXJHcm91cExpc3RlbmVycyhncm91cCBhcyBJRWRpdG9yR3JvdXBWaWV3KTtcblx0XHR9XG5cblx0XHQvLyBGaXJlIGluaXRpYWwgc2V0IG9mIGVkaXRvciBldmVudHMgaWYgdGhlcmUgaXMgYW4gYWN0aXZlIGVkaXRvclxuXHRcdGlmICh0aGlzLmFjdGl2ZUVkaXRvcikge1xuXHRcdFx0dGhpcy5kb0hhbmRsZUFjdGl2ZUVkaXRvckNoYW5nZUV2ZW50KCk7XG5cdFx0XHR0aGlzLl9vbkRpZFZpc2libGVFZGl0b3JzQ2hhbmdlLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUFjdGl2ZUVkaXRvckNoYW5nZShncm91cDogSUVkaXRvckdyb3VwKTogdm9pZCB7XG5cdFx0aWYgKGdyb3VwICE9PSB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5hY3RpdmVHcm91cCkge1xuXHRcdFx0cmV0dXJuOyAvLyBpZ25vcmUgaWYgbm90IHRoZSBhY3RpdmUgZ3JvdXBcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMubGFzdEFjdGl2ZUVkaXRvciAmJiAhZ3JvdXAuYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47IC8vIGlnbm9yZSBpZiB3ZSBzdGlsbCBoYXZlIG5vIGFjdGl2ZSBlZGl0b3Jcblx0XHR9XG5cblx0XHR0aGlzLmRvSGFuZGxlQWN0aXZlRWRpdG9yQ2hhbmdlRXZlbnQoKTtcblx0fVxuXG5cdHByaXZhdGUgZG9IYW5kbGVBY3RpdmVFZGl0b3JDaGFuZ2VFdmVudCgpOiB2b2lkIHtcblxuXHRcdC8vIFJlbWVtYmVyIGFzIGxhc3QgYWN0aXZlXG5cdFx0Y29uc3QgYWN0aXZlR3JvdXAgPSB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5hY3RpdmVHcm91cDtcblx0XHR0aGlzLmxhc3RBY3RpdmVFZGl0b3IgPSBhY3RpdmVHcm91cC5hY3RpdmVFZGl0b3IgPz8gdW5kZWZpbmVkO1xuXG5cdFx0Ly8gRmlyZSBldmVudCB0byBvdXRzaWRlIHBhcnRpZXNcblx0XHR0aGlzLl9vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZS5maXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyR3JvdXBMaXN0ZW5lcnMoZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcpOiB2b2lkIHtcblx0XHRjb25zdCBncm91cERpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Z3JvdXBEaXNwb3NhYmxlcy5hZGQoZ3JvdXAub25EaWRNb2RlbENoYW5nZShlID0+IHtcblx0XHRcdHRoaXMuX29uRGlkRWRpdG9yc0NoYW5nZS5maXJlKHsgZ3JvdXBJZDogZ3JvdXAuaWQsIGV2ZW50OiBlIH0pO1xuXHRcdH0pKTtcblxuXHRcdGdyb3VwRGlzcG9zYWJsZXMuYWRkKGdyb3VwLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMuaGFuZGxlQWN0aXZlRWRpdG9yQ2hhbmdlKGdyb3VwKTtcblx0XHRcdHRoaXMuX29uRGlkVmlzaWJsZUVkaXRvcnNDaGFuZ2UuZmlyZSgpO1xuXHRcdH0pKTtcblxuXHRcdGdyb3VwRGlzcG9zYWJsZXMuYWRkKGdyb3VwLm9uV2lsbE9wZW5FZGl0b3IoZSA9PiB7XG5cdFx0XHR0aGlzLl9vbldpbGxPcGVuRWRpdG9yLmZpcmUoZSk7XG5cdFx0fSkpO1xuXG5cdFx0Z3JvdXBEaXNwb3NhYmxlcy5hZGQoZ3JvdXAub25EaWRDbG9zZUVkaXRvcihlID0+IHtcblx0XHRcdHRoaXMuX29uRGlkQ2xvc2VFZGl0b3IuZmlyZShlKTtcblx0XHR9KSk7XG5cblx0XHRncm91cERpc3Bvc2FibGVzLmFkZChncm91cC5vbkRpZE9wZW5FZGl0b3JGYWlsKGVkaXRvciA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZE9wZW5FZGl0b3JGYWlsLmZpcmUoeyBlZGl0b3IsIGdyb3VwSWQ6IGdyb3VwLmlkIH0pO1xuXHRcdH0pKTtcblxuXHRcdEV2ZW50Lm9uY2UoZ3JvdXAub25XaWxsRGlzcG9zZSkoKCkgPT4ge1xuXHRcdFx0ZGlzcG9zZShncm91cERpc3Bvc2FibGVzKTtcblx0XHR9KTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBWaXNpYmxlIEVkaXRvcnMgQ2hhbmdlOiBJbnN0YWxsIGZpbGUgd2F0Y2hlcnMgZm9yIG91dCBvZiB3b3Jrc3BhY2UgcmVzb3VyY2VzIHRoYXQgYmVjYW1lIHZpc2libGVcblxuXHRwcml2YXRlIHJlYWRvbmx5IGFjdGl2ZU91dE9mV29ya3NwYWNlV2F0Y2hlcnMgPSBuZXcgUmVzb3VyY2VNYXA8SURpc3Bvc2FibGU+KCk7XG5cblx0cHJpdmF0ZSBoYW5kbGVWaXNpYmxlRWRpdG9yc0NoYW5nZSgpOiB2b2lkIHtcblx0XHRjb25zdCB2aXNpYmxlT3V0T2ZXb3Jrc3BhY2VSZXNvdXJjZXMgPSBuZXcgUmVzb3VyY2VTZXQoKTtcblxuXHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIHRoaXMudmlzaWJsZUVkaXRvcnMpIHtcblx0XHRcdGNvbnN0IHJlc291cmNlcyA9IGRpc3RpbmN0KGNvYWxlc2NlKFtcblx0XHRcdFx0RWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRDYW5vbmljYWxVcmkoZWRpdG9yLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSksXG5cdFx0XHRcdEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0Q2Fub25pY2FsVXJpKGVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5TRUNPTkRBUlkgfSlcblx0XHRcdF0pLCByZXNvdXJjZSA9PiByZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRcdFx0Zm9yIChjb25zdCByZXNvdXJjZSBvZiByZXNvdXJjZXMpIHtcblx0XHRcdFx0aWYgKHRoaXMuZmlsZVNlcnZpY2UuaGFzUHJvdmlkZXIocmVzb3VyY2UpICYmICF0aGlzLmNvbnRleHRTZXJ2aWNlLmlzSW5zaWRlV29ya3NwYWNlKHJlc291cmNlKSkge1xuXHRcdFx0XHRcdHZpc2libGVPdXRPZldvcmtzcGFjZVJlc291cmNlcy5hZGQocmVzb3VyY2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSGFuZGxlIG5vIGxvbmdlciB2aXNpYmxlIG91dCBvZiB3b3Jrc3BhY2UgcmVzb3VyY2VzXG5cdFx0Zm9yIChjb25zdCByZXNvdXJjZSBvZiB0aGlzLmFjdGl2ZU91dE9mV29ya3NwYWNlV2F0Y2hlcnMua2V5cygpKSB7XG5cdFx0XHRpZiAoIXZpc2libGVPdXRPZldvcmtzcGFjZVJlc291cmNlcy5oYXMocmVzb3VyY2UpKSB7XG5cdFx0XHRcdGRpc3Bvc2UodGhpcy5hY3RpdmVPdXRPZldvcmtzcGFjZVdhdGNoZXJzLmdldChyZXNvdXJjZSkpO1xuXHRcdFx0XHR0aGlzLmFjdGl2ZU91dE9mV29ya3NwYWNlV2F0Y2hlcnMuZGVsZXRlKHJlc291cmNlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBIYW5kbGUgbmV3bHkgdmlzaWJsZSBvdXQgb2Ygd29ya3NwYWNlIHJlc291cmNlc1xuXHRcdGZvciAoY29uc3QgcmVzb3VyY2Ugb2YgdmlzaWJsZU91dE9mV29ya3NwYWNlUmVzb3VyY2VzLmtleXMoKSkge1xuXHRcdFx0aWYgKCF0aGlzLmFjdGl2ZU91dE9mV29ya3NwYWNlV2F0Y2hlcnMuZ2V0KHJlc291cmNlKSkge1xuXHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gdGhpcy5maWxlU2VydmljZS53YXRjaChyZXNvdXJjZSk7XG5cdFx0XHRcdHRoaXMuYWN0aXZlT3V0T2ZXb3Jrc3BhY2VXYXRjaGVycy5zZXQocmVzb3VyY2UsIGRpc3Bvc2FibGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBGaWxlIENoYW5nZXM6IE1vdmUgJiBEZWxldGVzIHRvIG1vdmUgb3IgY2xvc2Ugb3BlbmQgZWRpdG9yc1xuXG5cdHByaXZhdGUgYXN5bmMgb25EaWRSdW5GaWxlT3BlcmF0aW9uKGU6IEZpbGVPcGVyYXRpb25FdmVudCk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gSGFuZGxlIG1vdmVzIHNwZWNpYWxseSB3aGVuIGZpbGUgaXMgb3BlbmVkXG5cdFx0aWYgKGUuaXNPcGVyYXRpb24oRmlsZU9wZXJhdGlvbi5NT1ZFKSkge1xuXHRcdFx0dGhpcy5oYW5kbGVNb3ZlZEZpbGUoZS5yZXNvdXJjZSwgZS50YXJnZXQucmVzb3VyY2UpO1xuXHRcdH1cblxuXHRcdC8vIEhhbmRsZSBkZWxldGVzXG5cdFx0aWYgKGUuaXNPcGVyYXRpb24oRmlsZU9wZXJhdGlvbi5ERUxFVEUpIHx8IGUuaXNPcGVyYXRpb24oRmlsZU9wZXJhdGlvbi5NT1ZFKSkge1xuXHRcdFx0dGhpcy5oYW5kbGVEZWxldGVkRmlsZShlLnJlc291cmNlLCBmYWxzZSwgZS50YXJnZXQgPyBlLnRhcmdldC5yZXNvdXJjZSA6IHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZEZpbGVzQ2hhbmdlKGU6IEZpbGVDaGFuZ2VzRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoZS5nb3REZWxldGVkKCkpIHtcblx0XHRcdHRoaXMuaGFuZGxlRGVsZXRlZEZpbGUoZSwgdHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVNb3ZlZEZpbGUoc291cmNlOiBVUkksIHRhcmdldDogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Zm9yIChjb25zdCBncm91cCBvZiB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5ncm91cHMpIHtcblx0XHRcdGNvbnN0IHJlcGxhY2VtZW50czogKElVbnR5cGVkRWRpdG9yUmVwbGFjZW1lbnQgfCBJRWRpdG9yUmVwbGFjZW1lbnQpW10gPSBbXTtcblxuXHRcdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgZ3JvdXAuZWRpdG9ycykge1xuXHRcdFx0XHRjb25zdCByZXNvdXJjZSA9IGVkaXRvci5yZXNvdXJjZTtcblx0XHRcdFx0aWYgKCFyZXNvdXJjZSB8fCAhdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWxPclBhcmVudChyZXNvdXJjZSwgc291cmNlKSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlOyAvLyBub3QgbWF0Y2hpbmcgb3VyIHJlc291cmNlXG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBEZXRlcm1pbmUgbmV3IHJlc3VsdGluZyB0YXJnZXQgcmVzb3VyY2Vcblx0XHRcdFx0bGV0IHRhcmdldFJlc291cmNlOiBVUkk7XG5cdFx0XHRcdGlmICh0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChzb3VyY2UsIHJlc291cmNlKSkge1xuXHRcdFx0XHRcdHRhcmdldFJlc291cmNlID0gdGFyZ2V0OyAvLyBmaWxlIGdvdCBtb3ZlZFxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGluZGV4ID0gaW5kZXhPZlBhdGgocmVzb3VyY2UucGF0aCwgc291cmNlLnBhdGgsIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pZ25vcmVQYXRoQ2FzaW5nKHJlc291cmNlKSk7XG5cdFx0XHRcdFx0dGFyZ2V0UmVzb3VyY2UgPSBqb2luUGF0aCh0YXJnZXQsIHJlc291cmNlLnBhdGguc3Vic3RyKGluZGV4ICsgc291cmNlLnBhdGgubGVuZ3RoICsgMSkpOyAvLyBwYXJlbnQgZm9sZGVyIGdvdCBtb3ZlZFxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gRGVsZWdhdGUgcmVuYW1lKCkgdG8gZWRpdG9yIGluc3RhbmNlXG5cdFx0XHRcdGNvbnN0IG1vdmVSZXN1bHQgPSBhd2FpdCBlZGl0b3IucmVuYW1lKGdyb3VwLmlkLCB0YXJnZXRSZXNvdXJjZSk7XG5cdFx0XHRcdGlmICghbW92ZVJlc3VsdCkge1xuXHRcdFx0XHRcdHJldHVybjsgLy8gbm90IHRhcmdldCAtIGlnbm9yZVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgb3B0aW9uT3ZlcnJpZGVzID0ge1xuXHRcdFx0XHRcdHByZXNlcnZlRm9jdXM6IHRydWUsXG5cdFx0XHRcdFx0cGlubmVkOiBncm91cC5pc1Bpbm5lZChlZGl0b3IpLFxuXHRcdFx0XHRcdHN0aWNreTogZ3JvdXAuaXNTdGlja3koZWRpdG9yKSxcblx0XHRcdFx0XHRpbmRleDogZ3JvdXAuZ2V0SW5kZXhPZkVkaXRvcihlZGl0b3IpLFxuXHRcdFx0XHRcdGluYWN0aXZlOiAhZ3JvdXAuaXNBY3RpdmUoZWRpdG9yKVxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdC8vIENvbnN0cnVjdCBhIHJlcGxhY2VtZW50IHdpdGggb3VyIGV4dHJhIG9wdGlvbnMgbWl4ZWQgaW5cblx0XHRcdFx0aWYgKGlzRWRpdG9ySW5wdXQobW92ZVJlc3VsdC5lZGl0b3IpKSB7XG5cdFx0XHRcdFx0cmVwbGFjZW1lbnRzLnB1c2goe1xuXHRcdFx0XHRcdFx0ZWRpdG9yLFxuXHRcdFx0XHRcdFx0cmVwbGFjZW1lbnQ6IG1vdmVSZXN1bHQuZWRpdG9yLFxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHQuLi5tb3ZlUmVzdWx0Lm9wdGlvbnMsXG5cdFx0XHRcdFx0XHRcdC4uLm9wdGlvbk92ZXJyaWRlc1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlcGxhY2VtZW50cy5wdXNoKHtcblx0XHRcdFx0XHRcdGVkaXRvcixcblx0XHRcdFx0XHRcdHJlcGxhY2VtZW50OiB7XG5cdFx0XHRcdFx0XHRcdC4uLm1vdmVSZXN1bHQuZWRpdG9yLFxuXHRcdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdFx0Li4ubW92ZVJlc3VsdC5lZGl0b3Iub3B0aW9ucyxcblx0XHRcdFx0XHRcdFx0XHQuLi5vcHRpb25PdmVycmlkZXNcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEFwcGx5IHJlcGxhY2VtZW50c1xuXHRcdFx0aWYgKHJlcGxhY2VtZW50cy5sZW5ndGgpIHtcblx0XHRcdFx0dGhpcy5yZXBsYWNlRWRpdG9ycyhyZXBsYWNlbWVudHMsIGdyb3VwKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNsb3NlT25GaWxlRGVsZXRlOiBib29sZWFuID0gZmFsc2U7XG5cblx0cHJpdmF0ZSBvbkNvbmZpZ3VyYXRpb25VcGRhdGVkKGU/OiBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKGUgJiYgIWUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3dvcmtiZW5jaC5lZGl0b3IuY2xvc2VPbkZpbGVEZWxldGUnKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb24gPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElXb3JrYmVuY2hFZGl0b3JDb25maWd1cmF0aW9uPigpO1xuXHRcdGlmICh0eXBlb2YgY29uZmlndXJhdGlvbi53b3JrYmVuY2g/LmVkaXRvcj8uY2xvc2VPbkZpbGVEZWxldGUgPT09ICdib29sZWFuJykge1xuXHRcdFx0dGhpcy5jbG9zZU9uRmlsZURlbGV0ZSA9IGNvbmZpZ3VyYXRpb24ud29ya2JlbmNoLmVkaXRvci5jbG9zZU9uRmlsZURlbGV0ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5jbG9zZU9uRmlsZURlbGV0ZSA9IGZhbHNlOyAvLyBkZWZhdWx0XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVEZWxldGVkRmlsZShhcmcxOiBVUkkgfCBGaWxlQ2hhbmdlc0V2ZW50LCBpc0V4dGVybmFsOiBib29sZWFuLCBtb3ZlZFRvPzogVVJJKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgdGhpcy5nZXRBbGxOb25EaXJ0eUVkaXRvcnMoeyBpbmNsdWRlVW50aXRsZWQ6IGZhbHNlLCBzdXBwb3J0U2lkZUJ5U2lkZTogdHJ1ZSB9KSkge1xuXHRcdFx0KGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBlZGl0b3IucmVzb3VyY2U7XG5cdFx0XHRcdGlmICghcmVzb3VyY2UpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBIYW5kbGUgZGVsZXRlcyBpbiBvcGVuZWQgZWRpdG9ycyBkZXBlbmRpbmcgb246XG5cdFx0XHRcdC8vIC0gd2UgY2xvc2UgYW55IGVkaXRvciB3aGVuIGBjbG9zZU9uRmlsZURlbGV0ZTogdHJ1ZWBcblx0XHRcdFx0Ly8gLSB3ZSBjbG9zZSBhbnkgZWRpdG9yIHdoZW4gdGhlIGRlbGV0ZSBvY2N1cnJlZCBmcm9tIHdpdGhpbiBWU0NvZGVcblx0XHRcdFx0aWYgKHRoaXMuY2xvc2VPbkZpbGVEZWxldGUgfHwgIWlzRXh0ZXJuYWwpIHtcblxuXHRcdFx0XHRcdC8vIERvIE5PVCBjbG9zZSBhbnkgb3BlbmVkIGVkaXRvciB0aGF0IG1hdGNoZXMgdGhlIHJlc291cmNlIHBhdGggKGVpdGhlciBlcXVhbCBvciBiZWluZyBwYXJlbnQpIG9mIHRoZVxuXHRcdFx0XHRcdC8vIHJlc291cmNlIHdlIG1vdmUgdG8gKG1vdmVkVG8pLiBPdGhlcndpc2Ugd2Ugd291bGQgY2xvc2UgYSByZXNvdXJjZSB0aGF0IGhhcyBiZWVuIHJlbmFtZWQgdG8gdGhlIHNhbWVcblx0XHRcdFx0XHQvLyBwYXRoIGJ1dCBkaWZmZXJlbnQgY2FzaW5nLlxuXHRcdFx0XHRcdGlmIChtb3ZlZFRvICYmIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsT3JQYXJlbnQocmVzb3VyY2UsIG1vdmVkVG8pKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0bGV0IG1hdGNoZXMgPSBmYWxzZTtcblx0XHRcdFx0XHRpZiAoYXJnMSBpbnN0YW5jZW9mIEZpbGVDaGFuZ2VzRXZlbnQpIHtcblx0XHRcdFx0XHRcdG1hdGNoZXMgPSBhcmcxLmNvbnRhaW5zKHJlc291cmNlLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bWF0Y2hlcyA9IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsT3JQYXJlbnQocmVzb3VyY2UsIGFyZzEpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghbWF0Y2hlcykge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIFdlIGhhdmUgcmVjZWl2ZWQgcmVwb3J0cyBvZiB1c2VycyBzZWVpbmcgZGVsZXRlIGV2ZW50cyBldmVuIHRob3VnaCB0aGUgZmlsZSBzdGlsbFxuXHRcdFx0XHRcdC8vIGV4aXN0cyAobmV0d29yayBzaGFyZXMgaXNzdWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMzY2NSkuXG5cdFx0XHRcdFx0Ly8gU2luY2Ugd2UgZG8gbm90IHdhbnQgdG8gY2xvc2UgYW4gZWRpdG9yIHdpdGhvdXQgcmVhc29uLCB3ZSBoYXZlIHRvIGNoZWNrIGlmIHRoZVxuXHRcdFx0XHRcdC8vIGZpbGUgaXMgcmVhbGx5IGdvbmUgYW5kIG5vdCBqdXN0IGEgZmF1bHR5IGZpbGUgZXZlbnQuXG5cdFx0XHRcdFx0Ly8gVGhpcyBvbmx5IGFwcGxpZXMgdG8gZXh0ZXJuYWwgZmlsZSBldmVudHMsIHNvIHdlIG5lZWQgdG8gY2hlY2sgZm9yIHRoZSBpc0V4dGVybmFsXG5cdFx0XHRcdFx0Ly8gZmxhZy5cblx0XHRcdFx0XHRsZXQgZXhpc3RzID0gZmFsc2U7XG5cdFx0XHRcdFx0aWYgKGlzRXh0ZXJuYWwgJiYgdGhpcy5maWxlU2VydmljZS5oYXNQcm92aWRlcihyZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwKTtcblx0XHRcdFx0XHRcdGV4aXN0cyA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZXhpc3RzKHJlc291cmNlKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoIWV4aXN0cyAmJiAhZWRpdG9yLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0XHRcdFx0ZWRpdG9yLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRBbGxOb25EaXJ0eUVkaXRvcnMob3B0aW9uczogeyBpbmNsdWRlVW50aXRsZWQ6IGJvb2xlYW47IHN1cHBvcnRTaWRlQnlTaWRlOiBib29sZWFuIH0pOiBFZGl0b3JJbnB1dFtdIHtcblx0XHRjb25zdCBlZGl0b3JzOiBFZGl0b3JJbnB1dFtdID0gW107XG5cblx0XHRmdW5jdGlvbiBjb25kaXRpb25hbGx5QWRkRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQpOiB2b2lkIHtcblx0XHRcdGlmIChlZGl0b3IuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5VbnRpdGxlZCkgJiYgIW9wdGlvbnMuaW5jbHVkZVVudGl0bGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGVkaXRvci5pc0RpcnR5KCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3JzLnB1c2goZWRpdG9yKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiB0aGlzLmVkaXRvcnMpIHtcblx0XHRcdGlmIChvcHRpb25zLnN1cHBvcnRTaWRlQnlTaWRlICYmIGVkaXRvciBpbnN0YW5jZW9mIFNpZGVCeVNpZGVFZGl0b3JJbnB1dCkge1xuXHRcdFx0XHRjb25kaXRpb25hbGx5QWRkRWRpdG9yKGVkaXRvci5wcmltYXJ5KTtcblx0XHRcdFx0Y29uZGl0aW9uYWxseUFkZEVkaXRvcihlZGl0b3Iuc2Vjb25kYXJ5KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbmRpdGlvbmFsbHlBZGRFZGl0b3IoZWRpdG9yKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZWRpdG9ycztcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBFZGl0b3IgYWNjZXNzb3JzXG5cblx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JzT2JzZXJ2ZXI6IEVkaXRvcnNPYnNlcnZlcjtcblxuXHRnZXQgYWN0aXZlRWRpdG9yUGFuZSgpOiBJVmlzaWJsZUVkaXRvclBhbmUgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5hY3RpdmVHcm91cD8uYWN0aXZlRWRpdG9yUGFuZTtcblx0fVxuXG5cdGdldCBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCgpOiBJQ29kZUVkaXRvciB8IElEaWZmRWRpdG9yIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBhY3RpdmVFZGl0b3JQYW5lID0gdGhpcy5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdGlmIChhY3RpdmVFZGl0b3JQYW5lKSB7XG5cdFx0XHRjb25zdCBhY3RpdmVDb250cm9sID0gYWN0aXZlRWRpdG9yUGFuZS5nZXRDb250cm9sKCk7XG5cdFx0XHRpZiAoaXNDb2RlRWRpdG9yKGFjdGl2ZUNvbnRyb2wpIHx8IGlzRGlmZkVkaXRvcihhY3RpdmVDb250cm9sKSkge1xuXHRcdFx0XHRyZXR1cm4gYWN0aXZlQ29udHJvbDtcblx0XHRcdH1cblx0XHRcdGlmIChpc0NvbXBvc2l0ZUVkaXRvcihhY3RpdmVDb250cm9sKSAmJiBpc0NvZGVFZGl0b3IoYWN0aXZlQ29udHJvbC5hY3RpdmVDb2RlRWRpdG9yKSkge1xuXHRcdFx0XHRyZXR1cm4gYWN0aXZlQ29udHJvbC5hY3RpdmVDb2RlRWRpdG9yO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXQgYWN0aXZlVGV4dEVkaXRvckxhbmd1YWdlSWQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgYWN0aXZlQ29kZUVkaXRvcjogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCA9IHRoaXMuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w7XG5cdFx0aWYgKGlzRGlmZkVkaXRvcihhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCkpIHtcblx0XHRcdGFjdGl2ZUNvZGVFZGl0b3IgPSBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbC5nZXRNb2RpZmllZEVkaXRvcigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhY3RpdmVDb2RlRWRpdG9yID0gYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFjdGl2ZUNvZGVFZGl0b3I/LmdldE1vZGVsKCk/LmdldExhbmd1YWdlSWQoKTtcblx0fVxuXG5cdGdldCBjb3VudCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLmVkaXRvcnNPYnNlcnZlci5jb3VudDtcblx0fVxuXG5cdGdldCBlZGl0b3JzKCk6IEVkaXRvcklucHV0W10ge1xuXHRcdHJldHVybiB0aGlzLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpLm1hcCgoeyBlZGl0b3IgfSkgPT4gZWRpdG9yKTtcblx0fVxuXG5cdGdldEVkaXRvcnMob3JkZXI6IEVkaXRvcnNPcmRlciwgb3B0aW9ucz86IHsgZXhjbHVkZVN0aWNreT86IGJvb2xlYW4gfSk6IElFZGl0b3JJZGVudGlmaWVyW10ge1xuXHRcdHN3aXRjaCAob3JkZXIpIHtcblxuXHRcdFx0Ly8gTVJVXG5cdFx0XHRjYXNlIEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRTpcblx0XHRcdFx0aWYgKG9wdGlvbnM/LmV4Y2x1ZGVTdGlja3kpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5lZGl0b3JzT2JzZXJ2ZXIuZWRpdG9ycy5maWx0ZXIoKHsgZ3JvdXBJZCwgZWRpdG9yIH0pID0+ICF0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5nZXRHcm91cChncm91cElkKT8uaXNTdGlja3koZWRpdG9yKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gdGhpcy5lZGl0b3JzT2JzZXJ2ZXIuZWRpdG9ycztcblxuXHRcdFx0Ly8gU2VxdWVudGlhbFxuXHRcdFx0Y2FzZSBFZGl0b3JzT3JkZXIuU0VRVUVOVElBTDoge1xuXHRcdFx0XHRjb25zdCBlZGl0b3JzOiBJRWRpdG9ySWRlbnRpZmllcltdID0gW107XG5cblx0XHRcdFx0Zm9yIChjb25zdCBncm91cCBvZiB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5nZXRHcm91cHMoR3JvdXBzT3JkZXIuR1JJRF9BUFBFQVJBTkNFKSkge1xuXHRcdFx0XHRcdGVkaXRvcnMucHVzaCguLi5ncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMLCBvcHRpb25zKS5tYXAoZWRpdG9yID0+ICh7IGVkaXRvciwgZ3JvdXBJZDogZ3JvdXAuaWQgfSkpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBlZGl0b3JzO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGdldCBhY3RpdmVFZGl0b3IoKTogRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGFjdGl2ZUdyb3VwID0gdGhpcy5lZGl0b3JHcm91cHNDb250YWluZXIuYWN0aXZlR3JvdXA7XG5cblx0XHRyZXR1cm4gYWN0aXZlR3JvdXAgPyBhY3RpdmVHcm91cC5hY3RpdmVFZGl0b3IgPz8gdW5kZWZpbmVkIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0IHZpc2libGVFZGl0b3JQYW5lcygpOiBJVmlzaWJsZUVkaXRvclBhbmVbXSB7XG5cdFx0cmV0dXJuIGNvYWxlc2NlKHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyLmdyb3Vwcy5tYXAoZ3JvdXAgPT4gZ3JvdXAuYWN0aXZlRWRpdG9yUGFuZSkpO1xuXHR9XG5cblx0Z2V0IHZpc2libGVUZXh0RWRpdG9yQ29udHJvbHMoKTogQXJyYXk8SUNvZGVFZGl0b3IgfCBJRGlmZkVkaXRvcj4ge1xuXHRcdHJldHVybiB0aGlzLmRvR2V0VmlzaWJsZVRleHRFZGl0b3JDb250cm9scyh0aGlzLnZpc2libGVFZGl0b3JQYW5lcyk7XG5cdH1cblxuXHRwcml2YXRlIGRvR2V0VmlzaWJsZVRleHRFZGl0b3JDb250cm9scyhlZGl0b3JQYW5lczogSVZpc2libGVFZGl0b3JQYW5lW10pOiBBcnJheTxJQ29kZUVkaXRvciB8IElEaWZmRWRpdG9yPiB7XG5cdFx0Y29uc3QgdmlzaWJsZVRleHRFZGl0b3JDb250cm9sczogQXJyYXk8SUNvZGVFZGl0b3IgfCBJRGlmZkVkaXRvcj4gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGVkaXRvclBhbmUgb2YgZWRpdG9yUGFuZXMpIHtcblx0XHRcdGNvbnN0IGNvbnRyb2xzOiBBcnJheTxJRWRpdG9yQ29udHJvbCB8IHVuZGVmaW5lZD4gPSBbXTtcblx0XHRcdGlmIChlZGl0b3JQYW5lIGluc3RhbmNlb2YgU2lkZUJ5U2lkZUVkaXRvclBhbmUpIHtcblx0XHRcdFx0Y29udHJvbHMucHVzaChlZGl0b3JQYW5lLmdldFByaW1hcnlFZGl0b3JQYW5lKCk/LmdldENvbnRyb2woKSk7XG5cdFx0XHRcdGNvbnRyb2xzLnB1c2goZWRpdG9yUGFuZS5nZXRTZWNvbmRhcnlFZGl0b3JQYW5lKCk/LmdldENvbnRyb2woKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb250cm9scy5wdXNoKGVkaXRvclBhbmUuZ2V0Q29udHJvbCgpKTtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBjb250cm9sIG9mIGNvbnRyb2xzKSB7XG5cdFx0XHRcdGlmIChpc0NvZGVFZGl0b3IoY29udHJvbCkgfHwgaXNEaWZmRWRpdG9yKGNvbnRyb2wpKSB7XG5cdFx0XHRcdFx0dmlzaWJsZVRleHRFZGl0b3JDb250cm9scy5wdXNoKGNvbnRyb2wpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHZpc2libGVUZXh0RWRpdG9yQ29udHJvbHM7XG5cdH1cblxuXHRnZXRWaXNpYmxlVGV4dEVkaXRvckNvbnRyb2xzKG9yZGVyOiBFZGl0b3JzT3JkZXIpOiByZWFkb25seSAoSUNvZGVFZGl0b3IgfCBJRGlmZkVkaXRvcilbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZG9HZXRWaXNpYmxlVGV4dEVkaXRvckNvbnRyb2xzKGNvYWxlc2NlKHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyLmdldEdyb3VwcyhvcmRlciA9PT0gRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwgPyBHcm91cHNPcmRlci5HUklEX0FQUEVBUkFOQ0UgOiBHcm91cHNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkubWFwKGdyb3VwID0+IGdyb3VwLmFjdGl2ZUVkaXRvclBhbmUpKSk7XG5cdH1cblxuXHRnZXQgdmlzaWJsZUVkaXRvcnMoKTogRWRpdG9ySW5wdXRbXSB7XG5cdFx0cmV0dXJuIGNvYWxlc2NlKHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyLmdyb3Vwcy5tYXAoZ3JvdXAgPT4gZ3JvdXAuYWN0aXZlRWRpdG9yKSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gb3BlbkVkaXRvcigpXG5cblx0b3BlbkVkaXRvcihlZGl0b3I6IEVkaXRvcklucHV0LCBvcHRpb25zPzogSUVkaXRvck9wdGlvbnMsIGdyb3VwPzogUHJlZmVycmVkR3JvdXApOiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPjtcblx0b3BlbkVkaXRvcihlZGl0b3I6IElVbnR5cGVkRWRpdG9ySW5wdXQsIGdyb3VwPzogUHJlZmVycmVkR3JvdXApOiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPjtcblx0b3BlbkVkaXRvcihlZGl0b3I6IElSZXNvdXJjZUVkaXRvcklucHV0LCBncm91cD86IFByZWZlcnJlZEdyb3VwKTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD47XG5cdG9wZW5FZGl0b3IoZWRpdG9yOiBJVGV4dFJlc291cmNlRWRpdG9ySW5wdXQgfCBJVW50aXRsZWRUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCwgZ3JvdXA/OiBQcmVmZXJyZWRHcm91cCk6IFByb21pc2U8SUVkaXRvclBhbmUgfCB1bmRlZmluZWQ+O1xuXHRvcGVuRWRpdG9yKGVkaXRvcjogSVJlc291cmNlRGlmZkVkaXRvcklucHV0LCBncm91cD86IFByZWZlcnJlZEdyb3VwKTogUHJvbWlzZTxJVGV4dERpZmZFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPjtcblx0b3BlbkVkaXRvcihlZGl0b3I6IEVkaXRvcklucHV0IHwgSVVudHlwZWRFZGl0b3JJbnB1dCwgb3B0aW9uc09yUHJlZmVycmVkR3JvdXA/OiBJRWRpdG9yT3B0aW9ucyB8IFByZWZlcnJlZEdyb3VwLCBwcmVmZXJyZWRHcm91cD86IFByZWZlcnJlZEdyb3VwKTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD47XG5cdGFzeW5jIG9wZW5FZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dCB8IElVbnR5cGVkRWRpdG9ySW5wdXQsIG9wdGlvbnNPclByZWZlcnJlZEdyb3VwPzogSUVkaXRvck9wdGlvbnMgfCBQcmVmZXJyZWRHcm91cCwgcHJlZmVycmVkR3JvdXA/OiBQcmVmZXJyZWRHcm91cCk6IFByb21pc2U8SUVkaXRvclBhbmUgfCB1bmRlZmluZWQ+IHtcblx0XHRsZXQgdHlwZWRFZGl0b3I6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGxldCBvcHRpb25zID0gaXNFZGl0b3JJbnB1dChlZGl0b3IpID8gb3B0aW9uc09yUHJlZmVycmVkR3JvdXAgYXMgSUVkaXRvck9wdGlvbnMgOiBlZGl0b3Iub3B0aW9ucztcblx0XHRsZXQgZ3JvdXA6IElFZGl0b3JHcm91cCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGlmIChpc1ByZWZlcnJlZEdyb3VwKG9wdGlvbnNPclByZWZlcnJlZEdyb3VwKSkge1xuXHRcdFx0cHJlZmVycmVkR3JvdXAgPSBvcHRpb25zT3JQcmVmZXJyZWRHcm91cDtcblx0XHR9XG5cblx0XHQvLyBSZXNvbHZlIG92ZXJyaWRlIHVubGVzcyBkaXNhYmxlZFxuXHRcdGlmICghaXNFZGl0b3JJbnB1dChlZGl0b3IpKSB7XG5cdFx0XHRjb25zdCByZXNvbHZlZEVkaXRvciA9IGF3YWl0IHRoaXMuZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVFZGl0b3IoZWRpdG9yLCBwcmVmZXJyZWRHcm91cCk7XG5cblx0XHRcdGlmIChyZXNvbHZlZEVkaXRvciA9PT0gUmVzb2x2ZWRTdGF0dXMuQUJPUlQpIHtcblx0XHRcdFx0cmV0dXJuOyAvLyBza2lwIGVkaXRvciBpZiBvdmVycmlkZSBpcyBhYm9ydGVkXG5cdFx0XHR9XG5cblx0XHRcdC8vIFdlIHJlc29sdmVkIGFuIGVkaXRvciB0byB1c2Vcblx0XHRcdGlmIChpc0VkaXRvcklucHV0V2l0aE9wdGlvbnNBbmRHcm91cChyZXNvbHZlZEVkaXRvcikpIHtcblx0XHRcdFx0dHlwZWRFZGl0b3IgPSByZXNvbHZlZEVkaXRvci5lZGl0b3I7XG5cdFx0XHRcdG9wdGlvbnMgPSByZXNvbHZlZEVkaXRvci5vcHRpb25zO1xuXHRcdFx0XHRncm91cCA9IHJlc29sdmVkRWRpdG9yLmdyb3VwO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIE92ZXJyaWRlIGlzIGRpc2FibGVkIG9yIGRpZCBub3QgYXBwbHk6IGZhbGxiYWNrIHRvIGRlZmF1bHRcblx0XHRpZiAoIXR5cGVkRWRpdG9yKSB7XG5cdFx0XHR0eXBlZEVkaXRvciA9IGlzRWRpdG9ySW5wdXQoZWRpdG9yKSA/IGVkaXRvciA6IGF3YWl0IHRoaXMudGV4dEVkaXRvclNlcnZpY2UucmVzb2x2ZVRleHRFZGl0b3IoZWRpdG9yKTtcblx0XHR9XG5cblx0XHQvLyBJZiBncm91cCBzdGlsbCBpc24ndCBkZWZpbmVkIGJlY2F1c2Ugb2YgYSBkaXNhYmxlZCBvdmVycmlkZSB3ZSByZXNvbHZlIGl0XG5cdFx0aWYgKCFncm91cCkge1xuXHRcdFx0bGV0IGFjdGl2YXRpb246IEVkaXRvckFjdGl2YXRpb24gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBmaW5kR3JvdXBSZXN1bHQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZpbmRHcm91cCwgeyBlZGl0b3I6IHR5cGVkRWRpdG9yLCBvcHRpb25zIH0sIHByZWZlcnJlZEdyb3VwKTtcblx0XHRcdGlmIChmaW5kR3JvdXBSZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG5cdFx0XHRcdChbZ3JvdXAsIGFjdGl2YXRpb25dID0gYXdhaXQgZmluZEdyb3VwUmVzdWx0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdChbZ3JvdXAsIGFjdGl2YXRpb25dID0gZmluZEdyb3VwUmVzdWx0KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gTWl4aW4gZWRpdG9yIGdyb3VwIGFjdGl2YXRpb24gaWYgcmV0dXJuZWRcblx0XHRcdGlmIChhY3RpdmF0aW9uKSB7XG5cdFx0XHRcdG9wdGlvbnMgPSB7IC4uLm9wdGlvbnMsIGFjdGl2YXRpb24gfTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZ3JvdXAub3BlbkVkaXRvcih0eXBlZEVkaXRvciwgb3B0aW9ucyk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gb3BlbkVkaXRvcnMoKVxuXG5cdG9wZW5FZGl0b3JzKGVkaXRvcnM6IEVkaXRvcklucHV0V2l0aE9wdGlvbnNbXSwgZ3JvdXA/OiBQcmVmZXJyZWRHcm91cCwgb3B0aW9ucz86IElPcGVuRWRpdG9yc09wdGlvbnMpOiBQcm9taXNlPElFZGl0b3JQYW5lW10+O1xuXHRvcGVuRWRpdG9ycyhlZGl0b3JzOiBJVW50eXBlZEVkaXRvcklucHV0W10sIGdyb3VwPzogUHJlZmVycmVkR3JvdXAsIG9wdGlvbnM/OiBJT3BlbkVkaXRvcnNPcHRpb25zKTogUHJvbWlzZTxJRWRpdG9yUGFuZVtdPjtcblx0b3BlbkVkaXRvcnMoZWRpdG9yczogQXJyYXk8RWRpdG9ySW5wdXRXaXRoT3B0aW9ucyB8IElVbnR5cGVkRWRpdG9ySW5wdXQ+LCBncm91cD86IFByZWZlcnJlZEdyb3VwLCBvcHRpb25zPzogSU9wZW5FZGl0b3JzT3B0aW9ucyk6IFByb21pc2U8SUVkaXRvclBhbmVbXT47XG5cdGFzeW5jIG9wZW5FZGl0b3JzKGVkaXRvcnM6IEFycmF5PEVkaXRvcklucHV0V2l0aE9wdGlvbnMgfCBJVW50eXBlZEVkaXRvcklucHV0PiwgcHJlZmVycmVkR3JvdXA/OiBQcmVmZXJyZWRHcm91cCwgb3B0aW9ucz86IElPcGVuRWRpdG9yc09wdGlvbnMpOiBQcm9taXNlPElFZGl0b3JQYW5lW10+IHtcblxuXHRcdC8vIFBhc3MgYWxsIGVkaXRvcnMgdG8gdHJ1c3Qgc2VydmljZSB0byBkZXRlcm1pbmUgaWZcblx0XHQvLyB3ZSBzaG91bGQgcHJvY2VlZCB3aXRoIG9wZW5pbmcgdGhlIGVkaXRvcnMgaWYgd2Vcblx0XHQvLyBhcmUgYXNrZWQgdG8gdmFsaWRhdGUgdHJ1c3QuXG5cdFx0aWYgKG9wdGlvbnM/LnZhbGlkYXRlVHJ1c3QpIHtcblx0XHRcdGNvbnN0IGVkaXRvcnNUcnVzdGVkID0gYXdhaXQgdGhpcy5oYW5kbGVXb3Jrc3BhY2VUcnVzdChlZGl0b3JzKTtcblx0XHRcdGlmICghZWRpdG9yc1RydXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEZpbmQgdGFyZ2V0IGdyb3VwcyBmb3IgZWRpdG9ycyB0byBvcGVuXG5cdFx0Y29uc3QgbWFwR3JvdXBUb1R5cGVkRWRpdG9ycyA9IG5ldyBNYXA8SUVkaXRvckdyb3VwLCBBcnJheTxFZGl0b3JJbnB1dFdpdGhPcHRpb25zPj4oKTtcblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBlZGl0b3JzKSB7XG5cdFx0XHRsZXQgdHlwZWRFZGl0b3I6IEVkaXRvcklucHV0V2l0aE9wdGlvbnMgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgZ3JvdXA6IElFZGl0b3JHcm91cCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdFx0Ly8gUmVzb2x2ZSBvdmVycmlkZSB1bmxlc3MgZGlzYWJsZWRcblx0XHRcdGlmICghaXNFZGl0b3JJbnB1dFdpdGhPcHRpb25zKGVkaXRvcikpIHtcblx0XHRcdFx0Y29uc3QgcmVzb2x2ZWRFZGl0b3IgPSBhd2FpdCB0aGlzLmVkaXRvclJlc29sdmVyU2VydmljZS5yZXNvbHZlRWRpdG9yKGVkaXRvciwgcHJlZmVycmVkR3JvdXApO1xuXG5cdFx0XHRcdGlmIChyZXNvbHZlZEVkaXRvciA9PT0gUmVzb2x2ZWRTdGF0dXMuQUJPUlQpIHtcblx0XHRcdFx0XHRjb250aW51ZTsgLy8gc2tpcCBlZGl0b3IgaWYgb3ZlcnJpZGUgaXMgYWJvcnRlZFxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gV2UgcmVzb2x2ZWQgYW4gZWRpdG9yIHRvIHVzZVxuXHRcdFx0XHRpZiAoaXNFZGl0b3JJbnB1dFdpdGhPcHRpb25zQW5kR3JvdXAocmVzb2x2ZWRFZGl0b3IpKSB7XG5cdFx0XHRcdFx0dHlwZWRFZGl0b3IgPSByZXNvbHZlZEVkaXRvcjtcblx0XHRcdFx0XHRncm91cCA9IHJlc29sdmVkRWRpdG9yLmdyb3VwO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIE92ZXJyaWRlIGlzIGRpc2FibGVkIG9yIGRpZCBub3QgYXBwbHk6IGZhbGxiYWNrIHRvIGRlZmF1bHRcblx0XHRcdGlmICghdHlwZWRFZGl0b3IpIHtcblx0XHRcdFx0dHlwZWRFZGl0b3IgPSBpc0VkaXRvcklucHV0V2l0aE9wdGlvbnMoZWRpdG9yKSA/IGVkaXRvciA6IHsgZWRpdG9yOiBhd2FpdCB0aGlzLnRleHRFZGl0b3JTZXJ2aWNlLnJlc29sdmVUZXh0RWRpdG9yKGVkaXRvciksIG9wdGlvbnM6IGVkaXRvci5vcHRpb25zIH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIGdyb3VwIHN0aWxsIGlzbid0IGRlZmluZWQgYmVjYXVzZSBvZiBhIGRpc2FibGVkIG92ZXJyaWRlIHdlIHJlc29sdmUgaXRcblx0XHRcdGlmICghZ3JvdXApIHtcblx0XHRcdFx0Y29uc3QgZmluZEdyb3VwUmVzdWx0ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihmaW5kR3JvdXAsIHR5cGVkRWRpdG9yLCBwcmVmZXJyZWRHcm91cCk7XG5cdFx0XHRcdGlmIChmaW5kR3JvdXBSZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG5cdFx0XHRcdFx0KFtncm91cF0gPSBhd2FpdCBmaW5kR3JvdXBSZXN1bHQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdChbZ3JvdXBdID0gZmluZEdyb3VwUmVzdWx0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBVcGRhdGUgbWFwIG9mIGdyb3VwcyB0byBlZGl0b3JzXG5cdFx0XHRsZXQgdGFyZ2V0R3JvdXBFZGl0b3JzID0gbWFwR3JvdXBUb1R5cGVkRWRpdG9ycy5nZXQoZ3JvdXApO1xuXHRcdFx0aWYgKCF0YXJnZXRHcm91cEVkaXRvcnMpIHtcblx0XHRcdFx0dGFyZ2V0R3JvdXBFZGl0b3JzID0gW107XG5cdFx0XHRcdG1hcEdyb3VwVG9UeXBlZEVkaXRvcnMuc2V0KGdyb3VwLCB0YXJnZXRHcm91cEVkaXRvcnMpO1xuXHRcdFx0fVxuXG5cdFx0XHR0YXJnZXRHcm91cEVkaXRvcnMucHVzaCh0eXBlZEVkaXRvcik7XG5cdFx0fVxuXG5cdFx0Ly8gT3BlbiBpbiB0YXJnZXQgZ3JvdXBzXG5cdFx0Y29uc3QgcmVzdWx0OiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPltdID0gW107XG5cdFx0Zm9yIChjb25zdCBbZ3JvdXAsIGVkaXRvcnNdIG9mIG1hcEdyb3VwVG9UeXBlZEVkaXRvcnMpIHtcblx0XHRcdHJlc3VsdC5wdXNoKGdyb3VwLm9wZW5FZGl0b3JzKGVkaXRvcnMpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY29hbGVzY2UoYXdhaXQgUHJvbWlzZXMuc2V0dGxlZChyZXN1bHQpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaGFuZGxlV29ya3NwYWNlVHJ1c3QoZWRpdG9yczogQXJyYXk8RWRpdG9ySW5wdXRXaXRoT3B0aW9ucyB8IElVbnR5cGVkRWRpdG9ySW5wdXQ+KTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgeyByZXNvdXJjZXMsIGRpZmZNb2RlLCBtZXJnZU1vZGUgfSA9IHRoaXMuZXh0cmFjdEVkaXRvclJlc291cmNlcyhlZGl0b3JzKTtcblxuXHRcdGNvbnN0IHRydXN0UmVzdWx0ID0gYXdhaXQgdGhpcy53b3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLnJlcXVlc3RPcGVuRmlsZXNUcnVzdChyZXNvdXJjZXMpO1xuXHRcdHN3aXRjaCAodHJ1c3RSZXN1bHQpIHtcblx0XHRcdGNhc2UgV29ya3NwYWNlVHJ1c3RVcmlSZXNwb25zZS5PcGVuOlxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgV29ya3NwYWNlVHJ1c3RVcmlSZXNwb25zZS5PcGVuSW5OZXdXaW5kb3c6XG5cdFx0XHRcdGF3YWl0IHRoaXMuaG9zdFNlcnZpY2Uub3BlbldpbmRvdyhyZXNvdXJjZXMubWFwKHJlc291cmNlID0+ICh7IGZpbGVVcmk6IHJlc291cmNlIH0pKSwgeyBmb3JjZU5ld1dpbmRvdzogdHJ1ZSwgZGlmZk1vZGUsIG1lcmdlTW9kZSB9KTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0Y2FzZSBXb3Jrc3BhY2VUcnVzdFVyaVJlc3BvbnNlLkNhbmNlbDpcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZXh0cmFjdEVkaXRvclJlc291cmNlcyhlZGl0b3JzOiBBcnJheTxFZGl0b3JJbnB1dFdpdGhPcHRpb25zIHwgSVVudHlwZWRFZGl0b3JJbnB1dD4pOiB7IHJlc291cmNlczogVVJJW107IGRpZmZNb2RlPzogYm9vbGVhbjsgbWVyZ2VNb2RlPzogYm9vbGVhbiB9IHtcblx0XHRjb25zdCByZXNvdXJjZXMgPSBuZXcgUmVzb3VyY2VTZXQoKTtcblx0XHRsZXQgZGlmZk1vZGUgPSBmYWxzZTtcblx0XHRsZXQgbWVyZ2VNb2RlID0gZmFsc2U7XG5cblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBlZGl0b3JzKSB7XG5cblx0XHRcdC8vIFR5cGVkIEVkaXRvclxuXHRcdFx0aWYgKGlzRWRpdG9ySW5wdXRXaXRoT3B0aW9ucyhlZGl0b3IpKSB7XG5cdFx0XHRcdGNvbnN0IHJlc291cmNlID0gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRPcmlnaW5hbFVyaShlZGl0b3IuZWRpdG9yLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkJPVEggfSk7XG5cdFx0XHRcdGlmIChVUkkuaXNVcmkocmVzb3VyY2UpKSB7XG5cdFx0XHRcdFx0cmVzb3VyY2VzLmFkZChyZXNvdXJjZSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAocmVzb3VyY2UpIHtcblx0XHRcdFx0XHRpZiAocmVzb3VyY2UucHJpbWFyeSkge1xuXHRcdFx0XHRcdFx0cmVzb3VyY2VzLmFkZChyZXNvdXJjZS5wcmltYXJ5KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAocmVzb3VyY2Uuc2Vjb25kYXJ5KSB7XG5cdFx0XHRcdFx0XHRyZXNvdXJjZXMuYWRkKHJlc291cmNlLnNlY29uZGFyeSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0ZGlmZk1vZGUgPSBlZGl0b3IuZWRpdG9yIGluc3RhbmNlb2YgRGlmZkVkaXRvcklucHV0O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFVudHlwZWQgZWRpdG9yXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0aWYgKGlzUmVzb3VyY2VNZXJnZUVkaXRvcklucHV0KGVkaXRvcikpIHtcblx0XHRcdFx0XHRpZiAoVVJJLmlzVXJpKGVkaXRvci5pbnB1dDEpKSB7XG5cdFx0XHRcdFx0XHRyZXNvdXJjZXMuYWRkKGVkaXRvci5pbnB1dDEucmVzb3VyY2UpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChVUkkuaXNVcmkoZWRpdG9yLmlucHV0MikpIHtcblx0XHRcdFx0XHRcdHJlc291cmNlcy5hZGQoZWRpdG9yLmlucHV0Mi5yZXNvdXJjZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKFVSSS5pc1VyaShlZGl0b3IuYmFzZSkpIHtcblx0XHRcdFx0XHRcdHJlc291cmNlcy5hZGQoZWRpdG9yLmJhc2UucmVzb3VyY2UpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChVUkkuaXNVcmkoZWRpdG9yLnJlc3VsdCkpIHtcblx0XHRcdFx0XHRcdHJlc291cmNlcy5hZGQoZWRpdG9yLnJlc3VsdC5yZXNvdXJjZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0bWVyZ2VNb2RlID0gdHJ1ZTtcblx0XHRcdFx0fSBpZiAoaXNSZXNvdXJjZURpZmZFZGl0b3JJbnB1dChlZGl0b3IpKSB7XG5cdFx0XHRcdFx0aWYgKFVSSS5pc1VyaShlZGl0b3Iub3JpZ2luYWwucmVzb3VyY2UpKSB7XG5cdFx0XHRcdFx0XHRyZXNvdXJjZXMuYWRkKGVkaXRvci5vcmlnaW5hbC5yZXNvdXJjZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKFVSSS5pc1VyaShlZGl0b3IubW9kaWZpZWQucmVzb3VyY2UpKSB7XG5cdFx0XHRcdFx0XHRyZXNvdXJjZXMuYWRkKGVkaXRvci5tb2RpZmllZC5yZXNvdXJjZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0ZGlmZk1vZGUgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGlzUmVzb3VyY2VFZGl0b3JJbnB1dChlZGl0b3IpKSB7XG5cdFx0XHRcdFx0cmVzb3VyY2VzLmFkZChlZGl0b3IucmVzb3VyY2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc291cmNlczogQXJyYXkuZnJvbShyZXNvdXJjZXMua2V5cygpKSxcblx0XHRcdGRpZmZNb2RlLFxuXHRcdFx0bWVyZ2VNb2RlXG5cdFx0fTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBpc09wZW5lZCgpIC8gaXNWaXNpYmxlKClcblxuXHRpc09wZW5lZChlZGl0b3I6IElSZXNvdXJjZUVkaXRvcklucHV0SWRlbnRpZmllcik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmVkaXRvcnNPYnNlcnZlci5oYXNFZGl0b3Ioe1xuXHRcdFx0cmVzb3VyY2U6IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmFzQ2Fub25pY2FsVXJpKGVkaXRvci5yZXNvdXJjZSksXG5cdFx0XHR0eXBlSWQ6IGVkaXRvci50eXBlSWQsXG5cdFx0XHRlZGl0b3JJZDogZWRpdG9yLmVkaXRvcklkXG5cdFx0fSk7XG5cdH1cblxuXHRpc1Zpc2libGUoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgdGhpcy5lZGl0b3JHcm91cHNDb250YWluZXIuZ3JvdXBzKSB7XG5cdFx0XHRpZiAoZ3JvdXAuYWN0aXZlRWRpdG9yPy5tYXRjaGVzKGVkaXRvcikpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIGNsb3NlRWRpdG9yKClcblxuXHRhc3luYyBjbG9zZUVkaXRvcih7IGVkaXRvciwgZ3JvdXBJZCB9OiBJRWRpdG9ySWRlbnRpZmllciwgb3B0aW9ucz86IElDbG9zZUVkaXRvck9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBncm91cCA9IHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyLmdldEdyb3VwKGdyb3VwSWQpO1xuXG5cdFx0YXdhaXQgZ3JvdXA/LmNsb3NlRWRpdG9yKGVkaXRvciwgb3B0aW9ucyk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gY2xvc2VFZGl0b3JzKClcblxuXHRhc3luYyBjbG9zZUVkaXRvcnMoZWRpdG9yczogSUVkaXRvcklkZW50aWZpZXJbXSwgb3B0aW9ucz86IElDbG9zZUVkaXRvck9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBtYXBHcm91cFRvRWRpdG9ycyA9IG5ldyBNYXA8SUVkaXRvckdyb3VwLCBFZGl0b3JJbnB1dFtdPigpO1xuXG5cdFx0Zm9yIChjb25zdCB7IGVkaXRvciwgZ3JvdXBJZCB9IG9mIGVkaXRvcnMpIHtcblx0XHRcdGNvbnN0IGdyb3VwID0gdGhpcy5lZGl0b3JHcm91cHNDb250YWluZXIuZ2V0R3JvdXAoZ3JvdXBJZCk7XG5cdFx0XHRpZiAoIWdyb3VwKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgZWRpdG9ycyA9IG1hcEdyb3VwVG9FZGl0b3JzLmdldChncm91cCk7XG5cdFx0XHRpZiAoIWVkaXRvcnMpIHtcblx0XHRcdFx0ZWRpdG9ycyA9IFtdO1xuXHRcdFx0XHRtYXBHcm91cFRvRWRpdG9ycy5zZXQoZ3JvdXAsIGVkaXRvcnMpO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3JzLnB1c2goZWRpdG9yKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IFtncm91cCwgZWRpdG9yc10gb2YgbWFwR3JvdXBUb0VkaXRvcnMpIHtcblx0XHRcdGF3YWl0IGdyb3VwLmNsb3NlRWRpdG9ycyhlZGl0b3JzLCBvcHRpb25zKTtcblx0XHR9XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gZmluZEVkaXRvcnMoKVxuXG5cdGZpbmRFZGl0b3JzKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJRmluZEVkaXRvck9wdGlvbnMpOiByZWFkb25seSBJRWRpdG9ySWRlbnRpZmllcltdO1xuXHRmaW5kRWRpdG9ycyhlZGl0b3I6IElSZXNvdXJjZUVkaXRvcklucHV0SWRlbnRpZmllciwgb3B0aW9ucz86IElGaW5kRWRpdG9yT3B0aW9ucyk6IHJlYWRvbmx5IElFZGl0b3JJZGVudGlmaWVyW107XG5cdGZpbmRFZGl0b3JzKHJlc291cmNlOiBVUkksIG9wdGlvbnM6IElGaW5kRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCwgZ3JvdXA6IElFZGl0b3JHcm91cCB8IEdyb3VwSWRlbnRpZmllcik6IHJlYWRvbmx5IEVkaXRvcklucHV0W107XG5cdGZpbmRFZGl0b3JzKGVkaXRvcjogSVJlc291cmNlRWRpdG9ySW5wdXRJZGVudGlmaWVyLCBvcHRpb25zOiBJRmluZEVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQsIGdyb3VwOiBJRWRpdG9yR3JvdXAgfCBHcm91cElkZW50aWZpZXIpOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZDtcblx0ZmluZEVkaXRvcnMoYXJnMTogVVJJIHwgSVJlc291cmNlRWRpdG9ySW5wdXRJZGVudGlmaWVyLCBvcHRpb25zOiBJRmluZEVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQsIGFyZzI/OiBJRWRpdG9yR3JvdXAgfCBHcm91cElkZW50aWZpZXIpOiByZWFkb25seSBJRWRpdG9ySWRlbnRpZmllcltdIHwgcmVhZG9ubHkgRWRpdG9ySW5wdXRbXSB8IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkO1xuXHRmaW5kRWRpdG9ycyhhcmcxOiBVUkkgfCBJUmVzb3VyY2VFZGl0b3JJbnB1dElkZW50aWZpZXIsIG9wdGlvbnM6IElGaW5kRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCwgYXJnMj86IElFZGl0b3JHcm91cCB8IEdyb3VwSWRlbnRpZmllcik6IHJlYWRvbmx5IElFZGl0b3JJZGVudGlmaWVyW10gfCByZWFkb25seSBFZGl0b3JJbnB1dFtdIHwgRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmlzVXJpKGFyZzEpID8gYXJnMSA6IGFyZzEucmVzb3VyY2U7XG5cdFx0Y29uc3QgdHlwZUlkID0gVVJJLmlzVXJpKGFyZzEpID8gdW5kZWZpbmVkIDogYXJnMS50eXBlSWQ7XG5cblx0XHQvLyBEbyBhIHF1aWNrIGNoZWNrIGZvciB0aGUgcmVzb3VyY2UgdmlhIHRoZSBlZGl0b3Igb2JzZXJ2ZXJcblx0XHQvLyB3aGljaCBpcyBhIHZlcnkgZWZmaWNpZW50IHdheSB0byBmaW5kIGFuIGVkaXRvciBieSByZXNvdXJjZS5cblx0XHQvLyBIb3dldmVyLCB3ZSBjYW4gb25seSBkbyB0aGF0IHVubGVzcyB3ZSBhcmUgYXNrZWQgdG8gZmluZCBhblxuXHRcdC8vIGVkaXRvciBvbiB0aGUgc2Vjb25kYXJ5IHNpZGUgb2YgYSBzaWRlIGJ5IHNpZGUgZWRpdG9yLCBiZWNhdXNlXG5cdFx0Ly8gdGhlIGVkaXRvciBvYnNlcnZlciBwcm92aWRlcyBmYXN0IGxvb2t1cHMgb25seSBmb3IgcHJpbWFyeVxuXHRcdC8vIGVkaXRvcnMuXG5cdFx0aWYgKG9wdGlvbnM/LnN1cHBvcnRTaWRlQnlTaWRlICE9PSBTaWRlQnlTaWRlRWRpdG9yLkFOWSAmJiBvcHRpb25zPy5zdXBwb3J0U2lkZUJ5U2lkZSAhPT0gU2lkZUJ5U2lkZUVkaXRvci5TRUNPTkRBUlkpIHtcblx0XHRcdGlmICghdGhpcy5lZGl0b3JzT2JzZXJ2ZXIuaGFzRWRpdG9ycyhyZXNvdXJjZSkpIHtcblx0XHRcdFx0aWYgKFVSSS5pc1VyaShhcmcxKSB8fCBpc1VuZGVmaW5lZChhcmcyKSkge1xuXHRcdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gU2VhcmNoIG9ubHkgaW4gc3BlY2lmaWMgZ3JvdXBcblx0XHRpZiAoIWlzVW5kZWZpbmVkKGFyZzIpKSB7XG5cdFx0XHRjb25zdCB0YXJnZXRHcm91cCA9IHR5cGVvZiBhcmcyID09PSAnbnVtYmVyJyA/IHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyLmdldEdyb3VwKGFyZzIpIDogYXJnMjtcblxuXHRcdFx0Ly8gUmVzb3VyY2UgcHJvdmlkZWQ6IHJlc3VsdCBpcyBhbiBhcnJheVxuXHRcdFx0aWYgKFVSSS5pc1VyaShhcmcxKSkge1xuXHRcdFx0XHRpZiAoIXRhcmdldEdyb3VwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHRhcmdldEdyb3VwLmZpbmRFZGl0b3JzKHJlc291cmNlLCBvcHRpb25zKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRWRpdG9yIGlkZW50aWZpZXIgcHJvdmlkZWQsIHJlc3VsdCBpcyBzaW5nbGVcblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRpZiAoIXRhcmdldEdyb3VwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGVkaXRvcnMgPSB0YXJnZXRHcm91cC5maW5kRWRpdG9ycyhyZXNvdXJjZSwgb3B0aW9ucyk7XG5cdFx0XHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIGVkaXRvcnMpIHtcblx0XHRcdFx0XHRpZiAoZWRpdG9yLnR5cGVJZCA9PT0gdHlwZUlkKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZWRpdG9yO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gU2VhcmNoIGFjcm9zcyBhbGwgZ3JvdXBzIGluIE1SVSBvcmRlclxuXHRcdGVsc2Uge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBJRWRpdG9ySWRlbnRpZmllcltdID0gW107XG5cblx0XHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgdGhpcy5lZGl0b3JHcm91cHNDb250YWluZXIuZ2V0R3JvdXBzKEdyb3Vwc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKSkge1xuXHRcdFx0XHRjb25zdCBlZGl0b3JzOiBFZGl0b3JJbnB1dFtdID0gW107XG5cblx0XHRcdFx0Ly8gUmVzb3VyY2UgcHJvdmlkZWQ6IHJlc3VsdCBpcyBhbiBhcnJheVxuXHRcdFx0XHRpZiAoVVJJLmlzVXJpKGFyZzEpKSB7XG5cdFx0XHRcdFx0ZWRpdG9ycy5wdXNoKC4uLnRoaXMuZmluZEVkaXRvcnMoYXJnMSwgb3B0aW9ucywgZ3JvdXApKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEVkaXRvciBpZGVudGlmaWVyIHByb3ZpZGVkLCByZXN1bHQgaXMgc2luZ2xlXG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuZmluZEVkaXRvcnMoYXJnMSwgb3B0aW9ucywgZ3JvdXApO1xuXHRcdFx0XHRcdGlmIChlZGl0b3IpIHtcblx0XHRcdFx0XHRcdGVkaXRvcnMucHVzaChlZGl0b3IpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJlc3VsdC5wdXNoKC4uLmVkaXRvcnMubWFwKGVkaXRvciA9PiAoeyBlZGl0b3IsIGdyb3VwSWQ6IGdyb3VwLmlkIH0pKSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIHJlcGxhY2VFZGl0b3JzKClcblxuXHRhc3luYyByZXBsYWNlRWRpdG9ycyhyZXBsYWNlbWVudHM6IElVbnR5cGVkRWRpdG9yUmVwbGFjZW1lbnRbXSwgZ3JvdXA6IElFZGl0b3JHcm91cCB8IEdyb3VwSWRlbnRpZmllcik6IFByb21pc2U8dm9pZD47XG5cdGFzeW5jIHJlcGxhY2VFZGl0b3JzKHJlcGxhY2VtZW50czogSUVkaXRvclJlcGxhY2VtZW50W10sIGdyb3VwOiBJRWRpdG9yR3JvdXAgfCBHcm91cElkZW50aWZpZXIpOiBQcm9taXNlPHZvaWQ+O1xuXHRhc3luYyByZXBsYWNlRWRpdG9ycyhyZXBsYWNlbWVudHM6IEFycmF5PElFZGl0b3JSZXBsYWNlbWVudCB8IElVbnR5cGVkRWRpdG9yUmVwbGFjZW1lbnQ+LCBncm91cDogSUVkaXRvckdyb3VwIHwgR3JvdXBJZGVudGlmaWVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdGFyZ2V0R3JvdXAgPSB0eXBlb2YgZ3JvdXAgPT09ICdudW1iZXInID8gdGhpcy5lZGl0b3JHcm91cHNDb250YWluZXIuZ2V0R3JvdXAoZ3JvdXApIDogZ3JvdXA7XG5cblx0XHQvLyBDb252ZXJ0IGFsbCByZXBsYWNlbWVudHMgdG8gdHlwZWQgZWRpdG9ycyB1bmxlc3MgYWxyZWFkeVxuXHRcdC8vIHR5cGVkIGFuZCBoYW5kbGUgb3ZlcnJpZGVzIHByb3Blcmx5LlxuXHRcdGNvbnN0IHR5cGVkUmVwbGFjZW1lbnRzOiBJRWRpdG9yUmVwbGFjZW1lbnRbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgcmVwbGFjZW1lbnQgb2YgcmVwbGFjZW1lbnRzKSB7XG5cdFx0XHRsZXQgdHlwZWRSZXBsYWNlbWVudDogSUVkaXRvclJlcGxhY2VtZW50IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0XHQvLyBSZXNvbHZlIG92ZXJyaWRlIHVubGVzcyBkaXNhYmxlZFxuXHRcdFx0aWYgKCFpc0VkaXRvcklucHV0KHJlcGxhY2VtZW50LnJlcGxhY2VtZW50KSkge1xuXHRcdFx0XHRjb25zdCByZXNvbHZlZEVkaXRvciA9IGF3YWl0IHRoaXMuZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVFZGl0b3IoXG5cdFx0XHRcdFx0cmVwbGFjZW1lbnQucmVwbGFjZW1lbnQsXG5cdFx0XHRcdFx0dGFyZ2V0R3JvdXBcblx0XHRcdFx0KTtcblxuXHRcdFx0XHRpZiAocmVzb2x2ZWRFZGl0b3IgPT09IFJlc29sdmVkU3RhdHVzLkFCT1JUKSB7XG5cdFx0XHRcdFx0Y29udGludWU7IC8vIHNraXAgZWRpdG9yIGlmIG92ZXJyaWRlIGlzIGFib3J0ZWRcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFdlIHJlc29sdmVkIGFuIGVkaXRvciB0byB1c2Vcblx0XHRcdFx0aWYgKGlzRWRpdG9ySW5wdXRXaXRoT3B0aW9uc0FuZEdyb3VwKHJlc29sdmVkRWRpdG9yKSkge1xuXHRcdFx0XHRcdHR5cGVkUmVwbGFjZW1lbnQgPSB7XG5cdFx0XHRcdFx0XHRlZGl0b3I6IHJlcGxhY2VtZW50LmVkaXRvcixcblx0XHRcdFx0XHRcdHJlcGxhY2VtZW50OiByZXNvbHZlZEVkaXRvci5lZGl0b3IsXG5cdFx0XHRcdFx0XHRvcHRpb25zOiByZXNvbHZlZEVkaXRvci5vcHRpb25zLFxuXHRcdFx0XHRcdFx0Zm9yY2VSZXBsYWNlRGlydHk6IHJlcGxhY2VtZW50LmZvcmNlUmVwbGFjZURpcnR5XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBPdmVycmlkZSBpcyBkaXNhYmxlZCBvciBkaWQgbm90IGFwcGx5OiBmYWxsYmFjayB0byBkZWZhdWx0XG5cdFx0XHRpZiAoIXR5cGVkUmVwbGFjZW1lbnQpIHtcblx0XHRcdFx0dHlwZWRSZXBsYWNlbWVudCA9IHtcblx0XHRcdFx0XHRlZGl0b3I6IHJlcGxhY2VtZW50LmVkaXRvcixcblx0XHRcdFx0XHRyZXBsYWNlbWVudDogaXNFZGl0b3JSZXBsYWNlbWVudChyZXBsYWNlbWVudCkgPyByZXBsYWNlbWVudC5yZXBsYWNlbWVudCA6IGF3YWl0IHRoaXMudGV4dEVkaXRvclNlcnZpY2UucmVzb2x2ZVRleHRFZGl0b3IocmVwbGFjZW1lbnQucmVwbGFjZW1lbnQpLFxuXHRcdFx0XHRcdG9wdGlvbnM6IGlzRWRpdG9yUmVwbGFjZW1lbnQocmVwbGFjZW1lbnQpID8gcmVwbGFjZW1lbnQub3B0aW9ucyA6IHJlcGxhY2VtZW50LnJlcGxhY2VtZW50Lm9wdGlvbnMsXG5cdFx0XHRcdFx0Zm9yY2VSZXBsYWNlRGlydHk6IHJlcGxhY2VtZW50LmZvcmNlUmVwbGFjZURpcnR5XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdHR5cGVkUmVwbGFjZW1lbnRzLnB1c2godHlwZWRSZXBsYWNlbWVudCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRhcmdldEdyb3VwPy5yZXBsYWNlRWRpdG9ycyh0eXBlZFJlcGxhY2VtZW50cyk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gc2F2ZS9yZXZlcnRcblxuXHRhc3luYyBzYXZlKGVkaXRvcnM6IElFZGl0b3JJZGVudGlmaWVyIHwgSUVkaXRvcklkZW50aWZpZXJbXSwgb3B0aW9ucz86IElTYXZlRWRpdG9yc09wdGlvbnMpOiBQcm9taXNlPElTYXZlRWRpdG9yc1Jlc3VsdD4ge1xuXG5cdFx0Ly8gQ29udmVydCB0byBhcnJheVxuXHRcdGlmICghQXJyYXkuaXNBcnJheShlZGl0b3JzKSkge1xuXHRcdFx0ZWRpdG9ycyA9IFtlZGl0b3JzXTtcblx0XHR9XG5cblx0XHQvLyBNYWtlIHN1cmUgdG8gbm90IHNhdmUgdGhlIHNhbWUgZWRpdG9yIG11bHRpcGxlIHRpbWVzXG5cdFx0Ly8gYnkgdXNpbmcgdGhlIGBtYXRjaGVzKClgIG1ldGhvZCB0byBmaW5kIGR1cGxpY2F0ZXNcblx0XHRjb25zdCB1bmlxdWVFZGl0b3JzID0gdGhpcy5nZXRVbmlxdWVFZGl0b3JzKGVkaXRvcnMpO1xuXG5cdFx0Ly8gU3BsaXQgZWRpdG9ycyB1cCBpbnRvIGEgYnVja2V0IHRoYXQgaXMgc2F2ZWQgaW4gcGFyYWxsZWxcblx0XHQvLyBhbmQgc2VxdWVudGlhbGx5LiBVbmxlc3MgXCJTYXZlIEFzXCIsIGFsbCBub24tdW50aXRsZWQgZWRpdG9yc1xuXHRcdC8vIGNhbiBiZSBzYXZlZCBpbiBwYXJhbGxlbCB0byBzcGVlZCB1cCB0aGUgb3BlcmF0aW9uLiBSZW1haW5pbmdcblx0XHQvLyBlZGl0b3JzIGFyZSBwb3RlbnRpYWxseSBicmluZ2luZyB1cCBzb21lIFVJIGFuZCB0aHVzIHJ1blxuXHRcdC8vIHNlcXVlbnRpYWxseS5cblx0XHRjb25zdCBlZGl0b3JzVG9TYXZlUGFyYWxsZWw6IElFZGl0b3JJZGVudGlmaWVyW10gPSBbXTtcblx0XHRjb25zdCBlZGl0b3JzVG9TYXZlU2VxdWVudGlhbGx5OiBJRWRpdG9ySWRlbnRpZmllcltdID0gW107XG5cdFx0aWYgKG9wdGlvbnM/LnNhdmVBcykge1xuXHRcdFx0ZWRpdG9yc1RvU2F2ZVNlcXVlbnRpYWxseS5wdXNoKC4uLnVuaXF1ZUVkaXRvcnMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRmb3IgKGNvbnN0IHsgZ3JvdXBJZCwgZWRpdG9yIH0gb2YgdW5pcXVlRWRpdG9ycykge1xuXHRcdFx0XHRpZiAoZWRpdG9yLmhhc0NhcGFiaWxpdHkoRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuVW50aXRsZWQpKSB7XG5cdFx0XHRcdFx0ZWRpdG9yc1RvU2F2ZVNlcXVlbnRpYWxseS5wdXNoKHsgZ3JvdXBJZCwgZWRpdG9yIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGVkaXRvcnNUb1NhdmVQYXJhbGxlbC5wdXNoKHsgZ3JvdXBJZCwgZWRpdG9yIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRWRpdG9ycyB0byBzYXZlIGluIHBhcmFsbGVsXG5cdFx0Y29uc3Qgc2F2ZVJlc3VsdHMgPSBhd2FpdCBQcm9taXNlcy5zZXR0bGVkKGVkaXRvcnNUb1NhdmVQYXJhbGxlbC5tYXAoKHsgZ3JvdXBJZCwgZWRpdG9yIH0pID0+IHtcblxuXHRcdFx0Ly8gVXNlIHNhdmUgYXMgYSBoaW50IHRvIHBpbiB0aGUgZWRpdG9yIGlmIHVzZWQgZXhwbGljaXRseVxuXHRcdFx0aWYgKG9wdGlvbnM/LnJlYXNvbiA9PT0gU2F2ZVJlYXNvbi5FWFBMSUNJVCkge1xuXHRcdFx0XHR0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5nZXRHcm91cChncm91cElkKT8ucGluRWRpdG9yKGVkaXRvcik7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNhdmVcblx0XHRcdHJldHVybiBlZGl0b3Iuc2F2ZShncm91cElkLCBvcHRpb25zKTtcblx0XHR9KSk7XG5cblx0XHQvLyBFZGl0b3JzIHRvIHNhdmUgc2VxdWVudGlhbGx5XG5cdFx0Zm9yIChjb25zdCB7IGdyb3VwSWQsIGVkaXRvciB9IG9mIGVkaXRvcnNUb1NhdmVTZXF1ZW50aWFsbHkpIHtcblx0XHRcdGlmIChlZGl0b3IuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHRcdGNvbnRpbnVlOyAvLyBtaWdodCBoYXZlIGJlZW4gZGlzcG9zZWQgZnJvbSB0aGUgc2F2ZSBhbHJlYWR5XG5cdFx0XHR9XG5cblx0XHRcdC8vIFByZXNlcnZlIHZpZXcgc3RhdGUgYnkgb3BlbmluZyB0aGUgZWRpdG9yIGZpcnN0IGlmIHRoZSBlZGl0b3Jcblx0XHRcdC8vIGlzIHVudGl0bGVkIG9yIHdlIFwiU2F2ZSBBc1wiLiBUaGlzIGFsc28gYWxsb3dzIHRoZSB1c2VyIHRvIHJldmlld1xuXHRcdFx0Ly8gdGhlIGNvbnRlbnRzIG9mIHRoZSBlZGl0b3IgYmVmb3JlIG1ha2luZyBhIGRlY2lzaW9uLlxuXHRcdFx0Y29uc3QgZWRpdG9yUGFuZSA9IGF3YWl0IHRoaXMub3BlbkVkaXRvcihlZGl0b3IsIGdyb3VwSWQpO1xuXHRcdFx0Y29uc3QgZWRpdG9yT3B0aW9uczogSUVkaXRvck9wdGlvbnMgPSB7XG5cdFx0XHRcdHBpbm5lZDogdHJ1ZSxcblx0XHRcdFx0dmlld1N0YXRlOiBlZGl0b3JQYW5lPy5nZXRWaWV3U3RhdGUoKVxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gb3B0aW9ucz8uc2F2ZUFzID8gYXdhaXQgZWRpdG9yLnNhdmVBcyhncm91cElkLCBvcHRpb25zKSA6IGF3YWl0IGVkaXRvci5zYXZlKGdyb3VwSWQsIG9wdGlvbnMpO1xuXHRcdFx0c2F2ZVJlc3VsdHMucHVzaChyZXN1bHQpO1xuXG5cdFx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0XHRicmVhazsgLy8gZmFpbGVkIG9yIGNhbmNlbGxlZCwgYWJvcnRcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVwbGFjZSBlZGl0b3IgcHJlc2VydmluZyB2aWV3c3RhdGUgKGVpdGhlciBhY3Jvc3MgYWxsIGdyb3VwcyBvclxuXHRcdFx0Ly8gb25seSBzZWxlY3RlZCBncm91cCkgaWYgdGhlIHJlc3VsdGluZyBlZGl0b3IgaXMgZGlmZmVyZW50IGZyb20gdGhlXG5cdFx0XHQvLyBjdXJyZW50IG9uZS5cblx0XHRcdGlmICghZWRpdG9yLm1hdGNoZXMocmVzdWx0KSkge1xuXHRcdFx0XHRjb25zdCB0YXJnZXRHcm91cHMgPSBlZGl0b3IuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5VbnRpdGxlZCkgPyB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5ncm91cHMubWFwKGdyb3VwID0+IGdyb3VwLmlkKSAvKiB1bnRpdGxlZCByZXBsYWNlcyBhY3Jvc3MgYWxsIGdyb3VwcyAqLyA6IFtncm91cElkXTtcblx0XHRcdFx0Zm9yIChjb25zdCB0YXJnZXRHcm91cCBvZiB0YXJnZXRHcm91cHMpIHtcblx0XHRcdFx0XHRpZiAocmVzdWx0IGluc3RhbmNlb2YgRWRpdG9ySW5wdXQpIHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucmVwbGFjZUVkaXRvcnMoW3sgZWRpdG9yLCByZXBsYWNlbWVudDogcmVzdWx0LCBvcHRpb25zOiBlZGl0b3JPcHRpb25zIH1dLCB0YXJnZXRHcm91cCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucmVwbGFjZUVkaXRvcnMoW3sgZWRpdG9yLCByZXBsYWNlbWVudDogeyAuLi5yZXN1bHQsIG9wdGlvbnM6IGVkaXRvck9wdGlvbnMgfSB9XSwgdGFyZ2V0R3JvdXApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0c3VjY2Vzczogc2F2ZVJlc3VsdHMuZXZlcnkocmVzdWx0ID0+ICEhcmVzdWx0KSxcblx0XHRcdGVkaXRvcnM6IGNvYWxlc2NlKHNhdmVSZXN1bHRzKVxuXHRcdH07XG5cdH1cblxuXHRzYXZlQWxsKG9wdGlvbnM/OiBJU2F2ZUFsbEVkaXRvcnNPcHRpb25zKTogUHJvbWlzZTxJU2F2ZUVkaXRvcnNSZXN1bHQ+IHtcblx0XHRyZXR1cm4gdGhpcy5zYXZlKHRoaXMuZ2V0QWxsTW9kaWZpZWRFZGl0b3JzKG9wdGlvbnMpLCBvcHRpb25zKTtcblx0fVxuXG5cdGFzeW5jIHJldmVydChlZGl0b3JzOiBJRWRpdG9ySWRlbnRpZmllciB8IElFZGl0b3JJZGVudGlmaWVyW10sIG9wdGlvbnM/OiBJUmV2ZXJ0T3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXG5cdFx0Ly8gQ29udmVydCB0byBhcnJheVxuXHRcdGlmICghQXJyYXkuaXNBcnJheShlZGl0b3JzKSkge1xuXHRcdFx0ZWRpdG9ycyA9IFtlZGl0b3JzXTtcblx0XHR9XG5cblx0XHQvLyBNYWtlIHN1cmUgdG8gbm90IHJldmVydCB0aGUgc2FtZSBlZGl0b3IgbXVsdGlwbGUgdGltZXNcblx0XHQvLyBieSB1c2luZyB0aGUgYG1hdGNoZXMoKWAgbWV0aG9kIHRvIGZpbmQgZHVwbGljYXRlc1xuXHRcdGNvbnN0IHVuaXF1ZUVkaXRvcnMgPSB0aGlzLmdldFVuaXF1ZUVkaXRvcnMoZWRpdG9ycyk7XG5cblx0XHRhd2FpdCBQcm9taXNlcy5zZXR0bGVkKHVuaXF1ZUVkaXRvcnMubWFwKGFzeW5jICh7IGdyb3VwSWQsIGVkaXRvciB9KSA9PiB7XG5cblx0XHRcdC8vIFVzZSByZXZlcnQgYXMgYSBoaW50IHRvIHBpbiB0aGUgZWRpdG9yXG5cdFx0XHR0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5nZXRHcm91cChncm91cElkKT8ucGluRWRpdG9yKGVkaXRvcik7XG5cblx0XHRcdHJldHVybiBlZGl0b3IucmV2ZXJ0KGdyb3VwSWQsIG9wdGlvbnMpO1xuXHRcdH0pKTtcblxuXHRcdHJldHVybiAhdW5pcXVlRWRpdG9ycy5zb21lKCh7IGVkaXRvciB9KSA9PiBlZGl0b3IuaXNEaXJ0eSgpKTtcblx0fVxuXG5cdGFzeW5jIHJldmVydEFsbChvcHRpb25zPzogSVJldmVydEFsbEVkaXRvcnNPcHRpb25zKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIHRoaXMucmV2ZXJ0KHRoaXMuZ2V0QWxsTW9kaWZpZWRFZGl0b3JzKG9wdGlvbnMpLCBvcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QWxsTW9kaWZpZWRFZGl0b3JzKG9wdGlvbnM/OiBJQmFzZVNhdmVSZXZlcnRBbGxFZGl0b3JPcHRpb25zKTogSUVkaXRvcklkZW50aWZpZXJbXSB7XG5cdFx0Y29uc3QgZWRpdG9yczogSUVkaXRvcklkZW50aWZpZXJbXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBncm91cCBvZiB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5nZXRHcm91cHMoR3JvdXBzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkpIHtcblx0XHRcdFx0aWYgKCFlZGl0b3IuaXNNb2RpZmllZCgpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoKHR5cGVvZiBvcHRpb25zPy5pbmNsdWRlVW50aXRsZWQgPT09ICdib29sZWFuJyB8fCAhb3B0aW9ucz8uaW5jbHVkZVVudGl0bGVkPy5pbmNsdWRlU2NyYXRjaHBhZClcblx0XHRcdFx0XHQmJiBlZGl0b3IuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5TY3JhdGNocGFkKSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFvcHRpb25zPy5pbmNsdWRlVW50aXRsZWQgJiYgZWRpdG9yLmhhc0NhcGFiaWxpdHkoRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuVW50aXRsZWQpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAob3B0aW9ucz8uZXhjbHVkZVN0aWNreSAmJiBncm91cC5pc1N0aWNreShlZGl0b3IpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRlZGl0b3JzLnB1c2goeyBncm91cElkOiBncm91cC5pZCwgZWRpdG9yIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBlZGl0b3JzO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRVbmlxdWVFZGl0b3JzKGVkaXRvcnM6IElFZGl0b3JJZGVudGlmaWVyW10pOiBJRWRpdG9ySWRlbnRpZmllcltdIHtcblx0XHRjb25zdCB1bmlxdWVFZGl0b3JzOiBJRWRpdG9ySWRlbnRpZmllcltdID0gW107XG5cdFx0Zm9yIChjb25zdCB7IGVkaXRvciwgZ3JvdXBJZCB9IG9mIGVkaXRvcnMpIHtcblx0XHRcdGlmICh1bmlxdWVFZGl0b3JzLnNvbWUodW5pcXVlRWRpdG9yID0+IHVuaXF1ZUVkaXRvci5lZGl0b3IubWF0Y2hlcyhlZGl0b3IpKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0dW5pcXVlRWRpdG9ycy5wdXNoKHsgZWRpdG9yLCBncm91cElkIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmlxdWVFZGl0b3JzO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cblx0XHQvLyBEaXNwb3NlIHJlbWFpbmluZyB3YXRjaGVycyBpZiBhbnlcblx0XHR0aGlzLmFjdGl2ZU91dE9mV29ya3NwYWNlV2F0Y2hlcnMuZm9yRWFjaChkaXNwb3NhYmxlID0+IGRpc3Bvc2UoZGlzcG9zYWJsZSkpO1xuXHRcdHRoaXMuYWN0aXZlT3V0T2ZXb3Jrc3BhY2VXYXRjaGVycy5jbGVhcigpO1xuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElFZGl0b3JTZXJ2aWNlLCBuZXcgU3lu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
