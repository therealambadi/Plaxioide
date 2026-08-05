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
import "./media/openeditors.css";
import * as nls from "../../../../../nls.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { ActionRunner } from "../../../../../base/common/actions.js";
import * as dom from "../../../../../base/browser/dom.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IEditorGroupsService, GroupsOrder, GroupOrientation } from "../../../../services/editor/common/editorGroupsService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { Verbosity, EditorResourceAccessor, SideBySideEditor, GroupModelChangeKind, preventEditorClose, EditorCloseMethod } from "../../../../common/editor.js";
import { SaveAllInGroupAction, CloseGroupAction } from "../fileActions.js";
import { OpenEditorsFocusedContext, ExplorerFocusedContext, OpenEditor } from "../../common/files.js";
import { CloseAllEditorsAction, CloseEditorAction, UnpinEditorAction } from "../../../../browser/parts/editor/editorActions.js";
import { IContextKeyService, ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { asCssVariable, badgeBackground, badgeForeground, contrastBorder } from "../../../../../platform/theme/common/colorRegistry.js";
import { WorkbenchList } from "../../../../../platform/list/browser/listService.js";
import { ListDragOverEffectPosition, ListDragOverEffectType } from "../../../../../base/browser/ui/list/list.js";
import { ResourceLabels } from "../../../../browser/labels.js";
import { ActionBar } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { DisposableMap, dispose } from "../../../../../base/common/lifecycle.js";
import { MenuId, Action2, registerAction2, MenuRegistry } from "../../../../../platform/actions/common/actions.js";
import { OpenEditorsDirtyEditorContext, OpenEditorsGroupContext, OpenEditorsReadonlyEditorContext, SAVE_ALL_LABEL, SAVE_ALL_COMMAND_ID, NEW_UNTITLED_FILE_COMMAND_ID, OpenEditorsSelectedFileOrUntitledContext } from "../fileConstants.js";
import { ResourceContextKey, MultipleEditorGroupsContext } from "../../../../common/contextkeys.js";
import { CodeDataTransfers, containsDragType } from "../../../../../platform/dnd/browser/dnd.js";
import { ResourcesDropHandler, fillEditorsDragData } from "../../../../browser/dnd.js";
import { ViewPane } from "../../../../browser/parts/views/viewPane.js";
import { DataTransfers } from "../../../../../base/browser/dnd.js";
import { memoize } from "../../../../../base/common/decorators.js";
import { ElementsDragAndDropData, ListViewTargetSector, NativeDragAndDropData } from "../../../../../base/browser/ui/list/listView.js";
import { IWorkingCopyService } from "../../../../services/workingCopy/common/workingCopyService.js";
import { WorkingCopyCapabilities } from "../../../../services/workingCopy/common/workingCopy.js";
import { IFilesConfigurationService } from "../../../../services/filesConfiguration/common/filesConfigurationService.js";
import { IViewDescriptorService } from "../../../../common/views.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { Orientation } from "../../../../../base/browser/ui/splitview/splitview.js";
import { compareFileNamesDefault } from "../../../../../base/common/comparers.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { Schemas } from "../../../../../base/common/network.js";
import { extUriIgnorePathCase } from "../../../../../base/common/resources.js";
import { mainWindow } from "../../../../../base/browser/window.js";
import { EditorGroupView } from "../../../../browser/parts/editor/editorGroupView.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
const $ = dom.$;
let OpenEditorsView = class extends ViewPane {
  constructor(options, instantiationService, viewDescriptorService, contextMenuService, editorGroupService, configurationService, keybindingService, contextKeyService, themeService, telemetryService, hoverService, workingCopyService, filesConfigurationService, openerService, fileService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.editorGroupService = editorGroupService;
    this.telemetryService = telemetryService;
    this.workingCopyService = workingCopyService;
    this.filesConfigurationService = filesConfigurationService;
    this.fileService = fileService;
    this.needsRefresh = false;
    this.elements = [];
    this.blockFocusActiveEditorTracking = false;
    this.structuralRefreshDelay = 0;
    this.sortOrder = configurationService.getValue("explorer.openEditors.sortOrder");
    this.registerUpdateEvents();
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationChange(e)));
    this._register(this.workingCopyService.onDidChangeDirty((workingCopy) => this.updateDirtyIndicator(workingCopy)));
  }
  registerUpdateEvents() {
    const updateWholeList = () => {
      if (!this.isBodyVisible() || !this.list) {
        this.needsRefresh = true;
        return;
      }
      this.listRefreshScheduler?.schedule(this.structuralRefreshDelay);
    };
    const groupDisposables = this._register(new DisposableMap());
    const addGroupListener = (group) => {
      const groupModelChangeListener = group.onDidModelChange((e) => {
        if (this.listRefreshScheduler?.isScheduled()) {
          return;
        }
        if (!this.isBodyVisible() || !this.list) {
          this.needsRefresh = true;
          return;
        }
        const index = this.getIndex(group, e.editor);
        switch (e.kind) {
          case GroupModelChangeKind.EDITOR_ACTIVE:
            this.focusActiveEditor();
            break;
          case GroupModelChangeKind.GROUP_INDEX:
          case GroupModelChangeKind.GROUP_LABEL:
            if (index >= 0) {
              this.list.splice(index, 1, [group]);
            }
            break;
          case GroupModelChangeKind.EDITOR_DIRTY:
          case GroupModelChangeKind.EDITOR_STICKY:
          case GroupModelChangeKind.EDITOR_CAPABILITIES:
          case GroupModelChangeKind.EDITOR_PIN:
          case GroupModelChangeKind.EDITOR_LABEL:
            this.list.splice(index, 1, [new OpenEditor(e.editor, group)]);
            this.focusActiveEditor();
            break;
          case GroupModelChangeKind.EDITOR_OPEN:
          case GroupModelChangeKind.EDITOR_MOVE:
          case GroupModelChangeKind.EDITOR_CLOSE:
            updateWholeList();
            break;
        }
      });
      groupDisposables.set(group.id, groupModelChangeListener);
    };
    this.editorGroupService.groups.forEach((g) => addGroupListener(g));
    this._register(this.editorGroupService.onDidAddGroup((group) => {
      addGroupListener(group);
      updateWholeList();
    }));
    this._register(this.editorGroupService.onDidMoveGroup(() => updateWholeList()));
    this._register(this.editorGroupService.onDidChangeActiveGroup(() => this.focusActiveEditor()));
    this._register(this.editorGroupService.onDidRemoveGroup((group) => {
      groupDisposables.deleteAndDispose(group.id);
      updateWholeList();
    }));
  }
  renderHeaderTitle(container) {
    super.renderHeaderTitle(container, this.title);
    const count = dom.append(container, $(".open-editors-dirty-count-container"));
    this.dirtyCountElement = dom.append(count, $(".dirty-count.monaco-count-badge.long"));
    this.dirtyCountElement.style.backgroundColor = asCssVariable(badgeBackground);
    this.dirtyCountElement.style.color = asCssVariable(badgeForeground);
    this.dirtyCountElement.style.border = `1px solid ${asCssVariable(contrastBorder)}`;
    this.updateDirtyIndicator();
  }
  renderBody(container) {
    super.renderBody(container);
    container.classList.add("open-editors");
    container.classList.add("show-file-icons");
    const delegate = new OpenEditorsDelegate();
    if (this.list) {
      this.list.dispose();
    }
    if (this.listLabels) {
      this.listLabels.clear();
    }
    this.dnd = new OpenEditorsDragAndDrop(this.sortOrder, this.instantiationService, this.editorGroupService);
    this.listLabels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
    this.list = this.instantiationService.createInstance(WorkbenchList, "OpenEditors", container, delegate, [
      new EditorGroupRenderer(this.keybindingService, this.instantiationService),
      new OpenEditorRenderer(this.listLabels, this.instantiationService, this.keybindingService, this.configurationService)
    ], {
      identityProvider: { getId: (element) => element instanceof OpenEditor ? element.getId() : element.id.toString() },
      dnd: this.dnd,
      overrideStyles: this.getLocationBasedColors().listOverrideStyles,
      accessibilityProvider: new OpenEditorsAccessibilityProvider()
    });
    this._register(this.list);
    this._register(this.listLabels);
    let labelChangeListeners = [];
    this.listRefreshScheduler = this._register(new RunOnceScheduler(() => {
      if (!this.list) {
        return;
      }
      labelChangeListeners = dispose(labelChangeListeners);
      const previousLength = this.list.length;
      const elements = this.getElements();
      this.list.splice(0, this.list.length, elements);
      this.focusActiveEditor();
      if (previousLength !== this.list.length) {
        this.updateSize();
      }
      this.needsRefresh = false;
      if (this.sortOrder === "alphabetical" || this.sortOrder === "fullPath") {
        elements.forEach((e) => {
          if (e instanceof OpenEditor) {
            labelChangeListeners.push(e.editor.onDidChangeLabel(() => this.listRefreshScheduler?.schedule()));
          }
        });
      }
    }, this.structuralRefreshDelay));
    this.updateSize();
    this.handleContextKeys();
    this._register(this.list.onContextMenu((e) => this.onListContextMenu(e)));
    this._register(this.list.onMouseMiddleClick((e) => {
      if (e && e.element instanceof OpenEditor) {
        if (preventEditorClose(e.element.group, e.element.editor, EditorCloseMethod.MOUSE, this.editorGroupService.partOptions)) {
          return;
        }
        e.element.group.closeEditor(e.element.editor, { preserveFocus: true });
      }
    }));
    this._register(this.list.onDidOpen((e) => {
      const element = e.element;
      if (!element) {
        return;
      } else if (element instanceof OpenEditor) {
        if (dom.isMouseEvent(e.browserEvent) && e.browserEvent.button === 1) {
          return;
        }
        this.withActiveEditorFocusTrackingDisabled(() => {
          this.openEditor(element, { preserveFocus: e.editorOptions.preserveFocus, pinned: e.editorOptions.pinned, sideBySide: e.sideBySide });
        });
      } else {
        this.withActiveEditorFocusTrackingDisabled(() => {
          this.editorGroupService.activateGroup(element);
          if (!e.editorOptions.preserveFocus) {
            element.focus();
          }
        });
      }
    }));
    this.listRefreshScheduler.schedule(0);
    this._register(this.onDidChangeBodyVisibility((visible) => {
      if (visible && this.needsRefresh) {
        this.listRefreshScheduler?.schedule(0);
      }
    }));
    const containerModel = this.viewDescriptorService.getViewContainerModel(this.viewDescriptorService.getViewContainerByViewId(this.id));
    this._register(containerModel.onDidChangeAllViewDescriptors(() => {
      this.updateSize();
    }));
  }
  handleContextKeys() {
    if (!this.list) {
      return;
    }
    OpenEditorsFocusedContext.bindTo(this.list.contextKeyService);
    ExplorerFocusedContext.bindTo(this.list.contextKeyService);
    const groupFocusedContext = OpenEditorsGroupContext.bindTo(this.contextKeyService);
    const dirtyEditorFocusedContext = OpenEditorsDirtyEditorContext.bindTo(this.contextKeyService);
    const readonlyEditorFocusedContext = OpenEditorsReadonlyEditorContext.bindTo(this.contextKeyService);
    const openEditorsSelectedFileOrUntitledContext = OpenEditorsSelectedFileOrUntitledContext.bindTo(this.contextKeyService);
    const resourceContext = this.instantiationService.createInstance(ResourceContextKey);
    this._register(resourceContext);
    this._register(this.list.onDidChangeFocus((e) => {
      resourceContext.reset();
      groupFocusedContext.reset();
      dirtyEditorFocusedContext.reset();
      readonlyEditorFocusedContext.reset();
      const element = e.elements.length ? e.elements[0] : void 0;
      if (element instanceof OpenEditor) {
        const resource = element.getResource();
        dirtyEditorFocusedContext.set(element.editor.isDirty() && !element.editor.isSaving());
        readonlyEditorFocusedContext.set(!!element.editor.isReadonly());
        resourceContext.set(resource ?? null);
      } else if (!!element) {
        groupFocusedContext.set(true);
      }
    }));
    this._register(this.list.onDidChangeSelection((e) => {
      const selectedAreFileOrUntitled = e.elements.every((e2) => {
        if (e2 instanceof OpenEditor) {
          const resource = e2.getResource();
          return resource && (resource.scheme === Schemas.untitled || this.fileService.hasProvider(resource));
        }
        return false;
      });
      openEditorsSelectedFileOrUntitledContext.set(selectedAreFileOrUntitled);
    }));
  }
  focus() {
    super.focus();
    this.list?.domFocus();
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.list?.layout(height, width);
  }
  get showGroups() {
    return this.editorGroupService.groups.length > 1;
  }
  getElements() {
    this.elements = [];
    this.editorGroupService.getGroups(GroupsOrder.GRID_APPEARANCE).forEach((g) => {
      if (this.showGroups) {
        this.elements.push(g);
      }
      let editors = g.editors.map((ei) => new OpenEditor(ei, g));
      if (this.sortOrder === "alphabetical") {
        editors = editors.sort((first, second) => compareFileNamesDefault(first.editor.getName(), second.editor.getName()));
      } else if (this.sortOrder === "fullPath") {
        editors = editors.sort((first, second) => {
          const firstResource = first.editor.resource;
          const secondResource = second.editor.resource;
          if (firstResource === void 0 && secondResource === void 0) {
            return compareFileNamesDefault(first.editor.getName(), second.editor.getName());
          } else if (firstResource === void 0) {
            return -1;
          } else if (secondResource === void 0) {
            return 1;
          } else {
            const firstScheme = firstResource.scheme;
            const secondScheme = secondResource.scheme;
            if (firstScheme !== Schemas.file && secondScheme !== Schemas.file) {
              return extUriIgnorePathCase.compare(firstResource, secondResource);
            } else if (firstScheme !== Schemas.file) {
              return -1;
            } else if (secondScheme !== Schemas.file) {
              return 1;
            } else {
              return extUriIgnorePathCase.compare(firstResource, secondResource);
            }
          }
        });
      }
      this.elements.push(...editors);
    });
    return this.elements;
  }
  getIndex(group, editor) {
    if (!editor) {
      return this.elements.findIndex((e) => !(e instanceof OpenEditor) && e.id === group.id);
    }
    return this.elements.findIndex((e) => e instanceof OpenEditor && e.editor === editor && e.group.id === group.id);
  }
  openEditor(element, options) {
    if (element) {
      this.telemetryService.publicLog2("workbenchActionExecuted", { id: "workbench.files.openFile", from: "openEditors" });
      const preserveActivateGroup = options.sideBySide && options.preserveFocus;
      if (!preserveActivateGroup) {
        this.editorGroupService.activateGroup(element.group);
      }
      const targetGroup = options.sideBySide ? this.editorGroupService.sideGroup : element.group;
      targetGroup.openEditor(element.editor, options);
    }
  }
  onListContextMenu(e) {
    if (!e.element) {
      return;
    }
    const element = e.element;
    this.contextMenuService.showContextMenu({
      menuId: MenuId.OpenEditorsContext,
      menuActionOptions: { shouldForwardArgs: true, arg: element instanceof OpenEditor ? EditorResourceAccessor.getOriginalUri(element.editor) : {} },
      contextKeyService: this.list?.contextKeyService,
      getAnchor: () => e.anchor,
      getActionsContext: () => element instanceof OpenEditor ? { groupId: element.groupId, editorIndex: element.group.getIndexOfEditor(element.editor) } : { groupId: element.id }
    });
  }
  withActiveEditorFocusTrackingDisabled(fn) {
    this.blockFocusActiveEditorTracking = true;
    try {
      fn();
    } finally {
      this.blockFocusActiveEditorTracking = false;
    }
  }
  focusActiveEditor() {
    if (!this.list || this.blockFocusActiveEditorTracking) {
      return;
    }
    if (this.list.length && this.editorGroupService.activeGroup) {
      const index = this.getIndex(this.editorGroupService.activeGroup, this.editorGroupService.activeGroup.activeEditor);
      if (index >= 0) {
        try {
          this.list.setFocus([index]);
          this.list.setSelection([index]);
          this.list.reveal(index);
        } catch (e) {
        }
        return;
      }
    }
    this.list.setFocus([]);
    this.list.setSelection([]);
  }
  onConfigurationChange(event) {
    if (event.affectsConfiguration("explorer.openEditors")) {
      this.updateSize();
    }
    if (event.affectsConfiguration("explorer.decorations") || event.affectsConfiguration("explorer.openEditors.sortOrder")) {
      this.sortOrder = this.configurationService.getValue("explorer.openEditors.sortOrder");
      if (this.dnd) {
        this.dnd.sortOrder = this.sortOrder;
      }
      this.listRefreshScheduler?.schedule();
    }
  }
  updateSize() {
    this.minimumBodySize = this.orientation === Orientation.VERTICAL ? this.getMinExpandedBodySize() : 170;
    this.maximumBodySize = this.orientation === Orientation.VERTICAL ? this.getMaxExpandedBodySize() : Number.POSITIVE_INFINITY;
  }
  updateDirtyIndicator(workingCopy) {
    if (workingCopy) {
      const gotDirty = workingCopy.isDirty();
      if (gotDirty && !(workingCopy.capabilities & WorkingCopyCapabilities.Untitled) && this.filesConfigurationService.hasShortAutoSaveDelay(workingCopy.resource)) {
        return;
      }
    }
    const dirty = this.workingCopyService.dirtyCount;
    if (dirty === 0) {
      this.dirtyCountElement.classList.add("hidden");
    } else {
      this.dirtyCountElement.textContent = nls.localize("dirtyCounter", "{0} unsaved", dirty);
      this.dirtyCountElement.classList.remove("hidden");
    }
  }
  get elementCount() {
    return this.editorGroupService.groups.map((g) => g.count).reduce((first, second) => first + second, this.showGroups ? this.editorGroupService.groups.length : 0);
  }
  getMaxExpandedBodySize() {
    let minVisibleOpenEditors = this.configurationService.getValue("explorer.openEditors.minVisible");
    if (typeof minVisibleOpenEditors !== "number") {
      minVisibleOpenEditors = OpenEditorsView.DEFAULT_MIN_VISIBLE_OPEN_EDITORS;
    }
    const containerModel = this.viewDescriptorService.getViewContainerModel(this.viewDescriptorService.getViewContainerByViewId(this.id));
    if (containerModel.visibleViewDescriptors.length <= 1) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.max(this.elementCount, minVisibleOpenEditors) * OpenEditorsDelegate.ITEM_HEIGHT;
  }
  getMinExpandedBodySize() {
    let visibleOpenEditors = this.configurationService.getValue("explorer.openEditors.visible");
    if (typeof visibleOpenEditors !== "number") {
      visibleOpenEditors = OpenEditorsView.DEFAULT_VISIBLE_OPEN_EDITORS;
    }
    return this.computeMinExpandedBodySize(visibleOpenEditors);
  }
  computeMinExpandedBodySize(visibleOpenEditors = OpenEditorsView.DEFAULT_VISIBLE_OPEN_EDITORS) {
    const itemsToShow = Math.min(Math.max(visibleOpenEditors, 1), this.elementCount);
    return itemsToShow * OpenEditorsDelegate.ITEM_HEIGHT;
  }
  setStructuralRefreshDelay(delay) {
    this.structuralRefreshDelay = delay;
  }
  getOptimalWidth() {
    if (!this.list) {
      return super.getOptimalWidth();
    }
    const parentNode = this.list.getHTMLElement();
    const childNodes = [].slice.call(parentNode.querySelectorAll(".open-editor > a"));
    return dom.getLargestChildWidth(parentNode, childNodes);
  }
};
OpenEditorsView.DEFAULT_VISIBLE_OPEN_EDITORS = 9;
OpenEditorsView.DEFAULT_MIN_VISIBLE_OPEN_EDITORS = 0;
OpenEditorsView.ID = "workbench.explorer.openEditorsView";
OpenEditorsView.NAME = nls.localize2({ key: "openEditors", comment: ["Open is an adjective"] }, "Open Editors");
OpenEditorsView = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IViewDescriptorService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IEditorGroupsService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, ITelemetryService),
  __decorateParam(10, IHoverService),
  __decorateParam(11, IWorkingCopyService),
  __decorateParam(12, IFilesConfigurationService),
  __decorateParam(13, IOpenerService),
  __decorateParam(14, IFileService)
], OpenEditorsView);
class OpenEditorActionRunner extends ActionRunner {
  async run(action) {
    if (!this.editor) {
      return;
    }
    return super.run(action, { groupId: this.editor.groupId, editorIndex: this.editor.group.getIndexOfEditor(this.editor.editor) });
  }
}
const _OpenEditorsDelegate = class _OpenEditorsDelegate {
  getHeight(_element) {
    return _OpenEditorsDelegate.ITEM_HEIGHT;
  }
  getTemplateId(element) {
    if (element instanceof OpenEditor) {
      return OpenEditorRenderer.ID;
    }
    return EditorGroupRenderer.ID;
  }
};
_OpenEditorsDelegate.ITEM_HEIGHT = 22;
let OpenEditorsDelegate = _OpenEditorsDelegate;
const _EditorGroupRenderer = class _EditorGroupRenderer {
  constructor(keybindingService, instantiationService) {
    this.keybindingService = keybindingService;
    this.instantiationService = instantiationService;
  }
  get templateId() {
    return _EditorGroupRenderer.ID;
  }
  renderTemplate(container) {
    const editorGroupTemplate = /* @__PURE__ */ Object.create(null);
    editorGroupTemplate.root = dom.append(container, $(".editor-group"));
    editorGroupTemplate.name = dom.append(editorGroupTemplate.root, $("span.name"));
    editorGroupTemplate.actionBar = new ActionBar(container);
    const saveAllInGroupAction = this.instantiationService.createInstance(SaveAllInGroupAction, SaveAllInGroupAction.ID, SaveAllInGroupAction.LABEL);
    const saveAllInGroupKey = this.keybindingService.lookupKeybinding(saveAllInGroupAction.id);
    editorGroupTemplate.actionBar.push(saveAllInGroupAction, { icon: true, label: false, keybinding: saveAllInGroupKey ? saveAllInGroupKey.getLabel() : void 0 });
    const closeGroupAction = this.instantiationService.createInstance(CloseGroupAction, CloseGroupAction.ID, CloseGroupAction.LABEL);
    const closeGroupActionKey = this.keybindingService.lookupKeybinding(closeGroupAction.id);
    editorGroupTemplate.actionBar.push(closeGroupAction, { icon: true, label: false, keybinding: closeGroupActionKey ? closeGroupActionKey.getLabel() : void 0 });
    return editorGroupTemplate;
  }
  renderElement(editorGroup, _index, templateData) {
    templateData.editorGroup = editorGroup;
    templateData.name.textContent = editorGroup.label;
    templateData.actionBar.context = { groupId: editorGroup.id };
  }
  disposeTemplate(templateData) {
    templateData.actionBar.dispose();
  }
};
_EditorGroupRenderer.ID = "editorgroup";
let EditorGroupRenderer = _EditorGroupRenderer;
const _OpenEditorRenderer = class _OpenEditorRenderer {
  constructor(labels, instantiationService, keybindingService, configurationService) {
    this.labels = labels;
    this.instantiationService = instantiationService;
    this.keybindingService = keybindingService;
    this.configurationService = configurationService;
    this.closeEditorAction = this.instantiationService.createInstance(CloseEditorAction, CloseEditorAction.ID, CloseEditorAction.LABEL);
    this.unpinEditorAction = this.instantiationService.createInstance(UnpinEditorAction, UnpinEditorAction.ID, UnpinEditorAction.LABEL);
  }
  get templateId() {
    return _OpenEditorRenderer.ID;
  }
  renderTemplate(container) {
    const editorTemplate = /* @__PURE__ */ Object.create(null);
    editorTemplate.container = container;
    editorTemplate.actionRunner = new OpenEditorActionRunner();
    editorTemplate.actionBar = new ActionBar(container, { actionRunner: editorTemplate.actionRunner });
    editorTemplate.root = this.labels.create(container);
    return editorTemplate;
  }
  renderElement(openedEditor, _index, templateData) {
    const editor = openedEditor.editor;
    templateData.actionRunner.editor = openedEditor;
    templateData.container.classList.toggle("dirty", editor.isDirty() && !editor.isSaving());
    templateData.container.classList.toggle("sticky", openedEditor.isSticky());
    templateData.root.setResource({
      resource: EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.BOTH }),
      name: editor.getName(),
      description: editor.getDescription(Verbosity.MEDIUM)
    }, {
      italic: openedEditor.isPreview(),
      extraClasses: ["open-editor"].concat(openedEditor.editor.getLabelExtraClasses()),
      fileDecorations: this.configurationService.getValue().explorer.decorations,
      title: editor.getTitle(Verbosity.LONG),
      icon: editor.getIcon()
    });
    const editorAction = openedEditor.isSticky() ? this.unpinEditorAction : this.closeEditorAction;
    if (!templateData.actionBar.hasAction(editorAction)) {
      if (!templateData.actionBar.isEmpty()) {
        templateData.actionBar.clear();
      }
      templateData.actionBar.push(editorAction, { icon: true, label: false, keybinding: this.keybindingService.lookupKeybinding(editorAction.id)?.getLabel() });
    }
  }
  disposeTemplate(templateData) {
    templateData.actionBar.dispose();
    templateData.root.dispose();
    templateData.actionRunner.dispose();
  }
};
_OpenEditorRenderer.ID = "openeditor";
let OpenEditorRenderer = _OpenEditorRenderer;
class OpenEditorsDragAndDrop {
  constructor(sortOrder, instantiationService, editorGroupService) {
    this.instantiationService = instantiationService;
    this.editorGroupService = editorGroupService;
    this._sortOrder = sortOrder;
  }
  set sortOrder(value) {
    this._sortOrder = value;
  }
  get dropHandler() {
    return this.instantiationService.createInstance(ResourcesDropHandler, { allowWorkspaceOpen: false });
  }
  getDragURI(element) {
    if (element instanceof OpenEditor) {
      const resource = element.getResource();
      if (resource) {
        return resource.toString();
      }
    }
    return null;
  }
  getDragLabel(elements) {
    if (elements.length > 1) {
      return String(elements.length);
    }
    const element = elements[0];
    return element instanceof OpenEditor ? element.editor.getName() : element.label;
  }
  onDragStart(data, originalEvent) {
    const items = data.elements;
    const editors = [];
    if (items) {
      for (const item of items) {
        if (item instanceof OpenEditor) {
          editors.push(item);
        }
      }
    }
    if (editors.length) {
      this.instantiationService.invokeFunction(fillEditorsDragData, editors, originalEvent);
    }
  }
  onDragOver(data, _targetElement, _targetIndex, targetSector, originalEvent) {
    if (data instanceof NativeDragAndDropData) {
      if (!containsDragType(originalEvent, DataTransfers.FILES, CodeDataTransfers.FILES)) {
        return false;
      }
    }
    if (this._sortOrder !== "editorOrder") {
      if (data instanceof ElementsDragAndDropData) {
        return false;
      } else {
        return { accept: true, effect: { type: ListDragOverEffectType.Move }, feedback: [-1] };
      }
    }
    let dropEffectPosition = void 0;
    switch (targetSector) {
      case ListViewTargetSector.TOP:
      case ListViewTargetSector.CENTER_TOP:
        dropEffectPosition = _targetIndex === 0 && _targetElement instanceof EditorGroupView ? ListDragOverEffectPosition.After : ListDragOverEffectPosition.Before;
        break;
      case ListViewTargetSector.CENTER_BOTTOM:
      case ListViewTargetSector.BOTTOM:
        dropEffectPosition = ListDragOverEffectPosition.After;
        break;
    }
    return { accept: true, effect: { type: ListDragOverEffectType.Move, position: dropEffectPosition }, feedback: [_targetIndex] };
  }
  drop(data, targetElement, _targetIndex, targetSector, originalEvent) {
    let group = targetElement instanceof OpenEditor ? targetElement.group : targetElement || this.editorGroupService.groups[this.editorGroupService.count - 1];
    let targetEditorIndex = targetElement instanceof OpenEditor ? targetElement.group.getIndexOfEditor(targetElement.editor) : 0;
    switch (targetSector) {
      case ListViewTargetSector.TOP:
      case ListViewTargetSector.CENTER_TOP:
        if (targetElement instanceof EditorGroupView && group.index !== 0) {
          group = this.editorGroupService.groups[group.index - 1];
          targetEditorIndex = group.count;
        }
        break;
      case ListViewTargetSector.BOTTOM:
      case ListViewTargetSector.CENTER_BOTTOM:
        if (targetElement instanceof OpenEditor) {
          targetEditorIndex++;
        }
        break;
    }
    if (data instanceof ElementsDragAndDropData) {
      for (const oe of data.elements) {
        const sourceEditorIndex = oe.group.getIndexOfEditor(oe.editor);
        if (oe.group === group && sourceEditorIndex < targetEditorIndex) {
          targetEditorIndex--;
        }
        oe.group.moveEditor(oe.editor, group, { index: targetEditorIndex, preserveFocus: true });
        targetEditorIndex++;
      }
      this.editorGroupService.activateGroup(group);
    } else {
      this.dropHandler.handleDrop(originalEvent, mainWindow, () => group, () => group.focus(), { index: targetEditorIndex });
    }
  }
  dispose() {
  }
}
__decorateClass([
  memoize
], OpenEditorsDragAndDrop.prototype, "dropHandler", 1);
class OpenEditorsAccessibilityProvider {
  getWidgetAriaLabel() {
    return nls.localize("openEditors", "Open Editors");
  }
  getAriaLabel(element) {
    if (element instanceof OpenEditor) {
      return `${element.editor.getName()}, ${element.editor.getDescription()}`;
    }
    return element.ariaLabel;
  }
}
const toggleEditorGroupLayoutId = "workbench.action.toggleEditorGroupLayout";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.toggleEditorGroupLayout",
      title: nls.localize2("flipLayout", "Toggle Vertical/Horizontal Editor Layout"),
      f1: true,
      keybinding: {
        primary: KeyMod.Shift | KeyMod.Alt | KeyCode.Digit0,
        mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Digit0 },
        weight: KeybindingWeight.WorkbenchContrib
      },
      icon: Codicon.editorLayout,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", OpenEditorsView.ID), MultipleEditorGroupsContext),
        order: 10
      }
    });
  }
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    const newOrientation = editorGroupService.orientation === GroupOrientation.VERTICAL ? GroupOrientation.HORIZONTAL : GroupOrientation.VERTICAL;
    editorGroupService.setGroupOrientation(newOrientation);
    editorGroupService.activeGroup.focus();
  }
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "5_flip",
  command: {
    id: toggleEditorGroupLayoutId,
    title: {
      ...nls.localize2("miToggleEditorLayoutWithoutMnemonic", "Flip Layout"),
      mnemonicTitle: nls.localize({ key: "miToggleEditorLayout", comment: ["&& denotes a mnemonic"] }, "Flip &&Layout")
    }
  },
  order: 1
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.files.saveAll",
      title: SAVE_ALL_LABEL,
      f1: true,
      icon: Codicon.saveAll,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", OpenEditorsView.ID),
        order: 20
      }
    });
  }
  async run(accessor) {
    const commandService = accessor.get(ICommandService);
    await commandService.executeCommand(SAVE_ALL_COMMAND_ID);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "openEditors.closeAll",
      title: CloseAllEditorsAction.LABEL,
      f1: false,
      icon: Codicon.closeAll,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", OpenEditorsView.ID),
        order: 30
      }
    });
  }
  async run(accessor) {
    const instantiationService = accessor.get(IInstantiationService);
    const closeAll = new CloseAllEditorsAction();
    await instantiationService.invokeFunction((accessor2) => closeAll.run(accessor2));
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "openEditors.newUntitledFile",
      title: nls.localize2("newUntitledFile", "New Untitled Text File"),
      f1: false,
      icon: Codicon.newFile,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", OpenEditorsView.ID),
        order: 5
      }
    });
  }
  async run(accessor) {
    const commandService = accessor.get(ICommandService);
    await commandService.executeCommand(NEW_UNTITLED_FILE_COMMAND_ID);
  }
});
export {
  OpenEditorsView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL3ZpZXdzL29wZW5FZGl0b3JzVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9vcGVuZWRpdG9ycy5jc3MnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSUFjdGlvbiwgQWN0aW9uUnVubmVyLCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNTZXJ2aWNlLCBJRWRpdG9yR3JvdXAsIEdyb3Vwc09yZGVyLCBHcm91cE9yaWVudGF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSwgSUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBWZXJib3NpdHksIEVkaXRvclJlc291cmNlQWNjZXNzb3IsIFNpZGVCeVNpZGVFZGl0b3IsIElFZGl0b3JJZGVudGlmaWVyLCBHcm91cE1vZGVsQ2hhbmdlS2luZCwgcHJldmVudEVkaXRvckNsb3NlLCBFZGl0b3JDbG9zZU1ldGhvZCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IFNhdmVBbGxJbkdyb3VwQWN0aW9uLCBDbG9zZUdyb3VwQWN0aW9uIH0gZnJvbSAnLi4vZmlsZUFjdGlvbnMuanMnO1xuaW1wb3J0IHsgT3BlbkVkaXRvcnNGb2N1c2VkQ29udGV4dCwgRXhwbG9yZXJGb2N1c2VkQ29udGV4dCwgSUZpbGVzQ29uZmlndXJhdGlvbiwgT3BlbkVkaXRvciB9IGZyb20gJy4uLy4uL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBDbG9zZUFsbEVkaXRvcnNBY3Rpb24sIENsb3NlRWRpdG9yQWN0aW9uLCBVbnBpbkVkaXRvckFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvckFjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlLCBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgYXNDc3NWYXJpYWJsZSwgYmFkZ2VCYWNrZ3JvdW5kLCBiYWRnZUZvcmVncm91bmQsIGNvbnRyYXN0Qm9yZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoTGlzdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGlzdFZpcnR1YWxEZWxlZ2F0ZSwgSUxpc3RSZW5kZXJlciwgSUxpc3RDb250ZXh0TWVudUV2ZW50LCBJTGlzdERyYWdBbmREcm9wLCBJTGlzdERyYWdPdmVyUmVhY3Rpb24sIExpc3REcmFnT3ZlckVmZmVjdFBvc2l0aW9uLCBMaXN0RHJhZ092ZXJFZmZlY3RUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUxhYmVscywgSVJlc291cmNlTGFiZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2xhYmVscy5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVNYXAsIElEaXNwb3NhYmxlLCBkaXNwb3NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1lbnVJZCwgQWN0aW9uMiwgcmVnaXN0ZXJBY3Rpb24yLCBNZW51UmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IE9wZW5FZGl0b3JzRGlydHlFZGl0b3JDb250ZXh0LCBPcGVuRWRpdG9yc0dyb3VwQ29udGV4dCwgT3BlbkVkaXRvcnNSZWFkb25seUVkaXRvckNvbnRleHQsIFNBVkVfQUxMX0xBQkVMLCBTQVZFX0FMTF9DT01NQU5EX0lELCBORVdfVU5USVRMRURfRklMRV9DT01NQU5EX0lELCBPcGVuRWRpdG9yc1NlbGVjdGVkRmlsZU9yVW50aXRsZWRDb250ZXh0IH0gZnJvbSAnLi4vZmlsZUNvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUNvbnRleHRLZXksIE11bHRpcGxlRWRpdG9yR3JvdXBzQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBDb2RlRGF0YVRyYW5zZmVycywgY29udGFpbnNEcmFnVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RuZC9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZXNEcm9wSGFuZGxlciwgZmlsbEVkaXRvcnNEcmFnRGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvZG5kLmpzJztcbmltcG9ydCB7IFZpZXdQYW5lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBJVmlld2xldFZpZXdPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3c1ZpZXdsZXQuanMnO1xuaW1wb3J0IHsgSURyYWdBbmREcm9wRGF0YSwgRGF0YVRyYW5zZmVycyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgbWVtb2l6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RlY29yYXRvcnMuanMnO1xuaW1wb3J0IHsgRWxlbWVudHNEcmFnQW5kRHJvcERhdGEsIExpc3RWaWV3VGFyZ2V0U2VjdG9yLCBOYXRpdmVEcmFnQW5kRHJvcERhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0Vmlldy5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHksIFdvcmtpbmdDb3B5Q2FwYWJpbGl0aWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5LmpzJztcbmltcG9ydCB7IElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZmlsZXNDb25maWd1cmF0aW9uL2NvbW1vbi9maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElWaWV3RGVzY3JpcHRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBPcmllbnRhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zcGxpdHZpZXcvc3BsaXR2aWV3LmpzJztcbmltcG9ydCB7IElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdFdpZGdldC5qcyc7XG5pbXBvcnQgeyBjb21wYXJlRmlsZU5hbWVzRGVmYXVsdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbXBhcmVycy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGV4dFVyaUlnbm9yZVBhdGhDYXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IElMb2NhbGl6ZWRTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JHcm91cFZpZXcgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JHcm91cFZpZXcuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcblxuY29uc3QgJCA9IGRvbS4kO1xuXG5leHBvcnQgY2xhc3MgT3BlbkVkaXRvcnNWaWV3IGV4dGVuZHMgVmlld1BhbmUge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IERFRkFVTFRfVklTSUJMRV9PUEVOX0VESVRPUlMgPSA5O1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBERUZBVUxUX01JTl9WSVNJQkxFX09QRU5fRURJVE9SUyA9IDA7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guZXhwbG9yZXIub3BlbkVkaXRvcnNWaWV3Jztcblx0c3RhdGljIHJlYWRvbmx5IE5BTUU6IElMb2NhbGl6ZWRTdHJpbmcgPSBubHMubG9jYWxpemUyKHsga2V5OiAnb3BlbkVkaXRvcnMnLCBjb21tZW50OiBbJ09wZW4gaXMgYW4gYWRqZWN0aXZlJ10gfSwgXCJPcGVuIEVkaXRvcnNcIik7XG5cblx0cHJpdmF0ZSBkaXJ0eUNvdW50RWxlbWVudCE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIGxpc3RSZWZyZXNoU2NoZWR1bGVyOiBSdW5PbmNlU2NoZWR1bGVyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHN0cnVjdHVyYWxSZWZyZXNoRGVsYXk6IG51bWJlcjtcblx0cHJpdmF0ZSBkbmQ6IE9wZW5FZGl0b3JzRHJhZ0FuZERyb3AgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgbGlzdDogV29ya2JlbmNoTGlzdDxPcGVuRWRpdG9yIHwgSUVkaXRvckdyb3VwPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBsaXN0TGFiZWxzOiBSZXNvdXJjZUxhYmVscyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBuZWVkc1JlZnJlc2ggPSBmYWxzZTtcblx0cHJpdmF0ZSBlbGVtZW50czogKE9wZW5FZGl0b3IgfCBJRWRpdG9yR3JvdXApW10gPSBbXTtcblx0cHJpdmF0ZSBzb3J0T3JkZXI6ICdlZGl0b3JPcmRlcicgfCAnYWxwaGFiZXRpY2FsJyB8ICdmdWxsUGF0aCc7XG5cdHByaXZhdGUgYmxvY2tGb2N1c0FjdGl2ZUVkaXRvclRyYWNraW5nID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0aW9uczogSVZpZXdsZXRWaWV3T3B0aW9ucyxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3JraW5nQ29weVNlcnZpY2U6IElXb3JraW5nQ29weVNlcnZpY2UsXG5cdFx0QElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZXNDb25maWd1cmF0aW9uU2VydmljZTogSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKG9wdGlvbnMsIGtleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgb3BlbmVyU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXG5cdFx0dGhpcy5zdHJ1Y3R1cmFsUmVmcmVzaERlbGF5ID0gMDtcblx0XHR0aGlzLnNvcnRPcmRlciA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdleHBsb3Jlci5vcGVuRWRpdG9ycy5zb3J0T3JkZXInKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJVcGRhdGVFdmVudHMoKTtcblxuXHRcdC8vIEFsc28gaGFuZGxlIGNvbmZpZ3VyYXRpb24gdXBkYXRlc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4gdGhpcy5vbkNvbmZpZ3VyYXRpb25DaGFuZ2UoZSkpKTtcblxuXHRcdC8vIEhhbmRsZSBkaXJ0eSBjb3VudGVyXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53b3JraW5nQ29weVNlcnZpY2Uub25EaWRDaGFuZ2VEaXJ0eSh3b3JraW5nQ29weSA9PiB0aGlzLnVwZGF0ZURpcnR5SW5kaWNhdG9yKHdvcmtpbmdDb3B5KSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclVwZGF0ZUV2ZW50cygpOiB2b2lkIHtcblx0XHRjb25zdCB1cGRhdGVXaG9sZUxpc3QgPSAoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuaXNCb2R5VmlzaWJsZSgpIHx8ICF0aGlzLmxpc3QpIHtcblx0XHRcdFx0dGhpcy5uZWVkc1JlZnJlc2ggPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMubGlzdFJlZnJlc2hTY2hlZHVsZXI/LnNjaGVkdWxlKHRoaXMuc3RydWN0dXJhbFJlZnJlc2hEZWxheSk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGdyb3VwRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcDxudW1iZXI+KCkpO1xuXHRcdGNvbnN0IGFkZEdyb3VwTGlzdGVuZXIgPSAoZ3JvdXA6IElFZGl0b3JHcm91cCkgPT4ge1xuXHRcdFx0Y29uc3QgZ3JvdXBNb2RlbENoYW5nZUxpc3RlbmVyID0gZ3JvdXAub25EaWRNb2RlbENoYW5nZShlID0+IHtcblx0XHRcdFx0aWYgKHRoaXMubGlzdFJlZnJlc2hTY2hlZHVsZXI/LmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCF0aGlzLmlzQm9keVZpc2libGUoKSB8fCAhdGhpcy5saXN0KSB7XG5cdFx0XHRcdFx0dGhpcy5uZWVkc1JlZnJlc2ggPSB0cnVlO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5nZXRJbmRleChncm91cCwgZS5lZGl0b3IpO1xuXHRcdFx0XHRzd2l0Y2ggKGUua2luZCkge1xuXHRcdFx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0FDVElWRTpcblx0XHRcdFx0XHRcdHRoaXMuZm9jdXNBY3RpdmVFZGl0b3IoKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuR1JPVVBfSU5ERVg6XG5cdFx0XHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5HUk9VUF9MQUJFTDpcblx0XHRcdFx0XHRcdGlmIChpbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMubGlzdC5zcGxpY2UoaW5kZXgsIDEsIFtncm91cF0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfRElSVFk6XG5cdFx0XHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfU1RJQ0tZOlxuXHRcdFx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0NBUEFCSUxJVElFUzpcblx0XHRcdFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9QSU46XG5cdFx0XHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfTEFCRUw6XG5cdFx0XHRcdFx0XHR0aGlzLmxpc3Quc3BsaWNlKGluZGV4LCAxLCBbbmV3IE9wZW5FZGl0b3IoZS5lZGl0b3IhLCBncm91cCldKTtcblx0XHRcdFx0XHRcdHRoaXMuZm9jdXNBY3RpdmVFZGl0b3IoKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX09QRU46XG5cdFx0XHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfTU9WRTpcblx0XHRcdFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9DTE9TRTpcblx0XHRcdFx0XHRcdHVwZGF0ZVdob2xlTGlzdCgpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0Z3JvdXBEaXNwb3NhYmxlcy5zZXQoZ3JvdXAuaWQsIGdyb3VwTW9kZWxDaGFuZ2VMaXN0ZW5lcik7XG5cdFx0fTtcblxuXHRcdHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmdyb3Vwcy5mb3JFYWNoKGcgPT4gYWRkR3JvdXBMaXN0ZW5lcihnKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3JHcm91cFNlcnZpY2Uub25EaWRBZGRHcm91cChncm91cCA9PiB7XG5cdFx0XHRhZGRHcm91cExpc3RlbmVyKGdyb3VwKTtcblx0XHRcdHVwZGF0ZVdob2xlTGlzdCgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvckdyb3VwU2VydmljZS5vbkRpZE1vdmVHcm91cCgoKSA9PiB1cGRhdGVXaG9sZUxpc3QoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLm9uRGlkQ2hhbmdlQWN0aXZlR3JvdXAoKCkgPT4gdGhpcy5mb2N1c0FjdGl2ZUVkaXRvcigpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3JHcm91cFNlcnZpY2Uub25EaWRSZW1vdmVHcm91cChncm91cCA9PiB7XG5cdFx0XHRncm91cERpc3Bvc2FibGVzLmRlbGV0ZUFuZERpc3Bvc2UoZ3JvdXAuaWQpO1xuXHRcdFx0dXBkYXRlV2hvbGVMaXN0KCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckhlYWRlclRpdGxlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJIZWFkZXJUaXRsZShjb250YWluZXIsIHRoaXMudGl0bGUpO1xuXG5cdFx0Y29uc3QgY291bnQgPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgJCgnLm9wZW4tZWRpdG9ycy1kaXJ0eS1jb3VudC1jb250YWluZXInKSk7XG5cdFx0dGhpcy5kaXJ0eUNvdW50RWxlbWVudCA9IGRvbS5hcHBlbmQoY291bnQsICQoJy5kaXJ0eS1jb3VudC5tb25hY28tY291bnQtYmFkZ2UubG9uZycpKTtcblxuXHRcdHRoaXMuZGlydHlDb3VudEVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYXNDc3NWYXJpYWJsZShiYWRnZUJhY2tncm91bmQpO1xuXHRcdHRoaXMuZGlydHlDb3VudEVsZW1lbnQuc3R5bGUuY29sb3IgPSBhc0Nzc1ZhcmlhYmxlKGJhZGdlRm9yZWdyb3VuZCk7XG5cdFx0dGhpcy5kaXJ0eUNvdW50RWxlbWVudC5zdHlsZS5ib3JkZXIgPSBgMXB4IHNvbGlkICR7YXNDc3NWYXJpYWJsZShjb250cmFzdEJvcmRlcil9YDtcblxuXHRcdHRoaXMudXBkYXRlRGlydHlJbmRpY2F0b3IoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXJCb2R5KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJCb2R5KGNvbnRhaW5lcik7XG5cblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnb3Blbi1lZGl0b3JzJyk7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3Nob3ctZmlsZS1pY29ucycpO1xuXG5cdFx0Y29uc3QgZGVsZWdhdGUgPSBuZXcgT3BlbkVkaXRvcnNEZWxlZ2F0ZSgpO1xuXG5cdFx0aWYgKHRoaXMubGlzdCkge1xuXHRcdFx0dGhpcy5saXN0LmRpc3Bvc2UoKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMubGlzdExhYmVscykge1xuXHRcdFx0dGhpcy5saXN0TGFiZWxzLmNsZWFyKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5kbmQgPSBuZXcgT3BlbkVkaXRvcnNEcmFnQW5kRHJvcCh0aGlzLnNvcnRPcmRlciwgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSwgdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UpO1xuXG5cdFx0dGhpcy5saXN0TGFiZWxzID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvdXJjZUxhYmVscywgeyBvbkRpZENoYW5nZVZpc2liaWxpdHk6IHRoaXMub25EaWRDaGFuZ2VCb2R5VmlzaWJpbGl0eSB9KTtcblx0XHR0aGlzLmxpc3QgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtiZW5jaExpc3QsICdPcGVuRWRpdG9ycycsIGNvbnRhaW5lciwgZGVsZWdhdGUsIFtcblx0XHRcdG5ldyBFZGl0b3JHcm91cFJlbmRlcmVyKHRoaXMua2V5YmluZGluZ1NlcnZpY2UsIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpLFxuXHRcdFx0bmV3IE9wZW5FZGl0b3JSZW5kZXJlcih0aGlzLmxpc3RMYWJlbHMsIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UsIHRoaXMua2V5YmluZGluZ1NlcnZpY2UsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpXG5cdFx0XSwge1xuXHRcdFx0aWRlbnRpdHlQcm92aWRlcjogeyBnZXRJZDogKGVsZW1lbnQ6IE9wZW5FZGl0b3IgfCBJRWRpdG9yR3JvdXApID0+IGVsZW1lbnQgaW5zdGFuY2VvZiBPcGVuRWRpdG9yID8gZWxlbWVudC5nZXRJZCgpIDogZWxlbWVudC5pZC50b1N0cmluZygpIH0sXG5cdFx0XHRkbmQ6IHRoaXMuZG5kLFxuXHRcdFx0b3ZlcnJpZGVTdHlsZXM6IHRoaXMuZ2V0TG9jYXRpb25CYXNlZENvbG9ycygpLmxpc3RPdmVycmlkZVN0eWxlcyxcblx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogbmV3IE9wZW5FZGl0b3JzQWNjZXNzaWJpbGl0eVByb3ZpZGVyKClcblx0XHR9KSBhcyBXb3JrYmVuY2hMaXN0PE9wZW5FZGl0b3IgfCBJRWRpdG9yR3JvdXA+O1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGlzdCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5saXN0TGFiZWxzKTtcblxuXHRcdC8vIFJlZ2lzdGVyIHRoZSByZWZyZXNoIHNjaGVkdWxlclxuXHRcdGxldCBsYWJlbENoYW5nZUxpc3RlbmVyczogSURpc3Bvc2FibGVbXSA9IFtdO1xuXHRcdHRoaXMubGlzdFJlZnJlc2hTY2hlZHVsZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHQvLyBObyBuZWVkIHRvIHJlZnJlc2ggdGhlIGxpc3QgaWYgaXQncyBub3QgcmVuZGVyZWRcblx0XHRcdGlmICghdGhpcy5saXN0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGxhYmVsQ2hhbmdlTGlzdGVuZXJzID0gZGlzcG9zZShsYWJlbENoYW5nZUxpc3RlbmVycyk7XG5cdFx0XHRjb25zdCBwcmV2aW91c0xlbmd0aCA9IHRoaXMubGlzdC5sZW5ndGg7XG5cdFx0XHRjb25zdCBlbGVtZW50cyA9IHRoaXMuZ2V0RWxlbWVudHMoKTtcblx0XHRcdHRoaXMubGlzdC5zcGxpY2UoMCwgdGhpcy5saXN0Lmxlbmd0aCwgZWxlbWVudHMpO1xuXHRcdFx0dGhpcy5mb2N1c0FjdGl2ZUVkaXRvcigpO1xuXHRcdFx0aWYgKHByZXZpb3VzTGVuZ3RoICE9PSB0aGlzLmxpc3QubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlU2l6ZSgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5uZWVkc1JlZnJlc2ggPSBmYWxzZTtcblxuXHRcdFx0aWYgKHRoaXMuc29ydE9yZGVyID09PSAnYWxwaGFiZXRpY2FsJyB8fCB0aGlzLnNvcnRPcmRlciA9PT0gJ2Z1bGxQYXRoJykge1xuXHRcdFx0XHQvLyBXZSBuZWVkIHRvIHJlc29ydCB0aGUgbGlzdCBpZiB0aGUgZWRpdG9yIGxhYmVsIGNoYW5nZWRcblx0XHRcdFx0ZWxlbWVudHMuZm9yRWFjaChlID0+IHtcblx0XHRcdFx0XHRpZiAoZSBpbnN0YW5jZW9mIE9wZW5FZGl0b3IpIHtcblx0XHRcdFx0XHRcdGxhYmVsQ2hhbmdlTGlzdGVuZXJzLnB1c2goZS5lZGl0b3Iub25EaWRDaGFuZ2VMYWJlbCgoKSA9PiB0aGlzLmxpc3RSZWZyZXNoU2NoZWR1bGVyPy5zY2hlZHVsZSgpKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9LCB0aGlzLnN0cnVjdHVyYWxSZWZyZXNoRGVsYXkpKTtcblxuXHRcdHRoaXMudXBkYXRlU2l6ZSgpO1xuXG5cdFx0dGhpcy5oYW5kbGVDb250ZXh0S2V5cygpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGlzdC5vbkNvbnRleHRNZW51KGUgPT4gdGhpcy5vbkxpc3RDb250ZXh0TWVudShlKSkpO1xuXG5cdFx0Ly8gT3BlbiB3aGVuIHNlbGVjdGluZyB2aWEga2V5Ym9hcmRcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxpc3Qub25Nb3VzZU1pZGRsZUNsaWNrKGUgPT4ge1xuXHRcdFx0aWYgKGUgJiYgZS5lbGVtZW50IGluc3RhbmNlb2YgT3BlbkVkaXRvcikge1xuXHRcdFx0XHRpZiAocHJldmVudEVkaXRvckNsb3NlKGUuZWxlbWVudC5ncm91cCwgZS5lbGVtZW50LmVkaXRvciwgRWRpdG9yQ2xvc2VNZXRob2QuTU9VU0UsIHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLnBhcnRPcHRpb25zKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGUuZWxlbWVudC5ncm91cC5jbG9zZUVkaXRvcihlLmVsZW1lbnQuZWRpdG9yLCB7IHByZXNlcnZlRm9jdXM6IHRydWUgfSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGlzdC5vbkRpZE9wZW4oZSA9PiB7XG5cdFx0XHRjb25zdCBlbGVtZW50ID0gZS5lbGVtZW50O1xuXHRcdFx0aWYgKCFlbGVtZW50KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIE9wZW5FZGl0b3IpIHtcblx0XHRcdFx0aWYgKGRvbS5pc01vdXNlRXZlbnQoZS5icm93c2VyRXZlbnQpICYmIGUuYnJvd3NlckV2ZW50LmJ1dHRvbiA9PT0gMSkge1xuXHRcdFx0XHRcdHJldHVybjsgLy8gbWlkZGxlIGNsaWNrIGFscmVhZHkgaGFuZGxlZCBhYm92ZTogY2xvc2VzIHRoZSBlZGl0b3Jcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMud2l0aEFjdGl2ZUVkaXRvckZvY3VzVHJhY2tpbmdEaXNhYmxlZCgoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5vcGVuRWRpdG9yKGVsZW1lbnQsIHsgcHJlc2VydmVGb2N1czogZS5lZGl0b3JPcHRpb25zLnByZXNlcnZlRm9jdXMsIHBpbm5lZDogZS5lZGl0b3JPcHRpb25zLnBpbm5lZCwgc2lkZUJ5U2lkZTogZS5zaWRlQnlTaWRlIH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMud2l0aEFjdGl2ZUVkaXRvckZvY3VzVHJhY2tpbmdEaXNhYmxlZCgoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZhdGVHcm91cChlbGVtZW50KTtcblx0XHRcdFx0XHRpZiAoIWUuZWRpdG9yT3B0aW9ucy5wcmVzZXJ2ZUZvY3VzKSB7XG5cdFx0XHRcdFx0XHRlbGVtZW50LmZvY3VzKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLmxpc3RSZWZyZXNoU2NoZWR1bGVyLnNjaGVkdWxlKDApO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZENoYW5nZUJvZHlWaXNpYmlsaXR5KHZpc2libGUgPT4ge1xuXHRcdFx0aWYgKHZpc2libGUgJiYgdGhpcy5uZWVkc1JlZnJlc2gpIHtcblx0XHRcdFx0dGhpcy5saXN0UmVmcmVzaFNjaGVkdWxlcj8uc2NoZWR1bGUoMCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgY29udGFpbmVyTW9kZWwgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwodGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKHRoaXMuaWQpISkhO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbnRhaW5lck1vZGVsLm9uRGlkQ2hhbmdlQWxsVmlld0Rlc2NyaXB0b3JzKCgpID0+IHtcblx0XHRcdHRoaXMudXBkYXRlU2l6ZSgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlQ29udGV4dEtleXMoKSB7XG5cdFx0aWYgKCF0aGlzLmxpc3QpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBCaW5kIGNvbnRleHQga2V5c1xuXHRcdE9wZW5FZGl0b3JzRm9jdXNlZENvbnRleHQuYmluZFRvKHRoaXMubGlzdC5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0RXhwbG9yZXJGb2N1c2VkQ29udGV4dC5iaW5kVG8odGhpcy5saXN0LmNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGdyb3VwRm9jdXNlZENvbnRleHQgPSBPcGVuRWRpdG9yc0dyb3VwQ29udGV4dC5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgZGlydHlFZGl0b3JGb2N1c2VkQ29udGV4dCA9IE9wZW5FZGl0b3JzRGlydHlFZGl0b3JDb250ZXh0LmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRjb25zdCByZWFkb25seUVkaXRvckZvY3VzZWRDb250ZXh0ID0gT3BlbkVkaXRvcnNSZWFkb25seUVkaXRvckNvbnRleHQuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IG9wZW5FZGl0b3JzU2VsZWN0ZWRGaWxlT3JVbnRpdGxlZENvbnRleHQgPSBPcGVuRWRpdG9yc1NlbGVjdGVkRmlsZU9yVW50aXRsZWRDb250ZXh0LmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHJlc291cmNlQ29udGV4dCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVzb3VyY2VDb250ZXh0S2V5KTtcblx0XHR0aGlzLl9yZWdpc3RlcihyZXNvdXJjZUNvbnRleHQpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5saXN0Lm9uRGlkQ2hhbmdlRm9jdXMoZSA9PiB7XG5cdFx0XHRyZXNvdXJjZUNvbnRleHQucmVzZXQoKTtcblx0XHRcdGdyb3VwRm9jdXNlZENvbnRleHQucmVzZXQoKTtcblx0XHRcdGRpcnR5RWRpdG9yRm9jdXNlZENvbnRleHQucmVzZXQoKTtcblx0XHRcdHJlYWRvbmx5RWRpdG9yRm9jdXNlZENvbnRleHQucmVzZXQoKTtcblxuXHRcdFx0Y29uc3QgZWxlbWVudCA9IGUuZWxlbWVudHMubGVuZ3RoID8gZS5lbGVtZW50c1swXSA6IHVuZGVmaW5lZDtcblx0XHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgT3BlbkVkaXRvcikge1xuXHRcdFx0XHRjb25zdCByZXNvdXJjZSA9IGVsZW1lbnQuZ2V0UmVzb3VyY2UoKTtcblx0XHRcdFx0ZGlydHlFZGl0b3JGb2N1c2VkQ29udGV4dC5zZXQoZWxlbWVudC5lZGl0b3IuaXNEaXJ0eSgpICYmICFlbGVtZW50LmVkaXRvci5pc1NhdmluZygpKTtcblx0XHRcdFx0cmVhZG9ubHlFZGl0b3JGb2N1c2VkQ29udGV4dC5zZXQoISFlbGVtZW50LmVkaXRvci5pc1JlYWRvbmx5KCkpO1xuXHRcdFx0XHRyZXNvdXJjZUNvbnRleHQuc2V0KHJlc291cmNlID8/IG51bGwpO1xuXHRcdFx0fSBlbHNlIGlmICghIWVsZW1lbnQpIHtcblx0XHRcdFx0Z3JvdXBGb2N1c2VkQ29udGV4dC5zZXQodHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5saXN0Lm9uRGlkQ2hhbmdlU2VsZWN0aW9uKGUgPT4ge1xuXHRcdFx0Y29uc3Qgc2VsZWN0ZWRBcmVGaWxlT3JVbnRpdGxlZCA9IGUuZWxlbWVudHMuZXZlcnkoZSA9PiB7XG5cdFx0XHRcdGlmIChlIGluc3RhbmNlb2YgT3BlbkVkaXRvcikge1xuXHRcdFx0XHRcdGNvbnN0IHJlc291cmNlID0gZS5nZXRSZXNvdXJjZSgpO1xuXHRcdFx0XHRcdHJldHVybiByZXNvdXJjZSAmJiAocmVzb3VyY2Uuc2NoZW1lID09PSBTY2hlbWFzLnVudGl0bGVkIHx8IHRoaXMuZmlsZVNlcnZpY2UuaGFzUHJvdmlkZXIocmVzb3VyY2UpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9KTtcblx0XHRcdG9wZW5FZGl0b3JzU2VsZWN0ZWRGaWxlT3JVbnRpdGxlZENvbnRleHQuc2V0KHNlbGVjdGVkQXJlRmlsZU9yVW50aXRsZWQpO1xuXHRcdH0pKTtcblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCk6IHZvaWQge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cblx0XHR0aGlzLmxpc3Q/LmRvbUZvY3VzKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgbGF5b3V0Qm9keShoZWlnaHQ6IG51bWJlciwgd2lkdGg6IG51bWJlcik6IHZvaWQge1xuXHRcdHN1cGVyLmxheW91dEJvZHkoaGVpZ2h0LCB3aWR0aCk7XG5cdFx0dGhpcy5saXN0Py5sYXlvdXQoaGVpZ2h0LCB3aWR0aCk7XG5cdH1cblxuXHRwcml2YXRlIGdldCBzaG93R3JvdXBzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5ncm91cHMubGVuZ3RoID4gMTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RWxlbWVudHMoKTogQXJyYXk8SUVkaXRvckdyb3VwIHwgT3BlbkVkaXRvcj4ge1xuXHRcdHRoaXMuZWxlbWVudHMgPSBbXTtcblx0XHR0aGlzLmVkaXRvckdyb3VwU2VydmljZS5nZXRHcm91cHMoR3JvdXBzT3JkZXIuR1JJRF9BUFBFQVJBTkNFKS5mb3JFYWNoKGcgPT4ge1xuXHRcdFx0aWYgKHRoaXMuc2hvd0dyb3Vwcykge1xuXHRcdFx0XHR0aGlzLmVsZW1lbnRzLnB1c2goZyk7XG5cdFx0XHR9XG5cdFx0XHRsZXQgZWRpdG9ycyA9IGcuZWRpdG9ycy5tYXAoZWkgPT4gbmV3IE9wZW5FZGl0b3IoZWksIGcpKTtcblx0XHRcdGlmICh0aGlzLnNvcnRPcmRlciA9PT0gJ2FscGhhYmV0aWNhbCcpIHtcblx0XHRcdFx0ZWRpdG9ycyA9IGVkaXRvcnMuc29ydCgoZmlyc3QsIHNlY29uZCkgPT4gY29tcGFyZUZpbGVOYW1lc0RlZmF1bHQoZmlyc3QuZWRpdG9yLmdldE5hbWUoKSwgc2Vjb25kLmVkaXRvci5nZXROYW1lKCkpKTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5zb3J0T3JkZXIgPT09ICdmdWxsUGF0aCcpIHtcblx0XHRcdFx0ZWRpdG9ycyA9IGVkaXRvcnMuc29ydCgoZmlyc3QsIHNlY29uZCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGZpcnN0UmVzb3VyY2UgPSBmaXJzdC5lZGl0b3IucmVzb3VyY2U7XG5cdFx0XHRcdFx0Y29uc3Qgc2Vjb25kUmVzb3VyY2UgPSBzZWNvbmQuZWRpdG9yLnJlc291cmNlO1xuXHRcdFx0XHRcdC8vcHV0ICdzeXN0ZW0nIGVkaXRvcnMgYmVmb3JlIGV2ZXJ5dGhpbmdcblx0XHRcdFx0XHRpZiAoZmlyc3RSZXNvdXJjZSA9PT0gdW5kZWZpbmVkICYmIHNlY29uZFJlc291cmNlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdHJldHVybiBjb21wYXJlRmlsZU5hbWVzRGVmYXVsdChmaXJzdC5lZGl0b3IuZ2V0TmFtZSgpLCBzZWNvbmQuZWRpdG9yLmdldE5hbWUoKSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChmaXJzdFJlc291cmNlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHNlY29uZFJlc291cmNlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zdCBmaXJzdFNjaGVtZSA9IGZpcnN0UmVzb3VyY2Uuc2NoZW1lO1xuXHRcdFx0XHRcdFx0Y29uc3Qgc2Vjb25kU2NoZW1lID0gc2Vjb25kUmVzb3VyY2Uuc2NoZW1lO1xuXHRcdFx0XHRcdFx0Ly9wdXQgbm9uLWZpbGUgZWRpdG9ycyBiZWZvcmUgZmlsZXNcblx0XHRcdFx0XHRcdGlmIChmaXJzdFNjaGVtZSAhPT0gU2NoZW1hcy5maWxlICYmIHNlY29uZFNjaGVtZSAhPT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBleHRVcmlJZ25vcmVQYXRoQ2FzZS5jb21wYXJlKGZpcnN0UmVzb3VyY2UsIHNlY29uZFJlc291cmNlKTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoZmlyc3RTY2hlbWUgIT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKHNlY29uZFNjaGVtZSAhPT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGV4dFVyaUlnbm9yZVBhdGhDYXNlLmNvbXBhcmUoZmlyc3RSZXNvdXJjZSwgc2Vjb25kUmVzb3VyY2UpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmVsZW1lbnRzLnB1c2goLi4uZWRpdG9ycyk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gdGhpcy5lbGVtZW50cztcblx0fVxuXG5cdHByaXZhdGUgZ2V0SW5kZXgoZ3JvdXA6IElFZGl0b3JHcm91cCwgZWRpdG9yOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCB8IG51bGwpOiBudW1iZXIge1xuXHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5lbGVtZW50cy5maW5kSW5kZXgoZSA9PiAhKGUgaW5zdGFuY2VvZiBPcGVuRWRpdG9yKSAmJiBlLmlkID09PSBncm91cC5pZCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZWxlbWVudHMuZmluZEluZGV4KGUgPT4gZSBpbnN0YW5jZW9mIE9wZW5FZGl0b3IgJiYgZS5lZGl0b3IgPT09IGVkaXRvciAmJiBlLmdyb3VwLmlkID09PSBncm91cC5pZCk7XG5cdH1cblxuXHRwcml2YXRlIG9wZW5FZGl0b3IoZWxlbWVudDogT3BlbkVkaXRvciwgb3B0aW9uczogeyBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbjsgcGlubmVkPzogYm9vbGVhbjsgc2lkZUJ5U2lkZT86IGJvb2xlYW4gfSk6IHZvaWQge1xuXHRcdGlmIChlbGVtZW50KSB7XG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uPignd29ya2JlbmNoQWN0aW9uRXhlY3V0ZWQnLCB7IGlkOiAnd29ya2JlbmNoLmZpbGVzLm9wZW5GaWxlJywgZnJvbTogJ29wZW5FZGl0b3JzJyB9KTtcblxuXHRcdFx0Y29uc3QgcHJlc2VydmVBY3RpdmF0ZUdyb3VwID0gb3B0aW9ucy5zaWRlQnlTaWRlICYmIG9wdGlvbnMucHJlc2VydmVGb2N1czsgLy8gbmVlZGVkIGZvciBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNDIzOTlcblx0XHRcdGlmICghcHJlc2VydmVBY3RpdmF0ZUdyb3VwKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2YXRlR3JvdXAoZWxlbWVudC5ncm91cCk7IC8vIG5lZWRlZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzY2NzJcblx0XHRcdH1cblx0XHRcdGNvbnN0IHRhcmdldEdyb3VwID0gb3B0aW9ucy5zaWRlQnlTaWRlID8gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2Uuc2lkZUdyb3VwIDogZWxlbWVudC5ncm91cDtcblx0XHRcdHRhcmdldEdyb3VwLm9wZW5FZGl0b3IoZWxlbWVudC5lZGl0b3IsIG9wdGlvbnMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25MaXN0Q29udGV4dE1lbnUoZTogSUxpc3RDb250ZXh0TWVudUV2ZW50PE9wZW5FZGl0b3IgfCBJRWRpdG9yR3JvdXA+KTogdm9pZCB7XG5cdFx0aWYgKCFlLmVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlbGVtZW50ID0gZS5lbGVtZW50O1xuXG5cdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdG1lbnVJZDogTWVudUlkLk9wZW5FZGl0b3JzQ29udGV4dCxcblx0XHRcdG1lbnVBY3Rpb25PcHRpb25zOiB7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlLCBhcmc6IGVsZW1lbnQgaW5zdGFuY2VvZiBPcGVuRWRpdG9yID8gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRPcmlnaW5hbFVyaShlbGVtZW50LmVkaXRvcikgOiB7fSB9LFxuXHRcdFx0Y29udGV4dEtleVNlcnZpY2U6IHRoaXMubGlzdD8uY29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRnZXRBbmNob3I6ICgpID0+IGUuYW5jaG9yLFxuXHRcdFx0Z2V0QWN0aW9uc0NvbnRleHQ6ICgpID0+IGVsZW1lbnQgaW5zdGFuY2VvZiBPcGVuRWRpdG9yID8geyBncm91cElkOiBlbGVtZW50Lmdyb3VwSWQsIGVkaXRvckluZGV4OiBlbGVtZW50Lmdyb3VwLmdldEluZGV4T2ZFZGl0b3IoZWxlbWVudC5lZGl0b3IpIH0gOiB7IGdyb3VwSWQ6IGVsZW1lbnQuaWQgfVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSB3aXRoQWN0aXZlRWRpdG9yRm9jdXNUcmFja2luZ0Rpc2FibGVkKGZuOiAoKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0dGhpcy5ibG9ja0ZvY3VzQWN0aXZlRWRpdG9yVHJhY2tpbmcgPSB0cnVlO1xuXHRcdHRyeSB7XG5cdFx0XHRmbigpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLmJsb2NrRm9jdXNBY3RpdmVFZGl0b3JUcmFja2luZyA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZm9jdXNBY3RpdmVFZGl0b3IoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmxpc3QgfHwgdGhpcy5ibG9ja0ZvY3VzQWN0aXZlRWRpdG9yVHJhY2tpbmcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5saXN0Lmxlbmd0aCAmJiB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cCkge1xuXHRcdFx0Y29uc3QgaW5kZXggPSB0aGlzLmdldEluZGV4KHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwLCB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cC5hY3RpdmVFZGl0b3IpO1xuXHRcdFx0aWYgKGluZGV4ID49IDApIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHR0aGlzLmxpc3Quc2V0Rm9jdXMoW2luZGV4XSk7XG5cdFx0XHRcdFx0dGhpcy5saXN0LnNldFNlbGVjdGlvbihbaW5kZXhdKTtcblx0XHRcdFx0XHR0aGlzLmxpc3QucmV2ZWFsKGluZGV4KTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdC8vIG5vb3AgbGlzdCB1cGRhdGVkIGluIHRoZSBtZWFudGltZVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLmxpc3Quc2V0Rm9jdXMoW10pO1xuXHRcdHRoaXMubGlzdC5zZXRTZWxlY3Rpb24oW10pO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkNvbmZpZ3VyYXRpb25DaGFuZ2UoZXZlbnQ6IElDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoZXZlbnQuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2V4cGxvcmVyLm9wZW5FZGl0b3JzJykpIHtcblx0XHRcdHRoaXMudXBkYXRlU2l6ZSgpO1xuXHRcdH1cblx0XHQvLyBUcmlnZ2VyIGEgJ3JlcGFpbnQnIHdoZW4gZGVjb3JhdGlvbiBzZXR0aW5ncyBjaGFuZ2Ugb3IgdGhlIHNvcnQgb3JkZXIgY2hhbmdlZFxuXHRcdGlmIChldmVudC5hZmZlY3RzQ29uZmlndXJhdGlvbignZXhwbG9yZXIuZGVjb3JhdGlvbnMnKSB8fCBldmVudC5hZmZlY3RzQ29uZmlndXJhdGlvbignZXhwbG9yZXIub3BlbkVkaXRvcnMuc29ydE9yZGVyJykpIHtcblx0XHRcdHRoaXMuc29ydE9yZGVyID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnZXhwbG9yZXIub3BlbkVkaXRvcnMuc29ydE9yZGVyJyk7XG5cdFx0XHRpZiAodGhpcy5kbmQpIHtcblx0XHRcdFx0dGhpcy5kbmQuc29ydE9yZGVyID0gdGhpcy5zb3J0T3JkZXI7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmxpc3RSZWZyZXNoU2NoZWR1bGVyPy5zY2hlZHVsZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlU2l6ZSgpOiB2b2lkIHtcblx0XHQvLyBBZGp1c3QgZXhwYW5kZWQgYm9keSBzaXplXG5cdFx0dGhpcy5taW5pbXVtQm9keVNpemUgPSB0aGlzLm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5WRVJUSUNBTCA/IHRoaXMuZ2V0TWluRXhwYW5kZWRCb2R5U2l6ZSgpIDogMTcwO1xuXHRcdHRoaXMubWF4aW11bUJvZHlTaXplID0gdGhpcy5vcmllbnRhdGlvbiA9PT0gT3JpZW50YXRpb24uVkVSVElDQUwgPyB0aGlzLmdldE1heEV4cGFuZGVkQm9keVNpemUoKSA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRGlydHlJbmRpY2F0b3Iod29ya2luZ0NvcHk/OiBJV29ya2luZ0NvcHkpOiB2b2lkIHtcblx0XHRpZiAod29ya2luZ0NvcHkpIHtcblx0XHRcdGNvbnN0IGdvdERpcnR5ID0gd29ya2luZ0NvcHkuaXNEaXJ0eSgpO1xuXHRcdFx0aWYgKGdvdERpcnR5ICYmICEod29ya2luZ0NvcHkuY2FwYWJpbGl0aWVzICYgV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMuVW50aXRsZWQpICYmIHRoaXMuZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5oYXNTaG9ydEF1dG9TYXZlRGVsYXkod29ya2luZ0NvcHkucmVzb3VyY2UpKSB7XG5cdFx0XHRcdHJldHVybjsgLy8gZG8gbm90IGluZGljYXRlIGRpcnR5IG9mIHdvcmtpbmcgY29waWVzIHRoYXQgYXJlIGF1dG8gc2F2ZWQgYWZ0ZXIgc2hvcnQgZGVsYXlcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBkaXJ0eSA9IHRoaXMud29ya2luZ0NvcHlTZXJ2aWNlLmRpcnR5Q291bnQ7XG5cdFx0aWYgKGRpcnR5ID09PSAwKSB7XG5cdFx0XHR0aGlzLmRpcnR5Q291bnRFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRpcnR5Q291bnRFbGVtZW50LnRleHRDb250ZW50ID0gbmxzLmxvY2FsaXplKCdkaXJ0eUNvdW50ZXInLCBcInswfSB1bnNhdmVkXCIsIGRpcnR5KTtcblx0XHRcdHRoaXMuZGlydHlDb3VudEVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXQgZWxlbWVudENvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmdyb3Vwcy5tYXAoZyA9PiBnLmNvdW50KVxuXHRcdFx0LnJlZHVjZSgoZmlyc3QsIHNlY29uZCkgPT4gZmlyc3QgKyBzZWNvbmQsIHRoaXMuc2hvd0dyb3VwcyA/IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmdyb3Vwcy5sZW5ndGggOiAwKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TWF4RXhwYW5kZWRCb2R5U2l6ZSgpOiBudW1iZXIge1xuXHRcdGxldCBtaW5WaXNpYmxlT3BlbkVkaXRvcnMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlcj4oJ2V4cGxvcmVyLm9wZW5FZGl0b3JzLm1pblZpc2libGUnKTtcblx0XHQvLyBJZiBpdCdzIG5vdCBhIG51bWJlciBzZXR0aW5nIGl0IHRvIDAgd2lsbCByZXN1bHQgaW4gZHluYW1pYyByZXNpemluZy5cblx0XHRpZiAodHlwZW9mIG1pblZpc2libGVPcGVuRWRpdG9ycyAhPT0gJ251bWJlcicpIHtcblx0XHRcdG1pblZpc2libGVPcGVuRWRpdG9ycyA9IE9wZW5FZGl0b3JzVmlldy5ERUZBVUxUX01JTl9WSVNJQkxFX09QRU5fRURJVE9SUztcblx0XHR9XG5cdFx0Y29uc3QgY29udGFpbmVyTW9kZWwgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwodGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKHRoaXMuaWQpISkhO1xuXHRcdGlmIChjb250YWluZXJNb2RlbC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCA8PSAxKSB7XG5cdFx0XHRyZXR1cm4gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuXHRcdH1cblxuXHRcdHJldHVybiAoTWF0aC5tYXgodGhpcy5lbGVtZW50Q291bnQsIG1pblZpc2libGVPcGVuRWRpdG9ycykpICogT3BlbkVkaXRvcnNEZWxlZ2F0ZS5JVEVNX0hFSUdIVDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TWluRXhwYW5kZWRCb2R5U2l6ZSgpOiBudW1iZXIge1xuXHRcdGxldCB2aXNpYmxlT3BlbkVkaXRvcnMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlcj4oJ2V4cGxvcmVyLm9wZW5FZGl0b3JzLnZpc2libGUnKTtcblx0XHRpZiAodHlwZW9mIHZpc2libGVPcGVuRWRpdG9ycyAhPT0gJ251bWJlcicpIHtcblx0XHRcdHZpc2libGVPcGVuRWRpdG9ycyA9IE9wZW5FZGl0b3JzVmlldy5ERUZBVUxUX1ZJU0lCTEVfT1BFTl9FRElUT1JTO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmNvbXB1dGVNaW5FeHBhbmRlZEJvZHlTaXplKHZpc2libGVPcGVuRWRpdG9ycyk7XG5cdH1cblxuXHRwcml2YXRlIGNvbXB1dGVNaW5FeHBhbmRlZEJvZHlTaXplKHZpc2libGVPcGVuRWRpdG9ycyA9IE9wZW5FZGl0b3JzVmlldy5ERUZBVUxUX1ZJU0lCTEVfT1BFTl9FRElUT1JTKTogbnVtYmVyIHtcblx0XHRjb25zdCBpdGVtc1RvU2hvdyA9IE1hdGgubWluKE1hdGgubWF4KHZpc2libGVPcGVuRWRpdG9ycywgMSksIHRoaXMuZWxlbWVudENvdW50KTtcblx0XHRyZXR1cm4gaXRlbXNUb1Nob3cgKiBPcGVuRWRpdG9yc0RlbGVnYXRlLklURU1fSEVJR0hUO1xuXHR9XG5cblx0c2V0U3RydWN0dXJhbFJlZnJlc2hEZWxheShkZWxheTogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5zdHJ1Y3R1cmFsUmVmcmVzaERlbGF5ID0gZGVsYXk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRPcHRpbWFsV2lkdGgoKTogbnVtYmVyIHtcblx0XHRpZiAoIXRoaXMubGlzdCkge1xuXHRcdFx0cmV0dXJuIHN1cGVyLmdldE9wdGltYWxXaWR0aCgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBhcmVudE5vZGUgPSB0aGlzLmxpc3QuZ2V0SFRNTEVsZW1lbnQoKTtcblx0XHRjb25zdCBjaGlsZE5vZGVzOiBIVE1MRWxlbWVudFtdID0gW10uc2xpY2UuY2FsbChwYXJlbnROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoJy5vcGVuLWVkaXRvciA+IGEnKSk7XG5cblx0XHRyZXR1cm4gZG9tLmdldExhcmdlc3RDaGlsZFdpZHRoKHBhcmVudE5vZGUsIGNoaWxkTm9kZXMpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJT3BlbkVkaXRvclRlbXBsYXRlRGF0YSB7XG5cdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHJvb3Q6IElSZXNvdXJjZUxhYmVsO1xuXHRhY3Rpb25CYXI6IEFjdGlvbkJhcjtcblx0YWN0aW9uUnVubmVyOiBPcGVuRWRpdG9yQWN0aW9uUnVubmVyO1xufVxuXG5pbnRlcmZhY2UgSUVkaXRvckdyb3VwVGVtcGxhdGVEYXRhIHtcblx0cm9vdDogSFRNTEVsZW1lbnQ7XG5cdG5hbWU6IEhUTUxTcGFuRWxlbWVudDtcblx0YWN0aW9uQmFyOiBBY3Rpb25CYXI7XG5cdGVkaXRvckdyb3VwOiBJRWRpdG9yR3JvdXA7XG59XG5cbmNsYXNzIE9wZW5FZGl0b3JBY3Rpb25SdW5uZXIgZXh0ZW5kcyBBY3Rpb25SdW5uZXIge1xuXHRwdWJsaWMgZWRpdG9yOiBPcGVuRWRpdG9yIHwgdW5kZWZpbmVkO1xuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY3Rpb246IElBY3Rpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN1cGVyLnJ1bihhY3Rpb24sIHsgZ3JvdXBJZDogdGhpcy5lZGl0b3IuZ3JvdXBJZCwgZWRpdG9ySW5kZXg6IHRoaXMuZWRpdG9yLmdyb3VwLmdldEluZGV4T2ZFZGl0b3IodGhpcy5lZGl0b3IuZWRpdG9yKSB9KTtcblx0fVxufVxuXG5jbGFzcyBPcGVuRWRpdG9yc0RlbGVnYXRlIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8T3BlbkVkaXRvciB8IElFZGl0b3JHcm91cD4ge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSVRFTV9IRUlHSFQgPSAyMjtcblxuXHRnZXRIZWlnaHQoX2VsZW1lbnQ6IE9wZW5FZGl0b3IgfCBJRWRpdG9yR3JvdXApOiBudW1iZXIge1xuXHRcdHJldHVybiBPcGVuRWRpdG9yc0RlbGVnYXRlLklURU1fSEVJR0hUO1xuXHR9XG5cblx0Z2V0VGVtcGxhdGVJZChlbGVtZW50OiBPcGVuRWRpdG9yIHwgSUVkaXRvckdyb3VwKTogc3RyaW5nIHtcblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIE9wZW5FZGl0b3IpIHtcblx0XHRcdHJldHVybiBPcGVuRWRpdG9yUmVuZGVyZXIuSUQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIEVkaXRvckdyb3VwUmVuZGVyZXIuSUQ7XG5cdH1cbn1cblxuY2xhc3MgRWRpdG9yR3JvdXBSZW5kZXJlciBpbXBsZW1lbnRzIElMaXN0UmVuZGVyZXI8SUVkaXRvckdyb3VwLCBJRWRpdG9yR3JvdXBUZW1wbGF0ZURhdGE+IHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ2VkaXRvcmdyb3VwJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHQvLyBub29wXG5cdH1cblxuXHRnZXQgdGVtcGxhdGVJZCgpIHtcblx0XHRyZXR1cm4gRWRpdG9yR3JvdXBSZW5kZXJlci5JRDtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJRWRpdG9yR3JvdXBUZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IGVkaXRvckdyb3VwVGVtcGxhdGU6IElFZGl0b3JHcm91cFRlbXBsYXRlRGF0YSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0ZWRpdG9yR3JvdXBUZW1wbGF0ZS5yb290ID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5lZGl0b3ItZ3JvdXAnKSk7XG5cdFx0ZWRpdG9yR3JvdXBUZW1wbGF0ZS5uYW1lID0gZG9tLmFwcGVuZChlZGl0b3JHcm91cFRlbXBsYXRlLnJvb3QsICQoJ3NwYW4ubmFtZScpKTtcblx0XHRlZGl0b3JHcm91cFRlbXBsYXRlLmFjdGlvbkJhciA9IG5ldyBBY3Rpb25CYXIoY29udGFpbmVyKTtcblxuXHRcdGNvbnN0IHNhdmVBbGxJbkdyb3VwQWN0aW9uID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTYXZlQWxsSW5Hcm91cEFjdGlvbiwgU2F2ZUFsbEluR3JvdXBBY3Rpb24uSUQsIFNhdmVBbGxJbkdyb3VwQWN0aW9uLkxBQkVMKTtcblx0XHRjb25zdCBzYXZlQWxsSW5Hcm91cEtleSA9IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhzYXZlQWxsSW5Hcm91cEFjdGlvbi5pZCk7XG5cdFx0ZWRpdG9yR3JvdXBUZW1wbGF0ZS5hY3Rpb25CYXIucHVzaChzYXZlQWxsSW5Hcm91cEFjdGlvbiwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UsIGtleWJpbmRpbmc6IHNhdmVBbGxJbkdyb3VwS2V5ID8gc2F2ZUFsbEluR3JvdXBLZXkuZ2V0TGFiZWwoKSA6IHVuZGVmaW5lZCB9KTtcblxuXHRcdGNvbnN0IGNsb3NlR3JvdXBBY3Rpb24gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENsb3NlR3JvdXBBY3Rpb24sIENsb3NlR3JvdXBBY3Rpb24uSUQsIENsb3NlR3JvdXBBY3Rpb24uTEFCRUwpO1xuXHRcdGNvbnN0IGNsb3NlR3JvdXBBY3Rpb25LZXkgPSB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoY2xvc2VHcm91cEFjdGlvbi5pZCk7XG5cdFx0ZWRpdG9yR3JvdXBUZW1wbGF0ZS5hY3Rpb25CYXIucHVzaChjbG9zZUdyb3VwQWN0aW9uLCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSwga2V5YmluZGluZzogY2xvc2VHcm91cEFjdGlvbktleSA/IGNsb3NlR3JvdXBBY3Rpb25LZXkuZ2V0TGFiZWwoKSA6IHVuZGVmaW5lZCB9KTtcblxuXHRcdHJldHVybiBlZGl0b3JHcm91cFRlbXBsYXRlO1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlZGl0b3JHcm91cDogSUVkaXRvckdyb3VwLCBfaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJRWRpdG9yR3JvdXBUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZWRpdG9yR3JvdXAgPSBlZGl0b3JHcm91cDtcblx0XHR0ZW1wbGF0ZURhdGEubmFtZS50ZXh0Q29udGVudCA9IGVkaXRvckdyb3VwLmxhYmVsO1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuY29udGV4dCA9IHsgZ3JvdXBJZDogZWRpdG9yR3JvdXAuaWQgfTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElFZGl0b3JHcm91cFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIE9wZW5FZGl0b3JSZW5kZXJlciBpbXBsZW1lbnRzIElMaXN0UmVuZGVyZXI8T3BlbkVkaXRvciwgSU9wZW5FZGl0b3JUZW1wbGF0ZURhdGE+IHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ29wZW5lZGl0b3InO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY2xvc2VFZGl0b3JBY3Rpb24gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENsb3NlRWRpdG9yQWN0aW9uLCBDbG9zZUVkaXRvckFjdGlvbi5JRCwgQ2xvc2VFZGl0b3JBY3Rpb24uTEFCRUwpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHVucGluRWRpdG9yQWN0aW9uID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShVbnBpbkVkaXRvckFjdGlvbiwgVW5waW5FZGl0b3JBY3Rpb24uSUQsIFVucGluRWRpdG9yQWN0aW9uLkxBQkVMKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIGxhYmVsczogUmVzb3VyY2VMYWJlbHMsXG5cdFx0cHJpdmF0ZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdHByaXZhdGUga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRwcml2YXRlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0Ly8gbm9vcFxuXHR9XG5cblx0Z2V0IHRlbXBsYXRlSWQoKSB7XG5cdFx0cmV0dXJuIE9wZW5FZGl0b3JSZW5kZXJlci5JRDtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJT3BlbkVkaXRvclRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgZWRpdG9yVGVtcGxhdGU6IElPcGVuRWRpdG9yVGVtcGxhdGVEYXRhID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRlZGl0b3JUZW1wbGF0ZS5jb250YWluZXIgPSBjb250YWluZXI7XG5cdFx0ZWRpdG9yVGVtcGxhdGUuYWN0aW9uUnVubmVyID0gbmV3IE9wZW5FZGl0b3JBY3Rpb25SdW5uZXIoKTtcblx0XHRlZGl0b3JUZW1wbGF0ZS5hY3Rpb25CYXIgPSBuZXcgQWN0aW9uQmFyKGNvbnRhaW5lciwgeyBhY3Rpb25SdW5uZXI6IGVkaXRvclRlbXBsYXRlLmFjdGlvblJ1bm5lciB9KTtcblx0XHRlZGl0b3JUZW1wbGF0ZS5yb290ID0gdGhpcy5sYWJlbHMuY3JlYXRlKGNvbnRhaW5lcik7XG5cblx0XHRyZXR1cm4gZWRpdG9yVGVtcGxhdGU7XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KG9wZW5lZEVkaXRvcjogT3BlbkVkaXRvciwgX2luZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSU9wZW5FZGl0b3JUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHRjb25zdCBlZGl0b3IgPSBvcGVuZWRFZGl0b3IuZWRpdG9yO1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25SdW5uZXIuZWRpdG9yID0gb3BlbmVkRWRpdG9yO1xuXHRcdHRlbXBsYXRlRGF0YS5jb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnZGlydHknLCBlZGl0b3IuaXNEaXJ0eSgpICYmICFlZGl0b3IuaXNTYXZpbmcoKSk7XG5cdFx0dGVtcGxhdGVEYXRhLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdzdGlja3knLCBvcGVuZWRFZGl0b3IuaXNTdGlja3koKSk7XG5cdFx0dGVtcGxhdGVEYXRhLnJvb3Quc2V0UmVzb3VyY2Uoe1xuXHRcdFx0cmVzb3VyY2U6IEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0T3JpZ2luYWxVcmkoZWRpdG9yLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkJPVEggfSksXG5cdFx0XHRuYW1lOiBlZGl0b3IuZ2V0TmFtZSgpLFxuXHRcdFx0ZGVzY3JpcHRpb246IGVkaXRvci5nZXREZXNjcmlwdGlvbihWZXJib3NpdHkuTUVESVVNKVxuXHRcdH0sIHtcblx0XHRcdGl0YWxpYzogb3BlbmVkRWRpdG9yLmlzUHJldmlldygpLFxuXHRcdFx0ZXh0cmFDbGFzc2VzOiBbJ29wZW4tZWRpdG9yJ10uY29uY2F0KG9wZW5lZEVkaXRvci5lZGl0b3IuZ2V0TGFiZWxFeHRyYUNsYXNzZXMoKSksXG5cdFx0XHRmaWxlRGVjb3JhdGlvbnM6IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SUZpbGVzQ29uZmlndXJhdGlvbj4oKS5leHBsb3Jlci5kZWNvcmF0aW9ucyxcblx0XHRcdHRpdGxlOiBlZGl0b3IuZ2V0VGl0bGUoVmVyYm9zaXR5LkxPTkcpLFxuXHRcdFx0aWNvbjogZWRpdG9yLmdldEljb24oKVxuXHRcdH0pO1xuXHRcdGNvbnN0IGVkaXRvckFjdGlvbiA9IG9wZW5lZEVkaXRvci5pc1N0aWNreSgpID8gdGhpcy51bnBpbkVkaXRvckFjdGlvbiA6IHRoaXMuY2xvc2VFZGl0b3JBY3Rpb247XG5cdFx0aWYgKCF0ZW1wbGF0ZURhdGEuYWN0aW9uQmFyLmhhc0FjdGlvbihlZGl0b3JBY3Rpb24pKSB7XG5cdFx0XHRpZiAoIXRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuaXNFbXB0eSgpKSB7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuY2xlYXIoKTtcblx0XHRcdH1cblx0XHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIucHVzaChlZGl0b3JBY3Rpb24sIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlLCBrZXliaW5kaW5nOiB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoZWRpdG9yQWN0aW9uLmlkKT8uZ2V0TGFiZWwoKSB9KTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJT3BlbkVkaXRvclRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuZGlzcG9zZSgpO1xuXHRcdHRlbXBsYXRlRGF0YS5yb290LmRpc3Bvc2UoKTtcblx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9uUnVubmVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBPcGVuRWRpdG9yc0RyYWdBbmREcm9wIGltcGxlbWVudHMgSUxpc3REcmFnQW5kRHJvcDxPcGVuRWRpdG9yIHwgSUVkaXRvckdyb3VwPiB7XG5cblx0cHJpdmF0ZSBfc29ydE9yZGVyOiAnZWRpdG9yT3JkZXInIHwgJ2FscGhhYmV0aWNhbCcgfCAnZnVsbFBhdGgnO1xuXHRwdWJsaWMgc2V0IHNvcnRPcmRlcih2YWx1ZTogJ2VkaXRvck9yZGVyJyB8ICdhbHBoYWJldGljYWwnIHwgJ2Z1bGxQYXRoJykge1xuXHRcdHRoaXMuX3NvcnRPcmRlciA9IHZhbHVlO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0c29ydE9yZGVyOiAnZWRpdG9yT3JkZXInIHwgJ2FscGhhYmV0aWNhbCcgfCAnZnVsbFBhdGgnLFxuXHRcdHByaXZhdGUgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRwcml2YXRlIGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5fc29ydE9yZGVyID0gc29ydE9yZGVyO1xuXHR9XG5cblx0QG1lbW9pemUgcHJpdmF0ZSBnZXQgZHJvcEhhbmRsZXIoKTogUmVzb3VyY2VzRHJvcEhhbmRsZXIge1xuXHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlc291cmNlc0Ryb3BIYW5kbGVyLCB7IGFsbG93V29ya3NwYWNlT3BlbjogZmFsc2UgfSk7XG5cdH1cblxuXHRnZXREcmFnVVJJKGVsZW1lbnQ6IE9wZW5FZGl0b3IgfCBJRWRpdG9yR3JvdXApOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIE9wZW5FZGl0b3IpIHtcblx0XHRcdGNvbnN0IHJlc291cmNlID0gZWxlbWVudC5nZXRSZXNvdXJjZSgpO1xuXHRcdFx0aWYgKHJlc291cmNlKSB7XG5cdFx0XHRcdHJldHVybiByZXNvdXJjZS50b1N0cmluZygpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGdldERyYWdMYWJlbD8oZWxlbWVudHM6IChPcGVuRWRpdG9yIHwgSUVkaXRvckdyb3VwKVtdKTogc3RyaW5nIHtcblx0XHRpZiAoZWxlbWVudHMubGVuZ3RoID4gMSkge1xuXHRcdFx0cmV0dXJuIFN0cmluZyhlbGVtZW50cy5sZW5ndGgpO1xuXHRcdH1cblx0XHRjb25zdCBlbGVtZW50ID0gZWxlbWVudHNbMF07XG5cblx0XHRyZXR1cm4gZWxlbWVudCBpbnN0YW5jZW9mIE9wZW5FZGl0b3IgPyBlbGVtZW50LmVkaXRvci5nZXROYW1lKCkgOiBlbGVtZW50LmxhYmVsO1xuXHR9XG5cblx0b25EcmFnU3RhcnQoZGF0YTogSURyYWdBbmREcm9wRGF0YSwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgaXRlbXMgPSAoZGF0YSBhcyBFbGVtZW50c0RyYWdBbmREcm9wRGF0YTxPcGVuRWRpdG9yIHwgSUVkaXRvckdyb3VwPikuZWxlbWVudHM7XG5cdFx0Y29uc3QgZWRpdG9yczogSUVkaXRvcklkZW50aWZpZXJbXSA9IFtdO1xuXHRcdGlmIChpdGVtcykge1xuXHRcdFx0Zm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG5cdFx0XHRcdGlmIChpdGVtIGluc3RhbmNlb2YgT3BlbkVkaXRvcikge1xuXHRcdFx0XHRcdGVkaXRvcnMucHVzaChpdGVtKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChlZGl0b3JzLmxlbmd0aCkge1xuXHRcdFx0Ly8gQXBwbHkgc29tZSBkYXRhdHJhbnNmZXIgdHlwZXMgdG8gYWxsb3cgZm9yIGRyYWdnaW5nIHRoZSBlbGVtZW50IG91dHNpZGUgb2YgdGhlIGFwcGxpY2F0aW9uXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZpbGxFZGl0b3JzRHJhZ0RhdGEsIGVkaXRvcnMsIG9yaWdpbmFsRXZlbnQpO1xuXHRcdH1cblx0fVxuXG5cdG9uRHJhZ092ZXIoZGF0YTogSURyYWdBbmREcm9wRGF0YSwgX3RhcmdldEVsZW1lbnQ6IE9wZW5FZGl0b3IgfCBJRWRpdG9yR3JvdXAsIF90YXJnZXRJbmRleDogbnVtYmVyLCB0YXJnZXRTZWN0b3I6IExpc3RWaWV3VGFyZ2V0U2VjdG9yIHwgdW5kZWZpbmVkLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiBib29sZWFuIHwgSUxpc3REcmFnT3ZlclJlYWN0aW9uIHtcblx0XHRpZiAoZGF0YSBpbnN0YW5jZW9mIE5hdGl2ZURyYWdBbmREcm9wRGF0YSkge1xuXHRcdFx0aWYgKCFjb250YWluc0RyYWdUeXBlKG9yaWdpbmFsRXZlbnQsIERhdGFUcmFuc2ZlcnMuRklMRVMsIENvZGVEYXRhVHJhbnNmZXJzLkZJTEVTKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3NvcnRPcmRlciAhPT0gJ2VkaXRvck9yZGVyJykge1xuXHRcdFx0aWYgKGRhdGEgaW5zdGFuY2VvZiBFbGVtZW50c0RyYWdBbmREcm9wRGF0YSkge1xuXHRcdFx0XHQvLyBObyByZW9yZGVyaW5nIHN1cHBvcnRlZCB3aGVuIHNvcnRlZFxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBBbGxvdyBkcm9waW5nIGZpbGVzIHRvIG9wZW4gdGhlbVxuXHRcdFx0XHRyZXR1cm4geyBhY2NlcHQ6IHRydWUsIGVmZmVjdDogeyB0eXBlOiBMaXN0RHJhZ092ZXJFZmZlY3RUeXBlLk1vdmUgfSwgZmVlZGJhY2s6IFstMV0gfTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgZHJvcEVmZmVjdFBvc2l0aW9uOiBMaXN0RHJhZ092ZXJFZmZlY3RQb3NpdGlvbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRzd2l0Y2ggKHRhcmdldFNlY3Rvcikge1xuXHRcdFx0Y2FzZSBMaXN0Vmlld1RhcmdldFNlY3Rvci5UT1A6XG5cdFx0XHRjYXNlIExpc3RWaWV3VGFyZ2V0U2VjdG9yLkNFTlRFUl9UT1A6XG5cdFx0XHRcdGRyb3BFZmZlY3RQb3NpdGlvbiA9IChfdGFyZ2V0SW5kZXggPT09IDAgJiYgX3RhcmdldEVsZW1lbnQgaW5zdGFuY2VvZiBFZGl0b3JHcm91cFZpZXcpID8gTGlzdERyYWdPdmVyRWZmZWN0UG9zaXRpb24uQWZ0ZXIgOiBMaXN0RHJhZ092ZXJFZmZlY3RQb3NpdGlvbi5CZWZvcmU7IGJyZWFrO1xuXHRcdFx0Y2FzZSBMaXN0Vmlld1RhcmdldFNlY3Rvci5DRU5URVJfQk9UVE9NOlxuXHRcdFx0Y2FzZSBMaXN0Vmlld1RhcmdldFNlY3Rvci5CT1RUT006XG5cdFx0XHRcdGRyb3BFZmZlY3RQb3NpdGlvbiA9IExpc3REcmFnT3ZlckVmZmVjdFBvc2l0aW9uLkFmdGVyOyBicmVhaztcblx0XHR9XG5cblx0XHRyZXR1cm4geyBhY2NlcHQ6IHRydWUsIGVmZmVjdDogeyB0eXBlOiBMaXN0RHJhZ092ZXJFZmZlY3RUeXBlLk1vdmUsIHBvc2l0aW9uOiBkcm9wRWZmZWN0UG9zaXRpb24gfSwgZmVlZGJhY2s6IFtfdGFyZ2V0SW5kZXhdIH07XG5cdH1cblxuXHRkcm9wKGRhdGE6IElEcmFnQW5kRHJvcERhdGEsIHRhcmdldEVsZW1lbnQ6IE9wZW5FZGl0b3IgfCBJRWRpdG9yR3JvdXAgfCB1bmRlZmluZWQsIF90YXJnZXRJbmRleDogbnVtYmVyLCB0YXJnZXRTZWN0b3I6IExpc3RWaWV3VGFyZ2V0U2VjdG9yIHwgdW5kZWZpbmVkLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcblx0XHRsZXQgZ3JvdXAgPSB0YXJnZXRFbGVtZW50IGluc3RhbmNlb2YgT3BlbkVkaXRvciA/IHRhcmdldEVsZW1lbnQuZ3JvdXAgOiB0YXJnZXRFbGVtZW50IHx8IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmdyb3Vwc1t0aGlzLmVkaXRvckdyb3VwU2VydmljZS5jb3VudCAtIDFdO1xuXHRcdGxldCB0YXJnZXRFZGl0b3JJbmRleCA9IHRhcmdldEVsZW1lbnQgaW5zdGFuY2VvZiBPcGVuRWRpdG9yID8gdGFyZ2V0RWxlbWVudC5ncm91cC5nZXRJbmRleE9mRWRpdG9yKHRhcmdldEVsZW1lbnQuZWRpdG9yKSA6IDA7XG5cblx0XHRzd2l0Y2ggKHRhcmdldFNlY3Rvcikge1xuXHRcdFx0Y2FzZSBMaXN0Vmlld1RhcmdldFNlY3Rvci5UT1A6XG5cdFx0XHRjYXNlIExpc3RWaWV3VGFyZ2V0U2VjdG9yLkNFTlRFUl9UT1A6XG5cdFx0XHRcdGlmICh0YXJnZXRFbGVtZW50IGluc3RhbmNlb2YgRWRpdG9yR3JvdXBWaWV3ICYmIGdyb3VwLmluZGV4ICE9PSAwKSB7XG5cdFx0XHRcdFx0Z3JvdXAgPSB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5ncm91cHNbZ3JvdXAuaW5kZXggLSAxXTtcblx0XHRcdFx0XHR0YXJnZXRFZGl0b3JJbmRleCA9IGdyb3VwLmNvdW50O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBMaXN0Vmlld1RhcmdldFNlY3Rvci5CT1RUT006XG5cdFx0XHRjYXNlIExpc3RWaWV3VGFyZ2V0U2VjdG9yLkNFTlRFUl9CT1RUT006XG5cdFx0XHRcdGlmICh0YXJnZXRFbGVtZW50IGluc3RhbmNlb2YgT3BlbkVkaXRvcikge1xuXHRcdFx0XHRcdHRhcmdldEVkaXRvckluZGV4Kys7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0aWYgKGRhdGEgaW5zdGFuY2VvZiBFbGVtZW50c0RyYWdBbmREcm9wRGF0YSkge1xuXHRcdFx0Zm9yIChjb25zdCBvZSBvZiBkYXRhLmVsZW1lbnRzKSB7XG5cdFx0XHRcdGNvbnN0IHNvdXJjZUVkaXRvckluZGV4ID0gb2UuZ3JvdXAuZ2V0SW5kZXhPZkVkaXRvcihvZS5lZGl0b3IpO1xuXHRcdFx0XHRpZiAob2UuZ3JvdXAgPT09IGdyb3VwICYmIHNvdXJjZUVkaXRvckluZGV4IDwgdGFyZ2V0RWRpdG9ySW5kZXgpIHtcblx0XHRcdFx0XHR0YXJnZXRFZGl0b3JJbmRleC0tO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG9lLmdyb3VwLm1vdmVFZGl0b3Iob2UuZWRpdG9yLCBncm91cCwgeyBpbmRleDogdGFyZ2V0RWRpdG9ySW5kZXgsIHByZXNlcnZlRm9jdXM6IHRydWUgfSk7XG5cdFx0XHRcdHRhcmdldEVkaXRvckluZGV4Kys7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmVkaXRvckdyb3VwU2VydmljZS5hY3RpdmF0ZUdyb3VwKGdyb3VwKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5kcm9wSGFuZGxlci5oYW5kbGVEcm9wKG9yaWdpbmFsRXZlbnQsIG1haW5XaW5kb3csICgpID0+IGdyb3VwLCAoKSA9PiBncm91cC5mb2N1cygpLCB7IGluZGV4OiB0YXJnZXRFZGl0b3JJbmRleCB9KTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQgeyB9XG59XG5cbmNsYXNzIE9wZW5FZGl0b3JzQWNjZXNzaWJpbGl0eVByb3ZpZGVyIGltcGxlbWVudHMgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8T3BlbkVkaXRvciB8IElFZGl0b3JHcm91cD4ge1xuXG5cdGdldFdpZGdldEFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBubHMubG9jYWxpemUoJ29wZW5FZGl0b3JzJywgXCJPcGVuIEVkaXRvcnNcIik7XG5cdH1cblxuXHRnZXRBcmlhTGFiZWwoZWxlbWVudDogT3BlbkVkaXRvciB8IElFZGl0b3JHcm91cCk6IHN0cmluZyB8IG51bGwge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgT3BlbkVkaXRvcikge1xuXHRcdFx0cmV0dXJuIGAke2VsZW1lbnQuZWRpdG9yLmdldE5hbWUoKX0sICR7ZWxlbWVudC5lZGl0b3IuZ2V0RGVzY3JpcHRpb24oKX1gO1xuXHRcdH1cblxuXHRcdHJldHVybiBlbGVtZW50LmFyaWFMYWJlbDtcblx0fVxufVxuXG5jb25zdCB0b2dnbGVFZGl0b3JHcm91cExheW91dElkID0gJ3dvcmtiZW5jaC5hY3Rpb24udG9nZ2xlRWRpdG9yR3JvdXBMYXlvdXQnO1xucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVFZGl0b3JHcm91cExheW91dCcsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignZmxpcExheW91dCcsIFwiVG9nZ2xlIFZlcnRpY2FsL0hvcml6b250YWwgRWRpdG9yIExheW91dFwiKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuU2hpZnQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5EaWdpdDAsXG5cdFx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLkRpZ2l0MCB9LFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHRcdFx0fSxcblx0XHRcdGljb246IENvZGljb24uZWRpdG9yTGF5b3V0LFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIE9wZW5FZGl0b3JzVmlldy5JRCksIE11bHRpcGxlRWRpdG9yR3JvdXBzQ29udGV4dCksXG5cdFx0XHRcdG9yZGVyOiAxMFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRjb25zdCBuZXdPcmllbnRhdGlvbiA9IChlZGl0b3JHcm91cFNlcnZpY2Uub3JpZW50YXRpb24gPT09IEdyb3VwT3JpZW50YXRpb24uVkVSVElDQUwpID8gR3JvdXBPcmllbnRhdGlvbi5IT1JJWk9OVEFMIDogR3JvdXBPcmllbnRhdGlvbi5WRVJUSUNBTDtcblx0XHRlZGl0b3JHcm91cFNlcnZpY2Uuc2V0R3JvdXBPcmllbnRhdGlvbihuZXdPcmllbnRhdGlvbik7XG5cdFx0ZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwLmZvY3VzKCk7XG5cdH1cbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJMYXlvdXRNZW51LCB7XG5cdGdyb3VwOiAnNV9mbGlwJyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiB0b2dnbGVFZGl0b3JHcm91cExheW91dElkLFxuXHRcdHRpdGxlOiB7XG5cdFx0XHQuLi5ubHMubG9jYWxpemUyKCdtaVRvZ2dsZUVkaXRvckxheW91dFdpdGhvdXRNbmVtb25pYycsIFwiRmxpcCBMYXlvdXRcIiksXG5cdFx0XHRtbmVtb25pY1RpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaVRvZ2dsZUVkaXRvckxheW91dCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJGbGlwICYmTGF5b3V0XCIpXG5cdFx0fVxuXHR9LFxuXHRvcmRlcjogMVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZmlsZXMuc2F2ZUFsbCcsXG5cdFx0XHR0aXRsZTogU0FWRV9BTExfTEFCRUwsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGljb246IENvZGljb24uc2F2ZUFsbCxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIE9wZW5FZGl0b3JzVmlldy5JRCksXG5cdFx0XHRcdG9yZGVyOiAyMFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblx0XHRhd2FpdCBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChTQVZFX0FMTF9DT01NQU5EX0lEKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ29wZW5FZGl0b3JzLmNsb3NlQWxsJyxcblx0XHRcdHRpdGxlOiBDbG9zZUFsbEVkaXRvcnNBY3Rpb24uTEFCRUwsXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRpY29uOiBDb2RpY29uLmNsb3NlQWxsLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgT3BlbkVkaXRvcnNWaWV3LklEKSxcblx0XHRcdFx0b3JkZXI6IDMwXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgY2xvc2VBbGwgPSBuZXcgQ2xvc2VBbGxFZGl0b3JzQWN0aW9uKCk7XG5cdFx0YXdhaXQgaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gY2xvc2VBbGwucnVuKGFjY2Vzc29yKSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdvcGVuRWRpdG9ycy5uZXdVbnRpdGxlZEZpbGUnLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ25ld1VudGl0bGVkRmlsZScsIFwiTmV3IFVudGl0bGVkIFRleHQgRmlsZVwiKSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdGljb246IENvZGljb24ubmV3RmlsZSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIE9wZW5FZGl0b3JzVmlldy5JRCksXG5cdFx0XHRcdG9yZGVyOiA1XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdGF3YWl0IGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKE5FV19VTlRJVExFRF9GSUxFX0NPTU1BTkRfSUQpO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFlBQVksU0FBUztBQUNyQixTQUFTLHdCQUF3QjtBQUNqQyxTQUFrQixvQkFBeUY7QUFDM0csWUFBWSxTQUFTO0FBQ3JCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsNkJBQStDO0FBQ3hELFNBQVMsc0JBQW9DLGFBQWEsd0JBQXdCO0FBQ2xGLFNBQVMsNkJBQXdEO0FBQ2pFLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsV0FBVyx3QkFBd0Isa0JBQXFDLHNCQUFzQixvQkFBb0IseUJBQXlCO0FBRXBKLFNBQVMsc0JBQXNCLHdCQUF3QjtBQUN2RCxTQUFTLDJCQUEyQix3QkFBNkMsa0JBQWtCO0FBQ25HLFNBQVMsdUJBQXVCLG1CQUFtQix5QkFBeUI7QUFDNUUsU0FBUyxvQkFBb0Isc0JBQXNCO0FBQ25ELFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZUFBZSxpQkFBaUIsaUJBQWlCLHNCQUFzQjtBQUNoRixTQUFTLHFCQUFxQjtBQUM5QixTQUE4Ryw0QkFBNEIsOEJBQThCO0FBQ3hLLFNBQVMsc0JBQXNDO0FBQy9DLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMseUJBQXlCO0FBQ2xD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
