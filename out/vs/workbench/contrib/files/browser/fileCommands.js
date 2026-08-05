import * as nls from "../../../../nls.js";
import { EditorResourceAccessor, SideBySideEditor, SaveReason, EditorsOrder, EditorInputCapabilities } from "../../../common/editor.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { isWorkspaceToOpen } from "../../../../platform/window/common/window.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IWorkspaceContextService, UNTITLED_WORKSPACE_NAME } from "../../../../platform/workspace/common/workspace.js";
import { ExplorerFocusCondition, TextFileContentProvider, VIEWLET_ID, ExplorerCompressedFocusContext, ExplorerCompressedFirstFocusContext, ExplorerCompressedLastFocusContext, FilesExplorerFocusCondition, ExplorerFolderContext, VIEW_ID } from "../common/files.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { IContextKeyService, ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyMod, KeyCode, KeyChord } from "../../../../base/common/keyCodes.js";
import { isWeb, isWindows } from "../../../../base/common/platform.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { getResourceForCommand, getMultiSelectedResources, getOpenEditorsViewMultiSelection, IExplorerService } from "./files.js";
import { IWorkspaceEditingService } from "../../../services/workspaces/common/workspaceEditing.js";
import { resolveCommandsContext } from "../../../browser/parts/editor/editorCommandsContext.js";
import { Schemas } from "../../../../base/common/network.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { IEditorGroupsService, GroupsOrder } from "../../../services/editor/common/editorGroupsService.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { basename, joinPath, isEqual } from "../../../../base/common/resources.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { EmbeddedCodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { toAction } from "../../../../base/common/actions.js";
import { EditorOpenSource, EditorResolution } from "../../../../platform/editor/common/editor.js";
import { hash } from "../../../../base/common/hash.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { ViewContainerLocation } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { OPEN_TO_SIDE_COMMAND_ID, COMPARE_WITH_SAVED_COMMAND_ID, SELECT_FOR_COMPARE_COMMAND_ID, ResourceSelectedForCompareContext, COMPARE_SELECTED_COMMAND_ID, COMPARE_RESOURCE_COMMAND_ID, COPY_PATH_COMMAND_ID, COPY_RELATIVE_PATH_COMMAND_ID, REVEAL_IN_EXPLORER_COMMAND_ID, OPEN_WITH_EXPLORER_COMMAND_ID, SAVE_FILE_COMMAND_ID, SAVE_FILE_WITHOUT_FORMATTING_COMMAND_ID, SAVE_FILE_AS_COMMAND_ID, SAVE_ALL_COMMAND_ID, SAVE_ALL_IN_GROUP_COMMAND_ID, SAVE_FILES_COMMAND_ID, REVERT_FILE_COMMAND_ID, REMOVE_ROOT_FOLDER_COMMAND_ID, PREVIOUS_COMPRESSED_FOLDER, NEXT_COMPRESSED_FOLDER, FIRST_COMPRESSED_FOLDER, LAST_COMPRESSED_FOLDER, NEW_UNTITLED_FILE_COMMAND_ID, NEW_UNTITLED_FILE_LABEL, NEW_FILE_COMMAND_ID } from "./fileConstants.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { RemoveRootFolderAction } from "../../../browser/actions/workspaceActions.js";
import { OpenEditorsView } from "./views/openEditorsView.js";
import { IListService } from "../../../../platform/list/browser/listService.js";
const openWindowCommand = (accessor, toOpen, options) => {
  if (Array.isArray(toOpen)) {
    const hostService = accessor.get(IHostService);
    const environmentService = accessor.get(IEnvironmentService);
    toOpen = toOpen.map((openable) => {
      if (isWorkspaceToOpen(openable) && openable.workspaceUri.scheme === Schemas.untitled) {
        return {
          workspaceUri: joinPath(environmentService.untitledWorkspacesHome, openable.workspaceUri.path, UNTITLED_WORKSPACE_NAME)
        };
      }
      return openable;
    });
    hostService.openWindow(toOpen, options);
  }
};
const newWindowCommand = (accessor, options) => {
  const hostService = accessor.get(IHostService);
  hostService.openWindow(options);
};
KeybindingsRegistry.registerCommandAndKeybindingRule({
  weight: KeybindingWeight.WorkbenchContrib,
  when: ExplorerFocusCondition,
  primary: KeyMod.CtrlCmd | KeyCode.Enter,
  mac: {
    primary: KeyMod.WinCtrl | KeyCode.Enter
  },
  id: OPEN_TO_SIDE_COMMAND_ID,
  handler: async (accessor, resource) => {
    const editorService = accessor.get(IEditorService);
    const fileService = accessor.get(IFileService);
    const explorerService = accessor.get(IExplorerService);
    const resources = getMultiSelectedResources(resource, accessor.get(IListService), editorService, accessor.get(IEditorGroupsService), explorerService);
    if (resources.length) {
      const untitledResources = resources.filter((resource2) => resource2.scheme === Schemas.untitled);
      const fileResources = resources.filter((resource2) => resource2.scheme !== Schemas.untitled);
      const items = await Promise.all(fileResources.map(async (resource2) => {
        const item = explorerService.findClosest(resource2);
        if (item) {
          return item;
        }
        return await fileService.stat(resource2);
      }));
      const files = items.filter((i) => !i.isDirectory);
      const editors = files.map((f) => ({
        resource: f.resource,
        options: { pinned: true }
      })).concat(...untitledResources.map((untitledResource) => ({ resource: untitledResource, options: { pinned: true } })));
      await editorService.openEditors(editors, SIDE_GROUP);
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  weight: KeybindingWeight.WorkbenchContrib + 10,
  when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerFolderContext.toNegated()),
  primary: KeyCode.Enter,
  mac: {
    primary: KeyMod.CtrlCmd | KeyCode.DownArrow
  },
  id: "explorer.openAndPassFocus",
  handler: async (accessor, _resource) => {
    const editorService = accessor.get(IEditorService);
    const explorerService = accessor.get(IExplorerService);
    const resources = explorerService.getContext(true);
    if (resources.length) {
      await editorService.openEditors(resources.map((r) => ({ resource: r.resource, options: { preserveFocus: false, pinned: true } })));
    }
  }
});
const COMPARE_WITH_SAVED_SCHEMA = "showModifications";
let providerDisposables = [];
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: COMPARE_WITH_SAVED_COMMAND_ID,
  when: void 0,
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyD),
  handler: async (accessor, resource) => {
    const instantiationService = accessor.get(IInstantiationService);
    const textModelService = accessor.get(ITextModelService);
    const editorService = accessor.get(IEditorService);
    const fileService = accessor.get(IFileService);
    const listService = accessor.get(IListService);
    let registerEditorListener = false;
    if (providerDisposables.length === 0) {
      registerEditorListener = true;
      const provider = instantiationService.createInstance(TextFileContentProvider);
      providerDisposables.push(provider);
      providerDisposables.push(textModelService.registerTextModelContentProvider(COMPARE_WITH_SAVED_SCHEMA, provider));
    }
    const uri = getResourceForCommand(resource, editorService, listService);
    if (uri && fileService.hasProvider(uri)) {
      const name = basename(uri);
      const editorLabel = nls.localize("modifiedLabel", "{0} (in file) \u2194 {1}", name, name);
      try {
        await TextFileContentProvider.open(uri, COMPARE_WITH_SAVED_SCHEMA, editorLabel, editorService, { pinned: true });
        if (registerEditorListener) {
          providerDisposables.push(editorService.onDidVisibleEditorsChange(() => {
            if (!editorService.editors.some((editor) => !!EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.SECONDARY, filterByScheme: COMPARE_WITH_SAVED_SCHEMA }))) {
              providerDisposables = dispose(providerDisposables);
            }
          }));
        }
      } catch {
        providerDisposables = dispose(providerDisposables);
      }
    }
  }
});
let globalResourceToCompare;
let resourceSelectedForCompareContext;
CommandsRegistry.registerCommand({
  id: SELECT_FOR_COMPARE_COMMAND_ID,
  handler: (accessor, resource) => {
    globalResourceToCompare = getResourceForCommand(resource, accessor.get(IEditorService), accessor.get(IListService));
    if (!resourceSelectedForCompareContext) {
      resourceSelectedForCompareContext = ResourceSelectedForCompareContext.bindTo(accessor.get(IContextKeyService));
    }
    resourceSelectedForCompareContext.set(true);
  }
});
CommandsRegistry.registerCommand({
  id: COMPARE_SELECTED_COMMAND_ID,
  handler: async (accessor, resource) => {
    const editorService = accessor.get(IEditorService);
    const resources = getMultiSelectedResources(resource, accessor.get(IListService), editorService, accessor.get(IEditorGroupsService), accessor.get(IExplorerService));
    if (resources.length === 2) {
      return editorService.openEditor({
        original: { resource: resources[0] },
        modified: { resource: resources[1] },
        options: { pinned: true }
      });
    }
    return true;
  }
});
CommandsRegistry.registerCommand({
  id: COMPARE_RESOURCE_COMMAND_ID,
  handler: (accessor, resource) => {
    const editorService = accessor.get(IEditorService);
    const rightResource = getResourceForCommand(resource, editorService, accessor.get(IListService));
    if (globalResourceToCompare && rightResource) {
      editorService.openEditor({
        original: { resource: globalResourceToCompare },
        modified: { resource: rightResource },
        options: { pinned: true }
      });
    }
  }
});
async function resourcesToClipboard(resources, relative, clipboardService, labelService, configurationService) {
  if (resources.length) {
    const lineDelimiter = isWindows ? "\r\n" : "\n";
    let separator = void 0;
    const copyRelativeOrFullPathSeparatorSection = relative ? "explorer.copyRelativePathSeparator" : "explorer.copyPathSeparator";
    const copyRelativeOrFullPathSeparator = configurationService.getValue(copyRelativeOrFullPathSeparatorSection);
    if (copyRelativeOrFullPathSeparator === "/" || copyRelativeOrFullPathSeparator === "\\") {
      separator = copyRelativeOrFullPathSeparator;
    }
    const text = resources.map((resource) => labelService.getUriLabel(resource, { relative, noPrefix: true, separator })).join(lineDelimiter);
    await clipboardService.writeText(text);
  }
}
const copyPathCommandHandler = async (accessor, resource) => {
  const resources = getMultiSelectedResources(resource, accessor.get(IListService), accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IExplorerService));
  await resourcesToClipboard(resources, false, accessor.get(IClipboardService), accessor.get(ILabelService), accessor.get(IConfigurationService));
};
KeybindingsRegistry.registerCommandAndKeybindingRule({
  weight: KeybindingWeight.WorkbenchContrib,
  when: EditorContextKeys.focus.toNegated(),
  primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyC,
  win: {
    primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyC
  },
  id: COPY_PATH_COMMAND_ID,
  handler: copyPathCommandHandler
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  weight: KeybindingWeight.WorkbenchContrib,
  when: EditorContextKeys.focus,
  primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyC),
  win: {
    primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyC
  },
  id: COPY_PATH_COMMAND_ID,
  handler: copyPathCommandHandler
});
const copyRelativePathCommandHandler = async (accessor, resource) => {
  const resources = getMultiSelectedResources(resource, accessor.get(IListService), accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IExplorerService));
  await resourcesToClipboard(resources, true, accessor.get(IClipboardService), accessor.get(ILabelService), accessor.get(IConfigurationService));
};
KeybindingsRegistry.registerCommandAndKeybindingRule({
  weight: KeybindingWeight.WorkbenchContrib,
  when: EditorContextKeys.focus.toNegated(),
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.KeyC,
  win: {
    primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC)
  },
  id: COPY_RELATIVE_PATH_COMMAND_ID,
  handler: copyRelativePathCommandHandler
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  weight: KeybindingWeight.WorkbenchContrib,
  when: EditorContextKeys.focus,
  primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.KeyC),
  win: {
    primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC)
  },
  id: COPY_RELATIVE_PATH_COMMAND_ID,
  handler: copyRelativePathCommandHandler
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  weight: KeybindingWeight.WorkbenchContrib,
  when: void 0,
  primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyP),
  id: "workbench.action.files.copyPathOfActiveFile",
  handler: async (accessor) => {
    const editorService = accessor.get(IEditorService);
    const activeInput = editorService.activeEditor;
    const resource = EditorResourceAccessor.getOriginalUri(activeInput, { supportSideBySide: SideBySideEditor.PRIMARY });
    const resources = resource ? [resource] : [];
    await resourcesToClipboard(resources, false, accessor.get(IClipboardService), accessor.get(ILabelService), accessor.get(IConfigurationService));
  }
});
CommandsRegistry.registerCommand({
  id: REVEAL_IN_EXPLORER_COMMAND_ID,
  handler: async (accessor, resource) => {
    const viewService = accessor.get(IViewsService);
    const contextService = accessor.get(IWorkspaceContextService);
    const explorerService = accessor.get(IExplorerService);
    const editorService = accessor.get(IEditorService);
    const listService = accessor.get(IListService);
    const uri = getResourceForCommand(resource, editorService, listService);
    if (uri && contextService.isInsideWorkspace(uri)) {
      const explorerView = await viewService.openView(VIEW_ID, false);
      if (explorerView) {
        const oldAutoReveal = explorerView.autoReveal;
        explorerView.autoReveal = false;
        explorerView.setExpanded(true);
        await explorerService.select(uri, "force");
        explorerView.focus();
        explorerView.autoReveal = oldAutoReveal;
      }
    } else {
      const openEditorsView = viewService.getViewWithId(OpenEditorsView.ID);
      if (openEditorsView) {
        openEditorsView.setExpanded(true);
        openEditorsView.focus();
      }
    }
  }
});
CommandsRegistry.registerCommand({
  id: OPEN_WITH_EXPLORER_COMMAND_ID,
  handler: async (accessor, resource) => {
    const editorService = accessor.get(IEditorService);
    const listService = accessor.get(IListService);
    const uri = getResourceForCommand(resource, editorService, listService);
    if (uri) {
      return editorService.openEditor({ resource: uri, options: { override: EditorResolution.PICK, source: EditorOpenSource.USER } });
    }
    return void 0;
  }
});
async function saveSelectedEditors(accessor, options) {
  const editorGroupService = accessor.get(IEditorGroupsService);
  const codeEditorService = accessor.get(ICodeEditorService);
  const textFileService = accessor.get(ITextFileService);
  let editors = getOpenEditorsViewMultiSelection(accessor);
  if (!editors) {
    const activeGroup = editorGroupService.activeGroup;
    if (activeGroup.activeEditor) {
      editors = [];
      if (activeGroup.activeEditor instanceof SideBySideEditorInput && !options?.saveAs && !(activeGroup.activeEditor.primary.hasCapability(EditorInputCapabilities.Untitled) || activeGroup.activeEditor.secondary.hasCapability(EditorInputCapabilities.Untitled)) && activeGroup.activeEditor.secondary.isModified()) {
        editors.push({ groupId: activeGroup.id, editor: activeGroup.activeEditor.primary });
        editors.push({ groupId: activeGroup.id, editor: activeGroup.activeEditor.secondary });
      } else {
        editors.push({ groupId: activeGroup.id, editor: activeGroup.activeEditor });
      }
    }
  }
  if (!editors || editors.length === 0) {
    return;
  }
  await doSaveEditors(accessor, editors, options);
  const focusedCodeEditor = codeEditorService.getFocusedCodeEditor();
  if (focusedCodeEditor instanceof EmbeddedCodeEditorWidget && !focusedCodeEditor.isSimpleWidget) {
    const resource = focusedCodeEditor.getModel()?.uri;
    if (resource && !editors.some(({ editor }) => isEqual(EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY }), resource))) {
      const model = textFileService.files.get(resource);
      if (!model?.isReadonly()) {
        await textFileService.save(resource, options);
      }
    }
  }
}
function saveDirtyEditorsOfGroups(accessor, groups, options) {
  const dirtyEditors = [];
  for (const group of groups) {
    for (const editor of group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)) {
      if (editor.isDirty()) {
        dirtyEditors.push({ groupId: group.id, editor });
      }
    }
  }
  return doSaveEditors(accessor, dirtyEditors, options);
}
async function doSaveEditors(accessor, editors, options) {
  const editorService = accessor.get(IEditorService);
  const notificationService = accessor.get(INotificationService);
  const instantiationService = accessor.get(IInstantiationService);
  try {
    await editorService.save(editors, options);
  } catch (error) {
    if (!isCancellationError(error)) {
      const actions = [toAction({ id: "workbench.action.files.saveEditors", label: nls.localize("retry", "Retry"), run: () => instantiationService.invokeFunction((accessor2) => doSaveEditors(accessor2, editors, options)) })];
      const editorsToRevert = editors.filter(
        ({ editor }) => !editor.hasCapability(EditorInputCapabilities.Untitled)
        /* all except untitled to prevent unexpected data-loss */
      );
      if (editorsToRevert.length > 0) {
        actions.push(toAction({ id: "workbench.action.files.revertEditors", label: editorsToRevert.length > 1 ? nls.localize("revertAll", "Revert All") : nls.localize("revert", "Revert"), run: () => editorService.revert(editorsToRevert) }));
      }
      notificationService.notify({
        id: editors.map(({ editor }) => hash(editor.resource?.toString())).join(),
        // ensure unique notification ID per set of editor
        severity: Severity.Error,
        message: nls.localize({ key: "genericSaveError", comment: ["{0} is the resource that failed to save and {1} the error message"] }, "Failed to save '{0}': {1}", editors.map(({ editor }) => editor.getName()).join(", "), toErrorMessage(error, false)),
        actions: { primary: actions }
      });
    }
  }
}
KeybindingsRegistry.registerCommandAndKeybindingRule({
  when: void 0,
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyMod.CtrlCmd | KeyCode.KeyS,
  id: SAVE_FILE_COMMAND_ID,
  handler: (accessor) => {
    return saveSelectedEditors(accessor, {
      reason: SaveReason.EXPLICIT,
      force: true
      /* force save even when non-dirty */
    });
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  when: void 0,
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyS),
  win: { primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyS) },
  id: SAVE_FILE_WITHOUT_FORMATTING_COMMAND_ID,
  handler: (accessor) => {
    return saveSelectedEditors(accessor, { reason: SaveReason.EXPLICIT, force: true, skipSaveParticipants: true });
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: SAVE_FILE_AS_COMMAND_ID,
  weight: KeybindingWeight.WorkbenchContrib,
  when: void 0,
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyS,
  handler: (accessor) => {
    return saveSelectedEditors(accessor, { reason: SaveReason.EXPLICIT, saveAs: true });
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  when: void 0,
  weight: KeybindingWeight.WorkbenchContrib,
  primary: void 0,
  mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyS },
  win: { primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyS) },
  id: SAVE_ALL_COMMAND_ID,
  handler: (accessor) => {
    return saveDirtyEditorsOfGroups(accessor, accessor.get(IEditorGroupsService).getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE), { reason: SaveReason.EXPLICIT });
  }
});
CommandsRegistry.registerCommand({
  id: SAVE_ALL_IN_GROUP_COMMAND_ID,
  handler: (accessor, _, editorContext) => {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const resolvedContext = resolveCommandsContext([editorContext], accessor.get(IEditorService), editorGroupsService, accessor.get(IListService));
    let groups = void 0;
    if (!resolvedContext.groupedEditors.length) {
      groups = editorGroupsService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE);
    } else {
      groups = resolvedContext.groupedEditors.map(({ group }) => group);
    }
    return saveDirtyEditorsOfGroups(accessor, groups, { reason: SaveReason.EXPLICIT });
  }
});
CommandsRegistry.registerCommand({
  id: SAVE_FILES_COMMAND_ID,
  handler: async (accessor) => {
    const editorService = accessor.get(IEditorService);
    const res = await editorService.saveAll({ includeUntitled: false, reason: SaveReason.EXPLICIT });
    return res.success;
  }
});
CommandsRegistry.registerCommand({
  id: REVERT_FILE_COMMAND_ID,
  handler: async (accessor) => {
    const editorGroupService = accessor.get(IEditorGroupsService);
    const editorService = accessor.get(IEditorService);
    let editors = getOpenEditorsViewMultiSelection(accessor);
    if (!editors) {
      const activeGroup = editorGroupService.activeGroup;
      if (activeGroup.activeEditor) {
        editors = [{ groupId: activeGroup.id, editor: activeGroup.activeEditor }];
      }
    }
    if (!editors || editors.length === 0) {
      return;
    }
    try {
      await editorService.revert(editors.filter(
        ({ editor }) => !editor.hasCapability(EditorInputCapabilities.Untitled)
        /* all except untitled */
      ), { force: true });
    } catch (error) {
      const notificationService = accessor.get(INotificationService);
      notificationService.error(nls.localize("genericRevertError", "Failed to revert '{0}': {1}", editors.map(({ editor }) => editor.getName()).join(", "), toErrorMessage(error, false)));
    }
  }
});
CommandsRegistry.registerCommand({
  id: REMOVE_ROOT_FOLDER_COMMAND_ID,
  handler: (accessor, resource) => {
    const contextService = accessor.get(IWorkspaceContextService);
    const uriIdentityService = accessor.get(IUriIdentityService);
    const workspace = contextService.getWorkspace();
    const resources = getMultiSelectedResources(resource, accessor.get(IListService), accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IExplorerService)).filter(
      (resource2) => workspace.folders.some((folder) => uriIdentityService.extUri.isEqual(folder.uri, resource2))
      // Need to verify resources are workspaces since multi selection can trigger this command on some non workspace resources
    );
    if (resources.length === 0) {
      const commandService = accessor.get(ICommandService);
      return commandService.executeCommand(RemoveRootFolderAction.ID);
    }
    const workspaceEditingService = accessor.get(IWorkspaceEditingService);
    return workspaceEditingService.removeFolders(resources);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  weight: KeybindingWeight.WorkbenchContrib + 10,
  when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerCompressedFocusContext, ExplorerCompressedFirstFocusContext.negate()),
  primary: KeyCode.LeftArrow,
  id: PREVIOUS_COMPRESSED_FOLDER,
  handler: (accessor) => {
    const paneCompositeService = accessor.get(IPaneCompositePartService);
    const viewlet = paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar);
    if (viewlet?.getId() !== VIEWLET_ID) {
      return;
    }
    const explorer = viewlet.getViewPaneContainer();
    const view = explorer.getExplorerView();
    view.previousCompressedStat();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  weight: KeybindingWeight.WorkbenchContrib + 10,
  when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerCompressedFocusContext, ExplorerCompressedLastFocusContext.negate()),
  primary: KeyCode.RightArrow,
  id: NEXT_COMPRESSED_FOLDER,
  handler: (accessor) => {
    const paneCompositeService = accessor.get(IPaneCompositePartService);
    const viewlet = paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar);
    if (viewlet?.getId() !== VIEWLET_ID) {
      return;
    }
    const explorer = viewlet.getViewPaneContainer();
    const view = explorer.getExplorerView();
    view.nextCompressedStat();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  weight: KeybindingWeight.WorkbenchContrib + 10,
  when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerCompressedFocusContext, ExplorerCompressedFirstFocusContext.negate()),
  primary: KeyCode.Home,
  id: FIRST_COMPRESSED_FOLDER,
  handler: (accessor) => {
    const paneCompositeService = accessor.get(IPaneCompositePartService);
    const viewlet = paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar);
    if (viewlet?.getId() !== VIEWLET_ID) {
      return;
    }
    const explorer = viewlet.getViewPaneContainer();
    const view = explorer.getExplorerView();
    view.firstCompressedStat();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  weight: KeybindingWeight.WorkbenchContrib + 10,
  when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerCompressedFocusContext, ExplorerCompressedLastFocusContext.negate()),
  primary: KeyCode.End,
  id: LAST_COMPRESSED_FOLDER,
  handler: (accessor) => {
    const paneCompositeService = accessor.get(IPaneCompositePartService);
    const viewlet = paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar);
    if (viewlet?.getId() !== VIEWLET_ID) {
      return;
    }
    const explorer = viewlet.getViewPaneContainer();
    const view = explorer.getExplorerView();
    view.lastCompressedStat();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  weight: KeybindingWeight.WorkbenchContrib,
  when: null,
  primary: isWeb ? isWindows ? KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyN) : KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyN : KeyMod.CtrlCmd | KeyCode.KeyN,
  secondary: isWeb ? [KeyMod.CtrlCmd | KeyCode.KeyN] : void 0,
  id: NEW_UNTITLED_FILE_COMMAND_ID,
  metadata: {
    description: NEW_UNTITLED_FILE_LABEL,
    args: [
      {
        isOptional: true,
        name: "New Untitled Text File arguments",
        description: "The editor view type or language ID if known",
        schema: {
          "type": "object",
          "properties": {
            "viewType": {
              "type": "string"
            },
            "languageId": {
              "type": "string"
            }
          }
        }
      }
    ]
  },
  handler: async (accessor, args) => {
    const editorService = accessor.get(IEditorService);
    await editorService.openEditor({
      resource: void 0,
      options: {
        override: args?.viewType,
        pinned: true
      },
      languageId: args?.languageId
    });
  }
});
CommandsRegistry.registerCommand({
  id: NEW_FILE_COMMAND_ID,
  handler: async (accessor, args) => {
    const editorService = accessor.get(IEditorService);
    const dialogService = accessor.get(IFileDialogService);
    const fileService = accessor.get(IFileService);
    const createFileLocalized = nls.localize("newFileCommand.saveLabel", "Create File");
    const defaultFileUri = joinPath(await dialogService.defaultFilePath(), args?.fileName ?? "Untitled.txt");
    const saveUri = await dialogService.showSaveDialog({ saveLabel: createFileLocalized, title: createFileLocalized, defaultUri: defaultFileUri });
    if (!saveUri) {
      return;
    }
    await fileService.createFile(saveUri, void 0, { overwrite: true });
    await editorService.openEditor({
      resource: saveUri,
      options: {
        override: args?.viewType,
        pinned: true
      },
      languageId: args?.languageId
    });
  }
});
export {
  newWindowCommand,
  openWindowCommand
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL2ZpbGVDb21tYW5kcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEVkaXRvclJlc291cmNlQWNjZXNzb3IsIElFZGl0b3JDb21tYW5kc0NvbnRleHQsIFNpZGVCeVNpZGVFZGl0b3IsIElFZGl0b3JJZGVudGlmaWVyLCBTYXZlUmVhc29uLCBFZGl0b3JzT3JkZXIsIEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBTaWRlQnlTaWRlRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL3NpZGVCeVNpZGVFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJV2luZG93T3BlbmFibGUsIElPcGVuV2luZG93T3B0aW9ucywgaXNXb3Jrc3BhY2VUb09wZW4sIElPcGVuRW1wdHlXaW5kb3dPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd2luZG93L2NvbW1vbi93aW5kb3cuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciwgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIFVOVElUTEVEX1dPUktTUEFDRV9OQU1FIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgRXhwbG9yZXJGb2N1c0NvbmRpdGlvbiwgVGV4dEZpbGVDb250ZW50UHJvdmlkZXIsIFZJRVdMRVRfSUQsIEV4cGxvcmVyQ29tcHJlc3NlZEZvY3VzQ29udGV4dCwgRXhwbG9yZXJDb21wcmVzc2VkRmlyc3RGb2N1c0NvbnRleHQsIEV4cGxvcmVyQ29tcHJlc3NlZExhc3RGb2N1c0NvbnRleHQsIEZpbGVzRXhwbG9yZXJGb2N1c0NvbmRpdGlvbiwgRXhwbG9yZXJGb2xkZXJDb250ZXh0LCBWSUVXX0lEIH0gZnJvbSAnLi4vY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEV4cGxvcmVyVmlld1BhbmVDb250YWluZXIgfSBmcm9tICcuL2V4cGxvcmVyVmlld2xldC5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyB0b0Vycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5LCBJQ29tbWFuZEhhbmRsZXIsIElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlLCBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzUmVnaXN0cnksIEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEtleU1vZCwgS2V5Q29kZSwgS2V5Q2hvcmQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBpc1dlYiwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXRSZXNvdXJjZUZvckNvbW1hbmQsIGdldE11bHRpU2VsZWN0ZWRSZXNvdXJjZXMsIGdldE9wZW5FZGl0b3JzVmlld011bHRpU2VsZWN0aW9uLCBJRXhwbG9yZXJTZXJ2aWNlIH0gZnJvbSAnLi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlRWRpdGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy93b3Jrc3BhY2VzL2NvbW1vbi93b3Jrc3BhY2VFZGl0aW5nLmpzJztcbmltcG9ydCB7IHJlc29sdmVDb21tYW5kc0NvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JDb21tYW5kc0NvbnRleHQuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlLCBTSURFX0dST1VQLCBJU2F2ZUVkaXRvcnNPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNTZXJ2aWNlLCBHcm91cHNPcmRlciwgSUVkaXRvckdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGpvaW5QYXRoLCBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCBkaXNwb3NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvZW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IElUZXh0RmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dGZpbGVzLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgaXNDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uLCB0b0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3BlblNvdXJjZSwgRWRpdG9yUmVzb2x1dGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IGhhc2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oYXNoLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3BhbmVjb21wb3NpdGUvYnJvd3Nlci9wYW5lY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IFZpZXdDb250YWluZXJMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBPUEVOX1RPX1NJREVfQ09NTUFORF9JRCwgQ09NUEFSRV9XSVRIX1NBVkVEX0NPTU1BTkRfSUQsIFNFTEVDVF9GT1JfQ09NUEFSRV9DT01NQU5EX0lELCBSZXNvdXJjZVNlbGVjdGVkRm9yQ29tcGFyZUNvbnRleHQsIENPTVBBUkVfU0VMRUNURURfQ09NTUFORF9JRCwgQ09NUEFSRV9SRVNPVVJDRV9DT01NQU5EX0lELCBDT1BZX1BBVEhfQ09NTUFORF9JRCwgQ09QWV9SRUxBVElWRV9QQVRIX0NPTU1BTkRfSUQsIFJFVkVBTF9JTl9FWFBMT1JFUl9DT01NQU5EX0lELCBPUEVOX1dJVEhfRVhQTE9SRVJfQ09NTUFORF9JRCwgU0FWRV9GSUxFX0NPTU1BTkRfSUQsIFNBVkVfRklMRV9XSVRIT1VUX0ZPUk1BVFRJTkdfQ09NTUFORF9JRCwgU0FWRV9GSUxFX0FTX0NPTU1BTkRfSUQsIFNBVkVfQUxMX0NPTU1BTkRfSUQsIFNBVkVfQUxMX0lOX0dST1VQX0NPTU1BTkRfSUQsIFNBVkVfRklMRVNfQ09NTUFORF9JRCwgUkVWRVJUX0ZJTEVfQ09NTUFORF9JRCwgUkVNT1ZFX1JPT1RfRk9MREVSX0NPTU1BTkRfSUQsIFBSRVZJT1VTX0NPTVBSRVNTRURfRk9MREVSLCBORVhUX0NPTVBSRVNTRURfRk9MREVSLCBGSVJTVF9DT01QUkVTU0VEX0ZPTERFUiwgTEFTVF9DT01QUkVTU0VEX0ZPTERFUiwgTkVXX1VOVElUTEVEX0ZJTEVfQ09NTUFORF9JRCwgTkVXX1VOVElUTEVEX0ZJTEVfTEFCRUwsIE5FV19GSUxFX0NPTU1BTkRfSUQgfSBmcm9tICcuL2ZpbGVDb25zdGFudHMuanMnO1xuaW1wb3J0IHsgSUZpbGVEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBSZW1vdmVSb290Rm9sZGVyQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9hY3Rpb25zL3dvcmtzcGFjZUFjdGlvbnMuanMnO1xuaW1wb3J0IHsgT3BlbkVkaXRvcnNWaWV3IH0gZnJvbSAnLi92aWV3cy9vcGVuRWRpdG9yc1ZpZXcuanMnO1xuaW1wb3J0IHsgRXhwbG9yZXJWaWV3IH0gZnJvbSAnLi92aWV3cy9leHBsb3JlclZpZXcuanMnO1xuaW1wb3J0IHsgSUxpc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcblxuZXhwb3J0IGNvbnN0IG9wZW5XaW5kb3dDb21tYW5kID0gKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB0b09wZW46IElXaW5kb3dPcGVuYWJsZVtdLCBvcHRpb25zPzogSU9wZW5XaW5kb3dPcHRpb25zKSA9PiB7XG5cdGlmIChBcnJheS5pc0FycmF5KHRvT3BlbikpIHtcblx0XHRjb25zdCBob3N0U2VydmljZSA9IGFjY2Vzc29yLmdldChJSG9zdFNlcnZpY2UpO1xuXHRcdGNvbnN0IGVudmlyb25tZW50U2VydmljZSA9IGFjY2Vzc29yLmdldChJRW52aXJvbm1lbnRTZXJ2aWNlKTtcblxuXHRcdC8vIHJld3JpdGUgdW50aXRsZWQ6IHdvcmtzcGFjZSBVUklzIHRvIHRoZSBhYnNvbHV0ZSBwYXRoIG9uIGRpc2tcblx0XHR0b09wZW4gPSB0b09wZW4ubWFwKG9wZW5hYmxlID0+IHtcblx0XHRcdGlmIChpc1dvcmtzcGFjZVRvT3BlbihvcGVuYWJsZSkgJiYgb3BlbmFibGUud29ya3NwYWNlVXJpLnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHdvcmtzcGFjZVVyaTogam9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVudGl0bGVkV29ya3NwYWNlc0hvbWUsIG9wZW5hYmxlLndvcmtzcGFjZVVyaS5wYXRoLCBVTlRJVExFRF9XT1JLU1BBQ0VfTkFNRSlcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG9wZW5hYmxlO1xuXHRcdH0pO1xuXG5cdFx0aG9zdFNlcnZpY2Uub3BlbldpbmRvdyh0b09wZW4sIG9wdGlvbnMpO1xuXHR9XG59O1xuXG5leHBvcnQgY29uc3QgbmV3V2luZG93Q29tbWFuZCA9IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgb3B0aW9ucz86IElPcGVuRW1wdHlXaW5kb3dPcHRpb25zKSA9PiB7XG5cdGNvbnN0IGhvc3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElIb3N0U2VydmljZSk7XG5cdGhvc3RTZXJ2aWNlLm9wZW5XaW5kb3cob3B0aW9ucyk7XG59O1xuXG4vLyBDb21tYW5kIHJlZ2lzdHJhdGlvblxuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHdoZW46IEV4cGxvcmVyRm9jdXNDb25kaXRpb24sXG5cdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5FbnRlcixcblx0bWFjOiB7XG5cdFx0cHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLkVudGVyXG5cdH0sXG5cdGlkOiBPUEVOX1RPX1NJREVfQ09NTUFORF9JRCwgaGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yLCByZXNvdXJjZTogVVJJIHwgb2JqZWN0KSA9PiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRjb25zdCBleHBsb3JlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4cGxvcmVyU2VydmljZSk7XG5cdFx0Y29uc3QgcmVzb3VyY2VzID0gZ2V0TXVsdGlTZWxlY3RlZFJlc291cmNlcyhyZXNvdXJjZSwgYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSksIGVkaXRvclNlcnZpY2UsIGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSksIGV4cGxvcmVyU2VydmljZSk7XG5cblx0XHQvLyBTZXQgc2lkZSBpbnB1dFxuXHRcdGlmIChyZXNvdXJjZXMubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCB1bnRpdGxlZFJlc291cmNlcyA9IHJlc291cmNlcy5maWx0ZXIocmVzb3VyY2UgPT4gcmVzb3VyY2Uuc2NoZW1lID09PSBTY2hlbWFzLnVudGl0bGVkKTtcblx0XHRcdGNvbnN0IGZpbGVSZXNvdXJjZXMgPSByZXNvdXJjZXMuZmlsdGVyKHJlc291cmNlID0+IHJlc291cmNlLnNjaGVtZSAhPT0gU2NoZW1hcy51bnRpdGxlZCk7XG5cblx0XHRcdGNvbnN0IGl0ZW1zID0gYXdhaXQgUHJvbWlzZS5hbGwoZmlsZVJlc291cmNlcy5tYXAoYXN5bmMgcmVzb3VyY2UgPT4ge1xuXHRcdFx0XHRjb25zdCBpdGVtID0gZXhwbG9yZXJTZXJ2aWNlLmZpbmRDbG9zZXN0KHJlc291cmNlKTtcblx0XHRcdFx0aWYgKGl0ZW0pIHtcblx0XHRcdFx0XHQvLyBFeHBsb3JlciBhbHJlYWR5IHJlc29sdmVkIHRoZSBpdGVtLCBubyBuZWVkIHRvIGdvIHRvIHRoZSBmaWxlIHNlcnZpY2UgIzEwOTc4MFxuXHRcdFx0XHRcdHJldHVybiBpdGVtO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGF3YWl0IGZpbGVTZXJ2aWNlLnN0YXQocmVzb3VyY2UpO1xuXHRcdFx0fSkpO1xuXHRcdFx0Y29uc3QgZmlsZXMgPSBpdGVtcy5maWx0ZXIoaSA9PiAhaS5pc0RpcmVjdG9yeSk7XG5cdFx0XHRjb25zdCBlZGl0b3JzID0gZmlsZXMubWFwKGYgPT4gKHtcblx0XHRcdFx0cmVzb3VyY2U6IGYucmVzb3VyY2UsXG5cdFx0XHRcdG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH1cblx0XHRcdH0pKS5jb25jYXQoLi4udW50aXRsZWRSZXNvdXJjZXMubWFwKHVudGl0bGVkUmVzb3VyY2UgPT4gKHsgcmVzb3VyY2U6IHVudGl0bGVkUmVzb3VyY2UsIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gfSkpKTtcblxuXHRcdFx0YXdhaXQgZWRpdG9yU2VydmljZS5vcGVuRWRpdG9ycyhlZGl0b3JzLCBTSURFX0dST1VQKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAxMCxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEZpbGVzRXhwbG9yZXJGb2N1c0NvbmRpdGlvbiwgRXhwbG9yZXJGb2xkZXJDb250ZXh0LnRvTmVnYXRlZCgpKSxcblx0cHJpbWFyeTogS2V5Q29kZS5FbnRlcixcblx0bWFjOiB7XG5cdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkRvd25BcnJvd1xuXHR9LFxuXHRpZDogJ2V4cGxvcmVyLm9wZW5BbmRQYXNzRm9jdXMnLCBoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3IsIF9yZXNvdXJjZTogVVJJIHwgb2JqZWN0KSA9PiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgZXhwbG9yZXJTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHBsb3JlclNlcnZpY2UpO1xuXHRcdGNvbnN0IHJlc291cmNlcyA9IGV4cGxvcmVyU2VydmljZS5nZXRDb250ZXh0KHRydWUpO1xuXG5cdFx0aWYgKHJlc291cmNlcy5sZW5ndGgpIHtcblx0XHRcdGF3YWl0IGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcnMocmVzb3VyY2VzLm1hcChyID0+ICh7IHJlc291cmNlOiByLnJlc291cmNlLCBvcHRpb25zOiB7IHByZXNlcnZlRm9jdXM6IGZhbHNlLCBwaW5uZWQ6IHRydWUgfSB9KSkpO1xuXHRcdH1cblx0fVxufSk7XG5cbmNvbnN0IENPTVBBUkVfV0lUSF9TQVZFRF9TQ0hFTUEgPSAnc2hvd01vZGlmaWNhdGlvbnMnO1xubGV0IHByb3ZpZGVyRGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW10gPSBbXTtcbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogQ09NUEFSRV9XSVRIX1NBVkVEX0NPTU1BTkRfSUQsXG5cdHdoZW46IHVuZGVmaW5lZCxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlDb2RlLktleUQpLFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3IsIHJlc291cmNlOiBVUkkgfCBvYmplY3QpID0+IHtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IHRleHRNb2RlbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRleHRNb2RlbFNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0Y29uc3QgbGlzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKTtcblxuXHRcdC8vIFJlZ2lzdGVyIHByb3ZpZGVyIGF0IGZpcnN0IGFzIG5lZWRlZFxuXHRcdGxldCByZWdpc3RlckVkaXRvckxpc3RlbmVyID0gZmFsc2U7XG5cdFx0aWYgKHByb3ZpZGVyRGlzcG9zYWJsZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZWdpc3RlckVkaXRvckxpc3RlbmVyID0gdHJ1ZTtcblxuXHRcdFx0Y29uc3QgcHJvdmlkZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUNvbnRlbnRQcm92aWRlcik7XG5cdFx0XHRwcm92aWRlckRpc3Bvc2FibGVzLnB1c2gocHJvdmlkZXIpO1xuXHRcdFx0cHJvdmlkZXJEaXNwb3NhYmxlcy5wdXNoKHRleHRNb2RlbFNlcnZpY2UucmVnaXN0ZXJUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIoQ09NUEFSRV9XSVRIX1NBVkVEX1NDSEVNQSwgcHJvdmlkZXIpKTtcblx0XHR9XG5cblx0XHQvLyBPcGVuIGVkaXRvciAob25seSByZXNvdXJjZXMgdGhhdCBjYW4gYmUgaGFuZGxlZCBieSBmaWxlIHNlcnZpY2UgYXJlIHN1cHBvcnRlZClcblx0XHRjb25zdCB1cmkgPSBnZXRSZXNvdXJjZUZvckNvbW1hbmQocmVzb3VyY2UsIGVkaXRvclNlcnZpY2UsIGxpc3RTZXJ2aWNlKTtcblx0XHRpZiAodXJpICYmIGZpbGVTZXJ2aWNlLmhhc1Byb3ZpZGVyKHVyaSkpIHtcblx0XHRcdGNvbnN0IG5hbWUgPSBiYXNlbmFtZSh1cmkpO1xuXHRcdFx0Y29uc3QgZWRpdG9yTGFiZWwgPSBubHMubG9jYWxpemUoJ21vZGlmaWVkTGFiZWwnLCBcInswfSAoaW4gZmlsZSkgXHUyMTk0IHsxfVwiLCBuYW1lLCBuYW1lKTtcblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgVGV4dEZpbGVDb250ZW50UHJvdmlkZXIub3Blbih1cmksIENPTVBBUkVfV0lUSF9TQVZFRF9TQ0hFTUEsIGVkaXRvckxhYmVsLCBlZGl0b3JTZXJ2aWNlLCB7IHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRcdFx0Ly8gRGlzcG9zZSBvbmNlIG5vIG1vcmUgZGlmZiBlZGl0b3IgaXMgb3BlbmVkIHdpdGggdGhlIHNjaGVtZVxuXHRcdFx0XHRpZiAocmVnaXN0ZXJFZGl0b3JMaXN0ZW5lcikge1xuXHRcdFx0XHRcdHByb3ZpZGVyRGlzcG9zYWJsZXMucHVzaChlZGl0b3JTZXJ2aWNlLm9uRGlkVmlzaWJsZUVkaXRvcnNDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKCFlZGl0b3JTZXJ2aWNlLmVkaXRvcnMuc29tZShlZGl0b3IgPT4gISFFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldENhbm9uaWNhbFVyaShlZGl0b3IsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuU0VDT05EQVJZLCBmaWx0ZXJCeVNjaGVtZTogQ09NUEFSRV9XSVRIX1NBVkVEX1NDSEVNQSB9KSkpIHtcblx0XHRcdFx0XHRcdFx0cHJvdmlkZXJEaXNwb3NhYmxlcyA9IGRpc3Bvc2UocHJvdmlkZXJEaXNwb3NhYmxlcyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0cHJvdmlkZXJEaXNwb3NhYmxlcyA9IGRpc3Bvc2UocHJvdmlkZXJEaXNwb3NhYmxlcyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcblxubGV0IGdsb2JhbFJlc291cmNlVG9Db21wYXJlOiBVUkkgfCB1bmRlZmluZWQ7XG5sZXQgcmVzb3VyY2VTZWxlY3RlZEZvckNvbXBhcmVDb250ZXh0OiBJQ29udGV4dEtleTxib29sZWFuPjtcbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0aWQ6IFNFTEVDVF9GT1JfQ09NUEFSRV9DT01NQU5EX0lELFxuXHRoYW5kbGVyOiAoYWNjZXNzb3IsIHJlc291cmNlOiBVUkkgfCBvYmplY3QpID0+IHtcblx0XHRnbG9iYWxSZXNvdXJjZVRvQ29tcGFyZSA9IGdldFJlc291cmNlRm9yQ29tbWFuZChyZXNvdXJjZSwgYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSkpO1xuXHRcdGlmICghcmVzb3VyY2VTZWxlY3RlZEZvckNvbXBhcmVDb250ZXh0KSB7XG5cdFx0XHRyZXNvdXJjZVNlbGVjdGVkRm9yQ29tcGFyZUNvbnRleHQgPSBSZXNvdXJjZVNlbGVjdGVkRm9yQ29tcGFyZUNvbnRleHQuYmluZFRvKGFjY2Vzc29yLmdldChJQ29udGV4dEtleVNlcnZpY2UpKTtcblx0XHR9XG5cdFx0cmVzb3VyY2VTZWxlY3RlZEZvckNvbXBhcmVDb250ZXh0LnNldCh0cnVlKTtcblx0fVxufSk7XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0aWQ6IENPTVBBUkVfU0VMRUNURURfQ09NTUFORF9JRCxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yLCByZXNvdXJjZTogVVJJIHwgb2JqZWN0KSA9PiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgcmVzb3VyY2VzID0gZ2V0TXVsdGlTZWxlY3RlZFJlc291cmNlcyhyZXNvdXJjZSwgYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSksIGVkaXRvclNlcnZpY2UsIGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSksIGFjY2Vzc29yLmdldChJRXhwbG9yZXJTZXJ2aWNlKSk7XG5cblx0XHRpZiAocmVzb3VyY2VzLmxlbmd0aCA9PT0gMikge1xuXHRcdFx0cmV0dXJuIGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdG9yaWdpbmFsOiB7IHJlc291cmNlOiByZXNvdXJjZXNbMF0gfSxcblx0XHRcdFx0bW9kaWZpZWQ6IHsgcmVzb3VyY2U6IHJlc291cmNlc1sxXSB9LFxuXHRcdFx0XHRvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufSk7XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0aWQ6IENPTVBBUkVfUkVTT1VSQ0VfQ09NTUFORF9JRCxcblx0aGFuZGxlcjogKGFjY2Vzc29yLCByZXNvdXJjZTogVVJJIHwgb2JqZWN0KSA9PiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgcmlnaHRSZXNvdXJjZSA9IGdldFJlc291cmNlRm9yQ29tbWFuZChyZXNvdXJjZSwgZWRpdG9yU2VydmljZSwgYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSkpO1xuXHRcdGlmIChnbG9iYWxSZXNvdXJjZVRvQ29tcGFyZSAmJiByaWdodFJlc291cmNlKSB7XG5cdFx0XHRlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRvcmlnaW5hbDogeyByZXNvdXJjZTogZ2xvYmFsUmVzb3VyY2VUb0NvbXBhcmUgfSxcblx0XHRcdFx0bW9kaWZpZWQ6IHsgcmVzb3VyY2U6IHJpZ2h0UmVzb3VyY2UgfSxcblx0XHRcdFx0b3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG59KTtcblxuYXN5bmMgZnVuY3Rpb24gcmVzb3VyY2VzVG9DbGlwYm9hcmQocmVzb3VyY2VzOiBVUklbXSwgcmVsYXRpdmU6IGJvb2xlYW4sIGNsaXBib2FyZFNlcnZpY2U6IElDbGlwYm9hcmRTZXJ2aWNlLCBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0aWYgKHJlc291cmNlcy5sZW5ndGgpIHtcblx0XHRjb25zdCBsaW5lRGVsaW1pdGVyID0gaXNXaW5kb3dzID8gJ1xcclxcbicgOiAnXFxuJztcblxuXHRcdGxldCBzZXBhcmF0b3I6ICcvJyB8ICdcXFxcJyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRjb25zdCBjb3B5UmVsYXRpdmVPckZ1bGxQYXRoU2VwYXJhdG9yU2VjdGlvbiA9IHJlbGF0aXZlID8gJ2V4cGxvcmVyLmNvcHlSZWxhdGl2ZVBhdGhTZXBhcmF0b3InIDogJ2V4cGxvcmVyLmNvcHlQYXRoU2VwYXJhdG9yJztcblx0XHRjb25zdCBjb3B5UmVsYXRpdmVPckZ1bGxQYXRoU2VwYXJhdG9yOiAnLycgfCAnXFxcXCcgfCB1bmRlZmluZWQgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShjb3B5UmVsYXRpdmVPckZ1bGxQYXRoU2VwYXJhdG9yU2VjdGlvbik7XG5cdFx0aWYgKGNvcHlSZWxhdGl2ZU9yRnVsbFBhdGhTZXBhcmF0b3IgPT09ICcvJyB8fCBjb3B5UmVsYXRpdmVPckZ1bGxQYXRoU2VwYXJhdG9yID09PSAnXFxcXCcpIHtcblx0XHRcdHNlcGFyYXRvciA9IGNvcHlSZWxhdGl2ZU9yRnVsbFBhdGhTZXBhcmF0b3I7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGV4dCA9IHJlc291cmNlcy5tYXAocmVzb3VyY2UgPT4gbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHJlc291cmNlLCB7IHJlbGF0aXZlLCBub1ByZWZpeDogdHJ1ZSwgc2VwYXJhdG9yIH0pKS5qb2luKGxpbmVEZWxpbWl0ZXIpO1xuXHRcdGF3YWl0IGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KHRleHQpO1xuXHR9XG59XG5cbmNvbnN0IGNvcHlQYXRoQ29tbWFuZEhhbmRsZXI6IElDb21tYW5kSGFuZGxlciA9IGFzeW5jIChhY2Nlc3NvciwgcmVzb3VyY2U6IFVSSSB8IG9iamVjdCkgPT4ge1xuXHRjb25zdCByZXNvdXJjZXMgPSBnZXRNdWx0aVNlbGVjdGVkUmVzb3VyY2VzKHJlc291cmNlLCBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElFeHBsb3JlclNlcnZpY2UpKTtcblx0YXdhaXQgcmVzb3VyY2VzVG9DbGlwYm9hcmQocmVzb3VyY2VzLCBmYWxzZSwgYWNjZXNzb3IuZ2V0KElDbGlwYm9hcmRTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElMYWJlbFNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG59O1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHdoZW46IEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLnRvTmVnYXRlZCgpLFxuXHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLktleUMsXG5cdHdpbjoge1xuXHRcdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLktleUNcblx0fSxcblx0aWQ6IENPUFlfUEFUSF9DT01NQU5EX0lELFxuXHRoYW5kbGVyOiBjb3B5UGF0aENvbW1hbmRIYW5kbGVyXG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHR3aGVuOiBFZGl0b3JDb250ZXh0S2V5cy5mb2N1cyxcblx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuS2V5QyksXG5cdHdpbjoge1xuXHRcdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLktleUNcblx0fSxcblx0aWQ6IENPUFlfUEFUSF9DT01NQU5EX0lELFxuXHRoYW5kbGVyOiBjb3B5UGF0aENvbW1hbmRIYW5kbGVyXG59KTtcblxuY29uc3QgY29weVJlbGF0aXZlUGF0aENvbW1hbmRIYW5kbGVyOiBJQ29tbWFuZEhhbmRsZXIgPSBhc3luYyAoYWNjZXNzb3IsIHJlc291cmNlOiBVUkkgfCBvYmplY3QpID0+IHtcblx0Y29uc3QgcmVzb3VyY2VzID0gZ2V0TXVsdGlTZWxlY3RlZFJlc291cmNlcyhyZXNvdXJjZSwgYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSksIGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSksIGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSksIGFjY2Vzc29yLmdldChJRXhwbG9yZXJTZXJ2aWNlKSk7XG5cdGF3YWl0IHJlc291cmNlc1RvQ2xpcGJvYXJkKHJlc291cmNlcywgdHJ1ZSwgYWNjZXNzb3IuZ2V0KElDbGlwYm9hcmRTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElMYWJlbFNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG59O1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHdoZW46IEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLnRvTmVnYXRlZCgpLFxuXHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLktleUMsXG5cdHdpbjoge1xuXHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5Qylcblx0fSxcblx0aWQ6IENPUFlfUkVMQVRJVkVfUEFUSF9DT01NQU5EX0lELFxuXHRoYW5kbGVyOiBjb3B5UmVsYXRpdmVQYXRoQ29tbWFuZEhhbmRsZXJcbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHdoZW46IEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLFxuXHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5LZXlDKSxcblx0d2luOiB7XG5cdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlDKVxuXHR9LFxuXHRpZDogQ09QWV9SRUxBVElWRV9QQVRIX0NPTU1BTkRfSUQsXG5cdGhhbmRsZXI6IGNvcHlSZWxhdGl2ZVBhdGhDb21tYW5kSGFuZGxlclxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0d2hlbjogdW5kZWZpbmVkLFxuXHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5Q29kZS5LZXlQKSxcblx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmZpbGVzLmNvcHlQYXRoT2ZBY3RpdmVGaWxlJyxcblx0aGFuZGxlcjogYXN5bmMgYWNjZXNzb3IgPT4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGFjdGl2ZUlucHV0ID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3I7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGFjdGl2ZUlucHV0LCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSk7XG5cdFx0Y29uc3QgcmVzb3VyY2VzID0gcmVzb3VyY2UgPyBbcmVzb3VyY2VdIDogW107XG5cdFx0YXdhaXQgcmVzb3VyY2VzVG9DbGlwYm9hcmQocmVzb3VyY2VzLCBmYWxzZSwgYWNjZXNzb3IuZ2V0KElDbGlwYm9hcmRTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElMYWJlbFNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cdH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBSRVZFQUxfSU5fRVhQTE9SRVJfQ09NTUFORF9JRCxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yLCByZXNvdXJjZTogVVJJIHwgb2JqZWN0KSA9PiB7XG5cdFx0Y29uc3Qgdmlld1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdFx0Y29uc3QgY29udGV4dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTtcblx0XHRjb25zdCBleHBsb3JlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4cGxvcmVyU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgbGlzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKTtcblx0XHRjb25zdCB1cmkgPSBnZXRSZXNvdXJjZUZvckNvbW1hbmQocmVzb3VyY2UsIGVkaXRvclNlcnZpY2UsIGxpc3RTZXJ2aWNlKTtcblxuXHRcdGlmICh1cmkgJiYgY29udGV4dFNlcnZpY2UuaXNJbnNpZGVXb3Jrc3BhY2UodXJpKSkge1xuXHRcdFx0Y29uc3QgZXhwbG9yZXJWaWV3ID0gYXdhaXQgdmlld1NlcnZpY2Uub3BlblZpZXc8RXhwbG9yZXJWaWV3PihWSUVXX0lELCBmYWxzZSk7XG5cdFx0XHRpZiAoZXhwbG9yZXJWaWV3KSB7XG5cdFx0XHRcdGNvbnN0IG9sZEF1dG9SZXZlYWwgPSBleHBsb3JlclZpZXcuYXV0b1JldmVhbDtcblx0XHRcdFx0Ly8gRGlzYWJsZSBhdXRvcmV2ZWFsIGJlZm9yZSByZXZlYWxpbmcgdGhlIGV4cGxvcmVyIHRvIHByZXZlbnQgYSByYWNlIGJldHdlbmUgYXV0byByZXZlYWwgKyBzZWxlY3Rpb25cblx0XHRcdFx0Ly8gRml4ZXMgIzE5NzI2OFxuXHRcdFx0XHRleHBsb3JlclZpZXcuYXV0b1JldmVhbCA9IGZhbHNlO1xuXHRcdFx0XHRleHBsb3JlclZpZXcuc2V0RXhwYW5kZWQodHJ1ZSk7XG5cdFx0XHRcdGF3YWl0IGV4cGxvcmVyU2VydmljZS5zZWxlY3QodXJpLCAnZm9yY2UnKTtcblx0XHRcdFx0ZXhwbG9yZXJWaWV3LmZvY3VzKCk7XG5cdFx0XHRcdGV4cGxvcmVyVmlldy5hdXRvUmV2ZWFsID0gb2xkQXV0b1JldmVhbDtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gRG8gbm90IHJldmVhbCB0aGUgb3BlbiBlZGl0b3JzIHZpZXcgaWYgaXQncyBoaWRkZW4gZXhwbGljaXRseVxuXHRcdFx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yMjczNzhcblx0XHRcdGNvbnN0IG9wZW5FZGl0b3JzVmlldyA9IHZpZXdTZXJ2aWNlLmdldFZpZXdXaXRoSWQoT3BlbkVkaXRvcnNWaWV3LklEKTtcblx0XHRcdGlmIChvcGVuRWRpdG9yc1ZpZXcpIHtcblx0XHRcdFx0b3BlbkVkaXRvcnNWaWV3LnNldEV4cGFuZGVkKHRydWUpO1xuXHRcdFx0XHRvcGVuRWRpdG9yc1ZpZXcuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBPUEVOX1dJVEhfRVhQTE9SRVJfQ09NTUFORF9JRCxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yLCByZXNvdXJjZTogVVJJIHwgb2JqZWN0KSA9PiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgbGlzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKTtcblx0XHRjb25zdCB1cmkgPSBnZXRSZXNvdXJjZUZvckNvbW1hbmQocmVzb3VyY2UsIGVkaXRvclNlcnZpY2UsIGxpc3RTZXJ2aWNlKTtcblx0XHRpZiAodXJpKSB7XG5cdFx0XHRyZXR1cm4gZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2U6IHVyaSwgb3B0aW9uczogeyBvdmVycmlkZTogRWRpdG9yUmVzb2x1dGlvbi5QSUNLLCBzb3VyY2U6IEVkaXRvck9wZW5Tb3VyY2UuVVNFUiB9IH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn0pO1xuXG4vLyBTYXZlIC8gU2F2ZSBBcyAvIFNhdmUgQWxsIC8gUmV2ZXJ0XG5cbmFzeW5jIGZ1bmN0aW9uIHNhdmVTZWxlY3RlZEVkaXRvcnMoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG9wdGlvbnM/OiBJU2F2ZUVkaXRvcnNPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdGNvbnN0IGVkaXRvckdyb3VwU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdGNvbnN0IGNvZGVFZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb2RlRWRpdG9yU2VydmljZSk7XG5cdGNvbnN0IHRleHRGaWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGV4dEZpbGVTZXJ2aWNlKTtcblxuXHQvLyBSZXRyaWV2ZSBzZWxlY3RlZCBvciBhY3RpdmUgZWRpdG9yXG5cdGxldCBlZGl0b3JzID0gZ2V0T3BlbkVkaXRvcnNWaWV3TXVsdGlTZWxlY3Rpb24oYWNjZXNzb3IpO1xuXHRpZiAoIWVkaXRvcnMpIHtcblx0XHRjb25zdCBhY3RpdmVHcm91cCA9IGVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cDtcblx0XHRpZiAoYWN0aXZlR3JvdXAuYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRlZGl0b3JzID0gW107XG5cblx0XHRcdC8vIFNwZWNpYWwgdHJlYXRtZW50IGZvciBzaWRlIGJ5IHNpZGUgZWRpdG9yczogaWYgdGhlIGFjdGl2ZSBlZGl0b3Jcblx0XHRcdC8vIGhhcyAyIHNpZGVzLCB3ZSBjb25zaWRlciBib3RoLCB0byBzdXBwb3J0IHNhdmluZyBib3RoIHNpZGVzLlxuXHRcdFx0Ly8gV2Ugb25seSBhbGxvdyB0aGlzIHdoZW4gc2F2aW5nLCBub3QgZm9yIFwiU2F2ZSBBc1wiIGFuZCBub3QgaWYgYW55XG5cdFx0XHQvLyBlZGl0b3IgaXMgdW50aXRsZWQgd2hpY2ggd291bGQgYnJpbmcgdXAgYSBcIlNhdmUgQXNcIiBkaWFsb2cgdG9vLlxuXHRcdFx0Ly8gSW4gYWRkaXRpb24sIHdlIHJlcXVpcmUgdGhlIHNlY29uZGFyeSBzaWRlIHRvIGJlIG1vZGlmaWVkIHRvIG5vdFxuXHRcdFx0Ly8gdHJpZ2dlciBhIHRvdWNoIG9wZXJhdGlvbiB1bmV4cGVjdGVkbHkuXG5cdFx0XHQvL1xuXHRcdFx0Ly8gU2VlIGFsc28gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzQxODBcblx0XHRcdC8vIFNlZSBhbHNvIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMDYzMzBcblx0XHRcdC8vIFNlZSBhbHNvIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xOTAyMTBcblx0XHRcdGlmIChcblx0XHRcdFx0YWN0aXZlR3JvdXAuYWN0aXZlRWRpdG9yIGluc3RhbmNlb2YgU2lkZUJ5U2lkZUVkaXRvcklucHV0ICYmXG5cdFx0XHRcdCFvcHRpb25zPy5zYXZlQXMgJiYgIShhY3RpdmVHcm91cC5hY3RpdmVFZGl0b3IucHJpbWFyeS5oYXNDYXBhYmlsaXR5KEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLlVudGl0bGVkKSB8fCBhY3RpdmVHcm91cC5hY3RpdmVFZGl0b3Iuc2Vjb25kYXJ5Lmhhc0NhcGFiaWxpdHkoRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuVW50aXRsZWQpKSAmJlxuXHRcdFx0XHRhY3RpdmVHcm91cC5hY3RpdmVFZGl0b3Iuc2Vjb25kYXJ5LmlzTW9kaWZpZWQoKVxuXHRcdFx0KSB7XG5cdFx0XHRcdGVkaXRvcnMucHVzaCh7IGdyb3VwSWQ6IGFjdGl2ZUdyb3VwLmlkLCBlZGl0b3I6IGFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvci5wcmltYXJ5IH0pO1xuXHRcdFx0XHRlZGl0b3JzLnB1c2goeyBncm91cElkOiBhY3RpdmVHcm91cC5pZCwgZWRpdG9yOiBhY3RpdmVHcm91cC5hY3RpdmVFZGl0b3Iuc2Vjb25kYXJ5IH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZWRpdG9ycy5wdXNoKHsgZ3JvdXBJZDogYWN0aXZlR3JvdXAuaWQsIGVkaXRvcjogYWN0aXZlR3JvdXAuYWN0aXZlRWRpdG9yIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmICghZWRpdG9ycyB8fCBlZGl0b3JzLmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybjsgLy8gbm90aGluZyB0byBzYXZlXG5cdH1cblxuXHQvLyBTYXZlIGVkaXRvcnNcblx0YXdhaXQgZG9TYXZlRWRpdG9ycyhhY2Nlc3NvciwgZWRpdG9ycywgb3B0aW9ucyk7XG5cblx0Ly8gU3BlY2lhbCB0cmVhdG1lbnQgZm9yIGVtYmVkZGVkIGVkaXRvcnM6IGlmIHdlIGRldGVjdCB0aGF0IGZvY3VzIGlzXG5cdC8vIGluc2lkZSBhbiBlbWJlZGRlZCBjb2RlIGVkaXRvciwgd2Ugc2F2ZSB0aGF0IG1vZGVsIGFzIHdlbGwgaWYgd2Vcblx0Ly8gZmluZCBpdCBpbiBvdXIgdGV4dCBmaWxlIG1vZGVscy4gQ3VycmVudGx5LCBvbmx5IHRleHR1YWwgZWRpdG9yc1xuXHQvLyBzdXBwb3J0IGVtYmVkZGVkIGVkaXRvcnMuXG5cdGNvbnN0IGZvY3VzZWRDb2RlRWRpdG9yID0gY29kZUVkaXRvclNlcnZpY2UuZ2V0Rm9jdXNlZENvZGVFZGl0b3IoKTtcblx0aWYgKGZvY3VzZWRDb2RlRWRpdG9yIGluc3RhbmNlb2YgRW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0ICYmICFmb2N1c2VkQ29kZUVkaXRvci5pc1NpbXBsZVdpZGdldCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gZm9jdXNlZENvZGVFZGl0b3IuZ2V0TW9kZWwoKT8udXJpO1xuXG5cdFx0Ly8gQ2hlY2sgdGhhdCB0aGUgcmVzb3VyY2Ugb2YgdGhlIG1vZGVsIHdhcyBub3Qgc2F2ZWQgYWxyZWFkeVxuXHRcdGlmIChyZXNvdXJjZSAmJiAhZWRpdG9ycy5zb21lKCh7IGVkaXRvciB9KSA9PiBpc0VxdWFsKEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0Q2Fub25pY2FsVXJpKGVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pLCByZXNvdXJjZSkpKSB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IHRleHRGaWxlU2VydmljZS5maWxlcy5nZXQocmVzb3VyY2UpO1xuXHRcdFx0aWYgKCFtb2RlbD8uaXNSZWFkb25seSgpKSB7XG5cdFx0XHRcdGF3YWl0IHRleHRGaWxlU2VydmljZS5zYXZlKHJlc291cmNlLCBvcHRpb25zKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gc2F2ZURpcnR5RWRpdG9yc09mR3JvdXBzKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBncm91cHM6IHJlYWRvbmx5IElFZGl0b3JHcm91cFtdLCBvcHRpb25zPzogSVNhdmVFZGl0b3JzT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRjb25zdCBkaXJ0eUVkaXRvcnM6IElFZGl0b3JJZGVudGlmaWVyW10gPSBbXTtcblx0Zm9yIChjb25zdCBncm91cCBvZiBncm91cHMpIHtcblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkpIHtcblx0XHRcdGlmIChlZGl0b3IuaXNEaXJ0eSgpKSB7XG5cdFx0XHRcdGRpcnR5RWRpdG9ycy5wdXNoKHsgZ3JvdXBJZDogZ3JvdXAuaWQsIGVkaXRvciB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gZG9TYXZlRWRpdG9ycyhhY2Nlc3NvciwgZGlydHlFZGl0b3JzLCBvcHRpb25zKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZG9TYXZlRWRpdG9ycyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yczogSUVkaXRvcklkZW50aWZpZXJbXSwgb3B0aW9ucz86IElTYXZlRWRpdG9yc09wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdHRyeSB7XG5cdFx0YXdhaXQgZWRpdG9yU2VydmljZS5zYXZlKGVkaXRvcnMsIG9wdGlvbnMpO1xuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdGlmICghaXNDYW5jZWxsYXRpb25FcnJvcihlcnJvcikpIHtcblx0XHRcdGNvbnN0IGFjdGlvbnM6IElBY3Rpb25bXSA9IFt0b0FjdGlvbih7IGlkOiAnd29ya2JlbmNoLmFjdGlvbi5maWxlcy5zYXZlRWRpdG9ycycsIGxhYmVsOiBubHMubG9jYWxpemUoJ3JldHJ5JywgXCJSZXRyeVwiKSwgcnVuOiAoKSA9PiBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBkb1NhdmVFZGl0b3JzKGFjY2Vzc29yLCBlZGl0b3JzLCBvcHRpb25zKSkgfSldO1xuXHRcdFx0Y29uc3QgZWRpdG9yc1RvUmV2ZXJ0ID0gZWRpdG9ycy5maWx0ZXIoKHsgZWRpdG9yIH0pID0+ICFlZGl0b3IuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5VbnRpdGxlZCkgLyogYWxsIGV4Y2VwdCB1bnRpdGxlZCB0byBwcmV2ZW50IHVuZXhwZWN0ZWQgZGF0YS1sb3NzICovKTtcblx0XHRcdGlmIChlZGl0b3JzVG9SZXZlcnQubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRhY3Rpb25zLnB1c2godG9BY3Rpb24oeyBpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZmlsZXMucmV2ZXJ0RWRpdG9ycycsIGxhYmVsOiBlZGl0b3JzVG9SZXZlcnQubGVuZ3RoID4gMSA/IG5scy5sb2NhbGl6ZSgncmV2ZXJ0QWxsJywgXCJSZXZlcnQgQWxsXCIpIDogbmxzLmxvY2FsaXplKCdyZXZlcnQnLCBcIlJldmVydFwiKSwgcnVuOiAoKSA9PiBlZGl0b3JTZXJ2aWNlLnJldmVydChlZGl0b3JzVG9SZXZlcnQpIH0pKTtcblx0XHRcdH1cblxuXHRcdFx0bm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoe1xuXHRcdFx0XHRpZDogZWRpdG9ycy5tYXAoKHsgZWRpdG9yIH0pID0+IGhhc2goZWRpdG9yLnJlc291cmNlPy50b1N0cmluZygpKSkuam9pbigpLCAvLyBlbnN1cmUgdW5pcXVlIG5vdGlmaWNhdGlvbiBJRCBwZXIgc2V0IG9mIGVkaXRvclxuXHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSh7IGtleTogJ2dlbmVyaWNTYXZlRXJyb3InLCBjb21tZW50OiBbJ3swfSBpcyB0aGUgcmVzb3VyY2UgdGhhdCBmYWlsZWQgdG8gc2F2ZSBhbmQgezF9IHRoZSBlcnJvciBtZXNzYWdlJ10gfSwgXCJGYWlsZWQgdG8gc2F2ZSAnezB9JzogezF9XCIsIGVkaXRvcnMubWFwKCh7IGVkaXRvciB9KSA9PiBlZGl0b3IuZ2V0TmFtZSgpKS5qb2luKCcsICcpLCB0b0Vycm9yTWVzc2FnZShlcnJvciwgZmFsc2UpKSxcblx0XHRcdFx0YWN0aW9uczogeyBwcmltYXJ5OiBhY3Rpb25zIH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufVxuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0d2hlbjogdW5kZWZpbmVkLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVMsXG5cdGlkOiBTQVZFX0ZJTEVfQ09NTUFORF9JRCxcblx0aGFuZGxlcjogYWNjZXNzb3IgPT4ge1xuXHRcdHJldHVybiBzYXZlU2VsZWN0ZWRFZGl0b3JzKGFjY2Vzc29yLCB7IHJlYXNvbjogU2F2ZVJlYXNvbi5FWFBMSUNJVCwgZm9yY2U6IHRydWUgLyogZm9yY2Ugc2F2ZSBldmVuIHdoZW4gbm9uLWRpcnR5ICovIH0pO1xuXHR9XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdHdoZW46IHVuZGVmaW5lZCxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlDb2RlLktleVMpLFxuXHR3aW46IHsgcHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlTKSB9LFxuXHRpZDogU0FWRV9GSUxFX1dJVEhPVVRfRk9STUFUVElOR19DT01NQU5EX0lELFxuXHRoYW5kbGVyOiBhY2Nlc3NvciA9PiB7XG5cdFx0cmV0dXJuIHNhdmVTZWxlY3RlZEVkaXRvcnMoYWNjZXNzb3IsIHsgcmVhc29uOiBTYXZlUmVhc29uLkVYUExJQ0lULCBmb3JjZTogdHJ1ZSAvKiBmb3JjZSBzYXZlIGV2ZW4gd2hlbiBub24tZGlydHkgKi8sIHNraXBTYXZlUGFydGljaXBhbnRzOiB0cnVlIH0pO1xuXHR9XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBTQVZFX0ZJTEVfQVNfQ09NTUFORF9JRCxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHdoZW46IHVuZGVmaW5lZCxcblx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleVMsXG5cdGhhbmRsZXI6IGFjY2Vzc29yID0+IHtcblx0XHRyZXR1cm4gc2F2ZVNlbGVjdGVkRWRpdG9ycyhhY2Nlc3NvciwgeyByZWFzb246IFNhdmVSZWFzb24uRVhQTElDSVQsIHNhdmVBczogdHJ1ZSB9KTtcblx0fVxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHR3aGVuOiB1bmRlZmluZWQsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRwcmltYXJ5OiB1bmRlZmluZWQsXG5cdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLktleVMgfSxcblx0d2luOiB7IHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlDb2RlLktleVMpIH0sXG5cdGlkOiBTQVZFX0FMTF9DT01NQU5EX0lELFxuXHRoYW5kbGVyOiBhY2Nlc3NvciA9PiB7XG5cdFx0cmV0dXJuIHNhdmVEaXJ0eUVkaXRvcnNPZkdyb3VwcyhhY2Nlc3NvciwgYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKS5nZXRHcm91cHMoR3JvdXBzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLCB7IHJlYXNvbjogU2F2ZVJlYXNvbi5FWFBMSUNJVCB9KTtcblx0fVxufSk7XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0aWQ6IFNBVkVfQUxMX0lOX0dST1VQX0NPTU1BTkRfSUQsXG5cdGhhbmRsZXI6IChhY2Nlc3NvciwgXzogVVJJIHwgb2JqZWN0LCBlZGl0b3JDb250ZXh0OiBJRWRpdG9yQ29tbWFuZHNDb250ZXh0KSA9PiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cblx0XHRjb25zdCByZXNvbHZlZENvbnRleHQgPSByZXNvbHZlQ29tbWFuZHNDb250ZXh0KFtlZGl0b3JDb250ZXh0XSwgYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKSwgZWRpdG9yR3JvdXBzU2VydmljZSwgYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSkpO1xuXG5cdFx0bGV0IGdyb3VwczogcmVhZG9ubHkgSUVkaXRvckdyb3VwW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKCFyZXNvbHZlZENvbnRleHQuZ3JvdXBlZEVkaXRvcnMubGVuZ3RoKSB7XG5cdFx0XHRncm91cHMgPSBlZGl0b3JHcm91cHNTZXJ2aWNlLmdldEdyb3VwcyhHcm91cHNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGdyb3VwcyA9IHJlc29sdmVkQ29udGV4dC5ncm91cGVkRWRpdG9ycy5tYXAoKHsgZ3JvdXAgfSkgPT4gZ3JvdXApO1xuXHRcdH1cblxuXHRcdHJldHVybiBzYXZlRGlydHlFZGl0b3JzT2ZHcm91cHMoYWNjZXNzb3IsIGdyb3VwcywgeyByZWFzb246IFNhdmVSZWFzb24uRVhQTElDSVQgfSk7XG5cdH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBTQVZFX0ZJTEVTX0NPTU1BTkRfSUQsXG5cdGhhbmRsZXI6IGFzeW5jIGFjY2Vzc29yID0+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHJlcyA9IGF3YWl0IGVkaXRvclNlcnZpY2Uuc2F2ZUFsbCh7IGluY2x1ZGVVbnRpdGxlZDogZmFsc2UsIHJlYXNvbjogU2F2ZVJlYXNvbi5FWFBMSUNJVCB9KTtcblx0XHRyZXR1cm4gcmVzLnN1Y2Nlc3M7XG5cdH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBSRVZFUlRfRklMRV9DT01NQU5EX0lELFxuXHRoYW5kbGVyOiBhc3luYyBhY2Nlc3NvciA9PiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblxuXHRcdC8vIFJldHJpZXZlIHNlbGVjdGVkIG9yIGFjdGl2ZSBlZGl0b3Jcblx0XHRsZXQgZWRpdG9ycyA9IGdldE9wZW5FZGl0b3JzVmlld011bHRpU2VsZWN0aW9uKGFjY2Vzc29yKTtcblx0XHRpZiAoIWVkaXRvcnMpIHtcblx0XHRcdGNvbnN0IGFjdGl2ZUdyb3VwID0gZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwO1xuXHRcdFx0aWYgKGFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvcikge1xuXHRcdFx0XHRlZGl0b3JzID0gW3sgZ3JvdXBJZDogYWN0aXZlR3JvdXAuaWQsIGVkaXRvcjogYWN0aXZlR3JvdXAuYWN0aXZlRWRpdG9yIH1dO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghZWRpdG9ycyB8fCBlZGl0b3JzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuOyAvLyBub3RoaW5nIHRvIHJldmVydFxuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLnJldmVydChlZGl0b3JzLmZpbHRlcigoeyBlZGl0b3IgfSkgPT4gIWVkaXRvci5oYXNDYXBhYmlsaXR5KEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLlVudGl0bGVkKSAvKiBhbGwgZXhjZXB0IHVudGl0bGVkICovKSwgeyBmb3JjZTogdHJ1ZSB9KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKG5scy5sb2NhbGl6ZSgnZ2VuZXJpY1JldmVydEVycm9yJywgXCJGYWlsZWQgdG8gcmV2ZXJ0ICd7MH0nOiB7MX1cIiwgZWRpdG9ycy5tYXAoKHsgZWRpdG9yIH0pID0+IGVkaXRvci5nZXROYW1lKCkpLmpvaW4oJywgJyksIHRvRXJyb3JNZXNzYWdlKGVycm9yLCBmYWxzZSkpKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBSRU1PVkVfUk9PVF9GT0xERVJfQ09NTUFORF9JRCxcblx0aGFuZGxlcjogKGFjY2Vzc29yLCByZXNvdXJjZTogVVJJIHwgb2JqZWN0KSA9PiB7XG5cdFx0Y29uc3QgY29udGV4dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTtcblx0XHRjb25zdCB1cmlJZGVudGl0eVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVyaUlkZW50aXR5U2VydmljZSk7XG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCk7XG5cdFx0Y29uc3QgcmVzb3VyY2VzID0gZ2V0TXVsdGlTZWxlY3RlZFJlc291cmNlcyhyZXNvdXJjZSwgYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSksIGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSksIGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSksIGFjY2Vzc29yLmdldChJRXhwbG9yZXJTZXJ2aWNlKSkuZmlsdGVyKHJlc291cmNlID0+XG5cdFx0XHR3b3Jrc3BhY2UuZm9sZGVycy5zb21lKGZvbGRlciA9PiB1cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoZm9sZGVyLnVyaSwgcmVzb3VyY2UpKSAvLyBOZWVkIHRvIHZlcmlmeSByZXNvdXJjZXMgYXJlIHdvcmtzcGFjZXMgc2luY2UgbXVsdGkgc2VsZWN0aW9uIGNhbiB0cmlnZ2VyIHRoaXMgY29tbWFuZCBvbiBzb21lIG5vbiB3b3Jrc3BhY2UgcmVzb3VyY2VzXG5cdFx0KTtcblxuXHRcdGlmIChyZXNvdXJjZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdFx0Ly8gU2hvdyBhIHBpY2tlciBmb3IgdGhlIHVzZXIgdG8gY2hvb3NlIHdoaWNoIGZvbGRlciB0byByZW1vdmVcblx0XHRcdHJldHVybiBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChSZW1vdmVSb290Rm9sZGVyQWN0aW9uLklEKTtcblx0XHR9XG5cblx0XHRjb25zdCB3b3Jrc3BhY2VFZGl0aW5nU2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya3NwYWNlRWRpdGluZ1NlcnZpY2UpO1xuXHRcdHJldHVybiB3b3Jrc3BhY2VFZGl0aW5nU2VydmljZS5yZW1vdmVGb2xkZXJzKHJlc291cmNlcyk7XG5cdH1cbn0pO1xuXG4vLyBDb21wcmVzc2VkIGl0ZW0gbmF2aWdhdGlvblxuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAxMCxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEZpbGVzRXhwbG9yZXJGb2N1c0NvbmRpdGlvbiwgRXhwbG9yZXJDb21wcmVzc2VkRm9jdXNDb250ZXh0LCBFeHBsb3JlckNvbXByZXNzZWRGaXJzdEZvY3VzQ29udGV4dC5uZWdhdGUoKSksXG5cdHByaW1hcnk6IEtleUNvZGUuTGVmdEFycm93LFxuXHRpZDogUFJFVklPVVNfQ09NUFJFU1NFRF9GT0xERVIsXG5cdGhhbmRsZXI6IGFjY2Vzc29yID0+IHtcblx0XHRjb25zdCBwYW5lQ29tcG9zaXRlU2VydmljZSA9IGFjY2Vzc29yLmdldChJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlKTtcblx0XHRjb25zdCB2aWV3bGV0ID0gcGFuZUNvbXBvc2l0ZVNlcnZpY2UuZ2V0QWN0aXZlUGFuZUNvbXBvc2l0ZShWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cblx0XHRpZiAodmlld2xldD8uZ2V0SWQoKSAhPT0gVklFV0xFVF9JRCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4cGxvcmVyID0gdmlld2xldC5nZXRWaWV3UGFuZUNvbnRhaW5lcigpIGFzIEV4cGxvcmVyVmlld1BhbmVDb250YWluZXI7XG5cdFx0Y29uc3QgdmlldyA9IGV4cGxvcmVyLmdldEV4cGxvcmVyVmlldygpO1xuXHRcdHZpZXcucHJldmlvdXNDb21wcmVzc2VkU3RhdCgpO1xuXHR9XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgMTAsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChGaWxlc0V4cGxvcmVyRm9jdXNDb25kaXRpb24sIEV4cGxvcmVyQ29tcHJlc3NlZEZvY3VzQ29udGV4dCwgRXhwbG9yZXJDb21wcmVzc2VkTGFzdEZvY3VzQ29udGV4dC5uZWdhdGUoKSksXG5cdHByaW1hcnk6IEtleUNvZGUuUmlnaHRBcnJvdyxcblx0aWQ6IE5FWFRfQ09NUFJFU1NFRF9GT0xERVIsXG5cdGhhbmRsZXI6IGFjY2Vzc29yID0+IHtcblx0XHRjb25zdCBwYW5lQ29tcG9zaXRlU2VydmljZSA9IGFjY2Vzc29yLmdldChJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlKTtcblx0XHRjb25zdCB2aWV3bGV0ID0gcGFuZUNvbXBvc2l0ZVNlcnZpY2UuZ2V0QWN0aXZlUGFuZUNvbXBvc2l0ZShWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cblx0XHRpZiAodmlld2xldD8uZ2V0SWQoKSAhPT0gVklFV0xFVF9JRCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4cGxvcmVyID0gdmlld2xldC5nZXRWaWV3UGFuZUNvbnRhaW5lcigpIGFzIEV4cGxvcmVyVmlld1BhbmVDb250YWluZXI7XG5cdFx0Y29uc3QgdmlldyA9IGV4cGxvcmVyLmdldEV4cGxvcmVyVmlldygpO1xuXHRcdHZpZXcubmV4dENvbXByZXNzZWRTdGF0KCk7XG5cdH1cbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAxMCxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEZpbGVzRXhwbG9yZXJGb2N1c0NvbmRpdGlvbiwgRXhwbG9yZXJDb21wcmVzc2VkRm9jdXNDb250ZXh0LCBFeHBsb3JlckNvbXByZXNzZWRGaXJzdEZvY3VzQ29udGV4dC5uZWdhdGUoKSksXG5cdHByaW1hcnk6IEtleUNvZGUuSG9tZSxcblx0aWQ6IEZJUlNUX0NPTVBSRVNTRURfRk9MREVSLFxuXHRoYW5kbGVyOiBhY2Nlc3NvciA9PiB7XG5cdFx0Y29uc3QgcGFuZUNvbXBvc2l0ZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSk7XG5cdFx0Y29uc3Qgdmlld2xldCA9IHBhbmVDb21wb3NpdGVTZXJ2aWNlLmdldEFjdGl2ZVBhbmVDb21wb3NpdGUoVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXG5cdFx0aWYgKHZpZXdsZXQ/LmdldElkKCkgIT09IFZJRVdMRVRfSUQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBleHBsb3JlciA9IHZpZXdsZXQuZ2V0Vmlld1BhbmVDb250YWluZXIoKSBhcyBFeHBsb3JlclZpZXdQYW5lQ29udGFpbmVyO1xuXHRcdGNvbnN0IHZpZXcgPSBleHBsb3Jlci5nZXRFeHBsb3JlclZpZXcoKTtcblx0XHR2aWV3LmZpcnN0Q29tcHJlc3NlZFN0YXQoKTtcblx0fVxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDEwLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRmlsZXNFeHBsb3JlckZvY3VzQ29uZGl0aW9uLCBFeHBsb3JlckNvbXByZXNzZWRGb2N1c0NvbnRleHQsIEV4cGxvcmVyQ29tcHJlc3NlZExhc3RGb2N1c0NvbnRleHQubmVnYXRlKCkpLFxuXHRwcmltYXJ5OiBLZXlDb2RlLkVuZCxcblx0aWQ6IExBU1RfQ09NUFJFU1NFRF9GT0xERVIsXG5cdGhhbmRsZXI6IGFjY2Vzc29yID0+IHtcblx0XHRjb25zdCBwYW5lQ29tcG9zaXRlU2VydmljZSA9IGFjY2Vzc29yLmdldChJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlKTtcblx0XHRjb25zdCB2aWV3bGV0ID0gcGFuZUNvbXBvc2l0ZVNlcnZpY2UuZ2V0QWN0aXZlUGFuZUNvbXBvc2l0ZShWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cblx0XHRpZiAodmlld2xldD8uZ2V0SWQoKSAhPT0gVklFV0xFVF9JRCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4cGxvcmVyID0gdmlld2xldC5nZXRWaWV3UGFuZUNvbnRhaW5lcigpIGFzIEV4cGxvcmVyVmlld1BhbmVDb250YWluZXI7XG5cdFx0Y29uc3QgdmlldyA9IGV4cGxvcmVyLmdldEV4cGxvcmVyVmlldygpO1xuXHRcdHZpZXcubGFzdENvbXByZXNzZWRTdGF0KCk7XG5cdH1cbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHdoZW46IG51bGwsXG5cdHByaW1hcnk6IGlzV2ViID8gKGlzV2luZG93cyA/IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlDb2RlLktleU4pIDogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5LZXlOKSA6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlOLFxuXHRzZWNvbmRhcnk6IGlzV2ViID8gW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlOXSA6IHVuZGVmaW5lZCxcblx0aWQ6IE5FV19VTlRJVExFRF9GSUxFX0NPTU1BTkRfSUQsXG5cdG1ldGFkYXRhOiB7XG5cdFx0ZGVzY3JpcHRpb246IE5FV19VTlRJVExFRF9GSUxFX0xBQkVMLFxuXHRcdGFyZ3M6IFtcblx0XHRcdHtcblx0XHRcdFx0aXNPcHRpb25hbDogdHJ1ZSxcblx0XHRcdFx0bmFtZTogJ05ldyBVbnRpdGxlZCBUZXh0IEZpbGUgYXJndW1lbnRzJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246ICdUaGUgZWRpdG9yIHZpZXcgdHlwZSBvciBsYW5ndWFnZSBJRCBpZiBrbm93bicsXG5cdFx0XHRcdHNjaGVtYToge1xuXHRcdFx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdFx0XHQndmlld1R5cGUnOiB7XG5cdFx0XHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZydcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHQnbGFuZ3VhZ2VJZCc6IHtcblx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdF1cblx0fSxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yLCBhcmdzPzogeyBsYW5ndWFnZUlkPzogc3RyaW5nOyB2aWV3VHlwZT86IHN0cmluZyB9KSA9PiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cblx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0cmVzb3VyY2U6IHVuZGVmaW5lZCxcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0b3ZlcnJpZGU6IGFyZ3M/LnZpZXdUeXBlLFxuXHRcdFx0XHRwaW5uZWQ6IHRydWVcblx0XHRcdH0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhcmdzPy5sYW5ndWFnZUlkLFxuXHRcdH0pO1xuXHR9XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogTkVXX0ZJTEVfQ09NTUFORF9JRCxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yLCBhcmdzPzogeyBsYW5ndWFnZUlkPzogc3RyaW5nOyB2aWV3VHlwZT86IHN0cmluZzsgZmlsZU5hbWU/OiBzdHJpbmcgfSkgPT4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVEaWFsb2dTZXJ2aWNlKTtcblx0XHRjb25zdCBmaWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZVNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgY3JlYXRlRmlsZUxvY2FsaXplZCA9IG5scy5sb2NhbGl6ZSgnbmV3RmlsZUNvbW1hbmQuc2F2ZUxhYmVsJywgXCJDcmVhdGUgRmlsZVwiKTtcblx0XHRjb25zdCBkZWZhdWx0RmlsZVVyaSA9IGpvaW5QYXRoKGF3YWl0IGRpYWxvZ1NlcnZpY2UuZGVmYXVsdEZpbGVQYXRoKCksIGFyZ3M/LmZpbGVOYW1lID8/ICdVbnRpdGxlZC50eHQnKTtcblxuXHRcdGNvbnN0IHNhdmVVcmkgPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLnNob3dTYXZlRGlhbG9nKHsgc2F2ZUxhYmVsOiBjcmVhdGVGaWxlTG9jYWxpemVkLCB0aXRsZTogY3JlYXRlRmlsZUxvY2FsaXplZCwgZGVmYXVsdFVyaTogZGVmYXVsdEZpbGVVcmkgfSk7XG5cblx0XHRpZiAoIXNhdmVVcmkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCBmaWxlU2VydmljZS5jcmVhdGVGaWxlKHNhdmVVcmksIHVuZGVmaW5lZCwgeyBvdmVyd3JpdGU6IHRydWUgfSk7XG5cblx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0cmVzb3VyY2U6IHNhdmVVcmksXG5cdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdG92ZXJyaWRlOiBhcmdzPy52aWV3VHlwZSxcblx0XHRcdFx0cGlubmVkOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0bGFuZ3VhZ2VJZDogYXJncz8ubGFuZ3VhZ2VJZCxcblx0XHR9KTtcblx0fVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFNBQVM7QUFFckIsU0FBUyx3QkFBZ0Qsa0JBQXFDLFlBQVksY0FBYywrQkFBK0I7QUFDdkosU0FBUyw2QkFBNkI7QUFDdEMsU0FBOEMseUJBQWtEO0FBQ2hHLFNBQVMsb0JBQW9CO0FBQzdCLFNBQTJCLDZCQUE2QjtBQUN4RCxTQUFTLDBCQUEwQiwrQkFBK0I7QUFDbEUsU0FBUyx3QkFBd0IseUJBQXlCLFlBQVksZ0NBQWdDLHFDQUFxQyxvQ0FBb0MsNkJBQTZCLHVCQUF1QixlQUFlO0FBRWxQLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsa0JBQW1DLHVCQUF1QjtBQUNuRSxTQUFzQixvQkFBb0Isc0JBQXNCO0FBQ2hFLFNBQVMs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QUFBLFFBQ0MsWUFBWTtBQUFBLFFBQ1osTUFBTTtBQUFBLFFBQ04sYUFBYTtBQUFBLFFBQ2IsUUFBUTtBQUFBLFVBQ1AsUUFBUTtBQUFBLFVBQ1IsY0FBYztBQUFBLFlBQ2IsWUFBWTtBQUFBLGNBQ1gsUUFBUTtBQUFBLFlBQ1Q7QUFBQSxZQUNBLGNBQWM7QUFBQSxjQUNiLFFBQVE7QUFBQSxZQUNUO0FBQUEsVUFDRDtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUNBLFNBQVMsT0FBTyxVQUFVLFNBQXNEO0FBQy9FLFVBQU0sZ0JBQWdCLFNBQVMsSUFBSSxjQUFjO0FBRWpELFVBQU0sY0FBYyxXQUFXO0FBQUEsTUFDOUIsVUFBVTtBQUFBLE1BQ1YsU0FBUztBQUFBLFFBQ1IsVUFBVSxNQUFNO0FBQUEsUUFDaEIsUUFBUTtBQUFBLE1BQ1Q7QUFBQSxNQUNBLFlBQVksTUFBTTtBQUFBLElBQ25CLENBQUM7QUFBQSxFQUNGO0FBQ0QsQ0FBQztBQUVELGlCQUFpQixnQkFBZ0I7QUFBQSxFQUNoQyxJQUFJO0FBQUEsRUFDSixTQUFTLE9BQU8sVUFBVSxTQUF5RTtBQUNsRyxVQUFNLGdCQUFnQixTQUFTLElBQUksY0FBYztBQUNqRCxVQUFNLGdCQUFnQixTQUFTLElBQUksa0JBQWtCO0FBQ3JELFVBQU0sY0FBYyxTQUFTLElBQUksWUFBWTtBQUU3QyxVQUFNLHNCQUFzQixJQUFJLFNBQVMsNEJBQTRCLGFBQWE7QUFDbEYsVUFBTSxpQkFBaUIsU0FBUyxNQUFNLGNBQWMsZ0JBQWdCLEdBQUcsTUFBTSxZQUFZLGNBQWM7QUFFdkcsVUFBTSxVQUFVLE1BQU0sY0FBYyxlQUFlLEVBQUUsV0FBVyxxQkFBcUIsT0FBTyxxQkFBcUIsWUFBWSxlQUFlLENBQUM7QUFFN0ksUUFBSSxDQUFDLFNBQVM7QUFDYjtBQUFBLElBQ0Q7QUFFQSxVQUFNLFlBQVksV0FBVyxTQUFTLFFBQVcsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUVwRSxVQUFNLGNBQWMsV0FBVztBQUFBLE1BQzlCLFVBQVU7QUFBQSxNQUNWLFNBQVM7QUFBQSxRQUNSLFVBQVUsTUFBTTtBQUFBLFFBQ2hCLFFBQVE7QUFBQSxNQUNUO0FBQUEsTUFDQSxZQUFZLE1BQU07QUFBQSxJQUNuQixDQUFDO0FBQUEsRUFDRjtBQUNELENBQUM7IiwKICAibmFtZXMiOiBbInJlc291cmNlIiwgImFjY2Vzc29yIl0KfQo=
