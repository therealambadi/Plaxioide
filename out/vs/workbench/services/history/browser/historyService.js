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
import { URI } from "../../../../base/common/uri.js";
import { EditorResourceAccessor, EditorsOrder, SideBySideEditor, isResourceEditorInput, isEditorInput, isSideBySideEditorInput, EditorCloseContext, EditorPaneSelectionCompareResult, EditorPaneSelectionChangeReason, isEditorPaneWithSelection, GroupModelChangeKind } from "../../../common/editor.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { GoFilter, GoScope, IHistoryService } from "../common/history.js";
import { FileChangesEvent, IFileService, FileChangeType, FILES_EXCLUDE_CONFIG, FileOperationEvent, FileOperation } from "../../../../platform/files/common/files.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { dispose, Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IEditorGroupsService } from "../../editor/common/editorGroupsService.js";
import { getExcludes, SEARCH_EXCLUDE_CONFIG } from "../../search/common/search.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IWorkbenchLayoutService } from "../../layout/browser/layoutService.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { coalesce, remove } from "../../../../base/common/arrays.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { addDisposableListener, EventType, EventHelper, WindowIdleValue } from "../../../../base/browser/dom.js";
import { IWorkspacesService } from "../../../../platform/workspaces/common/workspaces.js";
import { Schemas } from "../../../../base/common/network.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { ResourceGlobMatcher } from "../../../common/resources.js";
import { IPathService } from "../../path/common/pathService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ILifecycleService, LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
import { ILogService, LogLevel } from "../../../../platform/log/common/log.js";
import { mainWindow } from "../../../../base/browser/window.js";
let HistoryService = class extends Disposable {
  constructor(editorService, editorGroupService, contextService, storageService, configurationService, fileService, workspacesService, instantiationService, layoutService, contextKeyService, logService) {
    super();
    this.editorService = editorService;
    this.editorGroupService = editorGroupService;
    this.contextService = contextService;
    this.storageService = storageService;
    this.configurationService = configurationService;
    this.fileService = fileService;
    this.workspacesService = workspacesService;
    this.instantiationService = instantiationService;
    this.layoutService = layoutService;
    this.contextKeyService = contextKeyService;
    this.logService = logService;
    this.activeEditorListeners = this._register(new DisposableStore());
    this.lastActiveEditor = void 0;
    //#endregion
    //#region Editor History Navigation (limit: 50)
    this._onDidChangeEditorNavigationStack = this._register(new Emitter());
    this.onDidChangeEditorNavigationStack = this._onDidChangeEditorNavigationStack.event;
    this.defaultScopedEditorNavigationStack = void 0;
    this.editorGroupScopedNavigationStacks = /* @__PURE__ */ new Map();
    this.editorScopedNavigationStacks = /* @__PURE__ */ new Map();
    this.editorNavigationScope = GoScope.DEFAULT;
    //#endregion
    //#region Navigation: Next/Previous Used Editor
    this.recentlyUsedEditorsStack = void 0;
    this.recentlyUsedEditorsStackIndex = 0;
    this.recentlyUsedEditorsInGroupStack = void 0;
    this.recentlyUsedEditorsInGroupStackIndex = 0;
    this.navigatingInRecentlyUsedEditorsStack = false;
    this.navigatingInRecentlyUsedEditorsInGroupStack = false;
    this.recentlyClosedEditors = [];
    this.ignoreEditorCloseEvent = false;
    this.history = void 0;
    this.editorHistoryListeners = /* @__PURE__ */ new Map();
    this.resourceExcludeMatcher = this._register(new WindowIdleValue(mainWindow, () => {
      const matcher = this._register(this.instantiationService.createInstance(
        ResourceGlobMatcher,
        (root) => getExcludes(root ? this.configurationService.getValue({ resource: root }) : this.configurationService.getValue()) || /* @__PURE__ */ Object.create(null),
        (event) => event.affectsConfiguration(FILES_EXCLUDE_CONFIG) || event.affectsConfiguration(SEARCH_EXCLUDE_CONFIG)
      ));
      this._register(matcher.onExpressionChange(() => this.removeExcludedFromHistory()));
      return matcher;
    }));
    this.editorHelper = this.instantiationService.createInstance(EditorHelper);
    this.canNavigateBackContextKey = new RawContextKey("canNavigateBack", false, localize("canNavigateBack", "Whether it is possible to navigate back in editor history")).bindTo(this.contextKeyService);
    this.canNavigateForwardContextKey = new RawContextKey("canNavigateForward", false, localize("canNavigateForward", "Whether it is possible to navigate forward in editor history")).bindTo(this.contextKeyService);
    this.canNavigateBackInNavigationsContextKey = new RawContextKey("canNavigateBackInNavigationLocations", false, localize("canNavigateBackInNavigationLocations", "Whether it is possible to navigate back in editor navigation locations history")).bindTo(this.contextKeyService);
    this.canNavigateForwardInNavigationsContextKey = new RawContextKey("canNavigateForwardInNavigationLocations", false, localize("canNavigateForwardInNavigationLocations", "Whether it is possible to navigate forward in editor navigation locations history")).bindTo(this.contextKeyService);
    this.canNavigateToLastNavigationLocationContextKey = new RawContextKey("canNavigateToLastNavigationLocation", false, localize("canNavigateToLastNavigationLocation", "Whether it is possible to navigate to the last editor navigation location")).bindTo(this.contextKeyService);
    this.canNavigateBackInEditsContextKey = new RawContextKey("canNavigateBackInEditLocations", false, localize("canNavigateBackInEditLocations", "Whether it is possible to navigate back in editor edit locations history")).bindTo(this.contextKeyService);
    this.canNavigateForwardInEditsContextKey = new RawContextKey("canNavigateForwardInEditLocations", false, localize("canNavigateForwardInEditLocations", "Whether it is possible to navigate forward in editor edit locations history")).bindTo(this.contextKeyService);
    this.canNavigateToLastEditLocationContextKey = new RawContextKey("canNavigateToLastEditLocation", false, localize("canNavigateToLastEditLocation", "Whether it is possible to navigate to the last editor edit location")).bindTo(this.contextKeyService);
    this.canReopenClosedEditorContextKey = new RawContextKey("canReopenClosedEditor", false, localize("canReopenClosedEditor", "Whether it is possible to reopen the last closed editor")).bindTo(this.contextKeyService);
    this.registerListeners();
    if (this.editorService.activeEditorPane) {
      this.onDidActiveEditorChange();
    }
  }
  registerListeners() {
    this.registerMouseNavigationListener();
    this._register(this.editorService.onDidActiveEditorChange(() => this.onDidActiveEditorChange()));
    this._register(this.editorService.onDidOpenEditorFail((event) => this.remove(event.editor)));
    this._register(this.editorService.onDidCloseEditor((event) => this.onDidCloseEditor(event)));
    this._register(this.editorService.onDidMostRecentlyActiveEditorsChange(() => this.handleEditorEventInRecentEditorsStack()));
    this._register(this.editorGroupService.onDidRemoveGroup((e) => this.onDidRemoveGroup(e)));
    this._register(this.fileService.onDidFilesChange((event) => this.onDidFilesChange(event)));
    this._register(this.fileService.onDidRunOperation((event) => this.onDidFilesChange(event)));
    this._register(this.storageService.onWillSaveState(() => this.saveState()));
    this.registerEditorNavigationScopeChangeListener();
    this._register(this.onDidChangeEditorNavigationStack(() => this.updateContextKeys()));
    this._register(this.editorGroupService.onDidChangeActiveGroup(() => this.updateContextKeys()));
  }
  onDidCloseEditor(e) {
    this.handleEditorCloseEventInHistory(e);
    this.handleEditorCloseEventInReopen(e);
  }
  registerMouseNavigationListener() {
    const mouseBackForwardSupportListener = this._register(new DisposableStore());
    const handleMouseBackForwardSupport = () => {
      mouseBackForwardSupportListener.clear();
      if (this.configurationService.getValue(HistoryService.MOUSE_NAVIGATION_SETTING)) {
        this._register(Event.runAndSubscribe(this.layoutService.onDidAddContainer, ({ container, disposables }) => {
          const eventDisposables = disposables.add(new DisposableStore());
          eventDisposables.add(addDisposableListener(container, EventType.MOUSE_DOWN, (e) => this.onMouseDownOrUp(e, true)));
          eventDisposables.add(addDisposableListener(container, EventType.MOUSE_UP, (e) => this.onMouseDownOrUp(e, false)));
          mouseBackForwardSupportListener.add(eventDisposables);
        }, { container: this.layoutService.mainContainer, disposables: this._store }));
      }
    };
    this._register(this.configurationService.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(HistoryService.MOUSE_NAVIGATION_SETTING)) {
        handleMouseBackForwardSupport();
      }
    }));
    handleMouseBackForwardSupport();
  }
  onMouseDownOrUp(event, isMouseDown) {
    switch (event.button) {
      case 3:
        EventHelper.stop(event);
        if (isMouseDown) {
          this.goBack();
        }
        break;
      case 4:
        EventHelper.stop(event);
        if (isMouseDown) {
          this.goForward();
        }
        break;
    }
  }
  onDidRemoveGroup(group) {
    this.handleEditorGroupRemoveInNavigationStacks(group);
  }
  onDidActiveEditorChange() {
    const activeEditorGroup = this.editorGroupService.activeGroup;
    const activeEditorPane = activeEditorGroup.activeEditorPane;
    if (this.lastActiveEditor && this.editorHelper.matchesEditorIdentifier(this.lastActiveEditor, activeEditorPane)) {
      return;
    }
    this.lastActiveEditor = activeEditorPane?.input ? { editor: activeEditorPane.input, groupId: activeEditorPane.group.id } : void 0;
    this.activeEditorListeners.clear();
    if (!activeEditorPane?.group.isTransient(activeEditorPane.input)) {
      this.handleActiveEditorChange(activeEditorGroup, activeEditorPane);
    } else {
      this.logService.trace(`[History]: ignoring transient editor change until becoming non-transient (editor: ${activeEditorPane.input?.resource?.toString()}})`);
      const transientListener = activeEditorGroup.onDidModelChange((e) => {
        if (e.kind === GroupModelChangeKind.EDITOR_TRANSIENT && e.editor === activeEditorPane.input && !activeEditorPane.group.isTransient(activeEditorPane.input)) {
          transientListener.dispose();
          this.handleActiveEditorChange(activeEditorGroup, activeEditorPane);
        }
      });
      this.activeEditorListeners.add(transientListener);
    }
    if (isEditorPaneWithSelection(activeEditorPane)) {
      this.activeEditorListeners.add(activeEditorPane.onDidChangeSelection((e) => {
        if (!activeEditorPane.group.isTransient(activeEditorPane.input)) {
          this.handleActiveEditorSelectionChangeEvent(activeEditorGroup, activeEditorPane, e);
        } else {
          this.logService.trace(`[History]: ignoring transient editor selection change (editor: ${activeEditorPane.input?.resource?.toString()}})`);
        }
      }));
    }
    this.updateContextKeys();
  }
  onDidFilesChange(event) {
    if (event instanceof FileChangesEvent) {
      if (event.gotDeleted()) {
        this.remove(event);
      }
    } else {
      if (event.isOperation(FileOperation.DELETE)) {
        this.remove(event);
      } else if (event.isOperation(FileOperation.MOVE) && event.target.isFile) {
        this.move(event);
      }
    }
  }
  handleActiveEditorChange(group, editorPane) {
    this.handleActiveEditorChangeInHistory(editorPane);
    this.handleActiveEditorChangeInNavigationStacks(group, editorPane);
  }
  handleActiveEditorSelectionChangeEvent(group, editorPane, event) {
    this.handleActiveEditorSelectionChangeInNavigationStacks(group, editorPane, event);
  }
  move(event) {
    this.moveInHistory(event);
    this.moveInEditorNavigationStacks(event);
  }
  remove(arg1) {
    this.removeFromHistory(arg1);
    this.removeFromEditorNavigationStacks(arg1);
    this.removeFromRecentlyClosedEditors(arg1);
    this.removeFromRecentlyOpened(arg1);
  }
  removeFromRecentlyOpened(arg1) {
    let resource = void 0;
    if (isEditorInput(arg1)) {
      resource = EditorResourceAccessor.getOriginalUri(arg1);
    } else if (arg1 instanceof FileChangesEvent) {
    } else {
      resource = arg1.resource;
    }
    if (resource) {
      this.workspacesService.removeRecentlyOpened([resource]);
    }
  }
  clear() {
    this.clearRecentlyOpened();
    this.clearEditorNavigationStacks();
    this.recentlyClosedEditors = [];
    this.updateContextKeys();
  }
  updateContextKeys() {
    this.contextKeyService.bufferChangeEvents(() => {
      const activeStack = this.getStack();
      this.canNavigateBackContextKey.set(activeStack.canGoBack(GoFilter.NONE));
      this.canNavigateForwardContextKey.set(activeStack.canGoForward(GoFilter.NONE));
      this.canNavigateBackInNavigationsContextKey.set(activeStack.canGoBack(GoFilter.NAVIGATION));
      this.canNavigateForwardInNavigationsContextKey.set(activeStack.canGoForward(GoFilter.NAVIGATION));
      this.canNavigateToLastNavigationLocationContextKey.set(activeStack.canGoLast(GoFilter.NAVIGATION));
      this.canNavigateBackInEditsContextKey.set(activeStack.canGoBack(GoFilter.EDITS));
      this.canNavigateForwardInEditsContextKey.set(activeStack.canGoForward(GoFilter.EDITS));
      this.canNavigateToLastEditLocationContextKey.set(activeStack.canGoLast(GoFilter.EDITS));
      this.canReopenClosedEditorContextKey.set(this.recentlyClosedEditors.length > 0);
    });
  }
  registerEditorNavigationScopeChangeListener() {
    const handleEditorNavigationScopeChange = () => {
      this.disposeEditorNavigationStacks();
      const configuredScope = this.configurationService.getValue(HistoryService.NAVIGATION_SCOPE_SETTING);
      if (configuredScope === "editorGroup") {
        this.editorNavigationScope = GoScope.EDITOR_GROUP;
      } else if (configuredScope === "editor") {
        this.editorNavigationScope = GoScope.EDITOR;
      } else {
        this.editorNavigationScope = GoScope.DEFAULT;
      }
    };
    this._register(this.configurationService.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(HistoryService.NAVIGATION_SCOPE_SETTING)) {
        handleEditorNavigationScopeChange();
      }
    }));
    handleEditorNavigationScopeChange();
  }
  getStack(group = this.editorGroupService.activeGroup, editor = group.activeEditor) {
    switch (this.editorNavigationScope) {
      // Per Editor
      case GoScope.EDITOR: {
        if (!editor) {
          return new NoOpEditorNavigationStacks();
        }
        let stacksForGroup = this.editorScopedNavigationStacks.get(group.id);
        if (!stacksForGroup) {
          stacksForGroup = /* @__PURE__ */ new Map();
          this.editorScopedNavigationStacks.set(group.id, stacksForGroup);
        }
        let stack = stacksForGroup.get(editor)?.stack;
        if (!stack) {
          const disposable = new DisposableStore();
          stack = disposable.add(this.instantiationService.createInstance(EditorNavigationStacks, GoScope.EDITOR));
          disposable.add(stack.onDidChange(() => this._onDidChangeEditorNavigationStack.fire()));
          stacksForGroup.set(editor, { stack, disposable });
        }
        return stack;
      }
      // Per Editor Group
      case GoScope.EDITOR_GROUP: {
        let stack = this.editorGroupScopedNavigationStacks.get(group.id)?.stack;
        if (!stack) {
          const disposable = new DisposableStore();
          stack = disposable.add(this.instantiationService.createInstance(EditorNavigationStacks, GoScope.EDITOR_GROUP));
          disposable.add(stack.onDidChange(() => this._onDidChangeEditorNavigationStack.fire()));
          this.editorGroupScopedNavigationStacks.set(group.id, { stack, disposable });
        }
        return stack;
      }
      // Global
      case GoScope.DEFAULT: {
        if (!this.defaultScopedEditorNavigationStack) {
          this.defaultScopedEditorNavigationStack = this._register(this.instantiationService.createInstance(EditorNavigationStacks, GoScope.DEFAULT));
          this._register(this.defaultScopedEditorNavigationStack.onDidChange(() => this._onDidChangeEditorNavigationStack.fire()));
        }
        return this.defaultScopedEditorNavigationStack;
      }
    }
  }
  goForward(filter) {
    return this.getStack().goForward(filter);
  }
  goBack(filter) {
    return this.getStack().goBack(filter);
  }
  goPrevious(filter) {
    return this.getStack().goPrevious(filter);
  }
  goLast(filter) {
    return this.getStack().goLast(filter);
  }
  handleActiveEditorChangeInNavigationStacks(group, editorPane) {
    this.getStack(group, editorPane?.input).handleActiveEditorChange(editorPane);
  }
  handleActiveEditorSelectionChangeInNavigationStacks(group, editorPane, event) {
    this.getStack(group, editorPane.input).handleActiveEditorSelectionChange(editorPane, event);
  }
  handleEditorCloseEventInHistory(e) {
    const editors = this.editorScopedNavigationStacks.get(e.groupId);
    if (editors) {
      const editorStack = editors.get(e.editor);
      if (editorStack) {
        editorStack.disposable.dispose();
        editors.delete(e.editor);
      }
      if (editors.size === 0) {
        this.editorScopedNavigationStacks.delete(e.groupId);
      }
    }
  }
  handleEditorGroupRemoveInNavigationStacks(group) {
    this.defaultScopedEditorNavigationStack?.remove(group.id);
    const editorGroupStack = this.editorGroupScopedNavigationStacks.get(group.id);
    if (editorGroupStack) {
      editorGroupStack.disposable.dispose();
      this.editorGroupScopedNavigationStacks.delete(group.id);
    }
  }
  clearEditorNavigationStacks() {
    this.withEachEditorNavigationStack((stack) => stack.clear());
  }
  removeFromEditorNavigationStacks(arg1) {
    this.withEachEditorNavigationStack((stack) => stack.remove(arg1));
  }
  moveInEditorNavigationStacks(event) {
    this.withEachEditorNavigationStack((stack) => stack.move(event));
  }
  withEachEditorNavigationStack(fn) {
    if (this.defaultScopedEditorNavigationStack) {
      fn(this.defaultScopedEditorNavigationStack);
    }
    for (const [, entry] of this.editorGroupScopedNavigationStacks) {
      fn(entry.stack);
    }
    for (const [, entries] of this.editorScopedNavigationStacks) {
      for (const [, entry] of entries) {
        fn(entry.stack);
      }
    }
  }
  disposeEditorNavigationStacks() {
    this.defaultScopedEditorNavigationStack?.dispose();
    this.defaultScopedEditorNavigationStack = void 0;
    for (const [, stack] of this.editorGroupScopedNavigationStacks) {
      stack.disposable.dispose();
    }
    this.editorGroupScopedNavigationStacks.clear();
    for (const [, stacks] of this.editorScopedNavigationStacks) {
      for (const [, stack] of stacks) {
        stack.disposable.dispose();
      }
    }
    this.editorScopedNavigationStacks.clear();
  }
  openNextRecentlyUsedEditor(groupId) {
    const [stack, index] = this.ensureRecentlyUsedStack((index2) => index2 - 1, groupId);
    return this.doNavigateInRecentlyUsedEditorsStack(stack[index], groupId);
  }
  openPreviouslyUsedEditor(groupId) {
    const [stack, index] = this.ensureRecentlyUsedStack((index2) => index2 + 1, groupId);
    return this.doNavigateInRecentlyUsedEditorsStack(stack[index], groupId);
  }
  async doNavigateInRecentlyUsedEditorsStack(editorIdentifier, groupId) {
    if (editorIdentifier) {
      const acrossGroups = typeof groupId !== "number" || !this.editorGroupService.getGroup(groupId);
      if (acrossGroups) {
        this.navigatingInRecentlyUsedEditorsStack = true;
      } else {
        this.navigatingInRecentlyUsedEditorsInGroupStack = true;
      }
      const group = this.editorGroupService.getGroup(editorIdentifier.groupId) ?? this.editorGroupService.activeGroup;
      try {
        await group.openEditor(editorIdentifier.editor);
      } finally {
        if (acrossGroups) {
          this.navigatingInRecentlyUsedEditorsStack = false;
        } else {
          this.navigatingInRecentlyUsedEditorsInGroupStack = false;
        }
      }
    }
  }
  ensureRecentlyUsedStack(indexModifier, groupId) {
    let editors;
    let index;
    const group = typeof groupId === "number" ? this.editorGroupService.getGroup(groupId) : void 0;
    if (!group) {
      editors = this.recentlyUsedEditorsStack || this.editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
      index = this.recentlyUsedEditorsStackIndex;
    } else {
      editors = this.recentlyUsedEditorsInGroupStack || group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).map((editor) => ({ groupId: group.id, editor }));
      index = this.recentlyUsedEditorsInGroupStackIndex;
    }
    let newIndex = indexModifier(index);
    if (newIndex < 0) {
      newIndex = 0;
    } else if (newIndex > editors.length - 1) {
      newIndex = editors.length - 1;
    }
    if (!group) {
      this.recentlyUsedEditorsStack = editors;
      this.recentlyUsedEditorsStackIndex = newIndex;
    } else {
      this.recentlyUsedEditorsInGroupStack = editors;
      this.recentlyUsedEditorsInGroupStackIndex = newIndex;
    }
    return [editors, newIndex];
  }
  handleEditorEventInRecentEditorsStack() {
    if (!this.navigatingInRecentlyUsedEditorsStack) {
      this.recentlyUsedEditorsStack = void 0;
      this.recentlyUsedEditorsStackIndex = 0;
    }
    if (!this.navigatingInRecentlyUsedEditorsInGroupStack) {
      this.recentlyUsedEditorsInGroupStack = void 0;
      this.recentlyUsedEditorsInGroupStackIndex = 0;
    }
  }
  handleEditorCloseEventInReopen(event) {
    if (this.ignoreEditorCloseEvent) {
      return;
    }
    const { editor, context } = event;
    if (context === EditorCloseContext.REPLACE || context === EditorCloseContext.MOVE) {
      return;
    }
    const untypedEditor = editor.toUntyped();
    if (!untypedEditor) {
      return;
    }
    const associatedResources = [];
    const editorResource = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.BOTH });
    if (URI.isUri(editorResource)) {
      associatedResources.push(editorResource);
    } else if (editorResource) {
      associatedResources.push(...coalesce([editorResource.primary, editorResource.secondary]));
    }
    this.removeFromRecentlyClosedEditors(editor);
    this.recentlyClosedEditors.push({
      editorId: editor.editorId,
      editor: untypedEditor,
      resource: EditorResourceAccessor.getOriginalUri(editor),
      associatedResources,
      index: event.index,
      sticky: event.sticky
    });
    if (this.recentlyClosedEditors.length > HistoryService.MAX_RECENTLY_CLOSED_EDITORS) {
      this.recentlyClosedEditors.shift();
    }
    this.canReopenClosedEditorContextKey.set(true);
  }
  async reopenLastClosedEditor() {
    const lastClosedEditor = this.recentlyClosedEditors.pop();
    let reopenClosedEditorPromise = void 0;
    if (lastClosedEditor) {
      reopenClosedEditorPromise = this.doReopenLastClosedEditor(lastClosedEditor);
    }
    this.canReopenClosedEditorContextKey.set(this.recentlyClosedEditors.length > 0);
    return reopenClosedEditorPromise;
  }
  async doReopenLastClosedEditor(lastClosedEditor) {
    const options = { pinned: true, sticky: lastClosedEditor.sticky, index: lastClosedEditor.index, ignoreError: true };
    if (lastClosedEditor.sticky && !this.editorGroupService.activeGroup.isSticky(lastClosedEditor.index) || !lastClosedEditor.sticky && this.editorGroupService.activeGroup.isSticky(lastClosedEditor.index)) {
      options.index = void 0;
    }
    let editorPane = void 0;
    if (!this.editorGroupService.activeGroup.contains(lastClosedEditor.editor)) {
      this.ignoreEditorCloseEvent = true;
      try {
        editorPane = await this.editorService.openEditor({
          ...lastClosedEditor.editor,
          options: {
            ...lastClosedEditor.editor.options,
            ...options
          }
        });
      } finally {
        this.ignoreEditorCloseEvent = false;
      }
    }
    if (!editorPane) {
      remove(this.recentlyClosedEditors, lastClosedEditor);
      this.reopenLastClosedEditor();
    }
  }
  removeFromRecentlyClosedEditors(arg1) {
    this.recentlyClosedEditors = this.recentlyClosedEditors.filter((recentlyClosedEditor) => {
      if (isEditorInput(arg1) && recentlyClosedEditor.editorId !== arg1.editorId) {
        return true;
      }
      if (recentlyClosedEditor.resource && this.editorHelper.matchesFile(recentlyClosedEditor.resource, arg1)) {
        return false;
      }
      if (recentlyClosedEditor.associatedResources.some((associatedResource) => this.editorHelper.matchesFile(associatedResource, arg1))) {
        return false;
      }
      return true;
    });
    this.canReopenClosedEditorContextKey.set(this.recentlyClosedEditors.length > 0);
  }
  handleActiveEditorChangeInHistory(editorPane) {
    const editor = editorPane?.input;
    if (!editor || editor.isDisposed() || !this.includeInHistory(editor)) {
      return;
    }
    this.removeFromHistory(editor);
    this.addToHistory(editor);
  }
  addToHistory(editor, insertFirst = true) {
    this.ensureHistoryLoaded(this.history);
    const historyInput = this.editorHelper.preferResourceEditorInput(editor);
    if (!historyInput) {
      return;
    }
    if (insertFirst) {
      this.history.unshift(historyInput);
    } else {
      this.history.push(historyInput);
    }
    if (this.history.length > HistoryService.MAX_HISTORY_ITEMS) {
      this.editorHelper.clearOnEditorDispose(this.history.pop(), this.editorHistoryListeners);
    }
    if (isEditorInput(editor)) {
      this.editorHelper.onEditorDispose(editor, () => this.updateHistoryOnEditorDispose(historyInput), this.editorHistoryListeners);
    }
  }
  updateHistoryOnEditorDispose(editor) {
    if (isEditorInput(editor)) {
      if (!isSideBySideEditorInput(editor)) {
        this.removeFromHistory(editor);
      } else {
        const resourceInputs = [];
        const sideInputs = editor.primary.matches(editor.secondary) ? [editor.primary] : [editor.primary, editor.secondary];
        for (const sideInput of sideInputs) {
          const candidateResourceInput = this.editorHelper.preferResourceEditorInput(sideInput);
          if (isResourceEditorInput(candidateResourceInput) && this.includeInHistory(candidateResourceInput)) {
            resourceInputs.push(candidateResourceInput);
          }
        }
        this.replaceInHistory(editor, ...resourceInputs);
      }
    } else {
      if (!this.includeInHistory(editor)) {
        this.removeFromHistory(editor);
      }
    }
  }
  includeInHistory(editor) {
    if (isEditorInput(editor)) {
      return true;
    }
    return !this.resourceExcludeMatcher.value.matches(editor.resource);
  }
  removeExcludedFromHistory() {
    this.ensureHistoryLoaded(this.history);
    this.history = this.history.filter((entry) => {
      const include = this.includeInHistory(entry);
      if (!include) {
        this.editorHelper.clearOnEditorDispose(entry, this.editorHistoryListeners);
      }
      return include;
    });
  }
  moveInHistory(event) {
    if (event.isOperation(FileOperation.MOVE)) {
      const removed = this.removeFromHistory(event);
      if (removed) {
        this.addToHistory({ resource: event.target.resource });
      }
    }
  }
  removeFromHistory(arg1) {
    let removed = false;
    this.ensureHistoryLoaded(this.history);
    this.history = this.history.filter((entry) => {
      const matches = this.editorHelper.matchesEditor(arg1, entry);
      if (matches) {
        this.editorHelper.clearOnEditorDispose(arg1, this.editorHistoryListeners);
        removed = true;
      }
      return !matches;
    });
    return removed;
  }
  replaceInHistory(editor, ...replacements) {
    this.ensureHistoryLoaded(this.history);
    let replaced = false;
    const newHistory = [];
    for (const entry of this.history) {
      if (this.editorHelper.matchesEditor(editor, entry)) {
        this.editorHelper.clearOnEditorDispose(editor, this.editorHistoryListeners);
        if (!replaced) {
          newHistory.push(...replacements);
          replaced = true;
        }
      } else if (!replacements.some((replacement) => this.editorHelper.matchesEditor(replacement, entry))) {
        newHistory.push(entry);
      }
    }
    if (!replaced) {
      newHistory.push(...replacements);
    }
    this.history = newHistory;
  }
  clearRecentlyOpened() {
    this.history = [];
    for (const [, disposable] of this.editorHistoryListeners) {
      dispose(disposable);
    }
    this.editorHistoryListeners.clear();
  }
  getHistory() {
    this.ensureHistoryLoaded(this.history);
    return this.history;
  }
  ensureHistoryLoaded(history) {
    if (!this.history) {
      this.history = [];
      if (this.editorGroupService.isReady) {
        this.loadHistory();
      } else {
        (async () => {
          await this.editorGroupService.whenReady;
          this.loadHistory();
        })();
      }
    }
  }
  loadHistory() {
    this.history = [];
    const storedEditorHistory = this.loadHistoryFromStorage();
    const openedEditorsLru = [...this.editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)].reverse();
    const handledEditors = /* @__PURE__ */ new Set();
    for (const { editor } of openedEditorsLru) {
      if (!this.includeInHistory(editor)) {
        continue;
      }
      if (editor.resource) {
        const historyEntryId = `${editor.resource.toString()}/${editor.editorId}`;
        if (handledEditors.has(historyEntryId)) {
          continue;
        }
        handledEditors.add(historyEntryId);
      }
      this.addToHistory(editor);
    }
    for (const editor of storedEditorHistory) {
      const historyEntryId = `${editor.resource.toString()}/${editor.options?.override}`;
      if (!handledEditors.has(historyEntryId) && this.includeInHistory(editor)) {
        handledEditors.add(historyEntryId);
        this.addToHistory(
          editor,
          false
          /* at the end */
        );
      }
    }
  }
  loadHistoryFromStorage() {
    const entries = [];
    const entriesRaw = this.storageService.get(HistoryService.HISTORY_STORAGE_KEY, StorageScope.WORKSPACE);
    if (entriesRaw) {
      try {
        const entriesParsed = JSON.parse(entriesRaw);
        for (const entryParsed of entriesParsed) {
          if (!entryParsed.editor || !entryParsed.editor.resource) {
            continue;
          }
          try {
            entries.push({
              ...entryParsed.editor,
              resource: typeof entryParsed.editor.resource === "string" ? URI.parse(entryParsed.editor.resource) : (
                //  from 1.67.x: URI is stored efficiently as URI.toString()
                URI.from(entryParsed.editor.resource)
              )
              // until 1.66.x: URI was stored very verbose as URI.toJSON()
            });
          } catch (error) {
            onUnexpectedError(error);
          }
        }
      } catch (error) {
        onUnexpectedError(error);
      }
    }
    return entries;
  }
  saveState() {
    if (!this.history) {
      return;
    }
    const entries = [];
    for (const editor of this.history) {
      if (isEditorInput(editor) || !isResourceEditorInput(editor)) {
        continue;
      }
      entries.push({
        editor: {
          ...editor,
          resource: editor.resource.toString()
        }
      });
    }
    this.storageService.store(HistoryService.HISTORY_STORAGE_KEY, JSON.stringify(entries), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  //#endregion
  //#region Last Active Workspace/File
  getLastActiveWorkspaceRoot(schemeFilter, authorityFilter) {
    const folders = this.contextService.getWorkspace().folders;
    if (folders.length === 0) {
      return void 0;
    }
    if (folders.length === 1) {
      const resource = folders[0].uri;
      if ((!schemeFilter || resource.scheme === schemeFilter) && (!authorityFilter || resource.authority === authorityFilter)) {
        return resource;
      }
      return void 0;
    }
    for (const input of this.getHistory()) {
      if (isEditorInput(input)) {
        continue;
      }
      if (schemeFilter && input.resource.scheme !== schemeFilter) {
        continue;
      }
      if (authorityFilter && input.resource.authority !== authorityFilter) {
        continue;
      }
      const resourceWorkspace = this.contextService.getWorkspaceFolder(input.resource);
      if (resourceWorkspace) {
        return resourceWorkspace.uri;
      }
    }
    for (const folder of folders) {
      const resource = folder.uri;
      if ((!schemeFilter || resource.scheme === schemeFilter) && (!authorityFilter || resource.authority === authorityFilter)) {
        return resource;
      }
    }
    return void 0;
  }
  getLastActiveFile(filterByScheme, filterByAuthority) {
    for (const input of this.getHistory()) {
      let resource;
      if (isEditorInput(input)) {
        resource = EditorResourceAccessor.getOriginalUri(input, { filterByScheme });
      } else {
        resource = input.resource;
      }
      if (resource && resource.scheme === filterByScheme && (!filterByAuthority || resource.authority === filterByAuthority)) {
        return resource;
      }
    }
    return void 0;
  }
  //#endregion
  dispose() {
    super.dispose();
    for (const [, stack] of this.editorGroupScopedNavigationStacks) {
      stack.disposable.dispose();
    }
    for (const [, editors] of this.editorScopedNavigationStacks) {
      for (const [, stack] of editors) {
        stack.disposable.dispose();
      }
    }
    for (const [, listener] of this.editorHistoryListeners) {
      listener.dispose();
    }
  }
};
HistoryService.MOUSE_NAVIGATION_SETTING = "workbench.editor.mouseBackForwardToNavigate";
HistoryService.NAVIGATION_SCOPE_SETTING = "workbench.editor.navigationScope";
//#endregion
//#region File: Reopen Closed Editor (limit: 20)
HistoryService.MAX_RECENTLY_CLOSED_EDITORS = 20;
//#endregion
//#region Go to: Recently Opened Editor (limit: 200, persisted)
HistoryService.MAX_HISTORY_ITEMS = 200;
HistoryService.HISTORY_STORAGE_KEY = "history.entries";
HistoryService = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IEditorGroupsService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IWorkspacesService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IWorkbenchLayoutService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, ILogService)
], HistoryService);
registerSingleton(IHistoryService, HistoryService, InstantiationType.Eager);
class EditorSelectionState {
  constructor(editorIdentifier, selection, reason) {
    this.editorIdentifier = editorIdentifier;
    this.selection = selection;
    this.reason = reason;
  }
  justifiesNewNavigationEntry(other) {
    if (this.editorIdentifier.groupId !== other.editorIdentifier.groupId) {
      return true;
    }
    if (!this.editorIdentifier.editor.matches(other.editorIdentifier.editor)) {
      return true;
    }
    if (!this.selection || !other.selection) {
      return true;
    }
    const result = this.selection.compare(other.selection);
    if (result === EditorPaneSelectionCompareResult.SIMILAR && (other.reason === EditorPaneSelectionChangeReason.NAVIGATION || other.reason === EditorPaneSelectionChangeReason.JUMP)) {
      return true;
    }
    return result === EditorPaneSelectionCompareResult.DIFFERENT;
  }
}
let EditorNavigationStacks = class extends Disposable {
  constructor(scope, instantiationService) {
    super();
    this.scope = scope;
    this.instantiationService = instantiationService;
    this.selectionsStack = this._register(this.instantiationService.createInstance(EditorNavigationStack, GoFilter.NONE, this.scope));
    this.editsStack = this._register(this.instantiationService.createInstance(EditorNavigationStack, GoFilter.EDITS, this.scope));
    this.navigationsStack = this._register(this.instantiationService.createInstance(EditorNavigationStack, GoFilter.NAVIGATION, this.scope));
    this.stacks = [
      this.selectionsStack,
      this.editsStack,
      this.navigationsStack
    ];
    this.onDidChange = Event.any(
      this.selectionsStack.onDidChange,
      this.editsStack.onDidChange,
      this.navigationsStack.onDidChange
    );
  }
  canGoForward(filter) {
    return this.getStack(filter).canGoForward();
  }
  goForward(filter) {
    return this.getStack(filter).goForward();
  }
  canGoBack(filter) {
    return this.getStack(filter).canGoBack();
  }
  goBack(filter) {
    return this.getStack(filter).goBack();
  }
  goPrevious(filter) {
    return this.getStack(filter).goPrevious();
  }
  canGoLast(filter) {
    return this.getStack(filter).canGoLast();
  }
  goLast(filter) {
    return this.getStack(filter).goLast();
  }
  getStack(filter = GoFilter.NONE) {
    switch (filter) {
      case GoFilter.NONE:
        return this.selectionsStack;
      case GoFilter.EDITS:
        return this.editsStack;
      case GoFilter.NAVIGATION:
        return this.navigationsStack;
    }
  }
  handleActiveEditorChange(editorPane) {
    this.selectionsStack.notifyNavigation(editorPane);
  }
  handleActiveEditorSelectionChange(editorPane, event) {
    const previous = this.selectionsStack.current;
    this.selectionsStack.notifyNavigation(editorPane, event);
    if (event.reason === EditorPaneSelectionChangeReason.EDIT) {
      this.editsStack.notifyNavigation(editorPane, event);
    } else if ((event.reason === EditorPaneSelectionChangeReason.NAVIGATION || event.reason === EditorPaneSelectionChangeReason.JUMP) && !this.selectionsStack.isNavigating()) {
      if (event.reason === EditorPaneSelectionChangeReason.JUMP && !this.navigationsStack.isNavigating()) {
        if (previous) {
          this.navigationsStack.addOrReplace(previous.groupId, previous.editor, previous.selection);
        }
      }
      this.navigationsStack.notifyNavigation(editorPane, event);
    }
  }
  clear() {
    for (const stack of this.stacks) {
      stack.clear();
    }
  }
  remove(arg1) {
    for (const stack of this.stacks) {
      stack.remove(arg1);
    }
  }
  move(event) {
    for (const stack of this.stacks) {
      stack.move(event);
    }
  }
};
EditorNavigationStacks = __decorateClass([
  __decorateParam(1, IInstantiationService)
], EditorNavigationStacks);
class NoOpEditorNavigationStacks {
  constructor() {
    this.onDidChange = Event.None;
  }
  canGoForward() {
    return false;
  }
  async goForward() {
  }
  canGoBack() {
    return false;
  }
  async goBack() {
  }
  async goPrevious() {
  }
  canGoLast() {
    return false;
  }
  async goLast() {
  }
  handleActiveEditorChange() {
  }
  handleActiveEditorSelectionChange() {
  }
  clear() {
  }
  remove() {
  }
  move() {
  }
  dispose() {
  }
}
let EditorNavigationStack = class extends Disposable {
  constructor(filter, scope, instantiationService, editorService, editorGroupService, logService) {
    super();
    this.filter = filter;
    this.scope = scope;
    this.editorService = editorService;
    this.editorGroupService = editorGroupService;
    this.logService = logService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.mapEditorToDisposable = /* @__PURE__ */ new Map();
    this.mapGroupToDisposable = /* @__PURE__ */ new Map();
    this.stack = [];
    this.index = -1;
    this.previousIndex = -1;
    this.navigating = false;
    this.currentSelectionState = void 0;
    this.editorHelper = instantiationService.createInstance(EditorHelper);
    this.registerListeners();
  }
  get current() {
    return this.stack[this.index];
  }
  set current(entry) {
    if (entry) {
      this.stack[this.index] = entry;
    }
  }
  registerListeners() {
    this._register(this.onDidChange(() => this.traceStack()));
    this._register(this.logService.onDidChangeLogLevel(() => this.traceStack()));
  }
  traceStack() {
    if (this.logService.getLevel() !== LogLevel.Trace) {
      return;
    }
    const entryLabels = [];
    for (const entry of this.stack) {
      if (typeof entry.selection?.log === "function") {
        entryLabels.push(`- group: ${entry.groupId}, editor: ${entry.editor.resource?.toString()}, selection: ${entry.selection.log()}`);
      } else {
        entryLabels.push(`- group: ${entry.groupId}, editor: ${entry.editor.resource?.toString()}, selection: <none>`);
      }
    }
    if (entryLabels.length === 0) {
      this.trace(`index: ${this.index}, navigating: ${this.isNavigating()}: <empty>`);
    } else {
      this.trace(`index: ${this.index}, navigating: ${this.isNavigating()}
${entryLabels.join("\n")}
			`);
    }
  }
  trace(msg, editor = null, event) {
    if (this.logService.getLevel() !== LogLevel.Trace) {
      return;
    }
    let filterLabel;
    switch (this.filter) {
      case GoFilter.NONE:
        filterLabel = "global";
        break;
      case GoFilter.EDITS:
        filterLabel = "edits";
        break;
      case GoFilter.NAVIGATION:
        filterLabel = "navigation";
        break;
    }
    let scopeLabel;
    switch (this.scope) {
      case GoScope.DEFAULT:
        scopeLabel = "default";
        break;
      case GoScope.EDITOR_GROUP:
        scopeLabel = "editorGroup";
        break;
      case GoScope.EDITOR:
        scopeLabel = "editor";
        break;
    }
    if (editor !== null) {
      this.logService.trace(`[History stack ${filterLabel}-${scopeLabel}]: ${msg} (editor: ${editor?.resource?.toString()}, event: ${this.traceEvent(event)})`);
    } else {
      this.logService.trace(`[History stack ${filterLabel}-${scopeLabel}]: ${msg}`);
    }
  }
  traceEvent(event) {
    if (!event) {
      return "<none>";
    }
    switch (event.reason) {
      case EditorPaneSelectionChangeReason.EDIT:
        return "edit";
      case EditorPaneSelectionChangeReason.NAVIGATION:
        return "navigation";
      case EditorPaneSelectionChangeReason.JUMP:
        return "jump";
      case EditorPaneSelectionChangeReason.PROGRAMMATIC:
        return "programmatic";
      case EditorPaneSelectionChangeReason.USER:
        return "user";
    }
  }
  registerGroupListeners(groupId) {
    if (!this.mapGroupToDisposable.has(groupId)) {
      const group = this.editorGroupService.getGroup(groupId);
      if (group) {
        this.mapGroupToDisposable.set(groupId, group.onWillMoveEditor((e) => this.onWillMoveEditor(e)));
      }
    }
  }
  onWillMoveEditor(e) {
    this.trace("onWillMoveEditor()", e.editor);
    if (this.scope === GoScope.EDITOR_GROUP) {
      return;
    }
    for (const entry of this.stack) {
      if (entry.groupId !== e.groupId) {
        continue;
      }
      if (!this.editorHelper.matchesEditor(e.editor, entry.editor)) {
        continue;
      }
      entry.groupId = e.target;
    }
  }
  //#region Stack Mutation
  notifyNavigation(editorPane, event) {
    this.trace("notifyNavigation()", editorPane?.input, event);
    const isSelectionAwareEditorPane = isEditorPaneWithSelection(editorPane);
    const hasValidEditor = editorPane?.input && !editorPane.input.isDisposed();
    if (this.navigating) {
      this.trace(`notifyNavigation() ignoring (navigating)`, editorPane?.input, event);
      if (isSelectionAwareEditorPane && hasValidEditor) {
        this.trace("notifyNavigation() updating current selection state", editorPane?.input, event);
        this.currentSelectionState = new EditorSelectionState({ groupId: editorPane.group.id, editor: editorPane.input }, editorPane.getSelection(), event?.reason);
      } else {
        this.trace("notifyNavigation() dropping current selection state", editorPane?.input, event);
        this.currentSelectionState = void 0;
      }
    } else {
      this.trace(`notifyNavigation() not ignoring`, editorPane?.input, event);
      if (isSelectionAwareEditorPane && hasValidEditor) {
        this.onSelectionAwareEditorNavigation(editorPane.group.id, editorPane.input, editorPane.getSelection(), event);
      } else {
        this.currentSelectionState = void 0;
        if (hasValidEditor) {
          this.onNonSelectionAwareEditorNavigation(editorPane.group.id, editorPane.input);
        }
      }
    }
  }
  onSelectionAwareEditorNavigation(groupId, editor, selection, event) {
    if (this.current?.groupId === groupId && !selection && this.editorHelper.matchesEditor(this.current.editor, editor)) {
      return;
    }
    this.trace("onSelectionAwareEditorNavigation()", editor, event);
    const stateCandidate = new EditorSelectionState({ groupId, editor }, selection, event?.reason);
    if (!this.currentSelectionState || this.currentSelectionState.justifiesNewNavigationEntry(stateCandidate)) {
      this.doAdd(groupId, editor, stateCandidate.selection);
    } else {
      this.doReplace(groupId, editor, stateCandidate.selection);
    }
    this.currentSelectionState = stateCandidate;
  }
  onNonSelectionAwareEditorNavigation(groupId, editor) {
    if (this.current?.groupId === groupId && this.editorHelper.matchesEditor(this.current.editor, editor)) {
      return;
    }
    this.trace("onNonSelectionAwareEditorNavigation()", editor);
    this.doAdd(groupId, editor);
  }
  doAdd(groupId, editor, selection) {
    if (!this.navigating) {
      this.addOrReplace(groupId, editor, selection);
    }
  }
  doReplace(groupId, editor, selection) {
    if (!this.navigating) {
      this.addOrReplace(
        groupId,
        editor,
        selection,
        true
        /* force replace */
      );
    }
  }
  addOrReplace(groupId, editorCandidate, selection, forceReplace) {
    this.registerGroupListeners(groupId);
    let replace = false;
    if (this.current) {
      if (forceReplace) {
        replace = true;
      } else if (this.shouldReplaceStackEntry(this.current, { groupId, editor: editorCandidate, selection })) {
        replace = true;
      }
    }
    const editor = this.editorHelper.preferResourceEditorInput(editorCandidate);
    if (!editor) {
      return;
    }
    if (replace) {
      this.trace("replace()", editor);
    } else {
      this.trace("add()", editor);
    }
    const newStackEntry = { groupId, editor, selection };
    const removedEntries = [];
    if (replace) {
      if (this.current) {
        removedEntries.push(this.current);
      }
      this.current = newStackEntry;
    } else {
      if (this.stack.length > this.index + 1) {
        for (let i = this.index + 1; i < this.stack.length; i++) {
          removedEntries.push(this.stack[i]);
        }
        this.stack = this.stack.slice(0, this.index + 1);
      }
      this.stack.splice(this.index + 1, 0, newStackEntry);
      if (this.stack.length > EditorNavigationStack.MAX_STACK_SIZE) {
        removedEntries.push(this.stack.shift());
        if (this.previousIndex >= 0) {
          this.previousIndex--;
        }
      } else {
        this.setIndex(
          this.index + 1,
          true
          /* skip event, we fire it later */
        );
      }
    }
    for (const removedEntry of removedEntries) {
      this.editorHelper.clearOnEditorDispose(removedEntry.editor, this.mapEditorToDisposable);
    }
    if (isEditorInput(editor)) {
      this.editorHelper.onEditorDispose(editor, () => this.remove(editor), this.mapEditorToDisposable);
    }
    this._onDidChange.fire();
  }
  shouldReplaceStackEntry(entry, candidate) {
    if (entry.groupId !== candidate.groupId) {
      return false;
    }
    if (!this.editorHelper.matchesEditor(entry.editor, candidate.editor)) {
      return false;
    }
    if (!entry.selection) {
      return true;
    }
    if (!candidate.selection) {
      return false;
    }
    return entry.selection.compare(candidate.selection) === EditorPaneSelectionCompareResult.IDENTICAL;
  }
  move(event) {
    if (event.isOperation(FileOperation.MOVE)) {
      for (const entry of this.stack) {
        if (this.editorHelper.matchesEditor(event, entry.editor)) {
          entry.editor = { resource: event.target.resource };
        }
      }
    }
  }
  remove(arg1) {
    const previousStackSize = this.stack.length;
    this.stack = this.stack.filter((entry) => {
      const matches = typeof arg1 === "number" ? entry.groupId === arg1 : this.editorHelper.matchesEditor(arg1, entry.editor);
      if (matches) {
        this.editorHelper.clearOnEditorDispose(entry.editor, this.mapEditorToDisposable);
      }
      return !matches;
    });
    if (previousStackSize === this.stack.length) {
      return;
    }
    this.flatten();
    this.index = this.stack.length - 1;
    this.previousIndex = -1;
    if (typeof arg1 === "number") {
      this.mapGroupToDisposable.get(arg1)?.dispose();
      this.mapGroupToDisposable.delete(arg1);
    }
    this._onDidChange.fire();
  }
  flatten() {
    const flattenedStack = [];
    let previousEntry = void 0;
    for (const entry of this.stack) {
      if (previousEntry && this.shouldReplaceStackEntry(entry, previousEntry)) {
        continue;
      }
      previousEntry = entry;
      flattenedStack.push(entry);
    }
    this.stack = flattenedStack;
  }
  clear() {
    this.index = -1;
    this.previousIndex = -1;
    this.stack.splice(0);
    for (const [, disposable] of this.mapEditorToDisposable) {
      dispose(disposable);
    }
    this.mapEditorToDisposable.clear();
    for (const [, disposable] of this.mapGroupToDisposable) {
      dispose(disposable);
    }
    this.mapGroupToDisposable.clear();
  }
  dispose() {
    super.dispose();
    this.clear();
  }
  //#endregion
  //#region Navigation
  canGoForward() {
    return this.stack.length > this.index + 1;
  }
  async goForward() {
    const navigated = await this.maybeGoCurrent();
    if (navigated) {
      return;
    }
    if (!this.canGoForward()) {
      return;
    }
    this.setIndex(this.index + 1);
    return this.navigate();
  }
  canGoBack() {
    return this.index > 0;
  }
  async goBack() {
    const navigated = await this.maybeGoCurrent();
    if (navigated) {
      return;
    }
    if (!this.canGoBack()) {
      return;
    }
    this.setIndex(this.index - 1);
    return this.navigate();
  }
  async goPrevious() {
    const navigated = await this.maybeGoCurrent();
    if (navigated) {
      return;
    }
    if (this.previousIndex === -1) {
      return this.goBack();
    }
    this.setIndex(this.previousIndex);
    return this.navigate();
  }
  canGoLast() {
    return this.stack.length > 0;
  }
  async goLast() {
    if (!this.canGoLast()) {
      return;
    }
    this.setIndex(this.stack.length - 1);
    return this.navigate();
  }
  async maybeGoCurrent() {
    if (this.filter === GoFilter.NONE) {
      return false;
    }
    if (this.isCurrentSelectionActive()) {
      return false;
    }
    await this.navigate();
    return true;
  }
  isCurrentSelectionActive() {
    if (!this.current?.selection) {
      return false;
    }
    const pane = this.editorService.activeEditorPane;
    if (!isEditorPaneWithSelection(pane)) {
      return false;
    }
    if (pane.group.id !== this.current.groupId) {
      return false;
    }
    if (!pane.input || !this.editorHelper.matchesEditor(pane.input, this.current.editor)) {
      return false;
    }
    const paneSelection = pane.getSelection();
    if (!paneSelection) {
      return false;
    }
    return paneSelection.compare(this.current.selection) === EditorPaneSelectionCompareResult.IDENTICAL;
  }
  setIndex(newIndex, skipEvent) {
    this.previousIndex = this.index;
    this.index = newIndex;
    if (!skipEvent) {
      this._onDidChange.fire();
    }
  }
  async navigate() {
    this.navigating = true;
    try {
      if (this.current) {
        await this.doNavigate(this.current);
      }
    } finally {
      this.navigating = false;
    }
  }
  doNavigate(location) {
    let options = /* @__PURE__ */ Object.create(null);
    if (location.selection) {
      options = location.selection.restore(options);
    }
    if (isEditorInput(location.editor)) {
      return this.editorService.openEditor(location.editor, options, location.groupId);
    }
    return this.editorService.openEditor({
      ...location.editor,
      options: {
        ...location.editor.options,
        ...options
      }
    }, location.groupId);
  }
  isNavigating() {
    return this.navigating;
  }
  //#endregion
};
EditorNavigationStack.MAX_STACK_SIZE = 50;
EditorNavigationStack = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IEditorGroupsService),
  __decorateParam(5, ILogService)
], EditorNavigationStack);
let EditorHelper = class {
  constructor(uriIdentityService, lifecycleService, fileService, pathService) {
    this.uriIdentityService = uriIdentityService;
    this.lifecycleService = lifecycleService;
    this.fileService = fileService;
    this.pathService = pathService;
  }
  preferResourceEditorInput(editor) {
    const resource = EditorResourceAccessor.getOriginalUri(editor);
    const hasValidResourceEditorInputScheme = resource?.scheme === Schemas.file || resource?.scheme === Schemas.vscodeRemote || resource?.scheme === Schemas.vscodeUserData || resource?.scheme === this.pathService.defaultUriScheme;
    if (hasValidResourceEditorInputScheme) {
      if (isEditorInput(editor)) {
        const untypedInput = editor.toUntyped();
        if (isResourceEditorInput(untypedInput)) {
          return untypedInput;
        }
      }
      return editor;
    } else {
      return isEditorInput(editor) ? editor : void 0;
    }
  }
  matchesEditor(arg1, inputB) {
    if (arg1 instanceof FileChangesEvent || arg1 instanceof FileOperationEvent) {
      if (isEditorInput(inputB)) {
        return false;
      }
      if (arg1 instanceof FileChangesEvent) {
        return arg1.contains(inputB.resource, FileChangeType.DELETED);
      }
      return this.matchesFile(inputB.resource, arg1);
    }
    if (isEditorInput(arg1)) {
      if (isEditorInput(inputB)) {
        return arg1.matches(inputB);
      }
      return this.matchesFile(inputB.resource, arg1);
    }
    if (isEditorInput(inputB)) {
      return this.matchesFile(arg1.resource, inputB);
    }
    return arg1 && inputB && this.uriIdentityService.extUri.isEqual(arg1.resource, inputB.resource);
  }
  matchesFile(resource, arg2) {
    if (arg2 instanceof FileChangesEvent) {
      return arg2.contains(resource, FileChangeType.DELETED);
    }
    if (arg2 instanceof FileOperationEvent) {
      return this.uriIdentityService.extUri.isEqualOrParent(resource, arg2.resource);
    }
    if (isEditorInput(arg2)) {
      const inputResource = arg2.resource;
      if (!inputResource) {
        return false;
      }
      if (this.lifecycleService.phase >= LifecyclePhase.Restored && !this.fileService.hasProvider(inputResource)) {
        return false;
      }
      return this.uriIdentityService.extUri.isEqual(inputResource, resource);
    }
    return this.uriIdentityService.extUri.isEqual(arg2?.resource, resource);
  }
  matchesEditorIdentifier(identifier, editorPane) {
    if (!editorPane?.group) {
      return false;
    }
    if (identifier.groupId !== editorPane.group.id) {
      return false;
    }
    return editorPane.input ? identifier.editor.matches(editorPane.input) : false;
  }
  onEditorDispose(editor, listener, mapEditorToDispose) {
    const toDispose = Event.once(editor.onWillDispose)(() => listener());
    let disposables = mapEditorToDispose.get(editor);
    if (!disposables) {
      disposables = new DisposableStore();
      mapEditorToDispose.set(editor, disposables);
    }
    disposables.add(toDispose);
  }
  clearOnEditorDispose(editor, mapEditorToDispose) {
    if (!isEditorInput(editor)) {
      return;
    }
    const disposables = mapEditorToDispose.get(editor);
    if (disposables) {
      dispose(disposables);
      mapEditorToDispose.delete(editor);
    }
  }
};
EditorHelper = __decorateClass([
  __decorateParam(0, IUriIdentityService),
  __decorateParam(1, ILifecycleService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IPathService)
], EditorHelper);
export {
  EditorNavigationStack,
  HistoryService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvaGlzdG9yeS9icm93c2VyL2hpc3RvcnlTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElSZXNvdXJjZUVkaXRvcklucHV0LCBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElFZGl0b3JQYW5lLCBJRWRpdG9yQ2xvc2VFdmVudCwgRWRpdG9yUmVzb3VyY2VBY2Nlc3NvciwgSUVkaXRvcklkZW50aWZpZXIsIEdyb3VwSWRlbnRpZmllciwgRWRpdG9yc09yZGVyLCBTaWRlQnlTaWRlRWRpdG9yLCBJVW50eXBlZEVkaXRvcklucHV0LCBpc1Jlc291cmNlRWRpdG9ySW5wdXQsIGlzRWRpdG9ySW5wdXQsIGlzU2lkZUJ5U2lkZUVkaXRvcklucHV0LCBFZGl0b3JDbG9zZUNvbnRleHQsIElFZGl0b3JQYW5lU2VsZWN0aW9uLCBFZGl0b3JQYW5lU2VsZWN0aW9uQ29tcGFyZVJlc3VsdCwgRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZVJlYXNvbiwgaXNFZGl0b3JQYW5lV2l0aFNlbGVjdGlvbiwgSUVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VFdmVudCwgSUVkaXRvclBhbmVXaXRoU2VsZWN0aW9uLCBJRWRpdG9yV2lsbE1vdmVFdmVudCwgR3JvdXBNb2RlbENoYW5nZUtpbmQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBHb0ZpbHRlciwgR29TY29wZSwgSUhpc3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2hpc3RvcnkuanMnO1xuaW1wb3J0IHsgRmlsZUNoYW5nZXNFdmVudCwgSUZpbGVTZXJ2aWNlLCBGaWxlQ2hhbmdlVHlwZSwgRklMRVNfRVhDTFVERV9DT05GSUcsIEZpbGVPcGVyYXRpb25FdmVudCwgRmlsZU9wZXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBkaXNwb3NlLCBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3VwLCBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXRFeGNsdWRlcywgSVNlYXJjaENvbmZpZ3VyYXRpb24sIFNFQVJDSF9FWENMVURFX0NPTkZJRyB9IGZyb20gJy4uLy4uL3NlYXJjaC9jb21tb24vc2VhcmNoLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yU2VydmljZUltcGwgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaExheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IGNvYWxlc2NlLCByZW1vdmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIEV2ZW50VHlwZSwgRXZlbnRIZWxwZXIsIFdpbmRvd0lkbGVWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlcy9jb21tb24vd29ya3NwYWNlcy5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUdsb2JNYXRjaGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJUGF0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wYXRoL2NvbW1vbi9wYXRoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlLCBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlLCBMb2dMZXZlbCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcblxuaW50ZXJmYWNlIElTZXJpYWxpemVkRWRpdG9ySGlzdG9yeUVudHJ5IHtcblx0cmVhZG9ubHkgZWRpdG9yOiBPbWl0PElSZXNvdXJjZUVkaXRvcklucHV0LCAncmVzb3VyY2UnPiAmIHsgcmVzb3VyY2U6IHN0cmluZyB9O1xufVxuXG5pbnRlcmZhY2UgSVJlY2VudGx5Q2xvc2VkRWRpdG9yIHtcblx0cmVhZG9ubHkgZWRpdG9ySWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgZWRpdG9yOiBJVW50eXBlZEVkaXRvcklucHV0O1xuXG5cdHJlYWRvbmx5IHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGFzc29jaWF0ZWRSZXNvdXJjZXM6IFVSSVtdO1xuXG5cdHJlYWRvbmx5IGluZGV4OiBudW1iZXI7XG5cdHJlYWRvbmx5IHN0aWNreTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIEhpc3RvcnlTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElIaXN0b3J5U2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgTU9VU0VfTkFWSUdBVElPTl9TRVRUSU5HID0gJ3dvcmtiZW5jaC5lZGl0b3IubW91c2VCYWNrRm9yd2FyZFRvTmF2aWdhdGUnO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBOQVZJR0FUSU9OX1NDT1BFX1NFVFRJTkcgPSAnd29ya2JlbmNoLmVkaXRvci5uYXZpZ2F0aW9uU2NvcGUnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgYWN0aXZlRWRpdG9yTGlzdGVuZXJzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSBsYXN0QWN0aXZlRWRpdG9yOiBJRWRpdG9ySWRlbnRpZmllciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvckhlbHBlcjogRWRpdG9ySGVscGVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IEVkaXRvclNlcnZpY2VJbXBsLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZXNTZXJ2aWNlOiBJV29ya3NwYWNlc1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGF5b3V0U2VydmljZTogSVdvcmtiZW5jaExheW91dFNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuZWRpdG9ySGVscGVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFZGl0b3JIZWxwZXIpO1xuXG5cdFx0dGhpcy5jYW5OYXZpZ2F0ZUJhY2tDb250ZXh0S2V5ID0gKG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdjYW5OYXZpZ2F0ZUJhY2snLCBmYWxzZSwgbG9jYWxpemUoJ2Nhbk5hdmlnYXRlQmFjaycsIFwiV2hldGhlciBpdCBpcyBwb3NzaWJsZSB0byBuYXZpZ2F0ZSBiYWNrIGluIGVkaXRvciBoaXN0b3J5XCIpKSkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuY2FuTmF2aWdhdGVGb3J3YXJkQ29udGV4dEtleSA9IChuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignY2FuTmF2aWdhdGVGb3J3YXJkJywgZmFsc2UsIGxvY2FsaXplKCdjYW5OYXZpZ2F0ZUZvcndhcmQnLCBcIldoZXRoZXIgaXQgaXMgcG9zc2libGUgdG8gbmF2aWdhdGUgZm9yd2FyZCBpbiBlZGl0b3IgaGlzdG9yeVwiKSkpLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuY2FuTmF2aWdhdGVCYWNrSW5OYXZpZ2F0aW9uc0NvbnRleHRLZXkgPSAobmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2Nhbk5hdmlnYXRlQmFja0luTmF2aWdhdGlvbkxvY2F0aW9ucycsIGZhbHNlLCBsb2NhbGl6ZSgnY2FuTmF2aWdhdGVCYWNrSW5OYXZpZ2F0aW9uTG9jYXRpb25zJywgXCJXaGV0aGVyIGl0IGlzIHBvc3NpYmxlIHRvIG5hdmlnYXRlIGJhY2sgaW4gZWRpdG9yIG5hdmlnYXRpb24gbG9jYXRpb25zIGhpc3RvcnlcIikpKS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5jYW5OYXZpZ2F0ZUZvcndhcmRJbk5hdmlnYXRpb25zQ29udGV4dEtleSA9IChuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignY2FuTmF2aWdhdGVGb3J3YXJkSW5OYXZpZ2F0aW9uTG9jYXRpb25zJywgZmFsc2UsIGxvY2FsaXplKCdjYW5OYXZpZ2F0ZUZvcndhcmRJbk5hdmlnYXRpb25Mb2NhdGlvbnMnLCBcIldoZXRoZXIgaXQgaXMgcG9zc2libGUgdG8gbmF2aWdhdGUgZm9yd2FyZCBpbiBlZGl0b3IgbmF2aWdhdGlvbiBsb2NhdGlvbnMgaGlzdG9yeVwiKSkpLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmNhbk5hdmlnYXRlVG9MYXN0TmF2aWdhdGlvbkxvY2F0aW9uQ29udGV4dEtleSA9IChuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignY2FuTmF2aWdhdGVUb0xhc3ROYXZpZ2F0aW9uTG9jYXRpb24nLCBmYWxzZSwgbG9jYWxpemUoJ2Nhbk5hdmlnYXRlVG9MYXN0TmF2aWdhdGlvbkxvY2F0aW9uJywgXCJXaGV0aGVyIGl0IGlzIHBvc3NpYmxlIHRvIG5hdmlnYXRlIHRvIHRoZSBsYXN0IGVkaXRvciBuYXZpZ2F0aW9uIGxvY2F0aW9uXCIpKSkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5jYW5OYXZpZ2F0ZUJhY2tJbkVkaXRzQ29udGV4dEtleSA9IChuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignY2FuTmF2aWdhdGVCYWNrSW5FZGl0TG9jYXRpb25zJywgZmFsc2UsIGxvY2FsaXplKCdjYW5OYXZpZ2F0ZUJhY2tJbkVkaXRMb2NhdGlvbnMnLCBcIldoZXRoZXIgaXQgaXMgcG9zc2libGUgdG8gbmF2aWdhdGUgYmFjayBpbiBlZGl0b3IgZWRpdCBsb2NhdGlvbnMgaGlzdG9yeVwiKSkpLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmNhbk5hdmlnYXRlRm9yd2FyZEluRWRpdHNDb250ZXh0S2V5ID0gKG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdjYW5OYXZpZ2F0ZUZvcndhcmRJbkVkaXRMb2NhdGlvbnMnLCBmYWxzZSwgbG9jYWxpemUoJ2Nhbk5hdmlnYXRlRm9yd2FyZEluRWRpdExvY2F0aW9ucycsIFwiV2hldGhlciBpdCBpcyBwb3NzaWJsZSB0byBuYXZpZ2F0ZSBmb3J3YXJkIGluIGVkaXRvciBlZGl0IGxvY2F0aW9ucyBoaXN0b3J5XCIpKSkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuY2FuTmF2aWdhdGVUb0xhc3RFZGl0TG9jYXRpb25Db250ZXh0S2V5ID0gKG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdjYW5OYXZpZ2F0ZVRvTGFzdEVkaXRMb2NhdGlvbicsIGZhbHNlLCBsb2NhbGl6ZSgnY2FuTmF2aWdhdGVUb0xhc3RFZGl0TG9jYXRpb24nLCBcIldoZXRoZXIgaXQgaXMgcG9zc2libGUgdG8gbmF2aWdhdGUgdG8gdGhlIGxhc3QgZWRpdG9yIGVkaXQgbG9jYXRpb25cIikpKS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLmNhblJlb3BlbkNsb3NlZEVkaXRvckNvbnRleHRLZXkgPSAobmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2NhblJlb3BlbkNsb3NlZEVkaXRvcicsIGZhbHNlLCBsb2NhbGl6ZSgnY2FuUmVvcGVuQ2xvc2VkRWRpdG9yJywgXCJXaGV0aGVyIGl0IGlzIHBvc3NpYmxlIHRvIHJlb3BlbiB0aGUgbGFzdCBjbG9zZWQgZWRpdG9yXCIpKSkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXG5cdFx0Ly8gaWYgdGhlIHNlcnZpY2UgaXMgY3JlYXRlZCBsYXRlIGVub3VnaCB0aGF0IGFuIGVkaXRvciBpcyBhbHJlYWR5IG9wZW5lZFxuXHRcdC8vIG1ha2Ugc3VyZSB0byB0cmlnZ2VyIHRoZSBvbkFjdGl2ZUVkaXRvckNoYW5nZWQoKSB0byB0cmFjayB0aGUgZWRpdG9yXG5cdFx0Ly8gcHJvcGVybHkgKGZpeGVzIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy81OTkwOClcblx0XHRpZiAodGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUpIHtcblx0XHRcdHRoaXMub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXG5cdFx0Ly8gTW91c2UgYmFjay9mb3J3YXJkIHN1cHBvcnRcblx0XHR0aGlzLnJlZ2lzdGVyTW91c2VOYXZpZ2F0aW9uTGlzdGVuZXIoKTtcblxuXHRcdC8vIEVkaXRvciBjaGFuZ2VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3JTZXJ2aWNlLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlKCgpID0+IHRoaXMub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yU2VydmljZS5vbkRpZE9wZW5FZGl0b3JGYWlsKGV2ZW50ID0+IHRoaXMucmVtb3ZlKGV2ZW50LmVkaXRvcikpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvclNlcnZpY2Uub25EaWRDbG9zZUVkaXRvcihldmVudCA9PiB0aGlzLm9uRGlkQ2xvc2VFZGl0b3IoZXZlbnQpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3JTZXJ2aWNlLm9uRGlkTW9zdFJlY2VudGx5QWN0aXZlRWRpdG9yc0NoYW5nZSgoKSA9PiB0aGlzLmhhbmRsZUVkaXRvckV2ZW50SW5SZWNlbnRFZGl0b3JzU3RhY2soKSkpO1xuXG5cdFx0Ly8gRWRpdG9yIGdyb3VwIGNoYW5nZXNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvckdyb3VwU2VydmljZS5vbkRpZFJlbW92ZUdyb3VwKGUgPT4gdGhpcy5vbkRpZFJlbW92ZUdyb3VwKGUpKSk7XG5cblx0XHQvLyBGaWxlIGNoYW5nZXNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkRmlsZXNDaGFuZ2UoZXZlbnQgPT4gdGhpcy5vbkRpZEZpbGVzQ2hhbmdlKGV2ZW50KSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZVNlcnZpY2Uub25EaWRSdW5PcGVyYXRpb24oZXZlbnQgPT4gdGhpcy5vbkRpZEZpbGVzQ2hhbmdlKGV2ZW50KSkpO1xuXG5cdFx0Ly8gU3RvcmFnZVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc3RvcmFnZVNlcnZpY2Uub25XaWxsU2F2ZVN0YXRlKCgpID0+IHRoaXMuc2F2ZVN0YXRlKCkpKTtcblxuXHRcdC8vIENvbmZpZ3VyYXRpb25cblx0XHR0aGlzLnJlZ2lzdGVyRWRpdG9yTmF2aWdhdGlvblNjb3BlQ2hhbmdlTGlzdGVuZXIoKTtcblxuXHRcdC8vIENvbnRleHQga2V5c1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRDaGFuZ2VFZGl0b3JOYXZpZ2F0aW9uU3RhY2soKCkgPT4gdGhpcy51cGRhdGVDb250ZXh0S2V5cygpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3JHcm91cFNlcnZpY2Uub25EaWRDaGFuZ2VBY3RpdmVHcm91cCgoKSA9PiB0aGlzLnVwZGF0ZUNvbnRleHRLZXlzKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDbG9zZUVkaXRvcihlOiBJRWRpdG9yQ2xvc2VFdmVudCk6IHZvaWQge1xuXHRcdHRoaXMuaGFuZGxlRWRpdG9yQ2xvc2VFdmVudEluSGlzdG9yeShlKTtcblx0XHR0aGlzLmhhbmRsZUVkaXRvckNsb3NlRXZlbnRJblJlb3BlbihlKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJNb3VzZU5hdmlnYXRpb25MaXN0ZW5lcigpOiB2b2lkIHtcblx0XHRjb25zdCBtb3VzZUJhY2tGb3J3YXJkU3VwcG9ydExpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHRjb25zdCBoYW5kbGVNb3VzZUJhY2tGb3J3YXJkU3VwcG9ydCA9ICgpID0+IHtcblx0XHRcdG1vdXNlQmFja0ZvcndhcmRTdXBwb3J0TGlzdGVuZXIuY2xlYXIoKTtcblxuXHRcdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoSGlzdG9yeVNlcnZpY2UuTU9VU0VfTkFWSUdBVElPTl9TRVRUSU5HKSkge1xuXHRcdFx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUodGhpcy5sYXlvdXRTZXJ2aWNlLm9uRGlkQWRkQ29udGFpbmVyLCAoeyBjb250YWluZXIsIGRpc3Bvc2FibGVzIH0pID0+IHtcblx0XHRcdFx0XHRjb25zdCBldmVudERpc3Bvc2FibGVzID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdFx0XHRcdFx0ZXZlbnREaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGNvbnRhaW5lciwgRXZlbnRUeXBlLk1PVVNFX0RPV04sIGUgPT4gdGhpcy5vbk1vdXNlRG93bk9yVXAoZSwgdHJ1ZSkpKTtcblx0XHRcdFx0XHRldmVudERpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIoY29udGFpbmVyLCBFdmVudFR5cGUuTU9VU0VfVVAsIGUgPT4gdGhpcy5vbk1vdXNlRG93bk9yVXAoZSwgZmFsc2UpKSk7XG5cblx0XHRcdFx0XHRtb3VzZUJhY2tGb3J3YXJkU3VwcG9ydExpc3RlbmVyLmFkZChldmVudERpc3Bvc2FibGVzKTtcblx0XHRcdFx0fSwgeyBjb250YWluZXI6IHRoaXMubGF5b3V0U2VydmljZS5tYWluQ29udGFpbmVyLCBkaXNwb3NhYmxlczogdGhpcy5fc3RvcmUgfSkpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihldmVudCA9PiB7XG5cdFx0XHRpZiAoZXZlbnQuYWZmZWN0c0NvbmZpZ3VyYXRpb24oSGlzdG9yeVNlcnZpY2UuTU9VU0VfTkFWSUdBVElPTl9TRVRUSU5HKSkge1xuXHRcdFx0XHRoYW5kbGVNb3VzZUJhY2tGb3J3YXJkU3VwcG9ydCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGhhbmRsZU1vdXNlQmFja0ZvcndhcmRTdXBwb3J0KCk7XG5cdH1cblxuXHRwcml2YXRlIG9uTW91c2VEb3duT3JVcChldmVudDogTW91c2VFdmVudCwgaXNNb3VzZURvd246IGJvb2xlYW4pOiB2b2lkIHtcblxuXHRcdC8vIFN1cHBvcnQgdG8gbmF2aWdhdGUgaW4gaGlzdG9yeSB3aGVuIG1vdXNlIGJ1dHRvbnMgNC81IGFyZSBwcmVzc2VkXG5cdFx0Ly8gV2Ugd2FudCB0byB0cmlnZ2VyIHRoaXMgb24gbW91c2UgZG93biBmb3IgYSBmYXN0ZXIgZXhwZXJpZW5jZVxuXHRcdC8vIGJ1dCB3ZSBhbHNvIG5lZWQgdG8gcHJldmVudCBtb3VzZSB1cCBmcm9tIHRyaWdnZXJpbmcgdGhlIGRlZmF1bHRcblx0XHQvLyB3aGljaCBpcyB0byBuYXZpZ2F0ZSBpbiB0aGUgYnJvd3NlciBoaXN0b3J5LlxuXG5cdFx0c3dpdGNoIChldmVudC5idXR0b24pIHtcblx0XHRcdGNhc2UgMzpcblx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChldmVudCk7XG5cdFx0XHRcdGlmIChpc01vdXNlRG93bikge1xuXHRcdFx0XHRcdHRoaXMuZ29CYWNrKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIDQ6XG5cdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZXZlbnQpO1xuXHRcdFx0XHRpZiAoaXNNb3VzZURvd24pIHtcblx0XHRcdFx0XHR0aGlzLmdvRm9yd2FyZCgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZFJlbW92ZUdyb3VwKGdyb3VwOiBJRWRpdG9yR3JvdXApOiB2b2lkIHtcblx0XHR0aGlzLmhhbmRsZUVkaXRvckdyb3VwUmVtb3ZlSW5OYXZpZ2F0aW9uU3RhY2tzKGdyb3VwKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UoKTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yR3JvdXAgPSB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cDtcblx0XHRjb25zdCBhY3RpdmVFZGl0b3JQYW5lID0gYWN0aXZlRWRpdG9yR3JvdXAuYWN0aXZlRWRpdG9yUGFuZTtcblxuXHRcdGlmICh0aGlzLmxhc3RBY3RpdmVFZGl0b3IgJiYgdGhpcy5lZGl0b3JIZWxwZXIubWF0Y2hlc0VkaXRvcklkZW50aWZpZXIodGhpcy5sYXN0QWN0aXZlRWRpdG9yLCBhY3RpdmVFZGl0b3JQYW5lKSkge1xuXHRcdFx0cmV0dXJuOyAvLyByZXR1cm4gaWYgdGhlIGFjdGl2ZSBlZGl0b3IgaXMgc3RpbGwgdGhlIHNhbWVcblx0XHR9XG5cblx0XHQvLyBSZW1lbWJlciBhcyBsYXN0IGFjdGl2ZSBlZGl0b3IgKGNhbiBiZSB1bmRlZmluZWQgaWYgbm9uZSBvcGVuZWQpXG5cdFx0dGhpcy5sYXN0QWN0aXZlRWRpdG9yID0gYWN0aXZlRWRpdG9yUGFuZT8uaW5wdXQgPyB7IGVkaXRvcjogYWN0aXZlRWRpdG9yUGFuZS5pbnB1dCwgZ3JvdXBJZDogYWN0aXZlRWRpdG9yUGFuZS5ncm91cC5pZCB9IDogdW5kZWZpbmVkO1xuXG5cdFx0Ly8gRGlzcG9zZSBvbGQgbGlzdGVuZXJzXG5cdFx0dGhpcy5hY3RpdmVFZGl0b3JMaXN0ZW5lcnMuY2xlYXIoKTtcblxuXHRcdC8vIEhhbmRsZSBlZGl0b3IgY2hhbmdlIHVubGVzcyB0aGUgZWRpdG9yIGlzIHRyYW5zaWVudC4gSW4gdGhhdCBjYXNlXG5cdFx0Ly8gc2V0dXAgYSBsaXN0ZW5lciB0byBzZWUgaWYgdGhlIHRyYW5zaWVudCBlZGl0b3IgYmVjb21lcyBub24tdHJhbnNpZW50XG5cdFx0Ly8gKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yMTE3NjkpXG5cdFx0aWYgKCFhY3RpdmVFZGl0b3JQYW5lPy5ncm91cC5pc1RyYW5zaWVudChhY3RpdmVFZGl0b3JQYW5lLmlucHV0KSkge1xuXHRcdFx0dGhpcy5oYW5kbGVBY3RpdmVFZGl0b3JDaGFuZ2UoYWN0aXZlRWRpdG9yR3JvdXAsIGFjdGl2ZUVkaXRvclBhbmUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYFtIaXN0b3J5XTogaWdub3JpbmcgdHJhbnNpZW50IGVkaXRvciBjaGFuZ2UgdW50aWwgYmVjb21pbmcgbm9uLXRyYW5zaWVudCAoZWRpdG9yOiAke2FjdGl2ZUVkaXRvclBhbmUuaW5wdXQ/LnJlc291cmNlPy50b1N0cmluZygpfX0pYCk7XG5cblx0XHRcdGNvbnN0IHRyYW5zaWVudExpc3RlbmVyID0gYWN0aXZlRWRpdG9yR3JvdXAub25EaWRNb2RlbENoYW5nZShlID0+IHtcblx0XHRcdFx0aWYgKGUua2luZCA9PT0gR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX1RSQU5TSUVOVCAmJiBlLmVkaXRvciA9PT0gYWN0aXZlRWRpdG9yUGFuZS5pbnB1dCAmJiAhYWN0aXZlRWRpdG9yUGFuZS5ncm91cC5pc1RyYW5zaWVudChhY3RpdmVFZGl0b3JQYW5lLmlucHV0KSkge1xuXHRcdFx0XHRcdHRyYW5zaWVudExpc3RlbmVyLmRpc3Bvc2UoKTtcblxuXHRcdFx0XHRcdHRoaXMuaGFuZGxlQWN0aXZlRWRpdG9yQ2hhbmdlKGFjdGl2ZUVkaXRvckdyb3VwLCBhY3RpdmVFZGl0b3JQYW5lKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuYWN0aXZlRWRpdG9yTGlzdGVuZXJzLmFkZCh0cmFuc2llbnRMaXN0ZW5lcik7XG5cdFx0fVxuXG5cdFx0Ly8gTGlzdGVuIHRvIHNlbGVjdGlvbiBjaGFuZ2VzIHVubGVzcyB0aGUgZWRpdG9yIGlzIHRyYW5zaWVudFxuXHRcdGlmIChpc0VkaXRvclBhbmVXaXRoU2VsZWN0aW9uKGFjdGl2ZUVkaXRvclBhbmUpKSB7XG5cdFx0XHR0aGlzLmFjdGl2ZUVkaXRvckxpc3RlbmVycy5hZGQoYWN0aXZlRWRpdG9yUGFuZS5vbkRpZENoYW5nZVNlbGVjdGlvbihlID0+IHtcblx0XHRcdFx0aWYgKCFhY3RpdmVFZGl0b3JQYW5lLmdyb3VwLmlzVHJhbnNpZW50KGFjdGl2ZUVkaXRvclBhbmUuaW5wdXQpKSB7XG5cdFx0XHRcdFx0dGhpcy5oYW5kbGVBY3RpdmVFZGl0b3JTZWxlY3Rpb25DaGFuZ2VFdmVudChhY3RpdmVFZGl0b3JHcm91cCwgYWN0aXZlRWRpdG9yUGFuZSwgZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBbSGlzdG9yeV06IGlnbm9yaW5nIHRyYW5zaWVudCBlZGl0b3Igc2VsZWN0aW9uIGNoYW5nZSAoZWRpdG9yOiAke2FjdGl2ZUVkaXRvclBhbmUuaW5wdXQ/LnJlc291cmNlPy50b1N0cmluZygpfX0pYCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHQvLyBDb250ZXh0IGtleXNcblx0XHR0aGlzLnVwZGF0ZUNvbnRleHRLZXlzKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkRmlsZXNDaGFuZ2UoZXZlbnQ6IEZpbGVDaGFuZ2VzRXZlbnQgfCBGaWxlT3BlcmF0aW9uRXZlbnQpOiB2b2lkIHtcblxuXHRcdC8vIEV4dGVybmFsIGZpbGUgY2hhbmdlcyAod2F0Y2hlcilcblx0XHRpZiAoZXZlbnQgaW5zdGFuY2VvZiBGaWxlQ2hhbmdlc0V2ZW50KSB7XG5cdFx0XHRpZiAoZXZlbnQuZ290RGVsZXRlZCgpKSB7XG5cdFx0XHRcdHRoaXMucmVtb3ZlKGV2ZW50KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBJbnRlcm5hbCBmaWxlIGNoYW5nZXMgKGUuZy4gZXhwbG9yZXIpXG5cdFx0ZWxzZSB7XG5cblx0XHRcdC8vIERlbGV0ZVxuXHRcdFx0aWYgKGV2ZW50LmlzT3BlcmF0aW9uKEZpbGVPcGVyYXRpb24uREVMRVRFKSkge1xuXHRcdFx0XHR0aGlzLnJlbW92ZShldmVudCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIE1vdmVcblx0XHRcdGVsc2UgaWYgKGV2ZW50LmlzT3BlcmF0aW9uKEZpbGVPcGVyYXRpb24uTU9WRSkgJiYgZXZlbnQudGFyZ2V0LmlzRmlsZSkge1xuXHRcdFx0XHR0aGlzLm1vdmUoZXZlbnQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlQWN0aXZlRWRpdG9yQ2hhbmdlKGdyb3VwOiBJRWRpdG9yR3JvdXAsIGVkaXRvclBhbmU/OiBJRWRpdG9yUGFuZSk6IHZvaWQge1xuXHRcdHRoaXMuaGFuZGxlQWN0aXZlRWRpdG9yQ2hhbmdlSW5IaXN0b3J5KGVkaXRvclBhbmUpO1xuXHRcdHRoaXMuaGFuZGxlQWN0aXZlRWRpdG9yQ2hhbmdlSW5OYXZpZ2F0aW9uU3RhY2tzKGdyb3VwLCBlZGl0b3JQYW5lKTtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlQWN0aXZlRWRpdG9yU2VsZWN0aW9uQ2hhbmdlRXZlbnQoZ3JvdXA6IElFZGl0b3JHcm91cCwgZWRpdG9yUGFuZTogSUVkaXRvclBhbmVXaXRoU2VsZWN0aW9uLCBldmVudDogSUVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VFdmVudCk6IHZvaWQge1xuXHRcdHRoaXMuaGFuZGxlQWN0aXZlRWRpdG9yU2VsZWN0aW9uQ2hhbmdlSW5OYXZpZ2F0aW9uU3RhY2tzKGdyb3VwLCBlZGl0b3JQYW5lLCBldmVudCk7XG5cdH1cblxuXHRwcml2YXRlIG1vdmUoZXZlbnQ6IEZpbGVPcGVyYXRpb25FdmVudCk6IHZvaWQge1xuXHRcdHRoaXMubW92ZUluSGlzdG9yeShldmVudCk7XG5cdFx0dGhpcy5tb3ZlSW5FZGl0b3JOYXZpZ2F0aW9uU3RhY2tzKGV2ZW50KTtcblx0fVxuXG5cdHByaXZhdGUgcmVtb3ZlKGVkaXRvcjogRWRpdG9ySW5wdXQpOiB2b2lkO1xuXHRwcml2YXRlIHJlbW92ZShldmVudDogRmlsZUNoYW5nZXNFdmVudCk6IHZvaWQ7XG5cdHByaXZhdGUgcmVtb3ZlKGV2ZW50OiBGaWxlT3BlcmF0aW9uRXZlbnQpOiB2b2lkO1xuXHRwcml2YXRlIHJlbW92ZShhcmcxOiBFZGl0b3JJbnB1dCB8IEZpbGVDaGFuZ2VzRXZlbnQgfCBGaWxlT3BlcmF0aW9uRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLnJlbW92ZUZyb21IaXN0b3J5KGFyZzEpO1xuXHRcdHRoaXMucmVtb3ZlRnJvbUVkaXRvck5hdmlnYXRpb25TdGFja3MoYXJnMSk7XG5cdFx0dGhpcy5yZW1vdmVGcm9tUmVjZW50bHlDbG9zZWRFZGl0b3JzKGFyZzEpO1xuXHRcdHRoaXMucmVtb3ZlRnJvbVJlY2VudGx5T3BlbmVkKGFyZzEpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW1vdmVGcm9tUmVjZW50bHlPcGVuZWQoYXJnMTogRWRpdG9ySW5wdXQgfCBGaWxlQ2hhbmdlc0V2ZW50IHwgRmlsZU9wZXJhdGlvbkV2ZW50KTogdm9pZCB7XG5cdFx0bGV0IHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGlzRWRpdG9ySW5wdXQoYXJnMSkpIHtcblx0XHRcdHJlc291cmNlID0gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRPcmlnaW5hbFVyaShhcmcxKTtcblx0XHR9IGVsc2UgaWYgKGFyZzEgaW5zdGFuY2VvZiBGaWxlQ2hhbmdlc0V2ZW50KSB7XG5cdFx0XHQvLyBJZ25vcmUgZm9yIG5vdyAocmVjZW50bHkgb3BlbmVkIGFyZSBtb3N0IG9mdGVuIG91dCBvZiB3b3Jrc3BhY2UgZmlsZXMgYW55d2F5IGZvciB3aGljaCB0aGVyZSBhcmUgbm8gZmlsZSBldmVudHMpXG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc291cmNlID0gYXJnMS5yZXNvdXJjZTtcblx0XHR9XG5cblx0XHRpZiAocmVzb3VyY2UpIHtcblx0XHRcdHRoaXMud29ya3NwYWNlc1NlcnZpY2UucmVtb3ZlUmVjZW50bHlPcGVuZWQoW3Jlc291cmNlXSk7XG5cdFx0fVxuXHR9XG5cblx0Y2xlYXIoKTogdm9pZCB7XG5cblx0XHQvLyBIaXN0b3J5XG5cdFx0dGhpcy5jbGVhclJlY2VudGx5T3BlbmVkKCk7XG5cblx0XHQvLyBOYXZpZ2F0aW9uIChuZXh0LCBwcmV2aW91cylcblx0XHR0aGlzLmNsZWFyRWRpdG9yTmF2aWdhdGlvblN0YWNrcygpO1xuXG5cdFx0Ly8gUmVjZW50bHkgY2xvc2VkIGVkaXRvcnNcblx0XHR0aGlzLnJlY2VudGx5Q2xvc2VkRWRpdG9ycyA9IFtdO1xuXG5cdFx0Ly8gQ29udGV4dCBLZXlzXG5cdFx0dGhpcy51cGRhdGVDb250ZXh0S2V5cygpO1xuXHR9XG5cblx0Ly8jcmVnaW9uIEhpc3RvcnkgQ29udGV4dCBLZXlzXG5cblx0cHJpdmF0ZSByZWFkb25seSBjYW5OYXZpZ2F0ZUJhY2tDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBjYW5OYXZpZ2F0ZUZvcndhcmRDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNhbk5hdmlnYXRlQmFja0luTmF2aWdhdGlvbnNDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBjYW5OYXZpZ2F0ZUZvcndhcmRJbk5hdmlnYXRpb25zQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgY2FuTmF2aWdhdGVUb0xhc3ROYXZpZ2F0aW9uTG9jYXRpb25Db250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNhbk5hdmlnYXRlQmFja0luRWRpdHNDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBjYW5OYXZpZ2F0ZUZvcndhcmRJbkVkaXRzQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgY2FuTmF2aWdhdGVUb0xhc3RFZGl0TG9jYXRpb25Db250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNhblJlb3BlbkNsb3NlZEVkaXRvckNvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHVwZGF0ZUNvbnRleHRLZXlzKCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGV4dEtleVNlcnZpY2UuYnVmZmVyQ2hhbmdlRXZlbnRzKCgpID0+IHtcblx0XHRcdGNvbnN0IGFjdGl2ZVN0YWNrID0gdGhpcy5nZXRTdGFjaygpO1xuXG5cdFx0XHR0aGlzLmNhbk5hdmlnYXRlQmFja0NvbnRleHRLZXkuc2V0KGFjdGl2ZVN0YWNrLmNhbkdvQmFjayhHb0ZpbHRlci5OT05FKSk7XG5cdFx0XHR0aGlzLmNhbk5hdmlnYXRlRm9yd2FyZENvbnRleHRLZXkuc2V0KGFjdGl2ZVN0YWNrLmNhbkdvRm9yd2FyZChHb0ZpbHRlci5OT05FKSk7XG5cblx0XHRcdHRoaXMuY2FuTmF2aWdhdGVCYWNrSW5OYXZpZ2F0aW9uc0NvbnRleHRLZXkuc2V0KGFjdGl2ZVN0YWNrLmNhbkdvQmFjayhHb0ZpbHRlci5OQVZJR0FUSU9OKSk7XG5cdFx0XHR0aGlzLmNhbk5hdmlnYXRlRm9yd2FyZEluTmF2aWdhdGlvbnNDb250ZXh0S2V5LnNldChhY3RpdmVTdGFjay5jYW5Hb0ZvcndhcmQoR29GaWx0ZXIuTkFWSUdBVElPTikpO1xuXHRcdFx0dGhpcy5jYW5OYXZpZ2F0ZVRvTGFzdE5hdmlnYXRpb25Mb2NhdGlvbkNvbnRleHRLZXkuc2V0KGFjdGl2ZVN0YWNrLmNhbkdvTGFzdChHb0ZpbHRlci5OQVZJR0FUSU9OKSk7XG5cblx0XHRcdHRoaXMuY2FuTmF2aWdhdGVCYWNrSW5FZGl0c0NvbnRleHRLZXkuc2V0KGFjdGl2ZVN0YWNrLmNhbkdvQmFjayhHb0ZpbHRlci5FRElUUykpO1xuXHRcdFx0dGhpcy5jYW5OYXZpZ2F0ZUZvcndhcmRJbkVkaXRzQ29udGV4dEtleS5zZXQoYWN0aXZlU3RhY2suY2FuR29Gb3J3YXJkKEdvRmlsdGVyLkVESVRTKSk7XG5cdFx0XHR0aGlzLmNhbk5hdmlnYXRlVG9MYXN0RWRpdExvY2F0aW9uQ29udGV4dEtleS5zZXQoYWN0aXZlU3RhY2suY2FuR29MYXN0KEdvRmlsdGVyLkVESVRTKSk7XG5cblx0XHRcdHRoaXMuY2FuUmVvcGVuQ2xvc2VkRWRpdG9yQ29udGV4dEtleS5zZXQodGhpcy5yZWNlbnRseUNsb3NlZEVkaXRvcnMubGVuZ3RoID4gMCk7XG5cdFx0fSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gRWRpdG9yIEhpc3RvcnkgTmF2aWdhdGlvbiAobGltaXQ6IDUwKVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlRWRpdG9yTmF2aWdhdGlvblN0YWNrID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRWRpdG9yTmF2aWdhdGlvblN0YWNrID0gdGhpcy5fb25EaWRDaGFuZ2VFZGl0b3JOYXZpZ2F0aW9uU3RhY2suZXZlbnQ7XG5cblx0cHJpdmF0ZSBkZWZhdWx0U2NvcGVkRWRpdG9yTmF2aWdhdGlvblN0YWNrOiBJRWRpdG9yTmF2aWdhdGlvblN0YWNrcyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JHcm91cFNjb3BlZE5hdmlnYXRpb25TdGFja3MgPSBuZXcgTWFwPEdyb3VwSWRlbnRpZmllciwgeyBzdGFjazogSUVkaXRvck5hdmlnYXRpb25TdGFja3M7IGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlIH0+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2NvcGVkTmF2aWdhdGlvblN0YWNrcyA9IG5ldyBNYXA8R3JvdXBJZGVudGlmaWVyLCBNYXA8RWRpdG9ySW5wdXQsIHsgc3RhY2s6IElFZGl0b3JOYXZpZ2F0aW9uU3RhY2tzOyBkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSB9Pj4oKTtcblxuXHRwcml2YXRlIGVkaXRvck5hdmlnYXRpb25TY29wZSA9IEdvU2NvcGUuREVGQVVMVDtcblxuXHRwcml2YXRlIHJlZ2lzdGVyRWRpdG9yTmF2aWdhdGlvblNjb3BlQ2hhbmdlTGlzdGVuZXIoKTogdm9pZCB7XG5cdFx0Y29uc3QgaGFuZGxlRWRpdG9yTmF2aWdhdGlvblNjb3BlQ2hhbmdlID0gKCkgPT4ge1xuXG5cdFx0XHQvLyBFbnN1cmUgdG8gc3RhcnQgZnJlc2ggd2hlbiBzZXR0aW5nIGNoYW5nZXNcblx0XHRcdHRoaXMuZGlzcG9zZUVkaXRvck5hdmlnYXRpb25TdGFja3MoKTtcblxuXHRcdFx0Ly8gVXBkYXRlIHNjb3BlXG5cdFx0XHRjb25zdCBjb25maWd1cmVkU2NvcGUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKEhpc3RvcnlTZXJ2aWNlLk5BVklHQVRJT05fU0NPUEVfU0VUVElORyk7XG5cdFx0XHRpZiAoY29uZmlndXJlZFNjb3BlID09PSAnZWRpdG9yR3JvdXAnKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yTmF2aWdhdGlvblNjb3BlID0gR29TY29wZS5FRElUT1JfR1JPVVA7XG5cdFx0XHR9IGVsc2UgaWYgKGNvbmZpZ3VyZWRTY29wZSA9PT0gJ2VkaXRvcicpIHtcblx0XHRcdFx0dGhpcy5lZGl0b3JOYXZpZ2F0aW9uU2NvcGUgPSBHb1Njb3BlLkVESVRPUjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yTmF2aWdhdGlvblNjb3BlID0gR29TY29wZS5ERUZBVUxUO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihldmVudCA9PiB7XG5cdFx0XHRpZiAoZXZlbnQuYWZmZWN0c0NvbmZpZ3VyYXRpb24oSGlzdG9yeVNlcnZpY2UuTkFWSUdBVElPTl9TQ09QRV9TRVRUSU5HKSkge1xuXHRcdFx0XHRoYW5kbGVFZGl0b3JOYXZpZ2F0aW9uU2NvcGVDaGFuZ2UoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRoYW5kbGVFZGl0b3JOYXZpZ2F0aW9uU2NvcGVDaGFuZ2UoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0U3RhY2soZ3JvdXAgPSB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cCwgZWRpdG9yID0gZ3JvdXAuYWN0aXZlRWRpdG9yKTogSUVkaXRvck5hdmlnYXRpb25TdGFja3Mge1xuXHRcdHN3aXRjaCAodGhpcy5lZGl0b3JOYXZpZ2F0aW9uU2NvcGUpIHtcblxuXHRcdFx0Ly8gUGVyIEVkaXRvclxuXHRcdFx0Y2FzZSBHb1Njb3BlLkVESVRPUjoge1xuXHRcdFx0XHRpZiAoIWVkaXRvcikge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgTm9PcEVkaXRvck5hdmlnYXRpb25TdGFja3MoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxldCBzdGFja3NGb3JHcm91cCA9IHRoaXMuZWRpdG9yU2NvcGVkTmF2aWdhdGlvblN0YWNrcy5nZXQoZ3JvdXAuaWQpO1xuXHRcdFx0XHRpZiAoIXN0YWNrc0Zvckdyb3VwKSB7XG5cdFx0XHRcdFx0c3RhY2tzRm9yR3JvdXAgPSBuZXcgTWFwPEVkaXRvcklucHV0LCB7IHN0YWNrOiBJRWRpdG9yTmF2aWdhdGlvblN0YWNrczsgZGlzcG9zYWJsZTogSURpc3Bvc2FibGUgfT4oKTtcblx0XHRcdFx0XHR0aGlzLmVkaXRvclNjb3BlZE5hdmlnYXRpb25TdGFja3Muc2V0KGdyb3VwLmlkLCBzdGFja3NGb3JHcm91cCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgc3RhY2sgPSBzdGFja3NGb3JHcm91cC5nZXQoZWRpdG9yKT8uc3RhY2s7XG5cdFx0XHRcdGlmICghc3RhY2spIHtcblx0XHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0XHRcdFx0c3RhY2sgPSBkaXNwb3NhYmxlLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRvck5hdmlnYXRpb25TdGFja3MsIEdvU2NvcGUuRURJVE9SKSk7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZS5hZGQoc3RhY2sub25EaWRDaGFuZ2UoKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VFZGl0b3JOYXZpZ2F0aW9uU3RhY2suZmlyZSgpKSk7XG5cblx0XHRcdFx0XHRzdGFja3NGb3JHcm91cC5zZXQoZWRpdG9yLCB7IHN0YWNrLCBkaXNwb3NhYmxlIH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHN0YWNrO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBQZXIgRWRpdG9yIEdyb3VwXG5cdFx0XHRjYXNlIEdvU2NvcGUuRURJVE9SX0dST1VQOiB7XG5cdFx0XHRcdGxldCBzdGFjayA9IHRoaXMuZWRpdG9yR3JvdXBTY29wZWROYXZpZ2F0aW9uU3RhY2tzLmdldChncm91cC5pZCk/LnN0YWNrO1xuXHRcdFx0XHRpZiAoIXN0YWNrKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdFx0XHRcdHN0YWNrID0gZGlzcG9zYWJsZS5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFZGl0b3JOYXZpZ2F0aW9uU3RhY2tzLCBHb1Njb3BlLkVESVRPUl9HUk9VUCkpO1xuXHRcdFx0XHRcdGRpc3Bvc2FibGUuYWRkKHN0YWNrLm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlRWRpdG9yTmF2aWdhdGlvblN0YWNrLmZpcmUoKSkpO1xuXG5cdFx0XHRcdFx0dGhpcy5lZGl0b3JHcm91cFNjb3BlZE5hdmlnYXRpb25TdGFja3Muc2V0KGdyb3VwLmlkLCB7IHN0YWNrLCBkaXNwb3NhYmxlIH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHN0YWNrO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBHbG9iYWxcblx0XHRcdGNhc2UgR29TY29wZS5ERUZBVUxUOiB7XG5cdFx0XHRcdGlmICghdGhpcy5kZWZhdWx0U2NvcGVkRWRpdG9yTmF2aWdhdGlvblN0YWNrKSB7XG5cdFx0XHRcdFx0dGhpcy5kZWZhdWx0U2NvcGVkRWRpdG9yTmF2aWdhdGlvblN0YWNrID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFZGl0b3JOYXZpZ2F0aW9uU3RhY2tzLCBHb1Njb3BlLkRFRkFVTFQpKTtcblxuXHRcdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZGVmYXVsdFNjb3BlZEVkaXRvck5hdmlnYXRpb25TdGFjay5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUVkaXRvck5hdmlnYXRpb25TdGFjay5maXJlKCkpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB0aGlzLmRlZmF1bHRTY29wZWRFZGl0b3JOYXZpZ2F0aW9uU3RhY2s7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Z29Gb3J3YXJkKGZpbHRlcj86IEdvRmlsdGVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0U3RhY2soKS5nb0ZvcndhcmQoZmlsdGVyKTtcblx0fVxuXG5cdGdvQmFjayhmaWx0ZXI/OiBHb0ZpbHRlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmdldFN0YWNrKCkuZ29CYWNrKGZpbHRlcik7XG5cdH1cblxuXHRnb1ByZXZpb3VzKGZpbHRlcj86IEdvRmlsdGVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0U3RhY2soKS5nb1ByZXZpb3VzKGZpbHRlcik7XG5cdH1cblxuXHRnb0xhc3QoZmlsdGVyPzogR29GaWx0ZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5nZXRTdGFjaygpLmdvTGFzdChmaWx0ZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVBY3RpdmVFZGl0b3JDaGFuZ2VJbk5hdmlnYXRpb25TdGFja3MoZ3JvdXA6IElFZGl0b3JHcm91cCwgZWRpdG9yUGFuZT86IElFZGl0b3JQYW5lKTogdm9pZCB7XG5cdFx0dGhpcy5nZXRTdGFjayhncm91cCwgZWRpdG9yUGFuZT8uaW5wdXQpLmhhbmRsZUFjdGl2ZUVkaXRvckNoYW5nZShlZGl0b3JQYW5lKTtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlQWN0aXZlRWRpdG9yU2VsZWN0aW9uQ2hhbmdlSW5OYXZpZ2F0aW9uU3RhY2tzKGdyb3VwOiBJRWRpdG9yR3JvdXAsIGVkaXRvclBhbmU6IElFZGl0b3JQYW5lV2l0aFNlbGVjdGlvbiwgZXZlbnQ6IElFZGl0b3JQYW5lU2VsZWN0aW9uQ2hhbmdlRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLmdldFN0YWNrKGdyb3VwLCBlZGl0b3JQYW5lLmlucHV0KS5oYW5kbGVBY3RpdmVFZGl0b3JTZWxlY3Rpb25DaGFuZ2UoZWRpdG9yUGFuZSwgZXZlbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVFZGl0b3JDbG9zZUV2ZW50SW5IaXN0b3J5KGU6IElFZGl0b3JDbG9zZUV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgZWRpdG9ycyA9IHRoaXMuZWRpdG9yU2NvcGVkTmF2aWdhdGlvblN0YWNrcy5nZXQoZS5ncm91cElkKTtcblx0XHRpZiAoZWRpdG9ycykge1xuXHRcdFx0Y29uc3QgZWRpdG9yU3RhY2sgPSBlZGl0b3JzLmdldChlLmVkaXRvcik7XG5cdFx0XHRpZiAoZWRpdG9yU3RhY2spIHtcblx0XHRcdFx0ZWRpdG9yU3RhY2suZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdGVkaXRvcnMuZGVsZXRlKGUuZWRpdG9yKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGVkaXRvcnMuc2l6ZSA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLmVkaXRvclNjb3BlZE5hdmlnYXRpb25TdGFja3MuZGVsZXRlKGUuZ3JvdXBJZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVFZGl0b3JHcm91cFJlbW92ZUluTmF2aWdhdGlvblN0YWNrcyhncm91cDogSUVkaXRvckdyb3VwKTogdm9pZCB7XG5cblx0XHQvLyBHbG9iYWxcblx0XHR0aGlzLmRlZmF1bHRTY29wZWRFZGl0b3JOYXZpZ2F0aW9uU3RhY2s/LnJlbW92ZShncm91cC5pZCk7XG5cblx0XHQvLyBFZGl0b3IgZ3JvdXBzXG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTdGFjayA9IHRoaXMuZWRpdG9yR3JvdXBTY29wZWROYXZpZ2F0aW9uU3RhY2tzLmdldChncm91cC5pZCk7XG5cdFx0aWYgKGVkaXRvckdyb3VwU3RhY2spIHtcblx0XHRcdGVkaXRvckdyb3VwU3RhY2suZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLmVkaXRvckdyb3VwU2NvcGVkTmF2aWdhdGlvblN0YWNrcy5kZWxldGUoZ3JvdXAuaWQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY2xlYXJFZGl0b3JOYXZpZ2F0aW9uU3RhY2tzKCk6IHZvaWQge1xuXHRcdHRoaXMud2l0aEVhY2hFZGl0b3JOYXZpZ2F0aW9uU3RhY2soc3RhY2sgPT4gc3RhY2suY2xlYXIoKSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZUZyb21FZGl0b3JOYXZpZ2F0aW9uU3RhY2tzKGFyZzE6IEVkaXRvcklucHV0IHwgRmlsZUNoYW5nZXNFdmVudCB8IEZpbGVPcGVyYXRpb25FdmVudCk6IHZvaWQge1xuXHRcdHRoaXMud2l0aEVhY2hFZGl0b3JOYXZpZ2F0aW9uU3RhY2soc3RhY2sgPT4gc3RhY2sucmVtb3ZlKGFyZzEpKTtcblx0fVxuXG5cdHByaXZhdGUgbW92ZUluRWRpdG9yTmF2aWdhdGlvblN0YWNrcyhldmVudDogRmlsZU9wZXJhdGlvbkV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy53aXRoRWFjaEVkaXRvck5hdmlnYXRpb25TdGFjayhzdGFjayA9PiBzdGFjay5tb3ZlKGV2ZW50KSk7XG5cdH1cblxuXHRwcml2YXRlIHdpdGhFYWNoRWRpdG9yTmF2aWdhdGlvblN0YWNrKGZuOiAoc3RhY2s6IElFZGl0b3JOYXZpZ2F0aW9uU3RhY2tzKSA9PiB2b2lkKTogdm9pZCB7XG5cblx0XHQvLyBHbG9iYWxcblx0XHRpZiAodGhpcy5kZWZhdWx0U2NvcGVkRWRpdG9yTmF2aWdhdGlvblN0YWNrKSB7XG5cdFx0XHRmbih0aGlzLmRlZmF1bHRTY29wZWRFZGl0b3JOYXZpZ2F0aW9uU3RhY2spO1xuXHRcdH1cblxuXHRcdC8vIFBlciBlZGl0b3IgZ3JvdXBcblx0XHRmb3IgKGNvbnN0IFssIGVudHJ5XSBvZiB0aGlzLmVkaXRvckdyb3VwU2NvcGVkTmF2aWdhdGlvblN0YWNrcykge1xuXHRcdFx0Zm4oZW50cnkuc3RhY2spO1xuXHRcdH1cblxuXHRcdC8vIFBlciBlZGl0b3Jcblx0XHRmb3IgKGNvbnN0IFssIGVudHJpZXNdIG9mIHRoaXMuZWRpdG9yU2NvcGVkTmF2aWdhdGlvblN0YWNrcykge1xuXHRcdFx0Zm9yIChjb25zdCBbLCBlbnRyeV0gb2YgZW50cmllcykge1xuXHRcdFx0XHRmbihlbnRyeS5zdGFjayk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBkaXNwb3NlRWRpdG9yTmF2aWdhdGlvblN0YWNrcygpOiB2b2lkIHtcblxuXHRcdC8vIEdsb2JhbFxuXHRcdHRoaXMuZGVmYXVsdFNjb3BlZEVkaXRvck5hdmlnYXRpb25TdGFjaz8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuZGVmYXVsdFNjb3BlZEVkaXRvck5hdmlnYXRpb25TdGFjayA9IHVuZGVmaW5lZDtcblxuXHRcdC8vIFBlciBFZGl0b3IgZ3JvdXBcblx0XHRmb3IgKGNvbnN0IFssIHN0YWNrXSBvZiB0aGlzLmVkaXRvckdyb3VwU2NvcGVkTmF2aWdhdGlvblN0YWNrcykge1xuXHRcdFx0c3RhY2suZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHRcdHRoaXMuZWRpdG9yR3JvdXBTY29wZWROYXZpZ2F0aW9uU3RhY2tzLmNsZWFyKCk7XG5cblx0XHQvLyBQZXIgRWRpdG9yXG5cdFx0Zm9yIChjb25zdCBbLCBzdGFja3NdIG9mIHRoaXMuZWRpdG9yU2NvcGVkTmF2aWdhdGlvblN0YWNrcykge1xuXHRcdFx0Zm9yIChjb25zdCBbLCBzdGFja10gb2Ygc3RhY2tzKSB7XG5cdFx0XHRcdHN0YWNrLmRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLmVkaXRvclNjb3BlZE5hdmlnYXRpb25TdGFja3MuY2xlYXIoKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBOYXZpZ2F0aW9uOiBOZXh0L1ByZXZpb3VzIFVzZWQgRWRpdG9yXG5cblx0cHJpdmF0ZSByZWNlbnRseVVzZWRFZGl0b3JzU3RhY2s6IHJlYWRvbmx5IElFZGl0b3JJZGVudGlmaWVyW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVjZW50bHlVc2VkRWRpdG9yc1N0YWNrSW5kZXggPSAwO1xuXG5cdHByaXZhdGUgcmVjZW50bHlVc2VkRWRpdG9yc0luR3JvdXBTdGFjazogcmVhZG9ubHkgSUVkaXRvcklkZW50aWZpZXJbXSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWNlbnRseVVzZWRFZGl0b3JzSW5Hcm91cFN0YWNrSW5kZXggPSAwO1xuXG5cdHByaXZhdGUgbmF2aWdhdGluZ0luUmVjZW50bHlVc2VkRWRpdG9yc1N0YWNrID0gZmFsc2U7XG5cdHByaXZhdGUgbmF2aWdhdGluZ0luUmVjZW50bHlVc2VkRWRpdG9yc0luR3JvdXBTdGFjayA9IGZhbHNlO1xuXG5cdG9wZW5OZXh0UmVjZW50bHlVc2VkRWRpdG9yKGdyb3VwSWQ/OiBHcm91cElkZW50aWZpZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBbc3RhY2ssIGluZGV4XSA9IHRoaXMuZW5zdXJlUmVjZW50bHlVc2VkU3RhY2soaW5kZXggPT4gaW5kZXggLSAxLCBncm91cElkKTtcblxuXHRcdHJldHVybiB0aGlzLmRvTmF2aWdhdGVJblJlY2VudGx5VXNlZEVkaXRvcnNTdGFjayhzdGFja1tpbmRleF0sIGdyb3VwSWQpO1xuXHR9XG5cblx0b3BlblByZXZpb3VzbHlVc2VkRWRpdG9yKGdyb3VwSWQ/OiBHcm91cElkZW50aWZpZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBbc3RhY2ssIGluZGV4XSA9IHRoaXMuZW5zdXJlUmVjZW50bHlVc2VkU3RhY2soaW5kZXggPT4gaW5kZXggKyAxLCBncm91cElkKTtcblxuXHRcdHJldHVybiB0aGlzLmRvTmF2aWdhdGVJblJlY2VudGx5VXNlZEVkaXRvcnNTdGFjayhzdGFja1tpbmRleF0sIGdyb3VwSWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb05hdmlnYXRlSW5SZWNlbnRseVVzZWRFZGl0b3JzU3RhY2soZWRpdG9ySWRlbnRpZmllcjogSUVkaXRvcklkZW50aWZpZXIgfCB1bmRlZmluZWQsIGdyb3VwSWQ/OiBHcm91cElkZW50aWZpZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoZWRpdG9ySWRlbnRpZmllcikge1xuXHRcdFx0Y29uc3QgYWNyb3NzR3JvdXBzID0gdHlwZW9mIGdyb3VwSWQgIT09ICdudW1iZXInIHx8ICF0aGlzLmVkaXRvckdyb3VwU2VydmljZS5nZXRHcm91cChncm91cElkKTtcblxuXHRcdFx0aWYgKGFjcm9zc0dyb3Vwcykge1xuXHRcdFx0XHR0aGlzLm5hdmlnYXRpbmdJblJlY2VudGx5VXNlZEVkaXRvcnNTdGFjayA9IHRydWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLm5hdmlnYXRpbmdJblJlY2VudGx5VXNlZEVkaXRvcnNJbkdyb3VwU3RhY2sgPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBncm91cCA9IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmdldEdyb3VwKGVkaXRvcklkZW50aWZpZXIuZ3JvdXBJZCkgPz8gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXA7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBncm91cC5vcGVuRWRpdG9yKGVkaXRvcklkZW50aWZpZXIuZWRpdG9yKTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdGlmIChhY3Jvc3NHcm91cHMpIHtcblx0XHRcdFx0XHR0aGlzLm5hdmlnYXRpbmdJblJlY2VudGx5VXNlZEVkaXRvcnNTdGFjayA9IGZhbHNlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMubmF2aWdhdGluZ0luUmVjZW50bHlVc2VkRWRpdG9yc0luR3JvdXBTdGFjayA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBlbnN1cmVSZWNlbnRseVVzZWRTdGFjayhpbmRleE1vZGlmaWVyOiAoaW5kZXg6IG51bWJlcikgPT4gbnVtYmVyLCBncm91cElkPzogR3JvdXBJZGVudGlmaWVyKTogW3JlYWRvbmx5IElFZGl0b3JJZGVudGlmaWVyW10sIG51bWJlcl0ge1xuXHRcdGxldCBlZGl0b3JzOiByZWFkb25seSBJRWRpdG9ySWRlbnRpZmllcltdO1xuXHRcdGxldCBpbmRleDogbnVtYmVyO1xuXG5cdFx0Y29uc3QgZ3JvdXAgPSB0eXBlb2YgZ3JvdXBJZCA9PT0gJ251bWJlcicgPyB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5nZXRHcm91cChncm91cElkKSA6IHVuZGVmaW5lZDtcblxuXHRcdC8vIEFjcm9zcyBncm91cHNcblx0XHRpZiAoIWdyb3VwKSB7XG5cdFx0XHRlZGl0b3JzID0gdGhpcy5yZWNlbnRseVVzZWRFZGl0b3JzU3RhY2sgfHwgdGhpcy5lZGl0b3JTZXJ2aWNlLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKTtcblx0XHRcdGluZGV4ID0gdGhpcy5yZWNlbnRseVVzZWRFZGl0b3JzU3RhY2tJbmRleDtcblx0XHR9XG5cblx0XHQvLyBXaXRoaW4gZ3JvdXBcblx0XHRlbHNlIHtcblx0XHRcdGVkaXRvcnMgPSB0aGlzLnJlY2VudGx5VXNlZEVkaXRvcnNJbkdyb3VwU3RhY2sgfHwgZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLm1hcChlZGl0b3IgPT4gKHsgZ3JvdXBJZDogZ3JvdXAuaWQsIGVkaXRvciB9KSk7XG5cdFx0XHRpbmRleCA9IHRoaXMucmVjZW50bHlVc2VkRWRpdG9yc0luR3JvdXBTdGFja0luZGV4O1xuXHRcdH1cblxuXHRcdC8vIEFkanVzdCBpbmRleFxuXHRcdGxldCBuZXdJbmRleCA9IGluZGV4TW9kaWZpZXIoaW5kZXgpO1xuXHRcdGlmIChuZXdJbmRleCA8IDApIHtcblx0XHRcdG5ld0luZGV4ID0gMDtcblx0XHR9IGVsc2UgaWYgKG5ld0luZGV4ID4gZWRpdG9ycy5sZW5ndGggLSAxKSB7XG5cdFx0XHRuZXdJbmRleCA9IGVkaXRvcnMubGVuZ3RoIC0gMTtcblx0XHR9XG5cblx0XHQvLyBSZW1lbWJlciBpbmRleCBhbmQgZWRpdG9yc1xuXHRcdGlmICghZ3JvdXApIHtcblx0XHRcdHRoaXMucmVjZW50bHlVc2VkRWRpdG9yc1N0YWNrID0gZWRpdG9ycztcblx0XHRcdHRoaXMucmVjZW50bHlVc2VkRWRpdG9yc1N0YWNrSW5kZXggPSBuZXdJbmRleDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5yZWNlbnRseVVzZWRFZGl0b3JzSW5Hcm91cFN0YWNrID0gZWRpdG9ycztcblx0XHRcdHRoaXMucmVjZW50bHlVc2VkRWRpdG9yc0luR3JvdXBTdGFja0luZGV4ID0gbmV3SW5kZXg7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFtlZGl0b3JzLCBuZXdJbmRleF07XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUVkaXRvckV2ZW50SW5SZWNlbnRFZGl0b3JzU3RhY2soKTogdm9pZCB7XG5cblx0XHQvLyBEcm9wIGFsbC1lZGl0b3JzIHN0YWNrIHVubGVzcyBuYXZpZ2F0aW5nIGluIGFsbCBlZGl0b3JzXG5cdFx0aWYgKCF0aGlzLm5hdmlnYXRpbmdJblJlY2VudGx5VXNlZEVkaXRvcnNTdGFjaykge1xuXHRcdFx0dGhpcy5yZWNlbnRseVVzZWRFZGl0b3JzU3RhY2sgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLnJlY2VudGx5VXNlZEVkaXRvcnNTdGFja0luZGV4ID0gMDtcblx0XHR9XG5cblx0XHQvLyBEcm9wIGluLWdyb3VwLWVkaXRvcnMgc3RhY2sgdW5sZXNzIG5hdmlnYXRpbmcgaW4gZ3JvdXBcblx0XHRpZiAoIXRoaXMubmF2aWdhdGluZ0luUmVjZW50bHlVc2VkRWRpdG9yc0luR3JvdXBTdGFjaykge1xuXHRcdFx0dGhpcy5yZWNlbnRseVVzZWRFZGl0b3JzSW5Hcm91cFN0YWNrID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5yZWNlbnRseVVzZWRFZGl0b3JzSW5Hcm91cFN0YWNrSW5kZXggPSAwO1xuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBGaWxlOiBSZW9wZW4gQ2xvc2VkIEVkaXRvciAobGltaXQ6IDIwKVxuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IE1BWF9SRUNFTlRMWV9DTE9TRURfRURJVE9SUyA9IDIwO1xuXG5cdHByaXZhdGUgcmVjZW50bHlDbG9zZWRFZGl0b3JzOiBJUmVjZW50bHlDbG9zZWRFZGl0b3JbXSA9IFtdO1xuXHRwcml2YXRlIGlnbm9yZUVkaXRvckNsb3NlRXZlbnQgPSBmYWxzZTtcblxuXHRwcml2YXRlIGhhbmRsZUVkaXRvckNsb3NlRXZlbnRJblJlb3BlbihldmVudDogSUVkaXRvckNsb3NlRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5pZ25vcmVFZGl0b3JDbG9zZUV2ZW50KSB7XG5cdFx0XHRyZXR1cm47IC8vIGJsb2NrZWRcblx0XHR9XG5cblx0XHRjb25zdCB7IGVkaXRvciwgY29udGV4dCB9ID0gZXZlbnQ7XG5cdFx0aWYgKGNvbnRleHQgPT09IEVkaXRvckNsb3NlQ29udGV4dC5SRVBMQUNFIHx8IGNvbnRleHQgPT09IEVkaXRvckNsb3NlQ29udGV4dC5NT1ZFKSB7XG5cdFx0XHRyZXR1cm47IC8vIGlnbm9yZSBpZiBlZGl0b3Igd2FzIHJlcGxhY2VkIG9yIG1vdmVkXG5cdFx0fVxuXG5cdFx0Y29uc3QgdW50eXBlZEVkaXRvciA9IGVkaXRvci50b1VudHlwZWQoKTtcblx0XHRpZiAoIXVudHlwZWRFZGl0b3IpIHtcblx0XHRcdHJldHVybjsgLy8gd2UgbmVlZCBhIHVudHlwZWQgZWRpdG9yIHRvIHJlc3RvcmUgZnJvbSBnb2luZyBmb3J3YXJkXG5cdFx0fVxuXG5cdFx0Y29uc3QgYXNzb2NpYXRlZFJlc291cmNlczogVVJJW10gPSBbXTtcblx0XHRjb25zdCBlZGl0b3JSZXNvdXJjZSA9IEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0T3JpZ2luYWxVcmkoZWRpdG9yLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkJPVEggfSk7XG5cdFx0aWYgKFVSSS5pc1VyaShlZGl0b3JSZXNvdXJjZSkpIHtcblx0XHRcdGFzc29jaWF0ZWRSZXNvdXJjZXMucHVzaChlZGl0b3JSZXNvdXJjZSk7XG5cdFx0fSBlbHNlIGlmIChlZGl0b3JSZXNvdXJjZSkge1xuXHRcdFx0YXNzb2NpYXRlZFJlc291cmNlcy5wdXNoKC4uLmNvYWxlc2NlKFtlZGl0b3JSZXNvdXJjZS5wcmltYXJ5LCBlZGl0b3JSZXNvdXJjZS5zZWNvbmRhcnldKSk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVtb3ZlIGZyb20gbGlzdCBvZiByZWNlbnRseSBjbG9zZWQgYmVmb3JlLi4uXG5cdFx0dGhpcy5yZW1vdmVGcm9tUmVjZW50bHlDbG9zZWRFZGl0b3JzKGVkaXRvcik7XG5cblx0XHQvLyAuLi5hZGRpbmcgaXQgYXMgbGFzdCByZWNlbnRseSBjbG9zZWRcblx0XHR0aGlzLnJlY2VudGx5Q2xvc2VkRWRpdG9ycy5wdXNoKHtcblx0XHRcdGVkaXRvcklkOiBlZGl0b3IuZWRpdG9ySWQsXG5cdFx0XHRlZGl0b3I6IHVudHlwZWRFZGl0b3IsXG5cdFx0XHRyZXNvdXJjZTogRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRPcmlnaW5hbFVyaShlZGl0b3IpLFxuXHRcdFx0YXNzb2NpYXRlZFJlc291cmNlcyxcblx0XHRcdGluZGV4OiBldmVudC5pbmRleCxcblx0XHRcdHN0aWNreTogZXZlbnQuc3RpY2t5XG5cdFx0fSk7XG5cblx0XHQvLyBCb3VuZGluZ1xuXHRcdGlmICh0aGlzLnJlY2VudGx5Q2xvc2VkRWRpdG9ycy5sZW5ndGggPiBIaXN0b3J5U2VydmljZS5NQVhfUkVDRU5UTFlfQ0xPU0VEX0VESVRPUlMpIHtcblx0XHRcdHRoaXMucmVjZW50bHlDbG9zZWRFZGl0b3JzLnNoaWZ0KCk7XG5cdFx0fVxuXG5cdFx0Ly8gQ29udGV4dFxuXHRcdHRoaXMuY2FuUmVvcGVuQ2xvc2VkRWRpdG9yQ29udGV4dEtleS5zZXQodHJ1ZSk7XG5cdH1cblxuXHRhc3luYyByZW9wZW5MYXN0Q2xvc2VkRWRpdG9yKCk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gT3BlbiBlZGl0b3IgaWYgd2UgaGF2ZSBvbmVcblx0XHRjb25zdCBsYXN0Q2xvc2VkRWRpdG9yID0gdGhpcy5yZWNlbnRseUNsb3NlZEVkaXRvcnMucG9wKCk7XG5cdFx0bGV0IHJlb3BlbkNsb3NlZEVkaXRvclByb21pc2U6IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGxhc3RDbG9zZWRFZGl0b3IpIHtcblx0XHRcdHJlb3BlbkNsb3NlZEVkaXRvclByb21pc2UgPSB0aGlzLmRvUmVvcGVuTGFzdENsb3NlZEVkaXRvcihsYXN0Q2xvc2VkRWRpdG9yKTtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgY29udGV4dFxuXHRcdHRoaXMuY2FuUmVvcGVuQ2xvc2VkRWRpdG9yQ29udGV4dEtleS5zZXQodGhpcy5yZWNlbnRseUNsb3NlZEVkaXRvcnMubGVuZ3RoID4gMCk7XG5cblx0XHRyZXR1cm4gcmVvcGVuQ2xvc2VkRWRpdG9yUHJvbWlzZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9SZW9wZW5MYXN0Q2xvc2VkRWRpdG9yKGxhc3RDbG9zZWRFZGl0b3I6IElSZWNlbnRseUNsb3NlZEVkaXRvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG9wdGlvbnM6IElFZGl0b3JPcHRpb25zID0geyBwaW5uZWQ6IHRydWUsIHN0aWNreTogbGFzdENsb3NlZEVkaXRvci5zdGlja3ksIGluZGV4OiBsYXN0Q2xvc2VkRWRpdG9yLmluZGV4LCBpZ25vcmVFcnJvcjogdHJ1ZSB9O1xuXG5cdFx0Ly8gU3BlY2lhbCBzdGlja3kgaGFuZGxpbmc6IHJlbW92ZSB0aGUgaW5kZXggcHJvcGVydHkgZnJvbSBvcHRpb25zXG5cdFx0Ly8gaWYgdGhhdCB3b3VsZCByZXN1bHQgaW4gc3RpY2t5IHN0YXRlIHRvIG5vdCBwcmVzZXJ2ZSBvciBhcHBseVxuXHRcdC8vIHdyb25nbHkuXG5cdFx0aWYgKFxuXHRcdFx0KGxhc3RDbG9zZWRFZGl0b3Iuc3RpY2t5ICYmICF0aGlzLmVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cC5pc1N0aWNreShsYXN0Q2xvc2VkRWRpdG9yLmluZGV4KSkgfHxcblx0XHRcdCghbGFzdENsb3NlZEVkaXRvci5zdGlja3kgJiYgdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXAuaXNTdGlja3kobGFzdENsb3NlZEVkaXRvci5pbmRleCkpXG5cdFx0KSB7XG5cdFx0XHRvcHRpb25zLmluZGV4ID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIFJlLW9wZW4gZWRpdG9yIHVubGVzcyBhbHJlYWR5IG9wZW5lZFxuXHRcdGxldCBlZGl0b3JQYW5lOiBJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAoIXRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwLmNvbnRhaW5zKGxhc3RDbG9zZWRFZGl0b3IuZWRpdG9yKSkge1xuXG5cdFx0XHQvLyBGaXggZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMDc4NTBcblx0XHRcdC8vIElmIG9wZW5pbmcgYW4gZWRpdG9yIGZhaWxzLCBpdCBpcyBwb3NzaWJsZSB0aGF0IHdlIGdldFxuXHRcdFx0Ly8gYW5vdGhlciBlZGl0b3ItY2xvc2UgZXZlbnQgYXMgYSByZXN1bHQuIEJ1dCB3ZSByZWFsbHkgZG9cblx0XHRcdC8vIHdhbnQgdG8gaWdub3JlIHRoYXQgaW4gb3VyIGxpc3Qgb2YgcmVjZW50bHkgY2xvc2VkIGVkaXRvcnNcblx0XHRcdC8vICB0byBwcmV2ZW50IGVuZGxlc3MgbG9vcHMuXG5cblx0XHRcdHRoaXMuaWdub3JlRWRpdG9yQ2xvc2VFdmVudCA9IHRydWU7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRlZGl0b3JQYW5lID0gYXdhaXQgdGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRcdC4uLmxhc3RDbG9zZWRFZGl0b3IuZWRpdG9yLFxuXHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdC4uLmxhc3RDbG9zZWRFZGl0b3IuZWRpdG9yLm9wdGlvbnMsXG5cdFx0XHRcdFx0XHQuLi5vcHRpb25zXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdHRoaXMuaWdub3JlRWRpdG9yQ2xvc2VFdmVudCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIElmIG5vIGVkaXRvciB3YXMgb3BlbmVkLCB0cnkgd2l0aCB0aGUgbmV4dCBvbmVcblx0XHRpZiAoIWVkaXRvclBhbmUpIHtcblxuXHRcdFx0Ly8gRml4IGZvciBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNjc4ODJcblx0XHRcdC8vIElmIG9wZW5pbmcgb2YgdGhlIGVkaXRvciBmYWlscywgbWFrZSBzdXJlIHRvIHRyeSB0aGUgbmV4dCBvbmVcblx0XHRcdC8vIGJ1dCBtYWtlIHN1cmUgdG8gcmVtb3ZlIHRoaXMgb25lIGZyb20gdGhlIGxpc3QgdG8gcHJldmVudFxuXHRcdFx0Ly8gZW5kbGVzcyBsb29wcy5cblx0XHRcdHJlbW92ZSh0aGlzLnJlY2VudGx5Q2xvc2VkRWRpdG9ycywgbGFzdENsb3NlZEVkaXRvcik7XG5cblx0XHRcdC8vIFRyeSB3aXRoIG5leHQgb25lXG5cdFx0XHR0aGlzLnJlb3Blbkxhc3RDbG9zZWRFZGl0b3IoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZUZyb21SZWNlbnRseUNsb3NlZEVkaXRvcnMoYXJnMTogRWRpdG9ySW5wdXQgfCBGaWxlQ2hhbmdlc0V2ZW50IHwgRmlsZU9wZXJhdGlvbkV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5yZWNlbnRseUNsb3NlZEVkaXRvcnMgPSB0aGlzLnJlY2VudGx5Q2xvc2VkRWRpdG9ycy5maWx0ZXIocmVjZW50bHlDbG9zZWRFZGl0b3IgPT4ge1xuXHRcdFx0aWYgKGlzRWRpdG9ySW5wdXQoYXJnMSkgJiYgcmVjZW50bHlDbG9zZWRFZGl0b3IuZWRpdG9ySWQgIT09IGFyZzEuZWRpdG9ySWQpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7IC8vIGtlZXA6IGRpZmZlcmVudCBlZGl0b3IgaWRlbnRpZmllcnNcblx0XHRcdH1cblxuXHRcdFx0aWYgKHJlY2VudGx5Q2xvc2VkRWRpdG9yLnJlc291cmNlICYmIHRoaXMuZWRpdG9ySGVscGVyLm1hdGNoZXNGaWxlKHJlY2VudGx5Q2xvc2VkRWRpdG9yLnJlc291cmNlLCBhcmcxKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vIHJlbW92ZTogZWRpdG9yIG1hdGNoZXMgZGlyZWN0bHlcblx0XHRcdH1cblxuXHRcdFx0aWYgKHJlY2VudGx5Q2xvc2VkRWRpdG9yLmFzc29jaWF0ZWRSZXNvdXJjZXMuc29tZShhc3NvY2lhdGVkUmVzb3VyY2UgPT4gdGhpcy5lZGl0b3JIZWxwZXIubWF0Y2hlc0ZpbGUoYXNzb2NpYXRlZFJlc291cmNlLCBhcmcxKSkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlOyAvLyByZW1vdmU6IGFuIGFzc29jaWF0ZWQgcmVzb3VyY2UgbWF0Y2hlc1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8ga2VlcFxuXHRcdH0pO1xuXG5cdFx0Ly8gVXBkYXRlIGNvbnRleHRcblx0XHR0aGlzLmNhblJlb3BlbkNsb3NlZEVkaXRvckNvbnRleHRLZXkuc2V0KHRoaXMucmVjZW50bHlDbG9zZWRFZGl0b3JzLmxlbmd0aCA+IDApO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIEdvIHRvOiBSZWNlbnRseSBPcGVuZWQgRWRpdG9yIChsaW1pdDogMjAwLCBwZXJzaXN0ZWQpXG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgTUFYX0hJU1RPUllfSVRFTVMgPSAyMDA7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEhJU1RPUllfU1RPUkFHRV9LRVkgPSAnaGlzdG9yeS5lbnRyaWVzJztcblxuXHRwcml2YXRlIGhpc3Rvcnk6IEFycmF5PEVkaXRvcklucHV0IHwgSVJlc291cmNlRWRpdG9ySW5wdXQ+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9ySGlzdG9yeUxpc3RlbmVycyA9IG5ldyBNYXA8RWRpdG9ySW5wdXQsIERpc3Bvc2FibGVTdG9yZT4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHJlc291cmNlRXhjbHVkZU1hdGNoZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgV2luZG93SWRsZVZhbHVlKG1haW5XaW5kb3csICgpID0+IHtcblx0XHRjb25zdCBtYXRjaGVyID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFJlc291cmNlR2xvYk1hdGNoZXIsXG5cdFx0XHRyb290ID0+IGdldEV4Y2x1ZGVzKHJvb3QgPyB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElTZWFyY2hDb25maWd1cmF0aW9uPih7IHJlc291cmNlOiByb290IH0pIDogdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJU2VhcmNoQ29uZmlndXJhdGlvbj4oKSkgfHwgT2JqZWN0LmNyZWF0ZShudWxsKSxcblx0XHRcdGV2ZW50ID0+IGV2ZW50LmFmZmVjdHNDb25maWd1cmF0aW9uKEZJTEVTX0VYQ0xVREVfQ09ORklHKSB8fCBldmVudC5hZmZlY3RzQ29uZmlndXJhdGlvbihTRUFSQ0hfRVhDTFVERV9DT05GSUcpXG5cdFx0KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihtYXRjaGVyLm9uRXhwcmVzc2lvbkNoYW5nZSgoKSA9PiB0aGlzLnJlbW92ZUV4Y2x1ZGVkRnJvbUhpc3RvcnkoKSkpO1xuXG5cdFx0cmV0dXJuIG1hdGNoZXI7XG5cdH0pKTtcblxuXHRwcml2YXRlIGhhbmRsZUFjdGl2ZUVkaXRvckNoYW5nZUluSGlzdG9yeShlZGl0b3JQYW5lPzogSUVkaXRvclBhbmUpOiB2b2lkIHtcblxuXHRcdC8vIEVuc3VyZSB3ZSBoYXZlIG5vdCBjb25maWd1cmVkIHRvIGV4Y2x1ZGUgaW5wdXQgYW5kIGRvbid0IHRyYWNrIGludmFsaWQgaW5wdXRzXG5cdFx0Y29uc3QgZWRpdG9yID0gZWRpdG9yUGFuZT8uaW5wdXQ7XG5cdFx0aWYgKCFlZGl0b3IgfHwgZWRpdG9yLmlzRGlzcG9zZWQoKSB8fCAhdGhpcy5pbmNsdWRlSW5IaXN0b3J5KGVkaXRvcikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBSZW1vdmUgYW55IGV4aXN0aW5nIGVudHJ5IGFuZCBhZGQgdG8gdGhlIGJlZ2lubmluZ1xuXHRcdHRoaXMucmVtb3ZlRnJvbUhpc3RvcnkoZWRpdG9yKTtcblx0XHR0aGlzLmFkZFRvSGlzdG9yeShlZGl0b3IpO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRUb0hpc3RvcnkoZWRpdG9yOiBFZGl0b3JJbnB1dCB8IElSZXNvdXJjZUVkaXRvcklucHV0LCBpbnNlcnRGaXJzdCA9IHRydWUpOiB2b2lkIHtcblx0XHR0aGlzLmVuc3VyZUhpc3RvcnlMb2FkZWQodGhpcy5oaXN0b3J5KTtcblxuXHRcdGNvbnN0IGhpc3RvcnlJbnB1dCA9IHRoaXMuZWRpdG9ySGVscGVyLnByZWZlclJlc291cmNlRWRpdG9ySW5wdXQoZWRpdG9yKTtcblx0XHRpZiAoIWhpc3RvcnlJbnB1dCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEluc2VydCBiYXNlZCBvbiBwcmVmZXJlbmNlXG5cdFx0aWYgKGluc2VydEZpcnN0KSB7XG5cdFx0XHR0aGlzLmhpc3RvcnkudW5zaGlmdChoaXN0b3J5SW5wdXQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmhpc3RvcnkucHVzaChoaXN0b3J5SW5wdXQpO1xuXHRcdH1cblxuXHRcdC8vIFJlc3BlY3QgbWF4IGVudHJpZXMgc2V0dGluZ1xuXHRcdGlmICh0aGlzLmhpc3RvcnkubGVuZ3RoID4gSGlzdG9yeVNlcnZpY2UuTUFYX0hJU1RPUllfSVRFTVMpIHtcblx0XHRcdHRoaXMuZWRpdG9ySGVscGVyLmNsZWFyT25FZGl0b3JEaXNwb3NlKHRoaXMuaGlzdG9yeS5wb3AoKSEsIHRoaXMuZWRpdG9ySGlzdG9yeUxpc3RlbmVycyk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVhY3QgdG8gZWRpdG9yIGlucHV0IGRpc3Bvc2luZ1xuXHRcdGlmIChpc0VkaXRvcklucHV0KGVkaXRvcikpIHtcblx0XHRcdHRoaXMuZWRpdG9ySGVscGVyLm9uRWRpdG9yRGlzcG9zZShlZGl0b3IsICgpID0+IHRoaXMudXBkYXRlSGlzdG9yeU9uRWRpdG9yRGlzcG9zZShoaXN0b3J5SW5wdXQpLCB0aGlzLmVkaXRvckhpc3RvcnlMaXN0ZW5lcnMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlSGlzdG9yeU9uRWRpdG9yRGlzcG9zZShlZGl0b3I6IEVkaXRvcklucHV0IHwgSVJlc291cmNlRWRpdG9ySW5wdXQpOiB2b2lkIHtcblx0XHRpZiAoaXNFZGl0b3JJbnB1dChlZGl0b3IpKSB7XG5cblx0XHRcdC8vIEFueSBub24gc2lkZS1ieS1zaWRlIGVkaXRvciBpbnB1dCBnZXRzIHJlbW92ZWQgZGlyZWN0bHkgb24gZGlzcG9zZVxuXHRcdFx0aWYgKCFpc1NpZGVCeVNpZGVFZGl0b3JJbnB1dChlZGl0b3IpKSB7XG5cdFx0XHRcdHRoaXMucmVtb3ZlRnJvbUhpc3RvcnkoZWRpdG9yKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2lkZS1ieS1zaWRlIGVkaXRvcnMgZ2V0IHNwZWNpYWwgdHJlYXRtZW50OiB3ZSB0cnkgdG8gZGlzdGlsbCB0aGVcblx0XHRcdC8vIHBvc3NpYmx5IHVudHlwZWQgcmVzb3VyY2UgaW5wdXRzIGZyb20gYm90aCBzaWRlcyB0byBiZSBhYmxlIHRvXG5cdFx0XHQvLyBvZmZlciB0aGVzZSBlbnRyaWVzIGZyb20gdGhlIGhpc3RvcnkgdG8gdGhlIHVzZXIgc3RpbGwgdW5sZXNzXG5cdFx0XHQvLyB0aGV5IGFyZSBleGNsdWRlZC5cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRjb25zdCByZXNvdXJjZUlucHV0czogSVJlc291cmNlRWRpdG9ySW5wdXRbXSA9IFtdO1xuXHRcdFx0XHRjb25zdCBzaWRlSW5wdXRzID0gZWRpdG9yLnByaW1hcnkubWF0Y2hlcyhlZGl0b3Iuc2Vjb25kYXJ5KSA/IFtlZGl0b3IucHJpbWFyeV0gOiBbZWRpdG9yLnByaW1hcnksIGVkaXRvci5zZWNvbmRhcnldO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNpZGVJbnB1dCBvZiBzaWRlSW5wdXRzKSB7XG5cdFx0XHRcdFx0Y29uc3QgY2FuZGlkYXRlUmVzb3VyY2VJbnB1dCA9IHRoaXMuZWRpdG9ySGVscGVyLnByZWZlclJlc291cmNlRWRpdG9ySW5wdXQoc2lkZUlucHV0KTtcblx0XHRcdFx0XHRpZiAoaXNSZXNvdXJjZUVkaXRvcklucHV0KGNhbmRpZGF0ZVJlc291cmNlSW5wdXQpICYmIHRoaXMuaW5jbHVkZUluSGlzdG9yeShjYW5kaWRhdGVSZXNvdXJjZUlucHV0KSkge1xuXHRcdFx0XHRcdFx0cmVzb3VyY2VJbnB1dHMucHVzaChjYW5kaWRhdGVSZXNvdXJjZUlucHV0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBJbnNlcnQgdGhlIHVudHlwZWQgcmVzb3VyY2UgaW5wdXRzIHdoZXJlIG91ciBkaXNwb3NlZFxuXHRcdFx0XHQvLyBzaWRlLWJ5LXNpZGUgZWRpdG9yIGlucHV0IGlzIGluIHRoZSBoaXN0b3J5IHN0YWNrXG5cdFx0XHRcdHRoaXMucmVwbGFjZUluSGlzdG9yeShlZGl0b3IsIC4uLnJlc291cmNlSW5wdXRzKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXG5cdFx0XHQvLyBSZW1vdmUgYW55IGVkaXRvciB0aGF0IHNob3VsZCBub3QgYmUgaW5jbHVkZWQgaW4gaGlzdG9yeVxuXHRcdFx0aWYgKCF0aGlzLmluY2x1ZGVJbkhpc3RvcnkoZWRpdG9yKSkge1xuXHRcdFx0XHR0aGlzLnJlbW92ZUZyb21IaXN0b3J5KGVkaXRvcik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBpbmNsdWRlSW5IaXN0b3J5KGVkaXRvcjogRWRpdG9ySW5wdXQgfCBJUmVzb3VyY2VFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdGlmIChpc0VkaXRvcklucHV0KGVkaXRvcikpIHtcblx0XHRcdHJldHVybiB0cnVlOyAvLyBpbmNsdWRlIGFueSBub24gZmlsZXNcblx0XHR9XG5cblx0XHRyZXR1cm4gIXRoaXMucmVzb3VyY2VFeGNsdWRlTWF0Y2hlci52YWx1ZS5tYXRjaGVzKGVkaXRvci5yZXNvdXJjZSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZUV4Y2x1ZGVkRnJvbUhpc3RvcnkoKTogdm9pZCB7XG5cdFx0dGhpcy5lbnN1cmVIaXN0b3J5TG9hZGVkKHRoaXMuaGlzdG9yeSk7XG5cblx0XHR0aGlzLmhpc3RvcnkgPSB0aGlzLmhpc3RvcnkuZmlsdGVyKGVudHJ5ID0+IHtcblx0XHRcdGNvbnN0IGluY2x1ZGUgPSB0aGlzLmluY2x1ZGVJbkhpc3RvcnkoZW50cnkpO1xuXG5cdFx0XHQvLyBDbGVhbnVwIGFueSBsaXN0ZW5lcnMgYXNzb2NpYXRlZCB3aXRoIHRoZSBpbnB1dCB3aGVuIHJlbW92aW5nIGZyb20gaGlzdG9yeVxuXHRcdFx0aWYgKCFpbmNsdWRlKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9ySGVscGVyLmNsZWFyT25FZGl0b3JEaXNwb3NlKGVudHJ5LCB0aGlzLmVkaXRvckhpc3RvcnlMaXN0ZW5lcnMpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gaW5jbHVkZTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgbW92ZUluSGlzdG9yeShldmVudDogRmlsZU9wZXJhdGlvbkV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKGV2ZW50LmlzT3BlcmF0aW9uKEZpbGVPcGVyYXRpb24uTU9WRSkpIHtcblx0XHRcdGNvbnN0IHJlbW92ZWQgPSB0aGlzLnJlbW92ZUZyb21IaXN0b3J5KGV2ZW50KTtcblx0XHRcdGlmIChyZW1vdmVkKSB7XG5cdFx0XHRcdHRoaXMuYWRkVG9IaXN0b3J5KHsgcmVzb3VyY2U6IGV2ZW50LnRhcmdldC5yZXNvdXJjZSB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZW1vdmVGcm9tSGlzdG9yeShhcmcxOiBFZGl0b3JJbnB1dCB8IElSZXNvdXJjZUVkaXRvcklucHV0IHwgRmlsZUNoYW5nZXNFdmVudCB8IEZpbGVPcGVyYXRpb25FdmVudCk6IGJvb2xlYW4ge1xuXHRcdGxldCByZW1vdmVkID0gZmFsc2U7XG5cblx0XHR0aGlzLmVuc3VyZUhpc3RvcnlMb2FkZWQodGhpcy5oaXN0b3J5KTtcblxuXHRcdHRoaXMuaGlzdG9yeSA9IHRoaXMuaGlzdG9yeS5maWx0ZXIoZW50cnkgPT4ge1xuXHRcdFx0Y29uc3QgbWF0Y2hlcyA9IHRoaXMuZWRpdG9ySGVscGVyLm1hdGNoZXNFZGl0b3IoYXJnMSwgZW50cnkpO1xuXG5cdFx0XHQvLyBDbGVhbnVwIGFueSBsaXN0ZW5lcnMgYXNzb2NpYXRlZCB3aXRoIHRoZSBpbnB1dCB3aGVuIHJlbW92aW5nIGZyb20gaGlzdG9yeVxuXHRcdFx0aWYgKG1hdGNoZXMpIHtcblx0XHRcdFx0dGhpcy5lZGl0b3JIZWxwZXIuY2xlYXJPbkVkaXRvckRpc3Bvc2UoYXJnMSwgdGhpcy5lZGl0b3JIaXN0b3J5TGlzdGVuZXJzKTtcblx0XHRcdFx0cmVtb3ZlZCA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiAhbWF0Y2hlcztcblx0XHR9KTtcblxuXHRcdHJldHVybiByZW1vdmVkO1xuXHR9XG5cblx0cHJpdmF0ZSByZXBsYWNlSW5IaXN0b3J5KGVkaXRvcjogRWRpdG9ySW5wdXQgfCBJUmVzb3VyY2VFZGl0b3JJbnB1dCwgLi4ucmVwbGFjZW1lbnRzOiBSZWFkb25seUFycmF5PEVkaXRvcklucHV0IHwgSVJlc291cmNlRWRpdG9ySW5wdXQ+KTogdm9pZCB7XG5cdFx0dGhpcy5lbnN1cmVIaXN0b3J5TG9hZGVkKHRoaXMuaGlzdG9yeSk7XG5cblx0XHRsZXQgcmVwbGFjZWQgPSBmYWxzZTtcblxuXHRcdGNvbnN0IG5ld0hpc3Rvcnk6IEFycmF5PEVkaXRvcklucHV0IHwgSVJlc291cmNlRWRpdG9ySW5wdXQ+ID0gW107XG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmhpc3RvcnkpIHtcblxuXHRcdFx0Ly8gRW50cnkgbWF0Y2hlcyBhbmQgaXMgZ29pbmcgdG8gYmUgZGlzcG9zZWQgKyByZXBsYWNlZFxuXHRcdFx0aWYgKHRoaXMuZWRpdG9ySGVscGVyLm1hdGNoZXNFZGl0b3IoZWRpdG9yLCBlbnRyeSkpIHtcblxuXHRcdFx0XHQvLyBDbGVhbnVwIGFueSBsaXN0ZW5lcnMgYXNzb2NpYXRlZCB3aXRoIHRoZSBpbnB1dCB3aGVuIHJlcGxhY2luZyBmcm9tIGhpc3Rvcnlcblx0XHRcdFx0dGhpcy5lZGl0b3JIZWxwZXIuY2xlYXJPbkVkaXRvckRpc3Bvc2UoZWRpdG9yLCB0aGlzLmVkaXRvckhpc3RvcnlMaXN0ZW5lcnMpO1xuXG5cdFx0XHRcdC8vIEluc2VydCByZXBsYWNlbWVudHMgYnV0IG9ubHkgb25jZVxuXHRcdFx0XHRpZiAoIXJlcGxhY2VkKSB7XG5cdFx0XHRcdFx0bmV3SGlzdG9yeS5wdXNoKC4uLnJlcGxhY2VtZW50cyk7XG5cdFx0XHRcdFx0cmVwbGFjZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEVudHJ5IGRvZXMgbm90IG1hdGNoLCBidXQgb25seSBhZGQgaXQgaWYgaXQgZGlkbid0IG1hdGNoXG5cdFx0XHQvLyBvdXIgcmVwbGFjZW1lbnRzIGFscmVhZHlcblx0XHRcdGVsc2UgaWYgKCFyZXBsYWNlbWVudHMuc29tZShyZXBsYWNlbWVudCA9PiB0aGlzLmVkaXRvckhlbHBlci5tYXRjaGVzRWRpdG9yKHJlcGxhY2VtZW50LCBlbnRyeSkpKSB7XG5cdFx0XHRcdG5ld0hpc3RvcnkucHVzaChlbnRyeSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIHRhcmdldCBlZGl0b3IgdG8gcmVwbGFjZSB3YXMgbm90IGZvdW5kLCBtYWtlIHN1cmUgdG9cblx0XHQvLyBpbnNlcnQgdGhlIHJlcGxhY2VtZW50cyB0byB0aGUgZW5kIHRvIGVuc3VyZSB3ZSBnb3QgdGhlbVxuXHRcdGlmICghcmVwbGFjZWQpIHtcblx0XHRcdG5ld0hpc3RvcnkucHVzaCguLi5yZXBsYWNlbWVudHMpO1xuXHRcdH1cblxuXHRcdHRoaXMuaGlzdG9yeSA9IG5ld0hpc3Rvcnk7XG5cdH1cblxuXHRjbGVhclJlY2VudGx5T3BlbmVkKCk6IHZvaWQge1xuXHRcdHRoaXMuaGlzdG9yeSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBbLCBkaXNwb3NhYmxlXSBvZiB0aGlzLmVkaXRvckhpc3RvcnlMaXN0ZW5lcnMpIHtcblx0XHRcdGRpc3Bvc2UoZGlzcG9zYWJsZSk7XG5cdFx0fVxuXHRcdHRoaXMuZWRpdG9ySGlzdG9yeUxpc3RlbmVycy5jbGVhcigpO1xuXHR9XG5cblx0Z2V0SGlzdG9yeSgpOiByZWFkb25seSAoRWRpdG9ySW5wdXQgfCBJUmVzb3VyY2VFZGl0b3JJbnB1dClbXSB7XG5cdFx0dGhpcy5lbnN1cmVIaXN0b3J5TG9hZGVkKHRoaXMuaGlzdG9yeSk7XG5cblx0XHRyZXR1cm4gdGhpcy5oaXN0b3J5O1xuXHR9XG5cblx0cHJpdmF0ZSBlbnN1cmVIaXN0b3J5TG9hZGVkKGhpc3Rvcnk6IEFycmF5PEVkaXRvcklucHV0IHwgSVJlc291cmNlRWRpdG9ySW5wdXQ+IHwgdW5kZWZpbmVkKTogYXNzZXJ0cyBoaXN0b3J5IHtcblx0XHRpZiAoIXRoaXMuaGlzdG9yeSkge1xuXG5cdFx0XHQvLyBVbnRpbCBoaXN0b3J5IGlzIGxvYWRlZCwgaXQgaXMganVzdCBlbXB0eVxuXHRcdFx0dGhpcy5oaXN0b3J5ID0gW107XG5cblx0XHRcdC8vIFdlIHdhbnQgdG8gc2VlZCBoaXN0b3J5IGZyb20gb3BlbmVkIGVkaXRvcnNcblx0XHRcdC8vIHRvbyBhcyB3ZWxsIGFzIHByZXZpb3VzIHN0b3JlZCBzdGF0ZSwgc28gd2Vcblx0XHRcdC8vIG5lZWQgdG8gd2FpdCBmb3IgdGhlIGVkaXRvciBncm91cHMgYmVpbmcgcmVhZHlcblx0XHRcdGlmICh0aGlzLmVkaXRvckdyb3VwU2VydmljZS5pc1JlYWR5KSB7XG5cdFx0XHRcdHRoaXMubG9hZEhpc3RvcnkoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5lZGl0b3JHcm91cFNlcnZpY2Uud2hlblJlYWR5O1xuXG5cdFx0XHRcdFx0dGhpcy5sb2FkSGlzdG9yeSgpO1xuXHRcdFx0XHR9KSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgbG9hZEhpc3RvcnkoKTogdm9pZCB7XG5cblx0XHQvLyBJbml0IGFzIGVtcHR5IGJlZm9yZSBhZGRpbmcgLSBzaW5jZSB3ZSBhcmUgYWJvdXQgdG9cblx0XHQvLyBwb3B1bGF0ZSB0aGUgaGlzdG9yeSBmcm9tIG9wZW5lZCBlZGl0b3JzLCB3ZSBjYXB0dXJlXG5cdFx0Ly8gdGhlIHJpZ2h0IG9yZGVyIGhlcmUuXG5cdFx0dGhpcy5oaXN0b3J5ID0gW107XG5cblx0XHQvLyBBbGwgc3RvcmVkIGVkaXRvcnMgZnJvbSBwcmV2aW91cyBzZXNzaW9uXG5cdFx0Y29uc3Qgc3RvcmVkRWRpdG9ySGlzdG9yeSA9IHRoaXMubG9hZEhpc3RvcnlGcm9tU3RvcmFnZSgpO1xuXG5cdFx0Ly8gQWxsIHJlc3RvcmVkIGVkaXRvcnMgZnJvbSBwcmV2aW91cyBzZXNzaW9uXG5cdFx0Ly8gaW4gcmV2ZXJzZSBlZGl0b3IgZnJvbSBsZWFzdCB0byBtb3N0IHJlY2VudGx5XG5cdFx0Ly8gdXNlZC5cblx0XHRjb25zdCBvcGVuZWRFZGl0b3JzTHJ1ID0gWy4uLnRoaXMuZWRpdG9yU2VydmljZS5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSldLnJldmVyc2UoKTtcblxuXHRcdC8vIFdlIHdhbnQgdG8gbWVyZ2UgdGhlIG9wZW5lZCBlZGl0b3JzIGZyb20gdGhlIGxhc3Rcblx0XHQvLyBzZXNzaW9uIHdpdGggdGhlIHN0b3JlZCBlZGl0b3JzIGZyb20gdGhlIGxhc3Rcblx0XHQvLyBzZXNzaW9uLiBCZWNhdXNlIG5vdCBhbGwgZWRpdG9ycyBjYW4gYmUgc2VyaWFsaXNlZFxuXHRcdC8vIHdlIHdhbnQgdG8gbWFrZSBzdXJlIHRvIGluY2x1ZGUgYWxsIG9wZW5lZCBlZGl0b3JzXG5cdFx0Ly8gdG9vLlxuXHRcdC8vIE9wZW5lZCBlZGl0b3JzIHNob3VsZCBhbHdheXMgYmUgZmlyc3QgaW4gdGhlIGhpc3RvcnlcblxuXHRcdGNvbnN0IGhhbmRsZWRFZGl0b3JzID0gbmV3IFNldDxzdHJpbmcgLyogcmVzb3VyY2UgKyBlZGl0b3JJZCAqLz4oKTtcblxuXHRcdC8vIEFkZCBhbGwgb3BlbmVkIGVkaXRvcnMgZmlyc3Rcblx0XHRmb3IgKGNvbnN0IHsgZWRpdG9yIH0gb2Ygb3BlbmVkRWRpdG9yc0xydSkge1xuXHRcdFx0aWYgKCF0aGlzLmluY2x1ZGVJbkhpc3RvcnkoZWRpdG9yKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gTWFrZSBzdXJlIHRvIHNraXAgZHVwbGljYXRlcyBmcm9tIHRoZSBlZGl0b3JzIExSVVxuXHRcdFx0aWYgKGVkaXRvci5yZXNvdXJjZSkge1xuXHRcdFx0XHRjb25zdCBoaXN0b3J5RW50cnlJZCA9IGAke2VkaXRvci5yZXNvdXJjZS50b1N0cmluZygpfS8ke2VkaXRvci5lZGl0b3JJZH1gO1xuXHRcdFx0XHRpZiAoaGFuZGxlZEVkaXRvcnMuaGFzKGhpc3RvcnlFbnRyeUlkKSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlOyAvLyBhbHJlYWR5IGFkZGVkXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRoYW5kbGVkRWRpdG9ycy5hZGQoaGlzdG9yeUVudHJ5SWQpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBBZGQgaW50byBoaXN0b3J5XG5cdFx0XHR0aGlzLmFkZFRvSGlzdG9yeShlZGl0b3IpO1xuXHRcdH1cblxuXHRcdC8vIEFkZCByZW1haW5pbmcgZnJvbSBzdG9yYWdlIGlmIG5vdCB0aGVyZSBhbHJlYWR5XG5cdFx0Ly8gV2UgY2hlY2sgb24gcmVzb3VyY2UgYW5kIGBlZGl0b3JJZGAgKGZyb20gYG92ZXJyaWRlYClcblx0XHQvLyB0byBmaWd1cmUgb3V0IGlmIHRoZSBlZGl0b3IgaGFzIGJlZW4gYWxyZWFkeSBhZGRlZC5cblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBzdG9yZWRFZGl0b3JIaXN0b3J5KSB7XG5cdFx0XHRjb25zdCBoaXN0b3J5RW50cnlJZCA9IGAke2VkaXRvci5yZXNvdXJjZS50b1N0cmluZygpfS8ke2VkaXRvci5vcHRpb25zPy5vdmVycmlkZX1gO1xuXHRcdFx0aWYgKFxuXHRcdFx0XHQhaGFuZGxlZEVkaXRvcnMuaGFzKGhpc3RvcnlFbnRyeUlkKSAmJlxuXHRcdFx0XHR0aGlzLmluY2x1ZGVJbkhpc3RvcnkoZWRpdG9yKVxuXHRcdFx0KSB7XG5cdFx0XHRcdGhhbmRsZWRFZGl0b3JzLmFkZChoaXN0b3J5RW50cnlJZCk7XG5cdFx0XHRcdHRoaXMuYWRkVG9IaXN0b3J5KGVkaXRvciwgZmFsc2UgLyogYXQgdGhlIGVuZCAqLyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBsb2FkSGlzdG9yeUZyb21TdG9yYWdlKCk6IEFycmF5PElSZXNvdXJjZUVkaXRvcklucHV0PiB7XG5cdFx0Y29uc3QgZW50cmllczogSVJlc291cmNlRWRpdG9ySW5wdXRbXSA9IFtdO1xuXG5cdFx0Y29uc3QgZW50cmllc1JhdyA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KEhpc3RvcnlTZXJ2aWNlLkhJU1RPUllfU1RPUkFHRV9LRVksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXHRcdGlmIChlbnRyaWVzUmF3KSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBlbnRyaWVzUGFyc2VkOiBJU2VyaWFsaXplZEVkaXRvckhpc3RvcnlFbnRyeVtdID0gSlNPTi5wYXJzZShlbnRyaWVzUmF3KTtcblx0XHRcdFx0Zm9yIChjb25zdCBlbnRyeVBhcnNlZCBvZiBlbnRyaWVzUGFyc2VkKSB7XG5cdFx0XHRcdFx0aWYgKCFlbnRyeVBhcnNlZC5lZGl0b3IgfHwgIWVudHJ5UGFyc2VkLmVkaXRvci5yZXNvdXJjZSkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7IC8vIHVuZXhwZWN0ZWQgZGF0YSBmb3JtYXRcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0ZW50cmllcy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0Li4uZW50cnlQYXJzZWQuZWRpdG9yLFxuXHRcdFx0XHRcdFx0XHRyZXNvdXJjZTogdHlwZW9mIGVudHJ5UGFyc2VkLmVkaXRvci5yZXNvdXJjZSA9PT0gJ3N0cmluZycgP1xuXHRcdFx0XHRcdFx0XHRcdFVSSS5wYXJzZShlbnRyeVBhcnNlZC5lZGl0b3IucmVzb3VyY2UpIDogIFx0Ly8gIGZyb20gMS42Ny54OiBVUkkgaXMgc3RvcmVkIGVmZmljaWVudGx5IGFzIFVSSS50b1N0cmluZygpXG5cdFx0XHRcdFx0XHRcdFx0VVJJLmZyb20oZW50cnlQYXJzZWQuZWRpdG9yLnJlc291cmNlKVx0XHQvLyB1bnRpbCAxLjY2Lng6IFVSSSB3YXMgc3RvcmVkIHZlcnkgdmVyYm9zZSBhcyBVUkkudG9KU09OKClcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnJvcik7IC8vIGRvIG5vdCBmYWlsIGVudGlyZSBoaXN0b3J5IHdoZW4gb25lIGVudHJ5IGZhaWxzXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnJvcik7IC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy85OTA3NVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBlbnRyaWVzO1xuXHR9XG5cblx0cHJpdmF0ZSBzYXZlU3RhdGUoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmhpc3RvcnkpIHtcblx0XHRcdHJldHVybjsgLy8gbm90aGluZyB0byBzYXZlIGJlY2F1c2UgaGlzdG9yeSB3YXMgbm90IHVzZWRcblx0XHR9XG5cblx0XHRjb25zdCBlbnRyaWVzOiBJU2VyaWFsaXplZEVkaXRvckhpc3RvcnlFbnRyeVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgdGhpcy5oaXN0b3J5KSB7XG5cdFx0XHRpZiAoaXNFZGl0b3JJbnB1dChlZGl0b3IpIHx8ICFpc1Jlc291cmNlRWRpdG9ySW5wdXQoZWRpdG9yKSkge1xuXHRcdFx0XHRjb250aW51ZTsgLy8gb25seSBzYXZlIHJlc291cmNlIGVkaXRvciBpbnB1dHNcblx0XHRcdH1cblxuXHRcdFx0ZW50cmllcy5wdXNoKHtcblx0XHRcdFx0ZWRpdG9yOiB7XG5cdFx0XHRcdFx0Li4uZWRpdG9yLFxuXHRcdFx0XHRcdHJlc291cmNlOiBlZGl0b3IucmVzb3VyY2UudG9TdHJpbmcoKVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKEhpc3RvcnlTZXJ2aWNlLkhJU1RPUllfU1RPUkFHRV9LRVksIEpTT04uc3RyaW5naWZ5KGVudHJpZXMpLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIExhc3QgQWN0aXZlIFdvcmtzcGFjZS9GaWxlXG5cblx0Z2V0TGFzdEFjdGl2ZVdvcmtzcGFjZVJvb3Qoc2NoZW1lRmlsdGVyPzogc3RyaW5nLCBhdXRob3JpdHlGaWx0ZXI/OiBzdHJpbmcpOiBVUkkgfCB1bmRlZmluZWQge1xuXG5cdFx0Ly8gTm8gRm9sZGVyOiByZXR1cm4gZWFybHlcblx0XHRjb25zdCBmb2xkZXJzID0gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzO1xuXHRcdGlmIChmb2xkZXJzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHQvLyBTaW5nbGUgRm9sZGVyOiByZXR1cm4gZWFybHlcblx0XHRpZiAoZm9sZGVycy5sZW5ndGggPT09IDEpIHtcblx0XHRcdGNvbnN0IHJlc291cmNlID0gZm9sZGVyc1swXS51cmk7XG5cdFx0XHRpZiAoKCFzY2hlbWVGaWx0ZXIgfHwgcmVzb3VyY2Uuc2NoZW1lID09PSBzY2hlbWVGaWx0ZXIpICYmICghYXV0aG9yaXR5RmlsdGVyIHx8IHJlc291cmNlLmF1dGhvcml0eSA9PT0gYXV0aG9yaXR5RmlsdGVyKSkge1xuXHRcdFx0XHRyZXR1cm4gcmVzb3VyY2U7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gTXVsdGlwbGUgZm9sZGVyczogZmluZCB0aGUgbGFzdCBhY3RpdmUgb25lXG5cdFx0Zm9yIChjb25zdCBpbnB1dCBvZiB0aGlzLmdldEhpc3RvcnkoKSkge1xuXHRcdFx0aWYgKGlzRWRpdG9ySW5wdXQoaW5wdXQpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc2NoZW1lRmlsdGVyICYmIGlucHV0LnJlc291cmNlLnNjaGVtZSAhPT0gc2NoZW1lRmlsdGVyKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYXV0aG9yaXR5RmlsdGVyICYmIGlucHV0LnJlc291cmNlLmF1dGhvcml0eSAhPT0gYXV0aG9yaXR5RmlsdGVyKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZXNvdXJjZVdvcmtzcGFjZSA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKGlucHV0LnJlc291cmNlKTtcblx0XHRcdGlmIChyZXNvdXJjZVdvcmtzcGFjZSkge1xuXHRcdFx0XHRyZXR1cm4gcmVzb3VyY2VXb3Jrc3BhY2UudXJpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEZhbGxiYWNrIHRvIGZpcnN0IHdvcmtzcGFjZSBtYXRjaGluZyBzY2hlbWUgZmlsdGVyIGlmIGFueVxuXHRcdGZvciAoY29uc3QgZm9sZGVyIG9mIGZvbGRlcnMpIHtcblx0XHRcdGNvbnN0IHJlc291cmNlID0gZm9sZGVyLnVyaTtcblx0XHRcdGlmICgoIXNjaGVtZUZpbHRlciB8fCByZXNvdXJjZS5zY2hlbWUgPT09IHNjaGVtZUZpbHRlcikgJiYgKCFhdXRob3JpdHlGaWx0ZXIgfHwgcmVzb3VyY2UuYXV0aG9yaXR5ID09PSBhdXRob3JpdHlGaWx0ZXIpKSB7XG5cdFx0XHRcdHJldHVybiByZXNvdXJjZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0TGFzdEFjdGl2ZUZpbGUoZmlsdGVyQnlTY2hlbWU6IHN0cmluZywgZmlsdGVyQnlBdXRob3JpdHk/OiBzdHJpbmcpOiBVUkkgfCB1bmRlZmluZWQge1xuXHRcdGZvciAoY29uc3QgaW5wdXQgb2YgdGhpcy5nZXRIaXN0b3J5KCkpIHtcblx0XHRcdGxldCByZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKGlzRWRpdG9ySW5wdXQoaW5wdXQpKSB7XG5cdFx0XHRcdHJlc291cmNlID0gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRPcmlnaW5hbFVyaShpbnB1dCwgeyBmaWx0ZXJCeVNjaGVtZSB9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc291cmNlID0gaW5wdXQucmVzb3VyY2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChyZXNvdXJjZSAmJiByZXNvdXJjZS5zY2hlbWUgPT09IGZpbHRlckJ5U2NoZW1lICYmICghZmlsdGVyQnlBdXRob3JpdHkgfHwgcmVzb3VyY2UuYXV0aG9yaXR5ID09PSBmaWx0ZXJCeUF1dGhvcml0eSkpIHtcblx0XHRcdFx0cmV0dXJuIHJlc291cmNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdGZvciAoY29uc3QgWywgc3RhY2tdIG9mIHRoaXMuZWRpdG9yR3JvdXBTY29wZWROYXZpZ2F0aW9uU3RhY2tzKSB7XG5cdFx0XHRzdGFjay5kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IFssIGVkaXRvcnNdIG9mIHRoaXMuZWRpdG9yU2NvcGVkTmF2aWdhdGlvblN0YWNrcykge1xuXHRcdFx0Zm9yIChjb25zdCBbLCBzdGFja10gb2YgZWRpdG9ycykge1xuXHRcdFx0XHRzdGFjay5kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IFssIGxpc3RlbmVyXSBvZiB0aGlzLmVkaXRvckhpc3RvcnlMaXN0ZW5lcnMpIHtcblx0XHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH1cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSUhpc3RvcnlTZXJ2aWNlLCBIaXN0b3J5U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xuXG5jbGFzcyBFZGl0b3JTZWxlY3Rpb25TdGF0ZSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JJZGVudGlmaWVyOiBJRWRpdG9ySWRlbnRpZmllcixcblx0XHRyZWFkb25seSBzZWxlY3Rpb246IElFZGl0b3JQYW5lU2VsZWN0aW9uIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcmVhc29uOiBFZGl0b3JQYW5lU2VsZWN0aW9uQ2hhbmdlUmVhc29uIHwgdW5kZWZpbmVkXG5cdCkgeyB9XG5cblx0anVzdGlmaWVzTmV3TmF2aWdhdGlvbkVudHJ5KG90aGVyOiBFZGl0b3JTZWxlY3Rpb25TdGF0ZSk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLmVkaXRvcklkZW50aWZpZXIuZ3JvdXBJZCAhPT0gb3RoZXIuZWRpdG9ySWRlbnRpZmllci5ncm91cElkKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gZGlmZmVyZW50IGdyb3VwXG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmVkaXRvcklkZW50aWZpZXIuZWRpdG9yLm1hdGNoZXMob3RoZXIuZWRpdG9ySWRlbnRpZmllci5lZGl0b3IpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gZGlmZmVyZW50IGVkaXRvclxuXHRcdH1cblxuXHRcdGlmICghdGhpcy5zZWxlY3Rpb24gfHwgIW90aGVyLnNlbGVjdGlvbikge1xuXHRcdFx0cmV0dXJuIHRydWU7IC8vIHVua25vd24gc2VsZWN0aW9uc1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuc2VsZWN0aW9uLmNvbXBhcmUob3RoZXIuc2VsZWN0aW9uKTtcblxuXHRcdGlmIChyZXN1bHQgPT09IEVkaXRvclBhbmVTZWxlY3Rpb25Db21wYXJlUmVzdWx0LlNJTUlMQVIgJiYgKG90aGVyLnJlYXNvbiA9PT0gRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZVJlYXNvbi5OQVZJR0FUSU9OIHx8IG90aGVyLnJlYXNvbiA9PT0gRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZVJlYXNvbi5KVU1QKSkge1xuXHRcdFx0Ly8gbGV0IG5hdmlnYXRpb24gc291cmNlcyB3aW4gZXZlbiBpZiB0aGUgc2VsZWN0aW9uIGlzIGBTSU1JTEFSYFxuXHRcdFx0Ly8gKGUuZy4gXCJHbyB0byBkZWZpbml0aW9uXCIgc2hvdWxkIGFkZCBhIGhpc3RvcnkgZW50cnkpXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0ID09PSBFZGl0b3JQYW5lU2VsZWN0aW9uQ29tcGFyZVJlc3VsdC5ESUZGRVJFTlQ7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElFZGl0b3JOYXZpZ2F0aW9uU3RhY2tzIGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8dm9pZD47XG5cblx0Y2FuR29Gb3J3YXJkKGZpbHRlcj86IEdvRmlsdGVyKTogYm9vbGVhbjtcblx0Z29Gb3J3YXJkKGZpbHRlcj86IEdvRmlsdGVyKTogUHJvbWlzZTx2b2lkPjtcblx0Y2FuR29CYWNrKGZpbHRlcj86IEdvRmlsdGVyKTogYm9vbGVhbjtcblx0Z29CYWNrKGZpbHRlcj86IEdvRmlsdGVyKTogUHJvbWlzZTx2b2lkPjtcblx0Z29QcmV2aW91cyhmaWx0ZXI/OiBHb0ZpbHRlcik6IFByb21pc2U8dm9pZD47XG5cdGNhbkdvTGFzdChmaWx0ZXI/OiBHb0ZpbHRlcik6IGJvb2xlYW47XG5cdGdvTGFzdChmaWx0ZXI/OiBHb0ZpbHRlcik6IFByb21pc2U8dm9pZD47XG5cblx0aGFuZGxlQWN0aXZlRWRpdG9yQ2hhbmdlKGVkaXRvclBhbmU/OiBJRWRpdG9yUGFuZSk6IHZvaWQ7XG5cdGhhbmRsZUFjdGl2ZUVkaXRvclNlbGVjdGlvbkNoYW5nZShlZGl0b3JQYW5lOiBJRWRpdG9yUGFuZVdpdGhTZWxlY3Rpb24sIGV2ZW50OiBJRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZUV2ZW50KTogdm9pZDtcblxuXHRjbGVhcigpOiB2b2lkO1xuXHRyZW1vdmUoYXJnMTogRWRpdG9ySW5wdXQgfCBGaWxlQ2hhbmdlc0V2ZW50IHwgRmlsZU9wZXJhdGlvbkV2ZW50IHwgR3JvdXBJZGVudGlmaWVyKTogdm9pZDtcblx0bW92ZShldmVudDogRmlsZU9wZXJhdGlvbkV2ZW50KTogdm9pZDtcbn1cblxuY2xhc3MgRWRpdG9yTmF2aWdhdGlvblN0YWNrcyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRWRpdG9yTmF2aWdhdGlvblN0YWNrcyB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBzZWxlY3Rpb25zU3RhY2s6IEVkaXRvck5hdmlnYXRpb25TdGFjaztcblx0cHJpdmF0ZSByZWFkb25seSBlZGl0c1N0YWNrOiBFZGl0b3JOYXZpZ2F0aW9uU3RhY2s7XG5cdHByaXZhdGUgcmVhZG9ubHkgbmF2aWdhdGlvbnNTdGFjazogRWRpdG9yTmF2aWdhdGlvblN0YWNrO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgc3RhY2tzOiBFZGl0b3JOYXZpZ2F0aW9uU3RhY2tbXTtcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8dm9pZD47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBzY29wZTogR29TY29wZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5zZWxlY3Rpb25zU3RhY2sgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRvck5hdmlnYXRpb25TdGFjaywgR29GaWx0ZXIuTk9ORSwgdGhpcy5zY29wZSkpO1xuXHRcdHRoaXMuZWRpdHNTdGFjayA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRWRpdG9yTmF2aWdhdGlvblN0YWNrLCBHb0ZpbHRlci5FRElUUywgdGhpcy5zY29wZSkpO1xuXHRcdHRoaXMubmF2aWdhdGlvbnNTdGFjayA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRWRpdG9yTmF2aWdhdGlvblN0YWNrLCBHb0ZpbHRlci5OQVZJR0FUSU9OLCB0aGlzLnNjb3BlKSk7XG5cblx0XHR0aGlzLnN0YWNrcyA9IFtcblx0XHRcdHRoaXMuc2VsZWN0aW9uc1N0YWNrLFxuXHRcdFx0dGhpcy5lZGl0c1N0YWNrLFxuXHRcdFx0dGhpcy5uYXZpZ2F0aW9uc1N0YWNrXG5cdFx0XTtcblxuXHRcdHRoaXMub25EaWRDaGFuZ2UgPSBFdmVudC5hbnkoXG5cdFx0XHR0aGlzLnNlbGVjdGlvbnNTdGFjay5vbkRpZENoYW5nZSxcblx0XHRcdHRoaXMuZWRpdHNTdGFjay5vbkRpZENoYW5nZSxcblx0XHRcdHRoaXMubmF2aWdhdGlvbnNTdGFjay5vbkRpZENoYW5nZVxuXHRcdCk7XG5cdH1cblxuXHRjYW5Hb0ZvcndhcmQoZmlsdGVyPzogR29GaWx0ZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRTdGFjayhmaWx0ZXIpLmNhbkdvRm9yd2FyZCgpO1xuXHR9XG5cblx0Z29Gb3J3YXJkKGZpbHRlcj86IEdvRmlsdGVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0U3RhY2soZmlsdGVyKS5nb0ZvcndhcmQoKTtcblx0fVxuXG5cdGNhbkdvQmFjayhmaWx0ZXI/OiBHb0ZpbHRlcik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmdldFN0YWNrKGZpbHRlcikuY2FuR29CYWNrKCk7XG5cdH1cblxuXHRnb0JhY2soZmlsdGVyPzogR29GaWx0ZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5nZXRTdGFjayhmaWx0ZXIpLmdvQmFjaygpO1xuXHR9XG5cblx0Z29QcmV2aW91cyhmaWx0ZXI/OiBHb0ZpbHRlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmdldFN0YWNrKGZpbHRlcikuZ29QcmV2aW91cygpO1xuXHR9XG5cblx0Y2FuR29MYXN0KGZpbHRlcj86IEdvRmlsdGVyKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0U3RhY2soZmlsdGVyKS5jYW5Hb0xhc3QoKTtcblx0fVxuXG5cdGdvTGFzdChmaWx0ZXI/OiBHb0ZpbHRlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmdldFN0YWNrKGZpbHRlcikuZ29MYXN0KCk7XG5cdH1cblxuXHRwcml2YXRlIGdldFN0YWNrKGZpbHRlciA9IEdvRmlsdGVyLk5PTkUpOiBFZGl0b3JOYXZpZ2F0aW9uU3RhY2sge1xuXHRcdHN3aXRjaCAoZmlsdGVyKSB7XG5cdFx0XHRjYXNlIEdvRmlsdGVyLk5PTkU6IHJldHVybiB0aGlzLnNlbGVjdGlvbnNTdGFjaztcblx0XHRcdGNhc2UgR29GaWx0ZXIuRURJVFM6IHJldHVybiB0aGlzLmVkaXRzU3RhY2s7XG5cdFx0XHRjYXNlIEdvRmlsdGVyLk5BVklHQVRJT046IHJldHVybiB0aGlzLm5hdmlnYXRpb25zU3RhY2s7XG5cdFx0fVxuXHR9XG5cblx0aGFuZGxlQWN0aXZlRWRpdG9yQ2hhbmdlKGVkaXRvclBhbmU/OiBJRWRpdG9yUGFuZSk6IHZvaWQge1xuXG5cdFx0Ly8gQWx3YXlzIHNlbmQgdG8gc2VsZWN0aW9ucyBuYXZpZ2F0aW9uIHN0YWNrXG5cdFx0dGhpcy5zZWxlY3Rpb25zU3RhY2subm90aWZ5TmF2aWdhdGlvbihlZGl0b3JQYW5lKTtcblx0fVxuXG5cdGhhbmRsZUFjdGl2ZUVkaXRvclNlbGVjdGlvbkNoYW5nZShlZGl0b3JQYW5lOiBJRWRpdG9yUGFuZVdpdGhTZWxlY3Rpb24sIGV2ZW50OiBJRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgcHJldmlvdXMgPSB0aGlzLnNlbGVjdGlvbnNTdGFjay5jdXJyZW50O1xuXG5cdFx0Ly8gQWx3YXlzIHNlbmQgdG8gc2VsZWN0aW9ucyBuYXZpZ2F0aW9uIHN0YWNrXG5cdFx0dGhpcy5zZWxlY3Rpb25zU3RhY2subm90aWZ5TmF2aWdhdGlvbihlZGl0b3JQYW5lLCBldmVudCk7XG5cblx0XHQvLyBDaGVjayBmb3IgZWRpdHNcblx0XHRpZiAoZXZlbnQucmVhc29uID09PSBFZGl0b3JQYW5lU2VsZWN0aW9uQ2hhbmdlUmVhc29uLkVESVQpIHtcblx0XHRcdHRoaXMuZWRpdHNTdGFjay5ub3RpZnlOYXZpZ2F0aW9uKGVkaXRvclBhbmUsIGV2ZW50KTtcblx0XHR9XG5cblx0XHQvLyBDaGVjayBmb3IgbmF2aWdhdGlvbnNcblx0XHQvL1xuXHRcdC8vIE5vdGU6IGlnbm9yZSBpZiBzZWxlY3Rpb25zIG5hdmlnYXRpb24gc3RhY2sgaXMgbmF2aWdhdGluZyBiZWNhdXNlXG5cdFx0Ly8gaW4gdGhhdCBjYXNlIHdlIGRvIG5vdCB3YW50IHRvIHJlY2VpdmUgcmVwZWF0ZWQgZW50cmllcyBpblxuXHRcdC8vIHRoZSBuYXZpZ2F0aW9uIHN0YWNrLlxuXHRcdGVsc2UgaWYgKFxuXHRcdFx0KGV2ZW50LnJlYXNvbiA9PT0gRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZVJlYXNvbi5OQVZJR0FUSU9OIHx8IGV2ZW50LnJlYXNvbiA9PT0gRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZVJlYXNvbi5KVU1QKSAmJlxuXHRcdFx0IXRoaXMuc2VsZWN0aW9uc1N0YWNrLmlzTmF2aWdhdGluZygpXG5cdFx0KSB7XG5cblx0XHRcdC8vIEEgXCJKVU1QXCIgbmF2aWdhdGlvbiBzZWxlY3Rpb24gY2hhbmdlIGFsd2F5cyBoYXMgYSBzb3VyY2UgYW5kXG5cdFx0XHQvLyB0YXJnZXQuIEFzIHN1Y2gsIHdlIGFkZCB0aGUgcHJldmlvdXMgZW50cnkgb2YgdGhlIHNlbGVjdGlvbnNcblx0XHRcdC8vIG5hdmlnYXRpb24gc3RhY2sgc28gdGhhdCBvdXIgbmF2aWdhdGlvbiBzdGFjayByZWNlaXZlcyBib3RoXG5cdFx0XHQvLyBlbnRyaWVzIHVubGVzcyB0aGUgdXNlciBpcyBjdXJyZW50bHkgbmF2aWdhdGluZy5cblxuXHRcdFx0aWYgKGV2ZW50LnJlYXNvbiA9PT0gRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZVJlYXNvbi5KVU1QICYmICF0aGlzLm5hdmlnYXRpb25zU3RhY2suaXNOYXZpZ2F0aW5nKCkpIHtcblx0XHRcdFx0aWYgKHByZXZpb3VzKSB7XG5cdFx0XHRcdFx0dGhpcy5uYXZpZ2F0aW9uc1N0YWNrLmFkZE9yUmVwbGFjZShwcmV2aW91cy5ncm91cElkLCBwcmV2aW91cy5lZGl0b3IsIHByZXZpb3VzLnNlbGVjdGlvbik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5uYXZpZ2F0aW9uc1N0YWNrLm5vdGlmeU5hdmlnYXRpb24oZWRpdG9yUGFuZSwgZXZlbnQpO1xuXHRcdH1cblx0fVxuXG5cdGNsZWFyKCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3Qgc3RhY2sgb2YgdGhpcy5zdGFja3MpIHtcblx0XHRcdHN0YWNrLmNsZWFyKCk7XG5cdFx0fVxuXHR9XG5cblx0cmVtb3ZlKGFyZzE6IEVkaXRvcklucHV0IHwgRmlsZUNoYW5nZXNFdmVudCB8IEZpbGVPcGVyYXRpb25FdmVudCB8IEdyb3VwSWRlbnRpZmllcik6IHZvaWQge1xuXHRcdGZvciAoY29uc3Qgc3RhY2sgb2YgdGhpcy5zdGFja3MpIHtcblx0XHRcdHN0YWNrLnJlbW92ZShhcmcxKTtcblx0XHR9XG5cdH1cblxuXHRtb3ZlKGV2ZW50OiBGaWxlT3BlcmF0aW9uRXZlbnQpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IHN0YWNrIG9mIHRoaXMuc3RhY2tzKSB7XG5cdFx0XHRzdGFjay5tb3ZlKGV2ZW50KTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgTm9PcEVkaXRvck5hdmlnYXRpb25TdGFja3MgaW1wbGVtZW50cyBJRWRpdG9yTmF2aWdhdGlvblN0YWNrcyB7XG5cdG9uRGlkQ2hhbmdlID0gRXZlbnQuTm9uZTtcblxuXHRjYW5Hb0ZvcndhcmQoKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuXHRhc3luYyBnb0ZvcndhcmQoKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0Y2FuR29CYWNrKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblx0YXN5bmMgZ29CYWNrKCk6IFByb21pc2U8dm9pZD4geyB9XG5cdGFzeW5jIGdvUHJldmlvdXMoKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0Y2FuR29MYXN0KCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblx0YXN5bmMgZ29MYXN0KCk6IFByb21pc2U8dm9pZD4geyB9XG5cblx0aGFuZGxlQWN0aXZlRWRpdG9yQ2hhbmdlKCk6IHZvaWQgeyB9XG5cdGhhbmRsZUFjdGl2ZUVkaXRvclNlbGVjdGlvbkNoYW5nZSgpOiB2b2lkIHsgfVxuXG5cdGNsZWFyKCk6IHZvaWQgeyB9XG5cdHJlbW92ZSgpOiB2b2lkIHsgfVxuXHRtb3ZlKCk6IHZvaWQgeyB9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHsgfVxufVxuXG5pbnRlcmZhY2UgSUVkaXRvck5hdmlnYXRpb25TdGFja0VudHJ5IHtcblx0Z3JvdXBJZDogR3JvdXBJZGVudGlmaWVyO1xuXHRlZGl0b3I6IEVkaXRvcklucHV0IHwgSVJlc291cmNlRWRpdG9ySW5wdXQ7XG5cdHNlbGVjdGlvbj86IElFZGl0b3JQYW5lU2VsZWN0aW9uO1xufVxuXG5leHBvcnQgY2xhc3MgRWRpdG9yTmF2aWdhdGlvblN0YWNrIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgTUFYX1NUQUNLX1NJWkUgPSA1MDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbWFwRWRpdG9yVG9EaXNwb3NhYmxlID0gbmV3IE1hcDxFZGl0b3JJbnB1dCwgRGlzcG9zYWJsZVN0b3JlPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1hcEdyb3VwVG9EaXNwb3NhYmxlID0gbmV3IE1hcDxHcm91cElkZW50aWZpZXIsIElEaXNwb3NhYmxlPigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9ySGVscGVyOiBFZGl0b3JIZWxwZXI7XG5cblx0cHJpdmF0ZSBzdGFjazogSUVkaXRvck5hdmlnYXRpb25TdGFja0VudHJ5W10gPSBbXTtcblxuXHRwcml2YXRlIGluZGV4ID0gLTE7XG5cdHByaXZhdGUgcHJldmlvdXNJbmRleCA9IC0xO1xuXG5cdHByaXZhdGUgbmF2aWdhdGluZzogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdHByaXZhdGUgY3VycmVudFNlbGVjdGlvblN0YXRlOiBFZGl0b3JTZWxlY3Rpb25TdGF0ZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRnZXQgY3VycmVudCgpOiBJRWRpdG9yTmF2aWdhdGlvblN0YWNrRW50cnkgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnN0YWNrW3RoaXMuaW5kZXhdO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXQgY3VycmVudChlbnRyeTogSUVkaXRvck5hdmlnYXRpb25TdGFja0VudHJ5IHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKGVudHJ5KSB7XG5cdFx0XHR0aGlzLnN0YWNrW3RoaXMuaW5kZXhdID0gZW50cnk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBmaWx0ZXI6IEdvRmlsdGVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgc2NvcGU6IEdvU2NvcGUsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuZWRpdG9ySGVscGVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRWRpdG9ySGVscGVyKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLnRyYWNlU3RhY2soKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubG9nU2VydmljZS5vbkRpZENoYW5nZUxvZ0xldmVsKCgpID0+IHRoaXMudHJhY2VTdGFjaygpKSk7XG5cdH1cblxuXHRwcml2YXRlIHRyYWNlU3RhY2soKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubG9nU2VydmljZS5nZXRMZXZlbCgpICE9PSBMb2dMZXZlbC5UcmFjZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVudHJ5TGFiZWxzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5zdGFjaykge1xuXHRcdFx0aWYgKHR5cGVvZiBlbnRyeS5zZWxlY3Rpb24/LmxvZyA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRlbnRyeUxhYmVscy5wdXNoKGAtIGdyb3VwOiAke2VudHJ5Lmdyb3VwSWR9LCBlZGl0b3I6ICR7ZW50cnkuZWRpdG9yLnJlc291cmNlPy50b1N0cmluZygpfSwgc2VsZWN0aW9uOiAke2VudHJ5LnNlbGVjdGlvbi5sb2coKX1gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVudHJ5TGFiZWxzLnB1c2goYC0gZ3JvdXA6ICR7ZW50cnkuZ3JvdXBJZH0sIGVkaXRvcjogJHtlbnRyeS5lZGl0b3IucmVzb3VyY2U/LnRvU3RyaW5nKCl9LCBzZWxlY3Rpb246IDxub25lPmApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChlbnRyeUxhYmVscy5sZW5ndGggPT09IDApIHtcblx0XHRcdHRoaXMudHJhY2UoYGluZGV4OiAke3RoaXMuaW5kZXh9LCBuYXZpZ2F0aW5nOiAke3RoaXMuaXNOYXZpZ2F0aW5nKCl9OiA8ZW1wdHk+YCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudHJhY2UoYGluZGV4OiAke3RoaXMuaW5kZXh9LCBuYXZpZ2F0aW5nOiAke3RoaXMuaXNOYXZpZ2F0aW5nKCl9XG4ke2VudHJ5TGFiZWxzLmpvaW4oJ1xcbicpfVxuXHRcdFx0YCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB0cmFjZShtc2c6IHN0cmluZywgZWRpdG9yOiBFZGl0b3JJbnB1dCB8IElSZXNvdXJjZUVkaXRvcklucHV0IHwgdW5kZWZpbmVkIHwgbnVsbCA9IG51bGwsIGV2ZW50PzogSUVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VFdmVudCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmxvZ1NlcnZpY2UuZ2V0TGV2ZWwoKSAhPT0gTG9nTGV2ZWwuVHJhY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgZmlsdGVyTGFiZWw6IHN0cmluZztcblx0XHRzd2l0Y2ggKHRoaXMuZmlsdGVyKSB7XG5cdFx0XHRjYXNlIEdvRmlsdGVyLk5PTkU6IGZpbHRlckxhYmVsID0gJ2dsb2JhbCc7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBHb0ZpbHRlci5FRElUUzogZmlsdGVyTGFiZWwgPSAnZWRpdHMnO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgR29GaWx0ZXIuTkFWSUdBVElPTjogZmlsdGVyTGFiZWwgPSAnbmF2aWdhdGlvbic7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdGxldCBzY29wZUxhYmVsOiBzdHJpbmc7XG5cdFx0c3dpdGNoICh0aGlzLnNjb3BlKSB7XG5cdFx0XHRjYXNlIEdvU2NvcGUuREVGQVVMVDogc2NvcGVMYWJlbCA9ICdkZWZhdWx0Jztcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIEdvU2NvcGUuRURJVE9SX0dST1VQOiBzY29wZUxhYmVsID0gJ2VkaXRvckdyb3VwJztcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIEdvU2NvcGUuRURJVE9SOiBzY29wZUxhYmVsID0gJ2VkaXRvcic7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdGlmIChlZGl0b3IgIT09IG51bGwpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgW0hpc3Rvcnkgc3RhY2sgJHtmaWx0ZXJMYWJlbH0tJHtzY29wZUxhYmVsfV06ICR7bXNnfSAoZWRpdG9yOiAke2VkaXRvcj8ucmVzb3VyY2U/LnRvU3RyaW5nKCl9LCBldmVudDogJHt0aGlzLnRyYWNlRXZlbnQoZXZlbnQpfSlgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBbSGlzdG9yeSBzdGFjayAke2ZpbHRlckxhYmVsfS0ke3Njb3BlTGFiZWx9XTogJHttc2d9YCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB0cmFjZUV2ZW50KGV2ZW50PzogSUVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VFdmVudCk6IHN0cmluZyB7XG5cdFx0aWYgKCFldmVudCkge1xuXHRcdFx0cmV0dXJuICc8bm9uZT4nO1xuXHRcdH1cblxuXHRcdHN3aXRjaCAoZXZlbnQucmVhc29uKSB7XG5cdFx0XHRjYXNlIEVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VSZWFzb24uRURJVDogcmV0dXJuICdlZGl0Jztcblx0XHRcdGNhc2UgRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZVJlYXNvbi5OQVZJR0FUSU9OOiByZXR1cm4gJ25hdmlnYXRpb24nO1xuXHRcdFx0Y2FzZSBFZGl0b3JQYW5lU2VsZWN0aW9uQ2hhbmdlUmVhc29uLkpVTVA6IHJldHVybiAnanVtcCc7XG5cdFx0XHRjYXNlIEVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VSZWFzb24uUFJPR1JBTU1BVElDOiByZXR1cm4gJ3Byb2dyYW1tYXRpYyc7XG5cdFx0XHRjYXNlIEVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VSZWFzb24uVVNFUjogcmV0dXJuICd1c2VyJztcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyR3JvdXBMaXN0ZW5lcnMoZ3JvdXBJZDogR3JvdXBJZGVudGlmaWVyKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLm1hcEdyb3VwVG9EaXNwb3NhYmxlLmhhcyhncm91cElkKSkge1xuXHRcdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5nZXRHcm91cChncm91cElkKTtcblx0XHRcdGlmIChncm91cCkge1xuXHRcdFx0XHR0aGlzLm1hcEdyb3VwVG9EaXNwb3NhYmxlLnNldChncm91cElkLCBncm91cC5vbldpbGxNb3ZlRWRpdG9yKGUgPT4gdGhpcy5vbldpbGxNb3ZlRWRpdG9yKGUpKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbldpbGxNb3ZlRWRpdG9yKGU6IElFZGl0b3JXaWxsTW92ZUV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy50cmFjZSgnb25XaWxsTW92ZUVkaXRvcigpJywgZS5lZGl0b3IpO1xuXG5cdFx0aWYgKHRoaXMuc2NvcGUgPT09IEdvU2NvcGUuRURJVE9SX0dST1VQKSB7XG5cdFx0XHRyZXR1cm47IC8vIGlnbm9yZSBtb3ZlIGV2ZW50cyBpZiBvdXIgc2NvcGUgaXMgZ3JvdXAgYmFzZWRcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMuc3RhY2spIHtcblx0XHRcdGlmIChlbnRyeS5ncm91cElkICE9PSBlLmdyb3VwSWQpIHtcblx0XHRcdFx0Y29udGludWU7IC8vIG5vdCBpbiB0aGUgZ3JvdXAgdGhhdCByZXBvcnRlZCB0aGUgZXZlbnRcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLmVkaXRvckhlbHBlci5tYXRjaGVzRWRpdG9yKGUuZWRpdG9yLCBlbnRyeS5lZGl0b3IpKSB7XG5cdFx0XHRcdGNvbnRpbnVlOyAvLyBub3QgdGhlIGVkaXRvciB0aGlzIGV2ZW50IGlzIGFib3V0XG5cdFx0XHR9XG5cblx0XHRcdC8vIFVwZGF0ZSB0byB0YXJnZXQgZ3JvdXBcblx0XHRcdGVudHJ5Lmdyb3VwSWQgPSBlLnRhcmdldDtcblx0XHR9XG5cdH1cblxuXHQvLyNyZWdpb24gU3RhY2sgTXV0YXRpb25cblxuXHRub3RpZnlOYXZpZ2F0aW9uKGVkaXRvclBhbmU6IElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkLCBldmVudD86IElFZGl0b3JQYW5lU2VsZWN0aW9uQ2hhbmdlRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLnRyYWNlKCdub3RpZnlOYXZpZ2F0aW9uKCknLCBlZGl0b3JQYW5lPy5pbnB1dCwgZXZlbnQpO1xuXG5cdFx0Y29uc3QgaXNTZWxlY3Rpb25Bd2FyZUVkaXRvclBhbmUgPSBpc0VkaXRvclBhbmVXaXRoU2VsZWN0aW9uKGVkaXRvclBhbmUpO1xuXHRcdGNvbnN0IGhhc1ZhbGlkRWRpdG9yID0gZWRpdG9yUGFuZT8uaW5wdXQgJiYgIWVkaXRvclBhbmUuaW5wdXQuaXNEaXNwb3NlZCgpO1xuXG5cdFx0Ly8gVHJlYXQgZWRpdG9yIGNoYW5nZXMgdGhhdCBoYXBwZW4gYXMgcGFydCBvZiBzdGFjayBuYXZpZ2F0aW9uIHNwZWNpYWxseVxuXHRcdC8vIHdlIGRvIG5vdCB3YW50IHRvIGFkZCBhIG5ldyBzdGFjayBlbnRyeSBhcyBhIG1hdHRlciBvZiBuYXZpZ2F0aW5nIHRoZVxuXHRcdC8vIHN0YWNrIGJ1dCB3ZSBuZWVkIHRvIGtlZXAgb3VyIGN1cnJlbnRFZGl0b3JTZWxlY3Rpb25TdGF0ZSB1cCB0byBkYXRlXG5cdFx0Ly8gd2l0aCB0aGUgbmF2aWd0aW9uIHRoYXQgb2NjdXJzLlxuXHRcdGlmICh0aGlzLm5hdmlnYXRpbmcpIHtcblx0XHRcdHRoaXMudHJhY2UoYG5vdGlmeU5hdmlnYXRpb24oKSBpZ25vcmluZyAobmF2aWdhdGluZylgLCBlZGl0b3JQYW5lPy5pbnB1dCwgZXZlbnQpO1xuXG5cdFx0XHRpZiAoaXNTZWxlY3Rpb25Bd2FyZUVkaXRvclBhbmUgJiYgaGFzVmFsaWRFZGl0b3IpIHtcblx0XHRcdFx0dGhpcy50cmFjZSgnbm90aWZ5TmF2aWdhdGlvbigpIHVwZGF0aW5nIGN1cnJlbnQgc2VsZWN0aW9uIHN0YXRlJywgZWRpdG9yUGFuZT8uaW5wdXQsIGV2ZW50KTtcblxuXHRcdFx0XHR0aGlzLmN1cnJlbnRTZWxlY3Rpb25TdGF0ZSA9IG5ldyBFZGl0b3JTZWxlY3Rpb25TdGF0ZSh7IGdyb3VwSWQ6IGVkaXRvclBhbmUuZ3JvdXAuaWQsIGVkaXRvcjogZWRpdG9yUGFuZS5pbnB1dCB9LCBlZGl0b3JQYW5lLmdldFNlbGVjdGlvbigpLCBldmVudD8ucmVhc29uKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudHJhY2UoJ25vdGlmeU5hdmlnYXRpb24oKSBkcm9wcGluZyBjdXJyZW50IHNlbGVjdGlvbiBzdGF0ZScsIGVkaXRvclBhbmU/LmlucHV0LCBldmVudCk7XG5cblx0XHRcdFx0dGhpcy5jdXJyZW50U2VsZWN0aW9uU3RhdGUgPSB1bmRlZmluZWQ7IC8vIHdlIG5hdmlnYXRlZCB0byBhIG5vbi1zZWxlY3Rpb24gYXdhcmUgb3IgZGlzcG9zZWQgZWRpdG9yXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gTm9ybWFsIG5hdmlnYXRpb24gbm90IHBhcnQgb2Ygc3RhY2sgbmF2aWdhdGlvblxuXHRcdGVsc2Uge1xuXHRcdFx0dGhpcy50cmFjZShgbm90aWZ5TmF2aWdhdGlvbigpIG5vdCBpZ25vcmluZ2AsIGVkaXRvclBhbmU/LmlucHV0LCBldmVudCk7XG5cblx0XHRcdC8vIE5hdmlnYXRpb24gaW5zaWRlIHNlbGVjdGlvbiBhd2FyZSBlZGl0b3Jcblx0XHRcdGlmIChpc1NlbGVjdGlvbkF3YXJlRWRpdG9yUGFuZSAmJiBoYXNWYWxpZEVkaXRvcikge1xuXHRcdFx0XHR0aGlzLm9uU2VsZWN0aW9uQXdhcmVFZGl0b3JOYXZpZ2F0aW9uKGVkaXRvclBhbmUuZ3JvdXAuaWQsIGVkaXRvclBhbmUuaW5wdXQsIGVkaXRvclBhbmUuZ2V0U2VsZWN0aW9uKCksIGV2ZW50KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gTmF2aWdhdGlvbiB0byBub24tc2VsZWN0aW9uIGF3YXJlIG9yIGRpc3Bvc2VkIGVkaXRvclxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHRoaXMuY3VycmVudFNlbGVjdGlvblN0YXRlID0gdW5kZWZpbmVkOyAvLyBhdCB0aGlzIHRpbWUgd2UgaGF2ZSBubyBhY3RpdmUgc2VsZWN0aW9uIGF3YXJlIGVkaXRvclxuXG5cdFx0XHRcdGlmIChoYXNWYWxpZEVkaXRvcikge1xuXHRcdFx0XHRcdHRoaXMub25Ob25TZWxlY3Rpb25Bd2FyZUVkaXRvck5hdmlnYXRpb24oZWRpdG9yUGFuZS5ncm91cC5pZCwgZWRpdG9yUGFuZS5pbnB1dCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uU2VsZWN0aW9uQXdhcmVFZGl0b3JOYXZpZ2F0aW9uKGdyb3VwSWQ6IEdyb3VwSWRlbnRpZmllciwgZWRpdG9yOiBFZGl0b3JJbnB1dCwgc2VsZWN0aW9uOiBJRWRpdG9yUGFuZVNlbGVjdGlvbiB8IHVuZGVmaW5lZCwgZXZlbnQ/OiBJRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY3VycmVudD8uZ3JvdXBJZCA9PT0gZ3JvdXBJZCAmJiAhc2VsZWN0aW9uICYmIHRoaXMuZWRpdG9ySGVscGVyLm1hdGNoZXNFZGl0b3IodGhpcy5jdXJyZW50LmVkaXRvciwgZWRpdG9yKSkge1xuXHRcdFx0cmV0dXJuOyAvLyBkbyBub3QgcHVzaCBzYW1lIGVkaXRvciBpbnB1dCBhZ2FpbiBvZiBzYW1lIGdyb3VwIGlmIHdlIGhhdmUgbm8gdmFsaWQgc2VsZWN0aW9uXG5cdFx0fVxuXG5cdFx0dGhpcy50cmFjZSgnb25TZWxlY3Rpb25Bd2FyZUVkaXRvck5hdmlnYXRpb24oKScsIGVkaXRvciwgZXZlbnQpO1xuXG5cdFx0Y29uc3Qgc3RhdGVDYW5kaWRhdGUgPSBuZXcgRWRpdG9yU2VsZWN0aW9uU3RhdGUoeyBncm91cElkLCBlZGl0b3IgfSwgc2VsZWN0aW9uLCBldmVudD8ucmVhc29uKTtcblxuXHRcdC8vIEFkZCB0byBzdGFjayBpZiB3ZSBkb250IGhhdmUgYSBjdXJyZW50IHN0YXRlIG9yIHRoaXMgbmV3IHN0YXRlIGp1c3RpZmllcyBhIHB1c2hcblx0XHRpZiAoIXRoaXMuY3VycmVudFNlbGVjdGlvblN0YXRlIHx8IHRoaXMuY3VycmVudFNlbGVjdGlvblN0YXRlLmp1c3RpZmllc05ld05hdmlnYXRpb25FbnRyeShzdGF0ZUNhbmRpZGF0ZSkpIHtcblx0XHRcdHRoaXMuZG9BZGQoZ3JvdXBJZCwgZWRpdG9yLCBzdGF0ZUNhbmRpZGF0ZS5zZWxlY3Rpb24pO1xuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZSB3ZSByZXBsYWNlIHRoZSBjdXJyZW50IHN0YWNrIGVudHJ5IHdpdGggdGhpcyBvbmVcblx0XHRlbHNlIHtcblx0XHRcdHRoaXMuZG9SZXBsYWNlKGdyb3VwSWQsIGVkaXRvciwgc3RhdGVDYW5kaWRhdGUuc2VsZWN0aW9uKTtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgb3VyIGN1cnJlbnQgbmF2aWdhdGlvbiBlZGl0b3Igc3RhdGVcblx0XHR0aGlzLmN1cnJlbnRTZWxlY3Rpb25TdGF0ZSA9IHN0YXRlQ2FuZGlkYXRlO1xuXHR9XG5cblx0cHJpdmF0ZSBvbk5vblNlbGVjdGlvbkF3YXJlRWRpdG9yTmF2aWdhdGlvbihncm91cElkOiBHcm91cElkZW50aWZpZXIsIGVkaXRvcjogRWRpdG9ySW5wdXQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jdXJyZW50Py5ncm91cElkID09PSBncm91cElkICYmIHRoaXMuZWRpdG9ySGVscGVyLm1hdGNoZXNFZGl0b3IodGhpcy5jdXJyZW50LmVkaXRvciwgZWRpdG9yKSkge1xuXHRcdFx0cmV0dXJuOyAvLyBkbyBub3QgcHVzaCBzYW1lIGVkaXRvciBpbnB1dCBhZ2FpbiBvZiBzYW1lIGdyb3VwXG5cdFx0fVxuXG5cdFx0dGhpcy50cmFjZSgnb25Ob25TZWxlY3Rpb25Bd2FyZUVkaXRvck5hdmlnYXRpb24oKScsIGVkaXRvcik7XG5cblx0XHR0aGlzLmRvQWRkKGdyb3VwSWQsIGVkaXRvcik7XG5cdH1cblxuXHRwcml2YXRlIGRvQWRkKGdyb3VwSWQ6IEdyb3VwSWRlbnRpZmllciwgZWRpdG9yOiBFZGl0b3JJbnB1dCB8IElSZXNvdXJjZUVkaXRvcklucHV0LCBzZWxlY3Rpb24/OiBJRWRpdG9yUGFuZVNlbGVjdGlvbik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5uYXZpZ2F0aW5nKSB7XG5cdFx0XHR0aGlzLmFkZE9yUmVwbGFjZShncm91cElkLCBlZGl0b3IsIHNlbGVjdGlvbik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBkb1JlcGxhY2UoZ3JvdXBJZDogR3JvdXBJZGVudGlmaWVyLCBlZGl0b3I6IEVkaXRvcklucHV0IHwgSVJlc291cmNlRWRpdG9ySW5wdXQsIHNlbGVjdGlvbj86IElFZGl0b3JQYW5lU2VsZWN0aW9uKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLm5hdmlnYXRpbmcpIHtcblx0XHRcdHRoaXMuYWRkT3JSZXBsYWNlKGdyb3VwSWQsIGVkaXRvciwgc2VsZWN0aW9uLCB0cnVlIC8qIGZvcmNlIHJlcGxhY2UgKi8pO1xuXHRcdH1cblx0fVxuXG5cdGFkZE9yUmVwbGFjZShncm91cElkOiBHcm91cElkZW50aWZpZXIsIGVkaXRvckNhbmRpZGF0ZTogRWRpdG9ySW5wdXQgfCBJUmVzb3VyY2VFZGl0b3JJbnB1dCwgc2VsZWN0aW9uPzogSUVkaXRvclBhbmVTZWxlY3Rpb24sIGZvcmNlUmVwbGFjZT86IGJvb2xlYW4pOiB2b2lkIHtcblxuXHRcdC8vIEVuc3VyZSB3ZSBsaXN0ZW4gdG8gY2hhbmdlcyBpbiBncm91cFxuXHRcdHRoaXMucmVnaXN0ZXJHcm91cExpc3RlbmVycyhncm91cElkKTtcblxuXHRcdC8vIENoZWNrIHdoZXRoZXIgdG8gcmVwbGFjZSBhbiBleGlzdGluZyBlbnRyeSBvciBub3Rcblx0XHRsZXQgcmVwbGFjZSA9IGZhbHNlO1xuXHRcdGlmICh0aGlzLmN1cnJlbnQpIHtcblx0XHRcdGlmIChmb3JjZVJlcGxhY2UpIHtcblx0XHRcdFx0cmVwbGFjZSA9IHRydWU7IC8vIHJlcGxhY2UgaWYgd2UgYXJlIGZvcmNlZCB0b1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLnNob3VsZFJlcGxhY2VTdGFja0VudHJ5KHRoaXMuY3VycmVudCwgeyBncm91cElkLCBlZGl0b3I6IGVkaXRvckNhbmRpZGF0ZSwgc2VsZWN0aW9uIH0pKSB7XG5cdFx0XHRcdHJlcGxhY2UgPSB0cnVlOyAvLyByZXBsYWNlIGlmIHRoZSBncm91cCAmIGlucHV0IGlzIHRoZSBzYW1lIGFuZCBzZWxlY3Rpb24gaW5kaWNhdGVzIGFzIHN1Y2hcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLmVkaXRvckhlbHBlci5wcmVmZXJSZXNvdXJjZUVkaXRvcklucHV0KGVkaXRvckNhbmRpZGF0ZSk7XG5cdFx0aWYgKCFlZGl0b3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAocmVwbGFjZSkge1xuXHRcdFx0dGhpcy50cmFjZSgncmVwbGFjZSgpJywgZWRpdG9yKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy50cmFjZSgnYWRkKCknLCBlZGl0b3IpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5ld1N0YWNrRW50cnk6IElFZGl0b3JOYXZpZ2F0aW9uU3RhY2tFbnRyeSA9IHsgZ3JvdXBJZCwgZWRpdG9yLCBzZWxlY3Rpb24gfTtcblxuXHRcdC8vIFJlcGxhY2UgYXQgY3VycmVudCBwb3NpdGlvblxuXHRcdGNvbnN0IHJlbW92ZWRFbnRyaWVzOiBJRWRpdG9yTmF2aWdhdGlvblN0YWNrRW50cnlbXSA9IFtdO1xuXHRcdGlmIChyZXBsYWNlKSB7XG5cdFx0XHRpZiAodGhpcy5jdXJyZW50KSB7XG5cdFx0XHRcdHJlbW92ZWRFbnRyaWVzLnB1c2godGhpcy5jdXJyZW50KTtcblx0XHRcdH1cblx0XHRcdHRoaXMuY3VycmVudCA9IG5ld1N0YWNrRW50cnk7XG5cdFx0fVxuXG5cdFx0Ly8gQWRkIHRvIHN0YWNrIGF0IGN1cnJlbnQgcG9zaXRpb25cblx0XHRlbHNlIHtcblxuXHRcdFx0Ly8gSWYgd2UgYXJlIG5vdCBhdCB0aGUgZW5kIG9mIGhpc3RvcnksIHdlIHJlbW92ZSBhbnl0aGluZyBhZnRlclxuXHRcdFx0aWYgKHRoaXMuc3RhY2subGVuZ3RoID4gdGhpcy5pbmRleCArIDEpIHtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IHRoaXMuaW5kZXggKyAxOyBpIDwgdGhpcy5zdGFjay5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdHJlbW92ZWRFbnRyaWVzLnB1c2godGhpcy5zdGFja1tpXSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLnN0YWNrID0gdGhpcy5zdGFjay5zbGljZSgwLCB0aGlzLmluZGV4ICsgMSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEluc2VydCBlbnRyeSBhdCBpbmRleFxuXHRcdFx0dGhpcy5zdGFjay5zcGxpY2UodGhpcy5pbmRleCArIDEsIDAsIG5ld1N0YWNrRW50cnkpO1xuXG5cdFx0XHQvLyBDaGVjayBmb3IgbGltaXRcblx0XHRcdGlmICh0aGlzLnN0YWNrLmxlbmd0aCA+IEVkaXRvck5hdmlnYXRpb25TdGFjay5NQVhfU1RBQ0tfU0laRSkge1xuXHRcdFx0XHRyZW1vdmVkRW50cmllcy5wdXNoKHRoaXMuc3RhY2suc2hpZnQoKSEpOyAvLyByZW1vdmUgZmlyc3Rcblx0XHRcdFx0aWYgKHRoaXMucHJldmlvdXNJbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5wcmV2aW91c0luZGV4LS07XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuc2V0SW5kZXgodGhpcy5pbmRleCArIDEsIHRydWUgLyogc2tpcCBldmVudCwgd2UgZmlyZSBpdCBsYXRlciAqLyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQ2xlYXIgZWRpdG9yIGxpc3RlbmVycyBmcm9tIHJlbW92ZWQgZW50cmllc1xuXHRcdGZvciAoY29uc3QgcmVtb3ZlZEVudHJ5IG9mIHJlbW92ZWRFbnRyaWVzKSB7XG5cdFx0XHR0aGlzLmVkaXRvckhlbHBlci5jbGVhck9uRWRpdG9yRGlzcG9zZShyZW1vdmVkRW50cnkuZWRpdG9yLCB0aGlzLm1hcEVkaXRvclRvRGlzcG9zYWJsZSk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVtb3ZlIHRoaXMgZnJvbSB0aGUgc3RhY2sgdW5sZXNzIHRoZSBzdGFjayBpbnB1dCBpcyBhIHJlc291cmNlXG5cdFx0Ly8gdGhhdCBjYW4gZWFzaWx5IGJlIHJlc3RvcmVkIGV2ZW4gd2hlbiB0aGUgaW5wdXQgZ2V0cyBkaXNwb3NlZFxuXHRcdGlmIChpc0VkaXRvcklucHV0KGVkaXRvcikpIHtcblx0XHRcdHRoaXMuZWRpdG9ySGVscGVyLm9uRWRpdG9yRGlzcG9zZShlZGl0b3IsICgpID0+IHRoaXMucmVtb3ZlKGVkaXRvciksIHRoaXMubWFwRWRpdG9yVG9EaXNwb3NhYmxlKTtcblx0XHR9XG5cblx0XHQvLyBFdmVudFxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgc2hvdWxkUmVwbGFjZVN0YWNrRW50cnkoZW50cnk6IElFZGl0b3JOYXZpZ2F0aW9uU3RhY2tFbnRyeSwgY2FuZGlkYXRlOiBJRWRpdG9yTmF2aWdhdGlvblN0YWNrRW50cnkpOiBib29sZWFuIHtcblx0XHRpZiAoZW50cnkuZ3JvdXBJZCAhPT0gY2FuZGlkYXRlLmdyb3VwSWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gZGlmZmVyZW50IGdyb3VwXG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmVkaXRvckhlbHBlci5tYXRjaGVzRWRpdG9yKGVudHJ5LmVkaXRvciwgY2FuZGlkYXRlLmVkaXRvcikpIHtcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gZGlmZmVyZW50IGVkaXRvclxuXHRcdH1cblxuXHRcdGlmICghZW50cnkuc2VsZWN0aW9uKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gYWx3YXlzIHJlcGxhY2Ugd2hlbiB3ZSBoYXZlIG5vIHNwZWNpZmljIHNlbGVjdGlvbiB5ZXRcblx0XHR9XG5cblx0XHRpZiAoIWNhbmRpZGF0ZS5zZWxlY3Rpb24pIHtcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gb3RoZXJ3aXNlLCBwcmVmZXIgdG8ga2VlcCBleGlzdGluZyBzcGVjaWZpYyBzZWxlY3Rpb24gb3ZlciBuZXcgdW5zcGVjaWZpYyBvbmVcblx0XHR9XG5cblx0XHQvLyBGaW5hbGx5LCByZXBsYWNlIHdoZW4gc2VsZWN0aW9ucyBhcmUgY29uc2lkZXJlZCBpZGVudGljYWxcblx0XHRyZXR1cm4gZW50cnkuc2VsZWN0aW9uLmNvbXBhcmUoY2FuZGlkYXRlLnNlbGVjdGlvbikgPT09IEVkaXRvclBhbmVTZWxlY3Rpb25Db21wYXJlUmVzdWx0LklERU5USUNBTDtcblx0fVxuXG5cdG1vdmUoZXZlbnQ6IEZpbGVPcGVyYXRpb25FdmVudCk6IHZvaWQge1xuXHRcdGlmIChldmVudC5pc09wZXJhdGlvbihGaWxlT3BlcmF0aW9uLk1PVkUpKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMuc3RhY2spIHtcblx0XHRcdFx0aWYgKHRoaXMuZWRpdG9ySGVscGVyLm1hdGNoZXNFZGl0b3IoZXZlbnQsIGVudHJ5LmVkaXRvcikpIHtcblx0XHRcdFx0XHRlbnRyeS5lZGl0b3IgPSB7IHJlc291cmNlOiBldmVudC50YXJnZXQucmVzb3VyY2UgfTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHJlbW92ZShhcmcxOiBFZGl0b3JJbnB1dCB8IEZpbGVDaGFuZ2VzRXZlbnQgfCBGaWxlT3BlcmF0aW9uRXZlbnQgfCBHcm91cElkZW50aWZpZXIpOiB2b2lkIHtcblx0XHRjb25zdCBwcmV2aW91c1N0YWNrU2l6ZSA9IHRoaXMuc3RhY2subGVuZ3RoO1xuXG5cdFx0Ly8gUmVtb3ZlIGFsbCBzdGFjayBlbnRyaWVzIHRoYXQgbWF0Y2ggYGFyZzFgXG5cdFx0dGhpcy5zdGFjayA9IHRoaXMuc3RhY2suZmlsdGVyKGVudHJ5ID0+IHtcblx0XHRcdGNvbnN0IG1hdGNoZXMgPSB0eXBlb2YgYXJnMSA9PT0gJ251bWJlcicgPyBlbnRyeS5ncm91cElkID09PSBhcmcxIDogdGhpcy5lZGl0b3JIZWxwZXIubWF0Y2hlc0VkaXRvcihhcmcxLCBlbnRyeS5lZGl0b3IpO1xuXG5cdFx0XHQvLyBDbGVhbnVwIGFueSBsaXN0ZW5lcnMgYXNzb2NpYXRlZCB3aXRoIHRoZSBpbnB1dCB3aGVuIHJlbW92aW5nXG5cdFx0XHRpZiAobWF0Y2hlcykge1xuXHRcdFx0XHR0aGlzLmVkaXRvckhlbHBlci5jbGVhck9uRWRpdG9yRGlzcG9zZShlbnRyeS5lZGl0b3IsIHRoaXMubWFwRWRpdG9yVG9EaXNwb3NhYmxlKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuICFtYXRjaGVzO1xuXHRcdH0pO1xuXG5cdFx0aWYgKHByZXZpb3VzU3RhY2tTaXplID09PSB0aGlzLnN0YWNrLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuOyAvLyBub3RoaW5nIHJlbW92ZWRcblx0XHR9XG5cblx0XHQvLyBHaXZlbiB3ZSBqdXN0IHJlbW92ZWQgZW50cmllcywgd2UgbmVlZCB0byBtYWtlIHN1cmVcblx0XHQvLyB0byByZW1vdmUgZW50cmllcyB0aGF0IGFyZSBub3cgaWRlbnRpY2FsIGFuZCBuZXh0XG5cdFx0Ly8gdG8gZWFjaCBvdGhlciB0byBwcmV2ZW50IG5vLW9wIG5hdmlnYXRpb25zLlxuXHRcdHRoaXMuZmxhdHRlbigpO1xuXG5cdFx0Ly8gUmVzZXQgaW5kZWNlc1xuXHRcdHRoaXMuaW5kZXggPSB0aGlzLnN0YWNrLmxlbmd0aCAtIDE7XG5cdFx0dGhpcy5wcmV2aW91c0luZGV4ID0gLTE7XG5cblx0XHQvLyBDbGVhciBncm91cCBsaXN0ZW5lclxuXHRcdGlmICh0eXBlb2YgYXJnMSA9PT0gJ251bWJlcicpIHtcblx0XHRcdHRoaXMubWFwR3JvdXBUb0Rpc3Bvc2FibGUuZ2V0KGFyZzEpPy5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLm1hcEdyb3VwVG9EaXNwb3NhYmxlLmRlbGV0ZShhcmcxKTtcblx0XHR9XG5cblx0XHQvLyBFdmVudFxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgZmxhdHRlbigpOiB2b2lkIHtcblx0XHRjb25zdCBmbGF0dGVuZWRTdGFjazogSUVkaXRvck5hdmlnYXRpb25TdGFja0VudHJ5W10gPSBbXTtcblxuXHRcdGxldCBwcmV2aW91c0VudHJ5OiBJRWRpdG9yTmF2aWdhdGlvblN0YWNrRW50cnkgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLnN0YWNrKSB7XG5cdFx0XHRpZiAocHJldmlvdXNFbnRyeSAmJiB0aGlzLnNob3VsZFJlcGxhY2VTdGFja0VudHJ5KGVudHJ5LCBwcmV2aW91c0VudHJ5KSkge1xuXHRcdFx0XHRjb250aW51ZTsgLy8gc2tpcCBvdmVyIGVudHJ5IHdoZW4gaXQgaXMgY29uc2lkZXJlZCB0aGUgc2FtZVxuXHRcdFx0fVxuXG5cdFx0XHRwcmV2aW91c0VudHJ5ID0gZW50cnk7XG5cdFx0XHRmbGF0dGVuZWRTdGFjay5wdXNoKGVudHJ5KTtcblx0XHR9XG5cblx0XHR0aGlzLnN0YWNrID0gZmxhdHRlbmVkU3RhY2s7XG5cdH1cblxuXHRjbGVhcigpOiB2b2lkIHtcblx0XHR0aGlzLmluZGV4ID0gLTE7XG5cdFx0dGhpcy5wcmV2aW91c0luZGV4ID0gLTE7XG5cdFx0dGhpcy5zdGFjay5zcGxpY2UoMCk7XG5cblx0XHRmb3IgKGNvbnN0IFssIGRpc3Bvc2FibGVdIG9mIHRoaXMubWFwRWRpdG9yVG9EaXNwb3NhYmxlKSB7XG5cdFx0XHRkaXNwb3NlKGRpc3Bvc2FibGUpO1xuXHRcdH1cblx0XHR0aGlzLm1hcEVkaXRvclRvRGlzcG9zYWJsZS5jbGVhcigpO1xuXG5cdFx0Zm9yIChjb25zdCBbLCBkaXNwb3NhYmxlXSBvZiB0aGlzLm1hcEdyb3VwVG9EaXNwb3NhYmxlKSB7XG5cdFx0XHRkaXNwb3NlKGRpc3Bvc2FibGUpO1xuXHRcdH1cblx0XHR0aGlzLm1hcEdyb3VwVG9EaXNwb3NhYmxlLmNsZWFyKCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMuY2xlYXIoKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBOYXZpZ2F0aW9uXG5cblx0Y2FuR29Gb3J3YXJkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnN0YWNrLmxlbmd0aCA+IHRoaXMuaW5kZXggKyAxO1xuXHR9XG5cblx0YXN5bmMgZ29Gb3J3YXJkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG5hdmlnYXRlZCA9IGF3YWl0IHRoaXMubWF5YmVHb0N1cnJlbnQoKTtcblx0XHRpZiAobmF2aWdhdGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmNhbkdvRm9yd2FyZCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXRJbmRleCh0aGlzLmluZGV4ICsgMSk7XG5cdFx0cmV0dXJuIHRoaXMubmF2aWdhdGUoKTtcblx0fVxuXG5cdGNhbkdvQmFjaygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5pbmRleCA+IDA7XG5cdH1cblxuXHRhc3luYyBnb0JhY2soKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbmF2aWdhdGVkID0gYXdhaXQgdGhpcy5tYXliZUdvQ3VycmVudCgpO1xuXHRcdGlmIChuYXZpZ2F0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuY2FuR29CYWNrKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnNldEluZGV4KHRoaXMuaW5kZXggLSAxKTtcblx0XHRyZXR1cm4gdGhpcy5uYXZpZ2F0ZSgpO1xuXHR9XG5cblx0YXN5bmMgZ29QcmV2aW91cygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBuYXZpZ2F0ZWQgPSBhd2FpdCB0aGlzLm1heWJlR29DdXJyZW50KCk7XG5cdFx0aWYgKG5hdmlnYXRlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIElmIHdlIG5ldmVyIG5hdmlnYXRlZCwganVzdCBnbyBiYWNrXG5cdFx0aWYgKHRoaXMucHJldmlvdXNJbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybiB0aGlzLmdvQmFjaygpO1xuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZSBqdW1wIHRvIHByZXZpb3VzIHN0YWNrIGVudHJ5XG5cdFx0dGhpcy5zZXRJbmRleCh0aGlzLnByZXZpb3VzSW5kZXgpO1xuXHRcdHJldHVybiB0aGlzLm5hdmlnYXRlKCk7XG5cdH1cblxuXHRjYW5Hb0xhc3QoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuc3RhY2subGVuZ3RoID4gMDtcblx0fVxuXG5cdGFzeW5jIGdvTGFzdCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuY2FuR29MYXN0KCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnNldEluZGV4KHRoaXMuc3RhY2subGVuZ3RoIC0gMSk7XG5cdFx0cmV0dXJuIHRoaXMubmF2aWdhdGUoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgbWF5YmVHb0N1cnJlbnQoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cblx0XHQvLyBXaGVuIHRoaXMgbmF2aWdhdGlvbiBzdGFjayB3b3JrcyB3aXRoIGEgc3BlY2lmaWNcblx0XHQvLyBmaWx0ZXIgd2hlcmUgbm90IGV2ZXJ5IHNlbGVjdGlvbiBjaGFuZ2UgaXMgYWRkZWRcblx0XHQvLyB0byB0aGUgc3RhY2ssIHdlIHdhbnQgdG8gZmlyc3QgcmV2ZWFsIHRoZSBjdXJyZW50XG5cdFx0Ly8gc2VsZWN0aW9uIGJlZm9yZSBhdHRlbXB0aW5nIHRvIG5hdmlnYXRlIGluIHRoZVxuXHRcdC8vIHN0YWNrLlxuXG5cdFx0aWYgKHRoaXMuZmlsdGVyID09PSBHb0ZpbHRlci5OT05FKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIG9ubHkgYXBwbGllcyB3aGVuICB3ZSBhcmUgYSBmaWx0ZXJkIHN0YWNrXG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaXNDdXJyZW50U2VsZWN0aW9uQWN0aXZlKCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gd2UgYXJlIGF0IHRoZSBjdXJyZW50IG5hdmlnYXRpb24gc3RvcFxuXHRcdH1cblxuXHRcdC8vIEdvIHRvIGN1cnJlbnQgc2VsZWN0aW9uXG5cdFx0YXdhaXQgdGhpcy5uYXZpZ2F0ZSgpO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGlzQ3VycmVudFNlbGVjdGlvbkFjdGl2ZSgpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuY3VycmVudD8uc2VsZWN0aW9uKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIHdlIG5lZWQgYSBjdXJyZW50IHNlbGVjdGlvblxuXHRcdH1cblxuXHRcdGNvbnN0IHBhbmUgPSB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRpZiAoIWlzRWRpdG9yUGFuZVdpdGhTZWxlY3Rpb24ocGFuZSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gd2UgbmVlZCBhbiBhY3RpdmUgZWRpdG9yIHBhbmUgd2l0aCBzZWxlY3Rpb24gc3VwcG9ydFxuXHRcdH1cblxuXHRcdGlmIChwYW5lLmdyb3VwLmlkICE9PSB0aGlzLmN1cnJlbnQuZ3JvdXBJZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyB3ZSBuZWVkIG1hdGNoaW5nIGdyb3Vwc1xuXHRcdH1cblxuXHRcdGlmICghcGFuZS5pbnB1dCB8fCAhdGhpcy5lZGl0b3JIZWxwZXIubWF0Y2hlc0VkaXRvcihwYW5lLmlucHV0LCB0aGlzLmN1cnJlbnQuZWRpdG9yKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyB3ZSBuZWVkIG1hdGNoaW5nIGVkaXRvcnNcblx0XHR9XG5cblx0XHRjb25zdCBwYW5lU2VsZWN0aW9uID0gcGFuZS5nZXRTZWxlY3Rpb24oKTtcblx0XHRpZiAoIXBhbmVTZWxlY3Rpb24pIHtcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gd2UgbmVlZCBhIHNlbGVjdGlvbiB0byBjb21wYXJlIHdpdGhcblx0XHR9XG5cblx0XHRyZXR1cm4gcGFuZVNlbGVjdGlvbi5jb21wYXJlKHRoaXMuY3VycmVudC5zZWxlY3Rpb24pID09PSBFZGl0b3JQYW5lU2VsZWN0aW9uQ29tcGFyZVJlc3VsdC5JREVOVElDQUw7XG5cdH1cblxuXHRwcml2YXRlIHNldEluZGV4KG5ld0luZGV4OiBudW1iZXIsIHNraXBFdmVudD86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLnByZXZpb3VzSW5kZXggPSB0aGlzLmluZGV4O1xuXHRcdHRoaXMuaW5kZXggPSBuZXdJbmRleDtcblxuXHRcdC8vIEV2ZW50XG5cdFx0aWYgKCFza2lwRXZlbnQpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG5hdmlnYXRlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubmF2aWdhdGluZyA9IHRydWU7XG5cblx0XHR0cnkge1xuXHRcdFx0aWYgKHRoaXMuY3VycmVudCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmRvTmF2aWdhdGUodGhpcy5jdXJyZW50KTtcblx0XHRcdH1cblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5uYXZpZ2F0aW5nID0gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBkb05hdmlnYXRlKGxvY2F0aW9uOiBJRWRpdG9yTmF2aWdhdGlvblN0YWNrRW50cnkpOiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPiB7XG5cdFx0bGV0IG9wdGlvbnM6IElFZGl0b3JPcHRpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuXHRcdC8vIEFwcGx5IHNlbGVjdGlvbiBpZiBhbnlcblx0XHRpZiAobG9jYXRpb24uc2VsZWN0aW9uKSB7XG5cdFx0XHRvcHRpb25zID0gbG9jYXRpb24uc2VsZWN0aW9uLnJlc3RvcmUob3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0aWYgKGlzRWRpdG9ySW5wdXQobG9jYXRpb24uZWRpdG9yKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKGxvY2F0aW9uLmVkaXRvciwgb3B0aW9ucywgbG9jYXRpb24uZ3JvdXBJZCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdC4uLmxvY2F0aW9uLmVkaXRvcixcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0Li4ubG9jYXRpb24uZWRpdG9yLm9wdGlvbnMsXG5cdFx0XHRcdC4uLm9wdGlvbnNcblx0XHRcdH1cblx0XHR9LCBsb2NhdGlvbi5ncm91cElkKTtcblx0fVxuXG5cdGlzTmF2aWdhdGluZygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5uYXZpZ2F0aW5nO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG59XG5cbmNsYXNzIEVkaXRvckhlbHBlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElQYXRoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHBhdGhTZXJ2aWNlOiBJUGF0aFNlcnZpY2Vcblx0KSB7IH1cblxuXHRwcmVmZXJSZXNvdXJjZUVkaXRvcklucHV0KGVkaXRvcjogRWRpdG9ySW5wdXQpOiBFZGl0b3JJbnB1dCB8IElSZXNvdXJjZUVkaXRvcklucHV0O1xuXHRwcmVmZXJSZXNvdXJjZUVkaXRvcklucHV0KGVkaXRvcjogSVJlc291cmNlRWRpdG9ySW5wdXQpOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZDtcblx0cHJlZmVyUmVzb3VyY2VFZGl0b3JJbnB1dChlZGl0b3I6IEVkaXRvcklucHV0IHwgSVJlc291cmNlRWRpdG9ySW5wdXQpOiBFZGl0b3JJbnB1dCB8IElSZXNvdXJjZUVkaXRvcklucHV0IHwgdW5kZWZpbmVkO1xuXHRwcmVmZXJSZXNvdXJjZUVkaXRvcklucHV0KGVkaXRvcjogRWRpdG9ySW5wdXQgfCBJUmVzb3VyY2VFZGl0b3JJbnB1dCk6IEVkaXRvcklucHV0IHwgSVJlc291cmNlRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHJlc291cmNlID0gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRPcmlnaW5hbFVyaShlZGl0b3IpO1xuXG5cdFx0Ly8gRm9yIG5vdywgb25seSBwcmVmZXIgd2VsbCBrbm93biBzY2hlbWVzIHRoYXQgd2UgY29udHJvbCB0byBwcmV2ZW50XG5cdFx0Ly8gaXNzdWVzIHN1Y2ggYXMgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzg1MjA0XG5cdFx0Ly8gZnJvbSBiZWluZyB1c2VkIGFzIHJlc291cmNlIGlucHV0c1xuXHRcdC8vIHJlc291cmNlIGlucHV0cyBzdXJ2aXZlIGVkaXRvciBkaXNwb3NhbCBhbmQgYXMgc3VjaCBhcmUgYSBsb3QgbW9yZVxuXHRcdC8vIGR1cmFibGUgYWNyb3NzIGVkaXRvciBjaGFuZ2VzIGFuZCByZXN0YXJ0c1xuXHRcdGNvbnN0IGhhc1ZhbGlkUmVzb3VyY2VFZGl0b3JJbnB1dFNjaGVtZSA9XG5cdFx0XHRyZXNvdXJjZT8uc2NoZW1lID09PSBTY2hlbWFzLmZpbGUgfHxcblx0XHRcdHJlc291cmNlPy5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlUmVtb3RlIHx8XG5cdFx0XHRyZXNvdXJjZT8uc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZVVzZXJEYXRhIHx8XG5cdFx0XHRyZXNvdXJjZT8uc2NoZW1lID09PSB0aGlzLnBhdGhTZXJ2aWNlLmRlZmF1bHRVcmlTY2hlbWU7XG5cblx0XHQvLyBTY2hlbWUgaXMgdmFsaWQ6IHByZWZlciB0aGUgdW50eXBlZCBpbnB1dFxuXHRcdC8vIG92ZXIgdGhlIHR5cGVkIGlucHV0IGlmIHBvc3NpYmxlIHRvIGtlZXBcblx0XHQvLyB0aGUgZW50cnkgYWNyb3NzIHJlc3RhcnRzXG5cdFx0aWYgKGhhc1ZhbGlkUmVzb3VyY2VFZGl0b3JJbnB1dFNjaGVtZSkge1xuXHRcdFx0aWYgKGlzRWRpdG9ySW5wdXQoZWRpdG9yKSkge1xuXHRcdFx0XHRjb25zdCB1bnR5cGVkSW5wdXQgPSBlZGl0b3IudG9VbnR5cGVkKCk7XG5cdFx0XHRcdGlmIChpc1Jlc291cmNlRWRpdG9ySW5wdXQodW50eXBlZElucHV0KSkge1xuXHRcdFx0XHRcdHJldHVybiB1bnR5cGVkSW5wdXQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGVkaXRvcjtcblx0XHR9XG5cblx0XHQvLyBTY2hlbWUgaXMgaW52YWxpZDogYWxsb3cgdGhlIGVkaXRvciBpbnB1dFxuXHRcdC8vIGZvciBhcyBsb25nIGFzIGl0IGlzIG5vdCBkaXNwb3NlZFxuXHRcdGVsc2Uge1xuXHRcdFx0cmV0dXJuIGlzRWRpdG9ySW5wdXQoZWRpdG9yKSA/IGVkaXRvciA6IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRtYXRjaGVzRWRpdG9yKGFyZzE6IEVkaXRvcklucHV0IHwgSVJlc291cmNlRWRpdG9ySW5wdXQgfCBGaWxlQ2hhbmdlc0V2ZW50IHwgRmlsZU9wZXJhdGlvbkV2ZW50LCBpbnB1dEI6IEVkaXRvcklucHV0IHwgSVJlc291cmNlRWRpdG9ySW5wdXQpOiBib29sZWFuIHtcblx0XHRpZiAoYXJnMSBpbnN0YW5jZW9mIEZpbGVDaGFuZ2VzRXZlbnQgfHwgYXJnMSBpbnN0YW5jZW9mIEZpbGVPcGVyYXRpb25FdmVudCkge1xuXHRcdFx0aWYgKGlzRWRpdG9ySW5wdXQoaW5wdXRCKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vIHdlIG9ubHkgc3VwcG9ydCB0aGlzIGZvciBgSVJlc291cmNlRWRpdG9ySW5wdXRzYCB0aGF0IGFyZSBmaWxlIGJhc2VkXG5cdFx0XHR9XG5cblx0XHRcdGlmIChhcmcxIGluc3RhbmNlb2YgRmlsZUNoYW5nZXNFdmVudCkge1xuXHRcdFx0XHRyZXR1cm4gYXJnMS5jb250YWlucyhpbnB1dEIucmVzb3VyY2UsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdGhpcy5tYXRjaGVzRmlsZShpbnB1dEIucmVzb3VyY2UsIGFyZzEpO1xuXHRcdH1cblxuXHRcdGlmIChpc0VkaXRvcklucHV0KGFyZzEpKSB7XG5cdFx0XHRpZiAoaXNFZGl0b3JJbnB1dChpbnB1dEIpKSB7XG5cdFx0XHRcdHJldHVybiBhcmcxLm1hdGNoZXMoaW5wdXRCKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXMubWF0Y2hlc0ZpbGUoaW5wdXRCLnJlc291cmNlLCBhcmcxKTtcblx0XHR9XG5cblx0XHRpZiAoaXNFZGl0b3JJbnB1dChpbnB1dEIpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5tYXRjaGVzRmlsZShhcmcxLnJlc291cmNlLCBpbnB1dEIpO1xuXHRcdH1cblxuXHRcdHJldHVybiBhcmcxICYmIGlucHV0QiAmJiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChhcmcxLnJlc291cmNlLCBpbnB1dEIucmVzb3VyY2UpO1xuXHR9XG5cblx0bWF0Y2hlc0ZpbGUocmVzb3VyY2U6IFVSSSwgYXJnMjogRWRpdG9ySW5wdXQgfCBJUmVzb3VyY2VFZGl0b3JJbnB1dCB8IEZpbGVDaGFuZ2VzRXZlbnQgfCBGaWxlT3BlcmF0aW9uRXZlbnQpOiBib29sZWFuIHtcblx0XHRpZiAoYXJnMiBpbnN0YW5jZW9mIEZpbGVDaGFuZ2VzRXZlbnQpIHtcblx0XHRcdHJldHVybiBhcmcyLmNvbnRhaW5zKHJlc291cmNlLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKTtcblx0XHR9XG5cblx0XHRpZiAoYXJnMiBpbnN0YW5jZW9mIEZpbGVPcGVyYXRpb25FdmVudCkge1xuXHRcdFx0cmV0dXJuIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsT3JQYXJlbnQocmVzb3VyY2UsIGFyZzIucmVzb3VyY2UpO1xuXHRcdH1cblxuXHRcdGlmIChpc0VkaXRvcklucHV0KGFyZzIpKSB7XG5cdFx0XHRjb25zdCBpbnB1dFJlc291cmNlID0gYXJnMi5yZXNvdXJjZTtcblx0XHRcdGlmICghaW5wdXRSZXNvdXJjZSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmxpZmVjeWNsZVNlcnZpY2UucGhhc2UgPj0gTGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWQgJiYgIXRoaXMuZmlsZVNlcnZpY2UuaGFzUHJvdmlkZXIoaW5wdXRSZXNvdXJjZSkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBtYWtlIHN1cmUgdG8gb25seSBjaGVjayB0aGlzIHdoZW4gd29ya2JlbmNoIGhhcyByZXN0b3JlZCAoZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy80ODI3NSlcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGlucHV0UmVzb3VyY2UsIHJlc291cmNlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoYXJnMj8ucmVzb3VyY2UsIHJlc291cmNlKTtcblx0fVxuXG5cdG1hdGNoZXNFZGl0b3JJZGVudGlmaWVyKGlkZW50aWZpZXI6IElFZGl0b3JJZGVudGlmaWVyLCBlZGl0b3JQYW5lPzogSUVkaXRvclBhbmUpOiBib29sZWFuIHtcblx0XHRpZiAoIWVkaXRvclBhbmU/Lmdyb3VwKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKGlkZW50aWZpZXIuZ3JvdXBJZCAhPT0gZWRpdG9yUGFuZS5ncm91cC5pZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiBlZGl0b3JQYW5lLmlucHV0ID8gaWRlbnRpZmllci5lZGl0b3IubWF0Y2hlcyhlZGl0b3JQYW5lLmlucHV0KSA6IGZhbHNlO1xuXHR9XG5cblx0b25FZGl0b3JEaXNwb3NlKGVkaXRvcjogRWRpdG9ySW5wdXQsIGxpc3RlbmVyOiBGdW5jdGlvbiwgbWFwRWRpdG9yVG9EaXNwb3NlOiBNYXA8RWRpdG9ySW5wdXQsIERpc3Bvc2FibGVTdG9yZT4pOiB2b2lkIHtcblx0XHRjb25zdCB0b0Rpc3Bvc2UgPSBFdmVudC5vbmNlKGVkaXRvci5vbldpbGxEaXNwb3NlKSgoKSA9PiBsaXN0ZW5lcigpKTtcblxuXHRcdGxldCBkaXNwb3NhYmxlcyA9IG1hcEVkaXRvclRvRGlzcG9zZS5nZXQoZWRpdG9yKTtcblx0XHRpZiAoIWRpc3Bvc2FibGVzKSB7XG5cdFx0XHRkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdG1hcEVkaXRvclRvRGlzcG9zZS5zZXQoZWRpdG9yLCBkaXNwb3NhYmxlcyk7XG5cdFx0fVxuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zZSk7XG5cdH1cblxuXHRjbGVhck9uRWRpdG9yRGlzcG9zZShlZGl0b3I6IEVkaXRvcklucHV0IHwgSVJlc291cmNlRWRpdG9ySW5wdXQgfCBGaWxlQ2hhbmdlc0V2ZW50IHwgRmlsZU9wZXJhdGlvbkV2ZW50LCBtYXBFZGl0b3JUb0Rpc3Bvc2U6IE1hcDxFZGl0b3JJbnB1dCwgRGlzcG9zYWJsZVN0b3JlPik6IHZvaWQge1xuXHRcdGlmICghaXNFZGl0b3JJbnB1dChlZGl0b3IpKSB7XG5cdFx0XHRyZXR1cm47IC8vIG9ubHkgc3VwcG9ydGVkIHdoZW4gcGFzc2luZyBpbiBhbiBhY3R1YWwgZWRpdG9yIGlucHV0XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBtYXBFZGl0b3JUb0Rpc3Bvc2UuZ2V0KGVkaXRvcik7XG5cdFx0aWYgKGRpc3Bvc2FibGVzKSB7XG5cdFx0XHRkaXNwb3NlKGRpc3Bvc2FibGVzKTtcblx0XHRcdG1hcEVkaXRvclRvRGlzcG9zZS5kZWxldGUoZWRpdG9yKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxXQUFXO0FBRXBCLFNBQXlDLHdCQUE0RCxjQUFjLGtCQUF1Qyx1QkFBdUIsZUFBZSx5QkFBeUIsb0JBQTBDLGtDQUFrQyxpQ0FBaUMsMkJBQTRHLDRCQUE0QjtBQUU5YyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFVBQVUsU0FBUyx1QkFBdUI7QUFDbkQsU0FBUyxrQkFBa0IsY0FBYyxnQkFBZ0Isc0JBQXNCLG9CQUFvQixxQkFBcUI7QUFDeEgsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxTQUFTLFlBQVksdUJBQW9DO0FBQ2xFLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQXVCLDRCQUE0QjtBQUNuRCxTQUFTLGFBQW1DLDZCQUE2QjtBQUN6RSxTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLCtCQUErQjtBQUN4QyxTQUFzQixvQkFBb0IscUJBQXFCO0FBQy9ELFNB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
