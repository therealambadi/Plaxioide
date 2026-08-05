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
import "./media/editorgroupview.css";
import { EditorGroupModel, isGroupEditorCloseEvent, isGroupEditorOpenEvent, isSerializedEditorGroupModel } from "../../../common/editor/editorGroupModel.js";
import { CloseDirection, SaveReason, EditorsOrder, EditorResourceAccessor, EditorInputCapabilities, DEFAULT_EDITOR_ASSOCIATION, SideBySideEditor, EditorCloseContext, GroupModelChangeKind, TEXT_DIFF_EDITOR_ID } from "../../../common/editor.js";
import { ActiveEditorGroupLockedContext, ActiveEditorDirtyContext, EditorGroupEditorsCountContext, ActiveEditorStickyContext, ActiveEditorPinnedContext, ActiveEditorLastInGroupContext, ActiveEditorFirstInGroupContext, ResourceContextKey, applyAvailableEditorIds, ActiveEditorAvailableEditorIdsContext, ActiveEditorCanSplitInGroupContext, SideBySideEditorActiveContext, TextCompareEditorVisibleContext, TextCompareEditorActiveContext, ActiveEditorContext, ActiveEditorReadonlyContext, ActiveEditorCanRevertContext, ActiveEditorCanToggleReadonlyContext, ActiveCompareEditorCanSwapContext, MultipleEditorsSelectedInGroupContext, TwoEditorsSelectedInGroupContext, SelectedEditorsInGroupFileOrUntitledResourceContextKey } from "../../../common/contextkeys.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { Emitter, Relay } from "../../../../base/common/event.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Dimension, trackFocus, addDisposableListener, EventType, EventHelper, findParentWithClass, isAncestor, isMouseEvent, isActiveElement, getWindow, getActiveElement, $ } from "../../../../base/browser/dom.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ProgressBar } from "../../../../base/browser/ui/progressbar/progressbar.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { editorBackground, contrastBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { EDITOR_GROUP_HEADER_TABS_BACKGROUND, EDITOR_GROUP_HEADER_NO_TABS_BACKGROUND, EDITOR_GROUP_EMPTY_BACKGROUND, EDITOR_GROUP_HEADER_BORDER } from "../../../common/theme.js";
import { GroupsOrder } from "../../../services/editor/common/editorGroupsService.js";
import { EditorPanes } from "./editorPanes.js";
import { IEditorProgressService } from "../../../../platform/progress/common/progress.js";
import { EditorProgressIndicator } from "../../../services/progress/browser/progressIndicator.js";
import { localize } from "../../../../nls.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { DeferredPromise, Promises, RunOnceWorker } from "../../../../base/common/async.js";
import { EventType as TouchEventType } from "../../../../base/browser/touch.js";
import { fillActiveEditorViewState } from "./editor.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { getActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { hash } from "../../../../base/common/hash.js";
import { getMimeTypes } from "../../../../editor/common/services/languagesAssociations.js";
import { extname, isEqual } from "../../../../base/common/resources.js";
import { Schemas } from "../../../../base/common/network.js";
import { EditorActivation } from "../../../../platform/editor/common/editor.js";
import { IFileDialogService, ConfirmResult, IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFilesConfigurationService, AutoSaveMode } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { URI } from "../../../../base/common/uri.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { isLinux, isMacintosh, isNative, isWindows } from "../../../../base/common/platform.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { TelemetryTrustedValue } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { defaultProgressBarStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { EditorGroupWatermark } from "./editorGroupWatermark.js";
import { EditorTitleControl } from "./editorTitleControl.js";
import { EditorPane } from "./editorPane.js";
import { IEditorResolverService } from "../../../services/editor/common/editorResolverService.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { DiffEditorInput } from "../../../common/editor/diffEditorInput.js";
import { FileSystemProviderCapabilities, IFileService } from "../../../../platform/files/common/files.js";
let EditorGroupView = class extends Themable {
  constructor(from, editorPartsView, groupsView, groupsLabel, _index, options, instantiationService, contextKeyService, themeService, telemetryService, keybindingService, menuService, contextMenuService, fileDialogService, editorService, filesConfigurationService, uriIdentityService, logService, editorResolverService, hostService, dialogService, fileService) {
    super(themeService);
    this.editorPartsView = editorPartsView;
    this.groupsView = groupsView;
    this.groupsLabel = groupsLabel;
    this._index = _index;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.telemetryService = telemetryService;
    this.keybindingService = keybindingService;
    this.menuService = menuService;
    this.contextMenuService = contextMenuService;
    this.fileDialogService = fileDialogService;
    this.editorService = editorService;
    this.filesConfigurationService = filesConfigurationService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this.editorResolverService = editorResolverService;
    this.hostService = hostService;
    this.dialogService = dialogService;
    this.fileService = fileService;
    //#region events
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this._onDidModelChange = this._register(new Emitter());
    this.onDidModelChange = this._onDidModelChange.event;
    this._onDidActiveEditorChange = this._register(new Emitter());
    this.onDidActiveEditorChange = this._onDidActiveEditorChange.event;
    this._onDidOpenEditorFail = this._register(new Emitter());
    this.onDidOpenEditorFail = this._onDidOpenEditorFail.event;
    this._onWillCloseEditor = this._register(new Emitter());
    this.onWillCloseEditor = this._onWillCloseEditor.event;
    this._onDidCloseEditor = this._register(new Emitter());
    this.onDidCloseEditor = this._onDidCloseEditor.event;
    this._onWillMoveEditor = this._register(new Emitter());
    this.onWillMoveEditor = this._onWillMoveEditor.event;
    this._onWillOpenEditor = this._register(new Emitter());
    this.onWillOpenEditor = this._onWillOpenEditor.event;
    this.disposedEditorsWorker = this._register(new RunOnceWorker((editors) => this.handleDisposedEditors(editors), 0));
    this.mapEditorToPendingConfirmation = /* @__PURE__ */ new Map();
    this.containerToolBarMenuDisposable = this._register(new MutableDisposable());
    this.whenRestoredPromise = new DeferredPromise();
    this.whenRestored = this.whenRestoredPromise.p;
    this._disposed = false;
    //#endregion
    //#region ISerializableView
    this.element = $("div");
    this._onDidChange = this._register(new Relay());
    this.onDidChange = this._onDidChange.event;
    if (from instanceof EditorGroupView) {
      this.model = this._register(from.model.clone());
    } else if (isSerializedEditorGroupModel(from)) {
      this.model = this._register(instantiationService.createInstance(EditorGroupModel, from));
    } else {
      this.model = this._register(instantiationService.createInstance(EditorGroupModel, void 0));
    }
    {
      this.scopedContextKeyService = this._register(this.contextKeyService.createScoped(this.element));
      this.element.classList.add(...coalesce(["editor-group-container", this.model.isLocked ? "locked" : void 0]));
      this.registerContainerListeners();
      this.createContainerToolbar();
      this.createContainerContextMenu();
      this._register(this.instantiationService.createInstance(EditorGroupWatermark, this.element));
      this.progressBar = this._register(new ProgressBar(this.element, defaultProgressBarStyles));
      this.progressBar.hide();
      this.scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection(
        [IContextKeyService, this.scopedContextKeyService],
        [IEditorProgressService, this._register(new EditorProgressIndicator(this.progressBar, this))]
      )));
      this.resourceContext = this._register(this.scopedInstantiationService.createInstance(ResourceContextKey));
      this.handleGroupContextKeys();
      this.titleContainer = $(".title");
      this.element.appendChild(this.titleContainer);
      this.titleControl = this._register(this.scopedInstantiationService.createInstance(EditorTitleControl, this.titleContainer, this.editorPartsView, this.groupsView, this, this.model));
      this.editorContainer = $(".editor-container");
      this.element.appendChild(this.editorContainer);
      this.editorPane = this._register(this.scopedInstantiationService.createInstance(EditorPanes, this.element, this.editorContainer, this));
      this._onDidChange.input = this.editorPane.onDidChangeSizeConstraints;
      this.doTrackFocus();
      this.updateTitleContainer();
      this.updateContainer();
      this.updateStyles();
    }
    const restoreEditorsPromise = this.restoreEditors(from, options) ?? Promise.resolve();
    restoreEditorsPromise.finally(() => {
      this.whenRestoredPromise.complete();
    });
    this.registerListeners();
  }
  //#region factory
  static createNew(editorPartsView, groupsView, groupsLabel, groupIndex, instantiationService, options) {
    return instantiationService.createInstance(EditorGroupView, null, editorPartsView, groupsView, groupsLabel, groupIndex, options);
  }
  static createFromSerialized(serialized, editorPartsView, groupsView, groupsLabel, groupIndex, instantiationService, options) {
    return instantiationService.createInstance(EditorGroupView, serialized, editorPartsView, groupsView, groupsLabel, groupIndex, options);
  }
  static createCopy(copyFrom, editorPartsView, groupsView, groupsLabel, groupIndex, instantiationService, options) {
    return instantiationService.createInstance(EditorGroupView, copyFrom, editorPartsView, groupsView, groupsLabel, groupIndex, options);
  }
  handleGroupContextKeys() {
    const groupActiveEditorDirtyContext = this.editorPartsView.bind(ActiveEditorDirtyContext, this);
    const groupActiveEditorPinnedContext = this.editorPartsView.bind(ActiveEditorPinnedContext, this);
    const groupActiveEditorFirstContext = this.editorPartsView.bind(ActiveEditorFirstInGroupContext, this);
    const groupActiveEditorLastContext = this.editorPartsView.bind(ActiveEditorLastInGroupContext, this);
    const groupActiveEditorStickyContext = this.editorPartsView.bind(ActiveEditorStickyContext, this);
    const groupEditorsCountContext = this.editorPartsView.bind(EditorGroupEditorsCountContext, this);
    const groupLockedContext = this.editorPartsView.bind(ActiveEditorGroupLockedContext, this);
    const multipleEditorsSelectedContext = MultipleEditorsSelectedInGroupContext.bindTo(this.scopedContextKeyService);
    const twoEditorsSelectedContext = TwoEditorsSelectedInGroupContext.bindTo(this.scopedContextKeyService);
    const selectedEditorsHaveFileOrUntitledResourceContext = SelectedEditorsInGroupFileOrUntitledResourceContextKey.bindTo(this.scopedContextKeyService);
    const groupActiveEditorContext = this.editorPartsView.bind(ActiveEditorContext, this);
    const groupActiveEditorIsReadonly = this.editorPartsView.bind(ActiveEditorReadonlyContext, this);
    const groupActiveEditorCanRevert = this.editorPartsView.bind(ActiveEditorCanRevertContext, this);
    const groupActiveEditorCanToggleReadonly = this.editorPartsView.bind(ActiveEditorCanToggleReadonlyContext, this);
    const groupActiveCompareEditorCanSwap = this.editorPartsView.bind(ActiveCompareEditorCanSwapContext, this);
    const groupTextCompareEditorVisibleContext = this.editorPartsView.bind(TextCompareEditorVisibleContext, this);
    const groupTextCompareEditorActiveContext = this.editorPartsView.bind(TextCompareEditorActiveContext, this);
    const groupActiveEditorAvailableEditorIds = this.editorPartsView.bind(ActiveEditorAvailableEditorIdsContext, this);
    const groupActiveEditorCanSplitInGroupContext = this.editorPartsView.bind(ActiveEditorCanSplitInGroupContext, this);
    const groupActiveEditorIsSideBySideEditorContext = this.editorPartsView.bind(SideBySideEditorActiveContext, this);
    const activeEditorListener = this._register(new MutableDisposable());
    const observeActiveEditor = () => {
      activeEditorListener.clear();
      this.scopedContextKeyService.bufferChangeEvents(() => {
        const activeEditor = this.activeEditor;
        const activeEditorPane = this.activeEditorPane;
        this.resourceContext.set(EditorResourceAccessor.getOriginalUri(activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY }));
        applyAvailableEditorIds(groupActiveEditorAvailableEditorIds, activeEditor, this.editorResolverService);
        if (activeEditor) {
          groupActiveEditorCanSplitInGroupContext.set(activeEditor.hasCapability(EditorInputCapabilities.CanSplitInGroup));
          groupActiveEditorIsSideBySideEditorContext.set(activeEditor.typeId === SideBySideEditorInput.ID);
          groupActiveEditorDirtyContext.set(activeEditor.isDirty() && !activeEditor.isSaving());
          activeEditorListener.value = activeEditor.onDidChangeDirty(() => {
            groupActiveEditorDirtyContext.set(activeEditor.isDirty() && !activeEditor.isSaving());
          });
        } else {
          groupActiveEditorCanSplitInGroupContext.set(false);
          groupActiveEditorIsSideBySideEditorContext.set(false);
          groupActiveEditorDirtyContext.set(false);
        }
        if (activeEditorPane) {
          groupActiveEditorContext.set(activeEditorPane.getId());
          groupActiveEditorCanRevert.set(!activeEditorPane.input.hasCapability(EditorInputCapabilities.Untitled));
          groupActiveEditorIsReadonly.set(!!activeEditorPane.input.isReadonly());
          const primaryEditorResource = EditorResourceAccessor.getOriginalUri(activeEditorPane.input, { supportSideBySide: SideBySideEditor.PRIMARY });
          const secondaryEditorResource = EditorResourceAccessor.getOriginalUri(activeEditorPane.input, { supportSideBySide: SideBySideEditor.SECONDARY });
          groupActiveCompareEditorCanSwap.set(activeEditorPane.input instanceof DiffEditorInput && !activeEditorPane.input.original.isReadonly() && !!primaryEditorResource && (this.fileService.hasProvider(primaryEditorResource) || primaryEditorResource.scheme === Schemas.untitled) && !!secondaryEditorResource && (this.fileService.hasProvider(secondaryEditorResource) || secondaryEditorResource.scheme === Schemas.untitled));
          groupActiveEditorCanToggleReadonly.set(!!primaryEditorResource && this.fileService.hasProvider(primaryEditorResource) && !this.fileService.hasCapability(primaryEditorResource, FileSystemProviderCapabilities.Readonly));
          const activePaneDiffEditor = activeEditorPane?.getId() === TEXT_DIFF_EDITOR_ID;
          groupTextCompareEditorActiveContext.set(activePaneDiffEditor);
          groupTextCompareEditorVisibleContext.set(activePaneDiffEditor);
        } else {
          groupActiveEditorContext.reset();
          groupActiveEditorCanRevert.reset();
          groupActiveEditorIsReadonly.reset();
          groupActiveCompareEditorCanSwap.reset();
          groupActiveEditorCanToggleReadonly.reset();
        }
      });
    };
    const updateGroupContextKeys = (e) => {
      switch (e.kind) {
        case GroupModelChangeKind.GROUP_LOCKED:
          groupLockedContext.set(this.isLocked);
          break;
        case GroupModelChangeKind.EDITOR_ACTIVE:
          groupActiveEditorFirstContext.set(this.model.isFirst(this.model.activeEditor));
          groupActiveEditorLastContext.set(this.model.isLast(this.model.activeEditor));
          groupActiveEditorPinnedContext.set(this.model.activeEditor ? this.model.isPinned(this.model.activeEditor) : false);
          groupActiveEditorStickyContext.set(this.model.activeEditor ? this.model.isSticky(this.model.activeEditor) : false);
          break;
        case GroupModelChangeKind.EDITOR_CLOSE:
          groupActiveEditorPinnedContext.set(this.model.activeEditor ? this.model.isPinned(this.model.activeEditor) : false);
          groupActiveEditorStickyContext.set(this.model.activeEditor ? this.model.isSticky(this.model.activeEditor) : false);
        case GroupModelChangeKind.EDITOR_OPEN:
        case GroupModelChangeKind.EDITOR_MOVE:
          groupActiveEditorFirstContext.set(this.model.isFirst(this.model.activeEditor));
          groupActiveEditorLastContext.set(this.model.isLast(this.model.activeEditor));
          break;
        case GroupModelChangeKind.EDITOR_PIN:
          if (e.editor && e.editor === this.model.activeEditor) {
            groupActiveEditorPinnedContext.set(this.model.isPinned(this.model.activeEditor));
          }
          break;
        case GroupModelChangeKind.EDITOR_STICKY:
          if (e.editor && e.editor === this.model.activeEditor) {
            groupActiveEditorStickyContext.set(this.model.isSticky(this.model.activeEditor));
          }
          break;
        case GroupModelChangeKind.EDITORS_SELECTION:
          multipleEditorsSelectedContext.set(this.model.selectedEditors.length > 1);
          twoEditorsSelectedContext.set(this.model.selectedEditors.length === 2);
          selectedEditorsHaveFileOrUntitledResourceContext.set(this.model.selectedEditors.every((e2) => e2.resource && (this.fileService.hasProvider(e2.resource) || e2.resource.scheme === Schemas.untitled)));
          break;
      }
      groupEditorsCountContext.set(this.count);
    };
    this._register(this.onDidModelChange((e) => updateGroupContextKeys(e)));
    this._register(this.onDidActiveEditorChange(() => observeActiveEditor()));
    observeActiveEditor();
    updateGroupContextKeys({ kind: GroupModelChangeKind.EDITOR_ACTIVE });
    updateGroupContextKeys({ kind: GroupModelChangeKind.GROUP_LOCKED });
  }
  registerContainerListeners() {
    this._register(addDisposableListener(this.element, EventType.DBLCLICK, (e) => {
      if (this.isEmpty) {
        EventHelper.stop(e);
        this.editorService.openEditor({
          resource: void 0,
          options: {
            pinned: true,
            override: DEFAULT_EDITOR_ASSOCIATION.id
          }
        }, this.id);
      }
    }));
    this._register(addDisposableListener(this.element, EventType.AUXCLICK, (e) => {
      if (this.isEmpty && e.button === 1) {
        EventHelper.stop(e, true);
        this.groupsView.removeGroup(this);
      }
    }));
  }
  createContainerToolbar() {
    const toolbarContainer = $(".editor-group-container-toolbar");
    this.element.appendChild(toolbarContainer);
    const containerToolbar = this._register(new ActionBar(toolbarContainer, {
      ariaLabel: localize("ariaLabelGroupActions", "Empty editor group actions"),
      highlightToggledItems: true
    }));
    const containerToolbarMenu = this._register(this.menuService.createMenu(MenuId.EmptyEditorGroup, this.scopedContextKeyService));
    const updateContainerToolbar = () => {
      this.containerToolBarMenuDisposable.value = toDisposable(() => containerToolbar.clear());
      const actions = getActionBarActions(
        containerToolbarMenu.getActions({ arg: { groupId: this.id }, shouldForwardArgs: true }),
        "navigation"
      );
      for (const action of [...actions.primary, ...actions.secondary]) {
        const keybinding = this.keybindingService.lookupKeybinding(action.id);
        containerToolbar.push(action, { icon: true, label: false, keybinding: keybinding?.getLabel() });
      }
    };
    updateContainerToolbar();
    this._register(containerToolbarMenu.onDidChange(updateContainerToolbar));
  }
  createContainerContextMenu() {
    this._register(addDisposableListener(this.element, EventType.CONTEXT_MENU, (e) => this.onShowContainerContextMenu(e)));
    this._register(addDisposableListener(this.element, TouchEventType.Contextmenu, () => this.onShowContainerContextMenu()));
  }
  onShowContainerContextMenu(e) {
    if (!this.isEmpty) {
      return;
    }
    let anchor = this.element;
    if (e) {
      anchor = new StandardMouseEvent(getWindow(this.element), e);
    }
    this.contextMenuService.showContextMenu({
      menuId: MenuId.EmptyEditorGroupContext,
      contextKeyService: this.contextKeyService,
      getAnchor: () => anchor,
      onHide: () => this.focus()
    });
  }
  doTrackFocus() {
    const containerFocusTracker = this._register(trackFocus(this.element));
    this._register(containerFocusTracker.onDidFocus(() => {
      if (this.isEmpty) {
        this._onDidFocus.fire();
      }
    }));
    const handleTitleClickOrTouch = (e) => {
      let target;
      if (isMouseEvent(e)) {
        if (e.button !== 0 || isMacintosh && e.ctrlKey) {
          return void 0;
        }
        target = e.target;
      } else {
        target = e.initialTarget;
      }
      if (findParentWithClass(target, "monaco-action-bar", this.titleContainer) || findParentWithClass(target, "monaco-breadcrumb-item", this.titleContainer)) {
        return;
      }
      setTimeout(() => {
        this.focus();
      });
    };
    this._register(addDisposableListener(this.titleContainer, EventType.MOUSE_DOWN, (e) => handleTitleClickOrTouch(e)));
    this._register(addDisposableListener(this.titleContainer, TouchEventType.Tap, (e) => handleTitleClickOrTouch(e)));
    this._register(this.editorPane.onDidFocus(() => {
      this._onDidFocus.fire();
    }));
  }
  updateContainer() {
    if (this.isEmpty) {
      this.element.classList.add("empty");
      this.element.tabIndex = 0;
      this.element.setAttribute("aria-label", localize("emptyEditorGroup", "{0} (empty)", this.ariaLabel));
    } else {
      this.element.classList.remove("empty");
      this.element.removeAttribute("tabIndex");
      this.element.removeAttribute("aria-label");
    }
    this.updateStyles();
  }
  updateTitleContainer() {
    this.titleContainer.classList.toggle("tabs", this.groupsView.partOptions.showTabs === "multiple");
    this.titleContainer.classList.toggle("show-file-icons", this.groupsView.partOptions.showIcons);
  }
  restoreEditors(from, groupViewOptions) {
    if (this.count === 0) {
      return;
    }
    let options;
    if (from instanceof EditorGroupView) {
      options = fillActiveEditorViewState(from);
    } else {
      options = /* @__PURE__ */ Object.create(null);
    }
    const activeEditor = this.model.activeEditor;
    if (!activeEditor) {
      return;
    }
    options.pinned = this.model.isPinned(activeEditor);
    options.sticky = this.model.isSticky(activeEditor);
    options.preserveFocus = true;
    const internalOptions = {
      preserveWindowOrder: true,
      // handle window order after editor is restored
      skipTitleUpdate: true
      // update the title later for all editors at once
    };
    const activeElement = getActiveElement();
    const result = this.doShowEditor(activeEditor, {
      active: true,
      isNew: false
      /* restored */
    }, options, internalOptions).then(() => {
      if (this.groupsView.activeGroup === this && activeElement && isActiveElement(activeElement) && !groupViewOptions?.preserveFocus) {
        this.focus();
      }
    });
    this.titleControl.openEditors(this.editors);
    return result;
  }
  //#region event handling
  registerListeners() {
    this._register(this.model.onDidModelChange((e) => this.onDidGroupModelChange(e)));
    this._register(this.groupsView.onDidChangeEditorPartOptions((e) => this.onDidChangeEditorPartOptions(e)));
    this._register(this.groupsView.onDidVisibilityChange((e) => this.onDidVisibilityChange(e)));
    this._register(this.onDidFocus(() => this.onDidGainFocus()));
  }
  onDidGroupModelChange(e) {
    this._onDidModelChange.fire(e);
    switch (e.kind) {
      case GroupModelChangeKind.GROUP_LOCKED:
        this.element.classList.toggle("locked", this.isLocked);
        break;
      case GroupModelChangeKind.EDITORS_SELECTION:
        this.onDidChangeEditorSelection();
        break;
    }
    if (!e.editor) {
      return;
    }
    switch (e.kind) {
      case GroupModelChangeKind.EDITOR_OPEN:
        if (isGroupEditorOpenEvent(e)) {
          this.onDidOpenEditor(e.editor, e.editorIndex);
        }
        break;
      case GroupModelChangeKind.EDITOR_CLOSE:
        if (isGroupEditorCloseEvent(e)) {
          this.handleOnDidCloseEditor(e.editor, e.editorIndex, e.context, e.sticky);
        }
        break;
      case GroupModelChangeKind.EDITOR_WILL_DISPOSE:
        this.onWillDisposeEditor(e.editor);
        break;
      case GroupModelChangeKind.EDITOR_DIRTY:
        this.onDidChangeEditorDirty(e.editor);
        break;
      case GroupModelChangeKind.EDITOR_TRANSIENT:
        this.onDidChangeEditorTransient(e.editor);
        break;
      case GroupModelChangeKind.EDITOR_LABEL:
        this.onDidChangeEditorLabel(e.editor);
        break;
    }
  }
  onDidOpenEditor(editor, editorIndex) {
    this.telemetryService.publicLog("editorOpened", this.toEditorTelemetryDescriptor(editor));
    this.updateContainer();
  }
  handleOnDidCloseEditor(editor, editorIndex, context, sticky) {
    this._onWillCloseEditor.fire({ groupId: this.id, editor, context, index: editorIndex, sticky });
    const editorsToClose = [editor];
    if (editor instanceof SideBySideEditorInput) {
      editorsToClose.push(editor.primary, editor.secondary);
    }
    for (const editor2 of editorsToClose) {
      if (this.canDispose(editor2)) {
        editor2.dispose();
      }
    }
    this.updateContainer();
    this._onDidCloseEditor.fire({ groupId: this.id, editor, context, index: editorIndex, sticky });
  }
  canDispose(editor) {
    for (const groupView of this.editorPartsView.groups) {
      if (groupView instanceof EditorGroupView && groupView.model.contains(editor, {
        strictEquals: true,
        // only if this input is not shared across editor groups
        supportSideBySide: SideBySideEditor.ANY
        // include any side of an opened side by side editor
      })) {
        return false;
      }
    }
    return true;
  }
  toResourceTelemetryDescriptor(resource) {
    if (!resource) {
      return void 0;
    }
    const path = resource ? resource.scheme === Schemas.file ? resource.fsPath : resource.path : void 0;
    if (!path) {
      return void 0;
    }
    let resourceExt = extname(resource);
    const queryStringLocation = resourceExt.indexOf("?");
    resourceExt = queryStringLocation !== -1 ? resourceExt.substr(0, queryStringLocation) : resourceExt;
    return {
      mimeType: new TelemetryTrustedValue(getMimeTypes(resource).join(", ")),
      scheme: resource.scheme,
      ext: resourceExt,
      path: hash(path)
    };
  }
  toEditorTelemetryDescriptor(editor) {
    const descriptor = editor.getTelemetryDescriptor();
    const resource = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.BOTH });
    if (URI.isUri(resource)) {
      descriptor["resource"] = this.toResourceTelemetryDescriptor(resource);
      return descriptor;
    } else if (resource) {
      if (resource.primary) {
        descriptor["resource"] = this.toResourceTelemetryDescriptor(resource.primary);
      }
      if (resource.secondary) {
        descriptor["resourceSecondary"] = this.toResourceTelemetryDescriptor(resource.secondary);
      }
      return descriptor;
    }
    return descriptor;
  }
  onWillDisposeEditor(editor) {
    this.disposedEditorsWorker.work(editor);
  }
  handleDisposedEditors(disposedEditors) {
    let activeEditor;
    const inactiveEditors = [];
    for (const disposedEditor of disposedEditors) {
      const editorFindResult = this.model.findEditor(disposedEditor);
      if (!editorFindResult) {
        continue;
      }
      const editor = editorFindResult[0];
      if (!editor.isDisposed()) {
        continue;
      }
      if (this.model.isActive(editor)) {
        activeEditor = editor;
      } else {
        inactiveEditors.push(editor);
      }
    }
    for (const inactiveEditor of inactiveEditors) {
      this.doCloseEditor(inactiveEditor, true);
    }
    if (activeEditor) {
      this.doCloseEditor(activeEditor, true);
    }
  }
  onDidChangeEditorPartOptions(event) {
    this.updateTitleContainer();
    this.titleControl.updateOptions(event.oldPartOptions, event.newPartOptions);
    if (event.oldPartOptions.showTabs !== event.newPartOptions.showTabs || event.oldPartOptions.tabHeight !== event.newPartOptions.tabHeight || event.oldPartOptions.showTabs === "multiple" && event.oldPartOptions.pinnedTabsOnSeparateRow !== event.newPartOptions.pinnedTabsOnSeparateRow) {
      this.relayout();
      if (this.model.activeEditor) {
        this.titleControl.openEditors(this.model.getEditors(EditorsOrder.SEQUENTIAL));
      }
    }
    this.updateStyles();
    if (event.oldPartOptions.enablePreview && !event.newPartOptions.enablePreview) {
      if (this.model.previewEditor) {
        this.pinEditor(this.model.previewEditor);
      }
    }
  }
  onDidChangeEditorDirty(editor) {
    this.pinEditor(editor);
    this.titleControl.updateEditorDirty(editor);
  }
  onDidChangeEditorTransient(editor) {
    const transient = this.model.isTransient(editor);
    if (!transient && !this.groupsView.partOptions.enablePreview) {
      this.pinEditor(editor);
    }
  }
  onDidChangeEditorLabel(editor) {
    this.titleControl.updateEditorLabel(editor);
  }
  onDidChangeEditorSelection() {
    this.titleControl.updateEditorSelections();
  }
  onDidVisibilityChange(visible) {
    this.editorPane.setVisible(visible);
  }
  onDidGainFocus() {
    if (this.activeEditor) {
      this.model.setTransient(this.activeEditor, false);
    }
  }
  //#endregion
  //#region IEditorGroupView
  get index() {
    return this._index;
  }
  get label() {
    if (this.groupsLabel) {
      return localize("groupLabelLong", "{0}: Group {1}", this.groupsLabel, this._index + 1);
    }
    return localize("groupLabel", "Group {0}", this._index + 1);
  }
  get ariaLabel() {
    if (this.groupsLabel) {
      return localize("groupAriaLabelLong", "{0}: Editor Group {1}", this.groupsLabel, this._index + 1);
    }
    return localize("groupAriaLabel", "Editor Group {0}", this._index + 1);
  }
  get disposed() {
    return this._disposed;
  }
  get isEmpty() {
    return this.count === 0;
  }
  get titleHeight() {
    return this.titleControl.getHeight();
  }
  notifyIndexChanged(newIndex) {
    if (this._index !== newIndex) {
      this._index = newIndex;
      this.model.setIndex(newIndex);
    }
  }
  notifyLabelChanged(newLabel) {
    if (this.groupsLabel !== newLabel) {
      this.groupsLabel = newLabel;
      this.model.setLabel(newLabel);
    }
  }
  setActive(isActive) {
    this.active = isActive;
    if (!isActive && this.activeEditor && this.selectedEditors.length > 1) {
      this.setSelection(this.activeEditor, []);
    }
    this.element.classList.toggle("active", isActive);
    this.element.classList.toggle("inactive", !isActive);
    this.titleControl.setActive(isActive);
    this.updateStyles();
    this.model.setActive(
      void 0
      /* entire group got active */
    );
  }
  //#endregion
  //#region basics()
  get id() {
    return this.model.id;
  }
  get windowId() {
    return this.groupsView.windowId;
  }
  get editors() {
    return this.model.getEditors(EditorsOrder.SEQUENTIAL);
  }
  get count() {
    return this.model.count;
  }
  get stickyCount() {
    return this.model.stickyCount;
  }
  get activeEditorPane() {
    return this.editorPane ? this.editorPane.activeEditorPane ?? void 0 : void 0;
  }
  get activeEditor() {
    return this.model.activeEditor;
  }
  get selectedEditors() {
    return this.model.selectedEditors;
  }
  get previewEditor() {
    return this.model.previewEditor;
  }
  isPinned(editorOrIndex) {
    return this.model.isPinned(editorOrIndex);
  }
  isSticky(editorOrIndex) {
    return this.model.isSticky(editorOrIndex);
  }
  isSelected(editor) {
    return this.model.isSelected(editor);
  }
  isTransient(editorOrIndex) {
    return this.model.isTransient(editorOrIndex);
  }
  isActive(editor) {
    return this.model.isActive(editor);
  }
  async setSelection(activeSelectedEditor, inactiveSelectedEditors) {
    if (!this.isActive(activeSelectedEditor)) {
      await this.openEditor(activeSelectedEditor, { activation: EditorActivation.ACTIVATE }, { inactiveSelection: inactiveSelectedEditors });
    } else {
      this.model.setSelection(activeSelectedEditor, inactiveSelectedEditors);
    }
  }
  contains(candidate, options) {
    return this.model.contains(candidate, options);
  }
  getEditors(order, options) {
    return this.model.getEditors(order, options);
  }
  findEditors(resource, options) {
    const canonicalResource = this.uriIdentityService.asCanonicalUri(resource);
    return this.getEditors(EditorsOrder.SEQUENTIAL).filter((editor) => {
      if (editor.resource && isEqual(editor.resource, canonicalResource)) {
        return true;
      }
      if (options?.supportSideBySide === SideBySideEditor.PRIMARY || options?.supportSideBySide === SideBySideEditor.ANY) {
        const primaryResource = EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
        if (primaryResource && isEqual(primaryResource, canonicalResource)) {
          return true;
        }
      }
      if (options?.supportSideBySide === SideBySideEditor.SECONDARY || options?.supportSideBySide === SideBySideEditor.ANY) {
        const secondaryResource = EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.SECONDARY });
        if (secondaryResource && isEqual(secondaryResource, canonicalResource)) {
          return true;
        }
      }
      return false;
    });
  }
  getEditorByIndex(index) {
    return this.model.getEditorByIndex(index);
  }
  getIndexOfEditor(editor) {
    return this.model.indexOf(editor);
  }
  isFirst(editor) {
    return this.model.isFirst(editor);
  }
  isLast(editor) {
    return this.model.isLast(editor);
  }
  focus() {
    if (this.activeEditorPane) {
      this.activeEditorPane.focus();
    } else {
      this.element.focus();
    }
    this._onDidFocus.fire();
  }
  pinEditor(candidate = this.activeEditor || void 0) {
    if (candidate && !this.model.isPinned(candidate)) {
      const editor = this.model.pin(candidate);
      if (editor) {
        this.titleControl.pinEditor(editor);
      }
    }
  }
  stickEditor(candidate = this.activeEditor || void 0) {
    this.doStickEditor(candidate, true);
  }
  unstickEditor(candidate = this.activeEditor || void 0) {
    this.doStickEditor(candidate, false);
  }
  doStickEditor(candidate, sticky) {
    if (candidate && this.model.isSticky(candidate) !== sticky) {
      const oldIndexOfEditor = this.getIndexOfEditor(candidate);
      const editor = sticky ? this.model.stick(candidate) : this.model.unstick(candidate);
      if (!editor) {
        return;
      }
      const newIndexOfEditor = this.getIndexOfEditor(editor);
      if (newIndexOfEditor !== oldIndexOfEditor) {
        this.titleControl.moveEditor(editor, oldIndexOfEditor, newIndexOfEditor, true);
      }
      if (sticky) {
        this.titleControl.stickEditor(editor);
      } else {
        this.titleControl.unstickEditor(editor);
      }
    }
  }
  //#endregion
  //#region openEditor()
  async openEditor(editor, options, internalOptions) {
    return this.doOpenEditor(editor, options, {
      // Appply given internal open options
      ...internalOptions,
      // Allow to match on a side-by-side editor when same
      // editor is opened on both sides. In that case we
      // do not want to open a new editor but reuse that one.
      supportSideBySide: SideBySideEditor.BOTH
    });
  }
  async doOpenEditor(editor, options, internalOptions) {
    if (!editor || editor.isDisposed()) {
      return;
    }
    this._onWillOpenEditor.fire({ editor, groupId: this.id });
    const pinned = options?.sticky || !this.groupsView.partOptions.enablePreview && !options?.transient || editor.isDirty() || (options?.pinned ?? typeof options?.index === "number") || typeof options?.index === "number" && this.model.isSticky(options.index) || editor.hasCapability(EditorInputCapabilities.Scratchpad);
    const openEditorOptions = {
      index: options ? options.index : void 0,
      pinned,
      sticky: options?.sticky || typeof options?.index === "number" && this.model.isSticky(options.index),
      transient: !!options?.transient,
      inactiveSelection: internalOptions?.inactiveSelection,
      active: this.count === 0 || !options || !options.inactive,
      supportSideBySide: internalOptions?.supportSideBySide
    };
    if (!openEditorOptions.active && !openEditorOptions.pinned && this.model.activeEditor && !this.model.isPinned(this.model.activeEditor)) {
      openEditorOptions.active = true;
    }
    let activateGroup = false;
    let restoreGroup = false;
    if (options?.activation === EditorActivation.ACTIVATE) {
      activateGroup = true;
    } else if (options?.activation === EditorActivation.RESTORE) {
      restoreGroup = true;
    } else if (options?.activation === EditorActivation.PRESERVE) {
      activateGroup = false;
      restoreGroup = false;
    } else if (openEditorOptions.active) {
      activateGroup = !options || !options.preserveFocus;
      restoreGroup = !activateGroup;
    }
    if (typeof openEditorOptions.index === "number") {
      const indexOfEditor = this.model.indexOf(editor);
      if (indexOfEditor !== -1 && indexOfEditor !== openEditorOptions.index) {
        this.doMoveEditorInsideGroup(editor, openEditorOptions);
      }
    }
    const { editor: openedEditor, isNew } = this.model.openEditor(editor, openEditorOptions);
    if (isNew && // only if this editor was new for the group
    this.count === 1 && // only when this editor was the first editor in the group
    this.editorPartsView.groups.length > 1) {
      if (openedEditor.editorId && this.groupsView.partOptions.autoLockGroups?.has(openedEditor.editorId)) {
        this.lock(true);
      }
    }
    const showEditorResult = this.doShowEditor(openedEditor, { active: !!openEditorOptions.active, isNew }, options, internalOptions);
    if (activateGroup) {
      this.groupsView.activateGroup(this);
    } else if (restoreGroup) {
      this.groupsView.restoreGroup(this);
    }
    return showEditorResult;
  }
  doShowEditor(editor, context, options, internalOptions) {
    let openEditorPromise;
    if (context.active) {
      openEditorPromise = (async () => {
        const { pane, changed, cancelled, error } = await this.editorPane.openEditor(editor, options, internalOptions, { newInGroup: context.isNew });
        if (cancelled) {
          return void 0;
        }
        if (changed) {
          this._onDidActiveEditorChange.fire({ editor });
        }
        if (error) {
          this._onDidOpenEditorFail.fire(editor);
        }
        if (!pane && this.activeEditor === editor) {
          this.doCloseEditor(editor, options?.preserveFocus, { fromError: true });
        }
        return pane;
      })();
    } else {
      openEditorPromise = Promise.resolve(void 0);
    }
    if (!internalOptions?.skipTitleUpdate) {
      this.titleControl.openEditor(editor, internalOptions);
    }
    return openEditorPromise;
  }
  //#endregion
  //#region openEditors()
  async openEditors(editors) {
    const editorsToOpen = coalesce(editors).filter(({ editor }) => !editor.isDisposed());
    const firstEditor = editorsToOpen.at(0);
    if (!firstEditor) {
      return;
    }
    const openEditorsOptions = {
      // Allow to match on a side-by-side editor when same
      // editor is opened on both sides. In that case we
      // do not want to open a new editor but reuse that one.
      supportSideBySide: SideBySideEditor.BOTH
    };
    await this.doOpenEditor(firstEditor.editor, firstEditor.options, openEditorsOptions);
    const inactiveEditors = editorsToOpen.slice(1);
    const startingIndex = this.getIndexOfEditor(firstEditor.editor) + 1;
    await Promises.settled(inactiveEditors.map(({ editor, options }, index) => {
      return this.doOpenEditor(editor, {
        ...options,
        inactive: true,
        pinned: true,
        index: startingIndex + index
      }, {
        ...openEditorsOptions,
        // optimization: update the title control later
        // https://github.com/microsoft/vscode/issues/130634
        skipTitleUpdate: true
      });
    }));
    this.titleControl.openEditors(inactiveEditors.map(({ editor }) => editor));
    return this.editorPane.activeEditorPane ?? void 0;
  }
  //#endregion
  //#region moveEditor()
  moveEditors(editors, target) {
    const internalOptions = {
      skipTitleUpdate: this !== target
    };
    let moveFailed = false;
    const movedEditors = /* @__PURE__ */ new Set();
    for (const { editor, options } of editors) {
      if (this.moveEditor(editor, target, options, internalOptions)) {
        movedEditors.add(editor);
      } else {
        moveFailed = true;
      }
    }
    if (internalOptions.skipTitleUpdate) {
      target.titleControl.openEditors(Array.from(movedEditors));
      this.titleControl.closeEditors(Array.from(movedEditors));
    }
    return !moveFailed;
  }
  moveEditor(editor, target, options, internalOptions) {
    if (this === target) {
      this.doMoveEditorInsideGroup(editor, options);
      return true;
    } else {
      return this.doMoveOrCopyEditorAcrossGroups(editor, target, options, { ...internalOptions, keepCopy: false });
    }
  }
  doMoveEditorInsideGroup(candidate, options) {
    const moveToIndex = options ? options.index : void 0;
    if (typeof moveToIndex !== "number") {
      return;
    }
    const currentIndex = this.model.indexOf(candidate);
    const editor = this.model.getEditorByIndex(currentIndex);
    if (!editor) {
      return;
    }
    if (currentIndex !== moveToIndex) {
      const oldStickyCount = this.model.stickyCount;
      this.model.moveEditor(editor, moveToIndex);
      this.model.pin(editor);
      this.titleControl.moveEditor(editor, currentIndex, moveToIndex, oldStickyCount !== this.model.stickyCount);
      this.titleControl.pinEditor(editor);
    }
    if (options?.sticky) {
      this.stickEditor(editor);
    }
  }
  doMoveOrCopyEditorAcrossGroups(editor, target, openOptions, internalOptions) {
    const keepCopy = internalOptions?.keepCopy;
    if (!keepCopy || editor.hasCapability(EditorInputCapabilities.Singleton)) {
      const canMoveVeto = editor.canMove(this.id, target.id);
      if (typeof canMoveVeto === "string") {
        this.dialogService.error(canMoveVeto, localize("moveErrorDetails", "Try saving or reverting the editor first and then try again."));
        return false;
      }
    }
    const options = fillActiveEditorViewState(this, editor, {
      ...openOptions,
      pinned: true,
      // always pin moved editor
      sticky: openOptions?.sticky ?? (!keepCopy && this.model.isSticky(editor))
      // preserve sticky state only if editor is moved or explicitly wanted (https://github.com/microsoft/vscode/issues/99035)
    });
    if (!keepCopy) {
      this._onWillMoveEditor.fire({
        groupId: this.id,
        editor,
        target: target.id
      });
    }
    target.doOpenEditor(keepCopy ? editor.copy() : editor, options, internalOptions);
    if (!keepCopy) {
      this.doCloseEditor(editor, true, { ...internalOptions, context: EditorCloseContext.MOVE });
    }
    return true;
  }
  //#endregion
  //#region copyEditor()
  copyEditors(editors, target) {
    const internalOptions = {
      skipTitleUpdate: this !== target
    };
    for (const { editor, options } of editors) {
      this.copyEditor(editor, target, options, internalOptions);
    }
    if (internalOptions.skipTitleUpdate) {
      const copiedEditors = editors.map(({ editor }) => editor);
      target.titleControl.openEditors(copiedEditors);
    }
  }
  copyEditor(editor, target, options, internalOptions) {
    if (this === target) {
      this.doMoveEditorInsideGroup(editor, options);
    } else {
      this.doMoveOrCopyEditorAcrossGroups(editor, target, options, { ...internalOptions, keepCopy: true });
    }
  }
  //#endregion
  //#region closeEditor()
  async closeEditor(editor = this.activeEditor || void 0, options) {
    return this.doCloseEditorWithConfirmationHandling(editor, options);
  }
  async doCloseEditorWithConfirmationHandling(editor = this.activeEditor || void 0, options, internalOptions) {
    if (!editor) {
      return false;
    }
    const veto = await this.handleCloseConfirmation([editor]);
    if (veto) {
      return false;
    }
    this.doCloseEditor(editor, options?.preserveFocus, internalOptions);
    return true;
  }
  doCloseEditor(editor, preserveFocus = this.groupsView.activeGroup !== this, internalOptions) {
    if (!internalOptions?.skipTitleUpdate) {
      this.titleControl.beforeCloseEditor(editor);
    }
    if (this.model.isActive(editor)) {
      this.doCloseActiveEditor(preserveFocus, internalOptions);
    } else {
      this.doCloseInactiveEditor(editor, internalOptions);
    }
    if (!internalOptions?.skipTitleUpdate) {
      this.titleControl.closeEditor(editor);
    }
  }
  doCloseActiveEditor(preserveFocus = this.groupsView.activeGroup !== this, internalOptions) {
    const editorToClose = this.activeEditor;
    const restoreFocus = !preserveFocus && this.shouldRestoreFocus(this.element);
    const closeEmptyGroup = this.groupsView.partOptions.closeEmptyGroups;
    if (closeEmptyGroup && this.active && this.count === 1) {
      const mostRecentlyActiveGroups = this.groupsView.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE);
      const nextActiveGroup = mostRecentlyActiveGroups[1];
      if (nextActiveGroup) {
        if (restoreFocus) {
          nextActiveGroup.focus();
        } else {
          this.groupsView.activateGroup(nextActiveGroup, true);
        }
      }
    }
    if (editorToClose) {
      this.model.closeEditor(editorToClose, internalOptions?.context);
    }
    const nextActiveEditor = this.model.activeEditor;
    if (nextActiveEditor) {
      let activation = void 0;
      if (preserveFocus && this.groupsView.activeGroup !== this) {
        activation = EditorActivation.PRESERVE;
      }
      const options = {
        preserveFocus,
        activation,
        // When closing an editor due to an error we can end up in a loop where we continue closing
        // editors that fail to open (e.g. when the file no longer exists). We do not want to show
        // repeated errors in this case to the user. As such, if we open the next editor and we are
        // in a scope of a previous editor failing, we silence the input errors until the editor is
        // opened by setting ignoreError: true.
        ignoreError: internalOptions?.fromError
      };
      const internalEditorOpenOptions = {
        // When closing an editor, we reveal the next one in the group.
        // However, this can be a result of moving an editor to another
        // window so we explicitly disable window reordering in this case.
        preserveWindowOrder: true
      };
      this.doOpenEditor(nextActiveEditor, options, internalEditorOpenOptions);
    } else {
      if (editorToClose) {
        this.editorPane.closeEditor(editorToClose);
      }
      if (restoreFocus && !closeEmptyGroup) {
        this.focus();
      }
      this._onDidActiveEditorChange.fire({ editor: void 0 });
      if (closeEmptyGroup) {
        this.groupsView.removeGroup(this, preserveFocus);
      }
    }
  }
  shouldRestoreFocus(target) {
    const activeElement = getActiveElement();
    if (activeElement === target.ownerDocument.body) {
      return true;
    }
    return isAncestor(activeElement, target);
  }
  doCloseInactiveEditor(editor, internalOptions) {
    this.model.closeEditor(editor, internalOptions?.context);
  }
  async handleCloseConfirmation(editors) {
    if (!editors.length) {
      return false;
    }
    const editor = editors.shift();
    let handleCloseConfirmationPromise = this.mapEditorToPendingConfirmation.get(editor);
    if (!handleCloseConfirmationPromise) {
      handleCloseConfirmationPromise = this.doHandleCloseConfirmation(editor);
      this.mapEditorToPendingConfirmation.set(editor, handleCloseConfirmationPromise);
    }
    let veto;
    try {
      veto = await handleCloseConfirmationPromise;
    } finally {
      this.mapEditorToPendingConfirmation.delete(editor);
    }
    if (veto) {
      return veto;
    }
    return this.handleCloseConfirmation(editors);
  }
  async doHandleCloseConfirmation(editor, options) {
    if (!this.shouldConfirmClose(editor)) {
      return false;
    }
    if (editor instanceof SideBySideEditorInput && this.model.contains(editor.primary)) {
      return false;
    }
    if (this.editorPartsView.groups.some((groupView) => {
      if (groupView === this) {
        return false;
      }
      const otherGroup = groupView;
      if (otherGroup.contains(editor, { supportSideBySide: SideBySideEditor.BOTH })) {
        return true;
      }
      if (editor instanceof SideBySideEditorInput && otherGroup.contains(editor.primary)) {
        return true;
      }
      return false;
    })) {
      return false;
    }
    let confirmation = ConfirmResult.CANCEL;
    let saveReason = SaveReason.EXPLICIT;
    let autoSave = false;
    if (!editor.hasCapability(EditorInputCapabilities.Untitled) && !options?.skipAutoSave && !editor.closeHandler) {
      if (this.filesConfigurationService.getAutoSaveMode(editor).mode === AutoSaveMode.ON_FOCUS_CHANGE) {
        autoSave = true;
        confirmation = ConfirmResult.SAVE;
        saveReason = SaveReason.FOCUS_CHANGE;
      } else if (isNative && (isWindows || isLinux) && this.filesConfigurationService.getAutoSaveMode(editor).mode === AutoSaveMode.ON_WINDOW_CHANGE) {
        autoSave = true;
        confirmation = ConfirmResult.SAVE;
        saveReason = SaveReason.WINDOW_CHANGE;
      }
    }
    if (!autoSave) {
      if (!this.activeEditor || !this.activeEditor.matches(editor)) {
        await this.doOpenEditor(editor);
      }
      await this.hostService.focus(getWindow(this.element));
      if (typeof editor.closeHandler?.confirm === "function") {
        confirmation = await editor.closeHandler.confirm([{ editor, groupId: this.id }]);
      } else {
        let name;
        if (editor instanceof SideBySideEditorInput) {
          name = editor.primary.getName();
        } else {
          name = editor.getName();
        }
        confirmation = await this.fileDialogService.showSaveConfirm([name]);
      }
    }
    if (!editor.closeHandler && !this.shouldConfirmClose(editor)) {
      return confirmation === ConfirmResult.CANCEL ? true : false;
    }
    switch (confirmation) {
      case ConfirmResult.SAVE: {
        const result = await editor.save(this.id, { reason: saveReason });
        if (!result && autoSave) {
          return this.doHandleCloseConfirmation(editor, { skipAutoSave: true });
        }
        return editor.isDirty();
      }
      case ConfirmResult.DONT_SAVE:
        try {
          await editor.revert(this.id);
          return editor.isDirty();
        } catch (error) {
          this.logService.error(error);
          await editor.revert(this.id, { soft: true });
          return editor.isDirty();
        }
      case ConfirmResult.CANCEL:
        return true;
    }
  }
  shouldConfirmClose(editor) {
    if (editor.closeHandler) {
      return editor.closeHandler.showConfirm();
    }
    return editor.isDirty() && !editor.isSaving();
  }
  //#endregion
  //#region closeEditors()
  async closeEditors(args, options) {
    if (this.isEmpty) {
      return true;
    }
    const editors = this.doGetEditorsToClose(args);
    const veto = await this.handleCloseConfirmation(editors.slice(0));
    if (veto) {
      return false;
    }
    this.doCloseEditors(editors, options);
    return true;
  }
  doGetEditorsToClose(args) {
    if (Array.isArray(args)) {
      return args;
    }
    const filter = args;
    const hasDirection = typeof filter.direction === "number";
    let editorsToClose = this.model.getEditors(hasDirection ? EditorsOrder.SEQUENTIAL : EditorsOrder.MOST_RECENTLY_ACTIVE, filter);
    if (filter.savedOnly) {
      editorsToClose = editorsToClose.filter((editor) => !editor.isDirty() || editor.isSaving());
    } else if (hasDirection && filter.except) {
      editorsToClose = filter.direction === CloseDirection.LEFT ? editorsToClose.slice(0, this.model.indexOf(filter.except, editorsToClose)) : editorsToClose.slice(this.model.indexOf(filter.except, editorsToClose) + 1);
    } else if (filter.except) {
      editorsToClose = editorsToClose.filter((editor) => filter.except && !editor.matches(filter.except));
    }
    return editorsToClose;
  }
  doCloseEditors(editors, options) {
    let closeActiveEditor = false;
    for (const editor of editors) {
      if (!this.isActive(editor)) {
        this.doCloseInactiveEditor(editor);
      } else {
        closeActiveEditor = true;
      }
    }
    if (closeActiveEditor) {
      this.doCloseActiveEditor(options?.preserveFocus);
    }
    if (editors.length) {
      this.titleControl.closeEditors(editors);
    }
  }
  //#endregion
  //#region closeAllEditors()
  async closeAllEditors(options) {
    if (this.isEmpty) {
      if (this.groupsView.partOptions.closeEmptyGroups) {
        this.groupsView.removeGroup(this);
      }
      return true;
    }
    let editors = this.model.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE, options);
    if (options?.excludeConfirming) {
      editors = editors.filter((editor) => !this.shouldConfirmClose(editor));
    }
    const veto = await this.handleCloseConfirmation(editors);
    if (veto) {
      return false;
    }
    this.doCloseAllEditors(options);
    return true;
  }
  doCloseAllEditors(options) {
    let editors = this.model.getEditors(EditorsOrder.SEQUENTIAL, options);
    if (options?.excludeConfirming) {
      editors = editors.filter((editor) => !this.shouldConfirmClose(editor));
    }
    const editorsToClose = [];
    for (const editor of editors) {
      if (!this.isActive(editor)) {
        this.doCloseInactiveEditor(editor);
      }
      editorsToClose.push(editor);
    }
    if (this.activeEditor && editorsToClose.includes(this.activeEditor)) {
      this.doCloseActiveEditor();
    }
    if (editorsToClose.length) {
      this.titleControl.closeEditors(editorsToClose);
    }
  }
  //#endregion
  //#region replaceEditors()
  async replaceEditors(editors) {
    let activeReplacement;
    const inactiveReplacements = [];
    for (let { editor, replacement, forceReplaceDirty, options } of editors) {
      const index = this.getIndexOfEditor(editor);
      if (index >= 0) {
        const isActiveEditor = this.isActive(editor);
        if (options) {
          options.index = index;
        } else {
          options = { index };
        }
        options.inactive = !isActiveEditor;
        options.pinned = options.pinned ?? true;
        const editorToReplace = { editor, replacement, forceReplaceDirty, options };
        if (isActiveEditor) {
          activeReplacement = editorToReplace;
        } else {
          inactiveReplacements.push(editorToReplace);
        }
      }
    }
    for (const { editor, replacement, forceReplaceDirty, options } of inactiveReplacements) {
      await this.doOpenEditor(replacement, options);
      if (!editor.matches(replacement)) {
        let closed = false;
        if (forceReplaceDirty) {
          this.doCloseEditor(editor, true, { context: EditorCloseContext.REPLACE });
          closed = true;
        } else {
          closed = await this.doCloseEditorWithConfirmationHandling(editor, { preserveFocus: true }, { context: EditorCloseContext.REPLACE });
        }
        if (!closed) {
          return;
        }
      }
    }
    if (activeReplacement) {
      const openEditorResult = this.doOpenEditor(activeReplacement.replacement, activeReplacement.options);
      if (!activeReplacement.editor.matches(activeReplacement.replacement)) {
        if (activeReplacement.forceReplaceDirty) {
          this.doCloseEditor(activeReplacement.editor, true, { context: EditorCloseContext.REPLACE });
        } else {
          await this.doCloseEditorWithConfirmationHandling(activeReplacement.editor, { preserveFocus: true }, { context: EditorCloseContext.REPLACE });
        }
      }
      await openEditorResult;
    }
  }
  //#endregion
  //#region Locking
  get isLocked() {
    return this.model.isLocked;
  }
  lock(locked) {
    this.model.lock(locked);
  }
  //#endregion
  //#region Editor Actions
  createEditorActions(disposables) {
    let actions = { primary: [], secondary: [] };
    let onDidChange;
    const activeEditorPane = this.activeEditorPane;
    if (activeEditorPane instanceof EditorPane) {
      const editorScopedContextKeyService = activeEditorPane.scopedContextKeyService ?? this.scopedContextKeyService;
      const editorTitleMenu = disposables.add(this.menuService.createMenu(MenuId.EditorTitle, editorScopedContextKeyService, { emitEventsForSubmenuChanges: true, eventDebounceDelay: 0 }));
      onDidChange = editorTitleMenu.onDidChange;
      const shouldInlineGroup = (action, group) => group === "navigation" && action.actions.length <= 1;
      actions = getActionBarActions(
        editorTitleMenu.getActions({ arg: this.resourceContext.get(), shouldForwardArgs: true }),
        "navigation",
        shouldInlineGroup
      );
    } else {
      const _onDidChange = disposables.add(new Emitter());
      onDidChange = _onDidChange.event;
      disposables.add(this.onDidActiveEditorChange(() => _onDidChange.fire()));
    }
    return { actions, onDidChange };
  }
  //#endregion
  //#region Themable
  updateStyles() {
    const isEmpty = this.isEmpty;
    if (isEmpty) {
      this.element.style.backgroundColor = this.getColor(EDITOR_GROUP_EMPTY_BACKGROUND) || "";
    } else {
      this.element.style.backgroundColor = "";
    }
    const borderColor = this.getColor(EDITOR_GROUP_HEADER_BORDER) || this.getColor(contrastBorder);
    if (!isEmpty && borderColor) {
      this.titleContainer.classList.add("title-border-bottom");
      this.titleContainer.style.setProperty("--title-border-bottom-color", borderColor);
    } else {
      this.titleContainer.classList.remove("title-border-bottom");
      this.titleContainer.style.removeProperty("--title-border-bottom-color");
    }
    const { showTabs } = this.groupsView.partOptions;
    this.titleContainer.style.backgroundColor = this.getColor(showTabs === "multiple" ? EDITOR_GROUP_HEADER_TABS_BACKGROUND : EDITOR_GROUP_HEADER_NO_TABS_BACKGROUND) || "";
    this.editorContainer.style.backgroundColor = this.getColor(editorBackground) || "";
  }
  get minimumWidth() {
    return this.editorPane.minimumWidth;
  }
  get minimumHeight() {
    return this.editorPane.minimumHeight;
  }
  get maximumWidth() {
    return this.editorPane.maximumWidth;
  }
  get maximumHeight() {
    return this.editorPane.maximumHeight;
  }
  get proportionalLayout() {
    if (!this.lastLayout) {
      return true;
    }
    return !(this.lastLayout.width === this.minimumWidth || this.lastLayout.height === this.minimumHeight);
  }
  layout(width, height, top, left) {
    this.lastLayout = { width, height, top, left };
    this.element.classList.toggle("max-height-478px", height <= 478);
    const titleControlSize = this.titleControl.layout({
      container: new Dimension(width, height),
      available: new Dimension(width, height - this.editorPane.minimumHeight)
    });
    this.progressBar.getContainer().style.top = `${Math.max(this.titleHeight.offset - 2, 0)}px`;
    const editorHeight = Math.max(0, height - titleControlSize.height);
    this.editorContainer.style.height = `${editorHeight}px`;
    this.editorPane.layout({ width, height: editorHeight, top: top + titleControlSize.height, left });
  }
  relayout() {
    if (this.lastLayout) {
      const { width, height, top, left } = this.lastLayout;
      this.layout(width, height, top, left);
    }
  }
  setBoundarySashes(sashes) {
    this.editorPane.setBoundarySashes(sashes);
  }
  toJSON() {
    return this.model.serialize();
  }
  //#endregion
  dispose() {
    this._disposed = true;
    this._onWillDispose.fire();
    super.dispose();
  }
};
EditorGroupView = __decorateClass([
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, ITelemetryService),
  __decorateParam(10, IKeybindingService),
  __decorateParam(11, IMenuService),
  __decorateParam(12, IContextMenuService),
  __decorateParam(13, IFileDialogService),
  __decorateParam(14, IEditorService),
  __decorateParam(15, IFilesConfigurationService),
  __decorateParam(16, IUriIdentityService),
  __decorateParam(17, ILogService),
  __decorateParam(18, IEditorResolverService),
  __decorateParam(19, IHostService),
  __decorateParam(20, IDialogService),
  __decorateParam(21, IFileService)
], EditorGroupView);
export {
  EditorGroupView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yR3JvdXBWaWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL21lZGlhL2VkaXRvcmdyb3Vwdmlldy5jc3MnO1xuaW1wb3J0IHsgRWRpdG9yR3JvdXBNb2RlbCwgSUVkaXRvck9wZW5PcHRpb25zLCBJR3JvdXBNb2RlbENoYW5nZUV2ZW50LCBJU2VyaWFsaXplZEVkaXRvckdyb3VwTW9kZWwsIGlzR3JvdXBFZGl0b3JDbG9zZUV2ZW50LCBpc0dyb3VwRWRpdG9yT3BlbkV2ZW50LCBpc1NlcmlhbGl6ZWRFZGl0b3JHcm91cE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JHcm91cE1vZGVsLmpzJztcbmltcG9ydCB7IEdyb3VwSWRlbnRpZmllciwgQ2xvc2VEaXJlY3Rpb24sIElFZGl0b3JDbG9zZUV2ZW50LCBJRWRpdG9yUGFuZSwgU2F2ZVJlYXNvbiwgSUVkaXRvclBhcnRPcHRpb25zQ2hhbmdlRXZlbnQsIEVkaXRvcnNPcmRlciwgSVZpc2libGVFZGl0b3JQYW5lLCBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLCBFZGl0b3JJbnB1dENhcGFiaWxpdGllcywgSVVudHlwZWRFZGl0b3JJbnB1dCwgREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04sIFNpZGVCeVNpZGVFZGl0b3IsIEVkaXRvckNsb3NlQ29udGV4dCwgSUVkaXRvcldpbGxNb3ZlRXZlbnQsIElFZGl0b3JXaWxsT3BlbkV2ZW50LCBJTWF0Y2hFZGl0b3JPcHRpb25zLCBHcm91cE1vZGVsQ2hhbmdlS2luZCwgSUFjdGl2ZUVkaXRvckNoYW5nZUV2ZW50LCBJRmluZEVkaXRvck9wdGlvbnMsIFRFWFRfRElGRl9FRElUT1JfSUQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEFjdGl2ZUVkaXRvckdyb3VwTG9ja2VkQ29udGV4dCwgQWN0aXZlRWRpdG9yRGlydHlDb250ZXh0LCBFZGl0b3JHcm91cEVkaXRvcnNDb3VudENvbnRleHQsIEFjdGl2ZUVkaXRvclN0aWNreUNvbnRleHQsIEFjdGl2ZUVkaXRvclBpbm5lZENvbnRleHQsIEFjdGl2ZUVkaXRvckxhc3RJbkdyb3VwQ29udGV4dCwgQWN0aXZlRWRpdG9yRmlyc3RJbkdyb3VwQ29udGV4dCwgUmVzb3VyY2VDb250ZXh0S2V5LCBhcHBseUF2YWlsYWJsZUVkaXRvcklkcywgQWN0aXZlRWRpdG9yQXZhaWxhYmxlRWRpdG9ySWRzQ29udGV4dCwgQWN0aXZlRWRpdG9yQ2FuU3BsaXRJbkdyb3VwQ29udGV4dCwgU2lkZUJ5U2lkZUVkaXRvckFjdGl2ZUNvbnRleHQsIFRleHRDb21wYXJlRWRpdG9yVmlzaWJsZUNvbnRleHQsIFRleHRDb21wYXJlRWRpdG9yQWN0aXZlQ29udGV4dCwgQWN0aXZlRWRpdG9yQ29udGV4dCwgQWN0aXZlRWRpdG9yUmVhZG9ubHlDb250ZXh0LCBBY3RpdmVFZGl0b3JDYW5SZXZlcnRDb250ZXh0LCBBY3RpdmVFZGl0b3JDYW5Ub2dnbGVSZWFkb25seUNvbnRleHQsIEFjdGl2ZUNvbXBhcmVFZGl0b3JDYW5Td2FwQ29udGV4dCwgTXVsdGlwbGVFZGl0b3JzU2VsZWN0ZWRJbkdyb3VwQ29udGV4dCwgVHdvRWRpdG9yc1NlbGVjdGVkSW5Hcm91cENvbnRleHQsIFNlbGVjdGVkRWRpdG9yc0luR3JvdXBGaWxlT3JVbnRpdGxlZFJlc291cmNlQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgU2lkZUJ5U2lkZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9zaWRlQnlTaWRlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgUmVsYXkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IERpbWVuc2lvbiwgdHJhY2tGb2N1cywgYWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBFdmVudFR5cGUsIEV2ZW50SGVscGVyLCBmaW5kUGFyZW50V2l0aENsYXNzLCBpc0FuY2VzdG9yLCBJRG9tTm9kZVBhZ2VQb3NpdGlvbiwgaXNNb3VzZUV2ZW50LCBpc0FjdGl2ZUVsZW1lbnQsIGdldFdpbmRvdywgZ2V0QWN0aXZlRWxlbWVudCwgJCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFByb2dyZXNzQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Byb2dyZXNzYmFyL3Byb2dyZXNzYmFyLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UsIFRoZW1hYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBlZGl0b3JCYWNrZ3JvdW5kLCBjb250cmFzdEJvcmRlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEVESVRPUl9HUk9VUF9IRUFERVJfVEFCU19CQUNLR1JPVU5ELCBFRElUT1JfR1JPVVBfSEVBREVSX05PX1RBQlNfQkFDS0dST1VORCwgRURJVE9SX0dST1VQX0VNUFRZX0JBQ0tHUk9VTkQsIEVESVRPUl9HUk9VUF9IRUFERVJfQk9SREVSIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IElDbG9zZUVkaXRvcnNGaWx0ZXIsIEdyb3Vwc09yZGVyLCBJQ2xvc2VFZGl0b3JPcHRpb25zLCBJQ2xvc2VBbGxFZGl0b3JzT3B0aW9ucywgSUVkaXRvclJlcGxhY2VtZW50LCBJQWN0aXZlRWRpdG9yQWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JQYW5lcyB9IGZyb20gJy4vZWRpdG9yUGFuZXMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclByb2dyZXNzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JQcm9ncmVzc0luZGljYXRvciB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3Byb2dyZXNzL2Jyb3dzZXIvcHJvZ3Jlc3NJbmRpY2F0b3IuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgY29hbGVzY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgRGVmZXJyZWRQcm9taXNlLCBQcm9taXNlcywgUnVuT25jZVdvcmtlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEV2ZW50VHlwZSBhcyBUb3VjaEV2ZW50VHlwZSwgR2VzdHVyZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3RvdWNoLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNWaWV3LCBJRWRpdG9yR3JvdXBWaWV3LCBmaWxsQWN0aXZlRWRpdG9yVmlld1N0YXRlLCBFZGl0b3JTZXJ2aWNlSW1wbCwgSUVkaXRvckdyb3VwVGl0bGVIZWlnaHQsIElJbnRlcm5hbEVkaXRvck9wZW5PcHRpb25zLCBJSW50ZXJuYWxNb3ZlQ29weU9wdGlvbnMsIElJbnRlcm5hbEVkaXRvckNsb3NlT3B0aW9ucywgSUludGVybmFsRWRpdG9yVGl0bGVDb250cm9sT3B0aW9ucywgSUVkaXRvclBhcnRzVmlldywgSUVkaXRvckdyb3VwVmlld09wdGlvbnMgfSBmcm9tICcuL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IFN1Ym1lbnVBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElNZW51U2VydmljZSwgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBnZXRBY3Rpb25CYXJBY3Rpb25zLCBQcmltYXJ5QW5kU2Vjb25kYXJ5QWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBoYXNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGFzaC5qcyc7XG5pbXBvcnQgeyBnZXRNaW1lVHlwZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlc0Fzc29jaWF0aW9ucy5qcyc7XG5pbXBvcnQgeyBleHRuYW1lLCBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGl2YXRpb24sIElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUZpbGVEaWFsb2dTZXJ2aWNlLCBDb25maXJtUmVzdWx0LCBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsIEF1dG9TYXZlTW9kZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2ZpbGVzQ29uZmlndXJhdGlvbi9jb21tb24vZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4LCBpc01hY2ludG9zaCwgaXNOYXRpdmUsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgVGVsZW1ldHJ5VHJ1c3RlZFZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnlVdGlscy5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0UHJvZ3Jlc3NCYXJTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgSUJvdW5kYXJ5U2FzaGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Nhc2gvc2FzaC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JHcm91cFdhdGVybWFyayB9IGZyb20gJy4vZWRpdG9yR3JvdXBXYXRlcm1hcmsuanMnO1xuaW1wb3J0IHsgRWRpdG9yVGl0bGVDb250cm9sIH0gZnJvbSAnLi9lZGl0b3JUaXRsZUNvbnRyb2wuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZSB9IGZyb20gJy4vZWRpdG9yUGFuZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JSZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9kaWZmRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLCBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgRWRpdG9yR3JvdXBWaWV3IGV4dGVuZHMgVGhlbWFibGUgaW1wbGVtZW50cyBJRWRpdG9yR3JvdXBWaWV3IHtcblxuXHQvLyNyZWdpb24gZmFjdG9yeVxuXG5cdHN0YXRpYyBjcmVhdGVOZXcoZWRpdG9yUGFydHNWaWV3OiBJRWRpdG9yUGFydHNWaWV3LCBncm91cHNWaWV3OiBJRWRpdG9yR3JvdXBzVmlldywgZ3JvdXBzTGFiZWw6IHN0cmluZywgZ3JvdXBJbmRleDogbnVtYmVyLCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBvcHRpb25zPzogSUVkaXRvckdyb3VwVmlld09wdGlvbnMpOiBJRWRpdG9yR3JvdXBWaWV3IHtcblx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRWRpdG9yR3JvdXBWaWV3LCBudWxsLCBlZGl0b3JQYXJ0c1ZpZXcsIGdyb3Vwc1ZpZXcsIGdyb3Vwc0xhYmVsLCBncm91cEluZGV4LCBvcHRpb25zKTtcblx0fVxuXG5cdHN0YXRpYyBjcmVhdGVGcm9tU2VyaWFsaXplZChzZXJpYWxpemVkOiBJU2VyaWFsaXplZEVkaXRvckdyb3VwTW9kZWwsIGVkaXRvclBhcnRzVmlldzogSUVkaXRvclBhcnRzVmlldywgZ3JvdXBzVmlldzogSUVkaXRvckdyb3Vwc1ZpZXcsIGdyb3Vwc0xhYmVsOiBzdHJpbmcsIGdyb3VwSW5kZXg6IG51bWJlciwgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSwgb3B0aW9ucz86IElFZGl0b3JHcm91cFZpZXdPcHRpb25zKTogSUVkaXRvckdyb3VwVmlldyB7XG5cdFx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRvckdyb3VwVmlldywgc2VyaWFsaXplZCwgZWRpdG9yUGFydHNWaWV3LCBncm91cHNWaWV3LCBncm91cHNMYWJlbCwgZ3JvdXBJbmRleCwgb3B0aW9ucyk7XG5cdH1cblxuXHRzdGF0aWMgY3JlYXRlQ29weShjb3B5RnJvbTogSUVkaXRvckdyb3VwVmlldywgZWRpdG9yUGFydHNWaWV3OiBJRWRpdG9yUGFydHNWaWV3LCBncm91cHNWaWV3OiBJRWRpdG9yR3JvdXBzVmlldywgZ3JvdXBzTGFiZWw6IHN0cmluZywgZ3JvdXBJbmRleDogbnVtYmVyLCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBvcHRpb25zPzogSUVkaXRvckdyb3VwVmlld09wdGlvbnMpOiBJRWRpdG9yR3JvdXBWaWV3IHtcblx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRWRpdG9yR3JvdXBWaWV3LCBjb3B5RnJvbSwgZWRpdG9yUGFydHNWaWV3LCBncm91cHNWaWV3LCBncm91cHNMYWJlbCwgZ3JvdXBJbmRleCwgb3B0aW9ucyk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvKipcblx0ICogQWNjZXNzIHRvIHRoZSBjb250ZXh0IGtleSBzZXJ2aWNlIHNjb3BlZCB0byB0aGlzIGVkaXRvciBncm91cC5cblx0ICovXG5cdHJlYWRvbmx5IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2U7XG5cblx0Ly8jcmVnaW9uIGV2ZW50c1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRm9jdXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRGb2N1cyA9IHRoaXMuX29uRGlkRm9jdXMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsRGlzcG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbldpbGxEaXNwb3NlID0gdGhpcy5fb25XaWxsRGlzcG9zZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZE1vZGVsQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUdyb3VwTW9kZWxDaGFuZ2VFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkTW9kZWxDaGFuZ2UgPSB0aGlzLl9vbkRpZE1vZGVsQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUFjdGl2ZUVkaXRvckNoYW5nZUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UgPSB0aGlzLl9vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZE9wZW5FZGl0b3JGYWlsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8RWRpdG9ySW5wdXQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZE9wZW5FZGl0b3JGYWlsID0gdGhpcy5fb25EaWRPcGVuRWRpdG9yRmFpbC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbldpbGxDbG9zZUVkaXRvciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElFZGl0b3JDbG9zZUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25XaWxsQ2xvc2VFZGl0b3IgPSB0aGlzLl9vbldpbGxDbG9zZUVkaXRvci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENsb3NlRWRpdG9yID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUVkaXRvckNsb3NlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENsb3NlRWRpdG9yID0gdGhpcy5fb25EaWRDbG9zZUVkaXRvci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbldpbGxNb3ZlRWRpdG9yID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUVkaXRvcldpbGxNb3ZlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbldpbGxNb3ZlRWRpdG9yID0gdGhpcy5fb25XaWxsTW92ZUVkaXRvci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbldpbGxPcGVuRWRpdG9yID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUVkaXRvcldpbGxPcGVuRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbldpbGxPcGVuRWRpdG9yID0gdGhpcy5fb25XaWxsT3BlbkVkaXRvci5ldmVudDtcblxuXHQvLyNlbmRyZWdpb25cblxuXHRwcml2YXRlIHJlYWRvbmx5IG1vZGVsOiBFZGl0b3JHcm91cE1vZGVsO1xuXG5cdHByaXZhdGUgYWN0aXZlOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGxhc3RMYXlvdXQ6IElEb21Ob2RlUGFnZVBvc2l0aW9uIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHJlc291cmNlQ29udGV4dDogUmVzb3VyY2VDb250ZXh0S2V5O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgdGl0bGVDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IHRpdGxlQ29udHJvbDogRWRpdG9yVGl0bGVDb250cm9sO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcHJvZ3Jlc3NCYXI6IFByb2dyZXNzQmFyO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yQ29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JQYW5lOiBFZGl0b3JQYW5lcztcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2VkRWRpdG9yc1dvcmtlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlV29ya2VyPEVkaXRvcklucHV0PihlZGl0b3JzID0+IHRoaXMuaGFuZGxlRGlzcG9zZWRFZGl0b3JzKGVkaXRvcnMpLCAwKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBtYXBFZGl0b3JUb1BlbmRpbmdDb25maXJtYXRpb24gPSBuZXcgTWFwPEVkaXRvcklucHV0LCBQcm9taXNlPGJvb2xlYW4+PigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY29udGFpbmVyVG9vbEJhck1lbnVEaXNwb3NhYmxlID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgd2hlblJlc3RvcmVkUHJvbWlzZSA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0cmVhZG9ubHkgd2hlblJlc3RvcmVkID0gdGhpcy53aGVuUmVzdG9yZWRQcm9taXNlLnA7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZnJvbTogSUVkaXRvckdyb3VwVmlldyB8IElTZXJpYWxpemVkRWRpdG9yR3JvdXBNb2RlbCB8IG51bGwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JQYXJ0c1ZpZXc6IElFZGl0b3JQYXJ0c1ZpZXcsXG5cdFx0cmVhZG9ubHkgZ3JvdXBzVmlldzogSUVkaXRvckdyb3Vwc1ZpZXcsXG5cdFx0cHJpdmF0ZSBncm91cHNMYWJlbDogc3RyaW5nLFxuXHRcdHByaXZhdGUgX2luZGV4OiBudW1iZXIsXG5cdFx0b3B0aW9uczogSUVkaXRvckdyb3VwVmlld09wdGlvbnMgfCB1bmRlZmluZWQsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJRmlsZURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlRGlhbG9nU2VydmljZTogSUZpbGVEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IEVkaXRvclNlcnZpY2VJbXBsLFxuXHRcdEBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2U6IElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlOiBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKHRoZW1lU2VydmljZSk7XG5cblx0XHRpZiAoZnJvbSBpbnN0YW5jZW9mIEVkaXRvckdyb3VwVmlldykge1xuXHRcdFx0dGhpcy5tb2RlbCA9IHRoaXMuX3JlZ2lzdGVyKGZyb20ubW9kZWwuY2xvbmUoKSk7XG5cdFx0fSBlbHNlIGlmIChpc1NlcmlhbGl6ZWRFZGl0b3JHcm91cE1vZGVsKGZyb20pKSB7XG5cdFx0XHR0aGlzLm1vZGVsID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRWRpdG9yR3JvdXBNb2RlbCwgZnJvbSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm1vZGVsID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRWRpdG9yR3JvdXBNb2RlbCwgdW5kZWZpbmVkKSk7XG5cdFx0fVxuXG5cdFx0Ly8jcmVnaW9uIGNyZWF0ZSgpXG5cdFx0e1xuXHRcdFx0Ly8gU2NvcGVkIGNvbnRleHQga2V5IHNlcnZpY2Vcblx0XHRcdHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2UgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZCh0aGlzLmVsZW1lbnQpKTtcblxuXHRcdFx0Ly8gQ29udGFpbmVyXG5cdFx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCguLi5jb2FsZXNjZShbJ2VkaXRvci1ncm91cC1jb250YWluZXInLCB0aGlzLm1vZGVsLmlzTG9ja2VkID8gJ2xvY2tlZCcgOiB1bmRlZmluZWRdKSk7XG5cblx0XHRcdC8vIENvbnRhaW5lciBsaXN0ZW5lcnNcblx0XHRcdHRoaXMucmVnaXN0ZXJDb250YWluZXJMaXN0ZW5lcnMoKTtcblxuXHRcdFx0Ly8gQ29udGFpbmVyIHRvb2xiYXJcblx0XHRcdHRoaXMuY3JlYXRlQ29udGFpbmVyVG9vbGJhcigpO1xuXG5cdFx0XHQvLyBDb250YWluZXIgY29udGV4dCBtZW51XG5cdFx0XHR0aGlzLmNyZWF0ZUNvbnRhaW5lckNvbnRleHRNZW51KCk7XG5cblx0XHRcdC8vIFdhdGVybWFyayAmIHNob3J0Y3V0c1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFZGl0b3JHcm91cFdhdGVybWFyaywgdGhpcy5lbGVtZW50KSk7XG5cblx0XHRcdC8vIFByb2dyZXNzIGJhclxuXHRcdFx0dGhpcy5wcm9ncmVzc0JhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBQcm9ncmVzc0Jhcih0aGlzLmVsZW1lbnQsIGRlZmF1bHRQcm9ncmVzc0JhclN0eWxlcykpO1xuXHRcdFx0dGhpcy5wcm9ncmVzc0Jhci5oaWRlKCk7XG5cblx0XHRcdC8vIFNjb3BlZCBpbnN0YW50aWF0aW9uIHNlcnZpY2Vcblx0XHRcdHRoaXMuc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihcblx0XHRcdFx0W0lDb250ZXh0S2V5U2VydmljZSwgdGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZV0sXG5cdFx0XHRcdFtJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlLCB0aGlzLl9yZWdpc3RlcihuZXcgRWRpdG9yUHJvZ3Jlc3NJbmRpY2F0b3IodGhpcy5wcm9ncmVzc0JhciwgdGhpcykpXVxuXHRcdFx0KSkpO1xuXG5cdFx0XHQvLyBDb250ZXh0IGtleXNcblx0XHRcdHRoaXMucmVzb3VyY2VDb250ZXh0ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5zY29wZWRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvdXJjZUNvbnRleHRLZXkpKTtcblx0XHRcdHRoaXMuaGFuZGxlR3JvdXBDb250ZXh0S2V5cygpO1xuXG5cdFx0XHQvLyBUaXRsZSBjb250YWluZXJcblx0XHRcdHRoaXMudGl0bGVDb250YWluZXIgPSAkKCcudGl0bGUnKTtcblx0XHRcdHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZCh0aGlzLnRpdGxlQ29udGFpbmVyKTtcblxuXHRcdFx0Ly8gVGl0bGUgY29udHJvbFxuXHRcdFx0dGhpcy50aXRsZUNvbnRyb2wgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLnNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRvclRpdGxlQ29udHJvbCwgdGhpcy50aXRsZUNvbnRhaW5lciwgdGhpcy5lZGl0b3JQYXJ0c1ZpZXcsIHRoaXMuZ3JvdXBzVmlldywgdGhpcywgdGhpcy5tb2RlbCkpO1xuXG5cdFx0XHQvLyBFZGl0b3IgY29udGFpbmVyXG5cdFx0XHR0aGlzLmVkaXRvckNvbnRhaW5lciA9ICQoJy5lZGl0b3ItY29udGFpbmVyJyk7XG5cdFx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5lZGl0b3JDb250YWluZXIpO1xuXG5cdFx0XHQvLyBFZGl0b3IgcGFuZVxuXHRcdFx0dGhpcy5lZGl0b3JQYW5lID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5zY29wZWRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFZGl0b3JQYW5lcywgdGhpcy5lbGVtZW50LCB0aGlzLmVkaXRvckNvbnRhaW5lciwgdGhpcykpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuaW5wdXQgPSB0aGlzLmVkaXRvclBhbmUub25EaWRDaGFuZ2VTaXplQ29uc3RyYWludHM7XG5cblx0XHRcdC8vIFRyYWNrIEZvY3VzXG5cdFx0XHR0aGlzLmRvVHJhY2tGb2N1cygpO1xuXG5cdFx0XHQvLyBVcGRhdGUgY29udGFpbmVyc1xuXHRcdFx0dGhpcy51cGRhdGVUaXRsZUNvbnRhaW5lcigpO1xuXHRcdFx0dGhpcy51cGRhdGVDb250YWluZXIoKTtcblxuXHRcdFx0Ly8gVXBkYXRlIHN0eWxlc1xuXHRcdFx0dGhpcy51cGRhdGVTdHlsZXMoKTtcblx0XHR9XG5cdFx0Ly8jZW5kcmVnaW9uXG5cblx0XHQvLyBSZXN0b3JlIGVkaXRvcnMgaWYgcHJvdmlkZWRcblx0XHRjb25zdCByZXN0b3JlRWRpdG9yc1Byb21pc2UgPSB0aGlzLnJlc3RvcmVFZGl0b3JzKGZyb20sIG9wdGlvbnMpID8/IFByb21pc2UucmVzb2x2ZSgpO1xuXG5cdFx0Ly8gU2lnbmFsIHJlc3RvcmVkIG9uY2UgZWRpdG9ycyBoYXZlIHJlc3RvcmVkXG5cdFx0cmVzdG9yZUVkaXRvcnNQcm9taXNlLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0dGhpcy53aGVuUmVzdG9yZWRQcm9taXNlLmNvbXBsZXRlKCk7XG5cdFx0fSk7XG5cblx0XHQvLyBSZWdpc3RlciBMaXN0ZW5lcnNcblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUdyb3VwQ29udGV4dEtleXMoKTogdm9pZCB7XG5cdFx0Y29uc3QgZ3JvdXBBY3RpdmVFZGl0b3JEaXJ0eUNvbnRleHQgPSB0aGlzLmVkaXRvclBhcnRzVmlldy5iaW5kKEFjdGl2ZUVkaXRvckRpcnR5Q29udGV4dCwgdGhpcyk7XG5cdFx0Y29uc3QgZ3JvdXBBY3RpdmVFZGl0b3JQaW5uZWRDb250ZXh0ID0gdGhpcy5lZGl0b3JQYXJ0c1ZpZXcuYmluZChBY3RpdmVFZGl0b3JQaW5uZWRDb250ZXh0LCB0aGlzKTtcblx0XHRjb25zdCBncm91cEFjdGl2ZUVkaXRvckZpcnN0Q29udGV4dCA9IHRoaXMuZWRpdG9yUGFydHNWaWV3LmJpbmQoQWN0aXZlRWRpdG9yRmlyc3RJbkdyb3VwQ29udGV4dCwgdGhpcyk7XG5cdFx0Y29uc3QgZ3JvdXBBY3RpdmVFZGl0b3JMYXN0Q29udGV4dCA9IHRoaXMuZWRpdG9yUGFydHNWaWV3LmJpbmQoQWN0aXZlRWRpdG9yTGFzdEluR3JvdXBDb250ZXh0LCB0aGlzKTtcblx0XHRjb25zdCBncm91cEFjdGl2ZUVkaXRvclN0aWNreUNvbnRleHQgPSB0aGlzLmVkaXRvclBhcnRzVmlldy5iaW5kKEFjdGl2ZUVkaXRvclN0aWNreUNvbnRleHQsIHRoaXMpO1xuXHRcdGNvbnN0IGdyb3VwRWRpdG9yc0NvdW50Q29udGV4dCA9IHRoaXMuZWRpdG9yUGFydHNWaWV3LmJpbmQoRWRpdG9yR3JvdXBFZGl0b3JzQ291bnRDb250ZXh0LCB0aGlzKTtcblx0XHRjb25zdCBncm91cExvY2tlZENvbnRleHQgPSB0aGlzLmVkaXRvclBhcnRzVmlldy5iaW5kKEFjdGl2ZUVkaXRvckdyb3VwTG9ja2VkQ29udGV4dCwgdGhpcyk7XG5cblx0XHRjb25zdCBtdWx0aXBsZUVkaXRvcnNTZWxlY3RlZENvbnRleHQgPSBNdWx0aXBsZUVkaXRvcnNTZWxlY3RlZEluR3JvdXBDb250ZXh0LmJpbmRUbyh0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRjb25zdCB0d29FZGl0b3JzU2VsZWN0ZWRDb250ZXh0ID0gVHdvRWRpdG9yc1NlbGVjdGVkSW5Hcm91cENvbnRleHQuYmluZFRvKHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IHNlbGVjdGVkRWRpdG9yc0hhdmVGaWxlT3JVbnRpdGxlZFJlc291cmNlQ29udGV4dCA9IFNlbGVjdGVkRWRpdG9yc0luR3JvdXBGaWxlT3JVbnRpdGxlZFJlc291cmNlQ29udGV4dEtleS5iaW5kVG8odGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRjb25zdCBncm91cEFjdGl2ZUVkaXRvckNvbnRleHQgPSB0aGlzLmVkaXRvclBhcnRzVmlldy5iaW5kKEFjdGl2ZUVkaXRvckNvbnRleHQsIHRoaXMpO1xuXHRcdGNvbnN0IGdyb3VwQWN0aXZlRWRpdG9ySXNSZWFkb25seSA9IHRoaXMuZWRpdG9yUGFydHNWaWV3LmJpbmQoQWN0aXZlRWRpdG9yUmVhZG9ubHlDb250ZXh0LCB0aGlzKTtcblx0XHRjb25zdCBncm91cEFjdGl2ZUVkaXRvckNhblJldmVydCA9IHRoaXMuZWRpdG9yUGFydHNWaWV3LmJpbmQoQWN0aXZlRWRpdG9yQ2FuUmV2ZXJ0Q29udGV4dCwgdGhpcyk7XG5cdFx0Y29uc3QgZ3JvdXBBY3RpdmVFZGl0b3JDYW5Ub2dnbGVSZWFkb25seSA9IHRoaXMuZWRpdG9yUGFydHNWaWV3LmJpbmQoQWN0aXZlRWRpdG9yQ2FuVG9nZ2xlUmVhZG9ubHlDb250ZXh0LCB0aGlzKTtcblx0XHRjb25zdCBncm91cEFjdGl2ZUNvbXBhcmVFZGl0b3JDYW5Td2FwID0gdGhpcy5lZGl0b3JQYXJ0c1ZpZXcuYmluZChBY3RpdmVDb21wYXJlRWRpdG9yQ2FuU3dhcENvbnRleHQsIHRoaXMpO1xuXHRcdGNvbnN0IGdyb3VwVGV4dENvbXBhcmVFZGl0b3JWaXNpYmxlQ29udGV4dCA9IHRoaXMuZWRpdG9yUGFydHNWaWV3LmJpbmQoVGV4dENvbXBhcmVFZGl0b3JWaXNpYmxlQ29udGV4dCwgdGhpcyk7XG5cdFx0Y29uc3QgZ3JvdXBUZXh0Q29tcGFyZUVkaXRvckFjdGl2ZUNvbnRleHQgPSB0aGlzLmVkaXRvclBhcnRzVmlldy5iaW5kKFRleHRDb21wYXJlRWRpdG9yQWN0aXZlQ29udGV4dCwgdGhpcyk7XG5cblx0XHRjb25zdCBncm91cEFjdGl2ZUVkaXRvckF2YWlsYWJsZUVkaXRvcklkcyA9IHRoaXMuZWRpdG9yUGFydHNWaWV3LmJpbmQoQWN0aXZlRWRpdG9yQXZhaWxhYmxlRWRpdG9ySWRzQ29udGV4dCwgdGhpcyk7XG5cdFx0Y29uc3QgZ3JvdXBBY3RpdmVFZGl0b3JDYW5TcGxpdEluR3JvdXBDb250ZXh0ID0gdGhpcy5lZGl0b3JQYXJ0c1ZpZXcuYmluZChBY3RpdmVFZGl0b3JDYW5TcGxpdEluR3JvdXBDb250ZXh0LCB0aGlzKTtcblx0XHRjb25zdCBncm91cEFjdGl2ZUVkaXRvcklzU2lkZUJ5U2lkZUVkaXRvckNvbnRleHQgPSB0aGlzLmVkaXRvclBhcnRzVmlldy5iaW5kKFNpZGVCeVNpZGVFZGl0b3JBY3RpdmVDb250ZXh0LCB0aGlzKTtcblxuXHRcdGNvbnN0IGFjdGl2ZUVkaXRvckxpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdFx0Y29uc3Qgb2JzZXJ2ZUFjdGl2ZUVkaXRvciA9ICgpID0+IHtcblx0XHRcdGFjdGl2ZUVkaXRvckxpc3RlbmVyLmNsZWFyKCk7XG5cblx0XHRcdHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2UuYnVmZmVyQ2hhbmdlRXZlbnRzKCgpID0+IHtcblx0XHRcdFx0Y29uc3QgYWN0aXZlRWRpdG9yID0gdGhpcy5hY3RpdmVFZGl0b3I7XG5cdFx0XHRcdGNvbnN0IGFjdGl2ZUVkaXRvclBhbmUgPSB0aGlzLmFjdGl2ZUVkaXRvclBhbmU7XG5cblx0XHRcdFx0dGhpcy5yZXNvdXJjZUNvbnRleHQuc2V0KEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0T3JpZ2luYWxVcmkoYWN0aXZlRWRpdG9yLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSkpO1xuXG5cdFx0XHRcdGFwcGx5QXZhaWxhYmxlRWRpdG9ySWRzKGdyb3VwQWN0aXZlRWRpdG9yQXZhaWxhYmxlRWRpdG9ySWRzLCBhY3RpdmVFZGl0b3IsIHRoaXMuZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlKTtcblxuXHRcdFx0XHRpZiAoYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRcdFx0Z3JvdXBBY3RpdmVFZGl0b3JDYW5TcGxpdEluR3JvdXBDb250ZXh0LnNldChhY3RpdmVFZGl0b3IuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5DYW5TcGxpdEluR3JvdXApKTtcblx0XHRcdFx0XHRncm91cEFjdGl2ZUVkaXRvcklzU2lkZUJ5U2lkZUVkaXRvckNvbnRleHQuc2V0KGFjdGl2ZUVkaXRvci50eXBlSWQgPT09IFNpZGVCeVNpZGVFZGl0b3JJbnB1dC5JRCk7XG5cblx0XHRcdFx0XHRncm91cEFjdGl2ZUVkaXRvckRpcnR5Q29udGV4dC5zZXQoYWN0aXZlRWRpdG9yLmlzRGlydHkoKSAmJiAhYWN0aXZlRWRpdG9yLmlzU2F2aW5nKCkpO1xuXHRcdFx0XHRcdGFjdGl2ZUVkaXRvckxpc3RlbmVyLnZhbHVlID0gYWN0aXZlRWRpdG9yLm9uRGlkQ2hhbmdlRGlydHkoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Z3JvdXBBY3RpdmVFZGl0b3JEaXJ0eUNvbnRleHQuc2V0KGFjdGl2ZUVkaXRvci5pc0RpcnR5KCkgJiYgIWFjdGl2ZUVkaXRvci5pc1NhdmluZygpKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRncm91cEFjdGl2ZUVkaXRvckNhblNwbGl0SW5Hcm91cENvbnRleHQuc2V0KGZhbHNlKTtcblx0XHRcdFx0XHRncm91cEFjdGl2ZUVkaXRvcklzU2lkZUJ5U2lkZUVkaXRvckNvbnRleHQuc2V0KGZhbHNlKTtcblx0XHRcdFx0XHRncm91cEFjdGl2ZUVkaXRvckRpcnR5Q29udGV4dC5zZXQoZmFsc2UpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGFjdGl2ZUVkaXRvclBhbmUpIHtcblx0XHRcdFx0XHRncm91cEFjdGl2ZUVkaXRvckNvbnRleHQuc2V0KGFjdGl2ZUVkaXRvclBhbmUuZ2V0SWQoKSk7XG5cdFx0XHRcdFx0Z3JvdXBBY3RpdmVFZGl0b3JDYW5SZXZlcnQuc2V0KCFhY3RpdmVFZGl0b3JQYW5lLmlucHV0Lmhhc0NhcGFiaWxpdHkoRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuVW50aXRsZWQpKTtcblx0XHRcdFx0XHRncm91cEFjdGl2ZUVkaXRvcklzUmVhZG9ubHkuc2V0KCEhYWN0aXZlRWRpdG9yUGFuZS5pbnB1dC5pc1JlYWRvbmx5KCkpO1xuXG5cdFx0XHRcdFx0Y29uc3QgcHJpbWFyeUVkaXRvclJlc291cmNlID0gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRPcmlnaW5hbFVyaShhY3RpdmVFZGl0b3JQYW5lLmlucHV0LCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSk7XG5cdFx0XHRcdFx0Y29uc3Qgc2Vjb25kYXJ5RWRpdG9yUmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGFjdGl2ZUVkaXRvclBhbmUuaW5wdXQsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuU0VDT05EQVJZIH0pO1xuXHRcdFx0XHRcdGdyb3VwQWN0aXZlQ29tcGFyZUVkaXRvckNhblN3YXAuc2V0KGFjdGl2ZUVkaXRvclBhbmUuaW5wdXQgaW5zdGFuY2VvZiBEaWZmRWRpdG9ySW5wdXQgJiYgIWFjdGl2ZUVkaXRvclBhbmUuaW5wdXQub3JpZ2luYWwuaXNSZWFkb25seSgpICYmICEhcHJpbWFyeUVkaXRvclJlc291cmNlICYmICh0aGlzLmZpbGVTZXJ2aWNlLmhhc1Byb3ZpZGVyKHByaW1hcnlFZGl0b3JSZXNvdXJjZSkgfHwgcHJpbWFyeUVkaXRvclJlc291cmNlLnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCkgJiYgISFzZWNvbmRhcnlFZGl0b3JSZXNvdXJjZSAmJiAodGhpcy5maWxlU2VydmljZS5oYXNQcm92aWRlcihzZWNvbmRhcnlFZGl0b3JSZXNvdXJjZSkgfHwgc2Vjb25kYXJ5RWRpdG9yUmVzb3VyY2Uuc2NoZW1lID09PSBTY2hlbWFzLnVudGl0bGVkKSk7XG5cdFx0XHRcdFx0Z3JvdXBBY3RpdmVFZGl0b3JDYW5Ub2dnbGVSZWFkb25seS5zZXQoISFwcmltYXJ5RWRpdG9yUmVzb3VyY2UgJiYgdGhpcy5maWxlU2VydmljZS5oYXNQcm92aWRlcihwcmltYXJ5RWRpdG9yUmVzb3VyY2UpICYmICF0aGlzLmZpbGVTZXJ2aWNlLmhhc0NhcGFiaWxpdHkocHJpbWFyeUVkaXRvclJlc291cmNlLCBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuUmVhZG9ubHkpKTtcblxuXHRcdFx0XHRcdGNvbnN0IGFjdGl2ZVBhbmVEaWZmRWRpdG9yID0gYWN0aXZlRWRpdG9yUGFuZT8uZ2V0SWQoKSA9PT0gVEVYVF9ESUZGX0VESVRPUl9JRDtcblx0XHRcdFx0XHRncm91cFRleHRDb21wYXJlRWRpdG9yQWN0aXZlQ29udGV4dC5zZXQoYWN0aXZlUGFuZURpZmZFZGl0b3IpO1xuXHRcdFx0XHRcdGdyb3VwVGV4dENvbXBhcmVFZGl0b3JWaXNpYmxlQ29udGV4dC5zZXQoYWN0aXZlUGFuZURpZmZFZGl0b3IpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGdyb3VwQWN0aXZlRWRpdG9yQ29udGV4dC5yZXNldCgpO1xuXHRcdFx0XHRcdGdyb3VwQWN0aXZlRWRpdG9yQ2FuUmV2ZXJ0LnJlc2V0KCk7XG5cdFx0XHRcdFx0Z3JvdXBBY3RpdmVFZGl0b3JJc1JlYWRvbmx5LnJlc2V0KCk7XG5cdFx0XHRcdFx0Z3JvdXBBY3RpdmVDb21wYXJlRWRpdG9yQ2FuU3dhcC5yZXNldCgpO1xuXHRcdFx0XHRcdGdyb3VwQWN0aXZlRWRpdG9yQ2FuVG9nZ2xlUmVhZG9ubHkucmVzZXQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdC8vIFVwZGF0ZSBncm91cCBjb250ZXh0cyBiYXNlZCBvbiBncm91cCBjaGFuZ2VzXG5cdFx0Y29uc3QgdXBkYXRlR3JvdXBDb250ZXh0S2V5cyA9IChlOiBJR3JvdXBNb2RlbENoYW5nZUV2ZW50KSA9PiB7XG5cdFx0XHRzd2l0Y2ggKGUua2luZCkge1xuXHRcdFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkdST1VQX0xPQ0tFRDpcblx0XHRcdFx0XHRncm91cExvY2tlZENvbnRleHQuc2V0KHRoaXMuaXNMb2NrZWQpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9BQ1RJVkU6XG5cdFx0XHRcdFx0Z3JvdXBBY3RpdmVFZGl0b3JGaXJzdENvbnRleHQuc2V0KHRoaXMubW9kZWwuaXNGaXJzdCh0aGlzLm1vZGVsLmFjdGl2ZUVkaXRvcikpO1xuXHRcdFx0XHRcdGdyb3VwQWN0aXZlRWRpdG9yTGFzdENvbnRleHQuc2V0KHRoaXMubW9kZWwuaXNMYXN0KHRoaXMubW9kZWwuYWN0aXZlRWRpdG9yKSk7XG5cdFx0XHRcdFx0Z3JvdXBBY3RpdmVFZGl0b3JQaW5uZWRDb250ZXh0LnNldCh0aGlzLm1vZGVsLmFjdGl2ZUVkaXRvciA/IHRoaXMubW9kZWwuaXNQaW5uZWQodGhpcy5tb2RlbC5hY3RpdmVFZGl0b3IpIDogZmFsc2UpO1xuXHRcdFx0XHRcdGdyb3VwQWN0aXZlRWRpdG9yU3RpY2t5Q29udGV4dC5zZXQodGhpcy5tb2RlbC5hY3RpdmVFZGl0b3IgPyB0aGlzLm1vZGVsLmlzU3RpY2t5KHRoaXMubW9kZWwuYWN0aXZlRWRpdG9yKSA6IGZhbHNlKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfQ0xPU0U6XG5cdFx0XHRcdFx0Z3JvdXBBY3RpdmVFZGl0b3JQaW5uZWRDb250ZXh0LnNldCh0aGlzLm1vZGVsLmFjdGl2ZUVkaXRvciA/IHRoaXMubW9kZWwuaXNQaW5uZWQodGhpcy5tb2RlbC5hY3RpdmVFZGl0b3IpIDogZmFsc2UpO1xuXHRcdFx0XHRcdGdyb3VwQWN0aXZlRWRpdG9yU3RpY2t5Q29udGV4dC5zZXQodGhpcy5tb2RlbC5hY3RpdmVFZGl0b3IgPyB0aGlzLm1vZGVsLmlzU3RpY2t5KHRoaXMubW9kZWwuYWN0aXZlRWRpdG9yKSA6IGZhbHNlKTtcblx0XHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfT1BFTjpcblx0XHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfTU9WRTpcblx0XHRcdFx0XHRncm91cEFjdGl2ZUVkaXRvckZpcnN0Q29udGV4dC5zZXQodGhpcy5tb2RlbC5pc0ZpcnN0KHRoaXMubW9kZWwuYWN0aXZlRWRpdG9yKSk7XG5cdFx0XHRcdFx0Z3JvdXBBY3RpdmVFZGl0b3JMYXN0Q29udGV4dC5zZXQodGhpcy5tb2RlbC5pc0xhc3QodGhpcy5tb2RlbC5hY3RpdmVFZGl0b3IpKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfUElOOlxuXHRcdFx0XHRcdGlmIChlLmVkaXRvciAmJiBlLmVkaXRvciA9PT0gdGhpcy5tb2RlbC5hY3RpdmVFZGl0b3IpIHtcblx0XHRcdFx0XHRcdGdyb3VwQWN0aXZlRWRpdG9yUGlubmVkQ29udGV4dC5zZXQodGhpcy5tb2RlbC5pc1Bpbm5lZCh0aGlzLm1vZGVsLmFjdGl2ZUVkaXRvcikpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfU1RJQ0tZOlxuXHRcdFx0XHRcdGlmIChlLmVkaXRvciAmJiBlLmVkaXRvciA9PT0gdGhpcy5tb2RlbC5hY3RpdmVFZGl0b3IpIHtcblx0XHRcdFx0XHRcdGdyb3VwQWN0aXZlRWRpdG9yU3RpY2t5Q29udGV4dC5zZXQodGhpcy5tb2RlbC5pc1N0aWNreSh0aGlzLm1vZGVsLmFjdGl2ZUVkaXRvcikpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JTX1NFTEVDVElPTjpcblx0XHRcdFx0XHRtdWx0aXBsZUVkaXRvcnNTZWxlY3RlZENvbnRleHQuc2V0KHRoaXMubW9kZWwuc2VsZWN0ZWRFZGl0b3JzLmxlbmd0aCA+IDEpO1xuXHRcdFx0XHRcdHR3b0VkaXRvcnNTZWxlY3RlZENvbnRleHQuc2V0KHRoaXMubW9kZWwuc2VsZWN0ZWRFZGl0b3JzLmxlbmd0aCA9PT0gMik7XG5cdFx0XHRcdFx0c2VsZWN0ZWRFZGl0b3JzSGF2ZUZpbGVPclVudGl0bGVkUmVzb3VyY2VDb250ZXh0LnNldCh0aGlzLm1vZGVsLnNlbGVjdGVkRWRpdG9ycy5ldmVyeShlID0+IGUucmVzb3VyY2UgJiYgKHRoaXMuZmlsZVNlcnZpY2UuaGFzUHJvdmlkZXIoZS5yZXNvdXJjZSkgfHwgZS5yZXNvdXJjZS5zY2hlbWUgPT09IFNjaGVtYXMudW50aXRsZWQpKSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEdyb3VwIGVkaXRvcnMgY291bnQgY29udGV4dFxuXHRcdFx0Z3JvdXBFZGl0b3JzQ291bnRDb250ZXh0LnNldCh0aGlzLmNvdW50KTtcblx0XHR9O1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZE1vZGVsQ2hhbmdlKGUgPT4gdXBkYXRlR3JvdXBDb250ZXh0S2V5cyhlKSkpO1xuXG5cdFx0Ly8gVHJhY2sgdGhlIGFjdGl2ZSBlZGl0b3IgYW5kIHVwZGF0ZSBjb250ZXh0IGtleSB0aGF0IHJlZmxlY3RzXG5cdFx0Ly8gdGhlIGRpcnR5IHN0YXRlIG9mIHRoaXMgZWRpdG9yXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSgoKSA9PiBvYnNlcnZlQWN0aXZlRWRpdG9yKCkpKTtcblxuXHRcdC8vIFVwZGF0ZSBjb250ZXh0IGtleXMgb24gc3RhcnR1cFxuXHRcdG9ic2VydmVBY3RpdmVFZGl0b3IoKTtcblx0XHR1cGRhdGVHcm91cENvbnRleHRLZXlzKHsga2luZDogR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0FDVElWRSB9KTtcblx0XHR1cGRhdGVHcm91cENvbnRleHRLZXlzKHsga2luZDogR3JvdXBNb2RlbENoYW5nZUtpbmQuR1JPVVBfTE9DS0VEIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckNvbnRhaW5lckxpc3RlbmVycygpOiB2b2lkIHtcblxuXHRcdC8vIE9wZW4gbmV3IGZpbGUgdmlhIGRvdWJsZWNsaWNrIG9uIGVtcHR5IGNvbnRhaW5lclxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIEV2ZW50VHlwZS5EQkxDTElDSywgZSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc0VtcHR5KSB7XG5cdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZSk7XG5cblx0XHRcdFx0dGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRcdHJlc291cmNlOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0cGlubmVkOiB0cnVlLFxuXHRcdFx0XHRcdFx0b3ZlcnJpZGU6IERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OLmlkXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCB0aGlzLmlkKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBDbG9zZSBlbXB0eSBlZGl0b3IgZ3JvdXAgdmlhIG1pZGRsZSBtb3VzZSBjbGlja1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIEV2ZW50VHlwZS5BVVhDTElDSywgZSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc0VtcHR5ICYmIGUuYnV0dG9uID09PSAxIC8qIE1pZGRsZSBCdXR0b24gKi8pIHtcblx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblxuXHRcdFx0XHR0aGlzLmdyb3Vwc1ZpZXcucmVtb3ZlR3JvdXAodGhpcyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVDb250YWluZXJUb29sYmFyKCk6IHZvaWQge1xuXG5cdFx0Ly8gVG9vbGJhciBDb250YWluZXJcblx0XHRjb25zdCB0b29sYmFyQ29udGFpbmVyID0gJCgnLmVkaXRvci1ncm91cC1jb250YWluZXItdG9vbGJhcicpO1xuXHRcdHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZCh0b29sYmFyQ29udGFpbmVyKTtcblxuXHRcdC8vIFRvb2xiYXJcblx0XHRjb25zdCBjb250YWluZXJUb29sYmFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEFjdGlvbkJhcih0b29sYmFyQ29udGFpbmVyLCB7XG5cdFx0XHRhcmlhTGFiZWw6IGxvY2FsaXplKCdhcmlhTGFiZWxHcm91cEFjdGlvbnMnLCBcIkVtcHR5IGVkaXRvciBncm91cCBhY3Rpb25zXCIpLFxuXHRcdFx0aGlnaGxpZ2h0VG9nZ2xlZEl0ZW1zOiB0cnVlXG5cdFx0fSkpO1xuXG5cdFx0Ly8gVG9vbGJhciBhY3Rpb25zXG5cdFx0Y29uc3QgY29udGFpbmVyVG9vbGJhck1lbnUgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLm1lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUoTWVudUlkLkVtcHR5RWRpdG9yR3JvdXAsIHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpKTtcblx0XHRjb25zdCB1cGRhdGVDb250YWluZXJUb29sYmFyID0gKCkgPT4ge1xuXG5cdFx0XHQvLyBDbGVhciBvbGQgYWN0aW9uc1xuXHRcdFx0dGhpcy5jb250YWluZXJUb29sQmFyTWVudURpc3Bvc2FibGUudmFsdWUgPSB0b0Rpc3Bvc2FibGUoKCkgPT4gY29udGFpbmVyVG9vbGJhci5jbGVhcigpKTtcblxuXHRcdFx0Ly8gQ3JlYXRlIG5ldyBhY3Rpb25zXG5cdFx0XHRjb25zdCBhY3Rpb25zID0gZ2V0QWN0aW9uQmFyQWN0aW9ucyhcblx0XHRcdFx0Y29udGFpbmVyVG9vbGJhck1lbnUuZ2V0QWN0aW9ucyh7IGFyZzogeyBncm91cElkOiB0aGlzLmlkIH0sIHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0pLFxuXHRcdFx0XHQnbmF2aWdhdGlvbidcblx0XHRcdCk7XG5cblx0XHRcdGZvciAoY29uc3QgYWN0aW9uIG9mIFsuLi5hY3Rpb25zLnByaW1hcnksIC4uLmFjdGlvbnMuc2Vjb25kYXJ5XSkge1xuXHRcdFx0XHRjb25zdCBrZXliaW5kaW5nID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGFjdGlvbi5pZCk7XG5cdFx0XHRcdGNvbnRhaW5lclRvb2xiYXIucHVzaChhY3Rpb24sIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlLCBrZXliaW5kaW5nOiBrZXliaW5kaW5nPy5nZXRMYWJlbCgpIH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0dXBkYXRlQ29udGFpbmVyVG9vbGJhcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbnRhaW5lclRvb2xiYXJNZW51Lm9uRGlkQ2hhbmdlKHVwZGF0ZUNvbnRhaW5lclRvb2xiYXIpKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlQ29udGFpbmVyQ29udGV4dE1lbnUoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZWxlbWVudCwgRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgZSA9PiB0aGlzLm9uU2hvd0NvbnRhaW5lckNvbnRleHRNZW51KGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZWxlbWVudCwgVG91Y2hFdmVudFR5cGUuQ29udGV4dG1lbnUsICgpID0+IHRoaXMub25TaG93Q29udGFpbmVyQ29udGV4dE1lbnUoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvblNob3dDb250YWluZXJDb250ZXh0TWVudShlPzogTW91c2VFdmVudCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5pc0VtcHR5KSB7XG5cdFx0XHRyZXR1cm47IC8vIG9ubHkgZm9yIGVtcHR5IGVkaXRvciBncm91cHNcblx0XHR9XG5cblx0XHQvLyBGaW5kIHRhcmdldCBhbmNob3Jcblx0XHRsZXQgYW5jaG9yOiBIVE1MRWxlbWVudCB8IFN0YW5kYXJkTW91c2VFdmVudCA9IHRoaXMuZWxlbWVudDtcblx0XHRpZiAoZSkge1xuXHRcdFx0YW5jaG9yID0gbmV3IFN0YW5kYXJkTW91c2VFdmVudChnZXRXaW5kb3codGhpcy5lbGVtZW50KSwgZSk7XG5cdFx0fVxuXG5cdFx0Ly8gU2hvdyBpdFxuXHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRtZW51SWQ6IE1lbnVJZC5FbXB0eUVkaXRvckdyb3VwQ29udGV4dCxcblx0XHRcdGNvbnRleHRLZXlTZXJ2aWNlOiB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBhbmNob3IsXG5cdFx0XHRvbkhpZGU6ICgpID0+IHRoaXMuZm9jdXMoKVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1RyYWNrRm9jdXMoKTogdm9pZCB7XG5cblx0XHQvLyBDb250YWluZXJcblx0XHRjb25zdCBjb250YWluZXJGb2N1c1RyYWNrZXIgPSB0aGlzLl9yZWdpc3Rlcih0cmFja0ZvY3VzKHRoaXMuZWxlbWVudCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbnRhaW5lckZvY3VzVHJhY2tlci5vbkRpZEZvY3VzKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzRW1wdHkpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRGb2N1cy5maXJlKCk7IC8vIG9ubHkgd2hlbiBlbXB0eSB0byBwcmV2ZW50IGR1cGxpY2F0ZSBldmVudHMgZnJvbSBgZWRpdG9yUGFuZS5vbkRpZEZvY3VzYFxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIFRpdGxlIENvbnRhaW5lclxuXHRcdGNvbnN0IGhhbmRsZVRpdGxlQ2xpY2tPclRvdWNoID0gKGU6IE1vdXNlRXZlbnQgfCBHZXN0dXJlRXZlbnQpOiB2b2lkID0+IHtcblx0XHRcdGxldCB0YXJnZXQ6IEhUTUxFbGVtZW50O1xuXHRcdFx0aWYgKGlzTW91c2VFdmVudChlKSkge1xuXHRcdFx0XHRpZiAoZS5idXR0b24gIT09IDAgLyogbWlkZGxlL3JpZ2h0IG1vdXNlIGJ1dHRvbiAqLyB8fCAoaXNNYWNpbnRvc2ggJiYgZS5jdHJsS2V5IC8qIG1hY09TIGNvbnRleHQgbWVudSAqLykpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGFyZ2V0ID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0YXJnZXQgPSAoZSBhcyBHZXN0dXJlRXZlbnQpLmluaXRpYWxUYXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChmaW5kUGFyZW50V2l0aENsYXNzKHRhcmdldCwgJ21vbmFjby1hY3Rpb24tYmFyJywgdGhpcy50aXRsZUNvbnRhaW5lcikgfHxcblx0XHRcdFx0ZmluZFBhcmVudFdpdGhDbGFzcyh0YXJnZXQsICdtb25hY28tYnJlYWRjcnVtYi1pdGVtJywgdGhpcy50aXRsZUNvbnRhaW5lcilcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm47IC8vIG5vdCB3aGVuIGNsaWNraW5nIG9uIGFjdGlvbnMgb3IgYnJlYWRjcnVtYnNcblx0XHRcdH1cblxuXHRcdFx0Ly8gdGltZW91dCB0byBrZWVwIGZvY3VzIGluIGVkaXRvciBhZnRlciBtb3VzZSB1cFxuXHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuZm9jdXMoKTtcblx0XHRcdH0pO1xuXHRcdH07XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy50aXRsZUNvbnRhaW5lciwgRXZlbnRUeXBlLk1PVVNFX0RPV04sIGUgPT4gaGFuZGxlVGl0bGVDbGlja09yVG91Y2goZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy50aXRsZUNvbnRhaW5lciwgVG91Y2hFdmVudFR5cGUuVGFwLCBlID0+IGhhbmRsZVRpdGxlQ2xpY2tPclRvdWNoKGUpKSk7XG5cblx0XHQvLyBFZGl0b3IgcGFuZVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yUGFuZS5vbkRpZEZvY3VzKCgpID0+IHtcblx0XHRcdHRoaXMuX29uRGlkRm9jdXMuZmlyZSgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ29udGFpbmVyKCk6IHZvaWQge1xuXG5cdFx0Ly8gRW1wdHkgQ29udGFpbmVyOiBhZGQgc29tZSBlbXB0eSBjb250YWluZXIgYXR0cmlidXRlc1xuXHRcdGlmICh0aGlzLmlzRW1wdHkpIHtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdlbXB0eScpO1xuXHRcdFx0dGhpcy5lbGVtZW50LnRhYkluZGV4ID0gMDtcblx0XHRcdHRoaXMuZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBsb2NhbGl6ZSgnZW1wdHlFZGl0b3JHcm91cCcsIFwiezB9IChlbXB0eSlcIiwgdGhpcy5hcmlhTGFiZWwpKTtcblx0XHR9XG5cblx0XHQvLyBOb24tRW1wdHkgQ29udGFpbmVyOiByZXZlcnQgZW1wdHkgY29udGFpbmVyIGF0dHJpYnV0ZXNcblx0XHRlbHNlIHtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdlbXB0eScpO1xuXHRcdFx0dGhpcy5lbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSgndGFiSW5kZXgnKTtcblx0XHRcdHRoaXMuZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKTtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgc3R5bGVzXG5cdFx0dGhpcy51cGRhdGVTdHlsZXMoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlVGl0bGVDb250YWluZXIoKTogdm9pZCB7XG5cdFx0dGhpcy50aXRsZUNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCd0YWJzJywgdGhpcy5ncm91cHNWaWV3LnBhcnRPcHRpb25zLnNob3dUYWJzID09PSAnbXVsdGlwbGUnKTtcblx0XHR0aGlzLnRpdGxlQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ3Nob3ctZmlsZS1pY29ucycsIHRoaXMuZ3JvdXBzVmlldy5wYXJ0T3B0aW9ucy5zaG93SWNvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSByZXN0b3JlRWRpdG9ycyhmcm9tOiBJRWRpdG9yR3JvdXBWaWV3IHwgSVNlcmlhbGl6ZWRFZGl0b3JHcm91cE1vZGVsIHwgbnVsbCwgZ3JvdXBWaWV3T3B0aW9ucz86IElFZGl0b3JHcm91cFZpZXdPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuY291bnQgPT09IDApIHtcblx0XHRcdHJldHVybjsgLy8gbm90aGluZyB0byBzaG93XG5cdFx0fVxuXG5cdFx0Ly8gRGV0ZXJtaW5lIGVkaXRvciBvcHRpb25zXG5cdFx0bGV0IG9wdGlvbnM6IElFZGl0b3JPcHRpb25zO1xuXHRcdGlmIChmcm9tIGluc3RhbmNlb2YgRWRpdG9yR3JvdXBWaWV3KSB7XG5cdFx0XHRvcHRpb25zID0gZmlsbEFjdGl2ZUVkaXRvclZpZXdTdGF0ZShmcm9tKTsgLy8gaWYgd2UgY29weSBmcm9tIGFub3RoZXIgZ3JvdXAsIGVuc3VyZSB0byBjb3B5IGl0cyBhY3RpdmUgZWRpdG9yIHZpZXdzdGF0ZVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRvcHRpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR9XG5cblx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSB0aGlzLm1vZGVsLmFjdGl2ZUVkaXRvcjtcblx0XHRpZiAoIWFjdGl2ZUVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdG9wdGlvbnMucGlubmVkID0gdGhpcy5tb2RlbC5pc1Bpbm5lZChhY3RpdmVFZGl0b3IpO1x0Ly8gcHJlc2VydmUgcGlubmVkIHN0YXRlXG5cdFx0b3B0aW9ucy5zdGlja3kgPSB0aGlzLm1vZGVsLmlzU3RpY2t5KGFjdGl2ZUVkaXRvcik7XHQvLyBwcmVzZXJ2ZSBzdGlja3kgc3RhdGVcblx0XHRvcHRpb25zLnByZXNlcnZlRm9jdXMgPSB0cnVlO1x0XHRcdFx0XHRcdC8vIGhhbmRsZSBmb2N1cyBhZnRlciBlZGl0b3IgaXMgcmVzdG9yZWRcblxuXHRcdGNvbnN0IGludGVybmFsT3B0aW9uczogSUludGVybmFsRWRpdG9yT3Blbk9wdGlvbnMgPSB7XG5cdFx0XHRwcmVzZXJ2ZVdpbmRvd09yZGVyOiB0cnVlLFx0XHRcdFx0XHRcdC8vIGhhbmRsZSB3aW5kb3cgb3JkZXIgYWZ0ZXIgZWRpdG9yIGlzIHJlc3RvcmVkXG5cdFx0XHRza2lwVGl0bGVVcGRhdGU6IHRydWUsXHRcdFx0XHRcdFx0XHQvLyB1cGRhdGUgdGhlIHRpdGxlIGxhdGVyIGZvciBhbGwgZWRpdG9ycyBhdCBvbmNlXG5cdFx0fTtcblxuXHRcdGNvbnN0IGFjdGl2ZUVsZW1lbnQgPSBnZXRBY3RpdmVFbGVtZW50KCk7XG5cblx0XHQvLyBTaG93IGFjdGl2ZSBlZGl0b3IgKGludGVudGlvbmFsbHkgbm90IHVzaW5nIGFzeW5jIHRvIGtlZXBcblx0XHQvLyBgcmVzdG9yZUVkaXRvcnNgIGZyb20gZXhlY3V0aW5nIGluIHNhbWUgc3RhY2spXG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5kb1Nob3dFZGl0b3IoYWN0aXZlRWRpdG9yLCB7IGFjdGl2ZTogdHJ1ZSwgaXNOZXc6IGZhbHNlIC8qIHJlc3RvcmVkICovIH0sIG9wdGlvbnMsIGludGVybmFsT3B0aW9ucykudGhlbigoKSA9PiB7XG5cblx0XHRcdC8vIFNldCBmb2N1c2VkIG5vdyBpZiB0aGlzIGlzIHRoZSBhY3RpdmUgZ3JvdXAgYW5kIGZvY3VzIGhhc1xuXHRcdFx0Ly8gbm90IGNoYW5nZWQgbWVhbndoaWxlLiBUaGlzIHByZXZlbnRzIGZvY3VzIGZyb20gYmVpbmdcblx0XHRcdC8vIHN0b2xlbiBhY2NpZGVudGFsbHkgb24gc3RhcnR1cCB3aGVuIHRoZSB1c2VyIGFscmVhZHlcblx0XHRcdC8vIGNsaWNrZWQgc29tZXdoZXJlLlxuXG5cdFx0XHRpZiAodGhpcy5ncm91cHNWaWV3LmFjdGl2ZUdyb3VwID09PSB0aGlzICYmIGFjdGl2ZUVsZW1lbnQgJiYgaXNBY3RpdmVFbGVtZW50KGFjdGl2ZUVsZW1lbnQpICYmICFncm91cFZpZXdPcHRpb25zPy5wcmVzZXJ2ZUZvY3VzKSB7XG5cdFx0XHRcdHRoaXMuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIFJlc3RvcmUgZWRpdG9ycyBpbiB0aXRsZSBjb250cm9sXG5cdFx0dGhpcy50aXRsZUNvbnRyb2wub3BlbkVkaXRvcnModGhpcy5lZGl0b3JzKTtcblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHQvLyNyZWdpb24gZXZlbnQgaGFuZGxpbmdcblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXG5cdFx0Ly8gTW9kZWwgRXZlbnRzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5tb2RlbC5vbkRpZE1vZGVsQ2hhbmdlKGUgPT4gdGhpcy5vbkRpZEdyb3VwTW9kZWxDaGFuZ2UoZSkpKTtcblxuXHRcdC8vIE9wdGlvbiBDaGFuZ2VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5ncm91cHNWaWV3Lm9uRGlkQ2hhbmdlRWRpdG9yUGFydE9wdGlvbnMoZSA9PiB0aGlzLm9uRGlkQ2hhbmdlRWRpdG9yUGFydE9wdGlvbnMoZSkpKTtcblxuXHRcdC8vIFZpc2liaWxpdHlcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmdyb3Vwc1ZpZXcub25EaWRWaXNpYmlsaXR5Q2hhbmdlKGUgPT4gdGhpcy5vbkRpZFZpc2liaWxpdHlDaGFuZ2UoZSkpKTtcblxuXHRcdC8vIEZvY3VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZEZvY3VzKCgpID0+IHRoaXMub25EaWRHYWluRm9jdXMoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZEdyb3VwTW9kZWxDaGFuZ2UoZTogSUdyb3VwTW9kZWxDaGFuZ2VFdmVudCk6IHZvaWQge1xuXG5cdFx0Ly8gUmUtZW1pdCB0byBvdXRzaWRlXG5cdFx0dGhpcy5fb25EaWRNb2RlbENoYW5nZS5maXJlKGUpO1xuXG5cdFx0Ly8gSGFuZGxlIHdpdGhpblxuXG5cdFx0c3dpdGNoIChlLmtpbmQpIHtcblx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuR1JPVVBfTE9DS0VEOlxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnbG9ja2VkJywgdGhpcy5pc0xvY2tlZCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JTX1NFTEVDVElPTjpcblx0XHRcdFx0dGhpcy5vbkRpZENoYW5nZUVkaXRvclNlbGVjdGlvbigpO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRpZiAoIWUuZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c3dpdGNoIChlLmtpbmQpIHtcblx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX09QRU46XG5cdFx0XHRcdGlmIChpc0dyb3VwRWRpdG9yT3BlbkV2ZW50KGUpKSB7XG5cdFx0XHRcdFx0dGhpcy5vbkRpZE9wZW5FZGl0b3IoZS5lZGl0b3IsIGUuZWRpdG9ySW5kZXgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfQ0xPU0U6XG5cdFx0XHRcdGlmIChpc0dyb3VwRWRpdG9yQ2xvc2VFdmVudChlKSkge1xuXHRcdFx0XHRcdHRoaXMuaGFuZGxlT25EaWRDbG9zZUVkaXRvcihlLmVkaXRvciwgZS5lZGl0b3JJbmRleCwgZS5jb250ZXh0LCBlLnN0aWNreSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9XSUxMX0RJU1BPU0U6XG5cdFx0XHRcdHRoaXMub25XaWxsRGlzcG9zZUVkaXRvcihlLmVkaXRvcik7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfRElSVFk6XG5cdFx0XHRcdHRoaXMub25EaWRDaGFuZ2VFZGl0b3JEaXJ0eShlLmVkaXRvcik7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfVFJBTlNJRU5UOlxuXHRcdFx0XHR0aGlzLm9uRGlkQ2hhbmdlRWRpdG9yVHJhbnNpZW50KGUuZWRpdG9yKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9MQUJFTDpcblx0XHRcdFx0dGhpcy5vbkRpZENoYW5nZUVkaXRvckxhYmVsKGUuZWRpdG9yKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZE9wZW5FZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dCwgZWRpdG9ySW5kZXg6IG51bWJlcik6IHZvaWQge1xuXG5cdFx0LyogX19HRFBSX19cblx0XHRcdFwiZWRpdG9yT3BlbmVkXCIgOiB7XG5cdFx0XHRcdFwib3duZXJcIjogXCJpc2lkb3JuXCIsXG5cdFx0XHRcdFwiJHtpbmNsdWRlfVwiOiBbXG5cdFx0XHRcdFx0XCIke0VkaXRvclRlbGVtZXRyeURlc2NyaXB0b3J9XCJcblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdCovXG5cdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZygnZWRpdG9yT3BlbmVkJywgdGhpcy50b0VkaXRvclRlbGVtZXRyeURlc2NyaXB0b3IoZWRpdG9yKSk7XG5cblx0XHQvLyBVcGRhdGUgY29udGFpbmVyXG5cdFx0dGhpcy51cGRhdGVDb250YWluZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlT25EaWRDbG9zZUVkaXRvcihlZGl0b3I6IEVkaXRvcklucHV0LCBlZGl0b3JJbmRleDogbnVtYmVyLCBjb250ZXh0OiBFZGl0b3JDbG9zZUNvbnRleHQsIHN0aWNreTogYm9vbGVhbik6IHZvaWQge1xuXG5cdFx0Ly8gQmVmb3JlIGNsb3NlXG5cdFx0dGhpcy5fb25XaWxsQ2xvc2VFZGl0b3IuZmlyZSh7IGdyb3VwSWQ6IHRoaXMuaWQsIGVkaXRvciwgY29udGV4dCwgaW5kZXg6IGVkaXRvckluZGV4LCBzdGlja3kgfSk7XG5cblx0XHQvLyBIYW5kbGUgZXZlbnRcblx0XHRjb25zdCBlZGl0b3JzVG9DbG9zZTogRWRpdG9ySW5wdXRbXSA9IFtlZGl0b3JdO1xuXG5cdFx0Ly8gSW5jbHVkZSBib3RoIHNpZGVzIG9mIHNpZGUgYnkgc2lkZSBlZGl0b3JzIHdoZW4gYmVpbmcgY2xvc2VkXG5cdFx0aWYgKGVkaXRvciBpbnN0YW5jZW9mIFNpZGVCeVNpZGVFZGl0b3JJbnB1dCkge1xuXHRcdFx0ZWRpdG9yc1RvQ2xvc2UucHVzaChlZGl0b3IucHJpbWFyeSwgZWRpdG9yLnNlY29uZGFyeSk7XG5cdFx0fVxuXG5cdFx0Ly8gRm9yIGVhY2ggZWRpdG9yIHRvIGNsb3NlLCB3ZSBjYWxsIGRpc3Bvc2UoKSB0byBmcmVlIHVwIGFueSByZXNvdXJjZXMuXG5cdFx0Ly8gSG93ZXZlciwgY2VydGFpbiBlZGl0b3JzIG1pZ2h0IGJlIHNoYXJlZCBhY3Jvc3MgbXVsdGlwbGUgZWRpdG9yIGdyb3Vwc1xuXHRcdC8vIChpbmNsdWRpbmcgYmVpbmcgdmlzaWJsZSBpbiBzaWRlIGJ5IHNpZGUgLyBkaWZmIGVkaXRvcnMpIGFuZCBhcyBzdWNoIHdlXG5cdFx0Ly8gb25seSBkaXNwb3NlIHdoZW4gdGhleSBhcmUgbm90IG9wZW5lZCBlbHNld2hlcmUuXG5cdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgZWRpdG9yc1RvQ2xvc2UpIHtcblx0XHRcdGlmICh0aGlzLmNhbkRpc3Bvc2UoZWRpdG9yKSkge1xuXHRcdFx0XHRlZGl0b3IuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSBjb250YWluZXJcblx0XHR0aGlzLnVwZGF0ZUNvbnRhaW5lcigpO1xuXG5cdFx0Ly8gRXZlbnRcblx0XHR0aGlzLl9vbkRpZENsb3NlRWRpdG9yLmZpcmUoeyBncm91cElkOiB0aGlzLmlkLCBlZGl0b3IsIGNvbnRleHQsIGluZGV4OiBlZGl0b3JJbmRleCwgc3RpY2t5IH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBjYW5EaXNwb3NlKGVkaXRvcjogRWRpdG9ySW5wdXQpOiBib29sZWFuIHtcblx0XHRmb3IgKGNvbnN0IGdyb3VwVmlldyBvZiB0aGlzLmVkaXRvclBhcnRzVmlldy5ncm91cHMpIHtcblx0XHRcdGlmIChncm91cFZpZXcgaW5zdGFuY2VvZiBFZGl0b3JHcm91cFZpZXcgJiYgZ3JvdXBWaWV3Lm1vZGVsLmNvbnRhaW5zKGVkaXRvciwge1xuXHRcdFx0XHRzdHJpY3RFcXVhbHM6IHRydWUsXHRcdFx0XHRcdFx0Ly8gb25seSBpZiB0aGlzIGlucHV0IGlzIG5vdCBzaGFyZWQgYWNyb3NzIGVkaXRvciBncm91cHNcblx0XHRcdFx0c3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQU5ZIC8vIGluY2x1ZGUgYW55IHNpZGUgb2YgYW4gb3BlbmVkIHNpZGUgYnkgc2lkZSBlZGl0b3Jcblx0XHRcdH0pKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgdG9SZXNvdXJjZVRlbGVtZXRyeURlc2NyaXB0b3IocmVzb3VyY2U6IFVSSSk6IG9iamVjdCB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFyZXNvdXJjZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBwYXRoID0gcmVzb3VyY2UgPyByZXNvdXJjZS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSA/IHJlc291cmNlLmZzUGF0aCA6IHJlc291cmNlLnBhdGggOiB1bmRlZmluZWQ7XG5cdFx0aWYgKCFwYXRoKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIFJlbW92ZSBxdWVyeSBwYXJhbWV0ZXJzIGZyb20gdGhlIHJlc291cmNlIGV4dGVuc2lvblxuXHRcdGxldCByZXNvdXJjZUV4dCA9IGV4dG5hbWUocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHF1ZXJ5U3RyaW5nTG9jYXRpb24gPSByZXNvdXJjZUV4dC5pbmRleE9mKCc/Jyk7XG5cdFx0cmVzb3VyY2VFeHQgPSBxdWVyeVN0cmluZ0xvY2F0aW9uICE9PSAtMSA/IHJlc291cmNlRXh0LnN1YnN0cigwLCBxdWVyeVN0cmluZ0xvY2F0aW9uKSA6IHJlc291cmNlRXh0O1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdG1pbWVUeXBlOiBuZXcgVGVsZW1ldHJ5VHJ1c3RlZFZhbHVlKGdldE1pbWVUeXBlcyhyZXNvdXJjZSkuam9pbignLCAnKSksXG5cdFx0XHRzY2hlbWU6IHJlc291cmNlLnNjaGVtZSxcblx0XHRcdGV4dDogcmVzb3VyY2VFeHQsXG5cdFx0XHRwYXRoOiBoYXNoKHBhdGgpXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgdG9FZGl0b3JUZWxlbWV0cnlEZXNjcmlwdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQpOiBvYmplY3Qge1xuXHRcdGNvbnN0IGRlc2NyaXB0b3IgPSBlZGl0b3IuZ2V0VGVsZW1ldHJ5RGVzY3JpcHRvcigpO1xuXG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5CT1RIIH0pO1xuXHRcdGlmIChVUkkuaXNVcmkocmVzb3VyY2UpKSB7XG5cdFx0XHRkZXNjcmlwdG9yWydyZXNvdXJjZSddID0gdGhpcy50b1Jlc291cmNlVGVsZW1ldHJ5RGVzY3JpcHRvcihyZXNvdXJjZSk7XG5cblx0XHRcdC8qIF9fR0RQUl9fRlJBR01FTlRfX1xuXHRcdFx0XHRcIkVkaXRvclRlbGVtZXRyeURlc2NyaXB0b3JcIiA6IHtcblx0XHRcdFx0XHRcInJlc291cmNlXCI6IHsgXCIke2lubGluZX1cIjogWyBcIiR7VVJJRGVzY3JpcHRvcn1cIiBdIH1cblx0XHRcdFx0fVxuXHRcdFx0Ki9cblx0XHRcdHJldHVybiBkZXNjcmlwdG9yO1xuXHRcdH0gZWxzZSBpZiAocmVzb3VyY2UpIHtcblx0XHRcdGlmIChyZXNvdXJjZS5wcmltYXJ5KSB7XG5cdFx0XHRcdGRlc2NyaXB0b3JbJ3Jlc291cmNlJ10gPSB0aGlzLnRvUmVzb3VyY2VUZWxlbWV0cnlEZXNjcmlwdG9yKHJlc291cmNlLnByaW1hcnkpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHJlc291cmNlLnNlY29uZGFyeSkge1xuXHRcdFx0XHRkZXNjcmlwdG9yWydyZXNvdXJjZVNlY29uZGFyeSddID0gdGhpcy50b1Jlc291cmNlVGVsZW1ldHJ5RGVzY3JpcHRvcihyZXNvdXJjZS5zZWNvbmRhcnkpO1xuXHRcdFx0fVxuXHRcdFx0LyogX19HRFBSX19GUkFHTUVOVF9fXG5cdFx0XHRcdFwiRWRpdG9yVGVsZW1ldHJ5RGVzY3JpcHRvclwiIDoge1xuXHRcdFx0XHRcdFwicmVzb3VyY2VcIjogeyBcIiR7aW5saW5lfVwiOiBbIFwiJHtVUklEZXNjcmlwdG9yfVwiIF0gfSxcblx0XHRcdFx0XHRcInJlc291cmNlU2Vjb25kYXJ5XCI6IHsgXCIke2lubGluZX1cIjogWyBcIiR7VVJJRGVzY3JpcHRvcn1cIiBdIH1cblx0XHRcdFx0fVxuXHRcdFx0Ki9cblx0XHRcdHJldHVybiBkZXNjcmlwdG9yO1xuXHRcdH1cblxuXHRcdHJldHVybiBkZXNjcmlwdG9yO1xuXHR9XG5cblx0cHJpdmF0ZSBvbldpbGxEaXNwb3NlRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQpOiB2b2lkIHtcblxuXHRcdC8vIFRvIHByZXZlbnQgcmFjZSBjb25kaXRpb25zLCB3ZSBoYW5kbGUgZGlzcG9zZWQgZWRpdG9ycyBpbiBvdXIgd29ya2VyIHdpdGggYSB0aW1lb3V0XG5cdFx0Ly8gYmVjYXVzZSBpdCBjYW4gaGFwcGVuIHRoYXQgYW4gaW5wdXQgaXMgYmVpbmcgZGlzcG9zZWQgd2l0aCB0aGUgaW50ZW50IHRvIHJlcGxhY2Vcblx0XHQvLyBpdCB3aXRoIHNvbWUgb3RoZXIgaW5wdXQgcmlnaHQgYWZ0ZXIuXG5cdFx0dGhpcy5kaXNwb3NlZEVkaXRvcnNXb3JrZXIud29yayhlZGl0b3IpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVEaXNwb3NlZEVkaXRvcnMoZGlzcG9zZWRFZGl0b3JzOiBFZGl0b3JJbnB1dFtdKTogdm9pZCB7XG5cblx0XHQvLyBTcGxpdCBiZXR3ZWVuIHZpc2libGUgYW5kIGhpZGRlbiBlZGl0b3JzXG5cdFx0bGV0IGFjdGl2ZUVkaXRvcjogRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgaW5hY3RpdmVFZGl0b3JzOiBFZGl0b3JJbnB1dFtdID0gW107XG5cdFx0Zm9yIChjb25zdCBkaXNwb3NlZEVkaXRvciBvZiBkaXNwb3NlZEVkaXRvcnMpIHtcblx0XHRcdGNvbnN0IGVkaXRvckZpbmRSZXN1bHQgPSB0aGlzLm1vZGVsLmZpbmRFZGl0b3IoZGlzcG9zZWRFZGl0b3IpO1xuXHRcdFx0aWYgKCFlZGl0b3JGaW5kUmVzdWx0KSB7XG5cdFx0XHRcdGNvbnRpbnVlOyAvLyBub3QgcGFydCBvZiB0aGUgbW9kZWwgYW55bW9yZVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBlZGl0b3IgPSBlZGl0b3JGaW5kUmVzdWx0WzBdO1xuXHRcdFx0aWYgKCFlZGl0b3IuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHRcdGNvbnRpbnVlOyAvLyBlZGl0b3IgZ290IHJlb3BlbmVkIG1lYW53aGlsZVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5tb2RlbC5pc0FjdGl2ZShlZGl0b3IpKSB7XG5cdFx0XHRcdGFjdGl2ZUVkaXRvciA9IGVkaXRvcjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGluYWN0aXZlRWRpdG9ycy5wdXNoKGVkaXRvcik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQ2xvc2UgYWxsIGluYWN0aXZlIGVkaXRvcnMgZmlyc3QgdG8gcHJldmVudCBVSSBmbGlja2VyXG5cdFx0Zm9yIChjb25zdCBpbmFjdGl2ZUVkaXRvciBvZiBpbmFjdGl2ZUVkaXRvcnMpIHtcblx0XHRcdHRoaXMuZG9DbG9zZUVkaXRvcihpbmFjdGl2ZUVkaXRvciwgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0Ly8gQ2xvc2UgYWN0aXZlIG9uZSBsYXN0XG5cdFx0aWYgKGFjdGl2ZUVkaXRvcikge1xuXHRcdFx0dGhpcy5kb0Nsb3NlRWRpdG9yKGFjdGl2ZUVkaXRvciwgdHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZUVkaXRvclBhcnRPcHRpb25zKGV2ZW50OiBJRWRpdG9yUGFydE9wdGlvbnNDaGFuZ2VFdmVudCk6IHZvaWQge1xuXG5cdFx0Ly8gVGl0bGUgY29udGFpbmVyXG5cdFx0dGhpcy51cGRhdGVUaXRsZUNvbnRhaW5lcigpO1xuXG5cdFx0Ly8gVGl0bGUgY29udHJvbFxuXHRcdHRoaXMudGl0bGVDb250cm9sLnVwZGF0ZU9wdGlvbnMoZXZlbnQub2xkUGFydE9wdGlvbnMsIGV2ZW50Lm5ld1BhcnRPcHRpb25zKTtcblxuXHRcdC8vIFRpdGxlIGNvbnRyb2wgc3dpdGNoIGJldHdlZW4gc2luZ2xlRWRpdG9yVGFicywgbXVsdGlFZGl0b3JUYWJzIGFuZCBtdWx0aVJvd0VkaXRvclRhYnNcblx0XHRpZiAoXG5cdFx0XHRldmVudC5vbGRQYXJ0T3B0aW9ucy5zaG93VGFicyAhPT0gZXZlbnQubmV3UGFydE9wdGlvbnMuc2hvd1RhYnMgfHxcblx0XHRcdGV2ZW50Lm9sZFBhcnRPcHRpb25zLnRhYkhlaWdodCAhPT0gZXZlbnQubmV3UGFydE9wdGlvbnMudGFiSGVpZ2h0IHx8XG5cdFx0XHQoZXZlbnQub2xkUGFydE9wdGlvbnMuc2hvd1RhYnMgPT09ICdtdWx0aXBsZScgJiYgZXZlbnQub2xkUGFydE9wdGlvbnMucGlubmVkVGFic09uU2VwYXJhdGVSb3cgIT09IGV2ZW50Lm5ld1BhcnRPcHRpb25zLnBpbm5lZFRhYnNPblNlcGFyYXRlUm93KVxuXHRcdCkge1xuXG5cdFx0XHQvLyBSZS1sYXlvdXRcblx0XHRcdHRoaXMucmVsYXlvdXQoKTtcblxuXHRcdFx0Ly8gRW5zdXJlIHRvIHNob3cgYWN0aXZlIGVkaXRvciBpZiBhbnlcblx0XHRcdGlmICh0aGlzLm1vZGVsLmFjdGl2ZUVkaXRvcikge1xuXHRcdFx0XHR0aGlzLnRpdGxlQ29udHJvbC5vcGVuRWRpdG9ycyh0aGlzLm1vZGVsLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBTdHlsZXNcblx0XHR0aGlzLnVwZGF0ZVN0eWxlcygpO1xuXG5cdFx0Ly8gUGluIHByZXZpZXcgZWRpdG9yIG9uY2UgdXNlciBkaXNhYmxlcyBwcmV2aWV3XG5cdFx0aWYgKGV2ZW50Lm9sZFBhcnRPcHRpb25zLmVuYWJsZVByZXZpZXcgJiYgIWV2ZW50Lm5ld1BhcnRPcHRpb25zLmVuYWJsZVByZXZpZXcpIHtcblx0XHRcdGlmICh0aGlzLm1vZGVsLnByZXZpZXdFZGl0b3IpIHtcblx0XHRcdFx0dGhpcy5waW5FZGl0b3IodGhpcy5tb2RlbC5wcmV2aWV3RWRpdG9yKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlRWRpdG9yRGlydHkoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IHZvaWQge1xuXG5cdFx0Ly8gQWx3YXlzIHNob3cgZGlydHkgZWRpdG9ycyBwaW5uZWRcblx0XHR0aGlzLnBpbkVkaXRvcihlZGl0b3IpO1xuXG5cdFx0Ly8gRm9yd2FyZCB0byB0aXRsZSBjb250cm9sXG5cdFx0dGhpcy50aXRsZUNvbnRyb2wudXBkYXRlRWRpdG9yRGlydHkoZWRpdG9yKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VFZGl0b3JUcmFuc2llbnQoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IHZvaWQge1xuXHRcdGNvbnN0IHRyYW5zaWVudCA9IHRoaXMubW9kZWwuaXNUcmFuc2llbnQoZWRpdG9yKTtcblxuXHRcdC8vIFRyYW5zaWVudCBzdGF0ZSBvdmVycmlkZXMgdGhlIGBlbmFibGVQcmV2aWV3YCBzZXR0aW5nLFxuXHRcdC8vIHNvIHdoZW4gYW4gZWRpdG9yIGxlYXZlcyB0aGUgdHJhbnNpZW50IHN0YXRlLCB3ZSBoYXZlXG5cdFx0Ly8gdG8gZW5zdXJlIGl0cyBwcmV2aWV3IHN0YXRlIGlzIGFsc28gY2xlYXJlZC5cblx0XHRpZiAoIXRyYW5zaWVudCAmJiAhdGhpcy5ncm91cHNWaWV3LnBhcnRPcHRpb25zLmVuYWJsZVByZXZpZXcpIHtcblx0XHRcdHRoaXMucGluRWRpdG9yKGVkaXRvcik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZUVkaXRvckxhYmVsKGVkaXRvcjogRWRpdG9ySW5wdXQpOiB2b2lkIHtcblxuXHRcdC8vIEZvcndhcmQgdG8gdGl0bGUgY29udHJvbFxuXHRcdHRoaXMudGl0bGVDb250cm9sLnVwZGF0ZUVkaXRvckxhYmVsKGVkaXRvcik7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlRWRpdG9yU2VsZWN0aW9uKCk6IHZvaWQge1xuXG5cdFx0Ly8gRm9yd2FyZCB0byB0aXRsZSBjb250cm9sXG5cdFx0dGhpcy50aXRsZUNvbnRyb2wudXBkYXRlRWRpdG9yU2VsZWN0aW9ucygpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZFZpc2liaWxpdHlDaGFuZ2UodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXG5cdFx0Ly8gRm9yd2FyZCB0byBhY3RpdmUgZWRpdG9yIHBhbmVcblx0XHR0aGlzLmVkaXRvclBhbmUuc2V0VmlzaWJsZSh2aXNpYmxlKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRHYWluRm9jdXMoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuYWN0aXZlRWRpdG9yKSB7XG5cblx0XHRcdC8vIFdlIGFnZ3Jlc3NpdmVseSBjbGVhciB0aGUgdHJhbnNpZW50IHN0YXRlIG9mIGVkaXRvcnNcblx0XHRcdC8vIGFzIHNvb24gYXMgdGhlIGdyb3VwIGdhaW5zIGZvY3VzLiBUaGlzIGlzIHRvIGVuc3VyZVxuXHRcdFx0Ly8gdGhhdCB0aGUgdHJhbnNpZW50IHN0YXRlIGlzIG5vdCBzdGF5aW5nIGFyb3VuZCB3aGVuXG5cdFx0XHQvLyB0aGUgdXNlciBpbnRlcmFjdHMgd2l0aCB0aGUgZWRpdG9yLlxuXG5cdFx0XHR0aGlzLm1vZGVsLnNldFRyYW5zaWVudCh0aGlzLmFjdGl2ZUVkaXRvciwgZmFsc2UpO1xuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBJRWRpdG9yR3JvdXBWaWV3XG5cblx0Z2V0IGluZGV4KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2luZGV4O1xuXHR9XG5cblx0Z2V0IGxhYmVsKCk6IHN0cmluZyB7XG5cdFx0aWYgKHRoaXMuZ3JvdXBzTGFiZWwpIHtcblx0XHRcdHJldHVybiBsb2NhbGl6ZSgnZ3JvdXBMYWJlbExvbmcnLCBcInswfTogR3JvdXAgezF9XCIsIHRoaXMuZ3JvdXBzTGFiZWwsIHRoaXMuX2luZGV4ICsgMSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxvY2FsaXplKCdncm91cExhYmVsJywgXCJHcm91cCB7MH1cIiwgdGhpcy5faW5kZXggKyAxKTtcblx0fVxuXG5cdGdldCBhcmlhTGFiZWwoKTogc3RyaW5nIHtcblx0XHRpZiAodGhpcy5ncm91cHNMYWJlbCkge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdncm91cEFyaWFMYWJlbExvbmcnLCBcInswfTogRWRpdG9yIEdyb3VwIHsxfVwiLCB0aGlzLmdyb3Vwc0xhYmVsLCB0aGlzLl9pbmRleCArIDEpO1xuXHRcdH1cblxuXHRcdHJldHVybiBsb2NhbGl6ZSgnZ3JvdXBBcmlhTGFiZWwnLCBcIkVkaXRvciBHcm91cCB7MH1cIiwgdGhpcy5faW5kZXggKyAxKTtcblx0fVxuXG5cdHByaXZhdGUgX2Rpc3Bvc2VkID0gZmFsc2U7XG5cdGdldCBkaXNwb3NlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZGlzcG9zZWQ7XG5cdH1cblxuXHRnZXQgaXNFbXB0eSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5jb3VudCA9PT0gMDtcblx0fVxuXG5cdGdldCB0aXRsZUhlaWdodCgpOiBJRWRpdG9yR3JvdXBUaXRsZUhlaWdodCB7XG5cdFx0cmV0dXJuIHRoaXMudGl0bGVDb250cm9sLmdldEhlaWdodCgpO1xuXHR9XG5cblx0bm90aWZ5SW5kZXhDaGFuZ2VkKG5ld0luZGV4OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faW5kZXggIT09IG5ld0luZGV4KSB7XG5cdFx0XHR0aGlzLl9pbmRleCA9IG5ld0luZGV4O1xuXHRcdFx0dGhpcy5tb2RlbC5zZXRJbmRleChuZXdJbmRleCk7XG5cdFx0fVxuXHR9XG5cblx0bm90aWZ5TGFiZWxDaGFuZ2VkKG5ld0xhYmVsOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5ncm91cHNMYWJlbCAhPT0gbmV3TGFiZWwpIHtcblx0XHRcdHRoaXMuZ3JvdXBzTGFiZWwgPSBuZXdMYWJlbDtcblx0XHRcdHRoaXMubW9kZWwuc2V0TGFiZWwobmV3TGFiZWwpO1xuXHRcdH1cblx0fVxuXG5cdHNldEFjdGl2ZShpc0FjdGl2ZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuYWN0aXZlID0gaXNBY3RpdmU7XG5cblx0XHQvLyBDbGVhciBzZWxlY3Rpb24gd2hlbiBncm91cCBubyBsb25nZXIgYWN0aXZlXG5cdFx0aWYgKCFpc0FjdGl2ZSAmJiB0aGlzLmFjdGl2ZUVkaXRvciAmJiB0aGlzLnNlbGVjdGVkRWRpdG9ycy5sZW5ndGggPiAxKSB7XG5cdFx0XHR0aGlzLnNldFNlbGVjdGlvbih0aGlzLmFjdGl2ZUVkaXRvciwgW10pO1xuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSBjb250YWluZXJcblx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnYWN0aXZlJywgaXNBY3RpdmUpO1xuXHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdpbmFjdGl2ZScsICFpc0FjdGl2ZSk7XG5cblx0XHQvLyBVcGRhdGUgdGl0bGUgY29udHJvbFxuXHRcdHRoaXMudGl0bGVDb250cm9sLnNldEFjdGl2ZShpc0FjdGl2ZSk7XG5cblx0XHQvLyBVcGRhdGUgc3R5bGVzXG5cdFx0dGhpcy51cGRhdGVTdHlsZXMoKTtcblxuXHRcdC8vIFVwZGF0ZSBtb2RlbFxuXHRcdHRoaXMubW9kZWwuc2V0QWN0aXZlKHVuZGVmaW5lZCAvKiBlbnRpcmUgZ3JvdXAgZ290IGFjdGl2ZSAqLyk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gYmFzaWNzKClcblxuXHRnZXQgaWQoKTogR3JvdXBJZGVudGlmaWVyIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5pZDtcblx0fVxuXG5cdGdldCB3aW5kb3dJZCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLmdyb3Vwc1ZpZXcud2luZG93SWQ7XG5cdH1cblxuXHRnZXQgZWRpdG9ycygpOiBFZGl0b3JJbnB1dFtdIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKTtcblx0fVxuXG5cdGdldCBjb3VudCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmNvdW50O1xuXHR9XG5cblx0Z2V0IHN0aWNreUNvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuc3RpY2t5Q291bnQ7XG5cdH1cblxuXHRnZXQgYWN0aXZlRWRpdG9yUGFuZSgpOiBJVmlzaWJsZUVkaXRvclBhbmUgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmVkaXRvclBhbmUgPyB0aGlzLmVkaXRvclBhbmUuYWN0aXZlRWRpdG9yUGFuZSA/PyB1bmRlZmluZWQgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXQgYWN0aXZlRWRpdG9yKCk6IEVkaXRvcklucHV0IHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuYWN0aXZlRWRpdG9yO1xuXHR9XG5cblx0Z2V0IHNlbGVjdGVkRWRpdG9ycygpOiBFZGl0b3JJbnB1dFtdIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5zZWxlY3RlZEVkaXRvcnM7XG5cdH1cblxuXHRnZXQgcHJldmlld0VkaXRvcigpOiBFZGl0b3JJbnB1dCB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLnByZXZpZXdFZGl0b3I7XG5cdH1cblxuXHRpc1Bpbm5lZChlZGl0b3JPckluZGV4OiBFZGl0b3JJbnB1dCB8IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmlzUGlubmVkKGVkaXRvck9ySW5kZXgpO1xuXHR9XG5cblx0aXNTdGlja3koZWRpdG9yT3JJbmRleDogRWRpdG9ySW5wdXQgfCBudW1iZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5pc1N0aWNreShlZGl0b3JPckluZGV4KTtcblx0fVxuXG5cdGlzU2VsZWN0ZWQoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmlzU2VsZWN0ZWQoZWRpdG9yKTtcblx0fVxuXG5cdGlzVHJhbnNpZW50KGVkaXRvck9ySW5kZXg6IEVkaXRvcklucHV0IHwgbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuaXNUcmFuc2llbnQoZWRpdG9yT3JJbmRleCk7XG5cdH1cblxuXHRpc0FjdGl2ZShlZGl0b3I6IEVkaXRvcklucHV0IHwgSVVudHlwZWRFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmlzQWN0aXZlKGVkaXRvcik7XG5cdH1cblxuXHRhc3luYyBzZXRTZWxlY3Rpb24oYWN0aXZlU2VsZWN0ZWRFZGl0b3I6IEVkaXRvcklucHV0LCBpbmFjdGl2ZVNlbGVjdGVkRWRpdG9yczogRWRpdG9ySW5wdXRbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5pc0FjdGl2ZShhY3RpdmVTZWxlY3RlZEVkaXRvcikpIHtcblx0XHRcdC8vIFRoZSBhY3RpdmUgc2VsZWN0ZWQgZWRpdG9yIGlzIG5vdCB5ZXQgb3BlbmVkLCBzbyB3ZSBnb1xuXHRcdFx0Ly8gdGhyb3VnaCBgb3BlbkVkaXRvcmAgdG8gc2hvdyBpdC4gV2UgcGFzcyB0aGUgaW5hY3RpdmVcblx0XHRcdC8vIHNlbGVjdGlvbiBhcyBpbnRlcm5hbCBvcHRpb25zXG5cdFx0XHRhd2FpdCB0aGlzLm9wZW5FZGl0b3IoYWN0aXZlU2VsZWN0ZWRFZGl0b3IsIHsgYWN0aXZhdGlvbjogRWRpdG9yQWN0aXZhdGlvbi5BQ1RJVkFURSB9LCB7IGluYWN0aXZlU2VsZWN0aW9uOiBpbmFjdGl2ZVNlbGVjdGVkRWRpdG9ycyB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5tb2RlbC5zZXRTZWxlY3Rpb24oYWN0aXZlU2VsZWN0ZWRFZGl0b3IsIGluYWN0aXZlU2VsZWN0ZWRFZGl0b3JzKTtcblx0XHR9XG5cdH1cblxuXHRjb250YWlucyhjYW5kaWRhdGU6IEVkaXRvcklucHV0IHwgSVVudHlwZWRFZGl0b3JJbnB1dCwgb3B0aW9ucz86IElNYXRjaEVkaXRvck9wdGlvbnMpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5jb250YWlucyhjYW5kaWRhdGUsIG9wdGlvbnMpO1xuXHR9XG5cblx0Z2V0RWRpdG9ycyhvcmRlcjogRWRpdG9yc09yZGVyLCBvcHRpb25zPzogeyBleGNsdWRlU3RpY2t5PzogYm9vbGVhbiB9KTogRWRpdG9ySW5wdXRbXSB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuZ2V0RWRpdG9ycyhvcmRlciwgb3B0aW9ucyk7XG5cdH1cblxuXHRmaW5kRWRpdG9ycyhyZXNvdXJjZTogVVJJLCBvcHRpb25zPzogSUZpbmRFZGl0b3JPcHRpb25zKTogRWRpdG9ySW5wdXRbXSB7XG5cdFx0Y29uc3QgY2Fub25pY2FsUmVzb3VyY2UgPSB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5hc0Nhbm9uaWNhbFVyaShyZXNvdXJjZSk7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCkuZmlsdGVyKGVkaXRvciA9PiB7XG5cdFx0XHRpZiAoZWRpdG9yLnJlc291cmNlICYmIGlzRXF1YWwoZWRpdG9yLnJlc291cmNlLCBjYW5vbmljYWxSZXNvdXJjZSkpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFN1cHBvcnQgc2lkZSBieSBzaWRlIGVkaXRvciBwcmltYXJ5IHNpZGUgaWYgc3BlY2lmaWVkXG5cdFx0XHRpZiAob3B0aW9ucz8uc3VwcG9ydFNpZGVCeVNpZGUgPT09IFNpZGVCeVNpZGVFZGl0b3IuUFJJTUFSWSB8fCBvcHRpb25zPy5zdXBwb3J0U2lkZUJ5U2lkZSA9PT0gU2lkZUJ5U2lkZUVkaXRvci5BTlkpIHtcblx0XHRcdFx0Y29uc3QgcHJpbWFyeVJlc291cmNlID0gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRDYW5vbmljYWxVcmkoZWRpdG9yLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSk7XG5cdFx0XHRcdGlmIChwcmltYXJ5UmVzb3VyY2UgJiYgaXNFcXVhbChwcmltYXJ5UmVzb3VyY2UsIGNhbm9uaWNhbFJlc291cmNlKSkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFN1cHBvcnQgc2lkZSBieSBzaWRlIGVkaXRvciBzZWNvbmRhcnkgc2lkZSBpZiBzcGVjaWZpZWRcblx0XHRcdGlmIChvcHRpb25zPy5zdXBwb3J0U2lkZUJ5U2lkZSA9PT0gU2lkZUJ5U2lkZUVkaXRvci5TRUNPTkRBUlkgfHwgb3B0aW9ucz8uc3VwcG9ydFNpZGVCeVNpZGUgPT09IFNpZGVCeVNpZGVFZGl0b3IuQU5ZKSB7XG5cdFx0XHRcdGNvbnN0IHNlY29uZGFyeVJlc291cmNlID0gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRDYW5vbmljYWxVcmkoZWRpdG9yLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlNFQ09OREFSWSB9KTtcblx0XHRcdFx0aWYgKHNlY29uZGFyeVJlc291cmNlICYmIGlzRXF1YWwoc2Vjb25kYXJ5UmVzb3VyY2UsIGNhbm9uaWNhbFJlc291cmNlKSkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9KTtcblx0fVxuXG5cdGdldEVkaXRvckJ5SW5kZXgoaW5kZXg6IG51bWJlcik6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXRFZGl0b3JCeUluZGV4KGluZGV4KTtcblx0fVxuXG5cdGdldEluZGV4T2ZFZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuaW5kZXhPZihlZGl0b3IpO1xuXHR9XG5cblx0aXNGaXJzdChlZGl0b3I6IEVkaXRvcklucHV0KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuaXNGaXJzdChlZGl0b3IpO1xuXHR9XG5cblx0aXNMYXN0KGVkaXRvcjogRWRpdG9ySW5wdXQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5pc0xhc3QoZWRpdG9yKTtcblx0fVxuXG5cdGZvY3VzKCk6IHZvaWQge1xuXG5cdFx0Ly8gUGFzcyBmb2N1cyB0byBlZGl0b3IgcGFuZXNcblx0XHRpZiAodGhpcy5hY3RpdmVFZGl0b3JQYW5lKSB7XG5cdFx0XHR0aGlzLmFjdGl2ZUVkaXRvclBhbmUuZm9jdXMoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5lbGVtZW50LmZvY3VzKCk7XG5cdFx0fVxuXG5cdFx0Ly8gRXZlbnRcblx0XHR0aGlzLl9vbkRpZEZvY3VzLmZpcmUoKTtcblx0fVxuXG5cdHBpbkVkaXRvcihjYW5kaWRhdGU6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkID0gdGhpcy5hY3RpdmVFZGl0b3IgfHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKGNhbmRpZGF0ZSAmJiAhdGhpcy5tb2RlbC5pc1Bpbm5lZChjYW5kaWRhdGUpKSB7XG5cblx0XHRcdC8vIFVwZGF0ZSBtb2RlbFxuXHRcdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5tb2RlbC5waW4oY2FuZGlkYXRlKTtcblxuXHRcdFx0Ly8gRm9yd2FyZCB0byB0aXRsZSBjb250cm9sXG5cdFx0XHRpZiAoZWRpdG9yKSB7XG5cdFx0XHRcdHRoaXMudGl0bGVDb250cm9sLnBpbkVkaXRvcihlZGl0b3IpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHN0aWNrRWRpdG9yKGNhbmRpZGF0ZTogRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQgPSB0aGlzLmFjdGl2ZUVkaXRvciB8fCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLmRvU3RpY2tFZGl0b3IoY2FuZGlkYXRlLCB0cnVlKTtcblx0fVxuXG5cdHVuc3RpY2tFZGl0b3IoY2FuZGlkYXRlOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCA9IHRoaXMuYWN0aXZlRWRpdG9yIHx8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuZG9TdGlja0VkaXRvcihjYW5kaWRhdGUsIGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgZG9TdGlja0VkaXRvcihjYW5kaWRhdGU6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkLCBzdGlja3k6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoY2FuZGlkYXRlICYmIHRoaXMubW9kZWwuaXNTdGlja3koY2FuZGlkYXRlKSAhPT0gc3RpY2t5KSB7XG5cdFx0XHRjb25zdCBvbGRJbmRleE9mRWRpdG9yID0gdGhpcy5nZXRJbmRleE9mRWRpdG9yKGNhbmRpZGF0ZSk7XG5cblx0XHRcdC8vIFVwZGF0ZSBtb2RlbFxuXHRcdFx0Y29uc3QgZWRpdG9yID0gc3RpY2t5ID8gdGhpcy5tb2RlbC5zdGljayhjYW5kaWRhdGUpIDogdGhpcy5tb2RlbC51bnN0aWNrKGNhbmRpZGF0ZSk7XG5cdFx0XHRpZiAoIWVkaXRvcikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIHRoZSBpbmRleCBvZiB0aGUgZWRpdG9yIGNoYW5nZWQsIHdlIG5lZWQgdG8gZm9yd2FyZCB0aGlzIHRvXG5cdFx0XHQvLyB0aXRsZSBjb250cm9sIGFuZCBhbHNvIG1ha2Ugc3VyZSB0byBlbWl0IHRoaXMgYXMgYW4gZXZlbnRcblx0XHRcdGNvbnN0IG5ld0luZGV4T2ZFZGl0b3IgPSB0aGlzLmdldEluZGV4T2ZFZGl0b3IoZWRpdG9yKTtcblx0XHRcdGlmIChuZXdJbmRleE9mRWRpdG9yICE9PSBvbGRJbmRleE9mRWRpdG9yKSB7XG5cdFx0XHRcdHRoaXMudGl0bGVDb250cm9sLm1vdmVFZGl0b3IoZWRpdG9yLCBvbGRJbmRleE9mRWRpdG9yLCBuZXdJbmRleE9mRWRpdG9yLCB0cnVlKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRm9yd2FyZCBzdGlja3kgc3RhdGUgdG8gdGl0bGUgY29udHJvbFxuXHRcdFx0aWYgKHN0aWNreSkge1xuXHRcdFx0XHR0aGlzLnRpdGxlQ29udHJvbC5zdGlja0VkaXRvcihlZGl0b3IpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy50aXRsZUNvbnRyb2wudW5zdGlja0VkaXRvcihlZGl0b3IpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBvcGVuRWRpdG9yKClcblxuXHRhc3luYyBvcGVuRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQsIG9wdGlvbnM/OiBJRWRpdG9yT3B0aW9ucywgaW50ZXJuYWxPcHRpb25zPzogSUludGVybmFsRWRpdG9yT3Blbk9wdGlvbnMpOiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuZG9PcGVuRWRpdG9yKGVkaXRvciwgb3B0aW9ucywge1xuXHRcdFx0Ly8gQXBwcGx5IGdpdmVuIGludGVybmFsIG9wZW4gb3B0aW9uc1xuXHRcdFx0Li4uaW50ZXJuYWxPcHRpb25zLFxuXHRcdFx0Ly8gQWxsb3cgdG8gbWF0Y2ggb24gYSBzaWRlLWJ5LXNpZGUgZWRpdG9yIHdoZW4gc2FtZVxuXHRcdFx0Ly8gZWRpdG9yIGlzIG9wZW5lZCBvbiBib3RoIHNpZGVzLiBJbiB0aGF0IGNhc2Ugd2Vcblx0XHRcdC8vIGRvIG5vdCB3YW50IHRvIG9wZW4gYSBuZXcgZWRpdG9yIGJ1dCByZXVzZSB0aGF0IG9uZS5cblx0XHRcdHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkJPVEhcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9PcGVuRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQsIG9wdGlvbnM/OiBJRWRpdG9yT3B0aW9ucywgaW50ZXJuYWxPcHRpb25zPzogSUludGVybmFsRWRpdG9yT3Blbk9wdGlvbnMpOiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPiB7XG5cblx0XHQvLyBHdWFyZCBhZ2FpbnN0IGludmFsaWQgZWRpdG9ycy4gRGlzcG9zZWQgZWRpdG9yc1xuXHRcdC8vIHNob3VsZCBuZXZlciBvcGVuIGJlY2F1c2UgdGhleSBlbWl0IG5vIGV2ZW50c1xuXHRcdC8vIGUuZy4gdG8gaW5kaWNhdGUgZGlydHkgY2hhbmdlcy5cblx0XHRpZiAoIWVkaXRvciB8fCBlZGl0b3IuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gRmlyZSB0aGUgZXZlbnQgbGV0dGluZyBldmVyeW9uZSBrbm93IHdlIGFyZSBhYm91dCB0byBvcGVuIGFuIGVkaXRvclxuXHRcdHRoaXMuX29uV2lsbE9wZW5FZGl0b3IuZmlyZSh7IGVkaXRvciwgZ3JvdXBJZDogdGhpcy5pZCB9KTtcblxuXHRcdC8vIERldGVybWluZSBvcHRpb25zXG5cdFx0Y29uc3QgcGlubmVkID0gb3B0aW9ucz8uc3RpY2t5XG5cdFx0XHR8fCAoIXRoaXMuZ3JvdXBzVmlldy5wYXJ0T3B0aW9ucy5lbmFibGVQcmV2aWV3ICYmICFvcHRpb25zPy50cmFuc2llbnQpXG5cdFx0XHR8fCBlZGl0b3IuaXNEaXJ0eSgpXG5cdFx0XHR8fCAob3B0aW9ucz8ucGlubmVkID8/IHR5cGVvZiBvcHRpb25zPy5pbmRleCA9PT0gJ251bWJlcicgLyogdW5sZXNzIHNwZWNpZmllZCwgcHJlZmVyIHRvIHBpbiB3aGVuIG9wZW5pbmcgd2l0aCBpbmRleCAqLylcblx0XHRcdHx8ICh0eXBlb2Ygb3B0aW9ucz8uaW5kZXggPT09ICdudW1iZXInICYmIHRoaXMubW9kZWwuaXNTdGlja3kob3B0aW9ucy5pbmRleCkpXG5cdFx0XHR8fCBlZGl0b3IuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5TY3JhdGNocGFkKTtcblx0XHRjb25zdCBvcGVuRWRpdG9yT3B0aW9uczogSUVkaXRvck9wZW5PcHRpb25zID0ge1xuXHRcdFx0aW5kZXg6IG9wdGlvbnMgPyBvcHRpb25zLmluZGV4IDogdW5kZWZpbmVkLFxuXHRcdFx0cGlubmVkLFxuXHRcdFx0c3RpY2t5OiBvcHRpb25zPy5zdGlja3kgfHwgKHR5cGVvZiBvcHRpb25zPy5pbmRleCA9PT0gJ251bWJlcicgJiYgdGhpcy5tb2RlbC5pc1N0aWNreShvcHRpb25zLmluZGV4KSksXG5cdFx0XHR0cmFuc2llbnQ6ICEhb3B0aW9ucz8udHJhbnNpZW50LFxuXHRcdFx0aW5hY3RpdmVTZWxlY3Rpb246IGludGVybmFsT3B0aW9ucz8uaW5hY3RpdmVTZWxlY3Rpb24sXG5cdFx0XHRhY3RpdmU6IHRoaXMuY291bnQgPT09IDAgfHwgIW9wdGlvbnMgfHwgIW9wdGlvbnMuaW5hY3RpdmUsXG5cdFx0XHRzdXBwb3J0U2lkZUJ5U2lkZTogaW50ZXJuYWxPcHRpb25zPy5zdXBwb3J0U2lkZUJ5U2lkZVxuXHRcdH07XG5cblx0XHRpZiAoIW9wZW5FZGl0b3JPcHRpb25zLmFjdGl2ZSAmJiAhb3BlbkVkaXRvck9wdGlvbnMucGlubmVkICYmIHRoaXMubW9kZWwuYWN0aXZlRWRpdG9yICYmICF0aGlzLm1vZGVsLmlzUGlubmVkKHRoaXMubW9kZWwuYWN0aXZlRWRpdG9yKSkge1xuXHRcdFx0Ly8gU3BlY2lhbCBjYXNlOiB3ZSBhcmUgdG8gb3BlbiBhbiBlZGl0b3IgaW5hY3RpdmUgYW5kIG5vdCBwaW5uZWQsIGJ1dCB0aGUgY3VycmVudCBhY3RpdmVcblx0XHRcdC8vIGVkaXRvciBpcyBhbHNvIG5vdCBwaW5uZWQsIHdoaWNoIG1lYW5zIGl0IHdpbGwgZ2V0IHJlcGxhY2VkIHdpdGggdGhpcyBvbmUuIEFzIHN1Y2gsXG5cdFx0XHQvLyB0aGUgZWRpdG9yIGNhbiBvbmx5IGJlIGFjdGl2ZS5cblx0XHRcdG9wZW5FZGl0b3JPcHRpb25zLmFjdGl2ZSA9IHRydWU7XG5cdFx0fVxuXG5cdFx0bGV0IGFjdGl2YXRlR3JvdXAgPSBmYWxzZTtcblx0XHRsZXQgcmVzdG9yZUdyb3VwID0gZmFsc2U7XG5cblx0XHRpZiAob3B0aW9ucz8uYWN0aXZhdGlvbiA9PT0gRWRpdG9yQWN0aXZhdGlvbi5BQ1RJVkFURSkge1xuXHRcdFx0Ly8gUmVzcGVjdCBvcHRpb24gdG8gZm9yY2UgYWN0aXZhdGUgYW4gZWRpdG9yIGdyb3VwLlxuXHRcdFx0YWN0aXZhdGVHcm91cCA9IHRydWU7XG5cdFx0fSBlbHNlIGlmIChvcHRpb25zPy5hY3RpdmF0aW9uID09PSBFZGl0b3JBY3RpdmF0aW9uLlJFU1RPUkUpIHtcblx0XHRcdC8vIFJlc3BlY3Qgb3B0aW9uIHRvIGZvcmNlIHJlc3RvcmUgYW4gZWRpdG9yIGdyb3VwLlxuXHRcdFx0cmVzdG9yZUdyb3VwID0gdHJ1ZTtcblx0XHR9IGVsc2UgaWYgKG9wdGlvbnM/LmFjdGl2YXRpb24gPT09IEVkaXRvckFjdGl2YXRpb24uUFJFU0VSVkUpIHtcblx0XHRcdC8vIFJlc3BlY3Qgb3B0aW9uIHRvIHByZXNlcnZlIGFjdGl2ZSBlZGl0b3IgZ3JvdXAuXG5cdFx0XHRhY3RpdmF0ZUdyb3VwID0gZmFsc2U7XG5cdFx0XHRyZXN0b3JlR3JvdXAgPSBmYWxzZTtcblx0XHR9IGVsc2UgaWYgKG9wZW5FZGl0b3JPcHRpb25zLmFjdGl2ZSkge1xuXHRcdFx0Ly8gRmluYWxseSwgd2Ugb25seSBhY3RpdmF0ZS9yZXN0b3JlIGFuIGVkaXRvciB3aGljaCBpc1xuXHRcdFx0Ly8gb3BlbmluZyBhcyBhY3RpdmUgZWRpdG9yLlxuXHRcdFx0Ly8gSWYgcHJlc2VydmVGb2N1cyBpcyBlbmFibGVkLCB3ZSBvbmx5IHJlc3RvcmUgYnV0IG5ldmVyXG5cdFx0XHQvLyBhY3RpdmF0ZSB0aGUgZ3JvdXAuXG5cdFx0XHRhY3RpdmF0ZUdyb3VwID0gIW9wdGlvbnMgfHwgIW9wdGlvbnMucHJlc2VydmVGb2N1cztcblx0XHRcdHJlc3RvcmVHcm91cCA9ICFhY3RpdmF0ZUdyb3VwO1xuXHRcdH1cblxuXHRcdC8vIEFjdHVhbGx5IG1vdmUgdGhlIGVkaXRvciBpZiBhIHNwZWNpZmljIGluZGV4IGlzIHByb3ZpZGVkIGFuZCB3ZSBmaWd1cmVcblx0XHQvLyBvdXQgdGhhdCB0aGUgZWRpdG9yIGlzIGFscmVhZHkgb3BlbmVkIGF0IGEgZGlmZmVyZW50IGluZGV4LiBUaGlzXG5cdFx0Ly8gZW5zdXJlcyB0aGUgcmlnaHQgc2V0IG9mIGV2ZW50cyBhcmUgZmlyZWQgdG8gdGhlIG91dHNpZGUuXG5cdFx0aWYgKHR5cGVvZiBvcGVuRWRpdG9yT3B0aW9ucy5pbmRleCA9PT0gJ251bWJlcicpIHtcblx0XHRcdGNvbnN0IGluZGV4T2ZFZGl0b3IgPSB0aGlzLm1vZGVsLmluZGV4T2YoZWRpdG9yKTtcblx0XHRcdGlmIChpbmRleE9mRWRpdG9yICE9PSAtMSAmJiBpbmRleE9mRWRpdG9yICE9PSBvcGVuRWRpdG9yT3B0aW9ucy5pbmRleCkge1xuXHRcdFx0XHR0aGlzLmRvTW92ZUVkaXRvckluc2lkZUdyb3VwKGVkaXRvciwgb3BlbkVkaXRvck9wdGlvbnMpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSBtb2RlbCBhbmQgbWFrZSBzdXJlIHRvIGNvbnRpbnVlIHRvIHVzZSB0aGUgZWRpdG9yIHdlIGdldCBmcm9tXG5cdFx0Ly8gdGhlIG1vZGVsLiBJdCBpcyBwb3NzaWJsZSB0aGF0IHRoZSBlZGl0b3Igd2FzIGFscmVhZHkgb3BlbmVkIGFuZCB3ZVxuXHRcdC8vIHdhbnQgdG8gZW5zdXJlIHRoYXQgd2UgdXNlIHRoZSBleGlzdGluZyBpbnN0YW5jZSBpbiB0aGF0IGNhc2UuXG5cdFx0Y29uc3QgeyBlZGl0b3I6IG9wZW5lZEVkaXRvciwgaXNOZXcgfSA9IHRoaXMubW9kZWwub3BlbkVkaXRvcihlZGl0b3IsIG9wZW5FZGl0b3JPcHRpb25zKTtcblxuXHRcdC8vIENvbmRpdGlvbmFsbHkgbG9jayB0aGUgZ3JvdXBcblx0XHRpZiAoXG5cdFx0XHRpc05ldyAmJlx0XHRcdFx0XHRcdFx0XHQvLyBvbmx5IGlmIHRoaXMgZWRpdG9yIHdhcyBuZXcgZm9yIHRoZSBncm91cFxuXHRcdFx0dGhpcy5jb3VudCA9PT0gMSAmJlx0XHRcdFx0XHRcdC8vIG9ubHkgd2hlbiB0aGlzIGVkaXRvciB3YXMgdGhlIGZpcnN0IGVkaXRvciBpbiB0aGUgZ3JvdXBcblx0XHRcdHRoaXMuZWRpdG9yUGFydHNWaWV3Lmdyb3Vwcy5sZW5ndGggPiAxIFx0Ly8gb25seSBhbGxvdyBhdXRvIGxvY2tpbmcgaWYgbW9yZSB0aGFuIDEgZ3JvdXAgaXMgb3BlbmVkXG5cdFx0KSB7XG5cdFx0XHQvLyBvbmx5IHdoZW4gdGhlIGVkaXRvciBpZGVudGlmaWVyIGlzIGNvbmZpZ3VyZWQgYXMgc3VjaFxuXHRcdFx0aWYgKG9wZW5lZEVkaXRvci5lZGl0b3JJZCAmJiB0aGlzLmdyb3Vwc1ZpZXcucGFydE9wdGlvbnMuYXV0b0xvY2tHcm91cHM/LmhhcyhvcGVuZWRFZGl0b3IuZWRpdG9ySWQpKSB7XG5cdFx0XHRcdHRoaXMubG9jayh0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBTaG93IGVkaXRvclxuXHRcdGNvbnN0IHNob3dFZGl0b3JSZXN1bHQgPSB0aGlzLmRvU2hvd0VkaXRvcihvcGVuZWRFZGl0b3IsIHsgYWN0aXZlOiAhIW9wZW5FZGl0b3JPcHRpb25zLmFjdGl2ZSwgaXNOZXcgfSwgb3B0aW9ucywgaW50ZXJuYWxPcHRpb25zKTtcblxuXHRcdC8vIEZpbmFsbHkgbWFrZSBzdXJlIHRoZSBncm91cCBpcyBhY3RpdmUgb3IgcmVzdG9yZWQgYXMgaW5zdHJ1Y3RlZFxuXHRcdGlmIChhY3RpdmF0ZUdyb3VwKSB7XG5cdFx0XHR0aGlzLmdyb3Vwc1ZpZXcuYWN0aXZhdGVHcm91cCh0aGlzKTtcblx0XHR9IGVsc2UgaWYgKHJlc3RvcmVHcm91cCkge1xuXHRcdFx0dGhpcy5ncm91cHNWaWV3LnJlc3RvcmVHcm91cCh0aGlzKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc2hvd0VkaXRvclJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgZG9TaG93RWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQsIGNvbnRleHQ6IHsgYWN0aXZlOiBib29sZWFuOyBpc05ldzogYm9vbGVhbiB9LCBvcHRpb25zPzogSUVkaXRvck9wdGlvbnMsIGludGVybmFsT3B0aW9ucz86IElJbnRlcm5hbEVkaXRvck9wZW5PcHRpb25zKTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD4ge1xuXG5cdFx0Ly8gU2hvdyBpbiBlZGl0b3IgY29udHJvbCBpZiB0aGUgYWN0aXZlIGVkaXRvciBjaGFuZ2VkXG5cdFx0bGV0IG9wZW5FZGl0b3JQcm9taXNlOiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPjtcblx0XHRpZiAoY29udGV4dC5hY3RpdmUpIHtcblx0XHRcdG9wZW5FZGl0b3JQcm9taXNlID0gKGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgeyBwYW5lLCBjaGFuZ2VkLCBjYW5jZWxsZWQsIGVycm9yIH0gPSBhd2FpdCB0aGlzLmVkaXRvclBhbmUub3BlbkVkaXRvcihlZGl0b3IsIG9wdGlvbnMsIGludGVybmFsT3B0aW9ucywgeyBuZXdJbkdyb3VwOiBjb250ZXh0LmlzTmV3IH0pO1xuXG5cdFx0XHRcdC8vIFJldHVybiBlYXJseSBpZiB0aGUgb3BlcmF0aW9uIHdhcyBjYW5jZWxsZWQgYnkgYW5vdGhlciBvcGVyYXRpb25cblx0XHRcdFx0aWYgKGNhbmNlbGxlZCkge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBFZGl0b3IgY2hhbmdlIGV2ZW50XG5cdFx0XHRcdGlmIChjaGFuZ2VkKSB7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UuZmlyZSh7IGVkaXRvciB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEluZGljYXRlIGVycm9yIGFzIGFuIGV2ZW50IGJ1dCBkbyBub3QgYnViYmxlIHRoZW0gdXBcblx0XHRcdFx0aWYgKGVycm9yKSB7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRPcGVuRWRpdG9yRmFpbC5maXJlKGVkaXRvcik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBXaXRob3V0IGFuIGVkaXRvciBwYW5lLCByZWNvdmVyIGJ5IGNsb3NpbmcgdGhlIGFjdGl2ZSBlZGl0b3Jcblx0XHRcdFx0Ly8gKGlmIHRoZSBpbnB1dCBpcyBzdGlsbCB0aGUgYWN0aXZlIG9uZSlcblx0XHRcdFx0aWYgKCFwYW5lICYmIHRoaXMuYWN0aXZlRWRpdG9yID09PSBlZGl0b3IpIHtcblx0XHRcdFx0XHR0aGlzLmRvQ2xvc2VFZGl0b3IoZWRpdG9yLCBvcHRpb25zPy5wcmVzZXJ2ZUZvY3VzLCB7IGZyb21FcnJvcjogdHJ1ZSB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBwYW5lO1xuXHRcdFx0fSkoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0b3BlbkVkaXRvclByb21pc2UgPSBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTsgLy8gaW5hY3RpdmU6IHJldHVybiB1bmRlZmluZWQgYXMgcmVzdWx0IHRvIHNpZ25hbCB0aGlzXG5cdFx0fVxuXG5cdFx0Ly8gU2hvdyBpbiB0aXRsZSBjb250cm9sIGFmdGVyIGVkaXRvciBjb250cm9sIGJlY2F1c2Ugc29tZSBhY3Rpb25zIGRlcGVuZCBvbiBpdFxuXHRcdC8vIGJ1dCByZXNwZWN0IHRoZSBpbnRlcm5hbCBvcHRpb25zIGluIGNhc2UgdGl0bGUgY29udHJvbCB1cGRhdGVzIHNob3VsZCBza2lwLlxuXHRcdGlmICghaW50ZXJuYWxPcHRpb25zPy5za2lwVGl0bGVVcGRhdGUpIHtcblx0XHRcdHRoaXMudGl0bGVDb250cm9sLm9wZW5FZGl0b3IoZWRpdG9yLCBpbnRlcm5hbE9wdGlvbnMpO1xuXHRcdH1cblxuXHRcdHJldHVybiBvcGVuRWRpdG9yUHJvbWlzZTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBvcGVuRWRpdG9ycygpXG5cblx0YXN5bmMgb3BlbkVkaXRvcnMoZWRpdG9yczogeyBlZGl0b3I6IEVkaXRvcklucHV0OyBvcHRpb25zPzogSUVkaXRvck9wdGlvbnMgfVtdKTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD4ge1xuXG5cdFx0Ly8gR3VhcmQgYWdhaW5zdCBpbnZhbGlkIGVkaXRvcnMuIERpc3Bvc2VkIGVkaXRvcnNcblx0XHQvLyBzaG91bGQgbmV2ZXIgb3BlbiBiZWNhdXNlIHRoZXkgZW1pdCBubyBldmVudHNcblx0XHQvLyBlLmcuIHRvIGluZGljYXRlIGRpcnR5IGNoYW5nZXMuXG5cdFx0Y29uc3QgZWRpdG9yc1RvT3BlbiA9IGNvYWxlc2NlKGVkaXRvcnMpLmZpbHRlcigoeyBlZGl0b3IgfSkgPT4gIWVkaXRvci5pc0Rpc3Bvc2VkKCkpO1xuXG5cdFx0Ly8gVXNlIHRoZSBmaXJzdCBlZGl0b3IgYXMgYWN0aXZlIGVkaXRvclxuXHRcdGNvbnN0IGZpcnN0RWRpdG9yID0gZWRpdG9yc1RvT3Blbi5hdCgwKTtcblx0XHRpZiAoIWZpcnN0RWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3BlbkVkaXRvcnNPcHRpb25zOiBJSW50ZXJuYWxFZGl0b3JPcGVuT3B0aW9ucyA9IHtcblx0XHRcdC8vIEFsbG93IHRvIG1hdGNoIG9uIGEgc2lkZS1ieS1zaWRlIGVkaXRvciB3aGVuIHNhbWVcblx0XHRcdC8vIGVkaXRvciBpcyBvcGVuZWQgb24gYm90aCBzaWRlcy4gSW4gdGhhdCBjYXNlIHdlXG5cdFx0XHQvLyBkbyBub3Qgd2FudCB0byBvcGVuIGEgbmV3IGVkaXRvciBidXQgcmV1c2UgdGhhdCBvbmUuXG5cdFx0XHRzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5CT1RIXG5cdFx0fTtcblxuXHRcdGF3YWl0IHRoaXMuZG9PcGVuRWRpdG9yKGZpcnN0RWRpdG9yLmVkaXRvciwgZmlyc3RFZGl0b3Iub3B0aW9ucywgb3BlbkVkaXRvcnNPcHRpb25zKTtcblxuXHRcdC8vIE9wZW4gdGhlIG90aGVyIG9uZXMgaW5hY3RpdmVcblx0XHRjb25zdCBpbmFjdGl2ZUVkaXRvcnMgPSBlZGl0b3JzVG9PcGVuLnNsaWNlKDEpO1xuXHRcdGNvbnN0IHN0YXJ0aW5nSW5kZXggPSB0aGlzLmdldEluZGV4T2ZFZGl0b3IoZmlyc3RFZGl0b3IuZWRpdG9yKSArIDE7XG5cdFx0YXdhaXQgUHJvbWlzZXMuc2V0dGxlZChpbmFjdGl2ZUVkaXRvcnMubWFwKCh7IGVkaXRvciwgb3B0aW9ucyB9LCBpbmRleCkgPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG9PcGVuRWRpdG9yKGVkaXRvciwge1xuXHRcdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0XHRpbmFjdGl2ZTogdHJ1ZSxcblx0XHRcdFx0cGlubmVkOiB0cnVlLFxuXHRcdFx0XHRpbmRleDogc3RhcnRpbmdJbmRleCArIGluZGV4XG5cdFx0XHR9LCB7XG5cdFx0XHRcdC4uLm9wZW5FZGl0b3JzT3B0aW9ucyxcblx0XHRcdFx0Ly8gb3B0aW1pemF0aW9uOiB1cGRhdGUgdGhlIHRpdGxlIGNvbnRyb2wgbGF0ZXJcblx0XHRcdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzMDYzNFxuXHRcdFx0XHRza2lwVGl0bGVVcGRhdGU6IHRydWVcblx0XHRcdH0pO1xuXHRcdH0pKTtcblxuXHRcdC8vIFVwZGF0ZSB0aGUgdGl0bGUgY29udHJvbCBhbGwgYXQgb25jZSB3aXRoIGFsbCBlZGl0b3JzXG5cdFx0dGhpcy50aXRsZUNvbnRyb2wub3BlbkVkaXRvcnMoaW5hY3RpdmVFZGl0b3JzLm1hcCgoeyBlZGl0b3IgfSkgPT4gZWRpdG9yKSk7XG5cblx0XHQvLyBPcGVuaW5nIG1hbnkgZWRpdG9ycyBhdCBvbmNlIGNhbiBwdXQgYW55IGVkaXRvciB0byBiZVxuXHRcdC8vIHRoZSBhY3RpdmUgb25lIGRlcGVuZGluZyBvbiBvcHRpb25zLiBBcyBzdWNoLCB3ZSBzaW1wbHlcblx0XHQvLyByZXR1cm4gdGhlIGFjdGl2ZSBlZGl0b3IgcGFuZSBhZnRlciB0aGlzIG9wZXJhdGlvbi5cblx0XHRyZXR1cm4gdGhpcy5lZGl0b3JQYW5lLmFjdGl2ZUVkaXRvclBhbmUgPz8gdW5kZWZpbmVkO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIG1vdmVFZGl0b3IoKVxuXG5cdG1vdmVFZGl0b3JzKGVkaXRvcnM6IHsgZWRpdG9yOiBFZGl0b3JJbnB1dDsgb3B0aW9ucz86IElFZGl0b3JPcHRpb25zIH1bXSwgdGFyZ2V0OiBFZGl0b3JHcm91cFZpZXcpOiBib29sZWFuIHtcblxuXHRcdC8vIE9wdGltaXphdGlvbjoga25vd2luZyB0aGF0IHdlIG1vdmUgbWFueSBlZGl0b3JzLCB3ZVxuXHRcdC8vIGRlbGF5IHRoZSB0aXRsZSB1cGRhdGUgdG8gYSBsYXRlciBwb2ludCBmb3IgdGhpcyBncm91cFxuXHRcdC8vIHRocm91Z2ggYSBtZXRob2QgdGhhdCBhbGxvd3MgZm9yIGJ1bGsgdXBkYXRlcyBidXQgb25seVxuXHRcdC8vIHdoZW4gbW92aW5nIHRvIGEgZGlmZmVyZW50IGdyb3VwIHdoZXJlIG1hbnkgZWRpdG9yc1xuXHRcdC8vIGFyZSBtb3JlIGxpa2VseSB0byBvY2N1ci5cblx0XHRjb25zdCBpbnRlcm5hbE9wdGlvbnM6IElJbnRlcm5hbE1vdmVDb3B5T3B0aW9ucyA9IHtcblx0XHRcdHNraXBUaXRsZVVwZGF0ZTogdGhpcyAhPT0gdGFyZ2V0XG5cdFx0fTtcblxuXHRcdGxldCBtb3ZlRmFpbGVkID0gZmFsc2U7XG5cblx0XHRjb25zdCBtb3ZlZEVkaXRvcnMgPSBuZXcgU2V0PEVkaXRvcklucHV0PigpO1xuXHRcdGZvciAoY29uc3QgeyBlZGl0b3IsIG9wdGlvbnMgfSBvZiBlZGl0b3JzKSB7XG5cdFx0XHRpZiAodGhpcy5tb3ZlRWRpdG9yKGVkaXRvciwgdGFyZ2V0LCBvcHRpb25zLCBpbnRlcm5hbE9wdGlvbnMpKSB7XG5cdFx0XHRcdG1vdmVkRWRpdG9ycy5hZGQoZWRpdG9yKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1vdmVGYWlsZWQgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSB0aGUgdGl0bGUgY29udHJvbCBhbGwgYXQgb25jZSB3aXRoIGFsbCBlZGl0b3JzXG5cdFx0Ly8gaW4gc291cmNlIGFuZCB0YXJnZXQgaWYgdGhlIHRpdGxlIHVwZGF0ZSB3YXMgc2tpcHBlZFxuXHRcdGlmIChpbnRlcm5hbE9wdGlvbnMuc2tpcFRpdGxlVXBkYXRlKSB7XG5cdFx0XHR0YXJnZXQudGl0bGVDb250cm9sLm9wZW5FZGl0b3JzKEFycmF5LmZyb20obW92ZWRFZGl0b3JzKSk7XG5cdFx0XHR0aGlzLnRpdGxlQ29udHJvbC5jbG9zZUVkaXRvcnMoQXJyYXkuZnJvbShtb3ZlZEVkaXRvcnMpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gIW1vdmVGYWlsZWQ7XG5cdH1cblxuXHRtb3ZlRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQsIHRhcmdldDogRWRpdG9yR3JvdXBWaWV3LCBvcHRpb25zPzogSUVkaXRvck9wdGlvbnMsIGludGVybmFsT3B0aW9ucz86IElJbnRlcm5hbE1vdmVDb3B5T3B0aW9ucyk6IGJvb2xlYW4ge1xuXG5cdFx0Ly8gTW92ZSB3aXRoaW4gc2FtZSBncm91cFxuXHRcdGlmICh0aGlzID09PSB0YXJnZXQpIHtcblx0XHRcdHRoaXMuZG9Nb3ZlRWRpdG9ySW5zaWRlR3JvdXAoZWRpdG9yLCBvcHRpb25zKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIE1vdmUgYWNyb3NzIGdyb3Vwc1xuXHRcdGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG9Nb3ZlT3JDb3B5RWRpdG9yQWNyb3NzR3JvdXBzKGVkaXRvciwgdGFyZ2V0LCBvcHRpb25zLCB7IC4uLmludGVybmFsT3B0aW9ucywga2VlcENvcHk6IGZhbHNlIH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZG9Nb3ZlRWRpdG9ySW5zaWRlR3JvdXAoY2FuZGlkYXRlOiBFZGl0b3JJbnB1dCwgb3B0aW9ucz86IElFZGl0b3JPcGVuT3B0aW9ucyk6IHZvaWQge1xuXHRcdGNvbnN0IG1vdmVUb0luZGV4ID0gb3B0aW9ucyA/IG9wdGlvbnMuaW5kZXggOiB1bmRlZmluZWQ7XG5cdFx0aWYgKHR5cGVvZiBtb3ZlVG9JbmRleCAhPT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybjsgLy8gZG8gbm90aGluZyBpZiB3ZSBtb3ZlIGludG8gc2FtZSBncm91cCB3aXRob3V0IGluZGV4XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIG1vZGVsIGFuZCBtYWtlIHN1cmUgdG8gY29udGludWUgdG8gdXNlIHRoZSBlZGl0b3Igd2UgZ2V0IGZyb21cblx0XHQvLyB0aGUgbW9kZWwuIEl0IGlzIHBvc3NpYmxlIHRoYXQgdGhlIGVkaXRvciB3YXMgYWxyZWFkeSBvcGVuZWQgYW5kIHdlXG5cdFx0Ly8gd2FudCB0byBlbnN1cmUgdGhhdCB3ZSB1c2UgdGhlIGV4aXN0aW5nIGluc3RhbmNlIGluIHRoYXQgY2FzZS5cblx0XHRjb25zdCBjdXJyZW50SW5kZXggPSB0aGlzLm1vZGVsLmluZGV4T2YoY2FuZGlkYXRlKTtcblx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLm1vZGVsLmdldEVkaXRvckJ5SW5kZXgoY3VycmVudEluZGV4KTtcblx0XHRpZiAoIWVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIE1vdmUgd2hlbiBpbmRleCBoYXMgYWN0dWFsbHkgY2hhbmdlZFxuXHRcdGlmIChjdXJyZW50SW5kZXggIT09IG1vdmVUb0luZGV4KSB7XG5cdFx0XHRjb25zdCBvbGRTdGlja3lDb3VudCA9IHRoaXMubW9kZWwuc3RpY2t5Q291bnQ7XG5cblx0XHRcdC8vIFVwZGF0ZSBtb2RlbFxuXHRcdFx0dGhpcy5tb2RlbC5tb3ZlRWRpdG9yKGVkaXRvciwgbW92ZVRvSW5kZXgpO1xuXHRcdFx0dGhpcy5tb2RlbC5waW4oZWRpdG9yKTtcblxuXHRcdFx0Ly8gRm9yd2FyZCB0byB0aXRsZSBjb250cm9sXG5cdFx0XHR0aGlzLnRpdGxlQ29udHJvbC5tb3ZlRWRpdG9yKGVkaXRvciwgY3VycmVudEluZGV4LCBtb3ZlVG9JbmRleCwgb2xkU3RpY2t5Q291bnQgIT09IHRoaXMubW9kZWwuc3RpY2t5Q291bnQpO1xuXHRcdFx0dGhpcy50aXRsZUNvbnRyb2wucGluRWRpdG9yKGVkaXRvcik7XG5cdFx0fVxuXG5cdFx0Ly8gU3VwcG9ydCB0aGUgb3B0aW9uIHRvIHN0aWNrIHRoZSBlZGl0b3IgZXZlbiBpZiBpdCBpcyBtb3ZlZC5cblx0XHQvLyBJdCBpcyBpbXBvcnRhbnQgdGhhdCB3ZSBjYWxsIHRoaXMgbWV0aG9kIGFmdGVyIHdlIGhhdmUgbW92ZWRcblx0XHQvLyB0aGUgZWRpdG9yIGJlY2F1c2UgdGhlIHJlc3VsdCBvZiBtb3ZpbmcgdGhlIGVkaXRvciBjb3VsZCBoYXZlXG5cdFx0Ly8gY2F1c2VkIGEgY2hhbmdlIGluIHN0aWNreSBzdGF0ZS5cblx0XHRpZiAob3B0aW9ucz8uc3RpY2t5KSB7XG5cdFx0XHR0aGlzLnN0aWNrRWRpdG9yKGVkaXRvcik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBkb01vdmVPckNvcHlFZGl0b3JBY3Jvc3NHcm91cHMoZWRpdG9yOiBFZGl0b3JJbnB1dCwgdGFyZ2V0OiBFZGl0b3JHcm91cFZpZXcsIG9wZW5PcHRpb25zPzogSUVkaXRvck9wZW5PcHRpb25zLCBpbnRlcm5hbE9wdGlvbnM/OiBJSW50ZXJuYWxNb3ZlQ29weU9wdGlvbnMpOiBib29sZWFuIHtcblx0XHRjb25zdCBrZWVwQ29weSA9IGludGVybmFsT3B0aW9ucz8ua2VlcENvcHk7XG5cblx0XHQvLyBWYWxpZGF0ZSB0aGF0IHdlIGNhbiBtb3ZlXG5cdFx0aWYgKCFrZWVwQ29weSB8fCBlZGl0b3IuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5TaW5nbGV0b24pIC8qIHNpbmdsZXRvbiBlZGl0b3JzIHdpbGwgYWx3YXlzIG1vdmUgKi8pIHtcblx0XHRcdGNvbnN0IGNhbk1vdmVWZXRvID0gZWRpdG9yLmNhbk1vdmUodGhpcy5pZCwgdGFyZ2V0LmlkKTtcblx0XHRcdGlmICh0eXBlb2YgY2FuTW92ZVZldG8gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdHRoaXMuZGlhbG9nU2VydmljZS5lcnJvcihjYW5Nb3ZlVmV0bywgbG9jYWxpemUoJ21vdmVFcnJvckRldGFpbHMnLCBcIlRyeSBzYXZpbmcgb3IgcmV2ZXJ0aW5nIHRoZSBlZGl0b3IgZmlyc3QgYW5kIHRoZW4gdHJ5IGFnYWluLlwiKSk7XG5cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFdoZW4gbW92aW5nL2NvcHlpbmcgYW4gZWRpdG9yLCB0cnkgdG8gcHJlc2VydmUgYXMgbXVjaCB2aWV3IHN0YXRlIGFzIHBvc3NpYmxlXG5cdFx0Ly8gYnkgY2hlY2tpbmcgZm9yIHRoZSBlZGl0b3IgdG8gYmUgYSB0ZXh0IGVkaXRvciBhbmQgY3JlYXRpbmcgdGhlIG9wdGlvbnMgYWNjb3JkaW5nbHlcblx0XHQvLyBpZiBzb1xuXHRcdGNvbnN0IG9wdGlvbnMgPSBmaWxsQWN0aXZlRWRpdG9yVmlld1N0YXRlKHRoaXMsIGVkaXRvciwge1xuXHRcdFx0Li4ub3Blbk9wdGlvbnMsXG5cdFx0XHRwaW5uZWQ6IHRydWUsIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gYWx3YXlzIHBpbiBtb3ZlZCBlZGl0b3Jcblx0XHRcdHN0aWNreTogb3Blbk9wdGlvbnM/LnN0aWNreSA/PyAoIWtlZXBDb3B5ICYmIHRoaXMubW9kZWwuaXNTdGlja3koZWRpdG9yKSlcdC8vIHByZXNlcnZlIHN0aWNreSBzdGF0ZSBvbmx5IGlmIGVkaXRvciBpcyBtb3ZlZCBvciBleHBsaWNpdGx5IHdhbnRlZCAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzk5MDM1KVxuXHRcdH0pO1xuXG5cdFx0Ly8gSW5kaWNhdGUgd2lsbCBtb3ZlIGV2ZW50XG5cdFx0aWYgKCFrZWVwQ29weSkge1xuXHRcdFx0dGhpcy5fb25XaWxsTW92ZUVkaXRvci5maXJlKHtcblx0XHRcdFx0Z3JvdXBJZDogdGhpcy5pZCxcblx0XHRcdFx0ZWRpdG9yLFxuXHRcdFx0XHR0YXJnZXQ6IHRhcmdldC5pZFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gQSBtb3ZlIHRvIGFub3RoZXIgZ3JvdXAgaXMgYW4gb3BlbiBmaXJzdC4uLlxuXHRcdHRhcmdldC5kb09wZW5FZGl0b3Ioa2VlcENvcHkgPyBlZGl0b3IuY29weSgpIDogZWRpdG9yLCBvcHRpb25zLCBpbnRlcm5hbE9wdGlvbnMpO1xuXG5cdFx0Ly8gLi4uYW5kIGEgY2xvc2UgYWZ0ZXJ3YXJkcyAodW5sZXNzIHdlIGNvcHkpXG5cdFx0aWYgKCFrZWVwQ29weSkge1xuXHRcdFx0dGhpcy5kb0Nsb3NlRWRpdG9yKGVkaXRvciwgdHJ1ZSAvKiBkbyBub3QgZm9jdXMgbmV4dCBvbmUgYmVoaW5kIGlmIGFueSAqLywgeyAuLi5pbnRlcm5hbE9wdGlvbnMsIGNvbnRleHQ6IEVkaXRvckNsb3NlQ29udGV4dC5NT1ZFIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIGNvcHlFZGl0b3IoKVxuXG5cdGNvcHlFZGl0b3JzKGVkaXRvcnM6IHsgZWRpdG9yOiBFZGl0b3JJbnB1dDsgb3B0aW9ucz86IElFZGl0b3JPcHRpb25zIH1bXSwgdGFyZ2V0OiBFZGl0b3JHcm91cFZpZXcpOiB2b2lkIHtcblxuXHRcdC8vIE9wdGltaXphdGlvbjoga25vd2luZyB0aGF0IHdlIG1vdmUgbWFueSBlZGl0b3JzLCB3ZVxuXHRcdC8vIGRlbGF5IHRoZSB0aXRsZSB1cGRhdGUgdG8gYSBsYXRlciBwb2ludCBmb3IgdGhpcyBncm91cFxuXHRcdC8vIHRocm91Z2ggYSBtZXRob2QgdGhhdCBhbGxvd3MgZm9yIGJ1bGsgdXBkYXRlcyBidXQgb25seVxuXHRcdC8vIHdoZW4gbW92aW5nIHRvIGEgZGlmZmVyZW50IGdyb3VwIHdoZXJlIG1hbnkgZWRpdG9yc1xuXHRcdC8vIGFyZSBtb3JlIGxpa2VseSB0byBvY2N1ci5cblx0XHRjb25zdCBpbnRlcm5hbE9wdGlvbnM6IElJbnRlcm5hbE1vdmVDb3B5T3B0aW9ucyA9IHtcblx0XHRcdHNraXBUaXRsZVVwZGF0ZTogdGhpcyAhPT0gdGFyZ2V0XG5cdFx0fTtcblxuXHRcdGZvciAoY29uc3QgeyBlZGl0b3IsIG9wdGlvbnMgfSBvZiBlZGl0b3JzKSB7XG5cdFx0XHR0aGlzLmNvcHlFZGl0b3IoZWRpdG9yLCB0YXJnZXQsIG9wdGlvbnMsIGludGVybmFsT3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIHRoZSB0aXRsZSBjb250cm9sIGFsbCBhdCBvbmNlIHdpdGggYWxsIGVkaXRvcnNcblx0XHQvLyBpbiB0YXJnZXQgaWYgdGhlIHRpdGxlIHVwZGF0ZSB3YXMgc2tpcHBlZFxuXHRcdGlmIChpbnRlcm5hbE9wdGlvbnMuc2tpcFRpdGxlVXBkYXRlKSB7XG5cdFx0XHRjb25zdCBjb3BpZWRFZGl0b3JzID0gZWRpdG9ycy5tYXAoKHsgZWRpdG9yIH0pID0+IGVkaXRvcik7XG5cdFx0XHR0YXJnZXQudGl0bGVDb250cm9sLm9wZW5FZGl0b3JzKGNvcGllZEVkaXRvcnMpO1xuXHRcdH1cblx0fVxuXG5cdGNvcHlFZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dCwgdGFyZ2V0OiBFZGl0b3JHcm91cFZpZXcsIG9wdGlvbnM/OiBJRWRpdG9yT3B0aW9ucywgaW50ZXJuYWxPcHRpb25zPzogSUludGVybmFsRWRpdG9yVGl0bGVDb250cm9sT3B0aW9ucyk6IHZvaWQge1xuXG5cdFx0Ly8gTW92ZSB3aXRoaW4gc2FtZSBncm91cCBiZWNhdXNlIHdlIGRvIG5vdCBzdXBwb3J0IHRvIHNob3cgdGhlIHNhbWUgZWRpdG9yXG5cdFx0Ly8gbXVsdGlwbGUgdGltZXMgaW4gdGhlIHNhbWUgZ3JvdXBcblx0XHRpZiAodGhpcyA9PT0gdGFyZ2V0KSB7XG5cdFx0XHR0aGlzLmRvTW92ZUVkaXRvckluc2lkZUdyb3VwKGVkaXRvciwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0Ly8gQ29weSBhY3Jvc3MgZ3JvdXBzXG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLmRvTW92ZU9yQ29weUVkaXRvckFjcm9zc0dyb3VwcyhlZGl0b3IsIHRhcmdldCwgb3B0aW9ucywgeyAuLi5pbnRlcm5hbE9wdGlvbnMsIGtlZXBDb3B5OiB0cnVlIH0pO1xuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBjbG9zZUVkaXRvcigpXG5cblx0YXN5bmMgY2xvc2VFZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCA9IHRoaXMuYWN0aXZlRWRpdG9yIHx8IHVuZGVmaW5lZCwgb3B0aW9ucz86IElDbG9zZUVkaXRvck9wdGlvbnMpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gdGhpcy5kb0Nsb3NlRWRpdG9yV2l0aENvbmZpcm1hdGlvbkhhbmRsaW5nKGVkaXRvciwgb3B0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvQ2xvc2VFZGl0b3JXaXRoQ29uZmlybWF0aW9uSGFuZGxpbmcoZWRpdG9yOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCA9IHRoaXMuYWN0aXZlRWRpdG9yIHx8IHVuZGVmaW5lZCwgb3B0aW9ucz86IElDbG9zZUVkaXRvck9wdGlvbnMsIGludGVybmFsT3B0aW9ucz86IElJbnRlcm5hbEVkaXRvckNsb3NlT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgZm9yIGNvbmZpcm1hdGlvbiBhbmQgdmV0b1xuXHRcdGNvbnN0IHZldG8gPSBhd2FpdCB0aGlzLmhhbmRsZUNsb3NlQ29uZmlybWF0aW9uKFtlZGl0b3JdKTtcblx0XHRpZiAodmV0bykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIERvIGNsb3NlXG5cdFx0dGhpcy5kb0Nsb3NlRWRpdG9yKGVkaXRvciwgb3B0aW9ucz8ucHJlc2VydmVGb2N1cywgaW50ZXJuYWxPcHRpb25zKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0Nsb3NlRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQsIHByZXNlcnZlRm9jdXMgPSAodGhpcy5ncm91cHNWaWV3LmFjdGl2ZUdyb3VwICE9PSB0aGlzKSwgaW50ZXJuYWxPcHRpb25zPzogSUludGVybmFsRWRpdG9yQ2xvc2VPcHRpb25zKTogdm9pZCB7XG5cblx0XHQvLyBGb3J3YXJkIHRvIHRpdGxlIGNvbnRyb2wgdW5sZXNzIHNraXBwZWQgdmlhIGludGVybmFsIG9wdGlvbnNcblx0XHRpZiAoIWludGVybmFsT3B0aW9ucz8uc2tpcFRpdGxlVXBkYXRlKSB7XG5cdFx0XHR0aGlzLnRpdGxlQ29udHJvbC5iZWZvcmVDbG9zZUVkaXRvcihlZGl0b3IpO1xuXHRcdH1cblxuXHRcdC8vIENsb3NpbmcgdGhlIGFjdGl2ZSBlZGl0b3Igb2YgdGhlIGdyb3VwIGlzIGEgYml0IG1vcmUgd29ya1xuXHRcdGlmICh0aGlzLm1vZGVsLmlzQWN0aXZlKGVkaXRvcikpIHtcblx0XHRcdHRoaXMuZG9DbG9zZUFjdGl2ZUVkaXRvcihwcmVzZXJ2ZUZvY3VzLCBpbnRlcm5hbE9wdGlvbnMpO1xuXHRcdH1cblxuXHRcdC8vIENsb3NpbmcgaW5hY3RpdmUgZWRpdG9yIGlzIGp1c3QgYSBtb2RlbCB1cGRhdGVcblx0XHRlbHNlIHtcblx0XHRcdHRoaXMuZG9DbG9zZUluYWN0aXZlRWRpdG9yKGVkaXRvciwgaW50ZXJuYWxPcHRpb25zKTtcblx0XHR9XG5cblx0XHQvLyBGb3J3YXJkIHRvIHRpdGxlIGNvbnRyb2wgdW5sZXNzIHNraXBwZWQgdmlhIGludGVybmFsIG9wdGlvbnNcblx0XHRpZiAoIWludGVybmFsT3B0aW9ucz8uc2tpcFRpdGxlVXBkYXRlKSB7XG5cdFx0XHR0aGlzLnRpdGxlQ29udHJvbC5jbG9zZUVkaXRvcihlZGl0b3IpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZG9DbG9zZUFjdGl2ZUVkaXRvcihwcmVzZXJ2ZUZvY3VzID0gKHRoaXMuZ3JvdXBzVmlldy5hY3RpdmVHcm91cCAhPT0gdGhpcyksIGludGVybmFsT3B0aW9ucz86IElJbnRlcm5hbEVkaXRvckNsb3NlT3B0aW9ucyk6IHZvaWQge1xuXHRcdGNvbnN0IGVkaXRvclRvQ2xvc2UgPSB0aGlzLmFjdGl2ZUVkaXRvcjtcblx0XHRjb25zdCByZXN0b3JlRm9jdXMgPSAhcHJlc2VydmVGb2N1cyAmJiB0aGlzLnNob3VsZFJlc3RvcmVGb2N1cyh0aGlzLmVsZW1lbnQpO1xuXG5cdFx0Ly8gT3B0aW1pemF0aW9uOiBpZiB3ZSBhcmUgYWJvdXQgdG8gY2xvc2UgdGhlIGxhc3QgZWRpdG9yIGluIHRoaXMgZ3JvdXAgYW5kIHNldHRpbmdzXG5cdFx0Ly8gYXJlIGNvbmZpZ3VyZWQgdG8gY2xvc2UgdGhlIGdyb3VwIHNpbmNlIGl0IHdpbGwgYmUgZW1wdHksIHdlIGZpcnN0IHNldCB0aGUgbGFzdFxuXHRcdC8vIGFjdGl2ZSBncm91cCBhcyBlbXB0eSBiZWZvcmUgY2xvc2luZyB0aGUgZWRpdG9yLiBUaGlzIHJlZHVjZXMgdGhlIGFtb3VudCBvZiBlZGl0b3Jcblx0XHQvLyBjaGFuZ2UgZXZlbnRzIHRoYXQgdGhpcyBvcGVyYXRpb24gZW1pdHMgYW5kIHdpbGwgcmVkdWNlIGZsaWNrZXIuIFdpdGhvdXQgdGhpc1xuXHRcdC8vIG9wdGltaXphdGlvbiwgdGhpcyBncm91cCAoaWYgYWN0aXZlKSB3b3VsZCBmaXJzdCB0cmlnZ2VyIGEgYWN0aXZlIGVkaXRvciBjaGFuZ2Vcblx0XHQvLyBldmVudCBiZWNhdXNlIGl0IGJlY2FtZSBlbXB0eSwgb25seSB0byB0aGVuIHRyaWdnZXIgYW5vdGhlciBvbmUgd2hlbiB0aGUgbmV4dFxuXHRcdC8vIGdyb3VwIGdldHMgYWN0aXZlLlxuXHRcdGNvbnN0IGNsb3NlRW1wdHlHcm91cCA9IHRoaXMuZ3JvdXBzVmlldy5wYXJ0T3B0aW9ucy5jbG9zZUVtcHR5R3JvdXBzO1xuXHRcdGlmIChjbG9zZUVtcHR5R3JvdXAgJiYgdGhpcy5hY3RpdmUgJiYgdGhpcy5jb3VudCA9PT0gMSkge1xuXHRcdFx0Y29uc3QgbW9zdFJlY2VudGx5QWN0aXZlR3JvdXBzID0gdGhpcy5ncm91cHNWaWV3LmdldEdyb3VwcyhHcm91cHNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSk7XG5cdFx0XHRjb25zdCBuZXh0QWN0aXZlR3JvdXAgPSBtb3N0UmVjZW50bHlBY3RpdmVHcm91cHNbMV07IC8vIFswXSB3aWxsIGJlIHRoZSBjdXJyZW50IG9uZSwgc28gdGFrZSBbMV1cblx0XHRcdGlmIChuZXh0QWN0aXZlR3JvdXApIHtcblx0XHRcdFx0aWYgKHJlc3RvcmVGb2N1cykge1xuXHRcdFx0XHRcdG5leHRBY3RpdmVHcm91cC5mb2N1cygpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuZ3JvdXBzVmlldy5hY3RpdmF0ZUdyb3VwKG5leHRBY3RpdmVHcm91cCwgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgbW9kZWxcblx0XHRpZiAoZWRpdG9yVG9DbG9zZSkge1xuXHRcdFx0dGhpcy5tb2RlbC5jbG9zZUVkaXRvcihlZGl0b3JUb0Nsb3NlLCBpbnRlcm5hbE9wdGlvbnM/LmNvbnRleHQpO1xuXHRcdH1cblxuXHRcdC8vIE9wZW4gbmV4dCBhY3RpdmUgaWYgdGhlcmUgYXJlIG1vcmUgdG8gc2hvd1xuXHRcdGNvbnN0IG5leHRBY3RpdmVFZGl0b3IgPSB0aGlzLm1vZGVsLmFjdGl2ZUVkaXRvcjtcblx0XHRpZiAobmV4dEFjdGl2ZUVkaXRvcikge1xuXHRcdFx0bGV0IGFjdGl2YXRpb246IEVkaXRvckFjdGl2YXRpb24gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAocHJlc2VydmVGb2N1cyAmJiB0aGlzLmdyb3Vwc1ZpZXcuYWN0aXZlR3JvdXAgIT09IHRoaXMpIHtcblx0XHRcdFx0Ly8gSWYgd2UgYXJlIG9wZW5pbmcgdGhlIG5leHQgZWRpdG9yIGluIGFuIGluYWN0aXZlIGdyb3VwXG5cdFx0XHRcdC8vIHdpdGhvdXQgZm9jdXNzaW5nIGl0LCBlbnN1cmUgd2UgcHJlc2VydmUgdGhlIGVkaXRvclxuXHRcdFx0XHQvLyBncm91cCBzaXplcyBpbiBjYXNlIHRoYXQgZ3JvdXAgaXMgbWluaW1pemVkLlxuXHRcdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTE3Njg2XG5cdFx0XHRcdGFjdGl2YXRpb24gPSBFZGl0b3JBY3RpdmF0aW9uLlBSRVNFUlZFO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBvcHRpb25zOiBJRWRpdG9yT3B0aW9ucyA9IHtcblx0XHRcdFx0cHJlc2VydmVGb2N1cyxcblx0XHRcdFx0YWN0aXZhdGlvbixcblx0XHRcdFx0Ly8gV2hlbiBjbG9zaW5nIGFuIGVkaXRvciBkdWUgdG8gYW4gZXJyb3Igd2UgY2FuIGVuZCB1cCBpbiBhIGxvb3Agd2hlcmUgd2UgY29udGludWUgY2xvc2luZ1xuXHRcdFx0XHQvLyBlZGl0b3JzIHRoYXQgZmFpbCB0byBvcGVuIChlLmcuIHdoZW4gdGhlIGZpbGUgbm8gbG9uZ2VyIGV4aXN0cykuIFdlIGRvIG5vdCB3YW50IHRvIHNob3dcblx0XHRcdFx0Ly8gcmVwZWF0ZWQgZXJyb3JzIGluIHRoaXMgY2FzZSB0byB0aGUgdXNlci4gQXMgc3VjaCwgaWYgd2Ugb3BlbiB0aGUgbmV4dCBlZGl0b3IgYW5kIHdlIGFyZVxuXHRcdFx0XHQvLyBpbiBhIHNjb3BlIG9mIGEgcHJldmlvdXMgZWRpdG9yIGZhaWxpbmcsIHdlIHNpbGVuY2UgdGhlIGlucHV0IGVycm9ycyB1bnRpbCB0aGUgZWRpdG9yIGlzXG5cdFx0XHRcdC8vIG9wZW5lZCBieSBzZXR0aW5nIGlnbm9yZUVycm9yOiB0cnVlLlxuXHRcdFx0XHRpZ25vcmVFcnJvcjogaW50ZXJuYWxPcHRpb25zPy5mcm9tRXJyb3Jcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IGludGVybmFsRWRpdG9yT3Blbk9wdGlvbnM6IElJbnRlcm5hbEVkaXRvck9wZW5PcHRpb25zID0ge1xuXHRcdFx0XHQvLyBXaGVuIGNsb3NpbmcgYW4gZWRpdG9yLCB3ZSByZXZlYWwgdGhlIG5leHQgb25lIGluIHRoZSBncm91cC5cblx0XHRcdFx0Ly8gSG93ZXZlciwgdGhpcyBjYW4gYmUgYSByZXN1bHQgb2YgbW92aW5nIGFuIGVkaXRvciB0byBhbm90aGVyXG5cdFx0XHRcdC8vIHdpbmRvdyBzbyB3ZSBleHBsaWNpdGx5IGRpc2FibGUgd2luZG93IHJlb3JkZXJpbmcgaW4gdGhpcyBjYXNlLlxuXHRcdFx0XHRwcmVzZXJ2ZVdpbmRvd09yZGVyOiB0cnVlXG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLmRvT3BlbkVkaXRvcihuZXh0QWN0aXZlRWRpdG9yLCBvcHRpb25zLCBpbnRlcm5hbEVkaXRvck9wZW5PcHRpb25zKTtcblx0XHR9XG5cblx0XHQvLyBPdGhlcndpc2Ugd2UgYXJlIGVtcHR5LCBzbyBjbGVhciBmcm9tIGVkaXRvciBjb250cm9sIGFuZCBzZW5kIGV2ZW50XG5cdFx0ZWxzZSB7XG5cblx0XHRcdC8vIEZvcndhcmQgdG8gZWRpdG9yIHBhbmVcblx0XHRcdGlmIChlZGl0b3JUb0Nsb3NlKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yUGFuZS5jbG9zZUVkaXRvcihlZGl0b3JUb0Nsb3NlKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVzdG9yZSBmb2N1cyB0byBncm91cCBjb250YWluZXIgYXMgbmVlZGVkIHVubGVzcyBncm91cCBnZXRzIGNsb3NlZFxuXHRcdFx0aWYgKHJlc3RvcmVGb2N1cyAmJiAhY2xvc2VFbXB0eUdyb3VwKSB7XG5cdFx0XHRcdHRoaXMuZm9jdXMoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRXZlbnRzXG5cdFx0XHR0aGlzLl9vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZS5maXJlKHsgZWRpdG9yOiB1bmRlZmluZWQgfSk7XG5cblx0XHRcdC8vIFJlbW92ZSBlbXB0eSBncm91cCBpZiB3ZSBzaG91bGRcblx0XHRcdGlmIChjbG9zZUVtcHR5R3JvdXApIHtcblx0XHRcdFx0dGhpcy5ncm91cHNWaWV3LnJlbW92ZUdyb3VwKHRoaXMsIHByZXNlcnZlRm9jdXMpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2hvdWxkUmVzdG9yZUZvY3VzKHRhcmdldDogRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGFjdGl2ZUVsZW1lbnQgPSBnZXRBY3RpdmVFbGVtZW50KCk7XG5cdFx0aWYgKGFjdGl2ZUVsZW1lbnQgPT09IHRhcmdldC5vd25lckRvY3VtZW50LmJvZHkpIHtcblx0XHRcdHJldHVybiB0cnVlOyAvLyBhbHdheXMgcmVzdG9yZSBmb2N1cyBpZiBub3RoaW5nIGlzIGZvY3VzZWQgY3VycmVudGx5XG5cdFx0fVxuXG5cdFx0Ly8gb3RoZXJ3aXNlIGNoZWNrIGZvciB0aGUgYWN0aXZlIGVsZW1lbnQgYmVpbmcgYW4gYW5jZXN0b3Igb2YgdGhlIHRhcmdldFxuXHRcdHJldHVybiBpc0FuY2VzdG9yKGFjdGl2ZUVsZW1lbnQsIHRhcmdldCk7XG5cdH1cblxuXHRwcml2YXRlIGRvQ2xvc2VJbmFjdGl2ZUVkaXRvcihlZGl0b3I6IEVkaXRvcklucHV0LCBpbnRlcm5hbE9wdGlvbnM/OiBJSW50ZXJuYWxFZGl0b3JDbG9zZU9wdGlvbnMpOiB2b2lkIHtcblxuXHRcdC8vIFVwZGF0ZSBtb2RlbFxuXHRcdHRoaXMubW9kZWwuY2xvc2VFZGl0b3IoZWRpdG9yLCBpbnRlcm5hbE9wdGlvbnM/LmNvbnRleHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVDbG9zZUNvbmZpcm1hdGlvbihlZGl0b3JzOiBFZGl0b3JJbnB1dFtdKTogUHJvbWlzZTxib29sZWFuIC8qIHZldG8gKi8+IHtcblx0XHRpZiAoIWVkaXRvcnMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIG5vIHZldG9cblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3IgPSBlZGl0b3JzLnNoaWZ0KCkhO1xuXG5cdFx0Ly8gVG8gcHJldmVudCBtdWx0aXBsZSBjb25maXJtYXRpb24gZGlhbG9ncyBmcm9tIHNob3dpbmcgdXAgb25lIGFmdGVyIHRoZSBvdGhlclxuXHRcdC8vIHdlIGNoZWNrIGlmIGEgcGVuZGluZyBjb25maXJtYXRpb24gaXMgY3VycmVudGx5IHNob3dpbmcgYW5kIGlmIHNvLCBqb2luIHRoYXRcblx0XHRsZXQgaGFuZGxlQ2xvc2VDb25maXJtYXRpb25Qcm9taXNlID0gdGhpcy5tYXBFZGl0b3JUb1BlbmRpbmdDb25maXJtYXRpb24uZ2V0KGVkaXRvcik7XG5cdFx0aWYgKCFoYW5kbGVDbG9zZUNvbmZpcm1hdGlvblByb21pc2UpIHtcblx0XHRcdGhhbmRsZUNsb3NlQ29uZmlybWF0aW9uUHJvbWlzZSA9IHRoaXMuZG9IYW5kbGVDbG9zZUNvbmZpcm1hdGlvbihlZGl0b3IpO1xuXHRcdFx0dGhpcy5tYXBFZGl0b3JUb1BlbmRpbmdDb25maXJtYXRpb24uc2V0KGVkaXRvciwgaGFuZGxlQ2xvc2VDb25maXJtYXRpb25Qcm9taXNlKTtcblx0XHR9XG5cblx0XHRsZXQgdmV0bzogYm9vbGVhbjtcblx0XHR0cnkge1xuXHRcdFx0dmV0byA9IGF3YWl0IGhhbmRsZUNsb3NlQ29uZmlybWF0aW9uUHJvbWlzZTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5tYXBFZGl0b3JUb1BlbmRpbmdDb25maXJtYXRpb24uZGVsZXRlKGVkaXRvcik7XG5cdFx0fVxuXG5cdFx0Ly8gUmV0dXJuIGZvciB0aGUgZmlyc3QgdmV0byB3ZSBnb3Rcblx0XHRpZiAodmV0bykge1xuXHRcdFx0cmV0dXJuIHZldG87XG5cdFx0fVxuXG5cdFx0Ly8gT3RoZXJ3aXNlIGNvbnRpbnVlIHdpdGggdGhlIHJlbWFpbmRlcnNcblx0XHRyZXR1cm4gdGhpcy5oYW5kbGVDbG9zZUNvbmZpcm1hdGlvbihlZGl0b3JzKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9IYW5kbGVDbG9zZUNvbmZpcm1hdGlvbihlZGl0b3I6IEVkaXRvcklucHV0LCBvcHRpb25zPzogeyBza2lwQXV0b1NhdmU6IGJvb2xlYW4gfSk6IFByb21pc2U8Ym9vbGVhbiAvKiB2ZXRvICovPiB7XG5cdFx0aWYgKCF0aGlzLnNob3VsZENvbmZpcm1DbG9zZShlZGl0b3IpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIG5vIHZldG9cblx0XHR9XG5cblx0XHRpZiAoZWRpdG9yIGluc3RhbmNlb2YgU2lkZUJ5U2lkZUVkaXRvcklucHV0ICYmIHRoaXMubW9kZWwuY29udGFpbnMoZWRpdG9yLnByaW1hcnkpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIHByaW1hcnktc2lkZSBvZiBlZGl0b3IgaXMgc3RpbGwgb3BlbmVkIHNvbWV3aGVyZSBlbHNlXG5cdFx0fVxuXG5cdFx0Ly8gTm90ZTogd2UgZXhwbGljaXRseSBkZWNpZGUgdG8gYXNrIGZvciBjb25maXJtIGlmIGNsb3NpbmcgYSBub3JtYWwgZWRpdG9yIGV2ZW5cblx0XHQvLyBpZiBpdCBpcyBvcGVuZWQgaW4gYSBzaWRlLWJ5LXNpZGUgZWRpdG9yIGluIHRoZSBncm91cC4gVGhpcyBkZWNpc2lvbiBpcyBtYWRlXG5cdFx0Ly8gYmVjYXVzZSBpdCBtYXkgYmUgbGVzcyBvYnZpb3VzIHRoYXQgb25lIHNpZGUgb2YgYSBzaWRlIGJ5IHNpZGUgZWRpdG9yIGlzIGRpcnR5XG5cdFx0Ly8gYW5kIGNhbiBzdGlsbCBiZSBjaGFuZ2VkLlxuXHRcdC8vIFRoZSBvbmx5IGV4Y2VwdGlvbiBpcyB3aGVuIHRoZSBzYW1lIGVkaXRvciBpcyBvcGVuZWQgb24gYm90aCBzaWRlcyBvZiBhIHNpZGVcblx0XHQvLyBieSBzaWRlIGVkaXRvciAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzODQ0MilcblxuXHRcdGlmICh0aGlzLmVkaXRvclBhcnRzVmlldy5ncm91cHMuc29tZShncm91cFZpZXcgPT4ge1xuXHRcdFx0aWYgKGdyb3VwVmlldyA9PT0gdGhpcykge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vIHNraXAgKHdlIGFscmVhZHkgaGFuZGxlZCBvdXIgZ3JvdXAgYWJvdmUpXG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG90aGVyR3JvdXAgPSBncm91cFZpZXc7XG5cdFx0XHRpZiAob3RoZXJHcm91cC5jb250YWlucyhlZGl0b3IsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQk9USCB9KSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gZXhhY3QgZWRpdG9yIHN0aWxsIG9wZW5lZCAoZWl0aGVyIHNpbmdsZSwgb3Igc3BsaXQtaW4tZ3JvdXApXG5cdFx0XHR9XG5cblx0XHRcdGlmIChlZGl0b3IgaW5zdGFuY2VvZiBTaWRlQnlTaWRlRWRpdG9ySW5wdXQgJiYgb3RoZXJHcm91cC5jb250YWlucyhlZGl0b3IucHJpbWFyeSkpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7IC8vIHByaW1hcnkgc2lkZSBvZiBzaWRlIGJ5IHNpZGUgZWRpdG9yIHN0aWxsIG9wZW5lZFxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gZWRpdG9yIGlzIHN0aWxsIGVkaXRhYmxlIHNvbWV3aGVyZSBlbHNlXG5cdFx0fVxuXG5cdFx0Ly8gSW4gc29tZSBjYXNlcyB0cmlnZ2VyIHNhdmUgYmVmb3JlIG9wZW5pbmcgdGhlIGRpYWxvZyBkZXBlbmRpbmdcblx0XHQvLyBvbiBhdXRvLXNhdmUgY29uZmlndXJhdGlvbi5cblx0XHQvLyBIb3dldmVyLCBtYWtlIHN1cmUgdG8gcmVzcGVjdCBgc2tpcEF1dG9TYXZlYCBvcHRpb24gaW4gY2FzZSB0aGUgYXV0b21hdGVkXG5cdFx0Ly8gc2F2ZSBmYWlscyB3aGljaCB3b3VsZCByZXN1bHQgaW4gdGhlIGVkaXRvciBuZXZlciBjbG9zaW5nLlxuXHRcdC8vIEFsc28sIHdlIG9ubHkgZG8gdGhpcyBpZiBubyBjdXN0b20gY29uZmlybWF0aW9uIGhhbmRsaW5nIGlzIGltcGxlbWVudGVkLlxuXHRcdGxldCBjb25maXJtYXRpb24gPSBDb25maXJtUmVzdWx0LkNBTkNFTDtcblx0XHRsZXQgc2F2ZVJlYXNvbiA9IFNhdmVSZWFzb24uRVhQTElDSVQ7XG5cdFx0bGV0IGF1dG9TYXZlID0gZmFsc2U7XG5cdFx0aWYgKCFlZGl0b3IuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5VbnRpdGxlZCkgJiYgIW9wdGlvbnM/LnNraXBBdXRvU2F2ZSAmJiAhZWRpdG9yLmNsb3NlSGFuZGxlcikge1xuXG5cdFx0XHQvLyBBdXRvLXNhdmUgb24gZm9jdXMgY2hhbmdlOiBzYXZlLCBiZWNhdXNlIGEgZGlhbG9nIHdvdWxkIHN0ZWFsIGZvY3VzXG5cdFx0XHQvLyAoc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMDg3NTIpXG5cdFx0XHRpZiAodGhpcy5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldEF1dG9TYXZlTW9kZShlZGl0b3IpLm1vZGUgPT09IEF1dG9TYXZlTW9kZS5PTl9GT0NVU19DSEFOR0UpIHtcblx0XHRcdFx0YXV0b1NhdmUgPSB0cnVlO1xuXHRcdFx0XHRjb25maXJtYXRpb24gPSBDb25maXJtUmVzdWx0LlNBVkU7XG5cdFx0XHRcdHNhdmVSZWFzb24gPSBTYXZlUmVhc29uLkZPQ1VTX0NIQU5HRTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQXV0by1zYXZlIG9uIHdpbmRvdyBjaGFuZ2U6IHNhdmUsIGJlY2F1c2Ugb24gV2luZG93cyBhbmQgTGludXgsIGFcblx0XHRcdC8vIG5hdGl2ZSBkaWFsb2cgdHJpZ2dlcnMgdGhlIHdpbmRvdyBmb2N1cyBjaGFuZ2Vcblx0XHRcdC8vIChzZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzNDI1MClcblx0XHRcdGVsc2UgaWYgKChpc05hdGl2ZSAmJiAoaXNXaW5kb3dzIHx8IGlzTGludXgpKSAmJiB0aGlzLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuZ2V0QXV0b1NhdmVNb2RlKGVkaXRvcikubW9kZSA9PT0gQXV0b1NhdmVNb2RlLk9OX1dJTkRPV19DSEFOR0UpIHtcblx0XHRcdFx0YXV0b1NhdmUgPSB0cnVlO1xuXHRcdFx0XHRjb25maXJtYXRpb24gPSBDb25maXJtUmVzdWx0LlNBVkU7XG5cdFx0XHRcdHNhdmVSZWFzb24gPSBTYXZlUmVhc29uLldJTkRPV19DSEFOR0U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gTm8gYXV0by1zYXZlIG9uIGZvY3VzIGNoYW5nZSBvciBjdXN0b20gY29uZmlybWF0aW9uIGhhbmRsZXI6IGFzayB1c2VyXG5cdFx0aWYgKCFhdXRvU2F2ZSkge1xuXG5cdFx0XHQvLyBTd2l0Y2ggdG8gZWRpdG9yIHRoYXQgd2Ugd2FudCB0byBoYW5kbGUgZm9yIGNvbmZpcm1hdGlvbiB1bmxlc3Mgc2hvd2luZyBhbHJlYWR5XG5cdFx0XHRpZiAoIXRoaXMuYWN0aXZlRWRpdG9yIHx8ICF0aGlzLmFjdGl2ZUVkaXRvci5tYXRjaGVzKGVkaXRvcikpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5kb09wZW5FZGl0b3IoZWRpdG9yKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRW5zdXJlIG91ciB3aW5kb3cgaGFzIGZvY3VzIHNpbmNlIHdlIGFyZSBhYm91dCB0byBzaG93IGEgZGlhbG9nXG5cdFx0XHRhd2FpdCB0aGlzLmhvc3RTZXJ2aWNlLmZvY3VzKGdldFdpbmRvdyh0aGlzLmVsZW1lbnQpKTtcblxuXHRcdFx0Ly8gTGV0IGVkaXRvciBoYW5kbGUgY29uZmlybWF0aW9uIGlmIGltcGxlbWVudGVkXG5cdFx0XHRpZiAodHlwZW9mIGVkaXRvci5jbG9zZUhhbmRsZXI/LmNvbmZpcm0gPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0Y29uZmlybWF0aW9uID0gYXdhaXQgZWRpdG9yLmNsb3NlSGFuZGxlci5jb25maXJtKFt7IGVkaXRvciwgZ3JvdXBJZDogdGhpcy5pZCB9XSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNob3cgYSBmaWxlIHNwZWNpZmljIGNvbmZpcm1hdGlvblxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGxldCBuYW1lOiBzdHJpbmc7XG5cdFx0XHRcdGlmIChlZGl0b3IgaW5zdGFuY2VvZiBTaWRlQnlTaWRlRWRpdG9ySW5wdXQpIHtcblx0XHRcdFx0XHRuYW1lID0gZWRpdG9yLnByaW1hcnkuZ2V0TmFtZSgpOyAvLyBwcmVmZXIgc2hvcnRlciBuYW1lcyBieSB1c2luZyBwcmltYXJ5J3MgbmFtZSBpbiB0aGlzIGNhc2Vcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRuYW1lID0gZWRpdG9yLmdldE5hbWUoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbmZpcm1hdGlvbiA9IGF3YWl0IHRoaXMuZmlsZURpYWxvZ1NlcnZpY2Uuc2hvd1NhdmVDb25maXJtKFtuYW1lXSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSXQgY291bGQgYmUgdGhhdCB0aGUgZWRpdG9yJ3MgY2hvaWNlIG9mIGNvbmZpcm1hdGlvbiBoYXMgY2hhbmdlZFxuXHRcdC8vIGdpdmVuIHRoZSBjaGVjayBmb3IgY29uZmlybWF0aW9uIGlzIGxvbmcgcnVubmluZywgc28gd2UgY2hlY2tcblx0XHQvLyBhZ2FpbiB0byBzZWUgaWYgYW55dGhpbmcgbmVlZHMgdG8gaGFwcGVuIGJlZm9yZSBjbG9zaW5nIGZvciBnb29kLlxuXHRcdC8vIFRoaXMgY2FuIGhhcHBlbiBmb3IgZXhhbXBsZSBpZiBgYXV0b1NhdmU6IG9uRm9jdXNDaGFuZ2VgIGlzIGNvbmZpZ3VyZWRcblx0XHQvLyBzbyB0aGF0IHRoZSBzYXZlIGhhcHBlbnMgd2hlbiB0aGUgZGlhbG9nIG9wZW5zLlxuXHRcdC8vIEhvd2V2ZXIsIHdlIG9ubHkgZG8gdGhpcyB1bmxlc3MgYSBjdXN0b20gY29uZmlybSBoYW5kbGVyIGlzIGluc3RhbGxlZFxuXHRcdC8vIHRoYXQgbWF5IG5vdCBiZSBmaXQgdG8gYmUgYXNrZWQgYSBzZWNvbmQgdGltZSByaWdodCBhZnRlci5cblx0XHRpZiAoIWVkaXRvci5jbG9zZUhhbmRsZXIgJiYgIXRoaXMuc2hvdWxkQ29uZmlybUNsb3NlKGVkaXRvcikpIHtcblx0XHRcdHJldHVybiBjb25maXJtYXRpb24gPT09IENvbmZpcm1SZXN1bHQuQ0FOQ0VMID8gdHJ1ZSA6IGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZSwgaGFuZGxlIGFjY29yZGluZ2x5XG5cdFx0c3dpdGNoIChjb25maXJtYXRpb24pIHtcblx0XHRcdGNhc2UgQ29uZmlybVJlc3VsdC5TQVZFOiB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGVkaXRvci5zYXZlKHRoaXMuaWQsIHsgcmVhc29uOiBzYXZlUmVhc29uIH0pO1xuXHRcdFx0XHRpZiAoIXJlc3VsdCAmJiBhdXRvU2F2ZSkge1xuXHRcdFx0XHRcdC8vIFNhdmUgZmFpbGVkIGFuZCB3ZSBuZWVkIHRvIHNpZ25hbCB0aGlzIGJhY2sgdG8gdGhlIHVzZXIsIHNvXG5cdFx0XHRcdFx0Ly8gd2UgaGFuZGxlIHRoZSBkaXJ0eSBlZGl0b3IgYWdhaW4gYnV0IHRoaXMgdGltZSBlbnN1cmluZyB0b1xuXHRcdFx0XHRcdC8vIHNob3cgdGhlIGNvbmZpcm0gZGlhbG9nXG5cdFx0XHRcdFx0Ly8gKHNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTA4NzUyKVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLmRvSGFuZGxlQ2xvc2VDb25maXJtYXRpb24oZWRpdG9yLCB7IHNraXBBdXRvU2F2ZTogdHJ1ZSB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBlZGl0b3IuaXNEaXJ0eSgpOyAvLyB2ZXRvIGlmIHN0aWxsIGRpcnR5XG5cdFx0XHR9XG5cdFx0XHRjYXNlIENvbmZpcm1SZXN1bHQuRE9OVF9TQVZFOlxuXHRcdFx0XHR0cnkge1xuXG5cdFx0XHRcdFx0Ly8gZmlyc3QgdHJ5IGEgbm9ybWFsIHJldmVydCB3aGVyZSB0aGUgY29udGVudHMgb2YgdGhlIGVkaXRvciBhcmUgcmVzdG9yZWRcblx0XHRcdFx0XHRhd2FpdCBlZGl0b3IucmV2ZXJ0KHRoaXMuaWQpO1xuXG5cdFx0XHRcdFx0cmV0dXJuIGVkaXRvci5pc0RpcnR5KCk7IC8vIHZldG8gaWYgc3RpbGwgZGlydHlcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXG5cdFx0XHRcdFx0Ly8gaWYgdGhhdCBmYWlscywgc2luY2Ugd2UgYXJlIGFib3V0IHRvIGNsb3NlIHRoZSBlZGl0b3IsIHdlIGFjY2VwdCB0aGF0XG5cdFx0XHRcdFx0Ly8gdGhlIGVkaXRvciBjYW5ub3QgYmUgcmV2ZXJ0ZWQgYW5kIGluc3RlYWQgZG8gYSBzb2Z0IHJldmVydCB0aGF0IGp1c3Rcblx0XHRcdFx0XHQvLyBlbmFibGVzIHVzIHRvIGNsb3NlIHRoZSBlZGl0b3IuIFdpdGggdGhpcywgYSB1c2VyIGNhbiBhbHdheXMgY2xvc2UgYVxuXHRcdFx0XHRcdC8vIGRpcnR5IGVkaXRvciBldmVuIHdoZW4gcmV2ZXJ0aW5nIGZhaWxzLlxuXG5cdFx0XHRcdFx0YXdhaXQgZWRpdG9yLnJldmVydCh0aGlzLmlkLCB7IHNvZnQ6IHRydWUgfSk7XG5cblx0XHRcdFx0XHRyZXR1cm4gZWRpdG9yLmlzRGlydHkoKTsgLy8gdmV0byBpZiBzdGlsbCBkaXJ0eVxuXHRcdFx0XHR9XG5cdFx0XHRjYXNlIENvbmZpcm1SZXN1bHQuQ0FOQ0VMOlxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gdmV0b1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2hvdWxkQ29uZmlybUNsb3NlKGVkaXRvcjogRWRpdG9ySW5wdXQpOiBib29sZWFuIHtcblx0XHRpZiAoZWRpdG9yLmNsb3NlSGFuZGxlcikge1xuXHRcdFx0cmV0dXJuIGVkaXRvci5jbG9zZUhhbmRsZXIuc2hvd0NvbmZpcm0oKTsgLy8gY3VzdG9tIGhhbmRsaW5nIG9mIGNvbmZpcm1hdGlvbiBvbiBjbG9zZVxuXHRcdH1cblxuXHRcdHJldHVybiBlZGl0b3IuaXNEaXJ0eSgpICYmICFlZGl0b3IuaXNTYXZpbmcoKTsgLy8gZWRpdG9yIG11c3QgYmUgZGlydHkgYW5kIG5vdCBzYXZpbmdcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBjbG9zZUVkaXRvcnMoKVxuXG5cdGFzeW5jIGNsb3NlRWRpdG9ycyhhcmdzOiBFZGl0b3JJbnB1dFtdIHwgSUNsb3NlRWRpdG9yc0ZpbHRlciwgb3B0aW9ucz86IElDbG9zZUVkaXRvck9wdGlvbnMpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAodGhpcy5pc0VtcHR5KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3JzID0gdGhpcy5kb0dldEVkaXRvcnNUb0Nsb3NlKGFyZ3MpO1xuXG5cdFx0Ly8gQ2hlY2sgZm9yIGNvbmZpcm1hdGlvbiBhbmQgdmV0b1xuXHRcdGNvbnN0IHZldG8gPSBhd2FpdCB0aGlzLmhhbmRsZUNsb3NlQ29uZmlybWF0aW9uKGVkaXRvcnMuc2xpY2UoMCkpO1xuXHRcdGlmICh2ZXRvKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gRG8gY2xvc2Vcblx0XHR0aGlzLmRvQ2xvc2VFZGl0b3JzKGVkaXRvcnMsIG9wdGlvbnMpO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGRvR2V0RWRpdG9yc1RvQ2xvc2UoYXJnczogRWRpdG9ySW5wdXRbXSB8IElDbG9zZUVkaXRvcnNGaWx0ZXIpOiBFZGl0b3JJbnB1dFtdIHtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShhcmdzKSkge1xuXHRcdFx0cmV0dXJuIGFyZ3M7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlsdGVyID0gYXJncztcblx0XHRjb25zdCBoYXNEaXJlY3Rpb24gPSB0eXBlb2YgZmlsdGVyLmRpcmVjdGlvbiA9PT0gJ251bWJlcic7XG5cblx0XHRsZXQgZWRpdG9yc1RvQ2xvc2UgPSB0aGlzLm1vZGVsLmdldEVkaXRvcnMoaGFzRGlyZWN0aW9uID8gRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwgOiBFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUsIGZpbHRlcik7IC8vIGluIE1SVSBvcmRlciBvbmx5IGlmIGRpcmVjdGlvbiBpcyBub3Qgc3BlY2lmaWVkXG5cblx0XHQvLyBGaWx0ZXI6IHNhdmVkIG9yIHNhdmluZyBvbmx5XG5cdFx0aWYgKGZpbHRlci5zYXZlZE9ubHkpIHtcblx0XHRcdGVkaXRvcnNUb0Nsb3NlID0gZWRpdG9yc1RvQ2xvc2UuZmlsdGVyKGVkaXRvciA9PiAhZWRpdG9yLmlzRGlydHkoKSB8fCBlZGl0b3IuaXNTYXZpbmcoKSk7XG5cdFx0fVxuXG5cdFx0Ly8gRmlsdGVyOiBkaXJlY3Rpb24gKGxlZnQgLyByaWdodClcblx0XHRlbHNlIGlmIChoYXNEaXJlY3Rpb24gJiYgZmlsdGVyLmV4Y2VwdCkge1xuXHRcdFx0ZWRpdG9yc1RvQ2xvc2UgPSAoZmlsdGVyLmRpcmVjdGlvbiA9PT0gQ2xvc2VEaXJlY3Rpb24uTEVGVCkgP1xuXHRcdFx0XHRlZGl0b3JzVG9DbG9zZS5zbGljZSgwLCB0aGlzLm1vZGVsLmluZGV4T2YoZmlsdGVyLmV4Y2VwdCwgZWRpdG9yc1RvQ2xvc2UpKSA6XG5cdFx0XHRcdGVkaXRvcnNUb0Nsb3NlLnNsaWNlKHRoaXMubW9kZWwuaW5kZXhPZihmaWx0ZXIuZXhjZXB0LCBlZGl0b3JzVG9DbG9zZSkgKyAxKTtcblx0XHR9XG5cblx0XHQvLyBGaWx0ZXI6IGV4Y2VwdFxuXHRcdGVsc2UgaWYgKGZpbHRlci5leGNlcHQpIHtcblx0XHRcdGVkaXRvcnNUb0Nsb3NlID0gZWRpdG9yc1RvQ2xvc2UuZmlsdGVyKGVkaXRvciA9PiBmaWx0ZXIuZXhjZXB0ICYmICFlZGl0b3IubWF0Y2hlcyhmaWx0ZXIuZXhjZXB0KSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVkaXRvcnNUb0Nsb3NlO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0Nsb3NlRWRpdG9ycyhlZGl0b3JzOiBFZGl0b3JJbnB1dFtdLCBvcHRpb25zPzogSUNsb3NlRWRpdG9yT3B0aW9ucyk6IHZvaWQge1xuXG5cdFx0Ly8gQ2xvc2UgYWxsIGluYWN0aXZlIGVkaXRvcnMgZmlyc3Rcblx0XHRsZXQgY2xvc2VBY3RpdmVFZGl0b3IgPSBmYWxzZTtcblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBlZGl0b3JzKSB7XG5cdFx0XHRpZiAoIXRoaXMuaXNBY3RpdmUoZWRpdG9yKSkge1xuXHRcdFx0XHR0aGlzLmRvQ2xvc2VJbmFjdGl2ZUVkaXRvcihlZGl0b3IpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y2xvc2VBY3RpdmVFZGl0b3IgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENsb3NlIGFjdGl2ZSBlZGl0b3IgbGFzdCBpZiBjb250YWluZWQgaW4gZWRpdG9ycyBsaXN0IHRvIGNsb3NlXG5cdFx0aWYgKGNsb3NlQWN0aXZlRWRpdG9yKSB7XG5cdFx0XHR0aGlzLmRvQ2xvc2VBY3RpdmVFZGl0b3Iob3B0aW9ucz8ucHJlc2VydmVGb2N1cyk7XG5cdFx0fVxuXG5cdFx0Ly8gRm9yd2FyZCB0byB0aXRsZSBjb250cm9sXG5cdFx0aWYgKGVkaXRvcnMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLnRpdGxlQ29udHJvbC5jbG9zZUVkaXRvcnMoZWRpdG9ycyk7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIGNsb3NlQWxsRWRpdG9ycygpXG5cblx0YXN5bmMgY2xvc2VBbGxFZGl0b3JzKG9wdGlvbnM/OiBJQ2xvc2VBbGxFZGl0b3JzT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmICh0aGlzLmlzRW1wdHkpIHtcblxuXHRcdFx0Ly8gSWYgdGhlIGdyb3VwIGlzIGVtcHR5IGFuZCB0aGUgcmVxdWVzdCBpcyB0byBjbG9zZSBhbGwgZWRpdG9ycywgd2Ugc3RpbGwgY2xvc2Vcblx0XHRcdC8vIHRoZSBlZGl0b3IgZ3JvdXAgaXMgdGhlIHJlbGF0ZWQgc2V0dGluZyB0byBjbG9zZSBlbXB0eSBncm91cHMgaXMgZW5hYmxlZCBmb3Jcblx0XHRcdC8vIGEgY29udmVuaWVudCB3YXkgb2YgcmVtb3ZpbmcgZW1wdHkgZWRpdG9yIGdyb3VwcyBmb3IgdGhlIHVzZXIuXG5cdFx0XHRpZiAodGhpcy5ncm91cHNWaWV3LnBhcnRPcHRpb25zLmNsb3NlRW1wdHlHcm91cHMpIHtcblx0XHRcdFx0dGhpcy5ncm91cHNWaWV3LnJlbW92ZUdyb3VwKHRoaXMpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBBcHBseSB0aGUgYGV4Y2x1ZGVDb25maXJtaW5nYCBmaWx0ZXIgaWYgcHJlc2VudFxuXHRcdGxldCBlZGl0b3JzID0gdGhpcy5tb2RlbC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSwgb3B0aW9ucyk7XG5cdFx0aWYgKG9wdGlvbnM/LmV4Y2x1ZGVDb25maXJtaW5nKSB7XG5cdFx0XHRlZGl0b3JzID0gZWRpdG9ycy5maWx0ZXIoZWRpdG9yID0+ICF0aGlzLnNob3VsZENvbmZpcm1DbG9zZShlZGl0b3IpKTtcblx0XHR9XG5cblx0XHQvLyBDaGVjayBmb3IgY29uZmlybWF0aW9uIGFuZCB2ZXRvXG5cdFx0Y29uc3QgdmV0byA9IGF3YWl0IHRoaXMuaGFuZGxlQ2xvc2VDb25maXJtYXRpb24oZWRpdG9ycyk7XG5cdFx0aWYgKHZldG8pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBEbyBjbG9zZVxuXHRcdHRoaXMuZG9DbG9zZUFsbEVkaXRvcnMob3B0aW9ucyk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgZG9DbG9zZUFsbEVkaXRvcnMob3B0aW9ucz86IElDbG9zZUFsbEVkaXRvcnNPcHRpb25zKTogdm9pZCB7XG5cdFx0bGV0IGVkaXRvcnMgPSB0aGlzLm1vZGVsLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwsIG9wdGlvbnMpO1xuXHRcdGlmIChvcHRpb25zPy5leGNsdWRlQ29uZmlybWluZykge1xuXHRcdFx0ZWRpdG9ycyA9IGVkaXRvcnMuZmlsdGVyKGVkaXRvciA9PiAhdGhpcy5zaG91bGRDb25maXJtQ2xvc2UoZWRpdG9yKSk7XG5cdFx0fVxuXG5cdFx0Ly8gQ2xvc2UgYWxsIGluYWN0aXZlIGVkaXRvcnMgZmlyc3Rcblx0XHRjb25zdCBlZGl0b3JzVG9DbG9zZTogRWRpdG9ySW5wdXRbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIGVkaXRvcnMpIHtcblx0XHRcdGlmICghdGhpcy5pc0FjdGl2ZShlZGl0b3IpKSB7XG5cdFx0XHRcdHRoaXMuZG9DbG9zZUluYWN0aXZlRWRpdG9yKGVkaXRvcik7XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvcnNUb0Nsb3NlLnB1c2goZWRpdG9yKTtcblx0XHR9XG5cblx0XHQvLyBDbG9zZSBhY3RpdmUgZWRpdG9yIGxhc3QgKHVubGVzcyB3ZSBza2lwIGl0LCBlLmcuIGJlY2F1c2UgaXQgaXMgc3RpY2t5KVxuXHRcdGlmICh0aGlzLmFjdGl2ZUVkaXRvciAmJiBlZGl0b3JzVG9DbG9zZS5pbmNsdWRlcyh0aGlzLmFjdGl2ZUVkaXRvcikpIHtcblx0XHRcdHRoaXMuZG9DbG9zZUFjdGl2ZUVkaXRvcigpO1xuXHRcdH1cblxuXHRcdC8vIEZvcndhcmQgdG8gdGl0bGUgY29udHJvbFxuXHRcdGlmIChlZGl0b3JzVG9DbG9zZS5sZW5ndGgpIHtcblx0XHRcdHRoaXMudGl0bGVDb250cm9sLmNsb3NlRWRpdG9ycyhlZGl0b3JzVG9DbG9zZSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIHJlcGxhY2VFZGl0b3JzKClcblxuXHRhc3luYyByZXBsYWNlRWRpdG9ycyhlZGl0b3JzOiBFZGl0b3JSZXBsYWNlbWVudFtdKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBFeHRyYWN0IGFjdGl2ZSB2cy4gaW5hY3RpdmUgcmVwbGFjZW1lbnRzXG5cdFx0bGV0IGFjdGl2ZVJlcGxhY2VtZW50OiBFZGl0b3JSZXBsYWNlbWVudCB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBpbmFjdGl2ZVJlcGxhY2VtZW50czogRWRpdG9yUmVwbGFjZW1lbnRbXSA9IFtdO1xuXHRcdGZvciAobGV0IHsgZWRpdG9yLCByZXBsYWNlbWVudCwgZm9yY2VSZXBsYWNlRGlydHksIG9wdGlvbnMgfSBvZiBlZGl0b3JzKSB7XG5cdFx0XHRjb25zdCBpbmRleCA9IHRoaXMuZ2V0SW5kZXhPZkVkaXRvcihlZGl0b3IpO1xuXHRcdFx0aWYgKGluZGV4ID49IDApIHtcblx0XHRcdFx0Y29uc3QgaXNBY3RpdmVFZGl0b3IgPSB0aGlzLmlzQWN0aXZlKGVkaXRvcik7XG5cblx0XHRcdFx0Ly8gbWFrZSBzdXJlIHdlIHJlc3BlY3QgdGhlIGluZGV4IG9mIHRoZSBlZGl0b3IgdG8gcmVwbGFjZVxuXHRcdFx0XHRpZiAob3B0aW9ucykge1xuXHRcdFx0XHRcdG9wdGlvbnMuaW5kZXggPSBpbmRleDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRvcHRpb25zID0geyBpbmRleCB9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0b3B0aW9ucy5pbmFjdGl2ZSA9ICFpc0FjdGl2ZUVkaXRvcjtcblx0XHRcdFx0b3B0aW9ucy5waW5uZWQgPSBvcHRpb25zLnBpbm5lZCA/PyB0cnVlOyAvLyB1bmxlc3Mgc3BlY2lmaWVkLCBwcmVmZXIgdG8gcGluIHVwb24gcmVwbGFjZVxuXG5cdFx0XHRcdGNvbnN0IGVkaXRvclRvUmVwbGFjZSA9IHsgZWRpdG9yLCByZXBsYWNlbWVudCwgZm9yY2VSZXBsYWNlRGlydHksIG9wdGlvbnMgfTtcblx0XHRcdFx0aWYgKGlzQWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRcdFx0YWN0aXZlUmVwbGFjZW1lbnQgPSBlZGl0b3JUb1JlcGxhY2U7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aW5hY3RpdmVSZXBsYWNlbWVudHMucHVzaChlZGl0b3JUb1JlcGxhY2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSGFuZGxlIGluYWN0aXZlIGZpcnN0XG5cdFx0Zm9yIChjb25zdCB7IGVkaXRvciwgcmVwbGFjZW1lbnQsIGZvcmNlUmVwbGFjZURpcnR5LCBvcHRpb25zIH0gb2YgaW5hY3RpdmVSZXBsYWNlbWVudHMpIHtcblxuXHRcdFx0Ly8gT3BlbiBpbmFjdGl2ZSBlZGl0b3Jcblx0XHRcdGF3YWl0IHRoaXMuZG9PcGVuRWRpdG9yKHJlcGxhY2VtZW50LCBvcHRpb25zKTtcblxuXHRcdFx0Ly8gQ2xvc2UgcmVwbGFjZWQgaW5hY3RpdmUgZWRpdG9yIHVubGVzcyB0aGV5IG1hdGNoXG5cdFx0XHRpZiAoIWVkaXRvci5tYXRjaGVzKHJlcGxhY2VtZW50KSkge1xuXHRcdFx0XHRsZXQgY2xvc2VkID0gZmFsc2U7XG5cdFx0XHRcdGlmIChmb3JjZVJlcGxhY2VEaXJ0eSkge1xuXHRcdFx0XHRcdHRoaXMuZG9DbG9zZUVkaXRvcihlZGl0b3IsIHRydWUsIHsgY29udGV4dDogRWRpdG9yQ2xvc2VDb250ZXh0LlJFUExBQ0UgfSk7XG5cdFx0XHRcdFx0Y2xvc2VkID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjbG9zZWQgPSBhd2FpdCB0aGlzLmRvQ2xvc2VFZGl0b3JXaXRoQ29uZmlybWF0aW9uSGFuZGxpbmcoZWRpdG9yLCB7IHByZXNlcnZlRm9jdXM6IHRydWUgfSwgeyBjb250ZXh0OiBFZGl0b3JDbG9zZUNvbnRleHQuUkVQTEFDRSB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghY2xvc2VkKSB7XG5cdFx0XHRcdFx0cmV0dXJuOyAvLyBjYW5jZWxlZFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSGFuZGxlIGFjdGl2ZSBsYXN0XG5cdFx0aWYgKGFjdGl2ZVJlcGxhY2VtZW50KSB7XG5cblx0XHRcdC8vIE9wZW4gcmVwbGFjZW1lbnQgYXMgYWN0aXZlIGVkaXRvclxuXHRcdFx0Y29uc3Qgb3BlbkVkaXRvclJlc3VsdCA9IHRoaXMuZG9PcGVuRWRpdG9yKGFjdGl2ZVJlcGxhY2VtZW50LnJlcGxhY2VtZW50LCBhY3RpdmVSZXBsYWNlbWVudC5vcHRpb25zKTtcblxuXHRcdFx0Ly8gQ2xvc2UgcmVwbGFjZWQgYWN0aXZlIGVkaXRvciB1bmxlc3MgdGhleSBtYXRjaFxuXHRcdFx0aWYgKCFhY3RpdmVSZXBsYWNlbWVudC5lZGl0b3IubWF0Y2hlcyhhY3RpdmVSZXBsYWNlbWVudC5yZXBsYWNlbWVudCkpIHtcblx0XHRcdFx0aWYgKGFjdGl2ZVJlcGxhY2VtZW50LmZvcmNlUmVwbGFjZURpcnR5KSB7XG5cdFx0XHRcdFx0dGhpcy5kb0Nsb3NlRWRpdG9yKGFjdGl2ZVJlcGxhY2VtZW50LmVkaXRvciwgdHJ1ZSwgeyBjb250ZXh0OiBFZGl0b3JDbG9zZUNvbnRleHQuUkVQTEFDRSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmRvQ2xvc2VFZGl0b3JXaXRoQ29uZmlybWF0aW9uSGFuZGxpbmcoYWN0aXZlUmVwbGFjZW1lbnQuZWRpdG9yLCB7IHByZXNlcnZlRm9jdXM6IHRydWUgfSwgeyBjb250ZXh0OiBFZGl0b3JDbG9zZUNvbnRleHQuUkVQTEFDRSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCBvcGVuRWRpdG9yUmVzdWx0O1xuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBMb2NraW5nXG5cblx0Z2V0IGlzTG9ja2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmlzTG9ja2VkO1xuXHR9XG5cblx0bG9jayhsb2NrZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLm1vZGVsLmxvY2sobG9ja2VkKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBFZGl0b3IgQWN0aW9uc1xuXG5cdGNyZWF0ZUVkaXRvckFjdGlvbnMoZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IElBY3RpdmVFZGl0b3JBY3Rpb25zIHtcblx0XHRsZXQgYWN0aW9uczogUHJpbWFyeUFuZFNlY29uZGFyeUFjdGlvbnMgPSB7IHByaW1hcnk6IFtdLCBzZWNvbmRhcnk6IFtdIH07XG5cblx0XHRsZXQgb25EaWRDaGFuZ2U7XG5cblx0XHQvLyBFZGl0b3IgYWN0aW9ucyByZXF1aXJlIHRoZSBlZGl0b3IgY29udHJvbCB0byBiZSB0aGVyZSwgc28gd2UgcmV0cmlldmUgaXQgdmlhIHNlcnZpY2Vcblx0XHRjb25zdCBhY3RpdmVFZGl0b3JQYW5lID0gdGhpcy5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdGlmIChhY3RpdmVFZGl0b3JQYW5lIGluc3RhbmNlb2YgRWRpdG9yUGFuZSkge1xuXHRcdFx0Y29uc3QgZWRpdG9yU2NvcGVkQ29udGV4dEtleVNlcnZpY2UgPSBhY3RpdmVFZGl0b3JQYW5lLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlID8/IHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2U7XG5cdFx0XHRjb25zdCBlZGl0b3JUaXRsZU1lbnUgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5tZW51U2VydmljZS5jcmVhdGVNZW51KE1lbnVJZC5FZGl0b3JUaXRsZSwgZWRpdG9yU2NvcGVkQ29udGV4dEtleVNlcnZpY2UsIHsgZW1pdEV2ZW50c0ZvclN1Ym1lbnVDaGFuZ2VzOiB0cnVlLCBldmVudERlYm91bmNlRGVsYXk6IDAgfSkpO1xuXHRcdFx0b25EaWRDaGFuZ2UgPSBlZGl0b3JUaXRsZU1lbnUub25EaWRDaGFuZ2U7XG5cblx0XHRcdGNvbnN0IHNob3VsZElubGluZUdyb3VwID0gKGFjdGlvbjogU3VibWVudUFjdGlvbiwgZ3JvdXA6IHN0cmluZykgPT4gZ3JvdXAgPT09ICduYXZpZ2F0aW9uJyAmJiBhY3Rpb24uYWN0aW9ucy5sZW5ndGggPD0gMTtcblxuXHRcdFx0YWN0aW9ucyA9IGdldEFjdGlvbkJhckFjdGlvbnMoXG5cdFx0XHRcdGVkaXRvclRpdGxlTWVudS5nZXRBY3Rpb25zKHsgYXJnOiB0aGlzLnJlc291cmNlQ29udGV4dC5nZXQoKSwgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUgfSksXG5cdFx0XHRcdCduYXZpZ2F0aW9uJyxcblx0XHRcdFx0c2hvdWxkSW5saW5lR3JvdXBcblx0XHRcdCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIElmIHRoZXJlIGlzIG5vIGFjdGl2ZSBwYW5lIGluIHRoZSBncm91cCAoaXQncyB0aGUgbGFzdCBncm91cCBhbmQgaXQncyBlbXB0eSlcblx0XHRcdC8vIFRyaWdnZXIgdGhlIGNoYW5nZSBldmVudCB3aGVuIHRoZSBhY3RpdmUgZWRpdG9yIGNoYW5nZXNcblx0XHRcdGNvbnN0IF9vbkRpZENoYW5nZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0XHRcdG9uRGlkQ2hhbmdlID0gX29uRGlkQ2hhbmdlLmV2ZW50O1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRoaXMub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UoKCkgPT4gX29uRGlkQ2hhbmdlLmZpcmUoKSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IGFjdGlvbnMsIG9uRGlkQ2hhbmdlIH07XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gVGhlbWFibGVcblxuXHRvdmVycmlkZSB1cGRhdGVTdHlsZXMoKTogdm9pZCB7XG5cdFx0Y29uc3QgaXNFbXB0eSA9IHRoaXMuaXNFbXB0eTtcblxuXHRcdC8vIENvbnRhaW5lclxuXHRcdGlmIChpc0VtcHR5KSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gdGhpcy5nZXRDb2xvcihFRElUT1JfR1JPVVBfRU1QVFlfQkFDS0dST1VORCkgfHwgJyc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnJztcblx0XHR9XG5cblx0XHQvLyBUaXRsZSBjb250cm9sXG5cdFx0Y29uc3QgYm9yZGVyQ29sb3IgPSB0aGlzLmdldENvbG9yKEVESVRPUl9HUk9VUF9IRUFERVJfQk9SREVSKSB8fCB0aGlzLmdldENvbG9yKGNvbnRyYXN0Qm9yZGVyKTtcblx0XHRpZiAoIWlzRW1wdHkgJiYgYm9yZGVyQ29sb3IpIHtcblx0XHRcdHRoaXMudGl0bGVDb250YWluZXIuY2xhc3NMaXN0LmFkZCgndGl0bGUtYm9yZGVyLWJvdHRvbScpO1xuXHRcdFx0dGhpcy50aXRsZUNvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eSgnLS10aXRsZS1ib3JkZXItYm90dG9tLWNvbG9yJywgYm9yZGVyQ29sb3IpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnRpdGxlQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ3RpdGxlLWJvcmRlci1ib3R0b20nKTtcblx0XHRcdHRoaXMudGl0bGVDb250YWluZXIuc3R5bGUucmVtb3ZlUHJvcGVydHkoJy0tdGl0bGUtYm9yZGVyLWJvdHRvbS1jb2xvcicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgc2hvd1RhYnMgfSA9IHRoaXMuZ3JvdXBzVmlldy5wYXJ0T3B0aW9ucztcblx0XHR0aGlzLnRpdGxlQ29udGFpbmVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHRoaXMuZ2V0Q29sb3Ioc2hvd1RhYnMgPT09ICdtdWx0aXBsZScgPyBFRElUT1JfR1JPVVBfSEVBREVSX1RBQlNfQkFDS0dST1VORCA6IEVESVRPUl9HUk9VUF9IRUFERVJfTk9fVEFCU19CQUNLR1JPVU5EKSB8fCAnJztcblxuXHRcdC8vIEVkaXRvciBjb250YWluZXJcblx0XHR0aGlzLmVkaXRvckNvbnRhaW5lci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSB0aGlzLmdldENvbG9yKGVkaXRvckJhY2tncm91bmQpIHx8ICcnO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIElTZXJpYWxpemFibGVWaWV3XG5cblx0cmVhZG9ubHkgZWxlbWVudDogSFRNTEVsZW1lbnQgPSAkKCdkaXYnKTtcblxuXHRnZXQgbWluaW11bVdpZHRoKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmVkaXRvclBhbmUubWluaW11bVdpZHRoOyB9XG5cdGdldCBtaW5pbXVtSGVpZ2h0KCk6IG51bWJlciB7IHJldHVybiB0aGlzLmVkaXRvclBhbmUubWluaW11bUhlaWdodDsgfVxuXHRnZXQgbWF4aW11bVdpZHRoKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmVkaXRvclBhbmUubWF4aW11bVdpZHRoOyB9XG5cdGdldCBtYXhpbXVtSGVpZ2h0KCk6IG51bWJlciB7IHJldHVybiB0aGlzLmVkaXRvclBhbmUubWF4aW11bUhlaWdodDsgfVxuXG5cdGdldCBwcm9wb3J0aW9uYWxMYXlvdXQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLmxhc3RMYXlvdXQpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiAhKHRoaXMubGFzdExheW91dC53aWR0aCA9PT0gdGhpcy5taW5pbXVtV2lkdGggfHwgdGhpcy5sYXN0TGF5b3V0LmhlaWdodCA9PT0gdGhpcy5taW5pbXVtSGVpZ2h0KTtcblx0fVxuXG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJlbGF5PHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB8IHVuZGVmaW5lZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlID0gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cblx0bGF5b3V0KHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCB0b3A6IG51bWJlciwgbGVmdDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5sYXN0TGF5b3V0ID0geyB3aWR0aCwgaGVpZ2h0LCB0b3AsIGxlZnQgfTtcblx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnbWF4LWhlaWdodC00NzhweCcsIGhlaWdodCA8PSA0NzgpO1xuXG5cdFx0Ly8gTGF5b3V0IHRoZSB0aXRsZSBjb250cm9sIGZpcnN0IHRvIHJlY2VpdmUgdGhlIHNpemUgaXQgb2NjdXBpZXNcblx0XHRjb25zdCB0aXRsZUNvbnRyb2xTaXplID0gdGhpcy50aXRsZUNvbnRyb2wubGF5b3V0KHtcblx0XHRcdGNvbnRhaW5lcjogbmV3IERpbWVuc2lvbih3aWR0aCwgaGVpZ2h0KSxcblx0XHRcdGF2YWlsYWJsZTogbmV3IERpbWVuc2lvbih3aWR0aCwgaGVpZ2h0IC0gdGhpcy5lZGl0b3JQYW5lLm1pbmltdW1IZWlnaHQpXG5cdFx0fSk7XG5cblx0XHQvLyBVcGRhdGUgcHJvZ3Jlc3MgYmFyIGxvY2F0aW9uXG5cdFx0dGhpcy5wcm9ncmVzc0Jhci5nZXRDb250YWluZXIoKS5zdHlsZS50b3AgPSBgJHtNYXRoLm1heCh0aGlzLnRpdGxlSGVpZ2h0Lm9mZnNldCAtIDIsIDApfXB4YDtcblxuXHRcdC8vIFBhc3MgdGhlIGNvbnRhaW5lciB3aWR0aCBhbmQgcmVtYWluaW5nIGhlaWdodCB0byB0aGUgZWRpdG9yIGxheW91dFxuXHRcdGNvbnN0IGVkaXRvckhlaWdodCA9IE1hdGgubWF4KDAsIGhlaWdodCAtIHRpdGxlQ29udHJvbFNpemUuaGVpZ2h0KTtcblx0XHR0aGlzLmVkaXRvckNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHtlZGl0b3JIZWlnaHR9cHhgO1xuXHRcdHRoaXMuZWRpdG9yUGFuZS5sYXlvdXQoeyB3aWR0aCwgaGVpZ2h0OiBlZGl0b3JIZWlnaHQsIHRvcDogdG9wICsgdGl0bGVDb250cm9sU2l6ZS5oZWlnaHQsIGxlZnQgfSk7XG5cdH1cblxuXHRyZWxheW91dCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5sYXN0TGF5b3V0KSB7XG5cdFx0XHRjb25zdCB7IHdpZHRoLCBoZWlnaHQsIHRvcCwgbGVmdCB9ID0gdGhpcy5sYXN0TGF5b3V0O1xuXHRcdFx0dGhpcy5sYXlvdXQod2lkdGgsIGhlaWdodCwgdG9wLCBsZWZ0KTtcblx0XHR9XG5cdH1cblxuXHRzZXRCb3VuZGFyeVNhc2hlcyhzYXNoZXM6IElCb3VuZGFyeVNhc2hlcyk6IHZvaWQge1xuXHRcdHRoaXMuZWRpdG9yUGFuZS5zZXRCb3VuZGFyeVNhc2hlcyhzYXNoZXMpO1xuXHR9XG5cblx0dG9KU09OKCk6IElTZXJpYWxpemVkRWRpdG9yR3JvdXBNb2RlbCB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuc2VyaWFsaXplKCk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2Rpc3Bvc2VkID0gdHJ1ZTtcblxuXHRcdHRoaXMuX29uV2lsbERpc3Bvc2UuZmlyZSgpO1xuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRWRpdG9yUmVwbGFjZW1lbnQgZXh0ZW5kcyBJRWRpdG9yUmVwbGFjZW1lbnQge1xuXHRyZWFkb25seSBlZGl0b3I6IEVkaXRvcklucHV0O1xuXHRyZWFkb25seSByZXBsYWNlbWVudDogRWRpdG9ySW5wdXQ7XG5cdHJlYWRvbmx5IG9wdGlvbnM/OiBJRWRpdG9yT3B0aW9ucztcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFNBQVMsa0JBQTJGLHlCQUF5Qix3QkFBd0Isb0NBQW9DO0FBQ3pMLFNBQTBCLGdCQUFnRCxZQUEyQyxjQUFrQyx3QkFBd0IseUJBQThDLDRCQUE0QixrQkFBa0Isb0JBQXFGLHNCQUFvRSwyQkFBMkI7QUFDL2IsU0FBUyxnQ0FBZ0MsMEJBQTBCLGdDQUFnQywyQkFBMkIsMkJBQTJCLGdDQUFnQyxpQ0FBaUMsb0JBQW9CLHlCQUF5Qix1Q0FBdUMsb0NBQW9DLCtCQUErQixpQ0FBaUMsZ0NBQWdDLHFCQUFxQiw2QkFBNkIsOEJBQThCLHNDQUFzQyxtQ0FBbUMsdUNBQXVDLGtDQUFrQyw4REFBOEQ7QUFFbHRCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsV0FBVyxZQUFZLHVCQUF1QixXQUFXLGFBQWEscUJBQXFCLFlBQWtDLGNBQWMsaUJBQWlCLFdBQVcsa0JBQWtCLFNBQVM7QUFDM00sU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxlQUFlLGdCQUFnQjtBQUN4QyxTQUFTLGtCQUFrQixzQkFBc0I7QUFDakQsU0FBUyxxQ0FBcUMsd0NBQXdDLCtCQUErQixrQ0FBa0M7QUFDdkosU0FBOEIsbUJBQTJHO0FBQ3pJLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQTBCLG1CQUFtQixvQkFBb0I7QUFDakUsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxpQkFBaUIsVUFBVSxxQkFB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
