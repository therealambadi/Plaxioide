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
import { Iterable } from "../../../../base/common/iterator.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { parse } from "../../../../base/common/marshalling.js";
import { Schemas } from "../../../../base/common/network.js";
import { extname, isEqual } from "../../../../base/common/resources.js";
import { isFalsyOrWhitespace } from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
import { IBulkEditService } from "../../../../editor/browser/services/bulkEditService.js";
import { EditOperation } from "../../../../editor/common/core/editOperation.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../editor/common/languages/modesRegistry.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { peekViewBorder } from "../../../../editor/contrib/peekView/browser/peekView.js";
import { Context as SuggestContext } from "../../../../editor/contrib/suggest/browser/suggest.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { EditorActivation } from "../../../../platform/editor/common/editor.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { contrastBorder, ifDefinedThenElse, listInactiveSelectionBackground, registerColor } from "../../../../platform/theme/common/colorRegistry.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { EditorExtensions, EditorsOrder } from "../../../common/editor.js";
import { PANEL_BORDER } from "../../../common/theme.js";
import { ResourceNotebookCellEdit } from "../../bulkEdit/browser/bulkCellEdits.js";
import { ReplEditorSettings, INTERACTIVE_INPUT_CURSOR_BOUNDARY } from "./interactiveCommon.js";
import { IInteractiveDocumentService, InteractiveDocumentService } from "./interactiveDocumentService.js";
import { InteractiveEditor } from "./interactiveEditor.js";
import { InteractiveEditorInput } from "./interactiveEditorInput.js";
import { IInteractiveHistoryService, InteractiveHistoryService } from "./interactiveHistoryService.js";
import { NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT } from "../../notebook/browser/controller/coreActions.js";
import * as icons from "../../notebook/browser/notebookIcons.js";
import { INotebookEditorService } from "../../notebook/browser/services/notebookEditorService.js";
import { CellEditType, CellKind, CellUri, INTERACTIVE_WINDOW_EDITOR_ID, NotebookSetting, NotebookWorkingCopyTypeIdentifier } from "../../notebook/common/notebookCommon.js";
import { InteractiveWindowOpen, IS_COMPOSITE_NOTEBOOK, NOTEBOOK_EDITOR_FOCUSED } from "../../notebook/common/notebookContextKeys.js";
import { INotebookKernelService } from "../../notebook/common/notebookKernelService.js";
import { INotebookService } from "../../notebook/common/notebookService.js";
import { columnToEditorGroup } from "../../../services/editor/common/editorGroupColumn.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorResolverService, RegisteredEditorPriority } from "../../../services/editor/common/editorResolverService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IWorkingCopyEditorService } from "../../../services/workingCopy/common/workingCopyEditorService.js";
import { isReplEditorControl } from "../../replNotebook/browser/replEditor.js";
import { InlineChatController } from "../../inlineChat/browser/inlineChatController.js";
import { IsLinuxContext, IsWindowsContext } from "../../../../platform/contextkey/common/contextkeys.js";
const interactiveWindowCategory = localize2("interactiveWindow", "Interactive Window");
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    InteractiveEditor,
    INTERACTIVE_WINDOW_EDITOR_ID,
    "Interactive Window"
  ),
  [
    new SyncDescriptor(InteractiveEditorInput)
  ]
);
let InteractiveDocumentContribution = class extends Disposable {
  constructor(notebookService, editorResolverService, editorService, instantiationService) {
    super();
    this.instantiationService = instantiationService;
    const info = notebookService.getContributedNotebookType("interactive");
    if (!info) {
      this._register(notebookService.registerContributedNotebookType("interactive", {
        providerDisplayName: "Interactive Notebook",
        displayName: "Interactive",
        filenamePattern: ["*.interactive"],
        priority: RegisteredEditorPriority.builtin
      }));
    }
    editorResolverService.registerEditor(
      `${Schemas.vscodeInteractiveInput}:/**`,
      {
        id: "vscode-interactive-input",
        label: "Interactive Editor",
        priority: RegisteredEditorPriority.exclusive
      },
      {
        canSupportResource: (uri) => uri.scheme === Schemas.vscodeInteractiveInput,
        singlePerResource: true
      },
      {
        createEditorInput: ({ resource }) => {
          const editorInput = editorService.getEditors(EditorsOrder.SEQUENTIAL).find((editor) => editor.editor instanceof InteractiveEditorInput && editor.editor.inputResource.toString() === resource.toString());
          return editorInput;
        }
      }
    );
    editorResolverService.registerEditor(
      `*.interactive`,
      {
        id: "interactive",
        label: "Interactive Editor",
        priority: RegisteredEditorPriority.exclusive
      },
      {
        canSupportResource: (uri) => uri.scheme === Schemas.untitled && extname(uri) === ".interactive" || uri.scheme === Schemas.vscodeNotebookCell && extname(uri) === ".interactive",
        singlePerResource: true
      },
      {
        createEditorInput: ({ resource, options }) => {
          const data = CellUri.parse(resource);
          let cellOptions;
          let iwResource = resource;
          if (data) {
            cellOptions = { resource, options };
            iwResource = data.notebook;
          }
          const notebookOptions = {
            ...options,
            cellOptions,
            cellRevealType: void 0,
            cellSelections: void 0,
            isReadOnly: void 0,
            viewState: void 0,
            indexedCellOptions: void 0
          };
          const editorInput = createEditor(iwResource, this.instantiationService);
          return {
            editor: editorInput,
            options: notebookOptions
          };
        },
        createUntitledEditorInput: ({ resource, options }) => {
          if (!resource) {
            throw new Error("Interactive window editors must have a resource name");
          }
          const data = CellUri.parse(resource);
          let cellOptions;
          if (data) {
            cellOptions = { resource, options };
          }
          const notebookOptions = {
            ...options,
            cellOptions,
            cellRevealType: void 0,
            cellSelections: void 0,
            isReadOnly: void 0,
            viewState: void 0,
            indexedCellOptions: void 0
          };
          const editorInput = createEditor(resource, this.instantiationService);
          return {
            editor: editorInput,
            options: notebookOptions
          };
        }
      }
    );
  }
};
InteractiveDocumentContribution.ID = "workbench.contrib.interactiveDocument";
InteractiveDocumentContribution = __decorateClass([
  __decorateParam(0, INotebookService),
  __decorateParam(1, IEditorResolverService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IInstantiationService)
], InteractiveDocumentContribution);
let InteractiveInputContentProvider = class {
  constructor(textModelService, _modelService) {
    this._modelService = _modelService;
    this._registration = textModelService.registerTextModelContentProvider(Schemas.vscodeInteractiveInput, this);
  }
  dispose() {
    this._registration.dispose();
  }
  async provideTextContent(resource) {
    const existing = this._modelService.getModel(resource);
    if (existing) {
      return existing;
    }
    const result = this._modelService.createModel("", null, resource, false);
    return result;
  }
};
InteractiveInputContentProvider.ID = "workbench.contrib.interactiveInputContentProvider";
InteractiveInputContentProvider = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, IModelService)
], InteractiveInputContentProvider);
function createEditor(resource, instantiationService) {
  const counter = /\/Interactive-(\d+)/.exec(resource.path);
  const inputBoxPath = counter && counter[1] ? `/InteractiveInput-${counter[1]}` : "InteractiveInput";
  const inputUri = URI.from({ scheme: Schemas.vscodeInteractiveInput, path: inputBoxPath });
  const editorInput = InteractiveEditorInput.create(instantiationService, resource, inputUri);
  return editorInput;
}
let InteractiveWindowWorkingCopyEditorHandler = class extends Disposable {
  constructor(_instantiationService, _workingCopyEditorService, _extensionService) {
    super();
    this._instantiationService = _instantiationService;
    this._workingCopyEditorService = _workingCopyEditorService;
    this._extensionService = _extensionService;
    this._installHandler();
  }
  handles(workingCopy) {
    const viewType = this._getViewType(workingCopy);
    return !!viewType && viewType === "interactive";
  }
  isOpen(workingCopy, editor) {
    if (!this.handles(workingCopy)) {
      return false;
    }
    return editor instanceof InteractiveEditorInput && isEqual(workingCopy.resource, editor.resource);
  }
  createEditor(workingCopy) {
    return createEditor(workingCopy.resource, this._instantiationService);
  }
  async _installHandler() {
    await this._extensionService.whenInstalledExtensionsRegistered();
    this._register(this._workingCopyEditorService.registerHandler(this));
  }
  _getViewType(workingCopy) {
    return NotebookWorkingCopyTypeIdentifier.parse(workingCopy.typeId)?.viewType;
  }
};
InteractiveWindowWorkingCopyEditorHandler.ID = "workbench.contrib.interactiveWindowWorkingCopyEditorHandler";
InteractiveWindowWorkingCopyEditorHandler = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkingCopyEditorService),
  __decorateParam(2, IExtensionService)
], InteractiveWindowWorkingCopyEditorHandler);
registerWorkbenchContribution2(InteractiveDocumentContribution.ID, InteractiveDocumentContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(InteractiveInputContentProvider.ID, InteractiveInputContentProvider, {
  editorTypeId: INTERACTIVE_WINDOW_EDITOR_ID
});
registerWorkbenchContribution2(InteractiveWindowWorkingCopyEditorHandler.ID, InteractiveWindowWorkingCopyEditorHandler, {
  editorTypeId: INTERACTIVE_WINDOW_EDITOR_ID
});
class InteractiveEditorSerializer {
  canSerialize(editor) {
    if (!(editor instanceof InteractiveEditorInput)) {
      return false;
    }
    return URI.isUri(editor.primary.resource) && URI.isUri(editor.inputResource);
  }
  serialize(input) {
    if (!this.canSerialize(input)) {
      return void 0;
    }
    return JSON.stringify({
      resource: input.primary.resource,
      inputResource: input.inputResource,
      name: input.getName(),
      language: input.language
    });
  }
  deserialize(instantiationService, raw) {
    const data = parse(raw);
    if (!data) {
      return void 0;
    }
    const { resource, inputResource, name, language } = data;
    if (!URI.isUri(resource) || !URI.isUri(inputResource)) {
      return void 0;
    }
    const input = InteractiveEditorInput.create(instantiationService, resource, inputResource, name, language);
    return input;
  }
}
InteractiveEditorSerializer.ID = InteractiveEditorInput.ID;
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(
  InteractiveEditorSerializer.ID,
  InteractiveEditorSerializer
);
registerSingleton(IInteractiveHistoryService, InteractiveHistoryService, InstantiationType.Delayed);
registerSingleton(IInteractiveDocumentService, InteractiveDocumentService, InstantiationType.Delayed);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "_interactive.open",
      title: localize2("interactive.open", "Open Interactive Window"),
      f1: false,
      category: interactiveWindowCategory,
      metadata: {
        description: localize("interactive.open", "Open Interactive Window"),
        args: [
          {
            name: "showOptions",
            description: "Show Options",
            schema: {
              type: "object",
              properties: {
                "viewColumn": {
                  type: "number",
                  default: -1
                },
                "preserveFocus": {
                  type: "boolean",
                  default: true
                }
              }
            }
          },
          {
            name: "resource",
            description: "Interactive resource Uri",
            isOptional: true
          },
          {
            name: "controllerId",
            description: "Notebook controller Id",
            isOptional: true
          },
          {
            name: "title",
            description: "Notebook editor title",
            isOptional: true
          }
        ]
      }
    });
  }
  async run(accessor, showOptions, resource, id, title) {
    const editorService = accessor.get(IEditorService);
    const editorGroupService = accessor.get(IEditorGroupsService);
    const historyService = accessor.get(IInteractiveHistoryService);
    const kernelService = accessor.get(INotebookKernelService);
    const logService = accessor.get(ILogService);
    const configurationService = accessor.get(IConfigurationService);
    const group = columnToEditorGroup(editorGroupService, configurationService, typeof showOptions === "number" ? showOptions : showOptions?.viewColumn);
    const editorOptions = {
      activation: EditorActivation.PRESERVE,
      preserveFocus: typeof showOptions !== "number" ? showOptions?.preserveFocus ?? false : false
    };
    if (resource && extname(resource) === ".interactive") {
      logService.debug("Open interactive window from resource:", resource.toString());
      const resourceUri = URI.revive(resource);
      const editors = editorService.findEditors(resourceUri).filter((id2) => id2.editor instanceof InteractiveEditorInput && id2.editor.resource?.toString() === resourceUri.toString());
      if (editors.length) {
        logService.debug("Find existing interactive window:", resource.toString());
        const editorInput2 = editors[0].editor;
        const currentGroup = editors[0].groupId;
        const editor = await editorService.openEditor(editorInput2, editorOptions, currentGroup);
        const editorControl2 = editor?.getControl();
        return {
          notebookUri: editorInput2.resource,
          inputUri: editorInput2.inputResource,
          notebookEditorId: editorControl2?.notebookEditor?.getId()
        };
      }
    }
    const existingNotebookDocument = /* @__PURE__ */ new Set();
    editorService.getEditors(EditorsOrder.SEQUENTIAL).forEach((editor) => {
      if (editor.editor.resource) {
        existingNotebookDocument.add(editor.editor.resource.toString());
      }
    });
    let notebookUri = void 0;
    let inputUri = void 0;
    let counter = 1;
    do {
      notebookUri = URI.from({ scheme: Schemas.untitled, path: `/Interactive-${counter}.interactive` });
      inputUri = URI.from({ scheme: Schemas.vscodeInteractiveInput, path: `/InteractiveInput-${counter}` });
      counter++;
    } while (existingNotebookDocument.has(notebookUri.toString()));
    InteractiveEditorInput.setName(notebookUri, title);
    logService.debug("Open new interactive window:", notebookUri.toString(), inputUri.toString());
    if (id) {
      const allKernels = kernelService.getMatchingKernel({ uri: notebookUri, notebookType: "interactive" }).all;
      const preferredKernel = allKernels.find((kernel) => kernel.id === id);
      if (preferredKernel) {
        kernelService.preselectKernelForNotebook(preferredKernel, { uri: notebookUri, notebookType: "interactive" });
      }
    }
    historyService.clearHistory(notebookUri);
    const editorInput = { resource: notebookUri, options: editorOptions };
    const editorPane = await editorService.openEditor(editorInput, group);
    const editorControl = editorPane?.getControl();
    logService.debug("New interactive window opened. Notebook editor id", editorControl?.notebookEditor?.getId());
    return { notebookUri, inputUri, notebookEditorId: editorControl?.notebookEditor?.getId() };
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "interactive.execute",
      title: localize2("interactive.execute", "Execute Code"),
      category: interactiveWindowCategory,
      keybinding: [{
        // when: NOTEBOOK_CELL_LIST_FOCUSED,
        when: ContextKeyExpr.and(
          IS_COMPOSITE_NOTEBOOK,
          ContextKeyExpr.equals("activeEditor", "workbench.editor.interactive")
        ),
        primary: KeyMod.CtrlCmd | KeyCode.Enter,
        weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
      }, {
        when: ContextKeyExpr.and(
          IS_COMPOSITE_NOTEBOOK,
          ContextKeyExpr.equals("activeEditor", "workbench.editor.interactive"),
          ContextKeyExpr.equals("config.interactiveWindow.executeWithShiftEnter", true)
        ),
        primary: KeyMod.Shift | KeyCode.Enter,
        weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
      }, {
        when: ContextKeyExpr.and(
          IS_COMPOSITE_NOTEBOOK,
          ContextKeyExpr.equals("activeEditor", "workbench.editor.interactive"),
          ContextKeyExpr.equals("config.interactiveWindow.executeWithShiftEnter", false)
        ),
        primary: KeyCode.Enter,
        weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
      }],
      menu: [
        {
          id: MenuId.InteractiveInputExecute
        }
      ],
      icon: icons.executeIcon,
      f1: false,
      metadata: {
        description: "Execute the Contents of the Input Box",
        args: [
          {
            name: "resource",
            description: "Interactive resource Uri",
            isOptional: true
          }
        ]
      }
    });
  }
  async run(accessor, context) {
    const editorService = accessor.get(IEditorService);
    const bulkEditService = accessor.get(IBulkEditService);
    const historyService = accessor.get(IInteractiveHistoryService);
    const notebookEditorService = accessor.get(INotebookEditorService);
    let editorControl;
    if (context) {
      const resourceUri = URI.revive(context);
      const editors = editorService.findEditors(resourceUri);
      for (const found of editors) {
        if (found.editor.typeId === InteractiveEditorInput.ID) {
          const editor = await editorService.openEditor(found.editor, found.groupId);
          editorControl = editor?.getControl();
          break;
        }
      }
    } else {
      editorControl = editorService.activeEditorPane?.getControl();
    }
    if (editorControl && isReplEditorControl(editorControl) && editorControl.notebookEditor) {
      const notebookDocument = editorControl.notebookEditor.textModel;
      const textModel = editorControl.activeCodeEditor?.getModel();
      const activeKernel = editorControl.notebookEditor.activeKernel;
      const language = activeKernel?.supportedLanguages[0] ?? PLAINTEXT_LANGUAGE_ID;
      if (notebookDocument && textModel && editorControl.activeCodeEditor) {
        const index = notebookDocument.length;
        const value = textModel.getValue();
        if (isFalsyOrWhitespace(value)) {
          return;
        }
        const ctrl = InlineChatController.get(editorControl.activeCodeEditor);
        if (ctrl) {
          ctrl.acceptSession();
        }
        historyService.replaceLast(notebookDocument.uri, value);
        historyService.addToHistory(notebookDocument.uri, "");
        textModel.setValue("");
        const collapseState = editorControl.notebookEditor.notebookOptions.getDisplayOptions().interactiveWindowCollapseCodeCells === "fromEditor" ? {
          inputCollapsed: false,
          outputCollapsed: false
        } : void 0;
        await bulkEditService.apply([
          new ResourceNotebookCellEdit(
            notebookDocument.uri,
            {
              editType: CellEditType.Replace,
              index,
              count: 0,
              cells: [{
                cellKind: CellKind.Code,
                mime: void 0,
                language,
                source: value,
                outputs: [],
                metadata: {},
                collapseState
              }]
            }
          )
        ]);
        const range = { start: index, end: index + 1 };
        editorControl.notebookEditor.revealCellRangeInView(range);
        await editorControl.notebookEditor.executeNotebookCells(editorControl.notebookEditor.getCellsInRange({ start: index, end: index + 1 }));
        const editor = notebookEditorService.getNotebookEditor(editorControl.notebookEditor.getId());
        if (editor) {
          editor.setSelections([range]);
          editor.setFocus(range);
        }
      }
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "interactive.input.clear",
      title: localize2("interactive.input.clear", "Clear the interactive window input editor contents"),
      category: interactiveWindowCategory,
      f1: false
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const editorControl = editorService.activeEditorPane?.getControl();
    if (editorControl && isReplEditorControl(editorControl) && editorControl.notebookEditor) {
      const notebookDocument = editorControl.notebookEditor.textModel;
      const editor = editorControl.activeCodeEditor;
      const range = editor?.getModel()?.getFullModelRange();
      if (notebookDocument && editor && range) {
        editor.executeEdits("", [EditOperation.replace(range, null)]);
      }
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "interactive.history.previous",
      title: localize2("interactive.history.previous", "Previous value in history"),
      category: interactiveWindowCategory,
      f1: false,
      keybinding: {
        when: ContextKeyExpr.and(
          INTERACTIVE_INPUT_CURSOR_BOUNDARY.notEqualsTo("bottom"),
          INTERACTIVE_INPUT_CURSOR_BOUNDARY.notEqualsTo("none"),
          SuggestContext.Visible.toNegated()
        ),
        primary: KeyCode.UpArrow,
        weight: KeybindingWeight.WorkbenchContrib
      },
      precondition: ContextKeyExpr.and(IS_COMPOSITE_NOTEBOOK, NOTEBOOK_EDITOR_FOCUSED.negate())
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const historyService = accessor.get(IInteractiveHistoryService);
    const editorControl = editorService.activeEditorPane?.getControl();
    if (editorControl && isReplEditorControl(editorControl) && editorControl.notebookEditor) {
      const notebookDocument = editorControl.notebookEditor.textModel;
      const textModel = editorControl.activeCodeEditor?.getModel();
      if (notebookDocument && textModel) {
        const previousValue = historyService.getPreviousValue(notebookDocument.uri);
        if (previousValue) {
          textModel.setValue(previousValue);
        }
      }
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "interactive.history.next",
      title: localize2("interactive.history.next", "Next value in history"),
      category: interactiveWindowCategory,
      f1: false,
      keybinding: {
        when: ContextKeyExpr.and(
          INTERACTIVE_INPUT_CURSOR_BOUNDARY.notEqualsTo("top"),
          INTERACTIVE_INPUT_CURSOR_BOUNDARY.notEqualsTo("none"),
          SuggestContext.Visible.toNegated()
        ),
        primary: KeyCode.DownArrow,
        weight: KeybindingWeight.WorkbenchContrib
      },
      precondition: ContextKeyExpr.and(IS_COMPOSITE_NOTEBOOK, NOTEBOOK_EDITOR_FOCUSED.negate())
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const historyService = accessor.get(IInteractiveHistoryService);
    const editorControl = editorService.activeEditorPane?.getControl();
    if (editorControl && isReplEditorControl(editorControl) && editorControl.notebookEditor) {
      const notebookDocument = editorControl.notebookEditor.textModel;
      const textModel = editorControl.activeCodeEditor?.getModel();
      if (notebookDocument && textModel) {
        const nextValue = historyService.getNextValue(notebookDocument.uri);
        if (nextValue !== null) {
          textModel.setValue(nextValue);
        }
      }
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "interactive.scrollToTop",
      title: localize("interactiveScrollToTop", "Scroll to Top"),
      keybinding: {
        when: ContextKeyExpr.equals("activeEditor", "workbench.editor.interactive"),
        primary: KeyMod.CtrlCmd | KeyCode.Home,
        mac: { primary: KeyMod.CtrlCmd | KeyCode.UpArrow },
        weight: KeybindingWeight.WorkbenchContrib
      },
      category: interactiveWindowCategory
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const editorControl = editorService.activeEditorPane?.getControl();
    if (editorControl && isReplEditorControl(editorControl) && editorControl.notebookEditor) {
      if (editorControl.notebookEditor.getLength() === 0) {
        return;
      }
      editorControl.notebookEditor.revealCellRangeInView({ start: 0, end: 1 });
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "interactive.scrollToBottom",
      title: localize("interactiveScrollToBottom", "Scroll to Bottom"),
      keybinding: {
        when: ContextKeyExpr.equals("activeEditor", "workbench.editor.interactive"),
        primary: KeyMod.CtrlCmd | KeyCode.End,
        mac: { primary: KeyMod.CtrlCmd | KeyCode.DownArrow },
        weight: KeybindingWeight.WorkbenchContrib
      },
      category: interactiveWindowCategory
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const editorControl = editorService.activeEditorPane?.getControl();
    if (editorControl && isReplEditorControl(editorControl) && editorControl.notebookEditor) {
      if (editorControl.notebookEditor.getLength() === 0) {
        return;
      }
      const len = editorControl.notebookEditor.getLength();
      editorControl.notebookEditor.revealCellRangeInView({ start: len - 1, end: len });
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "interactive.input.focus",
      title: localize2("interactive.input.focus", "Focus Input Editor"),
      category: interactiveWindowCategory,
      menu: {
        id: MenuId.CommandPalette,
        when: InteractiveWindowOpen
      }
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const editorControl = editorService.activeEditorPane?.getControl();
    if (editorControl && isReplEditorControl(editorControl) && editorControl.notebookEditor) {
      editorService.activeEditorPane?.focus();
    } else {
      const openEditors = editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
      const interactiveWindow = Iterable.find(openEditors, (identifier) => {
        return identifier.editor.typeId === InteractiveEditorInput.ID;
      });
      if (interactiveWindow) {
        const editorInput = interactiveWindow.editor;
        const currentGroup = interactiveWindow.groupId;
        const editor = await editorService.openEditor(editorInput, currentGroup);
        const editorControl2 = editor?.getControl();
        if (editorControl2 && isReplEditorControl(editorControl2) && editorControl2.notebookEditor) {
          editorService.activeEditorPane?.focus();
        }
      }
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "interactive.history.focus",
      title: localize2("interactive.history.focus", "Focus History"),
      category: interactiveWindowCategory,
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.equals("activeEditor", "workbench.editor.interactive")
      },
      keybinding: [
        {
          // On mac, require that the cursor is at the top of the input, to avoid stealing cmd+up to move the cursor to the top
          when: ContextKeyExpr.and(
            INTERACTIVE_INPUT_CURSOR_BOUNDARY.notEqualsTo("bottom"),
            INTERACTIVE_INPUT_CURSOR_BOUNDARY.notEqualsTo("none")
          ),
          weight: KeybindingWeight.WorkbenchContrib + 5,
          primary: KeyMod.CtrlCmd | KeyCode.UpArrow
        },
        {
          when: ContextKeyExpr.or(IsWindowsContext, IsLinuxContext),
          weight: KeybindingWeight.WorkbenchContrib,
          primary: KeyMod.CtrlCmd | KeyCode.UpArrow
        }
      ],
      precondition: ContextKeyExpr.and(IS_COMPOSITE_NOTEBOOK, NOTEBOOK_EDITOR_FOCUSED.negate())
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const editorControl = editorService.activeEditorPane?.getControl();
    if (editorControl && isReplEditorControl(editorControl) && editorControl.notebookEditor) {
      editorControl.notebookEditor.focus();
    }
  }
});
registerColor("interactive.activeCodeBorder", {
  dark: ifDefinedThenElse(peekViewBorder, peekViewBorder, "#007acc"),
  light: ifDefinedThenElse(peekViewBorder, peekViewBorder, "#007acc"),
  hcDark: contrastBorder,
  hcLight: contrastBorder
}, localize("interactive.activeCodeBorder", "The border color for the current interactive code cell when the editor has focus."));
registerColor("interactive.inactiveCodeBorder", {
  //dark: theme.getColor(listInactiveSelectionBackground) ?? transparent(listInactiveSelectionBackground, 1),
  dark: ifDefinedThenElse(listInactiveSelectionBackground, listInactiveSelectionBackground, "#37373D"),
  light: ifDefinedThenElse(listInactiveSelectionBackground, listInactiveSelectionBackground, "#E4E6F1"),
  hcDark: PANEL_BORDER,
  hcLight: PANEL_BORDER
}, localize("interactive.inactiveCodeBorder", "The border color for the current interactive code cell when the editor does not have focus."));
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "interactiveWindow",
  order: 100,
  type: "object",
  "properties": {
    [ReplEditorSettings.interactiveWindowAlwaysScrollOnNewCell]: {
      type: "boolean",
      default: true,
      markdownDescription: localize("interactiveWindow.alwaysScrollOnNewCell", "Automatically scroll the interactive window to show the output of the last statement executed. If this value is false, the window will only scroll if the last cell was already the one scrolled to.")
    },
    [NotebookSetting.InteractiveWindowPromptToSave]: {
      type: "boolean",
      default: false,
      markdownDescription: localize("interactiveWindow.promptToSaveOnClose", "Prompt to save the interactive window when it is closed. Only new interactive windows will be affected by this setting change.")
    },
    [ReplEditorSettings.executeWithShiftEnter]: {
      type: "boolean",
      default: false,
      markdownDescription: localize("interactiveWindow.executeWithShiftEnter", "Execute the Interactive Window (REPL) input box with shift+enter, so that enter can be used to create a newline."),
      tags: ["replExecute"]
    },
    [ReplEditorSettings.showExecutionHint]: {
      type: "boolean",
      default: true,
      markdownDescription: localize("interactiveWindow.showExecutionHint", "Display a hint in the Interactive Window (REPL) input box to indicate how to execute code."),
      tags: ["replExecute"]
    }
  }
});
export {
  InteractiveDocumentContribution,
  InteractiveEditorSerializer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbnRlcmFjdGl2ZS9icm93c2VyL2ludGVyYWN0aXZlLmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgcGFyc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBleHRuYW1lLCBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGlzRmFsc3lPcldoaXRlc3BhY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFVSSSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQnVsa0VkaXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvYnVsa0VkaXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBQTEFJTlRFWFRfTEFOR1VBR0VfSUQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9tb2Rlc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIsIElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgcGVla1ZpZXdCb3JkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9wZWVrVmlldy9icm93c2VyL3BlZWtWaWV3LmpzJztcbmltcG9ydCB7IENvbnRleHQgYXMgU3VnZ2VzdENvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElMb2NhbGl6ZWRTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3RpdmF0aW9uLCBJVGV4dFJlc291cmNlRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGNvbnRyYXN0Qm9yZGVyLCBpZkRlZmluZWRUaGVuRWxzZSwgbGlzdEluYWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZCwgcmVnaXN0ZXJDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEVkaXRvclBhbmVEZXNjcmlwdG9yLCBJRWRpdG9yUGFuZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgV29ya2JlbmNoUGhhc2UsIHJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IEVkaXRvckV4dGVuc2lvbnMsIEVkaXRvcnNPcmRlciwgSUVkaXRvckNvbnRyb2wsIElFZGl0b3JGYWN0b3J5UmVnaXN0cnksIElFZGl0b3JTZXJpYWxpemVyLCBJVW50eXBlZEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgUEFORUxfQk9SREVSIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IFJlc291cmNlTm90ZWJvb2tDZWxsRWRpdCB9IGZyb20gJy4uLy4uL2J1bGtFZGl0L2Jyb3dzZXIvYnVsa0NlbGxFZGl0cy5qcyc7XG5pbXBvcnQgeyBSZXBsRWRpdG9yU2V0dGluZ3MsIElOVEVSQUNUSVZFX0lOUFVUX0NVUlNPUl9CT1VOREFSWSB9IGZyb20gJy4vaW50ZXJhY3RpdmVDb21tb24uanMnO1xuaW1wb3J0IHsgSUludGVyYWN0aXZlRG9jdW1lbnRTZXJ2aWNlLCBJbnRlcmFjdGl2ZURvY3VtZW50U2VydmljZSB9IGZyb20gJy4vaW50ZXJhY3RpdmVEb2N1bWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSW50ZXJhY3RpdmVFZGl0b3IgfSBmcm9tICcuL2ludGVyYWN0aXZlRWRpdG9yLmpzJztcbmltcG9ydCB7IEludGVyYWN0aXZlRWRpdG9ySW5wdXQgfSBmcm9tICcuL2ludGVyYWN0aXZlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSUludGVyYWN0aXZlSGlzdG9yeVNlcnZpY2UsIEludGVyYWN0aXZlSGlzdG9yeVNlcnZpY2UgfSBmcm9tICcuL2ludGVyYWN0aXZlSGlzdG9yeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTk9URUJPT0tfRURJVE9SX1dJREdFVF9BQ1RJT05fV0VJR0hUIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9jb250cm9sbGVyL2NvcmVBY3Rpb25zLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0VkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9icm93c2VyL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgKiBhcyBpY29ucyBmcm9tICcuLi8uLi9ub3RlYm9vay9icm93c2VyL25vdGVib29rSWNvbnMuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL25vdGVib29rL2Jyb3dzZXIvc2VydmljZXMvbm90ZWJvb2tFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENlbGxFZGl0VHlwZSwgQ2VsbEtpbmQsIENlbGxVcmksIElOVEVSQUNUSVZFX1dJTkRPV19FRElUT1JfSUQsIE5vdGVib29rU2V0dGluZywgTm90ZWJvb2tXb3JraW5nQ29weVR5cGVJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2svY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IEludGVyYWN0aXZlV2luZG93T3BlbiwgSVNfQ09NUE9TSVRFX05PVEVCT09LLCBOT1RFQk9PS19FRElUT1JfRk9DVVNFRCB9IGZyb20gJy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0NvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0tlcm5lbFNlcnZpY2UgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va1NlcnZpY2UgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGNvbHVtblRvRWRpdG9yR3JvdXAgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3VwQ29sdW1uLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JSZXNvbHZlclNlcnZpY2UsIFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5LmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUVkaXRvckhhbmRsZXIsIElXb3JraW5nQ29weUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzUmVwbEVkaXRvckNvbnRyb2wsIFJlcGxFZGl0b3JDb250cm9sIH0gZnJvbSAnLi4vLi4vcmVwbE5vdGVib29rL2Jyb3dzZXIvcmVwbEVkaXRvci5qcyc7XG5pbXBvcnQgeyBJbmxpbmVDaGF0Q29udHJvbGxlciB9IGZyb20gJy4uLy4uL2lubGluZUNoYXQvYnJvd3Nlci9pbmxpbmVDaGF0Q29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBJc0xpbnV4Q29udGV4dCwgSXNXaW5kb3dzQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXlzLmpzJztcblxuY29uc3QgaW50ZXJhY3RpdmVXaW5kb3dDYXRlZ29yeTogSUxvY2FsaXplZFN0cmluZyA9IGxvY2FsaXplMignaW50ZXJhY3RpdmVXaW5kb3cnLCBcIkludGVyYWN0aXZlIFdpbmRvd1wiKTtcblxuUmVnaXN0cnkuYXM8SUVkaXRvclBhbmVSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JQYW5lKS5yZWdpc3RlckVkaXRvclBhbmUoXG5cdEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShcblx0XHRJbnRlcmFjdGl2ZUVkaXRvcixcblx0XHRJTlRFUkFDVElWRV9XSU5ET1dfRURJVE9SX0lELFxuXHRcdCdJbnRlcmFjdGl2ZSBXaW5kb3cnXG5cdCksXG5cdFtcblx0XHRuZXcgU3luY0Rlc2NyaXB0b3IoSW50ZXJhY3RpdmVFZGl0b3JJbnB1dClcblx0XVxuKTtcblxuZXhwb3J0IGNsYXNzIEludGVyYWN0aXZlRG9jdW1lbnRDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmludGVyYWN0aXZlRG9jdW1lbnQnO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTm90ZWJvb2tTZXJ2aWNlIG5vdGVib29rU2VydmljZTogSU5vdGVib29rU2VydmljZSxcblx0XHRASUVkaXRvclJlc29sdmVyU2VydmljZSBlZGl0b3JSZXNvbHZlclNlcnZpY2U6IElFZGl0b3JSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBpbmZvID0gbm90ZWJvb2tTZXJ2aWNlLmdldENvbnRyaWJ1dGVkTm90ZWJvb2tUeXBlKCdpbnRlcmFjdGl2ZScpO1xuXG5cdFx0Ly8gV2UgbmVlZCB0byBjb250cmlidXRlIGEgbm90ZWJvb2sgdHlwZSBmb3IgdGhlIEludGVyYWN0aXZlIFdpbmRvdyB0byBwcm92aWRlIG5vdGVib29rIG1vZGVscy5cblx0XHRpZiAoIWluZm8pIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKG5vdGVib29rU2VydmljZS5yZWdpc3RlckNvbnRyaWJ1dGVkTm90ZWJvb2tUeXBlKCdpbnRlcmFjdGl2ZScsIHtcblx0XHRcdFx0cHJvdmlkZXJEaXNwbGF5TmFtZTogJ0ludGVyYWN0aXZlIE5vdGVib29rJyxcblx0XHRcdFx0ZGlzcGxheU5hbWU6ICdJbnRlcmFjdGl2ZScsXG5cdFx0XHRcdGZpbGVuYW1lUGF0dGVybjogWycqLmludGVyYWN0aXZlJ10sXG5cdFx0XHRcdHByaW9yaXR5OiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuYnVpbHRpblxuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGVkaXRvclJlc29sdmVyU2VydmljZS5yZWdpc3RlckVkaXRvcihcblx0XHRcdGAke1NjaGVtYXMudnNjb2RlSW50ZXJhY3RpdmVJbnB1dH06LyoqYCxcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICd2c2NvZGUtaW50ZXJhY3RpdmUtaW5wdXQnLFxuXHRcdFx0XHRsYWJlbDogJ0ludGVyYWN0aXZlIEVkaXRvcicsXG5cdFx0XHRcdHByaW9yaXR5OiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuZXhjbHVzaXZlXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRjYW5TdXBwb3J0UmVzb3VyY2U6IHVyaSA9PiB1cmkuc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZUludGVyYWN0aXZlSW5wdXQsXG5cdFx0XHRcdHNpbmdsZVBlclJlc291cmNlOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRjcmVhdGVFZGl0b3JJbnB1dDogKHsgcmVzb3VyY2UgfSkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGVkaXRvcklucHV0ID0gZWRpdG9yU2VydmljZS5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKS5maW5kKGVkaXRvciA9PiBlZGl0b3IuZWRpdG9yIGluc3RhbmNlb2YgSW50ZXJhY3RpdmVFZGl0b3JJbnB1dCAmJiBlZGl0b3IuZWRpdG9yLmlucHV0UmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0cmV0dXJuIGVkaXRvcklucHV0ITtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHRlZGl0b3JSZXNvbHZlclNlcnZpY2UucmVnaXN0ZXJFZGl0b3IoXG5cdFx0XHRgKi5pbnRlcmFjdGl2ZWAsXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAnaW50ZXJhY3RpdmUnLFxuXHRcdFx0XHRsYWJlbDogJ0ludGVyYWN0aXZlIEVkaXRvcicsXG5cdFx0XHRcdHByaW9yaXR5OiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuZXhjbHVzaXZlXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRjYW5TdXBwb3J0UmVzb3VyY2U6IHVyaSA9PlxuXHRcdFx0XHRcdCh1cmkuc2NoZW1lID09PSBTY2hlbWFzLnVudGl0bGVkICYmIGV4dG5hbWUodXJpKSA9PT0gJy5pbnRlcmFjdGl2ZScpIHx8XG5cdFx0XHRcdFx0KHVyaS5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsICYmIGV4dG5hbWUodXJpKSA9PT0gJy5pbnRlcmFjdGl2ZScpLFxuXHRcdFx0XHRzaW5nbGVQZXJSZXNvdXJjZTogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlRWRpdG9ySW5wdXQ6ICh7IHJlc291cmNlLCBvcHRpb25zIH0pID0+IHtcblx0XHRcdFx0XHRjb25zdCBkYXRhID0gQ2VsbFVyaS5wYXJzZShyZXNvdXJjZSk7XG5cdFx0XHRcdFx0bGV0IGNlbGxPcHRpb25zOiBJVGV4dFJlc291cmNlRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0bGV0IGl3UmVzb3VyY2UgPSByZXNvdXJjZTtcblxuXHRcdFx0XHRcdGlmIChkYXRhKSB7XG5cdFx0XHRcdFx0XHRjZWxsT3B0aW9ucyA9IHsgcmVzb3VyY2UsIG9wdGlvbnMgfTtcblx0XHRcdFx0XHRcdGl3UmVzb3VyY2UgPSBkYXRhLm5vdGVib29rO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IG5vdGVib29rT3B0aW9uczogSU5vdGVib29rRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCA9IHtcblx0XHRcdFx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRcdFx0XHRjZWxsT3B0aW9ucyxcblx0XHRcdFx0XHRcdGNlbGxSZXZlYWxUeXBlOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRjZWxsU2VsZWN0aW9uczogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0aXNSZWFkT25seTogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0dmlld1N0YXRlOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRpbmRleGVkQ2VsbE9wdGlvbnM6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRjb25zdCBlZGl0b3JJbnB1dCA9IGNyZWF0ZUVkaXRvcihpd1Jlc291cmNlLCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZWRpdG9yOiBlZGl0b3JJbnB1dCxcblx0XHRcdFx0XHRcdG9wdGlvbnM6IG5vdGVib29rT3B0aW9uc1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNyZWF0ZVVudGl0bGVkRWRpdG9ySW5wdXQ6ICh7IHJlc291cmNlLCBvcHRpb25zIH0pID0+IHtcblx0XHRcdFx0XHRpZiAoIXJlc291cmNlKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludGVyYWN0aXZlIHdpbmRvdyBlZGl0b3JzIG11c3QgaGF2ZSBhIHJlc291cmNlIG5hbWUnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgZGF0YSA9IENlbGxVcmkucGFyc2UocmVzb3VyY2UpO1xuXHRcdFx0XHRcdGxldCBjZWxsT3B0aW9uczogSVRleHRSZXNvdXJjZUVkaXRvcklucHV0IHwgdW5kZWZpbmVkO1xuXG5cdFx0XHRcdFx0aWYgKGRhdGEpIHtcblx0XHRcdFx0XHRcdGNlbGxPcHRpb25zID0geyByZXNvdXJjZSwgb3B0aW9ucyB9O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IG5vdGVib29rT3B0aW9uczogSU5vdGVib29rRWRpdG9yT3B0aW9ucyA9IHtcblx0XHRcdFx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRcdFx0XHRjZWxsT3B0aW9ucyxcblx0XHRcdFx0XHRcdGNlbGxSZXZlYWxUeXBlOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRjZWxsU2VsZWN0aW9uczogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0aXNSZWFkT25seTogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0dmlld1N0YXRlOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRpbmRleGVkQ2VsbE9wdGlvbnM6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRjb25zdCBlZGl0b3JJbnB1dCA9IGNyZWF0ZUVkaXRvcihyZXNvdXJjZSwgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGVkaXRvcjogZWRpdG9ySW5wdXQsXG5cdFx0XHRcdFx0XHRvcHRpb25zOiBub3RlYm9va09wdGlvbnNcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxufVxuXG5jbGFzcyBJbnRlcmFjdGl2ZUlucHV0Q29udGVudFByb3ZpZGVyIGltcGxlbWVudHMgSVRleHRNb2RlbENvbnRlbnRQcm92aWRlciB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmludGVyYWN0aXZlSW5wdXRDb250ZW50UHJvdmlkZXInO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlZ2lzdHJhdGlvbjogSURpc3Bvc2FibGU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHRleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9uID0gdGV4dE1vZGVsU2VydmljZS5yZWdpc3RlclRleHRNb2RlbENvbnRlbnRQcm92aWRlcihTY2hlbWFzLnZzY29kZUludGVyYWN0aXZlSW5wdXQsIHRoaXMpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RyYXRpb24uZGlzcG9zZSgpO1xuXHR9XG5cblx0YXN5bmMgcHJvdmlkZVRleHRDb250ZW50KHJlc291cmNlOiBVUkkpOiBQcm9taXNlPElUZXh0TW9kZWwgfCBudWxsPiB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLl9tb2RlbFNlcnZpY2UuZ2V0TW9kZWwocmVzb3VyY2UpO1xuXHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0cmV0dXJuIGV4aXN0aW5nO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQ6IElUZXh0TW9kZWwgfCBudWxsID0gdGhpcy5fbW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKCcnLCBudWxsLCByZXNvdXJjZSwgZmFsc2UpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlRWRpdG9yKHJlc291cmNlOiBVUkksIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpOiBFZGl0b3JJbnB1dCB7XG5cdGNvbnN0IGNvdW50ZXIgPSAvXFwvSW50ZXJhY3RpdmUtKFxcZCspLy5leGVjKHJlc291cmNlLnBhdGgpO1xuXHRjb25zdCBpbnB1dEJveFBhdGggPSBjb3VudGVyICYmIGNvdW50ZXJbMV0gPyBgL0ludGVyYWN0aXZlSW5wdXQtJHtjb3VudGVyWzFdfWAgOiAnSW50ZXJhY3RpdmVJbnB1dCc7XG5cdGNvbnN0IGlucHV0VXJpID0gVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMudnNjb2RlSW50ZXJhY3RpdmVJbnB1dCwgcGF0aDogaW5wdXRCb3hQYXRoIH0pO1xuXHRjb25zdCBlZGl0b3JJbnB1dCA9IEludGVyYWN0aXZlRWRpdG9ySW5wdXQuY3JlYXRlKGluc3RhbnRpYXRpb25TZXJ2aWNlLCByZXNvdXJjZSwgaW5wdXRVcmkpO1xuXG5cdHJldHVybiBlZGl0b3JJbnB1dDtcbn1cblxuY2xhc3MgSW50ZXJhY3RpdmVXaW5kb3dXb3JraW5nQ29weUVkaXRvckhhbmRsZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgSVdvcmtpbmdDb3B5RWRpdG9ySGFuZGxlciB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmludGVyYWN0aXZlV2luZG93V29ya2luZ0NvcHlFZGl0b3JIYW5kbGVyJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlOiBJV29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX2luc3RhbGxIYW5kbGVyKCk7XG5cdH1cblxuXHRoYW5kbGVzKHdvcmtpbmdDb3B5OiBJV29ya2luZ0NvcHlJZGVudGlmaWVyKTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgdmlld1R5cGUgPSB0aGlzLl9nZXRWaWV3VHlwZSh3b3JraW5nQ29weSk7XG5cdFx0cmV0dXJuICEhdmlld1R5cGUgJiYgdmlld1R5cGUgPT09ICdpbnRlcmFjdGl2ZSc7XG5cblx0fVxuXG5cdGlzT3Blbih3b3JraW5nQ29weTogSVdvcmtpbmdDb3B5SWRlbnRpZmllciwgZWRpdG9yOiBFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5oYW5kbGVzKHdvcmtpbmdDb3B5KSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiBlZGl0b3IgaW5zdGFuY2VvZiBJbnRlcmFjdGl2ZUVkaXRvcklucHV0ICYmIGlzRXF1YWwod29ya2luZ0NvcHkucmVzb3VyY2UsIGVkaXRvci5yZXNvdXJjZSk7XG5cdH1cblxuXHRjcmVhdGVFZGl0b3Iod29ya2luZ0NvcHk6IElXb3JraW5nQ29weUlkZW50aWZpZXIpOiBFZGl0b3JJbnB1dCB7XG5cdFx0cmV0dXJuIGNyZWF0ZUVkaXRvcih3b3JraW5nQ29weS5yZXNvdXJjZSwgdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfaW5zdGFsbEhhbmRsZXIoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fZXh0ZW5zaW9uU2VydmljZS53aGVuSW5zdGFsbGVkRXh0ZW5zaW9uc1JlZ2lzdGVyZWQoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3dvcmtpbmdDb3B5RWRpdG9yU2VydmljZS5yZWdpc3RlckhhbmRsZXIodGhpcykpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Vmlld1R5cGUod29ya2luZ0NvcHk6IElXb3JraW5nQ29weUlkZW50aWZpZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBOb3RlYm9va1dvcmtpbmdDb3B5VHlwZUlkZW50aWZpZXIucGFyc2Uod29ya2luZ0NvcHkudHlwZUlkKT8udmlld1R5cGU7XG5cdH1cbn1cblxucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKEludGVyYWN0aXZlRG9jdW1lbnRDb250cmlidXRpb24uSUQsIEludGVyYWN0aXZlRG9jdW1lbnRDb250cmlidXRpb24sIFdvcmtiZW5jaFBoYXNlLkJsb2NrUmVzdG9yZSk7XG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoSW50ZXJhY3RpdmVJbnB1dENvbnRlbnRQcm92aWRlci5JRCwgSW50ZXJhY3RpdmVJbnB1dENvbnRlbnRQcm92aWRlciwge1xuXHRlZGl0b3JUeXBlSWQ6IElOVEVSQUNUSVZFX1dJTkRPV19FRElUT1JfSURcbn0pO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKEludGVyYWN0aXZlV2luZG93V29ya2luZ0NvcHlFZGl0b3JIYW5kbGVyLklELCBJbnRlcmFjdGl2ZVdpbmRvd1dvcmtpbmdDb3B5RWRpdG9ySGFuZGxlciwge1xuXHRlZGl0b3JUeXBlSWQ6IElOVEVSQUNUSVZFX1dJTkRPV19FRElUT1JfSURcbn0pO1xuXG50eXBlIGludGVyYWN0aXZlRWRpdG9ySW5wdXREYXRhID0geyByZXNvdXJjZTogVVJJOyBpbnB1dFJlc291cmNlOiBVUkk7IG5hbWU6IHN0cmluZzsgbGFuZ3VhZ2U6IHN0cmluZyB9O1xuXG5leHBvcnQgY2xhc3MgSW50ZXJhY3RpdmVFZGl0b3JTZXJpYWxpemVyIGltcGxlbWVudHMgSUVkaXRvclNlcmlhbGl6ZXIge1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gSW50ZXJhY3RpdmVFZGl0b3JJbnB1dC5JRDtcblxuXHRjYW5TZXJpYWxpemUoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IGVkaXRvciBpcyBJbnRlcmFjdGl2ZUVkaXRvcklucHV0IHtcblx0XHRpZiAoIShlZGl0b3IgaW5zdGFuY2VvZiBJbnRlcmFjdGl2ZUVkaXRvcklucHV0KSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiBVUkkuaXNVcmkoZWRpdG9yLnByaW1hcnkucmVzb3VyY2UpICYmIFVSSS5pc1VyaShlZGl0b3IuaW5wdXRSZXNvdXJjZSk7XG5cdH1cblxuXHRzZXJpYWxpemUoaW5wdXQ6IEVkaXRvcklucHV0KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuY2FuU2VyaWFsaXplKGlucHV0KSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0cmVzb3VyY2U6IGlucHV0LnByaW1hcnkucmVzb3VyY2UsXG5cdFx0XHRpbnB1dFJlc291cmNlOiBpbnB1dC5pbnB1dFJlc291cmNlLFxuXHRcdFx0bmFtZTogaW5wdXQuZ2V0TmFtZSgpLFxuXHRcdFx0bGFuZ3VhZ2U6IGlucHV0Lmxhbmd1YWdlXG5cdFx0fSk7XG5cdH1cblxuXHRkZXNlcmlhbGl6ZShpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCByYXc6IHN0cmluZykge1xuXHRcdGNvbnN0IGRhdGEgPSA8aW50ZXJhY3RpdmVFZGl0b3JJbnB1dERhdGE+cGFyc2UocmF3KTtcblx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHsgcmVzb3VyY2UsIGlucHV0UmVzb3VyY2UsIG5hbWUsIGxhbmd1YWdlIH0gPSBkYXRhO1xuXHRcdGlmICghVVJJLmlzVXJpKHJlc291cmNlKSB8fCAhVVJJLmlzVXJpKGlucHV0UmVzb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlucHV0ID0gSW50ZXJhY3RpdmVFZGl0b3JJbnB1dC5jcmVhdGUoaW5zdGFudGlhdGlvblNlcnZpY2UsIHJlc291cmNlLCBpbnB1dFJlc291cmNlLCBuYW1lLCBsYW5ndWFnZSk7XG5cdFx0cmV0dXJuIGlucHV0O1xuXHR9XG59XG5cblJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSlcblx0LnJlZ2lzdGVyRWRpdG9yU2VyaWFsaXplcihcblx0XHRJbnRlcmFjdGl2ZUVkaXRvclNlcmlhbGl6ZXIuSUQsXG5cdFx0SW50ZXJhY3RpdmVFZGl0b3JTZXJpYWxpemVyKTtcblxucmVnaXN0ZXJTaW5nbGV0b24oSUludGVyYWN0aXZlSGlzdG9yeVNlcnZpY2UsIEludGVyYWN0aXZlSGlzdG9yeVNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUludGVyYWN0aXZlRG9jdW1lbnRTZXJ2aWNlLCBJbnRlcmFjdGl2ZURvY3VtZW50U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ19pbnRlcmFjdGl2ZS5vcGVuJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ludGVyYWN0aXZlLm9wZW4nLCAnT3BlbiBJbnRlcmFjdGl2ZSBXaW5kb3cnKSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdGNhdGVnb3J5OiBpbnRlcmFjdGl2ZVdpbmRvd0NhdGVnb3J5LFxuXHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdpbnRlcmFjdGl2ZS5vcGVuJywgJ09wZW4gSW50ZXJhY3RpdmUgV2luZG93JyksXG5cdFx0XHRcdGFyZ3M6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAnc2hvd09wdGlvbnMnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdTaG93IE9wdGlvbnMnLFxuXHRcdFx0XHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0J3ZpZXdDb2x1bW4nOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdFx0XHRcdFx0XHRcdGRlZmF1bHQ6IC0xXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHQncHJlc2VydmVGb2N1cyc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRcdFx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAncmVzb3VyY2UnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdJbnRlcmFjdGl2ZSByZXNvdXJjZSBVcmknLFxuXHRcdFx0XHRcdFx0aXNPcHRpb25hbDogdHJ1ZVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZTogJ2NvbnRyb2xsZXJJZCcsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ05vdGVib29rIGNvbnRyb2xsZXIgSWQnLFxuXHRcdFx0XHRcdFx0aXNPcHRpb25hbDogdHJ1ZVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZTogJ3RpdGxlJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAnTm90ZWJvb2sgZWRpdG9yIHRpdGxlJyxcblx0XHRcdFx0XHRcdGlzT3B0aW9uYWw6IHRydWVcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH1cblxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBzaG93T3B0aW9ucz86IG51bWJlciB8IHsgdmlld0NvbHVtbj86IG51bWJlcjsgcHJlc2VydmVGb2N1cz86IGJvb2xlYW4gfSwgcmVzb3VyY2U/OiBVUkksIGlkPzogc3RyaW5nLCB0aXRsZT86IHN0cmluZyk6IFByb21pc2U8eyBub3RlYm9va1VyaTogVVJJOyBpbnB1dFVyaTogVVJJOyBub3RlYm9va0VkaXRvcklkPzogc3RyaW5nIH0+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JHcm91cFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGhpc3RvcnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnRlcmFjdGl2ZUhpc3RvcnlTZXJ2aWNlKTtcblx0XHRjb25zdCBrZXJuZWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RlYm9va0tlcm5lbFNlcnZpY2UpO1xuXHRcdGNvbnN0IGxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxvZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjb2x1bW5Ub0VkaXRvckdyb3VwKGVkaXRvckdyb3VwU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIHR5cGVvZiBzaG93T3B0aW9ucyA9PT0gJ251bWJlcicgPyBzaG93T3B0aW9ucyA6IHNob3dPcHRpb25zPy52aWV3Q29sdW1uKTtcblx0XHRjb25zdCBlZGl0b3JPcHRpb25zID0ge1xuXHRcdFx0YWN0aXZhdGlvbjogRWRpdG9yQWN0aXZhdGlvbi5QUkVTRVJWRSxcblx0XHRcdHByZXNlcnZlRm9jdXM6IHR5cGVvZiBzaG93T3B0aW9ucyAhPT0gJ251bWJlcicgPyAoc2hvd09wdGlvbnM/LnByZXNlcnZlRm9jdXMgPz8gZmFsc2UpIDogZmFsc2Vcblx0XHR9O1xuXG5cdFx0aWYgKHJlc291cmNlICYmIGV4dG5hbWUocmVzb3VyY2UpID09PSAnLmludGVyYWN0aXZlJykge1xuXHRcdFx0bG9nU2VydmljZS5kZWJ1ZygnT3BlbiBpbnRlcmFjdGl2ZSB3aW5kb3cgZnJvbSByZXNvdXJjZTonLCByZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdGNvbnN0IHJlc291cmNlVXJpID0gVVJJLnJldml2ZShyZXNvdXJjZSk7XG5cdFx0XHRjb25zdCBlZGl0b3JzID0gZWRpdG9yU2VydmljZS5maW5kRWRpdG9ycyhyZXNvdXJjZVVyaSkuZmlsdGVyKGlkID0+IGlkLmVkaXRvciBpbnN0YW5jZW9mIEludGVyYWN0aXZlRWRpdG9ySW5wdXQgJiYgaWQuZWRpdG9yLnJlc291cmNlPy50b1N0cmluZygpID09PSByZXNvdXJjZVVyaS50b1N0cmluZygpKTtcblx0XHRcdGlmIChlZGl0b3JzLmxlbmd0aCkge1xuXHRcdFx0XHRsb2dTZXJ2aWNlLmRlYnVnKCdGaW5kIGV4aXN0aW5nIGludGVyYWN0aXZlIHdpbmRvdzonLCByZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdFx0Y29uc3QgZWRpdG9ySW5wdXQgPSBlZGl0b3JzWzBdLmVkaXRvciBhcyBJbnRlcmFjdGl2ZUVkaXRvcklucHV0O1xuXHRcdFx0XHRjb25zdCBjdXJyZW50R3JvdXAgPSBlZGl0b3JzWzBdLmdyb3VwSWQ7XG5cdFx0XHRcdGNvbnN0IGVkaXRvciA9IGF3YWl0IGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcihlZGl0b3JJbnB1dCwgZWRpdG9yT3B0aW9ucywgY3VycmVudEdyb3VwKTtcblx0XHRcdFx0Y29uc3QgZWRpdG9yQ29udHJvbCA9IGVkaXRvcj8uZ2V0Q29udHJvbCgpIGFzIFJlcGxFZGl0b3JDb250cm9sO1xuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bm90ZWJvb2tVcmk6IGVkaXRvcklucHV0LnJlc291cmNlLFxuXHRcdFx0XHRcdGlucHV0VXJpOiBlZGl0b3JJbnB1dC5pbnB1dFJlc291cmNlLFxuXHRcdFx0XHRcdG5vdGVib29rRWRpdG9ySWQ6IGVkaXRvckNvbnRyb2w/Lm5vdGVib29rRWRpdG9yPy5nZXRJZCgpXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXhpc3RpbmdOb3RlYm9va0RvY3VtZW50ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0ZWRpdG9yU2VydmljZS5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKS5mb3JFYWNoKGVkaXRvciA9PiB7XG5cdFx0XHRpZiAoZWRpdG9yLmVkaXRvci5yZXNvdXJjZSkge1xuXHRcdFx0XHRleGlzdGluZ05vdGVib29rRG9jdW1lbnQuYWRkKGVkaXRvci5lZGl0b3IucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRsZXQgbm90ZWJvb2tVcmk6IFVSSSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgaW5wdXRVcmk6IFVSSSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgY291bnRlciA9IDE7XG5cdFx0ZG8ge1xuXHRcdFx0bm90ZWJvb2tVcmkgPSBVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy51bnRpdGxlZCwgcGF0aDogYC9JbnRlcmFjdGl2ZS0ke2NvdW50ZXJ9LmludGVyYWN0aXZlYCB9KTtcblx0XHRcdGlucHV0VXJpID0gVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMudnNjb2RlSW50ZXJhY3RpdmVJbnB1dCwgcGF0aDogYC9JbnRlcmFjdGl2ZUlucHV0LSR7Y291bnRlcn1gIH0pO1xuXG5cdFx0XHRjb3VudGVyKys7XG5cdFx0fSB3aGlsZSAoZXhpc3RpbmdOb3RlYm9va0RvY3VtZW50Lmhhcyhub3RlYm9va1VyaS50b1N0cmluZygpKSk7XG5cdFx0SW50ZXJhY3RpdmVFZGl0b3JJbnB1dC5zZXROYW1lKG5vdGVib29rVXJpLCB0aXRsZSk7XG5cblx0XHRsb2dTZXJ2aWNlLmRlYnVnKCdPcGVuIG5ldyBpbnRlcmFjdGl2ZSB3aW5kb3c6Jywgbm90ZWJvb2tVcmkudG9TdHJpbmcoKSwgaW5wdXRVcmkudG9TdHJpbmcoKSk7XG5cblx0XHRpZiAoaWQpIHtcblx0XHRcdGNvbnN0IGFsbEtlcm5lbHMgPSBrZXJuZWxTZXJ2aWNlLmdldE1hdGNoaW5nS2VybmVsKHsgdXJpOiBub3RlYm9va1VyaSwgbm90ZWJvb2tUeXBlOiAnaW50ZXJhY3RpdmUnIH0pLmFsbDtcblx0XHRcdGNvbnN0IHByZWZlcnJlZEtlcm5lbCA9IGFsbEtlcm5lbHMuZmluZChrZXJuZWwgPT4ga2VybmVsLmlkID09PSBpZCk7XG5cdFx0XHRpZiAocHJlZmVycmVkS2VybmVsKSB7XG5cdFx0XHRcdGtlcm5lbFNlcnZpY2UucHJlc2VsZWN0S2VybmVsRm9yTm90ZWJvb2socHJlZmVycmVkS2VybmVsLCB7IHVyaTogbm90ZWJvb2tVcmksIG5vdGVib29rVHlwZTogJ2ludGVyYWN0aXZlJyB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRoaXN0b3J5U2VydmljZS5jbGVhckhpc3Rvcnkobm90ZWJvb2tVcmkpO1xuXHRcdGNvbnN0IGVkaXRvcklucHV0OiBJVW50eXBlZEVkaXRvcklucHV0ID0geyByZXNvdXJjZTogbm90ZWJvb2tVcmksIG9wdGlvbnM6IGVkaXRvck9wdGlvbnMgfTtcblx0XHRjb25zdCBlZGl0b3JQYW5lID0gYXdhaXQgZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKGVkaXRvcklucHV0LCBncm91cCk7XG5cdFx0Y29uc3QgZWRpdG9yQ29udHJvbCA9IGVkaXRvclBhbmU/LmdldENvbnRyb2woKSBhcyBSZXBsRWRpdG9yQ29udHJvbDtcblx0XHQvLyBFeHRlbnNpb25zIG11c3QgcmV0YWluIHJlZmVyZW5jZXMgdG8gdGhlc2UgVVJJcyB0byBtYW5pcHVsYXRlIHRoZSBpbnRlcmFjdGl2ZSBlZGl0b3Jcblx0XHRsb2dTZXJ2aWNlLmRlYnVnKCdOZXcgaW50ZXJhY3RpdmUgd2luZG93IG9wZW5lZC4gTm90ZWJvb2sgZWRpdG9yIGlkJywgZWRpdG9yQ29udHJvbD8ubm90ZWJvb2tFZGl0b3I/LmdldElkKCkpO1xuXHRcdHJldHVybiB7IG5vdGVib29rVXJpLCBpbnB1dFVyaSwgbm90ZWJvb2tFZGl0b3JJZDogZWRpdG9yQ29udHJvbD8ubm90ZWJvb2tFZGl0b3I/LmdldElkKCkgfTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2ludGVyYWN0aXZlLmV4ZWN1dGUnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignaW50ZXJhY3RpdmUuZXhlY3V0ZScsICdFeGVjdXRlIENvZGUnKSxcblx0XHRcdGNhdGVnb3J5OiBpbnRlcmFjdGl2ZVdpbmRvd0NhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzogW3tcblx0XHRcdFx0Ly8gd2hlbjogTk9URUJPT0tfQ0VMTF9MSVNUX0ZPQ1VTRUQsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRJU19DT01QT1NJVEVfTk9URUJPT0ssXG5cdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCdhY3RpdmVFZGl0b3InLCAnd29ya2JlbmNoLmVkaXRvci5pbnRlcmFjdGl2ZScpXG5cdFx0XHRcdCksXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0d2VpZ2h0OiBOT1RFQk9PS19FRElUT1JfV0lER0VUX0FDVElPTl9XRUlHSFRcblx0XHRcdH0sIHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdElTX0NPTVBPU0lURV9OT1RFQk9PSyxcblx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2FjdGl2ZUVkaXRvcicsICd3b3JrYmVuY2guZWRpdG9yLmludGVyYWN0aXZlJyksXG5cdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcuaW50ZXJhY3RpdmVXaW5kb3cuZXhlY3V0ZVdpdGhTaGlmdEVudGVyJywgdHJ1ZSlcblx0XHRcdFx0KSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0d2VpZ2h0OiBOT1RFQk9PS19FRElUT1JfV0lER0VUX0FDVElPTl9XRUlHSFRcblx0XHRcdH0sIHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdElTX0NPTVBPU0lURV9OT1RFQk9PSyxcblx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2FjdGl2ZUVkaXRvcicsICd3b3JrYmVuY2guZWRpdG9yLmludGVyYWN0aXZlJyksXG5cdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcuaW50ZXJhY3RpdmVXaW5kb3cuZXhlY3V0ZVdpdGhTaGlmdEVudGVyJywgZmFsc2UpXG5cdFx0XHRcdCksXG5cdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdHdlaWdodDogTk9URUJPT0tfRURJVE9SX1dJREdFVF9BQ1RJT05fV0VJR0hUXG5cdFx0XHR9XSxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuSW50ZXJhY3RpdmVJbnB1dEV4ZWN1dGVcblx0XHRcdFx0fSxcblx0XHRcdF0sXG5cdFx0XHRpY29uOiBpY29ucy5leGVjdXRlSWNvbixcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAnRXhlY3V0ZSB0aGUgQ29udGVudHMgb2YgdGhlIElucHV0IEJveCcsXG5cdFx0XHRcdGFyZ3M6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAncmVzb3VyY2UnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdJbnRlcmFjdGl2ZSByZXNvdXJjZSBVcmknLFxuXHRcdFx0XHRcdFx0aXNPcHRpb25hbDogdHJ1ZVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0PzogVXJpQ29tcG9uZW50cyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGJ1bGtFZGl0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQnVsa0VkaXRTZXJ2aWNlKTtcblx0XHRjb25zdCBoaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJSW50ZXJhY3RpdmVIaXN0b3J5U2VydmljZSk7XG5cdFx0Y29uc3Qgbm90ZWJvb2tFZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RlYm9va0VkaXRvclNlcnZpY2UpO1xuXHRcdGxldCBlZGl0b3JDb250cm9sOiBJRWRpdG9yQ29udHJvbCB8IHVuZGVmaW5lZDtcblx0XHRpZiAoY29udGV4dCkge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VVcmkgPSBVUkkucmV2aXZlKGNvbnRleHQpO1xuXHRcdFx0Y29uc3QgZWRpdG9ycyA9IGVkaXRvclNlcnZpY2UuZmluZEVkaXRvcnMocmVzb3VyY2VVcmkpO1xuXHRcdFx0Zm9yIChjb25zdCBmb3VuZCBvZiBlZGl0b3JzKSB7XG5cdFx0XHRcdGlmIChmb3VuZC5lZGl0b3IudHlwZUlkID09PSBJbnRlcmFjdGl2ZUVkaXRvcklucHV0LklEKSB7XG5cdFx0XHRcdFx0Y29uc3QgZWRpdG9yID0gYXdhaXQgZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKGZvdW5kLmVkaXRvciwgZm91bmQuZ3JvdXBJZCk7XG5cdFx0XHRcdFx0ZWRpdG9yQ29udHJvbCA9IGVkaXRvcj8uZ2V0Q29udHJvbCgpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0ZWRpdG9yQ29udHJvbCA9IGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZT8uZ2V0Q29udHJvbCgpO1xuXHRcdH1cblxuXHRcdGlmIChlZGl0b3JDb250cm9sICYmIGlzUmVwbEVkaXRvckNvbnRyb2woZWRpdG9yQ29udHJvbCkgJiYgZWRpdG9yQ29udHJvbC5ub3RlYm9va0VkaXRvcikge1xuXHRcdFx0Y29uc3Qgbm90ZWJvb2tEb2N1bWVudCA9IGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsO1xuXHRcdFx0Y29uc3QgdGV4dE1vZGVsID0gZWRpdG9yQ29udHJvbC5hY3RpdmVDb2RlRWRpdG9yPy5nZXRNb2RlbCgpO1xuXHRcdFx0Y29uc3QgYWN0aXZlS2VybmVsID0gZWRpdG9yQ29udHJvbC5ub3RlYm9va0VkaXRvci5hY3RpdmVLZXJuZWw7XG5cdFx0XHRjb25zdCBsYW5ndWFnZSA9IGFjdGl2ZUtlcm5lbD8uc3VwcG9ydGVkTGFuZ3VhZ2VzWzBdID8/IFBMQUlOVEVYVF9MQU5HVUFHRV9JRDtcblxuXHRcdFx0aWYgKG5vdGVib29rRG9jdW1lbnQgJiYgdGV4dE1vZGVsICYmIGVkaXRvckNvbnRyb2wuYWN0aXZlQ29kZUVkaXRvcikge1xuXHRcdFx0XHRjb25zdCBpbmRleCA9IG5vdGVib29rRG9jdW1lbnQubGVuZ3RoO1xuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IHRleHRNb2RlbC5nZXRWYWx1ZSgpO1xuXG5cdFx0XHRcdGlmIChpc0ZhbHN5T3JXaGl0ZXNwYWNlKHZhbHVlKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGN0cmwgPSBJbmxpbmVDaGF0Q29udHJvbGxlci5nZXQoZWRpdG9yQ29udHJvbC5hY3RpdmVDb2RlRWRpdG9yKTtcblx0XHRcdFx0aWYgKGN0cmwpIHtcblx0XHRcdFx0XHRjdHJsLmFjY2VwdFNlc3Npb24oKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGhpc3RvcnlTZXJ2aWNlLnJlcGxhY2VMYXN0KG5vdGVib29rRG9jdW1lbnQudXJpLCB2YWx1ZSk7XG5cdFx0XHRcdGhpc3RvcnlTZXJ2aWNlLmFkZFRvSGlzdG9yeShub3RlYm9va0RvY3VtZW50LnVyaSwgJycpO1xuXHRcdFx0XHR0ZXh0TW9kZWwuc2V0VmFsdWUoJycpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbGxhcHNlU3RhdGUgPSBlZGl0b3JDb250cm9sLm5vdGVib29rRWRpdG9yLm5vdGVib29rT3B0aW9ucy5nZXREaXNwbGF5T3B0aW9ucygpLmludGVyYWN0aXZlV2luZG93Q29sbGFwc2VDb2RlQ2VsbHMgPT09ICdmcm9tRWRpdG9yJyA/XG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0aW5wdXRDb2xsYXBzZWQ6IGZhbHNlLFxuXHRcdFx0XHRcdFx0b3V0cHV0Q29sbGFwc2VkOiBmYWxzZVxuXHRcdFx0XHRcdH0gOlxuXHRcdFx0XHRcdHVuZGVmaW5lZDtcblxuXHRcdFx0XHRhd2FpdCBidWxrRWRpdFNlcnZpY2UuYXBwbHkoW1xuXHRcdFx0XHRcdG5ldyBSZXNvdXJjZU5vdGVib29rQ2VsbEVkaXQobm90ZWJvb2tEb2N1bWVudC51cmksXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSxcblx0XHRcdFx0XHRcdFx0aW5kZXg6IGluZGV4LFxuXHRcdFx0XHRcdFx0XHRjb3VudDogMCxcblx0XHRcdFx0XHRcdFx0Y2VsbHM6IFt7XG5cdFx0XHRcdFx0XHRcdFx0Y2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsXG5cdFx0XHRcdFx0XHRcdFx0bWltZTogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRcdGxhbmd1YWdlLFxuXHRcdFx0XHRcdFx0XHRcdHNvdXJjZTogdmFsdWUsXG5cdFx0XHRcdFx0XHRcdFx0b3V0cHV0czogW10sXG5cdFx0XHRcdFx0XHRcdFx0bWV0YWRhdGE6IHt9LFxuXHRcdFx0XHRcdFx0XHRcdGNvbGxhcHNlU3RhdGVcblx0XHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHQpXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdC8vIHJldmVhbCB0aGUgY2VsbCBpbnRvIHZpZXcgZmlyc3Rcblx0XHRcdFx0Y29uc3QgcmFuZ2UgPSB7IHN0YXJ0OiBpbmRleCwgZW5kOiBpbmRleCArIDEgfTtcblx0XHRcdFx0ZWRpdG9yQ29udHJvbC5ub3RlYm9va0VkaXRvci5yZXZlYWxDZWxsUmFuZ2VJblZpZXcocmFuZ2UpO1xuXHRcdFx0XHRhd2FpdCBlZGl0b3JDb250cm9sLm5vdGVib29rRWRpdG9yLmV4ZWN1dGVOb3RlYm9va0NlbGxzKGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IuZ2V0Q2VsbHNJblJhbmdlKHsgc3RhcnQ6IGluZGV4LCBlbmQ6IGluZGV4ICsgMSB9KSk7XG5cblx0XHRcdFx0Ly8gdXBkYXRlIHRoZSBzZWxlY3Rpb24gYW5kIGZvY3VzIGluIHRoZSBleHRlbnNpb24gaG9zdCBtb2RlbFxuXHRcdFx0XHRjb25zdCBlZGl0b3IgPSBub3RlYm9va0VkaXRvclNlcnZpY2UuZ2V0Tm90ZWJvb2tFZGl0b3IoZWRpdG9yQ29udHJvbC5ub3RlYm9va0VkaXRvci5nZXRJZCgpKTtcblx0XHRcdFx0aWYgKGVkaXRvcikge1xuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtyYW5nZV0pO1xuXHRcdFx0XHRcdGVkaXRvci5zZXRGb2N1cyhyYW5nZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdpbnRlcmFjdGl2ZS5pbnB1dC5jbGVhcicsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdpbnRlcmFjdGl2ZS5pbnB1dC5jbGVhcicsICdDbGVhciB0aGUgaW50ZXJhY3RpdmUgd2luZG93IGlucHV0IGVkaXRvciBjb250ZW50cycpLFxuXHRcdFx0Y2F0ZWdvcnk6IGludGVyYWN0aXZlV2luZG93Q2F0ZWdvcnksXG5cdFx0XHRmMTogZmFsc2Vcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvckNvbnRyb2wgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmU/LmdldENvbnRyb2woKTtcblxuXHRcdGlmIChlZGl0b3JDb250cm9sICYmIGlzUmVwbEVkaXRvckNvbnRyb2woZWRpdG9yQ29udHJvbCkgJiYgZWRpdG9yQ29udHJvbC5ub3RlYm9va0VkaXRvcikge1xuXHRcdFx0Y29uc3Qgbm90ZWJvb2tEb2N1bWVudCA9IGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsO1xuXHRcdFx0Y29uc3QgZWRpdG9yID0gZWRpdG9yQ29udHJvbC5hY3RpdmVDb2RlRWRpdG9yO1xuXHRcdFx0Y29uc3QgcmFuZ2UgPSBlZGl0b3I/LmdldE1vZGVsKCk/LmdldEZ1bGxNb2RlbFJhbmdlKCk7XG5cblxuXHRcdFx0aWYgKG5vdGVib29rRG9jdW1lbnQgJiYgZWRpdG9yICYmIHJhbmdlKSB7XG5cdFx0XHRcdGVkaXRvci5leGVjdXRlRWRpdHMoJycsIFtFZGl0T3BlcmF0aW9uLnJlcGxhY2UocmFuZ2UsIG51bGwpXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnaW50ZXJhY3RpdmUuaGlzdG9yeS5wcmV2aW91cycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdpbnRlcmFjdGl2ZS5oaXN0b3J5LnByZXZpb3VzJywgJ1ByZXZpb3VzIHZhbHVlIGluIGhpc3RvcnknKSxcblx0XHRcdGNhdGVnb3J5OiBpbnRlcmFjdGl2ZVdpbmRvd0NhdGVnb3J5LFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0SU5URVJBQ1RJVkVfSU5QVVRfQ1VSU09SX0JPVU5EQVJZLm5vdEVxdWFsc1RvKCdib3R0b20nKSxcblx0XHRcdFx0XHRJTlRFUkFDVElWRV9JTlBVVF9DVVJTT1JfQk9VTkRBUlkubm90RXF1YWxzVG8oJ25vbmUnKSxcblx0XHRcdFx0XHRTdWdnZXN0Q29udGV4dC5WaXNpYmxlLnRvTmVnYXRlZCgpXG5cdFx0XHRcdCksXG5cdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuVXBBcnJvdyxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHRcdH0sXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChJU19DT01QT1NJVEVfTk9URUJPT0ssIE5PVEVCT09LX0VESVRPUl9GT0NVU0VELm5lZ2F0ZSgpKVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgaGlzdG9yeVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUludGVyYWN0aXZlSGlzdG9yeVNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvckNvbnRyb2wgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmU/LmdldENvbnRyb2woKTtcblxuXG5cblx0XHRpZiAoZWRpdG9yQ29udHJvbCAmJiBpc1JlcGxFZGl0b3JDb250cm9sKGVkaXRvckNvbnRyb2wpICYmIGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IpIHtcblx0XHRcdGNvbnN0IG5vdGVib29rRG9jdW1lbnQgPSBlZGl0b3JDb250cm9sLm5vdGVib29rRWRpdG9yLnRleHRNb2RlbDtcblx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvckNvbnRyb2wuYWN0aXZlQ29kZUVkaXRvcj8uZ2V0TW9kZWwoKTtcblxuXHRcdFx0aWYgKG5vdGVib29rRG9jdW1lbnQgJiYgdGV4dE1vZGVsKSB7XG5cdFx0XHRcdGNvbnN0IHByZXZpb3VzVmFsdWUgPSBoaXN0b3J5U2VydmljZS5nZXRQcmV2aW91c1ZhbHVlKG5vdGVib29rRG9jdW1lbnQudXJpKTtcblx0XHRcdFx0aWYgKHByZXZpb3VzVmFsdWUpIHtcblx0XHRcdFx0XHR0ZXh0TW9kZWwuc2V0VmFsdWUocHJldmlvdXNWYWx1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdpbnRlcmFjdGl2ZS5oaXN0b3J5Lm5leHQnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignaW50ZXJhY3RpdmUuaGlzdG9yeS5uZXh0JywgJ05leHQgdmFsdWUgaW4gaGlzdG9yeScpLFxuXHRcdFx0Y2F0ZWdvcnk6IGludGVyYWN0aXZlV2luZG93Q2F0ZWdvcnksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRJTlRFUkFDVElWRV9JTlBVVF9DVVJTT1JfQk9VTkRBUlkubm90RXF1YWxzVG8oJ3RvcCcpLFxuXHRcdFx0XHRcdElOVEVSQUNUSVZFX0lOUFVUX0NVUlNPUl9CT1VOREFSWS5ub3RFcXVhbHNUbygnbm9uZScpLFxuXHRcdFx0XHRcdFN1Z2dlc3RDb250ZXh0LlZpc2libGUudG9OZWdhdGVkKClcblx0XHRcdFx0KSxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5Eb3duQXJyb3csXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoSVNfQ09NUE9TSVRFX05PVEVCT09LLCBOT1RFQk9PS19FRElUT1JfRk9DVVNFRC5uZWdhdGUoKSlcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGhpc3RvcnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnRlcmFjdGl2ZUhpc3RvcnlTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JDb250cm9sID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lPy5nZXRDb250cm9sKCk7XG5cblx0XHRpZiAoZWRpdG9yQ29udHJvbCAmJiBpc1JlcGxFZGl0b3JDb250cm9sKGVkaXRvckNvbnRyb2wpICYmIGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IpIHtcblx0XHRcdGNvbnN0IG5vdGVib29rRG9jdW1lbnQgPSBlZGl0b3JDb250cm9sLm5vdGVib29rRWRpdG9yLnRleHRNb2RlbDtcblx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvckNvbnRyb2wuYWN0aXZlQ29kZUVkaXRvcj8uZ2V0TW9kZWwoKTtcblxuXHRcdFx0aWYgKG5vdGVib29rRG9jdW1lbnQgJiYgdGV4dE1vZGVsKSB7XG5cdFx0XHRcdGNvbnN0IG5leHRWYWx1ZSA9IGhpc3RvcnlTZXJ2aWNlLmdldE5leHRWYWx1ZShub3RlYm9va0RvY3VtZW50LnVyaSk7XG5cdFx0XHRcdGlmIChuZXh0VmFsdWUgIT09IG51bGwpIHtcblx0XHRcdFx0XHR0ZXh0TW9kZWwuc2V0VmFsdWUobmV4dFZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnaW50ZXJhY3RpdmUuc2Nyb2xsVG9Ub3AnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdpbnRlcmFjdGl2ZVNjcm9sbFRvVG9wJywgJ1Njcm9sbCB0byBUb3AnKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdhY3RpdmVFZGl0b3InLCAnd29ya2JlbmNoLmVkaXRvci5pbnRlcmFjdGl2ZScpLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuSG9tZSxcblx0XHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5VcEFycm93IH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IGludGVyYWN0aXZlV2luZG93Q2F0ZWdvcnksXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JDb250cm9sID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lPy5nZXRDb250cm9sKCk7XG5cblx0XHRpZiAoZWRpdG9yQ29udHJvbCAmJiBpc1JlcGxFZGl0b3JDb250cm9sKGVkaXRvckNvbnRyb2wpICYmIGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IpIHtcblx0XHRcdGlmIChlZGl0b3JDb250cm9sLm5vdGVib29rRWRpdG9yLmdldExlbmd0aCgpID09PSAwKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yQ29udHJvbC5ub3RlYm9va0VkaXRvci5yZXZlYWxDZWxsUmFuZ2VJblZpZXcoeyBzdGFydDogMCwgZW5kOiAxIH0pO1xuXHRcdH1cblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2ludGVyYWN0aXZlLnNjcm9sbFRvQm90dG9tJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnaW50ZXJhY3RpdmVTY3JvbGxUb0JvdHRvbScsICdTY3JvbGwgdG8gQm90dG9tJyksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygnYWN0aXZlRWRpdG9yJywgJ3dvcmtiZW5jaC5lZGl0b3IuaW50ZXJhY3RpdmUnKSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVuZCxcblx0XHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Eb3duQXJyb3cgfSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogaW50ZXJhY3RpdmVXaW5kb3dDYXRlZ29yeSxcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvckNvbnRyb2wgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmU/LmdldENvbnRyb2woKTtcblxuXHRcdGlmIChlZGl0b3JDb250cm9sICYmIGlzUmVwbEVkaXRvckNvbnRyb2woZWRpdG9yQ29udHJvbCkgJiYgZWRpdG9yQ29udHJvbC5ub3RlYm9va0VkaXRvcikge1xuXHRcdFx0aWYgKGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IuZ2V0TGVuZ3RoKCkgPT09IDApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBsZW4gPSBlZGl0b3JDb250cm9sLm5vdGVib29rRWRpdG9yLmdldExlbmd0aCgpO1xuXHRcdFx0ZWRpdG9yQ29udHJvbC5ub3RlYm9va0VkaXRvci5yZXZlYWxDZWxsUmFuZ2VJblZpZXcoeyBzdGFydDogbGVuIC0gMSwgZW5kOiBsZW4gfSk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnaW50ZXJhY3RpdmUuaW5wdXQuZm9jdXMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignaW50ZXJhY3RpdmUuaW5wdXQuZm9jdXMnLCAnRm9jdXMgSW5wdXQgRWRpdG9yJyksXG5cdFx0XHRjYXRlZ29yeTogaW50ZXJhY3RpdmVXaW5kb3dDYXRlZ29yeSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogSW50ZXJhY3RpdmVXaW5kb3dPcGVuXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yQ29udHJvbCA9IGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZT8uZ2V0Q29udHJvbCgpO1xuXG5cdFx0aWYgKGVkaXRvckNvbnRyb2wgJiYgaXNSZXBsRWRpdG9yQ29udHJvbChlZGl0b3JDb250cm9sKSAmJiBlZGl0b3JDb250cm9sLm5vdGVib29rRWRpdG9yKSB7XG5cdFx0XHRlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmU/LmZvY3VzKCk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0Ly8gZmluZCBhbmQgb3BlbiB0aGUgbW9zdCByZWNlbnQgaW50ZXJhY3RpdmUgd2luZG93XG5cdFx0XHRjb25zdCBvcGVuRWRpdG9ycyA9IGVkaXRvclNlcnZpY2UuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpO1xuXHRcdFx0Y29uc3QgaW50ZXJhY3RpdmVXaW5kb3cgPSBJdGVyYWJsZS5maW5kKG9wZW5FZGl0b3JzLCBpZGVudGlmaWVyID0+IHsgcmV0dXJuIGlkZW50aWZpZXIuZWRpdG9yLnR5cGVJZCA9PT0gSW50ZXJhY3RpdmVFZGl0b3JJbnB1dC5JRDsgfSk7XG5cdFx0XHRpZiAoaW50ZXJhY3RpdmVXaW5kb3cpIHtcblx0XHRcdFx0Y29uc3QgZWRpdG9ySW5wdXQgPSBpbnRlcmFjdGl2ZVdpbmRvdy5lZGl0b3IgYXMgSW50ZXJhY3RpdmVFZGl0b3JJbnB1dDtcblx0XHRcdFx0Y29uc3QgY3VycmVudEdyb3VwID0gaW50ZXJhY3RpdmVXaW5kb3cuZ3JvdXBJZDtcblx0XHRcdFx0Y29uc3QgZWRpdG9yID0gYXdhaXQgZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKGVkaXRvcklucHV0LCBjdXJyZW50R3JvdXApO1xuXHRcdFx0XHRjb25zdCBlZGl0b3JDb250cm9sID0gZWRpdG9yPy5nZXRDb250cm9sKCk7XG5cblx0XHRcdFx0aWYgKGVkaXRvckNvbnRyb2wgJiYgaXNSZXBsRWRpdG9yQ29udHJvbChlZGl0b3JDb250cm9sKSAmJiBlZGl0b3JDb250cm9sLm5vdGVib29rRWRpdG9yKSB7XG5cdFx0XHRcdFx0ZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lPy5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnaW50ZXJhY3RpdmUuaGlzdG9yeS5mb2N1cycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdpbnRlcmFjdGl2ZS5oaXN0b3J5LmZvY3VzJywgJ0ZvY3VzIEhpc3RvcnknKSxcblx0XHRcdGNhdGVnb3J5OiBpbnRlcmFjdGl2ZVdpbmRvd0NhdGVnb3J5LFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2FjdGl2ZUVkaXRvcicsICd3b3JrYmVuY2guZWRpdG9yLmludGVyYWN0aXZlJyksXG5cdFx0XHR9LFxuXHRcdFx0a2V5YmluZGluZzogW3tcblx0XHRcdFx0Ly8gT24gbWFjLCByZXF1aXJlIHRoYXQgdGhlIGN1cnNvciBpcyBhdCB0aGUgdG9wIG9mIHRoZSBpbnB1dCwgdG8gYXZvaWQgc3RlYWxpbmcgY21kK3VwIHRvIG1vdmUgdGhlIGN1cnNvciB0byB0aGUgdG9wXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRJTlRFUkFDVElWRV9JTlBVVF9DVVJTT1JfQk9VTkRBUlkubm90RXF1YWxzVG8oJ2JvdHRvbScpLFxuXHRcdFx0XHRcdElOVEVSQUNUSVZFX0lOUFVUX0NVUlNPUl9CT1VOREFSWS5ub3RFcXVhbHNUbygnbm9uZScpKSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyA1LFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuVXBBcnJvd1xuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoSXNXaW5kb3dzQ29udGV4dCwgSXNMaW51eENvbnRleHQpLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlVwQXJyb3csXG5cdFx0XHR9XSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKElTX0NPTVBPU0lURV9OT1RFQk9PSywgTk9URUJPT0tfRURJVE9SX0ZPQ1VTRUQubmVnYXRlKCkpXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JDb250cm9sID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lPy5nZXRDb250cm9sKCk7XG5cblx0XHRpZiAoZWRpdG9yQ29udHJvbCAmJiBpc1JlcGxFZGl0b3JDb250cm9sKGVkaXRvckNvbnRyb2wpICYmIGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IpIHtcblx0XHRcdGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IuZm9jdXMoKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5yZWdpc3RlckNvbG9yKCdpbnRlcmFjdGl2ZS5hY3RpdmVDb2RlQm9yZGVyJywge1xuXHRkYXJrOiBpZkRlZmluZWRUaGVuRWxzZShwZWVrVmlld0JvcmRlciwgcGVla1ZpZXdCb3JkZXIsICcjMDA3YWNjJyksXG5cdGxpZ2h0OiBpZkRlZmluZWRUaGVuRWxzZShwZWVrVmlld0JvcmRlciwgcGVla1ZpZXdCb3JkZXIsICcjMDA3YWNjJyksXG5cdGhjRGFyazogY29udHJhc3RCb3JkZXIsXG5cdGhjTGlnaHQ6IGNvbnRyYXN0Qm9yZGVyXG59LCBsb2NhbGl6ZSgnaW50ZXJhY3RpdmUuYWN0aXZlQ29kZUJvcmRlcicsICdUaGUgYm9yZGVyIGNvbG9yIGZvciB0aGUgY3VycmVudCBpbnRlcmFjdGl2ZSBjb2RlIGNlbGwgd2hlbiB0aGUgZWRpdG9yIGhhcyBmb2N1cy4nKSk7XG5cbnJlZ2lzdGVyQ29sb3IoJ2ludGVyYWN0aXZlLmluYWN0aXZlQ29kZUJvcmRlcicsIHtcblx0Ly9kYXJrOiB0aGVtZS5nZXRDb2xvcihsaXN0SW5hY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kKSA/PyB0cmFuc3BhcmVudChsaXN0SW5hY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kLCAxKSxcblx0ZGFyazogaWZEZWZpbmVkVGhlbkVsc2UobGlzdEluYWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZCwgbGlzdEluYWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZCwgJyMzNzM3M0QnKSxcblx0bGlnaHQ6IGlmRGVmaW5lZFRoZW5FbHNlKGxpc3RJbmFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmQsIGxpc3RJbmFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmQsICcjRTRFNkYxJyksXG5cdGhjRGFyazogUEFORUxfQk9SREVSLFxuXHRoY0xpZ2h0OiBQQU5FTF9CT1JERVJcbn0sIGxvY2FsaXplKCdpbnRlcmFjdGl2ZS5pbmFjdGl2ZUNvZGVCb3JkZXInLCAnVGhlIGJvcmRlciBjb2xvciBmb3IgdGhlIGN1cnJlbnQgaW50ZXJhY3RpdmUgY29kZSBjZWxsIHdoZW4gdGhlIGVkaXRvciBkb2VzIG5vdCBoYXZlIGZvY3VzLicpKTtcblxuUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbikucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0aWQ6ICdpbnRlcmFjdGl2ZVdpbmRvdycsXG5cdG9yZGVyOiAxMDAsXG5cdHR5cGU6ICdvYmplY3QnLFxuXHQncHJvcGVydGllcyc6IHtcblx0XHRbUmVwbEVkaXRvclNldHRpbmdzLmludGVyYWN0aXZlV2luZG93QWx3YXlzU2Nyb2xsT25OZXdDZWxsXToge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdpbnRlcmFjdGl2ZVdpbmRvdy5hbHdheXNTY3JvbGxPbk5ld0NlbGwnLCBcIkF1dG9tYXRpY2FsbHkgc2Nyb2xsIHRoZSBpbnRlcmFjdGl2ZSB3aW5kb3cgdG8gc2hvdyB0aGUgb3V0cHV0IG9mIHRoZSBsYXN0IHN0YXRlbWVudCBleGVjdXRlZC4gSWYgdGhpcyB2YWx1ZSBpcyBmYWxzZSwgdGhlIHdpbmRvdyB3aWxsIG9ubHkgc2Nyb2xsIGlmIHRoZSBsYXN0IGNlbGwgd2FzIGFscmVhZHkgdGhlIG9uZSBzY3JvbGxlZCB0by5cIilcblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcuSW50ZXJhY3RpdmVXaW5kb3dQcm9tcHRUb1NhdmVdOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdpbnRlcmFjdGl2ZVdpbmRvdy5wcm9tcHRUb1NhdmVPbkNsb3NlJywgXCJQcm9tcHQgdG8gc2F2ZSB0aGUgaW50ZXJhY3RpdmUgd2luZG93IHdoZW4gaXQgaXMgY2xvc2VkLiBPbmx5IG5ldyBpbnRlcmFjdGl2ZSB3aW5kb3dzIHdpbGwgYmUgYWZmZWN0ZWQgYnkgdGhpcyBzZXR0aW5nIGNoYW5nZS5cIilcblx0XHR9LFxuXHRcdFtSZXBsRWRpdG9yU2V0dGluZ3MuZXhlY3V0ZVdpdGhTaGlmdEVudGVyXToge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnaW50ZXJhY3RpdmVXaW5kb3cuZXhlY3V0ZVdpdGhTaGlmdEVudGVyJywgXCJFeGVjdXRlIHRoZSBJbnRlcmFjdGl2ZSBXaW5kb3cgKFJFUEwpIGlucHV0IGJveCB3aXRoIHNoaWZ0K2VudGVyLCBzbyB0aGF0IGVudGVyIGNhbiBiZSB1c2VkIHRvIGNyZWF0ZSBhIG5ld2xpbmUuXCIpLFxuXHRcdFx0dGFnczogWydyZXBsRXhlY3V0ZSddXG5cdFx0fSxcblx0XHRbUmVwbEVkaXRvclNldHRpbmdzLnNob3dFeGVjdXRpb25IaW50XToge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdpbnRlcmFjdGl2ZVdpbmRvdy5zaG93RXhlY3V0aW9uSGludCcsIFwiRGlzcGxheSBhIGhpbnQgaW4gdGhlIEludGVyYWN0aXZlIFdpbmRvdyAoUkVQTCkgaW5wdXQgYm94IHRvIGluZGljYXRlIGhvdyB0byBleGVjdXRlIGNvZGUuXCIpLFxuXHRcdFx0dGFnczogWydyZXBsRXhlY3V0ZSddXG5cdFx0fVxuXHR9XG59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QUVBLE1BQU0sSUFBSSxVQUEyQztBQUNwRCxVQUFNLGdCQUFnQixTQUFTLElBQUksY0FBYztBQUNqRCxVQUFNLGdCQUFnQixjQUFjLGtCQUFrQixXQUFXO0FBRWpFLFFBQUksaUJBQWlCLG9CQUFvQixhQUFhLEtBQUssY0FBYyxnQkFBZ0I7QUFDeEYsb0JBQWMsZUFBZSxNQUFNO0FBQUEsSUFDcEM7QUFBQSxFQUNEO0FBQ0QsQ0FBQztBQUVELGNBQWMsZ0NBQWdDO0FBQUEsRUFDN0MsTUFBTSxrQkFBa0IsZ0JBQWdCLGdCQUFnQixTQUFTO0FBQUEsRUFDakUsT0FBTyxrQkFBa0IsZ0JBQWdCLGdCQUFnQixTQUFTO0FBQUEsRUFDbEUsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUNWLEdBQUcsU0FBUyxnQ0FBZ0MsbUZBQW1GLENBQUM7QUFFaEksY0FBYyxrQ0FBa0M7QUFBQTtBQUFBLEVBRS9DLE1BQU0sa0JBQWtCLGlDQUFpQyxpQ0FBaUMsU0FBUztBQUFBLEVBQ25HLE9BQU8sa0JBQWtCLGlDQUFpQyxpQ0FBaUMsU0FBUztBQUFBLEVBQ3BHLFFBQVE7QUFBQSxFQUNSLFNBQVM7QUFDVixHQUFHLFNBQVMsa0NBQWtDLDZGQUE2RixDQUFDO0FBRTVJLFNBQVMsR0FBMkIsd0JBQXdCLGFBQWEsRUFBRSxzQkFBc0I7QUFBQSxFQUNoRyxJQUFJO0FBQUEsRUFDSixPQUFPO0FBQUEsRUFDUCxNQUFNO0FBQUEsRUFDTixjQUFjO0FBQUEsSUFDYixDQUFDLG1CQUFtQixzQ0FBc0MsR0FBRztBQUFBLE1BQzVELE1BQU07QUFBQSxNQUNOLFNBQVM7QUFBQSxNQUNULHFCQUFxQixTQUFTLDJDQUEyQyxzTUFBc007QUFBQSxJQUNoUjtBQUFBLElBQ0EsQ0FBQyxnQkFBZ0IsNkJBQTZCLEdBQUc7QUFBQSxNQUNoRCxNQUFNO0FBQUEsTUFDTixTQUFTO0FBQUEsTUFDVCxxQkFBcUIsU0FBUyx5Q0FBeUMsZ0lBQWdJO0FBQUEsSUFDeE07QUFBQSxJQUNBLENBQUMsbUJBQW1CLHFCQUFxQixHQUFHO0FBQUEsTUFDM0MsTUFBTTtBQUFBLE1BQ04sU0FBUztBQUFBLE1BQ1QscUJBQXFCLFNBQVMsMkNBQTJDLGtIQUFrSDtBQUFBLE1BQzNMLE1BQU0sQ0FBQyxhQUFhO0FBQUEsSUFDckI7QUFBQSxJQUNBLENBQUMsbUJBQW1CLGlCQUFpQixHQUFHO0FBQUEsTUFDdkMsTUFBTTtBQUFBLE1BQ04sU0FBUztBQUFBLE1BQ1QscUJBQXFCLFNBQVMsdUNBQXVDLDRGQUE0RjtBQUFBLE1BQ2pLLE1BQU0sQ0FBQyxhQUFhO0FBQUEsSUFDckI7QUFBQSxFQUNEO0FBQ0QsQ0FBQzsiLAogICJuYW1lcyI6IFsiaWQiLCAiZWRpdG9ySW5wdXQiLCAiZWRpdG9yQ29udHJvbCJdCn0K
